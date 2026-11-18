# 测试用例矩阵（product 维护，对应 docs/08；qa 执行）

约定：调试入口 `scene.stories.debug()`、`setFlag('x')`、`scene.seq.run('id')`、`scene.stim.emitSpec(...)`。**P0** = 主线卡关/崩溃；**P1** = 体验错误；**P2** = 文案/视觉。每个步骤有 4 类用例：`正常`（预期推进）/`边界`（时机、重复、顺序）/`错误操作`（失败反馈，不推进、不惩罚）/`提示`（20/60/120s 三档，只对停滞最久的故事）。

## 0. 全局
| # | 用例 | 预期 | 级别 |
|---|---|---|---|
| G1 | 新开局 | phase=morning，帽子 S0 褪色，hatStart (9.5,9.5)；HUD 无暖度数值 | P0 |
| G2 | 60×40 地图：6 区块可走通（广场↔面包街↔坡道，广场↔弄堂↔小桥↔码头） | 道路连通见 docs/08 §1.2；水面 w 不可走，木桥 d 可走 | P0 |
| G3 | 河面/老洋房/仓库/售票亭障碍（config.obstacles） | 人和帽子都不会进入；A* 绕行 | P0 |
| G4 | 摄像机在大地图拖拽/缩放/到边界 | 不出界，不闪；手机双指缩放 | P1 |
| G5 | phase 切换 morning→noon→dusk→night | 小米+阿福 done→noon；老周+小蓝 done→dusk；阿冬 done→night；banner 出现；旧 flag 清除；backdrop 换 | P0 |
| G6 | 每个 phase 只能做该 phase 的故事 | 提前触发（如 morning 点老周炉灶）给“没心情”类反馈，不推进 | P1 |
| G7 | 存档/刷新 | flag、story done、hat stage、warmth 保存并恢复；序列中途刷新不卡 | P0 |
| G8 | 提示系统 | 停滞 20/60/120s 依次出 3 档，只对停滞最久的故事；做出推进后重置 | P1 |
| G9 | 烦躁系统 | 同类干扰连续≥N → 3 档 → 离场，不扣分；离场后自动回来 | P1 |
| G10 | 性能 | 60×40 地图 + 20+ NPC + 天气，桌面 ≥50fps，手机 ≥30fps | P0 |
| G11 | 通关全流程（debug 跳 flag 到各 phase） | 顺序做完 5 条主线 + 终章；总时长 28–34 分钟（无提示约 26 分钟，含提示约 32 分钟） | P1 |
| G12 | 暖度/帽子阶段 | 完成每条故事帽子依次 S1..S5，终章 santa（S6）；顺序无关的两条同 phase 也各自 +1 | P1 |
| G13 | 文案 | 所有文本在 zh.json；无缺 key（validateData 无警告）；吐槽 ≤20 字；同梗 ≤3 次 | P2 |

## 1. 小米（xiaomi_story，need 3，morning）
| 步 | 触发 | 正常 | 边界 | 错误操作 | 提示 |
|---|---|---|---|---|---|
| listen | sound soft≥0.25 near xiaomi | 点风铃 → 小米抬头，节拍 | 风铃 cd 3s 内连点只响一次；离小米太远（radius 6 外）不触发 | 点喇叭巨响 → 小米捂耳跑开 8s，进度不丢 | ①“有人想听点什么。”②“广场左边，风铃。”③高亮 chime_ring |
| calm | quiet r3.3 hold 2.5 | 放气球，孩子/路人追走，半径内 2.5s 无人 | 先 calm 再 listen（requires）不推进；气球 11s 内被戳破（balloon_pop）→ 人群回流 | 气球 cd 14s 内重复；用 pop 时人群不散 | ①“人太多了。”②“气球摊有办法。” |
| melody | sound melody≥0.3 + needQuiet 3.3 | 放前奏 → 小米自己开口 → finale | 人群未散放前奏 → “人太多又缩回去”（xiaomi_crowd）；未 listen 放前奏 → “突然的！”（xiaomi_startle） | speaker_blast → xiaomi_blast，8s 逃开 | ①②③ 高亮 speaker_prelude |
| finale | xiaomi_finale | 镜头聚焦，合唱起，阿姨鼓掌；hat S1；清单 xiaomi_sung；flag balloons_released（若放过气球） | 若 afu_story 已 done → 触发 phase_noon；未 done → 不切 | 期间点击/拖拽不应破坏（lock） | — |
联动：`balloons_released` 标记 → 阿冬终场彩带。边界：不放气球直接完成（若人群被其他方式散开）→ flag 不设，终场无彩带，不报错。

