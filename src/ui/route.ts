/** 运输线 6 档:篮子 / 推车 / 卡车 / 货船 / 飞机 / 传送门;终点码头 6 档;关卡拱门图标。 */
import { APPLE, P, TAU, apple, circ, clamp, pen, poly, rect, rs, seg, sparkle, sv, text } from './pen.ts';

type C = CanvasRenderingContext2D;
export const RT_NAMES = ['篮子', '推车', '卡车', '货船', '飞机', '传送门'];
/** 每档车辆最多同时画几辆,其余折成 ×N 排队标记。总和 ≤ 24 */
export const VEH_CAP = [4, 4, 4, 3, 3, 6];
/** 一个来回的秒数(UI 自己的节奏,不影响核心结算) */
export const TRIP_SEC = [11, 10, 8, 12, 9, 5];
/** 各档走哪条车道:0 公路 1 河道 2 空中 3 传送光束 */
export const LANE_OF = [0, 0, 0, 1, 2, 3];

export interface VehOpt {
  t: number;
  ph: number;
  full: boolean;
  /** 方向 +1 向右(去程) -1 向左(返程) */
  dir: number;
  br: number;
}

/** 车辆,原点 = 底部中心,朝 +x */
export function drawVehicle(c: C, tier: number, o: VehOpt): void {
  c.save();
  if (o.dir < 0) c.scale(-1, 1);
  const w = o.t * 8 + o.ph * 5;
  switch (tier) {
    case 0: {
      const sw = Math.sin(w) * 1.3;
      circ(c, 0, -5.8, 1.3, P.f0, 1.2);
      seg(c, 0, -4.5, 0, -2.2, 1.4);
      seg(c, 0, -2.2, -sw, 0, 1.4);
      seg(c, 0, -2.2, sw, 0, 1.4);
      seg(c, 0, -4, 2.4, -3, 1.2);
      poly(c, [1.8, -4.3, 4.8, -4.3, 4.1, -2, 2.4, -2], P.f2, 1.1);
      if (o.full) {
        apple(c, 2.7, -5, 0.95, 0.8);
        apple(c, 4, -5, 0.95, 0.8);
      }
      break;
    }
    case 1: {
      poly(c, [-3.6, -4.4, 3.4, -4.4, 2.6, -1.8, -2.6, -1.8], P.f2, 1.2);
      seg(c, -3.4, -4.4, -6.2, -2.4, 1.2);
      sv(c, 0, -1.5, 1, w * 0.3);
      circ(c, 0, 0, 1.5, P.f0, 1.2);
      seg(c, -1.5, 0, 1.5, 0, 0.8);
      rs(c);
      seg(c, -3, -1.8, -3, 0, 1);
      if (o.full) for (let i = 0; i < 3; i++) apple(c, -2 + i * 2, -5.3, 1, 0.8);
      break;
    }
    case 2: {
      const bob = Math.sin(w * 1.4) * 0.12;
      rect(c, -6.6, -6.4 + bob, 9, 4.8, P.f0, 1.3);
      poly(c, [2.8, -6.2 + bob, 5.2, -6.2 + bob, 7, -3.8, 7, -1.6, 2.8, -1.6], P.f1, 1.3);
      rect(c, 3.5, -5.4 + bob, 2, 1.6, P.f2, 0.8);
      seg(c, -6.6, -1.6, 7, -1.6, 1.3);
      circ(c, -3.6, -1.3, 1.5, P.f2, 1.2);
      circ(c, 4.2, -1.3, 1.5, P.f2, 1.2);
      if (o.full) for (let i = 0; i < 4; i++) apple(c, -5.4 + i * 2.2, -7.4 + bob, 1.05, 0.8);
      else rect(c, -6.6, -6.4 + bob, 9, 0.6, P.f2, 0.6);
      break;
    }
    case 3: {
      const bob = Math.sin(o.t * 1.6 + o.ph * 3) * 0.35;
      c.translate(0, bob);
      poly(c, [-7.4, -3.2, 7.6, -3.2, 5.6, -0.2, -5.4, -0.2], P.f1, 1.4);
      rect(c, 1.8, -6.4, 4, 3.2, P.f0, 1.2);
      rect(c, 3.2, -8.5, 1.4, 2.1, P.f2, 1.1);
      seg(c, 3.9, -8.5, 3.9 + Math.sin(o.t * 2) * 0.6, -10.2, 1);
      rect(c, -6.2, -5.7, 3, 2.5, P.f2, 1);
      rect(c, -3.2, -5.7, 3, 2.5, P.f2, 1);
      if (o.full) {
        apple(c, -4.7, -6.5, 0.9, 0.7);
        apple(c, -1.7, -6.5, 0.9, 0.7);
      }
      break;
    }
    case 4: {
      const bob = Math.sin(o.t * 2 + o.ph * 3) * 0.4;
      c.translate(0, bob - 1);
      poly(c, [-4.4, -2.7, -6.9, -6, -5.3, -6, -2.6, -2.9], P.f1, 1.2);
      c.beginPath();
      c.ellipse(0, -2, 5.7, 1.9, 0, 0, TAU);
      c.fillStyle = P.f0;
      c.fill();
      pen(c, 1.3);
      c.stroke();
      poly(c, [0.8, -1.4, -1.8, 2.2, -0.2, 2.2, 2.6, -1.4], P.f1, 1.2);
      circ(c, 2.8, -2.4, 0.7, P.f2, 0.8);
      seg(c, 5.9, -3.9 + Math.sin(w * 3) * 0.4, 5.9, -0.4 - Math.sin(w * 3) * 0.4, 1.1);
      rect(c, -1.6, -0.2, 3.2, 1.8, P.f2, 1);
      if (o.full) apple(c, 0, 0.8, 0.7, 0.6);
      break;
    }
    default:
      break;
  }
  // 分支标志轮廓(只在有分支时):br0 = 载量系(更宽更高),br1 = 速度系(速度线/尾迹)
  if (o.br >= 0 && tier >= 1 && tier <= 4) {
    const fast = o.br === 1;
    const t = o.t;
    if (fast) {
      const k = (Math.sin(t * 9 + o.ph) + 1) * 0.5;
      pen(c, 1, P.f3);
      const my = tier === 1 ? -4 : tier === 3 ? -2.5 : tier === 4 ? -8 : -5;
      const L0 = tier === 4 ? 16 : 9;
      seg(c, -L0, my - 2, -L0 - 5 - k * 3, my - 2, 1, P.f3);
      seg(c, -L0 + 1, my + 1, -L0 - 3 - k * 4, my + 1, 1, P.f3);
      if (tier === 2) {
        rect(c, 3.4, -9.4, 3.6, 2.6, P.f0, 1, 0.5); // 通行证
        seg(c, 4.2, -8.6, 6.2, -8.6, 0.8);
      }
      if (tier === 3) {
        seg(c, 8, -1.6, 11 + k * 2, -3.4, 1, P.f3);
        seg(c, 8.4, -0.8, 12 + k * 2, -0.8, 1, P.f3);
      }
      if (tier === 4) sparkle(c, 12, -9, 1.4, P.ink, t * 3);
    } else {
      if (tier === 1) rect(c, -3, -11.4, 5.6, 3.6, P.f1, 1.1, 0.4);
      if (tier === 2) {
        rect(c, -3, -12.4, 7.6, 3, P.f1, 1.1, 0.4);
        seg(c, 6, -11.6, 6, -14.6, 1.4);
      }
      if (tier === 3) {
        rect(c, -4, -13, 4, 3, P.f1, 1.1, 0.4);
        rect(c, 0.4, -13, 4, 3, P.f1, 1.1, 0.4);
      }
      if (tier === 4) rect(c, -4.6, -3.2, 9.2, 2.6, P.f1, 1.1, 1.2);
    }
  }
  c.restore();
}

