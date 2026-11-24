// v4 全部内容与数值。想调平衡,只改这个文件(再跑 node scripts/sim.ts 看结果)。
//
// 模型:产出线(5 档:树原地进化)把苹果放进堆场,运输线(8 档)的车从堆场装货、开到终点、送达才结算。
// 吞吐 = min(产出, 运力)。每次升档要选 2 个分支之一。(v6:道具槽/关卡系统已删除)

export type Line = 'source' | 'route';

/** 一组乘数。全部是"乘";没写的当 1。floor 是摇劲保底(取最大),不是乘数。 */
export interface Effect {
  /** 产出 */
  produce?: number;
  /** 每个苹果的价值(果钱) */
  value?: number;
  /** 每辆车每趟容量 */
  cap?: number;
  /** 每趟用时(<1 更快) */
  time?: number;
  /** 堆场容量 */
  stock?: number;
  /** 摇劲(摇树蓄的力)带来的产出加成上限 */
  fw?: number;
  /** 摇劲保底(0..1):不摇也保持这么多 */
  floor?: number;
  /** 每摇一下掉下来的苹果数(手劲) */
  shake?: number;
  /** 老徐(自动摇树)的摇树频率 */
  auto?: number;
  /** 连摇每一击的价值加成 */
  combo?: number;
}

export interface BranchDef {
  name: string;
  joke: string;
  effect: Effect;
}

export interface SourceTierDef {
  /** 档名,如"一棵树" */
  name: string;
  /** 单位名(买 +1 时显示):"棵树" */
  unit: string;
  /** 每个单位每秒产出(未乘任何加成) */
  rate: number;
  /** 本档第 1 个单位的价格(升档时赠送 1 个,所以第 2 个起收费) */
  baseCost: number;
  /** 同档每多买一个,价格 × growth */
  growth: number;
  /** 升到这一档的价格(第 0 档为 0) */
  tierCost: number;
  /** 升到这一档时二选一的分支(第 0 档为 null) */
  branches: [BranchDef, BranchDef] | null;
  /** 升档点二选一的短标题(UI 副标题,不含数字),如 "密植 或 铁砂掌";第 0 档为空串 */
  pair: string;
  joke: string;
}

export interface RouteTierDef {
  name: string;
  unit: string;
  /** 每辆每趟装多少个 */
  cap: number;
  /** 往返一趟多少秒 */
  trip: number;
  baseCost: number;
  growth: number;
  tierCost: number;
  branches: [BranchDef, BranchDef] | null;
  /** 升档点二选一的短标题(UI 副标题,不含数字),如 "密植 或 铁砂掌";第 0 档为空串 */
  pair: string;
  joke: string;
}

// ───────────────────────── 手动:摇树 ─────────────────────────
export const SHAKE = {
  /** 一下摇掉的苹果 = 1 + 当前产出(个/秒) × dropSec[产出档] × 手劲加成。后期手动只是调味。 */
  dropSec: [0.7, 0.5, 0.39, 0.31, 0.21],
  /** 每次有效摇树给摇劲的增量(0..1) */
  perShake: 0.08,
  /** 摇劲每秒指数衰减 */
  decay: 0.25,
  /** 每秒最多算 maxRate 次有效摇树,突发最多 burst 次(再多的点按没用,不扣也不加) */
  maxRate: 8,
  /** 估算"近期摇树频率"的滑动平均时间常数(秒) */
  rateTau: 2,
  /** 堆场满了,摇下来放不下的苹果当场路边摊卖掉:果钱 += 溢出 × 价值 × roadside(不计送达) */
  roadside: 0.15,
  burst: 3,
  /** 连摇:相邻两次有效摇树不超过这么多秒才算连上 */
  comboWindow: 0.6,
  /** 连摇每一击对价值的加成(+0.8%),最多算 comboMax 击 */
  comboStep: 0.004,
  comboMax: 30,
  /** 摇劲产生的产出加成上限(摇满时 produce × (1+x)),按产出档递减 */
  maxByTier: [2.19, 1.89, 1.6, 1.3, 1.0],
};

/** 升到新一档时白送的单位数(不然手摇掉量随档下降,升档会越升越亏) */
export const TIER_START_UNITS = 3;

