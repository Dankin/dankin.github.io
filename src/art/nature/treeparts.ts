// 树的"升档部件":木牌 / 软梯 / 树屋 / 吊篮+缆绳 / 云 / 星星彩灯。
// 全部是 Ctx 上的纯绘制函数(坐标 = 调用方画布坐标),由 tree.ts 预渲染进分件缓存。
import { Ctx, PAL, rng, mix, rgba, ell, TAU, lerp, circlesPath, Circle } from './common';
import { appleSprite, drawAppleAt } from './apple';

export const WOOD = '#c58d55', WOOD_D = '#8a5a34', WOOD_L = '#e3b57c', ROPE = '#e0c98a', INK = PAL.ink;

/** 厚木板:填色 + 上亮下暗 + 木纹 + 粗描边 */
export function woodRect(c: Ctx, x: number, y: number, w: number, h: number, o: { lw?: number; fill?: string; seed?: number; grain?: boolean } = {}) {
  const lw = o.lw ?? 2.6, fill = o.fill ?? WOOD;
  c.fillStyle = fill; c.fillRect(x, y, w, h);
  c.fillStyle = rgba('#ffffff', 0.28); c.fillRect(x, y, w, Math.max(1.5, h * 0.26));
  c.fillStyle = rgba('#3a200e', 0.3); c.fillRect(x, y + h * 0.74, w, h * 0.26);
  if (o.grain !== false && w > 10) {
    const r = rng((o.seed ?? 1) * 13 + 5); c.strokeStyle = rgba('#3a200e', 0.5); c.lineWidth = 1;
    for (let i = 0; i < 2 + ((w / 18) | 0); i++) { const gx = x + 3 + r() * (w - 8), gy = y + h * (0.3 + r() * 0.4); c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + 3 + r() * 6, gy + (r() - 0.5) * 1.5); c.stroke(); }
  }
  c.strokeStyle = INK; c.lineWidth = lw; c.lineJoin = 'round'; c.strokeRect(x, y, w, h);
}

function rope(c: Ctx, pts: [number, number][], lw = 2.4) {
  c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.lineWidth = lw + 2.4; c.strokeStyle = INK; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  c.lineWidth = lw; c.strokeStyle = ROPE; c.stroke();
}
function quadPts(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, n = 14): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), d = t * t; out.push([a * x0 + b * cx + d * x1, a * y0 + b * cy + d * y1]); }
  return out;
}

// ---------- 2 档:木牌(挂在小枝上) ----------
/** (ax,ay)=挂点(小枝梢);木牌中心在其正下方。k=整体缩放。 */
export function drawSign(c: Ctx, ax: number, ay: number, k: number, seed: number) {
  const w = 32 * k, h = 21 * k, top = ay + 9 * k;
  rope(c, [[ax - 1, ay], [ax - w * 0.36, top + 1]], 1.8 * k + 0.4); rope(c, [[ax + 1, ay], [ax + w * 0.36, top + 1]], 1.8 * k + 0.4);
  c.save(); c.translate(ax, top + h / 2); c.rotate(-0.05);
  woodRect(c, -w / 2, -h / 2, w, h, { lw: 2.6, fill: '#d29a5c', seed, grain: false });
  // 木牌上的小苹果
  drawAppleAt(c, appleSprite('fuji', 'fresh', 32), 0, 0.5 * k, 0.62 * k);
  c.fillStyle = INK; for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * (w / 2 - 3.2), -h / 2 + 3.2, 1.2, 0, TAU); c.fill(); }
  c.restore();
}

// ---------- 3 档:软梯 ----------
/** 两根绳 + 横档,从 (x,yTop) 垂到 (x+bend,yBot) */
export function drawLadder(c: Ctx, x: number, yTop: number, yBot: number, seed: number, bend = 5) {
  const hw = 10, L = yBot - yTop, n = Math.max(3, Math.round(L / 10.5));
  const px = (t: number) => x + bend * t * t;
  for (const sx of [-1, 1]) { const pts: [number, number][] = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([px(t) + sx * hw, yTop + L * t]); } rope(c, pts, 2.2); }
  for (let i = 1; i <= n; i++) {
    const t = (i - 0.4) / (n + 0.2), y = yTop + L * t, xx = px(t);
    woodRect(c, xx - hw - 2.5, y - 2.4, hw * 2 + 5, 5, { lw: 2.2, fill: WOOD, seed: seed + i, grain: false });
  }
  void seed;
}

