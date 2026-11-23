// 随机搜索:调升级价格/产出,使通关约 115 分钟、各期时间合理、没有长空窗。node scripts/tune.ts [次数]
import { GOAL } from '../src/core/constants.ts';
import * as G from '../src/core/game.ts';
import { newState } from '../src/core/state.ts';
const { tuning, sourcePerSec, SOURCE_IDS, BITES, PROJECTS, WITCH_SKIP_S, biteUnlocked, bite, STAGES, UPGRADES, addApples, buy, buyProject, canBuy, clickEV, cost, goldRate, isUnlocked, projectUnlocked, rate, stageIndex } = G;

const DEF = UPGRADES.map((u) => ({ ...u }));
export interface Cfg { mg: number; bz: number; ca: number; cost: Record<string, number>; per: Record<string, number>; growth: Record<string, number> }
export function simulate(cps: number, cfg: Cfg) {
  UPGRADES.forEach((u, i) => Object.assign(u, DEF[i], { baseCost: DEF[i].baseCost * (cfg.cost[u.id] ?? 1), perSec: DEF[i].perSec ? DEF[i].perSec! * (cfg.per[u.id] ?? 1) : undefined, growth: cfg.growth[u.id] ?? DEF[i].growth }));
  tuning.breeze = cfg.bz; tuning.clickAuto = cfg.ca;
  const s = newState(0);
  const income = () => (cps * clickEV(s) + rate(s)) * ((s.projects.gravity ? 1.2 : 1) * (s.projects.fairest ? 1.25 : 1) * (s.projects.cook ? (s.projects.onemore ? 1.4 : 1.2) : 1));
  const stageT: number[] = [0];
  let lastBuy = 0, last = 0;
  const gaps: Array<[number, number]> = [];
  const note = (t: number) => { gaps.push([t - lastBuy, t]); lastBuy = t; };
  const DT = 0.5;
  let clear = Infinity;
  for (let t = 0; t < 4 * 3600; t += DT) {
    addApples(s, income() * DT);
    for (let guard = 0; guard < 60; guard++) {
      for (const p of PROJECTS) if (!s.projects[p.id] && projectUnlocked(s, p.id) && p.cost <= income() * 150) { buyProject(s, p.id); note(t); if (p.id === 'witch') { s.witchUsed = true; addApples(s, rate(s) * WITCH_SKIP_S); } }
      if (biteUnlocked(s) && BITES[s.bites].cost <= income() * 400) { bite(s); note(t); }
      let best: string | null = null, bs = Infinity;
      const base = income();
      for (const u of UPGRADES) {
        if (!isUnlocked(s, u.id)) continue;
        if (u.id === 'breed' && goldRate(s) >= 0.2) continue;
        s.upgrades[u.id]++; const d = income() - base; s.upgrades[u.id]--;
        if (d <= 0) continue;
        const sc = cost(u, s.upgrades[u.id]) / d;
        if (sc < bs) { bs = sc; best = u.id; }
      }
      if (best && canBuy(s, best as any)) { buy(s, best as any); note(t); } else break;
    }
    const st = stageIndex(s.delivered);
    while (last < st) { last++; stageT[last] = t / 60; }
    if (s.delivered >= GOAL) { clear = t / 60; break; }
  }
  return { stageT, clear, gaps, s };
}
export const TARGET = [0, 1, 4.5, 12, 32, 72];
export function score(cfg: Cfg): { sc: number; info: string } {
  const a = simulate(1.5, cfg), b = simulate(0.3, cfg), c = simulate(4, cfg);
  let sc = 0;
  for (let i = 1; i < 6; i++) sc += Math.abs(Math.log(((a.stageT[i] ?? 400) + 0.01) / TARGET[i])) * 3;
  sc += Math.abs(Math.log(a.clear / 115)) * 8;
  sc += Math.max(0, Math.log(b.clear / 135)) * 5 + Math.max(0, Math.log(c.clear / 85)) * 3 * (c.clear < 85 ? 1 : 0);
  // 空窗惩罚:前 15 分钟 >20 秒,之后 >45 秒
  for (const [g, t] of a.gaps) { const lim = t < 900 ? 20 : 45; if (g > lim) sc += (g - lim) / 30; }
  for (const u of UPGRADES) { const lv = a.s.upgrades[u.id]; if (lv < 4) sc += (4 - lv) * 2; }
  // 来源占比:通关时每个组件都应有可观的贡献(目标 ≥ 7%,点击 ≥ 8%(1.5 次/秒),微风 ≤ 22%)
  const p = sourcePerSec(a.s, 1.5); const tot = SOURCE_IDS.reduce((x, id) => x + p[id], 0);
  const share = Object.fromEntries(SOURCE_IDS.map((id) => [id, p[id] / tot])) as Record<string, number>;
  for (const id of SOURCE_IDS) { const lo = id === 'click' ? 0.08 : 0.07; if (share[id] < lo) sc += (lo - share[id]) * 80; }
  if (share.breeze > 0.22) sc += (share.breeze - 0.22) * 80;
  return { sc, info: `share=${SOURCE_IDS.map((id) => (share[id] * 100).toFixed(0)).join('/')} ` + `st=${a.stageT.map((x) => x.toFixed(1)).join('/')} clear=${a.clear.toFixed(0)}|${b.clear.toFixed(0)}|${c.clear.toFixed(0)} lv=${Object.values(a.s.upgrades).join(',')} maxgap=${Math.round(Math.max(...a.gaps.map((x) => x[0])))}` };
}
if (process.argv[1]?.endsWith('tune.ts')) {
  const N = Number(process.argv[2] ?? 150);
  const rnd = (lo: number, hi: number) => Math.exp(Math.log(lo) + Math.random() * (Math.log(hi) - Math.log(lo)));
  const ids = ['gardener', 'tractor', 'shaker', 'drone', 'express', 'cloud'];
  let best: { sc: number; cfg: Cfg; info: string } | null = null;
  const mk = (): Cfg => ({ mg: 1.05, bz: 0.002 + Math.random() * 0.004, ca: 0.0005 + Math.random() * 0.004, cost: Object.fromEntries(ids.map((i) => [i, i === 'cloud' ? rnd(0.15, 2) : rnd(0.5, 8)])), per: Object.fromEntries(ids.map((i) => [i, rnd(0.3, 1.5)])), growth: Object.fromEntries(ids.map((i) => [i, 1.2 + Math.random() * 0.08])) });
  for (let i = 0; i < N; i++) {
    let cfg: Cfg;
    if (best && Math.random() < 0.7) {
      cfg = JSON.parse(JSON.stringify(best.cfg));
      cfg.bz = Math.min(0.008, Math.max(0.0015, cfg.bz * rnd(0.85, 1.18))); cfg.ca = Math.min(0.01, Math.max(0.0003, cfg.ca * rnd(0.8, 1.25)));
      for (const id of ids) { cfg.cost[id] = Math.min(id === 'cloud' ? 2.5 : 12, cfg.cost[id] * rnd(0.8, 1.25)); cfg.per[id] *= rnd(0.85, 1.18); cfg.growth[id] = Math.min(1.3, Math.max(1.18, cfg.growth[id] + (Math.random() - 0.5) * 0.015)); }
    } else cfg = mk();
    const r = score(cfg);
    if (!best || r.sc < best.sc) { best = { ...r, cfg }; console.log(i, r.sc.toFixed(2), r.info); }
  }
  console.log(JSON.stringify(best!.cfg, (k, v) => (typeof v === 'number' ? Number(v.toPrecision(3)) : v)));
}
