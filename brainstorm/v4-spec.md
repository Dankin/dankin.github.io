# v4:一条越变越大的"产出 → 运输 → 送达"线(lead spec)

分支 `v3`(继续用,最后合到 source 并发布 main)。**v3-spec.md 作废**(地点卡片/访客作废;可复用其风格与 `ref/step1` `src/ui` 里的画法)。

## 用户要求(m00933 + 回答)
1. iPhone **横屏为主**,竖屏也能玩(同一套 DOM,CSS 媒体查询适配)。
2. 表现精简但有趣,质量 > 总量;**表现形式一致,不割裂**(整个画面只有一条线,上下不分两个世界)。
3. 优先做游戏本身,"私货"(圣诞礼物)最后再说,只留占位:82 亿达成后若未到 12/24,显示 `SEALED`(copy.ts)。
4. 风格参考《Round and Round Inc.》(Steam,旋转门增量):**黑白画面**,浅/深色主题,每次升级都让场景**肉眼可见地变化**,手动操作(画圈)储能到飞轮,转太猛东西会飞出去(连击),有结局回顾。我们:黑白线稿 + 苹果红;个别角色/物件可带少量颜色(如牛顿的金发),大环境黑白。
5. 目标:累计运出 **82 亿**个苹果,**约 1 小时**通关;**一直在用更优的方式产出和运输苹果,以"运输送达"结算**。
6. **产出方式可升级**:一棵树 → 小果园 → 果山 → 果城 → 果星 → 苹果之门(6 档)。**运输方式可升级**:篮子 → 小推车 → 卡车 → 货船 → 飞机 → 传送门(6 档)。都可以 DIY(分支、道具)。
7. 升级与特性的目的是**参与感 → 要有决策**(取舍,不是单向变大)。
8. 苹果、"82亿"沿用;幽默文案沿用 `src/core/copy.ts` 风格(可重写)。

## 玩法模型(core 按此实现,数值由 engineer 用 sim 调)
- **产出线** `source`:6 档(tier)。每档有 `units`(已买数量,同档可重复买,价格 ×growth^n),每个 unit 每秒产 `r_tier` 个苹果,进入**堆场 stock**。买下一档要付 `tierCost` 并**选分支(A/B)**;高档 unit 比低档强,低档 unit 不会消失(老树永远在)。分支例:果园=密植(产量×1.3)/精品(每个苹果价值×1.3);果山=梯田(产量)/缆车(运输速度);果城=苹果大厦(价值)/垂直农场(产量)……
- **运输线** `route`:6 档。每档有 `vehicles`(数量,可重复买)。一辆车每趟装 `cap_tier` 个,往返 `T_tier` 秒,到达终点才结算。同样买下一档选分支(A 重载容量 / B 高速),低档车保留。
- **瓶颈**:吞吐 = min(产出, 运力)。堆场堆满(超过 `stockMax` = 60 秒产量 + 仓库升级)会浪费;车空跑则说明运力过剩。**玩家要在"扩产出"和"扩运输"之间取舍**,UI 要让瓶颈一眼可见(堆场高度、空车比例),不要数字也看得懂。
- **货币**:`coins`(果钱)= 送达苹果数 × 单价 `value`。目标进度 `delivered`(累计送达个数)/ 82 亿。单价 = 1 × 分支 × 道具乘数。
- **道具槽(Gates,3 个)**:路线上的"关卡",每个槽放一个道具,**随时免费更换**(这是主要的 build 决策)。道具池随档位解锁(≥6 种),例:洗果(价值×1.25)、打蜡(价值×1.6,每趟 +25% 时间)、榨汁(数量×2,价值×0.6)、包装(每趟容量 +20%)、冷链(堆场不浪费)、加急(每趟 −20% 时间,价值×0.85)、红绳(相邻槽效果 ×1.15,放哪里很重要)。
- **手动**(早期靠它,后期是调味):在树/摇柄上**画圈或点按**给飞轮储能(`flywheel` 0..1,衰减),储能期间产出 ×(1 + 最大 1.5)。转得太猛(速度过阈值)苹果会飞出去 → "嗖"连击(连击加少量价值);有"自动驱动"升级后基础飞轮保持在 0.3。**不加时间惩罚**。
- **意外惊喜(每 1–2 分钟一次,不打断)**:一只鸟叼走一个苹果送你双倍 / 牛顿路过(几秒内手动加倍)/ 流星(点中得 10 秒运量)。以小事件形式出现在线上,点或不点都行。
- **时代切换**(升到新产出档/运输档)时:整个场景换样子(树→果园的背景/运输工具换形),有一句幽默旁白(toast)。
- **结局**:82 亿达成。若 `giftOpen(now)` 为假 → 显示 `SEALED`,游戏继续;否则显示结局回顾(由 UI 做,先占位:总用时、点击数、选了什么分支)和礼物位(占位,以后放用户文案)。
- **离线**:按 100% 但上限 8 小时;回来给一句"你不在的时候,XX 运走了 N 个"(简短,可选数字)。
- 存档:`SAVE_VERSION` 升到 3,老存档直接新开(迁移里 `newState`)。

