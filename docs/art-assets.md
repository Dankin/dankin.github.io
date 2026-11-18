# 角色 / 帽子 / UI / 特效 美术资产说明（art-char）

画风：类《王国保卫战》卡通手绘。暖色、抖动暖棕描边（`#4a2e24`）、色块叠水彩阴影（右下偏冷紫）、左上暖光高光小块、纸纹颗粒。全部**程序化绘制**，无外部图片。
预览页（dev server 运行时）：`/src/art/char/preview.html?set=chars|hats|fx|ui|screens&zoom=2&ids=xiaomi,abao&only=idle_0,walk_0`

## 1. 尺寸与缩放契约

- 位图 = 旧源尺寸 × `SS`（`src/art/scale.ts`，SS=3）。**显示时统一 `setScale(ART_SCALE)`**（`PX/SS = 2/3`），不要再写死 `setScale(2)`。
- 角色画布（**位图像素**，=旧源 16×24 ×SS3）：成人/老人/轮椅/圣诞老人 **48×72**，小孩 **48×63**。显示（×ART_SCALE=2/3）≈ 32×48 / 32×42 屏幕 px，与旧版同尺寸。origin 一律 `(0.5, 1)`，脚底在画布底边上方约 2 单位（`ground`），与旧 `c_<id>_0` 的 origin(0.5,1) 兼容。
- 轮椅少年的画布同 48×72，轮椅/毯子在画布内，剪影宽于其他角色。
- UI 纹理是 **2× 设计图**（UI_SS=2，设计单位=屏幕像素），显示 `setScale(UI_SCALE)`=0.5；9-slice 用 `uiNine()`。

## 2. 角色

入口：`src/art/chars.ts`
```ts
import { registerCharTextures } from '../art/chars';
registerCharTextures(this.textures, NPCS);   // Boot：替换 buildChar 那一段
```
`registerCharTextures` 会为 npcs.json 的每个 id 生成帧；id 不在 SPECS 里（如旧 NPC `aunt/courier/abao/niuniu` 以外的新 id）按 `look.style` 回退到最近的造型。别名：`postman→afu, baker→laozhou, painter→xiaolan, wheelchair→adong, delivery→courier`。

### 帧键（每个 NPC 都有，前缀 `c_<id>_`）
| 键后缀 | 用途 |
|---|---|
| `0` | = `idle_0`（兼容旧键） |
| `1` | = `walk_0`（兼容旧键，旧代码两帧交替用 0/1 仍能工作） |
| `idle_0`, `idle_1` | 待机呼吸（1.2s 交替，胸口/头轻微起伏，idle_1 眨眼） |
| `walk_0..3` | 4 帧走路（接触→过渡→接触→过渡；摆臂、身体上下 bob 已画进帧，**dev-story 不需要再 bob**；轮椅少年是车轮转 + 上身前倾） |
| `emo_happy` | 开心（弯眼笑、腮红、手举到胸前） |
| `emo_scared` | 害怕（瞪眼、汗滴、缩肩、手抱胸） |
| `emo_surprised` | 惊讶（大眼、o 嘴、扬眉、双手微抬） |
| `emo_listen` | 听歌（闭眼微笑、头微偏、手抚心口/耳旁） |
| `emo_sing_0/1` | 唱歌（张嘴交替，手扶胸口） |
| `emo_dance_0/1` | 跳舞（跳起/落下，双臂挥舞） |
| `emo_annoyed` | 不耐烦（半眼、皱眉、叉腰） |
| `emo_wave_0/1` | 挥手（交替抬手） |

朝向：所有帧默认**面朝右 3/4 微正面**；向左用 `flipX`。

