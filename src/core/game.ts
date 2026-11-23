// v4 核心玩法:产出 → 堆场 → 车 → 送达。所有函数都改传入的 State(除非注明纯函数)。
import { GOAL, OFFLINE_CAP_MS, SHORT_AWAY_MS } from './constants.ts';
import {
  GATES, HELPER, MAX_CONVOYS, MAX_TIER, ROUTE_TIERS, SOURCE_TIERS, SHAKE, STOCK_MIN, STOCK_SECONDS, gateDef,
  type BranchDef, type Effect, type GateId,
} from './content.ts';
import { EXPAND, RED_EXP, TIER_START_UNITS, UNIT_MAX } from './content.ts';
import type { Line, State } from './state.ts';
export type LineId = 'source' | 'route';

// ───────────────────────── 乘数 ─────────────────────────
export interface Mods {
  produce: number;
  value: number;
  cap: number;
  time: number;
  stock: number;
  fw: number;
  floor: number;
  shake: number;
  auto: number;
  combo: number;
}

const unit1 = (): Mods => ({ produce: 1, value: 1, cap: 1, time: 1, stock: 1, fw: 1, floor: 0, shake: 1, auto: 1, combo: 1 });

function addEffect(m: Mods, e: Effect, k = 1): void {
  if (e.produce) m.produce *= Math.pow(e.produce, k);
  if (e.value) m.value *= Math.pow(e.value, k);
  if (e.cap) m.cap *= Math.pow(e.cap, k);
  if (e.time) m.time *= Math.pow(e.time, k);
  if (e.stock) m.stock *= Math.pow(e.stock, k);
  if (e.fw) m.fw *= Math.pow(e.fw, k);
  if (e.floor) m.floor = Math.max(m.floor, e.floor);
  if (e.shake) m.shake *= Math.pow(e.shake, k);
  if (e.auto) m.auto *= Math.pow(e.auto, k);
  if (e.combo) m.combo *= Math.pow(e.combo, k);
}

export const tiersOf = (line: LineId) => (line === 'source' ? SOURCE_TIERS : ROUTE_TIERS);

/** 当前所有分支 + 道具(含红绳相邻放大)合成的乘数 */
export function mods(s: Pick<State, 'source' | 'route' | 'gates'>): Mods {
  const m = unit1();
  for (const line of ['source', 'route'] as const) {
    const L = s[line];
    for (let t = 1; t <= L.tier; t++) {
      const b = L.branch[t];
      if (b === 0 || b === 1) addEffect(m, tiersOf(line)[t].branches![b].effect);
    }
  }
  for (let i = 0; i < s.gates.length; i++) {
    const id = s.gates[i];
    if (!id) continue;
    const def = gateDef(id);
    if (def.adjacent) continue;
    const red = s.gates[i - 1] === 'red' || s.gates[i + 1] === 'red';
    addEffect(m, def.effect, red ? RED_EXP : 1);
  }
  return m;
}

/** 连摇带来的价值乘数:1 + 连摇数 × comboStep × 号子 */
export const comboMult = (s: Pick<State, 'combo'>, m?: Pick<Mods, 'combo'>): number =>
  1 + Math.min(s.combo, SHAKE.comboMax) * SHAKE.comboStep * (m?.combo ?? 1);

/** 老徐们每秒总共摇几下 */
export const helperRate = (s: Pick<State, 'helpers'>, m: Pick<Mods, 'auto'>): number => s.helpers * HELPER.rate * m.auto;

/** 老徐把摇劲稳定在多少(0..1):每秒蓄 rate×perShake,衰减 decay */
export const autoCharge = (s: Pick<State, 'helpers'>, m: Pick<Mods, 'auto'>): number => Math.min(1, (helperRate(s, m) * SHAKE.perShake) / SHAKE.decay);

/** 摇劲水平:手动蓄的、保底、老徐稳住的,取最大 */
export const chargeLevel = (s: Pick<State, 'charge' | 'helpers'>, m: Pick<Mods, 'floor' | 'auto'>): number =>
  Math.max(s.charge, m.floor, autoCharge(s, m));

