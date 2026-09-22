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
取交集。

## 缓存

GitHub Pages 给所有文件发 `Cache-Control: max-age=600`，而且改不了响应头，所以浏览器手里的
旧副本只能靠换 URL 换掉。`index.html` 里 `style.css` / `app.js` / `index.json` 的预加载都带
`?v=1.4`，`app.js` 会把自己 script 标签上的这个 `?v=` 原样接到后面每一个 fetch（`index.json`、
`checklist.json`、`bodies/NN.json`）上。

**发版时把 `index.html` 里那三处 `?v=` 一起改掉**，版本号跟 tag 保持一致就行。少改一处的后果是
新旧两个构建的文件混在一起：`index.json` 是新的、`bodies/` 是缓存里的旧分片，详情面板就打不开。

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

`file://` 下 `fetch` 会被浏览器拦住，必须走 http。
