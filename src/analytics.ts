// Google Analytics 4 (GA4) 連携ヘルパー
//   gtag が未定義のローカル開発環境では no-op
//   ID は index.html の <script> タグで設定済み(本番)

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag?: (...args: any[]) => void;
    dataLayer?: unknown[];
  }
}

export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }
  } catch {
    // gtag 呼び出し失敗は黙殺(本番計測の妨げにならないよう)
  }
}

// イベント定数(タイポ防止)
export const Events = {
  GAME_START: 'game_start',
  GAME_WON: 'game_won',
  GAME_LOST: 'game_lost',
  GAME_DREW: 'game_drew',
  SETTING_CHANGED: 'setting_changed',
  TUTORIAL_OPENED: 'tutorial_opened',
  PRIVACY_OPENED: 'privacy_opened',
} as const;
