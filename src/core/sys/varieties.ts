// 苹果品种与状态。按"期望价值"进数值:不逐个存苹果,只在掉落时抽样一个样本(给画面/订单/图鉴用)。
// rollApple 返回的 value 已按当前情境归一:E[value] = 1,所以品种只带来方差,不改平均收入。
import { APPLE_STATE, BAG } from './constants.ts';
import { pickIndex, type Rnd } from './util.ts';

export const APPLE_KINDS = [
  'fuji', 'goldenDel', 'granny', 'golden', 'delicious', 'pinkLady', 'redStreak',
  'purple', 'silver', 'worm', 'caramel', 'giant', 'kent', 'poison', 'forbidden',
] as const;
export type AppleKind = (typeof APPLE_KINDS)[number];
export const APPLE_STATES = ['fresh', 'ripe', 'wormy', 'shiny'] as const;
export type AppleState = (typeof APPLE_STATES)[number];

export interface VarietyDef {
  id: AppleKind;
  /** 图鉴/UI 用名(与 plan/20-art.md 一致) */
  name: string;
  /** 掉落权重(随机池内相对值) */
  weight: number;
  /** 价值乘数(相对富士红 = 1,归一前) */
  value: number;
  /** 出现的最低 era(min(source.tier, ROUTE_ERA[route.tier]),0..5) */
  minEra: number;
  /** 堆场占用格数(仅展示;数值上按期望价值,不影响容量) */
  slots: number;
  /** 品种带不带"状态"(special 品种固定新鲜) */
  stateful: boolean;
  /** 不入库(毒苹果):点掉得图鉴 */
  noStock?: boolean;
  /** 能不能进订单 */
  orderable: boolean;
  /** 仅强制/事件出现(不在随机池) */
  forceOnly?: boolean;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
}

export const VARIETIES: Record<AppleKind, VarietyDef> = {
  fuji: { id: 'fuji', name: '富士红', weight: 100, value: 1, minEra: 0, slots: 1, stateful: true, orderable: true, rarity: 'common' },
  goldenDel: { id: 'goldenDel', name: '黄元帅', weight: 22, value: 1.1, minEra: 0, slots: 1, stateful: true, orderable: true, rarity: 'common' },
  granny: { id: 'granny', name: '青苹果', weight: 18, value: 0.85, minEra: 0, slots: 1, stateful: true, orderable: true, rarity: 'common' },
  delicious: { id: 'delicious', name: '蛇果', weight: 14, value: 1.25, minEra: 1, slots: 1, stateful: true, orderable: true, rarity: 'uncommon' },
  pinkLady: { id: 'pinkLady', name: '粉红佳人', weight: 12, value: 1.3, minEra: 1, slots: 1, stateful: true, orderable: true, rarity: 'uncommon' },
  redStreak: { id: 'redStreak', name: '红斑', weight: 10, value: 1.4, minEra: 2, slots: 1, stateful: true, orderable: true, rarity: 'uncommon' },
  caramel: { id: 'caramel', name: '焦糖', weight: 8, value: 1.6, minEra: 2, slots: 1, stateful: true, orderable: true, rarity: 'rare' },
  purple: { id: 'purple', name: '紫玉', weight: 6, value: 2, minEra: 3, slots: 1, stateful: true, orderable: true, rarity: 'rare' },
  silver: { id: 'silver', name: '灰银', weight: 5, value: 2.2, minEra: 4, slots: 1, stateful: true, orderable: true, rarity: 'rare' },
  giant: { id: 'giant', name: '巨无霸', weight: 1.5, value: 5, minEra: 2, slots: 3, stateful: false, orderable: false, rarity: 'epic' },
  golden: { id: 'golden', name: '金苹果', weight: 1, value: 10, minEra: 1, slots: 1, stateful: false, orderable: false, rarity: 'epic' },
  forbidden: { id: 'forbidden', name: '禁果', weight: 0.3, value: 4, minEra: 1, slots: 1, stateful: false, orderable: false, rarity: 'epic' },
  poison: { id: 'poison', name: '毒苹果', weight: 0.8, value: 0, minEra: 2, slots: 1, stateful: false, noStock: true, orderable: false, rarity: 'rare' },
  kent: { id: 'kent', name: '肯特之花', weight: 0, value: 3, minEra: 0, slots: 1, stateful: false, orderable: false, forceOnly: true, rarity: 'epic' },
  // 虫蛀:由"虫蛀状态"派生的品种(画成带虫眼的苹果);价值 = 1 × 虫蛀乘数
  worm: { id: 'worm', name: '虫蛀', weight: 0, value: 1, minEra: 0, slots: 1, stateful: false, orderable: false, forceOnly: true, rarity: 'common' },
};

export interface AppleCtx {
  /** eraMin 0..5 */
  era: number;
  /** 0..3 春夏秋冬 */
  season?: number;
  night?: boolean;
  /** 强制品种(牛顿事件 → 'kent';树顶 → 'forbidden') */
  force?: AppleKind;
  /** 按状态抽样的倍率覆盖(季节系统传入),缺省 1 */
  stateMul?: Partial<Record<AppleState, number>>;
}

