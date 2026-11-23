/** 苹果流水线(各收入来源 → 传送带 → 经过各"景点" → 出货/上云)与随机事件(小鸟/快递小哥/流星)。屏幕坐标,对象池,无每帧分配。 */
import type { SourceId } from '../core/game.ts';
import { SOURCE_IDS } from '../core/game.ts';
import type { EventKind } from '../core/events.ts';
import { EVENT_STAY_S } from '../core/events.ts';
import { RED, TAU } from './draw.ts';
import { fmt } from './format.ts';

type C = CanvasRenderingContext2D;

export const SRC_COLOR: Record<SourceId, string> = {
  click: '#e0202a', breeze: '#4fb8d0', gardener: '#5fb35a', tractor: '#e8902a',
  shaker: '#8f7ad6', drone: '#2f95e0', express: '#d6527a', cloud: '#5b6b94',
};
export const SRC_NAME: Record<SourceId, string> = {
  click: '点击', breeze: '微风', gardener: '老徐', tractor: '拖拉机',
  shaker: '摇树机', drone: '无人机', express: '快递', cloud: '苹果云',
};
const SRC_IDX: Record<string, number> = {};
SOURCE_IDS.forEach((s, i) => (SRC_IDX[s] = i));

export interface Pt { x: number; y: number }
export interface Station { id: string; x: number }
export interface FlowGeo {
  w: number;
  h: number;
  /** 传送带中线 y */
  beltY: number;
  /** 出货口 x */
  depotX: number;
  /** 苹果云位置(没买则 null) */
  cloud: Pt | null;
  stations: Station[];
  /** 来源出发点(写入 out) */
  origin(id: SourceId, out: Pt): void;
}
export interface FlowFx {
  spark(x: number, y: number, color: string, n: number): void;
  float(x: number, y: number, text: string, color: string, size: number): void;
  station(id: string, x: number, val: number): void;
  cloudHit(x: number, y: number): void;
}

interface Token {
  on: boolean; src: number; tier: number; val: number; ph: number; t: number;
  x0: number; y0: number; x: number; y: number; px: number; seed: number;
}
const MAX_TOK = 72;
const TIER_AT = [20, 600, 2e4, 1e6];
export function tierOf(v: number): number {
  let t = 0;
  while (t < 4 && v >= TIER_AT[t]) t++;
  return t;
}

const WOOD = '#ecc67e';

export class Flow {
  readonly rates: Record<SourceId, number> = { click: 0, breeze: 0, gardener: 0, tractor: 0, shaker: 0, drone: 0, express: 0, cloud: 0 };
  hl: SourceId | null = null;
  hlT = 0;
  /** 本秒流水总和(调试/显示用) */
  shipped = 0;
  private tok: Token[] = [];
  private acc = new Float64Array(8);
  private show = new Float64Array(8);
  private tm = new Float64Array(8);
  private showT = new Float64Array(8);
  private o: Pt = { x: 0, y: 0 };
  private beltPhase = 0;
  private cnt = 0;

  constructor(private fx: FlowFx) {
    for (let i = 0; i < MAX_TOK; i++) this.tok.push({ on: false, src: 0, tier: 0, val: 0, ph: 0, t: 0, x0: 0, y0: 0, x: 0, y: 0, px: 0, seed: 0 });
    for (let i = 0; i < 8; i++) this.tm[i] = 0.2 + i * 0.13;
  }

  highlight(id: SourceId | null): void {
    this.hl = id;
    this.hlT = id ? 4 : 0;
  }

