import { describe, it, expect } from 'vitest';
import { Director, fitTod, todForHour, CALM, type SceneInfo, type LocInfo } from '../src/app/director';
import { DEFAULTS, type Settings } from '../src/app/settings';
import { Rng } from '../src/core/rng';

const scenes: SceneInfo[] = [
  { id: 'mice', energy: 0.7, locations: ['kitchen', 'attic'] },
  { id: 'laser', energy: 0.95, locations: ['kitchen', 'livingroom'] },
  { id: 'birds', energy: 0.6, locations: ['garden'], tods: ['dawn', 'day', 'dusk'] },
  { id: 'koi', energy: 0.35, locations: ['koi'] },
  { id: 'fireflies', energy: 0.2, locations: ['garden'], tods: ['night', 'dusk'] },
];
const locs: LocInfo[] = [
  { id: 'kitchen', weathers: ['clear', 'motes'], indoor: true },
  { id: 'attic', weathers: ['clear'], indoor: true },
  { id: 'livingroom', weathers: ['clear'], indoor: true },
  { id: 'garden', weathers: ['clear', 'rain', 'petals'], indoor: false },
  { id: 'koi', weathers: ['clear', 'rain'], indoor: false },
];
const settings = (o: Partial<Settings> = {}): Settings => ({ ...DEFAULTS, offScenes: [], offLocations: [], favorites: [], ...o });
const noon = new Date(2026, 8, 29, 12, 0);

describe('hours', () => {
  it('follows the clock', () => {
    expect(todForHour(6)).toBe('dawn');
    expect(todForHour(12)).toBe('day');
    expect(todForHour(19)).toBe('dusk');
    expect(todForHour(23)).toBe('night');
    expect(todForHour(3)).toBe('night');
  });
  it('moves an hour a scene cannot play at to the nearest one it can', () => {
    expect(fitTod('night', ['dawn', 'day', 'dusk'])).toBe('dusk');
    expect(fitTod('day', ['night', 'dusk'])).toBe('dusk');
    expect(fitTod('day', undefined)).toBe('day');
  });
});

describe('director', () => {
  it('never plays the same scene twice in a row', () => {
    const d = new Director(scenes, locs, new Rng(1));
    let last = '';
    for (let i = 0; i < 300; i++) {
      const s = d.next(settings(), noon);
      expect(s.scene).not.toBe(last);
      last = s.scene;
    }
  });

  it('puts a calm scene in after a run of busy ones', () => {
    const d = new Director(scenes, locs, new Rng(2));
    let busy = 0, maxBusy = 0;
    for (let i = 0; i < 400; i++) {
      const s = d.next(settings(), noon);
      const e = scenes.find((x) => x.id === s.scene)!.energy;
      busy = e < CALM ? 0 : busy + 1;
      maxBusy = Math.max(maxBusy, busy);
    }
    expect(maxBusy).toBeLessThanOrEqual(4);
  });

  it('only picks places a scene belongs to, and not switched-off ones', () => {
    const d = new Director(scenes, locs, new Rng(3));
    const s0 = settings({ offLocations: ['attic'] });
    for (let i = 0; i < 200; i++) {
      const s = d.next(s0, noon);
      const sc = scenes.find((x) => x.id === s.scene)!;
      expect(sc.locations).toContain(s.loc);
      expect(s.loc).not.toBe('attic');
    }
  });

  it('leaves switched-off scenes out of the marathon', () => {
    const d = new Director(scenes, locs, new Rng(4));
    for (let i = 0; i < 200; i++) expect(d.next(settings({ offScenes: ['laser', 'koi'] }), noon).scene).not.toMatch(/laser|koi/);
  });

  it('plays a scene picked by hand even when it is off, and keeps to it', () => {
    const d = new Director(scenes, locs, new Rng(5));
    for (let i = 0; i < 20; i++) expect(d.next(settings({ offScenes: ['koi'] }), noon, 'koi').scene).toBe('koi');
  });

  it('keeps a scene to the hours it makes sense at', () => {
    const d = new Director(scenes, locs, new Rng(6));
    const night = new Date(2026, 8, 29, 23, 30);
    for (let i = 0; i < 200; i++) {
      const s = d.next(settings(), night);
      if (s.scene === 'birds') expect(s.tod).not.toBe('night');
      if (s.scene === 'fireflies') expect(['night', 'dusk']).toContain(s.tod);
    }
  });

  it('plays favourites more often', () => {
    const count = (fav: string[]) => {
      const d = new Director(scenes, locs, new Rng(7));
      let n = 0;
      for (let i = 0; i < 600; i++) if (d.next(settings({ favorites: fav, calm: false }), noon).scene === 'mice') n++;
      return n;
    };
    expect(count(['mice'])).toBeGreaterThan(count([]) * 1.3);
  });

  it('sizes segments from the setting', () => {
    const d = new Director(scenes, locs, new Rng(8));
    for (let i = 0; i < 50; i++) {
      const s = d.next(settings({ segment: 2 }), noon);
      expect(s.dur).toBeGreaterThanOrEqual(2 * 60 * 0.8 * 0.85 - 1);
      expect(s.dur).toBeLessThanOrEqual(2 * 60 * 1.15 + 1);
    }
  });

  it('turns weather off when asked, and only uses weathers the place has', () => {
    const d = new Director(scenes, locs, new Rng(9));
    for (let i = 0; i < 100; i++) expect(d.next(settings({ weather: 'off' }), noon).weather).toBe('clear');
    for (let i = 0; i < 200; i++) {
      const s = d.next(settings({ weather: 'often' }), noon);
      const loc = locs.find((l) => l.id === s.loc)!;
      expect([...loc.weathers, 'clear']).toContain(s.weather);
    }
  });
});
