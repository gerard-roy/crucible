// Dev helper: node scripts/shot.mjs out.png [width height] [cols to drop, e.g. 3342]
import { chromium } from '@playwright/test';
const [out = 'shot.png', w = '1440', h = '900', drops = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(process.env.URL ?? 'http://localhost:5173/');
await page.waitForTimeout(2500);
for (const c of drops) { await page.keyboard.press(String(+c + 1)); await page.waitForTimeout(300); await page.waitForFunction(() => !window.__game.beats.busy, null, { timeout: 60000 }); }
await page.waitForTimeout(800);
await page.screenshot({ path: out });
if (errors.length) console.log('ERRORS', errors.slice(0, 8).join('\n'));
await browser.close();
