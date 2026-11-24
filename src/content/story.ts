// 故事主线文案(纯数据)。
// 用途:开场电话、6 张时代明信片、旁白条触发表、结局文本。
// 故事:平安夜吃苹果,取"平安"。今年圣诞老人腰疼,雪橇限重,82 亿份平安果外包给匿名的"你"(摇树人)。
//       搭档老徐(退休,嘴硬心软)。阻碍:乌鸦帮、督察小满、海关老海、外星人嘟嘟、门童。最大的对手是日历。
// 主角匿名,旁白称"你"。圣诞老人是主要角色。
//
// 约束:
//   - 旁白每句 ≤24 字,每条 ≤2 句;明信片正文 ≤80 字;
//   - 旁白节流(NARRATION_LIMITS):两条间隔 ≥45 秒,每小时 ≤40 条,连摇中/弹窗中不出;设置可选 全/少/关;
//   - 礼物祝福由用户亲自写,不在此处代写。结局只放固定句 + {{GIFT_TEXT}} 占位 + 落款占位。
//
// id 稳定不改;新增追加到末尾。

import type { CharId } from './characters.ts';

// ───────────────────────── 世界观摘要(给其他同事对齐用) ─────────────────────────
export const STORY = {
  premise: '平安夜吃苹果,取"平安"。圣诞老人今年闹腰疼,雪橇限重,82 亿份平安果外包给你。每人一个,不多不少。',
  total: 8_200_000_000,
  rival: '日历',
  /** 各时代剧情节拍(与 postcards 对应,仅作策划备忘) */
  beats: [
    '一棵树/篮子:圣诞老人来电求助。老徐路过,说帮你摇,不收钱。',
    '小果园/小推车:邻居入伙,乌鸦帮开始顺苹果,老徐搬凳子站岗。',
    '果山/卡车:小满来查摇树许可证,被牛顿砸中的苹果收买。',
    '果城/货船:果城开业,老海点数点到睡着,果多多想收购你。',
    '果星/飞机:嘟嘟登陆,把苹果当货币,开通航线。',
    '苹果之门/传送门:门童说最后一道门只收"最后一个"。老徐想起圣诞节还有件事没办。',
  ],
} as const;

// ───────────────────────── 明信片(每个时代进入时弹 1 张,点任意处关闭) ─────────────────────────
export interface Postcard {
  id: string;
  /** 进入的时代(0 = 开局,1..5 = 升到该时代) */
  era: 0 | 1 | 2 | 3 | 4 | 5;
  title: string;
  /** ≤80 字 */
  body: string;
  /** 署名(卡片右下) */
  sign: string;
}

export const POSTCARDS: Postcard[] = [
  {
    id: 'pc-0',
    era: 0,
    title: '平安夜前的一通电话',
    body: '喂,是摇树的吗?我是圣诞老人,腰扭了,雪橇也限重。今年的平安果,八十二亿份,能不能请你摇一摇?每人一个,不多不少。',
    sign: '圣诞老人(叉着腰)',
  },
  {
    id: 'pc-1',
    era: 1,
    title: '邻居们来了',
    body: '邻居看你摇得挺开心,把自家的树也带来了。乌鸦在篱笆上点人头。老徐搬了条凳子:我不是帮你,我是路过。凳子是他自带的。',
    sign: '老徐(路过)',
  },
  {
    id: 'pc-2',
    era: 2,
    title: '摇树许可证',
    body: '山上来了位戴帽子的督察,问你要摇树许可证。你没有。她没收了一个苹果当证据,当场吃了半个。牛顿在树下睡午觉,又被砸醒了。',
    sign: '督察小满(已盖章)',
  },
  {
    id: 'pc-3',
    era: 3,
    title: '果城开业',
    body: '果城开业了。码头来了位海关老海,苹果数到一半睡着了。果多多路过,出价三个橘子,你婉拒。圣诞老人来电:还剩多少?',
    sign: '老海(数到一半)',
  },
  {
    id: 'pc-4',
    era: 4,
    title: '天上的客人',
    body: '一艘圆圆的船降在果星上,嘟嘟走出来:地球货币!好吃!他把苹果当钱,开通了航线。老徐问:这算外贸吗?没人回答。',
    sign: '嘟嘟!',
  },
  {
    id: 'pc-5',
    era: 5,
    title: '最后一道门',
    body: '门童说,最后一道门,只收"最后一个"。老徐看了眼日历,忽然想起圣诞节还有件事没办。远处,雪橇的铃声已经很近了。',
    sign: '老徐',
  },
];

// ───────────────────────── 旁白条 ─────────────────────────
export type NarrationTrigger = 'era-enter' | 'milestone' | 'idle-return' | 'egg';

