import type { Locale } from './ja';

// English locale
export const en: Locale = {
  common: {
    backToTitle: 'Back to Title',
    default: 'Default',
    startWithSettings: 'Start with these settings',
    close: 'Close',
    next: 'Next',
    yes: 'Yes',
    no: 'No',
  },
  title: {
    quickstart: 'Quick Start',
    settings: 'Game Settings',
    help: 'How to Play',
    privacy: 'Privacy Policy',
    subtitle: 'Lane Push Auto-Strategy',
  },
  settings: {
    title: 'Game Settings',
    aiStrategy: 'AI Strategy',
    aiDifficulty: 'AI Difficulty',
    obstacle: 'Obstacle Layout',
    audio: 'Volume',
    seVolume: 'SE Volume',
    bgmVolume: 'BGM Volume',
    playerLoadout: 'Player Loadout — pieces shown in shop (all checked = all)',
    aiLoadout: 'AI Loadout (all unchecked = use difficulty default)',
    strategy: {
      balanced: 'Balanced',
      aggressive: 'Aggressive (mobility/firepower)',
      defensive: 'Defensive (durability/range)',
    },
    difficulty: {
      easy: 'Easy (start 3g / 1 piece per cycle)',
      normal: 'Normal (start 5g / 2 pieces per cycle)',
      hard: 'Hard (start 7g / 3 pieces per cycle)',
    },
    obstaclePattern: {
      standard: 'Standard (4 cells each on row 2 / row 5)',
      none: 'None (all cells passable)',
      dense: 'Dense (12 cells distributed)',
    },
  },
  game: {
    cycle: 'Cycle',
    gold: 'Gold',
    selfReach: 'Self goal',
    enemyReach: 'Enemy goal',
    go: 'Go ▶',
    reroll: 'Reroll (1g)',
    legend: 'Piece Legend',
    legendHint: 'Pick a piece in the shop → place on home rows. Hover a piece = move range + 3-turn forecast. [Go] runs 3 turns of auto-advance. Walls in your home (■) are friendly.',
  },
  result: {
    win: 'Victory',
    lose: 'Defeat',
    draw: 'Draw',
    subWin: '3 pieces reached the enemy goal',
    subLose: '3 enemy pieces reached your goal',
    subDraw: 'Both sides reached 3 in the same cycle',
    cycles: 'Cycles',
    selfReach: 'Your reach',
    enemyReach: 'Enemy reach',
    playerKills: 'Enemies defeated',
    restart: 'Replay (same settings)',
    backToTitle: 'Back to Title',
  },
  privacy: {
    title: 'Privacy Policy',
  },
  language: {
    label: 'Language',
    ja: '日本語',
    en: 'English',
  },
};
