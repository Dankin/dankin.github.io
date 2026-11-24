// 苹果 sprite 库:appleSprite(kind, state, size) → 预渲染 Baked;drawApple 为统一签名封装。
// 画法:体积 = 基色 + 右下暗月牙 + 径向柔光 + 白色高光椭圆 + 粗黑描边 + 柄 + 叶。
import { bake, Baked, Ctx, PAL, rng, mix, shade, rgba, hueShift, ell, star4, TAU, clamp } from './common';

export type AppleState = 'fresh' | 'ripe' | 'wormy' | 'shiny' | 'rotten';
export type AppleKind =
  | 'fuji' | 'yellow' | 'green' | 'golden' | 'delicious' | 'pink' | 'spotted' | 'purple' | 'silver' | 'wormy' | 'caramel' | 'giant'
  | 'kent' | 'poison' | 'forbidden' | 'gala' | 'icesweet' | 'haitang';

type Feat = 'spots' | 'stripes' | 'hole' | 'honey' | 'bite' | 'glaze' | 'ridge' | 'skull' | 'blush';
interface Def {
  id: AppleKind; name: string; base: string; dark: string; light: string;
  rx: number; ry: number; taper: number; skew: number; R: number;
  leaf?: string; feat?: Feat[]; hl?: number; glow?: string;
}

const D = (d: Def): Def => d;
export const APPLE_DEFS: Def[] = [
  D({ id: 'fuji', name: '富士红', base: '#dc3a2c', dark: '#a41e1d', light: '#ff6a5e', rx: 1, ry: 0.97, taper: 0.08, skew: 0, R: 19.5 }),
  D({ id: 'yellow', name: '黄元帅', base: '#e8c93a', dark: '#b8932a', light: '#fff06a', rx: 1.04, ry: 0.9, taper: 0.1, skew: 0, R: 19.5 }),
  D({ id: 'green', name: '青苹果', base: '#8cc63f', dark: '#5a9a2a', light: '#c4f066', rx: 1, ry: 0.94, taper: 0.04, skew: 0, R: 19.5, leaf: '#3f8a2a' }),
  D({ id: 'golden', name: '金苹果', base: '#f7c635', dark: '#d1901a', light: '#fff1a0', rx: 0.98, ry: 1, taper: 0.06, skew: 0, R: 20, glow: '#ffe06a' }),
  D({ id: 'delicious', name: '蛇果', base: '#a3202f', dark: '#66101e', light: '#d4485a', rx: 0.94, ry: 1.07, taper: 0.22, skew: 0, R: 19.5, feat: ['ridge'] }),
  D({ id: 'pink', name: '粉红佳人', base: '#ee8aa2', dark: '#c4607c', light: '#ffc6d4', rx: 0.98, ry: 0.98, taper: 0.06, skew: 0, R: 19.5 }),
  D({ id: 'spotted', name: '红斑', base: '#dc3a2c', dark: '#a41e1d', light: '#ff6a5e', rx: 1, ry: 0.97, taper: 0.1, skew: 0.04, R: 19.5, feat: ['spots'] }),
  D({ id: 'purple', name: '紫苹果', base: '#7a58b8', dark: '#4a3586', light: '#a98ae0', rx: 0.97, ry: 0.96, taper: 0.06, skew: 0, R: 19.5 }),
  D({ id: 'silver', name: '灰银', base: '#bdb7a9', dark: '#8a8476', light: '#e4ddcb', rx: 1.02, ry: 0.93, taper: 0.05, skew: 0.1, R: 19.5, leaf: '#6f9a4a' }),
  D({ id: 'wormy', name: '虫蛀', base: '#dc3a2c', dark: '#a41e1d', light: '#ff6a5e', rx: 1, ry: 0.97, taper: 0.08, skew: -0.05, R: 19.5, feat: ['hole'] }),
  D({ id: 'caramel', name: '焦糖', base: '#d8944f', dark: '#a8602c', light: '#f4b878', rx: 1.03, ry: 0.92, taper: 0.1, skew: 0, R: 19.5, feat: ['glaze'] }),
  D({ id: 'giant', name: '巨无霸', base: '#dc3a2c', dark: '#a41e1d', light: '#ff6a5e', rx: 1.04, ry: 0.98, taper: 0.08, skew: 0, R: 24 }),
  D({ id: 'kent', name: '肯特之花', base: '#e0d86a', dark: '#b2a940', light: '#fffbb0', rx: 0.98, ry: 1.03, taper: 0.14, skew: 0, R: 19.5, feat: ['blush'] }),
  D({ id: 'poison', name: '毒苹果', base: '#5a2a72', dark: '#2c1240', light: '#9a5ab8', rx: 1, ry: 0.97, taper: 0.1, skew: 0, R: 19.5, leaf: '#6bc23a', feat: ['skull'], glow: '#7bf050' }),
  D({ id: 'forbidden', name: '禁果', base: '#f0a52a', dark: '#c4301e', light: '#ffe27a', rx: 1.02, ry: 0.98, taper: 0.07, skew: 0, R: 20, feat: ['bite'], glow: '#ffd24a' }),
  D({ id: 'gala', name: '嘎啦', base: '#e8603a', dark: '#b03a22', light: '#ffa070', rx: 0.98, ry: 0.92, taper: 0.06, skew: 0, R: 17, feat: ['stripes'] }),
  D({ id: 'icesweet', name: '冰糖心', base: '#d63a30', dark: '#9a1c20', light: '#ff7466', rx: 1, ry: 0.98, taper: 0.08, skew: 0, R: 19.5, feat: ['honey'] }),
  D({ id: 'haitang', name: '海棠', base: '#d8282f', dark: '#96141e', light: '#ff6860', rx: 0.98, ry: 0.98, taper: 0.04, skew: 0, R: 11.5 }),
];
export const APPLE_KINDS: AppleKind[] = APPLE_DEFS.map((d) => d.id);
export const APPLE_NAMES: Record<string, string> = Object.fromEntries(APPLE_DEFS.map((d) => [d.id, d.name]));
const BYID = new Map(APPLE_DEFS.map((d) => [d.id, d]));
export const APPLE_STATES: AppleState[] = ['fresh', 'ripe', 'wormy', 'shiny', 'rotten'];

