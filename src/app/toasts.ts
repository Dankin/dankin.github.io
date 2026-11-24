// 提示(toast 队列)。
import { $ } from './dom.ts';

// ───────────── 提示(toast 队列) ─────────────
const toastEl = $('toast');
const toastQ: string[] = [];
let toastBusy = false;
export function toast(msg: string, ms = 3200): void {
  if (!msg || toastQ.includes(msg)) return;
  if (toastQ.length >= 3) toastQ.shift();
  toastQ.push(msg);
  pumpToast(ms);
}
function pumpToast(ms: number): void {
  if (toastBusy || !toastQ.length) return;
  toastBusy = true;
  toastEl.textContent = toastQ.shift()!;
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => {
      toastBusy = false;
      pumpToast(ms);
    }, 320);
  }, ms);
}

/** 没有提示在显示、也没有排队(给不想打断玩家的提示用) */
export const toastIdle = (): boolean => !toastBusy && toastQ.length === 0;
