import { GOAL } from './constants.ts';
import type { State } from './state.ts';

export interface AchDef {
  id: string;
  name: string;
  /** 未解锁时显示的线索 */
  hint: string;
  /** 解锁后显示的说明 */
  desc: string;
  test: (s: State) => boolean;
}

const lv = (s: State) => Object.values(s.upgrades).reduce((a, b) => a + b, 0);

export const ACHIEVEMENTS: AchDef[] = [
  { id: 'first', name: '第一个苹果', hint: '摇一下就知道了', desc: '摇下了第一个苹果。', test: (s) => s.clicks >= 1 },
  { id: 'shake100', name: '手腕酸了', hint: '一直摇。一直摇。', desc: '摇了 100 下。', test: (s) => s.clicks >= 100 },
  { id: 'shake1000', name: '摇滚', hint: '摇一千下。', desc: '摇了 1000 下。', test: (s) => s.clicks >= 1000 },
  { id: 'xu', name: '老徐来了', hint: '隔壁院子的人愿意帮忙。', desc: '请到了园丁老徐。', test: (s) => s.upgrades.gardener >= 1 },
  { id: 'lv50', name: '升级狂人', hint: '一共买到 50 级升级。', desc: '升级累计 50 级。', test: (s) => lv(s) >= 50 },
  { id: 'newton', name: '被砸中的人', hint: '树下坐着一个人,他想通了一件事。', desc: '万有引力。', test: (s) => s.projects.gravity },
  { id: 'fairest', name: '献给最美者', hint: '有一个苹果上刻着字。', desc: '拿到了最美的苹果。', test: (s) => s.projects.fairest },
  { id: 'gold', name: '金灿灿', hint: '品种改良之后,树上结出了别的颜色。', desc: '培育出了金苹果。', test: (s) => s.upgrades.breed >= 1 },
  { id: 'event', name: 'Good morning', hint: '台上的人说了一句早上好。', desc: '办了一场苹果发布会。', test: (s) => s.projects.cook },
  { id: 'duo', name: '一次两个', hint: '一部手机,两个苹果。', desc: 'iPhone Duo。', test: (s) => s.projects.duo },
  { id: 'bite1', name: '偷吃', hint: '有人听了蛇的话。', desc: '咬下了禁果的第一口。', test: (s) => s.bites >= 1 },
  { id: 'bite3', name: '原罪', hint: '三口,一口都不少。', desc: '禁果咬满三口。', test: (s) => s.bites >= 3 },
  { id: 'garage', name: '车库传奇', hint: '一间小车库里,有人饿着肚子想事。', desc: '车库里的怪人。', test: (s) => s.projects.garage },
  { id: 'doctor', name: '医生走远了', hint: '每天一个,就不用去医院。', desc: '每天一苹果。', test: (s) => s.projects.doctor },
  { id: 'witch', name: '沉睡的公主', hint: '红的一半有毒。', desc: '咬了女巫的苹果,睡了一觉。', test: (s) => s.witchUsed },
  { id: 'onemore', name: '还有一件事', hint: '发布会结束之前……', desc: 'One more thing。', test: (s) => s.projects.onemore },
  { id: 'million', name: '百万富翁', hint: '送出一百万个。', desc: '累计送出 100 万。', test: (s) => s.delivered >= 1e6 },
  { id: 'billion', name: '十亿分之一', hint: '送出十亿个。', desc: '累计送出 10 亿。', test: (s) => s.delivered >= 1e9 },
  { id: 'win', name: '平安夜', hint: '把苹果送到每一个人手里。', desc: `累计送出 ${GOAL / 1e8} 亿平安果。`, test: (s) => s.delivered >= GOAL },
];

/** 检查并写入新解锁的成就,返回新解锁的列表 */
export function checkAchievements(s: State, now: number): AchDef[] {
  const out: AchDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!s.achievements[a.id] && a.test(s)) {
      s.achievements[a.id] = now;
      out.push(a);
    }
  }
  return out;
}
