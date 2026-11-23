// v4 平衡模拟:贪心机器人从头玩到 82 亿。
//   node scripts/sim.ts [cps=1] [--delay=1.5] [--policy=balanced|source|route] [--gates=auto|none|a,b,c]
//                       [--events=0.7] [--max=240] [--seed=1] [-v] [--json]
// cps = 每秒点按次数(0 = 纯挂机)。delay = 够钱后多久才下手(模拟人的反应)。
import { GOAL } from '../src/core/constants.ts';
import { GATES, GATE_SLOTS, gateDef, ROUTE_TIERS, SOURCE_TIERS, type GateId } from '../src/core/content.ts';
import { EVENT_GAP_S, claimEvent, nextEventGap, pickEvent } from '../src/core/events.ts';
import {
  buyHelper, buyExpand, buyUnit, canBuyUnit, shake, nextBranches, preview, setGate, tick, throughput, tierCost, unitCost, upgradeTier,
  type Action, type LineId,
} from '../src/core/game.ts';
import { newState, type State } from '../src/core/state.ts';

export interface Opts {
  cps: number;
  delay: number;
  policy: 'balanced' | 'source' | 'route';
  gates: 'auto' | 'none' | GateId[];
  events: number;
  maxMin: number;
  seed: number;
  verbose: boolean;
}

export interface Report {
  minutes: number;
  won: boolean;
  tierUps: { line: LineId; tier: number; branch: string; min: number }[];
  /** 两条线都到第 k 档的分钟(k=1..5),用作"时代切换"时间 */
  eras: number[];
  firstBuy: number;
  firstVehicle: number;
  firstGate: number;
  idleMaxS: number;
  idleAtMin: number;
  /** 任意两次购买之间最长间隔(秒) */
  buyGapMaxS: number;
  /** 每次升档前离上一次有意义购买隔了多少秒(按升到的档位取最大) */
  tierWait: number[];
  buyGapAtMin: number;
  log: string[];
  /** 每次有意义购买(升档或 ≥2% 提升)距上一次的秒数 */
  gaps: number[];
  timeline: string;
  gatesUsed: Record<string, number>;
  branches: string[];
  wastedPct: number;
  finalFlow: number;
}

function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 软最小:让"只加一边"也有一点收益,机器人才不会卡在平衡点 */
const soft = (p: number, c: number) => Math.pow(Math.pow(p, -4) + Math.pow(c, -4), -0.25);

interface Cand {
  action: Action;
  line: LineId | null;
  cost: number;
  gain: number; // soft income 增量
  gainPct: number; // soft flow 相对增量
  tier: boolean;
}

function candidates(s: State, policy: Opts['policy']): Cand[] {
  const out: Cand[] = [];
  const lines: LineId[] = policy === 'balanced' ? ['source', 'route'] : policy === 'source' ? ['source'] : ['route'];
  if (policy !== 'route') {
    const p = preview(s, { kind: 'helper' });
    if (p.ok) {
      const sb = soft(p.before.produce, p.before.carry);
      const sa = soft(p.after.produce, p.after.carry);
      out.push({ action: { kind: 'helper' }, line: null, cost: p.cost, gain: sa * p.after.value - sb * p.before.value, gainPct: sa / sb - 1, tier: false });
    }
  }
  for (const line of lines) {
    const acts: { a: Action; tier: boolean }[] = [];
    for (let t = 0; t <= s[line].tier; t++) {
      acts.push({ a: { kind: 'unit', line, tier: t }, tier: false });
      acts.push({ a: { kind: 'expand', line, tier: t }, tier: false });
    }
    if (nextBranches(s, line)) for (const b of [0, 1] as const) acts.push({ a: { kind: 'tier', line, branch: b }, tier: true });
    for (const { a, tier } of acts) {
      const p = preview(s, a);
      if (!p.ok) continue;
      const sb = soft(p.before.produce, p.before.carry);
      const sa = soft(p.after.produce, p.after.carry);
      out.push({ action: a, line, cost: p.cost, gain: sa * p.after.value - sb * p.before.value, gainPct: sa / sb - 1, tier });
    }
  }
  return out;
}

