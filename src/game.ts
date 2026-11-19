import { Beats } from './beats';
import { applyMove, droppable, height, newGame, other, type Player, type State } from './rules';
import { ENTRY_Y, slotY } from './world/rack';
import type { World } from './world';

/** Grey-box controller: two smiths on one device, standard rules. */
export class Game {
  readonly beats = new Beats();
  state: State = newGame();
  private first: Player = 1;
  private aimCol = -1;
  private status: HTMLElement;

  constructor(private world: World, hud: HTMLElement) {
    this.status = document.createElement('div');
    this.status.className = 'status';
    hud.append(this.status);
    const canvas = world.canvas;
    canvas.addEventListener('pointermove', (e) => this.setAim(world.pickColumn(e.clientX, e.clientY)));
    canvas.addEventListener('pointerleave', () => this.setAim(-1));
    canvas.addEventListener('pointerup', (e) => {
      if (this.state.winner !== 0) { if (!this.beats.busy) this.restart(); return; }
      const col = world.pickColumn(e.clientX, e.clientY);
      if (col >= 0) void this.drop(col);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key >= '1' && e.key <= '7') void this.drop(Number(e.key) - 1);
      else if (e.key === 'ArrowLeft') this.setAim(Math.max(0, (this.aimCol < 0 ? 3 : this.aimCol) - 1));
      else if (e.key === 'ArrowRight') this.setAim(Math.min(6, (this.aimCol < 0 ? 3 : this.aimCol) + 1));
      else if (e.key === 'Enter') { if (this.state.winner !== 0) this.restart(); else if (this.aimCol >= 0) void this.drop(this.aimCol); }
    });
    this.refresh();
  }

  private name(p: Player): string {
    return p === 1 ? 'Ember' : 'Frost';
  }

  private refresh(): void {
    const w = this.state.winner;
    this.status.textContent =
      w === 0 ? `${this.name(this.state.turn)} to drop` :
      w === 3 ? 'Cold iron: a draw. Click to strike again' :
      `${this.name(w)} wins. Click to strike again`;
    this.status.dataset.turn = String(w === 0 ? this.state.turn : w);
  }

  private setAim(col: number): void {
    this.aimCol = col;
    if (this.beats.busy || this.state.winner !== 0 || col < 0 || !droppable(this.state).includes(col)) {
      this.world.clearAim();
      return;
    }
    this.world.aim(col, height(this.state, col), this.state.turn);
  }

  private restart(): void {
    this.first = other(this.first);
    this.state = newGame('standard', [0, 1], this.first);
    this.world.medals.clear();
    this.refresh();
  }

  async drop(col: number): Promise<void> {
    if (this.beats.busy || this.state.winner !== 0 || !droppable(this.state).includes(col)) return;
    const out = applyMove(this.state, { t: 'drop', col });
    this.world.clearAim();
    const { row } = out.landed!;
    const medal = this.world.medals.spawn(col, row, out.player);
    const from = ENTRY_Y;
    const to = slotY(row);
    // Real acceleration: the fall takes 350 to 650ms depending on its height.
    const dur = 0.35 + 0.3 * ((from - to) - 1.25) / 5;
    await this.beats.run(dur, (t) => { medal.mesh.position.y = from + (to - from) * t * t; });
    // A short bounce stands in for the clang until milestone 5.
    await this.beats.run(0.3, (t) => { medal.mesh.position.y = to + Math.sin(t * Math.PI) * 0.06 * (1 - t); });
    if (out.winner === 1 || out.winner === 2) {
      for (const line of out.lines) for (const i of line.cells) {
        const m = this.world.medals.at(i % 7, Math.floor(i / 7));
        if (m) m.mesh.scale.setScalar(1.12);
      }
    }
    this.refresh();
    this.setAim(this.aimCol);
  }

  update(dt: number): void {
    this.beats.update(dt);
  }
}
