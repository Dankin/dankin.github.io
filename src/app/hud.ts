// 顶栏:手上苹果(图标+数量+水位条)、已送出、进度条;设置里的精确数字。
import { progress, type Throughput } from '../core/game.ts';
import { GOAL } from '../core/constants.ts';
import { fmt } from '../ui/format.ts';
import { $, $o, setText, fmtWait } from './dom.ts';
import { app } from './ctx.ts';
import { drawHandIcon } from './appleIcon.ts';
import { bus } from '../core/bus.ts';
import type { Goal } from './bar.ts';

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
  setText(exactRows[1], `手上苹果(果钱) ${n(s.coins)} · 累计花掉 ${n(s.spent)}`);
  setText(exactRows[2], `每秒送达 ${fmt(th.flow)} · 每秒收入 ${fmt(th.income)}`);
  setText(exactRows[3], `摇了 ${n(s.shakes)} 下 · 老徐 ${s.helpers} 位`);
}

let lastApples = '';
let lastHand = '';
export function resetHud(): void {
  lastApples = '';
  lastHand = '';
}

/** 画(或按主题重画)左上角的苹果图标 */
export function redrawHandIcon(): void {
  const cv = $o('handIcon') as HTMLCanvasElement | null;
  if (cv) drawHandIcon(cv);
}

/** 买东西:手上数字旁飘一个 -价钱 */
export function initHud(): void {
  bus.on('buy', (e) => spendFloat(e.cost));
  redrawHandIcon();
}
function spendFloat(cost: number): void {
  const hand = $o('hand');
  if (!hand || !(cost > 0)) return;
  const el = document.createElement('span');
  el.className = 'spend';
  el.textContent = `-${fmt(cost)}`;
  hand.append(el);
  setTimeout(() => el.remove(), 900);
}

/** 顶栏:手上苹果 + 水位条(攒到目标的进度);已送出 / 目标 */
export function renderHud(th: Throughput, goal: Goal | null): void {
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
  renderHand(th, goal);
  renderExact(th);
  const pct = progress(s) * 100;
  $('goalBar').style.width = `${pct.toFixed(2)}%`;
  $('goalWrap').setAttribute('aria-valuenow', pct.toFixed(1));
  $('goalWrap').title = `已送出 ${Math.floor(s.delivered).toLocaleString('en-US')} / ${GOAL.toLocaleString('en-US')}`;
}

/** 手上苹果:数量 + 每秒进账 + 水位条(手上数量 / 当前最想买的东西的价钱) */
function renderHand(th: Throughput, goal: Goal | null): void {
  const s = app.state;
  const num = fmt(Math.floor(s.coins));
  if (num !== lastHand) {
    $('handNum').textContent = num;
    lastHand = num;
  }
  setText($('handRate'), th.income > 0 ? `+${fmt(th.income)}/秒` : '');
  const bar = $('handBar');
  const fill = bar.firstElementChild as HTMLElement;
  if (!goal) {
    bar.classList.add('off');
    setText($('handGoal'), '');
    return;
  }
  const f = Math.max(0, Math.min(1, s.coins / goal.cost));
  bar.classList.remove('off');
  bar.classList.toggle('full', f >= 1);
  bar.classList.toggle('pinned', goal.pinned);
  fill.style.width = `${(f * 100).toFixed(1)}%`;
  bar.setAttribute('aria-valuenow', (f * 100).toFixed(0));
  const eta = f >= 1 ? 0 : th.income > 0 ? (goal.cost - s.coins) / th.income : Infinity;
  const tail = f >= 1 ? '够了' : isFinite(eta) ? `还要${fmtWait(eta)}` : '';
  const txt = `${goal.pinned ? '钉住' : '想买'} ${goal.name} ${fmt(goal.cost)}${tail ? ' · ' + tail : ''}`;
  setText($('handGoal'), txt);
  bar.title = `${goal.pinned ? '钉住的目标' : '想买'}:${goal.name},${fmt(goal.cost)}(手上 ${fmt(Math.floor(s.coins))})`;
}
