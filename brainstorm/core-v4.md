# core v4 API(给 UI / main.ts)

所有数字在 `src/core/content.ts`;玩法逻辑在 `src/core/game.ts`;状态形状在 `src/core/state.ts`。
`SAVE_VERSION = 3`,旧存档(v1/v2)读到后直接开新局。

## 模型一句话
产出线(树→果园→果山→果城→果星→苹果之门)按 `rate × 数量 × (1+摇劲×上限)` 产苹果进**堆场**;
运输线(篮子→小推车→卡车→货船→飞机→传送门)的车从堆场装满、跑 `trip` 秒送到、空车回来。
送达 = 苹果(累计 82 亿通关)× 价值 = 果钱。`flow = min(produce, carry)`,较小的一边就是瓶颈。
堆场满了多出来的苹果浪费。3 个道具槽(gate)改乘数;`红绳`放大相邻槽。**手动 = 摇苹果树**(点/空格/以后手机摇):`shake(s)` 直接把苹果摇进堆场(`1 + 当前产出×dropSec`),并蓄**摇劲**(临时产出加成,会衰减);0.6 秒内连续摇出**连摇**,给价值加成。**老徐**(`helpers`)是自动摇树的帮工。

## State 里 UI 要读的字段
| 字段 | 含义 |
|---|---|
| `coins` | 果钱 |
| `delivered` | 累计送达;进度 = `progress(s)` = delivered/GOAL(82 亿) |
| `source.tier` / `route.tier` | 两条线当前最高档 0..5 |
| `source.units[t]` / `route.units[t]` | 第 t 档单位数量(画几棵树/几辆车) |
| `source.branch[t]` / `route.branch[t]` | 升到 t 档时选的分支 0/1(tier0 为 -1);名字 `SOURCE_TIERS[t].branches![b].name` |
| `gates[0..2]` | 槽里的道具 id 或 null;`gatesUnlocked` 已解锁的 id 列表 |
| `stock` | 堆场库存;满格比例 `stockFill(s)` 0..1 |
| `charge` | 摇劲 0..1(每次摇 +0.08,每秒衰减 25%);实际加成档 `chargeLevel(s,m)` = max(charge, 保底 floor, 老徐自动摇劲) |
| `combo` / `comboT` | 连摇数 / 剩余秒数(0.6 s 窗口,到 0 断) |
| `shakes` | 累计摇树次数(含被限速的) |
| `shakeTok` | 限速令牌(每秒回 8,最多 3);无令牌时 `shake` 返回 ok=false,不蓄劲不掉苹果 |
| `shakeRate` | 近期摇树频率(次/秒,2 s 滑动平均);`throughput.manual` 用它估算手摇产出 |
| `helpers` | 老徐数量(0..12),每位每秒自动摇 0.15 下 × `mods.auto` |
| `vehicles[]` | `{tier,w,phase,load}`,见下 |
| `wasted` | 累计浪费 |
| `newtonUntil` | `s.playSec < s.newtonUntil` 时手摇掉落和摇劲 ×2 |
| `wonAt` | 通关时的 playSec,未通关 null |
| `tierTimes.source[]/route[]` | 各次升档的 playSec(结局回顾) |
| `playSec` | 游戏内时钟(所有计时用它) |

### 车辆动画
每档最多 24 个独立 vehicle(`MAX_CONVOYS`),超过的合并成车队(`w` > 1,画一辆大一点的车/带数字)。
`phase`:0 = 停在堆场装货(`load/(w·cap·乘数)` 是装载率);0..0.5 = 去终点(位置 `phase×2`);
0.5 = 到达并结算;0.5..1 = 空车返回(位置 `(1-phase)×2`)。`vehicles` 的 tier 决定画什么车。
`fleetView(s)` 给每档汇总 `{tier,count,moving,load}`。

## 函数
```ts
// 读
throughput(s) → { produce, produceBase, auto, manual, shakeDrop, charge, carry, flow, value, income, stockMax, bottleneck: 'produce'|'carry'|'balanced' }
   // produce = 树产出×(1+摇劲) + auto(老徐摇下来的) + manual(shakeRate×shakeDrop);shakeDrop = 手摇一下掉多少个
mods(s) → { produce,value,cap,time,stock,fw,floor,shake,auto,combo }   // 分支+道具合成的乘数
appleValue(s)  comboMult(s)  chargeLevel(s,m)  helperRate(s,m)  dropOf(s,m,produceNow)  stockFill(s)  progress(s)  isWon(s)
era(s) = source.tier+route.tier (0..10)   eraMin(s) = min(两线档)  // 画面"时代"建议用 eraMin
nextHints(s) → { source:{unit:{cost,affordable,waitSec,flowPct}, tier|null}, route:{…}, helper:{cost,affordable,waitSec,flowPct}|null, suggest:'source'|'route'|null }
helperCost(s) → number|null(源线档位<1 未解锁或满 12 位为 null)  canBuyHelper(s)
unitCost(s,line,tier?)  tierCost(s,line)|null  canBuyUnit  canUpgradeTier  nextBranches(s,line)→[BranchDef,BranchDef]|null
preview(s, {kind:'unit',line,tier?} | {kind:'tier',line,branch} | {kind:'gate',slot,id} | {kind:'helper'}) →
   { ok, cost, affordable, flowDelta, flowPct, valueDelta, incomeDelta, incomePct, before: Throughput, after: Throughput }
fleetView(s)

// 写
buyUnit(s,line,tier?) → boolean
upgradeTier(s,line,branch:0|1) → { line, tier, branch, newGates: GateId[] } | null   // 要钱要选分支;送 1 个新档单位
setGate(s,slot,id|null) → boolean      // 免费;已在别的槽则互换;未解锁 false
buyHelper(s) → boolean                  // 雇一位老徐,价格 helperCost
shake(s) → { ok, dropped, combo }       // 手动摇树;ok=false 表示被限速(每秒最多 8 次有效);dropped = 掉进堆场的苹果数
click = shake                           // 别名,保留旧名
tick(s, dtSec, now?) → { deliveredNow, coinsNow, wastedNow }   // dt>120s 自动走闭式聚合
settle(s, awayMs) → { delivered, coins, seconds, capped }      // 离线,封顶 8h,100% 效率
claimEvent(s, kind) → { kind, apples, coins }                   // events.ts
```
`tick` 是确定性的,每帧传真实 dt 即可(内部 0.25s 步长)。回到页面先 `settle(s, Date.now()-s.lastSeen)`(<5 s 当普通 tick)。

