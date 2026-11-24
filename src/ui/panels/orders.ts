// 订单气泡(顾客头顶,点一下交付)、订单列表、献果面板。数据读 state.sys,动作走 ctx.actions。
import { drawCharacter } from '../../art/things/index.ts';
import { EMPTY, TERMS, TOAST } from '../../content/ui.ts';
import { VARIETY_TEXT } from '../../content/varieties.ts';
import { offerOpen } from '../../core/sys/offer.ts';
import { canFulfill, type Order } from '../../core/sys/orders.ts';
import { APPLE_KINDS, bagTotal, type AppleKind } from '../../core/sys/varieties.ts';
import { appleCanvas, btn, fmtNum, h, openSheet, reducedMotion, sfx } from './dom.ts';
import { savePrefs, type PanelPrefs } from './store.ts';
import type { PanelCtx } from './types.ts';

/** 虫眼 / 烂果的点击提示文案(eng-app 在 toast/旁白里直接用) */
export const PEST_HINT = {
  ant: '有蚂蚁在搬苹果。点它。',
  beetle: '甲虫来了。连点两下。',
  caterpillar: '毛毛虫在啃苹果。点掉它。',
  wave: '有虫来了。别慌,点一下就好。',
  rot: '有个苹果烂了。点它,别让它传染。',
  wormy: '有虫眼的苹果只值七成。点它,虫就搬走了。',
  killed: '虫搬走了。',
} as const;

const CUST_KIND = ['cust1', 'cust2', 'cust3'] as const;
const wantName = (w: Order['want']): string => (w === 'any' ? '任意品种' : (VARIETY_TEXT[w]?.name ?? w));

function avatar(customer: number, size: number): HTMLCanvasElement {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = size * dpr;
  c.height = size * dpr;
  c.style.width = size + 'px';
  c.style.height = size + 'px';
  c.className = 'panel-sprite';
  const g = c.getContext('2d');
  if (g) {
    g.scale(dpr, dpr);
    try {
      const k = size / 46;
      drawCharacter(g, CUST_KIND[((customer % 3) + 3) % 3], size / 2, size - 1, k, {});
    } catch {
      /* 美术缺这张图:留空 */
    }
  }
  return c;
}

const wantIcon = (o: Order, size: number): HTMLElement =>
  o.want === 'any' ? h('span', 'panel-any', '任') : appleCanvas(o.want as AppleKind, size);

const left = (ctx: PanelCtx, o: Order): number => Math.max(0, o.expiresAt - ctx.getState().playSec);
const fmtT = (s: number): string => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : `${Math.ceil(s)}秒`);
const short = (ctx: PanelCtx, o: Order): number => {
  const bag = ctx.getState().sys?.bag ?? {};
  const have = o.want === 'any' ? bagTotal(bag) : (bag[o.want] ?? 0);
  return Math.max(0, o.qty - have);
};

export interface Orders {
  openOrders(): void;
  openOffer(): void;
  tick(): void;
  unseen(): number;
  count(): number;
  destroy(): void;
}

