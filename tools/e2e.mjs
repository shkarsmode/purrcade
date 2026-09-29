// Real input, not calls: tap Play, paw at the scene, open the menu with Esc, with the mouse
// button, and with a two-second hold in the corner, and check each lands where it should.
import path from 'path';
import { spawn } from 'child_process';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const PORT = 5196, CDP = 9396;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: PORT, strictPort: true } });
await server.listen();
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(root, '.chrome-sweep'), 'about:blank'], { stdio: 'ignore' });
let ver = null;
for (let i = 0; i < 80 && !ver; i++) { try { ver = await (await fetch('http://127.0.0.1:' + CDP + '/json/version')).json(); } catch { await sleep(200); } }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const wait = new Map(); const errs = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 400));
  const p = wait.get(m.id); if (p) { wait.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; wait.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, s); await send('Runtime.enable', {}, s);
const W = 1280, H = 720;
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }, s);
const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }, s)).result.value;
const click = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, s);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, s);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, s);
};
const touch = async (type, x, y) => send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] }, s);
const key = async (k, code, vk) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk }, s);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }, s);
};
const centerOf = (sel, index = 0) => js(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((b) => b.offsetParent)[${index}]; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
let ok = 0, bad = 0;
const check = (name, cond) => { if (cond) { ok++; console.log('ok   ' + name); } else { bad++; console.log('FAIL ' + name); } };

// Twice: the first load may be a Vite dependency reload.
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` }, s); await sleep(2500);
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` }, s); await sleep(2000);
await js('__app.settings.fullscreen = false; __app.stats.reset(); 1');
check('title screen shows', await js(`__app.ui.view === 'home'`));
check('sound is on by default', await js('__app.settings.sound === true'));
// The sound button on the title screen: off, then on again with a chime.
const sb = await centerOf('.sound-switch');
await click(sb[0], sb[1]);
await sleep(200);
check('the title-screen sound button mutes', await js(`__app.settings.sound === false && document.querySelector('.sound-switch').classList.contains('muted')`));
const sb2 = await centerOf('.sound-switch');
const before0 = await js('__app.sfx.played');
await click(sb2[0], sb2[1]);
await sleep(400);
check('and turns it back on with a chime', await js(`__app.settings.sound === true && __app.sfx.played > ${before0}`));
check('the audio is actually running', await js('__app.sfx.running'));
const play = await centerOf('.btn.primary.big');
await click(play[0], play[1]);
await sleep(1500);
check('Play starts the marathon', await js(`__app.mode === 'play' && __app.ui.view === 'none'`));
check('a scene is loaded', await js('!!(__app.seg && __app.stage.scene)'));

for (let i = 0; i < 30; i++) {
  const x = 60 + Math.random() * (W - 200), y = 150 + Math.random() * (H - 200);
  await touch('touchStart', x, y); await touch('touchEnd', x, y);
}
await sleep(300);
check('a flurry of paw taps is fine', await js('__app.mode === "play"'));

await key('Escape', 'Escape', 27);
await sleep(300);
check('Esc opens the menu', await js(`__app.menuOpen && __app.ui.view === 'menu'`));
const resume = await centerOf('.btn.primary.big');
await click(resume[0], resume[1]);
await sleep(300);
check('Resume closes it', await js(`!__app.menuOpen && __app.ui.view === 'none'`));

await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 600, y: 400 }, s);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 640, y: 380 }, s);
await sleep(400);
check('a moving mouse shows the menu button', await js(`document.querySelector('.hud-menu').classList.contains('on')`));
const mb = await centerOf('.hud-menu');
await click(mb[0], mb[1]);
await sleep(300);
check('the menu button opens the menu', await js('__app.menuOpen'));
const resume2 = await centerOf('.btn.primary.big');
await click(resume2[0], resume2[1]);
await sleep(300);

await touch('touchStart', W - 30, 30); await sleep(300); await touch('touchEnd', W - 30, 30);
await sleep(300);
check('a short tap in the corner does not open the menu', await js('!__app.menuOpen'));
await touch('touchStart', W - 30, 30); await sleep(2300);
check('holding the corner opens the menu', await js('__app.menuOpen'));
await touch('touchEnd', W - 30, 30);

const before = await js(`__app.seg.scene + '@' + __app.seg.loc`);
const next = await centerOf('.panel.menu .btn', 1);
await click(next[0], next[1]);
await sleep(1800);
const after = await js(`__app.seg.scene + '@' + __app.seg.loc`);
check('Next scene changes the scene (' + before + ' -> ' + after + ')', before !== after);

await key('Escape', 'Escape', 27);
await sleep(300);
await js(`__app.ui.show('settings', 'menu'); 1`);
await sleep(300);
const was = await js('__app.settings.calm');
const sw = await centerOf('.switch', 0);
await click(sw[0], sw[1]);
await sleep(200);
check('a settings switch flips and is saved', await js(`__app.settings.calm === ${!was} && JSON.parse(localStorage.getItem('purrcade:settings')).calm === ${!was}`));

await js(`__app.ui.show('gallery', 'menu'); 1`);
await sleep(4000);
check('the gallery draws snapshots', await js(`document.querySelectorAll('.thumb img').length >= 3`));
const playThis = await centerOf('.card .btn.primary', 2);
await click(playThis[0], playThis[1]);
await sleep(1600);
const picked = await js('__app.single');
check('Play this plays that scene (' + picked + ')', !!picked && (await js('__app.seg.scene')) === picked);

// A scene full of birds makes sound by itself, without any paws.
await js(`__app.ui.hide(); __app.play('birds'); 1`);
await sleep(1500);
const p0 = await js('__app.sfx.played');
await sleep(8000);
const p1 = await js('__app.sfx.played');
check('the bird scene is heard (' + (p1 - p0) + ' sounds in 8 s)', p1 - p0 >= 3);

await js('__app.restNow(); 1');
await sleep(1200);
check('the rest screen shows', await js(`__app.mode === 'rest' && __app.ui.view === 'rest'`));
await touch('touchStart', W - 30, 30); await sleep(2300); await touch('touchEnd', W - 30, 30);
await sleep(1500);
check('holding the corner on the rest screen plays again', await js(`__app.mode === 'play'`));

check('no errors', errs.length === 0);
for (const e of [...new Set(errs)].slice(0, 5)) console.log('  ' + e);
console.log(`${ok} ok, ${bad} failed`);
ws.close(); chrome.kill(); await server.close();
process.exit(bad ? 1 : 0);
