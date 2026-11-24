// 彩蛋库(纯数据)。策划 22 + 叙事 20,去重合并 + 用户点名补充,共 43 条。
// 用途:图鉴"彩蛋页"(已发现显示 name/text,未发现显示剪影 + EGG_TRIGGER_HINTS 的灰字提示)、
//       彩蛋触发时弹出的一句文案、奖励发放。
//
// 字段说明
//   layer    always  = 必现,跟章节/日期走,正常玩一定会遇到(引导用);
//            discover= 可发现,点到/做到才有(默认层);
//            rare    = 极稀有,行为门槛高或概率低。
//   trigger  人话描述,供 systems 实现检测。每条都落在"点击某热点 / 计数达阈值 / 某状态持续 / 日期时间 / 概率掉落"之一。
//   text     触发时弹出的一句文案,≤30 字。
//   reward   apples = 相当于 amount 秒的当前送达量(一次性);
//            gold   = 金苹果收藏币 amount 个(只进图鉴/徽章计数,不参与经济,由 systems 决定是否折算);
//            badge  = 成就徽章(reward.id 为徽章 id);
//            cosmetic = 外观(reward.id 为外观 id)。
//   silhouette 图鉴未发现时的剪影 id(art 同事按此出图;缺省 = 通用问号剪影)。
//   minEra   最早可触发的时代(0..5);缺省 0。
//   once     全部只触发一次(存档记 id)。
//   带"与苹果公司无关"声明的彩蛋见 DISCLAIMER_EGG_IDS,弹出时附带 DISCLAIMER。
//
// id 稳定不改;新增追加到末尾。

export type EggLayer = 'always' | 'discover' | 'rare';
export type EggRewardKind = 'apples' | 'gold' | 'badge' | 'cosmetic';

export interface EggReward {
  kind: EggRewardKind;
  amount?: number;
  /** badge/cosmetic 的 id */
  id?: string;
}

export interface Egg {
  id: string;
  name: string;
  layer: EggLayer;
  trigger: string;
  text: string;
  reward: EggReward;
  silhouette?: string;
  minEra?: 0 | 1 | 2 | 3 | 4 | 5;
  /** 备注(给实现者/美术看,不进游戏) */
  note?: string;
}

/** 与苹果公司无关声明(随相关彩蛋一起弹出,小字) */
export const DISCLAIMER = '本游戏与苹果公司无关,只和水果有关。';
export const DISCLAIMER_LINES: readonly string[] = [
  '本游戏与苹果公司无关,只和水果有关。',
  '声明:你咬的是水果,不是品牌。',
  '本报重申:此苹果非彼苹果。',
  '法务部提醒:这里只有树,没有总部。',
  '特别声明:树上不长手机。',
  '与苹果公司无关。苹果自己也这么说。',
];

