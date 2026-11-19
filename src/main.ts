import './style.css';
import { Game } from './game';
import { World } from './world';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLElement;
const world = new World(canvas);
const game = new Game(world, hud);

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  world.update(dt);
  world.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
