// 生产建筑"生产档"主视觉 480×320:果园 / 果山 / 果城 / 果星 / 苹果之门。每档 2 个分支变体(variant 0|1)。
// 风格:参考 truck.webp——粗均匀黑描边+轻微抖线+大量留白(米白/暖灰),只有苹果和少量点缀是彩色(红)。果园因为是树,保持彩色卡通。
// 每件预渲染成一张 480×320 离屏图(锚点=底部中心),之后只 drawImage。
import { bake, Ctx, PAL, rng, mix, rgba, star4, TAU, lerp } from './common';
import { appleSprite, drawAppleAt } from './apple';
import { drawTree, grassPatch } from './tree';

export const BUILDING_W = 480, BUILDING_H = 320, BUILDING_GROUND = 300;
export const BUILDING_NAMES = ['果园', '果山', '果城', '果星', '苹果之门'] as const;
export type BuildingTier = 1 | 2 | 3 | 4 | 5;
export interface BuildingOpts {
  tier?: BuildingTier; variant?: 0 | 1; seed?: number;
  /** 果园:前排棵数 1..3(默认3),后排 0..5(默认4) */ front?: number; back?: number;
  /** 画地面草块(默认 true) */ ground?: boolean;
}

const P0 = '#fbf6e8', P1 = '#efe6cf', P2 = '#d6cbb0', P3 = '#b9ad92', INK = PAL.ink, WOOD = '#c58d55', WOOD_D = '#8a5a34';
const LW = 3.4;

// ---------- 手绘线工具 ----------
function wob(c: Ctx, pts: [number, number][], seed: number, j = 1.0, close = false) {
  const r = rng(seed), n = pts.length, segs = close ? n : n - 1;
  c.beginPath(); let first = true;
  for (let i = 0; i < segs; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n], L = Math.hypot(x1 - x0, y1 - y0), k = Math.max(1, Math.round(L / 28));
    for (let m = 0; m < k; m++) { const t = m / k, x = lerp(x0, x1, t) + (r() - 0.5) * 2 * j, y = lerp(y0, y1, t) + (r() - 0.5) * 2 * j; first ? c.moveTo(x, y) : c.lineTo(x, y); first = false; }
  }
  if (close) c.closePath(); else c.lineTo(pts[n - 1][0] + (r() - 0.5) * 2 * j, pts[n - 1][1] + (r() - 0.5) * 2 * j);
}
function ink(c: Ctx, lw = LW, col: string = INK) { c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = col; c.stroke(); }
function shp(c: Ctx, pts: [number, number][], fill: string | CanvasGradient | null, seed: number, lw = LW, j = 1.0) { wob(c, pts, seed, j, true); if (fill) { c.fillStyle = fill; c.fill(); } ink(c, lw); }
function line(c: Ctx, pts: [number, number][], seed: number, lw = LW, j = 1.0, col: string = INK) { wob(c, pts, seed, j); ink(c, lw, col); }
const R4 = (x: number, y: number, w: number, h: number): [number, number][] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
/** 墙体:米白填色 + 右侧暖灰背光面(斜线排线)+ 粗描边 */
function box(c: Ctx, x: number, y: number, w: number, h: number, seed: number, fill = P0, sh = 0.28, lw = LW) {
  c.fillStyle = fill; c.fillRect(x, y, w, h);
  if (sh > 0) {
    const sx = x + w * (1 - sh); c.fillStyle = P2; c.fillRect(sx, y, x + w - sx, h);
    c.save(); c.beginPath(); c.rect(sx, y, x + w - sx, h); c.clip(); c.lineWidth = 1.2; c.strokeStyle = rgba(INK, 0.45);
    for (let i = -h; i < w; i += 7) { c.beginPath(); c.moveTo(sx + i, y + h); c.lineTo(sx + i + h * 0.6, y); c.stroke(); } c.restore();
  }
  wob(c, R4(x, y, w, h), seed, 0.9, true); ink(c, lw);
}
function ap(c: Ctx, x: number, y: number, r: number, kind = 'fuji') { const sp = appleSprite(kind, 'fresh', r >= 36 ? 160 : r >= 14 ? 64 : 32); drawAppleAt(c, sp, x, y, r / sp.meta!.r); }
function ground(c: Ctx, hw: number, seed: number, cx = 240) {
  grassPatch(c, cx, BUILDING_GROUND + 6, hw, seed);
  const r = rng(seed + 5); c.lineWidth = 1.8; c.strokeStyle = rgba(PAL.leafDark, 0.9); c.lineCap = 'round';
  for (let i = 0; i < 10; i++) { const x = cx + (r() - 0.5) * 2 * hw * 0.9, y = BUILDING_GROUND + 8 + r() * 16, h = 5 + r() * 5; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y - h); c.moveTo(x, y); c.lineTo(x + 2, y - h * 0.8); c.stroke(); }
}
function win(c: Ctx, x: number, y: number, w: number, h: number, seed: number, mode: 0 | 1 | 2 = 0) {
  shp(c, R4(x, y, w, h), mode === 1 ? '#ffe9a8' : '#ffffff', seed, 2.4, 0.5);
  if (mode === 2) { ap(c, x + w / 2, y + h - 2, Math.min(w, h) * 0.46); return; }
  line(c, [[x + w / 2, y], [x + w / 2, y + h]], seed + 1, 1.4, 0.2); line(c, [[x, y + h * 0.5], [x + w, y + h * 0.5]], seed + 2, 1.4, 0.2);
}
function hatch(c: Ctx, x: number, y: number, w: number, h: number, step = 6, a = 0.4) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.lineWidth = 1.2; c.strokeStyle = rgba(INK, a);
  for (let i = -h; i < w; i += step) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + h * 0.6, y); c.stroke(); } c.restore();
}
function sparkle(c: Ctx, x: number, y: number, r: number) { star4(c, x, y, r, 0.22); c.fillStyle = '#fff6b0'; c.fill(); ink(c, 2.2); }

