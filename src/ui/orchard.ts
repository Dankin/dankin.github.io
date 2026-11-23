/** v4 场景引擎:左 生产 → 中 路线(3 个关卡) → 右 码头。一块画布,一条连续的线。 */
import { APPLE, GOLDC, P, TAU, apple, circ, clamp, ease, lerp, pen, poly, rect, rs, seg, setTheme, setUnit, sparkle, sv, text } from './pen.ts';
import { EMIT, PILE_MAX, SRC_NAMES, drawPile, drawSource, drawShakeMeter } from './sources.ts';
import { LANE_OF, RT_NAMES, TRIP_SEC, drawBead, drawCrates, drawDock, drawGate, drawPortalRing, drawVehicle, gateBadge } from './route.ts';
import { fmt } from './format.ts';

type C = CanvasRenderingContext2D;

export type EventKind = 'bird' | 'newton' | 'meteor';
export type Hit = 'event' | 'gate' | 'source' | 'dock' | 'none';

/** 核心状态 → 画面的薄映射。所有字段都可选地按默认值处理,由 main.ts 在状态变化时调用 setWorld。 */
export interface WorldView {
  /** 生产线档位 0..5 与各档数量 / 分支(0|1|-1) */
  srcTier: number;
  srcUnits: number[];
  srcBranch: number[];
  /** 运输线档位 0..5、车辆数、分支 */
  rtTier: number;
  rtVehicles: number;
  rtBranch: number;
  /** 3 个关卡槽:关卡 id 或 null;gatesUnlocked 已解锁的槽数 0..3 */
  gates: Array<string | null>;
  gatesUnlocked: number;
  /** 库存占上限比 0..1 */
  stock01: number;
  /** 每秒产出 / 每秒运力(任意同单位,只用比值与对数) */
  produce: number;
  carry: number;
  /** 摇劲 0..1 与连击数 */
  shake: number; // 摇劲 0..1
  combo: number;
  /** 每趟运送苹果数(显示 +N 用,可选) */
  perTrip?: number;
}

export const EMPTY_WORLD: WorldView = {
  srcTier: 0,
  srcUnits: [1, 0, 0, 0, 0, 0],
  srcBranch: [-1, -1, -1, -1, -1, -1],
  rtTier: 0,
  rtVehicles: 1,
  rtBranch: -1,
  gates: [null, null, null],
  gatesUnlocked: 0,
  stock01: 0,
  produce: 1,
  carry: 1,
  shake: 0,
  combo: 0,
};

const GATE_NAME: Record<string, string> = { wash: '洗果', wax: '打蜡', juice: '榨汁', pack: '包装', cold: '冷链', rush: '加急', string: '红绳' };
/** 同屏最多画几辆(其余以 ×N 表示) */
const VIS_MAX = [5, 5, 5, 3, 3, 10];
const MAX_PARTS = 56;
const MAX_FLY = 14;

interface Veh {
  /** 阶段进度 0..1;0..0.46 去程(满) / 0.46..0.5 卸货 / 0.5..0.96 返程(空) / 等待装货 */
  p: number;
  state: 0 | 1 | 2 | 3; // 0 等待装货 1 去程 2 卸货 3 返程
  full: boolean;
  ph: number;
}
interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  kind: 0 | 1 | 2; // 0 小点 1 星 2 环
  gold: boolean;
}
interface Fly {
  on: boolean;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  arc: number;
  kind: 0 | 1; // 0 入堆 1 飞向码头
}
interface Float {
  on: boolean;
  s: string;
  x: number;
  y: number;
  t: number;
  col: string;
}
interface Ev {
  kind: EventKind;
  t: number;
  dur: number;
  x: number;
  y: number;
  cb: (hit: boolean) => void;
  caught: number;
}

interface Lay {
  s: number;
  ox: number;
  oy: number;
  portrait: boolean;
  meterX: number;
  srcX: number;
  ss: number;
  srcY: number;
  pileX: number;
  pileY: number;
  /** 路线折线 */
  pts: number[];
  len: number[];
  total: number;
  dockX: number;
  dockY: number;
  gateU: number[];
}

export class Orchard {
  /** 回调:main.ts 赋值 */
  /** 点树/生产区(或空格)摇一摇;strength 恒为 1(预留给手机摇晃) */
  onShake: (strength?: number) => void = () => {};
  onGate: (slot: number) => void = () => {};
  reducedMotion = false;

  private cv: HTMLCanvasElement;
  private c: C;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private lay!: Lay;
  private wv: WorldView = { ...EMPTY_WORLD };
  private dark_ = false;
  private t = 0;
  private lastInput = -99;
  private acc = 0;
  private last = 0;
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';
  private firstWorld = true;

  /* 动画状态 */
  private vehs: Veh[] = [];
  private tokens = 0;
  private pileV = 0;
  private sway = 0;
  private fwV = 0;
  private hint = 1;
  private spawnT = 0;
  private flingT = 0;
  private srcPop = 0;
  private rtPop = 0;
  private dockPop = 0;
  private gatePop = [0, 0, 0];
  private gateFlash = [0, 0, 0];
  private crates = 0;
  private emitFlash = 0;

  private parts: Part[] = [];
  private pi = 0;
  private flys: Fly[] = [];
  private floats: Float[] = [];
  private ev: Ev | null = null;
  private clouds = [0.1, 0.45, 0.8];

