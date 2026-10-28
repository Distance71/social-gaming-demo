import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const TARGET_GAMES = ['CedarWheel', 'CedarPlinko'];

async function saveAsset(relPath, buffer) {
  const cleanRel = relPath.replace(/^\/+/, '').split('?')[0];
  if (!cleanRel || cleanRel.endsWith('/')) return;
  const fullPath = path.join(PUBLIC_DIR, cleanRel);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
  console.log(`  [saved] /${cleanRel} (${buffer.length} bytes)`);
}

async function main() {
  console.log('Launching Playwright (Chrome headless)...');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  // Intercept all network responses from clients.377.live and one.377.live
  page.on('response', async (response) => {
    try {
      const url = new URL(response.url());
      if (response.status() !== 200) return;
      if (!['clients.377.live', 'one.377.live'].includes(url.hostname)) return;

      const pathname = url.pathname;
      if (
        pathname.startsWith('/cedar/') ||
        pathname.startsWith('/Arcade/') ||
        pathname.startsWith('/js/') ||
        pathname.startsWith('/audio/') ||
        pathname.startsWith('/frontend/Default/ico/')
      ) {
        const body = await response.body();
        await saveAsset(pathname, body);
      }
    } catch {
      // ignore transient stream errors
    }
  });

  // 1. Visit lobby to grab session cookies and inspect how games are launched
  console.log('\n1. Opening lobby on https://one.377.live/ ...');
  await page.goto('https://one.377.live/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  // Extract game cards from the lobby DOM
  const lobbyCards = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-game-card], a[href*="/game/"]')).map((el) => ({
      title: el.getAttribute('data-title') || el.textContent?.trim() || '',
      href: el.getAttribute('href') || el.querySelector('a')?.getAttribute('href') || '',
      img: el.querySelector('img')?.getAttribute('src') || '',
    }));
  });
  console.log(`Found ${lobbyCards.length} game links/cards in lobby.`);

  // 2. For each target game, probe both the lobby launch route and direct CDN bundle
  for (const game of TARGET_GAMES) {
    console.log(`\n2. Extracting game: ${game} ...`);

    // Download icon
    try {
      const icoResp = await context.request.get(
        `https://one.377.live/frontend/Default/ico/${game}.jpg`
      );
      if (icoResp.ok()) {
        await saveAsset(`/frontend/Default/ico/${game}.jpg`, await icoResp.body());
      }
    } catch (e) {
      console.log(`  [warn] icon fetch for ${game}: ${e.message}`);
    }

    // Check candidate paths on clients.377.live and one.377.live
    const candidates = [
      `https://clients.377.live/cedar/games/${game}/index.html`,
      `https://clients.377.live/cedar/${game}/index.html`,
      `https://clients.377.live/Arcade/${game}/index.html`,
      `https://one.377.live/game/${game}`,
    ];

    for (const candidate of candidates) {
      try {
        console.log(`  Probing ${candidate} ...`);
        const resp = await page.goto(candidate, { waitUntil: 'domcontentloaded', timeout: 15000 });
        console.log(`  -> Status ${resp?.status()} | Final URL: ${page.url()}`);
        await page.waitForTimeout(1500);

        const html = await page.content();
        const scripts = await page.evaluate(() =>
          Array.from(document.querySelectorAll('script[src], link[rel="stylesheet"][href]')).map(
            (el) => el.getAttribute('src') || el.getAttribute('href')
          )
        );
        console.log(`  -> Assets referenced in DOM:`, scripts);

        if (resp && resp.status() === 200 && !page.url().includes('/login')) {
          await saveAsset(`/cedar/games/${game}/extracted.html`, Buffer.from(html, 'utf8'));
          break;
        }
      } catch (e) {
        console.log(`  -> Probe error on ${candidate}: ${e.message}`);
      }
    }
  }

  // Also check GitHub repo for public/Arcade or resources/views/frontend/games/list/CedarWheel.blade.php
  for (const game of TARGET_GAMES) {
    const rawCandidates = [
      `https://raw.githubusercontent.com/promexdotme/laravel-social-gaming/main/resources/views/frontend/games/list/${game}.blade.php`,
      `https://raw.githubusercontent.com/promexdotme/laravel-social-gaming/main/app/Services/CedarArcadeService.php`,
    ];
    for (const rawUrl of rawCandidates) {
      try {
        const r = await context.request.get(rawUrl);
        console.log(`  GitHub check ${path.basename(rawUrl)}: HTTP ${r.status()}`);
        if (r.ok()) {
          const text = await r.text();
          await saveAsset(`/cedar/games/${game}/${path.basename(rawUrl)}`, Buffer.from(text, 'utf8'));
        }
      } catch {}
    }
  }

  await browser.close();
  console.log('\nPlaywright extraction complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
