# Acceptance checklist: evidence so far

Status words: **Pass** means checked and seen; **Not met** means checked and it fails; **Not checked** means nobody has looked yet.
Browser checks ran in headless Chromium with a software renderer (no graphics card), so anything about frame rate is not checked.

## Rules and rivals

| Item | Status | Evidence |
| --- | --- | --- |
| `npm test` passes with at least 150 checks | Pass | 261 checks pass; CI runs them before each deploy |
| Master beats Journeyman 75 of 100, Journeyman beats Apprentice 85 | Pass, counting decided games only | Master on its in-game clock: 70 wins, 21 losses, 9 draws (76.9% of decided). Journeyman 93, 3, 4 (96.9%). Counting draws as non-wins, Master's 70 of 100 is under 75 |
| No smith wins more than 60% against another | Pass, on the edge | With Quench costing the turn, the default run has every pairing between 40% and 60% (widest: Sylvi 58.5% against Oru). Six seeds pooled, 1,200 games a pairing: widest is Sylvi 59.0% against Oru. Single 200-game runs of three pairings land up to two points outside the cap. Table in `docs/DECISIONS.md` |
| Every masterstroke obeys its limits; a spent one cannot be reused | Pass | Rules tests; in the browser each stroke left the expected rack and showed as spent |
| No computer move freezes the scene or lands in under 700ms | Partly | Four Master moves took 1201 to 1218ms. Freezing cannot be judged in a software renderer; the search runs in a Web Worker |

## The world

| Item | Status | Evidence |
| --- | --- | --- |
| 3D iron rack, 42 windows, chains, moving lava | Pass | Screenshots |
| Embers, smoke, roof shaft, hall silhouettes in one screenshot | Not checked | The shaft, embers and silhouettes show; smoke has not been confirmed by eye |
| Bloom, grade, vignette, grain on at High | Pass | Seen in the High screenshots and the winning-drop recording |
| Medallions light the rack; lava lights from below | Pass | Screenshots |
| Ember and Frost differ by sigil | Pass | Hammer and star |
| Does not look lesser beside Captain's Gambit | Not checked | Needs a side-by-side, and your eye |

## Staging

| Item | Status | Evidence |
| --- | --- | --- |
| Every drop has a fall, rattle, clang, sparks, sway | Pass | Sound log shows rattle, clang, sparks per drop; sparks and sway seen |
| Face-off, open-line glow, winning drop, loss, draw | Partly | Face-off, winning drop, loss ("Broken", scene dimmed to cold blue) and draw ("Cold iron", scene drained to grey) seen in High screenshots; the winning drop also in the 20-second recording. The open-line glow has not been looked at by eye |
| Each masterstroke has its banner and scene | Pass | All four played to the correct rack with their sounds |
| Outcome never shows before its beat | Pass | The HUD reads a copy of the state that updates after the beats |
| Heartbeat at six or fewer slots | Pass | In the drawn game the heartbeat was on at 36 drops (six slots left), had thumped 11 times by the end, and stopped when the game ended. Not listened to |

## Screens

| Item | Status | Evidence |
| --- | --- | --- |
| Title, cards, rules switch, rival picker with keyboard, mouse, touch | Partly | Mouse and touch-sized layout seen; all are native buttons. Keyboard-only run not yet done |
| Art loads by name; stand-ins when absent | Partly | Art loads. Stand-ins are written but not yet seen with a file removed |
| Ledger and both cards stay correct through a full game | Partly | Correct through the short games played; no full game checked |
| At 390 by 844 nothing overlaps; columns and buttons at least 44px | Pass | Columns measure 46px; no visible button under 44px in the title or the duel |

## Sound

| Item | Status | Evidence |
| --- | --- | --- |
| Every sound plays at its moment; the mixer changes each level | Partly | The sound log shows each effect fired at its moment. Nobody has listened, and the mixer has not been exercised |
| Generated score plays when no music file exists | Pass | With no `music/theme.mp3` the game reports its music source as generated. Not listened to |

## Delivery

| Item | Status | Evidence |
| --- | --- | --- |
| Frame-time log shows targets met at Medium and Low | Not checked | No graphics card on the build machine: the software renderer averaged 438ms a frame at Low, which says nothing about real hardware |
| Live link serves the latest commit; CI tests before deploy | Pass | https://gerard-roy.github.io/crucible/ |
| README covers play, run, test, deploy, swap art | Pass | README.md |
