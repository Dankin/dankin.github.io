/**
 * music.ts — 原创合成 BGM(WebAudio,零音频文件)。
 *
 * 6 个时代各有一套"音色包 + 调式 + 8 小节和弦/旋律",以 4/4、8 分音符为步进、64 步循环,
 * 连续调度(从不重启),奇数遍旋律加三度和声,所以实际周期是 16 小节。
 *   0 树/篮子   G 五声    马林巴 + 拨弦 + 沙锤
 *   1 小果园    D 大调    马林巴 + 弦乐 pad + 刷子鼓
 *   2 果山/卡车 E 多利亚  木笛 + 吉他扫弦 + 边击
 *   3 果城/货船 C 大调    手风琴 + oom-pah + 进行曲军鼓
 *   4 果星/飞机 F 利底亚  玻璃音 + 合成琶音 + 轻四拍
 *   5 苹果之门  G 大调    铜管 + 全合奏(旋律引用第 0 时代主题,回到起点)
 * 强度 setIntensity(0..5):0 主旋律 1 琶音/扫弦 2 pad 3 低音 4 鼓与镲 5 军鼓 + 高八度。
 * 昼夜:夜里速度 ×0.75(112→84)、低通压到 1.2kHz,只留八音盒 + pad + 低音。
 * 天气/季节:速度 ±数%、亮度、回声量、点缀(雨滴/雪闪/春鸟/夏沙锤/冬雪橇铃)。
 * 换时代:在下一个小节线上做 2 秒交叉淡入淡出。
 */
import type { NoiseOpts, ToneOpts, Voicer } from './voicer.ts';

export type Weather = 'clear' | 'cloudy' | 'rain' | 'snow';
export interface World {
  /** 0..1,0=深夜 */
  daylight: number;
  /** 0 春 1 夏 2 秋 3 冬 */
  season: number;
  weather: Weather;
}

type Lead = 'marimba' | 'pluck' | 'flute' | 'accordion' | 'glass' | 'brass';
type Arp = 'pluck' | 'strum' | 'pump' | 'synth';
type Bass = 'tri' | 'pump' | 'pulse';
type Drum = 'shaker' | 'brush' | 'rim' | 'march' | 'soft';

interface EraDef {
  name: string;
  tonic: number;
  scale: number[];
  bpm: number;
  /** 和弦:根音半音+品质(M m s=sus4 d=属七 n=小七 j=大七) */
  prog: string;
  /** 旋律:8 小节×8 格,0-9a-f=音阶级(7 音阶下 5=tonic 上方一个八度),-=延音,.=休止 */
  mel: string;
  lead: Lead;
  arp: Arp;
  /** pad: 波形、低通、起音、音量 */
  pad: [OscillatorType, number, number, number];
  bass: Bass;
  drum: Drum;
}