export function createOrders(ctx: PanelCtx, prefs: PanelPrefs, parent: HTMLElement, onChange: () => void, say: (t: string) => void): Orders {
  const strip = h('div', 'panel-bubbles');
  strip.id = 'panel-bubbles';
  strip.setAttribute('aria-label', '顾客订单');
  parent.append(strip);
  let sig = '';
  let listRefresh: (() => void) | null = null;

  const claim = (o: Order, el?: HTMLElement): void => {
    const sys = ctx.getState().sys;
    if (!sys) return;
    if (!canFulfill(sys.bag, o)) {
      sfx(ctx, 'toggleOff');
      if (el && !reducedMotion(ctx)) {
        el.classList.remove('nope');
        void el.offsetWidth;
        el.classList.add('nope');
      }
      say(`篮子里还差 ${short(ctx, o)} 个${wantName(o.want)}。`);
      return;
    }
    const r = ctx.actions?.claimOrder?.(o.id);
    if (r?.ok) {
      sfx(ctx, 'orderDone');
      say(TOAST.orderDone);
      render(true);
      listRefresh?.();
    }
  };

  function render(force = false): void {
    const st = ctx.getState();
    const list = st.sys?.orders?.list ?? [];
    const key = list.map((o) => `${o.id}:${canFulfill(st.sys.bag, o) ? 1 : 0}`).join(',');
    if (!force && key !== sig) listRefresh?.();
    if (!force && key === sig) {
      for (const o of list) {
        const t = document.querySelector<HTMLElement>(`#panel-orders [data-id="${o.id}"] .panel-ot`);
        if (t) t.textContent = fmtT(left(ctx, o));
      }
      // 只更新倒计时
      for (const o of list) {
        const el = strip.querySelector<HTMLElement>(`[data-id="${o.id}"]`);
        const f = el?.querySelector<HTMLElement>('.panel-bub-t');
        if (f) f.style.setProperty('--f', String(Math.min(1, left(ctx, o) / Math.max(1, o.expiresAt - o.createdAt))));
      }
      return;
    }
    sig = key;
    strip.replaceChildren();
    const shown = list.slice(0, 3);
    for (const o of shown) {
      const ok = canFulfill(st.sys.bag, o);
      const b = h('button', 'panel-bub' + (o.rush ? ' rush' : '') + (ok ? ' ok' : ''));
      b.type = 'button';
      b.dataset.id = String(o.id);
      b.setAttribute('aria-label', `订单:${wantName(o.want)} ${o.qty} 个${o.rush ? ',加急' : ''}${ok ? ',可以交付' : ''}`);
      b.append(
        avatar(o.customer, 34),
        h('span', 'panel-bub-w', wantIcon(o, 24), h('b', null, `×${o.qty}`)),
        ...(o.rush ? [h('i', 'panel-bub-rush', '急')] : []),
        h('span', 'panel-bub-t'),
      );
      b.querySelector<HTMLElement>('.panel-bub-t')?.style.setProperty('--f', String(Math.min(1, left(ctx, o) / Math.max(1, o.expiresAt - o.createdAt))));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        claim(o, b);
      });
      strip.append(b);
    }
    if (list.length > shown.length) {
      const m = btn(`+${list.length - shown.length}`, 'ghost panel-bub-more', () => openOrders());
      strip.append(m);
    }
    onChange();
  }

  function openOrders(): void {
    const sheet = openSheet(ctx, { id: 'panel-orders', title: '订单', cls: 'panel-orders-sheet', onClose: () => (listRefresh = null) });
    const draw = (): void => {
      const st = ctx.getState();
      const sys = st.sys;
      sheet.body.replaceChildren();
      const bag = h('div', 'panel-bag');
      bag.append(h('b', null, '珍藏篮'));
      const have = APPLE_KINDS.filter((k) => (sys?.bag?.[k] ?? 0) > 0);
      if (!have.length) bag.append(h('span', 'panel-note', '空的。摇出来的苹果,会样本一样留一个。'));
      for (const k of have) bag.append(h('span', 'panel-chip', appleCanvas(k, 22), `×${sys.bag[k]}`));
      sheet.body.append(bag);
      const list = sys?.orders?.list ?? [];
      if (!list.length) sheet.body.append(h('div', 'panel-empty', EMPTY.orders));
      for (const o of list) {
        const ok = canFulfill(sys.bag, o);
        const row = h('div', 'panel-order' + (o.rush ? ' rush' : ''));
        const info = h(
          'div',
          'panel-order-i',
          h('b', null, `${wantName(o.want)} ×${o.qty}`, o.rush ? h('i', 'panel-bub-rush', '加急') : null),
          h('span', 'panel-note', `奖励约 ${Math.round(o.rewardSec)} 秒的收入 · 剩 `, h('span', 'panel-ot', fmtT(left(ctx, o)))),
        );
        row.dataset.id = String(o.id);
        const go = btn(ok ? '交付' : `差 ${short(ctx, o)}`, ok ? 'red' : 'ghost', () => claim(o));
        go.disabled = !ok;
        row.append(avatar(o.customer, 44), wantIcon(o, 34), info, go);
        sheet.body.append(row);
      }
      sheet.body.append(h('p', 'panel-note panel-order-foot', `已完成 ${sys?.orders?.done ?? 0} 单。没有惩罚,过期了顾客就走。`));
    };
    draw();
    listRefresh = draw;
    const newest = Math.max(0, ...(ctx.getState().sys?.orders?.list ?? []).map((o) => o.id));
    prefs.ordersSeenId = Math.max(prefs.ordersSeenId, newest);
    savePrefs(ctx, prefs);
    onChange();
  }

  function openOfferPanel(): void {
    const st = ctx.getState();
    const open = offerOpen(st.source.tier, st.route.tier) && ctx.actions?.offer;
    const sheet = openSheet(ctx, { id: 'panel-offer', title: TERMS.offer, cls: 'panel-offer-sheet' });
    if (!open) {
      sheet.body.append(
        h('div', 'panel-empty', '献果还没开放。', h('br'), '等城市和货船都有了,会有人来收。'),
        h('p', 'panel-note', TERMS.offerHint),
      );
      return;
    }
    const coinsNow = (): number => Math.max(0, Math.floor(ctx.getState().coins));
    let pct = 25;
    const sub = h('p', 'panel-offer-sub', TERMS.offerHint);
    const have = h('div', 'panel-offer-have');
    const range = h('input', 'panel-range') as HTMLInputElement;
    range.type = 'range';
    range.min = '5';
    range.max = '100';
    range.step = '5';
    range.value = String(pct);
    range.setAttribute('aria-label', '献出比例');
    const out = h('div', 'panel-offer-out');
    const result = h('p', 'panel-offer-res');
    result.setAttribute('aria-live', 'polite');
    const go = btn('献出', 'red', () => {
      const W = Math.floor((coinsNow() * pct) / 100);
      if (W <= 0) return;
      const r = ctx.actions?.offer?.(W);
      if (r) {
        sfx(ctx, 'orderDone');
        result.textContent = `${TOAST.offered} 献出 ${fmtNum(r.spent)},折合送出 ${fmtNum(r.apples)} 个。`;
        say(TOAST.offered);
        update();
      }
    });
    const quick = h('div', 'panel-quick');
    for (const p of [25, 50, 100]) {
      quick.append(
        btn(`${p}%`, 'ghost', () => {
          pct = p;
          range.value = String(p);
          update();
        }),
      );
    }
    function update(): void {
      const W = Math.floor((coinsNow() * pct) / 100);
      have.replaceChildren(h('span', null, '现有'), h('b', null, fmtNum(coinsNow())), h('span', 'panel-note', `累计献出 ${fmtNum(ctx.getState().sys?.offer?.coins ?? 0)}`));
      const est = ctx.actions?.offerPreview?.(W);
      out.replaceChildren(h('span', null, `献出 ${pct}%`), h('b', null, fmtNum(W)), ...(est !== undefined ? [h('span', 'panel-note', `≈ 送出 ${fmtNum(est)} 个苹果`)] : []));
      go.disabled = W <= 0;
    }
    range.addEventListener('input', () => {
      pct = Number(range.value);
      update();
    });
    sheet.body.append(sub, have, range, quick, out, h('div', 'panel-foot panel-offer-foot', go), result);
    update();
  }

  render(true);
  return {
    openOrders,
    openOffer: openOfferPanel,
    tick: () => render(),
    unseen() {
      const list = ctx.getState().sys?.orders?.list ?? [];
      return list.filter((o) => o.id > prefs.ordersSeenId).length;
    },
    count: () => ctx.getState().sys?.orders?.list?.length ?? 0,
    destroy: () => strip.remove(),
  };
}
