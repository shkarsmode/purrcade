/**
 * Little pictures for the menus — a mouse for mice, a bird for birds — cut from the same sprites
 * the scenes use, so the gallery and the stats look like the game.
 */
import { mouseSprite } from '../sprites/mouse';
import { birdSprite } from '../sprites/bird';
import { yarnSprite } from '../sprites/toys';
import { butterflySprite, ladybugSprite } from '../sprites/insects';
import { fishSprite, crabSprite } from '../sprites/fish';
import { squirrelSprite } from '../sprites/squirrel';
import { popperSprite, frogSprite } from '../sprites/critters';
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
    case 'fish': return fishSprite('clown', 0);
    case 'bug': return ladybugSprite(0);
    case 'butterfly': return butterflySprite('monarch', 0);
    case 'crab': return crabSprite(0, true);
    case 'squirrel': return squirrelSprite('sit', 0);
    case 'mole': return popperSprite('mole', 'up');
    case 'frog': return frogSprite('sit', 0);
    case 'robot':
      return simple('i-robot', 17, 9, (p) => { p.ellipse(8.5, 5, 8, 3.4, 5); p.ellipse(8.5, 4, 7, 2.6, 6); p.rect(7, 3, 10, 3, 7); p.outline(O, U); }, [...BASE, '#4a4e5e', '#e8ecf4', '#5affc0']);
    case 'feather':
      return simple('i-feather', 13, 13, (p) => { for (let i = 0; i < 11; i++) { const w = Math.round(Math.sin((i / 11) * Math.PI) * 2.6); p.rect(1 + i - w * 0.2, 11 - i - w, 1 + i + w * 0.2, 11 - i + w, i % 3 ? 5 : 6); } p.line(0, 12, 11, 1, 7); }, [...BASE, '#3ad0c0', '#ffffff', '#1a8a80']);
    case 'light':
      return simple('i-light', 11, 11, (p) => { p.disc(5.5, 5.5, 5, 5); p.disc(5.5, 5.5, 3, 6); p.disc(5.5, 5.5, 1.4, 7); }, ['', '', '', '', '', '#fff0b8', '#fff8d8', '#ffffff']);
    case 'arcade':
      return simple('i-arcade', 12, 12, (p) => { p.disc(6, 6, 5.4, 5); for (let y = 0; y < 12; y++) for (let x = 6; x < 12; x++) if (Math.abs(y + 0.5 - 6) < (x - 5.5) * 0.75) p.set(x, y, 0); p.set(6, 3, 3); }, [...BASE, '#ffd23f']);
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
