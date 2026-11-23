// Shake the Apple v4 —— 把新核心(src/core)和新界面(src/ui)接起来。
// 约定:核心只认 State;界面只认 WorldView + DOM id。这里负责:读档/存档、时间推进、渲染到 DOM、各种弹层、提示、事件、结局。
import {
  buyHelper, helperCost, buyUnit, canUpgradeTier, era, chargeLevel, isWon, mods, nextBranches, nextHints, preview, progress, setGate, shake,
  settle, stockFill, throughput, tick, tierCost, tiersOf, unitCost, upgradeTier,
  type ShakeResult, type LineId, type Throughput,
} from './core/game.ts';
import { GATES, GATE_SLOTS, HELPER, ROUTE_TIERS, describeEffect, describeGate, gateDef, type GateId } from './core/content.ts';
import { claimEvent, nextEventGap, pickEvent, type EventKind } from './core/events.ts';
import { BOTTLENECK_TIP, EMPTY_SLOT_TIP, ERA_TOAST, EVENT_TEXT, SHAKE_TEXT, COMBO_TEXT, HELPER_TEXT, GATE_UNLOCK_TOAST, SEALED, awayLine } from './core/copy.ts';
import { SAVE_KEY, GOAL } from './core/constants.ts';
import { exportSave, importSave, load, save, storageWritable } from './core/save.ts';
import { newState, type State } from './core/state.ts';
import { giftOpen } from './core/gift.ts';
import { worldAt } from './core/world.ts';
import { Orchard, EMPTY_WORLD, type WorldView } from './ui/orchard.ts';
import { showEnding } from './ui/ending.ts';
import { fmt } from './ui/format.ts';
import { createAudio } from './audio/bgm.ts';
import './ui/glue.css';
import { attachMotion, enableMotion, motionSupported } from './input/motion.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
/** 可能不存在的节点(UI 设计师会增删) */
const $o = <T extends HTMLElement = HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;
const kv = localStorage;

// ───────────── 调试参数 ─────────────
// ?debug=1 出调试面板(设置里);?speed=N 把游戏时间加速 N 倍(1..3600);?date=YYYY-MM-DD 假装今天是哪天(只影响 12/24 的礼物门)
const qs = new URLSearchParams(location.search);
const DEBUG = qs.has('debug') || qs.has('speed');
let speed = qs.has('speed') ? Math.max(1, Math.min(3600, Number(qs.get('speed')) || 1)) : 1;
const dateOffset = (() => {
  const d = qs.get('date');
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return 0;
  const t = new Date(d + 'T12:00:00').getTime();
  return Number.isFinite(t) ? t - Date.now() : 0;
})();
/** 日历意义上的"现在"(只给礼物门用)。游戏内时间走 state.playSec,与它无关。 */
const nowMs = (): number => Date.now() + dateOffset;

// ───────────── 全局状态 ─────────────
let state: State = newState(Date.now());
let canSave = true;
let readOnly = false;
let won = false;
const audio = createAudio();

