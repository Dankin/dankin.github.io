import Phaser from 'phaser';
import { NpcDef, NPCS, CFG, t, WORLD_W, WORLD_H } from '../core/data';
import { toScreen, dist, clamp, rand, pick } from '../core/iso';
import { Stimulus, StimulusSystem } from '../core/stimulus';
import { bus } from '../core/bus';
import type { LayerLike } from '../ui/bubble';
import { ART_SCALE, NATIVE_SCALE as NS } from '../art/scale';

/** NPC 显示倍率（lead 决策：art-char 角色按旧尺寸画，×1.3 更清晰；锚点/阴影/点击框同步） */
export const NPC_K = 1.3;
import { getNav } from './nav';
import { entityPos, registerEntity, unregisterEntity, hasFlag, setFlag } from './registry';
import type { NpcDefX, Order, ReactionX, ScheduleEntry } from './types';
import { runReaction } from './reactions';

export type NState = 'idle' | 'listen' | 'startle' | 'dance' | 'chase' | 'linger' | 'away' | 'hide' | 'scripted' | 'sing' | 'warm'
  | 'flee' | 'lookup' | 'freeze' | 'pose' | 'ride';

/** 场景提供给 NPC 的能力 */
export interface NpcHost {
  now: number;
  locked: boolean;
  stim: StimulusSystem;
  /** 当前阶段 id（morning/dusk/…）；缺省视为 'morning' */
  phaseId?: string;
  say(npc: Npc, text: string, dur?: number): void;
  emote(npc: Npc, e: string): void;
  notes(x: number, y: number, n?: number): void;
  hearts(x: number, y: number, n?: number): void;
}

const HIDE_PT = [2.6, 9.0];
const TIMED: NState[] = ['listen', 'startle', 'dance', 'lookup', 'freeze', 'pose'];
/** 这些状态下 NPC 对新现象不再反应（除非反应带 force） */
const BUSY: NState[] = ['scripted', 'sing', 'hide', 'away', 'chase', 'warm', 'flee', 'ride'];

export const asList = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
export function condOk(w: { phase?: string | string[]; flag?: string | string[]; notFlag?: string | string[]; state?: string | string[] } | undefined, phase: string, state?: string) {
  if (!w) return true;
  if (w.phase !== undefined && !asList(w.phase).includes(phase)) return false;
  if (w.flag !== undefined && !asList(w.flag).every((f) => hasFlag(f))) return false;
  if (w.notFlag !== undefined && asList(w.notFlag).some((f) => hasFlag(f))) return false;
  if (w.state !== undefined && state !== undefined && !asList(w.state).includes(state)) return false;
  return true;
}

export class Npc {
  id: string; def: NpcDef; ext: NpcDefX;
  x: number; y: number;
  state: NState = 'idle'; stateT = 0; stateDur = 0;
  wp = 0; waitT = 0; face = 1; moving = false; walkT = 0;
  spr: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image;
  annoyLog: { t: number; src: string }[] = [];
  sayCd = 0; followT = 0; idleSayT = rand(6, 11); pollT = rand(0, 0.3);
  chase?: Stimulus; chaseF?: { type?: string; tag?: string; arrive?: string; say?: string }; arrived = false; chaseAng = 0; chaseT = 0;
  scriptDest?: { x: number; y: number }; scriptDone?: () => void; scriptFace?: { x: number; y: number }; scriptT = 0;
  hearts = false; noReact = false; singUntil = 0; noteT = 0;
  hideT = 0;
  // —— 扩展 ——
  order?: Order;
  pose = '';                     // 当前姿态后缀
  fleeFrom?: { x: number; y: number }; fleeSpeed = 1.8; fleeDist = 6; fleeTo?: number[]; fleeT = 0;
  lookAt?: { x: number; y: number };
  lod: 0 | 1 = 0;
  /** E15：当前日程为 hidden：不渲染、不可点选（Game 点击检测请跳过 ghost） */
  ghost = false;
  irritation = 0;                // 0..1，给 HUD/调试
  private path: number[][] = []; private pg: { x: number; y: number } | null = null; private navV = -1; private stuckT = 0; private lastX = 0; private lastY = 0;
  private sched?: ScheduleEntry; private schedKey = ''; private rIdx = 0; private rDir = 1; private schedT = 0;
  private reactCd = new Map<string, number>();
  private awayPt = [0, 0];
  private lastPhase = '';

