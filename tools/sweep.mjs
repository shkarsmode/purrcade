// Plays every scene in every place it belongs to, at every hour, fast-forwarded, pawing at it
// now and then, and reports anything that throws:  node tools/sweep.mjs [sceneId …]
import path from 'path';
import { spawn } from 'child_process';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const PORT = 5198, CDP = 9398;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: PORT, strictPort: true } });
await server.listen();
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(root, '.chrome-sweep'), 'about:blank'], { stdio: 'ignore' });
let ver = null;
for (let i = 0; i < 80 && !ver; i++) { try { ver = await (await fetch('http://127.0.0.1:' + CDP + '/json/version')).json(); } catch { await sleep(200); } }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const wait = new Map(); let errs = [];
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
const W = Number(process.env.W || 1280), H = Number(process.env.H || 720);
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }, s);
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, s)).result.value;

await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?view=kitchen` }, s);
await sleep(1500);
const cat = await evalJs('window.__catalog');
const only = process.argv.slice(2);
const TODS = ['dawn', 'day', 'dusk', 'night'];
let runs = 0, bad = 0;
for (const sc of cat.scenes) {
  if (only.length && !only.includes(sc.id)) continue;
  for (const loc of sc.locations) {
    for (const tod of sc.tods || TODS) {
      errs = [];
      await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?view=${loc}&scene=${sc.id}&tod=${tod}&speed=8&seed=${runs + 1}` }, s);
      await sleep(900);
      // Paw about a bit.
      await evalJs('for (let i = 0; i < 12; i++) window.__stage.paw(Math.random() * window.__stage.W, Math.random() * window.__stage.H)');
      await sleep(700);
      await evalJs('for (let i = 0; i < 12; i++) window.__stage.paw(Math.random() * window.__stage.W, window.__stage.H * (0.5 + Math.random() * 0.5))');
      await sleep(600);
      runs++;
      if (errs.length) { bad++; console.log(`FAIL ${sc.id} @ ${loc} ${tod}\n  ` + [...new Set(errs)].slice(0, 3).join('\n  ')); }
    }
  }
}
console.log(`${runs} runs, ${bad} with errors`);
ws.close(); chrome.kill(); await server.close();
process.exit(bad ? 1 : 0);
