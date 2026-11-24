// 画面所需数据:把 State 翻成 Orchard 认得的 WorldView。
import { mods, stockFill, chargeLevel, type Throughput } from '../core/game.ts';
import { GATE_SLOTS, ROUTE_TIERS } from '../core/content.ts';
import { EMPTY_WORLD, type WorldView } from '../ui/orchard.ts';
import { worldAt } from '../core/world.ts';
import { app } from './ctx.ts';

// ───────────── 画面所需数据 ─────────────
export function buildWorld(th: Throughput): WorldView {
  const s = app.state;
  const m = mods(s);
  const rt = s.route;
  const w = worldAt(s.playSec);
  return {
    ...EMPTY_WORLD,
    srcTier: s.source.tier,
    srcUnits: s.source.units.slice(),
    srcBranch: s.source.branch.slice(),
    rtTier: rt.tier,
    rtVehicles: Math.max(1, Math.round(rt.units[rt.tier])),
    rtBranch: rt.branch[rt.tier],
    gates: s.gates.map((g) => (g === 'red' ? 'string' : g)),
    gateCan: s.gates.map((g) => g === null && s.gatesUnlocked.some((u) => !s.gates.includes(u))),
    gatesUnlocked: GATE_SLOTS,
    stock01: stockFill(s),
    produce: th.produce,
    carry: th.carry,
    shake: Math.min(1, chargeLevel(s, m)), // 摇劲
    combo: s.combo,
    perTrip: ROUTE_TIERS[rt.tier].cap * m.cap,
    // v5 新美术字段
    hour: (6 + w.dayPhase * 24) % 24, // dayPhase 0 日出(6 点)、0.25 正午、0.5 日落、0.75 午夜
    season: w.season,
    weather: w.weather,
    srcVariant: s.source.branch[s.source.tier] ?? 0,
    helpers: s.helperLevel,
    pests: s.sys.pests.list.filter((p) => s.playSec >= p.at).map((p) => ({ id: p.id, kind: p.kind, side: p.side, pos: p.pos })),
    orders: s.sys.orders.list.slice(0, 3).map((o) => ({ id: o.id, customer: o.customer, want: o.want, qty: o.qty, expiresIn: Math.max(0, o.expiresAt - s.playSec) })),
    rot: s.sys.rot.visual,
  };
}
