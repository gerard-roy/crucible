import { describe, expect, it } from 'vitest';
import {
  COLS, ROWS, CELLS, EMPTY, EMBER, FROST, SLAG, WINDOWS, DEFAULT_LEVERS, NO_LEVERS, SMITHS,
  applyMove, clone, droppable, findLines, height, idx, isLegal, legalMoves, longestLine, makeRng,
  newGame, openLines, strokeReady, strokeTargets, validate,
  type Mode, type Move, type Player, type State,
} from '../src/rules';

const BRAKKA = 0, SYLVI = 1, ORU = 2, VESPER = 3;

/** Builds a state from rows written top to bottom: '.', 'E', 'F', 'S'. */
function rack(rows: string[], opts: { turn?: Player; mode?: Mode; smiths?: [number, number] } = {}): State {
  const s = newGame(opts.mode ?? 'standard', opts.smiths ?? [0, 1], opts.turn ?? 1, { ...NO_LEVERS });
  const full = [...new Array(ROWS - rows.length).fill('.......'), ...rows];
  let n = 0;
  for (let r = 0; r < ROWS; r++) {
    const line = full[ROWS - 1 - r];
    for (let c = 0; c < COLS; c++) {
      const v = '.EFS'.indexOf(line[c]);
      s.cells[idx(c, r)] = v;
      if (v !== EMPTY) n++;
    }
  }
  s.drops = n;
  s.moves = n;
  return s;
}
const drop = (s: State, ...cols: number[]) => cols.map((col) => applyMove(s, { t: 'drop', col }));
const show = (s: State) => {
  const out: string[] = [];
  for (let r = ROWS - 1; r >= 0; r--) out.push(Array.from({ length: COLS }, (_, c) => '.EFS'[s.cells[idx(c, r)]]).join(''));
  return out;
};

describe('falling', () => {
  it('starts empty with Ember to drop', () => {
    const s = newGame();
    expect(s.cells.every((v) => v === EMPTY)).toBe(true);
    expect(s.turn).toBe(1);
    expect(legalMoves(s)).toHaveLength(7);
  });
  it.each([0, 1, 2, 3, 4, 5, 6])('a medallion falls to the bottom of empty column %i', (col) => {
    const s = newGame();
    const o = drop(s, col)[0];
    expect(o.landed).toEqual({ col, row: 0 });
    expect(s.cells[idx(col, 0)]).toBe(EMBER);
    expect(s.turn).toBe(2);
  });
  it.each([0, 1, 2, 3, 4, 5, 6])('column %i stacks six high, then closes', (col) => {
    const s = newGame();
    for (let r = 0; r < ROWS; r++) {
      const o = applyMove(s, { t: 'drop', col });
      expect(o.landed).toEqual({ col, row: r });
    }
    expect(height(s, col)).toBe(ROWS);
    expect(isLegal(s, { t: 'drop', col })).toBe(false);
    expect(() => applyMove(s, { t: 'drop', col })).toThrow();
    expect(droppable(s)).not.toContain(col);
  });
  it('turns alternate', () => {
    const s = newGame();
    drop(s, 0, 0, 1);
    expect(show(s).slice(-2)).toEqual(['F......', 'EE.....']);
  });
  it('the first drop can go to Frost', () => {
    const s = newGame('standard', [0, 1], 2);
    drop(s, 3);
    expect(s.cells[idx(3, 0)]).toBe(FROST);
  });
  it('rejects columns off the rack', () => {
    const s = newGame();
    expect(isLegal(s, { t: 'drop', col: -1 })).toBe(false);
    expect(isLegal(s, { t: 'drop', col: 7 })).toBe(false);
  });
  it('rejects masterstrokes in standard rules', () => {
    const s = newGame();
    drop(s, 3);
    expect(isLegal(s, { t: 'hammerfall', col: 3 })).toBe(false);
    expect(isLegal(s, { t: 'upend' })).toBe(false);
    expect(strokeReady(s)).toBe(false);
  });
});

