/**
 * sfx.ts — WebAudio 合成音效 + 发声节点池(无外部音频文件)。
 * - createVoicer: 带"同时发声数上限"的 tone / noise 工厂,节点在 onended 后全部 disconnect。
 * - createSfx: 9 个游戏音效(shake/coin/golden/buy/stage/bonk/bite/sleep/fanfare)。
 */

export type Pool = 'sfx' | 'music';

export interface ToneOpts {
  /** 绝对开始时间(ctx.currentTime 坐标) */
  t: number;
  /** 起始频率 Hz */
  f: number;
  /** 结束频率 Hz(指数滑音);省略则不滑 */
  f2?: number;
  /** 持续时间(秒,含释放) */
  dur: number;
  /** 峰值音量 */
  vol: number;
  type?: OscillatorType;
  wave?: PeriodicWave;
  /** 起音时间,默认 0.005 */
  a?: number;
  /** 释放(指数衰减)时长,默认 dur - a(即起音后立即衰减) */
  r?: number;
  /** 低通截止频率 */
  lp?: number;
  detune?: number;
  pool?: Pool;
}

export interface NoiseOpts {
  t: number;
  dur: number;
  vol: number;
  filter?: BiquadFilterType;
  f?: number;
  f2?: number;
  q?: number;
  a?: number;
  pool?: Pool;
}

export interface Voicer {
  tone(dest: AudioNode, o: ToneOpts): void;
  noise(dest: AudioNode, o: NoiseOpts): void;
  /** 预建的"贝壳/八音盒"周期波 */
  bell: PeriodicWave;
}

const MAX_VOICES: Record<Pool, number> = { sfx: 16, music: 32 };
const FLOOR = 0.0001;

