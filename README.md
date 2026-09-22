# dankin.github.io

素问语料阅读器。静态站点，无依赖，GitHub Pages 从 `main` 根目录直接发布。

## 数据构建

`data.json`（17MB，语料生成管线的产物）是**构建输入，不由页面加载**。每次重新生成
`data.json` 后必须跑一次拆分，否则站点仍在用旧的 `index.json`：

```sh
node build-split.js
```

产出两部分，页面只阻塞在第一个：

- `index.json` — 全部 3848 条的轻字段（1.69MB / gzip 663KB），首屏唯一阻塞请求
- `bodies/NN.json` — 64 个分片，装正文、principles、url、file；点开详情才按 id 前缀拉一片（最大 378KB / gzip 162KB）

只有两个字段不落地：`short` 就是 `id` 的前 8 位，`type` 页面从不读取；其余字段全在这两者之一。
索引条目和分片的 key 都用这个 8 位短 id（`data.json` 里存的是完整 UUID），构建时会断言它无重复，
一旦碰撞就直接报错——否则会有条目静默丢掉分片记录，详情面板打开就是空的。

搜索覆盖问题、论断、「反对」、标题；**不含正文**，因为正文不再常驻内存。多词按空格分开，
取交集。命中的词在列表、详情面板、清单里都会高亮，正文也标——正文虽然不参与匹配，但从搜索
点进来的人正是要在文章里找那个词。

`checklist.json` 的每条 move 需要一个稳定的 `id`（现在是 `q01`–`q34`）。勾选状态按这个 id
存在 localStorage，早先按 move 原文存，改一个字读者的勾就全丢了；`app.js` 里有一次性迁移，
认得出老的文本 key 就换成 id。**重新生成 checklist.json 时要把 id 带上**，否则又退回按文本存。

## URL 就是状态

读者看到的每样东西都在 URL 里，所以任何一屏都是一条能发出去的链接，刷新也回到原处：

| | |
|---|---|
| `?q=` | 搜索词 |
| `?domain=` `?year=` | 领域、年份筛选 |
| `?sort=` | 排序，默认 `date-desc` 时不写，链接短一点 |
| `?rejects=1` `?tension=1` | 两个只看开关 |
| `?view=checklist` | 提问清单页 |
| `#<8 位短 id>` | 打开的那条论断 |

控件是唯一的真相来源，URL 由控件写出去（`controlsQuery()` / `syncURL()`）；反方向只在导航时
发生——首屏、前进后退（`readQuery()`）。单向是两者不会为一次按键打起来的原因。

筛选和搜索走 `replaceState`，**不留历史条目**：每敲一个字押一条，读者按后退就得穿过三十个
几乎一样的状态才回到起点。切 tab 和打开详情走 `pushState`，这两个是真值得回去的位置。所以
URL 始终描述当前这一屏，但它不是到达这一屏的日记。

详情面板一次会话只占一条历史条目：面板里用 j/k 翻到下一条是 `replaceState` 换 hash，不会叠。
手机上面板铺满全屏，系统返回手势得关面板而不是离站，这条条目就是为它准备的；从 × 关闭也要把
它花掉，不然后退会把面板重新打开。直接从 `#id` 进来的人手里没有这条条目，此时 × 只抹掉 hash，
不动他的历史。

hash 指向一个不存在的 id（老链接、手打错）会被静默抹掉，不然读者会把这条死链接再转发一次。

## 快捷键

`/` 聚焦搜索，`Esc` 关面板，`j` / `k` 上下条——列表里移动焦点（走到底会自动翻一页），面板
打开时直接翻到结果集里的上一条/下一条，不用关掉再点。卡片上的领域、日期、「有张力」都是按钮，
点一下就筛。

卡片的正文部分是一个真 `<button>`，筛选 pill 是另外几个。以前是整张卡片 `role="button"` +
`tabindex`，pill 套在里面既不能 Tab 到也不该被外层控件吞掉；换成真按钮后 Enter / Space 不用
自己实现，无障碍树也不再是按钮套按钮。

## 缓存

GitHub Pages 给所有文件发 `Cache-Control: max-age=600`，而且改不了响应头，所以浏览器手里的
旧副本只能靠换 URL 换掉。`index.html` 里 `style.css` / `app.js` / `index.json` 的预加载都带
`?v=1.5`，`app.js` 会把自己 script 标签上的这个 `?v=` 原样接到后面每一个 fetch（`index.json`、
`checklist.json`、`bodies/NN.json`）上。

**发版时要改四处 `?v=`**：`index.html` 里三处，`404.html` 里还有一处 `style.css`。版本号跟 tag
保持一致就行。少改一处的后果是新旧两个构建的文件混在一起：`index.json` 是新的、`bodies/` 是缓存
里的旧分片，详情面板就打不开。

（`dankin.win` 现在走 Cloudflare 代理，响应头其实已经能改了——用 Cache Rules 给带 `?v=` 的资源
发 `immutable` 长 TTL、给 HTML 发短 TTL，这段手工改版本号的规矩就可以退役。还没做。）

读者那边真卡在坏缓存上时，加载失败的提示里有「绕过缓存重新加载」，走 `fetch(cache:'reload')`，
比教人按 Cmd+Shift+R 可靠（`location.reload()` 可能把同一份坏字节再取一遍）。

## 收录

`robots.txt` + 两个 HTML 里的 `<meta name="robots" content="noindex">` 表示不希望被搜索引擎
收录。HTML 在 `robots.txt` 里**故意没有 Disallow**：爬虫得能抓到页面才读得到 noindex；反过来拦掉
首页，URL 仍可能凭外链留在结果里，而且 Google 永远看不到 noindex。数据文件没有插 meta 的地方，
只能在 `robots.txt` 里挡，同时对语料抓取类 UA 整站拒绝。

这只挡守规矩的爬虫。站点是公开的，`data.json`（17MB 全量语料，页面根本不加载）目前照样能从
`dankin.win/data.json` 直接下载——真要收起来就别把它提交进发布分支。

## 本地预览

```sh
python3 -m http.server 8080
```

`file://` 下 `fetch` 会被浏览器拦住，必须走 http。「复制链接 / 复制引用」用的
`navigator.clipboard` 要安全上下文，`localhost` 和 `127.0.0.1` 算，别的裸 http 地址不算——
那种情况下按钮会显示「复制失败」，这是预期行为，不是 bug。
