// Crucible rules engine: Connect 4 on a 7 x 6 rack, plus the four masterstrokes.
// Pure module: no browser code, so tests, the balance script and the worker all share it.

export const COLS = 7;
export const ROWS = 6;
export const CELLS = COLS * ROWS;

export const EMPTY = 0;
export const EMBER = 1;
export const FROST = 2;
export const SLAG = 3;

export type Player = 1 | 2;
export type Mode = 'standard' | 'masterstroke';
export type StrokeId = 'hammerfall' | 'quench' | 'meltdown' | 'upend';

export interface Smith {
  id: string;
  name: string;
  short: string;
  motto: string;
  stroke: StrokeId;
  strokeName: string;
  strokeDesc: string;
  cost: string;
}

export const SMITHS: readonly Smith[] = [
  {
    id: 'brakka', name: 'Brakka Ironhand', short: 'Brakka', motto: 'Hit it until it rings true.',
    stroke: 'hammerfall', strokeName: 'Hammerfall',
    strokeDesc: 'Knocks out the bottom medallion of one column. The rest of that column drops one slot.',
    cost: 'Your turn',
  },
  {
    id: 'sylvi', name: 'Sylvi Frostvein', short: 'Sylvi', motto: 'Cold hands, clean steel.',
    stroke: 'quench', strokeName: 'Quench',
    strokeDesc: 'Freezes one column. Your rival cannot drop there on their next turn.',
    cost: 'Free, then you drop',
  },
  {
    id: 'oru', name: 'Master Oru', short: 'Oru', motto: 'Everything melts. Be patient.',
    stroke: 'meltdown', strokeName: 'Meltdown',
    strokeDesc: 'Turns one rival medallion into slag. It stays in place and counts for no one.',
    cost: 'Your turn',
  },
  {
    id: 'vesper', name: 'Vesper Quill', short: 'Vesper', motto: 'If the rack is against you, turn the rack.',
    stroke: 'upend', strokeName: 'Upend',
    strokeDesc: 'Turns the rack upside down. Every medallion falls to the new bottom of its column.',
    cost: 'Your turn',
  },
];

/** Balance levers from the spec. All off by default. */
export interface Levers {
  quenchCostsTurn: boolean;
  hammerfallOwnOnly: boolean;
  /** Upend is legal only from this move number (1 = always). */
  upendFromMove: number;
}
export const DEFAULT_LEVERS: Levers = { quenchCostsTurn: false, hammerfallOwnOnly: false, upendFromMove: 1 };

export type Move =
  | { t: 'drop'; col: number }
  | { t: 'hammerfall'; col: number }
  | { t: 'quench'; col: number }
  | { t: 'meltdown'; col: number; row: number }
  | { t: 'upend' };

export interface State {
  /** cells[row * 7 + col]; row 0 is the bottom. */
  cells: number[];
  turn: Player;
  mode: Mode;
  /** Smith index (into SMITHS) for Ember and Frost. */
  smiths: [number, number];
  /** Whether each smith's masterstroke is still unspent. */
  ready: [boolean, boolean];
  /** A column frozen by Quench, and the player who may not drop there. */
  frozenCol: number;
  frozenFor: 0 | Player;
  /** True after a free Quench: the same smith must now drop. */
  mustDrop: boolean;
  /** Medallions dropped so far. */
  drops: number;
  /** Turn-ending moves so far (drops and masterstrokes that cost the turn). */
  moves: number;
  /** 0 playing, 1 Ember, 2 Frost, 3 draw. */
  winner: 0 | 1 | 2 | 3;
  levers: Levers;
}

export interface Shift { col: number; from: number; to: number; piece: number }
export interface Line { player: Player; cells: number[] }

/** What a move did, for the staging to reveal beat by beat. */
export interface Outcome {
  move: Move;
  player: Player;
  landed?: { col: number; row: number };
  removed?: { col: number; row: number; piece: number };
  slagged?: { col: number; row: number };
  frozen?: number;
  shifts: Shift[];
  lines: Line[];
  winner: 0 | 1 | 2 | 3;
  turnEnded: boolean;
}

