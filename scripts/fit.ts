// 逐档拟合价格:node scripts/fit.ts [迭代=14]
// 每档有两个旋钮:单位价倍率 pb[k](秒,单位价=该档每秒产出×pb)、升档价系数 tau[k](升档价=单位价×tau)。
// 不动点迭代:cps1 的第 k 次时代切换比目标晚就把 tau[k] 调小,通关比目标晚就把 pb 调小。结果打印成可贴进 content.ts 的数字。
import { SHAKE, ROUTE_TIERS, SOURCE_TIERS } from '../src/core/content.ts';
import { play } from './sim.ts';

const SR = SOURCE_TIERS.map((t) => t.rate);
const RR = ROUTE_TIERS.map((t) => t.cap / t.trip);
const DROP0 = [1, 0.74, 0.57, 0.46, 0.37, 0.31];
const ERA_T = [0, 3, 10, 20, 33, 47];
const END_T = 62;

export interface Fit { pb: number[]; tau: number[]; g: number; drop: number; drop0: number }
export function applyFit(f: Fit): void {
  for (let k = 1; k <= 5; k++) {
    SOURCE_TIERS[k].baseCost = SR[k] * f.pb[k];
    SOURCE_TIERS[k].tierCost = SOURCE_TIERS[k].baseCost * f.tau[k];
    ROUTE_TIERS[k].baseCost = RR[k] * f.pb[k];
    ROUTE_TIERS[k].tierCost = ROUTE_TIERS[k].baseCost * f.tau[k] * 1.05;
    SOURCE_TIERS[k].growth = f.g;
    ROUTE_TIERS[k].growth = f.g;
  }
  SHAKE.dropSec.splice(0, 6, ...DROP0.map((x) => x * f.drop));
  if (f.drop0) SHAKE.dropSec[0] = f.drop0;
}
const run = (cps: number) => play({ cps, delay: 1.5, policy: 'balanced', events: 0.7, maxMin: 240, seed: 1, verbose: false });

if (process.argv[1]?.endsWith('/fit.ts') || process.argv[1] === 'scripts/fit.ts') {
  const iters = Number(process.argv[2] ?? 14);
  const TW = Number(process.env.TW ?? 60);
  const TAU = Number(process.env.TAU ?? 1.4);
  const f: Fit = {
    pb: [0, 370, 380, 3700, 4600, 5000],
    tau: process.env.TAUS ? [0, ...process.env.TAUS.split(",").map(Number)] : [0, TAU, TAU, TAU, TAU, TAU],
    g: Number(process.env.G ?? 1.16), drop: Number(process.env.DROP ?? 1.4), drop0: 0,
  };
  for (let it = 0; it < iters; it++) {
    applyFit(f);
    const r = run(1);
    const e = r.eras;
    console.log(it, 'end', r.minutes.toFixed(1), 'eras', e.slice(1).map((x) => x?.toFixed(1)).join('/'), 'gap', r.buyGapMaxS.toFixed(0), 'idle', r.idleMaxS.toFixed(0), 'pb', f.pb.slice(1).map((x) => x.toFixed(0)).join(','), 'tau', f.tau.slice(1).map((x) => x.toFixed(2)).join(','), 'tw', r.tierWait.slice(1).map((x) => x.toFixed(0)).join(','));
    let L = 0;
    for (let k = 1; k <= 5; k++) if (e[k] != null) L = k;
    for (let k = 1; k <= Math.min(5, L + 1); k++) {
      const a0 = k === 1 ? 0 : (e[k - 1] as number);
      let dur: number, want: number;
      if (k < 5 && k <= L) { dur = (e[k] as number) - a0; want = ERA_T[k] - ERA_T[k - 1]; }
      else { dur = r.minutes - a0; want = END_T - ERA_T[k - 1]; }
      dur = Math.max(0.3, dur);
      f.pb[k] *= Math.min(2, Math.max(0.5, Math.pow(want / dur, 0.8)));
      if (TW > 0 && r.tierWait[k] > 0) f.tau[k] = Math.min(8, Math.max(0.02, f.tau[k] * Math.min(1.6, Math.max(0.6, Math.pow(TW / r.tierWait[k], 0.7)))));
    }
  }
  applyFit(f);
  console.log(JSON.stringify(f));
  for (const cps of [0, 1, 4]) { const r = run(cps); console.log('cps', cps, r.minutes.toFixed(1), r.eras.slice(1).map((x) => x?.toFixed(1)).join('/'), 'gap', r.buyGapMaxS.toFixed(0)); }
}
