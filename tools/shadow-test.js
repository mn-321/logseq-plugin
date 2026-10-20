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
window.refinementCore = { watchDomEarly() {}, dsQuery: async () => [], UUID: /^[0-9a-f-]{36}$/i, propSchema: async () => null, propPages: async () => [], sendStyle() {},
  bare: v => String(v ?? '').replace(/^:/, ''), pick: (n, name) => n?.[name] ?? n?.[':' + name] ?? n?.[name.slice(name.indexOf('/') + 1)], idOf: v => typeof v === 'number' ? v : v?.['db/id'], titleOf: b => b?.title || '', provided: {} };
window.refinementParts.find(p => p.name === 'proposals').start();
const { piecesFor, addHistory } = window.refinementShadowInner;

// The pretend graph: tags Entity > Person > Doctor, Place > Hospital, Occurrence > Appointment > Consultation, Symptom log.
const T = { entity: 1, person: 2, doctor: 3, place: 4, hospital: 5, occurrence: 6, appointment: 7, consultation: 8, log: 9, symptom: 10 };
const prop = (id, title, type, classes = [], many = false) => ({ id, ident: 'user.property/' + title.replace(/\W/g, '-').toLowerCase(), title, lower: title.toLowerCase(), type, many, classes: classes.map(c => ({ id: c, uuid: 'tag-' + c, title: 'Tag ' + c })) });
const props = [prop(20, 'doctor', 'node', [T.doctor]), prop(21, 'with', 'node', [T.person], true), prop(22, 'hospital', 'node', [T.hospital]), prop(23, 'Date', 'date'), prop(24, 'symptoms', 'node', [T.symptom], true)];
const schema = { props, byId: new Map(props.map(p => [p.id, p])),
  classProps: new Map([[T.appointment, [20, 21, 22, 23]], [T.log, [23, 24]]]),
  parentsOf: new Map([[T.person, [T.entity]], [T.doctor, [T.person]], [T.place, [T.entity]], [T.hospital, [T.place]], [T.appointment, [T.occurrence]], [T.consultation, [T.appointment]]]) };
const page = (id, title, tags, extra = {}) => ({ id, uuid: 'page-' + id, title, lower: title.toLowerCase(), tags: tags.map(t => ({ id: t, title: 'Tag ' + t, ident: 'user.class/t' + t })), isTag: false, ...extra });
const pages = [page(100, 'Dr. Mei Chen', [T.doctor]), page(101, 'Dr. Raj Patel', [T.doctor]), page(102, 'Ruth Okoro', [T.person]), page(103, 'Hannah Reyes', [], { tags: [{ id: 999, title: 'Page', ident: 'logseq.class/Page' }] }),
  page(104, 'Northgate Cancer Center', [T.hospital]), page(105, 'Nausea', [T.symptom]), page(106, 'Northgate', []), page(107, 'Fatigue', [T.symptom]),
  page(108, 'Tingling fingers', [T.symptom]), page(109, 'Cold sensitivity', [T.symptom]), { id: 200, uuid: 'tag-8', title: 'Consultation', lower: 'consultation', tags: [], isTag: true },
  { id: T.log, uuid: 'tag-9', title: 'Symptom log', lower: 'symptom log', tags: [], isTag: true }, { id: T.symptom, uuid: 'tag-10', title: 'Symptom', lower: 'symptom', tags: [], isTag: true }];
const byKey = new Map(), byId = new Map();
for (const p of pages) { byKey.set(p.lower, p); byKey.set(p.uuid, p); byId.set(p.id, p); }
const ctx = { schema, pages, byKey, byId, tagNames: pages.filter(p => p.isTag).map(p => p.lower).sort((a, b) => b.length - a.length), days: new Map([[300, 20261020], [301, 20261019]]), dated: new Map([[T.log, { same: 18, other: 0 }], [T.appointment, { same: 3, other: 5 }]]),
  aliases: [[104, 106]] };
// Lines written before, for "the same line written before": two symptom logs saying "Wiped out all day." with Fatigue,
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
expect('plain words, "Dr." alone', piecesFor(bullet('x', [T.appointment], journal), 'Saw the Dr. today', ctx), '(nothing)');
expect('plain words, two doctors', piecesFor(bullet('x', [T.appointment], journal), 'Saw Dr. Chen and Dr. Patel', ctx), '(nothing)');
expect('plain words, two symptoms tie', piecesFor(bullet('x', [T.log], journal), 'Cold hurts my fingers', ctx), 'Date=Oct 20');
// 11. The same line written before under the same tag gives its values, when the earlier ones agree.
expect('same line before', piecesFor(bullet('x', [T.log], journal), 'Wiped out all day.', ctx), 'Date=Oct 20 · symptoms=Fatigue?');
expect('same line before, disagreeing', piecesFor(bullet('x', [T.log], journal), 'Bad day.', ctx), 'Date=Oct 20');
// 12. Two doctors linked keep the doctor quiet: no guess either (Jul 17 in the Illness Test Graph).
expect('two doctors, no guess', piecesFor(bullet('x', [T.consultation], journal), 'Saw [[Dr. Raj Patel]] and [[Dr. Mei Chen]] with Dr. Patel', ctx), '(nothing)');

const guessKeyOf = piece => `${piece.ident} ${piece.ids.join(',')}`;
// 13. Enter takes the guesses (the owner: "enter confirms"; 0.4.202). A click on a proposed value does nothing, and
//     keeps the bullet in edit: the mouse press is held back, the pointer press is not (holding that back stops the
//     mouse press from coming at all; found in the app).
(async () => {
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
