/**
 * The menus, in plain HTML over the canvas: the title screen with the live scene behind it,
 * the gallery of scenes with a snapshot of each, settings, and the cat's stats. Built from small
 * pieces — a segmented choice, a switch, a slider — styled to look drawn in pixels.
 */
import type { SceneDef, LocationDef } from '../game/types';
import type { Settings } from './settings';
import { t, tx } from './i18n';
import { logoCanvas } from './logo';
import { kindIcon } from './icons';
import { Stats, sum } from './stats';

export type View = 'home' | 'menu' | 'gallery' | 'settings' | 'stats' | 'rest' | 'none';

export interface UIHooks {
  play(single?: string): void;
  resume(): void;
  next(): void;
  home(): void;
  changed(key: keyof Settings): void;
  thumb(sceneId: string): Promise<HTMLCanvasElement>;
  resetSettings(): void;
}

const KINDS = ['mouse', 'gold', 'bird', 'laser', 'toy', 'fish', 'butterfly', 'bug', 'firefly', 'bubble', 'frog', 'crab', 'squirrel', 'mole', 'robot', 'arcade', 'light', 'feather'];

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function button(label: string, cls: string, on: () => void): HTMLButtonElement {
  const b = h('button', 'btn ' + cls, label);
  b.type = 'button';
  b.addEventListener('click', (e) => { e.stopPropagation(); on(); });
  return b;
}

export class UI {
  root: HTMLElement;
  view: View = 'none';
  /** Where a panel's Back button leads. */
  private back: View = 'home';
  private layer: HTMLElement;

  constructor(parent: HTMLElement, private s: Settings, private stats: Stats, private scenes: SceneDef[], private locs: LocationDef[], private hooks: UIHooks) {
    this.root = h('div', 'ui');
    this.layer = h('div', 'ui-layer');
    this.root.appendChild(this.layer);
    parent.appendChild(this.root);
    // Taps on the menus must not reach the game underneath.
    this.root.addEventListener('pointerdown', (e) => { if (this.view !== 'none') e.stopPropagation(); });
  }

  show(v: View, back?: View) {
    if (back) this.back = back;
    this.view = v;
    this.layer.innerHTML = '';
    this.root.className = 'ui on view-' + v;
    switch (v) {
      case 'home': this.layer.appendChild(this.home()); break;
      case 'menu': this.layer.appendChild(this.menu()); break;
      case 'gallery': this.layer.appendChild(this.gallery()); break;
      case 'settings': this.layer.appendChild(this.settings()); break;
      case 'stats': this.layer.appendChild(this.statsPanel()); break;
      case 'rest': this.layer.appendChild(this.rest()); break;
      default: this.root.className = 'ui';
    }
  }

  hide() {
    this.show('none');
  }

  refresh() {
    if (this.view !== 'none') {
      const scroll = this.layer.querySelector('.scroll');
      const top = scroll ? scroll.scrollTop : 0;
      this.show(this.view);
      const s2 = this.layer.querySelector('.scroll');
      if (s2) s2.scrollTop = top;
    }
  }

  private home(): HTMLElement {
    const box = h('div', 'home');
    const lang = button(this.s.lang === 'uk' ? 'EN' : 'УКР', 'ghost lang-switch', () => { this.s.lang = this.s.lang === 'uk' ? 'en' : 'uk'; if (this.s.lang === 'en' && this.s.catName === 'Джені') this.s.catName = 'Jenny'; else if (this.s.lang === 'uk' && this.s.catName === 'Jenny') this.s.catName = 'Джені'; this.hooks.changed('lang'); });
    this.layer.appendChild(lang);
    const logo = logoCanvas();
    logo.className = 'logo';
    box.appendChild(logo);
    box.appendChild(h('div', 'tagline', t('tagline')));
    const play = button('▶  ' + t('play'), 'primary big', () => this.hooks.play());
    box.appendChild(play);
    box.appendChild(h('div', 'sub', t('marathonAbout')));
    const row = h('div', 'row');
    row.appendChild(button(t('scenes'), '', () => this.show('gallery', 'home')));
    row.appendChild(button(t('settings'), '', () => this.show('settings', 'home')));
    row.appendChild(button(t('stats'), '', () => this.show('stats', 'home')));
    box.appendChild(row);
    const today = sum(this.stats.today().catches);
    if (today > 0) box.appendChild(h('div', 'sub small', this.s.catName + ' · ' + t('today').toLowerCase() + ': ' + today + ' ♥'));
    return box;
  }