### 角色设计表
| id | 名字 | 年龄/体型 | 配色 | 服饰与特征 | 剪影要点 |
|---|---|---|---|---|---|
| `xiaomi` | 小米 | 少女，中等 | 发 `#3b2a20`，米白上衣 `#ece4d4`，蓝裤 `#4a5a78`，红围巾 `#c0392b` | 双马尾 + 厚红围巾 + 小背包 | 两条马尾外翻、围巾尾巴飘 |
| `abao` | 阿宝 | 小孩，矮 | 黑短发，黄毛衣 `#e0a030`，蓝裤，白鞋 | 大头短发、毛衣、红手套 | 大头小身，圆 |
| `niuniu` | 妞妞 | 小孩，矮 | 发 `#6b3b22` 双丸子，粉衣 `#d9708f`，紫裤 | 双丸子头 + 发圈 | 头顶两个球 |
| `aunt` | 桂芳阿姨 | 中年，微胖 | 卷烫黑发，紫外套 `#8a4fa0`，白球鞋 | 卷发 + 紫外套 + 广场舞袖口 | 蓬松卷发顶 |
| `courier` | 外卖小哥 | 青年，瘦高 | 黑盔，青绿外套 `#2a9d8f`，黄装饰 | 头盔 + 背后黄色保温箱 | 背后方块 |
| `afu` | 阿福（邮递员） | 中年 | 墨绿制服，黄绳，棕邮包 | 制服帽、斜挎邮包、信件 | 帽檐 + 斜背包 |
| `laozhou` | 老周（面包师） | 60+，圆胖 | 白围裙 / 白高帽，花白胡，圆眼镜 | 厨师帽 + 围裙 + 面粉点 + 微驼 | 肚子大、白高帽 |
| `xiaolan` | 小蓝（画家） | 20 多岁 | 蓝贝雷帽，蓝灰罩衫沾颜料 | 贝雷帽、颜料点、画笔/调色板 | 帽子歪 + 手持画笔 |
| `adong` | 阿冬（轮椅少年） | ~15 岁 | 红黑格毯，深色外套，橙围巾 | 轮椅（辐条车轮随帧转动）、推手、毯子、**抬头不卑不亢的表情**（不画怜悯相） | 轮椅圆轮 + 推手横杆 |
| `santa` | 圣诞老人（终章） | 福相，圆胖 | 红衣白边、白须、金带扣 | 站立；带 walk/wave/laugh（用 `emo_happy` 作大笑） | 大红帽 + 白胡子 + 大肚 |

#### 第二批人物（docs/08，`src/art/char/specs2.ts`，✅ 已出图，帧键同上）
| id | 名字 | 造型 | 剪影要点 |
|---|---|---|---|
| `doudou` | 豆豆（5 岁） | 小孩体型（头更大），蓝雨衣黄纽扣+反光条、**黄色高筒雨靴**、黑碗盖头、兜帽堆在后颈 | 大头 + 两只黄靴 |
| `kevin` | Kevin（咖啡车） | 深蓝**鸭舌帽**（帽檐朝前，咖啡豆帽徽）、白衬衫卷袖、**咖啡色围裙**+名牌、胡茬、牛仔裤、白球鞋 | 帽檐 + 棕围裙 |
| `q1` | 排队女生·美妆博主 | 粉卫衣（爱心图案）、**波浪蜜棕长发 + 粉蝴蝶结**、白裙裤、**手持手机** | 披肩长发 + 手机 |
| `q2` | 排队男生·上班族 | 灰蓝西装、红领带、工牌、黑眼圈、**青绿大耳机** | 耳机头梁 |
| `uncle_wu` | 吴大爷 | 花白两鬓+秃顶、白粗眉、灰胡渣、**酱红棉马甲**、**弯柄拐杖**、略矮 | 光头 + 拐杖 |
| `post_aunt` | 邮局阿姨 | 黑短发、**红框方眼镜**、浅绿邮政马甲 + 蓝套袖、手拿邮戳 | 红眼镜 + 蓝套袖 |
| `granny_qin` | 秦阿婆 | 白发**顶髻 + 红发簪**、碎花袄、**紫披肩带流苏**、粉腮 | 头顶髻 + 披肩 |

#### 额外帧（只有指定角色有，键同样是 `c_<id>_<key>`）
| 角色 | 键 | 说明 |
|---|---|---|
| `laozhou` | `emo_bake_0/1` | 揉面（案板挡住下半身，面粉飞起；两帧交替 ~300ms） |
| `laozhou` | `emo_sit` | 坐小板凳，垂头丧气（关店后） |
| `afu` | `emo_gulp` | 深呼吸/咽口水（闭眼、胸口鼓起、汗滴）；害怕用通用 `emo_scared` |
| `afu`,`adong` | `emo_letter` | 手举一封信（递信/拿信） |
| `adong` | `emo_push_0/1` | 自己转轮子前进（手搭轮圈，咬牙） |
| `adong` | `emo_cheer` | 双臂高举欢呼（车头微翘） |
新帧在 `src/art/char/poses.ts` 的 `EXTRA_KEYS` 登记，要给别的角色加帧直接加一行。

