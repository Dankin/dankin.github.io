import Phaser from 'phaser';
import { toScreen, ART_SCALE, NATIVE_SCALE, clamp } from '../core/iso';
import { bus } from '../core/bus';
import type { EmitSpec, StimulusSystem } from '../core/stimulus';
import { registerEntity, unregisterEntity, entityPos, setFlag } from './registry';
import { condOk } from './Npc';
import { getNav } from './nav';
import type { LayerLike } from '../ui/bubble';

/**
 * 机关物（公交车、自行车、雪橇、轮椅、气球串……）：会沿路径移动 / 跟随某个实体 的“道具”。
 * 数据（mechs.json，键=id）：
 * {
 *   "bus": {
 *     "tex": "m_bus",             // 纹理键（缺失则用占位方块，不会崩）
 *     "scale": 1,                 // 额外缩放（相对 ART_SCALE）
 *     "origin": [0.5, 0.9],
 *     "path": [[3,9],[20,9],[20,12]],   // 路点（世界格坐标），点可带第 3 个数=停留秒数
 *     "mode": "loop|pingpong|once",     // 缺省 loop
 *     "speed": 2.2,               // 格/秒
 *     "auto": true,               // 是否自动出发（false=等 vehicle 动作/事件）
 *     "startDelay": 0,
 *     "when": { "phase": "morning", "flag": "x", "notFlag": "y" },   // 仅在条件满足时运行
 *     "anim": "roll|bob|sway|slide|none",
 *     "blocks": [2.2, 1.0],       // 占地 w×h（格），NPC 绕行；停着时也占
 *     "carries": ["npcA"],        // 沿途载着的 NPC（ride 指令）
 *     "emit": { "type":"sound","tag":"engine","intensity":0.6,"radius":6 },  // 随车移动的现象
 *     "follow": { "target": "npc:adong", "ox": 0.6, "oy": 0.3 },            // 跟随实体（轮椅/气球串）
 *     "z": 0,                     // 抬高像素（气球串）
 *     "onStop": "event_name"      // 每次到站发的 bus 事件
 *   }
 * }
 */
export interface MechDef {
  tex: string; scale?: number; origin?: number[];
  path?: number[][]; mode?: 'loop' | 'pingpong' | 'once'; speed?: number;
  auto?: boolean; startDelay?: number;
  when?: { phase?: string | string[]; flag?: string | string[]; notFlag?: string | string[] };
  anim?: 'roll' | 'bob' | 'sway' | 'slide' | 'none';
  blocks?: number[]; carries?: string[]; emit?: EmitSpec;
  follow?: { target: string; ox?: number; oy?: number; lag?: number };
  z?: number; onStop?: string | { set?: string | string[]; clear?: string | string[]; event?: string }; name?: string; hidden?: boolean;
}

export interface MechHost { now: number; stim: StimulusSystem; phaseId?: string; npcs?: Record<string, import('./Npc').Npc> }

type MState = 'parked' | 'moving' | 'waiting';

export class Mech {
  x = 0; y = 0; heading = 0; state: MState = 'parked';
  spr: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image;
  private path: number[][] = []; private idx = 0; private dir = 1; private waitT = 0; private walk = 0;
  private startT = 0; private on = false; private lastBlock = { x: -99, y: -99 };
  private waiters: (() => void)[] = [];
  private goSpeed?: number;
  private riders: string[] = [];
  private mode: 'loop' | 'pingpong' | 'once';
  follow?: MechDef['follow'];

  constructor(scene: Phaser.Scene, layer: LayerLike, private host: MechHost, public id: string, public def: MechDef) {
    this.path = def.path?.map((p) => [...p]) ?? [];
    this.mode = def.mode ?? 'loop';
    this.follow = def.follow;
    if (this.path[0]) { this.x = this.path[0][0]; this.y = this.path[0][1]; }
    if (this.follow) { const p = entityPos(this.follow.target); if (p) { this.x = p.x + (this.follow.ox ?? 0); this.y = p.y + (this.follow.oy ?? 0); } }
    const s = toScreen(this.x, this.y);
    const key = ensureTex(scene, def.tex, def.blocks);
    const o = def.origin ?? [0.5, 0.9];
    this.spr = scene.add.image(s.x, s.y, key).setOrigin(o[0], o[1]).setScale(ART_SCALE * (def.scale ?? 1));
    this.shadow = scene.add.image(s.x, s.y - 2, 'p_shadow').setScale((def.blocks?.[0] ?? 1.2) * 1.3 * NATIVE_SCALE * 1.6, 0.9 * NATIVE_SCALE * 1.6).setAlpha(0.45);
    layer.add(this.shadow); layer.add(this.spr);
    if (def.hidden) { this.spr.setVisible(false); this.shadow.setVisible(false); }
    registerEntity('mech:' + id, () => ({ x: this.x, y: this.y }));
    if (def.emit) host.stim.setEmitter('mech:' + id, { ...def.emit, anchor: 'mech:' + id }, this.x, this.y, host.now);
    this.startT = host.now + (def.startDelay ?? 0);
    this.on = def.auto !== false;
    this.riders = [...(def.carries ?? [])];
  }

