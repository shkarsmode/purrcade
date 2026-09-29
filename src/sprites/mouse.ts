/**
 * The mouse, side on, facing right: a pear of a body, a pointed head with one round ear, a long
 * bare tail. It runs in four frames — reach, float, gather, float — the gait that makes a mouse
 * read as a mouse at twenty pixels long; it sits and sniffs, stands up on its hind legs to look
 * round, hunches over a crumb, and when a paw gets it, lies on its back with its feet in the air.
 */
import { Pix, sprite, solidPal } from '../core/pix';
import { BASE, O, U, E, G } from './common';

export type MouseCoat = 'brown' | 'grey' | 'white' | 'gold' | 'tin';
export type MousePose = 'run' | 'sit' | 'rear' | 'eat' | 'daze';

//                       body       light      dark       belly      pink       tail
const COATS: Record<MouseCoat, string[]> = {
  brown: ['#a88a70', '#c8ab8f', '#7a5f4e', '#ecdcc6', '#ef98a4', '#c98f98'],
  grey: ['#9e9dab', '#c0bfcb', '#6f6e7e', '#e8e7f0', '#ef98a4', '#c98f98'],
  white: ['#ece6dc', '#ffffff', '#b9afa2', '#ffffff', '#f5a3ae', '#e7aab3'],
  gold: ['#f2bd45', '#ffe08a', '#b98424', '#fff2bd', '#ff9aa6', '#e2a15e'],
  tin: ['#aab4c2', '#e4ecf4', '#6e7888', '#cfd8e2', '#e89aa4', '#8a94a4'],
};
const B = 5, L = 6, D = 7, BE = 8, PK = 9, TL = 10, WH = 11, CR = 12;

function palette(c: MouseCoat): string[] {
  return [...BASE, ...COATS[c], '#b8adb8', '#f4c95d'];
}

export const MOUSE_W = 27, MOUSE_H = 19;
/** Where the feet stand, in the sprite. */
export const MOUSE_AX = 12, MOUSE_AY = 18;

type Leg = [number, number, number, number];
interface Frame { bx: number; by: number; rx: number; ry: number; brot: number; hx: number; hy: number; hrot: number; legs: Leg[]; tail: number; tailUp: number }

const RUN: Frame[] = [
  { bx: 11, by: 13.4, rx: 7.3, ry: 3.4, brot: 0, hx: 17.8, hy: 12.4, hrot: 0.2, legs: [[7, 15, 4.5, 17.6], [16, 15, 18, 17.6]], tail: 0, tailUp: 0 },
  { bx: 11, by: 12.4, rx: 6.7, ry: 3.8, brot: -0.05, hx: 17.4, hy: 11.2, hrot: 0.1, legs: [[7.6, 15, 8.6, 16.4], [15.4, 15, 16.4, 16.4]], tail: 1.6, tailUp: 1 },
  { bx: 11, by: 13.6, rx: 6.2, ry: 4.0, brot: 0.04, hx: 17, hy: 12.8, hrot: 0.3, legs: [[8.8, 15.4, 10.4, 17.6], [14.2, 15.4, 12.8, 17.6]], tail: 3.2, tailUp: 0 },
  { bx: 11, by: 12.8, rx: 6.9, ry: 3.6, brot: 0, hx: 17.6, hy: 11.8, hrot: 0.15, legs: [[8, 15, 7.6, 16.6], [15, 15, 15.4, 16.6]], tail: 4.8, tailUp: 1 },
];

function body(p: Pix, f: Frame) {
  p.ellipse(f.bx, f.by, f.rx, f.ry, (_x, _y, _u, v) => (v > 0.42 ? BE : B), f.brot);
}

