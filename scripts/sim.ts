// 数值模拟:贪心玩家(每次买"回本最快"的升级,够买就买项目)。
// 用法: node scripts/sim.ts [每秒点击数=1.5] [最长小时=6] ; 环境变量 GROWTH=1.17 覆盖所有升级的价格增长率
import { GOAL } from '../src/core/constants.ts';
import { BITES, PROJECTS, WITCH_SKIP_S, biteUnlocked, bite, STAGES, UPGRADES, addApples, buy, buyProject, canBuy, clickEV, cost, goldRate, isUnlocked, projectUnlocked, rate, stageIndex, type UpgradeId } from '../src/core/game.ts';
import { newState } from '../src/core/state.ts';

const cps = Number(process.argv[2] ?? 1.5);
const maxH = Number(process.argv[3] ?? 6);
const g = Number(process.env.GROWTH ?? 0);
if (g) for (const u of UPGRADES) u.growth = g;
// UPG='{"shaker":{"baseCost":1e5,"perSec":100}}' 逐项覆盖
if (process.env.UPG) for (const [id, o] of Object.entries(JSON.parse(process.env.UPG))) Object.assign(UPGRADES.find((u) => u.id === id)!, o);
// 计时型项目的平均加成(只在对应项目购买后计入):万有引力 3s/15s=+20%,最美的苹果约 +25%,发布会 +20%
const avgProj = (s: ReturnType<typeof newState>) => (s.projects.gravity ? 1.2 : 1) * (s.projects.fairest ? 1.25 : 1) * (s.projects.cook ? (s.projects.onemore ? 1.4 : 1.2) : 1);

const s = newState(0);
const income = () => (cps * clickEV(s) + rate(s)) * avgProj(s);
const DT = 0.25;
const marks: string[] = [];
const snaps: string[] = [];
let lastStage = 0;
let lastBuy = 0;
const gaps: Array<[number, number, string]> = [];
const note = (t: number, what: string) => { gaps.push([t - lastBuy, t, what]); lastBuy = t; };
const fmtT = (t: number) => `${Math.floor(t / 60)}分${String(Math.round(t % 60)).padStart(2, '0')}秒`;
const SNAP = [2, 5, 10, 20, 35, 50, 75, 100];

for (let t = 0; t < maxH * 3600; t += DT) {
  addApples(s, income() * DT);
  for (let guard = 0; guard < 80; guard++) {
    for (const p of PROJECTS) if (!s.projects[p.id] && projectUnlocked(s, p.id) && p.cost <= income() * 150) { buyProject(s, p.id); note(t, p.name); if (p.id === 'witch' && s.projects.witch) { s.witchUsed = true; addApples(s, rate(s) * WITCH_SKIP_S); } }
    if (biteUnlocked(s) && BITES[s.bites].cost <= income() * 400) { bite(s); note(t, '禁果'); }
    let best: UpgradeId | null = null;
    let bestScore = Infinity;
    const base = income();
    for (const u of UPGRADES) {
      if (!isUnlocked(s, u.id)) continue;
      if (u.id === 'breed' && goldRate(s) >= 0.2) continue;
      s.upgrades[u.id]++;
      const d = income() - base;
      s.upgrades[u.id]--;
      if (d <= 0) continue;
      const score = cost(u, s.upgrades[u.id]) / d;
      if (score < bestScore) { bestScore = score; best = u.id; }
    }
    if (best && canBuy(s, best)) { buy(s, best); note(t, best); } else break;
  }
  const st = stageIndex(s.delivered);
  if (st !== lastStage) { lastStage = st; marks.push(`第 ${st + 1} 期「${STAGES[st].name}」 ${fmtT(t)}  收入 ${income().toExponential(2)}/s`); }
  for (const m of SNAP) if (Math.abs(t - m * 60) < DT / 2) snaps.push(`  ${m}分钟: 累计 ${s.delivered.toExponential(2)}  收入 ${income().toExponential(2)}/s`);
  if (s.delivered >= GOAL) { marks.push(`通关 ${fmtT(t)}`); break; }
}
console.log(`点击 ${cps}/s, growth ${g || '默认'}`);
console.log(marks.join('\n'));
console.log(snaps.join('\n'));
console.log('禁果', s.bites);
const top = [...gaps].sort((a, b) => b[0] - a[0]).slice(0, 8).map(([g, t, w]) => `${fmtT(t)} 买「${w}」前空窗 ${Math.round(g)}秒`);
console.log('最长空窗:\n  ' + top.join('\n  '));
const byWin = (a: number, b: number) => Math.max(0, ...gaps.filter(([, t]) => t >= a * 60 && t < b * 60).map(([g]) => g));
console.log('各时段最长空窗(秒):', [[0, 5], [5, 15], [15, 30], [30, 60], [60, 90], [90, 130]].map(([a, b]) => `${a}-${b}分:${Math.round(byWin(a, b))}`).join('  '));
console.log('升级', JSON.stringify(s.upgrades), '项目', JSON.stringify(s.projects));
if (s.delivered < GOAL) console.log(`未通关,累计 ${s.delivered.toExponential(2)}`);
