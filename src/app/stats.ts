/**
 * What the cat got up to: catches by kind, by day, and minutes watched. Kept in the browser,
 * a few hundred bytes a day, trimmed to the last ninety days.
 */
import type { Store } from './settings';
import { browserStore } from './settings';

export interface Day { catches: Record<string, number>; minutes: number }
export interface StatsData { days: Record<string, Day>; best: number }

const KEY = 'purrcade:stats';

export function dayKey(d = new Date()): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export class Stats {
  data: StatsData;
  private dirty = false;

  constructor(private store: Store = browserStore) {
    let d: StatsData = { days: {}, best: 0 };
    try { const raw = JSON.parse(store.get(KEY) || 'null'); if (raw && typeof raw === 'object' && raw.days) d = raw; } catch { /* start afresh */ }
    this.data = d;
  }

  private day(k = dayKey()): Day {
    let d = this.data.days[k];
    if (!d) { d = this.data.days[k] = { catches: {}, minutes: 0 }; this.trim(); }
    return d;
  }

  catch(kind: string, when = new Date()) {
    const d = this.day(dayKey(when));
    d.catches[kind] = (d.catches[kind] || 0) + 1;
    const n = Object.values(d.catches).reduce((a, b) => a + b, 0);
    if (n > this.data.best) this.data.best = n;
    this.dirty = true;
  }

  watched(minutes: number, when = new Date()) {
    this.day(dayKey(when)).minutes += minutes;
    this.dirty = true;
  }

  today(when = new Date()): Day {
    return this.data.days[dayKey(when)] || { catches: {}, minutes: 0 };
  }

  total(): { catches: Record<string, number>; minutes: number; days: number } {
    const catches: Record<string, number> = {};
    let minutes = 0;
    for (const d of Object.values(this.data.days)) {
      minutes += d.minutes;
      for (const [k, v] of Object.entries(d.catches)) catches[k] = (catches[k] || 0) + v;
    }
    return { catches, minutes, days: Object.keys(this.data.days).length };
  }

  /** Catches per day for the last n days, oldest first. */
  recent(n: number, when = new Date()): { key: string; n: number }[] {
    const out: { key: string; n: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(when); d.setDate(d.getDate() - i);
      const k = dayKey(d);
      const day = this.data.days[k];
      out.push({ key: k, n: day ? Object.values(day.catches).reduce((a, b) => a + b, 0) : 0 });
    }
    return out;
  }

  private trim() {
    const keys = Object.keys(this.data.days).sort();
    while (keys.length > 90) delete this.data.days[keys.shift()!];
  }

  save(force = false) {
    if (!this.dirty && !force) return;
    this.store.set(KEY, JSON.stringify(this.data));
    this.dirty = false;
  }

  reset() {
    this.data = { days: {}, best: 0 };
    this.dirty = true;
    this.save();
  }
}

export function sum(c: Record<string, number>): number {
  return Object.values(c).reduce((a, b) => a + b, 0);
}
