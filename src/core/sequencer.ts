import { SEQS, MOVES, t } from './data';
import { bus } from './bus';
import type { Npc } from '../entities/Npc';
import type { StimulusSystem } from './stimulus';
import { entityPos, getFlag, setFlag, hasFlag } from '../entities/registry';
import { getMechs } from '../entities/Mech';

export interface SeqHost {
  npc(id: string): Npc;
  sleep(s: number): Promise<void>;
  setLock(on: boolean): void;
  camFocus(npcId: string | null, zoom: number, s: number): void;
  crowd(mode: string, hearts: boolean, around?: string): void;
  setPhase(id: string, s: number): void;
  sing(npcId: string, secs: number): void;
  hatStage(n: number): void;
  addWarmth(n: number): void;
  banner(key: string): void;
  /** —— 以下可选：有就用（新演出动作需要），没有则降级为 bus 事件 —— */
  now?: number;
  npcs?: Record<string, Npc>;
  stim?: StimulusSystem;
  props?: Record<string, { id: string; x: number; y: number; top: number; sx: number; sy: number; def: any }>;
  fx?: { play(id: string | undefined, prop: any, stim: any, move: any): void };
  hat?: { x: number; y: number };
  phaseId?: string;
}

export interface SeqCtx { host: SeqHost; seq: Sequencer; run(list: Action[]): Promise<void>; dead(): boolean }
export type Action = { do: string; bg?: boolean; [k: string]: any };
export type ActionFn = (a: Action, c: SeqCtx) => void | Promise<void>;

const ACTIONS = new Map<string, ActionFn>();
/** 注册一个演出动作（新动作 = 一个函数 + sequences.json 里写 {do:'名字'}） */
export function registerAction(id: string, fn: ActionFn) { ACTIONS.set(id, fn); }
export const actionIds = () => [...ACTIONS.keys(), 'meta'];

/**
 * 数据驱动的演出序列：actions 按顺序执行；wait/walk 等阻塞；`bg:true` 的动作不阻塞（并行）。
 * 序列首项可以是 {do:'meta', bg:true}：整条序列后台运行，不锁玩家，不排队。
 * 其余序列排队串行（多个故事同时完成也不会互相打断）。
 */
export class Sequencer {
  running = false;
  /** 当前前台序列 id / 等待中的序列 */
  current = ''; queued: string[] = [];
  private chain: Promise<void> = Promise.resolve();
  private pending = 0;
  private bgCount = 0;
  private alive = true;
  constructor(private host: SeqHost) {}

  dispose() { this.alive = false; }
  get bgRunning() { return this.bgCount; }

  run(id: string): Promise<void> {
    const seq = SEQS[id] as Action[] | undefined;
    if (!seq) return Promise.resolve();
    if (seq[0]?.do === 'meta' && seq[0].bg) return this.exec(id, seq, true);
    this.pending++; this.queued.push(id);
    const p = this.chain.then(async () => {
      this.queued.splice(this.queued.indexOf(id), 1);
      this.running = true; this.current = id;
      try { await this.exec(id, seq, false); }
      finally {
        this.pending--; this.current = '';
        if (this.pending === 0) { this.running = false; this.host.setLock(false); }
      }
    });
    this.chain = p.catch(() => undefined);
    return p;
  }

  private async exec(id: string, seq: Action[], bg: boolean) {
    if (bg) this.bgCount++;
    const ctx: SeqCtx = { host: this.host, seq: this, run: (l) => this.list(l, ctx), dead: () => !this.alive };
    try { await this.list(seq, ctx); }
    catch (e) { console.warn('[seq]', id, e); }
    finally { if (bg) this.bgCount--; }
  }

  private async list(list: Action[], ctx: SeqCtx) {
    for (const a of list) {
      if (!this.alive) return;
      if (!a.do && a.runSeq) { a.do = 'runSeq'; a.id = a.runSeq; }   // 简写 {runSeq:"id"}
      if (a.do === 'meta') continue;
      const fn = ACTIONS.get(a.do);
      if (!fn) { console.warn('[seq] 未知动作', a.do); continue; }
      const r = fn(a, ctx);
      if (a.bg) { void Promise.resolve(r).catch((e) => console.warn('[seq]', a.do, e)); continue; }
      await r;
    }
  }
}

