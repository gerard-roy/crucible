import { describe, expect, it } from 'vitest';
import { chooseMove, WIN } from '../src/ai/search';
import { levelOpts, LEVELS, type LevelId } from '../src/ai/levels';
import {
  COLS, ROWS, EMPTY, NO_LEVERS, applyMove, clone, idx, isLegal, legalMoves, makeRng, newGame,
  type Mode, type Move, type Player, type State,
} from '../src/rules';

function rack(rows: string[], opts: { turn?: Player; mode?: Mode; smiths?: [number, number] } = {}): State {
  const s = newGame(opts.mode ?? 'standard', opts.smiths ?? [0, 1], opts.turn ?? 1, { ...NO_LEVERS });
  const full = [...new Array(ROWS - rows.length).fill('.......'), ...rows];
  let n = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const v = '.EFS'.indexOf(full[ROWS - 1 - r][c]);
    s.cells[idx(c, r)] = v;
    if (v !== EMPTY) n++;
  }
  s.drops = n;
  s.moves = n;
  return s;
}

const ids: LevelId[] = LEVELS.map((l) => l.id);
const opts = (id: LevelId, mode: Mode, seed: number) => ({ ...levelOpts(id, mode, false, true), seed });
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];

const winning: [string, string[], Move][] = [
  ['across', ['FFF....', 'EEE....'], { t: 'drop', col: 3 }],
  ['up', ['E.F....', 'E.F....', 'E.F....'], { t: 'drop', col: 0 }],
  ['rising diagonal', ['..EF...', '.EFF...', 'EFEF.E.'], { t: 'drop', col: 3 }],
  ['falling diagonal', ['.FE....', '.FFE...', 'EFFFE..'], { t: 'drop', col: 1 }],
  ['a gap', ['FF.F...', 'EE.E...'], { t: 'drop', col: 2 }],
];

