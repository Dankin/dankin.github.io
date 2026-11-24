// 界面文案:新手引导(前 10 分钟脚本)、章节来信与小目标、按钮/标签/提示/空状态/设置/图鉴/确认框。
// 纯数据(含 3 个小格式化函数)。中文,简短幽默。程序按 id 取字,不要在界面里再硬编码中文。
// 术语以 plan/10-design.md §1 为准:库存(仓库,可花) / 果堆(待运) / 已送出(得分) / 回收期 / 钉住 / 献果 / 防囤。
// 带 {n} {name} 的是模板,由调用方 replace;函数形式的已内置。

// ───────────────────────── 1 新手引导(前 10 分钟) ─────────────────────────
// 原则:无弹窗,只用旁白条、高亮、呼吸按钮、一次性 toast。at 是"从第一次摇树起"的目标秒数,
// 实际以 when 条件为准(条件先到则提前,到点条件没到则顺延),每步只触发一次。

export type FtueKind = 'narration' | 'hint' | 'highlight' | 'toast';
export interface FtueStep {
  id: string;
  /** 目标秒数(参考) */
  at: number;
  /** 人话触发条件,供程序实现 */
  when: string;
  kind: FtueKind;
  text: string;
  /** 高亮/呼吸的界面目标 */
  target?: string;
}

export const FTUE: FtueStep[] = [
  { id: 'ftue-shake', at: 0, when: '新存档进游戏,0 次摇树', kind: 'hint', text: '摇树', target: 'tree' },
  { id: 'ftue-open', at: 0, when: '同上,与摇树提示同时', kind: 'narration', text: '树不大,够你摇的。' },
  { id: 'ftue-stock', at: 1, when: '第一次摇下苹果', kind: 'highlight', text: '这是库存。苹果落地先进这里。', target: 'stock-bar' },
  { id: 'ftue-first-buy', at: 11, when: '库存够买第一件东西', kind: 'highlight', text: '买它。', target: 'first-buy-card' },
  { id: 'ftue-basket', at: 30, when: '第一个篮子到站(已送出首次增加)', kind: 'narration', text: '送出才算数。' },
  { id: 'ftue-water', at: 60, when: '完成首次购买', kind: 'narration', text: '花的是仓库,送出的不会少。' },
  { id: 'ftue-bird', at: 120, when: '第一次事件(强制为小鸟)', kind: 'toast', text: '有只小鸟飞过来了。点它。', target: 'event-bird' },
  { id: 'ftue-tier-up', at: 180, when: '第一次升档到老树', kind: 'toast', text: '树粗了一圈。二选一,选哪边都行。' },
  { id: 'ftue-laoxu', at: 240, when: '老徐解锁', kind: 'narration', text: '树下多了个人。他说他只是路过。' },
  { id: 'ftue-pin', at: 300, when: '图钉解锁', kind: 'highlight', text: '图钉:钉住的东西,不会因为你手滑而卖掉。', target: 'pin' },
  { id: 'ftue-order', at: 360, when: '出现第一张订单', kind: 'toast', text: '有人要货。送到了有奖,送不到没事。', target: 'orders' },
  { id: 'ftue-egg', at: 480, when: '第一个必现彩蛋(夏娃)被发现', kind: 'toast', text: '图鉴里多了一页。', target: 'library' },
  { id: 'ftue-tier-2', at: 600, when: '第二次升档', kind: 'toast', text: '又长大了一圈。树表示不太知情。' },
];

/** 一次性小提示(非引导),首次遇到某机制时出现一次 */
export const FIRST_TIME_TIPS = {
  'rotting': '苹果放久了会烂。烂苹果会传染邻居,点一下清掉。',
  'wormy': '有虫眼的苹果只值七成。点它,虫就搬走了。',
  'overflow': '果堆满了,新来的苹果只能往外掉。加几辆车吧。',
  'offer': '献果:把苹果献出去,买东西打八五折。',
  'pin': '钉住的东西不会被换掉。',
  'poison': '这个不收。点掉它。',
  'golden': '金苹果。值很多,不会等你。',
  'night': '天黑了。苹果在夜里会亮一点。',
  'snow': '下雪了。老徐说这叫锻炼。',
} as const;

// ───────────────────────── 2 章节来信与小目标 ─────────────────────────
// 每个时代 = 一章:来信 ≤40 字 + 3 个小目标(送达/构筑/收集各一)。奖励只给外观、图鉴、≤20 秒收入。
// 小目标里的 {n} 由系统按难度曲线填。

