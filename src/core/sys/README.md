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
| `codex.ts` / `eggs.ts` | 图鉴(15 品种 + 56 彩蛋)、成就 26 个。`checkEggs(snap, ev, codex, rnd)→[{id,reward,first}]`;彩蛋 id 与 `src/content/eggs.ts` 一一对应(测试校验) |
| `newsRules.ts` | `pickNews(snap, recent, items, rnd)`:标签匹配(night/rain/low-stock/new-tier/idle…)+ 里程碑 1/10/25/50/75/90/99% 优先,同条冷却 |
| `state.ts` | 接线层:`SysState`、`newSys/normalizeSys`、`tickSys`、`onShakeRoll`、`claimOrder`、`tapPestSys`、`cleanRotSys`、`offerSys`、`snapshotOf`、`onEvent`、`nextNews` |
| `migrate.ts` | 存档 v4→v5 `migrateRouteTiers`、v6→v7 `migrateV6Redesign`(产出 6→5、运输 9→8、删槽位) |
| `characters.ts` | 鸟 `birdHit/birdPeck`、彩蛋角色 `characterClick` |
| `laoxu.ts` | 老徐 8 级行为状态机(见下「老徐」) |

## eng-app 接线

```ts
// 每帧(dt 任意;>5s 视为离线,只做安全部分)
const tk = tickSys(s.sys, dt, { playSec, era: eraMin(s), sourceTier: s.source.tier, routeTier: s.route.tier,
  coins: s.coins, income: th.income, targetCost, coldStorage: s.source.tier >= 4 && s.source.branch[4] === 1, progress: s.delivered / GOAL }, rnd);
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

## v6 重设计(2026-11-24,plan/80-v6-redesign.md)

### 产出线 5 档(树原地进化)· 运输线 8 档
`content.ts` 导出 id,美术/文案/app 全部按这些 id 对:

- `SOURCE_IDS = ['sapling','old','giant','cloud','star']`(小树/老树/巨树/云树/星树),下标 = `source.tier`。
- `SOURCE_BRANCH_IDS = ['dense','thick']`(密植:枝多果小 / 粗壮:枝少果大),下标 = `source.branch[tier]`(0/1)。美术变体 id = `${SOURCE_IDS[t]}-${SOURCE_BRANCH_IDS[b]}`,共 8 个(小树无分支)。
- `ROUTE_IDS = ['basket','porter','cart','truck','ship','helicopter','plane','portal']`,下标 = `route.tier` = `Vehicle.tier`;蹦床已删。
- `ROUTE_VARIANTS[routeId] = [分支0, 分支1]`(basket 为 null):porter `broad-pole`/`quick-step`,cart `heavy-cart`/`light-wheel`,truck `heavy-truck`/`pickup`,ship `container`/`speedboat`,helicopter `basket-lift`/`twin-rotor`,plane `cargo`/`supersonic`,portal `wide`/`zero-lag`。同档两分支共用底盘,换车身/司机。
- **era 口径**:`era(s) = source.tier + ROUTE_ERA[route.tier]`(0..9),`ROUTE_ERA = [0,0,1,2,3,3,4,5]`;`eraMin = min(source.tier, ROUTE_ERA[route.tier])`(0..4)。品种/订单/虫眼/献果(`offerOpen`:eraMin ≥3,即云树+货船)/彩蛋 `minEra` 用 eraMin。
- 槽位(gate)整套删除:`State.gates/gatesUnlocked`、`setGate`、`Action 'gate'`、`GATES`、`describeGate`、`newGates`、bus `buy.what='gate'`。效果直接删除(不并入),经济已重调(见平衡)。
- 存档:`SAVE_VERSION=7`,`migrations[6]=migrateV6Redesign`(`sys/migrate.ts`):旧果星→云树、苹果之门→星树,蹦床→小推车(合并档取当前所在旧档的单位/扩建/分支),`tierTimes`、`Vehicle.tier` 同步映射,删 `gates`。旧信箱无 state。
- **State 无新增字段**。鸟/角色相关计数在 `s.sys.codex.counters`(`birdHits`/`birdPecks`)。

### 品种特性(只有视觉 tag + 价值倍率,无点击压力)
`varieties.ts`:`rollApple` 返回的 Apple 多了 `trait`。`traitOf(kind,state)`、`fxOf(kind,state)→{fallMul,bounces,quake,rollPx,glow,smoke,sfx}`:
金苹果 `glow`(发光)/ 青苹果 `fastFall`(fallMul<1,快落)/ 红斑 `bounce`(落地弹 `bounces` 次)/ 巨无霸 `quake`(落地震)/ 虫蛀 `rollAway`(滚走 `rollPx`)/ 毒苹果 `smoke`(灰烟),音效 id `apple-golden/apple-fast/apple-bounce/apple-quake/apple-roll/apple-poof`(其余 `apple-land`)。

### 鸟与彩蛋角色(`sys/characters.ts`,常量 `BIRD`/`CHARACTER_REWARD`)
- 鸟:点中 `birdHit(flow,value,rnd)→{apples,coins,feathers}`(≈6 秒送达量 + 2–4 根羽毛;app 发 `{t:'event',kind:'bird',phase:'hit'}` 与 `claimed:true`);不点飞走 `birdPeck(stock,flow)→被啄走苹果数`(≤库存 4%、≤40、≤flow×3s,永远不致命;app 从 stock 扣,发 `claimed:false`)。`events.ts` 的 `claimEvent('bird')`(10 秒量)保留作"事件奖励";要用小额请调 `birdHit`。
- 角色:`CHARACTER_IDS`(newton/snow-white/snake/seed-sower/turtleneck/einstein/archer/farmer/runner/merchant/elf/reindeer),`characterClick(id,flow,value)→{apples,coins,eggId,actionS(1–2s),sfx,particle,buff}`;牛顿给 buff 不给苹果,其余给 ≈5 秒送达量的小额苹果。冷却 `CHARACTER_REWARD.cooldownS`(app 管)。点击后仍发 `{t:'tap',target}` 触发彩蛋/图鉴。
- 新 `TAP_TARGETS`:truck、elf、sleigh-bell、reindeer-nose、gift-top、cloud-basket、star-lantern-1..7;新 `EggEvent {t:'gift-rim'}`(礼物堆第一次高过雪橇边沿时发一次)。彩蛋共 56 条(新 10:truck-horn/bird-feather/bird-ignore/bird-hat/elf-wave/sleigh-bell/reindeer-nose/gift-peek/cloud-basket/star-lantern)。trampoline-leak 已删。

### app/ui 仍引用已删接口(eng-app/ui-v5 负责,`tsc` 目前在这些文件报错)
- gate:`src/app/{boot,dialogs,ftue,render,session,sys,world}.ts`(`GATE_SLOTS/setGate/GATES/describeGate/gateDef/GateId/GATE_UNLOCK_TOAST/s.gates/s.gatesUnlocked/newGates/buy 'gate'`;`app/sys.ts` 的 `coldStorage` 改成 `s.source.tier>=4 && s.source.branch[4]===1`),`src/ui/{orchard,scene-art,preview}.ts`、`src/ui/panels/*`、`src/art/things/ui.ts:231`。
- 信箱:`src/ui/panels/{types,postcards,index,preview}.ts`(明信片已由 writer 并入旁白)。
- `src/ui/scene-art.ts:337` 的 `'trampoline'` 点击目标;`src/app/news.ts:46` 的 `Math.min(5,era)` era 现为 0..9;`src/app/dialogs.ts:62` 用 `era(state)`。
- 6→5 档产出线、9→8 档运输线:凡按 `SOURCE_TIERS`/`ROUTE_TIERS` 长度写死的数组都要核对。

## 平衡(`scripts/sim-v5.ts`)

`node scripts/sim-v5.ts --all`:cps0/1/4 × 种子 1–3,验收按三种子均值(单局随事件 ±2 分)。
当前(v6,槽位删除后重调:老树起各档产出/运力 ×2.7,HELPER.rate 0.3,SHAKE.dropSec [0.7,0.5,0.39,0.31,0.21],comboStep 0.004):cps0 均值 73.4 分(≤75),cps1 55.7(55–65),cps4 45.8(≥42)。最长无事可买:cps0 200–240s,cps1 140–190s,cps4 150–215s;有意义购买间隔最长 340–440s。
sys 带来:订单奖励约 2.2% 收入(≤3%)、献果送出约 8% 目标、虫咬在机器人点虫时为 0、季节修正均值 ≈ 0。
`scripts/sim-route.ts '<ROUTE_TIERS 覆盖 JSON>' [cps...]`:不含 sys 的运输线调参(`SCALE=k` 同比放大价格)。

## 老徐 8 级(2026-11-24 用户新需求)

`State.helpers`(数量)→ `State.helperLevel`(0..8,形态)+ `State.helperAct`(0..1,出工系数,**每帧由 sys 写入,不用存档但存了也无妨**)。
等级名/卡片/台词在 `src/content/laoxu.ts`(`LAOXU_LEVELS`、`laoxuLines`)。`content.ts` 的 `HELPER.equiv=[0,1,2,3,4,6,9,11,12]`:第 n 级相当于几位老徐(摇频=equiv×0.15/s);
升级价 = `helperOldTotal(equiv[新])-helperOldTotal(equiv[旧])`,所以买满总价与旧版买 12 位相同,总时长不变。8 级退休顾问:产出 ×1.02、运输时间 ×0.985(合计约 +3%)。

行为(`sys/laoxu.ts`,纯函数):`work` 出工 / `slack` 偷懒(lv≥6,每 60–100s 一次,10–16s,无产出,结束"精神焕发":30s 内下一次摇树 ×3)/ `nap`(夜里或玩家 ≥90s 无操作,产出不变,只是睡姿)/ `watch`(访客/流星事件在屏、新订单、虫潮时看热闹,产出照常)。
接口:`newLaoxu/normalizeLaoxu`、`stepLaoxu(st,dt,rnd,ctx{level,idleSec,night,visitor})→{act,events}`、`takeCrit(st)→3|1`、`tapLaoxu(st,rnd)→{r:'wake'|'soda'|'none',rewardS}`、`laoxuView(st)→{lv,state,t,crit}`。
接线层 `state.ts`:`tickSys` 的输入多了可选 `helperLevel/idleSec/eventOnScreen`,返回 `helperAct` 与 `laoxu` 事件;`laoxuCrit(sys)`;`tapLaoxuSys(sys,income,rnd)→{r,rewardS,reward}`。

eng-app 每帧:`s.helperAct = tk.helperAct`;摇树:`shake(s, laoxuCrit(s.sys))`(`game.shake` 新增第二参数乘数);点老徐:`tapLaoxuSys` 并发 `{t:'tap',target:'xu'}`,按住 ≥3s 发 `{t:'hold',target:'xu',sec}`。
`soda` 结果 = 气泡水,奖励 8 收入秒。彩蛋 `laoxu-spray`(偷懒时点,10%)`laoxu-qc`(2s 内连点 3 下)`laoxu-bubble`(偷懒时按住 3s),均需 lv≥6。
UI 仍是"数量"语义、待 eng-app 改:`src/app/bar.ts` 老徐卡(标题用下一级 `LAOXU_LEVELS[lv].card`)、`src/app/hud.ts:24`、`src/app/ftue.ts:124`、`src/ui/scene-art.ts`(wv.helpers>0 → 按等级画)、`src/core/copy.ts:91`。
存档:`SAVE_VERSION=6`,`migrations[5]`:旧 helpers=n → 取 equiv[l]≤n 的最高 l,多出的价差退还果钱,不丢进度。
sim:`node scripts/sim-v5.ts --laoxu` 对比"全程出工"与完整老徐:总时长净影响 cps0 +0.0 / cps1 +0.5 / cps4 +0.0 分钟(机器人买到 6 级已很晚,偷懒仅 5 次共约 43s,暴击 3 次),equiv 上调正是为了抵消偷懒损失。
