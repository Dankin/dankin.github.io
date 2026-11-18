import { CFG, NPCS, PROPS, MOVES, SEQS, StepDef, StoryDef, STORIES, t } from './data';
import { Stimulus, StimulusSystem } from './stimulus';
import { bus } from './bus';
import type { Npc } from '../entities/Npc';
import { condOk } from '../entities/Npc';
import { entityPos, getFlag, hasFlag, setFlag } from '../entities/registry';
import { actionIds } from './sequencer';
import { reactionIds } from '../entities/reactions';
import { WorldRules } from '../entities/rules';

/** 故事层可扩展字段（stories.json 里直接写；StepDef/StoryDef 类型不动，这里是契约） */
export interface StepX extends Omit<StepDef, 'kind' | 'hint' | 'say'> {
  kind: 'stimulus' | 'quiet' | 'event' | 'flag' | 'arrive' | 'timer' | 'near' | 'count' | 'combo';
  say?: string; hint?: StepDef['hint'];
  /** event：bus 事件名（可带 arg 过滤：evArg=NPC id 等） */
  on?: string; evArg?: string;
  /** flag：世界标志 ≥ min 即完成 */
  flag?: string; min?: number;
  /** arrive：npc 到达 at（[x,y] 或实体 id）半径 r；near：npc 与 target 距离 ≤ r */
  npc?: string; at?: number[] | string; target?: string; r?: number;
  /** near/arrive/flag/count：条件需连续保持 hold 秒（E4） */
  hold?: number;
  /** count：flag 在 within 秒内至少增加 min 次（E5）；combo：events 全部在 within 秒内发生（E6） */
  within?: number; events?: string[];
  /** timer：前置满足后经过 secs */
  secs?: number;
  /** 前置满足即可（任一） */
  requiresAny?: string[];
  /** 步骤门：阶段 / 标志 */
  gate?: { phase?: string | string[]; flag?: string | string[]; notFlag?: string | string[] };
  /** 完成后的联动 */
  onDone?: OnDone;
  /** stimulus 步骤：用谁的位置感知（缺省=故事主角） */
  sense?: string;
  /** 不计入 need（可选支线步骤） */
  optional?: boolean;
  /** 提示开关：false 则不出提示 */
  noHint?: boolean;
}
export interface OnDone {
  seq?: string;                 // 触发序列（bg 序列不锁玩家）
  set?: string | string[];      // 设置世界标志
  clear?: string | string[];
  event?: string;               // bus 事件
  order?: { npc: string; [k: string]: any }[]; // 给 NPC 下指令：{npc, kind:'goto', x, y …} / {npc, kind:'release'}
  emit?: any;                   // 在 at 处发现象 {spec..., at:[x,y]|实体id}
  say?: { npc: string; key: string; dur?: number }[];
}
export interface StoryX {
  /** 阶段锁：仅在这些阶段内可推进 */
  phase?: string | string[];
  /** 前置：其他故事完成 / 标志 */
  requires?: { stories?: string[]; flag?: string | string[]; notFlag?: string | string[] };
  onStart?: OnDone; onDone?: OnDone;
  /** 提示优先级（小在前，缺省按 stories.json 顺序） */
  order?: number;
  title?: string;
}

export interface StoryHost {
  now: number;
  locked: boolean;
  npc(id: string): Npc;
  crowdNear(x: number, y: number, r: number): number;
  runSequence(id: string): Promise<void>;
  showHint(tier: number, step: StepDef): void;
  clearHint(): void;
  /** 可选 */
  stim?: StimulusSystem;
  phaseId?: string;
  /** 世界规则（E16/E27）用：有就生效 */
  npcs?: Record<string, Npc>;
  hat?: { x: number; y: number; tx?: number; ty?: number; shake?: number; attachedTo?: string | null };
}

type SS = 'locked' | 'active' | 'done';

/** 单个故事的推进器：步骤依赖、等待安静、失败反馈、多种完成条件 */
export class StorySystem {
  done = new Set<string>();
  finished = false;
  lastProgress = 0;
  hintTier = -1;
  quietT = 0;
  status: SS = 'active';
  activeSince = 0;
  private timers = new Map<string, number>();
  private mgr?: StoryManager;

