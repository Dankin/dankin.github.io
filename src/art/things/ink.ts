// 手绘粗描边工具:略抖的直线/多边形/椭圆,端点出头(像笔没抬起来),填充用米白暖灰。
// 每个 Ink 实例持有一条确定性随机流:同 seed + 同调用顺序 => 每帧线条完全一致,不闪。
import { PAL, rng } from '../style.ts';
import type { C } from './bake.ts';

export type { C };
export type Pt = [number, number];

/** 线稿底色(米白/暖灰)。红色只留给苹果。 */
export const F = {
  white: '#fffdf6',
  cream: '#f6efdc',
  warm: '#ece0c4',
  gray: '#ddd6c6',
  gray2: '#bfb7a5',
  gray3: '#8f8878',
  shade: 'rgba(110,88,52,0.16)',
  shade2: 'rgba(110,88,52,0.28)',
  wood: '#d9b27a',
  woodDark: '#a8763f',
  water: '#d4e6ea',
  waterDark: '#a9cbd3',
  leaf: '#9bc65a',
  skin: '#f6dcc0',
  gold: '#d9a521',
} as const;
export const INK = PAL.ink;
export const TAU = Math.PI * 2;
/** 全局线宽系数(整体偏粗/偏细在这里调) */
export const LW = 0.82;

export interface ShapeOpt {
  fill?: string;
  lw?: number;
  /** 抖动幅度(世界单位) */
  j?: number;
  /** 底部阴影色(按包围盒下 38% 叠) */
  shade?: string;
  /** 不描边 */
  nostroke?: boolean;
  /** 折线是否平滑(圆角) */
  smooth?: boolean;
  /** 线头出头长度 */
  ext?: number;
}

export function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const ease = (k: number): number => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

export class Ink {
  r: () => number;
  constructor(public g: C, seed = 1, public lw = 2.4, public j = 0.4) {
    this.r = rng((Math.floor(seed) * 7919 + 13) >>> 0);
  }
  /** [-a, a] 的确定性随机 */
  rnd(a = 1): number {
    return (this.r() - 0.5) * 2 * a;
  }

