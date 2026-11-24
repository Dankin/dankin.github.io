// 底栏四张卡 + 老徐按钮。
import { buyExpand, buyHelper, buyUnit, canUpgradeTier, helperCost, nextHints, preview, tierCost, tiersOf, unitCost, type LineId, type Throughput } from '../core/game.ts';
import { HELPER, UNIT_MAX } from '../core/content.ts';
import { LAOXU_LEVELS } from '../content/laoxu.ts';
import { newState, type PinSlot } from '../core/state.ts';
import { bus } from '../core/bus.ts';
import { fmt } from '../ui/format.ts';
import { $, $o, setText, setCls, fmtWait } from './dom.ts';
import { app, hooks, LINE_NAME } from './ctx.ts';
import { toast } from './toasts.ts';
import { persist } from './session.ts';
import { openBranch } from './dialogs.ts';

// ───────────── 底栏按钮 ─────────────
export interface Act {
  /** 钉住用的卡位 id */
  key: PinSlot;
  el: HTMLButtonElement;
  nm: HTMLElement;
  pr: HTMLElement;
  gain: HTMLElement;
  /** "约 N 秒回本" */
  pb: HTMLElement;
  /** 图钉 */
  pin: HTMLElement;
  /** 买了它每秒多赚多少手上苹果(升档取两个分支里较好的);未知 0 */
  dInc: number;
  /** 这张卡现在的价钱(满档/最高档 = Infinity) */
  cost: number;
  afford: boolean;
}
/** 图钉(线稿,钉住后 CSS 填红) */
const PIN_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5.5 1.5h5l-.8 4.2 2.3 2.6H4l2.3-2.6zM8 8.3v6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/></svg>';
function mkAct(id: string, key: PinSlot): Act {
  const el = $<HTMLButtonElement>(id);
  const nm = el.querySelector('.nm') as HTMLElement;
  const pr = el.querySelector('.pr') as HTMLElement;
  let gain = el.querySelector('.pv') as HTMLElement | null;
  if (!gain) {
    gain = document.createElement('span');
    gain.className = 'pv';
    el.insertBefore(gain, pr);
  }
  const pb = document.createElement('span');
  pb.className = 'pb';
  el.insertBefore(pb, pr.nextSibling);
  const pin = document.createElement('span');
  pin.className = 'pin';
  pin.setAttribute('role', 'button');
  pin.setAttribute('aria-pressed', 'false');
  pin.setAttribute('aria-label', '钉住这个目标');
  pin.innerHTML = PIN_SVG;
  el.append(pin);
  return { key, el, nm, pr, gain, pb, pin, dInc: 0, cost: Infinity, afford: false };
}

export let btn: { sb: Act; su: Act; rb: Act; ru: Act };

const buyMode: Record<LineId, 'unit' | 'expand' | 'full'> = { source: 'unit', route: 'unit' };
const expandSeen: Record<string, boolean> = {};

