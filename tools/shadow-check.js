#!/usr/bin/env node
/* Scores the proposals' rules (parts/shadow.js) on the real Illness Test Graph, through Logseq's command line, with
   every property hidden in turn: for each record and each of its link properties (and its date), the property is
   taken out of what the rules see, and the rules run on the record's own words and on each note written under it.
   What they propose is compared with what the property really holds:
     right   the proposal is exactly what is there
     wrong   something else was proposed (the one thing that must stay near zero: a wrong fill taken by habit)
     silent  nothing was proposed (costs a few key taps, nothing more)
   A sure piece is judged first; only where there is none, the guess (piece 2, taken only with Enter) is, and counted
   apart: a wrong guess costs a look, not a wrong fill.
   Fails when wrong goes above WRONG_LIMIT, right falls under RIGHT_LEAST (the rules stopped firing), a wrong guess
   goes above GUESS_WRONG_LIMIT, or a right guess under GUESS_RIGHT_LEAST.
     node tools/shadow-check.js          the score, and every wrong one
     node tools/shadow-check.js --all    also every right and silent one
   The "looks like" engine's limits (parts/alike.js) can be tried from the environment, for the scoreboard in
   docs/ALIKE.md: ALIKE_K=5 ALIKE_NEAR=.5 ALIKE_LEAD=.7 ALIKE_STEM=1 node tools/shadow-check.js; the tag's own
   (stage D): ALIKE_TAG_NEAR=.3 ALIKE_TAG_LEAD=.7 ALIKE_TAG_LEAST=1
   Runs only while the app has the graph open (as tools/two-way-check.js); skipped quietly otherwise. Reads only. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const GRAPH = process.env.GRAPH || 'Illness Test Graph';
const CLI = path.join(os.homedir(), '.local/bin/logseq');
const root = path.resolve(__dirname, '..');
// On the Illness Test Graph written as ordinary journal lines (2026-10-20) the rules are right 54 times of 100; the
// silent ones are mostly words with no link ("dull ache on the right"), for the plain-words piece. RIGHT_LEAST catches
// the rules going quiet.
const WRONG_LIMIT = 0, RIGHT_LEAST = 50;
// Guesses (0.4.200), on the same graph: right 19 (15 from earlier lines like it, 4 from plain words), wrong 1 (“about
// the tingling” guesses Tingling fingers as the Topic, which holds Peripheral neuropathy); silent went from 46 to 26.
const GUESS_WRONG_LIMIT = 1, GUESS_RIGHT_LEAST = 15;
// Stage D (0.4.213): every record's tag hidden in turn, and every plain note (no tag, no record above) must get none.
// On the seed graph at 0.4.213: right 22, wrong 0, silent 34 of 56; one plain note ("Blood again this morning. Third
// time this month.", left untagged in the seed on purpose) is offered #Symptom Log, which is the feature working.
const TAG_WRONG_LIMIT = 0, TAG_RIGHT_LEAST = 15, PLAIN_SPOKE_LIMIT = 1;
const all = process.argv.includes('--all');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch { console.log('proposals check skipped (needs jsdom)'); process.exit(0); }
if (!fs.existsSync(CLI)) { console.log('proposals check skipped (no Logseq command line)'); process.exit(0); }

let queue = Promise.resolve();
const ask = query => (queue = queue.catch(() => {}).then(() => askNow(query)));
const askNow = query => new Promise((resolve, reject) => execFile(CLI, ['query', '-g', GRAPH, '-o', 'json', '--timeout-ms', '60000', '--query', query],
  { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 90000 }, (error, stdout) => {
    if (error) return reject(new Error(String(stdout || error.message).slice(0, 300)));
    const out = JSON.parse(stdout);
    if (out.status !== 'ok') return reject(new Error('the command line said: ' + stdout.slice(0, 300)));
    resolve(out.data.result);
  }));
const problems = [];
const problem = text => { problems.push(text); console.log('PROBLEM: ' + text); };

async function plugin() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.parent = window;
  window.logseq = { settings: { shadowProposals: true, shadowGraphs: GRAPH }, updateSettings() {}, onSettingsChanged: () => () => {},
    App: { getCurrentGraph: async () => ({ name: GRAPH }), getUserConfigs: async () => ({}) }, UI: { showMsg() {} }, Editor: {}, DB: { onChanged: () => () => {} } };
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  window.eval(read('parts/shared.js'));
  window.eval(read('parts/model.js'));
  window.eval(read('parts/alike.js'));
  window.eval(read('parts/shadow.js'));
  const cache = new Map();
  const core = { host: () => window.document, watchDomEarly() {}, dsQuery: ask, graphWide: (name, load) => { if (!cache.has(name)) cache.set(name, load()); return cache.get(name); },
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, sendStyle() {}, provided: {}, provide: things => Object.assign(core.provided, things) };
  window.refinementCore = core;
  const parts = Object.fromEntries(window.refinementParts.map(p => [p.name, p]));
  parts.model.provide(core); parts.model.start();
  parts.alike.provide(core);
  const { limits } = core.provided.alike, env = process.env;
  if (env.ALIKE_K) limits.k = Number(env.ALIKE_K);
  if (env.ALIKE_NEAR) limits.nearLeast = Number(env.ALIKE_NEAR);
  if (env.ALIKE_LEAD) limits.lead = Number(env.ALIKE_LEAD);
  if (env.ALIKE_STEM) limits.stem = env.ALIKE_STEM !== '0';
  if (env.ALIKE_TAG_NEAR) limits.tagNearLeast = Number(env.ALIKE_TAG_NEAR);
  if (env.ALIKE_TAG_LEAD) limits.tagLead = Number(env.ALIKE_TAG_LEAD);
  if (env.ALIKE_TAG_LEAST) limits.tagLeast = Number(env.ALIKE_TAG_LEAST);
  console.log(`looks-like limits: k ${limits.k}, nearest at least ${limits.nearLeast}, lead ${limits.lead}, stem ${limits.stem}; tag: nearest at least ${limits.tagNearLeast}, lead ${limits.tagLead}, agreeing at least ${limits.tagLeast}`);
  parts.proposals.start();
  return window.refinementShadowInner;
}

(async () => {
  const servers = await new Promise(resolve => execFile(CLI, ['server', 'list', '-o', 'json'], { encoding: 'utf8', timeout: 30000 },
    (error, stdout) => { try { resolve(JSON.parse(stdout).data.servers || []); } catch { resolve([]); } }));
  if (!servers.some(s => s.graph === GRAPH && s.status === 'ready' && (s['owner-source'] === 'electron' || process.env.OWNER === 'any'))) { console.log(`proposals check skipped (the app does not have "${GRAPH}" open)`); process.exit(0); }
  const inner = await plugin();
  const ctx = await inner.guessDataFor(await inner.daysFor(await inner.contextFor()));
  const { schema, byId } = ctx;
  // Every block with words, pulled as the rules read one (one question for all of them).
  const blocks = (await ask(`[:find (pull ?b ${inner.BLOCK_PULL}) :where [?b :block/page _] [?b :block/title ?t] [(not= ?t "")] (not [?b :logseq.property/deleted-at _])]`)).map(([b]) => b);
  const pick = (node, name) => node?.[name] ?? node?.[':' + name] ?? node?.[name.slice(name.indexOf('/') + 1)];
  const idOf = v => typeof v === 'number' ? v : pick(v, 'db/id');
  const byDbId = new Map(blocks.map(b => [idOf(b), b]));
  const childrenOf = new Map();
  for (const b of blocks) { const p = idOf(pick(b, 'block/parent')); if (p != null) { if (!childrenOf.has(p)) childrenOf.set(p, []); childrenOf.get(p).push(b); } }
  const keyOf = (node, ident) => Object.keys(node).find(k => k.replace(/^:/, '') === ident);
  const valuesOf = (node, ident) => { const k = keyOf(node, ident); const v = k ? node[k] : null; return (Array.isArray(v) ? v : v == null ? [] : [v]).map(idOf).filter(id => id != null); };
  const hide = (node, ident) => { const copy = { ...node }; const k = keyOf(copy, ident); if (k) delete copy[k]; return copy; };
  const title = b => String(pick(b, 'block/title') ?? '').replace(/\[\[([0-9a-f-]{36})\]\]/gi, (m, u) => `[[${ctx.byKey.get(u.toLowerCase())?.title || u}]]`).slice(0, 50);
  const name = id => byId.get(id)?.title || (ctx.days.get(id) ? 'the day ' + ctx.days.get(id) : String(id));
  const tally = { right: 0, wrong: 0, silent: 0, guessRight: 0, guessWrong: 0 }, byHow = {};
  const fields = (tagIds) => { const seen = new Set(), out = [], q = [...tagIds]; while (q.length) { const c = q.shift(); if (seen.has(c)) continue; seen.add(c); for (const p of schema.classProps.get(c) || []) { const prop = schema.byId.get(p); if (prop && !out.includes(prop)) out.push(prop); } q.push(...(schema.parentsOf.get(c) || [])); } return out; };
  let cases = 0;
  for (const record of blocks) {
    const tags = (pick(record, 'block/tags') || []).map(idOf);
    const props = fields(tags).filter(p => (p.type === 'node' && p.classes.length) || (p.type === 'date' && p.lower === 'date'));
    for (const prop of props) {
      const actual = valuesOf(record, prop.ident);
      if (!actual.length) continue;
      cases++;
      const hidden = hide(record, prop.ident);
      // The record's own words, then each note under it (its parent being the record with the property hidden).
      const runs = [[hidden, String(pick(record, 'block/title') ?? '')]];
      for (const child of childrenOf.get(idOf(record)) || []) runs.push([{ ...child, 'block/parent': hidden }, String(pick(child, 'block/title') ?? '')]);
      // A property that holds several: a proposal that is part of them is right (the rest is still to add).
      const judge = piece => piece.ids.every(id => actual.includes(id)) && (prop.many || piece.ids.length === actual.length) ? 'right' : 'wrong';
      let verdict = 'silent', said = null, guess = null, guessVerdict = null;
      for (const [b, text] of runs) {
        const { record: target, pieces } = inner.piecesFor(b, text, ctx);
        if (idOf(target) !== idOf(record)) continue;
        const piece = pieces.find(p => p.ident === prop.ident && !p.guess);
        const guessed = pieces.find(p => p.ident === prop.ident && p.guess);
        if (guessed && guessVerdict !== 'wrong') { guess = guessed; guessVerdict = judge(guessed); }
        if (!piece) continue;
        if (judge(piece) === 'wrong') { verdict = 'wrong'; said = piece; break; }
        verdict = 'right'; said = piece;
      }
      if (verdict === 'silent' && guess) { verdict = guessVerdict === 'right' ? 'guessRight' : 'guessWrong'; said = guess; }
      tally[verdict]++;
      const how = said ? (said.guess ? 'guess ' : '') + said.how : null;
      if (said) byHow[how] = byHow[how] || { right: 0, wrong: 0 }, byHow[how][/right/i.test(verdict) ? 'right' : 'wrong']++;
      if (verdict === 'wrong') problem(`“${title(record)}”: ${prop.title} would be filled with ${said.shown} (${said.how}); it holds ${actual.map(name).join(', ')}`);
      else if (verdict === 'guessWrong') console.log(`  wrong guess “${title(record)}”: ${prop.title} = ${said.shown} (${said.how}); it holds ${actual.map(name).join(', ')}`);
      else if (all) console.log(`  ${verdict.padEnd(10)} “${title(record)}”: ${prop.title}${said ? ` = ${said.shown} (${how})` : ''}`);
    }
  }
  console.log(`proposals on "${GRAPH}": ${cases} filled properties hidden in turn; right ${tally.right}, wrong ${tally.wrong}; guesses right ${tally.guessRight}, wrong ${tally.guessWrong}; silent ${tally.silent}`);
  for (const [how, n] of Object.entries(byHow)) console.log(`  by ${how}: right ${n.right}, wrong ${n.wrong}`);
  // Stage D: the tag. Every record under a tag the model knows, its tags hidden; every other bullet as it is.
  const known = ctx.knownTags || new Set();
  const tags = { right: 0, wrong: 0, silent: 0, spoke: 0, quiet: 0 };
  for (const b of blocks) {
    const own = (pick(b, 'block/tags') || []).map(idOf), text = String(pick(b, 'block/title') ?? '');
    const isRecord = own.some(id => known.has(id));
    const { pieces } = inner.piecesFor(isRecord ? { ...b, 'block/tags': [] } : b, text, ctx);
    const piece = pieces.find(p => p.kind === 'tag');
    if (isRecord) {
      const verdict = !piece ? 'silent' : own.includes(piece.ids[0]) ? 'right' : 'wrong';
      tags[verdict]++;
      if (verdict === 'wrong') console.log(`  wrong tag “${title(b)}”: ${piece.shown}; it is ${own.map(name).map(n => '#' + n).join(', ')}`);
      else if (all) console.log(`  tag ${verdict.padEnd(7)} “${title(b)}”${piece ? `: ${piece.shown}` : ''}`);
    } else if (piece) { tags.spoke++; console.log(`  tag on a plain note “${title(b)}”: ${piece.shown}`); }
    else tags.quiet++;
  }
  console.log(`tags on "${GRAPH}": ${tags.right + tags.wrong + tags.silent} records with the tag hidden; right ${tags.right}, wrong ${tags.wrong}, silent ${tags.silent}; ${tags.spoke + tags.quiet} other bullets: a tag proposed on ${tags.spoke}, none on ${tags.quiet}`);
  if (tags.wrong > TAG_WRONG_LIMIT) problem(`wrong tags: ${tags.wrong}, over the limit of ${TAG_WRONG_LIMIT}`);
  if (tags.right < TAG_RIGHT_LEAST) problem(`right tags: ${tags.right}, under the least of ${TAG_RIGHT_LEAST}`);
  if (tags.spoke > PLAIN_SPOKE_LIMIT) problem(`a tag proposed on ${tags.spoke} plain notes, over the limit of ${PLAIN_SPOKE_LIMIT}`);
  if (tally.wrong > WRONG_LIMIT) problem(`wrong proposals: ${tally.wrong}, over the limit of ${WRONG_LIMIT}`);
  if (tally.right < RIGHT_LEAST) problem(`right proposals: ${tally.right}, under the least of ${RIGHT_LEAST}; the rules have stopped firing`);
  if (tally.guessWrong > GUESS_WRONG_LIMIT) problem(`wrong guesses: ${tally.guessWrong}, over the limit of ${GUESS_WRONG_LIMIT}`);
  if (tally.guessRight < GUESS_RIGHT_LEAST) problem(`right guesses: ${tally.guessRight}, under the least of ${GUESS_RIGHT_LEAST}; the guesses have stopped firing`);
  if (problems.length) { console.log(`proposals check: FAILED (${problems.length})`); process.exit(1); }
  console.log('proposals check: OK');
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