// ================= 1 果园:两排树(彩色) =================
function paintOrchard(c: Ctx, o: BuildingOpts) {
  const seed = o.seed ?? 1, v = o.variant ?? 0, front = Math.max(1, Math.min(3, o.front ?? 3)), back = Math.max(0, Math.min(5, o.back ?? 4));
  if (o.ground !== false) ground(c, 225, seed);
  const tierB = v ? 2 : 3, tierF = v ? 3 : 4;
  // 后排
  for (let i = 0; i < back; i++) { const x = back === 1 ? 240 : 50 + (i / (back - 1)) * 380; drawTree(c, x, 222, 0.64, { tier: tierB, seed: seed * 3 + i, ground: false }); }
  // 木栅栏
  const rng2 = rng(seed + 9);
  c.lineJoin = 'round';
  line(c, [[28, 262], [452, 262]], seed + 20, 3, 0.8); line(c, [[28, 274], [452, 274]], seed + 21, 3, 0.8);
  for (let x = 36; x < 450; x += 28) { const j = (rng2() - 0.5) * 2; shp(c, [[x - 6, 282], [x - 6, 256 + j], [x, 248 + j], [x + 6, 256 + j], [x + 6, 282]], WOOD, seed + x, 2.8, 0.5); line(c, [[x - 2, 260], [x - 2, 280]], seed + x + 1, 1.2, 0.3, rgba(INK, 0.4)); }
  // 前排
  const xs = front === 1 ? [240] : front === 2 ? [150, 330] : [92, 240, 388];
  xs.forEach((x, i) => drawTree(c, x, 310, 0.82, { tier: tierF, seed: seed * 7 + i + 2, ground: false }));
  // 地上的苹果箱
  const crate = (x: number, y: number, n: number) => {
    for (let i = 0; i < n; i++) ap(c, x - 18 + i * 18 + (i % 2) * 2, y - 16 - (i % 2) * 5, 9, i === 1 ? 'golden' : 'fuji');
    shp(c, [[x - 28, y - 18], [x + 28, y - 18], [x + 24, y + 4], [x - 24, y + 4]], WOOD, seed + x, 3, 0.7);
    line(c, [[x - 26, y - 8], [x + 26, y - 8]], seed + x + 1, 1.8, 0.5, WOOD_D);
  };
  if (v) { crate(44, 312, 3); crate(436, 312, 3); } else crate(wideSlot(front), 314, 3);
}
const wideSlot = (front: number) => (front === 3 ? 316 : 70);

