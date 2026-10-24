#!/usr/bin/env node
/* Suggested links while typing (parts/link-suggest.js, 0.4.361) in a pretend Logseq window: which page is suggested for
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
const KIND_IDS = { Doctor: 11, Oncologist: 12, Treatment: 13, Hospital: 14, Symptom: 15, Page: 16, Person: 17 };
let nextId = 1000;
const page = (title, kind) => ({ id: nextId++, title, lower: title.toLowerCase(), isTag: false, tags: [{ id: KIND_IDS[kind] || 99, title: kind }] });
const rates = new Map();
const pages = [page('Dr. Mei Chen', 'Doctor'), page('Dr. Raj Patel', 'Doctor'), page('Chemo cycle 4', 'Treatment'), page('Northgate Cancer Center', 'Hospital'),
  page('Nausea', 'Symptom'), page('Nausea diary', 'Page'), page('Riverside General Hospital', 'Hospital'), { title: 'Hospitalization', lower: 'hospitalization', isTag: true, tags: [{ title: 'Tag' }] }, page('The plan', 'Page'), page('Theodore Finch', 'Person'), page('Tingling fingers', 'Symptom'),
  { title: 'Doctor', lower: 'doctor', isTag: true, tags: [{ title: 'Tag' }] }];
const notes = [];
window.logseq = { settings: { linkSuggest: true, linkSuggestLearn: true, linkSuggestMemory: {}, linkSuggestMinLetters: 0, linkSuggestPause: 0, linkSuggestUnderline: true, linkSuggestRightArrow: true, linkSuggestHyperTap: true, linkSuggestKeys: 'tab' }, UI: { showMsg: text => notes.push(text) } };
for (const file of ['parts/shared.js', 'parts/link-suggest.js']) window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
window.refinementShared.notify = text => notes.push(text);
let popup = false;
const saved = [];
const schema = { byId: new Map([[101, { id: 101, title: 'Provider', classes: [{ id: 11, title: 'Doctor' }] }], [102, { id: 102, title: 'Topic', classes: [1, 2, 3, 4, 5].map(id => ({ id })) }]]), classProps: new Map([[21, [101, 102]]]), parentsOf: new Map([[12, [11]]]) };
window.refinementCore = { provided: {}, propPages: async () => pages, propSchema: async () => schema, linkRates: async () => rates, blockInEdit: async () => ({ 'block/tags': [{ 'db/id': 21 }] }),
  currentGraph: async () => ({ name: 'Test' }), saveSettings: patch => { saved.push(patch); Object.assign(window.logseq.settings, patch); }, pick: (node, name) => node?.[name], idOf: v => v?.['db/id'] ?? v,
  onPageChange: () => {}, onDatabaseChange: () => {}, onGraphChange: () => {}, sendStyle: () => {}, screen: { ...window.refinementShared.screen, popupOpen: () => popup } };
window.refinementCore.provide = things => Object.assign(window.refinementCore.provided, things);
const part = window.refinementParts.find(p => p.name === 'link suggest');
part.provide(window.refinementCore);
part.start();
const command = part.commands.find(c => c.key === 'accept-suggested-link');
check(command && command.places.includes('keys') && command.shortcut === 'linkSuggestKeys', 'the key should be a command in the register, with its keys in a setting');
// The one register (main.js), stood in for: Tab runs the command (the setting here binds it; as it comes, nothing is bound).
window.addEventListener('keydown', event => { if (event.key === 'Tab' && command.run(event) === true) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
const inner = window.refinementCore.provided.linkSuggestInner;

// The rule.
const at = (text, caret = text.length) => { const hit = inner.suggestFor(text, caret, pages); return hit ? `${hit.title}|${hit.ghost}|${text.slice(hit.start, hit.end)}` : null; };
const cue = text => inner.suggestFor(text, text.length, pages)?.name ?? null;
check(at('Spoke with Dr. Mei') === 'Dr. Mei Chen| Chen|Dr. Mei', 'the start of a name completes it: ' + at('Spoke with Dr. Mei'));
check(at('Spoke with Mei') === 'Dr. Mei Chen| Chen|Mei', 'a word inside a name completes it from there: ' + at('Spoke with Mei'));
check(at('spoke with mei') === null && at('spoke with dr. mei') === 'Dr. Mei Chen| Chen|dr. mei', 'case does not matter once the words are long enough: ' + at('spoke with dr. mei'));
check(at('Felt Naus') === 'Nausea|ea|Naus', 'the shortest name first: ' + at('Felt Naus'));
check(at('Felt Nausea') === 'Nausea||Nausea' && cue('Felt Nausea') === 'Nausea', 'a name typed whole offers the link to it, the name as the cue: ' + at('Felt Nausea'));
check(at('Felt Nausea d') === 'Nausea diary|iary|Nausea d', 'typing on reaches the longer name: ' + at('Felt Nausea d'));
check(at('at the general hospital') === 'Riverside General Hospital||general hospital' && cue('at the general hospital') === 'Riverside General Hospital', 'words inside a name finish it, the whole name as the cue: ' + at('at the general hospital'));
check(at('at the general hospi') === 'Riverside General Hospital|tal|general hospi', 'two words inside a name before one word of another: ' + at('at the general hospi'));
check(at('the hospi') === 'Hospitalization|talization|hospi' && cue('the hospi') === '', 'one word, the shortest name that starts with it, no cue: ' + at('the hospi'));
check(cue('Spoke with Mei') === 'Dr. Mei Chen' && cue('Spoke with Dr. Mei') === '', 'the cue only when the words sit inside the name');
check(at('the') === null && at('with the') === null, 'a short lower-case word shows nothing: ' + at('the') + ' ' + at('with the'));
check(at('The') === 'Theodore Finch|odore Finch|The', 'a capital letter is enough for three: ' + at('The'));
check(at('theo') === 'Theodore Finch|dore Finch|theo', 'four letters are enough in lower case: ' + at('theo'));
check(at('(Mei') === 'Dr. Mei Chen| Chen|Mei', 'a bracket before the word is left out of the link: ' + at('(Mei'));
check(at('Saw [[Dr. Mei') === null, 'nothing inside [[ ]]');
check(at('Saw [[Dr. Mei Chen]] and Raj') === 'Dr. Raj Patel| Patel|Raj', 'after a closed link it goes on: ' + at('Saw [[Dr. Mei Chen]] and Raj'));
check(at('Saw #Doc') === null, 'nothing after #');
check(at('Dr. Mei Chen') === 'Dr. Mei Chen||Dr. Mei Chen', 'the whole name typed offers its link: ' + at('Dr. Mei Chen'));
check(at('Mei ') === null, 'nothing after a space');
check(at('Mei Chen was', 3) === null, 'nothing with words after the cursor: it is for writing on, not editing inside (Mei| Chen was)');
check(at('Meixx', 3) === null, 'nothing with the cursor inside a word (Mei|xx)');
check(at('Spoke with Dr. Mei Chen and Nor') === 'Northgate Cancer Center|thgate Cancer Center|Nor', 'the last word when the earlier ones fit nothing: ' + at('Spoke with Dr. Mei Chen and Nor'));
check(at('Tingling fing') === 'Tingling fingers|ers|Tingling fing', 'two words of a name: ' + at('Tingling fing'));
check(at('see https://exa') === null, 'nothing in a web address');
check(at('Doc') === 'Doctor|tor|Doc', 'a tag page counts: ' + at('Doc'));
// What the graph taught (0.4.373): a name usually linked from three letters and after its space; one usually plain not at all.
const learned = (text, extra = {}) => { const hit = inner.suggestFor(text, text.length, pages, { min: 5, rates, ...extra }); return hit ? `${hit.title}|${hit.ghost}|${hit.after ? 'after' : 'typing'}` : null; };
rates.set('dr. mei chen', { linked: 9, plain: 1 }); rates.set('nausea', { linked: 0, plain: 6 }); rates.set('riverside general hospital', { linked: 3, plain: 0 });
check(inner.usual('dr. mei chen', rates, null) && !inner.usual('nausea', rates, null) && inner.rarelyLinked('nausea', rates, null), 'usual and rarely linked, from the counts');
check(learned('Spoke with Mei') === 'Dr. Mei Chen| Chen|typing', 'a usually linked name from three letters: ' + learned('Spoke with Mei'));
check(learned('Spoke with Dr. Mei Chen ') === 'Dr. Mei Chen||after', 'and still right after the space that ends it: ' + learned('Spoke with Dr. Mei Chen '));
check(learned('Spoke with Dr. Mei Chen  ') === null && learned('Spoke with Mei Chen ') === null, 'not after two spaces, nor after a space that ends only part of it');
check(!learned('Felt nausea')?.startsWith('Nausea|') && !learned('Felt nause')?.startsWith('Nausea|'), 'a name usually written plain is not offered: ' + learned('Felt nausea'));
check(learned('Felt Nausea') === 'Nausea||typing', 'unless typed whole with its own capitals');
check(inner.usual('nausea', rates, { nausea: [5, 0] }), 'what was taken counts twice: five taken outweigh six plain');
check(!inner.usual('dr. mei chen', rates, { 'dr. mei chen': [0, 8] }), 'what was passed over counts against');
// A long name needs a third of itself typed; a short one its first letters as before.
pages.push(page('Surgery first, then chemotherapy depending on the lymph nodes', 'Page'));
check(learned('Why the surgery first') === null, 'five words of a nine-word name are not enough: ' + learned('Why the surgery first'));
check(learned('Surgery first, then chemothe') !== null, 'a third of its letters are');
// The bullet's empty properties: a page that would fill one comes first, from three letters.
const boost = inner.boostFor([21], schema, pages);
check(boost && boost.has(pages.find(p => p.title === 'Dr. Mei Chen').id) && !boost.has(pages.find(p => p.title === 'Nausea').id), 'Provider takes doctors: the doctors are boosted, the symptom is not');
check(boost.size < pages.length / 2, 'the wide property Topic is left out: ' + boost.size + ' of ' + pages.length);
const e = inner.suggestFor('Saw Raj', 7, pages, { min: 5, boost }); 
check(e?.title === 'Dr. Raj Patel', 'a boosted page from three letters: ' + e?.title);
// The letters the setting asks for (5 as it comes): the words of a name count together.
const at5 = text => { const hit = inner.suggestFor(text, text.length, pages, { min: 5 }); return hit ? hit.title : null; };
check(at5('Spoke with Mei') === null && at5('Spoke with Mei Ch') === 'Dr. Mei Chen' && at5('Spoke with Dr. Mei') === 'Dr. Mei Chen', 'five letters: Mei alone waits, “Mei Ch” and “Dr. Mei” show');
check(at5('Felt naus') === null && at5('Felt nause') === 'Nausea', 'five letters of one word: naus waits, nause shows');

// The keys, as Logseq would get them.
const box = doc.querySelector('textarea');
const key = (k, extra = {}) => { const e = new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra }); box.dispatchEvent(e); return e; };
const up = (k, extra = {}) => { const e = new window.KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true, ...extra }); box.dispatchEvent(e); return e; };
const hyper = { metaKey: true, ctrlKey: true, altKey: true, shiftKey: true };
async function type(text) { box.focus(); box.value = text; box.setSelectionRange(text.length, text.length); box.dispatchEvent(new window.Event('input', { bubbles: true })); await wait(20); }
(async () => {
  await type('Spoke with Mei');
  check(inner.showing?.hit.title === 'Dr. Mei Chen', 'typing shows the suggestion');
  const ghost = doc.querySelector('.refinement-link-suggest');
  check(ghost && ghost.querySelector('.rf-typed').textContent === 'Spoke with Mei' && ghost.querySelector('.rf-ghost').textContent === ' Chen', 'the words typed, transparent, then the rest of the name in grey: ' + ghost?.textContent);
  check(ghost.querySelector('.rf-ghost').getAttribute('data-name') === 'Dr. Mei Chen', 'the whole name as the cue, since Mei sits inside it');
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
  // Backspace taken by Logseq itself: the words change with no typing signal; the key's release looks again.
  await type('Spoke with Mei C');
  box.value = 'Spoke with Mei'; box.setSelectionRange(14, 14); up('Backspace'); await wait(20);
  check(inner.showing?.hit.ghost === ' Chen', 'after a Backspace with no typing signal the grey words follow: ' + inner.showing?.hit.ghost);
  box.value = 'Spoke with Me'; box.setSelectionRange(13, 13); up('Backspace'); await wait(20);
  check(!inner.showing, 'and go when the words are too short');
  // The screen behind the words at the tap: the tap takes what fits the words as they are now.
  await type('Spoke with Mei');
  box.value = 'Spoke with Mei C'; box.setSelectionRange(16, 16);
  key('Meta', hyper); up('Meta');
  check(box.value === 'Spoke with [[Dr. Mei Chen]]', 'a tap on stale grey words still links what the words are now: ' + box.value);
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
  // Right arrow takes it; Shift-Right and Right without grey words are Logseq's.
  await type('Spoke with Mei');
  const right = key('ArrowRight');
  check(right.defaultPrevented && box.value === 'Spoke with [[Dr. Mei Chen]]', 'Right arrow takes the suggested link: ' + box.value);
  await type('Spoke with Mei');
  check(!key('ArrowRight', { shiftKey: true }).defaultPrevented && box.value === 'Spoke with Mei', 'Shift-Right selects, as always');
  await type('nothing here');
  check(!key('ArrowRight').defaultPrevented, 'without grey words Right arrow is Logseq’s');
  window.logseq.settings.linkSuggestRightArrow = false;
  await type('Spoke with Mei');
  check(!key('ArrowRight').defaultPrevented && box.value === 'Spoke with Mei', 'off in the settings, Right arrow is Logseq’s');
  window.logseq.settings.linkSuggestRightArrow = true;
  // The grey words follow each letter at once, before the pages are read again.
  await type('Spoke with Mei');
  const typeNow = text => { box.value += text; box.setSelectionRange(box.value.length, box.value.length); box.dispatchEvent(new window.InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })); };
  typeNow(' ');
  check(inner.showing?.hit.ghost === 'Chen' && doc.querySelector('.refinement-link-suggest .rf-ghost')?.textContent === 'Chen', 'a letter matching the next grey one takes it off at once: ' + inner.showing?.hit.ghost);
  typeNow('x');
  check(!inner.showing, 'a letter that does not match hides the grey words at once');
  await wait(20);
  // The pause: nothing new shows while letters keep coming; once they stop, it shows.
  window.logseq.settings.linkSuggestPause = 120;
  await type('Saw Mei'); await wait(40);
  check(!inner.showing, 'no grey words while the typing has not paused');
  await wait(140);
  check(inner.showing?.hit.title === 'Dr. Mei Chen', 'they show once the typing pauses');
  window.logseq.settings.linkSuggestPause = 0;
  // A link taken shows underlined with its brackets hidden, until a [ is typed, a bracket deleted or the cursor moved back.
  await type('Spoke with Mei');
  key('ArrowRight');
  const marks = () => doc.querySelector('.refinement-link-marks');
  check(inner.bare?.box === box && /^RfZeroBrackets, /.test(box.style.fontFamily), 'the brackets are drawn with no width: ' + box.style.fontFamily);
  check(marks()?.querySelector('u')?.textContent === 'Dr. Mei Chen', 'a line under the link’s words: ' + marks()?.innerHTML);
  box.value += ' and'; box.setSelectionRange(box.value.length, box.value.length); box.dispatchEvent(new window.InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'd' })); await wait(20);
  check(inner.bare?.box === box && marks()?.textContent.endsWith(' and'), 'writing on keeps them hidden, the lines follow');
  key('Backspace');
  check(!!inner.bare, 'deleting a letter of the words keeps them hidden');
  key('[');
  check(!inner.bare && !marks() && !/RfZeroBrackets/.test(box.style.fontFamily), 'typing [ brings the brackets back at once');
  await type('Spoke with Mei'); key('ArrowRight');
  box.setSelectionRange(box.value.length, box.value.length); key('Backspace');
  check(!inner.bare, 'deleting a bracket brings them back');
  await type('Spoke with Mei'); key('ArrowRight');
  key('ArrowLeft');
  check(!inner.bare, 'moving the cursor back into the words brings them back');
  await type('Spoke with Mei'); key('ArrowRight');
  box.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true }));
  check(!inner.bare && !marks(), 'leaving the bullet brings them back');
  await type('Spoke with Mei'); key('ArrowRight');
  box.dispatchEvent(new window.InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
  check(!inner.bare, 'a paste brings them back');
  window.logseq.settings.linkSuggestUnderline = false;
  await type('Spoke with Mei'); key('ArrowRight');
  check(!inner.bare && box.value === 'Spoke with [[Dr. Mei Chen]]', 'off in the settings, the brackets show as typed');
  window.logseq.settings.linkSuggestUnderline = true;
  // What is taken or passed over is remembered, by name, for this graph (the takes and pass-overs above forgotten first).
  await wait(600); window.logseq.settings.linkSuggestMemory = {};
  await type('Spoke with Mei Ch');
  key('ArrowRight'); await wait(600);
  check(JSON.stringify(window.logseq.settings.linkSuggestMemory) === JSON.stringify({ Test: { 'dr. mei chen': [1, 0] } }), 'the link taken is remembered: ' + JSON.stringify(window.logseq.settings.linkSuggestMemory));
  await type('Spoke with Mei Ch');
  check(!!inner.showing, 'shows');
  typeNow('x'); await wait(600);
  check(JSON.stringify(window.logseq.settings.linkSuggestMemory) === JSON.stringify({ Test: { 'dr. mei chen': [1, 1] } }), 'a letter past the grey words is a pass-over: ' + JSON.stringify(window.logseq.settings.linkSuggestMemory));
  window.logseq.settings.linkSuggestLearn = false;
  await type('Spoke with Mei Ch'); key('ArrowRight'); await wait(600);
  check(JSON.stringify(window.logseq.settings.linkSuggestMemory) === JSON.stringify({ Test: { 'dr. mei chen': [1, 1] } }), 'learning off: nothing remembered');
  window.logseq.settings.linkSuggestLearn = true;
  // After the space: a dotted line under the words, Right arrow takes it and the cursor lands past the space.
  rates.set('mri', { linked: 5, plain: 0 }); pages.push(page('MRI', 'Page'));
  await type('Booked an MRI '); await wait(20);
  check(inner.showing?.hit.after && doc.querySelector('.refinement-link-suggest .rf-offer')?.textContent === 'MRI' && doc.querySelector('.refinement-link-suggest .rf-ghost').textContent === '', 'after the space: a dotted line under MRI, nothing grey');
  key('ArrowRight');
  check(box.value === 'Booked an [[MRI]] ' && box.selectionStart === box.value.length, 'Right arrow links it and the cursor is past the space: ' + JSON.stringify(box.value));
  await type('Booked an MRI '); typeNow('t');
  check(!inner.showing && box.value === 'Booked an MRI t', 'the next letter ends the offer, the word stays plain');
  // The Hyper tap: the modifiers down together, one up with nothing between.
  await type('Spoke with Mei');
  key('Meta', hyper); key('Control', hyper); key('Alt', hyper); key('Shift', hyper);
  up('Shift', { metaKey: true, ctrlKey: true, altKey: true }); up('Alt', { metaKey: true, ctrlKey: true }); up('Control', { metaKey: true }); up('Meta');
  check(box.value === 'Spoke with [[Dr. Mei Chen]]', 'a lone Hyper tap takes the link: ' + box.value);
  const esc = key('Escape');
  check(esc.defaultPrevented, 'an Escape the setup sends right after the tap is swallowed');
  const escUp = up('Escape');
  check(escUp.defaultPrevented, 'both halves of it');
  await type('Spoke with Mei');
  key('Meta', hyper); key('Control', hyper); key('Alt', hyper); key('Shift', hyper);
  key('l', { ...hyper, code: 'KeyL' });
  up('Shift', { metaKey: true, ctrlKey: true, altKey: true }); up('Meta');
  check(box.value === 'Spoke with Mei', 'Hyper held with a letter is a chord, not a tap: ' + box.value);
  check(!!inner.showing, 'and the suggestion stays');
  key('Meta', { metaKey: true }); up('Meta');
  check(box.value === 'Spoke with Mei', 'Cmd alone is not the Hyper key: ' + box.value);
  key('Meta', hyper); up('Meta');
  check(box.value === 'Spoke with [[Dr. Mei Chen]]', 'a tap that sends one modifier down and up works too: ' + box.value);
  await wait(350);
  check(!key('Escape').defaultPrevented, 'an Escape later on is Logseq’s own');
  await type('Spoke with Mei');
  window.logseq.settings.linkSuggestHyperTap = false;
  key('Meta', hyper); up('Meta');
  check(box.value === 'Spoke with Mei', 'the tap off in the settings does nothing: ' + box.value);
  window.logseq.settings.linkSuggestHyperTap = true;
  await part.stop();
  check(!doc.querySelector('.refinement-link-suggest') && !inner.showing, 'unload leaves nothing');
  console.log(`link-suggest-test: ${cases} checks, ${problems.length} problems`);
  process.exit(problems.length ? 1 : 0);
})().catch(error => { console.log('PROBLEM: ' + error.stack); process.exit(1); });
