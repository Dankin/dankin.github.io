// 树 5 档"原地进化":1 小树 → 2 老树(粗干/两大枝/木牌) → 3 巨树(软梯+树屋) → 4 云树(入云/吊篮+缆绳) → 5 星树(星星彩灯/苹果发光/夜里整棵亮)。
// 每档 2 个变体:variant 0=密植(枝多果小) / 1=粗壮(枝少果大)。高档保留低档所有部件。
// 画布按档位放大(见 treeDims);分件预渲染(地面/后云/树干+附件/树冠/前云),逐帧只做 drawImage + 变换。
// 锚点=树根落地点;世界单位 s=1。树的锚点 API 见 treeAnchors()。
import { bake, Baked, Ctx, PAL, rng, mix, shade, rgba, ell, TAU, Circle, circlesPath, lerp, clamp } from './common';
import { appleSprite, drawAppleAt, AppleKind } from './apple';
import { WOOD, drawSign, drawLadder, drawTreehouse, drawBasket, drawCable, cloudBank, drawTopStar, drawBulb, BULB_COLORS, HOUSE_W, HOUSE_H, HOUSE_ROOF } from './treeparts';

/** 兼容旧常量(= 1 档画布);各档真实尺寸用 treeDims(tier) */
export const TREE_W = 256, TREE_H = 320, TREE_GROUND = 300;
export type TreeTier = 1 | 2 | 3 | 4 | 5;
export type TreeVariant = 0 | 1;
export const TREE_TIER_NAMES = ['小树', '老树', '巨树', '云树', '星树'] as const;
export const TREE_VARIANT_NAMES = ['密植', '粗壮'] as const;

export interface TreeOpts {
  tier?: TreeTier; variant?: TreeVariant; seed?: number;
  /** 0..1 摇动强度(0=静态) */
  shake?: number; /** 秒;不传取 performance.now */ t?: number;
  /** 0..1 挂果比例 */ fruit?: number; /** 或直接给个数 */ apples?: number;
  /** 0..1 夜晚强度(true=1):树屋亮窗、星树整棵发光 */ night?: number | boolean;
  kind?: AppleKind; ground?: boolean;
}

/** 每档画布(世界单位)与落地点:根 = (W/2, G) */
const DIMS = [
  { W: 256, H: 320, G: 300 }, { W: 300, H: 360, G: 340 }, { W: 340, H: 430, G: 410 }, { W: 400, H: 560, G: 520 }, { W: 420, H: 580, G: 540 },
];
export function treeDims(tier: number) { const d = DIMS[clamp(Math.round(tier), 1, 5) - 1]; return { w: d.W, h: d.H, ground: d.G, px: d.W / 2 }; }
const TIERS = [
  { rx: 38, ry: 32, vis: 34, bw: 7, puffs: 6, slots: 5, as: 0.8 },
  { rx: 58, ry: 48, vis: 56, bw: 14, puffs: 10, slots: 9, as: 0.85 },
  { rx: 80, ry: 64, vis: 150, bw: 18, puffs: 15, slots: 14, as: 0.92 },
  { rx: 98, ry: 78, vis: 215, bw: 23, puffs: 22, slots: 20, as: 1.0 },
  { rx: 110, ry: 92, vis: 215, bw: 27, puffs: 30, slots: 28, as: 1.04 },
];
const VARS = [
  { rxk: 1.04, puffk: 1.4, prk: 0.82, slotk: 1.5, ask: 0.78, bwk: 0.9 },
  { rxk: 0.97, puffk: 0.78, prk: 1.22, slotk: 0.62, ask: 1.32, bwk: 1.2 },
];

interface Puff { cs: Circle[]; cx: number; cy: number; r: number }
interface Limb { h0: number; ex: number; ey: number; w0: number; w1: number; leaf?: boolean }
interface Spec {
  tier: number; variant: number; W: number; H: number; G: number; PX: number;
  cx: number; cy: number; rx: number; ry: number; pivotY: number; vis: number; bw: number; Ht: number; B: number;
  Cx: number[]; Hw: number[]; limbs: Limb[];
  puffs: Puff[]; rim: Circle[]; leaves: { x: number; y: number; a: number; l: number }[];
  slots: { x: number; y: number; ph: number; k: number; kind: number }[]; as: number;
  sign?: { ax: number; ay: number; k: number };
  house?: { hx: number; fy: number; ladderX: number };
  basket?: { tx: number; ty: number; cab: [number, number, number, number] };
  bulbs: { x: number; y: number; ci: number; ph: number }[];
  star?: { x: number; y: number; R: number };
}
const specs = new Map<string, Spec>();

function seg(a: number[], Ht: number, h: number) { const f = clamp(h / Ht, 0, 1) * (a.length - 1), i = Math.min(a.length - 2, f | 0); return lerp(a[i], a[i + 1], f - i); }
const ctrAt = (sp: Spec, h: number) => seg(sp.Cx, sp.Ht, h);
const hwAt = (sp: Spec, h: number) => seg(sp.Hw, sp.Ht, h);