// ───────────── 提示(toast 队列) ─────────────
const toastEl = $('toast');
const toastQ: string[] = [];
let toastBusy = false;
function toast(msg: string, ms = 3200): void {
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

// ───────────── 存档 ─────────────
function persist(): void {
  if (readOnly || !canSave) return;
  save(kv, state, Date.now());
}

/** 把"离开期间"补算上。短离开按 tick,长离开按流体近似(core.settle 决定)。 */
function catchUp(showToast: boolean): void {
  const away = Date.now() - state.lastSeen;
  if (away < 3000) {
    state.lastSeen = Date.now();
    return;
  }
  const r = settle(state, away);
  state.lastSeen = Date.now();
  if (showToast && r.seconds >= 30 && r.delivered > 0) toast(`${awayLine(away / 60000)} 送达了 ${fmt(Math.floor(r.delivered))} 个。`, 4200);
}

// ───────────── 主题 / 声音 ─────────────
const DARK_MQ = matchMedia('(prefers-color-scheme: dark)');
const THEME_LABEL = { auto: '主题:自动', light: '主题:浅色', dark: '主题:深色' } as const;
function applyTheme(): void {
  const m = state.settings.dark;
  const d = m === 'dark' || (m === 'auto' && DARK_MQ.matches);
  orchard.dark = d;
  document.documentElement.classList.toggle('dark', d);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', d ? '#16171b' : '#f4f1ea');
  $('btnTheme').textContent = THEME_LABEL[m];
}
function applySound(): void {
  const on = state.settings.sound;
  audio.setMusic(on);
  audio.setSfx(on);
  $('btnSound').textContent = on ? '声音:开' : '声音:关';
}

// ───────────── 画面所需数据 ─────────────
function buildWorld(th: Throughput): WorldView {
  const s = state;
  const m = mods(s);
  const rt = s.route;
  return {
    ...EMPTY_WORLD,
    srcTier: s.source.tier,
    srcUnits: s.source.units.slice(),
    srcBranch: s.source.branch.slice(),
    rtTier: rt.tier,
    rtVehicles: Math.max(1, Math.round(rt.units[rt.tier])),
    rtBranch: rt.branch[rt.tier],
    gates: s.gates.map((g) => (g === 'red' ? 'string' : g)),
    gatesUnlocked: GATE_SLOTS,
    stock01: stockFill(s),
    produce: th.produce,
    carry: th.carry,
    shake: Math.min(1, chargeLevel(s, m)), // 摇劲
    combo: s.combo,
    perTrip: ROUTE_TIERS[rt.tier].cap * m.cap,
  };
}

const fmtWait = (sec: number): string =>
  !isFinite(sec) ? '很久' : sec < 60 ? `${Math.max(1, Math.ceil(sec))}秒` : sec < 3600 ? `${Math.ceil(sec / 60)}分钟` : sec < 86400 ? `${(sec / 3600).toFixed(1)}小时` : '很久';
const fmtPct = (p: number): string => `+${p < 0.1 ? (p * 100).toFixed(1) : Math.round(p * 100)}%`;

// ───────────── 底栏按钮 ─────────────
interface Act {
  el: HTMLButtonElement;
  nm: HTMLElement;
  pr: HTMLElement;
  gain: HTMLElement;
}
function mkAct(id: string): Act {
  const el = $<HTMLButtonElement>(id);
  const nm = el.querySelector('.nm') as HTMLElement;
  const pr = el.querySelector('.pr') as HTMLElement;
  let gain = el.querySelector('.pv') as HTMLElement | null;
  if (!gain) {
    gain = document.createElement('span');
    gain.className = 'pv';
    el.insertBefore(gain, pr);
  }
  return { el, nm, pr, gain };
}
const setText = (el: HTMLElement, t: string): void => {
  if (el.textContent !== t) el.textContent = t;
};
function setCls(el: HTMLElement, on: Record<string, boolean>): void {
  for (const k in on) el.classList.toggle(k, on[k]);
}

let btn: { sb: Act; su: Act; rb: Act; ru: Act };
const LINE_NAME: Record<LineId, string> = { source: '生产线', route: '运输线' };

function renderAct(line: LineId, buy: Act, up: Act, hints: ReturnType<typeof nextHints>, th: Throughput): void {
  const s = state;
  const L = s[line];
  const T = tiersOf(line);
  const h = hints[line];

  // +1 单位
  const cost = unitCost(s, line);
  const can = s.coins >= cost;
  setText(buy.nm, `+1 ${T[L.tier].unit}`);
  setText(buy.pr, fmt(cost));
  const pct = h.unit.flowPct;
  const help = pct >= 0.005;
  const waitTxt = can || !isFinite(h.unit.waitSec) ? '' : ` · 约${fmtWait(h.unit.waitSec)}`;
  setText(buy.gain, (help ? `${fmtPct(pct)} 送达` : th.bottleneck === (line === 'source' ? 'carry' : 'produce') ? '卡在另一边,先扩那边' : '暂时用不上') + waitTxt);
  setCls(buy.gain, { up: help, zero: !help });
  setCls(buy.el, { can, no: !can, bn: hints.suggest === line && th.bottleneck !== 'balanced' });
  buy.el.setAttribute('aria-label', `${LINE_NAME[line]}:再加一个${T[L.tier].unit},${fmt(cost)} 果钱`);

  // 升档
  const tc = tierCost(s, line);
  if (tc === null) {
    setText(up.nm, `已是最高档:${T[L.tier].name}`);
    setText(up.pr, '');
    setText(up.gain, '');
    setCls(up.el, { can: false, no: false, max: true, 'has-branch': false });
    up.el.disabled = true;
    return;
  }
  up.el.disabled = false;
  const canUp = s.coins >= tc;
  const tp = h.tier ? h.tier.flowPct : 0;
  setText(up.nm, `升级 ${T[L.tier + 1].name}`);
  setText(up.pr, fmt(tc));
  const wt = canUp || !h.tier || !isFinite(h.tier.waitSec) ? '' : ` · 约${fmtWait(h.tier.waitSec)}`;
  setText(up.gain, (tp >= 0.005 ? `${fmtPct(tp)} 送达` : '二选一') + wt);
  setCls(up.gain, { up: tp >= 0.005, zero: tp < 0.005 });
  setCls(up.el, { can: canUp, no: !canUp, max: false, 'has-branch': true });
  up.el.setAttribute('aria-label', `${LINE_NAME[line]}:升级为${T[L.tier + 1].name},${fmt(tc)} 果钱`);
}

// ───────────── 老徐(自动摇树)按钮:场景左上角的小按钮,生产档 ≥1 才出现 ─────────────
let helperBtn: HTMLButtonElement;
function mkHelperBtn(): void {
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
    if (buyHelper(state)) {
      audio.sfx.buy();
      toast(HELPER_TEXT.hired, 2600);
      persist();
      renderAll();
    } else {
      const c = helperCost(state);
      if (c !== null) toast(`果钱还差 ${fmt(Math.ceil(c - state.coins))}。`, 2000);
    }
  });
}
function renderHelper(hints: ReturnType<typeof nextHints>): void {
  const h = hints.helper;
  const have = state.helpers;
  if (!h && have === 0) {
    helperBtn.hidden = true;
    return;
  }
  helperBtn.hidden = false;
  const label = h ? `${HELPER.name} ×${have} · 再雇一位 ${fmt(h.cost)}` : `${HELPER.name} ×${have} · 满员`;
  setText(helperBtn, label);
  setCls(helperBtn, { can: !!h && h.affordable, no: !h || !h.affordable });
  helperBtn.disabled = !h;
  helperBtn.setAttribute('aria-label', label);
}

