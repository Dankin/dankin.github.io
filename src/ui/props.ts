/** 果园里的道具:每个升级/项目在画面上的样子。全部用屏幕像素,u = 一个世界单位的像素数(前排树高)。 */
import { drawApple, GOLD, INK, RED } from './draw.ts';

type C = CanvasRenderingContext2D;

const ink = (c: C, w: number) => {
  c.strokeStyle = INK;
  c.lineWidth = Math.max(1.2, w);
  c.lineCap = 'round';
  c.lineJoin = 'round';
};

export interface PersonOpt {
  walk?: number;
  /** 0..1,手臂抬起程度 */
  arm?: number;
  dir?: number;
  hat?: 'straw' | 'wig';
  suit?: boolean;
  seated?: boolean;
  glasses?: boolean;
}

/** 火柴人。x,y 是脚底中心,h 是身高。 */
export function person(c: C, x: number, y: number, h: number, o: PersonOpt = {}): void {
  const dir = o.dir ?? 1;
  const walk = o.walk ?? 0;
  const arm = o.arm ?? 0;
  const lw = h * 0.07;
  const seated = !!o.seated;
  const hipY = y - h * (seated ? 0.14 : 0.4);
  const shY = y - h * (seated ? 0.5 : 0.7);
  const headR = h * 0.12;
  const headY = y - h * (seated ? 0.66 : 0.86);
  ink(c, lw);
  // 腿
  c.beginPath();
  if (seated) {
    c.moveTo(x, hipY);
    c.lineTo(x + dir * h * 0.3, hipY);
    c.lineTo(x + dir * h * 0.3, y);
  } else {
    const s = Math.sin(walk) * h * 0.16;
    c.moveTo(x, hipY);
    c.lineTo(x + s, y);
    c.moveTo(x, hipY);
    c.lineTo(x - s, y);
  }
  c.stroke();
  // 躯干
  if (o.suit) {
    c.fillStyle = INK;
    c.beginPath();
    c.moveTo(x - h * 0.1, shY);
    c.lineTo(x + h * 0.1, shY);
    c.lineTo(x + h * 0.08, hipY);
    c.lineTo(x - h * 0.08, hipY);
    c.closePath();
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(x - h * 0.03, shY);
    c.lineTo(x + h * 0.03, shY);
    c.lineTo(x, shY + h * 0.14);
    c.closePath();
    c.fill();
  } else {
    c.beginPath();
    c.moveTo(x, shY);
    c.lineTo(x, hipY);
    c.stroke();
    // 背带裤的胸兜
    c.fillStyle = '#fff';
    c.fillRect(x - h * 0.06, shY + h * 0.03, h * 0.12, h * 0.12);
    c.strokeRect(x - h * 0.06, shY + h * 0.03, h * 0.12, h * 0.12);
  }
  // 手臂
  const sy = shY + h * 0.03;
  const th = -1.1 + arm * 2.4;
  c.beginPath();
  c.moveTo(x, sy);
  c.lineTo(x + dir * Math.cos(th) * h * 0.27, sy - Math.sin(th) * h * 0.27);
  const th2 = -1.25 + Math.sin(walk + Math.PI) * 0.5;
  c.moveTo(x, sy);
  c.lineTo(x - dir * Math.cos(th2) * h * 0.22, sy - Math.sin(th2) * h * 0.22);
  c.stroke();
  // 假发:头两侧和头顶的卷
  if (o.hat === 'wig') {
    c.fillStyle = '#fff';
    for (const [dx, dy] of [[-1.15, 0.2], [1.15, 0.2], [-0.8, -0.7], [0.8, -0.7], [0, -1.05], [-1.1, 1.0], [1.1, 1.0]]) {
      c.beginPath();
      c.arc(x + dx * headR, headY + dy * headR, headR * 0.55, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
  }
  // 头
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(x, headY, headR, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = INK;
  c.beginPath();
  c.arc(x + dir * headR * 0.35, headY - headR * 0.1, Math.max(1, headR * 0.12), 0, Math.PI * 2);
  c.fill();
  if (o.glasses) {
    c.lineWidth = Math.max(1, lw * 0.6);
    c.beginPath();
    c.arc(x + dir * headR * 0.35, headY - headR * 0.1, headR * 0.34, 0, Math.PI * 2);
    c.stroke();
  }
  // 草帽
  if (o.hat === 'straw') {
    c.fillStyle = '#fff';
    c.beginPath();
    c.ellipse(x, headY - headR * 0.7, headR * 1.9, headR * 0.45, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(x, headY - headR * 0.85, headR * 0.95, Math.PI, 0);
    c.fill();
    c.stroke();
  }
}

/** 向右开的送货卡车。x 为车身中心,y 为地面。 */
export function truck(c: C, x: number, y: number, u: number, wheel: number, load: number): void {
  const w = 0.36 * u;
  const h = 0.12 * u;
  const base = y - 0.045 * u;
  ink(c, Math.max(1.5, u * 0.014));
  c.fillStyle = '#fff';
  // 货厢
  const bx = x - w / 2;
  const bw = w * 0.66;
  c.fillRect(bx, base - h, bw, h);
  c.strokeRect(bx, base - h, bw, h);
  // 货厢上的苹果
  const n = Math.min(6, 2 + Math.floor(load));
  const r = 0.02 * u;
  for (let i = 0; i < n; i++) drawApple(c, bx + r * 1.4 + i * ((bw - r * 2.8) / Math.max(1, n - 1)), base - h - r * 0.6, r, RED, Math.max(1, u * 0.008));
  // 车厢上的苹果标
  drawApple(c, bx + bw / 2, base - h / 2, 0.03 * u, RED, Math.max(1, u * 0.01));
  // 驾驶室
  const cx0 = bx + bw + 0.01 * u;
  const cw = w - bw - 0.01 * u;
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(cx0, base);
  c.lineTo(cx0, base - h * 0.78);
  c.lineTo(cx0 + cw * 0.65, base - h * 0.78);
  c.lineTo(cx0 + cw, base - h * 0.4);
  c.lineTo(cx0 + cw, base);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = '#ddd';
  c.fillRect(cx0 + cw * 0.12, base - h * 0.68, cw * 0.4, h * 0.3);
  // 车轮
  for (const wx of [x - w * 0.28, x + w * 0.3]) {
    const wr = 0.035 * u;
    c.fillStyle = INK;
    c.beginPath();
    c.arc(wx, y - wr, wr, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#fff';
    c.lineWidth = Math.max(1, u * 0.006);
    c.beginPath();
    c.moveTo(wx + Math.cos(wheel) * wr * 0.7, y - wr + Math.sin(wheel) * wr * 0.7);
    c.lineTo(wx - Math.cos(wheel) * wr * 0.7, y - wr - Math.sin(wheel) * wr * 0.7);
    c.stroke();
    ink(c, Math.max(1.5, u * 0.014));
  }
}

/** 夹在树干上的摇树机。x,y 为树干上的位置,s 为尺寸。 */
export function shakerBox(c: C, x: number, y: number, s: number, t: number): void {
  const j = Math.sin(t * 50) * s * 0.05;
  ink(c, Math.max(1, s * 0.07));
  // 震动线
  for (const side of [-1, 1]) {
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const yy = y - s * 0.4 + i * s * 0.28;
      c.lineTo(x + side * (s * 0.75 + (i % 2 ? 1 : -1) * s * 0.1) + j, yy);
    }
    c.stroke();
  }
  c.fillStyle = INK;
  c.fillRect(x - s * 0.5 + j, y - s * 0.45, s, s * 0.9);
  c.fillStyle = Math.sin(t * 8) > 0 ? RED : '#fff';
  c.beginPath();
  c.arc(x + j, y - s * 0.15, s * 0.14, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fff';
  c.fillRect(x - s * 0.3 + j, y + s * 0.12, s * 0.6, s * 0.1);
}

/** 苹果筐。fill = 0..15 个苹果。 */
export function basket(c: C, x: number, y: number, u: number, fill: number): void {
  const w = 0.17 * u;
  const h = 0.085 * u;
  const r = 0.02 * u;
  const lw = Math.max(1.2, u * 0.012);
  // 堆起来的苹果
  const rows = [5, 4, 3, 2, 1];
  let left = Math.floor(fill);
  let yy = y - h - r * 0.4;
  for (const cnt of rows) {
    const k = Math.min(cnt, left);
    if (k <= 0) break;
    left -= k;
    for (let i = 0; i < k; i++) drawApple(c, x + (i - (k - 1) / 2) * r * 2.1, yy, r, RED, lw * 0.7);
    yy -= r * 1.7;
  }
  ink(c, lw);
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(x - w / 2, y - h);
  c.lineTo(x + w / 2, y - h);
  c.lineTo(x + w * 0.4, y);
  c.lineTo(x - w * 0.4, y);
  c.closePath();
  c.fill();
  c.stroke();
  c.lineWidth = lw * 0.6;
  c.beginPath();
  for (let i = 1; i < 4; i++) {
    c.moveTo(x - w / 2 + (w * i) / 4, y - h);
    c.lineTo(x - w * 0.4 + (w * 0.8 * i) / 4, y);
  }
  c.moveTo(x - w * 0.46, y - h * 0.5);
  c.lineTo(x + w * 0.46, y - h * 0.5);
  c.stroke();
}

/** iPhone Duo:并排的两部手机。 */
export function phone(c: C, x: number, y: number, u: number): void {
  const w = 0.07 * u;
  const h = 0.15 * u;
  const lw = Math.max(1.2, u * 0.012);
  ink(c, lw);
  for (const k of [0, 1]) {
    const px = x + (k ? 0.05 : -0.05) * u;
    c.save();
    c.translate(px, y);
    c.rotate(k ? 0.1 : -0.1);
    c.fillStyle = '#fff';
    c.beginPath();
    c.roundRect(-w / 2, -h, w, h, w * 0.25);
    c.fill();
    c.stroke();
    c.fillStyle = k ? '#ddd' : '#fff';
    c.fillRect(-w * 0.38, -h * 0.94, w * 0.76, h * 0.78);
    if (k) drawApple(c, 0, -h * 0.55, w * 0.2, RED, lw * 0.7);
    c.restore();
  }
}

/** 库克发布会的小舞台。active 时亮灯。 */
export function stage(c: C, x: number, y: number, u: number, active: boolean, t: number): void {
  const lw = Math.max(1.2, u * 0.012);
  // 灯光
  if (active) {
    c.fillStyle = 'rgba(224,32,42,0.14)';
    for (const sx of [-0.2, 0.2]) {
      c.beginPath();
      c.moveTo(x + sx * u, y - 0.4 * u);
      c.lineTo(x + (sx - 0.12) * u, y);
      c.lineTo(x + (sx + 0.12) * u, y);
      c.closePath();
      c.fill();
    }
  }
  // 大屏幕
  ink(c, lw);
  c.fillStyle = active ? '#fff3f3' : '#fff';
  c.fillRect(x - 0.2 * u, y - 0.33 * u, 0.4 * u, 0.22 * u);
  c.strokeRect(x - 0.2 * u, y - 0.33 * u, 0.4 * u, 0.22 * u);
  drawApple(c, x, y - 0.22 * u, 0.055 * u * (active ? 1 + 0.08 * Math.sin(t * 8) : 1), active ? RED : '#bbb', lw);
  // 台
  c.fillStyle = INK;
  c.fillRect(x - 0.24 * u, y - 0.04 * u, 0.48 * u, 0.04 * u);
  // 讲台
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(x + 0.04 * u, y - 0.04 * u);
  c.lineTo(x + 0.16 * u, y - 0.04 * u);
  c.lineTo(x + 0.14 * u, y - 0.14 * u);
  c.lineTo(x + 0.06 * u, y - 0.14 * u);
  c.closePath();
  c.fill();
  c.stroke();
  person(c, x - 0.06 * u, y - 0.04 * u, 0.22 * u, { suit: true, glasses: true, arm: active ? 0.55 + 0.45 * Math.sin(t * 7) : 0.15, dir: 1 });
}

/** 最美的苹果指示牌 */
export function sign(c: C, x: number, y: number, u: number): void {
  const lw = Math.max(1.2, u * 0.012);
  ink(c, lw);
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y - 0.17 * u);
  c.stroke();
  c.fillStyle = '#fff';
  c.fillRect(x - 0.07 * u, y - 0.27 * u, 0.14 * u, 0.12 * u);
  c.strokeRect(x - 0.07 * u, y - 0.27 * u, 0.14 * u, 0.12 * u);
  drawApple(c, x, y - 0.205 * u, 0.04 * u, GOLD, lw * 0.8);
}

/** 风:从左到右划过天空的卷线 */
export function wind(c: C, w: number, h: number, t: number, n: number): void {
  c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const sp = 0.07 + 0.05 * ((i * 7) % 5) / 4;
    const p = (((t * sp + i * 0.37) % 1) + 1) % 1;
    const x = -60 + p * (w + 120);
    const y = h * (0.12 + 0.5 * (((i * 0.6180339) % 1)));
    const wob = Math.sin(t * 1.5 + i) * 4;
    c.strokeStyle = '#999';
    c.lineWidth = 1.6;
    c.globalAlpha = 0.75;
    c.beginPath();
    c.moveTo(x - 38, y + wob);
    c.bezierCurveTo(x - 22, y - 5 + wob, x - 6, y + 5 + wob, x + 8, y + wob);
    c.arc(x + 8, y - 4 + wob, 4, Math.PI / 2, -Math.PI, true);
    c.stroke();
    // 被风带着的小叶子
    c.fillStyle = '#fff';
    c.strokeStyle = INK;
    c.lineWidth = 1.2;
    c.beginPath();
    c.ellipse(x + 22, y + wob - 8 + Math.sin(t * 4 + i) * 3, 5, 2.4, Math.sin(t * 3 + i), 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.globalAlpha = 1;
  }
}
