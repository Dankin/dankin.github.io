// 顶栏(已送出 / 进度条 / 速率)与设置里的精确数字。
import { progress, type Throughput } from '../core/game.ts';
import { GOAL } from '../core/constants.ts';
import { fmt } from '../ui/format.ts';
import { $, $o, setText } from './dom.ts';
import { app } from './ctx.ts';

// ───────────── 设置里的精确数字(顶栏只放 已送出) ─────────────
let exactRows: HTMLElement[] | null = null;
function renderExact(th: Throughput): void {
  const box = $o('exactApples');
  if (!box) return;
  if (!exactRows) {
    exactRows = [0, 1, 2, 3].map(() => box.appendChild(document.createElement('div')));
  }
  const n = (v: number): string => Math.floor(v).toLocaleString('en-US');
  const s = app.state;
  setText(exactRows[0], `已送出 ${n(s.delivered)} / ${n(GOAL)}`);
  setText(exactRows[1], `果钱 ${n(s.coins)}`);
  setText(exactRows[2], `每秒送达 ${fmt(th.flow)} · 每秒收入 ${fmt(th.income)}`);
  setText(exactRows[3], `摇了 ${n(s.shakes)} 下 · 老徐 ${s.helpers} 位`);
}

let lastApples = '';
export function resetHud(): void {
  lastApples = '';
}

/** 顶栏:已送出 / 目标;果钱 + 每秒送达 */
export function renderHud(th: Throughput): void {
  const s = app.state;
  const shown = fmt(Math.floor(s.delivered));
  const ap = $('apples');
  if (shown !== lastApples) {
    if (lastApples) {
      ap.classList.remove('bump');
      void ap.offsetWidth;
      ap.classList.add('bump');
    }
    ap.textContent = shown;
    lastApples = shown;
  }
  const gn = $o('goalNum');
  if (gn && !gn.hidden) gn.hidden = true; // 目标和精确值放在设置里
  const rateEl = $o('rate');
  if (rateEl) setText(rateEl, `果钱 ${fmt(Math.floor(s.coins))} · 每秒 ${fmt(th.flow)}`);
  renderExact(th);
  const pct = progress(s) * 100;
  $('goalBar').style.width = `${pct.toFixed(2)}%`;
  $('goalWrap').setAttribute('aria-valuenow', pct.toFixed(1));
  $('goalWrap').title = `已送出 ${Math.floor(s.delivered).toLocaleString('en-US')} / ${GOAL.toLocaleString('en-US')}`;
}
