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
(window as unknown as { __game: Phaser.Game }).__game = game;

// 禁止页面缩放/回弹（iOS Safari 的手势事件）
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if ((e as TouchEvent).touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());

// 测试接口：仅 ?debug=1 时加载
if (new URLSearchParams(location.search).get('debug') === '1') {
  import('./debug/testApi').then((m) => m.installTestApi(game)).catch((e) => console.warn('[debug] testApi 加载失败', e));
}