// ================= 2 果山:三角苹果堆 =================
function paintMountain(c: Ctx, o: BuildingOpts) {
  const seed = o.seed ?? 1, v = o.variant ?? 0, rows = 7, r = v ? 25 : 24, dx = r * 1.9, dy = r * 1.52, r0 = rng(seed * 11 + 3);
  if (o.ground !== false) ground(c, 225, seed);
  const baseY = 296, topY = baseY - r - (rows - 1) * dy, half = ((rows - 1) / 2) * dx;
  shp(c, [[240 - half - r * 0.6, baseY - 2], [240 + half + r * 0.6, baseY - 2], [240, topY + 2]], '#6b3a24', seed, 2.6, 1);
  const kinds = ['fuji', 'fuji', 'fuji', 'fuji', 'gala', 'delicious', 'yellow', 'green', 'fuji', 'golden'];
  for (let j = rows - 1; j >= 0; j--) {
    const n = rows - j;
    for (let i = 0; i < n; i++) {
      const x = 240 + (i - (n - 1) / 2) * dx + (r0() - 0.5) * 3, y = baseY - r - j * dy + (r0() - 0.5) * 3;
      const k = j === rows - 1 ? 'golden' : kinds[(r0() * kinds.length) | 0];
      ap(c, x, y, r + (j === rows - 1 ? 3 : 0) + (r0() - 0.5) * 2, k);
    }
  }
  // 山脚散落的苹果
  [[60, 288, 14], [96, 292, 16], [394, 292, 16], [424, 286, 14]].forEach(([x, y, rr], i) => ap(c, x, y - rr * 0.4, rr, i % 2 ? 'gala' : 'fuji'));
  if (v) { // 木梯 + 竹篮
    const lx = 372, top = topY + 90;
    line(c, [[lx, baseY], [lx + 36, top]], seed + 40, 4, 0.6, WOOD_D); line(c, [[lx + 30, baseY], [lx + 66, top]], seed + 41, 4, 0.6, WOOD_D);
    for (let i = 1; i < 6; i++) { const t = i / 6; line(c, [[lerp(lx, lx + 36, t) + 2, lerp(baseY, top, t)], [lerp(lx + 30, lx + 66, t) - 2, lerp(baseY, top, t)]], seed + 50 + i, 3, 0.4, WOOD_D); }
  } else { // 山顶小旗
    line(c, [[240, topY - 10], [240, topY - 48]], seed + 60, 3.6, 0.5);
    shp(c, [[240, topY - 48], [274, topY - 40], [240, topY - 30]], '#dc3a2c', seed + 61, 3, 0.5);
  }
  sparkle(c, 240 - half * 0.15, topY - (v ? 24 : 6), 7); sparkle(c, 240 + 30, topY + 10, 5);
}