function spec(tier: number, variant: number, seed: number): Spec {
  const key = `${tier}|${variant}|${seed}`; const hit = specs.get(key); if (hit) return hit;
  const D = DIMS[tier - 1], G = D.G, PX = D.W / 2, V = VARS[variant];
  const T0 = TIERS[tier - 1];
  const T = { rx: T0.rx * V.rxk, ry: T0.ry, vis: T0.vis, bw: T0.bw * V.bwk, puffs: Math.round(T0.puffs * V.puffk), slots: Math.max(3, Math.round(T0.slots * V.slotk)), as: T0.as * V.ask };
  const r = rng(seed * 101 + tier * 17 + variant * 1013);
  const B = G - T.vis, cy = B - 0.75 * T.ry, cx = PX;
  const pr = Math.max(7.5, T.rx * 0.2) * V.prk;
  // ---- 树干中线/半宽 ----
  const Ht = T.vis + 26, N = 16, bw = T.bw, topW = bw * 0.5;
  const ph = tier >= 3 ? 1.3 + variant * 1.7 : r() * TAU; // 3 档起相位固定:树屋/吊篮锚点与 seed 无关
  const amp = bw * (tier >= 3 ? 0.3 : 0.42);
  const Cx: number[] = [], Hw: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, h = t * Ht;
    Cx.push(PX + amp * Math.sin(t * Math.PI * 1.5 + ph) * (0.35 + t * 0.65));
    Hw.push(topW + (bw - topW) * Math.pow(1 - t, 1.6) + bw * 0.5 * Math.pow(Math.max(0, 1 - h / (bw * 2)), 2));
  }
  const sp0 = { Cx, Hw, Ht } as unknown as Spec;
  const cA = (h: number) => ctrAt(sp0, h), wA = (h: number) => hwAt(sp0, h);
  // ---- 在椭圆内均匀撒点 ----
  const pick = (n: number, k: number, ex = 0.92, minD = 0) => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      let best: { x: number; y: number } | null = null, bd = -1;
      for (let c = 0; c < k; c++) {
        const a = r() * TAU, rr = Math.sqrt(r()) * ex;
        const p = { x: cx + Math.cos(a) * rr * T.rx, y: cy + Math.sin(a) * rr * T.ry * (Math.sin(a) > 0 ? 0.78 : 1) };
        let d = 1e9; for (const q of pts) d = Math.min(d, Math.hypot(p.x - q.x, p.y - q.y));
        if (d > bd) { bd = d; best = p; }
      }
      if (best && bd >= minD) pts.push(best);
    }
    return pts;
  };
  const puffs: Puff[] = pick(T.puffs, 14, 0.9).map((p) => {
    const rr = pr * (0.85 + r() * 0.4), cs: Circle[] = [{ x: p.x, y: p.y, r: rr * 0.78 }];
    const n = 6; const a0 = r() * TAU;
    for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU + (r() - 0.5) * 0.4; cs.push({ x: p.x + Math.cos(a) * rr * 0.62, y: p.y + Math.sin(a) * rr * 0.6, r: rr * (0.46 + r() * 0.12) }); }
    return { cs, cx: p.x, cy: p.y, r: rr };
  }).sort((a, b) => a.cy - b.cy);
  const rim: Circle[] = [];
  const nr = Math.max(7, Math.round((Math.PI * (T.rx + T.ry)) / (pr * 1.35)));
  for (let i = 0; i < nr; i++) {
    const a = (i / nr) * TAU + r() * 0.1, low = Math.sin(a) > 0;
    rim.push({ x: cx + Math.cos(a) * T.rx * 0.9, y: cy + Math.sin(a) * T.ry * (low ? 0.72 : 0.92), r: pr * (0.78 + r() * 0.3) });
  }
  const leaves = [];
  const nl = Math.round(6 + tier * 4);
  for (let i = 0; i < nl; i++) {
    const a = r() * TAU, low = Math.sin(a) > 0;
    leaves.push({ x: cx + Math.cos(a) * (T.rx * 1.0 + 4), y: cy + Math.sin(a) * (T.ry * (low ? 0.8 : 1.0) + 2), a: a + (r() - 0.5) * 0.8, l: 9 + tier * 1.6 + r() * 4 });
  }
  const slots = pick(T.slots, 16, 0.86, variant ? 5 : 3.5).map((p) => ({ x: p.x, y: p.y, ph: r() * TAU, k: r(), kind: r() }));

  // ---- 枝 ----
  const limbs: Limb[] = [];
  const L = (h0: number, dx: number, up: number, w: number, leaf = false) => limbs.push({ h0, ex: PX + dx, ey: G - up, w0: w, w1: w * 0.5, leaf });
  const bigW = bw * (variant ? 0.52 : 0.36);
  if (tier === 1) {
    if (variant) { L(T.vis + 6, -T.rx * 0.5, T.vis + 10 + T.ry * 0.45, bw * 0.46); L(T.vis + 6, T.rx * 0.5, T.vis + 10 + T.ry * 0.5, bw * 0.46); }
    else { L(T.vis + 6, -T.rx * 0.62, T.vis + 10 + T.ry * 0.5, bw * 0.34); L(T.vis + 6, T.rx * 0.6, T.vis + 10 + T.ry * 0.46, bw * 0.34); L(T.vis + 8, 3, T.vis + 10 + T.ry * 0.7, bw * 0.3); }
  } else {
    L(T.vis * 0.72, -T.rx * 0.78, T.vis + T.ry * 0.3, bigW); L(T.vis * 0.72, T.rx * 0.78, T.vis + T.ry * 0.3, bigW);
    L(T.vis + 6, 3, T.vis + T.ry * 0.7, bw * 0.3);
    if (!variant) {
      L(T.vis * 0.9, -T.rx * 0.42, T.vis + T.ry * 0.75, bw * 0.15); L(T.vis * 0.9, T.rx * 0.42, T.vis + T.ry * 0.75, bw * 0.15);
      L(T.vis * 0.55, -T.rx * 1.02, T.vis + T.ry * 0.02, bw * 0.17, true);
      if (tier === 2) L(T.vis * 0.55, T.rx * 1.02, T.vis + T.ry * 0.02, bw * 0.17, true);
    } else {
      L(T.vis * 0.5, -T.rx * 0.95, T.vis * 0.9 + T.ry * 0.05, bw * 0.2, true);
    }
  }
  // 木牌小枝(2 档起)
  let sign: Spec['sign'];
  if (tier >= 2) {
    const h0 = 44, sx = cA(h0) - wA(h0), ex = sx - 22 - bw * 0.55, ey = G - h0 - 9;
    limbs.push({ h0, ex, ey, w0: Math.max(3.2, bw * 0.17), w1: Math.max(2.2, bw * 0.11) });
    sign = { ax: ex - 1, ay: ey + 0.5, k: tier === 2 ? 1 : 1.12 };
  }
  // 树屋(3 档起)
  let house: Spec['house'];
  if (tier >= 3) {
    const fyH = 60, hx = cA(fyH) + wA(fyH) + 40;
    house = { hx, fy: G - fyH, ladderX: hx - 8 };
  }
  // 吊篮(4 档起):挂在左侧枝梢,缆绳拉向树屋左檐
  let basket: Spec['basket'];
  if (tier >= 4) {
    const tx = PX - T.rx * 0.98, ty = G - T.vis + 34;
    limbs.push({ h0: T.vis * 0.8, ex: tx, ey: ty - 4, w0: bw * 0.38, w1: bw * 0.2 });
    const hh = house!;
    basket = { tx, ty, cab: [tx + 20, ty + 36, hh.hx - HOUSE_W / 2 - 9, hh.fy - HOUSE_H + 5] };
  }
  // 彩灯 + 星(5 档)
  const bulbs: Spec['bulbs'] = []; let star: Spec['star'];
  if (tier >= 5) {
    for (let j = 0; j < 3; j++) {
      const yj = cy + T.ry * (-0.32 + 0.3 * j), hw = T.rx * 0.9 * Math.sqrt(Math.max(0.05, 1 - Math.pow((yj - cy) / T.ry, 2))) * 0.95, sag = 14 + 4 * j;
      const n = Math.max(6, Math.round(hw / (variant ? 12.5 : 9.5)));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), d = t * t;
        bulbs.push({ x: a * (cx - hw) + b * cx + d * (cx + hw), y: a * yj + b * (yj + 2 * sag) + d * yj, ci: (i + j * 2 + seed) % BULB_COLORS.length, ph: r() * TAU });
      }
    }
    star = { x: cx, y: cy - T.ry - 22, R: variant ? 30 : 26 };
  }
  const s: Spec = {
    tier, variant, W: D.W, H: D.H, G, PX, cx, cy, rx: T.rx, ry: T.ry, pivotY: B - 10, vis: T.vis, bw, Ht, B, Cx, Hw, limbs, puffs, rim, leaves, slots, as: T.as,
    sign, house, basket, bulbs, star,
  };
  specs.set(key, s); return s;
}

