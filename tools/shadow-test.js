#!/usr/bin/env node
/* Checks the proposals' rules (parts/shadow.js) on a small pretend graph shaped like the Illness Test Graph, in a
   pretend window (jsdom): each case is a bullet with words, tags, a parent and a page, and what the shadow must
   and must not propose. Every case here was a mistake once, or a rule the owner set.
   Needs node and jsdom:   npm install --no-save --no-package-lock jsdom
   Run from the repo root: node tools/shadow-test.js   (tools/check.sh runs it when node and jsdom are there) */
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
window.eval(fs.readFileSync(path.join(root, 'parts/shared.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(root, 'parts/shadow.js'), 'utf8'));
window.refinementCore = { dsQuery: async () => [], UUID: /^[0-9a-f-]{36}$/i, propSchema: async () => null, propPages: async () => [], sendStyle() {},
  bare: v => String(v ?? '').replace(/^:/, ''), pick: (n, name) => n?.[name] ?? n?.[':' + name] ?? n?.[name.slice(name.indexOf('/') + 1)], idOf: v => typeof v === 'number' ? v : v?.['db/id'], titleOf: b => b?.title || '', provided: {} };
window.refinementParts.find(p => p.name === 'proposals').start();
const { piecesFor } = window.refinementShadowInner;

// The pretend graph: tags Entity > Person > Doctor, Place > Hospital, Occurrence > Appointment > Consultation, Symptom log.
const T = { entity: 1, person: 2, doctor: 3, place: 4, hospital: 5, occurrence: 6, appointment: 7, consultation: 8, log: 9, symptom: 10 };
const prop = (id, title, type, classes = [], many = false) => ({ id, ident: 'user.property/' + title.replace(/\W/g, '-').toLowerCase(), title, lower: title.toLowerCase(), type, many, classes: classes.map(c => ({ id: c, uuid: 'tag-' + c, title: 'Tag ' + c })) });
const props = [prop(20, 'doctor', 'node', [T.doctor]), prop(21, 'with', 'node', [T.person], true), prop(22, 'hospital', 'node', [T.hospital]), prop(23, 'Date', 'date'), prop(24, 'symptoms', 'node', [T.symptom], true)];
const schema = { props, byId: new Map(props.map(p => [p.id, p])),
  classProps: new Map([[T.appointment, [20, 21, 22, 23]], [T.log, [23, 24]]]),
  parentsOf: new Map([[T.person, [T.entity]], [T.doctor, [T.person]], [T.place, [T.entity]], [T.hospital, [T.place]], [T.appointment, [T.occurrence]], [T.consultation, [T.appointment]]]) };
const page = (id, title, tags, extra = {}) => ({ id, uuid: 'page-' + id, title, lower: title.toLowerCase(), tags: tags.map(t => ({ id: t, title: 'Tag ' + t, ident: 'user.class/t' + t })), isTag: false, ...extra });
const pages = [page(100, 'Dr. Mei Chen', [T.doctor]), page(101, 'Dr. Raj Patel', [T.doctor]), page(102, 'Ruth Okoro', [T.person]), page(103, 'Hannah Reyes', [], { tags: [{ id: 999, title: 'Page', ident: 'logseq.class/Page' }] }),
  page(104, 'Northgate Cancer Center', [T.hospital]), page(105, 'Nausea', [T.symptom]), { id: 200, uuid: 'tag-8', title: 'Consultation', lower: 'consultation', tags: [], isTag: true },
  { id: T.log, uuid: 'tag-9', title: 'Symptom log', lower: 'symptom log', tags: [], isTag: true }, { id: T.symptom, uuid: 'tag-10', title: 'Symptom', lower: 'symptom', tags: [], isTag: true }];
const byKey = new Map(), byId = new Map();
for (const p of pages) { byKey.set(p.lower, p); byKey.set(p.uuid, p); byId.set(p.id, p); }
const ctx = { schema, pages, byKey, byId, tagNames: pages.filter(p => p.isTag).map(p => p.lower).sort((a, b) => b.length - a.length), days: new Map([[300, 20261020], [301, 20261019]]), dated: new Map([[T.log, { same: 18, other: 0 }], [T.appointment, { same: 3, other: 5 }]]) };
const journal = { 'db/id': 300, 'block/uuid': 'j-300', 'block/title': 'Oct 20th, 2026', 'block/journal-day': 20261020, 'block/tags': [] };
const chenPage = { 'db/id': 100, 'block/uuid': 'page-100', 'block/title': 'Dr. Mei Chen', 'block/tags': [{ 'db/id': T.doctor }] };
const bullet = (title, tags, on, extra = {}) => ({ 'db/id': 1000 + Math.floor(Math.random() * 1000), 'block/uuid': 'b-' + Math.random().toString(16).slice(2), 'block/title': title, 'block/tags': tags.map(t => ({ 'db/id': t })), 'block/page': on, ...extra });
const shown = pieces => pieces.map(p => `${p.prop.title}=${p.shown}${p.note ? ' (' + p.note + ')' : ''}`).join(' · ') || '(nothing)';
let cases = 0;
function expect(name, { record, pieces }, want) {
  cases++;
  const got = shown(pieces);
  if (got !== want) problem(`${name}: proposed ${got}; wanted ${want}`);
  return record;
}

// 1. A consultation written on Dr. Mei Chen's page: the page fills doctor, and only doctor (not also "with").
expect('page rule', piecesFor(bullet('Review of the tingling', [T.consultation], chenPage), 'Review of the tingling #Consultation', ctx), 'doctor=Dr. Mei Chen');
// 2. Two doctors named in the words: quiet, and they do not spill into "with".
expect('two doctors', piecesFor(bullet('Saw [[Dr. Raj Patel]] and [[Dr. Mei Chen]]', [T.consultation], journal), 'Saw [[Dr. Raj Patel]] and [[Dr. Mei Chen]]', ctx), '(nothing)');
// 3. One doctor and a person named: doctor and with.
expect('doctor and person', piecesFor(bullet('x', [T.appointment], journal), 'Saw [[Dr. Mei Chen]] with [[Ruth Okoro]]', ctx), 'doctor=Dr. Mei Chen · with=Ruth Okoro');
// 4. A link with no tag yet is never a sure piece (a topic page would be made a person; second reading).
expect('untagged link', piecesFor(bullet('x', [T.appointment], journal), 'Talked to [[Hannah Reyes]]', ctx), '(nothing)');
expect('untagged link, one place', piecesFor(bullet('x', [T.appointment], journal, { 'user.property/hospital': { 'db/id': 104 }, 'user.property/with': [{ 'db/id': 102 }] }), 'Talked to [[Hannah Reyes]]', ctx), '(nothing)');
// 5. The journal day: a symptom log (dated the day written, as the graph shows) gets it; an appointment (often written ahead) does not.
expect('day for a log', piecesFor(bullet('Nausea bad by evening', [T.log], journal), 'Nausea bad by evening', ctx), 'Date=Oct 20');
expect('no day for an appointment', piecesFor(bullet('Review next month', [T.appointment], journal), 'Review next month', ctx), '(nothing)');
// 6. A note under an appointment: the pieces are the appointment's. A record nested under a record does not inherit
//    its parent's values (a follow-up under its first visit would get that visit's date; second reading).
const appt = bullet('Dietitian', [T.appointment], journal, { 'user.property/hospital': { 'db/id': 104 } });
const record = expect('note under a record', piecesFor(bullet('Saw [[Dr. Mei Chen]] again', [], journal, { 'block/parent': appt }), 'Saw [[Dr. Mei Chen]] again', ctx), 'doctor=Dr. Mei Chen');
if (record !== appt) problem('note under a record: the pieces are not for the appointment');
expect('nested record', piecesFor(bullet('Follow-up', [T.appointment], journal, { 'block/parent': { ...appt, 'user.property/doctor': { 'db/id': 100 } } }), 'Follow-up', ctx), '(nothing)');
// 7. A property already filled is never proposed for again, and a second doctor named does not become "with".
expect('filled stays', piecesFor(bullet('x', [T.appointment], journal, { 'user.property/doctor': { 'db/id': 101 } }), 'Saw [[Dr. Mei Chen]]', ctx), '(nothing)');
// 8. A symptom linked in a symptom log fills symptoms, several at once.
expect('several symptoms', piecesFor(bullet('x', [T.log], journal), '[[Nausea]] again', ctx), 'Date=Oct 20 · symptoms=Nausea');

// 9. A two-word tag typed without brackets, as Logseq shows it ("#Symptom log"), is read whole, not as #Symptom.
expect('two-word tag in the words', piecesFor(bullet('Queasy after lunch', [], journal), 'Queasy after lunch #Symptom log', ctx), 'Date=Oct 20');
if (problems.length) { console.log(`proposals rules: FAILED (${problems.length})`); process.exit(1); }
console.log(`proposals rules: OK (${cases} cases on a pretend graph)`);
