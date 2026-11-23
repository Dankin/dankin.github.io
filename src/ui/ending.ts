// 结局页:自带样式的覆盖层,不依赖 index.html。
import { fmtDuration } from './format.ts';

const CSS = `
#ending{position:fixed;inset:0;z-index:50;background:#0b0b0b;color:#f4f4f4;display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity 1.2s;font-family:inherit;overflow:auto}
#ending.on{opacity:1}
#ending .card{max-width:420px;text-align:center;line-height:1.8}
#ending h2{font-size:22px;margin:0 0 16px;letter-spacing:.08em}
#ending .apple{width:64px;height:64px;border-radius:50%;background:#d9342b;margin:0 auto 18px;box-shadow:0 0 40px #d9342b88;animation:endpulse 3s ease-in-out infinite}
#ending p{margin:6px 0;opacity:.9}
#ending .stats{margin:18px 0;padding:12px;border:1px solid #333;border-radius:8px;font-size:14px;opacity:.85}
#ending button{background:none;border:1px solid #666;color:#f4f4f4;border-radius:8px;padding:10px 18px;margin:6px;font-size:15px;min-height:44px;cursor:pointer}
#ending button.main{border-color:#d9342b;color:#fff;background:#d9342b33}
@media (max-height:520px){
#ending{padding:max(10px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
#ending .card{max-width:640px;display:grid;grid-template-columns:130px 1fr;column-gap:22px;text-align:left;line-height:1.5;align-items:center}
#ending .l{text-align:center}
#ending .apple{width:48px;height:48px;margin:0 auto 8px}
#ending h2{font-size:20px;margin:0}
#ending p{margin:3px 0;font-size:14px}
#ending .stats{margin:8px 0;padding:6px 10px;font-size:13px}
#ending button{padding:6px 14px;margin:4px 8px 0 0;min-height:40px;font-size:14px}
}
@keyframes endpulse{50%{transform:scale(1.08)}}
@media (prefers-reduced-motion:reduce){#ending,#ending .apple{transition:none;animation:none}}
`;

/** 统计由 main.ts 传入(用时毫秒、点击/转圈次数),界面层不依赖 core。 */
export interface EndStats {
  elapsedMs: number;
  clicks: number;
}

export function showEnding(s: EndStats, onClose: () => void, onRestart: () => void): void {
  if (document.getElementById('ending')) return;
  if (!document.getElementById('endingCss')) {
    const st = document.createElement('style');
    st.id = 'endingCss';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const el = document.createElement('div');
  el.id = 'ending';
  el.innerHTML = `
  <div class="card">
    <div class="l"><div class="apple"></div>
    <h2>平安夜</h2></div>
    <div class="r">
    <p>82 亿个平安果,送完了。</p>
    <p>地球上的每一个人,手里都有一个苹果。</p>
    <p>有人咬了一口,有人留着没吃。</p>
    <div class="stats">
      用时 ${fmtDuration(Math.max(0, s.elapsedMs))} · 摇了 ${s.clicks} 下
    </div>
    <p style="opacity:.6;font-size:13px">谢谢你一直在摇。树也谢谢你。</p>
    <div><button class="main" id="endKeep">回到果园</button><button id="endRestart">重新开始</button></div>
    </div>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  el.querySelector('#endKeep')!.addEventListener('click', () => {
    el.remove();
    onClose();
  });
  el.querySelector('#endRestart')!.addEventListener('click', () => {
    if (!confirm('确定重新开始?当前进度会被清除。')) return;
    el.remove();
    onRestart();
  });
}
