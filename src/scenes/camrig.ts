import type Phaser from 'phaser';
import { VIEW_W, VIEW_H, clamp } from '../core/iso';

export interface Bounds { x0: number; x1: number; y0: number; y1: number }

/**
 * 主相机控制：跟随 / 手动拖动（follow=false）/ 用户缩放（0.7~1.5）/ 剧情聚焦（focus）。
 * 不使用 Phaser 的 setBounds：缩放后自行按可视范围夹取，世界比视野小时居中。
 */
export class CameraRig {
  static readonly MIN = 0.7;
  static readonly MAX = 1.5;
  z = 1; cx = 0; cy = 0;
  /** 用户缩放（聚焦时在其上叠乘） */
  userZ = 1;
  follow = true;
  focus: { x: number; y: number; z: number } | null = null;
  constructor(readonly cam: Phaser.Cameras.Scene2D.Camera, readonly b: Bounds) {}

  setUserZoom(z: number) { this.userZ = clamp(z, CameraRig.MIN, CameraRig.MAX); }

  /** 拖动：屏幕像素 → 世界位移 */
  panByScreen(dx: number, dy: number) { this.follow = false; this.cx -= dx / this.z; this.cy -= dy / this.z; this.clampCenter(); }

  snap(x: number, y: number) { this.cx = x; this.cy = y; this.z = this.userZ; this.clampCenter(); this.apply(); }

  private clampCenter() {
    const hw = VIEW_W / 2 / this.z, hh = VIEW_H / 2 / this.z, b = this.b;
    this.cx = b.x1 - b.x0 < 2 * hw ? (b.x0 + b.x1) / 2 : clamp(this.cx, b.x0 + hw, b.x1 - hw);
    this.cy = b.y1 - b.y0 < 2 * hh ? (b.y0 + b.y1) / 2 : clamp(this.cy, b.y0 + hh, b.y1 - hh);
  }

  private apply() { this.cam.setZoom(this.z); this.cam.centerOn(this.cx, this.cy); }

  update(dt: number, target: { x: number; y: number } | null) {
    const f = this.focus;
    const tz = f ? clamp(f.z * this.userZ, 0.7, 2.2) : this.userZ;
    this.z += (tz - this.z) * (1 - Math.exp(-dt * 5));
    const tgt = f ?? (this.follow ? target : null);
    if (tgt) {
      const k = 1 - Math.exp(-dt * (f ? 2.2 : 3.2));
      this.cx += (tgt.x - this.cx) * k; this.cy += (tgt.y - this.cy) * k;
    }
    this.clampCenter();
    this.apply();
  }
}