const CELL = 64; // 设计坐标 64×64,按 size 缩放
const GROUND = 58; // 苹果底部落在 y=58

// 右半边贝塞尔(归一化),左半边镜像
const RIGHT: [number, number, number, number, number, number][] = [
  [0.2, -0.95, 0.55, -1.02, 0.8, -0.88],
  [1.0, -0.76, 1.06, -0.25, 0.99, 0.15],
  [0.92, 0.6, 0.62, 1.0, 0.3, 0.98],
  [0.16, 0.97, 0.07, 0.92, 0, 0.88],
];

function bodyPath(ctx: Ctx, d: Def, cx: number, cy: number, R: number, seed: number, dx = 0, dy = 0, k = 1) {
  const r = rng(seed); const J = () => (r() - 0.5) * 0.05;
  const rx = R * d.rx * k, ry = R * d.ry * k;
  const P = (x: number, y: number): [number, number] => {
    const low = Math.max(0, y);
    return [cx + dx + (x * (1 - d.taper * low) + d.skew * -y) * rx + J() * R * 0.25, cy + dy + y * ry + J() * R * 0.25];
  };
  const segs: number[][] = [];
  // 右侧(顺时针)
  let prev: [number, number] = [0, -0.66];
  const left: number[][] = [];
  for (const s of RIGHT) { segs.push(s); left.push([prev[0], prev[1], s[0], s[1], s[2], s[3], s[4], s[5]]); prev = [s[4], s[5]]; }
  ctx.beginPath();
  const p0 = P(0, -0.66); ctx.moveTo(p0[0], p0[1]);
  for (const s of segs) {
    const a = P(s[0], s[1]), b = P(s[2], s[3]), c = P(s[4], s[5]);
    ctx.bezierCurveTo(a[0], a[1], b[0], b[1], c[0], c[1]);
  }
  // 左侧:反向,x 取负
  for (let i = left.length - 1; i >= 0; i--) {
    const L = left[i];
    const a = P(-L[4], L[5]), b = P(-L[2], L[3]), c = P(-L[0], L[1]);
    ctx.bezierCurveTo(a[0], a[1], b[0], b[1], c[0], c[1]);
  }
  ctx.closePath();
}