// ───────────── 关卡槽 ─────────────
let gatesSeen = 0;
let tipEmptyShown = false;
function renderGates(): void {
  if (!$o('gate0')) return; // 关卡槽改画在场景里了
  const s = state;
  const hasFree = s.gatesUnlocked.some((g) => !s.gates.includes(g));
  const noneYet = s.gates.every((g) => g === null);
  const fresh = s.gatesUnlocked.length > gatesSeen && hasFree;
  let first = true;
  for (let i = 0; i < GATE_SLOTS; i++) {
    const el = $(`gate${i}`);
    const id = s.gates[i];
    const nm = el.querySelector('.nm') as HTMLElement;
    setText(nm, id ? gateDef(id).name : '+');
    const empty = id === null;
    const pulse = empty && first && hasFree && (noneYet || fresh);
    if (empty) first = false;
    setCls(el, { empty, on: !empty, locked: false, can: pulse });
    el.setAttribute('aria-label', id ? `关卡槽 ${i + 1}:${gateDef(id).name}` : `关卡槽 ${i + 1}:空`);
  }
}

const gp = $('gatePick');
let gateSlot = -1;
function openGate(slot: number): void {
  if (!gp.hidden && gateSlot === slot) {
    gp.hidden = true;
    return;
  }
  gateSlot = slot;
  gatesSeen = state.gatesUnlocked.length;
  $('gatePickTitle').textContent = `第 ${slot + 1} 槽 · 放什么?`;
  const box = $('gateOpts');
  box.replaceChildren();
  const mk = (id: GateId | null): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt';
    const t = document.createElement('b');
    const d = document.createElement('span');
    b.append(t, d);
    if (id === null) {
      t.textContent = '空着';
      d.textContent = '拿下这个槽里的道具';
      b.classList.add('none');
      if (state.gates[slot] === null) b.classList.add('on');
    } else {
      const g = gateDef(id);
      t.textContent = g.name;
      b.title = g.joke;
      const sum = state.source.tier + state.route.tier;
      if (!state.gatesUnlocked.includes(id)) {
        d.textContent = `两条线档位合计 ${g.unlockAt} 解锁`;
        b.classList.add('no');
        b.disabled = true;
      } else {
        const p = preview(state, { kind: 'gate', slot, id });
        const dp = p.incomePct;
        const here = state.gates[slot] === id;
        const other = state.gates.indexOf(id);
        const delta = Math.abs(dp) >= 0.005 ? ` · 收入 ${dp > 0 ? '+' : '-'}${Math.round(Math.abs(dp) * 100)}%` : '';
        d.textContent = describeGate(g) + (here ? '' : delta) + (!here && other >= 0 ? ` · 与第 ${other + 1} 槽互换` : '');
        if (here) b.classList.add('on');
      }
      void sum;
    }
    b.addEventListener('click', () => {
      if (id !== null && !state.gatesUnlocked.includes(id)) return;
      if (setGate(state, slot, id)) {
        audio.sfx.coin();
        gp.hidden = true;
        persist();
        renderAll();
        if (id !== null) orchard.floatText(gateDef(id).name, orchard.worldPos().gates[slot][0], orchard.worldPos().gates[slot][1] - 26);
      }
    });
    return b;
  };
  box.append(mk(null));
  for (const g of GATES) box.append(mk(g.id));
  gp.hidden = false;
}