export interface NarrationLine {
  id: string;
  trigger: NarrationTrigger;
  /** ≤2 句,每句 ≤24 字 */
  text: string;
  /** 头像/说话人;缺省 = 旁白(无头像) */
  speaker?: CharId;
  /** era-enter:对应时代 0..5 */
  era?: 0 | 1 | 2 | 3 | 4 | 5;
  /** era-enter:进入该时代后多少秒再出(0 = 紧跟明信片关闭后) */
  delaySec?: number;
  /** milestone:送达进度百分比 10/25/50/75/90/99/100 */
  pct?: 10 | 25 | 50 | 75 | 90 | 99 | 100;
  /** idle-return:离线至少多少分钟才可选;多条符合时取 awayMin 最大者再随机 */
  awayMin?: number;
  /** egg:限定彩蛋层级;缺省 = 任意 */
  eggLayer?: 'always' | 'discover' | 'rare';
}

export const NARRATION_LIMITS = {
  /** 两条旁白之间的最短间隔(秒) */
  minGapSec: 45,
  /** 每小时最多条数 */
  maxPerHour: 40,
  /** 里程碑进度点 */
  milestones: [10, 25, 50, 75, 90, 99, 100],
} as const;

export const NARRATION: NarrationLine[] = [
  // ── 时代 0:一棵树 / 篮子 ──
  { id: 'nr-e0-1', trigger: 'era-enter', era: 0, delaySec: 0, speaker: 'santa', text: '喂,是摇树的吗?我腰疼,拜托你了。' },
  { id: 'nr-e0-2', trigger: 'era-enter', era: 0, delaySec: 40, text: '有位大爷在树下站了会儿,没说话。' },
  { id: 'nr-e0-3', trigger: 'era-enter', era: 0, delaySec: 90, speaker: 'santa', text: '每人一个,不多不少。慢慢来,别伤着手。' },
  { id: 'nr-e0-4', trigger: 'era-enter', era: 0, delaySec: 150, text: '苹果落地的声音,很像鼓掌。' },
  // ── 时代 1:小果园 / 小推车 ──
  { id: 'nr-e1-1', trigger: 'era-enter', era: 1, delaySec: 0, text: '邻居家的树也来了。乌鸦在篱笆上点人头。' },
  { id: 'nr-e1-2', trigger: 'era-enter', era: 1, delaySec: 40, speaker: 'laoxu', text: '我不是帮你,我是路过。凳子是自带的。' },
  { id: 'nr-e1-3', trigger: 'era-enter', era: 1, delaySec: 90, speaker: 'crow', text: '有些苹果少了。老黑说:是借的。' },
  { id: 'nr-e1-4', trigger: 'era-enter', era: 1, delaySec: 150, text: '凳子吱呀一声,乌鸦抬头看了一眼。' },
  // ── 时代 2:果山 / 卡车 ──
  { id: 'nr-e2-1', trigger: 'era-enter', era: 2, delaySec: 0, text: '山来了。督察小满也来了,问你要许可证。' },
  { id: 'nr-e2-2', trigger: 'era-enter', era: 2, delaySec: 40, speaker: 'xiaoman', text: '证件呢?苹果证也行。' },
  { id: 'nr-e2-3', trigger: 'era-enter', era: 2, delaySec: 90, text: '牛顿又被砸了。小满收下那颗苹果,当证据。' },
  { id: 'nr-e2-4', trigger: 'era-enter', era: 2, delaySec: 150, text: '卡车喇叭响起,树吓了一跳。' },
  // ── 时代 3:果城 / 货船 ──
  { id: 'nr-e3-1', trigger: 'era-enter', era: 3, delaySec: 0, text: '果城开业。老海在码头点数,点着点着睡了。' },
  { id: 'nr-e3-2', trigger: 'era-enter', era: 3, delaySec: 40, speaker: 'duoduo', text: '我出三个橘子。' },
  { id: 'nr-e3-3', trigger: 'era-enter', era: 3, delaySec: 90, text: '货船上的苹果晕船,船长递来塑料袋。' },
  { id: 'nr-e3-4', trigger: 'era-enter', era: 3, delaySec: 150, text: '海风里有咸味,也有苹果味。' },
  // ── 时代 4:果星 / 飞机 ──
  { id: 'nr-e4-1', trigger: 'era-enter', era: 4, delaySec: 0, text: '嘟嘟降落了。他喊:地球货币,好吃!' },
  { id: 'nr-e4-2', trigger: 'era-enter', era: 4, delaySec: 40, text: '航线开通。老徐问:这算外贸吗?' },
  { id: 'nr-e4-3', trigger: 'era-enter', era: 4, delaySec: 90, text: '天上长满苹果,天文学家睡不着。' },
  { id: 'nr-e4-4', trigger: 'era-enter', era: 4, delaySec: 150, text: '月亮上有个红点。是苹果。' },
  // ── 时代 5:苹果之门 / 传送门 ──
  { id: 'nr-e5-1', trigger: 'era-enter', era: 5, delaySec: 0, speaker: 'doorman', text: '最后一道门,只收"最后一个"。' },
  { id: 'nr-e5-2', trigger: 'era-enter', era: 5, delaySec: 40, text: '老徐看了一眼日历。圣诞节,还有件事没办。' },
  { id: 'nr-e5-3', trigger: 'era-enter', era: 5, delaySec: 90, text: '雪橇的铃声,已经很近了。' },
  { id: 'nr-e5-4', trigger: 'era-enter', era: 5, delaySec: 150, text: '门缝里透出光,是红色的。' },

  // ── 里程碑(占总目标 82 亿的百分比) ──
  { id: 'nr-m10-1', trigger: 'milestone', pct: 10, text: '十分之一了。老徐说:才十分之一。', speaker: 'laoxu' },
  { id: 'nr-m10-2', trigger: 'milestone', pct: 10, text: '八亿多个苹果上路了。树没说话。' },
  { id: 'nr-m10-3', trigger: 'milestone', pct: 10, text: '圣诞老人来电:腰好了一点点。', speaker: 'santa' },
  { id: 'nr-m25-1', trigger: 'milestone', pct: 25, text: '四分之一。日历看了你一眼。' },
  { id: 'nr-m25-2', trigger: 'milestone', pct: 25, text: '老徐开始数数,数到一半放弃了。', speaker: 'laoxu' },
  { id: 'nr-m25-3', trigger: 'milestone', pct: 25, text: '你的手臂,有了自己的想法。' },
  { id: 'nr-m50-1', trigger: 'milestone', pct: 50, text: '一半了。日历开始着急。' },
  { id: 'nr-m50-2', trigger: 'milestone', pct: 50, text: '四十一亿。老海说他数过了。', speaker: 'laohai' },
  { id: 'nr-m50-3', trigger: 'milestone', pct: 50, text: '圣诞老人:一半了!我腰好多了。', speaker: 'santa' },
  { id: 'nr-m75-1', trigger: 'milestone', pct: 75, text: '还剩四分之一。日历在加速。' },
  { id: 'nr-m75-2', trigger: 'milestone', pct: 75, text: '雪橇装了一半,还能再装。', speaker: 'santa' },
  { id: 'nr-m75-3', trigger: 'milestone', pct: 75, text: '老徐:别回头看。回头看会累。', speaker: 'laoxu' },
  { id: 'nr-m90-1', trigger: 'milestone', pct: 90, text: '只剩一成了。圣诞老人开始紧张。', speaker: 'santa' },
  { id: 'nr-m90-2', trigger: 'milestone', pct: 90, text: '老徐搬来第二条凳子,不为谁。', speaker: 'laoxu' },
  { id: 'nr-m90-3', trigger: 'milestone', pct: 90, text: '树小声说:要不,我也帮你摇?' },
  { id: 'nr-m99-1', trigger: 'milestone', pct: 99, text: '差一点点。风也屏住了呼吸。' },
  { id: 'nr-m99-2', trigger: 'milestone', pct: 99, text: '最后的百分之一,最长。' },
  { id: 'nr-m99-3', trigger: 'milestone', pct: 99, text: '老徐:别抖。你一抖,树也抖。', speaker: 'laoxu' },
  { id: 'nr-m100-1', trigger: 'milestone', pct: 100, text: '最后一个苹果送到了。电话那头:收到,雪橇装得下。', speaker: 'santa' },
  { id: 'nr-m100-2', trigger: 'milestone', pct: 100, text: '树下多了一个盒子。盒子上写着:圣诞节再拆。' },
  { id: 'nr-m100-3', trigger: 'milestone', pct: 100, text: '老徐摸摸树干:歇会儿吧。', speaker: 'laoxu' },

  // ── 离线回来(awayMin = 至少离开多少分钟) ──
  { id: 'nr-a10-1', trigger: 'idle-return', awayMin: 10, text: '你回来了。苹果没等你,继续送。' },
  { id: 'nr-a10-2', trigger: 'idle-return', awayMin: 10, text: '树说:你刚走,我就想你了。' },
  { id: 'nr-a60-1', trigger: 'idle-return', awayMin: 60, speaker: 'laoxu', text: '回来啦?我替你看着了。' },
  { id: 'nr-a60-2', trigger: 'idle-return', awayMin: 60, text: '车队没停。乌鸦也没停。' },
  { id: 'nr-a480-1', trigger: 'idle-return', awayMin: 480, text: '你走了很久。树说,它也想歇。' },
  { id: 'nr-a480-2', trigger: 'idle-return', awayMin: 480, speaker: 'laoxu', text: '我就眯了一下。苹果自己长的。' },
  { id: 'nr-a1440-1', trigger: 'idle-return', awayMin: 1440, text: '一整天。车队问你去哪了。' },
  { id: 'nr-a4320-1', trigger: 'idle-return', awayMin: 4320, text: '三天了。树都开始自己摇自己了。' },

  // ── 彩蛋被发现(通用提示,具体彩蛋文案见 eggs.ts) ──
  { id: 'nr-eg-1', trigger: 'egg', text: '据报:有人发现了一个小秘密。' },
  { id: 'nr-eg-2', trigger: 'egg', text: '图鉴里,多了一页。' },
  { id: 'nr-eg-3', trigger: 'egg', text: '这事,本报从不核实。但很开心。' },
  { id: 'nr-eg-4', trigger: 'egg', eggLayer: 'always', text: '这一页,迟早会来。' },
  { id: 'nr-eg-5', trigger: 'egg', eggLayer: 'discover', text: '你点到了不该点的地方。好事。' },
  { id: 'nr-eg-6', trigger: 'egg', eggLayer: 'discover', text: '老徐:怎么发现的?别告诉我。', speaker: 'laoxu' },
  { id: 'nr-eg-7', trigger: 'egg', eggLayer: 'rare', text: '这个,据说很少有人见过。' },
  { id: 'nr-eg-8', trigger: 'egg', eggLayer: 'rare', text: '稀有。图鉴替你记下了。' },
  { id: 'nr-eg-9', trigger: 'egg', eggLayer: 'rare', text: '今天是什么日子。' },
];

