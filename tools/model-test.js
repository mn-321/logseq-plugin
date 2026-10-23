#!/usr/bin/env node
/* Tests the Logseq model (parts/model.js, layer 1b) without Logseq: the part is loaded on its own, with a small
   pretend graph behind a stand-in for Logseq's database. Each answer is given in the shape Logseq gives it (a
   pulled map with its keys shortened), so what is tested is what the model makes of an answer: titles, stored
   links, days typed in words, journal titles, the property schema, the pages, a record's fields, journal pages.

   What it cannot test is the query text itself: the stand-in recognises each query by its shape and answers from
   the pretend graph, so whether Logseq answers that query the same way is checked in the app (the measuring
   round in docs/NEXT.md). A query the stand-in does not recognise fails the test, so a new query is noticed.

   It also times the model's own work on a large pretend graph (20,000 pages, 300 properties), Logseq's own
   query time left out, and prints it; it fails only when that is far beyond any reasonable figure.

   Needs node only. Run from the repo root: node tools/model-test.js (tools/check.sh runs it when node is there).
   Days are tested in a time zone with summer time (Europe/London) whatever the machine's own. */
process.env.TZ = 'Europe/London';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const problems = [];
let passed = 0;
const problem = text => { problems.push(text); console.log('PROBLEM: ' + text); };
const same = (got, want, what) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) passed++; else problem(`${what}: got ${g}, want ${w}`);
};
const ymd = d => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;

/* The pretend graph. Entities by id, as Logseq stores them (only what the model reads). */
const U = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function smallGraph() {
  const e = {};
  const add = (id, fields) => { e[id] = { id, uuid: U(id), ...fields }; return e[id]; };
  // Logseq's own classes.
  add(1, { title: 'Property', ident: 'logseq.class/Property', name: 'property' });
  add(2, { title: 'Tag', ident: 'logseq.class/Tag', name: 'tag' });
  add(3, { title: 'Page', ident: 'logseq.class/Page' });
  // Tags (classes) of the owner: Person, Doctor extends Person, Meeting, Project.
  add(10, { title: 'Person', name: 'person', tags: [2], ident: 'user.class/Person' });
  add(11, { title: 'Doctor', name: 'doctor', tags: [2], ident: 'user.class/Doctor', extends: [10] });
  add(12, { title: 'Meeting', name: 'meeting', tags: [2], ident: 'user.class/Meeting' });
  add(13, { title: 'Project', name: 'project', tags: [2], ident: 'user.class/Project' });
  // Properties: the owner's (user.property/...) and the four of Logseq's a record takes; created-at is left out.
  add(20, { title: 'Deadline', ident: 'logseq.property/deadline', tags: [1], type: 'date', cardinality: 'db.cardinality/one' });
  add(21, { title: 'Status', ident: 'logseq.property/status', tags: [1], type: 'default' });
  add(22, { title: 'attendees', ident: 'user.property/attendees', tags: [1], type: 'node', cardinality: 'db.cardinality/many', classes: [10] });
  add(23, { title: 'project', ident: 'user.property/project', tags: [1], type: 'node', classes: [13] });
  add(24, { title: 'email', ident: 'user.property/email', tags: [1], type: 'url' });
  add(25, { title: 'specialty', ident: 'user.property/specialty', tags: [1] });
  add(26, { title: 'Created at', ident: 'logseq.property/created-at', tags: [1], type: 'datetime' });
  add(27, { title: '', ident: 'user.property/untitled', tags: [1] });
  // Status choices, stored out of order.
  add(30, { title: 'Done', closedFor: 21, order: 'a2' });
  add(31, { title: 'Todo', closedFor: 21, order: 'a0' });
  add(32, { title: 'Doing', closedFor: 21, order: 'a1' });
  // Which tag has which fields.
  e[10].fields = [24];
  e[11].fields = [25];
  e[12].fields = [22, 23, 20];
  // Pages.
  add(40, { title: 'Mateo Ruiz', name: 'mateo ruiz', tags: [10] });
  add(41, { title: 'Dr. Joe', name: 'dr. joe', tags: [11] });
  add(42, { title: 'Atlas', name: 'atlas', tags: [13] });
  add(43, { title: '$$$ hidden', name: '$$$ hidden' });
  add(44, { title: 'Oct 19th, 2026', name: 'oct 19th, 2026', journalDay: 20261019 });
  add(45, { title: 'Holds a link to [[' + U(40) + ']]', name: 'holds a link' });
  add(46, { title: 'Plain', name: 'plain', tags: [3] });
  add(48, { title: 'Mat', name: 'mat', tags: [3] });
  e[40].alias = [48];
  // Blocks.
  add(50, { title: 'Budget review', page: 42 });
  add(51, { title: 'Kickoff call', tags: [12], page: 44 });
  add(52, { title: 'Check-up', tags: [11], page: 44 });
  add(53, { title: 'Loop', tags: [60] });
  add(60, { title: 'A', name: 'a', tags: [2], extends: [61] });
  add(61, { title: 'B', name: 'b', tags: [2], extends: [60] });
  e[60].fields = [24]; e[61].fields = [25];
  return e;
}
// A large graph for the timing: 300 properties with choices and fields, 20,000 pages with tags.
function largeGraph() {
  const e = smallGraph();
  let id = 1000;
  const props = [];
  for (let i = 0; i < 300; i++) { const p = id++; props.push(p); e[p] = { id: p, uuid: U(p), title: `prop ${i}`, ident: `user.property/p${i}`, tags: [1], type: i % 3 ? 'default' : 'node' }; }
  for (const p of props.slice(0, 100)) for (let c = 0; c < 5; c++) { const v = id++; e[v] = { id: v, uuid: U(v), title: `choice ${c}`, closedFor: p, order: 'a' + (5 - c) }; }
  const tags = [];
  for (let t = 0; t < 200; t++) { const c = id++; tags.push(c); e[c] = { id: c, uuid: U(c), title: `Tag ${t}`, name: `tag ${t}`, tags: [2], fields: props.slice(t % 290, t % 290 + 10), extends: t ? [tags[t - 1]] : [] }; }
  for (let n = 0; n < 20000; n++) { const p = id++; e[p] = { id: p, uuid: U(p), title: `Page ${n}`, name: `page ${n}`, tags: [tags[n % 200]] }; }
  return e;
}

