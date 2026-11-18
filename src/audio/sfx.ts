/**
 * 音效库：每个交互/招式一个“有性格”的声音，全部合成；带同类限流、优先级与响度表。
 *   play(id, p?, {pan}) — id 见 SFX_IDS / SFX_ALIAS；p 的含义：step=地面材质(string)，blip=频率(Hz)，warm=暖度(0..100)
 */
import { Rig, clamp, mtof, pick, rnd, rr } from './rig';
import { PRELUDE, SAFE_PENTA, WARM_LADDER } from './theory';
import * as V from './voices';

type Ctx = BaseAudioContext;
const tidy = (n: AudioNode) => () => { try { n.disconnect(); } catch { /* */ } };

// ———————————————— 底层小零件 ————————————————
function env(c: Ctx, dest: AudioNode, at: number, peak: number, a: number, dec: number) {
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), at + a);
  g.gain.exponentialRampToValueAtTime(0.0001, at + a + dec); g.connect(dest); return g;
}
function osc(c: Ctx, type: OscillatorType, f0: number, f1: number | null, at: number, dur: number, out: AudioNode) {
  const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, at);
  if (f1 !== null && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
  o.connect(out); o.start(at); o.stop(at + dur + 0.05); o.onended = tidy(o); return o;
}
function nz(rig: Rig, at: number, dur: number, out: AudioNode, buf: AudioBuffer = rig.noiseW) {
  const s = rig.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(out); s.start(at, rr(0, Math.max(0, buf.duration - 0.2))); s.stop(at + dur + 0.03); s.onended = tidy(s); return s;
}
function bq(c: Ctx, type: BiquadFilterType, f: number, q: number, out: AudioNode) { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(out); return b; }

// ———————————————— 公共音色（环境音也会用）————————————————
/** 猫叫：锯齿 + 滑音 + 两个共振峰；far=远处（低通 + 更轻） */
export function meow(rig: Rig, dest: AudioNode, at: number, vol = 0.14, far = false, pitch = 1) {
  vol *= 4.5; const c = rig.ctx; const dur = 0.62;
  const out = far ? bq(c, 'lowpass', 1500, 0.7, dest) : dest;
  const e = env(c, out, at, vol, 0.07, dur - 0.05);
  const o = c.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(380 * pitch, at); o.frequency.linearRampToValueAtTime(700 * pitch, at + 0.18); o.frequency.linearRampToValueAtTime(430 * pitch, at + dur);
  const f1 = bq(c, 'bandpass', 800, 5, e), f2 = bq(c, 'bandpass', 1500, 6, e);
  f1.frequency.setValueAtTime(700, at); f1.frequency.linearRampToValueAtTime(1100, at + 0.2); f1.frequency.linearRampToValueAtTime(750, at + dur);
  f2.frequency.setValueAtTime(1500, at); f2.frequency.linearRampToValueAtTime(2300, at + 0.2); f2.frequency.linearRampToValueAtTime(1600, at + dur);
  const dry = c.createGain(); dry.gain.value = 1.5; o.connect(f1); o.connect(f2);
  o.start(at); o.stop(at + dur + 0.05); o.onended = tidy(o); void dry;
}
/** 自行车铃：两个“叮铃”，高频非谐波 + 快速颤动 */
export function bikeBell(rig: Rig, dest: AudioNode, at: number, vol = 0.1, far = false) {
  const c = rig.ctx; const out = far ? bq(c, 'lowpass', 3000, 0.7, dest) : dest;
  for (let i = 0; i < 2; i++) {
    const t = at + i * 0.14;
    for (const [f, g, d] of [[2350, 1, 0.7], [3500, 0.55, 0.5], [5900, 0.22, 0.25]] as [number, number, number][]) {
      const o = osc(c, 'sine', f, null, t, d, env(c, out, t, vol * g, 0.002, d));
      const lfo = c.createOscillator(); lfo.frequency.value = 38; const lg = c.createGain(); lg.gain.value = f * 0.012; lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(t + d + 0.05); lfo.onended = tidy(lfo);
    }
  }
}
/** 小孩笑：一串“哈哈哈”，声源 + 共振峰，音高逐个下滑 */
export function laugh(rig: Rig, dest: AudioNode, at: number, vol = 0.04, far = true) {
  vol *= 3.5; const c = rig.ctx; const out = far ? bq(c, 'lowpass', 3200, 0.7, dest) : dest; const n = 3 + Math.floor(rnd() * 3); const base = rr(520, 760);
  for (let i = 0; i < n; i++) {
    const t = at + i * rr(0.13, 0.17), d = 0.1; const e = env(c, out, t, vol * (1 - i * 0.12), 0.012, d);
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(base * (1 - i * 0.05) * 1.25, t); o.frequency.exponentialRampToValueAtTime(base * (1 - i * 0.05), t + d);
    const b1 = bq(c, 'bandpass', 900, 4, e), b2 = bq(c, 'bandpass', 2100, 5, e); o.connect(b1); o.connect(b2); o.start(t); o.stop(t + d + 0.05); o.onended = tidy(o);
    const hp = bq(c, 'highpass', 3500, 0.7, env(c, out, t, vol * 0.2, 0.004, 0.05)); nz(rig, t, 0.07, hp);
  }
  return n * 0.15;
}
/** 海鸥：两三声下滑的“啊—” */
export function gull(rig: Rig, dest: AudioNode, at: number, vol = 0.03) {
  vol *= 3; const c = rig.ctx; const n = 2 + Math.floor(rnd() * 2); const f = rr(1300, 1700);
  for (let i = 0; i < n; i++) {
    const t = at + i * 0.38, d = 0.3; const out = bq(c, 'bandpass', 2200, 1.2, env(c, dest, t, vol, 0.04, d));
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.8, t); o.frequency.linearRampToValueAtTime(f * 1.25, t + 0.08); o.frequency.exponentialRampToValueAtTime(f * 0.7, t + d);
    o.connect(out); o.start(t); o.stop(t + d + 0.05); o.onended = tidy(o);
  }
}
/** 轮船汽笛：低沉双音，缓起缓落 */
export function shipHorn(rig: Rig, dest: AudioNode, at: number, vol = 0.07, dur = 1.8, pitch = 1) {
  const c = rig.ctx; const lp = bq(c, 'lowpass', 520, 0.8, dest);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol, at + 0.25); g.gain.setValueAtTime(vol, at + dur - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.6); g.connect(lp);
  for (const [f, dt] of [[82, 0], [110, 5], [123, -4]] as [number, number][]) { const o = osc(c, 'sawtooth', f * pitch, null, at, dur + 0.6, g); o.detune.value = dt; }
}

