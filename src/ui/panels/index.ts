// 面板层入口:mountPanels(ctx) → PanelsApi。eng-app 在 boot 里调用一次(见 README)。
import './panels.css';
import { offerOpen } from '../../core/sys/offer.ts';
import { codexUnseen, openCodex, type CodexTab } from './codex.ts';
import { anySheetOpen, closeAllSheets, h, onSheetChange } from './dom.ts';
import { createGift } from './gift.ts';
import { createNarration } from './narration.ts';
import { createOrders } from './orders.ts';
import { createPostcards } from './postcards.ts';
import { openSettings } from './settings.ts';
import { loadPrefs } from './store.ts';
import type { PanelCtx, PanelsApi } from './types.ts';

export type { PanelCtx, PanelsApi, PanelActions } from './types.ts';
export { PEST_HINT } from './orders.ts';

interface DockBtn {
  el: HTMLButtonElement;
  dot: HTMLElement;
  show(): boolean;
  badge(): number;
}

export function mountPanels(ctx: PanelCtx): PanelsApi {
  const root = ctx.root ?? document.body;
  const prefs = loadPrefs(ctx);
  const narr = createNarration(ctx, prefs, root);
  onSheetChange((open) => narr.setHold(open));

  const dockBtns: DockBtn[] = [];
  let dock: HTMLElement | null = null;
  const refreshDock = (): void => {
    for (const d of dockBtns) {
      d.el.hidden = !d.show();
      const n = d.badge();
      d.dot.hidden = n <= 0;
      d.dot.textContent = n > 9 ? '9+' : String(n);
    }
  };
  const postcards = createPostcards(ctx, prefs, refreshDock);
  const orders = createOrders(ctx, prefs, root, refreshDock, (t) => narr.say(t, undefined, false));
  const gift = createGift(ctx, refreshDock);

  const api: PanelsApi = {
    say: (text, speaker, opts) => narr.say(text, speaker, opts?.force),
    onAway: (m) => narr.onAway(m),
    enterEra(era, opts) {
      narr.enterEra(era);
      postcards.enter(era, opts?.force);
    },
    openCodex: (tab?: CodexTab) => openCodex(ctx, prefs, refreshDock, tab),
    openMailbox: () => postcards.openMailbox(),
    openPostcard: (id) => postcards.open(id, 'reread'),
    openOrders: () => orders.openOrders(),
    openOffer: () => orders.openOffer(),
    openSettings: () => openSettings(ctx, prefs, { openGift: () => gift.open(), onChange: refreshDock }),
    openGift: (o) => gift.open(o?.force),
    tick() {
      orders.tick();
      refreshDock();
    },
    isModalOpen: () => anySheetOpen(),
    closeAll: () => closeAllSheets(),
    badges: () => ({ codex: codexUnseen(ctx, prefs), mailbox: postcards.unread(), orders: orders.unseen() }),
    destroy() {
      clearInterval(timer);
      narr.destroy();
      orders.destroy();
      dock?.remove();
      onSheetChange(null);
      closeAllSheets();
    },
  };

  // ── 入口按钮(印章风小圆钮) ──
  if (ctx.dock !== null) {
    const host = ctx.dock && ctx.dock !== 'float' ? ctx.dock : null;
    dock = host ?? h('div', 'panel-dock');
    if (!host) {
      dock.id = 'panel-dock';
      root.append(dock);
    }
    const add = (ch: string, label: string, on: () => void, show: () => boolean, badge: () => number): void => {
      const el = h('button', 'panel-dockbtn', h('span', null, ch));
      el.type = 'button';
      el.setAttribute('aria-label', label);
      el.title = label;
      const dot = h('i', 'panel-dot');
      dot.hidden = true;
      el.append(dot);
      el.addEventListener('click', on);
      dock!.append(el);
      dockBtns.push({ el, dot, show, badge });
    };
    const st = (): ReturnType<PanelCtx['getState']> => ctx.getState();
    add('图', '图鉴', () => api.openCodex(), () => true, () => codexUnseen(ctx, prefs));
    add('信', '信箱', () => api.openMailbox(), () => prefs.cardsSeen.length > 0, () => postcards.unread());
    add('单', '订单', () => api.openOrders(), () => orders.count() > 0 || (st().sys?.orders?.done ?? 0) > 0, () => orders.unseen());
    add('献', '献果', () => api.openOffer(), () => !!ctx.actions?.offer && offerOpen(st().source.tier, st().route.tier), () => 0);
    refreshDock();
  }

  const timer = window.setInterval(() => api.tick?.(), 1000);
  ctx.bus.on('era', (e) => api.enterEra(e.era));
  return api;
}
