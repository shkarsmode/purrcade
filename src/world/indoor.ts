/**
 * Indoor places: a kitchen, a living room, an attic. Each is painted once into a still layer —
 * wall, floor, furniture — with the few things that move (a clock's hands, a curtain in the
 * draught, steam off a mug, the lamp on its cord) drawn over it each frame. Each tells the scenes
 * where its floor is, where the mouse holes are and what stands on the floor to hide behind.
 */
import { layer } from '../core/screen';
import { mix } from '../core/color';
import type { Rng } from '../core/rng';
import type { LocationDef, LocationInstance, TimeOfDay, Hole, Light, Prop } from '../game/types';
import { bands, boards, drawHole, oval, planks, px, rect, tiles, wallpaper, speckle } from '../game/art';
import { SKY } from '../game/sky';
import { sackSprite, bowlSprite, basketSprite, plantSprite, boxSprite, bootsSprite, paperBagSprite, prop } from './props';

/** A window onto the sky for the hour: panes, a far horizon, frame, sill. */
function windowView(g: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number, tod: TimeOfDay, frame = '#f4efe6') {
  bands(g, x, y, w, h, SKY[tod], 4);
  if (tod === 'night') {
    for (let i = 0; i < (w * h) / 55; i++) px(g, x + rng.int(1, w - 2), y + rng.int(1, h - 2), rng.chance(0.3) ? '#ffffff' : '#8fa0d8');
    oval(g, x + w * 0.72, y + h * 0.24, 4, 4, '#f4f1d8');
    px(g, x + w * 0.72 - 1, y + h * 0.24, '#d6cfa8'); px(g, x + w * 0.72 + 1, y + h * 0.24 + 2, '#d6cfa8');
  }
  // A far horizon: hills, trees, a roof or two.
  const hy = y + h * 0.66;
  const hill = { dawn: '#8e5d7a', day: '#8cc47a', dusk: '#5a3d66', night: '#1c2442' }[tod];
  const tree = { dawn: '#6c4563', day: '#5a9e58', dusk: '#452f55', night: '#141a33' }[tod];
  for (let xx = 0; xx < w; xx++) {
    const top = hy + Math.sin(xx * 0.06 + 1) * 2 + Math.sin(xx * 0.17) * 1;
    rect(g, x + xx, top, 1, y + h - top, hill);
  }
  for (let xx = 2; xx < w - 2; xx += rng.int(4, 9)) {
    const th = rng.int(4, 9);
    oval(g, x + xx, hy - th / 2, 2.5, th / 2 + 1, tree);
  }
  const rx = x + Math.round(w * 0.3);
  rect(g, rx, hy - 5, 10, 6, tod === 'night' ? '#2b2f4a' : '#e9dcc8');
  for (let i = 0; i < 6; i++) rect(g, rx - 1 + i, hy - 6 - i, 12 - i * 2, 1, tod === 'night' ? '#402a3a' : '#c0504a');
  if (tod === 'night' || tod === 'dusk') rect(g, rx + 4, hy - 3, 2, 2, '#ffd27a');
  if (tod === 'day') oval(g, x + w * 0.76, y + h * 0.2, 3, 3, '#fff6c2');
  const f = mix(frame, '#000000', 0.22), fl = mix(frame, '#ffffff', 0.5);
  rect(g, x - 3, y - 3, w + 6, 3, frame); rect(g, x - 3, y + h, w + 6, 3, frame);
  rect(g, x - 3, y, 3, h, frame); rect(g, x + w, y, 3, h, frame);
  rect(g, x + Math.floor(w / 2) - 1, y, 2, h, frame); rect(g, x, y + Math.floor(h / 2) - 1, w, 2, frame);
  rect(g, x - 3, y - 3, w + 6, 1, fl);
  rect(g, x, y, w, 1, f); rect(g, x, y, 1, h, f);
  // The sill.
  rect(g, x - 7, y + h + 3, w + 14, 3, frame); rect(g, x - 7, y + h + 3, w + 14, 1, fl); rect(g, x - 6, y + h + 6, w + 12, 1, f);
  // Glints on the glass.
  for (const [gx, gy] of [[3, 3], [4, 3], [3, 4], [w / 2 + 3, h / 2 + 3], [w / 2 + 4, h / 2 + 3]]) px(g, x + gx, y + gy, '#ffffff');
  return { sill: y + h + 3 };
}