// ───────────────────────────── 内置动作 ─────────────────────────────
const A = registerAction;
const warned = new Set<string>();
function warnOnce(k: string, msg: string) { if (!warned.has(k)) { warned.add(k); console.warn(msg); } return false; }
const pos = (v: unknown): { x: number; y: number } | undefined =>
  Array.isArray(v) ? { x: v[0], y: v[1] } : typeof v === 'string' ? entityPos(v) : undefined;
const T = (a: Action) => (a.key ? t(a.key) : String(a.text ?? ''));

A('lock', (a, c) => c.host.setLock(!!a.on));
A('say', async (a, c) => { c.host.npc(a.npc).say(T(a), a.dur ?? 3); if (a.wait) await c.host.sleep(a.dur ?? 3); });
A('emote', (a, c) => { const n = c.host.npc(a.npc); (n.host as any).emote(n, a.e ?? a.emote ?? 'heart'); });
A('wait', (a, c) => c.host.sleep(a.s));
A('walk', async (a, c) => {
  const n = c.host.npc(a.npc);
  const p = pos(a.to); if (!p) return;
  await n.scriptWalk(p.x, p.y);
  if (a.face) { const f = pos(a.face); if (f) n.scriptFace = f; }
});
A('crowd', (a, c) => c.host.crowd(a.mode, !!a.hearts, a.around));
A('phase', (a, c) => c.host.setPhase(a.id, a.s ?? 4));
A('sing', (a, c) => c.host.sing(a.npc, a.secs ?? 12.5));
A('hat', (a, c) => c.host.hatStage(a.stage));
A('warmth', (a, c) => c.host.addWarmth(a.add));
A('event', (a) => { bus.emit(a.id, a.arg); });
A('banner', (a, c) => c.host.banner(a.key));
A('runSeq', async (a, c) => { const l = SEQS[a.id] as Action[]; if (l) await c.run(l); });
A('parallel', async (a, c) => { await Promise.all((a.lists as Action[][]).map((l) => c.run(l))); });
A('if', async (a, c) => {
  const chk = (f: string) => hasFlag(f);
  const ok = a.all ? (a.all as string[]).every(chk) && (!a.any || (a.any as string[]).some(chk)) : a.any ? (a.any as string[]).some(chk) : a.flag ? getFlag(a.flag) >= (a.min ?? 1) : a.notFlag ? !hasFlag(a.notFlag) : a.phase ? (c.host.phaseId ?? 'morning') === a.phase : true;
  await c.run(((ok ? a.then : a.else) ?? []) as Action[]);
});
/** weather：终场下雪等；{snow:0..1, s:渐变秒}。bus 'weather'（dev-core 的天气系统监听） */
A('weather', (a) => { bus.emit('weather', { snow: a.snow, rain: a.rain, s: a.s ?? 2 }); });
A('flag', (a) => { if (a.clear) setFlag(a.clear, 0); if (a.set) setFlag(a.set, a.v ?? 1); });
A('waitEvent', (a, c) => new Promise<void>((res) => {
  let done = false;
  const fin = () => { if (!done) { done = true; res(); } };
  if (a.flag && hasFlag(a.flag)) return fin();
  bus.on(a.flag ? 'flag:' + a.flag : a.id, fin);
  if (a.timeout) c.host.sleep(a.timeout).then(fin);
}));
A('waitFlag', (a, c) => new Promise<void>((res) => {
  const t0 = Date.now();
  const iv = setInterval(() => {
    if (getFlag(a.flag) >= (a.min ?? 1) || (a.timeout && Date.now() - t0 > a.timeout * 1000) || c.dead()) { clearInterval(iv); res(); }
  }, 100);
}));
A('waitNpcAt', (a, c) => new Promise<void>((res) => {
  const t0 = Date.now(); const p = pos(a.at);
  const iv = setInterval(() => {
    const n = c.host.npc(a.npc);
    if ((p && n && Math.hypot(n.x - p.x, n.y - p.y) <= (a.r ?? 1.2)) || Date.now() - t0 > (a.timeout ?? 30) * 1000 || c.dead()) { clearInterval(iv); res(); }
  }, 120);
}));

