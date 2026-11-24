// 三张没有 tier 事件的阶段说明卡:src-0(第一棵树)、rt-0(第一次有苹果上路)、station(第一趟送到终点)。
// 条件满足后等 ~1 秒再弹(给画面一点喘息);已看过的卡由面板自己忽略(prefs.cardsSeen),这里每张每次会话最多触发一次。
import { app } from './ctx.ts';
import { panels } from './panels.ts';

const fired = new Set<string>();
let lastAt = -1e9;
function fire(id: 'src-0' | 'rt-0' | 'station', delayMs: number): void {
  if (fired.has(id)) return;
  if (app.state.playSec - lastAt < 25) return; // 卡与卡至少隔 25 秒,别连弹打断摇树
  fired.add(id);
  lastAt = app.state.playSec;
  setTimeout(() => panels()?.showStageCard(id), delayMs);
}

/** 约每 0.25 秒由主循环调用 */
export function stageCardTick(): void {
  const s = app.state;
  if (app.readOnly || document.hidden) return;
  // 第一棵树:新局开场 1 秒后
  if (s.playSec < 900 && s.delivered < 30) fire('src-0', 1000);
  // 篮子:树脚有苹果、运输线还在最早一档
  if (s.route.tier === 0 && s.stock >= 1 && s.playSec < 900) fire('rt-0', 1000);
  // 终点:第一次有苹果被送到
  if (s.delivered > 0 && s.playSec >= 6) fire('station', 1000);
}
