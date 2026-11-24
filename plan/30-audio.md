# 30 音频规划

现状:`src/audio/bgm.ts`(294 行)和 `sfx.ts`(232 行)全是 WebAudio 合成,零音频文件。BGM 是 1 段 8 小节 Eb 小调循环,加 `setIntensity(0..5)` 分层;SFX 9 个;音乐与音效共用一个开关,`setVolume` 没接 UI。

## 1 总体方向
- 保留全合成、零文件路线(用户说"配音可以")。
- 版权:`bgm.ts` 文件头写"致敬《Bad Apple!!》",旋律调性刻意贴近。公开站点有风险,建议重写为完全原创,删除致敬与"东方二创"标注。曲风:轻快民谣加拨弦、木琴、手风琴、小军鼓。只引用公有领域曲(《Jingle Bells》《O Tannenbaum》),且仅用于 12/24 礼物页。
- 自适应用合成参数,不用 stems:每条 60 秒 64kbps 约 480KB,5 层 2.4MB,而现有整包才 108KB。
- 时代:沿用 intensity 分层,再按阶段换音色包。早期(树/果园)拨弦加木琴,G 大调五声;中期(果山/果城)加弦乐 pad 和小军鼓;运输期加锯齿手风琴和进行曲节奏;通关全合奏加 `fanfare`。每包一套 8 小节和弦,在小节线上交叉淡入 2 秒。
- 昼夜:夜里 BPM 112 降到 84,低通 1.2kHz,只留八音盒、pad、低音。

## 2 音效(32 项)与混音
- 摇树与苹果:shake、leafRustle、appleSpawn、appleDrop、bonk、appleFly(上扫噪声加短滑音,与保留的"苹果飞"特效同帧)、appleArrive、bite、coin。
- 购买与成长:buy、buyFail、upgrade、stage、unlock、cardHover、tabSwitch。
- 特殊:golden、goldenCatch、combo(音高随连击升半音,封顶 8 级)、rareApple、spoil。
- 彩蛋、新闻、旁白:egg、eggAch、newsTick、newsBreaking、narrBlip(打字机,每字一声,音高在 3 个值中随机)、narrOpen、narrClose。
- 系统:toggleOn、toggleOff、modal、sleep、fanfare、giftOpen。
- 方案:全部用现有 `createVoicer` 的 tone/noise 合成,每个 ≤30 行,不用采样。
- 层级(峰值 dBFS):music -20,world SFX -14,UI SFX -12,旁白与语音 -10,master 后接现有压缩器作限幅。
- ducking:旁白、金苹果、通关时,music 总线用 `setTargetAtTime` 压到 40%,起音 0.15s,释放 0.6s。纯参数自动化,无分析器。

## 3 旁白/配音方案
- A 纯文字加打字机音:体积 0,成本 0,风险最低,缺人声温度。
- B `speechSynthesis`:体积 0。iOS Safari 的中文音色依赖系统是否下载,常见无声或语速异常,各机型不一致;声音不经 WebAudio,无法 ducking。不推荐。
- C 真人预录:音质最好,版权自己持有。Opus 单声道 24kbps,10 秒约 30KB(base64 约 40KB)。20 句约 800KB,整包会膨胀到约 8 倍。
- D AI TTS 预生成:成本低。每句 16kbps 约 4–6KB。中文 AI 声线易有违和感,须核对所用服务的再分发条款。
- 推荐:A 为主体,加两句真人语音(C),由用户自己录。开场一句(≤5 秒,约 15KB)和圣诞祝福(≤20 秒,约 60KB)。圣诞语音与加密 `#g=` 载荷一起放,不能明文进仓库。

## 4 技术要点
- iOS 解锁:现有 `armAudioUnlock` 正确。补充监听 `statechange`,遇到 `interrupted`(来电、Siri)时提示"点一下恢复声音"。
- 静音拨片会让 WebAudio 无声。设置 `navigator.audioSession.type='playback'`(Safari 16.4+);旧版加循环静音 `<audio>`。仍无声时在按钮旁提示"检查静音键"。
- 后台:现有逻辑 hidden 时 `suspend`,但 BGM 的 `setInterval` 仍在跑。改为 hidden 时清定时器,回前台重建。
- 体积:音频代码 +15KB,语音 ≤100KB,整包 ≤260KB。
- 减少声音:拆成音乐、音效、旁白音三个开关加总音量滑条,默认全关。`prefers-reduced-motion` 下关闭 narrBlip 与 combo 升调。

## 5 测试清单
- iOS Safari 与 PWA,静音键开/关,首次点击出声,来电后恢复。
- 切后台 30 秒回来,音乐不叠不断。
- 摇树 20 次/秒连点,无爆音,节点全部释放。
- ducking 降到 40% 并复原。
- 三个开关独立生效,存档导入后还原。
- 开启减少动态偏好时无自动发声。
- 圣诞语音在 12/24 前无法解出。

## 6 需要你拍板
- 真人语音只录两句(开场、圣诞)?推荐是,其余文字。
- BGM 重写为原创并去掉 Bad Apple 致敬?推荐是。
- 默认声音关?推荐保持,首次点击轻提示"开声音更好玩"。
- 音频体积上限 100KB?推荐接受。

## 7 工作量
- 原创 BGM 加 4 套音色包:3 人日
- 音效 32 项:2
- 总线、ducking、三开关与音量 UI:1
- iOS 兼容:1
- 旁白打字机与语音加载:1
- 测试:1
- 合计约 9 人日。
