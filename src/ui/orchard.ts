/** 苹果树与果园的 Canvas 渲染。黑白线稿,只有苹果有颜色。上半是果园(树/筐/园丁/牛顿/卡车),下半是"景点街"(各个项目的小场景)。 */
import { bubble, bucket, gardener, newton, resetFrame } from './chars.ts';
import { BAND_BG, drawApple, glow, goldApple, GOLD, RED, sparklePath, TAU } from './draw.ts';
import { bird, cloud, drone, tractor } from './extras.ts';
import { basket, shakerBox, truck, wind } from './props.ts';
import { Street, snowWhite } from './scenes.ts';
import type { SceneId } from './scenes.ts';
import { CANOPY, Env } from './sky.ts';
import { EventFx, Flow, SRC_COLOR } from './flow.ts';
import type { EventGeo, FlowFx, FlowGeo, Station } from './flow.ts';
import { harvestInfo } from '../core/world.ts';
import type { HarvestInfo } from '../core/world.ts';
import type { SourceId } from '../core/game.ts';
import type { EventKind } from '../core/events.ts';

export { RED, GOLD, drawApple };

/** 画面需要知道的升级/项目状态 */
export interface Build {
  shake: number;
  breeze: number;
  gardener: number;
  branches: number;
  breed: number;
  shaker: number;
  express: number;
  /** 新增升级:拖拉机 / 无人机采摘 / 苹果云(数值 = 等级) */
  tractor?: number;
  drone?: number;
  cloud?: number;
  gravity: boolean;
  fairest: boolean;
  cook: boolean;
  duo: boolean;
  cookActive: boolean;
  /** 新增(晚期项目):禁果已咬几口 0-3 / 乔布斯车库 / 每天一苹果的医生 / 女巫苹果 / One more thing */
  bites: number;
  garage: boolean;
  doctor: boolean;
  witch: boolean;
  onemore: boolean;
  /** 女巫苹果生效后的沉睡动画(约 4 秒) */
  sleeping: boolean;
}
export const EMPTY_BUILD: Required<Build> = {
  shake: 0, breeze: 0, gardener: 0, branches: 0, breed: 0, shaker: 0, express: 0, tractor: 0, drone: 0, cloud: 0,
  gravity: false, fairest: false, cook: false, duo: false, cookActive: false,
  bites: 0, garage: false, doctor: false, witch: false, onemore: false, sleeping: false,
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- 果园布局:世界单位 = 前排树高。后排更小、更靠上,像一个山谷。 ----
const ROW_CAP = [3, 4, 6, 8, 10, 12];
const ROW_S = [1, 0.85, 0.72, 0.62, 0.53, 0.46];
const ROW_Y = [0, -0.36, -0.68, -0.95, -1.18, -1.38];
interface Slot { x: number; y: number; s: number; row: number }
export const SLOTS: Slot[] = (() => {
  const out: Slot[] = [];
  for (let r = 0; r < ROW_CAP.length; r++) {
    const cap = ROW_CAP[r];
    const sp = 0.72 * ROW_S[r];
    const cols = Array.from({ length: cap }, (_, c) => c - (cap - 1) / 2);
    cols.sort((a, b) => Math.abs(a) - Math.abs(b) || b - a);
    for (const c of cols) out.push({ x: c * sp, y: ROW_Y[r], s: ROW_S[r], row: r });
  }
  return out;
})();

// ---- 树的精灵图 ----
const SW = 400;
const SH = 420;
/** b = 枝繁叶茂等级(树冠大小、叶子和苹果数),golds = 树上金苹果个数(品种改良)。每多一级只在原有基础上增加。 */
interface SpriteCv extends HTMLCanvasElement { apl: Array<[number, number, number]> }
function makeSprite(seed: number, b: number, golds: number, tint = '#fff'): SpriteCv {
  const cv = document.createElement('canvas') as SpriteCv;
  cv.apl = [];
  cv.width = SW;
  cv.height = SH;
  const c = cv.getContext('2d')!;
  const bx = SW / 2;
  const by = SH - 10;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  // 树干:根部略宽,向上变细
  c.fillStyle = '#111';
  c.beginPath();
  c.moveTo(bx - 30, by);
  c.bezierCurveTo(bx - 14, by - 40, bx - 13, by - 110, bx - 9, by - 190);
  c.lineTo(bx + 9, by - 190);
  c.bezierCurveTo(bx + 13, by - 110, bx + 14, by - 40, bx + 30, by);
  c.closePath();
  c.fill();
  // 树冠:一组相交的圆,先描边再填白,得到一个连续的云朵轮廓。第 i 个圆只由 (seed,i) 决定。
  const n = 8 + b;
  const circles: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const rnd = mulberry32(seed * 977 + i * 131);
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd());
    const r = 44 + rnd() * 28 + Math.min(b, 14) * 1.1;
    circles.push([bx + Math.cos(a) * d * SW * 0.27, 172 + Math.sin(a) * d * SH * 0.13, r]);
  }
  c.strokeStyle = '#111';
  c.lineWidth = 8;
  for (const [x, y, r] of circles) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
  }
  c.fillStyle = tint;
  for (const [x, y, r] of circles) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
  // 叶片笔触
  c.lineWidth = 3;
  const marks = 7 + b * 2;
  for (let i = 0; i < marks; i++) {
    const rnd = mulberry32(seed * 313 + i * 71);
    const [x, y, r] = circles[Math.floor(rnd() * circles.length)];
    const a = rnd() * Math.PI * 2;
    const d = rnd() * r * 0.45;
    c.beginPath();
    c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 9 + rnd() * 8, a, a + 1.7);
    c.stroke();
  }
  // 树上的苹果:枝繁叶茂越高越多;前 golds 个是金苹果
  const apples = Math.max(3 + b, golds + 2);
  for (let i = 0; i < apples; i++) {
    const rnd = mulberry32(seed * 557 + i * 53);
    const [x, y, r] = circles[Math.floor(rnd() * circles.length)];
    const a = rnd() * Math.PI * 2;
    const d = rnd() * r * 0.6;
    const ax = x + Math.cos(a) * d;
    const ay = y + Math.sin(a) * d + 6;
    drawApple(c, ax, ay, i < golds ? 17 : 15, i < golds ? GOLD : RED, 3);
    if (i >= golds) cv.apl.push([ax, ay, 15]);
  }
  return cv;
}

interface Drop { on: boolean; x: number; y: number; gy: number; vy: number; vx: number; r: number; rest: number; color: string }
interface Float { on: boolean; x: number; y: number; vy: number; life: number; text: string; color: string; size: number }
interface Ripple { on: boolean; x: number; y: number; t: number }
/** 屏幕像素系的粒子:0 叶子 1 火花 2 雪 */
interface Part { on: boolean; kind: number; x: number; y: number; vx: number; vy: number; life: number; max: number; rot: number; vr: number; size: number; color: string }
type Kind = 'shake' | 'breeze' | 'gardener' | 'branches' | 'breed' | 'shaker' | 'express' | 'tractor' | 'drone' | 'cloud' | 'gravity' | 'fairest' | 'cook' | 'duo' | 'bites' | 'garage' | 'doctor' | 'witch' | 'onemore';

const LABEL: Record<Kind, string> = {
  shake: '苹果筐', breeze: '微风', gardener: '园丁老徐', branches: '枝繁叶茂', breed: '金苹果',
  shaker: '摇树机', express: '平安快递', tractor: '拖拉机', drone: '无人机采摘', cloud: '苹果云', gravity: '万有引力', fairest: '最美的苹果', cook: '苹果发布会', duo: 'iPhone Duo',
  bites: '禁果', garage: '乔布斯车库', doctor: '每天一苹果', witch: '女巫苹果', onemore: 'One more thing',
};
/** 景点街里的场景对应哪个项目 */
const SCENE_OF: Partial<Record<Kind, SceneId>> = {
  fairest: 'sign', duo: 'phone', cook: 'stage', onemore: 'onemore', bites: 'bites', garage: 'garage', doctor: 'doctor', witch: 'witch',
};
const KIND_OF: Record<SceneId, Kind> = {
  sign: 'fairest', phone: 'duo', stage: 'cook', onemore: 'onemore', bites: 'bites', garage: 'garage', doctor: 'doctor', witch: 'witch',
};

const MAX_DROPS = 300;
const MAX_FLOATS = 40;
const MAX_PARTS = 200;
const DASH = [4, 6];
const SWAY_S = 1.4;

const NEWTON_LINES = ['苹果为什么往下掉?', '别砸了,我在想事情', '引力…有意思', '这本书怎么这么沉', '又来一个?!', '我只是想歇会儿'];
const GARDENER_LINES = ['今天也要加油摇!', '擦把汗,继续', '这棵树脾气不小', '苹果熟了吗?', '老板说多摇多得', '歇口气,再来'];
const STATION_TXT: Record<string, string> = {
  sign: '✦', phone: '拍!', stage: '发布!', onemore: '再来一个', bites: '禁果', garage: '组装', doctor: '健康+', witch: '施法',
};
const STATION_LINES: Partial<Record<SceneId, string[]>> = {
  sign: ['最美的苹果,只此一颗', '金光闪闪'],
  phone: ['来,看镜头:苹果~', '咔嚓!又一张'],
  stage: ['Good morning.', '今天,我们带来苹果'],
  onemore: ['One more thing…', '还有一件事'],
  bites: ['好奇心的味道', '一口,就够了'],
  garage: ['Stay hungry. Stay foolish.', '车库里的灯还亮着'],
  doctor: ['An apple a day…', '医生请留步'],
  witch: ['亲爱的,尝一口?', '别怕,只是个苹果'],
};
function fmtN(v: number): string { return v.toFixed(1); }
const ROAD_Y = 0.47;
/** 传送带占的高度(像素),位于果园与景点街之间 */
const BELT = 18;
const FONT = '-apple-system, "PingFang SC", sans-serif';
/** 夜空里的星星(相对坐标 x,y,相位) */
const STARS: ReadonlyArray<readonly [number, number, number]> = (() => {
  const r = mulberry32(7);
  return Array.from({ length: 18 }, () => [r(), r() * 0.8, r() * 6] as const);
})();

