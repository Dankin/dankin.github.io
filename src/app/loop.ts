// 主循环:推进 tick、帧绘制、每 0.25 秒渲染、每 15 秒存档。
import { tick } from '../core/game.ts';
import { app, hooks } from './ctx.ts';
import { catchUp, persist } from './session.ts';
import { sysFrame } from './sys.ts';
import { checkGiftRim } from './chars.ts';
import { stageCardTick } from './stages.ts';

// ───────────── 主循环 ─────────────
let lastTs = performance.now();
let slowAcc = 0;
let saveAcc = 0;
export function loop(ts: number): void {
  requestAnimationFrame(loop);
  const raw = (ts - lastTs) / 1000;
  lastTs = ts;
  if (raw > 5) {
    catchUp(true); // 浏览器把页面挂起了很久
    hooks.render();
    return;
  }
  const dt = Math.max(0, Math.min(raw, 1));
  if (!app.readOnly) {
    // 加速时一帧要推进很多游戏秒:分段推进,每帧最多 ~20 段
    let left = dt * app.speed;
    const chunk = Math.max(0.1, left / 20);
    while (left > 1e-6) {
      const step = Math.min(chunk, left);
      tick(app.state, step, Date.now());
      left -= step;
    }
  }
  if (!app.readOnly) sysFrame(dt * app.speed);
  app.orchard.frame(dt);
  slowAcc += dt;
  saveAcc += dt;
  if (slowAcc >= 0.25) {
    slowAcc = 0;
    hooks.render();
    checkGiftRim();
    stageCardTick();
  }
  if (saveAcc >= 15) {
    saveAcc = 0;
    persist();
  }
}

/** 起 rAF 循环(丢掉第一帧的大 dt) */
export function startLoop(): void {
  requestAnimationFrame((ts) => {
    lastTs = ts;
    requestAnimationFrame(loop);
  });
}
