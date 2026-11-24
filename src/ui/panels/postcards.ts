// 时代明信片(6 张)+ 信箱。进入新时代弹一张,收进信箱,之后随时可重读。
import { POSTCARDS, type Postcard } from '../../content/story.ts';
import { BTN } from '../../content/ui.ts';
import { appleCanvas, btn, h, openSheet, reducedMotion, sfx, anySheetOpen } from './dom.ts';
import { savePrefs, type PanelPrefs } from './store.ts';
import type { PanelCtx } from './types.ts';

/** 邮戳上的时代名(只做装饰) */
const ERA_MARK = ['平安夜前', '邻里', '山上', '果城', '天上', '门前'];
/** 邮票上的苹果:每个时代换一个品种 */
const STAMP_KIND = ['fuji', 'green', 'golden', 'pink', 'purple', 'silver'];
const STAMP_TINT = ['#d8232a', '#4f8a3a', '#c9961a', '#c4566e', '#6b4aa0', '#4a6f8c'];

export const POSTCARD_COUNT = POSTCARDS.length;

function postmark(era: number): HTMLElement {
  const mark = ERA_MARK[era] ?? '';
  const d = h('div', 'panel-pmark');
  d.setAttribute('aria-hidden', 'true');
  d.innerHTML =
    `<svg viewBox="0 0 80 80" width="78" height="78"><defs><path id="pmk${era}" d="M40 40 m-28 0 a28 28 0 1 1 56 0 a28 28 0 1 1 -56 0"/></defs>` +
    `<circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" stroke-width="2.6"/>` +
    `<circle cx="40" cy="40" r="22" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
    `<text font-size="9.5" font-weight="800" letter-spacing="2.2" fill="currentColor"><textPath href="#pmk${era}" startOffset="2">平安夜 · 摇苹果 · ${mark} ·</textPath></text>` +
    `<text x="40" y="38" text-anchor="middle" font-size="9" font-weight="800" fill="currentColor">12.24</text>` +
    `<text x="40" y="49" text-anchor="middle" font-size="9" font-weight="800" fill="currentColor">NO.${era + 1}</text></svg>`;
  return d;
}

function stamp(era: number): HTMLElement {
  const s = h('div', 'panel-stamp');
  s.style.setProperty('--tint', STAMP_TINT[era] ?? '#d8232a');
  s.append(appleCanvas(STAMP_KIND[era] ?? 'fuji', 46), h('i', null, `${(era + 1) * 8}分`));
  return s;
}

/** 渲染一张明信片(不含弹层外壳) */
export function renderPostcard(pc: Postcard, locked = false): HTMLElement {
  const card = h('article', 'panel-pc' + (locked ? ' locked' : ''));
  card.dataset.era = String(pc.era);
  const msg = h('div', 'panel-pc-msg', h('h3', 'panel-pc-title', pc.title), h('p', 'panel-pc-body', pc.body));
  const side = h('div', 'panel-pc-side', stamp(pc.era), postmark(pc.era), h('div', 'panel-pc-sign', h('small', null, '——'), pc.sign));
  card.append(msg, side);
  return card;
}

export interface Postcards {
  /** 进入某时代:弹出明信片(已看过则不弹)。force = 无视已看过 */
  enter(era: number, force?: boolean): void;
  open(id: string, mode?: 'fresh' | 'reread'): void;
  openMailbox(): void;
  unread(): number;
}

export function createPostcards(ctx: PanelCtx, prefs: PanelPrefs, onChange: () => void): Postcards {
  const save = (): void => {
    savePrefs(ctx, prefs);
    onChange();
  };
  const byId = (id: string): Postcard | undefined => POSTCARDS.find((p) => p.id === id);

  function open(id: string, mode: 'fresh' | 'reread' = 'reread'): void {
    const pc = byId(id);
    if (!pc) return;
    if (!prefs.cardsSeen.includes(id)) prefs.cardsSeen.push(id);
    prefs.cardsUnread = prefs.cardsUnread.filter((x) => x !== id);
    save();
    const card = renderPostcard(pc);
    const foot = h('div', 'panel-foot');
    const sheet = openSheet(ctx, { id: 'panel-postcard', title: pc.title, cls: 'panel-pc-sheet', noHeader: true, footer: foot });
    if (!reducedMotion(ctx) && mode === 'fresh') card.classList.add('fly');
    sheet.body.append(card);
    foot.append(
      btn(mode === 'fresh' ? '收进信箱' : BTN.close, 'red', () => {
        sfx(ctx, 'tabSwitch');
        sheet.close();
      }),
    );
    if (mode === 'fresh') foot.append(h('span', 'panel-note', `${prefs.cardsSeen.length}/${POSTCARD_COUNT} 张已在信箱`));
    sfx(ctx, mode === 'fresh' ? 'narrOpen' : 'modal');
  }

  function openMailbox(): void {
    const sheet = openSheet(ctx, { id: 'panel-mailbox', title: '信箱', cls: 'panel-mail-sheet' });
    const n = prefs.cardsSeen.length;
    sheet.body.append(h('p', 'panel-note panel-mail-sub', `每到一个新时代,会有人给你寄一张明信片。已收到 ${n}/${POSTCARD_COUNT}。`));
    const grid = h('div', 'panel-mail-grid');
    for (const pc of POSTCARDS) {
      const got = prefs.cardsSeen.includes(pc.id);
      const b = h('button', 'panel-env' + (got ? ' got' : ''));
      b.type = 'button';
      b.disabled = !got;
      if (got) {
        b.append(
          h('span', 'panel-env-no', `第 ${pc.era + 1} 张`),
          h('b', 'panel-env-t', pc.title),
          h('span', 'panel-env-s', pc.sign),
        );
        if (prefs.cardsUnread.includes(pc.id)) b.append(h('span', 'panel-badge', '新'));
        b.addEventListener('click', () => open(pc.id, 'reread'));
      } else {
        b.append(h('span', 'panel-env-no', `第 ${pc.era + 1} 张`), h('b', 'panel-env-t', '???'), h('span', 'panel-env-s', '还没寄到'));
      }
      grid.append(b);
    }
    sheet.body.append(grid);
  }

  return {
    enter(era, force) {
      const pc = POSTCARDS.find((p) => p.era === era);
      if (!pc) return;
      if (!force && prefs.cardsSeen.includes(pc.id)) return;
      // 有别的面板挡着时不打断:悄悄放进信箱,亮个红点
      if (anySheetOpen() && !force) {
        if (!prefs.cardsSeen.includes(pc.id)) prefs.cardsSeen.push(pc.id);
        if (!prefs.cardsUnread.includes(pc.id)) prefs.cardsUnread.push(pc.id);
        save();
        return;
      }
      open(pc.id, 'fresh');
    },
    open,
    openMailbox,
    unread: () => prefs.cardsUnread.length,
  };
}
