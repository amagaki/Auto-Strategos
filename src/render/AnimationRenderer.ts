import type p5 from 'p5';
import type { Piece, GameState, AnimationStep } from '../types';
import {
  drawBoardBackground,
  drawPiece,
  cellCenter,
  CELL_SIZE,
} from './BoardRenderer';

// 現在のステップの「開始時」駒スナップショットを取得
function getPreSnapshot(state: GameState, stepIndex: number): Piece[] {
  if (!state.animation) return [];
  if (stepIndex === 0) return state.animation.initialPreSnapshot;
  return state.animation.steps[stepIndex - 1].pieceSnapshot;
}

// イーズアウト
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

// アニメーションフェーズの盤面描画
export function drawAnimationFrame(p: p5, state: GameState): void {
  if (!state.animation) return;
  const anim = state.animation;
  const stepIndex = anim.currentStepIndex;
  if (stepIndex >= anim.steps.length) {
    drawBoardBackground(p, state.config);
    return;
  }

  const step = anim.steps[stepIndex];
  const tRaw = Math.min(1, anim.elapsedMs / anim.msPerStep);
  const t = easeOutQuad(tRaw);

  drawBoardBackground(p, state.config);

  const pre = getPreSnapshot(state, stepIndex);
  const moveByPieceId = new Map(step.pieceMoves.map((m) => [m.pieceId, m]));

  // 戦闘で消滅した駒 → そのターン中フェードアウト
  const destroyedIds = new Set(
    step.combatEvents.filter((e) => e.defenderDestroyed).map((e) => e.defenderId),
  );
  // ゴール到達した駒 → そのターン終わりに退場
  const reachedIds = new Set(step.reachEvents.map((e) => e.pieceId));

  for (const piece of pre) {
    if (piece.hp <= 0) continue;

    let drawPos: { x: number; y: number };
    let alpha = 1;

    const move = moveByPieceId.get(piece.id);
    if (move) {
      // 補間
      const fromCenter = cellCenter(move.fromCol, move.fromRow, state.config.rules.boardSize);
      const toCenter = cellCenter(move.toCol, move.toRow, state.config.rules.boardSize);
      drawPos = {
        x: fromCenter.x + (toCenter.x - fromCenter.x) * t,
        y: fromCenter.y + (toCenter.y - fromCenter.y) * t,
      };
    } else {
      // 動かない駒 → 元位置で固定
      drawPos = cellCenter(piece.col, piece.row, state.config.rules.boardSize);
    }

    if (destroyedIds.has(piece.id)) {
      // 後半でフェードアウト
      alpha = tRaw < 0.5 ? 1 : 1 - (tRaw - 0.5) * 2;
    } else if (reachedIds.has(piece.id) && tRaw > 0.7) {
      // 到達演出: 後半で輝いてからフェード
      alpha = 1 - (tRaw - 0.7) / 0.3;
    }

    // この駒の現在 HP は ステップ後の HP(post-snapshot を参照)
    // pre は移動前のため HP 古い。post を見て表示する
    const postPiece = step.pieceSnapshot.find((sp) => sp.id === piece.id);
    const displayPiece: Piece = postPiece
      ? { ...piece, hp: postPiece.hp, col: postPiece.col, row: postPiece.row }
      : { ...piece };

    drawPiece(p, displayPiece, state.config, drawPos, alpha);
  }

  // 戦闘ダメージのフラッシュ表示(中盤に表示)
  if (tRaw > 0.35 && tRaw < 0.85) {
    drawCombatFlashes(p, step, state, tRaw);
  }
}

function drawCombatFlashes(p: p5, step: AnimationStep, state: GameState, tRaw: number): void {
  for (const ev of step.combatEvents) {
    const pos = cellCenter(ev.atCol, ev.atRow, state.config.rules.boardSize);
    const localT = (tRaw - 0.35) / 0.5;  // 0..1
    const alpha = Math.round((1 - localT) * 255);
    const yOffset = -localT * 30;

    p.push();
    p.noStroke();
    // 赤い「-N」テキスト
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(20);
    p.textStyle(p.BOLD);
    p.fill(255, 80, 80, alpha);
    p.text(`-${ev.damage}`, pos.x, pos.y + yOffset - CELL_SIZE * 0.3);

    // 敵駒位置に赤フラッシュ
    if (localT < 0.3) {
      p.fill(255, 80, 80, Math.round((1 - localT / 0.3) * 100));
      p.ellipse(pos.x, pos.y, CELL_SIZE * 0.9, CELL_SIZE * 0.9);
    }

    p.pop();
  }

  // 到達イベント: ゴールラインで光る
  for (const ev of step.reachEvents) {
    const goalRow = ev.side === 'player' ? state.config.rules.boardSize - 1 : 0;
    // pre snapshot 内の最終位置を探すのは簡単ではないので、ゴールライン中央付近で表示
    p.push();
    p.noStroke();
    const goalY = ev.side === 'player'
      ? BOARD_TOP_Y(state)
      : BOARD_BOTTOM_Y(state);
    const localT = (tRaw - 0.35) / 0.5;
    const alpha = Math.round((1 - localT) * 200);
    p.fill(255, 215, 0, alpha);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(16);
    p.textStyle(p.BOLD);
    p.text(ev.side === 'player' ? '到達!' : '突破!', p.width / 2, goalY);
    p.pop();
  }
}

function BOARD_TOP_Y(state: GameState): number {
  return 40 + 8;  // 盤面上端少し下
}
function BOARD_BOTTOM_Y(state: GameState): number {
  return 40 + state.config.rules.boardSize * CELL_SIZE - 8;
}
