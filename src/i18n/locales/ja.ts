// 日本語辞書
export const ja = {
  common: {
    backToTitle: 'タイトルに戻る',
    default: 'デフォルト',
    startWithSettings: 'この設定で開始',
    close: '閉じる',
    next: '次へ',
    yes: 'はい',
    no: 'いいえ',
  },
  title: {
    quickstart: 'すぐ始める',
    settings: 'ゲーム設定',
    help: '遊び方',
    privacy: 'プライバシーポリシー',
    subtitle: '進軍型オートストラテジー',
  },
  settings: {
    title: 'ゲーム設定',
    aiStrategy: 'AI 戦略',
    aiDifficulty: 'AI 難易度',
    obstacle: '障害物パターン',
    audio: '音量',
    seVolume: 'SE 音量',
    bgmVolume: 'BGM 音量',
    playerLoadout: 'プレイヤー出撃編成 — shop に並ぶ駒種(全選択 = 全駒)',
    aiLoadout: 'AI 出撃編成(全解除 = 難易度デフォルト)',
    strategy: {
      balanced: 'バランス(中庸)',
      aggressive: '攻め寄り(機動火力重視)',
      defensive: '守り寄り(耐久遠距離重視)',
    },
    difficulty: {
      easy: 'やさしい(初期金 3 / 1 駒・サイクル)',
      normal: 'ふつう(初期金 5 / 2 駒・サイクル)',
      hard: 'むずかしい(初期金 7 / 3 駒・サイクル)',
    },
    obstaclePattern: {
      standard: '標準(row 2 / row 5 に各 4 マス)',
      none: 'なし(全マス通行可)',
      dense: '多め(分散配置 12 マス)',
    },
  },
  game: {
    cycle: 'サイクル',
    gold: '所持金',
    selfReach: '自陣到達',
    enemyReach: '敵陣到達',
    go: 'Go ▶',
    reroll: 'リロール (1g)',
    legend: '駒 凡例',
    legendHint: 'shop で駒選択 → 自陣に配置。駒ホバー = 動ける範囲 + 3 ターン予測。[Go] で 3 ターン自動進行。自陣の壁(■)は同盟扱い',
  },
  result: {
    win: '勝利',
    lose: '敗北',
    draw: '引き分け',
    subWin: '敵陣最奥に 3 体到達',
    subLose: '自陣最奥に 3 体到達されました',
    subDraw: '同サイクルで両者 3 体到達',
    cycles: 'サイクル数',
    selfReach: '自陣到達',
    enemyReach: '敵陣到達',
    playerKills: '撃破した敵',
    restart: '同じ設定で再戦',
    backToTitle: 'タイトルへ',
  },
  privacy: {
    title: 'プライバシーポリシー',
  },
  language: {
    label: '言語',
    ja: '日本語',
    en: 'English',
  },
};

export type Locale = typeof ja;