  constructor(private host: StoryHost, public id: string, mgr?: StoryManager) { this.mgr = mgr; }
  get def(): StoryDef & StoryX { return STORIES[this.id] as StoryDef & StoryX; }
  get steps(): StepX[] { return this.def.steps as unknown as StepX[]; }
  get npc(): Npc { return this.host.npc(this.def.npc); }
  private get phase() { return this.host.phaseId ?? 'morning'; }

  private met(s: StepX) {
    if (s.requires?.length && !s.requires.every((r: string) => this.done.has(r))) return false;
    if (s.requiresAny && !s.requiresAny.some((r: string) => this.done.has(r))) return false;
    return true;
  }
  /** 门：阶段/标志 */
  private gated(s: StepX) { return !condOk(s.gate, this.phase); }
  current(): StepDef | undefined {
    if (this.status !== 'active') return undefined;
    return this.steps.find((s) => !s.optional && !this.done.has(s.id) && this.met(s) && s.kind !== 'timer' && !s.noHint && s.hint) as unknown as StepDef | undefined;
  }
  /** 全部当前可推进的步骤（调试用） */
  openSteps() { return this.steps.filter((s) => !this.done.has(s.id) && this.met(s)).map((s) => s.id); }

  /** 刷新锁定状态：阶段 / 前置故事 / 标志 */
  refreshLock(now: number) {
    if (this.finished) { this.status = 'done'; return; }
    const d = this.def;
    let ok = condOk({ phase: d.phase, flag: d.requires?.flag, notFlag: d.requires?.notFlag }, this.phase);
    if (ok && d.requires?.stories) ok = d.requires.stories.every((s) => this.mgr?.get(s)?.finished);
    const next: SS = ok ? 'active' : 'locked';
    if (next !== this.status) {
      this.status = next;
      if (ok) { this.activeSince = now; this.lastProgress = Math.max(this.lastProgress, now); bus.emit('story:unlock', this.id); this.doEffects(d.onStart); }
    }
  }

  onStimulus(s: Stimulus) {
    if (this.finished || this.status !== 'active' || this.host.locked) return;
    const stim = this.host.stim;
    for (const step of this.steps) {
      if (step.kind !== 'stimulus' || this.done.has(step.id) || !step.when || this.gated(step)) continue;
      const npc = step.sense ? this.host.npc(step.sense) : this.npc;
      if (npc.state === 'hide' || npc.state === 'scripted') continue;
      const w = step.when;
      if (s.type !== w.type || s.tag !== w.tag) continue;
      const I = stim ? stim.at(s, npc.x, npc.y) : StimulusSystem.at(s, npc.x, npc.y);
      if (I < w.min) continue;
      if (!this.met(step)) {
        if (step.fail?.notRequired) { npc.say(t(step.fail.notRequired), 3); npc.hide(4); }
        continue;
      }
      if (step.needQuiet && this.host.crowdNear(npc.def.home[0], npc.def.home[1], step.needQuiet) > 0) {
        if (step.fail?.notQuiet) { npc.say(t(step.fail.notQuiet), 3.2); npc.hide(5); }
        continue;
      }
      this.complete(step);
      return;
    }
  }

  /** bus 事件驱动的步骤（由 StoryManager 分发） */
  onEvent(name: string, arg?: unknown) {
    if (this.finished || this.status !== 'active') return;
    for (const step of this.steps) {
      if (step.kind === 'combo' && step.events?.includes(name) && !this.done.has(step.id) && this.met(step) && !this.gated(step)) {
        const m = this.comboT.get(step.id) ?? this.comboT.set(step.id, new Map()).get(step.id)!;
        m.set(name, this.host.now);
        const w = step.within ?? 20;
        if (step.events.every((e) => m.has(e) && this.host.now - m.get(e)! <= w)) this.complete(step);
        continue;
      }
      if (step.kind !== 'event' || step.on !== name || this.done.has(step.id) || !this.met(step) || this.gated(step)) continue;
      if (step.evArg && step.evArg !== arg) continue;
      this.complete(step);
    }
  }

  complete(step: StepX) {
    if (this.done.has(step.id)) return;
    this.done.add(step.id);
    this.lastProgress = this.host.now;
    this.hintTier = -1;
    this.quietT = 0;
    this.mgr?.progress(this);
    if (!this.mgr) this.host.clearHint();
    const npc = this.npc;
    if (step.say) npc.say(t(step.say), 3.2);
    setFlag(`story:${this.id}:${step.id}`);
    bus.emit('story:step', this.id, step.id);
    this.doEffects(step.onDone);
    const needed = this.def.need;
    const cnt = this.steps.filter((s) => !s.optional && this.done.has(s.id)).length;
    if (!this.finished && cnt >= needed) {
      this.finished = true; this.status = 'done';
      const fin = this.def.finale;
      const after = () => { setFlag(`story:${this.id}:done`); bus.emit('story:done', this.id); this.doEffects(this.def.onDone); };
      if (fin && SEQS[fin]) this.host.runSequence(fin).then(after); else after();
    }
  }