  constructor(scene: Phaser.Scene, public host: NpcHost, id: string, layer: LayerLike) {
    this.id = id; this.def = NPCS[id]; this.ext = this.def as unknown as NpcDefX;
    this.x = this.def.home[0]; this.y = this.def.home[1]; this.lastX = this.x; this.lastY = this.y;
    this.wp = Math.floor(Math.random() * this.def.waypoints.length);
    const s = toScreen(this.x, this.y);
    const k = (this.ext.scale ?? 1) * NPC_K;
    this.shadow = scene.add.image(s.x, s.y - 2, 'p_shadow').setScale(0.7 * NS * k, 0.7 * NS * k).setAlpha(0.5);
    this.spr = scene.add.image(s.x, s.y, `c_${id}_0`).setOrigin(0.5, 1).setScale(ART_SCALE * k);
    layer.add(this.shadow); layer.add(this.spr);
    this.chaseAng = (id.charCodeAt(0) * 1.7) % (Math.PI * 2);
    registerEntity('npc:' + id, () => ({ x: this.x, y: this.y }));
    if (this.ext.emit) host.stim.setEmitter('npc:' + id, { ...this.ext.emit, anchor: 'npc:' + id }, this.x, this.y, host.now);
  }

  destroy() {
    unregisterEntity('npc:' + this.id);
    this.host.stim.setEmitter('npc:' + this.id, null);
    this.spr.destroy(); this.shadow.destroy();
  }

  get anchor() { return { x: this.spr.x, y: this.spr.y - (this.def.kid ? 44 : 54) * (this.ext.scale ?? 1) * NPC_K }; }
  get busy() { return BUSY.includes(this.state); }
  get phase() { return this.host.phaseId ?? 'morning'; }
  get currentRoute() { return this.sched?.id ?? (this.sched ? 'sched' : this.def.patrol ? 'patrol' : 'wander'); }

  setState(s: NState, dur = 0) { this.state = s; this.stateT = 0; this.stateDur = dur; if (s !== 'pose') this.pose = ''; }
  say(text: string, dur = 3) { this.host.say(this, text, dur); }

  faceTo(x: number, y: number) {
    const a = toScreen(this.x, this.y), b = toScreen(x, y);
    if (Math.abs(b.x - a.x) > 2) this.face = b.x > a.x ? 1 : -1;
  }

  /** 下达/取消指令（故事、序列用）。指令优先于日程；状态机的 busy 状态优先于指令。 */
  setOrder(o: Order | undefined) {
    this.order = o; this.pg = null;
    if (o?.kind === 'ride') this.setState('ride');
    else if (this.state === 'ride') this.setState('idle');
  }
  clearOrder() { this.setOrder(undefined); }

  // ───────────── 移动：沿导航路径行走 ─────────────
  /** 朝目标走一步（自动寻路绕开建筑/水面/阻挡）。到达返回 true。 */
  walkTo(tx: number, ty: number, speedMul = 1, dt = 0.016, stop = 0.06): boolean {
    const dGoal = dist(this.x, this.y, tx, ty);
    if (dGoal < stop) { this.moving = false; return true; }
    const nav = getNav();
    if (!this.pg || this.navV !== nav.version || dist(this.pg.x, this.pg.y, tx, ty) > 0.6) {
      this.pg = { x: tx, y: ty }; this.navV = nav.version;
      this.path = nav.path(this.x, this.y, tx, ty) ?? [[tx, ty]];
    }
    const p = this.path[0];
    if (!p) { this.moving = false; return true; }
    const d = dist(this.x, this.y, p[0], p[1]);
    const last = this.path.length === 1;
    if (d < 0.08) { this.path.shift(); return !this.path.length && dGoal < stop + 0.2; }
    const step = Math.min(d, this.def.speed * speedMul * dt);
    const nx = this.x + ((p[0] - this.x) / d) * step, ny = this.y + ((p[1] - this.y) / d) * step;
    // 动态阻挡：下一步踏入阻挡则停（等待/重规划），避免穿过机关
    if (!nav.walkable(nx, ny) && nav.walkable(this.x, this.y)) { this.pg = null; this.moving = false; return false; }
    this.faceTo(p[0], p[1]);
    this.x = clamp(nx, 0.3, WORLD_W - 0.3); this.y = clamp(ny, 0.3, WORLD_H - 0.3);
    this.moving = true;
    if (last && step >= d - 0.001 && d <= stop + 0.01) return true;
    return last && step >= d - 0.001;
  }

