// v4 全部内容与数值。想调平衡,只改这个文件(再跑 node scripts/sim.ts 看结果)。
//
// 模型:产出线(6 档)把苹果放进堆场,运输线(9 档)的车从堆场装货、开到终点、送达才结算。
// 吞吐 = min(产出, 运力)。每次升档要选 2 个分支之一;3 个道具槽可随时免费更换。

export type GateId = 'wash' | 'wax' | 'rush' | 'pack' | 'juice' | 'cold' | 'red' | 'belt' | 'brand' | 'glove' | 'chant';
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

export interface GateDef {
  id: GateId;
  name: string;
  joke: string;
  /** 产出档 + 运输档 之和 ≥ 此值时解锁 */
  unlockAt: number;
  effect: Effect;
  /** 红绳:相邻槽的道具效果以 1.x 次方放大 */
  adjacent?: number;
}

// ───────────────────────── 手动:摇树 ─────────────────────────
export const SHAKE = {
  /** 一下摇掉的苹果 = 1 + 当前产出(个/秒) × dropSec[产出档] × 手劲加成。后期手动只是调味。 */
  dropSec: [0.8, 0.59, 0.46, 0.37, 0.3, 0.25],
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
  comboStep: 0.008,
  comboMax: 30,
  /** 摇劲产生的产出加成上限(摇满时 produce × (1+x)),按产出档递减 */
  maxByTier: [2.19, 1.89, 1.6, 1.3, 1.01, 0.81],
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
  rate: 0.15,
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
    name: '一棵树', unit: '棵树', rate: 1, baseCost: 10, growth: 1.12, tierCost: 0, branches: null,
    joke: '一棵树,一个你,一点耐心。',
  },
  {
    name: '小果园', unit: '片果园', rate: 14, baseCost: 6400, growth: 1.12, tierCost: 6400,
    joke: '邻居家的树也加入了,没人通知邻居。',
    branches: [
      { name: '密植', joke: '树挨着树,谁也别想偷懒。', effect: { produce: 1.3 } },
      { name: '铁砂掌', joke: '手劲大了,一摇掉得满地都是。树表示压力很大。', effect: { shake: 2.5, fw: 1.2 } },
    ],
  },
  {
    name: '果山', unit: '座果山', rate: 170, baseCost: 60000, growth: 1.12, tierCost: 60000,
    joke: '整座山头都是苹果树。山表示:我是山,不是果园。',
    branches: [
      { name: '梯田', joke: '山坡分层种,连云都分到一块地。', effect: { produce: 1.3 } },
      { name: '老徐的徒弟', joke: '老徐收了徒弟,徒弟也收了徒弟。摇得更勤了。', effect: { auto: 2, produce: 1.05 } },
    ],
  },
  {
    name: '果城', unit: '座果城', rate: 1700, baseCost: 5000000, growth: 1.12, tierCost: 5000000,
    joke: '城里没有人,只有苹果和写字楼。',
    branches: [
      { name: '苹果大厦', joke: '一百层,每层一个苹果,电梯里全是果香。', effect: { value: 1.4, produce: 0.9 } },
      { name: '垂直农场', joke: '苹果不用晒太阳了,有灯。电费不在账上。', effect: { produce: 1.35 } },
    ],
  },
  {
    name: '果星', unit: '颗果星', rate: 6800, baseCost: 61000000, growth: 1.12, tierCost: 61000000,
    joke: '一整颗星球只种苹果。外星人路过,表示看不懂。',
    branches: [
      { name: '自转摇柄', joke: '整颗星球在替你摇。你可以歇会儿。', effect: { floor: 0.3, produce: 1.1 } },
      { name: '引力井', joke: '引力把苹果吸在一起,整整齐齐。', effect: { stock: 3, produce: 1.2 } },
    ],
  },
  {
    name: '苹果之门', unit: '道门', rate: 20400, baseCost: 1000000000, growth: 1.12, tierCost: 1000000000,
    joke: '推开门,里面还是苹果。再推开一道,还是。',
    branches: [
      { name: '双生门', joke: '一个苹果进去,两个出来。海关没发现。', effect: { produce: 1.5 } },
      { name: '苹果税', joke: '每个苹果过门都要交"路费"。苹果自己认的。', effect: { value: 1.6 } },
    ],
  },
]);

