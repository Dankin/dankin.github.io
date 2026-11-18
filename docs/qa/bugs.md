# 缺陷表（qa 维护）

等级：P0 阻塞（崩溃/无法通关/存档损坏）· P1 严重（主线失败、UI 遮挡、明显穿帮、触屏不可用）· P2 一般 · P3 体验
状态：Open / Fixed（待复验）/ Closed / WontFix / Dup
**交付门槛：P0/P1 全部 Closed。**

| 编号 | 等级 | 模块/负责人 | 标题 | 状态 | 发现版本/日期 |
|---|---|---|---|---|---|
| BUG-001 | P2 | dev-core | 静音/调试按钮过小（23×24 / 21×20 px），触屏远小于 44px | Closed（15:50 复验：16-touch ≥44px 通过） | v0.2 · 11-18 |
| BUG-003 | P2 | dev-core | 招式面板与路人气泡重叠（面板 vs aunt 气泡 7034px²；气泡 niuniu↔aunt 495px²） | Closed（15:50 复验：02/03/04/05/06 通关全程 0 overlap） | v0.3 · 11-18 |
| BUG-004 | P2 | product(zh.json)/dev-core | 文案 key 外露：NPC 气泡显示 `[idle.doudou]`、`[idle.q1]`、`[idle.kevin]`、`[idle.driver_zhang]`、`[idle.jogger]`；校验报缺少 `move.fish_swing/alley_post/radio_lullaby/bone_toss/lamp_apron…` | Closed（15:50 复验：所有故事 spec 文案外露 0） | v0.3 · 11-18 |
| BUG-005 | P2 | dev-core | NPC 气泡压住右上角小地图（hud:minimap × bubble:balloon_man 8172px²） | Closed（15:30 复验：0 minimap overlap） | v0.3 · 11-18 |
| BUG-006 | P2 | dev-core | 屏幕左上角 NPC 的气泡压住暖度条/清单（bubble:balloon_man [6,33,222,75] × hud:warmth/hud:checklist 6835px²） | Closed（15:30 复验：06 PASS 9/9 0 overlap） | 14:58 |
| BUG-007 | P2 | dev-core | 通关后结尾面板永不弹出（banner.done≠banner.complete） | Closed（15:59 复验 07 PASS 15/15） | 15:40 |
| BUG-008 | P3 | dev-core | 竖屏 390×844：清单展开占半屏且与 toast 重叠（hud:checklist [27,103,524,807] × toast:0 4021px²），无“请横屏”提示 | Closed（16:25 复验 10 PASS 20/20） | 15:50 |
| BUG-009 | P1 | dev-story | 阿福 lull 后偶发卡在半路（idle 不动），enter 步骤永不完成 → 主线无法继续（老周等后续故事不会激活） | Closed（18:20 复验：03/04/05/06/07 链式通关均未卡死，复现脚本 6/6） | 16:24 |
| BUG-010 | P2 | dev-core | 提示 toast（“雪人似乎想参与点什么。”）与路人气泡重叠（toast×bubble:tourist2 1713px²、×bubble:uncle_wu 1811px²），气泡压住/被压住 toast 文字 | Closed（18:05 复验：07 PASS 16/16，toast×气泡 0 重叠） | 17:15 |
| BUG-011 | P3 | dev-story | 阿福 lull 后走向 [2,34.6] 的看门狗（walkGuarded）几乎每次通关都触发 1 次 warp（03/05/06/07 全程均 afu:1），说明路径/估时本身有问题，玩家会看到阿福瞬移 | Closed（19:15 复验：dev-story 加 losWide 后 04/06 链式 afu warps=0） | 17:15 |
| BUG-019 | P2 | product(zh.json)/dev-core | 文案 key 外露：帽子升级 toast 显示 `[ui.hat_stage3]`/`[ui.hat_stage4]`/`[ui.hat_stage5]`/`[ui.hat_stage6]`（zh.json 只有 hat_stage0/1），阿冬线气泡 `[say.adong_mine]` | Closed（18:05 复验：05/07 通关全程 textLeaks=0，终章帽子升级 toast 无外露 key） | 11-18 17:30 · play |
| BUG-020 | P2 | dev-story/product | 彩蛋「弄堂群聊」alley_chat 真实游玩无法触发：弄堂内没有任何大声源，广场喇叭距阿婆约 21 格 > 半径 12 | Closed（18:20 复验：03 真实点击 bone_bucket→踢一脚桶 勾上 alley_chat；注意仅限弄堂 NPC 在位时，见 BUG-028） | 11-18 17:30 · play |
| BUG-021 | P2 | dev-story/product | 彩蛋「排队崩了」queue_dead 无法触发：面包香最远只到 q1 前约 22 格 > 半径 18；老周烘焙时 q1/q2 处于 scripted 不响应；规格要求的“树发光”也未参与 | Closed（18:15 复验：04 老周线后点烤箱「扇出面包香」勾上 queue_dead） | 11-18 17:30 · play |
| BUG-022 | P3 | dev-story | 小米前奏（speaker_prelude）在 calm 后约 10–20s 内按下无任何反馈（静默失败），玩家不知道要等；`say.xiaomi_crowd/startle` 存在但未出现 | Closed（18:23 复验：spec 19 提前按前奏 1.5s 内出现新文案反馈） | 11-18 17:30 · play |
| BUG-023 | P3 | dev-story/product | 小蓝 pose 在 bike 步骤刚结束（flag bike_parked 未置位）时点击静默无效，规格要求的“……缺点什么。”不存在于 zh.json | Closed（M3 20:00 复验：spec 20，门未开点“摆姿势”冒“……缺点什么。”） | 11-18 17:30 · play |
| BUG-024 | P3 | dev-story | 阿冬线：公交到站前（约 126s）阿冬不可见，玩家无事可做，20/60s 提示仍指向 bus_ramp/lamp_s1，无“车还没到”反馈，空等约 2–2.5 分钟 | Closed（M3 20:00 复验：spec 20，到站后 ramp 提示指向 bus_door；到站前无误导提示） | 11-18 17:30 · play |
| BUG-025 | P3 | dev-story | 隐藏彩蛋 bread_fusion/halo_snowman/record_run 只在各自故事进行中有效（story.ts:149 故事 finished 后不再监听），光环雪人窗口仅约 10s（pose→paint），错过后永久无法获得，且无任何提示 | Closed（M3 20:00 复验：spec 20，小蓝完成后转镜子仍得 halo_snowman） | 11-18 17:30 · play |
| BUG-026 | P3 | product/dev-story | vend_blind「贩卖机的小失误」为随机（2/7 每次），规格是连按 3 次必出；实测 14 次未出、另一轮第 11 次才出 | Closed（18:23 复验：spec 19 贩卖机第 3 次必出 vend_blind） | 11-18 17:30 · play |
| BUG-027 | P3 | dev-core | 通关结尾面板弹出时存档→刷新→继续：面板不再出现，直接进沙盒，只能回标题点“新游戏”才能再玩一次 | Closed（18:10 复验：spec 18 PASS 7/7：存档 ended=true→刷新→继续重弹→继续散步→再刷新不弹） | 11-18 17:30 · play |
| BUG-028 | P3 | dev-story | 老周线 crowd 步骤把吴大爷 uncle_wu、秦阿婆 granny_qin 拉到广场（实测 noon 在 (21.6,13.8)/(20.3,15.3)）后不再回弄堂，彩蛋 alley_chat（需二人在弄堂听到踢桶）此后无法触发 | Closed（19:15 复验：04 老周线后弄堂群聊可触发） | 18:20 |
| BUG-029 | P3 | dev-story | 阿东线（06）通关途中气球人 balloon_man 看门狗瞬移一次：[warp] balloon_man → (47.2,15.1) from (20.8,12.6)（26 格外，t=323s），玩家可能看到其凭空消失 | Closed（19:15 复验：06 通关 NPC warps=0） | 18:20 |
| BUG-030 | P2 | dev-core | WebGL 上下文在启动期丢失（pageerror `Framebuffer status: Framebuffer Unsupported` + `WebGL Context lost`）后游戏永久停在深色空屏，无任何提示、不重试（生产构建，headless Chrome legacy `--use-gl=swiftshader` 复现 3/5，angle 0/12；需真机复核） | Closed（M3 19:50 复验：强制丢上下文→首次自动重载一次，再次丢失出现“画面渲染中断了…[重新加载]”浮层，restoreContext 后浮层消失） | v0.3 · 11-18 |
| BUG-031 | P2 | dev-core / art-world | 启动期程序化生成 853 张纹理（≈165MB），在 GPU 加速 Canvas2D 下（SwiftShader）慢 ~20×（168s vs 9s，仅差 `--disable-accelerated-2d-canvas`）；Chrome 报 willReadFrequently 警告，低端手机有长黑屏/OOM 风险（待真机复核） | Closed（19:17 复验：dev 服务器 + angle/swiftshader 启动→可玩 ≈15s；01 冒烟 43.8fps；生产构建待 M3 复核） | v0.3 · 11-18 |
| BUG-032 | P3 | dev-core | 生产首屏无加载提示：JS 到达前纯深色空白（Slow 3G ≈9s），Boot 只显示 `…` + 进度条，index.html 无内联 loader / noscript | Closed（M3 19:35 复验：生产 dist 慢 JS 下首屏显示“🎅 圣诞帽帽 加载中…”，Boot 完成后移除） | v0.3 · 11-18 |
| BUG-033 | P3 | dev-core / lead | 生产构建带调试：`testApi`/`selftest` chunk 随 dist 发布，`?debug=1` 在线上可用并暴露 `window.__qa`（teleport/setPhase/resetSave 等作弊入口），`window.__game` 恒为全局 | Closed（M3 19:35 复验：生产 dist ?debug=1 → window.__game/__qa 均 undefined，无 testApi chunk；selftest 为音频内部 chunk，不对外暴露） | v0.3 · 11-18 |
| BUG-034 | P3 | qa | 测试基建：`testApi.ts` gameToPage 用主相机换算而 HUD 在 uiCam（Game.ts:90，zoom 1.0–1.9）上渲染 → 手机上 `uiButtons()/touchTargets()` 坐标/尺寸错误（偏小 L.z 倍，触屏点“继续”点不中）；`tests/lib/session.mjs` 默认 `--use-gl=swiftshader` 高负载下 2/3 概率 context lost → 套件“启动超时”误报 | Closed（qa：session.mjs 默认 angle+swiftshader，QA_GL=legacy 可回退；14-perf 桌面 44fps；testApi.gameToPage 仅 UI 坐标，当前用例不依赖） | v0.3 · 11-18 |
| BUG-002 | P3 | dev-core | 招式面板（两个大按钮）展开后盖住周边物件（如旁边的音箱），点被盖物件会被面板吞掉；需先点空地收起，玩家不易发现 | WontFix（P3，dev-core 确认按设计：面板需覆盖相邻物件；以点击空白处关闭为准） | v0.2 · 11-18 |

