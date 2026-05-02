import type p5 from 'p5';
import type { Piece, PieceTypeData, GameConfig, GameState, BoardState } from '../types';
import { getPieceType, getMoveCandidates, pieceAt, isInBoard, forwardDelta } from '../systems/Pieces';

export const BOARD_PADDING = 32;
export const CELL_SIZE = 80;
export const CANVAS_WIDTH = BOARD_PADDING * 2 + 8 * CELL_SIZE;
export const CANVAS_HEIGHT = BOARD_PADDING * 2 + 8 * CELL_SIZE;

export function colToX(col: number): number {
  return BOARD_PADDING + col * CELL_SIZE;
}

// 自陣最奥(row=0)を画面下、敵陣最奥(row=7)を画面上に配置
export function rowToY(row: number, boardSize = 8): number {
  return BOARD_PADDING + (boardSize - 1 - row) * CELL_SIZE;
}

export function cellCenter(col: number, row: number, boardSize = 8): { x: number; y: number } {
  return {
    x: colToX(col) + CELL_SIZE / 2,
    y: rowToY(row, boardSize) + CELL_SIZE / 2,
  };
}

// 画面 (mx, my) を盤面のセル (col, row) に変換。盤面外なら null
export function pixelToCell(mx: number, my: number, boardSize = 8): { col: number; row: number } | null {
  const col = Math.floor((mx - BOARD_PADDING) / CELL_SIZE);
  const rowFromTop = Math.floor((my - BOARD_PADDING) / CELL_SIZE);
  const row = boardSize - 1 - rowFromTop;
  if (col < 0 || col >= boardSize || row < 0 || row >= boardSize) return null;
  return { col, row };
}

// 盤面背景・グリッド・ゴールライン・配置ゾーン
export function drawBoardBackground(p: p5, config: GameConfig): void {
  const size = config.rules.boardSize;

  p.push();
  // キャンバス全体を暗色で塗る
  p.noStroke();
  p.fill(20, 18, 28);
  p.rect(0, 0, p.width, p.height);

  // 各セル
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const x = colToX(col);
      const y = rowToY(row, size);
      const lightCell = (col + row) % 2 === 0;

      // 配置ゾーンの色味
      let baseR = lightCell ? 70 : 50;
      let baseG = lightCell ? 65 : 45;
      let baseB = lightCell ? 55 : 38;

      if (row <= config.rules.placementMaxRow) {
        // 自陣ゾーン: 青寄り
        baseR = lightCell ? 50 : 38;
        baseG = lightCell ? 70 : 55;
        baseB = lightCell ? 100 : 80;
      } else if (row >= size - 1 - config.rules.placementMaxRow) {
        // 敵陣ゾーン: 赤寄り
        baseR = lightCell ? 100 : 80;
        baseG = lightCell ? 60 : 45;
        baseB = lightCell ? 60 : 45;
      }

      p.fill(baseR, baseG, baseB);
      p.noStroke();
      p.rect(x, y, CELL_SIZE, CELL_SIZE);

      // セル境界
      p.stroke(30, 25, 20, 180);
      p.strokeWeight(1);
      p.noFill();
      p.rect(x, y, CELL_SIZE, CELL_SIZE);
    }
  }

  // ゴールライン: row=0(プレイヤーが守る)/ row=7(プレイヤーが目指す)
  p.strokeWeight(4);
  // 自陣最奥(下端)
  p.stroke(120, 180, 240);
  const yBottom = rowToY(0, size) + CELL_SIZE;
  p.line(BOARD_PADDING, yBottom, BOARD_PADDING + size * CELL_SIZE, yBottom);
  // 敵陣最奥(上端)
  p.stroke(240, 120, 120);
  const yTop = rowToY(size - 1, size);
  p.line(BOARD_PADDING, yTop, BOARD_PADDING + size * CELL_SIZE, yTop);

  // ゾーンラベル
  p.noStroke();
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(11);
  p.fill(180, 200, 240, 180);
  p.text('自陣(配置可)', p.width / 2, yBottom + 14);
  p.fill(240, 180, 180, 180);
  p.text('敵陣最奥', p.width / 2, yTop - 14);

  p.pop();
}