// ---------- 3 档:树屋 ----------
export interface HouseGeom { hx: number; fy: number; w: number; h: number; roofH: number }
export const HOUSE_W = 68, HOUSE_H = 50, HOUSE_ROOF = 30;
/** hx=屋中心 x;fy=地板上沿 y。屋内(老徐站位)= 以 (hx,fy) 为脚点,宽 HOUSE_W、高 HOUSE_H 的空间。variant 0 红顶 / 1 绿顶 */
export function drawTreehouse(c: Ctx, hx: number, fy: number, trunkX: number, variant: number, seed: number) {
  const W = HOUSE_W, H = HOUSE_H, RH = HOUSE_ROOF;
  const roof = variant ? '#2f8a52' : '#cf3a2e', roofD = variant ? '#1f6238' : '#962218', trim = variant ? '#cf3a2e' : '#f6efdc';
  // 支撑斜梁(先画,在平台下)
  const beam = (x0: number, y0: number, x1: number, y1: number) => {
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineWidth = 9; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke();
    c.lineWidth = 5; c.strokeStyle = WOOD; c.stroke();
  };
  beam(hx - W / 2 + 6, fy + 8, trunkX + 3, fy + 42); beam(hx + W / 2 - 6, fy + 8, trunkX + 5, fy + 50);
  // 平台
  woodRect(c, trunkX - 2, fy, hx + W / 2 + 10 - (trunkX - 2), 9, { lw: 2.8, fill: WOOD, seed });
  // 后墙(屋内):暖色木板 + 竖缝
  const g = c.createLinearGradient(0, fy - H, 0, fy);
  g.addColorStop(0, '#d29a5c'); g.addColorStop(1, '#a8683a');
  c.fillStyle = g; c.fillRect(hx - W / 2, fy - H, W, H);
  c.strokeStyle = rgba('#3a200e', 0.38); c.lineWidth = 1.2;
  for (let x = hx - W / 2 + 11.3; x < hx + W / 2 - 4; x += 11.3) { c.beginPath(); c.moveTo(x, fy - H); c.lineTo(x, fy); c.stroke(); }
  // 屋内小件:悬挂小灯 + 窗
  c.fillStyle = rgba('#3a200e', 0.28); c.fillRect(hx - W / 2, fy - 7, W, 7); // 地板暗影
  c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(hx - W / 2, fy - H, W, H);
  // 立柱
  for (const sx of [-1, 1]) woodRect(c, hx + sx * (W / 2) - 3.5, fy - H - 3, 7, H + 3, { lw: 2.6, fill: WOOD, seed: seed + sx, grain: false });
  // 低栏杆(前)
  const ry = fy - 13;
  woodRect(c, hx - W / 2 - 2, ry, W + 4, 4, { lw: 2.2, fill: WOOD_L, grain: false });
  for (let x = hx - W / 2 + 6; x < hx + W / 2 - 2; x += 9) { c.beginPath(); c.moveTo(x, ry + 4); c.lineTo(x, fy); c.lineWidth = 3.4; c.strokeStyle = INK; c.stroke(); c.lineWidth = 1.5; c.strokeStyle = WOOD_L; c.stroke(); }
  // 山墙(三角,木色)+ 圆窗
  const ey = fy - H, ov = 9;
  c.beginPath(); c.moveTo(hx - W / 2 - ov + 4, ey); c.lineTo(hx, ey - RH + 5); c.lineTo(hx + W / 2 + ov - 4, ey); c.closePath();
  c.fillStyle = '#e0b07a'; c.fill(); c.lineWidth = 2.4; c.strokeStyle = INK; c.stroke();
  // 圆窗(夜里发光)
  ell(c, hx, ey - 9, 6.2, 6.2); c.fillStyle = '#ffe9a0'; c.fill(); c.lineWidth = 2.4; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.moveTo(hx - 6, ey - 9); c.lineTo(hx + 6, ey - 9); c.moveTo(hx, ey - 15); c.lineTo(hx, ey - 3); c.lineWidth = 1.3; c.stroke();
  // 屋顶边(两条粗红椽)+ 雪
  for (const sx of [-1, 1]) {
    const x0 = hx + sx * (W / 2 + ov), x1 = hx;
    c.beginPath(); c.moveTo(x0, ey + 4); c.lineTo(x1, ey - RH - 1); c.lineTo(x1, ey - RH + 9); c.lineTo(x0 - sx * 1, ey + 12); c.closePath();
    c.fillStyle = sx < 0 ? roof : roofD; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke();
    // 雪盖(沿椽上缘的白色起伏)
    c.beginPath(); c.moveTo(x0 + sx * 0.5, ey + 3);
    const n = 5;
    for (let i = 1; i <= n; i++) { const t = i / n, px = lerp(x0, x1, t), py = lerp(ey + 3, ey - RH - 2, t); c.quadraticCurveTo(lerp(x0, x1, t - 0.5 / n), py + 5.5 - (i % 2) * 2, px, py); }
    c.lineTo(x1, ey - RH + 3); c.quadraticCurveTo(lerp(x0, x1, 0.6), ey - RH * 0.5 + 6, x0 - sx * 3, ey + 9); c.closePath();
    c.fillStyle = '#fbfaf2'; c.fill(); c.lineWidth = 2.2; c.strokeStyle = INK; c.stroke();
  }
  // 屋脊小旗
  c.beginPath(); c.moveTo(hx, ey - RH - 1); c.lineTo(hx, ey - RH - 14); c.lineWidth = 2.6; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.moveTo(hx + 1, ey - RH - 14); c.lineTo(hx + 12, ey - RH - 10); c.lineTo(hx + 1, ey - RH - 6); c.closePath(); c.fillStyle = trim === '#f6efdc' ? '#e8b020' : trim; c.fill(); c.lineWidth = 2; c.stroke();
  void mix;
}
/** 树屋夜灯:屋内暖光 + 圆窗,画在已变换坐标里,用 lighter 叠加 */
export function houseGlowRect(hx: number, fy: number) { return { win: { x: hx, y: fy - HOUSE_H - 9 }, room: { x: hx, y: fy - HOUSE_H * 0.5, w: HOUSE_W, h: HOUSE_H } }; }

