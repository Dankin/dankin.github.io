// 运输线 9 档调参:node scripts/sim-route.ts '{"1":{"cap":31,"tierCost":360},"3":{...}}' [cps...]
// 用 JSON 覆盖 ROUTE_TIERS[i] 的字段(只在本进程内生效),跑 sim(不含 sys),打印通关分钟。
import { ROUTE_TIERS } from '../src/core/content.ts';
import { parseArgs, play } from './sim.ts';

const ov = JSON.parse(process.argv[2] ?? '{}') as Record<string, Partial<(typeof ROUTE_TIERS)[number]>>;
for (const [i, o] of Object.entries(ov)) Object.assign(ROUTE_TIERS[+i], o);
const sc = Number(process.env.SCALE ?? 1);
if (sc !== 1) for (const t of ROUTE_TIERS.slice(1)) { t.baseCost *= sc; t.tierCost *= sc; }
const cpss = process.argv.slice(3).map(Number);
for (const cps of cpss.length ? cpss : [0, 1, 4]) {
  const r = play(parseArgs([String(cps)]));
  console.log(`cps${cps}: ${r.minutes.toFixed(1)}分 idle${r.idleMaxS.toFixed(0)}s gap${r.buyGapMaxS.toFixed(0)}s 升档等待[${r.tierWait.map((x) => (Number.isFinite(x) ? x.toFixed(0) : '-')).join(',')}]`);
}