/** 传送光束上的"珠子" */
export function drawBead(c: C, full: boolean, t: number): void {
  if (full) apple(c, 0, 0, 1.3, 1);
  else {
    circ(c, 0, 0, 1.1, P.paper, 1);
    void t;
  }
}

/* ---------- 车道上的景:传送门环 ---------- */
export function drawPortalRing(c: C, x: number, y: number, t: number, flip: boolean): void {
  sv(c, x, y, 1);
  c.beginPath();
  c.ellipse(0, -7, 3.2, 8, 0, 0, TAU);
  c.fillStyle = P.ink;
  c.fill();
  pen(c, 2);
  c.stroke();
  pen(c, 1, P.paper);
  c.beginPath();
  c.ellipse(0, -7, 1.6 + Math.sin(t * 3 + (flip ? 1 : 0)) * 0.4, 5.4, 0, 0, TAU);
  c.stroke();
  seg(c, -3.4, 0, -4.6, 0, 1.4);
  rs(c);
}

/* ---------- 终点:6 档 ---------- */
export function drawCrates(c: C, n: number): void {
  let k = 0;
  for (let row = 0; row < 4 && k < n; row++) {
    const per = 4 - row;
    for (let i = 0; i < per && k < n; i++, k++) {
      const x = (i - (per - 1) / 2) * 3.4;
      rect(c, x - 1.6, -3.1 - row * 3.1, 3.2, 3.1, P.f2, 1);
      apple(c, x, -1.5 - row * 3.1, 0.7, 0.6);
    }
  }
}
export function dockLabel(c: C, x: number, y: number): void {
  rect(c, x - 6, y - 2.6, 12, 5.2, P.f0, 1.2, 1.2);
  text(c, '送达', x, y + 0.2, 10, P.ink);
}

