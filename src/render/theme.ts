// 配色テーマ定数 — p5 描画用
//   CSS 変数(index.html の :root)と同じ値を保つこと
//   配色: ソフト中世風(紙テクスチャ + 木調)

export const THEME = {
  // 背景・基調色
  bgCanvas: '#e8dcc8',         // p5 canvas 全体の塗り(紙ベース)
  bgPaperLight: '#f0e4cc',     // 明るい紙(ハイライト)
  bgPaperDark: '#d4c4a0',      // 暗い紙(影)
  bgPanel: 'rgba(60, 45, 28, 0.92)',  // UI パネル(透過)

  // テキスト
  textPrimary: '#3a2c1c',      // 煤茶(濃色テキスト)
  textSecondary: '#6a5a4a',    // 中間色
  textOnDark: '#f0e6d0',       // 暗背景上のテキスト
  textMuted: '#8a7a6a',        // 補助テキスト

  // アクセント
  accentGold: '#b89968',       // 金茶
  accentGoldBright: '#d4b06e', // 明るい金
  accentBorder: '#a08868',     // 枠の標準色

  // 陣営色
  playerPrimary: '#3a6090',    // 深青(プレイヤー)
  playerLight: '#6890c0',      // 明るい青
  playerHighlight: 'rgba(80, 130, 200, 80)',  // 動ける範囲の塗り

  enemyPrimary: '#9a3a3a',     // 朱赤(敵)
  enemyLight: '#c06868',       // 明るい朱
  enemyHighlight: 'rgba(200, 90, 90, 80)',

  // 駒・盤面
  obstacleColor: '#7a5a3a',    // 木茶(障害物)
  cellLight: '#dcc89c',        // 明るいセル(チェック)
  cellDark: '#c4a878',         // 暗いセル
  cellPlayerZone: 'rgba(90, 130, 180, 50)',  // 自陣ゾーンのオーバーレイ
  cellEnemyZone: 'rgba(180, 80, 80, 50)',
  goalLinePlayer: '#3a6090',
  goalLineEnemy: '#9a3a3a',

  // ステータス
  hpHealthy: '#5aa850',        // 緑(HP > 66%)
  hpCaution: '#c89030',        // 橙(HP > 33%)
  hpDanger: '#c83838',         // 赤(HP <= 33%)
  atkText: '#8a6a3a',          // ATK 数値色

  // 攻撃ターゲットハイライト
  rangedTarget: '#9050a0',     // 紫(弓兵射程)
  spearTarget: '#5aa850',      // 緑(槍兵横払い)
  attackTarget: 'rgba(200, 60, 60, 100)',  // 攻撃可能赤

  // パーティクル
  fxParticleStart: [255, 220, 80],   // 火花初期色(黄)
  fxParticleEnd: [255, 100, 20],     // 火花終色(橙)
  fxReachPlayer: [255, 215, 80],     // 到達演出 (player)
  fxReachEnemy: [255, 100, 80],      // 到達演出 (enemy)
  fxCombatFlash: [220, 60, 60],      // 戦闘ダメージフラッシュ

  // 配置プレビュー
  placementPreviewBorder: '#d4b06e',
} as const;

// 16 進数文字列 → [r, g, b] 配列に変換するヘルパー
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