  private stuckCheck(dt: number) {
    if (this.moving && dist(this.x, this.y, this.lastX, this.lastY) < dt * 0.1) this.stuckT += dt; else this.stuckT = 0;
    if (this.stuckT > 1.5) { this.pg = null; this.stuckT = 0; }
    this.lastX = this.x; this.lastY = this.y;
  }

  // ───────────── 感知 ─────────────
  /** 脉冲型现象（一次性广播）与持续型现象（轮询）共用 */
  perceive(s: Stimulus, now: number, polled = false) {
    if (this.noReact) return;
    const I = this.host.stim.at(s, this.x, this.y);
    if (I <= 0.02) return;
    if (!polled && s.type === 'sound' && s.source !== 'self') this.logAnnoy(s, now);
    const reacts = this.def.reactions as unknown as ReactionX[];
    for (let i = 0; i < reacts.length; i++) {
      const r = reacts[i];
      if (r.on.type !== s.type || (r.on.tag && r.on.tag !== s.tag) || I < (r.on.min ?? 0)) continue;
      // 持续型现象只触发声明 poll 的反应（脉冲反应只吃广播），避免每次轮询重复触发
      if (polled && !r.poll) continue;
      if (!polled && r.poll && s.sustained) { /* 持续现象刚出现也允许立刻触发 */ }
      if (!condOk(r.when, this.phase, this.state)) continue;
      if (this.busy && !r.force) continue;
      if (this.state === 'scripted' || this.state === 'sing' || this.state === 'warm') continue;
      const key = `${i}`;
      if ((this.reactCd.get(key) ?? 0) > now) continue;
      if (r.chance !== undefined && Math.random() > r.chance) continue;
      this.reactCd.set(key, now + (r.cd ?? (polled ? 6 : 0)));
      this.faceTo(s.x, s.y);
      if (r.say && this.sayCd <= 0) { this.say(t(r.say), 2.6); this.sayCd = 2.5; }
      if (r.emote) this.host.emote(this, r.emote);
      runReaction(this, r, s, I);
      if (r.set) setFlag(r.set);
      if (r.clear) setFlag(r.clear, 0);
      if (r.event) bus.emit(r.event, this.id);
      if (r.emit) this.host.stim.emitSpec(r.emit, this.x, this.y, 'npc:' + this.id, now);
      return;
    }
  }

  private sense(now: number) {
    for (const s of this.host.stim.active) if (s.sustained) this.perceive(s, now, true);
  }

  private logAnnoy(s: Stimulus, now: number) {
    if (((CFG as any).annoyOffFlags as string[] | undefined)?.some((f) => hasFlag(f))) return;   // E20
    const a = this.def.annoy as NpcDef['annoy'] & { types?: string[]; tags?: string[] };
    if (a.types && !a.types.includes(s.type)) return;
    this.annoyLog.push({ t: now, src: s.source });
    this.annoyLog = this.annoyLog.filter((x) => now - x.t < a.window);
    const count = this.annoyLog.filter((x) => x.src === s.source).length;
    this.irritation = clamp(count / (a.tiers[a.tiers.length - 1] || 3), 0, 1);
    const idx = a.tiers.indexOf(count);
    if (idx < 0) return;
    bus.emit('npc:annoy', this.id, idx);
    if (idx === 0) this.host.emote(this, '…');
    else {
      const q = a.quips[Math.min(idx - 1, a.quips.length - 1)];
      this.say(t(q), 3);
      if (idx === 2) {
        this.annoyLog = []; this.irritation = 0;
        if (a.leave === 'away' && this.def.away) this.leave();
        else if (a.leave === 'hide') this.hide(10);
      }
    }
  }

