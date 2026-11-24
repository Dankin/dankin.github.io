# QA 报告 v6 重设计回归(qa-v5,HEAD fb469a8,分支 v3)

范围:plan/80-v6-redesign.md 全量回归。三视口:844×390(land)、390×844(port)、1280×800(desk)。
脚本:`scripts/qa/{v6tour,mig6,v6misc,perf,gift,saves,panels}.mjs`(用法见各文件头)。截图:`qa/shots/v6/`(精选 JPG,`sheets/` 为对照拼图)。

## 结论
- **P0:无。**
- **P1:1 项**(旧生产建筑美术仍在场景里画出,违反 plan/80 §1 与 §8)。
- P2:9 项。无自修(P1 在 `src/ui/scene-art.ts`,属 eng-app,不在 qa 范围)。

## 基线
| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 错误 |
| `npm test` | 142/142 通过 |
| `npm run build` | dist ≈ 500KB(预算 1MB) |
| `node scripts/smoke.mjs` | 全部通过(exit 0) |
| `sim-v5.ts --all`(均值) | cps0 73.4(≤75 ✓)/ cps1 55.7(55–65 ✓,贴下限)/ cps4 45.8(≥42 ✓) |

## P1
### P1-1 旧"生产建筑"仍在场景里画出(果山 / 果城 / 果星 / 苹果之门)
- 现象:源档 ≥1 时,树旁中央一直画着旧建筑:src1 b1=苹果山、src2=白色城市+大苹果、src3/4=带星环苹果的石台(果星)。所有运输档场景里它都在,车/船/直升机/飞机/传送门都会叠在它上面。
- 证据:`qa/shots/v6/v6_src1b1_scene_land.jpg`、`v6_src2b0_scene_land.jpg`、`v6_src4b0_scene_land.jpg`、`v6_convoy30_b0_desk.jpg`(石台与星居中)、对照拼图 `qa/shots/v6/sheets/land_b0_srcA.jpg`。
- 原因:`src/ui/scene-art.ts:685-689`
  ```ts
  const bt = this.bldTier();
  if (bt > 0) { drawBuilding(c, g.bldX, g.gyA, g.bldS * pop, { tier: bt as 1, variant: ... }); }
  ```
  `bldTier()`(`:486`)= `clamp(round(srcTier),0,5)`。`src/art/nature/buildings.ts` 首行已标 `@deprecated 整文件`。`:386` 的热区逻辑也用了 `bldTier()`。
- 修法:删掉 `:685-689` 的绘制块与 `:386` 附近的 bldTier 热区,`bldTier()` 一并清理;顺手删 `buildings.ts` 及 `src/ui/sources.ts` 的死代码引用。
- 负责人:eng-app(art-nature 配合删文件)。

## P2
1. **首次点击 AudioContext 长任务**:CPU 4× 下首个时代出现 1489ms 长任务(profiler:AudioContext 14.8%),整段平均帧 19.57ms。1× 约 370ms,低端手机首摇可能卡一下。建议 audio 在 `pointerdown` 里延迟/分片创建,或首屏空闲时预创建 suspended context。owner:audio。
2. **大车队买入卡顿**:bot 连续买到 26–31 辆车时主线程停顿 1.5–3.4s(desk 两次、land b0 三次、port b0 四次,最长 3432ms)。多档批量购买路径需排查(疑似每辆车重算/重绘缓存)。owner:eng-app。人手点击的节奏下未复现。
3. **车队重叠**:卡车/飞机档车队里相邻两辆会叠在一起(`v6_convoy30_b0_land.jpg`、port 同),`×N` 角标未见;plan/80 §2 要求间隔均匀、上限 3–4 辆 + ×N。owner:art-things / eng-app(`src/ui/scene-art.ts:453-460,530-537` 的 `fleetCycle/runPhase`、`src/art/things/transports8.ts:70,115`)。
4. **老徐按钮显示数字**:底栏"请老徐上场鼓掌 1936"带具体价格,与"少数值、多抽象描述"不一致(同类:HUD 顶栏仍显示 9842亿 / +75.4万/秒,若那是预期可忽略)。owner:ui-v5 / writer。
5. **旁白/新闻条残留**:苹果日报行偶见半句残留("里。"),右上旁白淡出时叠在 HUD 上显得发虚。owner:eng-app。
6. **阶段卡"知道了"按钮压住底栏卡片**(844×390):按钮与底栏购买卡片底部有重叠,卡本身未出视口(几何检查 3 视口通过)。owner:ui-v5。
7. **右侧 dock(图/献)在窄屏压在树冠/传送门上**(844×390、390×844),可点击但遮挡画面。owner:ui-v5。
8. **debug 把 coins 设到 ≥1e15 会让页面挂死**(CDP 超时)。只在 debug 可达,但说明大数格式/循环有未封顶路径。owner:systems。
9. **死代码/文案残留**:`src/ui/sources.ts`(旧果山等绘制)、`src/content/copy.ts:28` 含"果山"一句、`newsRules.ts:61` 注释。owner:writer / eng-app。
10. 另:设置页底部"更多:主题 / 摇一摇 / 精确数字"打开的旧抽屉里只看到主题/声音/摇一摇/存档/倍速/调试,**没找到"精确数字"开关**(plan/80 总原则称精确数字放该页)。请 eng-app 确认入口位置。

