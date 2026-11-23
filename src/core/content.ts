// v4 全部内容与数值。想调平衡,只改这个文件(再跑 node scripts/sim.ts 看结果)。
//
// 模型:产出线(6 档)把苹果放进堆场,运输线(6 档)的车从堆场装货、开到终点、送达才结算。
// 吞吐 = min(产出, 运力)。每次升档要选 2 个分支之一;3 个道具槽可随时免费更换。

export type GateId = 'wash' | 'wax' | 'rush' | 'pack' | 'juice' | 'cold' | 'red' | 'belt' | 'brand';
export type Line = 'source' | 'route';

/** 一组乘数。全部是"乘";没写的当 1。floor 是飞轮底限(取最大),不是乘数。 */
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
  /** 飞轮加成上限 */
  fw?: number;
  /** 飞轮保底(0..1):不摇也保持这么多储能 */
  floor?: number;
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

// ───────────────────────── 手动与飞轮 ─────────────────────────
export const FLY = {
  /** 每次点按增加的储能 */
  perClick: 0.14,
  /** 每转一整圈增加的储能 */
  perTurn: 0.12,
  /** 指数衰减(每秒 e^-decay) */
  decay: 0.2,
  /** 连击:两次"飞出去"之间超过这么多秒就断 */
  comboWindow: 2.5,
  /** 连击对价值的加成:每一击 +1%,最多 +30% */
  comboStep: 0.01,
  comboMax: 30,
  /** 储能产生的产出加成上限,按当前产出档递减(后期手动只是调味) */
  maxByTier: [1.71, 1.48, 1.25, 1.02, 0.79, 0.63],
};

/** 堆场容量 = max(STOCK_MIN, STOCK_SECONDS × 不含飞轮的产出) × 加成 */
export const STOCK_SECONDS = 60;
export const STOCK_MIN = 30;

// ───────────────────────── 产出线 ─────────────────────────
export const SOURCE_TIERS: SourceTierDef[] = [
  {
    name: '一棵树', unit: '棵树', rate: 1, baseCost: 10, growth: 1.127, tierCost: 0, branches: null,
    joke: '一棵树,一个你,一点耐心。',
  },
  {
    name: '小果园', unit: '片果园', rate: 14, baseCost: 5300, growth: 1.127, tierCost: 1100,
    joke: '邻居家的树也加入了,没人通知邻居。',
    branches: [
      { name: '密植', joke: '树挨着树,谁也别想偷懒。', effect: { produce: 1.3 } },
      { name: '精品', joke: '每个苹果都配了小标签和自我介绍。', effect: { value: 1.3 } },
    ],
  },
  {
    name: '果山', unit: '座果山', rate: 200, baseCost: 160000, growth: 1.127, tierCost: 32000,
    joke: '整座山头都是苹果树。山表示:我是山,不是果园。',
    branches: [
      { name: '梯田', joke: '山坡分层种,连云都分到一块地。', effect: { produce: 1.3 } },
      { name: '缆车', joke: '苹果坐缆车下山,比你还会享受。', effect: { time: 0.85, value: 1.05 } },
    ],
  },
  {
    name: '果城', unit: '座果城', rate: 3000, baseCost: 5000000, growth: 1.127, tierCost: 1000000,
    joke: '城里没有人,只有苹果和写字楼。',
    branches: [
      { name: '苹果大厦', joke: '一百层,每层一个苹果,电梯里全是果香。', effect: { value: 1.4, produce: 0.9 } },
      { name: '垂直农场', joke: '苹果不用晒太阳了,有灯。电费不在账上。', effect: { produce: 1.35 } },
    ],
  },
  {
    name: '果星', unit: '颗果星', rate: 45000, baseCost: 170000000, growth: 1.127, tierCost: 33000000,
    joke: '一整颗星球只种苹果。外星人路过,表示看不懂。',
    branches: [
      { name: '自转摇柄', joke: '整颗星球在替你摇。你可以歇会儿。', effect: { floor: 0.3, produce: 1.1 } },
      { name: '引力井', joke: '引力把苹果吸在一起,整整齐齐。', effect: { stock: 3, produce: 1.2 } },
    ],
  },
  {
    name: '苹果之门', unit: '道门', rate: 700000, baseCost: 5700000000, growth: 1.127, tierCost: 1100000000,
    joke: '推开门,里面还是苹果。再推开一道,还是。',
    branches: [
      { name: '双生门', joke: '一个苹果进去,两个出来。海关没发现。', effect: { produce: 1.5 } },
      { name: '苹果税', joke: '每个苹果过门都要交"路费"。苹果自己认的。', effect: { value: 1.6 } },
    ],
  },
];

