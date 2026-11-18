# QA 回归报告 20261118-182326

- 用例 18：✅ 通过 17 / ❌ 失败 0 / 🟡 已知缺陷 1 / ⏭️ 跳过 0
- 断言 355：通过 354，失败 1
- console/页面错误总数：0；数据校验警告：0
- 总耗时 2730s；环境：Chrome(headless, SwiftShader 软渲染) / Playwright

## 用例一览

| 用例 | 结果 | 断言 | 耗时 | 说明 |
|---|---|---|---|---|
| 01-smoke | ✅ pass | 8/8 | 17.3s | 冒烟：启动/标题/开始/无 console 错误/基础帧率与资源 |
| 02-story-xiaomi | ✅ pass | 5/5 | 107.6s | 故事·小米：真实点击通关（点物件→点招式），全程 UI 遮挡检测 |
| 03-story-afu | ✅ pass | 7/7 | 84.9s | 故事·阿福：真实点击通关（点物件→点招式），全程 UI 遮挡检测 |
| 04-story-laozhou | 🟡 known | 9/10 | 276.8s | 故事·老周面包房：真实点击通关（点物件→点招式），全程 UI 遮挡检测 |
| 05-story-xiaolan | ✅ pass | 9/9 | 250.5s | 故事·小蓝：真实点击通关（点物件→点招式），全程 UI 遮挡检测 |
| 06-story-adong | ✅ pass | 10/10 | 372.3s | 故事·阿东：真实点击通关（点物件→点招式），全程 UI 遮挡检测 |
| 07-story-finale | ✅ pass | 17/17 | 440.2s | 故事·终章：真实点击通关（点物件→点招式），全程 UI 遮挡检测 |
| 09-stress-mainline | ✅ pass | 12/12 | 544.6s | 压力：整条主线真实点击 + 30 游戏分钟沙盒加速乱点 |
| 10-negative | ✅ pass | 20/20 | 96.0s | 负面/边界：乱点、冷却连点、骚扰NPC、点人、失焦缩放（N-01~N-04,N-12,N-13,N-16） |
| 11-negative-story | ✅ pass | 17/17 | 96.7s | 负面·故事向：乱序触发/提前点后续物件/阿冬尊重/连点/演出中刷新 |
| 12-visual-overlap | ✅ pass | 195/195 | 69.7s | 视觉：区域×昼夜截图、UI 遮挡、穿帮（NPC 入水/建筑、物件悬空、出界） |
| 13-shots | ✅ pass | 3/3 | 62.4s | 视觉验收截图：6 区域 × 4 时段（桌面）+ 手机横屏抽样 |
| 14-perf | ✅ pass | 16/16 | 85.9s | 性能：帧时间/资源（空闲、移动、各区域、低性能 CPU4x） |
| 15-save | ✅ pass | 4/4 | 38.6s | 存档：刷新恢复、坏存档、清档（N-08/N-09） |
| 16-touch | ✅ pass | 8/8 | 19.3s | 触屏：844×390/667×375 点击移动、点物件、拖动、长按、捏合、按钮尺寸 |
| 17-audio | ✅ pass | 4/4 | 62.3s | 音频自检（music 的 src/audio/selftest.ts） |
| 18-endpanel-persist | ✅ pass | 7/7 | 67.6s | 结尾面板：存档→刷新→继续 重弹；继续散步后刷新不再弹 |
| 19-eggs-feedback | ✅ pass | 3/3 | 37.0s | 彩蛋/失败反馈：前奏提前按、贩卖机保底、弄堂群聊 |

## 失败 / 已知缺陷详情

### 04-story-laozhou 故事·老周面包房：真实点击通关（点物件→点招式），全程 UI 遮挡检测
- 🟡 BUG-028 老周线后弄堂群聊仍可触发（吴大爷/秦阿婆应回到弄堂）


## 帧率 / 帧时间（SwiftShader 软件渲染，数值仅作相对比较；真机更好）

