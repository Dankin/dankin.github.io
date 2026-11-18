import './core/canvasPatch';
import Phaser from 'phaser';
import { validateData } from './core/data';
import { actionIds } from './core/sequencer';
import { validateGameplay } from './core/story';
import { VIEW_W, VIEW_H } from './core/iso';
import { BootScene } from './scenes/Boot';
import { GameScene } from './scenes/Game';

const errs = [...validateData(actionIds()), ...validateGameplay()];
if (errs.length) console.warn('[data] 校验问题:\n' + errs.join('\n'));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: '#1b1626',
  pixelArt: true,
  roundPixels: true,
  input: { touch: { capture: true }, mouse: { preventDefaultWheel: true }, activePointers: 3 },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, GameScene],
});
const QA = import.meta.env.DEV || !!import.meta.env.VITE_QA; // 生产构建默认不含调试入口（VITE_QA=1 vite build 可打开）
if (QA) (window as unknown as { __game: Phaser.Game }).__game = game;

// WebGL 上下文丢失：启动期自动重载一次，之后给“重新加载”提示；恢复后收起提示
const fatal = document.getElementById('fatal'), fatalMsg = document.getElementById('fatalMsg');
const showFatal = (msg: string) => { if (fatal) { if (fatalMsg) fatalMsg.textContent = msg; fatal.style.display = 'flex'; } };
document.getElementById('fatalBtn')?.addEventListener('click', () => location.reload());
const booted = () => game.scene.isActive('game');
let lostTimer: number | undefined;
game.events.once('ready', () => {
  const cv = game.canvas;
  cv.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    window.clearTimeout(lostTimer);
    lostTimer = window.setTimeout(() => {
      if (!booted() && !sessionStorage.getItem('christmas-hat/ctxretry')) { sessionStorage.setItem('christmas-hat/ctxretry', '1'); location.reload(); return; }
      showFatal('画面渲染中断了（可能是设备内存吃紧）。');
    }, 2500);
  });
  cv.addEventListener('webglcontextrestored', () => { window.clearTimeout(lostTimer); if (fatal) fatal.style.display = 'none'; });
});
window.addEventListener('error', () => { window.setTimeout(() => { if (!booted() && !game.scene.isActive('boot')) { document.getElementById('boot')?.remove(); showFatal('游戏没能启动，请重新加载。'); } }, 4000); });
window.addEventListener('load', () => window.setTimeout(() => sessionStorage.removeItem('christmas-hat/ctxretry'), 20000));

// 禁止页面缩放/回弹（iOS Safari 的手势事件）
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if ((e as TouchEvent).touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());

// 测试接口：仅 ?debug=1 时加载
if (QA && new URLSearchParams(location.search).get('debug') === '1') {
  import('./debug/testApi').then((m) => m.installTestApi(game)).catch((e) => console.warn('[debug] testApi 加载失败', e));
}
