import { simulate } from './tune.ts';
import { sourcePerSec, SOURCE_IDS, UPGRADES } from '../src/core/game.ts';
for (const cps of [0.3, 1.5, 4]) {
  const r = simulate(cps, { mg: 1.05, bz: 0.0032, ca: 0.0021, cost: {}, per: {}, growth: {} });
  const p = sourcePerSec(r.s, cps);
  const sum = SOURCE_IDS.reduce((a, id) => a + p[id], 0);
  console.log(`cps ${cps} clear ${r.clear.toFixed(0)}m lv=${UPGRADES.map((u) => u.id + ':' + r.s.upgrades[u.id]).join(' ')}`);
  console.log('  ' + SOURCE_IDS.map((id) => `${id} ${(p[id] / sum * 100).toFixed(1)}%`).join('  '));
}