---

## BUG-001 触屏目标过小
- 复现：`?debug=1` → `__qa.uiButtons()`；或 844×390 触屏下看右上角按钮。
- 预期：所有可点按钮 ≥44×44 CSS px（计划 §1）。实际：mute 23×24、debug 21×20（逻辑 px，手机 FIT 缩放后更小）、清单头 103×15。
- 负责人：dev-core（已在做触屏，请一并处理）。

## BUG-002 招式面板盖住周边物件
- 复现：小米线 calm 步骤后，气球摊面板（放飞/戳破）仍打开；音箱（speaker）位于面板下方被遮挡，点击音箱落在面板按钮上。
- 截图：`game/tests/out/20261118-133359/02-story-xiaomi/desk-retry-melody-3.png`
- 预期：点另一个物件应直接切换附身（面板自动收起并命中被点物件），或面板不遮挡可点物件。
- 实际：点被盖区域 = 点面板按钮区域/吞点击。
- 备注：需要复验面板是否在“点别处”时关闭；测试脚本已绕过（先收起面板）。

## BUG-003 招式面板与气泡重叠（用户明确反馈过的问题）
- 复现：`node run-all.mjs --only 02`（小米线真实点击），步骤 calm 时附身气球摊打开面板，同时 aunt/niuniu 气泡弹出；`__qa.overlaps()` 报 `panel × bubble:aunt` 7034px²、`bubble:niuniu × bubble:aunt` 495px²（页面像素，1280×720）。
- 截图：`game/tests/out/20261118-135853/02-story-xiaomi/desk-overlap-first.png`（截图时气泡已漂移，贴在面板下沿；检测瞬间重叠更大）。
- 预期：面板打开时气泡避让面板区域（bubble.obstacles() 应含面板）；气泡之间不重叠。
- 负责人：dev-core（ui/bubble.ts / hud.ts）。

