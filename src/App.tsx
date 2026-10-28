import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArcadeRisk,
  CEDARCULES_MANIFEST,
  CEDARCULES_MATH,
  CEDARCULES_SYMBOLS,
  CedarLineWin,
  CedarRoundProof,
  PLINKO_MULTIPLIERS,
  WHEEL_MULTIPLIERS,
  evaluateLines,
  generateWeightedGrid,
  randomHex,
  runPlinkoDrop,
  runWheelSpin,
  sha256Hex,
  verifyCedarSlotProof,
  assetPath,
} from './engine/cedarSlotServer';

type GameMode = 'Cedarcules' | 'CedarWheel' | 'CedarPlinko' | 'Lobby';

const AMBIENT_SOUNDSCAPES: Record<
  GameMode,
  { src: string; targetVolume: number; title: string }
> = {
  Cedarcules: {
    src: assetPath('/cedar/games/Cedarcules/audio/ambient-talisman-v1.ogg'),
    targetVolume: 0.32,
    title: 'Mount Olympus Orchestral',
  },
  CedarWheel: {
    src: assetPath('/cedar/games/CedarWheel/audio/ambient-solar-temple.wav'),
    targetVolume: 0.38,
    title: 'Solar Temple Sanctuary',
  },
  CedarPlinko: {
    src: assetPath('/cedar/games/CedarPlinko/audio/ambient-prism-cavern.wav'),
    targetVolume: 0.36,
    title: 'Prism Cavern Resonance',
  },
  Lobby: {
    src: assetPath('/audio/ambient-casino-lounge.wav'),
    targetVolume: 0.28,
    title: 'VIP Casino Lounge',
  },
};

const BET_STEPS = [0.2, 0.5, 1, 2, 5, 10, 25, 50, 100];
const WALLET_KEY = 'cedar_demo_wallet_v2';

const SYMBOL_MAP: Record<string, { name: string; asset: string; tier: string }> =
  Object.fromEntries(
    CEDARCULES_SYMBOLS.map((s) => [s.id, { name: s.name, asset: s.asset, tier: s.tier }])
  );

const CATALOG_SHOWCASE = [
  { title: 'Big Bass Bonanza', provider: 'Pragmatic Play', rtp: '96.7%', thumb: assetPath('/frontend/Default/ico/BigBassBonanza.jpg') },
  { title: 'Starlight Princess', provider: 'Pragmatic Play', rtp: '96.5%', thumb: assetPath('/frontend/Default/ico/StarlightPrincess.jpg') },
  { title: 'Book of Nile', provider: 'NetGame', rtp: '96.1%', thumb: assetPath('/frontend/Default/ico/BookOfNileNG.jpg') },
  { title: 'Hercules Son of Zeus', provider: 'Pragmatic Play', rtp: '95.2%', thumb: assetPath('/frontend/Default/ico/HerculesonofZeus.jpg') },
  { title: 'Ancient Egypt Classic', provider: 'Pragmatic Play', rtp: '96.5%', thumb: assetPath('/frontend/Default/ico/AncientEgyptClassic.jpg') },
  { title: 'Pyramid King', provider: 'Pragmatic Play', rtp: '96.5%', thumb: assetPath('/frontend/Default/ico/PyramidKing.jpg') },
  { title: 'Book of Tut Respin', provider: 'Pragmatic Play', rtp: '96.5%', thumb: assetPath('/frontend/Default/ico/BookofTutRespin.jpg') },
  { title: 'Day of Dead', provider: 'Pragmatic Play', rtp: '96.5%', thumb: assetPath('/frontend/Default/ico/DayofDead.jpg') },
  { title: 'Clover Gold', provider: 'Pragmatic Play', rtp: '96.5%', thumb: assetPath('/frontend/Default/ico/CloverGold.jpg') },
  { title: 'Hot to Burn', provider: 'Pragmatic Play', rtp: '96.7%', thumb: assetPath('/frontend/Default/ico/HotToBurn.jpg') },
  { title: 'Fire Hot 20', provider: 'Pragmatic Play', rtp: '96.3%', thumb: assetPath('/frontend/Default/ico/FireHot20.jpg') },
  { title: 'Candy Village', provider: 'Pragmatic Play', rtp: '96.5%', thumb: assetPath('/frontend/Default/ico/CandyVillage.jpg') },
];

function readInitialBalance(): number {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    if (raw !== null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  } catch {
    // ignore
  }
  return 50000;
}

