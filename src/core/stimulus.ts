import { CFG, MoveDef, StimType } from './data';
import { dist } from './iso';
import { getNav } from '../entities/nav';
import { entityPos } from '../entities/registry';

/**
 * 现象系统（docs/04）。一切“招式 / 机关 / 环境”只产生现象，NPC 只感知现象。
 *
 * 现象类型与传播模型：
 *  - sound   声音：球形线性衰减，雨/雪天半径倍率（CFG.soundWeather）；脉冲或持续。
 *  - light   光：球形；可带 cone（朝向+张角，如路灯照路/手电）；被 block 现象遮挡（视线）。
 *  - scent   气味：随风拉长成“烟羽”（顺风 stretch、逆风缩短），风由 stim.wind 提供；可随时间扩散（grow）。
 *  - lure    诱饵：球形，持续；NPC 的 follows 会被吸引（追随）。
 *  - block   阻挡：矩形/圆形占位；同时在导航网格登记阻挡，寻路绕行；也遮挡 light。
 *  - company 陪伴/聚集：球形，持续。
 *
 * 通用可选字段（moves.json 的 emit 里写）：
 *   duration 持续秒（0=脉冲；-1=永久，需 removeEmitter 关闭）
 *   fadeIn / fadeOut 渐入/渐出秒（强度包络）
 *   grow     半径每秒增长（scent 扩散；封顶 growMax×radius，默认 2）
 *   cone     {dir:[dx,dy], arc:度}（light 光锥；dir 为世界坐标方向）
 *   shape    [w,h]（block 的矩形；缺省用 radius 的正方形）
 *   anchor   实体 id（npc:xxx / hat / prop:xxx / mech:xxx），现象位置每帧跟随该实体
 *   mover    {to:[x,y], speed}（现象自己移动，如气球）
 */
export interface Stimulus {
  id: number; type: StimType; tag: string; x: number; y: number;
  intensity: number; radius: number; born: number; duration: number; source: string;
  sustained: boolean; mover?: { tx: number; ty: number; speed: number };
  fadeIn?: number; fadeOut?: number; grow?: number; r0?: number;
  cone?: { dx: number; dy: number; cos: number };
  shape?: [number, number];
  anchor?: string; emitId?: string; ox?: number; oy?: number;
}

export interface EmitSpec {
  type: StimType; tag: string; intensity: number; radius: number; duration?: number;
  mover?: { to: number[]; speed: number }; fadeIn?: number; fadeOut?: number; grow?: number;
  cone?: { dir: number[]; arc: number }; shape?: number[]; anchor?: string;
}

let uid = 1;
const OCCLUDE_R = 0.55;
/** 现象系统：招式 → 现象；脉冲型广播一次，持续型留在场上被轮询 */
export class StimulusSystem {
  active: Stimulus[] = [];
  recent: { s: Stimulus; at: number }[] = []; // 供调试环显示
  weather: 'rain' | 'snow' | 'clear' = 'rain';
  /** 风：单位方向 + 强度(0..1)。host 每帧/换阶段时写入；scent 烟羽用 */
  wind = { dx: (CFG.windDir?.[0] ?? 1), dy: (CFG.windDir?.[1] ?? 0.35), speed: 0.35 };
  private emitters = new Map<string, Stimulus>();
  private blocks: Stimulus[] = [];

  constructor() {
    const l = Math.hypot(this.wind.dx, this.wind.dy) || 1; this.wind.dx /= l; this.wind.dy /= l;
  }

  emit(move: MoveDef, x: number, y: number, source: string, now: number): Stimulus {
    return this.emitSpec(move.emit as EmitSpec, x, y, source, now);
  }

  emitSpec(e: EmitSpec, x: number, y: number, source: string, now: number, emitId?: string): Stimulus {
    const sw = (CFG.soundWeather as Record<string, number>)[this.weather] ?? 1;
    const radius = e.type === 'sound' ? e.radius * sw : e.radius;
    const dur = e.duration ?? 0;
    const s: Stimulus = {
      id: uid++, type: e.type, tag: e.tag, x, y, intensity: e.intensity, radius, born: now,
      duration: dur < 0 ? Infinity : dur, source, sustained: dur !== 0,
      mover: e.mover ? { tx: e.mover.to[0], ty: e.mover.to[1], speed: e.mover.speed } : undefined,
      fadeIn: e.fadeIn, fadeOut: e.fadeOut, grow: e.grow, r0: radius, anchor: e.anchor, emitId,
    };
    if (e.cone) {
      const l = Math.hypot(e.cone.dir[0], e.cone.dir[1]) || 1;
      s.cone = { dx: e.cone.dir[0] / l, dy: e.cone.dir[1] / l, cos: Math.cos(((e.cone.arc ?? 90) / 2) * Math.PI / 180) };
    }
    if (e.shape) s.shape = [e.shape[0], e.shape[1]];
    if (s.sustained) { this.active.push(s); this.registerBlock(s); }
    this.recent.push({ s, at: now });
    return s;
  }

  /** 常驻发射器（例：面包房的香味、路灯的光）。同 id 覆盖；on=false 关闭。 */
  setEmitter(id: string, spec: EmitSpec | null, x = 0, y = 0, now = 0) {
    const old = this.emitters.get(id);
    if (old) { this.remove(old); this.emitters.delete(id); }
    if (!spec) return;
    this.emitters.set(id, this.emitSpec({ ...spec, duration: -1 }, x, y, `emitter:${id}`, now, id));
  }
  hasEmitter(id: string) { return this.emitters.has(id); }

  remove(s: Stimulus) {
    const i = this.active.indexOf(s); if (i >= 0) this.active.splice(i, 1);
    this.unregisterBlock(s);
  }