  private menu(): HTMLElement {
    const box = h('div', 'panel menu');
    box.appendChild(h('h2', '', 'Purrcade'));
    box.appendChild(button('▶  ' + t('resume'), 'primary big', () => this.hooks.resume()));
    box.appendChild(button('⏭  ' + t('nextScene'), '', () => this.hooks.next()));
    const row = h('div', 'row');
    row.appendChild(button(t('scenes'), '', () => this.show('gallery', 'menu')));
    row.appendChild(button(t('settings'), '', () => this.show('settings', 'menu')));
    row.appendChild(button(t('stats'), '', () => this.show('stats', 'menu')));
    box.appendChild(row);
    box.appendChild(button(t('home'), 'ghost', () => this.hooks.home()));
    return box;
  }

  private rest(): HTMLElement {
    const box = h('div', 'panel rest');
    const cat = sleepyCat();
    cat.className = 'sleepy';
    box.appendChild(cat);
    box.appendChild(h('h2', '', t('rest', { name: this.s.catName })));
    box.appendChild(h('p', 'sub', t('restAbout')));
    box.appendChild(button('▶  ' + t('play'), '', () => this.hooks.play()));
    return box;
  }

  private header(title: string): HTMLElement {
    const bar = h('div', 'bar');
    bar.appendChild(button('←  ' + t('back'), 'ghost', () => this.show(this.back)));
    bar.appendChild(h('h2', '', title));
    return bar;
  }

  private gallery(): HTMLElement {
    const box = h('div', 'panel wide');
    box.appendChild(this.header(t('scenes')));
    const scroll = h('div', 'scroll');
    const grid = h('div', 'cards');
    for (const sc of this.scenes) {
      const card = h('div', 'card');
      const th = h('div', 'thumb');
      th.appendChild(h('div', 'thumb-wait'));
      card.appendChild(th);
      this.hooks.thumb(sc.id).then((cv) => { th.innerHTML = ''; const img = new Image(); img.src = cv.toDataURL(); th.appendChild(img); }).catch(() => {});
      const body = h('div', 'card-body');
      const top = h('div', 'card-top');
      top.appendChild(h('h3', '', tx(sc.name)));
      const star = button(this.s.favorites.includes(sc.id) ? '★' : '☆', 'icon star' + (this.s.favorites.includes(sc.id) ? ' on' : ''), () => {
        const f = this.s.favorites;
        const i = f.indexOf(sc.id);
        if (i >= 0) f.splice(i, 1); else f.push(sc.id);
        this.hooks.changed('favorites');
        star.textContent = f.includes(sc.id) ? '★' : '☆';
        star.classList.toggle('on', f.includes(sc.id));
      });
      star.title = t('favorite');
      top.appendChild(star);
      body.appendChild(top);
      body.appendChild(h('p', '', tx(sc.about)));
      const meta = h('div', 'meta');
      const en = h('span', 'energy');
      const n = Math.max(1, Math.round(sc.energy * 5));
      en.textContent = '●'.repeat(n) + '○'.repeat(5 - n);
      en.title = t('energy');
      meta.appendChild(en);
      for (const l of sc.locations) { const loc = this.locs.find((x) => x.id === l); if (loc) meta.appendChild(h('span', 'chip small', tx(loc.name))); }
      body.appendChild(meta);
      const acts = h('div', 'acts');
      acts.appendChild(button('▶  ' + t('playThis'), 'primary', () => this.hooks.play(sc.id)));
      const inM = !this.s.offScenes.includes(sc.id);
      const tog = button((inM ? '✓ ' : '') + t('inMarathon'), 'toggle' + (inM ? ' on' : ''), () => {
        const off = this.s.offScenes;
        const i = off.indexOf(sc.id);
        if (i >= 0) off.splice(i, 1); else off.push(sc.id);
        this.hooks.changed('offScenes');
        const now = !off.includes(sc.id);
        tog.textContent = (now ? '✓ ' : '') + t('inMarathon');
        tog.classList.toggle('on', now);
      });
      acts.appendChild(tog);
      body.appendChild(acts);
      card.appendChild(body);
      grid.appendChild(card);
    }
    scroll.appendChild(grid);
    box.appendChild(scroll);
    return box;
  }

