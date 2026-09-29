import { describe, it, expect } from 'vitest';
import { loadSettings, saveSettings, DEFAULTS, worldHeight, type Store } from '../src/app/settings';
import { Stats, dayKey, sum } from '../src/app/stats';

function memory(): Store & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
}

describe('settings', () => {
  it('starts from the defaults, in Ukrainian, for Jenny', () => {
    const s = loadSettings(memory());
    expect(s.lang).toBe('uk');
    expect(s.catName).toBe('Джені');
    expect(s.sound).toBe(true);
    expect(s.segment).toBe(DEFAULTS.segment);
  });

  it('turns the sound on for settings saved when it was off by default, but keeps a later choice', () => {
    const old = memory();
    old.set('purrcade:settings', JSON.stringify({ v: 1, sound: false, volume: 0.5, segment: 5 }));
    const a = loadSettings(old);
    expect(a.sound).toBe(true);
    expect(a.volume).toBe(0.7);
    expect(a.segment).toBe(5);
    const now = memory();
    now.set('purrcade:settings', JSON.stringify({ v: 2, sound: false }));
    expect(loadSettings(now).sound).toBe(false);
  });

  it('keeps what was saved and fills in what is new', () => {
    const st = memory();
    st.set('purrcade:settings', JSON.stringify({ segment: 5, favorites: ['mice'], someOldKey: 1 }));
    const s = loadSettings(st);
    expect(s.segment).toBe(5);
    expect(s.favorites).toEqual(['mice']);
    expect(s.palette).toBe('normal');
    expect((s as unknown as Record<string, unknown>).someOldKey).toBeUndefined();
  });

  it('throws away values of the wrong type and clamps numbers', () => {
    const st = memory();
    st.set('purrcade:settings', JSON.stringify({ segment: 'lots', intensity: 7, favorites: [1, 2], catName: 'x'.repeat(100) }));
    const s = loadSettings(st);
    expect(s.segment).toBe(DEFAULTS.segment);
    expect(s.intensity).toBe(1);
    expect(s.favorites).toEqual([]);
    expect(s.catName.length).toBe(24);
  });

  it('survives a broken store', () => {
    const st = memory();
    st.set('purrcade:settings', '{nope');
    expect(loadSettings(st).lang).toBe('uk');
  });

  it('round-trips', () => {
    const st = memory();
    const s = loadSettings(st);
    s.offScenes.push('laser'); s.volume = 0.3;
    saveSettings(s, st);
    const t = loadSettings(st);
    expect(t.offScenes).toEqual(['laser']);
    expect(t.volume).toBe(0.3);
  });

  it('picks a bigger world on touch screens', () => {
    expect(worldHeight('auto', true)).toBeLessThan(worldHeight('auto', false));
    expect(worldHeight('big', false)).toBeLessThan(worldHeight('small', false));
  });
});

describe('stats', () => {
  it('counts catches by day and kind', () => {
    const st = memory();
    const s = new Stats(st);
    const d = new Date(2026, 8, 29, 10);
    s.catch('mouse', d); s.catch('mouse', d); s.catch('bird', d);
    expect(s.today(d).catches).toEqual({ mouse: 2, bird: 1 });
    expect(sum(s.today(d).catches)).toBe(3);
    expect(s.data.best).toBe(3);
    s.save();
    const again = new Stats(st);
    expect(again.today(d).catches.mouse).toBe(2);
  });

  it('keeps a fortnight chart with empty days in it', () => {
    const s = new Stats(memory());
    const d = new Date(2026, 8, 29, 10);
    s.catch('laser', d);
    const r = s.recent(14, d);
    expect(r.length).toBe(14);
    expect(r[13]).toEqual({ key: dayKey(d), n: 1 });
    expect(r[0].n).toBe(0);
  });

  it('forgets days older than ninety', () => {
    const s = new Stats(memory());
    for (let i = 0; i < 120; i++) s.catch('mouse', new Date(2026, 0, 1 + i));
    expect(Object.keys(s.data.days).length).toBeLessThanOrEqual(90);
    expect(s.total().catches.mouse).toBeLessThanOrEqual(90);
  });

  it('adds up minutes watched', () => {
    const s = new Stats(memory());
    const d = new Date(2026, 8, 29, 10);
    s.watched(1, d); s.watched(1, d);
    expect(s.total().minutes).toBe(2);
  });
});