  leave() { this.awayPt = pick(this.def.away!); this.setState('away', 16); }
  hide(secs: number) { this.setState('hide', secs); }
  private hidePt() { return this.ext.hideAt ?? HIDE_PT; }

  // ───────────── 每帧 ─────────────
  update(dt: number, now: number, lod: 0 | 1 = 0) {
    this.stateT += dt; this.sayCd -= dt; this.moving = false;
    const wasLod = this.lod; this.lod = lod;
    const h = this.host;
    if (this.irritation > 0) this.irritation = Math.max(0, this.irritation - dt * 0.05);
    switch (this.state) {
      case 'idle': this.tickIdle(dt); break;
      case 'linger': if (this.stateT > 3.5) this.setState('idle'); break;
      case 'away':
        if (this.walkTo(this.awayPt[0], this.awayPt[1], 1.3, dt) && this.stateT > this.stateDur) this.setState('idle');
        break;
      case 'hide': {
        const hp = this.hidePt();
        this.walkTo(hp[0], hp[1], 1.4, dt);
        if (this.stateT > this.stateDur) this.setState('idle');
        break;
      }
      case 'flee': this.tickFlee(dt); break;
      case 'chase': this.tickChase(dt); break;
      case 'ride': this.tickRide(); break;
      case 'scripted':
        if (this.scriptDest) {
          this.scriptT += dt;
          const ok = this.walkTo(this.scriptDest.x, this.scriptDest.y, 1.3, dt);
          if (ok || this.scriptT > 40) {
            this.scriptDest = undefined;
            const f = this.scriptDone; this.scriptDone = undefined; f?.();
          }
        } else if (this.scriptFace) this.faceTo(this.scriptFace.x, this.scriptFace.y);
        if (!lod && this.hearts && (this.noteT -= dt) < 0) { this.noteT = rand(0.8, 1.4); h.hearts(this.spr.x, this.anchor.y + 8, 1); }
        break;
      case 'sing':
        if (!lod && (this.noteT -= dt) < 0) { this.noteT = 0.38; h.notes(this.spr.x, this.spr.y - 56, 1); }
        if (now > this.singUntil) this.setState('warm');
        break;
      case 'warm':
        if (!lod && (this.noteT -= dt) < 0) { this.noteT = rand(2.5, 4.5); h.notes(this.spr.x, this.spr.y - 56, 1); }
        break;
      default: // 定时状态
        if (TIMED.includes(this.state) && this.stateT > this.stateDur) this.setState('idle');
    }
    if (this.state === 'lookup' && this.lookAt) this.faceTo(this.lookAt.x, this.lookAt.y);
    // 阶段切换：日程重选
    if (this.phase !== this.lastPhase) { this.lastPhase = this.phase; this.schedKey = ''; }
    // 追随（持续型现象的 follows）+ 轮询感知（仅屏内，降低开销）
    if (!lod && !h.locked) {
      if ((this.state === 'idle' || this.state === 'listen' || this.state === 'dance' || this.state === 'linger') && this.def.follows) {
        this.followT -= dt;
        if (this.followT <= 0) { this.followT = 0.3; this.tryFollow(); }
      }
      if ((this.pollT -= dt) <= 0) { this.pollT = 0.35; this.sense(now); }
    }
    // 自言自语
    if (!lod && this.def.idleSay && this.state === 'idle' && !this.order && !h.locked) {
      this.idleSayT -= dt;
      if (this.idleSayT <= 0) { this.idleSayT = rand(10, 18); if (this.sayCd <= 0) { this.say(t(this.def.idleSay), 3); this.sayCd = 3; } }
    }
    this.stuckCheck(dt);
    this.ghost = !!this.sched?.hidden && !this.order;
    const off = lod || this.ghost;
    if (off) { if (this.spr.visible) { this.spr.setVisible(false); this.shadow.setVisible(false); } }
    else { if (!this.spr.visible) { this.spr.setVisible(true); this.shadow.setVisible(true); } this.render(dt); }
  }

