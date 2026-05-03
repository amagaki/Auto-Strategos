import type { GameState, Piece, PieceTypeData, AiStrategy, AiDifficulty, PieceTypeId } from '../types';
import { addPiece, emptyPlacementCellsForSide } from './Board';

// 難易度別の購入数(設定画面の AiDifficulty に対応)
function purchasePerCycleByDifficulty(difficulty: AiDifficulty, fallback: number): number {
  switch (difficulty) {
    case 'easy': return 1;
    case 'normal': return 2;
    case 'hard': return 3;
  }
  return fallback;
}

// 戦略別の駒重み(攻め/守り/バランス)
//   aggressive: 機動 + 火力(騎兵・斥候・暗殺者・兵士)を厚く
//   defensive: 耐久 + 遠距離(重装兵・弓兵・槍兵)を厚く
//   balanced: 均等
function pieceWeightByStrategy(typeId: string, strategy: AiStrategy): number {
  if (strategy === 'aggressive') {
    switch (typeId) {
      case 'cavalry': return 4;
      case 'scout': return 3;
      case 'assassin': return 4;
      case 'soldier': return 2;
      case 'archer': return 1;
      case 'spear': return 1;
      case 'heavy': return 1;
    }
  } else if (strategy === 'defensive') {
    switch (typeId) {
      case 'heavy': return 4;
      case 'archer': return 3;
      case 'spear': return 3;
      case 'soldier': return 2;
      case 'cavalry': return 1;
      case 'scout': return 1;
      case 'assassin': return 1;
    }
  }
  return 1;  // balanced or unknown → uniform
}

// 重み付きランダム選定
function pickWeighted<T>(items: T[], weight: (item: T) => number): T {
  const total = items.reduce((acc, item) => acc + weight(item), 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)];
  let r = Math.random() * total;
  for (const item of items) {
    r -= weight(item);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// 戦略別の配置位置選定
//   aggressive: 前列(中央寄り)を優先
//   defensive: 最後尾を優先(ゴール近く)
//   balanced: 均等ランダム
function pickPlacementByStrategy(
  cells: Array<{ col: number; row: number }>,
  strategy: AiStrategy,
  boardSize: number,
): { col: number; row: number } {
  if (cells.length === 0) throw new Error('no cells');
  if (strategy === 'aggressive') {
    // enemy にとっての「前」= row が小さい方(player ゴール方向)
    // できるだけ row 小、col は中央寄り
    return cells.slice().sort((a, b) => {
      const rowDiff = a.row - b.row;
      if (rowDiff !== 0) return rowDiff;
      return Math.abs(a.col - 3.5) - Math.abs(b.col - 3.5);
    })[0];
  } else if (strategy === 'defensive') {
    // enemy 最後尾 = row が大きい方(自陣ゴール側)
    return cells.slice().sort((a, b) => {
      const rowDiff = b.row - a.row;
      if (rowDiff !== 0) return rowDiff;
      return Math.abs(a.col - 3.5) - Math.abs(b.col - 3.5);
    })[0];
  }
  // balanced: 均等ランダム
  return cells[Math.floor(Math.random() * cells.length)];
}

// AI 推奨 loadout: 戦略 + 難易度 の組合せで適切な駒種を返す
//   設定画面で「デフォルト」として表示される値
//   ユーザーが手動チェックを変更すれば、その内容が aiLoadoutPreset に保存される
export function aiSuggestedLoadout(strategy: AiStrategy, difficulty: AiDifficulty): PieceTypeId[] {
  if (difficulty === 'easy') {
    if (strategy === 'aggressive') return ['soldier', 'scout', 'cavalry', 'spear'];
    if (strategy === 'defensive') return ['soldier', 'spear', 'heavy', 'archer'];
    return ['soldier', 'scout', 'spear', 'heavy'];
  }
  if (difficulty === 'normal') {
    if (strategy === 'aggressive') return ['soldier', 'scout', 'cavalry', 'assassin', 'thrower', 'spear', 'heavy'];
    if (strategy === 'defensive') return ['soldier', 'spear', 'heavy', 'archer', 'commander', 'cavalry'];
    return ['soldier', 'scout', 'cavalry', 'archer', 'heavy', 'spear', 'assassin', 'thrower', 'commander'];
  }
  // hard
  if (strategy === 'aggressive') return ['soldier', 'scout', 'cavalry', 'assassin', 'thrower', 'archer', 'spear', 'heavy'];
  if (strategy === 'defensive') return ['heavy', 'archer', 'spear', 'commander', 'thrower', 'soldier', 'cavalry'];
  return ['soldier', 'scout', 'cavalry', 'archer', 'heavy', 'spear', 'assassin', 'thrower', 'commander'];
}

// 旧 API 互換(難易度のみベース、戦略は balanced と見なす)
function aiDefaultLoadout(difficulty: AiDifficulty): PieceTypeId[] {
  return aiSuggestedLoadout('balanced', difficulty);
}

// AI のサイクル開始時アクション: 駒を購入して自陣に配置
export function aiTakeTurn(state: GameState): void {
  const strategy = state.settings.aiStrategy;
  const tries = purchasePerCycleByDifficulty(
    state.settings.aiDifficulty,
    state.config.ai.purchasePerCycle,
  );
  // AI 専用 loadout を適用(空なら難易度デフォルト、それも空なら全駒)
  let aiLoadout = state.settings.aiLoadoutPreset;
  if (aiLoadout.length === 0) {
    aiLoadout = aiDefaultLoadout(state.settings.aiDifficulty);
  }
  const presetSet = aiLoadout.length > 0 ? new Set(aiLoadout) : null;

  for (let i = 0; i < tries; i++) {
    const affordable = state.config.pieceTypes.filter((t) => {
      if (t.id === 'obstacle') return false;
      if (state.enemy.gold < t.cost) return false;
      if (presetSet && !presetSet.has(t.id)) return false;
      return true;
    });
    if (affordable.length === 0) break;

    const choice = pickWeighted(affordable, (t) => pieceWeightByStrategy(t.id, strategy));
    const cells = emptyPlacementCellsForSide(state.board, 'enemy', state.config);
    if (cells.length === 0) break;

    const cell = pickPlacementByStrategy(cells, strategy, state.config.rules.boardSize);
    const piece: Piece = {
      id: state.nextPieceId++,
      typeId: choice.id,
      side: 'enemy',
      hp: choice.hp,
      col: cell.col,
      row: cell.row,
    };
    addPiece(state.board, piece);
    state.enemy.gold -= choice.cost;
  }
}

// 旧 export 互換用(もう使われない可能性あるが、安全のため残す)
export function pickAiPiece(affordable: PieceTypeData[]): PieceTypeData {
  return affordable[Math.floor(Math.random() * affordable.length)];
}
