// Draws the app icons — a pixel cat's face on a night-purple tile — and writes them as PNGs,
// with a small PNG encoder so there is nothing to install:  node scripts/icons.mjs
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const out = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });

// 32×32 design: Jenny's face — a grey-brown mackerel tabby with a white chin and yellow-green
// eyes. Letters are colours (see PAL); '.' is the tile, ' ' is transparent.
const ART = [
  '  ............................  ',
  ' .............................. ',
  '................................',
  '....oo....................oo....',
  '...oBBo..................oBBo...',
  '...oBpBo................oBpBo...',
  '...oBppBo..............oBppBo...',
  '...oBpppBoooooooooooooBpppBo....',
  '...oBBBBBBBBsBBsBBsBBBBBBBBBo...',
  '..oBBBBBBBBBBsBssBsBBBBBBBBBBo..',
  '..oBBBBBBBBBBBsBBsBBBBBBBBBBBo..',
  '..osBBBBBBBBBBBBBBBBBBBBBBBBso..',
  '..oBssBBBBBBBBBBBBBBBBBBBBssBo..',
  '..oBBBBgggBBBBBBBBBBBBgggBBBBo..',
  '..oBBBggkggBBBBBBBBBBggkggBBBo..',
  '..oBBBggkgwBBBBBBBBBBggkgwBBBo..',
  '..oBBBggkggBBBBBBBBBBggkggBBBo..',
  '..osBBBgggBBBBBBBBBBBBgggBBBso..',
  '..oBssBBBBBBBBBnnnnBBBBBBBssBo..',
  'w..oBBBBBBBBBBBBnnBBBBBBBBBBo..w',
  '.ww.oBBBBBBBBBkWWkBBBBBBBBBo.w..',
  '...wwBBBBBBBBWWkkWWBBBBBBBBww...',
  '.....oBBBBBBWWWWWWWWBBBBBBo.....',
  '......oBBBBBWWWWWWWWBBBBBo......',
  '.......ooBBBBWWWWWWBBBBoo.......',
  '.........oooooooooooooo.........',
  '................................',
  '................................',
  '..y..........................y..',
  '.yyy.........................yyy',
  ' .y..........................y. ',
  '  ............................  ',
];
const PAL = {
  '.': [35, 26, 56], o: [33, 24, 16], B: [139, 120, 98], s: [48, 39, 31], p: [212, 145, 127],
  g: [201, 215, 74], k: [21, 17, 13], w: [245, 241, 234], n: [212, 145, 127], W: [245, 241, 234], y: [255, 210, 63],
};

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pad = 0) {
  const inner = size - pad * 2;
  const scale = inner / 32;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      const gx = Math.floor((x - pad) / scale), gy = Math.floor((y - pad) / scale);
      let col = null;
      if (gx >= 0 && gy >= 0 && gx < 32 && gy < 32) { const ch = ART[gy][gx]; col = ch === ' ' ? null : PAL[ch]; }
      else if (pad) col = PAL['.'];
      if (pad && !col) col = PAL['.'];
      if (col) { raw[i] = col[0]; raw[i + 1] = col[1]; raw[i + 2] = col[2]; raw[i + 3] = 255; }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const files = [['favicon-64.png', 64, 0], ['apple-touch-icon.png', 180, 10], ['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['maskable-512.png', 512, 64]];
for (const [name, size, pad] of files) {
  fs.writeFileSync(path.join(out, name), png(size, pad));
  console.log('wrote', name);
}
