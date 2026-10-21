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
window.eval(fs.readFileSync(path.join(root, 'parts/alike.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(root, 'parts/shadow.js'), 'utf8'));
let answer = () => []; // what the pretend database answers
const dayAfter = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], MO = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// A small stand-in for the model's day reader (parts/model.js parseDay): today, tomorrow, a weekday, "4 aug", an ISO date.
const parseDay = (text, today) => {
  const t = text.trim().toLowerCase();
  if (t === 'today') return today; if (t === 'tomorrow' || t === 'tmr') return dayAfter(today, 1); if (t === 'yesterday') return dayAfter(today, -1);
  let m = t.match(/^(next\s+)?([a-z]+)$/);
  if (m) { const wd = WD.findIndex(d => d.startsWith(m[2].slice(0, 3))); if (wd >= 0) { let n = (wd - today.getDay() + 7) % 7 || 7; if (m[1]) n += 7; return dayAfter(today, n); } }
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = t.match(/^(\d{1,2})\s+([a-z]{3})$/) || t.match(/^([a-z]{3})\s+(\d{1,2})$/);
  if (m) { const [a, b] = /^\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]]; const month = MO.indexOf(b); if (month < 0) return null; let d = new Date(today.getFullYear(), month, Number(a)); if (d < today) d = new Date(today.getFullYear() + 1, month, Number(a)); return d; }
  return null;
};
window.refinementCore = { watchDomEarly() {}, dsQuery: async query => answer(query), UUID: /^[0-9a-f-]{36}$/i, propSchema: async () => null, propPages: async () => [], sendStyle() {},
  parseDay, dayAfter, dayNumber: d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(), journalIdFor: async () => 999, journalTitleFor: async () => 'a day',
  bare: v => String(v ?? '').replace(/^:/, ''), pick: (n, name) => n?.[name] ?? n?.[':' + name] ?? n?.[name.slice(name.indexOf('/') + 1)], idOf: v => typeof v === 'number' ? v : v?.['db/id'], titleOf: b => b?.title || '', provided: {}, provide: things => Object.assign(window.refinementCore.provided, things) };
window.refinementParts.find(p => p.name === 'alike').provide(window.refinementCore);
window.refinementParts.find(p => p.name === 'proposals').start();
const { piecesFor, addHistory } = window.refinementShadowInner;

// The pretend graph: tags Entity > Person > Doctor, Place > Hospital, Occurrence > Appointment > Consultation, Symptom log.
const T = { entity: 1, person: 2, doctor: 3, place: 4, hospital: 5, occurrence: 6, appointment: 7, consultation: 8, log: 9, symptom: 10, treatment: 11 };
const prop = (id, title, type, classes = [], many = false) => ({ id, ident: 'user.property/' + title.replace(/\W/g, '-').toLowerCase(), title, lower: title.toLowerCase(), type, many, classes: classes.map(c => ({ id: c, uuid: 'tag-' + c, title: 'Tag ' + c })) });
const props = [prop(20, 'doctor', 'node', [T.doctor]), prop(21, 'with', 'node', [T.person], true), prop(22, 'hospital', 'node', [T.hospital]), prop(23, 'Date', 'date'), prop(24, 'symptoms', 'node', [T.symptom], true), prop(25, 'specialty', 'default'), prop(26, 'Cycle', 'number')];
const schema = { props, byId: new Map(props.map(p => [p.id, p])),
  classProps: new Map([[T.appointment, [20, 21, 22, 23]], [T.log, [23, 24]], [T.doctor, [25]], [T.treatment, [23, 26]]]),
  parentsOf: new Map([[T.person, [T.entity]], [T.doctor, [T.person]], [T.place, [T.entity]], [T.hospital, [T.place]], [T.appointment, [T.occurrence]], [T.consultation, [T.appointment]]]) };
const page = (id, title, tags, extra = {}) => ({ id, uuid: 'page-' + id, title, lower: title.toLowerCase(), tags: tags.map(t => ({ id: t, title: 'Tag ' + t, ident: 'user.class/t' + t })), isTag: false, ...extra });
const pages = [page(100, 'Dr. Mei Chen', [T.doctor]), page(101, 'Dr. Raj Patel', [T.doctor]), page(102, 'Ruth Okoro', [T.person]), page(103, 'Hannah Reyes', [], { tags: [{ id: 999, title: 'Page', ident: 'logseq.class/Page' }] }),
  page(104, 'Northgate Cancer Center', [T.hospital]), page(105, 'Nausea', [T.symptom]), page(106, 'Northgate', []), page(107, 'Fatigue', [T.symptom]),
  page(108, 'Tingling fingers', [T.symptom]), page(109, 'Cold sensitivity', [T.symptom]), { id: 200, uuid: 'tag-8', title: 'Consultation', lower: 'consultation', tags: [], isTag: true },
  { id: T.log, uuid: 'tag-9', title: 'Symptom log', lower: 'symptom log', tags: [], isTag: true }, { id: T.doctor, uuid: 'tag-3', title: 'Doctor', lower: 'doctor', tags: [], isTag: true }, { id: T.symptom, uuid: 'tag-10', title: 'Symptom', lower: 'symptom', tags: [], isTag: true }];
