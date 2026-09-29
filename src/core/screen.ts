/**
 * The low-resolution world and how it reaches the glass.
 *
 * The game is drawn at about 270 pixels high — the size a pixel-art scene reads best at — and
 * scaled up by a whole number of device pixels, so every art pixel is the same size and square
 * on any screen: ×4 on a 1080p monitor, ×6 on an iPad, ×8 on 4K. The width follows the window,
 * so a tall tablet gets a taller world rather than black bars.
 */
export interface Screen {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  W: number;
  H: number;
  /** Device pixels per world pixel. */
  scale: number;
  /** CSS pixels per world pixel. */
  css: number;
  resize(): boolean;
  /** A point on the page, in world pixels. */
  toWorld(clientX: number, clientY: number): [number, number];
}

export function createScreen(canvas: HTMLCanvasElement, targetH = 270): Screen {
  const g = canvas.getContext('2d', { alpha: false })!;
  const s: Screen = {
    canvas, g, W: 0, H: 0, scale: 1, css: 1,
    resize() {
      const dpr = window.devicePixelRatio || 1;
      const vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
      const devH = vh * dpr, devW = vw * dpr;
      const scale = Math.max(1, Math.round(devH / targetH));
      const W = Math.ceil(devW / scale), H = Math.ceil(devH / scale);
      if (W === s.W && H === s.H && scale === s.scale) return false;
      s.W = W; s.H = H; s.scale = scale; s.css = scale / dpr;
      canvas.width = W; canvas.height = H;
      canvas.style.width = (W * s.css) + 'px';
      canvas.style.height = (H * s.css) + 'px';
      g.imageSmoothingEnabled = false;
      return true;
    },
    toWorld(cx, cy) {
      const r = canvas.getBoundingClientRect();
      return [(cx - r.left) / s.css, (cy - r.top) / s.css];
    },
  };
  s.resize();
  return s;
}

/** An offscreen canvas at world resolution. */
export function layer(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}
