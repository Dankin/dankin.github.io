# M3 集成验收报告（qa，2026-11-18 约 19:25–20:05）

结论：**P0 = 0，P1 = 0**。bugs.md 中无 Open / 待复验条目。

## ① 生产 dist（lead 构建，拷到 /tmp/m3/dist-prod，`vite preview` :4173）
脚本：`game/tests/m3/prod-check.mjs`（只用真实鼠标/触屏），8/8 通过，0 console error / pageerror。
- `?debug=1` 无效：`window.__game`、`window.__qa` 均为 undefined；dist 无 testApi chunk（BUG-033）。
- 慢 JS（延迟 3s）下首屏显示“🎅 圣诞帽帽 加载中…”，加载完成后 #boot 移除（BUG-032）。
- 标题点击进入游戏；点风铃附身→点“摇响风铃”生效（截图 /tmp/m3/shots/prod-05-move.png）。
- 自动存档写入 `christmas-hat/save`（567 字节，v=1）；刷新后存档保留，标题可继续。
- 竖屏（390×844）显示旋转遮罩（prod-08-portrait.png）；手机横屏 844×390 无滚动/溢出，触屏点击开始正常（prod-10）。
- 说明：生产 dist 含 `selftest-*.js`（音频自检 chunk），只能经 `sfx.selfTest()` 访问，页面上拿不到该对象，无风险。

## ② QA 构建（`VITE_QA=1 vite build` 到 /tmp/m3/dist-qa，:4174）
| 用例 | 结果 |
|---|---|
| 01 冒烟 | PASS 8/8 |
| 02 小米 / 03 阿福 / 04 老周 / 05 小蓝 / 06 阿冬 / 07 终章（真实点击链式） | PASS 5/5, 7/7, 10/10, 9/9, 10/10, 17/17 |
| 15 存档 / 16 触屏 / 19 彩蛋反馈 | PASS 4/4, 8/8, 3/3 |
| 18 结尾面板存档恢复 | PASS 7/7（首轮失败为测试侧竞态：`ensureApi` 在 reload 后过早回退到 dev 服务器，已改为先等待 `__qa` 20s） |
| 20 M3 复测（BUG-023/024/025） | PASS 11/11 |

## ③ 缺陷复测
| 编号 | 结果 |
|---|---|
| BUG-023 | 通过：门未开点“摆姿势”冒“……缺点什么。” |
| BUG-024 | 通过：到站前无误导提示，到站后提示指向 bus_door |
| BUG-025 | 通过：小蓝完成后转镜子仍得 halo_snowman |
| BUG-030 | 通过：首次丢上下文自动重载一次；再次丢失出现“重新加载”浮层，恢复后消失（/tmp/m3/shots/ctx-lost2.png） |
| BUG-032 / 033 | 通过（见①） |

观察（不计缺陷）：第一次 WebGL 丢失即使在游戏中也会自动重载，最多丢失 12 秒自动存档间隔内的进度。

## 未覆盖 / 风险
- 无真机、无真实 GPU：G10 帧率（桌面 ≥50、手机 ≥30）只有 SwiftShader 数据（桌面约 41–45fps，4× 降速低性能约 21–24fps），需人工在真机复核。Safari/iOS/Android 兼容、听感同样需人工。
- 清单彩蛋“？”、路人“平安夜快乐”、G6/G8/G9 提示未做自动化。
- 日志：/tmp/m3/qa-run.log、/tmp/m3/retest2.log。