/* The stand-in for Logseq's datascriptQuery: it recognises each query the model sends by its shape and answers
   from the pretend graph, in Logseq's shape (pulled maps with shortened keys). */
function fakeDb(graph, log) {
  const all = () => Object.values(graph);
  const ref = id => ({ id });
  const isProperty = x => (x.tags || []).includes(1);
  const shapes = [
    [/\(pull \?p \[:db\/id :db\/ident :block\/uuid :block\/title :logseq\.property\/type :db\/cardinality :logseq\.property\/icon[\s\S]*:where \[\?p :block\/tags :logseq\.class\/Property\] \[\?p :db\/ident _\]/,
      () => all().filter(x => isProperty(x) && x.ident).map(x => [{ id: x.id, ident: ':' + x.ident, uuid: x.uuid, title: x.title,
        ...(x.type ? { type: ':' + x.type } : {}), ...(x.cardinality ? { cardinality: ':' + x.cardinality } : {}),
        ...(x.classes ? { classes: x.classes.map(c => ({ id: c, uuid: graph[c].uuid, title: graph[c].title })) } : {}) }])],
    [/:where \[\?v :block\/closed-value-property \?p\]/, () => all().filter(x => x.closedFor).map(x => [x.closedFor, { id: x.id, title: x.title, order: x.order }])],
    [/:find \?c \?p :where \[\?c :logseq\.property\.class\/properties \?p\]/, () => all().flatMap(x => (x.fields || []).map(p => [x.id, p]))],
    [/:find \?child \?parent :where \[\?child :logseq\.property\.class\/extends \?parent\]/, () => all().flatMap(x => (x.extends || []).map(p => [x.id, p]))],
    // Where a tag sits (0.4.328, tagChain): every tag with its uuid, title and ident, and every Extends.
    [/:find \?t \?u \?title \?ident :where \[\?t :block\/tags :logseq\.class\/Tag\]/, () => all().filter(x => (x.tags || []).includes(2)).map(x => [x.id, x.uuid, x.title, ':' + (x.ident || 'user.class/' + x.title)])],
    [/:find \?c \?p :where \[\?c :logseq\.property\.class\/extends \?p\]/, () => all().flatMap(x => (x.extends || []).map(p => [x.id, p]))],
    // The tags and their idents (0.4.220: which are Logseq's own).
    [/:find \?t \?i :where \[\?t :block\/tags :logseq\.class\/Tag\] \[\?t :db\/ident \?i\]/, () => all().filter(x => (x.tags || []).includes(2) && x.ident).map(x => [x.id, ':' + x.ident])],
    [/:where \[\?p :block\/name _\] \(not \[\?p :block\/tags :logseq\.class\/Property\]\) \(not \[\?p :block\/journal-day _\]\)/,
      () => all().filter(x => x.name && !isProperty(x) && !x.journalDay).map(x => [{ id: x.id, uuid: x.uuid, title: x.title,
        ...(x.tags ? { tags: x.tags.map(t => ({ id: t, title: graph[t].title, ...(graph[t].ident ? { ident: ':' + graph[t].ident } : {}) })) } : {}) }])],
    [/:find \?t :where \[\?b :block\/uuid #uuid "([^"]+)"\] \[\?b :block\/tags \?t\]/, m => { const b = all().find(x => x.uuid === m[1]); return (b?.tags || []).map(t => [t]); }],
    [/:find \?t :where \[\?p :block\/journal-day (\d+)\] \[\?p :block\/title \?t\]/, m => all().filter(x => x.journalDay === Number(m[1])).map(x => [x.title])],
    [/:find \?ident\s+:where \[\(identity (\d+)\) \?p\] \[\?p :block\/tags \?c\] \[\?c :db\/ident \?ident\]/, m => (graph[m[1]]?.tags || []).filter(t => graph[t]?.ident).map(t => [':' + graph[t].ident])],
    [/:find \?uuid \?title\s+:where \[\(identity (\d+)\) \?p\] \[\?o :block\/alias \?p\] \[\?o :block\/uuid \?uuid\] \[\?o :block\/title \?title\]/, m => all().filter(x => (x.alias || []).includes(Number(m[1]))).map(x => [x.uuid, x.title])],
    [/:find \(pull \?p \[:db\/id\]\) :where \[\?p :block\/journal-day (\d+)\]\]/, m => all().filter(x => x.journalDay === Number(m[1])).map(x => [ref(x.id)])],
  ];
  return async query => {
    for (const [shape, answer] of shapes) { const m = query.match(shape); if (m) { log.push(shape.source.slice(0, 30)); return answer(m); } }
    problem('a query the stand-in does not know (add its shape, and check it in the app): ' + query.replace(/\s+/g, ' ').slice(0, 200));
    return [];
  };
}
function fakeLogseq(graph, made, config) {
  const byUuid = uuid => Object.values(graph).find(x => x.uuid === uuid) || null;
  const entity = x => x && { id: x.id, uuid: x.uuid, title: x.title, ...(x.name ? { name: x.name, originalName: x.title } : {}) };
  return {
    settings: {},
    Editor: {
      getPage: async key => { const x = byUuid(key) || Object.values(graph).find(p => p.name === String(key).toLowerCase()); return x?.name ? entity(x) : null; },
      getBlock: async key => entity(byUuid(key)),
      createPage: async (title, props, opts) => { made.push({ title, opts }); const id = 9000 + made.length; graph[id] = { id, uuid: U(id), title, name: title.toLowerCase(), ...(opts?.journal ? { journalDay: -id } : {}) }; return { id }; },
    },
    App: { getUserConfigs: async () => { if (config.fails) throw new Error('no configs'); return { preferredDateFormat: config.format }; } },
    UI: { showMsg() {} },
  };
}

// Loads parts/shared.js and parts/model.js into a window of their own and starts the model, as the core would.
function loadModel(graph, { made = [], config = { format: 'MMM do, yyyy' }, queries = [] } = {}) {
  const logseq = fakeLogseq(graph, made, config);
  const win = { console, setTimeout, clearTimeout, Promise, Date, Map, Set, URL };
  win.window = win;
  win.parent = { document: { querySelectorAll: () => [] } };
  const document = { currentScript: null };
  for (const file of ['parts/shared.js', 'parts/model.js']) {
    const run = new Function('logseq', 'window', 'document', 'location', 'console', fs.readFileSync(path.join(root, file), 'utf8'));
    run(logseq, win, document, { href: 'file:///plugin/main.js' }, console);
  }
  const cache = new Map();
  const core = {
    provided: {}, provide: things => Object.assign(core.provided, things),
    dsQuery: fakeDb(graph, queries),
    graphWide: (name, load) => { if (!cache.has(name)) cache.set(name, Promise.resolve().then(load)); return cache.get(name); },
  };
  win.refinementCore = core;
  const part = win.refinementParts.find(p => p.name === 'model');
  part.provide(core);
  part.start();
  return { model: core.provided, made, queries, logseq };
}

async function main() {
  const graph = smallGraph();
  const { model, made, queries } = loadModel(graph);

  // Titles and links.
  same(model.titleOf({ title: '  Kickoff  ' }), 'Kickoff', 'titleOf trims');
  same(model.titleOf({ content: 'old style' }), 'old style', 'titleOf falls back to content');
  same(model.titleOf(null), '', 'titleOf of nothing');
  same('Kickoff call #meeting #[[Long tag]]'.replace(model.trailingTags, ''), 'Kickoff call', 'trailingTags finds every tag at the end');
  same('#work is the topic'.replace(model.trailingTags, ''), '#work is the topic', 'trailingTags leaves a tag that is not at the end');
  same(model.cleanTitle, undefined, 'the page-name rule is the editor part\'s, not the model\'s');
  same(await model.readableTitle(`Met [[${U(40)}]] about ((${U(50)}))`), 'Met [[Mateo Ruiz]] about Budget review', 'readableTitle swaps pages and blocks');
  same(await model.readableTitle(`Met [[${U(40)}]] about ((${U(50)}))`, { pagesOnly: true }), `Met [[Mateo Ruiz]] about ((${U(50)}))`, 'readableTitle pagesOnly leaves block references');
  same(await model.readableTitle(`See [[${U(50)}]]`, { asShown: true }), `See [[${U(50)}]]`, 'readableTitle asShown leaves a [[link]] to a block');
  same(await model.readableTitle(`See [[${U(45)}]]`), 'See [[Holds a link to [[Mateo Ruiz]]]]', 'readableTitle reads a title that holds a link');
  same(await model.readableTitle(`Gone [[${U(999)}]]`), `Gone [[${U(999)}]]`, 'readableTitle keeps an id it cannot find');
  same(await model.readableTitle(`Odd [[${U(40)}))`), `Odd [[${U(40)}))`, 'readableTitle keeps mismatched brackets');
  same(await model.readableTitle(''), '', 'readableTitle of nothing');

  // Readers of a pulled map.
  same(model.bare(':user.property/x'), 'user.property/x', 'bare drops the colon');
  same(model.pick({ ':block/title': 'a' }, 'block/title'), 'a', 'pick, full key with colon');
  same(model.pick({ 'block/title': 'b' }, 'block/title'), 'b', 'pick, full key');
  same(model.pick({ title: 'c' }, 'block/title'), 'c', 'pick, shortened key');
  same(model.idOf(7), 7, 'idOf of a number');
  same(model.idOf({ id: 8 }), 8, 'idOf of a map');

  // Days typed in words. Today is Monday 19 October 2026.
  const today = new Date(2026, 9, 19);
  const day = text => ymd(model.parseDay(text, today));
  const cases = [
    ['today', '2026-10-19'], ['tomorrow', '2026-10-20'], ['tmr', '2026-10-20'], ['yesterday', '2026-10-18'],
    ['+3', '2026-10-22'], ['-2', '2026-10-17'], ['+20', '2026-11-08'],
    ['friday', '2026-10-23'], ['fri', '2026-10-23'], ['fr', '2026-10-23'], ['monday', '2026-10-26'], ['next fri', '2026-10-30'], ['next monday', '2026-11-02'],
    ['2026-10-23', '2026-10-23'], ['2027-1-5', '2027-01-05'], ['23 oct', '2026-10-23'], ['oct 23', '2026-10-23'], ['oct. 23', '2026-10-23'], ['October 23, 2027', '2027-10-23'],
    ['19 oct', '2026-10-19'], ['1 jan', '2027-01-01'], ['18 oct', '2027-10-18'], ['  Friday  ', '2026-10-23'],
    ['', null], ['hello', null], ['13 foo', null], ['next', null], ['t', null], ['23', null],
    ['2026-02-30', null], ['31 sep', null], ['feb 29', null], ['2028-02-29', '2028-02-29'], ['2026-13-01', null],
  ];
  for (const [text, want] of cases) same(day(text), want, `parseDay("${text}")`);
  // Across the clocks going back (25 October 2026 in London): still whole days.
  same(ymd(model.dayAfter(new Date(2026, 9, 24), 1)), '2026-10-25', 'dayAfter over the clock change');
  same(ymd(model.dayAfter(new Date(2026, 9, 25), 1)), '2026-10-26', 'dayAfter the day the clocks change');
  same(ymd(model.dayAfter(new Date(2026, 9, 31), 1)), '2026-11-01', 'dayAfter over a month end');
  same(ymd(model.dayAfter(new Date(2026, 11, 31), 1)), '2027-01-01', 'dayAfter over a year end');
  same(model.dayNumber(today), 20261019, 'dayNumber');
  same(model.sameDay(new Date(2026, 9, 19, 23, 59), today), true, 'sameDay ignores the time');
  same(model.DAYS[today.getDay()], 'monday', 'DAYS starts on Sunday');

  // Journal titles.
  same(model.formatJournalTitle(today, 'MMM do, yyyy'), 'Oct 19th, 2026', 'format MMM do, yyyy');
  same(model.formatJournalTitle(today, 'E, dd.MM.yyyy'), 'Mon, 19.10.2026', 'format E, dd.MM.yyyy');
  same(model.formatJournalTitle(today, 'yyyyMMdd'), '20261019', 'format yyyyMMdd');
  same(model.formatJournalTitle(today, 'EEEE, MMMM do'), 'Monday, October 19th', 'format EEEE, MMMM do');
  same(model.formatJournalTitle(new Date(2026, 0, 5), 'dd-MM-yy'), '05-01-26', 'format dd-MM-yy');
  same(model.formatJournalTitle(new Date(2026, 0, 5), 'M/d/yyyy'), '1/5/2026', 'format M/d/yyyy');
  for (const [n, want] of [[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [22, '22nd'], [23, '23rd'], [31, '31st']])
    same(model.formatJournalTitle(new Date(2026, 0, n), 'do'), want, `ordinal ${n}`);
  same(await model.journalTitleFor(2026, 10, 19), 'Oct 19th, 2026', 'journalTitleFor, an existing journal');
  same(await model.journalTitleFor(2026, 10, 20), 'Oct 20th, 2026', 'journalTitleFor, a new day in the graph’s format');
  const other = loadModel(smallGraph(), { config: { format: 'yyyy-MM-dd' } }).model;
  same(await other.journalTitleFor(2026, 10, 20), '2026-10-20', 'journalTitleFor follows the graph’s date format');
  const noConfig = loadModel(smallGraph(), { config: { fails: true } }).model;
  same(await noConfig.journalTitleFor(2026, 10, 20), 'Oct 20th, 2026', 'journalTitleFor falls back when the configs cannot be read');

  // Journal pages.
  same(await model.journalIdFor(20261019, 'Oct 19th, 2026'), 44, 'journalIdFor finds the existing page');
  same(made.length, 0, 'journalIdFor made nothing for an existing day');
  const madeId = await model.journalIdFor(20261020, 'Oct 20th, 2026');
  same([madeId > 9000, made.length, made[0]?.title, made[0]?.opts?.journal, made[0]?.opts?.redirect], [true, 1, 'Oct 20th, 2026', true, false], 'journalIdFor makes a missing day as a journal, without leaving the page');

  // The schema.
  const before = queries.length;
  const schema = await model.propSchema();
  same(schema.props.map(p => p.title), ['attendees', 'Deadline', 'email', 'project', 'specialty', 'Status'], 'propSchema: own properties only, by name');
  const by = Object.fromEntries(schema.props.map(p => [p.title, p]));
  same([by.Deadline.type, by.Deadline.many, by.attendees.type, by.attendees.many, by.specialty.type], ['date', false, 'node', true, 'default'], 'propSchema: types and many');
  same(by.attendees.classes.map(c => c.title), ['Person'], 'propSchema: the class a field takes');
  same(by.Status.choices.map(c => c.title), ['Todo', 'Doing', 'Done'], 'propSchema: choices in their order');
  same(by.Deadline.ident, 'logseq.property/deadline', 'propSchema: the ident without its colon');
  same(schema.byId.get(22) === by.attendees, true, 'propSchema: by id');
  same(schema.parentsOf.get(11), [10], 'propSchema: Doctor extends Person');
  same([10, 11, 12, 13].some(id => schema.builtIn.has(id)), false, 'propSchema: the owner\'s tags are not counted as Logseq\'s own');
  await model.propSchema();
  same(queries.length - before, 5, 'propSchema asks the graph once (5 queries; the tag idents since 0.4.220), then remembers');

  // The pages.
  const pages = await model.propPages();
  same(pages.map(p => p.title), ['A', 'Atlas', 'B', 'Doctor', 'Dr. Joe', 'Holds a link to [[' + U(40) + ']]', 'Mat', 'Mateo Ruiz', 'Meeting', 'Person', 'Plain', 'Project', 'Property', 'Tag'], 'propPages: pages by name, no $$$ page, no journal, no property');
  // Logseq's own class pages (Property, Tag) pass the query when they have a name and are not tagged Property; whether
  // the real graph lists them in a page-valued field is one of the things to look at in the app.
  const page = Object.fromEntries(pages.map(p => [p.title, p]));
  same([page.Doctor.isTag, page['Dr. Joe'].isTag, page['Dr. Joe'].tags.map(t => t.title)], [true, false, ['Doctor']], 'propPages: tags and isTag');

  // A record's fields.
  same((await model.fieldsOf(U(51), schema)).map(p => p.title), ['attendees', 'project', 'Deadline'], 'fieldsOf a Meeting');
  same((await model.fieldsOf(U(52), schema)).map(p => p.title), ['specialty', 'email'], 'fieldsOf a Doctor: its own, then Person’s');
  same((await model.fieldsOf(U(53), schema)).map(p => p.title), ['email', 'specialty'], 'fieldsOf survives tags that extend each other');
  same(await model.fieldsOf('not-a-uuid', schema), [], 'fieldsOf of a bad id');
  same(await model.fieldsOf(U(50), schema), [], 'fieldsOf of a block with no tags');

  // What kind of page a page is.
  same(await model.tagChain(U(11)), { chain: [{ uuid: U(11), title: 'Doctor' }, { uuid: U(10), title: 'Person' }], others: [] }, 'tagChain: Doctor sits under Person');
  same((await model.tagChain(U(10)))?.chain.length, 1, 'tagChain: a top-level tag is its own chain');
  same(await model.tagChain(U(46)), null, 'tagChain: a page that is not a tag has none');
  same((await model.tagChain(U(60)))?.chain.map(t => t.title), ['A', 'B'], 'tagChain: a loop of two tags stops');
  same(await model.kindOfPage(11), { isTag: true, isProperty: false, plain: false, aliasOf: [] }, 'kindOfPage of a tag page');
  same(await model.kindOfPage(22), { isTag: false, isProperty: true, plain: false, aliasOf: [] }, 'kindOfPage of a property page');
  same(await model.kindOfPage(46), { isTag: false, isProperty: false, plain: true, aliasOf: [] }, 'kindOfPage of a plain page');
  same(await model.kindOfPage(41), { isTag: false, isProperty: false, plain: false, aliasOf: [] }, 'kindOfPage of a page with a tag of its own');
  same((await model.kindOfPage(48)).aliasOf, [[U(40), 'Mateo Ruiz']], 'kindOfPage finds the page an alias stands for');
  same(await model.kindOfPage(0), { isTag: false, isProperty: false, plain: false, aliasOf: [] }, 'kindOfPage of no page');

  // What a drawn page must hold, for the self-check.
  const { JSDOM } = (() => { try { return require('jsdom'); } catch { return {}; } })();
  if (JSDOM) {
    const doc = new JSDOM('<div id="main-content-container"><h1 class="title">Echo</h1></div>').window.document;
    for (const [what, has, needs, stops, min] of model.screenChecks()) {
      for (const selector of [has, needs]) { try { doc.querySelectorAll(selector); passed++; } catch (error) { problem(`screenChecks "${what}": ${selector} is not a selector`); } }
      same([typeof stops, Number.isInteger(min) && min > 0], ['string', true], `screenChecks "${what}" says what stops`);
    }
    same(doc.querySelectorAll(model.PAGE_TITLE).length, 1, 'PAGE_TITLE finds a page title');
  }
  same(/^\d+\.\d+\.\d+$/.test(model.CHECKED_WITH), true, 'CHECKED_WITH is a version');

  // The model's own work on a large graph (Logseq's query time left out).
  const big = loadModel(largeGraph()).model;
  const time = async (what, fn, limit) => {
    const t = process.hrtime.bigint();
    const result = await fn();
    const ms = Number(process.hrtime.bigint() - t) / 1e6;
    console.log(`  ${what}: ${ms.toFixed(1)} ms`);
    if (ms > limit) problem(`${what} took ${ms.toFixed(0)} ms (limit ${limit})`);
    return result;
  };
  console.log('timings on a large pretend graph (20,000 pages, 300 properties, 200 tags in one long chain):');
  const bigSchema = await time('the property schema', () => big.propSchema(), 2000);
  const bigPages = await time('the page list', () => big.propPages(), 2000);
  same(bigPages.length > 20000, true, 'the page list holds every page');
  await time('the page list again (remembered)', () => big.propPages(), 50);
  await time('fields of a record with the deepest tag', async () => { const deep = bigPages.find(p => p.title === 'Page 199'); return big.fieldsOf(deep.uuid, bigSchema); }, 500);
  await time('10,000 days read from words', () => { for (let i = 0; i < 10000; i++) big.parseDay(['next fri', '23 oct', '+3', 'tomorrow', '2026-12-01'][i % 5], today); }, 1000);

  console.log(`model-test: ${passed} checks passed`);
  if (problems.length) { console.log(`model-test: FAILED (${problems.length})`); process.exit(1); }
  console.log('model-test: OK');
}
main().catch(error => { problem(error && error.stack || String(error)); process.exit(1); });
