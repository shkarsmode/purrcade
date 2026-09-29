/**
 * The hour of the day, laid over the whole picture: warm at dawn, golden at dusk, deep blue at
 * night with the lamps and the moon and the fireflies left to glow through it. A multiply for
 * the colour of the light, then the lights themselves added back — pools of stepped brightness,
 * so the glow is made of the same squares as the scene.
 *
 * Outdoors the sky is not tinted (its stars would go out): the ground and everything on it is
 * drawn into a buffer, tinted there, and laid over the sky.
 */
import { col } from '../core/color';
import { lightSprite } from './art';
import { layer } from '../core/screen';
import type { Light, TimeOfDay } from './types';

const OUTDOOR: Record<TimeOfDay, string | null> = {
  dawn: '#ffcfc0',
  day: null,
  dusk: '#f2ad8f',
  night: '#4a5690',
};
const INDOOR: Record<TimeOfDay, string | null> = {
  dawn: '#f6dccb',
  day: null,
  dusk: '#f3cdb4',
  night: '#5a4e78',
};

export function tintFor(tod: TimeOfDay, indoor: boolean): string | null {
  return (indoor ? INDOOR : OUTDOOR)[tod];
}

export function tint(g: CanvasRenderingContext2D, W: number, H: number, c: string) {
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = col(c);
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
}

/** A layer that can be tinted without losing its transparent parts. */
export class TintBuffer {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  private mask: HTMLCanvasElement;
  private mg: CanvasRenderingContext2D;
  constructor(public W: number, public H: number) {
    [this.canvas, this.g] = layer(W, H);
    [this.mask, this.mg] = layer(W, H);
  }
  clear() {
    this.g.clearRect(0, 0, this.W, this.H);
  }
  /** Multiply by a colour where something is drawn; leave the rest see-through. */
  tint(c: string) {
    this.mg.clearRect(0, 0, this.W, this.H);
    this.mg.drawImage(this.canvas, 0, 0);
    tint(this.g, this.W, this.H, c);
    this.g.globalCompositeOperation = 'destination-in';
    this.g.drawImage(this.mask, 0, 0);
    this.g.globalCompositeOperation = 'source-over';
  }
}

export function lightsPass(g: CanvasRenderingContext2D, tod: TimeOfDay, indoor: boolean, lights: Light[], t: number, glow = 1) {
  if (!((tod === 'night' || tod === 'dusk' || (indoor && tod !== 'day')) && lights.length)) return;
  g.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const f = l.flicker ? 1 - l.flicker + Math.sin(t * 13 + l.x) * l.flicker * 0.5 + Math.sin(t * 7.3 + l.y) * l.flicker * 0.5 : 1;
    g.globalAlpha = Math.max(0, Math.min(1, (tod === 'night' ? 0.5 : 0.24) * f * glow * (l.a ?? 1)));
    const s = lightSprite(Math.round(l.r), l.c, 0.9);
    g.drawImage(s, Math.round(l.x - l.r), Math.round(l.y - l.r));
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}
