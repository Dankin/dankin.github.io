// 事件总线:app 层在玩家动作/世界事件发生时 emit,彩蛋、旁白、新闻、成就订阅。
// 约定:core 的规则函数保持纯,不 import 本文件;只有 src/app/* 和订阅者(content/story/meta)用它。
import type { LineId } from './game.ts';
import type { EventKind } from './events.ts';

export type Ev =
  /** 一次有效摇树。combo = 当前连摇数 */
  | { t: 'shake'; combo: number; strength: number }
  /** 送达数变化(app 每 0.25 秒按差值发一次;n>0)。total = 累计送出 */
  | { t: 'delivered'; n: number; total: number }
  /** 花苹果买东西。what: unit=+1 单位,expand=扩建,helper=雇老徐。cost 为扣掉的"手上苹果"(coins) */
  | { t: 'buy'; line: LineId | null; what: 'unit' | 'expand' | 'helper' ; cost: number }
  /** 升档(含分支选择)。tier = 升到的新档 */
  | { t: 'tier'; line: LineId; tier: number; branch: 0 | 1 }
  /** 事件(小鸟/牛顿/流星)。appear=出现,hit=被点中领了奖,miss=没点就走了 */
  | { t: 'event'; kind: EventKind; phase: 'appear' | 'hit' | 'miss' }
  /** 事件奖励到账("金苹果"时刻)。apples=直接送达的数量(牛顿为 0) */
  | { t: 'gold'; kind: EventKind; apples: number }
  /** 彩蛋被发现(由彩蛋系统 emit,新闻/成就/图鉴订阅)。id 对应 content/eggs 的条目 */
  | { t: 'egg'; id: string; first?: boolean }
  /** 成就解锁(id 见 src/content/achievements.ts) */
  | { t: 'ach'; id: string }
  /** 摇树抽到的苹果(品种/状态;value 为价值乘数,期望 1) */
  | { t: 'apple'; kind: string; state: string; value: number }
  /** 订单:new=新订单,expire=过期,done=交付(reward=手上苹果) */
  | { t: 'order'; phase: 'new' | 'expire' | 'done'; id: number; reward?: number }
  /** 害虫:wave=来了一批,bite=咬掉 lost,kill=被拍死 */
  | { t: 'pest'; phase: 'wave' | 'bite' | 'kill'; id?: number; n?: number; lost?: number; reward?: number }
  /** 烂果:spawn=新烂了 n 个,clean=玩家清理 n 个 */
  | { t: 'rot'; phase: 'spawn' | 'clean'; n: number }
  /** 点了场景热点(tap target id,见 core/sys/types.ts TAP_TARGETS) */
  | { t: 'tap'; target: string }
  /** 献果成交 */
  | { t: 'offer'; spent: number; apples: number }
  /** 新闻条换了一条文字 */
  | { t: 'news'; text: string; id?: string }
  /** 回到游戏(启动/回前台);away>0 表示离线结算了多少毫秒 */
  | { t: 'login'; away: number }
  /** 进入新的时代档(eraMin 变大) */
  | { t: 'era'; era: number }
  /** 通关(累计送出达到目标) */
  | { t: 'win' };

export type EvType = Ev['t'];
export type EvOf<K extends EvType> = Extract<Ev, { t: K }>;
type Handler<K extends EvType> = (e: EvOf<K>) => void;
type AnyHandler = (e: Ev) => void;

export interface Bus {
  /** 订阅某一类事件。返回取消订阅函数。 */
  on<K extends EvType>(t: K, f: Handler<K>): () => void;
  /** 订阅全部事件(调试/日志/成就聚合) */
  onAny(f: AnyHandler): () => void;
  /** 发事件。同步调用订阅者;某个订阅者抛错不影响其他订阅者(错误打到 console)。 */
  emit(e: Ev): void;
  /** 清空所有订阅(测试用、换档用) */
  clear(): void;
}

export function createBus(): Bus {
  const by = new Map<EvType, Set<AnyHandler>>();
  const any = new Set<AnyHandler>();
  const call = (f: AnyHandler, e: Ev): void => {
    try {
      f(e);
    } catch (err) {
      console.error('[bus]', e.t, err);
    }
  };
  return {
    on(t, f) {
      let set = by.get(t);
      if (!set) by.set(t, (set = new Set()));
      const g = f as unknown as AnyHandler;
      set.add(g);
      return () => void set!.delete(g);
    },
    onAny(f) {
      any.add(f);
      return () => void any.delete(f);
    },
    emit(e) {
      // 拷一份再遍历:订阅者在回调里取消订阅/再订阅不影响本轮
      for (const f of [...(by.get(e.t) ?? [])]) call(f, e);
      for (const f of [...any]) call(f, e);
    },
    clear() {
      by.clear();
      any.clear();
    },
  };
}

/** 全局总线单例 */
export const bus: Bus = createBus();
