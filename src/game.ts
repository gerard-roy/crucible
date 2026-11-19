import * as THREE from 'three';
import { Beats, clamp01, easeIn, easeInOut, easeOut, lerp } from './beats';
import {
  applyMove, clone, droppable, height, idx, isLegal, longestLine, newGame, openLines, other, slotsLeft,
  strokeOf, strokeReady, strokeTargets, COLS, ROWS, EMBER, EMPTY, SLAG, SMITHS,
  type Mode, type Move, type Outcome, type Player, type State,
} from './rules';
import { ENTRY_Y, slotX, slotY } from './world/rack';
import { LAVA_Y } from './world/forge';
import { sparkColour, type World } from './world';
import type { Sound } from './audio';
import { Rival } from './ai/client';
import { levelOpts, type LevelId } from './ai/levels';

export interface Config {
  mode: Mode;
  /** Smith index for Ember (you) and Frost (the rival). */
  smiths: [number, number];
  rival: 'human' | LevelId;
}

export interface LedgerLine { player: Player; text: string }

export type Phase = 'title' | 'faceoff' | 'play' | 'over';

/** What the game asks of the screens. */
export interface Screens {
  refresh(): void;
  banner(title: string, sub: string, tone: 'ember' | 'frost' | 'blood' | 'ash', seconds: number, emblem?: string): void;
  faceOff(seconds: number): void;
  result(show: boolean): void;
}

const SAVE = 'crucible.game';
const MOLTEN = new THREE.Color(3.4, 1.9, 0.5);
const WHITE = new THREE.Color(2.6, 2.6, 2.8);
const WATER = new THREE.Color(0.8, 1.6, 2.6);
const STEAM = new THREE.Color(0.55, 0.6, 0.66);
export const MIN_RIVAL_MS = 700;

/** The duel: owns the state, turns every move into beats, and drives the rival. */
export class Game {
  readonly beats = new Beats();
  cfg: Config = { mode: 'standard', smiths: [0, 1], rival: 'journeyman' };
  state: State = newGame();
  phase: Phase = 'title';
  ledger: LedgerLine[] = [];
  used: [boolean, boolean] = [false, false];
  /** True while the player is choosing a masterstroke target. */
  targeting = false;
  thinking = false;
  /** How long the rival's last moves took to appear, in ms (for the checks). */
  readonly rivalTimes: number[] = [];
  screens!: Screens;
  private first: Player = 1;
  private gen = 0;
  private aimCol = -1;
  private cursor = { col: 3, row: 0 };
  private rival: Rival | null = null;
  private frost = new Array<number>(COLS).fill(0);
  private frostGoal = new Array<number>(COLS).fill(0);
  private seams: THREE.Mesh[] = [];
  private hammer: THREE.Group | null = null;
  private pour: { x: number; left: number; colour: THREE.Color } | null = null;
  private skipping = false;
  private space = false;
  private drag: { x: number; orbit: number; active: boolean } | null = null;
  private greyGoal = 0;
  private warmGoal = 1;
  private runeGoal = 0.05;
  private phone = matchMedia('(pointer: coarse)').matches;