function curtain(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string, t: number, side: number) {
  const dark = mix(c, '#000000', 0.25), light = mix(c, '#ffffff', 0.18);
  rect(g, x - 2, y - 3, w + 4, 2, '#7a5236');
  for (let yy = 0; yy < h; yy++) {
    const sway = Math.sin(t * 0.8 + yy * 0.08) * (yy / h) * 1.5;
    const tie = Math.abs(yy - h * 0.62) < 2;
    const ww = Math.round(w * (tie ? 0.45 : 0.55 + 0.45 * Math.abs((yy / h) - 0.62) * 1.6));
    const x0 = side < 0 ? x : x + w - ww;
    rect(g, x0 + sway, y + yy, ww, 1, tie ? mix(c, '#000000', 0.35) : c);
    for (let k = 3; k < ww - 1; k += 5) px(g, x0 + sway + k, y + yy, dark);
    px(g, x0 + sway + (side < 0 ? ww - 1 : 0), y + yy, light);
  }
}

/** A pot of herbs on a sill. */
function herbs(g: CanvasRenderingContext2D, rng: Rng, x: number, y: number) {
  rect(g, x - 5, y - 7, 10, 7, '#c9643d'); rect(g, x - 6, y - 8, 12, 2, '#e07a4f'); rect(g, x + 3, y - 6, 1, 5, '#a44f2e');
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + rng.range(-1, 1);
    const L = rng.int(4, 9);
    for (let r = 0; r < L; r++) px(g, x + Math.cos(a) * r, y - 8 + Math.sin(a) * r, r > L - 3 ? '#8fd16a' : '#4f9a4a');
  }
}