  /** 联动：序列 / 标志 / 事件 / NPC 指令 / 现象 / 台词 */
  doEffects(e?: OnDone) {
    if (!e) return;
    for (const f of asArr(e.set)) setFlag(f);
    for (const f of asArr(e.clear)) setFlag(f, 0);
    for (const o of e.order ?? []) {
      const n = this.host.npc(o.npc); if (!n) continue;
      if (o.kind === 'release') n.clearOrder(); else n.setOrder(o as any);
    }
    for (const s of e.say ?? []) this.host.npc(s.npc)?.say(t(s.key), s.dur ?? 3);
    if (e.emit && this.host.stim) {
      const at = typeof e.emit.at === 'string' ? entityPos(e.emit.at) : e.emit.at ? { x: e.emit.at[0], y: e.emit.at[1] } : undefined;
      const p = at ?? { x: this.npc.x, y: this.npc.y };
      this.host.stim.emitSpec(e.emit, p.x, p.y, `story:${this.id}`, this.host.now);
    }
    if (e.event) bus.emit(e.event);
    if (e.seq) this.host.runSequence(e.seq);
  }

  private comboT = new Map<string, Map<string, number>>();
  private holdT = new Map<string, number>();
  private countT = new Map<string, { last: number; ts: number[] }>();
  /** 条件连续满足 hold 秒才算（hold 缺省=立即） */
  private held(step: StepX, ok: boolean, dt: number) {
    if (!step.hold) return ok;
    const v = ok ? (this.holdT.get(step.id) ?? 0) + dt : 0;
    this.holdT.set(step.id, v);
    return v >= step.hold;
  }

  update(dt: number) {
    if (this.finished) return;
    this.refreshLock(this.host.now);
    if (this.status !== 'active' || this.host.locked) return;
    const npc = this.npc;
    for (const step of this.steps) {
      if (this.done.has(step.id) || !this.met(step) || this.gated(step)) continue;
      switch (step.kind) {
        case 'quiet': {
          // 安静步骤：用主角的家做圆心，避免躲起来时被钻空子
          if (npc.state === 'hide' || npc.state === 'scripted') { this.quietT = 0; break; }
          const n = this.host.crowdNear(npc.def.home[0], npc.def.home[1], step.radius ?? 3);
          this.quietT = n === 0 ? this.quietT + dt : 0;
          if (this.quietT >= (step.hold ?? 2)) this.complete(step);
          break;
        }
        case 'flag': if (this.held(step, getFlag(step.flag!) >= (step.min ?? 1), dt)) this.complete(step); break;
        case 'count': {
          const v = getFlag(step.flag!); const c = this.countT.get(step.id) ?? { last: v, ts: [] as number[] }; this.countT.set(step.id, c);
          if (v > c.last) for (let i = 0; i < v - c.last; i++) c.ts.push(this.host.now);
          c.last = v;
          if (step.within) { while (c.ts.length && this.host.now - c.ts[0] > step.within) c.ts.shift(); if (c.ts.length >= (step.min ?? 1)) this.complete(step); }
          else if (v >= (step.min ?? 1)) this.complete(step);
          break;
        }
        case 'arrive': {
          const n = this.host.npc(step.npc ?? this.def.npc); if (!n) break;
          const p = typeof step.at === 'string' ? entityPos(step.at) : step.at ? { x: step.at[0], y: step.at[1] } : undefined;
          if (this.held(step, !!p && Math.hypot(n.x - p.x, n.y - p.y) <= (step.r ?? 1.2), dt)) this.complete(step);
          break;
        }
        case 'near': {
          const n = this.host.npc(step.npc ?? this.def.npc); const p = step.target ? entityPos(step.target) : undefined;
          if (this.held(step, !!n && !!p && Math.hypot(n!.x - p!.x, n!.y - p!.y) <= (step.r ?? 2), dt)) this.complete(step);
          break;
        }
        case 'timer': {
          const t0 = this.timers.get(step.id) ?? this.timers.set(step.id, this.host.now).get(step.id)!;
          if (this.host.now - t0 >= (step.secs ?? 1)) this.complete(step);
          break;
        }
      }
    }
  }

