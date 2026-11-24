// SysState:systems 全部可存档状态 + 每帧推进 + 与 eng-app 的接线函数。
// 纯函数/纯数据,不 import bus、不 import game.ts。eng-app 把 `sys: SysState` 放进 State 并存档(见 README)。
import { ROUTE_ERA } from '../content.ts';
import { BAG } from './constants.ts';
import { checkAchievements, checkEggs, discoverKind, newCodex, normalizeCodex, type CodexState } from './codex.ts';
import { cleanRot, decayLimit, decayStep, newRot, type RotState } from './decay.ts';
import { newNewsState, trackMilestone, milestoneOf, pickNews, pushRecent, type NewsItem, type NewsState } from './newsRules.ts';
import { doOffer, newOffer, offerOpen, type OfferResult, type OfferState } from './offer.ts';
import { canFulfill, fulfillOrder, newOrders, tickOrders, type Order, type OrdersState } from './orders.ts';
import { killReward, newPests, tapPest, tickPests, type PestEvent, type PestsState } from './pests.ts';
import { appleCtxAt, seasonAt } from './season.ts';
import type { EggEvent, Snapshot } from './types.ts';
import { bagAdd, rollApple, type Apple, type Bag } from './varieties.ts';
import { newLaoxu, normalizeLaoxu, stepLaoxu, takeCrit, tapLaoxu, type LaoxuEvent, type LaoxuState, type LaoxuTap } from './laoxu.ts';
import { shanghai, type Rnd } from './util.ts';

export interface SysState {
  v: 1;
  bag: Bag;
  /** 被动入篮计时(秒) */
  bagT: number;
  orders: OrdersState;
  pests: PestsState;
  rot: RotState;
  offer: OfferState;
  codex: CodexState;
  news: NewsState;
  /** 最近看过的新闻 id(旧→新) */
  recentNews: string[];
  /** 上次事件被点掉的 playSec(-1 = 从未) */
  lastEventAt: number;
  /** 本次防囤线(每帧更新,只读展示用) */
  limit: number;
  /** 老徐行为状态机(sys/laoxu.ts) */
  laoxu: LaoxuState;
}

export function newSys(): SysState {
  return {
    v: 1, bag: {}, bagT: 0, orders: newOrders(), pests: newPests(), rot: newRot(), offer: newOffer(),
    codex: newCodex(), news: newNewsState(), recentNews: [], lastEventAt: -1, limit: 0, laoxu: newLaoxu(),
  };
}

/** 读档容错:缺字段补默认(旧档没有 sys 时传 undefined) */
export function normalizeSys(raw: unknown): SysState {
  const s = newSys();
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Partial<SysState>;
  if (r.bag && typeof r.bag === 'object') s.bag = r.bag;
  if (typeof r.bagT === 'number') s.bagT = r.bagT;
  if (r.orders && Array.isArray(r.orders.list)) s.orders = { ...s.orders, ...r.orders };
  if (r.pests && Array.isArray(r.pests.list)) s.pests = { ...s.pests, ...r.pests, list: [] }; // 虫群不存档,读档清空
  if (r.rot && typeof r.rot.total === 'number') s.rot = { ...s.rot, ...r.rot };
  if (r.offer && typeof r.offer.count === 'number') s.offer = { ...s.offer, ...r.offer };
  s.codex = normalizeCodex(r.codex);
  if (r.news && typeof r.news.mIdx === 'number') s.news = { ...s.news, ...r.news };
  if (Array.isArray(r.recentNews)) s.recentNews = r.recentNews.filter((x) => typeof x === 'string').slice(-80);
  if (typeof r.lastEventAt === 'number') s.lastEventAt = r.lastEventAt;
  s.laoxu = normalizeLaoxu(r.laoxu);
  return s;
}

/** eng-app 每帧给的输入(都是只读数字) */
export interface SysInput {
  playSec: number;
  /** min(源档, 路档) */
  era: number;
  sourceTier: number;
  routeTier: number;
  /** 手上苹果(库存) */
  coins: number;
  /** 每秒收入(throughput().income) */
  income: number;
  /** 最近目标价(钉住的卡,否则下一个最贵未买项) */
  targetCost: number;
  /** 持有冷库道具(gate 'cold'):免疫腐烂 */
  coldStorage: boolean;
  /** 进度 0..1 */
  progress: number;
  /** 老徐等级 0..8(缺省 0:不推进老徐状态机) */
  helperLevel?: number;
  /** 玩家多久没操作(秒;缺省 0) */
  idleSec?: number;
  /** 屏幕上有事件(鸟/牛顿/流星)(缺省 false) */
  eventOnScreen?: boolean;
}

