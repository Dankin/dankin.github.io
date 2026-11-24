# 40 技术方案(v5)

## 1 现状
- core 纯逻辑(game.ts 697 行,tests 699 行);ui 全 Canvas 程序化线稿,零位图;audio 纯 WebAudio 合成。
- 问题在两端:main.ts 991 行(存档/toast/事件/DOM/调试/循环混杂),ui/orchard.ts 1248 行(布局/手势/动画/粒子一个类)。
- SAVE_VERSION=3,migrations 为空,fillDefaults 手工补字段。
- 债:EventKind/闸门 id 在 core/ui 各一份;pen.ts 可变全局;无事件总线,main 靠轮询触发提示;smoke 手写 CDP;无 CI,手动推 dist。

## 2 改造
阶段 0:main.ts 拆成 src/app/*(boot、loop、hud、toast、dialogs),行为不变,smoke 全绿再并行。

经济(R3):State v4,`coins`→`bank`(手上可花),`delivered` 只增,新增 `spent`;stock 在 UI 叫"堆场"。顶栏常驻"手上 / 累计送出",购买飘 -N。迁移 `bank=coins, spent=0`。不变量:购买只减 bank,bank≥0,delivered 单调。
事件总线(R8):`core/bus.ts`,由 app 层 emit,core 保持纯。
`type Ev={t:'shake'}|{t:'delivered';n:number}|{t:'bought';line:LineId;cost:number}|{t:'tierUp';line:LineId;tier:number}|{t:'visitor';kind:EventKind}|{t:'apple';variety:string}`;`bus.on(t,f):()=>void`、`bus.emit(e)`。
成就/图鉴:`meta/codex.ts` 订阅 bus;`State.meta={eggs:Record<string,number>,beats:string[],varieties:string[]}`;数据 `content/eggs.ts`:`{id,title,hint,trigger,text}`。
新闻(R5):`ui/ticker.ts`,DOM 单行 + CSS translateX。`ticker.push({text,prio})`;题库 `content/news.ts` 带 `when(ctx)`,同条 30 分钟不重复。
旁白(R4):`story/narrator.ts`,节拍 `{id,on:Trigger,lines,once}`,字幕 #caption 在场景下沿,不打断摇树,已播存 meta.beats。
苹果多样(R6):不逐个持久化。`core/apples.ts`:`Variety{id,name,hue,size,rarity,valueMul,minTier}` + 修饰 golden/frost/wormy。数值只用期望价值 E[v] 进 appleValue,fluid 闭式结算仍成立;抽样只管画面和稀有掉落。
美术(R7):保留 Canvas,改 drawImage 图集。`art/src/*.png`(2x)→`scripts/pack-atlas.mjs`(WebP q80)→`public/atlas/{core,e1..e5}.webp+json`→`src/art/atlas.ts`。core 首屏加载,e1..e5 进入时代前预取。过渡:线稿与彩图按档位逐步替换。
音频:GameAudio 加 `voice(id)`、`duck(db)`;music/sfx/voice 三条增益;配音懒加载 m4a,每句 ≤15KB。
目录:src/{core,app,meta,story,content,art,audio,ui/draw}、art/src、public/atlas、tests/{unit,e2e,fixtures}。

## 3 单文件 vs 多文件
base64 膨胀 33%,不能懒加载,改一处整页缓存失效,iOS 解析巨型 HTML 易白屏。彩色美术预估 1.5–3MB,单文件不可行。
推荐放开:index.html 内联 JS/CSS(gzip ≤150KB),图集带 hash 按需 fetch;另留 `build:single`(内联 core 图集,可双击、备份)。保留上一版 assets 一周防旧页 404;Service Worker 推到 v5.1。预算:core ≤250KB,每时代包 ≤300KB,配音 ≤600KB,总 ≤3MB。

## 4 性能
- iPhone 15 Pro:封顶 60fps(不跑 120Hz),p95 帧时间 ≤16.7ms。
- 低端(CPU 6x 节流):p95 ≤33ms;帧时间 EMA>24ms 持续 2 秒则减粒子、dpr≤1.5、锁 30fps。
- 背景离屏缓存;精灵 ≤400/帧,粒子 ≤150;解码位图 ≤64MB(2048² 图集 16MB)。
- 电池:隐藏页 suspend AudioContext 并停 25ms 调度器(现仍在跑);10 秒无输入降 30fps。
- 测量:`?perf=1` 输出 p50/p95/p99;`scripts/perf.mjs` 用 CDP 节流跑中后期存档 60 秒;真机用 Safari Web Inspector 与 Instruments Energy。

## 5 测试与发布
- 单测:加 v3 迁移夹具(new/mid/won)、账本不变量、品种 E[v]、旁白 once、成就触发。sim:CI 门限通关 55–65 分钟。
- Playwright 替换手写 CDP,WebKit 覆盖 iOS Safari:iPhone 15 Pro 横/竖、桌面 1280×800、低端节流。视觉回归 `toHaveScreenshot`,固定 `?seed ?freeze=1 ?date`,阈值 0.02,基线入库。
- 迁移/离线:注入 v3 存档与导出串;setOffline;file:// 加载 single 版。
- CI(Actions):tsc→单测→sim→build→Playwright。发布:`v5.x` tag 触发,先发 main 的 `/beta/` 给用户试玩,确认后发根目录。回滚:部署前给 main HEAD 打 `live-YYYYMMDD-HHMM` tag,回滚=恢复 main 到该 tag(需用户确认)。

## 6 分工(同一目录,按所有权)
- 集成(lead):src/app、core/{state,save,constants,bus}.ts、package.json、vite.config.ts、.github;存档 schema 只此人改。
- 数值:core/{game,content,apples}.ts、scripts/sim.ts、tests/unit。
- 美术:art/、public/atlas、src/art、src/ui/draw。叙事:src/content、src/story、core/copy.ts。
- UI:index.html、*.css、ticker/caption/codex。音频:src/audio。QA:tests/e2e、scripts/{perf,pack-atlas}.mjs。
约定:分支 `v5/<area>`;提交前缀 `core: art: ui: story: audio: qa: build:`;只 `git add <自己目录>`,禁 `add -A`、`reset --hard`;跨目录改动找所有者;bus/atlas 骨架阶段 0 先落地。

## 7 风险与拍板
- 放开单文件?推荐放开,留 build:single。
- 美术谁出?最大风险。推荐先出"树+苹果+一辆车"样张验证风格与体积。
- 经济改动会动平衡,sim 重调约 +2 人日。推荐 bank 叫"手上的苹果"。
- 旧存档迁移保留;新增 devDependency(@playwright/test、sharp);配音推后,v5 用合成音+文字旁白。均推荐。
- 工期:推荐 12/10 功能冻结,12/17 RC;礼物文字不入构建。

## 8 工作量(人日)
拆 main 2.5;经济+迁移+重调 4.5;新闻 1;旁白 2;彩蛋/成就 3.5;品种 2;图集管线 3;渲染层改位图 7;音频 1.5;测试/CI 4;性能 2;集成 4。合计约 35,五人并行约 10 个工作日,不含美术资产制作。
