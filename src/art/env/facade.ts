/**
 * 手绘建筑立面（墙）。每张纹理 = WALL_TILES 个瓦片长（默认 10 瓦片 = 160 源像素），
 * 先画“平面立面”，再斜切成等距墙（ne：沿 +tx；nw：沿 +ty，x 轴从远端到近端）。
 *
 * 返回 WallTex：
 *   canvas   位图 = 源尺寸 × SS（显示：setScale(ART_SCALE)，origin 0,0）
 *   windows  窗/橱窗中心，已换算成“成品画布”的源像素坐标（不用再自己做斜切公式）；lit=true 的会亮灯
 *   ax, ay   “地线起点”在画布里的源像素位置：图片左上角 = toScreen(tx,ty) − (ax,ay)·PX
 *            ne：tx,ty = 墙段起点（沿 +tx 延伸）；nw：tx,ty = 墙段近端（沿 +ty 延伸，图往左上延伸）
 *   len      瓦片长度（WALL_TILES）
 */
import { newCanvas, ctxOf, applyPaper, hash2, rng, shade, mix, rgba, PAL, paint, pRect, pPoly, pBlob, pEllipse, strokePath, speckles, lin, radial, type Ctx, type Pt } from '../brush';
import { SS } from '../scale';

export const WALL_TILES = 10;
const FW = WALL_TILES * 16; // 立面平面宽度（源像素）
const TP = 10; // 屋顶雪帽/屋脊留白
export interface WallWin { x: number; y: number; lit: boolean }
export interface WallTex { canvas: HTMLCanvasElement; windows: WallWin[]; ax: number; ay: number; len: number }

const FONT = '"STKaiti","Kaiti SC","KaiTi","Songti SC","SimSun","PingFang SC","Noto Serif CJK SC",serif';
const SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';

// ════════════ 小部件 ════════════
interface Ctx2 { x: Ctx; seed: number; wins: WallWin[]; }
const R = (c: Ctx2, k = 0) => rng(c.seed * 131 + k * 17 + 5);

function bricks(x: Ctx, X0: number, Y0: number, W: number, H: number, col: string, mortar: string, seed: number, o: { bw?: number; bh?: number; vary?: number } = {}) {
  const bw = o.bw ?? 7, bh = o.bh ?? 3.3, vary = o.vary ?? 0.18;
  x.fillStyle = mortar; x.fillRect(X0, Y0, W, H);
  x.save(); x.beginPath(); x.rect(X0, Y0, W, H); x.clip();
  for (let r = 0, y = Y0; y < Y0 + H; r++, y += bh) {
    const off = (r % 2) * bw * 0.5 - hash2(r, seed) * 2;
    for (let xx = X0 + off - bw; xx < X0 + W; xx += bw) {
      const id = hash2(Math.floor(xx), r, seed, 3), patch = hash2(Math.floor((xx - X0) / 22), Math.floor((y - Y0) / 14), seed, 8);
      const c = shade(col, (id - 0.5) * vary + (patch - 0.5) * 0.12);
      x.fillStyle = c; x.fillRect(xx + 0.35, y + 0.3, bw - 0.7, bh - 0.6);
      x.fillStyle = rgba(shade(c, 0.5), 0.35); x.fillRect(xx + 0.35, y + 0.3, bw - 0.7, 0.5);
      x.fillStyle = rgba(shade(c, -0.5), 0.28); x.fillRect(xx + 0.35, y + bh - 0.7, bw - 0.7, 0.4);
      if (id > 0.9) { x.fillStyle = rgba('#2a1a14', 0.18); x.fillRect(xx + 1, y + 0.8, bw * 0.4, 1.1); }
    }
  }
  x.restore();
}
function plaster(x: Ctx, X0: number, Y0: number, W: number, H: number, col: string, seed: number, o: { lines?: number } = {}) {
  x.fillStyle = lin(x, X0, Y0, X0 + W * 0.3, Y0 + H, [[0, shade(col, 0.1)], [1, shade(col, -0.1)]]); x.fillRect(X0, Y0, W, H);
  x.save(); x.beginPath(); x.rect(X0, Y0, W, H); x.clip();
  const r = rng(seed + 9);
  for (let i = 0; i < Math.round(W * H / 120); i++) { x.globalAlpha = 0.06 + r() * 0.1; x.fillStyle = r() > 0.5 ? shade(col, 0.2) : shade(col, -0.2); x.beginPath(); x.ellipse(X0 + r() * W, Y0 + r() * H, 3 + r() * 9, 2 + r() * 6, r() * 3, 0, 6.3); x.fill(); }
  x.globalAlpha = 1;
  if (o.lines) for (let y = Y0 + o.lines; y < Y0 + H; y += o.lines) { x.strokeStyle = rgba(shade(col, -0.4), 0.3); x.lineWidth = 0.4; x.beginPath(); x.moveTo(X0, y); x.lineTo(X0 + W, y); x.stroke(); x.strokeStyle = rgba('#fff', 0.25); x.beginPath(); x.moveTo(X0, y + 0.5); x.lineTo(X0 + W, y + 0.5); x.stroke(); }
  // 渗水/裂纹
  for (let k = 0; k < 3; k++) { const sx = X0 + r() * W, sy = Y0 + r() * H * 0.5; x.strokeStyle = rgba(shade(col, -0.5), 0.28); x.lineWidth = 0.4; x.beginPath(); x.moveTo(sx, sy); let cx = sx, cy = sy; for (let s = 0; s < 4; s++) { cx += (r() - 0.5) * 3; cy += 1.5 + r() * 2.5; x.lineTo(cx, cy); } x.stroke(); }
  x.restore();
}
function planks(x: Ctx, X0: number, Y0: number, W: number, H: number, col: string, seed: number, horizontal = false) {
  const pw = horizontal ? 4.2 : 5;
  x.save(); x.beginPath(); x.rect(X0, Y0, W, H); x.clip(); x.fillStyle = shade(col, -0.5); x.fillRect(X0, Y0, W, H);
  const n = Math.ceil((horizontal ? H : W) / pw);
  for (let i = 0; i < n; i++) {
    const c = shade(col, (hash2(i, seed, 1) - 0.5) * 0.24);
    if (horizontal) { x.fillStyle = c; x.fillRect(X0, Y0 + i * pw + 0.3, W, pw - 0.55); x.fillStyle = rgba(shade(c, 0.5), 0.4); x.fillRect(X0, Y0 + i * pw + 0.3, W, 0.6); x.fillStyle = rgba(shade(c, -0.5), 0.35); x.fillRect(X0, Y0 + i * pw + pw - 0.9, W, 0.4); }
    else { x.fillStyle = c; x.fillRect(X0 + i * pw + 0.3, Y0, pw - 0.55, H); x.fillStyle = rgba(shade(c, 0.5), 0.4); x.fillRect(X0 + i * pw + 0.3, Y0, 0.6, H); x.fillStyle = rgba(shade(c, -0.5), 0.3); x.fillRect(X0 + i * pw + pw - 0.9, Y0, 0.4, H); }
    x.strokeStyle = rgba(shade(c, -0.45), 0.35); x.lineWidth = 0.28;
    for (let g = 0; g < 2; g++) { x.beginPath(); if (horizontal) { const yy = Y0 + i * pw + 1.3 + g * 1.4; x.moveTo(X0 + hash2(i, g, seed) * 20, yy); x.bezierCurveTo(X0 + W * 0.3, yy + 0.5, X0 + W * 0.6, yy - 0.5, X0 + W - hash2(i, g, 5) * 20, yy + 0.2); } else { const xx = X0 + i * pw + 1.5 + g * 1.6; x.moveTo(xx, Y0 + hash2(i, g, seed) * 14); x.bezierCurveTo(xx + 0.5, Y0 + H * 0.3, xx - 0.5, Y0 + H * 0.6, xx + 0.2, Y0 + H - hash2(i, g, 5) * 14); } x.stroke(); }
  }
  x.restore();
}
/** 屋檐瓦带（y 为顶），返回占高 */
function roofBand(x: Ctx, X0: number, W: number, y: number, h: number, col: string, kind: 'tile' | 'tin' | 'slate' | 'wood', seed: number) {
  const dark = shade(col, -0.35);
  x.save(); x.beginPath(); x.rect(X0, y, W, h); x.clip();
  x.fillStyle = lin(x, 0, y, 0, y + h, [[0, shade(col, 0.15)], [1, dark]]); x.fillRect(X0, y, W, h);
  if (kind === 'tile') {
    for (let r = 0; r < Math.ceil(h / 2.6); r++) for (let xx = X0 - (r % 2) * 2.2; xx < X0 + W; xx += 4.4) {
      const yy = y + r * 2.6, c = shade(col, (hash2(Math.floor(xx), r, seed) - 0.5) * 0.2);
      x.fillStyle = c; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + 4.4, yy); x.lineTo(xx + 4.4, yy + 1.4); x.quadraticCurveTo(xx + 2.2, yy + 3.6, xx, yy + 1.4); x.closePath(); x.fill();
      x.strokeStyle = rgba(shade(col, -0.6), 0.5); x.lineWidth = 0.35; x.stroke();
      x.strokeStyle = rgba(shade(col, 0.5), 0.4); x.beginPath(); x.moveTo(xx + 0.4, yy + 0.3); x.lineTo(xx + 3.6, yy + 0.3); x.stroke();
    }
  } else if (kind === 'tin') {
    for (let xx = X0; xx < X0 + W; xx += 3) { x.fillStyle = rgba(shade(col, 0.3), 0.5); x.fillRect(xx, y, 0.8, h); x.fillStyle = rgba(shade(col, -0.5), 0.5); x.fillRect(xx + 1.5, y, 0.6, h); }
  } else if (kind === 'slate') {
    for (let r = 0; r < Math.ceil(h / 2.4); r++) for (let xx = X0 - (r % 2) * 2.5; xx < X0 + W; xx += 5) { x.fillStyle = shade(col, (hash2(Math.floor(xx), r, seed) - 0.5) * 0.25); x.fillRect(xx + 0.2, y + r * 2.4, 4.6, 2.2); x.fillStyle = rgba(shade(col, -0.6), 0.45); x.fillRect(xx + 0.2, y + r * 2.4 + 2, 4.6, 0.35); }
  } else { planks(x, X0, y, W, h, col, seed, true); }
  x.restore();
  strokePath(x, [[X0, y + h], [X0 + W * 0.5, y + h + 0.3], [X0 + W, y + h]], { w: 0.9, color: PAL.ink, seed: seed + 1 });
  // 檐下阴影
  const g = lin(x, 0, y + h, 0, y + h + 4, [[0, 'rgba(50,30,60,0.35)'], [1, 'rgba(50,30,60,0)']]); x.fillStyle = g; x.fillRect(X0, y + h + 0.5, W, 4);
}
/** 水平线脚/腰线 */
function belt(x: Ctx, X0: number, W: number, y: number, h: number, col: string) {
  x.fillStyle = lin(x, 0, y, 0, y + h, [[0, shade(col, 0.2)], [1, shade(col, -0.15)]]); x.fillRect(X0, y, W, h);
  strokePath(x, [[X0, y], [X0 + W, y + 0.1]], { w: 0.55, color: rgba(PAL.ink, 0.7), seed: Math.round(y) });
  strokePath(x, [[X0, y + h], [X0 + W, y + h + 0.1]], { w: 0.7, color: rgba(PAL.ink, 0.8), seed: Math.round(y) + 4 });
  x.fillStyle = 'rgba(50,30,70,0.22)'; x.fillRect(X0, y + h, W, 2.2);
  x.fillStyle = rgba('#fff', 0.4); x.fillRect(X0, y + 0.5, W, 0.5);
}
/** 积雪帽（沿水平边，topY 为边的 y，向上堆） */
function snowCap(x: Ctx, x0: number, x1: number, topY: number, th: number, seed: number) {
  const r = rng(seed);
  const pts: Pt[] = [[x0, topY + 0.6]];
  for (let xx = x0; xx <= x1; xx += 3) pts.push([xx, topY - th * (0.55 + r() * 0.6) - Math.sin((xx - x0) * 0.35) * th * 0.15]);
  pts.push([x1, topY + 0.6]);
  paint(x, pts, { fill: PAL.snow, fill2: PAL.snowShade, stroke: PAL.inkCool, w: 0.5, mottle: 0.1, grain: 0, edge: 0.15, hi: 0.5, rim: 0.7, amp: 0.3, step: 2.2, seed });
}
function icicles(x: Ctx, x0: number, x1: number, y: number, seed: number, dens = 0.55) {
  const r = rng(seed);
  for (let xx = x0 + 2; xx < x1 - 1; xx += 2.5 + r() * 3) if (r() < dens) {
    const h = 1.5 + r() * 3.6; x.fillStyle = rgba('#e9f4fb', 0.9); x.beginPath(); x.moveTo(xx - 0.7, y); x.lineTo(xx + 0.7, y); x.lineTo(xx + (r() - 0.5) * 0.4, y + h); x.closePath(); x.fill();
    x.strokeStyle = rgba('#7d95b8', 0.7); x.lineWidth = 0.28; x.stroke();
  }
}
function pushWin(c: Ctx2, cx: number, cy: number, lit: boolean) { c.wins.push({ x: cx, y: cy, lit }); }