export function drawDock(c: C, tier: number, t: number, pulse: number, crates: number): void {
  c.save();
  if (pulse > 0.01) {
    const s = 1 + pulse * 0.04;
    c.translate(0, 0);
    c.scale(s, s);
  }
  seg(c, -20, 0, 20, 0, 1.5, P.f3);
  switch (tier) {
    case 0: {
      // 摊位
      seg(c, -14, -8, -14, 0, 1.5);
      seg(c, 6, -8, 6, 0, 1.5);
      rect(c, -15, -8, 22, 2.5, P.f2, 1.5);
      for (let i = 0; i < 5; i++) {
        poly(c, [-16 + i * 4.8, -20, -11.2 + i * 4.8, -20, -10.6 + i * 4.8, -12.5, -16.6 + i * 4.8, -12.5], i % 2 ? P.f0 : P.f2, 1.2);
      }
      seg(c, -16, -20, 8, -20, 1.5);
      apple(c, -10, -9.6, 1.3, 1);
      apple(c, -6.5, -9.6, 1.3, 1);
      apple(c, -3, -9.6, 1.3, 1);
      dockLabel(c, -4, -24);
      break;
    }
    case 1: {
      rect(c, -16, -17, 27, 17, P.f1, 1.6);
      poly(c, [-18, -17, -2.5, -26, 13, -17], P.f2, 1.6);
      rect(c, -13, -12, 8, 12, P.f0, 1.3);
      rect(c, 0, -13, 8, 7, P.f0, 1.3);
      seg(c, 4, -13, 4, -6, 1);
      apple(c, -2.5, -21, 2.2, 1.2);
      rect(c, -13, -4, 6, 1.8, P.f2, 0.9);
      break;
    }
    case 2: {
      rect(c, -18, -19, 30, 19, P.f1, 1.6);
      c.beginPath();
      c.moveTo(-19, -19);
      c.quadraticCurveTo(-3, -30, 13, -19);
      c.fillStyle = P.f2;
      c.fill();
      pen(c, 1.6);
      c.stroke();
      rect(c, -13, -14, 14, 14, P.f0, 1.4);
      for (let i = 0; i < 4; i++) seg(c, -13, -11 + i * 3.4, 1, -11 + i * 3.4, 0.9, P.f3);
      apple(c, 7.5, -23, 2, 1.1);
      poly(c, [-19, 0, -19, -2, -22, 0], P.f2, 1);
      break;
    }
    case 3: {
      // 码头 + 吊机 + 集装箱
      rect(c, -20, -3, 38, 3, P.f2, 1.4);
      for (let i = 0; i < 5; i++) seg(c, -18 + i * 8.5, 0, -18 + i * 8.5, 3.5, 1.3);
      seg(c, 4, -3, 4, -26, 1.8);
      seg(c, 8, -3, 8, -26, 1.8);
      seg(c, 4, -12, 8, -18, 1);
      seg(c, 8, -12, 4, -18, 1);
      seg(c, -14, -27, 11, -27, 2);
      const sw = Math.sin(t * 0.9) * 2;
      seg(c, -9 + sw, -27, -9 + sw, -15, 1);
      rect(c, -11.5 + sw, -15, 5, 3, P.f0, 1.1);
      rect(c, 11, -8, 6, 5, P.f2, 1.2);
      rect(c, 11, -13, 6, 5, P.f0, 1.2);
      seg(c, 13, -13, 13, -3, 0.8, P.f3);
      break;
    }
    case 4: {
      seg(c, -20, -0.5, 18, -0.5, 1.2, P.f3);
      c.setLineDash([3 / 1, 3]);
      seg(c, -19, 1.8, 19, 1.8, 1, P.f3);
      c.setLineDash([]);
      rect(c, 10, -23, 4.6, 23, P.f1, 1.5);
      poly(c, [8, -23, 16.6, -23, 15.4, -28, 9.2, -28], P.f0, 1.4);
      seg(c, 12.3, -28, 12.3, -32, 1.2);
      c.beginPath();
      c.moveTo(-18, 0);
      c.quadraticCurveTo(-18, -16, -4, -16);
      c.quadraticCurveTo(7, -16, 7, 0);
      c.fillStyle = P.f1;
      c.fill();
      pen(c, 1.6);
      c.stroke();
      rect(c, -12, -9, 12, 9, P.f0, 1.2);
      // 风向袋
      seg(c, -17, 0, -17, -10, 1.2);
      poly(c, [-17, -10, -12.5, -9.4 + Math.sin(t * 3) * 0.5, -12.8, -8, -17, -8.5], APPLE, 1);
      break;
    }
    default: {
      // 出口环 + 底座
      poly(c, [-18, 0, -15, -3, 12, -3, 15, 0], P.f1, 1.4);
      c.beginPath();
      c.ellipse(-2, -16, 7.5, 14, 0, 0, TAU);
      c.fillStyle = P.ink;
      c.fill();
      pen(c, 2.4);
      c.stroke();
      c.save();
      c.beginPath();
      c.ellipse(-2, -16, 7.5, 14, 0, 0, TAU);
      c.clip();
      pen(c, 1.2, P.paper);
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.ellipse(-2, -16, 1.5 + i * 2.3 + ((t * 2) % 2.3), 3 + i * 4.3 + ((t * 2) % 2.3) * 1.8, 0, 0, TAU);
        c.stroke();
      }
      c.restore();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        seg(c, -2 + Math.cos(a) * 9.4, -16 + Math.sin(a) * 16.4, -2 + Math.cos(a) * 11.2, -16 + Math.sin(a) * 19, 1.2, i % 2 ? P.f3 : P.ink);
      }
      break;
    }
  }
  if (pulse > 0.05) sparkle(c, 4, -16 - pulse * 6, 3 * pulse + 1, P.ink, t * 3);
  c.restore();
  c.save();
  c.translate(tier === 5 ? 6 : 13, 0);
  drawCrates(c, crates);
  c.restore();
}