  destroy() {
    unregisterEntity('mech:' + this.id);
    this.host.stim.setEmitter('mech:' + this.id, null);
    getNav().removeBlocker('mech:' + this.id);
    this.spr.destroy(); this.shadow.destroy();
  }

  // —— 指令（序列 / 故事 / 反应）
  start() { this.on = true; this.startT = 0; if (this.state === 'parked') this.state = 'moving'; this.board(); bus.emit('mech:start', this.id); }
  stop() { this.on = false; this.state = 'parked'; this.unboard(); this.fire(); }
  park(at?: { x: number; y: number }) { this.follow = undefined; if (at) { this.x = at.x; this.y = at.y; } this.stop(); }
  /** 开始跟随实体（序列 vehicle cmd:follow） */
  setFollow(target: string, ox = 0, oy = 0, lag?: number) { this.follow = { target, ox, oy, lag }; this.state = 'moving'; this.board(); }
  clearFollow() { this.follow = undefined; this.state = 'parked'; this.unboard(); }
  /** 临时改道：走到 (x,y) 后停车 */
  goto(x: number, y: number, speed?: number) {
    this.path = [[this.x, this.y], [x, y]]; this.idx = 1; this.mode = 'once'; this.goSpeed = speed; this.on = true; this.state = 'moving'; this.board();
  }
  setPath(p: number[][], loop = false) { this.path = p.map((q) => [...q]); this.idx = 1; this.mode = loop ? 'loop' : 'once'; this.on = true; this.state = 'moving'; this.board(); }
  /** 等到停车（到终点/被 stop）；超时兜底 */
  arrived(timeout = 40) {
    return new Promise<void>((res) => {
      if (this.state === 'parked') return res();
      const t = setTimeout(res, timeout * 1000);
      this.waiters.push(() => { clearTimeout(t); res(); });
    });
  }
  private fire() { const w = this.waiters; this.waiters = []; w.forEach((f) => f()); const os = this.def.onStop;
    if (typeof os === 'string') bus.emit(os, this.id);
    else if (os) { for (const f of ([] as string[]).concat(os.set ?? [])) setFlag(f); for (const f of ([] as string[]).concat(os.clear ?? [])) setFlag(f, 0); if (os.event) bus.emit(os.event, this.id); } bus.emit('mech:stop', this.id); }
  private board() {
    const npcs = this.host.npcs; if (!npcs) return;
    this.riders.forEach((id, i) => npcs[id]?.setOrder({ kind: 'ride', target: 'mech:' + this.id, ox: (i - (this.riders.length - 1) / 2) * 0.5, oy: 0 }));
  }
  private unboard() { const npcs = this.host.npcs; if (!npcs) return; for (const id of this.riders) if (npcs[id]?.order?.kind === 'ride') npcs[id].clearOrder(); }

  get active() { return condOk(this.def.when, this.host.phaseId ?? 'morning'); }

  update(dt: number, now: number, lod: 0 | 1 = 0) {
    const d = this.def;
    const fo = this.follow;
    if (fo) {
      const p = entityPos(fo.target);
      if (p) {
        const tx = p.x + (fo.ox ?? 0), ty = p.y + (fo.oy ?? 0), k = clamp(dt * (fo.lag ?? 8), 0, 1);
        const px = this.x, py = this.y;
        this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
        const sp = Math.hypot(this.x - px, this.y - py) / Math.max(dt, 1e-3);
        this.state = sp > 0.15 ? 'moving' : 'parked';
        if (sp > 0.05) this.heading = Math.atan2(this.y - py, this.x - px);
      }
    } else {
      if (this.on && !this.active) { if (this.state !== 'parked') { this.state = 'parked'; this.unboard(); } }
      else if (this.on && this.state === 'parked' && now >= this.startT && this.path.length > 1) { this.state = 'moving'; this.board(); bus.emit('mech:start', this.id); }
      if (this.state === 'waiting') { this.waitT -= dt; if (this.waitT <= 0) this.state = 'moving'; }
      if (this.state === 'moving') this.step(dt);
    }
    this.syncBlock();
    if (lod === 1) { this.spr.setVisible(false); this.shadow.setVisible(false); return; }
    this.render(dt, now);
  }