// ───────────── 升档:分支选择 ─────────────
const bp = $('branchPick');
let branchLine: LineId = 'source';
function fillBranch(): void {
  const bs = nextBranches(state, branchLine);
  if (!bs) {
    bp.hidden = true;
    return;
  }
  const T = tiersOf(branchLine);
  const t = T[state[branchLine].tier + 1];
  const c = tierCost(state, branchLine) ?? 0;
  const can = state.coins >= c;
  $('branchTitle').textContent = `升级:${t.name}`;
  $('branchSub').textContent = `${LINE_NAME[branchLine]} · 二选一,选了就定了 · ${fmt(c)} 果钱`;
  bs.forEach((b, i) => {
    const el = $(`branch${i}`);
    setText(el.querySelector('.nm') as HTMLElement, b.name);
    const desc = el.querySelector('.desc') as HTMLElement;
    const line1 = describeEffect(b.effect);
    const key = line1 + '|' + b.joke;
    if (desc.dataset.k !== key) {
      desc.dataset.k = key;
      const a = document.createElement('span');
      a.textContent = line1;
      a.style.color = 'var(--ink)';
      const br = document.createElement('br');
      const j = document.createElement('span');
      j.textContent = b.joke;
      desc.replaceChildren(a, br, j);
    }
    const p = preview(state, { kind: 'tier', line: branchLine, branch: i as 0 | 1 });
    setText(el.querySelector('.pr') as HTMLElement, `${p.flowPct >= 0.005 ? `送达 ${fmtPct(p.flowPct)} · ` : ''}${fmt(c)}`);
    setCls(el, { can, no: !can });
  });
}
function openBranch(line: LineId): void {
  if (!nextBranches(state, line)) return;
  branchLine = line;
  fillBranch();
  bp.hidden = false;
}
function chooseBranch(i: 0 | 1): void {
  if (!canUpgradeTier(state, branchLine)) {
    const c = tierCost(state, branchLine) ?? 0;
    toast(`果钱还差 ${fmt(Math.ceil(c - state.coins))}。`);
    return;
  }
  const line = branchLine;
  const r = upgradeTier(state, line, i);
  if (!r) return;
  bp.hidden = true;
  audio.sfx.stage();
  document.body.classList.add('stageup');
  setTimeout(() => document.body.classList.remove('stageup'), 1300);
  toast((ERA_TOAST[line] as readonly string[])[r.tier] ?? '', 3800);
  for (const g of r.newGates) toast(GATE_UNLOCK_TOAST(gateDef(g).name), 3800);
  persist();
  renderAll();
}

// ───────────── 提示:瓶颈 / 空槽 ─────────────
let bnKind: Throughput['bottleneck'] = 'balanced';
let bnSince = 0;
let bnTipAt = -1e9;
function bottleneckTip(th: Throughput): void {
  const t = state.playSec;
  if (th.bottleneck !== bnKind) {
    bnKind = th.bottleneck;
    bnSince = t;
    return;
  }
  if (bnKind === 'balanced' || state.delivered < 20) return;
  if (t - bnSince >= 20 && t - bnTipAt >= 90 && !toastBusy && !toastQ.length && bp.hidden && gp.hidden) {
    bnTipAt = t;
    toast(BOTTLENECK_TIP[bnKind], 4200);
  }
}

