import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * 两种构建:
 * - `npm run build`(默认):JS / CSS 仍然内联进 dist/index.html(一个 HTML 就能跑);
 *   图片 / 字体等资源不内联,放 public/(原样拷到 dist/)或 src/assets/(import 后输出到 dist/assets/ 带 hash)。
 * - `npm run build:single`(--mode single):连图片也转成 data: URI,整个游戏就是一个 HTML 文件。
 */
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: [viteSingleFile({ useRecommendedBuildConfig: false })],
    build: {
      target: 'es2020',
      cssCodeSplit: false,
      // 默认:资源一律外链(0 = 不内联);single:无论多大都内联
      assetsInlineLimit: single ? 1 << 30 : 0,
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
    server: { host: '127.0.0.1', port: 5174 },
  };
});
