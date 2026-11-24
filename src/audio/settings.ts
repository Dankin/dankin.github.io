/**
 * settings.ts — 音频设置(三开关 + 五层音量)与 localStorage 持久化('sta.audio')。
 */
import { LAYERS, type Layer } from './mixer.ts';

export const STORAGE_KEY = 'sta.audio';

export interface AudioSettings {
  /** 音乐(BGM)开关 */
  music: boolean;
  /** 音效开关(世界音 + 界面音) */
  sfx: boolean;
  /** 旁白打字音开关 */
  voice: boolean;
  /** 各层音量 0..1 */
  vol: Record<Layer, number>;
}

export const defaultSettings = (): AudioSettings => ({
  music: false,
  sfx: false,
  voice: false,
  vol: { master: 0.8, bgm: 0.8, sfx: 1, ui: 1, voice: 1 },
});

const clamp01 = (n: unknown, d: number): number => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : d);

/** 容错解析:未知字段忽略,坏值回退到 base */
export function sanitize(raw: unknown, base: AudioSettings = defaultSettings()): AudioSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const vo = (o.vol && typeof o.vol === 'object' ? o.vol : {}) as Record<string, unknown>;
  const vol = { ...base.vol };
  for (const l of LAYERS) vol[l] = clamp01(vo[l], base.vol[l]);
  return {
    music: typeof o.music === 'boolean' ? o.music : base.music,
    sfx: typeof o.sfx === 'boolean' ? o.sfx : base.sfx,
    voice: typeof o.voice === 'boolean' ? o.voice : base.voice,
    vol,
  };
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function loadSettings(store: Store | null | undefined): AudioSettings {
  try {
    const s = store?.getItem(STORAGE_KEY);
    if (s) return sanitize(JSON.parse(s));
  } catch {
    /* 坏数据 → 默认 */
  }
  return defaultSettings();
}

export function saveSettings(store: Store | null | undefined, s: AudioSettings): void {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* 隐私模式/配额 */
  }
}
