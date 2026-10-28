import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const scratchDir = '/Users/agustindaverede/.gemini/antigravity/brain/3eaf91d2-f6c4-415a-9f81-ed78064bb320/scratch';

const CEDAR_SYMBOLS = [
  'wild', 'hero', 'lion', 'temple', 'thunder-club',
  'silver-coin', 'laurel', 'amphora', 'golden-apple', 'shield'
];

const CEDAR_AUDIO = [
  'reel-start', 'reel-loop', 'reel-stop-1', 'reel-stop-2', 'reel-stop-3',
  'result-no-win', 'win-small', 'win-medium', 'win-large', 'wild-land',
  'button-click', 'fast-toggle', 'signature-cue', 'ambient-loop'
];

const CEDAR_ARCADE_GAMES = [
  'CedarCrash', 'CedarPlinko', 'CedarMines', 'CedarTower', 'CedarKeno',
  'CedarWheel', 'CedarDice', 'CedarLimbo', 'CedarBlackjack', 'CedarHiLo'
];

const LOBBY_ICONS = [
  'BookOfNileNG', 'HerculesonofZeus', 'TripleMonkey', 'BigBassBonanza',
  'MissKittyAT', 'DayofDead', 'LuckyNewYearTigerTreasures', 'PyramidKing',
  'AncientEgyptClassic', 'Cedarcules', ...CEDAR_ARCADE_GAMES
];

const tasks = [];

// 1. Cedarcules slot assets from clients.377.live
for (const sym of CEDAR_SYMBOLS) {
  tasks.push({
    url: `https://clients.377.live/cedar/games/Cedarcules/assets/symbols/${sym}.png`,
    dest: path.join(publicDir, `cedar/games/Cedarcules/assets/symbols/${sym}.png`),
    alsoDest: path.join(publicDir, `CedarGames/Cedarcules/assets/symbols/${sym}.png`),
  });
}
for (const img of ['background-desktop.jpg', 'background-mobile.jpg', 'frame.png', 'logo.png', 'cover.png']) {
  tasks.push({
    url: `https://clients.377.live/cedar/games/Cedarcules/assets/${img}`,
    dest: path.join(publicDir, `cedar/games/Cedarcules/assets/${img}`),
    alsoDest: path.join(publicDir, `CedarGames/Cedarcules/assets/${img}`),
  });
}
tasks.push({
  url: `https://clients.377.live/cedar/games/Cedarcules/cover.png`,
  dest: path.join(publicDir, `cedar/games/Cedarcules/cover.png`),
});
for (const aud of CEDAR_AUDIO) {
  tasks.push({
    url: `https://clients.377.live/cedar/games/Cedarcules/audio/${aud}.ogg`,
    dest: path.join(publicDir, `cedar/games/Cedarcules/audio/${aud}.ogg`),
    alsoDest: path.join(publicDir, `CedarGames/Cedarcules/audio/${aud}.ogg`),
  });
}

// 2. Cedar Arcade covers from clients.377.live
for (const g of CEDAR_ARCADE_GAMES) {
  tasks.push({
    url: `https://clients.377.live/cedar/games/${g}/cover.png`,
    dest: path.join(publicDir, `cedar/games/${g}/cover.png`),
  });
}

// 3. Lobby logo & icons from one.377.live / GitHub repo
tasks.push({
  url: `https://one.377.live/minimal/logo.png`,
  dest: path.join(publicDir, `minimal/logo.png`),
});

for (const ico of LOBBY_ICONS) {
  tasks.push({
    url: `https://one.377.live/frontend/Default/ico/${ico}.jpg`,
    fallbackUrl: `https://raw.githubusercontent.com/promexdotme/laravel-social-gaming/main/frontend/Default/ico/${ico}.jpg`,
    dest: path.join(publicDir, `frontend/Default/ico/${ico}.jpg`),
  });
}

// 4. Slot WAV audio from GitHub repo
for (const wav of ['spin.wav', 'stop.wav', 'win.wav', 'lose.wav', 'start.wav']) {
  tasks.push({
    url: `https://raw.githubusercontent.com/promexdotme/laravel-social-gaming/main/public/audio/slots/${wav}`,
    dest: path.join(publicDir, `audio/slots/${wav}`),
  });
}

// 5. Reference PHP files into scratchDir for exact math porting
for (const php of [
  'casino/config/cedar_slots.php',
  'casino/app/Services/CedarSlotService.php',
  'casino/app/Services/CedarGameService.php',
  'casino/app/Games/CedarMath.php',
  'casino/app/Games/CedarTables.php',
  'casino/app/Services/MultiRowSlotEngine.php',
]) {
  tasks.push({
    url: `https://raw.githubusercontent.com/promexdotme/laravel-social-gaming/main/${php}`,
    dest: path.join(scratchDir, path.basename(php)),
  });
}

async function downloadOne(t) {
  const urls = [t.url, t.fallbackUrl].filter(Boolean);
  for (const u of urls) {
    try {
      const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(t.dest), { recursive: true });
      fs.writeFileSync(t.dest, buf);
      if (t.alsoDest) {
        fs.mkdirSync(path.dirname(t.alsoDest), { recursive: true });
        fs.writeFileSync(t.alsoDest, buf);
      }
      console.log(`OK [${buf.length}B] ${path.relative(rootDir, t.dest)}`);
      return true;
    } catch (err) {
      // try fallback
    }
  }
  console.warn(`MISS ${t.url}`);
  return false;
}

const concurrency = 8;
let idx = 0;
async function worker() {
  while (idx < tasks.length) {
    const cur = tasks[idx++];
    await downloadOne(cur);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
console.log('Done fetching assets.');