interface GardenerSpot { x: number; y: number; dir: number; tree: number }

export class Orchard {
  private ctx: CanvasRenderingContext2D;
  private sprites: SpriteCv[] = [];
  private sprSeason = -1;
  private sprArgs: [number, number] = [0, 0];
  private spriteKey = '';
  private w = 1;
  private h = 1;
  private dpr = 1;
  private count = 1;
  private born: number[] = [0];
  private time = 0;
  private shake = 0;
  private kick: number[] = SLOTS.map(() => 0);
  private build: Required<Build> = { ...EMPTY_BUILD };
  private built = false;
  private pulse: Partial<Record<Kind, number>> = {};
  private ripples: Ripple[] = Array.from({ length: 6 }, () => ({ on: false, x: 0, y: 0, t: 0 }));
  private drops: Drop[] = Array.from({ length: MAX_DROPS }, () => ({ on: false, x: 0, y: 0, gy: 0, vy: 0, vx: 0, r: 0, rest: 0, color: RED }));
  private floats: Float[] = Array.from({ length: MAX_FLOATS }, () => ({ on: false, x: 0, y: 0, vy: 0, life: 0, text: '', color: '#111', size: 18 }));
  private parts: Part[] = Array.from({ length: MAX_PARTS }, () => ({ on: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, rot: 0, vr: 0, size: 5, color: '#fff' }));
  private partHead = 0;
  // 相机:世界单位到像素的缩放与中心
  private k = 100;
  private cx = 0;
  private cy = 0;
  private targetK = 100;
  private targetCx = 0;
  private targetCy = 0;
  private cameraInit = false;
  /** 底部"景点街"的高度(像素),平滑变化;上半部分(果园)高度 = h - band */
  private band = 0;
  private bandT = 0;
  private cloudX = 0;
  private cloudY = -1.2;
  private goldFlash = 0;
  private goldX = 0;
  private goldY = 0;
  private trailT = 0;
  private gustT = -1;
  private gustNext = 5;
  private gustN = 0;
  private leafAcc = 0;
  private ambLeafT = 2;
  private birdT = 6;
  private birdP = -1;
  private gustLean = 0;
  private gustEnv = 0;
  private street = new Street();
  // ---- 第三轮:世界(昼夜/季节/天气)、流水线、事件 ----
  private env = new Env();
  private envInit = false;
  private clockT = 0;
  private hv: HarvestInfo = harvestInfo(0);
  private hvPrev = false;
  private harvA = 0;
  private harvT = 0;
  private flowFx: FlowFx = {
    spark: (x, y, color, n) => { for (let i = 0; i < n; i++) this.emit(1, x, y, (Math.random() - 0.5) * 90, -20 - Math.random() * 50, 0.6, 3, color); },
    float: (x, y, text, color, size) => this.floatText(x, y, text, color, size),
    station: (id, x, val) => this.stationPass(id, x, val),
    cloudHit: (x, y) => { this.cloudBump = 1; this.flowFx.spark(x, y, '#fff', 2); },
  };
  private flow = new Flow(this.flowFx);
  private evt = new EventFx(this.flowFx);
  private cloudBump = 0;
  private stOut: Array<{ id: string; x: number; w: number }> = Array.from({ length: 8 }, () => ({ id: '', x: 0, w: 0 }));
  private stList: Station[] = [];
  private stCool: Record<string, number> = {};
  private stFlash: Record<string, number> = {};
  private geo: FlowGeo & EventGeo = {
    w: 1, h: 1, beltY: 0, depotX: 0, cloud: null, stations: [], sky: 0, perch: { x: 0, y: 0 },
    origin: (id, out) => this.originOf(id, out),
  };
  private gP = Array.from({ length: 5 }, () => ({ x: 0, y: 0 }));
  private gN = 0;
  private tP = Array.from({ length: 3 }, () => ({ x: 0, y: 0 }));
  private tN = 0;
  private dP = Array.from({ length: 6 }, () => ({ x: 0, y: 0 }));
  private dN = 0;
  private xP = Array.from({ length: 4 }, () => ({ x: 0, y: 0 }));
  private xN = 0;
  private oc = 0;
  private quip = { text: '', t: 99, x: 0, y: 0, dur: 3.2, id: '' };
  private quipNext = 18;
  private quipI = 0;
  private popOf = (id: SceneId): number => this.pop(KIND_OF[id]);
  private sleepA = 0;
  private goldA = 0;
  private bump = 0;
  private snowT = 0;
  private goldT = 0;
  // 院子里的布局(世界坐标),refit 时重算
  private x0 = -1;
  private x1 = 1;
  private basketX: number[] = [];
  private spots: GardenerSpot[] = [];
  private gCycle: number[] = [];
  private newton = { x: -0.26, y: 0.1, falling: false, ay: 0, vy: 0, hitT: -1 };
  /** 最美的苹果:世界坐标,null 表示当前没有 */
  fairest: { x: number; y: number; life: number } | null = null;
  reducedMotion = false;
  /** 圣诞:主树挂彩灯与星星,园丁戴红帽,飘雪(main.ts 在 12/24-25 设为 true;也会读 body.xmas) */
  christmas = false;
  /** 被掉落池挤掉的苹果数(只用于显示 "+N") */
  overflow = 0;

  constructor(private cv: HTMLCanvasElement) {
    this.ctx = cv.getContext('2d')!;
    // 事件(小鸟/快递/流星)和景点的点击:事件命中时吞掉这次点击,景点只弹台词(点击仍然算摇树)
    cv.addEventListener('pointerdown', (e) => {
      const r = cv.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      if (this.evt.tap(px, py)) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      const id = this.street.hit(px, py);
      if (id) this.stationTap(id);
    }, true);
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.cv.getBoundingClientRect();
    this.w = Math.max(1, Math.round(r.width));
    this.h = Math.max(1, Math.round(r.height));
    this.cv.width = Math.round(this.w * this.dpr);
    this.cv.height = Math.round(this.h * this.dpr);
    this.refit(true);
  }

  /** trees = 当前树数;build = 升级与项目的状态。购买时(与上次相比增加)会弹出对应的东西。 */
  setState(trees: number, input: Build): void {
    const n = Math.min(trees, SLOTS.length);
    if (n > this.count) for (let i = this.count; i < n; i++) this.born[i] = this.time;
    this.count = n;
    const prev = this.build;
    const full: Required<Build> = { ...EMPTY_BUILD, ...input };
    for (const k of ['tractor', 'drone', 'cloud'] as const) if (input[k] === undefined) full[k] = 0;
    const bd = full;
    this.build = bd;
    if (typeof document !== 'undefined' && document.body.classList.contains('xmas')) this.christmas = true;
    const fresh = this.street.sync(bd);
    if (this.built) {
      for (const k of ['shake', 'breeze', 'gardener', 'branches', 'breed', 'shaker', 'express', 'tractor', 'drone', 'cloud'] as const) {
        if (bd[k] > prev[k]) this.flash(k, `${LABEL[k]} Lv.${bd[k]}`);
      }
      for (const k of ['gravity', 'fairest', 'cook', 'duo', 'garage', 'doctor', 'witch', 'onemore'] as const) {
        if (bd[k] && !prev[k]) this.flash(k, `${LABEL[k]}!`);
      }
      if (bd.bites > prev.bites) {
        this.flash('bites', bd.bites >= 3 ? '禁果:金色光芒!' : `${LABEL.bites} ${bd.bites}/3`);
        if (bd.bites >= 3) this.goldT = 3;
        this.street.focus('bites', 5);
      }
      for (const id of fresh) if (id !== 'bites') this.street.focus(id, 5);
    }
    this.built = true;
    const key = `${Math.min(14, bd.branches)}:${bd.breed > 0 ? Math.min(6, 1 + Math.floor(bd.breed / 2)) : 0}`;
    if (key !== this.spriteKey) {
      this.spriteKey = key;
      const [b, g] = key.split(':').map(Number);
      this.sprArgs = [b, g];
      this.sprSeason = this.env.season;
      this.sprites = [11, 29, 47].map((seed) => makeSprite(seed, b, g, CANOPY[this.env.season]));
    }
    this.refit(false);
  }