#### 动物（`src/art/char/animals.ts`，侧面，**origin(0.5,1)**，画布按旧源尺寸×SS）
| id | 画布(bitmap) | 键后缀 |
|---|---|---|
| `dog` 大黄狗 | 92×54 | `0 1 idle_0/1 walk_0..3 lie_0/1 sleep_0/1 bark_0/1 sit scared happy`（`lie`=趴着半睁眼，`sleep`=睡，红项圈） |
| `cat_m` 麻薯（三花） | 52×40 | `0 1 idle_0/1 walk_0..3 carry_0..3 sleep_0/1 stretch happy scared`（`carry_*`=叼着信小跑，信已画在嘴里；`sleep`=蜷成团） |
朝向面朝右，向左用 `flipX`。`ALL_CHAR_IDS`（chars.ts 导出）列出所有有专属造型的 id；`registerCharTextures(textures, NPCS)` 会**自动补注册 npcs.json 里没写的专属 id**（所以 dog/cat_m/q1/q2… 不需要在 npcs.json 里造数据也有纹理）。

新增 NPC：在 `src/art/char/specs.ts` 里加一个 Spec（或让 `look.style` 命中 BY_STYLE）即可，不改引擎代码。

### dev-story 接入示例（Npc.ts）
```ts
import { ART_SCALE } from '../art/scale';
spr = scene.add.image(x, y, `c_${id}_idle_0`).setOrigin(0.5, 1).setScale(ART_SCALE);
// render(): 按状态选帧
//  idle: ['idle_0','idle_1']  walk: ['walk_0','walk_1','walk_2','walk_3']（每帧 ~110ms）
//  listen→emo_listen  startle→emo_surprised  scared/hide→emo_scared  dance→emo_dance_0/1
//  sing→emo_sing_0/1  warm→emo_happy  linger→emo_annoyed  scripted 挥手→emo_wave_0/1
spr.setTexture(`c_${id}_${key}`);
```
头顶锚点（气泡位置）：成人显示高 48px、小孩 42px（与旧版一致，锚点沿用旧的 54/44 偏移即可）。地图缩放 0.7 时约 34px 高，仍可靠帽子/围巾/配色区分各角色（见 /tmp/shots/art-char/s07.png）。**建议**：NPC 显示放大 1.3×（`setScale(ART_SCALE*1.3)`，约 62px 高），卡通细节（表情/道具）更清晰，锚点偏移同步 ×1.3；是否采用由 lead/dev-story 决定。

## 3. 帽子

入口 `src/art/hat.ts`：`registerHatTextures(this.textures)`。
| 键 | 含义 |
|---|---|
| `hat_0 … hat_5` | 6 阶段：0 褪色灰红旧帽 + 补丁 + 半个绒球；1 鲜红 + 白边；2 绒球歪长（小鸡般）；3 金线条纹；4 绒球饱满 + 光点；5 铃铛 + 亮面 |
| `hat_6` | = hat_5（占位：终章用 `c_santa_*` 角色帧，帽子这边不再变化） |
| `hat_<n>_blink/_happy/_worry` | 眨眼 / 开心 / 担心 脸（hat_0..6 都有） |
| `aura_ring` | 附身光圈（椭圆，72×36 源单位×2；放在被附身物体底部，scale 随物体） |
| `aura_glow` | 附身光晕（64×64×2，加色混合 ADD 更好） |
| `trail_dot/star/swirl` | 飞行拖尾粒子（16×16×2） |

画布约 81×56 位图（源 38×26 单位 × 60/28 放大），**origin 建议 (0.5, 0.83)**，显示 `setScale(ART_SCALE)`。
Hat.ts 示例：`scene.add.image(x,y,'hat_'+stage).setOrigin(0.5,0.83).setScale(ART_SCALE)`；表情切换 `setTexture('hat_'+stage+'_happy')`。