describe('lines', () => {
  it('there are 69 windows of four', () => {
    expect(WINDOWS).toHaveLength(69);
  });
  const cases = WINDOWS.flatMap((w, i) => ([1, 2] as Player[]).map((p) => [i, p, w] as const));
  it.each(cases)('window %i wins for smith %i', (_i, p, w) => {
    const cells = new Array<number>(CELLS).fill(EMPTY);
    for (const c of w) cells[c] = p;
    const lines = findLines(cells);
    expect(lines).toHaveLength(1);
    expect(lines[0].player).toBe(p);
    expect(lines[0].cells).toEqual(w);
    // Three of the four is not a line, and slag breaks one.
    cells[w[1]] = EMPTY;
    expect(findLines(cells)).toHaveLength(0);
    cells[w[1]] = SLAG;
    expect(findLines(cells)).toHaveLength(0);
  });
  it('wins across', () => {
    const s = newGame();
    const o = drop(s, 0, 0, 1, 1, 2, 2, 3).at(-1)!;
    expect(o.winner).toBe(1);
    expect(s.winner).toBe(1);
    expect(o.lines[0].cells).toEqual([0, 1, 2, 3]);
  });
  it('wins up', () => {
    const s = newGame();
    expect(drop(s, 0, 1, 0, 1, 0, 1, 0).at(-1)!.winner).toBe(1);
  });
  it('wins on the rising diagonal', () => {
    const s = newGame();
    expect(drop(s, 0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3).at(-1)!.winner).toBe(1);
  });
  it('wins on the falling diagonal', () => {
    const s = newGame();
    expect(drop(s, 6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3).at(-1)!.winner).toBe(1);
  });
  it('Frost can win too', () => {
    const s = newGame();
    expect(drop(s, 0, 1, 0, 1, 0, 1, 6, 1).at(-1)!.winner).toBe(2);
  });
  it('no move is legal after a win', () => {
    const s = newGame();
    drop(s, 0, 1, 0, 1, 0, 1, 0);
    expect(legalMoves(s)).toHaveLength(0);
    expect(() => applyMove(s, { t: 'drop', col: 3 })).toThrow();
  });
  it('a five-long line reports two windows', () => {
    const s = rack(['EE.EE..', 'FFFEFF.']);
    const o = drop(s, 2)[0];
    expect(o.winner).toBe(1);
    expect(o.lines).toHaveLength(2);
  });
  it('longestLine measures runs', () => {
    const s = rack(['E......', 'EF.....', 'EFF.EE.']);
    expect(longestLine(s.cells, 1)).toBe(3);
    expect(longestLine(s.cells, 2)).toBe(2);
    expect(longestLine(newGame().cells, 1)).toBe(0);
  });
});

describe('draw', () => {
  const full = ['EEFFEE.', 'FFEEFFE', 'EEFFEEF', 'FFEEFFE', 'EEFFEEF', 'FFEEFFE'];
  it('a full rack with no line is a draw', () => {
    const s = rack(full, { turn: 2 });
    expect(findLines(s.cells)).toHaveLength(0);
    const o = drop(s, 6)[0];
    expect(o.winner).toBe(3);
    expect(legalMoves(s)).toHaveLength(0);
    expect(validate(s)).toBeNull();
  });
  it('a line on the last slot wins instead', () => {
    const s = rack(['EEFEEE.', 'FFEEFFE', 'EEFFEEF', 'FFEEFFE', 'EEFFEEF', 'FFEEFFE'], { turn: 1 });
    expect(drop(s, 6)[0].winner).toBe(1);
  });
});

describe('open lines', () => {
  it('finds three with a playable fourth', () => {
    const s = rack(['EEE....']);
    const o = openLines(s.cells, 1);
    expect(o).toHaveLength(1);
    expect(o[0].slot).toBe(3);
    expect(o[0].cells).toEqual([0, 1, 2]);
  });
  it('ignores a fourth slot with nothing under it', () => {
    expect(openLines(rack(['.EEE...', '.FFF...']).cells, 1)).toEqual([]);
  });
  it('counts a gap in the middle', () => {
    const s = rack(['EE.E...']);
    expect(openLines(s.cells, 1)[0].slot).toBe(2);
  });
  it('slag blocks an open line', () => {
    expect(openLines(rack(['EEES...']).cells, 1)).toHaveLength(0);
  });
  it('reports both smiths when no player is given', () => {
    const s = rack(['E...F..', 'E...F..', 'E...F..']);
    expect(openLines(s.cells).map((l) => l.player).sort()).toEqual([1, 2]);
  });
});