  private refit(snap: boolean): void {
    const b = this.build;
    let tx0 = Infinity, tx1 = -Infinity, y0 = Infinity;
    for (let i = 0; i < this.count; i++) {
      const t = SLOTS[i];
      tx0 = Math.min(tx0, t.x - 0.5 * t.s);
      tx1 = Math.max(tx1, t.x + 0.5 * t.s);
      y0 = Math.min(y0, t.y - 1.0 * t.s);
    }
    // 左侧放苹果筐;其余项目都搬到下方的"景点街"
    let cur = 0.12;
    const nb = b.shake > 0 ? Math.min(3, 1 + Math.floor((b.shake - 1) / 6)) : 0;
    const offB: number[] = [];
    for (let i = 0; i < nb; i++) { offB.push(cur + 0.085); cur += 0.17; }
    const padL = cur + 0.06;
    const padR = b.gardener > 0 ? 0.22 : 0.12;
    this.x0 = tx0 - padL;
    this.x1 = tx1 + padR;
    this.basketX = offB.map((o) => this.x0 + o);
    // 院子的下沿:有任何院子里的东西就留出空间
    const tn = b.tractor > 0 ? Math.min(3, 1 + Math.floor((b.tractor - 1) / 3)) : 0;
    const yard = nb > 0 || b.gardener > 0 || b.express > 0 || b.gravity || tn > 0;
    const y1 = tn > 0 ? 0.64 + 0.06 * tn : yard ? 0.56 : 0.08;
    // 苹果云:在树冠上方留出一块天空
    const topY = y0;
    if (b.cloud > 0) {
      this.cloudX = (tx0 + tx1) / 2;
      this.cloudY = topY - 0.22;
      y0 = topY - 0.46;
    }
    // 牛顿坐在主树脚下偏左
    this.newton.x = SLOTS[0].x - 0.3;
    // 园丁位置:最多 5 个,错开站位(前后两排),各自朝向最近的前排树
    const front = Math.max(1, Math.min(3, this.count));
    const mid = SLOTS[0].x;
    const half = Math.max(0.5, (tx1 - tx0) / 2);
    const FX = [0.85, -0.85, 0];
    const FY = [0.3, 0.3, 0.42];
    this.spots = FX.map((f, j) => {
      let x = mid + f * half;
      // 别挡住牛顿
      if (b.gravity && Math.abs(x - this.newton.x) < 0.42) x = this.newton.x + (x >= this.newton.x ? 0.42 : -0.42);
      let ti = 0;
      for (let i = 1; i < front; i++) if (Math.abs(SLOTS[i].x - x) < Math.abs(SLOTS[ti].x - x)) ti = i;
      const d = SLOTS[ti].x - x;
      return { x, y: FY[j], dir: d >= 0 ? 1 : -1, tree: ti };
    });
    this.bandT = this.street.has() ? Math.round(this.h * (this.w / this.h > 1.7 ? 0.46 : 0.4)) : 0;
    const oh = this.h - this.bandT - BELT;
    const bw = this.x1 - this.x0;
    const bh = y1 - y0;
    this.targetK = Math.min((this.w * 0.96) / bw, (oh * 0.9) / bh);
    this.targetCx = (this.x0 + this.x1) / 2;
    this.targetCy = (y0 + y1) / 2;
    if (snap || !this.cameraInit) {
      this.k = this.targetK;
      this.cx = this.targetCx;
      this.cy = this.targetCy;
      this.band = this.bandT;
      this.cameraInit = true;
    }
  }

  private sx(wx: number): number { return this.w / 2 + (wx - this.cx) * this.k; }
  private sy(wy: number): number {
    const oh = this.h - this.band - BELT;
    return oh / 2 + 0.03 * oh + (wy - this.cy) * this.k;
  }

  /** 屏幕粒子:环形缓冲,不分配 */
  private emit(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string): void {
    const p = this.parts[this.partHead];
    this.partHead = (this.partHead + 1) % MAX_PARTS;
    p.on = true; p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life;
    p.rot = Math.random() * 6; p.vr = (Math.random() - 0.5) * 8; p.size = size; p.color = color;
  }

  poke(): void {
    this.shake = Math.min(1, this.shake + 0.55);
    if (this.reducedMotion) return;
    // 叶子 + 偶尔的火花从树冠飞出
    const t = SLOTS[Math.floor(Math.random() * this.count)];
    const x = this.sx(t.x);
    const y = this.sy(t.y) - 0.7 * this.k * t.s;
    const sz = Math.max(4, 0.03 * this.k * t.s);
    for (let i = 0; i < 6; i++) this.emit(0, x + (Math.random() - 0.5) * 0.5 * this.k * t.s, y + (Math.random() - 0.3) * 0.2 * this.k, (Math.random() - 0.5) * 70, -20 - Math.random() * 40, 1.4 + Math.random() * 0.8, sz * (0.8 + Math.random() * 0.6), '#fff');
    if (this.build.breed > 0) for (let i = 0; i < 3; i++) this.emit(1, x + (Math.random() - 0.5) * 0.4 * this.k, y, (Math.random() - 0.5) * 90, -50 - Math.random() * 60, 0.7, sz * 0.9, GOLD);
  }

  /** 从随机一棵树上掉下 n 个苹果(最多画 12 个),golds 个为金色 */
  drop(n: number, golds = 0): void {
    this.dropAt(-1, n, golds);
  }

  /** 从第 idx 棵树(-1 = 随机)掉苹果 */
  dropAt(idx: number, n: number, golds = 0): void {
    const draw = Math.min(Math.ceil(n), 12);
    for (let i = 0; i < draw; i++) {
      const d = this.drops.find((q) => !q.on);
      if (!d) { this.overflow += n - i; break; }
      const t = SLOTS[idx >= 0 ? idx : Math.floor(Math.random() * this.count)];
      d.on = true;
      d.x = t.x + (Math.random() - 0.5) * 0.45 * t.s;
      d.y = t.y - t.s * (0.5 + Math.random() * 0.3);
      d.gy = t.y + (Math.random() - 0.5) * 0.08;
      d.vx = (Math.random() - 0.5) * 0.4;
      d.vy = 0;
      d.r = 0.035 * t.s;
      d.rest = 0;
      d.color = i < golds ? GOLD : RED;
    }
  }

  floatText(x: number, y: number, text: string, color = '#111', size = 18): void {
    const f = this.floats.find((q) => !q.on);
    if (!f) return;
    Object.assign(f, { on: true, x, y, vy: -60, life: 1, text, color, size });
  }

  /** 万有引力:一个苹果砸在牛顿头上 */
  gravityHit(): void {
    if (this.newton.falling || (this.newton.hitT >= 0 && this.newton.hitT < 0.6)) return;
    Object.assign(this.newton, { falling: true, ay: -1.1, vy: 0 });
  }

  /** 在树冠附近放出一个最美的苹果 */
  spawnFairest(): void {
    const t = SLOTS[Math.floor(Math.random() * this.count)];
    this.fairest = { x: t.x + (Math.random() - 0.5) * 0.5 * t.s, y: t.y - t.s * 0.75, life: 12 };
  }

  /** 屏幕坐标是否点中了最美的苹果(带 14px 容差) */
  hitFairest(px: number, py: number): boolean {
    const f = this.fairest;
    if (!f) return false;
    const r = Math.max(20, 0.07 * this.k) + 14;
    const ok = Math.hypot(px - this.sx(f.x), py - this.sy(f.y)) <= r;
    if (ok) this.burstFairest();
    return ok;
  }