const MAJ = [0, 2, 4, 5, 7, 9, 11];
export const ERAS: EraDef[] = [
  { name: 'tree', tonic: 55, scale: [0, 2, 4, 7, 9], bpm: 108, prog: '0M 4m 5M 7s 0M 9m 2n 7d',
    mel: '7.8.a-8. 9-8-7-6. 5.6.7-9- 8---7-8. 7.8.a-b. c-a-9-8. 9.8.7.6. 5-7-8---',
    lead: 'marimba', arp: 'pluck', pad: ['sawtooth', 900, 0.5, 0.022], bass: 'tri', drum: 'shaker' },
  { name: 'orchard', tonic: 50, scale: MAJ, bpm: 110, prog: '0M 7M 9m 5M 0M 7M 5M 7d',
    mel: '9.a.c-a. b-d-b-9. a.c.e-d. c---a-8. 9.a.c-e. e-d-b-9. 8.a.c.a. b.9.b---',
    lead: 'marimba', arp: 'pluck', pad: ['sawtooth', 950, 0.5, 0.024], bass: 'tri', drum: 'brush' },
  { name: 'mountain', tonic: 52, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 104, prog: '0m 10M 3M 5M 0m 10M 3M 7m',
    mel: '9.c-b-9. b.d-b-8. 7.9.b-9. a.c.e-c. 9.c-e-d. d-b-8-b. 9.b.e-d. c-b-9---',
    lead: 'flute', arp: 'strum', pad: ['sawtooth', 1000, 0.4, 0.026], bass: 'tri', drum: 'rim' },
  { name: 'city', tonic: 48, scale: MAJ, bpm: 112, prog: '0M 5M 7M 0M 9m 5M 7M 7d',
    mel: 'c.c.e-c. a.a.c-a. b.b.d-b. c-e-c-9. a.c.e-c. a.8.a-c. d.b.9.b. b-d-f-d.',
    lead: 'accordion', arp: 'pump', pad: ['sawtooth', 1100, 0.3, 0.024], bass: 'pump', drum: 'march' },
  { name: 'star', tonic: 53, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 116, prog: '0M 2M 4m 7M 0M 2M 9m 7s',
    mel: 'c---a-9. a-b-d--- e---c-b. 9-b-9--- c-d-e-d. d---b-a. a-c-e-c. b---9---',
    lead: 'glass', arp: 'synth', pad: ['triangle', 1600, 0.8, 0.036], bass: 'pulse', drum: 'soft' },
  { name: 'gate', tonic: 55, scale: MAJ, bpm: 112, prog: '0M 7M 9m 5M 0M 7M 5M 7d',
    mel: '7.9.c-9. a-9-7-6. a.9.7-a- c---a-8. 7.9.c-e. d-c-a-9. 8.a.c.e. d-c-b-9-',
    lead: 'brass', arp: 'strum', pad: ['sawtooth', 1500, 0.4, 0.03], bass: 'pump', drum: 'march' },
];
export const ERA_COUNT = ERAS.length;

const CH: Record<string, number[]> = { M: [0, 4, 7], m: [0, 3, 7], s: [0, 5, 7], d: [0, 4, 7, 10], n: [0, 3, 7, 10], j: [0, 4, 7, 11] };
// 鼓:kick 步位与音量,sn 0 无 1 刷子 2 边击 3 军鼓
const DRUMS: Record<Drum, { k: number[]; kv: number; sn: number }> = {
  shaker: { k: [0], kv: 0.15, sn: 0 },
  brush: { k: [0, 4], kv: 0.15, sn: 1 },
  rim: { k: [0, 4], kv: 0.22, sn: 2 },
  march: { k: [0, 4], kv: 0.26, sn: 3 },
  soft: { k: [0, 2, 4, 6], kv: 0.13, sn: 0 },
};
const ARP = [0, 1, 2, 1, 0, 1, 2, 1];
const ARP_SYNTH = [0, 1, 2, 3, 2, 1, 2, 3];

export const LOOKAHEAD = 0.2;
export const TICK_MS = 30;
export const STEPS = 64;
export const CROSSFADE = 2;
export const NIGHT_TEMPO = 0.75;
export const NIGHT_LP = 1200;
const DAY_LP = 14000;

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const smooth = (d: number) => {
  const x = Math.min(1, Math.max(0, (d - 0.15) / 0.4));
  return x * x * (3 - 2 * x);
};

interface Compiled {
  def: EraDef;
  chords: Array<{ root: number; tones: number[] }>;
  mel: Map<number, { i: number; len: number }>;
  /** 音阶级(含八度)→ MIDI;七音阶 idx5 = tonic+12,五声 idx5 同理 */
  note(i: number): number;
}

