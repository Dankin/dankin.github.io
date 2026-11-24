// 老徐 8 级可升级角色:档名、升级卡文案、台词库(纯数据)。
// 用途:老徐头顶气泡、点击反馈、升级卡(商店/升档点)、离线回来、与其他角色的对手戏。
// 与旧文案兼容:characters.ts 里 CHARACTERS 的 laoxu 旧台词保留不删;laoxuLine() 在新库无匹配时回退到旧台词。
// 术语:统一叫"快乐水",不出现品牌名。口头禅:"这个季节的苹果,放在我年轻的时候……"(只说半句)。
// 人设:嘴硬("不累"),随后掏马扎;口袋偷塞苹果,自称"质检";圣诞老人欠他三年工资。
// 约束:每句 ≤24 字;升级卡笑话 ≤20 字。id 稳定不改,新增追加到数组末尾。
//
// 等级 level:1 喊加油 2 打拍子 3 鼓掌 4 伸手帮忙 5 正经摇树 6 掏马扎偷懒 7 带徒弟 8 退休顾问。
// 状态 state(程序按状态+等级+条件分桶):
//   work   正在摇树/帮忙           slack  坐马扎偷懒(≥6 级)
//   nap    睡着了(≥6 级)            watch  站旁边看/空闲冒泡
//   tap    被玩家点击               wake   被叫醒/被点醒
//   crit   触发暴击(偷懒赌局)       away   玩家久未上线回来
//   rival  与别的角色对手戏,with 指明对象
// 条件 cond(可选,命中时优先于无条件句):night 夜 / rain 雨 / snow 雪 / xmas 圣诞(12/20 后)。

import { CHAR_BY_ID } from './characters.ts';

export type LaoxuLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type LaoxuState = 'work' | 'slack' | 'nap' | 'watch' | 'tap' | 'wake' | 'crit' | 'away' | 'rival';
export type LaoxuCond = 'night' | 'rain' | 'snow' | 'xmas';
export type LaoxuWith = 'xiaoman' | 'crow' | 'newton' | 'santa';

export interface LaoxuLevelText {
  level: LaoxuLevel;
  /** 档名(角色面板/徽标) */
  name: string;
  /** 升级卡标题 */
  card: string;
  /** 升级卡笑话 ≤20 字 */
  joke: string;
  /** 他在做什么(给美术/程序看的一句人话) */
  doing: string;
}

export const LAOXU_LEVELS: LaoxuLevelText[] = [
  { level: 1, name: '喊加油', card: '请老徐在旁边喊加油', joke: '嗓门不小,手没动。', doing: '站在树边,双手拢嘴喊加油。' },
  { level: 2, name: '打拍子', card: '给老徐一根拍子棒', joke: '节奏很稳,人没动。', doing: '拿一根树枝打拍子,一二三四。' },
  { level: 3, name: '鼓掌', card: '请老徐上场鼓掌', joke: '手拍红了,苹果没掉。', doing: '站在树边使劲鼓掌。' },
  { level: 4, name: '伸手帮忙', card: '请老徐搭把手', joke: '就扶一下,不算帮你。', doing: '伸手扶树干,偶尔推一把。' },
  { level: 5, name: '正经摇树', card: '老徐开始正经摇树', joke: '这回是真的,别眨眼。', doing: '双手抱树,用腰发力。' },
  { level: 6, name: '马扎派', card: '给老徐配个马扎', joke: '摇两下,坐一下。', doing: '摇几下就掏小马扎坐下喝快乐水。' },
  { level: 7, name: '带徒弟', card: '给老徐收个徒弟', joke: '自己不摇,徒弟来摇。', doing: '坐马扎指挥徒弟摇树。' },
  { level: 8, name: '退休顾问', card: '给老徐摆张躺椅', joke: '躺椅,茶杯,收音机。', doing: '躺椅上喝茶听收音机,偶尔指点一句。' },
];

export interface LaoxuLine {
  id: string;
  /** 适用等级(含) */
  min: LaoxuLevel;
  max: LaoxuLevel;
  state: LaoxuState;
  cond?: LaoxuCond;
  with?: LaoxuWith;
  text: string;
  /** 触发场景(人话) */
  trigger: string;
}

type Row = [min: LaoxuLevel, max: LaoxuLevel, state: LaoxuState, text: string, trigger: string, extra?: { cond?: LaoxuCond; with?: LaoxuWith }];

function mk(rows: Row[]): LaoxuLine[] {
  return rows.map((r, i) => ({
    id: `lx-${String(i + 1).padStart(3, '0')}`,
    min: r[0], max: r[1], state: r[2], text: r[3], trigger: r[4], ...(r[5] ?? {}),
  }));
}

