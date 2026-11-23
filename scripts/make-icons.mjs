// 生成黑白苹果图标(无依赖):node scripts/make-icons.mjs → public/*.png
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcT = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
function png(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// 苹果:1 = 黑,0 = 白(单位坐标 0..1,向下为 y+)
const inC = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const inE = (x, y, cx, cy, a, b, rot) => {
  const c = Math.cos(rot), s = Math.sin(rot);
  const dx = x - cx, dy = y - cy;
  const u = dx * c + dy * s, v = -dx * s + dy * c;
  return (u / a) ** 2 + (v / b) ** 2 <= 1;
};
function ink(x, y) {
  const body = inC(x, y, 0.41, 0.58, 0.25) || inC(x, y, 0.59, 0.58, 0.25) || inC(x, y, 0.5, 0.62, 0.27);
  const notch = inC(x, y, 0.5, 0.31, 0.065);
  const stem = Math.abs(x - (0.5 + (0.5 - y) * 0.1)) < 0.018 && y > 0.17 && y < 0.38;
  const leaf = inE(x, y, 0.6, 0.21, 0.1, 0.04, -0.45);
  const hi = inE(x, y, 0.33, 0.56, 0.035, 0.07, 0.35);
  return ((body && !notch) || stem || leaf) && !hi;
}
function render(size, scale) {
  const rgb = Buffer.alloc(size * size * 3);
  const SS = 3;
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size; px++) {
      let n = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS) / size, v = (py + (sy + 0.5) / SS) / size;
          if (ink(0.5 + (u - 0.5) / scale, 0.5 + (v - 0.5) / scale)) n++;
        }
      const g = Math.round(255 * (1 - n / (SS * SS)) * 0.96 + 10 * 0);
      const o = (py * size + px) * 3;
      rgb[o] = g; rgb[o + 1] = g; rgb[o + 2] = g;
    }
  return png(size, size, rgb);
}
mkdirSync('public', { recursive: true });
writeFileSync('public/apple-touch-icon.png', render(180, 0.86));
writeFileSync('public/icon-192.png', render(192, 0.82));
writeFileSync('public/icon-512.png', render(512, 0.82));
console.log('icons ok');
