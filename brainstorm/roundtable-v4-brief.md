# 圆桌 v4 评审简报(第 1 轮)
可玩版本: dist/index.html (npm run build 已生成),分支 v3。调试: ?debug=1 / ?speed=60 / ?date=2026-12-24。
玩法: 玩家摇苹果树(点击/空格)产出;升级生产线(树→果园→果山→果城→果星→苹果之门)与运输线(篮子→小推车→卡车→货船→飞机→传送门)的单位与档位,档位升级二选一;3 个关卡槽放道具(洗果/打蜡…);老徐自动摇树;事件(鸟/牛顿/流星);目标送出 82亿,约 60 分钟。结局日期未到(12/24 前)显示封印。
截图: shots/v4m_land_light.png (844x390 横屏), v4m_land_mid.png (中期), v4m_land_dark.png, v4m_port_light.png (390x844), v4m_port_mid.png, v4m_land_ending.png, v4m_desk_light.png.
设计文档: brainstorm/v4-spec.md, core-v4.md, ui-v4.md; 内容数值: src/core/content.ts; 模拟: node scripts/sim.ts <cps>.
已知: 两次有意义购买最长间隔 260–350s(目标≤90s);第一档时代 cps1 4.8min;分支画面差异不全;老徐按钮临时放左下;关卡 belt/brand 无图标;新手无"点树"提示。