## 通过项
- **迁移**(`mig6.mjs`,三视口全过):v6→v7(源档映射 `[0,1,2,3,3,4]`、路线 `[0,1,2,2,3,4,5,6,7]`,gate 字段移除,蹦床折算)、v5(helpers 7→hl 5)、v4 整链全部载入为 v7,无 NaN,`.v4/.v5/.v6.bak` 均写出,迁后可继续玩,无 console 错误。
- **存档**(`saves.mjs`):导出/导入、截断/乱码保持原状态、`.bak` 回退、两份都坏则新档、新版本只读,通过;离线 1h/1d/3d 按 8h 封顶结算并弹明信片 toast(3d:+1598万个)。
- **礼物页**(`gift.mjs`,三视口):2026-12-23T15:59:59Z 在 Asia/Shanghai / America/Los_Angeles / Pacific/Kiritimati / UTC 均为 SEALED,16:00:00Z 均为 OPEN;`#g=` 链接(`scripts/make-gift.mjs`)解密成功,错密码/截断/篡改走错误文案;非 debug 下 `?date=` 无效。
- **面板**:设置/图鉴/订单/献果/礼物 开关(✕ / Esc / 遮罩)全过,均在视口内;信箱、明信片、蹦床已不存在(dock 无信箱)。阶段卡 src-0 / rt-0 / station 三视口完整在视口内。
- **热点**:害虫/订单/烂果/彩蛋热点真实点击可用(前一轮);v6:小鸟点中增加收益、飞走啄走库存,牛顿/流星事件触发,13 个彩蛋角色 `g.tap(id)` 均不抛错且多数记入图鉴。
- **性能**(land 844×390,CPU 4×,dpr2,每时代 10s):除首档含 1.49s 音频长任务外均 59.8–60fps,长任务 0,空闲 69–74%;热点 `drawSantaDepot` 1.2–2.2%、`wob` 0.7%。
- **console**:所有流程(FTUE、v6 旅程 6 组、面板、礼物、迁移、杂项)无 error/warn/未捕获异常。

## plan/80 对照
| 条目 | 结果 |
|---|---|
| §1 树 5 档原地进化 + 双变体 | ✓(老树/巨树树屋/云树吊篮/星树彩灯;b0/b1 可区分)|
| §1 删除果园/果山/果城/果星/苹果之门 | ✗ 仍画出,见 P1-1 |
| §1 库存堆在树脚 | ✓(取自堆;"×12"数量标 + "货不够"提示)|
| §2 运输 8 档 + 分支造型 | ✓ 8 档可见;车队 ≤3–4 辆但相邻重叠(P2-3)|
| §3 收货站 | ✓ 木屋/小精灵/雪橇/礼物堆在右端出现;卡片已显示 |
| §4 老徐随树变大 | ✓ 梯子/树屋/吊篮/树顶均可见,未被树遮挡 |
| §6 鸟/彩蛋角色 | ✓ 功能通过 |
| §7 阶段卡 | ✓ 三视口在视口内、8s 自动收起、遮罩点穿已修 |
| §8 删槽位/信箱/蹦床 | ✓ DOM 与存档均已清;残留见 P2-9 |
