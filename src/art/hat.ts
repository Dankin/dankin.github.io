/**
 * 圣诞帽纹理（art-char）。键约定（详见 docs/art-assets.md）：
 *   hat_0 … hat_5            六个阶段（朴素旧帽 → 白边 → 绒球 → 金线 → 圆满带光 → 铃铛）；hat_6 = hat_5 别名（终章先用帽，再换 c_santa_*）
 *   hat_<n>_blink / _happy / _worry   同阶段的表情变体（眨眼 / 开心 / 担心）
 *   aura_ring    附身时脚下的金色光圈（椭圆，等距透视压扁）
 *   aura_glow    柔光团（附身 / 阶段 4+ 的光晕）
 *   trail_dot / trail_star / trail_swirl   飞行拖尾粒子
 * 画布 = 38×26 设计单位 × HS(=60/28) ≈ 81×56 位图（SS=3）；origin 建议 (0.5, 0.83)（帽檐中线在 y≈21.6/26），显示缩放用 ART_SCALE。
 */
import { mkc, paint as paint0, blob as blob0, stroke as stroke0, dot, dark, light, rgba, INK, rng, grain, halo, Pt, Ctx } from './char/ink';

/** 帽子按 28×24 的设计坐标绘制，整体放大 HS 倍到旧 20×16 像素 ×SS 的尺寸；线宽反向缩放以保持与角色一致的笔触 */
const HS = 60 / 28;
type PO = Parameters<typeof paint0>[3];
const paint = (x: Ctx, pts: Pt[], fill: string, o: NonNullable<PO> = {}) => paint0(x, pts, fill, { ...o, lw: (o.lw ?? 1.3) / HS, wob: (o.wob ?? 0.35) });
const blob = (x: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string, o: NonNullable<PO> & { n?: number; rot?: number } = {}) => blob0(x, cx, cy, rx, ry, fill, { ...o, lw: (o.lw ?? 1.3) / HS });
const stroke = (x: Ctx, pts: Pt[], col: string, w = 1, o: { open?: boolean; alpha?: number } = {}) => stroke0(x, pts, col, w / HS, o);

export type HatFace = 'open' | 'blink' | 'happy' | 'worry' | 'sleepy';
const W = 38, H = 26;

const BODY = ['#b27a72', '#d9473c', '#dc4a3a', '#d9473c', '#e34a3d', '#e8483c'];
const BRIM = ['#e7ddca', '#fff7ea', '#fff7ea', '#fff7ea', '#fffaf0', '#fffaf0'];

function scallop(cx: number, cy: number, rx: number, ry: number, n: number, amp: number, seed: number): Pt[] {
  const r = rng(seed); const out: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2; const bump = i % 2 === 0 ? 1 + amp : 1 - amp * 0.4; const j = 1 + (r() - 0.5) * 0.06;
    out.push([cx + Math.cos(a) * rx * bump * j, cy + Math.sin(a) * ry * bump * j]);
  }
  return out;
}

function pompom(x: Ctx, cx: number, cy: number, r: number, col: string, seed: number, half = false) {
  if (half) { // 秃了一半的绒球：只剩一小团，半边是缝线
    paint(x, [[cx - r, cy + r * 0.3], [cx - r * 0.7, cy - r * 0.7], [cx, cy - r], [cx + r * 0.8, cy - r * 0.5], [cx + r, cy + r * 0.4], [cx, cy + r * 0.2]], col, { seed, lw: 1.2, t: 0.5 });
    stroke(x, [[cx - r * 0.5, cy + r * 0.3], [cx + r * 0.2, cy + r * 0.6], [cx + r * 0.9, cy + r * 0.3]], '#8a6a60', 0.7);
    return;
  }
  paint(x, scallop(cx, cy, r, r * 0.94, 7, 0.14, seed), col, { seed, lw: 1.25, t: 0.5, hi: 0.8, hiAt: [0.3, 0.28], shade: 0.5 });
  stroke(x, [[cx - r * 0.5, cy - r * 0.35], [cx - r * 0.1, cy - r * 0.62]], '#ffffff', 0.9, { alpha: 0.9 });
}