// ───────────── 事件(小鸟 / 牛顿 / 流星) ─────────────
let nextEventAt = 0;
function maybeEvent(): void {
  if (state.playSec < nextEventAt || orchard.eventActive() || document.hidden || !bp.hidden) return;
  nextEventAt = state.playSec + nextEventGap();
  const kind: EventKind = pickEvent(worldAt(state.playSec).isNight);
  orchard.spawnEvent(kind, (hit) => {
    if (!hit) return;
    const r = claimEvent(state, kind);
    audio.sfx.golden();
    orchard.floatText(r.apples > 0 ? `+${fmt(r.apples)}` : '灵感!');
    toast(EVENT_TEXT[kind].claim, 3600);
    persist();
    renderAll();
  });
  toast(EVENT_TEXT[kind].appear, 2800);
}

// ───────────── 手感:摇树 / 苹果噼里啪啦掉下来 ─────────────
let lastShakeText = 0;
let lastShakeSfx = 0;
let tapN = 0;
function onShakeResult(r: ShakeResult): void {
  if (!r.ok) return;
  const now = performance.now();
  if (r.combo > 0 && r.combo % 8 === 0) {
    orchard.burst(2 + Math.min(4, r.combo >> 3));
    audio.sfx.bonk();
    if (now - lastShakeText > 700) {
      lastShakeText = now;
      orchard.floatText(COMBO_TEXT[(r.combo >> 3) % COMBO_TEXT.length]);
    }
  } else if (++tapN % 17 === 0 && now - lastShakeText > 1200) {
    lastShakeText = now;
    orchard.floatText(SHAKE_TEXT[tapN % SHAKE_TEXT.length]);
  }
  if (now - lastShakeSfx >= 110) {
    lastShakeSfx = now;
    audio.sfx.shake();
  }
}
/** 摇一下树(点画布 / 空格 / 以后手机摇一摇都走这里) */
function doShake(strength = 1): void {
  const r = shake(state);
  if (r.ok) orchard.poke(Math.max(1, Math.round(1 + strength)));
  onShakeResult(r);
}

// ───────────── 设置里的精确数字(顶栏只放 已送出) ─────────────
let exactRows: HTMLElement[] | null = null;
function renderExact(th: Throughput): void {
  const box = $o('exactApples');
  if (!box) return;
  if (!exactRows) {
    exactRows = [0, 1, 2, 3].map(() => box.appendChild(document.createElement('div')));
  }
  const n = (v: number): string => Math.floor(v).toLocaleString('en-US');
  const s = state;
  setText(exactRows[0], `已送出 ${n(s.delivered)} / ${n(GOAL)}`);
  setText(exactRows[1], `果钱 ${n(s.coins)}`);
  setText(exactRows[2], `每秒送达 ${fmt(th.flow)} · 每秒收入 ${fmt(th.income)}`);
  setText(exactRows[3], `摇了 ${n(s.shakes)} 下 · 老徐 ${s.helpers} 位`);
}

// ───────────── 渲染(每 0.25 秒一次,以及操作后立即) ─────────────
let lastApples = '';
let lastEra = -1;
function renderAll(): void {
  const s = state;
  const th = throughput(s);
  const hints = nextHints(s);

  // 顶栏:已送出 / 目标;果钱 + 每秒送达
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
  const rateEl = $o('rate');
  if (rateEl) setText(rateEl, `果钱 ${fmt(Math.floor(s.coins))} · 每秒 ${fmt(th.flow)}`);
  renderExact(th);
  const pct = progress(s) * 100;
  $('goalBar').style.width = `${pct.toFixed(2)}%`;
  $('goalWrap').setAttribute('aria-valuenow', pct.toFixed(1));
  $('goalWrap').title = `已送出 ${Math.floor(s.delivered).toLocaleString('en-US')} / ${GOAL.toLocaleString('en-US')}`;

  renderAct('source', btn.sb, btn.su, hints, th);
  renderAct('route', btn.rb, btn.ru, hints, th);
  renderGates();
  renderHelper(hints);
  if (!bp.hidden) fillBranch();

  orchard.setWorld(buildWorld(th));
  const e = era(s);
  if (e !== lastEra) {
    lastEra = e;
    audio.setIntensity(Math.min(5, Math.round(e / 2)));
  }
  if (DEBUG) renderDebugInfo(th);
  if (!tipEmptyShown && s.delivered >= 60 && s.gates.every((g) => g === null) && toastQ.length === 0 && !toastBusy) {
    tipEmptyShown = true;
    toast(EMPTY_SLOT_TIP, 4200);
  }
  bottleneckTip(th);
  maybeEvent();
  if (!won && isWon(s)) win();
}

