// DOM 小工具。
export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
/** 可能不存在的节点(UI 设计师会增删) */
export const $o = <T extends HTMLElement = HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

export const setText = (el: HTMLElement, t: string): void => {
  if (el.textContent !== t) el.textContent = t;
};
export function setCls(el: HTMLElement, on: Record<string, boolean>): void {
  for (const k in on) el.classList.toggle(k, on[k]);
}

export const fmtWait = (sec: number): string =>
  !isFinite(sec) ? '很久' : sec < 60 ? `${Math.max(1, Math.ceil(sec))}秒` : sec < 3600 ? `${Math.ceil(sec / 60)}分钟` : sec < 86400 ? `${(sec / 3600).toFixed(1)}小时` : '很久';
