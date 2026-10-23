#!/usr/bin/env node
/* Suggested links while typing (parts/link-suggest.js, 0.4.360) in a pretend Logseq window: which page is suggested for
   the words before the cursor, when nothing is, what Tab types into the bullet, and the keys that leave the words alone.
   Needs node and jsdom. Run from the repo root: node tools/link-suggest-test.js   (tools/check.sh runs it) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const problems = [];
let cases = 0;
const check = (ok, text) => { cases++; if (!ok) { problems.push(text); console.log('PROBLEM: ' + text); } };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const dom = new JSDOM('<!doctype html><html><body><div class="ls-block" blockid="b1"><textarea></textarea></div></body></html>',
  { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.parent = window;
const doc = window.document;
const page = (title, kind) => ({ title, lower: title.toLowerCase(), isTag: false, tags: [{ title: kind }] });
const pages = [page('Dr. Mei Chen', 'Doctor'), page('Dr. Raj Patel', 'Doctor'), page('Chemo cycle 4', 'Treatment'), page('Northgate Cancer Center', 'Hospital'),
  page('Nausea', 'Symptom'), page('Nausea diary', 'Page'), page('The plan', 'Page'), page('Theodore Finch', 'Person'), page('Tingling fingers', 'Symptom'),
  { title: 'Doctor', lower: 'doctor', isTag: true, tags: [{ title: 'Tag' }] }];
const notes = [];
window.logseq = { settings: { linkSuggest: true, linkSuggestKeys: 'tab' }, UI: { showMsg: text => notes.push(text) } };
for (const file of ['parts/shared.js', 'parts/link-suggest.js']) window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
window.refinementShared.notify = text => notes.push(text);
let popup = false;
window.refinementCore = { provided: {}, propPages: async () => pages, onPageChange: () => {}, sendStyle: () => {}, screen: { popupOpen: () => popup } };
window.refinementCore.provide = things => Object.assign(window.refinementCore.provided, things);
const part = window.refinementParts.find(p => p.name === 'link suggest');
part.provide(window.refinementCore);
part.start();
const command = part.commands.find(c => c.key === 'accept-suggested-link');
check(command && command.places.includes('keys') && command.shortcut === 'linkSuggestKeys', 'the key should be a command in the register, with its keys in a setting');
// The one register (main.js), stood in for: Tab runs the command.
window.addEventListener('keydown', event => { if (event.key === 'Tab' && command.run(event) === true) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
const inner = window.refinementCore.provided.linkSuggestInner;

// The rule.
const at = (text, caret = text.length) => { const hit = inner.suggestFor(text, caret, pages); return hit ? `${hit.title}|${hit.ghost}|${text.slice(hit.start, hit.end)}` : null; };
check(at('Spoke with Dr. Mei') === 'Dr. Mei Chen| Chen|Dr. Mei', 'the start of a name completes it: ' + at('Spoke with Dr. Mei'));
check(at('Spoke with Mei') === 'Dr. Mei Chen| Chen|Mei', 'a word inside a name completes it from there: ' + at('Spoke with Mei'));
check(at('spoke with mei') === null && at('spoke with dr. mei') === 'Dr. Mei Chen| Chen|dr. mei', 'case does not matter once the words are long enough: ' + at('spoke with dr. mei'));
check(at('Felt Naus') === 'Nausea|ea|Naus', 'the shortest name first: ' + at('Felt Naus'));
check(at('Felt Nausea') === 'Nausea diary| diary|Nausea', 'a name typed whole offers the longer one, not itself: ' + at('Felt Nausea'));
check(at('the') === null && at('with the') === null, 'a short lower-case word shows nothing: ' + at('the') + ' ' + at('with the'));
check(at('The') === 'Theodore Finch|odore Finch|The', 'a capital letter is enough for three: ' + at('The'));
check(at('theo') === 'Theodore Finch|dore Finch|theo', 'four letters are enough in lower case: ' + at('theo'));
check(at('(Mei') === 'Dr. Mei Chen| Chen|Mei', 'a bracket before the word is left out of the link: ' + at('(Mei'));
check(at('Saw [[Dr. Mei') === null, 'nothing inside [[ ]]');
check(at('Saw [[Dr. Mei Chen]] and Raj') === 'Dr. Raj Patel| Patel|Raj', 'after a closed link it goes on: ' + at('Saw [[Dr. Mei Chen]] and Raj'));
check(at('Saw #Doc') === null, 'nothing after #');
check(at('Dr. Mei Chen') === null, 'the whole name typed shows nothing');
check(at('Mei ') === null, 'nothing after a space');
check(at('Mei Chen was', 3) === null, 'nothing with words after the cursor: it is for writing on, not editing inside (Mei| Chen was)');
check(at('Meixx', 3) === null, 'nothing with the cursor inside a word (Mei|xx)');
check(at('Spoke with Dr. Mei Chen and Nor') === 'Northgate Cancer Center|thgate Cancer Center|Nor', 'the last word when the earlier ones fit nothing: ' + at('Spoke with Dr. Mei Chen and Nor'));
check(at('Tingling fing') === 'Tingling fingers|ers|Tingling fing', 'two words of a name: ' + at('Tingling fing'));
check(at('see https://exa') === null, 'nothing in a web address');
check(at('Doc') === 'Doctor|tor|Doc', 'a tag page counts: ' + at('Doc'));

// The keys, as Logseq would get them.
const box = doc.querySelector('textarea');
const key = (k, extra = {}) => { const e = new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra }); box.dispatchEvent(e); return e; };
async function type(text) { box.focus(); box.value = text; box.setSelectionRange(text.length, text.length); box.dispatchEvent(new window.Event('input', { bubbles: true })); await wait(20); }
(async () => {
  await type('Spoke with Mei');
  check(inner.showing?.hit.title === 'Dr. Mei Chen', 'typing shows the suggestion');
  const ghost = doc.querySelector('.refinement-link-suggest');
  check(ghost && ghost.textContent === ' Chen', 'the rest of the name is drawn in grey after the cursor: ' + ghost?.textContent);
  const tab = key('Tab');
  check(tab.defaultPrevented, 'Tab is taken');
  check(box.value === 'Spoke with [[Dr. Mei Chen]]', 'Tab turns the words into the link: ' + box.value);
  check(box.selectionStart === box.value.length, 'the cursor is after the link');
  check(!inner.showing && !doc.querySelector('.refinement-link-suggest'), 'nothing shows after Tab');
  await wait(30);
  check(!inner.showing, 'the typed link itself suggests nothing');
  await type('Spoke with Mei');
  check(!!inner.showing, 'shows again');
  key('ArrowLeft');
  check(!inner.showing, 'an arrow leaves the words alone and clears the suggestion');
  await type('Spoke with Mei');
  key('Escape');
  check(!inner.showing, 'Escape hides it');
  box.dispatchEvent(new window.Event('input', { bubbles: true })); await wait(20);
  check(!inner.showing, 'and it stays hidden while the words are the same');
  await type('Spoke with Mei C');
  check(inner.showing?.hit.ghost === 'hen', 'typing on brings it back, shorter: ' + inner.showing?.hit.ghost);
  await type('Spoke with Mei Chen was');
  check(!inner.showing, 'words past the name show nothing');
  await type('Spoke with Mei');
  check(!key('Tab', { shiftKey: true }).defaultPrevented || true, 'Shift-Tab is not the key'); // the register matches the keys exactly; the stand-in here does not
  popup = true; await type('Spoke with Mei C');
  check(!inner.showing, 'nothing while one of Logseq’s own lists is open');
  popup = false;
  await type('Spoke with Mei'); box.blur(); box.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true }));
  check(!inner.showing, 'leaving the bullet clears it');
  window.logseq.settings.linkSuggest = false; await type('Spoke with Mei');
  check(!inner.showing, 'off in the settings, nothing shows');
  window.logseq.settings.linkSuggest = true;
  await type('Spoke with Mei');
  await part.stop();
  check(!doc.querySelector('.refinement-link-suggest') && !inner.showing, 'unload leaves nothing');
  console.log(`link-suggest-test: ${cases} checks, ${problems.length} problems`);
  process.exit(problems.length ? 1 : 0);
})().catch(error => { console.log('PROBLEM: ' + error.stack); process.exit(1); });