describe('Hammerfall', () => {
  const ms = { mode: 'masterstroke' as Mode, smiths: [BRAKKA, SYLVI] as [number, number] };
  it('knocks out the bottom and drops the rest one slot', () => {
    const s = rack(['E......', 'F......', 'E......'], ms);
    const o = applyMove(s, { t: 'hammerfall', col: 0 });
    expect(o.removed).toEqual({ col: 0, row: 0, piece: EMBER });
    expect(o.shifts).toEqual([{ col: 0, from: 1, to: 0, piece: FROST }, { col: 0, from: 2, to: 1, piece: EMBER }]);
    expect(show(s).slice(-3)).toEqual(['.......', 'E......', 'F......']);
    expect(s.turn).toBe(2);
    expect(s.ready[0]).toBe(false);
  });
  it('cannot strike an empty column', () => {
    const s = rack(['E......'], ms);
    expect(isLegal(s, { t: 'hammerfall', col: 1 })).toBe(false);
    expect(strokeTargets(s)).toEqual([{ t: 'hammerfall', col: 0 }]);
  });
  it('is not ready on an empty rack', () => {
    expect(strokeReady(newGame('masterstroke', [BRAKKA, SYLVI]))).toBe(false);
  });
  it('cannot be used twice', () => {
    const s = rack(['EF.....'], ms);
    applyMove(s, { t: 'hammerfall', col: 1 });
    drop(s, 1);
    expect(isLegal(s, { t: 'hammerfall', col: 0 })).toBe(false);
    expect(strokeReady(s)).toBe(false);
  });
  it('can win by dropping a line into place', () => {
    const s = rack(['...E...', 'EEEF...'], ms);
    const o = applyMove(s, { t: 'hammerfall', col: 3 });
    expect(o.winner).toBe(1);
  });
  it('hands the win to the rival if it only completes their line', () => {
    const s = rack(['...F...', 'FFFE...'], ms);
    expect(applyMove(s, { t: 'hammerfall', col: 3 }).winner).toBe(2);
  });
  it('reopens a full column', () => {
    const s = rack(['E......', 'F......', 'E......', 'F......', 'E......', 'F......'], ms);
    applyMove(s, { t: 'hammerfall', col: 0 });
    expect(droppable(s)).toContain(0);
  });
  it('can knock out slag', () => {
    const s = rack(['E......', 'S......'], ms);
    expect(applyMove(s, { t: 'hammerfall', col: 0 }).removed!.piece).toBe(SLAG);
    expect(s.cells[0]).toBe(EMBER);
  });
  it('lever: cannot knock out a rival medallion', () => {
    const s = rack(['EF.....'], ms);
    s.levers.hammerfallOwnOnly = true;
    expect(strokeTargets(s)).toEqual([{ t: 'hammerfall', col: 0 }]);
    expect(isLegal(s, { t: 'hammerfall', col: 1 })).toBe(false);
    expect(() => applyMove(s, { t: 'hammerfall', col: 1 })).toThrow();
  });
  it('lever: a rival base under your own medallion is still out of reach', () => {
    const s = rack(['E......', 'F......'], ms);
    s.levers.hammerfallOwnOnly = true;
    expect(strokeTargets(s)).toEqual([]);
  });
  it('lever: slag at the base can be knocked out', () => {
    const s = rack(['F..S...', 'S..F...'], ms);
    s.levers.hammerfallOwnOnly = true;
    expect(strokeTargets(s)).toEqual([{ t: 'hammerfall', col: 0 }]);
  });
  it('the lever is on in a new game', () => {
    expect(newGame('masterstroke').levers.hammerfallOwnOnly).toBe(true);
    expect(DEFAULT_LEVERS.hammerfallOwnOnly).toBe(true);
  });
});

