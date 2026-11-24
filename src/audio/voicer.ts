/**
 * voicer.ts — 发声节点工厂:带"同时发声数上限"的 tone / noise,节点在 onended 后全部 disconnect。
 * 无外部音频文件;噪声共用一个 1 秒白噪声缓冲。
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
  /** 当前存活的发声数(测试/诊断用) */
  active(pool: Pool): number;
}

export const MAX_VOICES: Record<Pool, number> = { sfx: 24, music: 40 };
const FLOOR = 0.0001;

export function createVoicer(ctx: AudioContext): Voicer {
  const act: Record<Pool, number> = { sfx: 0, music: 0 };

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
    if (act[pool] >= MAX_VOICES[pool]) return;
    act[pool]++;
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
      act[pool]--;
      osc.disconnect();
      filt?.disconnect();
      g.disconnect();
    };
    osc.start(o.t);
    osc.stop(o.t + o.dur + 0.03);
  };

  const noise = (dest: AudioNode, o: NoiseOpts) => {
    const pool = o.pool ?? 'sfx';
    if (act[pool] >= MAX_VOICES[pool]) return;
    act[pool]++;
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
      act[pool]--;
      src.disconnect();
      filt.disconnect();
      g.disconnect();
    };
    src.start(o.t, Math.random() * Math.max(0, 1 - o.dur - 0.05));
    src.stop(o.t + o.dur + 0.03);
  };

  return { tone, noise, bell, active: (p) => act[p] };
}