/** 老式推拉/平开窗 */
function sashWindow(c: Ctx2, cx: number, top: number, w: number, h: number, o: { shutter?: string; lintel?: string; arch?: boolean; lit?: boolean; curtain?: string; flower?: boolean; frame?: string; snow?: boolean; white?: boolean } = {}) {
  const x = c.x, lit = o.lit ?? hash2(cx, top, c.seed) > 0.45, frame = o.frame ?? '#5a3a28', R_ = R(c, Math.round(cx));
  const x0 = cx - w / 2;
  // 石过梁
  if (o.lintel !== 'none') paint(x, pRect(x0 - 2.2, top - 3, w + 4.4, 3.2, { amp: 0.25 }), { fill: o.lintel ?? PAL.stoneLight, w: 0.55, mottle: 0.2, grain: 0.2, edge: 0.2 });
  // 窗框 + 玻璃
  const outline = o.arch
    ? [[x0, top + h], [x0, top + w * 0.5], [x0 + w * 0.12, top + w * 0.15], [cx, top], [x0 + w * 0.88, top + w * 0.15], [x0 + w, top + w * 0.5], [x0 + w, top + h]] as Pt[]
    : null;
  if (outline) { paint(x, outline, { fill: frame, w: 0.7, amp: 0.2, step: 2, mottle: 0.2 }); }
  else paint(x, pRect(x0 - 0.8, top - 0.6, w + 1.6, h + 1.2, { amp: 0.2 }), { fill: frame, w: 0.65, mottle: 0.2, grain: 0.2 });
  const gx = x0 + 0.9, gw = w - 1.8, gy = top + 0.9, gh = h - 1.8;
  x.save();
  if (outline) { x.beginPath(); x.moveTo(gx, top + h - 0.9); x.lineTo(gx, top + w * 0.5); x.quadraticCurveTo(gx, top + 1, cx, top + 0.9); x.quadraticCurveTo(gx + gw, top + 1, gx + gw, top + w * 0.5); x.lineTo(gx + gw, top + h - 0.9); x.closePath(); x.clip(); } else { x.beginPath(); x.rect(gx, gy, gw, gh); x.clip(); }
  x.fillStyle = lin(x, gx, gy, gx + gw * 0.6, gy + gh, [[0, lit ? '#f7c97a' : '#8ba6c0'], [1, lit ? '#d9854a' : '#4e6784']]); x.fillRect(gx - 1, top, gw + 2, h);
  if (lit) { x.fillStyle = radial(x, cx, top + h * 0.6, w * 0.9, [[0, 'rgba(255,240,190,0.85)'], [1, 'rgba(255,200,120,0)']]); x.fillRect(gx - 1, top, gw + 2, h); }
  else { x.fillStyle = rgba('#fff', 0.28); x.beginPath(); x.moveTo(gx + gw * 0.15, gy + gh); x.lineTo(gx + gw * 0.55, gy); x.lineTo(gx + gw * 0.8, gy); x.lineTo(gx + gw * 0.4, gy + gh); x.closePath(); x.fill(); }
  // 内侧阴影
  x.fillStyle = 'rgba(40,20,50,0.28)'; x.fillRect(gx - 1, gy - 1, gw + 2, 1.6); x.fillRect(gx - 1, gy, 1.5, gh);
  // 窗帘
  if (o.curtain || (lit && R_() > 0.4)) { const cc = o.curtain ?? R_.pick(['#e8b0a0', '#f1e2c0', '#b7d0c0']); x.fillStyle = rgba(cc, 0.8); x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + gw * 0.38, gy); x.quadraticCurveTo(gx + gw * 0.2, gy + gh * 0.5, gx + gw * 0.12, gy + gh); x.lineTo(gx, gy + gh); x.closePath(); x.fill(); x.beginPath(); x.moveTo(gx + gw, gy); x.lineTo(gx + gw * 0.62, gy); x.quadraticCurveTo(gx + gw * 0.8, gy + gh * 0.5, gx + gw * 0.88, gy + gh); x.lineTo(gx + gw, gy + gh); x.closePath(); x.fill(); }
  x.restore();
  // 窗棂
  x.strokeStyle = frame; x.lineWidth = 0.7; x.beginPath(); x.moveTo(cx, gy); x.lineTo(cx, gy + gh); x.moveTo(gx, gy + gh * 0.42); x.lineTo(gx + gw, gy + gh * 0.42); x.stroke();
  x.strokeStyle = rgba(shade(frame, 0.5), 0.6); x.lineWidth = 0.3; x.beginPath(); x.moveTo(cx - 0.4, gy); x.lineTo(cx - 0.4, gy + gh); x.stroke();
  // 百叶窗
  if (o.shutter) {
    const sw = Math.max(3, w * 0.34);
    [[x0 - sw - 0.8, 'l'], [x0 + w + 0.8, 'r']].forEach(([sx0]) => {
      const sx = sx0 as number;
      paint(x, pRect(sx, top - 0.5, sw, h + 1, { amp: 0.2 }), { fill: o.shutter!, w: 0.6, mottle: 0.2, grain: 0.2 });
      x.strokeStyle = rgba(shade(o.shutter!, -0.45), 0.6); x.lineWidth = 0.3;
      for (let yy = top + 1.5; yy < top + h; yy += 1.7) { x.beginPath(); x.moveTo(sx + 0.6, yy); x.lineTo(sx + sw - 0.6, yy + 0.4); x.stroke(); }
    });
  }
  // 窗台
  paint(x, pRect(x0 - 2, top + h + 0.4, w + 4, 2.2, { amp: 0.2 }), { fill: PAL.stone, w: 0.5, mottle: 0.1, grain: 0.1, edge: 0.2 });
  x.fillStyle = 'rgba(50,30,70,0.2)'; x.fillRect(x0 - 2, top + h + 2.6, w + 4, 1.8);
  if (o.snow !== false && R_() > 0.35) snowCap(x, x0 - 1.4, x0 + w + 1.4, top + h + 0.5, 1.5 + R_() * 1, Math.round(cx * 7 + top));
  if (o.flower) { for (let k = 0; k < 4; k++) { const fx = x0 + 1 + k * (w - 2) / 3; x.fillStyle = k % 2 ? PAL.greenDark : PAL.green; x.beginPath(); x.ellipse(fx, top + h - 0.3, 1.6, 1.4, 0, 0, 6.3); x.fill(); x.fillStyle = [PAL.red, PAL.pink, PAL.gold, '#f5efe0'][k]; x.beginPath(); x.arc(fx + 0.3, top + h - 1.4, 0.75, 0, 6.3); x.fill(); } }
  pushWin(c, cx, top + h * 0.5, lit);
}

