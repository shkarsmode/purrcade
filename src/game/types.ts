import type { Rng } from '../core/rng';
import type { Particles } from '../core/particles';
import type { Sfx } from '../core/audio';

export type Lang = 'uk' | 'en';
export type Text = { uk: string; en: string };
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';
export type Weather = 'clear' | 'rain' | 'snow' | 'leaves' | 'motes' | 'petals';

/** A stretch of something to stand, perch or sit on; `kind` says what else it is good for. */
export interface Ledge { x0: number; x1: number; y: number; kind?: 'food' | 'bath' | 'wire' }
/**
 * A way in and out of hiding: an arch in the skirting board, or the dark slot under a sofa.
 * (x, y) is the middle of its bottom edge; y is also where the wall meets the floor there.
 */
export interface Hole { x: number; y: number; w: number; h: number; kind?: 'arch' | 'slot' }
/**
 * Something standing on the floor that a critter can pass behind — a stool, a pot, a basket.
 * `y` is where it touches the floor: anything standing further back (smaller y) is hidden by it.
 */
export interface Prop { x0: number; x1: number; y: number; top: number; draw(g: CanvasRenderingContext2D, t: number): void }
/** A light in the scene, for the night pass. */
export interface Light { x: number; y: number; r: number; c: string; flicker?: number; a?: number }

export interface LocationInstance {
  /** Where walking things walk. */
  floor: number;
  /** The band walking things may use, top to bottom (a floor seen from above has depth). */
  floorBand?: [number, number];
  holes?: Hole[];
  props?: Prop[];
  perches?: Ledge[];
  /** Somewhere a critter can duck behind: x-extent and the y of its lower edge. */
  cover?: Ledge[];
  water?: [number, number];
  sky?: [number, number];
  /** Wall area for things that climb or shine on walls. */
  wall?: [number, number];
  /** Tree trunks something can climb: middle x, width, top and bottom. */
  trunks?: { x: number; w: number; top: number; bottom: number }[];
  /** Flower heads a butterfly or a bee can land on. */
  blooms?: { x: number; y: number; c: string }[];
  lights?: Light[];
  indoor: boolean;
  update?(dt: number, t: number): void;
  /** Outdoors: the sky alone, which keeps its own colours for the hour — the rest is tinted. */
  drawSky?(g: CanvasRenderingContext2D, t: number): void;
  drawBack(g: CanvasRenderingContext2D, t: number): void;
  drawFront?(g: CanvasRenderingContext2D, t: number): void;
  /** Things in the place that shine by themselves (lit windows), drawn after the hour's tint. */
  drawGlow?(g: CanvasRenderingContext2D, t: number): void;
}

export interface LocationDef {
  id: string;
  name: Text;
  indoor: boolean;
  weathers: Weather[];
  build(W: number, H: number, tod: TimeOfDay, rng: Rng): LocationInstance;
}

export interface SceneOpts {
  /** How many, how fast, how intense: 0.5–1.8, 0.5–1.8, 0–1. */
  density: number;
  speed: number;
  intensity: number;
  /** How close a paw must land to count, as a multiple of the usual reach. */
  reach: number;
}

export interface SceneCtx {
  /** Which location it is playing in. */
  locId: string;
  W: number;
  H: number;
  rng: Rng;
  loc: LocationInstance;
  tod: TimeOfDay;
  fx: Particles;
  sfx: Sfx;
  opts: SceneOpts;
  /** A paw landed on something: count it, celebrate it. */
  caught(kind: string, x: number, y: number, tint?: string): void;
}

export interface SceneInstance {
  update(dt: number, t: number): void;
  draw(g: CanvasRenderingContext2D, t: number): void;
  /** Drawn over the location's foreground (things in the air, over grass). */
  drawTop?(g: CanvasRenderingContext2D, t: number): void;
  paw(x: number, y: number): void;
  /** Drawn after the light of the hour: things that shine by themselves keep their colour. */
  drawGlow?(g: CanvasRenderingContext2D, t: number): void;
  /** Lights the scene itself carries: fireflies, a glowing dot. */
  lights?(): Light[];
}

export interface SceneDef {
  id: string;
  name: Text;
  about: Text;
  /** 0 calm … 1 wild. */
  energy: number;
  locations: string[];
  /** The hours it makes sense at (all, if absent). */
  tods?: TimeOfDay[];
  /** The stats bucket for catches. */
  kind: string;
  /** Emoji-free pictogram id for the gallery. */
  icon: string;
  create(ctx: SceneCtx): SceneInstance;
}
