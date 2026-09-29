/**
 * Sounds, synthesised on the spot — no files. Off unless switched on: a cat that has learnt the
 * squeak comes running from the next room, which is the point, and also exactly why it is not a
 * default. Chirps are short frequency sweeps in the 2–6 kHz band birds sing in; the mouse squeak
 * is higher and shorter; water is a pitched-down plop.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = false;
  volume = 0.5;
  /** Which families may make a sound at all. */
  allow = { critters: true, water: true, toys: true };
  private last = new Map<string, number>();

  /** Must be called from a user gesture before anything can play. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  private ok(key: string, gap: number, family: keyof Sfx['allow']): AudioContext | null {
    if (!this.enabled || !this.ctx || !this.master || !this.allow[family]) return null;
    const now = this.ctx.currentTime;
    if (now - (this.last.get(key) || -9) < gap) return null;
    this.last.set(key, now);
    return this.ctx;
  }

  private tone(ctx: AudioContext, t: number, f0: number, f1: number, dur: number, type: OscillatorType, peak: number) {
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.02, dur / 4));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(this.master!);
    o.start(t); o.stop(t + dur + 0.02);
  }

  squeak() {
    const ctx = this.ok('squeak', 0.35, 'critters'); if (!ctx) return;
    const t = ctx.currentTime;
    const f = 3600 + Math.random() * 1400;
    this.tone(ctx, t, f, f * 1.25, 0.06, 'sine', 0.22);
    if (Math.random() < 0.6) this.tone(ctx, t + 0.08, f * 1.1, f * 0.9, 0.05, 'sine', 0.16);
  }

  chirp(kind = 0) {
    const ctx = this.ok('chirp', 0.25, 'critters'); if (!ctx) return;
    const t = ctx.currentTime;
    const base = [2600, 3400, 4200, 2200][kind % 4];
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = base * (0.9 + Math.random() * 0.3);
      this.tone(ctx, t + i * 0.09, f, f * (kind % 2 ? 1.6 : 0.7), 0.07, 'sine', 0.12);
    }
  }

  plop() {
    const ctx = this.ok('plop', 0.2, 'water'); if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(ctx, t, 900, 180, 0.12, 'sine', 0.25);
  }

  pop() {
    const ctx = this.ok('pop', 0.06, 'toys'); if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(ctx, t, 1400, 500, 0.05, 'triangle', 0.18);
  }

  buzz() {
    const ctx = this.ok('buzz', 1.2, 'critters'); if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), gn = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 180;
    lfo.frequency.value = 38; lg.gain.value = 30;
    lfo.connect(lg).connect(o.frequency);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.03, t + 0.1);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(gn).connect(this.master!);
    o.start(t); lfo.start(t); o.stop(t + 0.75); lfo.stop(t + 0.75);
  }

  bounce() {
    const ctx = this.ok('bounce', 0.08, 'toys'); if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(ctx, t, 320, 160, 0.08, 'square', 0.06);
  }

  /** The catch: two bright notes. */
  ding() {
    const ctx = this.ok('ding', 0.12, 'toys'); if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(ctx, t, 1320, 1320, 0.09, 'triangle', 0.12);
    this.tone(ctx, t + 0.07, 1760, 1760, 0.14, 'triangle', 0.1);
  }
}