| 用例 | 场景 | fps | p50ms | p95ms | p99ms | max | >50ms帧 |
|---|---|---|---|---|---|---|---|
| 01-smoke | desktop-idle | 30 | 33.3 | 50 | 50 | 50 | 0 |
| 09-stress-mainline | end | 42.1 | 16.7 | 33.4 | 33.4 | 33.5 | 0 |
| 14-perf | desk-idle | 53.3 | 16.7 | 33.4 | 33.4 | 33.4 | 0 |
| 14-perf | desk-plaza | 51.1 | 16.7 | 33.4 | 33.4 | 33.4 | 0 |
| 14-perf | desk-bakery | 47.8 | 16.7 | 33.4 | 33.4 | 33.4 | 0 |
| 14-perf | desk-slope | 55 | 16.7 | 33.3 | 33.4 | 33.4 | 0 |
| 14-perf | desk-alley | 54.7 | 16.7 | 33.4 | 33.4 | 33.4 | 0 |
| 14-perf | desk-bridge | 53.4 | 16.7 | 33.3 | 33.4 | 33.4 | 0 |
| 14-perf | desk-dock | 55.7 | 16.7 | 33.3 | 33.4 | 33.4 | 0 |
| 14-perf | low-idle | 23.7 | 49.9 | 50.1 | 66.7 | 66.7 | 16 |
| 14-perf | low-plaza | 22.1 | 50 | 66.6 | 66.7 | 66.7 | 10 |
| 14-perf | low-bakery | 22.7 | 50 | 50.1 | 66.7 | 66.7 | 8 |
| 14-perf | low-slope | 25.5 | 33.4 | 50 | 50.1 | 50.1 | 3 |
| 14-perf | low-alley | 24.9 | 33.4 | 50 | 66.7 | 66.7 | 3 |
| 14-perf | low-bridge | 22.5 | 50 | 66.6 | 66.7 | 66.7 | 12 |
| 14-perf | low-dock | 24.5 | 33.4 | 50 | 50.1 | 50.1 | 3 |

## 资源

| 用例 | 纹理数 | 纹理MB | 显示对象 | tween | JS堆MB |
|---|---|---|---|---|---|
| 01-smoke | 847 | 164.5 | 840 | 2 | 253.9 |

## 音频自检（src/audio/selftest.ts）

```json
{
  "ms": 54904,
  "rows": 124,
  "seam": {
    "jump": 0.0641,
    "typical": 0.0874,
    "ok": true
  },
  "theory": {
    "ok": true,
    "issues": [
      {
        "level": "warn",
        "msg": "小节 6(G) 弱拍经过音 72 与和弦小二度（经过音，允许）"
      },
      {
        "level": "warn",
        "msg": "小节 11(Dm) 弱拍经过音 76 与和弦小二度（经过音，允许）"
      }
    ],
    "table": [
      "bar 1 C  | 64×1 67×1 72×2   (*=非和弦音)",
      "bar 2 G  | 71×1 69*×1 67×2   (*=非和弦音)",
      "bar 3 Am | 64×1 67*×1 69×2   (*=非和弦音)",
      "bar 4 G  | 67×1 64*×1 62×2   (*=非和弦音)",
      "bar 5 C  | 64×1 67×1 72×2   (*=非和弦音)",
      "bar 6 G  | 74×1 72*×1 71×2   (*=非和弦音)",
      "bar 7 F  | 69×1 72×1 69×2   (*=非和弦音)",
      "bar 8 G  | 67×1 71×1 74×2   (*=非和弦音)",
      "bar 9 F  | 72×2 69×1 72×1   (*=非和弦音)",
      "bar10 C  | 76×2 72×2   (*=非和弦音)",
      "bar11 Dm | 74×1 76*×1 77×1 74×1   (*=非和弦音)",
      "bar12 G  | 71×2 74×2   (*=非和弦音)",
      "bar13 Am | 76×2 74*×1 72×1   (*=非和弦音)",
      "bar14 F  | 72×2 69×2   (*=非和弦音)",
      "bar15 G  | 74×1 71×1 67×2   (*=非和弦音)",
      "bar16 C  | 72×4   (*=非和弦音)",
      "motif xiaomi   hum      背景小节 bar3 (Am)  童声“hm-la”：主动机 E G C′ 再落回 G",
      "motif afu      pizz     背景小节 bar10 (C)  拨弦“蹑手蹑脚”：C E G E C E G C′，间隔逐渐缩短",
      "motif laozhou  wood     背景小节 bar1 (C)  低音木管：G C E D C，慢速、暖",
      "motif xiaolan  piano    背景小节 bar13 (Am)  钢琴水彩：C E G A D″ 琶音上行（add9/6），延音",
      "motif adong    trumpet  背景小节 bar15 (G)  小号冲线：G C′ E′ | G′（鼓点八分上滚）",
      "motif finale   choir    背景小节 bar16 (C)  合唱 C→G→Am→F→C 和弦“啊/哦”（背景只放第一个 C）"
    ]
  },
  "warnings": []
}
```

