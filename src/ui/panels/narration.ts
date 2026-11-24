// 旁白条:屏幕上方一条细纸条。按 content/story.ts NARRATION 触发表播放。
// 队列 + 冷却(minGapSec / maxPerHour);点一下:正在打字→补全,已打完→关掉。
import { NARRATION, NARRATION_LIMITS, type NarrationLine } from '../../content/story.ts';
import { CHAR_BY_ID, type CharId } from '../../content/characters.ts';
import { EGG_BY_ID } from '../../content/eggs.ts';
import { GOAL } from '../../core/constants.ts';
import { drawCharacter, type CharKind } from '../../art/things/index.ts';
import { h, reducedMotion, sfx } from './dom.ts';
import type { PanelPrefs } from './store.ts';
import { savePrefs } from './store.ts';
import type { PanelCtx } from './types.ts';

const KIND_OF: Partial<Record<CharId, CharKind>> = {
  laoxu: 'xu', santa: 'santa', newton: 'newton', xiaoman: 'manman', crow: 'crow', laohai: 'haihai', dudu: 'dudu', doorman: 'doorman', duoduo: 'duoduo',
};

interface Item {
  id: string;
  text: string;
  speaker?: string;
  prio: number; // 越大越优先:era 3 / milestone 3 / idle 2 / egg 1 / custom 2
  force?: boolean;
}

const MAX_Q = 4;
const CPS = 26; // 打字速度(字/秒)

export interface Narration {
  say(text: string, speaker?: string, force?: boolean): void;
  enterEra(era: number): void;
  onAway(minutes: number): void;
  /** 有全屏面板/明信片时暂停出条 */
  setHold(on: boolean): void;
  el: HTMLElement;
  destroy(): void;
}

