// Auto-Strategos: 進軍型オートストラテジー
// 8×8 盤面、駒を購入・配置し自動進行で敵陣最奥到達を競う

export type Side = 'player' | 'enemy';

export type PieceTypeId =
  | 'soldier' | 'scout' | 'cavalry' | 'archer' | 'heavy'
  | 'spear' | 'assassin'
  | 'thrower' | 'commander'
  | 'obstacle';

export type MoveStyle =
  | 'forwardWithDiag'    // 前 1 / 斜め前 1(兵士・弓兵)
  | 'diagonalOnly'       // 斜め前 1 のみ(斥候)
  | 'cavalry'            // 前 2 / 斜め前 1(騎兵)
  | 'forwardOnlyHeavy'   // 前 1 のみ(重装兵・槍兵・投石兵・指揮官)
  | 'assassin'           // 斜め前 1 / 斜め前 2(暗殺者、途中マス占有で 2 マス先は不可)
  | 'stationary';        // 動かない(障害物)

export type AttackRange =
  | 'forwardWithDiag'    // 前 1 / 斜め前 1
  | 'spearReach'         // 前 1 / 斜め前 1 / 横 1(槍兵: 扇形)
  | 'rangedForward'      // 前方 2 マス遠距離(弓兵)
  | 'longRanged'         // 前方 3 マス遠距離(投石兵)
  | 'none';              // 攻撃しない(障害物・指揮官)

// 毎ターン移動後に発動する支援効果
export type SupportEffect =
  | 'spawn_adjacent_soldier';   // 増援指揮官: 隣接空マスに兵士 1 体生成

export interface PieceTypeData {
  id: PieceTypeId;
  name: string;
  symbol: string;
  color: string;
  attack: number;
  hp: number;
  cost: number;
  moveStyle: MoveStyle;
  attackRange: AttackRange;
  // 毎ターン移動後に発動する支援効果(増援指揮官)
  support?: SupportEffect;
}

export interface Piece {
  id: number;
  typeId: PieceTypeId;
  side: Side;
  hp: number;
  col: number;       // 0..7 (file)
  row: number;       // 0..7 (rank). player goal: row=7, enemy goal: row=0
}

export interface BoardState {
  pieces: Piece[];
  size: number;
}

export interface ShopOffer {
  pieceTypeId: PieceTypeId;
  consumed: boolean;
}

export interface FactionState {
  gold: number;
  reachCount: number;
}

// アニメーション 1 ターン分のスナップショット
export interface AnimationStep {
  turnIndex: number;       // 0..advanceTurnsPerCycle-1
  pieceMoves: Array<{
    pieceId: number;
    fromCol: number;
    fromRow: number;
    toCol: number;
    toRow: number;
    typeId: PieceTypeId;
    side: Side;
  }>;
  combatEvents: Array<{
    attackerId: number;
    defenderId: number;
    damage: number;
    defenderHpAfter: number;
    defenderDestroyed: boolean;
    atCol: number;
    atRow: number;
  }>;
  reachEvents: Array<{
    pieceId: number;
    side: Side;
  }>;
  // ターン終了時の盤面スナップショット(駒一覧)
  pieceSnapshot: Piece[];
  playerReachAfter: number;
  enemyReachAfter: number;
}

export interface AnimationState {
  // ターン 0 開始直前(プレイヤーターン終了時)の駒スナップショット
  initialPreSnapshot: Piece[];
  initialPlayerReach: number;
  initialEnemyReach: number;
  steps: AnimationStep[];
  currentStepIndex: number;
  elapsedMs: number;
  msPerStep: number;
}

export interface GameState {
  cycle: number;
  phase: 'placement' | 'animating' | 'finished';
  board: BoardState;
  player: FactionState;
  enemy: FactionState;
  shop: {
    offers: ShopOffer[];
  };
  selectedPieceTypeId: PieceTypeId | null;
  hoveredPieceId: number | null;
  result: 'win' | 'lose' | 'draw' | null;
  animation: AnimationState | null;
  nextPieceId: number;
  config: GameConfig;
  settings: GameSettings;
  // リザルト画面用の簡易統計
  stats: {
    playerKills: number;     // プレイヤーが倒した敵駒数
    enemyKills: number;      // 敵が倒したプレイヤー駒数
    obstaclesDestroyed: number;
  };
}

// アプリケーション全体の画面状態
export type ScreenName = 'title' | 'settings' | 'game' | 'result';

export interface AppState {
  currentScreen: ScreenName;
  settings: GameSettings;
}

// 設定画面で吸収する項目
export type AiStrategy = 'aggressive' | 'defensive' | 'balanced';
export type AiDifficulty = 'easy' | 'normal' | 'hard';
export type ObstaclePattern = 'standard' | 'none' | 'dense';

export interface GameSettings {
  aiStrategy: AiStrategy;
  // プレイヤー shop に並ぶ駒種(空配列なら全 9 種)
  loadoutPreset: PieceTypeId[];
  // AI が使う駒種(空配列なら難易度デフォルトを適用)
  aiLoadoutPreset: PieceTypeId[];
  aiDifficulty: AiDifficulty;
  obstaclePattern: ObstaclePattern;
}

export interface GameConfig {
  pieceTypes: PieceTypeData[];
  economy: {
    initialGold: number;
    incomePerCycle: number;
    interestRate: number;
    interestCap: number;
    rerollCost: number;
  };
  shop: {
    offerCount: number;
  };
  rules: {
    boardSize: number;
    advanceTurnsPerCycle: number;
    reachToWin: number;
    placementMaxRow: number;
  };
  ai: {
    purchasePerCycle: number;
  };
  render: {
    msPerAnimationStep: number;
  };
  // 難易度別パラメータ(設定画面の AiDifficulty に対応)
  difficulty?: {
    easy: { initialGold: number; purchasePerCycle: number };
    normal: { initialGold: number; purchasePerCycle: number };
    hard: { initialGold: number; purchasePerCycle: number };
  };
}