## 指标

- 02-story-xiaomi · xiaomi: `{"ok":true,"steps":["listen","calm","melody"],"attempts":{"listen":1,"calm":1,"melody":3},"ms":74414}`
- 02-story-xiaomi · maxBubbles: `12`
- 03-story-afu · afu_story: `{"ok":true,"steps":["wake","drop","lull"],"attempts":{"wake":1,"drop":1,"lull":1},"ms":40185}`
- 03-story-afu · npcWarps: `{"w":[],"logs":[]}`
- 04-story-laozhou · laozhou_story: `{"ok":true,"steps":["see","cookie","crowd","ember"],"attempts":{"see":1,"cookie":1,"crowd":1,"ember":1},"ms":39967}`
- 04-story-laozhou · npcWarps: `{"w":[],"logs":[]}`
- 05-story-xiaolan · xiaolan_story: `{"ok":true,"steps":["bell","smell","bike","pose"],"attempts":{"bell":1,"smell":1,"bike":1,"pose":2},"ms":66682}`
- 05-story-xiaolan · npcWarps: `{"w":[],"logs":[]}`
- 06-story-adong · adong_story: `{"ok":true,"steps":["clear","ramp","light","crowd","start"],"attempts":{"clear":1,"ramp":1,"light":2,"crowd":1,"start":1},"ms":68846}`
- 06-story-adong · npcWarps: `{"w":[],"logs":[]}`
- 07-story-finale · finale_story: `{"ok":true,"steps":["lamp1","lamp2","lamp3","lamp4","lamp5","tree"],"attempts":{"lamp1":1,"lamp2":1,"lamp3":1,"lamp4":1,"lamp5":1,"tree":1},"ms":34846}`
- 07-story-finale · npcWarps: `{"w":["abao:1"],"logs":[{"text":"[warp] abao → (12.5,5.6) from (11.6,4.7)","at":392.8}]}`
- 07-story-finale · endPanelButtons: `[["",435,418,190,48],["",655,418,190,48]]`
- 09-stress-mainline · mainline: `{"wallMin":7.472366666666667,"gameMin":7.458166666666667}`
- 09-stress-mainline · samples: `[{"label":"start","wall":0.022,"now":1.56,"heapMB":236.02088737487793,"tex":847,"objs":840,"warmth":0},{"label":"xiaomi_story","wall":30.896,"now":32.42,"heapMB":250.9216661453247,"tex":854,"objs":868,"warmth":36},{"label":"afu_story","wall":83.481,"now":85.02,"heapMB":252.8866138458252,"tex":849,"o`
- 10-negative · monkey1: `["ground","ground","ground","ground","ground","ground","ground","ui:","edge","edge","edge","ground","ui:","edge","ground","ground","ui:","edge","ground","ground","ground","ui:ui:mute","ground","ground","ground","ground","ground","ground","ground","ground","prop:windchime","npc:xiaomi","ground","grou`
- 10-negative · monkey2: `["ground","prop:lamp_p3","ground","ground","ground","ground","ground","ground","ground","ground","ui:","ground","ui:","ground","ground","ground","ground","ground","ground","ui:ui:mute","ground","prop:lamp_p1","edge","ground","ground","ground","npc:uncle_wu","npc:abao","ground","prop:windchime","npc:`
- 10-negative · monkey3: `["ground","ground","ground","ground","ground","ground","ground","ground","ground","npc:xiaomi","ground","ground","prop:mailbox_alley","ground","edge","ground","ground","ground","npc:afu","ui:ui:mute","ground","ground","ground","ground","ground","prop:radio","ground","npc:adong","ground","ground","np`
- 11-negative-story · spam chime_ring: `{"clicks":20,"cooldowns":{}}`
- 11-negative-story · 阿冬拒绝台词 "自己的轮子自己推。": `{"shown":false}`
- 13-shots · shots: `{"regions":["plaza","bakery","slope","alley","bridge","dock"],"phases":["morning","noon","dusk","night"]}`
- 14-perf · resources:desk: `{"textures":855,"textureMB":164.8,"displayObjects":848,"tweens":2,"particles":null,"timers":0,"jsHeapMB":244.2,"gameFps":55.4,"renderer":"WEBGL","glRenderer":"ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)"}`
- 14-perf · resources:low: `{"textures":850,"textureMB":164.6,"displayObjects":843,"tweens":2,"particles":null,"timers":0,"jsHeapMB":227,"gameFps":24.4,"renderer":"WEBGL","glRenderer":"ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)"}`
- 17-audio · audioState: `null`
- 18-endpanel-persist · save.extra: `{"flags":{"game_complete":1},"ended":true}`
- 19-eggs-feedback · prelude 反馈: `["我的喇叭！谁动我的喇叭？！…诶，还挺好听。","哇！太、太突然了！我心脏…","饼干！！谁掉的？","冬至吃饺子，圣诞……吃啥？"]`

