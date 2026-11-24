// v6 终点站与小鸟文案(纯数据)。
// 用途:
//   STATION            终点"圣诞老人收货站"的名字、流程步骤(装包裹→小精灵传递→雪橇→礼物堆→起飞)的提示文案。
//   GIFT_PILE_LEVELS   礼物堆高度的抽象描述(按送达进度 pct 取,不放数字),可当底栏副标题/旁白提示。
//   ELF_LINES / SANTA_STATION_LINES  收货站角色台词(小精灵、圣诞老人在站里的话)。
//   STATION_FLOATS     点小精灵/铃铛/驯鹿/包裹时的飘字({n} = 收益数字)。
//   TAKEOFF            最后一档雪橇起飞的文案(与 story.ts 的 ENDING 衔接:起飞 → 盒子 → 圣诞节再拆)。
//   BIRD_*             小鸟(真飞):出场 / 点中 / 没点被啄 / 特殊场合的台词与飘字。
// 约束:台词 ≤24 字/句;气泡 ≤16 字;飘字 ≤12 字(含 {n} 按 4 位数算);不放大数字。
// 主角匿名;礼物祝福不在此处写(见 gift.ts 与 story.ts 的结局固定句)。

export const STATION = {
  name: '圣诞老人收货站',
  short: '收货站',
  /** 站里一次交货的流程提示(进度条/动画旁的小字,按顺序) */
  steps: [
    { id: 'pack', text: '苹果装进包裹。', alt: ['包裹贴好蝴蝶结。', '一个苹果,一个包裹。'] },
    { id: 'pass', text: '小精灵一个传一个。', alt: ['小精灵排成一条线。', '传得比苹果还快。'] },
    { id: 'load', text: '包裹滑进雪橇。', alt: ['雪橇沉了一点点。', '驯鹿看了一眼,没说话。'] },
    { id: 'pile', text: '礼物堆又高了一截。', alt: ['堆得整整齐齐。', '最上面那个,歪了。'] },
  ],
  /** 第一次有苹果送到 */
  firstArrive: '第一个包裹到了。小精灵鼓了掌。',
  /** 站里没货时的空闲描述 */
  idle: '收货站在等货。热可可还热着。',
} as const;

/** 礼物堆高度的抽象描述;pct = 送达进度下限(%),取不超过当前进度的最后一条 */
export const GIFT_PILE_LEVELS: { pct: number; text: string }[] = [
  { pct: 0, text: '脚边几个包裹' },
  { pct: 2, text: '一小堆,数得过来' },
  { pct: 5, text: '堆到小腿高' },
  { pct: 10, text: '堆到膝盖高' },
  { pct: 20, text: '堆到雪橇边' },
  { pct: 35, text: '堆过了雪橇边沿' },
  { pct: 50, text: '堆得比驯鹿高' },
  { pct: 70, text: '堆成了一座小山' },
  { pct: 85, text: '雪橇快装不下了' },
  { pct: 95, text: '满了,满得冒尖' },
];

export function giftPileText(pct: number): string {
  let t = GIFT_PILE_LEVELS[0].text;
  for (const l of GIFT_PILE_LEVELS) if (pct >= l.pct) t = l.text;
  return t;
}

export type StationOn = 'receive' | 'idle' | 'tap' | 'full' | 'xmas';

export interface StationLine {
  id: string;
  on: StationOn;
  text: string;
  /** 触发场景(人话) */
  trigger: string;
}

/** 小精灵台词(speaker 用"小精灵",无单独 CharId) */
export const ELF_LINES: StationLine[] = [
  { id: 'elf-r1', on: 'receive', text: '收到!下一个!', trigger: '站里每收到一批苹果(低频)' },
  { id: 'elf-r2', on: 'receive', text: '签收,签收,签收。', trigger: '同上' },
  { id: 'elf-r3', on: 'receive', text: '这个苹果,有点香。', trigger: '同上' },
  { id: 'elf-r4', on: 'receive', text: '包好了,贴蝴蝶结。', trigger: '同上' },
  { id: 'elf-i1', on: 'idle', text: '没货的时候,我们数袜子。', trigger: '站里 30 秒以上没收到货' },
  { id: 'elf-i2', on: 'idle', text: '谁把我的铃铛拿走了?', trigger: '同上' },
  { id: 'elf-i3', on: 'idle', text: '热可可凉了。', trigger: '同上' },
  { id: 'elf-i4', on: 'idle', text: '雪橇停着的时候,最累。', trigger: '同上' },
  { id: 'elf-t1', on: 'tap', text: '别点我,我在数。', trigger: '点击小精灵' },
  { id: 'elf-t2', on: 'tap', text: '再点,算你偷懒。', trigger: '同上' },
  { id: 'elf-t3', on: 'tap', text: '哎,我的帽子歪了。', trigger: '同上' },
  { id: 'elf-f1', on: 'full', text: '雪橇好像要装不下了。', trigger: '送达进度 ≥85%' },
  { id: 'elf-f2', on: 'full', text: '谁来帮忙拎一下?', trigger: '送达进度 ≥95%' },
  { id: 'elf-x1', on: 'xmas', text: '平安夜快到了,大家加把劲。', trigger: '12 月 20 日之后' },
  { id: 'elf-x2', on: 'xmas', text: '今年的袜子,都挂好了。', trigger: '12 月 24 日当天' },
];

