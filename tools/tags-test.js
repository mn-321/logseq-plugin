#!/usr/bin/env node
/* Small checks of the tag map in a pretend window (jsdom), each one a fault found in the real app or in a reading:
   - a redraw never leaves an open property's box acting for another property (second reading of 0.4.192). A pretend
     #Report tag has two plain text properties, summary and notes, both opened: their boxes look exactly alike.
     Folding summary away must leave notes with a box of its own, whose Change button speaks of notes;
   - renaming a choice offers Undo, like every other change on the map (0.4.194);
   - the choices panel offers no moving of choices (0.4.193): Logseq 2.0.2 refuses a plugin's move up and garbles a
     move down (the choice lands last and the property's own page gets the choice as a value).

   Needs node and jsdom:   npm install --no-save --no-package-lock jsdom
   Run from the repo root: node tools/tags-test.js   (tools/check.sh runs it when node and jsdom are there) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const problems = [];
const problem = text => { problems.push(text); console.log('PROBLEM: ' + text); };

function pretendLogseq(window) {
  const props = [
    { ':db/id': 20, ':db/ident': ':user.property/summary', ':block/title': 'summary', ':block/uuid': 'p-summary', ':logseq.property/type': ':default', ':db/cardinality': ':db.cardinality/one', ':logseq.property/classes': [] },
    { ':db/id': 21, ':db/ident': ':user.property/notes', ':block/title': 'notes', ':block/uuid': 'p-notes', ':logseq.property/type': ':default', ':db/cardinality': ':db.cardinality/one', ':logseq.property/classes': [] },
    { ':db/id': 22, ':db/ident': ':user.property/result', ':block/title': 'result', ':block/uuid': 'p-result', ':logseq.property/type': ':default', ':db/cardinality': ':db.cardinality/one', ':logseq.property/classes': [] },
  ];
  const choices = [['c-normal', 'Normal', 'a1'], ['c-abnormal', 'Abnormal', 'a2'], ['c-unclear', 'Unclear', 'a3']].map(([uuid, title, order]) => ({ uuid, title, order }));
  window.pretendChoices = choices;
  const ref = p => ({ ':db/id': p[':db/id'], ':db/ident': p[':db/ident'], ':block/title': p[':block/title'], ':block/uuid': p[':block/uuid'] });
  const tags = [{ ':db/id': 10, ':db/ident': ':user.class/Report', ':block/uuid': 't-Report', ':block/title': 'Report', ':logseq.property.class/extends': [], ':logseq.property.class/properties': props.map(ref) }];
  const settings = { tagTreeRoots: 'Report', twoWayNames: '', twoWayOneEnd: '' };
  window.pretendTags = tags;
  window.parent = window;
  window.logseq = {
    settings, updateSettings: o => Object.assign(settings, o),
    DB: { datascriptQuery: async q => q.includes('logseq.property/classes [') ? props.map(p => [p])
      : q.includes('(pull ?v [:block/uuid :block/title :block/order])') ? choices.map(c => [{ ':block/uuid': c.uuid, ':block/title': c.title, ':block/order': c.order }])
      : q.includes('closed-value') ? choices.map(c => [22, { ':block/title': c.title, ':block/order': c.order }])
      : q.includes('class/extends [:db/id]') ? tags.map(t => [t])
      : q.includes('count') ? [[10, 3]] : [], onChanged: () => () => {} },
    UI: { showMsg() {} }, App: { pushState() {} },
    Editor: { openInRightSidebar() {}, updateBlock: async (uuid, title) => { const c = choices.find(c => c.uuid === uuid); if (c) c.title = title; } },
  };
  window.refinementCore = { provided: { backwardsLabel: n => n + ' of', setBackwards() {}, shownAtOtherEnd: () => true, setShownAtOtherEnd() {} } };
}

const until = async test => { for (let i = 0; i < 50; i++) { const found = test(); if (found) return found; await new Promise(r => setTimeout(r, 10)); } return null; };

(async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="stage"></div></body></html>', { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.addEventListener('error', event => problem('error in the page: ' + (event.error?.stack || event.message)));
  // Both properties open before the map is drawn, the way the map remembers them.
  window.localStorage.setItem('refinement-tags-props-open', JSON.stringify(['t-Report|20', 't-Report|21']));
  pretendLogseq(window);
  const source = fs.readFileSync(path.join(root, 'parts/tags.js'), 'utf8');
  const exposed = source.replace(/\}\)\(\);\s*$/, 'window.__createView = createView; })();');
  if (exposed === source) { console.log('PROBLEM: the end of parts/tags.js changed; tools/tags-test.js cannot reach the map'); process.exit(1); }
  window.eval(fs.readFileSync(path.join(root, 'parts/shared.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'parts/model.js'), 'utf8'));
  window.eval(require('./pretend-model'));
  window.eval(exposed);
  const doc = window.document;
  const view = window.__createView(doc, 'page');
  doc.getElementById('stage').append(view.node);
  await view.refresh();

  const rowOf = name => [...doc.querySelectorAll('.rtg-prow')].find(r => r.querySelector('.rtg-pname')?.textContent === name);
  const boxAfter = row => row?.nextElementSibling?.classList.contains('rtg-pinfo') ? row.nextElementSibling : null;
  const summaryBox = boxAfter(rowOf('summary')), notesBox = boxAfter(rowOf('notes'));
  if (!summaryBox || !notesBox) problem('the two open properties were not drawn with their boxes');
  else {
    if (!summaryBox.isEqualNode(notesBox)) problem('the pretend boxes differ, so this check no longer tests what it should');
    rowOf('summary').querySelector('.rtg-fold').click(); // fold summary away; the map redraws
    const after = boxAfter(rowOf('notes'));
    if (boxAfter(rowOf('summary'))) problem('summary stayed open after it was folded');
    if (!after) problem('notes lost its box when summary was folded');
    else {
      if (after === summaryBox) problem('notes now shows the box that was drawn for summary');
      after.querySelector('.rtg-make').click();
      const heading = doc.querySelector('.refinement-tags-menu .rtg-mh')?.textContent || '';
      if (!heading.startsWith('notes ')) problem(`Change in notes' box opened “${heading}” instead of a menu for notes`);
    }
  }

  // The choices panel of result: renaming and removing, but no moving.
  const resultRow = rowOf('result');
  if (!resultRow) problem('the result property was not drawn');
  else {
    const values = resultRow.querySelector('.rtg-ptype [data-act="values"]');
    if (values) values.click(); else problem('result shows no choices to click');
    await until(() => doc.querySelector('.rtg-choices .rtg-crow'));
    const rows = doc.querySelectorAll('.rtg-choices .rtg-crow');
    if (rows.length !== 3) problem(`the choices panel shows ${rows.length} choices instead of 3`);
    const moving = [...doc.querySelectorAll('.rtg-choices button')].filter(b => /^move/i.test(b.getAttribute('aria-label') || b.title || ''));
    if (moving.length) problem(`the choices panel offers ${moving.length} buttons to move choices, which Logseq 2.0.2 refuses or garbles`);
    // Renaming a choice says so with an Undo, like every other change on the map, and Undo puts the old name back.
    const input = rows[2]?.querySelector('input');
    if (!input || input.value !== 'Unclear') problem(`the third choice reads “${input?.value}” instead of Unclear`);
    else {
      input.value = 'Unsure';
      input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      // The plugin's one Undo (0.4.258): a faded arrow, saying what it takes back.
      const undo = await until(() => doc.querySelector('.rf-undo[data-rf-undo^="tags:"]'));
      if (window.pretendChoices[2].title !== 'Unsure') problem('renaming a choice did not rename it');
      if (!undo) problem('renaming a choice has no Undo arrow');
      else {
        undo.click();
        await until(() => window.pretendChoices[2].title === 'Unclear');
        if (window.pretendChoices[2].title !== 'Unclear') problem(`Undo after renaming a choice left “${window.pretendChoices[2].title}”`);
      }
    }
  }
  // Groups of properties (0.4.243): only in the Properties view, kept in the propertyGroups setting by name; a
  // property put in another group leaves its old one, Undo puts the groups back, nothing in the graph is written.
  {
    window.logseq.settings.propertyGroups = 'Results: result; Empty one:';
    const byProp = [...doc.querySelectorAll('button')].find(b => b.textContent === 'Properties');
    if (!byProp) problem('no Properties button to turn the map round');
    else {
      byProp.click();
      await until(() => doc.querySelector('.rtg-ghead'));
      const heads = [...doc.querySelectorAll('h3.rtg-group')].map(h => h.querySelector('span')?.textContent || h.textContent);
      if (heads.slice(0, 3).join('|') !== 'Results|Empty one|Not in a group') problem(`the groups read ${JSON.stringify(heads)}; wanted Results, Empty one, Not in a group`);
      const inResults = doc.querySelector('.rtg-pgroup[data-key="group-0"] .rtg-pname')?.textContent;
      if (inResults !== 'result') problem(`the Results group holds “${inResults}”, not result`);
      const writesBefore = JSON.stringify(window.pretendChoices);
      const name = [...doc.querySelectorAll('.rtg-pname')].find(n => n.textContent === 'result');
      name?.click();
      [...doc.querySelectorAll('.refinement-tags-menu button')].find(b => b.textContent.startsWith('Put in a group'))?.click();
      [...doc.querySelectorAll('.refinement-tags-menu button')].find(b => b.textContent === 'Empty one')?.click();
      if (window.logseq.settings.propertyGroups !== 'Results: ; Empty one: result') problem(`putting result in Empty one left the setting “${window.logseq.settings.propertyGroups}”`);
      const arrows = await until(() => doc.querySelectorAll('.rf-undo[data-rf-undo^="tags:"]').length ? doc.querySelectorAll('.rf-undo[data-rf-undo^="tags:"]') : null);
      [...(arrows || [])].at(-1)?.click();
      await until(() => window.logseq.settings.propertyGroups === 'Results: result; Empty one: ');
      if (window.logseq.settings.propertyGroups !== 'Results: result; Empty one: ') problem(`Undo left the groups as “${window.logseq.settings.propertyGroups}”`);
      if (JSON.stringify(window.pretendChoices) !== writesBefore) problem('grouping changed something in the pretend graph');
    }
  }
  // Renaming a tag takes its place in the order with it, and Undo brings the old name back there too (0.4.274: after
  // Undo the order kept the new name, so the tag lost its place).
  {
    window.logseq.Editor.renamePage = async (uuid, name) => { const t = window.pretendTags.find(t => t[':block/uuid'] === uuid); if (t) t[':block/title'] = name; };
    [...doc.querySelectorAll('button')].find(b => b.textContent === 'Tags')?.click();
    const row = await until(() => [...doc.querySelectorAll('.rtg-row')].find(r => /Report$/.test(r.querySelector('.rtg-name')?.textContent || '')));
    row?.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
    const field = await until(() => doc.querySelector('.rtg-row input'));
    if (!field) problem('double-clicking the #Report row opened no name field');
    else { field.value = 'Reports'; field.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
    await until(() => window.logseq.settings.tagTreeRoots === 'Reports');
    if (window.logseq.settings.tagTreeRoots !== 'Reports') problem(`renaming #Report left the order “${window.logseq.settings.tagTreeRoots}”; wanted Reports`);
    const arrow = await until(() => [...doc.querySelectorAll('.rf-undo[data-rf-undo^="tags:"]')].find(a => /is now #Reports/.test(a.title || a.getAttribute('aria-label') || '')));
    if (!arrow) problem('renaming a tag has no Undo arrow');
    else {
      arrow.click();
      await until(() => window.logseq.settings.tagTreeRoots === 'Report' && window.pretendTags[0][':block/title'] === 'Report');
      if (window.pretendTags[0][':block/title'] !== 'Report' || window.logseq.settings.tagTreeRoots !== 'Report') problem(`Undo after renaming a tag left the name “${window.pretendTags[0][':block/title']}” and the order “${window.logseq.settings.tagTreeRoots}”`);
    }
  }
  view.destroy();
  if (problems.length) { console.log(`tag map checks: FAILED (${problems.length})`); process.exit(1); }
  console.log('tag map checks: OK (an open property box stays with its own property; choices are not moved from the map; a renamed choice can be undone; groups of properties are drawn, moved and undone; Undo of a tag’s new name puts its old name back in the order)');
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
