# ENGINE-REQUESTS · 策划 → 引擎需求清单（product 维护）

> 优先级：**P0** 没有它故事做不下去 · **P1** 没有它体验打折/要绕路 · **P2** 锦上添花（彩蛋）。
> 每条：名称｜用途｜数据字段形态｜优先级｜状态（⬜待评估 / 🟡进行中 / ✅已支持）。dev-story / dev-core 评估后在“状态/备注”回写，不要改我的字段名；要改名请 send_message 给 product。
> 已由 docs/04 附录 A 支持的能力（flags、step kind、emit 锥形/永久、reaction.when/poll、mechs、sequence 新动作）这里**不重复列**。

## A. 数据驱动（dev-story，core/story.ts · core/data.ts · entities/Npc.ts）

| # | 名称 | 用途 | 字段形态 | 优先级 | 状态 |
|---|---|---|---|---|---|
| E1 | **phases 新增 noon / night** | 4 段天色：`morning`（清晨）`noon`（午后）`dusk`（傍晚）`night`（平安夜）；`phase` 序列动作和 `story.phase[]` 能引用 | `config.json.phases` 中新增 `noon`、`night` 两项：与现有 `morning/dusk` 同形态（tint/α/雨雪量/backdrop/灯光），数值我写 | P0 | 🟡 dev-core：Game.setPhase 支持 4 段；字段形态不变，数据到位即可（0.5h）。dev-story：story.phase[]/序列 phase 已按 id 字符串工作 |
| E2 | **道具按 flag/phase 显隐 + 换贴图** | 同一道具状态变化：围裙被照亮、炉灶点火、狗睡醒、雪堆化掉、斜板放下 | props.json：`"when":{"phase":"noon","flag":"x","notFlag":"y"}`（显隐，默认可见）；`"texIf":[{"flag":"oven_lit","tex":"oven_lit"}]`（按 flag 换 tex，首个命中）；`"hit"` 可选覆盖 | P0 | 🟡 dev-core 的 PropEnt 按 when/texIf 刷新（监听 bus `flag`/`phase`）；dev-story 已提供 `hasFlag/getFlag` 与 `condOk(when,phaseId)`（entities/reactions）。1h |
| E3 | **move 副作用 flag + 前置条件** | 招式触发后自动设/清 flag，或要求某 flag 才能用（例如“放斜板”要先看过路灯照亮） | moves.json：`"set":["flag"]`、`"clear":["flag"]`、`"add":{"flag":"cnt","n":1}`、`"requires":{"flag":"x","notFlag":"y"}`、`"failSay":"zh.key"`（条件不满足时的气泡/提示文案 key） | P0 | ✅ 引擎侧 helper 已就绪：`moveAllowed(m)`/`applyMoveEffects(m)`（entities/registry.ts）；dev-core 在 useMove 前后调用（requires 不满足→showText(failSay)，不进冷却） |
| E4 | **step.hold / near.hold** | `near`、`arrive` 步骤需要“持续 N 秒才算”（孩子围到老周身边停留 3s） | stories.json step：`"hold":3`（对 `near`/`arrive`/`flag` kind 生效） | P1 | ✅ 已支持（near/arrive/flag 的 `hold` 秒，离开范围即清零） |
| E5 | **step.kind=flagCount** | “连按 3 次贩卖机”“十连击圣诞树”之类计数彩蛋 | step：`{"kind":"count","flag":"vend_n","min":3,"within":12}`（within=窗口秒，可选） | P2 | ✅ 已支持（`count`：监听 flag 数值增量，within 窗口内累计≥min；无 within=flag≥min） |
| E6 | **step.kind=combo** | 两个事件在 N 秒内都发生才触发（咸味/蛋糕两块牌子） | step：`{"kind":"combo","events":["cheer_salty","cheer_cake"],"within":20}` | P2 | ✅ 已支持（`combo`：events 全部在 within 秒内（缺省20）发生；事件名自动接入 bus） |
| E7 | **reaction.set / reaction.clear** | NPC 反应里设/清 flag（孩子围拢→`kids_near`，大声→清除） | npcs.json reactions[]：`"set":["kids_near"]`、`"clear":["kids_near"]`（do 完成时生效；与 `pose.set` 同语义，但对所有 do 通用） | P1 | ✅ reaction.set 已有，新增 reaction.clear（单个 flag 名；要多个就写多条 reaction 或用 pose.set）。语义：do 触发时生效 |
| E8 | **move.pick（随机结果）** | 贩卖机盲盒、帽子盲抽：同一次招式随机三选一 | moves.json：`"pick":[{"w":3,"say":"zh.key","fx":"sparkle","set":["x"]},…]`，从中按权重抽一项；可与 `emit` 并存 | P2 | ✅ helper `applyMoveEffects` 返回被抽中的 pick 项（含 say/fx/set/event），dev-core 的 useMove 负责展示 say/fx；与 emit 并存 |
| E9 | **story.onStart/onDone.set 支持 phase 联动** | 同 phase 两条都做完才切 phase：已用 `if{flag:"story:X:done"}` + `runSeq:"phase_noon"` 实现 | 无新字段（仅确认 sequence `if` 能读 `story:<id>:done`；`phase_noon / phase_dusk / phase_night` 三个序列由我写） | P0（确认即可） | ✅ 已支持：`if{flag:"story:X:done"}`；`runSeq` 两种写法都认：`{"do":"runSeq","id":"phase_noon"}` 与简写 `{"runSeq":"phase_noon"}` |
| E10 | **多 NPC 到场点名：gather.who 兜底** | `gather` 的 who 中某个 NPC 当前不存在/被隐藏时跳过不报错 | 行为约定：缺失 id → warn 一次，继续 | P1 | ✅ 已支持（缺失 id warn 一次并跳过） |
| E11 | **NPC 姿势清单**（行为约定，art-char 出帧，dev-story 接受任意 pose 名） | `lie`（狗趴）`sleep`（睡）`sit`（坐）`bake`（揉面）`carry`（叼东西）`wave`（挥手）`paint`（作画） | npcs.json/schedule/`npcDo.pose`：贴图键 `c_<id>_<pose>`，缺帧回退 `idle_0`（不报错） | P1 | ✅ 已支持（任意 pose 名→`c_<id>_<pose>`，缺帧回退 walk/idle） |
| E12 | **sequence `vehicle` 的 follow / park** | 猫叼信：信 mech 跟随 NPC 并停在指定点 | `{"do":"vehicle","id":"letter_a","cmd":"follow","target":"npc:cat_m","ox":0,"oy":-0.4}`；`{"cmd":"park","to":[x,y]}`（已在 mechs.json 的 `follow` 里有同类能力，这里只要 seq 能**启停**） | P0 | ✅ 已支持：`cmd:"follow"{target,ox,oy,lag?}`、`"unfollow"`、`"park"{to}`（park 同时解除跟随并瞬移到 to） |
| E13 | **sequence `subtitle` 的 style=letter** | 邀请函/来信：纸面底、手写体，用于阿福送信、圣诞老人来信 | `{"do":"subtitle","key":"sub.afu_invite","dur":4,"style":"letter"}`（可退回 `big`） | P2 | ⬜ 需 dev-core 的 subtitle UI 支持 style（序列侧已透传 style 字段） |
| E14 | **清单 checklist.json 的 on/delay** | 清单项由事件驱动勾选，不再硬编码 | 已与 dev-story 对齐：`{"id":"xiaomi_sung","on":"xiaomi_sung","delay":900}`；secret 项同形态 | P0 | 🟡（dev-story 已答应） |
| E15 | **隐形 NPC 仍可感知** | 小蓝在阁楼里（不显示），但能听到车铃、闻到面包香 | npcs.json schedule 条目 `"hidden":true`（不渲染、不可点选、不挡路，但 `sense:"xiaolan"` 照常收刺激）；条件 `when{flag,notFlag}` 变化后切换到下一条可见 schedule | P0 | ✅ 引擎侧：schedule 条目 `hidden:true` → `npc.ghost`（不渲染、仍感知/走路线）；dev-core 点击检测/crowdMembers 需跳过 `n.ghost` |
| E16 | **unpossessable 不可附身 NPC** | 阿冬：玩家不能操作他（Q21） | npcs.json `"unpossessable":true`；帽子靠近 r<1.2 时被轻轻弹开 0.4 格，气泡 `say.adong_mine`（“自己的轮子自己推。”）；全场只在阿冬身上触发 | P0 | ✅ 引擎侧：`unpossessable` 由 WorldRules 实现（帽子 r<1.2 弹开 0.4 格 + say 键 `say.adong_mine`，冷却 5s）；StoryManager.update 自动调用，需 StoryHost 带 npcs/hat（Game 已有） |
| E17 | **move.setTex / prop 换图招式** | 雪人融化（snowman_1→snowman_2）、斜板放下、拱门挂满气球 | moves.json：`"setTex":"snowman_1"`（永久换该 prop 的 tex）；序列 `{"do":"prop","id":"snowman_r","move":"melt_1"}` 触发；E2 的 texIf 作为“按 flag 自动换”，二者并存 | P0 | ✅ moves.json `setTex` 在 FxSystem.play 里生效（Game.useMove 与序列 prop 都走它）；贴图不存在则忽略 |
| E18 | **fx 新 id：confetti / snow_puff / notes / hearts / sparkle** | 终点彩带、造雪机雪雾、哼唱音符 | `fx{id,at}` 的 id 约定；`at` 可为 `"npc:x"`/`"prop:x"`/`[x,y]`；art-world 出贴图（见 art-assets E8） | P1 | 🟡 fx id：notes/sparkle/hearts 已有；confetti/snow_puff 我来注册（依赖 art 贴图 fx_*，缺则用粒子兜底） |
| E19 | **sequence `weather`** | 终场下雪、夜晚雪量上调 | `{"do":"weather","snow":1,"s":3}`（0~1，s=渐变秒数） | P1 | ✅ 序列侧 `{"do":"weather","snow":0~1,"s":秒}` → bus `weather {snow,rain,s}`；dev-core 的天气系统监听 |
| E20 | **annoy 在 flag 下停用** | 终章阶段 NPC 全在庆祝，不触发烦躁 | npcs.json `annoy.disableWhen:{"flag":"night"}` 或全局 `config.annoyOffFlags:["night","game_complete"]`（二选一，推荐后者，一处写） | P1 | ✅ 读取 `config.annoyOffFlags`（任一 flag 为真即不记录烦躁） |
| E21 | **sequence `if` 多 flag 判断** | “三盏灯都亮”“小米+阿福都完成” | `{"do":"if","all":["lit:lamp_s2","lit:lamp_s3","lit:lamp_s4"],"then":[…]}`；`any` 同形态；兼容原 `flag` 单项 | P0 | ✅ seq `if` 支持 `all[]` / `any[]`（可与 flag 并存），读世界 flag |
| E22 | **mech onStop 设 flag / 事件** | 公交到站 → `bus_arrived`（斜板才能放） | mechs.json `"onStop":{"set":["bus_arrived"],"event":"bus_arrived"}`；到点自动 | P0 | ✅ mech `onStop` 可写对象 `{set,clear,event}`（字符串形态仍可用）；到站自动执行 |
| E23 | **hat 跟随载具（陪跑，可选）** | 阿冬雪橇赛时帽子在赛道旁自动跟随 | `{"do":"hatFollow","target":"mech:sled_ad","secs":8}`；结束自动恢复 | P2 | ⬜ P2：后续（帽子跟随由 hat.flyTo 每帧驱动，可做） |
| E24 | **姿势名新增**（行为约定） | `lean`（探身）`photo`（拍照）`transfer`（轮椅→雪橇）`watch`（观赛）`gulp`（深呼吸）`scared` | 同 E11：缺帧回退 idle，不报错 | P1 | ✅（同 E11） |
| E25 | **move.event 多事件 / 节奏识别** | “车铃叮叮 叮叮叮”（`bike_duet`）、“十连击”（`tree_combo`） | 用 E5 `count`（within 窗口秒）+ move.add 实现，无需新字段；节奏型降级为“8 秒内 ≥4 次” | P2 | ✅（用 E5） |
| E26 | **checklist 事件名列表** | 新增 18 个清单/彩蛋 id | 见 docs/08 §8；`on` 与 id 同名，由 stories.onDone.event / seq event / move.event 发出 | P0 | ✅ 引擎侧 on/delay 已接（FxSystem.wire）；dev-core 删旧硬编码 |
| E27 | **night 沙盒 + 重玩按钮** | 通关后 `game_complete`：自由散步、每 90s 随机一人说“平安夜快乐”；右上角“继续散步/再玩一次” | `config.json.idleNight:["idle.night.1"…]`（NPC 通关后随机路过说话，数据驱动，data 由我写）；按钮 UI 归 dev-core | P1 | 🟡 引擎侧：`config.idleNight` + flag `game_complete` → 每 90s 随机 crowd NPC 说一句（entities/rules.ts）；按钮 UI 归 dev-core |