export const idx = (col: number, row: number): number => row * COLS + col;
export const colOf = (i: number): number => i % COLS;
export const rowOf = (i: number): number => Math.floor(i / COLS);
export const other = (p: Player): Player => (p === 1 ? 2 : 1);

export function newGame(
  mode: Mode = 'standard',
  smiths: [number, number] = [0, 1],
  first: Player = 1,
  levers: Levers = DEFAULT_LEVERS,
): State {
  const ms = mode === 'masterstroke';
  return {
    cells: new Array<number>(CELLS).fill(EMPTY),
    turn: first,
    mode,
    smiths: [smiths[0], smiths[1]],
    ready: [ms, ms],
    frozenCol: -1,
    frozenFor: 0,
    mustDrop: false,
    drops: 0,
    moves: 0,
    winner: 0,
    levers: { ...levers },
  };
}

export function clone(s: State): State {
  return { ...s, cells: s.cells.slice(), smiths: [s.smiths[0], s.smiths[1]], ready: [s.ready[0], s.ready[1]], levers: { ...s.levers } };
}

export function height(s: State, col: number): number {
  let h = 0;
  while (h < ROWS && s.cells[idx(col, h)] !== EMPTY) h++;
  return h;
}

export function filled(s: State): number {
  let n = 0;
  for (let i = 0; i < CELLS; i++) if (s.cells[i] !== EMPTY) n++;
  return n;
}
export const slotsLeft = (s: State): number => CELLS - filled(s);
export const isFull = (s: State): boolean => filled(s) === CELLS;

export function openColumns(s: State): number[] {
  const out: number[] = [];
  for (let c = 0; c < COLS; c++) if (s.cells[idx(c, ROWS - 1)] === EMPTY) out.push(c);
  return out;
}

/** Columns the player to move may drop into. A frozen column thaws if it is the only one open. */
export function droppable(s: State): number[] {
  const open = openColumns(s);
  if (s.frozenFor !== s.turn || s.frozenCol < 0) return open;
  const rest = open.filter((c) => c !== s.frozenCol);
  return rest.length > 0 ? rest : open;
}

export function strokeOf(s: State, p: Player): StrokeId {
  return SMITHS[s.smiths[p - 1]].stroke;
}

/** True if the player to move may still start their masterstroke this turn. */
export function strokeReady(s: State): boolean {
  if (s.winner !== 0 || s.mode !== 'masterstroke' || s.mustDrop) return false;
  return s.ready[s.turn - 1] && strokeTargets(s).length > 0;
}

/** Every legal masterstroke move for the player to move (ignoring whether it is spent). */
export function strokeTargets(s: State): Move[] {
  const p = s.turn;
  const out: Move[] = [];
  switch (strokeOf(s, p)) {
    case 'hammerfall':
      for (let c = 0; c < COLS; c++) {
        const h = height(s, c);
        if (h === 0) continue;
        if (s.levers.hammerfallOwnOnly) {
          let own = false;
          for (let r = 0; r < h; r++) if (s.cells[idx(c, r)] === p) own = true;
          if (!own) continue;
        }
        out.push({ t: 'hammerfall', col: c });
      }
      break;
    case 'quench': {
      const open = openColumns(s);
      if (open.length > 1) for (const c of open) out.push({ t: 'quench', col: c });
      break;
    }
    case 'meltdown': {
      const rival = other(p);
      for (let i = 0; i < CELLS; i++) if (s.cells[i] === rival) out.push({ t: 'meltdown', col: colOf(i), row: rowOf(i) });
      break;
    }
    case 'upend':
      if (s.moves + 1 >= s.levers.upendFromMove && filled(s) > 0) out.push({ t: 'upend' });
      break;
  }
  return out;
}

export function legalMoves(s: State): Move[] {
  if (s.winner !== 0) return [];
  const out: Move[] = droppable(s).map((col) => ({ t: 'drop', col }) as Move);
  if (strokeReady(s)) out.push(...strokeTargets(s));
  return out;
}