  /** speed:收获期加速 */
  update(dt: number, g: FlowGeo, speed: number, reduced: boolean): void {
    this.beltPhase = (this.beltPhase + dt * 40 * speed) % 16;
    if (this.hlT > 0) {
      this.hlT -= dt;
      if (this.hlT <= 0) this.hl = null;
    }
    for (let i = 0; i < 8; i++) {
      const id = SOURCE_IDS[i] as SourceId;
      const ps = this.rates[id];
      if (!(ps > 0)) { this.acc[i] = 0; continue; }
      this.acc[i] += ps * dt;
      this.show[i] += ps * dt;
      this.tm[i] -= dt;
      if (this.tm[i] <= 0) {
        const r = Math.min(1.1, 0.3 + 0.2 * Math.log10(1 + ps)) * speed;
        this.tm[i] = 1 / r + Math.random() * 0.08;
        const v = this.acc[i];
        this.acc[i] = 0;
        if (v > 0) this.spawn(i, v, g);
      }
      this.showT[i] -= dt;
      if (this.showT[i] <= 0 && this.show[i] >= 1) {
        this.showT[i] = 2.4 + i * 0.3;
        g.origin(id, this.o);
        this.fx.float(this.o.x, this.o.y - 12, '+' + fmt(this.show[i]), SRC_COLOR[id], 12);
        this.shipped += this.show[i];
        this.show[i] = 0;
      }
    }
    const groundV = reduced ? 1 : 1;
    for (const k of this.tok) {
      if (!k.on) continue;
      k.t += dt;
      k.px = k.x;
      if (k.ph === 0) {
        // 掉落到传送带
        const u = Math.min(1, k.t / 0.5);
        k.x = k.x0 + (k.seed * 14 - 7) * u;
        k.y = k.y0 + (g.beltY - 6 - k.y0) * u * u;
        if (u >= 1) { k.ph = 1; k.t = 0; }
      } else if (k.ph === 1) {
        k.x += (70 + k.tier * 4) * speed * dt * groundV;
        k.y = g.beltY - 5 - k.tier * 1.2;
        for (const s of g.stations) {
          if (k.px < s.x && k.x >= s.x) this.fx.station(s.id, s.x, k.val);
        }
        if (k.x >= g.depotX) {
          k.ph = 2;
          k.t = 0;
          k.x0 = k.x;
          k.y0 = k.y;
          if (!g.cloud) { this.fx.spark(k.x, k.y, '#f2b705', 2); k.on = false; }
        }
      } else {
        // 上云:二次曲线飘向苹果云
        const c = g.cloud;
        if (!c) { k.on = false; continue; }
        const u = Math.min(1, k.t / 1.1);
        const mx = (k.x0 + c.x) / 2 + 26;
        const my = Math.min(k.y0, c.y) - 40;
        const a = (1 - u) * (1 - u);
        const b = 2 * (1 - u) * u;
        const d = u * u;
        k.x = a * k.x0 + b * mx + d * c.x;
        k.y = a * k.y0 + b * my + d * c.y;
        if (u >= 1) { k.on = false; this.fx.cloudHit(c.x, c.y); }
      }
    }
  }

  private spawn(i: number, v: number, g: FlowGeo): void {
    let k: Token | null = null;
    let same = 0;
    for (const t of this.tok) {
      if (!t.on) { if (!k) k = t; } else if (t.src === i) same++;
    }
    if (!k || same >= 4) return;
    g.origin(SOURCE_IDS[i] as SourceId, this.o);
    k.on = true;
    k.src = i;
    k.val = v;
    k.tier = tierOf(v);
    k.ph = 0;
    k.t = 0;
    k.x0 = this.o.x;
    k.y0 = this.o.y;
    k.x = k.x0;
    k.y = k.y0;
    k.px = k.x;
    k.seed = this.cnt++ % 7 / 7;
  }

  /** 传送带(路面) */
  drawBelt(c: C, g: FlowGeo, night: number, speed: number): void {
    const y = g.beltY;
    c.fillStyle = night > 0.4 ? '#9aa3bd' : '#d9dce3';
    c.fillRect(-4, y - 3, g.w + 8, 13);
    c.strokeStyle = '#111';
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(-4, y - 3);
    c.lineTo(g.w + 4, y - 3);
    c.moveTo(-4, y + 10);
    c.lineTo(g.w + 4, y + 10);
    c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.35)';
    c.lineWidth = 2;
    c.setLineDash([7, 9]);
    c.lineDashOffset = -this.beltPhase * speed;
    c.beginPath();
    c.moveTo(-4, y + 3.5);
    c.lineTo(g.w + 4, y + 3.5);
    c.stroke();
    c.setLineDash([]);
    // 出货口:小仓库
    const x = g.depotX + 4;
    c.fillStyle = '#fff';
    c.strokeStyle = '#111';
    c.lineWidth = 1.8;
    c.beginPath();
    c.rect(x, y - 16, 20, 19);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(x - 3, y - 16);
    c.lineTo(x + 10, y - 25);
    c.lineTo(x + 23, y - 16);
    c.closePath();
    c.fillStyle = RED;
    c.fill();
    c.stroke();
    c.fillStyle = '#ffe9a0';
    c.fillRect(x + 6, y - 9, 8, 12);
    c.strokeRect(x + 6, y - 9, 8, 12);
  }

  draw(c: C, g: FlowGeo, time: number): void {
    for (const k of this.tok) {
      if (!k.on) continue;
      const hl = this.hl !== null && SRC_IDX[this.hl] === k.src;
      const sc = k.ph === 2 ? 1 - Math.min(1, k.t / 1.1) * 0.55 : 1;
      c.save();
      c.translate(k.x, k.y);
      const ts = k.tier >= 3 ? 0.72 : k.tier === 2 ? 0.85 : 1;
      c.scale(sc * ts, sc * ts);
      if (hl) {
        c.strokeStyle = SRC_COLOR[SOURCE_IDS[k.src] as SourceId];
        c.lineWidth = 3;
        c.beginPath();
        c.arc(0, 0, 10 + Math.sin(time * 9) * 1.5, 0, TAU);
        c.stroke();
      }
      drawItem(c, k.tier, SRC_COLOR[SOURCE_IDS[k.src] as SourceId]);
      c.restore();
    }
  }
}