function bell(x: Ctx, cx: number, cy: number) {
  dot(x, cx, cy, 2.7, '#f2c23c', INK);
  stroke(x, [[cx - 2.2, cy + 0.9], [cx + 2.2, cy + 0.9]], '#9a6a1c', 0.7);
  dot(x, cx, cy + 1.6, 0.6, '#6a4510');
  stroke(x, [[cx - 1.4, cy - 1.4], [cx - 0.4, cy - 2]], '#fffbe0', 0.9);
}

function face(x: Ctx, stage: number, f: HatFace) {
  const ex = [9.8, 18.2], ey = 19.2;
  const ff = stage === 0 && f === 'open' ? 'sleepy' : f;
  for (let i = 0; i < 2; i++) {
    const X = ex[i];
    if (ff === 'blink') { stroke(x, [[X - 1.7, ey + 0.2], [X, ey + 0.9], [X + 1.7, ey + 0.2]], INK, 1.1); continue; }
    if (ff === 'happy') { stroke(x, [[X - 1.7, ey + 0.9], [X, ey - 0.5], [X + 1.7, ey + 0.9]], INK, 1.2); continue; }
    if (ff === 'sleepy') { blob(x, X, ey + 0.2, 1.7, 1.1, INK, { seed: 3 + i, lw: 0, n: 7, flat: true }); stroke(x, [[X - 2, ey - 0.7], [X + 2, ey - 0.4]], INK, 0.9); continue; }
    blob(x, X, ey, 1.6, 2.0, INK, { seed: 3 + i, lw: 0, n: 8, flat: true });
    dot(x, X - 0.5, ey - 0.8, 0.6, '#fff');
    if (ff === 'worry') stroke(x, [[X - 2, ey - 3.2 + (i ? 0.8 : -0.8)], [X + 1.6, ey - 3 + (i ? -0.8 : 0.8)]], INK, 0.8);
  }
  // 腮红 + 小嘴
  for (const X of ex) blob(x, X + (X < 14 ? -1.6 : 1.6), ey + 2, 1.7, 1, 'rgba(240,120,110,0.5)', { seed: 9, lw: 0, n: 7, flat: true });
  if (ff === 'happy') { paint(x, [[12.6, 21], [14, 23], [15.4, 21]], '#a8453b', { seed: 5, lw: 0.8, wob: 0.1, flat: true }); }
  else if (ff === 'worry') stroke(x, [[12.8, 22.2], [14, 21.4], [15.2, 22.2]], INK, 0.9);
  else stroke(x, [[12.9, 21.4], [14, 22.2], [15.1, 21.4]], INK, 0.9);
}

