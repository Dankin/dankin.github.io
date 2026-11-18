import Phaser from 'phaser';
import { hasKey, t } from '../core/data';
import { VIEW_W, VIEW_H } from '../core/iso';

/**
 * UI 布局：UI 相机（uiCam）按真实屏幕大小自适应缩放（z），保证触控目标 ≥ 44 CSS px。
 *  - 逻辑画布固定 VIEW_W×VIEW_H（Scale.FIT）；displayScale = 逻辑像素 / CSS 像素。
 *  - UI 坐标系：左上 (x0,y0)，宽高 (w,h) = (VIEW_W/z, VIEW_H/z)。所有 HUD 都按它锚定。
 *  - 世界相机的屏幕坐标 (0..VIEW_W) → UI 坐标用 toUi()。
 */
export const L = { z: 1, x0: 0, y0: 0, w: VIEW_W, h: VIEW_H, ds: 1, touch: false, version: 0 };

export const MIN_TOUCH_CSS = 44;
/** 触控目标的最小边（UI 单位）：保证在真实屏幕上 ≥ 44 CSS px */
export const minTouch = () => Math.ceil((MIN_TOUCH_CSS * L.ds) / L.z) + 2;

export function relayout(scale: Phaser.Scale.ScaleManager): boolean {
  const ds = Math.max(0.3, scale.displayScale?.x || 1);
  // 目标：基准按钮 48 UI 单位 → ≥ 46 CSS px
  const z = Phaser.Math.Clamp(+(0.96 * ds).toFixed(2), 1, 1.9);
  const changed = Math.abs(z - L.z) > 0.01 || Math.abs(ds - L.ds) > 0.01;
  L.ds = ds; L.z = z;
  L.w = VIEW_W / z; L.h = VIEW_H / z;
  L.x0 = (VIEW_W - L.w) / 2; L.y0 = (VIEW_H - L.h) / 2;
  L.touch = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);
  if (changed) L.version++;
  return changed;
}

/** 世界相机屏幕坐标(0..VIEW) → UI 坐标 */
export const toUi = (sx: number, sy: number) => ({ x: L.x0 + sx / L.z, y: L.y0 + sy / L.z });
/** UI 坐标 → 世界相机屏幕坐标 */
export const fromUi = (ux: number, uy: number) => ({ x: (ux - L.x0) * L.z, y: (uy - L.y0) * L.z });

/** 有 key 就取 zh.json，没有就用后备（待 product 补 key 之前不出现 [key]） */
export function tt(key: string, fb: string, ...args: (string | number)[]): string {
  if (!hasKey(key)) { let s = fb; args.forEach((a, i) => (s = s.replace(`{${i}}`, String(a)))); return s; }
  return t(key, ...args);
}