function formatMoney(val: number): string {
  return val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export function App() {
  const [mode, setMode] = useState<GameMode>('Cedarcules');
  const [balance, setBalance] = useState<number>(() => readInitialBalance());
  const [betIndex, setBetIndex] = useState<number>(2); // Default $1.00
  const wager = BET_STEPS[betIndex] ?? 1;

  const [lastWin, setLastWin] = useState<number>(0);
  const [busy, setBusy] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Provably Fair state
  const [serverSeed, setServerSeed] = useState<string>(() => randomHex(32));
  const [clientSeed] = useState<string>(() => randomHex(8));
  const [nonce, setNonce] = useState<number>(1);
  const [lastProof, setLastProof] = useState<CedarRoundProof | null>(null);

  // Cedarcules 5x3 state
  const [grid, setGrid] = useState<string[]>([
    '2', '4', '1', '3', '5',
    '6', '2', '3', '4', '7',
    '8', '9', '2', '10', '6',
  ]);
  const [spinningReels, setSpinningReels] = useState<boolean[]>([false, false, false, false, false]);
  const [winningCells, setWinningCells] = useState<Set<number>>(() => new Set());
  const [winLines, setWinLines] = useState<CedarLineWin[]>([]);

  // Solar Wheel state
  const [arcadeRisk, setArcadeRisk] = useState<ArcadeRisk>('medium');
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [wheelMultiplier, setWheelMultiplier] = useState<number | null>(null);

  // Prism Plinko state
  const [plinkoBallPos, setPlinkoBallPos] = useState<{ x: number; y: number } | null>(null);
  const [plinkoHitPeg, setPlinkoHitPeg] = useState<{ x: number; y: number } | null>(null);
  const [plinkoActiveBucket, setPlinkoActiveBucket] = useState<number | null>(null);
  const plinkoAnimRef = useRef<number | null>(null);

  // Audio cache for Cedarcules SFX & Dedicated Ambient Soundscapes
  const audioRef = useRef<Record<string, HTMLAudioElement>>({});
  const ambientAudiosRef = useRef<Record<string, HTMLAudioElement>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const modeRef = useRef<GameMode>(mode);
  modeRef.current = mode;
  const mutedRef = useRef<boolean>(muted);
  mutedRef.current = muted;

  const getAudioCtx = () => {
    if (!audioCtxRef.current && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  };

  const playWheelTick = (frequency = 880) => {
    if (muted) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.035);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // ignore
    }
  };

  const playPlinkoBounce = (row: number) => {
    if (muted) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = 480 + row * 70;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {
      // ignore
    }
  };

  const playArcadeWinChord = (mult: number) => {
    if (muted) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const freqs = mult >= 2 ? [523.25, 659.25, 783.99, 1046.5] : [440, 554.37, 659.25];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, ctx.currentTime + idx * 0.04);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.04);
        osc.stop(ctx.currentTime + 0.48);
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.Audio !== 'function') return;

    // 1. Preload Cedarcules SFX
    const files = CEDARCULES_MANIFEST.audio.files;
    Object.entries(files).forEach(([key, path]) => {
      if (key === 'ambient_loop') return;
      const audio = new window.Audio(path);
      audio.preload = 'auto';
      audio.volume = 0.65;
      audioRef.current[key] = audio;
    });

    // 2. Preload distinct ambient loops for EACH game
    Object.entries(AMBIENT_SOUNDSCAPES).forEach(([gMode, cfg]) => {
      const bg = new window.Audio(cfg.src);
      bg.preload = 'auto';
      bg.loop = true;
      bg.volume = cfg.targetVolume;
      ambientAudiosRef.current[gMode] = bg;
    });

    (window as unknown as { __ambientAudios?: Record<string, HTMLAudioElement> }).__ambientAudios =
      ambientAudiosRef.current;

    // 3. User interaction unlock (ensures mobile/desktop browsers allow audio playback)
    const unlockAndPlay = () => {
      if (!mutedRef.current) {
        const cur = ambientAudiosRef.current[modeRef.current];
        if (cur && cur.paused) {
          cur.play().catch(() => {});
        }
      }
    };

    window.addEventListener('pointerdown', unlockAndPlay, { passive: true });
    window.addEventListener('click', unlockAndPlay, { passive: true });
    window.addEventListener('keydown', unlockAndPlay, { passive: true });
    window.addEventListener('touchstart', unlockAndPlay, { passive: true });

    const onVisibility = () => {
      if (document.hidden || mutedRef.current) {
        Object.values(ambientAudiosRef.current).forEach((a) => a.pause());
      } else {
        const cur = ambientAudiosRef.current[modeRef.current];
        if (cur && cur.paused) {
          cur.play().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pointerdown', unlockAndPlay);
      window.removeEventListener('click', unlockAndPlay);
      window.removeEventListener('keydown', unlockAndPlay);
      window.removeEventListener('touchstart', unlockAndPlay);
      document.removeEventListener('visibilitychange', onVisibility);
      Object.values(ambientAudiosRef.current).forEach((a) => a.pause());
    };
  }, []);

  // Ensure each game mode plays its own distinct ambient soundscape
  useEffect(() => {
    if (muted) {
      Object.values(ambientAudiosRef.current).forEach((a) => a.pause());
      return;
    }

    Object.entries(ambientAudiosRef.current).forEach(([gMode, audio]) => {
      if (gMode === mode) {
        const targetVol = AMBIENT_SOUNDSCAPES[gMode as GameMode]?.targetVolume ?? 0.35;
        audio.volume = targetVol;
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    });
  }, [muted, mode]);

  const toggleSound = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (!nextMuted) {
      const cur = ambientAudiosRef.current[mode];
      if (cur && cur.paused) {
        cur.volume = AMBIENT_SOUNDSCAPES[mode]?.targetVolume ?? 0.35;
        cur.play().catch(() => {});
      }
    } else {
      Object.values(ambientAudiosRef.current).forEach((a) => a.pause());
    }
  };

  const playSound = (key: string) => {
    if (muted) return;
    const sound = audioRef.current[key];
    if (!sound) return;
    try {
      sound.currentTime = 0;
      const p = sound.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      // ignore autoplay restrictions
    }
  };

  const updateWallet = (next: number) => {
    const clean = Math.max(0, Math.round(next * 100) / 100);
    setBalance(clean);
    try {
      localStorage.setItem(WALLET_KEY, clean.toFixed(2));
    } catch {
      // ignore
    }
    return clean;
  };

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const handleAddCoins = () => {
    playSound('button_click');
    updateWallet(balance + 50000);
    triggerToast('+$50,000.00 acreditados');
  };

  const stepBet = (delta: number) => {
    if (busy) return;
    playSound('button_click');
    setBetIndex((prev) => Math.max(0, Math.min(BET_STEPS.length - 1, prev + delta)));
  };

  // Spin handler for Cedarcules 5x3
  const handleCedarculesSpin = async () => {
    if (busy) return;
    if (balance < wager) {
      handleAddCoins();
      return;
    }

    setBusy(true);
    setWinningCells(new Set());
    setWinLines([]);
    setLastWin(0);
    playSound('reel_start');

    const afterBetBalance = updateWallet(balance - wager);
    setSpinningReels([true, true, true, true, true]);

    const currentSeed = serverSeed;
    const currentNonce = nonce;
    const committedHash = await sha256Hex(currentSeed);

    const nextGrid = await generateWeightedGrid(
      CEDARCULES_MATH.reel_weights,
      CEDARCULES_MATH.rows,
      currentSeed,
      clientSeed,
      currentNonce
    );

    const evaluation = evaluateLines(
      nextGrid,
      CEDARCULES_MATH.rows,
      CEDARCULES_MATH.paylines,
      CEDARCULES_MATH.paytable,
      CEDARCULES_MATH.wild,
      wager / CEDARCULES_MATH.paylines.length
    );

    const totalWin = Math.min(CEDARCULES_MANIFEST.max_payout, Number(evaluation.TotalWin));

    // Stop reels sequentially (0 -> 4) for authentic slot feel
    for (let r = 0; r < 5; r++) {
      await new Promise((res) => setTimeout(res, r === 0 ? 420 : 170));
      setGrid((prev) => {
        const copy = [...prev];
        for (let row = 0; row < 3; row++) {
          copy[row * 5 + r] = nextGrid[row * 5 + r];
        }
        return copy;
      });
      setSpinningReels((prev) => {
        const copy = [...prev];
        copy[r] = false;
        return copy;
      });
      playSound(`reel_stop_${(r % 3) + 1}`);
    }

    const winPos = new Set<number>();
    evaluation.WinLines.forEach((wl) => wl.Positions.forEach((p) => winPos.add(p)));
    setWinningCells(winPos);
    setWinLines(evaluation.WinLines);

    if (totalWin > 0) {
      updateWallet(afterBetBalance + totalWin);
      setLastWin(totalWin);
      playSound(totalWin >= wager * 15 ? 'win_large' : totalWin >= wager * 4 ? 'win_medium' : 'win_small');
    } else {
      playSound('result_no_win');
    }

    const proof: CedarRoundProof = {
      bet_id: randomHex(8),
      game: 'Cedarcules',
      math_version: 'cedar-slot-v1',
      server_seed: currentSeed,
      server_seed_hash: committedHash,
      client_seed: clientSeed,
      nonce: currentNonce,
      parameters: CEDARCULES_MATH,
      wager,
      win: totalWin,
      outcome: {
        grid: nextGrid,
        total_win: totalWin.toFixed(2),
        line_wins: evaluation.WinLines,
      },
    };
    verifyCedarSlotProof(proof).catch(() => {});

    setServerSeed(randomHex(32));
    setNonce((n) => n + 1);
    setBusy(false);
  };

  // Spin handler for Solar Wheel
  const handleWheelSpin = async () => {
    if (busy) return;
    if (balance < wager) {
      handleAddCoins();
      return;
    }

    setBusy(true);
    setWheelMultiplier(null);
    setLastWin(0);

    const afterBetBalance = updateWallet(balance - wager);
    const outcome = await runWheelSpin(wager, arcadeRisk, 10, serverSeed, clientSeed, nonce);

    // Realistic mechanical wheel ticking
    const tickDelays = [40, 80, 130, 190, 260, 340, 440, 560, 710, 890, 1100, 1350, 1650, 2000, 2400];
    tickDelays.forEach((t, i) => {
      setTimeout(() => {
        playWheelTick(760 + (i % 2) * 160);
      }, t);
    });

    // 10 segments -> 36deg per slice. Align winningIndex under top pointer (0deg)
    const sliceAngle = 360 / 10;
    const targetSliceCenter = outcome.winningIndex * sliceAngle + sliceAngle / 2;
    const extraSpins = 5 * 360;
    const currentMod = ((wheelRotation % 360) + 360) % 360;
    const desiredMod = (360 - targetSliceCenter + 360) % 360;
    const delta = ((desiredMod - currentMod + 360) % 360) + extraSpins;
    const nextRot = wheelRotation + delta;

    setWheelRotation(nextRot);

    await new Promise((res) => setTimeout(res, 2600));
    setWheelMultiplier(outcome.multiplier);

    if (outcome.win > 0) {
      updateWallet(afterBetBalance + outcome.win);
      setLastWin(outcome.win);
      playArcadeWinChord(outcome.multiplier);
    } else {
      playSound('result_no_win');
    }

    setServerSeed(randomHex(32));
    setNonce((n) => n + 1);
    setBusy(false);
  };

  // Drop handler for Prism Plinko with continuous parabolic physics animation
  const handlePlinkoDrop = async () => {
    if (busy) return;
    if (balance < wager) {
      handleAddCoins();
      return;
    }

    setBusy(true);
    setPlinkoActiveBucket(null);
    setPlinkoHitPeg(null);
    setLastWin(0);

    const afterBetBalance = updateWallet(balance - wager);
    const outcome = await runPlinkoDrop(wager, arcadeRisk, 8, serverSeed, clientSeed, nonce);

    // Build keyframe path segments
    const startY = 28;
    const dy = 28;
    const segments: Array<{
      from: { x: number; y: number };
      to: { x: number; y: number };
      arcHeight: number;
      durationMs: number;
      onHit?: () => void;
    }> = [];

    // 1. Initial drop from top (210, 6) down to row 0 center peg (210, 28)
    segments.push({
      from: { x: 210, y: 6 },
      to: { x: 210, y: 28 },
      arcHeight: 0,
      durationMs: 140,
      onHit: () => {
        playPlinkoBounce(0);
        setPlinkoHitPeg({ x: 210, y: 28 });
      },
    });

    // 2. Trajectory through the pegs (rows 0 to 6)
    let currentX = 210;
    for (let r = 0; r < outcome.directions.length - 1; r++) {
      const dir = outcome.directions[r];
      const nextX = dir === 1 ? currentX + 18 : currentX - 18;
      const fromY = startY + r * dy;
      const toY = startY + (r + 1) * dy;
      const capturedRow = r;
      const capturedToX = nextX;
      const capturedToY = toY;

      segments.push({
        from: { x: currentX, y: fromY },
        to: { x: nextX, y: toY },
        arcHeight: 10, // Natural parabolic bounce over peg
        durationMs: 165,
        onHit: () => {
          playPlinkoBounce(capturedRow + 1);
          setPlinkoHitPeg({ x: capturedToX, y: capturedToY });
        },
      });

      currentX = nextX;
    }

    // 3. Final drop from row 7 peg into the winning bucket
    const targetBucketX = 66 + outcome.slotIndex * 36;
    const targetBucketY = 280;
    segments.push({
      from: { x: currentX, y: startY + 7 * dy },
      to: { x: targetBucketX, y: targetBucketY },
      arcHeight: 7,
      durationMs: 200,
      onHit: () => {
        setPlinkoActiveBucket(outcome.slotIndex);
        playArcadeWinChord(outcome.multiplier);
      },
    });

    // Execute 60/120fps continuous sub-pixel animation
    for (const seg of segments) {
      const startT = performance.now();
      await new Promise<void>((resolve) => {
        function step(now: number) {
          const elapsed = now - startT;
          const progress = Math.min(1, elapsed / seg.durationMs);

          const x = seg.from.x + (seg.to.x - seg.from.x) * progress;
          const y =
            seg.from.y +
            (seg.to.y - seg.from.y) * progress -
            Math.sin(progress * Math.PI) * seg.arcHeight;

          setPlinkoBallPos({ x, y });

          if (progress < 1) {
            plinkoAnimRef.current = requestAnimationFrame(step);
          } else {
            if (seg.onHit) seg.onHit();
            resolve();
          }
        }
        plinkoAnimRef.current = requestAnimationFrame(step);
      });
    }

    // Brief celebration rest inside bucket
    await new Promise((res) => setTimeout(res, 220));
    setPlinkoBallPos(null);
    setPlinkoHitPeg(null);

    if (outcome.win > 0) {
      updateWallet(afterBetBalance + outcome.win);
      setLastWin(outcome.win);
    }

    setServerSeed(randomHex(32));
    setNonce((n) => n + 1);
    setBusy(false);
  };

  const handlePrimaryAction = () => {
    if (mode === 'Cedarcules') handleCedarculesSpin();
    else if (mode === 'CedarWheel') handleWheelSpin();
    else if (mode === 'CedarPlinko') handlePlinkoDrop();
  };

  // Keyboard spacebar support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && mode !== 'Lobby') {
        e.preventDefault();
        handlePrimaryAction();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const wheelTable = useMemo(() => WHEEL_MULTIPLIERS[10][arcadeRisk], [arcadeRisk]);
  const plinkoTable = useMemo(() => PLINKO_MULTIPLIERS[8][arcadeRisk], [arcadeRisk]);

  return (
    <div className={`luxe-app is-${mode.toLowerCase()}`}>
      {/* ====================================================================
          MINIMALIST LUXURY FLOATING TOPBAR
          ==================================================================== */}
      <header className="luxe-topbar">
        <button
          type="button"
          className="luxe-brand"
          onClick={() => setMode('Cedarcules')}
          title="Cedar Social Casino"
        >
          <img src={assetPath('/minimal/logo.png')} alt="Cedar" className="luxe-brand-img" />
          <div className="luxe-brand-text">
            <strong>CEDAR</strong>
            <span>ROYAL CASINO</span>
          </div>
        </button>

        <nav className="luxe-switcher" aria-label="Selector de juego">
          <button
            type="button"
            className={`luxe-tab ${mode === 'Cedarcules' ? 'is-active' : ''}`}
            onClick={() => setMode('Cedarcules')}
          >
            Cedarcules
          </button>
          <button
            type="button"
            className={`luxe-tab ${mode === 'CedarWheel' ? 'is-active' : ''}`}
            onClick={() => setMode('CedarWheel')}
          >
            Solar Wheel
          </button>
          <button
            type="button"
            className={`luxe-tab ${mode === 'CedarPlinko' ? 'is-active' : ''}`}
            onClick={() => setMode('CedarPlinko')}
          >
            Prism Plinko
          </button>
          <button
            type="button"
            className={`luxe-tab ${mode === 'Lobby' ? 'is-active' : ''}`}
            onClick={() => setMode('Lobby')}
          >
            Catálogo
          </button>
        </nav>

        <div className="luxe-topbar-right">
          <div className="luxe-wallet-pill">
            <span className="luxe-wallet-currency">$</span>
            <strong className="luxe-wallet-amount">{formatMoney(balance)}</strong>
            <button
              type="button"
              className="luxe-wallet-plus"
              onClick={handleAddCoins}
              title="Recargar +$50,000 de demostración"
              aria-label="Recargar saldo"
            >
              +
            </button>
          </div>
        </div>
      </header>

      {toast && <div className="luxe-toast">{toast}</div>}

      {/* ====================================================================
          STAGE AREA (FULL-BLEED GAME OR LOBBY)
          ==================================================================== */}
      {mode === 'Lobby' ? (
        <main className="luxe-lobby">
          <section className="luxe-Featured-section">
            <div className="luxe-section-header">
              <span>EXPERIENCIA INTERACTIVA</span>
              <h2>Juegos Activos en la Demo</h2>
            </div>

            <div className="luxe-featured-grid">
              <article className="luxe-featured-card" onClick={() => setMode('Cedarcules')}>
                <div className="luxe-featured-art">
                  <img src={assetPath('/frontend/Default/ico/Cedarcules.jpg')} alt="Cedarcules" />
                  <span className="luxe-rtp-tag">RTP 96.2%</span>
                </div>
                <div className="luxe-featured-meta">
                  <div>
                    <h3>Cedarcules · Mount Olympus</h3>
                    <p>Slot 5×3 · 20 Líneas · Wilds Multiplicadores</p>
                  </div>
                  <span className="luxe-play-cta">Jugar</span>
                </div>
              </article>

              <article className="luxe-featured-card" onClick={() => setMode('CedarWheel')}>
                <div className="luxe-featured-art">
                  <img src={assetPath('/cedar/games/CedarWheel/cover.png')} alt="Solar Wheel" />
                  <span className="luxe-rtp-tag">RTP 95.0%</span>
                </div>
                <div className="luxe-featured-meta">
                  <div>
                    <h3>Solar Wheel</h3>
                    <p>Ruleta de Multiplicadores · Riesgo Ajustable</p>
                  </div>
                  <span className="luxe-play-cta">Jugar</span>
                </div>
              </article>

              <article className="luxe-featured-card" onClick={() => setMode('CedarPlinko')}>
                <div className="luxe-featured-art">
                  <img src={assetPath('/cedar/games/CedarPlinko/cover.png')} alt="Prism Plinko" />
                  <span className="luxe-rtp-tag">RTP 95.0%</span>
                </div>
                <div className="luxe-featured-meta">
                  <div>
                    <h3>Prism Plinko</h3>
                    <p>Pirámide de Cristal · Premios hasta 27.75×</p>
                  </div>
                  <span className="luxe-play-cta">Jugar</span>
                </div>
              </article>
            </div>
          </section>

          <section className="luxe-catalog-section">
            <div className="luxe-section-header">
              <span>CATÁLOGO DE TRAGAMONEDAS</span>
              <h2>Títulos Populares de la Plataforma</h2>
            </div>
            <div className="luxe-catalog-grid">
              {CATALOG_SHOWCASE.map((item) => (
                <article
                  key={item.title}
                  className="luxe-catalog-tile"
                  onClick={() => setMode('Cedarcules')}
                >
                  <div className="luxe-catalog-img">
                    <img src={item.thumb} alt={item.title} loading="lazy" />
                    <span>{item.rtp}</span>
                  </div>
                  <div className="luxe-catalog-caption">
                    <strong>{item.title}</strong>
                    <small>{item.provider}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      ) : (
        <main className={`luxe-stage is-${mode.toLowerCase()}`}>
          {/* ================================================================
              1. CEDARCULES 5x3 OLYMPUS SLOT CABINET
              ================================================================ */}
          {mode === 'Cedarcules' && (
            <div className="luxe-slot-centerpiece">
              <div className={`luxe-reel-cabinet ${winningCells.size > 0 ? 'has-win' : ''}`}>
                <img
                  src={assetPath('/cedar/games/Cedarcules/assets/frame.png')}
                  alt=""
                  className="luxe-cabinet-frame"
                />
                <div className="luxe-symbol-grid">
                  {grid.map((symId, idx) => {
                    const col = idx % 5;
                    const isSpinning = spinningReels[col];
                    const isWinner = winningCells.has(idx);
                    const hasAnyWin = winningCells.size > 0;
                    const sym = SYMBOL_MAP[symId] || SYMBOL_MAP['2'];
                    return (
                      <div
                        key={idx}
                        className={[
                          'luxe-symbol-cell',
                          `tier-${sym.tier}`,
                          isSpinning ? 'is-spinning' : '',
                          isWinner ? 'is-winner' : '',
                          hasAnyWin && !isWinner ? 'is-dimmed' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <img src={sym.asset} alt={sym.name} draggable={false} />
                        {symId === '1' && <span className="luxe-wild-badge">WILD</span>}
                      </div>
                    );
                  })}
                </div>

                {lastWin > 0 && !busy && (
                  <div className="luxe-win-banner" role="status">
                    <span>PREMIO OLÍMPICO</span>
                    <strong>+${formatMoney(lastWin)}</strong>
                    {winLines.length > 0 && (
                      <small>
                        {winLines.length} {winLines.length === 1 ? 'línea ganadora' : 'líneas ganadoras'}
                      </small>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================
              2. SOLAR WHEEL (BESPOKE 3D GOLDEN WHEEL)
              ================================================================ */}
          {mode === 'CedarWheel' && (
            <div className="luxe-arcade-centerpiece">
              <div className="luxe-risk-selector" role="group" aria-label="Nivel de riesgo">
                {(['low', 'medium', 'high'] as ArcadeRisk[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={busy}
                    className={`luxe-risk-pill ${arcadeRisk === r ? 'is-active' : ''}`}
                    onClick={() => setArcadeRisk(r)}
                  >
                    {r === 'low' ? 'Riesgo Bajo' : r === 'medium' ? 'Riesgo Medio' : 'Riesgo Alto'}
                  </button>
                ))}
              </div>

              <div className="luxe-wheel-frame">
                <div className="luxe-wheel-pointer" aria-hidden="true">
                  <svg viewBox="0 0 40 48" width="38" height="44">
                    <defs>
                      <linearGradient id="ptrGold" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fff6b3" />
                        <stop offset="55%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#78350f" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M20 46 L4 10 C4 4 10 2 20 2 C30 2 36 4 36 10 Z"
                      fill="url(#ptrGold)"
                      stroke="#fffbeb"
                      strokeWidth="2"
                    />
                  </svg>
                </div>

                <svg
                  viewBox="0 0 360 360"
                  className="luxe-wheel-svg"
                  style={{
                    transform: `rotate(${wheelRotation}deg)`,
                  }}
                >
                  <defs>
                    <radialGradient id="wheelRim" cx="50%" cy="50%" r="50%">
                      <stop offset="86%" stopColor="#78350f" />
                      <stop offset="95%" stopColor="#f5c451" />
                      <stop offset="100%" stopColor="#fff3b0" />
                    </radialGradient>
                  </defs>
                  <circle cx="180" cy="180" r="174" fill="url(#wheelRim)" />
                  <circle cx="180" cy="180" r="160" fill="#070c18" stroke="#f5c451" strokeWidth="2.5" />

                  {wheelTable.map((mult, i) => {
                    const startAngle = i * 36;
                    const endAngle = (i + 1) * 36;
                    const midAngle = startAngle + 18;
                    const labelPos = polarToCartesian(180, 180, 114, midAngle);
                    const fill =
                      mult === 0
                        ? '#111a2e'
                        : mult >= 2.5
                          ? '#b45309'
                          : mult >= 1.5
                            ? '#4c1d95'
                            : '#1e3a5f';
                    return (
                      <g key={i}>
                        <path
                          d={describeSlice(180, 180, 158, startAngle, endAngle)}
                          fill={fill}
                          stroke="rgba(245, 196, 81, 0.35)"
                          strokeWidth="1.5"
                        />
                        <text
                          x={labelPos.x}
                          y={labelPos.y}
                          fill={mult > 0 ? '#fffbeb' : '#64748b'}
                          fontSize="13.5"
                          fontWeight="900"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${midAngle}, ${labelPos.x}, ${labelPos.y})`}
                        >
                          {mult}×
                        </text>
                      </g>
                    );
                  })}

                  <circle cx="180" cy="180" r="42" fill="#0b1324" stroke="#f5c451" strokeWidth="4" />
                  <circle cx="180" cy="180" r="32" fill="#1e293b" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                </svg>

                <div className="luxe-wheel-hub">
                  {wheelMultiplier !== null && !busy ? (
                    <strong>{wheelMultiplier}×</strong>
                  ) : (
                    <span>☀</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              3. PRISM PLINKO (CRYSTAL PEG PYRAMID)
              ================================================================ */}
          {mode === 'CedarPlinko' && (
            <div className="luxe-arcade-centerpiece">
              <div className="luxe-risk-selector" role="group" aria-label="Nivel de riesgo">
                {(['low', 'medium', 'high'] as ArcadeRisk[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={busy}
                    className={`luxe-risk-pill ${arcadeRisk === r ? 'is-active' : ''}`}
                    onClick={() => setArcadeRisk(r)}
                  >
                    {r === 'low' ? 'Riesgo Bajo' : r === 'medium' ? 'Riesgo Medio' : 'Riesgo Alto'}
                  </button>
                ))}
              </div>

              <div className="luxe-plinko-board">
                <svg viewBox="0 0 420 320" className="luxe-plinko-svg">
                  <defs>
                    <radialGradient id="prismBallGlow" cx="35%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="25%" stopColor="#fef08a" />
                      <stop offset="60%" stopColor="#f59e0b" />
                      <stop offset="90%" stopColor="#d97706" />
                      <stop offset="100%" stopColor="#78350f" />
                    </radialGradient>
                    <radialGradient id="prismAura" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="rgba(253, 224, 71, 0.65)" />
                      <stop offset="50%" stopColor="rgba(245, 158, 11, 0.22)" />
                      <stop offset="100%" stopColor="rgba(245, 158, 11, 0)" />
                    </radialGradient>
                    <linearGradient id="bucketHigh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fde047" />
                      <stop offset="50%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#b45309" />
                    </linearGradient>
                    <linearGradient id="bucketMid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c084fc" />
                      <stop offset="50%" stopColor="#7c3aed" />
                      <stop offset="100%" stopColor="#4c1d95" />
                    </linearGradient>
                    <linearGradient id="bucketLow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#334155" />
                      <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>
                    <filter id="ballBloom" x="-40%" y="-40%" width="180%" height="180%">
                      <feGaussianBlur stdDeviation="3.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <filter id="bucketGlow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* 1. Crystal Pegs Pyramid (8 rows) */}
                  {Array.from({ length: 8 }, (_, r) => {
                    const count = r + 3;
                    const y = 28 + r * 28;
                    const spacing = 36;
                    const startX = 210 - ((count - 1) * spacing) / 2;
                    return Array.from({ length: count }, (__, c) => {
                      const x = startX + c * spacing;
                      const isHit =
                        plinkoHitPeg &&
                        Math.abs(plinkoHitPeg.x - x) < 3 &&
                        Math.abs(plinkoHitPeg.y - y) < 3;
                      return (
                        <g key={`${r}-${c}`}>
                          <circle cx={x} cy={y} r="7.5" fill="rgba(245, 196, 81, 0.12)" />
                          <circle
                            cx={x}
                            cy={y}
                            r={isHit ? '5.2' : '3.6'}
                            fill={isHit ? '#ffffff' : '#fef08a'}
                            stroke={isHit ? '#fde047' : 'none'}
                            strokeWidth="1.5"
                          />
                          {isHit && (
                            <circle
                              cx={x}
                              cy={y}
                              r="13"
                              fill="none"
                              stroke="#fde047"
                              strokeWidth="1.8"
                              opacity="0.85"
                            />
                          )}
                        </g>
                      );
                    });
                  })}

                  {/* 2. Responsive Multiplier Buckets inside SVG (Never overflows!) */}
                  {plinkoTable.map((mult, idx) => {
                    const isEdge = idx <= 1 || idx >= plinkoTable.length - 2;
                    const isMid = idx === 2 || idx === plinkoTable.length - 3;
                    const isHit = plinkoActiveBucket === idx;
                    const bx = 51 + idx * 36;
                    const by = 264;
                    const bw = 30;
                    const bh = 34;

                    const fill = isEdge
                      ? 'url(#bucketHigh)'
                      : isMid
                        ? 'url(#bucketMid)'
                        : 'url(#bucketLow)';
                    const stroke = isHit
                      ? '#ffffff'
                      : isEdge
                        ? '#fde047'
                        : isMid
                          ? '#a855f7'
                          : 'rgba(255, 255, 255, 0.18)';

                    return (
                      <g
                        key={idx}
                        className={`luxe-plinko-svg-bucket ${isHit ? 'is-hit' : ''}`}
                        transform={isHit ? `translate(0, -3)` : undefined}
                      >
                        <rect
                          x={bx}
                          y={by}
                          width={bw}
                          height={bh}
                          rx="7"
                          ry="7"
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={isHit ? '2.4' : '1.2'}
                          filter={isHit ? 'url(#bucketGlow)' : undefined}
                        />
                        {isHit && (
                          <rect
                            x={bx}
                            y={by}
                            width={bw}
                            height={bh}
                            rx="7"
                            ry="7"
                            fill="#ffffff"
                            opacity="0.25"
                          />
                        )}
                        <text
                          x={bx + bw / 2}
                          y={by + bh / 2 + 1}
                          fill={isEdge ? '#1c0a00' : '#ffffff'}
                          fontSize="9.2"
                          fontWeight="900"
                          fontFamily="sans-serif"
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {mult}×
                        </text>
                      </g>
                    );
                  })}

                  {/* 3. Smooth Physical Ball with Glow, Aura, and Specular Highlight */}
                  {plinkoBallPos && (
                    <g transform={`translate(${plinkoBallPos.x}, ${plinkoBallPos.y})`}>
                      <circle r="16" fill="url(#prismAura)" />
                      <circle r="9" fill="#fef08a" opacity="0.85" filter="url(#ballBloom)" />
                      <circle r="7.5" fill="url(#prismBallGlow)" stroke="#ffffff" strokeWidth="1.5" />
                      <circle cx="-2.2" cy="-2.2" r="2" fill="#ffffff" opacity="0.95" />
                    </g>
                  )}
                </svg>
              </div>
            </div>
          )}

          {/* ================================================================
              BESPOKE FLOATING BOTTOM CONTROL DOCK (MINIMAL BUTTONS, HIGH CRAFT)
              ================================================================ */}
          <section className="luxe-dock" aria-label="Controles de apuesta">
            {/* 1. Left: Stake Stepper */}
            <div className="luxe-dock-bet">
              <button
                type="button"
                className="luxe-metal-btn"
                onClick={() => stepBet(-1)}
                disabled={busy || betIndex === 0}
                aria-label="Disminuir apuesta"
              >
                −
              </button>
              <div className="luxe-dock-readout">
                <span>APUESTA</span>
                <strong>${formatMoney(wager)}</strong>
              </div>
              <button
                type="button"
                className="luxe-metal-btn"
                onClick={() => stepBet(1)}
                disabled={busy || betIndex === BET_STEPS.length - 1}
                aria-label="Aumentar apuesta"
              >
                +
              </button>
            </div>

            {/* 2. Center: Hero 3D Circular Spin Button */}
            <button
              type="button"
              className={`luxe-spin-orb ${busy ? 'is-busy' : ''}`}
              onClick={handlePrimaryAction}
              disabled={busy}
              aria-label="Girar"
            >
              <span className="luxe-spin-ring" />
              <span className="luxe-spin-core">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 0 0-15.36-6.36L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 15.36 6.36L21 16" />
                  <path d="M21 21v-5h-5" />
                </svg>
              </span>
            </button>

            {/* 3. Right: Last Win + Mute Icon */}
            <div className="luxe-dock-win">
              <div className={`luxe-dock-readout ${lastWin > 0 ? 'is-win' : ''}`}>
                <span>GANANCIA</span>
                <strong>${formatMoney(lastWin)}</strong>
              </div>
              <button
                type="button"
                className={`luxe-metal-btn luxe-mute-btn ${muted ? 'is-muted' : ''}`}
                onClick={toggleSound}
                aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
                title={muted ? 'Activar sonido' : 'Silenciar sonido'}
              >
                {muted ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M23 9l-6 6M17 9l6 6" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

export default App;

