import type {
  GameState,
  Piece,
  AnimationStep,
  GameConfig,
  BoardState,
  Side,
} from '../types';
import {
  forwardDelta,
  forwardProgress,
  getMoveCandidates,
  getPieceType,
  isInBoard,
  pieceAt,
} from './Pieces';
import { resolveMelee, resolveRanged } from './Combat';
import { reachedGoal, removePieceById } from './Board';

interface ChosenAction {
  kind: 'rangedAttack' | 'meleeAttack' | 'move' | 'stay';
  targetCol?: number;
  targetRow?: number;
  targetPieceId?: number;
}

// 弓兵の遠距離攻撃: 前方 1 マス → 前方 2 マスを順に走査、最初に出会った敵が対象。味方で遮られたら不発。
function findRangedTarget(piece: Piece, board: BoardState, config: GameConfig): Piece | null {
  const type = getPieceType(config, piece.typeId);
  if (type.attackRange !== 'rangedForward') return null;
  const dy = forwardDelta(piece.side);
  for (let dist = 1; dist <= 2; dist++) {
    const col = piece.col;
    const row = piece.row + dist * dy;
    if (!isInBoard(col, row, config.rules.boardSize)) break;
    const occupant = pieceAt(board, col, row);
    if (!occupant) continue;
    if (occupant.side === piece.side) return null;  // 味方で遮られる
    return occupant;
  }
  return null;
}

// 駒の行動を決定
function chooseAction(piece: Piece, board: BoardState, config: GameConfig): ChosenAction {
  // 動かない駒(障害物)は何もしない
  const type = getPieceType(config, piece.typeId);
  if (type.moveStyle === 'stationary') return { kind: 'stay' };

  // 遠距離優先(弓兵)
  const ranged = findRangedTarget(piece, board, config);
  if (ranged) {
    return { kind: 'rangedAttack', targetPieceId: ranged.id, targetCol: ranged.col, targetRow: ranged.row };
  }

  const candidates = getMoveCandidates(piece, config);
  // 味方で塞がれたマスは除外。敵がいるマスは move-attack の候補として残す
  const filtered = candidates.filter((c) => {
    const occ = pieceAt(board, c.col, c.row);
    return !occ || occ.side !== piece.side;
  });

  if (filtered.length === 0) return { kind: 'stay' };

  // スコアリング:
  //   攻撃で倒せる: 100 + 前進度
  //   攻撃するが倒せない: 50 + 前進度
  //   ただ進む: 10 + 前進度
  // 同点はランダム
  const attackerType = getPieceType(config, piece.typeId);
  const scored = filtered.map((c) => {
    const occ = pieceAt(board, c.col, c.row);
    const dy = forwardDelta(piece.side);
    const fwdGain = (c.row - piece.row) * dy;  // 前進したマス数
    const progressScore = forwardProgress({ ...piece, col: c.col, row: c.row }, piece.side, config.rules.boardSize);
    if (occ && occ.side !== piece.side) {
      const wouldKill = occ.hp <= attackerType.attack;
      return {
        cand: c,
        occ,
        score: (wouldKill ? 100 : 50) + progressScore + fwdGain * 0.1,
      };
    }
    return { cand: c, occ: null, score: 10 + progressScore + fwdGain * 0.1 };
  });

  // 最大スコア。同点は決定論的破り(候補配列の先頭固定 = moveStyle 列挙順 + 元 candidates 順)。
  // これにより「ホバー予測 = 実進行」が一致する。
  const maxScore = Math.max(...scored.map((s) => s.score));
  const top = scored.filter((s) => s.score === maxScore);
  const chosen = top[0];

  if (chosen.occ) {
    return {
      kind: 'meleeAttack',
      targetCol: chosen.cand.col,
      targetRow: chosen.cand.row,
      targetPieceId: chosen.occ.id,
    };
  }
  return { kind: 'move', targetCol: chosen.cand.col, targetRow: chosen.cand.row };
}