## 4. 特效贴图（`src/art/fxart.ts`）
入口 `registerFxTextures(this.textures)`，位图均为 SS=3，显示用 `setScale(ART_SCALE)` 或粒子 `scale`。
`fx_note_0/1/2`（音符三款）· `fx_heart` `fx_heart_small` · `fx_spark`（四角星）`fx_spark_soft`（圆形柔光）`fx_star` · `fx_snow_0/1/2`（大中小雪花）· `fx_smoke_0/1/2`（烟团）· `fx_bell_wave_0/1/2`（铃声波纹，由小到大）· `fx_foot_l/r`（脚印）· `fx_light_glow`（灯串辉光）`fx_light_bulb_r/g/y/b`（红绿黄蓝灯泡）· `fx_puff`（灰尘）`fx_drop`（汗滴）`fx_zzz` `fx_exclaim`(!) `fx_question`(?) `fx_dots`(…) `fx_music_bubble`。
Phaser 粒子用法：`scene.add.particles(x,y,'fx_note_0',{ lifespan:1200, speedY:{min:-60,max:-30}, scale:{start:ART_SCALE,end:ART_SCALE*0.6}, alpha:{start:1,end:0}, blendMode:'NORMAL' })`。

## 5. UI 皮肤（`src/art/ui.ts`）
```ts
import { buildUiSkin, registerUiScreens, uiNine, uiNineSize, UI_SCALE } from '../art/ui';
buildUiSkin(this.textures);                 // Boot 里一次（幂等，小图）
registerUiScreens(this.textures);           // 标题/结尾整屏大图，在 Title/End 场景 create 里调用即可（懒加载，约 0.3~0.6s）
```
### 9-slice 件（用 `uiNine(scene, key, cx, cy, wPx, hPx)`，宽高以屏幕像素计，默认 origin 0.5）
| 键 | 用途 | 备注 |
|---|---|---|
| `ui_panel_paper` | 清单面板 | 纸张 + 虚线手写内框；配 `ui_staple`（顶部订书钉）`ui_tape`（胶带）`ui_curl`（右下卷边，origin(1,1)） |
| `ui_panel_note` | 小便签/提示 | 偏黄 |
| `ui_toast` | toast 提示条 | 圆角米色 |
| `ui_btn_on / ui_btn_cd / ui_btn_hi / ui_btn_down` | 招式按钮：可点 / 冷却（灰 + 虚线）/ 高亮（金边 + 闪点）/ 按下 | 148×44 以内最佳 |
| `ui_bubble_normal / shout / thought` | 气泡主体：普通 / 大喊（刺边粗红描边）/ 心声（淡紫虚线） | |
| `ui_bubble_tail_normal / shout / thought` | 气泡尾巴 30×28 设计单位（thought 是三个小泡泡） | 放在气泡底边，origin (0.3,0) |
| `ui_bar_frame` | 暖意条外框（深色槽） | 内部用 `ui_bar_fill`（256×14，渐变，用 crop 裁剪宽度） |
| `ui_map_frame` | 小地图木框（中间镂空） | |

### 非 9-slice 件（`setScale(UI_SCALE)`）
`ui_bar_fill` `ui_bar_icon`（暖意小火苗）`ui_arrow`（提示箭头，上下摆动）`ui_pulse_ring`（点击高亮脉冲圈）`ui_check_box` `ui_check_tick`（手画红勾）`ui_strike`（手画删除线，可水平拉伸）。
图标 44×44：`ui_ic_bell`（chime_ring）`ui_ic_balloon`（balloon_release）`ui_ic_pop`（balloon_pop）`ui_ic_speaker_soft`（speaker_prelude）`ui_ic_speaker_loud`（speaker_blast）`ui_ic_lamp`（lamp_glow）`ui_ic_snowman`（snowman_pose）`ui_ic_tree`（tree_twinkle）`ui_ic_mail`（mailbox_drop）`ui_ic_cat`（cat_meow）+ `ui_ic_hat` `ui_ic_heart` `ui_ic_close` `ui_ic_lock`。

### 整屏 / 大图
`ui_title_bg`（960×540 清晨雪村：房子、大树、角色小剧场）· `ui_title_logo`（560×170《圣诞帽帽》手写体 + 雪帽 + 下划线）· `ui_end_bg`（夜空月亮、全员 + 圣诞老人）· `ui_end_line`（"May all the beauty in the world be blessed."，640×64）。均 `setScale(UI_SCALE)`，bg 放 (480,270)。

