/**
 * 混音架（Rig）：把一个 AudioContext（或 OfflineAudioContext）接成统一的总线结构。
 *
 *   voices → music ─ duckMus ─ musLP ─┬────────────┐
 *   voices → sfx ─────────────────────┼─ pre ─ comp ─ shaper(软限幅) ─ master ─ destination
 *   voices → amb ─ duckAmb ───────────┤
 *            reverb(Convolver, 生成的脉冲响应) ──┘   (music/sfx/amb 各有发送量)
 *
 * 在线（AudioContext）与离线自测（OfflineAudioContext）共用同一套构建函数。
 */

// 可复现的随机数（selftest 里用 seed 固定，游戏里用 Math.random）
let seeded: (() => number) | null = null;
export function seedRandom(seed: number | null) {
  if (seed === null) { seeded = null; return; }
  let s = seed >>> 0 || 1;
  seeded = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export const rnd = () => (seeded ? seeded() : Math.random());
export const rr = (a: number, b: number) => a + (b - a) * rnd();
export const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length) % a.length];
export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export type BusKind = 'master' | 'music' | 'sfx' | 'amb';

export interface RigOpts {
  /** 关闭限幅器（selftest 用来量“原始”峰值） */
  bypassLimiter?: boolean;
  /** 混响脉冲响应秒数（默认 1.8） */
  reverbSeconds?: number;
}

export class Rig {
  readonly ctx: BaseAudioContext;
  readonly noiseW: AudioBuffer; // 白噪
  readonly noiseP: AudioBuffer; // 粉噪（可无缝循环）
  readonly noiseB: AudioBuffer; // 棕噪（可无缝循环）
  /** 声源接入口（保持旧名：音源 → sfxBus / musBus / ambBus） */
  readonly music: GainNode;
  readonly sfx: GainNode;
  readonly amb: GainNode;
  readonly duckMus: GainNode;
  readonly duckAmb: GainNode;
  readonly musLP: BiquadFilterNode;
  readonly reverb: ConvolverNode;
  readonly pre: GainNode;
  readonly comp: DynamicsCompressorNode;
  readonly master: GainNode;
  private sendMus: GainNode; private sendSfx: GainNode; private sendAmb: GainNode;
  /** 用户音量（0..1），和默认增益相乘 */
  readonly vol: Record<BusKind, number> = { master: 1, music: 1, sfx: 1, amb: 1 };
  /** 各总线默认增益（经 selftest 响度校准） */
  static readonly BASE: Record<BusKind, number> = { master: 0.92, music: 0.62, sfx: 0.9, amb: 0.8 };
  muted = false;