// ───────────────────────── 运输线 ─────────────────────────
export const ROUTE_TIERS: RouteTierDef[] = withPair<RouteTierDef>([
  {
    name: '篮子', unit: '只篮子', cap: 6, trip: 5, baseCost: 10, growth: 1.12, tierCost: 0, branches: null,
    joke: '提着走。累了就换只手。',
  },
  {
    name: '挑扁担工', unit: '位挑担工', cap: 31, trip: 5.5, baseCost: 1400, growth: 1.12, tierCost: 1600,
    joke: '两头一挑,走得慢,但稳。苹果在筐里跟着扁担颤。',
    branches: [
      { name: '加粗扁担', joke: '扁担粗了,筐子大了,腰有意见。', effect: { cap: 1.5, time: 1.1 } },
      { name: '小碎步', joke: '碎步小跑,筐不晃,苹果不撒。', effect: { time: 0.72 } },
    ],
  },
  {
    name: '小推车', unit: '辆小推车', cap: 160, trip: 6, baseCost: 54000, growth: 1.12, tierCost: 58000,
    joke: '带轮子的篮子。轮子有一个会吱呀叫。',
    branches: [
      { name: '重载板车', joke: '载得多,走得慢,像极了周一。', effect: { cap: 1.5, time: 1.1 } },
      { name: '轻快轮', joke: '轮子上了油,苹果上了心。', effect: { time: 0.72 } },
    ],
  },
  {
    name: '蹦床', unit: '张蹦床', cap: 600, trip: 6.5, baseCost: 160000, growth: 1.12, tierCost: 180000,
    joke: '一蹦老远。落地总少一两个苹果,没人问去哪了。',
    branches: [
      { name: '高弹网', joke: '弹得又高又远,有的直接弹进了邻居家。', effect: { time: 0.7, cap: 0.9 } },
      { name: '兜底网', joke: '底下兜了张网,稳了,就是没那么高。', effect: { cap: 1.4, time: 1.1 } },
    ],
  },
  {
    name: '卡车', unit: '辆卡车', cap: 2261, trip: 7, baseCost: 490000, growth: 1.12, tierCost: 540000,
    joke: '突突突。喇叭比苹果先到。',
    branches: [
      { name: '重卡', joke: '轮胎比你高两个头,喇叭是首交响乐。', effect: { cap: 1.5, stock: 1.5 } },
      { name: '高速通行证', joke: '过路费苹果出,收费站很满意。', effect: { time: 0.72 } },
    ],
  },
  {
    name: '货船', unit: '艘货船', cap: 29070, trip: 9, baseCost: 44000000, growth: 1.12, tierCost: 44000000,
    joke: '苹果出海了。苹果:我晕船。',
    branches: [
      { name: '集装箱', joke: '一个箱子装一万个苹果,海关数得很累。', effect: { cap: 1.5, stock: 1.5 } },
      { name: '快艇', joke: '海鸥追着跑,没追上。', effect: { time: 0.7 } },
    ],
  },
  {
    name: '直升机', unit: '架直升机', cap: 65000, trip: 10, baseCost: 150000000, growth: 1.12, tierCost: 160000000,
    joke: '吊在半空,堵车跟它没关系。',
    branches: [
      { name: '吊篮', joke: '一根粗绳吊一大篮,地上的车只能抬头看。', effect: { cap: 1.5, stock: 1.5 } },
      { name: '双旋翼', joke: '两副螺旋桨抢着转,噪音翻倍,速度也是。', effect: { time: 0.7 } },
    ],
  },
  {
    name: '飞机', unit: '架飞机', cap: 144500, trip: 11, baseCost: 540000000, growth: 1.12, tierCost: 540000000,
    joke: '苹果第一次坐头等舱,没人跟它说话。',
    branches: [
      { name: '货机', joke: '机舱里没座位,全是苹果。', effect: { cap: 1.5, stock: 1.5 } },
      { name: '超音速', joke: '苹果落地之前,声音还没到。', effect: { time: 0.7 } },
    ],
  },
  {
    name: '传送门', unit: '道传送门', cap: 510000, trip: 13, baseCost: 8900000000, growth: 1.12, tierCost: 8900000000,
    joke: '这头一个苹果,那头还是一个苹果。物理学家沉默了。',
    branches: [
      { name: '大口径', joke: '门开得大,苹果挤着过。', effect: { cap: 1.5 } },
      { name: '零延迟', joke: '没有"路上",只有"到了"。', effect: { time: 0.67 } },
    ],
  },
]);

