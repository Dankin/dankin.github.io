// 树 5 档(256×320 世界单位,锚点=树根落地点)。云朵状多层树冠 + 扭转树干/树根 + 草地 + 带高光的苹果。
// 静态时一次 drawImage;shake>0 时 冠/干/果 分件正弦形变(各自预渲染,逐帧只做 drawImage+变换)。
import { bake, Baked, Ctx, PAL, rng, mix, shade, rgba, ell, TAU, Circle, circlesPath, lerp } from './common';
import { appleSprite, drawAppleAt, AppleKind } from './apple';

export const TREE_W = 256, TREE_H = 320, TREE_GROUND = 300;
export type TreeTier = 1 | 2 | 3 | 4 | 5;
export const TREE_TIER_NAMES = ['树苗', '小树丛', '果园单树', '大果树', '巨树'] as const;

export interface TreeOpts {
  tier?: TreeTier; seed?: number;
  /** 0..1 摇动强度(0=静态单次 drawImage) */
  shake?: number; /** 秒;不传取 performance.now */ t?: number;
  /** 0..1 挂果比例 */ fruit?: number; /** 或直接给个数 */ apples?: number;
  kind?: AppleKind; ground?: boolean;
}

const TIERS = [
  { rx: 38, ry: 32, vis: 34, bw: 7, puffs: 6, slots: 5, as: 0.8 },
  { rx: 56, ry: 46, vis: 48, bw: 10, puffs: 10, slots: 9, as: 0.85 },
  { rx: 78, ry: 64, vis: 64, bw: 14, puffs: 15, slots: 14, as: 0.92 },
  { rx: 100, ry: 82, vis: 76, bw: 18, puffs: 22, slots: 20, as: 0.98 },
  { rx: 108, ry: 98, vis: 86, bw: 23, puffs: 30, slots: 28, as: 1.04 },
];

interface Puff { cs: Circle[]; cx: number; cy: number; r: number }
interface Spec {
  tier: number; cx: number; cy: number; rx: number; ry: number; pivotY: number; vis: number; bw: number;
  puffs: Puff[]; rim: Circle[]; leaves: { x: number; y: number; a: number; l: number }[];
  slots: { x: number; y: number; ph: number; k: number; kind: number }[]; as: number;
}
const specs = new Map<string, Spec>();
const G = TREE_GROUND, PX = TREE_W / 2;