  private settings(): HTMLElement {
    const s = this.s;
    const box = h('div', 'panel wide');
    box.appendChild(this.header(t('settings')));
    const scroll = h('div', 'scroll');
    const sec = (title: string) => { const e = h('section'); e.appendChild(h('h3', '', title)); scroll.appendChild(e); return e; };
    const row = (parent: HTMLElement, label: string, control: HTMLElement, note?: string) => {
      const r = h('div', 'set-row');
      const l = h('div', 'set-label', label);
      if (note) l.appendChild(h('small', '', note));
      r.appendChild(l); r.appendChild(control); parent.appendChild(r);
    };
    const changed = (k: keyof Settings) => this.hooks.changed(k);
    const seg = <T extends string | number>(k: keyof Settings, opts: [T, string][]) => {
      const g = h('div', 'seg');
      for (const [v, label] of opts) {
        const b = button(label, (s as unknown as Record<string, unknown>)[k] === v ? 'on' : '', () => {
          (s as unknown as Record<string, unknown>)[k] = v;
          g.querySelectorAll('.btn').forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          changed(k);
        });
        g.appendChild(b);
      }
      return g;
    };
    const sw = (k: keyof Settings) => {
      const b = button('', 'switch' + ((s as unknown as Record<string, boolean>)[k] ? ' on' : ''), () => {
        const o = s as unknown as Record<string, boolean>;
        o[k] = !o[k];
        b.classList.toggle('on', o[k]);
        changed(k);
      });
      b.appendChild(h('i'));
      return b;
    };
    const slider = (k: keyof Settings, min: number, max: number, step: number, left: string, right: string) => {
      const wrap = h('div', 'slider');
      const input = h('input');
      input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step);
      input.value = String((s as unknown as Record<string, number>)[k]);
      input.addEventListener('input', () => { (s as unknown as Record<string, number>)[k] = Number(input.value); changed(k); });
      wrap.appendChild(h('span', '', left)); wrap.appendChild(input); wrap.appendChild(h('span', '', right));
      return wrap;
    };

    const cat = sec(t('sCat'));
    const name = h('input', 'text');
    name.value = s.catName; name.maxLength = 24;
    name.addEventListener('input', () => { s.catName = name.value.trim() || s.catName; changed('catName'); });
    row(cat, t('catName'), name);
    row(cat, t('lang'), seg('lang', [['uk', 'Українська'], ['en', 'English']]));

    const mar = sec(t('sMarathon'));
    row(mar, t('segment'), seg('segment', [[1, t('min', { n: 1 })], [2, t('min', { n: 2 })], [3, t('min', { n: 3 })], [5, t('min', { n: 5 })], [8, t('min', { n: 8 })]]));
    row(mar, t('calm'), sw('calm'));
    row(mar, t('intensity'), slider('intensity', 0, 1, 0.05, t('calmSide'), t('wildSide')));
    row(mar, t('density'), slider('density', 0.5, 1.8, 0.05, t('fewer'), t('more')));
    row(mar, t('speed'), slider('speed', 0.5, 1.8, 0.05, t('slower'), t('faster')));