  /** 最美的苹果被点中:金色爆开(星芒 + 光环 + 金色碎片)。hitFairest 命中时会自动调用 */
  burstFairest(): void {
    const f = this.fairest;
    if (!f) return;
    const x = this.sx(f.x);
    const y = this.sy(f.y);
    const r = this.ripples.find((q) => !q.on);
    if (r) Object.assign(r, { on: true, x, y, t: 0 });
    this.goldFlash = 1;
    this.goldX = x;
    this.goldY = y;
    if (this.reducedMotion) return;
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.2;
      const sp = 90 + Math.random() * 170;
      this.emit(1, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 40, 0.7 + Math.random() * 0.6, 3 + Math.random() * 5, i % 3 === 0 ? '#fff6c4' : GOLD);
    }
    for (let i = 0; i < 6; i++) this.emit(0, x, y, (Math.random() - 0.5) * 160, -60 - Math.random() * 60, 1.2, Math.max(3, 0.02 * this.k), '#fff');
  }

  /** 主树树冠位置,用于飘字 */
  crownPos(): { x: number; y: number } {
    const t = SLOTS[0];
    return { x: this.sx(t.x), y: this.sy(t.y) - 0.8 * this.k * t.s };
  }

  private anchor(kind: Kind): { x: number; y: number } {
    const k = this.k;
    const t0 = SLOTS[0];
    const sc = SCENE_OF[kind];
    if (sc) return this.street.anchor(sc);
    switch (kind) {
      case 'shake': return { x: this.sx(this.basketX[0] ?? this.x0 + 0.2), y: this.sy(0.3) - 0.12 * k };
      case 'breeze': return { x: this.w * 0.3, y: this.h * 0.15 };
      case 'gardener': { const s = this.spots[0]; return s ? { x: this.sx(s.x), y: this.sy(s.y) - 0.4 * k } : this.crownPos(); }
      case 'branches': return this.crownPos();
      case 'breed': return { x: this.sx(t0.x + 0.15), y: this.sy(t0.y) - 0.75 * k };
      case 'shaker': return { x: this.sx(t0.x), y: this.sy(t0.y) - 0.3 * k };
      case 'express': return { x: this.w * 0.5, y: this.sy(ROAD_Y) - 0.2 * k };
      case 'tractor': return { x: this.w * 0.5, y: this.sy(0.62) - 0.2 * k };
      case 'drone': return { x: this.w * 0.5, y: this.sy(-0.6) };
      case 'cloud': return { x: this.sx(this.cloudX), y: this.sy(this.cloudY) };
      case 'gravity': return { x: this.sx(this.newton.x), y: this.sy(this.newton.y) - 0.5 * k };
      default: return this.crownPos();
    }
  }

  private flash(kind: Kind, text: string): void {
    this.pulse[kind] = 1;
    const a = this.anchor(kind);
    this.floatText(a.x, a.y - 8, text, RED, 17);
    const r = this.ripples.find((q) => !q.on);
    if (r) Object.assign(r, { on: true, x: a.x, y: a.y + 10, t: 0 });
    if (kind === 'branches' || kind === 'breed' || kind === 'shaker') for (let i = 0; i < this.count; i++) this.kick[i] = Math.max(this.kick[i], 0.7);
    if (!this.reducedMotion) for (let i = 0; i < 7; i++) this.emit(1, a.x, a.y, Math.cos(i * 0.9) * 70, Math.sin(i * 0.9) * 70 - 30, 0.7, 5, i % 2 ? GOLD : RED);
  }

  private pop(kind: Kind): number {
    const p = this.pulse[kind] ?? 0;
    return 1 + 0.35 * Math.sin(p * Math.PI);
  }

  frame(dt: number): void {
    this.time += dt;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    resetFrame();
    const a = 1 - Math.exp(-dt * 3);
    this.k += (this.targetK - this.k) * a;
    this.cx += (this.targetCx - this.cx) * a;
    this.cy += (this.targetCy - this.cy) * a;
    this.band += (this.bandT - this.band) * a;
    if (Math.abs(this.bandT - this.band) < 0.5) this.band = this.bandT;
    for (const key of Object.keys(this.pulse) as Kind[]) {
      const v = (this.pulse[key] ?? 0) - dt * 1.3;
      if (v <= 0) delete this.pulse[key];
      else this.pulse[key] = v;
    }
    const b = this.build;
    // 平滑状态:沉睡暗化、禁果金光
    this.sleepA += ((b.sleeping ? 1 : 0) - this.sleepA) * (1 - Math.exp(-dt * 3.2));
    if (this.sleepA < 0.003) this.sleepA = 0;
    this.goldT = Math.max(0, this.goldT - dt);
    this.goldA += ((b.bites >= 3 ? 1 : b.bites * 0.1) - this.goldA) * (1 - Math.exp(-dt * 1.6));
    // 屏幕震动(牛顿被砸)
    this.bump = Math.max(0, this.bump - dt * 2.4);
    ctx.save();
    if (this.bump > 0 && !this.reducedMotion) ctx.translate(Math.sin(this.time * 70) * this.bump * 4, Math.cos(this.time * 53) * this.bump * 3);
    // 画面高度随街道出现/消失而变:目标带高变了就重新取景
    const wantBand = this.street.has() ? Math.round(this.h * (this.w / this.h > 1.7 ? 0.46 : 0.4)) : 0;
    if (wantBand !== this.bandT) this.refit(false);
    this.updateWind(dt);
    this.updateWorld(dt);
    const hy = this.horizon();
    this.env.sky(ctx, this.w, this.h, hy, this.time, this.reducedMotion);
    this.drawBackdrop(dt, false);
    this.env.ground(ctx, this.w, this.h, hy);
    this.drawBackdrop(dt, true);
    this.drawBelt(dt);
    this.drawAppleCloud(dt);
    if (b.breeze > 0 && !this.reducedMotion) {
      wind(ctx, this.w, (this.h - this.band - BELT) * 0.7, this.time * (1 + Math.min(1.2, b.breeze * 0.03)), Math.min(16, 2 + Math.ceil(b.breeze * 0.45)));
      this.drawGust();
    }
    // 摇晃:点击的强度 + 微风带来的持续摆动
    const idle = this.reducedMotion ? 0 : 0.012 + Math.min(0.03, b.breeze * 0.0025);
    const amp = idle + (this.reducedMotion ? 0 : this.shake * 0.05);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    for (let i = 0; i < this.kick.length; i++) this.kick[i] = Math.max(0, this.kick[i] - dt * 1.6);
    const shakerN = b.shaker > 0 ? Math.min(this.count, 1 + Math.floor((b.shaker - 1) / 3)) : 0;
    // 由后向前画
    for (let row = ROW_CAP.length - 1; row >= 0; row--) {
      for (let i = 0; i < this.count; i++) {
        const t = SLOTS[i];
        if (t.row !== row) continue;
        this.drawTree(i, t, amp, i < shakerN);
      }
    }
    this.drawHarvestGlow();
    this.drawYard(dt);
    this.drawDrones(dt);
    this.drawDrops(dt);
    this.flow.draw(ctx, this.geo, this.time);
    this.drawGold(dt);
    this.drawFairest(dt);
    this.drawStreet(dt);
    this.drawStationFx();
    this.evt.draw(ctx, this.time, this.geo);
    this.drawQuip(dt);
    this.env.nightVeil(ctx, this.w, this.h, 0);
    this.drawStationLights();
    this.env.weatherFx(ctx, this.w, this.h, this.time, this.reducedMotion);
    this.drawHarvestRing();
    ctx.restore();
    this.drawParts(dt);
    this.drawSleep(dt);
    this.drawRipples(dt);
    this.drawFloats(dt);
  }

  /** 微风:叶子随等级变多;每 25 级一阵更大的阵风(树冠整体倾斜 + 叶子哗啦飞出) */
  private updateWind(dt: number): void {
    const b = this.build;
    if (this.reducedMotion) { this.gustLean = 0; this.gustEnv = 0; return; }
    const oh = this.h - this.band;
    if (b.breeze > 0) {
      this.leafAcc += dt * Math.min(9, 0.4 + b.breeze * 0.16);
      while (this.leafAcc >= 1) {
        this.leafAcc -= 1;
        this.emit(3, -8, oh * (0.12 + Math.random() * 0.55), 80 + b.breeze * 3 + Math.random() * 60, -14 + Math.random() * 28, 4.5, Math.max(3.5, 0.026 * this.k), '#fff');
      }
    }
    const lv = Math.floor(b.breeze / 25);
    if (lv > 0) {
      if (this.gustT < 0) {
        this.gustNext -= dt;
        if (this.gustNext <= 0) {
          this.gustT = 0;
          this.gustN = lv;
          this.gustNext = Math.max(7, 17 - lv * 1.5) + Math.random() * 4;
          const nl = Math.min(34, 14 + lv * 4);
          for (let i = 0; i < nl; i++) {
            const t = SLOTS[Math.floor(Math.random() * Math.max(1, this.count))];
            this.emit(3, this.sx(t.x) + (Math.random() - 0.5) * 0.5 * this.k * t.s, this.sy(t.y) - (0.45 + Math.random() * 0.5) * this.k * t.s, 170 + Math.random() * 190, -60 + Math.random() * 90, 2.6 + Math.random(), Math.max(3.5, 0.03 * this.k), '#fff');
          }
        }
      } else {
        this.gustT += dt;
        if (this.gustT >= 2.4) this.gustT = -1;
      }
    } else this.gustT = -1;
    this.gustEnv = this.gustT >= 0 ? Math.sin((this.gustT / 2.4) * Math.PI) : 0;
    this.gustLean += (this.gustEnv * (0.05 + 0.012 * Math.min(8, this.gustN)) - this.gustLean) * (1 - Math.exp(-dt * 8));
  }

  /** 阵风的长线条,自左向右横扫过画面 */
  private drawGust(): void {
    if (this.gustEnv <= 0.02) return;
    const c = this.ctx;
    const oh = this.h - this.band;
    const p = this.gustT / 2.4;
    c.lineCap = 'round';
    c.strokeStyle = '#8a8a8a';
    for (let i = 0; i < 9; i++) {
      const x = -150 + (p * 1.5 - i * 0.045) * (this.w + 300);
      const y = oh * (0.1 + 0.07 * i) + Math.sin(p * 9 + i) * 6;
      c.globalAlpha = Math.min(1, this.gustEnv * 1.4) * 0.8;
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(x - 120 - (i % 3) * 30, y);
      c.bezierCurveTo(x - 80, y - 8, x - 40, y + 8, x, y);
      c.arc(x, y - 6, 6, Math.PI / 2, -Math.PI, true);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  /** 无人机:带小篮子在树冠间飞,最多 6 架 */
  private drawDrones(dt: number): void {
    const b = this.build;
    if (b.drone <= 0) { this.dN = 0; return; }
    const n = Math.min(6, 1 + Math.floor((b.drone - 1) / 2));
    this.dN = n;
    const c = this.ctx;
    const mid = (this.x0 + this.x1) / 2;
    const half = (this.x1 - this.x0) * 0.4;
    const sz = Math.max(16, 0.11 * this.k) * this.pop('drone');
    const reduced = this.reducedMotion;
    for (let i = 0; i < n; i++) {
      const ph = (reduced ? 0 : this.time) * (0.3 + 0.035 * i) + i * 1.9;
      const wx = mid + Math.sin(ph) * half;
      const wy = -0.28 - 0.5 * (0.5 + 0.5 * Math.sin(ph * 1.6 + i)) - (i % 3) * 0.08;
      const tilt = Math.cos(ph) * 0.22;
      const full = 0.5 + 0.5 * Math.sin(this.time * 0.5 + i * 2.3);
      const dx = this.sx(wx);
      const dy = this.sy(wy) + Math.sin(this.time * 4 + i) * 1.5;
      this.dP[i].x = dx;
      this.dP[i].y = dy + sz * 0.8;
      drone(c, dx, dy, sz, { t: this.time + i, tilt, full });
      // 采摘到苹果时的小闪光
      if (!reduced && Math.sin(ph * 1.6 + i) > 0.985 && Math.random() < 0.5) this.emit(1, dx, dy + sz * 0.9, (Math.random() - 0.5) * 30, 10, 0.5, 3, GOLD);
    }
    void dt;
  }

  /** 苹果云:树冠上方一朵云,苹果沿线飘上去,"上传中…"进度点 */
  private drawAppleCloud(dt: number): void {
    const b = this.build;
    if (b.cloud <= 0) return;
    const c = this.ctx;
    const lv = b.cloud;
    const wpx = this.k * (0.72 + Math.min(0.5, lv * 0.04)) * this.pop('cloud');
    const cx = this.sx(this.cloudX);
    const cy = this.sy(this.cloudY) + Math.sin(this.time * 0.9) * 3;
    const nf = Math.min(this.count, 3);
    const nApples = Math.min(9, 2 + Math.floor(lv / 2));
    // 连接线:从前排树冠到云底
    c.save();
    c.strokeStyle = 'rgba(120,120,120,.55)';
    c.lineWidth = 1.4;
    c.setLineDash(DASH);
    c.lineDashOffset = -this.time * 14;
    for (let i = 0; i < nf; i++) {
      const t = SLOTS[i];
      c.beginPath();
      c.moveTo(this.sx(t.x), this.sy(t.y) - 0.95 * this.k * t.s);
      c.lineTo(cx + (i - (nf - 1) / 2) * wpx * 0.14, cy + wpx * 0.2);
      c.stroke();
    }
    c.restore();
    cloud(c, cx, cy, wpx, { t: this.time, lv, prog: (this.time * 0.1) % 1 });
    // 上飘的苹果
    const r0 = Math.max(4, 0.022 * this.k);
    for (let i = 0; i < nApples; i++) {
      const t = SLOTS[i % Math.max(1, nf)];
      const p = (((this.time * 0.28 + i / nApples) % 1) + 1) % 1;
      const e = p * p * (3 - 2 * p);
      const x0 = this.sx(t.x) + ((i * 37) % 11 - 5) * 0.012 * this.k;
      const y0 = this.sy(t.y) - 0.95 * this.k * t.s;
      const x = x0 + (cx - x0) * e + Math.sin(p * 7 + i) * 4;
      const y = y0 + (cy + wpx * 0.12 - y0) * e;
      c.globalAlpha = Math.min(1, p * 8, (1 - p) * 4);
      drawApple(c, x, y, r0 * (1 - 0.45 * p), lv >= 8 && i % 3 === 0 ? GOLD : RED, 1.4);
    }
    c.globalAlpha = 1;
    void dt;
  }

  // ================= 第三轮:公开接口 =================
  /** 每个来源每秒的苹果数(含倍率;click = 玩家点击)。流水线的批量/速度由它决定。 */
  setSources(p: Record<SourceId, number>): void {
    const r = this.flow.rates;
    for (const id of Object.keys(r) as SourceId[]) r[id] = p[id] > 0 ? p[id] : 0;
  }

  /** 游戏时间(秒):驱动昼夜/季节/天气与"成熟-丰收"周期 */
  setClock(t: number): void {
    if (Number.isFinite(t)) this.clockT = t;
  }

  /** 高亮某个来源(进度条悬停):场景里对应角色弹一下,传送带上该来源的批次描边 */
  highlight(id: SourceId | null): void {
    this.flow.highlight(id);
    if (id && id !== 'click') this.pulse[id as Kind] = 1.1;
  }

  /** 随机事件:小鸟偷苹果 / 快递小哥 / 流星。cb(hit) 在点中(true)或离开(false)时调用一次 */
  spawnEvent(kind: EventKind, cb: (hit: boolean) => void): void {
    if (this.evt.active) { cb(false); return; }
    this.updateGeo();
    this.evt.spawn(kind, cb, this.geo);
  }

  get eventActive(): boolean { return this.evt.active; }

  // ================= 第三轮:世界 =================
  private updateGeo(): void {
    const g = this.geo;
    const b = this.build;
    g.w = this.w;
    g.h = this.h;
    g.beltY = this.h - this.band - 12;
    g.depotX = this.w - 34;
    g.sky = this.horizon();
    g.cloud = b.cloud > 0 ? { x: this.sx(this.cloudX), y: this.sy(this.cloudY) } : null;
    const t = SLOTS[Math.min(this.count - 1, 0)];
    g.perch.x = this.sx(t.x + 0.22 * t.s);
    g.perch.y = this.sy(t.y - 0.78 * t.s);
    const n = this.street.spots(this.stOut);
    this.stList.length = 0;
    for (let i = 0; i < n; i++) this.stList.push({ id: this.stOut[i].id, x: this.stOut[i].x });
    g.stations = this.stList;
  }

  private updateWorld(dt: number): void {
    const env = this.env;
    env.update(this.clockT, dt, this.christmas, !this.envInit);
    this.envInit = true;
    if (env.season !== this.sprSeason && this.sprArgs) {
      this.sprSeason = env.season;
      const [bb, gg] = this.sprArgs;
      this.sprites = [11, 29, 47].map((seed) => makeSprite(seed, bb, gg, CANOPY[env.season]));
    }
    const hv = harvestInfo(this.clockT);
    this.hv = hv;
    if (hv.harvesting && !this.hvPrev && this.built) {
      const p = this.crownPos();
      this.floatText(this.w / 2, Math.max(60, p.y - 10), '丰收!', '#c8920a', 28);
      for (let i = 0; i < 14; i++) this.emit(1, p.x + (Math.random() - 0.5) * this.w * 0.4, p.y, (Math.random() - 0.5) * 120, -30 - Math.random() * 60, 0.9, 3.5, GOLD);
      this.ripple(p.x, p.y);
    }
    this.hvPrev = hv.harvesting;
    this.harvA += ((hv.harvesting ? 1 : 0) - this.harvA) * (1 - Math.exp(-dt * 2.5));
    if (this.harvA < 0.004) this.harvA = 0;
    if (hv.harvesting && this.built) {
      this.harvT -= dt;
      if (this.harvT <= 0) { this.harvT = this.reducedMotion ? 0.7 : 0.22; this.dropAt(-1, 1, 0); }
    }
    this.cloudBump = Math.max(0, this.cloudBump - dt * 3);
    for (const k of Object.keys(this.stFlash)) {
      const v = this.stFlash[k] - dt * 2.2;
      if (v <= 0) delete this.stFlash[k]; else this.stFlash[k] = v;
    }
    for (const k of Object.keys(this.stCool)) {
      const v = this.stCool[k] - dt;
      if (v <= 0) delete this.stCool[k]; else this.stCool[k] = v;
    }
    this.updateGeo();
    const speed = 1 + 0.8 * this.harvA;
    this.flow.update(dt, this.geo, speed, this.reducedMotion);
    this.evt.update(dt, this.geo, this.reducedMotion);
    // 偶尔说句台词(牛顿 / 老徐)
    this.quip.t += dt;
    this.quipNext -= dt;
    if (this.quipNext <= 0 && this.built && !this.evt.active) {
      this.quipNext = 22 + Math.random() * 20;
      const b = this.build;
      const who = b.gravity && (b.gardener < 1 || this.quipI % 2 === 0) ? 'n' : b.gardener > 0 ? 'g' : '';
      if (who) {
        const L = who === 'n' ? NEWTON_LINES : GARDENER_LINES;
        this.quip.text = L[this.quipI++ % L.length];
        this.quip.id = who;
        this.quip.t = 0;
        this.quip.dur = 3.4;
      }
    }
  }

  private ripple(x: number, y: number): void {
    const r = this.ripples.find((q) => !q.on);
    if (r) { r.on = true; r.x = x; r.y = y; r.t = 0; }
  }

  private originOf(id: SourceId, out: { x: number; y: number }): void {
    const k = this.k;
    const lim = this.geo.beltY - 14;
    const pick = (a: Array<{ x: number; y: number }>, n: number): boolean => {
      if (n <= 0) return false;
      const p = a[this.oc++ % n];
      out.x = p.x;
      out.y = p.y;
      return true;
    };
    let ok = false;
    switch (id) {
      case 'gardener': ok = pick(this.gP, this.gN); break;
      case 'tractor': ok = pick(this.tP, this.tN); break;
      case 'drone': ok = pick(this.dP, this.dN); break;
      case 'express': ok = pick(this.xP, this.xN); break;
      case 'cloud':
        if (this.geo.cloud) { out.x = this.geo.cloud.x; out.y = this.geo.cloud.y + 8; ok = true; }
        break;
      case 'shaker': {
        const t = SLOTS[this.oc++ % Math.max(1, Math.min(this.count, 3))];
        out.x = this.sx(t.x) + (Math.random() - 0.5) * 0.2 * k;
        out.y = this.sy(t.y) - 0.3 * k;
        ok = true;
        break;
      }
      default: break;
    }
    if (!ok) {
      const t = SLOTS[Math.floor(Math.random() * this.count)];
      out.x = this.sx(t.x) + (Math.random() - 0.5) * 0.4 * t.s * k;
      out.y = this.sy(t.y - 0.5 * t.s);
    }
    out.x = Math.max(8, Math.min(this.geo.depotX - 24, out.x));
    out.y = Math.min(lim, out.y);
  }

  private stationPass(id: string, x: number, val: number): void {
    this.stFlash[id] = 1;
    if (this.stCool[id] > 0) return;
    this.stCool[id] = 1.1 + Math.random() * 0.8;
    const txt = STATION_TXT[id];
    if (!txt) return;
    const y = this.geo.beltY - 18;
    this.flowFx.float(x, y, id === 'stage' && this.build.cookActive ? `×${fmtN(1 + Math.log10(1 + val))}` : txt, '#444', 12);
    this.flowFx.spark(x, y + 8, GOLD, 3);
    this.pulse[KIND_OF[id as SceneId]] = Math.max(this.pulse[KIND_OF[id as SceneId]] ?? 0, 0.35);
  }

  private stationTap(id: SceneId): void {
    const lines = STATION_LINES[id];
    if (!lines) return;
    const a = this.street.anchor(id);
    this.quip.text = lines[Math.floor(Math.random() * lines.length)];
    this.quip.id = 's:' + id;
    this.quip.x = a.x;
    this.quip.y = a.y - 8;
    this.quip.t = 0;
    this.quip.dur = 2.8;
    this.pulse[KIND_OF[id]] = 0.8;
    this.stFlash[id] = 1;
    this.flowFx.spark(a.x, a.y, GOLD, 5);
  }

  private drawBelt(_dt: number): void {
    this.flow.drawBelt(this.ctx, this.geo, this.env.night, 1 + 0.8 * this.harvA);
  }

  private drawHarvestGlow(): void {
    if (this.harvA < 0.02) return;
    const p = this.crownPos();
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'lighter';
    glow(c, '#ffd25a', p.x, p.y, Math.max(this.w, this.k * 2) * 0.55, 0.22 * this.harvA * (0.85 + 0.15 * Math.sin(this.time * 4)));
    c.restore();
  }

  private drawStationFx(): void {
    const c = this.ctx;
    const y = this.geo.beltY + 4;
    for (const s of this.stList) {
      const f = this.stFlash[s.id];
      if (!(f > 0)) continue;
      c.strokeStyle = `rgba(242,183,5,${(f * 0.8).toFixed(2)})`;
      c.lineWidth = 2.5;
      c.beginPath();
      c.ellipse(s.x, y, 12 + (1 - f) * 18, 4 + (1 - f) * 5, 0, 0, TAU);
      c.stroke();
    }
  }

  private drawStationLights(): void {
    const n = this.env.night;
    if (n < 0.25 || this.stList.length === 0) return;
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const r = Math.max(26, this.band * 0.55);
    for (const s of this.stList) glow(c, '#ffcf6a', s.x, this.h - this.band * 0.45, r, 0.32 * n);
    c.restore();
  }

  private drawQuip(_dt: number): void {
    const q = this.quip;
    if (q.t >= q.dur || !q.text) return;
    const a = Math.min(1, q.t * 4, (q.dur - q.t) * 3);
    let x = q.x;
    let y = q.y;
    if (q.id === 'n') { x = this.sx(this.newton.x); y = this.sy(this.newton.y) - 0.5 * this.k; }
    else if (q.id === 'g') { x = this.gN > 0 ? this.gP[0].x : this.w / 2; y = (this.gN > 0 ? this.gP[0].y : this.sy(0.3)) - 0.4 * this.k; }
    const px = Math.max(11, Math.min(14, this.k * 0.11));
    x = Math.max(70, Math.min(this.w - 70, x));
    bubble(this.ctx, q.text, x, Math.max(30, y), px, a, '#111');
  }

  private drawHarvestRing(): void {
    const c = this.ctx;
    const hv = this.hv;
    const x = this.w - 22;
    const y = 22;
    const r = 11;
    c.save();
    c.fillStyle = 'rgba(255,255,255,.7)';
    c.beginPath();
    c.arc(x, y, r + 2, 0, TAU);
    c.fill();
    c.lineWidth = 3.5;
    c.strokeStyle = 'rgba(0,0,0,.14)';
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.stroke();
    c.lineCap = 'round';
    if (hv.harvesting) {
      c.strokeStyle = '#f2b705';
      const left = hv.leftS / 25;
      c.beginPath();
      c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * left);
      c.stroke();
      const p = 1 + 0.12 * Math.sin(this.time * 6);
      c.translate(x, y);
      c.scale(p, p);
      goldApple(c, 0, 1, 4);
    } else {
      c.strokeStyle = '#6fbf4a';
      c.beginPath();
      c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * hv.ripe);
      c.stroke();
      c.fillStyle = hv.ripe > 0.85 ? RED : '#8ccf5f';
      c.beginPath();
      c.arc(x, y + 1, 3.6, 0, TAU);
      c.fill();
    }
    c.restore();
  }

  /** 地平线(屏幕 y):最后一排树之上留一段天空 */
  private horizon(): number {
    let minY = 0;
    for (let i = 0; i < this.count; i++) minY = Math.min(minY, SLOTS[i].y);
    const oh = this.h - this.band - BELT;
    return Math.max(oh * 0.2, Math.min(oh * 0.82, this.sy(minY - 0.12)));
  }

  /** front=false:天空物件(云/远山/鸟);front=true:前景氛围(萤火虫/落叶) */
  private drawBackdrop(dt: number, front: boolean): void {
    const c = this.ctx;
    const oh = this.h - this.band - BELT;
    const reduced = this.reducedMotion;
    const env = this.env;
    if (!front) {
      // 飘过的云:阴雨天更多更暗,夜里变深色
      const cloudy = env.cloudA;
      const nc = 3 + Math.round(cloudy * 2);
      const col = env.night > 0.5 ? '#6d779c' : cloudy > 0.6 ? '#d3d8e2' : '#fff';
      c.lineWidth = 1.6;
      c.strokeStyle = env.night > 0.5 ? '#3d4666' : '#b5b5b5';
      for (let i = 0; i < nc; i++) {
        const cw = oh * (0.2 + 0.05 * (i % 3));
        const px = ((((reduced ? 0 : this.time) * (0.006 + 0.003 * (i % 3)) + i * 0.37) % 1) + 1) % 1;
        const x = -cw + px * (this.w + cw * 2);
        const y = oh * (0.09 + 0.06 * (i % 3)) + (i === 1 ? oh * 0.06 : 0);
        c.fillStyle = col;
        c.globalAlpha = 0.55 + 0.45 * Math.min(1, 0.6 + cloudy);
        c.beginPath();
        c.moveTo(x - cw * 0.5, y);
        c.arc(x - cw * 0.28, y - cw * 0.1, cw * 0.2, Math.PI * 0.95, Math.PI * 1.9);
        c.arc(x + cw * 0.04, y - cw * 0.2, cw * 0.26, Math.PI * 1.2, Math.PI * 1.95);
        c.arc(x + cw * 0.3, y - cw * 0.06, cw * 0.18, Math.PI * 1.35, Math.PI * 0.45);
        c.lineTo(x - cw * 0.5, y + cw * 0.12);
        c.closePath();
        c.fill();
        c.stroke();
      }
      c.globalAlpha = 1;
      // 鸟群:白天偶尔飞过
      if (!reduced && env.night < 0.5) {
        if (this.birdP < 0) {
          this.birdT -= dt;
          if (this.birdT <= 0) { this.birdP = 0; this.birdT = 16 + Math.random() * 16; }
        } else {
          this.birdP += dt / 10;
          if (this.birdP >= 1) this.birdP = -1;
          else {
            c.strokeStyle = '#111';
            c.lineWidth = 2;
            const bp = this.birdP;
            for (let i = 0; i < 3; i++) {
              const bx = -30 + (bp * 1.1 - i * 0.025) * (this.w + 60);
              const by = oh * 0.22 + Math.sin(bp * 7 + i) * 8 + i * 9;
              bird(c, bx, by, Math.max(6, oh * 0.028), this.time * 1.2 + i);
            }
          }
        }
      }
      // 远山:树多了才出现
      if (this.count >= 7) {
        const hy = this.horizon();
        c.fillStyle = env.night > 0.5 ? '#39425f' : env.season === 3 ? '#f4f8ff' : env.season === 2 ? '#f1e2bb' : '#eaf2e4';
        c.strokeStyle = '#111';
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(0, hy + 2);
        for (let x = 0; x <= this.w; x += 8) c.lineTo(x, hy - oh * (0.07 + 0.03 * Math.sin(x / this.w * 5 + 1) + 0.02 * Math.sin(x / this.w * 13)));
        c.lineTo(this.w, hy + 2);
        c.closePath();
        c.fill();
        c.stroke();
      }
      return;
    }
    if (reduced) return;
    // 萤火虫:夜里的夏秋(平安夜是雪,不画)
    if (!this.christmas && env.night > 0.3 && env.season < 3) {
      for (let i = 0; i < 8; i++) {
        const fx = this.w * (0.08 + 0.84 * ((i * 0.381) % 1)) + Math.sin(this.time * 0.5 + i * 3) * 20;
        const fy = oh * (0.5 + 0.38 * ((i * 0.618) % 1)) + Math.cos(this.time * 0.7 + i) * 12;
        const a = (0.2 + 0.5 * Math.pow(0.5 + 0.5 * Math.sin(this.time * 1.9 + i * 1.7), 2)) * Math.min(1, env.night * 1.4);
        glow(c, GOLD, fx, fy, 9, a);
        c.fillStyle = `rgba(255,230,120,${(a + 0.3).toFixed(2)})`;
        c.beginPath();
        c.arc(fx, fy, 1.4, 0, TAU);
        c.fill();
      }
    }
    // 偶尔飘落的叶子(秋天多一点)
    this.ambLeafT -= dt;
    if (this.ambLeafT <= 0) {
      this.ambLeafT = (env.season === 2 ? 0.6 : 1.6) + Math.random() * 2.2;
      this.emit(3, Math.random() * this.w, -6, 14 + Math.random() * 20, 18, 7, Math.max(3, 0.022 * this.k), env.season === 2 ? '#e8a23a' : '#fff');
    }
  }

  private drawTree(i: number, t: Slot, amp: number, hasShaker: boolean): void {
    const c = this.ctx;
    const age = this.time - (this.born[i] ?? 0);
    const g = i === 0 ? 1 : Math.min(1, age / 0.9);
    const e = g >= 1 ? 1 : 1 - Math.pow(1 - g, 3) * (1 + 2 * (1 - g)); // 弹出
    const hpx = this.k * t.s * e * (1 + 0.05 * Math.sin((this.pulse.branches ?? 0) * Math.PI));
    if (hpx < 2) return;
    const wpx = hpx * (SW / SH);
    const x = this.sx(t.x);
    const y = this.sy(t.y);
    const delay = (i % 5) * 0.03;
    const sway = Math.cos((2 * Math.PI * (this.time - delay)) / SWAY_S);
    let ang = amp * sway * (i === 0 ? 1 : 0.7) + this.gustLean * (0.85 + 0.15 * sway);
    if (!this.reducedMotion) {
      ang += this.kick[i] * 0.05 * Math.cos(this.time * 22);
      if (hasShaker) ang += Math.sin(this.time * 46 + i) * 0.007;
    }
    // 地面与阴影
    c.fillStyle = 'rgba(0,0,0,0.07)';
    c.beginPath();
    c.ellipse(x, y, wpx * 0.33, hpx * 0.05, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#111';
    c.lineWidth = Math.max(1, 2 * t.s);
    c.beginPath();
    c.moveTo(x - wpx * 0.42, y);
    c.lineTo(x + wpx * 0.42, y);
    c.stroke();
    // 树
    const spr = this.sprites[i % this.sprites.length];
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    if (i % 2 === 1) c.scale(-1, 1);
    c.drawImage(spr, -wpx / 2, -hpx + (hpx * 10) / SH, wpx, hpx);
    // 成熟度:没熟的苹果盖一层青绿色(随 ripe 渐变成红)
    const ripe = this.hv.ripe;
    if (ripe < 0.985 && spr.apl.length) {
      const sxs = wpx / SW;
      const sys = hpx / SH;
      const ox = -wpx / 2;
      const oy = -hpx + (hpx * 10) / SH;
      c.fillStyle = '#8ccf5f';
      c.strokeStyle = '#111';
      c.lineWidth = Math.max(1, 2.4 * sxs);
      c.globalAlpha = Math.min(1, (1 - ripe) * 1.25);
      const n = Math.min(spr.apl.length, 14);
      for (let q = 0; q < n; q++) {
        const [ax, ay, ar] = spr.apl[q];
        c.beginPath();
        c.arc(ox + ax * sxs, oy + ay * sys, ar * sxs * (0.78 + 0.2 * ripe), 0, TAU);
        c.fill();
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    c.restore();
    // 摇树机夹在树干上
    if (hasShaker) {
      const s = 0.1 * this.k * t.s * (1 + 0.5 * Math.sin((this.pulse.shaker ?? 0) * Math.PI));
      shakerBox(c, x + 0.1 * hpx * Math.sin(ang), y - 0.2 * hpx, s, this.time);
    }
    // 圣诞:主树挂彩灯 + 顶星
    if (this.christmas && i === 0) {
      const cy = y - 0.57 * hpx;
      const lr = Math.max(2, 0.014 * this.k);
      for (let j = 0; j < 16; j++) {
        const an = (j / 16) * TAU;
        const lx = x + Math.cos(an) * wpx * 0.3;
        const ly = cy + Math.sin(an) * hpx * 0.22;
        const lit = this.reducedMotion || Math.sin(this.time * 4 + j * 1.9) > -0.2;
        const col = j % 3 === 0 ? RED : j % 3 === 1 ? GOLD : '#ffffff';
        c.globalAlpha = lit ? 1 : 0.25;
        if (lit) glow(c, col === '#ffffff' ? '#ffe9a0' : col, lx, ly, lr * 3.2, 0.7);
        c.fillStyle = col;
        c.strokeStyle = '#111';
        c.lineWidth = 1;
        c.beginPath();
        c.arc(lx, ly, lr, 0, TAU);
        c.fill();
        c.stroke();
      }
      c.globalAlpha = 1;
      glow(c, GOLD, x, y - 0.9 * hpx, 0.1 * this.k, 0.8);
      c.fillStyle = GOLD;
      c.strokeStyle = '#111';
      c.lineWidth = 1.4;
      sparklePath(c, x, y - 0.9 * hpx, 0.055 * this.k, this.time * 0.6);
      c.fill();
      c.stroke();
    }
  }

  /** 院子:筐、牛顿、园丁、卡车 */
  private drawYard(dt: number): void {
    const c = this.ctx;
    const k = this.k;
    const b = this.build;
    // 筐
    const nb = this.basketX.length;
    for (let i = 0; i < nb; i++) {
      const fill = Math.max(0, Math.min(15, Math.round(b.shake * 1.2) - i * 6));
      basket(c, this.sx(this.basketX[i]), this.sy(0.38), k * this.pop('shake'), fill);
    }
    // 牛顿
    if (b.gravity) this.drawNewton(dt);
    // 园丁:最多画 5 个,多了在旁边标 ×N
    const people = b.gardener;
    const gn = people > 0 ? Math.min(3, this.spots.length, people) : 0;
    this.gN = gn;
    while (this.gCycle.length < gn) this.gCycle.push(0);
    const gh = 0.36 * k * this.pop('gardener');
    const glv = people >= 50 ? 2 : people >= 25 ? 1 : 0;
    for (let j = 0; j < gn; j++) {
      const sp = this.spots[j];
      const cyc = (((this.time * 0.36 + j * 0.37) % 1) + 1) % 1;
      const reach = cyc < 0.3 ? Math.sin((cyc / 0.3) * Math.PI) : 0;
      const wipe = cyc > 0.68 && cyc < 0.92 ? Math.sin(((cyc - 0.68) / 0.24) * Math.PI) : 0;
      if (this.gCycle[j] < 0.15 && cyc >= 0.15 && cyc < 0.5 && sp.tree < this.count) {
        this.kick[sp.tree] = Math.max(this.kick[sp.tree], 1);
        this.dropAt(sp.tree, 1);
        if (!this.reducedMotion) {
          const t = SLOTS[sp.tree];
          for (let q = 0; q < 3; q++) this.emit(0, this.sx(t.x) + (Math.random() - 0.5) * 0.4 * k * t.s, this.sy(t.y) - 0.7 * k * t.s, (Math.random() - 0.5) * 50, -10, 1.2, Math.max(3, 0.025 * k), '#fff');
        }
      }
      this.gCycle[j] = cyc;
      const moving = reach === 0 && wipe === 0 && !this.reducedMotion;
      const off = this.reducedMotion ? 0 : Math.sin(this.time * 0.6 + j * 2) * 0.04;
      const gx = this.sx(sp.x + off);
      const gy = this.sy(sp.y);
      this.gP[j].x = gx;
      this.gP[j].y = gy - gh * 0.55;
      if (j === 0) bucket(c, gx - sp.dir * 0.17 * k, gy + 0.01 * k, 0.11 * k);
      gardener(c, gx, gy, gh, { t: this.time + j * 0.7, dir: sp.dir, walk: moving ? this.time * 6 + j : -1, reach, wipe, xmas: this.christmas, lv: glv });
      if (j === gn - 1 && people > gn) {
        const lx = gx + 0.15 * k;
        const ly = gy - 0.03 * k;
        c.font = `800 ${Math.max(14, Math.min(22, 0.11 * k))}px ${FONT}`;
        c.textAlign = 'center';
        c.lineWidth = 4;
        c.strokeStyle = '#fff';
        c.lineJoin = 'round';
        c.strokeText(`×${people}`, lx, ly);
        c.fillStyle = RED;
        c.fillText(`×${people}`, lx, ly);
      }
    }
    // 拖拉机:拖着苹果箱在院子里来回开(最多 3 台,各占一条车道)
    const tn = b.tractor > 0 ? Math.min(3, 1 + Math.floor((b.tractor - 1) / 3)) : 0;
    this.tN = tn;
    for (let j = 0; j < tn; j++) {
      const span = this.x1 - this.x0 + 0.5;
      const p = ((((this.time * (0.05 + 0.012 * j)) + j * 0.37) % 1) + 1) % 1;
      const u = p < 0.5 ? p * 2 : 2 - p * 2;
      const wx = this.x0 - 0.15 + u * span;
      this.tP[j].x = this.sx(wx);
      this.tP[j].y = this.sy(0.62 + 0.06 * j) - 0.1 * k;
      tractor(c, this.sx(wx), this.sy(0.62 + 0.06 * j), 0.26 * k * this.pop('tractor'), { t: this.time * (this.reducedMotion ? 0 : 1) + j, dir: p < 0.5 ? 1 : -1, crates: 2 + Math.min(4, Math.floor(b.tractor / 3)) });
    }
    // 卡车:沿路来回开
    this.xN = 0;
    if (b.express > 0) {
      const n = Math.min(4, 1 + Math.floor((b.express - 1) / 3));
      const span = this.x1 - this.x0 + 0.9;
      const speed = 0.55;
      const pop = this.pop('express');
      for (let j = 0; j < n; j++) {
        const p = ((((this.time * speed) / span + j / n) % 1) + 1) % 1;
        const wx = this.x0 - 0.45 + p * span;
        const wheel = this.time * 10;
        if (j < 4) { this.xP[j].x = this.sx(wx); this.xP[j].y = this.sy(ROAD_Y) - 0.15 * k; this.xN = j + 1; }
        truck(c, this.sx(wx), this.sy(ROAD_Y), k * pop, wheel, b.express / 4);
      }
    }
  }

  private drawNewton(dt: number): void {
    const c = this.ctx;
    const k = this.k;
    const nw = this.newton;
    const x = this.sx(nw.x);
    const y = this.sy(nw.y);
    const wp = this.pop('gravity');
    const h = 0.56 * k * wp;
    const headY = y - h * 0.85;
    // 落下的苹果
    if (nw.falling) {
      nw.vy += 3.4 * dt;
      nw.ay += nw.vy * dt;
      const ay = this.sy(nw.ay);
      if (ay >= headY) {
        nw.falling = false;
        nw.hitT = 0;
        this.kick[0] = Math.max(this.kick[0], 0.7);
        this.shake = Math.min(1, this.shake + 0.25);
        this.bump = 1;
        // 苹果弹开
        const d = this.drops.find((q) => !q.on);
        if (d) Object.assign(d, { on: true, x: nw.x + 0.02, y: nw.y - 0.56 * 0.85, gy: nw.y + 0.14, vx: -0.75, vy: -2.3, r: 0.035, rest: 0, color: RED });
        if (!this.reducedMotion) for (let i = 0; i < 6; i++) this.emit(1, x, headY, Math.cos(i * 1.05) * 80, Math.sin(i * 1.05) * 80 - 40, 0.6, 5, GOLD);
      } else {
        drawApple(c, x, ay, Math.max(5, 0.04 * k), RED, 1.8);
      }
    }
    let hit = 0;
    if (nw.hitT >= 0) {
      nw.hitT += dt;
      hit = nw.hitT < 0.08 ? nw.hitT / 0.08 : Math.max(0, 1 - (nw.hitT - 0.08) / 1.3);
      hit = Math.pow(hit, 1.4);
      if (nw.hitT > 1.6) nw.hitT = -1;
    }
    newton(c, x, y, h, { t: this.time, hit });
    if (nw.hitT >= 0 && nw.hitT < 1.4) {
      const al = Math.min(1, (1.4 - nw.hitT) * 3);
      bubble(c, '哎哟!', x + 0.02 * k, headY - h * 0.2 - Math.min(nw.hitT, 0.3) * 10, Math.max(12, Math.min(17, 0.07 * k)), al);
    }
  }

  private drawDrops(dt: number): void {
    const c = this.ctx;
    this.overflow = 0;
    for (const d of this.drops) {
      if (!d.on) continue;
      d.vy += 4.5 * dt;
      d.y += d.vy * dt;
      d.x += d.vx * dt;
      if (d.y >= d.gy - d.r) {
        d.y = d.gy - d.r;
        if (d.vy > 0.6) d.vy *= -0.35;
        else {
          d.vy = 0;
          d.vx = 0;
          d.rest += dt;
          if (d.rest > 0.9) d.on = false;
        }
      }
      const alpha = d.rest > 0.6 ? 1 - (d.rest - 0.6) / 0.3 : 1;
      c.globalAlpha = Math.max(0, alpha);
      const px = this.sx(d.x);
      const py = this.sy(d.y);
      const pr = Math.max(4, d.r * this.k);
      if (d.color === GOLD) glow(c, GOLD, px, py, pr * 3, 0.8);
      drawApple(c, px, py, pr, d.color, 1.5);
      c.globalAlpha = 1;
    }
  }

  /** 禁果咬满 3 口后,整个果园被金色光芒笼罩;金光里有零星火花 */
  private drawGold(dt: number): void {
    if (this.goldA < 0.02) return;
    const c = this.ctx;
    const oh = this.h - this.band;
    glow(c, GOLD, this.w / 2, oh * 0.5, Math.max(this.w, oh) * 0.85, this.goldA * (0.32 + (this.goldT > 0 ? 0.25 : 0)));
    if (this.goldA > 0.5 && !this.reducedMotion && Math.random() < dt * 4) {
      this.emit(1, Math.random() * this.w, oh * (0.2 + Math.random() * 0.6), (Math.random() - 0.5) * 20, -25, 1.4, 4 + Math.random() * 3, GOLD);
    }
  }

  private drawFairest(dt: number): void {
    const c = this.ctx;
    // 点中后的金色爆开:光环 + 放射星芒(约 0.8 秒)
    if (this.goldFlash > 0) {
      const g = this.goldFlash;
      const p = 1 - g;
      glow(c, GOLD, this.goldX, this.goldY, 40 + p * 150, g);
      c.strokeStyle = GOLD;
      c.lineWidth = 3 * g + 0.5;
      c.globalAlpha = g;
      for (let i = 0; i < 12; i++) {
        const an = (i / 12) * TAU + p * 0.8;
        c.beginPath();
        c.moveTo(this.goldX + Math.cos(an) * (20 + p * 50), this.goldY + Math.sin(an) * (20 + p * 50));
        c.lineTo(this.goldX + Math.cos(an) * (34 + p * 110), this.goldY + Math.sin(an) * (34 + p * 110));
        c.stroke();
      }
      c.globalAlpha = 1;
      this.goldFlash = Math.max(0, g - dt * 1.3);
    }
    const f = this.fairest;
    if (!f) return;
    f.life -= dt;
    if (f.life <= 0) { this.fairest = null; return; }
    const r = Math.max(20, 0.07 * this.k);
    const x = this.sx(f.x);
    const y = this.sy(f.y) + Math.sin(this.time * 3) * 4;
    const born = Math.min(1, (12 - f.life) * 3);
    const sc = born < 1 ? 1 - Math.pow(1 - born, 3) * 0.6 : 1 + 0.04 * Math.sin(this.time * 6);
    // 拖尾:向下飘落的金色小星
    if (!this.reducedMotion) {
      this.trailT += dt;
      while (this.trailT > 0.07) {
        this.trailT -= 0.07;
        this.emit(1, x + (Math.random() - 0.5) * r, y + r * 0.5, (Math.random() - 0.5) * 16, 24 + Math.random() * 20, 0.8, 2 + Math.random() * 3.4, Math.random() < 0.4 ? '#fff6c4' : GOLD);
      }
    }
    glow(c, GOLD, x, y, r * 3.6, 0.9);
    // 旋转星芒:长短相间的尖锐光线
    c.save();
    c.translate(x, y);
    c.rotate(this.time * 0.7);
    c.fillStyle = 'rgba(242,183,5,.5)';
    for (let i = 0; i < 12; i++) {
      c.rotate(TAU / 12);
      const L = r * (i % 2 ? 1.85 : 2.5);
      c.beginPath();
      c.moveTo(-r * 0.12, -r * 1.1);
      c.lineTo(0, -L);
      c.lineTo(r * 0.12, -r * 1.1);
      c.closePath();
      c.fill();
    }
    c.restore();
    goldApple(c, x, y, r * sc);
    // 环绕的闪光
    c.fillStyle = '#fff';
    c.strokeStyle = GOLD;
    c.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const ph = (this.time * 0.8 + i / 3) % 1;
      const an = i * 2.1 + this.time * 1.4;
      sparklePath(c, x + Math.cos(an) * r * 1.5, y + Math.sin(an) * r * 1.3, r * 0.22 * Math.sin(ph * Math.PI), this.time * 2);
      c.fill();
      c.stroke();
    }
  }

  /** 景点街:底部带。各项目的小场景从左到右,窄屏自动摇移 */
  private drawStreet(dt: number): void {
    if (this.band < 2) return;
    const c = this.ctx;
    const top = this.h - this.band;
    // 街道与果园是同一片地面:只在景点后面铺一层很淡的亮色,让黑色线稿更清楚
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.fillRect(-12, top, this.w + 24, this.band + 12);
    this.street.draw(c, this.w, this.h, this.band, this.time, dt, this.build, this.popOf, this.reducedMotion);
  }

  /** 叶子 / 火花 / 雪 */
  private drawParts(dt: number): void {
    const c = this.ctx;
    if (this.christmas && !this.reducedMotion) {
      this.snowT += dt;
      while (this.snowT > 0.14) {
        this.snowT -= 0.14;
        this.emit(2, Math.random() * this.w, -4, (Math.random() - 0.5) * 12, 22 + Math.random() * 22, 7, 1.4 + Math.random() * 1.6, '#cfd9ea');
      }
    }
    c.lineWidth = 1.2;
    for (const p of this.parts) {
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      const al = Math.min(1, p.life / (p.max * 0.4));
      if (p.kind === 0) {
        p.vy += 150 * dt;
        p.vx *= 0.985;
      } else if (p.kind === 3) {
        p.vy += (22 + Math.sin(this.time * 3 + p.rot) * 40) * dt;
        p.vx *= 0.997;
      } else if (p.kind === 1) {
        p.vy += 90 * dt;
      } else {
        p.vx += Math.sin(this.time * 1.3 + p.rot) * 10 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      c.globalAlpha = al;
      if (p.kind === 0 || p.kind === 3) {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillStyle = p.color;
        c.strokeStyle = '#111';
        c.beginPath();
        c.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, TAU);
        c.fill();
        c.stroke();
        c.beginPath();
        c.moveTo(-p.size, 0);
        c.lineTo(p.size, 0);
        c.stroke();
        c.restore();
      } else if (p.kind === 1) {
        c.fillStyle = p.color;
        sparklePath(c, p.x, p.y, p.size, p.rot);
        c.fill();
      } else {
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, TAU);
        c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  /** 女巫苹果的沉睡:整幅画面变暗变蓝,月亮、星星、Zzz 与白雪公主的玻璃棺 */
  private drawSleep(dt: number): void {
    const a = this.sleepA;
    if (a <= 0) return;
    void dt;
    const c = this.ctx;
    c.fillStyle = `rgba(14,24,70,${(0.66 * a).toFixed(3)})`;
    c.fillRect(0, 0, this.w, this.h);
    const oh = this.h - this.band;
    // 星星
    c.fillStyle = '#fff';
    for (const s of STARS) {
      c.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(this.time * 1.5 + s[2])));
      c.beginPath();
      c.arc(s[0] * this.w, s[1] * oh * 0.7, 1.3, 0, TAU);
      c.fill();
    }
    // 月牙
    c.globalAlpha = a;
    const mr = Math.max(12, oh * 0.07);
    const mx = this.w * 0.14;
    const my = oh * 0.17;
    c.save();
    c.beginPath();
    c.arc(mx, my, mr, 0, TAU);
    c.clip();
    c.beginPath();
    c.arc(mx, my, mr, 0, TAU);
    c.arc(mx + mr * 0.5, my - mr * 0.15, mr * 0.88, 0, TAU);
    c.fillStyle = '#f6efc2';
    c.fill('evenodd');
    c.restore();
    c.globalAlpha = 1;
    // 玻璃棺
    const kk = Math.max(0.85, Math.min(1.7, oh / 140));
    snowWhite(c, this.w / 2, oh * 0.93, kk, this.time, a);
  }

  /** 购买升级时,在对应物件处扩散一圈红色涟漪 */
  private drawRipples(dt: number): void {
    const c = this.ctx;
    for (const r of this.ripples) {
      if (!r.on) continue;
      r.t += dt;
      if (r.t > 0.8) { r.on = false; continue; }
      const p = r.t / 0.8;
      c.globalAlpha = 1 - p;
      c.strokeStyle = RED;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(r.x, r.y, 12 + p * 0.22 * this.k, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
    }
  }

  private drawFloats(dt: number): void {
    const c = this.ctx;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const f of this.floats) {
      if (!f.on) continue;
      f.life -= dt * 0.9;
      f.y += f.vy * dt;
      f.vy *= 0.97;
      if (f.life <= 0) { f.on = false; continue; }
      c.globalAlpha = Math.min(1, f.life * 1.6);
      c.font = `700 ${f.size}px ${FONT}`;
      c.lineWidth = 4;
      c.strokeStyle = '#fff';
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y);
      c.globalAlpha = 1;
    }
  }
}
