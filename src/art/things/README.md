# art/things 运输 API

```ts
import { drawTransport, TRANSPORT_ORDER, TRANSPORT_W } from './art/things/index.ts';
drawTransport(ctx, 'truck' /* 名字或档位序号 0..8 */, x, y /* 底部中心 */, s, {
  t,        // 动画秒(轮转/浪/旋翼/步伐)
  move: 0-1,   // 行驶/飞行/行走强度
  load: 0-1,   // 载苹果比例(0 空载)
  unload: 0-1, // 一次性卸货进度,苹果飞出/落下
  pulse: 0-1,  // 一次性"装货弹跳",每装一箱从 0→1
  dir: 1|-1,   // 朝向(默认向右)
  seed, alpha,
});
```

| 档 | kind | 宽(单位) | 建议速度(单位/秒) | 建议容量(苹果/趟) | 动画 |
|---|---|---|---|---|---|
| 0 | basket 篮子 | 18 | 0(手提) | 8 | 苹果颠动 |
| 1 | porter 挑扁担工 | 36 | 22 | 20 | 步伐、扁担弹跳、筐摆 |
| 2 | cart 小推车 | 34 | 30 | 40 | 轮转、车身颠 |
| 3 | trampoline 蹦床 | 50 | 0(原地,苹果弹到远处) | 60 | 床面下陷、苹果逐个抛物线飞出 |
| 4 | truck 卡车 | 70 | 55 | 120 | 轮转、俯仰颠簸、烟 |
| 5 | ship 货船 | 80 | 40 | 300 | 起伏摇摆、浪花、烟囱烟 |
| 6 | helicopter 直升机 | 76 | 80 | 500 | 旋翼模糊、悬停浮动、吊篮摆动、空投 |
| 7 | plane 飞机 | 84 | 130 | 1000 | 螺旋桨、起飞爬升、影子收缩 |
| 8 | portal 传送门 | 44 | 瞬时 | ∞ | 旋涡、pulse 白环闪 |

- 容量/速度仅为建议,数值由 systems 决定。
- 每档静态件走 `bake.ts` 缓存(key 含 seed,按 ctx 分辨率量化);扁担/旋翼/苹果每帧现画,确定性,无随机闪烁。
- 码头 6 档:`drawDock(ctx, tier, x, y, s, {crates, pulse, t})`。

## 老徐 v2(src/art/things/laoxu.ts)

大头 Q 版:草帽 + 黑墨镜(白反光线)+ 白胡子 + 背带裤,s=1 全高约 66 单位;(x,y)=脚底中心。

```ts
drawLaoXu(ctx, x, y, s, { lv: 1..8, state, t, seed, dir, p?, item?, tree? })
```

- `state`(LAOXU_STATES):`idle` 待机 · `cheer` 举手喊加油 · `beat` 打拍子 · `clap` 鼓掌跳 · `help` 扶树 · `shake` 抱树摇 · `sit` 掏马扎坐着(`item:'bottle'|'paper'` 喝快乐水/翻报纸)· `nap` 打盹 Zzz · `wake` 被叫醒喷出快乐水(`p` 不给则 3.4s 循环)· `watch` 抬头看热闹 · `coach` 小板凳 + 小徒弟代摇 · `retire` 躺椅 + 茶杯 + 收音机。
- `p`:sit/nap/coach 时 0..1 为"掏马扎"过渡(摸背后→掏出折扇状马扎→展开→滑到屁股下坐下),≥1 或不给=已坐;retire 的 p 为躺下进度。
- `lv`(LAOXU_LEVEL_NAMES):1 草帽 · 2 +肩毛巾 · 3 +帽带叶花 · 4 +怀表链 · 5 +金边墨镜/金扣 · 6 +金星徽章 · 7 +金帽带/帽檐金线/光点 · 8 +帽上金苹果 + 环绕光点。
- `tree:false` 不画 help/shake/coach 的示意树干(接入真实苹果树时关掉)。
- 道具(均可独立使用,(x,y)=底部中心):`drawStool({open})` 小马扎 · `drawBench` 小板凳 · `drawBottle({tilt,fizz,grip})` 快乐水瓶(手写字+一点红)· `drawTeaCup` · `drawRadio({on})` · `drawRecliner({layer})` · `drawApprentice({pose:'shake'|'idle'|'cheer'})` 小徒弟。
- `drawCharacter('xu', …)` 已委托给 drawLaoXu(缩放 0.62 与其他角色同高;pose idle/shake/catch/cheer/hit → idle/shake/help/cheer/wake,也可直接传 `state`)。其余 11 个角色头部整体放大到 hs=1.16(同一头身比)。
- 预览:`preview-art-things.html?sec=laoxu`。