export function sameMove(a: Move, b: Move): boolean {
  if (a.t !== b.t) return false;
  if (a.t === 'upend') return true;
  if (a.t === 'meltdown') return a.col === (b as typeof a).col && a.row === (b as typeof a).row;
  return a.col === (b as typeof a).col;
}

export function isLegal(s: State, m: Move): boolean {
  return legalMoves(s).some((x) => sameMove(x, m));
}

const DIRS: readonly [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]];

/** All 69 windows of four cells. */
export const WINDOWS: readonly number[][] = (() => {
  const out: number[][] = [];
  for (const [dc, dr] of DIRS) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ec = c + 3 * dc;
        const er = r + 3 * dr;
        if (ec < 0 || ec >= COLS || er < 0 || er >= ROWS) continue;
        out.push([0, 1, 2, 3].map((k) => idx(c + k * dc, r + k * dr)));
      }
    }
  }
  return out;
})();

/** Every window of four held by one smith. */
export function findLines(cells: readonly number[]): Line[] {
  const out: Line[] = [];
  for (const w of WINDOWS) {
    const a = cells[w[0]];
    if ((a === EMBER || a === FROST) && cells[w[1]] === a && cells[w[2]] === a && cells[w[3]] === a) {
      out.push({ player: a as Player, cells: w.slice() });
    }
  }
  return out;
}

/** The longest unbroken run a smith holds, in any direction. */
export function longestLine(cells: readonly number[], p: Player): number {
  let best = 0;
  for (const [dc, dr] of DIRS) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (cells[idx(c, r)] !== p) continue;
        const pc = c - dc;
        const pr = r - dr;
        if (pc >= 0 && pc < COLS && pr >= 0 && pr < ROWS && cells[idx(pc, pr)] === p) continue;
        let n = 0;
        let cc = c;
        let rr = r;
        while (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS && cells[idx(cc, rr)] === p) { n++; cc += dc; rr += dr; }
        if (n > best) best = n;
      }
    }
  }
  return best;
}

export interface OpenLine { player: Player; cells: number[]; slot: number }

/** Lines of three with a fourth slot that can be filled by a drop right now. */
export function openLines(cells: readonly number[], p?: Player): OpenLine[] {
  const out: OpenLine[] = [];
  for (const w of WINDOWS) {
    let owner = 0;
    let count = 0;
    let slot = -1;
    let ok = true;
    for (const i of w) {
      const v = cells[i];
      if (v === EMPTY) { if (slot >= 0) { ok = false; break; } slot = i; }
      else if (v === SLAG) { ok = false; break; }
      else if (owner === 0 || owner === v) { owner = v; count++; }
      else { ok = false; break; }
    }
    if (!ok || count !== 3 || slot < 0) continue;
    if (p !== undefined && owner !== p) continue;
    const below = slot - COLS;
    if (below >= 0 && cells[below] === EMPTY) continue;
    out.push({ player: owner as Player, cells: w.filter((i) => i !== slot), slot });
  }
  return out;
}

function settle(s: State, out: Outcome): void {
  const lines = findLines(s.cells);
  out.lines = lines;
  const mover = out.player;
  const mine = lines.some((l) => l.player === mover);
  const theirs = lines.some((l) => l.player !== mover);
  if (theirs) s.winner = other(mover);
  else if (mine) s.winner = mover;
  else if (isFull(s)) s.winner = 3;
  out.winner = s.winner;
}

function endTurn(s: State, out: Outcome): void {
  const p = out.player;
  if (s.frozenFor === p) { s.frozenFor = 0; s.frozenCol = -1; }
  s.mustDrop = false;
  s.moves++;
  s.turn = other(p);
  out.turnEnded = true;
}

