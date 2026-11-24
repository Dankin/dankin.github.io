// 弹层:关卡槽选择、升档分支选择。
import { canUpgradeTier, era, nextBranches, preview, setGate, tierCost, tiersOf, upgradeTier, type LineId } from '../core/game.ts';
import { GATES, GATE_SLOTS, describeEffect, describeGate, gateDef, type GateId } from '../core/content.ts';
import { ERA_TOAST, GATE_UNLOCK_TOAST } from '../core/copy.ts';
import { bus } from '../core/bus.ts';
import { fmt } from '../ui/format.ts';
import { $, $o, setText, setCls } from './dom.ts';
import { app, hooks, LINE_NAME } from './ctx.ts';
import { toast } from './toasts.ts';
import { persist } from './session.ts';

// ───────────── 关卡槽 ─────────────
let gatesSeen = 0;
export function renderGates(): void {
  if (!$o('gate0')) return; // 关卡槽改画在场景里了
  const s = app.state;
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

export const gp = $('gatePick');
let gateSlot = -1;
export function openGate(slot: number): void {
  if (!gp.hidden && gateSlot === slot) {
    gp.hidden = true;
    return;
  }
  gateSlot = slot;
  gatesSeen = app.state.gatesUnlocked.length;
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
      if (app.state.gates[slot] === null) b.classList.add('on');
    } else {
      const g = gateDef(id);
      t.textContent = g.name;
      b.title = g.joke;
      const sum = era(app.state);
      if (!app.state.gatesUnlocked.includes(id)) {
        d.textContent = `两条线档位合计 ${g.unlockAt} 解锁`;
        b.classList.add('no');
        b.disabled = true;
      } else {
        const p = preview(app.state, { kind: 'gate', slot, id });
        const dp = p.incomePct;
        const here = app.state.gates[slot] === id;
        const other = app.state.gates.indexOf(id);
        const delta = Math.abs(dp) >= 0.005 ? ` · 收入 ${dp > 0 ? '+' : '-'}${Math.round(Math.abs(dp) * 100)}%` : '';
        d.textContent = describeGate(g) + (here ? '' : delta) + (!here && other >= 0 ? ` · 与第 ${other + 1} 槽互换` : '');
        if (here) b.classList.add('on');
      }
      void sum;
    }
    b.addEventListener('click', () => {
      if (id !== null && !app.state.gatesUnlocked.includes(id)) return;
      if (setGate(app.state, slot, id)) {
        bus.emit({ t: 'buy', line: null, what: 'gate', cost: 0 });
        app.audio.sfx.coin();
        gp.hidden = true;
        persist();
        hooks.render();
        if (id !== null) app.orchard.floatText(gateDef(id).name, app.orchard.worldPos().gates[slot][0], app.orchard.worldPos().gates[slot][1] - 26);
      }
    });
    return b;
  };
  box.append(mk(null));
  for (const g of GATES) box.append(mk(g.id));
  gp.hidden = false;
}

// ───────────── 升档:分支选择 ─────────────
export const bp = $('branchPick');
let branchLine: LineId = 'source';
export function fillBranch(): void {
  const bs = nextBranches(app.state, branchLine);
  if (!bs) {
    bp.hidden = true;
    return;
  }
  const T = tiersOf(branchLine);
  const t = T[app.state[branchLine].tier + 1];
  const c = tierCost(app.state, branchLine) ?? 0;
  const can = app.state.coins >= c;
  $('branchTitle').textContent = `升级:${t.name}`;
  $('branchSub').textContent = `${LINE_NAME[branchLine]} · 二选一,选了就定了 · ${fmt(c)} 苹果`;
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
    const p = preview(app.state, { kind: 'tier', line: branchLine, branch: i as 0 | 1 });
    setText(el.querySelector('.pr') as HTMLElement, `${p.plain ? `${p.plain} · ` : ''}${fmt(c)}`);
    setCls(el, { can, no: !can });
  });
}
export function openBranch(line: LineId): void {
  if (!nextBranches(app.state, line)) return;
  branchLine = line;
  fillBranch();
  bp.hidden = false;
}
export function chooseBranch(i: 0 | 1): void {
  if (!canUpgradeTier(app.state, branchLine)) {
    const c = tierCost(app.state, branchLine) ?? 0;
    toast(`手上的苹果还差 ${fmt(Math.ceil(c - app.state.coins))}。`);
    return;
  }
  const line = branchLine;
  const r = upgradeTier(app.state, line, i);
  if (!r) return;
  bp.hidden = true;
  bus.emit({ t: 'tier', line, tier: r.tier, branch: r.branch });
  app.audio.sfx.stage();
  document.body.classList.add('stageup');
  setTimeout(() => document.body.classList.remove('stageup'), 1300);
  toast((ERA_TOAST[line] as readonly string[])[r.tier] ?? '', 3800);
  for (const g of r.newGates) toast(GATE_UNLOCK_TOAST(gateDef(g).name), 3800);
  persist();
  hooks.render();
}

/** 换档后:槽的"新解锁"提示基线,以及两个弹层收起 */
export function resetGateSeen(s: { gates: (string | null)[]; gatesUnlocked: string[] }): void {
  gatesSeen = s.gates.some((g) => g !== null) ? s.gatesUnlocked.length : 0;
  gp.hidden = true;
  bp.hidden = true;
}
