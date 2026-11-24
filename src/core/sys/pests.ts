// 虫眼(轻塔防):虫子从两侧爬向树,点击消灭。不点最多咬走少量堆场库存,不会致命。
import { PEST } from './constants.ts';
import { pickIndex, range, type Rnd } from './util.ts';

export type PestKind = 'ant' | 'beetle' | 'caterpillar';

export interface Pest {
  id: number;
  kind: PestKind;
  /** -1 左侧 / 1 右侧 */
  side: -1 | 1;
  /** 到树的距离 1(屏幕边缘)→ 0(树) */
  pos: number;
  hp: number;
  /** 出场时刻(playSec),未到时不显示 */
  at: number;
}

export interface PestsState {
  list: Pest[];
  /** 下一波出现时刻(playSec) */
  nextAt: number;
  seq: number;
  /** 累计消灭 */
  killed: number;
  /** 累计被咬次数 */
  bitten: number;
  /** 累计损失的堆场苹果 */
  lost: number;
  /** 本波已损失(封顶用) */
  waveLost: number;
}

export const newPests = (): PestsState => ({ list: [], nextAt: PEST.unlockSec, seq: 0, killed: 0, bitten: 0, lost: 0, waveLost: 0 });

export interface PestCtx {
  playSec: number;
  era: number;
  /** season.pest:出现频率倍数,波间隔除以它 */
  rate: number;
  /** 当前堆场苹果数(咬一口按比例扣) */
  stock: number;
}

export type PestEvent =
  | { t: 'wave'; n: number }
  | { t: 'bite'; id: number; lost: number }
  | { t: 'kill'; id: number };

function kindsFor(era: number): PestKind[] {
  return (['ant', 'caterpillar', 'beetle'] as PestKind[]).filter((k) => PEST.minEra[k] <= era);
}

function spawnWave(ps: PestsState, c: PestCtx, rnd: Rnd): number {
  const n = Math.min(PEST.maxWave, 1 + Math.floor(c.era * PEST.perEra));
  const kinds = kindsFor(c.era);
  const side = (rnd() < 0.5 ? -1 : 1) as -1 | 1;
  for (let i = 0; i < n; i++) {
    const kind = kinds[pickIndex(kinds.map((k) => (k === 'ant' ? 3 : 1)), rnd)];
    ps.list.push({
      id: ++ps.seq,
      kind,
      side: rnd() < 0.7 ? side : ((-side) as -1 | 1),
      pos: 1,
      hp: PEST.hp[kind],
      at: c.playSec + i * PEST.staggerS,
    });
  }
  ps.waveLost = 0;
  return n;
}

/** 推进 dt 秒(dt 很大 = 离线结算:清空虫群,不咬)。返回本步事件。 */
export function tickPests(ps: PestsState, dt: number, c: PestCtx, rnd: Rnd): PestEvent[] {
  const ev: PestEvent[] = [];
  if (dt > 5) {
    ps.list = [];
    if (c.playSec >= ps.nextAt) ps.nextAt = c.playSec + range(PEST.gapS, rnd);
    return ev;
  }
  if (c.playSec < PEST.unlockSec) return ev;
  if (c.playSec >= ps.nextAt) {
    ev.push({ t: 'wave', n: spawnWave(ps, c, rnd) });
    ps.nextAt = c.playSec + range(PEST.gapS, rnd) / Math.max(0.2, c.rate);
  }
  const keep: Pest[] = [];
  const cap = c.stock * PEST.waveCapFrac;
  for (const p of ps.list) {
    if (c.playSec < p.at) {
      keep.push(p);
      continue;
    }
    p.pos -= dt / PEST.crossS[p.kind];
    if (p.pos > 0) {
      keep.push(p);
      continue;
    }
    // 爬到树边:咬一口(从不致命:按比例、有封顶、库存空就什么也不扣)
    const bite = Math.max(0, Math.min(c.stock * PEST.biteFrac, cap - ps.waveLost));
    ps.waveLost += bite;
    ps.lost += bite;
    ps.bitten++;
    ev.push({ t: 'bite', id: p.id, lost: bite });
  }
  ps.list = keep;
  return ev;
}

/** 点击一只虫:返回是否消灭(甲虫要点两下);未命中返回 null */
export function tapPest(ps: PestsState, id: number): 'hit' | 'kill' | null {
  const i = ps.list.findIndex((p) => p.id === id);
  if (i < 0) return null;
  const p = ps.list[i];
  p.hp--;
  if (p.hp > 0) return 'hit';
  ps.list.splice(i, 1);
  ps.killed++;
  return 'kill';
}

/** 按屏幕位置(0..1 到树的距离 + 侧)找最近的可点虫,供点击命中 */
export function pestAt(ps: PestsState, playSec: number, side: -1 | 1, pos: number, tol = 0.08): Pest | null {
  let best: Pest | null = null;
  let bd = tol;
  for (const p of ps.list) {
    if (playSec < p.at || p.side !== side) continue;
    const d = Math.abs(p.pos - pos);
    if (d <= bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

/** 击杀奖励(果钱):很小 */
export const killReward = (income: number): number => Math.max(PEST.killRewardFloor, income * PEST.killRewardSec);