// ───────────────────────── 开场 ─────────────────────────
export interface OpeningLine {
  /** 说话人;缺省 = 旁白 */
  who?: CharId;
  text: string;
}

/** 新存档第一次进入:逐句出现(打字机),点击加速。主角是"你"。 */
export const OPENING: OpeningLine[] = [
  { text: '电话铃响了。' },
  { who: 'santa', text: '喂,是摇树的吗?' },
  { who: 'santa', text: '我腰疼,雪橇也限重了。' },
  { who: 'santa', text: '今年的平安果,八十二亿份,每人一个。' },
  { who: 'santa', text: '你能不能……帮我摇一摇?' },
  { text: '你看了看树。树看了看你。' },
  { text: '你点了点头。' },
];

/** 标题页的一句话 */
export const TAGLINE = '摇一摇,平安到家。';

// ───────────────────────── 结局 ─────────────────────────
/** 礼物祝福占位:由用户自己写(走加密 #g= 链接,不入仓库),运行时替换 */
export const GIFT_PLACEHOLDER = '{{GIFT_TEXT}}';
/** 落款占位:同上,用户自己写 */
export const GIFT_SIGN_PLACEHOLDER = '{{GIFT_SIGN}}';
/** 固定句:盒子打开后先出这一行(plan/11 推荐句;用户可改成自己的语气) */
export const GIFT_FIXED_LINE = '这一个,不在 82 亿里。';