// ───────────── 结局 ─────────────
function win(): void {
  won = true;
  persist();
  audio.sfx.fanfare();
  showEnding(
    { elapsedMs: Math.max(0, (state.wonAt ?? state.playSec) * 1000), clicks: state.shakes },
    () => {
      /* 回到果园:游戏继续 */
    },
    () => resetGame(),
  );
  const card = document.querySelector('#ending .card');
  if (!card) return;
  const box = document.createElement('div');
  if (!giftOpen(nowMs())) {
    box.id = 'sealed';
    box.className = 'sealed';
    box.style.cssText = 'margin:14px 0;padding:10px;border:1px dashed #666;border-radius:8px;font-size:14px';
    for (const line of SEALED) {
      const p = document.createElement('p');
      p.textContent = line;
      box.append(p);
    }
  } else {
    // 礼物位:12 月 24 日起开放,内容以后放这里。
    box.id = 'giftSlot';
  }
  card.insertBefore(box, card.lastElementChild);
}

function resetGame(): void {
  state = newState(Date.now());
  readOnly = false;
  afterStateReplaced();
  persist();
}
function afterStateReplaced(): void {
  won = isWon(state);
  lastApples = '';
  lastEra = -1;
  gatesSeen = state.gates.some((g) => g !== null) ? state.gatesUnlocked.length : 0;
  bnKind = 'balanced';
  bnSince = state.playSec;
  bnTipAt = state.playSec;
  nextEventAt = state.playSec + nextEventGap();
  gp.hidden = true;
  bp.hidden = true;
  applyTheme();
  applySound();
  orchard.reducedMotion = state.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderAll();
}

// ───────────── 调试面板 ─────────────
let dbgInfo: HTMLElement | null = null;
let dbgSpeed: HTMLElement | null = null;
function setupDebug(): void {
  const box = $('debug');
  const mk = (label: string, fn: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'min-height:44px;min-width:48px;margin:2px;padding:0 8px;border:1.5px solid var(--ink);border-radius:10px;background:var(--f0);font:inherit;font-size:12px';
    b.addEventListener('click', fn);
    return b;
  };
  const row = document.createElement('div');
  dbgSpeed = document.createElement('div');
  dbgSpeed.id = 'dbgSpeed';
  dbgSpeed.textContent = `×${speed}`;
  for (const v of [1, 10, 60, 600, 3600]) {
    row.append(
      mk(`×${v}`, () => {
        speed = v;
        dbgSpeed!.textContent = `×${speed}`;
      }),
    );
  }
  const jump = (sec: number) => () => {
    tick(state, sec, Date.now());
    renderAll();
  };
  row.append(mk('+10分', jump(600)), mk('+1小时', jump(3600)));
  row.append(
    mk('+10亿果钱', () => {
      state.coins += 1e9;
      renderAll();
    }),
  );
  dbgInfo = document.createElement('pre');
  dbgInfo.id = 'dbgInfo';
  dbgInfo.style.margin = '4px 0 0';
  box.append(row, dbgSpeed, dbgInfo);
}
function renderDebugInfo(th: Throughput): void {
  if (!dbgInfo) return;
  dbgInfo.textContent = `flow ${th.flow.toPrecision(3)}/s produce ${th.produce.toPrecision(3)} carry ${th.carry.toPrecision(3)} ${th.bottleneck}\nincome ${th.income.toPrecision(3)}/s era ${era(state)} play ${Math.floor(state.playSec)}s`;
}

