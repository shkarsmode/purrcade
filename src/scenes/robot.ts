/**
 * Machines on the floor. A robot vacuum does its rounds — straight runs, a bump, a turn, a spiral
 * now and then, a think with its light blinking — hoovering up crumbs and dust as it goes, with a
 * mouse riding on top like a captain, who hops off for a crumb now and then and scrambles back on.
 * A clockwork mouse whirrs across in a straight line, runs down, stops, winds itself up again.
 */
import type { SceneDef, SceneCtx, SceneInstance, Prop } from '../game/types';
import { mouseSprite, MOUSE_AX, MOUSE_AY } from '../sprites/mouse';
import { blit } from '../core/pix';
import { col } from '../core/color';
import { shadow, oval } from '../game/art';
import { clamp } from '../core/rng';
import { depthDraw, dist, type Drawable } from './util';

interface Robot { x: number; y: number; a: number; v: number; mode: 'run' | 'turn' | 'spiral' | 'think' | 'spin'; t: number; turnTo: number; spin: number; blink: number }
interface Rider { on: boolean; x: number; y: number; face: 1 | -1; t: number; st: 'ride' | 'off' | 'back' | 'fright'; anim: number; hop: number; vh: number }
interface Wind { x: number; y: number; a: number; v: number; st: 'go' | 'stop' | 'wind' | 'tip'; t: number; key: number; step: number }
interface Dust { x: number; y: number; big: boolean }