  constructor(readonly world: World, readonly sound: Sound) {
    const canvas = world.canvas;
    canvas.addEventListener('pointerdown', (e) => {
      const col = world.pickColumn(e.clientX, e.clientY);
      if (col < 0 && world.rig.view === 'rack') this.drag = { x: e.clientX, orbit: world.rig.orbit, active: false };
      if (e.pointerType !== 'mouse') this.hover(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.drag) {
        if (Math.abs(e.clientX - this.drag.x) > 6) this.drag.active = true;
        const lim = Math.PI / 6;
        world.rig.orbit = THREE.MathUtils.clamp(this.drag.orbit - (e.clientX - this.drag.x) * 0.004, -lim, lim);
        return;
      }
      if (e.pointerType === 'mouse' || e.buttons) this.hover(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerleave', () => { this.drag = null; this.setAim(-1); });
    canvas.addEventListener('pointerup', (e) => {
      if (this.drag) { this.drag = null; return; }
      if (this.phase === 'faceoff') { this.skip(); return; }
      this.click(e.clientX, e.clientY);
      if (e.pointerType !== 'mouse') this.setAim(-1);
    });
    window.addEventListener('keydown', (e) => this.key(e));
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') { this.space = false; } });
  }

  // ---- who is who ----

  isRival(p: Player): boolean { return this.cfg.rival !== 'human' && p === 2; }
  smith(p: Player) { return SMITHS[this.cfg.smiths[p - 1]]; }
  /** How a player is named in the ledger and the banners. */
  label(p: Player): string {
    if (this.cfg.rival !== 'human' && p === 1) return 'You';
    const same = this.cfg.smiths[0] === this.cfg.smiths[1];
    return this.smith(p).short + (same ? (p === 1 ? ' (Ember)' : ' (Frost)') : '');
  }
  get canAct(): boolean {
    return this.phase === 'play' && !this.beats.busy && !this.thinking && this.state.winner === 0 && !this.isRival(this.state.turn);
  }
  get strokeAvailable(): boolean { return this.canAct && strokeReady(this.state); }
  get openLineCount(): number { return openLines(this.state.cells).length; }
  get lastSlots(): boolean { return this.state.winner === 0 && slotsLeft(this.state) <= 6; }

  statusText(): string {
    const s = this.state;
    if (this.phase === 'faceoff') return 'Light the forge';
    if (s.winner === 3) return 'Cold iron';
    if (s.winner !== 0) return this.isRival(s.winner) ? 'Broken' : 'Forged';
    const p = s.turn;
    if (this.isRival(p)) return `${this.smith(p).short} is thinking`;
    if (this.targeting) {
      switch (strokeOf(s, p)) {
        case 'hammerfall': return 'Pick a column to strike';
        case 'quench': return 'Pick a column to freeze';
        case 'meltdown': return 'Pick a rival medallion to melt';
        default: return 'Upend';
      }
    }
    const what = s.mustDrop ? 'now drop' : 'drop';
    return this.cfg.rival !== 'human' ? `Your ${s.mustDrop ? 'drop, now' : 'drop'}` : `${this.label(p)}: ${what}`;
  }

  // ---- starting, saving, leaving ----

  start(cfg: Config, first: Player = 1): void {
    this.cfg = { ...cfg, smiths: [cfg.smiths[0], cfg.smiths[1]] };
    this.first = first;
    this.state = newGame(cfg.mode, this.cfg.smiths, first);
    this.ledger = [];
    this.used = [false, false];
    this.resetScene();
    this.save();
    void this.faceOff();
  }

  rematch(): void { this.start(this.cfg, other(this.first)); }

  static saved(): { cfg: Config; state: State; first: Player; ledger: LedgerLine[]; used: [boolean, boolean] } | null {
    try {
      const raw = localStorage.getItem(SAVE);
      const v = raw ? JSON.parse(raw) : null;
      return v && v.state && v.state.winner === 0 && Array.isArray(v.state.cells) && v.state.cells.length === COLS * ROWS ? v : null;
    } catch { return null; }
  }

  /** Returns to a game saved after its last move. */
  resume(): boolean {
    const v = Game.saved();
    if (!v) return false;
    this.cfg = v.cfg;
    this.state = v.state;
    this.first = v.first;
    this.ledger = v.ledger ?? [];
    this.used = v.used ?? [false, false];
    this.resetScene();
    for (let i = 0; i < this.state.cells.length; i++) {
      const piece = this.state.cells[i];
      if (piece !== EMPTY) this.world.medals.spawn(i % COLS, Math.floor(i / COLS), piece);
    }
    this.phase = 'play';
    this.world.paused = false;
    this.sound.setInPlay(true);
    this.after();
    return true;
  }

  private save(): void {
    try {
      if (this.state.winner !== 0) localStorage.removeItem(SAVE);
      else localStorage.setItem(SAVE, JSON.stringify({ cfg: this.cfg, state: this.state, first: this.first, ledger: this.ledger, used: this.used }));
    } catch { /* private mode */ }
  }

  /** Leaves the duel for the title. The saved game stays. */
  quit(): void {
    this.gen++;
    this.beats.flush();
    this.phase = 'title';
    this.thinking = false;
    this.targeting = false;
    this.resetScene();
    this.sound.setInPlay(false);
    this.sound.setLastSlots(false);
    this.sound.openLine(false);
    this.world.paused = true;
    this.screens.result(false);
    this.screens.refresh();
  }

  private resetScene(): void {
    const w = this.world;
    this.gen++;
    this.beats.flush();
    this.beats.timeScale = 1;
    this.thinking = false;
    this.targeting = false;
    this.skipping = false;
    w.medals.clear();
    w.clearAim();
    for (const s of this.seams) { w.rack.inner.remove(s); (s.material as THREE.Material).dispose(); s.geometry.dispose(); }
    this.seams = [];
    if (this.hammer) this.hammer.visible = false;
    this.pour = null;
    w.rack.inner.rotation.set(0, 0, 0);
    this.frostGoal.fill(0);
    this.greyGoal = 0;
    this.warmGoal = 1;
    this.runeGoal = 0.05;
    w.post.finish.uniforms.uFlash.value = 0;
    w.rig.setShot(null);
    w.rig.orbit = 0;
    this.sound.cutMusic(false);
    this.sound.setLastSlots(false);
    this.sound.openLine(false);
    this.screens?.result(false);
  }

  // ---- input ----

  private key(e: KeyboardEvent): void {
    if (e.code === 'Space') { this.space = true; if (this.phase !== 'title') e.preventDefault(); }
    if (this.phase === 'faceoff') { if (!['Shift', 'Control', 'Alt', 'Meta', 'F1'].includes(e.key)) this.skip(); return; }
    if (this.phase !== 'play') return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'BUTTON' || t.tagName === 'SELECT')) { if (e.key === 'Enter' || e.code === 'Space') return; }
    const k = e.key;
    if (k === 'g' || k === 'G') { this.toggleStroke(); return; }
    if (k === 'Escape' && this.targeting) { this.cancelStroke(); e.stopImmediatePropagation(); return; }
    if (!this.canAct) return;
    const melt = this.targeting && strokeOf(this.state, this.state.turn) === 'meltdown';
    if (k >= '1' && k <= '7') {
      const col = Number(k) - 1;
      if (melt) { this.cursor.col = col; this.showCursor(); } else this.choose(col);
    } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
      const d = k === 'ArrowLeft' ? -1 : 1;
      if (melt) { this.cursor.col = THREE.MathUtils.clamp(this.cursor.col + d, 0, COLS - 1); this.showCursor(); }
      else this.setAim(THREE.MathUtils.clamp((this.aimCol < 0 ? 3 - d : this.aimCol) + d, 0, COLS - 1));
      e.preventDefault();
    } else if (melt && (k === 'ArrowUp' || k === 'ArrowDown')) {
      this.cursor.row = THREE.MathUtils.clamp(this.cursor.row + (k === 'ArrowUp' ? 1 : -1), 0, ROWS - 1);
      this.showCursor();
      e.preventDefault();
    } else if (k === 'Enter') {
      if (melt) void this.play({ t: 'meltdown', col: this.cursor.col, row: this.cursor.row });
      else if (this.aimCol >= 0) this.choose(this.aimCol);
    }
  }