/** 每个苹果的价值(果钱),含连摇 */
export const appleValue = (s: Pick<State, 'combo'>, m: Pick<Mods, 'value' | 'combo'>): number => m.value * comboMult(s, m);

// ───────────────────────── 吞吐 ─────────────────────────
export interface Throughput {
  /** 当前总产出 个/秒(树 × 摇劲 + 老徐摇下来的) */
  produce: number;
  /** 只算保底摇劲、不含老徐的树产出 */
  produceBase: number;
  /** 老徐摇下来的苹果 个/秒 */
  auto: number;
  /** 手摇掉下来的苹果 个/秒(按近期摇树频率 s.shakeRate 估算) */
  manual: number;
  /** 手动摇一下掉多少个 */
  shakeDrop: number;
  /** 当前摇劲水平 0..1 */
  charge: number;
  /** 运力 个/秒(所有车装满跑满) */
  carry: number;
  /** min(produce, carry):真正送达的速度 */
  flow: number;
  /** 每个苹果的价值 */
  value: number;
  /** flow × value:果钱/秒 */
  income: number;
  /** 堆场容量 */
  stockMax: number;
  bottleneck: Bottleneck;
}
export type Bottleneck = 'produce' | 'carry' | 'balanced';

/** 第 t 档扩建带来的倍率 */
export const extMult = (L: Pick<Line, 'ext'>, t: number): number => Math.pow(EXPAND.mult, L.ext[t] ?? 0);

export function baseProduce(L: Line): number {
  let p = 0;
  for (let t = 0; t <= L.tier; t++) p += L.units[t] * SOURCE_TIERS[t].rate * extMult(L, t);
  return p;
}

export function carryRate(R: Line, m: Mods): number {
  let c = 0;
  for (let t = 0; t <= R.tier; t++) c += (R.units[t] * ROUTE_TIERS[t].cap * extMult(R, t)) / ROUTE_TIERS[t].trip;
  return (c * m.cap) / m.time;
}

export const fwMax = (s: Pick<State, 'source'>, m: Mods): number => SHAKE.maxByTier[s.source.tier] * m.fw;

/** 摇一下掉多少个:1 + 当前产出 × dropSec[档] × 手劲 */
export const dropOf = (s: Pick<State, 'source'>, m: Mods, produceNow: number): number =>
  1 + produceNow * SHAKE.dropSec[s.source.tier] * m.shake;

export function stockMax(s: Pick<State, 'source'>, m: Mods): number {
  return Math.max(STOCK_MIN, STOCK_SECONDS * baseProduce(s.source) * m.produce) * m.stock;
}

export function bottleneckOf(produce: number, carry: number): Bottleneck {
  const r = produce / carry;
  return r > 1.1 ? 'carry' : r < 0.9 ? 'produce' : 'balanced';
}

export function throughput(s: Pick<State, 'source' | 'route' | 'gates' | 'charge' | 'combo' | 'helpers' | 'shakeRate'>): Throughput {
  const m = mods(s);
  const bp = baseProduce(s.source) * m.produce;
  const fm = fwMax(s, m);
  const level = chargeLevel(s, m);
  const main = bp * (1 + fm * level);
  const auto = helperRate(s, m) * dropOf(s, m, main);
  const manual = Math.max(0, s.shakeRate) * dropOf(s, m, main);
  const produce = main + auto + manual;
  const produceBase = bp * (1 + fm * m.floor);
  const carry = carryRate(s.route, m);
  const flow = Math.min(produce, carry);
  const value = appleValue(s, m);
  return {
    produce, produceBase, auto, manual, shakeDrop: dropOf(s, m, main), charge: level, carry, flow, value, income: flow * value,
    stockMax: stockMax(s, m), bottleneck: bottleneckOf(produce, carry),
  };
}

// ───────────────────────── 购买 ─────────────────────────
/** 第 tier 档下一个单位的价格(默认当前最高档) */
export function unitCost(s: State, line: LineId, tier = s[line].tier): number {
  const d = tiersOf(line)[tier];
  return Math.floor(d.baseCost * Math.pow(d.growth, Math.max(0, s[line].units[tier] - 1)));
}

