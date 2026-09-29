import { describe, it, expect } from 'vitest';
import { makeMaze, distField } from '../src/scenes/arcade';
import { Rng, clamp, lerp, approach } from '../src/core/rng';

describe('maze', () => {
  for (const seed of [1, 2, 3, 42, 1234]) {
    it(`has every open cell reachable (seed ${seed})`, () => {
      const cols = 33, rows = 17;
      const m = makeMaze(cols, rows, new Rng(seed));
      const d = distField(m, cols, rows, [[1, 1]]);
      for (let i = 0; i < m.length; i++) if (m[i] === 0) expect(d[i]).toBeGreaterThanOrEqual(0);
    });
  }

  it('has a solid border', () => {
    const cols = 21, rows = 13;
    const m = makeMaze(cols, rows, new Rng(7));
    for (let x = 0; x < cols; x++) { expect(m[x]).toBe(1); expect(m[(rows - 1) * cols + x]).toBe(1); }
    for (let y = 0; y < rows; y++) { expect(m[y * cols]).toBe(1); expect(m[y * cols + cols - 1]).toBe(1); }
  });

  it('has loops, so a mouse is never trapped in a dead end with a cat behind it', () => {
    const cols = 33, rows = 17;
    const tree = makeMaze(cols, rows, new Rng(5), 0);
    const loopy = makeMaze(cols, rows, new Rng(5), 0.3);
    const open = (m: Uint8Array) => m.reduce((a, v) => a + (v === 0 ? 1 : 0), 0);
    expect(open(loopy)).toBeGreaterThan(open(tree));
  });

  it('measures distance in steps', () => {
    // A corridor: 0 1 2 3 from the left end.
    const cols = 6, rows = 3;
    const m = new Uint8Array(cols * rows).fill(1);
    for (let x = 1; x < 5; x++) m[cols + x] = 0;
    const d = distField(m, cols, rows, [[1, 1]]);
    expect([d[cols + 1], d[cols + 2], d[cols + 3], d[cols + 4]]).toEqual([0, 1, 2, 3]);
    expect(d[0]).toBe(-1);
  });
});

describe('rng', () => {
  it('replays the same run from the same seed', () => {
    const a = new Rng(99), b = new Rng(99);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('stays in range', () => {
    const r = new Rng(3);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
  it('weights picks', () => {
    const r = new Rng(4);
    let a = 0;
    for (let i = 0; i < 2000; i++) if (r.weighted(['a', 'b'], (x) => (x === 'a' ? 3 : 1)) === 'a') a++;
    expect(a / 2000).toBeGreaterThan(0.68);
    expect(a / 2000).toBeLessThan(0.82);
  });
  it('has sane helpers', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(10, 0, 3)).toBe(7);
  });
});
