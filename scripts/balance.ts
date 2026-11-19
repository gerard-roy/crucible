// npm run balance: level strength in standard rules and smith win rates in masterstroke rules.
// The first drop alternates, draws are left out, and each smith's first drop is random so games differ.
// Usage: tsx scripts/balance.ts [--quick] [--fast-clock] [--seed n] [--only smiths|levels] [--pair 0,3] [--levers quench,hammer,upend]

import { chooseMove, resetSearch } from '../src/ai/search';
import { levelOpts, type LevelId } from '../src/ai/levels';
import { DEFAULT_LEVERS, SMITHS, applyMove, droppable, makeRng, newGame, type Levers, type Mode, type Player } from '../src/rules';

const args = process.argv.slice(2);
const quick = args.includes('--quick');
/** Master gets its in-game 1.2 s a move unless --quick or --fast-clock cut it to 250 ms. The level games take about 12 minutes on the full clock. */
const fullClock = !quick && !args.includes('--fast-clock');
const seedBase = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 1;
const leverArg = args.includes('--levers') ? args[args.indexOf('--levers') + 1] ?? '' : null;
/** Levers chosen for the shipped game live in src/settings; this flag tries others. */
const levers: Levers = leverArg === null ? DEFAULT_LEVERS : {
  quenchCostsTurn: leverArg.includes('quench'),
  hammerfallOwnOnly: leverArg.includes('hammer'),
  upendFromMove: leverArg.includes('upend') ? 10 : 1,
};

interface Tally { a: number; b: number; draws: number; plies: number }

function play(mode: Mode, smiths: [number, number], levels: [LevelId, LevelId], games: number, seed: number): Tally {
  const rng = makeRng(seed + seedBase * 1000);
  resetSearch();
  const t: Tally = { a: 0, b: 0, draws: 0, plies: 0 };
  for (let g = 0; g < games; g++) {
    const first: Player = g % 2 === 0 ? 1 : 2;
    const s = newGame(mode, smiths, first, levers);
    let ply = 0;
    while (s.winner === 0) {
      if (ply < 2) {
        const cols = droppable(s);
        applyMove(s, { t: 'drop', col: cols[Math.floor(rng() * cols.length)] });
      } else {
        const opts = levelOpts(levels[s.turn - 1], mode, false, !fullClock);
        applyMove(s, chooseMove(s, { ...opts, seed: Math.floor(rng() * 2 ** 31) }).move);
      }
      ply++;
    }
    t.plies += ply;
    if (s.winner === 1) t.a++;
    else if (s.winner === 2) t.b++;
    else t.draws++;
  }
  return t;
}

let failed = 0;
function check(label: string, ok: boolean, detail: string): void {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${detail}`);
}

const pct = (t: Tally): string => `${((t.a / Math.max(1, t.a + t.b)) * 100).toFixed(1)}%`;
const t0 = Date.now();
console.log(`Levers: ${JSON.stringify(levers)}\n`);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : '';
/** --pair 0,3 runs one smith pairing only. */
const pair = args.includes('--pair') ? args[args.indexOf('--pair') + 1].split(',').map(Number) : null;
if (only !== 'smiths') {
  console.log('Standard rules, 100 games each');
  const n = quick ? 30 : 100;
  const mj = play('standard', [0, 1], ['master', 'journeyman'], n, 1);
  check('Master beats Journeyman in at least 75 of 100 decided games', mj.a >= 0.75 * (mj.a + mj.b), `${pct(mj)}: ${mj.a} wins, ${mj.b} losses, ${mj.draws} draws left out`);
  const ja = play('standard', [0, 1], ['journeyman', 'apprentice'], n, 2);
  check('Journeyman beats Apprentice in at least 85 of 100 decided games', ja.a >= 0.85 * (ja.a + ja.b), `${pct(ja)}: ${ja.a} wins, ${ja.b} losses, ${ja.draws} draws left out`);
}

if (only !== 'levels') {
  console.log('\nMasterstroke rules, Journeyman against Journeyman, 200 games for each pairing');
  const n = quick ? 60 : 200;
  const totals = SMITHS.map(() => ({ w: 0, l: 0 }));
  for (let a = 0; a < SMITHS.length; a++) {
    for (let b = a + 1; b < SMITHS.length; b++) {
      if (pair && (pair[0] !== a || pair[1] !== b)) continue;
      const t = play('masterstroke', [a, b], ['journeyman', 'journeyman'], n, 100 + a * 10 + b);
      const decided = t.a + t.b;
      const share = decided ? t.a / decided : 0.5;
      totals[a].w += t.a; totals[a].l += t.b;
      totals[b].w += t.b; totals[b].l += t.a;
      check(
        `${SMITHS[a].short} against ${SMITHS[b].short}: neither above 60%`,
        share <= 0.6 && share >= 0.4,
        `${SMITHS[a].short} ${(share * 100).toFixed(1)}%, ${SMITHS[b].short} ${((1 - share) * 100).toFixed(1)}% (${t.a}-${t.b}, ${t.draws} draws, ${(t.plies / n).toFixed(1)} moves a game)`,
      );
    }
  }
  console.log('\nOverall');
  totals.forEach((x, i) => console.log(`  ${SMITHS[i].short.padEnd(7)} ${((x.w / Math.max(1, x.w + x.l)) * 100).toFixed(1)}% of ${x.w + x.l} decided games`));
}
console.log(`\n${failed === 0 ? 'All balance targets met' : `${failed} target(s) missed`} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
process.exit(failed === 0 ? 0 : 1);