## 可交互控件尺寸（桌面 FIT 缩放后 CSS px；触屏要求 ≥44px）

| 控件 | 宽 | 高 |
|---|---|---|
|  | 218 | 110.1 |
| ui:menu | 46 | 46 |
| ui:mute | 46 | 46 |
|  | 262 | 46 |

## Console / 页面错误

无。

## 截图

### 01-smoke

![desk-title.png](screenshots/20261118-182326/desk-title.png)
![desk-start.png](screenshots/20261118-182326/desk-start.png)

### 02-story-xiaomi

![desk-xiaomi_story-listen.png](screenshots/20261118-182326/desk-xiaomi_story-listen.png)
![desk-xiaomi_story-melody.png](screenshots/20261118-182326/desk-xiaomi_story-melody.png)
![desk-after-finale.png](screenshots/20261118-182326/desk-after-finale.png)

### 03-story-afu

![desk-afu_story-wake.png](screenshots/20261118-182326/desk-afu_story-wake.png)
![desk-afu_story-drop.png](screenshots/20261118-182326/desk-afu_story-drop.png)
![desk-afu_story-lull.png](screenshots/20261118-182326/desk-afu_story-lull.png)
![desk-after-finale.png](screenshots/20261118-182326/desk-after-finale.png)

### 04-story-laozhou

![desk-laozhou_story-see.png](screenshots/20261118-182326/desk-laozhou_story-see.png)
![desk-laozhou_story-cookie.png](screenshots/20261118-182326/desk-laozhou_story-cookie.png)
![desk-laozhou_story-ember.png](screenshots/20261118-182326/desk-laozhou_story-ember.png)
![desk-after-finale.png](screenshots/20261118-182326/desk-after-finale.png)

### 05-story-xiaolan

![desk-xiaolan_story-bell.png](screenshots/20261118-182326/desk-xiaolan_story-bell.png)
![desk-xiaolan_story-smell.png](screenshots/20261118-182326/desk-xiaolan_story-smell.png)
![desk-xiaolan_story-bike.png](screenshots/20261118-182326/desk-xiaolan_story-bike.png)
![desk-xiaolan_story-pose.png](screenshots/20261118-182326/desk-xiaolan_story-pose.png)
![desk-after-finale.png](screenshots/20261118-182326/desk-after-finale.png)

