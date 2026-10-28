(function () {
    'use strict';
    let game = null;
    const loader = document.getElementById('cedar-loader');
    const message = document.getElementById('cedar-loader-message');
    const app = document.getElementById('cedar-slot');
    const grid = document.getElementById('cedar-grid');
    const spin = document.getElementById('cedar-spin');
    const speed = document.getElementById('cedar-speed');
    const controls = document.querySelector('.cedar-controls');
    const wager = document.getElementById('cedar-wager');
    const balance = document.getElementById('cedar-balance');
    const win = document.getElementById('cedar-win');
    const result = document.getElementById('cedar-result');
    let config = null;
    let busy = false;
    let audioContext = null;
    let audioFiles = {};
    let effectsMuted = false;
    let musicMuted = true;
    let fastSpin = false;

    try { fastSpin = window.localStorage.getItem('cedar-fast-spin') === '1'; } catch (_) {}

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const deadline = (promise, ms, label) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms))
    ]);
    const money = value => Number(value || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const expectedGame = () => {
        const bootstrap = document.querySelector('script[data-game][src*="promex-html-game.js"]');
        return bootstrap ? bootstrap.getAttribute('data-game') : null;
    };
    const waitForGame = () => {
        if (window.PromexHtmlGame) return Promise.resolve(window.PromexHtmlGame);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                cleanup();
                reject(new Error('Licensed game bootstrap is unavailable.'));
            }, 15000);
            const cleanup = () => {
                clearTimeout(timer);
                window.removeEventListener('promex:game-ready', onReady);
                window.removeEventListener('promex:game-error', onError);
            };
            const onReady = () => {
                if (!window.PromexHtmlGame) return;
                cleanup();
                resolve(window.PromexHtmlGame);
            };
            const onError = event => {
                cleanup();
                reject(event.detail && event.detail.error ? event.detail.error : new Error('Secure game runtime failed.'));
            };
            window.addEventListener('promex:game-ready', onReady);
            window.addEventListener('promex:game-error', onError);
        });
    };
    const addCss = (id, path) => {
        if (!path || document.getElementById(id)) return;
        const link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; link.href = path; document.head.appendChild(link);
    };
    const cells = () => Array.from(grid.children);
    function renderCell(cell, index, values, winners) {
        const symbol = String(values[index] ?? 9);
        const art = config && config.assets && config.assets.symbols ? config.assets.symbols[symbol] : null;
        cell.dataset.symbol = symbol;
        cell.classList.toggle('has-art', Boolean(art));
        cell.style.backgroundImage = art ? `url("${art}")` : '';
        cell.classList.toggle('winner', winners.has(index));
    }
    function render(values, winningPositions, reel = null) {
        const winners = new Set(winningPositions || []);
        cells().forEach((cell, index) => {
            if (reel === null || index % config.math.reel_weights.length === reel) renderCell(cell, index, values, winners);
        });
    }
    function tone(frequency, duration, type, gain, delay) {
        if (!config || !config.audio || config.audio.mode !== 'procedural') return;
        try {
            audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
            const start = audioContext.currentTime + (delay || 0);
            const oscillator = audioContext.createOscillator();
            const volume = audioContext.createGain();
            oscillator.type = type || 'sine'; oscillator.frequency.setValueAtTime(frequency, start);
            volume.gain.setValueAtTime(gain || 0.035, start); volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
            oscillator.connect(volume).connect(audioContext.destination); oscillator.start(start); oscillator.stop(start + duration);
        } catch (_) {}
    }
    const audioEnabled = () => config && config.audio && config.audio.mode === 'files';
    function setStored(key, value) {
        try { window.localStorage.setItem(key, value ? '1' : '0'); } catch (_) {}
    }
    function safePlay(audio) {
        if (!audio) return;
        const playback = audio.play();
        if (playback && typeof playback.catch === 'function') playback.catch(() => {});
    }
    function playEffect(event, options = {}) {
        const audio = audioFiles[event];
        if (!audio || effectsMuted) return;
        if (options.restart !== false) {
            try { audio.currentTime = 0; } catch (_) {}
        }
        safePlay(audio);
    }
    function stopSound(event) {
        const audio = audioFiles[event];
        if (!audio) return;
        audio.pause();
        try { audio.currentTime = 0; } catch (_) {}
    }
    function stopAllAudio() {
        Object.values(audioFiles).forEach(audio => {
            audio.pause();
            try { audio.currentTime = 0; } catch (_) {}
        });
    }
    function syncAudioButtons() {
        const effects = document.getElementById('cedar-effects-audio');
        const music = document.getElementById('cedar-music-audio');
        if (effects) { effects.textContent = effectsMuted ? 'SFX OFF' : 'SFX ON'; effects.setAttribute('aria-pressed', effectsMuted ? 'false' : 'true'); }
        if (music) { music.textContent = musicMuted ? 'MUSIC OFF' : 'MUSIC ON'; music.setAttribute('aria-pressed', musicMuted ? 'false' : 'true'); }
    }
    function setEffectsMuted(muted) {
        effectsMuted = muted;
        setStored('cedar-effects-muted', effectsMuted);
        if (effectsMuted) Object.keys(audioFiles).filter(key => key !== 'ambient_loop').forEach(stopSound);
        syncAudioButtons();
    }
    function setMusicMuted(muted) {
        musicMuted = muted;
        setStored('cedar-music-muted', musicMuted);
        if (musicMuted) stopSound('ambient_loop');
        else safePlay(audioFiles.ambient_loop);
        syncAudioButtons();
    }
    function prepareFileAudio() {
        if (!audioEnabled() || typeof window.Audio !== 'function') return;
        try {
            effectsMuted = window.localStorage.getItem('cedar-effects-muted') === '1';
            const storedMusic = window.localStorage.getItem('cedar-music-muted');
            musicMuted = storedMusic === null ? true : storedMusic === '1';
        } catch (_) {}
        Object.entries(config.audio.files || {}).forEach(([event, path]) => {
            const audio = new window.Audio(path);
            audio.preload = event === 'ambient_loop' ? 'none' : 'auto';
            audio.loop = event === 'reel_loop' || event === 'ambient_loop';
            audio.volume = event === 'ambient_loop' ? 0.35 : 1;
            audioFiles[event] = audio;
        });
        if (controls) {
            const group = document.createElement('div'); group.className = 'cedar-audio-controls';
            const effects = document.createElement('button'); effects.id = 'cedar-effects-audio'; effects.className = 'cedar-audio-toggle'; effects.type = 'button';
            const music = document.createElement('button'); music.id = 'cedar-music-audio'; music.className = 'cedar-audio-toggle'; music.type = 'button';
            effects.addEventListener('click', () => setEffectsMuted(!effectsMuted));
            music.addEventListener('click', () => setMusicMuted(!musicMuted));
            group.appendChild(effects); group.appendChild(music); controls.appendChild(group);
        }
        syncAudioButtons();
    }
    function startSpinAudio() {
        if (audioEnabled()) {
            playEffect('reel_start');
            playEffect('reel_loop');
        } else {
            tone(110, .22, 'sawtooth', .025); tone(165, .18, 'triangle', .02, .12);
        }
    }
    function playResultAudio(amount, stake) {
        if (!audioEnabled()) {
            if (amount > 0) { tone(523.25, .34, 'sine', .05); tone(659.25, .42, 'sine', .04, .12); tone(783.99, .5, 'sine', .035, .24); }
            else tone(146.83, .18, 'triangle', .025);
            return;
        }
        if (amount <= 0) { playEffect('result_no_win'); return; }
        const multiplier = stake > 0 ? amount / stake : 0;
        const tiers = config.audio.win_tiers || {};
        const event = multiplier >= Number(tiers.large_multiplier || 20) ? 'win_large'
            : multiplier >= Number(tiers.medium_multiplier || 5) ? 'win_medium' : 'win_small';
        playEffect(event);
    }
    function randomGrid() {
        const symbols = Object.keys(config.math.symbols || {9: 'A', 10: 'K', 11: 'Q', 12: 'J'});
        return Array.from({length: config.math.rows * config.math.reel_weights.length}, () => symbols[Math.floor(Math.random() * symbols.length)]);
    }
    async function animate(serverPromise) {
        const timing = fastSpin ? {minimum: 1050, reelStop: 145} : {minimum: 1750, reelStop: 250};
        cells().forEach(cell => cell.classList.add('spinning'));
        const ticker = setInterval(() => render(randomGrid(), []), 90);
        const [data] = await Promise.all([serverPromise, sleep(timing.minimum)]);
        clearInterval(ticker);
        let wildCuePlayed = false;
        for (let reel = 0; reel < config.math.reel_weights.length; reel++) {
            render(data.grid, [], reel);
            cells().forEach((cell, index) => {
                if (index % config.math.reel_weights.length === reel) cell.classList.remove('spinning');
            });
            if (audioEnabled()) playEffect(`reel_stop_${reel % 3 + 1}`);
            if (!wildCuePlayed && audioFiles.wild_land && data.grid.some((symbol, index) => index % config.math.reel_weights.length === reel && String(symbol) === String(config.math.wild))) {
                playEffect('wild_land'); wildCuePlayed = true;
            }
            await sleep(timing.reelStop);
        }
        if (audioEnabled()) stopSound('reel_loop');
        return data;
    }
    function showSpeed() {
        if (!speed) return;
        speed.setAttribute('aria-pressed', fastSpin ? 'true' : 'false');
        speed.textContent = fastSpin ? 'FAST ON' : 'FAST OFF';
    }
    if (speed) speed.addEventListener('click', () => {
        fastSpin = !fastSpin;
        try { window.localStorage.setItem('cedar-fast-spin', fastSpin ? '1' : '0'); } catch (_) {}
        showSpeed();
        playEffect('fast_toggle');
    });
    if (wager) wager.addEventListener('change', () => playEffect('button_click'));
    showSpeed();
    function fail(error) {
        if (typeof window.cedarBootError === 'function') window.cedarBootError(error);
        loader.classList.add('is-error');
        message.innerHTML = `${error.message || 'Unable to open this game.'}<br><a href="/">Return to the lobby</a>`;
        spin.disabled = false; busy = false;
    }
    async function boot() {
        try {
            game = await waitForGame();
            const declaredGame = expectedGame();
            if (!declaredGame || game.game !== declaredGame) throw new Error('Licensed game runtime does not match this title.');
            message.textContent = 'Validating domain license and player session...';
            config = await deadline(game.request('init'), 15000, 'Licensed game session timed out. Reload once; if it repeats, check the browser console.');
            app.style.setProperty('--cedar-columns', String(config.layout && config.layout.columns || config.math.reel_weights.length));
            app.style.setProperty('--cedar-rows', String(config.layout && config.layout.rows || config.math.rows));
            const frame = document.getElementById('cedar-frame');
            if (frame && config.assets && config.assets.frame) frame.src = config.assets.frame;
            addCss('cedar-global-theme', config.brand.theme_css);
            addCss('cedar-game-theme', config.brand.game_theme_css);
            if (config.brand.loader_css && config.brand.loader_css !== document.getElementById('cedar-loader-style').getAttribute('href')) {
                document.getElementById('cedar-loader-style').href = config.brand.loader_css;
            }
            document.getElementById('cedar-brand').textContent = `${config.brand.name} REMAKES`;
            document.getElementById('cedar-title').textContent = config.title;
            document.getElementById('cedar-rtp').textContent = `Published RTP ${Number(config.math.published_rtp).toFixed(1)}%`;
            balance.textContent = money(config.balance);
            (config.bet_steps || []).filter(v => Number(v) >= config.min_bet && Number(v) <= config.max_bet).forEach(value => {
                const option = document.createElement('option'); option.value = value; option.textContent = money(value); wager.appendChild(option);
            });
            const count = config.math.rows * config.math.reel_weights.length;
            for (let i = 0; i < count; i++) { const cell = document.createElement('div'); cell.className = 'symbol'; cell.dataset.symbol = '9'; grid.appendChild(cell); }
            render(randomGrid(), []);
            prepareFileAudio();
            loader.hidden = true; app.hidden = false;
        } catch (error) { fail(error); }
    }
    spin.addEventListener('click', async () => {
        if (busy || !config) return;
        busy = true; spin.disabled = true; result.className = 'cedar-result'; result.textContent = 'The reels are turning...';
        startSpinAudio();
        try {
            const stake = Number(wager.value);
            const data = await animate(game.request('spin', {wager: stake, client_seed: config.client_seed}));
            const positions = (data.line_wins || []).flatMap(line => line.Positions || []);
            render(data.grid, positions); balance.textContent = money(data.balance); win.textContent = money(data.win_amount);
            const amount = Number(data.win_amount);
            result.textContent = amount > 0 ? `Olympus awards ${money(amount)} CEDARS` : 'No win this spin';
            result.classList.toggle('is-win', amount > 0);
            playResultAudio(amount, stake);
            config.server_seed_hash = data.next_server_seed_hash; config.client_seed = data.client_seed; config.nonce = data.nonce + 1;
        } catch (error) { stopSound('reel_loop'); result.textContent = error.message || 'Spin failed.'; }
        finally { busy = false; spin.disabled = false; }
    });
    if (document.addEventListener) document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopAllAudio();
        else if (!musicMuted && audioFiles.ambient_loop) safePlay(audioFiles.ambient_loop);
    });
    window.addEventListener('pagehide', stopAllAudio);
    boot();
})();


