import type { GameState, Piece } from '../types';
import { runOneTurn } from './AutoAdvance';

export interface PredictedPosition {
  col: number;
  row: number;
  alive: boolean;       // 駒がそのターン後も生存しているか
  reached: boolean;     // 敵陣最奥に到達したか
  destroyed: boolean;   // 戦闘で破壊されたか
}

export interface PredictPath {
  pieceId: number;
  // index 0 = 開始位置(ターン 0 前)
  // index 1..3 = ターン 1..3 後の位置
  positions: PredictedPosition[];
}

// 単一駒の 3 ターン予測経路を計算
export function predictPath(state: GameState, focusedPieceId: number): PredictPath {
  const sim = cloneStateForPredict(state);
  const focused = sim.board.pieces.find((p) => p.id === focusedPieceId);
  if (!focused) return { pieceId: focusedPieceId, positions: [] };

  const positions: PredictedPosition[] = [
    { col: focused.col, row: focused.row, alive: true, reached: false, destroyed: false },
  ];

  const turnsTotal = state.config.rules.advanceTurnsPerCycle;
  for (let t = 0; t < turnsTotal; t++) {
    const step = runOneTurn(sim, t);
    const piece = sim.board.pieces.find((p) => p.id === focusedPieceId);
    if (piece) {
      positions.push({
        col: piece.col,
        row: piece.row,
        alive: true,
        reached: false,
        destroyed: false,
      });
    } else {
      // 駒は退場済 — 戦闘破壊か到達かをイベントで判定
      const destroyedEvent = step.combatEvents.find(
        (e) => e.defenderId === focusedPieceId && e.defenderDestroyed,
      );
      const reachedEvent = step.reachEvents.find((e) => e.pieceId === focusedPieceId);
      const last = positions[positions.length - 1];
      positions.push({
        col: last.col,
        row: last.row,
        alive: false,
        reached: !!reachedEvent,
        destroyed: !!destroyedEvent,
      });
      break;
    }
  }
  return { pieceId: focusedPieceId, positions };
}

// 予測用に state を浅複製(config は共有、可変部分のみ複製)
function cloneStateForPredict(state: GameState): GameState {
  return {
    ...state,
    board: {
      ...state.board,
      pieces: state.board.pieces.map((p) => ({ ...p })),
    },
    player: { ...state.player },
    enemy: { ...state.enemy },
    shop: {
      ...state.shop,
      offers: state.shop.offers.map((o) => ({ ...o })),
    },
    animation: null,
  };
}