## BUG-004 文案 key 外露 / 缺文本
- 复现：进入面包街，截图 `/tmp/dbgout/p-after-monkey.png`（同类可在 `12-visual-overlap` 的 textLeaks 检查复现）；NPC 头顶气泡直接显示 `[idle.doudou]` 等未翻译 key。控制台 `[data] 校验问题: 缺少文本 move.fish_swing …`（01-smoke 报）。
- 预期：所有可见文字来自 zh.json；缺 key 时不外露（至少兜底成空）；数据落盘时 `validateData()` 无缺文本。
- 备注：product M2 数据落地中，可能是过渡期；若 M3 前仍存在则升 P1。自动检测：`__qa.textLeaks()`。

## BUG-005 气泡覆盖小地图
- 复现：`node run-all.mjs --only 10`，N-01 猴子 seed=2；`__qa.overlaps()`：hud:minimap [1044,70,1270,188] × bubble:balloon_man [1004,91,1208,141]。
- 预期：气泡避让 HUD（小地图/清单/按钮）；或至少 clamp 在安全区外。负责人：dev-core（ui/bubble）。

## BUG-006 气泡压住左上 HUD（暖度条/清单）
- 复现：06-story-adong 通关途中 t=277s（桌面 1280×720），NPC 气球人在屏幕左上边缘；`__qa.overlaps()`：hud:warmth [14,14,214,46] × bubble:balloon_man [6,33,222,75]；hud:checklist [14,54,276,796] × 同气泡。BUG-005 已让气泡避让小地图，但左上暖度/清单仍会被压。
- 预期：气泡避让全部 HUD 矩形（qaRects），或在 NPC 靠左上时把气泡移到 NPC 右/下。负责人：dev-core。

