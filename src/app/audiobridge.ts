// 音频接线:世界(时代/昼夜/季节/天气)→ BGM,总线事件 → 音效,以及给设置面板用的最小 API。
// 音量/开关的持久化由 src/audio 自己负责(localStorage 'sta.audio'),这里只做转发,ui-v5 的设置面板直接调用下面的函数。
import { bus } from '../core/bus.ts';
import { eraMin } from '../core/game.ts';
import { worldAt } from '../core/world.ts';
import { app } from './ctx.ts';

export type AudioLayer = 'master' | 'bgm' | 'sfx' | 'ui' | 'voice';
export type AudioSwitch = 'music' | 'sfx' | 'voice';

/** 设置面板:读 */
export function audioSettings(): { volume: Record<AudioLayer, number>; music: boolean; sfx: boolean; voice: boolean } {
  const a = app.audio;
  const L: AudioLayer[] = ['master', 'bgm', 'sfx', 'ui', 'voice'];
  const volume = Object.fromEntries(L.map((l) => [l, a.getVolume(l)])) as Record<AudioLayer, number>;
  return { volume, music: a.isMusicOn(), sfx: a.isSfxOn(), voice: a.isVoiceOn() };
}
/** 设置面板:改音量(0..1) */
export function setAudioVolume(layer: AudioLayer, v: number): void {
  app.audio.setVolume(layer, v);
}
/** 设置面板:三个开关(音乐 / 音效 / 旁白打字音) */
export function setAudioSwitch(k: AudioSwitch, on: boolean): void {
  app.audio.setSwitch(k, on);
  if (on) app.audio.sfx.play('toggleOn');
}

const RARE = new Set(['golden', 'forbidden', 'kent', 'rainbow']);
let lastEra = -1;
let lastArrive = 0;

function syncWorld(): void {
  const s = app.state;
  const e = eraMin(s);
  if (e !== lastEra) {
    lastEra = e;
    app.audio.setEra(Math.min(5, e));
  }
  const w = worldAt(s.playSec);
  app.audio.setWorld({ daylight: w.daylight, season: w.season, weather: w.weather });
}

export function initAudioBridge(): void {
  const play = (name: string, o?: { level?: number; variant?: number; pitch?: number; vol?: number }): void => {
    try {
      app.audio.sfx.play(name as never, o);
    } catch {
      /* 音频不可用不影响游戏 */
    }
  };
  syncWorld();
  setInterval(syncWorld, 1000);
  bus.on('era', () => syncWorld());
  bus.on('news', () => play('newsTick'));
  bus.on('apple', (e) => {
    if (RARE.has(e.kind)) play('rareApple');
  });
  bus.on('delivered', () => {
    const t = performance.now();
    if (t - lastArrive > 700) {
      lastArrive = t;
      play('appleArrive');
    }
  });
  bus.on('offer', () => play('coin'));
  bus.on('win', () => {
    play('giftOpen');
    setTimeout(() => play('firework'), 600);
    setTimeout(() => play('firework'), 1300);
  });
}
