/* Reader for the sooon corpus: theses (with what he rejects) and the question
   checklist. Plain DOM, no dependencies.

   Data is split by build-split.js: index.json holds every item minus the full
   article text, and bodies/NN.json shards carry the text, fetched only when a
   detail panel opens. Search therefore covers question/thesis/rejects/title —
   not the article bodies, which are never all in memory at once. */

const $ = (id) => document.getElementById(id);
const state = {
  items: [],
  filtered: [],
  rendered: 0,
  view: 'theses',
  checklist: null,
  shards: 64,
  done: new Set(JSON.parse(localStorage.getItem('sooon.done') ?? '[]')),
};
const PAGE = 60;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Filtering and highlighting split the query the same way now. They used to
   disagree: the filter tested the whole raw string, so `孩子 教育` matched
   nothing while highlight() was already splitting on whitespace. */
const tokenize = (query) => query.trim().toLowerCase().split(/\s+/).filter(Boolean);

/* Every term filters, but a lone ASCII letter isn't worth marking up — `a`
   would paint half the page. A single CJK character is a real query. */
const markable = (t) => t.length > 1 || /[^\x00-\x7f]/.test(t);

/** Highlights query terms without letting user input become markup. */
function highlight(text, query) {
  const safe = esc(text);
  if (!query) return safe;
  const terms = tokenize(query)
    .filter(markable)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!terms.length) return safe;
  return safe.replace(new RegExp(`(${terms.join('|')})`, 'gi'), '<mark>$1</mark>');
}

/* ---------- data ---------- */

async function load() {
  const [data, checklist] = await Promise.all([
    fetch('index.json').then((r) => r.json()),
    fetch('checklist.json').then((r) => r.json()).catch(() => null),
  ]);
  state.items = data.items;
  state.checklist = checklist;
  state.shards = data.shards;

  // One lowercase haystack per item, built once: re-lowercasing four fields on
  // 3848 items at every keystroke was the other thing making typing feel slow.
  for (const it of state.items) {
    it.hay = `${it.question}\n${it.thesis}\n${it.rejects ?? ''}\n${it.title ?? ''}`.toLowerCase();
  }

  $('countLabel').textContent =
    `${data.count} 条论断 · ${data.corpus_total} 篇文章 · ${data.rejects_count} 条「反对」`;

  // domains/years are tallied at build time.
  $('domain').insertAdjacentHTML(
    'beforeend',
    data.domains.map(([d, n]) => `<option value="${esc(d)}">${esc(d)} (${n})</option>`).join(''),
  );
  $('year').insertAdjacentHTML('beforeend', data.years.map((y) => `<option value="${y}">${y}</option>`).join(''));
  apply();
}

/* Article text, principles, url and file live in a shard picked by id prefix.
   The promise is cached so repeated opens and concurrent clicks share one fetch. */
const shardCache = new Map();

async function heavyOf(id) {
  const n = String(parseInt(id.slice(0, 2), 16) % state.shards).padStart(2, '0');
  if (!shardCache.has(n)) {
    shardCache.set(
      n,
      fetch(`bodies/${n}.json`)
        .then((r) => {
          if (!r.ok) throw new Error(`bodies/${n}.json ${r.status}`);
          return r.json();
        })
        .catch((err) => {
          shardCache.delete(n); // let the next click retry
          throw err;
        }),
    );
  }
  return (await shardCache.get(n))[id] ?? {};
}

