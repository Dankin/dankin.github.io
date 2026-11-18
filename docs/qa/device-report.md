# 设备/构建/部署 QA 报告（qa-device）

对象：生产构建（`npm run build`，在 `/tmp/qa-device-build` 副本内构建，未触碰 `game/dist`）。
托管：`tests/device/static-server.mjs`（严格 404、gzip/br；根路径 :5189，子路径 `/sub/path/` :5190），另用 `vite preview :5188` 对照。
浏览器：Chrome 157 headless（macOS，SwiftShader 软件 GL），Playwright。脚本与截图在 `game/tests/device/`（`out/`）。

## 1. 构建与体积

| 项 | 结果 |
|---|---|
| `npm run build`（tsc + vite 8.3.8） | tsc 0 错误，约 1.2s，72 modules |
| dist 总体积 | 1640 KiB 原始 / 463.8 KiB gzip / 379.4 KiB brotli |
| 主 chunk `assets/index-*.js` | 1,660,290 B（1621 KiB）；gzip 455.3 KiB；brotli 371.8 KiB；包含 phaser + 游戏代码，未分包 |
| 其他 chunk | `testApi-*.js` 11.0 KB、`selftest-*.js` 6.0 KB（调试，见 BUG-033） |
| CSS / 图片 / 音频资源 | 无（样式内联，纹理全部程序化生成） |
| `vite.config.ts` | `base: './'`，`chunkSizeWarningLimit: 2000`（压掉了 >500 KB 警告） |

**路径与泄漏审计**（`tests/device/01-build-audit.mjs` → `out/01-build-audit.json`，6/6 通过）：
- `index.html` 资源均为相对路径 `./assets/...`；根域名与子路径 `/sub/path/` 都可加载，0 个 404（严格 404 服务器）。
- 无 localhost / 127.0.0.1 / `/Users/...` 绝对路径、无 sourcemap、无根绝对路径 fetch；仅有 phaser.io、w3.org(xmlns) 字符串。
- favicon 为内联 `data:` SVG，无 `/favicon.ico` 请求（服务器上 `/favicon.ico` 确为 404，但浏览器不会请求）。
- `?debug=1` 在线上仍可用（BUG-033）。
- 优化建议：①`build.rollupOptions.output.manualChunks` 把 phaser 单拆（利于长期缓存，游戏代码改动时玩家不必重下 ~1.2MB phaser）；②保留 hashed 文件名（已是）；③Cloudflare 自动 brotli（本地实测 372KB），GitHub Pages 自身只有 gzip（455KB）；④Cloudflare 关闭 Rocket Loader / Auto Minify（会改写 `type=module` 脚本）；⑤用户站 `dankin.github.io` + 自定义域：若用 Actions 部署无需 CNAME 文件，若用分支部署需 `public/CNAME`（当前 `public/` 为空）；`.nojekyll` 非必需（无下划线目录）；⑥纹理不用懒加载（全部程序化），首屏改善见 BUG-031/032。

## 2. 流程测试（`02-flow.mjs`，生产 dist）

流程：标题→新游戏→点地面飞行→附身 lamp_p1→使用招式 lamp_glow_lamp_p1→页面隐藏自动存档→刷新→标题出现“继续/新游戏”→继续→帽子位置与存档一致。
每台设备 19 项断言（含 0 console error/pageerror/失败请求/HTTP≥400、无 [data] 告警、无滚动溢出、画布 FIT、UI 无重叠、触屏目标 ≥44 CSS px）。

| 设备 | 视口 / DPR | 结果 | 画布 | 触屏目标最小边（真实 CSS px） |
|---|---|---|---|---|
| 桌面 | 1280×720 / 1 | 19/19 PASS | 1280×720 | 46 |
| 桌面高清 | 1920×1080 / 1 | 19/19 PASS | 满屏 FIT | 51 |
| iPhone 横屏 | 844×390 / 3，touch+mobile | 19/19 PASS | 693×390 居中，两侧黑边 | 46（uiCam zoom 1.77；menu/mute 46×46，招式按钮 151×46，清单 251×46，标题按钮 182×46） |
| Android 横屏 | 915×412 / 2.625，touch+mobile | 19/19 PASS | 732×412 居中 | 46.1（zoom 1.68） |
| 竖屏 390×844 | touch+mobile | 2/2 PASS | “请横屏游玩”遮罩全屏且位于最上层 | – |
| 子路径 `/sub/path/` 桌面 | 1280×720 | 19/19 PASS | 同根路径 | 46 |

截图：`game/tests/device/out/{desktop,desktop-hd,iphone,android,portrait}/*.png`。已目视检查 iPhone 附身+招式面板、Android 标题（继续/新游戏/导入存档）：文字清晰，HUD、小地图、招式面板互不重叠；底部提示条与右下“饿——”气泡边缘相邻但不遮挡可点元素。
注意：旧 `testApi.uiButtons/touchTargets` 在手机上偏小 1.7 倍（HUD 在 uiCam 上），按 uiCam 重新换算后才是真实尺寸（BUG-034）。BUG-001 在生产构建上复验仍通过。

## 3. 加载耗时与内存（`03-perf-mem.mjs`）

测试机负载均值约 17–20（多 agent 并行），SwiftShader 软件 GL，仅作相对参考。

