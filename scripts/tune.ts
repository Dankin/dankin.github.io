// 调价格曲线:价格由几个参数生成(每档单位价 = 该档产量 × 回本秒数 PB·ρ^(k-1),升档价 = τ × 单位价),
// 随机局部搜索让 cps 0/1/4 的通关时间、时代切换时间贴近目标,同时惩罚"两次有意义购买间隔 >60s"。
//   node scripts/tune.ts [迭代次数=200] [PB,rho,tau,g,fw,late,tauLate 初值]   最后打印可贴进 content.ts 的数字
import { FLY, ROUTE_TIERS, SOURCE_TIERS } from '../src/core/content.ts';
import { play, type Opts } from './sim.ts';

const base = (cps: number): Opts => ({ cps, delay: 1.5, policy: 'balanced', gates: 'auto', events: 0.7, maxMin: 200, seed: 1, verbose: false });
const FW0 = [...FLY.maxByTier];
const SR = SOURCE_TIERS.map((t) => t.rate);
const RR = ROUTE_TIERS.map((t) => t.cap / t.trip);

/** p = [PB, rho, tau, g, fw, late, tauLate]:k≥4 的档回本再乘 late^(k-3)、升档系数乘 tauLate */
export function apply(p: number[]): void {
  const [PB, rho, tau, g, fw, late, tauLate] = p;
  let pb = PB;
  for (let k = 1; k <= 5; k++) {
    if (k > 1) pb *= rho;
    if (k >= 4) pb *= late;
    const tk = tau * (k >= 4 ? tauLate : 1);
    SOURCE_TIERS[k].baseCost = SR[k] * pb;
    SOURCE_TIERS[k].tierCost = SOURCE_TIERS[k].baseCost * tk;
    ROUTE_TIERS[k].baseCost = RR[k] * pb;
    ROUTE_TIERS[k].tierCost = ROUTE_TIERS[k].baseCost * tk * 1.05;
  }
  for (const t of [...SOURCE_TIERS, ...ROUTE_TIERS]) t.growth = g;
  FLY.maxByTier.splice(0, 6, ...FW0.map((x) => x * fw));
}

export const bakeText = (): string => {
  const r2 = (x: number) => { const e = Math.floor(Math.log10(x)); const m = 10 ** (e - 1); return Math.round(x / m) * m; };
  const a = (xs: number[]) => xs.map((x) => (x === 0 ? 0 : r2(x))).join(', ');
  return [
    `SOURCE baseCost [${a(SOURCE_TIERS.map((t) => t.baseCost))}]`,
    `SOURCE tierCost [${a(SOURCE_TIERS.map((t) => t.tierCost))}]`,
    `ROUTE  baseCost [${a(ROUTE_TIERS.map((t) => t.baseCost))}]`,
    `ROUTE  tierCost [${a(ROUTE_TIERS.map((t) => t.tierCost))}]`,
    `growth ${SOURCE_TIERS[1].growth}  fw [${FLY.maxByTier.map((x) => +x.toFixed(2)).join(', ')}]`,
  ].join('\n');
};

const GAPW = 1;
const ERA_T = [3, 10, 20, 33, 47];
function loss(p: number[]): { l: number; info: string } {
  apply(p);
  const r1 = play(base(1));
  const r0 = play(base(0));
  const r4 = play(base(4));
  let l = 0;
  for (let k = 1; k <= 5; k++) l += Math.pow(Math.log((r1.eras[k] ?? 300) / ERA_T[k - 1]), 2);
  l += 2 * Math.pow(Math.log(r1.minutes / 60), 2);
  l += Math.pow(Math.log(r0.minutes / 82), 2);
  l += Math.pow(Math.log(r4.minutes / 47), 2);
  const ex = r1.gaps.map((g) => Math.max(0, g / 60 - 1));
  l += GAPW * (ex.reduce((a, b) => a + b * b, 0) / Math.max(1, ex.length) * 3 + Math.pow(Math.max(0, r1.buyGapMaxS / 90 - 1), 2));
  return { l, info: `gap ${r1.buyGapMaxS.toFixed(0)}s(>60:${r1.gaps.filter((x) => x > 60).length}) 1cps ${r1.minutes.toFixed(1)} [${r1.eras.slice(1).map((x) => x?.toFixed(1)).join(' ')}]  0cps ${r0.minutes.toFixed(1)}  4cps ${r4.minutes.toFixed(1)}` };
}

if (process.argv[1]?.endsWith('tune.ts')) {
  const iters = +(process.argv[2] ?? 200);
  let p = [300, 2, 0.15, 1.1, 1, 1, 1];
  if (process.argv[3]) p = process.argv[3].split(',').map(Number);
  let cur = loss(p);
  console.log('start', cur.l.toFixed(3), cur.info);
  let seed = 7;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < iters; i++) {
    const q = [...p];
    const j = Math.floor(rnd() * q.length);
    q[j] *= Math.exp((rnd() - 0.5) * (i < iters / 2 ? 0.5 : 0.15));
    if (j === 3) q[j] = Math.min(1.5, Math.max(1.03, q[j]));
    r: { const r = loss(q); if (r.l < cur.l) { p = q; cur = r; console.log(`${i} loss ${r.l.toFixed(4)} p=${p.map((x) => +x.toFixed(3)).join(',')}  ${r.info}`); } }
  }
  apply(p);
  console.log('FINAL', p.map((x) => +x.toFixed(4)).join(','));
  console.log(bakeText());
}
