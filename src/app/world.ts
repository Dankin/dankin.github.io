// 画面所需数据:把 State 翻成 Orchard 认得的 WorldView。
import { mods, stockFill, chargeLevel, type Throughput } from '../core/game.ts';
import { GATE_SLOTS, ROUTE_TIERS } from '../core/content.ts';
import { EMPTY_WORLD, type WorldView } from '../ui/orchard.ts';
import { app } from './ctx.ts';

// ───────────── 画面所需数据 ─────────────
export function buildWorld(th: Throughput): WorldView {
  const s = app.state;
  const m = mods(s);
  const rt = s.route;
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
  };
}
