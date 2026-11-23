/** 终点:累计送出的平安果数量 */
export const GOAL = 8_200_000_000;
export const SAVE_KEY = 'shake-the-apple.save';
export const SAVE_BAK_KEY = SAVE_KEY + '.bak';
export const SAVE_VERSION = 1;
/** 离线收益上限(毫秒)与效率 */
export const OFFLINE_CAP_MS = 8 * 3600 * 1000;
export const OFFLINE_EFFICIENCY = 0.5;
/** 短于此时长的离开不算离线,按全效率补算 */
export const SHORT_AWAY_MS = 60 * 1000;
