import { SMITHS, type Player } from '../rules';
import { LEVELS, type LevelId } from '../ai/levels';
import { DEFAULT_MIX, type Mix, type Sound } from '../audio';
import { Game, type Config, type Screens } from '../game';
import type { Quality } from '../world';

type Attrs = Record<string, string | number | boolean | ((e: Event) => void)>;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string | null)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k, v);
    else if (k === 'class') el.className = String(v);
    else if (typeof v === 'boolean') { if (v) el.setAttribute(k, ''); }
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids) if (kid !== null) el.append(kid);
  return el;
}

const BASE = import.meta.env.BASE_URL;

/** Art loads by name when the file is present; a drawn stand-in shows when it is not. */
export function art(path: string, label: string, cls: string): HTMLElement {
  const box = h('span', { class: 'art ' + cls, 'data-art': path });
  const stand = h('span', { class: 'stand-in' }, label);
  const img = h('img', { alt: '', draggable: 'false' });
  img.addEventListener('load', () => box.classList.add('loaded'));
  img.addEventListener('error', () => { img.remove(); box.classList.add('missing'); });
  img.src = BASE + 'assets/' + path;
  box.append(stand, img);
  return box;
}

const portrait = (i: number, cls = 'portrait') => art('portraits/' + SMITHS[i].id + '.jpg', SMITHS[i].short.slice(0, 1), cls);
const emblem = (i: number, cls = 'emblem') => art('strokes/' + SMITHS[i].stroke + '.jpg', SMITHS[i].strokeName.slice(0, 1), cls);

export interface Settings {
  quality: 'auto' | Quality;
  comfort: boolean;
  mode: 'standard' | 'masterstroke';
  smith: number;
  rivalSmith: number; // -1 is random
  rival: 'human' | LevelId;
}

const SETTINGS = 'crucible.settings';
const DEFAULTS: Settings = { quality: 'auto', comfort: false, mode: 'masterstroke', smith: 0, rivalSmith: -1, rival: 'journeyman' };

export class UI implements Screens {
  settings: Settings = { ...DEFAULTS };
  onQuality: (q: 'auto' | Quality) => void = () => {};
  private title = h('div', { class: 'screen title' });
  private duel = h('div', { class: 'duel', hidden: true });
  private bannerEl = h('div', { class: 'banner', hidden: true, role: 'status' });
  private faceEl = h('div', { class: 'faceoff', hidden: true });
  private resultEl = h('div', { class: 'overlay', hidden: true });
  private menuEl = h('div', { class: 'overlay', hidden: true });
  private mixerEl = h('div', { class: 'mixer panel', hidden: true });
  private status = h('div', { class: 'status', role: 'status' });
  private modeEl = h('div', { class: 'mode' });
  private cards: [HTMLElement, HTMLElement] = [h('div', { class: 'card ember' }), h('div', { class: 'card frost' })];
  private ledgerEl = h('ol', { class: 'ledger-list' });
  private ledgerBox = h('div', { class: 'ledger panel' });
  private statsEl = h('div', { class: 'stats panel' });
  private strokeBtn = h('button', { class: 'stroke-bar', type: 'button' });
  private bannerTimer = 0;
  private cardKey = '';

  constructor(root: HTMLElement, private game: Game, private sound: Sound) {
    try {
      const raw = localStorage.getItem(SETTINGS);
      if (raw) this.settings = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* defaults */ }
    game.screens = this;
    this.buildDuel();
    const speaker = h('button', { class: 'icon speaker', type: 'button', 'aria-label': 'Sound', title: 'Sound (M mutes)', click: () => this.toggleMixer() }, '\u266B');
    root.append(this.title, this.duel, this.faceEl, this.bannerEl, this.resultEl, this.menuEl, this.mixerEl, speaker);
    this.showTitle();
    window.addEventListener('keydown', (e) => this.key(e));
  }

  saveSettings(): void {
    try { localStorage.setItem(SETTINGS, JSON.stringify(this.settings)); } catch { /* private mode */ }
  }

  get covered(): boolean { return !this.title.hidden; }

  // ---- title and smith select ----