export function buildHat(stage: number, f: HatFace = 'open'): HTMLCanvasElement {
  const s = Math.max(0, Math.min(5, stage | 0));
  const { c, x } = mkc(W * HS, H * HS); x.scale(HS, HS); x.translate(4, 2);
  const body = BODY[s], brim = BRIM[s];
  // 落地影子（轻）由 p_shadow 负责，这里不画
  // 帽身：软塌的圆锥，向右后方弯下去
  const tip: Pt = s === 0 ? [26.4, 16.2] : s === 2 ? [25.2, 12.6] : [25.6, 14.2];
  const pts: Pt[] = s === 0
    ? [[3, 19.6], [3.4, 13.4], [7.6, 8.6], [13.6, 7], [19, 8.4], [23.4, 12], [tip[0], tip[1]], [22.4, 17.6], [24.6, 19.6]]
    : [[3, 19.6], [3.8, 12], [8.4, 5.6], [14.6, 3.4], [20.2, 5.6], [23.6, 10], [tip[0], tip[1]], [21.4, 14.4], [24.8, 19.6]];
  paint(x, pts, body, { seed: 21 + s, lw: 1.45, t: 0.42, hi: 0.7, hiAt: [0.3, 0.3], shade: s === 0 ? 0.35 : 0.6 });
  // 折痕 / 衣褶
  stroke(x, [[8.4, 7.4], [10, 12], [9.2, 16.6]], dark(body, 0.35), 0.9, { alpha: 0.7 });
  stroke(x, [[16, 5.8], [17.6, 10], [18.2, 14]], dark(body, 0.3), 0.8, { alpha: 0.55 });
  if (s === 0) { // 旧帽：褪色补丁 + 缝线
    paint(x, [[14.4, 8.6], [18.4, 8.4], [18.6, 11.8], [14.8, 12.2]], '#8c7e8e', { seed: 33, lw: 0.8, wob: 0.2, flat: true, alpha: 0.9 });
    for (let i = 0; i < 4; i++) stroke(x, [[14.8 + i * 1, 8.6], [15 + i * 1, 9.4]], '#d8cdb8', 0.5);
    stroke(x, [[5, 14], [6.4, 14.4]], '#5a4640', 0.6, { alpha: 0.6 });
  }
  if (s >= 3) { // 金线：帽身上一条缠绕的金色斜纹 + 帽檐上方金线
    for (let i = 0; i < 3; i++) stroke(x, [[7.4 + i * 4.2, 15.8 - i * 0.4], [9.6 + i * 4.2, 11.4 - i * 0.8], [12.8 + i * 4.2, 7.6 - i * 0.8]].filter((_, k) => i * 4.2 + [7.4, 9.6, 12.8][k] < 24) as Pt[], '#f2c23c', 1.15, { alpha: 0.95 });
    stroke(x, [[4.2, 16.6], [10, 17.6], [17, 17.8], [24, 16.8]], '#f2c23c', 1, { alpha: 0.9 });
  }
  if (s === 5) { // 光泽
    stroke(x, [[6.4, 11.4], [8.6, 7.4], [12, 5.4]], '#ffd0c0', 1.5, { alpha: 0.75 });
    dot(x, 16.4, 7.2, 0.7, '#fff'); dot(x, 9.4, 9.8, 0.5, '#fff');
  }
  // 绒球
  const pc = s === 4 || s === 5 ? '#ffffff' : s === 2 ? '#fff0c2' : '#f6f0e4';
  if (s === 0) pompom(x, tip[0] + 0.6, tip[1] + 1.2, 3, '#d6cdc0', 41, true);
  else if (s === 1) { /* 没有绒球，只有帽尖 */ dot(x, tip[0], tip[1], 1.1, body, INK); }
  else if (s === 2) { // 歪着长出来、像小鸡的小绒球
    pompom(x, tip[0] - 0.4, tip[1] - 0.4, 3.2, pc, 42);
    stroke(x, [[tip[0] - 0.8, tip[1] - 3.4], [tip[0] - 1.6, tip[1] - 5.2]], pc, 1.2); stroke(x, [[tip[0] + 0.2, tip[1] - 3.4], [tip[0] + 1.2, tip[1] - 5]], pc, 1.2);
    stroke(x, [[tip[0] - 0.8, tip[1] - 3.4], [tip[0] - 1.6, tip[1] - 5.2]], INK, 0.4, { alpha: 0.5 });
  } else pompom(x, tip[0] - 0.2, tip[1] + (s === 3 ? 0.2 : 0), s === 3 ? 3.6 : 4.5, pc, 43 + s);
  if (s === 5) bell(x, tip[0] + 2.8, tip[1] + 3.8);
  // 帽檐白边（毛绒）
  paint(x, scallop(14, 19.6, 12.6, 3.9, 9, 0.07, 51 + s), brim, { seed: 50 + s, lw: 1.35, t: 0.5, hi: 0.8, hiAt: [0.3, 0.2], shade: s === 0 ? 0.55 : 0.4 });
  if (s === 0) stroke(x, [[5, 20.4], [8, 21.2], [12, 21.4]], '#bfae96', 0.7, { alpha: 0.7 });
  if (s >= 3) stroke(x, [[3.6, 18.6], [8, 17.3], [14, 16.8], [20, 17.3], [24.4, 18.6]], '#f2c23c', 0.8, { alpha: 0.9 });
  face(x, s, f);
  if (s >= 4) { // 小闪光
    for (const [px, py, r] of [[3, 5, 1.7], [26, 5, 1.3], [21, 1.6, 1.1]] as const) { stroke(x, [[px - r, py], [px + r, py]], '#fff6c8', 0.9); stroke(x, [[px, py - r], [px, py + r]], '#fff6c8', 0.9); }
  }
  x.translate(-4, -2); grain(x, W, H, 7 + s, 0.1);
  return halo(c, 'rgba(255,248,232,0.85)', 1.6);
}

