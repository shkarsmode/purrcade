import '@fontsource/pixelify-sans/cyrillic-400.css';
import '@fontsource/pixelify-sans/cyrillic-600.css';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-600.css';
import './styles.css';
import { createScreen } from './core/screen';
import { createLoop } from './core/loop';
import { Sfx } from './core/audio';
import { Stage } from './game/stage';
import { LOCATIONS } from './world';
import { SCENES } from './scenes';
import type { TimeOfDay, Weather } from './game/types';
import { drawSheet } from './debug/sheet';
import { App } from './app/app';

const canvas = document.getElementById('world') as HTMLCanvasElement;
const q = new URLSearchParams(location.search);

if (q.has('sheet')) {
  // Development: every frame of a creature, zoomed.
  const screen = createScreen(canvas, Number(q.get('zoom')) || 100);
  const paint = () => drawSheet(screen.g, screen.W, screen.H, q.get('sheet') || 'mouse', q.get('bg') || undefined);
  paint();
  addEventListener('resize', () => { screen.resize(); paint(); });
} else if (q.has('view')) {
  // Development: one place, one scene, one hour — ?view=kitchen&scene=mice&tod=night&weather=rain
  const screen = createScreen(canvas, Number(q.get('h')) || 270);
  const sfx = new Sfx();
  const loc = LOCATIONS.find((l) => l.id === q.get('view')) || LOCATIONS[0];
  const scene = SCENES.find((s) => s.id === q.get('scene')) || null;
  const stage = new Stage(screen.W, screen.H, sfx, Number(q.get('seed')) || 7);
  stage.setup({ loc, scene, tod: (q.get('tod') as TimeOfDay) || 'day', weather: (q.get('weather') as Weather) || 'clear', seed: Number(q.get('seed')) || 7 });
  const loop = createLoop((dt) => stage.update(dt), () => stage.draw(screen.g));
  loop.speed = Number(q.get('speed')) || 1;
  loop.start();
  addEventListener('resize', () => { if (screen.resize()) stage.resize(screen.W, screen.H); });
  canvas.addEventListener('pointerdown', (e) => { const [x, y] = screen.toWorld(e.clientX, e.clientY); stage.paw(x, y); });
  (window as unknown as { __stage: Stage }).__stage = stage;
} else {
  const app = new App(canvas, document.getElementById('ui')!);
  (window as unknown as { __app: App }).__app = app;
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}
