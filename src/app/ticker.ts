// 新闻滚动条(R5):顶栏下面一条 24px 的横向滚动字幕。
// 新闻内容由"新闻源"决定:默认循环 core/copy.ts 的 DAILY_NEWS;内容/条件库用 setNewsSource(fn) 接入(见 app/news.ts)。
// prefers-reduced-motion(或设置里的"减少动效")时不滚动,逐条切换。
import type { Throughput } from '../core/game.ts';
import type { State } from '../core/state.ts';
import { DAILY_NEWS } from '../core/copy.ts';
import { $o } from './dom.ts';
import { app } from './ctx.ts';

/** 新闻源拿到的上下文 */
export interface NewsCtx {
  state: State;
  /** 当前吞吐;还没算出来时为 null */
  th: Throughput | null;
  /** performance.now() */
  now: number;
}
/** 返回下一条要显示的文字;没有可显示的返回 null(滚动条留空一会儿) */
export type NewsSource = (ctx: NewsCtx) => string | null;

/** 默认源:DAILY_NEWS 循环 */
let defI = Math.floor(Math.random() * DAILY_NEWS.length);
const defaultSource: NewsSource = () => DAILY_NEWS[defI++ % DAILY_NEWS.length];

let source: NewsSource = defaultSource;
/** 换新闻源。传 null 恢复默认。 */
export function setNewsSource(fn: NewsSource | null): void {
  source = fn ?? defaultSource;
}

/** 插队:下一条先显示它(例如刚发现彩蛋的"据报……")。最多排 3 条。 */
const queue: string[] = [];
export function pushNews(text: string): void {
  if (queue.length < 3) queue.push(text);
}

let lastTh: Throughput | null = null;
/** 每次渲染时由 renderAll 告知最新吞吐 */
export function feedTicker(th: Throughput): void {
  lastTh = th;
}

const SPEED = 0.08; // px/ms
const MIN_MS = 8000; // 一条至少停留/滚动 8 秒
const GAP_MS = 600;
let timer = 0;
let anim: Animation | null = null;
let started = false;

const reduced = (): boolean => app.state.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;

function pick(): string | null {
  if (queue.length) return queue.shift()!;
  try {
    return source({ state: app.state, th: lastTh, now: performance.now() });
  } catch {
    return null; // 新闻源出错不能拖垮游戏
  }
}

function step(): void {
  const view = $o('newsView');
  const el = $o('newsText');
  if (!view || !el) return;
  // 还没送出第一个苹果之前,条上只有报头(开局安静)
  const text = app.state.delivered > 0 ? pick() : null;
  anim?.cancel();
  anim = null;
  if (!text) {
    el.textContent = '';
    timer = window.setTimeout(step, 2000);
    return;
  }
  el.textContent = text;
  el.title = text;
  if (reduced()) {
    el.classList.add('still');
    timer = window.setTimeout(step, MIN_MS);
    return;
  }
  el.classList.remove('still');
  const vw = view.clientWidth;
  const tw = el.scrollWidth;
  const dist = vw + tw;
  const dur = Math.max(MIN_MS, dist / SPEED);
  anim = el.animate([{ transform: `translateX(${vw}px)` }, { transform: `translateX(${-tw}px)` }], { duration: dur, easing: 'linear', fill: 'both' });
  anim.onfinish = () => {
    timer = window.setTimeout(step, GAP_MS);
  };
}

/** 启动(只会启动一次);页面隐藏时暂停滚动 */
export function startTicker(): void {
  if (started) return;
  started = true;
  timer = window.setTimeout(step, 1200);
  document.addEventListener('visibilitychange', () => {
    if (!anim) return;
    if (document.hidden) anim.pause();
    else anim.play();
  });
}

/** 开发用:立刻换下一条 */
export function skipNews(): void {
  clearTimeout(timer);
  step();
}
