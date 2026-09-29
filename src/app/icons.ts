/**
 * Little pictures for the menus — a mouse for mice, a bird for birds — cut from the same sprites
 * the scenes use, so the gallery and the stats look like the game.
 */
import { mouseSprite } from '../sprites/mouse';
import { birdSprite } from '../sprites/bird';
import { yarnSprite } from '../sprites/toys';
import { Pix } from '../core/pix';
import { BASE, O, U } from '../sprites/common';

const cache = new Map<string, HTMLCanvasElement>();

function simple(key: string, w: number, h: number, draw: (p: Pix) => void, pal: string[]): HTMLCanvasElement {
  let c = cache.get(key);
  if (c) return c;
  const p = new Pix(w, h);
  draw(p);
  c = p.canvas(pal);
  cache.set(key, c);
  return c;
}

export function kindIcon(kind: string): HTMLCanvasElement {
  switch (kind) {
    case 'mouse': return mouseSprite('grey', 'sit', 0);
    case 'gold': return mouseSprite('gold', 'sit', 0);
    case 'bird': return birdSprite('robin', 'perch', 0);
    case 'toy': return yarnSprite(0, 1);
    case 'laser':
      return simple('i-laser', 9, 9, (p) => { p.disc(4.5, 4.5, 4, 5); p.disc(4.5, 4.5, 2.4, 6); p.set(4, 4, 7); }, ['', '', '', '', '', '#ff5a6a', '#ff2a3a', '#ffffff']);
    case 'fish':
      return simple('i-fish', 16, 10, (p) => { p.ellipse(8, 5, 5, 3, 5); p.tri([3, 5], [0, 2], [0, 8], 5); p.rim([[5, 6, 7]]); p.outline(O, U); p.set(11, 4, 3); }, [...BASE, '#ff8a3d', '#ffc080', '#c85a1a']);
    case 'bug':
      return simple('i-bug', 12, 11, (p) => { p.disc(6, 6, 4.5, 5); p.disc(6, 2.6, 2, 3); p.line(6, 3, 6, 10, 3); p.set(4, 5, 3); p.set(8, 7, 3); p.set(4, 8, 3); p.set(8, 4, 3); p.outline(O, U); }, [...BASE, '#e8433a']);
    case 'butterfly':
      return simple('i-bfly', 13, 11, (p) => { p.ellipse(3.5, 4, 3, 3.5, 5); p.ellipse(9.5, 4, 3, 3.5, 5); p.ellipse(4, 8, 2.2, 2, 6); p.ellipse(9, 8, 2.2, 2, 6); p.rect(6, 2, 6, 9, 3); p.outline(O, U); }, [...BASE, '#5c9ed6', '#f4c430']);
    case 'firefly':
      return simple('i-ff', 9, 9, (p) => { p.disc(4.5, 4.5, 4, 5); p.disc(4.5, 4.5, 2, 6); }, ['', '', '', '', '', '#8aff6a', '#f4ffb0']);
    case 'bubble':
      return simple('i-bub', 11, 11, (p) => { p.disc(5.5, 5.5, 5, 5); p.disc(5.5, 5.5, 4, 0); p.set(3, 3, 6); p.set(4, 2, 6); }, ['', '', '', '', '', '#8fd0ff', '#ffffff']);
    default:
      return simple('i-star', 9, 9, (p) => { p.tri([4.5, 0], [0, 8], [9, 8], 5); p.tri([0, 3], [9, 3], [4.5, 9], 5); }, ['', '', '', '', '', '#ffd23f']);
  }
}

/** A sprite as a data URL, for <img> in the menus. */
export function iconURL(kind: string): string {
  return kindIcon(kind).toDataURL();
}