## BUG-007 通关后结尾面板永不弹出（banner key 不匹配）
- 严重度 P2，负责人 dev-core（Game.ts）/ dev-story（sequences epilogue）。
- 现象：07-story-finale 真实点击通关后，终章台词 "May all the beauty in the world be blessed." 正常出现，随后 epilogue 发 `banner.complete`（"平安夜 · 通关。"），但 `src/scenes/Game.ts:423` 只在 `key === 'banner.done'` 时延迟 6.2s 调 `hud.endPanel(...)`；`banner.done` 在任何 sequence 里都没被使用（仅 zh.json:107 遗留文案），因此结尾面板（重玩/关闭，`src/ui/hud.ts:309`）永远不出现。另外 `sub.finale_final2`（"愿世间所有美好，都被好好对待。"）在 sequences 中未使用。
- 预期：终章结束后出现结尾面板/或明确进入沙盒提示。若设计就是直接进沙盒，请去掉死代码并告知 QA。
- 复现：`cd game/tests && node run-all.mjs --only 07`（约 8 分钟）。状态：Open。

## BUG-008 竖屏体验（P3）
- 复现：`node run-all.mjs --only 10`，N-12 把视口 resize 到 390×844：游戏按 16:9 缩在屏幕中间，清单默认展开，qaRect hud:checklist [27,103,524,807] 盖住大半画面并与 toast:0 [416,80,864,140] 重叠 4021px²。截图 `game/tests/out/20261118-154515/10-negative/desk-resize-390x844.png`。
- 预期：竖屏给“请横屏游玩”的提示，或清单在小屏默认折叠；toast 不与清单重叠。负责人 dev-core，P3（目标平台为手机横屏）。

