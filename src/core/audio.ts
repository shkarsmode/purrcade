/**
 * Sounds, synthesised on the spot — no files. Squeaks and chirps high in the 2–6 kHz band where
 * a cat's hearing is sharpest (and a phone speaker still reaches), plops and waves for water,
 * bells and bounces for toys, a chime for a catch, and a bed of birdsong, crickets and surf.
 *
 * Browsers only let a page make sound after someone taps it, and an iPhone with its side switch
 * on silent mutes page audio altogether unless the page asks to be treated as playback — both
 * are handled in unlock(), which every tap calls.
 */
type Family = 'critters' | 'water' | 'toys' | 'ambient';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private keepAlive: HTMLAudioElement | null = null;
  enabled = true;
  volume = 0.6;
  /** Which families may make a sound at all. */
  allow: Record<Family, boolean> = { critters: true, water: true, toys: true, ambient: true };
  /** How many sounds have actually been started — for tests. */
  played = 0;
  private last = new Map<string, number>();

  get running(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Call from any tap or click: creates or wakes the audio, and lets it play past the silent switch. */
  unlock() {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) { try { nav.audioSession.type = 'playback'; } catch { /* older Safari */ } }
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(comp).connect(this.ctx.destination);
      // An empty sound played inside the tap is what finally opens the audio on older iPhones.
      const b = this.ctx.createBuffer(1, 1, 22050), src = this.ctx.createBufferSource();
      src.buffer = b; src.connect(this.ctx.destination); src.start(0);
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    // Older iPhones without the audio-session switch: a silent looping <audio> makes the page
    // "playback", so the side switch no longer mutes it.
    if (!nav.audioSession && /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document && !this.keepAlive) {
      const a = new Audio(silentWav());
      a.loop = true;
      a.setAttribute('playsinline', '');
      a.play().catch(() => {});
      this.keepAlive = a;
    }
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  private ok(key: string, gap: number, family: Family): AudioContext | null {
    if (!this.enabled || !this.ctx || !this.master || !this.allow[family] || this.ctx.state !== 'running') return null;
    const now = this.ctx.currentTime;
    if (now - (this.last.get(key) ?? -99) < gap) return null;
    this.last.set(key, now);
    this.played++;
    return this.ctx;
  }

  private tone(ctx: AudioContext, t: number, f0: number, f1: number, dur: number, type: OscillatorType, peak: number, dest?: AudioNode) {
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.015, dur / 4));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(dest || this.master!);
    o.start(t); o.stop(t + dur + 0.03);
  }

  /** A burst of filtered noise: rustles, splashes, surf. */
  private hiss(ctx: AudioContext, t: number, dur: number, peak: number, filter: BiquadFilterType, f0: number, f1 = f0, q = 1, attack = 0.01) {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(peak, t + Math.max(0.003, attack));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(gn).connect(this.master!);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  // --- critters -----------------------------------------------------------------------------

  squeak() {
    const ctx = this.ok('squeak', 0.3, 'critters'); if (!ctx) return;
    const t = ctx.currentTime;
    const f = 3400 + Math.random() * 1500;
    this.tone(ctx, t, f, f * 1.3, 0.07, 'sine', 0.3);
    if (Math.random() < 0.7) this.tone(ctx, t + 0.09, f * 1.1, f * 0.85, 0.06, 'sine', 0.22);
  }

  /** Little claws on a hard floor. */
  patter() {
    const ctx = this.ok('patter', 0.5, 'critters'); if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 5; i++) this.hiss(ctx, t + i * 0.045 + Math.random() * 0.01, 0.025, 0.1, 'highpass', 4500, 4500, 0.7, 0.002);
  }

  chirp(kind = 0) {
    const ctx = this.ok('chirp', 0.22, 'critters'); if (!ctx) return;
    const t = ctx.currentTime;
    const base = [2600, 3400, 4200, 2200, 3000, 3800][kind % 6];
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = base * (0.9 + Math.random() * 0.3);
      this.tone(ctx, t + i * 0.085, f, f * (kind % 2 ? 1.5 : 0.72), 0.065, 'sine', 0.2);
    }
  }

  /** A pigeon: a soft rolling coo. */
  coo() {
    const ctx = this.ok('coo', 1.2, 'critters'); if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), gn = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(360, t + 0.5);
    lfo.frequency.value = 14; lg.gain.value = 18;
    lfo.connect(lg).connect(o.frequency);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.2, t + 0.06);
    gn.gain.setValueAtTime(0.2, t + 0.35); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(gn).connect(this.master!);
    o.start(t); lfo.start(t); o.stop(t + 0.6); lfo.stop(t + 0.6);
  }

  /** Wings clattering up all at once. */
  whoosh() {
    const ctx = this.ok('whoosh', 0.8, 'critters'); if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 6; i++) this.hiss(ctx, t + i * 0.05, 0.08, 0.09, 'bandpass', 1400 + Math.random() * 900, 2600, 1.2, 0.005);
  }

  /** A herring gull: a nasal "kee-ow". */
  gull() {
    const ctx = this.ok('gull', 1.5, 'critters'); if (!ctx) return;
    const t = ctx.currentTime;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 2;
    f.connect(this.master!);
    this.tone(ctx, t, 1500, 1750, 0.12, 'sawtooth', 0.18, f);
    this.tone(ctx, t + 0.13, 1750, 900, 0.32, 'sawtooth', 0.2, f);
  }

  /** A frog: "rib-bit", low and buzzy, with enough overtones for a small speaker. */
  croak() {
    const ctx = this.ok('croak', 0.9, 'critters'); if (!ctx) return;
    const t = ctx.currentTime;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.5;
    f.connect(this.master!);
    this.tone(ctx, t, 260, 230, 0.12, 'sawtooth', 0.35, f);
    this.tone(ctx, t + 0.16, 300, 240, 0.16, 'sawtooth', 0.35, f);
  }

  /** The snap of a frog's tongue. */
  snap() {
    const ctx = this.ok('snap', 0.2, 'critters'); if (!ctx) return;
    this.hiss(ctx, ctx.currentTime, 0.04, 0.2, 'bandpass', 2400, 1200, 2, 0.002);
  }

  /** A squirrel's alarm: a run of hard little clicks. */
  chatter() {
    const ctx = this.ok('chatter', 1, 'critters'); if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 7; i++) this.tone(ctx, t + i * 0.06, 1900, 1300, 0.03, 'square', 0.1);
  }

  /** A grasshopper's leap: a dry chirr. */
  chirr() {
    const ctx = this.ok('chirr', 0.6, 'critters'); if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 8; i++) this.hiss(ctx, t + i * 0.018, 0.012, 0.08, 'highpass', 6000, 6000, 0.7, 0.001);
  }

  buzz() {
    const ctx = this.ok('buzz', 1.2, 'critters'); if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), gn = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 330;
    lfo.frequency.value = 42; lg.gain.value = 40;
    lfo.connect(lg).connect(o.frequency);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.06, t + 0.1);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(gn).connect(this.master!);
    o.start(t); lfo.start(t); o.stop(t + 0.75); lfo.stop(t + 0.75);
  }

  /** Something popping up out of the ground. */
  boing() {
    const ctx = this.ok('boing', 0.15, 'critters'); if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), gn = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.14);
    lfo.frequency.value = 24; lg.gain.value = 40;
    lfo.connect(lg).connect(o.frequency);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.18, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(gn).connect(this.master!);
    o.start(t); lfo.start(t); o.stop(t + 0.22); lfo.stop(t + 0.22);
  }

  // --- water --------------------------------------------------------------------------------

  plop() {
    const ctx = this.ok('plop', 0.18, 'water'); if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(ctx, t, 1000, 190, 0.13, 'sine', 0.32);
    this.hiss(ctx, t, 0.12, 0.05, 'highpass', 3000, 3000);
  }

  /** An air bubble rising: a tiny upward blip. */
  bubble() {
    const ctx = this.ok('bubble', 0.12, 'water'); if (!ctx) return;
    const t = ctx.currentTime;
    const f = 500 + Math.random() * 500;
    this.tone(ctx, t, f, f * 2.2, 0.06, 'sine', 0.08);
  }

  // --- toys ---------------------------------------------------------------------------------

  pop() {
    const ctx = this.ok('pop', 0.05, 'toys'); if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(ctx, t, 1500, 480, 0.05, 'triangle', 0.25);
    this.hiss(ctx, t, 0.03, 0.06, 'highpass', 5000);
  }

  bounce() {
    const ctx = this.ok('bounce', 0.07, 'toys'); if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(ctx, t, 380, 170, 0.08, 'square', 0.08);
  }

  /** A little bell: the jingle ball, the bell on the feather wand. */
  ting() {
    const ctx = this.ok('ting', 0.12, 'toys'); if (!ctx) return;
    const t = ctx.currentTime;
    const f = 2600 + Math.random() * 500;
    this.tone(ctx, t, f, f, 0.35, 'sine', 0.12);
    this.tone(ctx, t, f * 1.51, f * 1.5, 0.25, 'sine', 0.07);
    this.tone(ctx, t + 0.05, f * 1.02, f, 0.2, 'sine', 0.06);
  }

  /** A robot's two-tone beep. */
  beep() {
    const ctx = this.ok('beep', 0.8, 'toys'); if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(ctx, t, 1050, 1050, 0.07, 'square', 0.07);
    this.tone(ctx, t + 0.09, 1400, 1400, 0.09, 'square', 0.07);
  }

  /** An arcade blip. */
  blip(high = false) {
    const ctx = this.ok(high ? 'blipH' : 'blip', 0.09, 'toys'); if (!ctx) return;
    const t = ctx.currentTime;
    const f = high ? 1320 : 880;
    this.tone(ctx, t, f, f * 1.2, 0.05, 'square', 0.06);
  }

  // --- ambience -----------------------------------------------------------------------------

  /** A songbird's phrase: a run of quick notes that rise and fall. */
  song(quiet = false) {
    const ctx = this.ok('song', 1.4, 'ambient'); if (!ctx) return;
    const t = ctx.currentTime;
    const base = 2300 + Math.random() * 1700;
    const n = 4 + Math.floor(Math.random() * 6);
    const peak = quiet ? 0.05 : 0.11;
    for (let i = 0; i < n; i++) {
      const f = base * (1 + Math.sin(i * 1.7 + Math.random()) * 0.25);
      this.tone(ctx, t + i * 0.1, f, f * (i % 2 ? 1.35 : 0.78), 0.075, 'sine', peak);
    }
  }

  /** A cricket: three quick pulses, high and thin. */
  cricket(quiet = false) {
    const ctx = this.ok('cricket', 0.7, 'ambient'); if (!ctx) return;
    const t = ctx.currentTime;
    const f = 4200 + Math.random() * 600;
    for (let i = 0; i < 3; i++) this.tone(ctx, t + i * 0.05, f, f, 0.032, 'sine', quiet ? 0.025 : 0.06);
  }

  /** An owl: hoo… hoo-hoo. */
  owl() {
    const ctx = this.ok('owl', 5, 'ambient'); if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(ctx, t, 480, 430, 0.35, 'sine', 0.14);
    this.tone(ctx, t + 0.55, 490, 440, 0.16, 'sine', 0.1);
    this.tone(ctx, t + 0.78, 480, 420, 0.42, 'sine', 0.14);
  }

  /** A wave coming up the beach and sliding back. */
  wave() {
    const ctx = this.ok('wave', 3, 'ambient'); if (!ctx) return;
    const t = ctx.currentTime;
    this.hiss(ctx, t, 2.4, 0.16, 'lowpass', 500, 1400, 0.7, 1.0);
    this.hiss(ctx, t + 1.2, 1.6, 0.07, 'highpass', 2500, 4000, 0.7, 0.3);
  }

  /** Water: a soft drip. */
  drip() {
    const ctx = this.ok('drip', 0.5, 'ambient'); if (!ctx) return;
    const t = ctx.currentTime;
    const f = 800 + Math.random() * 700;
    this.tone(ctx, t, f, f * 0.33, 0.1, 'sine', 0.12);
  }

  // --- rewards ------------------------------------------------------------------------------

  /** The catch: two bright notes. */
  ding() {
    const ctx = this.ok('ding', 0.1, 'toys'); if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(ctx, t, 1320, 1320, 0.1, 'triangle', 0.2);
    this.tone(ctx, t + 0.07, 1760, 1760, 0.16, 'triangle', 0.17);
  }

  /** "Sound is on": a little rising chime, played straight away so the switch is heard to work. */
  chime() {
    if (!this.ctx || !this.master) return;
    this.enabled = true;
    const ctx = this.ctx, t = ctx.currentTime + 0.03;
    this.played++;
    [1046, 1318, 1568, 2093].forEach((f, i) => this.tone(ctx, t + i * 0.08, f, f, 0.22, 'triangle', 0.16));
  }
}

/** A short silent WAV, as a data URL. */
function silentWav(): string {
  const n = 800, rate = 8000;
  const bytes = new Uint8Array(44 + n);
  const dv = new DataView(bytes.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
  str(36, 'data'); dv.setUint32(40, n, true);
  bytes.fill(128, 44);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}
