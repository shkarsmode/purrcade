/**
 * The seaside: a sky, the sea with its lines of foam rolling in, a sailing boat far out, old
 * groyne posts for the gulls, wet sand where the waves wash up and slide back, dry sand with
 * shells and a sandcastle. The wash line moves all the time, and the scene is told where it is,
 * because the sandpipers chase it down the beach and run from it back up.
 */
import { layer } from '../core/screen';
import { col, mix } from '../core/color';
import type { LocationDef, LocationInstance, Ledge, Hole, Prop } from '../game/types';
import { bayer, oval, px, rect, speckle } from '../game/art';
import { Sky } from '../game/sky';
import { sprite } from '../core/pix';
import { BASE, O, U } from '../sprites/common';
import { prop } from './props';

export interface Coast extends LocationInstance {
  /** Where the water's edge is on the sand at time t. */
  wash(t: number): number;
  shore: number;
}

function sandcastle(): HTMLCanvasElement {
  return sprite('sandcastle', 34, 26, (p) => {
    const S = 5, SL = 6, SD = 7, FL = 8, DK = 9;
    p.rect(2, 14, 31, 25, S);
    p.rect(0, 8, 9, 25, S); p.rect(24, 8, 33, 25, S); p.rect(12, 3, 21, 25, S);
    for (const [x0, x1, y] of [[0, 9, 8], [24, 33, 8], [12, 21, 3]] as [number, number, number][]) for (let x = x0; x <= x1; x += 3) p.rect(x, y - 2, x + 1, y - 1, S);
    p.rect(14, 18, 19, 25, DK); p.disc(16.5, 18, 2.5, DK);
    p.rect(16, -3, 16, 2, SD); p.tri([17, -3], [22, -1.5], [17, 0], FL);
    for (let i = 0; i < 20; i++) p.set((i * 7) % 33, 10 + ((i * 5) % 15), SD);
    p.rim([[S, SL, SD]]);
    p.outline(O, U);
  }, [...BASE, '#e8c888', '#f8e0a8', '#b8945a', '#e8442e', '#6a4a2a']);
}

function umbrella(): HTMLCanvasElement {
  return sprite('umbrella', 50, 48, (p) => {
    const R = 5, RL = 6, W = 7, WL = 8, POLE = 9, TW = 10, TW2 = 11;
    p.rect(24, 8, 25, 44, POLE);
    for (let i = 0; i < 12; i++) {
      const y = 2 + i;
      const hw = Math.round(3 + Math.sqrt(i / 11) * 21);
      for (let x = -hw; x <= hw; x++) p.set(25 + x, y, Math.floor((x + 30) / 7) % 2 ? W : R);
    }
    for (let x = -24; x <= 24; x += 4) p.set(25 + x, 14, Math.floor((x + 30) / 7) % 2 ? W : R);
    // A towel on the sand.
    p.rect(4, 43, 44, 47, TW);
    for (let x = 4; x <= 44; x += 4) p.rect(x, 43, x + 1, 47, TW2);
    p.rim([[R, RL, 0], [W, WL, 0]]);
    p.outline(O, U);
  }, [...BASE, '#e8442e', '#ff7a5a', '#fbf6ee', '#ffffff', '#8a6a4a', '#5c9ed6', '#f4d23a']);
}