// ———————— 附身光圈 / 光晕 / 拖尾 ————————
export function buildAuraRing(): HTMLCanvasElement {
  const w = 72, h = 36; const { c, x } = mkc(w * 2, h * 2); x.scale(2, 2);
  const g = x.createRadialGradient(36, 18, 8, 36, 18, 36); g.addColorStop(0, 'rgba(255,230,150,0)'); g.addColorStop(0.7, 'rgba(255,214,110,0.34)'); g.addColorStop(1, 'rgba(255,200,90,0)');
  x.save(); x.scale(1, 0.5); x.fillStyle = g; x.beginPath(); x.arc(36, 36, 36, 0, 7); x.fill(); x.restore();
  const r = rng(11); // 手绘的断续金环
  for (let k = 0; k < 2; k++) {
    x.beginPath(); const n = 40; const R = k ? 22 : 27;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2 + k * 0.4; const rr = R + (r() - 0.5) * 0.9; const px = 36 + Math.cos(a) * rr, py = 18 + Math.sin(a) * rr * 0.5; i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.strokeStyle = k ? 'rgba(255,248,214,0.9)' : 'rgba(240,184,60,0.95)'; x.lineWidth = k ? 1.2 : 2.2; x.setLineDash(k ? [5, 3, 1, 3] : [11, 3]); x.stroke(); x.setLineDash([]);
  }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + 0.3; const px = 36 + Math.cos(a) * 27, py = 18 + Math.sin(a) * 13.5; stroke(x, [[px - 1.6, py], [px + 1.6, py]], '#fff6c8', 0.9); stroke(x, [[px, py - 1.6], [px, py + 1.6]], '#fff6c8', 0.9); }
  return c;
}
export function buildAuraGlow(): HTMLCanvasElement {
  const { c, x } = mkc(128, 128); x.scale(2, 2);
  const g = x.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,248,214,0.95)'); g.addColorStop(0.35, 'rgba(255,224,140,0.5)'); g.addColorStop(1, 'rgba(255,200,100,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c;
}
export function buildTrail(kind: 'dot' | 'star' | 'swirl'): HTMLCanvasElement {
  const { c, x } = mkc(32, 32); x.scale(2, 2);
  if (kind === 'dot') {
    const g = x.createRadialGradient(8, 8, 0.5, 8, 8, 8); g.addColorStop(0, 'rgba(255,252,230,1)'); g.addColorStop(0.4, 'rgba(255,214,120,0.7)'); g.addColorStop(1, 'rgba(255,170,80,0)');
    x.fillStyle = g; x.fillRect(0, 0, 16, 16);
  } else if (kind === 'star') {
    const pts: Pt[] = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 - 1.57, r = i % 2 ? 2.2 : 6.2; pts.push([8 + Math.cos(a) * r, 8 + Math.sin(a) * r]); }
    paint(x, pts, '#ffe27a', { seed: 5, lw: 0.9, wob: 0.15, t: 0.05, hi: 0.8 });
  } else {
    x.strokeStyle = 'rgba(255,230,150,0.95)'; x.lineWidth = 1.5; x.beginPath();
    for (let i = 0; i < 30; i++) { const a = i * 0.45, r = 0.6 + i * 0.22; const px = 8 + Math.cos(a) * r, py = 8 + Math.sin(a) * r; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  }
  return c;
}

export function registerHatTextures(textures: { exists(k: string): boolean; addCanvas(k: string, c: HTMLCanvasElement): unknown }) {
  const add = (k: string, c: HTMLCanvasElement) => { if (!textures.exists(k)) textures.addCanvas(k, c); };
  for (let s = 0; s <= 5; s++) {
    add(`hat_${s}`, buildHat(s));
    for (const f of ['blink', 'happy', 'worry'] as const) add(`hat_${s}_${f}`, buildHat(s, f));
  }
  add('hat_6', buildHat(5)); add('hat_6_happy', buildHat(5, 'happy')); add('hat_6_blink', buildHat(5, 'blink')); add('hat_6_worry', buildHat(5, 'worry'));
  add('aura_ring', buildAuraRing()); add('aura_glow', buildAuraGlow());
  add('trail_dot', buildTrail('dot')); add('trail_star', buildTrail('star')); add('trail_swirl', buildTrail('swirl'));
}
void light; void rgba;
