import type {
  GameState,
  GameConfig,
  Piece,
  PieceTypeId,
  GameSettings,
  ObstaclePattern,
} from './types';
import { createBoard, addPiece, isCellEmpty, isPlayerPlacementCell } from './systems/Board';
import {
  generateShopOffers,
  applyCycleIncome,
  rerollShop,
} from './systems/Shop';
import { aiTakeTurn } from './systems/AI';
import { runAdvancePhase } from './systems/AutoAdvance';
import { getPieceType } from './systems/Pieces';

// デフォルト設定: 設定画面を経由しなくても "良い感じ" で遊べる値
export const DEFAULT_SETTINGS: GameSettings = {
  aiStrategy: 'balanced',
  loadoutPreset: [],   // 空 = 全駒種(購入可能なものすべて)
  aiDifficulty: 'normal',
  obstaclePattern: 'standard',
};

// 障害物パターン別レイアウト
//   standard: row 2 / row 5 の col 1,2,5,6(各 4 マス)
//   none: なし
//   dense: row 2/3/5/6 に分散(各 row 3 マス、計 12 マス)
const OBSTACLE_LAYOUTS: Record<ObstaclePattern, {
  player: ReadonlyArray<{ col: number; row: number }>;
  enemy: ReadonlyArray<{ col: number; row: number }>;
}> = {
  standard: {
    player: [
      { col: 1, row: 2 }, { col: 2, row: 2 }, { col: 5, row: 2 }, { col: 6, row: 2 },
    ],
    enemy: [
      { col: 1, row: 5 }, { col: 2, row: 5 }, { col: 5, row: 5 }, { col: 6, row: 5 },
    ],
  },
  none: {
    player: [],
    enemy: [],
  },
  dense: {
    player: [
      { col: 1, row: 2 }, { col: 4, row: 2 }, { col: 6, row: 2 },
      { col: 0, row: 3 }, { col: 3, row: 3 }, { col: 7, row: 3 },
    ],
    enemy: [
      { col: 1, row: 5 }, { col: 4, row: 5 }, { col: 6, row: 5 },
      { col: 0, row: 4 }, { col: 3, row: 4 }, { col: 7, row: 4 },
    ],
  },
};

function placeInitialObstacles(state: GameState, pattern: ObstaclePattern): void {
  const obstacleType = state.config.pieceTypes.find((t) => t.id === 'obstacle');
  if (!obstacleType) return;
  const layout = OBSTACLE_LAYOUTS[pattern];
  for (const cell of layout.player) {
    addPiece(state.board, {
      id: state.nextPieceId++,
      typeId: 'obstacle',
      side: 'player',
      hp: obstacleType.hp,
      col: cell.col,
      row: cell.row,
    });
  }
  for (const cell of layout.enemy) {
    addPiece(state.board, {
      id: state.nextPieceId++,
      typeId: 'obstacle',
      side: 'enemy',
      hp: obstacleType.hp,
      col: cell.col,
      row: cell.row,
    });
  }
}

// 難易度別パラメータの取得(config.difficulty があればそれ、なければハードコード)
function getDifficultyParams(config: GameConfig, settings: GameSettings) {
  const fallback = {
    easy: { initialGold: 3, purchasePerCycle: 1 },
    normal: { initialGold: 5, purchasePerCycle: 2 },
    hard: { initialGold: 7, purchasePerCycle: 3 },
  };
  const table = config.difficulty ?? fallback;
  return table[settings.aiDifficulty];
}

export function createInitialState(config: GameConfig, settings: GameSettings = DEFAULT_SETTINGS): GameState {
  const diff = getDifficultyParams(config, settings);
  const state: GameState = {
    cycle: 1,
    phase: 'placement',
    board: createBoard(config.rules.boardSize),
    player: { gold: config.economy.initialGold, reachCount: 0 },
    enemy: { gold: diff.initialGold, reachCount: 0 },
    shop: { offers: generateShopOffers(config, settings.loadoutPreset) },
    selectedPieceTypeId: null,
    hoveredPieceId: null,
    result: null,
    animation: null,
    nextPieceId: 1,
    config,
    settings,
    stats: { playerKills: 0, enemyKills: 0, obstaclesDestroyed: 0 },
  };
  // 障害物配置(設定によって変動)
  placeInitialObstacles(state, settings.obstaclePattern);
  // 初期サイクル AI 配置
  aiTakeTurn(state);
  return state;
}

