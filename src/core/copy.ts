import type { ProjectId, UpgradeId } from './state.ts';

export type PlaceId = 'tree' | 'hut' | 'mailbox' | 'chime' | 'pond';
export const PLACE_IDS: PlaceId[] = ['tree', 'hut', 'mailbox', 'chime', 'pond'];

/** 地点:卡片标题、里面挂哪两个升级、累计多少苹果后出现 */
export const PLACES: Record<PlaceId, { name: string; ups: [UpgradeId, UpgradeId]; unlockAt: number }> = {
  tree: { name: '老树', ups: ['shake', 'branches'], unlockAt: 0 },
  hut: { name: '老徐的小屋', ups: ['gardener', 'tractor'], unlockAt: 0 },
  mailbox: { name: '邮筒', ups: ['express', 'drone'], unlockAt: 2e3 },
  chime: { name: '风铃', ups: ['breeze', 'shaker'], unlockAt: 1e5 },
  pond: { name: '池塘', ups: ['breed', 'cloud'], unlockAt: 1e7 },
};

/** 升级的名字和一句笑话(效果文字在 game.ts 的 hint) */
export const UPGRADE_COPY: Record<UpgradeId, { name: string; joke: string }> = {
  shake: { name: '晃晃更健康', joke: '树:"别晃了。"你:"再晃一下。"' },
  branches: { name: '枝繁叶茂(没人修剪)', joke: '不是你养得好,是没人敢剪。' },
  gardener: { name: '老徐上班了', joke: '合同写的是"浇水"。老徐理解为"顺便摇树"。' },
  tractor: { name: '老徐的拖拉机', joke: '突突突。苹果没运走多少,但声势很大。' },
  express: { name: '平安快递(不保证平安)', joke: '送到的时候是苹果。有时候是苹果酱。' },
  drone: { name: '无人机采摘', joke: '它自己也想吃一个。目前已经偷吃了三个。' },
  breeze: { name: '微风(邻居叹气)', joke: '据查,是隔壁在叹气。叹气也算劳动。' },
  shaker: { name: '摇树机(不累,但吵)', joke: '邻居投诉了。你把投诉也摇了下来。' },
  breed: { name: '给锦鲤也改良一下', joke: '池塘里的鱼听说有品种改良,也报了名。' },
  cloud: { name: '苹果云', joke: '苹果上传到云端了。云端:"满了。"' },
};

export interface VisitorCopy {
  name: string;
  /** 访客站在哪个地点旁边 */
  place: PlaceId;
  /** 对话,一行一句 */
  lines: string[];
  accept: string;
  decline: string;
  /** 成交后飘字 */
  after: string;
  /** 成交后再点它,随机说一句 */
  idle: string[];
}

export const VISITORS: Record<ProjectId, VisitorCopy> = {
  gravity: {
    name: '午睡的牛顿', place: 'tree',
    lines: ['树下躺着一个人,假发歪了,睡得很香。', '他嘟囔:"别叫我,我快梦到那个公式了。"'],
    accept: '让他睡(成交)', decline: '改天吧',
    after: '苹果开始每隔一会儿自己砸下来。他翻了个身,公式更完整了。',
    idle: ['"……啊,什么东西?"', '"这个重量,有点意思。"', '"再来一个,我就悟了。"'],
  },
  fairest: {
    name: '最美的苹果', place: 'tree',
    lines: ['树上长出一个金灿灿的苹果,刻着一行小字:"献给最美者。"', '三位女神已经在路上了,其中一位带着律师。'],
    accept: '先摘下来(成交)', decline: '改天吧',
    after: '它在树上闪了一下。点中它有奖励,别让女神先到。',
    idle: ['金苹果闪了一下。', '"最美者"这三个字,印得有点用力。'],
  },
  cook: {
    name: '苹果发布会', place: 'tree',
    lines: ['一个穿黑色高领的人走上台,灯亮了。', '"Good morning."——台下只有一只松鼠,但它鼓掌了。'],
    accept: '开发布会(成交)', decline: '改天吧',
    after: '发布会开了。过一阵子还能再开一场。',
    idle: ['"这是我们做过最苹果的苹果。"', '松鼠又鼓掌了。', '"它会改变一切。"——一切?哪一切?'],
  },
  duo: {
    name: 'iPhone Duo', place: 'hut',
    lines: ['有人递来一台能折叠的手机,屏幕正中间有一道缝。', '"一次掉两个,"他说,"这才叫 Duo。"'],
    accept: '收下(成交)', decline: '改天吧',
    after: '每次摇都多掉一个。缝没人提。',
    idle: ['屏幕中间那道缝,是特性。', '"Duo,不是 Duel。"'],
  },
  garage: {
    name: '车库里的怪人', place: 'hut',
    lines: ['车库灯亮着,里面有个人在拧螺丝,墙上有行字。', '"Stay hungry. Stay foolish."——你很饿,而且确实有点傻。'],
    accept: '进去看看(成交)', decline: '改天吧',
    after: '自动产出变快了。怪人没抬头,继续拧。',
    idle: ['"再薄一点。"', '"这个螺丝,不对。"'],
  },
  doctor: {
    name: '路过的医生', place: 'pond',
    lines: ['一位老医生路过,看了看你的苹果篮。', '"每天一个,我就可以不来了。"他边说边走远了。'],
    accept: '多吃点(成交)', decline: '改天吧',
    after: '全部产出提高了。医生没回头,摆了摆手。',
    idle: ['"别熬夜。"', '"听我的,别熬夜。"'],
  },
  witch: {
    name: '提篮子的老太太', place: 'pond',
    lines: ['一位老太太提着篮子,里面的苹果红了一半。', '"尝尝?红的那一半有毒。"——她没说是哪一半。'],
    accept: '咬一口(成交)', decline: '我还是不了',
    after: '你睡着了。树还在长,世界替你做了二十分钟的事。',
    idle: ['"睡得好吗?"', '"白雪公主那次是意外。"'],
  },
  onemore: {
    name: '还有一件事', place: 'tree',
    lines: ['发布会快结束了,台上那个人又走回话筒前。', '"One more thing……"——松鼠屏住了呼吸。'],
    accept: '听他讲完(成交)', decline: '改天吧',
    after: '发布会的加成更大了。松鼠晕过去了。',
    idle: ['"还有一件事。"', '"真的就一件。"'],
  },
};

/** 禁果:夏娃与蛇,每次一口 */
export const BITE_SCENES: { lines: string[]; accept: string; decline: string; after: string }[] = [
  { lines: ['夏娃站在树下,盯着最红的那个。', '蛇在树上说:"别吃那个。"——听起来像在推销。'], accept: '咬一口', decline: '再想想', after: '全部产出 ×2。蛇点了点头,像是赢了。' },
  { lines: ['夏娃又来了。', '蛇没说话,只是笑了一下。'], accept: '再咬一口', decline: '再想想', after: '全部产出再 ×2。蛇不笑了,开始记账。' },
  { lines: ['夏娃咬到了核。', '蛇小声说:"从此,世界上有了苹果的故事。"'], accept: '最后一口', decline: '再想想', after: '全部产出再 ×2。故事开始了。' },
];

/** 82 亿到达后,没到 12/24 看到的话 */
export const SEALED = ['树下多了一个盒子。', '盒子上写着:圣诞节再拆。', '(苹果还可以继续摇,先别急。)'];
