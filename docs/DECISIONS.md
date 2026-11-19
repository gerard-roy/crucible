# Decisions

Choices the packet left open, and changes made to hit its targets.

## Rules

- **A full rack with no line is a draw at once**, even if a smith still holds a masterstroke.
- **Two lines at once.** If a move leaves both smiths with a line, the smith who did not move wins (packet rule). Upend and Hammerfall are the only moves that can do this.
- **Quench is free**: the smith freezes a column and then still drops. It thaws after the rival's next drop.

## Balance

Measured with `npm run balance` (Journeyman against Journeyman, 200 games a pairing, first drop alternating, the first drop of each smith random so that games differ, draws left out).

1. **With no levers, Brakka beat Vesper in 83% of decided games.** The cause is one pattern: Brakka makes three in a row with a gap, the rival must block the gap, Brakka drops on top of the blocker and then knocks the blocker out with Hammerfall, so his own medallion falls into the gap. Only Quench (freeze the column) or Meltdown (slag one of the three) answers it.
2. **Lever tried: Hammerfall only on a column that holds one of your own medallions** (the packet's wording). Brakka against Vesper stayed at 85%, because in the pattern above Brakka's own medallion is already in the column. Adding "Quench costs the turn" or "Upend from the tenth move" on top made things worse or changed nothing (Brakka 78% against Sylvi; Brakka 80% against Vesper).
3. **Lever as shipped: Hammerfall cannot knock out a rival medallion.** The bottom medallion of the struck column must be Brakka's own or slag. This is a stricter reading of the packet's Hammerfall lever and it removes the pattern in point 1. Letting him knock out slag matters only against Oru and moved that pairing from 34% to 39-49% for Brakka.
4. Quench stays free and Upend stays legal from the first move.

Result on the script's fixed seed: every pairing is inside 40-60%. The closest pairing is Sylvi against Oru (Oru 59%); on one of the other seeds tried it reached 65%, so treat it as on the edge rather than settled.

The smith card text for Hammerfall reads: "Knocks out the bottom medallion of one column, if it is yours or slag. The rest of that column drops one slot."

## Rivals

- **Evaluation** counts open lines of two and three, and adds weight to a line one short whose empty slot cannot be filled yet, more when the row parity means the rival will be forced to fill the slot under it. Without the parity term a nine-ply search beat a five-ply one in only about 60% of decided games.
- **Masterstrokes in the search**: both smiths' masterstrokes are tried in the first two plies of every search (the mover's now, the rival's reply). Deeper plies are drops only, and a held masterstroke is worth a fixed bonus.
- **Master in the balance script** thinks for 250 ms a move instead of 1.2 s so that 100 games finish in a few minutes. In the game it gets the full clock, so it is stronger than the number printed.
- **Level targets are counted over decided games** ("draws left out"): Master must win 75% of decided games against Journeyman, Journeyman 85% against Apprentice.

## Staging and screens

- The HUD reads a copy of the state that only catches up once a move's beats have played, so an outcome never shows before its beat. The masterstroke shows as spent from its banner onward.
- The smith cards have no clips: the packet lists them as optional extras and no clip files were supplied. The selected card lifts and takes the ember border.
- The face-off lasts 6 seconds: 2.6 for the portraits and strike, 3.4 for the descent down the chains. Any key or a tap skips it.
- A win by masterstroke (no falling medallion) skips the slow fall and goes straight to the flash.
- In a hot-seat game either smith's win plays the "Forged" scene; "Broken" plays only when a computer rival wins.
- Meltdown is aimed with the pointer, or with the arrow keys and Enter.
- Auto quality starts at Medium, measures two seconds of frames once the forge is on screen, and moves once: to Low above 20ms a frame, to High below 11.5ms on a desktop.
