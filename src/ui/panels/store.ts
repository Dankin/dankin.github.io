// 面板层的小偏好与"已看过"记录(localStorage 'sta.panels')。
import type { PanelCtx } from './types.ts';
import { kvGet, kvSet } from './dom.ts';

export interface PanelPrefs {
  /** 旁白打字机效果 */
  typewriter: boolean;
  /** 已播过的旁白 id */
  narrSeen: string[];
  /** 已弹过/已收进信箱的明信片 id */
  /** 信箱里还没点开读的 */
  /** 图鉴里已"看过"(去掉新标)的条目 key:kind:xx / egg:xx / ach:xx */
  codexSeen: string[];
  /** 旁白最近播放时间戳(ms),用于每小时上限 */
  narrAt: number[];
  /** 订单面板上次看过的最大订单 id */
  ordersSeenId: number;
}

export const PREFS_KEY = 'sta.panels';
const def = (): PanelPrefs => ({ typewriter: true, narrSeen: [], codexSeen: [], narrAt: [], ordersSeenId: 0 });

export function loadPrefs(ctx: PanelCtx): PanelPrefs {
  const p = kvGet<PanelPrefs>(ctx, PREFS_KEY, def());
  for (const k of ['narrSeen', 'codexSeen', 'narrAt'] as const) if (!Array.isArray(p[k])) (p as unknown as Record<string, unknown>)[k] = [];
  return p;
}
export const savePrefs = (ctx: PanelCtx, p: PanelPrefs): void => kvSet(ctx, PREFS_KEY, p);
