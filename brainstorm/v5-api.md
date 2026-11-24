# v5 程序接口(eng-app)

给美术(art-nature / art-things)、系统(core/sys)、文案(content)接入用。代码在 `src/app/*`(宿主层)与 `src/core/*`(纯逻辑,无 DOM)。

## 1. 宿主层结构

| 文件 | 职责 |
|---|---|
| `app/boot.ts` | 入口:读档 → 建 Orchard → 接线 → `startLoop()` |
| `app/ctx.ts` | 共享状态 `app`(state / orchard / audio / readOnly / DEBUG / speed)、`hooks.render`、`nowMs()` |
| `app/loop.ts` | requestAnimationFrame 主循环:`tick(state, dt)` → orchard.frame → 每 0.25 秒 `renderAll`,每 15 秒存档 |
| `app/render.ts` | `renderAll()`:按 State 刷新底栏、顶栏、弹层、`buildWorld()` → `orchard.setWorld()` |
| `app/world.ts` | `buildWorld(s, th): WorldView`(State → 画面数据) |
| `app/bar.ts` `hud.ts` `dialogs.ts` | 底栏四张卡 / 顶栏 / 弹层 |
| `app/ticker.ts` `news.ts` `newspick.ts` | 新闻滚动条 |
| `app/session.ts` | 存档、离线结算、结局、重开 |

规则:`src/app` 可以依赖 `src/core`、`src/ui`、`src/art`、`src/audio`;`src/core` 不依赖 DOM,也不依赖 `src/app`。

## 2. 事件总线 `core/bus.ts`

```ts
import { bus } from '../core/bus.ts';
const off = bus.on('buy', (e) => { /* e.what: 'unit'|'expand'|'helper'|'gate' */ });
bus.onAny((e) => {});
bus.emit({ t: 'egg', id: 'kimura' });
```
`Ev`:`shake{combo,strength}` `delivered{n,total}`(每 0.25 秒一次增量) `buy{line,what,cost}` `tier{line,tier,branch}` `event{kind,phase:'appear'|'hit'|'miss'}` `gold{kind,apples}` `egg{id}` `era{era}` `win`。
监听器抛错不会影响游戏。彩蛋触发后由宿主 `bus.emit({t:'egg', id})`,旁白 / 新闻 / 音效订阅它。调试模式下 `window.__game.bus` 可用。

## 3. 美术接入:Orchard 怎么调 `src/art/*`

现状:`src/ui/orchard.ts` 用 `ui/pen.ts` `ui/sources.ts` `ui/route.ts` 自己画。美术换接入的位置固定为下面几处,**Orchard 只在这几处调用 art 的函数**,其余不动:

| Orchard 里的位置 | 调用 | 约定 |
|---|---|---|
| 树上 / 地上的苹果 | `art/nature` 的 `appleSprite(kind,state,size)` + `drawAppleAt(ctx,spr,cx,cy,s,alpha)` | sprite 烘焙一次、每帧只 `drawImage`;`kind`/`state` 来自 `sys` 的 `Apple` |
| 篮子 / 堆 | `art/things` 的 `appleHeap(ctx,x,y,n,r,w,seed)` | n 由 `WorldView.stock01` 换算 |
| 建筑、角色、小物件 | `art/things` 的 `ThingFn = (ctx,x,y,s,o?) => void` | `o.pose`: `idle|shake|catch|cheer|hit`;坐标是世界坐标,`s` 是缩放 |
| 配色 | `art/style.ts` 的 `PAL` | 深色模式由 `ui/pen.ts` 的 `setTheme()` 切;art 函数需读当前主题色 |

约定:art 函数是**纯绘制**:`(ctx, x, y, s, opts)`,不读 State、不改全局、不 new Canvas(烘焙除外,放模块内缓存)。接入时 Orchard 里加一个薄包装,把 `WorldView` 的字段翻成 `opts`。要 Orchard 多暴露什么(比如 hitTest 区域)找 eng-app。

## 4. 系统接入:`core/sys` 怎么挂到 tick

`core/sys/state.ts` 全是纯函数,状态放 `SysState`。宿主每帧这样用(**接线待 M2 做,当前未挂**):

```ts
// app/loop.ts,每帧
const inp: SysInput = { playSec, era: eraMin(s), sourceTier, routeTier, coins: s.coins, income: th.income,
                        targetCost: getGoal()?.cost ?? 0, coldStorage, progress: progress(s) };
const r = tickSys(sys, dt, inp, Math.random);   // dt>5 当离线结算
s.coins = Math.max(0, s.coins - r.coinsLoss);   // 腐烂 / 虫咬
for (const ev of r.events) bus.emit(...)         // 订单 / 虫 / 烂果 → UI
```
- 摇树:`onShakeRoll(sys, inp, rnd)` 得到这次的苹果。
- 点订单 / 点虫:`claimOrder` / `tapPestSys` 返回 `reward`,宿主 `s.coins += reward`。
- 彩蛋 / 成就:宿主构造 `snapshotOf(sys, host)`,发事件调 `onEvent(sys, snap, ev, rnd)`,返回新触发的 id;宿主 `bus.emit({t:'egg'})` 并按 `content/EGG` 发奖。
- 存档:`SysState` 挂到 `State.sys`(M2 时随 SAVE_VERSION 5 + `migrations[4]` 一起加,旧档补 `newSys()`)。**sys 不得直接写 State 的数值字段**,一律经宿主改。

## 5. 新闻

- 滚动条 `#news`(顶栏下 24px)。`app/ticker.ts`:`setNewsSource((ctx)=>string|null)` 换内容源;`pushNews(text)` 插队一条;`skipNews()`。
- 现在的源:`app/news.ts` `installContentNews()` 读 `content/news.ts` 的 `NEWS_ITEMS`,按 era / `when` 标签 / weight / 30 分钟冷却挑(纯函数 `app/newspick.ts selectNews`)。
- 标签判定在 `news.ts tagsNow()`;`core/sys` 的 `nextNews` 有更准的条件时,在 boot 里 `setNewsSource(...)` 替换即可。
- 减少动效(设置或系统偏好)时不滚动,每 8 秒换一条。

## 6. 经济与存档(v4)

- `State.coins` = 手上苹果(数值与 v3 相同,sim 零影响);`State.spent` = 累计花掉;`coins + spent` = 累计赚到;`State.delivered` = 已送出(得分,只增,不因购买减少)。
- `State.pin`:钉住的底栏卡(`'srcBuy'|'srcUp'|'rtBuy'|'rtUp'|null`),只影响提示。
- `SAVE_VERSION = 4`。`core/save.ts` `migrations[3]` 把 v3 升到 v4(`spent=0, pin=null`)。迁移前 `load()` 把原始存档另存为 `SAVE_KEY + '.v3.bak'`(已存在不覆盖)。v1/v2 仍丢弃。以后加字段:SAVE_VERSION + 1,`migrations[旧版本]` 写升级函数,`fillDefaults` 补默认,`tests/core-save-migrate.test.ts` 加用例。

## 7. 构建与礼物

- `npm run build`:JS / CSS 内联进 `dist/index.html`;图片放 `public/`(原样拷贝)或 `src/assets/`(import 后输出 `dist/assets/名-hash.ext`),外链。
- `npm run build:single`:`--mode single`,图片也转 data: URI,整个游戏一个 HTML。
- 礼物:`core/gift.ts` `GIFT_DATE = Date.UTC(2026,11,23,16,0,0)`(北京时间 12/24 00:00),与设备时区无关。`?date=YYYY-MM-DD`(按北京时间 12:00 算)只有同时带 `?debug=1` 才生效。
