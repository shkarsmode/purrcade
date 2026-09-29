/**
 * A small seeded random source. Everything that decides — where a mouse runs, which scene comes
 * next — draws from one of these, so a run can be replayed from its seed when something looks off.
 */
export class Rng {
  private s: number;

  constructor(seed = (Math.random() * 2 ** 32) >>> 0) {
    this.s = seed >>> 0;
  }

  /** 0 ≤ n < 1 — mulberry32. */
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a: number, b: number): number {
    return a + this.next() * (b - a);
  }

  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)];
  }

  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }

  /** A weighted pick: weights need not add up to anything. */
  weighted<T>(list: readonly T[], weight: (t: T) => number): T {
    let sum = 0;
    for (const t of list) sum += Math.max(0, weight(t));
    let r = this.next() * sum;
    for (const t of list) {
      r -= Math.max(0, weight(t));
      if (r <= 0) return t;
    }
    return list[list.length - 1];
  }

  /** Roughly normal, mean 0, deviation 1. */
  gauss(): number {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const smooth = (k: number) => k * k * (3 - 2 * k);
export const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(target, v + step) : Math.max(target, v - step);
