#!/usr/bin/env node
/* What the proposals write to the notes, and what Undo takes back (2026-10-21, after the code review: nothing that
   writes had a test). A pretend Logseq: a small store of blocks behind a pretend database and a pretend Editor that
   records every write. The bullet is driven the way Logseq drives it: typing (input), Enter, Escape, leaving (focus
   out), and the plugin being switched off, with the database made slow on purpose to open the timing races.
   Needs node and jsdom. Run from the repo root: node tools/shadow-write-test.js   (tools/check.sh runs it) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const problems = [];
let cases = 0;
const problem = text => { problems.push(text); console.log('PROBLEM: ' + text); };
const check = (ok, text) => { cases++; if (!ok) problem(text); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.parent = window;
const doc = window.document;

/* The pretend graph. */
const U = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const T = { occurrence: 6, doctor: 3, consultation: 8, log: 9, symptom: 10 };
const prop = (id, title, type, classes = [], many = false) => ({ id, ident: 'user.property/' + title.replace(/\W/g, '-').toLowerCase(), title, lower: title.toLowerCase(), type, many, classes: classes.map(c => ({ id: c, uuid: 'tag-' + c, title: 'Tag ' + c })) });
const props = [prop(20, 'doctor', 'node', [T.doctor]), prop(23, 'Date', 'date'), prop(24, 'symptoms', 'node', [T.symptom], true)];
const schema = { props, byId: new Map(props.map(p => [p.id, p])), classProps: new Map([[T.consultation, [20]], [T.log, [24]], [T.occurrence, [23]]]),
  parentsOf: new Map([[T.consultation, [T.occurrence]], [T.log, [T.occurrence]]]) };
const tagPage = (id, title) => ({ id, uuid: 'tag-' + id, title, lower: title.toLowerCase(), tags: [{ id: 999, title: 'Tag', ident: 'logseq.class/Tag' }], isTag: true });
const page = (id, title, tag) => ({ id, uuid: U(id), title, lower: title.toLowerCase(), tags: [{ id: tag, title: 'Tag ' + tag, ident: 'user.class/t' + tag }], isTag: false });
const pages = [tagPage(T.consultation, 'Consultation'), tagPage(T.log, 'Symptom log'), tagPage(T.doctor, 'Doctor'), tagPage(T.symptom, 'Symptom'),
  page(100, 'Dr. Mei Chen', T.doctor), page(101, 'Dr. Raj Patel', T.doctor), page(107, 'Fatigue', T.symptom), { ...page(102, 'Dr. New', 0), tags: [] }];
const tagIdOf = uuid => Number(String(uuid).replace('tag-', ''));
const JOURNAL = { 'db/id': 300, 'block/uuid': U(300), 'block/title': 'Oct 20th, 2026', 'block/journal-day': 20261020, 'block/tags': [] };

// The store: blocks by uuid, each with its words, tags and property values (ids, or a number).
const store = new Map();
const addBlock = (n, title, tags = []) => { const b = { id: n, uuid: U(n), title, tags: new Set(tags), props: new Map() }; store.set(b.uuid, b); return b; };
const pulled = b => { const out = { 'db/id': b.id, 'block/uuid': b.uuid, 'block/title': b.title, 'block/tags': [...b.tags].map(id => ({ 'db/id': id })), 'block/page': JOURNAL, 'block/parent': JOURNAL };
  for (const [ident, v] of b.props) out[ident] = Array.isArray(v) ? v.map(id => ({ 'db/id': id })) : typeof v === 'number' && v > 1000 ? { 'db/id': v } : v; return out; };