function head(p: Pix, hx: number, hy: number, rot: number, eye = true) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const at = (dx: number, dy: number): [number, number] => [hx + dx * c - dy * s, hy + dx * s + dy * c];
  // The ear first, behind the head's outline.
  const [ex, ey] = at(-1.8, -3.6);
  p.disc(ex, ey, 2.5, B);
  p.disc(ex + 0.3, ey + 0.3, 1.2, PK);
  p.ellipse(hx, hy, 3.8, 3.1, (_x, _y, _u, v) => (v > 0.5 ? BE : B), rot);
  p.tri(at(1.2, -2.3), at(1.2, 2.6), at(6.3, 1.1), (_x, _y) => B);
  const [nx, ny] = at(5.9, 0.9);
  p.set(nx, ny, PK);
  if (eye) {
    const [ix, iy] = at(1.7, -0.9);
    p.set(ix, iy, E); p.set(ix, iy + 1, E); p.set(ix - 1, iy, G);
  }
}

function tail(p: Pix, x0: number, y0: number, phase: number, up: number) {
  let py = y0;
  for (let i = 0; i < 12; i++) {
    const y = y0 + Math.sin(i * 0.42 + phase) * 1.3 - i * 0.14 * (up ? 1.4 : 0.6) + (i > 7 ? (i - 7) * 0.3 : 0);
    const X = Math.round(x0 - i), Y = Math.round(y);
    p.set(X, Y, TL);
    if (Math.abs(Y - py) > 1) p.set(X, Math.round((Y + py) / 2), TL);
    py = Y;
  }
}

function whiskers(p: Pix, hx: number, hy: number, rot: number) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const at = (dx: number, dy: number): [number, number] => [hx + dx * c - dy * s, hy + dx * s + dy * c];
  for (const [dx, dy] of [[7.2, 0], [8.2, -0.6], [7.2, 2], [8.2, 2.6]]) { const [x, y] = at(dx, dy); if (!p.get(x, y)) p.set(x, y, WH); }
}

function legs(p: Pix, list: Leg[]) {
  for (const [x0, y0, x1, y1] of list) {
    p.capsule([x0, y0], [x1, y1], 0.95, D);
    p.set(x1 + 0.6, y1 - 0.2, PK); p.set(x1 - 0.4, y1 - 0.2, PK);
  }
}

function finish(p: Pix) {
  p.rim([[B, L, D], [BE, 0, 0]]);
  p.outline(O, U);
}