const byKey = new Map(), byId = new Map();
for (const p of pages) { byKey.set(p.lower, p); byKey.set(p.uuid, p); byId.set(p.id, p); }
const ctx = { schema, pages, byKey, byId, tagNames: pages.filter(p => p.isTag).map(p => p.lower).sort((a, b) => b.length - a.length), days: new Map([[300, 20261020], [301, 20261019]]), dated: new Map([[T.log, { same: 18, other: 0 }], [T.appointment, { same: 3, other: 5 }], [T.treatment, { same: 3, other: 0 }], [T.consultation, { same: 3, other: 5 }]]),
  aliases: [[104, 106]] };
// Lines written before, for the "looks like" engine: two symptom logs saying "Wiped out all day." with Fatigue,
// and two "Bad day." that disagree.
addHistory(ctx, [
  { id: 500, title: 'Wiped out all day.', tags: [T.log], values: new Map([['user.property/symptoms', [107]]]) },
  { id: 501, title: 'Wiped out all day.', tags: [T.log], values: new Map([['user.property/symptoms', [107]]]) },
  { id: 502, title: 'Bad day.', tags: [T.log], values: new Map([['user.property/symptoms', [107]]]) },
  { id: 503, title: 'Bad day.', tags: [T.log], values: new Map([['user.property/symptoms', [105]]]) }]);
const journal = { 'db/id': 300, 'block/uuid': 'j-300', 'block/title': 'Oct 20th, 2026', 'block/journal-day': 20261020, 'block/tags': [] };
const chenPage = { 'db/id': 100, 'block/uuid': 'page-100', 'block/title': 'Dr. Mei Chen', 'block/tags': [{ 'db/id': T.doctor }] };
const bullet = (title, tags, on, extra = {}) => ({ 'db/id': 1000 + Math.floor(Math.random() * 1000), 'block/uuid': 'b-' + Math.random().toString(16).slice(2), 'block/title': title, 'block/tags': tags.map(t => ({ 'db/id': t })), 'block/page': on, ...extra });
// A guess (piece 2, taken only with Enter) is shown with a "?".
const shown = pieces => pieces.map(p => `${p.prop.title}=${p.shown}${p.guess ? '?' : ''}${p.note ? ' (' + p.note + ')' : ''}`).join(' · ') || '(nothing)';
let cases = 0;
const pickTitle = node => node?.['block/title'];
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
// 4. A link with no tag yet is never a sure piece (a topic page would be made a person; second reading). It is a guess
//    for the first empty place it could fill, when there are one or two such places; with three, nothing.
expect('untagged link, three places', piecesFor(bullet('x', [T.appointment], journal), 'Talked to [[Hannah Reyes]]', ctx), '(nothing)');
const onePlace = piecesFor(bullet('x', [T.appointment], journal, { 'user.property/hospital': { 'db/id': 104 }, 'user.property/with': [{ 'db/id': 102 }] }), 'Talked to [[Hannah Reyes]]', ctx);
expect('untagged link, one place', onePlace, 'doctor=Hannah Reyes? (becomes a #Tag 3)');
const tagging = onePlace.pieces[0]?.tagPage;
if (tagging?.tag?.uuid !== 'tag-3' || tagging?.uuids?.join() !== 'page-103') problem('untagged link, one place: taking it would not tag Hannah Reyes #Doctor');
expect('untagged link, two places', piecesFor(bullet('x', [T.appointment], journal, { 'user.property/hospital': { 'db/id': 104 } }), 'Video call with [[Hannah Reyes]], the dietitian', ctx),
  'doctor=Hannah Reyes? (becomes a #Tag 3)'); // only the first place: Enter takes every guess (0.4.202)
// 5. The journal day: a symptom log (dated the day written, as the graph shows) gets it; an appointment (often written ahead) does not.
expect('day for a log', piecesFor(bullet('Nausea bad by evening', [T.log], journal), 'Nausea bad by evening', ctx), 'Date=Oct 20 · symptoms=Nausea?');
expect('no day for an appointment', piecesFor(bullet('Review next month', [T.appointment], journal), 'Review next month', ctx), '(nothing)');
// A tag with too few dated nodes to be sure, none dated another day (a treatment, 3 in the graph): the day as a guess (0.4.211).
expect('day for a tag with few examples', piecesFor(bullet('Iron tablets started', [T.treatment], journal), 'Iron tablets started', ctx), 'Date=Oct 20?');
expect('no journal day for a tag with no dated nodes yet (the words give next Tuesday, stage E)', piecesFor(bullet('Scan next Tuesday', [T.hospital], journal), 'Scan next Tuesday', { ...ctx, schema: { ...schema, classProps: new Map([...schema.classProps, [T.hospital, [23]]]) } }), 'Date=Nov 3?');
expect('no day off a journal', piecesFor(bullet('Iron tablets started', [T.treatment], chenPage), 'Iron tablets started', ctx), '(nothing)');
// 6. A note under an appointment: the pieces are the appointment's. A record nested under a record does not take
//    its parent's values as sure pieces (a follow-up under its first visit would get that visit's date; second
//    reading); they are guesses, and only where the child says nothing itself.
const appt = bullet('Dietitian', [T.appointment], journal, { 'user.property/hospital': { 'db/id': 104 } });
const record = expect('note under a record', piecesFor(bullet('Saw [[Dr. Mei Chen]] again', [], journal, { 'block/parent': appt }), 'Saw [[Dr. Mei Chen]] again', ctx), 'doctor=Dr. Mei Chen');
if (record !== appt) problem('note under a record: the pieces are not for the appointment');
expect('nested record', piecesFor(bullet('Follow-up', [T.appointment], journal, { 'block/parent': { ...appt, 'user.property/doctor': { 'db/id': 100 } } }), 'Follow-up', ctx), 'doctor=Dr. Mei Chen? · hospital=Northgate Cancer Center?');
expect('nested record says otherwise', piecesFor(bullet('Follow-up', [T.appointment], journal, { 'user.property/doctor': { 'db/id': 101 }, 'block/parent': { ...appt, 'user.property/doctor': { 'db/id': 100 } } }), 'Follow-up', ctx), 'hospital=Northgate Cancer Center?');
// 6b. Several people named in a note under a record are not the record's "with" (a list in a note is a guess), while
//     a doctor named there still is its doctor.
expect('list in a note', piecesFor(bullet('Rang [[Ruth Okoro]] and [[Dr. Raj Patel]] after', [], journal, { 'block/parent': bullet('Visit', [T.appointment], journal, { 'user.property/doctor': { 'db/id': 100 } }) }), 'Rang [[Ruth Okoro]] and [[Dr. Raj Patel]] after', ctx), '(nothing)');
// 7. A property already filled is never proposed for again, and a second doctor named does not become "with".
expect('filled stays', piecesFor(bullet('x', [T.appointment], journal, { 'user.property/doctor': { 'db/id': 101 } }), 'Saw [[Dr. Mei Chen]]', ctx), '(nothing)');
// 8. A symptom linked in a symptom log fills symptoms, several at once.
expect('several symptoms', piecesFor(bullet('x', [T.log], journal), '[[Nausea]] again', ctx), 'Date=Oct 20 · symptoms=Nausea');

