/**
 * The whole app: the screen and the clock, the stage, the director choosing what plays, the
 * menus, the HUD, and the ways back to the menu that a cat is unlikely to find — a two-second
 * hold in the top-right corner, Esc, or a button that shows only when a real mouse moves.
 */
import { createScreen, layer, type Screen } from '../core/screen';
import { createLoop, type Loop } from '../core/loop';
import { Sfx } from '../core/audio';
import { setMode } from '../core/color';
import { clearSprites } from '../core/pix';
import { Rng } from '../core/rng';
import { Stage } from '../game/stage';
import { Transition, type TransitionKind } from '../game/transition';
import type { TimeOfDay } from '../game/types';
import { LOCATIONS, locationById } from '../world';
import { SCENES, sceneById } from '../scenes';
import { loadSettings, saveSettings, worldHeight, DEFAULTS, type Settings } from './settings';
import { Stats, sum } from './stats';
import { Director, type Segment, todForHour } from './director';
import { setLang, t, tx } from './i18n';
import { Hud } from './hud';
import { UI } from './ui';

const HOLD = 1.6;
const TRANSITIONS: TransitionKind[] = ['iris', 'dissolve', 'blinds', 'iris'];

export class App {
  settings: Settings;
  stats = new Stats();
  screen: Screen;
  sfx = new Sfx();
  stage: Stage;
  loop: Loop;
  director = new Director(SCENES, LOCATIONS);
  trans = new Transition('iris', 0.6);
  hud: Hud;
  ui: UI;
  mode: 'home' | 'play' | 'rest' = 'home';
  menuOpen = false;
  single: string | null = null;
  seg: Segment | null = null;
  segT = 0;
  session = 0;
  private watchAcc = 0;
  private amb = 3;
  private holdT = 0;
  private holdId: number | null = null;
  private transI = 0;
  private wake: { release(): Promise<void> } | null = null;
  private coarse = matchMedia('(pointer: coarse)').matches;
  private thumbs = new Map<string, Promise<HTMLCanvasElement>>();
  private rng = new Rng();