  private showCursor(): void {
    this.world.aim(this.cursor.col, this.cursor.row, this.state.turn);
  }

  private hover(x: number, y: number): void {
    if (this.targeting && strokeOf(this.state, this.state.turn) === 'meltdown') {
      const s = this.world.pickSlot(x, y);
      if (s && this.canAct) { this.cursor = s; this.showCursor(); } else this.world.clearAim();
      return;
    }
    this.setAim(this.world.pickColumn(x, y));
  }

  private click(x: number, y: number): void {
    if (!this.canAct) return;
    if (this.targeting && strokeOf(this.state, this.state.turn) === 'meltdown') {
      const s = this.world.pickSlot(x, y);
      if (s) void this.play({ t: 'meltdown', col: s.col, row: s.row });
      return;
    }
    const col = this.world.pickColumn(x, y);
    if (col >= 0) this.choose(col);
  }

  /** A column was chosen: a drop, or the target of a masterstroke. */
  choose(col: number): void {
    if (!this.canAct) return;
    if (this.targeting) {
      const stroke = strokeOf(this.state, this.state.turn);
      if (stroke === 'hammerfall' || stroke === 'quench') void this.play({ t: stroke, col });
      return;
    }
    void this.play({ t: 'drop', col });
  }

  setAim(col: number): void {
    this.aimCol = col;
    const s = this.state;
    if (!this.canAct || col < 0) { this.world.clearAim(); return; }
    if (this.targeting) {
      const stroke = strokeOf(s, s.turn);
      const ok = strokeTargets(s).some((m) => 'col' in m && m.col === col);
      if (ok && stroke !== 'meltdown') this.world.aim(col, stroke === 'hammerfall' ? 0 : Math.min(ROWS - 1, height(s, col)), s.turn);
      else this.world.clearAim();
      return;
    }
    if (!droppable(s).includes(col)) { this.world.clearAim(); return; }
    this.world.aim(col, height(s, col), s.turn);
  }

  toggleStroke(): void {
    if (this.targeting) { this.cancelStroke(); return; }
    if (!this.strokeAvailable) return;
    this.sound.click();
    if (strokeOf(this.state, this.state.turn) === 'upend') { void this.play({ t: 'upend' }); return; }
    this.targeting = true;
    this.world.clearAim();
    this.markTargets();
    this.screens.refresh();
  }

  cancelStroke(): void {
    this.targeting = false;
    this.world.clearAim();
    this.markThreats();
    this.syncFrost();
    this.screens.refresh();
  }

