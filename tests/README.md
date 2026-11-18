# 圣诞帽帽 · 自动化测试框架

Playwright（真实 Chrome + SwiftShader 软件 WebGL）驱动**真实鼠标/触屏事件**，配合 `?debug=1` 下的 `window.__qa`（`src/debug/testApi.ts`）读取游戏内部状态。**不新增项目依赖**。

## 运行

```bash
# 前置：dev server 已在 http://127.0.0.1:5173 运行（npm run dev，别再开第二个）
cd /Users/bilibili/Documents/AI/christmas/game/tests
node run-all.mjs                      # 全部用例 → docs/qa/report-<日期时间>.md（并更新 report-latest.md）
node run-all.mjs --only 02,03         # 按文件名前缀/包含筛选
node run-all.mjs --tag smoke          # 按标签（smoke/story/realclick/touch/perf/neg/visual/stress/audio/save）
node run-all.mjs --slow               # 含 slow 标签用例（09 整条主线真实点击 + 30 游戏分钟压力，约 10 分钟）；不带 --slow 时默认跳过
node run-all.mjs --list               # 列出用例
node specs/02-story-xiaomi.spec.mjs   # 单跑一个用例（输出同上，截图在 out/<runId>/<specId>/）
```

退出码：有 ❌ 失败用例则 1。🟡「已知缺陷」= 断言带 `{bug:'BUG-xxx'}` 失败，不使退出码非 0，但报告里单独列出。

环境变量：`QA_URL`（默认 `http://127.0.0.1:5173`）、`CHROME_PATH`、`PW_CORE`（playwright-core 路径）、`QA_RUN_ID`。

## 用例清单（specs/）

| 编号 | 内容 |
|---|---|
| 01 | 冒烟：启动/标题/开始/无 console error/帧率/资源 |
| 02–07 | 六条故事（小米/阿福/老周/小蓝/阿冬/终章）真实点击通关（前置故事自动先通），全程 UI 重叠/文案外露/NPC 兜底瞬移检测；07 含终章台词、尾声、结尾面板 |
| 09 (slow) | 整条主线真实点击 + 30 轮沙盒加速乱点（≥29 游戏分钟）：不变量、重叠、堆叠、堆内存/纹理增长 |
| 10 / 11 | 负面边界：乱点/冷却连点/骚扰NPC/点人/失焦缩放/竖屏；故事向：乱序触发、提前点后续物件、阿冬尊重性 P0、连点同招、演出中刷新 |
| 12 | 视觉：6 区域 × 早晚 × 桌面/手机 UI 重叠与触屏目标 ≥44px |
| 13 | 视觉验收截图 6 区域 × 4 时段 + 手机横屏（供人工/视觉比对），自动查落水/落墙/界外 |
| 14 | 性能：空闲/各区域帧时间、CPU 4× 低性能、纹理/内存 |
| 15 | 存档：自动存、继续、导入导出、坏档 |
| 16 | 触屏：844×390 横屏点击/拖动/长按/捏合、按钮大小 |
| 17 | 音频自检（调用 `src/audio/selftest.ts` 的 `runSelfTest()`，OfflineAudioContext，不发声） |

`repro/afu-enter-stuck.mjs`：BUG-009（阿福走向 [2,34.6] 卡住）复现/回归脚本（`ROUNDS=6 node repro/afu-enter-stuck.mjs`）。

## playwright-core 从哪来

`lib/pw.mjs` 依次查找：`$PW_CORE` → `game/tests/node_modules/playwright-core` → `/tmp/pw/node_modules/playwright-core`。
如果 `/tmp/pw` 被清掉，二选一：
```bash
mkdir -p /tmp/pw && cd /tmp/pw && npm i playwright-core   # 或
ln -s /tmp/pw/node_modules /Users/bilibili/Documents/AI/christmas/game/tests/node_modules   # 软链（已在 .gitignore）
```
浏览器用系统 `/Applications/Google Chrome.app`，不下载浏览器。

## 目录