// ---------------- 地面草地 ----------------
function grassTuft(ctx: Ctx, x: number, y: number, h: number, r: () => number) {
  const n = 3 + ((r() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const a = (i - (n - 1) / 2) * 0.45 + (r() - 0.5) * 0.2, L = h * (0.7 + r() * 0.5);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(-2.6, 0); ctx.quadraticCurveTo(-1.6, -L * 0.6, 0.6, -L); ctx.quadraticCurveTo(2.6, -L * 0.55, 2.8, 0); ctx.closePath();
    ctx.fillStyle = i % 2 ? PAL.leafLight : PAL.leaf; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = PAL.ink; ctx.stroke();
    ctx.restore();
  }
}
export function grassPatch(ctx: Ctx, cx: number, y: number, hw: number, seed: number) {
  const r = rng(seed * 31 + 7);
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, rr = 1 + (r() - 0.5) * 0.18;
    const px = cx + Math.cos(a) * hw * rr, py = y + Math.sin(a) * hw * 0.11 * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y - hw * 0.1, 0, y + hw * 0.1); g.addColorStop(0, PAL.grassLight); g.addColorStop(0.5, PAL.grass); g.addColorStop(1, PAL.grassDark);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = rgba(PAL.grassDark, 0.8); ctx.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) { const x = cx + (r() - 0.5) * hw * 1.5, yy = y + (r() - 0.3) * hw * 0.07; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + 6 + r() * 8, yy + 0.8); ctx.stroke(); }
  grassTuft(ctx, cx - hw * 0.72, y - 1, 11, r); grassTuft(ctx, cx + hw * 0.7, y - 2, 12, r); grassTuft(ctx, cx + hw * 0.28, y + hw * 0.07, 8, r);
}

