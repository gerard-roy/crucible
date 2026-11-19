import './style.css';
import { Game } from './game';
import { World } from './world';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLElement;
const world = new World(canvas);
const game = new Game(world, hud);

(window as unknown as { __world: World; __game: Game }).__world = world;
(window as unknown as { __game: Game }).__game = game;
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  world.update(dt);
  world.render(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