// ---------- 4 档:吊篮 + 缆绳 ----------
/** (tx,ty)=枝梢挂点。篮口中心 = (tx, ty+36)。 */
export function drawBasket(c: Ctx, tx: number, ty: number, variant: number, seed: number) {
  const bw = 42, rimY = ty + 36, bh = 26, tone = variant ? '#b9803f' : '#d29a52', toneD = variant ? '#7a4a22' : '#9a6428';
  // 篮内苹果(在篮后半)
  const ap = (x: number, y: number, k = 0.62, kind: 'fuji' | 'golden' | 'green' = 'fuji') => drawAppleAt(c, appleSprite(kind, 'fresh', 32), x, y, k);
  ap(tx - 10, rimY - 8, 0.6); ap(tx + 10, rimY - 8, 0.6, 'golden'); ap(tx, rimY - 12, 0.66);
  // 吊索(两侧到挂环)
  for (const sx of [-1, 1]) rope(c, [[tx, ty + 2], [tx + sx * (bw / 2 - 2), rimY]], 2);
  // 挂环 + 钩
  ell(c, tx, ty + 2, 4.6, 4.6); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); c.lineWidth = 1.6; c.strokeStyle = '#d8d0b8'; c.stroke();
  // 篮身:上宽下窄的柳编
  c.beginPath(); c.moveTo(tx - bw / 2, rimY); c.lineTo(tx + bw / 2, rimY); c.lineTo(tx + bw / 2 - 6, rimY + bh); c.quadraticCurveTo(tx, rimY + bh + 6, tx - bw / 2 + 6, rimY + bh); c.closePath();
  const g = c.createLinearGradient(tx - bw / 2, 0, tx + bw / 2, 0); g.addColorStop(0, tone); g.addColorStop(0.6, tone); g.addColorStop(1, toneD);
  c.fillStyle = g; c.fill();
  c.save(); c.clip();
  c.strokeStyle = rgba('#3a200e', 0.55); c.lineWidth = 1.3;
  for (let i = 0; i < 4; i++) { const y = rimY + 5 + i * 6; c.beginPath(); c.moveTo(tx - bw / 2, y); c.quadraticCurveTo(tx, y + 3, tx + bw / 2, y); c.stroke(); }
  for (let x = tx - bw / 2 + 5; x < tx + bw / 2; x += 8) { c.beginPath(); c.moveTo(x, rimY); c.lineTo(x - 2, rimY + bh + 4); c.stroke(); }
  c.restore();
  c.beginPath(); c.moveTo(tx - bw / 2, rimY); c.lineTo(tx + bw / 2, rimY); c.lineTo(tx + bw / 2 - 6, rimY + bh); c.quadraticCurveTo(tx, rimY + bh + 6, tx - bw / 2 + 6, rimY + bh); c.closePath();
  c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
  // 篮口沿
  ell(c, tx, rimY, bw / 2 + 1, 4.2); c.fillStyle = WOOD_L; c.fill(); c.lineWidth = 2.6; c.strokeStyle = INK; c.stroke();
  // 前排苹果(压在篮沿上)
  ap(tx - 15, rimY + 1, 0.56, 'green'); ap(tx + 4, rimY + 2, 0.6); ap(tx + 17, rimY + 1, 0.54);
  void seed;
}
/** 挂彩旗的缆绳:二次曲线下垂 sag,旗子沿线排列 */
export function drawCable(c: Ctx, x0: number, y0: number, x1: number, y1: number, sag: number, seed: number, flags = true) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + sag * 2;
  const pts = quadPts(x0, y0, cx, cy, x1, y1, 18);
  rope(c, pts, 1.8);
  if (!flags) return;
  const cols = ['#cf3a2e', '#fbfaf2', '#2f8a52', '#f2b705'], n = 6;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1), a = (1 - t) * (1 - t), b = 2 * t * (1 - t), d = t * t;
    const px = a * x0 + b * cx + d * x1, py = a * y0 + b * cy + d * y1;
    c.beginPath(); c.moveTo(px - 4.5, py + 1); c.lineTo(px + 4.5, py + 1); c.lineTo(px, py + 11); c.closePath();
    c.fillStyle = cols[(i + seed) % 4]; c.fill(); c.lineWidth = 1.8; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke();
  }
}