describe('Quench', () => {
  const ms = { mode: 'masterstroke' as Mode, smiths: [SYLVI, BRAKKA] as [number, number] };
  it('is free: the same smith then drops', () => {
    const s = newGame('masterstroke', [SYLVI, BRAKKA], 1, { ...NO_LEVERS });
    const o = applyMove(s, { t: 'quench', col: 3 });
    expect(o.turnEnded).toBe(false);
    expect(o.frozen).toBe(3);
    expect(s.turn).toBe(1);
    expect(s.mustDrop).toBe(true);
    expect(legalMoves(s).every((m) => m.t === 'drop')).toBe(true);
    expect(legalMoves(s)).toHaveLength(7);
  });
  it('blocks the rival from that column for one turn', () => {
    const s = newGame('masterstroke', [SYLVI, BRAKKA], 1, { ...NO_LEVERS });
    applyMove(s, { t: 'quench', col: 3 });
    drop(s, 3);
    expect(droppable(s)).toEqual([0, 1, 2, 4, 5, 6]);
    expect(isLegal(s, { t: 'drop', col: 3 })).toBe(false);
    drop(s, 0);
    expect(s.frozenFor).toBe(0);
    drop(s, 1);
    expect(droppable(s)).toContain(3);
  });
  it('does not block Hammerfall on the frozen column', () => {
    const s = newGame('masterstroke', [SYLVI, BRAKKA], 1, { ...NO_LEVERS });
    applyMove(s, { t: 'quench', col: 3 });
    drop(s, 3);
    expect(isLegal(s, { t: 'hammerfall', col: 3 })).toBe(true);
    applyMove(s, { t: 'hammerfall', col: 3 });
    expect(s.frozenFor).toBe(0);
  });
  it('does not block Meltdown or Upend on the frozen column', () => {
    for (const rival of [ORU, VESPER]) {
      const s = newGame('masterstroke', [SYLVI, rival], 1, { ...NO_LEVERS });
      applyMove(s, { t: 'quench', col: 3 });
      drop(s, 3);
      const m: Move = rival === ORU ? { t: 'meltdown', col: 3, row: 0 } : { t: 'upend' };
      expect(isLegal(s, m)).toBe(true);
    }
  });
  it('cannot freeze the only open column', () => {
    const s = rack(['EEFFEE.', 'FFEEFFE', 'EEFFEEF', 'FFEEFFE', 'EEFFEEF', 'FFEEFFE'], ms);
    expect(strokeTargets(s)).toHaveLength(0);
    expect(strokeReady(s)).toBe(false);
  });
  it('cannot freeze a full column', () => {
    const s = rack(['E......', 'F......', 'E......', 'F......', 'E......', 'F......'], ms);
    expect(isLegal(s, { t: 'quench', col: 0 })).toBe(false);
    expect(isLegal(s, { t: 'quench', col: 1 })).toBe(true);
  });
  it('thaws if the frozen column is the rival\'s only drop', () => {
    const s = rack(['EEFFE..', 'FFEEFFE', 'EEFFEEF', 'FFEEFFE', 'EEFFEEF', 'FFEEFFE'], ms);
    applyMove(s, { t: 'quench', col: 6 });
    drop(s, 5);
    expect(s.winner).toBe(0);
    expect(s.frozenFor).toBe(2);
    expect(droppable(s)).toEqual([6]);
  });
  it('is spent after use', () => {
    const s = newGame('masterstroke', [SYLVI, BRAKKA], 1, { ...NO_LEVERS });
    applyMove(s, { t: 'quench', col: 3 });
    expect(isLegal(s, { t: 'quench', col: 2 })).toBe(false);
    drop(s, 0, 1);
    expect(isLegal(s, { t: 'quench', col: 2 })).toBe(false);
  });
  it('the quencher may drop in the frozen column', () => {
    const s = newGame('masterstroke', [SYLVI, BRAKKA], 1, { ...NO_LEVERS });
    applyMove(s, { t: 'quench', col: 3 });
    expect(isLegal(s, { t: 'drop', col: 3 })).toBe(true);
  });
  it('turn-cost lever ends the turn', () => {
    const s = newGame('masterstroke', [SYLVI, BRAKKA], 1, { ...DEFAULT_LEVERS, quenchCostsTurn: true });
    const o = applyMove(s, { t: 'quench', col: 3 });
    expect(o.turnEnded).toBe(true);
    expect(s.turn).toBe(2);
    expect(droppable(s)).not.toContain(3);
  });
  it('the turn-cost lever is on in a new game', () => {
    expect(DEFAULT_LEVERS.quenchCostsTurn).toBe(true);
    const s = newGame('masterstroke', [SYLVI, BRAKKA]);
    drop(s, 0);
    drop(s, 1);
    applyMove(s, { t: 'quench', col: 3 });
    expect(s.turn).toBe(2);
    expect(s.mustDrop).toBe(false);
  });
  it('with the turn cost the column thaws after the rival\'s next move', () => {
    const s = newGame('masterstroke', [SYLVI, BRAKKA]);
    drop(s, 0);
    drop(s, 1);
    applyMove(s, { t: 'quench', col: 3 });
    expect(isLegal(s, { t: 'drop', col: 3 })).toBe(false);
    drop(s, 2);
    expect(s.frozenFor).toBe(0);
    drop(s, 3);
    expect(isLegal(s, { t: 'drop', col: 3 })).toBe(true);
  });
});

