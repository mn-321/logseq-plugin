#!/usr/bin/env node
/* Link selected text (parts/link-text.js, 0.4.252) in a pretend Logseq window: which pages are offered for the selected
   words and in what order, what is typed into the bullet, and the keys (Cmd+Option+L, typing, Up/Down, Enter, Escape,
   a click). Needs node and jsdom. Run from the repo root: node tools/link-text-test.js   (tools/check.sh runs it) */
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
const tag = (title, isTag = false) => ({ title, isTag, tags: isTag ? [{ title: 'Tag' }] : [{ title }] });
const page = (title, kind) => ({ title, lower: title.toLowerCase(), isTag: false, tags: [{ title: kind }] });
const pages = [page('Dr. Mei Chen', 'Doctor'), page('Dr. Raj Patel', 'Doctor'), page('Chemo cycle 4', 'Treatment'), page('Northgate Cancer Center', 'Hospital'),
  { ...tag('Doctor', true), lower: 'doctor' }, page('Chen', 'Person')];
const notes = [];
window.logseq = { settings: { linkText: true }, provideStyle() {}, onSettingsChanged: () => () => {}, UI: { showMsg: text => notes.push(text) }, App: { onRouteChanged: () => () => {} } };
for (const file of ['parts/shared.js', 'parts/link-text.js']) window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
window.refinementShared.notify = (text) => notes.push(text);
window.refinementCore = { provided: {}, propPages: async () => pages };
const part = window.refinementParts.find(p => p.name === 'link text');
part.start();
const inner = window.refinementLinkTextInner;

// The rules.
const titles = rows => rows.map(r => (r.kind === 'new' ? 'new:' : '') + r.title);
check(titles(inner.rowsFor(pages, 'Mei Chen'))[0] === 'Dr. Mei Chen', 'the words of a name should find it: ' + titles(inner.rowsFor(pages, 'Mei Chen')));
check(titles(inner.rowsFor(pages, 'chen'))[0] === 'Chen', 'the page with exactly that name should come first');
check(!titles(inner.rowsFor(pages, 'chen')).some(t => t.startsWith('new:')), 'no New page when a page has that name');
const ch = titles(inner.rowsFor(pages, 'che'));
check(ch.indexOf('Chemo cycle 4') < ch.indexOf('Dr. Mei Chen') && ch.at(-1) === 'new:che', 'the start of a name before the start of a word, New page last: ' + ch);
check(titles(inner.rowsFor(pages, 'Dr. Okafor')).join() === 'new:Dr. Okafor', 'an unknown name offers only New page');
check(inner.rowsFor(pages, '  ').length === 0, 'nothing looked for, nothing offered');
check(inner.rowsFor(pages, 'Doctor')[0].right === 'tag', 'a tag page says tag at the right');
check(inner.linkFor('Dr. Mei Chen', 'Dr. Mei Chen') === '[[Dr. Mei Chen]]', 'the page’s own name becomes [[name]]');
check(inner.linkFor('dr. mei chen', 'Dr. Mei Chen') === '[[Dr. Mei Chen]]', 'case does not matter for the name');
check(inner.linkFor(' the oncologist ', 'Dr. Mei Chen') === ' [the oncologist]([[Dr. Mei Chen]]) ', 'other words keep their wording, spaces stay outside: ' + inner.linkFor(' the oncologist ', 'Dr. Mei Chen'));

// The keys, as Logseq would get them.
const box = doc.querySelector('textarea');
const key = (k, extra = {}) => { const e = new window.KeyboardEvent('keydown', { key: k, code: extra.code || '', bubbles: true, cancelable: true, ...extra }); box.dispatchEvent(e); return e; };
const linkKey = () => key('¬', { code: 'KeyL', metaKey: true, altKey: true });
let inputs = 0;
box.addEventListener('input', () => inputs++);
async function select(text, words) { box.value = text; box.focus(); const at = text.indexOf(words); box.setSelectionRange(at, at + words.length); }