  /** Shows what a masterstroke may be aimed at. */
  private markTargets(): void {
    const s = this.state;
    for (const m of this.world.medals.list) m.hotTarget = 0;
    for (const t of strokeTargets(s)) {
      if (t.t === 'meltdown') { const m = this.world.medals.at(t.col, t.row); if (m) m.hotTarget = 0.7; }
      else if (t.t === 'hammerfall') { const m = this.world.medals.at(t.col, 0); if (m) m.hotTarget = 0.7; }
      else if (t.t === 'quench') this.frostGoal[t.col] = Math.max(this.frostGoal[t.col], 0.3);
    }
  }

  toggleView(): void {
    this.world.rig.view = this.world.rig.view === 'rack' ? 'forge' : 'rack';
    this.world.clearAim();
  }

  private skip(): void { this.skipping = true; }

  // ---- the turn ----

  private async faceOff(): Promise<void> {
    const gen = this.gen;
    const w = this.world;
    this.phase = 'faceoff';
    w.paused = false;
    this.sound.setInPlay(true);
    this.screens.refresh();
    // Up on the chains, looking down them at the rack.
    w.rig.snap(new THREE.Vector3(1.5, 15.5, 9), new THREE.Vector3(0, 11, 0));
    w.rig.setShot(new THREE.Vector3(1.5, 15.5, 9), new THREE.Vector3(0, 11, 0));
    this.screens.faceOff(2.6);
    await this.beats.wait(0.55);
    if (gen !== this.gen) return;
    this.sound.faceOff();
    w.rig.shake(0.5);
    w.forge.lava.flare = 1.2;
    await this.beats.wait(2.05);
    if (gen !== this.gen) return;
    // The camera descends the chains to the rack.
    w.rig.stiffness = 1.5;
    w.rig.setShot(null);
    this.screens.banner('Light the forge', `${this.smith(1).name} against ${this.smith(2).name}`, 'ember', 2.6);
    this.sound.banner();
    await this.beats.wait(3.4);
    if (gen !== this.gen) return;
    w.rig.stiffness = 3.2;
    this.skipping = false;
    this.phase = 'play';
    this.after();
  }

  /** After every move: glow, heartbeat, save, and hand over to the rival if it is their turn. */
  private after(): void {
    this.markThreats();
    this.syncFrost();
    this.sound.setLastSlots(this.lastSlots);
    this.save();
    this.screens.refresh();
    if (this.state.winner === 0 && this.isRival(this.state.turn)) void this.think();
    else this.setAim(this.aimCol);
  }

  private markThreats(): void {
    const lines = this.state.winner === 0 ? openLines(this.state.cells) : [];
    const hot = new Set<number>();
    for (const l of lines) for (const i of l.cells) hot.add(i);
    for (const m of this.world.medals.list) m.hotTarget = hot.has(idx(m.col, m.row)) ? 1 : 0;
    this.sound.openLine(lines.length > 0);
  }

  private syncFrost(): void {
    for (let c = 0; c < COLS; c++) this.frostGoal[c] = this.state.frozenCol === c && this.state.winner === 0 ? 1 : 0;
  }

  private async think(): Promise<void> {
    const gen = this.gen;
    this.thinking = true;
    this.world.clearAim();
    this.screens.refresh();
    this.rival ??= new Rival();
    const t0 = performance.now();
    const opts = levelOpts(this.cfg.rival as LevelId, this.cfg.mode, this.phone);
    const move = await this.rival.choose(clone(this.state), { ...opts, seed: (Math.random() * 1e9) | 0 });
    // No rival move lands in under 700ms.
    const left = MIN_RIVAL_MS + 60 - (performance.now() - t0);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    if (gen !== this.gen) return;
    this.rivalTimes.push(performance.now() - t0);
    this.thinking = false;
    if ('col' in move) { this.world.aim(move.col, move.t === 'drop' ? height(this.state, move.col) : 6, this.state.turn); await this.beats.wait(0.35); }
    if (gen !== this.gen) return;
    await this.play(move, true);
  }