export function canBuyUnit(s: State, line: LineId, tier = s[line].tier): boolean {
  return tier >= 0 && tier <= s[line].tier && s[line].units[tier] < UNIT_MAX && s.coins >= unitCost(s, line, tier);
}

/** 运输线新增一辆:车数 ≤ 24 一辆一个;超过则并进最轻的车队 */
function addVehicle(s: State, tier: number): void {
  const mine = s.vehicles.filter((v) => v.tier === tier);
  if (mine.length < MAX_CONVOYS) {
    s.vehicles.push({ tier, w: 1, phase: 0, load: 0 });
    s.vehicles.sort((a, b) => a.tier - b.tier);
    return;
  }
  let best = mine[0];
  for (const v of mine) if (v.w < best.w) best = v;
  best.w += 1;
}

export function buyUnit(s: State, line: LineId, tier = s[line].tier): boolean {
  if (!canBuyUnit(s, line, tier)) return false;
  s.coins -= unitCost(s, line, tier);
  s[line].units[tier] += 1;
  if (line === 'route') addVehicle(s, tier);
  return true;
}

/** 第 tier 档下一次扩建的信息;单位数没到门槛、已买满、该线已最高档且无下一档价格时 null */
export function expandInfo(s: State, line: LineId, tier = s[line].tier): { n: number; cost: number; name: string; need: number } | null {
  const L = s[line];
  if (tier < 0 || tier > L.tier) return null;
  const n = L.ext[tier] ?? 0;
  if (n >= EXPAND.units.length) return null;
  const base = L.tier >= MAX_TIER ? tiersOf(line)[L.tier].tierCost || tiersOf(line)[L.tier].baseCost * 40 : tiersOf(line)[L.tier + 1].tierCost;
  return { n, cost: Math.floor(base * EXPAND.cost[n]), name: EXPAND.names[n], need: EXPAND.units[n] };
}
export const expandCost = (s: State, line: LineId, tier = s[line].tier): number | null => expandInfo(s, line, tier)?.cost ?? null;
/** 单位数够了且钱够才能买 */
export function canExpand(s: State, line: LineId, tier = s[line].tier): boolean {
  const e = expandInfo(s, line, tier);
  return !!e && s[line].units[tier] >= e.need && s.coins >= e.cost;
}
export function buyExpand(s: State, line: LineId, tier = s[line].tier): boolean {
  if (!canExpand(s, line, tier)) return false;
  s.coins -= expandInfo(s, line, tier)!.cost;
  s[line].ext[tier] += 1;
  return true;
}

/** 升到下一档要花多少(已是最高档返回 null) */
export function tierCost(s: State, line: LineId): number | null {
  const L = s[line];
  return L.tier >= MAX_TIER ? null : tiersOf(line)[L.tier + 1].tierCost;
}

export function canUpgradeTier(s: State, line: LineId): boolean {
  const c = tierCost(s, line);
  return c !== null && s.coins >= c;
}

/** 下一档的两个分支;已最高档返回 null */
export function nextBranches(s: State, line: LineId): [BranchDef, BranchDef] | null {
  const L = s[line];
  return L.tier >= MAX_TIER ? null : tiersOf(line)[L.tier + 1].branches;
}

export interface UpgradeResult {
  line: LineId;
  tier: number;
  branch: 0 | 1;
  /** 这次升档新解锁的道具 */
  newGates: GateId[];
}

/** 升档:付 tierCost,选分支,赠送 1 个新档单位。成功返回结果,否则 null */
export function upgradeTier(s: State, line: LineId, branch: 0 | 1): UpgradeResult | null {
  if (branch !== 0 && branch !== 1) return null;
  if (!canUpgradeTier(s, line)) return null;
  const L = s[line];
  s.coins -= tierCost(s, line)!;
  L.tier += 1;
  L.branch[L.tier] = branch;
  L.units[L.tier] = TIER_START_UNITS;
  if (line === 'route') for (let i = 0; i < TIER_START_UNITS; i++) addVehicle(s, L.tier);
  s.tierTimes[line][L.tier - 1] = s.playSec;
  return { line, tier: L.tier, branch, newGates: unlockGates(s) };
}