/** 石库门：石框 + 山花 + 黑漆双扇门 + 铜环 */
function shikumen(c: Ctx2, gx: number, baseY: number, gh: number, o: { lintel?: string; wreath?: boolean } = {}) {
  const x = c.x, w = 24, top = baseY - gh;
  // 门框石
  paint(x, pRect(gx - 3, top - 1, w + 6, gh + 1, { amp: 0.25 }), { fill: o.lintel ?? '#dcd3c0', w: 0.8, mottle: 0.25, grain: 0.3 });
  // 山花（弧形）
  const arc: Pt[] = [[gx - 4.5, top + 1.5], [gx - 1, top - 4], [gx + 5, top - 6.5], [gx + 12, top - 8], [gx + 19, top - 6.5], [gx + 25, top - 4], [gx + 28.5, top + 1.5]];
  paint(x, arc, { fill: shade(o.lintel ?? '#e6dcc8', 0.05), w: 0.8, amp: 0.15, step: 2, mottle: 0.2 });
  x.fillStyle = PAL.red; x.beginPath(); x.arc(gx + 12, top - 3.3, 1.3, 0, 6.3); x.fill(); // 徽章
  // 两道线脚
  strokePath(x, [[gx - 2, top + 2.5], [gx + w + 2, top + 2.5]], { w: 0.5, color: rgba(PAL.stoneDark, 0.9), seed: gx });
  // 门洞与双扇门
  paint(x, pRect(gx + 1.5, top + 4, w - 3, gh - 4, { amp: 0.15 }), { fill: '#2b2220', fill2: '#171210', w: 0.7, mottle: 0.1, grain: 0, hi: 0.2, rim: 0 });
  x.strokeStyle = rgba('#7a5a40', 0.55); x.lineWidth = 0.4; for (let k = 1; k < 4; k++) { const px = gx + 1.5 + k * (w - 3) / 4; if (k === 2) continue; x.beginPath(); x.moveTo(px, top + 5); x.lineTo(px, baseY - 1); x.stroke(); }
  x.strokeStyle = '#120d0b'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(gx + w / 2, top + 4); x.lineTo(gx + w / 2, baseY); x.stroke();
  x.strokeStyle = rgba('#7a5a40', 0.6); x.lineWidth = 0.4; x.strokeRect(gx + 3.5, top + 6.5, w / 2 - 4, gh * 0.35); x.strokeRect(gx + w / 2 + 0.7, top + 6.5, w / 2 - 4, gh * 0.35);
  // 铜环
  [gx + w / 2 - 3.2, gx + w / 2 + 3.2].forEach((px) => { x.fillStyle = PAL.brass; x.beginPath(); x.arc(px, top + gh * 0.5, 1.3, 0, 6.3); x.fill(); x.strokeStyle = '#7a5a20'; x.lineWidth = 0.3; x.stroke(); x.fillStyle = '#fff4c0'; x.fillRect(px - 0.7, top + gh * 0.5 - 0.7, 0.5, 0.5); });
  if (o.wreath !== false) { // 圣诞花环
    const wx = gx + w / 2 - 3.2, wy = top + gh * 0.28; x.strokeStyle = PAL.green; x.lineWidth = 1.7; x.beginPath(); x.arc(wx, wy, 3.1, 0, 6.3); x.stroke(); x.strokeStyle = PAL.greenLight; x.lineWidth = 0.5; x.beginPath(); x.arc(wx - 0.3, wy - 0.2, 3.1, 3.5, 5.6); x.stroke();
    [0, 2.1, 4.2].forEach((a) => { x.fillStyle = PAL.red; x.beginPath(); x.arc(wx + Math.cos(a) * 3.1, wy + Math.sin(a) * 3.1, 0.7, 0, 6.3); x.fill(); });
    x.fillStyle = PAL.red; x.beginPath(); x.moveTo(wx, wy + 3.4); x.lineTo(wx - 1.8, wy + 6); x.lineTo(wx, wy + 4.8); x.lineTo(wx + 1.8, wy + 6); x.closePath(); x.fill();
  }
  // 台阶 + 门槛
  paint(x, pRect(gx - 2, baseY - 1.6, w + 4, 2.4, { amp: 0.2 }), { fill: PAL.stoneLight, w: 0.5, mottle: 0.1 });
  snowCap(x, gx - 4, gx + w + 3, top - 0.2 + 0.0, 1.4, gx + 3);
  pushWin(c, gx + w / 2, top + gh * 0.55, false);
  c.wins.pop(); // 门不发光
}

