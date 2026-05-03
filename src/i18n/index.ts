// i18n ヘルパー
//   設計の心得 11 章 [必須] 「最初から辞書化」に準拠
//   navigator.language で自動判定 + 設定画面で手動切替

import { ja } from './locales/ja';
import { en } from './locales/en';

export type LangCode = 'ja' | 'en';

const LANG_KEY = 'auto-strategos-lang-v1';

const dictionaries = { ja, en };

let currentLang: LangCode = 'ja';

// ブラウザ言語自動判定 + localStorage の優先
function detectLang(): LangCode {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ja' || saved === 'en') return saved;
  } catch {}
  if (typeof navigator !== 'undefined' && navigator.language) {
    if (navigator.language.startsWith('ja')) return 'ja';
    return 'en';
  }
  return 'ja';
}

export function initLang(): void {
  currentLang = detectLang();
}

export function getLang(): LangCode {
  return currentLang;
}

export function setLang(lang: LangCode): void {
  currentLang = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {}
}

// "title.quickstart" のようなキーを辞書から取得
//   key が見つからない場合はキー文字列をそのまま返す(デバッグ用)
export function t(key: string): string {
  const dict = dictionaries[currentLang] as unknown as Record<string, unknown>;
  const parts = key.split('.');
  let cursor: unknown = dict;
  for (const part of parts) {
    if (cursor && typeof cursor === 'object' && part in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return key;  // フォールバック: キー文字列
    }
  }
  return typeof cursor === 'string' ? cursor : key;
}

// HTML 内の data-i18n 属性を一括置換(textContent)
// data-i18n-html 属性は innerHTML で置換(マークアップ含むコンテンツ用)
export function applyI18nToDom(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (key) el.innerHTML = t(key);
  });
}

// 駒の名前を i18n から取得(駒種別の固有 key 規約: pieces.${id}.name)
//   現状 config.json の name (日本語) を使うが、英語対応のためのフック
const pieceNameMap: Record<string, { ja: string; en: string }> = {
  soldier: { ja: '兵士', en: 'Soldier' },
  scout: { ja: '斥候', en: 'Scout' },
  cavalry: { ja: '騎兵', en: 'Cavalry' },
  archer: { ja: '弓兵', en: 'Archer' },
  heavy: { ja: '重装兵', en: 'Heavy' },
  spear: { ja: '槍兵', en: 'Spearman' },
  assassin: { ja: '暗殺者', en: 'Assassin' },
  thrower: { ja: '投石兵', en: 'Slinger' },
  commander: { ja: '増援指揮官', en: 'Commander' },
  obstacle: { ja: '障害物', en: 'Wall' },
};

export function pieceName(typeId: string): string {
  const entry = pieceNameMap[typeId];
  if (!entry) return typeId;
  return entry[currentLang];
}