  // ───────────── 空闲：指令 > 日程 > 旧版巡逻/游走 ─────────────
  private pickSchedule() {
    const list = this.ext.schedule;
    if (!list) return undefined;
    for (let i = 0; i < list.length; i++) if (condOk(list[i].when, this.phase)) return { e: list[i], key: `${i}` };
    return undefined;
  }

  private tickIdle(dt: number) {
    const o = this.order;
    if (o) { this.tickOrder(o, dt); return; }
    if ((this.schedT -= dt) <= 0) {
      this.schedT = 0.5;
      const p = this.pickSchedule();
      const key = p?.key ?? '';
      if (key !== this.schedKey) { this.schedKey = key; this.sched = p?.e; this.rIdx = 0; this.rDir = 1; this.waitT = 0; this.pg = null; }
    }
    const e = this.sched;
    if (e) { this.tickRoute(e, dt); return; }
    this.tickWander(dt);
  }

  private tickOrder(o: Order, dt: number) {
    switch (o.kind) {
      case 'goto':
        if (this.walkTo(o.x, o.y, o.speed ?? 1, dt, o.stop ?? 0.08)) {
          const f = o.onArrive; o.onArrive = undefined; f?.();
          if (o.face) this.faceTo(o.face[0], o.face[1]);
          if (o.pose) this.pose = o.pose;
        }
        break;
      case 'follow': {
        const p = entityPos(o.target); if (!p) break;
        const d = o.dist ?? 1.1, side = o.side ?? 0;
        const tx = p.x - Math.cos(this.chaseAng) * d * 0.2 - d + side, ty = p.y + side * 0.5;
        if (dist(this.x, this.y, p.x, p.y) > d + 0.3) this.walkTo(tx, ty, o.speed ?? 1.2, dt, d * 0.5); else this.faceTo(p.x, p.y);
        break;
      }
      case 'stay':
        if (o.face) this.faceTo(o.face[0], o.face[1]);
        if (o.pose) this.pose = o.pose;
        break;
      case 'ride': break; // 由 ride 状态处理
    }
  }

  private tickRide() {
    const o = this.order;
    if (!o || o.kind !== 'ride') { this.setState('idle'); return; }
    const p = entityPos(o.target); if (!p) return;
    this.x = p.x + (o.ox ?? 0); this.y = p.y + (o.oy ?? 0); this.pose = o.pose ?? '';
  }

  private tickRoute(e: ScheduleEntry, dt: number) {
    const r = e.route; if (!r.length) return;
    if (this.waitT > 0) { this.waitT -= dt; if (e.face) this.faceTo(e.face[0], e.face[1]); if (e.pose) this.pose = e.pose; return; }
    this.pose = '';
    const p = r[this.rIdx];
    if (this.walkTo(p[0], p[1], e.speed ?? 0.8, dt)) {
      const w = p[2] ?? (Array.isArray(e.wait) ? rand(e.wait[0], e.wait[1]) : e.wait ?? rand(1.5, 4));
      this.waitT = w;
      if (e.mode === 'stay' || r.length === 1) { this.waitT = 1e9; return; }
      if (e.mode === 'random') { let n = this.rIdx; while (r.length > 1 && n === this.rIdx) n = Math.floor(Math.random() * r.length); this.rIdx = n; }
      else if (e.mode === 'pingpong') { if (this.rIdx + this.rDir < 0 || this.rIdx + this.rDir >= r.length) this.rDir *= -1; this.rIdx += this.rDir; }
      else this.rIdx = (this.rIdx + 1) % r.length;
    }
  }

  private tickWander(dt: number) {
    const w = this.def.waypoints;
    if (this.def.patrol) {
      const p = w[this.wp];
      if (this.walkTo(p[0], p[1], 1, dt)) this.wp = (this.wp + 1) % w.length;
      return;
    }
    if (this.waitT > 0) { this.waitT -= dt; return; }
    const p = w[this.wp];
    if (this.walkTo(p[0], p[1], 0.7, dt)) {
      this.waitT = rand(2.5, 5.5);
      let n = this.wp; while (w.length > 1 && n === this.wp) n = Math.floor(Math.random() * w.length);
      this.wp = n;
    }
  }

