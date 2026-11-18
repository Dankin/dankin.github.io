/**
 * 音乐引擎：16 小节主旋律《冬青里》的分层循环 + 故事动机 + 一次性 sting。
 * 全部由 theory.ts 的数据表驱动，因此旋律与和声始终在 C 大调（transpose=+7 即 G 大调）。
 *
 * 层（随“已完成故事数” 0..5 加入）：
 *   0 celesta   钢片琴主旋律（清晨单音）
 *   1 guitar    木吉他分解和弦（午后）
 *   2 bass      低音
 *   3 strings   弦乐垫（傍晚）
 *   4 perc+hum  轻打击 + 哼唱“la”叠主旋律
 *   5 bells     铃铛叠奏 + 雪橇铃
 *   finale      合唱垫 + 平安夜（公有领域）铃声变奏作尾声
 * 另有每个已完成故事的“动机”以其专属乐器在固定小节里轻声出现（MOTIF_SLOT，已校验无冲突）。
 */
import { Rig, clamp, rr, rnd } from './rig';
import {
  BARS, BASE_BPM, LOOP_STEPS, MELODY_AT, MOTIFS, MOTIF_SLOT, SAFE_PENTA, SILENT_NIGHT, SILENT_NIGHT_CHORDS,
  STEPS_PER_BAR, StoryId, chordOfBar, canonStory, MotifNote,
} from './theory';
import * as V from './voices';

export type LayerName = 'celesta' | 'guitar' | 'bass' | 'strings' | 'perc' | 'hum' | 'bells' | 'choir' | 'motif';
export const LAYER_NAMES: LayerName[] = ['celesta', 'guitar', 'bass', 'strings', 'perc', 'hum', 'bells', 'choir', 'motif'];
/** 层音量（经 selftest 响度校准后的相对增益） */
const LAYER_GAIN: Record<LayerName, number> = { celesta: 1, guitar: 0.9, bass: 0.85, strings: 0.8, perc: 0.9, hum: 0.8, bells: 0.8, choir: 0.5, motif: 1 };

export class Music {
  readonly rig: Rig;
  private lay = {} as Record<LayerName, GainNode>;
  private on = {} as Record<LayerName, boolean>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextT = 0;
  private step = 0;
  running = false;
  baseLayer = 0; // 旧 API setLayer(n)
  readonly done = new Set<StoryId>();
  finale = false;
  tempoMul = 1;
  transpose = 0;
  /** 离线渲染时强制指定的层集合（null=按等级） */
  forceLayers: LayerName[] | null = null;
  motifsEnabled = true;
  private codaUntil = 0;
  /** 情境附加层（cue 用，叠加在等级层之上） */
  mood: LayerName[] = [];
  /** 时段/情境配色：在旋律之外添加手风琴/竹笛/风铃/鸟鸣等点缀 */
  color: 'morning' | 'noon' | 'dusk' | 'night' | 'sandbox' | null = null;
  /** cue 点缀专用总线（不随等级层淡入淡出） */
  readonly colorBus: GainNode;

  constructor(rig: Rig) {
    this.rig = rig;
    for (const n of LAYER_NAMES) {
      const g = rig.ctx.createGain(); g.gain.value = 0; g.connect(rig.music); this.lay[n] = g; this.on[n] = false;
    }
    this.colorBus = rig.ctx.createGain(); this.colorBus.gain.value = 1; this.colorBus.connect(rig.music);
  }

  /** 当前等级 0..5 = max(setLayer 值, 已完成故事数) */
  get level() { return clamp(Math.max(this.baseLayer, this.done.size), 0, 5); }
  get stepSec() { return 60 / (BASE_BPM * this.tempoMul) / 2; }

  private wanted(): Set<LayerName> {
    if (this.forceLayers) return new Set(this.forceLayers);
    const L = this.level; const s = new Set<LayerName>(['celesta']);
    if (L >= 1) s.add('guitar'); if (L >= 2) s.add('bass'); if (L >= 3) s.add('strings');
    if (L >= 4) { s.add('perc'); s.add('hum'); }
    if (L >= 5) s.add('bells');
    if (this.finale) { s.add('choir'); s.add('bells'); s.add('hum'); s.add('perc'); s.add('strings'); s.add('bass'); s.add('guitar'); }
    if (this.done.size > 0 && this.motifsEnabled) s.add('motif');
    for (const m of this.mood) s.add(m);
    return s;
  }
  /** 平滑切换各层增益 */
  refreshLayers(fast = false) {
    const w = this.wanted(); const t = this.rig.t;
    for (const n of LAYER_NAMES) {
      const want = w.has(n); this.on[n] = want;
      const p = this.lay[n].gain; p.cancelScheduledValues(t); p.setTargetAtTime(want ? LAYER_GAIN[n] : 0, t, fast ? 0.02 : want ? 1.2 : 0.8);
    }
  }

