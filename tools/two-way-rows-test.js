#!/usr/bin/env node
/* The two-way rows' grouping, the + inside a group and writing into a node (parts/two-way.js, 0.4.369) in a pretend
   Logseq window: a page with six nodes pointing at it through one property ("about"), their tags, days and a
   property of their own (Confidence), behind a stand-in for the model's doors that records every write.
   Checks: the plain list when nothing is chosen; groups by a property's value (biggest first, none last, each group
   folding), by tag and by month; the + in a group (not in a month or a "none" group) opening its line in the group and
   making the node with the row's property, the group's tag or value and nothing else; a node's arrow opening its
   bullets, the links in them, a new bullet written into the node (and nothing before Enter), the faded Undo taking it
   away, and the arrow closing it; and nothing left on stop. Needs node and jsdom.
   Run from the repo root: node tools/two-way-rows-test.js   (tools/check.sh runs it) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const problems = [];
let cases = 0;
const check = (ok, text) => { cases++; if (!ok) { problems.push(text); console.log('PROBLEM: ' + text); } };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const U = n => `6a000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PAGE = U(1), JOURNAL = U(900);

// Six nodes point at the page. Confidence: two Strong, two Disputed, two with none (one is a Question).
const NODES = [
  { id: 101, title: 'Spacing beats cramming for recall a week later.', tag: 'Claim', day: 20260901, confidence: ['Strong', 301], severity: 3 },
  { id: 102, title: 'The gap should grow with each review.', tag: 'Claim', day: 20260915, confidence: ['Strong', 301], severity: 3 },
  { id: 103, title: 'Spacing does not help understanding, only recall.', tag: 'Claim', day: 20261001, confidence: ['Disputed', 302], severity: 1 },
  { id: 104, title: 'The best gap is a tenth of the time until the test.', tag: 'Claim', day: 20261010, confidence: ['Disputed', 302], severity: 2 },
  { id: 105, title: 'Does it work for skills?', tag: 'Question', day: 20261012 },
  { id: 106, title: 'What is the best first gap?', tag: 'Question', day: 0 },
];

function world(grouping) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="main-content-container"><div class="ls-page-title"><div class="is-page-title-row"><h1 class="title">Spaced repetition</h1></div><div class="ls-block" blockid="${PAGE}"></div></div><div class="ls-page-properties"></div></div></body></html>`,
    { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.parent = window;
  const doc = window.document;
  if (!window.CSS) window.CSS = {};
  window.CSS.escape ||= s => String(s).replace(/[^\w-]/g, '\\$&');
  if (grouping) window.localStorage.setItem('refinementTwoWayGroup', JSON.stringify({ about: grouping }));
  window.logseq = { settings: {}, provideStyle() {}, onSettingsChanged: () => () => {}, UI: { showMsg() {} } };
  window.eval(fs.readFileSync(path.join(root, 'parts/shared.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'parts/two-way.js'), 'utf8'));
  const calls = [];
  const bullets = new Map([[U(101), [{ uuid: U(701), title: 'Cepeda reviewed 254 studies.' }, { uuid: U(702), title: 'See [[Testing effect]].' }]]]);
  let nextBlock = 800;
  const provided = {
    currentPage: async () => ({ id: 5, uuid: PAGE }),
    getPage: async () => ({ id: 5, uuid: PAGE }),
    linksInto: async () => ({
      pages: new Map([[5, { uuid: PAGE, byField: new Map([['about', new Set(NODES.map(n => n.id))]]) }]]),
      fields: new Map([['about', { uuid: U(50), ident: 'user.property/about' }]]),
      records: new Map(NODES.map(n => [n.id, { uuid: U(n.id), title: n.title, tag: n.tag, day: n.day }])),
    }),
    readableTitle: async text => text,
    nodeValues: async uuids => new Map(NODES.filter(n => uuids.includes(U(n.id)) && (n.confidence || n.severity)).map(n => [U(n.id), new Map([
      ...(n.confidence ? [['Confidence', { ident: 'user.property/confidence', values: [{ text: n.confidence[0], id: n.confidence[1], uuid: U(n.confidence[1]) }] }]] : []),
      ...(n.severity ? [['Severity', { ident: 'user.property/severity', values: [{ text: String(n.severity), number: n.severity }] }]] : []),
    ])])),
    propSchema: async () => ({ props: [
      { ident: 'user.property/about', title: 'about', lower: 'about', type: 'node', many: false, choices: [], classes: [] },
      { ident: 'user.property/confidence', title: 'Confidence', lower: 'confidence', type: 'default', many: false, choices: [{ id: 301, title: 'Strong' }, { id: 302, title: 'Disputed' }], classes: [] },
      { ident: 'user.property/severity', title: 'Severity', lower: 'severity', type: 'number', many: false, choices: [], classes: [] },
    ] }),
    propPages: async () => [],
    pagesAmong: async () => 0,
    tagUuidNamed: async title => `tag-${title.toLowerCase()}`,
    journalTitleFor: async () => 'Oct 24th, 2026',
    journalIdFor: async () => 900,
    uuidById: async () => JOURNAL,
    titleNow: async () => 'Spaced repetition',
    idByUuid: async () => 5,
    nodeFields: async () => new Map(),
    firstLines: async uuid => (bullets.get(uuid) || []).slice(0, 9),
    appendBlock: async (target, text) => { const block = { uuid: U(++nextBlock) }; calls.push(['appendBlock', target, text, block.uuid]); return block; },
    addLineTo: async (uuid, text) => { const block = { uuid: U(++nextBlock) }; calls.push(['addLineTo', uuid, text, block.uuid]); bullets.set(uuid, [...(bullets.get(uuid) || []), { uuid: block.uuid, title: text }]); return block; },
    removeBlock: async uuid => { calls.push(['removeBlock', uuid]); for (const [node, list] of bullets) bullets.set(node, list.filter(b => b.uuid !== uuid)); },
    addTag: async (uuid, tag) => { calls.push(['addTag', uuid, tag]); },
    setValue: async (uuid, ident, value, opts) => { calls.push(['setValue', uuid, ident, JSON.stringify(value), JSON.stringify(opts || null)]); },
    unsetValue: async () => {},
    removeTag: async () => {}, createPage: async () => ({ uuid: U(++nextBlock) }), deletePage: async () => {}, editBlock: async () => {},
  };
  const early = [];
  window.refinementCore = {
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, isEntityId: n => Number.isSafeInteger(n) && n > 0,
    watchDomEarly: fn => early.push(fn), addsElements: () => true, sendStyle() {}, uuidsIn: () => '', saveSettings() {},
    onPageChange() {}, onDatabaseChange() {}, onSettingsChange() {}, provided,
    provide(things) { Object.assign(provided, things); },
  };
  const part = window.refinementParts.find(p => p.name === 'two-way');
  part.provide(window.refinementCore);
  part.start();
  return { window, doc, calls, part, bullets };
}
const click = (window, el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
const type = (window, input, text) => { input.value = text; input.dispatchEvent(new window.Event('input', { bubbles: true })); };
const enter = (window, input) => input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
const names = doc => [...doc.querySelectorAll('.rf-tw-gname')].map(el => el.textContent.trim());
const counts = doc => [...doc.querySelectorAll('.rf-tw-gn')].map(el => el.textContent.trim());
const groupEl = (doc, name) => [...doc.querySelectorAll('.rf-tw-group')].find(g => g.querySelector('.rf-tw-gname')?.textContent.trim() === name);

(async () => {
  // 1. Nothing chosen: the list as it was, with the quiet word to group it by.
  {
    const { window, doc, part } = world('');
    await wait(120);
    check(!!doc.querySelector('.refinement-two-way .rf-tw-row'), 'the rows should be drawn');
    check(!doc.querySelector('.rf-tw-group'), 'with no grouping chosen the list should not be in groups');
    check(doc.querySelectorAll('.rf-tw-line').length === 5 && !!doc.querySelector('.rf-tw-more'), 'the plain list should show five lines and "show all"');
    check(doc.querySelector('.rf-tw-groupby')?.textContent.trim() === 'group' && !doc.querySelector('.rf-tw-groupby[data-on]'), 'the word to group by should read "group"');
    check(doc.querySelectorAll('.rf-tw-into').length === 5, 'every line should have its arrow for the node’s bullets');
    part.stop(); await wait(10);
    check(!doc.querySelector('.refinement-two-way'), 'nothing should be left on stop');
  }
  // 2. Grouped by Confidence: biggest first, the two with none last, the + in a group but not in "none".
  {
    const { window, doc, calls, part } = world('p:Confidence');
    await wait(150);
    check(doc.querySelector('.rf-tw-groupby[data-on]')?.textContent.trim() === 'by Confidence', 'the word should say what it is grouped by: ' + doc.querySelector('.rf-tw-groupby')?.textContent);
    check(names(doc).join() === 'Disputed,Strong,No Confidence', 'groups should be Disputed, Strong (two each, by name) then No Confidence: ' + names(doc));
    check(counts(doc).join() === '2,2,2', 'each group should say how many: ' + counts(doc));
    check(groupEl(doc, 'Strong')?.querySelectorAll('.rf-tw-line').length === 2, 'a group should list its nodes');
    check(!!groupEl(doc, 'Disputed')?.querySelector('.rf-tw-gadd') && !groupEl(doc, 'No Confidence')?.querySelector('.rf-tw-gadd'), 'a + in a group with a value, none in the group of those with none');
    // Folding.
    click(window, groupEl(doc, 'Strong').querySelector('.rf-tw-gtoggle'));
    await wait(20);
    check(groupEl(doc, 'Strong').querySelectorAll('.rf-tw-line').length === 0 && !groupEl(doc, 'Strong').hasAttribute('data-open'), 'a click on a group’s name should fold it');
    click(window, groupEl(doc, 'Strong').querySelector('.rf-tw-gtoggle'));
    await wait(20);
    check(groupEl(doc, 'Strong').querySelectorAll('.rf-tw-line').length === 2, 'and open it again');
    // The + in Disputed: the line opens in the group; Enter makes the node with the tag, about and Confidence.
    click(window, groupEl(doc, 'Disputed').querySelector('.rf-tw-gadd'));
    await wait(20);
    const field = groupEl(doc, 'Disputed').querySelector('.rf-tw-draft-name');
    check(!!field && doc.querySelectorAll('.rf-tw-draft').length === 1, 'the line to type in should open inside the group');
    check(calls.length === 0, 'nothing should be written before Enter');
    type(window, field, 'Spacing fails when the items look alike');
    enter(window, field);
    await wait(80);
    const made = calls.find(c => c[0] === 'appendBlock');
    check(made && made[1] === JOURNAL && made[2] === 'Spacing fails when the items look alike', 'the node should be made in today’s journal with the typed words: ' + JSON.stringify(calls));
    const uuid = made?.[3];
    check(calls.some(c => c[0] === 'addTag' && c[1] === uuid && c[2] === 'tag-claim'), 'it should get the row’s commonest tag');
    check(calls.some(c => c[0] === 'setValue' && c[1] === uuid && c[2] === 'user.property/about' && c[3] === '5'), 'its property should point at this page');
    check(calls.some(c => c[0] === 'setValue' && c[1] === uuid && c[2] === 'user.property/confidence' && c[3] === '302' && /entityId/.test(c[4])), 'its Confidence should be the group’s value, Disputed: ' + JSON.stringify(calls.filter(c => c[0] === 'setValue')));
    check(!doc.querySelector('.rf-tw-draft'), 'the line should go once the node is made');
    check(!!doc.querySelector('.rf-undo'), 'the faded Undo arrow should be offered');
    part.stop();
  }
  // 3. Grouped by tag: the + gives the group's tag and sets no other value.
  {
    const { window, doc, calls, part } = world('tag');
    await wait(120);
    check(names(doc).join() === 'Claim,Question', 'groups by tag, biggest first: ' + names(doc));
    check(!!doc.querySelector('.rf-tw-group .rf-tag.rf-tw-gname'), 'a tag should read as a tag in its group’s name');
    click(window, groupEl(doc, 'Question').querySelector('.rf-tw-gadd'));
    await wait(20);
    const field = groupEl(doc, 'Question').querySelector('.rf-tw-draft-name');
    type(window, field, 'Does it need sleep?');
    enter(window, field);
    await wait(80);
    const made = calls.find(c => c[0] === 'appendBlock');
    check(calls.some(c => c[0] === 'addTag' && c[1] === made?.[3] && c[2] === 'tag-question'), 'a node made in the Question group should be tagged Question: ' + JSON.stringify(calls));
    check(calls.filter(c => c[0] === 'setValue').length === 1, 'and only the row’s property set: ' + JSON.stringify(calls.filter(c => c[0] === 'setValue')));
    part.stop();
  }
  // 4. Grouped by month: newest first, those with no day last, no + (a month is not a value to set).
  {
    const { doc, part } = world('month');
    await wait(120);
    check(names(doc).join() === 'October 2026,September 2026,No date', 'groups by month, newest first: ' + names(doc));
    check(counts(doc).join() === '3,2,1' && !doc.querySelector('.rf-tw-gadd'), 'with their counts and no +: ' + counts(doc));
    part.stop();
  }
  // 4b. Grouped by a number: a scale in order (not biggest first), named with its property; the + writes the number itself.
  {
    const { window, doc, calls, part } = world('p:Severity');
    await wait(150);
    check(names(doc).join() === 'Severity 1,Severity 2,Severity 3,No Severity', 'numbers should be in order, named with their property: ' + names(doc));
    check(counts(doc).join() === '1,1,2,2', 'with their counts: ' + counts(doc));
    click(window, groupEl(doc, 'Severity 3').querySelector('.rf-tw-gadd'));
    await wait(20);
    const field = groupEl(doc, 'Severity 3').querySelector('.rf-tw-draft-name');
    type(window, field, 'Spacing needs sleep');
    enter(window, field);
    await wait(80);
    const made = calls.find(c => c[0] === 'appendBlock');
    check(calls.some(c => c[0] === 'setValue' && c[1] === made?.[3] && c[2] === 'user.property/severity' && c[3] === '3' && c[4] === 'null'), 'a number should be written as the number: ' + JSON.stringify(calls.filter(c => c[0] === 'setValue')));
    part.stop();
  }
  // 5. A node's bullets: opened, read, written into, undone, closed.
  {
    const { window, doc, calls, part, bullets } = world('');
    await wait(120);
    const node = U(101);
    const arrow = () => doc.querySelector(`.rf-tw-into[data-uuid="${node}"]`);
    click(window, arrow());
    await wait(80);
    const box = doc.querySelector(`.rf-tw-node[data-uuid="${node}"]`);
    check(!!box && [...box.querySelectorAll('.rf-tw-btext')].map(el => el.textContent).join('|') === 'Cepeda reviewed 254 studies.|See Testing effect.', 'the node’s bullets should show under its line: ' + box?.textContent);
    check(!!box?.querySelector('.rf-tw-peek-open[data-open-page="Testing effect"]'), 'a link in a bullet should open its page');
    check(arrow()?.hasAttribute('data-on'), 'the arrow should show it is open');
    check(calls.length === 0, 'opening should write nothing');
    const field = doc.querySelector(`.rf-tw-node-field[data-uuid="${node}"]`);
    type(window, field, 'Check the anatomy course.');
    check(calls.length === 0, 'typing should write nothing until Enter');
    enter(window, field);
    await wait(100);
    check(calls.some(c => c[0] === 'addLineTo' && c[1] === node && c[2] === 'Check the anatomy course.'), 'Enter should write the bullet into the node: ' + JSON.stringify(calls));
    check(doc.querySelectorAll(`.rf-tw-node[data-uuid="${node}"] .rf-tw-btext`).length === 3, 'the new bullet should show in the list');
    check(doc.querySelector(`.rf-tw-node-field[data-uuid="${node}"]`)?.value === '', 'the line to type in should be empty again');
    const arrowUndo = doc.querySelector('.rf-undo');
    check(!!arrowUndo, 'the faded Undo arrow should be offered');
    click(window, arrowUndo);
    await wait(100);
    check(calls.some(c => c[0] === 'removeBlock') && (bullets.get(node) || []).length === 2, 'Undo should take the bullet away again: ' + JSON.stringify(calls));
    check(doc.querySelectorAll(`.rf-tw-node[data-uuid="${node}"] .rf-tw-btext`).length === 2, 'and the list should show two again');
    click(window, arrow());
    await wait(20);
    check(!doc.querySelector('.rf-tw-node') && !arrow().hasAttribute('data-on'), 'the arrow again should close it');
    part.stop();
  }
  console.log(problems.length ? `two-way-rows-test: ${problems.length} of ${cases} checks failed` : `two-way-rows-test: OK (${cases} checks)`);
  process.exit(problems.length ? 1 : 0);
})().catch(error => { console.log('PROBLEM: ' + (error.stack || error)); process.exit(1); });
