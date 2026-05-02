import p5 from 'p5';
import configData from '../data/config.json';
import type {
  GameConfig,
  GameState,
  GameSettings,
  ScreenName,
  AiStrategy,
  AiDifficulty,
  ObstaclePattern,
  PieceTypeId,
} from './types';
import {
  createInitialState,
  startAdvance,
  tickAnimation,
  selectPieceType,
  tryPlacePieceAt,
  tryReroll,
  restartGame,
  DEFAULT_SETTINGS,
} from './game';
import {
  drawBoardBackground,
  drawPiece,
  drawMoveHighlights,
  drawPlacementPreview,
  drawPredictPath,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  cellCenter,
  pixelToCell,
} from './render/BoardRenderer';
import { drawAnimationFrame } from './render/AnimationRenderer';
import {
  renderShop,
  updateHud,
  updateButtons,
  renderLegend,
} from './render/HUD';
import { predictPath, type PredictPath } from './systems/HoverPredict';
import { soundManager } from './audio/SoundManager';
import { trackEvent, Events } from './analytics';
import { initLang, setLang, t, applyI18nToDom } from './i18n';

const config = configData as GameConfig;

// ===== アプリケーション状態 =====
let currentScreen: ScreenName = 'title';
let currentSettings: GameSettings = loadSettings();
let state: GameState | null = null;

// ===== localStorage 永続化 =====
const SETTINGS_KEY = 'auto-strategos-settings-v1';
const TUTORIAL_KEY = 'auto-strategos-tutorial-seen-v1';

function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      aiStrategy: parsed.aiStrategy ?? DEFAULT_SETTINGS.aiStrategy,
      loadoutPreset: parsed.loadoutPreset ?? DEFAULT_SETTINGS.loadoutPreset,
      aiLoadoutPreset: parsed.aiLoadoutPreset ?? DEFAULT_SETTINGS.aiLoadoutPreset,
      aiDifficulty: parsed.aiDifficulty ?? DEFAULT_SETTINGS.aiDifficulty,
      obstaclePattern: parsed.obstaclePattern ?? DEFAULT_SETTINGS.obstaclePattern,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage 利用不可環境では無視
  }
}

// ===== 画面切替 =====
function showScreen(name: ScreenName): void {
  currentScreen = name;
  for (const id of ['screen-title', 'screen-settings', 'screen-game', 'screen-result']) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id === `screen-${name}`);
  }
}

// ===== ホバー予測キャッシュ =====
let cachedPredict: PredictPath | null = null;
let cachedPredictPieceId: number | null = null;

function invalidatePredict(): void {
  cachedPredict = null;
  cachedPredictPieceId = null;
}

function refreshPredict(): void {
  if (!state) return;
  if (state.phase !== 'placement') {
    invalidatePredict();
    return;
  }
  if (state.hoveredPieceId === null) {
    invalidatePredict();
    return;
  }
  if (cachedPredictPieceId === state.hoveredPieceId && cachedPredict !== null) {
    return;
  }
  cachedPredict = predictPath(state, state.hoveredPieceId);
  cachedPredictPieceId = state.hoveredPieceId;
}

// ===== shop 再描画ヘルパー =====
function rebindShop(): void {
  if (!state) return;
  const s = state;
  renderShop(s, (offerIndex) => {
    const offer = s.shop.offers[offerIndex];
    if (!offer || offer.consumed) return;
    if (s.selectedPieceTypeId === offer.pieceTypeId) {
      selectPieceType(s, null);
    } else {
      selectPieceType(s, offer.pieceTypeId);
    }
    rebindShop();
  });
}

// ===== ゲーム画面の初期化 / 再起動 =====
function startNewGame(settings: GameSettings): void {
  state = createInitialState(config, settings);
  invalidatePredict();
  showScreen('game');
  rebindShop();
  renderLegend(state);
  updateHud(state);
  updateButtons(state);
  trackEvent(Events.GAME_START, {
    ai_strategy: settings.aiStrategy,
    ai_difficulty: settings.aiDifficulty,
    obstacle_pattern: settings.obstaclePattern,
    player_loadout_count: settings.loadoutPreset.length,
    ai_loadout_count: settings.aiLoadoutPreset.length,
  });
}