## 2. 阿福（afu_story，need 4，morning）
| 步 | 正常 | 边界 | 错误操作 | 提示 |
|---|---|---|---|---|
| wake | 摇晒鱼架 → 麻薯醒（cat_awake） | cd 6s；麻薯在 catbox 以外（已被唤醒）再摇不重复 | 摇鱼架时离麻薯 r>6 不触发 | ①“那只猫鼻子动了动。”②高亮 fish_rack |
| drop | 邮筒吐信 → afu_cat_carry：猫叼信进院放狗旁 | 先于 wake 触发 → 信躺着，阿福叹“17 天了”，flag 重置；序列期间锁输入，结束后 unlock | 重复点邮筒（cd） | ①“邮筒好像有话要说。” |
| lull | 收音机摇篮曲 → 狗睡（dog_asleep） | needQuiet 3.0：期间喇叭 → 狗醒、阿福后退 (8.5,25.6) | 先于 drop 放 → 狗眯眼不睡（requires 不满足） | ①“狗看起来很困。”②高亮 radio_lullaby |
| enter | 阿福自己走到 (2.0,34.6) | 走到一半被巨响吓 → flee 回邮局；经过狗身边 freeze 1s + “吞口水”；A* 不穿墙 | 狗醒着时阿福靠近 → 后退 | 120s 后“给阿福一点时间” |
| bone（隐藏） | 骨头桶→邮筒，狗追骨头，阿福直接过院 | 与 lull 同时触发的冲突 | — | noHint |
| finale | 信交到阿冬手，邀请函 subtitle，hat S2，清单 afu_delivered，flag letter_delivered | 小米已 done → phase_noon；阿冬此时出现在 7 号门口且不可附身 | — | — |
彩蛋 alley_chat：弄堂内大声 → 阿婆/邮局阿姨/阿福轮流接话，+4，仅一次。

## 3. 老周（laozhou_story，need 5，noon）
| 步 | 正常 | 边界 | 错误操作 | 提示 |
|---|---|---|---|---|
| see | 路灯照橱窗 → 围裙亮，“师父的围裙” | 光锥方向：照到老周脸 → “晃眼”，不推进 | 照其他处 | ①“橱窗里有点什么，太暗了。” |
| cookie | 贩卖机 → 豆豆妞妞跑来 | 连按 3 次 → vend_blind 盲盒（pick 三选一）；未 see 就按 → 孩子不来 | 喇叭 → 孩子散开、kids_near 清 | ①“孩子们的肚子在叫。” |
| crowd | 孩子在老周旁 3s | 孩子被赶走（巨响）→ 重置 hold | — | 60s 后提示 |
| ember | 吹炉灶余烬 → 老周起身 | 先于 crowd 按 → “没心情”，余烬灭 | 重复按（cd 6） | ①“炉子里好像还有点东西。” |
| bake | 老周自己走到炉灶 → finale | requires kids_near 才触发；孩子散了则他停下 | — | 120s 提示 |
| bread_war（可选） | 两块牌子 20s 内各按一次 → 咸蛋糕 | 只按一块：吴大爷或桂芳阿姨吵一句，不推进；超过 20s 不算 | — | noHint |
| finale | oven_lit，炉口亮，香味 emit（cone 南，r26，90s），gather 孩子+q1/q2/kevin，hat S3，shutter_up，清单 laozhou_oven | 小蓝已 done → phase_dusk；q1/q2 离队 → queue_dead（+4） | — | — |

## 4. 小蓝（xiaolan_story，need 5，noon，requires laozhou_story）
| 步 | 正常 | 边界 | 错误操作 | 提示 |
|---|---|---|---|---|
| bell | 按车铃 → 窗开，小蓝探身 | 隐形 NPC 仍能感知（E15）；老周未 done 时门控：故事未解锁，按铃只给艾琳太太“Dear, 别吵” | 喇叭 → 缩回窗口，window_open 清 | ①“窗帘后面有人影。” |
| smell | 香味进窗 → 小蓝下楼坐门廊（xl_porch） | 香味过期（>600s）→ bread_cart.bread_scent_re 兜底；窗关着不触发 | — | ①“有什么香味在飘。” |
| bike | 推自行车 → 滑到雪人旁（bike_parked） | 先于 smell 推 → 艾琳太太“My bike!”，雪人被撞歪自动恢复 | 重复推 → 车在终点不再动 | ①“那辆车摇摇晃晃的。” |
| pose | 雪人摆姿势（company fun） → 小蓝自己跑去画点 | 先于 bike → “缺点什么”，不推进 | — | ①“雪人似乎想参与点什么。” |
| paint | 小蓝到 (31.0,26.8) hold 4s → finale | 被打断（巨响）→ 暂停重来 | — | 90s 提示 |
| mirror（可选） | 立镜光斑 → 光环雪人 | 仅 xl_paint 后有效 | — | noHint |
| finale | 画画→雪人融化 melt_1/melt_2→“这才是抽象派！”→hat S4；flag painting_done；清单 xiaolan_painted | 老周已 done → phase_dusk；雪人换图后 snowman_party 彩蛋仍可用 | — | — |
彩蛋 bike_duet：8s 内按铃 ≥4 次。

