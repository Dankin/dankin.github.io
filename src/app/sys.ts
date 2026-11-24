// 玩法系统桥(app 层):把 src/core/sys 的纯函数接到游戏循环、总线、音频和画面。
// - sysFrame(dt)  每帧推进 tickSys(订单/害虫/烂果/小篮子),并处理它吐出的事件
// - rollShake(r)  每次有效摇树抽一个苹果(品种/状态),落在树下,并发 'apple' 事件
// - emitSys(ev)   把游戏事件交给彩蛋/成就判定;命中就发 bus 'egg' / 'ach'、发奖、弹提示、插队新闻
// - 玩家动作:claimOrderAct / tapPestAct / cleanRotAct / offerAct
import { bus } from '../core/bus.ts';
import { GOAL } from '../core/constants.ts';
import { appleValue, era, eraMin, mods, stockFill, throughput, type ShakeResult, type Throughput } from '../core/game.ts';
import { EGG_BY_ID, EGG_TEXT, SYS_EGG_ID_MAP } from '../content/eggs.ts';
import { ACH_TEXT } from '../content/achievements.ts';
import { NEWS_ITEMS } from '../content/news.ts';
import { cleanRotSys, claimOrder, nextNews, offerSys, onEvent, onShakeRoll, snapshotOf, tapPestSys, tickSys, type SnapHost } from '../core/sys/state.ts';
import type { EggEvent } from '../core/sys/types.ts';
import type { EventKind } from '../core/events.ts';
import { getGoal } from './bar.ts';
import { app } from './ctx.ts';
import { pushNews, setNewsSource } from './ticker.ts';
import { toast } from './toasts.ts';
import { fmt } from '../ui/format.ts';

const rnd = Math.random;

// ───── 帧外上下文(玩家活动时间、最近升档、屏幕上的事件) ─────
let lastActAt = performance.now();
let sessionAt = performance.now();
let lastTierPlaySec = -1;
let lastTierLine: 'source' | 'route' | undefined;
let lastEventClaimPlaySec = -1e9;
let eventOnScreen: EventKind | null = null;
let goldAppearAt = -1;
let th: Throughput | null = null;
let timeAcc = 0;
let idleSent = 0;

/** render 每 0.25 秒告知最新吞吐(sysFrame 不用每帧重算) */
export function feedSys(t: Throughput): void {
  th = t;
}
const nowTh = (): Throughput => th ?? (th = throughput(app.state));
/** 玩家做了一次操作(重置"闲置"计时) */
export function markActive(): void {
  lastActAt = performance.now();
  idleSent = 0;
}

function hostSnap(): ReturnType<typeof snapshotOf> {
  const s = app.state;
  const t = nowTh();
  const host: SnapHost = {
    nowMs: Date.now(),
    playSec: s.playSec,
    delivered: s.delivered,
    progress: Math.min(1, s.delivered / GOAL),
    sourceTier: s.source.tier,
    routeTier: s.route.tier,
    units: s.source.units.reduce((a, b) => a + b, 0) + s.route.units.reduce((a, b) => a + b, 0),
    shakes: s.shakes,
    helpers: s.helpers,
    combo: s.combo,
    coins: s.coins,
    income: t.income,
    targetCost: getGoal()?.cost ?? 0,
    stockFill: stockFill(s),
    wasted: s.wasted,
    idleSec: (performance.now() - lastActAt) / 1000,
    sinceTierSec: lastTierPlaySec < 0 ? s.playSec : s.playSec - lastTierPlaySec,
    ...(lastTierLine ? { lastTierLine } : {}),
    bottleneck: t.bottleneck,
    eventOnScreen,
    eventsOnScreen: eventOnScreen ? 1 : 0,
    sessionSec: (performance.now() - sessionAt) / 1000,
    sinceEventSec: s.playSec - lastEventClaimPlaySec,
  };
  return snapshotOf(s.sys, host);
}
/** 给外部(面板、调试)用:当前快照 */
export const snapNow = hostSnap;

