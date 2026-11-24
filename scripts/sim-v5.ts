// v5 平衡模拟:在 scripts/sim.ts 的贪心机器人之上接入 src/core/sys 的全部新系统
// (订单 / 虫眼 / 防囤腐烂 / 献果 / 季节 / 品种期望价),看通关时间与"最长无事可买间隔"。
//   node scripts/sim-v5.ts 1            (cps=1)
//   node scripts/sim-v5.ts 0 / 4 / -v   (其余参数同 sim.ts:--delay= --policy= --events= --seed= ...)
//   node scripts/sim-v5.ts --all        (cps 0/1/4 × 3 个种子,附验收判定)
import { GOAL } from '../src/core/constants.ts';
import { shake, throughput } from '../src/core/game.ts';
import { ROUTE_ERA } from '../src/core/content.ts';
import { SIM } from '../src/core/sys/constants.ts';
import { claimOrder, canFulfill, laoxuCrit, newSys, offerSys, onShakeRoll, tapLaoxuSys, tapPestSys, tickSys } from '../src/core/sys/state.ts';
import { seasonAt } from '../src/core/sys/season.ts';
import { decayLimit } from '../src/core/sys/decay.ts';
import { offerOpen } from '../src/core/sys/offer.ts';
import { parseArgs, play, print, type Opts, type Report, type SimHook } from './sim.ts';

function makeHook(noSlack = false): SimHook & { sys: ReturnType<typeof newSys> } {
  const sys = newSys();
  const x = { lvFinal: 0, critShakes: 0, slackS: 0, sodas: 0, helperActSum: 0, steps: 0, orderReward: 0, orderDone: 0, pestKilled: 0, pestBitten: 0, pestLost: 0, rot: 0, offerCoins: 0, offerApples: 0, seasonDelta: 0, income: 0, bagShakes: 0 };
  let shakeAcc = 0;
  const hook: SimHook & { sys: typeof sys } = {
    sys,
    shakeMul() {
      if (noSlack) return 1;
      const m = laoxuCrit(sys);
      if (m > 1) x.critShakes++;
      return m;
    },
    step(s, dt, c) {
      const th = throughput(s);
      const era = Math.min(s.source.tier, ROUTE_ERA[s.route.tier] ?? s.route.tier);
      x.income += c.res.coinsNow;

      // 季节价值(均值 1):对本步收入做 ±10% 修正
      const se = seasonAt(s.playSec);
      const adj = c.res.coinsNow * (se.value - 1);
      s.coins = Math.max(0, s.coins + adj);
      x.seasonDelta += adj;

      // 手摇产生的苹果:每次摇树抽一个苹果,按概率入篮
      shakeAcc += c.cps * dt;
      while (shakeAcc >= 1) {
        shakeAcc -= 1;
        onShakeRoll(sys, { playSec: s.playSec, era }, c.rnd);
        x.bagShakes++;
      }

      // 推进 sys:被动入篮 / 订单 / 虫眼 / 腐烂
      const target = c.target > 0 ? c.target : s.coins;
      const cold = s.source.tier >= 4 && s.source.branch[4] === 1; // 星树·粗壮(库存×3)
      const tk = tickSys(sys, dt, {
        playSec: s.playSec, era, sourceTier: s.source.tier, routeTier: s.route.tier, coins: s.coins,
        income: th.income, targetCost: target, coldStorage: cold, progress: s.delivered / GOAL,
        helperLevel: s.helperLevel, idleSec: c.cps > 0 ? 0 : s.playSec, eventOnScreen: false,
      }, c.rnd);
      s.helperAct = noSlack ? 1 : tk.helperAct;
      x.helperActSum += s.helperAct; x.steps++;
      if (sys.laoxu.mode === 'slack') x.slackS += dt;
      s.coins = Math.max(0, s.coins - tk.coinsLoss);
      for (const e of tk.events) {
        if (e.t === 'pest-bite') { x.pestBitten++; x.pestLost += e.lost; }
        if (e.t === 'rot') x.rot += e.spawned;
      }

      // 机器人点虫(cps0 的玩家不点)
      if (c.cps > 0) {
        for (const p of [...sys.pests.list]) {
          if (s.playSec < p.at) continue;
          if (c.rnd() < SIM.pestTapPerS * dt) {
            for (let k = 0; k < 3; k++) {
              const r = tapPestSys(sys, p.id, th.income);
              if (r.r === 'kill') { s.coins += r.reward; x.pestKilled++; break; }
              if (r.r === null) break;
            }
          }
        }
      }
      // 机器人看订单(cps0 不看)
      if (c.cps > 0 && c.rnd() < SIM.orderLookPerS * dt) {
        for (const o of [...sys.orders.list]) {
          if (!canFulfill(sys.bag, o)) continue;
          const r = claimOrder(sys, o.id, th.income);
          if (r.ok) { s.coins += r.reward; x.orderReward += r.reward; x.orderDone++; }
        }
      }

      // 献果:只献超过防囤线的部分;最后 offerRushS 秒献出手上全部
      if (offerOpen(s.source.tier, s.route.tier)) {
        const remain = th.flow > 0 ? (GOAL - s.delivered) / th.flow : Infinity;
        const limit = decayLimit(target, th.income);
        const W = remain < SIM.offerRushS ? s.coins : SIM.offerAboveLimit ? Math.max(0, s.coins - limit) : 0;
        if (W > 1) {
          const r = offerSys(sys, { sourceTier: s.source.tier, routeTier: s.route.tier }, W, s.coins, Math.max(1e-9, th.value));
          if (r) { s.coins -= r.spent; s.delivered += r.apples; x.offerCoins += r.spent; x.offerApples += r.apples; }
        }
      }
    },
    finish(s, rep) {
      rep.extra = {
        订单完成: x.orderDone, 订单奖励占收入百分比: x.income > 0 ? (100 * x.orderReward) / x.income : 0,
        虫消灭: x.pestKilled, 虫咬次数: x.pestBitten, 虫咬损失占收入百分比: x.income > 0 ? (100 * x.pestLost) / x.income : 0,
        烂果个数: x.rot, 献果次数: sys.offer.count, 献果送出苹果: x.offerApples, 季节修正占收入百分比: x.income > 0 ? (100 * x.seasonDelta) / x.income : 0,
        入篮次数: x.bagShakes, 老徐偷懒秒数: x.slackS, 老徐暴击摇树: x.critShakes, 老徐平均出工系数: x.steps ? x.helperActSum / x.steps : 1, 老徐偷懒次数: sys.laoxu.slacks,
      };
      x.lvFinal = s.helperLevel; (rep.extra as Record<string, number>).老徐最终等级 = x.lvFinal;
    },
  };
  return hook;
}