// 9. A two-word tag typed without brackets, as Logseq shows it ("#Symptom log"), is read whole, not as #Symptom.
expect('two-word tag in the words', piecesFor(bullet('Queasy after lunch', [], journal), 'Queasy after lunch #Symptom log', ctx), 'Date=Oct 20');

// 10. Guesses from plain words: a page named without brackets, by a word of its title or by an alias, when one page
//     of the right tag is named; "Dr." alone, or two doctors, name no one.
expect('plain words', piecesFor(bullet('x', [T.appointment], journal), 'Post-op check with Dr. Patel. Wounds fine.', ctx), 'doctor=Dr. Raj Patel?');
expect('plain words, alias', piecesFor(bullet('x', [T.appointment], journal), 'Bloods at Northgate this morning', ctx), 'hospital=Northgate Cancer Center?');
expect('plain words, a word of the title', piecesFor(bullet('x', [T.log], journal), 'Bad night, the tingling again', ctx), 'Date=Oct 20 · symptoms=Tingling fingers?');
expect('plain words, "Dr." alone (today in the words is the day, stage E)', piecesFor(bullet('x', [T.appointment], journal), 'Saw the Dr. today', ctx), 'Date=Oct 20?');
expect('plain words, two doctors', piecesFor(bullet('x', [T.appointment], journal), 'Saw Dr. Chen and Dr. Patel', ctx), '(nothing)');
expect('plain words, two symptoms tie', piecesFor(bullet('x', [T.log], journal), 'Cold hurts my fingers', ctx), 'Date=Oct 20');
// 11. The lines the bullet looks like give their values, when they agree (a near-identical line: the old "same line before").
expect('same line before', piecesFor(bullet('x', [T.log], journal), 'Wiped out all day.', ctx), 'Date=Oct 20 · symptoms=Fatigue?');
expect('same line before, disagreeing', piecesFor(bullet('x', [T.log], journal), 'Bad day.', ctx), 'Date=Oct 20');
// 11b. Stage D (0.4.213): a bullet with no tag gets the tag of the lines it looks like, pencilled in a Tags pill, with
//      the properties the tag gives beside it, all guesses; a plain note that looks like nothing gets nothing; a note
//      under a record still proposes for the record, never a tag for itself.
expect('untagged bullet, looks like the logs', piecesFor(bullet('x', [], journal), 'Wiped out all day.', ctx), 'Tags=#Symptom log? · Date=Oct 20? · symptoms=Fatigue?');
expect('untagged bullet, looks like nothing', piecesFor(bullet('x', [], journal), 'Hair cut, silly thing to do', ctx), '(nothing)');
expect('untagged bullet, lines disagree on the value', piecesFor(bullet('x', [], journal), 'Bad day.', ctx), 'Tags=#Symptom log? · Date=Oct 20?');
expect('untagged note under a record', piecesFor(bullet('x', [], journal, { 'block/parent': bullet('Visit', [T.appointment], journal) }), 'Wiped out all day.', ctx), '(nothing)');
// 11c. Stage E (0.4.214): a date in the words for a Date nothing else fills (an appointment is written ahead: no journal
//      day), counted from the day written (Oct 20th, 2026 is a Tuesday); a number beside a number property's name.
expect('a weekday in the words', piecesFor(bullet('x', [T.appointment], journal), 'Scan on Friday, nothing to eat', ctx), 'Date=Oct 23?');
expect('next weekday', piecesFor(bullet('x', [T.appointment], journal), 'Scan next Friday', ctx), 'Date=Oct 30?');
expect('a day of the month', piecesFor(bullet('x', [T.appointment], journal), 'Operation on the 4th. In at 7.', ctx), 'Date=Nov 4?');
expect('a day and month', piecesFor(bullet('x', [T.appointment], journal), 'Flu jab 6 Nov at the surgery', ctx), 'Date=Nov 6?');
expect('tomorrow', piecesFor(bullet('x', [T.appointment], journal), 'Bloods tomorrow morning', ctx), 'Date=Oct 21?');
expect('in two weeks', piecesFor(bullet('x', [T.appointment], journal), 'Review in two weeks', ctx), 'Date=Nov 3?');
expect('two dates: nothing', piecesFor(bullet('x', [T.appointment], journal), 'Scan on Friday or Monday', ctx), '(nothing)');
expect('the day written for a log beats the words', piecesFor(bullet('x', [T.log], journal), 'Tired since Monday', ctx), 'Date=Oct 20');
expect('a date in a note under a record: nothing', piecesFor(bullet('x', [], journal, { 'block/parent': bullet('Visit', [T.appointment], journal) }), 'Scan on Friday', ctx), '(nothing)');
const wordsDay = piecesFor(bullet('x', [T.appointment], journal), 'Scan on Friday', ctx).pieces[0];
if (wordsDay?.day !== 20261023 || wordsDay.journalId !== null || wordsDay.ids[0] !== -20261023) problem('a weekday in the words: the piece does not carry the day, or claims a journal page the graph has not got');
expect('a number beside the property\'s name', piecesFor(bullet('x', [T.treatment], journal), 'Chemo cycle 5 done', ctx), 'Date=Oct 20? · Cycle=5?');
expect('a number before the name', piecesFor(bullet('x', [T.treatment], journal), 'Two more, 3 cycles left', ctx), 'Date=Oct 20? · Cycle=3?');
expect('no number', piecesFor(bullet('x', [T.treatment], journal), 'Chemo done', ctx), 'Date=Oct 20?');
expect('two numbers: nothing', piecesFor(bullet('x', [T.treatment], journal), 'cycle 5 of 8 cycles', ctx), 'Date=Oct 20?');
const taggedGuess = piecesFor(bullet('x', [], journal), 'Wiped out all day.', ctx);
if (taggedGuess.assume?.id !== T.log || taggedGuess.pieces[0]?.tag?.uuid !== 'tag-9' || !taggedGuess.pieces.slice(1).every(p => p.needsTag)) problem('untagged bullet: the shadow does not carry the tag to give, or the values do not wait for it');
expect('untagged bullet, the tag assumed again when taken', piecesFor(bullet('x', [], journal), 'Wiped out all day.', ctx, new Set(), byId.get(T.log)), 'Tags=#Symptom log? · Date=Oct 20? · symptoms=Fatigue?');
// 12. Two doctors linked keep the doctor quiet: no guess either (Jul 17 in the Illness Test Graph).
expect('two doctors, no guess', piecesFor(bullet('x', [T.consultation], journal), 'Saw [[Dr. Raj Patel]] and [[Dr. Mei Chen]] with Dr. Patel', ctx), '(nothing)');

