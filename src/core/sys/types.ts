// 系统层共用类型:状态快照(给彩蛋/新闻/成就判定)与总线事件。
import type { EventKind } from '../events.ts';
import type { Weather } from '../world.ts';
import type { AppleKind, AppleState } from './varieties.ts';
import type { WallClock } from './util.ts';

/** 判定用的游戏状态快照。由 bridge.snapshotOf(host, now) 生成,或测试里手写。 */
export interface Snapshot {
  playSec: number;
  /** 累计送出苹果 */
  delivered: number;
  /** 进度 0..1(delivered / GOAL) */
  progress: number;
  sourceTier: number;
  routeTier: number;
  /** min(sourceTier, routeTier) */
  era: number;
  /** 两线单位数合计 */
  units: number;
  shakes: number;
  helperLevel: number;
  /** 老徐当前状态(sys.laoxu.mode;缺省 work) */
  laoxuMode?: 'work' | 'slack' | 'nap' | 'watch';
  combo: number;
  coins: number;
  /** 每秒收入(果钱) */
  income: number;
  /** 最近目标价(果钱) */
  targetCost: number;
  /** 堆场填充度 0..1 */
  stockFill: number;
  /** 累计浪费(堆场溢出) */
  wasted: number;
  /** 距离上次操作的秒数 */
  idleSec: number;
  /** 距离上次升档的秒数(没升过 = playSec) */
  sinceTierSec: number;
  /** 最近一次升档的是哪条线(没传时 route 档新闻标签按当前路线档判断) */
  lastTierLine?: 'source' | 'route';
  bottleneck: 'produce' | 'carry' | 'balanced';
  night: boolean;
  /** 0..3 */
  season: number;
  weather: Weather;
  /** UTC+8 墙钟 */
  wall: WallClock;
  /** 屏幕上的事件(鸟/牛顿/流星),没有 = null */
  eventOnScreen: EventKind | null;
  ordersActive: number;
  pestsActive: number;
  offerOpen: boolean;
  /** 金苹果刚出现过(或图鉴已有) */
  goldSeen: boolean;
  /** 币库超过防囤线的比例(coins / limit) */
  hoardRatio: number;
  /** 屏幕上同时存在的随机事件数(鸟/牛顿/流星) */
  eventsOnScreen: number;
  /** 本次打开游戏已连续在线的秒数 */
  sessionSec: number;
  /** 累计腐烂的果钱(防囤规则烂掉的量;木村奇迹把它也算浪费) */
  rotTotal: number;
  /** 最近越过的进度里程碑(0.01/0.1/...)及距今秒数;没有 = null */
  milestone: { m: number; sinceSec: number } | null;
  /** 距上次事件(鸟/牛顿/流星)被点掉的秒数 */
  sinceEventSec: number;
  /** 统计 */
  ordersDone: number;
  pestsKilled: number;
  offerCount: number;
}

/** 可点击的场景热点(art/app 提供热点,点击时发 {t:'tap', target}) */
export const TAP_TARGETS = [
  'treetop-fruit', 'newton', 'poison-stall', 'summit-gold', 'skyline', 'xu-head-apple', 'xu-throat', 'xu',
  'garage', 'window-silhouette', 'moon', 'seed-core', 'vinegar', 'jam', 'green-apple', 'orange', 'news',
  'leaf-under', 'porter', 'clock', 'stocking', 'gold-basket', 'night-person', 'version', 'title',
  // v6:路上的卡车 / 圣诞收货站 / 云树吊篮 / 星树七盏灯
  'truck', 'elf', 'sleigh-bell', 'reindeer-nose', 'gift-top', 'cloud-basket',
  'star-lantern-1', 'star-lantern-2', 'star-lantern-3', 'star-lantern-4', 'star-lantern-5', 'star-lantern-6', 'star-lantern-7',
] as const;
export type TapTarget = (typeof TAP_TARGETS)[number];

/** eng-app 总线 → 彩蛋/成就的事件 */
export type EggEvent =
  | { t: 'shake'; combo: number; apple?: { kind: AppleKind; state: AppleState } }
  | { t: 'buy'; what: 'unit' | 'expand' | 'helper' | 'offer' | 'order'; line?: 'source' | 'route' }
  | { t: 'tier'; line: 'source' | 'route'; tier: number; branch?: string }
  /** 金苹果:出现 / 被点(since = 距出现的秒数,at = playSec) */
  | { t: 'gold'; kind: 'appear' | 'tap'; at: number; since?: number }
  /** 小鸟/牛顿/流星:claimed=true 点中领奖;false=没点就走(小鸟会啄走少量库存) */
  | { t: 'event'; kind: EventKind; claimed: boolean }
  /** 收货站礼物堆第一次高过雪橇边沿(app 发一次;gift-peek 之后点最上面的包裹才算) */
  | { t: 'gift-rim' }
  | { t: 'idle'; sec: number }
  /** 1Hz 心跳(wall clock/累计量检查都靠它) */
  | { t: 'time' }
  /** 点击场景热点 */
  | { t: 'tap'; target: TapTarget; at: number }
  /** 读档后启动/回到前台时发一次 */
  | { t: 'login' }
  /** 离线结算:离开多少毫秒 */
  | { t: 'away'; ms: number }
  /** 清理烂果 */
  | { t: 'rot'; cleaned: number }
  | { t: 'win' }
  /** 堆场溢出提示弹出一次 */
  | { t: 'overflow' }
  /** 点了"拒绝"果多多的出价 */
  | { t: 'refuse' }
  /** 长按热点(app 在松手/满阈值时发一次;sec = 按住秒数) */
  | { t: 'hold'; target: TapTarget; sec: number };