function perms(ids: GateId[], k: number): (GateId | null)[][] {
  const res: (GateId | null)[][] = [];
  const rec = (cur: (GateId | null)[], used: Set<GateId>) => {
    if (cur.length === k) { res.push(cur); return; }
    for (const id of ids) if (!used.has(id)) rec([...cur, id], new Set([...used, id]));
    rec([...cur, null], used);
  };
  rec([], new Set());
  return res;
}

function bestGates(s: State, allowed: GateId[], goalFlow: boolean): (GateId | null)[] {
  const ids = s.gatesUnlocked.filter((g) => allowed.includes(g));
  let best = s.gates;
  let bestV = -1;
  const probe = { source: s.source, route: s.route, gates: [] as (GateId | null)[], charge: s.charge, combo: s.combo, helpers: s.helpers, shakeRate: s.shakeRate };
  for (const p of perms(ids, GATE_SLOTS)) {
    probe.gates = p;
    const th = throughput(probe);
    const v = goalFlow ? th.flow : th.income;
    if (v > bestV * 1.0000001) { bestV = v; best = p; }
  }
  return best;
}

export function play(o: Opts): Report {
  const s = newState(0);
  const rnd = rng(o.seed);
  const dt = 0.25;
  const rep: Report = {
    minutes: NaN, won: false, tierUps: [], eras: [], firstBuy: NaN, firstVehicle: NaN, firstGate: NaN,
    idleMaxS: 0, idleAtMin: 0, tierWait: [0, 0, 0, 0, 0, 0], buyGapMaxS: 0, buyGapAtMin: 0, log: [], gaps: [], timeline: '', gatesUsed: {}, branches: [], wastedPct: 0, finalFlow: 0,
  };
  const allowedGates: GateId[] = o.gates === 'auto' ? GATES.map((g) => g.id) : o.gates === 'none' ? [] : o.gates;
  let clickAcc = 0;
  let evT = nextEventGap(rnd) * 0.5;
  let affSince: number | null = null;
  let idleStart: number | null = null;
  let lastWorthy = 0;
  let lastBuyT = 0;
  let lastGateCheck = -99;
  let lastMinMark = 0;
  let gateSig = '';
  let delivered0 = 0, wasted0 = 0;
  const gateTime: Record<string, number> = {};
  const eraSeen = new Set<number>();
  const maxS = o.maxMin * 60;
  for (let step = 0; s.playSec < maxS; step++) {
    // 手动
    if (o.cps > 0) {
      clickAcc += o.cps * dt;
      while (clickAcc >= 1) { shake(s); clickAcc -= 1; }
    }
    // 事件
    evT -= dt;
    if (evT <= 0) {
      evT = nextEventGap(rnd);
      const kind = pickEvent(false, rnd);
      if (rnd() < o.events) claimEvent(s, kind);
    }
    tick(s, dt);
    const t = s.playSec;
    for (const g of s.gates) if (g) gateTime[g] = (gateTime[g] ?? 0) + dt;

    if (s.delivered >= GOAL) { rep.won = true; rep.minutes = t / 60; break; }

    // 每 0.5 秒决策一次
    if (step % 2 !== 0) continue;
    const th = throughput(s);
    // 道具:每 4 秒或有新解锁时重排;离终点近(<6 分钟)只看吞吐
    if (t - lastGateCheck >= 4 && o.gates !== 'none' && t >= 8) {
      lastGateCheck = t;
      const left = (GOAL - s.delivered) / Math.max(1, th.flow);
      const want = bestGates(s, allowedGates, left < 360);
      const sig = want.join(',');
      if (sig !== s.gates.join(',')) {
        want.forEach((g, i) => setGate(s, i, g));
        if (Number.isNaN(rep.firstGate)) rep.firstGate = t;
        if (sig !== gateSig && rep.gatesUsed) gateSig = sig;
      }
    }
    // 购买
    const cs = candidates(s, o.policy);
    const inc = Math.max(1e-9, th.income);
    const score = (c: Cand) => (c.gain <= 0 ? Infinity : Math.max(0, (c.cost - s.coins) / inc) + c.cost / c.gain);
    let best: Cand | null = null;
    for (const c of cs) if (!best || score(c) < score(best)) best = c;
    const worthy = cs.some((c) => c.cost <= s.coins && (c.tier || c.action.kind === 'expand' || c.gainPct >= 0.03));
    if (worthy) {
      lastWorthy = t;
      if (idleStart !== null) idleStart = null;
    } else {
      if (idleStart === null) idleStart = lastWorthy;
      const idle = t - idleStart;
      if (o.verbose && Math.abs(idle - 90) < 0.3) rep.log.push(`${(t / 60).toFixed(1)}m IDLE90 coins ${s.coins.toExponential(1)} inc ${th.income.toExponential(1)} next ${cs.filter((c) => c.tier || c.action.kind === 'expand' || c.gainPct >= 0.03).map((c) => `${c.action.kind}${(c.action as any).line ?? ''}${(c.action as any).tier ?? ''}:${c.cost.toExponential(1)}`).join(' ')} bn ${th.bottleneck}`);
      if (idle > rep.idleMaxS) { rep.idleMaxS = idle; rep.idleAtMin = t / 60; }
    }
    if (best && best.cost <= s.coins && score(best) < Infinity) {
      if (affSince === null) affSince = t;
      if (t - affSince >= o.delay) {
        const a = best.action;
        let ok = false;
        if (a.kind === 'unit') {
          const before = s.vehicles.length;
          ok = buyUnit(s, a.line, a.tier);
          if (ok && a.line === 'route' && s.vehicles.length > before && Number.isNaN(rep.firstVehicle)) rep.firstVehicle = t;
        } else if (a.kind === 'expand') {
          ok = buyExpand(s, a.line, a.tier);
        } else if (a.kind === 'helper') {
          ok = buyHelper(s);
        } else if (a.kind === 'tier') {
          const L = s[a.line];
          const names = nextBranches(s, a.line)!;
          ok = upgradeTier(s, a.line, a.branch) !== null;
          if (ok) {
            rep.tierUps.push({ line: a.line, tier: L.tier, branch: names[a.branch].name, min: t / 60 });
            rep.branches.push(`${a.line === 'source' ? SOURCE_TIERS[L.tier].name : ROUTE_TIERS[L.tier].name}→${names[a.branch].name}`);
            const e = Math.min(s.source.tier, s.route.tier);
            if (e > 0 && !eraSeen.has(e)) { eraSeen.add(e); rep.eras[e] = t / 60; }
            lastGateCheck = -99;
          }
        }
        if (ok) {
          if (Number.isNaN(rep.firstBuy)) rep.firstBuy = t;
          if (o.verbose) rep.log.push(`${(t / 60).toFixed(1)}m ${a.kind === 'unit' ? `unit ${a.line} t${a.tier} x${s[a.line].units[a.tier ?? 0]}` : a.kind === 'tier' ? `TIER ${a.line}` : a.kind === 'helper' ? `helper x${s.helpers}` : a.kind === 'expand' ? `EXPAND ${a.line} t${a.tier} #${s[a.line].ext[a.tier ?? 0]}` : ''} cost ${best.cost.toExponential(1)} +${(best.gainPct * 100).toFixed(0)}% inc/s ${th.income.toExponential(1)}`);
          if (best.tier || a.kind === 'expand' || best.gainPct >= 0.03) {
            const gap = t - lastBuyT;
            if (a.kind === 'tier') { const nt = s[a.line].tier; rep.tierWait[nt] = Math.max(rep.tierWait[nt], gap); }
            rep.gaps.push(gap);
            if (gap > rep.buyGapMaxS) { rep.buyGapMaxS = gap; rep.buyGapAtMin = t / 60; }
            lastBuyT = t;
          }
          affSince = null;
        }
      }
    } else affSince = null;

    // 每分钟记一格瓶颈
    if (t - lastMinMark >= 60) {
      lastMinMark = t;
      rep.timeline += th.bottleneck === 'produce' ? 'P' : th.bottleneck === 'carry' ? 'C' : '=';
    }
    delivered0 = s.delivered; wasted0 = s.wasted;
  }
  if (!rep.won) rep.minutes = s.playSec / 60;
  rep.wastedPct = (100 * wasted0) / Math.max(1, delivered0 + wasted0);
  rep.finalFlow = throughput(s).flow;
  if (!rep.won && process.env.SIMDBG) for (const c of candidates(s, o.policy)) console.log("CAND", JSON.stringify(c.action), c.cost.toExponential(2), c.gain.toExponential(2), c.gainPct.toFixed(4));
  if (!rep.won && process.env.SIMDBG) console.log("STATE", JSON.stringify({ coins: s.coins, src: s.source, route: s.route, gates: s.gates, th: throughput(s) }));
  const total = Object.values(gateTime).reduce((a, b) => a + b, 0) || 1;
  for (const [g, v] of Object.entries(gateTime)) rep.gatesUsed[gateDef(g as GateId).name] = Math.round((100 * v) / total);
  return rep;
}

export function parseArgs(argv: string[]): Opts {
  const o: Opts = { cps: 1, delay: 1.5, policy: 'balanced', gates: 'auto', events: 0.7, maxMin: 240, seed: 1, verbose: false };
  for (const a of argv) {
    if (a === '-v') o.verbose = true;
    else if (a.startsWith('--delay=')) o.delay = +a.slice(8);
    else if (a.startsWith('--policy=')) o.policy = a.slice(9) as Opts['policy'];
    else if (a.startsWith('--gates=')) { const g = a.slice(8); o.gates = g === 'auto' || g === 'none' ? g : (g.split(',') as GateId[]); }
    else if (a.startsWith('--events=')) o.events = +a.slice(9);
    else if (a.startsWith('--max=')) o.maxMin = +a.slice(6);
    else if (a.startsWith('--seed=')) o.seed = +a.slice(7);
    else if (!a.startsWith('-') && !Number.isNaN(+a)) o.cps = +a;
  }
  return o;
}

const fm = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');

function print(o: Opts, r: Report) {
  const gname = o.gates === 'auto' ? 'auto' : o.gates === 'none' ? 'none' : o.gates.join(',');
  console.log(`cps=${o.cps} delay=${o.delay}s policy=${o.policy} gates=${gname} events=${o.events}`);
  console.log(`${r.won ? '通关' : '未通关(超时)'} 总用时 ${fm(r.minutes)} 分钟`);
  const tu = r.eras.map((m, i) => (i > 0 ? `${i}:${fm(m)}` : '')).filter(Boolean).join('  ');
  console.log(`时代切换(两线都到第k档)分钟: ${tu || '—'}`);
  console.log(`首次购买 ${fm(r.firstBuy)}s  首辆新车 ${fm(r.firstVehicle)}s  首次换道具 ${fm(r.firstGate)}s`);
  console.log(`有意义购买(升档/扩建/≥3%提升)之间最长间隔 ${fm(r.buyGapMaxS)}s (第 ${fm(r.buyGapAtMin)} 分钟)  [目标≤90s]  |  最长无事可买(购买力) ${fm(r.idleMaxS)}s  浪费 ${r.wastedPct.toFixed(1)}%`);
  console.log(`升档前最长等待(第1..5档,秒): ${r.tierWait.slice(1).map((x) => x.toFixed(0)).join(' / ')}`);
  console.log(`瓶颈(每分钟 P=产出不够 C=运力不够 =平衡): ${r.timeline}`);
  console.log(`道具使用时间占比: ${Object.entries(r.gatesUsed).map(([k, v]) => `${k}${v}%`).join(' ')}`);
  console.log(`分支: ${r.branches.join(' | ')}`);
  if (o.verbose && process.argv.includes('--buys')) for (const l of r.log) console.log('  ' + l);
  if (o.verbose) for (const t of r.tierUps) console.log(`  ${fm(t.min)}m ${t.line} → ${t.tier} (${t.branch})`);
}

if (process.argv[1]?.endsWith('sim.ts')) {
  const args = process.argv.slice(2);
  const o = parseArgs(args);
  const r = play(o);
  if (args.includes('--json')) console.log(JSON.stringify({ minutes: r.minutes, eras: r.eras }));
  else print(o, r);
}
void EVENT_GAP_S; void canBuyUnit; void tierCost; void unitCost;
