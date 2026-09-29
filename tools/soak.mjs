// Runs the marathon fast-forwarded for a while and watches for errors, frame rate and memory:
//   MIN=3 SPEED=8 node tools/soak.mjs
import path from 'path';
import { spawn } from 'child_process';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const PORT = 5197, CDP = 9397;
const MIN = Number(process.env.MIN || 3), SPEED = Number(process.env.SPEED || 8);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: PORT, strictPort: true } });
await server.listen();
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-sandbox', '--enable-precise-memory-info', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(root, '.chrome-sweep'), 'about:blank'], { stdio: 'ignore' });
let ver = null;
for (let i = 0; i < 80 && !ver; i++) { try { ver = await (await fetch('http://127.0.0.1:' + CDP + '/json/version')).json(); } catch { await sleep(200); } }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const wait = new Map(); const errs = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 600));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push(m.params.args.map((a) => a.value || a.description).join(' ').slice(0, 400));
  const p = wait.get(m.id); if (p) { wait.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; wait.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, s); await send('Runtime.enable', {}, s);
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }, s);
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }, s)).result.value;
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` }, s);
await sleep(2000);
await evalJs(`__app.settings.segment = 1; __app.settings.fullscreen = false; __app.loop.speed = ${SPEED}; __app.play(); 1`);
const seen = new Set();
const t0 = Date.now();
while (Date.now() - t0 < MIN * 60000) {
  await sleep(10000);
  const st = await evalJs(`({ scene: __app.seg && __app.seg.scene, loc: __app.seg && __app.seg.loc, tod: __app.seg && __app.seg.tod, fps: __app.loop.fps, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1, parts: __app.stage.fx.list.length })`);
  seen.add(st.scene + '@' + st.loc);
  console.log(`${Math.round((Date.now() - t0) / 1000)}s  ${st.scene}@${st.loc} ${st.tod}  fps ${st.fps}  heap ${st.mem} MB  particles ${st.parts}`);
}
console.log(`${seen.size} scene/place pairs seen; ${errs.length} errors`);
for (const e of [...new Set(errs)].slice(0, 5)) console.log('  ' + e);
ws.close(); chrome.kill(); await server.close();
process.exit(errs.length ? 1 : 0);