export type GoalKind = 'deliver' | 'build' | 'collect';
export interface ChapterGoal { kind: GoalKind; text: string }
export interface Chapter {
  era: 0 | 1 | 2 | 3 | 4 | 5;
  /** 章名(章卡大字) */
  title: string;
  /** 章卡副标题:树线 / 运输线 */
  sub: string;
  /** 来信旁白 ≤40 字 */
  letter: string;
  goals: [ChapterGoal, ChapterGoal, ChapterGoal];
  /** 完成三个小目标的奖励说明(给程序和玩家看的) */
  reward: string;
}

export const CHAPTERS: Chapter[] = [
  {
    era: 0, title: '第一章 小树', sub: '小树 · 篮子',
    letter: '听说你会摇树。我腰不好,苹果要送人,拜托了。',
    goals: [
      { kind: 'deliver', text: '累计送出 {n} 个苹果' },
      { kind: 'build', text: '买第一件设备' },
      { kind: 'collect', text: '图鉴里集齐 {n} 种苹果' },
    ],
    reward: '奖励:一个苹果箱外观,和 10 秒收入',
  },
  {
    era: 1, title: '第二章 老树', sub: '老树 · 扁担与小推车',
    letter: '听说你的树粗了。别担心,我的手套还在柜子里。',
    goals: [
      { kind: 'deliver', text: '累计送出 {n} 个苹果' },
      { kind: 'build', text: '选一个分支,走到底' },
      { kind: 'collect', text: '图鉴里集齐 {n} 种苹果' },
    ],
    reward: '奖励:一条红围巾(老徐),和 10 秒收入',
  },
  {
    era: 2, title: '第三章 巨树', sub: '巨树 · 卡车',
    letter: '树大了,风也大。有人会来查证件,别慌。',
    goals: [
      { kind: 'deliver', text: '累计送出 {n} 个苹果' },
      { kind: 'build', text: '让 {n} 辆车同时在路上' },
      { kind: 'collect', text: '图鉴里集齐 {n} 种苹果' },
    ],
    reward: '奖励:一枚督察章(图鉴),和 15 秒收入',
  },
  {
    era: 3, title: '第四章 云树', sub: '云树 · 货船',
    letter: '树冠进云里了。货船很慢。我在北极,给你鼓掌。',
    goals: [
      { kind: 'deliver', text: '累计送出 {n} 个苹果' },
      { kind: 'build', text: '树和车队各升一次档' },
      { kind: 'collect', text: '图鉴里集齐 {n} 种苹果' },
    ],
    reward: '奖励:一个云朵苹果外观,和 15 秒收入',
  },
  {
    era: 4, title: '第五章 星树', sub: '星树 · 飞机',
    letter: '树上挂灯了。外面的邻居,好像也喜欢苹果。',
    goals: [
      { kind: 'deliver', text: '累计送出 {n} 个苹果' },
      { kind: 'build', text: '把运输线升到飞机' },
      { kind: 'collect', text: '图鉴里集齐 {n} 种苹果' },
    ],
    reward: '奖励:一颗星星挂饰,和 20 秒收入',
  },
  {
    era: 5, title: '终章 收货站', sub: '圣诞老人收货站 · 传送门',
    letter: '快了。雪橇在院子里热着,铃声你听得见吗?',
    goals: [
      { kind: 'deliver', text: '累计送出 82 亿个苹果' },
      { kind: 'build', text: '别让果堆溢出' },
      { kind: 'collect', text: '图鉴里集齐 {n} 种苹果' },
    ],
    reward: '奖励:树下的一个盒子。圣诞节再拆。',
  },
];

// ───────────────────────── 3 核心词汇与标签 ─────────────────────────

export const TERMS = {
  stock: '库存',
  stockHint: '手上的苹果,可以拿去买东西。',
  pile: '果堆',
  pileHint: '等着被运走的苹果。',
  delivered: '已送出',
  deliveredHint: '送到了才算数。花掉的不扣。',
  income: '每秒送出',
  payback: '回收期',
  pin: '钉住',
  unpin: '取消钉住',
  offer: '献果',
  offerHint: '献出一部分苹果,买东西打八五折。',
  rotting: '防囤',
  rottingHint: '苹果放久了会烂。烂的会传染。',
  orders: '订单',
  ordersHint: '有人要货。送得到有奖,送不到没事。',
  wormy: '虫眼',
  wormyHint: '点一下,虫就搬走了。',
  rottenApple: '烂苹果',
  rottenHint: '一个烂苹果,会坏一筐。点掉它。',
  library: '图鉴',
} as const;