/** 条纹雨棚（y 顶，h 垂下高度），自带扇形下摆 */
function awning(c: Ctx2, x0: number, w: number, y: number, h: number, c1: string, c2: string) {
  const x = c.x, n = Math.max(3, Math.round(w / 5)), sw = w / n;
  for (let i = 0; i < n; i++) {
    const a = x0 + i * sw, col = i % 2 ? c2 : c1, drop = h * (0.82 + 0.12 * Math.sin(i * 1.7));
    x.fillStyle = lin(x, a, y, a + sw, y + h, [[0, shade(col, 0.15)], [1, shade(col, -0.18)]]);
    x.beginPath(); x.moveTo(a, y); x.lineTo(a + sw, y); x.lineTo(a + sw, y + drop); x.quadraticCurveTo(a + sw / 2, y + drop + 2.6, a, y + drop); x.closePath(); x.fill();
    x.strokeStyle = rgba(PAL.ink, 0.75); x.lineWidth = 0.5; x.stroke();
  }
  x.fillStyle = 'rgba(70,40,90,0.18)'; x.fillRect(x0, y + h + 1, w, 2.2);
  snowCap(x, x0, x0 + w, y, 1.8, Math.round(x0 * 3 + y));
}
function lanterns(c: Ctx2, xs: number[], y: number) {
  const x = c.x;
  xs.forEach((lx, k) => {
    strokePath(x, [[lx, y - 4], [lx, y]], { w: 0.5, color: PAL.ink, seed: k });
    x.fillStyle = radial(x, lx, y + 4, 8, [[0, 'rgba(255,190,90,0.55)'], [1, 'rgba(255,190,90,0)']]); x.fillRect(lx - 9, y - 4, 18, 18);
    paint(x, pEllipse(lx, y + 4, 2.7, 3.3, { amp: 0.15 }), { fill: '#e3412f', fill2: '#9d2a2a', w: 0.6, mottle: 0.2, grain: 0.1 });
    x.fillStyle = PAL.gold; x.fillRect(lx - 1.3, y + 0.6, 2.6, 0.8); x.fillRect(lx - 1.3, y + 6.8, 2.6, 0.8);
    strokePath(x, [[lx, y + 7.8], [lx, y + 10]], { w: 0.5, color: PAL.gold, seed: k + 3 });
    x.fillStyle = 'rgba(255,255,255,0.45)'; x.beginPath(); x.ellipse(lx - 0.9, y + 3.1, 0.6, 1.2, 0, 0, 6.3); x.fill();
  });
}
function stringLights(c: Ctx2, x0: number, x1: number, y: number, sag: number, seed: number) {
  const x = c.x, r = rng(seed), n = Math.round((x1 - x0) / 5.5), cols = [PAL.gold, PAL.red, '#f6efd2', PAL.teal, PAL.orange];
  const pt = (t: number): Pt => [x0 + (x1 - x0) * t, y + Math.sin(t * Math.PI) * sag];
  const pts: Pt[] = []; for (let i = 0; i <= 24; i++) pts.push(pt(i / 24));
  strokePath(x, pts, { w: 0.5, color: '#2a2230', seed });
  for (let i = 0; i <= n; i++) {
    const [px, py] = pt(i / n), col = cols[Math.floor(r() * cols.length)];
    x.fillStyle = radial(x, px, py + 1.6, 4.2, [[0, rgba(col, 0.6)], [1, rgba(col, 0)]]); x.fillRect(px - 5, py - 3, 10, 10);
    x.fillStyle = col; x.beginPath(); x.ellipse(px, py + 1.4, 0.9, 1.3, 0, 0, 6.3); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.8)'; x.fillRect(px - 0.4, py + 0.7, 0.4, 0.5);
  }
}
function laundry(c: Ctx2, x0: number, x1: number, y: number, seed: number) {
  const x = c.x, r = rng(seed);
  strokePath(x, [[x0 - 2, y - 1], [x1 + 2, y + 1]], { w: 1.2, color: '#9a7544', seed });
  strokePath(x, [[x0 - 2, y - 0.6], [x1 + 2, y + 1.4]], { w: 0.4, color: '#d2ac70', seed: seed + 1 });
  let px = x0 + 1;
  while (px < x1 - 3) {
    const w = 4 + r() * 4, h = 5 + r() * 6, col = r.pick(['#f1ece0', '#e0413f', '#3a8fd9', '#f2c230', '#8dc4a0', '#e8a0b0', '#7b6bb0']), yy = y + (px - x0) / (x1 - x0) * 2;
    const kind = r();
    x.fillStyle = col; x.beginPath();
    if (kind < 0.35) { x.moveTo(px, yy); x.lineTo(px + w, yy); x.lineTo(px + w * 0.9, yy + h * 1.2); x.quadraticCurveTo(px + w / 2, yy + h * 1.35, px + w * 0.1, yy + h * 1.2); } // 被单
    else if (kind < 0.7) { x.moveTo(px, yy); x.lineTo(px + w, yy); x.lineTo(px + w + 1.5, yy + h * 0.45); x.lineTo(px + w - 0.8, yy + h * 0.55); x.lineTo(px + w - 0.8, yy + h); x.lineTo(px + 0.8, yy + h); x.lineTo(px + 0.8, yy + h * 0.55); x.lineTo(px - 1.5, yy + h * 0.45); } // 衣服
    else { x.moveTo(px, yy); x.lineTo(px + w * 0.9, yy); x.lineTo(px + w * 0.8, yy + h * 0.9); x.lineTo(px + w * 0.45, yy + h * 0.6); x.lineTo(px + w * 0.1, yy + h * 0.9); } // 裤/围巾
    x.closePath(); x.fill(); x.strokeStyle = rgba(PAL.ink, 0.6); x.lineWidth = 0.4; x.stroke();
    x.fillStyle = rgba('#fff', 0.25); x.fillRect(px + 0.5, yy + 0.4, w * 0.3, h * 0.5);
    px += w + 2 + r() * 3;
  }
}
function pipe(x: Ctx, px: number, y0: number, y1: number) {
  x.fillStyle = '#6a6a78'; x.fillRect(px, y0, 1.7, y1 - y0); x.fillStyle = rgba('#fff', 0.35); x.fillRect(px, y0, 0.5, y1 - y0); x.fillStyle = 'rgba(30,20,50,0.35)'; x.fillRect(px + 1.2, y0, 0.5, y1 - y0);
  x.strokeStyle = rgba(PAL.ink, 0.6); x.lineWidth = 0.35; x.strokeRect(px, y0, 1.7, y1 - y0);
  for (let y = y0 + 6; y < y1; y += 14) { x.fillStyle = '#4a4a58'; x.fillRect(px - 0.5, y, 2.7, 0.9); }
}
function ivy(c: Ctx2, x0: number, x1: number, y0: number, y1: number, seed: number, snowy = true) {
  const x = c.x, r = rng(seed);
  x.strokeStyle = '#5a3a24'; x.lineWidth = 0.5; for (let k = 0; k < 5; k++) { x.beginPath(); let vx = x0 + r() * (x1 - x0), vy = y1; x.moveTo(vx, vy); while (vy > y0 + r() * (y1 - y0) * 0.5) { vx += (r() - 0.5) * 4; vy -= 3 + r() * 3; x.lineTo(vx, vy); } x.stroke(); }
  for (let i = 0; i < (x1 - x0) * (y1 - y0) / 4.5; i++) {
    const cxm = (x0 + x1) / 2, px = cxm + (r() + r() - 1) * (x1 - x0) * 0.5, py = y0 + Math.pow(r(), 0.7) * (y1 - y0), s = 0.7 + r() * 1.0;
    const col = r.pick(['#7f5a34', '#a8683a', '#6d3a2e', '#8b6a3e', '#4d5a38']);
    x.fillStyle = col; x.beginPath(); x.ellipse(px, py, s, s * 0.75, r() * 3, 0, 6.3); x.fill();
  }
  if (snowy) for (let i = 0; i < 8; i++) { x.fillStyle = rgba('#f6eeef', 0.8); x.beginPath(); x.ellipse(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0) * 0.8, 1 + r(), 0.6, 0, 0, 6.3); x.fill(); }
}
function sign(c: Ctx2, cx: number, cy: number, w: number, h: number, text: string, o: { bg?: string; fg?: string; font?: number; edge?: string; sans?: boolean; hang?: boolean } = {}) {
  const x = c.x, bg = o.bg ?? '#7a2a28', fg = o.fg ?? PAL.gold;
  if (o.hang) { strokePath(x, [[cx - w / 2 + 3, cy - h / 2 - 5], [cx - w / 2 + 3, cy - h / 2]], { w: 0.6, color: PAL.ink, seed: 1 }); strokePath(x, [[cx + w / 2 - 3, cy - h / 2 - 5], [cx + w / 2 - 3, cy - h / 2]], { w: 0.6, color: PAL.ink, seed: 2 }); }
  paint(x, pRect(cx - w / 2, cy - h / 2, w, h, { amp: 0.25 }), { fill: bg, w: 0.8, mottle: 0.25, grain: 0.25 });
  strokePath(x, [[cx - w / 2 + 1.1, cy - h / 2 + 1.1], [cx + w / 2 - 1.1, cy - h / 2 + 1.1], [cx + w / 2 - 1.1, cy + h / 2 - 1.1], [cx - w / 2 + 1.1, cy + h / 2 - 1.1], [cx - w / 2 + 1.1, cy - h / 2 + 1.1]], { w: 0.4, color: o.edge ?? PAL.gold, alpha: 0.8, seed: 3 });
  x.save(); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `bold ${o.font ?? Math.min(h * 0.62, w / Math.max(2, text.length) * 1.05)}px ${o.sans ? SANS : FONT}`;
  x.shadowColor = 'rgba(30,10,10,0.6)'; x.shadowBlur = 0; x.shadowOffsetY = 0.5; x.fillText(text, cx, cy + 0.3); x.restore();
  snowCap(x, cx - w / 2, cx + w / 2, cy - h / 2, 1.3, Math.round(cx + cy));
}
function shopWindow(c: Ctx2, sx: number, w: number, y: number, h: number, o: { items?: 'bread' | 'tea' | 'flowers' | 'goods' | 'mail'; lit?: boolean; frame?: string } = {}) {
  const x = c.x, lit = o.lit ?? true, frame = o.frame ?? '#4a3022';
  paint(x, pRect(sx, y, w, h, { amp: 0.2 }), { fill: frame, w: 0.7, mottle: 0.2, grain: 0.2 });
  x.save(); x.beginPath(); x.rect(sx + 1.2, y + 1.2, w - 2.4, h - 2.4); x.clip();
  x.fillStyle = lin(x, sx, y, sx + w * 0.4, y + h, [[0, lit ? '#ffe3a0' : '#8aa4bb'], [1, lit ? '#e0924e' : '#456078']]); x.fillRect(sx, y, w, h);
  x.fillStyle = radial(x, sx + w / 2, y + h * 0.65, w * 0.7, [[0, 'rgba(255,245,200,0.8)'], [1, 'rgba(255,210,130,0)']]); x.fillRect(sx, y, w, h);
  // 货品
  const base = y + h - 1.2, r = R(c, Math.round(sx));
  if (o.items === 'bread') { x.fillStyle = '#7a4c2a'; x.fillRect(sx + 1.2, base - 4, w - 2.4, 1); for (let i = 0; i < Math.floor(w / 5); i++) { const bx = sx + 3 + i * 5; x.fillStyle = r.pick(['#c98440', '#dba35a', '#b86c32']); x.beginPath(); x.ellipse(bx, base - 6, 2.2, 1.3, 0.1, 0, 6.3); x.fill(); x.strokeStyle = rgba(PAL.ink, 0.5); x.lineWidth = 0.3; x.stroke(); x.strokeStyle = rgba('#fff0c0', 0.7); x.beginPath(); x.moveTo(bx - 1, base - 6.4); x.lineTo(bx + 1, base - 6.5); x.stroke(); } x.fillStyle = '#e8d4a8'; x.beginPath(); x.ellipse(sx + w - 6, base - 2.5, 2.4, 2.4, 0, 0, 6.3); x.fill(); x.fillStyle = PAL.red; x.beginPath(); x.arc(sx + w - 6, base - 4.8, 0.8, 0, 6.3); x.fill(); }
  else if (o.items === 'tea') { for (let i = 0; i < 3; i++) { x.fillStyle = r.pick(['#d9c8a0', '#6a4a30', '#3a6a58']); x.fillRect(sx + 3 + i * (w - 8) / 3, base - 5, 3, 4); x.fillStyle = PAL.red; x.fillRect(sx + 3 + i * (w - 8) / 3, base - 5.6, 3, 0.8); } }
  else if (o.items === 'flowers') { for (let i = 0; i < Math.floor(w / 4); i++) { const fx = sx + 3 + i * 4; x.strokeStyle = PAL.greenDark; x.lineWidth = 0.5; x.beginPath(); x.moveTo(fx, base); x.lineTo(fx + (r() - 0.5) * 2, base - 5 - r() * 3); x.stroke(); x.fillStyle = r.pick([PAL.red, PAL.pink, PAL.gold, '#fff', '#c28ae0']); x.beginPath(); x.arc(fx, base - 6.5 - r() * 3, 1.2, 0, 6.3); x.fill(); } }
  else if (o.items === 'mail') { x.fillStyle = '#2f6b45'; x.fillRect(sx + 3, base - 7, 6, 7); x.fillStyle = '#f4eee0'; x.fillRect(sx + 4, base - 6, 4, 2); x.fillStyle = PAL.red; x.fillRect(sx + w - 9, base - 5, 5, 4); x.fillStyle = '#f4eee0'; x.fillRect(sx + w - 8, base - 4, 3, 2); }
  else { for (let i = 0; i < Math.floor(w / 6); i++) { x.fillStyle = r.pick(['#d33a2c', '#3a8fd9', '#f2c230', '#8dc4a0']); x.fillRect(sx + 2 + i * 6, base - 3 - r() * 3, 4, 3 + r() * 3); } }
  x.restore();
  // 窗格 + 反光
  x.strokeStyle = frame; x.lineWidth = 0.9; x.beginPath(); for (let k = 1; k < Math.max(2, Math.round(w / 20)); k++) { const px = sx + k * w / Math.max(2, Math.round(w / 20)); x.moveTo(px, y); x.lineTo(px, y + h); } x.stroke();
  x.fillStyle = rgba('#fff', 0.2); x.beginPath(); x.moveTo(sx + w * 0.1, y + h); x.lineTo(sx + w * 0.3, y + 1); x.lineTo(sx + w * 0.4, y + 1); x.lineTo(sx + w * 0.2, y + h); x.fill();
  x.fillStyle = 'rgba(40,20,50,0.3)'; x.fillRect(sx + 1, y + 1, w - 2, 1.5);
  pushWin(c, sx + w / 2, y + h * 0.55, lit);
}
function door(c: Ctx2, dx: number, baseY: number, w: number, h: number, col: string, o: { glass?: boolean; arch?: boolean } = {}) {
  const x = c.x, top = baseY - h;
  paint(x, o.arch ? [[dx, baseY], [dx, top + w * 0.5], [dx + w * 0.15, top + w * 0.12], [dx + w / 2, top], [dx + w * 0.85, top + w * 0.12], [dx + w, top + w * 0.5], [dx + w, baseY]] : pRect(dx, top, w, h, { amp: 0.2 }), { fill: col, w: 0.8, mottle: 0.2, grain: 0.2, amp: 0.15, step: 2 });
  x.strokeStyle = rgba(shade(col, -0.5), 0.7); x.lineWidth = 0.4; x.strokeRect(dx + 2, top + (o.arch ? w * 0.5 : 2), w / 2 - 2.6, h * 0.4); x.strokeRect(dx + w / 2 + 0.6, top + (o.arch ? w * 0.5 : 2), w / 2 - 2.6, h * 0.4);
  if (o.glass) { x.fillStyle = 'rgba(255,225,150,0.7)'; x.fillRect(dx + 2.5, top + (o.arch ? w * 0.5 : 2.5), w / 2 - 3.5, h * 0.36); x.fillRect(dx + w / 2 + 1.1, top + (o.arch ? w * 0.5 : 2.5), w / 2 - 3.5, h * 0.36); }
  x.strokeStyle = rgba(PAL.ink, 0.8); x.lineWidth = 0.5; x.beginPath(); x.moveTo(dx + w / 2, top + 1); x.lineTo(dx + w / 2, baseY); x.stroke();
  x.fillStyle = PAL.brass; x.beginPath(); x.arc(dx + w / 2 - 1.8, top + h * 0.58, 0.75, 0, 6.3); x.arc(dx + w / 2 + 1.8, top + h * 0.58, 0.75, 0, 6.3); x.fill();
  paint(x, pRect(dx - 1, baseY - 1.4, w + 2, 2, { amp: 0.15 }), { fill: PAL.stoneLight, w: 0.45, mottle: 0.1 });
}
/** 窗下花盆/花箱/红辣椒装饰 */
function planter(x: Ctx, px: number, py: number, kind: 'pot' | 'xmas' = 'pot') {
  paint(x, [[px - 2.2, py - 3.6], [px + 2.2, py - 3.6], [px + 1.6, py], [px - 1.6, py]], { fill: '#b2603c', w: 0.5, mottle: 0.2, grain: 0.1, amp: 0.1 });
  if (kind === 'xmas') { x.fillStyle = PAL.green; x.beginPath(); x.moveTo(px, py - 11); x.lineTo(px + 3.2, py - 4); x.lineTo(px - 3.2, py - 4); x.closePath(); x.fill(); x.strokeStyle = rgba(PAL.ink, 0.6); x.lineWidth = 0.35; x.stroke(); x.fillStyle = PAL.gold; x.beginPath(); x.arc(px, py - 11.4, 0.8, 0, 6.3); x.fill(); x.fillStyle = PAL.red; x.beginPath(); x.arc(px - 1, py - 7, 0.5, 0, 6.3); x.arc(px + 1, py - 5.5, 0.5, 0, 6.3); x.fill(); }
  else { x.fillStyle = PAL.greenDark; x.beginPath(); x.ellipse(px, py - 5, 2.8, 2, 0, 0, 6.3); x.fill(); x.fillStyle = PAL.red; x.beginPath(); x.arc(px + 0.8, py - 6, 0.7, 0, 6.3); x.fill(); }
}
function plinth(x: Ctx, X0: number, W: number, y: number, h: number, col = '#9b8f84') {
  x.fillStyle = lin(x, 0, y, 0, y + h, [[0, shade(col, 0.1)], [1, shade(col, -0.25)]]); x.fillRect(X0, y, W, h);
  x.strokeStyle = rgba(PAL.ink, 0.5); x.lineWidth = 0.4; for (let xx = X0 + 6; xx < X0 + W; xx += 12 + hash2(xx, 9) * 6) { x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, y + h); x.stroke(); }
  strokePath(x, [[X0, y], [X0 + W, y + 0.1]], { w: 0.6, color: rgba(PAL.ink, 0.7), seed: 7 });
}