// ———————————————— 配置：限流 / 优先级 / 响度 ————————————————
interface Cfg { gap: number; prio: 0 | 1 | 2; gain: number; len: number }
const CFG: Record<string, Cfg> = {
  chime: { gap: 220, prio: 1, gain: 1, len: 2.6 }, whoosh: { gap: 250, prio: 1, gain: 1, len: 1.2 }, pop: { gap: 60, prio: 1, gain: 1, len: 0.3 },
  prelude: { gap: 700, prio: 2, gain: 1, len: 1.4 }, blast: { gap: 900, prio: 2, gain: 1, len: 2.2 }, sparkle: { gap: 160, prio: 1, gain: 1, len: 1.6 },
  boing: { gap: 250, prio: 1, gain: 1, len: 0.6 }, letter: { gap: 300, prio: 1, gain: 1, len: 0.6 }, meow: { gap: 600, prio: 1, gain: 1, len: 0.8 },
  possess: { gap: 500, prio: 2, gain: 1, len: 1.0 }, release: { gap: 500, prio: 2, gain: 1, len: 0.9 }, clank: { gap: 120, prio: 1, gain: 1, len: 0.5 },
  warm: { gap: 140, prio: 1, gain: 1, len: 2.0 }, blip: { gap: 45, prio: 0, gain: 1, len: 0.2 }, step: { gap: 105, prio: 0, gain: 1, len: 0.2 },
  lamp: { gap: 250, prio: 1, gain: 1, len: 1.4 }, tree: { gap: 300, prio: 1, gain: 1, len: 2.2 }, bike: { gap: 500, prio: 1, gain: 1, len: 1.0 },
  bus: { gap: 700, prio: 1, gain: 1, len: 1.0 }, stove: { gap: 400, prio: 1, gain: 0.45, len: 1.2 }, door: { gap: 600, prio: 1, gain: 1, len: 2.0 },
  bubble: { gap: 60, prio: 0, gain: 1, len: 0.2 }, tick: { gap: 80, prio: 0, gain: 1, len: 0.6 }, fail: { gap: 300, prio: 1, gain: 1, len: 0.7 },
  shake: { gap: 200, prio: 1, gain: 1, len: 0.6 }, vending: { gap: 500, prio: 1, gain: 1, len: 1.5 }, busstop: { gap: 800, prio: 1, gain: 1, len: 1.6 },
  laugh: { gap: 800, prio: 0, gain: 1, len: 1.0 }, gull: { gap: 900, prio: 0, gain: 1, len: 1.2 }, ship: { gap: 4000, prio: 1, gain: 1, len: 3.0 },
  click: { gap: 40, prio: 0, gain: 1, len: 0.1 }, cheer: { gap: 1200, prio: 1, gain: 1, len: 1.6 },
  // —— product 补充（docs/06 音乐需求）——
  bus_ramp: { gap: 900, prio: 1, gain: 1, len: 1.2 }, snow_blow: { gap: 1200, prio: 0, gain: 1, len: 1.7 }, oven_stoke: { gap: 900, prio: 1, gain: 1, len: 1.1 },
  vend_blind: { gap: 500, prio: 1, gain: 1, len: 0.8 }, dog_snore: { gap: 1800, prio: 0, gain: 1, len: 1.9 }, cat_purr: { gap: 1800, prio: 0, gain: 1, len: 1.8 },
  whistle: { gap: 600, prio: 1, gain: 1, len: 0.7 }, cheer_crowd: { gap: 1500, prio: 1, gain: 1, len: 2.0 }, confetti: { gap: 600, prio: 1, gain: 1, len: 1.2 },
  bell_sled: { gap: 900, prio: 1, gain: 1, len: 1.2 }, paper: { gap: 200, prio: 0, gain: 1, len: 0.5 }, fish_swing: { gap: 400, prio: 1, gain: 1, len: 0.8 },
  egg_ding: { gap: 500, prio: 1, gain: 1, len: 1.6 }, egg_accordion: { gap: 500, prio: 1, gain: 1, len: 1.0 }, egg_cat: { gap: 500, prio: 1, gain: 1, len: 1.4 },
  egg_bikes: { gap: 500, prio: 1, gain: 1, len: 1.0 }, egg_choir: { gap: 800, prio: 1, gain: 1, len: 2.4 },
};
const EGGS = ['egg_ding', 'egg_accordion', 'egg_cat', 'egg_bikes', 'egg_choir'];
/** 别名 → 主 id（兼容 moves.json / 文档里的叫法） */
export const SFX_ALIAS: Record<string, string> = {
  windchime: 'chime', chime_ring: 'chime', balloon_release: 'whoosh', balloon_fly: 'whoosh', balloon_pop: 'pop', speaker_prelude: 'prelude', speaker_blast: 'blast', horn: 'blast',
  lamp_glow: 'lamp', lamp_on: 'lamp', light: 'lamp', tree_twinkle: 'tree', tree_lit: 'tree', snowman_pose: 'boing', snowman: 'boing', mailbox_drop: 'letter', mailbox: 'letter',
  cat_meow: 'meow', cat: 'meow', bike_bell: 'bike', bicycle: 'bike', bus_horn: 'bus', stove_fire: 'stove', fire: 'stove', doorbell: 'door', footstep: 'step', steps: 'step',
  bubble_pop: 'bubble', checklist: 'tick', check: 'tick', warmth: 'warm', fail_pop: 'fail', thud: 'fail', hat_shake: 'shake', vending_drop: 'vending', bus_stop: 'busstop', ui: 'click', ding: 'warm', kids: 'laugh',
  ramp: 'bus_ramp', bus_ramp_down: 'bus_ramp', snowblow: 'snow_blow', snow_machine: 'snow_blow', stoke: 'oven_stoke', oven: 'oven_stoke', vend: 'vend_blind', blind_box: 'vend_blind',
  snore: 'dog_snore', purr: 'cat_purr', referee: 'whistle', crowd: 'cheer_crowd', cheer_crowd_big: 'cheer_crowd', sled: 'bell_sled', sled_bell: 'bell_sled', letter_paper: 'paper', fish: 'fish_swing',
  egg_1: 'egg_ding', egg_2: 'egg_accordion', egg_3: 'egg_cat', egg_4: 'egg_bikes', egg_5: 'egg_choir', egg_cat_bell: 'egg_cat', egg_bike: 'egg_bikes',
};
export const SFX_IDS = Object.keys(CFG);
export type StepMat = 'grass' | 'snow' | 'wood' | 'stone' | 'sand' | 'carpet';

