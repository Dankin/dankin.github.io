// 图鉴面板:品种 / 彩蛋 / 成就 三页。未发现 = 灰剪影 + 提示;选中一格,底部"说明条"显示详情。
import { ACH_TEXT } from '../../content/achievements.ts';
import { DISCLAIMER_SYS_EGG_IDS, EGGS, EGG_BY_ID, EGG_CHAR_FLOATS, EGG_TRIGGER_HINTS, SYS_EGG_ID_MAP } from '../../content/eggs.ts';
import { STATION_FLOATS } from '../../content/finale.ts';
import { STAGE_CARD_UI } from '../../content/stages.ts';
import { LIBRARY } from '../../content/ui.ts';
import { VARIETY_ORDER, VARIETY_TEXT, VARIETY_TRAITS } from '../../content/varieties.ts';
import { ACHIEVEMENTS } from '../../core/sys/codex.ts';
import { EGG_IDS } from '../../core/sys/eggs.ts';
import type { AppleKind } from '../../core/sys/varieties.ts';
import { appleSprite, drawAppleAt, appleLandFx, drawLandFx } from '../../art/nature/index.ts';
import { appleCanvas, h, openSheet, reducedMotion, sfx, spriteId } from './dom.ts';
import { savePrefs, type PanelPrefs } from './store.ts';
import type { PanelCtx } from './types.ts';

export type CodexTab = 'varieties' | 'eggs' | 'achievements';
const DISC = new Set<string>(DISCLAIMER_SYS_EGG_IDS);

/** 彩蛋列表 = 系统彩蛋 id ∪ 文案表里的 id(新增彩蛋不会漏格) */
const ALL_EGGS: string[] = [...new Set<string>([...EGG_IDS, ...EGGS.map((e) => e.id)])];

/** 彩蛋"点它会飘什么字":角色飘字(旧 key 经 SYS_EGG_ID_MAP 转 sys id)+ 车站小角色飘字。数字占位 {n} 去掉,只留词。 */
const FLOATS: Record<string, { reaction: string; floats: string[] }> = {};
for (const [k, v] of Object.entries(EGG_CHAR_FLOATS)) FLOATS[(SYS_EGG_ID_MAP as Record<string, string>)[k] ?? k] = v;
for (const [k, v] of Object.entries(STATION_FLOATS)) FLOATS[k] = v;
const floatWord = (f: string): string => f.replace(/^\+?\{n\}\s*/, '').trim();