function tint(d: Def, st: AppleState): { base: string; dark: string; light: string } {
  let { base, dark, light } = d;
  if (st === 'ripe') { base = mix(shade(hueShift(base, -4, 1.08), 0.9), '#6a1410', 0.12); dark = shade(dark, 0.85); light = mix(light, base, 0.25); }
  else if (st === 'shiny') { base = hueShift(base, 10, 1.12, 0.05); dark = hueShift(dark, 8, 1.05, 0.03); light = hueShift(light, 12, 1, 0.05); }
  else if (st === 'rotten') { base = mix(base, '#6b5a3a', 0.62); dark = mix(dark, '#3a2c1a', 0.65); light = mix(light, '#a89a6a', 0.55); }
  return { base, dark, light };
}

/** 在 64×64 设计坐标里画一个苹果(不含底部阴影) */
function paint(ctx: Ctx, d: Def, st: AppleState, lw: number, seed: number) {
  const R = d.R, cy = GROUND - R * d.ry * 0.98, cx = CELL / 2;
  const { base, dark, light } = tint(d, st);
  const ink = PAL.ink;
  const feats = d.feat ?? [];

  // 光晕(闪光 / 金 / 毒 / 禁果)
  const glow = st === 'shiny' ? '#ffe98a' : st === 'wormy' || st === 'rotten' ? null : d.glow ?? null;
  if (glow) {
    const g = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.55);
    g.addColorStop(0, rgba(glow, st === 'shiny' ? 0.75 : 0.5)); g.addColorStop(1, rgba(glow, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, CELL, CELL);
  }

  // ---- 体 ----
  ctx.save();
  bodyPath(ctx, d, cx, cy, R, seed);
  ctx.fillStyle = base; ctx.fill();
  ctx.save(); ctx.clip();
  // 暗月牙:全涂暗,再用偏移缩小的体叠回基色
  ctx.fillStyle = dark; ctx.fillRect(0, 0, CELL, CELL);
  bodyPath(ctx, d, cx, cy, R, seed, -R * 0.1, -R * 0.13, 0.9);
  ctx.fillStyle = base; ctx.fill();
  // 禁果:红金渐变
  if (feats.includes('bite') || d.id === 'forbidden') {
    const g = ctx.createLinearGradient(cx + R, cy + R, cx - R * 0.6, cy - R);
    g.addColorStop(0, rgba('#d8301e', 0.85)); g.addColorStop(0.55, rgba('#f08a2a', 0.2)); g.addColorStop(1, rgba(base, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, CELL, CELL);
  }
  // 径向柔光
  const rg = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.42, R * 0.05, cx - R * 0.2, cy - R * 0.2, R * 1.1);
  rg.addColorStop(0, rgba(light, 0.85)); rg.addColorStop(0.5, rgba(light, 0.25)); rg.addColorStop(1, rgba(light, 0));
  ctx.fillStyle = rg; ctx.fillRect(0, 0, CELL, CELL);
  // 底部反光(右下暗区内的亮边)
  ell(ctx, cx + R * 0.45, cy + R * 0.82, R * 0.5, R * 0.14, -0.35); ctx.fillStyle = rgba(light, 0.28); ctx.fill();

  const r = rng(seed * 7 + 3);
  if (feats.includes('spots')) {
    ctx.fillStyle = '#ffe9a6';
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU, rr = Math.sqrt(r()) * R * 0.62;
      const px = cx - R * 0.12 + Math.cos(a) * rr, py = cy + R * 0.28 + Math.sin(a) * rr * 0.7;
      ell(ctx, px, py, R * (0.05 + r() * 0.04), R * (0.045 + r() * 0.03), r() * 3); ctx.fill();
    }
  }
  if (feats.includes('stripes') || feats.includes('blush')) {
    ctx.strokeStyle = feats.includes('blush') ? rgba('#e0584a', 0.7) : rgba(dark, 0.65);
    ctx.lineWidth = feats.includes('blush') ? 3 : 1.5;
    const n = feats.includes('blush') ? 4 : 6;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n * 2 - 1; // -1..1
      ctx.beginPath();
      ctx.moveTo(cx + t * R * 0.28, cy - R * 0.62);
      ctx.quadraticCurveTo(cx + t * R * 0.95 + (feats.includes('blush') ? R * 0.2 : 0), cy + R * 0.05, cx + t * R * 0.72, cy + R * (feats.includes('blush') ? 0.55 : 0.9));
      ctx.stroke();
    }
  }
  if (feats.includes('ridge')) {
    ctx.strokeStyle = rgba('#3a0810', 0.5); ctx.lineWidth = 1.6;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * R * 0.2, cy + R * 1.05); ctx.quadraticCurveTo(cx + i * R * 0.24, cy + R * 0.7, cx + i * R * 0.3, cy + R * 0.45); ctx.stroke(); }
  }
  if (feats.includes('honey')) {
    const g = ctx.createRadialGradient(cx - R * 0.1, cy + R * 0.1, 0, cx - R * 0.1, cy + R * 0.1, R * 0.55);
    g.addColorStop(0, 'rgba(255,214,110,0.75)'); g.addColorStop(1, 'rgba(255,190,70,0)');
    ctx.fillStyle = g; ell(ctx, cx - R * 0.1, cy + R * 0.12, R * 0.55, R * 0.45, 0.3); ctx.fill();
  }
  if (feats.includes('glaze')) {
    // 焦糖釉:上半覆盖深色焦糖,下沿滴落
    ctx.beginPath();
    ctx.moveTo(cx - R * 1.2, cy - R * 1.2);
    ctx.lineTo(cx + R * 1.2, cy - R * 1.2);
    ctx.lineTo(cx + R * 1.2, cy - R * 0.1);
    const ys = [0.0, 0.42, 0.12, 0.62, 0.05, 0.38, 0.0];
    for (let i = 0; i < ys.length; i++) {
      const x = cx + R * (1.15 - (i + 1) * (2.3 / ys.length));
      ctx.quadraticCurveTo(x + R * 0.2, cy + R * ys[i] * 0.9, x, cy - R * 0.1 + R * ys[i] * 0.4);
    }
    ctx.closePath();
    ctx.fillStyle = '#7a3e18'; ctx.fill();
    ctx.strokeStyle = rgba('#3a1a08', 0.7); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = rgba('#ffcf8a', 0.7); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx - R * 0.6, cy - R * 0.5); ctx.quadraticCurveTo(cx - R * 0.2, cy - R * 0.62, cx + R * 0.1, cy - R * 0.52); ctx.stroke();
  }
  if (st === 'ripe') {
    // 熟透:果皮雀斑 + 柄旁皱褶
    ctx.fillStyle = rgba('#ffd9a0', 0.55);
    for (let i = 0; i < 7; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * R * 0.7; ell(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8 + R * 0.1, 0.9, 0.9); ctx.fill(); }
    ctx.strokeStyle = rgba(dark, 0.55); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx - R * 0.35, cy - R * 0.58); ctx.quadraticCurveTo(cx - R * 0.2, cy - R * 0.4, cx - R * 0.3, cy - R * 0.22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + R * 0.3, cy - R * 0.58); ctx.quadraticCurveTo(cx + R * 0.15, cy - R * 0.42, cx + R * 0.26, cy - R * 0.25); ctx.stroke();
  }
  if (st === 'rotten') {
    ctx.fillStyle = rgba('#2a1a0c', 0.7);
    for (let i = 0; i < 4; i++) { ell(ctx, cx + (r() - 0.5) * R * 1.1, cy + (r() - 0.3) * R * 1.0, R * (0.1 + r() * 0.12), R * (0.08 + r() * 0.1), r() * 3); ctx.fill(); }
  }
  if (feats.includes('skull')) {
    const sx = cx + R * 0.18, sy = cy + R * 0.3;
    ell(ctx, sx, sy - R * 0.04, R * 0.26, R * 0.23); ctx.fillStyle = '#eee8d4'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = ink; ell(ctx, sx - R * 0.09, sy - R * 0.06, R * 0.06, R * 0.07); ctx.fill(); ell(ctx, sx + R * 0.09, sy - R * 0.06, R * 0.06, R * 0.07); ctx.fill();
    ctx.fillRect(sx - R * 0.07, sy + R * 0.12, R * 0.14, R * 0.1);
  }
  ctx.restore(); // clip

  // 高光:白椭圆 + 小点
  const hlk = d.hl ?? 1;
  ctx.save(); ctx.translate(cx - R * 0.42, cy - R * 0.4); ctx.rotate(-0.75);
  ell(ctx, 0, 0, R * 0.25 * hlk, R * 0.14 * hlk); ctx.fillStyle = st === 'rotten' ? 'rgba(255,250,220,0.55)' : 'rgba(255,255,255,0.93)'; ctx.fill();
  ctx.restore();
  ell(ctx, cx - R * 0.12, cy - R * 0.62, R * 0.07, R * 0.05, -0.3); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();

  // 描边
  bodyPath(ctx, d, cx, cy, R, seed);
  ctx.lineWidth = lw; ctx.strokeStyle = ink; ctx.stroke();
  ctx.restore();

  // ---- 咬痕(禁果):挖掉并描边 ----
  if (feats.includes('bite')) {
    const bs = [[1.0, -0.5, 0.3], [1.14, -0.08, 0.3], [1.0, 0.36, 0.28]];
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (const [bx, by, br] of bs) { ctx.beginPath(); ctx.arc(cx + bx * R, cy + by * R, br * R, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-atop';
    for (const [bx, by, br] of bs) { ctx.beginPath(); ctx.arc(cx + bx * R, cy + by * R, br * R, 0, TAU); ctx.lineWidth = 7; ctx.strokeStyle = '#f7ecc0'; ctx.stroke(); }
    for (const [bx, by, br] of bs) { ctx.beginPath(); ctx.arc(cx + bx * R, cy + by * R, br * R, 0, TAU); ctx.lineWidth = lw * 1.6; ctx.strokeStyle = ink; ctx.stroke(); }
    ctx.restore();
  }

  // ---- 虫洞 ----
  if (st === 'wormy' || feats.includes('hole')) {
    const hx = cx + R * 0.36, hy = cy + R * 0.12;
    ell(ctx, hx, hy, R * 0.26, R * 0.21, -0.3); ctx.fillStyle = '#8a5a30'; ctx.fill(); ctx.lineWidth = lw * 0.7; ctx.strokeStyle = ink; ctx.stroke();
    ell(ctx, hx + R * 0.01, hy + R * 0.02, R * 0.17, R * 0.13, -0.3); ctx.fillStyle = '#1e0e06'; ctx.fill();
    // 虫子:从洞里探出的 3 节
    const wr = Math.max(2.6, R * 0.15);
    const segs: [number, number][] = [[hx + R * 0.05, hy - R * 0.12], [hx + R * 0.22, hy - R * 0.34], [hx + R * 0.4, hy - R * 0.48]];
    segs.forEach(([x, y], i) => {
      ctx.beginPath(); ctx.arc(x, y, wr * (i === 2 ? 1.1 : 0.95), 0, TAU);
      ctx.fillStyle = i === 2 ? '#f6d2a8' : '#e8b88a'; ctx.fill(); ctx.lineWidth = lw * 0.7; ctx.strokeStyle = ink; ctx.stroke();
    });
    const [ex, ey] = segs[2];
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(ex - wr * 0.3, ey - wr * 0.1, wr * 0.2, 0, TAU); ctx.arc(ex + wr * 0.35, ey - wr * 0.1, wr * 0.2, 0, TAU); ctx.fill();
  }

  // ---- 柄 + 叶 ----
  const sx0 = cx + d.skew * R * 0.66 * 0.9, sy0 = cy - R * d.ry * 0.62;
  const stemLen = Math.max(5, R * 0.62);
  const sx1 = sx0 + R * 0.14, sy1 = sy0 - stemLen;
  ctx.beginPath(); ctx.moveTo(sx0, sy0 + 1); ctx.quadraticCurveTo(sx0 - R * 0.04, sy0 - stemLen * 0.55, sx1, sy1);
  ctx.lineWidth = lw + 2.2; ctx.strokeStyle = ink; ctx.stroke();
  ctx.lineWidth = Math.max(1.5, lw * 0.55); ctx.strokeStyle = st === 'rotten' ? '#4a3420' : '#8a5a34'; ctx.stroke();
  if (d.id !== 'haitang' || true) {
    const lc = st === 'rotten' ? '#7a7a3a' : d.leaf ?? PAL.leaf;
    const lx = sx0 - R * 0.02, ly = sy0 - stemLen * 0.5;
    const L = Math.max(10, R * 0.95), W = L * 0.36;
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(-0.5);
    const leafP = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(L * 0.25, -W * 1.2, L * 0.75, -W * 0.95, L, -W * 0.08); ctx.bezierCurveTo(L * 0.75, W * 0.65, L * 0.25, W * 0.7, 0, 0); ctx.closePath(); };
    leafP(); ctx.fillStyle = lc; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = shade(lc, 0.72); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, -W * 0.08); ctx.lineTo(L, W * 2); ctx.lineTo(0, W * 2); ctx.fill();
    ctx.restore();
    leafP(); ctx.lineWidth = Math.max(1.6, lw * 0.75); ctx.strokeStyle = ink; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L * 0.08, 0); ctx.quadraticCurveTo(L * 0.5, -W * 0.18, L * 0.86, -W * 0.08); ctx.lineWidth = Math.max(0.9, lw * 0.35); ctx.strokeStyle = rgba('#d8f0a0', 0.9); ctx.stroke();
    ctx.restore();
  }

  // ---- 闪光星 ----
  if (st === 'shiny') {
    const spots: [number, number, number][] = [[cx - R * 0.95, cy - R * 0.85, 6.5], [cx + R * 0.95, cy - R * 0.2, 5], [cx + R * 0.1, cy + R * 0.95, 4]];
    for (const [x, y, rr] of spots) { star4(ctx, x, y, rr); ctx.fillStyle = '#fffbe0'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#e8a400'; ctx.stroke(); }
  }
}