  start() {
    if (this.running) return;
    this.running = true; this.nextT = this.rig.t + 0.12; this.step = 0; this.refreshLayers();
    this.timer = setInterval(() => this.tick(), 100); this.tick();
  }
  stop() { this.running = false; if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  private tick() {
    const now = this.rig.t;
    if (this.nextT < now - 0.25) this.nextT = now + 0.05; // 被挂起/卡顿后重新同步
    this.scheduleUntil(now + 0.6);
  }
  /** 把 [nextT, until) 内的步全部预约（离线渲染直接调用此函数） */
  scheduleUntil(until: number) {
    while (this.nextT < until) { this.scheduleStep(this.step, this.nextT); this.nextT += this.stepSec; this.step = (this.step + 1) % LOOP_STEPS; }
  }
  /** 离线渲染：把起点对齐到 t0 并清空计数 */
  resetClock(t0: number) { this.nextT = t0; this.step = 0; }

  /** 距下一个小节起点的秒数（用于动机量化） */
  secToNextBar(): number {
    if (!this.running) return 0;
    const stepsLeft = STEPS_PER_BAR - (this.step % STEPS_PER_BAR);
    return Math.max(0, this.nextT - this.rig.t) + (stepsLeft % STEPS_PER_BAR) * this.stepSec;
  }

  /** 下一个小节起点的时间与小节号（0..15）；未运行时返回“现在” */
  nextBar(): { t: number; bar: number } {
    if (!this.running) return { t: this.rig.t + 0.05, bar: 0 };
    const left = (STEPS_PER_BAR - (this.step % STEPS_PER_BAR)) % STEPS_PER_BAR;
    return { t: Math.max(this.nextT, this.rig.t) + left * this.stepSec, bar: (Math.floor((this.step + left) / STEPS_PER_BAR)) % BARS };
  }
  /** 小节号 bar（0..15）在 nextBar 之后（含）第一次出现的时间 */
  timeOfBar(bar: number): number {
    const nb = this.nextBar(); const d = ((bar - nb.bar) % BARS + BARS) % BARS;
    return nb.t + d * STEPS_PER_BAR * this.stepSec;
  }

  private human() { return rr(-0.006, 0.006); }

  private scheduleStep(s: number, t0: number) {
    const R = this.rig, bar = Math.floor(s / STEPS_PER_BAR), b8 = s % STEPS_PER_BAR, ch = chordOfBar(bar), tr = this.transpose;
    const sd = this.stepSec; const t = t0 + (b8 % 2 ? this.human() : 0);
    const mel = MELODY_AT[s];
    const L = this.lay;
    const A = (n: LayerName) => this.on[n] || this.lay[n].gain.value > 0.02;
    const accent = b8 === 0 ? 1 : b8 === 4 ? 0.85 : 0.65;
    if (A('celesta') && mel) V.celesta(R, L.celesta, mel.midi + tr, t, 0.2 + (mel.dur >= 4 ? 0.02 : 0), 0.9 + mel.dur * 0.25 * sd * 2);
    if (A('guitar')) {
      const pat = [0, 2, 1, 3, 2, 3, 1, 2]; const m = ch.arp[pat[b8]] + 12 + tr;
      V.guitar(R, L.guitar, m, t, 0.1 * accent + 0.02, 0.9);
    }
    if (A('bass')) {
      if (b8 === 0) V.bass(R, L.bass, ch.root + tr, t, 0.26, sd * 3.6);
      else if (b8 === 4) V.bass(R, L.bass, ch.fifth + tr - 0, t, 0.2, sd * 3.2);
      else if (b8 === 7 && bar % 2 === 1) V.bass(R, L.bass, ch.root + 12 + tr, t, 0.1, sd * 0.9);
    }
    if (A('strings') && b8 === 0) V.strings(R, L.strings, ch.pad.map((m) => m + tr), t, sd * STEPS_PER_BAR + 0.15, 0.05);
    if (A('perc')) {
      if (b8 === 0) V.kick(R, L.perc, t, 0.26); else if (b8 === 4) V.kick(R, L.perc, t, 0.17);
      if (b8 === 2 || b8 === 6) V.woodblock(R, L.perc, t, 0.07, 820);
      if (b8 % 2 === 1) V.shaker(R, L.perc, t, 0.05);
    }
    if (A('hum') && mel && mel.dur >= 4) V.hum(R, L.hum, mel.midi + tr, t, Math.min(mel.dur * sd, 2.4), 0.1, b8 === 0 ? 'a' : 'm');
    if (A('bells')) {
      if (mel && mel.dur >= 2) V.bell(R, L.bells, mel.midi + 12 + tr, t, 0.08, 1.8);
      if (b8 % 4 === 2) V.sleighBells(R, L.bells, t, 0.05, 3);
    }
    if (A('choir') && b8 === 0 && bar % 2 === 0) V.choir(R, L.choir, ch.pad.map((m) => m + tr), t, sd * STEPS_PER_BAR * 2 + 0.2, 0.05);
    // 配色点缀
    if (this.color) this.colorStep(bar, b8, t, ch.pad.map((m) => m + tr), tr);
    // 动机：已完成故事在固定小节第 0 步出现
    if (A('motif') && b8 === 0) {
      for (const id of this.done) if (MOTIF_SLOT[id] === bar) this.playMotif(id, t, false, this.lay.motif, 0.8);
    }
  }

  private colorStep(bar: number, b8: number, t: number, pad: number[], tr: number) {
    const R = this.rig, C = this.colorBus, sd = this.stepSec, bs = sd * STEPS_PER_BAR;
    switch (this.color) {
      case 'morning': // 古筝泛音 + 远处鸟鸣
        if (b8 === 0 && bar % 4 === 2) V.guzheng(R, C, 79 + tr, t, 0.07, true);
        if (b8 === 4 && bar % 4 === 2) V.guzheng(R, C, 86 + tr, t, 0.05, true);
        if (b8 === 3 && rnd() < 0.14) V.chirp(R, C, t + rr(0, 0.3), 0.03);
        break;
      case 'noon': // 手风琴长音
        if (b8 === 0 && bar % 2 === 0) V.accordion(R, C, [pad[0], pad[1], pad[2]], t, bs * 2 - 0.2, 0.035);
        break;
      case 'dusk': // 竹笛长音
        if (b8 === 0 && bar % 2 === 0) V.flute(R, C, pad[2] + 12, t + 0.05, bs * 1.8, 0.06);
        if (b8 === 4 && bar % 4 === 3) V.flute(R, C, pad[1] + 12, t, bs * 0.45, 0.05);
        break;
      case 'night': // 风铃
        if (b8 === 4 && bar % 2 === 1 && rnd() < 0.75) { const m = [86, 88, 91, 93, 95][Math.floor(rnd() * 5)] + tr - 12 * 0; V.bell(R, C, m, t + rr(0, 0.4), 0.05, 3.2); }
        break;
      case 'sandbox': // 偶发钢片琴
        if (b8 % 4 === 0 && rnd() < 0.22) { const m = SAFE_PENTA[4 + Math.floor(rnd() * 6)] + tr; /* SAFE_PENTA 已是 MIDI 音高 */ V.celesta(R, C, m, t + rr(0, 0.5), 0.1, 2.4); }
        if (b8 === 0 && bar % 4 === 1 && rnd() < 0.7) V.bell(R, C, [88, 91, 93][Math.floor(rnd() * 3)] + tr, t + rr(0.2, 1), 0.03, 4);
        break;
    }
  }

  // ———————————————— 动机 / sting ————————————————
  /** 在时刻 t 播放一个故事动机（withTail=一次性完整版） */
  playMotif(id: StoryId, t: number, withTail: boolean, dest: AudioNode, vel = 1): number {
    const m = MOTIFS[id]; const R = this.rig; const tr = this.transpose; const sd = this.stepSec;
    const notes: MotifNote[] = withTail && m.tail ? [...m.notes, ...m.tail] : m.notes;
    let end = 0;
    // choir：同一 at 的音合并为和弦
    if (m.inst === 'choir') {
      const groups = new Map<number, MotifNote[]>();
      for (const n of notes) { const g = groups.get(n.at); if (g) g.push(n); else groups.set(n.at, [n]); }
      for (const [at, g] of groups) {
        const dur = g[0].dur * sd + 0.4; V.choir(R, dest, g.map((n) => n.midi + tr), t + at * sd, dur, 0.07 * vel);
        if (withTail && at === 0) V.bell(R, dest, g[g.length - 1].midi + 12 + tr, t + at * sd, 0.06 * vel, 2);
        end = Math.max(end, at * sd + dur + 1);
      }
      return end;
    }
    for (const n of notes) {
      const at = t + n.at * sd, d = Math.max(0.12, n.dur * sd), mi = n.midi + tr;
      switch (m.inst) {
        case 'hum': V.hum(R, dest, mi, at, d, 0.14 * vel, n.at % 2 === 0 ? 'a' : 'm'); break;
        case 'pizz': V.pizz(R, dest, mi, at, 0.17 * vel); break;
        case 'wood': V.wood(R, dest, mi, at, d, 0.17 * vel); break;
        case 'piano': V.piano(R, dest, mi, at, 0.16 * vel, d + 0.8); break;
        case 'trumpet': V.trumpet(R, dest, mi, at, d, 0.13 * vel); break;
      }
      end = Math.max(end, n.at * sd + d + 1);
    }
    if (m.inst === 'trumpet') { // 冲线的鼓点
      for (let i = 0; i < 6; i++) V.snare(R, dest, t + i * sd * 0.5, 0.05 + i * 0.015);
      V.tom(R, dest, t + 6 * sd * 0.5, 120, 0.18);
    }
    return end;
  }
  /** 一次性演出：按小节量化后播放完整动机并压低音乐 */
  storyMotif(raw: string): number {
    const id = canonStory(raw); if (!id) return 0;
    const delay = this.running ? Math.min(this.secToNextBar(), 2.5) : 0.05; const t = this.rig.t + delay;
    const dest = this.rig.music;
    const len = this.playMotif(id, t, true, dest, 1.15);
    this.rig.duck((delay + len) * 1000, 0.3, 0.6);
    return delay + len;
  }
  /** 故事完成：庆祝 sting + 加入动机层 + 升级音乐层级 */
  storyDone(raw: string): StoryId | undefined {
    const id = canonStory(raw); if (!id) return undefined;
    const R = this.rig, t = R.t + 0.05;
    const had = this.done.has(id);
    if (!had) { this.done.add(id); if (id === 'finale') this.finale = true; }
    // 庆祝音：五声音阶上行 + 铃声 + 和弦
    const up = [72, 76, 79, 84, 88];
    up.forEach((m, i) => { V.bell(R, R.music, m, t + i * 0.09, 0.1, 1.8); V.celesta(R, R.music, m - 12, t + i * 0.09, 0.1, 1.2); });
    V.strings(R, R.music, [60, 64, 67, 72], t, 1.8, 0.05);
    V.sleighBells(R, R.music, t + 0.45, 0.06, 5);
    R.duck(2200, 0.45, 0.7);
    if (id === 'finale') this.finaleCoda(t + 1.6);
    this.refreshLayers();
    if (!this.running) this.start();
    return id;
  }
  /** 终章尾声：平安夜（公有领域，Gruber 1818）前 8 小节引用，铃 + 合唱 */
  finaleCoda(t: number): number {
    const R = this.rig, sd = 0.3 / this.tempoMul, tr = this.transpose;
    let at = 0;
    for (const [m, e] of SILENT_NIGHT) {
      V.bell(R, R.music, m + 12 + tr, t + at * sd, 0.09, Math.min(3, e * sd + 1.2));
      V.celesta(R, R.music, m + tr, t + at * sd, 0.12, 1.4);
      at += e;
    }
    SILENT_NIGHT_CHORDS.forEach((c, i) => V.choir(R, R.music, c.map((m) => m + tr), t + i * 6 * sd, 6 * sd + 0.3, 0.05));
    const total = at * sd + 2;
    this.codaUntil = t + total; R.duck(total * 1000 + 800, 0.4, 0.5);
    return total;
  }
  /** 单个短 sting（任务开始/提示/结局等） */
  sting(name: 'start' | 'hint' | 'fail' | 'win'): void {
    const R = this.rig, t = R.t + 0.02, d = R.music;
    const seq = { start: [67, 72, 76], hint: [79, 84], fail: [64, 62, 60], win: [72, 76, 79, 84, 91] }[name];
    seq.forEach((m, i) => { const at = t + i * (name === 'fail' ? 0.16 : 0.08); name === 'fail' ? V.piano(R, d, m - 12, at, 0.12, 0.5) : (V.bell(R, d, m, at, 0.1, 1.4), V.celesta(R, d, m, at, 0.08, 0.9)); });
    R.duck(900, 0.55, 0.8);
  }
  /** 随机铃声点缀（当“暖度”上升时），用安全五声音阶 */
  twinkle(n = 3) { const R = this.rig; const t = R.t + 0.02; for (let i = 0; i < n; i++) V.bell(R, R.music, SAFE_PENTA[4 + Math.floor(rnd() * 8)], t + i * 0.07, 0.07, 1.3); }

  // 供 selftest：完整 16 小节时长
  get loopSeconds() { return this.stepSec * LOOP_STEPS; }
  get barSeconds() { return this.stepSec * STEPS_PER_BAR; }
  static readonly BARS = BARS;
}
