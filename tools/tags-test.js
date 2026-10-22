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
  window.pretendProps = props;
  const ref = p => ({ ':db/id': p[':db/id'], ':db/ident': p[':db/ident'], ':block/title': p[':block/title'], ':block/uuid': p[':block/uuid'] });
  const tags = [{ ':db/id': 10, ':db/ident': ':user.class/Report', ':block/uuid': 't-Report', ':block/title': 'Report', ':logseq.property.class/extends': [], ':logseq.property.class/properties': props.map(ref) }];
  const settings = { tagTreeRoots: 'Report', twoWayNames: '', twoWayOneEnd: '' };
  window.pretendTags = tags;
  window.parent = window;
  window.logseq = {
    settings, updateSettings: o => Object.assign(settings, o),
    DB: { datascriptQuery: async q => q.includes('logseq.property/classes [') ? props.map(p => [p])
      // The nodes that hold result (0.4.307): one, with the choice Normal, written on a day.
      : q.includes(':user.property/result ?v]') && !q.includes('count') ? (q.includes('?vt') ? [['n-1', 60, 'Normal']] : q.includes('?day') ? [['n-1', 20261013]] : q.includes('logseq.property/value') ? [] : [['n-1', 'Blood count 2026-10-13', 60]])
      : q.includes('(pull ?v [:block/uuid :block/title :block/order])') ? choices.map(c => [{ ':block/uuid': c.uuid, ':block/title': c.title, ':block/order': c.order }])
      : q.includes('closed-value') ? choices.map(c => [22, { ':block/title': c.title, ':block/order': c.order }])
      : q.includes('class/extends [:db/id]') ? tags.map(t => [t])
      : q.includes('count') ? (q.includes('#uuid "c-') ? [[0]] : [[10, 3]]) : [], onChanged: () => () => {} },
    UI: { showMsg() {} }, App: { pushState() {} },
    Editor: { openInRightSidebar() {}, updateBlock: async (uuid, title) => { const c = choices.find(c => c.uuid === uuid); if (c) c.title = title; },
      removeBlock: async uuid => { const at = choices.findIndex(c => c.uuid === uuid); if (at >= 0) choices.splice(at, 1); } },
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
  window.eval(fs.readFileSync(path.join(root, 'parts/tags-graph.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'parts/tags-props.js'), 'utf8'));
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
  // A new choice (0.4.309): typed in the panel's New choice field, made through Logseq's own box (stood in for here),
  // listed in the panel again, and Undo removes it.
  {
    const made = [];
    window.refinementTagMap.makeChoice = async (prop, title) => { made.push([prop.title, title]); const c = { uuid: 'c-' + title.toLowerCase(), title, order: 'a9' }; window.pretendChoices.push(c); return c; };
    const fresh = doc.querySelector('.rtg-choices input.rtg-newchoice');
    if (!fresh) problem('the choices panel has no New choice field');
    else {
      fresh.value = 'Pending';
      fresh.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      const row = await until(() => [...doc.querySelectorAll('.rtg-choices .rtg-crow input')].find(i => i.value === 'Pending'));
      if (made.length !== 1 || made[0].join('|') !== 'result|Pending') problem(`Logseq’s box was asked for ${JSON.stringify(made)}; wanted [["result","Pending"]]`);
      if (!row) problem('the new choice Pending is not listed in the panel');
      const arrow = await until(() => [...doc.querySelectorAll('.rf-undo[data-rf-undo^="tags:"]')].find(a => /Pending/.test(a.title || a.getAttribute('aria-label') || '')));
      if (!arrow) problem('the new choice has no Undo arrow');
      else {
        arrow.click();
        await until(() => !window.pretendChoices.some(c => c.title === 'Pending'));
        if (window.pretendChoices.some(c => c.title === 'Pending')) problem('Undo left the new choice Pending in place');
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
  // The Properties view as an outline (0.4.305): an opened property's lines are the places to act (Holds with Change…,
  // On with the tag and + Tag, Group with Change…), and + New property walks through the name, the kind and the tag,
  // then makes the property with Logseq's own box (stood in for here) and puts the Undo arrow on the new row.
  {
    const fold = await until(() => doc.querySelector('.rtg-row[data-key="P22"] .rtg-fold'));
    if (!fold) problem('the Properties view has no row for result');
    else {
      fold.click();
      const info = await until(() => doc.querySelector('.rtg-row[data-key="P22"] + .rtg-pinfo'));
      const labels = [...(info?.querySelectorAll('.rtg-plbl') || [])].map(l => l.textContent);
      if (!labels.includes('Holds') || !labels.includes('On') || !labels.includes('Group')) problem(`result’s opened lines read ${JSON.stringify(labels)}; wanted Holds, On and Group among them`);
      const chip = info?.querySelector('.rtg-onchip');
      if (!chip || chip.textContent.replace('×', '').trim() !== '#Report') problem(`the On line shows “${chip?.textContent}” instead of #Report`);
      if (!chip?.querySelector('.rtg-onx')) problem('the On line’s tag has no × to take the property off it');
      if (![...(info?.querySelectorAll('button') || [])].some(b => b.textContent === '+ Tag')) problem('the On line has no + Tag');
      if (info?.querySelector('.rtg-pnoderow')) problem('the nodes are listed before show nodes is pressed');
      const showNodes = await until(() => [...(info?.querySelectorAll('a.rtg-pmore') || [])].find(a => a.textContent === 'show nodes' && !a.hidden));
      if (!showNodes) problem('result’s Holds line has no show nodes');
      else showNodes.click();
      const nodeRow = await until(() => doc.querySelector('.rtg-row[data-key="P22"] + .rtg-pinfo .rtg-pnoderow'));
      if (!nodeRow) problem('show nodes listed no node under result');
      else if (nodeRow.querySelector('.rtg-pnode')?.textContent !== 'Blood count 2026-10-13' || nodeRow.querySelector('.rtg-note')?.textContent !== 'Normal') problem(`the Nodes line reads “${nodeRow.textContent}”; wanted Blood count 2026-10-13 with Normal`);
      const change = [...(doc.querySelectorAll('.rtg-row[data-key="P22"] + .rtg-pinfo button') || [])].find(b => b.textContent === 'Change …');
      change?.click();
      const items = [...doc.querySelectorAll('.refinement-tags-menu button')].map(b => b.textContent);
      if (!items.some(t => t.startsWith('Turn into links to pages'))) problem(`Holds’ Change… lists ${JSON.stringify(items)}; wanted Turn into links to pages among them`);
      doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      [...doc.querySelectorAll('.refinement-tags-menu button')].length && view.node.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
    // + New property: the name, Number, on #Report.
    const made = [];
    window.refinementTagMap.makeProperty = async (tag, name, kind) => {
      made.push([tag.title, name, kind]);
      const p = { ':db/id': 23, ':db/ident': ':user.property/' + name, ':block/title': name, ':block/uuid': 'p-' + name, ':logseq.property/type': ':' + kind, ':db/cardinality': ':db.cardinality/one', ':logseq.property/classes': [] };
      window.pretendProps.push(p);
      window.pretendTags[0][':logseq.property.class/properties'].push({ ':db/id': 23, ':db/ident': p[':db/ident'], ':block/title': name, ':block/uuid': p[':block/uuid'] });
      return { id: 23, uuid: p[':block/uuid'], ident: 'user.property/' + name, title: name, type: kind, many: false };
    };
    const newButton = [...doc.querySelectorAll('.rtg-newprops button')].find(b => b.textContent === '+ New property');
    if (!newButton) problem('the Properties view has no + New property');
    else {
      newButton.click();
      const input = await until(() => doc.querySelector('.rtg-addprop input'));
      if (!input) problem('+ New property opened no line to type in');
      else {
        input.value = 'weight';
        input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        const kind = await until(() => [...doc.querySelectorAll('.refinement-tags-menu button')].find(b => b.textContent.startsWith('Number')));
        if (!kind) problem('Enter on the name offered no kinds');
        else {
          kind.click();
          const tagRow = await until(() => [...doc.querySelectorAll('.refinement-tags-menu button')].find(b => b.textContent.includes('#Report')));
          if (!tagRow) problem('the kind picked offered no tag to put the property on');
          else {
            tagRow.click();
            const row = await until(() => doc.querySelector('.rtg-row[data-key="P23"]'));
            if (made.length !== 1 || made[0].join('|') !== 'Report|weight|number') problem(`Logseq’s box was asked for ${JSON.stringify(made)}; wanted [["Report","weight","number"]]`);
            if (!row) problem('the new property has no row after it was made');
            const arrow = await until(() => row?.querySelector('.rf-undo'));
            if (!arrow) problem('the new property’s row has no Undo arrow');
            else if (!/Made weight on #Report/.test(arrow.title || arrow.getAttribute('aria-label') || '')) problem(`the Undo arrow says “${arrow.title || arrow.getAttribute('aria-label')}”`);
          }
        }
      }
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
  // Where the map's Undo arrows go (0.4.296): never after the title, only the last three kept, none once the map is closed.
  {
    [...doc.querySelectorAll('button')].find(b => b.textContent === 'Properties')?.click();
    for (let i = 1; i <= 5; i++) {
      const name = await until(() => [...doc.querySelectorAll('.rtg-pname')].find(n => n.textContent === 'result'));
      name?.click();
      [...doc.querySelectorAll('.refinement-tags-menu button')].find(b => b.textContent.startsWith('Put in a group'))?.click();
      [...doc.querySelectorAll('.refinement-tags-menu button')].find(b => b.textContent === (i % 2 ? 'Empty one' : 'Results'))?.click();
      await new Promise(r => setTimeout(r, 30));
    }
    // A redraw that keeps no row of the changes (the map folded away) sends them to the corner with their words.
    [...doc.querySelectorAll('button')].find(b => b.textContent === 'Tags')?.click();
    await until(() => doc.querySelector('.rf-undo-dock'));
    const keys = window.refinementShared.undo.keys().filter(k => k.startsWith('tags:'));
    if (keys.length !== 3) problem(`after five changes the map kept ${keys.length} Undo arrows; wanted the last three`);
    if (doc.querySelector('.refinement-tags :is(.rtg-title, header) .rf-undo')) problem('an Undo arrow sits after the map’s title');
    const words = [...doc.querySelectorAll('.rf-undo-dock .rf-undo-words')].map(w => w.textContent);
    if (words.length && !words.every(w => /result is in/.test(w))) problem(`the corner held ${JSON.stringify(words)}; wanted the group moves with their words`);
  }
  view.destroy();
  if (window.refinementShared.undo.keys().some(k => k.startsWith('tags:'))) problem('closing the map left its Undo arrows');
  if (problems.length) { console.log(`tag map checks: FAILED (${problems.length})`); process.exit(1); }
  console.log('tag map checks: OK (an open property box stays with its own property; choices are not moved from the map; a renamed choice can be undone; groups of properties are drawn, moved and undone; a new choice is made through the stood-in box and undone; a property’s lines act and list the nodes that hold it when asked, and + New property walks name, kind and tag with the arrow on the new row; Undo of a tag’s new name puts its old name back in the order; Undo arrows on their row or in the corner, the last three, gone with the map)');
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
