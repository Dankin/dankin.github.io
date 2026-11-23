# UI v4 接口说明(ui-designer)

一条连续的传送线:左 生产(6 档)→ 中 路线(6 档运输 + 3 个关卡)→ 右 码头。横屏手机优先,竖屏为 S 形折返,同一套 DOM。黑白线稿 + 红苹果,深色是直接换调色板(不是反色)。

## 文件
- `index.html`、`src/ui/ui.css`:顶栏、底栏、关卡抽屉、分支卡、设置。
- `src/ui/orchard.ts`:场景引擎。`pen.ts` 画笔与主题;`sources.ts` 6 档生产+库存堆+摇劲条;`route.ts` 6 档运输工具/码头/关卡图标。
- `src/ui/ending.ts`:`showEnding(s:{elapsedMs:number;clicks:number}, onClose, onRestart)`,不再依赖 core。
- `preview.html` + `src/ui/preview.ts`:假数据演示。参数 `src rt dark veh unit br stock fw combo gu gates event reduced dev=0 pick=gate|branch`;`dev=0` 隐藏切档面板。
- 旧 v3 UI 备份在 `ref/v3ui/`;已删除 chars/draw/style/landmarks/tree/sky/visitors。

## WorldView(main.ts 从 State 映射)
```ts
interface WorldView {
  srcTier: number;        // 0..5 老树/果园/果山/果城/果星/苹果之门
  srcUnits: number[];     // 每档已买单位数(画面里的树苗/梯田数量等)
  srcBranch: number[];    // 每档分支 -1|0|1
  rtTier: number;         // 0..5 篮子/推车/卡车/货船/飞机/传送门
  rtVehicles: number;     // 当前档运输工具数(画面最多 5/5/5/3/3/10 个,其余变成排队圆点和 ×N)
  rtBranch: number;
  gates: (string|null)[]; // 3 槽:wash wax juice pack cold rush string
  gatesUnlocked: number;
  stock01: number;        // 库存/上限 0..1,决定苹果堆高度,满了显示"满了"
  produce: number; carry: number; // 每秒产量/运力,用于瓶颈提示("运不完 →"/"货不够")
  shake: number;          // 0..1 摇劲(连续摇树累积,慢慢衰减),树旁小计量条
  combo: number;          // 连摇次数,>=2 时显示"连摇 ×N"
}
```
`EMPTY_WORLD` 可作初值。

## Orchard
- 构造 `new Orchard(canvas#stage)`。回调:`onShake(strength?)`(点画布空白处/树/生产区,或按空格;strength 恒为 1,为手机摇晃预留。Orchard 自己只让树轻晃,苹果由 main 调 `poke()` 弹出)、`onGate(slot)`(点关卡,main 打开 #gatePick)。没有画圈手势,也没有 onCrank/onTap。
- `shakeTap()` 公开方法:等同一次点击摇树(main 的"摇"按钮或手机摇晃可调它)。
- 属性:`reducedMotion`、`dark`(setter 会换调色板;main 同时给 `<html>` 加/去 `dark` 类)。
- 方法:`setWorld(wv)`(档位/数量/车辆/关卡变化时自动播放弹出与涟漪)、`resize()`、`frame(dtRaw)`(每帧由 main 调,内部自适应 60/30fps,隐藏时跳过)、`poke(n=2)`(点击出苹果)、`burst(n=3)`(连摇达到阈值时,苹果越过路线飞向码头)、`floatText(s,wx?,wy?)`、`spawnEvent('bird'|'newton'|'meteor', cb(hit))`(点中 cb(true),超时 cb(false))、`eventActive()`(是方法)、`hitTest(px,py)`、`worldPos()`、`gateScreen(slot)`(关卡屏幕坐标,可用来定位 #gatePick)。
- 性能:粒子≤56、飘字≤4、飞行苹果≤14、车辆可见数有上限,无 shadowBlur、无屏幕震动;背景离屏缓存。

## DOM id / class
- 顶栏:`#apples`(数字)`#goalNum`(文本如 "/ 82亿")`#rate`(如 "每秒 31")`#goalBar`(设宽度%)`#btnSettings`。
- 底栏按钮 `#btnSrcBuy #btnSrcUp #btnRtBuy #btnRtUp`:内含 `.nm`(名称)、可选 `.pv`(第二行,用大白话写下一次效果,如 "+12% 产量";空时自动隐藏)、`.pr`(价格);状态类 `can`(可买,呼吸)`no`(买不起,灰)`max`(满级)`has-branch`(显示"二选一");点击反馈给按钮加 `pressed` 约 0.45s。
- 关卡槽 `#gate0..2`(`.nm` 填关卡名):类 `empty`(虚线 "+")`on`(已装)`locked`(未解锁)`can`(有可装的)。点击由 main 绑定(orchard.onGate 只管画布上的关卡)。
- `#gatePick`(`hidden` 属性控制显示)`#gatePickTitle`,`#gateOpts` 里放 `button.opt`(`<b>名称</b><span>说明</span>`,状态 `on/no/none`)。点空白/✕/Esc 由内联脚本关闭。
- `#branchPick`(`hidden`):`#branchTitle #branchSub`,`#branch0 #branch1`(`.bcard[data-branch]`,内含 `.nm .desc .pr`,状态 `can/no`),`#branchCancel`。选择由 main 绑定。
- 设置 `#settings`:`#btnTheme #btnSound #btnExport #btnImport #btnReset #saveWarn #debug #btnCloseSettings`。
- 其他:`#toast` 加 `show` 类显示;`#apples` 加 `bump` 类数字弹跳(动画结束后移除);阶段升级给 `<body>` 加 `stageup` 类 1.2s。
- 页脚声明:设置里 `.foot` "原创小游戏,与苹果公司无关。"

## main.ts 需要做的事
1. 删掉旧调用:`setClock/crownPos/christmas/setSources/highlight/hitFairest/gravityHit` 等已不存在;`showEnding` 传 `{elapsedMs: Date.now()-state.startedAt, clicks: state.clicks}`。
2. 每次 tick/购买后:构造 WorldView 调 `orchard.setWorld`;更新顶栏与 4 个按钮(文字+类)、关卡槽类、`#goalBar`。
3. `orchard.onShake = () => { core.shake(state); orchard.poke(2); }`;连摇达到阈值时 `orchard.burst()`;`WorldView.shake` 填摇劲 0..1,`combo` 填连摇数。
4. `orchard.onGate = slot => ` 填 `#gateOpts` 并 `#gatePick.hidden=false`;定位可用 `gateScreen`,CSS 默认固定在底栏上方居中。
5. 升级按钮若有分支:填 `#branch0/1` 后 `#branchPick.hidden=false`。
6. 主题:`orchard.dark = d; document.documentElement.classList.toggle('dark', d)`;`#btnTheme` 在 自动/浅/深 间循环。
7. 事件:`orchard.spawnEvent(kind, hit => …)`,`orchard.eventActive()` 为 true 时不要再触发。
8. 每帧 `orchard.frame(dt)`;窗口变化 `orchard.resize()`。

## 已知不足
- 每档生产/运输的"分支"只对部分档有明显画面差异(果园温室、果山缆车/隧道、果城烟囱/金光、果星星舰)。
- `.pv` 第二行由 main 填文字,没填就只显示名称+价格。
- 真机未测,只做了 Chrome 无头截图;手机摇晃尚未接入(留了 shakeTap())。