export interface AppleOpts { kind?: AppleKind; state?: AppleState; size?: number; seed?: number; shadow?: boolean }

/** 落地/下落小动画辅助参数(0/undefined = 无)。appleSprite 第 5 参可传,默认按品种(见 appleFxFor)。
 *  glow=烘焙加强光晕(金);smoke=毒雾(动态,见 drawLandFx);fastFall=下落重力倍数(青);bounce=弹跳高度系数(红斑);
 *  quake=落地震屏强度(巨无霸);roll=落地后滚走速度系数(虫蛀)。 */
export interface AppleFx { glow?: boolean | string; fastFall?: number; bounce?: number; quake?: number; roll?: number; smoke?: boolean }
const KIND_FX: Partial<Record<string, AppleFx>> = {
  golden: { glow: true }, green: { fastFall: 1.9 }, spotted: { bounce: 1 }, giant: { quake: 1 }, wormy: { roll: 1 }, poison: { smoke: true },
};
/** 品种默认 fx */
export function appleFxFor(kind: AppleKind | string): AppleFx { return KIND_FX[kind] ?? {}; }

/** 预渲染的苹果 sprite。size=逻辑像素(32/48/64…)。锚点=苹果底部中心(接地点)。fx 不传=按品种默认(只有 glow 影响像素)。 */
export function appleSprite(kind: AppleKind | string = 'fuji', state: AppleState = 'fresh', size = 64, shadow = false, fx?: AppleFx): Baked {
  const d = BYID.get(kind as AppleKind) ?? BYID.get('fuji')!;
  const k = size / CELL;
  const lw = size <= 36 ? 3.6 : size <= 48 ? 3.1 : 2.8;
  const seed = 11 + (APPLE_KINDS.indexOf(d.id) + 1) * 37;
  const R = d.R, cy = GROUND - R * d.ry * 0.98;
  const f: AppleFx = { ...appleFxFor(d.id), ...(fx ?? {}) };
  const gcol = f.glow ? (typeof f.glow === 'string' ? f.glow : d.glow ?? '#ffe06a') : null;
  const fxKey = fx ? `|${gcol ?? ''}` : '';
  return bake(`apple|${d.id}|${state}|${size}|${shadow ? 1 : 0}${fxKey}`, size, size, (ctx) => {
    ctx.scale(k, k);
    if (shadow) { ell(ctx, CELL / 2 + 1.5, GROUND + 1.5, R * 0.95, R * 0.2); ctx.fillStyle = 'rgba(27,20,16,0.28)'; ctx.fill(); }
    if (fx && gcol) {
      const g = ctx.createRadialGradient(CELL / 2, cy, R * 0.6, CELL / 2, cy, CELL * 0.5);
      g.addColorStop(0, rgba(gcol, 0.7)); g.addColorStop(1, rgba(gcol, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, CELL, CELL);
    }
    paint(ctx, d, state, lw, seed);
  }, { ax: size / 2, ay: (GROUND + 1) * k, meta: { cx: size / 2, cy: cy * k, r: R * k, fx: f } as any });
}

export interface AppleLandFx {
  /** 相对落点的偏移/旋转/缩放(世界单位,y 向上为负);t=落地后秒数 */
  dx: number; dy: number; rot: number; sx: number; sy: number;
  /** 0..1 光晕脉冲(金) */ glow: number;
  /** 震屏振幅(世界单位,巨无霸,≤0.5s) */ shake: number;
  /** 毒雾强度 0..1 */ smoke: number;
  /** 尘土/冲击环 0..1 */ dust: number;
  /** 苹果是否仍可见(虫蛀滚出屏后淡出) */ alpha: number;
  /** 下落阶段重力倍数(青=快落) */ gravity: number;
}
/** 落地小动画:t=落地后经过秒数。给每个品种返回当帧偏移/形变/特效强度;其它品种=轻微一下压扁回弹。 */
export function appleLandFx(kind: AppleKind | string, t: number): AppleLandFx {
  const o: AppleLandFx = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, glow: 0, shake: 0, smoke: 0, dust: 0, alpha: 1, gravity: 1 };
  if (t < 0) return o;
  const f = appleFxFor(kind), sq = (a: number, dur: number) => { const u = t / dur; return u < 1 ? Math.sin(u * Math.PI) * Math.exp(-u * 1.6) * a : 0; };
  // 通用压扁
  const s0 = sq(0.16, 0.22); o.sx = 1 + s0; o.sy = 1 - s0;
  if (f.fastFall) { o.gravity = f.fastFall; o.dust = Math.max(0, 1 - t / 0.25) * 0.8; const s1 = sq(0.1, 0.12); o.sx = 1 + s1 * 0.4 + s0 * 0.5; o.sy = 1 - s1 * 0.5; }
  if (f.bounce) { // 红斑:三连弹,高度递减
    const H = [34, 16, 7], D = [0.46, 0.3, 0.2]; let u = t, i = 0;
    while (i < 3 && u > D[i]) { u -= D[i]; i++; }
    if (i < 3) { const q = u / D[i]; o.dy = -4 * H[i] * q * (1 - q); o.sx = 1; o.sy = 1; if (q < 0.14 || q > 0.86) { o.sx = 1.14; o.sy = 0.88; } }
  }
  if (f.quake) { o.shake = Math.max(0, 1 - t / 0.5) * 5 * f.quake * Math.sin(t * 60); o.dust = Math.max(0, 1 - t / 0.6); const q = sq(0.3, 0.3); o.sx = 1 + q; o.sy = 1 - q; }
  if (f.roll) { // 虫蛀:弹一下后滚走
    const u = Math.max(0, t - 0.15); o.dx = 72 * f.roll * (1 - Math.exp(-u * 2.2)); o.rot = o.dx / 17;
    o.alpha = t < 1.6 ? 1 : Math.max(0, 1 - (t - 1.6) / 0.5);
  }
  if (f.glow) o.glow = 0.55 + 0.45 * Math.sin(t * 5);
  if (f.smoke) o.smoke = Math.min(1, t / 0.2) * Math.max(0, 1 - Math.max(0, t - 1.6) / 0.8);
  return o;
}
/** 画落地的附加特效(尘环/光晕/毒雾);(x,y)=落点(苹果底部中心),s=缩放。苹果本体仍由调用方 drawApple/spr.draw 画。 */
export function drawLandFx(ctx: Ctx, kind: AppleKind | string, t: number, x: number, y: number, s = 1) {
  const f = appleFxFor(kind), o = appleLandFx(kind, t); if (t < 0) return;
  ctx.save();
  if (o.dust > 0.01) {
    const u = 1 - o.dust, R = (12 + u * 38) * s;
    ctx.strokeStyle = rgba('#fff6dc', o.dust * 0.8); ctx.lineWidth = 3 * s * o.dust + 1;
    ell(ctx, x, y - 2 * s, R, R * 0.22); ctx.stroke();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.4, px = x + Math.cos(a) * R * 0.9, py = y - 3 * s - Math.sin(a * 2) * 3 * s - u * 10 * s; ctx.beginPath(); ctx.arc(px, py, (2.5 + i % 2) * s * o.dust, 0, TAU); ctx.fillStyle = rgba('#e9dcc0', o.dust * 0.9); ctx.fill(); }
  }
  if (f.glow) { ctx.globalCompositeOperation = 'lighter'; const R = (26 + o.glow * 8) * s, g = ctx.createRadialGradient(x, y - 14 * s, 2, x, y - 14 * s, R); g.addColorStop(0, rgba('#ffe27a', 0.55 * o.glow)); g.addColorStop(1, rgba('#ffe27a', 0)); ctx.fillStyle = g; ctx.fillRect(x - R, y - 14 * s - R, R * 2, R * 2); }
  if (f.smoke && o.smoke > 0.01) {
    for (let i = 0; i < 6; i++) {
      const ph = (t * 0.7 + i / 6) % 1, wob = Math.sin(t * 2.2 + i * 1.7) * 6 * s, py = y - 12 * s - ph * 46 * s, r = (6 + ph * 9) * s;
      ctx.beginPath(); ctx.arc(x + wob + (i % 3 - 1) * 5 * s, py, r, 0, TAU);
      ctx.fillStyle = rgba(i % 2 ? '#8a8a96' : '#6f6f7c', (1 - ph) * 0.55 * o.smoke); ctx.fill();
    }
  }
  ctx.restore();
}

