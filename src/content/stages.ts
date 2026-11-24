// v6 阶段文案(纯数据):产出线 5 档(树原地进化)、阶段说明卡(王国保卫战式,每阶段一次)。
// 用途:
//   SOURCE_TEXT   产出线 5 档的名字/单位/笑话/分支(每档两条:密植=枝多果小 / 粗壮=枝少果大)/升档 toast。
//   STAGE_CARDS   进入新阶段时暂停约 1 秒弹出的手绘小卡片:标题 ≤30 字 + 说明 ≤40 字。每张只弹一次。
//                 共 14 张 = 产出线 5 + 运输线 8 + 终点收货站 1。说明卡里不放数字,只说"多了什么"。
// 运输线文字在 route.ts(ROUTE_TEXT)。终点站、小鸟台词在 finale.ts。
// 约束:name ≤5 字;分支 joke ≤24 字;drop(摇一下掉多少)只用抽象描述。

export type SourceId = 'sapling' | 'oldtree' | 'giant' | 'cloud' | 'star';

export interface SourceBranchText {
  name: string;
  joke: string;
  /** 外观(美术/动画用,不上屏) */
  look: string;
}

export interface SourceText {
  id: SourceId;
  name: string;
  unit: string;
  joke: string;
  /** 升档点二选一的短标题 */
  pair: string;
  /** 摇一下大致掉多少(抽象描述,给提示/说明卡用) */
  drop: string;
  /** 外观进化(美术用) */
  look: string;
  branches: [SourceBranchText, SourceBranchText];
  /** 升到这一档时的 toast */
  upToasts: string[];
}

/** 下标 = SOURCE_TIERS 下标 */
export const SOURCE_TEXT: SourceText[] = [
  {
    id: 'sapling', name: '小树', unit: '棵树', joke: '一棵树,一个你,一点耐心。',
    pair: '多枝 或 壮干', drop: '一两个', look: '细干,几根小枝',
    branches: [
      { name: '多枝苗', joke: '枝丫多,果子小,热闹。', look: '细枝密,苹果偏小' },
      { name: '壮干苗', joke: '枝少干粗,一个顶两个。', look: '枝少,苹果偏大' },
    ],
    upToasts: [],
  },
  {
    id: 'oldtree', name: '老树', unit: '棵老树', joke: '树龄长了,脾气也长了。树干上多了块木牌。',
    pair: '密冠 或 粗枝', drop: '一小串', look: '粗干,两根大枝,挂木牌',
    branches: [
      { name: '密冠', joke: '冠密得像头发,苹果躲在里面。', look: '树冠密,果小而多' },
      { name: '粗枝', joke: '粗枝上挂几个大的,压弯了腰。', look: '大枝少,果大而沉' },
    ],
    upToasts: ['树又长粗一圈。木牌歪了,没人扶。', '老树开枝了。它自己也很意外。'],
  },
  {
    id: 'giant', name: '巨树', unit: '棵巨树', joke: '大到要搭软梯,树屋里住进了松鼠。',
    pair: '千枝 或 撑天枝', drop: '一整枝', look: '软梯、树屋,枝条向外伸',
    branches: [
      { name: '千枝', joke: '枝多得树屋都找不到门。', look: '枝条繁密,树屋被藏起来' },
      { name: '撑天枝', joke: '就几根大枝,每根挂一串胖果。', look: '几根大枝撑开,果串肥大' },
    ],
    upToasts: ['软梯垂下来了。老徐:我先上。', '树屋有了新住户:松鼠,不付租。'],
  },
  {
    id: 'cloud', name: '云树', unit: '棵云树', joke: '树冠钻进云里。老徐在吊篮里喊话,云听不见。',
    pair: '云絮冠 或 云顶枝', drop: '一阵苹果雨', look: '树冠入云,吊篮缆绳',
    branches: [
      { name: '云絮冠', joke: '果小而多,像云里的碎星。', look: '云中小果密布' },
      { name: '云顶枝', joke: '果少而大,一颗压弯一片云。', look: '云顶几颗大果,枝压弯' },
    ],
    upToasts: ['树冠钻进了云。飞机请绕行。', '吊篮挂上了云边。老徐在里面泡茶。'],
  },
  {
    id: 'star', name: '星树', unit: '棵星树', joke: '树上挂满星灯。苹果自己会发光,省了电费。',
    pair: '繁星串 或 巨星果', drop: '一场大苹果雨', look: '星星彩灯,苹果发光',
    branches: [
      { name: '繁星串', joke: '小苹果一串串,像挂灯。', look: '星灯般的小果串' },
      { name: '巨星果', joke: '大苹果一颗颗,自带灯光。', look: '少量大果,各自发光' },
    ],
    upToasts: ['树上亮了。远处的人以为是圣诞。', '星灯挂满了树。苹果也跟着亮起来。'],
  },
];