export const beach: LocationDef = {
  id: 'beach',
  name: { uk: 'Пляж', en: 'Beach' },
  indoor: false,
  weathers: ['clear', 'clear', 'clear', 'rain'],
  build(W, H, tod, rng): Coast {
    const hor = Math.round(H * 0.42);
    const shore = Math.round(H * 0.62);
    const dryY = Math.round(H * 0.72);
    const sky = new Sky(W, 0, hor + 4, tod, rng);
    const [cv, g] = layer(W, H);
    // The sea: deep at the horizon, turquoise in the shallows.
    const seaC = ['#1f5a9a', '#2a74b0', '#3a90c0', '#4aaec8', '#6ac8c8'];
    for (let y = hor; y < shore + 8; y++) {
      const k = (y - hor) / (shore + 8 - hor);
      const f = k * (seaC.length - 1), i = Math.floor(f), fr = f - i;
      for (let x = 0; x < W; x++) { g.fillStyle = col(bayer(x, y) < fr ? seaC[Math.min(seaC.length - 1, i + 1)] : seaC[i]); g.fillRect(x, y, 1, 1); }
    }
    rect(g, 0, hor, W, 1, '#9fd0f0');
    // Sand: wet then dry.
    for (let y = shore; y < H; y++) {
      const wet = y < dryY;
      rect(g, 0, y, W, 1, wet ? mix('#c8a068', '#d8b47a', (y - shore) / (dryY - shore)) : mix('#f0d8a0', '#e8cc90', (y - dryY) / (H - dryY)));
    }
    for (let x = 0; x < W; x++) if (bayer(x, dryY) < 0.5) px(g, x, dryY, '#e0c490');
    speckle(g, rng, 0, dryY, W, H - dryY, '#d0b078', 0.05);
    speckle(g, rng, 0, dryY, W, H - dryY, '#fff0c8', 0.03);
    // Shells and a starfish.
    for (let i = 0; i < W / 40; i++) { const sx = rng.int(8, W - 8), sy = rng.int(dryY + 4, H - 6); oval(g, sx, sy, 2.5, 1.6, rng.pick(['#fbe0d0', '#f0f0f0', '#e8c0e0'])); px(g, sx, sy, '#c8a0a0'); }
    { const sx = Math.round(W * 0.2), sy = Math.round(H * 0.9); for (let a = 0; a < 5; a++) { const an = -Math.PI / 2 + a * (Math.PI * 2 / 5); for (let r = 0; r < 5; r++) px(g, sx + Math.cos(an) * r, sy + Math.sin(an) * r * 0.7, r < 2 ? '#ff9a5a' : '#f07a3a'); } }
    // Groyne posts sticking out of the water: gulls stand on them.
    const perches: Ledge[] = [];
    for (let i = 0; i < 4; i++) {
      const x = Math.round(W * 0.66 + i * 18), top = Math.round(hor + 22 + i * 7), bot = shore + 2;
      rect(g, x, top, 5, bot - top, '#6a4a32'); rect(g, x, top, 1, bot - top, '#8a6a48'); rect(g, x, top, 5, 1, '#9a7a58');
      perches.push({ x0: x + 1, x1: x + 4, y: top });
    }
    // Crab holes along the wet sand.
    const holes: Hole[] = [];
    for (let i = 0; i < 5; i++) { const x = Math.round(W * (0.12 + i * 0.18) + rng.int(-10, 10)), y = Math.round(dryY + rng.int(2, 18)); holes.push({ x, y, w: 6, h: 3, kind: 'slot' }); oval(g, x, y - 1, 3.5, 1.6, '#6a5030'); oval(g, x, y - 1, 2.5, 1, '#3a2818'); }
    const props: Prop[] = [prop(sandcastle(), Math.round(W * 0.3), Math.round(H * 0.86), 30)];
    if (W > 300) props.push(prop(umbrella(), Math.round(W * 0.84), Math.round(H * 0.93), 10));
    const period = 7;
    const wash = (t: number) => {
      // Two overlapping swells, so no two waves come up the beach alike.
      const a = Math.sin((t / period) * Math.PI * 2), b = Math.sin((t / (period * 1.7)) * Math.PI * 2 + 1);
      return shore + 6 + Math.max(0, a * 0.7 + b * 0.3) * (dryY - shore - 4);
    };
    let boat = rng.range(0, W);
    return {
      indoor: false,
      floor: Math.round(H * 0.86),
      floorBand: [shore + 4, H - 6],
      perches,
      holes,
      props,
      shore,
      wash,
      sky: [0, hor],
      water: [hor, shore],
      update(dt) { sky.update(dt); boat += dt * 3; if (boat > W + 30) boat = -30; },
      drawSky: (gg, t) => sky.draw(gg, t),
      drawBack(gg, t) {
        gg.drawImage(cv, 0, 0);
        // A sailing boat far out.
        const bx = Math.round(boat), by = hor + 6;
        rect(gg, bx - 5, by, 11, 2, '#f4efe6'); rect(gg, bx - 4, by + 2, 9, 1, '#8a4a3a');
        for (let i = 0; i < 7; i++) rect(gg, bx, by - 1 - i, Math.max(1, 5 - Math.floor(i * 0.7)), 1, '#ffffff');
        rect(gg, bx - 1, by - 8, 1, 8, '#6a4a3a');
        // Lines of foam rolling toward the shore.
        gg.fillStyle = col('#e8fbff');
        for (let k = 0; k < 6; k++) {
          const ph = ((t * 0.12 + k / 6) % 1);
          const y = Math.round(hor + 4 + ph * ph * (shore - hor - 2));
          gg.globalAlpha = 0.25 + ph * 0.55;
          for (let x = 0; x < W; x += 1) if (Math.sin(x * 0.09 + k * 2 + t * 0.4) > 0.35 - ph * 0.5) gg.fillRect(x, y + Math.round(Math.sin(x * 0.05 + k) * 1), 1, 1);
        }
        gg.globalAlpha = 1;
        // The sheet of water sliding up the wet sand, with its lacy edge.
        const edge = wash(t);
        gg.globalAlpha = 0.55;
        gg.fillStyle = col('#7ad0d8');
        gg.fillRect(0, shore, W, Math.round(edge - shore));
        gg.globalAlpha = 1;
        gg.fillStyle = col('#ffffff');
        for (let x = 0; x < W; x++) {
          const e = Math.round(edge + Math.sin(x * 0.11 + t * 2) * 1.5 + Math.sin(x * 0.27) * 1);
          gg.fillRect(x, e, 1, 1);
          if (Math.sin(x * 0.3 + t * 3) > 0.6) gg.fillRect(x, e - 1, 1, 1);
        }
      },
    };
  },
};
