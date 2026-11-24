// 面板层 DOM 小工具:h() 建元素、sheet 弹层、sprite 画布、音效。
import type { PanelCtx } from './types.ts';
import { appleSprite } from '../../art/nature/apple.ts';

type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string | null,
  ...kids: Child[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k !== null && k !== undefined && k !== false) e.append(k);
  return e;
}

export function btn(label: string, cls: string, on: () => void): HTMLButtonElement {
  const b = h('button', `panel-btn ${cls}`.trim(), label);
  b.type = 'button';
  b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    on();
  });
  return b;
}

export const reducedMotion = (ctx: PanelCtx): boolean => {
  const st = ctx.getState().settings;
  return !!st.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
};

export function sfx(ctx: PanelCtx, name: string): void {
  try {
    (ctx.audio?.sfx as unknown as { play(n: string): void } | undefined)?.play(name);
  } catch {
    /* 音频不可用就静默 */
  }
}

/** sys 品种 id → art/nature 精灵 id(两边命名不同) */
const SPRITE_ID: Record<string, string> = { goldenDel: 'yellow', granny: 'green', pinkLady: 'pink', redStreak: 'spotted', worm: 'wormy' };
export const spriteId = (kind: string): string => SPRITE_ID[kind] ?? kind;

/** 品种小图:silhouette=true 画成深灰剪影 */
export function appleCanvas(kind: string, size: number, silhouette = false, state: 'fresh' | 'wormy' | 'shiny' = 'fresh'): HTMLCanvasElement {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = Math.round(size * dpr);
  c.height = Math.round(size * dpr);
  c.style.width = size + 'px';
  c.style.height = size + 'px';
  c.className = 'panel-sprite';
  const g = c.getContext('2d');
  if (!g) return c;
  g.scale(dpr, dpr);
  const sid = spriteId(kind);
  // 精灵锚点 = 底部中心;size 64 的精灵放进 size×size
  const sp = appleSprite(sid, state, 64, false);
  g.save();
  g.translate(size / 2, size - size * 0.06);
  const k = size / 64;
  g.scale(k, k);
  sp.draw(g, 0, 0);
  g.restore();
  if (silhouette) {
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#8c8575';
    g.fillRect(0, 0, size, size);
    g.restore();
  }
  return c;
}

export interface Sheet {
  el: HTMLElement;
  body: HTMLElement;
  close(): void;
}

let openSheets: Sheet[] = [];
let sheetHook: ((open: boolean) => void) | null = null;
/** 弹层开/关时回调(旁白条据此暂停) */
export const onSheetChange = (fn: ((open: boolean) => void) | null): void => {
  sheetHook = fn;
};
export const anySheetOpen = (): boolean => openSheets.length > 0;
export function closeAllSheets(): void {
  for (const s of [...openSheets]) s.close();
}

/** 通用弹层:veil + 纸张卡片。点遮罩/✕/Esc 关闭。同时只允许一个(新开会关旧的) */
export function openSheet(
  ctx: PanelCtx,
  o: { id: string; title: string; cls?: string; onClose?: () => void; footer?: HTMLElement | null; noHeader?: boolean },
): Sheet {
  closeAllSheets();
  const root = ctx.root ?? document.body;
  const veil = h('div', 'panel-veil');
  const card = h('section', `panel-sheet ${o.cls ?? ''}`.trim());
  card.id = o.id;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', o.title);
  const body = h('div', 'panel-body');
  if (!o.noHeader) {
    const x = h('button', 'panel-x', '✕');
    x.type = 'button';
    x.setAttribute('aria-label', '关闭');
    x.addEventListener('click', () => sheet.close());
    card.append(h('header', 'panel-head', h('h2', 'panel-title', o.title), x));
  }
  card.append(body);
  if (o.footer) card.append(o.footer);
  veil.append(card);
  veil.addEventListener('pointerdown', (e) => {
    if (e.target === veil) sheet.close();
  });
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') sheet.close();
  };
  document.addEventListener('keydown', onKey);
  let closed = false;
  const sheet: Sheet = {
    el: card,
    body,
    close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      veil.classList.add('out');
      const gone = (): void => veil.remove();
      if (reducedMotion(ctx)) gone();
      else setTimeout(gone, 160);
      openSheets = openSheets.filter((s) => s !== sheet);
      sheetHook?.(openSheets.length > 0);
      o.onClose?.();
    },
  };
  openSheets.push(sheet);
  root.append(veil);
  sheetHook?.(true);
  sfx(ctx, 'modal');
  (card.querySelector('.panel-x') as HTMLElement | null)?.focus({ preventScroll: true });
  return sheet;
}

export const fmtTpl = (tpl: string, vars: Record<string, string | number>): string =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/** 大数缩写:1234 → 1.2K ;中文万/亿 */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a >= 1e8) return (n / 1e8).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, '') + ' 亿';
  if (a >= 1e4) return (n / 1e4).toFixed(a >= 1e6 ? 0 : 1).replace(/\.0$/, '') + ' 万';
  return String(Math.floor(n));
}

/** 本地存储 JSON 读写(坏数据回落) */
export function kvGet<T>(ctx: PanelCtx, key: string, d: T): T {
  try {
    const raw = (ctx.kv ?? localStorage).getItem(key);
    return raw ? ({ ...d, ...JSON.parse(raw) } as T) : d;
  } catch {
    return d;
  }
}
export function kvSet(ctx: PanelCtx, key: string, v: unknown): void {
  try {
    (ctx.kv ?? localStorage).setItem(key, JSON.stringify(v));
  } catch {
    /* 存储满/隐私模式:忽略 */
  }
}
