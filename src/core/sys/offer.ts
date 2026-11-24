// 献果:两条线都到 3 档(运输线按 ROUTE_ERA 折算:货船起算)后开放。献出 W 果钱,送出 += W × 15% / v(v = 每个苹果的价值)。
// 折价 15%:献果比"留着再投资"慢,但能把"无事可买"的闲置库存变成进度。
import { ROUTE_ERA } from '../content.ts';
import { OFFER } from './constants.ts';

export interface OfferState {
  /** 累计献出的果钱 */
  coins: number;
  /** 累计折算送出的苹果数 */
  apples: number;
  /** 献果次数 */
  count: number;
}

export const newOffer = (): OfferState => ({ coins: 0, apples: 0, count: 0 });

export const offerOpen = (sourceTier: number, routeTier: number): boolean =>
  Math.min(sourceTier, ROUTE_ERA[routeTier] ?? routeTier) >= OFFER.unlockTier;

/** 献出 W 果钱折算多少送出苹果(v = 每个苹果的价值,≥ 一个很小的正数) */
export const offerApples = (W: number, v: number): number => (W > 0 && v > 0 ? (W * OFFER.discount) / v : 0);

/** 一次最多能献多少果钱 */
export const offerMax = (coins: number): number => Math.max(0, coins) * OFFER.maxShare;

export interface OfferResult {
  /** 实际扣掉的果钱 */
  spent: number;
  /** 增加的送出苹果数 */
  apples: number;
}

/** 纯结算:返回扣款与增量,调用方(bridge)改 state.coins/delivered */
export function doOffer(os: OfferState, W: number, coins: number, v: number): OfferResult {
  const spent = Math.min(Math.max(0, W), offerMax(coins));
  const apples = offerApples(spent, v);
  if (spent > 0) {
    os.coins += spent;
    os.apples += apples;
    os.count++;
  }
  return { spent, apples };
}
