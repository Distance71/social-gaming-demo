// Official CedarSlotService + MultiRowSlotEngine + CedarMath implementation in TypeScript
// Matches VanguardLTE\Services\CedarSlotService, VanguardLTE\Services\MultiRowSlotEngine,
// VanguardLTE\Games\CedarMath, and public/js/cedar-client.js 1-to-1.

export const CEDAR_MATH_VERSION = 'cedar-slot-v1';

export interface CedarSlotSymbolInfo {
  id: string;
  key: string;
  name: string;
  tier: 'wild' | 'high' | 'low';
  asset: string;
  pays: [number, number, number, number, number]; // [5x, 4x, 3x, 2x, 1x] per MultiRowSlotEngine.php line 77
}

export const assetPath = (path: string) => {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as unknown as { env?: { BASE_URL?: string } }).env : undefined;
  const base = metaEnv?.BASE_URL ? metaEnv.BASE_URL : './';
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
};

export const CEDARCULES_SYMBOLS: CedarSlotSymbolInfo[] = [
  { id: '1', key: 'wild', name: 'Wild Medallion', tier: 'wild', asset: assetPath('/cedar/games/Cedarcules/assets/symbols/wild.png'), pays: [500, 120, 35, 5, 0] },
  { id: '2', key: 'hero', name: 'Cedarcules', tier: 'high', asset: assetPath('/cedar/games/Cedarcules/assets/symbols/hero.png'), pays: [300, 80, 25, 3, 0] },
  { id: '3', key: 'lion', name: 'Nemean Lion', tier: 'high', asset: assetPath('/cedar/games/Cedarcules/assets/symbols/lion.png'), pays: [200, 60, 20, 2, 0] },
  { id: '4', key: 'temple', name: 'Temple of Olympus', tier: 'high', asset: assetPath('/cedar/games/Cedarcules/assets/symbols/temple.png'), pays: [150, 45, 15, 2, 0] },
  { id: '5', key: 'thunder-club', name: 'Thunder Club', tier: 'high', asset: assetPath('/cedar/games/Cedarcules/assets/symbols/thunder-club.png'), pays: [100, 30, 12, 0, 0] },
  { id: '6', key: 'silver-coin', name: 'Silver Drachma', tier: 'low', asset: assetPath('/cedar/games/Cedarcules/assets/symbols/silver-coin.png'), pays: [60, 20, 8, 0, 0] },
  { id: '7', key: 'laurel', name: 'Golden Laurel', tier: 'low', asset: assetPath('/cedar/games/Cedarcules/assets/symbols/laurel.png'), pays: [50, 15, 6, 0, 0] },
  { id: '8', key: 'amphora', name: 'Royal Amphora', tier: 'low', asset: assetPath('/cedar/games/Cedarcules/assets/symbols/amphora.png'), pays: [40, 12, 5, 0, 0] },
  { id: '9', key: 'golden-apple', name: 'Hesperides Apple', tier: 'low', asset: assetPath('/cedar/games/Cedarcules/assets/symbols/golden-apple.png'), pays: [30, 10, 4, 0, 0] },
  { id: '10', key: 'shield', name: 'Bronze Shield', tier: 'low', asset: assetPath('/cedar/games/Cedarcules/assets/symbols/shield.png'), pays: [25, 8, 3, 0, 0] },
];