// 駒 1 体を描画 (alpha=1 が通常、0..1 でフェード)
// レイアウト(Onitama 流): forward 方向に動きグリッド、背中側に HP/ATK 数値
export function drawPiece(
  p: p5,
  piece: Piece,
  config: GameConfig,
  pos: { x: number; y: number },
  alpha = 1,
  highlighted = false,
): void {
  const type = getPieceType(config, piece.typeId);
  const isObstacle = type.moveStyle === 'stationary';

  p.push();
  const sideColor = piece.side === 'player' ? [120, 180, 240] : [240, 120, 120];
  const aByte = Math.round(alpha * 255);

  const PIECE_R = 22;  // 駒円半径(直径 44、CELL_SIZE 80 に対応)

  // 影
  p.noStroke();
  p.fill(0, 0, 0, Math.round(alpha * 90));
  if (isObstacle) {
    p.rect(pos.x - PIECE_R + 1, pos.y - PIECE_R + 4, PIECE_R * 2, PIECE_R * 2, 4);
  } else {
    p.ellipse(pos.x + 1, pos.y + 4, PIECE_R * 2, PIECE_R * 2);
  }

  // 駒本体
  const cFill = p.color(type.color);
  cFill.setAlpha(aByte);
  p.fill(cFill);
  p.stroke(sideColor[0], sideColor[1], sideColor[2], aByte);
  p.strokeWeight(highlighted ? 4 : 3);
  if (isObstacle) {
    p.rect(pos.x - PIECE_R, pos.y - PIECE_R, PIECE_R * 2, PIECE_R * 2, 4);
  } else {
    p.ellipse(pos.x, pos.y, PIECE_R * 2, PIECE_R * 2);
  }

  // シンボル(中央)
  p.noStroke();
  p.fill(30, 25, 20, aByte);
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(19);
  p.textStyle(p.BOLD);
  p.text(type.symbol, pos.x, pos.y);

  // 動きグリッド(障害物以外)
  if (!isObstacle) {
    drawMoveGrid(p, piece, type, pos, alpha);
  }

  // HP/ATK 数値(全駒、障害物は HP のみ)
  drawPieceStats(p, piece, type, pos, alpha);

  p.pop();
}

// 動きグリッド(Onitama 流): forward 方向に 1〜2 段の点群、駒の動ける先を表現
function drawMoveGrid(
  p: p5,
  piece: Piece,
  type: PieceTypeData,
  pos: { x: number; y: number },
  alpha: number,
): void {
  const aByte = Math.round(alpha * 255);
  const sideColor = piece.side === 'player' ? [200, 230, 255] : [255, 200, 200];
  const inactiveColor: number[] = [100, 90, 80];
  const dir = piece.side === 'player' ? -1 : 1;

  const cellSize = 9;
  const xCols = [pos.x - cellSize, pos.x, pos.x + cellSize];
  const row1Y = pos.y + dir * 30;          // 1 マス先
  const row2Y = pos.y + dir * (30 + cellSize); // 2 マス先(騎兵のみ)

  let row1: boolean[];
  let row2: boolean[] | null = null;

  switch (type.moveStyle) {
    case 'forwardWithDiag':
      row1 = [true, true, true];
      break;
    case 'diagonalOnly':
      row1 = [true, false, true];
      break;
    case 'cavalry':
      row1 = [true, true, true];
      row2 = [false, true, false];
      break;
    case 'forwardOnlyHeavy':
      row1 = [false, true, false];
      break;
    case 'assassin':
      // 斜め前 1 / 斜め前 2(中央列は不可)
      row1 = [true, false, true];
      row2 = [true, false, true];
      break;
    default:
      return;
  }

  drawGridRow(p, xCols, row1Y, row1, sideColor, inactiveColor, aByte, cellSize);
  if (row2) {
    drawGridRow(p, xCols, row2Y, row2, sideColor, inactiveColor, aByte, cellSize);
  }

  // 弓兵の遠距離攻撃マーク(グリッドの右脇に小さい弓記号 + "2")
  if (type.attackRange === 'rangedForward') {
    drawSmallBow(p, pos.x + cellSize * 2.4, row1Y, dir, sideColor, aByte);
  }
  // 槍兵の横払いマーク(↔ 記号)
  if (type.attackRange === 'spearReach') {
    drawSpearReachMark(p, pos.x + cellSize * 2.4, row1Y, sideColor, aByte);
  }
}

