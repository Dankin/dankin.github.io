#!/usr/bin/env node
/* Splits data.json into what the reader actually needs up front.

   data.json is 17MB because `body` (12MB) and `principles` (2.5MB) carry the
   full articles, and the list view never shows either. Loading it all before
   the first card renders is the whole reason the page felt slow.

   Output:
     index.json      every item minus the heavy fields — the only blocking fetch
     bodies/NN.json  64 shards of {body, principles, url, file, tension},
                     keyed by id, fetched on demand when a detail panel opens

   The split is lossless: every field of data.json lands in one of the two.
   Run after regenerating data.json, then commit index.json and bodies/. */

const fs = require('fs');
const path = require('path');

const SHARDS = 64; // 256 leading-hex buckets / 4 — uniform, ~235KB raw per shard
const OUT_BODIES = 'bodies';

/** Shard for an item, derived from its id so the client computes it without a map. */
const shardOf = (id) => parseInt(id.slice(0, 2), 16) % SHARDS;

const LIGHT = ['id', 'short', 'title', 'question', 'thesis', 'rejects', 'domain', 'date', 'year', 'chars', 'type'];
const HEAVY = ['body', 'principles', 'url', 'file', 'tension'];

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const items = data.items;

const light = items.map((it) => {
  const out = {};
  for (const k of LIGHT) if (it[k] != null && it[k] !== '') out[k] = it[k];
  // The list only tests `tension` for truthiness; the string itself lives in the shard.
  if (it.tension) out.tension = 1;
  return out;
});

// Precomputed so the client skips a 3848 x domains scan on load.
const tally = (key) => {
  const m = new Map();
  for (const it of items) if (it[key]) m.set(it[key], (m.get(it[key]) ?? 0) + 1);
  return m;
};

const index = {
  generated_at: data.generated_at,
  count: data.count,
  corpus_total: data.corpus_total,
  rejects_count: items.filter((i) => i.rejects).length,
  shards: SHARDS,
  domains: [...tally('domain')].sort((a, b) => b[1] - a[1]),
  years: [...tally('year').keys()].sort().reverse(),
  items: light,
};

const shards = Array.from({ length: SHARDS }, () => ({}));
for (const it of items) {
  const rec = {};
  for (const k of HEAVY) if (it[k] != null && it[k] !== '' && !(Array.isArray(it[k]) && !it[k].length)) rec[k] = it[k];
  shards[shardOf(it.id)][it.id] = rec;
}

fs.rmSync(OUT_BODIES, { recursive: true, force: true });
fs.mkdirSync(OUT_BODIES, { recursive: true });

const write = (p, obj) => {
  fs.writeFileSync(p, JSON.stringify(obj));
  return fs.statSync(p).size;
};

const indexBytes = write('index.json', index);
let bodyBytes = 0;
let max = 0;
shards.forEach((s, i) => {
  const n = write(path.join(OUT_BODIES, `${String(i).padStart(2, '0')}.json`), s);
  bodyBytes += n;
  max = Math.max(max, n);
});

const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`index.json   ${mb(indexBytes)}  (${items.length} 条, blocking fetch)`);
console.log(`${OUT_BODIES}/*.json  ${mb(bodyBytes)} across ${SHARDS} shards, largest ${kb(max)}  (on demand)`);
console.log(`was         ${mb(fs.statSync('data.json').size)} blocking`);
