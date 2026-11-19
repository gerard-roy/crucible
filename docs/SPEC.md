# Crucible: Devin Build Packet

Nov 18, 2026 · @G

Connect 4 as a duel between smiths over a river of lava, built to the same recipe as Captain's Gambit.

## Do this first

Six steps get Devin building: three on GitHub, one export, one paste, and an art upload you can do later.

1. Create the repo. Go to github.com/new, name it `crucible`, choose Public, tick "Add a README", and create it.
2. Turn on Pages now. In the repo open Settings, then Pages, and set Source to GitHub Actions. This avoids the deploy failure you hit last time.
3. Give Devin the repo. In your GitHub account Settings open Applications, then Configure beside the Devin app. Under Repository access add `crucible` and save. Skip this if Devin already has all repositories.
4. Add this packet. Export this doc as Markdown. In the repo choose Add file, then Create new file, name it `docs/SPEC.md`, paste, and commit.
5. Start Devin. Open a new session on `crucible` and paste the kickoff prompt below.
6. Add the art when you have it. Generate the images in the Art sheet and name them exactly. Then attach them to a Devin message and ask it to add them, or upload them into `public/assets/` on GitHub.

The game runs on stand-in art until step 6 is done, so you can start Devin right away. The art matters, though: the portraits, clips and title painting in Captain's Gambit were generated in Higgsfield, according to its [repo](https://github.com/vincedelatorre/battleship-claude-higgsfield-devin). Any image generator works with the prompts in the Art sheet.

The live game will be at `https://gerard-roy.github.io/crucible/`. Crucible is a working title.

## Kickoff prompt

Paste this as the first message of the Devin session. It names Captain's Gambit as the bar, so Devin studies it before writing code.

```text
You are building Crucible: Connect 4 as a real-time 3D duel between smiths, played on an iron rack hung over a river of lava, in three.js. The full spec is in docs/SPEC.md. Read all of it before you plan.

The bar
- The reference is Captain's Gambit: https://vincedelatorre.github.io/battleship-claude-higgsfield-devin/ (source: https://github.com/vincedelatorre/battleship-claude-higgsfield-devin). Open it, play it, and read its README before you start.
- Crucible must feel like it belongs beside that game: a live 3D world, characters with powers, staged cinematic moments, music, and painted art.
- A flat 2D board is a failure, even if every rule works.

How to work
1. Send me a short plan that follows the seven milestones below, then begin.
2. Commit after every milestone. Deploy to GitHub Pages at the end of milestone 2 and send me the link. Keep it working from then on.
3. Art files may not be in the repo yet. Build the stand-ins the spec describes, and load the real files by name when they appear.
4. When the spec leaves a choice open, choose what looks and feels best in the running game, and record it in docs/DECISIONS.md. Do not stop to ask unless you are blocked.
5. Look at your own work. After each milestone from 4 onward, play the game in a browser, take screenshots, and compare them with the spec and with Captain's Gambit. Fix what looks cheap before moving on.

Milestones
1. Rules engine with both rule sets and unit tests. No UI.
2. Grey-box 3D: a plain rack, discs that fall, two players on one device. Deployed.
3. Computer rivals at three levels in a Web Worker, masterstrokes included, plus the balance script.
4. The world: rack, medallions, lava, hall, chains, crane, particles, post-processing.
5. Staging: the beat queue, the feel of the drop, the threat tell, four masterstroke scenes, the face-off, win, loss and draw.
6. Screens and HUD, sound and music, phone layout.
7. Verification: tests, performance at the three quality levels, every box in "Acceptance checklist".

When you finish, reply with
- The live link and the repo link.
- The acceptance checklist, pass or fail for each item, with evidence.
- Screenshots of the title, smith select, mid-game, each masterstroke and the win, at 1440x900 and at 390x844.
- A 20-second screen recording of a winning drop.
- Anything you could not do, and why.
```

## The game

Crucible is a duel between two smiths in a forge hall inside a volcano. The board is a towering iron rack, seven columns wide and six slots high, hung by chains over a river of lava.