/** 说明卡所属线路 */
export type StageLine = 'source' | 'route' | 'station';

export interface StageCard {
  id: string;
  line: StageLine;
  /** 产出线/运输线的档位下标;station 为 0 */
  tier: number;
  /** 弹出条件(人话,供程序对接):第一次到达该档 */
  when: string;
  /** ≤30 字 */
  title: string;
  /** ≤40 字,不放数字 */
  body: string;
}

export const STAGE_CARDS: StageCard[] = [
  // ── 产出线:树原地进化 ──
  { id: 'src-0', line: 'source', tier: 0, when: '新存档第一次进入游戏', title: '一棵小树,一个你', body: '摇一摇,掉一两个。苹果在树脚堆着,是你的库存。' },
  { id: 'src-1', line: 'source', tier: 1, when: '产出线第一次升到老树', title: '树长粗了,老徐站稳了', body: '一摇掉一小串。树干上多了块木牌。' },
  { id: 'src-2', line: 'source', tier: 2, when: '产出线第一次升到巨树', title: '大树长出了软梯和树屋', body: '一摇掉一整枝。老徐顺着软梯爬了上去。' },
  { id: 'src-3', line: 'source', tier: 3, when: '产出线第一次升到云树', title: '树冠钻进了云里', body: '一摇下苹果雨。云边挂着吊篮,老徐在里面。' },
  { id: 'src-4', line: 'source', tier: 4, when: '产出线第一次升到星树', title: '树上挂满了星星灯', body: '苹果自己会发光。这一摇,下的是大苹果雨。' },
  // ── 运输线:装货→行驶→卸货→返回 ──
  { id: 'rt-0', line: 'route', tier: 0, when: '运输线第一次出现篮子(新存档)', title: '篮子:最早的运输', body: '装满就走,送到就回。苹果在树脚等着。' },
  { id: 'rt-1', line: 'route', tier: 1, when: '运输线第一次升到挑扁担工', title: '扁担上肩', body: '挑担工一趟挑得多,来回也快些。' },
  { id: 'rt-2', line: 'route', tier: 2, when: '运输线第一次升到小推车', title: '车轮来了', body: '推车来回更快。车一多,路上会排起队。' },
  { id: 'rt-3', line: 'route', tier: 3, when: '运输线第一次升到卡车', title: '突突突,卡车来了', body: '一车拉很多。路上有了车队,喇叭比苹果先到。' },
  { id: 'rt-4', line: 'route', tier: 4, when: '运输线第一次升到货船', title: '苹果出海了', body: '货船慢,但一趟顶好几趟。海鸥在后面追。' },
  { id: 'rt-5', line: 'route', tier: 5, when: '运输线第一次升到直升机', title: '头顶有了运输线', body: '直升机不堵车。装货卸货,都悬在半空。' },
  { id: 'rt-6', line: 'route', tier: 6, when: '运输线第一次升到飞机', title: '天上有了航线', body: '飞机又快又大。苹果:我要靠窗。' },
  { id: 'rt-7', line: 'route', tier: 7, when: '运输线第一次升到传送门', title: '推开那道门', body: '没有"路上"了,只剩装货和卸货。' },
  // ── 终点 ──
  { id: 'station', line: 'station', tier: 0, when: '第一次有苹果送到终点(运输线第一趟卸货)', title: '终点:圣诞老人收货站', body: '苹果在这里装成包裹,小精灵传给雪橇。礼物堆越高,越近圣诞。' },
];

/** 说明卡通用文案 */
export const STAGE_CARD_UI = {
  /** 弹出时暂停约多少毫秒(程序用) */
  pauseMs: 1000,
  tapHint: '点任意处继续',
  button: '知道了',
  /** 图鉴/设置里"重看说明卡"入口(可选) */
  replay: '重看说明卡',
};
