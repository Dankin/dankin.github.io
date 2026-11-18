/**
 * 手绘美术缩放契约（TEAM.md 3.1）。
 * - PX：旧像素版“原像素”在屏幕上的显示倍率（原先写死的 setScale(2)）。
 * - SS：手绘超采样倍率。所有纹理按「旧源尺寸 × SS」绘制，位图是旧的 SS 倍大。
 * - ART_SCALE = PX / SS：原来的 `.setScale(2)` 一律改成 `.setScale(ART_SCALE)`。
 *   纹理键、布局、origin、命中盒都不变，只是画面更精细。
 * - 通用换算：旧代码 `.setScale(k)`  →  新代码 `.setScale(k / SS)`（k=2 即 ART_SCALE）。
 *   例：p_shadow 旧 setScale(0.9,0.7) → setScale(0.9*NATIVE_SCALE, 0.7*NATIVE_SCALE)；
 *       p_glow 旧 setScale(0.42) → setScale(0.42*NATIVE_SCALE)；p_sparkle/p_heart 不写 setScale 的 → setScale(NATIVE_SCALE)。
 */
export const PX = 2;
export const SS = 3;
export const ART_SCALE = PX / SS;
/** 旧的“原生 1x 显示”（setScale(1)）对应的新倍率：1 / SS。 */
export const NATIVE_SCALE = 1 / SS;
