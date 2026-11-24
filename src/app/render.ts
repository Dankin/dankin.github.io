// 渲染(每 0.25 秒一次,以及操作后立即)。
import { eraMin, era, isWon, nextHints, progress, throughput } from '../core/game.ts';
import { ERA_SWITCH_TOAST } from '../core/copy.ts';
import { bus } from '../core/bus.ts';
import { app } from './ctx.ts';
import { toast, toastIdle } from './toasts.ts';
import { renderHud } from './hud.ts';
import { feedTicker } from './ticker.ts';
import { btn, getGoal, renderAct, renderFocus, renderHelper } from './bar.ts';
import { bp, fillBranch } from './dialogs.ts';
import { buildWorld } from './world.ts';
import { ambient, bottleneckTip, maybeEvent } from './events.ts';
import { renderDebugInfo } from './debug.ts';
import { win } from './session.ts';
import { feedSys } from './sys.ts';

let lastEra = -1;
let lastDelivered = -1;
let lastEraMin = -1;
export function resetRender(): void {
  lastEra = -1;
  lastEraMin = -1;
  lastDelivered = -1;
}

export function renderAll(): void {
  const s = app.state;
  const th = throughput(s);
  const hints = nextHints(s);

  // 总线:送达增量。换档/导入后第一次只记基线
  if (lastDelivered >= 0 && s.delivered > lastDelivered) bus.emit({ t: 'delivered', n: s.delivered - lastDelivered, total: s.delivered });
  lastDelivered = s.delivered;

  renderAct('source', btn.sb, btn.su, hints, th);
  renderAct('route', btn.rb, btn.ru, hints, th);
  renderFocus(th);
  renderHud(th, getGoal());
  feedTicker(th);
  feedSys(th);
  renderHelper(hints);
  if (!bp.hidden) fillBranch();

  app.orchard.setWorld(buildWorld(th));
  app.orchard.setProgress(progress(s)); // 礼物盒:进度越高越满
  const e = era(s);
  if (e !== lastEra) {
    lastEra = e;
    app.audio.setIntensity(Math.min(5, Math.round(e / 2)));
  }
  if (app.DEBUG) renderDebugInfo(th);
  const em = eraMin(s);
  if (lastEraMin >= 0 && em > lastEraMin) {
    bus.emit({ t: 'era', era: em });
    toast(ERA_SWITCH_TOAST[Math.min(em, ERA_SWITCH_TOAST.length - 1)], 4600);
  }
  lastEraMin = em;
  bottleneckTip(th);
  ambient();
  maybeEvent();
  if (!app.won && isWon(s)) win();
}
