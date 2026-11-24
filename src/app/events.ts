// 提示与事件:瓶颈提示、环境小话、苹果日报、小鸟/牛顿/流星。
import { claimEvent, nextEventGap, pickEvent, type EventKind } from '../core/events.ts';
import { AMBIENT_TEXT, BOTTLENECK_TIP, EVENT_TEXT, NEWTON_STAGES } from '../core/copy.ts';
import { worldAt } from '../core/world.ts';
import type { Throughput } from '../core/game.ts';
import { bus } from '../core/bus.ts';
import { fmt } from '../ui/format.ts';
import { app, hooks } from './ctx.ts';
import { toast, toastIdle } from './toasts.ts';
import { bp } from './dialogs.ts';
import { EGG_CHAR_FLOATS } from '../content/eggs.ts';
import { persist } from './session.ts';
import { birdAppearText, onBirdHit, onBirdMiss } from './chars.ts';

/** 换档/重开后重置计时 */
export function resetTips(playSec: number, gap: number): void {
  bnKind = 'balanced';
  bnSince = playSec;
  bnTipAt = playSec;
  nextEventAt = playSec + gap;
}

// ───────────── 提示:瓶颈 / 空槽 ─────────────
let bnKind: Throughput['bottleneck'] = 'balanced';
let bnSince = 0;
let bnTipAt = -1e9;
export function bottleneckTip(th: Throughput): void {
  const t = app.state.playSec;
  if (th.bottleneck !== bnKind) {
    bnKind = th.bottleneck;
    bnSince = t;
    return;
  }
  if (bnKind === 'balanced' || app.state.delivered < 20) return;
  if (t - bnSince >= 20 && t - bnTipAt >= 90 && toastIdle() && bp.hidden) {
    bnTipAt = t;
    toast(BOTTLENECK_TIP[bnKind], 4200);
  }
}

// ───────────── 环境小话(40–70 秒飘一句)(苹果日报已移到顶栏下的滚动条,见 ticker.ts) ─────────────
let nextAmbient = performance.now() + 30000;
let ambI = Math.floor(Math.random() * AMBIENT_TEXT.length);
export function ambient(): void {
  if (document.hidden || app.DEBUG && app.speed > 60) return;
  const now = performance.now();
  if (now >= nextAmbient && !app.orchard.eventActive()) {
    nextAmbient = now + 40000 + Math.random() * 30000;
    app.orchard.floatText(AMBIENT_TEXT[ambI++ % AMBIENT_TEXT.length]);
  }
}

// ───────────── 事件(小鸟 / 牛顿 / 流星) ─────────────
let nextEventAt = 0;
let lastEventKind: EventKind | null = null;
export function maybeEvent(): void {
  if (app.state.playSec < nextEventAt || app.orchard.eventActive() || document.hidden || !bp.hidden) return;
  nextEventAt = app.state.playSec + nextEventGap();
  const kind: EventKind = pickEvent(worldAt(app.state.playSec).isNight, Math.random, lastEventKind);
  lastEventKind = kind;
  startEvent(kind);
}

/** 立刻开一个事件(调试/QA 用 forceEvent;正常由 maybeEvent 排期) */
export function forceEvent(kind: EventKind): void {
  if (!app.orchard.eventActive()) startEvent(kind);
}

function startEvent(kind: EventKind): void {
  app.orchard.spawnEvent(kind, (hit) => {
    if (kind === 'bird') {
      // 小鸟奖励只此一处:birdHit(6 秒产量)。点中 → onBirdHit;飞走时没点 → onBirdMiss(啄走少量库存)
      if (hit) onBirdHit();
      else onBirdMiss();
      return;
    }
    if (!hit) {
      bus.emit({ t: 'event', kind, phase: 'miss' });
      return;
    }
    const r = claimEvent(app.state, kind);
    bus.emit({ t: 'event', kind, phase: 'hit' });
    bus.emit({ t: 'gold', kind, apples: r.apples });
    app.audio.sfx.golden();
    app.orchard.floatText(r.apples > 0 ? `+${fmt(r.apples)}` : '灵感!');
    if (kind === 'newton') {
      // 牛顿停留的三段台词,按进入后的秒数排开
      app.orchard.floatText(EGG_CHAR_FLOATS.newton?.reaction ?? '灵感!', undefined, undefined);
      for (const st of NEWTON_STAGES) setTimeout(() => toast(st.text, 3200), st.at * 1000);
    } else toast(EVENT_TEXT[kind].claim, 3600);
    persist();
    hooks.render();
  });
  bus.emit({ t: 'event', kind, phase: 'appear' });
  toast(kind === 'bird' ? birdAppearText() : EVENT_TEXT[kind].appear, 2800);
}