export const ENDING = {
  /** 82 亿送达:电话与收尾(任意日期都显示) */
  win: [
    { who: 'santa', text: '最后一个,收到了。' },
    { who: 'santa', text: '雪橇,装得下。' },
    { text: '电话那头,传来哈哈哈,和一声"哎哟"。' },
  ] as OpeningLine[],
  /** 82 亿之后、12/24 之前:树下的盒子(对应 core/copy.ts 的 SEALED) */
  sealed: [
    { text: '树下多了一个盒子。' },
    { text: '盒子上写着:圣诞节再拆。' },
  ] as OpeningLine[],
  /** 12/24 打开盒子:先出固定句,再出用户祝福(占位),最后落款(占位) */
  boxOpen: {
    fixedLine: GIFT_FIXED_LINE,
    giftText: GIFT_PLACEHOLDER,
    giftSign: GIFT_SIGN_PLACEHOLDER,
  },
  /** 祝福读完之后(可选,轻一点) */
  afterGift: [
    { who: 'santa', text: '好了,我的腰也好了。' },
    { text: '平安夜快乐。' },
  ] as OpeningLine[],
  /** 结局尾声:角色各一句(顺序出现) */
  curtain: [
    { who: 'xiaoman', text: '最后一个我吃了。算我的。' },
    { who: 'crow', text: '最后一个我没动,真的。' },
    { who: 'newton', text: '我还会回来的,大概。' },
    { who: 'dudu', text: '下次!带橘子!不要!' },
    { who: 'doorman', text: '请进。请带好您的最后一个。' },
    { who: 'laoxu', text: '行了,回去吧。我不是想你。' },
  ] as OpeningLine[],
  /** 12/24 之前提前来看的人:盒子打不开的提示 */
  tooEarly: '还没到时候。树说:圣诞节再拆。',
} as const;

/** 结局页角落的致谢小字(可选) */
export const CREDITS_LINE = '摇树人:你。搭档:老徐。雇主:圣诞老人。对手:日历。';