// ---------------- 树干 ----------------
function smooth(ctx: Ctx, p: [number, number][], close = true) {
  const n = p.length; ctx.beginPath();
  const m = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const s = m(p[n - 1], p[0]); ctx.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) { const c = p[i], e = m(p[i], p[(i + 1) % n]); ctx.quadraticCurveTo(c[0], c[1], e[0], e[1]); }
  if (close) ctx.closePath();
}
function leafShape(ctx: Ctx, x: number, y: number, a: number, L: number, c1: string, c2: string, lw = 1.8) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  const W = L * 0.34;
  const p = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(L * 0.25, -W * 1.3, L * 0.75, -W * 1.0, L, 0); ctx.bezierCurveTo(L * 0.75, W * 1.0, L * 0.25, W * 1.3, 0, 0); ctx.closePath(); };
  p(); ctx.fillStyle = c1; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = c2; ctx.fillRect(0, 0, L, W * 2); ctx.restore();
  p(); ctx.lineWidth = lw; ctx.strokeStyle = PAL.ink; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L * 0.08, 0); ctx.lineTo(L * 0.8, 0); ctx.lineWidth = 0.9; ctx.strokeStyle = rgba('#d8f0a0', 0.9); ctx.stroke();
  ctx.restore();
}
/** 渐细的枝(二次曲线,先向外再向上),描边+填色+亮线 */
function limbShape(ctx: Ctx, sx: number, sy: number, ex: number, ey: number, w0: number, w1: number) {
  const qx = sx + (ex - sx) * 0.62, qy = sy + (ey - sy) * 0.18, N = 10;
  const Lp: [number, number][] = [], Rp: [number, number][] = [], Mp: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), d = t * t;
    const px = a * sx + b * qx + d * ex, py = a * sy + b * qy + d * ey;
    let dx = 2 * (1 - t) * (qx - sx) + 2 * t * (ex - qx), dy = 2 * (1 - t) * (qy - sy) + 2 * t * (ey - qy);
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = lerp(w0, w1, t);
    Lp.push([px + dy * w, py - dx * w]); Rp.push([px - dy * w, py + dx * w]); Mp.push([px + dy * w * 0.45, py - dx * w * 0.45]);
  }
  ctx.beginPath(); Lp.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); for (let i = N; i >= 0; i--) ctx.lineTo(Rp[i][0], Rp[i][1]); ctx.closePath();
  ctx.lineJoin = 'round'; ctx.lineWidth = 3.4; ctx.strokeStyle = PAL.ink; ctx.stroke(); ctx.fillStyle = PAL.trunk; ctx.fill();
  ctx.beginPath(); Mp.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineWidth = Math.max(1.2, w0 * 0.34); ctx.lineCap = 'round'; ctx.strokeStyle = rgba(PAL.trunkLight, 0.9); ctx.stroke();
}

function drawTrunkLayer(ctx: Ctx, sp: Spec, seed: number) {
  const r = rng(seed * 57 + sp.tier + sp.variant * 7), G = sp.G, bw = sp.bw, Ht = sp.Ht, N = sp.Cx.length - 1;
  const Lp: [number, number][] = [], Rp: [number, number][] = [];
  for (let i = 0; i <= N; i++) { const y = G - (i / N) * Ht; Lp.push([sp.Cx[i] - sp.Hw[i], y]); Rp.push([sp.Cx[i] + sp.Hw[i], y]); }
  const base = Rp[0][0] - Lp[0][0], cx0 = sp.Cx[0];
  const outline: [number, number][] = [];
  for (let i = 0; i <= N; i++) outline.push(Lp[i]);
  for (let i = N; i >= 0; i--) outline.push(Rp[i]);
  outline.push([cx0 + base * 0.62, G + 3], [cx0 + base * 0.3, G - 4], [cx0 + base * 0.1, G + 5], [cx0 - base * 0.22, G - 3], [cx0 - base * 0.55, G + 4]);
  // 枝(在树干下)
  for (const l of sp.limbs) {
    limbShape(ctx, ctrAt(sp, l.h0), G - l.h0, l.ex, l.ey, l.w0, l.w1);
    if (l.leaf) { leafShape(ctx, l.ex, l.ey, -0.6 + (l.ex < sp.PX ? Math.PI + 1.2 : 0), 13, PAL.leaf, PAL.leafDark, 1.6); }
  }
  // 树屋支撑/平台在干前,先放树干
  smooth(ctx, outline); ctx.lineWidth = 3.4; ctx.strokeStyle = PAL.ink; ctx.stroke();
  ctx.fillStyle = PAL.trunk; ctx.fill();
  ctx.save(); smooth(ctx, outline); ctx.clip();
  const band = (f0: number, f1: number, col: string) => {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const x = lerp(Lp[i][0], Rp[i][0], f0); i ? ctx.lineTo(x, Lp[i][1]) : ctx.moveTo(x, Lp[i][1]); }
    for (let i = N; i >= 0; i--) ctx.lineTo(lerp(Lp[i][0], Rp[i][0], f1), Lp[i][1]);
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  };
  band(0.0, 0.34, PAL.trunkLight); band(0.66, 1.0, PAL.trunkDark);
  ctx.fillStyle = PAL.trunkDark; ctx.fillRect(0, G - 2, sp.W, 8);
  ctx.strokeStyle = rgba('#3a200e', 0.8); ctx.lineWidth = Math.max(1.3, bw * 0.07);
  for (const f of [0.22, 0.42, 0.62, 0.82]) {
    let t = 0.04 + r() * 0.06;
    while (t < 0.9) {
      const len = (0.12 + r() * 0.25) * (sp.tier >= 3 ? 0.55 : 1), t1 = Math.min(0.93, t + len);
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) { const tt = lerp(t, t1, i / 5), kk = Math.min(N, Math.round(tt * N)); const x = lerp(Lp[kk][0], Rp[kk][0], f + Math.sin(tt * 9 + f * 7) * 0.05); const y = G - tt * Ht; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); t = t1 + 0.04 + r() * 0.1;
    }
  }
  ctx.restore();
  smooth(ctx, outline); ctx.lineWidth = 3.4; ctx.strokeStyle = PAL.ink; ctx.stroke();

  // ---- 附件 ----
  if (sp.sign) drawSign(ctx, sp.sign.ax, sp.sign.ay, sp.sign.k, sp.variant + 1);
  if (sp.house) {
    drawTreehouse(ctx, sp.house.hx, sp.house.fy, ctrAt(sp, G - sp.house.fy), sp.variant, seed);
    drawLadder(ctx, sp.house.ladderX, sp.house.fy + 8, G - 1, seed, 4);
  }
  if (sp.basket) {
    const b = sp.basket;
    drawCable(ctx, b.cab[0], b.cab[1], b.cab[2], b.cab[3], 12, sp.variant, true);
    drawBasket(ctx, b.tx, b.ty, sp.variant, seed);
  }
}

