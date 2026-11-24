// 防囤:库存(果钱)超过"防囤线"的部分缓慢烂掉。
// 防囤线 = max(1.5 × 最近目标价, 300 秒收入)。冷库(gate 'cold')免疫。离线结算(大 dt)不烂。
import { DECAY } from './constants.ts';

export interface RotState {
  /** 屏幕上可点击清理的"烂果"个数(0..rotMax) */
  visual: number;
  /** 累积烂掉的占比,攒够 rotChunk 冒一个烂果 */
  acc: number;
  /** 累计烂掉的果钱 */
  total: number;
  /** 累计清理的烂果数(苹果派彩蛋/成就) */
  cleaned: number;
}

export const newRot = (): RotState => ({ visual: 0, acc: 0, total: 0, cleaned: 0 });

/** 防囤线;targetCost = 最近目标价(玩家钉住的目标,否则两线下一档/下一单位里最贵的未买项) */
export function decayLimit(targetCost: number, income: number): number {
  return Math.max(DECAY.targetMult * Math.max(0, targetCost), DECAY.incomeSec * Math.max(0, income));
}

export interface DecayResult {
  coins: number;
  rotted: number;
  /** 本步新冒出的烂果数 */
  spawned: number;
}

/** 推进 dt 秒。超出部分按指数衰减:excess *= exp(-rate·dt)。 */
export function decayStep(rot: RotState, coins: number, limit: number, dt: number, exempt = false): DecayResult {
  if (exempt || dt <= 0 || dt > DECAY.offlineAboveS || coins <= limit || limit <= 0) {
    return { coins, rotted: 0, spawned: 0 };
  }
  const excess = coins - limit;
  const keep = excess * Math.exp(-DECAY.rate * dt);
  const rotted = excess - keep;
  rot.total += rotted;
  rot.acc += rotted / limit;
  let spawned = 0;
  while (rot.acc >= DECAY.rotChunk) {
    rot.acc -= DECAY.rotChunk;
    if (rot.visual < DECAY.rotMax) {
      rot.visual++;
      spawned++;
    }
  }
  return { coins: limit + keep, rotted, spawned };
}

/** 点击清理全部烂果;返回清理个数 */
export function cleanRot(rot: RotState, n = Infinity): number {
  const k = Math.min(rot.visual, n);
  rot.visual -= k;
  rot.cleaned += k;
  return k;
}