### 使用示例
```ts
// 气泡：文字区 w×h（屏幕 px）
const body = uiNine(scene, 'ui_bubble_normal', 0, 0, w + 28, h + 22);
const tail = scene.add.image(0, (h + 22) / 2 - 2, 'ui_bubble_tail_normal').setScale(UI_SCALE).setOrigin(0.3, 0);
// 按钮三态：切换 key，不要换尺寸
btn.setTexture(ready ? 'ui_btn_on' : 'ui_btn_cd');  // 9-slice 的 setTexture 保留尺寸/切边
// 暖意条
const frame = uiNine(scene, 'ui_bar_frame', x, y, 240, 28);
const fill = scene.add.image(x - 112, y, 'ui_bar_fill').setOrigin(0, 0.5).setScale(224 / 512, UI_SCALE); // 位图 512×28，显示 224×14
fill.setCrop(0, 0, 512 * warmth, 28);
```
注意：`NineSlice.setTexture(key)` 会保留当前 slice 值，所有按钮态切边相同（16/16/16/18），可直接切换。

## 6. 注册顺序建议（Boot）
```ts
registerCharTextures(this.textures, NPCS);
registerHatTextures(this.textures);
registerFxTextures(this.textures);
buildUiSkin(this.textures);
```
旧 `art/pixel.ts` 仅 `art/world.ts` 还在 import；art-world 去掉依赖后我会删除 pixel.ts。

---

# 环境美术资产（art-world）

代码：`src/art/index.ts`（统一入口）· `src/art/env/{ground,facade,props,backdrop,weather}.ts` · 工具库 `src/art/brush.ts` · `src/art/scale.ts`。预览页：`/src/art/env/preview.html?set=ground|wall|props|backdrop|weather|brush&zoom=2`。

## E1 缩放契约
- 所有环境纹理位图 = 旧源尺寸 × `SS`(3)。显示 `setScale(旧倍数 / SS)`，即 `ART_SCALE`(=2/3)。**原生 1× 的小图**（`p_shadow` `p_glow` `p_ring` `p_sparkle` `p_heart` 旧代码按 1×、直接 `setScale(k)`）改为 `setScale(k * NATIVE_SCALE)`（=k/3）。
- `import { ART_SCALE, NATIVE_SCALE } from '../art/scale'`。

## E2 加载入口（分帧，不卡首屏）
```ts
import { buildEnvironment, buildSnowChunks } from '../art';
const env = await buildEnvironment((k, c) => this.textures.addCanvas(k, c), (p, label) => bar.set(p), { snow: true });
this.registry.set('groundChunks', env.chunks);   // {ground:[{key,x,y,w,h}], ground_snow:[…]}
this.registry.set('wallWindows', env.windows);   // 键 'ne_a' … 'nw_l' → [{x,y,lit}]
```
同步兼容：`buildGroundChunks(snow, add)` / `buildWall(side,v)` / `buildProps()` / `buildBackdrop()`。预计总耗时 1.5~2.5s（分帧）；`{snow:false}` 可延后雪层，之后 `buildSnowChunks(add)`。

## E3 地面（契约 3.2）
- 键 `ground_<cx>_<cy>` / `ground_snow_<cx>_<cy>`（雪层为透明覆盖）；每块 10×10 瓦片，位图 ≈978×498，**≤2048**。显示：`add.image(c.x, c.y, c.key).setOrigin(0).setScale(ART_SCALE)`；深度 ground -50，雪层 -49，用 alpha 淡入。
- 支持任意 `WORLD_W×WORLD_H`（读取 `core/data` 的 MAP）。瓦片字母：`p` 石板 `c` 红砖地 `g` 草地 `r` 柏油 `i` 冰面 `w` 水 `d` 木栈桥/木板；扩展：`m` 粉雪 `l` 落叶石板 `s` 台阶 `f` 花坛 `b` 石桥 `k` 土路。边缘自然过渡（草丛/雪堆/湿岸/路沿），按世界坐标种子变化，无网格重复感。

## E4 建筑立面
- 键 `wall_<ne|nw>_<a..l>`；每段 = **10 瓦片长**（`WALL_TILES`），一个 20×20 区块一边放 2 段（`WALLS` 的 `at`）。`buildWall` 返回 `{canvas, windows[{x,y,lit}], ax, ay, len}`：窗口坐标已是最终位图像素；贴图左上 = `toScreen(tx,ty) − (ax·PX, ay·PX)`（ne 向 +tx 延伸 ax=0；nw 向 +ty 延伸 ax=160）。
| 键 | 立面 | 键 | 立面 |
|---|---|---|---|
| a | 石库门红砖（两门两店） | g | 茶馆（木门面·红灯笼） |
| b | 红砖商街（洋货庄） | h | 西式砖红商店（拱窗·灯串） |
| c | 青砖弄堂（爬山虎·晾衣） | i | 码头仓库（铁皮顶·推拉门） |
| d | 面包房街（暖黄·条纹遮阳） | j | 里弄山墙（灰泥旧墙） |
| e | 邮局（米石墙·绿门·钟） | k | 雪场木屋（原木·厚雪顶） |
| f | 老洋房（孟莎顶·阳台·门廊·阁楼） | l | 花店糖果铺（粉色泥灰） |