## 5. 阿冬（adong_story，need 5，dusk，requires afu_story）
| 步 | 正常 | 边界 | 错误操作 | 提示 |
|---|---|---|---|---|
| ramp | 公交到站（bus_arrived）后按 bus_ramp → 斜板放下，阿冬自己下车 | 车未到按 → failSay“车还没到”，不进冷却；bus_37 只在 dusk 出发 | — | ①“公交到站了，但车门没动静。” |
| light | 路灯照斜坡 → 阿冬往坡口滚 | 先于 ramp 照 → 无反应（requires） | — | ①“斜坡太暗了。” |
| clear | 造雪机吹开雪堆（berm_cleared） | 阿冬已到雪堆前被卡 → freeze + “这雪堆是谁堆的？”，吹后继续；未到时吹无影响 | — | ①“雪堆挡着斜坡。” |
| crowd | 气球把游客引向终点（lure）；阿冬“让一让，我赶时间” | 游客不在路口时放气球 → 步骤仍完成；气球 11s | 巨响 → “太吵——算了”，无位移，30s 内不重复 | ①“路口被人占着。” |
| start | 阿冬自己走上起点 (47.5,2.4) hold 3s → finale | 顺序可乱：ramp/light/clear/crowd 四步任意顺序，最后 start | 玩家试图点选/附身阿冬 → 被弹开 + “自己的轮子自己推。” | 90s 提示 |
| escort（可选） | 赛道三盏灯 30s 内各点一次 → 破纪录 | 少一盏不算；乱序可 | — | noHint |
| finale | 雪橇赛：camPath、slowmo、sled_ad、冲线；若 balloons_released → 彩带+拱门 pop；hat S5；runSeq phase_night | 序列中玩家输入锁定；slowmo 恢复正确；中途刷新后不卡 | — | — |
**尊重性检查（P0）**：不可附身；无“励志/可怜”台词；阿冬永远自己完成最后一步；轮椅/雪橇转换动画不夸张；吐槽对象是设施与打卡行为。

## 6. 终章（finale_story，night）
| 步 | 正常 | 边界 | 错误操作 | 提示 |
|---|---|---|---|---|
| gather | 五人带物到广场；flag finale_ready | 玩家在远处/卡在别处 → NPC 自己走到位；有 NPC 被卡 → 3s 后瞬移 | — | 60s“看看谁还在路上” |
| lamp1..5 | 点亮 lamp_p1..p5，暖度 +2/盏，音乐加层 | 顺序随意；重复点亮不重复计分 | 灯点完前点树 → 树亮一下又暗，“灯串还没接上” | ①“还有些路灯是黑的。” |
| tree | 树亮 → finale_city | 同时点亮 8 盏灯（含面包街灯）→ lamp_trip 彩蛋 | — | ①“树，最后。” |
| finale_city | lightString 灯串依次亮，全镇点亮，下雪，合唱，hatMorph santa，字幕“May all the beauty in the world be blessed.”，hat S6，epilogue，game_complete | 中途暂停/刷新；手机竖屏字幕完整；slowmo 恢复 | — | — |
| 沙盒 | game_complete 后自由走，随机路人“平安夜快乐”，彩蛋仍可触发；右上角“继续散步/再玩一次” | 再玩一次清档 | — | — |

## 7. 彩蛋清单（docs/08 §8，每条：触发→清单勾选→只触发一次→暖度）
xiaomi_sung · kids_chased_balloon · tree_lit · letter_sent · snowman_party · afu_delivered · laozhou_oven · xiaolan_painted · adong_raced · town_lit · alley_chat · bone_mailed · vend_blind · bread_fusion · queue_dead · halo_snowman · bike_duet · record_run · cat_party · chorus · santa_letter · tree_combo · lamp_trip。
通用断言：`checklist.on` 事件发出后 `delay` ms 弹勾；重复触发不重复奖励；存档后保留；secret 项在未触发前清单显示“？”。

## 8. 兼容与边界
- 刷新/回退/切标签后序列不卡；lock 一定会 unlock（异常时 5s 自动兜底）。
- 同时触发两个刺激（如风铃+气球）不崩；NPC 同时有多个反应取优先级。
- 多点触控拖拽帽子 + 点击道具；手机 375×667 与 iPad 横屏 UI 不遮挡道具。
- 极端：短时间连点同一招式 20 次、连按全部招式、故事未解锁时点后续故事道具。
