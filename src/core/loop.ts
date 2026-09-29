/**
 * The clock: logic in fixed sixtieths of a second, drawing once per frame the screen offers.
 *
 * Fixed steps keep a critter's path the same whatever the monitor's refresh rate; a long gap —
 * a hidden tab, a sleeping laptop — is not replayed step by step but skipped. `speed` runs the
 * world faster than real time, which is how an hours-long run is tested in minutes.
 */
export interface Loop {
  start(): void;
  stop(): void;
  speed: number;
  /** Seconds of world time since start. */
  readonly time: number;
  fps: number;
}

export function createLoop(step: (dt: number) => void, draw: (alpha: number) => void): Loop {
  const DT = 1 / 60;
  let raf = 0, last = 0, acc = 0, running = false;
  let frames = 0, fpsAt = 0;
  const loop: Loop = {
    speed: 1,
    time: 0,
    fps: 60,
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      fpsAt = last;
      raf = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
  function tick(now: number) {
    if (!running) return;
    let gap = (now - last) / 1000;
    last = now;
    if (gap > 0.25) gap = DT;                 // back from a hidden tab: carry on, do not catch up
    acc += gap * loop.speed;
    let n = 0;
    while (acc >= DT && n < 240) {
      step(DT);
      (loop as { time: number }).time += DT;
      acc -= DT;
      n++;
    }
    if (n >= 240) acc = 0;
    draw(acc / DT);
    frames++;
    if (now - fpsAt >= 1000) { loop.fps = Math.round((frames * 1000) / (now - fpsAt)); frames = 0; fpsAt = now; }
    raf = requestAnimationFrame(tick);
  }
  return loop;
}