function restartCurrentGame(): void {
  if (!state) {
    startNewGame(currentSettings);
    return;
  }
  restartGame(state);
  invalidatePredict();
  showScreen('game');
  rebindShop();
  renderLegend(state);
  updateHud(state);
  updateButtons(state);
}

// ===== 設定画面 ↔ UI 同期 =====
function populateLoadoutChecklist(): void {
  const container = document.getElementById('loadout-list');
  if (!container) return;
  container.innerHTML = '';
  const purchasable = config.pieceTypes.filter((t) => t.id !== 'obstacle');
  for (const type of purchasable) {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.name = 'loadout';
    cb.value = type.id;
    cb.checked = currentSettings.loadoutPreset.length === 0 ||
      currentSettings.loadoutPreset.includes(type.id);
    cb.addEventListener('change', updateLoadoutSummary);
    label.appendChild(cb);
    label.appendChild(document.createTextNode(` ${type.symbol} ${type.name} (${type.cost}g)`));
    container.appendChild(label);
  }
  updateLoadoutSummary();
}

// AI 用の駒選択チェックリスト
function populateAiLoadoutChecklist(): void {
  const container = document.getElementById('ai-loadout-list');
  if (!container) return;
  container.innerHTML = '';
  const purchasable = config.pieceTypes.filter((t) => t.id !== 'obstacle');
  for (const type of purchasable) {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.name = 'ai-loadout';
    cb.value = type.id;
    // AI 編成は空 = 難易度デフォルト適用なので、空配列ならチェックなし
    cb.checked = currentSettings.aiLoadoutPreset.includes(type.id);
    label.appendChild(cb);
    label.appendChild(document.createTextNode(` ${type.symbol} ${type.name} (${type.cost}g)`));
    container.appendChild(label);
  }
}

// 選択数のカウント表示と警告メッセージ
function updateLoadoutSummary(): void {
  const summaryId = 'loadout-summary';
  let summary = document.getElementById(summaryId);
  if (!summary) {
    summary = document.createElement('div');
    summary.id = summaryId;
    summary.style.marginTop = '8px';
    summary.style.fontSize = '12px';
    document.getElementById('loadout-list')?.parentElement?.appendChild(summary);
  }
  const checked = document.querySelectorAll<HTMLInputElement>('input[name="loadout"]:checked');
  const total = config.pieceTypes.filter((t) => t.id !== 'obstacle').length;
  const count = checked.length;
  let warning = '';
  let color = '#b8a888';
  if (count === 0) {
    warning = ' ⚠️ 最低 1 種類は選択してください(自動的に全選択を適用します)';
    color = '#ff8888';
  } else if (count === 1) {
    warning = ' ⚠️ 駒種 1 種は単調になり、戦術的にプレイヤー有利に偏ります';
    color = '#ffaa66';
  } else if (count === 2) {
    warning = ' ※ 2 種は縛りプレイ寄り。3 種以上推奨';
    color = '#ddcc88';
  } else {
    warning = ' バランス良好';
    color = '#88cc88';
  }
  summary.innerHTML = `<span style="color:#d8c8a8">選択中:</span> <span style="color:#ffd700; font-weight:bold">${count}</span> / ${total}<span style="color:${color}">${warning}</span>`;
}

function applySettingsToUI(): void {
  // ラジオボタン
  setRadio('ai-strategy', currentSettings.aiStrategy);
  setRadio('ai-difficulty', currentSettings.aiDifficulty);
  setRadio('obstacle', currentSettings.obstaclePattern);
  // チェックボックス(プレイヤー編成 + AI 編成)
  populateLoadoutChecklist();
  populateAiLoadoutChecklist();
  // 音量スライダー
  const se = document.getElementById('se-volume') as HTMLInputElement | null;
  const bgm = document.getElementById('bgm-volume') as HTMLInputElement | null;
  if (se) se.value = String(Math.round(soundManager.getSeVolume() * 100));
  if (bgm) bgm.value = String(Math.round(soundManager.getBgmVolume() * 100));
}