export function renderAct(line: LineId, buy: Act, up: Act, hints: ReturnType<typeof nextHints>, th: Throughput): void {
  const s = app.state;
  const L = s[line];
  const T = tiersOf(line);
  const h = hints[line];

  // 买卡:+1 单位;单位够数时变成"扩建"(划算得多,先买它);单位满档又没有扩建时显示已满
  const e = h.expand;
  if (e && e.ready) {
    buyMode[line] = 'expand';
    buy.cost = e.cost; buy.afford = e.affordable;
    setText(buy.nm, `${e.name} ${T[L.tier].name}`);
    setText(buy.pr, fmt(e.cost));
    const pv = preview(s, { kind: 'expand', line });
    buy.dInc = pv.incomeDelta;
    setText(buy.gain, pv.plain);
    setCls(buy.el, { can: e.affordable, no: !e.affordable, max: false, bn: hints.suggest === line && th.bottleneck !== 'balanced' });
    buy.el.disabled = false;
    buy.el.setAttribute('aria-label', `${LINE_NAME[line]}:${e.name}${T[L.tier].name},${fmt(e.cost)} 苹果`);
  } else if (h.unit.full) {
    buyMode[line] = 'full';
    buy.cost = Infinity; buy.afford = false; buy.dInc = 0;
    setText(buy.nm, `已满 ${UNIT_MAX} ${T[L.tier].unit}`);
    setText(buy.pr, '');
    setText(buy.gain, '');
    setCls(buy.el, { can: false, no: false, max: true, bn: false });
    buy.el.disabled = true;
  } else {
    buyMode[line] = 'unit';
    const cost = unitCost(s, line);
    const can = s.coins >= cost;
    buy.cost = cost; buy.afford = can;
    setText(buy.nm, `+1 ${T[L.tier].unit}`);
    setText(buy.pr, fmt(cost));
    const pv = preview(s, { kind: 'unit', line });
    buy.dInc = pv.incomeDelta;
    setText(buy.gain, pv.plain);
    setCls(buy.el, { can, no: !can, max: false, bn: hints.suggest === line && th.bottleneck !== 'balanced' });
    buy.el.disabled = false;
    buy.el.setAttribute('aria-label', `${LINE_NAME[line]}:再加一个${T[L.tier].unit},${fmt(cost)} 苹果`);
  }
  setCls(buy.gain, { up: true, zero: false });
  if (e && e.ready && !expandSeen[line + L.tier + e.name]) {
    expandSeen[line + L.tier + e.name] = true;
    if (app.state.delivered > 0) toast(`${LINE_NAME[line]}${T[L.tier].name}可以「${e.name}」了,点那张卡。`, 3400);
  }

  // 升档
  const tc = tierCost(s, line);
  if (tc === null) {
    up.cost = Infinity; up.afford = false; up.dInc = 0;
    setText(up.nm, `已是最高档:${T[L.tier].name}`);
    setText(up.pr, '');
    setText(up.gain, '');
    setCls(up.el, { can: false, no: false, max: true, 'has-branch': false });
    up.el.disabled = true;
    return;
  }
  up.el.disabled = false;
  const canUp = s.coins >= tc;
  up.cost = tc; up.afford = canUp;
  up.dInc = Math.max(preview(s, { kind: 'tier', line, branch: 0 }).incomeDelta, preview(s, { kind: 'tier', line, branch: 1 }).incomeDelta);
  const tp = h.tier ? h.tier.flowPct : 0;
  setText(up.nm, `升级 ${T[L.tier + 1].name}`);
  setText(up.pr, fmt(tc));
  setText(up.gain, T[L.tier + 1].pair || '二选一');
  setCls(up.gain, { up: canUp, zero: !canUp });
  setCls(up.el, { can: canUp, no: !canUp, max: false, 'has-branch': true });
  up.el.setAttribute('aria-label', `${LINE_NAME[line]}:升级为${T[L.tier + 1].name},${fmt(tc)} 苹果`);
}

/** 底栏一次只亮 1–2 张:瓶颈卡 + 最便宜能买的卡(都买不起就亮最便宜的那张当目标)。其余变灰、不显示价格。首购前买不起的卡先藏起来。 */
const INITIAL_UNITS = (() => {
  const n = newState(0);
  return n.source.units.reduce((a, b) => a + b, 0) + n.route.units.reduce((a, b) => a + b, 0);
})();
/** 当前"最想买"的东西:钉住的卡 > 瓶颈卡 > 最便宜的卡。水位条按它的价钱画 */
export interface Goal {
  act: Act;
  name: string;
  cost: number;
  pinned: boolean;
}
let goal: Goal | null = null;
export const getGoal = (): Goal | null => goal;

/** 秒 → "约 N 秒回本"文案与档位(<60 绿、<300 黄、其余红"长线") */
export function paybackText(sec: number): { text: string; tone: 'g' | 'y' | 'r' } {
  if (sec < 60) return { text: `约${fmtWait(sec)}回本`, tone: 'g' };
  if (sec < 300) return { text: `约${fmtWait(sec)}回本`, tone: 'y' };
  return { text: '长线', tone: 'r' };
}
/** 买 cost 会让 target 价的目标晚几秒(按当前每秒收入;买它自己带来的增收忽略) */
export function goalDelaySec(coins: number, income: number, cost: number, target: number): number {
  if (!(income > 0)) return 0;
  const need = (c: number): number => Math.max(0, target - c);
  return (need(coins - cost) - need(coins)) / income;
}

