/**
 * One scene on screen: a place, the things living in it, the weather over it, the light of the
 * hour, the sparkles when a paw lands. The director decides what comes next; the stage only
 * plays what it is given, at whatever size the window is.
 */
import { Rng } from '../core/rng';
import { Particles } from '../core/particles';
import type { Sfx } from '../core/audio';
import { pixelText } from '../core/font';
import type { LocationDef, LocationInstance, SceneDef, SceneInstance, SceneOpts, TimeOfDay, Weather, Light } from './types';
import { WeatherFx } from './weather';
import { TintBuffer, lightsPass, tint, tintFor } from './light';

export interface Setup {
  loc: LocationDef;
  scene: SceneDef | null;
  tod: TimeOfDay;
  weather: Weather;
  seed?: number;
}

export class Stage {
  W: number;
  H: number;
  rng: Rng;
  fx: Particles;
  setupNow: Setup | null = null;
  loc: LocationInstance | null = null;
  scene: SceneInstance | null = null;
  weather: WeatherFx | null = null;
  opts: SceneOpts = { density: 1, speed: 1, intensity: 0.6, reach: 1 };
  t = 0;
  onCatch: (kind: string, x: number, y: number) => void = () => {};
  /** Weather strength, 0 switches it off. */
  weatherStrength = 1;
  private buf: TintBuffer | null = null;

  constructor(W: number, H: number, public sfx: Sfx, seed?: number) {
    this.W = W; this.H = H;
    this.rng = new Rng(seed);
    this.fx = new Particles(this.rng);
  }

  setup(s: Setup) {
    this.setupNow = s;
    this.rng = new Rng(s.seed ?? (this.rng.next() * 2 ** 32) >>> 0);
    this.fx = new Particles(this.rng);
    this.loc = s.loc.build(this.W, this.H, s.tod, this.rng);
    const w = this.weatherStrength > 0 && s.loc.weathers.includes(s.weather) ? s.weather : 'clear';
    this.weather = new WeatherFx(w, this.W, this.H, this.loc.floor, this.rng, this.weatherStrength);
    this.scene = s.scene ? s.scene.create({
      locId: s.loc.id,
      W: this.W, H: this.H, rng: this.rng, loc: this.loc, tod: s.tod, fx: this.fx, sfx: this.sfx, opts: this.opts,
      caught: (kind, x, y, tint) => {
        this.fx.catch(x, y, tint);
        this.sfx.ding();
        this.onCatch(kind, x, y);
      },
    }) : null;
  }

  resize(W: number, H: number) {
    if (W === this.W && H === this.H) return;
    this.W = W; this.H = H;
    this.buf = null;
    if (this.setupNow) this.setup({ ...this.setupNow, seed: undefined });
  }

  update(dt: number) {
    this.t += dt;
    if (this.loc && this.loc.update) this.loc.update(dt, this.t);
    if (this.scene) this.scene.update(dt, this.t);
    if (this.weather) this.weather.update(dt, this.t);
    this.fx.update(dt);
  }

  private world(g: CanvasRenderingContext2D, loc: LocationInstance, t: number) {
    loc.drawBack(g, t);
    if (this.scene) this.scene.draw(g, t);
    if (loc.drawFront) loc.drawFront(g, t);
    if (this.scene && this.scene.drawTop) this.scene.drawTop(g, t);
    if (this.weather) this.weather.draw(g, t);
  }

  draw(g: CanvasRenderingContext2D) {
    const loc = this.loc;
    if (!loc) return;
    const t = this.t;
    const tod = this.setupNow ? this.setupNow.tod : 'day';
    const c = tintFor(tod, loc.indoor);
    if (loc.drawSky && c) {
      if (!this.buf || this.buf.W !== this.W || this.buf.H !== this.H) this.buf = new TintBuffer(this.W, this.H);
      const b = this.buf;
      b.clear();
      this.world(b.g, loc, t);
      b.tint(c);
      loc.drawSky(g, t);
      g.drawImage(b.canvas, 0, 0);
    } else {
      if (loc.drawSky) loc.drawSky(g, t);
      this.world(g, loc, t);
      if (c) tint(g, this.W, this.H, c);
    }
    const lights: Light[] = [...(loc.lights || []), ...(this.scene && this.scene.lights ? this.scene.lights() : [])];
    lightsPass(g, tod, loc.indoor, lights, t);
    if (loc.drawGlow && tod !== 'day') loc.drawGlow(g, t);
    if (this.scene && this.scene.drawGlow) this.scene.drawGlow(g, t);
    this.fx.draw(g, (gg, s, x, y, cc) => pixelText(gg, s, x, y, cc));
  }

  paw(x: number, y: number) {
    this.fx.pawPrint(x, y);
    if (this.scene) this.scene.paw(x, y);
  }
}
