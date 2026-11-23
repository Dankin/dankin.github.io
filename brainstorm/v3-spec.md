# v3:老玩法 + 一个世界(spec,lead 写给 ui-designer)

分支 `v3`(从 `source` 切出,保留老的数值内核:10 个升级、8 个项目、3 口禁果、82 亿目标)。
`ref/step1/` 里是上一版(redesign 分支)的新画面,可以直接搬用:tree.ts、landmarks.ts、style.ts、sky.ts、chars.ts、orchard.ts、preview。
`ref/` 已在 .git/info/exclude,不会进仓库。

## 用户反馈(m00878 / m00902)
1. 风格变化太大,**黑白为主色调**(已确认:黑白线稿,只有苹果是红色;夜晚反色)
2. 画面太抖,头晕:**点一下整屏晃**必须去掉。背景全部静止或极慢,树只轻轻摆一下
3. 要保留增量游戏本身:数字回来,升级可反复买,目标仍是累计送出 82 亿,约 2 小时通关
4. 之前的不适主要是"上下两半动态程度不均衡"(上半果园在动,下半景点街是静态展示)
5. 升级名字要更幽默;一次性项目不要太死板
6. 趣味性第一

## 结构:一个世界,升级长在景物上
- 全屏竖屏 canvas 世界(沿用 step1 的树 + 小路 + 4 个景物),没有页签,没有列表面板。
- 顶部细栏:左 `🍎 数字`(`#apples`)+ `每秒 x`(`#rate`),右 设置齿轮。下面一条 2px 细线 = 82 亿进度(`#goalBar`),线末端有个小礼盒。
- 5 个地点各挂 2 个升级(可反复买):

| 地点 | 升级 id(按钮 1 / 2) |
|---|---|
| 老树 | shake / branches |
| 小屋 | gardener / tractor |
| 邮筒 | express / drone |
| 风铃 | breeze / shaker |
| 池塘 | breed / cloud |

- 点地点 → 底部弹出一张小卡片(最多占屏高 36%,卡片外点一下收起):标题 + 2 行升级。每行:名字、一句笑话、`现在:…`、`Lv.n`、购买按钮(价格)。可买的行按钮呼吸发光。
- 地点上方有小红点 = 里面有可买的;全部买不起就没点。**没有任何自动弹出的东西抢视线**。
- 没解锁的升级行显示"???"。地点本身随进度解锁(树、小屋 一开始;邮筒 ≥2e3;风铃 ≥1e5;池塘 ≥1e7 累计)。
- 世界随阶段长大(沿用 STAGES 6 档 → 世界 growth 0..5:树变大、地上多东西),不是 31 棵树。

## 一次性项目 = 访客,不是列表项
- 项目达到 unlockAt 时,对应角色**走进画面**(从边缘慢慢走到相关地点旁),头上 `…` 气泡。同时最多 1 位在等。
- 点角色 → 同一张底部卡片,换成"对话":2–3 行台词 + 两个按钮:`成交 (价格)` / `改天吧`。`改天吧`:角色走开,约 90 秒后再来(UI 层计时,core 不管)。
- 成交后角色留在画面里做一个小动作(牛顿午睡、金苹果挂树上闪、发布会舞台亮灯……),可点一下听一句彩蛋台词(飘字,不打断)。
- 禁果:夏娃 + 蛇来三次,每次一口,台词不同。
- 台词见 `brainstorm/v3-copy.md`(lead 提供,字符串只读 core,UI 通过 `src/core/copy.ts` 取)。

## 风格
- 纸白底 `#f4f1ea`,墨黑描边,灰阶填色,三级描边(树 3px / 景物 2px / 远景无)。**红 `#d9342b` 只给苹果(和礼盒)**;金苹果用白底+金色描边的高光,不要大面积金色。
- 夜晚:深灰底 `#17181c`,线条变米白,苹果仍红。
- 季节只靠树冠形状/落叶/雪表现,不靠颜色。

## 动效(去抖)
- 禁止:整屏 translate/shake、高频抖动(>3Hz 的位移)、每帧全屏粒子。
- 树:摇一下时树冠 0.4s 内摆 ±1.5° 并回正,苹果掉落;空闲时树冠 12s 周期 ±0.4°。
- 其它地点:只有"在产出"时才有慢动作(老徐挥一下手、风铃轻摆),周期 ≥3s。
- 活动均匀:每个已买升级的地点,每隔几秒往树下篮子飞一个小苹果(沿虚线弧线),让整个画面都有一点点动,而不是一半动一半静。
- 同屏粒子 ≤60,掉落 ≤12,飘字 ≤4;30fps 空闲、交互后 2s 60fps、5s 无交互 20fps、页面隐藏停 rAF。

## 需要的 Orchard 接口(main.ts 来接)
```ts
type PlaceId = 'tree'|'hut'|'mailbox'|'chime'|'pond';
interface PlaceView { visible:boolean; owned:number /*该地点升级总等级*/; canBuy:boolean /*小红点*/; }
interface VisitorView { id: ProjectId|'eve'; place: PlaceId; state:'hidden'|'waiting'|'staying'; bite?:number }
interface WorldView { places:Record<PlaceId,PlaceView>; stage:0..5; visitors:VisitorView[]; goldenOnTree:boolean; cookActive:boolean; sleeping:boolean; rate01:number }
class Orchard {
  setWorld(w:WorldView):void; setClock(tSec:number):void; seasonLock:number|null; christmas:boolean; reducedMotion:boolean;
  onPlace:(id:PlaceId)=>void; onVisitor:(id:string)=>void; onGolden:()=>void;
  pointer(px:number,py:number):'place'|'visitor'|'golden'|'event'|'tree'|'none';
  poke(strength?:number):void; drop(n?:number):void; floatText(text:string,x?:number,y?:number):void; say(visitorId:string,text:string):void;
  spawnEvent(kind:'bird'|'courier'|'star',cb:()=>void):void; eventActive():boolean; frame(dtSec:number):void; resize():void;
}
```
卡片 DOM 由 ui-designer 在 index.html 里做:`#card`(hidden 默认)、`#cardTitle`、`#cardBody`(main.ts 往里填 `.row` / `.say`,类名由你定义并写进 ui-v3.md)、`#cardClose`。
保留:`#apples #rate #goalBar #toast #settings #btnExport #btnImport #btnReset #btnSound #saveWarn #debug #weather #stage`;`#lamps/#handle/#optNumbers/#exactApples` 不要了(数字始终显示)。

## 产物
index.html、src/ui/*(新 orchard.ts 等)、preview.html(可模拟 `?place=hut&card=1`、`?visitor=cook&state=waiting`)、brainstorm/ui-v3.md、shots/v3_*.png(390×844 白天/夜晚/卡片/访客对话/圣诞夜,844×390,1280×800)。
**不要碰** src/core、src/main.ts、tests、scripts。完成后 `npx tsc --noEmit` 只会因 main.ts 报错,不用管。