function compile(def: EraDef): Compiled {
  const n = def.scale.length;
  const off = n - 5;
  const note = (i: number) => def.tonic + def.scale[((i % n) + n) % n] + 12 * Math.floor(i / n);
  const chords = def.prog.split(' ').map((tk) => {
    let semi = parseInt(tk, 10);
    if (semi > 6) semi -= 12;
    const iv = CH[tk.replace(/\d+/, '')] ?? CH.M;
    return { root: def.tonic + semi, tones: iv.map((x) => def.tonic + semi + x) };
  });
  const mel = new Map<number, { i: number; len: number }>();
  def.mel.split(' ').forEach((bar, b) => {
    for (let s = 0; s < 8; s++) {
      const c = bar[s];
      if (c === '.' || c === '-') continue;
      let len = 1;
      while (s + len < 8 && bar[s + len] === '-') len++;
      mel.set(b * 8 + s, { i: parseInt(c, 16) + off, len });
    }
  });
  return { def, chords, mel, note };
}
const COMPILED = ERAS.map(compile);

export interface MusicIO {
  ctx: AudioContext;
  v: Voicer;
  /** 音乐总线入口(mixer.musicIn) */
  out: AudioNode;
  lp: BiquadFilterNode;
  delaySend: GainNode;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
  setTimeout: (fn: () => void, ms: number) => unknown;
  rnd: () => number;
}

export interface Music {
  start(): void;
  stop(): void;
  /** 仅停定时器(切后台),保留位置与总线 */
  pause(): void;
  resume(): void;
  tick(): void;
  setEra(n: number): void;
  setIntensity(n: number): void;
  setWorld(w: Partial<World>): void;
  state(): { era: number; pendingEra: number | null; intensity: number; night: boolean; bpm: number; step: number; running: boolean; ticking: boolean; world: World };
}