// ---------------- 树冠 ----------------
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
function drawCrown(ctx: Ctx, sp: Spec, seed: number) {
  const r = rng(seed * 91 + sp.tier * 5 + sp.variant);
  const lwOut = sp.tier <= 2 ? 2.6 : 3.2, dk = '#2f6a1c';
  for (const l of sp.leaves) leafShape(ctx, l.x, l.y, l.a, l.l, PAL.leaf, PAL.leafDark, 1.7);
  const all: Circle[] = [...sp.rim, ...sp.puffs.flatMap((p) => p.cs)];
  circlesPath(ctx, all);
  ctx.lineWidth = lwOut * 2; ctx.strokeStyle = PAL.ink; ctx.stroke();
  ctx.fillStyle = PAL.leafDark; ctx.fill();
  ell(ctx, sp.cx, sp.cy, sp.rx * 0.85, sp.ry * 0.75); ctx.fillStyle = PAL.leafDark; ctx.fill();
  ctx.save(); circlesPath(ctx, all); ctx.clip();
  const g = ctx.createRadialGradient(sp.cx - sp.rx * 0.25, sp.cy - sp.ry * 0.45, sp.ry * 0.1, sp.cx, sp.cy, sp.rx * 1.05);
  g.addColorStop(0, '#6fb534'); g.addColorStop(0.6, '#4d9a2a'); g.addColorStop(1, '#2f6a1c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, sp.W, sp.H);
  ctx.restore();
  const lwIn = sp.tier <= 2 ? 1.5 : 1.9;
  sp.puffs.forEach((p) => {
    const k = (p.cy - (sp.cy - sp.ry)) / (sp.ry * 1.75);
    const mid = mix('#7cc23c', '#4f9a2a', clamp01(k * 0.9)), lite = mix('#b4e05a', '#8ccc46', clamp01(k)), dark = mix('#3f8a22', '#2c6218', clamp01(k));
    circlesPath(ctx, p.cs); ctx.lineWidth = lwIn * 2; ctx.strokeStyle = PAL.ink; ctx.stroke();
    ctx.fillStyle = dark; ctx.fill();
    ctx.save(); circlesPath(ctx, p.cs); ctx.clip();
    circlesPath(ctx, p.cs, -p.r * 0.1, -p.r * 0.13, 1); ctx.fillStyle = mid; ctx.fill();
    circlesPath(ctx, p.cs.map((c) => ({ x: p.cx + (c.x - p.cx) * 0.8, y: p.cy + (c.y - p.cy) * 0.8, r: c.r * 0.8 })), -p.r * 0.14, -p.r * 0.2, 1); ctx.fillStyle = lite; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(236,250,176,0.95)'; ctx.lineWidth = sp.tier <= 2 ? 1.5 : 2.1;
    for (let i = 1; i < p.cs.length; i++) {
      const c = p.cs[i]; if (c.y > p.cy + p.r * 0.1) continue;
      const a0 = Math.PI * (1.05 + r() * 0.1), a1 = a0 + Math.PI * (0.38 + r() * 0.15);
      ctx.beginPath(); ctx.arc(c.x - 0.5, c.y - 0.5, c.r * 0.72, a0, a1); ctx.stroke();
    }
    ctx.strokeStyle = rgba(dk, 0.9); ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.arc(p.cx + p.r * 0.05, p.cy + p.r * 0.05, p.r * 0.48, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
  });
  const nl = Math.round(sp.tier * 3);
  for (let i = 0; i < nl; i++) {
    const a = r() * TAU, rr = Math.sqrt(r()) * 0.8;
    leafShape(ctx, sp.cx + Math.cos(a) * rr * sp.rx, sp.cy + Math.sin(a) * rr * sp.ry * 0.8, r() * TAU, 8 + sp.tier, PAL.leaf, PAL.leafDark, 1.4);
  }
  // 5 档:灯串(电线+灯泡)+ 树顶星
  if (sp.tier >= 5) {
    ctx.strokeStyle = '#22361a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    const rows = new Map<number, typeof sp.bulbs>();
    sp.bulbs.forEach((b, i) => { const j = (i / (sp.bulbs.length / 3)) | 0; (rows.get(j) ?? rows.set(j, []).get(j)!).push(b); });
    for (const row of rows.values()) { ctx.beginPath(); row.forEach((b, i) => (i ? ctx.lineTo(b.x, b.y - 4) : ctx.moveTo(b.x, b.y - 4))); ctx.stroke(); }
    for (const b of sp.bulbs) drawBulb(ctx, b.x, b.y, BULB_COLORS[b.ci], sp.variant ? 4.4 : 3.6);
  }
  if (sp.star) drawTopStar(ctx, sp.star.x, sp.star.y, sp.star.R);
}

// ---------------- 云(4 档起) ----------------
function drawCloudsBack(ctx: Ctx, sp: Spec) {
  const { cx, cy, rx, ry } = sp, sd = sp.tier * 3 + sp.variant;
  cloudBank(ctx, cx + rx * 0.05, cy - ry * 0.82, rx * 2.1, ry * 0.95, sd);
  cloudBank(ctx, cx - rx * 1.12, cy + ry * 0.02, rx * 1.0, ry * 0.8, sd + 1);
  cloudBank(ctx, cx + rx * 1.08, cy - ry * 0.35, rx * 1.0, ry * 0.75, sd + 2);
}
function drawCloudsFront(ctx: Ctx, sp: Spec) {
  const { cx, cy, rx, ry } = sp, sd = sp.tier * 3 + sp.variant;
  cloudBank(ctx, cx, cy + ry * 0.8, rx * 2.4, ry * 0.58, sd + 3);
  cloudBank(ctx, cx - rx * 0.78, cy - ry * 0.74, rx * 0.62, ry * 0.36, sd + 4);
  cloudBank(ctx, cx + rx * 0.92, cy - ry * 0.52, rx * 0.6, ry * 0.34, sd + 5);
}

// ---------------- 分件缓存 ----------------
function part(sp: Spec, name: string, seed: number, x0: number, y0: number, w: number, h: number, fn: (c: Ctx) => void): Baked {
  return bake(`tree2|${name}|${sp.tier}|${sp.variant}|${seed}`, w, h, (c) => { c.translate(-x0, -y0); fn(c); }, { ax: sp.PX - x0, ay: sp.G - y0 });
}
function groundPart(sp: Spec, seed: number) {
  return part(sp, 'g', seed, 0, sp.G - 26, sp.W, 56, (c) => grassPatch(c, sp.PX, sp.G + 5, 34 + sp.rx * 0.95, seed));
}
function trunkPart(sp: Spec, seed: number) {
  const y0 = Math.max(0, Math.floor(sp.G - sp.vis - sp.ry * 0.8 - 10)), y1 = Math.min(sp.H, sp.G + 12);
  return part(sp, 't', seed, 0, y0, sp.W, y1 - y0, (c) => drawTrunkLayer(c, sp, seed));
}
function crownRegion(sp: Spec) {
  const y0 = Math.max(0, Math.floor(sp.cy - sp.ry * (sp.tier >= 4 ? 1.55 : 1.25) - (sp.tier >= 5 ? 60 : 24))), y1 = Math.min(sp.H, Math.ceil(sp.cy + sp.ry + 50));
  return { y0, h: y1 - y0 };
}
function crownPart(sp: Spec, seed: number) { const R = crownRegion(sp); return part(sp, 'c', seed, 0, R.y0, sp.W, R.h, (c) => drawCrown(c, sp, seed)); }
function cloudPart(sp: Spec, seed: number, front: boolean) {
  const R = crownRegion(sp);
  return part(sp, front ? 'cf' : 'cb', seed, 0, R.y0, sp.W, R.h, (c) => (front ? drawCloudsFront(c, sp) : drawCloudsBack(c, sp)));
}

function appleKind(sp: Spec, i: number, o: TreeOpts): AppleKind {
  if (o.kind) return o.kind;
  if (sp.tier >= 5 && sp.slots[i].kind > 0.9) return 'golden';
  if (sp.tier >= 4 && sp.slots[i].kind < 0.06) return 'delicious';
  return 'fuji';
}
function fruitCount(sp: Spec, o: TreeOpts) {
  const n = o.apples ?? Math.round((o.fruit ?? 1) * sp.slots.length);
  return Math.max(0, Math.min(sp.slots.length, Math.round(n)));
}
function drawSlotApple(ctx: Ctx, kind: AppleKind, x: number, y: number, sc: number) {
  if (sc >= 1.05) drawAppleAt(ctx, appleSprite(kind, 'fresh', 48), x, y, (sc * 32) / 48);
  else drawAppleAt(ctx, appleSprite(kind, 'fresh', 32), x, y, sc);
}
function glowSprite(col: string): Baked {
  return bake(`glow|${col}`, 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, rgba(col, 1)); g.addColorStop(0.25, rgba(col, 0.55)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  }, { ax: 32, ay: 32 });
}

// ---------------- 绘制 ----------------
function drawStaticTree(ctx: Ctx, sp: Spec, seed: number, n: number, o: TreeOpts, withGround: boolean) {
  if (withGround) groundPart(sp, seed).draw(ctx, sp.PX, sp.G);
  trunkPart(sp, seed).draw(ctx, sp.PX, sp.G);
  crownPart(sp, seed).draw(ctx, sp.PX, sp.G);
  for (let i = 0; i < n; i++) { const s = sp.slots[i]; drawSlotApple(ctx, appleKind(sp, i, o), s.x, s.y, sp.as); }
}

/** 夜灯:树屋暖光(树干空间,(0,0)=树根) */
function houseGlow(ctx: Ctx, sp: Spec, night: number) {
  const h = sp.house!, x = h.hx - sp.PX, y = h.fy - sp.G;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const rg = ctx.createLinearGradient(0, y - HOUSE_H, 0, y);
  rg.addColorStop(0, rgba('#ffd27a', 0.55 * night)); rg.addColorStop(1, rgba('#ff9a3c', 0.25 * night));
  ctx.fillStyle = rg; ctx.fillRect(x - HOUSE_W / 2, y - HOUSE_H, HOUSE_W, HOUSE_H);
  const gs = glowSprite('#ffc65a');
  gs.draw(ctx, x, y - HOUSE_H * 0.5, 2.3, 0.5 * night);
  gs.draw(ctx, x, y - HOUSE_H - 9, 0.7, 0.9 * night);
  ctx.restore();
  void HOUSE_ROOF;
}
/** 星树彩灯/苹果光/星光/整树光晕(树冠空间) */
function lightsFx(ctx: Ctx, sp: Spec, t: number, night: number, pos: { x: number; y: number }[]) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const a0 = 0.16 + 0.84 * night;
  // 整树暖光
  const aura = glowSprite('#ffd070');
  aura.draw(ctx, sp.cx, sp.cy, (sp.rx * 2.4) / 32, (0.04 + 0.2 * night));
  // 彩灯
  for (const b of sp.bulbs) {
    const tw = 0.62 + 0.38 * Math.sin(t * 3.2 + b.ph);
    glowSprite(BULB_COLORS[b.ci]).draw(ctx, b.x, b.y, (sp.variant ? 10 : 8.5) / 32 * (0.85 + 0.25 * tw), a0 * (0.4 + 0.4 * tw));
  }
  // 苹果发光
  const hs = glowSprite('#ffe27a');
  for (const p of pos) hs.draw(ctx, p.x, p.y, (10 * sp.as + 4) / 32, 0.1 + 0.3 * night);
  // 星
  if (sp.star) {
    const st = sp.star, pul = 0.85 + 0.15 * Math.sin(t * 2.4);
    glowSprite('#fff0a0').draw(ctx, st.x, st.y, (st.R * (2.2 + 1.0 * night)) / 32 * pul, 0.35 + 0.4 * night);
    ctx.fillStyle = rgba('#fffbe0', 0.5 + 0.4 * night);
    for (const a of [0, Math.PI / 2]) { ell(ctx, st.x, st.y, st.R * 1.9 * pul, st.R * 0.09, a + Math.sin(t * 0.7) * 0.15); ctx.fill(); }
  }
  ctx.restore();
}