export const CEDARCULES_MATH = {
  rows: 3,
  wild: 1,
  published_rtp: 96.2,
  symbols: {
    '1': 'wild',
    '2': 'hero',
    '3': 'lion',
    '4': 'temple',
    '5': 'thunder-club',
    '6': 'silver-coin',
    '7': 'laurel',
    '8': 'amphora',
    '9': 'golden-apple',
    '10': 'shield',
  } as Record<string, string>,
  reel_weights: [
    { '1': 2, '2': 4, '3': 5, '4': 6, '5': 8, '6': 11, '7': 12, '8': 14, '9': 16, '10': 18 },
    { '1': 3, '2': 4, '3': 5, '4': 6, '5': 8, '6': 11, '7': 12, '8': 14, '9': 16, '10': 17 },
    { '1': 3, '2': 4, '3': 5, '4': 7, '5': 8, '6': 11, '7': 12, '8': 14, '9': 15, '10': 17 },
    { '1': 3, '2': 4, '3': 5, '4': 6, '5': 8, '6': 11, '7': 13, '8': 14, '9': 16, '10': 16 },
    { '1': 2, '2': 4, '3': 5, '4': 6, '5': 8, '6': 11, '7': 12, '8': 14, '9': 16, '10': 18 },
  ] as Array<Record<string, number>>,
  // 20 standard 5x3 paylines (row index 0..2 for each reel 0..4)
  paylines: [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],
    [0, 0, 1, 0, 0],
    [2, 2, 1, 2, 2],
    [1, 2, 2, 2, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
    [2, 1, 1, 1, 2],
    [1, 0, 1, 2, 1],
    [1, 2, 1, 0, 1],
    [0, 1, 0, 1, 0],
    [2, 1, 2, 1, 2],
    [1, 1, 0, 1, 1],
    [1, 1, 2, 1, 1],
    [0, 2, 0, 2, 0],
    [2, 0, 2, 0, 2],
    [0, 2, 2, 2, 0],
  ] as number[][],
  paytable: {
    1: [500, 120, 35, 5, 0],
    2: [300, 80, 25, 3, 0],
    3: [200, 60, 20, 2, 0],
    4: [150, 45, 15, 2, 0],
    5: [100, 30, 12, 0, 0],
    6: [60, 20, 8, 0, 0],
    7: [50, 15, 6, 0, 0],
    8: [40, 12, 5, 0, 0],
    9: [30, 10, 4, 0, 0],
    10: [25, 8, 3, 0, 0],
  } as Record<number, number[]>,
};

export const CEDARCULES_MANIFEST = {
  name: 'Cedarcules',
  title: 'Cedarcules',
  engine: 'slot',
  min_bet: 0.2,
  max_bet: 100,
  bet_steps: [0.2, 0.5, 1, 2, 5, 10, 25, 50, 100],
  max_payout: 1000000,
  brand: {
    name: 'CEDAR',
    loader_css: '/cedar/runtime/loader.css?v=3',
    theme_css: '/cedar/runtime/cedar-slot.css?v=5',
    game_theme_css: '/cedar/games/Cedarcules/theme.css',
  },
  layout: {
    preset: 'standard-5x3',
    columns: 5,
    rows: 3,
    lines: 20,
  },
  assets: {
    background: assetPath('/cedar/games/Cedarcules/assets/background-desktop.jpg'),
    mobile_background: assetPath('/cedar/games/Cedarcules/assets/background-mobile.jpg'),
    frame: assetPath('/cedar/games/Cedarcules/assets/frame.png'),
    symbols: {
      '1': assetPath('/cedar/games/Cedarcules/assets/symbols/wild.png'),
      '2': assetPath('/cedar/games/Cedarcules/assets/symbols/hero.png'),
      '3': assetPath('/cedar/games/Cedarcules/assets/symbols/lion.png'),
      '4': assetPath('/cedar/games/Cedarcules/assets/symbols/temple.png'),
      '5': assetPath('/cedar/games/Cedarcules/assets/symbols/thunder-club.png'),
      '6': assetPath('/cedar/games/Cedarcules/assets/symbols/silver-coin.png'),
      '7': assetPath('/cedar/games/Cedarcules/assets/symbols/laurel.png'),
      '8': assetPath('/cedar/games/Cedarcules/assets/symbols/amphora.png'),
      '9': assetPath('/cedar/games/Cedarcules/assets/symbols/golden-apple.png'),
      '10': assetPath('/cedar/games/Cedarcules/assets/symbols/shield.png'),
    } as Record<string, string>,
  },
  audio: {
    mode: 'files',
    files: {
      reel_start: assetPath('/cedar/games/Cedarcules/audio/reel-start.ogg'),
      reel_loop: assetPath('/cedar/games/Cedarcules/audio/reel-loop.ogg'),
      reel_stop_1: assetPath('/cedar/games/Cedarcules/audio/reel-stop-1.ogg'),
      reel_stop_2: assetPath('/cedar/games/Cedarcules/audio/reel-stop-2.ogg'),
      reel_stop_3: assetPath('/cedar/games/Cedarcules/audio/reel-stop-3.ogg'),
      result_no_win: assetPath('/cedar/games/Cedarcules/audio/result-no-win.ogg'),
      win_small: assetPath('/cedar/games/Cedarcules/audio/win-small.ogg'),
      win_medium: assetPath('/cedar/games/Cedarcules/audio/win-medium.ogg'),
      win_large: assetPath('/cedar/games/Cedarcules/audio/win-large.ogg'),
      wild_land: assetPath('/cedar/games/Cedarcules/audio/wild-land.ogg'),
      button_click: assetPath('/cedar/games/Cedarcules/audio/button-click.ogg'),
      fast_toggle: assetPath('/cedar/games/Cedarcules/audio/fast-toggle.ogg'),
      signature_cue: assetPath('/cedar/games/Cedarcules/audio/signature-cue.ogg'),
      ambient_loop: assetPath('/cedar/games/Cedarcules/audio/ambient-talisman-v1.ogg'),
    },
    win_tiers: {
      medium_multiplier: 5,
      large_multiplier: 20,
    },
  },
};