/** 回收期标签:<60 秒绿,<300 秒黄,其余红"长线"。返回文案与色阶 */
export function paybackLabel(sec: number): { text: string; level: 'green' | 'yellow' | 'red' } {
  if (!isFinite(sec) || sec <= 0) return { text: '长线', level: 'red' };
  if (sec < 60) return { text: `约 ${Math.max(1, Math.round(sec))} 秒回本`, level: 'green' };
  if (sec < 300) return { text: `约 ${Math.round(sec / 60)} 分钟回本`, level: 'yellow' };
  return { text: '长线', level: 'red' };
}

/** 图鉴进度:n/total */
export function libraryProgress(n: number, total: number): string {
  return `${n}/${total}`;
}

/** 购买卡上的短标签 */
export const CARD = {
  buy: '买',
  owned: '已有',
  max: '到顶',
  cantAfford: '钱不够',
  cantAffordHint: '库存不够。再摇几下。',
  best: '推荐',
  bestHint: '现在买它,回本最快。',
  upgrade: '升级',
  tierUp: '升档',
  tierUpHint: '到下一个时代。苹果不介意。',
  locked: '未解锁',
  sold: '已钉住',
  gain: '+{n}/秒',
} as const;

// ───────────────────────── 4 按钮与底栏 ─────────────────────────

export const BTN = {
  ok: '好',
  cancel: '算了',
  close: '关上',
  back: '回去',
  next: '下一个',
  skip: '跳过',
  continue: '继续',
  confirm: '确定',
  collect: '收下',
  claim: '领取',
  open: '拆开',
  seeAll: '看全部',
  retry: '再试一次',
  settings: '设置',
  pause: '歇会儿',
  resume: '接着摇',
  shake: '摇',
  share: '分享',
  copy: '复制',
  copied: '已复制',
} as const;

export const TABS = {
  orchard: '树下',
  shop: '商店',
  orders: '订单',
  library: '图鉴',
  settings: '设置',
} as const;

// ───────────────────────── 5 图鉴 ─────────────────────────

export const LIBRARY = {
  title: '图鉴',
  pageVarieties: '品种',
  pageEggs: '彩蛋',
  progress: '已收集 {n}/{total}',
  unseenName: '???',
  unseenVariety: '还没见过。继续摇。',
  unseenEgg: '还没发现。也许,在某个角落。',
  newBadge: '新',
  discoveredToast: '图鉴 +1:{name}',
  allDone: '图鉴满了。树说:你很闲。',
  emptyVarieties: '一个都没有。先摇几下。',
  emptyEggs: '一个都没发现。别急,它们会等你。',
  disclaimerTitle: '声明',
  disclaimerBody: '本游戏与苹果公司无关,只和水果有关。',
} as const;

// ───────────────────────── 6 空状态与加载 ─────────────────────────

export const EMPTY = {
  stock: '库存是空的。摇一下。',
  pile: '果堆里没有苹果。',
  orders: '暂时没有订单。有人要货了会通知你。',
  shop: '这里暂时没东西。等一个新时代。',
  news: '今天没新闻。树说那是好事。',
  events: '静悄悄的。静得有点可疑。',
  eggsHint: '提示:有些东西,点一点才知道。',
  noEggsYet: '还没有彩蛋。可是你已经在找了。',
  loading: ['苹果在路上……', '树在伸懒腰……', '老徐在找手套……', '日历在催……'],
  offlineEmpty: '你不在的时候,树在休息。',
} as const;

/** 离开后回来的一句话(秒 → 文案),与 narration 的 idle-return 互补,这条给 toast 用 */
export function awayToast(awaySec: number, delivered: string): string {
  const m = awaySec / 60;
  if (m < 10) return '';
  if (m < 60) return `你走开了 ${Math.round(m)} 分钟,车队替你送了 ${delivered} 个。`;
  const h = m / 60;
  if (h < 24) return `你走开了约 ${Math.round(h)} 小时,车队替你送了 ${delivered} 个。`;
  return `你走了 ${Math.floor(h / 24)} 天。苹果自己送了 ${delivered} 个,老徐在站岗。`;
}