let slowPull = 0;
const writes = [];
let failRemoves = 0;
async function dsQuery(q) {
  const one = q.replace(/\s+/g, ' ');
  let m;
  if ((m = one.match(/^\[:find \(pull \?b .*:where \[\?b :block\/uuid #uuid "([^"]+)"\]\]$/))) { if (slowPull) await wait(slowPull); const b = store.get(m[1]); return b ? [[pulled(b)]] : []; }
  if (one.startsWith('[:find ?p ?d :where [?p :block/journal-day ?d]]')) return [[300, 20261020]];
  if (one.includes('?same (count ?b)') && one.includes(':user.property/date ')) return [[T.log, true, 18], [T.consultation, true, 3], [T.consultation, false, 5]];
  if (one.includes('[?t :block/tags :logseq.class/Tag] [?t :db/ident ?i]')) return [[T.consultation, 'user.class/consultation'], [T.log, 'user.class/log']];
  if (one.includes('(ground #{')) return [500, 501].map(id => [{ 'db/id': id, 'block/title': 'Wiped out all day.', 'block/tags': [{ 'db/id': T.log }], 'user.property/symptoms': [{ 'db/id': 107 }] }]);
  // The value a record holds now, for Undo (the model's valuesOf): [:find ?v :where [?b :block/uuid #uuid "…"] [?b :ident ?v]].
  if ((m = one.match(/^\[:find \?v :where \[\?[br] :block\/uuid #uuid "([^"]+)"\] \[\?[br] :([^\s\]]+) \?v\]\]$/))) {
    const v = store.get(m[1])?.props.get(m[2]); return v == null ? [] : (Array.isArray(v) ? v : [v]).map(x => [x]); }
  // The [[Dr. New]]#Doctor fill: the pages the bullet links, its words now, whether a page has a tag.
  if ((m = one.match(/^\[:find \?p \?u \?t :where \[\?b :block\/uuid #uuid "([^"]+)"\] \[\?b :block\/refs \?p\]/))) {
    const b = store.get(m[1]); return pages.filter(p => !p.isTag && b?.title.includes(`[[${p.title}]]`)).map(p => [p.id, p.uuid, p.title]); }
  if ((m = one.match(/^\[:find \?t :where \[\?b :block\/uuid #uuid "([^"]+)"\] \[\?b :block\/title \?t\]\]$/))) { const b = store.get(m[1]); return b ? [[b.title]] : []; }
  if (/^\[:find \?t :where \[\?p :block\/uuid #uuid "[^"]+"\] \[\?p :block\/tags \?t\]/.test(one)) return [];
  return []; // aliases, plain lines, pages linked in the words, …
}
window.logseq = {
  settings: { shadowProposals: true, shadowSkipGraphs: '' }, updateSettings() {}, onSettingsChanged: () => () => {},
  App: { getCurrentGraph: async () => ({ name: 'Test' }), getUserConfigs: async () => ({}), onCurrentGraphChanged: fn => { window.graphChanged = fn; return () => {}; } }, UI: { showMsg() {} }, DB: { onChanged: () => () => {} },
  Editor: {
    async upsertBlockProperty(uuid, ident, value, opts) { writes.push(['set', uuid, ident, value]); store.get(uuid)?.props.set(ident, Array.isArray(value) ? [...value] : opts?.entityId ? [value] : value); },
    async removeBlockProperty(uuid, ident) { if (failRemoves > 0) { failRemoves--; throw new Error('pretend failure'); } writes.push(['remove', uuid, ident]); store.get(uuid)?.props.delete(ident); },
    async addBlockTag(uuid, tagUuid) { writes.push(['tag', uuid, tagIdOf(tagUuid)]); store.get(uuid)?.tags.add(tagIdOf(tagUuid)); },
    async removeBlockTag(uuid, tagUuid) { writes.push(['untag', uuid, tagIdOf(tagUuid)]); store.get(uuid)?.tags.delete(tagIdOf(tagUuid)); },
    async updateBlock(uuid, title) { writes.push(['words', uuid, title]); const b = store.get(uuid); if (b) b.title = title; },
    async insertBlock() { return null; }, async editBlock() {}, async createPage() { return null; },
  },
};
// LEAVE_OUT=shadow-steps,shadow-page (tools/parts-apart-test.js, 0.4.269): the writing goes on without those pieces.
const LEAVE_OUT = (process.env.LEAVE_OUT || '').split(',').filter(Boolean);
for (const file of ['parts/shared.js', 'parts/model.js', 'parts/alike.js', 'parts/shadow-rules.js', 'parts/shadow.js', 'parts/shadow-steps.js', 'parts/shadow-page.js'].filter(f => !LEAVE_OUT.includes(f.slice(6, -3)))) window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
let early = () => {};
const core = window.refinementCore = { onPageChange() {}, onGraphChange(fn) { window.graphChanged = fn; }, onDatabaseChange() {}, onSettingsChange() {}, screen: window.refinementShared.screen, watchDomEarly(fn) { early = fn; }, dsQuery, UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, sendStyle() {},
  propSchema: async () => schema, propPages: async () => pages, bare: v => String(v ?? '').replace(/^:/, ''),
  pick: (n, name) => n?.[name] ?? n?.[':' + name] ?? n?.[name.slice(name.indexOf('/') + 1)], idOf: v => typeof v === 'number' ? v : v?.['db/id'], titleOf: b => b?.title || '',
  parseDay: () => null, dayAfter: (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n), dayNumber: d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(),
  journalIdFor: async () => 300, journalTitleFor: async () => 'a day', provided: {}, provide: things => Object.assign(core.provided, things) };
window.eval(require('./pretend-model')); // the model answers through dsQuery above; the stubs on the core win (0.4.226)
const parts = Object.fromEntries(window.refinementParts.map(p => [p.name, p]));
parts.alike.provide(core);
parts.proposals.provide(core);
parts.proposals.start();
// The one register (main.js), stood in for: the proposals' two `keys` commands run when their keys are pressed.
window.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || !event.altKey) return;
  const command = parts.proposals.commands.find(c => c.key === (event.metaKey ? 'proposals-accept-all' : 'proposals-step'));
  if (command && command.run(event) === true) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
const inner = window.refinementCore.provided.proposalsInner, state = window.refinementCore.provided.proposalsState;

// A bullet on screen as Logseq draws it: its box, and its row of property capsules under the words.
function onScreen(b, text) {
  doc.body.innerHTML = `<div class="ls-block" blockid="${b.uuid}"><div class="block-main-container"><div class="flex-col"><div class="flex-col">`
    + `<textarea></textarea><div class="positioned-properties block-below"><div class="bottom-properties-row"></div></div></div></div></div></div><button id="elsewhere">x</button>`;
  const box = doc.querySelector('textarea');
  box.value = text;
  return box;
}
const type = async (box, more = '') => { box.focus(); box.value += more; box.dispatchEvent(new window.Event('input', { bubbles: true })); await wait(60 + slowPull); };
const key = (box, k) => { const e = new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); box.dispatchEvent(e); return e; };
// Leaving: the box goes and Logseq draws the bullet's line in its place, where the undo arrow goes (0.4.218).
const leave = async box => {
  box.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })); box.blur(); doc.getElementById('elsewhere').focus();
  const line = doc.createElement('div'); line.className = 'block-title-wrap'; line.textContent = box.value; box.replaceWith(line);
  await wait(500);
};
// Editing the bullet again: Logseq puts a box back in place of its line.
const editAgain = b => { const row = doc.querySelector(`.ls-block[blockid="${b.uuid}"]`); const line = row.querySelector('.block-title-wrap'); const box = doc.createElement('textarea'); box.value = b.title; line.replaceWith(box); box.focus(); return box; };
const ghosts = () => [...doc.querySelectorAll('.rfs-ghost')].map(g => g.textContent);
// Logseq drawing a written value: its own filled capsule in the bullet's row.
const shows = async (b, name, text) => { const row = doc.querySelector(`.ls-block[blockid="${b.uuid}"] .bottom-properties-row`); const pill = doc.createElement('div'); pill.className = 'bottom-property-pill'; pill.innerHTML = `<span>${name}:</span><span class="bottom-property-content"><a>${text}</a></span>`; row.prepend(pill); early(doc, [{ type: 'childList', addedNodes: [pill], removedNodes: [] }]); await wait(60); };
const undo = async () => { const arrow = doc.querySelector('.rfs-undo'); if (arrow) arrow.click(); await wait(100); return !!arrow; };
const reset = () => { writes.length = 0; slowPull = 0; failRemoves = 0; state.live = null; state.hushed.uuid = ''; state.undos.clear(); };

(async () => {
  await inner.guessDataFor(await inner.daysFor(await inner.contextFor()));

  // 1. A linked doctor: shown, written when the bullet is left, and taken off again by Undo.
  {
    reset();
    const b = addBlock(1001, 'Saw [[Dr. Mei Chen]] today', [T.consultation]);
    const box = onScreen(b, b.title);
    await type(box);
    check(ghosts().join() === 'Dr. Mei Chen', `1. a linked doctor: shown ${JSON.stringify(ghosts())}; wanted Dr. Mei Chen`);
    await leave(box);
    check(JSON.stringify(writes) === JSON.stringify([['set', b.uuid, 'user.property/doctor', 100]]), `1. leaving wrote ${JSON.stringify(writes)}; wanted the doctor only`);
    // The value stays on screen, solid, until Logseq draws its own (0.4.283: before, the pill was empty for a moment).
    check(doc.querySelector('.rfs-ghost.rfs-taken')?.textContent === 'Dr. Mei Chen', `1. after leaving, the written value is not kept on screen, solid (${JSON.stringify(ghosts())})`);
    await shows(b, 'doctor', 'Dr. Mei Chen');
    check(!ghosts().length, '1. after Logseq drew the value, the kept value is still on screen');
    writes.length = 0;
    const arrow = doc.querySelector(`.ls-block[blockid="${b.uuid}"] .block-title-wrap > .rfs-undo`);
    check(arrow && /doctor: Dr\. Mei Chen/.test(arrow.title), `1. no faded undo arrow at the end of the bullet's line, saying what it takes off (${arrow?.title})`);
    check(!doc.querySelector('.refinement-undo-bar'), '1. the old Undo bar is still shown at the bottom');
    check(await undo(), '1. no undo arrow after the fill');
    check(JSON.stringify(writes) === JSON.stringify([['remove', b.uuid, 'user.property/doctor']]) && !b.props.has('user.property/doctor'), `1. Undo did ${JSON.stringify(writes)}; wanted the doctor taken off`);
  }
  // 2. Enter takes the guesses too (0.4.219, as from 0.4.202); a click away writes the sure values alone; Tab is Logseq's.
  {
    reset();
    const b = addBlock(1002, 'Wiped out all day.', [T.log]);
    let box = onScreen(b, b.title);
    await type(box);
    check(ghosts().sort().join() === 'Fatigue,Oct 20', `2. a log: shown ${JSON.stringify(ghosts())}; wanted Oct 20 and Fatigue`);
    await leave(box);
    check(JSON.stringify(writes) === JSON.stringify([['set', b.uuid, 'user.property/date', 300]]), `2. a click away wrote ${JSON.stringify(writes)}; wanted the sure date only`);
    reset(); b.props.clear();
    box = onScreen(b, b.title);
    await type(box);
    check(!key(box, 'Tab').defaultPrevented, '2. Tab was taken by the plugin (Logseq would not indent)');
    key(box, 'Enter');
    await leave(box);
    const sets = writes.filter(w => w[0] === 'set').map(w => w[2]).sort().join();
    check(sets === 'user.property/date,user.property/symptoms', `2. Enter then leaving wrote ${JSON.stringify(writes)}; wanted the date and the guessed symptom`);
  }
  // 3. An untagged bullet, Enter: the tag first, then the values that rest on it; Undo takes the values off, then the tag.
  {
    reset();
    const b = addBlock(1003, 'Wiped out all day.', []);
    const box = onScreen(b, b.title);
    await type(box);
    check(ghosts().includes('Symptom log'), `3. untagged: shown ${JSON.stringify(ghosts())}; wanted the tag Symptom log (in mono, no #, 0.4.315)`);
    key(box, 'Enter');
    await leave(box);
    check(writes[0]?.[0] === 'tag' && writes[0][2] === T.log && writes.slice(1).every(w => w[0] === 'set') && writes.length >= 2, `3. untagged, Enter: wrote ${JSON.stringify(writes)}; wanted the tag first, then the values`);
    writes.length = 0;
    await undo();
    check(writes.length >= 2 && writes[writes.length - 1][0] === 'untag' && !b.tags.size && !b.props.size, `3. Undo did ${JSON.stringify(writes)}; wanted the values off, then the tag`);
  }
  // 4. Undo leaves alone a value the owner chose by hand after the fill.
  {
    reset();
    const b = addBlock(1004, 'Saw [[Dr. Mei Chen]] again', [T.consultation]);
    const box = onScreen(b, b.title);
    await type(box);
    await leave(box);
    b.props.set('user.property/doctor', [101]); // chosen by hand in Logseq after the fill
    writes.length = 0;
    await undo();
    check(JSON.stringify(b.props.get('user.property/doctor')) === '[101]', `4. Undo took off a doctor chosen by hand afterwards (did ${JSON.stringify(writes)})`);
  }
  // 5. Undo goes on past a step that fails, and says so.
  {
    reset();
    const b = addBlock(1005, 'Wiped out all day.', []);
    const box = onScreen(b, b.title);
    await type(box);
    key(box, 'Enter');
    await leave(box);
    writes.length = 0;
    failRemoves = 1;
    await undo();
    check(!b.tags.size, `5. one step of Undo failed and the rest was not undone (did ${JSON.stringify(writes)})`);
  }
  // 6. Escape while the plugin is still working out a key: the values must not come back, nor be written on leaving.
  {
    reset();
    const b = addBlock(1006, 'Saw [[Dr. Mei Chen]] about it', [T.consultation]);
    const box = onScreen(b, b.title);
    await type(box);
    slowPull = 120;
    box.value += ' '; box.dispatchEvent(new window.Event('input', { bubbles: true }));
    await wait(80); // the check for this key is waiting on the database
    key(box, 'Escape');
    await wait(200); // and it finishes
    check(!ghosts().length && !state.live, `6. Escape during a check: the values came back (${JSON.stringify(ghosts())})`);
    await leave(box);
    check(!writes.length, `6. Escape during a check: leaving wrote ${JSON.stringify(writes)}`);
  }
  // 7. A check that finishes after the bullet was left leaves nothing on screen.
  {
    reset();
    const b = addBlock(1007, 'Saw [[Dr. Raj Patel]] briefly', [T.consultation]);
    const box = onScreen(b, b.title);
    slowPull = 150;
    box.focus(); box.dispatchEvent(new window.Event('input', { bubbles: true }));
    await wait(60);
    await leave(box);
    await wait(200);
    check(!ghosts().length && !state.live, `7. a late check after leaving: faint values left on screen (${JSON.stringify(ghosts())})`);
  }
  // 8. A graph left out in the setting: nothing shown, nothing written, Option-Enter is Logseq's.
  {
    reset();
    window.logseq.settings.shadowSkipGraphs = 'Another, Test';
    const b = addBlock(1008, 'Saw [[Dr. Mei Chen]] there', [T.consultation]);
    const box = onScreen(b, b.title);
    // An empty property Option-Enter could open.
    doc.querySelector('.bottom-properties-row').innerHTML = '<div class="bottom-property-pill"><span>doctor:</span><span class="bottom-property-content"><div class="empty-value" data-type="node"><div class="jtrigger">—</div></div></span></div>';
    await type(box);
    check(!ghosts().length, '8. another graph: values shown');
    const optEnter = new window.KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true, cancelable: true });
    box.dispatchEvent(optEnter);
    check(!optEnter.defaultPrevented, '8. another graph: Option-Enter was taken by the plugin');
    await leave(box);
    check(!writes.length, `8. another graph: wrote ${JSON.stringify(writes)}`);
    window.logseq.settings.shadowSkipGraphs = '';
  }
  // 10. [[Dr. New]]#Doctor: the page gets the tag, the property the page, and the tag goes from the bullet and its words.
  {
    reset();
    const b = addBlock(1010, 'Call with [[Dr. New]]#Doctor today', [T.consultation, T.doctor]);
    const box = onScreen(b, b.title);
    await type(box);
    check(ghosts().join() === 'Dr. New #Doctor', `10. page tag: shown ${JSON.stringify(ghosts())}; wanted "Dr. New #Doctor"`);
    await leave(box);
    const kinds = writes.map(w => w[0]).join();
    check(kinds === 'tag,set,words,untag' && b.title === 'Call with [[Dr. New]] today' && !b.tags.has(T.doctor), `10. page tag: wrote ${JSON.stringify(writes)}; words now "${b.title}"`);
    writes.length = 0;
    await undo();
    check(b.title === 'Call with [[Dr. New]]#Doctor today' && b.tags.has(T.doctor) && !b.props.has('user.property/doctor'), `10. page tag, Undo: did ${JSON.stringify(writes)}; words now "${b.title}"`);
  }
  // 11. The same, with words written while the fill runs: they are kept, and the fill is put back.
  {
    reset();
    const b = addBlock(1011, 'Phone with [[Dr. New]]#Doctor now', [T.consultation, T.doctor]);
    const box = onScreen(b, b.title);
    await type(box);
    const addTag = window.logseq.Editor.addBlockTag;
    window.logseq.Editor.addBlockTag = async (uuid, tag) => { await addTag(uuid, tag); b.title += ' and more'; }; // typed meanwhile
    await leave(box);
    window.logseq.Editor.addBlockTag = addTag;
    check(b.title === 'Phone with [[Dr. New]]#Doctor now and more' && !b.props.has('user.property/doctor') && !writes.some(w => w[0] === 'words'),
      `11. words written during the fill: wrote ${JSON.stringify(writes)}; words now "${b.title}"`);
  }
  // 12. The undo arrow stays (no time limit) until the bullet is edited again; then it goes, and the values stay.
  {
    reset();
    const b = addBlock(1012, 'Saw [[Dr. Raj Patel]] at last', [T.consultation]);
    const box = onScreen(b, b.title);
    await type(box);
    await leave(box);
    await wait(300);
    check(!!doc.querySelector('.rfs-undo'), '12. the undo arrow went by itself');
    editAgain(b);
    await wait(100);
    check(!doc.querySelector('.rfs-undo') && !state.undos.size && b.props.has('user.property/doctor'), '12. editing the bullet again: the arrow did not go, or the values went with it');
  }
  // 13. A press on the arrow does not put the bullet in edit (Logseq never hears of it).
  {
    reset();
    const b = addBlock(1013, 'Saw [[Dr. Mei Chen]] once more', [T.consultation]);
    const box = onScreen(b, b.title);
    await type(box);
    await leave(box);
    const arrow = doc.querySelector('.rfs-undo');
    let heard = false;
    doc.body.addEventListener('mousedown', () => { heard = true; }, { once: true });
    const e = new window.MouseEvent('mousedown', { bubbles: true, cancelable: true });
    arrow?.dispatchEvent(e);
    check(arrow && e.defaultPrevented && !heard, '13. a press on the undo arrow reached Logseq (it would open the bullet)');
    doc.body.replaceChildren();
  }
  // 14. A click on a guess accepts it (0.4.242): leaving with a click away writes it with the sure values; a second
  // click takes the acceptance back. The press never reaches Logseq.
  {
    reset();
    const b = addBlock(1014, 'Wiped out all day.', [T.log]);
    let box = onScreen(b, b.title);
    await type(box);
    const guess = [...doc.querySelectorAll('.rfs-ghost.rfs-guess')].find(g => g.textContent === 'Fatigue');
    const down = new window.MouseEvent('mousedown', { bubbles: true, cancelable: true });
    guess?.dispatchEvent(down);
    guess?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    check(guess && down.defaultPrevented, '14. a press on a guess reached Logseq');
    check(doc.querySelector('.rfs-ghost.rfs-taken')?.textContent === 'Fatigue', '14. a clicked guess does not look accepted');
    await leave(box);
    let sets = writes.filter(w => w[0] === 'set').map(w => w[2]).sort().join();
    check(sets === 'user.property/date,user.property/symptoms', `14. a clicked guess, then a click away, wrote ${JSON.stringify(writes)}; wanted the date and the clicked symptom`);
    reset(); b.props.clear();
    box = onScreen(b, b.title);
    await type(box);
    const again = [...doc.querySelectorAll('.rfs-ghost.rfs-guess')].find(g => g.textContent === 'Fatigue');
    for (let i = 0; i < 2; i++) again?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await leave(box);
    sets = writes.filter(w => w[0] === 'set').map(w => w[2]).sort().join();
    check(sets === 'user.property/date', `14. a guess clicked twice wrote ${JSON.stringify(writes)}; wanted the sure date only`);
  }
  // 15. Cmd-Option-Enter (0.4.259; Ctrl-Enter from 0.4.242): everything shown is accepted and the bullet is left, with no new bullet (Logseq never
  // hears the key).
  {
    reset();
    const b = addBlock(1015, 'Wiped out all day.', [T.log]);
    const box = onScreen(b, b.title);
    await type(box);
    let exited = false;
    const before = window.logseq.Editor.exitEditingMode;
    window.logseq.Editor.exitEditingMode = async () => { exited = true; };
    const e = new window.KeyboardEvent('keydown', { key: 'Enter', metaKey: true, altKey: true, bubbles: true, cancelable: true });
    box.dispatchEvent(e);
    check(e.defaultPrevented, '15. Cmd-Option-Enter reached Logseq');
    check(exited, '15. Cmd-Option-Enter did not leave the bullet');
    await leave(box);
    window.logseq.Editor.exitEditingMode = before;
    const sets = writes.filter(w => w[0] === 'set').map(w => w[2]).sort().join();
    check(sets === 'user.property/date,user.property/symptoms', `15. Cmd-Option-Enter wrote ${JSON.stringify(writes)}; wanted the date and the guessed symptom`);
  }
  // 16. Another graph opened while a bullet showed proposals (0.4.276): nothing shown stays, and the answer to "may this
  //     graph be written in" is forgotten until the next check (Option-Enter and Down right after the switch stay Logseq's).
  {
    reset();
    const b = addBlock(1016, 'Saw [[Dr. Mei Chen]] again', [T.consultation]);
    const box = onScreen(b, b.title);
    await type(box);
    check(ghosts().length === 1 && state.allowedNow === true, `16. before the switch: shown ${JSON.stringify(ghosts())}, allowed ${state.allowedNow}`);
    window.graphChanged();
    await wait(100);
    check(!ghosts().length && !state.live && state.allowedNow === false, `16. after the switch: shown ${JSON.stringify(ghosts())}, allowed ${state.allowedNow}; wanted nothing shown and the graph check forgotten`);
  }
  // 9. Switched off with a fill still waiting: nothing is written afterwards.
  {
    reset();
    const b = addBlock(1009, 'Saw [[Dr. Mei Chen]] late', [T.consultation]);
    const box = onScreen(b, b.title);
    await type(box);
    box.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })); box.blur();
    parts.proposals.stop();
    await wait(500);
    check(!writes.length, `9. switched off while leaving: wrote ${JSON.stringify(writes)} afterwards`);
  }

  console.log(`proposals' writes: ${cases} checks`);
  if (problems.length) { console.log(`shadow-write-test: FAILED (${problems.length})`); process.exit(1); }
  console.log('shadow-write-test: OK');
  process.exit(0);
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