  serialize() { return { done: [...this.done], finished: this.finished }; }
  load(d: { done: string[]; finished: boolean }) { this.done = new Set(d.done); this.finished = d.finished; this.status = d.finished ? 'done' : 'active'; }
}

const asArr = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/**
 * 故事管理器：所有故事并行；统一分发现象/事件；统一管理提示（一次只提示一个故事）。
 * 用法（Game.ts）：
 *   this.stories = new StoryManager(this);          // 取代 new StorySystem(...)
 *   this.stories.onStimulus(s) ← useMove 里 emit 之后
 *   this.stories.update(dt)    ← 每帧
 *   this.story = this.stories.get('xiaomi_story')   // 兼容旧引用
 */
export class StoryManager {
  list: StorySystem[] = [];
  private byId = new Map<string, StorySystem>();
  lastProgress = 0;
  private hintOwner?: StorySystem;
  private wired = new Set<string>();

  private rules: WorldRules;
  constructor(private host: StoryHost) {
    this.rules = new WorldRules(host as any);
    const ids = Object.keys(STORIES).sort((a, b) => ((STORIES[a] as any).order ?? 0) - ((STORIES[b] as any).order ?? 0));
    for (const id of ids) { const s = new StorySystem(host, id, this); this.list.push(s); this.byId.set(id, s); }
    // 事件步骤：每个事件名只在 bus 上登记一次
    for (const s of this.list) for (const st of s.steps) {
      const names = st.kind === 'event' && st.on ? [st.on] : st.kind === 'combo' ? st.events ?? [] : [];
      for (const name of names) {
        if (this.wired.has(name)) continue;
        this.wired.add(name);
        bus.on(name, (arg?: unknown) => { for (const x of this.list) x.onEvent(name, arg); });
      }
    }
  }
  get(id: string) { return this.byId.get(id); }
  /** 对象形式（qa testApi 的 scene.stories 约定） */
  get map(): Record<string, StorySystem> { return Object.fromEntries(this.byId); }
  get activeCount() { return this.list.filter((s) => s.status === 'active').length; }

  onStimulus(s: Stimulus) { for (const x of this.list) x.onStimulus(s); }

  progress(from: StorySystem) {
    this.lastProgress = this.host.now;
    for (const s of this.list) s.hintTier = -1;
    this.hintOwner = undefined;
    this.host.clearHint();
    void from;
  }

  update(dt: number) {
    for (const s of this.list) s.update(dt);
    this.rules.update(dt);
    if (this.host.locked) return;
    // 提示：由第一个“有提示可给”的活跃故事负责
    const s = this.hintOwner && !this.hintOwner.finished && this.hintOwner.current() ? this.hintOwner : this.list.find((x) => x.status === 'active' && x.current());
    if (!s) return;
    const cur = s.current()!;
    const idle = this.host.now - Math.max(this.lastProgress, s.activeSince, s.lastProgress);
    const delays: number[] = CFG.hintDelays;
    let tier = -1;
    delays.forEach((d, i) => { if (idle >= d) tier = i; });
    if (tier > s.hintTier) { s.hintTier = tier; this.hintOwner = s; this.host.showHint(tier, cur); }
  }

  /** 存档 */
  serialize() { return Object.fromEntries(this.list.map((s) => [s.id, s.serialize()])); }
  load(d: Record<string, { done: string[]; finished: boolean }>) { for (const [k, v] of Object.entries(d ?? {})) this.byId.get(k)?.load(v); }

  /** 调试快照：当前步骤、完成情况 */
  debug() {
    return this.list.map((s) => ({
      id: s.id, status: s.status, finished: s.finished, done: [...s.done], open: s.openSteps(),
      current: s.current()?.id ?? null, hintTier: s.hintTier, idle: +(this.host.now - s.lastProgress).toFixed(1),
    }));
  }
}

