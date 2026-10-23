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
     node tools/shadow-check.js --honest also the honest score (2026-10-21): the "looks like" engine knows only the lines
                                         written on earlier days, as it would have when the record was written, and
                                         the score is given month by month (how it learns)
     node tools/shadow-check.js --timing also how long each part takes (2026-10-21): Logseq's look-ups through the
                                         command line (less one empty question, the command line's own cost), the
                                         plugin's index of earlier lines, and the plugin's own work per key
                                         (piecesFor), as the median, the 95th in a hundred and the slowest
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
// 45 since 2026-10-21: the owner's own edits in the Illness Test Graph (a consultation dated another day) move some
// dates from sure to guesses.
const WRONG_LIMIT = 0, RIGHT_LEAST = 45;
// Guesses (0.4.200), on the same graph: right 19 (15 from earlier lines like it, 4 from plain words), wrong 1 (“about
// the tingling” guesses Tingling fingers as the Topic, which holds Peripheral neuropathy); silent went from 46 to 26.
const GUESS_WRONG_LIMIT = 1, GUESS_RIGHT_LEAST = 15;
// Choices (0.4.265, Status): counted on their own. On the test graph at 0.4.265: right 7, wrong 2, both expectations
// written as Planned that have happened since (Done now): Planned was right when they were written, and a choice like
// Status changes with time, which hiding today's value cannot tell. Two such misses are let through.
const CHOICE_WRONG_LIMIT = 2;
// Stage D (0.4.213): every record's tag hidden in turn, and every plain note (no tag, no record above) must get none.
// On the seed graph at 0.4.213: right 22, wrong 0, silent 34 of 56; one plain note ("Blood again this morning. Third
// time this month.", left untagged in the seed on purpose) is offered #Symptom Log, which is the feature working.
const TAG_WRONG_LIMIT = 0, TAG_RIGHT_LEAST = 15, PLAIN_SPOKE_LIMIT = 1;
// --why: what pointing at each guess says (0.4.266).
const all = process.argv.includes('--all'), honest = process.argv.includes('--honest'), timing = process.argv.includes('--timing');
const ms = t => Number(process.hrtime.bigint() - t) / 1e6;
const spread = list => { const a = [...list].sort((x, y) => x - y), at = q => a[Math.min(a.length - 1, Math.floor(q * a.length))]; return a.length ? `median ${at(.5).toFixed(2)} ms, 95th ${at(.95).toFixed(2)} ms, slowest ${a[a.length - 1].toFixed(2)} ms (${a.length} runs)` : 'no runs'; };
const askTimes = [];
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch { console.log('proposals check skipped (needs jsdom)'); process.exit(0); }
if (!fs.existsSync(CLI)) { console.log('proposals check skipped (no Logseq command line)'); process.exit(0); }

let queue = Promise.resolve();
const ask = query => (queue = queue.catch(() => {}).then(async () => { const t = process.hrtime.bigint(); const out = await askNow(query); askTimes.push({ query: query.replace(/\s+/g, ' ').slice(0, 70), ms: ms(t), worker: lastWorker, rows: out?.length ?? 0 }); return out; }));
// With --profile the command line says on its error stream how long the graph's own worker took to answer
// ("transport.invoke:thread-api/q"), which is the cost the app pays for the same question.
let lastWorker = 0;
const askNow = query => new Promise((resolve, reject) => execFile(CLI, ['query', '-g', GRAPH, '-o', 'json', '--timeout-ms', '120000', '--profile', '--query', query],
  { encoding: 'utf8', maxBuffer: 1 << 29, timeout: 180000 }, (error, stdout, stderr) => {
    if (error) return reject(new Error(String(stdout || error.message).slice(0, 300)));
    const out = JSON.parse(stdout);
    if (out.status !== 'ok') return reject(new Error('the command line said: ' + stdout.slice(0, 300)));
    lastWorker = Number((String(stderr).match(/(\d+)ms\s+\S+\s+transport\.invoke/) || [])[1] ?? NaN);
    resolve(out.data.result);
  }));
const problems = [];
const problem = text => { problems.push(text); console.log('PROBLEM: ' + text); };

async function plugin() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.parent = window;
  window.logseq = { settings: { shadowProposals: true, shadowSkipGraphs: '' }, updateSettings() {}, onSettingsChanged: () => () => {},
    App: { getCurrentGraph: async () => ({ name: GRAPH }), getUserConfigs: async () => ({}) }, UI: { showMsg() {} }, Editor: {}, DB: { onChanged: () => () => {} } };
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  window.eval(read('parts/shared.js'));
  window.eval(read('parts/model.js'));
  window.eval(read('parts/alike.js'));
  for (const file of ['parts/shadow-rules.js', 'parts/shadow.js', 'parts/shadow-steps.js', 'parts/shadow-page.js']) window.eval(read(file));
  const cache = new Map();
  const core = { onPageChange() {}, onGraphChange(fn) { window.graphChanged = fn; }, onDatabaseChange() {}, onSettingsChange() {}, screen: window.refinementShared.screen, host: () => window.document, watchDomEarly() {}, dsQuery: ask, graphWide: (name, load) => { if (!cache.has(name)) cache.set(name, load()); return cache.get(name); },
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
  if (env.ALIKE_TAG_LINKS) limits.tagLinks = env.ALIKE_TAG_LINKS !== '0';
  console.log(`looks-like limits: k ${limits.k}, nearest at least ${limits.nearLeast}, lead ${limits.lead}, stem ${limits.stem}; tag: nearest at least ${limits.tagNearLeast}, lead ${limits.tagLead}, agreeing at least ${limits.tagLeast}`);
  parts.proposals.provide(core);
  parts.proposals.start();
  return window.refinementCore.provided.proposalsInner;
}

(async () => {
  const servers = await new Promise(resolve => execFile(CLI, ['server', 'list', '-o', 'json'], { encoding: 'utf8', timeout: 30000 },
    (error, stdout) => { try { resolve(JSON.parse(stdout).data.servers || []); } catch { resolve([]); } }));
  if (!servers.some(s => s.graph === GRAPH && s.status === 'ready' && (s['owner-source'] === 'electron' || process.env.OWNER === 'any'))) { console.log(`proposals check skipped (the app does not have "${GRAPH}" open)`); process.exit(0); }
  const inner = await plugin();
  let t = process.hrtime.bigint();
  await ask('[:find ?e :where [?e :db/ident :logseq.class/Tag]]');
  const empty = Math.min(...askTimes.slice(-1).map(a => a.ms), ms(t));
  // The smallest question's worker time: the command line's own way in and out (its web call, the JSON), not the graph.
  const transport = [];
  for (let i = 0; i < 5; i++) { await ask('[:find ?e :where [?e :db/ident :logseq.class/Tag]]'); transport.push(lastWorker); }
  askTimes.length = 0;
  t = process.hrtime.bigint();
  const ctx0 = await inner.contextFor();
  const tContext = ms(t); t = process.hrtime.bigint();
  await inner.daysFor(ctx0);
  const tDays = ms(t); t = process.hrtime.bigint();
  const ctx = await inner.guessDataFor(ctx0);
  const tGuess = ms(t);
  const looks = [...askTimes];
  let tIndex = 0;
  if (timing) { const c = { ...ctx }; const t2 = process.hrtime.bigint(); inner.addHistory(c, inner.guessData().entries); tIndex = ms(t2); }
  const keyTimes = [], tagTimes = [];
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
  // A number property's value is an entity holding the number (Logseq's own shape, found by the scorer at 0.4.214).
  const numberOf = new Map((await ask('[:find ?e ?v :where [?e :logseq.property/value ?v]]')).map(([e, v]) => [Number(e), Number(v)]));
  const choiceTitle = new Map(ctx.schema.props.flatMap(p => (p.choices || []).map(c => [c.id, c.title])));
  const name = id => byId.get(id)?.title || choiceTitle.get(id) || (ctx.days.get(id) ? 'the day ' + ctx.days.get(id) : numberOf.has(id) ? String(numberOf.get(id)) : String(id));
  const tally = { right: 0, wrong: 0, silent: 0, guessRight: 0, guessWrong: 0 }, byHow = {};
  const fields = (tagIds) => { const seen = new Set(), out = [], q = [...tagIds]; while (q.length) { const c = q.shift(); if (seen.has(c)) continue; seen.add(c); for (const p of schema.classProps.get(c) || []) { const prop = schema.byId.get(p); if (prop && !out.includes(prop)) out.push(prop); } q.push(...(schema.parentsOf.get(c) || [])); } return out; };
  let cases = 0;
  // The honest score: each record judged with the engine's index built from the lines written on earlier days only (a
  // line on a page that is not a journal counts as known: it has no day).
  const dayOf = new Map((await ask('[:find ?b ?d :where [?b :block/page ?p] [?p :block/journal-day ?d]]')).map(([b, d]) => [Number(b), Number(d)]));
  const allEntries = inner.guessData()?.entries || [];
  const knownBefore = new Map();
  const ctxFor = record => {
    if (!honest) return ctx;
    const day = dayOf.get(idOf(record)) || 99999999;
    // One index kept at a time, the records taken in order of their day (on the large graph an index for every day
    // would not fit in memory).
    if (!knownBefore.has(day)) { knownBefore.clear(); const c = { ...ctx }; inner.addHistory(c, allEntries.filter(e => (dayOf.get(e.id) || 0) < day)); knownBefore.set(day, c); }
    return knownBefore.get(day);
  };
  if (honest) blocks.sort((a, b) => (dayOf.get(idOf(a)) || 99999999) - (dayOf.get(idOf(b)) || 99999999));
  const byMonth = new Map();
  const month = record => { const d = dayOf.get(idOf(record)); return d ? String(d).slice(0, 6) : 'other'; };
  const countMonth = (record, verdict) => { const m = month(record); const t = byMonth.get(m) || { right: 0, wrong: 0, silent: 0, guessRight: 0, guessWrong: 0 }; t[verdict]++; byMonth.set(m, t); };
  for (const record of blocks) {
    const tags = (pick(record, 'block/tags') || []).map(idOf);
    const props = fields(tags).filter(p => (p.type === 'node' && p.classes.length) || (p.type === 'date' && p.lower === 'date') || p.type === 'number' || (p.type !== 'node' && p.choices?.length > 0));
    for (const prop of props) {
      const actual = valuesOf(record, prop.ident);
      if (!actual.length) continue;
      cases++;
      const hidden = hide(record, prop.ident);
      // The record's own words, then each note under it (its parent being the record with the property hidden).
      const runs = [[hidden, String(pick(record, 'block/title') ?? '')]];
      for (const child of childrenOf.get(idOf(record)) || []) runs.push([{ ...child, 'block/parent': hidden }, String(pick(child, 'block/title') ?? '')]);
      // A property that holds several: a proposal that is part of them is right (the rest is still to add).
      const judge = piece => piece.kind === 'number' ? (actual.length === 1 && numberOf.get(actual[0]) === piece.ids[0] ? 'right' : 'wrong')
        : piece.ids.every(id => actual.includes(id)) && (prop.many || piece.ids.length === actual.length) ? 'right' : 'wrong';
      let verdict = 'silent', said = null, guess = null, guessVerdict = null;
      for (const [b, text] of runs) {
        const tk = process.hrtime.bigint();
        const { record: target, pieces } = inner.piecesFor(b, text, ctxFor(record));
        keyTimes.push(ms(tk));
        if (idOf(target) !== idOf(record)) continue;
        const piece = pieces.find(p => p.ident === prop.ident && !p.guess);
        const guessed = pieces.find(p => p.ident === prop.ident && p.guess);
        if (guessed && guessVerdict !== 'wrong') { guess = guessed; guessVerdict = judge(guessed); }
        if (!piece) continue;
        if (judge(piece) === 'wrong') { verdict = 'wrong'; said = piece; break; }
        verdict = 'right'; said = piece;
      }
      if (verdict === 'silent' && guess) { verdict = guessVerdict === 'right' ? 'guessRight' : 'guessWrong'; said = guess; }
      if (verdict === 'guessWrong' && said?.kind === 'choice') tally.choiceWrong = (tally.choiceWrong || 0) + 1;
      tally[verdict]++;
      countMonth(record, verdict);
      const how = said ? (said.guess ? 'guess ' : '') + said.how : null;
      if (said) byHow[how] = byHow[how] || { right: 0, wrong: 0 }, byHow[how][/right/i.test(verdict) ? 'right' : 'wrong']++;
      if (verdict === 'wrong') problem(`“${title(record)}”: ${prop.title} would be filled with ${said.shown} (${said.how}); it holds ${actual.map(name).join(', ')}`);
      else if (verdict === 'guessWrong') console.log(`  wrong guess “${title(record)}”: ${prop.title} = ${said.shown} (${said.how}); it holds ${actual.map(name).join(', ')}`);
      else if (all) console.log(`  ${verdict.padEnd(10)} “${title(record)}”: ${prop.title}${said ? ` = ${said.shown} (${how})` : ''}`);
      if (process.argv.includes('--why') && said?.guess) console.log(`  why “${title(record)}” ${prop.title} = ${said.shown}: ${inner.reasonOf(said)}`);
    }
  }
  console.log(`proposals on "${GRAPH}": ${cases} filled properties hidden in turn; right ${tally.right}, wrong ${tally.wrong}; guesses right ${tally.guessRight}, wrong ${tally.guessWrong}; silent ${tally.silent}`);
  for (const [how, n] of Object.entries(byHow)) console.log(`  by ${how}: right ${n.right}, wrong ${n.wrong}`);
  if (honest) for (const [m, t] of [...byMonth].sort()) console.log(`  month ${m}: sure right ${t.right}, wrong ${t.wrong}; guesses right ${t.guessRight}, wrong ${t.guessWrong}; silent ${t.silent}`);
  // Stage D: the tag. Every record under a tag the model knows, its tags hidden; every other bullet as it is.
  const known = ctx.knownTags || new Set();
  const tags = { right: 0, wrong: 0, silent: 0, spoke: 0, quiet: 0 };
  for (const b of blocks) {
    const own = (pick(b, 'block/tags') || []).map(idOf), text = String(pick(b, 'block/title') ?? '');
    const isRecord = own.some(id => known.has(id));
    const tk = process.hrtime.bigint();
    const { pieces } = inner.piecesFor(isRecord ? { ...b, 'block/tags': [] } : b, text, ctxFor(b));
    tagTimes.push(ms(tk));
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
  if (timing) {
    console.log(`timings on "${GRAPH}" (${blocks.length} bullets with words, ${inner.guessData()?.entries.length ?? 0} lines under tags known to the engine):`);
    console.log(`  an empty question through the command line: ${empty.toFixed(0)} ms in all (starting the command line is most of it); in the worker: ${spread(transport)}, the way in and out, which the app does not pay the same way`);
    for (const a of looks) console.log(`  look-up ${String(a.worker).padStart(6)} ms in Logseq's worker, ${String(a.rows).padStart(6)} rows: ${a.query}`);
    // The two look-ups made on every key while a bullet is written: the bullet itself, and the pages linked in its words.
    const perKey = { bullet: [], links: [] };
    for (const b of blocks.filter(x => /\[\[/.test(String(pick(x, 'block/title') ?? ''))).slice(0, 12)) {
      const uuid = String(pick(b, 'block/uuid'));
      await ask(`[:find (pull ?b ${inner.BLOCK_PULL}) :where [?b :block/uuid #uuid "${uuid}"]]`); perKey.bullet.push(lastWorker);
      const names = [...String(title(b)).matchAll(/\[\[([^\[\]]+)\]\]/g)].map(m => JSON.stringify(m[1].trim().toLowerCase()));
      await ask(`[:find (pull ?p [:db/id :block/uuid :block/title {:block/tags [:db/id :block/title :db/ident]}]) :where [(ground [${names.join(' ')}]) [?n ...]] [?p :block/name ?n] (not [?p :block/tags :logseq.class/Property]) (not [?p :block/journal-day _])]`); perKey.links.push(lastWorker);
    }
    console.log(`  on every key, the bullet itself, in Logseq's worker: ${spread(perKey.bullet)}`);
    console.log(`  on every key with a link, the linked pages, in Logseq's worker: ${spread(perKey.links)}`);
    console.log(`  read on start (pages and properties ${tContext.toFixed(0)} ms, days ${tDays.toFixed(0)} ms, earlier lines ${tGuess.toFixed(0)} ms), command line's cost included`);
    console.log(`  the index of earlier lines, built in the plugin: ${tIndex.toFixed(1)} ms`);
    console.log(`  the plugin's work per key, a tagged bullet: ${spread(keyTimes)}`);
    console.log(`  the plugin's work per key, an untagged bullet (the tag is looked for): ${spread(tagTimes)}`);
  }
  // On a large graph, a wrong tag in a thousand, and a tag on a plain note in a thousand.
  const tagLimit = Math.max(TAG_WRONG_LIMIT, Math.floor((tags.right + tags.wrong) / 1000)), plainLimit = Math.max(PLAIN_SPOKE_LIMIT, Math.floor((tags.spoke + tags.quiet) / 1000));
  if (tags.wrong > tagLimit) problem(`wrong tags: ${tags.wrong}, over the limit of ${tagLimit}`);
  if (tags.right < TAG_RIGHT_LEAST) problem(`right tags: ${tags.right}, under the least of ${TAG_RIGHT_LEAST}`);
  if (tags.spoke > plainLimit) problem(`a tag proposed on ${tags.spoke} plain notes, over the limit of ${plainLimit}`);
  if (tally.wrong > WRONG_LIMIT) problem(`wrong proposals: ${tally.wrong}, over the limit of ${WRONG_LIMIT}`);
  if (tally.right < RIGHT_LEAST) problem(`right proposals: ${tally.right}, under the least of ${RIGHT_LEAST}; the rules have stopped firing`);
  // On a large graph (tools/shadow-check.js on "Stress Check") the limits are shares: a wrong guess in a hundred.
  const guessLimit = Math.max(GUESS_WRONG_LIMIT, Math.floor((tally.guessRight + tally.guessWrong) / 100));
  const choiceWrong = tally.choiceWrong || 0;
  if (choiceWrong > CHOICE_WRONG_LIMIT) problem(`wrong choice guesses: ${choiceWrong}, over the limit of ${CHOICE_WRONG_LIMIT}`);
  if (tally.guessWrong - choiceWrong > guessLimit) problem(`wrong guesses: ${tally.guessWrong - choiceWrong} (choices apart), over the limit of ${guessLimit}`);
  if (tally.guessRight < GUESS_RIGHT_LEAST) problem(`right guesses: ${tally.guessRight}, under the least of ${GUESS_RIGHT_LEAST}; the guesses have stopped firing`);
  if (problems.length) { console.log(`proposals check: FAILED (${problems.length})`); process.exit(1); }
  console.log('proposals check: OK');
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