export const EGGS: Egg[] = [
  // ═════════ 必现(跟章节/日期) ═════════
  {
    id: 'eve',
    name: '夏娃',
    layer: 'always',
    trigger: '第一次升到第 2 时代(小果园)之后,树顶会出现一颗发亮的苹果,点击它。',
    text: '别吃!……算了,吃吧。没人说不能摘第二颗。',
    reward: { kind: 'badge', id: 'badge-forbidden' },
    silhouette: 'eve',
    minEra: 1,
  },
  {
    id: 'newton',
    name: '牛顿',
    layer: 'always',
    trigger: '第一次领取"路过的牛顿"随机事件(点击牛顿)。',
    text: '万有引力。我讲过了。',
    reward: { kind: 'apples', amount: 10 },
    silhouette: 'newton',
  },
  {
    id: 'snow-white',
    name: '白雪公主',
    layer: 'always',
    trigger: '进入第 3 时代(果山)后,山脚会出现老太婆摊位,点击摊位上的红苹果。',
    text: '这个红的最好看。这个,不进仓库。',
    reward: { kind: 'badge', id: 'badge-poison' },
    silhouette: 'snow-white',
    minEra: 2,
  },
  {
    id: 'paris',
    name: '帕里斯的金苹果',
    layer: 'always',
    trigger: '进入第 3 时代(果山)后,山顶会出现一颗金色苹果,点击它。',
    text: '献给最美的……三位女神吵起来了。',
    reward: { kind: 'cosmetic', id: 'skin-golden-apple' },
    silhouette: 'golden-apple',
    minEra: 2,
  },
  {
    id: 'big-apple',
    name: '大苹果',
    layer: 'always',
    trigger: '进入第 4 时代(果城)后,点击远景里最高的那栋楼。',
    text: '这里叫大苹果。别的城市嫉妒。',
    reward: { kind: 'apples', amount: 20 },
    silhouette: 'skyscraper',
    minEra: 3,
  },
  {
    id: 'daily',
    name: '一天一苹果',
    layer: 'always',
    trigger: '每个自然日(收礼人时区 UTC+8)第一次进入游戏。',
    text: '每天一个,医生失业。',
    reward: { kind: 'apples', amount: 10 },
    silhouette: 'doctor',
    note: '每日重复发放奖励,图鉴只记首次。',
  },
  {
    id: 'xmas-eve',
    name: '平安夜',
    layer: 'always',
    trigger: 'UTC+8 的 12 月 24 日当天第一次进入游戏。',
    text: '平安果,平安夜。',
    reward: { kind: 'cosmetic', id: 'skin-santa-hat' },
    silhouette: 'santa-hat',
  },

  // ═════════ 可发现 ═════════
  {
    id: 'xmas-sock',
    name: '圣诞袜',
    layer: 'discover',
    trigger: '12 月 20 日之后,点击树下挂着的圣诞袜。',
    text: '提前拆也不会变。',
    reward: { kind: 'apples', amount: 5 },
    silhouette: 'sock',
  },
  {
    id: 'tell',
    name: '威廉·退尔',
    layer: 'discover',
    trigger: '雇佣老徐之后,点击老徐的头顶。',
    text: '别紧张,我瞄得准。……好箭法,别告诉我儿子。',
    reward: { kind: 'apples', amount: 10 },
    silhouette: 'archer',
    minEra: 1,
  },
  {
    id: 'snake',
    name: '伊甸园的蛇',
    layer: 'discover',
    trigger: '每次摇树有 1/300 的概率掉下一条蛇,点击这条蛇。',
    text: '蛇说它只是路过。',
    reward: { kind: 'badge', id: 'badge-snake' },
    silhouette: 'snake',
  },
  {
    id: 'adam',
    name: '亚当',
    layer: 'discover',
    trigger: '雇佣老徐之后,点击老徐的喉结(脖子处)。',
    text: '我只是想找个对象。苹果?在这儿。',
    reward: { kind: 'badge', id: 'badge-adam' },
    silhouette: 'adam',
    minEra: 1,
  },
  {
    id: 'apple-of-eye',
    name: '掌上明珠',
    layer: 'discover',
    trigger: '雇佣老徐之后,2 秒内连点老徐 5 下。',
    text: '你是我的掌上明珠。……说梦话,别当真。',
    reward: { kind: 'badge', id: 'badge-pearl' },
    silhouette: 'palm',
    minEra: 1,
  },
  {
    id: 'pie',
    name: '苹果派',
    layer: 'discover',
    trigger: '累计点击清理 20 个烂苹果(或堆场溢出提示 20 次,二选一先到)。',
    text: '烤了一个派,没人舍得切。',
    reward: { kind: 'apples', amount: 60 },
    silhouette: 'pie',
    minEra: 1,
  },
  {
    id: 'johnny',
    name: '苹果籽',
    layer: 'discover',
    trigger: '连续 60 秒没有任何点击和按键。',
    text: '他到处撒种,不要钱。',
    reward: { kind: 'apples', amount: 20 },
    silhouette: 'seed-sower',
    note: '约翰尼·阿普尔西德的典故;名字不进游戏,文案里也不出现。',
  },
  {
    id: 'garage',
    name: '车库里的剪影',
    layer: 'discover',
    trigger: '进入第 3 时代(卡车)后,点击卡车车库门口的黑色剪影。',
    text: '咬一口才完整。(与苹果公司无关)',
    reward: { kind: 'badge', id: 'badge-garage' },
    silhouette: 'garage-bite',
    minEra: 2,
    note: '只文字+剪影,点击后附 DISCLAIMER。',
  },
  {
    id: 'turtleneck',
    name: '高领先生',
    layer: 'discover',
    trigger: '进入第 4 时代(果城)后,点击大楼窗口里穿高领衫的黑色剪影。',
    text: '保持饥饿,保持愚蠢。(与苹果公司无关)',
    reward: { kind: 'badge', id: 'badge-turtleneck' },
    silhouette: 'turtleneck',
    minEra: 3,
    note: '指向某位已故科技创始人,只用文字和黑色剪影,不出现姓名与商标;点击后附 DISCLAIMER。',
  },
  {
    id: 'einstein',
    name: '爱因斯坦',
    layer: 'discover',
    trigger: '进入第 6 时代(传送门)后,点击夜空中的月亮。',
    text: 'E=mc²,但苹果的质量不算。',
    reward: { kind: 'apples', amount: 15 },
    silhouette: 'einstein',
    minEra: 5,
  },
  {
    id: 'core',
    name: '苹果核',
    layer: 'discover',
    trigger: '累计点击地上被吃剩的苹果核 7 次。',
    text: '核也有梦想。',
    reward: { kind: 'apples', amount: 10 },
    silhouette: 'core',
  },
  {
    id: 'vinegar',
    name: '苹果醋',
    layer: 'discover',
    trigger: '点击果园角落的醋桶。',
    text: '酸到想起前任。',
    reward: { kind: 'apples', amount: 5 },
    silhouette: 'barrel',
    minEra: 1,
  },
  {
    id: 'jam',
    name: '苹果酱',
    layer: 'discover',
    trigger: '点击仓库架子上的酱罐。',
    text: '抹面包前,先问苹果同意。',
    reward: { kind: 'apples', amount: 5 },
    silhouette: 'jar',
  },
  {
    id: 'green',
    name: '青苹果',
    layer: 'discover',
    trigger: '点击一颗正在掉落的青苹果。',
    text: '我还没熟,别催。',
    reward: { kind: 'badge', id: 'badge-green' },
    silhouette: 'green-apple',
  },
  {
    id: 'orange',
    name: '走错片场的橘子',
    layer: 'discover',
    trigger: '点击访客手里拿着的橘子。',
    text: '打扰了,走错片场。',
    reward: { kind: 'apples', amount: 5 },
    silhouette: 'orange',
    minEra: 3,
  },
  {
    id: 'daily-news',
    name: '苹果日报头版',
    layer: 'discover',
    trigger: '10 秒内连点新闻滚动条 3 次。',
    text: '独家:本报从不核实。',
    reward: { kind: 'apples', amount: 5 },
    silhouette: 'newspaper',
  },
  {
    id: 'caterpillar',
    name: '毛毛虫',
    layer: 'discover',
    trigger: '虫眼苹果出现过之后,点击树冠叶片下方藏着的毛毛虫。',
    text: '我只吃了半个,真的。',
    reward: { kind: 'badge', id: 'badge-worm' },
    silhouette: 'caterpillar',
  },
  {
    id: 'clock',
    name: '闹钟',
    layer: 'discover',
    trigger: '夜晚时,点击树下的闹钟。',
    text: '该睡了,果子也要睡。',
    reward: { kind: 'apples', amount: 10 },
    silhouette: 'clock',
  },
  {
    id: 'kimura',
    name: '十年不放弃',
    layer: 'discover',
    trigger: '连续 10 分钟没有苹果被浪费(果堆不溢出,库存不腐烂)。',
    text: '十年不放弃。苹果也是。',
    reward: { kind: 'badge', id: 'badge-kimura' },
    silhouette: 'farmer',
    minEra: 1,
  },
  {
    id: 'newton-5',
    name: '牛顿又来了',
    layer: 'discover',
    trigger: '累计领取"路过的牛顿"事件 5 次。',
    text: '我又想到了什么?',
    reward: { kind: 'apples', amount: 15 },
    silhouette: 'newton-wig',
  },
  {
    id: 'shake-500',
    name: '手酸',
    layer: 'discover',
    trigger: '累计摇树 500 下。',
    text: '手酸了吧?树比你更酸。',
    reward: { kind: 'apples', amount: 30 },
    silhouette: 'hand',
  },
  {
    id: 'streak-7',
    name: '七日之约',
    layer: 'discover',
    trigger: '连续 7 个自然日(UTC+8)都进入过游戏。',
    text: '七天了。树记住了你的脚步声。',
    reward: { kind: 'apples', amount: 30 },
    silhouette: 'calendar',
  },
  {
    id: 'session-60',
    name: '一小时',
    layer: 'discover',
    trigger: '单次打开游戏,连续在线 60 分钟。',
    text: '一小时了。该喝口水,树也是。',
    reward: { kind: 'apples', amount: 10 },
    silhouette: 'cup',
  },
  {
    id: 'duoduo-refuse',
    name: '拒绝的艺术',
    layer: 'discover',
    trigger: '累计点"拒绝"果多多的出价 10 次。',
    text: '你拒绝了十次。他说下次出十一个橘子。',
    reward: { kind: 'apples', amount: 10 },
    silhouette: 'merchant',
    minEra: 3,
  },
  {
    id: 'atalanta',
    name: '阿塔兰忒',
    layer: 'discover',
    trigger: '金苹果掉落后,在它飘走前 3 秒内连续点中它 2 次(追上)。',
    text: '追着金苹果,忘了赛跑。',
    reward: { kind: 'apples', amount: 20 },
    silhouette: 'runner',
    minEra: 2,
  },
  {
    id: 'idunn',
    name: '伊登的金苹果',
    layer: 'discover',
    trigger: '进入第 5 时代(果星)后,点击夜空里的金色苹果篮。',
    text: '伊登的金苹果,吃一个不显老。',
    reward: { kind: 'gold', amount: 1 },
    silhouette: 'basket-gold',
    minEra: 4,
  },
  {
    id: 'sitting-under-tree',
    name: '树下静坐者',
    layer: 'discover',
    trigger: '夜晚随机出现一个树下静坐的人影,点击他。',
    text: '树下坐久了,总会想通点什么。',
    reward: { kind: 'badge', id: 'badge-sitting' },
    silhouette: 'sitting',
    note: '指向"菩提树下悟道"的典故,语气保持温和,不开宗教玩笑。',
  },
  {
    id: 'phone-pun',
    name: '不是手机',
    layer: 'discover',
    trigger: '在设置页连点版本号 5 次。',
    text: '不是手机,没有刘海,只有叶子。(与苹果公司无关)',
    reward: { kind: 'badge', id: 'badge-not-a-phone' },
    silhouette: 'phone',
    note: '苹果手机梗,仅文字;点击后附 DISCLAIMER。',
  },

  // ═════════ 极稀有 ═════════
  {
    id: 'triple-event',
    name: '今天什么日子',
    layer: 'rare',
    trigger: '屏幕上同时存在 3 个随机事件(小鸟/牛顿/流星)。',
    text: '今天什么日子。',
    reward: { kind: 'apples', amount: 60 },
    silhouette: 'calendar-star',
  },
  {
    id: 'money-tree',
    name: '摇钱树',
    layer: 'rare',
    trigger: '连摇 100 下(相邻两下间隔不超过 0.6 秒)。',
    text: '摇钱树不存在,但你摇出来了。',
    reward: { kind: 'cosmetic', id: 'skin-money-tree' },
    silhouette: 'money-tree',
  },
  {
    id: 'three-am',
    name: '凌晨三点',
    layer: 'rare',
    trigger: '本地时间 03:00–03:59 仍在游戏中(页面可见)。',
    text: '苹果也困了。',
    reward: { kind: 'badge', id: 'badge-3am' },
    silhouette: 'moon-zzz',
  },
  {
    id: 'laoxu-sleep',
    name: '老徐睡着了',
    layer: 'rare',
    trigger: '离线超过 8 小时后回到游戏。',
    text: '好梦。老徐帮你摇了一晚。',
    reward: { kind: 'badge', id: 'badge-sleep' },
    silhouette: 'laoxu-sleep',
  },
  {
    id: 'title-7',
    name: '开发者留言',
    layer: 'rare',
    trigger: '在标题画面连点标题 7 次。',
    text: '谢谢你玩。与苹果公司无关,只和你有关。',
    reward: { kind: 'badge', id: 'badge-title' },
    silhouette: 'envelope',
    note: '点击后附 DISCLAIMER。',
  },
  {
    id: 'core-82',
    name: '核还在',
    layer: 'rare',
    trigger: '累计送达达到 82 亿的那一刻。',
    text: '核还在。',
    reward: { kind: 'cosmetic', id: 'skin-core-trophy' },
    silhouette: 'core-gold',
  },
  {
    id: 'shake-5000',
    name: '树想谈谈',
    layer: 'rare',
    trigger: '累计摇树 5000 下。',
    text: '树说:我们谈谈吧。(它没谈,它掉了个苹果。)',
    reward: { kind: 'cosmetic', id: 'skin-tree-scar' },
    silhouette: 'tree-talk',
  },
];