function create(ctx: SceneCtx): SceneInstance {
  const { rng, loc, fx, sfx, opts, W, H } = ctx;
  const band: [number, number] = loc.floorBand || [H * 0.66, H - 6];
  const props: Prop[] = loc.props || [];
  let time = 0;
  const bot: Robot = { x: W * 0.5, y: (band[0] + band[1]) / 2, a: rng.range(0, Math.PI * 2), v: 0, mode: 'run', t: rng.range(2, 4), turnTo: 0, spin: 0, blink: 0 };
  const rider: Rider = { on: true, x: 0, y: 0, face: 1, t: rng.range(6, 12), st: 'ride', anim: 0, hop: 0, vh: 0 };
  const wind: Wind = { x: rng.range(W * 0.1, W * 0.9), y: rng.range(band[0] + 6, band[1] - 4), a: rng.chance(0.5) ? 0 : Math.PI, v: 0, st: 'wind', t: 1, key: 0, step: 0 };
  const dust: Dust[] = [];
  let nextDust = 0;
  const RX = 15, RY = 6;

  const inFloor = (x: number, y: number, m = 4) => x > m && x < W - m && y > band[0] + m && y < band[1] - m / 2;
  const blocked = (x: number, y: number) => props.some((p) => x > p.x0 - 4 && x < p.x1 + 4 && Math.abs(y - p.y) < 8);

  function update(dt: number) {
    time += dt;
    nextDust -= dt;
    if (nextDust <= 0) { nextDust = rng.range(1.2, 3); if (dust.length < 18) dust.push({ x: rng.range(10, W - 10), y: rng.range(band[0] + 4, band[1] - 3), big: rng.chance(0.25) }); }
    stepBot(dt);
    stepRider(dt);
    stepWind(dt);
    // The vacuum eats what it passes over.
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      if (Math.abs(d.x - bot.x) < RX - 2 && Math.abs(d.y - bot.y) < RY) { dust.splice(i, 1); fx.add({ x: d.x, y: d.y - 3, kind: 'spark', c: '#ffffff', max: 0.3, vy: -10 }); }
    }
  }

  function stepBot(dt: number) {
    bot.t -= dt;
    bot.blink += dt;
    const sp = 30 * opts.speed;
    switch (bot.mode) {
      case 'run': {
        bot.v += (sp - bot.v) * dt * 3;
        const nx = bot.x + Math.cos(bot.a) * bot.v * dt, ny = bot.y + Math.sin(bot.a) * bot.v * dt * 0.5;
        if (!inFloor(nx, ny, RX) || blocked(nx, ny)) { bot.mode = 'turn'; bot.turnTo = bot.a + Math.PI * rng.range(0.5, 1.2) * rng.sign(); bot.v = 0; sfx.bounce(); fx.burst(nx + Math.cos(bot.a) * RX, ny, 3, ['#ffffff'], { speed: 20, g: 0, max: 0.3 }); break; }
        bot.x = nx; bot.y = ny;
        if (bot.t <= 0) { const r = rng.next(); if (r < 0.2) { bot.mode = 'spiral'; bot.t = rng.range(4, 7); } else if (r < 0.45) { bot.mode = 'think'; bot.t = rng.range(1, 2.5); } else { bot.mode = 'turn'; bot.turnTo = bot.a + rng.range(-1.5, 1.5); } }
        break;
      }
      case 'turn': {
        let d = bot.turnTo - bot.a;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        bot.a += clamp(d, -2.4 * dt, 2.4 * dt);
        if (Math.abs(d) < 0.05) { bot.mode = 'run'; bot.t = rng.range(2, 6); }
        break;
      }
      case 'spiral': {
        bot.a += dt * (0.8 + (1 - bot.t / 7) * 1.5);
        const nx = bot.x + Math.cos(bot.a) * sp * dt, ny = bot.y + Math.sin(bot.a) * sp * dt * 0.5;
        if (inFloor(nx, ny, RX) && !blocked(nx, ny)) { bot.x = nx; bot.y = ny; } else { bot.mode = 'turn'; bot.turnTo = bot.a + Math.PI; }
        if (bot.t <= 0) { bot.mode = 'run'; bot.t = rng.range(2, 5); }
        break;
      }
      case 'think':
        if (bot.t <= 0) { bot.mode = 'turn'; bot.turnTo = rng.range(0, Math.PI * 2); }
        break;
      case 'spin':
        bot.a += dt * 9;
        if (bot.t <= 0) { bot.mode = 'run'; bot.t = rng.range(1.5, 3); }
        break;
    }
  }

  function stepRider(dt: number) {
    rider.anim += dt;
    if (rider.vh || rider.hop > 0) { rider.hop += rider.vh * dt; rider.vh -= 380 * dt; if (rider.hop <= 0) { rider.hop = 0; rider.vh = 0; } }
    rider.t -= dt;
    if (rider.st === 'ride') {
      rider.x = bot.x; rider.y = bot.y;
      if (rng.chance(dt * 0.6)) rider.face = (-rider.face) as 1 | -1;
      if (rider.t <= 0 && dust.length) {
        // Off for a crumb.
        rider.st = 'off'; rider.t = 6; rider.vh = 60;
        rider.x = bot.x + rng.sign() * RX; rider.y = bot.y + 2;
      }
    } else if (rider.st === 'off' || rider.st === 'fright') {
      const target = rider.st === 'off' && dust.length ? dust.reduce((b, d) => (dist(d.x, d.y, rider.x, rider.y) < dist(b.x, b.y, rider.x, rider.y) ? d : b)) : null;
      const tx = target ? target.x : rider.x, ty = target ? target.y : rider.y;
      const dx = tx - rider.x, dy = ty - rider.y, d = Math.hypot(dx, dy);
      if (d > 2 && rider.hop === 0) { rider.x += (dx / d) * 70 * dt; rider.y += (dy / d) * 70 * dt; rider.face = dx > 0 ? 1 : -1; }
      if (target && d < 3) { dust.splice(dust.indexOf(target), 1); fx.add({ x: rider.x, y: rider.y - 14, kind: 'heart', c: '#ff8fa3', vy: -10, max: 0.8 }); rider.st = 'back'; }
      if (rider.t <= 0) rider.st = 'back';
    } else if (rider.st === 'back') {
      const dx = bot.x - rider.x, dy = bot.y - rider.y, d = Math.hypot(dx, dy);
      rider.face = dx > 0 ? 1 : -1;
      if (d < 6) { rider.st = 'ride'; rider.vh = 70; rider.t = rng.range(8, 16); }
      else { rider.x += (dx / d) * 80 * dt; rider.y += (dy / d) * 80 * dt; }
    }
  }

  function stepWind(dt: number) {
    wind.t -= dt;
    switch (wind.st) {
      case 'wind':
        wind.key += dt * 14;
        if (wind.t <= 0) { wind.st = 'go'; wind.v = 110 * opts.speed; wind.a = rng.chance(0.5) ? rng.range(-0.3, 0.3) : Math.PI + rng.range(-0.3, 0.3); }
        break;
      case 'go': {
        wind.key += dt * wind.v * 0.08;
        wind.v *= Math.exp(-dt * 0.45);
        const nx = wind.x + Math.cos(wind.a) * wind.v * dt, ny = wind.y + Math.sin(wind.a) * wind.v * dt * 0.5;
        if (!inFloor(nx, ny, 8) || blocked(nx, ny)) { wind.a = Math.PI - wind.a + rng.range(-0.4, 0.4); sfx.bounce(); }
        else { wind.x = nx; wind.y = ny; }
        wind.step += wind.v * dt;
        if (wind.v < 8) { wind.st = 'stop'; wind.t = rng.range(1.5, 4); }
        break;
      }
      case 'stop':
        if (wind.t <= 0) { wind.st = 'wind'; wind.t = rng.range(0.6, 1.2); }
        break;
      case 'tip':
        if (wind.t <= 0) { wind.st = 'stop'; wind.t = 1; }
        break;
    }
  }

  function paw(x: number, y: number) {
    if (dist(x, y, bot.x, bot.y - 3) < (RX + 4) * opts.reach) {
      bot.mode = 'spin'; bot.t = 0.9; bot.blink = 0;
      ctx.caught('robot', bot.x, bot.y - 6, '#9fe8ff');
      if (rider.st === 'ride') { rider.st = 'fright'; rider.t = 3; rider.vh = 110; rider.x = bot.x + rng.sign() * (RX + 4); rider.y = bot.y + 3; sfx.squeak(); fx.text(rider.x, rider.y - 22, '!', '#ffe066'); }
    }
    if (rider.st !== 'ride' && dist(x, y, rider.x, rider.y - 6) < 12 * opts.reach) { ctx.caught('mouse', rider.x, rider.y - 6); rider.st = 'back'; rider.vh = 90; }
    if (dist(x, y, wind.x, wind.y - 5) < 13 * opts.reach) { wind.st = 'tip'; wind.t = 1; wind.v = 0; ctx.caught('toy', wind.x, wind.y - 5, '#d8e8ff'); }
  }

  function drawBot(g: CanvasRenderingContext2D) {
    const X = Math.round(bot.x), Y = Math.round(bot.y);
    shadow(g, X, Y + 1, RX * 2 + 2, 5, 0.3);
    // Body: a disc seen at a slant, with a bumper, a lid, the light and the side brush.
    oval(g, X, Y - 2, RX, RY, '#2a2c36');
    oval(g, X, Y - 3, RX, RY, '#4a4e5e');
    oval(g, X, Y - 4, RX - 2, RY - 1.5, '#e8ecf4');
    oval(g, X - 2, Y - 5, RX - 7, RY - 3.5, '#ffffff');
    oval(g, X, Y - 4, 4, 1.5, '#b8c0cc');
    const on = bot.mode === 'think' ? Math.floor(bot.blink * 4) % 2 === 0 : true;
    g.fillStyle = col(on ? (bot.mode === 'spin' ? '#ff5a6a' : '#5affc0') : '#2a6a5a');
    g.fillRect(X - 1, Y - 5, 3, 1);
    const ba = time * 20;
    for (let i = 0; i < 3; i++) { const a = ba + (i * Math.PI * 2) / 3; g.fillStyle = col('#8a8a9a'); g.fillRect(Math.round(X + Math.cos(bot.a) * RX * 0.8 + Math.cos(a) * 3), Math.round(Y + Math.sin(a) * 1.2), 1, 1); }
  }

  function drawWind(g: CanvasRenderingContext2D) {
    const face = Math.cos(wind.a) >= 0 ? 1 : -1;
    shadow(g, wind.x, wind.y, 14, 3, 0.25);
    const tipped = wind.st === 'tip';
    const img = mouseSprite('tin', tipped ? 'daze' : wind.st === 'go' ? 'run' : 'sit', tipped ? 0 : Math.floor(wind.step / 4));
    blit(g, img, wind.x, wind.y, MOUSE_AX, MOUSE_AY, face < 0);
    if (!tipped) {
      // The key on its back, turning.
      const kx = Math.round(wind.x - face * 2), ky = Math.round(wind.y - 13);
      const w = Math.round(Math.abs(Math.cos(wind.key)) * 3);
      g.fillStyle = col('#c9a040'); g.fillRect(kx, ky, 1, 3);
      g.fillStyle = col('#f2c14e'); g.fillRect(kx - w, ky - 2, w * 2 + 1, 2);
    }
  }

  function draw(g: CanvasRenderingContext2D, t: number) {
    const items: Drawable[] = [];
    for (const d of dust) items.push({ y: d.y, draw: () => { g.fillStyle = col(d.big ? '#b8b0c0' : '#9a8a70'); g.fillRect(Math.round(d.x), Math.round(d.y - (d.big ? 2 : 1)), d.big ? 3 : 2, d.big ? 2 : 1); if (d.big) { g.fillStyle = col('#d8d0e0'); g.fillRect(Math.round(d.x), Math.round(d.y - 2), 1, 1); } } });
    items.push({ y: bot.y, draw: () => {
      drawBot(g);
      if (rider.st === 'ride') blit(g, mouseSprite('grey', rider.hop > 0 ? 'run' : Math.sin(rider.anim * 0.7) > 0.8 ? 'rear' : 'sit', Math.floor(rider.anim * 3)), bot.x, bot.y - 5 - rider.hop, MOUSE_AX, MOUSE_AY, rider.face < 0);
    } });
    if (rider.st !== 'ride') items.push({ y: rider.y, draw: () => { shadow(g, rider.x, rider.y, 13, 3, 0.22); blit(g, mouseSprite('grey', 'run', Math.floor(rider.anim * 14)), rider.x, rider.y - rider.hop, MOUSE_AX, MOUSE_AY, rider.face < 0); } });
    items.push({ y: wind.y, draw: () => drawWind(g) });
    depthDraw(g, t, items, props);
  }

  return { update, draw, paw };
}

export const robot: SceneDef = {
  id: 'robot',
  name: { uk: 'Робот-пилосос', en: 'Robot vacuum' },
  about: {
    uk: 'Робот-пилосос їздить по кімнаті й збирає крихти, а на ньому, як капітан, катається мишка. Поруч дзижчить заводна мишка з ключиком.',
    en: 'A robot vacuum does its rounds with a mouse riding on top like a captain, while a clockwork mouse whirrs about with its key turning.',
  },
  energy: 0.5,
  locations: ['livingroom', 'kitchen'],
  kind: 'robot',
  icon: 'robot',
  create,
};
