/**
 * Everything a person can set, kept in the browser. Loaded over the defaults, so a setting added
 * in a later version simply appears with its default value; saved whenever anything changes.
 */
import type { Lang, TimeOfDay } from '../game/types';

export type WorldSize = 'auto' | 'big' | 'medium' | 'small';
export type TodMode = 'real' | 'cycle' | TimeOfDay;
export type WeatherMode = 'auto' | 'off' | 'often';
export type Palette = 'normal' | 'cat' | 'contrast';

export interface Settings {
  v: number;
  lang: Lang;
  catName: string;
  /** Scenes and places switched off (everything is on unless listed). */
  offScenes: string[];
  offLocations: string[];
  favorites: string[];
  /** Minutes per scene in the marathon. */
  segment: number;
  /** Put a calm scene between busy ones. */
  calm: boolean;
  intensity: number;
  density: number;
  speed: number;
  reach: number;
  worldSize: WorldSize;
  palette: Palette;
  brightness: number;
  tod: TodMode;
  weather: WeatherMode;
  sound: boolean;
  volume: number;
  soundCritters: boolean;
  soundWater: boolean;
  soundToys: boolean;
  soundAmbient: boolean;
  /** Minutes before the rest screen; 0 plays on and on. */
  timer: number;
  hudName: boolean;
  hudTitle: boolean;
  hudClock: boolean;
  wakeLock: boolean;
  fullscreen: boolean;
}

export const DEFAULTS: Settings = {
  v: 1,
  lang: 'uk',
  catName: 'Джені',
  offScenes: [],
  offLocations: [],
  favorites: [],
  segment: 3,
  calm: true,
  intensity: 0.6,
  density: 1,
  speed: 1,
  reach: 1,
  worldSize: 'auto',
  palette: 'normal',
  brightness: 1,
  tod: 'real',
  weather: 'auto',
  sound: false,
  volume: 0.5,
  soundCritters: true,
  soundWater: true,
  soundToys: true,
  soundAmbient: true,
  timer: 0,
  hudName: true,
  hudTitle: true,
  hudClock: false,
  wakeLock: true,
  fullscreen: true,
};

const KEY = 'purrcade:settings';

export interface Store {
  get(k: string): string | null;
  set(k: string, v: string): void;
}

export const browserStore: Store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: settings last the visit */ } },
};

/** Read settings over the defaults, dropping anything of the wrong type. */
export function loadSettings(store: Store = browserStore, lang?: string): Settings {
  const s: Settings = { ...DEFAULTS, offScenes: [], offLocations: [], favorites: [] };
  void lang;           // Ukrainian first, for everyone; one tap on the title screen switches.
  let raw: Record<string, unknown> = {};
  try { raw = JSON.parse(store.get(KEY) || '{}'); } catch { raw = {}; }
  for (const k of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const v = raw[k];
    if (v === undefined) continue;
    const d = DEFAULTS[k];
    if (Array.isArray(d) ? Array.isArray(v) && v.every((x) => typeof x === 'string') : typeof v === typeof d) {
      (s as unknown as Record<string, unknown>)[k] = v;
    }
  }
  s.segment = clampNum(s.segment, 1, 15);
  s.intensity = clampNum(s.intensity, 0, 1);
  s.density = clampNum(s.density, 0.5, 1.8);
  s.speed = clampNum(s.speed, 0.5, 1.8);
  s.reach = clampNum(s.reach, 0.6, 1.8);
  s.brightness = clampNum(s.brightness, 0.6, 1.2);
  s.volume = clampNum(s.volume, 0, 1);
  s.timer = clampNum(s.timer, 0, 240);
  s.catName = String(s.catName).slice(0, 24);
  return s;
}

export function saveSettings(s: Settings, store: Store = browserStore) {
  store.set(KEY, JSON.stringify(s));
}

function clampNum(v: number, a: number, b: number) {
  return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : a;
}

/** World height in pixels for a setting and a screen. */
export function worldHeight(size: WorldSize, coarse: boolean): number {
  switch (size) {
    case 'big': return 180;
    case 'medium': return 216;
    case 'small': return 270;
    default: return coarse ? 200 : 260;
  }
}