// 21. A tag written right after a link, with no space, is the page's (0.4.209, at the owner's word): Logseq tags the
//     bullet #Doctor, but the page goes in the property that takes #Doctor, sure, saying the tag it will get; Doctor's
//     own properties on the bullet are skipped by Option-Enter. With a space, the tag is the bullet's, as in Logseq.
const newDoc = piecesFor(bullet('x', [T.consultation, T.doctor], journal), 'Call with [[Dr. Test New]]#Doctor', ctx);
expect('page tagged in the words, new page', newDoc, 'doctor=Dr. Test New #Doctor');
cases++;
if (newDoc.skip?.join() !== 'specialty') problem(`page tagged in the words: Option-Enter would go to ${newDoc.skip?.join() ? 'all but ' + newDoc.skip.join() : 'Doctor\'s own properties'}`);
expect('page tagged in the words, already a doctor', piecesFor(bullet('x', [T.consultation, T.doctor], journal), 'Saw [[Dr. Mei Chen]]#Doctor', ctx), 'doctor=Dr. Mei Chen');
expect('page tagged in the words, page with no tag', piecesFor(bullet('x', [T.appointment, T.doctor], journal), 'Call with [[Hannah Reyes]]#Doctor', ctx), 'doctor=Hannah Reyes #Doctor');
expect('page tagged in the words, with a space', piecesFor(bullet('x', [T.consultation, T.doctor], journal), 'Call with [[Dr. Test New]] #Doctor', ctx), '(nothing)');
const tagNote = piecesFor(bullet('x', [T.doctor], journal, { 'block/parent': bullet('Visit', [T.appointment], journal) }), 'Rang [[Dr. Test New]]#Doctor', ctx);
expect('page tagged in the words, in a note', tagNote, 'doctor=Dr. Test New #Doctor');
cases++;
if (pickTitle(tagNote.record) !== 'Visit') problem('page tagged in the words, in a note: the pieces are not for the record above');
// A tag no property of the record takes stays the bullet's (a symptom log has no doctor): nothing moved.
const noPlace = piecesFor(bullet('x', [T.log, T.doctor], journal), 'Rang [[Dr. Test New]]#Doctor', ctx);
expect('page tagged in the words, no place for it', noPlace, 'Date=Oct 20');
cases++;
if (noPlace.skip?.length) problem('page tagged in the words, no place for it: Doctor\'s properties are skipped though the bullet keeps the tag');
// From the second reading: the bullet's own tag is never set aside; a doctor linked beside the tagged page does not
// spill into "with"; a filled doctor, or two pages for one doctor, leave the tag to Logseq; "#Doctor's" is not #Doctor.
const ownKept = piecesFor(bullet('x', [T.appointment, T.doctor], journal), 'Call with [[Dr. Test New]]#Doctor', ctx, new Set([T.doctor]));
expect('page tagged in the words, the bullet\'s own tag', ownKept, '(nothing)');
cases++;
if (ownKept.skip?.length) problem('page tagged in the words, the bullet\'s own tag: its properties are skipped');
expect('page tagged in the words, no spill', piecesFor(bullet('x', [T.appointment, T.doctor], journal), 'Saw [[Dr. Mei Chen]] and [[Dr. Test New]]#Doctor', ctx), 'doctor=Dr. Test New #Doctor');
expect('page tagged in the words, doctor filled', piecesFor(bullet('x', [T.appointment, T.doctor], journal, { 'user.property/doctor': { 'db/id': 101 } }), 'Saw [[Dr. Test New]]#Doctor', ctx), '(nothing)');
expect('page tagged in the words, two for one doctor', piecesFor(bullet('x', [T.appointment, T.doctor], journal), 'Saw [[Ann New]]#Doctor and [[Bo New]]#Doctor', ctx), '(nothing)');
expect('page tagged in the words, a longer word', piecesFor(bullet('x', [T.appointment], journal), 'Saw [[Dr. Test New]]#Doctor\'s nurse', ctx), '(nothing)');
// Filling in takes the tag out of the words, whichever way Logseq saved it.
const { withoutPageTag } = window.refinementShadowInner;
const drNew = { uuid: 'aaaa-1', title: 'Dr. Test New' };
for (const [title, tag, want] of [['Call with [[aaaa-1]]#Doctor today', { lower: 'doctor' }, 'Call with [[aaaa-1]] today'],
  ['Call with [[Dr. Test New]]#[[bbbb-2]]', { lower: 'doctor' }, 'Call with [[Dr. Test New]]'],
  ['[[aaaa-1]]#Symptom log, bad', { lower: 'symptom log' }, '[[aaaa-1]], bad'],
  ['Saw [[aaaa-1]] #Doctor', { lower: 'doctor' }, 'Saw [[aaaa-1]] #Doctor']]) {
  cases++;
  const got = withoutPageTag(title, drNew, tag);
  if (got !== want) problem(`page tagged in the words, filling in: "${title}" became "${got}"; wanted "${want}"`);
}
cases++;
const back = window.refinementShadowInner.withPageTag('Call with [[aaaa-1]] today, and more', drNew, '#Doctor');
if (back !== 'Call with [[aaaa-1]]#Doctor today, and more') problem(`page tagged in the words, Undo after more was written: "${back}"`);