export type SysEvent =
  | { t: 'order-new'; order: Order }
  | { t: 'order-expire'; id: number }
  | { t: 'pest-wave'; n: number }
  | { t: 'pest-bite'; id: number; lost: number }
  | { t: 'rot'; spawned: number }
  | { t: 'bag'; apple: Apple };

export interface SysTick {
  /** 本帧要从 coins 扣掉的量(腐烂 + 虫咬),eng-app 做 s.coins -= coinsLoss(不会扣成负) */
  coinsLoss: number;
  events: SysEvent[];
  /** 老徐出工系数 0..1:eng-app 每帧 s.helperAct = helperAct */
  helperAct: number;
  /** 老徐状态变化/精神焕发事件(给气泡/台词用) */
  laoxu: LaoxuEvent[];
}

/** 每帧推进(任意 dt;dt>5 视为离线结算,只做安全的部分) */
export function tickSys(sys: SysState, dt: number, inp: SysInput, rnd: Rnd): SysTick {
  const events: SysEvent[] = [];
  let loss = 0;
  trackMilestone(sys.news, inp.progress, inp.playSec);

  // 被动入篮(离线不补)
  if (dt <= 5) {
    sys.bagT += dt;
    while (sys.bagT >= BAG.passiveS) {
      sys.bagT -= BAG.passiveS;
      const a = rollApple(rnd, appleCtxAt(inp.playSec, inp.era));
      events.push(...intoBag(sys, a, inp.playSec));
    }
  } else sys.bagT = 0;

  for (const e of tickOrders(sys.orders, inp.playSec, inp.era, rnd)) {
    events.push(e.t === 'new' ? { t: 'order-new', order: e.order } : { t: 'order-expire', id: e.order.id });
  }

  const se = seasonAt(inp.playSec);
  const pe: PestEvent[] = tickPests(sys.pests, dt, { playSec: inp.playSec, era: inp.era, rate: se.pest, stock: inp.coins }, rnd);
  for (const e of pe) {
    if (e.t === 'wave') events.push({ t: 'pest-wave', n: e.n });
    else if (e.t === 'bite') {
      loss += e.lost;
      events.push({ t: 'pest-bite', id: e.id, lost: e.lost });
    }
  }

  sys.limit = decayLimit(inp.targetCost, inp.income);
  const d = decayStep(sys.rot, Math.max(0, inp.coins - loss), sys.limit, dt, inp.coldStorage);
  loss += d.rotted;
  if (d.spawned) events.push({ t: 'rot', spawned: d.spawned });
  const newOrder = events.some((e) => e.t === 'order-new');
  const lx = stepLaoxu(sys.laoxu, dt, rnd, {
    level: inp.helperLevel ?? 0,
    idleSec: inp.idleSec ?? 0,
    night: se.night,
    visitor: !!inp.eventOnScreen || newOrder || events.some((e) => e.t === 'pest-wave'),
  });
  return { coinsLoss: Math.min(loss, Math.max(0, inp.coins)), events, helperAct: lx.act, laoxu: lx.events };
}

function intoBag(sys: SysState, a: Apple, playSec: number): SysEvent[] {
  discoverKind(sys.codex, a.kind, playSec);
  return bagAdd(sys.bag, a) ? [{ t: 'bag', apple: a }] : [];
}

/** 每次有效摇树调用:抽一个苹果(返回它,供画面/金苹果/毒苹果处理);按概率入篮。force 用于牛顿事件 'kent'。 */
export function onShakeRoll(sys: SysState, inp: Pick<SysInput, 'playSec' | 'era'>, rnd: Rnd, force?: Apple['kind']): Apple {
  const a = rollApple(rnd, appleCtxAt(inp.playSec, inp.era, force ? { force } : {}));
  discoverKind(sys.codex, a.kind, inp.playSec);
  if (rnd() < BAG.shakeP) bagAdd(sys.bag, a);
  return a;
}