function drawItem(c: C, tier: number, col: string): void {
  c.strokeStyle = '#111';
  c.lineWidth = 1.5;
  if (tier <= 1) {
    const r = tier === 0 ? 3.8 : 6;
    c.fillStyle = RED;
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.fill();
    c.stroke();
    if (tier === 1) {
      c.beginPath();
      c.moveTo(0, -r);
      c.lineTo(1.5, -r - 3.5);
      c.stroke();
      c.fillStyle = '#fff';
      c.fillRect(-r * 0.5, -r * 0.4, 1.8, 1.8);
    }
    return;
  }
  if (tier === 2) {
    c.fillStyle = WOOD;
    c.beginPath();
    c.rect(-8, -5.5, 16, 11);
    c.fill();
    c.stroke();
    c.fillStyle = RED;
    c.beginPath();
    c.arc(-3.2, -6, 3, 0, TAU);
    c.arc(3.2, -6, 3, 0, TAU);
    c.fill();
    c.beginPath();
    c.moveTo(-8, 0);
    c.lineTo(8, 0);
    c.stroke();
    return;
  }
  if (tier === 3) {
    for (let r = 0; r < 2; r++) {
      for (let q = 0; q < 2; q++) {
        c.fillStyle = WOOD;
        c.beginPath();
        c.rect(-12 + q * 12, -15 + r * 9, 12, 9);
        c.fill();
        c.stroke();
      }
    }
    c.fillStyle = '#b98a4e';
    c.fillRect(-13, 3, 26, 3.5);
    c.strokeRect(-13, 3, 26, 3.5);
    return;
  }
  c.fillStyle = col;
  c.beginPath();
  c.rect(-17, -10, 34, 18);
  c.fill();
  c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.55)';
  c.lineWidth = 1.2;
  c.beginPath();
  for (let x = -12; x <= 12; x += 6) {
    c.moveTo(x, -10);
    c.lineTo(x, 8);
  }
  c.stroke();
  c.fillStyle = RED;
  c.beginPath();
  c.arc(0, -3, 4.2, 0, TAU);
  c.fill();
  c.strokeStyle = '#111';
  c.lineWidth = 1.3;
  c.stroke();
}

/* ===================== 随机事件 ===================== */
export interface EventGeo {
  w: number;
  h: number;
  beltY: number;
  /** 天空区高度(地平线 y) */
  sky: number;
  /** 小鸟落脚点(树冠) */
  perch: Pt;
}

export class EventFx {
  kind: EventKind | null = null;
  private cb: ((hit: boolean) => void) | null = null;
  private t = 0;
  private stay = 0;
  /** 0 进场/停留,1 被点中离场,2 超时离场 */
  private mode = 0;
  private lt = 0;
  x = 0;
  y = 0;
  hitR = 30;

  get active(): boolean { return this.kind !== null; }

  constructor(private fx: FlowFx) {}

  spawn(kind: EventKind, cb: (hit: boolean) => void, g: EventGeo): void {
    if (this.kind) return;
    this.kind = kind;
    this.cb = cb;
    this.t = 0;
    this.lt = 0;
    this.mode = 0;
    this.stay = EVENT_STAY_S[kind];
    this.place(g);
    const txt = kind === 'bird' ? '小鸟来偷苹果!' : kind === 'courier' ? '快递小哥路过' : '流星!许个愿?';
    this.fx.float(Math.min(g.w - 50, Math.max(50, this.x)), Math.max(30, this.y - 36), txt, '#555', 13);
  }

