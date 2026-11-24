// 提示与事件:瓶颈提示、环境小话、苹果日报、小鸟/牛顿/流星。
import { claimEvent, nextEventGap, pickEvent, type EventKind } from '../core/events.ts';
import { AMBIENT_TEXT, BOTTLENECK_TIP, DAILY_NEWS, EVENT_TEXT, NEWTON_STAGES } from '../core/copy.ts';
import { worldAt } from '../core/world.ts';
import type { Throughput } from '../core/game.ts';
import { bus } from '../core/bus.ts';
import { fmt } from '../ui/format.ts';
import { app, hooks } from './ctx.ts';
import { toast, toastIdle } from './toasts.ts';
import { bp, gp } from './dialogs.ts';
import { persist } from './session.ts';

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
  if (t - bnSince >= 20 && t - bnTipAt >= 90 && toastIdle() && bp.hidden && gp.hidden) {
    bnTipAt = t;
    toast(BOTTLENECK_TIP[bnKind], 4200);
  }
}

// ───────────── 环境小话(40–70 秒飘一句)和苹果日报(每 10 分钟一句 toast) ─────────────
let nextAmbient = performance.now() + 30000;
let nextNews = performance.now() + 600000;
let ambI = Math.floor(Math.random() * AMBIENT_TEXT.length);
let newsI = Math.floor(Math.random() * DAILY_NEWS.length);
export function ambient(): void {
  if (document.hidden || app.DEBUG && app.speed > 60) return;
  const now = performance.now();
  if (now >= nextAmbient && !app.orchard.eventActive()) {
    nextAmbient = now + 40000 + Math.random() * 30000;
    app.orchard.floatText(AMBIENT_TEXT[ambI++ % AMBIENT_TEXT.length]);
  }
  if (now >= nextNews && toastIdle() && bp.hidden && gp.hidden && app.state.delivered > 0) {
    nextNews = now + 600000;
    toast(DAILY_NEWS[newsI++ % DAILY_NEWS.length], 4200);
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
  app.orchard.spawnEvent(kind, (hit) => {
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
      for (const st of NEWTON_STAGES) setTimeout(() => toast(st.text, 3200), st.at * 1000);
    } else toast(EVENT_TEXT[kind].claim, 3600);
    persist();
    hooks.render();
  });
  bus.emit({ t: 'event', kind, phase: 'appear' });
  toast(EVENT_TEXT[kind].appear, 2800);
}
