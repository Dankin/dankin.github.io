/* Reader for the sooon corpus: theses, rejected views, question checklist, drift.
   Plain DOM, no dependencies — data.json is static so this runs from file://. */

const $ = (id) => document.getElementById(id);
const state = {
  items: [],
  filtered: [],
  rendered: 0,
  view: 'theses',
  checklist: null,
  done: new Set(JSON.parse(localStorage.getItem('sooon.done') ?? '[]')),
};
const PAGE = 60;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Highlights query terms without letting user input become markup. */
function highlight(text, query) {
  const safe = esc(text);
  if (!query) return safe;
  const terms = query.split(/\s+/).filter((t) => t.length > 1).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!terms.length) return safe;
  return safe.replace(new RegExp(`(${terms.join('|')})`, 'gi'), '<mark>$1</mark>');
}

/* ---------- data ---------- */

async function load() {
  const [data, checklist] = await Promise.all([
    fetch('data.json').then((r) => r.json()),
    fetch('checklist.json').then((r) => r.json()).catch(() => null),
  ]);
  state.items = data.items;
  state.checklist = checklist;

  $('countLabel').textContent =
    `${data.count} 条论断 · ${data.corpus_total} 篇文章 · ${data.items.filter((i) => i.rejects).length} 条「反对」`;

  const domains = [...new Set(state.items.map((i) => i.domain))]
    .map((d) => [d, state.items.filter((i) => i.domain === d).length])
    .sort((a, b) => b[1] - a[1]);
  for (const [d, n] of domains) {
    $('domain').insertAdjacentHTML('beforeend', `<option value="${esc(d)}">${esc(d)} (${n})</option>`);
  }
  for (const y of [...new Set(state.items.map((i) => i.year).filter(Boolean))].sort().reverse()) {
    $('year').insertAdjacentHTML('beforeend', `<option value="${y}">${y}</option>`);
  }
  apply();
}

function apply() {
  const q = $('search').value.trim().toLowerCase();
  const domain = $('domain').value;
  const year = $('year').value;
  const onlyRejects = $('onlyRejects').checked || state.view === 'rejects';

  state.filtered = state.items.filter((it) => {
    if (domain && it.domain !== domain) return false;
    if (year && it.year !== year) return false;
    if (onlyRejects && !it.rejects) return false;
    if (!q) return true;
    return (
      it.question.toLowerCase().includes(q) ||
      it.thesis.toLowerCase().includes(q) ||
      (it.rejects ?? '').toLowerCase().includes(q) ||
      (it.title ?? '').toLowerCase().includes(q) ||
      it.body.toLowerCase().includes(q)
    );
  });

  const [key, dir] = $('sort').value.split('-');
  state.filtered.sort((a, b) => {
    const va = key === 'date' ? String(a.date) : a.chars;
    const vb = key === 'date' ? String(b.date) : b.chars;
    const cmp = key === 'date' ? String(va).localeCompare(String(vb)) : va - vb;
    return dir === 'asc' ? cmp : -cmp;
  });

  $('resultLabel').textContent = `${state.filtered.length} 条`;
  state.rendered = 0;
  $('list').innerHTML = '';
  more();
}

function more() {
  const slice = state.filtered.slice(state.rendered, state.rendered + PAGE);
  if (!slice.length) {
    if (!state.rendered) $('list').innerHTML = '<div class="empty">没有匹配的条目</div>';
    return;
  }
  const q = $('search').value.trim();
  const showRejectFirst = state.view === 'rejects';

  $('list').insertAdjacentHTML(
    'beforeend',
    slice
      .map((it) => {
        const reject = it.rejects
          ? `<div class="card-reject"><b>他反对</b>${highlight(it.rejects, q)}</div>`
          : '';
        const thesis = `<div class="card-thesis">${highlight(it.thesis, q)}</div>`;
        return `<article class="card" data-id="${it.id}">
        <div class="card-q"><span class="qtext">${highlight(it.question, q)}</span></div>
        ${showRejectFirst ? reject + thesis : thesis + reject}
        <div class="meta">
          <span class="pill domain">${esc(it.domain)}</span>
          <span class="pill">${esc(it.date)}</span>
          <span class="pill">${it.chars} 字</span>
          ${it.title ? `<span class="pill">${esc(it.title)}</span>` : ''}
          ${it.tension ? '<span class="pill">有张力</span>' : ''}
        </div>
      </article>`;
      })
      .join(''),
  );
  state.rendered += slice.length;
}