export function unlockGates(s: State): GateId[] {
  const sum = s.source.tier + s.route.tier;
  const fresh: GateId[] = [];
  for (const g of GATES) {
    if (g.unlockAt <= sum && !s.gatesUnlocked.includes(g.id)) {
      s.gatesUnlocked.push(g.id);
      fresh.push(g.id);
    }
  }
  return fresh;
}

/** 放入/拿出道具。免费。已在别的槽的道具会和目标槽互换。 */
export function setGate(s: State, slot: number, id: GateId | null): boolean {
  if (!Number.isInteger(slot) || slot < 0 || slot >= s.gates.length) return false;
  if (id !== null) {
    if (!s.gatesUnlocked.includes(id)) return false;
    const other = s.gates.indexOf(id);
    if (other === slot) return true;
    if (other >= 0) s.gates[other] = s.gates[slot];
  }
  s.gates[slot] = id;
  return true;
}

// ───────────────────────── 老徐(自动摇树) ─────────────────────────
/** 下一位老徐的价格;没解锁(果园之前)或已满员为 null */
export function helperCost(s: Pick<State, 'source' | 'helpers'>): number | null {
  if (s.source.tier < HELPER.unlockTier || s.helpers >= HELPER.max) return null;
  return Math.floor(HELPER.baseCost * Math.pow(HELPER.growth, s.helpers));
}
export function canBuyHelper(s: State): boolean {
  const c = helperCost(s);
  return c !== null && s.coins >= c;
}
export function buyHelper(s: State): boolean {
  const c = helperCost(s);
  if (c === null || s.coins < c) return false;
  s.coins -= c;
  s.helpers += 1;
  return true;
}

// ───────────────────────── 预览 ─────────────────────────
export type Action =
  | { kind: 'unit'; line: LineId; tier?: number }
  | { kind: 'tier'; line: LineId; branch: 0 | 1 }
  | { kind: 'helper' }
  | { kind: 'expand'; line: LineId; tier?: number }
  | { kind: 'gate'; slot: number; id: GateId | null };

export interface Preview {
  ok: boolean;
  cost: number;
  affordable: boolean;
  /** 吞吐变化(个/秒)与比例(0.25 = +25%) */
  flowDelta: number;
  flowPct: number;
  /** 单价变化比例(×) */
  valueDelta: number;
  incomeDelta: number;
  incomePct: number;
  /** 做之前/之后的完整吞吐(UI 可画对比条) */
  before: Throughput;
  after: Throughput;
  /** 给人看的一句话(不带数字):"多送一些""车更大""装得更快"…;没什么可说的是空串。UI 想不想显示自己定。 */
  plain: string;
}

/** 把"做了这件事之后变了什么"说成人话,最多两个短语 */
function plainOf(a: Action, ok: boolean, bm: Mods, am: Mods, before: Throughput, after: Throughput): string {
  if (!ok) return '';
  const parts: string[] = [];
  const up = (x: number, y: number, e = 0.01) => y > x * (1 + e);
  const down = (x: number, y: number, e = 0.01) => y < x * (1 - e);
  if (a.kind === 'helper') parts.push('多一位帮手摇树');
  if (a.kind === 'expand') parts.push(a.line === 'source' ? '这一档长得更多' : '这一档车更大');
  if (a.kind === 'tier') parts.push('升一档,多一种玩法');
  if (up(bm.cap, am.cap)) parts.push('车更大');
  if (down(bm.time, am.time)) parts.push('装得更快');
  if (up(bm.value, am.value)) parts.push('更值钱');
  if (down(bm.value, am.value)) parts.push('价钱略低');
  if (up(bm.produce, am.produce)) parts.push('长得更多');
  if (up(bm.stock, am.stock)) parts.push('堆场更大');
  if (up(bm.shake, am.shake)) parts.push('摇一下掉更多');
  if (up(bm.combo, am.combo)) parts.push('连摇更值');
  if (up(bm.fw, am.fw) || up(bm.floor + 1, am.floor + 1)) parts.push('摇劲更足');
  if (a.kind === 'unit' || a.kind === 'helper') {
    if (up(before.flow, after.flow)) parts.push(a.kind === 'unit' && a.line === 'route' ? '多运一些' : '多送一些');
  } else if (a.kind === 'gate' && up(before.flow, after.flow, 0.03) && !parts.length) parts.push('多送一些');
  return parts.slice(0, 2).join('、');
}

