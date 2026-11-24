// 新手引导(前 10 分钟):按 src/content/ui.ts 的 FTUE 表,每一步在条件满足时出现一次,看过的记在 localStorage 'sta.ftue'。
// 形式只有三种:提示手势(摇树)、高亮(给目标元素加 .ftue-glow)、一句话(旁白条优先,没有就用 toast)。老存档不引导。
import { bus } from '../core/bus.ts';
import { FTUE } from '../content/ui.ts';
import { getGoal } from './bar.ts';
import { app, kv } from './ctx.ts';
import { panels } from './panels.ts';
import { toast } from './toasts.ts';

const KEY = 'sta.ftue';
let done = new Set<string>();
let started = false;
const step = (id: string) => FTUE.find((f) => f.id === id);
const mark = (id: string): void => {
  done.add(id);
  try {
    kv.setItem(KEY, JSON.stringify([...done]));
  } catch {
    /* 不能存就算了 */
  }
};

function say(id: string): void {
  const f = step(id);
  if (!f || done.has(id)) return;
  mark(id);
  const p = panels();
  if (f.kind === 'narration' && p) p.say(f.text, undefined, { force: true });
  else toast(f.text, 3600);
}

let glowEl: Element | null = null;
function glow(el: Element | null, ms = 6000): void {
  glowEl?.classList.remove('ftue-glow');
  glowEl = el;
  if (!el) return;
  el.classList.add('ftue-glow');
  setTimeout(() => el === glowEl && clear(), ms);
}
function clear(): void {
  glowEl?.classList.remove('ftue-glow');
  glowEl = null;
}

let hint: HTMLElement | null = null;
function showHint(on: boolean): void {
  if (on && !hint) {
    hint = document.createElement('div');
    hint.id = 'ftueHint';
    hint.textContent = step('ftue-shake')?.text ?? '摇树';
    document.getElementById('scene')?.appendChild(hint);
  } else if (!on && hint) {
    hint.remove();
    hint = null;
  }
}

export function initFtue(awayMs = 0): void {
  // 隔了一阵回来:先让「欢迎回来」之类的提示播完,引导 toast 往后放 14 秒
  const quietUntil = performance.now() + (awayMs >= 60_000 ? 14_000 : 0);
  if (started) return;
  started = true;
  try {
    const raw = kv.getItem(KEY);
    done = new Set(raw ? (JSON.parse(raw) as string[]) : []);
    // 老存档(已经玩过一阵):不引导
    if (!raw && (app.state.shakes > 20 || app.state.delivered > 0 || app.state.spent > 0)) {
      FTUE.forEach((f) => done.add(f.id));
      kv.setItem(KEY, JSON.stringify([...done]));
    }
  } catch {
    done = new Set();
  }
  if (FTUE.every((f) => done.has(f.id))) return;

  let firstTier = 0;
  bus.on('shake', () => {
    showHint(false);
    mark('ftue-shake');
  });
  bus.on('event', (e) => e.phase === 'appear' && say('ftue-bird'));
  bus.on('tier', () => {
    firstTier++;
    say(firstTier === 1 ? 'ftue-tier-up' : 'ftue-tier-2');
  });
  bus.on('order', (e) => e.phase === 'new' && say('ftue-order'));
  bus.on('egg', () => say('ftue-egg'));
  bus.on('buy', (e) => {
    clear();
  });

  setTimeout(() => {
    if (app.state.shakes === 0 && !done.has('ftue-shake')) {
      showHint(true);
      say('ftue-open');
    }
  }, 600);
  let boughtAt = -1;
  setInterval(() => {
    const s = app.state;
    if (app.readOnly || performance.now() < quietUntil) return;
    if (document.getElementById('toast')?.classList.contains('show')) return; // 别和欢迎回来等提示抢位
    if (s.shakes > 0 && s.stock > 0 && !done.has('ftue-stock')) {
      mark('ftue-stock');
      glow(document.getElementById('handBar'), 4500);
      toast(step('ftue-stock')!.text, 3600);
    }
    const g = getGoal();
    if (!done.has('ftue-first-buy') && s.spent === 0 && g && s.coins >= g.cost) {
      mark('ftue-first-buy');
      glow(g.act.el, 12000);
      toast(step('ftue-first-buy')!.text, 3000);
    }
    if (s.delivered > 0) say('ftue-basket');
    if (s.spent > 0) {
      if (boughtAt < 0) boughtAt = s.playSec;
      if (s.playSec - boughtAt > 20) say('ftue-water');
    }
    if (s.helperLevel > 0 || document.getElementById('btnHelper')?.hidden === false) if (s.playSec >= 120) say('ftue-laoxu');
    if (s.playSec >= 300 && !done.has('ftue-pin')) {
      const pin = document.querySelector<HTMLElement>('#bar .act:not([hidden]) .pin:not([hidden])');
      if (pin) {
        mark('ftue-pin');
        glow(pin, 7000);
        toast(step('ftue-pin')!.text, 3600);
      }
    }
  }, 700);
}