### 06-story-adong

![desk-adong_story-clear.png](screenshots/20261118-182326/desk-adong_story-clear.png)
![desk-adong_story-ramp.png](screenshots/20261118-182326/desk-adong_story-ramp.png)
![desk-adong_story-light.png](screenshots/20261118-182326/desk-adong_story-light.png)
![desk-adong_story-crowd.png](screenshots/20261118-182326/desk-adong_story-crowd.png)
![desk-after-finale.png](screenshots/20261118-182326/desk-after-finale.png)

### 07-story-finale

![desk-finale_story-lamp1.png](screenshots/20261118-182326/desk-finale_story-lamp1.png)
![desk-finale_story-lamp2.png](screenshots/20261118-182326/desk-finale_story-lamp2.png)
![desk-finale_story-lamp3.png](screenshots/20261118-182326/desk-finale_story-lamp3.png)
![desk-finale_story-lamp4.png](screenshots/20261118-182326/desk-finale_story-lamp4.png)
![desk-finale_story-lamp5.png](screenshots/20261118-182326/desk-finale_story-lamp5.png)
![desk-finale_story-tree.png](screenshots/20261118-182326/desk-finale_story-tree.png)
![desk-after-finale.png](screenshots/20261118-182326/desk-after-finale.png)
![desk-finale-end.png](screenshots/20261118-182326/desk-finale-end.png)
![desk-sandbox-after-end.png](screenshots/20261118-182326/desk-sandbox-after-end.png)

### 09-stress-mainline

![desk-sandbox-5.png](screenshots/20261118-182326/desk-sandbox-5.png)
![desk-sandbox-10.png](screenshots/20261118-182326/desk-sandbox-10.png)
![desk-sandbox-15.png](screenshots/20261118-182326/desk-sandbox-15.png)
![desk-sandbox-20.png](screenshots/20261118-182326/desk-sandbox-20.png)
![desk-sandbox-25.png](screenshots/20261118-182326/desk-sandbox-25.png)
![desk-sandbox-30.png](screenshots/20261118-182326/desk-sandbox-30.png)

### 10-negative

![desk-after-monkey.png](screenshots/20261118-182326/desk-after-monkey.png)
![desk-annoy-npc.png](screenshots/20261118-182326/desk-annoy-npc.png)
![desk-resize-1920x1080.png](screenshots/20261118-182326/desk-resize-1920x1080.png)
![desk-resize-960x540.png](screenshots/20261118-182326/desk-resize-960x540.png)
![desk-resize-390x844.png](screenshots/20261118-182326/desk-resize-390x844.png)
![desk-resize-1280x720.png](screenshots/20261118-182326/desk-resize-1280x720.png)

### 11-negative-story

![desk-early-mailbox_alley.png](screenshots/20261118-182326/desk-early-mailbox_alley.png)
![desk-early-oven.png](screenshots/20261118-182326/desk-early-oven.png)
![desk-early-bus_door.png](screenshots/20261118-182326/desk-early-bus_door.png)
![desk-early-tree.png](screenshots/20261118-182326/desk-early-tree.png)
![desk-early-bike_xl.png](screenshots/20261118-182326/desk-early-bike_xl.png)
![desk-adong-click.png](screenshots/20261118-182326/desk-adong-click.png)

### 12-visual-overlap