Each move drops a heavy cast medallion down a column. Yours glow orange like hot iron, and your rival's glow cold blue. Every drop rattles, clangs, throws sparks and sways the rack. Four in a line fuse along a white-hot seam and win the forge.

### What it borrows from Captain's Gambit

| Captain's Gambit | Crucible |
| --- | --- |
| The chart is a live 3D storm sea | The board is a live 3D rack over flowing lava |
| Four captains, each with one Gambit | Four smiths, each with one masterstroke |
| Standard rules or Gambit rules | Standard rules or Masterstroke rules |
| Painted key art, portraits and looping clips | The same set of art, from the Art sheet |
| A versus intro before the battle | A face-off: two portraits, a hammer strike, a burst of sparks |
| Each shot is revealed only when the ball lands | Each drop plays out as timed beats, and the winning drop falls in slow motion |
| Banners, camera shake and a heartbeat near the end | The same, plus medallions that glow hotter when a line of three is open |
| Music, storm ambience and a sound mixer | Music, lava and bellows ambience, and the same mixer |
| A chart view and a walkable deck view | A rack view and a slow orbit of the forge |

The left column comes from its live title screen, its README and its source code.

### The five showpieces

These are the moments a player shows a friend. Each must look finished before anything else is polished.

1. The drop. Weight, rattle, clang, sparks and sway, on every single move.
2. The lava. A living river that lights the whole hall from below.
3. The winning drop. Slow motion, silence, then the weld.
4. The four masterstrokes. Each is a short scene worth using just to watch.
5. The face-off. Two smiths, one hammer strike, and sparks across the screen.

## Rules and masterstrokes

Standard rules are Connect 4 on a rack seven columns wide and six slots high. Masterstroke rules add one power per smith, used once a game.

### Standard rules

1. Two smiths play. You are Ember. Your rival is Frost: a computer smith, or a friend on the same device.
2. Smiths take turns dropping one medallion into a column that is not full. It falls to the lowest empty slot.
3. Four of your medallions in a line wins. Lines run across, up, or along either diagonal.
4. If the rack fills with no line, the game is a draw.
5. Ember drops first in the first game. The first drop alternates on every rematch.

### Masterstroke rules

Each smith has one masterstroke. It is ready from the first turn and is spent when used.

| Smith | Motto | Masterstroke | What it does | Cost |
| --- | --- | --- | --- | --- |
| Brakka Ironhand | Hit it until it rings true. | Hammerfall | Knocks out the bottom medallion of one column. The rest of that column drops one slot | Your turn |
| Sylvi Frostvein | Cold hands, clean steel. | Quench | Freezes one column. Your rival cannot drop there on their next turn | Free, then you drop |
| Master Oru | Everything melts. Be patient. | Meltdown | Turns one rival medallion into slag. It stays in place and counts for no one | Your turn |
| Vesper Quill | If the rack is against you, turn the rack. | Upend | Turns the rack upside down. Every medallion falls to the new bottom of its column | Your turn |

- Slag falls like any medallion and can never be part of a line.
- Quench blocks drops only. Hammerfall, Meltdown and Upend still reach a frozen column.
- Quench cannot freeze the only column that is still open.
- Lines are checked after every move, masterstrokes included.
- If a move leaves both smiths with a line, the smith who did not move wins.
- Both smiths may pick the same character.

### Computer rivals

| Level | How it plays |
| --- | --- |
| Apprentice | Looks two moves ahead. One move in three is random, though never one that loses at once |
| Journeyman | Looks five moves ahead |
| Master | Searches for 1.2 seconds, or 0.8 on phones, and reaches at least nine moves ahead in Standard rules |

- The search is alpha-beta with iterative deepening, on bitboards, in a Web Worker.
- Masterstrokes are moves in the search for both sides, so a rival plans around the one you still hold.
- Every computer move takes at least 700ms on screen.
- A seed makes the search repeatable in tests.

### Balance targets

`npm run balance` must print these checks, with the first drop alternating and draws left out.

