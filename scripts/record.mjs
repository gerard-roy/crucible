// Dev helper: records the winning drop frame by frame, so the film is smooth even on a slow renderer.
// node scripts/record.mjs outDir [frames] [quality]   then: ffmpeg -framerate 30 -i outDir/f%04d.jpg -pix_fmt yuv420p out.mp4
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const [dir = 'frames', frames = '600', quality = 'high'] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
// Timers and CSS animations follow the recording's clock once window.__virtual is set.
await page.addInitScript(() => {
  const real = window.setTimeout.bind(window);
  const realClear = window.clearTimeout.bind(window);
  let now = 0;
  let next = 1e9;
  const queue = new Map();
  window.__virtual = false;
  window.setTimeout = (fn, ms = 0, ...a) => { if (!window.__virtual) return real(fn, ms, ...a); queue.set(++next, { at: now + ms, fn: () => fn(...a) }); return next; };
  window.clearTimeout = (id) => { if (queue.has(id)) queue.delete(id); else realClear(id); };
  window.__advance = (ms) => {
    now += ms;
    for (const [id, t] of [...queue]) if (t.at <= now) { queue.delete(id); t.fn(); }
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = (Number(a.currentTime) || 0) + ms; }
    window.__step(ms);
  };
});
await page.goto(process.env.URL ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await page.evaluate((q) => { localStorage.setItem('crucible.settings', JSON.stringify({ quality: q, comfort: false, mode: 'standard', smith: 0, rivalSmith: 1, rival: 'human' })); localStorage.removeItem('crucible.game'); }, quality);
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
const idle = () => page.waitForFunction(() => { const g = window.__game; return g.phase === 'play' && !g.beats.busy; }, null, { timeout: 180000 });
await page.click('#light');
await page.waitForTimeout(400);
await page.keyboard.press('x');
await idle();
for (const c of '44335') { await page.keyboard.press(c); await page.waitForTimeout(250); await idle(); }
// From here time only moves when the script says so: one thirtieth of a second a frame.
await page.waitForTimeout(3000);
await page.evaluate(() => { window.__virtual = true; });
const t0 = Date.now();
let stage = 0;
let quiet = 0;
for (let i = 0; i < +frames; i++) {
  if (stage === 0 && i === 20) { await page.keyboard.press('4'); stage = 1; }
  if (stage === 1) {
    const free = await page.evaluate(() => { const g = window.__game; return !g.beats.busy && g.state.drops === 6; });
    quiet = free ? quiet + 1 : 0;
    if (quiet > 25) { await page.keyboard.press('6'); stage = 2; console.log('winning drop at frame', i); }
  }
  await page.evaluate(() => new Promise((r) => { window.__advance(1000 / 30); requestAnimationFrame(() => r(0)); }));
  await page.screenshot({ path: dir + '/f' + String(i).padStart(4, '0') + '.jpg', type: 'jpeg', quality: 92 });
  if (i % 50 === 0) console.log(i, ((Date.now() - t0) / 1000).toFixed(0) + 's', await page.evaluate(() => [window.__game.phase, window.__game.state.winner, window.__world.quality]));
}
console.log(await page.evaluate(() => ({ phase: window.__game.phase, winner: window.__game.state.winner, drops: window.__game.state.drops, sound: window.__sound.log.slice(-8) })));
await browser.close();
