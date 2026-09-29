/**
 * The arcade: a synthwave night — a striped sun sinking behind neon mountains, a grid floor
 * rushing toward the viewer, stars — and in front of it the glowing board where the games play.
 */
import { layer } from '../core/screen';
import { col, mix } from '../core/color';
import type { LocationDef, LocationInstance } from '../game/types';
import { bands, px, rect } from '../game/art';

export interface Arcade extends LocationInstance { board: { x: number; y: number; w: number; h: number } }

export const arcade: LocationDef = {
  id: 'arcade',
  name: { uk: 'Аркада', en: 'Arcade' },
  indoor: true,
  weathers: ['clear'],
  build(W, H, _tod, rng): Arcade {
    const hor = Math.round(H * 0.56);
    const [cv, g] = layer(W, H);
    bands(g, 0, 0, W, hor, ['#0c0620', '#2a0c4a', '#6a1a6a', '#c8306a', '#ff7a4a'], 5);
    for (let i = 0; i < (W * hor) / 120; i++) px(g, rng.int(0, W), rng.int(0, hor * 0.55), rng.chance(0.3) ? '#ffffff' : '#9a8ad8');
    // The sun: a disc of warm bands, cut by widening stripes toward the bottom.
    const sx = W / 2, sy = hor - 4, R = Math.round(H * 0.2);
    for (let y = -R; y <= 0; y++) {
      const k = (y + R) / R;
      const cut = k > 0.45 && Math.floor((k - 0.45) * 22) % 3 === 2;
      if (cut) continue;
      const hw = Math.round(Math.sqrt(R * R - y * y));
      rect(g, sx - hw, sy + y, hw * 2, 1, mix('#fff07a', '#ff3a8a', k));
    }
    // Mountains with a neon rim.
    const ridge = (base: number, amp: number, fill: string, edge: string, seed: number) => {
      for (let x = 0; x < W; x++) {
        const hgt = Math.abs(Math.sin(x * 0.018 + seed)) * amp + Math.abs(Math.sin(x * 0.047 + seed * 2)) * amp * 0.4;
        const top = Math.round(base - hgt);
        rect(g, x, top, 1, hor - top, fill);
        px(g, x, top, edge);
      }
    };
    ridge(hor, H * 0.12, '#1a0a30', '#ff4ad8', 1.3);
    ridge(hor, H * 0.07, '#12061f', '#4ae8ff', 4.2);
    rect(g, 0, hor, W, H - hor, '#0a0418');
    const board = { x: Math.round(W * 0.08), y: Math.round(H * 0.07), w: Math.round(W * 0.84), h: Math.round(H * 0.86) };
    return {
      indoor: true,
      floor: H - 4,
      board,
      drawBack(gg, t) {
        gg.drawImage(cv, 0, 0);
        // The grid floor: lines racing toward us, rays running to the sun.
        gg.fillStyle = col('#ff4ad8');
        const ph = (t * 0.6) % 1;
        for (let i = 0; i < 14; i++) {
          const z = (i + ph) / 14;
          const y = Math.round(hor + Math.pow(z, 2.2) * (H - hor));
          gg.globalAlpha = 0.25 + z * 0.6;
          gg.fillRect(0, y, W, 1);
        }
        gg.globalAlpha = 0.45;
        gg.fillStyle = col('#4ae8ff');
        for (let i = -12; i <= 12; i++) {
          const x1 = W / 2 + i * W * 0.09;
          for (let y = hor; y < H; y += 1) {
            const k = (y - hor) / (H - hor);
            gg.fillRect(Math.round(W / 2 + (x1 - W / 2) * k * 1.6), y, 1, 1);
          }
        }
        gg.globalAlpha = 1;
      },
    };
  },
};
