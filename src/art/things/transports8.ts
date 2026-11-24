// v6 运输 8 档 × 2 分支 + 4 段式行程(装货→行驶→卸货→返回,等时匀速)+ 车队排布。
// 分支 0 = 经典造型;分支 1 = 搞笑造型(transport-v6.ts)。底盘语义一致:同 opts、同宽度量级,可随时互换。
import { drawBasket, drawCart, drawPlane, drawPortal, drawShip, drawTruck } from './transport.ts';
import { drawHelicopter, drawPorter } from './transport-extra.ts';
import { drawBamboo, drawDogBasket, drawDonkey, drawDuckBoat, drawMagicHat, drawPaperPlane, drawStrongman, drawTrike } from './transport-v6.ts';
import { clamp, ease, INK } from './ink.ts';
import type { ThingFn, ThingOpt } from './types.ts';

export const TRANSPORT8_ORDER = ['basket', 'porter', 'cart', 'truck', 'ship', 'helicopter', 'plane', 'portal'] as const;
export type Transport8Kind = (typeof TRANSPORT8_ORDER)[number];
export const TRANSPORT8_NAMES: readonly string[] = ['篮子', '挑扁担工', '小推车', '卡车', '货船', '直升机', '飞机', '传送门'];
/** [分支0名, 分支1名] */
export const TRANSPORT8_BRANCH_NAMES: readonly (readonly [string, string])[] = [
  ['提篮', '背篓狗'],
  ['挑扁担工', '驴驮篓'],
  ['手推车', '三轮小孩'],
  ['大卡车', '大板车壮汉'],
  ['货轮', '小黄鸭船'],
  ['直升机', '竹蜻蜓小孩'],
  ['飞机', '大纸飞机'],
  ['传送门', '魔术帽'],
];
/** 每档每分支世界宽度 [b0, b1],含车头/司机(板车壮汉含人) */
export const TRANSPORT8_W: readonly (readonly [number, number])[] = [
  [18, 24], [36, 40], [34, 36], [70, 88], [80, 92], [76, 52], [84, 90], [44, 44],
];
export const TRANSPORT8_FLIES: readonly boolean[] = [false, false, false, false, false, true, true, false];
/** 建议单程时长(秒)基准,越高档越快:eng 可 ×(距离/基准距离) */
export const TRANSPORT8_SPEED: readonly number[] = [14, 18, 24, 40, 32, 52, 70, 120]; // 世界单位/秒(匀速)
/** 建议载量(苹果数/趟) */
export const TRANSPORT8_CAP: readonly number[] = [5, 10, 8, 40, 60, 30, 80, 150];

const FN: Record<Transport8Kind, readonly [ThingFn, ThingFn]> = {
  basket: [drawBasket, drawDogBasket],
  porter: [drawPorter, drawDonkey],
  cart: [drawCart, drawTrike],
  truck: [drawTruck, drawStrongman],
  ship: [drawShip, drawDuckBoat],
  helicopter: [drawHelicopter, drawBamboo],
  plane: [drawPlane, drawPaperPlane],
  portal: [drawPortal, drawMagicHat],
};

export function transport8Index(kind: Transport8Kind | number): number {
  return typeof kind === 'number' ? clamp(Math.floor(kind), 0, 7) : Math.max(0, TRANSPORT8_ORDER.indexOf(kind));
}

/** 统一入口:tier=档位(名字/0..7),branch=0|1(默认 0)。 */
export function drawTransport8(ctx: CanvasRenderingContext2D, tier: Transport8Kind | number, branch: 0 | 1, x: number, y: number, s: number, o: ThingOpt = {}): void {
  const i = transport8Index(tier);
  FN[TRANSPORT8_ORDER[i]][branch ? 1 : 0](ctx, x, y, s, o);
}

/* ───────── 行程:装货 → 行驶 → 卸货 → 返回(四段等时) ───────── */
export type RunPhaseName = 'load' | 'go' | 'unload' | 'back';
export interface RunState {
  phase: 0 | 1 | 2 | 3;
  name: RunPhaseName;
  /** 段内进度 0..1 */
  k: number;
  /** 沿轨道位置 0(起点)..1(终点),行驶段线性匀速 */
  pos: number;
  dir: 1 | -1;
  /** 可直接作为 ThingOpt 展开的字段 */
  o: ThingOpt;
}
const PH: RunPhaseName[] = ['load', 'go', 'unload', 'back'];