![desk-plaza-morning.png](screenshots/20261118-182326/desk-plaza-morning.png)
![desk-plaza-noon.png](screenshots/20261118-182326/desk-plaza-noon.png)
![desk-plaza-dusk.png](screenshots/20261118-182326/desk-plaza-dusk.png)
![desk-plaza-night.png](screenshots/20261118-182326/desk-plaza-night.png)
![desk-bakery-morning.png](screenshots/20261118-182326/desk-bakery-morning.png)
![desk-bakery-noon.png](screenshots/20261118-182326/desk-bakery-noon.png)
![desk-bakery-dusk.png](screenshots/20261118-182326/desk-bakery-dusk.png)
![desk-bakery-night.png](screenshots/20261118-182326/desk-bakery-night.png)
![desk-slope-morning.png](screenshots/20261118-182326/desk-slope-morning.png)
![desk-slope-noon.png](screenshots/20261118-182326/desk-slope-noon.png)
![desk-slope-dusk.png](screenshots/20261118-182326/desk-slope-dusk.png)
![desk-slope-night.png](screenshots/20261118-182326/desk-slope-night.png)
![desk-alley-morning.png](screenshots/20261118-182326/desk-alley-morning.png)
![desk-alley-noon.png](screenshots/20261118-182326/desk-alley-noon.png)
![desk-alley-dusk.png](screenshots/20261118-182326/desk-alley-dusk.png)
![desk-alley-night.png](screenshots/20261118-182326/desk-alley-night.png)
![desk-bridge-morning.png](screenshots/20261118-182326/desk-bridge-morning.png)
![desk-bridge-noon.png](screenshots/20261118-182326/desk-bridge-noon.png)
![desk-bridge-dusk.png](screenshots/20261118-182326/desk-bridge-dusk.png)
![desk-bridge-night.png](screenshots/20261118-182326/desk-bridge-night.png)
![desk-dock-morning.png](screenshots/20261118-182326/desk-dock-morning.png)
![desk-dock-noon.png](screenshots/20261118-182326/desk-dock-noon.png)
![desk-dock-dusk.png](screenshots/20261118-182326/desk-dock-dusk.png)
![desk-dock-night.png](screenshots/20261118-182326/desk-dock-night.png)

### 13-shots

![desk-morning-plaza.png](screenshots/20261118-182326/desk-morning-plaza.png)
![desk-morning-bakery.png](screenshots/20261118-182326/desk-morning-bakery.png)
![desk-morning-slope.png](screenshots/20261118-182326/desk-morning-slope.png)
![desk-morning-alley.png](screenshots/20261118-182326/desk-morning-alley.png)
![desk-morning-bridge.png](screenshots/20261118-182326/desk-morning-bridge.png)
![desk-morning-dock.png](screenshots/20261118-182326/desk-morning-dock.png)
![desk-noon-plaza.png](screenshots/20261118-182326/desk-noon-plaza.png)
![desk-noon-bakery.png](screenshots/20261118-182326/desk-noon-bakery.png)
![desk-noon-slope.png](screenshots/20261118-182326/desk-noon-slope.png)
![desk-noon-alley.png](screenshots/20261118-182326/desk-noon-alley.png)
![desk-noon-bridge.png](screenshots/20261118-182326/desk-noon-bridge.png)
![desk-noon-dock.png](screenshots/20261118-182326/desk-noon-dock.png)
![desk-dusk-plaza.png](screenshots/20261118-182326/desk-dusk-plaza.png)
![desk-dusk-bakery.png](screenshots/20261118-182326/desk-dusk-bakery.png)
![desk-dusk-slope.png](screenshots/20261118-182326/desk-dusk-slope.png)
![desk-dusk-alley.png](screenshots/20261118-182326/desk-dusk-alley.png)
![desk-dusk-bridge.png](screenshots/20261118-182326/desk-dusk-bridge.png)
![desk-dusk-dock.png](screenshots/20261118-182326/desk-dusk-dock.png)
![desk-night-plaza.png](screenshots/20261118-182326/desk-night-plaza.png)
![desk-night-bakery.png](screenshots/20261118-182326/desk-night-bakery.png)
![desk-night-slope.png](screenshots/20261118-182326/desk-night-slope.png)
![desk-night-alley.png](screenshots/20261118-182326/desk-night-alley.png)
![desk-night-bridge.png](screenshots/20261118-182326/desk-night-bridge.png)
![desk-night-dock.png](screenshots/20261118-182326/desk-night-dock.png)

### 16-touch

![phone-small-after-gestures.png](screenshots/20261118-182326/phone-small-after-gestures.png)

### 18-endpanel-persist

![desk-end-panel-restored.png](screenshots/20261118-182326/desk-end-panel-restored.png)
