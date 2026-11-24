// 图鉴面板:品种 / 彩蛋 / 成就 三页。未发现 = 灰剪影 + 提示;选中一格,底部"说明条"显示详情。
import { ACH_TEXT } from '../../content/achievements.ts';
import { DISCLAIMER_SYS_EGG_IDS, EGG_BY_ID, EGG_TEXT, SYS_EGG_ID_MAP } from '../../content/eggs.ts';
import { LIBRARY } from '../../content/ui.ts';
import { VARIETY_ORDER, VARIETY_TEXT } from '../../content/varieties.ts';
import { ACHIEVEMENTS } from '../../core/sys/codex.ts';
import { EGG_IDS } from '../../core/sys/eggs.ts';
import type { AppleKind } from '../../core/sys/varieties.ts';
import { appleCanvas, fmtTpl, h, openSheet, sfx } from './dom.ts';
import { savePrefs, type PanelPrefs } from './store.ts';
import type { PanelCtx } from './types.ts';

export type CodexTab = 'varieties' | 'eggs' | 'achievements';
const DISC = new Set<string>(DISCLAIMER_SYS_EGG_IDS);

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

export function openCodex(ctx: PanelCtx, prefs: PanelPrefs, onChange: () => void, tab0: CodexTab = 'varieties'): void {
  let tab: CodexTab = tab0;
  let sel = '';
  const cap = h('div', 'panel-cap');
  cap.setAttribute('aria-live', 'polite');
  const sheet = openSheet(ctx, { id: 'panel-codex', title: LIBRARY.title, cls: 'panel-codex-sheet', footer: cap });
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
      eggs: [EGG_IDS.filter((k) => f.eggs[k]).length, EGG_IDS.length],
      achievements: [ACHIEVEMENTS.filter((a) => f.ach[a.id]).length, ACHIEVEMENTS.length],
    };
  };

  function setCap(title: string, sub: string, text: string, hint = '', dim = false): void {
    cap.classList.toggle('dim', dim);
    cap.replaceChildren(
      h('div', 'panel-cap-h', h('b', null, title), sub ? h('span', null, sub) : null),
      h('p', 'panel-cap-t', text),
      ...(hint ? [h('p', 'panel-cap-n', hint)] : []),
    );
  }
  function capDefault(): void {
    const n = counts()[tab];
    const all = n[0] >= n[1];
    setCap(fmtTpl(LIBRARY.progress, { n: n[0], total: n[1] }), '', all ? LIBRARY.allDone : '点一格,看说明。', '', false);
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
        setCap(v.name, v.nickname, v.desc, v.lore);
        markSeen(t, id);
      } else setCap(LIBRARY.unseenName, '', LIBRARY.unseenVariety, v.hint, true);
    } else if (t === 'eggs') {
      const e = EGG_TEXT[id];
      if (!e) return;
      if (f.eggs[id]) {
        setCap(e.title, '', e.text, DISC.has(id) ? LIBRARY.disclaimerBody : '');
        markSeen(t, id);
      } else setCap(LIBRARY.unseenName, '', LIBRARY.unseenEgg, e.hint, true);
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
      for (const id of EGG_IDS) {
        const on = !!f.eggs[id];
        const layer = EGG_BY_ID[SYS_EGG_ID_MAP[id] ?? id]?.layer;
        const orb = h('span', 'panel-orb' + (on ? ' on' : '') + (layer === 'rare' ? ' rare' : ''), on ? '✦' : '?');
        grid.append(cell(tab, id, on, orb, EGG_TEXT[id]?.title ?? id));
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
      const b = h('button', 'panel-tab', label, h('small', null, `${c[t][0]}/${c[t][1]}`));
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
  }

  renderTabs();
  renderGrid();
  capDefault();
}
