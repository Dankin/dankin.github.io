# 《圣诞帽帽》团队协作手册（所有成员必读）

项目根：`/Users/bilibili/Documents/AI/christmas`　代码：`game/`（Phaser 3.90 + TypeScript + Vite 8）　设定文档：`docs/00~07、99`
dev server 已在后台运行：http://127.0.0.1:5173 （不要另起；改文件会热更新）。非 git 仓库，**改文件前先读，别覆盖别人的改动**。

## 1. 用户已拍板的目标（不可更改，需要变更就找 lead 问用户）
1. 6 条故事 + 终章全做完：小米(勇气·广场)、阿福(勇气·邮局弄堂)、老周(振作·面包街)、小蓝(振作·轮渡码头/老洋房阁楼)、阿冬(自强·人造雪场坡道，轮椅少年)、平安夜终章。主线约 30 分钟，通关后沙盒。设定见 docs/01、03、05、99。
2. 地图放大到 **约 60×40 瓦片**：6 个区块，每块 20×20（上排：广场/面包街/滨江坡道·人造雪场；下排：邮局弄堂/江边小桥/轮渡码头）。一屏要能同时看到更多人走动。
3. 画风改成**程序化手绘**（全部代码用 Canvas 生成，不依赖外部素材）：类《王国保卫战》的卡通手绘——高分辨率、抖动描边、水彩/纸纹肌理、色块叠加、暖色调、等距视角。替换现有像素画面。
4. 补 **存档**（localStorage + 导出/导入）与 **触屏操作**（手机横屏：点按、拖动镜头、双指缩放可选）。
5. 保持既有设定：帽子不能附身人；点物件附身、点地面飞行；每个故事 = 现象(sound/light/scent/lure/block/company)→NPC 反应→决心累积→本人迈出最后一步；幽默边界见 docs/05；终章最后一句 “May all the beauty in the world be blessed.”；简中文本全部走 `zh.json`；免费开源。

## 2. 角色与写入范围（互不重叠；要改别人的文件，发消息请对方改）
| 成员 | 职责 | 独占写入范围 |
|---|---|---|
| **lead**（我） | 总协调、与用户沟通、集成验收 | docs/TEAM.md、game/README.md |
| **product** 产品 | 故事/关卡/数值/文案/节奏设计，内容数据落地，验收体验 | `docs/**`（除 TEAM.md）、`game/src/data/**` |
| **dev-core** 开发（引擎） | 60×40 大地图、相机、渲染管线、性能、存档、触屏、UI(hud/bubble)、Game 场景 | `game/src/scenes/**`、`game/src/ui/**`、`game/src/core/{iso,data,bus,save}.ts`、`game/src/main.ts`、`game/index.html`、vite/tsconfig/package.json |
| **dev-story** 开发（玩法） | 故事系统、NPC AI、刺激/反应、招式特效(fx)、序列器、新玩法机制 | `game/src/core/{story,sequencer,stimulus}.ts`、`game/src/entities/**`、`game/src/fx/**`（新建） |
| **art-world** 美术（环境） | 手绘工具库 brush、地面/墙/道具/装饰/背景/天气纹理 | `game/src/art/{brush,world,scale,index}.ts` 及 `game/src/art/env/**` |
| **art-char** 美术（角色/UI） | 手绘角色(NPC、帽子 6 阶段)、表情、UI 皮肤图标、特效贴图 | `game/src/art/{chars,hat,ui,fxart}.ts` 及 `game/src/art/char/**`；原 `pixel.ts` 在新版接入后由 art-char 删除 |
| **music** 音乐音效 | 全部合成音频：主旋律多层变奏、区域氛围、故事动机、SFX、混音 | `game/src/core/audio.ts`、`game/src/audio/**` |
| **qa** 测试 | 自动化/人工测试、回归、性能、触屏、存档、缺陷单 | `game/tests/**`、`game/src/debug/**`、`docs/qa/**` |

共享文件冲突处理：需要别人范围内的改动 → `send_message` 给对方，写清“文件:行、要改成什么、为什么”。**不要**直接改。例外：lead 可在集成阶段做小修。