  private step(dt: number) {
    const p = this.path[this.idx];
    if (!p) { this.finish(); return; }
    const dx = p[0] - this.x, dy = p[1] - this.y, dist = Math.hypot(dx, dy);
    const sp = (this.goSpeed ?? this.def.speed ?? 2) * dt;
    if (dist <= sp + 0.02) {
      this.x = p[0]; this.y = p[1];
      if (p[2]) { this.state = 'waiting'; this.waitT = p[2]; bus.emit('mech:arrive', this.id, this.idx); this.fire(); }
      else bus.emit('mech:arrive', this.id, this.idx);
      this.advance();
    } else {
      this.x += (dx / dist) * sp; this.y += (dy / dist) * sp; this.heading = Math.atan2(dy, dx);
    }
  }
  private advance() {
    const n = this.path.length;
    if (this.mode === 'once') { if (this.idx >= n - 1) { this.finish(); return; } this.idx++; }
    else if (this.mode === 'loop') this.idx = (this.idx + 1) % n;
    else { if (this.idx + this.dir >= n || this.idx + this.dir < 0) this.dir *= -1; this.idx += this.dir; }
  }
  private finish() { this.state = 'parked'; this.on = this.mode !== 'once' ? this.on : false; this.goSpeed = undefined; this.unboard(); this.fire(); }

  /** 占地：动了超过 0.35 格才更新，避免每帧重算导航 */
  private syncBlock() {
    const b = this.def.blocks; if (!b) return;
    if (Math.hypot(this.x - this.lastBlock.x, this.y - this.lastBlock.y) < 0.35) return;
    this.lastBlock = { x: this.x, y: this.y };
    getNav().addBlocker('mech:' + this.id, this.x - b[0] / 2, this.y - b[1] / 2, this.x + b[0] / 2, this.y + b[1] / 2);
  }

  private render(dt: number, now: number) {
    const s = toScreen(this.x, this.y);
    const moving = this.state === 'moving';
    if (moving) this.walk += dt;
    let bob = 0, ang = 0;
    switch (this.def.anim ?? 'roll') {
      case 'roll': if (moving) { bob = Math.abs(Math.sin(this.walk * 14)) * 1.6; ang = Math.sin(this.walk * 9) * 0.01; } break;
      case 'bob': bob = Math.sin(now * 2 + this.x) * 3 + (this.def.z ?? 0) * 0; break;
      case 'sway': ang = Math.sin(this.walk * 7) * 0.05 * (moving ? 1 : 0); bob = moving ? Math.abs(Math.sin(this.walk * 7)) * 1.2 : 0; break;
      case 'slide': ang = moving ? Math.sin(now * 3) * 0.015 : 0; break;
    }
    const sx = Math.cos(this.heading) - Math.sin(this.heading); // 屏幕 x 方向 = dx - dy
    if (Math.abs(sx) > 0.15) this.spr.setFlipX(sx < 0);
    this.spr.setVisible(!this.def.hidden).setPosition(s.x, s.y - bob - (this.def.z ?? 0)).setRotation(ang).setDepth(s.y + 2);
    this.shadow.setVisible(!this.def.hidden).setPosition(s.x, s.y - 2).setDepth(s.y - 1);
  }

  debug() {
    return { id: this.id, x: +this.x.toFixed(2), y: +this.y.toFixed(2), state: this.state, idx: this.idx, on: this.on, active: this.active, riders: this.riders };
  }
}

/** 纹理缺失时生成占位（带名字色块），避免 art 还没画好时报错 */
function ensureTex(scene: Phaser.Scene, key: string, blocks?: number[]) {
  if (scene.textures.exists(key)) return key;
  const k = '__mech_' + key;
  if (scene.textures.exists(k)) return k;
  const w = Math.round((blocks?.[0] ?? 1.5) * 40), h = 36;
  const g = scene.add.graphics({ x: 0, y: 0 });
  g.fillStyle(0xd96a4a, 1).fillRoundedRect(0, 8, w, h - 8, 5);
  g.fillStyle(0xf3d9a8, 1).fillRect(5, 12, w - 10, 10);
  g.fillStyle(0x3a2f30, 1).fillCircle(10, h - 3, 5).fillCircle(w - 10, h - 3, 5);
  g.generateTexture(k, w, h + 4); g.destroy();
  return k;
}

/** 管理器：一个场景一个。 */
export class MechSystem {
  list = new Map<string, Mech>();
  constructor(private scene: Phaser.Scene, private layer: LayerLike, private host: MechHost, defs: Record<string, MechDef>) {
    for (const [id, d] of Object.entries(defs ?? {})) this.list.set(id, new Mech(scene, layer, host, id, d));
    _mechs = this;
  }
  get(id: string) { return this.list.get(id); }
  update(dt: number, now: number, inView: (x: number, y: number) => boolean = () => true) {
    for (const m of this.list.values()) m.update(dt, now, inView(m.x, m.y) ? 0 : 1);
  }
  destroy() { for (const m of this.list.values()) m.destroy(); this.list.clear(); if (_mechs === this) _mechs = undefined; }
  debug() { return [...this.list.values()].map((m) => m.debug()); }
}
let _mechs: MechSystem | undefined;
export const getMechs = () => _mechs;