- Standard rules, 100 games: Master beats Journeyman in at least 75, and Journeyman beats Apprentice in at least 85.
- Masterstroke rules, 200 games for each pairing of smiths at Journeyman level: no smith wins more than 60% against another.
- If a smith falls outside that range, change one lever at a time and record it in `docs/DECISIONS.md`.
- The levers are: make Quench cost the turn; let Hammerfall strike only a column that holds one of your own medallions; allow Upend only from the tenth move.

## Screens and staging

The game has three screens, and every turn plays as a queue of timed beats. Nothing changes on the rack without a beat showing it.

### Screens

1. Title and smith select. The key art fills the screen with embers drifting over it. "A game of four in a row" sits above the name. The tagline sits below: "Four smiths, one fire, and a single line of white-hot steel."
2. The duel. The 3D forge with the HUD over it.
3. Result. A panel over the final scene.

The title screen holds a switch for Standard rules or Masterstroke rules and four smith cards. Each card shows the portrait, name, motto, masterstroke emblem, its name and one line about it. The selected card lifts 6px, takes an ember border and plays its clip. Below the cards the player picks a rival: any smith or a random one, at Apprentice, Journeyman or Master level, or a second player on the same device. The main button reads "Light the forge".

### HUD

```text
+------------------------------------------------------------------+
| Masterstroke rules           Your drop                    [menu] |
|                                                                  |
| +--------------+       1 2 3 4 5 6 7       +----------------+    |
| | Brakka       |      +---------------+    | Sylvi          |    |
| | Hammerfall * |      |               |    | Quench *       |    |
| +--------------+      |   THE RACK    |    +----------------+    |
| | Ledger       |      |               |    | Drops      14  |    |
| | You: col 4   |      +---------------+    | Open lines  1  |    |
| | Sylvi: col 3 |          ~ lava ~         +----------------+    |
| +--------------+                                                 |
|                                                                  |
|                  [ Hammerfall: ready (G) ]                       |
| [sound]                                                          |
+------------------------------------------------------------------+
```

- Left: your smith's card with portrait, masterstroke and a dot that glows while it is ready. Below it, the forge ledger lists moves, newest first.
- Right: the rival's card, then the count of drops and of open lines of three.
- Bottom: the masterstroke bar. The sound button sits bottom left on every screen.
- On phones the two cards become chips at the top, the ledger moves behind a button, and the rack spans the width.

### Beats

| Moment | What plays | Length |
| --- | --- | --- |
| Face-off | The two portraits slam together with a hammer strike and a burst of sparks. The camera then descends the chains to the rack. Banner: "Light the forge" | 6s; any key skips |
| Aim | A crane carries the next medallion above the column under the pointer. A faint ghost shows where it will land | Live |
| Drop | The medallion falls with real acceleration, rattles in the channel and lands with a clang. Sparks fly, the rack sways and the lava flares | 350 to 650ms by height, plus 300ms to settle |
| Open line | When a smith has three in a line with a playable fourth slot, those three glow hotter and a low rumble starts | Until it is answered |
| Hammerfall | A great hammer swings in from the side and strikes the column's base. The bottom medallion bursts into sparks and the column drops with a triple clang | 1.2s banner, then 2.5s |
| Quench | Water cascades down the column, steam bursts out, and frost creeps over the channel, which glows blue | 1.2s banner, then 2s |
| Meltdown | The medallion turns white, sags and drips away, leaving a dull slag puck | 1.2s banner, then 2s |
| Upend | The chains ratchet, the rack turns over, and every medallion tumbles and resettles while the camera pulls back | 1.2s banner, then 3.5s |
| Winning drop | The last third of the fall plays in slow motion while the music cuts out. On impact there is a white flash, the four fuse along a seam, runes ignite across the rack and molten metal pours from above. Banner: "Forged" | 4.5s, then the result panel |
| Loss | The rival's seam forms and your fires dim. Banner: "Broken", with the rival's name | 3.5s |
| Draw | The rack cools to grey. Banner: "Cold iron" | 3s |
| Last slots | When six or fewer slots remain, a heartbeat starts | Until the game ends |

