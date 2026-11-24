// 弹层:升档分支选择。
import { canUpgradeTier, nextBranches, preview, tierCost, tiersOf, upgradeTier, type LineId } from '../core/game.ts';
import { describeEffect } from '../core/content.ts';
import { ERA_TOAST } from '../core/copy.ts';
import { bus } from '../core/bus.ts';
import { fmt } from '../ui/format.ts';
import { $, $o, setText, setCls } from './dom.ts';
import { app, hooks, LINE_NAME } from './ctx.ts';
import { toast } from './toasts.ts';
import { persist } from './session.ts';

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
  persist();
  hooks.render();
}

/** 换档后:收起分支弹层 */
export function resetGateSeen(): void {
  bp.hidden = true;
}
