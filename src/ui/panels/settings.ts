// 设置面板:音乐/音效/旁白打字音开关 + 音量滑条、静音拨片提示、减少动效、存档导出导入、声明/版本。
import { STAGE_CARD_UI } from '../../content/stages.ts';
import { GIFT_FRAME } from '../../content/gift.ts';
import { CONFIRM, SETTINGS, BTN } from '../../content/ui.ts';
import { btn, h, openSheet, reducedMotion, sfx } from './dom.ts';
import { savePrefs, type PanelPrefs } from './store.ts';
import type { PanelCtx } from './types.ts';

type Layer = 'bgm' | 'sfx' | 'voice';

function toggleRow(label: string, hint: string | null, on: boolean, set: (v: boolean) => void): { row: HTMLElement; sync(v: boolean): void } {
  const sw = h('button', 'panel-sw' + (on ? ' on' : ''), h('i'));
  sw.type = 'button';
  sw.setAttribute('role', 'switch');
  sw.setAttribute('aria-checked', String(on));
  sw.setAttribute('aria-label', label);
  const sync = (v: boolean): void => {
    sw.classList.toggle('on', v);
    sw.setAttribute('aria-checked', String(v));
  };
  sw.addEventListener('click', () => {
    const v = sw.getAttribute('aria-checked') !== 'true';
    sync(v);
    set(v);
  });
  const row = h('div', 'panel-set-row', h('div', 'panel-set-l', h('b', null, label), hint ? h('small', null, hint) : null), sw);
  return { row, sync };
}

function slider(label: string, v: number, on: (v: number) => void): HTMLElement {
  const r = h('input', 'panel-range') as HTMLInputElement;
  r.type = 'range';
  r.min = '0';
  r.max = '100';
  r.step = '5';
  r.value = String(Math.round(v * 100));
  r.setAttribute('aria-label', label + '音量');
  const num = h('span', 'panel-set-num', r.value);
  r.addEventListener('input', () => {
    num.textContent = r.value;
    on(Number(r.value) / 100);
  });
  return h('div', 'panel-set-vol', h('small', null, '音量'), r, num);
}