// ════════════ 变体 ════════════
type Build = (c: Ctx2, W: number) => { H: number };
const gnd = (H: number) => H - 4; // 地线 y（含 TP）

const VARIANTS: Record<string, Build> = {
  /** a 石库门红砖（两门两店） */
  a: (c, W) => {
    const { x } = c, H = 74, B = TP + H, top = TP;
    bricks(x, 0, top, W, H, '#a0503f', '#cdb394', c.seed);
    roofBand(x, 0, W, top, 8, '#4c505f', 'tile', c.seed); snowCap(x, 0, W, top, 4, c.seed + 1); icicles(x, 0, W, top + 8, c.seed + 2);
    // 二楼窗
    [10, 40, 70, 100, 128, 156].forEach((px, i) => { sashWindow(c, px, top + 14, 11, 16, { shutter: i % 2 ? '#4f7a5c' : '#5a7a62', lit: undefined }); });
    belt(x, 0, W, top + 38, 3, '#d8cfbd');
    laundry(c, 22, 60, top + 12, c.seed + 5);
    // 底层
    [{ g: 92 }, { g: 14 }].forEach((o, k) => shikumen(c, o.g, B - 3, 28, { wreath: k === 0 }));
    const shops = [{ x: 34, w: 46, c1: '#d1403a', c2: '#f4eee0' }, { x: 128, w: 30, c1: '#3d8f6f', c2: '#f4eee0' }];
    shops.forEach((s, k) => { shopWindow(c, s.x + 3, s.w - 6, B - 28, 18, { items: k ? 'tea' : 'goods' }); awning(c, s.x, s.w, B - 32, 8, s.c1, s.c2); });
    sign(c, 57, B - 38, 26, 5.5, '杂货铺', { bg: '#6b3a28' });
    lanterns(c, [4, 78, 120, 156], top + 9);
    stringLights(c, 2, W - 2, top + 8.5, 2.4, c.seed + 3);
    pipe(x, 84, top + 8, B - 3); plinth(x, 0, W, B - 3, 3);
    return { H: B };
  },
  /** b 红砖商街（带招牌与阁楼老虎窗） */
  b: (c, W) => {
    const { x } = c, H = 78, B = TP + H, top = TP;
    bricks(x, 0, top, W, H, '#a65b48', '#d0b898', c.seed + 1, { bw: 6.5 });
    roofBand(x, 0, W, top, 9, '#5a4455', 'tile', c.seed + 1); snowCap(x, 0, W, top, 4.5, c.seed + 3); icicles(x, 0, W, top + 9, c.seed + 4);
    [18, 48, 108, 138].forEach((px, i) => sashWindow(c, px, top + 12, 11, 16, { arch: i % 2 === 0, flower: i === 1, shutter: i === 2 ? '#3d6a55' : undefined }));
    belt(x, 0, W, top + 40, 3, '#e0d6c2');
    shikumen(c, 112, B - 3, 30, { wreath: true });
    shopWindow(c, 6, 66, B - 30, 20, { items: 'goods' }); awning(c, 2, 74, B - 34, 9, '#3a6fa8', '#f4eee0');
    sign(c, 40, B - 39.5, 34, 6, '洋货庄', { bg: '#2f5a48', fg: '#f4e2a0' });
    shopWindow(c, 85, 20, B - 30, 20, { items: 'tea' });
    stringLights(c, 2, W - 2, top + 9.5, 2.2, c.seed + 8);
    laundry(c, 70, 100, top + 14, c.seed + 4);
    pipe(x, 154, top + 9, B - 3); plinth(x, 0, W, B - 3, 3);
    return { H: B };
  },
  /** c 青砖弄堂（爬山虎、竹竿、红灯笼） */
  c: (c, W) => {
    const { x } = c, H = 70, B = TP + H, top = TP;
    bricks(x, 0, top, W, H, '#7c8696', '#d6d6d0', c.seed + 2, { bw: 7.5, bh: 3.4, vary: 0.2 });
    roofBand(x, 0, W, top, 8, '#454a58', 'tile', c.seed + 2); snowCap(x, 0, W, top, 4, c.seed + 5); icicles(x, 0, W, top + 8, c.seed + 6);
    [14, 44, 80, 116, 146].forEach((px, i) => sashWindow(c, px, top + 14, 10, 15, { shutter: '#6a4a38', lintel: '#cfc8b8', lit: i === 2 ? true : undefined }));
    ivy(c, 96, 132, top + 8, top + 52, c.seed + 11);
    belt(x, 0, W, top + 36, 2.5, '#c9c2b2');
    laundry(c, 8, 70, top + 12, c.seed + 9); laundry(c, 100, 150, top + 44, c.seed + 10);
    [{ d: 26 }, { d: 76 }, { d: 124 }].forEach((o, k) => { door(c, o.d, B - 3, 16, 24, k === 1 ? '#7a2e2a' : '#4a3a30'); snowCap(x, o.d - 1, o.d + 17, B - 27, 1.6, o.d); });
    lanterns(c, [20, 44, 100, 144], top + 40);
    for (let k = 0; k < 3; k++) planter(x, 56 + k * 8, B - 3, k === 1 ? 'xmas' : 'pot');
    pipe(x, 66, top + 8, B - 3); plinth(x, 0, W, B - 3, 3, '#8a8590');
    return { H: B };
  },
  /** d 面包房街（暖黄泥灰、条纹遮阳、灯串） */
  d: (c, W) => {
    const { x } = c, H = 76, B = TP + H, top = TP;
    plaster(x, 0, top, W, H, '#e6bd7c', c.seed + 3);
    roofBand(x, 0, W, top, 8, '#9a5440', 'tile', c.seed + 3); snowCap(x, 0, W, top, 4.5, c.seed + 6); icicles(x, 0, W, top + 8, c.seed + 7);
    [16, 52, 96, 134].forEach((px, i) => sashWindow(c, px, top + 11, 11, 16, { arch: true, flower: true, lintel: '#f2e6cc', shutter: i % 2 ? '#c4573b' : '#4f7a5c' }));
    belt(x, 0, W, top + 40, 3.5, '#f3e6c8');
    // 面包房大橱窗（左）+ 门（中）+ 小店（右）
    shopWindow(c, 6, 54, B - 31, 22, { items: 'bread', frame: '#6b3a28' }); awning(c, 2, 62, B - 36, 10, '#d1403a', '#f6ecd6');
    door(c, 68, B - 3, 15, 27, '#6b3a28', { glass: true }); awning(c, 64, 23, B - 33, 7, '#d1403a', '#f6ecd6');
    shopWindow(c, 94, 36, B - 31, 22, { items: 'flowers', frame: '#3c5a48' }); awning(c, 90, 44, B - 36, 10, '#3d7a58', '#f6ecd6');
    shopWindow(c, 136, 20, B - 31, 22, { items: 'tea', frame: '#6b3a28' });
    sign(c, 40, B - 40.5, 36, 7, '面包房', { bg: '#7a2e28', fg: '#ffe29a', hang: false });
    sign(c, 112, B - 40.5, 24, 6, '花店', { bg: '#2f5a48', fg: '#f6ecd6' });
    stringLights(c, 1, W - 1, top + 9, 3.2, c.seed + 11);
    stringLights(c, 6, 64, B - 44, 3, c.seed + 12);
    lanterns(c, [88, 130], top + 41);
    pipe(x, 88, top + 8, B - 3); plinth(x, 0, W, B - 3, 3, '#a39484');
    return { H: B };
  },
  /** e 邮局（米色石墙、绿门绿窗、邮政徽、时钟） */
  e: (c, W) => {
    const { x } = c, H = 78, B = TP + H, top = TP;
    plaster(x, 0, top, W, H, '#d9c9a4', c.seed + 4, { lines: 6.5 });
    roofBand(x, 0, W, top, 8, '#3f5a54', 'slate', c.seed + 4); snowCap(x, 0, W, top, 4.5, c.seed + 8); icicles(x, 0, W, top + 8, c.seed + 9);
    [14, 42, 118, 146].forEach((px) => sashWindow(c, px, top + 14, 11, 18, { lintel: '#efe6d2', shutter: '#2f6b4c', lit: undefined }));
    // 中央钟 + 山花
    const cx = 80; paint(x, pPoly([[cx - 20, top + 12], [cx, top + 1], [cx + 20, top + 12]], { amp: 0.15 }), { fill: '#e8dcc0', w: 0.8, mottle: 0.2 });
    paint(x, pEllipse(cx, top + 13, 7.5, 7.5, { amp: 0.15 }), { fill: '#f6efe0', w: 0.9, mottle: 0.1 }); x.strokeStyle = PAL.ink; x.lineWidth = 0.6; x.beginPath(); x.moveTo(cx, top + 13); x.lineTo(cx, top + 8.5); x.moveTo(cx, top + 13); x.lineTo(cx + 3, top + 14.5); x.stroke(); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; x.fillStyle = PAL.ink; x.fillRect(cx + Math.sin(a) * 6.2 - 0.25, top + 13 - Math.cos(a) * 6.2 - 0.25, 0.5, 0.5); }
    belt(x, 0, W, top + 40, 3.5, '#efe6d2');
    // 大拱门 + 绿门
    door(c, 70, B - 3, 20, 31, '#2f6b4c', { arch: true, glass: true });
    paint(x, [[66, B - 3], [66, B - 28], [70, B - 36], [80, B - 38], [90, B - 36], [94, B - 28], [94, B - 3]], { fill: 'rgba(0,0,0,0)', stroke: '#e8dcc0', w: 1.6, amp: 0.1, step: 2, grain: 0, mottle: 0, hi: 0, rim: 0, edge: 0 });
    sign(c, 80, B - 42, 30, 7, '邮局', { bg: '#2f6b4c', fg: '#ffe9a8', edge: '#ffe9a8' });
    shopWindow(c, 8, 50, B - 29, 21, { items: 'mail', frame: '#2f6b4c' }); awning(c, 4, 58, B - 33, 8, '#2f6b4c', '#e8dcc0');
    shopWindow(c, 108, 44, B - 29, 21, { items: 'goods', frame: '#2f6b4c' }); awning(c, 104, 52, B - 33, 8, '#2f6b4c', '#e8dcc0');
    // 绿色邮筒贴墙标
    paint(x, pRect(140, B - 26, 14, 18, { amp: 0.2 }), { fill: '#3f7a58', w: 0.7, mottle: 0.2 }); x.fillStyle = '#f6efe0'; x.fillRect(143, B - 22, 8, 1.4); x.font = `bold 4px ${FONT}`; x.fillStyle = '#ffe9a8'; x.textAlign = 'center'; x.fillText('信', 147, B - 14);
    stringLights(c, 2, W - 2, top + 9.5, 2.2, c.seed + 15);
    pipe(x, 4, top + 8, B - 3); plinth(x, 0, W, B - 3, 3, '#a89c86');
    return { H: B };
  },
  /** f 老洋房（白灰泥 + 孟莎顶 + 老虎窗 + 铁艺阳台） */
  f: (c, W) => {
    const { x } = c, H = 90, B = TP + H, top = TP + 6;
    plaster(x, 0, top + 14, W, H - 20, '#efe6d6', c.seed + 5, { lines: 0 });
    // 孟莎屋顶（斜面）+ 老虎窗
    roofBand(x, 0, W, top - 4, 18, '#59607a', 'slate', c.seed + 5); snowCap(x, 0, W, top - 4, 5, c.seed + 9); icicles(x, 0, W, top + 14, c.seed + 11);
    [26, 80, 134].forEach((px, i) => {
      paint(x, [[px - 9, top + 12], [px - 9, top + 1], [px, top - 7], [px + 9, top + 1], [px + 9, top + 12]], { fill: '#f1e8d6', w: 0.8, amp: 0.15, step: 2, mottle: 0.2 });
      sashWindow(c, px, top + 1, 8, 10, { arch: true, lintel: 'none', shutter: undefined, lit: i === 1 ? true : undefined });
      snowCap(x, px - 10, px + 10, top - 3 - (Math.abs(i - 1)) * 0, 1.8, px);
    });
    belt(x, 0, W, top + 14, 3, '#f7f0e0');
    // 二楼：落地窗+铁艺阳台
    [16, 52, 108, 144].forEach((px, i) => sashWindow(c, px, top + 23, 11, 24, { arch: true, lintel: '#f7f0e0', shutter: i % 2 ? '#4f7a5c' : '#3d5a78', lit: i === 1 ? true : undefined, snow: false }));
    strokePath(x, [[2, top + 46], [W - 2, top + 46]], { w: 0.9, color: PAL.iron, seed: 3 });
    for (let xx = 4; xx < W - 2; xx += 4) { x.strokeStyle = PAL.iron; x.lineWidth = 0.55; x.beginPath(); x.moveTo(xx, top + 46); x.lineTo(xx, top + 53); x.stroke(); if (((xx - 4) / 4) % 3 === 1) { x.beginPath(); x.arc(xx + 2, top + 49.5, 1.1, 0, 6.3); x.stroke(); } }
    strokePath(x, [[2, top + 53], [W - 2, top + 53]], { w: 1.1, color: PAL.iron, seed: 5 });
    x.fillStyle = 'rgba(50,30,70,0.18)'; x.fillRect(0, top + 54, W, 3);
    belt(x, 0, W, top + 56, 3, '#f7f0e0');
    // 底层：门廊
    door(c, 66, B - 3, 28, 28, '#2e4a62', { glass: true, arch: true });
    [60, 98].forEach((px) => { paint(x, pRect(px, B - 34, 5, 32, { amp: 0.15 }), { fill: '#f7f0e0', w: 0.7, mottle: 0.1 }); paint(x, pRect(px - 1, B - 36, 7, 2.6), { fill: '#e6dcc4', w: 0.5 }); });
    paint(x, [[56, B - 36], [80, B - 44], [104, B - 36]], { fill: '#f3ead6', w: 0.8, amp: 0.1, step: 3, mottle: 0.1 }); snowCap(x, 58, 102, B - 39, 2.4, 41);
    [14, 48, 112, 142].forEach((px, i) => sashWindow(c, px, B - 31, 12, 20, { lintel: '#f7f0e0', shutter: i % 2 ? '#4f7a5c' : '#3d5a78', lit: i === 2 ? true : undefined }));
    ivy(c, 0, 30, top + 20, B - 6, c.seed + 21, false);
    lanterns(c, [60, 102], B - 33);
    plinth(x, 0, W, B - 3, 3, '#a8a09a');
    return { H: B };
  },
  /** g 茶馆（木结构门面、红灯笼、竹帘） */
  g: (c, W) => {
    const { x } = c, H = 72, B = TP + H, top = TP;
    plaster(x, 0, top, W, 36, '#e9dfc9', c.seed + 6);
    planks(x, 0, top + 36, W, H - 36, '#8a5a38', c.seed + 6);
    roofBand(x, 0, W, top, 9, '#6a4a3a', 'tile', c.seed + 6); snowCap(x, 0, W, top, 5, c.seed + 12); icicles(x, 0, W, top + 9, c.seed + 13);
    // 木梁
    [0, 40, 80, 120, 158].forEach((px) => { paint(x, pRect(px, top + 9, 3.6, H - 9, { amp: 0.15 }), { fill: '#5e3a28', w: 0.6, mottle: 0.2 }); });
    paint(x, pRect(0, top + 34, W, 3.6, { amp: 0.15 }), { fill: '#5e3a28', w: 0.6 });
    [20, 52, 124, 142].forEach((px) => sashWindow(c, px, top + 14, 11, 15, { shutter: undefined, frame: '#5e3a28', lintel: 'none', lit: true, curtain: '#e8b0a0' }));
    // 格窗大门面
    shopWindow(c, 6, 66, B - 30, 22, { items: 'tea', frame: '#4a2e20' });
    door(c, 78, B - 3, 18, 28, '#6b3a28', { glass: true });
    shopWindow(c, 104, 50, B - 30, 22, { items: 'tea', frame: '#4a2e20' });
    // 竹帘/布幌
    awning(c, 4, 70, B - 34, 6, '#b2432f', '#e9d9a8'); awning(c, 102, 54, B - 34, 6, '#b2432f', '#e9d9a8');
    sign(c, 88, B - 42, 30, 8.5, '茶馆', { bg: '#3a2418', fg: '#ffd978', hang: true });
    lanterns(c, [4, 36, 76, 116, 154], top + 30);
    plinth(x, 0, W, B - 3, 3, '#7e7468');
    return { H: B };
  },
  /** h 西式砖红商店（白窗套、雨棚、灯串） */
  h: (c, W) => {
    const { x } = c, H = 72, B = TP + H, top = TP;
    bricks(x, 0, top, W, H, '#9a4a3c', '#c8b090', c.seed + 7, { bw: 6.2, bh: 3.1 });
    // 山形女儿墙
    roofBand(x, 0, W, top, 7, '#3e4152', 'slate', c.seed + 7); snowCap(x, 0, W, top, 4, c.seed + 15); icicles(x, 0, W, top + 7, c.seed + 16);
    [20, 56, 104, 140].forEach((px, i) => { sashWindow(c, px, top + 11, 12, 15, { arch: true, lintel: '#f3ead8', frame: '#f3ead8', lit: i === 1 ? true : undefined }); });
    belt(x, 0, W, top + 38, 3, '#f0e6d2');
    shopWindow(c, 6, 74, B - 30, 21, { items: 'goods', frame: '#2f5a48' }); awning(c, 2, 82, B - 34, 9, '#2f6b4c', '#f4eee0');
    door(c, 96, B - 3, 16, 26, '#2f5a48', { glass: true });
    shopWindow(c, 120, 34, B - 30, 21, { items: 'goods', frame: '#2f5a48' }); awning(c, 116, 42, B - 34, 9, '#a8402e', '#f4eee0');
    sign(c, 43, B - 38.5, 36, 6.5, '洋杂货', { bg: '#2a2a3a', fg: '#ffd978', hang: false });
    stringLights(c, 2, W - 2, top + 8.5, 3, c.seed + 18); stringLights(c, 6, 90, B - 40.5, 2.2, c.seed + 19);
    plinth(x, 0, W, B - 3, 3, '#8a8590');
    return { H: B };
  },
  /** i 码头仓库（暗红砖 + 铁皮顶 + 大推拉门 + 吊钩） */
  i: (c, W) => {
    const { x } = c, H = 66, B = TP + H, top = TP;
    bricks(x, 0, top + 6, W, H - 6, '#80423a', '#a79680', c.seed + 8, { bw: 8, bh: 3.6, vary: 0.24 });
    roofBand(x, 0, W, top, 8, '#6a7684', 'tin', c.seed + 8); snowCap(x, 0, W, top, 5, c.seed + 17); icicles(x, 0, W, top + 8, c.seed + 18);
    // 窗
    [16, 46, 114, 144].forEach((px) => sashWindow(c, px, top + 14, 11, 12, { frame: '#3a3a44', lintel: '#b6aa98', lit: false }));
    // 大推拉门
    paint(x, pRect(58, B - 40, 44, 37, { amp: 0.2 }), { fill: '#4e5a68', w: 0.9, mottle: 0.3, grain: 0.3 });
    x.strokeStyle = '#2c3440'; x.lineWidth = 1; x.beginPath(); x.moveTo(80, B - 40); x.lineTo(80, B - 3); x.moveTo(58, B - 40); x.lineTo(80, B - 3); x.moveTo(80, B - 40); x.lineTo(58, B - 3); x.moveTo(102, B - 40); x.lineTo(80, B - 3); x.moveTo(80, B - 40); x.lineTo(102, B - 3); x.stroke();
    strokePath(x, [[54, B - 42], [106, B - 42]], { w: 1.4, color: PAL.iron, seed: 3 });
    sign(c, 80, B - 49, 34, 6, '三号仓', { bg: '#e9d9a8', fg: '#7a2a28', edge: '#7a2a28', hang: false });
    // 吊钩灯
    strokePath(x, [[28, top + 8], [28, top + 22]], { w: 0.6, color: PAL.ink, seed: 3 }); paint(x, [[24, top + 22], [32, top + 22], [30, top + 27], [26, top + 27]], { fill: '#586070', w: 0.5, amp: 0.1 });
    x.fillStyle = radial(x, 28, top + 29, 10, [[0, 'rgba(255,220,140,0.8)'], [1, 'rgba(255,200,100,0)']]); x.fillRect(16, top + 20, 24, 20);
    // 货箱
    [[8, 14, 11], [20, 12, 9], [128, 14, 12], [142, 12, 9]].forEach(([bx, bw, bh]) => { paint(x, pRect(bx, B - 3 - bh, bw, bh, { amp: 0.2 }), { fill: '#b88650', w: 0.7, mottle: 0.3 }); x.strokeStyle = rgba(PAL.ink, 0.55); x.lineWidth = 0.4; x.beginPath(); x.moveTo(bx, B - 3 - bh); x.lineTo(bx + bw, B - 3); x.moveTo(bx + bw, B - 3 - bh); x.lineTo(bx, B - 3); x.stroke(); snowCap(x, bx, bx + bw, B - 3 - bh, 1.4, bx); });
    pipe(x, 112, top + 8, B - 3); plinth(x, 0, W, B - 3, 3, '#6e6a70');
    return { H: B };
  },
  /** j 里弄山墙（灰泥旧墙、小窗、晾衣、枯藤） */
  j: (c, W) => {
    const { x } = c, H = 68, B = TP + H, top = TP;
    plaster(x, 0, top, W, H, '#b3ada3', c.seed + 9);
    bricks(x, 0, B - 24, 38, 21, '#9a5a48', '#cdb394', c.seed + 9);
    roofBand(x, 0, W, top, 7, '#4a4e5e', 'tile', c.seed + 9); snowCap(x, 0, W, top, 4, c.seed + 20); icicles(x, 0, W, top + 7, c.seed + 21);
    [22, 62, 118, 148].forEach((px, i) => sashWindow(c, px, top + 12 + (i % 2) * 6, 9, 13, { shutter: '#6a6a5a', lintel: '#d0c8b8', lit: i === 2 ? true : undefined }));
    ivy(c, 80, 112, top + 7, top + 50, c.seed + 22);
    laundry(c, 6, 50, top + 36, c.seed + 11);
    door(c, 70, B - 3, 16, 24, '#5a4a40'); snowCap(x, 69, 87, B - 27, 1.6, 70);
    lanterns(c, [60, 100], top + 40);
    pipe(x, 56, top + 7, B - 3); pipe(x, 128, top + 7, B - 3); plinth(x, 0, W, B - 3, 3, '#8a8480');
    return { H: B };
  },
  /** k 雪场木屋（原木墙、厚雪屋顶、暖窗、雪具架） */
  k: (c, W) => {
    const { x } = c, H = 66, B = TP + H, top = TP;
    planks(x, 0, top + 6, W, H - 6, '#9a6a40', c.seed + 10, true);
    roofBand(x, 0, W, top, 9, '#6a4a34', 'wood', c.seed + 10);
    snowCap(x, -2, W + 2, top, 8, c.seed + 25); snowCap(x, 4, W - 4, top - 3, 4, c.seed + 26); icicles(x, 0, W, top + 9, c.seed + 27, 0.8);
    [22, 62, 132].forEach((px, i) => sashWindow(c, px, top + 18, 14, 16, { frame: '#5e3a28', lintel: 'none', lit: true, curtain: i === 1 ? '#c85a48' : undefined }));
    door(c, 84, B - 3, 18, 28, '#6b3a28', { glass: true });
    sign(c, 93, B - 36, 30, 7, '滑雪小屋', { bg: '#2f4a68', fg: '#fff4d6', edge: '#fff4d6', hang: true });
    // 木柱 + 雪板架
    [0, 40, 108, 158].forEach((px) => paint(x, pRect(px, top + 8, 4, H - 8, { amp: 0.12 }), { fill: '#6a4228', w: 0.6, mottle: 0.2 }));
    [[116, '#d1403a'], [121, '#3a6fa8'], [126, '#f2c230'], [131, '#3d8f6f']].forEach(([sx, col], i) => { x.save(); x.translate(sx as number, B - 3); x.rotate(-0.12); x.fillStyle = col as string; x.fillRect(-1.2, -32, 2.4, 32); x.strokeStyle = rgba(PAL.ink, 0.7); x.lineWidth = 0.45; x.strokeRect(-1.2, -32, 2.4, 32); x.fillStyle = '#fff'; x.fillRect(-1.2, -26 + i, 2.4, 1.3); x.restore(); });
    stringLights(c, 2, W - 2, top + 11, 3.2, c.seed + 28); stringLights(c, 6, 78, B - 40, 2.5, c.seed + 29);
    plinth(x, 0, W, B - 3, 3, '#8a8078');
    return { H: B };
  },
  /** l 小花店/糖果铺（粉绿泥灰、玻璃门面） */
  l: (c, W) => {
    const { x } = c, H = 68, B = TP + H, top = TP;
    plaster(x, 0, top, W, H, '#d9b8b8', c.seed + 11);
    roofBand(x, 0, W, top, 8, '#6a5c78', 'tile', c.seed + 11); snowCap(x, 0, W, top, 4.5, c.seed + 30); icicles(x, 0, W, top + 8, c.seed + 31);
    [20, 80, 140].forEach((px, i) => sashWindow(c, px, top + 10, 12, 14, { arch: true, flower: true, lintel: '#f6ecda', shutter: '#6aa088', lit: i === 1 ? true : undefined }));
    belt(x, 0, W, top + 38, 3, '#f6ecda');
    shopWindow(c, 6, 60, B - 30, 22, { items: 'flowers', frame: '#4a6a58' }); awning(c, 2, 68, B - 34, 10, '#e08aa0', '#fff4e6');
    door(c, 74, B - 3, 16, 27, '#4a6a58', { glass: true });
    shopWindow(c, 96, 58, B - 30, 22, { items: 'bread', frame: '#4a6a58' }); awning(c, 92, 66, B - 34, 10, '#6aa088', '#fff4e6');
    sign(c, 36, B - 38.5, 28, 6.5, '花店', { bg: '#d9648a', fg: '#fff4e6', edge: '#fff4e6' }); sign(c, 124, B - 38.5, 28, 6.5, '糖果', { bg: '#4a8a78', fg: '#fff4e6', edge: '#fff4e6' });
    stringLights(c, 1, W - 1, top + 9, 3, c.seed + 32);
    plinth(x, 0, W, B - 3, 3, '#9a8f88');
    return { H: B };
  },
};
export const WALL_VARIANTS = Object.keys(VARIANTS);
export const WALL_NAMES: Record<string, string> = { a: '石库门红砖(两门两店)', b: '红砖商街(洋货庄)', c: '青砖弄堂(爬山虎·晾衣)', d: '面包房街(暖黄·条纹遮阳)', e: '邮局(米石墙·绿门·钟)', f: '老洋房(孟莎顶·阳台·门廊)', g: '茶馆(木门面·红灯笼)', h: '西式砖红商店(拱窗·灯串)', i: '码头仓库(铁皮顶·推拉门)', j: '里弄山墙(灰泥旧墙)', k: '雪场木屋(原木·厚雪顶)', l: '花店糖果铺(粉色泥灰)' };