export function createMusic(io: MusicIO): Music {
  const { ctx, v, rnd } = io;
  let era = 0;
  let pendingEra: number | null = null;
  let intensity = 0;
  const world: World = { daylight: 1, season: 0, weather: 'clear' };
  let night = false;
  let bpm = ERAS[0].bpm;
  let timer: unknown = null;
  let running = false;
  let nextTime = 0;
  let step = 0;
  let pass = 0;
  let bus: GainNode | null = null;

  const tempoTarget = () => {
    const wm = { clear: 1, cloudy: 0.98, rain: 0.97, snow: 0.94 }[world.weather];
    const sm = [1.02, 1.04, 0.98, 0.96][world.season] ?? 1;
    return ERAS[era].bpm * (NIGHT_TEMPO + (1 - NIGHT_TEMPO) * smooth(world.daylight)) * wm * sm;
  };

  const applyWorld = () => {
    if (night && world.daylight > 0.42) night = false;
    else if (!night && world.daylight < 0.3) night = true;
    const wl = { clear: 1, cloudy: 0.85, rain: 0.7, snow: 0.8 }[world.weather];
    const sl = [1, 1, 0.85, 0.9][world.season] ?? 1;
    const f = NIGHT_LP * Math.pow(DAY_LP / NIGHT_LP, smooth(world.daylight)) * wl * sl;
    const t = ctx.currentTime;
    io.lp.frequency.setTargetAtTime(Math.max(300, f), t, 1.2);
    io.delaySend.gain.setTargetAtTime({ clear: 0.08, cloudy: 0.15, rain: 0.22, snow: 0.32 }[world.weather], t, 0.8);
  };

  const makeBus = (t: number, fade: number) => {
    const b = ctx.createGain();
    b.gain.setValueAtTime(0.0001, t);
    b.gain.linearRampToValueAtTime(1, t + fade);
    b.connect(io.out);
    return b;
  };
  const retire = (b: GainNode, t: number, fade: number) => {
    b.gain.cancelScheduledValues(t);
    b.gain.setValueAtTime(1, t);
    b.gain.linearRampToValueAtTime(0.0001, t + fade);
    io.setTimeout(() => b.disconnect(), Math.max(0, (t - ctx.currentTime + fade) * 1000) + 400);
  };

  // ───── 乐器 ─────
  const sched = (idx: number, t: number, sd: number) => {
    const b = bus;
    if (!b) return;
    const C = COMPILED[era];
    const E = C.def;
    const bar = idx >> 3;
    const s = idx & 7;
    const ch = C.chords[bar];
    const T = (o: ToneOpts) => v.tone(b, { pool: 'music', ...o });
    const N = (o: NoiseOpts) => v.noise(b, { pool: 'music', ...o });
    const day = !night;

    // 主旋律
    const m = C.mel.get(idx);
    if (m) {
      const f = mtof(C.note(m.i));
      const d = m.len * sd * 0.95;
      const hum = (rnd() - 0.5) * 0.01;
      const tt = t + hum;
      if (night) {
        T({ t: tt, f, dur: Math.max(0.6, d * 1.8), vol: 0.13, wave: v.bell, a: 0.004 });
      } else {
        switch (E.lead) {
          case 'marimba':
            T({ t: tt, f, dur: Math.min(0.5, d + 0.2), vol: 0.14, a: 0.002 });
            T({ t: tt, f: f * 4, dur: 0.08, vol: 0.04, a: 0.001 });
            break;
          case 'pluck':
            T({ t: tt, f, dur: 0.5, vol: 0.13, type: 'triangle', lp: 3200, a: 0.003 });
            break;
          case 'flute':
            T({ t: tt, f, dur: d + 0.1, vol: 0.12, a: 0.05, r: 0.2 });
            T({ t: tt, f: f * 2, dur: d, vol: 0.025, type: 'triangle', a: 0.06, r: 0.2 });
            break;
          case 'accordion':
            T({ t: tt, f, dur: d + 0.08, vol: 0.05, type: 'sawtooth', lp: 2400, a: 0.03, r: 0.12, detune: -8 });
            T({ t: tt, f, dur: d + 0.08, vol: 0.05, type: 'sawtooth', lp: 2400, a: 0.03, r: 0.12, detune: 8 });
            T({ t: tt, f, dur: d + 0.08, vol: 0.04, type: 'square', lp: 1800, a: 0.03, r: 0.12 });
            break;
          case 'glass':
            T({ t: tt, f, dur: d + 0.4, vol: 0.12, a: 0.012 });
            T({ t: tt, f: f * 2, dur: d + 0.3, vol: 0.04, wave: v.bell, a: 0.01 });
            break;
          case 'brass':
            T({ t: tt, f, dur: d + 0.05, vol: 0.075, type: 'sawtooth', lp: 2200, a: 0.02, r: 0.15 });
            T({ t: tt, f: f * 2, dur: d, vol: 0.03, type: 'square', lp: 3000, a: 0.02, r: 0.15 });
            T({ t: tt, f, dur: 0.6, vol: 0.05, wave: v.bell, a: 0.003 });
            break;
        }
        if (intensity >= 5) T({ t: tt, f: f * 2, dur: 0.5, vol: 0.05, wave: v.bell, a: 0.003 });
      }
      // 奇数遍,后半段加三度下方的和声
      if (pass & 1 && bar >= 4) T({ t: tt, f: mtof(C.note(m.i - 2)), dur: Math.max(0.4, d), vol: 0.05, wave: v.bell, a: 0.004 });
    }

    // 1 琶音/扫弦(白天)
    if (day && intensity >= 1) {
      const tn = ch.tones;
      if (E.arp === 'pluck') {
        const rev = pass & 1 ? 7 - s : s;
        T({ t, f: mtof(tn[ARP[rev] % tn.length]), dur: 0.35, vol: 0.06, type: 'triangle', lp: 1800, a: 0.004 });
      } else if (E.arp === 'strum') {
        if (s === 0 || s === 4) tn.slice(0, 3).forEach((n, i) => T({ t: t + i * 0.018, f: mtof(n + 12), dur: 0.55, vol: 0.045, type: 'triangle', lp: 2200, a: 0.003 }));
        else if (s === 2 || s === 6) T({ t, f: mtof(tn[(s >> 1) % 3] + 12), dur: 0.3, vol: 0.04, type: 'triangle', lp: 2200, a: 0.003 });
      } else if (E.arp === 'pump') {
        if (s === 2 || s === 6) tn.slice(0, 3).forEach((n) => T({ t, f: mtof(n + 12), dur: 0.2, vol: 0.03, type: 'sawtooth', lp: 1600, a: 0.008 }));
      } else {
        const k = ARP_SYNTH[s] % tn.length;
        T({ t, f: mtof(tn[k] + (s & 1 ? 24 : 12)), dur: 0.17, vol: 0.032, type: 'square', lp: 2600, a: 0.004 });
      }
    }

    // 2 pad(每小节一次);夜里始终在
    if (s === 0 && (night || intensity >= 2)) {
      const d = sd * 8 + 0.4;
      for (const n of ch.tones.slice(0, 3)) {
        if (night) {
          T({ t, f: mtof(n), dur: d, vol: 0.03, type: 'triangle', lp: 700, a: 0.9, r: 1 });
        } else {
          const [w, lp, a, vol] = E.pad;
          for (const det of [-7, 7]) T({ t, f: mtof(n), dur: d, vol, type: w, lp, a, r: 0.9, detune: det });
        }
      }
    }

    // 3 低音;夜里始终在,只有 1、3 拍
    const bs = E.bass;
    if (night ? s === 0 || s === 4 : intensity >= 3) {
      const r = ch.root - 12;
      if (night) T({ t, f: mtof(r), dur: 0.9, vol: 0.12, type: 'triangle', lp: 500, a: 0.02 });
      else if (bs === 'tri' && (s === 0 || s === 4 || s === 7)) T({ t, f: mtof(r + (s === 7 ? 12 : 0)), dur: s === 7 ? 0.2 : 0.55, vol: s === 7 ? 0.1 : 0.2, type: 'triangle', lp: 700, a: 0.01 });
      else if (bs === 'pump' && (s === 0 || s === 4)) T({ t, f: mtof(r + (s === 4 ? 7 : 0)), dur: 0.3, vol: 0.2, type: 'triangle', lp: 800, a: 0.008 });
      else if (bs === 'pulse' && (s === 0 || s === 3 || s === 4 || s === 7)) T({ t, f: mtof(r), dur: 0.22, vol: 0.14, type: 'triangle', lp: 600, a: 0.006 });
    }

    // 4 鼓与镲、5 军鼓(白天)
    if (day && intensity >= 4) {
      const D = DRUMS[E.drum];
      if (D.k.includes(s)) T({ t, f: 130, f2: 45, dur: 0.22, vol: D.kv, a: 0.002 });
      if (s & 1 || intensity >= 5) N({ t, dur: s & 1 ? 0.04 : 0.025, vol: s & 1 ? 0.045 : 0.022, filter: 'highpass', f: 7500, a: 0.001 });
      if (intensity >= 5 && D.sn && (s === 2 || s === 6 || (bar === 7 && s >= 6))) {
        if (D.sn === 1) N({ t, dur: 0.12, vol: 0.05, f: 4000, q: 0.5, a: 0.003 });
        else if (D.sn === 2) {
          T({ t, f: 1100, dur: 0.03, vol: 0.05, type: 'triangle', a: 0.001 });
          N({ t, dur: 0.04, vol: 0.06, f: 2500, a: 0.001 });
        } else {
          N({ t, dur: 0.14, vol: 0.12, f: 1800, q: 0.7, a: 0.001 });
          T({ t, f: 220, f2: 150, dur: 0.08, vol: 0.06, type: 'triangle', a: 0.001 });
        }
      }
    }
    // 第 5 时代:小节 0/4 铜管和弦重音(全合奏)
    if (era === 5 && day && intensity >= 3 && s === 0 && (bar === 0 || bar === 4)) {
      ch.tones.slice(0, 3).forEach((n) => T({ t, f: mtof(n), dur: 0.5, vol: 0.03, type: 'sawtooth', lp: 2200, a: 0.02, r: 0.3 }));
    }

    // 天气/季节点缀(很轻)
    const hi = () => mtof(C.note(10 + Math.floor(rnd() * 6) + (E.scale.length - 5)));
    if (world.weather === 'rain' && s & 1 && rnd() < 0.28) T({ t, f: hi() * 2, dur: 0.3, vol: 0.03, wave: v.bell, a: 0.002 });
    if (world.weather === 'snow' && !(s & 1) && rnd() < 0.3) T({ t, f: hi() * 2, dur: 0.6, vol: 0.025, wave: v.bell, a: 0.004 });
    if (day) {
      if (world.season === 0 && s === 5 && rnd() < 0.15) {
        T({ t, f: 2400, f2: 3200, dur: 0.08, vol: 0.02, a: 0.005 });
        T({ t: t + 0.1, f: 2800, f2: 3400, dur: 0.08, vol: 0.02, a: 0.005 });
      }
      if (world.season === 1 && intensity >= 1 && s & 1) N({ t, dur: 0.05, vol: 0.02, filter: 'highpass', f: 6500, a: 0.002 });
      if (world.season === 3 && intensity >= 1 && (s === 2 || s === 6)) {
        N({ t, dur: 0.14, vol: 0.03, f: 6500, q: 4, a: 0.002 });
        T({ t, f: 3520, dur: 0.12, vol: 0.015, wave: v.bell, a: 0.002 });
      }
    }
  };

  const swapEra = (t: number) => {
    if (pendingEra === null) return;
    era = pendingEra;
    pendingEra = null;
    if (bus) retire(bus, t, CROSSFADE);
    bus = makeBus(t, CROSSFADE);
  };

  const tick = () => {
    if (ctx.state !== 'running' || !bus) return;
    const now = ctx.currentTime;
    if (nextTime < now - 0.05) nextTime = now + 0.03; // 长时间停顿后重新对齐,不补播
    while (nextTime < now + LOOKAHEAD) {
      if ((step & 7) === 0) swapEra(nextTime);
      bpm += (tempoTarget() - bpm) * 0.12;
      const sd = 60 / bpm / 2;
      sched(step, nextTime, sd);
      nextTime += sd;
      step = (step + 1) % STEPS;
      if (step === 0) pass++;
    }
  };

  const arm = () => {
    if (timer === null) timer = io.setInterval(tick, TICK_MS);
  };
  const disarm = () => {
    if (timer !== null) io.clearInterval(timer);
    timer = null;
  };

  return {
    start() {
      running = true;
      if (timer !== null) return;
      if (bus) {
        this.resume(); // 仅被暂停(切后台):保留位置
        return;
      }
      const t = ctx.currentTime;
      bus = makeBus(t, 0.4);
      applyWorld();
      bpm = tempoTarget();
      nextTime = t + 0.08;
      step = 0;
      pass = 0;
      arm();
    },
    stop() {
      running = false;
      disarm();
      pendingEra = null;
      if (bus) {
        const old = bus;
        bus = null;
        const t = ctx.currentTime;
        old.gain.cancelScheduledValues(t);
        old.gain.setValueAtTime(old.gain.value, t);
        old.gain.linearRampToValueAtTime(0.0001, t + 0.15);
        io.setTimeout(() => old.disconnect(), 400);
      }
    },
    pause: disarm,
    resume() {
      if (!running || !bus || timer !== null) return;
      nextTime = ctx.currentTime + 0.05;
      arm();
    },
    tick,
    setEra(n) {
      const e = Math.min(ERA_COUNT - 1, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));
      if (timer === null || !bus) {
        era = e;
        pendingEra = null;
      } else pendingEra = e === era ? null : e;
    },
    setIntensity(n) {
      intensity = Math.min(5, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));
    },
    setWorld(w) {
      if (w.daylight !== undefined && Number.isFinite(w.daylight)) world.daylight = Math.min(1, Math.max(0, w.daylight));
      if (w.season !== undefined && Number.isFinite(w.season)) world.season = ((Math.floor(w.season) % 4) + 4) % 4;
      if (w.weather !== undefined) world.weather = w.weather;
      applyWorld();
    },
    state: () => ({ era, pendingEra, intensity, night, bpm, step, running, ticking: timer !== null, world: { ...world } }),
  };
}
