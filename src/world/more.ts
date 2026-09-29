/**
 * Two more places. The rooftops: a tiled roof in front, chimneys and an aerial, wires strung
 * across on which birds line up, and the town behind with windows lighting and going dark as the
 * evening goes on. The pond, from the bank: reeds and bulrushes, a willow, water that holds the
 * sky, lily pads, a log — a frog's world.
 */
import { layer } from '../core/screen';
import { col, mix } from '../core/color';
import type { Rng } from '../core/rng';
import type { LocationDef, LocationInstance, Ledge, Light } from '../game/types';
import { bayer, oval, px, rect, speckle } from '../game/art';
import { Sky, SKY } from '../game/sky';
import { hills, crown, LEAVES, frontGrass, lampPost } from './scenery';

/** A wire hanging between two points, as short straight ledges a bird can stand on. */
function wire(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, sag: number, c: string): Ledge[] {
  const ledges: Ledge[] = [];
  const n = Math.max(2, Math.round(Math.abs(x1 - x0)));
  const yAt = (k: number) => y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * sag;
  for (let i = 0; i <= n; i++) { const k = i / n; px(g, x0 + (x1 - x0) * k, yAt(k), c); }
  for (let x = x0 + 8; x < x1 - 8; x += 14) {
    const k = (x - x0) / (x1 - x0);
    ledges.push({ x0: x - 6, x1: x + 6, y: Math.round(yAt(k)), kind: 'wire' });
  }
  return ledges;
}