/** 生成一张斜切成等距墙的立面。未知变体回退为 'a'。 */
export function buildWall(side: 'ne' | 'nw', v: string): WallTex {
  const key = VARIANTS[v] ? v : 'a';
  const seed = Math.floor(hash2(key.charCodeAt(0), side === 'ne' ? 1 : 2, 3) * 1000) + 11;
  // 先估算高度：用一次空画布试跑太浪费，所以高度由变体返回；先画到足够高的画布再裁
  const MAXH = 110;
  const f = newCanvas(FW * SS, MAXH * SS), fx = ctxOf(f); fx.scale(SS, SS);
  const c: Ctx2 = { x: fx, seed, wins: [] };
  const { H } = VARIANTS[key](c, FW);
  const SK = FW / 2;
  const out = newCanvas(FW * SS, (H + SK + 2) * SS), ox = ctxOf(out);
  ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high';
  if (side === 'ne') ox.setTransform(1, 0.5, 0, 1, 0, 0); else ox.setTransform(1, -0.5, 0, 1, 0, SK * SS);
  // 斜切变换作用在位图像素上：x 方向像素坐标 → 需要 y 的剪切因子乘 (SS 无关)；这里 setTransform 的 e,f 已是像素
  ox.drawImage(f, 0, 0, FW * SS, H * SS, 0, 0, FW * SS, H * SS);
  ox.setTransform(1, 0, 0, 1, 0, 0);
  // 朝向光影：ne 墙朝左下（受光），nw 墙朝右下（背光）
  ox.globalCompositeOperation = 'source-atop';
  ox.fillStyle = side === 'ne' ? 'rgba(255,214,150,0.09)' : 'rgba(58,40,110,0.15)'; ox.fillRect(0, 0, out.width, out.height);
  // 墙脚接地暗部
  const gy = ox.createLinearGradient(0, 0, 0, out.height); void gy;
  ox.globalCompositeOperation = 'source-over';
  applyPaper(out, 0.5, 1);
  const wins = c.wins.map((w) => ({ x: w.x, y: side === 'ne' ? w.y + 0.5 * w.x : w.y - 0.5 * w.x + SK, lit: w.lit }));
  return { canvas: out, windows: wins, ax: side === 'ne' ? 0 : FW, ay: H, len: WALL_TILES };
}
void mix; void pBlob; void speckles; void gnd;
