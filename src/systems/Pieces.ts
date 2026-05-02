import type {
  Piece,
  PieceTypeData,
  PieceTypeId,
  Side,
  GameConfig,
  BoardState,
  MoveStyle,
} from '../types';

export function getPieceType(config: GameConfig, typeId: PieceTypeId): PieceTypeData {
  const t = config.pieceTypes.find((p) => p.id === typeId);
  if (!t) throw new Error(`Unknown piece type: ${typeId}`);
  return t;
}

// player は row+1 方向(北)へ進む / enemy は row-1 方向(南)へ進む
export function forwardDelta(side: Side): number {
  return side === 'player' ? 1 : -1;
}

export function isInBoard(col: number, row: number, size: number): boolean {
  return col >= 0 && col < size && row >= 0 && row < size;
}

export function pieceAt(board: BoardState, col: number, row: number): Piece | null {
  return board.pieces.find((p) => p.col === col && p.row === row && p.hp > 0) ?? null;
}

export interface MoveCandidate {
  col: number;
  row: number;
  // 1 マス進行 / 2 マス進行 / 斜め進行
  kind: 'forward1' | 'forward2' | 'diag';
}

// 駒種類別の動き候補を返す(空の場合は移動不可)
export function getMoveCandidates(piece: Piece, config: GameConfig): MoveCandidate[] {
  const type = getPieceType(config, piece.typeId);
  if (type.moveStyle === 'stationary') return [];
  const dy = forwardDelta(piece.side);
  const candidates: MoveCandidate[] = [];

  const fwd1 = { col: piece.col, row: piece.row + dy, kind: 'forward1' as const };
  const fwd2 = { col: piece.col, row: piece.row + 2 * dy, kind: 'forward2' as const };
  const diagL = { col: piece.col - 1, row: piece.row + dy, kind: 'diag' as const };
  const diagR = { col: piece.col + 1, row: piece.row + dy, kind: 'diag' as const };

  switch (type.moveStyle as MoveStyle) {
    case 'forwardWithDiag':
      candidates.push(fwd1, diagL, diagR);
      break;
    case 'diagonalOnly':
      candidates.push(diagL, diagR);
      break;
    case 'cavalry':
      candidates.push(fwd2, fwd1, diagL, diagR);
      break;
    case 'forwardOnlyHeavy':
      candidates.push(fwd1);
      break;
    case 'stationary':
      break;
  }

  return candidates.filter((c) => isInBoard(c.col, c.row, config.rules.boardSize));
}

// 攻撃範囲内のマス一覧(現在位置を起点に)
export function getAttackRangeCells(piece: Piece, config: GameConfig): Array<{ col: number; row: number }> {
  const type = getPieceType(config, piece.typeId);
  if (type.attackRange === 'none') return [];
  const dy = forwardDelta(piece.side);
  const cells: Array<{ col: number; row: number }> = [];

  switch (type.attackRange) {
    case 'forwardWithDiag':
      cells.push({ col: piece.col, row: piece.row + dy });
      cells.push({ col: piece.col - 1, row: piece.row + dy });
      cells.push({ col: piece.col + 1, row: piece.row + dy });
      break;
    case 'rangedForward':
      cells.push({ col: piece.col, row: piece.row + dy });
      cells.push({ col: piece.col, row: piece.row + 2 * dy });
      break;
  }

  return cells.filter((c) => isInBoard(c.col, c.row, config.rules.boardSize));
}

export function isOpponentSide(a: Side, b: Side): boolean {
  return a !== b;
}

// 駒の「前進度合い」(自陣最奥からの距離)
export function forwardProgress(piece: Piece, side: Side, boardSize: number): number {
  return side === 'player' ? piece.row : (boardSize - 1 - piece.row);
}
