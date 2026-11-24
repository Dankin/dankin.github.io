/**
 * 礼物开启日:北京时间(UTC+8)2026-12-24 00:00 起,与玩家所在时区无关。
 * UTC+8 的 12/24 00:00 = UTC 12/23 16:00。到 82 亿之后,没到这天只会看到一个封好的盒子。
 */
export const GIFT_DATE = Date.UTC(2026, 11, 23, 16, 0, 0);
export const giftOpen = (nowMs: number): boolean => nowMs >= GIFT_DATE;