/** 统一签名:(x,y)=树根落地点,s=缩放(1 = 世界单位,各档尺寸见 treeDims)。 */
export function drawTree(ctx: Ctx, x: number, y: number, s = 1, o: TreeOpts = {}) {
  const tier = (Math.max(1, Math.min(5, Math.round(o.tier ?? 3))) as TreeTier), seed = o.seed ?? 1, variant = o.variant ? 1 : 0;
  const sp = spec(tier, variant, seed), n = fruitCount(sp, o), withGround = o.ground !== false;
  const shake = o.shake ?? 0, night = o.night === true ? 1 : o.night ? clamp(o.night as number) : 0;
  const dyn = shake > 0.002 || tier >= 4 || night > 0;
  const { PX, G } = sp;
  if (!dyn) {
    const key = `tree2|${tier}|${variant}|${seed}|${n}|${o.kind ?? '-'}|${withGround ? 1 : 0}`;
    bake(key, sp.W, sp.H, (c) => drawStaticTree(c, sp, seed, n, o, withGround), { ax: PX, ay: G }).draw(ctx, x, y, s);
    return;
  }
  const t = o.t ?? performance.now() / 1000, W = 26, sk = shake > 0.002;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-PX, -G);
  if (withGround) groundPart(sp, seed).draw(ctx, PX, G);
  if (tier >= 4) { ctx.save(); ctx.translate(Math.sin(t * 0.35) * 2.5, 0); cloudPart(sp, seed, false).draw(ctx, PX, G); ctx.restore(); }
  const amp = 0.045 * Math.pow(90 / (sp.vis + 40), 0.6);
  const kk = sk ? shake * amp * Math.sin(t * W - 0.5) : 0;
  ctx.save(); ctx.translate(PX, G); ctx.transform(1, 0, kk, 1, 0, 0); trunkPart(sp, seed).draw(ctx, 0, 0);
  if (night > 0.01 && sp.house) houseGlow(ctx, sp, night);
  ctx.restore();
  const topDx = kk * -(sp.vis + 12);
  const ang = sk ? shake * 0.05 * Math.sin(t * W - 1.2) : 0, sq = sk ? 1 + shake * 0.018 * Math.sin(t * W * 2 - 0.4) : 1;
  const px = PX + topDx, py = sp.pivotY;
  ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.scale(1 / sq, sq); ctx.translate(-PX, -py);
  crownPart(sp, seed).draw(ctx, PX, G);
  const pos: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = sp.slots[i], ph = a.ph;
    const dx = sk ? shake * 2.6 * Math.sin(t * (W + 8) + ph) : 0, dy = sk ? shake * 2.2 * Math.abs(Math.sin(t * (W + 4) + ph * 1.3)) : 0;
    drawSlotApple(ctx, appleKind(sp, i, o), a.x + dx, a.y + dy, sp.as); pos.push({ x: a.x + dx, y: a.y + dy });
  }
  if (tier >= 5) lightsFx(ctx, sp, t, night, pos);
  ctx.restore();
  if (tier >= 4) { ctx.save(); ctx.translate(Math.sin(t * 0.28 + 1) * 3, Math.sin(t * 0.5) * 1.2); cloudPart(sp, seed, true).draw(ctx, PX, G); ctx.restore(); }
  ctx.restore();
}