/** 每条线每一档最多买多少个单位(买满了就只能升档/扩建/换道具;不再无脑堆旧档) */
export const UNIT_MAX = 12;

/** 扩建:某档单位数达到 units[i] 时可买一次,价 = 该档第一个单位的价 × cost[i],买了该线该档产出/运力 ×mult */
export const EXPAND = {
  units: [4, 7, 10],
  cost: [3, 6, 12],
  mult: 1.5,
  names: ['加固', '扩建', '大扩建'],
};

/**
 * 老徐:可升级的角色,8 级(1 喊加油 2 打拍子 3 鼓掌 4 伸手帮忙 5 正经摇树 6 掏马扎 7 带徒弟 8 退休顾问),档名文案见 src/content/laoxu.ts。
 * 每级的自动摇树频率 = equiv[级] × rate(次/秒,效果同手动但没有连摇);equiv 是"相当于旧版几位老徐"。
 * 升到第 L 级的价格 = 旧版第 equiv[L-1]+1 … equiv[L] 位老徐的价格之和(baseCost × growth^i),所以总花费与旧曲线一致;
 * 第 6、7 级会偷懒(sys/laoxu.ts),所以 equiv 略高于旧曲线按比例,把偷懒损失补回来;第 8 级频率 12(徒弟接班)并带全体加成 bonus。
 */
export const HELPER = {
  name: '老徐',
  unit: '级',
  joke: '老徐退休了,闲着也是闲着,帮你摇两下。',
  rate: 0.3,
  /** 最高级 */
  max: 8,
  /** 各级相当于旧版几位老徐(下标=级,0 级为 0) */
  equiv: [0, 1, 2, 3, 4, 6, 9, 11, 12] as readonly number[],
  baseCost: 400,
  growth: 2.2,
  /** 第 8 级价格 */
  /** 第 8 级(退休顾问)的全体加成:产出线 produce × 运输时间 time(≈ +3.5%) */
  bonus: { produce: 1.02, time: 0.985 },
  /** 产出档 ≥ 这个才能雇 */
  unlockTier: 1,
};
/** 旧版 n 位老徐的累计价格 */
export const helperOldTotal = (n: number): number => {
  let c = 0;
  for (let i = 0; i < n; i++) c += Math.floor(HELPER.baseCost * Math.pow(HELPER.growth, i));
  return c;
};

/** 堆场容量 = max(STOCK_MIN, STOCK_SECONDS × 不含摇劲的产出) × 加成 */
export const STOCK_SECONDS = 60;
export const STOCK_MIN = 30;

// ───────────────────────── 产出线 ─────────────────────────
const withPair = <T extends { branches: [BranchDef, BranchDef] | null }>(defs: Omit<T, 'pair'>[]): T[] =>
  defs.map((d) => ({ ...d, pair: d.branches ? `${d.branches[0].name} 或 ${d.branches[1].name}` : '' }) as unknown as T);

export const SOURCE_TIERS: SourceTierDef[] = withPair<SourceTierDef>([
  {
    name: '小树', unit: '棵树', rate: 1, baseCost: 10, growth: 1.12, tierCost: 0, branches: null,
    joke: '一棵树,一个你,一点耐心。',
  },
  {
    name: '老树', unit: '棵老树', rate: 38, baseCost: 6400, growth: 1.12, tierCost: 6400,
    joke: '粗了,老了,木牌上写着"请勿攀爬"。',
    branches: [
      { name: '密植', joke: '枝多果小,挤挤挨挨,谁也别想偷懒。', effect: { produce: 1.3 } },
      { name: '粗壮', joke: '枝少果大,一摇就掉个大的。树表示压力很大。', effect: { shake: 2.5, fw: 1.2 } },
    ],
  },
  {
    name: '巨树', unit: '棵巨树', rate: 459, baseCost: 60000, growth: 1.12, tierCost: 60000,
    joke: '软梯挂下来,树屋亮着灯。老徐已经上去了。',
    branches: [
      { name: '密植', joke: '树屋住满了,枝也长满了,果子小但是多。', effect: { produce: 1.3 } },
      { name: '粗壮', joke: '枝少,果大,老徐在树屋里也摇得更勤了。', effect: { auto: 2, produce: 1.05 } },
    ],
  },
  {
    name: '云树', unit: '棵云树', rate: 4590, baseCost: 5000000, growth: 1.12, tierCost: 5000000,
    joke: '树冠进了云里。吊篮缆绳一晃一晃,云表示:别蹭我。',
    branches: [
      { name: '密植', joke: '云里全是枝,苹果多得像下雨。', effect: { produce: 1.35 } },
      { name: '粗壮', joke: '云里只有几根粗枝,每个苹果都跟云一样大。', effect: { value: 1.4, produce: 0.9 } },
    ],
  },
  {
    name: '星树', unit: '棵星树', rate: 55080, baseCost: 1000000000, growth: 1.12, tierCost: 1000000000,
    joke: '树顶挂着星星彩灯,苹果夜里自己发光。',
    branches: [
      { name: '密植', joke: '满树彩灯,果多光多,电费算星星的。', effect: { floor: 0.3, produce: 1.25 } },
      { name: '粗壮', joke: '几个大果各占一颗星,谁也不让谁。', effect: { value: 1.6, stock: 3 } },
    ],
  },
]);

