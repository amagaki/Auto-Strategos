import type { BoardState, Piece, Side, GameConfig } from '../types';
import { pieceAt, getPieceType } from './Pieces';

export function createBoard(size: number): BoardState {
  return { pieces: [], size };
}

export function addPiece(board: BoardState, piece: Piece): void {
  board.pieces.push(piece);
}

export function removePieceById(board: BoardState, pieceId: number): void {
  const idx = board.pieces.findIndex((p) => p.id === pieceId);
  if (idx >= 0) board.pieces.splice(idx, 1);
}

export function isCellEmpty(board: BoardState, col: number, row: number): boolean {
  return pieceAt(board, col, row) === null;
}

// プレイヤーが配置できる行: 0..placementMaxRow
export function isPlayerPlacementCell(row: number, config: GameConfig): boolean {
  return row >= 0 && row <= config.rules.placementMaxRow;
}

// 敵(AI)が配置できる行: (boardSize-1-placementMaxRow)..boardSize-1
export function isEnemyPlacementCell(row: number, config: GameConfig): boolean {
  const minRow = config.rules.boardSize - 1 - config.rules.placementMaxRow;
  return row >= minRow && row < config.rules.boardSize;
}

export function emptyPlacementCellsForSide(
  board: BoardState,
  side: Side,
  config: GameConfig,
): Array<{ col: number; row: number }> {
  const cells: Array<{ col: number; row: number }> = [];
  for (let row = 0; row < config.rules.boardSize; row++) {
    const inZone = side === 'player'
      ? isPlayerPlacementCell(row, config)
      : isEnemyPlacementCell(row, config);
    if (!inZone) continue;
    for (let col = 0; col < config.rules.boardSize; col++) {
      if (isCellEmpty(board, col, row)) {
        cells.push({ col, row });
      }
    }
  }
  return cells;
}

// 駒到達: player は row=boardSize-1、enemy は row=0、動かない駒(障害物)は判定外
export function reachedGoal(piece: Piece, config: GameConfig): boolean {
  const type = getPieceType(config, piece.typeId);
  if (type.moveStyle === 'stationary') return false;
  if (piece.side === 'player') return piece.row === config.rules.boardSize - 1;
  return piece.row === 0;
}
