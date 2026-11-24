# src/core/sys:系统层(纯函数,无 DOM / bus / game.ts 依赖)

所有数值常量在 `constants.ts`。随机数一律传 `rnd: () => number`(测试用 `mulberry32(seed)`,见 `util.ts`)。
sys 不直接改 State 的数值字段:需要加/扣果钱时返回数字,由 eng-app 改 `s.coins` / `s.delivered`。

## 模块

| 文件 | 内容 |
|---|---|
| `varieties.ts` | 15 个品种 `APPLE_KINDS`(与 `src/content/varieties.ts` 一致),4 状态 `APPLE_STATES`(fresh/ripe/wormy/shiny)。`rollApple(rnd, ctx)→{kind,state,value,noStock}`,value 以"期望 = 1"归一;`bagAdd/bagTotal` 管订单用的小篮子 |
| `season.ts` | `seasonAt(playSec)→{season,night,weather,value,pest,stateMul}`(接 `core/world.ts` 昼夜/季节),`appleCtxAt` |
| `orders.ts` | 顾客点单/加急单:`tickOrders`、`canFulfill`、`fulfillOrder`。无惩罚,过期就走,奖励 ≤ 总收入 3% |
| `pests.ts` | 虫眼简版:`tickPests`(每 3–4 分钟一波)、`tapPest`;不点最多咬走少量库存(单波 ≤4%,不致命) |
| `offer.ts` | 献果:`offerOpen(sourceTier, routeTier)`(产出线 ≥3 且运输线 `ROUTE_ERA` ≥3,即货船起)、`doOffer`:送出 += W×0.15/v |
| `decay.ts` | 防囤:库存超 `decayLimit(目标价,收入)=max(1.5×目标价, 300×收入)` 的部分指数腐烂,冷库道具免疫,可点清烂果 |
| `codex.ts` / `eggs.ts` | 图鉴(15 品种 + 44 彩蛋)、成就 26 个。`checkEggs(snap, ev, codex, rnd)→[{id,reward,first}]`;彩蛋 id 与 `src/content/eggs.ts` 一一对应(测试校验) |
| `newsRules.ts` | `pickNews(snap, recent, items, rnd)`:标签匹配(night/rain/low-stock/new-tier/idle…)+ 里程碑 1/10/25/50/75/90/99% 优先,同条冷却 |
| `state.ts` | 接线层:`SysState`、`newSys/normalizeSys`、`tickSys`、`onShakeRoll`、`claimOrder`、`tapPestSys`、`cleanRotSys`、`offerSys`、`snapshotOf`、`onEvent`、`nextNews` |
| `migrate.ts` | 存档 v4→v5:运输线 6 档 → 9 档(`migrateRouteTiers`) |

## eng-app 接线

```ts
// 每帧(dt 任意;>5s 视为离线,只做安全部分)
const tk = tickSys(s.sys, dt, { playSec, era: eraMin(s), sourceTier: s.source.tier, routeTier: s.route.tier,
  coins: s.coins, income: th.income, targetCost, coldStorage: s.gates.includes('cold'), progress: s.delivered / GOAL }, rnd);
s.coins = Math.max(0, s.coins - tk.coinsLoss);               // 腐烂 + 虫咬
for (const e of tk.events) { /* order-new/order-expire/pest-wave/pest-bite/rot/bag → UI */ }

// 每次有效摇树
const apple = onShakeRoll(s.sys, { playSec, era }, rnd);     // 牛顿事件:传 force='kent'
// 玩家点订单 / 虫 / 烂果 / 献果
s.coins += claimOrder(s.sys, id, th.income).reward;
const r = tapPestSys(s.sys, id, th.income); s.coins += r.reward;
cleanRotSys(s.sys);                                          // 返回清理个数,再发 {t:'rot',cleaned}
const o = offerSys(s.sys, { sourceTier, routeTier }, W, s.coins, th.value); // null = 未开放
if (o) { s.coins -= o.spent; s.delivered += o.apples; }

// 事件 → 彩蛋/成就
const snap = snapshotOf(s.sys, { /* Snapshot 里的原始数,见 types.ts SnapHost */ nowMs: Date.now() });
const { eggs, ach } = onEvent(s.sys, snap, ev, rnd);         // eggs[].id 发 bus 'egg'
const news = nextNews(s.sys, snap, NEWS_ITEMS, rnd);          // 8 秒一条
```

`EggEvent`(`types.ts`):`shake{combo,apple?}` `buy{what,line?}` `tier{line,tier,branch?}` `gold{kind:'appear'|'tap',at,since?}`
`event{kind,claimed}` `idle{sec}` `time`(1Hz 心跳) `tap{target,at}` `login` `away{ms}` `rot{cleaned}` `win`。
`tap.target` 取值见 `TAP_TARGETS`(treetop-fruit/newton/xu/garage/moon/…),美术热点用这些 id。