// ───────────── 接线 ─────────────
function press(el: HTMLElement): void {
  el.classList.add('pressed');
  setTimeout(() => el.classList.remove('pressed'), 480);
}
function nudge(line: LineId, what: 'unit' | 'tier'): void {
  const h = nextHints(state)[line];
  const x = what === 'unit' ? h.unit : h.tier;
  if (!x) return;
  const lack = Math.ceil(x.cost - state.coins);
  toast(`果钱还差 ${fmt(lack)}${isFinite(x.waitSec) ? `,约 ${fmtWait(x.waitSec)}` : ''}。`, 2400);
}
function wire(): void {
  orchard.onShake = (st) => doShake(st ?? 1);
  orchard.onGate = (slot) => openGate(slot);

  const buy = (line: LineId, a: Act) => () => {
    if (buyUnit(state, line)) {
      audio.sfx.buy();
      press(a.el);
      persist();
      renderAll();
    } else nudge(line, 'unit');
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
  for (let i = 0; i < GATE_SLOTS; i++) $o(`gate${i}`)?.addEventListener('click', () => openGate(i));
  $('branch0').addEventListener('click', () => chooseBranch(0));
  $('branch1').addEventListener('click', () => chooseBranch(1));

  // 键盘空格:由 Orchard 内部监听,触发 onShake

  // 尺寸:画布跟随 #scene(横竖屏切换、地址栏伸缩都会变)
  addEventListener('resize', () => orchard.resize());
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => orchard.resize()).observe($('scene'));

  // 声音:默认关;第一次触摸/按键时解锁 AudioContext
  armAudioUnlock();
  $('btnSound').addEventListener('click', () => {
    state.settings.sound = !state.settings.sound;
    audio.unlock();
    applySound();
    persist();
  });
  $('btnTheme').addEventListener('click', () => {
    const order = ['auto', 'light', 'dark'] as const;
    state.settings.dark = order[(order.indexOf(state.settings.dark) + 1) % 3];
    applyTheme();
    persist();
  });
  DARK_MQ.addEventListener?.('change', () => {
    if (state.settings.dark === 'auto') applyTheme();
  });

  // 前后台 / 关页
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persist();
    else catchUp(true);
  });
  addEventListener('pagehide', persist);
  addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) catchUp(true);
  });
  // 多标签页:别的标签页写了存档,本页停止保存,避免互相覆盖
  addEventListener('storage', (e) => {
    if (e.key === SAVE_KEY && !readOnly) {
      readOnly = true;
      toast('检测到另一个标签页在玩,本页已暂停保存。刷新后继续。', 5000);
    }
  });

  $('btnExport').addEventListener('click', async () => {
    const text = exportSave(state);
    try {
      await navigator.clipboard.writeText(text);
      toast('存档已复制到剪贴板。');
    } catch {
      prompt('复制下面的存档文本:', text);
    }
  });
  $('btnImport').addEventListener('click', () => {
    const text = prompt('粘贴存档文本:');
    if (!text) return;
    const s = importSave(text);
    if (!s) return toast('存档无效。');
    state = s;
    readOnly = false;
    catchUp(false);
    afterStateReplaced();
    persist();
    toast('导入成功。');
  });
  $('btnReset').addEventListener('click', () => {
    if (!confirm('确定重新开始?当前进度会被清除。')) return;
    $('settings').hidden = true;
    resetGame();
  });
}

// ───────────── 音频解锁:iOS 要在 pointerup/click 手势里 resume,一直试到 running 为止 ─────────────
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
function armAudioUnlock(): void {
  const onGesture = (): void => {
    audio.unlock();
    if (audio.isRunning()) disarm();
  };
  const arm = (): void => {
    for (const t of UNLOCK_EVENTS) addEventListener(t, onGesture, { capture: true, passive: true });
  };
  const disarm = (): void => {
    for (const t of UNLOCK_EVENTS) removeEventListener(t, onGesture, { capture: true });
  };
  arm();
  // 被系统挂起(来电、切后台)后回到前台:重新挂上
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !audio.isRunning()) {
      disarm();
      arm();
    }
  });
}