export const rooftop: LocationDef = {
  id: 'rooftop',
  name: { uk: 'Дахи міста', en: 'Rooftops' },
  indoor: false,
  weathers: ['clear', 'clear', 'rain', 'snow'],
  build(W, H, tod, rng): LocationInstance {
    const hor = Math.round(H * 0.58);
    const sky = new Sky(W, 0, hor + 10, tod, rng);
    const [cv, g] = layer(W, H);
    // The town behind: rows of houses, a dome, a TV tower.
    const windows: { x: number; y: number; on: boolean; t: number }[] = [];
    const far = (base: number, c: string, lit: number, big: boolean) => {
      for (let x = -10; x < W + 10;) {
        const w = rng.int(big ? 18 : 12, big ? 34 : 22), h = rng.int(big ? 26 : 14, big ? 58 : 30);
        rect(g, x, base - h, w, h + 40, c);
        if (rng.chance(0.4)) { for (let i = 0; i < 6; i++) rect(g, x - 1 + i, base - h - 6 + i, w + 2 - i * 2, 1, mix(c, '#000000', 0.2)); }
        for (let wy = base - h + 4; wy < base - 4; wy += 7) for (let wx = x + 3; wx < x + w - 3; wx += 6) {
          if (rng.chance(lit)) windows.push({ x: wx, y: wy, on: rng.chance(0.5), t: rng.range(0, 30) });
        }
        x += w + rng.int(0, 3);
      }
    };
    far(hor + 6, '#5a6a8a', 0.5, true);
    far(hor + 16, '#48546e', 0.6, false);
    // A dome and a tower.
    const dx = Math.round(W * 0.3);
    oval(g, dx, hor - 30, 12, 12, '#6a7a9a'); rect(g, dx - 12, hor - 30, 24, 40, '#5a6a8a'); rect(g, dx - 1, hor - 48, 2, 8, '#8a9ab8'); rect(g, dx - 3, hor - 45, 6, 1, '#8a9ab8');
    const tx = Math.round(W * 0.78);
    for (let y = 0; y < 90; y++) { const w = Math.max(1, Math.round(2 + y * 0.06)); rect(g, tx - w / 2, hor - 80 + y, w, 1, '#6a7a9a'); }
    rect(g, tx - 5, hor - 60, 10, 5, '#6a7a9a');
    // The roof in front: tiles in rows, a ridge along the top.
    const ridge = Math.round(H * 0.64);
    for (let y = ridge; y < H; y++) {
      const row = Math.floor((y - ridge) / 6);
      const off = (row % 2) * 5;
      for (let x = 0; x < W; x++) {
        const edge = (y - ridge) % 6 === 5;
        const seam = (x + off) % 10 === 0;
        g.fillStyle = col(edge ? '#8a3a2a' : seam ? '#9a4230' : (y - ridge) % 6 < 2 ? '#d8704a' : '#c05a3a');
        g.fillRect(x, y, 1, 1);
      }
    }
    rect(g, 0, ridge - 3, W, 4, '#a84a34'); rect(g, 0, ridge - 3, W, 1, '#e8905a');
    const perches: Ledge[] = [{ x0: 4, x1: W - 4, y: ridge - 3 }];
    // Chimneys and the aerial.
    const chimneys: { x: number; top: number }[] = [];
    for (const f of W > 300 ? [0.18, 0.62] : [0.3]) {
      const x = Math.round(W * f), top = ridge - 30;
      rect(g, x, top, 18, ridge - top, '#9a5a4a');
      for (let y = top + 3; y < ridge; y += 4) for (let xx = x + ((y / 4) % 2) * 3; xx < x + 18; xx += 6) rect(g, xx, y, 1, 1, '#6a3a2a');
      rect(g, x - 2, top - 3, 22, 4, '#7a4a3a'); rect(g, x - 2, top - 3, 22, 1, '#a86a5a');
      rect(g, x + 4, top - 7, 4, 4, '#5a5a5a'); rect(g, x + 10, top - 6, 4, 3, '#5a5a5a');
      chimneys.push({ x: x + 6, top: top - 8 });
      perches.push({ x0: x - 1, x1: x + 19, y: top - 3 });
    }
    // Windows behind the chimneys cannot be seen.
    for (let i = windows.length - 1; i >= 0; i--) { const w = windows[i]; if (chimneys.some((c) => w.x + 3 > c.x - 8 && w.x < c.x + 14 && w.y + 3 > c.top)) windows.splice(i, 1); }
    const ax = Math.round(W * 0.44);
    rect(g, ax, ridge - 44, 2, 42, '#4a4a52');
    for (const [y, w] of [[ridge - 44, 26], [ridge - 36, 20], [ridge - 28, 14]] as [number, number][]) { rect(g, ax - w / 2, y, w, 1, '#4a4a52'); perches.push({ x0: ax - w / 2 + 2, x1: ax + w / 2 - 2, y }); }
    // Wires across the picture.
    perches.push(...wire(g, -4, Math.round(H * 0.3), W + 4, Math.round(H * 0.36), 16, '#2a2430'));
    if (W > 260) perches.push(...wire(g, -4, Math.round(H * 0.42), W + 4, Math.round(H * 0.38), 12, '#2a2430'));
    const lights: Light[] = [];
    if (tod !== 'day') lights.push({ x: tx, y: hor - 82, r: 10, c: '#ff4a4a', flicker: 0.5, a: 0.9 });
    const lit = tod === 'night' ? 0.7 : tod === 'dusk' ? 0.45 : 0;
    return {
      indoor: false,
      floor: H - 10,
      floorBand: [ridge + 6, H - 6],
      perches,
      sky: [0, hor],
      lights,
      update(dt) {
        sky.update(dt);
        for (const w of windows) { w.t -= dt; if (w.t <= 0) { w.t = rng.range(10, 60); w.on = rng.chance(lit); } }
      },
      drawSky: (gg, t) => sky.draw(gg, t),
      drawGlow(gg, t) {
        // Lit windows in the town, and the tower's warning light: they burn through the night.
        for (const w of windows) if (w.on) { gg.fillStyle = col(tod === 'night' ? '#ffcf6a' : '#ffd27a'); gg.fillRect(w.x, w.y, 3, 3); gg.fillStyle = col('#fff0b0'); gg.fillRect(w.x, w.y, 1, 1); }
        if (Math.floor(t * 1.2) % 2 === 0) { gg.fillStyle = col('#ff4a4a'); gg.fillRect(tx - 1, hor - 83, 2, 2); }
      },
      drawBack(gg, t) {
        gg.drawImage(cv, 0, 0);
        // Smoke from the chimneys in the cold hours.
        if (tod !== 'day') {
          gg.globalAlpha = 0.45;
          for (const c of chimneys) for (let i = 0; i < 5; i++) { const k = (t * 0.2 + i / 5) % 1; oval(gg, c.x + k * 14 + Math.sin(k * 6 + i) * 2, c.top - k * 34, 1 + k * 3, 1 + k * 3, '#d8dce8'); }
          gg.globalAlpha = 1;
        }
      },
    };
  },
};