export function playV5(o: Opts, noSlack = false): Report {
  return play({ ...o, hook: makeHook(noSlack) });
}

const pass = (r: Report, cps: number) => (cps === 0 ? r.minutes <= 75 : cps === 1 ? r.minutes >= 55 && r.minutes <= 65 : cps >= 4 ? r.minutes >= 42 : true);

if (process.argv[1]?.endsWith('sim-v5.ts')) {
  const args = process.argv.slice(2);
  if (args.includes('--laoxu')) {
    // 老徐偷懒/打盹/暴击的净影响:同种子对比"全程出工(无偷懒无暴击)"与"完整状态机"
    for (const cps of [0, 1, 4]) {
      let a = 0, b = 0;
      for (const seed of [1, 2, 3]) {
        const o = { ...parseArgs([String(cps), `--seed=${seed}`]), cps };
        a += playV5(o, true).minutes;
        b += playV5(o, false).minutes;
      }
      console.log(`cps=${cps}: 全程出工 ${(a / 3).toFixed(1)} 分 → 完整老徐 ${(b / 3).toFixed(1)} 分  净影响 ${((b - a) / 3 >= 0 ? '+' : '')}${((b - a) / 3).toFixed(1)} 分`);
    }
  } else if (args.includes('--all')) {
    for (const cps of [0, 1, 4]) {
      const rows: string[] = [];
      let sum = 0;
      for (const seed of [1, 2, 3]) {
        const o = { ...parseArgs([String(cps), `--seed=${seed}`]), cps };
        const r = playV5(o);
        sum += r.minutes;
        rows.push(`seed${seed}: ${r.minutes.toFixed(1)}分 ${pass(r, cps) ? 'OK' : 'FAIL'} 最长无事可买${r.idleMaxS.toFixed(0)}s 有意义购买间隔${r.buyGapMaxS.toFixed(0)}s 浪费${r.wastedPct.toFixed(1)}%`);
      }
      const mean = sum / 3;
      const ok = pass({ minutes: mean } as Report, cps);
      console.log(`cps=${cps}  3 种子均值 ${mean.toFixed(1)} 分 ${ok ? 'OK' : 'FAIL'}(验收按均值;单局随事件 ±2 分)\n  ` + rows.join('\n  '));
    }
  } else {
    const o = parseArgs(args);
    const r = playV5(o);
    print(o, r);
    if (r.extra) console.log('sys 统计: ' + Object.entries(r.extra).map(([k, v]) => `${k}=${v.toFixed(v < 10 && v % 1 ? 2 : 0)}`).join(' '));
    console.log(`验收: ${pass(r, o.cps) ? 'OK' : 'FAIL'}  最长无事可买间隔 ${r.idleMaxS.toFixed(0)}s`);
  }
}
