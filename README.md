# dankin.github.io

素问语料阅读器。静态站点，无依赖，GitHub Pages 从 `main` 根目录直接发布。

## 数据构建

`data.json`（17MB，语料生成管线的产物）是**构建输入，不由页面加载**。每次重新生成
`data.json` 后必须跑一次拆分，否则站点仍在用旧的 `index.json`：

```sh
node build-split.js
```

产出两部分，页面只阻塞在第一个：

- `index.json` — 全部 3848 条的轻字段（1.9MB / gzip 750KB），首屏唯一阻塞请求
- `bodies/NN.json` — 64 个分片，装正文、principles、url、file；点开详情才按 id 前缀拉一片（最大 380KB / gzip 164KB）

拆分是无损的：`data.json` 的 16 个字段全部落在这两者之一。搜索覆盖问题、论断、
「反对」、标题；**不含正文**，因为正文不再常驻内存。

## 本地预览

```sh
python3 -m http.server 8080
```

`file://` 下 `fetch` 会被浏览器拦住，必须走 http。