// ───────────────────────── 运输线 ─────────────────────────
export const ROUTE_TIERS: RouteTierDef[] = [
  {
    name: '篮子', unit: '只篮子', cap: 5, trip: 5, baseCost: 10, growth: 1.127, tierCost: 0, branches: null,
    joke: '提着走。累了就换只手。',
  },
  {
    name: '小推车', unit: '辆小推车', cap: 84, trip: 6, baseCost: 5300, growth: 1.127, tierCost: 1100,
    joke: '带轮子的篮子。轮子有一个会吱呀叫。',
    branches: [
      { name: '重载板车', joke: '载得多,走得慢,像极了周一。', effect: { cap: 1.4, time: 1.1 } },
      { name: '轻快轮', joke: '轮子上了油,苹果上了心。', effect: { time: 0.8, value: 1.08 } },
    ],
  },
  {
    name: '卡车', unit: '辆卡车', cap: 1400, trip: 7, baseCost: 160000, growth: 1.127, tierCost: 34000,
    joke: '突突突。喇叭比苹果先到。',
    branches: [
      { name: '重卡', joke: '轮胎比你高两个头,喇叭是首交响乐。', effect: { cap: 1.35, stock: 1.5 } },
      { name: '高速通行证', joke: '过路费苹果出,收费站很满意。', effect: { time: 0.8, value: 1.08 } },
    ],
  },
  {
    name: '货船', unit: '艘货船', cap: 27000, trip: 9, baseCost: 5000000, growth: 1.127, tierCost: 1100000,
    joke: '苹果出海了。苹果:我晕船。',
    branches: [
      { name: '集装箱', joke: '一个箱子装一万个苹果,海关数得很累。', effect: { cap: 1.4, stock: 1.5 } },
      { name: '快艇', joke: '海鸥追着跑,没追上。', effect: { time: 0.75, value: 1.08 } },
    ],
  },
  {
    name: '飞机', unit: '架飞机', cap: 500000, trip: 11, baseCost: 170000000, growth: 1.127, tierCost: 35000000,
    joke: '苹果第一次坐头等舱,没人跟它说话。',
    branches: [
      { name: '货机', joke: '机舱里没座位,全是苹果。', effect: { cap: 1.4, stock: 1.5 } },
      { name: '超音速', joke: '苹果落地之前,声音还没到。', effect: { time: 0.7, value: 1.08 } },
    ],
  },
  {
    name: '传送门', unit: '道传送门', cap: 9000000, trip: 13, baseCost: 5600000000, growth: 1.127, tierCost: 1200000000,
    joke: '这头一个苹果,那头还是一个苹果。物理学家沉默了。',
    branches: [
      { name: '大口径', joke: '门开得大,苹果挤着过。', effect: { cap: 1.5 } },
      { name: '零延迟', joke: '没有"路上",只有"到了"。', effect: { time: 0.6, value: 1.05 } },
    ],
  },
];

// ───────────────────────── 道具(关卡) ─────────────────────────
export const GATE_SLOTS = 3;
/** 红绳放大相邻道具效果用的指数 */
export const RED_EXP = 1.3;

export const GATES: GateDef[] = [
  { id: 'wash', name: '洗果', joke: '洗了一遍,看着确实贵了点。', unlockAt: 0, effect: { value: 1.25 } },
  { id: 'wax', name: '打蜡', joke: '亮得能照镜子。就是得等蜡干。', unlockAt: 0, effect: { value: 1.6, time: 1.25 } },
  { id: 'rush', name: '加急', joke: '快递小哥:今天的今天送。苹果:能不能慢点。', unlockAt: 0, effect: { time: 0.65, value: 0.9 } },
  { id: 'pack', name: '包装', joke: '一个苹果一层泡沫网,排面拉满。', unlockAt: 2, effect: { cap: 1.2 } },
  { id: 'juice', name: '榨汁', joke: '一个苹果榨两杯,另一杯是兑水的。', unlockAt: 3, effect: { produce: 2.4, value: 0.65 } },
  { id: 'cold', name: '冷链', joke: '凉快,而且堆场能多放五倍。苹果不闹了,飞轮也不容易停。', unlockAt: 4, effect: { stock: 5, floor: 0.2, produce: 1.2 } },
  { id: 'red', name: '红绳', joke: '邻居有福了。自己没什么用,就是好看。', unlockAt: 5, effect: {}, adjacent: RED_EXP },
  { id: 'belt', name: '流水线', joke: '排好队,苹果们。别挤,别插队。', unlockAt: 6, effect: { produce: 1.3, time: 0.9 } },
  { id: 'brand', name: '品牌', joke: '贴一个小标,价格翻一倍,苹果没变。', unlockAt: 7, effect: { value: 2.2, cap: 0.8 } },
];

export const gateDef = (id: GateId): GateDef => GATES.find((g) => g.id === id)!;

export const TIER_COUNT = 6;
export const MAX_TIER = TIER_COUNT - 1;
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
  if (e.fw) parts.push(`储能上限 ${x(e.fw)}`);
  if (e.floor) parts.push(`储能保底 ${Math.round(e.floor * 100)}%`);
  return parts.join(' · ');
}

export function describeGate(g: GateDef): string {
  const d = describeEffect(g.effect);
  return g.adjacent ? `相邻道具效果放大(指数 ${g.adjacent})` : d;
}