## BUG-009 阿福走向 [2,34.6] 途中卡住，enter 步骤无法完成（P1，间歇）
- 现象：小米通关后接阿福，lull（摇篮曲）完成后 `stories.json:156` 的 onDone 给阿福下 `goto [2.0,34.6] speed 1.1 stop 0.4`，阿福偶发停在 (3.02,28) tile 'c' 或 (5,29.93) tile 'k'，state=idle、moving=false，之后 90s 以上不再动，`enter`（arrive afu [2,34.6] r1.4，noHint）永不完成，afu_story 无法通关，phase 不推进，后续老周/小蓝/阿冬/终章全部不激活。玩家无任何提示，也无法补救（阿福不可附身）。
- 频率：真实点击链式通关中 3/9 次出现（05 一次、09 一次、/tmp 诊断脚本 2/2；单独跑 03 与不先通小米时 0/6）；`repro/afu-enter-stuck.mjs` 4/4 未复现，属竞态。
- 可能原因：goto 路径被动态障碍/其他 NPC 占格阻断后无重试或绕行；或 dog_asleep 与 goto 在同一帧冲突被取消。
- 截图：`game/tests/out/20261118-160812/09-stress-mainline/desk-inactive-bailout.png`；诊断日志 `/tmp/stress09.log`。
- 建议：goto 到达失败时超时重试/瞬移兜底（如 15s 未到则 teleport 到目标），enter 加兜底。负责人 dev-story。

## BUG-010 toast 与路人气泡重叠（P2）
- 复现：`node run-all.mjs --only 07`（链式通关到小蓝 pose 步骤时，约 182s）；截图 `game/tests/out/20261118-165444/07-story-finale/desk-overlap-first.png`。
- toast `[538,40,742,72]` 与 bubble:tourist2 `[540,8,728,49]`、bubble:uncle_wu `[638,54,812,96]` 重叠。预期：系统 toast 不被环境气泡遮挡（气泡避让 toast 区域，或 toast 层级最高且气泡在 toast 出现时让位）。负责人 dev-core。

## BUG-011 阿福 goto 看门狗每次都触发（P3）
- 现象：BUG-009 的兜底生效（不再卡死），但 `npcs.afu.warps` 在每次真实点击通关中都为 1（全量 run 03/05/06/07 均为 afu:1；终章内 abao/balloon_man/tourist1/mrs_ellis 的序列行走也各 warp 1 次，属终章 gather，可接受），说明 lull 后 goto [2,34.6] 本身多半走不通/估时偏短，靠瞬移兜底。建议排查目标点附近障碍（阿东出生点 [1.7,34.6] 与目标 [2,34.6] 几乎重合？）或放宽估时。负责人 dev-story，不阻塞。