const guessKeyOf = piece => `${piece.ident} ${piece.ids.join(',')}`;
// 13. Enter takes the guesses (the owner: "enter confirms"; 0.4.202). A click on a proposed value does nothing, and
//     keeps the bullet in edit: the mouse press is held back, the pointer press is not (holding that back stops the
//     mouse press from coming at all; found in the app).
(async () => {
  // 22. A page made and tagged a moment ago (Logseq tags [[Dr. Space Test]] when #Doctor is picked from its list) is not in
  //     the page list yet, read at most every 30 s: the linked pages are read fresh, so doctor gets it (0.4.210, seen
  //     empty in the app before).
  expect('new page tagged a moment ago, before', piecesFor(bullet('x', [T.appointment], journal), 'Call with [[Dr. Space Test]] today', ctx), 'Date=Oct 20?');
  answer = query => /:block\/name/.test(query) && query.includes('"dr. space test"') ? [[{ 'db/id': 600, 'block/uuid': 'page-600', 'block/title': 'Dr. Space Test', 'block/tags': [{ 'db/id': 999, 'block/title': 'Page', 'db/ident': ':logseq.class/Page' }, { 'db/id': T.doctor, 'block/title': 'Doctor', 'db/ident': ':user.class/Doctor' }] }]] : [];
  const freshCtx = await window.refinementShadowInner.withFreshLinks('Call with [[Dr. Space Test]] today', ctx);
  answer = () => [];
  expect('new page tagged a moment ago', piecesFor(bullet('x', [T.appointment], journal), 'Call with [[Dr. Space Test]] today', freshCtx), 'doctor=Dr. Space Test · Date=Oct 20?');
  cases++;
  if (ctx.byKey.has('dr. space test')) problem('new page tagged a moment ago: the shared page list was changed');
  const doc = window.document;
  // A bullet as Logseq draws it, with its property row: "doctor:" and an empty value.
  doc.body.innerHTML = '<div class="ls-block" blockid="b-click"><div class="block-main-container"><div class="flex-col"><div class="flex-col">'
    + '<textarea>Post-op check with Dr. Patel</textarea><div class="positioned-properties block-below"><div class="bottom-properties-row">'
    + '<div class="bottom-property-pill"><span>doctor:</span><span class="bottom-property-content"><span class="empty-value">—</span></span></div></div></div></div></div></div></div>';
  const box = doc.querySelector('textarea');
  box.focus();
  const guess = piecesFor(bullet('x', [T.appointment], journal), box.value, ctx).pieces.find(p => p.guess);
  window.refinementShadow.live = { uuid: 'b-click', recordUuid: 'b-click', text: box.value, pieces: [guess] };
  window.refinementShadowInner.drawInPlace(doc);
  // The guess is written where the value goes, and nothing else is drawn (the owner: no line of its own, no keys).
  cases++;
  const inPill = doc.querySelector('.bottom-property-pill .bottom-property-content .rfs-ghost.rfs-guess');
  if (!inPill || inPill.textContent !== 'Dr. Raj Patel') problem(`guess in place: wanted "Dr. Raj Patel" in the doctor property; found ${inPill ? '"' + inPill.textContent + '"' : 'nothing'}`);
  if (doc.querySelector('.refinement-shadow, kbd')) problem('guess in place: a line or keys of its own are drawn');
  const el = doc.querySelector('.rfs-ghost[data-guess]');
  cases++;
  if (el) {
    const press = type => { const e = new window.MouseEvent(type, { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };
    if (press('pointerdown').defaultPrevented) problem('click on a value: the pointer press is held back, so no mouse press follows');
    if (!press('mousedown').defaultPrevented) problem('click on a value: the mouse press is not held back, so the bullet would leave edit');
    if (window.refinementShadow.taken.keys.size) problem('click on a value: a click took the guess; only Enter does now');
  }
  cases++;
  box.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
  if (window.refinementShadow.taken.keys.size) problem('Shift+Enter (a line break) took the guesses');
  cases++;
  box.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  if (!window.refinementShadow.taken.keys.has(guessKeyOf(guess))) problem('Enter: the guess shown is not taken');
  // An Enter that did not leave the bullet does not count for a later leaving (second reading).
  cases++;
  const stale = window.refinementShadow.live;
  window.refinementShadow.taken.at = Date.now() - 5000;
  box.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true }));
  box.blur();
  await new Promise(resolve => setTimeout(resolve, 200));
  if (window.refinementShadow.left !== stale || stale.taken?.size) problem('an Enter long before leaving still fills in the guesses');
  // Back in the bullet for the next check.
  window.refinementShadow.live = { uuid: 'b-click', recordUuid: 'b-click', text: box.value, pieces: [guess] };
  window.refinementShadowInner.drawInPlace(doc);
  box.focus();
  box.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  // 14. Leaving with Enter puts the next bullet in edit, and its shadow can come before the wait is over: what was
  //     taken in the bullet left must still be filled in (second reading).
  const left = window.refinementShadow.live;
  box.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true }));
  box.blur();
  window.refinementShadow.live = { uuid: 'b-next', recordUuid: 'b-next', text: '', pieces: [] };
  window.refinementShadow.taken = { uuid: 'b-next', keys: new Set() };
  await new Promise(resolve => setTimeout(resolve, 200));
  cases++;
  if (window.refinementShadow.left !== left || !left.taken?.has(guessKeyOf(guess))) problem('leaving with Enter: the guess taken in the bullet left is not filled in');
  window.refinementShadow.live = null;
  window.refinementShadowInner.drawInPlace(doc);
  cases++;
  if (doc.querySelector('.rfs-ghost, [data-refinement-proposal]')) problem('bullet left: the faint value stays in the property');
  // 14b. A page that would get a tag says so where it shows ("Hannah Reyes #Doctor", the owner's words).
  {
    const loose = onePlace.pieces[0];
    window.refinementShadow.live = { uuid: 'b-click', recordUuid: 'b-click', text: '', pieces: [loose] };
    window.refinementShadowInner.drawInPlace(doc);
    cases++;
    const shownAs = doc.querySelector('.rfs-ghost')?.textContent;
    if (shownAs !== 'Hannah Reyes #Tag 3') problem(`untagged page: shows "${shownAs}"; wanted "Hannah Reyes #Tag 3"`);
    window.refinementShadow.live = null;
    window.refinementShadowInner.drawInPlace(doc);
  }
  // 15. A record whose row is not on screen (a note zoomed into): nothing is drawn, so nothing may be taken (second reading).
  const unseen = { uuid: 'b-click', recordUuid: 'not-on-screen', text: box.value, pieces: [guess] };
  window.refinementShadow.live = unseen;
  window.refinementShadowInner.drawInPlace(doc);
  cases++;
  if (unseen.drawn?.size) problem('record not on screen: values counted as shown, so leaving would fill them unseen');
  // 16. A pill marked by a copy cut short, with nothing of ours in it, is given back to Logseq (second reading).
  window.refinementShadow.live = null;
  doc.querySelector('.bottom-property-pill').setAttribute('data-refinement-proposal', '');
  window.refinementShadowInner.drawInPlace(doc);
  cases++;
  if (doc.querySelector('[data-refinement-proposal]')) problem('a marked pill with nothing of ours in it keeps hiding Logseq\'s empty value');

