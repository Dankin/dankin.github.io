import Phaser from 'phaser';
import { NPCS } from '../core/data';
import { VIEW_W, VIEW_H } from '../core/iso';
import { registerCharTextures } from '../art/chars';
import { registerHatTextures } from '../art/hat';
import { registerFxTextures } from '../art/fxart';
import { buildUiSkin, registerUiScreens } from '../art/ui';
import { buildEnvironment } from '../art';
import { t, hasKey } from '../core/data';

/** 地面切块（世界/屏幕像素；x,y 为左上角，w,h 为显示尺寸）。与 art-world 的 buildGroundChunks 契约一致。 */
export interface GroundChunk { key: string; x: number; y: number; w: number; h: number }

/**
 * 注册所有程序生成的纹理（环境走 art-world 的 buildEnvironment，分帧不卡主线程；角色/帽子/UI/特效走 art-char）。
 * registry：groundChunks {ground, ground_snow}；windows_<side>_<v> = 窗口发光点 [{x,y,lit}]。
 */
export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  async create() {
    document.getElementById('boot')?.remove();
    const cx = VIEW_W / 2, cy = VIEW_H / 2;
    const title = this.add.text(cx, cy - 18, hasKey('ui.loading') ? t('ui.loading') : '圣诞帽帽 加载中…', { fontFamily: 'sans-serif', fontSize: '24px', color: '#ffe9b8' }).setOrigin(0.5);
    const barBg = this.add.rectangle(cx, cy + 22, 360, 8, 0x3a2f4a).setOrigin(0.5);
    const bar = this.add.rectangle(cx - 180, cy + 22, 1, 8, 0xffd27a).setOrigin(0, 0.5);
    const add = (k: string, c: HTMLCanvasElement) => { if (!this.textures.exists(k)) this.textures.addCanvas(k, c); };

    const env = await buildEnvironment(add, (p) => { bar.width = Math.max(1, 360 * Math.min(1, p)); }, { snow: true });
    this.registry.set('groundChunks', env.chunks);
    for (const [k, w] of Object.entries(env.windows)) this.registry.set('windows_' + k, w);

    registerCharTextures(this.textures, NPCS as any);
    registerHatTextures(this.textures);
    registerFxTextures(this.textures);
    buildUiSkin(this.textures);
    registerUiScreens(this.textures);
    title.destroy(); bar.destroy(); barBg.destroy();
    this.scene.start('game');
  }
}