describe.each(ids)('%s', (id) => {
  it.each(winning)('takes a winning move: %s', (_n, rows, want) => {
    for (const seed of seeds) {
      const s = rack(rows);
      const m = chooseMove(s, opts(id, 'standard', seed)).move;
      applyMove(s, m);
      expect(s.winner, `seed ${seed} played ${JSON.stringify(m)}, wanted ${JSON.stringify(want)}`).toBe(1);
    }
  });
  it.each([
    ['across', ['EE.....', 'FFF.E..'], 3],
    ['up', ['F......', 'F.E....', 'F.E....'], 0],
    ['diagonal', ['..FE...', '.FEE...', 'FEFE.F.'], 3],
    ['a gap', ['EE.E.F.', 'FF.F.E.'], 2],
  ])('blocks a one-move loss: %s', (_n, rows, col) => {
    for (const seed of seeds) {
      const s = rack(rows);
      // Make sure the fixture really is a one-move loss and not a win for Ember.
      const probe = clone(s);
      probe.turn = 2;
      applyMove(probe, { t: 'drop', col });
      expect(probe.winner).toBe(2);
      const m = chooseMove(s, opts(id, 'standard', seed)).move;
      expect(m, `seed ${seed}`).toEqual({ t: 'drop', col });
    }
  });
  it('plays Frost as well as Ember', () => {
    const s = rack(['FFF....', 'EEE.E..'], { turn: 2 });
    for (const seed of seeds) expect(chooseMove(s, opts(id, 'standard', seed)).move).toEqual({ t: 'drop', col: 3 });
  });
  it('only returns legal moves through whole games in both rule sets', () => {
    const rng = makeRng(99);
    for (const mode of ['standard', 'masterstroke'] as Mode[]) {
      for (let g = 0; g < 4; g++) {
        const s = newGame(mode, [g % 4, (g + 1) % 4], g % 2 === 0 ? 1 : 2);
        let guard = 0;
        while (s.winner === 0 && guard++ < 120) {
          const m = s.turn === 1
            ? chooseMove(s, { ...opts(id, mode, g * 100 + guard), depth: Math.min(4, opts(id, mode, 0).depth), timeMs: undefined }).move
            : legalMoves(s)[Math.floor(rng() * legalMoves(s).length)];
          expect(isLegal(s, m)).toBe(true);
          applyMove(s, m);
        }
        expect(s.winner).not.toBe(0);
      }
    }
  });
  it('does not change the state it is given', () => {
    const s = rack(['EF.....']);
    const before = JSON.stringify(s);
    chooseMove(s, opts(id, 'standard', 3));
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('search', () => {
  it('the same seed gives the same move', () => {
    const s = rack(['..FE...', '..EF...']);
    const a = chooseMove(s, { depth: 6, seed: 42 });
    const b = chooseMove(s, { depth: 6, seed: 42 });
    expect(a.move).toEqual(b.move);
    expect(a.score).toBe(b.score);
  });
  it('Master reaches nine moves ahead in standard rules', () => {
    const s = newGame();
    applyMove(s, { t: 'drop', col: 3 });
    const r = chooseMove(s, { ...levelOpts('master', 'standard'), timeMs: 1, seed: 1 });
    expect(r.depth).toBeGreaterThanOrEqual(9);
  });
  it('finds a forced win two moves deep', () => {
    // Ember drops in column 1 or 4 to make an open three with two ends.
    const s = rack(['......F', '..EE..F']);
    const r = chooseMove(s, { depth: 5, seed: 1 });
    expect([1, 4]).toContain((r.move as { col: number }).col);
    expect(r.score).toBeGreaterThan(WIN - 100);
  });
  it('uses Hammerfall when it wins', () => {
    const s = rack(['...E...', 'EEEF...'], { mode: 'masterstroke', smiths: [0, 1] });
    expect(chooseMove(s, { depth: 3, seed: 1 }).move).toEqual({ t: 'hammerfall', col: 3 });
  });
  it('uses Upend when it wins', () => {
    const s = rack(['EEE....', 'FFF....', 'FEFE...'], { mode: 'masterstroke', smiths: [3, 0] });
    s.ready = [true, false];
    expect(chooseMove(s, { depth: 3, seed: 1 }).move).toEqual({ t: 'upend' });
  });
  it('uses Meltdown to break a double threat', () => {
    // Frost threatens both ends of F F F; a drop blocks only one.
    const s = rack(['.FFF.E.'], { mode: 'masterstroke', smiths: [2, 0] });
    s.ready = [true, false];
    const m = chooseMove(s, { depth: 4, seed: 1 }).move;
    expect(m.t).toBe('meltdown');
  });
  it('uses Quench to stop a double threat', () => {
    const s = rack(['.FFF.E.'], { mode: 'masterstroke', smiths: [1, 0] });
    s.ready = [true, false];
    const m = chooseMove(s, { depth: 4, seed: 1 }).move;
    expect(m.t).toBe('quench');
    expect([0, 4]).toContain((m as { col: number }).col);
  });
  it('sees the masterstroke its rival still holds', () => {
    // Frost holds Hammerfall. Knocking out the E under column 3 drops F into row 0 for F F F F,
    // and no drop by Ember can stop it.
    const s = rack(['...F...', 'FFFE.E.'], { mode: 'masterstroke', smiths: [1, 0] });
    s.ready = [false, true];
    expect(chooseMove(s, { depth: 4, seed: 1 }).score).toBeLessThan(-(WIN - 100));
    // With Hammerfall spent, the same rack is no threat.
    s.ready = [false, false];
    expect(chooseMove(s, { depth: 4, seed: 1 }).score).toBeGreaterThan(-(WIN - 100));
  });
  it('a spent masterstroke is never chosen', () => {
    const s = rack(['...E...', 'EEEF...'], { mode: 'masterstroke', smiths: [0, 1] });
    s.ready = [false, true];
    expect(chooseMove(s, { depth: 3, seed: 1 }).move.t).toBe('drop');
  });
  it('after a free Quench it drops', () => {
    const s = newGame('masterstroke', [1, 0]);
    applyMove(s, { t: 'drop', col: 3 });
    applyMove(s, { t: 'drop', col: 3 });
    applyMove(s, { t: 'quench', col: 2 });
    expect(chooseMove(s, { depth: 4, seed: 1 }).move.t).toBe('drop');
  });
});