type Lite = Pick<State, 'source' | 'route' | 'gates' | 'charge' | 'combo' | 'helpers' | 'shakeRate' | 'gatesUnlocked'>;
const lite = (s: State): Lite => ({
  source: { ...s.source, units: [...s.source.units], branch: [...s.source.branch], ext: [...s.source.ext] },
  route: { ...s.route, units: [...s.route.units], branch: [...s.route.branch], ext: [...s.route.ext] },
  gates: [...s.gates],
  charge: s.charge,
  combo: s.combo,
  helpers: s.helpers,
  shakeRate: s.shakeRate,
  gatesUnlocked: s.gatesUnlocked,
});

/** 模拟"如果做了这件事"吞吐/价值会怎样,不改 s。UI 用来画 "+x%"。 */
export function preview(s: State, a: Action): Preview {
  const before = throughput(s);
  const l = lite(s);
  let cost = 0;
  let ok = true;
  if (a.kind === 'unit') {
    const tier = a.tier ?? s[a.line].tier;
    ok = tier >= 0 && tier <= s[a.line].tier && s[a.line].units[tier] < UNIT_MAX;
    if (ok) {
      cost = unitCost(s, a.line, tier);
      l[a.line].units[tier] += 1;
    }
  } else if (a.kind === 'expand') {
    const tier = a.tier ?? s[a.line].tier;
    const e = expandInfo(s, a.line, tier);
    ok = !!e && s[a.line].units[tier] >= e.need;
    if (ok) {
      cost = e!.cost;
      l[a.line].ext[tier] += 1;
    }
  } else if (a.kind === 'helper') {
    const c = helperCost(s);
    ok = c !== null;
    if (ok) {
      cost = c!;
      l.helpers += 1;
    }
  } else if (a.kind === 'tier') {
    const c = tierCost(s, a.line);
    ok = c !== null;
    if (ok) {
      cost = c!;
      const L = l[a.line];
      L.tier += 1;
      L.branch[L.tier] = a.branch;
      L.units[L.tier] = TIER_START_UNITS;
    }
  } else {
    ok = a.slot >= 0 && a.slot < l.gates.length && (a.id === null || s.gatesUnlocked.includes(a.id));
    if (ok) {
      if (a.id !== null) {
        const other = l.gates.indexOf(a.id);
        if (other >= 0) l.gates[other] = l.gates[a.slot];
      }
      l.gates[a.slot] = a.id;
    }
  }
  const after = throughput(l);
  return {
    ok,
    cost,
    affordable: ok && s.coins >= cost,
    flowDelta: after.flow - before.flow,
    flowPct: before.flow > 0 ? after.flow / before.flow - 1 : 0,
    valueDelta: after.value / before.value,
    incomeDelta: after.income - before.income,
    incomePct: before.income > 0 ? after.income / before.income - 1 : 0,
    before,
    after,
    plain: plainOf(a, ok, mods(s), mods(l), before, after),
  };
}

