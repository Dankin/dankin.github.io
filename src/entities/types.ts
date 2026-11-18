import type { EmitSpec } from '../core/stimulus';

/**
 * 玩法层扩展字段（数据 JSON 里直接写，data.ts 的类型不动；本文件是它们的“契约”）。
 * 校验见 core/story.ts 的 validateGameplay()。
 */

/** NPC 日程一条：满足 when 时生效（先匹配先得）。 */
export interface ScheduleEntry {
  id?: string;
  /** 生效条件：当前阶段 id（morning/dusk/…）与世界标志 */
  when?: { phase?: string | string[]; flag?: string | string[]; notFlag?: string | string[] };
  /** 路线（世界坐标点列）；点可带第三个数字=在此停留秒数 */
  route: number[][];
  /** loop 循环 / pingpong 往返 / random 随机点 / stay 走到第一个点后停下 */
  mode?: 'loop' | 'pingpong' | 'random' | 'stay';
  speed?: number;
  /** 每个路点默认停留秒数 或 [min,max] */
  wait?: number | number[];
  /** 到点后的姿态 / 朝向 / 自言自语 */
  pose?: string; face?: number[]; say?: string;
  /** E15：隐形（不渲染/不可点/不挡路），但仍可感知刺激、走路线 */
  hidden?: boolean;
}

/** 反应的扩展字段（Reaction 之上） */
export interface ReactionX {
  on: { type: string; tag?: string; min?: number };
  do: string;
  say?: string; secs?: number; emote?: string;
  /** 条件：阶段/标志/自身状态 */
  when?: { phase?: string | string[]; flag?: string | string[]; notFlag?: string | string[]; state?: string | string[] };
  chance?: number; cd?: number; force?: boolean; poll?: boolean;
  /** flee：速度倍率 / 逃多远 / 逃向（'home' 或 [x,y]） */
  speed?: number; dist?: number; to?: number[] | 'home';
  /** approach / follow：停在多远 */
  stop?: number; arrive?: string;
  /** pose：姿态贴图后缀（c_<id>_<pose>）；lookUp：看向的点（缺省=现象位置） */
  pose?: string; at?: number[];
  /** 反应触发后的副作用 */
  set?: string; clear?: string; event?: string; emit?: EmitSpec;
}

/** NPC 的扩展字段 */
export interface NpcDefX {
  schedule?: ScheduleEntry[];
  /** NPC 自身发出的常驻现象（如狗的 presence:dog），位置跟随 NPC */
  emit?: EmitSpec;
  scale?: number;            // 体型倍率（狗/孩子）
  hideAt?: number[];         // 躲藏点
  species?: string;
  noCollide?: boolean;
  /** E16：不可附身/不可靠近（帽子靠近会被轻轻弹开） */
  unpossessable?: boolean;
}

/** NPC 指令（故事/序列下达，优先于日程） */
export type Order =
  | { kind: 'goto'; x: number; y: number; speed?: number; stop?: number; face?: number[]; pose?: string; onArrive?: () => void }
  | { kind: 'follow'; target: string; dist?: number; speed?: number; side?: number }
  | { kind: 'ride'; target: string; ox?: number; oy?: number; pose?: string }
  | { kind: 'stay'; pose?: string; face?: number[] };