  // ───────────── 逃跑 ─────────────
  startFlee(from: { x: number; y: number }, secs: number, speed = 1.8, d = 6, to?: number[] | 'home') {
    this.fleeFrom = from; this.fleeSpeed = speed; this.fleeDist = d;
    this.fleeTo = to === 'home' ? [this.def.home[0], this.def.home[1]] : to;
    this.fleeT = 0; this.pg = null;
    this.setState('flee', secs);
  }
  private tickFlee(dt: number) {
    if (this.stateT > this.stateDur) { this.setState('idle'); return; }
    let tx: number, ty: number;
    if (this.fleeTo) { tx = this.fleeTo[0]; ty = this.fleeTo[1]; }
    else {
      const f = this.fleeFrom!;
      let dx = this.x - f.x, dy = this.y - f.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      tx = this.x + dx * this.fleeDist; ty = this.y + dy * this.fleeDist;
      const n = getNav().nearestWalkable(clamp(tx, 0.5, WORLD_W - 0.5), clamp(ty, 0.5, WORLD_H - 0.5), 5);
      if (n) { tx = n[0]; ty = n[1]; }
    }
    if (this.walkTo(tx, ty, this.fleeSpeed, dt, 0.3) && this.stateT > 1.0) this.setState('linger');
  }

  // ───────────── 追随现象 ─────────────
  startChase(s: Stimulus, f: Npc['chaseF'], maxSecs = 0) {
    this.chase = s; this.chaseF = f; this.arrived = false; this.chaseT = maxSecs; this.pg = null;
    this.setState('chase');
  }
  private tryFollow() {
    for (const s of this.host.stim.active) {
      for (const f of this.def.follows!) {
        if (f.type !== s.type || f.tag !== s.tag) continue;
        const I = this.host.stim.at(s, this.x, this.y);
        if (I > 0.1 && Math.random() < (f.chance ?? 0.9)) {
          this.startChase(s, f);
          if (f.say) this.say(t(f.say), 2.6);
          return;
        }
      }
    }
  }
  private tickChase(dt: number) {
    const s = this.chase!;
    if (!this.host.stim.active.includes(s) || (this.chaseT > 0 && this.stateT > this.chaseT)) { this.chase = undefined; this.setState('linger'); return; }
    const tx = s.x + Math.cos(this.chaseAng) * 1.1, ty = s.y + Math.sin(this.chaseAng) * 1.1;
    const d = dist(this.x, this.y, tx, ty);
    if (d > 0.35) this.walkTo(tx, ty, 1.25, dt, 0.3);
    else {
      this.faceTo(s.x, s.y);
      if (!this.arrived) {
        this.arrived = true;
        if (this.chaseF?.arrive) bus.emit(this.chaseF.arrive, this.id);
      }
    }
  }

  // ───────────── 渲染 ─────────────
  private has(k: string) { return this.spr.scene.textures.exists(k); }
  /** 选帧：姿态覆盖 > 情绪帧(emo_*) > 行走帧(walk_0..3，bob 已画进帧) > 待机帧(idle_0/1) > 旧 0/1 */
  private tex(frame: number, mode: 'walk' | 'idle' | 'dance' | 'sing', T: number) {
    const id = this.id, pick1 = (...ks: string[]) => { for (const k of ks) if (this.has(`c_${id}_${k}`)) return `c_${id}_${k}`; return null; };
    if (this.pose) { const r = pick1(this.pose); if (r) return r; }
    let r: string | null = null;
    switch (this.state) {
      case 'lookup': r = pick1('up', 'emo_listen'); break;
      case 'freeze': r = pick1('scared', 'emo_scared'); break;
      case 'startle': r = pick1('emo_surprised'); break;
      case 'listen': r = pick1('emo_listen'); break;
      case 'sing': r = pick1(`emo_sing_${frame & 1}`); break;
      case 'dance': r = pick1(`emo_dance_${frame & 1}`); break;
      case 'flee': r = this.moving ? null : pick1('emo_scared'); break;
      default: break;
    }
    if (r) return r;
    if (mode === 'dance') { r = pick1(`emo_dance_${frame & 1}`); if (r) return r; }
    if (this.irritation > 0.7 && !this.moving) { r = pick1('emo_annoyed'); if (r) return r; }
    if (mode === 'walk') { r = pick1(`walk_${Math.floor(frame) % 4}`); if (r) return r; }
    r = pick1(`idle_${Math.floor(T / 0.7 + this.tphase) % 2}`, `${frame & 1}`);
    return r ?? `c_${id}_0`;
  }
  private tphase = Math.random() * 2;

