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

## 本地预览

```sh
python3 -m http.server 8080
```

`file://` 下 `fetch` 会被浏览器拦住，必须走 http。
