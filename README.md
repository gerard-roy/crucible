# Crucible

Four in a row as a duel between smiths, played on an iron rack hung over a river of lava.

Play it: https://gerard-roy.github.io/crucible/

## How to play

Take turns dropping medallions into the rack. The first smith to line up four, across, up or on a slant, wins. A full rack with no line is a draw.

Under Masterstroke rules each smith has one masterstroke per game:

| Smith | Masterstroke | What it does |
| --- | --- | --- |
| Brakka Ironhand | Hammerfall | Knocks out the bottom medallion of a column (your own or slag). The rest drops one slot. Costs your turn. |
| Sylvi Frostvein | Quench | Freezes a column against your rival's next drop. Free, then you drop. |
| Master Oru | Meltdown | Turns one rival medallion into slag, which counts for no one. Costs your turn. |
| Vesper Quill | Upend | Turns the rack over. Every medallion falls to the new bottom. Costs your turn. |

| Action | Keyboard and mouse | Touch |
| --- | --- | --- |
| Aim | Move the pointer, or left and right arrows | Press and slide along the rack |
| Drop | Click, Enter, or the keys 1 to 7 | Lift the finger; slide off the rack to cancel |
| Masterstroke | G, then pick a target; Esc cancels | Masterstroke bar, then tap a target |
| Switch view | Tab | View button |
| Menu, help, mute, full screen, comfort mode | Esc, F1, M, F, K | Menu |

Hold Space to double the speed of any beat.

## Run

Needs Node 22.

```sh
npm ci
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## Test

```sh
npm test             # rules and search checks, including 2,000 random games per rule set
npm run balance      # level and smith win rates against the targets in docs/SPEC.md
npm run balance -- --quick
```

`node scripts/shot.mjs out.png 1440 900 'light;;skip;;3342'` drives a running dev server in headless Chromium and saves a screenshot.

## Deploy

Every push to `main` runs the tests, builds, and publishes `dist/` to GitHub Pages (`.github/workflows/pages.yml`). Pages must have its Source set to GitHub Actions.

## Swap the art

Art loads by name from `public/assets`. Replace a file with one of the same name and it is used; delete it and a drawn stand-in shows instead.

| File | Used for |
| --- | --- |
| `ui/title.jpg` | Title screen key art |
| `portraits/brakka.jpg`, `sylvi.jpg`, `oru.jpg`, `vesper.jpg` | Smith cards, HUD cards, face-off |
| `strokes/hammerfall.jpg`, `quench.jpg`, `meltdown.jpg`, `upend.jpg` | Masterstroke emblems and banners |
| `public/music/theme.mp3` | Music. When it is absent the game plays its generated score |

## Layout

- `src/rules.ts`: the rules engine, with no dependencies.
- `src/ai/`: alpha-beta search, the levels, and the Web Worker it runs in.
- `src/world/`: the three.js forge: rack, medallions, lava, hall, particles, camera, post-processing.
- `src/game.ts`: turns each move into timed beats. `src/beats.ts` is the queue.
- `src/audio.ts`: every sound, synthesized with Web Audio.
- `src/hud/ui.ts`: title, HUD, banners, result, menu and mixer.
- `docs/SPEC.md` is the build packet; `docs/DECISIONS.md` records the choices made where it left room.
