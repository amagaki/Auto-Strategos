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
  getSpearSideAttackCells,
  isInBoard,
  pieceAt,
} from './Pieces';
import { resolveMelee, resolveRanged } from './Combat';
import { reachedGoal, removePieceById, addPiece } from './Board';

interface ChosenAction {
  // spearSideAttack: 槍兵の横払い(動かない攻撃)
  kind: 'rangedAttack' | 'spearSideAttack' | 'meleeAttack' | 'move' | 'stay';
  targetCol?: number;
  targetRow?: number;
  targetPieceId?: number;
}

// 撃破統計の記録(リザルト画面用)
function recordKill(state: GameState, attacker: Piece, victim: Piece): void {
  if (victim.typeId === 'obstacle') {
    state.stats.obstaclesDestroyed++;
    return;
  }
  if (attacker.side === 'player' && victim.side === 'enemy') {
    state.stats.playerKills++;
  } else if (attacker.side === 'enemy' && victim.side === 'player') {
    state.stats.enemyKills++;
  }
}

// 遠距離攻撃: 前方を順に走査、最初に出会った敵が対象。味方で遮られたら不発。
//   弓兵 (rangedForward): 前 2 マス
//   投石兵 (longRanged): 前 3 マス
function findRangedTarget(piece: Piece, board: BoardState, config: GameConfig): Piece | null {
  const type = getPieceType(config, piece.typeId);
  let maxDist: number;
  if (type.attackRange === 'rangedForward') maxDist = 2;
  else if (type.attackRange === 'longRanged') maxDist = 3;
  else return null;
  const dy = forwardDelta(piece.side);
  for (let dist = 1; dist <= maxDist; dist++) {
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

  // 槍兵の横払い: 横 1 マスに敵がいれば攻撃のみ実行(移動しない)
  if (type.attackRange === 'spearReach') {
    const sideCells = getSpearSideAttackCells(piece, config);
    for (const cell of sideCells) {
      const occ = pieceAt(board, cell.col, cell.row);
      if (occ && occ.side !== piece.side) {
        return {
          kind: 'spearSideAttack',
          targetPieceId: occ.id,
          targetCol: cell.col,
          targetRow: cell.row,
        };
      }
    }
  }

  const candidates = getMoveCandidates(piece, config);
  // 味方で塞がれたマス、または passThrough の途中マスが占有されている場合は除外
  const filtered = candidates.filter((c) => {
    const occ = pieceAt(board, c.col, c.row);
    if (occ && occ.side === piece.side) return false;
    // 経路の途中マスチェック(暗殺者の斜め前 2、騎兵の前 2)
    if (c.passThrough) {
      const through = pieceAt(board, c.passThrough.col, c.passThrough.row);
      if (through) return false;
    }
    return true;
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

// 1 ターン進行: 2 段階処理で AnimationStep を生成
//   Phase 1: 全駒のアクション決定(ボード状態スナップショット時点)
//   Phase 2A: 遠距離攻撃 + 槍兵横払い を「同時解決」(相打ち成立)
//   Phase 2B: melee + move を順次処理(衝突は順序的に正当化)
//   Phase 3: 到達判定
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

  // 処理順(melee/move 用): 前進度の高い順
  const pieces = [...state.board.pieces].sort((a, b) => {
    return forwardProgress(b, b.side, state.config.rules.boardSize) -
      forwardProgress(a, a.side, state.config.rules.boardSize);
  });

  // === Phase 1: 全駒のアクション決定(同時撮影、ボード状態は変更しない) ===
  const decisions: Array<{ piece: Piece; action: ChosenAction }> = [];
  for (const piece of pieces) {
    if (piece.hp <= 0) continue;
    const action = chooseAction(piece, state.board, state.config);
    decisions.push({ piece, action });
  }

  // === Phase 2A: 遠距離 + 槍兵横払い を同時解決 ===
  // 各 defender に蓄積するダメージとイベント情報
  type RangedAttack = {
    attacker: Piece;
    defender: Piece;
    damage: number;
    eventRef: AnimationStep['combatEvents'][number];
  };
  const rangedAttacks: RangedAttack[] = [];

  for (const { piece, action } of decisions) {
    if (action.kind !== 'rangedAttack' && action.kind !== 'spearSideAttack') continue;
    if (action.targetPieceId === undefined) continue;
    const target = state.board.pieces.find((p) => p.id === action.targetPieceId);
    if (!target || target.hp <= 0) continue;
    const attackerType = getPieceType(state.config, piece.typeId);
    const damage = attackerType.attack;
    // event はプレースホルダで先に push、後で hpAfter/destroyed を更新
    const evt = {
      attackerId: piece.id,
      defenderId: target.id,
      damage,
      defenderHpAfter: target.hp,
      defenderDestroyed: false,
      atCol: target.col,
      atRow: target.row,
    };
    step.combatEvents.push(evt);
    rangedAttacks.push({ attacker: piece, defender: target, damage, eventRef: evt });
  }

  // ダメージ集計 + 一括適用
  const damageMap = new Map<number, number>();
  for (const ra of rangedAttacks) {
    damageMap.set(ra.defender.id, (damageMap.get(ra.defender.id) ?? 0) + ra.damage);
  }
  for (const [defenderId, totalDmg] of damageMap) {
    const def = state.board.pieces.find((p) => p.id === defenderId);
    if (!def) continue;
    def.hp -= totalDmg;
  }

  // event の hpAfter/destroyed を最終値で更新
  for (const ra of rangedAttacks) {
    const def = state.board.pieces.find((p) => p.id === ra.defender.id);
    if (def) {
      ra.eventRef.defenderHpAfter = def.hp;
      ra.eventRef.defenderDestroyed = def.hp <= 0;
    }
  }

  // 死亡駒の除去 + kill 記録(複数攻撃者がいる場合は最初の attacker を kill 記録者に)
  const seenKilled = new Set<number>();
  for (const ra of rangedAttacks) {
    const def = state.board.pieces.find((p) => p.id === ra.defender.id);
    if (!def) continue;
    if (def.hp > 0) continue;
    if (seenKilled.has(def.id)) continue;
    seenKilled.add(def.id);
    recordKill(state, ra.attacker, def);
    removePieceById(state.board, def.id);
  }

  // === Phase 2B: melee + move を順次処理(現存駒のみ) ===
  for (const { piece, action } of decisions) {
    if (piece.hp <= 0) continue;
    if (state.board.pieces.indexOf(piece) < 0) continue;
    if (action.kind === 'stay') continue;
    if (action.kind === 'rangedAttack' || action.kind === 'spearSideAttack') continue;  // 既に解決

    if (action.kind === 'move' && action.targetCol !== undefined && action.targetRow !== undefined) {
      // 同ターン内に別の駒が target に動いていれば移動キャンセル
      const occ = pieceAt(state.board, action.targetCol, action.targetRow);
      if (occ && occ.id !== piece.id) continue;
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
      if (!target) {
        // ターゲットが Phase 2A の遠距離攻撃で既に倒されている場合
        // → 空マスならそこへ移動、別駒が居れば諦め
        const occ = pieceAt(state.board, action.targetCol, action.targetRow);
        if (occ && occ.id !== piece.id) continue;
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
        recordKill(state, piece, target);
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
        recordKill(state, target, piece);
        removePieceById(state.board, piece.id);
      } else if (result.attackerDestroyed && result.defenderDestroyed) {
        // 両者死亡
        recordKill(state, piece, target);
        recordKill(state, target, piece);
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

// 各サイクル開始時の支援効果を適用
//   増援指揮官: 隣接空マスに兵士 1 体を生成(時計回りに最初の空マス)
//   投石機: 決定論的に選んだ敵駒 1 体に 1 ダメージ
export function applySupportEffects(state: GameState): void {
  const supporters = [...state.board.pieces].filter((p) => {
    if (p.hp <= 0) return false;
    const type = getPieceType(state.config, p.typeId);
    return !!type.support;
  });

  for (const piece of supporters) {
    const type = getPieceType(state.config, piece.typeId);
    if (type.support === 'spawn_adjacent_soldier') {
      // 8 方向の隣接マスから空マスを探す(時計回り)
      const adjacent: Array<[number, number]> = [
        [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
      ];
      for (const [dc, dr] of adjacent) {
        const c = piece.col + dc;
        const r = piece.row + dr;
        if (!isInBoard(c, r, state.config.rules.boardSize)) continue;
        if (pieceAt(state.board, c, r)) continue;
        const soldierType = getPieceType(state.config, 'soldier');
        addPiece(state.board, {
          id: state.nextPieceId++,
          typeId: 'soldier',
          side: piece.side,
          hp: soldierType.hp,
          col: c,
          row: r,
        });
        break;  // 1 体のみ生成
      }
    } else if (type.support === 'random_enemy_damage') {
      const enemyPieces = state.board.pieces.filter(
        (p) => p.side !== piece.side && p.hp > 0,
      );
      if (enemyPieces.length === 0) continue;
      // 決定論的選定(ホバー予測との一致)
      const idx = Math.abs(state.cycle * 31 + piece.id) % enemyPieces.length;
      const target = enemyPieces[idx];
      target.hp -= 1;
      if (target.hp <= 0) {
        recordKill(state, piece, target);
        removePieceById(state.board, target.id);
      }
    }
  }
}
