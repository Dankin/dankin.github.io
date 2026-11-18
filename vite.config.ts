import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
    target: 'es2020',
    rollupOptions: {
      output: {
        // phaser 单独成包：游戏代码改动时浏览器可继续命中 phaser 缓存
        manualChunks(id: string) { if (id.includes('node_modules/phaser')) return 'phaser'; return undefined; },
      },
    },
  },
  server: { host: '127.0.0.1', port: 5173 },
});