/** 品种落地小动画:循环"掉下来 → 落地反应"(appleLandFx),画在 canvas 上。返回 stop。 */
function landPreview(ctx: PanelCtx, kind: string): { el: HTMLCanvasElement; stop(): void } {
  const W = 120, H = 84, dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = h('canvas', 'panel-cap-prev') as HTMLCanvasElement;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  cv.setAttribute('aria-hidden', 'true');
  const g = cv.getContext('2d');
  const spr = appleSprite(spriteId(kind), 'fresh', 64);
  const S = 0.8, GY = H - 14, R = 17 * S, DROP = 0.5, LOOP = 2.8;
  let raf = 0, alive = true;
  const t0 = performance.now();
  const frame = (tm: number): void => {
    if (!alive || !g) return;
    const T = reducedMotion(ctx) ? DROP + 0.12 : ((tm - t0) / 1000) % LOOP;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.strokeStyle = '#1b1410'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(6, GY + 1); g.lineTo(W - 6, GY + 1); g.stroke();
    const fx = appleLandFx(kind, T - DROP);
    let cx = W / 2 - 8, cy: number;
    if (T < DROP) { const u = T / DROP; cy = -R + (GY - 2 * R) * u * u; }
    else { cx += fx.dx * S; cy = GY - R + fx.dy * S; }
    g.save();
    if (fx.shake) g.translate(fx.shake * 0.6, 0);
    if (fx.alpha > 0.01) {
      g.translate(cx, cy + R); g.rotate(fx.rot); g.scale(fx.sx, fx.sy); g.translate(-cx, -(cy + R));
      drawAppleAt(g, spr, cx, cy, S, fx.alpha);
    }
    g.restore();
    drawLandFx(g, kind, T - DROP, W / 2 - 8, GY, S);
    if (!reducedMotion(ctx) || tm - t0 < 100) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { el: cv, stop: () => { alive = false; cancelAnimationFrame(raf); } };
}

interface Found {
  kinds: Record<string, boolean>;
  eggs: Record<string, boolean>;
  ach: Record<string, boolean>;
}
function found(ctx: PanelCtx): Found {
  const c = ctx.getState().sys?.codex;
  const f: Found = { kinds: {}, eggs: {}, ach: {} };
  if (!c) return f;
  for (const k of Object.keys(c.kinds ?? {})) f.kinds[k] = true;
  for (const k of Object.keys(c.eggs ?? {})) f.eggs[k] = true;
  for (const k of Object.keys(c.ach ?? {})) f.ach[k] = true;
  return f;
}

const keyOf = (t: CodexTab, id: string): string => (t === 'varieties' ? 'kind:' : t === 'eggs' ? 'egg:' : 'ach:') + id;

/** 未读(发现了但没点开过)的条目数 */
export function codexUnseen(ctx: PanelCtx, prefs: PanelPrefs): number {
  const f = found(ctx);
  let n = 0;
  for (const k of Object.keys(f.kinds)) if (!prefs.codexSeen.includes('kind:' + k)) n++;
  for (const k of Object.keys(f.eggs)) if (!prefs.codexSeen.includes('egg:' + k)) n++;
  for (const k of Object.keys(f.ach)) if (!prefs.codexSeen.includes('ach:' + k)) n++;
  return n;
}

export function openCodex(ctx: PanelCtx, prefs: PanelPrefs, onChange: () => void, tab0: CodexTab = 'varieties', deps?: { openStageCards(): void }): void {
  let tab: CodexTab = tab0;
  let sel = '';
  const cap = h('div', 'panel-cap');
  cap.setAttribute('aria-live', 'polite');
  let preview: { stop(): void } | null = null;
  const sheet = openSheet(ctx, { id: 'panel-codex', title: LIBRARY.title, cls: 'panel-codex-sheet', footer: cap, onClose: () => preview?.stop() });
  const tabs = h('div', 'panel-tabs');
  tabs.setAttribute('role', 'tablist');
  const grid = h('div', 'panel-cgrid');
  sheet.el.insertBefore(tabs, sheet.body);
  sheet.body.append(grid);

  const markSeen = (t: CodexTab, id: string): void => {
    const k = keyOf(t, id);
    if (prefs.codexSeen.includes(k)) return;
    prefs.codexSeen.push(k);
    savePrefs(ctx, prefs);
    onChange();
  };

  const counts = (): Record<CodexTab, [number, number]> => {
    const f = found(ctx);
    return {
      varieties: [VARIETY_ORDER.filter((k) => f.kinds[k]).length, VARIETY_ORDER.length],
      eggs: [ALL_EGGS.filter((k) => f.eggs[k]).length, ALL_EGGS.length],
      achievements: [ACHIEVEMENTS.filter((a) => f.ach[a.id]).length, ACHIEVEMENTS.length],
    };
  };

  function setCap(title: string, sub: string, text: string, hint = '', dim = false, extra: Node[] = [], prev?: HTMLElement): void {
    preview?.stop();
    preview = null;
    cap.classList.toggle('dim', dim);
    const body = h('div', 'panel-cap-b',
      h('div', 'panel-cap-h', h('b', null, title), sub ? h('span', null, sub) : null),
      h('p', 'panel-cap-t', text),
      ...extra,
      ...(hint ? [h('p', 'panel-cap-n', hint)] : []),
    );
    cap.replaceChildren(...(prev ? [prev, body] : [body]));
  }
  /** 进度只用话说,不报数 */
  function capDefault(): void {
    const n = counts()[tab];
    const r = n[0] / Math.max(1, n[1]);
    const word = n[0] >= n[1] ? LIBRARY.allDone : n[0] === 0 ? '这一页还是空的。' : r < 0.34 ? '才刚开头。' : r < 0.67 ? '收了不少。' : '快齐了。';
    setCap(word, '', '点一格,看说明。', '', n[0] === 0);
  }

  function pick(t: CodexTab, id: string, el: HTMLElement): void {
    sel = id;
    grid.querySelectorAll('.sel').forEach((e) => e.classList.remove('sel'));
    el.classList.add('sel');
    sfx(ctx, 'tabSwitch');
    const f = found(ctx);
    if (t === 'varieties') {
      const v = (VARIETY_TEXT as Record<string, (typeof VARIETY_TEXT)[keyof typeof VARIETY_TEXT] | undefined>)[id];
      if (!v) return;
      if (f.kinds[id]) {
        const lp = landPreview(ctx, spriteId(id));
        setCap(v.name, v.nickname, v.desc, v.lore, false, [h('p', 'panel-cap-trait', (VARIETY_TRAITS as Record<string, string>)[id] ?? '')], lp.el);
        preview = lp;
        markSeen(t, id);
      } else setCap(LIBRARY.unseenName, '', LIBRARY.unseenVariety, v.hint, true);
    } else if (t === 'eggs') {
      const e = EGG_BY_ID[id];
      const hint = (EGG_TRIGGER_HINTS as Record<string, string>)[id] ?? '';
      if (f.eggs[id]) {
        const fl = FLOATS[id];
        const extra = fl ? [h('p', 'panel-cap-fl', `“${fl.reaction}”`, ...fl.floats.map((x) => h('i', null, floatWord(x))))] : [];
        setCap(e?.name ?? id, '', e?.text ?? '', DISC.has(id) ? LIBRARY.disclaimerBody : '', false, extra);
        markSeen(t, id);
      } else setCap(LIBRARY.unseenName, '', LIBRARY.unseenEgg, hint, true);
    } else {
      const a = ACH_TEXT[id];
      if (!a) return;
      if (f.ach[id]) {
        setCap(a.title, '成就', a.text);
        markSeen(t, id);
      } else setCap(LIBRARY.unseenName, '成就', '还没解锁。', '', true);
    }
    el.querySelector('.panel-badge')?.remove();
  }

  function cell(t: CodexTab, id: string, on: boolean, art: HTMLElement | null, name: string, extra?: string): HTMLElement {
    const b = h('button', 'panel-cell' + (on ? ' on' : ' off') + (sel === id ? ' sel' : ''));
    b.type = 'button';
    b.setAttribute('aria-label', on ? name : LIBRARY.unseenName);
    if (art) b.append(art);
    b.append(h('span', 'panel-cell-n', on ? name : LIBRARY.unseenName));
    if (extra) b.append(h('span', 'panel-cell-x', extra));
    if (on && !prefs.codexSeen.includes(keyOf(t, id))) b.append(h('span', 'panel-badge', LIBRARY.newBadge));
    b.addEventListener('click', () => pick(t, id, b));
    return b;
  }

  function renderGrid(): void {
    const f = found(ctx);
    grid.replaceChildren();
    grid.className = 'panel-cgrid ' + tab;
    if (tab === 'varieties') {
      const nAny = VARIETY_ORDER.some((k) => f.kinds[k]);
      for (const id of VARIETY_ORDER) {
        const on = !!f.kinds[id];
        grid.append(cell(tab, id, on, appleCanvas(id as AppleKind, 52, !on), VARIETY_TEXT[id]?.name ?? id, on ? VARIETY_TEXT[id]?.nickname : undefined));
      }
      if (!nAny) grid.append(h('p', 'panel-empty panel-cgrid-empty', LIBRARY.emptyVarieties));
    } else if (tab === 'eggs') {
      for (const id of ALL_EGGS) {
        const on = !!f.eggs[id];
        const layer = EGG_BY_ID[id]?.layer;
        const orb = h('span', 'panel-orb' + (on ? ' on' : '') + (layer === 'rare' ? ' rare' : ''), on ? '✦' : '?');
        grid.append(cell(tab, id, on, orb, EGG_BY_ID[id]?.name ?? id));
      }
      grid.append(h('p', 'panel-note panel-cgrid-foot', LIBRARY.disclaimerBody));
    } else {
      for (const a of ACHIEVEMENTS) {
        const on = !!f.ach[a.id];
        const b = cell(tab, a.id, on, h('span', 'panel-orb ach' + (on ? ' on' : ''), on ? '★' : '☆'), ACH_TEXT[a.id]?.title ?? a.name);
        grid.append(b);
      }
    }
  }

  function renderTabs(): void {
    const c = counts();
    tabs.replaceChildren();
    const defs: [CodexTab, string][] = [
      ['varieties', LIBRARY.pageVarieties],
      ['eggs', LIBRARY.pageEggs],
      ['achievements', '成就'],
    ];
    for (const [t, label] of defs) {
      const b = h('button', 'panel-tab', label, h('small', null, c[t][0] >= c[t][1] ? '齐了' : c[t][0] === 0 ? '空' : ''));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(t === tab));
      b.addEventListener('click', () => {
        if (t === tab) return;
        tab = t;
        sel = '';
        sfx(ctx, 'tabSwitch');
        renderTabs();
        renderGrid();
        capDefault();
        grid.scrollTop = 0;
        sheet.body.scrollTop = 0;
      });
      tabs.append(b);
    }
    if (deps?.openStageCards) {
      const r = h('button', 'panel-tab panel-tab-stage', STAGE_CARD_UI.replay);
      r.type = 'button';
      r.addEventListener('click', () => deps.openStageCards());
      tabs.append(r);
    }
  }

  renderTabs();
  renderGrid();
  capDefault();
}