export function selectPieceType(state: GameState, typeId: PieceTypeId | null): void {
  if (state.phase !== 'placement') return;
  state.selectedPieceTypeId = typeId;
}

// プレイヤーが盤面マスをクリック → 配置
export function tryPlacePieceAt(state: GameState, col: number, row: number): boolean {
  if (state.phase !== 'placement') return false;
  if (!state.selectedPieceTypeId) return false;
  if (!isPlayerPlacementCell(row, state.config)) return false;
  if (!isCellEmpty(state.board, col, row)) return false;

  // 4 枚ランダム提示モデル: 同タイプの未消費 offer を 1 枚消費
  const offerIndex = state.shop.offers.findIndex(
    (o) => !o.consumed && o.pieceTypeId === state.selectedPieceTypeId,
  );
  if (offerIndex < 0) return false;
  const offer = state.shop.offers[offerIndex];
  const type = getPieceType(state.config, offer.pieceTypeId);
  if (state.player.gold < type.cost) return false;

  const piece: Piece = {
    id: state.nextPieceId++,
    typeId: offer.pieceTypeId,
    side: 'player',
    hp: type.hp,
    col,
    row,
  };
  addPiece(state.board, piece);
  state.player.gold -= type.cost;
  offer.consumed = true;

  // 同タイプの未消費 offer がもう無ければ選択解除
  const stillHas = state.shop.offers.some(
    (o) => !o.consumed && o.pieceTypeId === state.selectedPieceTypeId,
  );
  if (!stillHas) state.selectedPieceTypeId = null;

  return true;
}

export function tryReroll(state: GameState): boolean {
  if (state.phase !== 'placement') return false;
  return rerollShop(state);
}

// [Go] ボタン押下: 自動進行アニメ開始
export function startAdvance(state: GameState): void {
  if (state.phase !== 'placement') return;

  // 初期 snapshot
  const initialPre = state.board.pieces.map((p) => ({ ...p }));
  const initialPlayerReach = state.player.reachCount;
  const initialEnemyReach = state.enemy.reachCount;

  // 自動進行ロジックを実行(state を直接変更、最終状態へ進む)
  const steps = runAdvancePhase(state);

  state.animation = {
    initialPreSnapshot: initialPre,
    initialPlayerReach,
    initialEnemyReach,
    steps,
    currentStepIndex: 0,
    elapsedMs: 0,
    msPerStep: state.config.render.msPerAnimationStep,
  };
  state.phase = 'animating';
  state.selectedPieceTypeId = null;
}

// アニメ進行(dt ミリ秒)
export function tickAnimation(state: GameState, dtMs: number): void {
  if (state.phase !== 'animating' || !state.animation) return;
  const anim = state.animation;
  anim.elapsedMs += dtMs;
  if (anim.elapsedMs >= anim.msPerStep) {
    anim.currentStepIndex++;
    anim.elapsedMs = 0;
    if (anim.currentStepIndex >= anim.steps.length) {
      finalizeAnimation(state);
    }
  }
}

function finalizeAnimation(state: GameState): void {
  state.animation = null;

  // 勝敗判定: 同サイクル内に両者条件達成なら引き分け
  const playerReached = state.player.reachCount >= state.config.rules.reachToWin;
  const enemyReached = state.enemy.reachCount >= state.config.rules.reachToWin;
  if (playerReached && enemyReached) {
    state.result = 'draw';
    state.phase = 'finished';
    return;
  }
  if (playerReached) {
    state.result = 'win';
    state.phase = 'finished';
    return;
  }
  if (enemyReached) {
    state.result = 'lose';
    state.phase = 'finished';
    return;
  }

  // 次サイクルへ
  state.cycle++;
  applyCycleIncome(state);
  state.shop.offers = generateShopOffers(state.config, state.settings.loadoutPreset);
  aiTakeTurn(state);
  state.phase = 'placement';
}

export function restartGame(state: GameState): void {
  const config = state.config;
  const settings = state.settings;
  const fresh = createInitialState(config, settings);
  Object.assign(state, fresh);
}