// ───── 事件 → 彩蛋/成就 ─────
export function emitSys(ev: EggEvent): void {
  if (app.readOnly) return;
  const s = app.state;
  const snap = hostSnap();
  const r = onEvent(s.sys, snap, ev, rnd);
  for (const e of r.eggs) {
    const cid = SYS_EGG_ID_MAP[e.id] ?? e.id;
    const txt = EGG_TEXT[e.id];
    bus.emit({ t: 'egg', id: e.id, first: e.first });
    if (e.first) {
      payEgg(cid);
      if (txt) {
        toast(`${txt.title}:${txt.text}`, 5200);
        pushNews(txt.text);
      }
      app.audio.sfx.play('egg');
    }
  }
  for (const id of r.ach) {
    bus.emit({ t: 'ach', id });
    const a = ACH_TEXT[id];
    if (a) toast(`成就「${a.title}」${a.text}`, 4200);
    app.audio.sfx.play('eggAch');
  }
}

/** 彩蛋奖励:apples=按"秒数×当前收入"给手上苹果;gold/badge/cosmetic 目前记账由面板展示 */
function payEgg(contentId: string): void {
  const reward = EGG_BY_ID[contentId]?.reward;
  if (!reward) return;
  if (reward.kind === 'apples' && reward.amount) {
    const gain = reward.amount * Math.max(1, nowTh().income);
    app.state.coins += gain;
    app.orchard.floatText(`+${fmt(gain)}`);
  }
}

// ───── 摇树:抽苹果 ─────
type DropOrchard = { dropApple?: (kind: string, state: string, golden?: boolean) => void };
export function rollShake(r: ShakeResult, force?: 'kent'): void {
  if (!r.ok) return;
  markActive();
  const s = app.state;
  const a = onShakeRoll(s.sys, { playSec: s.playSec, era: eraMin(s) }, rnd, force);
  // 价值乘数期望为 1:偏离部分按一次摇的产量折算成手上苹果(毒苹果 value=0 会倒扣,但不低于 0)
  if (r.dropped > 0 && a.value !== 1) {
    const base = r.dropped * appleValue(s, mods(s));
    s.coins = Math.max(0, s.coins + base * (a.value - 1));
  }
  (app.orchard as unknown as DropOrchard).dropApple?.(a.kind, a.state, a.kind === 'golden');
  bus.emit({ t: 'apple', kind: a.kind, state: a.state, value: a.value });
  if (a.kind === 'poison') app.audio.sfx.play('spoil');
  else if (a.value >= 3) app.audio.sfx.play('rareApple');
  emitSys({ t: 'shake', combo: r.combo, apple: { kind: a.kind, state: a.state } });
}

// ───── 每帧 ─────
export function sysFrame(dt: number): void {
  if (app.readOnly || dt <= 0) return;
  const s = app.state;
  const t = nowTh();
  const tk = tickSys(
    s.sys,
    dt,
    {
      playSec: s.playSec,
      era: eraMin(s),
      sourceTier: s.source.tier,
      routeTier: s.route.tier,
      coins: s.coins,
      income: t.income,
      targetCost: getGoal()?.cost ?? 0,
      coldStorage: s.gates.includes('cold'),
      progress: Math.min(1, s.delivered / GOAL),
    },
    rnd,
  );
  if (tk.coinsLoss > 0) s.coins = Math.max(0, s.coins - tk.coinsLoss);
  for (const e of tk.events) {
    switch (e.t) {
      case 'order-new':
        bus.emit({ t: 'order', phase: 'new', id: e.order.id });
        app.audio.sfx.play('modal');
        break;
      case 'order-expire':
        bus.emit({ t: 'order', phase: 'expire', id: e.id });
        break;
      case 'pest-wave':
        bus.emit({ t: 'pest', phase: 'wave', n: e.n });
        break;
      case 'pest-bite':
        bus.emit({ t: 'pest', phase: 'bite', id: e.id, lost: e.lost });
        app.audio.sfx.play('bite');
        break;
      case 'rot':
        bus.emit({ t: 'rot', phase: 'spawn', n: e.spawned });
        app.audio.sfx.play('spoil');
        break;
      case 'bag':
        break;
    }
  }
  // 1Hz 心跳 + 闲置
  timeAcc += dt;
  if (timeAcc >= 1) {
    timeAcc = 0;
    emitSys({ t: 'time' });
    const idle = (performance.now() - lastActAt) / 1000;
    if (idle >= 30 && idle - idleSent >= 30) {
      idleSent = idle;
      emitSys({ t: 'idle', sec: idle });
    }
  }
}