// —— 镜头 / 字幕 / 时间：通过 bus 协议交给 dev-core（见 docs/04 附录），没人接就是空操作
/** cam: focus=npc id 老写法（走 host.camFocus）；至 {to:[x,y]|实体 id, zoom, s, hold} 新写法 → bus 'cam:to' */
A('cam', (a, c) => {
  if (a.to !== undefined) {
    const p = pos(a.to);
    bus.emit('cam:to', { x: p?.x, y: p?.y, zoom: a.zoom ?? 1, s: a.s ?? 1, ease: a.ease, target: a.to });
  } else c.host.camFocus(a.focus ?? null, a.zoom ?? 1, a.s ?? 1);
});
/** camPath: points=[{to,zoom,s,hold}]，依次运镜；await */
A('camPath', async (a, c) => {
  for (const k of a.points as { to: unknown; zoom?: number; s?: number; hold?: number }[]) {
    const p = pos(k.to);
    bus.emit('cam:to', { x: p?.x, y: p?.y, zoom: k.zoom ?? 1, s: k.s ?? 1.2, target: k.to });
    await c.host.sleep((k.s ?? 1.2) + (k.hold ?? 0));
  }
});
A('camRelease', () => bus.emit('cam:release'));
A('shake', (a) => bus.emit('cam:shake', { k: a.k ?? 0.004, ms: (a.s ?? 0.3) * 1000 }));
/** slowmo: scale=0.3, s=持续秒（真实时间）。接收方：scene.time.timeScale / tweens.timeScale / physics */
A('slowmo', async (a, c) => {
  bus.emit('time:scale', { k: a.scale ?? 0.3, ramp: a.ramp ?? 0.2 });
  if (a.wait !== false) { await new Promise<void>((r) => setTimeout(r, (a.s ?? 1.5) * 1000)); bus.emit('time:scale', { k: 1, ramp: a.ramp ?? 0.4 }); }
  else setTimeout(() => bus.emit('time:scale', { k: 1, ramp: 0.4 }), (a.s ?? 1.5) * 1000);
  void c;
});
/** subtitle: key | text，dur；wait=true 则阻塞到消失；style: 'normal'|'big'|'final' */
A('subtitle', async (a, c) => {
  bus.emit('subtitle', { text: T(a), dur: a.dur ?? 3, style: a.style ?? 'normal' });
  if (a.wait) await c.host.sleep(a.dur ?? 3);
});
A('audio', (a) => bus.emit('audio:cue', a.cue, a.arg));

// —— NPC
/** npcDo: npc, order={kind:goto|follow|stay|ride|release…} 或 pose/face/state/hide/say */
A('npcDo', async (a, c) => {
  const n = c.host.npc(a.npc); if (!n) return;
  if (a.order) { if (a.order.kind === 'release') n.clearOrder(); else n.setOrder(a.order); }
  if (a.pose !== undefined) { n.setState('pose', a.secs ?? 6); n.pose = a.pose; }
  if (a.face) { const f = pos(a.face); if (f) n.faceTo(f.x, f.y); }
  if (a.hide) n.hide(a.hide);
  if (a.flee) n.startFlee(pos(a.flee) ?? { x: n.x, y: n.y }, a.secs ?? 4, a.speed ?? 1.8, a.dist ?? 6);
  if (a.noReact !== undefined) n.noReact = !!a.noReact;
  if (a.say) n.say(t(a.say), a.dur ?? 3);
  if (a.wait) await c.host.sleep(a.wait);
});
/** gather: 全城（或 who 列表）NPC 走向 around 周围的同心环，并面向中心；wait=true 等大部分到达（max 秒） */
A('gather', async (a, c) => {
  const p = pos(a.around); if (!p) return;
  const all = c.host.npcs ?? {};
  const who: Npc[] = (a.who ? (a.who as string[]).filter((i) => all[i] || warnOnce('gather:' + i, `[seq] gather.who 缺少 NPC: ${i}`)) .map((i) => all[i]) : Object.values(all).filter((n) => n.def.crowd)).filter(Boolean);
  const r0 = a.r ?? 1.7, per = a.perRing ?? 8;
  const jobs: Promise<void>[] = [];
  who.forEach((n, i) => {
    const ring = Math.floor(i / per), k = i % per, cnt = Math.min(per, who.length - ring * per);
    const ang = (k / cnt) * Math.PI * 2 + ring * 0.5 + 1.1;
    const R = r0 + ring * 1.1;
    n.noReact = true; n.hearts = !!a.hearts;
    const job = n.scriptWalk(p.x + Math.cos(ang) * R, p.y + Math.sin(ang) * R * 0.75).then(() => { n.scriptFace = p; });
    jobs.push(job);
  });
  if (a.wait) await Promise.race([Promise.all(jobs), c.host.sleep(a.max ?? 20)]);
});
A('release', (a, c) => {
  const all = c.host.npcs ?? {};
  for (const n of Object.values(all)) { if (a.who && !(a.who as string[]).includes(n.id)) continue; n.noReact = false; n.hearts = false; n.scriptFace = undefined; n.scriptDest = undefined; n.setState('idle'); }
});