| 指标 | 数值 |
|---|---|
| 首次绘制 / FCP / DCL / load | 2204 / 2204 / 2160 / 2683 ms（本地服务器，宿主机繁忙） |
| Boot 场景开始 → game 场景 | 2.4s → 8.7s（纹理生成+初始化 ≈6.2s） |
| 加载进度条 | 71–72 个采样，单调递增 5→360px（满），正常；文案只有 `…`（BUG-032） |
| 首屏资源 | 853 纹理，≈165 MB（w×h×4 估算），displayObjects 850，DOM 节点 1013 |
| JS 堆（GC 后） | 13.8 MB（`performance.memory` 的 jsHeapMB 182–213 含 GPU/canvas，不作比较） |
| 软件 GL 帧率 | ≈31 fps（p50 33.3ms，p95 50ms；真机不具代表性） |
| 泄漏（快进 `advance(5s)` 循环 + 招式轮换） | 桌面 10 游戏分钟 堆 11.7→12.2 MB，斜率 0.02 MB/min；桌面 60 游戏分钟 11.7→13.3 MB，0.01 MB/min；iPhone 模拟 4 分钟 0.05 MB/min；纹理数稳定 847–854，DOM 节点 1020–1026 不增长，0 error → 无泄漏迹象 |

注意：测试 GL 参数的影响很大。headless 默认 `--use-gl=swiftshader` 在高负载下约 2/3 概率丢 WebGL 上下文（BUG-030）；`angle+swiftshader` 稳定但 Canvas2D 加速使纹理生成 168s，加 `--disable-accelerated-2d-canvas` 后 9s（BUG-031）。脚本统一用 `lib.mjs` 的 `STABLE_ARGS`（环境变量 `GPU_DEFAULT=1` 可还原）。

## 4. 弱网 / 离线（`04-network.mjs`）

| 场景 | 结果 |
|---|---|
| Slow 3G（400kbps/400ms，844×390） | JS 传输 432KB 用 8.9s；0–9.3s 画布未创建，只有 #1b1626 深色空白（无文字）；FCP 9.9s；11.2s 出现 `…`+进度条；16.9s 进入标题；0 error/0 失败请求。不白屏（深色底），但前 ~9s 无任何加载提示（BUG-032）。 |
| 加载后断网继续玩 | 可开始、可存档（localStorage），0 请求，0 error |
| 加载过程中途断网 | JS 已到达则正常完成（本测试 4s 后断网时已进入 game） |
| 冷启动断网 | 浏览器错误页（无 Service Worker，符合预期；若要离线可玩需 SW，属需求项而非缺陷） |
| `<noscript>` | 无（BUG-032） |

## 5. 音频（`05-audio.mjs`，`--autoplay-policy=document-user-activation-required`，12/12 PASS）

- 手势前：0 error；Phaser 内置 AudioContext 在 ≈450ms 创建并保持 `suspended`，无 “was not allowed to start” 错误。
- 手势后（点标题）：`src/core/audio.ts` 的 AudioContext 创建并 `running`（≈9.8s），0 新增 error。
- 静音：设置 muted 可切换往返，期间 0 error。
- 页面隐藏：游戏自己的 AudioContext `suspend()`，同时触发自动存档；恢复可见后回到 `running`；0 error。
- 信息：页面共创建 2 个 AudioContext（Phaser 内置 + audio.ts）；隐藏时只有 audio.ts 那个被显式 suspend，Phaser 那个交给 pauseOnBlur。可合并为一个，P3 级别，未单独立单。

## 6. 缺陷清单（已写入 `bugs.md`，并通知 qa）

| 编号 | 等级 | 负责人 | 摘要 |
|---|---|---|---|
| BUG-030 | P2 | dev-core | 启动期 WebGL 上下文丢失后永久空屏，无提示/不重试（headless legacy GL 复现，需真机复核） |
| BUG-031 | P2 | dev-core / art-world | 853 纹理≈165MB；加速 Canvas2D 下生成慢 ~20×；建议 `willReadFrequently:true`、图集/懒生成（需真机复核） |
| BUG-032 | P3 | dev-core | 首屏无加载提示（Slow 3G 空白 ≈9s，Boot 文案只有 `…`，无 noscript） |
| BUG-033 | P3 | dev-core / lead | 生产构建含 testApi/selftest，`?debug=1` 线上可用并暴露 `window.__qa` |
| BUG-034 | P3 | qa | testApi gameToPage 忽略 uiCam；`session.mjs` 默认 GL 参数高负载下不稳 |

## 7. 复跑方法

```
cd /tmp/qa-device-build && rsync -a --exclude node_modules --exclude dist --exclude tests --exclude out /Users/bilibili/Documents/AI/christmas/game/ ./ && ln -sfn …/game/node_modules node_modules && npm run build
node game/tests/device/static-server.mjs   # 见脚本头注释，:5189 根 / :5190 子路径
cd game/tests/device && ./run-batch.sh      # 02 流程 ×5 设备 + 子路径、05 音频、03 内存
QA_URL=http://127.0.0.1:5189 node 04-network.mjs slow3g offline-play
QA_URL=http://127.0.0.1:5189 node 06-touch-sizes.mjs desktop,desktop-hd,iphone,android
```