/** 图鉴里"未发现"时显示的灰色提示(key = egg id;不剧透具体操作,只给方向) */
export const EGG_TRIGGER_HINTS: Record<string, string> = {
  eve: '也许……该看看树顶?',
  newton: '有位路人经常在树下坐着。',
  'snow-white': '山脚下有个卖苹果的摊子。',
  paris: '山顶有点反光。',
  'big-apple': '城里最高的那栋,在看着你。',
  daily: '每天来一趟,就有了。',
  'xmas-eve': '要等一个特别的夜晚。',
  'xmas-sock': '临近圣诞,树下多了点东西。',
  tell: '老徐头顶,好像有点什么。',
  snake: '摇得够多,总会掉点奇怪的。',
  adam: '老徐的脖子上,似乎有个凸起。',
  'apple-of-eye': '对老徐好一点,多戳戳。',
  pie: '浪费可耻,变成点别的。',
  johnny: '什么都不做,有时也是做。',
  garage: '车库门口,有个黑影。',
  turtleneck: '高楼的窗口里,有个黑影。',
  einstein: '抬头看看夜空。',
  core: '地上有人吃剩了点什么。',
  vinegar: '角落里,有个桶。',
  jam: '架子上,有个罐子。',
  green: '有颗苹果,看起来还没熟。',
  orange: '有位访客手里拿的,好像不对。',
  'daily-news': '新闻条,多点几下试试。',
  caterpillar: '叶子下面,好像有动静。',
  clock: '夜深了,树下有个东西在滴答。',
  kimura: '耐心经营,别浪费。',
  'newton-5': '那位路人,不止来一次。',
  'shake-500': '摇到手酸为止。',
  'streak-7': '连续来七天看看。',
  'session-60': '安安静静玩一小时。',
  'duoduo-refuse': '奸商出价多次,你要说不。',
  atalanta: '金色的东西,别让它飘走。',
  idunn: '星空里,有只发光的篮子。',
  'sitting-under-tree': '夜里,树下有时有人。',
  'phone-pun': '设置页的角落,有串数字。',
  'triple-event': '一天里最热闹的时刻。',
  'money-tree': '手速,再快点。',
  'three-am': '你睡了吗?',
  'laoxu-sleep': '离开很久,再回来。',
  'title-7': '标题,是不是可以点?',
  'core-82': '到终点时,会剩点什么。',
  'shake-5000': '树的忍耐,也有限度。',
};