## BUG-019 文案 key 外露（P2）
- 复现：真实点击通关。老周线结束 ~55s 时屏幕顶部 toast 显示 `[ui.hat_stage3]`；小蓝画完 `[ui.hat_stage4]`；阿冬赛后 `[ui.hat_stage5]`；终章 `[ui.hat_stage6]`；阿冬线开局 ~10s 气泡 `[say.adong_mine]`。
- 预期：显示中文帽子升级文案。实际：`Game.ts:419 this.hud.toast(t('ui.hat_stage' + n), 4)`，`zh.json` 只有 `ui.hat_stage0/1`，`say.adong_mine` 缺失。
- 截图：`game/tests/out/play/noon/noon-lz-done.png`。负责人 product 补文案，dev-core 可在 t() 缺 key 时回退。

## BUG-020 弄堂群聊 alley_chat 无法触发（P2）
- 复现：新档通关后沙盒中在广场按 speaker_blast（r12）、balloon_pop（r7）：阿宝/牛牛/阿姨有反应，吴大爷/秦阿婆（npcs.json:1160-1170/1229-1233，loud≥0.45 → alley_chat）无反应；弄堂（y 22–36）里没有任何 loud 招式（moves.json 仅 balloon_pop/speaker_blast/arch_pop）。
- 预期：docs/08:253“弄堂内大声（喇叭/炮）”可触发 +4 暖度。实际：喇叭到吴大爷约 21 格 > 12，清单永远勾不上（17 项只能勾 16）。
- 截图/日志：`game/tests/out/play/eggs.log`。负责人 dev-story：弄堂加声源或加大半径；product 同步规格。

## BUG-021 排队崩了 queue_dead 无法触发（P2）
- 复现：老周线结束后（oven_lit）在 bread_cart 按 bread_scent_re（scent bread 0.9 r18），再按 tree_twinkle：q1/q2 始终 idle 在 [33.6,4.4]/[34.6,4.6]，无“我不排了，我去那边闻闻。”，queue_dead 不勾（`game/tests/play/queue.mjs after-noon`，日志 `game/tests/out/play/queue.log`）。
- 原因：bread_cart [13.6,14.4] 到 q1 约 22 格 > 18；老周烘焙序列的香味（r34）发出时 q1/q2 是 scripted 状态，不执行 reaction（npcs.json:1690-1716）。规格 docs/08:346 要“香味+圣诞树发光同时”，实现并不需要树。
- 预期：玩家有可达方式勾上。负责人 dev-story。

## BUG-022 小米前奏过早按下静默失败（P3）
- 复现：新游戏 chime_ring → balloon_release，calm 后 2–3s（game≈9.5–10.5s）按 speaker_prelude：无任何台词/反馈，之后约 20s 才能再次成功（复现 4/4）。
- 预期：给“她还没安静下来”之类反馈（zh.json:50-51 的 say.xiaomi_crowd/startle 已有）。实际 story.ts:138 needQuiet 分支未出声。负责人 dev-story。

## BUG-023 小蓝 pose 过早点击静默无效（P3）
- 复现：小蓝 bike 步结束后立即点 snowman_r/snowman_pose_r：无反应（stories.json pose 的 gate flag bike_parked 尚未置位），需等车开走后重点。规格要求的失败台词“……缺点什么。”在 zh.json 中不存在。
- 负责人 dev-story/product。

## BUG-024 阿冬线空等与错位提示（P3）
- 现象：阿冬线开始后公交到站约需 126s 游戏时间，期间阿冬不可见，玩家只能干等；20s/60s 提示（bus_ramp、lamp_s1）已弹出但点了没有“车还没到”反馈（say.bus_wait 存在）。总用时 199.9s，其中约 150s 空等。负责人 dev-story。

## BUG-025 三个隐藏彩蛋有时限且无提示（P3）
- bread_fusion（只能在老周线结束前）、halo_snowman（pose 后至 paint 完成约 10s，且 mirror 为 noHint）、record_run（dusk 阶段阿冬线结束前，30s 内点亮 lamp_s2/3/4）。`story.ts:149 if (this.finished || ...) return;`，故事结束后不再监听，事后不可补。三项真实点击均已验证可勾（bread.mjs/halo.mjs/escort.mjs）。
- 建议：故事结束后保留监听，或在 docs 标注窗口。负责人 dev-story。