// ================= 3 果城:黑白手绘楼群 + 红苹果点缀 =================
type BKind = 'flat' | 'gable' | 'tower';
function building(c: Ctx, x: number, w: number, h: number, kind: BKind, seed: number, o: { fill?: string; yb?: number; door?: boolean; apples?: boolean } = {}) {
  const yb = o.yb ?? BUILDING_GROUND, top = yb - h, r = rng(seed * 5 + 1);
  box(c, x, top, w, h, seed, o.fill ?? P0, 0.26);
  // 屋顶
  if (kind === 'flat') { shp(c, R4(x - 5, top - 9, w + 10, 9), P1, seed + 1, 3); }
  else if (kind === 'gable') { shp(c, [[x - 7, top], [x + w / 2, top - w * 0.5], [x + w + 7, top]], P1, seed + 1, 3.2); hatch(c, x + w / 2, top - w * 0.5, w / 2 + 6, w * 0.5 - 2, 6, 0.45); line(c, [[x - 7, top], [x + w / 2, top - w * 0.5], [x + w + 7, top]], seed + 2, 3.2); }
  else { shp(c, [[x - 4, top], [x + w / 2, top - w * 1.1], [x + w + 4, top]], P1, seed + 1, 3.2); hatch(c, x + w / 2, top - w * 1.1, w / 2 + 4, w * 1.1 - 2, 6, 0.45); line(c, [[x - 4, top], [x + w / 2, top - w * 1.1], [x + w + 4, top]], seed + 2, 3.2); }
  // 窗
  const cols = Math.max(1, Math.floor((w - 10) / 22)), rows = Math.max(1, Math.floor((h - 46) / 30)), ww = 12, wh = 16;
  const gx = (w - cols * ww) / (cols + 1);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const wx = x + gx + i * (ww + gx), wy = top + 12 + j * 30, m = o.apples !== false && r() < 0.12 ? 2 : r() < 0.18 ? 1 : 0;
    win(c, wx, wy, ww, wh, seed * 17 + i * 7 + j, m as 0 | 1 | 2);
  }
  if (o.door !== false && h > 70) { const dw = Math.min(20, w * 0.34); shp(c, [[x + w / 2 - dw / 2, yb], [x + w / 2 - dw / 2, yb - 26], [x + w / 2, yb - 34], [x + w / 2 + dw / 2, yb - 26], [x + w / 2 + dw / 2, yb]], '#ffffff', seed + 3, 2.6, 0.5); }
  return top;
}
function paintCity(c: Ctx, o: BuildingOpts) {
  const seed = o.seed ?? 1, v = o.variant ?? 0;
  if (o.ground !== false) ground(c, 232, seed);
  // 后排(略小略淡,上移)
  const back: [number, number, number, BKind][] = [[40, 56, 120, 'gable'], [100, 50, 150, 'flat'], [326, 54, 140, 'flat'], [380, 60, 118, 'gable'], [128, 44, 96, 'tower'], [304, 40, 86, 'tower']];
  back.forEach(([x, w, h, k], i) => building(c, x, w, h, k, seed + 100 + i, { fill: P1, yb: BUILDING_GROUND - 14, door: false, apples: false }));
  if (v === 0) {
    // 中央钟楼
    const cx = 240, tw = 62, th = 180, top = BUILDING_GROUND - th;
    box(c, cx - tw / 2, top, tw, th, seed + 7, P0, 0.28);
    shp(c, R4(cx - tw / 2 - 6, top - 10, tw + 12, 10), P1, seed + 8, 3);
    shp(c, [[cx - tw / 2 + 2, top - 10], [cx, top - 74], [cx + tw / 2 - 2, top - 10]], P1, seed + 9, 3.2); hatch(c, cx, top - 74, tw / 2, 64, 6, 0.45);
    line(c, [[cx - tw / 2 + 2, top - 10], [cx, top - 74], [cx + tw / 2 - 2, top - 10]], seed + 10, 3.2);
    ap(c, cx, top - 74 - 4, 15, 'fuji'); // 尖顶苹果
    // 钟
    c.beginPath(); c.arc(cx, top + 34, 20, 0, TAU); c.fillStyle = '#fff'; c.fill(); ink(c, 3.2);
    line(c, [[cx, top + 34], [cx, top + 22]], seed + 11, 2.6, 0.2); line(c, [[cx, top + 34], [cx + 10, top + 38]], seed + 12, 2.6, 0.2);
    for (let j = 0; j < 4; j++) win(c, cx - 20 + (j % 2) * 24, top + 78 + ((j / 2) | 0) * 38, 16, 22, seed + 20 + j, j === 2 ? 2 : 0);
    shp(c, [[cx - 12, BUILDING_GROUND], [cx - 12, BUILDING_GROUND - 30], [cx, BUILDING_GROUND - 40], [cx + 12, BUILDING_GROUND - 30], [cx + 12, BUILDING_GROUND]], '#fff', seed + 13, 2.8, 0.5);
    building(c, 150, 76, 130, 'gable', seed + 30); building(c, 268, 78, 150, 'flat', seed + 31);
    building(c, 62, 70, 90, 'flat', seed + 32); building(c, 346, 72, 108, 'gable', seed + 33);
    building(c, 416, 46, 70, 'gable', seed + 34); building(c, 18, 40, 64, 'flat', seed + 35);
  } else {
    // 苹果穹顶大厅
    const cx = 240, hw = 140, hh = 100, top = BUILDING_GROUND - hh;
    box(c, cx - hw / 2, top, hw, hh, seed + 7, P0, 0.24);
    shp(c, R4(cx - hw / 2 - 6, top - 10, hw + 12, 10), P1, seed + 8, 3);
    for (let i = 0; i < 6; i++) { const px = cx - hw / 2 + 12 + i * ((hw - 28) / 5); shp(c, R4(px, top + 8, 10, hh - 8), P1, seed + 40 + i, 2.6, 0.4); }
    shp(c, [[cx - 20, BUILDING_GROUND], [cx - 20, BUILDING_GROUND - 34], [cx, BUILDING_GROUND - 44], [cx + 20, BUILDING_GROUND - 34], [cx + 20, BUILDING_GROUND]], '#fff', seed + 9, 3, 0.6);
    // 大苹果穹顶(红,点睛)
    ap(c, cx, top - 52, 52, 'fuji');
    building(c, 30, 70, 150, 'flat', seed + 50); building(c, 108, 62, 118, 'gable', seed + 51);
    building(c, 312, 62, 124, 'gable', seed + 52); building(c, 382, 66, 176, 'flat', seed + 53);
    // 路灯
    [[96, 22], [384, 22]].forEach(([x], i) => { line(c, [[x, BUILDING_GROUND + 4], [x, BUILDING_GROUND - 40]], seed + 60 + i, 3, 0.4); c.beginPath(); c.arc(x, BUILDING_GROUND - 46, 7, 0, TAU); c.fillStyle = '#ffe9a8'; c.fill(); ink(c, 2.6); });
  }
}

