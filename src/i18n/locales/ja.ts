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
    body: `
      <h3>📊 アクセス解析について</h3>
      <p>
        本サイトは、ユーザーの利用状況を把握するために <b>Google Analytics 4 (GA4)</b> を使用しています。
        GA4 は Cookie や類似技術を使用してデータを収集します。収集される情報には以下が含まれます:
      </p>
      <ul>
        <li>アクセス日時、滞在時間</li>
        <li>使用しているブラウザ・OS</li>
        <li>画面サイズ・デバイス種別</li>
        <li>ゲーム内の特定イベント(ゲーム開始・勝敗・設定変更等)</li>
      </ul>
      <p>
        IP アドレスは <b>匿名化処理</b>(IP Anonymization)を有効にしており、特定個人を識別できる情報は収集しません。
      </p>

      <h3>🍪 Cookie について</h3>
      <p>
        本サイトは、設定値の保存(プレイヤーの好み)に <b>localStorage</b> を使用しています。これはサーバーに送信されません。
        GA4 は別途 Cookie を使用しますが、これも個人特定情報は含みません。
      </p>

      <h3>🚫 サードパーティーへの提供</h3>
      <p>
        Google Analytics で収集された統計情報は、Google 社のプライバシーポリシーに基づいて処理されます。
        本サイト運営者は、ユーザー個人を特定する情報を第三者に提供しません。
      </p>

      <h3>⚙️ オプトアウト</h3>
      <p>
        Google Analytics の追跡を拒否したい場合は、以下のいずれかの方法をご利用ください:
      </p>
      <ul>
        <li>ブラウザ設定で Cookie をブロックする</li>
        <li>
          <a href="https://tools.google.com/dlpage/gaoptout?hl=ja" target="_blank" rel="noopener" style="color: #6a4818;">
            Google Analytics オプトアウト アドオン
          </a>を使用する
        </li>
      </ul>

      <h3>📧 連絡先</h3>
      <p>
        本ポリシーに関するお問い合わせは、リポジトリの Issue 等を通じてお願いします。
      </p>

      <p style="margin-top: 16px; color: var(--text-secondary); font-size: 12px;">
        最終更新: 2026-05-02
      </p>
    `,
  },
  tutorial: {
    title: 'Auto-Strategos の遊び方',
    body: `
      <h3>🎯 目的</h3>
      <p>あなたの駒を <b>敵陣最奥</b>(画面上端)に <b>3 体到達</b> させて勝利。<br>
      逆に敵駒に <b>自陣最奥</b>(画面下端)に 3 体到達されたら敗北。</p>

      <h3>🎮 1 サイクルの流れ</h3>
      <ol>
        <li>下の <b>shop</b> で駒のカードをクリック → 選択</li>
        <li>盤面の <b>自陣青背景マス</b>(下 2 行)をクリック → 配置 + 所持金消費</li>
        <li>必要なら他の駒も購入・配置(リロール 1g で shop 入替)</li>
        <li><b>[Go ▶]</b> ボタンで <b>3 ターン</b> 自動進行</li>
        <li>全駒が動き、衝突したら自動戦闘</li>
        <li>次サイクルへ(基本収入 +4g + 2 サイクルごと +1g 累積 + 利息)</li>
      </ol>

      <h3>💡 コツ</h3>
      <ul>
        <li>駒に <b>マウスホバー</b> で動ける先のセルがハイライト</li>
        <li>同じホバーで <b>3 ターン先の予測経路</b> も矢印で表示</li>
        <li>右の <b>凡例パネル</b> で各駒の能力を確認できる</li>
        <li>自陣の壁(<b>■</b>)は同盟扱い、攻撃しない</li>
        <li>敵陣の壁は破壊して進む必要あり(HP 3)</li>
        <li>10 駒それぞれ動き方・HP・攻撃力が違う(凡例参照)</li>
        <li>弓兵 (正面射程 2)・投石兵 (前方扇 射程 3) は遠距離(味方に遮られると不発)</li>
        <li><b>増援指揮官</b>: 毎ターン (移動後) に隣接空マスへ兵士を 1 体生成</li>
        <li><b>投石機</b>: 毎ターン (移動後) にランダムな敵駒へ 1 ダメージ</li>
        <li>2 サイクルごとに収入 +1g — 長期戦になるほど高コスト駒が活きる</li>
      </ul>

      <p style="margin-top: 16px; color: var(--text-secondary); font-size: 12px;">
        この説明はゲーム画面の <b>「?」ボタン</b> や、タイトル画面の <b>「遊び方」</b> から再表示できます。
      </p>
    `,
  },
  language: {
    label: '言語',
    ja: '日本語',
    en: 'English',
  },
};

export type Locale = typeof ja;