describe('Meltdown', () => {
  const ms = { mode: 'masterstroke' as Mode, smiths: [ORU, BRAKKA] as [number, number] };
  it('turns a rival medallion to slag and costs the turn', () => {
    const s = rack(['EF.....'], ms);
    const o = applyMove(s, { t: 'meltdown', col: 1, row: 0 });
    expect(o.slagged).toEqual({ col: 1, row: 0 });
    expect(s.cells[1]).toBe(SLAG);
    expect(s.turn).toBe(2);
    expect(s.ready[0]).toBe(false);
  });
  it('cannot target own medallions, slag or empty slots', () => {
    const s = rack(['EFS....'], ms);
    expect(isLegal(s, { t: 'meltdown', col: 0, row: 0 })).toBe(false);
    expect(isLegal(s, { t: 'meltdown', col: 2, row: 0 })).toBe(false);
    expect(isLegal(s, { t: 'meltdown', col: 3, row: 0 })).toBe(false);
    expect(strokeTargets(s)).toEqual([{ t: 'meltdown', col: 1, row: 0 }]);
  });
  it('slag counts for no one', () => {
    const s = rack(['FFF....'], ms);
    applyMove(s, { t: 'meltdown', col: 1, row: 0 });
    expect(drop(s, 3)[0].winner).toBe(0);
    expect(openLines(s.cells)).toHaveLength(0);
  });
  it('slag falls like any medallion', () => {
    const s = rack(['F......', 'E......'], { mode: 'masterstroke', smiths: [ORU, BRAKKA] });
    applyMove(s, { t: 'meltdown', col: 0, row: 1 });
    applyMove(s, { t: 'hammerfall', col: 0 });
    expect(s.cells[0]).toBe(SLAG);
    expect(s.cells[idx(0, 1)]).toBe(EMPTY);
  });
  it('is not ready with no rival medallion', () => {
    expect(strokeReady(newGame('masterstroke', [ORU, BRAKKA]))).toBe(false);
  });
  it('cannot be used twice', () => {
    const s = rack(['EFF....'], ms);
    applyMove(s, { t: 'meltdown', col: 1, row: 0 });
    drop(s, 6);
    expect(isLegal(s, { t: 'meltdown', col: 2, row: 0 })).toBe(false);
  });
});

describe('Upend', () => {
  const ms = { mode: 'masterstroke' as Mode, smiths: [VESPER, BRAKKA] as [number, number] };
  it('reverses every column and settles it at the bottom', () => {
    const s = rack(['E......', 'F.S....', 'E.F..E.'], ms);
    const o = applyMove(s, { t: 'upend' });
    expect(show(s).slice(-3)).toEqual(['E......', 'F.F....', 'E.S..E.']);
    expect(o.shifts).toHaveLength(6);
    expect(o.shifts).toContainEqual({ col: 2, from: 1, to: 0, piece: SLAG });
    expect(s.turn).toBe(2);
    expect(validate(s)).toBeNull();
  });
  it('is not ready on an empty rack', () => {
    expect(strokeReady(newGame('masterstroke', [VESPER, BRAKKA]))).toBe(false);
  });
  it('cannot be used twice', () => {
    const s = rack(['E......'], ms);
    applyMove(s, { t: 'upend' });
    drop(s, 1);
    expect(isLegal(s, { t: 'upend' })).toBe(false);
  });
  it('can make a line', () => {
    // Each column's top medallion becomes its bottom one, so row 0 reads E E E E.
    const s = rack(['EEE....', 'FFF....', 'FEFE...'], ms);
    expect(applyMove(s, { t: 'upend' }).winner).toBe(1);
  });
  it('two lines at once: the smith who did not move wins', () => {
    const s = rack(['EEE....', 'FFFE...', 'FEFF...'], ms);
    const o = applyMove(s, { t: 'upend' });
    expect(o.lines.map((l) => l.player).sort()).toEqual([1, 2]);
    expect(o.winner).toBe(2);
  });
  it('move lever delays it', () => {
    const s = newGame('masterstroke', [VESPER, BRAKKA], 1, { ...DEFAULT_LEVERS, upendFromMove: 10 });
    drop(s, 0, 1, 0, 1, 2, 3, 2, 3);
    expect(s.moves).toBe(8);
    expect(isLegal(s, { t: 'upend' })).toBe(false);
    drop(s, 5);
    expect(s.turn).toBe(2);
    drop(s, 6);
    expect(isLegal(s, { t: 'upend' })).toBe(true);
  });
});

