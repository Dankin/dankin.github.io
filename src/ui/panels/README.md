# src/ui/panels — DOM 面板层(ui-v5)

纸张米白 + 黑色粗描边 + 红点缀。CSS 全在 `panels.css`(由 `index.ts` import,Vite 打包),类名一律 `.panel-*` / `#panel-*`,不改 index.html。

## 接入
```ts
import { mountPanels } from './ui/panels/index.ts';
const api = mountPanels({ bus, getState, audio, actions, nowMs, version, debug, dock: 'float' });
```
`PanelCtx`(types.ts):`bus`、`getState()`、`audio?`(GameAudio)、`actions?`、`nowMs?()`、`debug?`、`version?`、`root?`、`dock?: HTMLElement|'float'|null`(null=不建入口按钮,由宿主自己调 api.open*)、`kv?`。

`actions`(全部可选,缺则对应按钮置灰):`claimOrder(id)`、`offer(W)`、`offerPreview(W)`、`offerOpen()`、`exportSave()`、`importSave(text)`、`resetSave()`、`settingsChanged()`、`giftClosed()`。

## PanelsApi
`say(text, speaker?, {force})` 旁白 · `onAway(min)` · `enterEra(era,{force})` · `openCodex(tab?)` · `openMailbox()` · `openPostcard(id)` · `openOrders()` · `openOffer()` · `openSettings()` · `openGift({force?:'sealed'|'open'})` · `tick()`(内部每秒自走,宿主无需调)· `isModalOpen()` · `closeAll()` · `badges()`→`{codex,mailbox,orders}` · `destroy()`。
另导出 `PEST_HINT`(虫眼提示文案)。

自动订阅 bus:`era`(弹明信片 + 时代旁白)、`delivered`(里程碑旁白)、`egg`。

## 六块面板
1. 旁白条 `narration.ts`:队列 4 条,`NARRATION_LIMITS` 冷却,点一下跳过,打字机可关(设置里),任何弹层打开时暂挂。位置在顶栏+新闻条之下。
2. 时代明信片/信箱 `postcards.ts`:进入新时代弹卡,「收进信箱」;已有弹层时静默入箱并亮红点。
3. 图鉴 `codex.ts`:品种(未发现=剪影)/彩蛋(未发现灰色+提示)/成就。
4. 订单气泡+订单面板+献果 `orders.ts`:左侧气泡条(点击满足/看详情),`献` 在 `offerOpen` 之后出现。
5. 设置 `settings.ts`:音乐/音效/旁白打字音开关与音量、静音拨片提示、减少动效、存档导出/导入/重置、「与苹果公司无关」、版本、`debug` 才显示调试入口。
6. 礼物页 `gift.ts`:12/24 00:00(UTC+8)前为 SEALED(封着的盒子+倒计时),之后可拆。

## 礼物加密链接 `#g=`
格式:`#g=<base64url(salt16 | iv12 | 密文+tag)>[&k=<口令>]`
AES-256-GCM,密钥 = PBKDF2-SHA256(口令, salt, 150000 次);明文 = UTF-8 JSON `{"t":祝福正文,"s":落款}`。
生成:
```
node scripts/make-gift.mjs --pass 口令 --text "祝福正文" --sign "落款" --base https://你的域名/ [--text-file gift.txt] [--embed]
```
会同时打印「需手输口令」和「口令内嵌(`&k=`)」两种链接。不写 `--pass` 则随机口令。改格式需同时改 `scripts/make-gift.mjs` 与 `gift.ts` 的 `decryptGift`。祝福正文是用户自己写的,代码里只有占位 `{{GIFT_TEXT}}`;没有 `#g=` 时点「拆开」会显示 noPayload 提示(`ctx.debug` 下显示占位)。

## 预览与截图
`preview-panels.html?s=<scene>`(场景见 `preview.ts`),`preview-panels-frame.html?s=..&w=390&h=844` 用 iframe 模拟窄屏。截图在 `shots/panels/*-L.png`(844×390)/`*-P.png`(390×844)。
