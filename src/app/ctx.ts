// app 层共享上下文:所有 app/* 模块通过它读写"当前 State / 音频 / 画面 / 标志位"。
// 约定:核心只认 State;界面只认 WorldView + DOM id;这里是它们之间的胶水。
import { newState, type State } from '../core/state.ts';
import type { LineId } from '../core/game.ts';
import { createAudio } from '../audio/bgm.ts';
import type { Orchard } from '../ui/orchard.ts';

// ───────────── 调试参数 ─────────────
// ?debug=1 出调试面板(设置里);?speed=N 把游戏时间加速 N 倍(1..3600);
// ?debug=1&date=YYYY-MM-DD 假装今天(北京时间 12:00)是哪天(只影响 12/24 的礼物门);没有 ?debug=1 时 ?date= 不生效
export const qs = new URLSearchParams(location.search);
export const DEBUG = qs.has('debug') || qs.has('speed');
const dateOffset = (() => {
  const d = qs.has('debug') ? qs.get('date') : null;
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return 0;
  const t = Date.parse(d + 'T12:00:00+08:00');
  return Number.isFinite(t) ? t - Date.now() : 0;
})();
/** 日历意义上的"现在"(只给礼物门用)。游戏内时间走 state.playSec,与它无关。 */
export const nowMs = (): number => Date.now() + dateOffset;

export interface App {
  state: State;
  orchard: Orchard;
  audio: ReturnType<typeof createAudio>;
  canSave: boolean;
  /** 存档来自更新版本 / 另一标签页在玩:只读,不写存档、不推进 tick */
  readOnly: boolean;
  won: boolean;
  speed: number;
  DEBUG: boolean;
}

export const kv: Storage = localStorage;

export const app: App = {
  state: newState(Date.now()),
  orchard: undefined as unknown as Orchard, // boot 里创建
  audio: createAudio(),
  canSave: true,
  readOnly: false,
  won: false,
  speed: qs.has('speed') ? Math.max(1, Math.min(3600, Number(qs.get('speed')) || 1)) : 1,
  DEBUG,
};

/** 用来打断模块间的循环依赖:boot 里把真正的函数装上 */
export const hooks = {
  /** 重画顶栏/底栏/画面(renderAll) */
  render: (): void => {},
};

export const LINE_NAME: Record<LineId, string> = { source: '生产线', route: '运输线' };