## 3. 接口契约（先看现有代码再动手）
**3.1 美术缩放**：当前像素纹理按 `setScale(2)` 显示。新规：`game/src/art/scale.ts` 导出 `PX=2`（原像素的显示倍率）与 `SS=3`（手绘超采样倍率），`ART_SCALE = PX/SS`。**所有纹理按“旧源尺寸 × SS”绘制**，引擎里原来写死的 `setScale(2)` 一律改成 `ART_SCALE`。这样纹理键与布局不变，只是更精细。art-world 第 1 步建好 scale.ts 并通知 dev-core/dev-story/art-char。
**3.2 地面分块**：60×40 整图太大，art-world 提供 `buildGroundChunks(snow:boolean)`，返回 `{key,x,y,w,h}[]`（世界像素位置，按 10×10 瓦片切块，不超过 2048 边），Boot 注册、Game 摆放；dev-core 与 art-world 商定。
**3.3 纹理键**：保持现有键（`p_<tex>`、`c_<npc>_0/1`、`hat_<stage>`、`wall_<ne|nw>_<a-d>`、`p_glow` 等）；新增键由 art 同步写进 `docs/art-assets.md`（art-world 维护表头，art-char 追加），product/dev 引用前先查表。
**3.4 数据驱动**：内容只放 `src/data/*.json`，由 product 维护；需要新机制（新 fx、新 sequence 动作、新 reaction.do）→ product 在 `docs/ENGINE-REQUESTS.md` 追加条目并发消息给 dev-story，dev-story 实现并在 `data.ts` 校验里登记（经 dev-core 同意，或由 dev-story 把校验扩展点放到自己范围的 `core/story.ts`）。
**3.5 音频 API**：保持 `audio.unlock/setMuted/setRain/setLayer/tone/noise/playPhrase/theme/sfx`；music 新增 `audio.setRegion(id)`、`audio.storyDone(id)`、`audio.setWarmth(v)` 等，写进 `docs/06-音频与美术.md` 末尾的“音频 API”小节，dev-core 在 Game 里调用。
**3.6 测试钩子**：Game 场景需暴露 `window.__game`（已有）。qa 需要的额外钩子（传送帽子、快进时间、读取存档、导出状态）由 qa 写在 `src/debug/testApi.ts`（只读/调试用），dev-core 在 main.ts 里按 `?debug=1` 或 dev 环境动态 import。
**3.7 世界坐标**：瓦片坐标 (tx,ty)，`toScreen(tx,ty)={OX+(tx-ty)*32, OY+(tx+ty)*16}`；`WORLD_W/H` 来自 `core/data.ts`。60×40 后 `config.json` 的 `regions[*].map` 为 20×20；product 负责地砖与布局内容，dev-core 负责校验与拼接。

## 4. 里程碑与完成定义
- **M1 基础（并行）**：scale.ts+brush 工具库；60×40 地图数据+引擎适配+相机/性能；故事规格(docs/08)；音频 API 设计；QA 测试框架与测试计划。
- **M2 内容**：5 条故事 + 终章数据与机制落地；全部纹理手绘化；各区域/故事音乐；存档与触屏。
- **M3 集成测试**：qa 全流程实机点击通关（无脚本捷径）+ 回归 + 性能 + 触屏；缺陷分级(P0 阻塞/P1 严重/P2 一般/P3 体验)，P0/P1 清零才可交付；art/product 做视觉与体验验收。
- **M4 交付**：lead 汇总向用户汇报（含截图、通关路径、已知问题）。

**通用完成定义**：`npx tsc --noEmit` 无错误；浏览器无 console error/pageerror；所有文案走 zh.json；不新增 npm 依赖（需要先问 lead）；改动在自己范围内；改完更新你负责的文档并向 lead 汇报“做了什么/怎么验证/遗留”。

## 5. 工作规则
- 同时多人改代码，中间态可能短暂编译不过：用 `npx tsc --noEmit` 看**自己范围**的错误；别人的错误先别管，持续 >10 分钟再发消息提醒。**不要运行 `npm run build`**（会写 dist，与他人冲突）；需要整体构建验证时只由 qa 与 lead 执行。
- 无头浏览器验证：用 `game/tests/` 里 qa 提供的脚本；在 qa 脚本就绪前可用 `/tmp/pw`（playwright-core + `/Applications/Google Chrome.app`，参数 `--use-gl=swiftshader --enable-unsafe-swiftshader`，命令 `cd /tmp/pw && node xxx.mjs`），截图放 `/tmp/shots/<你的名字>/`，避免互相覆盖。
- 阻塞/需用户决策的问题：发消息给 lead（带选项与推荐）。lead 统一向用户提问。
- 进度汇报：每完成一个里程碑小项就向 lead 简报一句（文件、结果、遗留）。不要等全做完再说。
- 手绘的美术标准：不是“把像素放大”。要有可见的手绘感：非完美直线（低频抖动）、描边粗细变化、深色暖棕描边而非纯黑、色块有笔触/纸纹/渐变阴影、高光小块、统一光源（左上暖光）、统一色板（见 docs/06）。
