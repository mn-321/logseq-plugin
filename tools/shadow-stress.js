#!/usr/bin/env node
/* Stress test of the proposals' readers (parts/shadow.js) in a pretend window (2026-10-21, at the owner's word:
   "stress test them, both if they can work and timing"):
   1. tricky words: sentences a reader could get wrong, each with what must and must not be proposed;
   2. random text: thousands of made-up bullets of brackets, tags, digits, months and odd letters, which must never
      stop the plugin and must each be read quickly;
   3. a large pretend graph (20,000 pages, 50,000 earlier lines): the index and the work per key while a sentence is
      typed a letter at a time.
   The real graph's own costs (Logseq's look-ups) are measured by tools/shadow-check.js --timing on a large scratch
   graph made from test/stress-graph.py.
   Needs node and jsdom. Run from the repo root: node tools/shadow-stress.js */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const problems = [];
const problem = text => { problems.push(text); console.log('PROBLEM: ' + text); };
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', runScripts: 'outside-only' });
const { window } = dom;
window.parent = window;
window.logseq = { settings: {}, updateSettings() {}, onSettingsChanged: () => () => {}, App: {}, UI: {}, Editor: {}, DB: { onChanged: () => () => {} } };
for (const file of ['parts/shared.js', 'parts/model.js', 'parts/alike.js', 'parts/shadow.js']) window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
const core = window.refinementCore = { watchDomEarly() {}, dsQuery: async () => [], graphWide: (n, load) => load(), UUID: /^[0-9a-f-]{36}$/i, sendStyle() {}, provided: {},
  provide: things => Object.assign(core.provided, things) };
const parts = Object.fromEntries(window.refinementParts.map(p => [p.name, p]));
parts.model.provide(core); parts.model.start(); parts.alike.provide(core);
Object.assign(core, { propSchema: async () => null, propPages: async () => [] });
parts.proposals.start();
const { piecesFor, addHistory } = window.refinementShadowInner;
const ms = t => Number(process.hrtime.bigint() - t) / 1e6;
const spread = list => { const a = [...list].sort((x, y) => x - y), at = q => a[Math.min(a.length - 1, Math.floor(q * a.length))]; return `median ${at(.5).toFixed(2)} ms, 95th ${at(.95).toFixed(2)} ms, slowest ${a[a.length - 1].toFixed(2)} ms`; };