export function renderFocus(th: Throughput): void {
  const acts = [btn.sb, btn.su, btn.rb, btn.ru];
  const s = app.state;
  const bought = s.source.units.reduce((a, b) => a + b, 0) + s.route.units.reduce((a, b) => a + b, 0) > INITIAL_UNITS || s.source.tier > 0 || s.route.tier > 0 || s.helperLevel > 0;
  const live = acts.filter((a) => isFinite(a.cost));
  let cheapest: Act | null = null;
  for (const a of live) if (a.afford && (!cheapest || a.cost < cheapest.cost)) cheapest = a;
  if (!cheapest) for (const a of live) if (!cheapest || a.cost < cheapest.cost) cheapest = a;
  for (const a of acts) {
    const lit = !isFinite(a.cost) || a === cheapest || a.el.classList.contains('bn') || a.key === s.pin;
    // 首购前只露出最便宜的那张(买得起才算"可买")
    a.el.hidden = !bought && !lit && !a.afford;
    a.el.classList.toggle('dim', !lit && !a.el.hidden);
    if (!lit && !a.el.hidden && isFinite(a.cost)) setText(a.gain, a.afford ? '' : '再攒攒');
  }

  // 目标:钉住 > 瓶颈卡 > 最便宜
  if (s.pin && !isFinite(acts.find((a) => a.key === s.pin)!.cost)) s.pin = null; // 钉住的东西没了(满档)
  const pinned = s.pin ? acts.find((a) => a.key === s.pin)! : null;
  const bn = live.find((a) => a.el.classList.contains('bn'));
  const g = pinned ?? bn ?? cheapest;
  goal = g && isFinite(g.cost) ? { act: g, name: g.nm.textContent ?? '', cost: g.cost, pinned: !!pinned } : null;

  for (const a of acts) {
    const here = isFinite(a.cost) && !a.el.hidden;
    // 图钉
    const on = s.pin === a.key;
    a.pin.hidden = !here;
    a.pin.classList.toggle('on', on);
    a.pin.setAttribute('aria-pressed', String(on));
    a.el.classList.toggle('goal', !!goal && goal.act === a);
    // 回本
    const pbOn = here && a.dInc > 1e-9 && !a.el.classList.contains('dim');
    if (pbOn) {
      const { text, tone } = paybackText(a.cost / a.dInc);
      setText(a.pb, text);
      a.pb.className = `pb ${tone}`;
    } else setText(a.pb, '');
    // 钉住了别的东西:买它会让目标晚多久
    if (goal?.pinned && goal.act !== a && here && !a.el.classList.contains('dim')) {
      const d = goalDelaySec(s.coins, th.income, a.cost, goal.cost);
      if (d >= 1) {
        setText(a.gain, `买它,目标晚${fmtWait(d)}`);
        setCls(a.gain, { up: false, zero: false });
        a.gain.classList.add('late');
        continue;
      }
    }
    a.gain.classList.remove('late');
  }
}

/** 点图钉:钉住 / 取消 */
export function togglePin(key: PinSlot): void {
  app.state.pin = app.state.pin === key ? null : key;
  persist();
  hooks.render();
}

