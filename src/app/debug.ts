// 调试面板(?debug=1 / ?speed=N)。
import { era, tick, type Throughput } from '../core/game.ts';
import { $ } from './dom.ts';
import { app, hooks } from './ctx.ts';

// ───────────── 调试面板 ─────────────
let dbgInfo: HTMLElement | null = null;
let dbgSpeed: HTMLElement | null = null;
export function setupDebug(): void {
  const box = $('debug');
  const mk = (label: string, fn: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'min-height:44px;min-width:48px;margin:2px;padding:0 8px;border:1.5px solid var(--ink);border-radius:10px;background:var(--f0);font:inherit;font-size:12px';
    b.addEventListener('click', fn);
    return b;
  };
  const row = document.createElement('div');
  dbgSpeed = document.createElement('div');
  dbgSpeed.id = 'dbgSpeed';
  dbgSpeed.textContent = `×${app.speed}`;
  for (const v of [1, 10, 60, 600, 3600]) {
    row.append(
      mk(`×${v}`, () => {
        app.speed = v;
        dbgSpeed!.textContent = `×${app.speed}`;
      }),
    );
  }
  const jump = (sec: number) => () => {
    tick(app.state, sec, Date.now());
    hooks.render();
  };
  row.append(mk('+10分', jump(600)), mk('+1小时', jump(3600)));
  row.append(
    mk('+10亿果钱', () => {
      app.state.coins += 1e9;
      hooks.render();
    }),
  );
  dbgInfo = document.createElement('pre');
  dbgInfo.id = 'dbgInfo';
  dbgInfo.style.margin = '4px 0 0';
  box.append(row, dbgSpeed, dbgInfo);
}
export function renderDebugInfo(th: Throughput): void {
  if (!dbgInfo) return;
  dbgInfo.textContent = `flow ${th.flow.toPrecision(3)}/s produce ${th.produce.toPrecision(3)} carry ${th.carry.toPrecision(3)} ${th.bottleneck}\nincome ${th.income.toPrecision(3)}/s era ${era(app.state)} play ${Math.floor(app.state.playSec)}s`;
}
