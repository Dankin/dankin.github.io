// 运输线(v6:8 档,每档两个分支)的文案(纯数据)。
// 用途:src/core/content.ts 的 ROUTE_TIERS 里的 name/unit/joke/分支名/分支 joke/pair 直接取这里的字。
//       id 与数值不在这里,只管字。档位顺序 = ROUTE_TIERS 下标:
//       0 basket 1 porter 2 cart 3 truck 4 ship 5 helicopter 6 plane 7 portal(蹦床已删)
// 分支 = 同一档共用底盘,换车身/司机造型:branches[i].look 一句话描述造型,给美术/动画对口型,不上屏。
// 约束:name ≤5 字;unit 带量词;joke ≤30 字;分支 joke ≤24 字;pair(升档点二选一的短标题)≤10 字。

export type RouteId = 'basket' | 'porter' | 'cart' | 'truck' | 'ship' | 'helicopter' | 'plane' | 'portal';

export interface BranchText {
  name: string;
  joke: string;
  /** 造型描述(美术/动画用,不上屏) */
  look: string;
}
export interface TierText {
  id: RouteId;
  name: string;
  unit: string;
  joke: string;
  /** 升档点二选一的短标题 */
  pair: string;
  branches: [BranchText, BranchText];
  /** 升到这一档时的 toast(2–3 条,随机一条) */
  upToasts: string[];
}

export const ROUTE_TEXT: TierText[] = [
  {
    id: 'basket', name: '篮子', unit: '只篮子', joke: '提着走。累了就换只手。',
    pair: '挎着走 或 背着走',
    branches: [
      { name: '小竹篮', joke: '小孩挎着,蹦蹦跳跳,撒一路。', look: '竹篮,穿红棉袄的小孩挎在臂弯,小跑' },
      { name: '大背篓', joke: '大叔背着,一步一晃,稳。', look: '高背篓,大叔弯腰背着,步子沉' },
    ],
    upToasts: [],
  },
  {
    id: 'porter', name: '挑扁担工', unit: '位挑担工', joke: '两头一挑,走得慢,但稳。苹果在筐里跟着扁担颤。',
    pair: '挑得多 或 走得快',
    branches: [
      { name: '加粗扁担', joke: '扁担粗了,筐子大了,腰有意见。', look: '粗扁担、大圆筐,壮汉一步一吱呀' },
      { name: '小碎步', joke: '碎步小跑,筐不晃,苹果不撒。', look: '细扁担、小筐,瘦个子小碎步' },
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
      { name: '重载板车', joke: '载得多,走得慢,像极了周一。', look: '双轮木板车,胖师傅弯腰往前拱' },
      { name: '独轮飞车', joke: '轮子上了油,小伙子跑出残影。', look: '单轮小车,年轻人小跑,轮子冒风' },
    ],
    upToasts: ['篮子长出了两个轮子。', '推车来了,吱呀声是原装的。'],
  },
  {
    id: 'truck', name: '卡车', unit: '辆卡车', joke: '突突突。喇叭比苹果先到。',
    pair: '拉得多 或 过得快',
    branches: [
      { name: '大板车', joke: '车比人高两个头,壮汉开得很稳。', look: '敞篷大板车,络腮胡壮汉,苹果堆成山' },
      { name: '小皮卡', joke: '车小路熟,骑手一路按铃。', look: '迷你皮卡,戴头盔的骑手,斗里苹果跳' },
    ],
    upToasts: ['突突突,卡车来了,喇叭比苹果先到。', '路上多了辆卡车。路边的人都在看苹果。'],
  },
  {
    id: 'ship', name: '货船', unit: '艘货船', joke: '苹果出海了。苹果:我晕船。',
    pair: '装得多 或 开得快',
    branches: [
      { name: '大驳船', joke: '船长很胖,船更胖。', look: '宽肚驳船,胖船长叼烟斗,甲板堆满箱' },
      { name: '小快艇', joke: '船员戴墨镜,海鸥追不上。', look: '尖头快艇,墨镜船员,尾浪翻白' },
    ],
    upToasts: ['苹果出海了。海没意见。', '汽笛一响,货船离岸,海鸥紧跟。'],
  },
  {
    id: 'helicopter', name: '直升机', unit: '架直升机', joke: '吊在半空,堵车跟它没关系。',
    pair: '吊得多 或 飞得快',
    branches: [
      { name: '吊篮机', joke: '一根粗绳吊一大篮,地上只能抬头。', look: '单旋翼,机腹吊大网兜,飞行员悠闲' },
      { name: '双旋翼', joke: '两副螺旋桨抢着转,帽子都飞了。', look: '前后双旋翼,货舱封闭,飞行员抓帽子' },
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
      { name: '货机', joke: '机舱里没座位,全是苹果。', look: '胖肚货机,舱门大开,地勤挥旗' },
      { name: '超音速', joke: '苹果落地之前,声音还没到。', look: '尖鼻喷气机,飞行员戴护目镜,拖白烟' },
    ],
    upToasts: ['天上有了航线。苹果:我要靠窗。', '飞机起飞了。云被苹果香熏了一路。'],
  },
  {
    id: 'portal', name: '传送门', unit: '道传送门', joke: '这头一个苹果,那头还是一个苹果。物理学家沉默了。',
    pair: '开得大 或 零延迟',
    branches: [
      { name: '大口径', joke: '门开得大,苹果挤着过。', look: '宽圆环,苹果成排被吸进去' },
      { name: '零延迟', joke: '没有"路上",只有"到了"。', look: '窄闪门,苹果一闪而过,留残光' },
    ],
    upToasts: ['推开那道门,里面还是苹果。', '传送门亮了。路不见了,苹果还在。'],
  },
];

export const ROUTE_TEXT_BY_ID: Record<RouteId, TierText> = Object.fromEntries(
  ROUTE_TEXT.map((t) => [t.id, t]),
) as Record<RouteId, TierText>;

/** 路线与新闻/彩蛋联动用的标签名(与 news.ts 的 NEWS_TAGS 对齐) */
export const ROUTE_NEWS_TAGS = {
  porter: 'tier-porter',
  helicopter: 'tier-helicopter',
} as const;