    const scs = sec(t('sScenes'));
    const chips = h('div', 'chips');
    for (const sc of this.scenes) {
      const on = !s.offScenes.includes(sc.id);
      const c = button(tx(sc.name), 'chip' + (on ? ' on' : ''), () => {
        const i = s.offScenes.indexOf(sc.id);
        if (i >= 0) s.offScenes.splice(i, 1); else s.offScenes.push(sc.id);
        c.classList.toggle('on', !s.offScenes.includes(sc.id));
        changed('offScenes');
      });
      chips.appendChild(c);
    }
    scs.appendChild(chips);
    const pls = sec(t('sPlaces'));
    const lchips = h('div', 'chips');
    for (const l of this.locs) {
      const on = !s.offLocations.includes(l.id);
      const c = button(tx(l.name), 'chip' + (on ? ' on' : ''), () => {
        const i = s.offLocations.indexOf(l.id);
        if (i >= 0) s.offLocations.splice(i, 1); else s.offLocations.push(l.id);
        c.classList.toggle('on', !s.offLocations.includes(l.id));
        changed('offLocations');
      });
      lchips.appendChild(c);
    }
    pls.appendChild(lchips);

    const pic = sec(t('sPicture'));
    row(pic, t('worldSize'), seg('worldSize', [['auto', t('sizeAuto')], ['big', t('sizeBig')], ['medium', t('sizeMedium')], ['small', t('sizeSmall')]]));
    row(pic, t('palette'), seg('palette', [['normal', t('palNormal')], ['cat', t('palCat')], ['contrast', t('palContrast')]]));
    row(pic, t('brightness'), slider('brightness', 0.6, 1.2, 0.05, '☾', '☀'));
    row(pic, t('tod'), seg('tod', [['real', t('todReal')], ['cycle', t('todCycle')], ['dawn', t('dawn')], ['day', t('day')], ['dusk', t('dusk')], ['night', t('night')]]));
    row(pic, t('weather'), seg('weather', [['auto', t('wAuto')], ['often', t('wOften')], ['off', t('wOff')]]));

    const snd = sec(t('sSound'));
    row(snd, t('sound'), sw('sound'), t('soundAbout'));
    row(snd, t('volume'), slider('volume', 0, 1, 0.05, '🔈', '🔊'));
    row(snd, t('sCritters'), sw('soundCritters'));
    row(snd, t('sWater'), sw('soundWater'));
    row(snd, t('sToys'), sw('soundToys'));

    const paws = sec(t('sPaws'));
    row(paws, t('reach'), slider('reach', 0.6, 1.8, 0.05, '−', '+'), t('reachAbout'));

    const ses = sec(t('sSession'));
    row(ses, t('timer'), seg('timer', [[0, t('endless')], [15, t('min', { n: 15 })], [30, t('min', { n: 30 })], [60, t('min', { n: 60 })], [120, t('min', { n: 120 })]]));
    row(ses, t('wake'), sw('wakeLock'));
    row(ses, t('fullscreen'), sw('fullscreen'));

    const scr = sec(t('sScreen'));
    row(scr, t('hudName'), sw('hudName'));
    row(scr, t('hudTitle'), sw('hudTitle'));
    row(scr, t('hudClock'), sw('hudClock'));