export interface CedarLineWin {
  WinSymbol: number;
  CountSymbols: number;
  Pay: string;
  Positions: number[];
  l: number;
}

export interface CedarRoundProof {
  bet_id: string;
  game: string;
  math_version: string;
  server_seed: string;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
  parameters: typeof CEDARCULES_MATH;
  wager: number;
  win: number;
  outcome: {
    grid: string[];
    total_win: string;
    line_wins: CedarLineWin[];
  };
  observed_commitment?: string;
}

export interface CedarSpinResult {
  status: 'success';
  bet_id: string;
  wager: number;
  grid: string[];
  line_wins: CedarLineWin[];
  win_amount: string;
  total_win: string;
  server_seed: string;
  revealed_server_seed: string;
  server_seed_hash: string;
  next_server_seed_hash: string;
  client_seed: string;
  nonce: number;
  math_version: string;
  proof: CedarRoundProof;
  balance: string;
  new_balance: string;
  timestamp?: string;
}

const encoder = new TextEncoder();

export function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToHex(digest);
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return bytesToHex(sig);
}

/**
 * Exact port of VanguardLTE\Games\CedarMath::integer and public/js/cedar-client.js sample()
 * Unbiased integer in [0, size - 1] via 32-bit rejection sampling.
 */
export async function cedarMathInteger(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  size: number,
  cursor = 0
): Promise<number> {
  if (size < 1) throw new Error('Sample size must be positive.');
  const limit = Math.floor(4294967296 / size) * size;
  for (let attempt = 0; ; attempt++) {
    const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:${cursor}:${attempt}`);
    const value = parseInt(hash.slice(0, 8), 16);
    if (value < limit) {
      return value % size;
    }
  }
}

/**
 * Exact port of VanguardLTE\Services\MultiRowSlotEngine::generateWeightedGrid
 */
export async function generateWeightedGrid(
  reelWeights: Array<Record<string, number>>,
  rows: number,
  serverSeed: string,
  clientSeed: string,
  nonce: number
): Promise<string[]> {
  let cursor = 0;
  const columns: string[][] = [];
  for (const weights of reelWeights) {
    const entries = Object.entries(weights).filter(([, weight]) => Number(weight) > 0);
    const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
    const column: string[] = [];
    for (let row = 0; row < rows; row++) {
      const pick = (await cedarMathInteger(serverSeed, clientSeed, nonce, total, cursor++)) + 1;
      let mark = 0;
      for (const [symbol, weight] of entries) {
        mark += Number(weight);
        if (pick <= mark) {
          column.push(String(symbol));
          break;
        }
      }
    }
    columns.push(column);
  }

  const grid: string[] = [];
  for (let row = 0; row < rows; row++) {
    for (const column of columns) {
      grid.push(column[row]);
    }
  }
  return grid;
}

/**
 * Exact port of VanguardLTE\Services\MultiRowSlotEngine::evaluateLines
 */
export function evaluateLines(
  grid: string[],
  rows: number,
  paylines: number[][],
  paytable: Record<number, number[]>,
  wild: number,
  betPerLine: number
): { TotalWin: string; WinLines: CedarLineWin[] } {
  const reels = paylines[0]?.length ?? 0;
  if (rows < 1 || reels < 1 || grid.length !== rows * reels) {
    throw new Error('Grid dimensions do not match the configured paylines.');
  }

  const rowGrid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    rowGrid.push(grid.slice(r * reels, (r + 1) * reels));
  }

  let total = 0.0;
  const wins: CedarLineWin[] = [];

  paylines.forEach((payline, lineIndex) => {
    const symbols = payline.map((row, reel) => Number(rowGrid[row][reel]));
    let winningSymbol = symbols[0];
    let count = 1;

    for (let i = 1; i < symbols.length; i++) {
      const symbol = symbols[i];
      if (winningSymbol === wild && symbol !== wild) {
        winningSymbol = symbol;
      }
      if (symbol !== wild && winningSymbol !== wild && symbol !== winningSymbol) {
        break;
      }
      count++;
    }

    const pays = paytable[winningSymbol] ?? [];
    const payIndex = pays.length - count;
    const multiplier = payIndex >= 0 ? Number(pays[payIndex] ?? 0) : 0.0;
    const lineWin = Math.round(multiplier * betPerLine * 100) / 100;
    if (lineWin <= 0) {
      return;
    }

    const positions: number[] = [];
    for (let reel = 0; reel < count; reel++) {
      positions.push(payline[reel] * reels + reel);
    }

    wins.push({
      WinSymbol: winningSymbol,
      CountSymbols: count,
      Pay: lineWin.toFixed(2),
      Positions: positions,
      l: lineIndex,
    });
    total += lineWin;
  });

  return {
    TotalWin: total.toFixed(2),
    WinLines: wins,
  };
}

/**
 * Exact port of public/js/cedar-client.js verify(proof) for cedar-slot-v1
 */
export async function verifyCedarSlotProof(proof: CedarRoundProof): Promise<{
  valid: boolean;
  message: string;
  generatedGrid: string[];
}> {
  if (proof.math_version !== CEDAR_MATH_VERSION) {
    throw new Error('Unsupported math version.');
  }
  const computedHash = await sha256Hex(proof.server_seed);
  if (computedHash !== proof.server_seed_hash) {
    throw new Error('Seed hash mismatch.');
  }
  const generatedGrid = await generateWeightedGrid(
    proof.parameters.reel_weights,
    proof.parameters.rows,
    proof.server_seed,
    proof.client_seed,
    proof.nonce
  );
  const valid = JSON.stringify(generatedGrid) === JSON.stringify(proof.outcome.grid);
  if (!valid) {
    throw new Error('Outcome does not match the seed.');
  }
  return {
    valid: true,
    message: 'Seed and slot grid verified locally. The public paytable and paylines are included in this record.',
    generatedGrid,
  };
}

// ============================================================================
// CEDAR ORIGINALS (cedar-v2): Solar Wheel (CedarWheel) & Prism Plinko (CedarPlinko)
// Exact port of VanguardLTE\Games\CedarTables & VanguardLTE\Games\CedarMath
// ============================================================================

export type ArcadeRisk = 'low' | 'medium' | 'high';

const RAW_WHEEL_TABLES: Record<number, Record<ArcadeRisk, number[]>> = {
  10: {
    low: [1.5, 1.2, 1.2, 1.2, 0.0, 1.5, 1.2, 1.2, 1.2, 0.0],
    medium: [2.0, 0.0, 1.5, 0.0, 2.0, 0.0, 1.5, 0.0, 3.0, 0.0],
    high: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 9.9],
  },
  20: {
    low: [
      1.5, 1.2, 1.2, 0.0, 1.2, 1.5, 1.2, 1.2, 0.0, 1.2, 1.5, 1.2, 1.2, 0.0, 1.2, 1.5, 1.2, 1.2,
      0.0, 1.2,
    ],
    medium: [
      0.0, 1.5, 0.0, 2.0, 0.0, 1.5, 0.0, 3.0, 0.0, 1.5, 0.0, 2.0, 0.0, 1.5, 0.0, 2.0, 0.0, 1.5,
      0.0, 5.0,
    ],
    high: [
      0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
      0.0, 19.8,
    ],
  },
};

function buildScaledWheelTables(): Record<number, Record<ArcadeRisk, number[]>> {
  const out: Record<number, Record<ArcadeRisk, number[]>> = {};
  for (const [countKey, risks] of Object.entries(RAW_WHEEL_TABLES)) {
    const count = Number(countKey);
    out[count] = { low: [], medium: [], high: [] };
    for (const [riskKey, values] of Object.entries(risks) as Array<[ArcadeRisk, number[]]>) {
      const sum = values.reduce((a, b) => a + b, 0);
      const scale = (0.95 * count) / sum;
      out[count][riskKey] = values.map((v) => Math.floor((v * scale + 1e-10) * 100) / 100);
    }
  }
  return out;
}

export const WHEEL_MULTIPLIERS = buildScaledWheelTables();

export const PLINKO_MULTIPLIERS: Record<number, Record<ArcadeRisk, number[]>> = {
  8: {
    low: [5.36, 2.01, 1.05, 0.96, 0.48, 0.96, 1.05, 2.01, 5.36],
    medium: [12.46, 2.88, 1.25, 0.67, 0.38, 0.67, 1.25, 2.88, 12.46],
    high: [27.75, 3.83, 1.44, 0.29, 0.19, 0.29, 1.44, 3.83, 27.75],
  },
  12: {
    low: [9.58, 2.87, 1.53, 1.34, 1.05, 0.96, 0.48, 0.96, 1.05, 1.34, 1.53, 2.87, 9.58],
    medium: [31.6, 10.53, 3.83, 1.92, 1.05, 0.57, 0.29, 0.57, 1.05, 1.92, 3.83, 10.53, 31.6],
    high: [162.6, 22.95, 7.75, 1.91, 0.67, 0.19, 0.19, 0.19, 0.67, 1.91, 7.75, 22.95, 162.6],
  },
};

export async function runWheelSpin(
  wager: number,
  risk: ArcadeRisk,
  segments: 10 | 20,
  serverSeed: string,
  clientSeed: string,
  nonce: number
) {
  const table = WHEEL_MULTIPLIERS[segments][risk];
  const winningIndex = await cedarMathInteger(serverSeed, clientSeed, nonce, segments, 0);
  const multiplier = Number(table[winningIndex] ?? 0);
  const win = Math.min(1000000, Math.round(wager * multiplier * 100) / 100);
  const serverSeedHash = await sha256Hex(serverSeed);
  return {
    winningIndex,
    multiplier,
    win,
    table,
    serverSeedHash,
  };
}

export async function runPlinkoDrop(
  wager: number,
  risk: ArcadeRisk,
  rows: 8 | 12,
  serverSeed: string,
  clientSeed: string,
  nonce: number
) {
  const directions: number[] = [];
  for (let i = 0; i < rows; i++) {
    directions.push(await cedarMathInteger(serverSeed, clientSeed, nonce, 2, i));
  }
  const slotIndex = directions.reduce((a, b) => a + b, 0);
  const table = PLINKO_MULTIPLIERS[rows][risk];
  const multiplier = Number(table[slotIndex] ?? 0);
  const win = Math.min(1000000, Math.round(wager * multiplier * 100) / 100);
  const serverSeedHash = await sha256Hex(serverSeed);
  return {
    directions,
    slotIndex,
    multiplier,
    win,
    table,
    serverSeedHash,
  };
}