  constructor(ctx: BaseAudioContext, o: RigOpts = {}) {
    this.ctx = ctx;
    const sr = ctx.sampleRate;
    this.noiseW = makeNoise(ctx, 2, 'white');
    this.noiseP = makeNoise(ctx, 4, 'pink');
    this.noiseB = makeNoise(ctx, 4, 'brown');
    const g = (v: number) => { const n = ctx.createGain(); n.gain.value = v; return n; };

    this.music = g(Rig.BASE.music); this.sfx = g(Rig.BASE.sfx); this.amb = g(Rig.BASE.amb);
    this.duckMus = g(1); this.duckAmb = g(1);
    this.musLP = ctx.createBiquadFilter(); this.musLP.type = 'lowpass'; this.musLP.frequency.value = 5000; this.musLP.Q.value = 0.5;
    this.pre = g(1);
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.knee.value = 14; this.comp.ratio.value = 4; this.comp.attack.value = 0.008; this.comp.release.value = 0.24;
    this.master = g(Rig.BASE.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeImpulse(ctx, o.reverbSeconds ?? 1.8);
    const revRet = g(0.7);
    this.sendMus = g(0.3); this.sendSfx = g(0.2); this.sendAmb = g(0.12);

    // music
    this.music.connect(this.duckMus); this.duckMus.connect(this.musLP);
    this.musLP.connect(this.pre); this.musLP.connect(this.sendMus); this.sendMus.connect(this.reverb);
    // sfx
    this.sfx.connect(this.pre); this.sfx.connect(this.sendSfx); this.sendSfx.connect(this.reverb);
    // ambience
    this.amb.connect(this.duckAmb); this.duckAmb.connect(this.pre); this.duckAmb.connect(this.sendAmb); this.sendAmb.connect(this.reverb);
    this.reverb.connect(revRet); revRet.connect(this.pre);
    // 限幅链
    this.pre.connect(this.comp);
    if (o.bypassLimiter) { this.comp.connect(this.master); }
    else {
      const sh = ctx.createWaveShaper(); sh.curve = softClipCurve(); sh.oversample = 'none';
      const pg = g(0.8); // 压缩器后留 2 dB 余量再进软限幅
      this.comp.connect(pg); pg.connect(sh); sh.connect(this.master);
    }
    this.master.connect(ctx.destination);
    void sr;
  }

  get t() { return this.ctx.currentTime; }

  setVolume(kind: BusKind, v: number) {
    v = clamp(v, 0, 1); this.vol[kind] = v;
    this.applyGains();
  }
  setMuted(m: boolean) { this.muted = m; this.applyGains(); }
  private applyGains() {
    const t = this.ctx.currentTime;
    const set = (p: AudioParam, v: number) => { p.cancelScheduledValues(t); p.setTargetAtTime(v, t, 0.04); };
    set(this.master.gain, this.muted ? 0 : Rig.BASE.master * this.vol.master);
    set(this.music.gain, Rig.BASE.music * this.vol.music);
    set(this.sfx.gain, Rig.BASE.sfx * this.vol.sfx);
    set(this.amb.gain, Rig.BASE.amb * this.vol.amb);
  }
  /** 对白/演出时压低音乐与环境（ms 内保持低位，随后缓回） */
  duck(ms: number, depth = 0.35, ambDepth = 0.55) {
    const t = this.ctx.currentTime; const hold = Math.max(0.05, ms / 1000);
    for (const [p, d] of [[this.duckMus.gain, depth], [this.duckAmb.gain, ambDepth]] as [AudioParam, number][]) {
      p.cancelScheduledValues(t); p.setTargetAtTime(d, t, 0.06); p.setTargetAtTime(1, t + hold, 0.35);
    }
  }
  /** 暖度 0..100：音乐低通从“发闷”到“明亮” */
  setWarmthTone(w: number) {
    const f = 2400 + clamp(w, 0, 100) * 80; // 2.4k → 10.4k
    const t = this.ctx.currentTime; this.musLP.frequency.cancelScheduledValues(t); this.musLP.frequency.setTargetAtTime(f, t, 0.8);
  }
  /** 立体声摆位节点（不支持时返回 null） */
  panner(pan: number): StereoPannerNode | null {
    if (!pan || !this.ctx.createStereoPanner) return null;
    const p = this.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); return p;
  }
}

// ———————————————— 噪声 / 脉冲响应 ————————————————
function makeNoise(ctx: BaseAudioContext, sec: number, kind: 'white' | 'pink' | 'brown'): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(1, n, ctx.sampleRate); const d = b.getChannelData(0);
  const R = () => { const v = Math.random(); return v * 2 - 1; };
  if (kind === 'white') { for (let i = 0; i < n; i++) d[i] = R(); return b; }
  if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = R();
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < n; i++) { const w = R(); last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  }
  // 首尾交叉淡化 → 循环无咔哒
  const x = Math.floor(ctx.sampleRate * 0.08);
  for (let i = 0; i < x; i++) { const k = i / x; d[n - x + i] = d[n - x + i] * (1 - k) + d[i] * k; }
  const out = ctx.createBuffer(1, n - x, ctx.sampleRate); out.getChannelData(0).set(d.subarray(0, n - x));
  return out;
}

/** 生成混响脉冲响应：预延迟 + 指数衰减噪声 + 随时间变暗（一阶低通系数渐大） */
function makeImpulse(ctx: BaseAudioContext, sec: number): AudioBuffer {
  const sr = ctx.sampleRate; const n = Math.floor(sr * sec);
  const b = ctx.createBuffer(2, n, sr); const pre = Math.floor(sr * 0.018);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr; const env = Math.exp(-t * 3.4);
      const a = 0.25 + 0.7 * Math.min(1, t / sec); // 越往后越暗
      lp = lp * a + (Math.random() * 2 - 1) * (1 - a);
      d[i] = lp * env * 1.6;
    }
    // 早期反射
    for (const [ms, g] of [[23, 0.5], [41, 0.38], [67, 0.3], [97, 0.2]] as [number, number][]) { const k = pre + Math.floor((ms + c * 7) * sr / 1000); if (k < n) d[k] += g * (c ? -1 : 1); }
  }
  return b;
}

/** 软限幅曲线：|x|≤0.5 线性，之后 tanh 压向 0.92 → 最终绝对不会超过 ~0.85×master */
function softClipCurve(): Float32Array<ArrayBuffer> {
  const N = 2049; const c = new Float32Array(N); const a = 0.5, m = 0.92;
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1; const ax = Math.abs(x);
    const y = ax <= a ? ax : a + (m - a) * Math.tanh((ax - a) / (m - a));
    c[i] = x < 0 ? -y : y;
  }
  return c;
}