function draw(p: Pix, pose: MousePose, f: number, crumb: boolean) {
  if (pose === 'run') {
    const fr = RUN[f & 3];
    legs(p, fr.legs);
    body(p, fr);
    head(p, fr.hx, fr.hy, fr.hrot);
    if (crumb) { const x = fr.hx + 6, y = fr.hy + 2.5; p.rect(x, y, x + 1, y + 1, CR); }
    finish(p);
    tail(p, fr.bx - fr.rx + 0.5, fr.by + 0.6, fr.tail, fr.tailUp);
    whiskers(p, fr.hx, fr.hy, fr.hrot);
    if (crumb) { const x = fr.hx + 6, y = fr.hy + 2.5; p.set(x, y, CR); p.set(x + 1, y, CR); p.set(x, y + 1, CR); p.set(x + 1, y + 1, CR); }
    return;
  }
  if (pose === 'sit') {
    const up = f & 1 ? 0.8 : -0.5;
    const fr: Frame = { bx: 10.6, by: 13.6, rx: 6.8, ry: 3.9, brot: -0.06, hx: 17, hy: 12 + up, hrot: f & 1 ? 0.25 : -0.05, legs: [[7, 16, 7.4, 17.6], [15.2, 15.6, 15.6, 17.6]], tail: 0.6, tailUp: 0 };
    legs(p, fr.legs);
    body(p, fr);
    head(p, fr.hx, fr.hy, fr.hrot);
    finish(p);
    tail(p, fr.bx - fr.rx + 0.5, fr.by + 1.6, f * 0.9, 0);
    whiskers(p, fr.hx, fr.hy, fr.hrot);
    return;
  }
  if (pose === 'rear') {
    // Up on the hind legs, front paws tucked to the chest, nose in the air.
    legs(p, [[9.4, 16, 9, 17.6], [11.6, 16, 12.4, 17.6]]);
    p.ellipse(10.8, 11.6, 3.9, 5.6, (_x, _y, u) => (u > 0.35 ? BE : B), -0.22);
    head(p, 13.2, 5.6 + (f & 1 ? 0.5 : 0), -0.75 + (f & 1 ? 0.2 : 0));
    p.disc(14.2, 10.2, 1.1, PK);
    finish(p);
    tail(p, 8, 16.2, f * 0.8, 0);
    whiskers(p, 13.2, 5.6 + (f & 1 ? 0.5 : 0), -0.75 + (f & 1 ? 0.2 : 0));
    return;
  }
  if (pose === 'eat') {
    // Hunched over a crumb held in the front paws, the head nodding as it nibbles.
    const d = f & 1 ? 0.7 : 0;
    legs(p, [[7, 16, 7, 17.6]]);
    p.ellipse(10.6, 13, 6.2, 4.6, (_x, _y, _u, v) => (v > 0.5 ? BE : B), -0.1);
    head(p, 16, 12.6 + d, 0.55 + d * 0.3);
    p.disc(18.2, 16.2, 1.1, PK);
    p.rect(19, 15.2 + d, 20, 16.2 + d, CR);
    finish(p);
    tail(p, 4.6, 15.4, 1.2, 0);
    return;
  }
  // 'daze': on its back, feet up, eyes crossed.
  const w = f & 1 ? 0.6 : -0.6;
  for (const [x0, x1] of [[9, 8 + w], [15, 16 - w]]) p.capsule([x0, 11.6], [x1, 8.6], 0.95, D);
  p.ellipse(12, 14, 7, 3.4, (_x, _y, _u, v) => (v < -0.2 ? BE : B), 0);
  p.ellipse(18.4, 14.4, 3.6, 3, B, -0.3);
  p.disc(17.4, 17.4, 2.2, B);
  p.rim([[B, L, D], [BE, 0, 0]]);
  p.outline(O, U);
  // X eyes.
  p.set(18.6, 13.2, E); p.set(20.6, 13.2, E); p.set(19.6, 14.2, E); p.set(18.6, 15.2, E); p.set(20.6, 15.2, E);
  tail(p, 4.8, 14.6, f, 0);
}

export function mouseSprite(coat: MouseCoat, pose: MousePose, f = 0, crumb = false): HTMLCanvasElement {
  const n = pose === 'run' ? f & 3 : f & 1;
  return sprite('mouse:' + coat + pose + n + (crumb ? 'c' : ''), MOUSE_W, MOUSE_H, (p) => draw(p, pose, n, crumb), palette(coat));
}

/** The same mouse as one flat colour — for when it stands in the dark of its hole. */
export function mouseShadow(coat: MouseCoat, pose: MousePose, f = 0, crumb = false, c = '#120c10'): HTMLCanvasElement {
  const n = pose === 'run' ? f & 3 : f & 1;
  return sprite('mouse-sil:' + c + coat + pose + n + (crumb ? 'c' : ''), MOUSE_W, MOUSE_H, (p) => draw(p, pose, n, crumb), solidPal(palette(coat), c));
}

/** A wedge of cheese with its holes; `left` is how much is left, 1…0. */
export function cheeseSprite(left: number): HTMLCanvasElement {
  const k = Math.max(1, Math.min(4, Math.ceil(left * 4)));
  return sprite('cheese' + k, 16, 12, (p) => {
    const w = 3 + k * 3;
    p.tri([1, 10], [1 + w, 10], [1 + w, 3 + (4 - k) * 0.6], 5);
    p.rect(1, 10, 1 + w, 10.9, 5);
    p.rect(1 + w - 1, 3 + (4 - k) * 0.6, 1 + w, 10, 7);
    if (k > 1) { p.set(w - 1, 8, 8); p.set(w - 2, 8, 8); }
    if (k > 2) { p.set(w - 5, 9, 8); p.set(4, 9, 8); }
    if (k > 3) { p.set(w - 3, 6, 8); }
    p.rim([[5, 6, 7]]);
    p.outline(O, U);
  }, [...BASE, '#f5c842', '#ffe68a', '#d49a24', '#c98a1c']);
}
