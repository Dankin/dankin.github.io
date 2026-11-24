// 运输线(9 档)与产出线升档文案(纯数据)。
// 用途:src/core/content.ts 的 ROUTE_TIERS / SOURCE_TIERS 里的 name/unit/joke/分支名/分支 joke/pair 可直接取这里的字。
//       id 与数值不在这里,只管字。档位顺序 = ROUTE_TIERS 下标:
//       0 basket 1 porter 2 cart 3 trampoline 4 truck 5 ship 6 helicopter 7 plane 8 portal
// 约束:name ≤5 字;unit 带量词;joke ≤30 字;分支 joke ≤24 字;pair(升档点二选一的短标题)≤10 字。
// 未改动的旧档(basket/cart/truck/ship/plane/portal)文字原样搬来,只补了 pair。

export type RouteId = 'basket' | 'porter' | 'cart' | 'trampoline' | 'truck' | 'ship' | 'helicopter' | 'plane' | 'portal';

export interface BranchText { name: string; joke: string }
export interface TierText {
  id: RouteId;
  name: string;
  unit: string;
  joke: string;
  /** 升档点二选一的短标题(第一档无) */
  pair: string;
  branches: [BranchText, BranchText] | null;
  /** 升到这一档时的 toast(2–3 条,随机一条) */
  upToasts: string[];
}

export const ROUTE_TEXT: TierText[] = [
  {
    id: 'basket', name: '篮子', unit: '只篮子', joke: '提着走。累了就换只手。', pair: '', branches: null,
    upToasts: [],
  },
  {
    id: 'porter', name: '挑扁担工', unit: '位挑担工', joke: '两头一挑,走得慢,但稳。苹果在筐里跟着扁担颤。',
    pair: '挑得多 或 走得快',
    branches: [
      { name: '加粗扁担', joke: '扁担粗了,筐子大了,腰有意见。' },
      { name: '小碎步', joke: '碎步小跑,筐不晃,苹果不撒。' },
    ],
    upToasts: [
      '有人来挑担了。他说工钱按苹果算。',
      '扁担上肩,吱呀一声。苹果跟着颤。',
      '篮子退休了。扁担接班。',
    ],
  },
  {
    id: 'cart', name: '小推车', unit: '辆小推车', joke: '带轮子的篮子。轮子有一个会吱呀叫。',
    pair: '载得多 或 跑得快',
    branches: [
      { name: '重载板车', joke: '载得多,走得慢,像极了周一。' },
      { name: '轻快轮', joke: '轮子上了油,苹果上了心。' },
    ],
    upToasts: ['篮子长出了两个轮子。', '推车来了,吱呀声是原装的。'],
  },
  {
    id: 'trampoline', name: '蹦床', unit: '张蹦床', joke: '一蹦老远。落地总少一两个苹果,没人问去哪了。',
    pair: '弹得远 或 兜得住',
    branches: [
      { name: '高弹网', joke: '弹得又高又远,有的直接弹进了邻居家。' },
      { name: '兜底网', joke: '底下兜了张网,稳了,就是没那么高。' },
    ],
    upToasts: [
      '院子里支起了蹦床。苹果:我先来!',
      '蹦床开张。老徐说他只看,不蹦。',
      '苹果一跳,就跳过了半条路。',
    ],
  },
  {
    id: 'truck', name: '卡车', unit: '辆卡车', joke: '突突突。喇叭比苹果先到。',
    pair: '拉得多 或 过得快',
    branches: [
      { name: '重卡', joke: '轮胎比你高两个头,喇叭是首交响乐。' },
      { name: '高速通行证', joke: '过路费苹果出,收费站很满意。' },
    ],
    upToasts: ['突突突,卡车来了,喇叭比苹果先到。', '路上多了辆卡车。路边的人都在看苹果。'],
  },
  {
    id: 'ship', name: '货船', unit: '艘货船', joke: '苹果出海了。苹果:我晕船。',
    pair: '装得多 或 开得快',
    branches: [
      { name: '集装箱', joke: '一个箱子装一万个苹果,海关数得很累。' },
      { name: '快艇', joke: '海鸥追着跑,没追上。' },
    ],
    upToasts: ['苹果出海了。海没意见。', '汽笛一响,货船离岸,海鸥紧跟。'],
  },
  {
    id: 'helicopter', name: '直升机', unit: '架直升机', joke: '吊在半空,堵车跟它没关系。',
    pair: '吊得多 或 飞得快',
    branches: [
      { name: '吊篮', joke: '一根粗绳吊一大篮,地上的车只能抬头看。' },
      { name: '双旋翼', joke: '两副螺旋桨抢着转,噪音翻倍,速度也是。' },
    ],
    upToasts: [
      '头顶嗡嗡响。直升机来了,堵车的人抬头看。',
      '苹果坐上了吊篮。风吹得它发懵。',
      '直升机悬在半空,老徐的帽子飞了。',
    ],
  },
  {
    id: 'plane', name: '飞机', unit: '架飞机', joke: '苹果第一次坐头等舱,没人跟它说话。',
    pair: '运得多 或 飞得快',
    branches: [
      { name: '货机', joke: '机舱里没座位,全是苹果。' },
      { name: '超音速', joke: '苹果落地之前,声音还没到。' },
    ],
    upToasts: ['天上有了航线。苹果:我要靠窗。', '飞机起飞了。云被苹果香熏了一路。'],
  },
  {
    id: 'portal', name: '传送门', unit: '道传送门', joke: '这头一个苹果,那头还是一个苹果。物理学家沉默了。',
    pair: '开得大 或 零延迟',
    branches: [
      { name: '大口径', joke: '门开得大,苹果挤着过。' },
      { name: '零延迟', joke: '没有"路上",只有"到了"。' },
    ],
    upToasts: ['推开那道门,里面还是苹果。', '传送门亮了。路不见了,苹果还在。'],
  },
];

export const ROUTE_TEXT_BY_ID: Record<RouteId, TierText> = Object.fromEntries(
  ROUTE_TEXT.map((t) => [t.id, t]),
) as Record<RouteId, TierText>;

/** 产出线(source)升档点二选一的短标题,下标 = SOURCE_TIERS 下标(0 无) */
export const SOURCE_PAIR_TEXT: string[] = [
  '',
  '种得密 或 摇得狠',
  '分层种 或 收徒弟',
  '盖高楼 或 种在楼里',
  '星球自转 或 引力聚拢',
  '双生门 或 苹果税',
];

/** 路线与新闻/彩蛋联动用的标签名(与 news.ts 的 NEWS_TAGS 对齐) */
export const ROUTE_NEWS_TAGS = {
  porter: 'tier-porter',
  trampoline: 'tier-trampoline',
  helicopter: 'tier-helicopter',
} as const;