export const LAOXU_LINES: LaoxuLine[] = mk([
  // ── 1 喊加油
  [1, 1, 'work', '加油!加油!我喊,你摇!', '1 级,玩家连摇时'],
  [1, 1, 'work', '一二一,腰板挺直!', '1 级,每 40 次摇树抽一次'],
  [1, 1, 'watch', '我在这儿呢,别回头。', '1 级,空闲 30 秒'],
  [1, 1, 'tap', '嘘,我在给你加油。', '1 级,点击老徐'],
  // ── 2 打拍子
  [2, 2, 'work', '一、二、三、四,摇!', '2 级,连摇时'],
  [2, 2, 'work', '跟着我的拍子,别抢!', '2 级,每 40 次摇树抽一次'],
  [2, 2, 'watch', '咚、咚、咚。树都听困了。', '2 级,空闲 30 秒'],
  [2, 2, 'tap', '打岔了!重来,从头数。', '2 级,点击老徐'],
  // ── 3 鼓掌
  [3, 3, 'work', '好!再来一个!', '3 级,连摇时'],
  [3, 3, 'work', '掌声送给你,不收费。', '3 级,每 40 次摇树抽一次'],
  [3, 3, 'watch', '手拍红了。值。', '3 级,空闲 30 秒'],
  [3, 3, 'tap', '别拉我,我正拍到兴头上。', '3 级,点击老徐'],
  // ── 4 伸手帮忙
  [4, 4, 'work', '我就扶一下树,不算帮你。', '4 级,摇树时(旧口头禅的延续)'],
  [4, 4, 'work', '让让,我托一把。', '4 级,连摇时'],
  [4, 4, 'work', '顺手的事,别谢。', '4 级,每 40 次摇树抽一次'],
  [4, 4, 'tap', '别戳。我这是在运功。', '4 级,点击老徐'],
  // ── 5 正经摇树
  [5, 5, 'work', '看好了,摇树要用腰。', '5 级,连摇时'],
  [5, 5, 'work', '我年轻时,一晚上摇三棵。', '5 级,每 40 次摇树抽一次'],
  [5, 5, 'work', '这才叫摇,你那是挠痒。', '5 级,玩家摇得慢时'],
  [5, 5, 'tap', '别拉我,这一棵快成了。', '5 级,点击老徐'],
  [5, 5, 'watch', '腰有点酸。不是累,是酸。', '5 级,空闲 30 秒(嘴硬铺垫)'],
  // ── 6+ 嘴硬后掏马扎
  [6, 8, 'work', '不累。……我坐一下。', '6 级及以上,摇满一轮后转入偷懒'],
  [6, 8, 'slack', '这个季节的苹果,放在我年轻的时候……', '6 级及以上,坐下后的口头禅(只说半句)'],
  [6, 8, 'slack', '马扎一掏,天下太平。', '6 级及以上,坐下时'],
  [6, 8, 'slack', '冰的快乐水,别告诉小满。', '6 级及以上,偷懒状态空闲'],
  [6, 8, 'slack', '我在观察。真的。', '6 级及以上,偷懒状态空闲'],
  [6, 8, 'slack', '就歇一小会儿。(三十分钟)', '6 级及以上,偷懒持续 60 秒后'],
  [6, 8, 'slack', '口袋里?质检样品。', '6 级及以上,偷懒状态空闲(口袋偷塞苹果的暗示)'],
  [6, 8, 'slack', '这个苹果我尝过了,没毒。', '6 级及以上,偷懒状态空闲'],
  [6, 8, 'nap', 'zzz……别吵,在运功。', '6 级及以上,偷懒超过 120 秒睡着'],
  [6, 8, 'nap', '呼……这棵树……该摇了……呼。', '6 级及以上,睡着状态'],
  [6, 8, 'wake', '没睡!闭目养神。', '6 级及以上,被点击叫醒'],
  [6, 8, 'wake', '谁?我没睡。树自己在掉。', '6 级及以上,事件打断睡眠'],
  [6, 8, 'tap', '哎,快乐水洒了!', '6 级及以上,偷懒状态下点击'],
  [6, 8, 'tap', '戳我干嘛?我有质检任务。', '6 级及以上,点击老徐'],
  [6, 8, 'crit', '暴击!看见没,这叫手艺。', '6 级及以上,偷懒触发暴击'],
  [6, 8, 'crit', '偷懒的时候,手气最好。', '6 级及以上,偷懒触发暴击'],
  [6, 8, 'crit', '哎哟,这个我真没想到。', '6 级及以上,偷懒触发暴击'],
  // ── 7 带徒弟
  [7, 7, 'work', '徒弟,摇!师父盯着。', '7 级,徒弟摇树时'],
  [7, 7, 'work', '手法不对,看师父的。……算了你来。', '7 级,每 40 次摇树抽一次'],
  [7, 7, 'slack', '徒弟,给师父倒杯快乐水。', '7 级,偷懒状态'],
  [7, 7, 'watch', '好徒弟。就是太勤快。', '7 级,空闲 30 秒'],
  [7, 7, 'tap', '找徒弟,别找我。', '7 级,点击老徐'],
  // ── 8 退休顾问
  [8, 8, 'work', '收音机说,今天宜摇树。', '8 级,每 40 次摇树抽一次'],
  [8, 8, 'work', '这棵树,我看了五十年。', '8 级,摇树时'],
  [8, 8, 'slack', '躺椅一摆,指点江山。', '8 级,偷懒状态'],
  [8, 8, 'slack', '茶凉了。树还在摇,甚好。', '8 级,偷懒状态空闲'],
  [8, 8, 'watch', '收音机又说,明天也宜摇树。', '8 级,空闲 30 秒'],
  [8, 8, 'tap', '嘘,这段评书,正到关键。', '8 级,点击老徐'],
  // ── 时间/天气
  [1, 8, 'watch', '夜里摇树,苹果会做梦。', '夜晚时空闲', { cond: 'night' }],
  [1, 8, 'work', '夜里的树,比白天听话。', '夜晚时连摇', { cond: 'night' }],
  [1, 8, 'watch', '下雨了。马扎下面垫张报纸。', '下雨时空闲', { cond: 'rain' }],
  [1, 8, 'work', '雨天树滑,别摇太猛。', '下雨时连摇', { cond: 'rain' }],
  [1, 8, 'watch', '下雪了。老骨头自己会报天气。', '下雪时空闲', { cond: 'snow' }],
  [1, 8, 'work', '雪压树枝,这一摇正好。', '下雪时连摇', { cond: 'snow' }],
  [1, 8, 'watch', '圣诞老头欠我三年工资。', '12/20 后空闲', { cond: 'xmas' }],
  [1, 8, 'work', '摇完这棵,我去讨薪。', '12/20 后连摇', { cond: 'xmas' }],
  [6, 8, 'slack', '圣诞老头的雪橇,我年轻时推过。', '12/20 后偷懒状态', { cond: 'xmas' }],
  // ── 久未上线
  [1, 8, 'away', '你可算回来了,我马扎都坐出印了。', '离线 ≥10 分钟回到游戏'],
  [1, 8, 'away', '回来啦?我替你看着了。', '离线 ≥10 分钟回到游戏(旧口头禅)'],
  [6, 8, 'away', '这么久?我口袋都空了。', '离线 ≥1 小时回到游戏'],
  [1, 8, 'away', '你不在,树也不爱掉苹果。', '离线 ≥1 天回到游戏'],
  // ── 对手戏
  [1, 8, 'rival', '小满来了?把快乐水藏好。', '督察小满出场时', { with: 'xiaoman' }],
  [1, 8, 'rival', '她问口袋里是什么。质检。', '督察小满事件结束后', { with: 'xiaoman' }],
  [1, 8, 'rival', '老黑,那是我的苹果!我的!', '乌鸦事件出现时', { with: 'crow' }],
  [1, 8, 'rival', '乌鸦别动,我先质检。', '乌鸦事件被点掉后', { with: 'crow' }],
  [1, 8, 'rival', '牛顿,你又来了。树不欠你的。', '牛顿事件出现时', { with: 'newton' }],
  [1, 8, 'rival', '那小子,总在树下打盹。', '牛顿事件结束后', { with: 'newton' }],
  [1, 8, 'rival', '老头,工资的事,圣诞节聊。', '圣诞老人来电时', { with: 'santa' }],
  [1, 8, 'rival', '你腰好点没?我的比你还差。', '圣诞老人来电时(低频)', { with: 'santa' }],
]);

