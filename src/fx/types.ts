import type Phaser from 'phaser';
import type { MoveDef, PropDef } from '../core/data';
import type { Stimulus, StimulusSystem } from '../core/stimulus';
import type { LayerLike } from '../ui/bubble';

/** 场景里的可附身物件（Game.PropEnt 结构上满足此接口） */
export interface FxProp {
  id: string; def: PropDef; x: number; y: number; sx: number; sy: number; top: number;
  spr: Phaser.GameObjects.Image; sh: Phaser.GameObjects.Image;
  uses: number; pose: number; pulse: number;
  tubes?: Phaser.GameObjects.Image; lamp?: Phaser.GameObjects.Image; lights?: Phaser.GameObjects.Image;
  /** 给 rig/fx 存任意状态（避免改 PropEnt） */
  data?: Record<string, any>;
}

/** 由 GameScene 提供给 fx 系统的能力（全部是"回调"，fx 不反向 import 场景） */
export interface FxHost {
  scene: Phaser.Scene;
  /** 世界层：加进去的对象只被主相机渲染 */
  W: LayerLike;
  props: Record<string, FxProp>;
  stim: StimulusSystem;
  now(): number;
  toast(text: string, secs?: number): void;
  /** 在锚点处显示气泡 */
  bubble(key: string, anchor: () => { x: number; y: number }, text: string, secs?: number): void;
  crowdNear(x: number, y: number, r: number): number;
  /** 世界内 crowd NPC 列表（只读）：{id,x,y,sx,sy}，用于"围观/红心"类特效 */
  crowdMembers(x: number, y: number, r: number): { id: string; x: number; y: number; sx: number; sy: number }[];
  completeCheck(id: string): void;
  shake(ms: number, amp: number): void;
  /** 玩家的帽子（hat:morph 终章演出用，可选） */
  hat?: { x: number; y: number; z: number; spr: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; setStage(n: number): void; flyTo(x: number, y: number, z?: number, cb?: () => void): void };
}

export interface Particle { o: any; m: number; vx: number; vy: number; g: number; life: number; max: number; s0: number; s1: number; a0: number; spin: number }
export interface PartOpts { text?: boolean; g?: number; s0?: number; s1?: number; a0?: number; spin?: number }

/** 传给每个 fx / 事件处理器的上下文 */
export interface FxContext {
  fx: import('./system').FxSystem;
  host: FxHost;
  scene: Phaser.Scene;
  W: LayerLike;
  prop?: FxProp;
  stim?: Stimulus;
  move?: MoveDef;
  /** prop 顶部的世界像素坐标 */
  top: { x: number; y: number };
  /** prop 底部（脚下） */
  base: { x: number; y: number };
  /** 事件名（事件型 fx） */
  event?: string;
  args?: any[];
}

export type FxFn = (ctx: FxContext) => void;

/** Rig：某类 tex 的物件的"常驻部件 + 每帧更新" */
export interface Rig {
  setup?(p: FxProp, fx: import('./system').FxSystem): void;
  tick?(p: FxProp, dt: number, fx: import('./system').FxSystem, glow?: number): void;
}
