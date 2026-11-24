// 老徐行为状态机。纯函数,无 DOM / 无随机源(rnd 注入)。
//
// 状态:work(干活,出工系数 1)/ slack(偷懒,6–7 级,系数 0,结束后"精神焕发":下一次摇树暴击 ×3)
//       nap(夜里或玩家 ≥90s 没操作时打盹,系数 napMul)/ watch(有访客/流星/订单时看热闹,系数 watchMul)。
// 优先级:watch > nap > slack > work。等级 0 恒为 work(没请老徐,不输出)。
// 用法:每帧 stepLaoxu(sys.laoxu, dt, rnd, ctx) → s.helperAct = r.act;摇树时 takeCrit(st) 取倍数。
import { LAOXU } from './constants.ts';
import { range, type Rnd } from './util.ts';

export type LaoxuMode = 'work' | 'slack' | 'nap' | 'watch';

export interface LaoxuState {
  /** 最近一次 stepLaoxu 看到的等级(给 laoxuView 用,不存档) */
  lv: number;
  mode: LaoxuMode;
  /** 在当前状态里待了多久(秒) */
  t: number;
  /** 当前状态预计持续(秒;slack 用,其余 0) */
  dur: number;
  /** 干活累计(秒),到 nextSlack 就偷懒 */
  workT: number;
  nextSlack: number;
  /** 精神焕发剩余有效秒数(>0 = 下一次摇树暴击) */
  critT: number;
  /** 被叫醒后的打盹冷却(秒) */
  wakeCool: number;
  /** 累计偷懒次数 / 暴击次数 / 被点次数 / 气泡水次数(统计用) */
  slacks: number;
  crits: number;
  taps: number;
  sodas: number;
}

export const newLaoxu = (): LaoxuState => ({
  lv: 0, mode: 'work', t: 0, dur: 0, workT: 0, nextSlack: LAOXU.slackEveryS[0], critT: 0, wakeCool: 0, slacks: 0, crits: 0, taps: 0, sodas: 0,
});

export function normalizeLaoxu(raw: unknown): LaoxuState {
  const s = newLaoxu();
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Partial<LaoxuState>;
  const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  // 读档:状态一律回到 work(不存瞬时姿态),只保留统计与精神焕发
  s.workT = Math.max(0, n(r.workT, 0));
  s.nextSlack = Math.max(1, n(r.nextSlack, s.nextSlack));
  s.critT = Math.max(0, Math.min(LAOXU.critWindowS, n(r.critT, 0)));
  for (const k of ['slacks', 'crits', 'taps', 'sodas'] as const) s[k] = Math.max(0, Math.floor(n(r[k], 0)));
  return s;
}

export interface LaoxuCtx {
  /** 老徐等级 0..8 */
  level: number;
  /** 玩家多久没操作(秒) */
  idleSec: number;
  /** 夜里 */
  night: boolean;
  /** 有访客/流星/订单出现(任一) */
  visitor: boolean;
}

export type LaoxuEvent =
  | { t: 'mode'; from: LaoxuMode; to: LaoxuMode }
  | { t: 'crit-ready' }
  | { t: 'crit-lost' };

export interface LaoxuStep {
  /** 出工系数 0..1,写进 state.helperAct */
  act: number;
  events: LaoxuEvent[];
}

export const canSlack = (lv: number): boolean => lv >= LAOXU.slackFromLv && lv <= LAOXU.slackToLv;
export const canNap = (lv: number): boolean => lv >= LAOXU.slackFromLv;

const ACT: Record<LaoxuMode, number> = { work: 1, slack: 0, nap: LAOXU.napMul, watch: LAOXU.watchMul };
export const laoxuAct = (st: LaoxuState): number => ACT[st.mode];

function go(st: LaoxuState, to: LaoxuMode, ev: LaoxuEvent[]): void {
  if (st.mode === to) return;
  ev.push({ t: 'mode', from: st.mode, to });
  st.mode = to;
  st.t = 0;
  st.dur = 0;
}