export const kitchen: LocationDef = {
  id: 'kitchen',
  name: { uk: 'Кухня', en: 'Kitchen' },
  indoor: true,
  weathers: ['clear', 'motes'],
  build(W, H, tod, rng): LocationInstance {
    const floorY = Math.round(H * 0.66);
    const wainY = Math.round(H * 0.47);
    const [cv, g] = layer(W, H);
    wallpaper(g, 0, 0, W, wainY, '#f4e4b8', '#ecd6a2', 'floral', '#e79b8f');
    rect(g, 0, 0, W, 4, '#8a5a36'); rect(g, 0, 4, W, 1, '#5f3b22');
    boards(g, rng, 0, wainY, W, floorY - wainY, '#b7835a', 9);
    rect(g, 0, wainY - 2, W, 3, '#7a4c2c'); rect(g, 0, wainY - 2, W, 1, '#c99a6c');
    const sk = 7;
    rect(g, 0, floorY - sk, W, sk, '#f1ebe0'); rect(g, 0, floorY - sk, W, 1, '#ffffff'); rect(g, 0, floorY - sk + 1, W, 1, '#ddd3c3'); rect(g, 0, floorY - 1, W, 1, '#b3a58f');
    tiles(g, 0, floorY, W, H - floorY, '#ece5d2', '#5a7fbf', '#3d5a8c');
    g.globalAlpha = 0.2; rect(g, 0, floorY, W, 2, '#000000'); g.globalAlpha = 1;

    // The window, and a pot of herbs on its sill.
    const wx = Math.round(W * 0.12), wy = Math.round(H * 0.09), ww = Math.max(40, Math.round(W * 0.19)), wh = Math.round(H * 0.24);
    const { sill } = windowView(g, rng, wx, wy, ww, wh, tod);
    herbs(g, rng, wx + ww - 10, sill);

    // The table against the wall, a gingham cloth, a mug, bread, apples.
    const tx = Math.round(W * 0.03), tw = Math.max(70, Math.round(W * 0.27)), ty = Math.round(floorY - H * 0.17);
    for (const lx of [tx + 5, tx + tw - 9]) { rect(g, lx, ty + 4, 4, floorY - ty - 1, '#9c6536'); rect(g, lx, ty + 4, 1, floorY - ty - 1, '#c08650'); }
    g.globalAlpha = 0.25; oval(g, tx + tw / 2, floorY + 1, tw / 2, 2, '#000000'); g.globalAlpha = 1;
    rect(g, tx - 2, ty, tw + 4, 4, '#c8874f'); rect(g, tx - 2, ty, tw + 4, 1, '#e4a86e');
    for (let yy = 0; yy < 9; yy++) for (let xx = 0; xx < tw + 6; xx++) {
      const check = ((xx >> 2) + (yy >> 2)) % 2 === 0;
      const edge = yy === 8 && xx % 4 === 2;
      if (yy === 8 && !edge && xx % 2) continue;
      px(g, tx - 3 + xx, ty + 3 + yy, check ? '#e05a5a' : '#fbeee8');
    }
    rect(g, tx - 3, ty + 3, tw + 6, 1, '#f7c3c3');
    const mugX = tx + 14, mugY = ty;
    rect(g, mugX, mugY - 8, 8, 8, '#f4efe6'); rect(g, mugX, mugY - 8, 8, 1, '#ffffff'); rect(g, mugX + 1, mugY - 6, 6, 2, '#5a7fbf');
    rect(g, mugX + 8, mugY - 6, 2, 1, '#f4efe6'); rect(g, mugX + 9, mugY - 6, 1, 4, '#f4efe6'); rect(g, mugX + 8, mugY - 3, 2, 1, '#f4efe6');
    const bx = tx + tw - 30;
    oval(g, bx + 8, ty - 3, 9, 4, '#d99a4e'); oval(g, bx + 8, ty - 4, 8, 3, '#e9b46a');
    for (let i = 0; i < 3; i++) rect(g, bx + 3 + i * 5, ty - 6, 2, 1, '#b8742f');
    const ax = tx + tw / 2 - 4;
    oval(g, ax, ty - 2, 8, 2, '#8a5a36');
    oval(g, ax - 4, ty - 5, 3, 3, '#e04848'); oval(g, ax + 2, ty - 6, 3, 3, '#8fcf5a'); oval(g, ax + 5, ty - 4, 3, 3, '#f2c14e');
    px(g, ax - 5, ty - 7, '#ffb0a0'); px(g, ax + 1, ty - 8, '#d9f5b0');

    // The lamp over the table.
    const lx = Math.round(W * 0.37), lampY = Math.round(H * 0.19);
    rect(g, lx, 5, 1, lampY - 5, '#3a2e2a');
    for (let yy = 0; yy < 9; yy++) { const hw = Math.round(3 + yy * 1.25); rect(g, lx - hw, lampY + yy, hw * 2 + 1, 1, yy < 2 ? '#4e8a74' : yy === 8 ? '#2e5a4a' : '#3f7a64'); }
    rect(g, lx - 5, lampY + 1, 2, 5, '#6fb39a');
    oval(g, lx, lampY + 9, 3, 1.5, tod === 'day' ? '#fff3c8' : '#fff8d8');

    // The clock (hands drawn live).
    const cx = Math.round(W * 0.47), cy = Math.round(H * 0.15);
    oval(g, cx, cy, 10, 10, '#5b3a29'); oval(g, cx, cy, 8.5, 8.5, '#fdf6e3'); oval(g, cx - 1, cy - 1, 6, 6, '#fffdf5');
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; px(g, cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, i % 3 ? '#b59b82' : '#5b3a29'); }

    // A shelf with jars.
    const sx = Math.round(W * 0.53), sy = Math.round(H * 0.31), sw = Math.min(72, Math.round(W * 0.16));
    rect(g, sx, sy, sw, 3, '#8a5a36'); rect(g, sx, sy, sw, 1, '#b07a4c'); rect(g, sx + 3, sy + 3, 2, 4, '#6f4528'); rect(g, sx + sw - 5, sy + 3, 2, 4, '#6f4528');
    const jars = ['#e86a5f', '#f2c14e', '#5c9ed6', '#8cc084', '#c98ad6'];
    const n = Math.max(2, Math.floor((sw - 4) / 14));
    for (let i = 0; i < n; i++) {
      const jx = sx + 3 + i * 14, jh = 9 + (i % 2) * 3;
      rect(g, jx, sy - jh, 10, jh, '#d8e8ee'); rect(g, jx + 1, sy - jh + 3, 8, jh - 4, jars[i % jars.length]);
      rect(g, jx - 1, sy - jh - 2, 12, 2, '#a87c52'); rect(g, jx + 3, sy - jh + 5, 4, 3, '#fff8e8');
      rect(g, jx + 1, sy - jh + 1, 1, jh - 2, '#ffffff');
    }

    // The fridge, with magnets and a drawing of a cat stuck to it.
    let fridge = null as null | { x: number; w: number };
    if (W > 250) {
      const fx = Math.round(W * 0.81), fw = Math.max(40, Math.round(W * 0.14)), ft = Math.round(H * 0.12);
      fridge = { x: fx, w: fw };
      rect(g, fx, ft + 1, fw, floorY - ft - 1, '#dfe7ea'); rect(g, fx + 1, ft, fw - 2, 1, '#dfe7ea');
      rect(g, fx + 1, ft + 1, 1, floorY - ft - 3, '#ffffff'); rect(g, fx + fw - 2, ft + 2, 1, floorY - ft - 3, '#a9bac1');
      const split = Math.round(ft + (floorY - ft) * 0.36);
      rect(g, fx + 1, split, fw - 2, 1, '#9fb1b8'); rect(g, fx + 1, split + 1, fw - 2, 1, '#f4f8f9');
      rect(g, fx + 4, ft + 8, 2, 16, '#8a9aa3'); rect(g, fx + 4, split + 6, 2, 22, '#8a9aa3'); rect(g, fx + 4, ft + 8, 1, 16, '#c4d0d5');
      rect(g, fx + Math.round(fw * 0.5), ft + 14, 6, 5, '#e86a5f'); rect(g, fx + Math.round(fw * 0.72), ft + 26, 5, 5, '#f2c14e');
      // The drawing: a paper, a crayon cat.
      const dx = fx + Math.round(fw * 0.35), dy = split + 12;
      rect(g, dx, dy, 16, 18, '#fffdf4'); rect(g, dx + 6, dy - 1, 4, 2, '#5c9ed6');
      const cat: [number, number][] = [[4, 11], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 11], [10, 12], [9, 13], [5, 13], [4, 12], [4, 8], [5, 9], [9, 9], [10, 8], [11, 13], [12, 12], [13, 11], [13, 10]];
      for (const [a, b] of cat) px(g, dx + a, dy + b, '#f08a3c');
      px(g, dx + 6, dy + 11, '#2a1f2b'); px(g, dx + 8, dy + 11, '#2a1f2b');
      for (let i = 0; i < 5; i++) px(g, dx + 3 + i * 2, dy + 16, '#8fcf5a');
      rect(g, fx - 1, floorY - 4, fw + 2, 4, '#56646b'); rect(g, fx + 2, floorY - 3, fw - 4, 1, '#3c474d');
      g.globalAlpha = 0.25; rect(g, fx - 3, floorY, fw + 6, 2, '#000000'); g.globalAlpha = 1;
    }

    // Mouse holes along the skirting, between the table and the fridge.
    const right = fridge ? fridge.x - 12 : W - 14;
    const left = tx + tw + 14;
    const holes: Hole[] = [];
    const count = Math.max(2, Math.min(4, Math.floor((right - left) / 46)));
    for (let i = 0; i < count; i++) {
      const x = Math.round(left + ((i + 0.5) / count) * (right - left) + rng.int(-5, 5));
      holes.push({ x, y: floorY - 1, w: 14, h: 12, kind: 'arch' });
    }
    for (const h of holes) drawHole(g, h, '#f1ebe0');

    const props: Prop[] = [prop(sackSprite(), Math.round(W * 0.46), Math.round(floorY + (H - floorY) * 0.64))];
    if (fridge && W > 330) props.push(prop(bowlSprite(), fridge.x + fridge.w / 2, floorY + 13, 22));

    const lights: Light[] = [
      { x: lx, y: lampY + 14, r: 95, c: '#ffcf85' },
      { x: wx + ww / 2, y: wy + wh / 2, r: 46, c: tod === 'night' ? '#6b7fc0' : '#fff2c0', a: tod === 'night' ? 1 : 0.5 },
    ];
    return {
      indoor: true,
      floor: floorY + 10,
      floorBand: [floorY + 3, H - 6],
      holes,
      props,
      wall: [0, floorY],
      lights,
      drawBack(gg, t) {
        gg.drawImage(cv, 0, 0);
        const d = new Date();
        const hA = ((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2 - Math.PI / 2;
        const mA = (d.getMinutes() + d.getSeconds() / 60) / 60 * Math.PI * 2 - Math.PI / 2;
        const sA = (d.getSeconds() + (t % 1)) / 60 * Math.PI * 2 - Math.PI / 2;
        for (let r = 0; r <= 4; r++) px(gg, cx + Math.cos(hA) * r, cy + Math.sin(hA) * r, '#3b2a20');
        for (let r = 0; r <= 6; r++) px(gg, cx + Math.cos(mA) * r, cy + Math.sin(mA) * r, '#3b2a20');
        for (let r = 0; r <= 6; r++) px(gg, cx + Math.cos(sA) * r, cy + Math.sin(sA) * r, '#d94b4b');
        px(gg, cx, cy, '#d94b4b');
        curtain(gg, wx - 11, wy - 5, 15, wh + 10, '#c9505a', t, -1);
        curtain(gg, wx + ww - 4, wy - 5, 15, wh + 10, '#c9505a', t + 1, 1);
        // Steam off the mug.
        gg.globalAlpha = 0.55;
        for (let i = 0; i < 3; i++) {
          const k = ((t * 0.5 + i / 3) % 1);
          px(gg, mugX + 3 + Math.sin(k * 6 + i) * 1.5, mugY - 10 - k * 12, '#ffffff');
        }
        gg.globalAlpha = 1;
      },
    };
  },
};