/* ---------- 关卡图标 ---------- */
export const GATE_IDS = ['wash', 'wax', 'juice', 'pack', 'cold', 'rush', 'string', 'belt', 'glove', 'chant', 'brand'];
export function gateIcon(c: C, id: string, x: number, y: number, s: number): void {
  sv(c, x, y, s);
  pen(c, 1.5);
  switch (id) {
    case 'wash':
      c.beginPath();
      c.moveTo(0, -3);
      c.quadraticCurveTo(2.4, 0.2, 0, 2.4);
      c.quadraticCurveTo(-2.4, 0.2, 0, -3);
      c.stroke();
      break;
    case 'wax':
      sparkle(c, 0, 0, 2.8, P.ink, 0);
      break;
    case 'juice':
      poly(c, [-2, -1.6, 2, -1.6, 1.3, 2.6, -1.3, 2.6], null, 1.4);
      seg(c, 0.5, -1.6, 1.6, -3.4, 1.2);
      break;
    case 'pack':
      rect(c, -2.4, -2, 4.8, 4.2, null, 1.4);
      seg(c, -2.4, -0.4, 2.4, -0.4, 1.1);
      seg(c, 0, -2, 0, -0.4, 1.1);
      break;
    case 'cold':
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        seg(c, Math.cos(a) * 2.8, Math.sin(a) * 2.8, -Math.cos(a) * 2.8, -Math.sin(a) * 2.8, 1.2);
      }
      break;
    case 'rush':
      poly(c, [0.8, -3.2, -2, 0.4, -0.2, 0.4, -0.8, 3.2, 2, -0.5, 0.1, -0.5], null, 1.3);
      break;
    case 'string':
    case 'red':
      c.beginPath();
      c.arc(0, -0.4, 2, 0, TAU);
      pen(c, 1.5, P.ink);
      c.stroke();
      seg(c, 0, 1.6, -1.6, 3.2, 1.3, P.ink);
      seg(c, 0, 1.6, 1.6, 3.2, 1.3, P.ink);
      break;
    case 'belt':
      // 流水线:传送带 + 两只滚轮
      c.beginPath();
      c.roundRect(-3.4, -0.4, 6.8, 2.6, 1.3);
      pen(c, 1.3);
      c.stroke();
      circ(c, -2.1, 0.9, 0.55, P.ink, 0.6);
      circ(c, 2.1, 0.9, 0.55, P.ink, 0.6);
      apple(c, 0, -1.6, 1.2, 0.8);
      break;
    case 'glove':
      // 摇树手套:连指手套
      c.beginPath();
      c.moveTo(-1.8, 3);
      c.lineTo(-2.1, -0.6);
      c.quadraticCurveTo(-2.1, -3.2, 0.1, -3.2);
      c.quadraticCurveTo(2.1, -3.2, 2.1, -0.6);
      c.lineTo(2.3, 0.2);
      c.lineTo(3.4, -0.6);
      c.lineTo(3.6, 0.8);
      c.lineTo(1.8, 3);
      c.closePath();
      pen(c, 1.3);
      c.stroke();
      seg(c, -1.8, 1.8, 1.8, 1.8, 1);
      break;
    case 'chant':
      // 号子:喇叭 + 声波
      poly(c, [-3, -0.9, -1.2, -0.9, 1.6, -2.8, 1.6, 2.8, -1.2, 0.9, -3, 0.9], null, 1.3);
      c.beginPath();
      c.arc(1.6, 0, 2.2, -0.9, 0.9);
      pen(c, 1.1);
      c.stroke();
      c.beginPath();
      c.arc(1.6, 0, 3.4, -0.8, 0.8);
      c.stroke();
      break;
    case 'brand':
      // 品牌:吊牌
      poly(c, [-2.6, -3, 1.2, -3, 3, -1.2, 3, 3, -2.6, 3], null, 1.3);
      circ(c, 0.6, -1.4, 0.55, null, 1);
      seg(c, -1.4, 0.6, 1.8, 0.6, 1);
      seg(c, -1.4, 1.8, 1.2, 1.8, 1);
      break;
    default:
      text(c, '?', 0, 0, 9, P.dim);
  }
  rs(c);
}