  /* 手势 */
  private pid = -1;
  private downT = 0;
  private downX = 0;
  private downY = 0;
  private moved = 0;
  private tapKind = 0; // 0 无 1 事件 2 关卡圈
  private tapGate = -1;
  private everShook = false;
  private nudgeT = 1.2;
  private insL = 0;
  private insR = 0;
  private probe: HTMLElement | null = null;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    this.c = cv.getContext('2d', { alpha: false }) as C;
    for (let i = 0; i < MAX_PARTS; i++) this.parts.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, kind: 0, gold: false });
    for (let i = 0; i < MAX_FLY; i++) this.flys.push({ on: false, x0: 0, y0: 0, x1: 0, y1: 0, t: 0, dur: 1, arc: 10, kind: 0 });
    for (let i = 0; i < 4; i++) this.floats.push({ on: false, s: '', x: 0, y: 0, t: 0, col: P.ink });
    cv.style.touchAction = 'none';
    try {
      this.everShook = localStorage.getItem('sta.shook') === '1';
    } catch {
      /* ignore */
    }
    if (typeof document !== 'undefined') {
      const p = document.createElement('div');
      p.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)';
      document.body.appendChild(p);
      this.probe = p;
    }
    addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      const tg = e.target as HTMLElement | null;
      if (tg && /^(BUTTON|INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) return;
      e.preventDefault();
      this.shakeTap();
    });
    cv.addEventListener('pointerdown', (e) => this.down(e));
    cv.addEventListener('pointermove', (e) => this.move(e));
    cv.addEventListener('pointerup', (e) => this.up(e));
    cv.addEventListener('pointercancel', (e) => this.up(e, true));
    this.resize();
  }

  /* ================= 公开 API ================= */
  get dark(): boolean {
    return this.dark_;
  }
  set dark(v: boolean) {
    if (v === this.dark_) return;
    this.dark_ = v;
    setTheme(v);
    this.bgKey = '';
  }
  eventActive(): boolean {
    return this.ev !== null;
  }

  resize(): void {
    const r = this.cv.getBoundingClientRect();
    this.w = Math.max(80, r.width);
    this.h = Math.max(60, r.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.probe) {
      const cs = getComputedStyle(this.probe);
      this.insL = parseFloat(cs.paddingLeft) || 0;
      this.insR = parseFloat(cs.paddingRight) || 0;
    }
    this.cv.width = Math.round(this.w * this.dpr);
    this.cv.height = Math.round(this.h * this.dpr);
    this.layout();
    this.bgKey = '';
    this.lastInput = this.t;
  }

  setWorld(wv: WorldView): void {
    const o = this.wv;
    const first = this.firstWorld;
    this.firstWorld = false;
    if (!first) {
      if (wv.srcTier !== o.srcTier) {
        this.srcPop = 1;
        this.ring(this.lay.srcX, this.lay.srcY - 22, true);
        this.say('升级!', this.lay.srcX, this.lay.srcY - 44, P.ink);
      } else if (wv.srcUnits.some((n, i) => n > (o.srcUnits[i] ?? 0))) {
        this.srcPop = 0.7;
        this.ring(this.lay.srcX, this.lay.srcY - 20, false);
      }
      if (wv.rtTier !== o.rtTier) {
        this.rtPop = 1;
        this.dockPop = 1;
        this.ring(this.lay.dockX, this.lay.dockY - 12, true);
        this.say('升级!', this.lay.dockX, this.lay.dockY - 30, P.ink);
      } else if (wv.rtVehicles > o.rtVehicles) {
        this.rtPop = 0.7;
        const q = this.at(0.02);
        this.ring(q.x, q.y - 4, false);
      }
      for (let i = 0; i < 3; i++) {
        if (wv.gates[i] !== o.gates[i]) {
          this.gatePop[i] = 1;
          const q = this.at(this.lay.gateU[i]);
          this.ring(q.x, q.y - 14, wv.gates[i] !== null);
        }
      }
    }
    this.wv = { ...EMPTY_WORLD, ...wv, srcUnits: wv.srcUnits ?? EMPTY_WORLD.srcUnits, srcBranch: wv.srcBranch ?? EMPTY_WORLD.srcBranch };
    this.syncVehs();
    this.lastInput = this.t;
  }

  /** 外部"摇一摇":树/生产线抖动并弹出几个苹果 */
  poke(n = 2): void {
    this.sway = Math.min(1, this.sway + 0.7);
    this.emitFlash = 1;
    const e = this.emit();
    for (let i = 0; i < n; i++) this.spawnFly(e.x + (Math.random() - 0.5) * 6, e.y, this.lay.pileX + (Math.random() - 0.5) * 6, this.lay.pileY - 6, 0.55, 8, 0);
    for (let i = 0; i < 3; i++) this.part(e.x, e.y, (Math.random() - 0.5) * 18, -10 - Math.random() * 10, 0.5, 1.2, 0);
    this.lastInput = this.t;
  }

  /** 连击飞果:从生产线弹出 n 个苹果越过路线飞向码头 */
  burst(n = 3): void {
    const e = this.emit();
    for (let i = 0; i < n; i++) this.spawnFly(e.x, e.y, this.lay.dockX + (Math.random() - 0.5) * 10, this.lay.dockY - 8, 1 + Math.random() * 0.4, 26 + Math.random() * 14, 1);
    this.lastInput = this.t;
  }

  floatText(s: string, wx?: number, wy?: number): void {
    this.say(s, wx ?? this.lay.srcX, wy ?? this.lay.srcY - 40, P.ink);
  }

  spawnEvent(kind: EventKind, cb: (hit: boolean) => void): void {
    if (this.ev) return;
    const L = this.lay;
    const dur = kind === 'meteor' ? 5 : kind === 'bird' ? 9 : 12;
    this.ev = { kind, t: 0, dur, x: 0, y: 0, cb, caught: 0 };
    void L;
    this.lastInput = this.t;
  }

  /** 屏幕坐标 → 是否命中某物(供 main.ts 预判,可选) */
  hitTest(px: number, py: number): Hit {
    const [x, y] = this.toWorld(px, py);
    if (this.ev && this.evHit(x, y)) return 'event';
    const L = this.lay;
    if (this.gateAt(x, y) >= 0) return 'gate';
    if (Math.abs(x - L.srcX) < 32 * L.ss && y < L.srcY + 4 && y > L.srcY - 52 * L.ss) return 'source';
    if (Math.abs(x - L.dockX) < 22 && y < L.dockY + 4 && y > L.dockY - 30) return 'dock';
    return 'none';
  }

  /** 命中哪个关卡圈(世界坐标)。圈 ≥44px:半径取 max(徽章半径, 23/s)+余量 */
  private gateAt(x: number, y: number): number {
    const L = this.lay;
    const { r, by } = gateBadge(23 / L.s);
    for (let i = 0; i < 3; i++) {
      const q = this.at(L.gateU[i]);
      if (Math.abs(x - q.x) < r + 2 && y > q.y + by - r - 2 && y < q.y + 4) return i;
    }
    return -1;
  }

  /** 世界坐标(用于 float 位置) */
  worldPos(): { src: [number, number]; dock: [number, number]; gates: Array<[number, number]> } {
    const L = this.lay;
    return { src: [L.srcX, L.srcY], dock: [L.dockX, L.dockY], gates: L.gateU.map((u) => { const q = this.at(u); return [q.x, q.y] as [number, number]; }) };
  }
  /** 门槛槽的屏幕坐标(CSS px),供 DOM 抽屉定位 */
  gateScreen(slot: number): { x: number; y: number } {
    const q = this.at(this.lay.gateU[slot]);
    return { x: q.x * this.lay.s + this.lay.ox, y: (q.y - 12) * this.lay.s + this.lay.oy };
  }

  frame(dtRaw: number): void {
    if (document.hidden) return;
    const idle = this.t - this.lastInput;
    const iv = idle < 2 ? 1 / 58 : 1 / 30;
    this.acc += dtRaw;
    if (this.acc < iv - 0.002) return;
    const dt = Math.min(0.1, this.acc);
    this.acc = 0;
    this.t += dt;
    this.update(dt);
    this.draw();
  }

  /* ================= 布局 ================= */
  private layout(): void {
    const w = this.w;
    const h = this.h;
    const portrait = w / h < 1.05;
    let s: number;
    let Wu: number;
    let Hu: number;
    const L = { portrait } as Lay;
    const mg = 6; // 画布内最小边距
    const aw = Math.max(80, w - this.insL - this.insR - mg * 2);
    if (!portrait) {
      Wu = 232;
      Hu = 70;
      s = Math.min(aw / Wu, (h - 4) / Hu);
      L.meterX = 11;
      L.srcX = 58;
      L.pileX = 101;
      L.srcY = L.pileY = L.dockY = Hu - 8;
      L.dockX = 211;
      L.ss = 1.22;
      L.pts = [113, L.srcY, 189, L.srcY];
      L.gateU = [0.25, 0.5, 0.75];
    } else {
      Wu = 126;
      Hu = 138;
      s = Math.min(aw / Wu, (h - 4) / Hu);
      const ga = 58;
      const gb = 128;
      L.meterX = 10;
      L.srcX = 44;
      L.pileX = 83;
      L.ss = 1;
      L.srcY = L.pileY = ga;
      L.dockX = 28;
      L.dockY = gb;
      L.pts = [94, ga, 110, ga, 117, ga + 6, 117, gb - 6, 110, gb, 50, gb];
      L.gateU = [0.58, 0.72, 0.86];
    }
    L.s = s;
    L.ox = this.insL + mg + (aw - Wu * s) / 2;
    L.oy = (h - Hu * s) / 2;
    L.len = [];
    let tot = 0;
    for (let i = 2; i < L.pts.length; i += 2) {
      const d = Math.hypot(L.pts[i] - L.pts[i - 2], L.pts[i + 1] - L.pts[i - 1]);
      L.len.push(d);
      tot += d;
    }
    L.total = tot;
    this.lay = L;
  }

  /** 路线上 u∈[0,1] 处的位置与方向 */
  private at(u: number): { x: number; y: number; dir: number } {
    const L = this.lay;
    let d = clamp(u, 0, 1) * L.total;
    for (let i = 0; i < L.len.length; i++) {
      if (d <= L.len[i] || i === L.len.length - 1) {
        const f = L.len[i] > 0 ? d / L.len[i] : 0;
        const x0 = L.pts[i * 2];
        const y0 = L.pts[i * 2 + 1];
        const x1 = L.pts[i * 2 + 2];
        const y1 = L.pts[i * 2 + 3];
        const dx = x1 - x0;
        return { x: lerp(x0, x1, f), y: lerp(y0, y1, f), dir: Math.abs(dx) < 0.01 ? (this.lay.portrait ? -1 : 1) : dx > 0 ? 1 : -1 };
      }
      d -= L.len[i];
    }
    return { x: L.pts[0], y: L.pts[1], dir: 1 };
  }
  private emit(): { x: number; y: number } {
    const e = EMIT[this.wv.srcTier] ?? EMIT[0];
    return { x: this.lay.srcX + e[0] * this.lay.ss, y: this.lay.srcY + e[1] * this.lay.ss };
  }
  private toWorld(px: number, py: number): [number, number] {
    return [(px - this.lay.ox) / this.lay.s, (py - this.lay.oy) / this.lay.s];
  }

  /* ================= 手势 ================= */
  private pos(e: PointerEvent): [number, number] {
    const r = this.cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  private down(e: PointerEvent): void {
    const [x, y] = this.pos(e);
    this.lastInput = this.t;
    const [wx, wy] = this.toWorld(x, y);
    const evh = !!this.ev && this.evHit(wx, wy);
    const g = evh ? -1 : this.gateAt(wx, wy);
    if (evh || g >= 0) {
      // 事件/关卡圈:抬起时才生效(只跟踪一根手指)
      if (this.pid !== -1) return;
      this.pid = e.pointerId;
      this.tapKind = evh ? 1 : 2;
      this.tapGate = g;
      try {
        this.cv.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this.moved = 0;
      this.downT = performance.now();
      this.downX = x;
      this.downY = y;
      return;
    }
    // 其余位置:按下即摇,多指可连摇
    this.shakeTap();
  }
  private move(e: PointerEvent): void {
    if (e.pointerId !== this.pid) return;
    const [x, y] = this.pos(e);
    this.moved = Math.max(this.moved, Math.hypot(x - this.downX, y - this.downY));
  }
  private up(e: PointerEvent, cancel = false): void {
    if (e.pointerId !== this.pid) return;
    this.pid = -1;
    const kind = this.tapKind;
    this.tapKind = 0;
    if (cancel) return;
    if (this.moved > 10 || performance.now() - this.downT > 500) return;
    const [x, y] = this.pos(e);
    const [wx, wy] = this.toWorld(x, y);
    this.lastInput = this.t;
    if (kind === 1 && this.ev && this.evHit(wx, wy)) this.catchEv(wx, wy);
    else if (kind === 2 && this.gateAt(wx, wy) === this.tapGate && this.tapGate >= 0) this.onGate(this.tapGate);
  }

  /** 摇一下:树轻晃 + 回调(苹果由 main 调 poke 弹出) */
  shakeTap(): void {
    this.sway = Math.min(1, this.sway + 0.45);
    this.lastInput = this.t;
    if (!this.everShook) {
      this.everShook = true;
      try {
        localStorage.setItem('sta.shook', '1');
      } catch {
        /* ignore */
      }
    }
    this.onShake(1);
  }

  /* ================= 事件 ================= */
  private evPos(ev: Ev): void {
    const L = this.lay;
    const f = ev.t / ev.dur;
    const gy = L.srcY;
    const top = Math.max(8, gy - 56);
    if (ev.kind === 'bird') {
      ev.x = lerp(-10, 236, f);
      ev.y = top + 6 + Math.sin(f * 9) * 3;
      if (L.portrait) ev.x = lerp(-8, 134, f);
    } else if (ev.kind === 'meteor') {
      const W = L.portrait ? 126 : 224;
      ev.x = lerp(W * 0.9, W * 0.15, f);
      ev.y = lerp(4, gy - 20, f);
    } else {
      const W = L.portrait ? 126 : 224;
      ev.x = lerp(W + 6, -10, f);
      ev.y = L.portrait ? L.dockY - 28 + 0 : gy + 1;
      if (L.portrait) ev.y = gy + 1;
    }
  }
  private evHit(x: number, y: number): boolean {
    const e = this.ev;
    if (!e || e.caught) return false;
    const s = this.lay.s;
    const r = Math.max(26 / s, 7);
    const cy = e.kind === 'newton' ? e.y - 5 : e.y;
    return Math.hypot(x - e.x, y - cy) < r;
  }
  private catchEv(x: number, y: number): void {
    const e = this.ev;
    if (!e) return;
    e.caught = 0.7;
    this.ring(e.x, e.y, true);
    for (let i = 0; i < 6; i++) this.part(e.x, e.y, (Math.random() - 0.5) * 40, -20 - Math.random() * 14, 0.7, 1.5, 1, true);
    void x;
    void y;
    e.cb(true);
  }

  /* ================= 更新 ================= */
  private syncVehs(): void {
    const want = Math.min(this.wv.rtVehicles, VIS_MAX[this.wv.rtTier] ?? 5);
    while (this.vehs.length < want) this.vehs.push({ p: 0, state: 0, full: false, ph: Math.random() * 6 });
    while (this.vehs.length > want) this.vehs.pop();
    // 初次把车辆摆开
    if (this.t < 0.01) this.vehs.forEach((v, i) => { v.state = 1; v.full = true; v.p = (i + 0.5) / this.vehs.length * 0.9; });
  }

  private update(dt: number): void {
    const wv = this.wv;
    const L = this.lay;
    const rm = this.reducedMotion;
    const tier = wv.rtTier;
    this.sway = Math.max(0, this.sway - dt * 1.6);
    this.srcPop = Math.max(0, this.srcPop - dt * 1.4);
    this.rtPop = Math.max(0, this.rtPop - dt * 1.4);
    this.dockPop = Math.max(0, this.dockPop - dt * 2.2);
    this.emitFlash = Math.max(0, this.emitFlash - dt * 3);
    for (let i = 0; i < 3; i++) {
      this.gatePop[i] = Math.max(0, this.gatePop[i] - dt * 1.4);
      this.gateFlash[i] = Math.max(0, this.gateFlash[i] - dt * 2.2);
    }
    this.fwV += (wv.shake - this.fwV) * Math.min(1, dt * 6);
    this.pileV += (wv.stock01 * PILE_MAX - this.pileV) * Math.min(1, dt * 4);
    if (!this.everShook && !this.reducedMotion) {
      this.nudgeT -= dt;
      if (this.nudgeT <= 0) {
        this.sway = Math.max(this.sway, 0.38);
        this.nudgeT = 1.6;
      }
    }
    if (this.t - this.lastInput > 6) this.hint = Math.min(1, this.hint + dt * 0.5);
    else this.hint = Math.max(0, this.hint - dt * 2);

    // 生产:苹果从出果点飞向苹果堆
    const full = wv.stock01 >= 0.985;
    const rate = clamp(0.45 + Math.log10(1 + Math.max(0, wv.produce)) * 0.9, 0.45, 4.5);
    this.spawnT += dt * rate;
    if (this.spawnT >= 1 && !full) {
      this.spawnT = 0;
      const e = this.emit();
      this.spawnFly(e.x, e.y, L.pileX + (Math.random() - 0.5) * 4, L.pileY - 14, 0.55, 7, 0);
    } else if (full) this.spawnT = 0;

    // 车辆
    const trip = (TRIP_SEC[tier] ?? 10) / Math.max(0.6, 0.6 + Math.log10(1 + wv.carry) * 0.12);
    const ratio = clamp(wv.produce / Math.max(1e-9, wv.carry), 0, 1);
    this.tokens = Math.min(this.vehs.length + 1, this.tokens + dt * (this.vehs.length / trip) * (wv.stock01 > 0.12 ? 1.2 : ratio));
    for (const v of this.vehs) {
      if (v.state === 0) {
        if (this.tokens >= 1 || (wv.stock01 > 0.18 && this.tokens > 0)) {
          this.tokens = Math.max(0, this.tokens - 1);
          v.state = 1;
          v.full = true;
          v.p = 0;
        } else if (wv.stock01 < 0.04 && this.tokens < 0.2 && Math.random() < dt * 0.12) {
          // 没货也会空车出发(体现瓶颈:空车跑)
          v.state = 1;
          v.full = false;
          v.p = 0;
        }
      } else if (v.state === 1) {
        v.p += dt / (trip * 0.46);
        // 经过关卡 → 闪光
        for (let i = 0; i < 3; i++) {
          const gu = L.gateU[i];
          if (wv.gates[i] && v.full && v.p * 0.46 > gu * 0.46 - dt / trip && v.p * 0.46 <= gu * 0.46 + dt / trip + 1e-4 && v.p >= gu * 0.9) this.gateFlash[i] = 1;
        }
        if (v.p >= 1) {
          v.state = 2;
          v.p = 0;
          this.dockPop = 1;
          if (v.full) {
            this.crates = Math.min(10, this.crates + 1);
            const n = wv.perTrip;
            const q = this.at(1);
            if (n) this.say('+' + fmt(n), q.x, q.y - 26, APPLE);
            else this.say('+' + 1, q.x, q.y - 26, APPLE);
            this.part(q.x, q.y - 10, (Math.random() - 0.5) * 20, -14, 0.5, 1, 1, false);
          }
        }
      } else if (v.state === 2) {
        v.p += dt / 0.5;
        if (v.p >= 1) {
          v.state = 3;
          v.p = 0;
          v.full = false;
        }
      } else {
        v.p += dt / (trip * 0.46);
        if (v.p >= 1) {
          v.state = 0;
          v.p = 0;
        }
      }
    }
    if (this.crates > 0 && Math.random() < dt * 0.15) this.crates = Math.max(0, this.crates - 1);

    // 飞行苹果
    for (const f of this.flys) {
      if (!f.on) continue;
      f.t += dt / f.dur;
      if (f.t >= 1) {
        f.on = false;
        if (f.kind === 1) {
          this.dockPop = Math.max(this.dockPop, 0.8);
          this.part(f.x1, f.y1, (Math.random() - 0.5) * 18, -12, 0.5, 1, 1, true);
        }
      }
    }
    // 粒子
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.kind !== 2) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 40 * dt;
      }
    }
    for (const f of this.floats) {
      if (!f.on) continue;
      f.t += dt;
      if (f.t > 1.3) f.on = false;
    }
    for (let i = 0; i < 3; i++) this.clouds[i] = (this.clouds[i] + dt * (0.004 + i * 0.0015)) % 1.2;

    // 事件
    const e = this.ev;
    if (e) {
      e.t += dt;
      this.evPos(e);
      if (e.caught > 0) {
        e.caught -= dt;
        if (e.caught <= 0) this.ev = null;
      } else if (e.t >= e.dur) {
        this.ev = null;
        e.cb(false);
      }
    }
  }

  private spawnFly(x0: number, y0: number, x1: number, y1: number, dur: number, arc: number, kind: 0 | 1): void {
    for (const f of this.flys) {
      if (f.on) continue;
      f.on = true;
      f.x0 = x0;
      f.y0 = y0;
      f.x1 = x1;
      f.y1 = y1;
      f.t = 0;
      f.dur = dur;
      f.arc = arc;
      f.kind = kind;
      return;
    }
  }
  private part(x: number, y: number, vx: number, vy: number, life: number, size: number, kind: 0 | 1 | 2, gold = false): void {
    const p = this.parts[this.pi];
    this.pi = (this.pi + 1) % MAX_PARTS;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = p.max = life;
    p.size = size;
    p.kind = kind;
    p.gold = gold;
  }
  private ring(x: number, y: number, big: boolean): void {
    this.part(x, y, 0, 0, big ? 0.9 : 0.6, big ? 20 : 11, 2, big);
    if (big) for (let i = 0; i < 6; i++) this.part(x, y, Math.cos((i / 6) * TAU) * 22, Math.sin((i / 6) * TAU) * 22 - 6, 0.7, 1.6, 1, true);
  }
  private say(s: string, x: number, y: number, col: string): void {
    for (const f of this.floats) {
      if (f.on) continue;
      f.on = true;
      f.s = s;
      f.x = x;
      f.y = y;
      f.t = 0;
      f.col = col;
      return;
    }
    const f = this.floats[0];
    f.s = s;
    f.x = x;
    f.y = y;
    f.t = 0;
    f.col = col;
  }

  /* ================= 绘制 ================= */
  private laneKey(): string {
    return [this.w, this.h, this.dpr, this.dark_ ? 1 : 0, this.wv.rtTier, this.wv.srcTier].join('|');
  }

  private paintBg(): void {
    const key = this.laneKey();
    if (this.bg && this.bgKey === key) return;
    this.bgKey = key;
    if (!this.bg) this.bg = document.createElement('canvas');
    const b = this.bg;
    b.width = this.cv.width;
    b.height = this.cv.height;
    const g = b.getContext('2d') as C;
    const L = this.lay;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = P.paper;
    g.fillRect(0, 0, this.w, this.h);
    g.setTransform(this.dpr * L.s, 0, 0, this.dpr * L.s, this.dpr * L.ox, this.dpr * L.oy);
    setUnit(L.s);
    const W = L.portrait ? 126 : 224;
    const H = L.portrait ? 138 : 66;
    // 远山(淡线)
    const rows = L.portrait ? [L.srcY, L.dockY] : [L.srcY];
    for (const gy of rows) {
      pen(g, 1, P.f2);
      g.beginPath();
      g.moveTo(-L.ox / L.s - 2, gy - 8);
      const xs = [0.06, 0.2, 0.34, 0.5, 0.66, 0.82, 0.96];
      xs.forEach((f, i) => g.quadraticCurveTo(W * f - 9, gy - 14 - ((i * 37) % 11), W * f + 4, gy - 8 - ((i * 13) % 5)));
      g.stroke();
    }
    // 地面
    for (const gy of rows) {
      g.fillStyle = P.ground;
      g.fillRect(-L.ox / L.s - 2, gy, this.w / L.s + 4, H);
      pen(g, 1.6, P.ink);
      g.beginPath();
      g.moveTo(-L.ox / L.s - 2, gy);
      g.lineTo(this.w / L.s + 4, gy);
      g.stroke();
      // 草丛
      pen(g, 1, P.f3);
      for (let i = 0; i < 28; i++) {
        const x = ((i * 53) % 100) / 100 * W;
        const y = gy + 3 + ((i * 29) % 7);
        if (Math.abs(x - L.srcX) < 24 && y < gy + 5) continue;
        g.beginPath();
        g.moveTo(x - 1, y);
        g.lineTo(x, y - 1.6);
        g.lineTo(x + 1, y);
        g.stroke();
      }
    }
    // 路线本体:按档绘制
    const tier = this.wv.rtTier;
    const lane = LANE_OF[tier] ?? 0;
    const pts = L.pts;
    const strokePath = (): void => {
      g.beginPath();
      g.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    };
    if (lane === 0) {
      // 公路:两条边线 + 中央虚线
      g.save();
      g.translate(0, 1.2);
      pen(g, 1.2, P.ink);
      strokePath();
      g.stroke();
      g.restore();
      pen(g, 1.1, P.f3);
      g.setLineDash([2.4, 2.4]);
      g.save();
      g.translate(0, 3);
      strokePath();
      g.stroke();
      g.restore();
      g.setLineDash([]);
    } else if (lane === 1) {
      // 河道:宽水面(波纹在 draw 中动态绘制)
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.lineWidth = 8;
      g.strokeStyle = P.f1;
      g.translate(0, 3);
      strokePath();
      g.stroke();
      g.restore();
      pen(g, 1.1, P.ink);
      g.save();
      g.translate(0, -1);
      strokePath();
      g.stroke();
      g.restore();
    } else if (lane === 2) {
      // 空中航线:小虚线
      pen(g, 1, P.f3);
      g.setLineDash([1.6, 2.6]);
      g.save();
      g.translate(0, -20);
      strokePath();
      g.stroke();
      g.restore();
      g.setLineDash([]);
      pen(g, 1.1, P.ink);
      g.save();
      g.translate(0, 0.8);
      strokePath();
      g.stroke();
      g.restore();
    } else {
      pen(g, 1, P.f3);
      g.setLineDash([0.8, 2]);
      g.save();
      g.translate(0, -8);
      strokePath();
      g.stroke();
      g.restore();
      g.setLineDash([]);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  private draw(): void {
    const c = this.c;
    const L = this.lay;
    const wv = this.wv;
    const t = this.t;
    const rm = this.reducedMotion;
    setTheme(this.dark_);
    this.paintBg();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.bg as HTMLCanvasElement, 0, 0);
    c.setTransform(this.dpr * L.s, 0, 0, this.dpr * L.s, this.dpr * L.ox, this.dpr * L.oy);
    setUnit(L.s);
    const W = L.portrait ? 126 : 224;

    // 云
    pen(c, 1, P.f2);
    for (let i = 0; i < 3; i++) {
      const x = ((this.clouds[i] * 1.2) % 1.2 - 0.1) * W;
      const y = 8 + i * 6 + (L.portrait ? 0 : 0);
      c.beginPath();
      c.arc(x, y, 2.6, Math.PI, 0);
      c.arc(x + 3.2, y, 1.8, Math.PI, 0);
      c.moveTo(x - 2.6, y);
      c.lineTo(x + 5, y);
      c.stroke();
    }

    // 河面波纹 / 光束门
    const tier = wv.rtTier;
    const lane = LANE_OF[tier] ?? 0;
    if (lane === 1) {
      pen(c, 0.9, P.ink);
      const a = this.at(0.06);
      const b = this.at(0.97);
      const n = Math.round(Math.abs(b.x - a.x) / 7);
      for (let i = 0; i < n; i++) {
        const q = this.at(0.06 + (i / n) * 0.9);
        const o = rm ? 0 : Math.sin(t * 2 + i) * 1;
        c.beginPath();
        c.moveTo(q.x - 1.8 + o, q.y + 3.4);
        c.quadraticCurveTo(q.x + o, q.y + 2.4, q.x + 1.8 + o, q.y + 3.4);
        c.stroke();
      }
    }
    if (lane === 3) {
      const a = this.at(0.02);
      const b = this.at(0.98);
      drawPortalRing(c, a.x, a.y, t, false);
      drawPortalRing(c, b.x, b.y, t, true);
    }

    // 生产线 + 摇劲条 + 苹果堆
    const srcPopS = 1 + 0.1 * Math.sin(this.srcPop * Math.PI) * (this.srcPop > 0 ? 1 : 0);
    sv(c, L.srcX, L.srcY, srcPopS * L.ss);
    drawSource(c, wv.srcTier, { t, n: wv.srcUnits, br: wv.srcBranch, sway: rm ? 0 : this.sway, shake: this.fwV, reduced: rm });
    rs(c);
    sv(c, L.srcX, L.srcY, L.ss);
    drawShakeMeter(c, this.fwV, wv.combo, 0, t, 15);
    rs(c);
    if (!this.everShook) this.drawFirstHint(c, t, rm);
    sv(c, L.pileX, L.pileY);
    drawPile(c, Math.round(this.pileV), wv.stock01 >= 0.985, t);
    rs(c);
    // 等待装货的"车队列":第一辆为实车,其余为点
    this.drawQueue(c);

    // 关卡
    for (let i = 0; i < 3; i++) {
      const q = this.at(L.gateU[i]);
      const locked = i >= wv.gatesUnlocked;
      sv(c, q.x, q.y, 1 + 0.1 * Math.sin(this.gatePop[i] * Math.PI));
      if (locked) {
        c.globalAlpha = 0.35;
        circ(c, 0, -7, 2.6, null, 1);
        rect(c, -1.6, -6, 3.2, 2.6, P.f1, 1, 0.5);
        c.globalAlpha = 1;
      } else drawGate(c, wv.gates[i], this.gateFlash[i], t, wv.gates.filter((g) => g).length === 0 && i === 0, 23 / L.s);
      rs(c);
    }

    // 车辆
    this.drawVehicles(c);

    // 码头
    sv(c, L.dockX, L.dockY, 1 + 0.08 * Math.sin(this.dockPop * Math.PI));
    drawDock(c, tier, t, this.dockPop, 0);
    sv(c, 0, -0.5);
    drawCrates(c, Math.min(this.crates, 8));
    rs(c);
    rs(c);

    // 名称小标(生产/路线档名),淡色

    // 飞行苹果
    for (const f of this.flys) {
      if (!f.on) continue;
      const k = f.t;
      const x = lerp(f.x0, f.x1, k);
      const y = lerp(f.y0, f.y1, k) - Math.sin(k * Math.PI) * f.arc;
      apple(c, x, y, 1.15, 0.8);
      if (f.kind === 1 && !rm) {
        c.globalAlpha = 0.4;
        apple(c, lerp(f.x0, f.x1, Math.max(0, k - 0.05)), lerp(f.y0, f.y1, Math.max(0, k - 0.05)) - Math.sin(Math.max(0, k - 0.05) * Math.PI) * f.arc, 0.9, 0.5);
        c.globalAlpha = 1;
      }
    }
    // 事件
    if (this.ev) this.drawEvent(c, this.ev);
    // 粒子
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      const k = p.life / p.max;
      c.globalAlpha = clamp(k * 1.5, 0, 1);
      if (p.kind === 2) {
        pen(c, 1.4, p.gold ? GOLDC : P.ink);
        c.beginPath();
        c.arc(p.x, p.y, p.size * (1 - k) + 1, 0, TAU);
        c.stroke();
      } else if (p.kind === 1) sparkle(c, p.x, p.y, p.size * (0.4 + k), p.gold ? GOLDC : P.ink, t * 3);
      else {
        c.fillStyle = p.gold ? GOLDC : P.ink;
        c.beginPath();
        c.arc(p.x, p.y, p.size * 0.5, 0, TAU);
        c.fill();
      }
    }
    c.globalAlpha = 1;
    // 飘字
    for (const f of this.floats) {
      if (!f.on) continue;
      const k = f.t / 1.3;
      c.globalAlpha = clamp((1 - k) * 2, 0, 1);
      text(c, f.s, f.x, f.y - ease(k) * 10, 14, f.col);
    }
    c.globalAlpha = 1;
    // 瓶颈提示:产出 < 运力 → 生产线上方"缺货"小标;库存满 → 路线"运不完"
    this.drawBottleneck(c);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawBottleneck(c: C): void {
    const wv = this.wv;
    const L = this.lay;
    if (wv.stock01 >= 0.985) {
      const q = this.at(0.05);
      text(c, '运不完 →', q.x + 4, q.y - 24, 10, APPLE);
    } else if (wv.stock01 < 0.03 && wv.carry > wv.produce * 1.6) {
      text(c, '货不够', L.pileX, L.pileY - 30 + (L.portrait ? 0 : 0), 10, P.dim);
    }
  }

  /** 首次引导(无文字):树上方一根手指轻点 + 点击涟漪,摇过一次就不再出现 */
  private drawFirstHint(c: C, t: number, rm: boolean): void {
    const L = this.lay;
    const cyc = rm ? 0.3 : (t % 1.6) / 1.6; // 0..1
    const tap = Math.sin(Math.min(1, cyc / 0.35) * Math.PI); // 按下
    const x = L.srcX + 8 * L.ss;
    const y = L.srcY - 30 * L.ss;
    sv(c, x, y + tap * 2.2, L.ss, -0.35);
    c.globalAlpha = 0.9;
    // 手指:圆角长条 + 掌
    c.beginPath();
    c.roundRect(-1.7, -2, 3.4, 9, 1.7);
    c.fillStyle = P.f0;
    c.fill();
    pen(c, 1.4);
    c.stroke();
    c.beginPath();
    c.roundRect(-3.6, 5.2, 7.2, 5.6, 2.4);
    c.fillStyle = P.f0;
    c.fill();
    pen(c, 1.4);
    c.stroke();
    c.globalAlpha = 1;
    rs(c);
    if (!rm && cyc > 0.15 && cyc < 0.8) {
      const k = (cyc - 0.15) / 0.65;
      c.globalAlpha = 1 - k;
      c.beginPath();
      c.arc(x, y - 1, 2 + k * 8 * L.ss, 0, TAU);
      pen(c, 1.2, P.f3);
      c.stroke();
      c.globalAlpha = 1;
    }
  }

  private drawQueue(c: C): void {
    const L = this.lay;
    const waiting = this.vehs.filter((v) => v.state === 0).length;
    const extra = Math.max(0, this.wv.rtVehicles - this.vehs.length);
    const q0 = this.at(0);
    let first = true;
    let k = 0;
    for (const v of this.vehs) {
      if (v.state !== 0) continue;
      if (first && LANE_OF[this.wv.rtTier] !== 3) {
        first = false;
        sv(c, q0.x, q0.y + (LANE_OF[this.wv.rtTier] === 2 ? -22 : this.wv.rtTier === 3 ? 2.5 : 0));
        drawVehicle(c, this.wv.rtTier, { t: this.t, ph: v.ph, full: false, dir: q0.dir, br: this.wv.rtBranch });
        rs(c);
      } else {
        const x = q0.x - 5 - k * 2.6;
        circ(c, x, q0.y + 3.2, 0.9, P.f0, 0.9);
        k++;
      }
    }
    if (extra > 0 || waiting > 3) text(c, '×' + this.wv.rtVehicles, q0.x + (L.portrait ? 0 : 0), q0.y + 9, 9, P.dim);
  }

  /** 终点之后沿末段方向延伸到屏幕外的点(车辆驶出画面用) */
  private exitPt(): { x: number; y: number; dx: number; dy: number } {
    const a = this.at(0.985);
    const b = this.at(1);
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const n = Math.hypot(dx, dy) || 1;
    dx /= n;
    dy /= n;
    const L = this.lay;
    const tx = dx >= 0 ? (this.w - L.ox) / L.s + 14 : -L.ox / L.s - 14;
    const D = Math.abs(dx) > 0.2 ? (tx - b.x) / dx : 40;
    return { x: b.x + dx * D, y: b.y + dy * D, dx, dy };
  }

  private drawVehicles(c: C): void {
    const tier = this.wv.rtTier;
    const lane = LANE_OF[tier] ?? 0;
    const L = this.lay;
    const leave = tier >= 2 && tier <= 4; // 卡车/货船/飞机:开出画面再绕回来
    const ex = leave ? this.exitPt() : null;
    // 小推车:车越多,编队越长(1~3 节)
    const rv = this.wv.rtVehicles;
    const cars = tier === 1 ? (rv >= 8 ? 3 : rv >= 3 ? 2 : 1) : 1;
    for (const v of this.vehs) {
      if (v.state === 0) continue;
      let u: number;
      let full = v.full;
      let dirF = 1;
      let px = NaN;
      let py = NaN;
      if (v.state === 1) u = 0.02 + v.p * 0.96;
      else if (v.state === 2) {
        u = 0.98;
        full = false;
      } else if (ex) {
        // 3:先驶出右/左边缘(0~.2),屏外调头(.2~.34),再从边缘驶回起点
        const b = this.at(1);
        if (v.p < 0.2) {
          const k = v.p / 0.2;
          px = b.x + (ex.x - b.x) * k;
          py = b.y + (ex.y - b.y) * k;
          u = 1;
        } else if (v.p < 0.34) continue;
        else {
          const k = (v.p - 0.34) / 0.66;
          dirF = -1;
          if (k < 0.16) {
            const kk = k / 0.16;
            px = ex.x + (b.x - ex.x) * kk;
            py = ex.y + (b.y - ex.y) * kk;
            u = 1;
          } else u = 1 - ((k - 0.16) / 0.84) * 0.98;
        }
      } else {
        u = 0.98 - v.p * 0.96;
        dirF = -1;
      }
      const q = this.at(u);
      const dir = q.dir * dirF;
      const oy = (lane === 2 ? -22 + Math.sin(this.t * 2 + v.ph) * 0.8 : lane === 1 ? 2.2 + Math.sin(this.t * 2.4 + v.ph) * 0.5 : lane === 3 ? -8 : 0) + (dirF < 0 && leave && lane !== 2 ? 2.4 : 0);
      sv(c, px === px ? px : q.x, (py === py ? py : q.y) + oy);
      if (lane === 3) {
        drawBead(c, full, this.t);
      } else {
        for (let k = 0; k < cars; k++) {
          if (k > 0) {
            // 车间牵绳
            seg(c, -9 * dir * k + 4.2 * dir, -2, -9 * dir * k + 9 * dir - 4.2 * dir, -2, 1);
            sv(c, -9 * dir * k, 0);
          }
          drawVehicle(c, tier, { t: this.t, ph: v.ph + k, full: k === 0 ? full : full && k % 2 === 0, dir, br: this.wv.rtBranch });
          if (k > 0) rs(c);
        }
      }
      rs(c);
    }
  }

  private drawEvent(c: C, e: Ev): void {
    const t = this.t;
    c.globalAlpha = e.caught > 0 ? clamp(e.caught / 0.7, 0, 1) : 1;
    sv(c, e.x, e.y);
    if (e.kind === 'bird') {
      const fl = Math.sin(t * 9) * 1.6;
      pen(c, 1.5);
      c.beginPath();
      c.moveTo(-5, 1 + fl * 0.3);
      c.quadraticCurveTo(-2.4, -1.5 - fl, 0, 0);
      c.quadraticCurveTo(2.4, -1.5 - fl, 5, 1 + fl * 0.3);
      c.stroke();
      circ(c, 0, 0.6, 1.5, P.f0, 1.2);
      poly(c, [1.4, 0.2, 3.2, 0.8, 1.4, 1.4], P.f2, 0.9);
      apple(c, 0.2, 3.6, 1.2, 0.8);
    } else if (e.kind === 'meteor') {
      pen(c, 1.5, GOLDC);
      seg(c, 0, 0, 9, -6, 1.4, GOLDC);
      seg(c, 0, 0, 7, -2, 1, GOLDC);
      sparkle(c, 0, 0, 3.2, GOLDC, t * 2);
      apple(c, 0, 0, 1.6, 1);
    } else {
      // 路过的牛顿:假发、长袍、看书走路
      const sw = Math.sin(t * 6) * 1.2;
      seg(c, 0, -4, -sw, 0, 1.3);
      seg(c, 0, -4, sw, 0, 1.3);
      poly(c, [-2.6, -5.5, 2.6, -5.5, 3.4, -3.8, -3.4, -3.8], P.f1, 1.2);
      poly(c, [-2.4, -9, 2.4, -9, 3, -3.8, -3, -3.8], P.f0, 1.2);
      circ(c, 0, -11.2, 2, P.f0, 1.2);
      for (let i = -1; i <= 1; i++) circ(c, i * 2, -12, 1.2, P.f2, 0.9);
      rect(c, -3.6, -8, 3.2, 2.2, P.f0, 1);
      apple(c, 1.2, -16.6 + Math.sin(t * 5) * 0.5, 1, 0.7);
    }
    rs(c);
    c.globalAlpha = 1;
  }
}
