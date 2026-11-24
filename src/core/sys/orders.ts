// 顾客订单:点单/加急单。无惩罚(过期只是顾客走了),奖励是几秒收入,总量 ≤ 总收入 3%。
// 订单消耗的是"珍藏篮"(varieties.Bag)里的样本苹果,不动经济里的库存。
import { ORDER } from './constants.ts';
import { APPLE_KINDS, VARIETIES, bagTotal, type AppleKind, type Bag } from './varieties.ts';
import { pickIndex, range, type Rnd } from './util.ts';

export interface Order {
  id: number;
  /** 要什么品种;'any' = 任意品种(不含毒苹果) */
  want: AppleKind | 'any';
  qty: number;
  rush: boolean;
  /** 出现/过期时刻(playSec) */
  createdAt: number;
  expiresAt: number;
  /** 顾客形象 0..customers-1(art 提供) */
  customer: number;
  /** 奖励 = rewardSec 秒当前收入(≥ floorCoins) */
  rewardSec: number;
}

export interface OrdersState {
  list: Order[];
  /** 下一张订单出现时刻 */
  nextAt: number;
  seq: number;
  done: number;
  expired: number;
  /** 累计奖励果钱(统计"订单收入占比") */
  rewardTotal: number;
}

export const newOrders = (): OrdersState => ({ list: [], nextAt: ORDER.unlockSec, seq: 0, done: 0, expired: 0, rewardTotal: 0 });

export type OrderEvent = { t: 'new'; order: Order } | { t: 'expire'; order: Order };

function qtyFor(want: AppleKind | 'any', era: number, rnd: Rnd): number {
  const r = want === 'any' ? ORDER.qty.any : ORDER.qty.kind;
  const base = Math.round(range(r, rnd));
  return base + Math.floor(era * ORDER.qtyPerEra);
}

/** 抽一个被点的品种:订单可点、era 解锁;青苹果是"订单专用",权重 ×grannyBoost */
function pickWant(era: number, rnd: Rnd): AppleKind {
  const kinds = APPLE_KINDS.filter((k) => VARIETIES[k].orderable && VARIETIES[k].minEra <= era);
  const w = kinds.map((k) => VARIETIES[k].weight * (k === 'granny' ? ORDER.grannyBoost : 1));
  return kinds[pickIndex(w, rnd)];
}

export function makeOrder(os: OrdersState, playSec: number, era: number, rnd: Rnd): Order {
  const rush = rnd() < ORDER.rushP;
  const want: AppleKind | 'any' = rnd() < ORDER.kindP ? pickWant(era, rnd) : 'any';
  const qty = qtyFor(want, era, rnd);
  return {
    id: ++os.seq,
    want,
    qty,
    rush,
    createdAt: playSec,
    expiresAt: playSec + (rush ? ORDER.rushStayS : ORDER.stayS),
    customer: Math.floor(rnd() * ORDER.customers),
    rewardSec: rush ? ORDER.rushRewardSec : ORDER.rewardSec,
  };
}

/** 推进到 playSec:过期的订单离开(无惩罚),到点出新单。 */
export function tickOrders(os: OrdersState, playSec: number, era: number, rnd: Rnd): OrderEvent[] {
  const ev: OrderEvent[] = [];
  const keep: Order[] = [];
  for (const o of os.list) {
    if (playSec >= o.expiresAt) {
      os.expired++;
      ev.push({ t: 'expire', order: o });
    } else keep.push(o);
  }
  os.list = keep;
  if (playSec < ORDER.unlockSec) return ev;
  const max = ORDER.maxActive[Math.max(0, Math.min(ORDER.maxActive.length - 1, era))];
  if (playSec >= os.nextAt) {
    if (os.list.length < max) {
      const o = makeOrder(os, playSec, era, rnd);
      os.list.push(o);
      ev.push({ t: 'new', order: o });
    }
    os.nextAt = playSec + range(ORDER.gapS, rnd);
  }
  return ev;
}

/** 篮子里够不够 */
export function canFulfill(bag: Bag, o: Order): boolean {
  if (o.want === 'any') return bagTotal(bag) >= o.qty;
  return (bag[o.want] ?? 0) >= o.qty;
}

/** 消耗篮子:any 单从数量最多的品种开始扣 */
function consume(bag: Bag, o: Order): void {
  if (o.want !== 'any') {
    bag[o.want] = (bag[o.want] ?? 0) - o.qty;
    return;
  }
  let need = o.qty;
  const kinds = APPLE_KINDS.filter((k) => (bag[k] ?? 0) > 0).sort((a, b) => (bag[b] ?? 0) - (bag[a] ?? 0));
  for (const k of kinds) {
    const take = Math.min(need, bag[k] ?? 0);
    bag[k] = (bag[k] ?? 0) - take;
    need -= take;
    if (need <= 0) break;
  }
}

export const orderReward = (o: Order, income: number): number => Math.max(ORDER.floorCoins, o.rewardSec * Math.max(0, income));

export interface FulfillResult {
  ok: boolean;
  /** 奖励果钱(调用方加到 coins) */
  reward: number;
  order?: Order;
}

/** 交付订单:够数就扣篮子、移除订单、给奖励 */
export function fulfillOrder(os: OrdersState, bag: Bag, id: number, income: number): FulfillResult {
  const i = os.list.findIndex((o) => o.id === id);
  if (i < 0) return { ok: false, reward: 0 };
  const o = os.list[i];
  if (!canFulfill(bag, o)) return { ok: false, reward: 0, order: o };
  consume(bag, o);
  os.list.splice(i, 1);
  os.done++;
  const reward = orderReward(o, income);
  os.rewardTotal += reward;
  return { ok: true, reward, order: o };
}

/** 玩家主动放弃(点 ×):顾客走了,无惩罚 */
export function dismissOrder(os: OrdersState, id: number): boolean {
  const i = os.list.findIndex((o) => o.id === id);
  if (i < 0) return false;
  os.list.splice(i, 1);
  return true;
}