/** 关卡徽章半径/中心(世界单位):空槽至少 minR(≈23 屏幕像素)使点击区 ≥44px */
export function gateBadge(minR: number): { r: number; by: number } {
  const r = Math.max(4.4, minR);
  return { r, by: -(12.2 + r) };
}

/** 关卡拱门,原点 = 路面中心。id=null 为空槽;minR=徽章最小半径(世界单位) */
export function drawGate(c: C, id: string | null, flash: number, t: number, hint: boolean, minR = 4.4, can = true): void {
  const empty = id === null;
  if (!empty) {
    seg(c, -5.6, 0.5, -5.6, -9.6, 1.1);
    seg(c, 5.6, 0.5, 5.6, -9.6, 1.1);
    c.beginPath();
    c.roundRect(-6.8, -11.6, 13.6, 2.6, 1);
    c.fillStyle = P.f0;
    c.fill();
    pen(c, 1.1);
    c.stroke();
  }
  // 徽章:空槽 = 淡虚线圈(买得起:44px + 呼吸;买不起:更淡,不呼吸)
  const { r, by } = gateBadge(empty ? minR : Math.max(3.9, minR * 0.85));
  c.save();
  if (empty) {
    c.globalAlpha = can ? 0.85 : 0.4;
    c.setLineDash([2.2, 1.8]);
    if (can) {
      c.beginPath();
      c.arc(0, by, r + 0.9 + Math.sin(t * 2.6) * 0.8, 0, TAU);
      pen(c, 0.7, P.f3);
      c.globalAlpha = 0.55 + 0.3 * Math.sin(t * 2.6);
      c.stroke();
      c.globalAlpha = 0.85;
    }
  }
  circ(c, by === by ? 0 : 0, by, r, empty ? null : flash > 0.05 ? P.f2 : P.f0, empty ? 0.8 : 1.2);
  c.restore();
  if (empty) text(c, '+', 0, by, Math.round(r * 3.2), can ? P.ink : P.dim);
  else gateIcon(c, id as string, 0, by, (r / 3.9) * 1.05);
  if (flash > 0.05) {
    sparkle(c, r + 1, by - r + 0.4, 1.6 + flash, P.ink, t * 4);
    sparkle(c, -r - 1, by - r + 1, 1.2 + flash * 0.7, P.ink, -t * 3);
  }
  void clamp;
  void hint;
}
