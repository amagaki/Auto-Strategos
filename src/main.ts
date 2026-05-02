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
    label.appendChild(cb);
    label.appendChild(document.createTextNode(` ${type.symbol} ${type.name} (${type.cost}g)`));
    container.appendChild(label);
  }
}

function applySettingsToUI(): void {
  // ラジオボタン
  setRadio('ai-strategy', currentSettings.aiStrategy);
  setRadio('ai-difficulty', currentSettings.aiDifficulty);
  setRadio('obstacle', currentSettings.obstaclePattern);
  // チェックボックス(プリセット)
  populateLoadoutChecklist();
}

function setRadio(name: string, value: string): void {
  const radios = document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`);
  radios.forEach((r) => { r.checked = r.value === value; });
}

function readSettingsFromUI(): GameSettings {
  const aiStrategy = (getRadio('ai-strategy') as AiStrategy) ?? DEFAULT_SETTINGS.aiStrategy;
  const aiDifficulty = (getRadio('ai-difficulty') as AiDifficulty) ?? DEFAULT_SETTINGS.aiDifficulty;
  const obstaclePattern = (getRadio('obstacle') as ObstaclePattern) ?? DEFAULT_SETTINGS.obstaclePattern;
  const loadoutPreset: PieceTypeId[] = [];
  const cbs = document.querySelectorAll<HTMLInputElement>('input[name="loadout"]:checked');
  cbs.forEach((cb) => loadoutPreset.push(cb.value as PieceTypeId));
  // 全選択 = 空配列(loadoutPreset 未指定扱い)
  const purchasableCount = config.pieceTypes.filter((t) => t.id !== 'obstacle').length;
  const finalPreset = loadoutPreset.length === purchasableCount ? [] : loadoutPreset;
  return { aiStrategy, aiDifficulty, obstaclePattern, loadoutPreset: finalPreset };
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
      titleEl.textContent = '勝利';
    } else if (state.result === 'lose') {
      titleEl.className = 'result-title lose';
      titleEl.textContent = '敗北';
    } else {
      titleEl.className = 'result-title draw';
      titleEl.textContent = '引き分け';
    }
  }
  if (subEl) {
    if (state.result === 'win') subEl.textContent = '敵陣最奥に 3 体到達';
    else if (state.result === 'lose') subEl.textContent = '自陣最奥に 3 体到達されました';
    else subEl.textContent = '同サイクルで両者 3 体到達';
  }
  setText('rs-cycles', String(state.cycle));
  setText('rs-reach-self', `${state.player.reachCount} / 3`);
  setText('rs-reach-enemy', `${state.enemy.reachCount} / 3`);
  setText('rs-player-kills', String(state.stats.playerKills));
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
    if (state.phase === 'animating') {
      tickAnimation(state, dt);
    }

    // アニメ終了直後の遷移処理
    if (prevPhase === 'animating' && state.phase !== 'animating') {
      rebindShop();
      updateButtons(state);
      if (state.phase === 'finished' && state.result) {
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
    startNewGame(currentSettings);
  });

  // ゲーム画面
  document.getElementById('go-btn')?.addEventListener('click', () => {
    if (!state) return;
    startAdvance(state);
    updateButtons(state);
    invalidatePredict();
  });
  document.getElementById('reroll-btn')?.addEventListener('click', () => {
    if (!state) return;
    if (tryReroll(state)) {
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

  // チュートリアル
  document.getElementById('tutorial-close')?.addEventListener('click', hideTutorial);
  document.getElementById('tutorial-modal')?.addEventListener('click', (ev) => {
    if (ev.target === ev.currentTarget) hideTutorial();
  });
}

new p5(sketch);