// 槍兵の横払い表示(↔ 風)
function drawSpearReachMark(
  p: p5,
  x: number,
  y: number,
  color: number[],
  alpha: number,
): void {
  p.push();
  p.noStroke();
  p.fill(color[0], color[1], color[2], alpha);
  p.textSize(11);
  p.textStyle(p.BOLD);
  p.textAlign(p.CENTER, p.CENTER);
  p.text('↔', x, y);
  p.pop();
}

function drawGridRow(
  p: p5,
  xCols: number[],
  y: number,
  row: boolean[],
  activeColor: number[],
  inactiveColor: number[],
  alpha: number,
  cellSize: number,
): void {
  for (let i = 0; i < 3; i++) {
    const x = xCols[i];
    if (row[i]) {
      // 動ける先: 塗りつぶし円
      p.noStroke();
      p.fill(activeColor[0], activeColor[1], activeColor[2], alpha);
      p.ellipse(x, y, cellSize - 2, cellSize - 2);
    } else {
      // 動けない: 空の小円
      p.noFill();
      p.stroke(inactiveColor[0], inactiveColor[1], inactiveColor[2], Math.round(alpha * 0.6));
      p.strokeWeight(1);
      p.ellipse(x, y, cellSize - 4, cellSize - 4);
    }
  }
}

// HP / ATK 数値表示(駒の背中側、forward と反対)
function drawPieceStats(
  p: p5,
  piece: Piece,
  type: PieceTypeData,
  pos: { x: number; y: number },
  alpha: number,
): void {
  const aByte = Math.round(alpha * 255);
  const dir = piece.side === 'player' ? -1 : 1;
  const statsY = pos.y + (-dir) * 32;  // forward の反対側

  p.noStroke();
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(12);
  p.textStyle(p.BOLD);

  // HP の色: 残量に応じて変化
  const hpRatio = type.hp > 0 ? piece.hp / type.hp : 1;
  let hpColor: number[];
  if (hpRatio > 0.66) hpColor = [255, 130, 140];
  else if (hpRatio > 0.33) hpColor = [255, 180, 80];
  else hpColor = [255, 80, 80];

  if (type.attack > 0) {
    p.fill(hpColor[0], hpColor[1], hpColor[2], aByte);
    p.text(`♥${piece.hp}`, pos.x - 14, statsY);
    p.fill(230, 215, 175, aByte);
    p.text(`⚔${type.attack}`, pos.x + 14, statsY);
  } else {
    p.fill(hpColor[0], hpColor[1], hpColor[2], aByte);
    p.text(`♥${piece.hp}`, pos.x, statsY);
  }
}

// 弓兵の遠距離マーク(弓型 + 射程数値)
function drawSmallBow(
  p: p5,
  x: number,
  y: number,
  dir: number,
  color: number[],
  alpha: number,
): void {
  p.push();
  p.noFill();
  p.stroke(color[0], color[1], color[2], alpha);
  p.strokeWeight(1.5);
  // 弧(少し大きく)
  if (dir < 0) {
    p.arc(x, y, 12, 12, Math.PI * 0.7, Math.PI * 1.3);
  } else {
    p.arc(x, y, 12, 12, -Math.PI * 0.3, Math.PI * 0.3);
  }
  // 矢
  p.strokeWeight(2);
  p.line(x - 4, y, x + 4, y);
  // 射程数値「2」を弓の脇に
  p.noStroke();
  p.fill(color[0], color[1], color[2], alpha);
  p.textSize(9);
  p.textStyle(p.BOLD);
  p.textAlign(p.LEFT, p.CENTER);
  p.text('2', x + 7, y);
  p.pop();
}