function spec(tier: number, seed: number): Spec {
  const key = `${tier}|${seed}`; const hit = specs.get(key); if (hit) return hit;
  const T = TIERS[tier - 1], r = rng(seed * 101 + tier * 17);
  const B = G - T.vis, cy = B - 0.75 * T.ry, cx = PX;
  const pr = Math.max(7.5, T.rx * 0.2);
  // 在椭圆内均匀撒点(最佳候选法,任意前缀都均匀)
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
  // 外缘圆(保证轮廓成一圈云边,中间无洞)
  const rim: Circle[] = [];
  const nr = Math.max(7, Math.round((Math.PI * (T.rx + T.ry)) / (pr * 1.35)));
  for (let i = 0; i < nr; i++) {
    const a = (i / nr) * TAU + r() * 0.1, low = Math.sin(a) > 0;
    rim.push({ x: cx + Math.cos(a) * T.rx * 0.9, y: cy + Math.sin(a) * T.ry * (low ? 0.72 : 0.92), r: pr * (0.78 + r() * 0.3) });
  }
  // 边缘尖叶
  const leaves = [];
  const nl = Math.round(6 + tier * 4);
  for (let i = 0; i < nl; i++) {
    const a = r() * TAU; const low = Math.sin(a) > 0;
    const x = cx + Math.cos(a) * (T.rx * 1.0 + 4), y = cy + Math.sin(a) * (T.ry * (low ? 0.8 : 1.0) + 2);
    leaves.push({ x, y, a: a + (r() - 0.5) * 0.8, l: 9 + tier * 1.6 + r() * 4 });
  }
  const slots = pick(T.slots, 16, 0.86, 4).map((p) => ({ x: p.x, y: p.y, ph: r() * TAU, k: r(), kind: r() }));
  const s: Spec = { tier, cx, cy, rx: T.rx, ry: T.ry, pivotY: B - 10, vis: T.vis, bw: T.bw, puffs, rim, leaves, slots, as: T.as };
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
  // 不规则草地块:顶亮底暗,无描边(同参考图)
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
function drawTrunk(ctx: Ctx, sp: Spec, seed: number) {
  const r = rng(seed * 57 + sp.tier);
  const H = sp.vis + 22, bw = sp.bw, topW = bw * 0.52, ph = r() * TAU, amp = bw * 0.42;
  const N = 12, Lp: [number, number][] = [], Rp: [number, number][] = [], Cp: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, y = G - t * H;
    const x = PX + amp * Math.sin(t * Math.PI * 1.5 + ph) * (0.4 + t * 0.6);
    const w = topW + (bw - topW) * Math.pow(1 - t, 1.7) + bw * 0.55 * Math.pow(Math.max(0, 0.2 - t) / 0.2, 2);
    Lp.push([x - w, y]); Rp.push([x + w, y]); Cp.push([x, y]);
  }
  const base = Rp[0][0] - Lp[0][0];
  const outline: [number, number][] = [];
  for (let i = 0; i <= N; i++) outline.push(Lp[i]);
  for (let i = N; i >= 0; i--) outline.push(Rp[i]);
  // 根:右下 → 左下三道根瘤
  const cx0 = Cp[0][0];
  outline.push([cx0 + base * 0.62, G + 3], [cx0 + base * 0.3, G - 4], [cx0 + base * 0.1, G + 5], [cx0 - base * 0.22, G - 3], [cx0 - base * 0.55, G + 4]);

  // 分叉枝(画在树干下,先描边再上色)
  const top = Cp[N];
  const limbs: [number, number, number, number, number][] = [
    [top[0] - bw * 0.2, top[1] + 14, top[0] - sp.rx * 0.62, top[1] - sp.ry * 0.5, bw * 0.34],
    [top[0] + bw * 0.2, top[1] + 14, top[0] + sp.rx * 0.6, top[1] - sp.ry * 0.46, bw * 0.34],
    [top[0], top[1] + 10, top[0] + 3, top[1] - sp.ry * 0.7, bw * 0.3],
  ];
  const limbPath = (l: number[]) => { ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.quadraticCurveTo(l[0] + (l[2] - l[0]) * 0.15, l[3] + (l[1] - l[3]) * 0.55, l[2], l[3]); };
  for (const l of limbs) { limbPath(l); ctx.lineWidth = l[4] * 2 + 4; ctx.strokeStyle = PAL.ink; ctx.stroke(); }
  for (const l of limbs) { limbPath(l); ctx.lineWidth = l[4] * 2; ctx.strokeStyle = PAL.trunk; ctx.stroke(); }

  smooth(ctx, outline); ctx.lineWidth = 3.4; ctx.strokeStyle = PAL.ink; ctx.stroke();
  ctx.fillStyle = PAL.trunk; ctx.fill();
  ctx.save(); smooth(ctx, outline); ctx.clip();
  // 左亮带 / 右暗带
  const band = (f0: number, f1: number, col: string) => {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const x = lerp(Lp[i][0], Rp[i][0], f0); i ? ctx.lineTo(x, Lp[i][1]) : ctx.moveTo(x, Lp[i][1]); }
    for (let i = N; i >= 0; i--) ctx.lineTo(lerp(Lp[i][0], Rp[i][0], f1), Lp[i][1]);
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  };
  band(0.0, 0.34, PAL.trunkLight); band(0.66, 1.0, PAL.trunkDark);
  ctx.fillStyle = PAL.trunkDark; ctx.fillRect(0, G - 2, TREE_W, 8); // 根部落地暗影
  // 树皮纹
  ctx.strokeStyle = rgba('#3a200e', 0.8); ctx.lineWidth = Math.max(1.3, bw * 0.07);
  for (const f of [0.22, 0.42, 0.62, 0.82]) {
    let t = 0.06 + r() * 0.1;
    while (t < 0.9) {
      const len = 0.12 + r() * 0.25, t1 = Math.min(0.93, t + len);
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) { const tt = lerp(t, t1, i / 5), k = Math.round(tt * N), kk = Math.min(N, k); const x = lerp(Lp[kk][0], Rp[kk][0], f + Math.sin(tt * 9 + f * 7) * 0.05); const y = G - tt * H; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); t = t1 + 0.05 + r() * 0.12;
    }
  }
  ctx.restore();
  smooth(ctx, outline); ctx.lineWidth = 3.4; ctx.strokeStyle = PAL.ink; ctx.stroke();
  for (const l of limbs) { // 枝上亮线
    ctx.save(); ctx.translate(-l[4] * 0.3, -l[4] * 0.3); limbPath(l); ctx.lineWidth = Math.max(1.2, l[4] * 0.3); ctx.strokeStyle = rgba(PAL.trunkLight, 0.9); ctx.stroke(); ctx.restore();
  }
}