function apply() {
  const terms = tokenize($('search').value);
  const domain = $('domain').value;
  const year = $('year').value;
  const onlyRejects = $('onlyRejects').checked;

  state.filtered = state.items.filter((it) => {
    if (domain && it.domain !== domain) return false;
    if (year && it.year !== year) return false;
    if (onlyRejects && !it.rejects) return false;
    return terms.every((t) => it.hay.includes(t)); // vacuously true with no query
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

  $('list').insertAdjacentHTML(
    'beforeend',
    slice
      .map((it) => {
        const reject = it.rejects
          ? `<div class="card-reject"><b>反对</b>${highlight(it.rejects, q)}</div>`
          : '';
        return `<article class="card" data-id="${it.id}" tabindex="0" role="button" aria-haspopup="dialog">
        <div class="card-q"><span class="qtext">${highlight(it.question, q)}</span></div>
        <div class="card-thesis">${highlight(it.thesis, q)}</div>
        ${reject}
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

let detailSeq = 0; // a slow shard must not overwrite a panel the user opened later
let lastFocus = null; // the card that opened the panel, to hand focus back to
/* Whether the open panel owns a history entry. On phones the panel fills the
   screen, so the system back gesture has to close it instead of leaving the
   site — and closing from the UI has to consume that entry again. */
let pushed = false;

/* Everything the modal panel covers. `inert` does the job a hand-written focus
   trap would: while it is set, Tab can't reach the background and clicks on it
   do nothing. */
const backdrop = () => [$('stickyHead'), $('main')];

/** Article text arrives as blank-line separated paragraphs; render them as such. */
const paragraphs = (body) =>
  String(body ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

/** Paints everything already in the index, then fills in the article text. */
async function openDetail(id) {
  const it = state.items.find((x) => x.id === id);
  if (!it) return;
  const seq = ++detailSeq;
  const firstOpen = $('panel').classList.contains('hidden');
  // Only on the first open — reopening from inside would record the panel itself.
  if (firstOpen) lastFocus = document.activeElement;

  $('panelHeadMeta').innerHTML = `
    <span class="pill domain">${esc(it.domain)}</span>
    <span class="pill">${esc(it.date)}</span>
    <span class="pill">${it.chars} 字</span>`;
  $('panelBody').innerHTML = `
    <h2 id="panelTitle">${esc(it.question)}</h2>
    ${it.title ? `<p class="muted">标题：${esc(it.title)}</p>` : ''}
    <div class="block"><span class="label">核心论断</span>${esc(it.thesis)}</div>
    ${it.rejects ? `<div class="card-reject"><b>反对</b>${esc(it.rejects)}</div>` : ''}
    <div id="detailRest" class="loading">正在加载正文…</div>`;
  $('panel').classList.remove('hidden');
  $('scrim').classList.remove('hidden');
  $('panel').scrollTop = 0;
  for (const el of backdrop()) el.inert = true;
  document.body.classList.add('panel-open');
  $('panel').focus();
  // One entry per panel session, not per card: opening a second card from
  // inside the panel must not stack up entries the user has to back through.
  if (firstOpen && !pushed) {
    history.pushState({ sooonPanel: 1 }, '');
    pushed = true;
  }

  let heavy;
  try {
    heavy = await heavyOf(id);
  } catch (err) {
    if (seq === detailSeq) $('detailRest').innerHTML = `<div class="empty">正文加载失败：${esc(err.message)}</div>`;
    return;
  }
  if (seq !== detailSeq) return;

  const principles = heavy.principles?.length
    ? `<div class="block"><span class="label">抽取出的规范性主张（${heavy.principles.length}）</span><ul>${heavy.principles
        .map((p) => `<li>${esc(p.principle)}${p.tension ? `<br><span class="muted">张力：${esc(p.tension)}</span>` : ''}</li>`)
        .join('')}</ul></div>`
    : '';

  $('detailRest').className = '';
  $('detailRest').innerHTML = `
    ${principles}
    <div class="body">${paragraphs(heavy.body)}</div>
    <p class="muted panel-src">${heavy.url ? `<a href="${esc(heavy.url)}" target="_blank" rel="noreferrer noopener">原始链接</a> · ` : ''}文件：${esc(heavy.file ?? '')}</p>`;
}

/** The DOM half of closing; reached either from the UI or from a back gesture. */
function hidePanel() {
  if ($('panel').classList.contains('hidden')) return; // stray Esc must not steal focus
  $('panel').classList.add('hidden');
  $('scrim').classList.add('hidden');
  for (const el of backdrop()) el.inert = false;
  document.body.classList.remove('panel-open');
  lastFocus?.focus(); // a no-op if the list re-rendered and the card is gone
  lastFocus = null;
}

/* Closing from the UI goes through history so the pushed entry is consumed;
   popstate then does the hiding. Without this, back would reopen the panel. */
function closeDetail() {
  if ($('panel').classList.contains('hidden')) return;
  if (pushed) {
    pushed = false;
    history.back();
    return;
  }
  hidePanel();
}

window.addEventListener('popstate', () => {
  pushed = false;
  hidePanel();
});

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
    `<div class="intro">决策前从上往下过一遍，命中的那两三条通常就是你卡住的地方。勾选存在本地。</div>` +
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

/* ---------- view switching ---------- */

function setView(view) {
  state.view = view;
  for (const t of document.querySelectorAll('.tab')) {
    const on = t.dataset.view === view;
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  }
  const isList = view === 'theses';
  $('view-list').classList.toggle('hidden', !isList);
  $('view-checklist').classList.toggle('hidden', isList);
  $('toolbar').classList.toggle('hidden', !isList);
  if (isList) apply();
  else renderChecklist();
}

/* ---------- events ---------- */

let t;
$('search').addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(apply, 160);
});
for (const id of ['domain', 'year', 'sort', 'onlyRejects']) $(id).addEventListener('change', apply);

// Narrow screens hide the filter row behind this button; on wide ones the row is
// always visible and the button is display:none, so the class is harmless there.
$('filterBtn').addEventListener('click', () => {
  const open = $('toolbar').classList.toggle('filters-open');
  $('filterBtn').setAttribute('aria-expanded', String(open));
});

$('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (btn) setView(btn.dataset.view);
});

$('list').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (card) openDetail(card.dataset.id);
});

// The cards are focusable, so they have to answer the keys a button answers.
$('list').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const card = e.target.closest('.card');
  if (!card) return;
  e.preventDefault(); // Space would page the list down instead
  openDetail(card.dataset.id);
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
// rootMargin starts the next page before the sentinel is on screen, so the
// scroll doesn't visibly stall at the bottom of each page.
new IntersectionObserver(
  (es) => {
    if (es[0].isIntersecting && state.view === 'theses') more();
  },
  { rootMargin: '600px' },
).observe($('sentinel'));

// The initial theme is applied by the inline script in index.html's <head> —
// doing it here meant a light flash before this file ran.
$('themeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('sooon.theme', next);
});

load().catch((err) => {
  $('list').innerHTML = `<div class="empty">加载失败：${esc(err.message)}<br><br>
    index.json 还没生成？运行 <code>node build-split.js</code><br>
    另外需要通过本地服务器打开（file:// 下 fetch 会被浏览器阻止）：<br>
    <code>python3 -m http.server 8080</code></div>`;
});
