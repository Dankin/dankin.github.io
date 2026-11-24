/**
 * sfx.ts — 37 个合成音效(plan/30-audio.md 的 34 项 + bugSquash/orderDone/firework),零音频文件。
 * 统一入口 play(name, {pitch?, vol?, variant?, level?});每个音效 ≤ 数行,走 voicer 的 tone / noise。
 * 总线:sfx(世界音) / ui(界面音) / voice(旁白打字音)。
 */
import type { NoiseOpts, ToneOpts, Voicer } from './voicer.ts';
export { createVoicer } from './voicer.ts';
export type { NoiseOpts, Pool, ToneOpts, Voicer } from './voicer.ts';

export type SfxBus = 'sfx' | 'ui' | 'voice';

export interface PlayOpts {
  /** 音高倍率(1=原调) */
  pitch?: number;
  /** 音量倍率(1=原音量) */
  vol?: number;
  /** 变体序号(appleDrop 等多变体音效;省略=随机) */
  variant?: number;
  /** combo 连击级别 0..8(省略=按 1.2 秒内连发自动累加) */
  level?: number;
}

/** 音效内部可用的工具:时间与音高/音量倍率已折进 tone / noise */
interface X {
  tone(o: Omit<ToneOpts, 't'> & { t?: number }): void;
  noise(o: Omit<NoiseOpts, 't'> & { t?: number }): void;
  bell: PeriodicWave;
  r(): number;
  /** 变体序号 */
  n: number;
  o: PlayOpts;
  pitch: number;
}