// ───── 玩家动作 ─────
export function claimOrderAct(id: number): { ok: boolean; reward: number } {
  markActive();
  const r = claimOrder(app.state.sys, id, nowTh().income);
  if (r.ok) {
    app.state.coins += r.reward;
    bus.emit({ t: 'order', phase: 'done', id, reward: r.reward });
    app.audio.sfx.play('orderDone');
    app.orchard.floatText(`+${fmt(r.reward)}`);
    emitSys({ t: 'buy', what: 'order' });
  }
  return r;
}
export function tapPestAct(id: number): void {
  markActive();
  const r = tapPestSys(app.state.sys, id, nowTh().income);
  if (r.r === 'kill') {
    app.state.coins += r.reward;
    bus.emit({ t: 'pest', phase: 'kill', id, reward: r.reward });
    app.audio.sfx.play('bugSquash');
    if (r.reward > 0) app.orchard.floatText(`+${fmt(r.reward)}`);
  } else if (r.r === 'hit') app.audio.sfx.play('bonk');
}
export function cleanRotAct(): number {
  markActive();
  const n = cleanRotSys(app.state.sys);
  if (n > 0) {
    bus.emit({ t: 'rot', phase: 'clean', n });
    emitSys({ t: 'rot', cleaned: n });
    app.audio.sfx.play('coin');
  }
  return n;
}
/** 献果:W = 想献的手上苹果数。返回 null = 献果还没开放 */
export function offerAct(W: number): { spent: number; apples: number } | null {
  markActive();
  const s = app.state;
  const o = offerSys(s.sys, { sourceTier: s.source.tier, routeTier: s.route.tier }, W, s.coins, nowTh().value);
  if (!o) return null;
  s.coins -= o.spent;
  s.delivered += o.apples;
  bus.emit({ t: 'offer', spent: o.spent, apples: o.apples });
  emitSys({ t: 'buy', what: 'offer' });
  return o;
}
/** 点了一个场景热点 */
export function tapTargetAct(target: string): void {
  markActive();
  bus.emit({ t: 'tap', target });
  emitSys({ t: 'tap', target: target as never, at: app.state.playSec });
}

// ───── 离线 / 登录 ─────
export function sysAway(ms: number): void {
  sessionAt = performance.now();
  bus.emit({ t: 'login', away: ms });
  emitSys({ t: 'login' });
  if (ms > 0) emitSys({ t: 'away', ms });
}

// ───── 初始化:订阅总线,把游戏事件翻译成 EggEvent;新闻源接 nextNews ─────
export function initSys(): void {
  bus.on('buy', (e) => {
    markActive();
    emitSys({ t: 'buy', what: e.what, ...(e.line ? { line: e.line } : {}) });
  });
  bus.on('tier', (e) => {
    markActive();
    lastTierPlaySec = app.state.playSec;
    lastTierLine = e.line;
    emitSys({ t: 'tier', line: e.line, tier: e.tier, branch: String(e.branch) });
  });
  bus.on('event', (e) => {
    if (e.phase === 'appear') {
      eventOnScreen = e.kind;
      goldAppearAt = app.state.playSec;
      emitSys({ t: 'gold', kind: 'appear', at: app.state.playSec });
    } else {
      eventOnScreen = null;
      if (e.phase === 'hit') {
        lastEventClaimPlaySec = app.state.playSec;
        markActive();
        emitSys({ t: 'gold', kind: 'tap', at: app.state.playSec, since: goldAppearAt < 0 ? 0 : app.state.playSec - goldAppearAt });
      }
      emitSys({ t: 'event', kind: e.kind, claimed: e.phase === 'hit' });
    }
  });
  bus.on('win', () => emitSys({ t: 'win' }));
  // 新闻:sys 的条件库(标签更准:天气/季节/订单/害虫/里程碑…);选不出来回退到 app 层 pickNews 的内容库
  setNewsSource((c) => {
    let it = null;
    try {
      it = nextNews(c.state.sys, hostSnap(), NEWS_ITEMS, rnd);
    } catch {
      it = null;
    }
    if (!it) return null;
    bus.emit({ t: 'news', text: it.text, id: it.id });
    return it.text;
  });
  document.addEventListener('pointerdown', markActive, { capture: true, passive: true });
  document.addEventListener('keydown', markActive, { capture: true, passive: true });
}

/** 调试/截图:当前世界 era(与 core/game.era 一致,给面板用) */
export const eraNow = (): number => era(app.state);