/** 圣诞老人在站里的台词(speaker: santa) */
export const SANTA_STATION_LINES: StationLine[] = [
  { id: 'ss-1', on: 'receive', text: '第一个到了。孩子,谢谢。', trigger: '第一次送达(只出一次)' },
  { id: 'ss-2', on: 'receive', text: '腰好点了。真的。', trigger: '送达进度 ≥30%' },
  { id: 'ss-3', on: 'idle', text: '我在雪橇上坐着,别担心。', trigger: '站里 60 秒以上没货' },
  { id: 'ss-4', on: 'tap', text: '别拍我肚子,哈哈哈。', trigger: '点击圣诞老人(站里)' },
  { id: 'ss-5', on: 'tap', text: '想看礼物堆?别拆。', trigger: '同上' },
  { id: 'ss-6', on: 'full', text: '雪橇还能再装一点。', trigger: '送达进度 ≥85%' },
  { id: 'ss-7', on: 'xmas', text: '平安夜,我的老腰在等你。', trigger: '12 月 24 日当天' },
];

/** 站里角色/物件被点中时的飘字(键 = 彩蛋 id,见 eggs.ts) */
export const STATION_FLOATS: Record<string, { reaction: string; floats: string[] }> = {
  'elf-wave': { reaction: '别点我,我在数。', floats: ['+{n} 小精灵加班费', '+{n} 数错了', '+{n} 蝴蝶结'] },
  'sleigh-bell': { reaction: '叮。', floats: ['+{n} 铃响了', '+{n} 叮的一声', '+{n} 雪橇的小费'] },
  'reindeer-nose': { reaction: '红的。亮的。', floats: ['+{n} 红鼻子', '+{n} 有点烫', '+{n} 驯鹿赞助'] },
  'gift-peek': { reaction: '只是看看。', floats: ['+{n} 偷看一眼', '+{n} 别拆', '+{n} 包裹的小秘密'] },
};

/** 最后一档雪橇起飞(送达 100%)的文案,按顺序出 */
export const TAKEOFF = {
  lines: [
    { speaker: 'santa', text: '收到,雪橇装得下。' },
    { speaker: 'elf', text: '最后一个!关门!' },
    { speaker: 'santa', text: '孩子,谢谢你。坐稳了。' },
    { speaker: null, text: '雪橇起飞。铃声越来越远。' },
  ],
  /** 起飞后,衔接 story.ts 的 ENDING.sealed(盒子) */
  after: '树下多了一个盒子。盒子上写着:圣诞节再拆。',
} as const;

// ───────────────────────── 小鸟 ─────────────────────────
// 小鸟真飞:从屏幕一侧飞过。点中 → 掉羽毛/掉苹果 + "+N"飘字;不点 → 啄走少量苹果。不做点击压力,啄走的很少。

export interface BirdLine {
  id: string;
  text: string;
  trigger: string;
}

/** 出场(小鸟飞进来时的提示,≤16 字,可当 toast) */
export const BIRD_APPEAR: BirdLine[] = [
  { id: 'bd-a1', text: '头顶有影子掠过。', trigger: '小鸟事件出现(通用)' },
  { id: 'bd-a2', text: '一只小鸟盯上了苹果堆。', trigger: '同上' },
  { id: 'bd-a3', text: '喳喳。它来了。', trigger: '同上' },
  { id: 'bd-a4', text: '小鸟在树梢打量你。', trigger: '同上' },
  { id: 'bd-a5', text: '又是它。它带了朋友。', trigger: '累计出现 ≥10 次后' },
];

/** 点中:气泡 + 飘字 */
export const BIRD_HIT = {
  bubbles: ['喳!', '哎呀,被发现了。', '好吧,我走。', '羽毛送你。'],
  floats: ['+{n} 小鸟的谢礼', '+{n} 羽毛换的', '+{n} 掉下来的', '+{n} 它吐出来的'],
  toasts: [
    '你点中了小鸟,它丢下几个苹果。',
    '小鸟被吓了一跳,掉了根羽毛。',
    '小鸟:我只是路过。',
  ],
} as const;

/** 没点:被啄走少量苹果 */
export const BIRD_PECK = {
  bubbles: ['啄!', '谢啦。', '好吃。', '嗝。'],
  toasts: [
    '小鸟啄走了几个苹果。',
    '小鸟吃饱走了,没说谢谢。',
    '你没理它。它也没客气。',
    '苹果少了几个。小鸟胖了一点。',
  ],
} as const;

/** 特殊场合 */
export const BIRD_SPECIAL = {
  /** 累计点中 ≥10 次(对应 bird-feather) */
  feather: '羽毛攒了一把,能做枕头了。',
  /** 累计被啄 ≥5 次(对应 bird-ignore) */
  friend: '小鸟认你了。下次它先打招呼。',
  /** 12 月 24 日的戴帽小鸟(对应 bird-hat) */
  hat: '这只鸟,提前过节了。',
  /** 老徐在场时 */
  withLaoxu: '老徐:那几只黑的我盯着呢。这只不黑,算了。',
} as const;