  private place(g: EventGeo): void {
    const t = this.t;
    const k = this.kind;
    if (k === 'bird') {
      const fly = Math.min(1, t / 0.9);
      this.x = g.perch.x + (1 - fly) * 90;
      this.y = g.perch.y - (1 - fly) * 70 + (fly >= 1 ? Math.sin(t * 3) * 1.2 : -Math.sin(fly * Math.PI) * 12);
    } else if (k === 'courier') {
      const u = this.mode === 2 || this.mode === 0 ? t / this.stay : t / this.stay;
      this.x = -24 + u * (g.w + 48);
      this.y = g.beltY - 18;
    } else if (k === 'star') {
      const u = t / this.stay;
      this.x = g.w * (0.08 + 0.84 * u);
      this.y = g.sky * 0.1 + 14 + u * g.sky * 0.55 + Math.sin(u * 9) * 5;
    }
    this.hitR = Math.max(30, 24);
  }

  /** 点击检测:命中返回 true(调用方应吞掉这次点击) */
  tap(px: number, py: number): boolean {
    if (!this.kind || this.mode !== 0 || this.t < 0.5) return false;
    const dx = px - this.x;
    const dy = py - this.y;
    const r = this.hitR + (this.kind === 'star' ? 8 : 4);
    if (dx * dx + dy * dy > r * r) return false;
    this.mode = 1;
    this.lt = 0;
    const cb = this.cb;
    this.cb = null;
    if (this.kind === 'bird') {
      this.fx.spark(this.x, this.y, '#f2b705', 8);
      this.fx.float(this.x, this.y - 18, '嘘!走开!', '#555', 14);
    } else if (this.kind === 'courier') {
      this.fx.spark(this.x, this.y - 10, '#f2b705', 12);
      this.fx.float(this.x, this.y - 26, '签收!', '#555', 14);
    } else {
      this.fx.spark(this.x, this.y, '#fff7b0', 16);
      this.fx.float(this.x, this.y - 22, '许愿成功 ✦', '#c8920a', 15);
    }
    if (cb) cb(true);
    return true;
  }

  update(dt: number, g: EventGeo, reduced: boolean): void {
    if (!this.kind) return;
    this.t += dt;
    if (this.mode === 0) {
      this.place(g);
      if (this.t >= this.stay) {
        this.mode = 2;
        this.lt = 0;
        const cb = this.cb;
        this.cb = null;
        if (cb) cb(false);
      }
    } else {
      this.lt += dt;
      if (this.kind === 'bird') {
        this.x += (this.mode === 1 ? 180 : 110) * dt;
        this.y -= (this.mode === 1 ? 150 : 70) * dt;
      } else if (this.kind === 'courier') {
        this.t += dt * 0; // 继续往前走
        this.x += 38 * dt * (this.mode === 1 ? 2 : 1);
      } else {
        this.x += 120 * dt;
        this.y += 60 * dt;
      }
      if (this.lt > (reduced ? 0.3 : 1.6) || this.x > g.w + 60 || this.y < -40) this.end();
    }
  }

  private end(): void {
    this.kind = null;
    this.cb = null;
  }