- The rules engine decides the outcome first, and the beats then reveal it in order.
- Holding Space doubles the speed of any beat except the winning drop.
- The result panel shows the winner, the number of drops, the longest line each smith built and whether each masterstroke was used. Its buttons read "Strike again" and "Choose a new smith".

### Controls

| Action | Keyboard and mouse | Touch |
| --- | --- | --- |
| Aim | Move the pointer, or left and right arrows | Press and slide along the rack |
| Drop | Click, Enter, or the keys 1 to 7 | Lift the finger; slide off the rack to cancel |
| Masterstroke | G, then pick a target; Esc cancels | Masterstroke bar, then tap a target |
| Switch view | Tab | View button |
| Menu, help, mute, full screen, comfort mode | Esc, F1, M, F, K | Menu |

Comfort mode halves camera shake and rack sway.

## World and look

The whole game is one real-time three.js scene: black iron lit from below by lava and from above by one cold shaft of light. Darkness, glow, sparks and smoke do the work, so simple geometry reads as rich.

### The rack and the medallions

- The rack is a forged iron frame 7.6 units wide and 6.6 tall, where one slot is 1 unit. Its front plate has 42 round windows, with rivets and worn runes between them.
- Four heavy chains hold it over the lava. It sways a few degrees after each drop and settles within a second.
- A medallion is a thick cast disc, 0.86 across and 0.18 deep, with a raised sigil on its face.
- Ember medallions carry a hammer sigil and glow orange from within. Frost medallions carry a star sigil and glow blue-white. The sigils differ so colour is never the only signal.
- The six most recent medallions each cast real light. Older ones only glow.
- Slag is a cracked grey puck with a faint, dying red in its cracks.
- A crane on an overhead rail carries the next medallion in iron tongs and follows the pointer.

### The forge hall

- The lava river runs under the rack. Its shader scrolls two layers of noise, with dark crust plates and bright cracks, and it bubbles now and then.
- The cavern walls stay in darkness. Silhouettes of two giant anvils, hanging chains, slow cog wheels and a pumping bellows give it scale.
- A crack in the roof lets in a shaft of cold blue light with ash drifting through it.
- 2,000 embers rise from the lava at the High level. Each impact throws 120 sparks that bounce once and die.
- Smoke hangs in two slow layers. Heat haze distorts the view just above the lava at the High level.

### Light, grade and camera

