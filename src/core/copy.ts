import type { ProjectId, UpgradeId } from './state.ts';

/** 地点:每个地点挂 2 个升级;unlockAt 为累计送出的苹果数 */
export type PlaceId = 'tree' | 'hut' | 'mailbox' | 'chime' | 'pond';
export const PLACE_IDS: PlaceId[] = ['tree', 'hut', 'mailbox', 'chime', 'pond'];
export const PLACES: Record<PlaceId, { name: string; upgrades: [UpgradeId, UpgradeId]; unlockAt: number }> = {
  tree: { name: '老树', upgrades: ['shake', 'branches'], unlockAt: 0 },
  hut: { name: '小屋', upgrades: ['gardener', 'tractor'], unlockAt: 0 },
  mailbox: { name: '邮筒', upgrades: ['express', 'drone'], unlockAt: 2e3 },
  chime: { name: '风铃', upgrades: ['breeze', 'shaker'], unlockAt: 1e5 },
  pond: { name: '池塘', upgrades: ['breed', 'cloud'], unlockAt: 1e7 },
};
export const placeOf = (id: UpgradeId): PlaceId => PLACE_IDS.find((p) => PLACES[p].upgrades.includes(id))!;

/** 升级的一句笑话(名字和效果在 game.ts) */
export const UPGRADE_JOKES: Record<UpgradeId, string> = {
  shake: '树:"别晃了。"你:"再晃一下。"',
  breeze: '据查,是隔壁在叹气。叹气也算劳动。',
  gardener: '合同上写的是"浇水",老徐理解成了"顺便摇树"。',
  branches: '不是你养得好,是没人敢剪。',
  breed: '池塘里的鱼听说有品种改良,也报了名。',
  tractor: '突突突。苹果没运走多少,但声势很大。',
  shaker: '邻居投诉了。你把投诉也摇了下来。',
  drone: '它自己也想吃一个,已经偷偷吃了三个。',
  express: '运到的时候是苹果。有时是苹果酱。',
  cloud: '苹果上传到云端了。云端:"满了。"',
};

export interface VisitorCopy {
  who: string;
  place: PlaceId;
  lines: string[];
  yes: string;
  no: string;
  after: string;
  /** 成交后点角色冒的台词,随机一句 */
  quips: string[];
}

export const VISITORS: Record<ProjectId, VisitorCopy> = {
  gravity: {
    who: '牛顿', place: 'tree',
    lines: ['树下躺着一个人,假发歪了,睡得很香。', '他嘟囔:"别叫我。我梦到一个公式,快好了。"'],
    yes: '让他睡', no: '改天吧', after: '苹果隔一会儿就自己砸下来一个。他翻了个身,公式更完整了。',
    quips: ['"哎哟。……有意思。"', '"别吵,我在想。"', '"为什么是向下?"'],
  },
  fairest: {
    who: '金苹果', place: 'tree',
    lines: ['树上长出一个金灿灿的苹果,刻着一行小字:"献给最美者。"', '三位女神已经在路上了,其中一位带着律师。'],
    yes: '先摘下来', no: '改天吧', after: '它时不时在树上闪一下。点中有奖励。',
    quips: ['它闪了闪,像在说"我知道我最美"。', '"请排队。"'],
  },
  cook: {
    who: '发布会', place: 'hut',
    lines: ['一个穿黑色高领的人走上台,灯亮了。', '"Good morning."台下只有一只松鼠,但它鼓掌了。'],
    yes: '开发布会', no: '改天吧', after: '每隔一阵就能再开一场,开场前先等台下的松鼠坐好。',
    quips: ['"这是我们做过最……苹果的苹果。"', '松鼠举起了手。'],
  },
  duo: {
    who: '折叠手机', place: 'mailbox',
    lines: ['有人递来一台能折叠的手机,屏幕正中间有一道缝。', '"一次掉两个,"他说,"这才叫 Duo。"'],
    yes: '买一台', no: '改天吧', after: '一次摇下来两个。缝里偶尔会夹住一个。',
    quips: ['"缝是特性,不是缺陷。"', '它又折了一下,苹果掉进了缝里。'],
  },
  garage: {
    who: '车库', place: 'hut',
    lines: ['小屋旁边多了一间车库,灯亮着,里面有人在拧螺丝。', '墙上写着:"Stay hungry. Stay foolish."你很饿,也确实有点傻。'],
    yes: '递一把螺丝刀', no: '改天吧', after: '车库里叮叮当当。自动产出多了一半。',
    quips: ['"这个再做小一点。"', '"我们先从一个苹果开始。"'],
  },
  doctor: {
    who: '老医生', place: 'pond',
    lines: ['一位老医生路过,看了看你的苹果篮。', '"每天一个,我就不用来了。"他边说边走远了。'],
    yes: '送他一个', no: '改天吧', after: '他在池塘边坐下,每天吃一个,然后叹气:"又没生意。"',
    quips: ['"多吃苹果。我不是推销。"', '"我今天的号还没人挂。"'],
  },
  witch: {
    who: '老太太', place: 'pond',
    lines: ['一位老太太提着篮子过来,苹果红了一半。', '"尝尝?红的那一半有毒。"她没说是哪一半。'],
    yes: '咬一口', no: '改天吧', after: '你睡着了。醒来的时候,树还在替你工作。',
    quips: ['"白的那一半也别想轻松。"', '"我只是路过。"'],
  },
  onemore: {
    who: '发布会返场', place: 'hut',
    lines: ['发布会快结束了,台上那个人又走回话筒前。', '"One more thing……"台下的松鼠屏住了呼吸。'],
    yes: '听他说', no: '改天吧', after: '发布会的加成从 ×3 升到 ×5。松鼠哭了。',
    quips: ['"这一次,是真的最后一件。"', '松鼠已经开始鼓掌了。'],
  },
};

/** 夏娃 + 蛇:三口 */
export const BITE_SCENES: { lines: string[]; yes: string; no: string; after: string }[] = [
  { lines: ['夏娃站在树下,盯着最红的那一个。', '蛇在树上:"别吃那个。"——它的语气像是在推销。'], yes: '咬一口', no: '再想想', after: '甜的。全部产出翻倍。蛇满意地点了点头。' },
  { lines: ['夏娃又来了。这次她带了盐。', '蛇没说话。它只是笑了一下。'], yes: '再咬一口', no: '再想想', after: '更甜了。全部产出再翻倍。' },
  { lines: ['夏娃已经不看树了,她看着你。', '"最后一口,"蛇说,"咬完这个,世界上就有苹果的故事了。"'], yes: '最后一口', no: '再想想', after: '从此,世界上有了苹果的故事。全部产出再翻倍。' },
];

/** 82 亿到了但还没到日期时 */
export const SEALED_TEXT = '树下多了一个盒子,上面写着:圣诞节再拆。';