/* ---------- detail ---------- */

function openDetail(id) {
  const it = state.items.find((x) => x.id === id);
  if (!it) return;
  const principles = it.principles?.length
    ? `<div class="block"><span class="label">抽取出的规范性主张（${it.principles.length}）</span><ul>${it.principles
        .map((p) => `<li>${esc(p.principle)}${p.tension ? `<br><span class="muted">张力：${esc(p.tension)}</span>` : ''}</li>`)
        .join('')}</ul></div>`
    : '';

  $('panelBody').innerHTML = `
    <div class="meta">
      <span class="pill domain">${esc(it.domain)}</span>
      <span class="pill">${esc(it.date)}</span>
      <span class="pill">${it.chars} 字</span>
      <span class="pill">${esc(it.short)}</span>
    </div>
    <h2>${esc(it.question)}</h2>
    ${it.title ? `<p class="muted">标题：${esc(it.title)}</p>` : ''}
    <div class="block"><span class="label">核心论断</span>${esc(it.thesis)}</div>
    ${it.rejects ? `<div class="card-reject"><b>他反对</b>${esc(it.rejects)}</div>` : ''}
    ${principles}
    <p class="muted">${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noreferrer noopener">原始链接</a> · ` : ''}文件：${esc(it.file ?? '')}</p>
    <div class="body">${esc(it.body)}</div>`;
  $('panel').classList.remove('hidden');
  $('scrim').classList.remove('hidden');
  $('panel').scrollTop = 0;
}

function closeDetail() {
  $('panel').classList.add('hidden');
  $('scrim').classList.add('hidden');
}

/* ---------- checklist ---------- */

function renderChecklist() {
  const el = $('checklist');
  if (!state.checklist) {
    el.innerHTML = '<div class="empty">checklist.json 还没生成。运行 <code>node src/build-question-checklist.js</code></div>';
    return;
  }
  const byCat = new Map();
  for (const m of state.checklist.moves) {
    if (!byCat.has(m.category)) byCat.set(m.category, []);
    byCat.get(m.category).push(m);
  }
  el.innerHTML =
    `<div class="intro">
      <strong>为什么是提问，而不是结论。</strong><br>
      评测显示这套语料里真正可迁移的是他的<b>推理方法</b>（method +105%，两轮实验里唯一统计显著的提升），
      而不是他的判断（立场命中率只有 43%）。所以这里给的是他反复使用的质问动作，由你自己去问、自己判断。<br><br>
      从 ${state.checklist.sampled} 条「他反对的常规看法」中提炼。决策前从上往下过一遍——
      多数处境只有两三条命中，命中的那几条通常就是你卡住的地方。勾选状态存在本地。
    </div>` +
    [...byCat]
      .map(
        ([cat, moves]) =>
          `<h3>${esc(cat)}</h3>` +
          moves
            .map((m) => {
              const key = m.move;
              const done = state.done.has(key) ? ' done' : '';
              return `<label class="move${done}">
                <input type="checkbox" data-move="${esc(key)}" ${done ? 'checked' : ''}>
                <span><span class="q">${esc(m.move)}</span>
                <span class="blocks">拦住的是：${esc(m.blocks)}</span></span>
              </label>`;
            })
            .join(''),
      )
      .join('');
}

/* ---------- drift ---------- */

function renderDrift() {
  // Per-year volume for recurring topics: the corpus spans nine years, so a
  // stance stated in 2018 may not be the one he holds now. This shows where
  // enough material exists on both ends to be worth reading chronologically.
  const topics = [
    ['孩子 / 教育', /孩子|儿子|女儿|家长|教育|学习|老师|上学/],
    ['亲密关系', /恋爱|结婚|婚姻|伴侣|男friend|女朋友|男朋友|前任|离婚|喜欢/],
    ['职场', /工作|职场|领导|同事|上司|辞职|老板|公司|加班/],
    ['心理状态', /抑郁|焦虑|自卑|痛苦|情绪|难受|内耗/],
    ['金钱', /钱|收入|工资|financial|理财|贫穷|富/],
    ['人际边界', /朋友|拒绝|边界|人情|社交|亲戚/],
  ];
  const years = [...new Set(state.items.map((i) => i.year).filter(Boolean))].sort();

  $('drift').innerHTML =
    `<div class="intro">
      语料跨 ${years[0]}–${years.at(-1)} 共 ${years.length} 个年份。同一议题的早期与近期回答可能并不一致——
      <b>他的近期立场才是更相关的那个</b>。下面按年份显示各议题的文章数量；
      点某一年的条目会筛出那一年的文章，可以按时间顺序对照读。
    </div>` +
    topics
      .map(([name, re]) => {
        const hits = state.items.filter((i) => re.test(i.question) || re.test(i.thesis));
        const counts = years.map((y) => [y, hits.filter((h) => h.year === y).length]);
        const max = Math.max(1, ...counts.map((c) => c[1]));
        return `<div class="drift-row">
          <h4>${esc(name)} · 共 ${hits.length} 篇</h4>
          <div class="bars">${counts
            .map(
              ([y, n]) => `<div class="bar-row" data-year="${y}" data-topic="${esc(name)}">
              <span class="yr">${y}</span>
              <span class="track"><span class="fill" style="width:${(n / max) * 100}%"></span></span>
              <span class="n">${n}</span></div>`,
            )
            .join('')}</div>
        </div>`;
      })
      .join('');
}

/* ---------- view switching ---------- */

function setView(view) {
  state.view = view;
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.view === view);
  const isList = view === 'theses' || view === 'rejects';
  $('view-list').classList.toggle('hidden', !isList);
  $('view-checklist').classList.toggle('hidden', view !== 'checklist');
  $('view-drift').classList.toggle('hidden', view !== 'drift');
  $('toolbar').classList.toggle('hidden', !isList);
  if (view === 'checklist') renderChecklist();
  else if (view === 'drift') renderDrift();
  else apply();
}

/* ---------- events ---------- */

let t;
$('search').addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(apply, 160);
});
for (const id of ['domain', 'year', 'sort', 'onlyRejects']) $(id).addEventListener('change', apply);

$('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (btn) setView(btn.dataset.view);
});

$('list').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (card) openDetail(card.dataset.id);
});

$('checklist').addEventListener('change', (e) => {
  const box = e.target.closest('input[data-move]');
  if (!box) return;
  const key = box.dataset.move;
  if (box.checked) state.done.add(key);
  else state.done.delete(key);
  box.closest('.move').classList.toggle('done', box.checked);
  localStorage.setItem('sooon.done', JSON.stringify([...state.done]));
});

$('drift').addEventListener('click', (e) => {
  const row = e.target.closest('.bar-row');
  if (!row) return;
  $('year').value = row.dataset.year;
  setView('theses');
});

$('panelClose').addEventListener('click', closeDetail);
$('scrim').addEventListener('click', closeDetail);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDetail();
  if (e.key === '/' && document.activeElement !== $('search')) {
    e.preventDefault();
    $('search').focus();
  }
});

// Infinite scroll keeps the DOM small; 3848 cards at once would stutter.
new IntersectionObserver((es) => {
  if (es[0].isIntersecting && state.view !== 'checklist' && state.view !== 'drift') more();
}).observe($('sentinel'));

$('themeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('sooon.theme', next);
});
document.documentElement.dataset.theme = localStorage.getItem('sooon.theme') ?? 'light';

load().catch((err) => {
  $('list').innerHTML = `<div class="empty">加载失败：${esc(err.message)}<br><br>
    需要通过本地服务器打开（file:// 下 fetch 会被浏览器阻止）：<br>
    <code>cd reader && python3 -m http.server 8080</code></div>`;
});
