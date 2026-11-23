# UI v3(黑白线稿)

风格:纸色 #f4f1ea、墨线 #1d1a17,只有苹果与礼盒是红 #d9342b;金苹果=白底+金色描边。夜晚=整张画布 CSS `filter: invert(1)`(苹果/金边在夜间预先配成反相色),`body.night` 同步翻转 DOM 配色变量。无屏幕震动,摇树只有树冠 ±1.5° 摆动;粒子≤60、掉落≤12、飘字≤4;静止 30fps,操作后 2 秒 60fps,页面隐藏停帧。

## DOM id(main.ts 可用)
#stage(canvas) #topbar #apples #rate #weather #btnSettings #goalWrap #goalBar #gift #toast #card(默认 hidden) #cardTitle #cardClose #cardBody #settings #btnSound #btnExport #btnImport #btnReset #saveWarn #debug #btnCloseSettings

index.html 内联脚本只做:设置面板开合、#cardClose / 点卡片外关闭(设 card.hidden=true,并在 #card 上派发冒泡事件 `cardclose`)、Esc。

## 卡片 class(main.ts 往 #cardBody 填)
- 升级行:`<div class="row [locked]"><div class="meta"><div class="nm">名</div><div class="joke">梗</div><div class="now">现在:…</div></div><div class="lv">Lv.3</div><button class="buy can|no">价格</button></div>`;锁定行 nm 写 ???
- 访客对话:`<div class="who">名</div><div class="say"><p>台词</p>…</div><div class="acts"><button class="decline">改天吧</button><button class="accept">成交 (价格)</button></div>`
- 买得起的 `.buy.can` 有呼吸高亮。卡片最高 36vh;横屏矮屏变右侧面板;≥900px 居中 480px。

## Orchard 接口(与 spec 的差异)
- `PlaceId` 来自 core/copy.ts;PLACES 用 `ups`(不是 upgrades);标题用 PLACES[id].name,升级文案 UPGRADE_COPY,访客文案 VISITORS[id]{name,lines,accept,decline,after,idle},夏娃用 BITE_SCENES / SEALED(由 main 取)。
- `PlaceView.owned` 是数字(该地点两升级总等级),可选 `lv:[a,b]` 用来选画法。
- `pointer(px,py)` 命中地点/访客/金苹果时自己调用 onPlace / onVisitor / onGolden,同时返回 'place'|'visitor'|'golden'|'event'|'tree'|'none';main 只需对 'tree'/'none' 调 poke。
- `eventActive()` 是方法,不是 getter。`floatText(text,x?,y?)`。`say(visitorId,text)` 访客头顶气泡 3.4 秒。
- 访客的 `…` 气泡、闲聊(VISITORS[id].idle,14–24s 一次)由 UI 自己做;"改天吧后 90 秒再来"由 main 把 state 改回 waiting。
- 新增 `crownPos()`、`EMPTY_WORLD`;访客 id 另含 'eve'。
- 地点产出:有升级的地点每 ~2–4s 飞一个苹果沿虚线弧到树下篮子(最多 5 个同时);可买的地点头顶红点;树用木牌作入口。

## 预览
preview.html?stage=3&unlock=5&t=60&visitors=gravity,cook&golden=1 ;`place=hut&card=1`、`visitor=cook&state=waiting&card=1`、`xmas=1`、`sleep=1`、`event=bird`、`ui=0`。