export const livingroom: LocationDef = {
  id: 'livingroom',
  name: { uk: 'Вітальня', en: 'Living room' },
  indoor: true,
  weathers: ['clear', 'motes'],
  build(W, H, tod, rng): LocationInstance {
    const floorY = Math.round(H * 0.63);
    const [cv, g] = layer(W, H);
    wallpaper(g, 0, 0, W, floorY, '#5e8f8c', '#6c9d99', 'diamonds');
    rect(g, 0, 0, W, 4, '#e9e1d2'); rect(g, 0, 4, W, 1, '#b9ab95');
    rect(g, 0, floorY - 6, W, 6, '#e9e1d2'); rect(g, 0, floorY - 6, W, 1, '#ffffff'); rect(g, 0, floorY - 1, W, 1, '#a89a84');
    planks(g, rng, 0, floorY, W, H - floorY, '#b98a5a', 8);
    g.globalAlpha = 0.2; rect(g, 0, floorY, W, 2, '#000000'); g.globalAlpha = 1;

    const wx = Math.round(W * 0.58), wy = Math.round(H * 0.08), ww = Math.max(44, Math.round(W * 0.19)), wh = Math.round(H * 0.29);
    windowView(g, rng, wx, wy, ww, wh, tod);

    // A picture: a little sunset in a gold frame.
    const px0 = Math.round(W * 0.19), py0 = Math.round(H * 0.1);
    rect(g, px0 - 4, py0 - 4, 44, 32, '#a8792a'); rect(g, px0 - 3, py0 - 3, 42, 30, '#e7c26a'); rect(g, px0 - 3, py0 - 3, 42, 1, '#fff0b0');
    bands(g, px0, py0, 36, 24, ['#f7c38a', '#f08a6f', '#7a5a9a'], 3);
    oval(g, px0 + 22, py0 + 12, 4, 4, '#fff2b0');
    for (let x = 0; x < 36; x++) rect(g, px0 + x, py0 + 15 + Math.round(Math.sin(x * 0.3) * 1.5), 1, 9 - Math.round(Math.sin(x * 0.3) * 1.5), '#3e6a5a');
    g.globalAlpha = 0.2; rect(g, px0 - 3, py0 + 28, 44, 2, '#000000'); g.globalAlpha = 1;

    // The sofa: back, seat cushions, arms, legs, and the dark gap underneath.
    const sx = Math.round(W * 0.07), sw = Math.max(110, Math.round(W * 0.42)), legH = 8;
    const sTop = Math.round(floorY - H * 0.23), seatY = Math.round(floorY - H * 0.1);
    const sc = '#4a6fb5', sd = mix(sc, '#000000', 0.32), sl = mix(sc, '#ffffff', 0.2), sdd = mix(sc, '#000000', 0.5);
    rect(g, sx - 10, floorY - legH, sw + 20, legH, '#1b1520');                         // the dark under it
    for (const lx of [sx - 6, sx + 10, sx + sw - 14, sx + sw + 2]) { rect(g, lx, floorY - legH, 4, legH, '#6b4a2c'); rect(g, lx, floorY - legH, 1, legH, '#8f6a44'); }
    rect(g, sx, sTop, sw, seatY - sTop, sc); rect(g, sx, sTop, sw, 2, sl); rect(g, sx + 1, sTop + 2, sw - 2, 1, mix(sc, '#ffffff', 0.08));
    for (let i = 1; i < 4; i++) rect(g, sx + Math.round((sw / 4) * i), sTop + 4, 1, seatY - sTop - 6, sd);
    rect(g, sx - 2, seatY, sw + 4, floorY - legH - seatY, sd); rect(g, sx - 2, seatY, sw + 4, 1, sl);
    const cw = Math.round((sw - 8) / 3);
    for (let i = 0; i < 3; i++) { const cx = sx + 4 + i * (cw + 1); rect(g, cx, seatY - 6, cw - 1, 7, sc); rect(g, cx, seatY - 6, cw - 1, 1, sl); rect(g, cx, seatY, cw - 1, 1, sdd); }
    for (const [ax, dir] of [[sx - 12, -1], [sx + sw, 1]] as [number, number][]) {
      rect(g, ax, seatY - 16, 12, floorY - legH - seatY + 16, sd); rect(g, ax, seatY - 16, 12, 2, sl);
      rect(g, ax + (dir < 0 ? 11 : 0), seatY - 14, 1, floorY - legH - seatY + 14, sdd);
    }
    rect(g, sx - 12, floorY - legH - 1, sw + 24, 1, sdd);
    // A yellow cushion — the colour a cat sees best — and a folded throw.
    rect(g, sx + 6, seatY - 17, 18, 12, '#f2c14e'); rect(g, sx + 6, seatY - 17, 18, 1, '#f9dd8a'); rect(g, sx + 6, seatY - 6, 18, 1, '#c2912a');
    px(g, sx + 15, seatY - 11, '#c2912a');
    rect(g, sx + sw - 34, seatY - 7, 26, 5, '#e86a6a'); for (let i = 0; i < 26; i += 3) px(g, sx + sw - 34 + i, seatY - 5, '#ffd0d0');

    // A side table with a lamp.
    const stx = sx + sw + 18;
    let lampLight: Light | null = null;
    if (stx + 30 < wx - 4 || stx + 30 < W * 0.56) {
      const sty = floorY - 26;
      rect(g, stx, sty, 26, 3, '#8a5a36'); rect(g, stx, sty, 26, 1, '#b07a4c');
      rect(g, stx + 2, sty + 3, 2, floorY - sty - 3, '#6f4528'); rect(g, stx + 22, sty + 3, 2, floorY - sty - 3, '#6f4528');
      rect(g, stx + 11, sty - 10, 4, 10, '#e9e1d2'); oval(g, stx + 13, sty - 1, 5, 1.5, '#c9bfae');
      for (let y = 0; y < 9; y++) { const hw = 4 + Math.round(y * 0.7); rect(g, stx + 13 - hw, sty - 19 + y, hw * 2, 1, y === 0 ? '#fff4d0' : '#f0d49a'); }
      lampLight = { x: stx + 13, y: sty - 12, r: 70, c: '#ffcf85', flicker: 0.03 };
    }
    // A floor lamp by the window.
    const flx = Math.round(W * 0.91);
    let floorLight: Light | null = null;
    if (W > 330) {
      const ly = Math.round(H * 0.12);
      rect(g, flx - 1, ly + 14, 2, floorY - ly - 14, '#3a3030'); rect(g, flx - 6, floorY - 2, 12, 2, '#3a3030'); rect(g, flx - 5, floorY - 3, 10, 1, '#5a4a4a');
      for (let y = 0; y < 14; y++) { const hw = 4 + y * 0.5; rect(g, flx - hw, ly + y, hw * 2, 1, y < 1 ? '#fff0c0' : y === 13 ? '#c9a86a' : '#f0d49a'); }
      floorLight = { x: flx, y: ly + 14, r: 90, c: '#ffcf85', flicker: 0.04 };
    }
    // The rug.
    const rx = Math.round(W * 0.26), rw = Math.round(W * 0.5), ry = Math.round(floorY + (H - floorY) * 0.34), rh = Math.round((H - floorY) * 0.46);
    rect(g, rx, ry, rw, rh, '#2f5f9e');
    rect(g, rx + 3, ry + 3, rw - 6, rh - 6, '#e8b04a');
    rect(g, rx + 6, ry + 6, rw - 12, rh - 12, '#2f5f9e');
    for (let x = rx + 12, i = 0; x < rx + rw - 14; x += 12, i++) {
      const my = ry + Math.round(rh / 2);
      const c = i % 2 ? '#e8b04a' : '#f4e6c8';
      rect(g, x + 2, my - 2, 1, 1, c); rect(g, x + 1, my - 1, 3, 1, c); rect(g, x, my, 5, 1, c); rect(g, x + 1, my + 1, 3, 1, c); rect(g, x + 2, my + 2, 1, 1, c);
    }
    for (let x = rx; x < rx + rw; x += 3) { px(g, x, ry - 1, '#e8b04a'); px(g, x + 1, ry + rh, '#e8b04a'); }

    const holes: Hole[] = [
      { x: Math.round(sx + sw * 0.28), y: floorY - 1, w: 28, h: legH - 1, kind: 'slot' },
      { x: Math.round(sx + sw * 0.72), y: floorY - 1, w: 28, h: legH - 1, kind: 'slot' },
    ];
    const props: Prop[] = [];
    if (W > 300) props.push(prop(plantSprite('monstera'), Math.round(W * 0.8), Math.round(floorY + (H - floorY) * 0.42), 26));
    props.push(prop(basketSprite(), Math.round(W * 0.12), H - 8, 32));
    if (W > 360) props.push(prop(paperBagSprite(), Math.round(W * 0.62), Math.round(floorY + (H - floorY) * 0.78), 36));
    const lights: Light[] = [{ x: wx + ww / 2, y: wy + wh / 2, r: 52, c: tod === 'night' ? '#6b7fc0' : '#fff2c0', a: tod === 'night' ? 1 : 0.5 }];
    if (lampLight) lights.push(lampLight);
    if (floorLight) lights.push(floorLight);
    return {
      indoor: true,
      floor: floorY + 12,
      floorBand: [floorY + 3, H - 6],
      holes,
      props,
      wall: [0, floorY],
      lights,
      drawBack(gg, t) {
        gg.drawImage(cv, 0, 0);
        curtain(gg, wx - 11, wy - 5, 15, wh + 12, '#e9c46a', t, -1);
        curtain(gg, wx + ww - 4, wy - 5, 15, wh + 12, '#e9c46a', t + 0.7, 1);
      },
    };
  },
};

