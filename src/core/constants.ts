/** 终点:累计送达的苹果数量 */
export const GOAL = 8_200_000_000;
export const SAVE_KEY = 'shake-the-apple.save';
export const SAVE_BAK_KEY = SAVE_KEY + '.bak';
/** 存档版本。v4:加 spent / pin(迁移见 save.ts migrations[3])。 */
export const SAVE_VERSION = 5;
/** 离线收益上限(毫秒),效率 100% */
export const OFFLINE_CAP_MS = 8 * 3600 * 1000;
/** 短于此时长的离开不算离线(按正常 tick 补算即可) */
export const SHORT_AWAY_MS = 5 * 1000;