// 駒の 3 ターン予測経路を描画
import type { PredictPath } from '../systems/HoverPredict';
import type { Side } from '../types';

export function drawPredictPath(p: p5, path: PredictPath, side: Side, boardSize = 8): void {
  if (path.positions.length < 2) return;

  const baseColor = side === 'player' ? [120, 180, 240] : [240, 120, 120];

  p.push();
  for (let i = 0; i < path.positions.length - 1; i++) {
    const from = path.positions[i];
    const to = path.positions[i + 1];

    if (!to.alive) {
      // 最後の駒位置(直前)で破壊または到達のマーク
      const fromCenter = cellCenter(from.col, from.row, boardSize);
      const sym = to.reached ? '★' : 'X';
      const symColor = to.reached ? [255, 215, 0] : [255, 80, 80];
      p.noStroke();
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(20);
      p.textStyle(p.BOLD);
      p.fill(symColor[0], symColor[1], symColor[2], 255);
      p.text(sym, fromCenter.x + CELL_SIZE * 0.28, fromCenter.y - CELL_SIZE * 0.28);
      break;
    }

    const fromCenter = cellCenter(from.col, from.row, boardSize);
    const toCenter = cellCenter(to.col, to.row, boardSize);

    if (from.col === to.col && from.row === to.row) {
      // 静止: 円で示す
      p.noFill();
      p.stroke(baseColor[0], baseColor[1], baseColor[2], 200);
      p.strokeWeight(2);
      p.ellipse(toCenter.x + CELL_SIZE * 0.28, toCenter.y - CELL_SIZE * 0.28, 14, 14);
      p.noStroke();
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(10);
      p.textStyle(p.BOLD);
      p.fill(baseColor[0], baseColor[1], baseColor[2], 200);
      p.text(`T${i + 1}`, toCenter.x + CELL_SIZE * 0.28, toCenter.y - CELL_SIZE * 0.28);
    } else {
      // 矢印
      drawArrow(p, fromCenter.x, fromCenter.y, toCenter.x, toCenter.y, baseColor, 200);

      // ターン番号
      const midX = (fromCenter.x + toCenter.x) / 2;
      const midY = (fromCenter.y + toCenter.y) / 2;
      p.noStroke();
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(11);
      p.textStyle(p.BOLD);
      p.fill(20, 18, 28, 200);
      p.ellipse(midX, midY, 18, 18);
      p.fill(baseColor[0], baseColor[1], baseColor[2], 255);
      p.text(`T${i + 1}`, midX, midY);
    }
  }
  p.pop();
}

function drawArrow(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number[],
  alpha: number,
): void {
  // 線(端から少し短くする)
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const ux = dx / len;
  const uy = dy / len;
  const shrink = CELL_SIZE * 0.30;
  const sx = x1 + ux * shrink;
  const sy = y1 + uy * shrink;
  const ex = x2 - ux * shrink;
  const ey = y2 - uy * shrink;

  p.stroke(color[0], color[1], color[2], alpha);
  p.strokeWeight(3);
  p.line(sx, sy, ex, ey);

  // 矢印の先
  const ang = Math.atan2(dy, dx);
  const head = 10;
  p.noStroke();
  p.fill(color[0], color[1], color[2], alpha);
  p.triangle(
    ex,
    ey,
    ex - head * Math.cos(ang - Math.PI / 6),
    ey - head * Math.sin(ang - Math.PI / 6),
    ex - head * Math.cos(ang + Math.PI / 6),
    ey - head * Math.sin(ang + Math.PI / 6),
  );
}

