import type { GameConfig, GameState, PieceTypeId, ShopOffer } from '../types';
import { getPieceType } from './Pieces';

// shop の駒プール: 障害物以外の購入可能な駒種
function purchasableTypes(config: GameConfig) {
  return config.pieceTypes.filter((t) => t.id !== 'obstacle');
}

// プリセット適用後のプール: loadout が空ならすべて、指定があれば指定駒種のみ
function effectivePool(config: GameConfig, loadoutPreset?: PieceTypeId[]) {
  const all = purchasableTypes(config);
  if (!loadoutPreset || loadoutPreset.length === 0) return all;
  const set = new Set(loadoutPreset);
  const filtered = all.filter((t) => set.has(t.id));
  // フィルタ結果が空なら全駒(防御的フォールバック)
  return filtered.length > 0 ? filtered : all;
}

// 4 枚ランダム提示(重複あり、loadoutPreset があれば pool を絞る)
export function generateShopOffers(config: GameConfig, loadoutPreset?: PieceTypeId[]): ShopOffer[] {
  const pool = effectivePool(config, loadoutPreset);
  const offers: ShopOffer[] = [];
  for (let i = 0; i < config.shop.offerCount; i++) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    offers.push({ pieceTypeId: pick.id, consumed: false });
  }
  return offers;
}

export function canAffordOffer(state: GameState, offerIndex: number): boolean {
  const offer = state.shop.offers[offerIndex];
  if (!offer || offer.consumed) return false;
  const type = getPieceType(state.config, offer.pieceTypeId);
  return state.player.gold >= type.cost;
}

export function consumeOffer(state: GameState, offerIndex: number): void {
  const offer = state.shop.offers[offerIndex];
  if (!offer) return;
  const type = getPieceType(state.config, offer.pieceTypeId);
  state.player.gold -= type.cost;
  offer.consumed = true;
}

export function rerollShop(state: GameState): boolean {
  if (state.player.gold < state.config.economy.rerollCost) return false;
  state.player.gold -= state.config.economy.rerollCost;
  state.shop.offers = generateShopOffers(state.config, state.settings.loadoutPreset);
  return true;
}

export function applyCycleIncome(state: GameState): void {
  // 累進収入: 4g + 3 サイクルごと +1g(両陣営共通)
  //   cycle 1: 直前は 0(初期金) → 適用後の cycle 2 で 4g
  //   cycle 4 への移行: 4 + Math.floor((4-1)/3) = 5g
  //   cycle 7 への移行: 4 + Math.floor((7-1)/3) = 6g
  const baseIncome = state.config.economy.incomePerCycle;  // config では 4 に変更
  const cycleBonus = Math.floor((state.cycle - 1) / 3);
  const totalIncome = baseIncome + cycleBonus;

  const interest = Math.min(
    Math.floor(state.player.gold * state.config.economy.interestRate),
    state.config.economy.interestCap,
  );
  state.player.gold += totalIncome + interest;

  const aiInterest = Math.min(
    Math.floor(state.enemy.gold * state.config.economy.interestRate),
    state.config.economy.interestCap,
  );
  state.enemy.gold += totalIncome + aiInterest;
}

export function getOfferType(state: GameState, offerIndex: number): PieceTypeId | null {
  const offer = state.shop.offers[offerIndex];
  if (!offer) return null;
  return offer.pieceTypeId;
}