/** 各层级总数(图鉴进度 n/N 用) */
export const EGG_COUNT = EGGS.length;
export const EGG_BY_ID: Record<string, Egg> = Object.fromEntries(EGGS.map((e) => [e.id, e]));

/** 点击后需要附带声明的彩蛋 id */
export const DISCLAIMER_EGG_IDS: readonly string[] = ['garage', 'turtleneck', 'phone-pun', 'title-7'];
/** 同上,按 systems 的 id */
export const DISCLAIMER_SYS_EGG_IDS: readonly string[] = ['jobs', 'title7'];

// ───────────── 与 src/core/sys/eggs.ts 对齐的文案表 ─────────────
// systems 的彩蛋 id(31 个)与本文件 id 不完全同名,下面是映射。EGG_TEXT 按 systems 的 id 给出
// {title 图鉴名, text 触发文案, hint 未发现灰字}。reward 以 systems 的实现为准,这里的 reward 仅作参考。
export const SYS_EGG_ID_MAP: Record<string, string> = {
  eve: 'eve', newton: 'newton', snowwhite: 'snow-white', paris: 'paris', bigapple: 'big-apple',
  daily: 'daily', tell: 'tell', snake: 'snake', adam: 'adam', pearl: 'apple-of-eye', pie: 'pie',
  johnny: 'johnny', jobs: 'turtleneck', einstein: 'einstein', kimura: 'kimura', xmaseve: 'xmas-eve',
  moneytree: 'money-tree', am3: 'three-am', sleeper: 'laoxu-sleep', title7: 'title-7',
  triple: 'triple-event', core82: 'core-82', seedcore: 'core', vinegar: 'vinegar', jam: 'jam',
  granny: 'green', orange: 'orange', newsfront: 'daily-news', caterpillar: 'caterpillar',
  clock: 'clock', stocking: 'xmas-sock',
};

export interface EggText { title: string; text: string; hint: string }

export const EGG_TEXT: Record<string, EggText> = Object.fromEntries(
  Object.entries(SYS_EGG_ID_MAP).map(([sysId, myId]) => {
    const e = EGG_BY_ID[myId];
    // jobs = 车库 + 高领剪影合并:一句话带两层梗,声明保留
    const text = sysId === 'jobs' ? '咬一口才完整。保持饥饿,保持愚蠢。(与苹果公司无关)' : e.text;
    const title = sysId === 'jobs' ? '高领先生' : e.name;
    return [sysId, { title, text, hint: EGG_TRIGGER_HINTS[myId] ?? '' }];
  }),
);

/** systems 暂未接入的额外彩蛋(本文件有文案和触发描述,要不要做由 lead 定) */
export const EXTRA_EGG_IDS: string[] = EGGS.map((e) => e.id).filter(
  (id) => !Object.values(SYS_EGG_ID_MAP).includes(id),
);