/** u = 周期进度 0..1(自动取模)。四段各占 1/4。装货段 load 0→1(苹果逐个上车 + 颠一下),卸货段 unload 0→1(苹果逐个飞出),返回空车。 */
export function runPhase(u: number, flies = false): RunState {
  u = ((u % 1) + 1) % 1;
  const ph = Math.min(3, Math.floor(u * 4)) as 0 | 1 | 2 | 3;
  const k = u * 4 - ph;
  const o: ThingOpt = {};
  let pos = 0;
  let dir: 1 | -1 = 1;
  if (ph === 0) {
    o.load = k; o.move = 0; pos = 0;
    o.pulse = (k * 6) % 1; // 每装一批颠一下
  } else if (ph === 1) {
    o.load = 1; o.move = 1; pos = k;
  } else if (ph === 2) {
    o.load = 1; o.unload = k; o.move = 0; pos = 1;
    o.pulse = (k * 6) % 1;
  } else {
    o.load = 0; o.move = 1; pos = 1 - k; dir = -1;
  }
  // 飞行类:起降两头各占 15% 的段内时间抬升/降落
  if (flies) {
    const lift = ph === 1 ? Math.min(ease(clamp(k / 0.18, 0, 1)), ease(clamp((1 - k) / 0.18, 0, 1))) : ph === 3 ? Math.min(ease(clamp(k / 0.18, 0, 1)), ease(clamp((1 - k) / 0.18, 0, 1))) : 0;
    o.fly = lift;
  }
  o.dir = dir;
  return { phase: ph, name: PH[ph], k, pos, dir, o };
}

/* ───────── 车队:均分相位、最多 4 辆 + ×N ───────── */
export interface FleetOpt extends ThingOpt {
  /** 车辆总数(≥1);>4 只画 4 辆并在头车旁标 ×N */
  n?: number;
  /** 一整圈(四段)秒数,默认 8 */
  cycle?: number;
  /** 画布字体(×N) */
  font?: string;
  /** 轨道 x0(装货端)与 x1(卸货端) */
  x0?: number;
  x1?: number;
  branch?: 0 | 1;
  /** 返回车道相对去程下移的世界单位(默认 4),避免同轨迎面重叠 */
  backLane?: number;
}
export const FLEET_MAX = 4;

/** 在 [x0,x1] 轨道(y 为地面)上画车队;相位均分 ⇒ 等间距;返回绘制的辆数。*/
export function drawFleet(ctx: CanvasRenderingContext2D, tier: Transport8Kind | number, y: number, s: number, o: FleetOpt): number {
  const total = Math.max(1, Math.floor(o.n ?? 1));
  const shown = Math.min(total, FLEET_MAX);
  const t = o.t ?? 0;
  const cycle = o.cycle ?? 8;
  const x0 = o.x0 ?? 0, x1 = o.x1 ?? 200;
  const flies = TRANSPORT8_FLIES[transport8Index(tier)];
  let headX = x0;
  let headOffset = 1;
  for (let i = 0; i < shown; i++) {
    const u = t / cycle + i / shown;
    const r = runPhase(u, flies);
    const x = x0 + (x1 - x0) * r.pos;
    drawTransport8(ctx, tier, o.branch ?? 0, x, y + (r.phase === 3 && !flies ? (o.backLane ?? 4) * s : 0), s, { ...r.o, t: t + i * 0.37, seed: (o.seed ?? 1) + i * 7 });
    if (r.phase !== 3 && x > headX - 1e-6 && i === 0) { headX = x; headOffset = r.phase; }
  }
  if (total > shown) {
    ctx.save();
    ctx.font = o.font ?? 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    const lx = x0 - (TRANSPORT8_W[transport8Index(tier)][o.branch ?? 0] / 2 + 12) * s;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fffaf0';
    ctx.fillStyle = INK;
    ctx.strokeText('×' + total, lx, y - 6);
    ctx.fillText('×' + total, lx, y - 6);
    ctx.restore();
  }
  void headX; void headOffset;
  return shown;
}