export function openSettings(
  ctx: PanelCtx,
  prefs: PanelPrefs,
  deps: { openGift(): void; openStageCards(): void; onChange(): void },
): void {
  const au = ctx.audio;
  const act = ctx.actions ?? {};
  const sheet = openSheet(ctx, { id: 'panel-settings', title: SETTINGS.title, cls: 'panel-settings-sheet' });
  const body = sheet.body;
  body.classList.add('panel-set');
  const touchState = (): void => {
    if (au) ctx.getState().settings.sound = au.isMusicOn() || au.isSfxOn();
    act.settingsChanged?.();
  };

  // ── 声音 ──
  const sound = h('section', 'panel-set-sec', h('h3', null, '声音'));
  if (au) {
    const musicOn = au.isMusicOn();
    const m = toggleRow(SETTINGS.music, null, musicOn, (v) => {
      if (v) au.unlock();
      au.setMusic(v);
      touchState();
      sfx(ctx, v ? 'toggleOn' : 'toggleOff');
    });
    const s = toggleRow(SETTINGS.sound, null, au.isSfxOn(), (v) => {
      if (v) au.unlock();
      au.setSfx(v);
      touchState();
      if (v) sfx(ctx, 'toggleOn');
    });
    const nv = toggleRow('旁白打字音', '旁白条逐字出现时的小哔哔声', au.isVoiceOn(), (v) => {
      if (v) au.unlock();
      au.setVoice(v);
      touchState();
    });
    sound.append(m.row, slider('音乐', au.getVolume('bgm'), (v) => au.setVolume('bgm' as Layer, v)));
    sound.append(s.row, slider('音效', au.getVolume('sfx'), (v) => au.setVolume('sfx' as Layer, v)));
    sound.append(nv.row, slider('旁白', au.getVolume('voice'), (v) => au.setVolume('voice' as Layer, v)));
    const hint = au.silentSwitchHint();
    if (hint) sound.append(h('p', 'panel-set-hint', hint));
  } else sound.append(h('p', 'panel-note', '声音模块没有接上。'));

  // ── 显示 ──
  const view = h('section', 'panel-set-sec', h('h3', null, '显示与旁白'));
  view.append(
    toggleRow('旁白打字机', '一个字一个字出来;关掉就是整句出现', prefs.typewriter, (v) => {
      prefs.typewriter = v;
      savePrefs(ctx, prefs);
    }).row,
    toggleRow(SETTINGS.reduceMotion, SETTINGS.reduceMotionHint, ctx.getState().settings.reducedMotion, (v) => {
      ctx.getState().settings.reducedMotion = v;
      au?.setReducedMotion(v);
      act.settingsChanged?.();
    }).row,
  );

  // ── 存档 ──
  const data = h('section', 'panel-set-sec', h('h3', null, '存档'));
  const area = h('textarea', 'panel-area') as HTMLTextAreaElement;
  area.rows = 3;
  area.spellcheck = false;
  area.placeholder = '导出的存档会出现在这里;导入时把存档粘贴到这里';
  area.setAttribute('aria-label', '存档文本');
  const msg = h('p', 'panel-set-msg');
  msg.setAttribute('aria-live', 'polite');
  const say = (t: string, bad = false): void => {
    msg.textContent = t;
    msg.classList.toggle('bad', bad);
  };
  const bExport = btn(SETTINGS.exportSave, '', async () => {
    const t = act.exportSave?.();
    if (!t) return say('现在导不出来。', true);
    area.value = t;
    area.select();
    try {
      await navigator.clipboard.writeText(t);
      say(`已复制到剪贴板。${SETTINGS.exportHint}`);
    } catch {
      say(`存档在上面,手动复制。${SETTINGS.exportHint}`);
    }
  });
  const importRow = h('div', 'panel-confirm');
  const bImport = btn(SETTINGS.importSave, '', () => {
    const t = area.value.trim();
    if (!t) return say('先把存档粘贴到上面。', true);
    importRow.replaceChildren(
      h('span', null, CONFIRM.importOverwrite.title),
      btn(CONFIRM.importOverwrite.ok, 'red', () => {
        importRow.replaceChildren();
        const ok = act.importSave?.(t);
        say(ok ? SETTINGS.importOk : SETTINGS.importFail, !ok);
      }),
      btn(CONFIRM.importOverwrite.cancel, 'ghost', () => importRow.replaceChildren()),
    );
  });
  bExport.disabled = !act.exportSave;
  bImport.disabled = !act.importSave;
  const resetRow = h('div', 'panel-confirm');
  const bReset = btn(SETTINGS.reset, 'ghost', () => {
    resetRow.replaceChildren(
      h('span', null, CONFIRM.reset.title),
      btn(CONFIRM.reset.ok, 'red', () => {
        sheet.close();
        act.resetSave?.();
      }),
      btn(CONFIRM.reset.cancel, 'ghost', () => resetRow.replaceChildren()),
    );
  });
  bReset.disabled = !act.resetSave;
  data.append(area, h('div', 'panel-set-btns', bExport, bImport, bReset), importRow, resetRow, msg, h('p', 'panel-note', SETTINGS.resetHint));

  // ── 关于 ──
  const about = h('section', 'panel-set-sec', h('h3', null, SETTINGS.about));
  about.append(
    btn(STAGE_CARD_UI.replay, 'ghost', () => deps.openStageCards()),
    btn(GIFT_FRAME.settingsEntry, 'gold', () => deps.openGift()),
    h('p', 'panel-note', SETTINGS.aboutBody),
    h('p', 'panel-note', SETTINGS.credits),
    h('p', 'panel-disc', SETTINGS.disclaimer),
    h('p', 'panel-note', `${SETTINGS.version} ${ctx.version ?? 'v5'}`),
  );
  if (ctx.debug) about.append(h('p', 'panel-note panel-dbg', SETTINGS.debugOn));

  body.append(sound, view, data, about);
  if (!reducedMotion(ctx)) body.classList.add('anim');
  void BTN;
}
