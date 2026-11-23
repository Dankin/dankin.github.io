/** 礼物开启日:本地时间 2026-12-24 00:00 起。到 82 亿之后,没到这天只会看到一个封好的盒子。 */
export const GIFT_DATE = new Date(2026, 11, 24, 0, 0, 0).getTime();
export const giftOpen = (nowMs: number): boolean => nowMs >= GIFT_DATE;
