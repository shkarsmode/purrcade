/**
 * How things move. A cat does not care about a thing that glides — it cares about one that
 * stops, sniffs, bolts, stops again, changes its mind. So movement here is steering plus
 * a restless noise, and every critter's own code decides when to freeze and when to dash.
 */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth 1D value noise in −1..1. */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x), f = x - i;
  const a = hash(i + seed * 57.3), b = hash(i + 1 + seed * 57.3);
  const u = f * f * (3 - 2 * f);
  return (a + (b - a) * u) * 2 - 1;
}

export class Agent {
  x: number; y: number;
  vx = 0; vy = 0;
  ax = 0; ay = 0;
  maxSpeed: number;
  maxForce: number;
  seed: number;

  constructor(x: number, y: number, maxSpeed: number, maxForce: number, seed = Math.random() * 1000) {
    this.x = x; this.y = y;
    this.maxSpeed = maxSpeed; this.maxForce = maxForce;
    this.seed = seed;
  }

  private push(fx: number, fy: number, k: number) {
    const m = Math.hypot(fx, fy);
    if (m > this.maxForce) { fx = (fx / m) * this.maxForce; fy = (fy / m) * this.maxForce; }
    this.ax += fx * k; this.ay += fy * k;
  }

  seek(tx: number, ty: number, k = 1) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
    this.push((dx / d) * this.maxSpeed - this.vx, (dy / d) * this.maxSpeed - this.vy, k);
  }

  /** Seek, slowing down inside `slow` pixels of the target. */
  arrive(tx: number, ty: number, slow = 30, k = 1) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
    const sp = d < slow ? this.maxSpeed * (d / slow) : this.maxSpeed;
    this.push((dx / d) * sp - this.vx, (dy / d) * sp - this.vy, k);
  }

  flee(px: number, py: number, radius: number, k = 1): boolean {
    const dx = this.x - px, dy = this.y - py, d = Math.hypot(dx, dy);
    if (d > radius) return false;
    const s = (d || 1);
    this.push((dx / s) * this.maxSpeed * 1.6 - this.vx, (dy / s) * this.maxSpeed * 1.6 - this.vy, k * (1.5 - d / radius));
    return true;
  }

  /** A restless drift: the heading wanders on smooth noise. */
  wander(t: number, k = 1, rate = 0.6) {
    const a = noise1(t * rate, this.seed) * Math.PI * 2;
    this.push(Math.cos(a) * this.maxSpeed - this.vx * 0.3, Math.sin(a) * this.maxSpeed - this.vy * 0.3, k * 0.35);
  }

  /** Keep inside a box, pushing back harder the closer to the edge. */
  contain(x0: number, y0: number, x1: number, y1: number, margin = 20, k = 1) {
    let fx = 0, fy = 0;
    if (this.x < x0 + margin) fx = this.maxSpeed * (1 - (this.x - x0) / margin);
    if (this.x > x1 - margin) fx = -this.maxSpeed * (1 - (x1 - this.x) / margin);
    if (this.y < y0 + margin) fy = this.maxSpeed * (1 - (this.y - y0) / margin);
    if (this.y > y1 - margin) fy = -this.maxSpeed * (1 - (y1 - this.y) / margin);
    if (fx || fy) this.push(fx, fy, k * 2);
  }

  step(dt: number, drag = 0) {
    this.vx += this.ax * dt; this.vy += this.ay * dt;
    if (drag) { const e = Math.exp(-drag * dt); this.vx *= e; this.vy *= e; }
    const s = Math.hypot(this.vx, this.vy);
    if (s > this.maxSpeed) { this.vx = (this.vx / s) * this.maxSpeed; this.vy = (this.vy / s) * this.maxSpeed; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.ax = 0; this.ay = 0;
  }

  get speed(): number { return Math.hypot(this.vx, this.vy); }
}

/**
 * A school or a flock: keep apart, match heading, stay together. O(n²) is fine for the tens
 * of fish or birds on screen.
 */
export function flock(list: Agent[], o: { sep?: number; align?: number; cohere?: number; radius?: number; sepRadius?: number } = {}) {
  const R = o.radius ?? 36, SR = o.sepRadius ?? 10;
  for (const a of list) {
    let n = 0, cx = 0, cy = 0, vx = 0, vy = 0, sx = 0, sy = 0;
    for (const b of list) {
      if (a === b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > R) continue;
      n++; cx += b.x; cy += b.y; vx += b.vx; vy += b.vy;
      if (d < SR && d > 0) { sx -= dx / d / d; sy -= dy / d / d; }
    }
    if (!n) continue;
    a.seek(cx / n, cy / n, o.cohere ?? 0.25);
    a.ax += (vx / n - a.vx) * (o.align ?? 0.5);
    a.ay += (vy / n - a.vy) * (o.align ?? 0.5);
    a.ax += sx * a.maxForce * (o.sep ?? 6);
    a.ay += sy * a.maxForce * (o.sep ?? 6);
  }
}