/** 产出档 id(树 5 档原地进化,与 src/art/nature 对应) */
export const SOURCE_IDS = ['sapling', 'old', 'giant', 'cloud', 'star'] as const;
export type SourceId = (typeof SOURCE_IDS)[number];
/** 产出分支 id:branch 0 = 密植(枝多果小),1 = 粗壮(枝少果大);美术变体 = `${SourceId}-${dense|thick}` */
export const SOURCE_BRANCH_IDS = ['dense', 'thick'] as const;

// ───────────────────────── 运输线 ─────────────────────────
export const ROUTE_TIERS: RouteTierDef[] = withPair<RouteTierDef>([
  {
    name: '篮子', unit: '只篮子', cap: 6, trip: 5, baseCost: 10, growth: 1.12, tierCost: 0, branches: null,
    joke: '提着走。累了就换只手。',
  },
  {
    name: '挑扁担工', unit: '位挑担工', cap: 84, trip: 5.5, baseCost: 1400, growth: 1.12, tierCost: 1600,
    joke: '两头一挑,走得慢,但稳。苹果在筐里跟着扁担颤。',
    branches: [
      { name: '加粗扁担', joke: '扁担粗了,筐子大了,腰有意见。', effect: { cap: 1.5, time: 1.1 } },
      { name: '小碎步', joke: '碎步小跑,筐不晃,苹果不撒。', effect: { time: 0.72 } },
    ],
  },
  {
    name: '小推车', unit: '辆小推车', cap: 432, trip: 6, baseCost: 54000, growth: 1.12, tierCost: 58000,
    joke: '带轮子的篮子。轮子有一个会吱呀叫。',
    branches: [
      { name: '重载板车', joke: '载得多,走得慢,像极了周一。', effect: { cap: 1.5, time: 1.1 } },
      { name: '轻快轮', joke: '轮子上了油,苹果上了心。', effect: { time: 0.72 } },
    ],
  },
  {
    name: '卡车', unit: '辆卡车', cap: 6105, trip: 7, baseCost: 490000, growth: 1.12, tierCost: 540000,
    joke: '突突突。喇叭比苹果先到。',
    branches: [
      { name: '重卡', joke: '大板车壮汉,轮胎比你高两个头。', effect: { cap: 1.5, stock: 1.5 } },
      { name: '小皮卡', joke: '小皮卡骑手,过路费苹果出,收费站很满意。', effect: { time: 0.72 } },
    ],
  },
  {
    name: '货船', unit: '艘货船', cap: 78489, trip: 9, baseCost: 44000000, growth: 1.12, tierCost: 44000000,
    joke: '苹果出海了。苹果:我晕船。',
    branches: [
      { name: '集装箱', joke: '一个箱子装一万个苹果,海关数得很累。', effect: { cap: 1.5, stock: 1.5 } },
      { name: '快艇', joke: '海鸥追着跑,没追上。', effect: { time: 0.7 } },
    ],
  },
  {
    name: '直升机', unit: '架直升机', cap: 175500, trip: 10, baseCost: 150000000, growth: 1.12, tierCost: 160000000,
    joke: '吊在半空,堵车跟它没关系。',
    branches: [
      { name: '吊篮', joke: '一根粗绳吊一大篮,地上的车只能抬头看。', effect: { cap: 1.5, stock: 1.5 } },
      { name: '双旋翼', joke: '两副螺旋桨抢着转,噪音翻倍,速度也是。', effect: { time: 0.7 } },
    ],
  },
  {
    name: '飞机', unit: '架飞机', cap: 390150, trip: 11, baseCost: 540000000, growth: 1.12, tierCost: 540000000,
    joke: '苹果第一次坐头等舱,没人跟它说话。',
    branches: [
      { name: '货机', joke: '机舱里没座位,全是苹果。', effect: { cap: 1.5, stock: 1.5 } },
      { name: '超音速', joke: '苹果落地之前,声音还没到。', effect: { time: 0.7 } },
    ],
  },
  {
    name: '传送门', unit: '道传送门', cap: 1377000, trip: 13, baseCost: 8900000000, growth: 1.12, tierCost: 8900000000,
    joke: '这头一个苹果,那头还是一个苹果。物理学家沉默了。',
    branches: [
      { name: '大口径', joke: '门开得大,苹果挤着过。', effect: { cap: 1.5 } },
      { name: '零延迟', joke: '没有"路上",只有"到了"。', effect: { time: 0.67 } },
    ],
  },
]);

