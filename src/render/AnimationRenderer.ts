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

    // 撃破時: 放射状パーティクル(8 個、外側へ拡散しながらフェード)
    if (ev.defenderDestroyed) {
      drawDestroyParticles(p, pos, tRaw, ev.defenderId);
    }
  }

  // 到達イベント: ゴールラインフラッシュ + 大型 ★テキスト + パーティクル
  for (const ev of step.reachEvents) {
    drawReachEffect(p, state, ev, tRaw);
  }
}

// 到達演出: ゴールラインの太い光線 + 大型「★ 到達! ★」 + 拡散パーティクル
function drawReachEffect(
  p: p5,
  state: GameState,
  ev: { pieceId: number; side: 'player' | 'enemy' },
  tRaw: number,
): void {
  if (tRaw < 0.2) return;
  const localT = Math.min(1, (tRaw - 0.2) / 0.8);  // 0..1
  const boardSize = state.config.rules.boardSize;
  const isPlayerReach = ev.side === 'player';
  const goalY = isPlayerReach
    ? BOARD_TOP_Y(state)
    : BOARD_BOTTOM_Y(state);
  // 色: player 到達 = 金色(勝利寄り)、enemy 到達 = 朱色(敗北寄り)
  const color = isPlayerReach ? [255, 215, 80] : [255, 100, 80];

  p.push();

  // 1. ゴールライン太線フラッシュ
  const lineAlpha = Math.round((1 - localT) * 200);
  const lineWeight = 4 + (1 - localT) * 8;
  p.noFill();
  p.stroke(color[0], color[1], color[2], lineAlpha);
  p.strokeWeight(lineWeight);
  const lineY = isPlayerReach
    ? 32  // 上端
    : 32 + boardSize * 80;  // 下端
  p.line(32, lineY, 32 + boardSize * 80, lineY);

  // 2. 大型「★ ... ★」テキスト(拡大しながらフェード)
  const textAlpha = Math.round((1 - localT) * 240);
  const scale = 1 + localT * 0.6;
  p.push();
  p.translate(p.width / 2, goalY + (isPlayerReach ? 16 : -16));
  p.scale(scale);
  p.noStroke();
  // 影
  p.fill(0, 0, 0, Math.round(textAlpha * 0.5));
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(22);
  p.textStyle(p.BOLD);
  const label = isPlayerReach ? '★ 到達! ★' : '★ 突破! ★';
  p.text(label, 1, 1);
  // 本体
  p.fill(color[0], color[1], color[2], textAlpha);
  p.text(label, 0, 0);
  p.pop();

  // 3. 散る星パーティクル(8 個、ライン中央から左右へ)
  const starCount = 8;
  const baseAngle = ev.pieceId * 0.5;
  for (let i = 0; i < starCount; i++) {
    const angle = baseAngle + (i / starCount) * Math.PI * 2;
    const distance = localT * 60;
    const px = p.width / 2 + Math.cos(angle) * distance;
    const py = goalY + Math.sin(angle) * distance;
    const fadeAlpha = Math.round((1 - localT) * 200);
    p.noStroke();
    p.fill(color[0], color[1], color[2], fadeAlpha);
    const sz = 6 - localT * 3;
    p.ellipse(px, py, sz, sz);
  }

  p.pop();
}

// 撃破時の放射状パーティクル(駒位置から 8 方向へ拡散)
//   defenderId を seed にして角度を決定論的に変化(同じ駒は毎回同じ模様)
function drawDestroyParticles(
  p: p5,
  pos: { x: number; y: number },
  tRaw: number,
  defenderId: number,
): void {
  if (tRaw < 0.25) return;
  const localT = Math.min(1, (tRaw - 0.25) / 0.6);  // 0..1
  const numParticles = 8;
  // defenderId で初期角度オフセット(駒ごとに違うパターン)
  const baseAngle = (defenderId * 0.7) % (Math.PI * 2);

  p.push();
  p.noStroke();
  for (let i = 0; i < numParticles; i++) {
    const angle = baseAngle + (i / numParticles) * Math.PI * 2;
    const distance = localT * 26;
    const px = pos.x + Math.cos(angle) * distance;
    const py = pos.y + Math.sin(angle) * distance;
    const fadeAlpha = Math.round((1 - localT) * 240);
    // 火花色: 黄→橙
    const colorPhase = localT;
    const r = 255;
    const g = Math.round(220 - colorPhase * 120);
    const b = Math.round(80 - colorPhase * 60);
    p.fill(r, g, b, fadeAlpha);
    const size = 4 - localT * 2;
    p.ellipse(px, py, size, size);
  }
  p.pop();
}

function BOARD_TOP_Y(state: GameState): number {
  return 40 + 8;  // 盤面上端少し下
}
function BOARD_BOTTOM_Y(state: GameState): number {
  return 40 + state.config.rules.boardSize * CELL_SIZE - 8;
}