export class Sfx {
  private last: Record<string, number> = {};
  private recent: number[] = [];
  private lowUntil = 0;
  warmth = 0;
  /** 播放高优先级音效时回调（让引擎压一下音乐） */
  onBig: ((ms: number) => void) | null = null;
  readonly dropped: Record<string, number> = {};
  constructor(private rig: Rig) {}

  /** 返回是否真的发声（被限流时 false） */
  play(rawId: string, p?: number | string, o: { pan?: number; vol?: number; force?: boolean } = {}): boolean {
    let id = SFX_ALIAS[rawId] || rawId; if (id === 'egg') id = pick(EGGS); const cfg = CFG[id];
    const now = this.rig.t; const nowMs = now * 1000;
    if (!cfg) { return this.play('blip', typeof p === 'number' ? p : undefined, o); }
    if (!o.force) {
      if (nowMs - (this.last[id] ?? -1e9) < cfg.gap) return this.drop(id);
      if (cfg.prio === 0 && now < this.lowUntil) return this.drop(id);
      this.recent = this.recent.filter((x) => nowMs - x < 250);
      if (this.recent.length >= 8 && cfg.prio < 2) return this.drop(id);
    }
    this.last[id] = nowMs; this.recent.push(nowMs);
    if (cfg.prio === 2) { this.lowUntil = now + cfg.len * 0.6; if (id === 'blast' || id === 'prelude') this.onBig?.(cfg.len * 1000); }
    const pan = this.rig.panner(o.pan || 0); let dest: AudioNode = this.rig.sfx;
    const gn = this.rig.ctx.createGain(); gn.gain.value = cfg.gain * (o.vol ?? 1);
    if (pan) { gn.connect(pan); pan.connect(this.rig.sfx); } else gn.connect(this.rig.sfx);
    dest = gn; const t = now + 0.01;
    this.make(id, dest, t, p);
    return true;
  }
  private drop(id: string) { this.dropped[id] = (this.dropped[id] || 0) + 1; return false; }
  /** 某音效大致时长（秒），selftest 用 */
  len(id: string) { return (CFG[SFX_ALIAS[id] || id] || CFG.blip).len; }

