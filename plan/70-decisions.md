# v5 已确认决策(用户 2026-11-24 14:08 答复,最高优先级)

1 体积预算 1MB;放开单文件(index.html 内联 JS/CSS,允许额外资源文件,另留 build:single);总人日可放宽,质量优先。
2 美术:接受 AI 辅助 + 免费素材(只用 CC0/可商用并记录在 src/art/ASSETS.md)。
  - 树:参考 plan/ref/tree.webp(彩色卡通、粗黑手绘描边、云朵状树冠、绿色明暗、树干有纹理、红苹果有高光)。
  - 苹果:参考该图中的苹果(有体积:高光、叶子、深红渐变、描边),不要扁平。
  - 车/运输/建筑:参考 plan/ref/truck.webp(黑白手绘粗描边,线条略抖,内部大量留白;可点缀少量红色苹果)。
  - 整体 = 《王国保卫战》式的"手绘粗描边卡通":树/苹果/地面彩色,运输与建筑偏黑白手绘线稿 + 轻度上色(米白/暖灰底),红色留给苹果。
3 库存:顶栏/左上直接用"苹果图标 + 数量"显示手上可花的苹果(原 coins),不需要严格命名。
4 主角匿名;旁白:底部旁白条 + 6 张时代明信片;圣诞老人为主要角色;其余按 plan/11-narrative.md 推荐。
5 音频:按 plan/30-audio.md 默认推荐(BGM 重写为原创并去掉 Bad Apple 致敬,三开关+音量,文字旁白+打字机音,无配音)。
6 彩蛋:全做(策划 22 + 叙事 20,去重后全部),带图鉴。乔布斯/Apple 只用文字或剪影并带"与苹果公司无关"声明。
7 收礼人时区 +8(Asia/Shanghai)。礼物按 UTC+8 的 2026-12-24 00:00 解锁(不依赖设备时区);线上 ?date= 只在 ?debug=1 下生效。
其余采用各文档推荐项(库存+回收期+钉住、献果折价15%、虫眼简版、订单无惩罚、旧存档迁移保留、Playwright+sharp 可加)。
日程:12/18 功能冻结,12/21 终版,12/22–23 缓冲。用户 12/19 CKAD 考试,最终 review 12/16。

# 协作规则(共享同一工作目录!)
- 分支 v3。只提交你自己拥有的路径:`git add <你的路径> && git commit -m "..." -- <你的路径>`;不要 `git add -A`,不要 stash/reset/checkout 他人文件。
- 目录所有权:
  eng-app: src/main.ts、src/app/**、src/core/{state,game,save,constants,gift}.ts、index.html、vite.config.ts、package.json、tests/core*.ts
  art-nature: src/art/nature/**(苹果、树、果园/果山/果城、背景、地面)
  art-things: src/art/things/**(运输、建筑装置、角色、UI 框、特效)
  src/art/style.ts 由 lead 创建,两位美术只读(需要改请发消息给 lead)
  systems: src/core/sys/**、tests/sys*.test.ts、scripts/sim*.ts(新玩法逻辑:苹果品种/订单/季节/献果/虫眼/图鉴状态,纯函数,接受 state 引用,不直接改 state.ts)
  writer: src/content/**(news/story/eggs/postcards/narration 数据,纯数据+类型)
  audio: src/audio/**
  qa: scripts/visual.mjs、scripts/smoke.mjs、tests/e2e/**(第二波)
- 完成后回复≤200字:做了什么、导出的接口、未完成项。