/** 取苹果在树上的坐标(相对树根锚点,s=1),用于从树上"摇落"苹果的起点 */
export function treeAppleSlots(tier: TreeTier, seed = 1, count?: number, variant: TreeVariant = 0): { x: number; y: number }[] {
  const sp = spec(tier, variant, seed);
  return sp.slots.slice(0, count ?? sp.slots.length).map((p) => ({ x: p.x - sp.PX, y: p.y - sp.G }));
}
export function treeCrown(tier: TreeTier, seed = 1, variant: TreeVariant = 0) { const sp = spec(tier, variant, seed); return { x: 0, y: sp.cy - sp.G, rx: sp.rx, ry: sp.ry }; }

export interface TreeAnchors {
  /** 树屋地板中心(老徐脚点);3 档起 */ treehouse: { x: number; y: number; w: number; h: number } | null;
  /** 吊篮篮底中心(老徐脚点);4 档起。rim=篮口中心 */ basket: { x: number; y: number; rim: { x: number; y: number } } | null;
  /** 树冠顶可站/挂点(彩灯下);5 档(其余档给树冠顶) */ top: { x: number; y: number };
  /** 树顶星位置;5 档 */ star: { x: number; y: number } | null;
  /** 苹果全部挂点 */ apples: { x: number; y: number }[];
  /** 树冠摇晃转轴(相对树根);树干剪切轴 = (0,0) */ shakePivot: { x: number; y: number };
  /** 冠部包围椭圆 */ crown: { x: number; y: number; rx: number; ry: number };
  /** 整树高度(根到最高点,含星/云) */ height: number;
}
/** 全部锚点:相对树根底部中心,单位 = s=1 世界单位(y 向下为正,故树上点 y<0)。tier 1..5。 */
export function treeAnchors(tier: number, variant: number = 0, seed = 1, s = 1): TreeAnchors {
  const tt = clamp(Math.round(tier), 1, 5) as TreeTier, sp = spec(tt, variant ? 1 : 0, seed), k = s;
  const P = (x: number, y: number) => ({ x: (x - sp.PX) * k, y: (y - sp.G) * k });
  const h = sp.house, b = sp.basket;
  const topY = sp.star ? sp.star.y - sp.star.R : sp.cy - sp.ry;
  return {
    treehouse: h ? { ...P(h.hx, h.fy), w: HOUSE_W * k, h: HOUSE_H * k } : null,
    basket: b ? { ...P(b.tx, b.ty + 36 + 27), rim: P(b.tx, b.ty + 36) } : null,
    top: P(sp.cx, sp.cy - sp.ry * 0.9),
    star: sp.star ? P(sp.star.x, sp.star.y) : null,
    apples: sp.slots.map((p) => P(p.x, p.y)),
    shakePivot: P(sp.PX, sp.pivotY),
    crown: { x: 0, y: (sp.cy - sp.G) * k, rx: sp.rx * k, ry: sp.ry * k },
    height: (sp.G - topY + 6) * k,
  };
}
/** art-things 用的精简形态:tierIdx 0..4(=tier-1),只返回该档有的点。 */
export function treeAnchorsIdx(tierIdx: number, s = 1, variant: number = 0, seed = 1): { treehouse?: { x: number; y: number }; basket?: { x: number; y: number }; top?: { x: number; y: number } } {
  const a = treeAnchors(tierIdx + 1, variant, seed, s), o: { treehouse?: { x: number; y: number }; basket?: { x: number; y: number }; top?: { x: number; y: number } } = {};
  if (a.treehouse) o.treehouse = { x: a.treehouse.x, y: a.treehouse.y };
  if (a.basket) o.basket = { x: a.basket.x, y: a.basket.y };
  if (tierIdx >= 4) o.top = a.top;
  return o;
}