- The key light is the lava, warm and from below (#FF7A1A). The roof shaft gives a cold rim from the top left (#6FB8FF). Everything else falls to black.
- Post-processing runs in this order: bloom, ACES tone mapping, a grade with deep blue shadows and orange highlights, a 0.4 vignette and 0.04 film grain.
- Each impact flashes a short warm light at the landing slot.
- Rack view looks at the rack from the front, slightly below centre and 5 degrees off axis, with lava below and chains above. Dragging orbits 30 degrees either way.
- Forge view is a slow orbit of the whole hall. The game stays playable there with the number keys.
- Every camera move eases on a damped spring. The winning drop and each masterstroke have their own camera moves.
- Shake decays within a second. A normal drop adds a little, Hammerfall and Upend add a lot.

### Colour and type for the HUD

| Token | Value | Use |
| --- | --- | --- |
| `--soot` | #0B0908 | Page background |
| `--panel` | rgba(14, 11, 10, 0.88) | HUD panels, with no backdrop blur |
| `--bronze` | #B08D57 | Panel borders at 35%, headings, key hints |
| `--ash` | #EAE2D6 | Primary text |
| `--ash-dim` | #A59B8E | Secondary text |
| `--ember` | #FF7A1A | Your medallions, the main button |
| `--molten` | #FFC24A | A ready masterstroke, the focus ring |
| `--frost` | #6FD6FF | The rival's medallions, Quench |
| `--blood` | #B3362B | The loss banner |

Grenze Gotisch 700 sets the name, banners, smith names and buttons. Vollkorn 400, with its italic for mottos, sets everything else. The name is clamp(48px, 8vw, 112px), banners are clamp(40px, 6vw, 76px), body text is 17px and small text is 14px. Panels have 3px corners.

## Art sheet

Nine images give the game its faces, and four optional clips bring them to life. Generate them with any image tool, save them under these exact names, and the game picks them up.

Start every prompt with this style line:

```text
Painterly cinematic concept art, lit from below by orange lava glow with a cold blue rim light, sparks and smoke, rich detail, high contrast, no text, no logos.
```

| File in `public/assets/` | Size | Prompt, after the style line |
| --- | --- | --- |
| `ui/title.jpg` | 2560 x 1440 | A colossal iron rack of seven columns hanging by chains over a river of lava, inside a volcanic forge hall. Glowing orange and blue medallions sit in its slots. Smiths stand in silhouette on gantries. A shaft of cold blue light falls from a crack in the roof. Dark empty space in the upper third. |
| `portraits/brakka.jpg` | 1024 x 1024 | Head and shoulders of a broad-shouldered woman blacksmith with burn-scarred forearms and a leather apron. A huge hammer rests on her shoulder. Soot on her face, sparks around her. |
| `portraits/sylvi.jpg` | 1024 x 1024 | Head and shoulders of a pale, sharp-eyed smith in a fur-collared coat rimed with frost. She holds tongs gripping a steaming blue-white ingot. Her breath mists in the heat. |
| `portraits/oru.jpg` | 1024 x 1024 | Head and shoulders of an old master founder with a bald head and a long braided grey beard. Smoked-glass goggles are pushed up on his brow. He pours molten metal from a ladle. |
| `portraits/vesper.jpg` | 1024 x 1024 | Head and shoulders of a wiry young rigger with a chain wrapped around one arm and brass gears at the belt. Hauling on a chain hoist and grinning, with embers swirling. |
| `strokes/hammerfall.jpg` | 512 x 512 | A great hammer striking an iron column in a burst of sparks. |
| `strokes/quench.jpg` | 512 x 512 | Water pouring over glowing steel, with steam and frost spreading. |
| `strokes/meltdown.jpg` | 512 x 512 | A glowing metal disc melting into white-hot drips. |
| `strokes/upend.jpg` | 512 x 512 | An iron rack turning over on heavy chains while discs tumble. |

### Optional extras

- Clips: `video/brakka.mp4` and one for each other smith. Each is 8 seconds, 720 x 720 and silent. Make each from its portrait so the first and last frames match it. Ask for drifting sparks, breathing and a slow turn of the head.
- Music: `music/theme.mp3`, a loop of 2 to 4 minutes. Use only a track you have the rights to. Without it the game plays its own generated score.

### Rules for the art

- The characters are original. Do not name real people, films or existing characters in a prompt.
- Crop portraits tightly on the face. The game shows them from 88px to 250px wide.
- Keep the fire below and the cold light above in every image, so the set matches the 3D scene.

### Stand-ins

Devin builds these so the game is complete before any art exists.

- Title: the live 3D forge on a slow orbit, darkened by 30%.
- Portraits: the smith's masterstroke icon in ember on a dark gradient, with the smith's initial.
- Emblems: line icons drawn in SVG.
- At start the game checks for each file and uses whichever exists. No code changes when the art arrives.

## Sound and music

Every effect is synthesized with the Web Audio API when the game starts, as in Captain's Gambit. Music streams from a file when one exists and is generated when it does not.

| Sound | Recipe |
| --- | --- |
| Crane | A chain rattle while it travels, pitched by its speed |
| Drop | A metallic rattle down the channel, then a clang built from inharmonic partials. Lower slots ring deeper |
| Sparks | Short, bright bursts of noise |
| Open line | A low rumble that swells while a line of three stands open |
| Hammerfall | A whoosh, a huge anvil strike, then three clangs as the column drops |
| Quench | A roar of steam from filtered noise, then cracking ice |
| Meltdown | A rising whine, a hiss and a wet drop |
| Upend | Ratcheting chains, a deep groan of iron, then a tumble of clangs |
| Winning drop | Silence during the slow fall, then a bell-like strike with a long tail and a roar of fire |
| Heartbeat | Two low thumps every 1.25 seconds once six or fewer slots remain |

### Ambience and music

- Three ambience loops run under everything: the lava's rumble, the slow breath of the bellows, and distant hammering.
- If `music/theme.mp3` exists, the game streams and loops it through an audio element.
- Otherwise it plays a generated score: a low drone, anvil-strike percussion at 84 beats a minute, and a slow four-note motif.
- Music is quieter during play than on the title screen, and it ducks under masterstrokes and the winning drop.
- When six or fewer slots remain, the percussion drops out and leaves the drone and the heartbeat.

### Mixer

The speaker button opens a panel with a slider for each level, a switch for ducking, Mute and Reset. Settings save in the browser, and sound starts on the first click.

| Level | Default |
| --- | --- |
| Master | 80% |
| Music | 55% |
| Music during play | 35% |
| Effects | 80% |
| Lava | 8% |
| Bellows | 6% |
| Hammers | 10% |

## Technical spec

Crucible is a static site built with Vite and three.js, with no server. It deploys to GitHub Pages on every push to main.

| Area | Choice |
| --- | --- |
| Build | Vite with TypeScript modules |
| 3D | three.js, with EffectComposer for bloom, grade, vignette and grain |
| HUD | HTML and CSS over the canvas |
| Rules | A pure module with no browser code |
| Computer rivals | Alpha-beta search in a Web Worker |
| Staging | A beat queue, where each beat has a length, a start and an end |
| Sound | Web Audio |
| Tests | A rules and search suite run by `npm test`, and `npm run balance` |
| Deploy | GitHub Actions to GitHub Pages, with tests run first |

### Files

```text
docs/SPEC.md              this packet
docs/DECISIONS.md         choices Devin made
src/rules.ts              the grid, drops, lines, both rule sets, masterstrokes
src/ai/search.ts          alpha-beta search on bitboards
src/ai/worker.ts          Web Worker wrapper
src/ai/levels.ts          Apprentice, Journeyman, Master
src/game.ts               controller: screens, turns, the beat queue
src/world/rack.ts         frame, front plate, chains, sway
src/world/medallions.ts   discs, sigils, glow, slag, falling
src/world/forge.ts        lava, hall silhouettes, roof shaft, crane
src/world/effects.ts      sparks, embers, smoke, steam, heat haze
src/world/camera.ts       views, scene cameras, shake
src/world/post.ts         bloom, tone mapping, grade, grain
src/hud/                  title, cards, HUD, ledger, result, settings, help
src/audio.ts              effects, ambience, generated score, mixer
src/art.ts                loads art by name and falls back to stand-ins
public/assets/            art from the Art sheet
tests/                    rules and search checks
scripts/balance.ts        level strength and smith win rates
.github/workflows/pages.yml
```

### Quality levels

| Level | For | Settings |
| --- | --- | --- |
| High | Desktops with a dedicated graphics card | Pixel ratio up to 2, 2,000 embers, heat haze, all post-processing |
| Medium | Laptops with integrated graphics | Pixel ratio up to 1.5, 1,000 embers, no heat haze, bloom at half resolution |
| Low | Phones and older machines | Pixel ratio 1, 300 embers, no grain, three real lights |

- The game starts at Medium, measures frame time for two seconds and moves up or down once. The menu can override it.
- Targets are 60 frames a second at Medium and 30 at Low.
- Nothing 3D is drawn while a full-screen panel covers it.
- Without WebGL 2 the game shows a plain message that names the problem and how to fix it.

### Budgets and saving

- Code stays under 600 KB compressed. Art stays under 12 MB in total.
- The title screen appears within 4 seconds on a 20 Mbps connection, behind a loading bar.
- Settings, mixer levels and the last smith are saved in the browser.
- A game in progress is saved after every move. On return the title offers "Return to the forge".

### Tests

- `npm test` runs at least 150 checks. They cover falling, all four line directions, the full-rack draw, each masterstroke with its limits, and the two-lines rule.
- The suite also plays 2,000 random full games in each rule set and fails on any illegal state.
- Search tests confirm that every level takes a winning move and blocks a one-move loss.
- `npm run balance` prints the checks in "Balance targets".

## Acceptance checklist

The game is done when all 25 items pass. Devin reports each with evidence, and you tick the box once you have seen it on the live link.

### Rules and rivals

- [ ] `npm test` passes with at least 150 checks.
- [ ] Master beats Journeyman in at least 75 of 100 standard games, and Journeyman beats Apprentice in at least 85.
- [ ] No smith wins more than 60% against another in Masterstroke games.
- [ ] Every masterstroke obeys its limits, and a spent one cannot be used again.
- [ ] No computer move freezes the scene, and none lands in under 700ms.

### The world

- [ ] The board is a 3D iron rack with 42 windows, hung on chains over moving lava.
- [ ] Embers, smoke, the roof shaft and the hall silhouettes all show in one screenshot.
- [ ] Bloom, the colour grade, the vignette and grain are on at the High level.
- [ ] Medallions light the rack around them, and the lava lights the scene from below.
- [ ] Ember and Frost medallions differ by sigil as well as colour.
- [ ] Beside a screenshot of Captain's Gambit, the game does not look like a lesser one.

### Staging

- [ ] Every drop has a fall, a rattle, a clang, sparks and sway.
- [ ] The face-off, the open-line glow, the winning drop, the loss and the draw each play as specified.
- [ ] Each of the four masterstrokes has its own banner and scene.
- [ ] The outcome of a move never shows before its beat.
- [ ] The heartbeat starts when six or fewer slots remain.

### Screens

- [ ] The title, smith cards, rules switch and rival picker work with keyboard, mouse and touch.
- [ ] Art files load by name when present, and stand-ins show when they are absent.
- [ ] The ledger and both smith cards stay correct through a full game.
- [ ] At 390 by 844 nothing overlaps, and every column and button is at least 44px wide.

### Sound

- [ ] Every sound in the table plays at its moment, and the mixer changes each level.
- [ ] The generated score plays when no music file exists.

### Delivery

- [ ] A frame-time log shows the targets met at Medium and at Low.
- [ ] The live link serves the latest commit, and CI runs the tests before each deploy.
- [ ] The README covers how to play, run, test, deploy and swap art.

## Follow-up prompts

Send these after the first build, one session each. The first one closes most of the gap to Captain's Gambit, so do not skip it.

### 1. Looks review

```text
Do a looks review of Crucible against Captain's Gambit and against docs/SPEC.md.

1. Open Captain's Gambit and Crucible side by side. Take matching screenshots: title, character select, mid-game, a big moment, the result.
2. For each pair, list what makes ours look cheaper. Be blunt. Look at lighting, depth, atmosphere, materials, type, and how the HUD sits on the scene.
3. Fix the ten worst items, starting with anything in the five showpieces.
4. Check "World and look" line by line and build whatever is missing.
5. Reply with before and after screenshots for every fix.
```

### 2. Staging and feel

```text
Tune the staging of Crucible. Change timing, camera, sound and effects only. Do not change the rules or the layout.

1. Record the face-off, five ordinary drops, each masterstroke, a winning drop, a loss and a draw.
2. Check each against the Beats table and the Sound table in docs/SPEC.md. Fix anything missing, late, too long or out of sync.
3. Make the ordinary drop feel heavy. The fall, the rattle, the clang, the sparks, the sway and the lava flare must land within 100ms of each other.
4. Make the winning drop the best five seconds in the game: slow motion, silence, flash, seam, runes, pour.
5. Reply with the new recordings and a list of every value you changed.
```

### 3. Art in, then hardening

Send this once the images from the Art sheet are in the repo.

```text
The art from the Art sheet is now in public/assets. Fit it, then harden the game.

1. Check that every file loads, is cropped well at each size it is shown, and sits well with the HUD colours. Compress anything over 600 KB.
2. Rework the title screen around the key art. The name, tagline, cards and button must sit on it cleanly at 1440x900 and at 390x844.
3. Run every item in "Acceptance checklist" again and fix each failure.
4. Test in Chrome, Firefox and Safari, and at phone size with touch. Play five full games in each rule set while watching the console.
5. Reply with the checklist, pass or fail with evidence, and screenshots of the title and smith select with the real art.
```