## 事件(events.ts)
`EventKind = 'bird'|'newton'|'meteor'`;`nextEventGap(rnd)` 60–120 s;`pickEvent(isNight,rnd)`;
`EVENT_STAY_S` 停留秒数;点中后 `claimEvent`:鸟/流星一次性送 `EVENT_REWARD_S[kind]` 秒的 flow,牛顿给 10 s 手摇掉落/摇劲翻倍。

## 文案(copy.ts)
`ERA_TOAST.source[k]/route[k]`(升到第 k 档的 toast)、`GATE_UNLOCK_TOAST(name)`、`BOTTLENECK_TIP[bottleneck]`、`WASTE_TIP`、
`EVENT_TEXT[kind].appear/claim`、`SHAKE_TEXT[]`、`COMBO_TEXT[]`、`HELPER_TEXT{hired,none}`、`awayLine(minutes)`、`WIN_LINES`、`SEALED`(未到 12-24 的封存文案)、`EMPTY_SLOT_TIP`。
档名/分支名/道具名与笑话在 content.ts(`SOURCE_TIERS[t].name/unit/joke`,`ROUTE_TIERS`,`GATES[].name/joke`,`describeGate(g)`)。

## 移除的旧接口(UI/main 需要改)
- `copy.ts` 的 `PLACE_IDS/PLACES/UPGRADE_COPY/VISITORS/BITE_SCENES` 没了(orchard.ts、preview.ts 在用)
- `achievements.ts` 删除(ending.ts 在用);`news.ts` 删除
- `world.ts` 去掉 `harvestOn/harvestInfo/envMult`(main.ts 在用);`worldAt/DAY_S/SEASON_NAMES` 保留
- 旧 `rate/clickEV/UPGRADES/PROJECTS/BITES` 全部没了 → 用 `throughput(s)`、`shake`/`buyHelper`、`buyUnit/upgradeTier`

## 摇树改版(相对第一版的变化)
- 删除:`crank(s,turns)`、`CrankResult`、`FLY`、`State.flywheel/clicks/turns/flings`、`flywheelLevel`、画圈/"嗖"概念。
- 新增:`shake(s)`(+`click` 别名)、`ShakeResult{ok,dropped,combo}`、`SHAKE`/`HELPER`(content.ts)、`State.shakes/charge/shakeTok/shakeRate/helpers`、
  `helperCost/canBuyHelper/buyHelper`、`Action {kind:'helper'}`、`Hints.helper`、`Throughput.auto/manual/shakeDrop/charge`、`mods.shake/auto/combo`。
- 决策点:分支 小果园→**铁砂掌**(摇一下掉×2.5,摇劲×1.2)/密植;果山→**老徐的徒弟**(老徐×2)/梯田;道具 **摇树手套**(解锁 1:掉落×2,摇劲×1.15)、**号子**(解锁 3:连摇×3,掉落×1.4);果星**自转摇柄**=摇劲保底。
- 老徐:`HELPER.unlockTier=1`(源线 ≥ 果园),价格 `400×2.2^n`,上限 12,每位每秒 0.15 下。
- 摇一下掉落 `dropSec` 随档位递减(早期 ≈2.7 秒产出,后期 ≈0.8 秒),所以后期手动是调味。

## 平衡现状(`node scripts/sim.ts <cps>` 实测,贪心 bot,delay 1.5s,事件 0.7;摇树改版后)

| cps | 通关 | 时代切换(分钟,两线都到第 k 档) |
|---|---|---|
| 0 | 69.2 | 3.3 / 11.9 / 26.4 / 48.3 / 61.6 |
| 1 | 62.3 | 4.8 / 13.8 / 22.8 / 49.3 / 55.1 |
| 4 | 48.1 | 6.7 / 16.6 / 16.9 / 40.6 / 41.4 |

- 首次购买 ~10–14s,首辆新车 10–18s,首次换道具 ~8s;bot 前 8 分钟会雇 2–4 位老徐。
- 只扩一条线(`--policy=source|route`)200 分钟内通不了关;固定道具 `--gates=none` 130 分钟、`wax,wash,rush` 67、`juice,wash,rush` 80,自动搭配 60,差距 >10%。
- 已知偏差:两次"有意义购买"的最长间隔 ≈260–320 秒(目标 ≤90s 未达成);1cps 比 0cps 只快约 8%(堆场满时手摇被浪费,4cps 快约 25%);手摇多出的苹果在运力吃紧时 25–55% 被浪费。调参入口:`scripts/tune.ts`(PB/rho/tau/g/fw/late/tauLate/drop)+ `src/core/content.ts`。