## 需 eng-app 加入存档的 state 字段

- `State.sys: SysState`(`newSys()` 缺省;读档用 `normalizeSys(raw.sys)`,虫群不存档)。
  在 `save.ts` 的 `migrations[4]` 里补:`s => ({ ...migrateRouteTiers(s), sys: newSys() })`(目前只含路线迁移)。
  `SAVE_VERSION` 已为 5。`SysState` 含:`bag bagT orders pests rot offer codex news recentNews lastEventAt limit`。
- 彩蛋奖励(`incomeSec` 按"收入秒数"发果钱 = `reward × th.income`)、`buff`、`skin` 由 eng-app 兑现,奖励表在 `src/content/eggs.ts`。
- 离线结算(`settle`)后发一次 `{t:'away',ms}`;启动/回前台发 `{t:'login'}`。

## 运输线 9 档(2026-11-24 用户新需求)

内部 id(`content.ts` 的 `ROUTE_IDS`)与美术(`art/things` 的 transport id)完全一致,下标即 `route.tier` / `Vehicle.tier`:

| idx | id | 名称 | `ROUTE_ERA` | 备注 |
|---|---|---|---|---|
| 0 | basket | 篮子 | 0 | 起点 |
| 1 | porter | 挑扁担工 | 0 | 新:"两头挑,走得慢,但不占路"。分支 加粗扁担 / 小碎步 |
| 2 | cart | 小推车 | 1 | |
| 3 | trampoline | 蹦床 | 1 | 新:弹射距离长,会漏一点苹果。分支 高弹网 / 兜底网 |
| 4 | truck | 卡车 | 2 | |
| 5 | ship | 货船 | 3 | 献果开放档 |
| 6 | helicopter | 直升机 | 3 | 新:吊运不怕堵路。分支 吊篮 / 双旋翼 |
| 7 | plane | 飞机 | 4 | |
| 8 | portal | 传送门 | 5 | |

- **era 口径不变**:`era(s) = source.tier + ROUTE_ERA[route.tier]`(0..10),`eraMin = min(source.tier, ROUTE_ERA[route.tier])`。
  道具解锁(`GATES[].unlockAt`)、新闻 era、季节/品种 `minEra`、献果 `offerOpen`、彩蛋 `garage(≥2)/einstein(≥5)` 都用 era 口径,所以原有文案表仍按 0..5 的 era 索引。
  **只有"按路线档逐档显示"的地方需要 9 项**:路线升档卡、ERA 切换 toast 若按路线档触发。
- 数值(`content.ts`,`node scripts/sim.ts` 可复核):运力 cap 6/31/160/600/2261/29070/65000/144500/510000;升档价约 0/1.6k/58k/180k/540k/44M/160M/540M/8.9B。
- app 侧待办(eng-app 区域):`src/app/dialogs.ts:62` 用 `source.tier + route.tier` 判断道具解锁,应改成 `era(state)`;`src/app/world.ts` 的 `ROUTE_TIERS[rt.tier]` 已按 9 项工作。
- 存档:`SAVE_VERSION=5`,旧档运输线下标 0..5 映射到 0,2,4,5,7,8(`ROUTE_OLD_TO_NEW`),新中间档为"未拥有"。

### 需 writer 补/润色的文案(目前 `content.ts` 里是占位,可直接改字,id 不变)

- 档名/单位/玩笑:`ROUTE_TIERS[1]` 挑扁担工(位挑担工)、`[3]` 蹦床(张蹦床)、`[6]` 直升机(架直升机),各一句 `joke`。
- 6 个新分支的 `name` + `joke`:挑扁担工(加粗扁担/小碎步)、蹦床(高弹网/兜底网)、直升机(吊篮/双旋翼);另有各档 `pair`(升档点二选一短标题)。
- 升到这三档时的新闻/toast 各 2–3 条(tag `new-tier`);可选彩蛋:蹦床漏果(点蹦床)、扁担断了(点扁担工)。

## 平衡(`scripts/sim-v5.ts`)

`node scripts/sim-v5.ts --all`:cps0/1/4 × 种子 1–3,验收按三种子均值(单局随事件 ±2 分)。
当前:cps0 均值 73.7 分(≤75),cps1 56.6(55–65),cps4 44.2(≥42)。cps1 的"最长无事可买"约 100–115 秒,有意义购买间隔最长约 300 秒(第 29 分钟前后,卡车→货船)。
sys 带来:订单奖励约 2.2% 收入(≤3%)、献果送出约 8% 目标、虫咬在机器人点虫时为 0、季节修正均值 ≈ 0。
`scripts/sim-route.ts '<ROUTE_TIERS 覆盖 JSON>' [cps...]`:不含 sys 的运输线调参(`SCALE=k` 同比放大价格)。