// ───────────────────────── 7 设置与确认 ─────────────────────────

export const SETTINGS = {
  title: '设置',
  sound: '音效',
  music: '音乐',
  vibrate: '震动',
  reduceMotion: '减少动效',
  reduceMotionHint: '少晃一点,少闪一点。',
  textSize: '字号',
  textSizeOptions: ['小', '中', '大'] as const,
  newsTicker: '新闻条',
  language: '语言',
  languageValue: '中文',
  exportSave: '导出存档',
  importSave: '导入存档',
  exportHint: '存一份,换个设备也能接着摇。',
  importOk: '读到了。接着摇。',
  importFail: '这个文件看不懂。树也看不懂。',
  reset: '重新开始',
  resetHint: '清空所有进度。回不来。',
  version: '版本',
  about: '关于',
  aboutBody: '一个摇苹果的小游戏。送给一个人。',
  credits: '制作:一个人,一棵树,一点耐心。',
  disclaimer: '本游戏与苹果公司无关,只和水果有关。',
  debugOn: '调试已开',
} as const;

export const CONFIRM = {
  reset: {
    title: '真的要重来吗?',
    body: '树会记得你,但存档不会。',
    ok: '重来',
    cancel: '算了',
  },
  leaveGift: {
    title: '先别急着拆',
    body: '礼物还没到时间。时间到了,树下会自己多个盒子。',
    ok: '好',
    cancel: '知道了',
  },
  importOverwrite: {
    title: '覆盖当前进度?',
    body: '导入后,现在的存档会被替换。',
    ok: '覆盖',
    cancel: '算了',
  },
  sell: {
    title: '卖掉它?',
    body: '卖掉退回一部分库存。这一个就没了。',
    ok: '卖',
    cancel: '留着',
  },
} as const;

// ───────────────────────── 8 提示与报错 ─────────────────────────

export const TOAST = {
  saved: '已存档。',
  saveFail: '存档失败。浏览器说空间不够。',
  newDay: '新的一天。树换了片叶子。',
  tierUp: '升档了:{name}。',
  orderDone: '订单完成。',
  orderMiss: '订单过期了。没关系。',
  rottenCleared: '清掉了一个烂苹果。',
  wormHealed: '虫眼治好了。',
  pinned: '钉住了。',
  unpinned: '取消钉住。',
  offered: '献出一批苹果,买东西便宜了。',
  poisonDropped: '毒苹果,点掉了。',
  eggFound: '发现一个彩蛋:{name}。',
  maxed: '到顶了。再多就装不下了。',
  tooFast: '手慢点,树在看你。',
  offlineBack: '回来啦。',
} as const;

/** 常驻小提示的轮播池(顶部提示条,15–30 秒一条,可关) */
export const TIPS_ROTATION: string[] = [
  '点一下苹果,有时会有惊喜。',
  '库存不是得分,送出才是。',
  '图钉能保住你想留的东西。',
  '夜里苹果更亮。',
  '烂苹果会传染。点一下就好。',
  '老徐不喜欢被戳。但他不会说。',
  '事件只会等你一小会儿。',
  '献果打八五折。你不吃亏。',
  '有些彩蛋,要点标题。',
  '歇会儿也行。车队不会歇。',
  '日历在走。你的节奏也在走。',
  '图鉴里的灰色提示,藏着线索。',
];

// ───────────────────────── 9 标题页与首屏 ─────────────────────────

export const TITLE = {
  name: '摇一摇苹果树',
  tagline: '摇一摇,平安到家。',
  start: '开始摇',
  continue: '接着摇',
  hint: '轻点屏幕,摇树。',
  footer: '本游戏与苹果公司无关,只和水果有关。',
} as const;

/** 时间感知的欢迎语(进游戏时随机取一条),按本地小时 */
export const GREETING = {
  morning: ['早。树比你先醒。', '早上好,今天也摇。'],
  noon: ['中午了。苹果在晒太阳。', '吃饭了吗?树没吃,它吃光。'],
  evening: ['傍晚了。风里有点凉。', '下班了?树还没有。'],
  night: ['夜里的苹果更好看。', '很晚了。摇一会儿就睡吧。'],
  lateNight: ['凌晨了。你和苹果都该睡了。', '这么晚?老徐都睡着了。'],
} as const;