describe('two lines', () => {
  it('Hammerfall that completes both lines loses for the mover', () => {
    // Column 3 holds S, F, E from the bottom. Without the slag, F completes row 0 and E completes row 1.
    const s = rack(['...E...', 'EEEF...', 'FFFS...'], { mode: 'masterstroke', smiths: [0, 1] });
    const o = applyMove(s, { t: 'hammerfall', col: 3 });
    expect(o.lines.map((l) => l.player).sort()).toEqual([1, 2]);
    expect(o.winner).toBe(2);
  });
  it('both smiths may pick the same character', () => {
    const s = newGame('masterstroke', [BRAKKA, BRAKKA]);
    drop(s, 0);
    drop(s, 1);
    applyMove(s, { t: 'hammerfall', col: 0 });
    expect(s.ready).toEqual([false, true]);
    expect(isLegal(s, { t: 'hammerfall', col: 1 })).toBe(true);
  });
  it('there are four smiths with distinct masterstrokes', () => {
    expect(new Set(SMITHS.map((x) => x.stroke)).size).toBe(4);
  });
});

function randomGames(mode: Mode, count: number, seed: number) {
  const rng = makeRng(seed);
  let wins = 0, draws = 0, strokes = 0;
  for (let g = 0; g < count; g++) {
    const smiths: [number, number] = [Math.floor(rng() * 4), Math.floor(rng() * 4)];
    const s = newGame(mode, smiths, g % 2 === 0 ? 1 : 2);
    const used = [0, 0];
    let guard = 0;
    while (s.winner === 0) {
      if (++guard > 200) throw new Error('game did not end');
      const moves = legalMoves(s);
      const m = moves[Math.floor(rng() * moves.length)];
      const before = clone(s);
      const o = applyMove(s, m);
      if (m.t !== 'drop') { used[o.player - 1]++; strokes++; }
      const bad = validate(s);
      if (bad) throw new Error(`${bad} after ${JSON.stringify(m)} in game ${g}\n${show(before).join('\n')}`);
      if (o.turnEnded !== (s.turn !== before.turn)) throw new Error('turn flag wrong');
    }
    if (used[0] > 1 || used[1] > 1) throw new Error('masterstroke used twice');
    if (mode === 'standard' && (used[0] || used[1])) throw new Error('masterstroke in standard rules');
    if (s.winner === 3) draws++; else wins++;
  }
  return { wins, draws, strokes };
}

describe('random full games', () => {
  it('2,000 standard games stay legal', () => {
    const r = randomGames('standard', 2000, 11);
    expect(r.wins + r.draws).toBe(2000);
    expect(r.strokes).toBe(0);
  });
  it('2,000 masterstroke games stay legal', () => {
    const r = randomGames('masterstroke', 2000, 12);
    expect(r.wins + r.draws).toBe(2000);
    expect(r.strokes).toBeGreaterThan(2000);
  });
  it('2,000 masterstroke games with every lever on stay legal', () => {
    const rng = makeRng(5);
    for (let g = 0; g < 2000; g++) {
      const s = newGame('masterstroke', [g % 4, (g >> 2) % 4], 1, { quenchCostsTurn: true, hammerfallOwnOnly: true, upendFromMove: 10 });
      while (s.winner === 0) {
        const moves = legalMoves(s);
        applyMove(s, moves[Math.floor(rng() * moves.length)]);
        expect(validate(s)).toBeNull();
      }
    }
  });
});
