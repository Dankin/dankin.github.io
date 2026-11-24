/**
 * bgm.ts — 音频入口 createAudio():WebAudio 全合成 BGM + 音效,无任何外部音频文件。
 *
 * 模块:voicer(发声原语)· sfx(37 个音效)· music(6 个时代 BGM)· mixer(总线/ducking)
 *       · settings(三开关+音量+持久化)· ios(静音键/audioSession)。详见 README.md。
 * 旧 API(unlock/isRunning/setMusic/setSfx/setVolume(v)/isMusicOn/setIntensity/sfx.shake() 等)全部保留。
 */
import { SILENT_HINT, TAP_HINT, isIOS, setPlaybackSession, startSilentLoop, type NavLike } from './ios.ts';
import { createMixer, type Layer, type Mixer } from './mixer.ts';
import { createMusic, type Music, type World } from './music.ts';
import { loadSettings, saveSettings, type AudioSettings } from './settings.ts';
import { SFX_NAMES, createVoicer, resolveSfx, runSfx, sfxBus, sfxGap, type PlayOpts, type SfxName, type Voicer } from './sfx.ts';

export type { Layer } from './mixer.ts';
export type { World, Weather } from './music.ts';
export type { PlayOpts, SfxName } from './sfx.ts';
export type { AudioSettings } from './settings.ts';
export { SFX_NAMES } from './sfx.ts';

/** 旧接口:无参音效快捷方法 */
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

export interface SfxApi extends SfxSet {
  /** 播放音效(名字或别名)。返回是否真的发声(开关关/未解锁/节流/未知名字 → false) */
  play(name: SfxName | (string & {}), o?: PlayOpts): boolean;
  /** 所有音效名 */
  readonly names: readonly SfxName[];
}

export type Switch = 'music' | 'sfx' | 'voice';
export type DuckReason = 'narration' | 'golden' | 'ending';

export interface GameAudio {
  /** 在用户手势内调用:创建/恢复 AudioContext。幂等 */
  unlock(): void;
  isRunning(): boolean;
  setMusic(on: boolean): void;
  setSfx(on: boolean): void;
  /** 旁白打字音开关 */
  setVoice(on: boolean): void;
  setSwitch(k: Switch, on: boolean): void;
  isMusicOn(): boolean;
  isSfxOn(): boolean;
  isVoiceOn(): boolean;
  /** 无参=音乐(BGM)是否开启;传入 'sfx'/'voice'/'any' 查其它 */
  isEnabled(k?: Switch | 'any'): boolean;
  /** setVolume(v) 旧用法=总音量;setVolume('bgm'|'sfx'|'ui'|'voice'|'master', v)。'music' 是 'bgm' 的别名 */
  setVolume(layer: Layer | 'music' | number, v?: number): void;
  getVolume(layer?: Layer | 'music'): number;
  setIntensity(n: number): void;
  /** 时代 0..5(在下一小节线上 2 秒交叉淡入淡出) */
  setEra(n: number): void;
  /** 昼夜/季节/天气 */
  setWorld(w: Partial<World>): void;
  /** BGM ducking:任一原因为 on 时降到 40%。旁白 narrOpen/narrClose、金苹果、fanfare 会自动触发 */
  duck(reason: DuckReason, on: boolean): void;
  /** 静音键提示:iOS 且未取得 playback 会话、音频已开启时返回文案,否则 null */
  silentSwitchHint(): string | null;
  /** 当前需要给用户看的提示('点一下恢复声音' / null);变化时回调 */
  hint(): string | null;
  onHint(cb: (msg: string | null) => void): () => void;
  /** 无障碍:减少动态 → 关闭 narrBlip 与 combo 升调。默认跟随 prefers-reduced-motion */
  setReducedMotion(on: boolean): void;
  settings(): AudioSettings;
  /** 调试/测试用 */
  debug(): { ctx: string; music: ReturnType<Music['state']> | null; ducks: DuckReason[]; hint: string | null; voices: { sfx: number; music: number } };
  sfx: SfxApi;
}

type AudioCtor = new (o?: AudioContextOptions) => AudioContext;
type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** 依赖注入(测试用);全部可省略 */
export interface AudioDeps {
  ctor?: AudioCtor;
  storage?: Store | null;
  nav?: NavLike;
  doc?: Document;
  now?: () => number;
  rnd?: () => number;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (id: unknown) => void;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  reducedMotion?: boolean;
  /** 默认 true:自动在 document 上挂多事件解锁监听 */
  autoUnlock?: boolean;
}

