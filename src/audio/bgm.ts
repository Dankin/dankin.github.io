/**
 * bgm.ts — 《Shake the Apple》音频入口:WebAudio 合成 BGM + 音效,无外部音频文件。
 *
 * 【旋律来源说明】东方同人二创(致敬《Bad Apple!!》,ZUN 官方准许非商业免费二创,页面需标注"东方二创")。
 * 作者无法逐音核对原曲乐谱,所以这里的 8 小节旋律是"听感相近的原创同风格短旋律":
 * 降E小调(E♭ minor),以 B♭4 为主音级的下行/级进小调乐句,气质接近原曲副歌,
 * 但音高、节奏不保证与原曲一致,不应被当作原曲转录。
 * 和弦进行(原创): E♭m | C♭ | G♭ | D♭ | E♭m | C♭ | A♭m | B♭m,BPM 112,8 分音符为最小步进,共 64 步循环。
 *
 * 强度分层 setIntensity(0..5):
 *   0 八音盒主旋律  1 + 轻琶音  2 + 柔和 pad  3 + 低音  4 + 底鼓/踩镲  5 + 军鼓拍手 + 高八度旋律叠加
 *
 * 调度: setInterval 25ms,提前 0.1s 向 AudioContext 时钟排程;音乐和音效各有发声数上限(见 sfx.ts)。
 */
import { createSfx, createVoicer, type SfxSet, type Voicer } from './sfx.ts';

export interface GameAudio {
  unlock(): void;
  setMusic(on: boolean): void;
  setSfx(on: boolean): void;
  setVolume(v: number): void;
  isMusicOn(): boolean;
  setIntensity(n: number): void;
  sfx: SfxSet;
}

const BPM = 112;
const STEP = 60 / BPM / 2; // 8 分音符
const STEPS_PER_BAR = 8;
const BARS = 8;
const LOOP_STEPS = STEPS_PER_BAR * BARS;
const LOOKAHEAD = 0.1;
const TICK_MS = 25;

// MIDI: Eb4=63 F4=65 Gb4=66 Ab4=68 Bb4=70 Cb5=71 Db5=73 Eb5=75
// 每小节 8 格;正数=音高,0=休止,-1=延音
const MELODY: number[][] = [
  [70, -1, 70, 68, 66, -1, 68, 70],
  [71, -1, 70, 68, 66, -1, 63, -1],
  [66, 68, 70, -1, 73, -1, 70, -1],
  [68, -1, 68, 66, 65, -1, 66, 68],
  [70, -1, 70, 68, 66, -1, 68, 70],
  [71, -1, 73, -1, 75, -1, 73, 71],
  [70, -1, 68, -1, 66, -1, 65, -1],
  [65, 66, 68, -1, 70, -1, -1, -1],
];

interface Chord {
  root: number;
  tones: number[];
}
const CHORDS: Chord[] = [
  { root: 39, tones: [63, 66, 70] }, // Ebm
  { root: 35, tones: [59, 63, 66] }, // Cb
  { root: 42, tones: [58, 61, 66] }, // Gb
  { root: 37, tones: [61, 65, 68] }, // Db
  { root: 39, tones: [63, 66, 70] }, // Ebm
  { root: 35, tones: [59, 63, 66] }, // Cb
  { root: 44, tones: [56, 59, 63] }, // Abm
  { root: 46, tones: [58, 61, 65] }, // Bbm
];

// 预计算旋律事件: step -> {midi, len}
const MELODY_AT = new Map<number, { midi: number; len: number }>();
MELODY.forEach((bar, b) => {
  bar.forEach((n, s) => {
    if (n <= 0) return;
    let len = 1;
    while (s + len < STEPS_PER_BAR && bar[s + len] === -1) len++;
    MELODY_AT.set(b * STEPS_PER_BAR + s, { midi: n, len });
  });
});

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const ARP = [0, 1, 2, 1, 0, 1, 2, 1];

type AudioCtor = typeof AudioContext;