// —— 机关物（公交/自行车/雪橇…）
A('vehicle', async (a, c) => {
  const m = getMechs()?.get(a.id); if (!m) return;
  switch (a.cmd ?? 'start') {
    case 'start': m.start(); break;
    case 'stop': m.stop(); break;
    case 'goto': { const p = pos(a.to); if (p) m.goto(p.x, p.y, a.speed); break; }
    case 'park': m.park(pos(a.to)); break;
    case 'follow': m.setFollow(a.target, a.ox ?? 0, a.oy ?? 0, a.lag); break;
    case 'unfollow': m.clearFollow(); break;
    case 'path': m.setPath(a.path, !!a.loop); break;
  }
  if (a.wait) await m.arrived(a.timeout ?? 40);
});

// —— 场景物 / 现象 / 特效
function fire(c: SeqCtx, propId: string, moveId: string) {
  const h = c.host, p = h.props?.[propId], mv = MOVES[moveId];
  if (!p || !mv || !h.stim) return;
  const s = h.stim.emit(mv, p.x, p.y, propId, h.now ?? 0);
  h.fx?.play(mv.fx, p, s, mv);
  if (mv.event) bus.emit(mv.event);
  bus.emit('prop:fired', propId, moveId);
  if (mv.sfx) bus.emit('sfx', mv.sfx);
}
/** prop: 无视冷却/锁定地触发某物件的招式 */
A('prop', (a, c) => fire(c, a.id, a.move));
/** light: 依次点亮 props，每个间隔 gap 秒（bg:true 则同时做别的）；move 缺省 lamp_glow；每点亮一盏发 'light:on' */
A('light', async (a, c) => {
  const gap = a.gap ?? 0.5;
  for (const id of a.props as string[]) {
    fire(c, id, a.move ?? 'lamp_glow');
    setFlag('lit:' + id); bus.emit('light:on', id);
    if (gap > 0) await c.host.sleep(gap);
  }
});
/** emit: 在 at 处释放一个自定义现象 spec（type/tag/intensity/radius/duration/…） */
A('emit', (a, c) => {
  const p = pos(a.at); if (!p || !c.host.stim) return;
  c.host.stim.emitSpec(a.spec, p.x, p.y, a.src ?? 'seq', c.host.now ?? 0, a.emitId);
});
/** fx: 播放注册过的特效 id（at=实体/坐标 → 作为 bus 'fx:at' 由 fx 层处理） */
A('fx', (a) => { bus.emit('fx:play', { id: a.id, at: a.at, args: a }); });
/** hatMorph: 帽子长出身体 → 圣诞老人。阶段：grow / santa；由 Hat.ts + fx 实现；wait 秒后返回 */
A('hatMorph', async (a, c) => {
  bus.emit('hat:morph', { to: a.to ?? 'santa', s: a.s ?? 4, at: a.at });
  if (a.wait !== false) await c.host.sleep(a.s ?? 4);
});
/**
 * lightString: 终章“接通灯串”——props 依次点亮，相邻两盏之间挂出一段灯串（灯泡沿线依次亮起）。
 * {do:'lightString', props:[...], gap:0.6, closed?:false, z?:62, move?:'lamp_glow', camFollow?:true}
 * camFollow=true 时每点亮一盏发 'cam:to' 让镜头跟着灯走。
 */
A('lightString', async (a, c) => {
  const ids = a.props as string[], gap = a.gap ?? 0.6, P = c.host.props ?? {};
  for (let i = 0; i < ids.length; i++) {
    const p = P[ids[i]];
    if (!p) continue;
    if (a.camFollow) bus.emit('cam:to', { x: p.x, y: p.y, zoom: a.zoom ?? 1.15, s: gap * 0.9, target: ids[i] });
    fire(c, ids[i], a.move ?? 'lamp_glow');
    setFlag('lit:' + ids[i]); bus.emit('light:on', ids[i]);
    const nx = P[ids[(i + 1) % ids.length]];
    if (nx && (i + 1 < ids.length || a.closed)) bus.emit('light:string', { from: [p.x, p.y], to: [nx.x, nx.y], s: gap, z: a.z });
    await c.host.sleep(gap);
  }
  bus.emit('light:done', ids.length);
});