  constructor(private canvas: HTMLCanvasElement, root: HTMLElement) {
    this.settings = loadSettings(undefined, navigator.language);
    setLang(this.settings.lang);
    this.screen = createScreen(canvas, worldHeight(this.settings.worldSize, this.coarse));
    this.stage = new Stage(this.screen.W, this.screen.H, this.sfx);
    this.stage.onCatch = (kind) => {
      this.stats.catch(kind);
      this.hud.setCount(sum(this.stats.today().catches), true);
    };
    this.hud = new Hud(root, () => this.openMenu());
    this.ui = new UI(root, this.settings, this.stats, SCENES, LOCATIONS, {
      play: (single) => this.play(single),
      resume: () => this.closeMenu(),
      next: () => { this.closeMenu(); this.advance(); },
      home: () => this.goHome(),
      changed: (k) => this.changed(k),
      thumb: (id) => this.thumb(id),
      resetSettings: () => this.resetSettings(),
    });
    this.applySettings(true);
    this.loop = createLoop((dt) => this.step(dt), () => this.draw());
    this.bindInput();
    this.ambient();
    this.ui.show('home');
    this.loop.start();
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.mode === 'play') this.keepAwake(true);
      if (document.visibilityState === 'hidden') { this.stats.save(true); }
    });
    addEventListener('pagehide', () => this.stats.save(true));
    setInterval(() => this.stats.save(), 15000);
  }

  // --- the clock ---------------------------------------------------------------------------

  private step(dt: number) {
    this.stage.update(dt);
    this.trans.update(dt);
    if (this.mode === 'play') {
      this.session += dt;
      this.watchAcc += dt;
      if (this.watchAcc >= 60) { this.watchAcc -= 60; this.stats.watched(1); }
      if (!this.trans.busy && this.seg) {
        this.segT += dt;
        if (this.segT >= this.seg.dur) this.advance();
      }
      if (this.settings.timer > 0 && this.session >= this.settings.timer * 60 && !this.menuOpen) this.restNow();
      this.ambience(dt);
    }
    if (this.holdId != null) {
      this.holdT += dt;
      this.hud.hold(this.holdT / HOLD);
      if (this.holdT >= HOLD) { this.holdId = null; this.hud.hold(0); this.holdDone(); }
    }
    this.hud.tick(dt, new Date());
  }

  private draw() {
    const g = this.screen.g;
    this.stage.draw(g);
    this.trans.draw(g, this.screen.W, this.screen.H);
  }

  // --- what plays --------------------------------------------------------------------------

  /** Something pleasant behind the title screen. */
  private ambient() {
    const pick = this.rng.pick(['birds', 'mice', 'toys', 'birds']);
    const sc = sceneById(pick) || SCENES[0];
    const loc = locationById(this.rng.pick(sc.locations)) || LOCATIONS[0];
    const tod: TimeOfDay = sc.tods && !sc.tods.includes(todForHour(new Date().getHours())) ? 'day' : todForHour(new Date().getHours());
    this.stage.setup({ loc, scene: sc, tod, weather: 'clear' });
  }

  play(single?: string) {
    this.sfx.unlock();
    this.single = single || null;
    this.mode = 'play';
    this.menuOpen = false;
    this.session = 0;
    this.ui.hide();
    this.hud.show(true);
    this.hud.setCount(sum(this.stats.today().catches));
    this.hud.showHint(!this.coarse);
    if (this.settings.fullscreen && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    this.keepAwake(true);
    this.advance(true);
  }

  advance(first = false) {
    const seg = this.director.next(this.settings, new Date(), this.single || undefined);
    const kind = first ? 'iris' : TRANSITIONS[this.transI++ % TRANSITIONS.length];
    this.trans.run(() => this.load(seg), kind);
  }

  private load(seg: Segment) {
    const sc = sceneById(seg.scene), loc = locationById(seg.loc);
    if (!sc || !loc) return;
    this.seg = seg;
    this.segT = 0;
    this.stage.setup({ loc, scene: sc, tod: seg.tod, weather: seg.weather });
    this.hud.title(tx(loc.name) + ' · ' + tx(sc.name));
  }

  private restNow() {
    this.mode = 'rest';
    this.keepAwake(false);
    this.hud.show(false);
    // A calm, dim place to rest the eyes: the living room at night with nothing in it.
    const loc = locationById('livingroom') || LOCATIONS[0];
    this.trans.run(() => { this.stage.setup({ loc, scene: null, tod: 'night', weather: 'clear' }); this.ui.show('rest'); }, 'iris');
  }

  goHome() {
    this.mode = 'home';
    this.menuOpen = false;
    this.hud.show(false);
    this.keepAwake(false);
    this.stats.save(true);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    this.ui.show('home');
  }

  openMenu() {
    if (this.mode !== 'play' || this.menuOpen) return;
    this.menuOpen = true;
    this.hud.show(false);
    this.ui.show('menu');
  }

  closeMenu() {
    if (this.mode !== 'play') { this.play(); return; }
    this.menuOpen = false;
    this.ui.hide();
    this.hud.show(true);
  }

  private holdDone() {
    if (this.mode === 'play') this.openMenu();
    else if (this.mode === 'rest') this.play();
  }

  /** The sounds of the place, now and then: birds by day, crickets by night, water, waves. */
  private ambience(dt: number) {
    if (!this.seg || !this.settings.sound) return;
    this.amb -= dt;
    if (this.amb > 0) return;
    const { loc, tod, scene } = this.seg;
    const outdoor = !(locationById(loc)?.indoor ?? true);
    const wet = loc === 'koi' || loc === 'pond' || loc === 'aquarium';
    this.amb = 2 + Math.random() * 5;
    if (loc === 'beach') { this.sfx.wave(); this.amb = 6 + Math.random() * 2; return; }
    if (wet && Math.random() < 0.5) { this.sfx.drip(); return; }
    if (outdoor && tod === 'night') { this.sfx.cricket(); this.amb = 0.8 + Math.random() * 2; if (loc === 'forest' && Math.random() < 0.08) this.sfx.owl(); return; }
    if (outdoor && tod !== 'night' && loc !== 'arcade') { if (Math.random() < (scene === 'birds' ? 0.8 : 0.45)) this.sfx.song(); return; }
  }

  // --- settings ----------------------------------------------------------------------------

  private changed(k: keyof Settings) {
    saveSettings(this.settings);
    if (k === 'lang') { setLang(this.settings.lang); this.ui.refresh(); }
    if (k === 'worldSize') this.resize(true);
    if (k === 'palette') { setMode(this.settings.palette); clearSprites(); this.rebuild(); this.thumbs.clear(); }
    this.applySettings(false);
  }

  private resetSettings() {
    const keep = { favorites: this.settings.favorites };
    Object.assign(this.settings, { ...DEFAULTS, offScenes: [], offLocations: [], favorites: keep.favorites });
    saveSettings(this.settings);
    setLang(this.settings.lang);
    setMode(this.settings.palette);
    this.resize(true);
    this.applySettings(false);
    this.ui.show('settings');
  }

  private applySettings(first: boolean) {
    const s = this.settings;
    if (first) setMode(s.palette);
    this.stage.opts.density = s.density;
    this.stage.opts.speed = s.speed;
    this.stage.opts.intensity = s.intensity;
    this.stage.opts.reach = s.reach;
    this.sfx.enabled = s.sound;
    this.sfx.setVolume(s.volume * 0.8);
    this.sfx.allow = { critters: s.soundCritters, water: s.soundWater, toys: s.soundToys, ambient: s.soundAmbient };
    if (s.sound) this.sfx.unlock();
    this.canvas.style.filter = s.brightness === 1 ? '' : `brightness(${s.brightness})`;
    this.hud.config({ name: s.catName, showName: s.hudName, showTitle: s.hudTitle, showClock: s.hudClock });
  }

  private rebuild() {
    const now = this.stage.setupNow;
    if (now) this.stage.setup({ ...now, seed: undefined });
  }

  private resize(force = false) {
    const H = worldHeight(this.settings.worldSize, this.coarse);
    let changed = false;
    if (force) {
      const s = createScreen(this.canvas, H);
      changed = s.W !== this.screen.W || s.H !== this.screen.H;
      this.screen = s;
    } else {
      changed = this.screen.resize();
    }
    if (changed || force) this.stage.resize(this.screen.W, this.screen.H);
  }

  // --- input -------------------------------------------------------------------------------

  private bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (this.mode === 'play' && !this.menuOpen) {
        const [x, y] = this.screen.toWorld(e.clientX, e.clientY);
        this.stage.paw(x, y);
      }
      if (this.inCorner(e.clientX, e.clientY) && (this.mode === 'play' || this.mode === 'rest')) {
        this.holdId = e.pointerId;
        this.holdT = 0;
      }
    });
    const end = (e: PointerEvent) => { if (e.pointerId === this.holdId) { this.holdId = null; this.hud.hold(0); } };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
    addEventListener('pointermove', (e) => {
      if (e.pointerId === this.holdId && !this.inCorner(e.clientX, e.clientY)) { this.holdId = null; this.hud.hold(0); }
      if (e.pointerType === 'mouse' && this.mode === 'play' && !this.menuOpen) this.hud.mouseMoved();
    });
    addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const k = e.key;
      if (k === 'Escape' || k === 'm' || k === 'M' || k === ' ') {
        e.preventDefault();
        if (this.mode === 'play') { if (this.menuOpen) this.closeMenu(); else this.openMenu(); }
        else if (this.mode === 'rest') this.play();
        else if (this.ui.view !== 'home') this.ui.show('home');
      } else if ((k === 'n' || k === 'ArrowRight') && this.mode === 'play' && !this.menuOpen) {
        this.advance();
      } else if (k === 'f' || k === 'F') {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else document.documentElement.requestFullscreen?.().catch(() => {});
      }
    });
  }

  private inCorner(x: number, y: number) {
    return x > innerWidth - 96 && y < 96;
  }

  private async keepAwake(on: boolean) {
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } };
    try {
      if (on && this.settings.wakeLock && nav.wakeLock && !this.wake) this.wake = await nav.wakeLock.request('screen');
      else if (!on && this.wake) { await this.wake.release(); this.wake = null; }
    } catch { this.wake = null; }
    if (on && this.wake) (this.wake as unknown as EventTarget).addEventListener?.('release', () => { this.wake = null; });
  }

  // --- thumbnails for the gallery ------------------------------------------------------------

  private thumb(id: string): Promise<HTMLCanvasElement> {
    let p = this.thumbs.get(id);
    if (p) return p;
    p = new Promise((resolve, reject) => {
      const run = () => {
        const sc = sceneById(id);
        if (!sc) { reject(new Error(id)); return; }
        const locId = sc.locations.find((l) => !this.settings.offLocations.includes(l)) || sc.locations[0];
        const loc = locationById(locId);
        if (!loc) { reject(new Error(locId)); return; }
        const W = 320, H = 180;
        const mute = new Sfx();
        const st = new Stage(W, H, mute, 11);
        st.opts = { ...this.stage.opts };
        const tod: TimeOfDay = sc.tods && !sc.tods.includes('day') ? sc.tods[sc.tods.length - 1] : 'day';
        st.setup({ loc, scene: sc, tod, weather: 'clear', seed: 11 });
        for (let i = 0; i < 60 * 6; i++) st.update(1 / 60);
        const [cv, g] = layer(W, H);
        st.draw(g);
        resolve(cv);
      };
      // One at a time, between frames, so the menu stays smooth.
      const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback;
      if (idle) idle(run); else setTimeout(run, 30);
    });
    this.thumbs.set(id, p);
    return p;
  }
}

export { t };