  /** 细分 + 抖动 */
  private wob(pts: Pt[], close: boolean, j: number, step = 8): Pt[] {
    const out: Pt[] = [];
    const n = pts.length;
    const segs = close ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % n];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const m = Math.max(1, Math.round(len / step));
      for (let k = 0; k < m; k++) {
        const u = k / m;
        const e = k === 0 ? 0.6 : 1;
        out.push([lerp(x0, x1, u) + this.rnd(j * e), lerp(y0, y1, u) + this.rnd(j * e)]);
      }
    }
    if (!close) out.push([pts[n - 1][0] + this.rnd(j * 0.6), pts[n - 1][1] + this.rnd(j * 0.6)]);
    return out;
  }

  private trace(p: Pt[], close: boolean, smooth: boolean): void {
    const g = this.g;
    g.beginPath();
    if (!smooth || p.length < 3) {
      p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      if (close) g.closePath();
      return;
    }
    if (close) {
      const n = p.length;
      g.moveTo((p[n - 1][0] + p[0][0]) / 2, (p[n - 1][1] + p[0][1]) / 2);
      for (let i = 0; i < n; i++) {
        const a = p[i], b = p[(i + 1) % n];
        g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
      g.closePath();
    } else {
      g.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
      g.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    }
  }

  private inkIt(lw: number): void {
    const g = this.g;
    g.lineWidth = lw * LW;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = INK;
    g.stroke();
  }

  /** 填充 + 阴影 + 描边;pts 为已抖动点 */
  private finish(p: Pt[], close: boolean, o: ShapeOpt): void {
    const g = this.g;
    const smooth = !!o.smooth;
    if (o.fill && close) {
      this.trace(p, true, smooth);
      g.fillStyle = o.fill;
      g.fill();
      if (o.shade) {
        let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9;
        for (const q of p) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); }
        g.save();
        g.clip();
        g.fillStyle = o.shade;
        g.fillRect(x0 - 1, y0 + (y1 - y0) * 0.62, x1 - x0 + 2, (y1 - y0) * 0.4);
        g.restore();
      }
    }
    if (!o.nostroke) {
      this.trace(p, close, smooth);
      this.inkIt(o.lw ?? this.lw);
    }
  }

  /** 多边形(闭合,默认)/折线 */
  poly(pts: Pt[], o: ShapeOpt & { close?: boolean } = {}): void {
    const close = o.close ?? true;
    const p = this.wob(pts, close, o.j ?? this.j, o.smooth ? 6 : 9);
    this.finish(p, close, o);
  }

  /** 单笔直线:两端出头、中段略弯 */
  line(x0: number, y0: number, x1: number, y1: number, o: { lw?: number; ext?: number; bow?: number } = {}): void {
    const g = this.g;
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    const e0 = o.ext ?? 0.9;
    const a: Pt = [x0 - ux * (e0 + this.r() * 0.6) + this.rnd(this.j * 0.5), y0 - uy * (e0 + this.r() * 0.6) + this.rnd(this.j * 0.5)];
    const b: Pt = [x1 + ux * (e0 + this.r() * 0.6) + this.rnd(this.j * 0.5), y1 + uy * (e0 + this.r() * 0.6) + this.rnd(this.j * 0.5)];
    const bow = o.bow ?? this.rnd(Math.min(0.9, len * 0.03));
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.quadraticCurveTo((a[0] + b[0]) / 2 - uy * bow, (a[1] + b[1]) / 2 + ux * bow, b[0], b[1]);
    this.inkIt(o.lw ?? this.lw);
  }

  /** 自由折线描边(不填充),可平滑 */
  stroke(pts: Pt[], o: { lw?: number; smooth?: boolean; j?: number } = {}): void {
    const p = this.wob(pts, false, o.j ?? this.j * 0.7, o.smooth ? 5 : 9);
    this.trace(p, false, !!o.smooth);
    this.inkIt(o.lw ?? this.lw);
  }

  /** 矩形:填充为抖动多边形,四边各一笔,角上出头 */
  rect(x: number, y: number, w: number, h: number, o: ShapeOpt & { r?: number } = {}): void {
    if (o.r) {
      this.poly(roundRectPts(x, y, w, h, o.r), { ...o, smooth: true, j: o.j ?? this.j * 0.8 });
      return;
    }
    const j = o.j ?? this.j;
    const c: Pt[] = [
      [x + this.rnd(j), y + this.rnd(j)],
      [x + w + this.rnd(j), y + this.rnd(j)],
      [x + w + this.rnd(j), y + h + this.rnd(j)],
      [x + this.rnd(j), y + h + this.rnd(j)],
    ];
    const g = this.g;
    if (o.fill) {
      g.beginPath();
      c.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.closePath();
      g.fillStyle = o.fill;
      g.fill();
      if (o.shade) {
        g.save();
        g.clip();
        g.fillStyle = o.shade;
        g.fillRect(x - 1, y + h * 0.62, w + 2, h * 0.4);
        g.restore();
      }
    }
    if (o.nostroke) return;
    const lw = o.lw ?? this.lw;
    const ext = o.ext ?? Math.min(0.8, lw * 0.28);
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4];
      this.line(a[0], a[1], b[0], b[1], { lw, ext });
    }
  }

  /** 椭圆/圆;a0,a1 给定则只画弧(不填充) */
  ell(cx: number, cy: number, rx: number, ry: number, o: ShapeOpt & { a0?: number; a1?: number } = {}): void {
    const g = this.g;
    const j = o.j ?? this.j;
    const arc = o.a0 !== undefined && o.a1 !== undefined;
    const n = Math.max(12, Math.round((rx + ry) * 1.7));
    const a0 = arc ? o.a0! : this.r() * TAU;
    const span = arc ? o.a1! - o.a0! : TAU;
    const pts: Pt[] = [];
    const steps = arc ? n : n + Math.max(1, Math.round(n * 0.06));
    for (let i = 0; i <= steps; i++) {
      const k = i / n;
      const a = a0 + span * (arc ? i / steps : k);
      const rr = 1 + this.rnd(j / Math.max(2, (rx + ry) / 2));
      const drift = !arc && i > n ? 0.9 + (i - n) * 0.15 : 0;
      pts.push([cx + Math.cos(a) * rx * rr + drift, cy + Math.sin(a) * ry * rr + drift]);
    }
    if (!arc && o.fill) {
      const fp = pts.slice(0, n);
      this.trace(fp, true, true);
      g.fillStyle = o.fill;
      g.fill();
      if (o.shade) {
        g.save();
        g.clip();
        g.fillStyle = o.shade;
        g.fillRect(cx - rx - 1, cy + ry * 0.25, rx * 2 + 2, ry + 2);
        g.restore();
      }
    }
    if (!o.nostroke) {
      this.trace(pts, false, true);
      this.inkIt(o.lw ?? this.lw);
    }
  }

  /** 圆点(实心墨点) */
  dot(x: number, y: number, r: number, col: string = INK): void {
    const g = this.g;
    g.beginPath();
    g.arc(x + this.rnd(0.12), y + this.rnd(0.12), r, 0, TAU);
    g.fillStyle = col;
    g.fill();
  }

  /** 肢体:带描边的粗线(先墨色粗线再底色细线) */
  limb(x0: number, y0: number, x1: number, y1: number, w: number, col: string, lw = this.lw): void {
    const g = this.g;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.strokeStyle = INK;
    g.lineWidth = w + lw * 1.7;
    g.stroke();
    g.strokeStyle = col;
    g.lineWidth = w;
    g.stroke();
  }

  /** 斜线影线(阴影),在矩形内 */
  hatch(x: number, y: number, w: number, h: number, gap = 2.2, lw = 0.8, alpha = 0.55): void {
    const g = this.g;
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.globalAlpha *= alpha;
    for (let u = -h; u < w; u += gap) {
      this.line(x + u, y + h, x + u + h * 0.7, y, { lw, ext: 0, bow: 0 });
    }
    g.restore();
  }

  /** 椭圆地面影 */
  shadow(cx: number, cy: number, rx: number, ry: number, a = 0.18): void {
    const g = this.g;
    g.save();
    g.globalAlpha *= a;
    g.fillStyle = INK;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    g.fill();
    g.restore();
  }
}

export function roundRectPts(x: number, y: number, w: number, h: number, r: number): Pt[] {
  r = Math.min(r, w / 2, h / 2);
  const pts: Pt[] = [];
  const arc = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 3; i++) {
      const a = a0 + (Math.PI / 2) * (i / 3);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  arc(x + w - r, y + r, -Math.PI / 2);
  arc(x + w - r, y + h - r, 0);
  arc(x + r, y + h - r, Math.PI / 2);
  arc(x + r, y + r, Math.PI);
  return pts;
}

/** 四角星闪光(用在高光/金苹果) */
export function sparkle(g: C, x: number, y: number, r: number, col: string = '#fffdf6', rot = 0, ink = true): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 ? r * 0.3 : r;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = col;
  g.fill();
  if (ink) {
    g.lineWidth = Math.max(0.6, r * 0.14);
    g.strokeStyle = INK;
    g.lineJoin = 'round';
    g.stroke();
  }
  g.restore();
}