## 数值目标(engineer)
- 通关(82 亿)约 **60 分钟**(主动玩家,平均 1 次/秒的摇,偶尔买买);纯挂机 ≤ 100 分钟;大量点击也不能 < 45 分钟。
- 每档升级约在 3 / 10 / 20 / 33 / 47 分钟(两条线交替)。
- 前 3 分钟必须有:第一次买(≤20 秒)、第一辆新车(≤60 秒)、第一次换道具(≤2 分钟)。
- 任何时刻,"下一个想买的东西"的等待 ≤ 60 秒(sim 里检查最长空闲)。
- 不出现"买了没感觉":每次购买应让 `throughput` 至少 +10% 或带来可见变化。

## core 接口(engineer 实现,main.ts/UI 依赖)
`src/core/` 下:`constants.ts`(GOAL=8.2e9, SAVE_VERSION=3…)、`state.ts`、`game.ts`、`content.ts`(SOURCE_TIERS/ROUTE_TIERS/GATES 的名字、文案、分支、价格参数)、`save.ts`、`events.ts`、`copy.ts`(沿用,可改)、`gift.ts`(已有)。
```ts
export interface State { version; coins; delivered; clicks; playSec;
  source: { tier:number; units:number[]; branch:(0|1|-1)[] };   // units[t] = 第 t 档数量
  route:  { tier:number; vehicles:number[]; branch:(0|1|-1)[] };
  gates: (GateId|null)[];  // 长度 3
  gatesUnlocked: GateId[];
  stock:number; flywheel:number; combo:number;
  vehiclesState: {tier:number; phase:number /*0..1 一个往返*/; load:number}[]; // 仅用于连续模拟,可按需
  lastSeen; startedAt; settings:{sound:boolean; reducedMotion:boolean; dark:'auto'|'light'|'dark'} }
export function tick(s, dtSec, now): { deliveredNow:number; coinsNow:number }   // 推进模拟
export function crank(s, amount:number): void;           // 手动储能,amount≈圈数
export function click(s): void;                           // 点按给一点储能
export function throughput(s): { produce:number; carry:number; flow:number };  // 个/秒
export function canBuyUnit(s, line:'source'|'route', tier?)/ buyUnit(...) / canUpgradeTier(s,line) / upgradeTier(s,line,branch)
export function setGate(s, slot:number, id:GateId|null): boolean
export function settle(s, awayMs): {delivered:number}
export function isWon(s): boolean
export function preview(s, action):{flowDelta:number; valueDelta:number}  // 给 UI 画"+x%"提示
```
engineer 可调整签名但须在 `brainstorm/core-v4.md` 写清楚并保持 UI 所需字段:当前档位、各档 unit 数量(画场景用)、车辆位置(画运输用)、堆场占比、飞轮、连击、3 个道具槽。

## UI(ui-designer)
- **一条线**:横屏时 画面左→右 = 产出区 → 路线 → 终点(送达口)。竖屏时同一条线折成 S 形(或上→下)。**不要上下半屏两个世界**。
- 上方窄栏:左 `已送出 12.3万 / 82亿` + 细进度线;右 `每秒 x` 和 ⚙。数字都用中文单位(万/亿),不用科学计数;精确数在设置。
- 下方窄栏(横屏占高 ≤ 28%):左 产出区操作 / 中 3 个道具槽 / 右 运输区操作。每边:当前档名 + `+1 个 (价)` 按钮 + `升级为 XX (价)` 按钮(有分支时弹 2 选 1 小卡);**买不起的灰,买得起的呼吸**。道具槽点开选道具(横向抽屉)。
- **瓶颈可视化**:堆场(苹果堆的高度)、路上的车(空/满)、终点的"吞吐"闪动。
- 画圈手势:在产出区的摇柄/树上画圈 → 飞轮储能(角度累计);普通点按也算小储能。**不要整屏抖**;飞出去的苹果用抛物线小动画。
- 每档产出/运输都要有**不同的画法**(树/果园/果山/果城/果星/苹果之门;篮子/推车/卡车/货船/飞机/传送门),线稿、一致风格、粒子 ≤ 60、同屏车辆 ≤ 24(多了就用"一排小点"代表一队)。
- 夜晚/深色:整体反色;`prefers-color-scheme` 初始,设置里可切。
- 性能:同上(30fps 空闲/2s 60fps/隐藏停)。
- 横屏/竖屏同一套 DOM,用 `@media (orientation)` 和 `env(safe-area-inset-*)` 适配(iPhone 刘海/灵动岛);触点 ≥ 44pt。
- Orchard 接口由 ui-designer 在 `brainstorm/ui-v4.md` 定义,字段从 core State 直接读(以 WorldView 形式),main.ts 传入。

## 更正(摇树,非画圈)
手动操作是**摇苹果树**(点/空格/以后手机摇),不是画圈、不抄 Round and Round 的曲柄:`shake(s)` 直接把苹果摇进堆场并蓄摇劲(临时产出加成),0.6 秒内连续摇出"连摇"加价值;没有"飞出去"。
产出端:玩家摇 + 升级;运输端自动。决策:分支铁砂掌/老徐的徒弟,道具摇树手套/号子,以及雇"老徐"(自动摇树)。详见 `brainstorm/core-v4.md`。