export const LAOXU_CATCHPHRASE = '这个季节的苹果,放在我年轻的时候……';

/** 按等级/状态/条件/对手挑一句候选(调用方再随机)。无匹配回退到旧版 characters.ts 的老徐台词。 */
export function laoxuLines(
  level: LaoxuLevel,
  state: LaoxuState,
  opts: { cond?: LaoxuCond; with?: LaoxuWith } = {},
): string[] {
  const pool = LAOXU_LINES.filter(
    (l) => l.state === state && level >= l.min && level <= l.max && (state !== 'rival' || l.with === opts.with),
  );
  const cond = opts.cond ? pool.filter((l) => l.cond === opts.cond) : [];
  if (cond.length) return cond.map((l) => l.text);
  const plain = pool.filter((l) => !l.cond);
  if (plain.length) return plain.map((l) => l.text);
  const legacyOn: Partial<Record<LaoxuState, string>> = { work: 'shake', watch: 'idle', tap: 'tap', away: 'away' };
  const on = legacyOn[state];
  return CHAR_BY_ID.laoxu.lines.filter((l) => l.on === on).map((l) => l.text);
}

/** 偷懒中点老徐,30% 得"气泡水"(奖励 8 秒收入)时的台词/toast,随机取一条。每句 ≤24 字。 */
export const LAOXU_SODA_LINES: readonly string[] = [
  '拿去,气泡水。别告诉小满。',
  '滋——送你一口,算封口费。',
  '摇出来的,不算偷懒。',
  '多出一瓶,你喝吧。',
];
export const LAOXU_SODA_TOAST = '老徐塞给你一瓶气泡水。收入 +8 秒。';