/** 把苹果的"体心"放到 (cx,cy) */
export function drawAppleAt(ctx: Ctx, spr: Baked, cx: number, cy: number, s = 1, alpha = 1) {
  const m = spr.meta!;
  spr.draw(ctx, cx - (m.cx - spr.ax) * s, cy - (m.cy - spr.ay) * s, s, alpha);
}

/** 统一签名:(x,y)=苹果底部中心,s=缩放(1 = 64 世界单位的精灵)。 */
export function drawApple(ctx: Ctx, x: number, y: number, s = 1, o: AppleOpts = {}) {
  const px = 64 * s;
  const size = o.size ?? (px <= 40 ? 32 : 64);
  const spr = appleSprite(o.kind ?? 'fuji', o.state ?? 'fresh', size, !!o.shadow);
  spr.draw(ctx, x, y, (64 / size) * s);
}

/** 工具:按"品相"给出推荐状态,方便 eng 使用 */
export function appleStateFor(opts: { wormy?: boolean; ripe?: boolean; shiny?: boolean; rotten?: boolean }): AppleState {
  return opts.rotten ? 'rotten' : opts.wormy ? 'wormy' : opts.shiny ? 'shiny' : opts.ripe ? 'ripe' : 'fresh';
}
export const _clamp = clamp;