// ───────────────────────── 道具(关卡) ─────────────────────────
export const GATE_SLOTS = 3;
/** 红绳放大相邻道具效果用的指数 */
export const RED_EXP = 1.3;

export const GATES: GateDef[] = [
  { id: 'wash', name: '洗果', joke: '洗了一遍,看着确实贵了点。', unlockAt: 0, effect: { value: 1.3 } },
  { id: 'wax', name: '打蜡', joke: '亮得能照镜子。就是得等蜡干。', unlockAt: 0, effect: { value: 1.5, time: 1.2 } },
  { id: 'rush', name: '加急', joke: '快递小哥:今天的今天送。苹果:能不能慢点。', unlockAt: 0, effect: { time: 0.7, value: 0.95 } },
  { id: 'pack', name: '包装', joke: '一个苹果一层泡沫网,排面拉满。', unlockAt: 2, effect: { cap: 1.35 } },
  { id: 'juice', name: '榨汁', joke: '一个苹果榨两杯,另一杯是兑水的。', unlockAt: 3, effect: { produce: 2.4, value: 0.65 } },
  { id: 'cold', name: '冷链', joke: '凉快,而且堆场能多放五倍。苹果不闹了,摇劲也不容易散。', unlockAt: 4, effect: { stock: 5, floor: 0.2, produce: 1.2 } },
  { id: 'red', name: '红绳', joke: '邻居有福了。自己没什么用,就是好看。', unlockAt: 5, effect: {}, adjacent: RED_EXP },
  { id: 'belt', name: '流水线', joke: '排好队,苹果们。别挤,别插队。', unlockAt: 6, effect: { produce: 1.45, time: 0.85 } },
  { id: 'glove', name: '摇树手套', joke: '防滑,防刺,防手疼。就是看着有点傻。', unlockAt: 1, effect: { shake: 1.5, fw: 1.1 } },
  { id: 'chant', name: '号子', joke: '嘿哟嘿哟,一起摇。邻居以为村里在办节。', unlockAt: 3, effect: { combo: 2, shake: 1.2 } },
  { id: 'brand', name: '品牌', joke: '贴一个小标,价格翻一倍,苹果没变。', unlockAt: 7, effect: { value: 2.4, cap: 0.85 } },
];

export const gateDef = (id: GateId): GateDef => GATES.find((g) => g.id === id)!;

/** 每条线的档数:产出 6 档,运输 9 档(挑扁担工/蹦床/直升机是 v5 加的中间档) */
export const TIER_COUNTS: Record<Line, number> = { source: SOURCE_TIERS.length, route: ROUTE_TIERS.length };
export const maxTier = (line: Line): number => TIER_COUNTS[line] - 1;
/** 运输档 → 旧 6 档"时代"刻度(basket0 cart1 truck2 ship3 plane4 portal5),
 *  era / 道具解锁 / 新闻时代 / sys 的 era 一律用 source.tier + ROUTE_ERA[route.tier],不随新增中间档漂移。 */
export const ROUTE_ERA: readonly number[] = [0, 0, 1, 1, 2, 3, 3, 4, 5];
/** 运输档 id(与 src/art/things 的运输档对应) */
export const ROUTE_IDS = ['basket', 'porter', 'cart', 'trampoline', 'truck', 'ship', 'helicopter', 'plane', 'portal'] as const;
export type RouteId = (typeof ROUTE_IDS)[number];
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

export function describeGate(g: GateDef): string {
  const d = describeEffect(g.effect);
  return g.adjacent ? `相邻道具效果放大(指数 ${g.adjacent})` : d;
}
