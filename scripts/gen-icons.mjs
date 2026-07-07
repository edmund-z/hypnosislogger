// Generates PWA icons (a gold spiral on cream) as PNGs with zero native
// dependencies — raw pixel buffer + zlib + hand-built PNG chunks.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const CREAM = [0xf4, 0xed, 0xe0];
const ESPRESSO = [0x2b, 0x21, 0x18];
const GOLD = [0xbd, 0x9a, 0x4a];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  // raw scanlines with filter byte 0
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 3);
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.36;
  const turns = 3;
  const b = maxR / (turns * 2 * Math.PI); // Archimedean spiral r = b*theta
  const stroke = size * 0.045;

  const set = (x, y, rgb) => {
    const i = (y * size + x) * 3;
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      set(x, y, CREAM);
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      if (r > maxR + stroke) continue;
      const theta = Math.atan2(dy, dx);
      // distance to nearest spiral arm across winding numbers
      let minDist = Infinity;
      for (let k = 0; k <= turns; k++) {
        const armR = b * (theta + Math.PI + k * 2 * Math.PI);
        minDist = Math.min(minDist, Math.abs(r - armR));
      }
      if (minDist < stroke / 2) {
        // anti-alias edge
        const t = minDist / (stroke / 2);
        const c = t > 0.75 ? GOLD.map((g, i) => Math.round(g * 0.35 + CREAM[i] * 0.65)) : GOLD;
        set(x, y, c);
      } else if (r < stroke * 0.9) {
        set(x, y, ESPRESSO); // center dot
      }
    }
  }
  return encodePNG(size, px);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", drawIcon(192));
writeFileSync("public/icons/icon-512.png", drawIcon(512));
writeFileSync("public/icons/apple-touch-icon.png", drawIcon(180));
console.log("icons written to public/icons/");