function setRadio(name: string, value: string): void {
  const radios = document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`);
  radios.forEach((r) => { r.checked = r.value === value; });
}

function readSettingsFromUI(): GameSettings {
  const aiStrategy = (getRadio('ai-strategy') as AiStrategy) ?? DEFAULT_SETTINGS.aiStrategy;
  const aiDifficulty = (getRadio('ai-difficulty') as AiDifficulty) ?? DEFAULT_SETTINGS.aiDifficulty;
  const obstaclePattern = (getRadio('obstacle') as ObstaclePattern) ?? DEFAULT_SETTINGS.obstaclePattern;

  // プレイヤー編成
  const loadoutPreset: PieceTypeId[] = [];
  document.querySelectorAll<HTMLInputElement>('input[name="loadout"]:checked').forEach((cb) =>
    loadoutPreset.push(cb.value as PieceTypeId),
  );
  const purchasableCount = config.pieceTypes.filter((t) => t.id !== 'obstacle').length;
  const finalPreset = loadoutPreset.length === purchasableCount ? [] : loadoutPreset;

  // AI 編成(空 = 難易度デフォルト)
  const aiLoadoutPreset: PieceTypeId[] = [];
  document.querySelectorAll<HTMLInputElement>('input[name="ai-loadout"]:checked').forEach((cb) =>
    aiLoadoutPreset.push(cb.value as PieceTypeId),
  );
  // 全選択は空配列扱い(難易度デフォルトに任せず明示的全駒)とは別の意味なので、
  // ユーザーが全選択した場合は明示的に loadoutPreset と同じく空に変換するか保留
  // ここでは「全選択 = 空(デフォルト)」とは扱わず、生のままを返す
  // 「全解除 = デフォルト適用」を意図しているので、空のままなら難易度別が適用される

  return { aiStrategy, aiDifficulty, obstaclePattern, loadoutPreset: finalPreset, aiLoadoutPreset };
}

function getRadio(name: string): string | null {
  const checked = document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
  return checked?.value ?? null;
}

// ===== チュートリアルモーダル =====
function showTutorial(): void {
  document.getElementById('tutorial-modal')?.classList.add('show');
}
function hideTutorial(): void {
  document.getElementById('tutorial-modal')?.classList.remove('show');
}
function maybeShowTutorialOnFirstRun(): void {
  try {
    if (!localStorage.getItem(TUTORIAL_KEY)) {
      showTutorial();
      localStorage.setItem(TUTORIAL_KEY, '1');
    }
  } catch {
    showTutorial();
  }
}

// ===== リザルト画面表示 =====
function showResultScreen(): void {
  if (!state) return;
  const titleEl = document.getElementById('result-title-screen');
  const subEl = document.getElementById('result-subtitle-screen');
  if (titleEl) {
    if (state.result === 'win') {
      titleEl.className = 'result-title win';
      titleEl.textContent = t('result.win');
    } else if (state.result === 'lose') {
      titleEl.className = 'result-title lose';
      titleEl.textContent = t('result.lose');
    } else {
      titleEl.className = 'result-title draw';
      titleEl.textContent = t('result.draw');
    }
  }
  if (subEl) {
    if (state.result === 'win') subEl.textContent = t('result.subWin');
    else if (state.result === 'lose') subEl.textContent = t('result.subLose');
    else subEl.textContent = t('result.subDraw');
  }
  setText('rs-cycles', String(state.cycle));
  setText('rs-reach-self', `${state.player.reachCount} / 3`);
  setText('rs-reach-enemy', `${state.enemy.reachCount} / 3`);
  setText('rs-player-kills', String(state.stats.playerKills));
  // ラベルも翻訳更新
  document.querySelectorAll<HTMLElement>('#screen-result [data-i18n-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-label');
    if (key) el.textContent = t(key);
  });
  showScreen('result');
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ===== p5 sketch =====
const sketch = (p: p5) => {
  let lastMs = 0;

  p.setup = () => {
    const canvas = p.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    canvas.parent('app');
    p.frameRate(60);
    initLang();
    applyI18nToDom();
    bindUiButtons();
    applySettingsToUI();
    showScreen('title');  // 初期画面はタイトル
    maybeShowTutorialOnFirstRun();
    lastMs = p.millis();
  };

  p.draw = () => {
    const now = p.millis();
    const dt = now - lastMs;
    lastMs = now;

    // ゲーム画面以外では描画スキップ
    if (currentScreen !== 'game' || !state) {
      p.clear();
      return;
    }

    const prevPhase = state.phase;
    const prevAnimStep = state.animation?.currentStepIndex ?? -1;
    if (state.phase === 'animating') {
      tickAnimation(state, dt);
    }
    // アニメ step 遷移時に SE 再生(spam 防止: 1 step = 1 SE 程度)
    if (state.animation && state.animation.currentStepIndex !== prevAnimStep) {
      const newIdx = state.animation.currentStepIndex;
      if (newIdx > 0 && newIdx <= state.animation.steps.length) {
        const finishedStep = state.animation.steps[newIdx - 1];
        if (finishedStep) {
          if (finishedStep.combatEvents.some((e) => e.defenderDestroyed)) {
            soundManager.playDestroy();
          } else if (finishedStep.combatEvents.length > 0) {
            soundManager.playAttack();
          }
          if (finishedStep.reachEvents.length > 0) {
            soundManager.playReach();
          }
        }
      }
    }

    // アニメ終了直後の遷移処理
    if (prevPhase === 'animating' && state.phase !== 'animating') {
      rebindShop();
      updateButtons(state);
      if (state.phase === 'finished' && state.result) {
        // 勝敗 SE
        if (state.result === 'win') soundManager.playWin();
        else if (state.result === 'lose') soundManager.playLose();
        // GA4 イベント
        const eventName = state.result === 'win' ? Events.GAME_WON
          : state.result === 'lose' ? Events.GAME_LOST
          : Events.GAME_DREW;
        trackEvent(eventName, {
          cycles: state.cycle,
          player_reach: state.player.reachCount,
          enemy_reach: state.enemy.reachCount,
          player_kills: state.stats.playerKills,
        });
        // リザルト画面へ自動遷移
        showResultScreen();
        return;
      }
    }

    if (state.phase === 'animating' && state.animation) {
      drawAnimationFrame(p, state);
    } else {
      drawBoardBackground(p, state.config);

      // ホバー駒の動ける範囲ハイライト
      const hoveredId1 = state.hoveredPieceId;
      if (hoveredId1 !== null) {
        const piece = state.board.pieces.find((pp) => pp.id === hoveredId1);
        if (piece && piece.hp > 0) {
          drawMoveHighlights(p, piece, state.board, state.config);
        }
      }

      // 全駒描画
      for (const piece of state.board.pieces) {
        if (piece.hp <= 0) continue;
        const pos = cellCenter(piece.col, piece.row, state.config.rules.boardSize);
        const highlighted = state.hoveredPieceId === piece.id;
        drawPiece(p, piece, state.config, pos, 1, highlighted);
      }

      // 配置プレビュー
      if (state.phase === 'placement' && state.selectedPieceTypeId) {
        const cell = pixelToCell(p.mouseX, p.mouseY);
        if (cell && cell.row <= state.config.rules.placementMaxRow) {
          drawPlacementPreview(p, cell.col, cell.row);
        }
      }

      // 3 ターン予測経路
      refreshPredict();
      const hoveredId2 = state.hoveredPieceId;
      if (cachedPredict && hoveredId2 !== null) {
        const piece = state.board.pieces.find((pp) => pp.id === hoveredId2);
        if (piece) {
          const type = state.config.pieceTypes.find((t) => t.id === piece.typeId);
          if (type && type.moveStyle !== 'stationary') {
            drawPredictPath(p, cachedPredict, piece.side, state.config.rules.boardSize);
          }
        }
      }
    }
    updateHud(state);
  };

  p.mousePressed = () => {
    if (currentScreen !== 'game' || !state) return;
    if (state.phase !== 'placement') return;
    const cell = pixelToCell(p.mouseX, p.mouseY);
    if (!cell) return;
    if (state.selectedPieceTypeId) {
      const placed = tryPlacePieceAt(state, cell.col, cell.row);
      if (placed) {
        soundManager.playPlace();
        rebindShop();
        updateButtons(state);
        invalidatePredict();
      }
    }
  };

  p.mouseMoved = () => {
    if (currentScreen !== 'game' || !state) return;
    const prevHovered = state.hoveredPieceId;
    state.hoveredPieceId = null;
    const cell = pixelToCell(p.mouseX, p.mouseY);
    if (cell) {
      const piece = state.board.pieces.find(
        (pp) => pp.col === cell.col && pp.row === cell.row && pp.hp > 0,
      );
      if (piece) state.hoveredPieceId = piece.id;
    }
    if (prevHovered !== state.hoveredPieceId) {
      cachedPredict = null;
      cachedPredictPieceId = null;
    }
  };
};

// ===== UI ボタンバインド =====
function bindUiButtons(): void {
  // タイトル画面
  document.getElementById('title-quickstart')?.addEventListener('click', () => {
    startNewGame(currentSettings);
  });
  document.getElementById('title-settings')?.addEventListener('click', () => {
    applySettingsToUI();
    showScreen('settings');
  });
  document.getElementById('title-help')?.addEventListener('click', showTutorial);

  // 設定画面
  document.getElementById('settings-back')?.addEventListener('click', () => {
    showScreen('title');
  });
  document.getElementById('settings-reset')?.addEventListener('click', () => {
    currentSettings = { ...DEFAULT_SETTINGS };
    applySettingsToUI();
  });
  document.getElementById('settings-start')?.addEventListener('click', () => {
    currentSettings = readSettingsFromUI();
    saveSettings(currentSettings);
    trackEvent(Events.SETTING_CHANGED, {
      ai_strategy: currentSettings.aiStrategy,
      ai_difficulty: currentSettings.aiDifficulty,
      obstacle_pattern: currentSettings.obstaclePattern,
    });
    startNewGame(currentSettings);
  });

  // 音量スライダー(変更即反映 + 保存)
  document.getElementById('se-volume')?.addEventListener('input', (ev) => {
    const v = parseInt((ev.target as HTMLInputElement).value, 10);
    soundManager.setSeVolume(v / 100);
  });
  document.getElementById('bgm-volume')?.addEventListener('input', (ev) => {
    const v = parseInt((ev.target as HTMLInputElement).value, 10);
    soundManager.setBgmVolume(v / 100);
  });
  // SE 音量を変えたら試聴音
  document.getElementById('se-volume')?.addEventListener('change', () => {
    soundManager.playClick();
  });

  // ゲーム画面
  document.getElementById('go-btn')?.addEventListener('click', () => {
    if (!state) return;
    soundManager.playGo();
    startAdvance(state);
    updateButtons(state);
    invalidatePredict();
  });
  document.getElementById('reroll-btn')?.addEventListener('click', () => {
    if (!state) return;
    if (tryReroll(state)) {
      soundManager.playClick();
      rebindShop();
      updateButtons(state);
      invalidatePredict();
    }
  });
  document.getElementById('legend-toggle')?.addEventListener('click', () => {
    const panel = document.getElementById('legend-panel');
    const btn = document.getElementById('legend-toggle');
    if (!panel || !btn) return;
    panel.classList.toggle('collapsed');
    btn.textContent = panel.classList.contains('collapsed') ? '+' : '−';
  });
  document.getElementById('help-btn')?.addEventListener('click', showTutorial);
  document.getElementById('title-btn-game')?.addEventListener('click', () => {
    showScreen('title');
  });

  // リザルト画面
  document.getElementById('result-restart')?.addEventListener('click', () => {
    restartCurrentGame();
  });
  document.getElementById('result-title-btn')?.addEventListener('click', () => {
    showScreen('title');
  });

  // 言語切替ボタン(タイトル画面)
  document.querySelectorAll<HTMLButtonElement>('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      if (lang === 'ja' || lang === 'en') {
        setLang(lang);
        applyI18nToDom();
        // ゲーム関連 UI を再生成
        if (state) {
          rebindShop();
          renderLegend(state);
          updateHud(state);
        }
        applySettingsToUI();
        soundManager.playClick();
      }
    });
  });

  // チュートリアル
  document.getElementById('tutorial-close')?.addEventListener('click', hideTutorial);
  document.getElementById('tutorial-modal')?.addEventListener('click', (ev) => {
    if (ev.target === ev.currentTarget) hideTutorial();
  });

  // プライバシーポリシー
  document.getElementById('title-privacy')?.addEventListener('click', () => {
    document.getElementById('privacy-modal')?.classList.add('show');
    trackEvent(Events.PRIVACY_OPENED);
  });
  document.getElementById('privacy-close')?.addEventListener('click', () => {
    document.getElementById('privacy-modal')?.classList.remove('show');
  });
  document.getElementById('privacy-modal')?.addEventListener('click', (ev) => {
    if (ev.target === ev.currentTarget) {
      document.getElementById('privacy-modal')?.classList.remove('show');
    }
  });
}

new p5(sketch);
