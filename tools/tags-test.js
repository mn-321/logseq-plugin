#!/usr/bin/env node
/* Small checks of the tag map in a pretend window (jsdom), each one a fault found in the real app or in a reading:
   - a redraw never leaves an open property's box acting for another property (second reading of 0.4.192). A pretend
     #Report tag has two plain text properties, summary and notes, both opened: their boxes look exactly alike.
     Folding summary away must leave notes with a box of its own, whose Change button speaks of notes;
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
  const choices = [[22, 'Normal', 'c1'], [22, 'Abnormal', 'c2'], [22, 'Unclear', 'c3']];
  const ref = p => ({ ':db/id': p[':db/id'], ':db/ident': p[':db/ident'], ':block/title': p[':block/title'], ':block/uuid': p[':block/uuid'] });
  const tags = [{ ':db/id': 10, ':db/ident': ':user.class/Report', ':block/uuid': 't-Report', ':block/title': 'Report', ':logseq.property.class/extends': [], ':logseq.property.class/properties': props.map(ref) }];
  const settings = { tagTreeRoots: 'Report', twoWayNames: '', twoWayOneEnd: '' };
  window.parent = window;
  window.logseq = {
    settings, updateSettings: o => Object.assign(settings, o),
    DB: { datascriptQuery: async q => q.includes('logseq.property/classes [:db/id]') ? props.map(p => [p])
      : q.includes('closed-value') ? choices
      : q.includes('class/extends [:db/id]') ? tags.map(t => [t])
      : q.includes('count') ? [[10, 3]] : [], onChanged: () => () => {} },
    UI: { showMsg() {} }, App: { pushState() {} }, Editor: { openInRightSidebar() {} },
  };
  window.refinementCore = { provided: { backwardsLabel: n => n + ' of', setBackwards() {}, shownAtOtherEnd: () => true, setShownAtOtherEnd() {} } };
}

(async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="stage"></div></body></html>', { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.addEventListener('error', event => problem('error in the page: ' + (event.error?.stack || event.message)));
  // Both properties open before the map is drawn, the way the map remembers them.
  window.localStorage.setItem('refinement-tags-props-open', JSON.stringify(['t-Report|20', 't-Report|21']));
  pretendLogseq(window);
  const source = fs.readFileSync(path.join(root, 'parts/tags.js'), 'utf8');
  const exposed = source.replace(/\}\)\(\);\s*$/, 'window.__createView = createView; })();');
  if (exposed === source) { console.log('PROBLEM: the end of parts/tags.js changed; tools/tags-test.js cannot reach the map'); process.eit(1); }
  window.eval(fs.readFileSync(path.join(root, 'parts/shared.js'), 'utf8'));
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
    for (let i = 0; i < 20 && !doc.querySelector('.rtg-choices .rtg-crow'); i++) await new Promise(r => setTimeout(r, 10));
    const rows = doc.querySelectorAll('.rtg-choices .rtg-crow');
    if (rows.length !== 3) problem(`the choices panel shows ${rows.length} choices instead of 3`);
    const moving = [...doc.querySelectorAll('.rtg-choices button')].filter(b => /^move/i.test(b.getAttribute('aria-label') || b.title || ''));
    if (moving.length) problem(`the choices panel offers ${moving.length} buttons to move choices, which Logseq 2.0.2 refuses or garbles`);
  }
  view.destroy();
  if (problems.length) { console.log(`tag map checks: FAILED (${problems.length})`); process.exit(1); }
  console.log('tag map checks: OK (an open property box stays with its own property; choices are not moved from the map)');
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
