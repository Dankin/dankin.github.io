/** 生产线 6 档:树 / 果园 / 果山 / 果城 / 果星 / 苹果之门。原点 = 底部中心,x∈[-30,30],高 ≤46 单位。 */
import { APPLE, P, TAU, apple, applePath, blob, circ, clamp, pen, poly, rect, rs, seg, sparkle, sv, text } from './pen.ts';

type C = CanvasRenderingContext2D;

export interface SrcOpt {
  t: number;
  /** 各档数量 */
  n: number[];
  /** 各档分支 0|1|-1 */
  br: number[];
  /** 摇晃激励 0..1 */
  sway: number;
  /** 摇劲 0..1 */
  shake: number;
  reduced: boolean;
}

/** 各档"出果点"(相对原点),UI 的飞果从这里出发 */
export const EMIT: Array<[number, number]> = [
  [4, -20],
  [22, -6],
  [22, -3],
  [24, -3],
  [8, -2],
  [14, -18],
];
export const SRC_NAMES = ['老树', '果园', '果山', '果城', '果星', '苹果之门'];

const TREE_APPLES: number[] = [-7, -22, 6, -21, 0, -28, -3, -34, 8, -29, -10, -27, 3, -23, -6, -30, 10, -23];

function tree(c: C, x: number, y: number, s: number, o: SrcOpt, napples: number, ph = 0): void {
  const sw = o.reduced ? 0 : Math.sin(o.t * 1.1 + ph) * 0.012 + Math.sin(o.t * 9 + ph) * 0.03 * o.sway;
  sv(c, x, y, s, sw);
  poly(c, [-2.4, 0, -1.7, -12, -4.5, -18, 4.5, -18, 1.7, -12, 2.4, 0], P.f2, 1.6);
  seg(c, 0, -13, -4, -20, 1.4);
  seg(c, 0, -13, 4, -20, 1.4);
  blob(c, [0, -27, 10.5, -9, -22, 7.5, 9, -22, 7.5, -5, -33, 7, 5.5, -33, 7.5], P.f1, 1.7);
  // 叶纹
  pen(c, 1, P.f3);
  c.beginPath();
  c.arc(-3, -27, 3.4, 3.6, 5.5);
  c.moveTo(7, -29);
  c.arc(5, -29, 2.4, 3.6, 5.4);
  c.stroke();
  for (let i = 0; i < napples; i++) apple(c, TREE_APPLES[i * 2], TREE_APPLES[i * 2 + 1], 1.9);
  rs(c);
}

function ground(c: C, w: number): void {
  seg(c, -w, 0, w, 0, 1.5, P.f3);
}

/* ---------- 0 老树 ---------- */
function tier0(c: C, o: SrcOpt): void {
  const n = o.n[0];
  ground(c, 30);
  if (n >= 6) tree(c, -22, 0, 0.45, o, 3, 1.7); // 树苗
  if (n >= 10) tree(c, 24, 0, 0.4, o, 2, 3.1);
  tree(c, 0, 0, 1, o, clamp(2 + n, 3, 9));
  // 树桩 + 梯子
  if (n >= 3) {
    seg(c, 12, 0, 16, -13, 1.4);
    seg(c, 16, 0, 20, -13, 1.4);
    for (let i = 0; i < 4; i++) seg(c, 12.8 + i * 1.0, -2.5 - i * 3, 17.4 + i * 1.0, -2.5 - i * 3, 1.1);
  }
}