  private registerBlock(s: Stimulus) {
    if (s.type !== 'block') return;
    this.blocks.push(s);
    const [w, h] = s.shape ?? [s.radius * 2, s.radius * 2];
    getNav().addBlocker(`stim:${s.id}`, s.x - w / 2, s.y - h / 2, s.x + w / 2, s.y + h / 2);
  }
  private unregisterBlock(s: Stimulus) {
    if (s.type !== 'block') return;
    const i = this.blocks.indexOf(s); if (i >= 0) this.blocks.splice(i, 1);
    getNav().removeBlocker(`stim:${s.id}`);
  }

  update(dt: number, now: number) {
    this._now = now;
    for (const s of this.active) {
      if (s.anchor) {
        const p = entityPos(s.anchor);
        if (p) { s.x = p.x + (s.ox ?? 0); s.y = p.y + (s.oy ?? 0); }
      }
      if (s.mover) {
        const d = dist(s.x, s.y, s.mover.tx, s.mover.ty);
        if (d > 0.05) {
          const k = Math.min(1, (s.mover.speed * dt) / d);
          s.x += (s.mover.tx - s.x) * k; s.y += (s.mover.ty - s.y) * k;
        }
      }
      if (s.grow) s.radius = Math.min((s.r0 ?? s.radius) * 2, s.radius + s.grow * dt);
      if (s.type === 'block' && (s.anchor || s.mover)) {
        const [w, h] = s.shape ?? [s.radius * 2, s.radius * 2];
        getNav().addBlocker(`stim:${s.id}`, s.x - w / 2, s.y - h / 2, s.x + w / 2, s.y + h / 2);
      }
    }
    let dead = false;
    for (const s of this.active) if (now - s.born >= s.duration) { dead = true; this.unregisterBlock(s); }
    if (dead) this.active = this.active.filter((s) => now - s.born < s.duration);
    this.recent = this.recent.filter((r) => now - r.at < 1.2);
  }

  /** 强度包络（渐入渐出） */
  private env(s: Stimulus, now: number) {
    let k = 1; const age = now - s.born;
    if (s.fadeIn && age < s.fadeIn) k *= age / s.fadeIn;
    if (s.fadeOut && s.duration !== Infinity) { const left = s.duration - age; if (left < s.fadeOut) k *= Math.max(0, left / s.fadeOut); }
    return k;
  }
  private _now = 0;

  /**
   * 某点感知到的强度 0..1（含 NPC 的感知倍率）。
   * 同时处理：scent 烟羽、light 光锥与遮挡、渐入渐出。
   */
  at(s: Stimulus, x: number, y: number, gain = 1): number {
    let d: number;
    if (s.type === 'scent' && this.wind.speed > 0.05) {
      const rx = x - s.x, ry = y - s.y;
      const al = rx * this.wind.dx + ry * this.wind.dy;           // 顺风分量
      const pe = -rx * this.wind.dy + ry * this.wind.dx;          // 侧风分量
      const stretch = 1 + this.wind.speed * 2.2;                  // 顺风拉长
      d = Math.hypot(al > 0 ? al / stretch : al * 1.5, pe * 1.15);
    } else if (s.type === 'block' && s.shape) {
      d = Math.max(Math.abs(x - s.x) - s.shape[0] / 2, Math.abs(y - s.y) - s.shape[1] / 2, 0);
    } else d = dist(s.x, s.y, x, y);
    let I = Math.max(0, s.intensity * (1 - d / s.radius));
    if (I <= 0) return 0;
    if (s.cone) {
      const dd = Math.max(0.001, dist(s.x, s.y, x, y));
      const c = ((x - s.x) * s.cone.dx + (y - s.y) * s.cone.dy) / dd;
      if (c < s.cone.cos) return 0;
      I *= Math.min(1, (c - s.cone.cos) / (1 - s.cone.cos) * 3 + 0.3);
    }
    if (s.type === 'light' && this.blocks.length && this.occluded(s, x, y)) I *= 0.1;
    return I * gain * this.env(s, this._now);
  }

  /** 静态兼容入口：不含风/遮挡/包络，等同旧版线性衰减 */
  static at(s: Stimulus, x: number, y: number, gain = 1) {
    const d = dist(s.x, s.y, x, y);
    return Math.max(0, s.intensity * (1 - d / s.radius)) * gain;
  }

  /** 视线：s→(x,y) 线段是否穿过任一 block 现象 */
  occluded(s: Stimulus, x: number, y: number) {
    for (const b of this.blocks) {
      if (b === s) continue;
      const hw = (b.shape?.[0] ?? b.radius * 2) / 2 + OCCLUDE_R * 0.3, hh = (b.shape?.[1] ?? b.radius * 2) / 2 + OCCLUDE_R * 0.3;
      // 线段与矩形（扩一点）相交：采样
      const n = 6;
      for (let i = 1; i < n; i++) {
        const px = s.x + ((x - s.x) * i) / n, py = s.y + ((y - s.y) * i) / n;
        if (Math.abs(px - b.x) < hw && Math.abs(py - b.y) < hh) return true;
      }
    }
    return false;
  }

  /** 调试快照 */
  debug(now: number) {
    return this.active.map((s) => ({
      id: s.id, type: s.type, tag: s.tag, x: +s.x.toFixed(2), y: +s.y.toFixed(2), intensity: s.intensity,
      radius: +s.radius.toFixed(2), source: s.source, left: s.duration === Infinity ? -1 : +(s.duration - (now - s.born)).toFixed(1), emitter: s.emitId ?? null,
    }));
  }
}
