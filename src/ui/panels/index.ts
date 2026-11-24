// 面板层入口:mountPanels(ctx) → PanelsApi。eng-app 在 boot 里调用一次(见 README)。
import './panels.css';
import { createNarration } from './narration.ts';
import { loadPrefs } from './store.ts';
import { closeAllSheets, anySheetOpen } from './dom.ts';
import type { PanelCtx, PanelsApi } from './types.ts';

export type { PanelCtx, PanelsApi, PanelActions } from './types.ts';

export function mountPanels(ctx: PanelCtx): PanelsApi {
  const root = ctx.root ?? document.body;
  const prefs = loadPrefs(ctx);
  const narr = createNarration(ctx, prefs, root);

  const api: PanelsApi = {
    say: (text, speaker, opts) => narr.say(text, speaker, opts?.force),
    onAway: (m) => narr.onAway(m),
    enterEra: (era) => narr.enterEra(era),
    openCodex() {}, openMailbox() {}, openPostcard() {}, openOrders() {}, openOffer() {}, openSettings() {}, openGift() {},
    isModalOpen: () => anySheetOpen(),
    closeAll: () => closeAllSheets(),
    badges: () => ({ codex: 0, mailbox: 0, orders: 0 }),
    destroy() {
      narr.destroy();
      closeAllSheets();
    },
  };
  ctx.bus.on('era', (e) => api.enterEra(e.era));
  return api;
}
