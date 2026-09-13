/**
 * Generate placeholder PNG sprites with pure Node (zlib + CRC32).
 * Transparent backgrounds. Watchfort palette.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../assets');
const PUBLIC = path.resolve(__dirname, '../public/assets');

const P = {
  grass: [0x4a, 0x7c, 0x59, 255],
  grassL: [0x5c, 0x94, 0x6b, 255],
  grassD: [0x3a, 0x63, 0x48, 255],
  path: [0xc4, 0xa5, 0x74, 255],
  pathL: [0xd4, 0xb8, 0x8a, 255],
  pathD: [0xa8, 0x8a, 0x58, 255],
  blue: [0x3b, 0x82, 0xc4, 255],
  blueL: [0x60, 0xa5, 0xd8, 255],
  cannon: [0xf9, 0x73, 0x16, 255],
  cannonL: [0xfb, 0xa0, 0x52, 255],
  frost: [0x22, 0xd3, 0xee, 255],
  frostL: [0x67, 0xe8, 0xf9, 255],
  red: [0xd6, 0x45, 0x45, 255],
  redD: [0x9b, 0x2c, 0x2c, 255],
  gold: [0xe8, 0xb8, 0x4a, 255],
  panel: [0x11, 0x18, 0x27, 255],
  text: [0xf3, 0xf4, 0xf6, 255],
  shade: [0x1f, 0x29, 0x33, 255],
  wood: [0x8b, 0x5a, 0x2b, 255],
  woodL: [0xb0, 0x78, 0x3c, 255],
  iron: [0x6b, 0x72, 0x80, 255],
  transparent: [0, 0, 0, 0],
};

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
}
const CRC_TABLE = crcTable();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crcData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = rowStart + 1 + x * 4;
      raw[di] = rgba[si];
      raw[di + 1] = rgba[si + 1];
      raw[di + 2] = rgba[si + 2];
      raw[di + 3] = rgba[si + 3];
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

function createCanvas(w, h, fill = P.transparent) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = fill[3];
  }
  return { w, h, data };
}

function setPx(c, x, y, color) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  c.data[i] = color[0];
  c.data[i + 1] = color[1];
  c.data[i + 2] = color[2];
  c.data[i + 3] = color[3];
}

function fillRect(c, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) setPx(c, x, y, color);
  }
}

function fillCircle(c, cx, cy, r, color) {
  const r2 = r * r;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r2) setPx(c, cx + x, cy + y, color);
    }
  }
}

function outlineRect(c, x0, y0, w, h, color) {
  fillRect(c, x0, y0, w, 1, color);
  fillRect(c, x0, y0 + h - 1, w, 1, color);
  fillRect(c, x0, y0, 1, h, color);
  fillRect(c, x0 + w - 1, y0, 1, h, color);
}

function save(name, canvas) {
  const buf = encodePng(canvas.w, canvas.h, canvas.data);
  fs.writeFileSync(path.join(OUT, name), buf);
}

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PUBLIC, { recursive: true });

// grass 64
{
  const c = createCanvas(64, 64, P.grass);
  for (let i = 0; i < 70; i++) {
    const x = (i * 11 + 5) % 64;
    const y = (i * 17 + 3) % 64;
    setPx(c, x, y, P.grassL);
  }
  for (let i = 0; i < 40; i++) {
    setPx(c, (i * 13 + 2) % 64, (i * 19 + 7) % 64, P.grassD);
  }
  fillRect(c, 0, 0, 64, 1, P.grassD);
  fillRect(c, 0, 0, 1, 64, P.grassD);
  save('tile_grass.png', c);
}

// path 64
{
  const c = createCanvas(64, 64, P.path);
  for (let i = 0; i < 50; i++) {
    setPx(c, (i * 9 + 4) % 64, (i * 14 + 6) % 64, P.pathL);
  }
  for (let i = 0; i < 28; i++) {
    fillCircle(c, (i * 17 + 8) % 64, (i * 23 + 11) % 64, 1, P.pathD);
  }
  fillRect(c, 0, 0, 64, 1, P.pathD);
  fillRect(c, 0, 0, 1, 64, P.pathD);
  save('tile_path.png', c);
}

// gate 64
{
  const c = createCanvas(64, 64);
  fillRect(c, 8, 10, 10, 46, P.wood);
  fillRect(c, 46, 10, 10, 46, P.wood);
  fillRect(c, 10, 12, 6, 42, P.woodL);
  fillRect(c, 48, 12, 6, 42, P.woodL);
  fillRect(c, 8, 14, 48, 10, P.wood);
  fillRect(c, 12, 16, 40, 6, P.gold);
  fillRect(c, 28, 8, 8, 10, P.gold);
  fillCircle(c, 32, 8, 5, P.gold);
  outlineRect(c, 8, 10, 48, 46, P.shade);
  save('tile_gate.png', c);
}

function towerBase(c, accent, accentL) {
  fillCircle(c, 32, 50, 12, [0, 0, 0, 55]);
  fillRect(c, 16, 34, 32, 18, P.wood);
  fillRect(c, 18, 36, 28, 14, P.woodL);
  outlineRect(c, 16, 34, 32, 18, P.shade);
  fillRect(c, 20, 18, 24, 20, accent);
  fillRect(c, 22, 20, 20, 16, accentL);
  outlineRect(c, 20, 18, 24, 20, P.shade);
}

// arrow tower
{
  const c = createCanvas(64, 64);
  towerBase(c, P.blue, P.blueL);
  fillRect(c, 30, 6, 4, 16, P.iron);
  fillRect(c, 28, 6, 8, 4, P.shade);
  fillRect(c, 31, 4, 2, 8, P.gold);
  save('tower_arrow.png', c);
}

// cannon
{
  const c = createCanvas(64, 64);
  towerBase(c, P.cannon, P.cannonL);
  fillRect(c, 26, 4, 12, 18, P.iron);
  fillRect(c, 28, 6, 8, 14, P.cannon);
  fillCircle(c, 32, 6, 5, P.shade);
  fillCircle(c, 32, 6, 3, P.cannonL);
  save('tower_cannon.png', c);
}

// frost
{
  const c = createCanvas(64, 64);
  towerBase(c, P.frost, P.frostL);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.round(32 + Math.cos(a) * 10);
    const y = Math.round(16 + Math.sin(a) * 8);
    fillCircle(c, x, y, 3, P.frostL);
  }
  fillCircle(c, 32, 16, 7, P.frost);
  fillCircle(c, 32, 16, 3, P.text);
  save('tower_frost.png', c);
}

function enemyBody(size, dark) {
  const c = createCanvas(size, size);
  const mid = Math.floor(size / 2);
  fillCircle(c, mid, size - 8, Math.floor(size / 5), [0, 0, 0, 60]);
  fillRect(c, mid - 7, mid + 4, 5, 10, P.redD);
  fillRect(c, mid + 2, mid + 4, 5, 10, P.redD);
  fillCircle(c, mid, mid, Math.floor(size / 3.2), dark ? P.redD : P.red);
  fillCircle(c, mid, mid - 2, Math.floor(size / 4.2), P.red);
  fillRect(c, mid - 8, mid - 2, 4, 10, P.red);
  fillRect(c, mid + 4, mid - 2, 4, 10, P.red);
  setPx(c, mid - 3, mid - 4, P.gold);
  setPx(c, mid + 2, mid - 4, P.gold);
  return c;
}

{
  const c = enemyBody(40, false);
  save('enemy_runner.png', c);
}
{
  const c = enemyBody(44, true);
  fillRect(c, 10, 14, 24, 6, P.iron);
  save('enemy_tank.png', c);
}
{
  const c = enemyBody(52, true);
  fillRect(c, 18, 6, 4, 10, P.shade);
  fillRect(c, 30, 6, 4, 10, P.shade);
  fillCircle(c, 20, 6, 3, P.gold);
  fillCircle(c, 32, 6, 3, P.gold);
  save('enemy_brute.png', c);
}

{
  const c = createCanvas(12, 12);
  fillRect(c, 1, 5, 10, 2, P.blueL);
  fillRect(c, 8, 3, 3, 6, P.blue);
  save('projectile_arrow.png', c);
}
{
  const c = createCanvas(14, 14);
  fillCircle(c, 7, 7, 5, P.cannon);
  fillCircle(c, 7, 7, 2, P.gold);
  save('projectile_cannon.png', c);
}
{
  const c = createCanvas(12, 12);
  fillCircle(c, 6, 6, 4, P.frost);
  fillCircle(c, 6, 6, 2, P.text);
  save('projectile_frost.png', c);
}

{
  const c = createCanvas(180, 56);
  fillRect(c, 0, 0, 180, 56, P.shade);
  fillRect(c, 3, 3, 174, 50, P.blue);
  fillRect(c, 6, 6, 168, 44, [0x2b, 0x6c, 0xa8, 255]);
  outlineRect(c, 0, 0, 180, 56, P.gold);
  save('btn_play.png', c);
}

{
  const c = createCanvas(16, 16);
  fillCircle(c, 8, 8, 6, P.gold);
  fillCircle(c, 8, 8, 4, [0xf4, 0xd0, 0x78, 255]);
  setPx(c, 8, 8, P.shade);
  save('ui_coin.png', c);
}

{
  const c = createCanvas(10, 10);
  fillCircle(c, 5, 5, 4, P.gold);
  fillCircle(c, 5, 5, 2, P.text);
  save('fx_hit.png', c);
}

for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith('.png')) {
    fs.copyFileSync(path.join(OUT, f), path.join(PUBLIC, f));
  }
}
