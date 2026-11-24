/**
 * mixer.ts — 总线图与音量曲线。
 *
 *   bgm 链: musicIn → musicLP(昼夜低通) → duck → bgmGain ─┐
 *                      └→ delaySend → delay ⟲ → duck       │
 *   sfx / ui / voice 三条增益 ──────────────────────────────┼→ master → 压缩器(限幅) → destination
 *
 * 层级目标(峰值 dBFS,plan/30-audio.md §2):music -20 / world SFX -14 / UI -12 / 旁白 -10。
 * 合成音本身约 -14 dBFS,所以各层用固定 trim 对齐:bgm 0.5、sfx 1、ui 1.26、voice 1.6;
 * 用户音量 v∈[0,1] 走 v² 的听感曲线。
 */

export type Layer = 'master' | 'bgm' | 'sfx' | 'ui' | 'voice';
export const LAYERS: readonly Layer[] = ['master', 'bgm', 'sfx', 'ui', 'voice'];

export const TRIM: Record<Layer, number> = { master: 1, bgm: 0.5, sfx: 1, ui: 1.26, voice: 1.6 };
/** ducking:BGM 降到 40%,起音 0.15s、释放 0.6s(达到约 95% 所需时间) */
export const DUCK = { level: 0.4, attack: 0.15, release: 0.6 };

export const gainOf = (layer: Layer, v: number): number => v * v * TRIM[layer];

export interface Mixer {
  musicIn: GainNode;
  musicLP: BiquadFilterNode;
  delaySend: GainNode;
  buses: { sfx: GainNode; ui: GainNode; voice: GainNode };
  setVolume(layer: Layer, v: number): void;
  /** 平滑切换 ducking(on=降到 DUCK.level) */
  setDuck(on: boolean): void;
}

export function createMixer(ctx: AudioContext, vol: Record<Layer, number>): Mixer {
  const g = (v: number) => {
    const n = ctx.createGain();
    n.gain.value = v;
    return n;
  };
  const master = g(gainOf('master', vol.master));
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 24;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  master.connect(comp);
  comp.connect(ctx.destination);

  const bgm = g(gainOf('bgm', vol.bgm));
  const duck = g(1);
  const musicIn = g(1);
  const musicLP = ctx.createBiquadFilter();
  musicLP.type = 'lowpass';
  musicLP.frequency.value = 14000;
  musicLP.Q.value = 0.5;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.3;
  const fb = g(0.32);
  const delaySend = g(0.08);
  musicIn.connect(musicLP);
  musicLP.connect(duck);
  musicLP.connect(delaySend);
  delaySend.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(duck);
  duck.connect(bgm);
  bgm.connect(master);

  const buses = { sfx: g(gainOf('sfx', vol.sfx)), ui: g(gainOf('ui', vol.ui)), voice: g(gainOf('voice', vol.voice)) };
  buses.sfx.connect(master);
  buses.ui.connect(master);
  buses.voice.connect(master);

  const nodes: Record<Layer, GainNode> = { master, bgm, ...buses };
  return {
    musicIn,
    musicLP,
    delaySend,
    buses,
    setVolume(layer, v) {
      nodes[layer].gain.setTargetAtTime(gainOf(layer, v), ctx.currentTime, 0.02);
    },
    setDuck(on) {
      // setTargetAtTime 约 3τ 达到 95%
      duck.gain.setTargetAtTime(on ? DUCK.level : 1, ctx.currentTime, (on ? DUCK.attack : DUCK.release) / 3);
    },
  };
}
