/**
 * The marathon: what plays next, where, at what hour, in what weather, for how long.
 *
 * A cat watches longest when busy stretches are broken by calm ones, when the same thing does
 * not come round twice in a row, and when the place changes as well as the game. So picks are
 * weighted — favourites up, just-played down — busy scenes run in twos or threes with a quiet
 * one after, and the hour follows the real clock unless told otherwise.
 */
import { Rng } from '../core/rng';
import type { TimeOfDay, Weather } from '../game/types';
import type { Settings } from './settings';

export interface SceneInfo { id: string; energy: number; locations: string[]; tods?: TimeOfDay[] }
export interface LocInfo { id: string; weathers: Weather[]; indoor: boolean }

export interface Segment {
  scene: string;
  loc: string;
  tod: TimeOfDay;
  weather: Weather;
  /** Seconds. */
  dur: number;
  calm: boolean;
}

const TODS: TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];
const CYCLE: TimeOfDay[] = ['dawn', 'day', 'day', 'dusk', 'night', 'night', 'day'];
export const CALM = 0.45;

export function todForHour(h: number): TimeOfDay {
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 18) return 'day';
  if (h >= 18 && h < 21) return 'dusk';
  return 'night';
}

/** The allowed hour closest to the wanted one. */
export function fitTod(want: TimeOfDay, allowed?: TimeOfDay[]): TimeOfDay {
  if (!allowed || !allowed.length || allowed.includes(want)) return want;
  const i = TODS.indexOf(want);
  for (let d = 1; d < 4; d++) {
    for (const j of [i - d, i + d]) {
      const t = TODS[(j + 4) % 4];
      if (allowed.includes(t)) return t;
    }
  }
  return allowed[0];
}

export class Director {
  private history: Segment[] = [];
  private busyRun = 0;
  private cycleAt = 0;

  constructor(private scenes: SceneInfo[], private locs: LocInfo[], private rng = new Rng()) {}

  /** Scenes that can play at all under these settings. */
  playable(s: Settings): SceneInfo[] {
    return this.scenes.filter((sc) => !s.offScenes.includes(sc.id) && this.placesFor(sc, s).length > 0);
  }

  placesFor(sc: SceneInfo, s: Settings): string[] {
    return sc.locations.filter((l) => !s.offLocations.includes(l) && this.locs.some((x) => x.id === l));
  }

  next(s: Settings, now = new Date(), only?: string): Segment {
    // One scene picked by hand plays even if it is switched off in the marathon.
    let pool = only ? this.scenes.filter((p) => p.id === only) : this.playable(s);
    if (!pool.length) pool = this.scenes;
    if (!pool.length) throw new Error('no scenes');
    const wantCalm = !only && s.calm && this.busyRun >= (this.rng.chance(0.5) ? 2 : 3) && pool.some((p) => p.energy < CALM);
    const recent = this.history.slice(-3).map((h) => h.scene);
    const lastLoc = this.history.length ? this.history[this.history.length - 1].loc : '';
    const scene = this.rng.weighted(pool, (p) => {
      let w = 1;
      if (s.favorites.includes(p.id)) w *= 3;
      // Just played: not again; played two or three back: less likely.
      if (!only && pool.length > 1) {
        const back = recent.length - 1 - recent.lastIndexOf(p.id);
        if (recent.includes(p.id)) w *= back === 0 ? 0 : back === 1 ? 0.2 : 0.5;
      }
      if (wantCalm) w *= p.energy < CALM ? 4 : 0.05;
      else if (!only && s.calm && p.energy < CALM && this.busyRun < 2) w *= 0.3;
      // Intensity leans the pick toward busy scenes or calm ones.
      w *= 0.5 + (p.energy - 0.5) * (s.intensity - 0.5) * 2 + 0.5;
      return Math.max(0.0001, w);
    });
    let places = this.placesFor(scene, s);
    if (!places.length) places = scene.locations.filter((l) => this.locs.some((x) => x.id === l));
    const loc = this.rng.weighted(places, (l) => (l === lastLoc && places.length > 1 ? 0.1 : 1));
    const tod = fitTod(this.pickTod(s, now), scene.tods);
    const weather = this.pickWeather(s, loc, tod);
    const calm = scene.energy < CALM;
    const dur = Math.round(s.segment * 60 * this.rng.range(0.85, 1.15) * (calm ? 0.8 : 1));
    this.busyRun = calm ? 0 : this.busyRun + 1;
    const seg: Segment = { scene: scene.id, loc, tod, weather, dur, calm };
    this.history.push(seg);
    if (this.history.length > 20) this.history.shift();
    return seg;
  }

  private pickTod(s: Settings, now: Date): TimeOfDay {
    if (s.tod === 'real') return todForHour(now.getHours());
    if (s.tod === 'cycle') return CYCLE[this.cycleAt++ % CYCLE.length];
    return s.tod;
  }

  private pickWeather(s: Settings, locId: string, tod: TimeOfDay): Weather {
    const loc = this.locs.find((l) => l.id === locId);
    if (!loc || s.weather === 'off') return 'clear';
    const list = loc.weathers.filter((w) => !(w === 'motes' && tod === 'night'));
    if (!list.length) return 'clear';
    if (s.weather === 'often') {
      const wet = list.filter((w) => w !== 'clear');
      return wet.length ? this.rng.pick(wet) : 'clear';
    }
    return this.rng.chance(0.45) ? 'clear' : this.rng.pick(list);
  }

  get past(): readonly Segment[] {
    return this.history;
  }
}