  draw(c: C, time: number, g: EventGeo): void {
    const k = this.kind;
    if (!k) return;
    const x = this.x;
    const y = this.y;
    const out = this.mode !== 0;
    const alpha = out ? Math.max(0, 1 - this.lt / 1.6) : Math.min(1, this.t / 0.5);
    c.save();
    c.globalAlpha = alpha;
    // 提示:安静的呼吸圈 + 弹跳小三角
    if (!out) {
      const p = (time * 1.1) % 1;
      c.strokeStyle = `rgba(224,32,42,${0.5 * (1 - p)})`;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x, y, 14 + p * 20, 0, TAU);
      c.stroke();
      c.fillStyle = 'rgba(224,32,42,.8)';
      const by = y - 30 - Math.abs(Math.sin(time * 4)) * 5;
      c.beginPath();
      c.moveTo(x - 5, by - 5);
      c.lineTo(x + 5, by - 5);
      c.lineTo(x, by + 1);
      c.closePath();
      c.fill();
    }
    c.strokeStyle = '#111';
    c.lineWidth = 2;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    if (k === 'bird') this.drawBird(c, x, y, time, out);
    else if (k === 'courier') this.drawCourier(c, x, y, time);
    else this.drawStar(c, x, y, time);
    c.restore();
  }

  private drawBird(c: C, x: number, y: number, time: number, out: boolean): void {
    const flap = this.t < 0.9 || out ? Math.sin(time * 28) : 0;
    c.fillStyle = '#fff';
    c.beginPath();
    c.ellipse(x, y, 13, 9, 0, 0, TAU);
    c.fill();
    c.stroke();
    // 翅膀
    c.beginPath();
    c.moveTo(x - 4, y - 2);
    c.quadraticCurveTo(x - 9, y - 12 - flap * 6, x + 3, y - 4);
    c.stroke();
    // 头
    c.beginPath();
    c.arc(x + 11, y - 6, 6, 0, TAU);
    c.fillStyle = '#fff';
    c.fill();
    c.stroke();
    c.fillStyle = '#111';
    c.fillRect(x + 12, y - 8, 2, 2);
    c.fillStyle = '#f2a516';
    c.beginPath();
    c.moveTo(x + 16, y - 7);
    c.lineTo(x + 22, y - 5);
    c.lineTo(x + 16, y - 4);
    c.closePath();
    c.fill();
    c.stroke();
    // 尾巴
    c.beginPath();
    c.moveTo(x - 12, y);
    c.lineTo(x - 22, y - 4 + flap);
    c.lineTo(x - 21, y + 3);
    c.stroke();
    // 偷到的苹果
    if (this.mode === 2 || (this.mode === 0 && this.t > 1.5)) {
      c.fillStyle = RED;
      c.beginPath();
      c.arc(x + 20, y + 4, 4.5, 0, TAU);
      c.fill();
      c.stroke();
    }
  }

  private drawCourier(c: C, x: number, y: number, time: number): void {
    const step = Math.sin(time * 10);
    // 小车
    c.fillStyle = '#fff';
    c.beginPath();
    c.rect(x - 4, y - 8, 24, 14);
    c.fill();
    c.stroke();
    c.fillStyle = '#f2b705';
    c.fillRect(x + 1, y - 17, 14, 10);
    c.strokeRect(x + 1, y - 17, 14, 10);
    c.beginPath();
    c.moveTo(x + 8, y - 17);
    c.lineTo(x + 8, y - 7);
    c.stroke();
    c.fillStyle = '#fff';
    for (const wx of [x + 2, x + 16]) {
      c.beginPath();
      c.arc(wx, y + 8, 3.4, 0, TAU);
      c.fill();
      c.stroke();
    }
    // 小哥:背对着推车
    const bx = x - 14;
    c.beginPath();
    c.moveTo(bx, y - 4);
    c.lineTo(bx - 3 + step * 2, y + 10);
    c.moveTo(bx, y - 4);
    c.lineTo(bx + 3 - step * 2, y + 10);
    c.stroke();
    c.fillStyle = '#e0202a';
    c.beginPath();
    c.rect(bx - 5, y - 17, 10, 14);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(bx + 5, y - 13);
    c.lineTo(x - 4, y - 5);
    c.stroke();
    c.fillStyle = '#ffe3c8';
    c.beginPath();
    c.arc(bx, y - 23, 5.5, 0, TAU);
    c.fill();
    c.stroke();
    c.fillStyle = '#e0202a';
    c.beginPath();
    c.arc(bx, y - 24, 5.5, Math.PI, 0);
    c.fill();
    c.stroke();
    c.fillRect(bx, y - 25, 9, 2.4);
  }

  private drawStar(c: C, x: number, y: number, time: number): void {
    // 拖尾
    const g = c.createLinearGradient(x, y, x - 70, y - 38);
    g.addColorStop(0, 'rgba(255,240,150,.9)');
    g.addColorStop(1, 'rgba(255,240,150,0)');
    c.strokeStyle = g;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - 70, y - 38);
    c.stroke();
    c.strokeStyle = '#111';
    c.lineWidth = 1.8;
    const s = 11 + Math.sin(time * 8) * 1.5;
    c.fillStyle = '#ffe36a';
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? s * 0.45 : s;
      const a = -Math.PI / 2 + (i / 10) * TAU;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i) c.lineTo(px, py);
      else c.moveTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();
  }
}