## BUG-026 vend_blind 随机概率（P3）
- 复现：save-after-finale，每 8.5s 按 vend_cookie：第一轮 14 次未出，第二轮第 11 次才出“咣当——掉了个空盒子。”（moves.json:239-266 pick w5:w2）。规格 docs/08:344 为连按 3 次随机掉出饼干/袜子/迷你树。
- 建议：改为保底（连按 3 次必出）。负责人 product/dev-story。

## BUG-027 结尾面板刷新后不恢复（P3）
- 复现：通关 banner 后约 6s 面板出现时存档→刷新→继续：phase night，面板不弹，直接沙盒；`再玩一次` 只能回标题点新游戏。负责人 dev-core（`game/tests/play/sandbox0.mjs`）。


## BUG-028 老周线后弄堂 NPC 不回位，alley_chat 无法触发（P3）
- 复现：`node run-all.mjs --only 04`（04 的 after 步骤）：通关老周线后传送弄堂，附身 bone_bucket 点「踢一脚桶」3 次，checklist 无 alley_chat；诊断 uncle_wu (21.6,13.8) granny_qin (20.25,15.3)（均在广场，bucket_clang 半径 8 够不到）。早晨 fresh 状态（03 spec）可触发。预期：crowd 结束后 NPC 回到日程位置（弄堂 [14.2,25.6]/[15.4,25.6]），或规格明示该彩蛋只在早晨有效。负责人 dev-story。

## BUG-029 气球人在阿东线被看门狗瞬移（P3）
- 复现：`node run-all.mjs --only 06`（t≈323s）日志 `[warp] balloon_man → (47.2,15.1) from (20.8,12.6)`；run 20261118-165444 与 180056 各出现 1 次。负责人 dev-story。

## BUG-030 WebGL 上下文启动期丢失后游戏永久空屏（P2，待真机复核）
- 复现（生产构建 `npm run build` 的 dist，静态托管）：headless Chrome `--use-gl=swiftshader` 打开首页，约 3/5 次出现 pageerror `Framebuffer status: Framebuffer Unsupported` → `WebGL: CONTEXT_LOST_WEBGL: loseContext` → `WebGL Context lost. Renderer disabled` → `WebGL Context restored. Renderer running again.`，之后 `game.isRunning=false`、`scene.scenes=[]`、`textures=0`，画布只有 #1b1626 底色，永远不进标题（等 10 分钟仍不进）。换 `--use-gl=angle --use-angle=swiftshader` 12 次 0 次丢失。脚本 `game/tests/device/` + `/tmp/qa-device-build/diag.mjs`（GLA 环境变量切换）。
- 预期：上下文丢失/恢复后游戏能重新启动，或至少给“渲染出错，请刷新”提示。实际：src 内无 `webglcontextlost/restored`、`window.onerror` 处理；用户看到的是永久深色空屏。真实手机在切后台/显存吃紧时也会丢上下文（本游戏 853 张独立纹理≈165MB）。
- 建议：main.ts 监听 canvas 的 `webglcontextlost`（preventDefault）与 `webglcontextrestored`，恢复失败则显示 DOM 提示+“重新加载”按钮；全局 `error` 事件在 Boot 未完成时显示提示。负责人 dev-core。

