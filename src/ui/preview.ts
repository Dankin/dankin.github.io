/** v4 预览:假状态驱动 Orchard + 底栏 DOM。参数:?src=0..5&rt=0..5&dark=1&veh=4&stock=.5&shake=.6&gates=wash,pack,rush&gu=3&unit=3&br=0|1&carry&prod&event=bird&dev=0&reduced=1&pick=gate|branch */
import { Orchard, EMPTY_WORLD, type WorldView } from './orchard.ts';
import { SRC_NAMES } from './sources.ts';
import { RT_NAMES } from './route.ts';
import { fmt } from './format.ts';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number): number => (q.has(k) ? Number(q.get(k)) : d);
const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
const GATES = ['wash', 'wax', 'juice', 'pack', 'cold', 'rush', 'string'];
const GN: Record<string, string> = { wash: '洗果', wax: '打蜡', juice: '榨汁', pack: '包装', cold: '冷链', rush: '加急', string: '红绳' };

const dark = q.get('dark') === '1' || (!q.has('dark') && matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.classList.toggle('dark', dark);
const cv = $('stage') as HTMLCanvasElement;
const o = new Orchard(cv);
o.dark = dark;
o.reducedMotion = q.get('reduced') === '1';

const st = {
  src: num('src', 0),
  rt: num('rt', 0),
  veh: num('veh', 3),
  unit: num('unit', 3),
  br: num('br', -1),
  stock: num('stock', 0.35),
  fw: num('fw', 0.2),
  combo: num('combo', 0),
  gu: num('gu', 3),
  gates: (q.get('gates') ?? 'wash,pack').split(',').filter(Boolean).concat([null as unknown as string, null as unknown as string, null as unknown as string]).slice(0, 3).map((g) => g || null),
  prod: num('prod', 5),
  carry: num('carry', 3),
  delivered: num('del', 1.2e6),
};

function world(): WorldView {
  const units = [0, 0, 0, 0, 0, 0];
  units[st.src] = st.unit;
  units[0] = Math.max(units[0], 1);
  const br = [-1, -1, -1, -1, -1, -1];
  if (st.br >= 0) for (let i = 1; i <= st.src; i++) br[i] = st.br;
  return {
    ...EMPTY_WORLD,
    srcTier: st.src,
    srcUnits: units,
    srcBranch: br,
    rtTier: st.rt,
    rtVehicles: st.veh,
    rtBranch: st.br,
    gates: st.gates,
    gatesUnlocked: st.gu,
    stock01: st.stock,
    produce: Math.pow(10, st.prod / 2),
    carry: Math.pow(10, st.carry / 2),
    shake: st.fw,
    combo: st.combo,
    perTrip: 24,
  };
}

function btn(id: string, nm: string, pr: string, cls: string, pv = ''): void {
  const b = $(id);
  (b.querySelector('.pv') as HTMLElement).textContent = pv;
  (b.querySelector('.nm') as HTMLElement).textContent = nm;
  (b.querySelector('.pr') as HTMLElement).textContent = pr;
  b.classList.remove('can', 'no', 'max');
  if (cls) b.classList.add(cls);
}
function ui(): void {
  $('apples').textContent = fmt(st.delivered);
  $('rate').textContent = '每秒 ' + fmt(Math.pow(10, Math.min(st.prod, st.carry) / 2));
  ($('goalBar') as HTMLElement).style.width = Math.min(100, (st.delivered / 8.2e9) * 100) + '%';
  btn('btnSrcBuy', ['摘果篮', '果树苗', '梯田', '高楼', '卫星', '分门'][st.src] + ' ×' + st.unit, '1.2万', 'can', '每秒多产 +12%');
  btn('btnSrcUp', st.src < 5 ? '升级 → ' + SRC_NAMES[st.src + 1] : SRC_NAMES[st.src] + ' 满级', st.src < 5 ? '3.4亿' : '', st.src < 5 ? 'no' : 'max', st.src < 5 ? '产量 ×4,二选一' : '');
  btn('btnRtBuy', ['挑夫', '推车', '卡车', '货轮', '飞机', '光束'][st.rt] + ' ×' + st.veh, '8.8千', 'can', '运力 +1 辆');
  btn('btnRtUp', st.rt < 5 ? '升级 → ' + RT_NAMES[st.rt + 1] : RT_NAMES[st.rt] + ' 满级', st.rt < 5 ? '1.1万' : '', st.rt < 5 ? 'can' : 'max', st.rt < 5 ? '一趟多装 ×3' : '');
  for (let i = 0; i < 3; i++) {
    const b = $('gate' + i);
    b.className = 'slot';
    const nm = b.querySelector('.nm') as HTMLElement;
    if (i >= st.gu) {
      b.classList.add('locked');
      nm.textContent = '';
    } else if (st.gates[i]) {
      b.classList.add('on');
      nm.textContent = GN[st.gates[i] as string];
    } else {
      b.classList.add('empty');
      nm.textContent = '+';
    }
  }
  o.setWorld(world());
}

function dev(): void {
  const d = $('dev');
  if (q.get('dev') === '0') {
    d.style.display = 'none';
    return;
  }
  const row = (label: string, n: number, cur: () => number, set: (v: number) => void): string => {
    void cur;
    void set;
    return label + n;
  };
  void row;
  const mk = (label: string, opts: string[], get: () => number, set: (i: number) => void): void => {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;gap:2px;margin:2px 0;align-items:center;flex-wrap:wrap';
    r.append(label + ' ');
    opts.forEach((t, i) => {
      const b = document.createElement('button');
      b.textContent = t;
      b.style.cssText = 'padding:3px 5px;border:1px solid #888;border-radius:4px;font-size:11px';
      b.onclick = () => {
        set(i);
        ui();
        r.querySelectorAll('button').forEach((x, j) => ((x as HTMLElement).style.background = j === get() ? '#fc0' : ''));
      };
      if (i === get()) b.style.background = '#fc0';
      r.append(b);
    });
    d.append(r);
  };
  mk('生产', SRC_NAMES.map((_, i) => String(i)), () => st.src, (i) => (st.src = i));
  mk('运输', RT_NAMES.map((_, i) => String(i)), () => st.rt, (i) => (st.rt = i));
  mk('车', ['1', '3', '6', '12', '24'], () => 1, (i) => (st.veh = [1, 3, 6, 12, 24][i]));
  mk('库存', ['空', '半', '满'], () => 1, (i) => (st.stock = [0, 0.5, 1][i]));
  mk('分支', ['无', 'A', 'B'], () => st.br + 1, (i) => (st.br = i - 1));
  mk('摇劲', ['0', '.5', '1'], () => 0, (i) => (st.fw = [0, 0.5, 1][i]));
  mk('门', ['0', '1', '2', '3'], () => st.gu, (i) => (st.gu = i));
  const r = document.createElement('div');
  for (const [n, f] of [
    ['暗', () => { o.dark = !o.dark; document.documentElement.classList.toggle('dark', o.dark); }],
    ['鸟', () => o.spawnEvent('bird', (h) => o.floatText(h ? '抓到!' : '飞走了'))],
    ['牛顿', () => o.spawnEvent('newton', (h) => o.floatText(h ? '哎哟' : '走了'))],
    ['流星', () => o.spawnEvent('meteor', (h) => o.floatText(h ? '许愿' : '错过'))],
    ['摇', () => o.poke(3)],
    ['喷', () => o.burst(4)],
    ['选关', () => { ($('gatePick') as HTMLElement).hidden = false; }],
    ['分支', () => { ($('branchPick') as HTMLElement).hidden = false; }],
  ] as Array<[string, () => void]>) {
    const b = document.createElement('button');
    b.textContent = n;
    b.style.cssText = 'padding:3px 5px;border:1px solid #888;border-radius:4px;font-size:11px;margin:1px';
    b.onclick = f;
    r.append(b);
  }
  d.append(r);
}

// 假的 gatePick / branchPick 内容
function fill(): void {
  const opts = $('gateOpts');
  opts.innerHTML = '';
  for (const g of GATES) {
    const b = document.createElement('button');
    b.className = 'opt' + (st.gates.includes(g) ? ' on' : '');
    b.innerHTML = `<b>${GN[g]}</b><span>×1.5 价值</span>`;
    b.onclick = () => {
      const free = st.gates.findIndex((x) => x === null);
      if (free >= 0 && !st.gates.includes(g)) st.gates[free] = g;
      ($('gatePick') as HTMLElement).hidden = true;
      ui();
    };
    opts.append(b);
  }
  const bs = [
    ['温室', '全年结果,产出 ×2'],
    ['隧道', '山腹运果,运力 ×2'],
  ];
  [0, 1].forEach((i) => {
    const b = $('branch' + i);
    (b.querySelector('.nm') as HTMLElement).textContent = bs[i][0];
    (b.querySelector('.desc') as HTMLElement).textContent = bs[i][1];
    (b.querySelector('.pr') as HTMLElement).textContent = '3.4亿';
    b.classList.add('can');
    b.onclick = () => {
      st.br = i;
      ($('branchPick') as HTMLElement).hidden = true;
      ui();
    };
  });
  $('branchTitle').textContent = '升级 → ' + SRC_NAMES[Math.min(5, st.src + 1)];
  $('branchSub').textContent = '二选一,选后不可改';
}

for (let i = 0; i < 3; i++) $('gate' + i).addEventListener('click', () => { ($('gatePick') as HTMLElement).hidden = false; });
o.onGate = () => { ($('gatePick') as HTMLElement).hidden = false; };
o.onShake = () => {
  o.poke(2);
  st.fw = Math.min(1, st.fw + 0.12);
  st.combo = Math.min(9, Math.floor(st.fw * 10));
  st.delivered += 100;
  $('apples').classList.remove('bump');
  void $('apples').offsetWidth;
  $('apples').classList.add('bump');
  ui();
};
$('btnSettings').addEventListener('click', () => {});
for (const id of ['btnSrcBuy', 'btnSrcUp', 'btnRtBuy', 'btnRtUp']) {
  $(id).addEventListener('click', () => {
    const b = $(id);
    b.classList.remove('pressed');
    void b.offsetWidth;
    b.classList.add('pressed');
    if (id === 'btnSrcBuy') st.unit++;
    if (id === 'btnRtBuy') st.veh = Math.min(24, st.veh + 1);
    if (id === 'btnSrcUp' && st.src < 5) { ($('branchPick') as HTMLElement).hidden = false; }
    if (id === 'btnRtUp' && st.rt < 5) st.rt++;
    ui();
  });
}
fill();
ui();
dev();
if (q.get('pick') === 'gate') ($('gatePick') as HTMLElement).hidden = false;
if (q.get('pick') === 'branch') ($('branchPick') as HTMLElement).hidden = false;
const ev = q.get('event');
if (ev) o.spawnEvent(ev as 'bird', () => {});
addEventListener('resize', () => o.resize());
(window as unknown as { __o: Orchard }).__o = o;
let last = performance.now();
let fwT = 0;
function loop(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  fwT += dt;
  if (fwT > 0.25) { fwT = 0; st.fw = Math.max(0, st.fw - 0.01); st.combo = Math.floor(st.fw * 10); }
  o.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
void fmt;