## v6 新增(art-things)

全部由 `src/art/things/index.ts` 导出;签名 `(ctx,x,y,s,o?)`,(x,y)=底部中心(UI 卡/面板除外=左上角),确定性,预览 `preview-art-things.html?sec=<id>`。

### 运输 8 档 × 2 分支(transports8.ts / transport-v6.ts)
- `drawTransport8(ctx, tier 0..7, branch 0|1, x, y, s, o)`;`TRANSPORT8_ORDER/NAMES/BRANCH_NAMES/W/FLIES/SPEED/CAP`。
- 分支 0 = 经典造型,分支 1 = 搞笑造型(同尺寸量级,换车身/司机):篮子(背篓狗)、挑扁担(驴驮篓)、小推车(三轮小孩)、卡车(大板车壮汉)、货船(小黄鸭船)、直升机(竹蜻蜓小孩)、飞机(大纸飞机)、传送门(魔术帽)。
- 飞行档(`TRANSPORT8_FLIES`)用 `o.fly` 0..1 控制离地高度。
- 一趟 4 等长阶段:`runPhase(u 0..1, flies)` → `{phase 0..3,name,k,pos,dir,o}`;`o` 直接喂 drawTransport8(装货 load 0→1 / 行驶 move=1 匀速 / 卸货 unload 0→1 / 返回空车反向)。苹果数随 load/unload 可见变化。
- 车队:`drawFleet(ctx,tier,y,s,{n,cycle,x0,x1,branch,t,backLane})`:相位等间隔,最多画 4 辆,n>4 在 x0 侧标 "×N"。返回车道下移 backLane(默认 4)。
### 圣诞老人收货站 `drawSantaDepot(ctx,x,y,s,{level 0..1,receive,takeoff,sleigh,t})`(depot.ts)
木屋+传送带+小精灵 `drawElf` 递包裹,level=礼物堆高度(最多 10 盒),takeoff 0..1 雪橇升空远去(末档)。
### 鸟 `drawBird(ctx,x,y,s,{state:'perch'|'fly'|'takeoff'|'land'|'hit',kind:'sparrow'|'magpie'|'dove',p,t,dir})`(bird.ts)
翅膀扇动周期+身体起伏;`birdPath/birdFlight(u,x0,y0,x1,y1,arc)` 给弧线轨迹+朝向;`drawFeathers(ctx,x,y,p)` 点中掉羽毛。
### 彩蛋角色 `drawCharacterEgg(ctx,kind,x,y,s,{p 0..1,t,seed,dir})`(eggs.ts)
被点中 1~2 秒专属动作(时长 `EGG_DURATION[kind]`,台词 `EGG_LINES[kind]`);牛顿灯泡、圣诞老人掏礼物等。
### 老徐新站位 `drawLaoXuAt(ctx,'ground'|'treehouse'|'basket'|'top',x,y,s,o)`(laoxu-tree.ts)
自带前景件(树屋栏杆+灯笼/吊篮前沿+摇摆/树顶彩灯串+叶台),o 同 drawLaoXu(`state` 建议 watch/cheer/clap/idle,别用 shake)。锚点由 art-nature 的 `treeAnchors(tier)`(待提供,{treehouse,basket,top}→{x,y} 相对树根)给出,s 不要缩到 <0.7。
### 新阶段说明卡 `drawStageCard(ctx,x,y,w,h,{title,sub,lines,thumb(g,w,h),p,t,isNew,seed})`(stagecard.ts)
(x,y)=左上角;返回缩略图槽 [x,y,w,h];p 0..1 弹入(约 0.35s,之后停留 ~1s);thumb 回调已 clip 到槽内。