// ───────────── 老徐(自动摇树)按钮:场景左上角的小按钮,生产档 ≥1 才出现 ─────────────
let helperBtn: HTMLButtonElement;
export function mkHelperBtn(): void {
  const existing = $o<HTMLButtonElement>('btnHelper');
  if (existing) helperBtn = existing;
  else {
    helperBtn = document.createElement('button');
    helperBtn.id = 'btnHelper';
    helperBtn.type = 'button';
    $('scene').append(helperBtn);
  }
  helperBtn.hidden = true;
  helperBtn.addEventListener('click', () => {
    const c0 = app.state.coins;
    if (buyHelper(app.state)) {
      bus.emit({ t: 'buy', line: null, what: 'helper', cost: c0 - app.state.coins });
      app.audio.sfx.buy();
      toast(LAOXU_LEVELS[app.state.helperLevel - 1]?.joke ?? '', 2600);
      persist();
      hooks.render();
    } else {
      const c = helperCost(app.state);
      if (c !== null) toast(`手上的苹果还差 ${fmt(Math.ceil(c - app.state.coins))}。`, 2000);
    }
  });
}
export function renderHelper(hints: ReturnType<typeof nextHints>): void {
  const h = hints.helper;
  const have = app.state.helperLevel;
  if (!h && have === 0) {
    helperBtn.hidden = true;
    return;
  }
  helperBtn.hidden = false;
  const label = h ? `${LAOXU_LEVELS[have]?.card ?? HELPER.name} ${fmt(h.cost)}` : `${LAOXU_LEVELS[have - 1]?.name ?? HELPER.name} · 满级`;
  setText(helperBtn, label);
  setCls(helperBtn, { can: !!h && h.affordable, no: !h || !h.affordable });
  helperBtn.disabled = !h;
  helperBtn.setAttribute('aria-label', label);
}

export function initBar(): void {
  mkHelperBtn();
  btn = { sb: mkAct('btnSrcBuy', 'srcBuy'), su: mkAct('btnSrcUp', 'srcUp'), rb: mkAct('btnRtBuy', 'rtBuy'), ru: mkAct('btnRtUp', 'rtUp') };
  // 买到钉住的那张卡 → 自动取消钉住
  const unpin = (k: PinSlot): void => {
    if (app.state.pin === k) app.state.pin = null;
  };
  bus.on('buy', (e) => {
    if (e.line && (e.what === 'unit' || e.what === 'expand')) unpin(e.line === 'source' ? 'srcBuy' : 'rtBuy');
  });
  bus.on('tier', (e) => unpin(e.line === 'source' ? 'srcUp' : 'rtUp'));
}

// ───────────── 接线 ─────────────
function press(el: HTMLElement): void {
  el.classList.add('pressed');
  setTimeout(() => el.classList.remove('pressed'), 480);
}
function nudge(line: LineId, what: 'unit' | 'tier' | 'expand'): void {
  const h = nextHints(app.state)[line];
  const x = what === 'unit' ? h.unit : what === 'expand' ? h.expand : h.tier;
  if (!x) return;
  const lack = Math.ceil(x.cost - app.state.coins);
  toast(`手上的苹果还差 ${fmt(lack)}${isFinite(x.waitSec) ? `,约 ${fmtWait(x.waitSec)}` : ''}。`, 2400);
}
export function wireBar(): void {
  for (const a of [btn.sb, btn.su, btn.rb, btn.ru]) {
    a.pin.addEventListener('click', (ev) => {
      ev.stopPropagation(); // 别触发"买"
      togglePin(a.key);
    });
  }
  const buy = (line: LineId, a: Act) => () => {
    const mode = buyMode[line];
    if (mode === 'full') return;
    const c0 = app.state.coins;
    if (mode === 'expand' ? buyExpand(app.state, line) : buyUnit(app.state, line)) {
      bus.emit({ t: 'buy', line, what: mode, cost: c0 - app.state.coins });
      if (mode === 'expand') app.audio.sfx.stage();
      else app.audio.sfx.buy();
      press(a.el);
      persist();
      hooks.render();
    } else nudge(line, mode);
  };
  btn.sb.el.addEventListener('click', buy('source', btn.sb));
  btn.rb.el.addEventListener('click', buy('route', btn.rb));
  btn.su.el.addEventListener('click', () => {
    press(btn.su.el);
    openBranch('source');
  });
  btn.ru.el.addEventListener('click', () => {
    press(btn.ru.el);
    openBranch('route');
  });
}