export interface LineHints {
  /** full = 这一档已买满 UNIT_MAX 个(只能升档/扩建) */
  unit: { cost: number; affordable: boolean; waitSec: number; flowPct: number; full: boolean };
  /** 已最高档为 null */
  tier: { cost: number; affordable: boolean; waitSec: number; flowPct: number } | null;
  /** 当前档的下一次扩建(5/15/30 个单位时各一次);买满为 null。ready=单位数够了;没 ready 时 UI 可显示"再来 N 个" */
  expand: { name: string; need: number; have: number; ready: boolean; cost: number; affordable: boolean; waitSec: number; flowPct: number } | null;
}
export interface Hints {
  source: LineHints;
  route: LineHints;
  /** 下一位老徐;没解锁/满员为 null */
  helper: { cost: number; affordable: boolean; waitSec: number; flowPct: number } | null;
  /** 现在该加哪一边:瓶颈在哪边就是哪边;平衡时 null */
  suggest: LineId | null;
}

/** 给 UI 画"下一个买什么":价格、还差几秒攒够、买了涨多少 */
export function nextHints(s: State): Hints {
  const th = throughput(s);
  const wait = (c: number) => (s.coins >= c ? 0 : th.income > 0 ? (c - s.coins) / th.income : Infinity);
  const mk = (line: LineId): LineHints => {
    const c = unitCost(s, line);
    const tc = tierCost(s, line);
    const ei = expandInfo(s, line);
    const have = s[line].units[s[line].tier];
    return {
      expand: ei === null ? null : { name: ei.name, need: ei.need, have, ready: have >= ei.need, cost: ei.cost, affordable: have >= ei.need && s.coins >= ei.cost, waitSec: wait(ei.cost), flowPct: preview(s, { kind: 'expand', line }).flowPct },
      unit: { cost: c, affordable: s.coins >= c && s[line].units[s[line].tier] < UNIT_MAX, waitSec: wait(c), flowPct: preview(s, { kind: 'unit', line }).flowPct, full: s[line].units[s[line].tier] >= UNIT_MAX },
      tier:
        tc === null
          ? null
          : {
              cost: tc,
              affordable: s.coins >= tc,
              waitSec: wait(tc),
              flowPct: Math.max(preview(s, { kind: 'tier', line, branch: 0 }).flowPct, preview(s, { kind: 'tier', line, branch: 1 }).flowPct),
            },
    };
  };
  const hc = helperCost(s);
  const helper = hc === null ? null : { cost: hc, affordable: s.coins >= hc, waitSec: wait(hc), flowPct: preview(s, { kind: 'helper' }).flowPct };
  return { source: mk('source'), route: mk('route'), helper, suggest: th.bottleneck === 'carry' ? 'route' : th.bottleneck === 'produce' ? 'source' : null };
}

/** 画面用:当前总时代 0..10(产出档 + 运输档);两条线都到才算整档 = min */
export const era = (s: State): number => s.source.tier + s.route.tier;
export const eraMin = (s: State): number => Math.min(s.source.tier, s.route.tier);

// ───────────────────────── 手动:摇树 ─────────────────────────
export interface ShakeResult {
  /** 这一下有没有生效(超过每秒上限会被忽略) */
  ok: boolean;
  /** 这一下直接掉进堆场的苹果数 */
  dropped: number;
  /** 当前连摇数 */
  combo: number;
}

/**
 * 摇一下树:苹果直接掉进堆场(1 + 当前产出×dropSec×手劲),同时蓄一点摇劲、续上连摇。
 * 有效频率上限 SHAKE.maxRate 次/秒(令牌桶 s.shakeTok,突发 SHAKE.burst)。牛顿事件期间掉落与摇劲翻倍。
 */
export function shake(s: State): ShakeResult {
  if (s.shakeTok < 1) return { ok: false, dropped: 0, combo: s.combo };
  s.shakeTok -= 1;
  s.shakes += 1;
  const m = mods(s);
  const k = s.playSec < s.newtonUntil ? 2 : 1;
  const dropped = throughput(s).shakeDrop * k;
  s.charge = Math.min(1, s.charge + SHAKE.perShake * k);
  s.shakeRate += 1 / SHAKE.rateTau;
  s.combo = s.comboT > 0 ? s.combo + 1 : 1;
  s.comboT = SHAKE.comboWindow;
  s.stock += dropped;
  const smax = stockMax(s, m);
  if (s.stock > smax) {
    const over = s.stock - smax;
    s.wasted += over;
    s.stock = smax;
    // 堆场满了:路边摊顺手卖掉,不计送达
    s.coins += over * appleValue(s, m) * SHAKE.roadside;
  }
  return { ok: true, dropped, combo: s.combo };
}