/* ---------- 1 果园 ---------- */
const ORCH: number[] = [-22, -5, 0.4, -8, -5, 0.4, 7, -5, 0.4, 21, -5, 0.4, -18, 0, 0.52, -2, 0, 0.52, 14, 0, 0.52, 27, 0, 0.5];
function tier1(c: C, o: SrcOpt): void {
  const n = clamp(3 + o.n[1], 4, 8);
  // 田垄
  pen(c, 1, P.f3);
  c.setLineDash([2.5 / 1, 2.5]);
  for (let r = 0; r < 2; r++) {
    c.beginPath();
    c.moveTo(-30, -5 + r * 5 + 2.2);
    c.lineTo(30, -5 + r * 5 + 2.2);
    c.stroke();
  }
  c.setLineDash([]);
  // 栅栏
  for (let i = 0; i < 6; i++) seg(c, -30 + i * 2.6, -1, -30 + i * 2.6, -6.5, 1.2);
  seg(c, -30, -2.8, -15, -2.8, 1.2);
  seg(c, -30, -5, -15, -5, 1.2);
  for (let i = 0; i < n; i++) tree(c, ORCH[i * 3], ORCH[i * 3 + 1], ORCH[i * 3 + 2], o, 3, i * 1.3);
  // 采果工 + 木箱
  const a = o.reduced ? 0 : Math.sin(o.t * 2.4) * 2;
  circ(c, 24, -12 - a * 0.1, 1.6, P.f0, 1.3);
  seg(c, 24, -10.4, 24, -5.5, 1.5);
  seg(c, 24, -9, 27 + a * 0.3, -14.5 - a * 0.4, 1.4);
  seg(c, 24, -5.5, 22.8, -1, 1.4);
  seg(c, 24, -5.5, 25.4, -1, 1.4);
  rect(c, 14, -4, 6, 4, P.f2, 1.3);
  apple(c, 16, -4.6, 1.2, 1);
  apple(c, 18.5, -4.8, 1.2, 1);
  if (o.br[1] === 1) {
    // 分支:温室 —— 玻璃屋顶
    poly(c, [-30, -1, -30, -9, -22, -13, -14, -9, -14, -1], null, 1.2);
    seg(c, -22, -13, -22, -1, 0.9, P.f3);
  }
}

/* ---------- 2 果山 ---------- */
function tier2(c: C, o: SrcOpt): void {
  poly(c, [-30, 0, -19, -17, -7, -43, 1, -31, 9, -35, 15, -27, 23, -11, 30, 0], P.f1, 1.8);
  // 雪顶
  poly(c, [-7, -43, -11.5, -34, -8.5, -35.5, -6, -32.5, -3.5, -35.5, 1, -31, -2.5, -37], P.f0, 1.3);
  // 梯田
  pen(c, 1.1, P.f3);
  const levels = [-9, -18, -27];
  const xs = [26, 19, 10];
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(-xs[i] - i * 1.5, levels[i] + 2);
    c.quadraticCurveTo(0, levels[i] + 7, xs[i], levels[i] + 2);
    c.stroke();
  }
  const cnt = clamp(4 + o.n[2], 4, 20);
  for (let i = 0; i < cnt; i++) {
    const lv = i % 3;
    const per = Math.ceil(cnt / 3);
    const k = Math.floor(i / 3);
    const span = xs[lv] - 3;
    const px = -span + ((k + 0.5) / per) * span * 2;
    const py = levels[lv] + 2 + 5 * (1 - Math.pow(px / (xs[lv] + 1), 2)) * 1 + 0.4;
    seg(c, px, py, px, py - 2.3, 1);
    circ(c, px, py - 3.5, 1.6, P.f2, 1);
    if (i % 2 === 0) apple(c, px + 0.6, py - 3, 0.9, 0.8);
  }
  // 旗
  seg(c, -7, -43, -7, -50 + 3, 1.3);
  poly(c, [-7, -47, -2.5, -45.5, -7, -44], APPLE, 1);
  // 山脚小屋 + 出口
  poly(c, [18, 0, 18, -4, 22, -7, 26, -4, 26, 0], P.f0, 1.4);
  rect(c, 21, -3.2, 2, 3.2, P.f2, 1);
  if (o.br[2] === 1) {
    // 分支:缆车
    seg(c, -24, -3, -7, -41, 1);
    const f = (o.t * 0.07) % 1;
    const gx = -24 + 17 * f;
    const gy = -3 - 38 * f;
    rect(c, gx - 1.8, gy + 0.5, 3.6, 3, P.f0, 1.1);
  } else if (o.br[2] === 0) {
    // 分支:隧道传送带
    pen(c, 1.2, P.ink);
    c.beginPath();
    c.arc(-1, -1, 4, Math.PI, 0);
    c.stroke();
  }
}