// ---------------- 落叶粒子 ----------------
export interface LeafP { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; max: number; ph: number; c: number }
let leafSeed = 1;
export function spawnLeaves(out: LeafP[], x: number, y: number, n = 10, spread = 80, cap = 40) {
  const r = rng(leafSeed += 7);
  for (let i = 0; i < n && out.length < cap; i++) {
    out.push({ x: x + (r() - 0.5) * spread * 2, y: y + (r() - 0.5) * spread * 0.6, vx: (r() - 0.5) * 30, vy: 10 + r() * 20, rot: r() * TAU, vr: (r() - 0.5) * 6, life: 0, max: 1.4 + r() * 1.2, ph: r() * TAU, c: (r() * 3) | 0 });
  }
}
export function stepLeaves(a: LeafP[], dt: number) {
  for (let i = a.length - 1; i >= 0; i--) {
    const p = a[i]; p.life += dt;
    if (p.life >= p.max) { a.splice(i, 1); continue; }
    p.vy = Math.min(70, p.vy + 40 * dt);
    p.x += (p.vx + Math.sin(p.life * 5 + p.ph) * 26) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
  }
}
const LEAF_C: [string, string][] = [[PAL.leaf, PAL.leafDark], [PAL.leafLight, PAL.leaf], ['#c9d84a', '#8aa22a']];
function leafSprite(c: number): Baked { return bake(`leaf|${c}`, 24, 16, (ctx) => leafShape(ctx, 3, 8, 0, 18, LEAF_C[c][0], LEAF_C[c][1], 1.6), { ax: 12, ay: 8 }); }
export function drawLeaves(ctx: Ctx, a: LeafP[], s = 1) {
  for (const p of a) {
    const al = Math.min(1, (p.max - p.life) / 0.4);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha *= al;
    leafSprite(p.c).draw(ctx, 0, 0, s); ctx.restore();
  }
}
export const _shadeUnused = [shade, WOOD];
