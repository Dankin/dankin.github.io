// 会话:存档/读档、离线补算、主题/声音、通关、重开、换档后的重置。
import { redrawHandIcon } from './hud.ts';
import { isWon, settle } from '../core/game.ts';
import { awayLine, SEALED } from '../core/copy.ts';
import { save } from '../core/save.ts';
import { newState } from '../core/state.ts';
import { giftOpen } from '../core/gift.ts';
import { nextEventGap } from '../core/events.ts';
import { showEnding } from '../ui/ending.ts';
import { bus } from '../core/bus.ts';
import { fmt } from '../ui/format.ts';
import { $ } from './dom.ts';
import { app, hooks, kv, nowMs } from './ctx.ts';
import { sysAway } from './sys.ts';
import { panels } from './panels.ts';
import { toast } from './toasts.ts';
import { resetGateSeen } from './dialogs.ts';
import { resetTips } from './events.ts';
import { resetHud } from './hud.ts';
import { resetRender } from './render.ts';

export function persist(): void {
  if (app.readOnly || !app.canSave) return;
  save(kv, app.state, Date.now());
}

/** 把"离开期间"补算上。短离开按 tick,长离开按流体近似(core.settle 决定)。 */
export function catchUp(showToast: boolean): void {
  const away = Date.now() - app.state.lastSeen;
  if (away < 3000) {
    app.state.lastSeen = Date.now();
    sysAway(0);
    return;
  }
  const r = settle(app.state, away);
  app.state.lastSeen = Date.now();
  sysAway(away);
  if (away >= 180_000) panels()?.onAway(away / 60000);
  if (showToast && r.seconds >= 30 && r.delivered > 0) toast(`${awayLine(away / 60000)} 送达了 ${fmt(Math.floor(r.delivered))} 个。`, 4200);
}

// ───────────── 主题 / 声音 ─────────────
export const DARK_MQ = matchMedia('(prefers-color-scheme: dark)');
const THEME_LABEL = { auto: '主题:自动', light: '主题:浅色', dark: '主题:深色' } as const;
export function applyTheme(): void {
  const m = app.state.settings.dark;
  const d = m === 'dark' || (m === 'auto' && DARK_MQ.matches);
  app.orchard.dark = d;
  document.documentElement.classList.toggle('dark', d);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', d ? '#16171b' : '#f4f1ea');
  $('btnTheme').textContent = THEME_LABEL[m];
  redrawHandIcon();
}
export function applySound(): void {
  const on = app.state.settings.sound;
  app.audio.setMusic(on);
  app.audio.setSfx(on);
  $('btnSound').textContent = on ? '声音:开' : '声音:关';
}

// ───────────── 结局 ─────────────
export function win(): void {
  app.won = true;
  bus.emit({ t: 'win' });
  persist();
  app.audio.sfx.fanfare();
  showEnding(
    { elapsedMs: Math.max(0, (app.state.wonAt ?? app.state.playSec) * 1000), clicks: app.state.shakes },
    () => {
      /* 回到果园:游戏继续 */
    },
    () => resetGame(),
  );
  const card = document.querySelector('#ending .card .r');
  if (!card) return;
  const box = document.createElement('div');
  if (!giftOpen(nowMs())) {
    box.id = 'sealed';
    box.className = 'sealed';
    box.style.cssText = 'margin:8px 0;padding:6px 10px;border:1px dashed #666;border-radius:8px;font-size:13px';
    for (const line of SEALED) {
      const p = document.createElement('p');
      p.textContent = line;
      box.append(p);
    }
  } else {
    // 礼物位:12 月 24 日起开放,内容以后放这里。
    box.id = 'giftSlot';
  }
  const gb = document.createElement('button');
  gb.type = 'button';
  gb.className = 'main';
  gb.id = 'btnGift';
  gb.textContent = '礼物盒';
  gb.style.cssText = 'margin:6px 0';
  gb.addEventListener('click', () => panels()?.openGift());
  box.append(gb);
  card.insertBefore(box, card.lastElementChild);
}

export function resetGame(): void {
  app.state = newState(Date.now());
  app.readOnly = false;
  afterStateReplaced();
  persist();
}

/** 换了一份 State(读档/导入/重开)后,把所有"缓存的上一帧"清掉再重画 */
export function afterStateReplaced(): void {
  const s = app.state;
  app.won = isWon(s);
  resetHud();
  resetRender();
  resetGateSeen(s);
  resetTips(s.playSec, nextEventGap());
  applyTheme();
  applySound();
  app.orchard.reducedMotion = s.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  hooks.render();
}