/* ---------- 3 果城 ---------- */
function tier3(c: C, o: SrcOpt): void {
  const nb = clamp(1 + o.n[3], 2, 6);
  const side: Array<[number, number, number]> = [
    [-25, 7, 14],
    [-17.5, 7, 22],
    [-10, 7, 17],
    [10, 7, 19],
    [17.5, 7, 12],
    [25, 7, 21],
  ];
  const order = [1, 4, 0, 3, 2, 5];
  for (let k = 0; k < nb; k++) {
    const [bx, bw, bh] = side[order[k]];
    rect(c, bx - bw / 2, -bh, bw, bh, P.f1, 1.5);
    const nr = Math.floor(bh / 4.5);
    for (let r = 0; r < nr; r++) for (let q = 0; q < 2; q++) {
      const lit = ((r * 3 + q + k + Math.floor(o.t * 0.3)) % 4) !== 0;
      rect(c, bx - 2.6 + q * 3.4, -bh + 2 + r * 4.4, 1.9, 2.2, lit ? P.f0 : P.f3, 0.8);
    }
    if (o.br[3] === 1) {
      circ(c, bx - 1.5, -bh - 1.2, 1.4, P.f2, 1);
      circ(c, bx + 1.6, -bh - 1.7, 1.2, P.f2, 1);
    } else seg(c, bx, -bh, bx, -bh - 3, 1.1);
  }
  // 苹果大厦
  rect(c, -4, -18, 8, 18, P.f0, 1.6);
  for (let r = 0; r < 3; r++) rect(c, -2.6, -15 + r * 4.8, 5.2, 2.4, P.f1, 0.8);
  applePath(c, 0, -29, 10);
  c.fillStyle = P.f0;
  c.fill();
  pen(c, 1.8);
  c.stroke();
  // 咬口
  c.beginPath();
  c.arc(10.4, -32, 3.6, 0, TAU);
  c.fillStyle = P.paper;
  c.fill();
  circ(c, -2, -30, 1.1, P.f2, 0.9);
  circ(c, 2, -26, 1.1, P.f2, 0.9);
  circ(c, -3, -25, 1.1, P.f2, 0.9);
  // 叶
  c.beginPath();
  c.moveTo(0, -38.5);
  c.quadraticCurveTo(2, -43, 6.5, -43.5);
  c.quadraticCurveTo(5, -39.5, 0, -38.5);
  c.fillStyle = P.f2;
  c.fill();
  pen(c, 1.2);
  c.stroke();
  if (o.br[3] === 0) sparkle(c, 0, -46, 2.4, P.ink, o.t);
}