| 路径 | 作用 |
|---|---|
| `lib/pw.mjs` | 解析 playwright-core / Chrome / BASE_URL |
| `lib/session.mjs` | `Session`：启动浏览器、错误收集、真实点击、触屏(CDP)、等待、截图、帧率/资源采样；冻结 Vite HMR |
| `lib/spec.mjs` | 用例运行器（`t.ok/eq/near/note/skip/launch/step`、结果 JSON） |
| `lib/driver.mjs` | `playStory()`：按故事 hint 真实点击通关；`monkey()`：随机乱点 |
| `lib/report.mjs` | 生成 `docs/qa/report-*.md` |
| `specs/NN-*.spec.mjs` | 用例，`export default {id,title,tags,timeout,run(t)}` |
| `out/<runId>/<specId>/` | 截图与 `result.json`（已 .gitignore） |

## 写用例

```js
import { runIfMain } from '../lib/spec.mjs';
export default {
  id: '10-demo', title: '示例', tags: ['demo'], timeout: 60000,
  async run(t) {
    const s = await t.launch({ device: 'phone' });   // desktop | desktop-small | phone | phone-small | phone-portrait | tablet | lowend
    await s.goto({ fresh: true });                   // 自动加 ?debug=1，清存档
    await s.start();                                 // 真实点击标题
    await s.possess('windchime');                    // 真实点击物件，等帽子飞到并弹出招式面板
    await s.clickMoveButton('chime_ring');           // 真实点击招式按钮
    await s.waitStep('xiaomi_story', 'listen');      // 等故事步骤
    await s.shot('listen');
    t.ok((await s.state()).warmth > 0, '暖度上涨');
    t.ok((await s.qa('overlaps')).length === 0, '无 UI 遮挡', { bug: 'BUG-001' });  // 带 bug 编号=已知缺陷
  },
};
await runIfMain(import.meta.url, spec);
```

### Session 速查
- 状态：`s.state()`（hat/npcs/stories/checklist/stimuli/cooldowns/bubbles…）、`s.qa('fn', ...args)` 调 `window.__qa[fn]`、`s.resources()`、`s.frames(secs)`
- 等待：`waitState(pred)`、`waitStep/waitStoryDone/waitNpcState/waitWarmth/waitIdle/waitRegion/waitPanel`
- 鼠标：`clickProp(id) clickNpc(id) clickTile(tx,ty) flyTo(tx,ty) mouseClick(x,y) hover`；触屏设备自动改用 CDP 触摸 `tap/longPress/drag/pinch`
- 窗口：`resize(w,h)`、`blurFocus(ms)`、`reload()`
- 截图：`shot(name)`；失败现场自动截图

### `window.__qa`（`?debug=1`）
换算 `propPoint/npcPoint/groundPoint/tileToPage`；控件 `uiButtons/moveButton/touchTargets`；状态 `state/readSave/storageDump`；
**捷径**（仅压测/夹具使用，通关脚本禁用）`teleportHat/teleportNpc/advance/setSpeed/setPhase/setWarmth/runSequence/completeStep/useMove/clearCooldowns/resetSave`；
检测 `overlaps/clippedTexts/invariants/npcStacking/resources/frameSample`。

## 约定与注意

- **真实点击通关脚本不得调用** `runSequence/completeStep/useMove(捷径)`；只能 `possess + clickMoveButton`。
- 其他成员改源码会触发 Vite 整页刷新，`Session` 默认用空壳替换 `/@vite/client` 冻结 HMR；用例开始时加载的是当时的代码。需要 HMR 时 `launch({hmr:true})`。
- SwiftShader 软渲染，fps 是**相对值**；真机性能更好。低性能档用 CPU 4x 降速模拟。
- 开发期间 dev server 可能处于“半成品”状态导致 `pageerror`，这类环境噪音需先确认（`npx tsc --noEmit`）再记缺陷。

## 依赖的内部字段（改名请通知 qa）

`window.__game.scene.getScene('game')`：`started locked now warmth region cd props npcs hat hud bubbles seq stim story|stories`；
`hud.panelOpen/panelBox/toastQ/checkBg/done`；`bubbles.list[{key,cont,w,h,t}]`；`hat.{x,y,z,attachedTo,moving}`；`npc.{x,y,state,spr}`。
建议 dev 提供：`hud.qaRects()`、`bubbles.qaRects()`（返回 `{id,kind,x0,y0,x1,y1}[]`）与按钮 `setData('qa','move:<id>')`，测试将优先使用。