## BUG-031 启动纹理生成对加速 Canvas2D 极敏感、纹理总量大（P2，待真机复核）
- 数据（生产构建，同机同负载 ≈20，桌面 1280×720）：`--use-gl=angle --use-angle=swiftshader` 默认加速 2D：boot→game 场景 168s、期间控制台反复 `GPU stall due to ReadPixels` 与 `Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true`；仅加 `--disable-accelerated-2d-canvas`：9.0s（boot 2.4s→game 8.7s）。进入游戏后 853 张纹理、textureMB≈165（w×h×4 估算）、displayObjects≈850、JS heap≈13MB（GC 后）。
- 风险：GPU 加速 Canvas2D 的手机浏览器（含 iOS Safari、低端 Android）会把大量程序化画布留在 GPU，回读/上传成本高；iOS Safari 对 canvas 总内存有限制，165MB 纹理有被系统杀掉/丢上下文（见 BUG-030）的风险。
- 建议（需 art 同学真机验证）：①`src/art/brush.ts:147,180,185`、`src/art/char/ink.ts:21,174,182`、`src/art/env/preview.ts:42,65,73` 的 `getContext('2d')` 改为 `getContext('2d', { willReadFrequently: true })`（强制软件画布，避免回读 GPU stall）；②合并小纹理为图集/按区域懒生成；③加载页显示真实进度文案。负责人 dev-core + art-world。

## BUG-032 生产首屏无加载提示（P3）
- 复现：CDP Slow 3G（400kbps/400ms）+ 844×390：0–9.3s 画布都还没创建，页面只有 #1b1626 空白（截图 `game/tests/device/out/net/slow3g-t3.png`、`slow3g-t6.png` 全黑）；JS（1.62MiB，gzip/br 传输 432KB）8.9s 到达，FCP 9.9s，11.2s 才出现 `…`+进度条；整个加载过程无“加载中”文字（Boot.ts:19 的 `ui.loading` 因 hasKey 失败只显示 `…`）。index.html 无内联 loader、无 `<noscript>`；断网冷启动为浏览器错误页（无 Service Worker，预期）。
- 预期：HTML 内联 CSS 加载提示（“圣诞帽帽 加载中…”+ 简易进度/转圈），JS 就绪后移除；zh.json 补 `ui.loading`；`<noscript>` 提示。负责人 dev-core（index.html 在其范围）。

## BUG-033 生产构建带调试入口（P3，待 lead 决策）
- 复现：`npm run build` 后 dist/assets 含 `testApi-*.js`(11KB) 与 `selftest-*.js`(6KB)；打开 `https://echocoen.com/?debug=1`（main.ts:32 `get('debug')==='1'` 动态 import）后 `window.__qa` 可 teleport/setPhase/completeStep/resetSave；`window.__game`（main.ts:24）恒存在。
- 影响：单机游戏无安全风险，但玩家可作弊/误触 `?debug=1` 破坏存档；多发布 17KB。
- 建议：用 `import.meta.env.DEV || import.meta.env.VITE_DEBUG` 包裹动态 import，让 Rollup 在生产摇掉；若要保留线上排错，至少文档注明。负责人 dev-core/lead。

## BUG-034 测试基建两处问题（P3，负责人 qa）
- ①`src/debug/testApi.ts:27-35 gameToPage` 用主相机，HUD 在 uiCam（`Game.ts:90`、zoom=L.z `layout.ts`）→ 手机 `uiButtons()/touchTargets()` 返回坐标/尺寸错误：`touch tap 继续` 点不中，尺寸偏小 L.z 倍（iPhone L.z=1.77、Android 1.68）。按 uiCam 重算后真实触屏目标最小 46 CSS px（iPhone/Android/桌面均 ≥46，见 `game/tests/device/lib.mjs uiTrue`、`out/06-touch-sizes.json`）。
- ②`game/tests/lib/session.mjs` 默认 `--use-gl=swiftshader` 在宿主机高负载下 ≈2/3 概率丢 WebGL 上下文（见 BUG-030）→ 套件出现“启动超时”类误报。建议追加 `--use-gl=angle --use-angle=swiftshader --disable-accelerated-2d-canvas`（后写的开关覆盖，实测 12/12 稳定、boot→game ≈9s）。