/** 玩家点订单:够货就交付。返回奖励(果钱),eng-app 做 s.coins += reward */
export function claimOrder(sys: SysState, id: number, income: number): { ok: boolean; reward: number } {
  const r = fulfillOrder(sys.orders, sys.bag, id, income);
  return { ok: r.ok, reward: r.reward };
}
export { canFulfill };

/** 点虫:返回 'hit'|'kill'|null 与击杀奖励(果钱) */
export function tapPestSys(sys: SysState, id: number, income: number): { r: 'hit' | 'kill' | null; reward: number } {
  const r = tapPest(sys.pests, id);
  return { r, reward: r === 'kill' ? killReward(income) : 0 };
}

/** 点清烂果:返回清理个数 */
/** 摇树取老徐的暴击倍数(精神焕发时 3,否则 1;取一次就消耗) */
export const laoxuCrit = (sys: SysState): number => takeCrit(sys.laoxu);

/** 玩家点老徐:返回结果与奖励(苹果数 = rewardS × income) */
export function tapLaoxuSys(sys: SysState, income: number, rnd: Rnd): LaoxuTap & { reward: number } {
  const r = tapLaoxu(sys.laoxu, rnd);
  return { ...r, reward: r.r === 'none' ? 0 : r.rewardS * income };
}

export const cleanRotSys = (sys: SysState, n = Infinity): number => cleanRot(sys.rot, n);

/** 献果:eng-app 先 s.coins -= r.spent(spent 是果钱),再 s.coins += r.apples 对应的……见 README */
export function offerSys(sys: SysState, inp: Pick<SysInput, 'sourceTier' | 'routeTier'>, W: number, coins: number, v: number): OfferResult | null {
  if (!offerOpen(inp.sourceTier, inp.routeTier)) return null;
  return doOffer(sys.offer, W, coins, v);
}

/** 构造 Snapshot(codex/news 的输入);host 给"游戏里的原始数",其余由 sys 补 */
export type SnapHost = Omit<
  Snapshot,
  'wall' | 'ordersActive' | 'pestsActive' | 'offerOpen' | 'goldSeen' | 'milestone' | 'rotTotal' | 'ordersDone' | 'pestsKilled' | 'offerCount' | 'night' | 'season' | 'weather' | 'era' | 'hoardRatio'
> & { nowMs: number };

export function snapshotOf(sys: SysState, h: SnapHost): Snapshot {
  const se = seasonAt(h.playSec);
  const { nowMs, ...rest } = h;
  return {
    ...rest,
    era: Math.min(h.sourceTier, ROUTE_ERA[h.routeTier] ?? h.routeTier),
    laoxuMode: sys.laoxu.mode,
    night: se.night,
    season: se.season,
    weather: se.weather,
    wall: shanghai(nowMs),
    ordersActive: sys.orders.list.length,
    pestsActive: sys.pests.list.filter((p) => h.playSec >= p.at).length,
    offerOpen: offerOpen(h.sourceTier, h.routeTier),
    goldSeen: !!sys.codex.kinds.golden,
    hoardRatio: sys.limit > 0 ? h.coins / sys.limit : 0,
    milestone: milestoneOf(sys.news, h.playSec),
    rotTotal: sys.rot.total,
    ordersDone: sys.orders.done,
    pestsKilled: sys.pests.killed,
    offerCount: sys.offer.count,
  };
}

/** 事件→彩蛋→成就。返回新触发的彩蛋 id 与新成就 id。eng-app 对 egg 发 bus 'egg' 并发奖(奖励由 content/EGG 表给)。 */
export function onEvent(sys: SysState, snap: Snapshot, ev: EggEvent, rnd: Rnd): { eggs: { id: string; first: boolean }[]; ach: string[] } {
  if (ev.t === 'event' && ev.claimed) sys.lastEventAt = snap.playSec;
  const eggs = checkEggs(snap, ev, sys.codex, rnd);
  const ach = checkAchievements(snap, sys.codex);
  return { eggs, ach };
}

/** 选一条新闻并登记到最近列表 */
export function nextNews(sys: SysState, snap: Snapshot, items: readonly NewsItem[], rnd: Rnd): NewsItem | null {
  const it = pickNews(snap, sys.recentNews, items, rnd);
  if (it) sys.recentNews = pushRecent(sys.recentNews, it.id);
  return it;
}
