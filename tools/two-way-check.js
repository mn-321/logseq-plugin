#!/usr/bin/env node
/* Checks the two-way rows against the real Illness Test Graph: the plugin's own code that finds them
   (groupsByPage in parts/two-way.js) is run in a pretend window, with its database questions answered by
   Logseq's command line, and what it finds is compared with an answer key worked out here from the raw graph:
   for every page that is not a journal day, every field of yours on another node that points at it.
     node tools/two-way-check.js
   Also checked: the order of each row (coming up first, nearest first; then the past, latest first; then no
   date), the counts in its summary, and two facts of the test graph's plan (Dr. Mei Chen is the doctor of 13).
   Fields listed in "Fields shown from one end only" are left out, as the plugin does. Needs node, jsdom and the
   command line (~/.local/bin/logseq) with the app having the graph open; skipped quietly where they are missing.
   Reads only; writes nothing. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const GRAPH = process.env.GRAPH || 'Illness Test Graph';
const CLI = path.join(os.homedir(), '.local/bin/logseq');
const root = path.resolve(__dirname, '..');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch { console.log('two-way check skipped (needs jsdom)'); process.exit(0); }
if (!fs.existsSync(CLI)) { console.log('two-way check skipped (no Logseq command line)'); process.exit(0); }

// One question at a time: the command line refuses several at once.
let queue = Promise.resolve();
const ask = query => (queue = queue.catch(() => {}).then(() => askNow(query)));
const askNow = query => new Promise((resolve, reject) => execFile(CLI, ['query', '-g', GRAPH, '-o', 'json', '--timeout-ms', '60000', '--query', query],
  { encoding: 'utf8', maxBuffer: 1 << 28 }, (error, stdout) => {
    if (error) return reject(new Error(String(stdout || error.message).slice(0, 300)));
    const out = JSON.parse(stdout);
    if (out.status !== 'ok') return reject(new Error('the command line said: ' + stdout.slice(0, 300)));
    resolve(out.data.result);
  }));
const problems = [];
const problem = text => { problems.push(text); console.log('PROBLEM: ' + text); };
const settingsFile = path.join(os.homedir(), '.logseq/settings/logseq-db-refinements.json');
const settings = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};

// The answer key, from every fact about every node.
async function answerKey() {
  const facts = await ask('[:find ?e ?a ?v :where [?e :block/uuid] [?e ?a ?v]]');
  const props = new Map(await ask('[:find ?a ?name :where [?p :db/ident ?a] [(namespace ?a) ?ns] [(= ?ns "user.property")] [?p :block/title ?name]]'));
  const of = new Map(); // e -> Map(attr -> [values])
  for (const [e, a, v] of facts) {
    if (!of.has(e)) of.set(e, new Map());
    const m = of.get(e);
    if (!m.has(a)) m.set(a, []);
    m.get(a).push(v);
  }
  const one = (e, a) => of.get(e)?.get(a)?.[0];
  const deleted = e => one(e, 'logseq.property/deleted-at') != null;
  const oneEnd = new Set(String(settings.twoWayOneEnd || '').split(/[;\n]/).map(s => s.trim().toLowerCase()).filter(Boolean));
  const key = new Map(); // page uuid -> Map(field name -> Set(uuid))
  for (const [e, m] of of) for (const [a, values] of m) {
    const name = props.get(a);
    if (!name || oneEnd.has(name.toLowerCase())) continue;
    for (const page of values) {
      if (typeof page !== 'number' || page === e || !of.has(page)) continue;
      if (one(page, 'block/name') == null || one(page, 'block/journal-day') != null) continue;
      if (one(e, 'block/page') === page || deleted(e) || (one(e, 'block/page') != null && deleted(one(e, 'block/page')))) continue;
      if (one(e, 'block/title') == null) continue;
      const pu = one(page, 'block/uuid');
      if (!key.has(pu)) key.set(pu, new Map());
      if (!key.get(pu).has(name)) key.get(pu).set(name, new Set());
      key.get(pu).get(name).add(one(e, 'block/uuid'));
    }
  }
  const titles = new Map([...of].map(([e, m]) => [m.get('block/uuid')?.[0], m.get('block/title')?.[0]]));
  return { key, titles };
}

// The plugin's own finding, in a pretend window.
async function pluginRows() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.parent = window;
  window.logseq = { settings: { twoWayRows: true, twoWayNames: settings.twoWayNames ?? '', twoWayOneEnd: settings.twoWayOneEnd ?? '' }, DB: { datascriptQuery: ask }, UI: {}, App: {}, Editor: {} };
  window.eval(fs.readFileSync(path.join(root, 'parts/shared.js'), 'utf8'));
  const source = fs.readFileSync(path.join(root, 'parts/two-way.js'), 'utf8');
  const exposed = source.replace(/\}\)\(\);\s*$/, `window.__tw = { groupsByPage, summary, init: core => ({ UUID, isEntityId, provided, dsQuery } = core) }; })();`);
  if (exposed === source) throw new Error('the end of parts/two-way.js changed; tools/two-way-check.js cannot reach it');
  window.eval(exposed);
  window.__tw.init({
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    isEntityId: id => Number.isSafeInteger(id) && id > 0,
    provided: { readableTitle: async text => text },
    dsQuery: ask,
  });
  return { rows: await window.__tw.groupsByPage(null), summary: window.__tw.summary };
}

(async () => {
  try { await ask('[:find ?e :where [?e :block/name "nausea"]]'); }
  catch (error) { console.log('two-way check skipped (the command line could not read the graph: ' + String(error.message).slice(0, 120) + ')'); process.exit(0); }
  const [{ key, titles }, { rows, summary }] = await Promise.all([answerKey(), pluginRows()]);
  const found = new Map();
  for (const { uuid, groups } of rows.values()) if (groups.length) found.set(uuid, groups);
  const name = uuid => titles.get(uuid) || uuid;
  let fields = 0, links = 0;
  for (const pu of new Set([...key.keys(), ...found.keys()])) {
    const want = key.get(pu) || new Map(), groups = found.get(pu) || [];
    const got = new Map(groups.map(g => [g.name, new Set(g.items.map(i => i.uuid))]));
    for (const field of new Set([...want.keys(), ...got.keys()])) {
      const a = want.get(field) || new Set(), b = got.get(field) || new Set();
      const missing = [...a].filter(u => !b.has(u)), extra = [...b].filter(u => !a.has(u));
      if (missing.length) problem(`${name(pu)}: “${field}” misses ${missing.map(name).join(', ')}`);
      if (extra.length) problem(`${name(pu)}: “${field}” has ${extra.map(name).join(', ')}, which do not point here`);
      fields++; links += a.size;
    }
    const now = (() => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); })();
    for (const g of groups) {
      const rank = i => i.day >= now ? 0 : i.day ? 1 : 2;
      for (let k = 1; k < g.items.length; k++) {
        const p = g.items[k - 1], q = g.items[k];
        const ok = rank(p) < rank(q) || (rank(p) === rank(q) && (rank(p) === 0 ? p.day <= q.day : rank(p) === 1 ? p.day >= q.day : true));
        if (!ok) { problem(`${name(pu)}: “${g.label}” lists ${p.title} before ${q.title} out of order`); break; }
      }
      const counted = summary(g.items).split(' · ')[0].split(', ').reduce((n, part) => n + parseInt(part, 10), 0);
      if (counted !== g.items.length) problem(`${name(pu)}: “${g.label}” says ${summary(g.items)} for ${g.items.length} records`);
    }
  }
  // Facts from the test graph's plan.
  const chen = [...titles].find(([, t]) => t === 'Dr. Mei Chen')?.[0];
  const doctorOf = (found.get(chen) || []).find(g => g.name === 'doctor');
  if (!doctorOf) problem('Dr. Mei Chen has no “doctor of” row');
  else if (doctorOf.items.length !== 13) problem(`Dr. Mei Chen is the doctor of ${doctorOf.items.length}, not 13`);
  else if (doctorOf.label !== 'doctor of') problem(`Dr. Mei Chen's row reads “${doctorOf.label}”, not “doctor of”`);
  console.log(`two-way rows on the Illness Test Graph: ${found.size} pages, ${fields} rows, ${links} links compared with the answer key`);
  if (problems.length) { console.log(`two-way check: FAILED (${problems.length})`); process.exit(1); }
  console.log('two-way check: OK');
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