  showTitle(): void {
    const s = this.settings;
    const t = this.title;
    t.hidden = false;
    this.duel.hidden = true;
    t.replaceChildren();
    const embers = h('div', { class: 'embers', 'aria-hidden': 'true' });
    for (let i = 0; i < 36; i++) {
      const e = h('i');
      e.style.cssText = 'left:' + (Math.random() * 100).toFixed(1) + '%;animation-duration:' + (7 + Math.random() * 9).toFixed(1) + 's;animation-delay:-' + (Math.random() * 16).toFixed(1) + 's;--drift:' + ((Math.random() - 0.5) * 160).toFixed(0) + 'px;--size:' + (2 + Math.random() * 3).toFixed(1) + 'px';
      embers.append(e);
    }
    const seg = <T extends string | number>(label: string, opts: { v: T; text: string; title?: string }[], cur: T, set: (v: T) => void) =>
      h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label },
        ...opts.map((o) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(o.v === cur), class: o.v === cur ? 'on' : '', title: o.title ?? '', click: () => { set(o.v); this.sound.click(); this.saveSettings(); this.showTitle(); } }, o.text)));

    const cards = h('div', { class: 'smiths', role: 'radiogroup', 'aria-label': 'Your smith' },
      ...SMITHS.map((sm, i) => h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(i === s.smith), class: 'smith' + (i === s.smith ? ' on' : ''),
        click: () => { s.smith = i; this.sound.click(); this.saveSettings(); this.showTitle(); },
      },
        portrait(i),
        h('span', { class: 'smith-name' }, sm.name),
        h('span', { class: 'motto' }, '\u201C' + sm.motto + '\u201D'),
        h('span', { class: 'smith-stroke' + (s.mode === 'standard' ? ' off' : '') }, emblem(i), h('span', {}, h('b', {}, sm.strokeName), h('small', {}, sm.strokeDesc))),
      )));

    const saved = Game.saved();
    t.append(
      art('ui/title.jpg', '', 'key-art'),
      embers,
      h('div', { class: 'title-inner' },
        h('header', {},
          h('p', { class: 'over' }, 'A game of four in a row'),
          h('h1', {}, 'Crucible'),
          h('p', { class: 'tagline' }, 'Four smiths, one fire, and a single line of white-hot steel.'),
        ),
        h('div', { class: 'row' }, h('span', { class: 'label' }, 'Rules'),
          seg('Rules', [
            { v: 'standard', text: 'Standard', title: 'Four in a row, nothing else' },
            { v: 'masterstroke', text: 'Masterstroke', title: 'Each smith has one masterstroke per game' },
          ], s.mode, (v) => { s.mode = v as Settings['mode']; })),
        h('div', { class: 'label center' }, 'Your smith'),
        cards,
        h('div', { class: 'row' }, h('span', { class: 'label' }, 'Rival'),
          seg('Rival smith', [{ v: -1, text: 'Random' }, ...SMITHS.map((sm, i) => ({ v: i, text: sm.short }))], s.rivalSmith, (v) => { s.rivalSmith = v; })),
        h('div', { class: 'row' }, h('span', { class: 'label' }, 'Played by'),
          seg('Rival level', [...LEVELS.map((l) => ({ v: l.id as string, text: l.name, title: l.blurb })), { v: 'human', text: 'Second player', title: 'Two smiths on this device' }], s.rival as string, (v) => { s.rival = v as Settings['rival']; })),
        h('div', { class: 'go' },
          h('button', { class: 'primary', type: 'button', id: 'light', click: () => this.begin() }, 'Light the forge'),
          saved ? h('button', { class: 'secondary', type: 'button', id: 'return', click: () => this.resumeGame() }, 'Return to the forge') : null,
        ),
      ),
    );
  }

  private begin(): void {
    const s = this.settings;
    const rivalSmith = s.rivalSmith < 0 ? Math.floor(Math.random() * SMITHS.length) : s.rivalSmith;
    const cfg: Config = { mode: s.mode, smiths: [s.smith, rivalSmith], rival: s.rival };
    this.sound.start();
    this.title.hidden = true;
    this.duel.hidden = false;
    this.game.start(cfg);
  }

  private resumeGame(): void {
    this.sound.start();
    if (!this.game.resume()) { this.showTitle(); return; }
    this.title.hidden = true;
    this.duel.hidden = false;
    this.refresh();
  }

  // ---- the duel ----

  private buildDuel(): void {
    const g = this.game;
    this.strokeBtn.addEventListener('click', () => g.toggleStroke());
    const ledgerBtn = h('button', { class: 'icon ledger-btn', type: 'button', 'aria-label': 'Ledger', title: 'Forge ledger', click: () => this.ledgerBox.classList.toggle('open') }, '\u2630');
    this.ledgerBox.append(h('h3', {}, 'Forge ledger'), this.ledgerEl);
    this.duel.append(
      h('div', { class: 'top' }, this.modeEl, this.status,
        h('div', { class: 'top-buttons' },
          ledgerBtn,
          h('button', { class: 'icon', type: 'button', 'aria-label': 'Switch view', title: 'Switch view (Tab)', click: () => g.toggleView() }, '\u25CE'),
          h('button', { class: 'icon', type: 'button', id: 'menu', 'aria-label': 'Menu', title: 'Menu (Esc)', click: () => this.showMenu() }, '\u2261'))),
      h('div', { class: 'side left' }, this.cards[0], this.ledgerBox),
      h('div', { class: 'side right' }, this.cards[1], this.statsEl),
      this.strokeBtn,
    );
  }

  refresh(): void {
    const g = this.game;
    const s = g.shown;
    if (g.phase === 'title') return;
    if (g.phase !== 'faceoff') this.faceEl.hidden = true;
    const ms = g.cfg.mode === 'masterstroke';
    this.modeEl.textContent = ms ? 'Masterstroke rules' : 'Standard rules';
    this.status.textContent = g.statusText();
    this.status.dataset.turn = String(s.winner === 0 ? s.turn : s.winner);
    // Cards are rebuilt only when the smiths change, so portraits do not flicker.
    const key = g.cfg.smiths.join() + g.cfg.rival + g.cfg.mode;
    if (key !== this.cardKey) {
      this.cardKey = key;
      ([1, 2] as Player[]).forEach((p) => {
        const sm = g.smith(p);
        this.cards[p - 1].replaceChildren(
          portrait(g.cfg.smiths[p - 1], 'portrait small'),
          h('div', { class: 'card-text' },
            h('b', { class: 'card-name' }, sm.short),
            h('span', { class: 'card-who' }, g.cfg.rival === 'human' ? (p === 1 ? 'Ember' : 'Frost') : p === 1 ? 'You' : LEVELS.find((l) => l.id === g.cfg.rival)!.name),
            ms ? h('span', { class: 'card-stroke' }, h('i', { class: 'dot' }), sm.strokeName) : null),
        );
      });
    }
    ([1, 2] as Player[]).forEach((p) => {
      const c = this.cards[p - 1];
      c.classList.toggle('turn', s.winner === 0 && s.turn === p && g.phase === 'play');
      c.classList.toggle('ready', ms && g.state.ready[p - 1]);
      c.classList.toggle('spent', ms && !g.state.ready[p - 1]);
    });
    this.ledgerEl.replaceChildren(...g.ledger.slice(0, 40).map((l) => h('li', { class: l.player === 1 ? 'e' : 'f' }, h('b', {}, g.label(l.player) + ': '), l.text)));
    if (!g.ledger.length) this.ledgerEl.append(h('li', { class: 'none' }, 'No moves yet'));
    this.statsEl.replaceChildren(
      h('div', {}, h('span', {}, 'Drops'), h('b', { id: 'drops' }, String(s.drops))),
      h('div', {}, h('span', {}, 'Open lines'), h('b', { id: 'open-lines' }, String(g.openLineCount))),
      h('div', {}, h('span', {}, 'Slots left'), h('b', { class: g.lastSlots ? 'beat' : '' }, String(42 - s.cells.filter((c) => c !== 0).length))),
    );
    // The masterstroke bar shows the stroke of whoever is to act on this device.
    const p: Player = g.cfg.rival === 'human' ? (s.winner === 0 ? s.turn : 1) : 1;
    const sm = g.smith(p);
    const b = this.strokeBtn;
    b.hidden = !ms || g.phase !== 'play';
    b.dataset.side = String(p);
    b.classList.toggle('targeting', g.targeting);
    if (g.targeting) { b.textContent = sm.strokeName + ': pick a target (Esc cancels)'; b.disabled = false; }
    else if (!g.state.ready[p - 1]) { b.textContent = sm.strokeName + ': spent'; b.disabled = true; }
    else if (s.mustDrop) { b.textContent = sm.strokeName + ': spent'; b.disabled = true; }
    else { b.textContent = sm.strokeName + ': ready (G)'; b.disabled = !g.strokeAvailable; }
    b.title = sm.strokeDesc;
  }

  banner(title: string, sub: string, tone: 'ember' | 'frost' | 'blood' | 'ash', seconds: number, stroke?: string): void {
    const b = this.bannerEl;
    window.clearTimeout(this.bannerTimer);
    b.className = 'banner ' + tone;
    b.replaceChildren(h('div', {}, h('h2', {}, title), h('p', {}, sub)));
    if (stroke) b.prepend(art('strokes/' + stroke + '.jpg', title.slice(0, 1), 'emblem big'));
    b.hidden = false;
    void b.offsetWidth;
    b.classList.add('in');
    this.bannerTimer = window.setTimeout(() => { b.classList.remove('in'); this.bannerTimer = window.setTimeout(() => { b.hidden = true; }, 350); }, seconds * 1000);
  }

  faceOff(seconds: number): void {
    const g = this.game;
    const f = this.faceEl;
    const side = (p: Player) => h('div', { class: 'face ' + (p === 1 ? 'l' : 'r') }, portrait(g.cfg.smiths[p - 1], 'portrait huge'), h('b', {}, g.smith(p).name), h('span', {}, '\u201C' + g.smith(p).motto + '\u201D'));
    f.replaceChildren(side(1), h('div', { class: 'strike', 'aria-hidden': 'true' }), side(2), h('p', { class: 'skip' }, 'Any key skips'));
    f.hidden = false;
    f.classList.remove('out');
    window.setTimeout(() => f.classList.add('out'), seconds * 1000 - 400);
    window.setTimeout(() => { if (f.classList.contains('out')) f.hidden = true; }, seconds * 1000);
  }

  result(show: boolean): void {
    const r = this.resultEl;
    if (!show) { r.hidden = true; return; }
    const g = this.game;
    const sum = g.summary();
    const ms = g.cfg.mode === 'masterstroke';
    const w = sum.winner;
    const title = w === 3 ? 'Cold iron' : g.isRival(w as Player) ? 'Broken' : 'Forged';
    const line = w === 3 ? 'The rack is full and no line stands.' :
      g.cfg.rival === 'human' ? g.label(w as Player) + ' wins the duel.' :
      g.isRival(w as Player) ? g.smith(w as Player).name + ' wins the duel.' : 'You win the duel.';
    const row = (label: string, a: string, b: string) => h('tr', {}, h('th', {}, label), h('td', { class: 'e' }, a), h('td', { class: 'f' }, b));
    r.replaceChildren(h('div', { class: 'panel result ' + (w === 3 ? 'ash' : w === 1 ? 'ember' : 'frost'), role: 'dialog', 'aria-label': 'Result' },
      h('h2', {}, title),
      h('p', { class: 'result-line' }, line),
      h('p', { class: 'result-drops' }, sum.drops + ' drops'),
      h('table', {},
        h('thead', {}, row('', g.label(1), g.label(2))),
        h('tbody', {},
          row('Longest line', String(sum.longest[0]), String(sum.longest[1])),
          ms ? row('Masterstroke', g.smith(1).strokeName + (sum.used[0] ? ': used' : ': kept'), g.smith(2).strokeName + (sum.used[1] ? ': used' : ': kept')) : null)),
      h('div', { class: 'go' },
        h('button', { class: 'primary', type: 'button', id: 'again', click: () => { r.hidden = true; g.rematch(); } }, 'Strike again'),
        h('button', { class: 'secondary', type: 'button', id: 'new-smith', click: () => this.toTitle() }, 'Choose a new smith')),
    ));
    r.hidden = false;
    (r.querySelector('#again') as HTMLElement).focus();
  }

  private toTitle(): void {
    this.resultEl.hidden = true;
    this.menuEl.hidden = true;
    this.bannerEl.hidden = true;
    this.faceEl.hidden = true;
    this.game.quit();
    this.showTitle();
  }

  // ---- menu, help, mixer ----

  showMenu(help = false): void {
    const m = this.menuEl;
    const g = this.game;
    const s = this.settings;
    const close = () => { m.hidden = true; };
    const toggle = (label: string, on: boolean, set: (v: boolean) => void) => h('label', { class: 'check' }, (() => {
      const i = h('input', { type: 'checkbox' });
      i.checked = on;
      i.addEventListener('change', () => set(i.checked));
      return i;
    })(), label);
    const quality = h('select', { 'aria-label': 'Quality' }, ...(['auto', 'high', 'medium', 'low'] as const).map((q) => {
      const o = h('option', { value: q }, q === 'auto' ? 'Auto' : q[0].toUpperCase() + q.slice(1));
      o.selected = s.quality === q;
      return o;
    }));
    quality.addEventListener('change', () => { s.quality = quality.value as Settings['quality']; this.saveSettings(); this.onQuality(s.quality); });
    const keys: [string, string][] = [
      ['Aim', 'Move the pointer, or the left and right arrows. On touch, press and slide along the rack.'],
      ['Drop', 'Click, Enter, or the keys 1 to 7. On touch, lift the finger; slide off the rack to cancel.'],
      ['Masterstroke', 'G or the masterstroke bar, then pick a target. Esc cancels.'],
      ['Switch view', 'Tab, or the view button. Drag beside the rack to look around it.'],
      ['Faster', 'Hold Space to double the speed of any beat.'],
      ['Other', 'Esc menu, F1 help, M mute, F full screen, K comfort mode.'],
    ];
    m.replaceChildren(h('div', { class: 'panel menu', role: 'dialog', 'aria-label': 'Menu' },
      h('h2', {}, help ? 'How to play' : 'Menu'),
      h('p', {}, 'Take turns dropping medallions into the rack. The first smith to line up four, across, up or on a slant, wins. Under Masterstroke rules each smith may use their masterstroke once a game.'),
      h('dl', { class: 'keys' }, ...keys.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
      h('div', { class: 'menu-row' }, h('span', {}, 'Quality'), quality),
      toggle('Comfort mode: half the camera shake and rack sway', s.comfort, (v) => this.setComfort(v)),
      h('div', { class: 'go' },
        h('button', { class: 'primary', type: 'button', id: 'resume', click: close }, 'Back to the forge'),
        h('button', { class: 'secondary', type: 'button', click: () => this.fullscreen() }, 'Full screen'),
        g.phase !== 'title' ? h('button', { class: 'secondary', type: 'button', id: 'quit', click: () => this.toTitle() }, 'Leave the duel') : null),
    ));
    m.hidden = false;
    (m.querySelector('#resume') as HTMLElement).focus();
  }

  setComfort(on: boolean): void {
    this.settings.comfort = on;
    this.game.world.rig.comfort = on;
    this.game.world.rack.comfort = on;
    this.saveSettings();
  }

  private fullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }

  toggleMixer(): void {
    const m = this.mixerEl;
    if (!m.hidden) { m.hidden = true; return; }
    this.sound.start();
    const mix = this.sound.mix;
    const rows: [keyof Mix, string][] = [['master', 'Master'], ['music', 'Music'], ['musicPlay', 'Music during play'], ['effects', 'Effects'], ['lava', 'Lava'], ['bellows', 'Bellows'], ['hammers', 'Hammers']];
    const build = () => {
      m.replaceChildren(
        h('h3', {}, 'Sound'),
        ...rows.map(([k, label]) => {
          const out = h('output', {}, Math.round((mix[k] as number) * 100) + '%');
          const input = h('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round((mix[k] as number) * 100), 'aria-label': label, 'data-level': k });
          input.addEventListener('input', () => { (mix[k] as number) = Number(input.value) / 100; out.textContent = input.value + '%'; this.sound.save(); });
          return h('label', { class: 'slider' }, h('span', {}, label), input, out);
        }),
        h('label', { class: 'check' }, (() => {
          const i = h('input', { type: 'checkbox', id: 'ducking' });
          i.checked = mix.ducking;
          i.addEventListener('change', () => { mix.ducking = i.checked; this.sound.save(); });
          return i;
        })(), 'Duck the music under big moments'),
        h('div', { class: 'go' },
          h('button', { class: 'secondary', type: 'button', id: 'mute', click: () => { this.sound.toggleMute(); build(); } }, mix.muted ? 'Unmute' : 'Mute'),
          h('button', { class: 'secondary', type: 'button', id: 'mix-reset', click: () => { this.sound.reset(); Object.assign(mix, this.sound.mix); build(); } }, 'Reset'),
          h('button', { class: 'secondary', type: 'button', click: () => { m.hidden = true; } }, 'Close')),
      );
    };
    build();
    m.hidden = false;
    void DEFAULT_MIX;
  }

  private key(e: KeyboardEvent): void {
    const g = this.game;
    const typing = (e.target as HTMLElement | null)?.tagName === 'INPUT';
    if (e.key === 'F1') { e.preventDefault(); this.showMenu(true); return; }
    if (e.key === 'Escape') {
      if (!this.mixerEl.hidden) this.mixerEl.hidden = true;
      else if (!this.menuEl.hidden) this.menuEl.hidden = true;
      else if (g.phase === 'play' || g.phase === 'over') this.showMenu();
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'm' || e.key === 'M') { this.sound.start(); this.sound.toggleMute(); if (!this.mixerEl.hidden) { this.mixerEl.hidden = true; this.toggleMixer(); } }
    else if (e.key === 'f' || e.key === 'F') this.fullscreen();
    else if (e.key === 'k' || e.key === 'K') this.setComfort(!this.settings.comfort);
    else if (e.key === 'Tab' && g.phase === 'play' && this.menuEl.hidden && this.resultEl.hidden) { e.preventDefault(); g.toggleView(); }
  }
}