/** Applies a move in place and reports what happened. Throws on an illegal move. */
export function applyMove(s: State, m: Move): Outcome {
  if (!isLegal(s, m)) throw new Error(`illegal move ${JSON.stringify(m)}`);
  const p = s.turn;
  const out: Outcome = { move: m, player: p, shifts: [], lines: [], winner: 0, turnEnded: false };
  switch (m.t) {
    case 'drop': {
      const row = height(s, m.col);
      s.cells[idx(m.col, row)] = p;
      s.drops++;
      out.landed = { col: m.col, row };
      endTurn(s, out);
      settle(s, out);
      break;
    }
    case 'hammerfall': {
      const h = height(s, m.col);
      out.removed = { col: m.col, row: 0, piece: s.cells[idx(m.col, 0)] };
      for (let r = 1; r < h; r++) {
        const piece = s.cells[idx(m.col, r)];
        s.cells[idx(m.col, r - 1)] = piece;
        out.shifts.push({ col: m.col, from: r, to: r - 1, piece });
      }
      s.cells[idx(m.col, h - 1)] = EMPTY;
      s.ready[p - 1] = false;
      endTurn(s, out);
      settle(s, out);
      break;
    }
    case 'quench': {
      s.ready[p - 1] = false;
      s.frozenCol = m.col;
      s.frozenFor = other(p);
      out.frozen = m.col;
      if (s.levers.quenchCostsTurn) endTurn(s, out);
      else s.mustDrop = true;
      break;
    }
    case 'meltdown': {
      s.cells[idx(m.col, m.row)] = SLAG;
      out.slagged = { col: m.col, row: m.row };
      s.ready[p - 1] = false;
      endTurn(s, out);
      settle(s, out);
      break;
    }
    case 'upend': {
      for (let c = 0; c < COLS; c++) {
        const h = height(s, c);
        const stack: number[] = [];
        for (let r = 0; r < h; r++) stack.push(s.cells[idx(c, r)]);
        for (let r = 0; r < h; r++) {
          const from = h - 1 - r;
          s.cells[idx(c, r)] = stack[from];
          out.shifts.push({ col: c, from, to: r, piece: stack[from] });
        }
      }
      s.ready[p - 1] = false;
      endTurn(s, out);
      settle(s, out);
      break;
    }
  }
  return out;
}

/** Checks the invariants of a state; returns a description of the first one broken, or null. */
export function validate(s: State): string | null {
  if (s.cells.length !== CELLS) return 'wrong cell count';
  let n = 0;
  for (let c = 0; c < COLS; c++) {
    let seenEmpty = false;
    for (let r = 0; r < ROWS; r++) {
      const v = s.cells[idx(c, r)];
      if (v < 0 || v > 3) return `bad cell value ${v}`;
      if (v === EMPTY) seenEmpty = true;
      else { if (seenEmpty) return `floating medallion in column ${c}`; n++; }
    }
  }
  if (n > s.drops) return 'more medallions than drops';
  if (s.mode === 'standard') {
    if (s.ready[0] || s.ready[1]) return 'masterstroke ready in standard rules';
    if (s.cells.includes(SLAG)) return 'slag in standard rules';
    if (n !== s.drops) return 'medallion count differs from drops';
    if (s.frozenFor !== 0) return 'frozen column in standard rules';
  }
  const lines = findLines(s.cells);
  if (s.winner === 0 && lines.length > 0) return 'line on the rack but no winner';
  if (s.winner === 0 && n === CELLS) return 'full rack but no result';
  if ((s.winner === 1 || s.winner === 2) && !lines.some((l) => l.player === s.winner)) return 'winner without a line';
  if (s.winner === 3 && (lines.length > 0 || n !== CELLS)) return 'draw without a full, lineless rack';
  if (s.frozenFor !== 0 && (s.frozenCol < 0 || s.frozenCol >= COLS)) return 'bad frozen column';
  if (s.mustDrop && s.frozenFor !== other(s.turn)) return 'mustDrop without a fresh quench';
  if (s.winner === 0 && legalMoves(s).length === 0) return 'no legal move';
  return null;
}

/** Small seeded RNG (mulberry32) so games, searches and tests repeat. */
export function makeRng(seed = 1): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function describeMove(m: Move): string {
  switch (m.t) {
    case 'drop': return `col ${m.col + 1}`;
    case 'hammerfall': return `Hammerfall on col ${m.col + 1}`;
    case 'quench': return `Quench on col ${m.col + 1}`;
    case 'meltdown': return `Meltdown at col ${m.col + 1}, slot ${m.row + 1}`;
    case 'upend': return 'Upend';
  }
}
