#!/usr/bin/env node
/* Moving tags in the tag tree like bullets (0.4.221), in a pretend window (jsdom) with a small pretend graph:
   #Concept, #Entity (inside: #Person with #Doctor, and #Place) and #Occurrence (inside: #Visit).
   - the top level is every tag with no parent: a tag dragged under another leaves it (the old "root" names did not);
   - over the upper half of a row a tag goes just before it, over the lower half just after it, and with the pointer
     to the right of the name inside it, as its first tag; a line shows where, indented for inside;
   - the order among tags beside each other stays as dropped, at the top level and inside a tag;
   - the zone under the top level puts a tag last there; the drag ends even when the browser sends no dragend;
   - a tag cannot go inside a tag that is inside it; Undo puts a move back;
   - Tab, Shift+Tab and Cmd+Shift+Up move a tag as Logseq moves a bullet.

   Needs node and jsdom:   npm install --no-save --no-package-lock jsdom
   Run from the repo root: node tools/tag-drag-test.js   (tools/check.sh runs it when node and jsdom are there) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const problems = [];
const problem = text => { problems.push(text); console.log('PROBLEM: ' + text); };

// The pretend graph: each tag with the ids of the tags it extends, changed by the plugin's own calls.
function pretendLogseq(window) {
  const names = ['Concept', 'Entity', 'Person', 'Doctor', 'Place', 'Occurrence', 'Visit'];
  const tags = names.map((title, i) => ({ id: 10 + i, title, uuid: 't-' + title, parents: [] }));
  const by = title => tags.find(t => t.title === title);
  const byUuid = uuid => tags.find(t => t.uuid === uuid);
  by('Person').parents = [by('Entity').id]; by('Doctor').parents = [by('Person').id];
  by('Place').parents = [by('Entity').id]; by('Visit').parents = [by('Occurrence').id];
  const settings = { tagTreeRoots: '', twoWayNames: '', twoWayOneEnd: '' };
  window.parent = window;
  window.pretend = { tags, by, settings };
  window.logseq = {
    settings, updateSettings: o => Object.assign(settings, o),
    DB: { datascriptQuery: async q => q.includes('class/extends [:db/id]')
      ? tags.map(t => [{ ':db/id': t.id, ':db/ident': ':user.class/' + t.title, ':block/uuid': t.uuid, ':block/title': t.title,
        ':logseq.property.class/extends': t.parents.map(id => ({ ':db/id': id })), ':logseq.property.class/properties': [] }])
      : [], onChanged: () => () => {} },
    UI: { showMsg() {} }, App: { pushState() {} },
    Editor: {
      addTagExtends: async (uuid, parent) => { const t = byUuid(uuid), p = byUuid(parent); if (!t.parents.includes(p.id)) t.parents.push(p.id); },
      removeTagExtends: async (uuid, parent) => { const t = byUuid(uuid), p = byUuid(parent); t.parents = t.parents.filter(id => id !== p.id); },
      removeBlockProperty: async uuid => { byUuid(uuid).parents = []; },
      openInRightSidebar() {},
    },
  };
  window.refinementCore = { provided: { backwardsLabel: n => n + ' of', setBackwards() {}, shownAtOtherEnd: () => true, setShownAtOtherEnd() {} } };
}

const until = async test => { for (let i = 0; i < 100; i++) { const found = test(); if (found) return found; await new Promise(r => setTimeout(r, 10)); } return null; };

(async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="stage"></div></body></html>', { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.addEventListener('error', event => problem('error in the page: ' + (event.error?.stack || event.message)));
  // jsdom lays nothing out: every row is 20 high from its own top, its name starting 24 from the left.
  window.Element.prototype.getBoundingClientRect = function () {
    const left = this.classList.contains('rtg-main') ? 24 : 0;
    return { top: 0, bottom: 20, height: 20, left, right: 600, width: 600 - left, x: left, y: 0 };
  };
  window.Element.prototype.scrollIntoView = () => {};
  pretendLogseq(window);
  const source = fs.readFileSync(path.join(root, 'parts/tags.js'), 'utf8');
  const exposed = source.replace(/\}\)\(\);\s*$/, 'window.__createView = createView; })();');
  if (exposed === source) { console.log('PROBLEM: the end of parts/tags.js changed; tools/tag-drag-test.js cannot reach the tree'); process.exit(1); }
  window.eval(fs.readFileSync(path.join(root, 'parts/shared.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'parts/model.js'), 'utf8'));
  window.eval(require('./pretend-model'));
  window.eval(fs.readFileSync(path.join(root, 'parts/tags-graph.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'parts/tags-props.js'), 'utf8'));
  window.eval(exposed);
  const doc = window.document;
  const view = window.__createView(doc, 'sidebar'); // the sidebar view (it has property rows too since 0.4.236; the pretend tags here have none)
  doc.getElementById('stage').append(view.node);
  await view.refresh();
  const { by, settings } = window.pretend;

  const rowOf = name => [...doc.querySelectorAll('.rtg-row')].find(r => r.querySelector(':scope > .rtg-main .rtg-name')?.textContent === name);
  // The tags as drawn: "Name" at the top level, "  Name" one level in, and so on.
  const outline = () => [...doc.querySelectorAll('.rtg-row')].map(r => {
    let depth = 0;
    for (let n = r.parentElement; n && !n.classList.contains('rtg-body'); n = n.parentElement) if (n.classList.contains('rtg-kids')) depth++;
    return '  '.repeat(depth) + r.querySelector(':scope > .rtg-main .rtg-name').textContent;
  }).join(' / ');
  const parentsOf = name => by(name).parents.map(id => window.pretend.tags.find(t => t.id === id).title).sort().join(',');
  const fire = (node, type, extra = {}) => {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    for (const [k, v] of Object.entries({ dataTransfer: { setData() {}, effectAllowed: '', dropEffect: '' }, clientX: 0, clientY: 0, altKey: false, ...extra })) Object.defineProperty(event, k, { value: v });
    node.dispatchEvent(event);
    return event;
  };
  // A drag of one tag over a place: 'before' (upper half), 'after' (lower half, under the name), 'inside' (lower
  // half, to the right) or 'top' (the zone under the top level). Returns the line shown, then drops (unless only
  // looking) with no dragend, as the browser does when the row it came from was moved.
  const AT = { before: { clientY: 5, clientX: 40 }, after: { clientY: 15, clientX: 40 }, inside: { clientY: 15, clientX: 100 }, top: {} };
  const drag = async (name, onto, where, { look = false } = {}) => {
    const from = rowOf(name), to = where === 'top' ? doc.querySelector('.rtg-topzone') : rowOf(onto);
    if (!from || !to) { problem(`could not find ${name} or ${onto} to drag`); return ''; }
    fire(from, 'dragstart');
    const over = fire(to, 'dragover', AT[where]);
    const line = over.defaultPrevented ? ['rtg-drop-before', 'rtg-drop-after', 'rtg-drop-inside', 'rtg-drop'].find(c => to.classList.contains(c)) || 'no line' : 'refused';
    if (!look && over.defaultPrevented) { fire(to, 'drop', AT[where]); await until(() => !view.node.classList.contains('rtg-dragon') && !doc.querySelector('.rtg-dragging')); await new Promise(r => setTimeout(r, 30)); }
    return line;
  };
  const expect = (what, got, want) => { if (got !== want) problem(`${what}: got “${got}”, wanted “${want}”`); };

  expect('the tree at first', outline(), 'Concept / Entity /   Person /     Doctor /   Place / Occurrence /   Visit');
  // 1. Before a top-level tag: the top level takes that order, and keeps it after a reload of the tags.
  expect('the line over the upper half of Concept', await drag('Occurrence', 'Concept', 'before'), 'rtg-drop-before');
  await view.refresh();
  expect('Occurrence dropped before Concept', outline(), 'Occurrence /   Visit / Concept / Entity /   Person /     Doctor /   Place');
  // 2. Inside, to the right: Entity leaves the top level and becomes Concept's first tag.
  expect('the line over the lower half of Concept, to the right', await drag('Entity', 'Concept', 'inside'), 'rtg-drop-inside');
  expect('Entity dropped inside Concept', outline(), 'Occurrence /   Visit / Concept /   Entity /     Person /       Doctor /     Place');
  expect("Entity's parents", parentsOf('Entity'), 'Concept');
  // 3. After a tag one level in: Doctor goes beside Place, under Entity, just after it.
  expect('the line over the lower half of Place', await drag('Doctor', 'Place', 'after'), 'rtg-drop-after');
  expect('Doctor dropped after Place', outline(), 'Occurrence /   Visit / Concept /   Entity /     Person /     Place /     Doctor');
  expect("Doctor's parents", parentsOf('Doctor'), 'Entity');
  // 4. Before a tag inside a parent: order among the tags inside it (by name, Person would come first).
  await drag('Doctor', 'Person', 'before');
  expect('Doctor dropped before Person', outline(), 'Occurrence /   Visit / Concept /   Entity /     Doctor /     Person /     Place');
  // 5. Not inside its own inside.
  expect('Concept dragged inside Person (inside it)', await drag('Concept', 'Person', 'inside', { look: true }), 'refused');
  fire(rowOf('Concept'), 'dragend');
  // 6. The zone under the top level, shown only while dragging; the tag goes last there. Undo puts it back.
  expect('the zone at rest', view.node.classList.contains('rtg-dragon'), false);
  expect('the line over the zone', await drag('Visit', null, 'top'), 'rtg-drop');
  expect('Visit dropped on the zone', outline(), 'Occurrence / Concept /   Entity /     Doctor /     Person /     Place / Visit');
  const undo = [...doc.querySelectorAll('.rf-undo[data-rf-undo^="tags:"]')].at(-1); // the plugin's one Undo (0.4.258)
  if (!undo) problem('no Undo after the move to the top level'); else undo.click();
  await until(() => parentsOf('Visit') === 'Occurrence');
  await new Promise(r => setTimeout(r, 30));
  expect('after Undo', outline(), 'Occurrence /   Visit / Concept /   Entity /     Doctor /     Person /     Place');
  // 7. Keys, as for bullets. Shift+Tab on Person: just after Entity, under Concept.
  const key = (name, k, mods = {}) => { view.node.focus(); rowOf(name).dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true })); view.node.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods })); };
  key('Person', 'Tab', { shiftKey: true });
  await until(() => parentsOf('Person') === 'Concept');
  await new Promise(r => setTimeout(r, 30));
  expect('Shift+Tab on Person', outline(), 'Occurrence /   Visit / Concept /   Entity /     Doctor /     Place /   Person');
  // Tab on Person: the last tag inside Entity, the tag above it.
  key('Person', 'Tab');
  await until(() => parentsOf('Person') === 'Entity');
  await new Promise(r => setTimeout(r, 30));
  expect('Tab on Person', outline(), 'Occurrence /   Visit / Concept /   Entity /     Doctor /     Place /     Person');
  // Cmd+Shift+Up on Person: above Place.
  key('Person', 'ArrowUp', { metaKey: true, shiftKey: true });
  await new Promise(r => setTimeout(r, 60));
  expect('Cmd+Shift+Up on Person', outline(), 'Occurrence /   Visit / Concept /   Entity /     Doctor /     Person /     Place');
  if (!/Occurrence.*Concept/.test(settings.tagTreeRoots)) problem(`the order was not saved in the setting (it reads “${settings.tagTreeRoots}”)`);

  view.destroy();
  if (problems.length) { console.log(`tag drag checks: FAILED (${problems.length})`); process.exit(1); }
  console.log('tag drag checks: OK (top level is every tag with no parent; before, after, inside and the top zone; order kept; Undo; Tab, Shift+Tab, Cmd+Shift+Up)');
  process.exit(0);
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