export function createAudio(): GameAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let sfxBus: GainNode | null = null;
  let voicer: Voicer | null = null;
  let sfxImpl: SfxSet | null = null;

  let volume = 0.5;
  let musicWanted = false;
  let sfxOn = true;
  let intensity = 0;

  let musicBus: GainNode | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let nextTime = 0;
  let step = 0;

  // ---------- 音乐调度 ----------
  const scheduleStep = (idx: number, t: number) => {
    if (!voicer || !musicBus) return;
    const v = voicer;
    const bus = musicBus;
    const bar = Math.floor(idx / STEPS_PER_BAR);
    const s = idx % STEPS_PER_BAR;
    const chord = CHORDS[bar];

    // 主旋律: 八音盒(始终有)
    const m = MELODY_AT.get(idx);
    if (m) {
      v.tone(bus, { t, f: mtof(m.midi), dur: Math.max(0.5, m.len * STEP * 1.8), vol: 0.15, wave: v.bell, a: 0.003, pool: 'music' });
      if (intensity >= 5) {
        v.tone(bus, { t, f: mtof(m.midi + 12), dur: 0.5, vol: 0.05, wave: v.bell, a: 0.003, pool: 'music' });
      }
    }
    // 1: 轻琶音
    if (intensity >= 1) {
      const n = chord.tones[ARP[s]] - 12;
      v.tone(bus, { t, f: mtof(n), dur: 0.35, vol: 0.06, type: 'triangle', lp: 1800, a: 0.004, pool: 'music' });
    }
    // 2: pad(每小节一次,两个失谐锯齿通过低通)
    if (intensity >= 2 && s === 0) {
      const d = STEP * STEPS_PER_BAR + 0.4;
      for (const n of chord.tones) {
        for (const det of [-7, 7]) {
          v.tone(bus, { t, f: mtof(n - 12), dur: d, vol: 0.022, type: 'sawtooth', lp: 900, a: 0.5, r: 0.9, detune: det, pool: 'music' });
        }
      }
    }
    // 3: 低音(拍 1、3、和 4 拍后半)
    if (intensity >= 3 && (s === 0 || s === 4 || s === 7)) {
      const dur = s === 7 ? 0.2 : 0.55;
      v.tone(bus, { t, f: mtof(chord.root + (s === 7 ? 12 : 0)), dur, vol: s === 7 ? 0.1 : 0.2, type: 'triangle', lp: 700, a: 0.01, pool: 'music' });
    }
    // 4: 底鼓 + 踩镲
    if (intensity >= 4) {
      if (s === 0 || s === 4) {
        v.tone(bus, { t, f: 130, f2: 45, dur: 0.22, vol: 0.28, type: 'sine', a: 0.002, pool: 'music' });
      }
      if (s % 2 === 1 || intensity >= 5) {
        v.noise(bus, { t, dur: s % 2 === 1 ? 0.04 : 0.025, vol: s % 2 === 1 ? 0.05 : 0.025, filter: 'highpass', f: 7500, a: 0.001, pool: 'music' });
      }
    }
    // 5: 军鼓/拍手 (拍 2、4)
    if (intensity >= 5 && (s === 2 || s === 6)) {
      v.noise(bus, { t, dur: 0.14, vol: 0.12, filter: 'bandpass', f: 1800, q: 0.7, a: 0.001, pool: 'music' });
      v.tone(bus, { t, f: 220, f2: 150, dur: 0.08, vol: 0.06, type: 'triangle', a: 0.001, pool: 'music' });
    }
  };

  const tick = () => {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (nextTime < now - 0.05) nextTime = now + 0.03; // 长时间停顿后重新对齐,避免补播
    while (nextTime < now + LOOKAHEAD) {
      scheduleStep(step, nextTime);
      nextTime += STEP;
      step = (step + 1) % LOOP_STEPS;
    }
  };

  const startMusic = () => {
    if (!ctx || !master || timer !== null) return;
    musicBus = ctx.createGain();
    musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.4);
    musicBus.connect(master);
    nextTime = ctx.currentTime + 0.08;
    step = 0;
    timer = setInterval(tick, TICK_MS);
  };

  const stopMusic = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    if (ctx && musicBus) {
      const old = musicBus;
      musicBus = null;
      const t = ctx.currentTime;
      old.gain.cancelScheduledValues(t);
      old.gain.setValueAtTime(old.gain.value, t);
      old.gain.linearRampToValueAtTime(0.0001, t + 0.15);
      // 渐隐后断开整条总线,尚在发声的长音(pad 等)随之静音
      setTimeout(() => old.disconnect(), 300);
    }
  };

  // ---------- 创建 / 解锁 ----------
  const build = () => {
    const Ctor: AudioCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 24;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    master.connect(comp);
    comp.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 1;
    sfxBus.connect(master);
    voicer = createVoicer(ctx);
    sfxImpl = createSfx(ctx, voicer, sfxBus);
  };

  const unlock = () => {
    if (!ctx) {
      build();
      if (ctx) {
        // iOS Safari: 在手势内播放一个静音缓冲,彻底解除静音限制
        const c = ctx as AudioContext;
        const b = c.createBuffer(1, 1, c.sampleRate);
        const s = c.createBufferSource();
        s.buffer = b;
        s.connect(c.destination);
        s.start(0);
      }
    }
    if (!ctx) return;
    if (ctx.state !== 'running') {
      void ctx.resume().then(() => {
        if (musicWanted) startMusic();
      }).catch(() => {});
    }
    if (musicWanted) startMusic();
  };

  // 页面隐藏时挂起,回到前台恢复(受 iOS 后台策略影响)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) {
        void ctx.suspend().catch(() => {});
      } else {
        void ctx.resume().catch(() => {});
      }
    });
  }

  // ---------- 音效包装: 开关 + 同类音效最小间隔 ----------
  const lastAt: Record<string, number> = {};
  const wrap = (k: keyof SfxSet, minGapMs: number) => () => {
    if (!sfxOn || !sfxImpl || !ctx || ctx.state !== 'running') return;
    const t = performance.now();
    if (t - (lastAt[k] ?? -1e9) < minGapMs) return;
    lastAt[k] = t;
    sfxImpl[k]();
  };
  const sfx: SfxSet = {
    shake: wrap('shake', 60),
    coin: wrap('coin', 50),
    golden: wrap('golden', 120),
    buy: wrap('buy', 60),
    stage: wrap('stage', 300),
    bonk: wrap('bonk', 60),
    bite: wrap('bite', 60),
    sleep: wrap('sleep', 300),
    fanfare: wrap('fanfare', 500),
  };

  return {
    unlock,
    setMusic(on: boolean) {
      musicWanted = on;
      if (on) {
        if (ctx && ctx.state === 'running') startMusic();
        // 未解锁/被挂起: 等 unlock() 或 resume 回调再启动,不自动播放
      } else {
        stopMusic();
      }
    },
    setSfx(on: boolean) {
      sfxOn = on;
    },
    setVolume(v: number) {
      volume = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
      if (ctx && master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
    },
    isMusicOn() {
      return musicWanted;
    },
    setIntensity(n: number) {
      intensity = Math.min(5, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));
    },
    sfx,
  };
}
