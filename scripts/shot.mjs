// Dev helper: node scripts/shot.mjs out.png [width height] [steps]
// Steps are separated by ;; and t:N waits N seconds of game time: light, skip, a digit string of columns to drop, g, key:Tab, wait:1500, click:#id, eval:<js>
import { chromium } from '@playwright/test';
const [out = 'shot.png', w = '1440', h = '900', steps = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const phone = +w < 600;
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, hasTouch: phone, isMobile: phone, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(process.env.URL ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
if (process.env.SETUP) { await page.evaluate(process.env.SETUP); await page.reload(); await page.waitForFunction(() => window.__game, null, { timeout: 60000 }); }
const idle = () => page.waitForFunction(() => { const g = window.__game; return g.phase === 'over' || (g.phase === 'play' && !g.beats.busy && !g.thinking && !g.isRival(g.state.turn)); }, null, { timeout: 120000 });
for (const step of steps.split(';;').filter(Boolean)) {
  if (step === 'light') { await page.click('#light'); }
  else if (step === 'skip') { await page.waitForTimeout(400); await page.keyboard.press('x'); await idle(); }
  else if (step === 'g') { await page.keyboard.press('g'); await page.waitForTimeout(300); }
  else if (step === 'idle') { await idle(); }
  else if (step.startsWith('t:')) { const until = (await page.evaluate(() => window.__game.clock)) + +step.slice(2); await page.waitForFunction((u) => window.__game.clock >= u, until, { timeout: 200000 }); }
  else if (step.startsWith('key:')) { await page.keyboard.press(step.slice(4)); await page.waitForTimeout(300); }
  else if (step.startsWith('wait:')) { await page.waitForTimeout(+step.slice(5)); }
  else if (step.startsWith('click:')) { await page.click(step.slice(6)); await page.waitForTimeout(300); }
  else if (step.startsWith('eval:')) { console.log(JSON.stringify(await page.evaluate(step.slice(5)))); }
  else if (step.startsWith('shot:')) { await page.screenshot({ path: step.slice(5) }); }
  else for (const c of step) { await page.keyboard.press(c); await page.waitForTimeout(250); await idle(); }
}
await page.waitForTimeout(500);
await page.screenshot({ path: out });
if (errors.length) console.log('ERRORS', errors.slice(0, 8).join('\n'));
await browser.close();