  /** The rules engine decides the outcome first; the beats then reveal it in order. */
  async play(move: Move, fromRival = false): Promise<void> {
    if (this.phase !== 'play' || this.beats.busy && !fromRival) return;
    if (!fromRival && !this.canAct) return;
    if (!isLegal(this.state, move)) return;
    const gen = this.gen;
    const before = clone(this.state);
    const out = applyMove(this.state, move);
    const p = out.player;
    this.targeting = false;
    this.world.clearAim();
    for (const m of this.world.medals.list) m.hotTarget = 0;
    this.sound.openLine(false);
    this.screens.refresh();

    if (move.t === 'drop') {
      await this.dropBeat(out);
    } else {
      this.used[p - 1] = true;
      const smith = this.smith(p);
      this.sound.duckFor(4);
      this.sound.banner();
      this.screens.banner(smith.strokeName, `${this.label(p)} ${this.label(p) === 'You' ? 'call' : 'calls'} the masterstroke`, p === EMBER ? 'ember' : 'frost', 1.2, smith.stroke);
      await this.beats.wait(1.2);
      if (gen !== this.gen) return;
      if (move.t === 'hammerfall') await this.hammerfall(out);
      else if (move.t === 'quench') await this.quench(out);
      else if (move.t === 'meltdown') await this.meltdown(out);
      else await this.upend(out, before);
    }
    if (gen !== this.gen) return;

    this.ledger.unshift({ player: p, text: this.describe(move) });
    if (out.winner !== 0) {
      this.save();
      this.sound.setLastSlots(false);
      if (out.winner === 3) await this.drawScene();
      else if (this.isRival(out.winner as Player)) await this.lossScene(out);
      else await this.winScene(out, move.t === 'drop');
      if (gen !== this.gen) return;
      this.phase = 'over';
      this.screens.refresh();
      this.screens.result(true);
      return;
    }
    this.after();
  }

  private describe(m: Move): string {
    switch (m.t) {
      case 'drop': return `col ${m.col + 1}`;
      case 'hammerfall': return `Hammerfall, col ${m.col + 1}`;
      case 'quench': return `Quench, col ${m.col + 1}`;
      case 'meltdown': return `Meltdown, col ${m.col + 1} row ${m.row + 1}`;
      case 'upend': return 'Upend';
    }
  }

  // ---- beats ----

  private async dropBeat(out: Outcome): Promise<void> {
    const w = this.world;
    const { col, row } = out.landed!;
    const p = out.player;
    const medal = w.medals.spawn(col, row, p);
    const from = ENTRY_Y;
    const to = slotY(row);
    // Real acceleration: 350 to 650ms by height.
    const dur = 0.35 + 0.3 * clamp01((from - to - 1.95) / 5);
    const winning = out.winner === p && !this.isRival(p);
    const fall = (a: number, b: number) => (t: number) => {
      const u = lerp(a, b, t);
      medal.mesh.position.y = from + (to - from) * u * u;
      medal.mesh.position.x = slotX(col) + Math.sin(u * 46) * 0.018 * (1 - u);
      medal.mesh.rotation.z = Math.sin(u * 31) * 0.05;
    };
    w.crane.openTarget = 1;
    this.sound.rattle(winning ? dur * 0.67 : dur);
    if (winning) {
      // The last third of the fall plays in slow motion while the music cuts out.
      await this.beats.run(dur * 0.67, fall(0, 0.67), true);
      this.sound.cutMusic(true);
      this.beats.timeScale = 0.2;
      w.rig.stiffness = 1.2;
      w.rig.setShot(new THREE.Vector3(slotX(col) * 0.6 + 1.2, to + 0.6, 12.5), new THREE.Vector3(slotX(col) * 0.6, to + 0.4, 0));
      await this.beats.run(dur * 0.33, fall(0.67, 1), true);
      this.beats.timeScale = 1;
    } else {
      await this.beats.run(dur, fall(0, 1));
    }
    medal.mesh.position.set(slotX(col), to, 0);
    medal.mesh.rotation.z = 0;
    const strength = winning ? 1.5 : 0.75 + (5 - row) * 0.07;
    w.impact(col, row, p, strength);
    this.sound.clangAt(row, strength);
    this.sound.sparks();
    // 300ms to settle.
    await this.beats.run(0.3, (t) => { medal.mesh.position.y = to + Math.sin(t * Math.PI * 2) * 0.05 * (1 - t) * (1 - t); }, winning);
    medal.mesh.position.y = to;
  }

