// 启动:读档、创建画面、接线、起主循环。入口 src/main.ts 只 import 这个文件。
import { bus } from '../core/bus.ts';
import { GOAL, SAVE_KEY } from '../core/constants.ts';
import { exportSave, importSave, load, storageWritable } from '../core/save.ts';
import { GATE_SLOTS } from '../core/content.ts';
import { Orchard } from '../ui/orchard.ts';
import '../ui/glue.css';
import './app.css';
import { $, $o } from './dom.ts';
import { app, hooks, kv } from './ctx.ts';
import { toast } from './toasts.ts';
import { initBar, wireBar } from './bar.ts';
import { initHud } from './hud.ts';
import { startTicker } from './ticker.ts';
import { installContentNews, trackNewsSignals } from './news.ts';
import { chooseBranch, openGate } from './dialogs.ts';
import { applySound, applyTheme, afterStateReplaced, catchUp, DARK_MQ, persist, resetGame } from './session.ts';
import { armAudioUnlock, doShake, setupMotion } from './input.ts';
import { setupDebug } from './debug.ts';
import { renderAll } from './render.ts';
import { startLoop } from './loop.ts';
import { initSys, sysAway } from './sys.ts';
import { initAudioBridge } from './audiobridge.ts';

function wire(): void {
  app.orchard.onShake = (st) => doShake(st ?? 1);
  app.orchard.onGate = (slot) => openGate(slot);
  wireBar();
  for (let i = 0; i < GATE_SLOTS; i++) $o(`gate${i}`)?.addEventListener('click', () => openGate(i));
  $('branch0').addEventListener('click', () => chooseBranch(0));
  $('branch1').addEventListener('click', () => chooseBranch(1));

  // 键盘空格:由 Orchard 内部监听,触发 onShake

  // 尺寸:画布跟随 #scene(横竖屏切换、地址栏伸缩都会变)
  addEventListener('resize', () => app.orchard.resize());
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => app.orchard.resize()).observe($('scene'));

  // 声音:默认关;第一次触摸/按键时解锁 AudioContext
  armAudioUnlock();
  $('btnSound').addEventListener('click', () => {
    app.state.settings.sound = !app.state.settings.sound;
    app.audio.unlock();
    applySound();
    persist();
  });
  $('btnTheme').addEventListener('click', () => {
    const order = ['auto', 'light', 'dark'] as const;
    app.state.settings.dark = order[(order.indexOf(app.state.settings.dark) + 1) % 3];
    applyTheme();
    persist();
  });
  DARK_MQ.addEventListener?.('change', () => {
    if (app.state.settings.dark === 'auto') applyTheme();
  });

  // 前后台 / 关页
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persist();
    else catchUp(true);
  });
  addEventListener('pagehide', persist);
  addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) catchUp(true);
  });
  // 多标签页:别的标签页写了存档,本页停止保存,避免互相覆盖
  addEventListener('storage', (e) => {
    if (e.key === SAVE_KEY && !app.readOnly) {
      app.readOnly = true;
      toast('检测到另一个标签页在玩,本页已暂停保存。刷新后继续。', 5000);
    }
  });

  $('btnExport').addEventListener('click', async () => {
    const text = exportSave(app.state);
    try {
      await navigator.clipboard.writeText(text);
      toast('存档已复制到剪贴板。');
    } catch {
      prompt('复制下面的存档文本:', text);
    }
  });
  $('btnImport').addEventListener('click', () => {
    const text = prompt('粘贴存档文本:');
    if (!text) return;
    const s = importSave(text);
    if (!s) return toast('存档无效。');
    app.state = s;
    app.readOnly = false;
    catchUp(false);
    afterStateReplaced();
    persist();
    toast('导入成功。');
  });
  $('btnReset').addEventListener('click', () => {
    if (!confirm('确定重新开始?当前进度会被清除。')) return;
    $('settings').hidden = true;
    resetGame();
  });
}

hooks.render = renderAll;
app.canSave = storageWritable(kv);
const loaded = load(kv, Date.now());
const awayAtBoot = loaded.kind === 'new' ? 0 : Date.now() - loaded.state.lastSeen;
app.state = loaded.state;
if (loaded.kind === 'readonly') app.readOnly = true;
initBar();
initHud();
trackNewsSignals();
installContentNews();
initSys();
initAudioBridge();
app.orchard = new Orchard($<HTMLCanvasElement>('stage'));
if (loaded.kind === 'readonly') toast('存档来自更新的版本,本页只读,不会覆盖存档。', 6000);
else if (loaded.kind === 'ok') {
  if (loaded.fromBackup) toast('主存档损坏,已从备份恢复。', 5000);
  catchUp(true);
  if (awayAtBoot >= 3 * 86400_000) toast('隔了好几天。存档可以在设置里导出一份,也可以「添加到主屏幕」,下次点一下就回来。', 6000);
}
if (loaded.kind === 'new') sysAway(0);
$('saveWarn').textContent = app.canSave ? '' : '当前无法保存(隐私模式?),请定期导出存档。';
wire();
setupMotion();
if (app.DEBUG) {
  setupDebug();
  (window as unknown as { __game: unknown }).__game = {
    get state() {
      return app.state;
    },
    get speed() {
      return app.speed;
    },
    orchard: app.orchard,
    bus,
    GOAL,
  };
}
afterStateReplaced();
startTicker();
startLoop();