// ───────────── 手机摇一摇(默认关;独立于存档,存在 localStorage) ─────────────
const MOTION_KEY = 'shake-the-apple.motion';
let detachMotion: (() => void) | null = null;
const motionBtn = $o<HTMLButtonElement>('btnMotion');
function motionStored(): boolean {
  try {
    return localStorage.getItem(MOTION_KEY) === '1';
  } catch {
    return false;
  }
}
function motionStore(on: boolean): void {
  try {
    localStorage.setItem(MOTION_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
function renderMotionBtn(): void {
  if (motionBtn) motionBtn.textContent = detachMotion ? '摇一摇:开' : '摇一摇:关';
}
function motionShake(strength: number): void {
  // 结局、设置、弹层打开时不响应
  if (document.getElementById('ending') || !$('settings').hidden || !bp.hidden || !gp.hidden) return;
  // 一次真实的摇动 ≈ 三下:按间隔摇,让令牌桶和音效都有喘息
  for (let i = 0; i < 3; i++) setTimeout(() => doShake(strength), i * 110);
}
function startMotion(): void {
  if (detachMotion) return;
  detachMotion = attachMotion(motionShake);
  renderMotionBtn();
}
function stopMotion(): void {
  detachMotion?.();
  detachMotion = null;
  renderMotionBtn();
}
async function turnMotionOn(): Promise<void> {
  const r = await enableMotion();
  if (r === 'on') {
    startMotion();
    motionStore(true);
  } else if (r === 'denied') {
    toast('没拿到传感器权限。iPhone:设置 → Safari → 动作与方向访问。', 5000);
  }
  renderMotionBtn();
}
function setupMotion(): void {
  if (!motionBtn) return;
  if (!motionSupported()) {
    motionBtn.hidden = true;
    return;
  }
  motionBtn.hidden = false;
  renderMotionBtn();
  motionBtn.addEventListener('click', () => {
    if (detachMotion) {
      stopMotion();
      motionStore(false);
    } else void turnMotionOn();
  });
  // 之前开过:不需要权限弹窗的平台直接恢复;iOS 需要手势,等第一次点击时再请求
  if (motionStored()) {
    const needGesture = typeof (window as unknown as { DeviceMotionEvent?: { requestPermission?: unknown } }).DeviceMotionEvent?.requestPermission === 'function';
    if (!needGesture) startMotion();
    else {
      const once = (): void => {
        removeEventListener('pointerup', once, true);
        void enableMotion().then((r) => {
          if (r === 'on') startMotion();
        });
      };
      addEventListener('pointerup', once, true);
    }
  }
}

// ───────────── 主循环 ─────────────
let lastTs = performance.now();
let slowAcc = 0;
let saveAcc = 0;
function loop(ts: number): void {
  requestAnimationFrame(loop);
  const raw = (ts - lastTs) / 1000;
  lastTs = ts;
  if (raw > 5) {
    catchUp(true); // 浏览器把页面挂起了很久
    renderAll();
    return;
  }
  const dt = Math.max(0, Math.min(raw, 1));
  if (!readOnly) {
    // 加速时一帧要推进很多游戏秒:分段推进,每帧最多 ~20 段
    let left = dt * speed;
    const chunk = Math.max(0.1, left / 20);
    while (left > 1e-6) {
      const step = Math.min(chunk, left);
      tick(state, step, Date.now());
      left -= step;
    }
  }
  orchard.frame(dt);
  slowAcc += dt;
  saveAcc += dt;
  if (slowAcc >= 0.25) {
    slowAcc = 0;
    renderAll();
  }
  if (saveAcc >= 15) {
    saveAcc = 0;
    persist();
  }
}

// ───────────── 启动 ─────────────
canSave = storageWritable(kv);
const loaded = load(kv, Date.now());
const awayAtBoot = loaded.kind === 'new' ? 0 : Date.now() - loaded.state.lastSeen;
state = loaded.state;
if (loaded.kind === 'readonly') readOnly = true;
mkHelperBtn();
btn = { sb: mkAct('btnSrcBuy'), su: mkAct('btnSrcUp'), rb: mkAct('btnRtBuy'), ru: mkAct('btnRtUp') };
const orchard = new Orchard($<HTMLCanvasElement>('stage'));
if (loaded.kind === 'readonly') toast('存档来自更新的版本,本页只读,不会覆盖存档。', 6000);
else if (loaded.kind === 'ok') {
  if (loaded.fromBackup) toast('主存档损坏,已从备份恢复。', 5000);
  catchUp(true);
  if (awayAtBoot >= 3 * 86400_000) toast('隔了好几天。存档可以在设置里导出一份,也可以「添加到主屏幕」,下次点一下就回来。', 6000);
}
$('saveWarn').textContent = canSave ? '' : '当前无法保存(隐私模式?),请定期导出存档。';
wire();
setupMotion();
if (DEBUG) {
  setupDebug();
  (window as unknown as { __game: unknown }).__game = {
    get state() {
      return state;
    },
    get speed() {
      return speed;
    },
    orchard,
    GOAL,
  };
}
afterStateReplaced();
requestAnimationFrame((ts) => {
  lastTs = ts;
  requestAnimationFrame(loop);
});