## E5 道具 / 装饰（`p_<key>`，origin(0.5,1)，`setScale(ART_SCALE)`）
旧键保持：windchime chime_tubes stall speaker lamp snowman_0/1/2 tree tree_lights mailbox cat bench planetree bicycle crate barrel pine snowpile fence bollard rowboat balloon_0..4 heart sparkle envelope puff shadow glow ring arrow。
新增（源尺寸）：`bus`(76×44) `vending`(20×32) `oven`(28×30) `sled`(30×16) `snowmachine`(30×34) `lamp_tall`(14×64) `crane`(44×80 码头吊机) `ferry`(84×46 渡轮) `kiosk`(26×32) `trashcan`(12×16) `signpost`(18×34) `lifebuoy`(14×14) `lightstring`(40×20 路灯串) `flowerbed`(30×14) `lantern_red`(10×20)。

## E6 背景（位图 480×270×SS，scrollFactor 0；原 `setScale(2)` 改 `setScale(ART_SCALE)`，铺满 960×540）
`backdrop`（黄昏，默认）`backdrop_morning`（清晨）`backdrop_night`（平安夜，星空+亮窗）。可按时段 setTexture 或叠 alpha 渐变。

## E7 天气 / 昼夜 / 光效（`p_` 前缀，用法详见 `src/art/env/weather.ts` 头注释）
`p_rain`(64² 无缝) · `p_snowtile_0/1/2`(128² 无缝，远/中/近) · `p_flake_0..2` · `p_ripple` 水涟漪 · `p_glint` 水面反光（ADD） · `p_winlight` 窗暖光 · `p_pool` 路灯地面光池 · `p_beam` 斜光束 · `p_godray` 体积光 · `p_vignette`(480×270 暗角) · `p_smoke` · `p_star`。
昼夜建议：白天 tint 无；黄昏全屏叠 `#ff9a5c` α0.12 + godray；夜晚 `backdrop_night` + 叠 `#1b2150` α0.35（MULTIPLY/NORMAL）+ `p_winlight`/`p_pool` ADD。

