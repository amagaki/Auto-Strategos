import type { Piece, GameConfig } from '../types';
import { getPieceType } from './Pieces';

export interface CombatResult {
  attackerHpAfter: number;
  defenderHpAfter: number;
  attackerDestroyed: boolean;
  defenderDestroyed: boolean;
  attackerDamageTaken: number;
  defenderDamageTaken: number;
}

// 近接戦闘: attacker が defender のマスへ侵入。両者同時にダメージ判定。
export function resolveMelee(attacker: Piece, defender: Piece, config: GameConfig): CombatResult {
  const attackerType = getPieceType(config, attacker.typeId);
  const defenderType = getPieceType(config, defender.typeId);

  const defenderDamage = attackerType.attack;
  const attackerDamage = defenderType.attack;

  attacker.hp -= attackerDamage;
  defender.hp -= defenderDamage;

  return {
    attackerHpAfter: attacker.hp,
    defenderHpAfter: defender.hp,
    attackerDestroyed: attacker.hp <= 0,
    defenderDestroyed: defender.hp <= 0,
    attackerDamageTaken: attackerDamage,
    defenderDamageTaken: defenderDamage,
  };
}

// 遠距離攻撃: defender へ片側ダメージ(反撃なし)
export function resolveRanged(attacker: Piece, defender: Piece, config: GameConfig): CombatResult {
  const attackerType = getPieceType(config, attacker.typeId);
  const defenderDamage = attackerType.attack;

  defender.hp -= defenderDamage;

  return {
    attackerHpAfter: attacker.hp,
    defenderHpAfter: defender.hp,
    attackerDestroyed: false,
    defenderDestroyed: defender.hp <= 0,
    attackerDamageTaken: 0,
    defenderDamageTaken: defenderDamage,
  };
}