/** shake 的别名(点击/空格/手机摇一摇都调这个) */
export const click = shake;

// ───────────────────────── 推进 ─────────────────────────
export interface TickResult {
  deliveredNow: number;
  coinsNow: number;
  wastedNow: number;
}

/** 单步不超过这么多秒;更长的 dt 切成等长小步 */
export const STEP_S = 0.25;
/** 超过这么多秒的 dt 走闭式聚合(不逐车模拟) */
export const FLUID_ABOVE_S = 120;

/** 推进 dtSec 秒(游戏内时间)。now 是真实时间戳,只用来写 lastSeen。 */
export function tick(s: State, dtSec: number, now = NaN): TickResult {
  const res: TickResult = { deliveredNow: 0, coinsNow: 0, wastedNow: 0 };
  if (Number.isFinite(now)) s.lastSeen = now;
  if (!(dtSec > 0)) return res;
  if (dtSec > FLUID_ABOVE_S) return fluid(s, dtSec);

  const m = mods(s);
  const smax = stockMax(s, m);
  const base = baseProduce(s.source) * m.produce;
  const fm = fwMax(s, m);
  const hr = helperRate(s, m);
  const n = Math.ceil(dtSec / STEP_S);
  const h = dtSec / n;
  const dk = Math.exp(-SHAKE.decay * h);
  const rk = Math.exp(-h / SHAKE.rateTau);
  for (let i = 0; i < n; i++) {
    s.playSec += h;
    // 摇劲衰减(保底/老徐不衰减)、连摇计时、摇树令牌回复
    s.charge = s.charge * dk;
    s.shakeRate *= rk;
    s.shakeTok = Math.min(SHAKE.burst, s.shakeTok + SHAKE.maxRate * h);
    if (s.comboT > 0) {
      s.comboT -= h;
      if (s.comboT <= 0) {
        s.comboT = 0;
        s.combo = 0;
      }
    }
    const main = base * (1 + fm * chargeLevel(s, m));
    s.stock += (main + hr * dropOf(s, m, main)) * h;
    const val = appleValue(s, m);
    for (const v of s.vehicles) {
      const d = ROUTE_TIERS[v.tier];
      const full = v.w * d.cap * m.cap * extMult(s.route, v.tier);
      if (v.phase === 0) {
        if (v.load > full) {
          s.stock += v.load - full;
          v.load = full;
        }
        const need = full - v.load;
        if (need > 0) {
          const take = Math.min(s.stock, need);
          v.load += take;
          s.stock -= take;
        }
        if (v.load < full * 0.999999) continue;
      }
      const prev = v.phase;
      v.phase += h / (d.trip * m.time);
      if (prev < 0.5 && v.phase >= 0.5) {
        const got = v.load;
        v.load = 0;
        s.delivered += got;
        s.coins += got * val;
        res.deliveredNow += got;
        res.coinsNow += got * val;
      }
      if (v.phase >= 1) v.phase = 0;
    }
    if (s.stock > smax) {
      s.wasted += s.stock - smax;
      res.wastedNow += s.stock - smax;
      s.stock = smax;
    }
    if (s.newtonUntil > 0 && s.playSec >= s.newtonUntil) s.newtonUntil = 0;
    if (s.wonAt === null && s.delivered >= GOAL) s.wonAt = s.playSec;
  }
  return res;
}

/**
 * 闭式聚合推进(离线/切后台很久):不逐车,按稳态算。
 * 送达速度 = min(产出, 运力);运力 > 产出时先把堆场清空;产出 > 运力时堆场灌满后溢出浪费。
 * 摇劲按保底/老徐算(手动的衰减掉),连击清零,车全部回堆场重新装。
 */