export const pond: LocationDef = {
  id: 'pond',
  name: { uk: 'Ставок', en: 'Pond' },
  indoor: false,
  weathers: ['clear', 'clear', 'rain', 'petals'],
  build(W, H, tod, rng): LocationInstance {
    const hor = Math.round(H * 0.46);
    const water = Math.round(H * 0.58);
    const sky = new Sky(W, 0, hor + 10, tod, rng);
    const [cv, g] = layer(W, H);
    hills(g, W, hor + 6, 16, '#7fb870', 2.4, water + 4, 1, '#9fd08a');
    for (let x = -10; x < W + 10; x += rng.int(14, 26)) crown(g, rng, x, hor - rng.int(0, 8), rng.int(12, 20), rng.int(10, 16), LEAVES.summer);
    rect(g, 0, water - 6, W, 8, '#5a8a3a');
    for (let x = 0; x < W; x++) if (bayer(x, water - 6) < 0.5) px(g, x, water - 7, '#7ab84a');
    // The water: the sky upside down, darker, with the far bank reflected in it.
    const sk = SKY[tod];
    for (let y = water; y < H; y++) {
      const k = (y - water) / (H - water);
      const c = mix(mix(sk[Math.min(sk.length - 1, Math.floor(k * sk.length))], '#1a4a5a', 0.45), '#0e2a3a', k * 0.5);
      rect(g, 0, y, W, 1, c);
    }
    for (let x = 0; x < W; x += 2) { const h = 4 + Math.round(Math.abs(Math.sin(x * 0.07)) * 6); rect(g, x, water, 2, h, mix('#3a6a3a', '#1a4a5a', 0.4)); }
    // A willow on the left leaning over the water.
    const wx = Math.round(W * 0.08);
    rect(g, wx - 5, hor - 40, 10, water - hor + 40, '#6a5040');
    for (let i = 0; i < 26; i++) {
      const x0 = wx - 30 + rng.int(0, 70), y0 = hor - 50 + rng.int(0, 20);
      const L = rng.int(30, 60);
      for (let k = 0; k < L; k++) px(g, x0 + Math.sin(k * 0.1) * 2, y0 + k, k % 3 ? '#6aa84a' : '#8fcf5a');
    }
    crown(g, rng, wx + 6, hor - 50, 34, 14, LEAVES.spring);
    // Reeds and bulrushes along the edges.
    const reeds = (x0: number, x1: number) => {
      for (let x = x0; x < x1; x += rng.int(2, 4)) {
        const h = rng.int(20, 46);
        for (let k = 0; k < h; k++) px(g, x + Math.round(Math.sin(k * 0.05) * 1.5), H - 4 - k, k > h - 8 ? '#8fcf5a' : '#4f8a3a');
        if (rng.chance(0.3)) { rect(g, x - 1, H - 4 - h - 8, 3, 8, '#7a4a2a'); px(g, x, H - 4 - h - 10, '#8fcf5a'); }
      }
    };
    reeds(0, Math.round(W * 0.14));
    reeds(Math.round(W * 0.86), W);
    // A log half in the water.
    const lx = Math.round(W * 0.66), ly = water + 26;
    oval(g, lx, ly, 34, 5, '#6a4a32'); oval(g, lx, ly - 1, 33, 3.5, '#8a6a48'); oval(g, lx + 33, ly, 4, 5, '#c9a878'); oval(g, lx + 33, ly, 2, 3, '#8a6a48');
    speckle(g, rng, lx - 30, ly - 3, 60, 2, '#5a9a3e', 0.3);
    const perches: Ledge[] = [{ x0: lx - 28, x1: lx + 28, y: ly - 4 }];
    // Lily pads, side on: flat ovals on the surface. The scene is told where they are.
    const pads: { x: number; y: number; w: number }[] = [];
    for (let i = 0; i < Math.round(W / 70) + 2; i++) {
      const x = rng.range(W * 0.18, W * 0.84), y = rng.range(water + 12, H - 16);
      if (pads.some((p) => Math.abs(p.x - x) < 30 && Math.abs(p.y - y) < 10) || (Math.abs(x - lx) < 40 && Math.abs(y - ly) < 12)) continue;
      const w = rng.range(12, 18);
      pads.push({ x, y, w });
      oval(g, x, y + 1, w, 3, '#1a3a2a'); oval(g, x, y, w, 2.6, '#4f9a4a'); oval(g, x - w * 0.2, y - 0.5, w * 0.5, 1.2, '#7ad06a');
      rect(g, x + w * 0.4, y - 1, 3, 2, mix('#1a4a5a', '#4f9a4a', 0.2));
      if (rng.chance(0.35)) { oval(g, x - 3, y - 2, 3, 2, '#ffc0d8'); px(g, x - 3, y - 3, '#ffffff'); px(g, x - 3, y - 2, '#ffe066'); }
      perches.push({ x0: Math.round(x - w * 0.6), x1: Math.round(x + w * 0.6), y: Math.round(y - 1) });
    }
    const grass = frontGrass(W, H, rng, 12, ['#3e7a34', '#4f9a3e', '#2f6a2e']);
    const lights: Light[] = [];
    if (W > 320 && tod !== 'day') { const lp = lampPost(g, Math.round(W * 0.93), water - 4, 60); lights.push({ x: lp.x, y: lp.y, r: 70, c: '#ffd89a', flicker: 0.03 }); }
    return {
      indoor: false,
      floor: water,
      floorBand: [water + 6, H - 6],
      water: [water, H],
      perches,
      sky: [0, hor],
      lights,
      update: (dt) => sky.update(dt),
      drawSky: (gg, t) => sky.draw(gg, t),
      drawBack(gg, t) {
        gg.drawImage(cv, 0, 0);
        // Glints and slow ripples on the surface.
        gg.fillStyle = col('#e8fbff');
        gg.globalAlpha = 0.5;
        for (let i = 0; i < 26; i++) {
          const y = water + 6 + ((i * 37) % (H - water - 10));
          const x = ((i * 91 + t * (6 + (i % 4) * 2)) % (W + 40)) - 20;
          gg.fillRect(Math.round(x), y, 4 + (i % 3) * 2, 1);
        }
        gg.globalAlpha = 1;
      },
      drawFront: grass,
    };
  },
};