## B. 世界/路径（dev-core，scenes/Game.ts · core/data.ts）

| # | 名称 | 用途 | 字段形态 | 优先级 | 状态 |
|---|---|---|---|---|---|
| C1 | **world 60×40 正式启用** | 6 个区块；`LEGACY_COMPAT` 在 `world.w>=60` 时关闭 | `config.json.world:{w:60,h:40}`、`regions[]` 6 项 map 为 20×20（我写） | P0 | ⬜ |
| C2 | **镜头边界与 culling** | 60×40 比旧 36×24 大 2.9 倍：只渲染屏幕附近的墙/道具/装饰 | 实现层自行决定；需要我提供“区块切换时电台/天气切换点”：`regions[].bx,by`（已有） | P1 | ⬜ |
| C3 | **region.mood 驱动 audio.setRegion** | 区块切换时配乐/氛围换音色 | 约定 `regions[].mood` 字符串即 `audio.setRegion` 参数：`plaza`/`bakery`/`slope`/`alley`/`bridge`/`dock`（与 id 同名即可，不需新字段） | P1 | ⬜ |
| C4 | **config.obstacles / blockedTiles** | 河面、江面 `w` 不可走；老洋房/仓库/售票亭矩形障碍；木桥 `d` 可走 | `config.json.obstacles:[[x0,y0,x1,y1],...]`（我在 M2 填，坐标见 docs/08 §1.3） | P0 | 🟡 引擎侧 nav.ts 已读取 config.obstacles/blockedTiles/decor.solid；dev-core 的 data.ts 需透传（已答应） |
| C5 | **气味风向** | 老周的香味要飘向小蓝：香味锥形（不靠风） | `emit.cone:{dir:[0.25,1],arc:70}`（已有）；约定 `config.windDir` 保持默认 [1,.35]，故事不依赖风 | — | ✅ |

## C. 美术/角色（art-char / art-world 出帧；dev 不需要）— 见 docs/art-assets.md E8 与角色需求表

## D. 变更记录
- v1（part 1 完成）：E1~E14、C1~C5 来自“地图 + 阿福 + 老周”。小米强化、小蓝、阿冬、终章的需求在第 2 部分补入（E15+）。

- v2（part 2 完成）：新增 E15~E27（隐形感知、不可附身、换图、fx、weather、多 flag if、mech onStop、陪跑、姿势、清单、沙盒）。
- v1 评估（dev-story）：见状态列；新增字段登记在 docs/04 附录 A。