// ホバー駒の「動ける範囲」を盤面にハイライト(chess.com 流)
//   移動可能セル: 陣営色透明
//   攻撃可能(敵駒/敵壁): 赤透明
//   弓兵の遠距離対象: 紫色枠で別表示
export function drawMoveHighlights(
  p: p5,
  piece: Piece,
  board: BoardState,
  config: GameConfig,
): void {
  const type = getPieceType(config, piece.typeId);
  if (type.moveStyle === 'stationary') return;
  const boardSize = config.rules.boardSize;

  const sideColor = piece.side === 'player' ? [120, 180, 240] : [240, 120, 120];
  const candidates = getMoveCandidates(piece, config);

  p.push();
  p.noStroke();
  for (const c of candidates) {
    const occ = pieceAt(board, c.col, c.row);
    if (occ && occ.side === piece.side) continue;  // 同陣営に塞がれている
    // passThrough: 経路途中マスが占有されていれば候補から除外
    if (c.passThrough) {
      const through = pieceAt(board, c.passThrough.col, c.passThrough.row);
      if (through) continue;
    }
    const isAttack = !!occ;
    const x = colToX(c.col);
    const y = rowToY(c.row, boardSize);
    if (isAttack) {
      p.fill(255, 80, 80, 100);
    } else {
      p.fill(sideColor[0], sideColor[1], sideColor[2], 80);
    }
    p.rect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8, 8);
  }

  // 弓兵の遠距離攻撃ターゲットも表示
  if (type.attackRange === 'rangedForward') {
    const dy = forwardDelta(piece.side);
    for (let dist = 1; dist <= 2; dist++) {
      const col = piece.col;
      const row = piece.row + dist * dy;
      if (!isInBoard(col, row, boardSize)) break;
      const occ = pieceAt(board, col, row);
      if (!occ) continue;
      if (occ.side === piece.side) break;  // 味方で遮られる
      // 遠距離ターゲット: 紫色枠
      const x = colToX(col);
      const y = rowToY(row, boardSize);
      p.noFill();
      p.stroke(200, 120, 220, 220);
      p.strokeWeight(3);
      p.rect(x + 8, y + 8, CELL_SIZE - 16, CELL_SIZE - 16, 6);
      p.noStroke();
      break;
    }
  }

  // 槍兵の横払い対象も表示
  if (type.attackRange === 'spearReach') {
    for (const dx of [-1, 1]) {
      const col = piece.col + dx;
      const row = piece.row;
      if (!isInBoard(col, row, boardSize)) continue;
      const occ = pieceAt(board, col, row);
      if (!occ) continue;
      if (occ.side === piece.side) continue;
      // 横払いターゲット: 緑枠(近接攻撃可能を強調)
      const x = colToX(col);
      const y = rowToY(row, boardSize);
      p.noFill();
      p.stroke(120, 220, 140, 220);
      p.strokeWeight(3);
      p.rect(x + 8, y + 8, CELL_SIZE - 16, CELL_SIZE - 16, 6);
      p.noStroke();
    }
  }
  p.pop();
}

// 配置プレビュー(shop で駒選択中、自陣セルにホバー時)
export function drawPlacementPreview(p: p5, col: number, row: number): void {
  const x = colToX(col);
  const y = rowToY(row);
  p.push();
  p.noFill();
  p.stroke(255, 215, 0, 220);
  p.strokeWeight(3);
  p.rect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8, 6);
  p.pop();
}

// 静的状態(プレイヤーターン中)の盤面を駒つきで描画
export function drawBoardStatic(p: p5, state: GameState): void {
  drawBoardBackground(p, state.config);
  for (const piece of state.board.pieces) {
    if (piece.hp <= 0) continue;
    const pos = cellCenter(piece.col, piece.row, state.config.rules.boardSize);
    const highlighted = state.hoveredPieceId === piece.id;
    drawPiece(p, piece, state.config, pos, 1, highlighted);
  }
}