interface Def {
  bus: SfxBus;
  /** 同名音效最小间隔(ms) */
  gap: number;
  fn(x: X): void;
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const HP: BiquadFilterType = 'highpass';
const LP: BiquadFilterType = 'lowpass';

/** 摇树/苹果落地等"世界音"(sfx 总线) */
const W = (gap: number, fn: Def['fn']): Def => ({ bus: 'sfx', gap, fn });
/** 界面音(ui 总线) */
const U = (gap: number, fn: Def['fn']): Def => ({ bus: 'ui', gap, fn });
/** 旁白音(voice 总线) */
const V = (gap: number, fn: Def['fn']): Def => ({ bus: 'voice', gap, fn });

/** 五声音阶琶音(MIDI)→ 依次发铃音 */
const run = (x: X, notes: number[], dt: number, vol: number, dur = 0.45) =>
  notes.forEach((m, i) => x.tone({ t: i * dt, f: mtof(m), dur, vol, wave: x.bell, a: 0.004 }));

const DEFS = {
  // ───── 摇树与苹果 ─────
  shake: W(60, (x) => {
    const j = 1 + (x.r() - 0.5) * 0.4;
    x.noise({ dur: 0.22, vol: 0.2, f: 1800 * j, f2: 4200, q: 0.9, a: 0.02 });
    x.noise({ t: 0.09, dur: 0.2, vol: 0.14, f: 4000, f2: 2000 * j, q: 0.9, a: 0.02 });
    x.noise({ dur: 0.3, vol: 0.05, filter: HP, f: 6000, q: 0.5, a: 0.03 });
    x.tone({ f: 196 * (1 + (x.r() - 0.5) * 0.08), f2: 150, dur: 0.1, vol: 0.12, type: 'triangle' });
  }),
  leafRustle: W(80, (x) => {
    x.noise({ dur: 0.38, vol: 0.09, filter: HP, f: 5200, f2: 3000, a: 0.07 });
    x.noise({ dur: 0.3, vol: 0.07, f: 3000 + x.r() * 1500, q: 1.5, a: 0.05 });
    for (let i = 0; i < 3; i++) x.noise({ t: x.r() * 0.28, dur: 0.02, vol: 0.05, f: 5000 + x.r() * 3000, q: 3 });
  }),
  appleSpawn: W(50, (x) => {
    x.tone({ f: 520, f2: 780, dur: 0.12, vol: 0.07, a: 0.01 });
    x.tone({ t: 0.04, f: 1560, dur: 0.16, vol: 0.03, wave: x.bell });
  }),
  // 4 个变体:地面闷响 / 草地软落 / 弹一下 / 熟透软塌
  appleDrop: W(40, (x) => {
    const p = 1 + (x.r() - 0.5) * 0.12;
    if (x.n === 0) {
      x.tone({ f: 180 * p, f2: 80, dur: 0.16, vol: 0.22, a: 0.002 });
      x.noise({ dur: 0.08, vol: 0.1, filter: LP, f: 600, a: 0.001 });
    } else if (x.n === 1) {
      x.noise({ dur: 0.14, vol: 0.12, filter: LP, f: 900, f2: 400, a: 0.004 });
      x.tone({ f: 140 * p, f2: 70, dur: 0.12, vol: 0.12 });
    } else if (x.n === 2) {
      x.tone({ f: 200 * p, f2: 90, dur: 0.12, vol: 0.2, a: 0.002 });
      x.tone({ t: 0.13, f: 240 * p, f2: 120, dur: 0.1, vol: 0.1, a: 0.002 });
      x.noise({ dur: 0.05, vol: 0.07, filter: LP, f: 800 });
    } else {
      x.tone({ f: 260 * p, f2: 90, dur: 0.1, vol: 0.15 });
      x.noise({ dur: 0.1, vol: 0.09, f: 700, q: 3, f2: 350 });
    }
  }),
  bonk: W(60, (x) => {
    x.tone({ f: 320, f2: 110, dur: 0.14, vol: 0.28, a: 0.002 });
    x.noise({ dur: 0.05, vol: 0.14, f: 1400, q: 2, a: 0.001 });
    x.tone({ t: 0.05, f: 520, f2: 150, dur: 0.28, vol: 0.09, type: 'triangle', a: 0.01 });
  }),
  // 苹果飞向篮子:上扫噪声 + 短滑音
  appleFly: W(60, (x) => {
    x.noise({ dur: 0.28, vol: 0.12, f: 400, f2: 3200, q: 1.2, a: 0.03 });
    x.tone({ f: 500, f2: 1400, dur: 0.22, vol: 0.06, a: 0.02 });
  }),
  appleArrive: W(50, (x) => {
    x.tone({ f: 660, dur: 0.1, vol: 0.07, type: 'triangle' });
    x.tone({ t: 0.06, f: 880, dur: 0.22, vol: 0.08, type: 'triangle' });
    x.noise({ dur: 0.02, vol: 0.06, filter: HP, f: 3500 });
  }),
  bite: W(60, (x) => {
    x.noise({ dur: 0.06, vol: 0.2, f: 2200, f2: 1200, q: 1.2, a: 0.001 });
    x.noise({ t: 0.07, dur: 0.07, vol: 0.16, f: 1800, f2: 900, q: 1.2, a: 0.001 });
    x.tone({ f: 260, f2: 140, dur: 0.08, vol: 0.08, type: 'triangle' });
  }),
  coin: W(50, (x) => {
    x.tone({ f: 988 * (1 + (x.r() - 0.5) * 0.02), dur: 0.09, vol: 0.09, type: 'square', lp: 5000 });
    x.tone({ t: 0.07, f: 1319, dur: 0.28, vol: 0.09, type: 'square', lp: 5000 });
    x.tone({ t: 0.07, f: 2637, dur: 0.2, vol: 0.03, wave: x.bell });
  }),

  // ───── 购买与成长 ─────
  buy: U(60, (x) => {
    x.noise({ dur: 0.03, vol: 0.12, filter: HP, f: 3000 });
    x.tone({ f: 659, dur: 0.14, vol: 0.09, type: 'triangle' });
    x.tone({ t: 0.08, f: 880, dur: 0.3, vol: 0.1, type: 'triangle' });
    x.tone({ t: 0.08, f: 1760, dur: 0.2, vol: 0.03, wave: x.bell });
  }),
  buyFail: U(120, (x) => {
    x.tone({ f: 240, f2: 200, dur: 0.12, vol: 0.08, type: 'square', lp: 900 });
    x.tone({ t: 0.13, f: 190, f2: 150, dur: 0.18, vol: 0.08, type: 'square', lp: 900 });
  }),
  // 升档:比 stage 短促的上行小琶音
  upgrade: U(120, (x) => {
    [72, 76, 79, 84].forEach((m, i) => x.tone({ t: i * 0.06, f: mtof(m), dur: i === 3 ? 0.5 : 0.2, vol: 0.09, type: 'triangle', lp: 4500, a: 0.008 }));
    x.noise({ t: 0.15, dur: 0.3, vol: 0.04, filter: HP, f: 7000, a: 0.05 });
  }),
  stage: W(300, (x) => {
    [72, 76, 79, 84].forEach((m, i) => {
      x.tone({ t: i * 0.1, f: mtof(m), dur: i === 3 ? 0.9 : 0.5, vol: 0.09, type: 'triangle', lp: 4000, a: 0.01 });
      x.tone({ t: i * 0.1, f: mtof(m + 12), dur: 0.4, vol: 0.03, wave: x.bell });
    });
  }),
  unlock: U(150, (x) => {
    x.tone({ f: 440, dur: 0.04, vol: 0.06, type: 'square', lp: 2500 });
    run(x, [88, 95], 0.09, 0.08, 0.5);
    x.noise({ t: 0.05, dur: 0.3, vol: 0.04, filter: HP, f: 6500, a: 0.04 });
  }),
  cardHover: U(50, (x) => {
    x.tone({ f: 1400, dur: 0.03, vol: 0.03, a: 0.002 });
    x.noise({ dur: 0.015, vol: 0.03, filter: HP, f: 6000, a: 0.001 });
  }),
  tabSwitch: U(60, (x) => x.tone({ f: 600, f2: 900, dur: 0.06, vol: 0.05, type: 'triangle', a: 0.004 })),

  // ───── 特殊 ─────
  golden: W(120, (x) => {
    run(x, [84, 87, 91, 94, 96, 99], 0.06, 0.1, 0.5);
    x.noise({ t: 0.05, dur: 0.45, vol: 0.05, filter: HP, f: 7000, a: 0.05 });
  }),
  goldenCatch: W(120, (x) => {
    x.tone({ f: 120, f2: 70, dur: 0.15, vol: 0.14, a: 0.002 });
    run(x, [79, 84, 88, 91], 0.05, 0.1, 0.4);
    x.tone({ t: 0.2, f: mtof(96), dur: 0.7, vol: 0.07, wave: x.bell });
    x.noise({ t: 0.05, dur: 0.4, vol: 0.05, filter: HP, f: 7500, a: 0.05 });
  }),
  // 连击:音高随级别升半音,封顶 8 级(level 由 play 注入 x.o.level)
  combo: W(30, (x) => {
    const p = Math.pow(2, Math.min(8, Math.max(0, x.o.level ?? 0)) / 12);
    x.tone({ f: 784 * p, dur: 0.1, vol: 0.08, type: 'triangle', a: 0.003 });
    x.tone({ f: 1568 * p, dur: 0.14, vol: 0.03, wave: x.bell });
  }),
  rareApple: W(150, (x) => {
    run(x, [76, 83, 88], 0.12, 0.08, 0.7);
    x.tone({ f: 220, dur: 0.6, vol: 0.05, a: 0.1 });
    x.noise({ t: 0.1, dur: 0.5, vol: 0.03, filter: HP, f: 8000, a: 0.15 });
  }),
  spoil: W(100, (x) => {
    x.tone({ f: 300, f2: 120, dur: 0.35, vol: 0.08, type: 'sawtooth', lp: 500, a: 0.01 });
    x.noise({ dur: 0.22, vol: 0.08, f: 300, f2: 150, q: 4 });
  }),

  // ───── 彩蛋、新闻、旁白 ─────
  egg: U(100, (x) => {
    x.tone({ f: mtof(91), dur: 0.45, vol: 0.1, wave: x.bell, a: 0.003 });
    x.tone({ t: 0.08, f: mtof(98), dur: 0.35, vol: 0.06, wave: x.bell, a: 0.003 });
  }),
  eggAch: U(200, (x) => {
    run(x, [79, 83, 86, 91], 0.09, 0.09, 0.5);
    [67, 71, 74].forEach((m) => x.tone({ t: 0.36, f: mtof(m), dur: 0.8, vol: 0.05, type: 'triangle', lp: 3000, a: 0.02 }));
  }),
  newsTick: U(60, (x) => {
    x.tone({ f: 1800, dur: 0.02, vol: 0.035, a: 0.001 });
    x.noise({ dur: 0.01, vol: 0.03, filter: HP, f: 5000, a: 0.001 });
  }),
  newsBreaking: U(400, (x) => {
    [0, 0.22].forEach((t) => {
      x.tone({ t, f: 880, dur: 0.12, vol: 0.07, type: 'triangle', lp: 3000 });
      x.tone({ t: t + 0.1, f: 1175, dur: 0.16, vol: 0.07, type: 'triangle', lp: 3000 });
    });
  }),
  // 旁白打字机:每字一声,音高在 3 个值中随机
  narrBlip: V(25, (x) => {
    x.tone({ f: [1500, 1850, 2200][Math.floor(x.r() * 3)], dur: 0.018, vol: 0.028, type: 'square', lp: 4000, a: 0.001 });
    x.noise({ dur: 0.01, vol: 0.02, filter: HP, f: 4000, a: 0.001 });
  }),
  narrOpen: V(200, (x) => {
    x.noise({ dur: 0.12, vol: 0.05, f: 2500, q: 1, a: 0.02 });
    x.tone({ f: 523, dur: 0.2, vol: 0.05, a: 0.02 });
    x.tone({ t: 0.08, f: 659, dur: 0.22, vol: 0.05, a: 0.02 });
  }),
  narrClose: V(200, (x) => {
    x.tone({ f: 659, dur: 0.14, vol: 0.045, a: 0.01 });
    x.tone({ t: 0.08, f: 523, dur: 0.25, vol: 0.045, a: 0.01 });
  }),

  // ───── 系统 ─────
  toggleOn: U(80, (x) => {
    x.tone({ f: 600, f2: 900, dur: 0.08, vol: 0.07, type: 'triangle' });
    x.tone({ t: 0.06, f: 1200, dur: 0.1, vol: 0.05, type: 'triangle' });
  }),
  toggleOff: U(80, (x) => {
    x.tone({ f: 900, f2: 600, dur: 0.08, vol: 0.07, type: 'triangle' });
    x.tone({ t: 0.06, f: 450, dur: 0.1, vol: 0.05, type: 'triangle' });
  }),
  modal: U(120, (x) => {
    x.tone({ f: 300, f2: 450, dur: 0.1, vol: 0.06, a: 0.01 });
    x.noise({ dur: 0.12, vol: 0.05, filter: LP, f: 1200, f2: 3000, a: 0.03 });
  }),
  sleep: W(300, (x) => [72, 67, 62].forEach((m, i) => x.tone({ t: i * 0.28, f: mtof(m), dur: 0.7, vol: 0.09, a: 0.04, lp: 2000 }))),
  fanfare: W(500, (x) => {
    const seq: Array<[number, number, number]> = [[72, 0, 0.13], [72, 0.16, 0.13], [72, 0.32, 0.13], [76, 0.48, 0.24], [79, 0.76, 0.7]];
    seq.forEach(([m, t, d]) => {
      x.tone({ t, f: mtof(m), dur: d, vol: 0.1, type: 'sawtooth', lp: 2200, a: 0.015, r: d * 0.5 });
      x.tone({ t, f: mtof(m + 12), dur: d, vol: 0.035, type: 'square', lp: 3000, a: 0.015, r: d * 0.5 });
    });
    x.tone({ t: 0.76, f: mtof(84), dur: 0.9, vol: 0.05, wave: x.bell });
  }),
  // 礼物开盒:丝带沙沙 + 啵 + 上行魔法琶音 + 长尾和弦
  giftOpen: U(500, (x) => {
    x.noise({ dur: 0.18, vol: 0.08, f: 3500, f2: 1500, a: 0.04 });
    x.noise({ t: 0.2, dur: 0.06, vol: 0.15, f: 1200, q: 1.5, a: 0.001 });
    x.tone({ t: 0.2, f: 200, f2: 420, dur: 0.1, vol: 0.12 });
    run(x, [79, 83, 86, 91, 95, 98], 0.08, 0.09, 0.6);
    [67, 71, 74].forEach((m) => x.tone({ t: 0.7, f: mtof(m), dur: 1.1, vol: 0.05, type: 'triangle', lp: 2800, a: 0.04 }));
  }),

  // ───── 玩法补充 ─────
  // 虫子被拍:啪 + 细小吱叫
  bugSquash: W(60, (x) => {
    x.noise({ dur: 0.05, vol: 0.2, f: 900, q: 1.5, a: 0.001 });
    x.tone({ f: 240, f2: 60, dur: 0.08, vol: 0.15, a: 0.001 });
    x.tone({ t: 0.02, f: 2200, f2: 900, dur: 0.07, vol: 0.04, a: 0.002 });
  }),
  // 订单完成:收银"叮铃"
  orderDone: U(200, (x) => {
    x.noise({ dur: 0.03, vol: 0.1, filter: HP, f: 3500 });
    x.tone({ f: 988, dur: 0.09, vol: 0.08, type: 'triangle' });
    x.tone({ t: 0.08, f: 1319, dur: 0.12, vol: 0.08, type: 'triangle' });
    x.tone({ t: 0.18, f: 1760, dur: 0.4, vol: 0.09, type: 'triangle' });
    x.tone({ t: 0.18, f: 3520, dur: 0.3, vol: 0.03, wave: x.bell });
  }),
  // 烟花:上升哨声 → 爆裂 + 噼啪
  firework: W(150, (x) => {
    x.tone({ f: 400, f2: 1800, dur: 0.35, vol: 0.045, a: 0.02 });
    x.noise({ t: 0.35, dur: 0.28, vol: 0.2, f: 3000, f2: 800, q: 0.6, a: 0.002 });
    x.tone({ t: 0.35, f: 110, f2: 40, dur: 0.22, vol: 0.2, a: 0.002 });
    for (let i = 0; i < 5; i++) x.noise({ t: 0.42 + x.r() * 0.4, dur: 0.02, vol: 0.06, filter: HP, f: 6000 + x.r() * 2000, a: 0.001 });
  }),
} satisfies Record<string, Def>;

export type SfxName = keyof typeof DEFS;
export const SFX_NAMES = Object.keys(DEFS) as SfxName[];

/** 同义别名(业务侧可用口语名) */
export const SFX_ALIAS: Record<string, SfxName> = {
  buyCard: 'buy',
  tierUp: 'upgrade',
  goldenApple: 'golden',
  easterEgg: 'egg',
  newsBreak: 'newsBreaking',
  typewriter: 'narrBlip',
  gift: 'giftOpen',
  fireworks: 'firework',
  bug: 'bugSquash',
  order: 'orderDone',
};

export const sfxBus = (n: SfxName): SfxBus => DEFS[n].bus;
export const sfxGap = (n: SfxName): number => DEFS[n].gap;
export const resolveSfx = (n: string): SfxName | null => (n in DEFS ? (n as SfxName) : (SFX_ALIAS[n] ?? null));

/** 变体数(appleDrop=4,其余 1) */
const VARIANTS: Partial<Record<SfxName, number>> = { appleDrop: 4 };

/** 执行一个音效:把 t/pitch/vol 折进 voicer。返回 void;开关/节流由上层处理 */
export function runSfx(v: Voicer, dest: AudioNode, name: SfxName, t0: number, o: PlayOpts, rnd: () => number): void {
  const pitch = o.pitch !== undefined && o.pitch > 0 ? o.pitch : 1;
  const vol = o.vol !== undefined && o.vol >= 0 ? o.vol : 1;
  const nv = VARIANTS[name] ?? 1;
  const n = o.variant !== undefined ? ((Math.floor(o.variant) % nv) + nv) % nv : Math.floor(rnd() * nv);
  const x: X = {
    tone: (p) => v.tone(dest, { ...p, t: t0 + (p.t ?? 0), f: p.f * pitch, f2: p.f2 === undefined ? undefined : p.f2 * pitch, vol: p.vol * vol }),
    noise: (p) => v.noise(dest, { ...p, t: t0 + (p.t ?? 0), f: p.f === undefined ? undefined : p.f * pitch, f2: p.f2 === undefined ? undefined : p.f2 * pitch, vol: p.vol * vol }),
    bell: v.bell,
    r: rnd,
    n,
    o,
    pitch,
  };
  DEFS[name].fn(x);
}
