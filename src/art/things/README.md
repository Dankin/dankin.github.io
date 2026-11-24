# art/things 运输 API

```ts
import { drawTransport, TRANSPORT_ORDER, TRANSPORT_W } from './art/things/index.ts';
drawTransport(ctx, 'truck' /* 名字或档位序号 0..8 */, x, y /* 底部中心 */, s, {
  t,        // 动画秒(轮转/浪/旋翼/步伐)
  move: 0-1,   // 行驶/飞行/行走强度
  load: 0-1,   // 载苹果比例(0 空载)
  unload: 0-1, // 一次性卸货进度,苹果飞出/落下
  pulse: 0-1,  // 一次性"装货弹跳",每装一箱从 0→1
  dir: 1|-1,   // 朝向(默认向右)
  seed, alpha,
});
```

| 档 | kind | 宽(单位) | 建议速度(单位/秒) | 建议容量(苹果/趟) | 动画 |
|---|---|---|---|---|---|
| 0 | basket 篮子 | 18 | 0(手提) | 8 | 苹果颠动 |
| 1 | porter 挑扁担工 | 36 | 22 | 20 | 步伐、扁担弹跳、筐摆 |
| 2 | cart 小推车 | 34 | 30 | 40 | 轮转、车身颠 |
| 3 | trampoline 蹦床 | 50 | 0(原地,苹果弹到远处) | 60 | 床面下陷、苹果逐个抛物线飞出 |
| 4 | truck 卡车 | 70 | 55 | 120 | 轮转、俯仰颠簸、烟 |
| 5 | ship 货船 | 80 | 40 | 300 | 起伏摇摆、浪花、烟囱烟 |
| 6 | helicopter 直升机 | 76 | 80 | 500 | 旋翼模糊、悬停浮动、吊篮摆动、空投 |
| 7 | plane 飞机 | 84 | 130 | 1000 | 螺旋桨、起飞爬升、影子收缩 |
| 8 | portal 传送门 | 44 | 瞬时 | ∞ | 旋涡、pulse 白环闪 |

- 容量/速度仅为建议,数值由 systems 决定。
- 每档静态件走 `bake.ts` 缓存(key 含 seed,按 ctx 分辨率量化);扁担/旋翼/苹果每帧现画,确定性,无随机闪烁。
- 码头 6 档:`drawDock(ctx, tier, x, y, s, {crates, pulse, t})`。
