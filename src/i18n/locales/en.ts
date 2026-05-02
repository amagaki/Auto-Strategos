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
    body: `
      <h3>📊 Analytics</h3>
      <p>
        This site uses <b>Google Analytics 4 (GA4)</b> to understand visitor behavior.
        GA4 collects data via cookies and similar technologies. Information collected includes:
      </p>
      <ul>
        <li>Access timestamp and time spent</li>
        <li>Browser and OS</li>
        <li>Screen size and device type</li>
        <li>In-game events (game start, win/loss, settings changes, etc.)</li>
      </ul>
      <p>
        IP addresses are <b>anonymized</b> (IP Anonymization enabled). No personally identifiable information is collected.
      </p>

      <h3>🍪 Cookies</h3>
      <p>
        This site uses <b>localStorage</b> to save your preferences locally — this is not transmitted to any server.
        GA4 uses cookies separately, but those also do not contain personally identifiable information.
      </p>

      <h3>🚫 Third-Party Sharing</h3>
      <p>
        Statistics collected by Google Analytics are processed according to Google's Privacy Policy.
        The site operator does not provide individual identifying information to third parties.
      </p>

      <h3>⚙️ Opt-Out</h3>
      <p>
        To opt out of Google Analytics tracking:
      </p>
      <ul>
        <li>Block cookies in your browser settings</li>
        <li>
          Use the
          <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener" style="color: #6a4818;">
            Google Analytics Opt-Out Browser Add-on
          </a>
        </li>
      </ul>

      <h3>📧 Contact</h3>
      <p>
        For inquiries regarding this policy, please use the repository Issues.
      </p>

      <p style="margin-top: 16px; color: var(--text-secondary); font-size: 12px;">
        Last updated: 2026-05-02
      </p>
    `,
  },
  tutorial: {
    title: 'How to Play Auto-Strategos',
    body: `
      <h3>🎯 Objective</h3>
      <p>Reach the <b>enemy goal row</b> (top of the board) with <b>3 of your pieces</b> to win.<br>
      If the enemy reaches your <b>home goal row</b> (bottom) with 3 pieces, you lose.</p>

      <h3>🎮 Cycle Flow</h3>
      <ol>
        <li>Click a card in the <b>shop</b> at the bottom to select a piece type</li>
        <li>Click a <b>blue home cell</b> (rows 1-2) to place it (gold is consumed)</li>
        <li>Buy and place more pieces if you can (reroll for 1g)</li>
        <li>Press <b>[Go ▶]</b> to run <b>3 turns</b> of auto-advance</li>
        <li>All pieces move and resolve combat automatically</li>
        <li>Next cycle starts (income: +4g + accumulating bonus +1g every 2 cycles + interest)</li>
      </ol>

      <h3>💡 Tips</h3>
      <ul>
        <li><b>Hover</b> a piece to see its movement range highlighted on the board</li>
        <li>The same hover shows a <b>3-turn forecast</b> as arrows</li>
        <li>The <b>legend panel</b> on the right shows each piece's stats</li>
        <li>Walls in your home (<b>■</b>) are friendly — your pieces won't attack them</li>
        <li>Enemy walls block movement (HP 3) — destroy to advance</li>
        <li>Each of the 10 pieces has unique movement, HP, and attack (see legend)</li>
        <li>Archer (front range 2) and Slinger (front cone, range 3) attack from distance (blocked by allies)</li>
        <li><b>Commander</b>: spawns a soldier on an adjacent empty cell after moving each turn</li>
        <li><b>Catapult</b>: deals 1 damage to a random enemy after moving each turn</li>
        <li>Income increases by 1g every 2 cycles — long games favor expensive pieces</li>
      </ul>

      <p style="margin-top: 16px; color: var(--text-secondary); font-size: 12px;">
        You can re-open this dialog from the <b>"?" button</b> in-game or the <b>"How to Play"</b> button on the title screen.
      </p>
    `,
  },
  language: {
    label: 'Language',
    ja: '日本語',
    en: 'English',
  },
};
