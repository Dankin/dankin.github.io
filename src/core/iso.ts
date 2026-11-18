import { WORLD_H } from './data';
export { ART_SCALE, NATIVE_SCALE, SS, PX } from '../art/scale';

/** 逻辑视口（Phaser 画布尺寸，Scale.FIT 缩放到真实屏幕）。 */
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const TW = 64;
export const TH = 32;
/** 世界（屏幕）坐标原点：瓦片 (0,0) 的顶点。保证整张菱形地图在 x>=EDGE_PAD、y>=OY-？ 内。
 *  OX = WORLD_H * TW/2 + EDGE_PAD → 地图最左角 (0,WORLD_H) 落在 x=EDGE_PAD。 */
export const EDGE_PAD = 96;
export const OX = WORLD_H * (TW / 2) + EDGE_PAD;
export const OY = 220;

export function toScreen(tx: number, ty: number) {
  return { x: OX + (tx - ty) * (TW / 2), y: OY + (tx + ty) * (TH / 2) };
}
export function toTile(sx: number, sy: number) {
  const a = (sx - OX) / (TW / 2);
  const b = (sy - OY) / (TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export function lerpColor(a: number, b: number, k: number) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(lerp(ar, br, k)) << 16) | (Math.round(lerp(ag, bg, k)) << 8) | Math.round(lerp(ab, bb, k));
}