/** 每条线的档数:产出 5 档(树原地进化),运输 8 档 */
export const TIER_COUNTS: Record<Line, number> = { source: SOURCE_TIERS.length, route: ROUTE_TIERS.length };
export const maxTier = (line: Line): number => TIER_COUNTS[line] - 1;
/** 运输档 → "时代"刻度(basket0 cart1 truck2 ship3 plane4 portal5),
 *  era / 新闻时代 / sys 的 era 一律用 source.tier + ROUTE_ERA[route.tier]。era 范围 0..9。 */
export const ROUTE_ERA: readonly number[] = [0, 0, 1, 2, 3, 3, 4, 5];
/** 运输档 id(与 src/art/things 的运输档对应) */
export const ROUTE_IDS = ['basket', 'porter', 'cart', 'truck', 'ship', 'helicopter', 'plane', 'portal'] as const;
export type RouteId = (typeof ROUTE_IDS)[number];
/** 运输分支美术变体 id:ROUTE_VARIANTS[routeId][branch](basket 无分支) */
export const ROUTE_VARIANTS: Record<RouteId, readonly [string, string] | null> = {
  basket: null,
  porter: ['broad-pole', 'quick-step'],
  cart: ['heavy-cart', 'light-wheel'],
  truck: ['heavy-truck', 'pickup'],
  ship: ['container', 'speedboat'],
  helicopter: ['basket-lift', 'twin-rotor'],
  plane: ['cargo', 'supersonic'],
  portal: ['wide', 'zero-lag'],
};
/** 每条线每档最多画多少辆车/个单位(多的合并成"车队",权重 > 1) */
export const MAX_CONVOYS = 24;

/** 把一个效果写成一行中文,UI 直接用 */
export function describeEffect(e: Effect): string {
  const parts: string[] = [];
  const x = (n: number) => `×${Math.round(n * 100) / 100}`;
  if (e.produce) parts.push(`产量 ${x(e.produce)}`);
  if (e.value) parts.push(`价值 ${x(e.value)}`);
  if (e.cap) parts.push(`每趟容量 ${x(e.cap)}`);
  if (e.time) parts.push(`每趟用时 ${x(e.time)}`);
  if (e.stock) parts.push(`堆场 ${x(e.stock)}`);
  if (e.fw) parts.push(`摇劲上限 ${x(e.fw)}`);
  if (e.floor) parts.push(`摇劲保底 ${Math.round(e.floor * 100)}%`);
  if (e.shake) parts.push(`每摇掉落 ${x(e.shake)}`);
  if (e.auto) parts.push(`老徐摇速 ${x(e.auto)}`);
  if (e.combo) parts.push(`连摇加成 ${x(e.combo)}`);
  return parts.join(' · ');
}