(async () => {
  await select('Spoke with Chen about the scan', 'Chen');
  const e = linkKey();
  await wait(20);
  check(e.defaultPrevented, 'Cmd+Option+L in a bullet should be the plugin’s');
  const list = doc.querySelector('.refinement-link-text');
  check(!!list, 'the list should open under the words');
  check(list && list.querySelector('.rlt-on')?.textContent.startsWith('Chen'), 'the page named Chen should be highlighted');
  key('ArrowDown'); key('Enter');
  check(box.value === 'Spoke with [Chen]([[Dr. Mei Chen]]) about the scan', 'Down then Enter should link the second page with the words kept: ' + box.value);
  check(!doc.querySelector('.refinement-link-text'), 'the list should close after linking');
  check(inputs > 0, 'Logseq should hear the change as typing');
  check(box.selectionStart === box.value.indexOf(' about'), 'the cursor should sit after the link');

  // Typing changes what is looked for, the bullet's words stay as they were.
  await select('Saw the oncologist today', 'the oncologist');
  linkKey(); await wait(20);
  for (const ch of 'raj') key(ch);
  check(box.value === 'Saw the oncologist today', 'typing while the list is open should not change the bullet');
  check(doc.querySelector('.refinement-link-text .rlt-on')?.textContent.startsWith('Dr. Raj Patel'), 'typing “raj” should find Dr. Raj Patel');
  key('Enter');
  check(box.value === 'Saw [the oncologist]([[Dr. Raj Patel]]) today', 'the chosen page linked with the words kept: ' + box.value);

  // Escape leaves the words alone, selected as before.
  await select('Call Northgate tomorrow', 'Northgate');
  linkKey(); await wait(20);
  key('Escape');
  check(!doc.querySelector('.refinement-link-text') && box.value === 'Call Northgate tomorrow', 'Escape should close and change nothing');
  check(box.value.slice(box.selectionStart, box.selectionEnd) === 'Northgate', 'Escape should leave the words selected');

  // A click on a row links it.
  linkKey(); await wait(20);
  doc.querySelector('.refinement-link-text .rlt-row')?.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  check(box.value === 'Call [Northgate]([[Northgate Cancer Center]]) tomorrow', 'a click on a row should link it: ' + box.value);

  // An unknown name: New page is the only row, so Enter makes it.
  await select('Met Dr. Okafor', 'Dr. Okafor');
  linkKey(); await wait(20);
  key('Enter');
  check(box.value === 'Met [[Dr. Okafor]]', 'an unknown name becomes a new page’s link: ' + box.value);

  // Nothing selected, or a selection over a line break: a note, nothing written.
  await select('Nothing here', ''); box.setSelectionRange(3, 3);
  linkKey(); await wait(20);
  check(!doc.querySelector('.refinement-link-text') && notes.length === 1, 'with nothing selected, a note and no list');
  box.value = 'two\nlines'; box.setSelectionRange(0, 9);
  linkKey(); await wait(20);
  check(!doc.querySelector('.refinement-link-text') && notes.length === 2, 'over a line break, a note and no list');

  // Another key closes the list and is the bullet's again; switched off, the key is left to Logseq.
  await select('Spoke with Chen', 'Chen');
  linkKey(); await wait(20);
  const left = key('ArrowLeft');
  check(!doc.querySelector('.refinement-link-text') && !left.defaultPrevented, 'Left should close the list and still move the cursor');
  window.logseq.settings.linkText = false;
  check(!linkKey().defaultPrevented, 'switched off, Cmd+Option+L should be left to Logseq');
  window.logseq.settings.linkText = true;

  // Unload leaves nothing behind.
  linkKey(); await wait(20);
  await part.stop();
  check(!doc.querySelector('.refinement-link-text'), 'unload should remove the list');
  console.log(problems.length ? `link-text-test: ${problems.length} of ${cases} checks failed` : `link-text-test: OK (${cases} checks)`);
  process.exit(problems.length ? 1 : 0);
})().catch(error => { console.log('PROBLEM: ' + (error.stack || error)); process.exit(1); });
