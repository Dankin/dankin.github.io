# core v4 API(给 UI / main.ts)

所有数字在 `src/core/content.ts`;玩法逻辑在 `src/core/game.ts`;状态形状在 `src/core/state.ts`。
`SAVE_VERSION = 3`,旧存档(v1/v2)读到后直接开新局。

## 模型一句话
产出线(树→果园→果山→果城→果星→苹果之门)按 `rate × 数量 × (1+飞轮)` 产苹果进**堆场**;
运输线(篮子→小推车→卡车→货船→飞机→传送门)的车从堆场装满、跑 `trip` 秒送到、空车回来。
送达 = 苹果(累计 82 亿通关)× 价值 = 果钱。`flow = min(produce, carry)`,较小的一边就是瓶颈。
堆场满了多出来的苹果浪费。3 个道具槽(gate)改乘数;`红绳`放大相邻槽。手动(点/画圈)给飞轮储能,转过头 = "嗖",连击加价值。

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
| `flywheel` | 飞轮储能 0..1(画转速);保底见 `mods(s).floor` → `flywheelLevel(s)` |
| `combo` / `comboT` | 连击数 / 剩余秒数(到 0 断) |
| `vehicles[]` | `{tier,w,phase,load}`,见下 |
| `wasted` | 累计浪费 |
| `flings` | 累计"嗖"次数 |
| `newtonUntil` | `s.playSec < s.newtonUntil` 时手动储能 ×2 |
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
throughput(s) → { produce, produceBase, carry, flow, value, income, stockMax, bottleneck: 'produce'|'carry'|'balanced' }
mods(s) → { produce,value,cap,time,stock,fw,floor }   // 分支+道具合成的乘数
appleValue(s)  comboMult(s)  flywheelLevel(s)  stockFill(s)  progress(s)  isWon(s)
era(s) = source.tier+route.tier (0..10)   eraMin(s) = min(两线档)  // 画面"时代"建议用 eraMin
nextHints(s) → { source:{unit:{cost,affordable,waitSec,flowPct}, tier|null}, route:{…}, suggest:'source'|'route'|null }
unitCost(s,line,tier?)  tierCost(s,line)|null  canBuyUnit  canUpgradeTier  nextBranches(s,line)→[BranchDef,BranchDef]|null
preview(s, {kind:'unit',line,tier?} | {kind:'tier',line,branch} | {kind:'gate',slot,id}) →
   { ok, cost, affordable, flowDelta, flowPct, valueDelta, incomeDelta, incomePct, before: Throughput, after: Throughput }
fleetView(s)

// 写
buyUnit(s,line,tier?) → boolean
upgradeTier(s,line,branch:0|1) → { line, tier, branch, newGates: GateId[] } | null   // 要钱要选分支;送 1 个新档单位
setGate(s,slot,id|null) → boolean      // 免费;已在别的槽则互换;未解锁 false
click(s) / crank(s, turns) → { flung, combo }   // crank 的 amount≈圈数
tick(s, dtSec, now?) → { deliveredNow, coinsNow, wastedNow }   // dt>120s 自动走闭式聚合
settle(s, awayMs) → { delivered, coins, seconds, capped }      // 离线,封顶 8h,100% 效率
claimEvent(s, kind) → { kind, apples, coins }                   // events.ts
```
`tick` 是确定性的,每帧传真实 dt 即可(内部 0.25s 步长)。回到页面先 `settle(s, Date.now()-s.lastSeen)`(<5 s 当普通 tick)。

## 事件(events.ts)
`EventKind = 'bird'|'newton'|'meteor'`;`nextEventGap(rnd)` 60–120 s;`pickEvent(isNight,rnd)`;
`EVENT_STAY_S` 停留秒数;点中后 `claimEvent`:鸟/流星一次性送 `EVENT_REWARD_S[kind]` 秒的 flow,牛顿给 10 s 储能翻倍。

## 文案(copy.ts)
`ERA_TOAST.source[k]/route[k]`(升到第 k 档的 toast)、`GATE_UNLOCK_TOAST(name)`、`BOTTLENECK_TIP[bottleneck]`、`WASTE_TIP`、
`EVENT_TEXT[kind].appear/claim`、`FLING_TEXT[]`、`awayLine(minutes)`、`WIN_LINES`、`SEALED`(未到 12-24 的封存文案)、`EMPTY_SLOT_TIP`。
档名/分支名/道具名与笑话在 content.ts(`SOURCE_TIERS[t].name/unit/joke`,`ROUTE_TIERS`,`GATES[].name/joke`,`describeGate(g)`)。

## 移除的旧接口(UI/main 需要改)
- `copy.ts` 的 `PLACE_IDS/PLACES/UPGRADE_COPY/VISITORS/BITE_SCENES` 没了(orchard.ts、preview.ts 在用)
- `achievements.ts` 删除(ending.ts 在用);`news.ts` 删除
- `world.ts` 去掉 `harvestOn/harvestInfo/envMult`(main.ts 在用);`worldAt/DAY_S/SEASON_NAMES` 保留
- 旧 `rate/clickEV/UPGRADES/PROJECTS/BITES` 全部没了 → 用 `throughput(s)`、`click/crank`、`buyUnit/upgradeTier`

## 平衡现状(`node scripts/sim.ts <cps>` 实测,贪心 bot,delay 1.5s,事件 0.7)

| cps | 通关 | 时代切换(分钟,两线都到第 k 档) |
|---|---|---|
| 0 | 79.6 | 2.2 / 9.1 / 22.3 / 43.5 / 59.7 |
| 1 | 61.6 | 1.8 / 7.1 / 18.6 / 33.6 / 47.1 |
| 4 | 46.5 | 1.5 / 5.6 / 13.4 / 24.7 / 34.3 |

- 首次购买 ~13s,首辆新车 ~13s,首次换道具 ~8s。
- 只扩一条线的 bot 240 分钟内通不了关(>>15% 慢)。
- 道具占比(cps1):打蜡 32%、洗果 18%、品牌 15%、红绳 14%、加急 7%…;固定一套道具通关 90–150 分钟,差距 >10%。
- 已知偏差:升档前的最长"无事可买"间隔 170–290 秒(目标 ≤60s 未达成,靠加购单位 / 事件 / 点按填充);时代 1 比目标 3 分钟早。调参入口:`scripts/tune.ts`(参数 PB/rho/tau/g/fw)+ `src/core/content.ts`。
