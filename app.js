/* Reader for the sooon corpus: theses (with what he rejects) and the question
   checklist. Plain DOM, no dependencies.

   Data is split by build-split.js: index.json holds every item minus the full
   article text, and bodies/NN.json shards carry the text, fetched only when a
   detail panel opens. Search therefore covers question/thesis/rejects/title —
   not the article bodies, which are never all in memory at once.

   Every bit of reader state lives in the URL — query, filters, view in the
   search string, the open thesis in the hash — so any view is a link someone
   can send, and a reload lands back where they were. */

const $ = (id) => document.getElementById(id);

/* Every fetch inherits the ?v= that index.html put on this script tag, so the
   version is written in one place and code and data can't come from different
   builds. GitHub Pages serves everything with max-age=600 and no way to set
   headers, so a stale copy is the browser's call, not ours — a fresh id is the
   only reliable way to get out of a cache we don't control. */
const VER = new URL(document.currentScript?.src ?? location.href).search;
const url = (path) => path + VER;

/** Throws on a non-2xx instead of letting an error page fail as bad JSON. */
async function getJSON(path, opts) {
  const r = await fetch(url(path), opts);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

/* Reading this used to happen inline in `state`, at top level: one malformed
   value — a half-written string, something another tab wrote — threw before any
   listener was attached, so the page died silently with no error to show. */
function savedDone() {
  try {
    const saved = JSON.parse(localStorage.getItem('sooon.done') ?? '[]');
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set(); // the next tick overwrites the bad value anyway
  }
}

const state = {
  items: [],
  filtered: [],
  rendered: 0,
  view: 'theses',
  checklist: null,
  shards: 64,
  done: savedDone(),
  /* id of the thesis the panel is showing, or null. Doubles as the URL hash and
     as the answer to "is the panel open", which the DOM used to be asked for. */
  openId: null,
  // Guards the views against rendering before load() has anything to render.
  loaded: false,
};
const PAGE = 60;

const saveDone = () => localStorage.setItem('sooon.done', JSON.stringify([...state.done]));

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

/* ---------- url state ---------- */

/* The controls are the source of truth and the URL is written from them, never
   the other way round except on navigation (first load, back/forward). Keeping
   it one-directional is what stops the two from fighting over a keystroke. */

const CHECKS = { rejects: 'onlyRejects', tension: 'onlyTension' };

/** The search string the current controls describe: `?q=…&domain=…`, or '' for the default view. */
function controlsQuery() {
  const p = new URLSearchParams();
  if (state.view !== 'theses') p.set('view', state.view);
  const q = $('search').value.trim();
  if (q) p.set('q', q);
  for (const id of ['domain', 'year']) if ($(id).value) p.set(id, $(id).value);
  // The default sort is the common case; leaving it out keeps shared links short.
  if ($('sort').value !== 'date-desc') p.set('sort', $('sort').value);
  for (const [param, id] of Object.entries(CHECKS)) if ($(id).checked) p.set(param, '1');
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Pushes the controls into the URL. Silent: no popstate, no reload. */
function syncURL({ push = false } = {}) {
  // '' means "this URL" to replaceState, which would strand a stale query, so
  // the bare path has to be spelled out.
  const next = (controlsQuery() || location.pathname) + (state.openId ? `#${state.openId}` : '');
  history[push ? 'pushState' : 'replaceState'](null, '', next);
}

/* The other direction, for navigation only. Runs twice on startup: once before
   load() for everything static, once after for domain/year, whose <option>s
   don't exist until the index has been tallied. */
function readQuery() {
  const p = new URLSearchParams(location.search);
  state.view = p.get('view') === 'checklist' ? 'checklist' : 'theses';
  $('search').value = p.get('q') ?? '';
  for (const [param, id] of Object.entries(CHECKS)) $(id).checked = p.get(param) === '1';
  for (const id of ['domain', 'year', 'sort']) {
    const sel = $(id);
    sel.value = p.get(id) ?? '';
    // A value with no matching <option> — a domain that got renamed, a link from
    // an older build — leaves selectedIndex at -1 and the select blank.
    if (sel.selectedIndex < 0) sel.selectedIndex = 0;
  }
}

/** Re-renders whichever view is showing. Cheap no-op before the index lands. */
function render() {
  if (!state.loaded) return;
  if (state.view === 'theses') apply();
  else renderChecklist();
}

/* ---------- data ---------- */

/** `opts` carries cache:'reload' when the retry button bypasses a bad cache entry. */
async function load(opts) {
  const [data, checklist] = await Promise.all([
    getJSON('index.json', opts),
    getJSON('checklist.json', opts).catch(() => null),
  ]);
  state.items = data.items;
  state.checklist = checklist;
  state.shards = data.shards;

  // Same one-off lowercase haystack the theses get, for the checklist search.
  for (const m of state.checklist?.moves ?? []) {
    m.hay = `${m.move}\n${m.blocks}\n${m.category}`.toLowerCase();
  }
  migrateDone();

  // One lowercase haystack per item, built once: re-lowercasing four fields on
  // 3848 items at every keystroke was the other thing making typing feel slow.
  for (const it of state.items) {
    it.hay = `${it.question}\n${it.thesis}\n${it.rejects ?? ''}\n${it.title ?? ''}`.toLowerCase();
  }

  $('countLabel').textContent =
    `${data.count} 条论断 · ${data.corpus_total} 篇文章 · ${data.rejects_count} 条「反对」`;

  // domains/years are tallied at build time. Truncating to the leading "全部"
  // option first keeps this idempotent — the retry path runs load() twice.
  $('domain').length = 1;
  $('year').length = 1;
  $('domain').insertAdjacentHTML(
    'beforeend',
    data.domains.map(([d, n]) => `<option value="${esc(d)}">${esc(d)} (${n})</option>`).join(''),
  );
  $('year').insertAdjacentHTML('beforeend', data.years.map((y) => `<option value="${y}">${y}</option>`).join(''));

  // Now that the options exist, a ?domain= from the URL can actually stick.
  readQuery();
  state.loaded = true;
  setView(state.view, { history: false });

  /* A link into one thesis: #<id>. Opening it must not push an entry — the
     reader arrived on this one, and back belongs to wherever they came from. */
  const id = location.hash.slice(1);
  if (id) openDetail(id, { history: false });
}

/* The done-set used to be keyed by the question's own text, so reworded a move
   and every reader lost that checkmark. Moves carry ids now; this trades the old
   keys in for them once, on the first load after the change. */
function migrateDone() {
  let changed = false;
  for (const m of state.checklist?.moves ?? []) {
    if (m.id && state.done.delete(m.move)) {
      state.done.add(m.id);
      changed = true;
    }
  }
  if (changed) saveDone();
}

/* Article text, principles, url and file live in a shard picked by id prefix.
   The promise is cached so repeated opens and concurrent clicks share one fetch. */
const shardCache = new Map();

async function heavyOf(id) {
  const n = String(parseInt(id.slice(0, 2), 16) % state.shards).padStart(2, '0');
  if (!shardCache.has(n)) {
    shardCache.set(
      n,
      getJSON(`bodies/${n}.json`).catch((err) => {
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
  const onlyTension = $('onlyTension').checked;

  state.filtered = state.items.filter((it) => {
    if (domain && it.domain !== domain) return false;
    if (year && it.year !== year) return false;
    if (onlyRejects && !it.rejects) return false;
    if (onlyTension && !it.tension) return false;
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
  /* Nothing to page in until the index lands — and if it never lands, nothing
     ever. The scroll observer fires on an empty list either way, and without
     this it overwrote the loading and error states (retry button included) with
     "没有匹配的条目", which is only the right message once there are items to
     filter. */
  if (!state.items.length) return;

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
          ? `<span class="card-reject"><b>反对</b>${highlight(it.rejects, q)}</span>`
          : '';
        /* The text is one real <button> and the filter pills are their own, so
           the card no longer fakes a button with role+tabindex around them:
           Enter and Space come free, and the pills are reachable by Tab instead
           of being swallowed by the outer control. Spans, not divs — a <button>
           may only contain phrasing content. */
        return `<article class="card" data-id="${it.id}">
        <button type="button" class="card-open" aria-haspopup="dialog">
          <span class="card-q"><span class="qtext">${highlight(it.question, q)}</span></span>
          <span class="card-thesis">${highlight(it.thesis, q)}</span>
          ${reject}
        </button>
        <div class="meta">
          <button type="button" class="pill domain" data-filter="domain" data-value="${esc(it.domain)}"
            title="只看「${esc(it.domain)}」">${esc(it.domain)}</button>
          <button type="button" class="pill" data-filter="year" data-value="${esc(it.year)}"
            title="只看 ${esc(it.year)} 年">${esc(it.date)}</button>
          <span class="pill">${it.chars} 字</span>
          ${it.title ? `<span class="pill">${esc(it.title)}</span>` : ''}
          ${it.tension ? '<button type="button" class="pill" data-filter="tension" title="只看有张力的">有张力</button>' : ''}
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

/* Article text arrives as blank-line separated paragraphs; render them as such.
   highlight() escapes, so the query terms get marked here too — arriving from a
   search and losing every highlight at the moment you start reading was the one
   place the search stopped helping. */
const paragraphs = (body, query) =>
  String(body ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${highlight(p, query).replace(/\n/g, '<br>')}</p>`)
    .join('');

/** Paints everything already in the index, then fills in the article text. */
async function openDetail(id, { history: writeHistory = true } = {}) {
  const it = state.items.find((x) => x.id === id);
  /* A hash naming nothing — an old link, a typo — would otherwise leave the
     dead id sitting in the URL for the reader to share again. */
  if (!it) {
    if (state.openId === null) syncURL();
    return;
  }
  const seq = ++detailSeq;
  const firstOpen = $('panel').classList.contains('hidden');
  // Only on the first open — reopening from inside would record the panel itself.
  if (firstOpen) lastFocus = document.activeElement;
  const q = $('search').value.trim();

  $('panelHeadMeta').innerHTML = `
    <span class="pill domain">${esc(it.domain)}</span>
    <span class="pill">${esc(it.date)}</span>
    <span class="pill">${it.chars} 字</span>`;
  $('panelBody').innerHTML = `
    <h2 id="panelTitle">${highlight(it.question, q)}</h2>
    ${it.title ? `<p class="muted">标题：${highlight(it.title, q)}</p>` : ''}
    <div class="panel-actions">
      <button type="button" class="ghost wide" data-copy="link">复制链接</button>
      <button type="button" class="ghost wide" data-copy="cite">复制引用</button>
    </div>
    <div class="block"><span class="label">核心论断</span>${highlight(it.thesis, q)}</div>
    ${it.rejects ? `<div class="card-reject"><b>反对</b>${highlight(it.rejects, q)}</div>` : ''}
    <div id="detailRest" class="loading">正在加载正文…</div>`;
  $('panel').classList.remove('hidden');
  $('scrim').classList.remove('hidden');
  $('panel').scrollTop = 0;
  for (const el of backdrop()) el.inert = true;
  document.body.classList.add('panel-open');
  $('panel').focus();
  state.openId = id;
  /* One entry per panel session, not per card: stepping to the next thesis from
     inside the panel updates the hash in place instead of stacking up entries
     the reader has to back out through one by one. */
  if (writeHistory) {
    syncURL({ push: !pushed });
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
    <div class="body">${paragraphs(heavy.body, q)}</div>
    <p class="muted panel-src">${heavy.url ? `<a href="${esc(heavy.url)}" target="_blank" rel="noreferrer noopener">原始链接</a> · ` : ''}文件：${esc(heavy.file ?? '')}</p>`;
}

/* ---------- sharing ---------- */

/** A link to one thesis and nothing else: the reader's own filters aren't part of it. */
const linkTo = (id) => `${location.origin}${location.pathname}#${id}`;

/** Question, thesis and what it rejects, in the shape you'd paste into a note. */
async function citation(it) {
  // Instant when the shard is already cached, which after an open it is; the
  // source link is worth waiting for, and worth doing without if it fails.
  const heavy = await heavyOf(it.id).catch(() => ({}));
  return [
    `问题：${it.question}`,
    `论断：${it.thesis}`,
    it.rejects && `反对：${it.rejects}`,
    ``,
    `——素问语料 · ${it.domain} · ${it.date}${it.title ? ` · ${it.title}` : ''}`,
    heavy.url && `原文：${heavy.url}`,
    linkTo(it.id),
  ]
    .filter((l) => l !== false && l != null)
    .join('\n');
}

/* Reports on the button itself. A toast would be more visible and also one more
   moving part; the button is where the reader is already looking. */
async function copyFrom(btn, text) {
  const was = btn.textContent;
  try {
    // Needs https or localhost. Over plain http it rejects, hence the message.
    await navigator.clipboard.writeText(text);
    btn.textContent = '已复制';
  } catch {
    btn.textContent = '复制失败';
  }
  setTimeout(() => (btn.textContent = was), 1600);
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
  state.openId = null;
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
  // Nothing to go back to — the reader landed on #id directly. Drop the hash so
  // the URL describes what's on screen, but leave their history alone.
  hidePanel();
  syncURL();
}

/** Opens the thesis `delta` places away in the current result list. */
function stepDetail(delta) {
  const i = state.filtered.findIndex((x) => x.id === state.openId);
  const next = state.filtered[i + delta];
  if (i < 0 || !next) return;
  openDetail(next.id);
}

/* Back and forward are the one case where the URL leads and the controls follow.
   A panel open or close is the common one, but a shared link pasted over the
   current one, or backing out of a tab switch, lands here too. */
window.addEventListener('popstate', () => {
  if (location.search !== controlsQuery()) {
    readQuery();
    syncTabs();
    render();
  }
  const id = location.hash.slice(1);
  // We're standing on this entry, so closing from the UI can spend it going back.
  pushed = !!id;
  if (!id) hidePanel();
  else if (id !== state.openId) openDetail(id, { history: false });
});

/* ---------- checklist ---------- */

/* The id is what the checkmark is stored under. Falling back to the text keeps
   an older checklist.json working, at the old cost of breaking on a reword. */
const moveKey = (m) => m.id ?? m.move;

function renderChecklist() {
  const el = $('checklist');
  if (!state.checklist) {
    el.innerHTML = '<div class="empty">checklist.json 还没生成。运行 <code>node src/build-question-checklist.js</code></div>';
    return;
  }
  const all = state.checklist.moves;
  // The same search box as the theses view, against move/blocks/category.
  const terms = tokenize($('search').value);
  const moves = all.filter((m) => terms.every((t) => m.hay.includes(t)));
  // Counted over the whole checklist, not the filtered view — progress through
  // 34 questions is the number, and it shouldn't move when you type.
  const done = all.filter((m) => state.done.has(moveKey(m))).length;
  $('resultLabel').textContent = `${moves.length} 条`;

  const byCat = new Map();
  for (const m of moves) {
    if (!byCat.has(m.category)) byCat.set(m.category, []);
    byCat.get(m.category).push(m);
  }
  el.innerHTML =
    `<div class="intro">决策前从上往下过一遍，命中的那两三条通常就是你卡住的地方。勾选存在本地。</div>
    <div class="cl-bar">
      <span class="muted">已勾 ${done} / ${all.length}</span>
      <span class="cl-track" role="img" aria-label="已完成 ${done} 项，共 ${all.length} 项"><span style="width:${(done / all.length) * 100}%"></span></span>
      <button type="button" id="clReset" class="ghost wide" ${done ? '' : 'disabled'}>清空勾选</button>
    </div>` +
    (moves.length
      ? [...byCat]
          .map(
            ([cat, list]) =>
              `<h3>${esc(cat)}</h3>` +
              list
                .map((m) => {
                  const key = moveKey(m);
                  const on = state.done.has(key) ? ' done' : '';
                  const q = $('search').value.trim();
                  return `<label class="move${on}">
                <input type="checkbox" data-move="${esc(key)}" ${on ? 'checked' : ''}>
                <span><span class="q">${highlight(m.move, q)}</span>
                <span class="blocks">拦住的是：${highlight(m.blocks, q)}</span></span>
              </label>`;
                })
                .join(''),
          )
          .join('')
      : '<div class="empty">没有匹配的条目</div>');
}

/* ---------- view switching ---------- */

/** The parts of the chrome that follow state.view. Also the popstate path. */
function syncTabs() {
  const isList = state.view === 'theses';
  for (const t of document.querySelectorAll('.tab')) {
    const on = t.dataset.view === state.view;
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  }
  $('view-list').classList.toggle('hidden', !isList);
  $('view-checklist').classList.toggle('hidden', isList);
  /* The toolbar stays up in both views — the search box serves the checklist too.
     Only the theses-specific selects fold away. */
  $('toolbar').classList.toggle('checklist-mode', !isList);
  const hint = isList ? '搜索问题、论断、标题' : '搜索清单';
  $('search').placeholder = `${hint}…`;
  $('search').setAttribute('aria-label', hint);
}

/* A tab switch is a place worth being able to come back to, so unlike a
   keystroke in the search box it gets its own history entry. */
function setView(view, { history: writeHistory = true } = {}) {
  state.view = view;
  syncTabs();
  if (writeHistory) syncURL({ push: true });
  render();
}

/* ---------- events ---------- */

/* Control changes replaceState rather than push: one history entry per keystroke
   would bury whatever the reader was on before they started typing under thirty
   near-identical states. The URL still always describes the screen, which is what
   makes it shareable — it just isn't a log of how it got there. */
function onControlChange() {
  syncURL();
  render();
}

let t;
$('search').addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(onControlChange, 160);
});
for (const id of ['domain', 'year', 'sort', 'onlyRejects', 'onlyTension']) {
  $(id).addEventListener('change', onControlChange);
}

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

/* The meta pills filter; everything else in the card opens it. Pills are tested
   first because they sit inside the card, and a click on one is not a request to
   read the article. */
$('list').addEventListener('click', (e) => {
  const pill = e.target.closest('[data-filter]');
  if (pill) {
    const { filter, value } = pill.dataset;
    if (filter === 'tension') $('onlyTension').checked = true;
    else $(filter).value = value;
    onControlChange();
    // The list just rebuilt under the cursor; put the reader back at the top of it.
    window.scrollTo({ top: 0 });
    return;
  }
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
  saveDone();
  renderChecklist(); // the progress count and the reset button both just changed
});

$('checklist').addEventListener('click', (e) => {
  if (!e.target.closest('#clReset')) return;
  // Only lives in this browser, but it's still work the reader did.
  if (!confirm(`清空全部 ${state.done.size} 个勾选？`)) return;
  state.done.clear();
  saveDone();
  renderChecklist();
});

$('panelClose').addEventListener('click', closeDetail);
$('scrim').addEventListener('click', closeDetail);

/* The panel body is replaced on every open, so the copy buttons are handled here
   rather than rebound each time. */
$('panelBody').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  const it = state.items.find((x) => x.id === state.openId);
  if (!it) return;
  copyFrom(btn, btn.dataset.copy === 'link' ? linkTo(it.id) : await citation(it));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDetail();
    return;
  }
  // Single-letter shortcuts have to stay out of the way of actual typing.
  const typing = /^(input|textarea|select)$/i.test(e.target.tagName);
  if (e.key === '/' && !typing) {
    e.preventDefault();
    $('search').focus();
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  /* j/k mean the same thing in both places: the next thesis. In the list that's
     the next card to focus, in the panel it's the next article to read, which
     saves closing and reopening to walk a result set. */
  if (e.key === 'j' || e.key === 'k') {
    if (state.view !== 'theses') return;
    e.preventDefault();
    const delta = e.key === 'j' ? 1 : -1;
    if (state.openId) stepDetail(delta);
    else moveCardFocus(delta);
  }
});

/** Walks focus through the rendered cards, paging in more when it runs off the end. */
function moveCardFocus(delta) {
  let cards = [...$('list').querySelectorAll('.card')];
  const cur = document.activeElement?.closest?.('.card');
  let i = cur ? cards.indexOf(cur) + delta : delta > 0 ? 0 : cards.length - 1;
  if (i < 0) return;
  if (i >= cards.length) {
    more();
    cards = [...$('list').querySelectorAll('.card')];
    if (i >= cards.length) return; // genuinely the last one
  }
  cards[i]?.querySelector('.card-open')?.focus();
  // 'nearest' keeps the sticky header from scrolling the card out from under itself.
  cards[i]?.scrollIntoView({ block: 'nearest' });
}

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

/* A failed load is most often a stale or truncated cache entry, and a plain
   reload can hand back the exact same bad bytes; cache:'reload' is the one way
   from script to go past it without asking the reader for Cmd+Shift+R. */
function showLoadError(err) {
  $('list').innerHTML = `<div class="empty">加载失败：${esc(err.message)}<br><br>
    <button type="button" id="retryBtn" class="ghost">绕过缓存重新加载</button><br><br>
    index.json 还没生成？运行 <code>node build-split.js</code><br>
    另外需要通过本地服务器打开（file:// 下 fetch 会被浏览器阻止）：<br>
    <code>python3 -m http.server 8080</code></div>`;
  $('retryBtn').addEventListener('click', () => {
    $('list').innerHTML = '<div class="loading">正在重新加载…</div>';
    shardCache.clear(); // the shards came from the same suspect cache
    load({ cache: 'reload' }).catch(showLoadError);
  });
}

/* Read the URL before the fetch so the right tab is already showing while it's in
   flight, and so a shared link's query is in the box from the start. domain/year
   need the index's <option>s and get a second pass at the end of load(). */
readQuery();
syncTabs();
load().catch(showLoadError);
