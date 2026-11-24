import type { C } from './bake.ts';

/** 统一选项(全部可选)。同 seed 同参数 => 同一帧完全一致。 */
export interface ThingOpt {
  /** 手绘抖动种子(默认 1) */
  seed?: number;
  /** 动画时间(秒)。不传 = 静止 */
  t?: number;
  /** 载苹果量 0..1(运输/码头) */
  load?: number;
  /** 行驶强度 0..1:车轮转速、烟、浪花、螺旋桨、传送门自旋 */
  move?: number;
  /** 装卸进度 0..1:>0 时苹果从车上飞出,堆同步减少 */
  unload?: number;
  /** 朝向:1 朝右(默认),-1 朝左 */
  dir?: 1 | -1;
  /** 码头"收到货"脉冲 0..1 */
  pulse?: number;
  /** 码头堆放的箱数 0..8 */
  crates?: number;
  /** 整体不透明度 */
  alpha?: number;
  /** 角色姿态 */
  pose?: Pose;
  /** 姿态内相位 0..1(被砸/接住的触发进度,undefined 则自循环) */
  p?: number;
  /** 乌鸦帮人数 */
  n?: number;
  /** UI/图标等:按下 */
  pressed?: boolean;
  /** 其余扩展 */
  [k: string]: unknown;
}

export type Pose = 'idle' | 'shake' | 'catch' | 'cheer' | 'hit';

/** 统一绘制签名:(x,y)=底部中心 */
export type ThingFn = (ctx: C, x: number, y: number, s: number, o?: ThingOpt) => void;