  private ensureHammer(): THREE.Group {
    if (this.hammer) return this.hammer;
    const g = new THREE.Group();
    const iron = this.world.rack.iron;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 9, 10), new THREE.MeshStandardMaterial({ color: 0x2c1a0e, roughness: 0.8 }));
    handle.position.y = -4.5;
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.5, 1.5), iron);
    head.position.y = -9;
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.3, 1.6), new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.9, roughness: 0.4 }));
    band.position.y = -9;
    g.add(handle, head, band);
    this.world.rack.inner.add(g);
    this.hammer = g;
    return g;
  }

  /** A great hammer swings in from the side and strikes the column's base. 2.5s. */
  private async hammerfall(out: Outcome): Promise<void> {
    const w = this.world;
    const col = out.removed!.col;
    const dir = col <= 3 ? -1 : 1;
    const h = this.ensureHammer();
    // The head ends beside the base of the column, striking it side-on through the front.
    h.position.set(slotX(col) + dir * 1.55, slotY(0) + 9, 1.25);
    h.visible = true;
    const raised = dir * 1.75;
    h.rotation.z = raised;
    this.sound.hammerWhoosh();
    await this.beats.run(0.75, (t) => { h.rotation.z = lerp(raised, raised + dir * 0.25, Math.sin(clamp01(t / 0.45) * Math.PI / 2)) * (t < 0.45 ? 1 : 1) ; if (t > 0.45) h.rotation.z = lerp(raised + dir * 0.25, 0, easeIn((t - 0.45) / 0.55)); });
    // The strike.
    const gone = w.medals.at(col, 0);
    const at = w.slotWorld(col, 0);
    if (gone) {
      w.sparks.burst(at, 260, gone.piece === SLAG ? WHITE : sparkColour(gone.piece), { speed: 8, up: 2.5, floorY: LAVA_Y + 0.1, life: 1.4, size: 1.2, spread: 0.6 });
      w.medals.remove(gone);
    }
    w.sparks.burst(at, 90, MOLTEN, { speed: 5, up: 3, floorY: LAVA_Y + 0.1, life: 1.1 });
    this.sound.hammerStrike();
    w.rig.shake(0.7);
    w.rack.sway(-dir * 1.6, 1.2);
    w.forge.lava.flare = 1.4;
    w.post.finish.uniforms.uFlash.value = 0.25;
    await this.beats.run(0.3, (t) => { h.rotation.z = -dir * 0.12 * Math.sin(t * Math.PI); });
    // The column drops one slot with a triple clang.
    const moving = out.shifts.map((s) => ({ s, m: w.medals.at(s.col, s.from)! }));
    if (moving.length) this.sound.tripleClang();
    const swingOut = this.beats.run(0.8, (t) => { h.rotation.z = lerp(0, raised, easeInOut(t)); h.position.z = 1.25 + t * 1.5; });
    await this.beats.run(0.32, (t) => { for (const { s, m } of moving) m.mesh.position.y = lerp(slotY(s.from), slotY(s.to), t * t); });
    for (const { s, m } of moving) { m.row = s.to; m.mesh.position.y = slotY(s.to); }
    if (moving.length) { w.impact(col, 0, moving[0].m.piece === SLAG ? EMBER : moving[0].m.piece, 0.7); this.sound.sparks(); }
    await swingOut;
    h.visible = false;
    await this.beats.wait(0.65);
  }

  /** Water cascades down the column, steam bursts out, frost creeps over the channel. 2s. */
  private async quench(out: Outcome): Promise<void> {
    const w = this.world;
    const col = out.frozen!;
    const top = w.slotWorld(col, 5.9);
    const base = w.slotWorld(col, -0.5);
    const p = new THREE.Vector3();
    this.sound.steam();
    await this.beats.run(1.0, (t, dt) => {
      if (dt <= 0) return;
      // The cascade.
      p.copy(top);
      w.sparks.burst(p, 9, WATER, { speed: 0.9, up: -6, gravity: 22, floorY: base.y, life: 0.7, size: 0.9, spread: 0.5 });
      // Steam where it meets hot iron.
      if (t > 0.2) {
        p.lerpVectors(base, top, Math.random() * Math.min(1, t * 1.3));
        p.z += 0.4;
        w.sparks.burst(p, 4, STEAM, { speed: 1.6, up: 1.2, gravity: -3.5, life: 1.5, size: 3.2, spread: 0.6 });
      }
      this.frostGoal[col] = Math.max(this.frostGoal[col], t);
    });
    this.sound.ice();
    w.rack.sway((col - 3) / 4, 0.3);
    w.sparks.burst(w.slotWorld(col, 2.5), 80, WHITE, { speed: 3, up: 0.5, gravity: 5, life: 0.9, size: 0.7, spread: 5 });
    this.frostGoal[col] = 1;
    await this.beats.wait(1.0);
  }

  /** The medallion turns white, sags and drips away, leaving a dull slag puck. 2s. */
  private async meltdown(out: Outcome): Promise<void> {
    const w = this.world;
    const { col, row } = out.slagged!;
    const m = w.medals.at(col, row)!;
    const at = w.slotWorld(col, row);
    const start = m.mat.emissive.clone();
    const white = new THREE.Color(1, 0.95, 0.85);
    this.sound.meltWhine();
    await this.beats.run(0.8, (t) => { m.mat.emissive.lerpColors(start, white, t); m.hot = m.hotTarget = 1 + t * 2.5; });
    this.sound.meltHiss();
    const p = new THREE.Vector3();
    await this.beats.run(0.7, (t, dt) => {
      // It sags and drips.
      m.mesh.scale.set(1 + t * 0.08, 1 - t * 0.3, 1);
      m.mesh.position.y = slotY(row) - t * 0.12;
      if (dt > 0) { p.copy(at); p.y -= 0.35; w.sparks.burst(p, 3, MOLTEN, { speed: 0.5, up: -1, gravity: 16, floorY: LAVA_Y + 0.1, life: 1.3, size: 1.3, spread: 0.4 }); }
    });
    w.medals.toSlag(m);
    m.mesh.scale.set(1, 1, 1);
    m.mesh.position.y = slotY(row);
    this.sound.meltDrop();
    w.sparks.burst(at, 50, STEAM, { speed: 1.4, up: 1, gravity: -3, life: 1.2, size: 2.6, spread: 0.5 });
    w.forge.lava.flare = 0.8;
    await this.beats.wait(0.5);
  }

  /** The chains ratchet, the rack turns over, and every medallion tumbles and resettles. 3.5s. */
  private async upend(out: Outcome, _before: State): Promise<void> {
    const w = this.world;
    const inner = w.rack.inner;
    // The camera pulls back.
    const pose = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    w.rig.pose('rack', pose);
    w.rig.setShot(pose.pos.clone().multiplyScalar(1.28).add(new THREE.Vector3(2, 1.5, 0)), pose.look);
    this.sound.ratchet(1.5);
    this.sound.groan(1.8);
    await this.beats.run(1.7, (t) => {
      inner.rotation.x = Math.PI * easeInOut(t);
      // The chains ratchet: the rack judders as it turns.
      inner.rotation.z = Math.sin(t * Math.PI) * Math.sin(t * 60) * 0.006;
    });
    // The rack now hangs the other way up: swap to the upright frame with every medallion where it appears.
    inner.rotation.set(0, 0, 0);
    const moving = out.shifts.map((s) => ({ s, m: w.medals.at(s.col, s.from)! }));
    for (const { s, m } of moving) { m.mesh.position.y = -slotY(s.from); m.mesh.rotation.z = Math.PI; }
    w.rack.sway(0.6, 1.2);
    w.rig.shake(0.35);
    this.sound.tumble(moving.length);
    // Everything falls to the new bottom of its column.
    let landed = 0;
    await this.beats.run(1.1, (t) => {
      for (const { s, m } of moving) {
        const startY = -slotY(s.from);
        const endY = slotY(s.to);
        const delay = s.to * 0.06 + (s.col % 3) * 0.02;
        const span = 0.25 + Math.sqrt(Math.max(0, startY - endY)) * 0.17;
        const u = clamp01((t * 1.1 - delay) / span);
        m.mesh.position.y = lerp(startY, endY, u * u);
        m.mesh.rotation.z = Math.PI * (1 - easeOut(u));
      }
      const now = moving.filter(({ s }) => t * 1.1 >= s.to * 0.06 + 0.3).length;
      if (now > landed + 3) { landed = now; w.rack.sway((Math.random() - 0.5) * 1.5, 0.4); w.forge.lava.flare = Math.max(w.forge.lava.flare, 0.7); }
    });
    for (const { s, m } of moving) { m.row = s.to; m.mesh.position.y = slotY(s.to); m.mesh.rotation.z = 0; }
    for (let c = 0; c < COLS; c++) if (w.medals.at(c, 0)) w.sparks.burst(w.slotWorld(c, -0.45), 26, MOLTEN, { speed: 3.5, up: 2, floorY: LAVA_Y + 0.1, life: 0.9 });
    this.sound.sparks();
    w.rig.setShot(null);
    await this.beats.wait(0.7);
  }

  private addSeams(out: Outcome, player: Player): void {
    const w = this.world;
    const colour = player === EMBER ? new THREE.Color(5, 3.2, 1.4) : new THREE.Color(1.8, 3.6, 5);
    for (const line of out.lines) {
      if (line.player !== player) continue;
      const a = line.cells[0];
      const b = line.cells[line.cells.length - 1];
      const ax = slotX(a % COLS), ay = slotY(Math.floor(a / COLS));
      const bx = slotX(b % COLS), by = slotY(Math.floor(b / COLS));
      const len = Math.hypot(bx - ax, by - ay) + 0.5;
      const seam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.13, 0.06), new THREE.MeshBasicMaterial({ color: colour }));
      seam.position.set((ax + bx) / 2, (ay + by) / 2, 0.3);
      seam.rotation.z = Math.atan2(by - ay, bx - ax);
      seam.scale.x = 0.001;
      w.rack.inner.add(seam);
      this.seams.push(seam);
      for (const i of line.cells) { const m = w.medals.at(i % COLS, Math.floor(i / COLS)); if (m) m.hotTarget = 1.6; }
    }
  }

  /** White flash, the four fuse along a seam, runes ignite, molten metal pours from above. 4.5s. */
  private async winScene(out: Outcome, dropped: boolean): Promise<void> {
    const w = this.world;
    const p = out.winner as Player;
    this.sound.duckFor(5);
    this.sound.cutMusic(true);
    w.post.finish.uniforms.uFlash.value = 1;
    this.sound.winStrike();
    w.rig.shake(0.8);
    w.forge.lava.flare = 1.5;
    this.addSeams(out, p);
    this.runeGoal = 3.2;
    this.screens.banner('Forged', this.cfg.rival === 'human' ? `${this.label(p)} draws the line` : 'A single line of white-hot steel', p === EMBER ? 'ember' : 'frost', 3.6);
    const first = out.lines.find((l) => l.player === p);
    const cx = first ? first.cells.reduce((s, i) => s + slotX(i % COLS), 0) / first.cells.length : 0;
    this.pour = { x: cx, left: 3.4, colour: p === EMBER ? MOLTEN : new THREE.Color(1.2, 2.4, 3.6) };
    const seams = this.seams.slice();
    const total = dropped ? 4.0 : 4.5;
    await this.beats.run(total, (t) => {
      const s = easeOut(clamp01((t * total) / 0.7));
      for (const m of seams) m.scale.x = Math.max(0.001, s);
      if (t > 0.25) this.sound.cutMusic(false);
    }, true);
    w.rig.stiffness = 3.2;
    w.rig.setShot(null);
  }

  /** The rival's seam forms and your fires dim. 3.5s. */
  private async lossScene(out: Outcome): Promise<void> {
    const w = this.world;
    const p = out.winner as Player;
    this.addSeams(out, p);
    this.sound.lossToll();
    w.rig.shake(0.3);
    for (const m of w.medals.list) if (m.piece === other(p)) m.fireTarget = 0.12;
    this.warmGoal = 0.45;
    w.post.finish.uniforms.uDim.value = 0;
    this.screens.banner('Broken', `${this.smith(p).name} draws the line`, 'blood', 3.2);
    const seams = this.seams.slice();
    await this.beats.run(3.5, (t) => {
      const s = easeOut(clamp01((t * 3.5) / 0.9));
      for (const m of seams) m.scale.x = Math.max(0.001, s);
      w.post.finish.uniforms.uDim.value = clamp01(t * 2) * 0.5;
    });
  }

  /** The rack cools to grey. 3s. */
  private async drawScene(): Promise<void> {
    this.sound.drawCool();
    for (const m of this.world.medals.list) m.fireTarget = 0.1;
    this.greyGoal = 1;
    this.warmGoal = 0.55;
    this.screens.banner('Cold iron', 'The rack is full and no line stands', 'ash', 2.8);
    await this.beats.wait(3);
  }

  /** Numbers for the result panel. */
  summary(): { winner: 0 | 1 | 2 | 3; drops: number; longest: [number, number]; used: [boolean, boolean] } {
    return {
      winner: this.state.winner,
      drops: this.state.drops,
      longest: [longestLine(this.state.cells, 1), longestLine(this.state.cells, 2)],
      used: [this.used[0], this.used[1]],
    };
  }

  update(dt: number): void {
    const w = this.world;
    // Holding Space doubles the speed of any beat except the winning drop.
    this.beats.speed = this.skipping ? 12 : this.space ? 2 : 1;
    this.beats.update(dt);
    const k = 1 - Math.exp(-dt * 4);
    for (let c = 0; c < COLS; c++) {
      this.frost[c] += (this.frostGoal[c] - this.frost[c]) * k;
      w.rack.setFrost(c, this.frost[c]);
    }
    const fin = w.post.finish.uniforms;
    fin.uFlash.value *= Math.exp(-dt * 4.5);
    fin.uGrey.value += (this.greyGoal - fin.uGrey.value) * (1 - Math.exp(-dt * 1.4));
    if (this.phase !== 'over' && this.state.winner === 0) fin.uDim.value += (0 - fin.uDim.value) * k;
    w.forge.warmth += (this.warmGoal - w.forge.warmth) * (1 - Math.exp(-dt * 1.6));
    w.rack.runes += (this.runeGoal - w.rack.runes) * (1 - Math.exp(-dt * 2.2));
    if (this.pour && this.pour.left > 0) {
      // Molten metal pours from above, in front of the rack, into the lava.
      this.pour.left -= dt;
      const at = new THREE.Vector3(this.pour.x, 9.5, 0.9);
      w.sparks.burst(at, Math.ceil(dt * 420), this.pour.colour, { speed: 0.5, up: -7, gravity: 16, floorY: LAVA_Y + 0.1, life: 1.6, size: 1.5, spread: 0.3 });
      w.forge.lava.flare = Math.max(w.forge.lava.flare, 0.9);
    }
    this.sound.crane(this.phase === 'play' ? w.crane.speed : 0);
  }
}
