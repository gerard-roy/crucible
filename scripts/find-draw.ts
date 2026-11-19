// Prints a sequence of columns (1 to 7) that fills the rack with no line: a drawn standard game.
import { applyMove, droppable, clone, newGame, makeRng } from '../src/rules';
for (let seed = 1; seed < 200000; seed++) {
  const rng = makeRng(seed);
  const s = newGame('standard');
  let seq = '';
  while (s.winner === 0) {
    const cols = droppable(s);
    // Prefer a drop that does not end the game with a line.
    const safe = cols.filter((c) => { const t = clone(s); const o = applyMove(t, { t: 'drop', col: c }); return o.winner === 0 || o.winner === 3; });
    const pick = (safe.length ? safe : cols)[Math.floor(rng() * (safe.length ? safe.length : cols.length))];
    applyMove(s, { t: 'drop', col: pick });
    seq += String(pick + 1);
  }
  if (s.winner === 3) { console.log(seq); break; }
}