  private make(id: string, d: AudioNode, t: number, p?: number | string) {
    const R = this.rig, c = R.ctx;
    switch (id) {
      case 'chime': { // 风铃：五六根铜管错落敲响，高音五声音阶
        const n = 5 + Math.floor(rnd() * 3); let at = t;
        for (let i = 0; i < n; i++) { V.bell(R, d, pick(SAFE_PENTA.slice(4)) + (rnd() < 0.3 ? 12 : 0), at, 0.09 * (1 - i * 0.07), 2.4); at += rr(0.05, 0.16); }
        V.celesta(R, d, 86, t, 0.05, 1.2); break;
      }
      case 'whoosh': { // 气球松手飞走：气流 + 上升滑音
        const bp = bq(c, 'bandpass', 500, 1.1, env(c, d, t, 0.36, 0.06, 0.9)); bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(2600, t + 0.8); nz(R, t, 1, bp);
        osc(c, 'sine', 300, 760, t, 0.7, env(c, d, t, 0.05, 0.05, 0.65)); V.bell(R, d, 88, t + 0.55, 0.04, 1.2); break;
      }
      case 'pop': { // 气球破：脆响 + 低砰
        nz(R, t, 0.05, bq(c, 'highpass', 1500, 0.7, env(c, d, t, 0.34, 0.001, 0.05)));
        osc(c, 'sine', 240, 50, t, 0.13, env(c, d, t, 0.34, 0.002, 0.13)); nz(R, t, 0.12, bq(c, 'bandpass', 700, 0.8, env(c, d, t + 0.01, 0.1, 0.002, 0.1))); break;
      }
      case 'prelude': { // 喇叭前奏：话筒“噗”一声 + 小段暖调 (主旋律动机)
        nz(R, t, 0.05, bq(c, 'bandpass', 1200, 0.9, env(c, d, t, 0.1, 0.002, 0.05)));
        let at = t + 0.08; for (const [m, b] of PRELUDE) { const dur = b * 0.17; V.trumpet(R, d, m, at, dur, 0.07); at += dur; } break;
      }
      case 'blast': { // 喇叭爆音：C 大三和弦强音 + 气流
        const lp = bq(c, 'lowpass', 1700, 0.8, d); const e = c.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.12, t + 0.05); e.gain.setValueAtTime(0.12, t + 0.7); e.gain.exponentialRampToValueAtTime(0.0001, t + 1.5); e.connect(lp);
        for (const m of [60, 64, 67, 72]) { const f = mtof(m); osc(c, 'sawtooth', f, null, t, 1.55, e).detune.value = rr(-6, 6); osc(c, 'square', f, null, t, 1.55, e).detune.value = 5; }
        nz(R, t, 0.4, bq(c, 'highpass', 2500, 0.7, env(c, d, t, 0.1, 0.01, 0.4))); V.sleighBells(R, d, t + 0.05, 0.06, 4); break;
      }
      case 'sparkle': { // 灯/树的闪烁：快速上行五声音阶
        const n = 6 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) { const m = SAFE_PENTA[4 + Math.min(7, i + Math.floor(rnd() * 2))]; V.celesta(R, d, m, t + i * 0.06, 0.07, 0.9); if (i % 2 === 0) V.bell(R, d, m + 12, t + i * 0.06, 0.04, 1.0); } break;
      }
      case 'lamp': { // 路灯点亮：灯丝“嗒” + 嗡 + 暖色两音
        nz(R, t, 0.02, bq(c, 'highpass', 2500, 0.7, env(c, d, t, 0.18, 0.001, 0.02)));
        osc(c, 'sine', 120, 118, t, 0.5, env(c, d, t + 0.02, 0.06, 0.1, 0.4)); osc(c, 'sine', 240, 480, t + 0.05, 0.3, env(c, d, t + 0.05, 0.05, 0.1, 0.25));
        V.bell(R, d, 79, t + 0.12, 0.09, 1.6); V.bell(R, d, 84, t + 0.26, 0.09, 1.8); V.celesta(R, d, 91, t + 0.32, 0.06, 1.2); break;
      }
      case 'tree': { // 圣诞树亮起：由下而上的琶音 + 洒落的星星
        [60, 64, 67, 72, 76, 79, 84, 88].forEach((m, i) => { V.celesta(R, d, m, t + i * 0.07, 0.09, 1.4); V.bell(R, d, m + 12, t + i * 0.07 + 0.02, 0.05, 1.8); });
        for (let i = 0; i < 6; i++) V.bell(R, d, pick(SAFE_PENTA.slice(6)), t + 0.6 + i * rr(0.04, 0.09), 0.05, 1.2);
        V.strings(R, d, [60, 64, 67, 72], t + 0.35, 1.4, 0.04); break;
      }
      case 'boing': { // 雪人摆姿势：弹簧 + 蓬松的 poof
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.1); o.frequency.exponentialRampToValueAtTime(260, t + 0.4);
        const lfo = c.createOscillator(); lfo.frequency.value = 22; const lg = c.createGain(); lg.gain.value = 40; lfo.connect(lg); lg.connect(o.frequency);
        o.connect(env(c, d, t, 0.32, 0.01, 0.4)); o.start(t); o.stop(t + 0.5); lfo.start(t); lfo.stop(t + 0.5); o.onended = tidy(o); lfo.onended = tidy(lfo);
        nz(R, t + 0.02, 0.18, bq(c, 'lowpass', 1100, 0.7, env(c, d, t + 0.02, 0.12, 0.01, 0.17))); V.bell(R, d, 91, t + 0.12, 0.05, 0.9); break;
      }
      case 'letter': { // 邮筒投信：盖子“咔” + 纸滑 + 落底“噗”
        osc(c, 'triangle', 620, 580, t, 0.14, env(c, d, t, 0.18, 0.001, 0.12)); osc(c, 'triangle', 930, 900, t, 0.1, env(c, d, t, 0.1, 0.001, 0.08));
        nz(R, t, 0.03, bq(c, 'bandpass', 3000, 1, env(c, d, t, 0.14, 0.001, 0.03)));
        nz(R, t + 0.1, 0.22, bq(c, 'highpass', 4000, 0.7, env(c, d, t + 0.1, 0.06, 0.05, 0.18)));
        osc(c, 'sine', 120, 70, t + 0.34, 0.14, env(c, d, t + 0.34, 0.16, 0.003, 0.14)); V.bell(R, d, 84, t + 0.45, 0.05, 1.0); break;
      }
      case 'meow': meow(R, d, t, 0.16, false, rr(0.92, 1.1)); break;
      case 'possess': { // 帽子钻进去：旋转上滑 + 一声“叮”
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.35);
        const lfo = c.createOscillator(); lfo.frequency.setValueAtTime(8, t); lfo.frequency.linearRampToValueAtTime(20, t + 0.35); const lg = c.createGain(); lg.gain.value = 0.08;
        const eg = env(c, d, t, 0.2, 0.04, 0.4); lfo.connect(lg); lg.connect(eg.gain); o.connect(eg); o.start(t); o.stop(t + 0.5); lfo.start(t); lfo.stop(t + 0.5); o.onended = tidy(o); lfo.onended = tidy(lfo);
        nz(R, t, 0.4, bq(c, 'bandpass', 1200, 1.4, env(c, d, t, 0.06, 0.1, 0.3)));
        V.bell(R, d, 91, t + 0.38, 0.12, 1.4); V.celesta(R, d, 79, t + 0.38, 0.1, 1.0); break;
      }
      case 'release': { // 帽子离开：下滑 + 轻“噗”
        osc(c, 'triangle', 800, 260, t, 0.35, env(c, d, t, 0.14, 0.01, 0.35)); nz(R, t + 0.3, 0.12, bq(c, 'lowpass', 900, 0.7, env(c, d, t + 0.3, 0.1, 0.005, 0.12)));
        V.bell(R, d, 79, t + 0.02, 0.07, 1.0); V.bell(R, d, 72, t + 0.2, 0.06, 1.2); break;
      }
      case 'clank': { // 金属撞击
        for (const [f, g] of [[310, 1], [470, 0.7], [790, 0.45]] as [number, number][]) osc(c, 'triangle', f * rr(0.97, 1.03), null, t, 0.4, env(c, d, t, 0.14 * g, 0.001, 0.38));
        nz(R, t, 0.04, bq(c, 'bandpass', 2500, 1, env(c, d, t, 0.12, 0.001, 0.04))); break;
      }
      case 'warm': { // 暖度上升“叮”：按暖度挑音，更暖更高
        const w = typeof p === 'number' ? p : this.warmth; const i = clamp(Math.floor(w / 12), 0, WARM_LADDER.length - 2);
        const m = WARM_LADDER[i], m2 = WARM_LADDER[i + 1];
        V.bell(R, d, m, t, 0.13, 2.0); V.celesta(R, d, m, t, 0.1, 1.2); V.bell(R, d, m2, t + 0.1, 0.1, 2.2); V.celesta(R, d, m2 - 12, t + 0.1, 0.06, 1.0); break;
      }
      case 'blip': { const f = typeof p === 'number' ? p : 660; osc(c, 'triangle', f, f * 1.5, t, 0.1, env(c, d, t, 0.25, 0.005, 0.1)); break; }
      case 'step': this.step(d, t, typeof p === 'string' ? (p as StepMat) : 'stone'); break;
      case 'bike': bikeBell(R, d, t, 0.1); break;
      case 'bus': { // 公交喇叭：两声方波和声
        for (const [dt, len] of [[0, 0.3], [0.38, 0.45]] as [number, number][]) { const lp = bq(c, 'lowpass', 1300, 0.8, env(c, d, t + dt, 0.1, 0.02, len)); osc(c, 'square', 233, null, t + dt, len, lp); osc(c, 'square', 311, null, t + dt, len, lp); osc(c, 'sawtooth', 117, null, t + dt, len, lp); } break;
      }
      case 'stove': { // 炉灶：打火嗒嗒 → “呼”点着 → 噼啪
        for (let i = 0; i < 3; i++) nz(R, t + i * 0.07, 0.02, bq(c, 'highpass', 3500, 0.7, env(c, d, t + i * 0.07, 0.05, 0.001, 0.02)));
        nz(R, t + 0.2, 0.7, bq(c, 'lowpass', 900, 0.8, env(c, d, t + 0.2, 0.02, 0.18, 0.55)), R.noiseB);
        for (let i = 0; i < 7; i++) nz(R, t + 0.35 + i * rr(0.06, 0.13), 0.02, bq(c, 'highpass', 1800, 0.7, env(c, d, t + 0.35 + i * 0.1, rr(0.02, 0.05), 0.001, 0.02))); break;
      }
      case 'door': { // 门铃“叮——咚”
        V.bell(R, d, 88, t, 0.14, 1.8); V.bell(R, d, 79, t + 0.42, 0.14, 2.2); V.celesta(R, d, 76, t + 0.42, 0.06, 1.0); break;
      }
      case 'bubble': { // 气泡弹出
        const f = rr(500, 800); osc(c, 'sine', f, f * 2.2, t, 0.07, env(c, d, t, 0.2, 0.004, 0.08)); nz(R, t + 0.06, 0.02, bq(c, 'highpass', 4000, 0.7, env(c, d, t + 0.06, 0.05, 0.001, 0.02))); break;
      }
      case 'tick': { // 清单打勾：木块 + 上行两音
        V.woodblock(R, d, t, 0.1, 1100); V.bell(R, d, 88, t + 0.04, 0.07, 0.8); V.bell(R, d, 91, t + 0.12, 0.08, 1.1); break;
      }
      case 'fail': { // 失败“咚/哇”：轻、不吓人
        osc(c, 'sine', 210, 110, t, 0.22, env(c, d, t, 0.32, 0.004, 0.22));
        const lp = bq(c, 'lowpass', 1200, 0.8, env(c, d, t + 0.1, 0.08, 0.02, 0.35)); const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(420, t + 0.1); o.frequency.exponentialRampToValueAtTime(240, t + 0.5); o.connect(lp); o.start(t + 0.1); o.stop(t + 0.6); o.onended = tidy(o); break;
      }
      case 'shake': { // 帽子抖动：几下铃铛
        V.sleighBells(R, d, t, 0.07, 3); V.sleighBells(R, d, t + 0.11, 0.06, 3); V.sleighBells(R, d, t + 0.22, 0.05, 2); break;
      }
      case 'vending': { // 贩卖机掉货：马达 + 咕咚 + 叮
        osc(c, 'sawtooth', 90, 130, t, 0.5, bq(c, 'lowpass', 400, 0.8, env(c, d, t, 0.07, 0.05, 0.45)));
        osc(c, 'sine', 130, 60, t + 0.62, 0.15, env(c, d, t + 0.62, 0.3, 0.002, 0.15)); nz(R, t + 0.62, 0.1, bq(c, 'lowpass', 700, 0.8, env(c, d, t + 0.62, 0.15, 0.002, 0.1)));
        V.bell(R, d, 91, t + 0.9, 0.08, 1.2); break;
      }
      case 'busstop': { // 公交报站“叮咚”
        V.bell(R, d, 84, t, 0.1, 1.2); V.bell(R, d, 79, t + 0.28, 0.1, 1.2); V.bell(R, d, 76, t + 0.56, 0.1, 1.6); break;
      }
      case 'laugh': laugh(R, d, t, 0.07, false); break;
      case 'gull': gull(R, d, t, 0.06); break;
      case 'ship': shipHorn(R, d, t, 0.12); break;
      case 'click': osc(c, 'triangle', 1300, 1000, t, 0.04, env(c, d, t, 0.16, 0.001, 0.04)); break;
      case 'cheer': { [72, 76, 79, 84].forEach((m, i) => { V.bell(R, d, m, t + i * 0.08, 0.1, 1.4); }); laugh(R, d, t + 0.1, 0.06, false); V.sleighBells(R, d, t + 0.3, 0.07, 5); break; }
      case 'bus_ramp': { // 斜板落下：金属嘎吱 + 落地咚 + 叮
        osc(c, 'sawtooth', 190, 95, t, 0.5, bq(c, 'bandpass', 520, 5, env(c, d, t, 0.1, 0.03, 0.5)));
        nz(R, t, 0.5, bq(c, 'bandpass', 1500, 3, env(c, d, t, 0.05, 0.04, 0.45)));
        osc(c, 'sine', 130, 55, t + 0.55, 0.18, env(c, d, t + 0.55, 0.3, 0.003, 0.18)); V.bell(R, d, 88, t + 0.62, 0.09, 1.2); break;
      }
      case 'snow_blow': { // 造雪机喷雪：气流 + 低沉嗡
        const bp = bq(c, 'bandpass', 900, 0.8, env(c, d, t, 0.2, 0.18, 1.3)); bp.frequency.setValueAtTime(900, t); bp.frequency.linearRampToValueAtTime(2200, t + 0.5); bp.frequency.linearRampToValueAtTime(1200, t + 1.5); nz(R, t, 1.6, bp);
        osc(c, 'sawtooth', 70, 62, t, 1.5, bq(c, 'lowpass', 220, 0.7, env(c, d, t, 0.05, 0.15, 1.3))); break;
      }
      case 'oven_stoke': { // 点火“呼”：低频气流上扬 + 低音
        const lp = bq(c, 'lowpass', 220, 0.8, env(c, d, t, 0.3, 0.14, 0.8)); lp.frequency.setValueAtTime(220, t); lp.frequency.exponentialRampToValueAtTime(1100, t + 0.4); nz(R, t, 1, lp, R.noiseB);
        osc(c, 'sine', 64, 46, t, 0.9, env(c, d, t, 0.22, 0.05, 0.85)); nz(R, t + 0.05, 0.3, bq(c, 'bandpass', 2400, 1, env(c, d, t + 0.05, 0.03, 0.01, 0.25))); break;
      }
      case 'vend_blind': { // 贩卖机盲盒：咚咚 + 滚落
        for (let i = 0; i < 2; i++) { const at = t + i * 0.2; osc(c, 'sine', 160 - i * 20, 60, at, 0.16, env(c, d, at, 0.3, 0.002, 0.16)); nz(R, at, 0.08, bq(c, 'lowpass', 700, 0.8, env(c, d, at, 0.12, 0.002, 0.08))); }
        for (let i = 0; i < 4; i++) { const at = t + 0.5 + i * 0.07; V.woodblock(R, d, at, 0.06 * (1 - i * 0.2), 700 + i * 90); } V.bell(R, d, 91, t + 0.75, 0.06, 1.0); break;
      }
      case 'dog_snore': { // 狗打鼾：两轮吸气呼气
        for (let i = 0; i < 2; i++) { const at = t + i * 0.9; osc(c, 'sawtooth', 96, 68, at, 0.8, bq(c, 'lowpass', 360, 0.9, env(c, d, at, 0.07, 0.25, 0.55))); nz(R, at, 0.8, bq(c, 'lowpass', 520, 0.8, env(c, d, at, 0.07, 0.2, 0.55))); }
        break;
      }
      case 'cat_purr': { // 猫呼噜：低通噪声 × 25Hz 调幅
        const out = env(c, d, t, 0.12, 0.3, 1.4); const g = c.createGain(); g.gain.value = 0.5; g.connect(out);
        const l = c.createOscillator(); l.frequency.value = 25; const lg = c.createGain(); lg.gain.value = 0.5; l.connect(lg); lg.connect(g.gain); l.start(t); l.stop(t + 1.8); l.onended = tidy(l);
        nz(R, t, 1.7, bq(c, 'lowpass', 430, 0.9, g)); break;
      }
      case 'whistle': { // 裁判哨：高频 + 40Hz 颤音
        const out = env(c, d, t, 0.11, 0.01, 0.55); const g = c.createGain(); g.gain.value = 0.55; g.connect(out);
        const l = c.createOscillator(); l.frequency.value = 42; const lg = c.createGain(); lg.gain.value = 0.45; l.connect(lg); lg.connect(g.gain); l.start(t); l.stop(t + 0.7); l.onended = tidy(l);
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(2650, t); o.frequency.linearRampToValueAtTime(2950, t + 0.1); o.frequency.setValueAtTime(2950, t + 0.5); o.connect(g); o.start(t); o.stop(t + 0.7); o.onended = tidy(o);
        nz(R, t, 0.5, bq(c, 'highpass', 3500, 0.7, env(c, d, t, 0.02, 0.01, 0.45))); break;
      }
      case 'cheer_crowd': { // 人群欢呼：两道共振峰噪声 + 笑声点缀
        const a = bq(c, 'bandpass', 900, 0.9, env(c, d, t, 0.15, 0.35, 1.5)); nz(R, t, 2, a, R.noiseP);
        const b = bq(c, 'bandpass', 1900, 1.4, env(c, d, t, 0.07, 0.4, 1.4)); nz(R, t, 2, b, R.noiseP);
        laugh(R, d, t + 0.2, 0.05, false); laugh(R, d, t + 0.55, 0.04, false); V.sleighBells(R, d, t + 0.4, 0.05, 4); break;
      }
      case 'confetti': { // 彩带炮：噗 + 落下的小亮点
        nz(R, t, 0.14, bq(c, 'highpass', 1500, 0.7, env(c, d, t, 0.2, 0.003, 0.12)));
        osc(c, 'sine', 240, 90, t, 0.12, env(c, d, t, 0.18, 0.002, 0.12));
        for (let i = 0; i < 7; i++) V.bell(R, d, pick(SAFE_PENTA.slice(4)) + 12, t + 0.1 + i * 0.075, 0.035, 0.8); break;
      }
      case 'bell_sled': { // 雪橇铃铛：一串
        for (let i = 0; i < 5; i++) V.sleighBells(R, d, t + i * 0.17, 0.08 * (1 - i * 0.1), 4); break;
      }
      case 'paper': { // 信纸沙沙
        for (let i = 0; i < 8; i++) { const at = t + i * 0.045 + rr(0, 0.02); nz(R, at, 0.04, bq(c, 'highpass', 3300 + rr(-400, 600), 0.7, env(c, d, at, 0.08 * rr(0.5, 1), 0.001, 0.035))); }
        break;
      }
      case 'fish_swing': { // 挥鱼：风声上扬 + 湿“啪”
        const bp = bq(c, 'bandpass', 400, 1.1, env(c, d, t, 0.22, 0.2, 0.2)); bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 0.35); nz(R, t, 0.45, bp);
        nz(R, t + 0.38, 0.12, bq(c, 'lowpass', 1500, 0.8, env(c, d, t + 0.38, 0.22, 0.002, 0.1))); osc(c, 'sine', 210, 90, t + 0.38, 0.1, env(c, d, t + 0.38, 0.2, 0.002, 0.1)); break;
      }
      case 'egg_ding': V.bell(R, d, 84, t, 0.11, 1.3); V.bell(R, d, 79, t + 0.34, 0.11, 1.6); V.celesta(R, d, 91, t + 0.34, 0.05, 1.2); break;
      case 'egg_accordion': { // 手风琴“噗”：一口气漏掉
        V.accordion(R, d, [60, 64, 67], t, 0.28, 0.12, 1); osc(c, 'sine', 180, 80, t + 0.26, 0.2, env(c, d, t + 0.26, 0.12, 0.01, 0.2));
        nz(R, t + 0.26, 0.3, bq(c, 'lowpass', 900, 0.8, env(c, d, t + 0.26, 0.1, 0.02, 0.28))); break;
      }
      case 'egg_cat': meow(R, d, t, 0.12, false, 1.0); V.sleighBells(R, d, t + 0.45, 0.07, 4); V.bell(R, d, 91, t + 0.55, 0.06, 1.2); break;
      case 'egg_bikes': { bikeBell(R, d, t, 0.1, false); bikeBell(R, d, t + 0.17, 0.09, false); bikeBell(R, d, t + 0.36, 0.1, false); V.bell(R, d, 88, t + 0.5, 0.05, 1.0); break; }
      case 'egg_choir': V.choir(R, d, [67, 72, 76], t, 2.0, 0.07); V.bell(R, d, 84, t + 0.1, 0.05, 1.8); break;
    }
  }

  /** 脚步：按地面材质分别用噪声 / 低频“咚”合成，每步随机微调避免机械感 */
  private step(d: AudioNode, t: number, mat: StepMat) {
    const R = this.rig, c = R.ctx, k = rr(0.9, 1.15); const v = rr(0.8, 1.1) * ({ snow: 2.2, grass: 2.6, wood: 1.6, sand: 2.6, carpet: 3.5, stone: 1.5 } as Record<StepMat, number>)[mat];
    switch (mat) {
      case 'snow': // 咯吱
        nz(R, t, 0.1, bq(c, 'bandpass', 3200 * k, 1.8, env(c, d, t, 0.09 * v, 0.004, 0.09))); nz(R, t, 0.12, bq(c, 'lowpass', 900, 0.7, env(c, d, t, 0.07 * v, 0.01, 0.1))); break;
      case 'grass': nz(R, t, 0.1, bq(c, 'bandpass', 1800 * k, 0.8, env(c, d, t, 0.07 * v, 0.012, 0.08))); break;
      case 'wood': osc(c, 'sine', 150 * k, 90, t, 0.1, env(c, d, t, 0.14 * v, 0.003, 0.1)); nz(R, t, 0.04, bq(c, 'bandpass', 1100, 1, env(c, d, t, 0.07 * v, 0.001, 0.04))); break;
      case 'sand': nz(R, t, 0.12, bq(c, 'bandpass', 2400 * k, 0.6, env(c, d, t, 0.06 * v, 0.02, 0.1))); break;
      case 'carpet': nz(R, t, 0.08, bq(c, 'lowpass', 700, 0.7, env(c, d, t, 0.07 * v, 0.01, 0.07))); break;
      default: // stone
        nz(R, t, 0.04, bq(c, 'highpass', 1800 * k, 0.7, env(c, d, t, 0.09 * v, 0.001, 0.035))); osc(c, 'sine', 210 * k, 120, t, 0.06, env(c, d, t, 0.09 * v, 0.002, 0.06));
    }
  }
}
