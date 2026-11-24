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

/** 底栏卡位:产出线买卡 / 产出线升档 / 运输线买卡 / 运输线升档 */
export type PinSlot = 'srcBuy' | 'srcUp' | 'rtBuy' | 'rtUp';
export const PIN_SLOTS: readonly PinSlot[] = ['srcBuy', 'srcUp', 'rtBuy', 'rtUp'];

export interface Line {
  /** 当前最高档 0..5 */
  tier: number;
  /** units[t] = 第 t 档已有数量(产出线是树/果园…,运输线是篮子/推车…) */
  units: number[];
  /** branch[t] = 升到第 t 档时选的分支 0/1;第 0 档恒为 -1 */
  branch: (0 | 1 | -1)[];
  /** ext[t] = 第 t 档已买的"扩建"次数 0..3(单位数到 5/15/30 各能买一次,该档产出/运力 ×1.5) */
  ext: number[];
}

export interface State {
  version: number;
  /**
   * 玩家"手上的苹果":买东西用。界面叫"手上苹果",代码里沿用 coins(数值与 v3 完全一致,sim 零影响)。
   * 账本:每送达一个苹果 coins += 它的价值(appleValue);每次购买 coins -= 价格、spent += 价格。
   * 所以 "累计赚到的手上苹果" = coins + spent。
   */
  coins: number;
  /** 累计花掉的手上苹果(只增,买单位/扩建/升档/老徐都计入;关卡道具免费不计)。v4 新增 */
  spent: number;
  /**
   * 累计送达("已送出",进度条,82 亿):得分,只增,与花费无关,不会因购买减少。
   * 和 coins 的区别:delivered 数的是个数,coins 数的是个数×单价(单价随道具/档位变)。
   */
  delivered: number;
  /** 钉住的目标卡(底栏 4 张卡之一);没有钉住为 null。只影响提示,不影响数值。v4 新增 */
  pin: PinSlot | null;
  /** 累计点按/摇树次数(含没算上的) */
  shakes: number;
  /** 本局已玩秒数(游戏内时钟,所有计时器用它) */
  playSec: number;
  source: Line;
  route: Line;
  /** 3 个道具槽 */
  gates: (GateId | null)[];
  gatesUnlocked: GateId[];
  /** 堆场库存 */
  stock: number;
  /** 摇劲 0..1(摇树蓄的力,临时提高产出,不摇会衰减) */
  charge: number;
  /** 连摇数(连续有效摇树,间隔 ≤ SHAKE.comboWindow) */
  combo: number;
  /** 连摇剩余秒数,到 0 清零 */
  comboT: number;
  /** 摇树令牌(限速:每秒 SHAKE.maxRate 次,最多存 SHAKE.burst) */
  shakeTok: number;
  /** 近期摇树频率(次/秒,约 2 秒滑动平均):吞吐估算要把手摇算进去 */
  shakeRate: number;
  /** 雇了几位老徐(自动摇树) */
  helpers: number;
  vehicles: Vehicle[];
  /** 累计浪费(堆场满了溢出)的苹果 */
  wasted: number;
  /** 牛顿路过:playSec 到这之前摇树掉落与摇劲 ×2 */
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
  return { tier: 0, units: Array(TIER_COUNT).fill(0).map((_, i) => (i === 0 ? 1 : 0)), branch: Array(TIER_COUNT).fill(-1) as (0 | 1 | -1)[], ext: Array(TIER_COUNT).fill(0) };
}

export function newState(now: number): State {
  return {
    version: SAVE_VERSION,
    coins: 0,
    spent: 0,
    delivered: 0,
    pin: null,
    shakes: 0,
    playSec: 0,
    source: newLine(),
    route: newLine(),
    gates: Array(GATE_SLOTS).fill(null) as (GateId | null)[],
    gatesUnlocked: ['wash', 'wax', 'rush'],
    stock: 0,
    charge: 0,
    combo: 0,
    comboT: 0,
    shakeTok: 3,
    shakeRate: 0,
    helpers: 0,
    vehicles: [{ tier: 0, w: 1, phase: 0, load: 0 }],
    wasted: 0,
    newtonUntil: 0,
    wonAt: null,
    tierTimes: { source: [], route: [] },
    lastSeen: now,
    startedAt: now,
    settings: { sound: false, reducedMotion: false, dark: 'auto' },
  };
}
