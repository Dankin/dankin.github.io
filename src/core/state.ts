import { SAVE_VERSION } from './constants.ts';
import type { GateId } from './content.ts';
import { GATE_SLOTS, TIER_COUNT } from './content.ts';

/** 一个"车"。n > 24 时多辆车合并成一个车队,w 是它代表几辆。 */
export interface Vehicle {
  /** 运输档 0..5 */
  tier: number;
  /** 代表几辆车(≥1) */
  w: number;
  /**
   * 往返进度 0..1:0 = 停在堆场装货;0..0.5 去终点(装满的);0.5 = 到达并结算;0.5..1 空车返回。
   * 画面:位置 = 路线上 phase<0.5 ? phase×2 : (1-phase)×2。
   */
  phase: number;
  /** 已装苹果数(绝对数量)。装满 = w × cap × 当前容量乘数 */
  load: number;
}

export interface Line {
  /** 当前最高档 0..5 */
  tier: number;
  /** units[t] = 第 t 档已有数量(产出线是树/果园…,运输线是篮子/推车…) */
  units: number[];
  /** branch[t] = 升到第 t 档时选的分支 0/1;第 0 档恒为 -1 */
  branch: (0 | 1 | -1)[];
}

export interface State {
  version: number;
  /** 果钱:买东西用 */
  coins: number;
  /** 累计送达(进度条,82 亿) */
  delivered: number;
  clicks: number;
  /** 累计画圈圈数(crank 的 amount 之和) */
  turns: number;
  /** 本局已玩秒数(游戏内时钟,所有计时器用它) */
  playSec: number;
  source: Line;
  route: Line;
  /** 3 个道具槽 */
  gates: (GateId | null)[];
  gatesUnlocked: GateId[];
  /** 堆场库存 */
  stock: number;
  /** 飞轮储能 0..1 */
  flywheel: number;
  /** 连击数(嗖!) */
  combo: number;
  /** 连击剩余秒数,到 0 清零 */
  comboT: number;
  vehicles: Vehicle[];
  /** 累计浪费(堆场满了溢出)的苹果 */
  wasted: number;
  /** 累计"飞出去"次数 */
  flings: number;
  /** 牛顿路过:playSec 到这之前手动储能 ×2 */
  newtonUntil: number;
  /** 通关时的 playSec;未通关 null */
  wonAt: number | null;
  /** 各次升档时的 playSec,[0]=产出线,[1]=运输线,各 5 项(用于结局回顾) */
  tierTimes: { source: number[]; route: number[] };
  lastSeen: number;
  startedAt: number;
  settings: { sound: boolean; reducedMotion: boolean; dark: 'auto' | 'light' | 'dark' };
}

export function newLine(): Line {
  return { tier: 0, units: Array(TIER_COUNT).fill(0).map((_, i) => (i === 0 ? 1 : 0)), branch: Array(TIER_COUNT).fill(-1) as (0 | 1 | -1)[] };
}

export function newState(now: number): State {
  return {
    version: SAVE_VERSION,
    coins: 0,
    delivered: 0,
    clicks: 0,
    turns: 0,
    playSec: 0,
    source: newLine(),
    route: newLine(),
    gates: Array(GATE_SLOTS).fill(null) as (GateId | null)[],
    gatesUnlocked: ['wash', 'wax', 'rush'],
    stock: 0,
    flywheel: 0,
    combo: 0,
    comboT: 0,
    vehicles: [{ tier: 0, w: 1, phase: 0, load: 0 }],
    wasted: 0,
    flings: 0,
    newtonUntil: 0,
    wonAt: null,
    tierTimes: { source: [], route: [] },
    lastSeen: now,
    startedAt: now,
    settings: { sound: false, reducedMotion: false, dark: 'auto' },
  };
}
