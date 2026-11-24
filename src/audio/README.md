# src/audio — 全合成音频

无任何音频文件;BGM 与 37 个音效都由 WebAudio 振荡器/噪声实时合成。源码合计 < 100KB(`tests/audio.test.ts` 会检查)。

## 文件
| 文件 | 职责 |
|---|---|
| `bgm.ts` | 入口 `createAudio()`:门面、开关、ducking、iOS/可见性、持久化 |
| `music.ts` | 6 个时代的 BGM 调度器(原创旋律,8 小节×8 步,奇数遍加和声 → 16 小节周期) |
| `sfx.ts` | 37 个音效的配方 `runSfx()` + 别名 + 每个音效的总线和最小间隔 |
| `voicer.ts` | `tone()` / `noise()` 发声原语,同时发声数上限(sfx 24 / music 40),`onended` 后断开节点 |
| `mixer.ts` | 总线图:`musicIn→低通→duck→bgm→master→压缩器`;sfx/ui/voice 直接进 master |
| `settings.ts` | 三开关 + 五层音量,`localStorage['sta.audio']` |
| `ios.ts` | iOS 判断、`audioSession='playback'`、静音 `<audio>` 兜底、提示文案 |

## 用法
```ts
import { createAudio } from './audio/bgm.ts';
const audio = createAudio();      // 默认全部关闭;自动在 document 上挂多事件解锁
audio.setMusic(true);             // 仅记录意愿,第一次手势后才发声
audio.sfx.play('buy');            // 或 audio.sfx.buy()
audio.sfx.play('combo', { level: 3 });
audio.sfx.play('appleDrop', { variant: 2, pitch: 1.1, vol: 0.8 });
```

## API
- 解锁/状态:`unlock() isRunning() hint() onHint(cb) silentSwitchHint()`
- 开关:`setMusic setSfx setVoice setSwitch(k,on) isMusicOn isSfxOn isVoiceOn isEnabled(k?)`。`isEnabled()` 默认指音乐;`'any'` 查三者之一。
- 音量:`setVolume(v)`(旧用法 = master)、`setVolume(layer, v)`(`master|bgm|sfx|ui|voice`,`'music'` 是 `bgm` 别名)、`getVolume(layer?)`。UI 滑条用 0..1,内部走 v² 曲线。
- BGM:`setIntensity(0..5) setEra(0..5) setWorld({daylight, season, weather})`
- ducking:`duck('narration'|'golden'|'ending', on)`。`narrOpen/narrClose` 自动控制旁白;`golden/goldenCatch` 自动 1.6s;`fanfare` 自动 3s。BGM 降到 40%(起音 0.15s,释放 0.6s)。
- 无障碍:`setReducedMotion(on)`(默认跟随 `prefers-reduced-motion`):关闭 `narrBlip` 与 `combo` 升调。
- 其它:`settings()` 当前设置快照,`debug()` 调试状态,`sfx.names` 全部音效名。

### 音效名(`SfxName`)
shake leafRustle appleSpawn appleDrop(4 变体) bonk appleFly appleArrive bite coin buy buyFail upgrade stage unlock cardHover tabSwitch golden goldenCatch combo(level 0..8 半音) rareApple spoil egg eggAch newsTick newsBreaking narrBlip narrOpen narrClose toggleOn toggleOff modal sleep fanfare giftOpen bugSquash orderDone firework。
别名:buyCard→buy tierUp→upgrade goldenApple→golden easterEgg→egg newsBreak→newsBreaking typewriter→narrBlip gift→giftOpen fireworks→firework bug→bugSquash order→orderDone。

总线归属:`narr*` → voice(受"旁白打字音"开关);`cardHover tabSwitch toggle* modal buyFail` 等界面音 → ui;其余 → sfx(两者都受"音效"开关)。

## BGM 设计
| 时代 | 调式 | 音色包 |
|---|---|---|
| 0 树/篮子 | G 五声 | 马林巴 + 拨弦 + 沙锤 |
| 1 小果园 | D 大调 | 马林巴 + 弦乐 pad + 刷子鼓 |
| 2 果山/卡车 | E 多利亚 | 木笛 + 吉他扫弦 + 边击 |
| 3 果城/货船 | C 大调 | 手风琴 + oom-pah + 进行曲军鼓 |
| 4 果星/飞机 | F 利底亚 | 玻璃音 + 合成琶音 + 轻四拍 |
| 5 苹果之门 | G 大调 | 铜管 + 全合奏 |

- 强度 0..5 逐层叠加:主旋律 → 琶音 → pad → 低音 → 鼓/镲 → 军鼓 + 高八度。
- 夜晚(`daylight<0.3` 进入,`>0.42` 退出,带迟滞):速度 ×0.75(112→84)、低通 1.2kHz,只留八音盒旋律 + pad + 低音。
- 天气/季节只做轻微变化:速度、亮度、回声量,以及雨滴/雪闪/春鸟/夏沙锤/冬雪橇铃点缀。
- 换时代:等下一小节线,2 秒交叉淡入淡出,不重启。
- 调度:30ms 定时器 + 200ms 前瞻,始终按步位连续排程,所以循环没有接缝。

## iOS
- `unlock()` 设置 `navigator.audioSession.type='playback'`(Safari 16.4+,此时静音键不再静音 WebAudio);不支持时在 iOS 上循环播放一个静音 `<audio>` 兜底。
- 仍可能被静音键影响时,`silentSwitchHint()` 返回提示文案,否则返回 `null`。
- context 进入 `interrupted`/被系统挂起(来电、Siri):`hint()` 返回「点一下恢复声音」,暂停 BGM 定时器;下一次手势恢复后自动重启 BGM。
- `visibilitychange`:隐藏时清 BGM 定时器并 `suspend()`,回前台 `resume()`,保留播放位置。
- 解锁事件:`pointerdown pointerup touchstart touchend click keydown`(capture),已运行则忽略。

## 测试
`tests/audio.test.ts` 用假 `AudioContext` 校验:调度窗口与循环、时代切换、昼夜、ducking、音量曲线、持久化、iOS 恢复、后台暂停、多事件解锁、voice 上限、所有音效可发声且参数有限。