// 1 ターン進行: 全駒を順に処理し、AnimationStep を生成
export function runOneTurn(state: GameState, turnIndex: number): AnimationStep {
  const step: AnimationStep = {
    turnIndex,
    pieceMoves: [],
    combatEvents: [],
    reachEvents: [],
    pieceSnapshot: [],
    playerReachAfter: 0,
    enemyReachAfter: 0,
  };

  // 処理順: 前進度の高い順(進んでいる駒から)。両陣営混合。
  const pieces = [...state.board.pieces].sort((a, b) => {
    return forwardProgress(b, b.side, state.config.rules.boardSize) -
      forwardProgress(a, a.side, state.config.rules.boardSize);
  });

  for (const piece of pieces) {
    if (piece.hp <= 0) continue;
    if (state.board.pieces.indexOf(piece) < 0) continue;  // 既に消えた

    const action = chooseAction(piece, state.board, state.config);

    if (action.kind === 'stay') continue;

    if (action.kind === 'rangedAttack' && action.targetPieceId !== undefined) {
      const target = state.board.pieces.find((p) => p.id === action.targetPieceId);
      if (!target) continue;
      const result = resolveRanged(piece, target, state.config);
      step.combatEvents.push({
        attackerId: piece.id,
        defenderId: target.id,
        damage: result.defenderDamageTaken,
        defenderHpAfter: result.defenderHpAfter,
        defenderDestroyed: result.defenderDestroyed,
        atCol: target.col,
        atRow: target.row,
      });
      if (result.defenderDestroyed) {
        removePieceById(state.board, target.id);
      }
      continue;
    }

    if (action.kind === 'move' && action.targetCol !== undefined && action.targetRow !== undefined) {
      step.pieceMoves.push({
        pieceId: piece.id,
        fromCol: piece.col,
        fromRow: piece.row,
        toCol: action.targetCol,
        toRow: action.targetRow,
        typeId: piece.typeId,
        side: piece.side,
      });
      piece.col = action.targetCol;
      piece.row = action.targetRow;
      continue;
    }

    if (action.kind === 'meleeAttack' && action.targetPieceId !== undefined &&
      action.targetCol !== undefined && action.targetRow !== undefined) {
      const target = state.board.pieces.find((p) => p.id === action.targetPieceId);
      if (!target) continue;
      const fromCol = piece.col;
      const fromRow = piece.row;
      const result = resolveMelee(piece, target, state.config);
      step.combatEvents.push({
        attackerId: piece.id,
        defenderId: target.id,
        damage: result.defenderDamageTaken,
        defenderHpAfter: result.defenderHpAfter,
        defenderDestroyed: result.defenderDestroyed,
        atCol: target.col,
        atRow: target.row,
      });
      // defender 死亡 → 退場、attacker 移動
      if (result.defenderDestroyed && !result.attackerDestroyed) {
        removePieceById(state.board, target.id);
        step.pieceMoves.push({
          pieceId: piece.id,
          fromCol,
          fromRow,
          toCol: action.targetCol,
          toRow: action.targetRow,
          typeId: piece.typeId,
          side: piece.side,
        });
        piece.col = action.targetCol;
        piece.row = action.targetRow;
      } else if (result.attackerDestroyed && !result.defenderDestroyed) {
        // attacker のみ死亡 → 退場、defender はそのまま
        removePieceById(state.board, piece.id);
      } else if (result.attackerDestroyed && result.defenderDestroyed) {
        // 両者死亡
        removePieceById(state.board, piece.id);
        removePieceById(state.board, target.id);
      }
      // 両者生存: ぶつかって両者元位置(attacker は移動しない)
      continue;
    }
  }

  // 到達判定: ゴール行に到達した駒は退場 + reachCount 加算
  for (const piece of [...state.board.pieces]) {
    if (piece.hp <= 0) continue;
    if (reachedGoal(piece, state.config)) {
      if (piece.side === 'player') {
        state.player.reachCount++;
      } else {
        state.enemy.reachCount++;
      }
      step.reachEvents.push({ pieceId: piece.id, side: piece.side });
      removePieceById(state.board, piece.id);
    }
  }

  // スナップショット保存(deep copy)
  step.pieceSnapshot = state.board.pieces.map((p) => ({ ...p }));
  step.playerReachAfter = state.player.reachCount;
  step.enemyReachAfter = state.enemy.reachCount;

  return step;
}

// 3 ターン分の進行を実行し、AnimationStep 配列を返す
export function runAdvancePhase(state: GameState): AnimationStep[] {
  const steps: AnimationStep[] = [];
  const turnsTotal = state.config.rules.advanceTurnsPerCycle;
  for (let t = 0; t < turnsTotal; t++) {
    const step = runOneTurn(state, t);
    steps.push(step);
    // 勝敗確定でも残りターンは消化(駒が空でもアニメ短く回る)
    if (state.player.reachCount >= state.config.rules.reachToWin ||
      state.enemy.reachCount >= state.config.rules.reachToWin) {
      break;
    }
  }
  return steps;
}