// 17. Option-Enter (0.4.204): from the words, Logseq's own list opens for the first property that is empty and has
//     nothing proposed; Tab goes on to the next; Escape in the list comes back to the end of the words.
{
  const doc = window.document, edited = [];
  window.logseq.Editor.editBlock = async (uuid, opts) => { edited.push([uuid, opts?.pos]); };
  const pill = (name, inner) => `<div class="bottom-property-pill"><span>${name}:</span><span class="bottom-property-content">${inner}</span></div>`;
  const empty = id => `<div class="empty-value" data-type="node"><div class="jtrigger" id="${id}">—</div></div>`;
  doc.body.innerHTML = '<div class="ls-block" blockid="b-opt"><div class="block-main-container"><div class="flex-col"><div class="flex-col">'
    + '<textarea>Post-op check with Dr. Patel</textarea><div class="positioned-properties block-below"><div class="bottom-properties-row">'
    + pill('doctor', empty('t-doctor')) + pill('with', empty('t-with')) + pill('hospital', empty('t-hospital'))
    + pill('Date', '<div class="empty-value" data-type="date"><div class="jtrigger" id="t-date">—</div></div>') + '</div></div></div></div>'
    // A property shown as a row of its own ("bullet style"), after the capsules: reached too (0.4.205).
    + '<div class="ls-block-properties"><div class="property-pair" data-property-title="Notes"><div class="empty-value" data-type="default"><div class="jtrigger" id="t-notes"></div></div></div></div></div></div>';
  const box = doc.querySelector('textarea');
  box.focus();
  const guess = piecesFor(bullet('x', [T.appointment], journal), box.value, ctx).pieces.find(p => p.guess);
  window.refinementShadow.live = { uuid: 'b-opt', recordUuid: 'b-opt', text: box.value, pieces: [guess] };
  window.refinementShadowInner.drawInPlace(doc);
  const pressed = [];
  for (const id of ['t-doctor', 't-with', 't-hospital', 't-date', 't-notes']) doc.getElementById(id).addEventListener('pointerdown', () => pressed.push(id));
  box.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true, cancelable: true }));
  cases++;
  if (pressed.join() !== 't-with') problem(`Option-Enter: opened ${pressed.join() || 'nothing'}; wanted the first empty property with nothing proposed ("with")`);
  // Logseq's list, as it opens: its own box, which takes the keys.
  const list = doc.createElement('div'); list.className = 'cp__select'; list.innerHTML = '<input class="cp__select-input">'; doc.body.appendChild(list);
  list.querySelector('input').focus();
  list.querySelector('input').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 120));
  cases++;
  if (pressed.join() !== 't-with,t-hospital') problem(`Tab in the list: opened ${pressed.join()}; wanted "hospital" next`);
  list.querySelector('input').focus(); // the next list, as Logseq opens it, takes the keys
  await new Promise(resolve => setTimeout(resolve, 150));
  // Tab again: the date is passed over, the row of its own is next.
  list.querySelector('input').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 120));
  cases++;
  if (pressed.join() !== 't-with,t-hospital,t-notes') problem(`Tab past the capsules: opened ${pressed.join()}; wanted the Notes row (the date passed over)`);
  list.querySelector('input').focus();
  await new Promise(resolve => setTimeout(resolve, 150));
  list.querySelector('input').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  list.remove(); box.blur();
  await new Promise(resolve => setTimeout(resolve, 300));
  cases++;
  if (edited.map(e => e.join(':')).join() !== `b-opt:${box.value.length}`) problem(`Escape in the list: went back to ${edited.map(e => e.join(':')).join() || 'nothing'}; wanted the end of the words`);
  // A press that opens nothing (no list takes the focus): nothing is taken, the bullet stays as it was (second reading).
  cases++;
  edited.length = 0;
  box.focus();
  const before = window.refinementShadow.live;
  box.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 800));
  if (window.refinementShadow.picking.uuid || before?.left || edited.length) problem('Option-Enter that opens nothing: it took the values, went somewhere, or stayed waiting');
  window.refinementShadow.live = null;
  window.refinementShadowInner.drawInPlace(doc);
}
// 19. Enter moves on (0.4.207): Enter in a text value keeps it and opens the next empty property; Enter past the last
//     one goes to the next bullet (the owner: "enter should go to next bullet on last enter"); Option-Enter in the
//     properties finishes the bullet from anywhere. The property being filled in is marked.
{
  const doc = window.document, edited = [], inserted = [];
  window.logseq.Editor.editBlock = async (uuid, opts) => { edited.push(uuid); };
  window.logseq.Editor.insertBlock = async (uuid, content, opts) => { inserted.push([uuid, opts?.sibling]); return { uuid: 'b-next-bullet' }; };
  const pill = (name, id, type = 'node') => `<div class="bottom-property-pill"><span>${name}:</span><span class="bottom-property-content"><div class="empty-value" data-type="${type}"><div class="jtrigger" id="${id}">—</div></div></span></div>`;
  doc.body.innerHTML = '<div class="ls-block" blockid="0e000000-0000-4000-8000-0000000000e1"><div class="block-main-container"><div class="flex-col"><div class="flex-col">'
    + '<textarea id="edit-block-0e000000-0000-4000-8000-0000000000e1">Call with Dr. Patel</textarea><div class="positioned-properties block-below"><div class="bottom-properties-row">'
    + pill('notes', 't-notes', 'default') + pill('hospital', 't-hosp') + '</div></div></div></div></div></div>';
  const box = doc.querySelector('textarea'), pressed = [];
  for (const id of ['t-notes', 't-hosp']) doc.getElementById(id).addEventListener('pointerdown', () => pressed.push(id));
  box.focus();
  window.refinementShadow.live = null;
  box.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true, cancelable: true }));
  cases++;
  if (!doc.getElementById('t-notes').closest('[data-rfs-at]')) problem('Option-Enter: the property being filled in is not marked');
  // Logseq opens the text value's box inside the property; Enter there moves on to hospital.
  const valueBox = doc.createElement('textarea'); valueBox.id = 'edit-block-value';
  doc.getElementById('t-notes').closest('.bottom-property-content').appendChild(valueBox);
  valueBox.focus();
  await new Promise(resolve => setTimeout(resolve, 150));
  valueBox.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  valueBox.remove();
  await new Promise(resolve => setTimeout(resolve, 150));
  cases++;
  if (pressed.join() !== 't-notes,t-hosp') problem(`Enter in a text value: opened ${pressed.join()}; wanted hospital next`);
  if (!doc.getElementById('t-hosp').closest('[data-rfs-at]') || doc.getElementById('t-notes').closest('[data-rfs-at]')) problem('Enter in a text value: the mark did not move to hospital');
  // The hospital list; Enter picks (Logseq closes it) and, being the last, the next bullet is made.
  const list = doc.createElement('div'); list.className = 'cp__select'; list.innerHTML = '<input class="cp__select-input">'; doc.body.appendChild(list);
  list.querySelector('input').focus();
  await new Promise(resolve => setTimeout(resolve, 150));
  list.querySelector('input').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  list.remove(); box.blur();
  await new Promise(resolve => setTimeout(resolve, 400));
  cases++;
  if (inserted.map(i => i.join(':')).join() !== '0e000000-0000-4000-8000-0000000000e1:true' || !edited.includes('b-next-bullet')) problem(`Enter on the last property: made ${JSON.stringify(inserted)}, edited ${edited.join()}; wanted the next bullet`);
  if (doc.querySelector('[data-rfs-at]')) problem('done: the mark stays on a property');
  // Option-Enter inside a list (one that holds several stays open after Enter): the bullet is done.
  inserted.length = 0; edited.length = 0;
  box.focus();
  box.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true, cancelable: true }));
  const list2 = doc.createElement('div'); list2.className = 'cp__select'; list2.innerHTML = '<input class="cp__select-input">'; doc.body.appendChild(list2);
  list2.querySelector('input').focus();
  await new Promise(resolve => setTimeout(resolve, 150));
  list2.querySelector('input').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true, cancelable: true }));
  list2.remove();
  await new Promise(resolve => setTimeout(resolve, 300));
  cases++;
  if (inserted.length !== 1) problem(`Option-Enter in a list: made ${inserted.length} next bullets; wanted one`);
}
// 20. Into the bullet's own properties with Logseq's keys (Down, then Left/Right): not leaving it; the proposals wait.
//     Leaving them for somewhere else is leaving the bullet (0.4.208).
{
  const doc = window.document;
  doc.body.innerHTML = '<div class="ls-block" blockid="b-visit"><div class="block-main-container"><div class="flex-col"><div class="flex-col">'
    + '<textarea id="edit-block-b-visit">Phone call with Dr. Patel</textarea><div class="positioned-properties block-below"><div class="bottom-properties-row">'
    + '<div class="bottom-property-pill" tabindex="-1"><span>doctor:</span><span class="bottom-property-content"><span class="empty-value">—</span></span></div>'
    + '<div class="bottom-property-pill" tabindex="-1" id="p-hosp"><span>hospital:</span><span class="bottom-property-content"><span class="empty-value">—</span></span></div>'
    + '</div></div></div></div></div></div><div id="elsewhere" tabindex="-1">elsewhere</div>';
  const box = doc.querySelector('textarea');
  box.focus();
  await new Promise(resolve => setTimeout(resolve, 100)); // the pretend window works out nothing on focus: let it pass
  const guess = piecesFor(bullet('x', [T.appointment], journal), box.value, ctx).pieces.find(p => p.guess);
  const visit = { uuid: 'b-visit', recordUuid: 'b-visit', text: box.value, pieces: [guess] };
  window.refinementShadow.live = visit;
  window.refinementShadowInner.drawInPlace(doc);
  doc.getElementById('p-hosp').focus(); // Logseq's Down puts the focus on a capsule
  await new Promise(resolve => setTimeout(resolve, 400));
  cases++;
  if (visit.left || !doc.querySelector('.rfs-ghost')) problem('into the bullet\'s own properties: the proposals were taken or went');
  // Another bullet's proposals come up as the focus goes there: the visited bullet is still left, and filled.
  window.refinementShadow.live = { uuid: 'b-other', recordUuid: 'b-other', text: '', pieces: [] };
  doc.getElementById('elsewhere').focus();
  await new Promise(resolve => setTimeout(resolve, 500));
  cases++;
  if (!visit.left) problem('out of the properties into another bullet with proposals: the visited bullet is not left');
  window.refinementShadow.live = null;
  window.refinementShadowInner.drawInPlace(doc);
}
// 18. Escape clears the proposals only until the bullet is next edited (0.4.204; it was for good).
{
  const doc = window.document;
  doc.body.innerHTML = '<div class="ls-block" blockid="b-hush"><textarea>Wiped out all day.</textarea></div>';
  const box = doc.querySelector('textarea');
  box.focus();
  window.refinementShadow.live = { uuid: 'b-hush', recordUuid: 'b-hush', text: box.value, pieces: [] };
  box.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  cases++;
  if (window.refinementShadow.hushed.uuid !== 'b-hush') problem('Escape: the proposals are not cleared for the bullet');
  box.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true }));
  box.blur();
  await new Promise(resolve => setTimeout(resolve, 200));
  cases++;
  if (window.refinementShadow.hushed.uuid) problem('Escape: the bullet stays cleared after it is left, so its proposals never come back');
}
if (problems.length) { console.log(`proposals rules: FAILED (${problems.length})`); process.exit(1); }
console.log(`proposals rules: OK (${cases} cases on a pretend graph)`);
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