/* A pretend graph shaped like the Illness Test Graph. */
function graph({ pages: nPages = 0, lines = 0 } = {}) {
  const T = { occurrence: 1, consultation: 2, log: 3, treatment: 4, expectation: 5, person: 6, doctor: 7, symptom: 8, agent: 9 };
  const prop = (id, title, type, classes = [], many = false) => ({ id, ident: 'user.property/' + title.replace(/\W/g, '-').toLowerCase(), title, lower: title.toLowerCase(), type, many, classes: classes.map(c => ({ id: c, uuid: 'tag-' + c, title: 'Tag ' + c })) });
  const props = [prop(20, 'Date', 'date'), prop(21, 'Provider', 'node', [T.doctor]), prop(22, 'Symptom type', 'node', [T.symptom]), prop(23, 'Severity', 'number'),
    prop(24, 'Agent', 'node', [T.agent], true), prop(25, 'Cycle', 'number'), prop(26, 'Status', 'default')];
  const schema = { props, byId: new Map(props.map(p => [p.id, p])),
    classProps: new Map([[T.occurrence, [20]], [T.consultation, [21]], [T.log, [22, 23]], [T.treatment, [24, 25]], [T.expectation, [26]]]),
    parentsOf: new Map([[T.consultation, [T.occurrence]], [T.log, [T.occurrence]], [T.treatment, [T.occurrence]], [T.expectation, [T.occurrence]], [T.doctor, [T.person]]]) };
  const tagPage = (id, title) => ({ id, uuid: 'tag-' + id, title, lower: title.toLowerCase(), tags: [{ id: 999, title: 'Tag', ident: 'logseq.class/Tag' }], isTag: true });
  const page = (id, title, tag) => ({ id, uuid: 'page-' + id, title, lower: title.toLowerCase(), tags: tag ? [{ id: tag, title: 'Tag ' + tag, ident: 'user.class/t' + tag }] : [], isTag: false });
  const pages = [tagPage(T.consultation, 'Consultation'), tagPage(T.log, 'Symptom Log'), tagPage(T.treatment, 'Treatment'), tagPage(T.expectation, 'Expectation'),
    tagPage(T.doctor, 'Doctor'), tagPage(T.symptom, 'Symptom'), tagPage(T.agent, 'Pharmacological Agent'),
    page(100, 'Dr. Mei Chen', T.doctor), page(101, 'Dr. Raj Patel', T.doctor), page(102, 'Fatigue', T.symptom), page(103, 'Nausea', T.symptom), page(104, 'Oxaliplatin', T.agent),
    page(105, 'May Fair', null), page(106, 'Dr. Ana Chen', T.doctor)];
  const FIRST = ['Anna', 'Ben', 'Chloe', 'David', 'Ella', 'Farid', 'Grace', 'Hugo', 'Ines', 'Jamal'], LAST = ['Adams', 'Baker', 'Chen', 'Diaz', 'Evans', 'Fischer', 'Garcia', 'Hughes', 'Ito', 'Jones'];
  for (let i = 0; i < nPages; i++) pages.push(page(1000 + i, i % 3 ? `Page ${i} ${LAST[i % 10]}` : `Dr. ${FIRST[i % 10]} ${LAST[(i / 10 | 0) % 10]} ${i}`, i % 3 ? null : T.doctor));
  const byKey = new Map(), byId = new Map();
  for (const p of pages) { byKey.set(p.lower, p); byKey.set(p.uuid, p); byId.set(p.id, p); }
  const days = new Map([[300, 20261020], [301, 20261021]]);
  const ctx = { schema, pages, byKey, byId, tagNames: pages.filter(p => p.isTag).map(p => p.lower).sort((a, b) => b.length - a.length), days,
    dated: new Map([[T.log, { same: 30, other: 0 }], [T.treatment, { same: 8, other: 0 }], [T.consultation, { same: 9, other: 1 }], [T.expectation, { same: 0, other: 12 }]]),
    aliases: [], knownTags: new Set([T.consultation, T.log, T.treatment, T.expectation]) };
  const entries = [
    { id: 500, title: 'Tired by evening.', tags: [T.log], values: new Map([['user.property/symptom-type', [102]]]) },
    { id: 501, title: 'Wiped out all day.', tags: [T.log], values: new Map([['user.property/symptom-type', [102]]]) },
    { id: 502, title: 'Flagging again by teatime.', tags: [T.log], values: new Map([['user.property/symptom-type', [102]]]) },
    { id: 503, title: 'Queasy after lunch.', tags: [T.log], values: new Map([['user.property/symptom-type', [103]]]) },
    { id: 504, title: 'Queasy all evening, could not eat.', tags: [T.log], values: new Map([['user.property/symptom-type', [103]]]) }];
  const VOCAB = Array.from({ length: 4000 }, (_, i) => 'w' + i.toString(36));
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < lines; i++) {
    const words = Array.from({ length: 4 + (rnd() * 8 | 0) }, () => VOCAB[(rnd() ** 2 * VOCAB.length) | 0]).join(' ');
    const tag = [T.log, T.consultation, T.treatment, T.expectation][i % 4];
    entries.push({ id: 10000 + i, title: words, links: rnd() < .3 ? [1000 + (rnd() * Math.max(1, nPages) | 0)] : [], tags: [tag],
      values: new Map(tag === T.log ? [['user.property/symptom-type', [102 + (i % 2)]]] : tag === T.consultation ? [['user.property/provider', [100 + (i % 2)]]] : []) });
  }
  return { T, ctx, entries };
}
const journal = (day = 20261020, id = 300) => ({ 'db/id': id, 'block/uuid': 'j-' + id, 'block/title': 'a day', 'block/journal-day': day, 'block/tags': [] });
let n = 0;
const bullet = (tags, extra = {}) => ({ 'db/id': 2000 + n++, 'block/uuid': 'b-' + n, 'block/title': '', 'block/tags': tags.map(t => ({ 'db/id': t })), 'block/page': journal(), ...extra });
const shown = pieces => pieces.map(p => `${p.prop.title}=${p.shown}${p.guess ? '?' : ''}`).join(' · ') || '(nothing)';

