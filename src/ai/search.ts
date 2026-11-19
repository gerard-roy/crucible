// Alpha-beta search with iterative deepening for the computer rivals.
// Each smith's medallions are a bitboard of 49 bits (7 per column, the top bit a guard),
// held as two 32-bit halves so every operation stays in fast integer maths.
// Masterstrokes are moves for both sides in the first two plies of every search.

import {
  COLS, ROWS, CELLS, EMPTY, SLAG, WINDOWS, SMITHS,
  makeRng, type Levers, type Move, type State, type StrokeId,
} from '../rules';

export const WIN = 10000;
const INF = 1e9;
const M28 = 0x0fffffff;
const ORDER = [3, 2, 4, 1, 5, 0, 6];
/** Plies from the root in which masterstrokes are searched. */
const STROKE_PLIES = 2;
/** What an unspent masterstroke is worth, so a rival does not throw it away. */
const HOLD = 14;
const W = [0, 1, 4, 16, 0];
const THREAT = 10;
const THREAT_GOOD = 45;

interface Ctx {
  nodes: number;
  deadline: number;
  canAbort: boolean;
  aborted: boolean;
  tt: Table;
}

/** Fixed-size transposition table: always replace, keyed by the full position. */
class Table {
  static readonly BITS = 21;
  private a = new Int32Array(1 << Table.BITS);
  private b = new Int32Array(1 << Table.BITS);
  private v = new Int32Array(1 << Table.BITS);
  private slot(key: number): number {
    const hi = (key / 4294967296) | 0;
    const lo = key | 0;
    let x = Math.imul(lo ^ (lo >>> 15), 0x2c1b3c6d) ^ Math.imul(hi ^ (hi >>> 13), 0x297a2d39);
    x ^= x >>> 16;
    return x & ((1 << Table.BITS) - 1);
  }
  get(key: number): number | undefined {
    const i = this.slot(key);
    // v is never 0 for a stored entry: the score field is offset.
    if (this.v[i] === 0 || this.a[i] !== ((key / 4294967296) | 0) || this.b[i] !== (key | 0)) return undefined;
    return this.v[i];
  }
  set(key: number, value: number): void {
    const i = this.slot(key);
    this.a[i] = (key / 4294967296) | 0;
    this.b[i] = key | 0;
    this.v[i] = value;
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

class Pos {
  cells = new Int8Array(CELLS);
  h = new Int8Array(COLS);
  lo = new Int32Array(3);
  hi = new Int32Array(3);
  n = 0;
  turn = 1;
  ready = [false, false];
  strokes: StrokeId[] = ['hammerfall', 'quench'];
  frozenCol = -1;
  frozenFor = 0;
  mustDrop = false;
  moves = 0;
  levers!: Levers;

  static from(s: State): Pos {
    const p = new Pos();
    for (let i = 0; i < CELLS; i++) p.cells[i] = s.cells[i];
    p.turn = s.turn;
    p.ready = [s.ready[0], s.ready[1]];
    p.strokes = [SMITHS[s.smiths[0]].stroke, SMITHS[s.smiths[1]].stroke];
    p.frozenCol = s.frozenCol;
    p.frozenFor = s.frozenFor;
    p.mustDrop = s.mustDrop;
    p.moves = s.moves;
    p.levers = s.levers;
    p.rebuild();
    return p;
  }

  clone(): Pos {
    const p = new Pos();
    p.cells.set(this.cells);
    p.h.set(this.h);
    p.lo.set(this.lo);
    p.hi.set(this.hi);
    p.n = this.n;
    p.turn = this.turn;
    p.ready = [this.ready[0], this.ready[1]];
    p.strokes = this.strokes;
    p.frozenCol = this.frozenCol;
    p.frozenFor = this.frozenFor;
    p.mustDrop = this.mustDrop;
    p.moves = this.moves;
    p.levers = this.levers;
    return p;
  }

  rebuild(): void {
    this.lo.fill(0);
    this.hi.fill(0);
    this.n = 0;
    for (let c = 0; c < COLS; c++) {
      let h = 0;
      for (let r = 0; r < ROWS; r++) {
        const v = this.cells[r * COLS + c];
        if (v === EMPTY) break;
        h++;
        this.n++;
        if (v !== SLAG) this.setBit(v, c, r);
      }
      this.h[c] = h;
    }
  }

  private setBit(piece: number, c: number, r: number): void {
    const bit = c * 7 + r;
    if (bit < 28) this.lo[piece] |= 1 << bit;
    else this.hi[piece] |= 1 << (bit - 28);
  }

  put(c: number, piece: number): void {
    const r = this.h[c]++;
    this.cells[r * COLS + c] = piece;
    this.n++;
    const bit = c * 7 + r;
    if (bit < 28) this.lo[piece] |= 1 << bit;
    else this.hi[piece] |= 1 << (bit - 28);
  }

  take(c: number, piece: number): void {
    const r = --this.h[c];
    this.cells[r * COLS + c] = EMPTY;
    this.n--;
    const bit = c * 7 + r;
    if (bit < 28) this.lo[piece] &= ~(1 << bit);
    else this.hi[piece] &= ~(1 << (bit - 28));
  }

  /** True if the smith holds four in a line. */
  won(piece: number): boolean {
    const lo = this.lo[piece];
    const hi = this.hi[piece];
    let ml = lo & (lo >>> 1);
    let mh = hi & (hi >>> 1);
    if ((ml & (ml >>> 2)) | (mh & (mh >>> 2))) return true;
    for (let d = 6; d <= 8; d++) {
      ml = lo & (((lo >>> d) | (hi << (28 - d))) & M28);
      mh = hi & (hi >>> d);
      const d2 = d * 2;
      if ((ml & (((ml >>> d2) | (mh << (28 - d2))) & M28)) | (mh & (mh >>> d2))) return true;
    }
    return false;
  }

  /** Static score for the smith to move. */
  evaluate(): number {
    const me = this.turn;
    const cells = this.cells;
    const moverOdd = (CELLS - this.n) % 2 === 0;
    let score = 0;
    for (let i = 0; i < WINDOWS.length; i++) {
      const w = WINDOWS[i];
      let a = 0;
      let b = 0;
      for (let k = 0; k < 4; k++) {
        const v = cells[w[k]];
        if (v === EMPTY) continue;
        if (v === me) a++;
        else if (v === SLAG) { a = 9; break; }
        else b++;
      }
      if (a === 9 || (a > 0 && b > 0)) continue;
      score += W[a] - W[b];
      if (a === 3 || b === 3) {
        // A line one medallion short whose slot cannot be filled yet. It decides the endgame when
        // its row parity matches the smith who will be forced to fill the slot beneath it.
        let e = w[0];
        for (let k = 1; k < 4; k++) if (cells[w[k]] === EMPTY) e = w[k];
        if (e >= COLS && cells[e - COLS] === EMPTY) {
          const evenRow = ((e / COLS) | 0) % 2 === 0;
          const mine = a === 3;
          const good = (mine ? moverOdd : !moverOdd) === evenRow;
          const v = good ? THREAT_GOOD : THREAT;
          score += mine ? v : -v;
        }
      }
    }
    if (this.ready[me - 1]) score += HOLD;
    if (this.ready[2 - me]) score -= HOLD;
    return score;
  }

  /** Applies a turn-ending masterstroke for the smith to move. */
  stroke(m: Move): void {
    const p = this.turn;
    const cells = this.cells;
    if (m.t === 'hammerfall') {
      const h = this.h[m.col];
      for (let r = 1; r < h; r++) cells[(r - 1) * COLS + m.col] = cells[r * COLS + m.col];
      cells[(h - 1) * COLS + m.col] = EMPTY;
    } else if (m.t === 'meltdown') {
      cells[m.row * COLS + m.col] = SLAG;
    } else if (m.t === 'upend') {
      for (let c = 0; c < COLS; c++) {
        const h = this.h[c];
        for (let r = 0; r < h >> 1; r++) {
          const a = r * COLS + c;
          const b = (h - 1 - r) * COLS + c;
          const t = cells[a]; cells[a] = cells[b]; cells[b] = t;
        }
      }
    }
    this.rebuild();
    this.ready[p - 1] = false;
    this.endTurn();
  }

  endTurn(): void {
    if (this.frozenFor === this.turn) { this.frozenFor = 0; this.frozenCol = -1; }
    this.mustDrop = false;
    this.moves++;
    this.turn = 3 - this.turn;
  }

  /** Columns the smith to move may drop into, centre first. */
  drops(): number[] {
    const out: number[] = [];
    const fz = this.frozenFor === this.turn ? this.frozenCol : -1;
    for (const c of ORDER) if (this.h[c] < ROWS && c !== fz) out.push(c);
    if (out.length === 0 && fz >= 0 && this.h[fz] < ROWS) out.push(fz);
    return out;
  }

  /** Turn-ending masterstroke moves for the smith to move. `all` lists every Meltdown target. */
  strokeMoves(all: boolean): Move[] {
    const p = this.turn;
    const out: Move[] = [];
    if (!this.ready[p - 1] || this.mustDrop) return out;
    const kind = this.strokes[p - 1];
    if (kind === 'hammerfall') {
      for (const c of ORDER) {
        const h = this.h[c];
        if (h === 0) continue;
        if (this.levers.hammerfallOwnOnly) {
          if (this.cells[c] === 3 - p) continue;
        }
        out.push({ t: 'hammerfall', col: c });
      }
    } else if (kind === 'meltdown') {
      const rival = 3 - p;
      const useful = new Uint8Array(CELLS);
      let any = false;
      if (!all) {
        for (const w of WINDOWS) {
          let b = 0;
          let bad = false;
          for (let k = 0; k < 4; k++) {
            const v = this.cells[w[k]];
            if (v === rival) b++;
            else if (v !== EMPTY) { bad = true; break; }
          }
          if (!bad && b >= 2) { any = true; for (let k = 0; k < 4; k++) if (this.cells[w[k]] === rival) useful[w[k]] = 1; }
        }
      }
      for (let i = 0; i < CELLS; i++) {
        if (this.cells[i] === rival && (all || !any || useful[i])) out.push({ t: 'meltdown', col: i % COLS, row: (i / COLS) | 0 });
      }
    } else if (kind === 'upend') {
      if (this.moves + 1 >= this.levers.upendFromMove && this.n > 0) out.push({ t: 'upend' });
    }
    return out;
  }

  /** Columns Quench may freeze. */
  quenchCols(): number[] {
    const p = this.turn;
    if (!this.ready[p - 1] || this.mustDrop || this.strokes[p - 1] !== 'quench') return [];
    const open: number[] = [];
    for (let c = 0; c < COLS; c++) if (this.h[c] < ROWS) open.push(c);
    return open.length > 1 ? open : [];
  }

  /** Whether dropping `piece` in column c would complete a line. */
  wins(c: number, piece: number): boolean {
    if (this.h[c] >= ROWS) return false;
    this.put(c, piece);
    const w = this.won(piece);
    this.take(c, piece);
    return w;
  }

  key(): number {
    const p = this.turn;
    const o = 3 - p;
    // The mover's medallions plus the filled mask: unique for a plain position, with no carry
    // between columns because of the guard bit.
    return (this.hi[p] * 2 + this.hi[o]) * 268435456 + (this.lo[p] * 2 + this.lo[o]);
  }

  /** True when the position is plain Connect 4, so it can share the transposition table. */
  plain(): boolean {
    return !this.ready[0] && !this.ready[1] && this.frozenFor === 0 && this.n === popcount(this.lo[1] | this.lo[2]) + popcount(this.hi[1] | this.hi[2]);
  }

  /** Scores a position after a masterstroke by the smith who just moved, from the mover's side. */
  afterStroke(ctx: Ctx, depth: number, alpha: number, beta: number, ply: number): number {
    const mover = 3 - this.turn;
    if (this.won(this.turn)) return -(WIN - ply);
    if (this.won(mover)) return WIN - ply;
    if (this.n === CELLS) return 0;
    return -this.negamax(ctx, depth - 1, -beta, -alpha, ply + 1);
  }

  negamax(ctx: Ctx, depth: number, alpha: number, beta: number, ply: number): number {
    if ((++ctx.nodes & 1023) === 0 && ctx.canAbort && now() > ctx.deadline) ctx.aborted = true;
    if (ctx.aborted) return 0;
    const p = this.turn;
    const o = 3 - p;
    const drops = this.drops();
    for (let i = 0; i < drops.length; i++) if (this.wins(drops[i], p)) return WIN - ply;
    if (depth <= 0) return this.evaluate();

    const useTT = depth >= 2 && this.plain();
    let key = 0;
    let ttMove = -1;
    if (useTT) {
      key = this.key();
      const e = ctx.tt.get(key);
      if (e !== undefined) {
        const eDepth = e & 63;
        const flag = (e >> 6) & 3;
        ttMove = (e >> 8) & 7;
        const score = (e >> 11) - 16384;
        if (eDepth >= depth) {
          if (flag === 0) return score;
          if (flag === 1 && score >= beta) return score;
          if (flag === 2 && score <= alpha) return score;
        }
      }
    }

    const a0 = alpha;
    let best = -INF;
    let bestCol = 7;
    const fzCol = this.frozenCol;
    const fzFor = this.frozenFor;
    if (fzFor === p) { this.frozenFor = 0; this.frozenCol = -1; }
    this.turn = o;
    this.moves++;
    for (let i = -1; i < drops.length; i++) {
      let c: number;
      if (i < 0) { if (ttMove < 0 || ttMove > 6 || !drops.includes(ttMove)) continue; c = ttMove; }
      else { c = drops[i]; if (c === ttMove) continue; }
      this.put(c, p);
      const score = this.n === CELLS ? 0 : -this.negamax(ctx, depth - 1, -beta, -alpha, ply + 1);
      this.take(c, p);
      if (score > best) { best = score; bestCol = c; }
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    this.turn = p;
    this.moves--;
    this.frozenCol = fzCol;
    this.frozenFor = fzFor;

    if ((ply < STROKE_PLIES) && alpha < beta && this.ready[p - 1] && !this.mustDrop) {
      for (const m of this.strokeMoves(false)) {
        const child = this.clone();
        child.stroke(m);
        const score = child.afterStroke(ctx, depth, alpha, beta, ply);
        if (score > best) best = score;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }
      const q = this.quenchCols();
      if (q.length > 0 && alpha < beta && this.levers.quenchCostsTurn) {
        for (const c of q) {
          if (!(this.wins(c, o) || this.wins(c, p))) continue;
          const child = this.clone();
          child.ready[p - 1] = false;
          child.endTurn();
          child.frozenCol = c;
          child.frozenFor = o;
          const score = -child.negamax(ctx, depth - 1, -beta, -alpha, ply + 1);
          if (score > best) best = score;
          if (best > alpha) alpha = best;
          if (alpha >= beta) break;
        }
      } else if (q.length > 0 && alpha < beta) {
        outer: for (const d of drops) {
          const base = this.clone();
          base.ready[p - 1] = false;
          base.put(d, p);
          if (base.n === CELLS) continue;
          for (const c of q) {
            // Freeze a column only where it stops a rival line or protects one of ours.
            if (base.h[c] >= ROWS || !(base.wins(c, o) || base.wins(c, p))) continue;
            const child = base.clone();
            if (child.frozenFor === p) { child.frozenFor = 0; child.frozenCol = -1; }
            child.frozenCol = c;
            child.frozenFor = o;
            child.moves++;
            child.turn = o;
            const score = -child.negamax(ctx, depth - 1, -beta, -alpha, ply + 1);
            if (score > best) best = score;
            if (best > alpha) alpha = best;
            if (alpha >= beta) break outer;
          }
        }
      }
    }

    if (useTT && !ctx.aborted && best > -WIN + 100 && best < WIN - 100) {
      const flag = best <= a0 ? 2 : best >= beta ? 1 : 0;
      ctx.tt.set(key, (depth & 63) | (flag << 6) | (bestCol << 8) | ((best + 16384) << 11));
    }
    return best;
  }
}

function popcount(x: number): number {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export interface SearchOpts {
  /** Plies to look ahead (the cap when timeMs is set). */
  depth: number;
  /** Search by time instead: deepen until this many milliseconds have passed. */
  timeMs?: number;
  /** With timeMs, never stop before this depth is complete. */
  minDepth?: number;
  /** Chance of a random move that does not lose at once. */
  randomRate?: number;
  seed?: number;
}

export interface SearchResult {
  move: Move;
  score: number;
  depth: number;
  nodes: number;
  random: boolean;
}

const tt = new Table();

interface RootMove { move: Move; order: number }

function rootMoves(pos: Pos, rng: () => number): RootMove[] {
  const out: RootMove[] = [];
  // Ties break at random, so a seed changes the game without changing its strength.
  for (const c of pos.drops()) out.push({ move: { t: 'drop', col: c }, order: Math.abs(c - 3) + rng() * 0.9 });
  for (const m of pos.strokeMoves(true)) out.push({ move: m, order: 10 + rng() });
  for (const c of pos.quenchCols()) out.push({ move: { t: 'quench', col: c }, order: 20 + rng() });
  return out.sort((a, b) => a.order - b.order);
}

/** Scores one root move from the mover's side. */
function scoreRoot(pos: Pos, m: Move, ctx: Ctx, depth: number, alpha: number, beta: number): number {
  const p = pos.turn;
  const child = pos.clone();
  if (m.t === 'drop') {
    child.put(m.col, p);
    if (child.won(p)) return WIN;
    if (child.n === CELLS) return 0;
    child.endTurn();
    return -child.negamax(ctx, depth - 1, -beta, -alpha, 1);
  }
  if (m.t === 'quench') {
    child.ready[p - 1] = false;
    child.frozenCol = m.col;
    child.frozenFor = 3 - p;
    if (pos.levers.quenchCostsTurn) {
      child.endTurn();
      return -child.negamax(ctx, depth - 1, -beta, -alpha, 1);
    }
    // Free: the same smith still drops, so the score is not negated.
    child.mustDrop = true;
    return child.negamax(ctx, depth, alpha, beta, 0) - 1;
  }
  child.stroke(m);
  return child.afterStroke(ctx, depth, alpha, beta, 0);
}

/** Picks a move for the smith to move. The state is not changed. */
export function chooseMove(state: State, opts: SearchOpts): SearchResult {
  const rng = makeRng(opts.seed ?? ((Math.random() * 2 ** 31) | 0));
  const pos = Pos.from(state);
  const p = pos.turn;
  const moves = rootMoves(pos, rng);
  if (moves.length === 0) throw new Error('no legal move');
  const ctx: Ctx = { nodes: 0, deadline: 0, canAbort: false, aborted: false, tt };

  const winning = moves.find((r) => r.move.t === 'drop' && pos.wins(r.move.col, p));
  if (winning) return { move: winning.move, score: WIN, depth: 1, nodes: 1, random: false };

  if (opts.randomRate && rng() < opts.randomRate) {
    // A careless move: any drop that does not hand the rival a line at once.
    const drops = moves.filter((r) => r.move.t === 'drop');
    const safe = drops.filter((r) => scoreRoot(pos, r.move, ctx, 1, -INF, INF) > -WIN + 50);
    const pool = safe.length > 0 ? safe : drops;
    if (pool.length > 0) {
      return { move: pool[Math.floor(rng() * pool.length)].move, score: 0, depth: 1, nodes: ctx.nodes, random: true };
    }
  }

  const start = now();
  const timed = opts.timeMs !== undefined;
  const minDepth = Math.min(opts.minDepth ?? 1, opts.depth);
  ctx.deadline = start + (opts.timeMs ?? 0);
  let best = moves[0].move;
  let bestScore = -INF;
  let reached = 0;
  const maxDepth = Math.min(opts.depth, CELLS - pos.n + 2);
  for (let depth = 1; depth <= maxDepth; depth++) {
    ctx.canAbort = timed && depth > minDepth;
    let alpha = -INF;
    let iterBest = moves[0].move;
    for (const r of moves) {
      const score = scoreRoot(pos, r.move, ctx, depth, alpha, INF);
      if (ctx.aborted) break;
      if (score > alpha) { alpha = score; iterBest = r.move; }
    }
    if (ctx.aborted) break;
    best = iterBest;
    bestScore = alpha;
    reached = depth;
    // Search the best move first next time.
    const i = moves.findIndex((r) => r.move === best);
    if (i > 0) moves.unshift(moves.splice(i, 1)[0]);
    if (Math.abs(bestScore) > WIN - 100) break;
    if (timed && depth >= minDepth && now() > ctx.deadline) break;
  }
  return { move: best, score: bestScore, depth: reached, nodes: ctx.nodes, random: false };
}