    const end = h('section', 'end');
    let armed = false;
    const reset = button(t('resetSettings'), 'ghost', () => {
      if (!armed) { armed = true; reset.textContent = t('sure'); return; }
      this.hooks.resetSettings();
    });
    end.appendChild(reset);
    end.appendChild(h('p', 'sub small', t('about') + ' · v1.0'));
    scroll.appendChild(end);
    box.appendChild(scroll);
    return box;
  }

  private statsPanel(): HTMLElement {
    const box = h('div', 'panel wide');
    box.appendChild(this.header(t('stats')));
    const scroll = h('div', 'scroll');
    const today = this.stats.today();
    const total = this.stats.total();
    const top = h('section', 'stat-top');
    const big = h('div', 'big-num');
    big.appendChild(h('b', '', String(sum(today.catches))));
    big.appendChild(h('span', '', t('today') + ' · ' + t('catchesBy').toLowerCase()));
    top.appendChild(big);
    const big2 = h('div', 'big-num');
    big2.appendChild(h('b', '', String(sum(total.catches))));
    big2.appendChild(h('span', '', t('allTime')));
    top.appendChild(big2);
    const big3 = h('div', 'big-num');
    big3.appendChild(h('b', '', String(Math.round(total.minutes))));
    big3.appendChild(h('span', '', t('watched') + ', ' + t('minutes')));
    top.appendChild(big3);
    scroll.appendChild(top);

    const list = (title: string, c: Record<string, number>) => {
      const sec = h('section');
      sec.appendChild(h('h3', '', title));
      const kinds = KINDS.filter((k) => c[k]);
      if (!kinds.length) { sec.appendChild(h('p', 'sub', t('noCatches'))); return sec; }
      const g = h('div', 'kinds');
      for (const k of kinds) {
        const it = h('div', 'kind');
        const ic = kindIcon(k);
        const img = new Image(); img.src = ic.toDataURL(); img.style.width = ic.width * Math.max(2, Math.round(40 / ic.height)) + 'px';
        it.appendChild(img);
        it.appendChild(h('b', '', String(c[k])));
        it.appendChild(h('span', '', t('k_' + k)));
        g.appendChild(it);
      }
      sec.appendChild(g);
      return sec;
    };
    scroll.appendChild(list(t('today'), today.catches));

    const days = this.stats.recent(14);
    const max = Math.max(1, ...days.map((d) => d.n));
    const chart = h('section');
    chart.appendChild(h('h3', '', t('days14')));
    const bars = h('div', 'bars');
    for (const d of days) {
      const b = h('div', 'bar-col');
      const fill = h('i');
      fill.style.height = Math.round((d.n / max) * 100) + '%';
      b.appendChild(fill);
      b.appendChild(h('span', '', d.key.slice(8)));
      b.title = d.key + ': ' + d.n;
      bars.appendChild(b);
    }
    chart.appendChild(bars);
    chart.appendChild(h('p', 'sub small', t('bestDay') + ': ' + this.stats.data.best));
    scroll.appendChild(chart);
    scroll.appendChild(list(t('allTime'), total.catches));
    const end = h('section', 'end');
    let armed = false;
    const reset = button(t('resetStats'), 'ghost', () => {
      if (!armed) { armed = true; reset.textContent = t('sure'); return; }
      this.stats.reset();
      this.show('stats');
    });
    end.appendChild(reset);
    scroll.appendChild(end);
    box.appendChild(scroll);
    return box;
  }
}

/** A curled-up sleeping cat for the rest screen, in the game's pixels. */
function sleepyCat(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 40; c.height = 24;
  const g = c.getContext('2d')!;
  const px = (x: number, y: number, w: number, hh: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, hh); };
  // Body: a loaf curled round; tail over the nose.
  const body = '#f08a3c', light = '#ffb070', dark = '#b85a1e', ink = '#2a1f2b';
  for (let y = 0; y < 14; y++) { const hw = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 7) / 7.5) ** 2)) * 16); px(20 - hw, 8 + y, hw * 2, 1, y < 3 ? light : y > 11 ? dark : body); }
  for (let y = 0; y < 9; y++) { const hw = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 4) / 4.5) ** 2)) * 7); px(9 - hw, 10 + y, hw * 2, 1, y < 2 ? light : body); }
  px(3, 8, 3, 3, body); px(11, 8, 3, 3, body); px(4, 9, 1, 1, '#ff9ab8'); px(12, 9, 1, 1, '#ff9ab8');
  px(5, 14, 2, 1, ink); px(11, 14, 2, 1, ink);
  for (let x = 0; x < 20; x++) px(4 + x, 19 + Math.round(Math.sin(x * 0.3) * 1.5), 1, 2, dark);
  for (const [x, y] of [[26, 11], [30, 12], [22, 13]]) px(x, y, 3, 1, dark);
  g.fillStyle = '#ffffff'; g.font = '8px monospace';
  px(30, 2, 3, 1, '#c9d6ff'); px(32, 3, 1, 1, '#c9d6ff'); px(31, 4, 1, 1, '#c9d6ff'); px(30, 5, 3, 1, '#c9d6ff');
  px(35, 0, 2, 1, '#8fa0d8'); px(36, 1, 1, 1, '#8fa0d8'); px(35, 2, 2, 1, '#8fa0d8');
  return c;
}