// ───────────────────── 数据校验（dev-core 在 validateData 里调用） ─────────────────────
const STEP_KINDS = ['stimulus', 'quiet', 'event', 'flag', 'arrive', 'timer', 'near', 'count', 'combo'];
/** 返回错误字符串数组；空数组=通过 */
export function validateGameplay(): string[] {
  const err: string[] = [];
  const known = new Set(actionIds());
  const reacts = new Set(reactionIds());
  const seqExists = (id?: string) => !id || !!SEQS[id];
  const chkEffects = (where: string, e?: OnDone) => {
    if (!e) return;
    if (!seqExists(e.seq)) err.push(`${where}: 序列 ${e.seq} 不存在`);
    for (const o of e.order ?? []) if (!NPCS[o.npc]) err.push(`${where}: order 的 NPC ${o.npc} 不存在`);
    for (const s of e.say ?? []) if (!NPCS[s.npc]) err.push(`${where}: say 的 NPC ${s.npc} 不存在`);
  };
  for (const [sid, def0] of Object.entries(STORIES)) {
    const def = def0 as StoryDef & StoryX;
    if (!NPCS[def.npc]) err.push(`story ${sid}: NPC ${def.npc} 不存在`);
    if (def.finale && !SEQS[def.finale]) err.push(`story ${sid}: finale 序列 ${def.finale} 不存在`);
    for (const r of def.requires?.stories ?? []) if (!STORIES[r]) err.push(`story ${sid}: requires.stories ${r} 不存在`);
    const ids = new Set<string>();
    const steps = def.steps as unknown as StepX[];
    for (const st of steps) {
      const w = `story ${sid}.${st.id}`;
      if (ids.has(st.id)) err.push(`${w}: 步骤 id 重复`);
      ids.add(st.id);
      if (!STEP_KINDS.includes(st.kind)) err.push(`${w}: 未知 kind ${st.kind}`);
      for (const r of [...(st.requires ?? []), ...(st.requiresAny ?? [])]) if (!steps.some((x) => x.id === r)) err.push(`${w}: requires ${r} 不存在`);
      if (st.kind === 'stimulus' && !st.when) err.push(`${w}: stimulus 步骤缺 when`);
      if (st.kind === 'event' && !st.on) err.push(`${w}: event 步骤缺 on`);
      if (st.kind === 'combo' && !st.events?.length) err.push(`${w}: combo 步骤缺 events`);
      if (st.kind === 'count' && !st.flag) err.push(`${w}: count 步骤缺 flag`);
      if (st.kind === 'flag' && !st.flag) err.push(`${w}: flag 步骤缺 flag`);
      if (st.kind === 'arrive' && (!st.at || (st.npc && !NPCS[st.npc]))) err.push(`${w}: arrive 需要 at 且 npc 存在`);
      if (st.hint) {
        if (!PROPS[st.hint.prop]) err.push(`${w}: hint.prop ${st.hint.prop} 不存在`);
        if (!MOVES[st.hint.move]) err.push(`${w}: hint.move ${st.hint.move} 不存在`);
      }
      chkEffects(w, st.onDone);
    }
    chkEffects(`story ${sid}.onStart`, def.onStart); chkEffects(`story ${sid}.onDone`, def.onDone);
    if (steps.filter((x) => !x.optional).length < def.need) err.push(`story ${sid}: need=${def.need} 大于非可选步骤数`);
  }
  for (const [nid, n0] of Object.entries(NPCS)) {
    const n = n0 as any;
    for (const r of n.reactions ?? []) if (!reacts.has(r.do)) err.push(`npc ${nid}: 未知反应 do=${r.do}`);
    for (const e of n.schedule ?? []) if (!Array.isArray(e.route) || !e.route.length) err.push(`npc ${nid}: schedule 缺 route`);
  }
  for (const [qid, list] of Object.entries(SEQS)) {
    const walk = (l: any[], path: string) => l.forEach((a, i) => {
      if (!known.has(a.do)) err.push(`seq ${path}${qid}[${i}]: 未知动作 ${a.do}`);
      if (a.do === 'parallel') (a.lists ?? []).forEach((s: any[], j: number) => walk(s, `${qid}[${i}].p${j}:`));
      if (a.do === 'if') { walk(a.then ?? [], `${qid}[${i}].then:`); walk(a.else ?? [], `${qid}[${i}].else:`); }
      if (a.do === 'runSeq' && !SEQS[a.id]) err.push(`seq ${qid}[${i}]: runSeq ${a.id} 不存在`);
      if (a.npc && !NPCS[a.npc] && a.do !== 'cam') err.push(`seq ${qid}[${i}]: NPC ${a.npc} 不存在`);
    });
    walk(list, '');
  }
  void hasFlag;
  return err;
}