// ---------- 云 ----------
/** 卡通云团:圆并集 + 粗描边 + 白→淡蓝渐变 + 底部暗带 + 高光弧。 */
export function cloudBank(c: Ctx, cx: number, cy: number, w: number, h: number, seed: number, alpha = 1) {
  const r = rng(seed * 7 + 3), cs: Circle[] = [], base = cy + h / 2;
  const n = Math.max(4, Math.round(w / (h * 0.62)));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, e = Math.pow(Math.sin(Math.PI * t), 0.75), rr = h * (0.2 + 0.3 * e * (0.8 + r() * 0.4));
    cs.push({ x: cx - w / 2 + t * w + (r() - 0.5) * 4, y: base - rr * 0.95, r: rr });
  }
  for (let i = 0; i < n - 1; i++) { const t = (i + 1) / n; cs.push({ x: cx - w / 2 + t * w, y: base - h * 0.14, r: h * 0.17 }); }
  const pa = c.globalAlpha; c.globalAlpha = pa * alpha;
  circlesPath(c, cs); c.lineWidth = 6; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke();
  const g = c.createLinearGradient(0, base - h, 0, base);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#f2f8fd'); g.addColorStop(1, '#bcd6ea');
  c.fillStyle = g; c.fill();
  c.save(); circlesPath(c, cs); c.clip();
  // 内部起伏线 + 高光弧
  c.strokeStyle = rgba('#8fb4d2', 0.8); c.lineWidth = 1.8;
  for (const q of cs.slice(0, n)) { c.beginPath(); c.arc(q.x + 1, q.y + 1, q.r * 0.78, Math.PI * 0.12, Math.PI * 0.88); c.stroke(); }
  c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 2.4;
  for (const q of cs.slice(0, n)) { c.beginPath(); c.arc(q.x - 1, q.y - 1, q.r * 0.8, Math.PI * 1.08, Math.PI * 1.45); c.stroke(); }
  c.restore();
  c.globalAlpha = pa;
}

// ---------- 5 档:星星 ----------
export function starPath(c: Ctx, x: number, y: number, R: number, r: number, rot = -Math.PI / 2) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + (i * Math.PI) / 5, rr = i % 2 ? r : R; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.closePath();
}
/** 树顶金星 */
export function drawTopStar(c: Ctx, x: number, y: number, R: number) {
  starPath(c, x, y, R, R * 0.48); c.fillStyle = '#ffd23a'; c.fill(); c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = INK; c.stroke();
  c.save(); starPath(c, x, y, R, R * 0.48); c.clip();
  // 右下暗面 + 左上亮面
  c.fillStyle = 'rgba(214,140,10,0.55)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + R * 1.4, y - R * 0.2); c.lineTo(x + R * 1.2, y + R * 1.4); c.lineTo(x - R * 0.2, y + R * 1.3); c.closePath(); c.fill();
  c.restore();
  starPath(c, x - R * 0.12, y - R * 0.12, R * 0.5, R * 0.24); c.fillStyle = 'rgba(255,250,200,0.85)'; c.fill();
}
export const BULB_COLORS = ['#ff4d4d', '#ffd23a', '#4cc3ff', '#6bdc4a', '#ff8fd0', '#ffa13a'];
/** 灯泡本体(小帽 + 彩色泡 + 高光),灯光由 tree.ts 动态叠加 */
export function drawBulb(c: Ctx, x: number, y: number, col: string, r = 3.6) {
  c.fillStyle = '#2a3a2a'; c.fillRect(x - 1.6, y - r - 2.2, 3.2, 3);
  ell(c, x, y, r, r * 1.12); c.fillStyle = col; c.fill(); c.lineWidth = 1.6; c.strokeStyle = INK; c.stroke();
  ell(c, x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.24); c.fillStyle = 'rgba(255,255,255,0.9)'; c.fill();
}