export function createNarration(ctx: PanelCtx, prefs: PanelPrefs, parent: HTMLElement): Narration {
  const bar = h('div', 'panel-narr');
  bar.id = 'panel-narr';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  const av = document.createElement('canvas');
  av.className = 'panel-narr-av';
  const who = h('b', 'panel-narr-who');
  const txt = h('span', 'panel-narr-txt');
  bar.append(av, h('div', 'panel-narr-main', who, txt));
  parent.append(bar);

  const queue: Item[] = [];
  const timers = new Set<number>();
  let hold = false;
  let current: { full: string; shown: number; t0: number; raf: number; hideAt: number } | null = null;
  let lastShownAt = 0;
  let wait = 0;
  let destroyed = false;

  const later = (ms: number, f: () => void): void => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (!destroyed) f();
    }, ms);
    timers.add(id);
  };

  function drawAvatar(speaker?: string): void {
    const kind = speaker ? KIND_OF[speaker as CharId] : undefined;
    av.style.display = kind ? '' : 'none';
    if (!kind) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = 40;
    av.width = S * dpr;
    av.height = S * dpr;
    av.style.width = S + 'px';
    av.style.height = S + 'px';
    const g = av.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, S, S);
    // 角色约 40 单位高;放大 1.0 脚底在底部,头像裁到半身
    drawCharacter(g, kind, S / 2, S + 8, 1.05, {});
  }

  const hourCount = (): number => {
    const cut = Date.now() - 3600_000;
    prefs.narrAt = prefs.narrAt.filter((t) => t > cut);
    return prefs.narrAt.length;
  };

  function enqueue(it: Item): void {
    if (!it.force && prefs.narrSeen.includes(it.id) && it.id.startsWith('nr-')) return;
    if (queue.some((q) => q.id === it.id)) return;
    queue.push(it);
    queue.sort((a, b) => b.prio - a.prio);
    while (queue.length > MAX_Q) queue.pop();
    pump();
  }

  function pump(): void {
    if (destroyed || current || hold || !queue.length) return;
    const it = queue[0];
    const sinceLast = (Date.now() - lastShownAt) / 1000;
    if (!it.force) {
      if (lastShownAt && sinceLast < NARRATION_LIMITS.minGapSec) return rearm((NARRATION_LIMITS.minGapSec - sinceLast) * 1000 + 50);
      if (hourCount() >= NARRATION_LIMITS.maxPerHour) return rearm(60_000);
    }
    queue.shift();
    show(it);
  }
  function rearm(ms: number): void {
    window.clearTimeout(wait);
    wait = window.setTimeout(pump, Math.max(200, ms));
  }

  function show(it: Item): void {
    lastShownAt = Date.now();
    prefs.narrAt.push(lastShownAt);
    if (it.id.startsWith('nr-')) prefs.narrSeen.push(it.id);
    savePrefs(ctx, prefs);
    const sp = it.speaker ? CHAR_BY_ID[it.speaker as CharId] : undefined;
    who.textContent = sp ? sp.name : '';
    who.style.display = sp ? '' : 'none';
    drawAvatar(it.speaker);
    bar.classList.toggle('has-av', !!sp && !!KIND_OF[it.speaker as CharId]);
    txt.textContent = '';
    bar.classList.add('on');
    sfx(ctx, 'narrOpen');
    const instant = !prefs.typewriter || reducedMotion(ctx);
    current = { full: it.text, shown: 0, t0: performance.now(), raf: 0, hideAt: 0 };
    const hold_ms = 2600 + it.text.length * 110;
    if (instant) {
      finishTyping(hold_ms);
      return;
    }
    const step = (now: number): void => {
      if (!current) return;
      const n = Math.min(current.full.length, Math.floor(((now - current.t0) / 1000) * CPS) + 1);
      if (n !== current.shown) {
        if (n % 2 === 0) sfx(ctx, 'narrBlip');
        current.shown = n;
        txt.textContent = current.full.slice(0, n);
      }
      if (n >= current.full.length) finishTyping(hold_ms);
      else current.raf = requestAnimationFrame(step);
    };
    current.raf = requestAnimationFrame(step);
  }

  function finishTyping(holdMs: number): void {
    if (!current) return;
    cancelAnimationFrame(current.raf);
    current.shown = current.full.length;
    txt.textContent = current.full;
    current.raf = 0;
    current.hideAt = window.setTimeout(dismiss, holdMs);
  }

  function dismiss(): void {
    if (!current) return;
    cancelAnimationFrame(current.raf);
    window.clearTimeout(current.hideAt);
    current = null;
    bar.classList.remove('on');
    sfx(ctx, 'narrClose');
    pump();
  }

  bar.addEventListener('click', () => {
    if (!current) return;
    if (current.raf) finishTyping(2400);
    else dismiss();
  });

  // ───────── 触发 ─────────
  const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
  const lines = (f: (l: NarrationLine) => boolean): NarrationLine[] => NARRATION.filter(f);
  const toItem = (l: NarrationLine, prio: number): Item => ({ id: l.id, text: l.text, speaker: l.speaker, prio });

  const offs: (() => void)[] = [];
  const doneMilestones = new Set<number>(
    NARRATION.filter((l) => l.trigger === 'milestone' && l.pct !== undefined && prefs.narrSeen.includes(l.id)).map((l) => l.pct!),
  );
  offs.push(
    ctx.bus.on('delivered', (e) => {
      const pct = (e.total / GOAL) * 100;
      const due = NARRATION_LIMITS.milestones.filter((m) => pct >= m && !doneMilestones.has(m));
      if (!due.length) return;
      for (const m of due) doneMilestones.add(m);
      const top = due[due.length - 1]; // 一次跨多档只播最高档
      const cand = lines((l) => l.trigger === 'milestone' && l.pct === top);
      if (cand.length) enqueue(toItem(pick(cand), 3));
    }),
    ctx.bus.on('egg', (e) => {
      const layer = EGG_BY_ID[e.id]?.layer;
      const cand = lines((l) => l.trigger === 'egg' && (!l.eggLayer || !layer || l.eggLayer === layer) && !prefs.narrSeen.includes(l.id));
      if (cand.length) enqueue(toItem(pick(cand), 1));
    }),
  );

  return {
    el: bar,
    say(text, speaker, force) {
      enqueue({ id: 'say-' + Date.now() + Math.random(), text, speaker, prio: 2, force });
    },
    enterEra(era) {
      for (const l of lines((x) => x.trigger === 'era-enter' && x.era === era)) {
        if (prefs.narrSeen.includes(l.id)) continue;
        later((l.delaySec ?? 0) * 1000, () => enqueue(toItem(l, 3)));
      }
    },
    onAway(minutes) {
      const ok = lines((l) => l.trigger === 'idle-return' && (l.awayMin ?? 0) <= minutes);
      if (!ok.length) return;
      const top = Math.max(...ok.map((l) => l.awayMin ?? 0));
      enqueue({ ...toItem(pick(ok.filter((l) => (l.awayMin ?? 0) === top)), 2), id: 'idle-' + Date.now() });
    },
    setHold(on) {
      hold = on;
      if (on) {
        // 明信片/大面板来了:正在显示的先收起
        if (current) dismiss();
      } else pump();
    },
    destroy() {
      destroyed = true;
      for (const o of offs) o();
      for (const t of timers) clearTimeout(t);
      window.clearTimeout(wait);
      if (current) {
        cancelAnimationFrame(current.raf);
        window.clearTimeout(current.hideAt);
      }
      bar.remove();
    },
  };
}
