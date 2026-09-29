/**
 * Every frame of every creature laid out on a board, for judging the art up close:
 * ?sheet=mouse&zoom=90 (zoom is the world height, smaller is bigger).
 */
import { col } from '../core/color';
import { mouseSprite, cheeseSprite, type MouseCoat, type MousePose } from '../sprites/mouse';
import { birdSprite, type Species, type BirdPose } from '../sprites/bird';

type Cell = { img: HTMLCanvasElement; label?: string };
const SHEETS: Record<string, () => Cell[][]> = {
  mouse: () => {
    const rows: Cell[][] = [];
    for (const coat of ['brown', 'grey', 'white', 'gold'] as MouseCoat[]) {
      const row: Cell[] = [];
      for (const [pose, n] of [['run', 4], ['sit', 2], ['rear', 2], ['eat', 2], ['daze', 1]] as [MousePose, number][]) {
        for (let f = 0; f < n; f++) row.push({ img: mouseSprite(coat, pose, f) });
      }
      row.push({ img: mouseSprite(coat, 'run', 0, true) });
      rows.push(row);
    }
    rows.push([1, 0.75, 0.5, 0.25].map((k) => ({ img: cheeseSprite(k) })));
    return rows;
  },
  bird: () => {
    const rows: Cell[][] = [];
    for (const s of ['sparrow', 'bluetit', 'robin', 'bullfinch', 'goldfinch', 'pigeon'] as Species[]) {
      const row: Cell[] = [];
      for (const [pose, n] of [['perch', 2], ['peck', 2], ['hop', 1], ['fly', 4], ['ball', 1], ['walk', 4]] as [BirdPose, number][]) {
        if (pose === 'walk' && s !== 'pigeon') continue;
        for (let f = 0; f < n; f++) row.push({ img: birdSprite(s, pose, f) });
      }
      rows.push(row);
    }
    return rows;
  },
};

export function sheetNames(): string[] {
  return Object.keys(SHEETS);
}

export function drawSheet(g: CanvasRenderingContext2D, W: number, H: number, name: string, bg = '#e9e2cf') {
  g.fillStyle = col(bg);
  g.fillRect(0, 0, W, H);
  const rows = (SHEETS[name] || SHEETS.mouse)();
  let y = 2;
  for (const row of rows) {
    let x = 2, h = 0;
    for (const c of row) {
      g.drawImage(c.img, x, y);
      x += c.img.width + 2;
      h = Math.max(h, c.img.height);
    }
    y += h + 2;
  }
}
