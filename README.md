# Shake the Apple

摇苹果树的放置小游戏:目标是累计送出 82 亿个平安果。打完大约 2 小时,圣诞节前后有彩蛋。免费,非商业,东方二创风格的原创小调,与苹果公司无关。

在线玩:见仓库的 GitHub Pages(`main` 分支是构建产物,`source` 分支是源码)。

## 命令

- `npm install`
- `npm run dev`:开发服务器 http://127.0.0.1:5174
- `npm run build`:类型检查并打包成单个 `dist/index.html`,可直接双击离线打开
- `npm test`:核心逻辑单元测试
- `node scripts/smoke.mjs`:Chrome 冒烟测试(需先 build)
- `node scripts/sim.ts <每秒点击数>`:数值模拟,看各期用时和通关时间

## 调试参数

- `?debug=1` 或 `?speed=60`:出现时间加速面板
- `?calm`:关闭收获周期和下雨加成,数值恒定
- `?date=2025-12-24`:预览圣诞彩蛋

规范见 [SPEC.md](SPEC.md)。结构:`src/core` 游戏逻辑(不依赖 DOM),`src/ui` 画面,`src/audio` 音乐与音效,`src/main.ts` 主循环。