export interface Apple {
  kind: AppleKind;
  state: AppleState;
  /** 价值乘数,已归一(情境内期望 = 1) */
  value: number;
  noStock: boolean;
}

/** 状态概率(归一),按季节/昼夜调整 */
export function stateProbs(ctx: AppleCtx): Record<AppleState, number> {
  const mul = ctx.stateMul ?? {};
  const w = { ...APPLE_STATE.weight };
  for (const k of APPLE_STATES) w[k] *= mul[k] ?? 1;
  if (ctx.night) w.shiny *= 2;
  const sum = w.fresh + w.ripe + w.wormy + w.shiny;
  return { fresh: w.fresh / sum, ripe: w.ripe / sum, wormy: w.wormy / sum, shiny: w.shiny / sum };
}

/** 当前情境的随机池(品种、权重、已按 era 过滤) */
function pool(ctx: AppleCtx): VarietyDef[] {
  return Object.values(VARIETIES).filter((v) => !v.forceOnly && v.weight > 0 && v.minEra <= ctx.era);
}

/** 未归一的期望(按价值乘数算,虫蛀状态 = 0.7×1) */
function rawExpected(ctx: AppleCtx): number {
  const p = stateProbs(ctx);
  const M = APPLE_STATE.mult;
  // 有状态品种:虫蛀 → 变 worm(价值 1×0.7);其余状态 = 品种价值 × 状态乘数
  const nonWorm = p.fresh * M.fresh + p.ripe * M.ripe + p.shiny * M.shiny;
  let sum = 0;
  let wsum = 0;
  for (const v of pool(ctx)) {
    wsum += v.weight;
    sum += v.weight * (v.stateful ? v.value * nonWorm + p.wormy * M.wormy : v.value);
  }
  return sum / wsum;
}

const scaleCache = new Map<string, number>();
/** 归一系数:rollApple 的 value = 原始 value × 此值,使期望 = 1 */
export function normScale(ctx: AppleCtx): number {
  const m = ctx.stateMul ?? {};
  const key = `${ctx.era}|${ctx.season ?? -1}|${ctx.night ? 1 : 0}|${APPLE_STATES.map((s) => m[s] ?? 1).join(',')}`;
  let v = scaleCache.get(key);
  if (v === undefined) {
    v = 1 / rawExpected(ctx);
    scaleCache.set(key, v);
  }
  return v;
}

/** 期望价值(归一后恒为 1;留作自检) */
export function expectedValue(ctx: AppleCtx): number {
  return rawExpected(ctx) * normScale(ctx);
}

function make(kind: AppleKind, state: AppleState, ctx: AppleCtx): Apple {
  const v = VARIETIES[kind];
  const raw = v.value * APPLE_STATE.mult[state];
  return { kind, state, value: raw * normScale(ctx), noStock: !!v.noStock };
}

/** 摇树/自然掉落抽样一个样本苹果 */
export function rollApple(rnd: Rnd, ctx: AppleCtx): Apple {
  if (ctx.force) return make(ctx.force, 'fresh', ctx);
  const list = pool(ctx);
  const v = list[pickIndex(list.map((x) => x.weight), rnd)];
  if (!v.stateful) return make(v.id, 'fresh', ctx);
  const p = stateProbs(ctx);
  const states = APPLE_STATES;
  const st = states[pickIndex(states.map((s) => p[s]), rnd)];
  // 虫蛀的苹果统一画成 worm 品种
  if (st === 'wormy') return make('worm', 'wormy', ctx);
  return make(v.id, st, ctx);
}

/** 点击治愈虫蛀:变回新鲜富士红,返回增加的价值(苹果当量) */
export function heal(apple: Apple, ctx: AppleCtx): { apple: Apple; gain: number } {
  if (apple.state !== 'wormy') return { apple, gain: 0 };
  const healed = make('fuji', APPLE_STATE.healedTo, ctx);
  return { apple: healed, gain: healed.value - apple.value };
}

/** 珍藏篮:每个品种的存量(只给订单用,不进经济) */
export type Bag = Partial<Record<AppleKind, number>>;

export function bagAdd(bag: Bag, apple: Pick<Apple, 'kind' | 'noStock'>): boolean {
  if (apple.noStock) return false;
  const n = bag[apple.kind] ?? 0;
  if (n >= BAG.maxPerKind) return false;
  bag[apple.kind] = n + 1;
  return true;
}

export function bagTotal(bag: Bag): number {
  let t = 0;
  for (const k of APPLE_KINDS) t += bag[k] ?? 0;
  return t;
}

/** 当前情境各品种的"期望份额"(按数量),用于图鉴/UI 展示 */
export function pileMix(ctx: AppleCtx): { kind: AppleKind; share: number }[] {
  const list = pool(ctx);
  const wsum = list.reduce((a, v) => a + v.weight, 0);
  const p = stateProbs(ctx);
  const out: { kind: AppleKind; share: number }[] = list.map((v) => ({
    kind: v.id,
    share: (v.weight / wsum) * (v.stateful ? 1 - p.wormy : 1),
  }));
  const wormShare = list.reduce((a, v) => a + (v.stateful ? (v.weight / wsum) * p.wormy : 0), 0);
  out.push({ kind: 'worm', share: wormShare });
  return out.sort((a, b) => b.share - a.share);
}