  private render(dt: number) {
    const s = toScreen(this.x, this.y);
    let bob = 0, ang = 0, flip = this.face < 0, dx = 0;
    const tt = this.stateT, T = this.host.now;
    let frame = 0;
    const k = (this.ext.scale ?? 1) * NPC_K;
    if (this.moving) {
      this.walkT += dt;
      const run = this.state === 'flee' ? 1.7 : 1;
      frame = Math.floor(this.walkT * run / 0.12) % 4;
      bob = this.has(`c_${this.id}_walk_0`) ? 0 : Math.abs(Math.sin(this.walkT * 17 * run)) * 2.5 * (this.state === 'flee' ? 1.4 : 1);
    }
    const dancing = this.state === 'dance' || (this.state === 'chase' && this.arrived && this.chase?.type === 'company')
      || (this.def.dancer && this.state === 'idle' && this.waitT > 0);
    if (dancing) {
      bob = Math.abs(Math.sin(T * 9)) * 5; ang = Math.sin(T * 7) * 0.14;
      frame = Math.floor(T / 0.25) % 2; flip = Math.floor(T / 0.5) % 2 === 0;
    }
    if (this.state === 'startle') bob = Math.sin(clamp(tt / 0.5, 0, 1) * Math.PI) * 12;
    if (this.state === 'sing') { ang = Math.sin(T * 3.2) * 0.06; bob = Math.abs(Math.sin(T * 6)) * 2; frame = Math.floor(T / 0.4) % 2; }
    if (this.state === 'warm' || (this.state === 'scripted' && !this.moving && this.scriptFace)) { ang = Math.sin(T * 2.4 + this.chaseAng) * 0.05; }
    if (this.state === 'listen') { bob = Math.sin(T * 5) * 1.2; }
    if (this.state === 'lookup') { ang = -0.07 * (flip ? -1 : 1); bob = Math.sin(T * 2) * 0.8; }
    if (this.state === 'freeze') { dx = Math.sin(T * 38) * 1.4; }
    if (this.state === 'pose' || (this.pose && !this.moving)) { ang = Math.sin(T * 2.4 + this.chaseAng) * 0.03; }
    this.spr.setTexture(this.tex(frame, dancing ? 'dance' : this.moving ? 'walk' : 'idle', T));
    this.spr.setPosition(s.x + dx, s.y - bob).setRotation(ang).setFlipX(flip).setDepth(s.y);
    this.shadow.setPosition(s.x, s.y - 2).setDepth(s.y - 1).setScale((0.7 - bob * 0.01) * NS * k, (0.7 - bob * 0.01) * NS * k);
  }

  /** 序列用：走到某点（沿路径），完成后 resolve；有超时兜底 */
  scriptWalk(x: number, y: number): Promise<void> {
    return new Promise((res) => {
      this.setState('scripted');
      this.order = undefined; this.pg = null; this.scriptT = 0;
      this.scriptDest = { x, y };
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      this.scriptDone = fin;
    });
  }

  /** 调试快照 */
  debug() {
    return {
      id: this.id, x: +this.x.toFixed(2), y: +this.y.toFixed(2), state: this.state, pose: this.pose, moving: this.moving,
      lod: this.lod, route: this.currentRoute, order: this.order?.kind ?? null, pathLeft: this.path.length,
      irritation: +this.irritation.toFixed(2), chase: this.chase ? `${this.chase.type}:${this.chase.tag}` : null,
    };
  }
}
