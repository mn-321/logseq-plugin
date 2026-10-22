#!/usr/bin/env node
/* The pickers (parts/picker.js, 0.4.253) in a pretend Logseq window: Logseq's list for a property ("Set Spoke with",
   rows .menu-link-wrap, the highlighted one .menu-link.chosen, highlighted by the pointer moving over it) is drawn the
   way Logseq 2.0.2 draws it; the part is given what fits by a pretend pickerOrder. Checks the order shown, the faint
   line, the highlight on the top row, Up and Down in the order shown, typing, the pointer, and nothing left on unload.
   Needs node and jsdom. Run from the repo root: node tools/picker-test.js   (tools/check.sh runs it) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const problems = [];
let cases = 0;
const check = (ok, text) => { cases++; if (!ok) { problems.push(text); console.log('PROBLEM: ' + text); } };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const dom = new JSDOM('<!doctype html><html><body><div class="ls-block" blockid="6a000000-0000-4000-8000-00000000000b"><textarea>The anaesthetist rang, [[Dr. Kenji Watanabe]].</textarea></div></body></html>',
  { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.parent = window;
const doc = window.document;
const people = ['Amara Okoro', 'Daniel Okoro', 'Dr. Helen Brooks', 'Dr. Kenji Watanabe', 'Dr. Mei Chen', 'Zoë Müller'];
const pages = people.map((title, i) => ({ id: 100 + i, title, lower: title.toLowerCase(), tags: [] }));
const asked = [];
window.logseq = { settings: { pickerFitsFirst: true }, provideStyle() {}, onSettingsChanged: () => () => {}, UI: { showMsg() {} } };
for (const file of ['parts/shared.js', 'parts/picker.js']) window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
// The screen watcher: the part's early updater is run by hand after each change, as main.js runs it.
const early = [];
window.refinementCore = { propPages: async () => pages, watchDomEarly: fn => early.push(fn),
  provided: { pickerOrder: async (uuid, title, words) => { asked.push([uuid, title, words]); return title === 'Spoke with' ? [103, 105] : []; } } };
const part = window.refinementParts.find(p => p.name === 'pickers');
part.start();
const changed = () => early.forEach(fn => fn(doc, [{ type: 'childList', target: doc.body }]));

// Logseq's list: a box and the rows, the chosen one set by the pointer moving over a row (or by typing: back to the first).
let chosen = 0, popup = null;
function drawList(title, filter = '') {
  popup?.remove();
  popup = doc.createElement('div');
  popup.setAttribute('data-radix-popper-content-wrapper', '');
  const names = people.filter(name => name.toLowerCase().includes(filter));
  popup.innerHTML = `<div class="cp__select"><input class="cp__select-input" placeholder="Set ${title}" value="${filter}"><div class="item-results-wrap"><div class="cp__select-results"><div class="list">`
    + names.map((name, i) => `<div class="menu-link-wrap"><div class="menu-link${i === chosen ? ' chosen' : ''}"><input type="checkbox">${name}</div></div>`).join('') + '</div></div></div></div>';
  doc.body.append(popup);
  popup.querySelectorAll('.menu-link').forEach((link, i) => link.addEventListener('mousemove', () => { chosen = i; popup.querySelectorAll('.menu-link').forEach((l, j) => l.classList.toggle('chosen', j === i)); }));
  return popup.querySelector('input');
}
const seen = () => window.refinementPickerInner.shown([...popup.querySelectorAll('.menu-link-wrap')]).map(w => w.textContent.trim());
const highlighted = () => popup.querySelector('.menu-link.chosen')?.textContent.trim();
const key = (box, k) => { const e = new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); box.dispatchEvent(e); return e; };

(async () => {
  // Opened from the bullet (Option-Enter in its text box).
  const area = doc.querySelector('textarea');
  area.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true }));
  chosen = 0;
  let box = drawList('Spoke with');
  box.focus();
  await wait(20);
  check(asked.length === 1 && asked[0][0] === '6a000000-0000-4000-8000-00000000000b' && asked[0][1] === 'Spoke with' && asked[0][2].includes('Kenji'), 'what fits should be asked for this bullet, this property and its words: ' + JSON.stringify(asked[0]));
  check(seen().slice(0, 2).join() === 'Dr. Kenji Watanabe,Zoë Müller', 'the fitting rows should show first, in their order: ' + seen());
  check(seen().slice(2).join() === 'Amara Okoro,Daniel Okoro,Dr. Helen Brooks,Dr. Mei Chen', 'the rest should keep Logseq’s order: ' + seen());
  check(popup.querySelector('[data-refinement-fit-last]')?.textContent.trim() === 'Zoë Müller', 'the faint line should follow the last fitting row');
  check(highlighted() === 'Dr. Kenji Watanabe', 'the top row should be highlighted, for Enter: ' + highlighted());
  // Up and Down in the order shown.
  key(box, 'ArrowDown');
  check(highlighted() === 'Zoë Müller', 'Down should go to the second row shown: ' + highlighted());
  const down = key(box, 'ArrowDown');
  check(down.defaultPrevented && highlighted() === 'Amara Okoro', 'Down past the line should go to Logseq’s first row: ' + highlighted());
  key(box, 'ArrowUp'); key(box, 'ArrowUp'); key(box, 'ArrowUp');
  check(highlighted() === 'Dr. Mei Chen', 'Up from the top should go round to the last row: ' + highlighted());
  // Moved by hand, a redraw leaves the highlight alone.
  changed();
  check(highlighted() === 'Dr. Mei Chen', 'after Up or Down the highlight is the person’s');
  // Typing: Logseq draws the rows again with its own first row highlighted; the top row shown gets it back.
  chosen = 0;
  box = drawList('Spoke with', 'dr');
  window.refinementPickerInner.open.box = box; // the same box in Logseq; drawn again in this pretend list
  box.dispatchEvent(new window.InputEvent('input', { bubbles: true }));
  changed();
  check(seen()[0] === 'Dr. Kenji Watanabe' && highlighted() === 'Dr. Kenji Watanabe', 'after typing, the top row shown should be highlighted: ' + seen() + ' / ' + highlighted());
  // The pointer moving over a row is the person's choice.
  const helen = [...popup.querySelectorAll('.menu-link')].find(l => l.textContent.includes('Helen'));
  helen.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }));
  changed();
  check(highlighted() === 'Dr. Helen Brooks', 'a row the pointer is on should stay highlighted: ' + highlighted());

  // A property with nothing that fits: Logseq's list as it is, its keys its own.
  popup.remove(); popup = null;
  area.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true }));
  chosen = 0;
  box = drawList('Hospital');
  box.focus();
  await wait(20);
  check(!popup.querySelector('[data-refinement-fit]') && seen()[0] === 'Amara Okoro', 'nothing fitting, nothing moved');
  check(!key(box, 'ArrowDown').defaultPrevented, 'nothing fitting, Down is Logseq’s');

  // Switched off: nothing asked, nothing moved.
  popup.remove(); popup = null;
  window.logseq.settings.pickerFitsFirst = false;
  area.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true }));
  box = drawList('Spoke with');
  box.focus();
  await wait(20);
  check(!popup.querySelector('[data-refinement-fit]'), 'switched off, the list is Logseq’s');
  window.logseq.settings.pickerFitsFirst = true;

  // Unload leaves nothing behind.
  popup.remove(); popup = null;
  area.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true }));
  box = drawList('Spoke with');
  box.focus();
  await wait(20);
  await part.stop();
  check(!doc.querySelector('[data-refinement-fit], [data-refinement-fit-last], [data-refinement-fit-list]'), 'unload should take the marks off Logseq’s rows');
  console.log(problems.length ? `picker-test: ${problems.length} of ${cases} checks failed` : `picker-test: OK (${cases} checks)`);
  process.exit(problems.length ? 1 : 0);
})().catch(error => { console.log('PROBLEM: ' + (error.stack || error)); process.exit(1); });
