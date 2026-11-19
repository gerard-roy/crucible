import './style.css';
import { Game } from './game';
import { Sound } from './audio';
import { World, type Quality } from './world';
import { UI } from './hud/ui';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLElement;
const loading = document.getElementById('loading') as HTMLElement;
const bar = loading.querySelector('i') as HTMLElement;

/** Loads the title art behind the loading bar. A missing file just counts as done. */
async function preload(): Promise<void> {
  const files = ['ui/title.jpg', 'portraits/brakka.jpg', 'portraits/sylvi.jpg', 'portraits/oru.jpg', 'portraits/vesper.jpg'];
  let done = 0;
  await Promise.all(files.map((f) => new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => { done++; bar.style.width = Math.round((done / files.length) * 100) + '%'; resolve(); };
    img.src = import.meta.env.BASE_URL + 'assets/' + f;
  })));
}

function webgl2(): boolean {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

async function boot(): Promise<void> {
  if (!webgl2()) {
    loading.innerHTML = '<div class="panel nogl"><h2>The forge cannot be lit</h2><p>Crucible needs WebGL 2, and this browser has it turned off or does not support it.</p><p>Update your browser, or turn on hardware acceleration in its settings, then reload this page.</p></div>';
    return;
  }
  await Promise.race([preload(), new Promise((r) => setTimeout(r, 3500))]);
  const world = new World(canvas);
  const sound = new Sound();
  const game = new Game(world, sound);
  const ui = new UI(hud, game, sound);
  world.paused = true;
  world.rig.comfort = world.rack.comfort = ui.settings.comfort;
  loading.remove();

  const startSound = () => sound.start();
  window.addEventListener('pointerdown', startSound, { once: true });
  window.addEventListener('keydown', startSound, { once: true });

  // Quality: start at Medium, measure frame time for two seconds, move up or down once.
  const perf = { quality: world.quality as Quality, auto: 'pending' as 'pending' | 'done' | 'off', frames: [] as number[], log: [] as { quality: Quality; avgMs: number; p95Ms: number; fps: number; frames: number }[] };
  let measured = 0;
  let sum = 0;
  let count = 0;
  const setQuality = (q: 'auto' | Quality) => {
    if (q === 'auto') { world.setQuality('medium'); perf.auto = 'pending'; measured = sum = count = 0; }
    else { world.setQuality(q); perf.auto = 'off'; }
    perf.quality = world.quality;
    perf.frames = [];
  };
  ui.onQuality = setQuality;
  setQuality(ui.settings.quality);

  const dev = window as unknown as Record<string, unknown>;
  dev.__world = world;
  dev.__game = game;
  dev.__sound = sound;
  dev.__ui = ui;
  dev.__perf = perf;
  /** Summarises the frame times gathered at the current quality. */
  dev.__perfMark = () => {
    const f = perf.frames.slice().sort((a, b) => a - b);
    if (!f.length) return null;
    const avg = f.reduce((a, b) => a + b, 0) / f.length;
    const entry = { quality: world.quality, avgMs: +avg.toFixed(2), p95Ms: +f[Math.floor(f.length * 0.95)].toFixed(2), fps: +(1000 / avg).toFixed(1), frames: f.length };
    perf.log.push(entry);
    perf.frames = [];
    return entry;
  };

  let last = performance.now();
  let manual = false;
  function frame(now: number): void {
    if (manual) return;
    const raw = now - last;
    last = now;
    tick(raw);
    requestAnimationFrame(frame);
  }
  function tick(raw: number): void {
    const dt = Math.min(0.05, raw / 1000);
    // Nothing 3D is drawn while a full-screen panel covers it.
    world.paused = ui.covered;
    game.update(dt);
    if (!world.paused) {
      world.update(dt);
      world.render(dt);
      if (perf.frames.length < 6000) perf.frames.push(raw);
      if (perf.auto === 'pending' && document.visibilityState === 'visible') {
        measured += raw;
        if (measured > 600) { sum += raw; count++; }
        if (measured > 2600 && count > 0) {
          const avg = sum / count;
          perf.auto = 'done';
          if (avg > 20) world.setQuality('low');
          else if (avg < 11.5 && window.devicePixelRatio <= 2 && !matchMedia('(pointer: coarse)').matches) world.setQuality('high');
          perf.quality = world.quality;
          perf.frames = [];
        }
      }
    }
  }
  /** Stops the live loop and advances one frame of `ms`, for frame-by-frame recording. */
  dev.__step = (ms: number) => { manual = true; tick(ms); };
  requestAnimationFrame(frame);
}

void boot();
