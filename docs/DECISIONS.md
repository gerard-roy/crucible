# Decisions

Choices the packet left open, and changes made to hit its targets.

## Rules

- **A full rack with no line is a draw at once**, even if a smith still holds a masterstroke.
- **Two lines at once.** If a move leaves both smiths with a line, the smith who did not move wins (packet rule). Upend and Hammerfall are the only moves that can do this.
- **Quench costs the turn** (a balance lever, see below): the smith freezes a column instead of dropping. It thaws after the rival's next move.

## Balance

Measured with `npm run balance` (Journeyman against Journeyman, 200 games a pairing, first drop alternating, the first drop of each smith random so that games differ, draws left out). One 200-game run moves a pairing by several points either way, so the choices below were made on six seeds pooled (1,200 games a pairing, `--seed 1` to `--seed 6`).

Two levers are on: **Hammerfall cannot knock out a rival medallion** and **Quench costs the turn**. Upend stays legal from the first move.

| Pairing | Share of decided games, six seeds pooled | Lowest and highest single seed |
| --- | --- | --- |
| Brakka against Sylvi | Brakka 57.0% | 53% to 62% |
| Brakka against Oru | Brakka 50.8% | 45% to 55% |
| Brakka against Vesper | Brakka 55.0% | 52% to 57% |
| Sylvi against Oru | Sylvi 59.0% | 56% to 61% |
| Sylvi against Vesper | Vesper 54.1% | 49% to 62% |
| Oru against Vesper | Oru 53.0% | 45% to 59% |

Every pairing is inside 40-60% pooled, and on the script's default seed. Sylvi against Oru sits one point under the cap, and single 200-game runs of three pairings land a point or two outside it, so treat the cap as met on the edge rather than with room.

How it got there:

1. **With no levers, Brakka beat Vesper in 83% of decided games.** The cause is one pattern: Brakka makes three in a row with a gap, the rival must block the gap, Brakka drops on top of the blocker and then knocks the blocker out with Hammerfall, so his own medallion falls into the gap. Only Quench (freeze the column) or Meltdown (slag one of the three) answers it.
2. **The packet's wording of the Hammerfall lever** (only on a column that holds one of your own medallions) left Brakka at 85%, because in that pattern his own medallion is already in the column.
3. **Hammerfall as shipped cannot knock out a rival medallion.** The bottom medallion of the struck column must be Brakka's own or slag. This is a stricter reading of the packet's lever and it removes the pattern in point 1.
4. **A free Quench is a forced win.** Sylvi drops to make three in a row and, in the same turn, freezes the one column where the rival could block. Unless the rival can win at once or holds a masterstroke that breaks the line, she completes it next turn. The first balance runs missed this because the Journeyman spent Quench around its third move for a small gain. Once the search was told to keep a free Quench for a win, Sylvi won 93% of decided games against Brakka, 80% against Oru and 89% against Vesper (`npm run balance -- --only smiths --levers hammer`).
5. **So Quench costs the turn** (the packet's first lever). Sylvi freezes a column instead of dropping, and it thaws after the rival's next move. With that the table above holds.
6. An earlier note here said every pairing was inside the cap with Quench free. That was true only because of the wasted Quench in point 4, and on six seeds Oru beat Sylvi in 61.8% even then.

The balance script clears the search's memory before each pairing, so a pairing's result no longer depends on which games ran before it.

The smith cards read: Hammerfall "Knocks out the bottom medallion of one column, if it is yours or slag. The rest of that column drops one slot." Quench "Freezes one column. Your rival cannot drop there on their next turn." with the cost "Your turn".

## Rivals

- **Evaluation** counts open lines of two and three, and adds weight to a line one short whose empty slot cannot be filled yet, more when the row parity means the rival will be forced to fill the slot under it. Without the parity term a nine-ply search beat a five-ply one in only about 60% of decided games.
- **Masterstrokes in the search**: both smiths' masterstrokes are tried in the first two plies of every search (the mover's now, the rival's reply). Deeper plies are drops only, and a held masterstroke is worth a fixed bonus.
- **Master in the balance script** gets its in-game 1.2 s a move, so the level games take about 12 minutes. `--fast-clock` or `--quick` cut it to 250 ms; at 250 ms it won 66, lost 23 and drew 11 against Journeyman (74.2% of decided games), just under the target, against 70, 21 and 9 (76.9%) on the full clock.
- **Level targets are counted over decided games** ("draws left out"): Master must win 75% of decided games against Journeyman, Journeyman 85% against Apprentice.

## Staging and screens

- The HUD reads a copy of the state that only catches up once a move's beats have played, so an outcome never shows before its beat. The masterstroke shows as spent from its banner onward.
- The smith cards have no clips: the packet lists them as optional extras and no clip files were supplied. The selected card lifts and takes the ember border.
- The face-off lasts 6 seconds: 2.6 for the portraits and strike, 3.4 for the descent down the chains. Any key or a tap skips it.
- A win by masterstroke (no falling medallion) skips the slow fall and goes straight to the flash.
- In a hot-seat game either smith's win plays the "Forged" scene; "Broken" plays only when a computer rival wins.
- Meltdown is aimed with the pointer, or with the arrow keys and Enter.
- Auto quality starts at Medium, measures two seconds of frames once the forge is on screen, and moves once: to Low above 20ms a frame, to High below 11.5ms on a desktop.