export const attic: LocationDef = {
  id: 'attic',
  name: { uk: 'Горище', en: 'Attic' },
  indoor: true,
  weathers: ['clear', 'motes'],
  build(W, H, tod, rng): LocationInstance {
    const floorY = Math.round(H * 0.69);
    const [cv, g] = layer(W, H);
    planks(g, rng, 0, 0, W, floorY, '#6d4f3a', 10);
    // Rafters slanting down both sides, and the ridge beam.
    for (let i = 0; i < 6; i++) {
      const x = W * (i / 5);
      for (let y = 0; y < floorY; y++) {
        const off = (y / floorY) * (i < 3 ? -30 : 30);
        rect(g, x + off - 4, y, 8, 1, '#4a3526');
        px(g, x + off - 4, y, '#6f5540'); px(g, x + off + 3, y, '#33241a');
      }
    }
    rect(g, 0, 0, W, 10, '#3b2a1f'); rect(g, 0, 10, W, 1, '#5a4331');
    // The round window.
    const cx = Math.round(W * 0.5), cy = Math.round(H * 0.23), r = Math.round(H * 0.11);
    const [sc, sg] = layer(r * 2, r * 2);
    bands(sg, 0, 0, r * 2, r * 2, SKY[tod], 3);
    if (tod === 'night') { oval(sg, r * 1.35, r * 0.55, 3, 3, '#f4f1d8'); for (let i = 0; i < 16; i++) px(sg, rng.int(0, r * 2), rng.int(0, r * 2), '#c9d6ff'); }
    else for (let x = 0; x < r * 2; x++) rect(sg, x, r * 1.45 + Math.sin(x * 0.2) * 2, 1, r, tod === 'day' ? '#7fb870' : '#4c3f5e');
    for (let y = -r; y < r; y++) { const hw = Math.sqrt(Math.max(0, r * r - y * y)); g.drawImage(sc, r - hw, y + r, hw * 2, 1, cx - hw, cy + y, hw * 2, 1); }
    for (let a = 0; a < Math.PI * 2; a += 0.03) rect(g, cx + Math.cos(a) * (r + 1) - 1, cy + Math.sin(a) * (r + 1) - 1, 3, 3, '#3b2a1f');
    for (let a = 0; a < Math.PI; a += 0.05) px(g, cx + Math.cos(a + Math.PI) * (r + 2), cy + Math.sin(a + Math.PI) * (r + 2), '#8a6a50');
    rect(g, cx - 1, cy - r, 2, r * 2, '#3b2a1f'); rect(g, cx - r, cy - 1, r * 2, 2, '#3b2a1f');
    px(g, cx - r + 5, cy - 5, '#ffffff'); px(g, cx - r + 6, cy - 6, '#ffffff');
    planks(g, rng, 0, floorY, W, H - floorY, '#8a6546', 8);
    speckle(g, rng, 0, floorY, W, H - floorY, '#a8845f', 0.02);
    g.globalAlpha = 0.25; rect(g, 0, floorY, W, 3, '#000000'); g.globalAlpha = 1;
    // A bare bulb on a cord.
    const bx = Math.round(W * 0.28), by = Math.round(H * 0.3);
    rect(g, bx, 10, 1, by - 10, '#241a14'); rect(g, bx - 2, by, 5, 3, '#6a6a6a'); oval(g, bx, by + 6, 3, 3.5, tod === 'day' ? '#f4ecd0' : '#fff6c8');
    // Boxes stacked against the wall, an old trunk, a rolled rug.
    const stacks: [number, number, number, number][] = [[W * 0.03, 0, 44, 34], [W * 0.03 + 6, 34, 32, 24], [W * 0.74, 0, 48, 30], [W * 0.74 + 50, 0, 32, 22], [W * 0.74 + 8, 30, 30, 20]];
    for (const [x, up, w, h] of stacks) { if (x + w > W - 2) continue; g.drawImage(boxSprite(w, h), Math.round(x), Math.round(floorY - up - h - 1)); }
    const tx = Math.round(W * 0.34), tw = 52, th = 24;
    rect(g, tx, floorY - th, tw, th, '#6b3b2a'); rect(g, tx, floorY - th, tw, 3, '#8a4b35'); rect(g, tx - 1, floorY - th - 2, tw + 2, 3, '#7a4430');
    rect(g, tx, floorY - th + 8, tw, 2, '#c9a64a'); rect(g, tx + tw / 2 - 3, floorY - th + 6, 6, 7, '#e0bd57'); px(g, tx + tw / 2, floorY - th + 9, '#3b2a1f');
    rect(g, tx + 4, floorY - th, 3, th, '#5a3122'); rect(g, tx + tw - 7, floorY - th, 3, th, '#5a3122');
    // Cobwebs in the corners.
    for (const [x0, dir] of [[0, 1], [W - 1, -1]] as [number, number][]) {
      for (let i = 0; i < 5; i++) { const a = (i / 4) * (Math.PI / 2); for (let rr = 0; rr < 28; rr++) if (rr % 2) px(g, x0 + dir * Math.cos(a) * rr, 11 + Math.sin(a) * rr, '#bfb7a8'); }
      for (const rr of [8, 15, 22]) for (let a = 0; a < Math.PI / 2; a += 0.12) px(g, x0 + dir * Math.cos(a) * rr, 11 + Math.sin(a) * rr, '#a39b8c');
    }
    const holes: Hole[] = [];
    for (const hx of [W * 0.2, W * 0.58, W * 0.68]) holes.push({ x: Math.round(hx), y: floorY - 1, w: 13, h: 11, kind: 'arch' });
    for (const h of holes) drawHole(g, h, '#6d4f3a');
    const props: Prop[] = [prop(boxSprite(40, 24, true), Math.round(W * 0.5), Math.round(floorY + (H - floorY) * 0.7), 40)];
    let ghost: { x: number; y: number; t: number; dir: number } | null = null;
    let ghostWait = rng.range(20, 60);
    if (W > 320) props.push(prop(bootsSprite(), Math.round(W * 0.86), Math.round(floorY + (H - floorY) * 0.4), 26));
    return {
      indoor: true,
      floor: floorY + 10,
      floorBand: [floorY + 3, H - 6],
      holes,
      props,
      wall: [0, floorY],
      lights: [{ x: cx, y: cy, r: 70, c: tod === 'night' ? '#7d90d0' : '#ffe9b0' }, { x: bx, y: by + 6, r: 80, c: '#ffd89a', flicker: 0.05 }],
      update(dt) {
        // Now and then, at night, a small ghost drifts across the attic. It means no harm.
        if (tod !== 'night') return;
        ghostWait -= dt;
        if (!ghost && ghostWait <= 0) ghost = { x: -12, y: H * rng.range(0.25, 0.5), t: 0, dir: 1 };
        if (ghost) { ghost.t += dt; ghost.x += 14 * dt; if (ghost.x > W + 14) { ghost = null; ghostWait = rng.range(70, 160); } }
      },
      drawGlow(gg) {
        if (!ghost) return;
        const X = Math.round(ghost.x), Y = Math.round(ghost.y + Math.sin(ghost.t * 2) * 4);
        gg.globalAlpha = 0.75;
        gg.fillStyle = '#eef4ff';
        for (let yy = 0; yy < 12; yy++) { const hw = yy < 5 ? Math.round(Math.sqrt(25 - (5 - yy) ** 2)) : 5; gg.fillRect(X - hw, Y + yy, hw * 2, 1); }
        for (let i = 0; i < 4; i++) if ((i + Math.floor(ghost.t * 4)) % 2) gg.fillRect(X - 5 + i * 3, Y + 12, 2, 1);
        gg.fillStyle = '#2a2436';
        gg.fillRect(X - 2, Y + 4, 1, 2); gg.fillRect(X + 1, Y + 4, 1, 2); gg.fillRect(X - 1, Y + 7, 2, 1);
        gg.globalAlpha = 1;
      },
      drawBack(gg) {
        gg.drawImage(cv, 0, 0);
        // A beam of light from the round window, with dust hanging in it.
        if (tod !== 'night') {
          gg.globalAlpha = tod === 'day' ? 0.13 : 0.1;
          for (let y = cy; y < H; y++) { const k = (y - cy) / (H - cy); rect(gg, cx - r + k * 40, y, r * 2 + k * 30, 1, tod === 'day' ? '#fff2c0' : '#ffc890'); }
          gg.globalAlpha = 1;
        }
      },
    };
  },
};