/* ---------- 4 果星 ---------- */
function tier4(c: C, o: SrcOpt): void {
  const cy = -27;
  const R = 15;
  const ang = o.reduced ? 0 : o.t * 0.12;
  // 星星
  for (let i = 0; i < 5; i++) {
    const tw = 0.5 + 0.5 * Math.sin(o.t * 1.3 + i * 2.1);
    sparkle(c, [-27, 26, -22, 25, 0][i], [-40, -35, -12, -14, -46][i], 1 + tw * 1.1, P.f3, 0);
  }
  // 环(后半)
  pen(c, 1.4);
  c.beginPath();
  c.ellipse(0, cy, 26, 5.5, -0.28, Math.PI, TAU);
  c.stroke();
  circ(c, 0, cy, R, P.f1, 1.8);
  pen(c, 1, P.f3);
  c.beginPath();
  c.arc(-5, cy + 3, 4, 0.3, 2.4);
  c.moveTo(8, cy - 5);
  c.arc(6, cy - 5, 2.4, 0, 3.5);
  c.stroke();
  // 星上的树
  const nt = clamp(3 + o.n[4], 3, 11);
  for (let i = 0; i < nt; i++) {
    const a = ang + (i / nt) * TAU;
    const px = Math.cos(a) * R;
    const py = cy + Math.sin(a) * R;
    sv(c, px, py, 1, a + Math.PI / 2);
    seg(c, 0, 0, 0, -3, 1);
    circ(c, 0, -4.6, 2.1, P.f0, 1.2);
    if (i % 2 === 0) apple(c, 1, -4.2, 1.1, 0.9);
    rs(c);
  }
  // 环(前半)
  pen(c, 1.4);
  c.beginPath();
  c.ellipse(0, cy, 26, 5.5, -0.28, 0, Math.PI);
  c.stroke();
  // 小卫星
  const ma = o.t * 0.5;
  circ(c, Math.cos(ma) * 28, cy - 14 + Math.sin(ma) * 4, 2, P.f2, 1.2);
  // 太空电梯
  c.setLineDash([2, 1.8]);
  seg(c, 8, cy + R * 0.85, 8, -1.5, 1.1);
  c.setLineDash([]);
  const ef = (o.t * 0.12) % 1;
  const ey = cy + R + (-1.5 - cy - R) * (ef < 0.5 ? ef * 2 : 2 - ef * 2);
  rect(c, 6.3, ey - 1.5, 3.4, 3, P.f0, 1);
  poly(c, [2, 0, 4, -3, 12, -3, 14, 0], P.f2, 1.4);
  if (o.br[4] === 1) {
    // 分支:星舰
    poly(c, [-20, 0, -20, -9, -17.5, -13, -15, -9, -15, 0], P.f0, 1.3);
    poly(c, [-20, -3, -23, 0, -20, 0], P.f2, 1);
    poly(c, [-15, -3, -12, 0, -15, 0], P.f2, 1);
  }
}