const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'keydown'] as const;
const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export function createAudio(deps: AudioDeps = {}): GameAudio {
  const g = globalThis as unknown as Record<string, any>;
  const Ctor: AudioCtor | undefined = deps.ctor ?? g.AudioContext ?? g.webkitAudioContext;
  const doc: Document | undefined = deps.doc ?? g.document;
  const nav: NavLike | undefined = deps.nav ?? g.navigator;
  let store: Store | null = null;
  try {
    store = deps.storage !== undefined ? deps.storage : (g.localStorage ?? null);
  } catch {
    store = null; // 隐私模式访问 localStorage 会抛
  }
  const now = deps.now ?? (() => (g.performance?.now ? g.performance.now() : Date.now()));
  const rnd = deps.rnd ?? Math.random;
  const si = deps.setInterval ?? ((fn, ms) => setInterval(fn, ms));
  const ci = deps.clearInterval ?? ((id) => clearInterval(id as ReturnType<typeof setInterval>));
  const st = deps.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));

  const S: AudioSettings = loadSettings(store);
  const persist = () => saveSettings(store, S);

  let ctx: AudioContext | null = null;
  let mixer: Mixer | null = null;
  let voicer: Voicer | null = null;
  let music: Music | null = null;
  let silentEl: HTMLAudioElement | null = null;
  let playback = false;
  let wasRunning = false;
  let hintMsg: string | null = null;
  const hintCbs = new Set<(m: string | null) => void>();
  const ducks = new Set<DuckReason>();
  const duckTimers = new Map<DuckReason, unknown>();
  const lastAt = new Map<string, number>();
  let reduced = deps.reducedMotion ?? false;
  if (deps.reducedMotion === undefined) {
    try {
      reduced = !!g.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    } catch {
      /* 无 matchMedia */
    }
  }
  // 在 build 之前收到的音乐参数,建好后回放
  let era = 0;
  let intensity = 0;
  const world: Partial<World> = {};

  const running = () => !!ctx && ctx.state === 'running';
  const hidden = () => !!doc && doc.hidden === true;

  const setHint = (m: string | null) => {
    if (m === hintMsg) return;
    hintMsg = m;
    hintCbs.forEach((cb) => cb(m));
  };

  const syncMusic = () => {
    if (!music) return;
    if (S.music && running() && !hidden()) music.start();
    else if (!S.music) music.stop();
    else music.pause(); // 要开但暂不可播(挂起/后台):只停定时器,保留位置
  };

  const applyDuck = () => mixer?.setDuck(ducks.size > 0);

  const onState = () => {
    if (!ctx) return;
    const s = ctx.state as string;
    if (s === 'running') {
      wasRunning = true;
      setHint(null);
      syncMusic();
    } else if (wasRunning && !hidden()) {
      // iOS 来电/Siri/切应用后会进入 'interrupted'(或被系统挂起):等一次手势再恢复
      setHint(TAP_HINT);
      music?.pause();
      void ctx.resume?.().catch(() => {});
    }
  };

  const build = () => {
    if (ctx || !Ctor) return;
    try {
      ctx = new Ctor();
    } catch {
      ctx = null;
      return;
    }
    mixer = createMixer(ctx, S.vol);
    voicer = createVoicer(ctx);
    music = createMusic({
      ctx,
      v: voicer,
      out: mixer.musicIn,
      lp: mixer.musicLP,
      delaySend: mixer.delaySend,
      setInterval: si,
      clearInterval: ci,
      setTimeout: st,
      rnd,
    });
    music.setEra(era);
    music.setIntensity(intensity);
    music.setWorld(world);
    ctx.onstatechange = onState;
    applyDuck();
  };

  const unlock = () => {
    if (!ctx) {
      build();
      const c = ctx as AudioContext | null; // build() 在闭包里赋值,避免 TS 窄化成 never
      if (!c) return;
      playback = setPlaybackSession(nav);
      if (!playback && isIOS(nav) && !silentEl) silentEl = startSilentLoop(doc);
      try {
        // iOS:手势内播放一个静音缓冲,彻底解除静音限制
        const s = c.createBufferSource();
        s.buffer = c.createBuffer(1, 1, c.sampleRate);
        s.connect(c.destination);
        s.start(0);
      } catch {
        /* 忽略 */
      }
    }
    const c2 = ctx as AudioContext | null;
    if (!c2) return;
    if (c2.state !== 'running') {
      void Promise.resolve(c2.resume())
        .then(() => onState())
        .catch(() => {});
    } else onState();
    syncMusic();
  };

  const armUnlock = () => {
    if (!doc || deps.autoUnlock === false) return;
    const h = () => {
      if (!running()) unlock();
    };
    for (const e of UNLOCK_EVENTS) doc.addEventListener(e, h, { capture: true, passive: true });
    doc.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (doc.hidden) {
        music?.pause(); // 清 BGM 定时器
        void Promise.resolve(ctx.suspend?.()).catch(() => {});
      } else {
        void Promise.resolve(ctx.resume?.())
          .then(() => onState())
          .catch(() => {});
        syncMusic();
      }
    });
  };
  armUnlock();

  // ───── 音效 ─────
  const play = (name: string, o: PlayOpts = {}): boolean => {
    const n = resolveSfx(name);
    if (!n) return false;
    const bus = sfxBus(n);
    if (bus === 'voice' ? !S.voice : !S.sfx) return false;
    if (!ctx || !mixer || !voicer || !running()) return false;
    if (reduced && n === 'narrBlip') return false;
    const t = now();
    if (t - (lastAt.get(n) ?? -1e9) < sfxGap(n)) return false;
    lastAt.set(n, t);
    const opts = reduced && n === 'combo' ? { ...o, level: 0 } : o;
    runSfx(voicer, mixer.buses[bus], n, ctx.currentTime + 0.005, opts, rnd);
    if (n === 'narrOpen') duck('narration', true);
    else if (n === 'narrClose') duck('narration', false);
    else if (n === 'golden' || n === 'goldenCatch') duckFor('golden', 1600);
    else if (n === 'fanfare') duckFor('ending', 3000);
    return true;
  };

  function duck(reason: DuckReason, on: boolean) {
    const tm = duckTimers.get(reason);
    if (tm !== undefined) {
      duckTimers.delete(reason);
    }
    if (on) ducks.add(reason);
    else ducks.delete(reason);
    applyDuck();
  }
  function duckFor(reason: DuckReason, ms: number) {
    duck(reason, true);
    const token = {};
    duckTimers.set(reason, token);
    st(() => {
      if (duckTimers.get(reason) === token) duck(reason, false);
    }, ms);
  }

  const sfx: SfxApi = {
    play,
    names: SFX_NAMES,
    shake: () => void play('shake'),
    coin: () => void play('coin'),
    golden: () => void play('golden'),
    buy: () => void play('buy'),
    stage: () => void play('stage'),
    bonk: () => void play('bonk'),
    bite: () => void play('bite'),
    sleep: () => void play('sleep'),
    fanfare: () => void play('fanfare'),
  };

  const toLayer = (l: Layer | 'music'): Layer => (l === 'music' ? 'bgm' : l);
  const setSwitch = (k: Switch, on: boolean) => {
    S[k] = !!on;
    persist();
    if (k === 'music') syncMusic();
    if (k === 'voice' && !on) duck('narration', false);
  };

  return {
    unlock,
    isRunning: running,
    setMusic: (on) => setSwitch('music', on),
    setSfx: (on) => setSwitch('sfx', on),
    setVoice: (on) => setSwitch('voice', on),
    setSwitch,
    isMusicOn: () => S.music,
    isSfxOn: () => S.sfx,
    isVoiceOn: () => S.voice,
    isEnabled: (k = 'music') => (k === 'any' ? S.music || S.sfx || S.voice : S[k]),
    setVolume(layer, v) {
      let l: Layer = 'master';
      let val: number;
      if (typeof layer === 'number') val = layer;
      else {
        l = toLayer(layer);
        val = v ?? 0;
      }
      if (typeof layer !== 'number' && !hasOwn(S.vol, l)) return;
      S.vol[l] = clamp01(val);
      mixer?.setVolume(l, S.vol[l]);
      persist();
    },
    getVolume: (l = 'master') => S.vol[toLayer(l)] ?? 0,
    setIntensity(n) {
      intensity = Math.min(5, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));
      music?.setIntensity(intensity);
    },
    setEra(n) {
      era = Math.min(5, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));
      music?.setEra(era);
    },
    setWorld(w) {
      Object.assign(world, w);
      music?.setWorld(w);
    },
    duck,
    silentSwitchHint: () => (isIOS(nav) && !playback && (S.music || S.sfx || S.voice) ? SILENT_HINT : null),
    hint: () => hintMsg,
    onHint(cb) {
      hintCbs.add(cb);
      return () => void hintCbs.delete(cb);
    },
    setReducedMotion: (on) => void (reduced = !!on),
    settings: () => ({ ...S, vol: { ...S.vol } }),
    debug: () => ({
      ctx: ctx ? String(ctx.state) : 'none',
      music: music ? music.state() : null,
      ducks: [...ducks],
      hint: hintMsg,
      voices: { sfx: voicer?.active('sfx') ?? 0, music: voicer?.active('music') ?? 0 },
    }),
    sfx,
  };
}