## E8 需求表（product 追加；完成=✅）
| 需求 | 状态 | 对应键 |
|---|---|---|
| 面包房立面 | ✅ | wall_*_d |
| 邮局立面 | ✅ | wall_*_e |
| 老洋房（阁楼/孟莎顶） | ✅ | wall_*_f |
| 码头吊机 | ✅ | p_crane |
| 渡轮 | ✅ | p_ferry |
| 公交车 | ✅ | p_bus |
| 雪橇 | ✅ | p_sled |
| 人造雪场造雪机 | ✅ | p_snowmachine |
| 路灯串 | ✅ | p_lightstring |
| 天气（雨雪）/ 水面反光 / 窗暖光 | ✅ | E7 |
| 更多街景立面变体 | ✅ | wall_*_g..l |
| **瓦片字母 `o` 无障碍斜坡**（浅灰防滑纹，坡道 x43-44,y1-3 用）· **`a` 公交站台**（黄色盲道砖，x40-44,y4-11 用）；无则回退 c/p | ✅ | tile o / a · **实际 o a 已在 ground.ts** |
| 晒鱼架（弄堂，带鱼干，可摆动；30×28） | ✅ | p_fish_rack · **实际 36×30** |
| 弄堂邮筒（绿色，同 mailbox 变体；14×28） | ✅ | p_mailbox_alley · **实际 16×28** |
| 老收音机（天线，16×14） | ✅ | p_radio · **实际 18×16** |
| 猫窝纸箱（22×14，猫窝） | ✅ | p_catbox · **实际 22×14** |
| 骨头桶（隐藏彩蛋，14×16，带骨头） | ✅ | p_bone_bucket · **实际 14×18** |
| 面包房橱窗围裙+面粉袋（暗/亮两态，24×20） | ✅ | p_window_apron / p_window_apron_lit · **实际 36×30（暗 p_window_apron=p_window_apron_0；亮 p_window_apron_lit=_1）** |
| 卷帘门（关/开两态，22×30） | ✅ | p_shutter / p_shutter_open · **实际 26×30（p_shutter=_0 关；p_shutter_open=_1 开）** |
| 手写黑板牌×2（“咸味俄式面包”“圣诞蛋糕”，14×24） | ✅ | p_sign_salty / p_sign_cake · **实际 16×26 ×2** |
| 咖啡车（凯文，西式，34×28） | ✅ | p_coffee_cart · **实际 34×36** |
| 炉灶点火态（暖光 + 火苗，28×30，基于 oven） | ✅ | p_oven_lit · **实际 28×36（底边与 p_oven 对齐，上方多 6px 烟）** |
| 面包推车（冒热气，34×26，终章） | ✅ | p_bread_cart · **实际 32×30** |
| 公交站牌（12×40，带“37”） | ✅ | p_bus_sign · **实际 14×40（P 站台灯箱 p_bus_sign_p 16×44）** |
| 公交无障碍斜板（放下态，30×10，叠在 p_bus 车门侧） | ✅ | p_bus_ramp · **实际 30×10** |
| 坡口路缘雪堆（高/矮两态，30×14） | ✅ | p_berm / p_berm_low · **实际 p_berm 36×14 / p_berm_low 30×8** |
| 终点拱门（普通/挂满气球/炸开三态，40×44） | ✅ | p_finish_arch / p_finish_arch_balloons / p_finish_arch_pop · **实际 60×52 ×3 态** |
| 气球串（20×36，气球摊用，可飞走） | ✅ | p_balloon_bundle · **实际 20×36** |
| 大号自行车（带铃，28×22，小蓝门口） | ✅ | p_bike_xl · **实际 46×30** |
| 立镜（18×30） | ✅ | p_mirror · **实际 20×38** |
| 画框（空/带画《融化的雪人和自行车》，22×28） | ✅ | p_frame_spot / p_frame_painted · **实际 24×32（p_frame_spot=_0 空；p_frame_painted=_1 带画）** |
| 圣诞贺卡包（14×10）· 灯串线轴（14×14） | ✅ | p_card_bundle / p_light_spool · **实际 14×10 / 14×14** |
| 老洋房阁楼窗（关/开两态，窗里小蓝探身用） | ✅ | wall_f 的 attic 窗 or p_attic_window / p_attic_window_open · **实际 p_attic_window / p_attic_window_open 16×22（叠在 wall_f 老虎窗上；也可用 house_f）** |
| 雪人融化（用旧 snowman_0/1/2，需要 snowman_2 更“抽象”） | ✅（沿用） | p_snowman_0/1/2 |
| fx：彩带 / 雪雾 / 音符 / 爱心 / 星光 | ⬜（P1） | p_confetti / p_snow_puff / p_notes（heart sparkle 已有） |
| 圣诞老人（art-char 已有）出场：帽子→老人变身帧（帽子光晕渐隐） | ⬜（P1） | c_santa_* + p_morph_glow |
| NPC 新增（art-char）：dog cat_m kevin doudou q1 q2 uncle_wu post_aunt granny_qin balloon_man tourist1-3 mrs_ellis jogger driver_zhang referee | ⬜（最低：dog cat_m doudou kevin driver_zhang mrs_ellis referee，其余 look.style 回退） | c_<id>_* |
| 姿势：lie sleep sit bake carry wave paint lean photo transfer watch gulp scared push cheer letter | ⬜ | c_<id>_<pose> |

### E9 独立建筑 prop（art-world，✅）
`p_house_f`（老洋房，192×180，6×4 瓦片，x21–27,y20–24）/ `p_warehouse_i`（仓库，192×170）。由立面 wall_f/wall_i 拼成的自由站立小楼：**origin(0.5,1) 放在最靠近镜头的前角顶点 toScreen(tx1,ty1)**（老洋房 = (27,24)），setScale(ART_SCALE)，depth=该点 y。左面（+ty 面）长 6 瓦片、右面长 4 瓦片；它是装饰建筑，碰撞请用 x21–27,y20–24 矩形。阁楼窗（小蓝探身）：house_f 左面有老虎窗，位置可用 p_attic_window(_open) 另叠。
`p_ ` 别名：window_apron/_lit、shutter/_open、frame_spot/frame_painted 指向 _0/_1 同一画布。fx（彩带/雪雾/音符/变身光晕 p_confetti p_snow_puff p_notes p_morph_glow）归 art-char/fxart，不在 env 范围。

