// Screenshots of the game in headless Chrome, served by Vite for the length of the run.
//
//   node tools/shoot.mjs <name>@<query> [...]      e.g. kitchen@view=kitchen;tod=day
//   env: W, H (window, CSS px, default 1280×720), WAIT (ms before the shot, default 1500),
//        DPR (default 1), OUT (folder, default shots/)
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const OUT = path.resolve(root, process.env.OUT || 'shots');
fs.mkdirSync(OUT, { recursive: true });
const W = Number(process.env.W || 1280), H = Number(process.env.H || 720), DPR = Number(process.env.DPR || 1);
const WAIT = Number(process.env.WAIT || 1500);
const PORT = 5199, CDP = 9399;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: PORT, strictPort: true } });
await server.listen();
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(root, '.chrome-shots'), 'about:blank'], { stdio: 'ignore' });
let ver = null;
for (let i = 0; i < 80 && !ver; i++) { try { ver = await (await fetch('http://127.0.0.1:' + CDP + '/json/version')).json(); } catch { await sleep(200); } }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const wait = new Map(); const logs = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 800));
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.type + ' ' + m.params.args.map((a) => a.value || a.description).join(' ').slice(0, 400));
  const p = wait.get(m.id); if (p) { wait.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; wait.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, s); await send('Runtime.enable', {}, s);
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: false }, s);
await send('Emulation.setFocusEmulationEnabled', { enabled: true }, s);

// name@query[@ms,ms,…], with ';' for '&' (a shell on Windows splits commands on '&').
// With a list of times, one shot is taken at each: name-1.png, name-2.png, …
// A fourth part runs one of these first: play, gallery, settings, stats, menu.
const ACTIONS = {
  play: '__app.play()',
  gallery: "__app.ui.show('gallery', 'home')",
  settings: "__app.ui.show('settings', 'home')",
  stats: "__app.stats.catch('mouse'); __app.stats.catch('mouse'); __app.stats.catch('bird'); __app.stats.catch('laser'); __app.ui.show('stats', 'home')",
  menu: '__app.play(); setTimeout(() => __app.openMenu(), 1500)',
};
for (const arg of process.argv.slice(2)) {
  const [name, q = name, times, action] = arg.split('@');
  const query = q.replaceAll(';', '&');
  await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/?' + query }, s);
  if (action) { await sleep(900); await send('Runtime.evaluate', { expression: ACTIONS[action] || action }, s); }
  const at = times ? times.split(',').map(Number) : [WAIT];
  let waited = 0;
  for (let i = 0; i < at.length; i++) {
    await sleep(Math.max(0, at[i] - waited));
    waited = at[i];
    const { data } = await send('Page.captureScreenshot', { format: 'png' }, s);
    const file = at.length > 1 ? name + '-' + (i + 1) : name;
    fs.writeFileSync(path.join(OUT, file + '.png'), Buffer.from(data, 'base64'));
    console.log('shot', file);
  }
}
console.log(logs.length ? logs.join('\n') : 'no errors');
ws.close(); chrome.kill(); await server.close();
process.exit(0);
