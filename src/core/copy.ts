// 文案:提示条、升档 toast、事件、离线、封存。名字和分支笑话在 content.ts。
import type { EventKind } from './events.ts';
import type { GateId } from './content.ts';

/** 升档瞬间的一句话(索引 = 新档 1..5;[0] 不用) */
export const ERA_TOAST = {
  source: [
    '',
    '树多了,开始叫"园"了。',
    '果园爬上了山。山没有意见。',
    '山脚下盖起了城,城里全是苹果。',
    '苹果长出了大气层。邻居们看不懂。',
    '推开那道门,里面还是苹果。',
  ],
  route: [
    '',
    '篮子长出了两个轮子。',
    '突突突,卡车来了,喇叭比苹果先到。',
    '苹果出海了。苹果:我晕船。',
    '苹果第一次坐头等舱。',
    '这头一个苹果,那头还是一个苹果。物理学家沉默了。',
  ],
} as const;

export const GATE_UNLOCK_TOAST = (name: string): string => `新道具:${name}。槽里换一换,试试看。`;

/** 产出追不上运力 / 运力追不上产出时的一句话提示 */
export const BOTTLENECK_TIP = {
  produce: '车在等苹果。多摇几下,或者再加树。',
  carry: '苹果堆在场里了。加几辆车吧。',
  balanced: '产出和运力刚好,买哪边都行。',
} as const;

export const WASTE_TIP = '堆场满了,苹果在往外掉。';

export const EVENT_TEXT: Record<EventKind, { appear: string; claim: string }> = {
  bird: { appear: '一只小鸟叼着个苹果,飞过来了。', claim: '它放下一份苹果,飞走了。' },
  newton: { appear: '牛顿在树下坐下了,假发有点歪。', claim: '"啊!"他想到了什么。接下来 10 秒摇一摇翻倍。' },
  meteor: { appear: '一颗流星拖着红光划过天空。', claim: '它落下来的是一整车苹果。' },
};

/** 摇树时冒出来的小字(UI 随机挑) */
export const SHAKE_TEXT = ['哗啦!', '掉了掉了!', '树:别摇了别摇了', '再来!', '叶子也掉了'];
/** 连摇到一定数时的小字 */
export const COMBO_TEXT = ['连摇!', '手速!', '树晕了!', '这手速,树要报警了'];
export const HELPER_TEXT = { hired: '老徐来了,他说他只摇一会儿。', none: '还没人帮你摇。' };

export const awayLine = (minutes: number): string =>
  minutes < 2 ? '你刚走开一会儿,苹果在继续送。'
  : minutes < 60 ? `你走开了 ${Math.round(minutes)} 分钟,车队没停。`
  : `你走开了 ${(minutes / 60).toFixed(1)} 小时,苹果一直在路上。`;

export const WIN_LINES = ['最后一个苹果送到了。', '八十二亿。数字很大,但每个都是真的苹果。'];

/** 82 亿到达后,没到 12/24 看到的话 */
export const SEALED = ['树下多了一个盒子。', '盒子上写着:圣诞节再拆。', '(苹果还可以继续摇,先别急。)'];

/** 道具槽空着时的提示 */
export const EMPTY_SLOT_TIP = '空槽。放一个道具进去,什么都不做就是浪费。';
export type { GateId };
