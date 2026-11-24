// v5 新系统数值常量:全部集中在这里。想调平衡只改这个文件,再跑 `node scripts/sim-v5.ts`。

// ───────────────────────── 苹果品种 ─────────────────────────
/**
 * 状态权重(未归一)与价值乘数。虫蛀的苹果统一画成 `worm` 品种(见 varieties.ts)。
 * 说明:rollApple 返回的 value 已按"该情境下期望 = 1"归一,所以品种/状态只带来方差,不改平均收入。
 */
export const APPLE_STATE = {
  weight: { fresh: 0.8, ripe: 0.12, wormy: 0.07, shiny: 0.01 },
  mult: { fresh: 1, ripe: 1.15, wormy: 0.7, shiny: 2 },
  /** 治好虫蛀后变回新鲜的富士红 */
  healedTo: 'fresh' as const,
};

/** 每次摇树掉的"样本苹果"有多大概率被放进珍藏篮(订单用),其余只是画面 */
export const BAG = {
  /** 每次有效摇树,样本苹果入篮的概率 */
  shakeP: 0.25,
  /** 每隔多少秒自动采样一个入篮(老徐/挂机也能凑订单) */
  passiveS: 7,
  /** 每个品种最多存多少 */
  maxPerKind: 30,
};

// ───────────────────────── 订单 ─────────────────────────
export const ORDER = {
  /** 游戏内多少秒后出现第一张订单(FTUE:6:00) */
  unlockSec: 360,
  /** 两张订单之间的间隔 [min,max] 秒(从上一张出现/被处理后算) */
  gapS: [75, 135] as [number, number],
  /** 同时挂着的订单上限:按 era(0..5)取 */
  maxActive: [1, 1, 2, 2, 2, 3],
  /** 普通单的限时(秒),过期无惩罚 */
  stayS: 150,
  /** 加急单概率与限时 */
  rushP: 0.25,
  rushStayS: 50,
  /** 数量:ordinary = 指定品种,any = 任意品种 */
  qty: { kind: [2, 4] as [number, number], any: [5, 9] as [number, number] },
  /** 每多一个 era 数量加这么多(向下取整) */
  qtyPerEra: 0.5,
  /** 指定品种单的概率(其余是 any) */
  kindP: 0.7,
  /** 奖励 = 这么多秒的当前收入(无惩罚,奖励小于总收入的 3%):普通/加急 */
  rewardSec: 2.5,
  rushRewardSec: 5,
  /** 奖励下限(果钱),早期收入小时保底 */
  floorCoins: 5,
  /** 青苹果是"订单专用":被点单的权重倍数 */
  grannyBoost: 3,
  customers: 3,
};

// ───────────────────────── 虫眼(轻塔防) ─────────────────────────
export const PEST = {
  /** 游戏内多少秒后第一波(FTUE 2:00 的小鸟事件之后) */
  unlockSec: 240,
  /** 两波间隔 [min,max] 秒(季节/天气会缩放) */
  gapS: [150, 240] as [number, number],
  /** 每波虫数:1 + floor(era × perEra),最多 maxWave */
  perEra: 0.5,
  maxWave: 4,
  /** 虫子出场间隔(秒) */
  staggerS: 1.6,
  /** 爬完全程要多少秒(越小越快);kind→秒 */
  crossS: { ant: 11, beetle: 15, caterpillar: 9 } as Record<'ant' | 'beetle' | 'caterpillar', number>,
  /** 点几下才死 */
  hp: { ant: 1, beetle: 2, caterpillar: 1 } as Record<'ant' | 'beetle' | 'caterpillar', number>,
  /** 解锁 era(0..5):甲虫 ≥2,毛毛虫 ≥1 */
  minEra: { ant: 0, caterpillar: 1, beetle: 2 } as Record<'ant' | 'beetle' | 'caterpillar', number>,
  /** 虫子爬到树边咬一口:损失当时库存苹果(堆场)的这个比例;从不致命 */
  biteFrac: 0.012,
  /** 一波最多损失堆场的这个比例(封顶) */
  waveCapFrac: 0.04,
  /** 打死一只的奖励:这么多秒的收入(很小) */
  killRewardSec: 0.6,
  killRewardFloor: 1,
};