function fluid(s: State, dt: number): TickResult {
  const m = mods(s);
  const main = baseProduce(s.source) * m.produce * (1 + fwMax(s, m) * Math.max(m.floor, autoCharge(s, m)));
  const p = main + helperRate(s, m) * dropOf(s, m, main);
  const c = carryRate(s.route, m);
  const smax = stockMax(s, m);
  const val = m.value;
  // 在途的货(已装车)按到达处理
  let got = 0;
  for (const v of s.vehicles) {
    got += v.load;
    v.load = 0;
    v.phase = 0;
  }
  let flowTotal = Math.min(p, c) * dt;
  let wasted = 0;
  if (p > c) {
    const fill = Math.max(0, smax - s.stock);
    const surplus = (p - c) * dt;
    const kept = Math.min(fill, surplus);
    wasted = surplus - kept;
    s.stock += kept;
  } else {
    const drain = Math.min(s.stock, (c - p) * dt);
    flowTotal += drain;
    s.stock -= drain;
  }
  const delivered = flowTotal + got;
  const before = s.delivered;
  s.delivered += delivered;
  s.coins += delivered * val;
  s.wasted += wasted;
  s.charge *= Math.exp(-SHAKE.decay * dt);
  s.shakeTok = SHAKE.burst;
  s.shakeRate = 0;
  s.combo = 0;
  s.comboT = 0;
  if (s.newtonUntil > 0 && s.playSec + dt >= s.newtonUntil) s.newtonUntil = 0;
  if (s.wonAt === null && s.delivered >= GOAL) {
    const rate = Math.max(1e-9, delivered / dt);
    s.wonAt = s.playSec + Math.max(0, (GOAL - before) / rate);
  }
  s.playSec += dt;
  return { deliveredNow: delivered, coinsNow: delivered * val, wastedNow: wasted };
}

export interface SettleResult {
  /** 离开期间送达的苹果数 */
  delivered: number;
  coins: number;
  /** 折算秒数(已封顶) */
  seconds: number;
  /** 是否被 8 小时封顶截断 */
  capped: boolean;
}

/** 离线结算:按 100% 效率,上限 OFFLINE_CAP_MS。很短的离开按普通 tick 处理。 */
export function settle(s: State, awayMs: number): SettleResult {
  if (!(awayMs > 0)) return { delivered: 0, coins: 0, seconds: 0, capped: false };
  const capped = awayMs > OFFLINE_CAP_MS;
  const sec = Math.min(awayMs, OFFLINE_CAP_MS) / 1000;
  if (awayMs < SHORT_AWAY_MS) {
    const r = tick(s, sec);
    return { delivered: r.deliveredNow, coins: r.coinsNow, seconds: sec, capped: false };
  }
  const r = fluid(s, sec);
  return { delivered: r.deliveredNow, coins: r.coinsNow, seconds: sec, capped };
}

export const progress = (s: State): number => Math.min(1, s.delivered / GOAL);
export const isWon = (s: State): boolean => s.delivered >= GOAL;

/** 堆场装了多少 0..1 */
export const stockFill = (s: State): number => Math.min(1, s.stock / stockMax(s, mods(s)));

export interface FleetView {
  tier: number;
  /** 该档车数 */
  count: number;
  /** 正在路上(phase>0)的比例 */
  moving: number;
  /** 平均装载率 0..1 */
  load: number;
}

/** 每档车的汇总:UI 画"空车比例"用 */
export function fleetView(s: State): FleetView[] {
  const m = mods(s);
  const out: FleetView[] = [];
  for (let t = 0; t <= s.route.tier; t++) {
    let count = 0, moving = 0, loadSum = 0, full = 0;
    for (const v of s.vehicles) {
      if (v.tier !== t) continue;
      count += v.w;
      if (v.phase > 0) moving += v.w;
      loadSum += v.load;
      full += v.w * ROUTE_TIERS[t].cap * m.cap * extMult(s.route, t);
    }
    out.push({ tier: t, count, moving: count ? moving / count : 0, load: full ? Math.min(1, loadSum / full) : 0 });
  }
  return out;
}
