/*
 * Local In-Browser Server Bridge for Cedar Games (Cedarcules, CedarWheel, CedarPlinko)
 * Intercepts POST /game/<Game>/server before game-session.js and cedar-client.js load,
 * executing the exact CedarSlotService, CedarArcadeService, MultiRowSlotEngine, and CedarMath
 * HMAC-SHA256 provably fair math locally in the browser.
 */
(function () {
  'use strict';

  const WALLET_KEY = 'cedar_demo_wallet_v2';
  const SLOT_MATH_VERSION = 'cedar-slot-v1';
  const ARCADE_MATH_VERSION = 'cedar-v2';
  const DEFAULT_BALANCE = 50000.0;

  const encoder = new TextEncoder();

  const hex = (bytes) =>
    Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

  const randomHex = (count) => {
    const arr = new Uint8Array(count);
    crypto.getRandomValues(arr);
    return hex(arr);
  };

  const sha256 = async (value) =>
    hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));

  const hmacSha256 = async (secret, message) => {
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  };

  // VanguardLTE\Games\CedarMath::integer
  const cedarInteger = async (serverSeed, clientSeed, nonce, size, cursor = 0) => {
    const limit = Math.floor(4294967296 / size) * size;
    for (let attempt = 0; ; attempt++) {
      const hash = await hmacSha256(serverSeed, `${clientSeed}:${nonce}:${cursor}:${attempt}`);
      const value = parseInt(hash.slice(0, 8), 16);
      if (value < limit) return value % size;
    }
  };

  // Exact port of VanguardLTE\Games\CedarTables::WHEEL & CedarMath::wheel()
  const RAW_WHEEL = {
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

  function buildWheelTables() {
    const out = {};
    for (const [countKey, risks] of Object.entries(RAW_WHEEL)) {
      const count = Number(countKey);
      out[count] = {};
      for (const [risk, values] of Object.entries(risks)) {
        const sum = values.reduce((a, b) => a + b, 0);
        const scale = (0.95 * count) / sum;
        out[count][risk] = values.map((v) => Math.floor((v * scale + 1e-10) * 10000) / 10000);
      }
    }
    return out;
  }

  const WHEEL_CONFIGURATIONS = buildWheelTables();

  // Exact port of VanguardLTE\Games\CedarTables::PLINKO
  const PLINKO_MULTIPLIERS = {
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
    16: {
      low: [
        15.32, 8.62, 1.92, 1.34, 1.34, 1.15, 1.05, 0.96, 0.48, 0.96, 1.05, 1.15, 1.34, 1.34, 1.92,
        8.62, 15.32,
      ],
      medium: [
        105.35, 39.27, 9.58, 4.79, 2.87, 1.44, 0.96, 0.48, 0.29, 0.48, 0.96, 1.44, 2.87, 4.79,
        9.58, 39.27, 105.35,
      ],
      high: [
        957.8, 124.51, 24.9, 8.62, 3.83, 1.92, 0.19, 0.19, 0.19, 0.19, 0.19, 1.92, 3.83, 8.62,
        24.9, 124.51, 957.8,
      ],
    },
  };

  const CEDARCULES_SYMBOL_LIST = [
    { id: 1, name: 'Wild Medallion', img: '/cedar/games/Cedarcules/assets/symbols/wild.png', pays: '5× 500x · 4× 120x · 3× 35x' },
    { id: 2, name: 'Cedarcules', img: '/cedar/games/Cedarcules/assets/symbols/hero.png', pays: '5× 300x · 4× 80x · 3× 25x' },
    { id: 3, name: 'Nemean Lion', img: '/cedar/games/Cedarcules/assets/symbols/lion.png', pays: '5× 200x · 4× 60x · 3× 20x' },
    { id: 4, name: 'Temple of Olympus', img: '/cedar/games/Cedarcules/assets/symbols/temple.png', pays: '5× 150x · 4× 45x · 3× 15x' },
    { id: 5, name: 'Thunder Club', img: '/cedar/games/Cedarcules/assets/symbols/thunder-club.png', pays: '5× 100x · 4× 30x · 3× 12x' },
    { id: 6, name: 'Silver Drachma', img: '/cedar/games/Cedarcules/assets/symbols/silver-coin.png', pays: '5× 60x · 4× 20x · 3× 8x' },
    { id: 7, name: 'Golden Laurel', img: '/cedar/games/Cedarcules/assets/symbols/laurel.png', pays: '5× 50x · 4× 15x · 3× 6x' },
    { id: 8, name: 'Royal Amphora', img: '/cedar/games/Cedarcules/assets/symbols/amphora.png', pays: '5× 40x · 4× 12x · 3× 5x' },
    { id: 9, name: 'Golden Apple', img: '/cedar/games/Cedarcules/assets/symbols/golden-apple.png', pays: '5× 30x · 4× 10x · 3× 4x' },
    { id: 10, name: 'Bronze Shield', img: '/cedar/games/Cedarcules/assets/symbols/shield.png', pays: '5× 25x · 4× 8x · 3× 3x' },
  ];

  const CEDARCULES_MATH = {
    rows: 3,
    wild: 1,
    published_rtp: 96.2,
    symbols: {
      1: 'wild',
      2: 'hero',
      3: 'lion',
      4: 'temple',
      5: 'thunder-club',
      6: 'silver-coin',
      7: 'laurel',
      8: 'amphora',
      9: 'golden-apple',
      10: 'shield',
    },
    reel_weights: [
      { 1: 2, 2: 4, 3: 5, 4: 6, 5: 8, 6: 11, 7: 12, 8: 14, 9: 16, 10: 18 },
      { 1: 3, 2: 4, 3: 5, 4: 6, 5: 8, 6: 11, 7: 12, 8: 14, 9: 16, 10: 17 },
      { 1: 3, 2: 4, 3: 5, 4: 7, 5: 8, 6: 11, 7: 12, 8: 14, 9: 15, 10: 17 },
      { 1: 3, 2: 4, 3: 5, 4: 6, 5: 8, 6: 11, 7: 13, 8: 14, 9: 16, 10: 16 },
      { 1: 2, 2: 4, 3: 5, 4: 6, 5: 8, 6: 11, 7: 12, 8: 14, 9: 16, 10: 18 },
    ],
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
    ],
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
    },
  };

  const CEDARCULES_MANIFEST = {
    name: 'Cedarcules',
    title: 'Cedarcules',
    min_bet: 0.2,
    max_bet: 100,
    bet_steps: [0.2, 0.5, 1, 2, 5, 10, 25, 50, 100],
    max_payout: 1000000,
    brand: {
      name: 'CEDAR',
      loader_css: '/cedar/runtime/loader.css?v=3',
      theme_css: '/cedar/runtime/cedar-slot.css?v=5',
      game_theme_css: '/cedar/games/Cedarcules/theme.css?v=4',
    },
    layout: {
      preset: 'standard-5x3',
      columns: 5,
      rows: 3,
      lines: 20,
    },
    assets: {
      background: '/cedar/games/Cedarcules/assets/background-desktop.jpg',
      mobile_background: '/cedar/games/Cedarcules/assets/background-mobile.jpg',
      frame: '/cedar/games/Cedarcules/assets/frame.png',
      symbols: {
        1: '/cedar/games/Cedarcules/assets/symbols/wild.png',
        2: '/cedar/games/Cedarcules/assets/symbols/hero.png',
        3: '/cedar/games/Cedarcules/assets/symbols/lion.png',
        4: '/cedar/games/Cedarcules/assets/symbols/temple.png',
        5: '/cedar/games/Cedarcules/assets/symbols/thunder-club.png',
        6: '/cedar/games/Cedarcules/assets/symbols/silver-coin.png',
        7: '/cedar/games/Cedarcules/assets/symbols/laurel.png',
        8: '/cedar/games/Cedarcules/assets/symbols/amphora.png',
        9: '/cedar/games/Cedarcules/assets/symbols/golden-apple.png',
        10: '/cedar/games/Cedarcules/assets/symbols/shield.png',
      },
    },
    audio: {
      mode: 'files',
      files: {
        reel_start: '/cedar/games/Cedarcules/audio/reel-start.ogg',
        reel_loop: '/cedar/games/Cedarcules/audio/reel-loop.ogg',
        reel_stop_1: '/cedar/games/Cedarcules/audio/reel-stop-1.ogg',
        reel_stop_2: '/cedar/games/Cedarcules/audio/reel-stop-2.ogg',
        reel_stop_3: '/cedar/games/Cedarcules/audio/reel-stop-3.ogg',
        result_no_win: '/cedar/games/Cedarcules/audio/result-no-win.ogg',
        win_small: '/cedar/games/Cedarcules/audio/win-small.ogg',
        win_medium: '/cedar/games/Cedarcules/audio/win-medium.ogg',
        win_large: '/cedar/games/Cedarcules/audio/win-large.ogg',
        wild_land: '/cedar/games/Cedarcules/audio/wild-land.ogg',
        button_click: '/cedar/games/Cedarcules/audio/button-click.ogg',
        fast_toggle: '/cedar/games/Cedarcules/audio/fast-toggle.ogg',
        signature_cue: '/cedar/games/Cedarcules/audio/signature-cue.ogg',
        ambient_loop: '/cedar/games/Cedarcules/audio/ambient-talisman-v1.ogg',
      },
      win_tiers: {
        medium_multiplier: 5,
        large_multiplier: 20,
      },
    },
  };

  function getBalance() {
    try {
      const raw = localStorage.getItem(WALLET_KEY);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 0) return parsed;
      }
    } catch (_) {}
    setBalance(DEFAULT_BALANCE);
    return DEFAULT_BALANCE;
  }

  function setBalance(val) {
    const clean = Math.max(0, Math.round(Number(val) * 100) / 100);
    try {
      localStorage.setItem(WALLET_KEY, clean.toFixed(2));
    } catch (_) {}
    return clean;
  }

  function stateKeyFor(game) {
    return `cedar_demo_state_${game}_v2`;
  }

  function roundsKeyFor(game) {
    return `cedar_demo_rounds_${game}_v2`;
  }

  function getState(game = 'Cedarcules') {
    try {
      const raw = localStorage.getItem(stateKeyFor(game));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.server_seed && parsed.client_seed && parsed.nonce) {
          return parsed;
        }
      }
    } catch (_) {}
    const fresh = {
      server_seed: randomHex(32),
      client_seed: randomHex(8),
      nonce: 1,
      active: null,
    };
    saveState(game, fresh);
    return fresh;
  }

  function saveState(game, state) {
    try {
      localStorage.setItem(stateKeyFor(game), JSON.stringify(state));
    } catch (_) {}
  }

  function getRounds(game = 'Cedarcules') {
    try {
      const raw = localStorage.getItem(roundsKeyFor(game));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  }

  function saveRound(game, roundRecord) {
    const rounds = getRounds(game);
    rounds.unshift(roundRecord);
    const trimmed = rounds.slice(0, 30);
    try {
      localStorage.setItem(roundsKeyFor(game), JSON.stringify(trimmed));
    } catch (_) {}
    return trimmed;
  }

  async function generateWeightedGrid(reelWeights, rows, serverSeed, clientSeed, nonce) {
    let cursor = 0;
    const columns = [];
    for (const weights of reelWeights) {
      const entries = Object.entries(weights).filter(([, weight]) => Number(weight) > 0);
      const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
      const column = [];
      for (let row = 0; row < rows; row++) {
        const pick = (await cedarInteger(serverSeed, clientSeed, nonce, total, cursor++)) + 1;
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
    const grid = [];
    for (let row = 0; row < rows; row++) {
      for (const column of columns) {
        grid.push(column[row]);
      }
    }
    return grid;
  }

  function evaluateLines(grid, rows, paylines, paytable, wild, betPerLine) {
    const reels = paylines[0].length;
    const rowGrid = [];
    for (let r = 0; r < rows; r++) {
      rowGrid.push(grid.slice(r * reels, (r + 1) * reels));
    }
    let total = 0.0;
    const wins = [];
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
      const pays = paytable[winningSymbol] || [];
      const payIndex = pays.length - count;
      const multiplier = payIndex >= 0 ? Number(pays[payIndex] || 0) : 0.0;
      const lineWin = Math.round(multiplier * betPerLine * 100) / 100;
      if (lineWin <= 0) return;
      const positions = [];
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

  function notifyHost(game, action, data, requestBody) {
    const payload = {
      type: 'cedar-demo:sync',
      game,
      action,
      request: requestBody,
      response: data,
      balance: getBalance(),
      state: getState(game),
      rounds: getRounds(game),
    };
    window.dispatchEvent(new CustomEvent('cedar-demo:sync', { detail: payload }));
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, '*');
      }
    } catch (_) {}
  }

  async function handleArcadeServer(game, body) {
    const action = body.action || 'init';
    const state = getState(game);
    const balance = getBalance();
    const rounds = getRounds(game);
    const serverSeedHash = await sha256(state.server_seed);

    if (action === 'init') {
      const base = {
        status: 'success',
        game,
        balance: balance.toFixed(2),
        min_bet: 1,
        max_bet: 1000,
        max_payout: 1000000,
        server_seed_hash: serverSeedHash,
        client_seed: state.client_seed,
        nonce: state.nonce,
        last_result: rounds.length > 0 ? rounds[0].result : null,
        last_proof: rounds.length > 0 ? rounds[0].proof : null,
      };
      if (game === 'CedarWheel') {
        base.configurations = WHEEL_CONFIGURATIONS;
      } else if (game === 'CedarPlinko') {
        base.multipliers = PLINKO_MULTIPLIERS;
      }
      notifyHost(game, 'init', base, body);
      return base;
    }

    if (action === 'spin' || action === 'drop') {
      const wager = Number(body.wager);
      if (!Number.isFinite(wager) || wager < 1 || wager > 1000) {
        return { status: 'error', message: 'Enter a wager between 1 and 1,000.' };
      }
      if (balance < wager) {
        return { status: 'error', message: 'Insufficient Cedar Coins balance.' };
      }

      const clientSeed =
        typeof body.client_seed === 'string' && body.client_seed.trim()
          ? body.client_seed.trim()
          : state.client_seed;
      const serverSeed = state.server_seed;
      const nonce = Number(state.nonce);
      const roundId =
        typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : randomHex(16);
      const nextServerSeed = randomHex(32);
      const nextServerSeedHash = await sha256(nextServerSeed);

      if (game === 'CedarWheel') {
        const segments = [10, 20].includes(Number(body.segments)) ? Number(body.segments) : 10;
        const risk = ['low', 'medium', 'high'].includes(body.risk) ? body.risk : 'medium';
        const table = WHEEL_CONFIGURATIONS[segments][risk];
        const winningIndex = await cedarInteger(serverSeed, clientSeed, nonce, segments, 0);
        const multiplier = Number(table[winningIndex] || 0);
        const win = Math.min(1000000, Math.round(wager * multiplier * 100) / 100);
        const newBalance = setBalance(balance - wager + win);

        const proof = {
          bet_id: roundId,
          game: 'CedarWheel',
          math_version: ARCADE_MATH_VERSION,
          server_seed: serverSeed,
          server_seed_hash: serverSeedHash,
          client_seed: clientSeed,
          nonce,
          parameters: { segments, risk },
          wager,
          win,
          outcome: { winning_index: winningIndex, multiplier },
        };

        const result = {
          status: 'success',
          bet_id: roundId,
          wager,
          win_amount: win.toFixed(2),
          balance: newBalance.toFixed(2),
          new_balance: newBalance.toFixed(2),
          segments_count: segments,
          segments_table: table,
          winning_index: winningIndex,
          multiplier,
          server_seed: serverSeed,
          server_seed_hash: serverSeedHash,
          next_server_seed_hash: nextServerSeedHash,
          client_seed: clientSeed,
          nonce,
          proof,
        };

        saveState(game, {
          server_seed: nextServerSeed,
          client_seed: clientSeed,
          nonce: nonce + 1,
          active: null,
        });
        saveRound(game, { id: roundId, wager, win, proof, result });
        notifyHost(game, action, result, body);
        return result;
      }

      if (game === 'CedarPlinko') {
        const rows = [8, 12, 16].includes(Number(body.rows)) ? Number(body.rows) : 16;
        const risk = ['low', 'medium', 'high'].includes(body.risk) ? body.risk : 'medium';
        const directions = [];
        for (let i = 0; i < rows; i++) {
          directions.push(await cedarInteger(serverSeed, clientSeed, nonce, 2, i));
        }
        const slotIndex = directions.reduce((a, b) => a + b, 0);
        const table = PLINKO_MULTIPLIERS[rows][risk];
        const multiplier = Number(table[slotIndex] || 0);
        const win = Math.min(1000000, Math.round(wager * multiplier * 100) / 100);
        const newBalance = setBalance(balance - wager + win);

        const proof = {
          bet_id: roundId,
          game: 'CedarPlinko',
          math_version: ARCADE_MATH_VERSION,
          server_seed: serverSeed,
          server_seed_hash: serverSeedHash,
          client_seed: clientSeed,
          nonce,
          parameters: { rows, risk },
          wager,
          win,
          outcome: { directions, slot_index: slotIndex, multiplier },
        };

        const result = {
          status: 'success',
          bet_id: roundId,
          wager,
          win_amount: win.toFixed(2),
          balance: newBalance.toFixed(2),
          new_balance: newBalance.toFixed(2),
          rows,
          risk,
          directions,
          slot_index: slotIndex,
          multiplier,
          server_seed: serverSeed,
          server_seed_hash: serverSeedHash,
          next_server_seed_hash: nextServerSeedHash,
          client_seed: clientSeed,
          nonce,
          proof,
        };

        saveState(game, {
          server_seed: nextServerSeed,
          client_seed: clientSeed,
          nonce: nonce + 1,
          active: null,
        });
        saveRound(game, { id: roundId, wager, win, proof, result });
        notifyHost(game, action, result, body);
        return result;
      }
    }

    return { status: 'error', message: 'Unsupported action.' };
  }

  async function handleCedarculesServer(body) {
    const action = body.action || 'init';
    const state = getState('Cedarcules');
    const balance = getBalance();
    const rounds = getRounds('Cedarcules');

    if (action === 'init') {
      const serverSeedHash = await sha256(state.server_seed);
      const lastProof = rounds.length > 0 ? rounds[0].proof : null;
      const responseData = {
        status: 'success',
        game: 'Cedarcules',
        title: CEDARCULES_MANIFEST.title,
        balance: balance.toFixed(2),
        currency: 'CEDARS',
        min_bet: CEDARCULES_MANIFEST.min_bet,
        max_bet: CEDARCULES_MANIFEST.max_bet,
        bet_steps: CEDARCULES_MANIFEST.bet_steps,
        max_payout: CEDARCULES_MANIFEST.max_payout,
        math_version: SLOT_MATH_VERSION,
        math: CEDARCULES_MATH,
        last_proof: lastProof,
        server_seed_hash: serverSeedHash,
        client_seed: state.client_seed,
        nonce: state.nonce,
        brand: CEDARCULES_MANIFEST.brand,
        layout: CEDARCULES_MANIFEST.layout,
        assets: CEDARCULES_MANIFEST.assets,
        audio: CEDARCULES_MANIFEST.audio,
      };
      notifyHost('Cedarcules', 'init', responseData, body);
      return responseData;
    }

    if (action === 'spin') {
      const requestId = body.request_id || randomHex(16);
      const existing = rounds.find((r) => r.request_id === requestId);
      if (existing) {
        notifyHost('Cedarcules', 'spin', existing.result, body);
        return existing.result;
      }

      const expectedHash = await sha256(state.server_seed);
      if (body.server_seed_hash && body.server_seed_hash !== expectedHash) {
        return {
          status: 'error',
          message: 'Seed changed. Reload the game before spinning.',
        };
      }

      const wager = Number(body.wager);
      if (
        !Number.isFinite(wager) ||
        wager < CEDARCULES_MANIFEST.min_bet ||
        wager > CEDARCULES_MANIFEST.max_bet
      ) {
        return {
          status: 'error',
          message: `Enter a wager between ${CEDARCULES_MANIFEST.min_bet} and ${CEDARCULES_MANIFEST.max_bet}.`,
        };
      }

      if (balance < wager) {
        return {
          status: 'error',
          message: 'Insufficient Cedar Coins balance.',
        };
      }

      const clientSeed =
        typeof body.client_seed === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(body.client_seed)
          ? body.client_seed
          : state.client_seed;
      const serverSeed = state.server_seed;
      const nonce = Number(state.nonce);

      const grid = await generateWeightedGrid(
        CEDARCULES_MATH.reel_weights,
        CEDARCULES_MATH.rows,
        serverSeed,
        clientSeed,
        nonce
      );

      const lineCount = CEDARCULES_MATH.paylines.length;
      const evaluation = evaluateLines(
        grid,
        CEDARCULES_MATH.rows,
        CEDARCULES_MATH.paylines,
        CEDARCULES_MATH.paytable,
        CEDARCULES_MATH.wild,
        wager / lineCount
      );

      const win = Math.min(CEDARCULES_MANIFEST.max_payout, Number(evaluation.TotalWin));
      const newBalance = setBalance(balance - wager + win);
      const roundId =
        typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : randomHex(16);
      const nextServerSeed = randomHex(32);
      const nextServerSeedHash = await sha256(nextServerSeed);

      const proof = {
        bet_id: roundId,
        game: 'Cedarcules',
        math_version: SLOT_MATH_VERSION,
        server_seed: serverSeed,
        server_seed_hash: expectedHash,
        client_seed: clientSeed,
        nonce,
        parameters: CEDARCULES_MATH,
        wager,
        win,
        outcome: {
          grid,
          total_win: win.toFixed(2),
          line_wins: evaluation.WinLines,
        },
      };

      const result = {
        status: 'success',
        bet_id: roundId,
        wager,
        grid,
        line_wins: evaluation.WinLines,
        win_amount: win.toFixed(2),
        total_win: win.toFixed(2),
        server_seed: serverSeed,
        revealed_server_seed: serverSeed,
        server_seed_hash: expectedHash,
        next_server_seed_hash: nextServerSeedHash,
        client_seed: clientSeed,
        nonce,
        math_version: SLOT_MATH_VERSION,
        proof,
        balance: newBalance.toFixed(2),
        new_balance: newBalance.toFixed(2),
        timestamp: new Date().toISOString(),
      };

      const nextState = {
        server_seed: nextServerSeed,
        client_seed: clientSeed,
        nonce: nonce + 1,
        active: null,
      };
      saveState('Cedarcules', nextState);
      saveRound('Cedarcules', {
        id: roundId,
        request_id: requestId,
        created_at: result.timestamp,
        wager,
        win,
        proof,
        result,
      });

      notifyHost('Cedarcules', 'spin', result, body);
      return result;
    }

    return { status: 'error', message: 'Invalid action.' };
  }

  // Install local fetch interceptor before game-session.js and cedar-client.js capture window.fetch
  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init = {}) {
    const rawUrl = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
    const url = new URL(rawUrl, window.location.href);
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();

    const serverMatch = url.pathname.match(/^\/game\/(Cedarcules|CedarWheel|CedarPlinko)\/server\/?$/);
    if (method === 'POST' && serverMatch) {
      const gameName = serverMatch[1];
      let body = {};
      try {
        const text =
          typeof init.body === 'string'
            ? init.body
            : input instanceof Request
              ? await input.clone().text()
              : '{}';
        body = JSON.parse(text || '{}');
      } catch (_) {}

      const responseData =
        gameName === 'Cedarcules'
          ? await handleCedarculesServer(body)
          : await handleArcadeServer(gameName, body);

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'POST' && /^\/faucet\/claim\/?$/.test(url.pathname)) {
      const updated = setBalance(getBalance() + 50000);
      updateDisplayedBalances(updated);
      const data = {
        success: true,
        new_balance: updated,
        new_balance_formatted: updated.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        message: '+50,000 FREE COINS added!',
      };
      notifyHost('Cedarcules', 'faucet', data, {});
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return realFetch(input, init);
  };

  function updateDisplayedBalances(amount) {
    const formatted = Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const slotBal = document.getElementById('cedar-balance');
    if (slotBal) slotBal.textContent = formatted;
    const arcadeBal = document.getElementById('balance');
    if (arcadeBal) arcadeBal.textContent = formatted;
  }

  // Listen for balance updates from the parent React shell
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'cedar-demo:set-balance') {
      const updated = setBalance(msg.balance);
      updateDisplayedBalances(updated);
      notifyHost('Cedarcules', 'balance-sync', { balance: updated.toFixed(2) }, {});
    } else if (msg.type === 'cedar-demo:spin-now') {
      const spinBtn = document.getElementById('cedar-spin') || document.getElementById('play');
      if (spinBtn && !spinBtn.disabled) spinBtn.click();
    }
  });

  function mountPaytableModal() {
    if (document.getElementById('cedar-paytable-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'cedar-paytable-modal';
    modal.className = 'cedar-modal-backdrop';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="cedar-modal-card" role="dialog" aria-label="Tabla de Pagos">
        <div class="cedar-modal-head">
          <h2>🏆 Tabla de Pagos · Cedarcules (20 Líneas · RTP 96.2%)</h2>
          <button type="button" class="cedar-hud-icon-btn" id="cedar-close-paytable">✕ Cerrar</button>
        </div>
        <div class="cedar-paytable-grid">
          ${CEDARCULES_SYMBOL_LIST.map(
            (s) => `
            <div class="cedar-paytable-item">
              <img src="${s.img}" alt="${s.name}">
              <strong>${s.name}</strong>
              <span>${s.pays}</span>
            </div>
          `
          ).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.hidden = true;
    });
    document.getElementById('cedar-close-paytable').addEventListener('click', () => {
      modal.hidden = true;
    });
  }

  function enhanceCabinetControls() {
    const wager = document.getElementById('cedar-wager');
    const spinBtn = document.getElementById('cedar-spin');
    const betLabel = document.querySelector('.cedar-bet');

    // 1. Add top HUD buttons (Paytable, Fairness, +50K) next to Lobby button
    const head = document.querySelector('.cedar-head');
    const homeLink = document.querySelector('.cedar-home');
    if (head && homeLink && !head.querySelector('.cedar-head-actions')) {
      mountPaytableModal();
      const actions = document.createElement('div');
      actions.className = 'cedar-head-actions';

      const paytableBtn = document.createElement('button');
      paytableBtn.type = 'button';
      paytableBtn.className = 'cedar-hud-icon-btn';
      paytableBtn.textContent = '🏆 Pagos';
      paytableBtn.addEventListener('click', () => {
        const modal = document.getElementById('cedar-paytable-modal');
        if (modal) modal.hidden = !modal.hidden;
      });

      const fairBtn = document.createElement('button');
      fairBtn.type = 'button';
      fairBtn.className = 'cedar-hud-icon-btn';
      fairBtn.textContent = '🛡️ Fair';
      fairBtn.addEventListener('click', () => {
        document.body.classList.toggle('show-fairness-modal');
        const details = document.querySelector('body > details');
        if (details) details.open = true;
      });

      actions.appendChild(paytableBtn);
      actions.appendChild(fairBtn);
      actions.appendChild(homeLink);
      head.appendChild(actions);
    }

    // 2. Wrap #cedar-wager with 3D circular - / + stepper buttons
    if (wager && betLabel && !betLabel.querySelector('.cedar-bet-stepper')) {
      const stepper = document.createElement('div');
      stepper.className = 'cedar-bet-stepper';

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'cedar-step-btn';
      minusBtn.textContent = '−';
      minusBtn.title = 'Bajar apuesta';

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'cedar-step-btn';
      plusBtn.textContent = '+';
      plusBtn.title = 'Subir apuesta';

      minusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (spinBtn && spinBtn.disabled) return;
        if (wager.selectedIndex > 0) {
          wager.selectedIndex -= 1;
          wager.dispatchEvent(new Event('change'));
        }
      });

      plusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (spinBtn && spinBtn.disabled) return;
        if (wager.selectedIndex < wager.options.length - 1) {
          wager.selectedIndex += 1;
          wager.dispatchEvent(new Event('change'));
        }
      });

      wager.parentNode.insertBefore(stepper, wager);
      stepper.appendChild(minusBtn);
      stepper.appendChild(wager);
      stepper.appendChild(plusBtn);
    }

    // 3. Add MAX BET, AUTO SPIN, and +50K Faucet pills in the bottom sub-row
    const audioControls = document.querySelector('.cedar-audio-controls');
    if (audioControls && !audioControls.querySelector('.cedar-extra-actions')) {
      const extraGroup = document.createElement('div');
      extraGroup.className = 'cedar-extra-actions';

      const maxBetBtn = document.createElement('button');
      maxBetBtn.type = 'button';
      maxBetBtn.className = 'cedar-cabinet-pill';
      maxBetBtn.innerHTML = '🔥 MAX BET';
      maxBetBtn.addEventListener('click', () => {
        if (!wager || (spinBtn && spinBtn.disabled)) return;
        wager.selectedIndex = wager.options.length - 1;
        wager.dispatchEvent(new Event('change'));
      });

      let autoSpinActive = false;
      let autoSpinTimer = null;
      const autoSpinBtn = document.createElement('button');
      autoSpinBtn.type = 'button';
      autoSpinBtn.className = 'cedar-cabinet-pill';
      autoSpinBtn.setAttribute('aria-pressed', 'false');
      autoSpinBtn.innerHTML = '<span class="cedar-Audio-dot"></span> AUTO';

      const syncAutoBtn = () => {
        autoSpinBtn.setAttribute('aria-pressed', autoSpinActive ? 'true' : 'false');
        autoSpinBtn.innerHTML = `<span class="cedar-Audio-dot"></span> ${
          autoSpinActive ? 'AUTO ON' : 'AUTO'
        }`;
      };

      const stepAutoSpin = () => {
        if (!autoSpinActive) return;
        if (spinBtn && !spinBtn.disabled) {
          spinBtn.click();
        }
        autoSpinTimer = setTimeout(stepAutoSpin, 650);
      };

      autoSpinBtn.addEventListener('click', () => {
        autoSpinActive = !autoSpinActive;
        syncAutoBtn();
        if (autoSpinActive) {
          stepAutoSpin();
        } else if (autoSpinTimer) {
          clearTimeout(autoSpinTimer);
          autoSpinTimer = null;
        }
      });

      const faucetBtn = document.createElement('button');
      faucetBtn.type = 'button';
      faucetBtn.className = 'cedar-cabinet-pill faucet-pill';
      faucetBtn.innerHTML = '+50K COINS';
      faucetBtn.addEventListener('click', () => {
        window.fetch('/faucet/claim', { method: 'POST' });
      });

      extraGroup.appendChild(maxBetBtn);
      extraGroup.appendChild(autoSpinBtn);
      extraGroup.appendChild(faucetBtn);

      const soundGroup = document.createElement('div');
      soundGroup.className = 'cedar-sound-group';
      while (audioControls.firstChild) {
        soundGroup.appendChild(audioControls.firstChild);
      }

      audioControls.appendChild(extraGroup);
      audioControls.appendChild(soundGroup);
    }
  }

  window.addEventListener('promex:game-response', (event) => {
    if (event.detail && event.detail.action === 'init') {
      setTimeout(enhanceCabinetControls, 50);
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    const homeLink = document.querySelector('.cedar-home');
    if (homeLink && window.parent && window.parent !== window) {
      homeLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.parent.postMessage({ type: 'cedar-demo:navigate-lobby' }, '*');
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        const spinBtn = document.getElementById('cedar-spin') || document.getElementById('play');
        if (spinBtn && !spinBtn.disabled) spinBtn.click();
      }
    });
  });
})();
