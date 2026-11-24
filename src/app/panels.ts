// 面板挂载点:把 ui-v5 的面板层(src/ui/panels)接到 app 层。面板只依赖 PanelCtx 的最小接口,不 import src/app/*,
// 这里负责把存档/献果/订单等动作和总线、音频、日期偏移注入进去。
import { bus } from '../core/bus.ts';
import { throughput } from '../core/game.ts';
import { exportSave, importSave } from '../core/save.ts';
import { offerApples, offerOpen } from '../core/sys/offer.ts';
import { mountPanels as mountUiPanels, type PanelCtx, type PanelsApi } from '../ui/panels/index.ts';
import { app, kv, nowMs } from './ctx.ts';
import { afterStateReplaced, catchUp, persist, resetGame, applySound, applyTheme } from './session.ts';
import { claimOrderAct, offerAct } from './sys.ts';
import { toast } from './toasts.ts';

let api: PanelsApi | null = null;

/** 当前面板接口(未挂载为 null) */
export const panels = (): PanelsApi | null => api;

/** 在 boot 里调用一次。ctx 可覆盖默认值(测试/调试用)。 */
export function mountPanels(ctx: Partial<PanelCtx> = {}): PanelsApi {
  api?.destroy();
  api = mountUiPanels({
    bus,
    getState: () => app.state,
    audio: app.audio,
    nowMs,
    debug: app.DEBUG,
    kv,
    dock: 'float',
    actions: {
      claimOrder: (id) => claimOrderAct(id),
      offer: (W) => offerAct(W),
      offerPreview: (W) => offerApples(W, throughput(app.state).value),
      offerOpen: () => offerOpen(app.state.source.tier, app.state.route.tier),
      exportSave: () => exportSave(app.state),
      importSave: (text) => {
        const s = importSave(text);
        if (!s) return false;
        app.state = s;
        app.readOnly = false;
        catchUp(false);
        afterStateReplaced();
        persist();
        toast('导入成功。');
        return true;
      },
      resetSave: () => resetGame(),
      settingsChanged: () => {
        applyTheme();
        applySound();
        persist();
      },
    },
    ...ctx,
  });
  // 面板层 say() 的入口也暴露给总线订阅者:新闻/彩蛋里需要旁白时走 bus 'narrate'(见 v5-api.md)
  return api;
}