// ───────────────────────── 季节(与昼夜/天气联动) ─────────────────────────
/** 春花 夏虫 秋收 冬慢:value 为价格乘数(四季平均 = 1.00),其余是出现率倍数 */
export const SEASON_FX = [
  { name: '春', value: 1.05, pest: 0.8, shiny: 1.6, ripe: 0.8, wormy: 0.7 },
  { name: '夏', value: 0.95, pest: 1.6, shiny: 1.0, ripe: 0.8, wormy: 2.0 },
  { name: '秋', value: 1.1, pest: 1.0, shiny: 1.0, ripe: 2.0, wormy: 1.0 },
  { name: '冬', value: 0.9, pest: 0.4, shiny: 1.4, ripe: 0.8, wormy: 0.5 },
] as const;
/** 夜晚:闪光概率倍数,虫子倍数 */
export const NIGHT_FX = { shiny: 2.0, pest: 0.6 };
/** 天气:虫子倍数 */
export const WEATHER_FX = { clear: 1, cloudy: 1, rain: 0.5, snow: 0.4 } as const;

// ───────────────────────── 献果 ─────────────────────────
export const OFFER = {
  /** 两条线都到这一档才开放 */
  unlockTier: 3,
  /** 折价:献出 W 果钱,送出 += W × discount / v(v = 每苹果价值) */
  discount: 0.15,
  /** 一次最多献出当前库存的比例 */
  maxShare: 1,
};

// ───────────────────────── 防囤(烂掉) ─────────────────────────
export const DECAY = {
  /** 防囤线 = max(targetMult × 最近目标价, incomeSec × 每秒收入) */
  targetMult: 1.5,
  incomeSec: 300,
  /** 超出部分每秒烂掉的比例 */
  rate: 0.005,
  /** 每烂掉这么多(占防囤线的比例)冒出一个"烂果"图标,封顶 rotMax,点击清理 */
  rotChunk: 0.02,
  rotMax: 12,
  /** dt 超过这么多秒视为离线结算,不烂 */
  offlineAboveS: 5,
};

// ───────────────────────── 图鉴/彩蛋 ─────────────────────────
export const CODEX = {
  /** 连点判定:相邻两次点击不超过这么多秒才算"连点" */
  tapGapS: 1.5,
  /** "点标题 7 次"等放宽窗口 */
  tapGapLongS: 3,
  /** 追上金苹果:两次点击最大间隔(秒) */
  goldChaseS: 3,
  /** 无操作多少秒触发"乔纳森" */
  idleEggS: 60,
  /** "木村奇迹":连续这么多秒零浪费 */
  noWasteS: 600,
  /** 连摇多少击触发"摇钱树" */
  moneyTreeCombo: 100,
  /** 摇树掉蛇的概率 */
  snakeP: 1 / 300,
  /** 离线多少毫秒算"老徐睡着" */
  sleeperAwayMs: 8 * 3600 * 1000,
  /** 烂果清理多少个触发"苹果派" */
  pieRot: 20,
  /** 凌晨几点(UTC+8) */
  nightHour: 3,
  /** 圣诞袜/xmas 标签:12 月几号之后 */
  xmasFromDay: 20,
};

// ───────────────────────── 新闻 ─────────────────────────
export const NEWS = {
  /** 最近看过多少条不重复(≈8 秒一条 → 10 分钟 ≈ 75 条,取 60 兼顾总量) */
  recentN: 60,
  /** 每个"条件标签"命中给权重的加成;ambient 标签(day/night)只算一半 */
  tagBonus: 1.2,
  ambientBonus: 0.4,
  milestoneBonus: 2.0,
  /** 高库存标签:coins > 防囤线 × 这个比例 */
  highStock: 0.7,
  /** 低库存:coins < 这么多秒收入 */
  lowStockSec: 10,
  newTierS: 60,
  idleS: 30,
  comboN: 20,
};

// ───────────────────────── 里程碑(进度比例) ─────────────────────────
export const MILESTONES = [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99] as const;
