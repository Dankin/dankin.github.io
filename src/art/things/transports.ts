// 运输 9 档统一入口:TRANSPORT_ORDER 为升级顺序;drawTransport 接受档位序号或名字。
import { drawBasket, drawCart, drawPlane, drawPortal, drawShip, drawTruck } from './transport.ts';
import { drawHelicopter, drawPorter, drawTrampoline } from './transport-extra.ts';
import type { ThingFn } from './types.ts';

export const TRANSPORT_ORDER = ['basket', 'porter', 'cart', 'trampoline', 'truck', 'ship', 'helicopter', 'plane', 'portal'] as const;
export type TransportKind = (typeof TRANSPORT_ORDER)[number];

/** 各档世界宽度(单位),与 README 对应。 */
export const TRANSPORT_W: readonly number[] = [18, 36, 34, 50, 70, 80, 76, 84, 44];
export const TRANSPORT_NAMES: readonly string[] = ['篮子', '挑扁担工', '小推车', '蹦床', '卡车', '货船', '直升机', '飞机', '传送门'];
export const TRANSPORT_FNS: Record<TransportKind, ThingFn> = {
  basket: drawBasket,
  porter: drawPorter,
  cart: drawCart,
  trampoline: drawTrampoline,
  truck: drawTruck,
  ship: drawShip,
  helicopter: drawHelicopter,
  plane: drawPlane,
  portal: drawPortal,
};
export const TRANSPORTS: readonly ThingFn[] = TRANSPORT_ORDER.map((k) => TRANSPORT_FNS[k]);

export function transportIndex(kind: TransportKind | number): number {
  return typeof kind === 'number' ? Math.max(0, Math.min(TRANSPORT_ORDER.length - 1, Math.floor(kind))) : Math.max(0, TRANSPORT_ORDER.indexOf(kind));
}

export const drawTransport = (ctx: CanvasRenderingContext2D, kind: TransportKind | number, x: number, y: number, s: number, o: Parameters<ThingFn>[4] = {}): void =>
  TRANSPORTS[transportIndex(kind)](ctx, x, y, s, o);