/* 1. Tricky words. */
console.log('1. tricky words');
const small = graph();
const t0 = process.hrtime.bigint();
addHistory(small.ctx, small.entries);
const { T } = small;
const cases = [
  // Dates. Oct 20th, 2026 is a Tuesday; an expectation's date is never the journal day.
  ['a weekday', [T.expectation], 'Scan on Friday', 'Date=Oct 23?'],
  ['the same weekday as today: next week', [T.expectation], 'Scan on Tuesday', 'Date=Oct 27?'],
  ['"Friday the 23rd", both the same day', [T.expectation], 'Scan on Friday the 23rd', 'Date=Oct 23?'],
  ['"Friday the 13th", not the same day: nothing', [T.expectation], 'Scan on Friday the 13th', '(nothing)'],
  ['"the 31st" in a month of 30 days: the next 31st', [T.expectation], 'Scan on the 31st', 'Date=Oct 31?'],
  ['a floor is not a date', [T.expectation], 'Ward on the 2nd floor', '(nothing)'],
  ['"the 4th of December" is in December', [T.expectation], 'Operation on the 4th of December', 'Date=Dec 4?'],
  ['a word starting like a month is not one: "5 marathons"', [T.expectation], 'Ran 5 marathons before all this', '(nothing)'],
  ['"3 junior doctors" is not June', [T.expectation], 'Seen by 3 junior doctors', '(nothing)'],
  ['"may" the verb', [T.expectation], 'I may go on Friday', 'Date=Oct 23?'],
  ['"4 May" the month', [T.expectation], 'Bloods 4 May', 'Date=May 4?'],
  ['"Feb 30" does not exist', [T.expectation], 'Scan Feb 30', '(nothing)'],
  ['"in a fortnight"', [T.expectation], 'Review in a fortnight', 'Date=Nov 3?'],
  ['a time is not a day: "at 4"', [T.expectation], 'Scan at 4', '(nothing)'],
  ['"Sat with" is not Saturday', [T.expectation], 'Sat with Dr. Chen about the scan', '(nothing)'],
  ['"Sun was out" is not Sunday', [T.expectation], 'Sun was out, scan went fine', '(nothing)'],
  ['"on sat" is Saturday', [T.expectation], 'Scan on sat', 'Date=Oct 24?'],
  ['"Dose 4 may" is the verb', [T.expectation], 'Dose 4 may need lowering', '(nothing)'],
  ['"4 May at 9" is the month', [T.expectation], 'Bloods 4 May at 9', 'Date=May 4?'],
  ['"next week" is not one day: nothing', [T.expectation], 'Scan next week', '(nothing)'],
  ['a date in a link\'s name: "[[May Fair]]"', [T.expectation], 'Stall at [[May Fair]] on Friday', 'Date=Oct 23?'],
  // Numbers.
  // Treatments here have 8 nodes all dated the day written: the day is sure.
  ['a cycle number', [T.treatment], 'Chemo cycle 5 done', 'Date=Oct 20 · Cycle=5?'],
  ['a cycle number at the end of a sentence', [T.treatment], 'Chemo cycle 5.', 'Date=Oct 20 · Cycle=5?'],
  ['a cycle number with a point', [T.treatment], 'Dose at cycle 2.5 then', 'Date=Oct 20 · Cycle=2.5?'],
  ['"cycle 5 of 8"', [T.treatment], 'Chemo cycle 5 of 8', 'Date=Oct 20 · Cycle=5?'],
  ['"recycle 3" is not a cycle', [T.treatment], 'Put out the recycle 3 times', 'Date=Oct 20'],
  ['a severity "7/10" is not written beside its name: nothing', [T.log], 'Pain 7/10 tonight', 'Date=Oct 20'],
  ['"severity 3" (and Nausea named in plain words)', [T.log], 'Nausea, severity 3', 'Date=Oct 20 · Symptom type=Nausea? · Severity=3?'],
  ['"cycles 3 and 4": two numbers, nothing', [T.treatment], 'Cycles 3 and 4 moved', 'Date=Oct 20'],
  // Links and names. Consultations here are dated the day written 9 times in 10: under the bar for sure, so a guess.
  ['one doctor linked', [T.consultation], 'Saw [[Dr. Mei Chen]]', 'Provider=Dr. Mei Chen · Date=Oct 20?'],
  ['two doctors for one provider: quiet', [T.consultation], 'Saw [[Dr. Mei Chen]] and [[Dr. Raj Patel]]', 'Date=Oct 20?'],
  ['"Dr. Chen" with two Chens: nobody', [T.consultation], 'Saw Dr. Chen', 'Date=Oct 20?'],
  ['"Dr. Patel" alone: him', [T.consultation], 'Saw Dr. Patel', 'Provider=Dr. Raj Patel? · Date=Oct 20?'],
  ['a half-typed link', [T.consultation], 'Saw [[Dr. Me', 'Date=Oct 20?'],
  ['an empty link', [T.consultation], 'Saw [[]] today', 'Date=Oct 20?'],
  ['a link to a page that does not exist', [T.consultation], 'Saw [[Dr. Nobody]]', 'Date=Oct 20?'],
  ['a later date in a consultation\'s words is not its date', [T.consultation], 'Post-op check, I can drive in two weeks', 'Date=Oct 20?'],
  // The engine.
  ['the lines it looks like', [T.log], 'Flagging by teatime again', 'Date=Oct 20 · Symptom type=Fatigue?'],
  ['words seen with two values: nothing', [T.log], 'Tired and queasy', 'Date=Oct 20'],
  ['an untagged bullet like the logs', [], 'Queasy again after lunch', 'Tags=#Symptom Log? · Date=Oct 20? · Symptom type=Nausea?'],
  ['an untagged ordinary line', [], 'Weeded the front bed', '(nothing)'],
];
let wrong = 0;
for (const [name, tags, text, want] of cases) {
  let got;
  try { got = shown(piecesFor(bullet(tags), text, small.ctx).pieces); } catch (error) { got = 'STOPPED: ' + error.message; }
  if (got !== want) { wrong++; problem(`tricky words, ${name}: “${text}” proposed ${got}; wanted ${want}`); }
}
console.log(`  ${cases.length - wrong} of ${cases.length} as wanted (${ms(t0).toFixed(0)} ms)`);