export function createVoicer(ctx: AudioContext): Voicer {
  const active: Record<Pool, number> = { sfx: 0, music: 0 };

  // 1 秒白噪声缓冲,所有噪声音共用,每次随机起点
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const bell = ctx.createPeriodicWave([0, 0, 0, 0, 0, 0, 0], [0, 1, 0.35, 0.05, 0.12, 0, 0.05]);

  const envelope = (g: GainNode, t: number, dur: number, vol: number, a: number, r?: number) => {
    const rel = Math.min(r ?? dur - a, dur - a);
    const relStart = t + dur - rel;
    g.gain.setValueAtTime(FLOOR, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol, Math.max(relStart, t + a));
    g.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
  };

  const tone = (dest: AudioNode, o: ToneOpts) => {
    const pool = o.pool ?? 'sfx';
    if (active[pool] >= MAX_VOICES[pool]) return;
    active[pool]++;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    let filt: BiquadFilterNode | null = null;
    if (o.wave) osc.setPeriodicWave(o.wave);
    else osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f, o.t);
    if (o.f2 !== undefined) osc.frequency.exponentialRampToValueAtTime(o.f2, o.t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    envelope(g, o.t, o.dur, o.vol, o.a ?? 0.005, o.r);
    if (o.lp) {
      filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = o.lp;
      osc.connect(filt);
      filt.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(dest);
    osc.onended = () => {
      active[pool]--;
      osc.disconnect();
      filt?.disconnect();
      g.disconnect();
    };
    osc.start(o.t);
    osc.stop(o.t + o.dur + 0.03);
  };

  const noise = (dest: AudioNode, o: NoiseOpts) => {
    const pool = o.pool ?? 'sfx';
    if (active[pool] >= MAX_VOICES[pool]) return;
    active[pool]++;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = o.filter ?? 'bandpass';
    filt.frequency.setValueAtTime(o.f ?? 2000, o.t);
    if (o.f2 !== undefined) filt.frequency.exponentialRampToValueAtTime(o.f2, o.t + o.dur);
    filt.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    envelope(g, o.t, o.dur, o.vol, o.a ?? 0.003);
    src.connect(filt);
    filt.connect(g);
    g.connect(dest);
    src.onended = () => {
      active[pool]--;
      src.disconnect();
      filt.disconnect();
      g.disconnect();
    };
    src.start(o.t, Math.random() * Math.max(0, 1 - o.dur - 0.05));
    src.stop(o.t + o.dur + 0.03);
  };

  return { tone, noise, bell };
}

export interface SfxSet {
  shake(): void;
  coin(): void;
  golden(): void;
  buy(): void;
  stage(): void;
  bonk(): void;
  bite(): void;
  sleep(): void;
  fanfare(): void;
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export function createSfx(ctx: AudioContext, v: Voicer, dest: AudioNode): SfxSet {
  const now = () => ctx.currentTime + 0.01;
  const jit = (amt = 0.04) => 1 + (Math.random() * 2 - 1) * amt;

  return {
    // 摇树: 沙沙噪声(两次扫动) + 短促低音一击
    shake() {
      const t = now();
      v.noise(dest, { t, dur: 0.22, vol: 0.2, filter: 'bandpass', f: 1800 * jit(0.2), f2: 4200, q: 0.9, a: 0.02 });
      v.noise(dest, { t: t + 0.09, dur: 0.2, vol: 0.14, filter: 'bandpass', f: 4000, f2: 2000 * jit(0.2), q: 0.9, a: 0.02 });
      v.noise(dest, { t, dur: 0.3, vol: 0.05, filter: 'highpass', f: 6000, q: 0.5, a: 0.03 });
      v.tone(dest, { t, f: 196 * jit(), f2: 150, dur: 0.1, vol: 0.12, type: 'triangle' });
    },
    // 金币: 升调叮 (B5 → E6)
    coin() {
      const t = now();
      v.tone(dest, { t, f: 988 * jit(0.01), dur: 0.09, vol: 0.09, type: 'square', lp: 5000 });
      v.tone(dest, { t: t + 0.07, f: 1319 * jit(0.01), dur: 0.28, vol: 0.09, type: 'square', lp: 5000 });
      v.tone(dest, { t: t + 0.07, f: 2637, dur: 0.2, vol: 0.03, wave: v.bell });
    },
    // 金苹果: 闪亮上行琶音(降E大调五声音阶,铃音)+ 高频亮粉
    golden() {
      const t = now();
      const notes = [84, 87, 91, 94, 96, 99]; // C6 Eb6 G6 Bb6 C7 Eb7
      notes.forEach((m, i) => {
        v.tone(dest, { t: t + i * 0.06, f: mtof(m), dur: 0.5, vol: 0.1, wave: v.bell, a: 0.004 });
      });
      v.noise(dest, { t: t + 0.05, dur: 0.45, vol: 0.05, filter: 'highpass', f: 7000, a: 0.05 });
    },
    // 购买: 噪声 tick + 双音 "叮咚"
    buy() {
      const t = now();
      v.noise(dest, { t, dur: 0.03, vol: 0.12, filter: 'highpass', f: 3000 });
      v.tone(dest, { t, f: 659, dur: 0.14, vol: 0.09, type: 'triangle' });
      v.tone(dest, { t: t + 0.08, f: 880, dur: 0.3, vol: 0.1, type: 'triangle' });
      v.tone(dest, { t: t + 0.08, f: 1760, dur: 0.2, vol: 0.03, wave: v.bell });
    },
    // 进入新阶段: 上行大三和弦 C5-E5-G5-C6,尾音延长
    stage() {
      const t = now();
      [72, 76, 79, 84].forEach((m, i) => {
        v.tone(dest, { t: t + i * 0.1, f: mtof(m), dur: i === 3 ? 0.9 : 0.5, vol: 0.09, type: 'triangle', lp: 4000, a: 0.01 });
        v.tone(dest, { t: t + i * 0.1, f: mtof(m + 12), dur: 0.4, vol: 0.03, wave: v.bell });
      });
    },
    // 苹果砸头: 木头一击 + 下行滑音
    bonk() {
      const t = now();
      v.tone(dest, { t, f: 320, f2: 110, dur: 0.14, vol: 0.28, type: 'sine', a: 0.002 });
      v.noise(dest, { t, dur: 0.05, vol: 0.14, filter: 'bandpass', f: 1400, q: 2, a: 0.001 });
      v.tone(dest, { t: t + 0.05, f: 520, f2: 150, dur: 0.28, vol: 0.09, type: 'triangle', a: 0.01 });
    },
    // 咬一口: 两次脆响
    bite() {
      const t = now();
      v.noise(dest, { t, dur: 0.06, vol: 0.2, filter: 'bandpass', f: 2200, f2: 1200, q: 1.2, a: 0.001 });
      v.noise(dest, { t: t + 0.07, dur: 0.07, vol: 0.16, filter: 'bandpass', f: 1800, f2: 900, q: 1.2, a: 0.001 });
      v.tone(dest, { t, f: 260, f2: 140, dur: 0.08, vol: 0.08, type: 'triangle' });
    },
    // 睡着: 下行柔和三音
    sleep() {
      const t = now();
      [72, 67, 62].forEach((m, i) => {
        v.tone(dest, { t: t + i * 0.28, f: mtof(m), dur: 0.7, vol: 0.09, type: 'sine', a: 0.04, lp: 2000 });
      });
    },
    // 通关号角: 短短短-长 的锯齿铜管 + 方波高八度点缀
    fanfare() {
      const t = now();
      const seq: Array<[number, number, number]> = [
        [72, 0, 0.13],
        [72, 0.16, 0.13],
        [72, 0.32, 0.13],
        [76, 0.48, 0.24],
        [79, 0.76, 0.7],
      ];
      seq.forEach(([m, off, d]) => {
        v.tone(dest, { t: t + off, f: mtof(m), dur: d, vol: 0.1, type: 'sawtooth', lp: 2200, a: 0.015, r: d * 0.5 });
        v.tone(dest, { t: t + off, f: mtof(m + 12), dur: d, vol: 0.035, type: 'square', lp: 3000, a: 0.015, r: d * 0.5 });
      });
      v.tone(dest, { t: t + 0.76, f: mtof(84), dur: 0.9, vol: 0.05, wave: v.bell });
    },
  };
}
