import type { GameState } from '../types';
import { getPieceType } from '../systems/Pieces';

// 上部 HUD の更新
export function updateHud(state: GameState): void {
  const cycleEl = document.getElementById('hud-cycle');
  const goldEl = document.getElementById('hud-gold');
  const reachSelfEl = document.getElementById('hud-reach-self');
  const reachEnemyEl = document.getElementById('hud-reach-enemy');

  if (cycleEl) cycleEl.textContent = String(state.cycle);
  if (goldEl) goldEl.textContent = String(state.player.gold);

  // アニメ中はステップ進行に応じて到達数を更新(0.5 を境に切替)
  let playerReach = state.player.reachCount;
  let enemyReach = state.enemy.reachCount;
  if (state.animation && state.phase === 'animating') {
    const idx = state.animation.currentStepIndex;
    if (idx < state.animation.steps.length) {
      const t = state.animation.elapsedMs / state.animation.msPerStep;
      if (t < 0.5) {
        if (idx === 0) {
          playerReach = state.animation.initialPlayerReach;
          enemyReach = state.animation.initialEnemyReach;
        } else {
          playerReach = state.animation.steps[idx - 1].playerReachAfter;
          enemyReach = state.animation.steps[idx - 1].enemyReachAfter;
        }
      } else {
        playerReach = state.animation.steps[idx].playerReachAfter;
        enemyReach = state.animation.steps[idx].enemyReachAfter;
      }
    }
  }

  if (reachSelfEl) reachSelfEl.textContent = String(playerReach);
  if (reachEnemyEl) reachEnemyEl.textContent = String(enemyReach);
}

// shop カードを再構築
export function renderShop(
  state: GameState,
  onCardClick: (offerIndex: number) => void,
): void {
  const container = document.getElementById('shop-cards');
  if (!container) return;
  container.innerHTML = '';

  state.shop.offers.forEach((offer, index) => {
    const card = document.createElement('div');
    card.className = 'shop-card';
    if (offer.consumed) {
      card.classList.add('unaffordable');
      card.style.visibility = 'hidden';
      container.appendChild(card);
      return;
    }
    const type = getPieceType(state.config, offer.pieceTypeId);
    const affordable = state.player.gold >= type.cost;
    if (!affordable) card.classList.add('unaffordable');
    if (state.selectedPieceTypeId === offer.pieceTypeId) {
      card.classList.add('selected');
    }

    card.innerHTML = `
      <div class="card-name">${type.symbol} ${type.name}</div>
      <div class="move-grid">${moveGridHtml(type.moveStyle, type.attackRange)}</div>
      <div class="card-stats">
        <span class="stat-hp">♥${type.hp}</span>
        <span class="stat-atk">⚔${type.attack}</span>
      </div>
      <div class="card-cost">${type.cost} g</div>
    `;

    card.addEventListener('click', () => {
      if (affordable) onCardClick(index);
    });

    container.appendChild(card);
  });
}

// 動きグリッドを HTML で表現(Onitama 流): forward 方向の点群
export function moveGridHtml(moveStyle: string, attackRange: string): string {
  // 射程バッジ: rangedForward は「射程 2」を明記、spearReach は「横払い」を明記
  let rangedBadge = '';
  if (attackRange === 'rangedForward') {
    rangedBadge = '<span class="ranged-badge" title="遠距離攻撃 2 マス">⤴ 射程2</span>';
  } else if (attackRange === 'spearReach') {
    rangedBadge = '<span class="ranged-badge" title="前 + 横にも攻撃可能">↔ 横払い</span>';
  }
  let rows: string[];
  switch (moveStyle) {
    case 'forwardWithDiag':
      rows = ['●●●'];
      break;
    case 'diagonalOnly':
      rows = ['●○●'];
      break;
    case 'cavalry':
      rows = ['○●○', '●●●'];  // 上から: 前 2、前 1
      break;
    case 'forwardOnlyHeavy':
      rows = ['○●○'];
      break;
    case 'assassin':
      rows = ['●○●', '●○●'];  // 上から: 斜め前 2、斜め前 1
      break;
    case 'stationary':
      rows = ['―'];
      break;
    default:
      rows = [''];
  }
  const rowsHtml = rows.map((r) => `<div class="grid-row">${r}</div>`).join('');
  return `<div class="grid-rows">${rowsHtml}</div>${rangedBadge}`;
}

// Go / リロール ボタンの状態更新
export function updateButtons(state: GameState): void {
  const goBtn = document.getElementById('go-btn') as HTMLButtonElement | null;
  const rerollBtn = document.getElementById('reroll-btn') as HTMLButtonElement | null;
  if (goBtn) {
    goBtn.disabled = state.phase !== 'placement';
  }
  if (rerollBtn) {
    const canReroll = state.phase === 'placement' &&
      state.player.gold >= state.config.economy.rerollCost;
    rerollBtn.disabled = !canReroll;
  }
}

export function showResult(result: 'win' | 'lose' | 'draw', subtitle: string): void {
  const overlay = document.getElementById('result-overlay');
  const titleEl = document.getElementById('result-title');
  const subtitleEl = document.getElementById('result-subtitle');
  if (!overlay || !titleEl || !subtitleEl) return;

  if (result === 'win') {
    titleEl.className = 'title win';
    titleEl.textContent = '勝利';
  } else if (result === 'lose') {
    titleEl.className = 'title lose';
    titleEl.textContent = '敗北';
  } else {
    titleEl.className = 'title draw';
    titleEl.textContent = '引き分け';
  }
  subtitleEl.textContent = subtitle;
  overlay.classList.add('show');
}

export function hideResult(): void {
  const overlay = document.getElementById('result-overlay');
  if (overlay) overlay.classList.remove('show');
}

// 凡例パネル: 5 駒 + 障害物の早見表
export function renderLegend(state: GameState): void {
  const container = document.getElementById('legend-body');
  if (!container) return;
  container.innerHTML = '';
  for (const type of state.config.pieceTypes) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const isObstacle = type.id === 'obstacle';
    const gridHtml = isObstacle ? '<span class="li-grid-static">―</span>' : moveGridHtml(type.moveStyle, type.attackRange);
    const atkHtml = type.attack > 0
      ? `<span class="atk">⚔${type.attack}</span>`
      : `<span class="atk-na">壁</span>`;
    item.innerHTML = `
      <div class="li-symbol">${type.symbol}</div>
      <div class="li-info">
        <div class="li-name">${type.name}</div>
        <div class="li-grid">${gridHtml}</div>
      </div>
      <div class="li-stats">
        <span class="hp">♥${type.hp}</span>
        ${atkHtml}
        ${isObstacle ? '' : `<span class="cost">${type.cost}g</span>`}
      </div>
    `;
    container.appendChild(item);
  }
}