/* ---------- 5 苹果之门 ---------- */
function tier5(c: C, o: SrcOpt): void {
  const cy = -25;
  const rot = o.reduced ? 0 : o.t * (0.8 + o.shake * 2);
  // 底座阶梯
  poly(c, [-22, 0, -19, -3, 19, -3, 22, 0], P.f1, 1.4);
  poly(c, [-17, -3, -14, -6, 14, -6, 17, -3], P.f0, 1.4);
  // 门框
  applePath(c, 0, cy, 17);
  c.fillStyle = P.f0;
  c.fill();
  pen(c, 2.4);
  c.stroke();
  applePath(c, 0, cy, 13.2);
  c.fillStyle = P.ink;
  c.fill();
  // 漩涡
  const rings = clamp(1 + o.n[5], 1, 4);
  c.save();
  applePath(c, 0, cy, 13.2);
  c.clip();
  c.translate(0, cy);
  c.rotate(rot);
  for (let i = 0; i < rings + 1; i++) {
    pen(c, 1.3, P.paper);
    c.beginPath();
    for (let k = 0; k < 24; k++) {
      const a = k * 0.32 + i * (TAU / (rings + 1));
      const r = 1.3 + k * 0.5;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (k === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  c.restore();
  // 符文
  for (let i = 0; i < 12; i++) {
    const a = -rot * 0.4 + (i / 12) * TAU;
    seg(c, Math.cos(a) * 20.5, cy + Math.sin(a) * 20.5 * 0.92 - 1, Math.cos(a) * 22.4, cy + Math.sin(a) * 22.4 * 0.92 - 1, 1.2, i % 3 === 0 ? P.ink : P.f3);
  }
  // 环绕小苹果
  for (let i = 0; i < clamp(o.n[5], 0, 5); i++) {
    const a = o.t * 0.7 + (i / 5) * TAU;
    apple(c, Math.cos(a) * 25, cy + Math.sin(a) * 8 - 2, 1.4, 0.9);
  }
  if (o.br[5] === 1) sparkle(c, 0, cy - 24, 3, P.ink, o.t * 0.5);
}

const OLD_TREE_X = [0, -26, -27, -27, -24, -27];
export function drawSource(c: C, tier: number, o: SrcOpt): void {
  switch (tier) {
    case 0: tier0(c, o); break;
    case 1: tier1(c, o); break;
    case 2: tier2(c, o); break;
    case 3: tier3(c, o); break;
    case 4: tier4(c, o); break;
    default: tier5(c, o);
  }
  // 分支 0 的标志轮廓(分支 1 的在各档函数内)
  if (tier === 1 && o.br[1] === 0) {
    // 密植:前排一行小树苗
    for (let k = 0; k < 5; k++) {
      const x = -26 + k * 12.5;
      seg(c, x, 0.4, x, -3.6, 1.2);
      circ(c, x, -5.6, 2.4, P.f1, 1.1);
      apple(c, x + 0.6, -5.4, 0.8, 0.6);
    }
  }
  if (tier === 4 && o.br[4] === 0) {
    // 自转摇柄:行星侧面一根大摇柄
    const a = o.t * 2;
    circ(c, 25, -20, 3.2, P.f0, 1.3);
    seg(c, 25, -20, 25 + Math.cos(a) * 6, -20 + Math.sin(a) * 6, 1.4);
    circ(c, 25 + Math.cos(a) * 6, -20 + Math.sin(a) * 6, 1.1, P.ink, 0.8);
  }
  if (tier === 5 && o.br[5] === 0) {
    // 双生门:旁边再立一扇小门
    c.beginPath();
    c.ellipse(26, -10, 4.2, 9, 0, 0, TAU);
    pen(c, 1.3);
    c.stroke();
    c.beginPath();
    c.ellipse(26, -10, 1.8 + Math.sin(o.t * 3) * 0.4, 5.4, 0, 0, TAU);
    pen(c, 1, P.f3);
    c.stroke();
  }
  if (tier > 0 && o.n[0] > 0) tree(c, OLD_TREE_X[tier], 0, 0.33, o, 3, 5.5);
}

/* ---------- 苹果堆 ---------- */
export const PILE_MAX = 28;
export function drawPile(c: C, count: number, full: boolean, t: number): void {
  const j = full ? Math.sin(t * 22) * 0.25 : 0;
  rect(c, -8.5, -1.2, 17, 1.2, P.f2, 1.2);
  let k = 0;
  for (let row = 0; row < 7 && k < count; row++) {
    const per = 7 - row;
    for (let i = 0; i < per && k < count; i++, k++) {
      apple(c, (i - (per - 1) / 2) * 2.35 + j, -2.6 - row * 2.1, 1.25, 0.9);
    }
  }
  if (full) text(c, '满了', 0, -19, 11, APPLE);
}

/* ---------- 摇劲条(树旁小计量) ---------- */
/**
 * 摇劲:树根下的一道细弧(空时不画);连摇≥2 时弧心写 ×N。
 * 原点 = 树根(地面线上),r = 弧半径(世界单位)
 */
export function drawShakeMeter(c: C, v: number, combo: number, _hint: number, t: number, r = 15): void {
  if (v < 0.02 && combo < 2) return;
  const a0 = Math.PI * 0.18;
  const a1 = Math.PI * 0.82;
  const cy = 1.5 - r * Math.sin(a0) + 3.4;
  c.save();
  c.lineCap = 'round';
  c.beginPath();
  c.arc(0, cy, r, a0, a1);
  c.lineWidth = 2.2 * (c.getTransform().a ? 1 / Math.max(0.0001, c.getTransform().a) : 1);
  c.strokeStyle = P.f2;
  c.stroke();
  if (v > 0.02) {
    c.beginPath();
    c.arc(0, cy, r, a0, a0 + (a1 - a0) * Math.min(1, v));
    c.lineWidth = 2.2 * (c.getTransform().a ? 1 / Math.max(0.0001, c.getTransform().a) : 1);
    c.strokeStyle = P.ink;
    c.stroke();
  }
  c.restore();
  if (combo >= 2) text(c, `×${combo}`, 0, cy + r + 3 + Math.abs(Math.sin(t * 6)) * 0.6, 11, P.ink);
}
