# 用例草案：阿福 / 老周（依据 docs/08 §2.3-2.6、§3.3-3.5；第 2 部分到后补）

> 正式矩阵以 product 的 `test-matrix.md` 为准；本文是 qa 提前拆好的可自动化步骤与负面用例，ID 前缀 AF-/LZ-。
> 通关脚本：`specs/03-story-afu`、`specs/04-story-laozhou`（真实点击）；负面脚本：`specs/11-negative-story`（待写，依赖故事数据落盘）。

## 阿福（afu_story，need 4，morning）
| ID | 步骤/场景 | 操作（真实点击） | 预期（断言） |
|---|---|---|---|
| AF-01 | wake | 附身 `fish_rack` → 点“fish_swing” | 麻薯（cat_m）坐起，flag cat_awake，爱心表情；气泡“喵？”；step wake 完成 |
| AF-02 | drop | 附身 `mailbox_alley` → alley_post | 信落下；演出 afu_cat_carry（lock≈12s，期间点击被忽略）；信最终停在 (3.9,33.6)；flag letter_in_yard；阿福气泡“那是……我的信”|
| AF-03 | lull | 附身 `radio` → radio_lullaby，期间弄堂保持安静 3s | 狗睡着（pose sleep、Zzz），flag dog_asleep；step lull 完成 |
| AF-04 | enter | 不操作，等阿福自己走入（≤ 120s 前不出提示） | 阿福自己 goto 到 7 号门口；途经狗身边 freeze≈1s + “……(吞口水)”；触发 afu_finale |
| AF-05 | finale | 观看 | 对白顺序：阿福→阿冬→邀请函 subtitle→阿冬→阿福；帽子 stage 2；暖度 +8；清单 afu_delivered 打勾；banner“有些信，只是需要一点勇气。”；之后阿福在邮局门口（afu_stay），对白改“谢谢你。下次我自己进。” |
| AF-06 | 步骤顺序错误：先 alley_post 再 fish_swing | 信落下后躺着，阿福捡起叹气“17 天了……”，信回邮筒，flag drop_early 清零，可重来；暖度不降 |
| AF-07 | 摇篮曲时同时放大声（speaker_blast / 喇叭，>0.4） | 狗醒（dog_asleep 清），阿福“您已偏离路线”退到 (8.5,25.6)，可重来 |
| AF-08 | 阿福走到一半被喇叭吓 | 阿福 flee 回邮局，不扣分，可重来 |
| AF-09 | 烦躁 3 档：连续 ≥N 次同类干扰（反复按同一招式/点阿福） | ①“嗯？”②“按规定，这儿不能乱按。”③“我先去送别的了。”并走开 60s 后回来；其间故事不死锁 |
| AF-10 | 隐藏 bone：`bone_bucket`.bone_toss | 狗被引开，阿福直接过院（跳过 lull）；+6 暖度；勋章；之后主线仍可 finale |
| AF-11 | 弄堂群聊：弄堂里喇叭/炮 | 阿婆/邮局阿姨/阿福气泡轮流接话；+4 暖度；**三个气泡同屏无重叠** |
| AF-12 | 提示三档：各步骤放置不动 | 档1/2/3 文案出现；档3 高亮正确的 prop/move；noHint 步骤 120s 才提示 |
| AF-13 | 时段：非 morning 时进入弄堂 | 故事不可触发/或给出时段提示；阿福 afu_stay |
| AF-14 | 狗不可附身；点狗/猫/NPC | 狗/猫是动物，**规则待 product 确认**（不可附身人；动物？）→ 记入 99-待确认 |
| AF-15 | 存档中途：wake 后刷新 | cat_awake 保留，麻薯仍醒着；drop 前/后刷新信位置一致，不重复演出 |

## 老周（laozhou_story，need 5，noon）
| ID | 步骤/场景 | 操作 | 预期 |
|---|---|---|---|
| LZ-01 | see | 附身 `lamp_bk1` → lamp_glow（光锥对准橱窗） | 围裙/面粉袋被照亮，老周抬头“……师父的围裙。”；flag apron_seen |
| LZ-02 | cookie | `vending` → vend_cookie | 饼干掉落；豆豆、妞妞跑来“好香！”；event vend_cookie |
| LZ-03 | crowd | 不操作，孩子走到老周身边 ≥3s | 孩子扯围裙“爷爷，我要吃你的面包！”；flag kids_near；60s 后才出提示 |
| LZ-04 | ember | `oven` → oven_stoke | 炉口暗红；老周“……还有火星。”并**自己**走向炉灶 |
| LZ-05 | bake/finale | 等待（120s 后才提示） | 到达 (28.6,3.6) 触发 laozhou_finale：说“好。烤一炉。”→手风琴→糊了→孩子/q1/q2/大妈/吴大爷/凯文围拢→对白→帽子 stage 3→卷帘门升起→banner；清单 laozhou_oven 打勾；flag oven_lit、bread_smell；面包香 scent 锥向南 |
| LZ-06 | 顺序错误：先 oven_stoke | 余烬闪灭，“没心情。”可重来 |
| LZ-07 | 大声（喇叭）打断 crowd | 孩子散开，kids_near 清，老周缩回，“吵。”；之后可重新聚拢 |
| LZ-08 | 路灯照到老周脸 | “晃眼。”不推进 see |
| LZ-09 | 烦躁 3 档 | 档 3 老周回屋 30s，卷帘门放下（shutter_down），30s 后回来；不死锁 |
| LZ-10 | bread_war 隐藏 | 20s 内两块牌子都按 → 吴大爷/桂芳阿姨同吃“咸蛋糕”，+6 暖 |
| LZ-11 | 贩卖机盲盒：连按 3 次 | 随机掉 饼干/袜子/迷你圣诞树，+4 暖，勋章，仅触发一次 |
| LZ-12 | 排队崩了：香味+圣诞树发光 | q1/q2 离队吃面包，凯文“Queue is dead.”（彩蛋，不破坏主线） |
| LZ-13 | 联动：laozhou 完成后 → 小蓝 smell 可触发 | flag bread_smell 存在；小蓝在小桥闻到（第 2 部分接口） |
| LZ-14 | 联动：afu/xiaomi 非硬依赖 | 任意顺序先后完成，laozhou 均可通关；finale 末尾 `if story:xiaolan_story:done → phase_dusk` 分支两种顺序都测 |
| LZ-15 | 演出期间点击 | lock 内忽略；演出末尾 release/unlock 后立即可操作；**气泡 7 人同屏（gather）互不遮挡且不盖住招式面板/清单** |
| LZ-16 | 通关后重进 | 老周 laozhou_bake 往返炉灶-橱窗；卷帘门开；路人买面包 |

## 通用/地图（§1）
| ID | 场景 | 预期 |
|---|---|---|
| MP-01 | 6 区域中心 + 四角传送帽子，截图 | 不露出地图外；镜头 clamp；区域名 toast 一次 |
| MP-02 | 所有 NPC 日程路线点 | 每个路点落在可走瓦片（非水/非建筑）；路线首尾连通 |
| MP-03 | 道路连通（§1.2）：从任一区域飞到另一区域 | 点远处地面，帽子可达（帽子是飞行，不受路网限制）；NPC 寻路可达所有 route 点 |
| MP-04 | 所有 props/NPC 世界坐标（§1.3） | invariants：不悬空、不在水里、不与建筑重叠；地标 prop 可被真实点击命中 |