/* 2. Random text. */
console.log('2. random text');
const PIECES = ['[[', ']]', '#', '#[[', 'Dr. ', 'Chen', 'Mei', 'cycle', 'severity', ' ', ' ', ' ', '5', '31', 'the ', 'on ', 'Friday', 'May', 'mar', 'Feb', '4th', '2026-13-45',
  'next', 'in', 'two', 'weeks', ',', '.', '/', '(', ')', '\\', '$', '^', '*', '+', '?', '|', '{', '}', 'é', 'ß', '中文', 'ﷺ', '😀', '​', '\n', 'tomorrow', 'Queasy', 'Tired'];
let seed = 3; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const fuzzTimes = []; let stopped = 0;
const tagSets = [[], [T.log], [T.consultation], [T.treatment], [T.expectation], [T.log, T.treatment]];
for (let i = 0; i < 20000; i++) {
  const text = Array.from({ length: 1 + (rnd() * 30 | 0) }, () => PIECES[rnd() * PIECES.length | 0]).join('');
  const t = process.hrtime.bigint();
  try { piecesFor(bullet(tagSets[i % tagSets.length]), text, small.ctx); } catch (error) { if (stopped++ < 5) problem(`random text stopped the plugin: ${JSON.stringify(text)}: ${error.message}`); }
  fuzzTimes.push(ms(t));
}
const long = 'Queasy after lunch and tired by evening, '.repeat(250) + 'cycle 5 on Friday the 23rd';
let tLong = process.hrtime.bigint(); piecesFor(bullet([T.log]), long, small.ctx); tLong = ms(tLong);
console.log(`  20,000 random bullets: ${stopped} stopped the plugin; ${spread(fuzzTimes)}`);
console.log(`  a bullet of 10,000 letters: ${tLong.toFixed(2)} ms`);
if (tLong > 50) problem(`a bullet of 10,000 letters took ${tLong.toFixed(0)} ms (limit 50)`);

/* 3. A large pretend graph. */
console.log('3. a large pretend graph (20,000 pages, 50,000 earlier lines)');
const big = graph({ pages: 20000, lines: 50000 });
let t = process.hrtime.bigint(); addHistory(big.ctx, big.entries); const tIndex = ms(t);
console.log(`  the index of earlier lines: ${tIndex.toFixed(0)} ms (once each time the earlier lines are read, at most every 5 minutes, never waited for while typing)`);
if (tIndex > 500) problem(`the index took ${tIndex.toFixed(0)} ms on 50,000 lines (limit 500)`);
t = process.hrtime.bigint(); piecesFor(bullet([T.consultation]), 'Saw Dr. Grace Chen', big.ctx); const tNames = ms(t);
console.log(`  the first key after that (the names of 20,000 pages are gathered once): ${tNames.toFixed(0)} ms`);
if (tNames > 500) problem(`gathering the names took ${tNames.toFixed(0)} ms (limit 500)`);
const sentences = [[[T.consultation], 'Saw [[Dr. Mei Chen]] about the w1 w2 on Friday, then rang Dr. Grace Chen 30 and w3 w4 w5'],
  [[T.log], 'Queasy after lunch and w1 w2 w3 w4 w5 w6 w7 w8 w9 wa wb wc tired by evening'],
  [[], 'w1 w2 w3 w4 w5 w6 w7 w8 w9 wa wb wc wd we wf wg queasy after lunch'],
  [[T.treatment], 'Oxaliplatin cycle 5 done, w1 w2 w3 next Tuesday']];
for (const [tags, sentence] of sentences) {
  const times = [], b = bullet(tags);
  for (let i = 1; i <= sentence.length; i++) { const tk = process.hrtime.bigint(); piecesFor(b, sentence.slice(0, i), big.ctx); times.push(ms(tk)); }
  console.log(`  typed a letter at a time, ${tags.length ? 'tagged' : 'untagged'} “${sentence.slice(0, 32)}…”: ${spread(times)}`);
  const sorted = [...times].sort((x, y) => x - y);
  if (sorted[Math.floor(.95 * sorted.length)] > 16) problem(`a key took more than a screen frame (16 ms) for 1 in 20 keys on the large graph: “${sentence.slice(0, 32)}…”`);
}

if (problems.length) { console.log(`shadow-stress: FAILED (${problems.length})`); process.exit(1); }
console.log('shadow-stress: OK');