/** 推进 dt 秒(dt>5 视为离线/切后台:状态复位为 work,不结算偷懒) */
export function stepLaoxu(st: LaoxuState, dt: number, rnd: Rnd, ctx: LaoxuCtx): LaoxuStep {
  const ev: LaoxuEvent[] = [];
  st.lv = ctx.level;
  if (!(dt > 0)) return { act: laoxuAct(st), events: ev };
  if (ctx.level <= 0) {
    go(st, 'work', ev);
    st.critT = 0;
    return { act: 1, events: ev };
  }
  if (dt > 5) {
    go(st, 'work', ev);
    st.workT = 0;
    st.critT = 0;
    return { act: 1, events: ev };
  }
  st.t += dt;
  if (st.wakeCool > 0) st.wakeCool = Math.max(0, st.wakeCool - dt);
  if (st.critT > 0) {
    st.critT -= dt;
    if (st.critT <= 0) {
      st.critT = 0;
      ev.push({ t: 'crit-lost' });
    }
  }

  const wantNap = canNap(ctx.level) && st.wakeCool <= 0 && (ctx.night || ctx.idleSec >= LAOXU.napIdleS);
  if (ctx.visitor && ctx.level >= 1) {
    if (st.mode !== 'watch') go(st, 'watch', ev);
    else st.t = 0; // 访客还在,继续看
  } else if (st.mode === 'watch' && st.t < LAOXU.watchMinS) {
    // 至少看一会儿
  } else if (wantNap) {
    go(st, 'nap', ev);
  } else if (st.mode === 'nap' || st.mode === 'watch') {
    go(st, 'work', ev);
  } else if (st.mode === 'slack') {
    if (st.t >= st.dur) {
      go(st, 'work', ev);
      st.workT = 0;
      st.nextSlack = range(LAOXU.slackEveryS, rnd);
      st.critT = LAOXU.critWindowS;
      ev.push({ t: 'crit-ready' });
    }
  } else {
    // work
    st.workT += dt;
    if (canSlack(ctx.level) && st.workT >= st.nextSlack) {
      go(st, 'slack', ev);
      st.dur = range(LAOXU.slackS, rnd);
      st.slacks++;
    }
  }
  // 掉级(不会发生,保险):不会偷懒的等级不应处于 slack
  if (st.mode === 'slack' && !canSlack(ctx.level)) go(st, 'work', ev);
  return { act: laoxuAct(st), events: ev };
}

/** 摇树时取暴击倍数:有"精神焕发"返回 critMul 并消耗,否则 1 */
export function takeCrit(st: LaoxuState): number {
  if (st.critT <= 0) return 1;
  st.critT = 0;
  st.crits++;
  return LAOXU.critMul;
}

export type LaoxuTap =
  | { r: 'wake'; rewardS: number } // 偷懒被催醒 / 打盹被叫醒
  | { r: 'soda'; rewardS: number } // 偷懒时拿到一瓶气泡水(小奖励,收入秒)
  | { r: 'none' };

/**
 * 玩家点老徐(彩蛋 laoxu-spray/qc/bubble 走 eggs.ts,与此独立)。
 * slack:sodaP 概率得气泡水(仍继续偷懒,时间缩短),否则催醒(无精神焕发);nap:叫醒,wakeCool 内不再打盹;work/watch:none。
 */
export function tapLaoxu(st: LaoxuState, rnd: Rnd): LaoxuTap {
  st.taps++;
  if (st.mode === 'slack') {
    if (rnd() < LAOXU.sodaP) {
      st.sodas++;
      st.dur = Math.min(st.dur, st.t + 2);
      return { r: 'soda', rewardS: LAOXU.sodaIncomeS };
    }
    st.mode = 'work';
    st.t = 0;
    st.dur = 0;
    st.workT = 0;
    st.nextSlack = range(LAOXU.slackEveryS, rnd);
    return { r: 'wake', rewardS: 0 };
  }
  if (st.mode === 'nap') {
    st.mode = 'work';
    st.t = 0;
    st.wakeCool = LAOXU.wakeCoolS;
    return { r: 'wake', rewardS: LAOXU.wakeIncomeS };
  }
  return { r: 'none' };
}

export interface LaoxuView {
  lv: number;
  state: LaoxuMode;
  /** 在当前状态里待了几秒 */
  t: number;
  /** 精神焕发中(下一次摇树暴击) */
  crit: boolean;
}

export const laoxuView = (st: LaoxuState): LaoxuView => ({ lv: st.lv, state: st.mode, t: st.t, crit: st.critT > 0 });