// ================= 4 果星:星台 =================
function starPath(cx: number, cy: number, R: number, r: number, rot = -Math.PI / 2): [number, number][] {
  const p: [number, number][] = []; for (let i = 0; i < 10; i++) { const a = rot + (i * Math.PI) / 5, rr = i % 2 ? r : R; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return p;
}
function ring(c: Ctx, cx: number, cy: number, rx: number, ry: number, rot: number, front: boolean, lw = 7) {
  c.save(); c.translate(cx, cy); c.rotate(rot);
  c.beginPath(); c.ellipse(0, 0, rx, ry, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); c.lineWidth = lw + 4.5; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke();
  c.beginPath(); c.ellipse(0, 0, rx, ry, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); c.lineWidth = lw; c.strokeStyle = P0; c.stroke();
  c.restore();
}
function paintStar(c: Ctx, o: BuildingOpts) {
  const seed = o.seed ?? 1, v = o.variant ?? 0;
  if (o.ground !== false) ground(c, 210, seed);
  // 石台与台阶
  shp(c, [[112, BUILDING_GROUND], [132, 262], [348, 262], [368, BUILDING_GROUND]], P0, seed, 3.4, 1);
  hatch(c, 300, 262, 66, 38, 7, 0.4);
  shp(c, [[112, BUILDING_GROUND], [132, 262], [348, 262], [368, BUILDING_GROUND]], null, seed + 1, 3.4, 1);
  shp(c, [[146, 262], [162, 232], [318, 232], [334, 262]], P1, seed + 2, 3.2, 0.8);
  for (let i = 0; i < 5; i++) line(c, [[132 + i * 54, 266], [132 + i * 54 + 4, BUILDING_GROUND - 4]], seed + 3 + i, 1.6, 0.4, rgba(INK, 0.5));
  // 细塔
  box(c, 224, 170, 32, 64, seed + 9, P0, 0.34);
  shp(c, R4(216, 162, 48, 10), P1, seed + 10, 3);
  const cy = v ? 112 : 96;
  if (v === 0) {
    ring(c, 240, cy, 150, 30, -0.2, false);
    const R = 82, Ri = 38;
    shp(c, starPath(240, cy, R, Ri), '#f9d65c', seed + 11, 4, 1.2);
    // 星的高光/暗面
    c.save(); wob(c, starPath(240, cy, R, Ri), seed + 11, 1.2, true); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.moveTo(240, cy); c.lineTo(240 - R, cy - R); c.lineTo(240 - R, cy + 10); c.closePath(); c.fill();
    c.fillStyle = 'rgba(200,140,20,0.35)'; c.beginPath(); c.moveTo(240, cy); c.lineTo(240 + R, cy + R * 0.2); c.lineTo(240 + R * 0.3, cy + R); c.closePath(); c.fill(); c.restore();
    shp(c, starPath(240, cy, R, Ri), null, seed + 12, 4, 1.2);
    ap(c, 240, cy + 6, 28, 'fuji');
    ring(c, 240, cy, 150, 30, -0.2, true);
    ap(c, 240 + 150 * Math.cos(-0.2) * 0.93, cy + 30 * 0.4 - 28, 10, 'golden');
  } else {
    // 苹果行星 + 两道交叉星环 + 小星
    ring(c, 240, cy, 140, 26, -0.28, false); ring(c, 240, cy, 120, 22, 0.32, false, 6);
    c.beginPath(); c.arc(240, cy, 54, 0, TAU); c.fillStyle = '#dc3a2c'; c.fill(); ink(c, 4);
    ap(c, 240, cy + 20, 50, 'fuji');
    ring(c, 240, cy, 140, 26, -0.28, true); ring(c, 240, cy, 120, 22, 0.32, true, 6);
    shp(c, starPath(240, cy - 80, 20, 9), '#f9d65c', seed + 14, 3, 0.6);
    // 天线锅
    line(c, [[340, 232], [340, 206]], seed + 15, 3.4, 0.4); shp(c, [[318, 196], [362, 196], [352, 210], [328, 210]], P0, seed + 16, 3, 0.4);
  }
  sparkle(c, 66, 70, 9); sparkle(c, 420, 52, 11); sparkle(c, 380, 120, 7); sparkle(c, 98, 128, 6);
}

// ================= 5 苹果之门 =================
function portalGrad(c: Ctx, cx: number, cy: number, r: number) {
  const g = c.createRadialGradient(cx, cy, 4, cx, cy, r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#fff1a8'); g.addColorStop(0.75, '#f7c635'); g.addColorStop(1, '#e8893a'); return g;
}
function swirl(c: Ctx, cx: number, cy: number, r: number, seed: number) {
  c.save(); c.lineWidth = 2.4; c.strokeStyle = rgba(INK, 0.55); c.lineCap = 'round';
  for (let k = 0; k < 3; k++) { c.beginPath(); for (let t = 0; t < 4.2; t += 0.12) { const a = t * 1.5 + k * 2.09, rr = (t / 4.2) * r * 0.9; const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 1.1; t ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
  c.restore(); void seed;
}
function paintGate(c: Ctx, o: BuildingOpts) {
  const seed = o.seed ?? 1, v = o.variant ?? 0, cx = 240;
  if (o.ground !== false) ground(c, 226, seed);
  // 台阶
  shp(c, [[96, BUILDING_GROUND], [110, 286], [370, 286], [384, BUILDING_GROUND]], P1, seed, 3.2, 0.8);
  shp(c, [[116, 286], [128, 274], [352, 274], [364, 286]], P0, seed + 1, 3.2, 0.8);
  if (v === 0) {
    const ay = 158, Ro = 112, Ri = 60;
    // 立柱
    box(c, cx - Ro, ay, Ro - Ri, 274 - ay, seed + 2, P0, 0.3); box(c, cx + Ri, ay, Ro - Ri, 274 - ay, seed + 3, P0, 0.3);
    for (let j = 1; j < 5; j++) { line(c, [[cx - Ro, ay + j * 23], [cx - Ri, ay + j * 23]], seed + 10 + j, 1.8, 0.5, rgba(INK, 0.6)); line(c, [[cx + Ri, ay + j * 23], [cx + Ro, ay + j * 23]], seed + 20 + j, 1.8, 0.5, rgba(INK, 0.6)); }
    shp(c, R4(cx - Ro - 6, 266, Ro - Ri + 12, 10), P1, seed + 4, 3); shp(c, R4(cx + Ri - 6, 266, Ro - Ri + 12, 10), P1, seed + 5, 3);
    // 门洞光幕
    c.save(); c.beginPath(); c.moveTo(cx - Ri, 274); c.lineTo(cx - Ri, ay); c.arc(cx, ay, Ri, Math.PI, TAU); c.lineTo(cx + Ri, 274); c.closePath(); c.clip();
    c.fillStyle = portalGrad(c, cx, ay + 30, 150); c.fillRect(cx - Ri, ay - Ri, Ri * 2, 274 - ay + Ri); swirl(c, cx, ay + 30, 80, seed); c.restore();
    // 拱石
    c.beginPath(); c.arc(cx, ay, Ro, Math.PI, TAU); c.arc(cx, ay, Ri, TAU, Math.PI, true); c.closePath(); c.fillStyle = P0; c.fill();
    c.save(); c.clip(); c.fillStyle = P2; c.fillRect(cx + 10, ay - Ro, Ro, Ro); hatch(c, cx + 10, ay - Ro, Ro, Ro, 7, 0.4); c.restore();
    for (let i = 1; i < 8; i++) { const a = Math.PI + (i / 8) * Math.PI; line(c, [[cx + Math.cos(a) * Ri, ay + Math.sin(a) * Ri], [cx + Math.cos(a) * Ro, ay + Math.sin(a) * Ro]], seed + 30 + i, 2.6, 0.4); }
    c.beginPath(); c.arc(cx, ay, Ro, Math.PI, TAU); ink(c, 3.6); c.beginPath(); c.arc(cx, ay, Ri, Math.PI, TAU); ink(c, 3.6);
    line(c, [[cx - Ro, ay], [cx - Ri, ay]], seed + 40, 3.2, 0.3); line(c, [[cx + Ri, ay], [cx + Ro, ay]], seed + 41, 3.2, 0.3);
    line(c, [[cx - Ri, ay], [cx - Ri, 274]], seed + 42, 3.4, 0.6); line(c, [[cx + Ri, ay], [cx + Ri, 274]], seed + 43, 3.4, 0.6);
    // 拱心石苹果 + 门顶苹果
    shp(c, [[cx - 14, ay - Ro - 6], [cx + 14, ay - Ro - 6], [cx + 11, ay - Ri + 4], [cx - 11, ay - Ri + 4]], P1, seed + 44, 3, 0.4);
    ap(c, cx, ay - Ro - 14, 20, 'fuji');
    ap(c, cx - Ro + 14, 264, 13, 'fuji'); ap(c, cx + Ro - 14, 264, 13, 'golden');
    sparkle(c, cx - 28, ay + 36, 8); sparkle(c, cx + 22, ay + 70, 6); sparkle(c, cx + 8, ay + 10, 5);
  } else {
    // 苹果形巨门:红苹果身 + 石门洞
    const bx = cx, by = 168, R = 118;
    c.save(); c.beginPath(); c.moveTo(bx, by - R * 0.78);
    c.bezierCurveTo(bx + R * 0.3, by - R * 1.02, bx + R * 1.15, by - R * 0.8, bx + R * 1.08, by + R * 0.12);
    c.bezierCurveTo(bx + R * 1.02, by + R * 0.78, bx + R * 0.5, by + R * 0.94, bx, by + R * 0.9);
    c.bezierCurveTo(bx - R * 0.5, by + R * 0.94, bx - R * 1.02, by + R * 0.78, bx - R * 1.08, by + R * 0.12);
    c.bezierCurveTo(bx - R * 1.15, by - R * 0.8, bx - R * 0.3, by - R * 1.02, bx, by - R * 0.78); c.closePath();
    const g = c.createRadialGradient(bx - R * 0.35, by - R * 0.4, R * 0.1, bx, by, R * 1.1); g.addColorStop(0, '#ff7a64'); g.addColorStop(0.5, '#dc3a2c'); g.addColorStop(1, '#9c1218');
    c.fillStyle = g; c.fill(); c.lineWidth = 5; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(); c.restore();
    c.beginPath(); c.ellipse(bx - R * 0.46, by - R * 0.42, R * 0.22, R * 0.34, -0.6, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill();
    // 柄与叶
    c.beginPath(); c.moveTo(bx, by - R * 0.76); c.quadraticCurveTo(bx + 6, by - R * 1.02, bx + 16, by - R * 1.12); c.lineWidth = 7; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 3.4; c.strokeStyle = WOOD_D; c.stroke();
    c.beginPath(); c.moveTo(bx + 14, by - R * 1.04); c.quadraticCurveTo(bx + 56, by - R * 1.3, bx + 84, by - R * 1.0); c.quadraticCurveTo(bx + 52, by - R * 0.86, bx + 14, by - R * 1.04); c.fillStyle = PAL.leaf; c.fill(); ink(c, 3.4);
    // 门洞
    const dw = 56, dt = 150, db = 274;
    c.save(); c.beginPath(); c.moveTo(bx - dw, db); c.lineTo(bx - dw, dt + 30); c.arc(bx, dt + 30, dw, Math.PI, TAU); c.lineTo(bx + dw, db); c.closePath();
    c.fillStyle = portalGrad(c, bx, dt + 60, 120); c.fill(); c.clip(); swirl(c, bx, dt + 62, 70, seed); c.restore();
    c.beginPath(); c.moveTo(bx - dw, db); c.lineTo(bx - dw, dt + 30); c.arc(bx, dt + 30, dw, Math.PI, TAU); c.lineTo(bx + dw, db); ink(c, 5);
    c.beginPath(); c.moveTo(bx - dw - 9, db); c.lineTo(bx - dw - 9, dt + 30); c.arc(bx, dt + 30, dw + 9, Math.PI, TAU); c.lineTo(bx + dw + 9, db); ink(c, 3.2, P3);
    sparkle(c, bx - 20, dt + 60, 7); sparkle(c, bx + 18, dt + 100, 6);
  }
}

// ================= 统一入口 =================
/** 统一签名:(x,y)=底部中心(地面线),s=缩放(1 = 480×320 世界单位)。静态预渲染,一次 drawImage。 */
export function drawBuilding(ctx: Ctx, x: number, y: number, s = 1, o: BuildingOpts = {}) {
  const tier = Math.max(1, Math.min(5, Math.round(o.tier ?? 1))) as BuildingTier, v = (o.variant ?? 0) ? 1 : 0, seed = o.seed ?? 1;
  const extra = tier === 1 ? `|${o.front ?? 3}|${o.back ?? 4}` : '';
  const oo = { ...o, tier, variant: v as 0 | 1, seed };
  const fn = [paintOrchard, paintMountain, paintCity, paintStar, paintGate][tier - 1];
  bake(`bld|${tier}|${v}|${seed}|${o.ground === false ? 0 : 1}${extra}`, BUILDING_W, BUILDING_H, (c) => fn(c, oo), { ax: BUILDING_W / 2, ay: 312 }).draw(ctx, x, y, s);
}
export const drawOrchard = (ctx: Ctx, x: number, y: number, s = 1, o: BuildingOpts = {}) => drawBuilding(ctx, x, y, s, { ...o, tier: 1 });
export const drawAppleMountain = (ctx: Ctx, x: number, y: number, s = 1, o: BuildingOpts = {}) => drawBuilding(ctx, x, y, s, { ...o, tier: 2 });
export const drawAppleCity = (ctx: Ctx, x: number, y: number, s = 1, o: BuildingOpts = {}) => drawBuilding(ctx, x, y, s, { ...o, tier: 3 });
export const drawAppleStar = (ctx: Ctx, x: number, y: number, s = 1, o: BuildingOpts = {}) => drawBuilding(ctx, x, y, s, { ...o, tier: 4 });
export const drawAppleGate = (ctx: Ctx, x: number, y: number, s = 1, o: BuildingOpts = {}) => drawBuilding(ctx, x, y, s, { ...o, tier: 5 });
export const _bm = mix;