// ---------------- 树冠 ----------------
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

function drawCrown(ctx: Ctx, sp: Spec, seed: number) {
  const r = rng(seed * 91 + sp.tier * 5);
  const lwOut = sp.tier <= 2 ? 2.6 : 3.2;
  const dk = '#2f6a1c';
  // 边缘尖叶(在冠后)
  for (const l of sp.leaves) leafShape(ctx, l.x, l.y, l.a, l.l, PAL.leaf, PAL.leafDark, 1.7);
  // 底层:所有圆的并集 → 描粗边后填深绿 = 外轮廓
  const all: Circle[] = [...sp.rim, ...sp.puffs.flatMap((p) => p.cs)];
  circlesPath(ctx, all);
  ctx.lineWidth = lwOut * 2; ctx.strokeStyle = PAL.ink; ctx.stroke();
  ctx.fillStyle = PAL.leafDark; ctx.fill();
  ell(ctx, sp.cx, sp.cy, sp.rx * 0.85, sp.ry * 0.75); ctx.fillStyle = PAL.leafDark; ctx.fill();
  // 大块明暗:整体 dome 上亮下暗
  ctx.save(); circlesPath(ctx, all); ctx.clip();
  const g = ctx.createRadialGradient(sp.cx - sp.rx * 0.25, sp.cy - sp.ry * 0.45, sp.ry * 0.1, sp.cx, sp.cy, sp.rx * 1.05);
  g.addColorStop(0, '#6fb534'); g.addColorStop(0.6, '#4d9a2a'); g.addColorStop(1, '#2f6a1c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, TREE_W, TREE_H);
  ctx.restore();
  // 云团
  const lwIn = sp.tier <= 2 ? 1.5 : 1.9;
  sp.puffs.forEach((p, idx) => {
    const k = (p.cy - (sp.cy - sp.ry)) / (sp.ry * 1.75); // 0 顶 → 1 底
    const mid = mix('#7cc23c', '#4f9a2a', clamp01(k * 0.9)), lite = mix('#b4e05a', '#8ccc46', clamp01(k)), dark = mix('#3f8a22', '#2c6218', clamp01(k));
    // 描边(内部云团线)
    circlesPath(ctx, p.cs); ctx.lineWidth = lwIn * 2; ctx.strokeStyle = PAL.ink; ctx.stroke();
    ctx.fillStyle = dark; ctx.fill();
    ctx.save(); circlesPath(ctx, p.cs); ctx.clip();
    circlesPath(ctx, p.cs, -p.r * 0.1, -p.r * 0.13, 1); ctx.fillStyle = mid; ctx.fill();
    circlesPath(ctx, p.cs.map((c) => ({ x: p.cx + (c.x - p.cx) * 0.8, y: p.cy + (c.y - p.cy) * 0.8, r: c.r * 0.8 })), -p.r * 0.14, -p.r * 0.2, 1); ctx.fillStyle = lite; ctx.fill();
    ctx.restore();
    // 浅色弧形高光(沿上左缘)
    ctx.strokeStyle = 'rgba(236,250,176,0.95)'; ctx.lineWidth = sp.tier <= 2 ? 1.5 : 2.1;
    for (let i = 1; i < p.cs.length; i++) {
      const c = p.cs[i]; if (c.y > p.cy + p.r * 0.1) continue;
      const a0 = Math.PI * (1.05 + r() * 0.1), a1 = a0 + Math.PI * (0.38 + r() * 0.15);
      ctx.beginPath(); ctx.arc(c.x - 0.5, c.y - 0.5, c.r * 0.72, a0, a1); ctx.stroke();
    }
    // 云下缘"微笑"暗线
    ctx.strokeStyle = rgba(dk, 0.9); ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.arc(p.cx + p.r * 0.05, p.cy + p.r * 0.05, p.r * 0.48, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
    void idx;
  });
  // 树冠内零星叶
  const nl = Math.round(sp.tier * 3);
  for (let i = 0; i < nl; i++) {
    const a = r() * TAU, rr = Math.sqrt(r()) * 0.8;
    leafShape(ctx, sp.cx + Math.cos(a) * rr * sp.rx, sp.cy + Math.sin(a) * rr * sp.ry * 0.8, r() * TAU, 8 + sp.tier, PAL.leaf, PAL.leafDark, 1.4);
  }
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---------------- 分件缓存 ----------------
const KEY_ANCHOR = { ax: PX, ay: G };
function groundPart(sp: Spec, seed: number) {
  return bake(`tree-g|${sp.tier}|${seed}`, TREE_W, TREE_H, (c) => grassPatch(c, PX, G + 5, 34 + sp.rx * 0.95, seed), KEY_ANCHOR);
}
function trunkPart(sp: Spec, seed: number) { return bake(`tree-t|${sp.tier}|${seed}`, TREE_W, TREE_H, (c) => drawTrunk(c, sp, seed), KEY_ANCHOR); }
function crownPart(sp: Spec, seed: number) { return bake(`tree-c|${sp.tier}|${seed}`, TREE_W, TREE_H, (c) => drawCrown(c, sp, seed), KEY_ANCHOR); }

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
function appleScale(sp: Spec) { return sp.as; }

function drawStaticTree(ctx: Ctx, sp: Spec, seed: number, n: number, o: TreeOpts, withGround: boolean) {
  if (withGround) groundPart(sp, seed).draw(ctx, PX, G);
  trunkPart(sp, seed).draw(ctx, PX, G);
  crownPart(sp, seed).draw(ctx, PX, G);
  for (let i = 0; i < n; i++) { const s = sp.slots[i]; drawAppleAt(ctx, appleSprite(appleKind(sp, i, o), 'fresh', 32), s.x, s.y, appleScale(sp)); }
}

/** 统一签名:(x,y)=树根落地点,s=缩放(1 = 256×320 世界单位)。 */
export function drawTree(ctx: Ctx, x: number, y: number, s = 1, o: TreeOpts = {}) {
  const tier = (Math.max(1, Math.min(5, Math.round(o.tier ?? 3))) as TreeTier), seed = o.seed ?? 1;
  const sp = spec(tier, seed), n = fruitCount(sp, o), withGround = o.ground !== false;
  const shake = o.shake ?? 0;
  if (shake <= 0.002) {
    const kk = o.kind ?? '-', key = `tree|${tier}|${seed}|${n}|${kk}|${withGround ? 1 : 0}`;
    bake(key, TREE_W, TREE_H, (c) => drawStaticTree(c, sp, seed, n, o, withGround), KEY_ANCHOR).draw(ctx, x, y, s);
    return;
  }
  const t = o.t ?? performance.now() / 1000, W = 26;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-PX, -G);
  if (withGround) groundPart(sp, seed).draw(ctx, PX, G);
  // 树干:以根为轴整体剪切(越高位移越大)
  const kk = shake * 0.045 * Math.sin(t * W - 0.5);
  ctx.save(); ctx.translate(PX, G); ctx.transform(1, 0, kk, 1, 0, 0); trunkPart(sp, seed).draw(ctx, 0, 0); ctx.restore();
  // 冠:跟随树干顶端,再叠加自身相位的转动与上下挤压
  const topDx = kk * -(sp.vis + 12);
  const ang = shake * 0.05 * Math.sin(t * W - 1.2), sq = 1 + shake * 0.018 * Math.sin(t * W * 2 - 0.4);
  const px = PX + topDx, py = sp.pivotY;
  ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.scale(1 / sq, sq); ctx.translate(-PX, -py);
  crownPart(sp, seed).draw(ctx, PX, G);
  for (let i = 0; i < n; i++) {
    const a = sp.slots[i], ph = a.ph;
    const dx = shake * 2.6 * Math.sin(t * (W + 8) + ph), dy = shake * 2.2 * Math.abs(Math.sin(t * (W + 4) + ph * 1.3));
    drawAppleAt(ctx, appleSprite(appleKind(sp, i, o), 'fresh', 32), a.x + dx, a.y + dy, appleScale(sp));
  }
  ctx.restore();
  ctx.restore();
}

/** 取苹果在树上的世界坐标(相对树根锚点,s=1),用于从树上"摇落"苹果的起点 */
export function treeAppleSlots(tier: TreeTier, seed = 1, count?: number): { x: number; y: number }[] {
  const sp = spec(tier, seed);
  return sp.slots.slice(0, count ?? sp.slots.length).map((p) => ({ x: p.x - PX, y: p.y - G }));
}
export function treeCrown(tier: TreeTier, seed = 1) { const sp = spec(tier, seed); return { x: 0, y: sp.cy - G, rx: sp.rx, ry: sp.ry }; }

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
export const _shadeUnused = shade;
