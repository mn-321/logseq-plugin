/* Loaded by main.js after parts/link-text.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* Suggested links while typing (0.4.361, layer 3; the owner, 2026-10-23: "suggesting wikilinks in line almost like
   autosuggestion like on an iphone … I can easily ignore it by just keeping writing"). While a bullet is written, when
   the last word or words typed start a page's name, or a word inside it, the rest of the name shows in grey right after
   the cursor: "Spoke with Dr. Mei" shows " Chen", "Mei" alone shows " Chen" too (the name is Dr. Mei Chen). A tap of the
   Hyper key takes it (0.4.362; the owner's Caps Lock sends Cmd+Ctrl+Opt+Shift, and "Tab moves a bullet"), and so does
   Right arrow (0.4.366, the owner: "add right arrow as well to be able to complete"), as on a phone: the words
   typed become [[Dr. Mei Chen]], typed as if by hand, so Cmd+Z takes it back. Anything else ignores it:
   keep writing and it changes or goes; a space, Enter, Left, Up, Down, a click or Escape leaves the words as they are.
   A link taken this way shows underlined, with no [[ ]], while the bullet is still being written (0.4.367, the owner:
   "having the line is less obtrusive while you type … it can be [[ ]], but just for the first time"): the brackets are
   in the words from the start (the proposals read the link at once, Cmd+Z takes it back in one step), only drawn with no
   width by a tiny font of two empty glyphs (tools/make-zero-brackets-font.js), and a line laid under each link's words.
   Typing [, deleting a bracket, moving the cursor back into the words or leaving the bullet brings the brackets back;
   the next time the bullet is opened they show as always.
   No mark follows the grey words (0.4.366: the owner did not like the ⇪); when the words sit inside a name, the whole
   name follows them, faint and small, so what is taken is no surprise. It shows nothing inside [[ ]], after #, while one of Logseq's own lists is open, or
   for a short lower-case word (three letters capitalised, or four, before it looks: "the" never shows a page).
   Which page: the name that starts with the words first (then the shortest), else the shortest whose word starts with
   them; a page with one of your tags before an untagged one. The pages come from the model (propPages); nothing is
   written until Tab, and only the link, so it needs no list of graphs.
   The tap is seen the way the old Hyper tap of 0.4.148 saw it (seen working on the owner's Mac): the modifiers go down
   together, then one comes up within 600 ms with no other key between; an Escape some setups send on the tap is
   swallowed for 300 ms so Logseq does not leave the bullet. Holding Hyper with another key is untouched.
   On the kit: the grey is the text colour faded as the kit's quiet words are; a plain key can take it too, a command
   in the one register (places: keys) with the setting Keys for Suggested links, empty by default (tab would take an
   indent away); the page change comes from the core; no logseq.* call here. */
const shared = window.refinementShared;
const { host, el } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements (suggested links): ', leaves: { elements: '.refinement-link-suggest, .refinement-link-marks' } });
let propPages, onPageChange, sendStyle, screen;
const take = (core, names) => shared.take(core, names, warnOnce);

const settingsSchema = [
  { key: 'linkSuggestHeading', type: 'heading', group: 'writing', rank: 4, title: 'Suggested links', default: null,
    legend: 'While you write, the rest of a page’s name shows in grey after the cursor; Right arrow or a tap of the Hyper key makes the link',
    zone: '<div><span class="m">Spoke with Dr. Mei</span><span class="m" style="opacity:.45"> Chen</span></div>',
    description: 'Changes here apply right away.' },
  { key: 'linkSuggest', type: 'boolean', title: 'Suggest links while typing', default: true,
    description: 'When the last words typed start a page’s name, or a word in it, the rest of the name shows in grey right after the cursor. Right arrow, or a tap of the Hyper key, turns the words into [[the page]]; Cmd+Z takes it back. Anything else ignores it: keep writing, press space, Left, Up, Down or Enter, and the words stay as typed. Nothing shows inside [[ ]], after #, or for a short lower-case word.' },
  { key: 'linkSuggestRightArrow', type: 'boolean', title: 'Right arrow takes the suggested link', default: true,
    description: 'While grey words show after the cursor, Right arrow makes the link, as on a phone. Without grey words, Right arrow does what it always does. Changes here apply right away.' },
  { key: 'linkSuggestHyperTap', type: 'boolean', title: 'A tap of the Hyper key takes the suggested link', default: true,
    description: 'If Caps Lock is your Hyper key (⌘⌃⌥⇧, set up with Karabiner or the Hyperkey app), tapping it on its own while grey words show makes the link. Holding Hyper with another key works as before. An Escape your setup sends on a tap is ignored. Changes here apply right away.' },
  { key: 'linkSuggestUnderline', type: 'boolean', title: 'A link just taken shows underlined, without [[ ]]', default: true,
    description: 'While you go on writing the bullet, a link taken from a suggestion shows as its words with a line under them, the brackets hidden. Typing [, deleting a bracket, moving the cursor back into the words or leaving the bullet shows them again; the next time you open the bullet it reads [[ ]] as always. Changes here apply right away.' },
  { key: 'linkSuggestKeys', type: 'string', title: 'Keys for Suggested links', default: '',
    description: 'A plain key that takes the suggested link as well, in Logseq’s spelling, for example mod+ctrl+alt+shift+space or tab (tab would then no longer indent while grey words show). Empty, as it comes, binds none. Changes here apply right away.' },
];
const setting = shared.settingReader(settingsSchema);

const WORD = /[\p{L}\p{N}]/u;
const letters = text => (text.match(/[\p{L}\p{N}]/gu) || []).length;
// A page's own tag, for the ranking: one of yours, not Logseq's Page or Tag.
const tagged = page => page.isTag || (page.tags || []).some(t => t.title && !/^(page|tag)$/i.test(t.title));
const better = (a, b) => (tagged(b.page) - tagged(a.page)) || (a.page.title.length - b.page.title.length) || a.page.lower.localeCompare(b.page.lower);
// The places in a name where a word starts, after the first: "dr. mei chen" → 4, 8.
function wordStarts(lower) {
  const at = [];
  for (let i = 1; i < lower.length; i++) if (WORD.test(lower[i]) && !WORD.test(lower[i - 1])) at.push(i);
  return at;
}
/* The suggestion for the words before the cursor, or null: { start, end, span, title, ghost }. start..end is the span the
   link replaces (span its words), ghost the rest of the name to show. Pure, so tools/link-suggest-test.js can try it. */
function suggestFor(text, caret, pages) {
  const head = text.slice(0, caret), next = text[caret] || '';
  if (!WORD.test(head.slice(-1)) || WORD.test(next)) return null;           // not at the end of a word
  if (text.slice(caret).trim()) return null;                                 // only while writing on, not editing inside the words
  const lastOpen = head.lastIndexOf('[['); if (lastOpen >= 0 && head.indexOf(']]', lastOpen) < 0) return null; // inside [[ ]]
  const lastTick = head.lastIndexOf('`'); if (lastTick >= 0 && (head.match(/`/g) || []).length % 2) return null; // inside `code`
  const run = /(\S+(?:\s+\S+){0,3})$/.exec(head); if (!run) return null;
  const base = caret - run[1].length, words = [];
  for (const m of run[1].matchAll(/\S+/g)) words.push({ at: base + m.index, word: m[0] });
  const current = words[words.length - 1].word;
  if (/^#|:\/\//.test(current)) return null;                                 // a tag, a web address
  for (let k = Math.min(4, words.length); k >= 1; k--) {
    let start = words[words.length - k].at, span = head.slice(start);
    const lead = span.match(/^[^\p{L}\p{N}]*/u)[0]; span = span.slice(lead.length); start += lead.length; // "(Mei" → "Mei"
    if (!span || /^#/.test(span)) continue;
    const q = span.toLowerCase().replace(/\s+/g, ' ');
    if (letters(q) < 3) continue;
    if (k === 1 && letters(q) < 4 && !/^\p{Lu}/u.test(span)) continue;        // "the" never shows a page
    const starts = [], inner = [];
    for (const page of pages) {
      if (page.lower.length < q.length) continue;
      if (page.lower.startsWith(q)) { starts.push({ page, at: 0 }); continue; }
      const at = wordStarts(page.lower).find(i => page.lower.startsWith(q, i));
      if (at !== undefined) inner.push({ page, at });
    }
    const hit = (starts.length ? starts : inner).sort(better)[0];
    // ghost: the rest of the name after the words; name: the whole name, shown as the cue when the words sit inside it
    // ("general hospital" → Riverside General Hospital) or finish it, so what the tap writes is never a surprise.
    if (hit) { const ghost = hit.page.title.slice(hit.at + q.length); return { start, end: caret, span, title: hit.page.title, ghost, name: hit.at > 0 || !ghost ? hit.page.title : '' }; }
  }
  return null;
}

/* The grey words sit where the box itself would put them: a copy of the box is laid over it, the same size, padding and
   font, with the typed words in it transparent and the rest of the name after them in grey. The browser lays both out the
   same, so the grey words start exactly at the cursor, on the same line, wrapping as the words would (0.4.363; measuring
   a point and placing a span there, 0.4.361, was a few pixels off and sat lower than the words). */
const COPIED = ['boxSizing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth',
  'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textTransform', 'wordSpacing', 'textIndent', 'tabSize', 'textAlign'];
function layOver(box, over, hit) {
  const doc = box.ownerDocument, outer = box.getBoundingClientRect(), style = doc.defaultView.getComputedStyle(box);
  for (const p of COPIED) over.style[p] = style[p];
  Object.assign(over.style, { left: outer.left + 'px', top: (outer.top - box.scrollTop) + 'px', width: outer.width + 'px', minHeight: outer.height + 'px', borderStyle: 'solid', borderColor: 'transparent', color: style.color });
  const [typed, grey] = over.children;
  typed.textContent = box.value.slice(0, hit.end);
  grey.textContent = hit.ghost;
  if (hit.name) grey.setAttribute('data-name', hit.name); else grey.removeAttribute('data-name');
  grey.title = `Hyper: [[${hit.title}]]`;
}
// What shows: the box, the suggestion and the grey words; the pages last read, for a tap on words the screen is behind on.
let showing = null, quiet = null, version = 0, lastPages = [];
const isBlockBox = node => node?.tagName === 'TEXTAREA' && !!node.closest('.ls-block');
function clear() {
  if (!showing) return;
  showing.ghost.remove();
  showing = null;
}
function draw(box, hit) {
  const doc = box.ownerDocument;
  const ghost = showing?.box === box ? showing.ghost : el(doc, 'div', { class: 'refinement-link-suggest', 'aria-hidden': 'true' }, el(doc, 'span', { class: 'rf-typed' }), el(doc, 'span', { class: 'rf-ghost' }));
  if (showing && showing.box !== box) clear();
  showing = { box, hit, ghost };
  layOver(box, ghost, hit);
  if (!ghost.isConnected) doc.body.append(ghost);
}
async function look(box) {
  if (!setting('linkSuggest') || !isBlockBox(box) || box.selectionStart !== box.selectionEnd) return clear();
  const text = box.value, caret = box.selectionStart;
  if (quiet && quiet.box === box && quiet.text === text) return;   // Escape: quiet until something else is typed
  quiet = null;
  const mine = ++version;
  const pages = lastPages = await propPages().catch(error => { warnOnce('the pages could not be read', error); return []; });
  if (mine !== version || !box.isConnected || box.value !== text || box.selectionStart !== caret || box.ownerDocument.activeElement !== box) return;
  if (screen.popupOpen()) return clear();                             // Logseq's own list ([[, /, a picker) has the keys
  const hit = suggestFor(text, caret, pages);
  if (!hit) return clear();
  draw(box, hit);
}
/* The brackets hidden in the bullet being written (0.4.367): the box's font starts with RfZeroBrackets, whose [ and ] are
   empty and have no width (every other letter falls through to the box's own font, so nothing moves), and a copy of the
   box laid over it draws a line under the words of each [[link]]. */
const ZERO_BRACKETS = 'AAEAAAAKAIAAAwAgT1MvMl5OWIMAAACsAAAAYGNtYXAAcQCWAAABDAAAADRnbHlmAAAAAAAAAUAAAAAEaGVhZF8eQOUAAAFEAAAANmhoZWEDIf88AAABfAAAACRobXR4AAAAAAAAAaAAAAAMbG9jYQAAAAAAAAGsAAAACG1heHAABAAAAAABtAAAACBuYW1lC50cQgAAAdQAAACocG9zdP+fADIAAAJ8AAAAIAAEAAABkAAFAAACigJYAAAASwKKAlgAAAFeADIA+gAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAABOT05FAEAAWwBdAyD/OAAAAyAAyAAAAAEAAAAAAfQCvAAAACAAAAAAAAEAAwABAAAADAAEACgAAAAGAAQAAQACAFsAXf//AAAAWwBd////pv+lAAEAAAAAAAAAAAAAAAEAAAABAAANGTDZXw889QALA+gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAIAAAAAAAAAAQAAAyD/OAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAA2AAMAAQQJAAEAHAAAAAMAAQQJAAIADgAcAAMAAQQJAAQAHAAqAAMAAQQJAAYALABGAFIAZgBaAGUAcgBvAEIAcgBhAGMAawBlAHQAcwBSAGUAZwB1AGwAYQByAFIAZgBaAGUAcgBvAEIAcgBhAGMAawBlAHQAcwBSAGYAWgBlAHIAbwBCAHIAYQBjAGsAZQB0AHMALQBSAGUAZwB1AGwAYQByAAMAAAAAAAD/nAAyAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
let bare = null; // { box, font (the box's own inline font, to give back), marks (the overlay) }
const LINKS = /\[\[([^\[\]]+)\]\]/g;
function hideBrackets(box) {
  if (!setting('linkSuggestUnderline') || !isBlockBox(box)) return;
  if (bare?.box !== box) {
    showBrackets();
    const doc = box.ownerDocument, own = box.style.fontFamily;
    box.style.fontFamily = `RfZeroBrackets, ${doc.defaultView.getComputedStyle(box).fontFamily}`;
    bare = { box, font: own, marks: el(doc, 'div', { class: 'refinement-link-marks', 'aria-hidden': 'true' }) };
    doc.body.append(bare.marks);
  }
  drawMarks();
}
function drawMarks() {
  if (!bare) return;
  const { box, marks } = bare;
  if (!box.isConnected) return showBrackets();
  const doc = box.ownerDocument, style = doc.defaultView.getComputedStyle(box), outer = box.getBoundingClientRect();
  for (const p of COPIED) marks.style[p] = style[p];
  Object.assign(marks.style, { left: outer.left + 'px', top: (outer.top - box.scrollTop) + 'px', width: outer.width + 'px', minHeight: outer.height + 'px',
    borderStyle: 'solid', borderColor: 'transparent' });
  marks.style.setProperty('--rf-link-line', `color-mix(in srgb, ${style.color} 45%, transparent)`);
  const value = box.value, pieces = [];
  let at = 0;
  for (const m of value.matchAll(LINKS)) {
    pieces.push(doc.createTextNode(value.slice(at, m.index + 2)), el(doc, 'u', {}, m[1]), doc.createTextNode(']]'));
    at = m.index + m[0].length;
  }
  pieces.push(doc.createTextNode(value.slice(at) || '\u200b'));
  marks.replaceChildren(...pieces);
}
function showBrackets() {
  if (!bare) return;
  const { box, font, marks } = bare;
  bare = null;
  marks.remove();
  if (box.isConnected) box.style.fontFamily = font;
}
// What brings the brackets back: a [ or ] typed or pasted, a bracket deleted, the cursor moved back into the words.
function bracketsBack(event) {
  if (!bare || event.target !== bare.box) return;
  const box = bare.box, key = event.key;
  if (key === '[' || key === ']') return showBrackets();
  if (key === 'Backspace' || key === 'Delete') {
    const from = box.selectionStart === box.selectionEnd ? (key === 'Backspace' ? box.selectionStart - 1 : box.selectionStart) : box.selectionStart;
    const to = box.selectionStart === box.selectionEnd ? from + 1 : box.selectionEnd;
    if (/[[\]]/.test(box.value.slice(Math.max(0, from), to))) showBrackets();
    return;
  }
  if (/^(Arrow|Home|End|Page)/.test(key)) showBrackets();
}

function onInput(event) {
  const box = event.target;
  if (!isBlockBox(box)) return;
  // A paste or a drop may bring brackets of its own: they show. Typing (the link taken, too) only moves the lines.
  if (bare?.box === box) { if (/^insertFrom(Paste|Drop)/.test(event.inputType || '')) showBrackets(); else drawMarks(); }
  keepUp(box);
  look(box).catch(error => warnOnce('the suggestion could not be made', error));
  // Logseq makes the box taller after this (a new line): both drawings are placed again before the screen is painted.
  const win = box.ownerDocument.defaultView;
  win.cancelAnimationFrame(keepUp.frame);
  keepUp.frame = win.requestAnimationFrame(() => { drawMarks(); if (showing?.box === box && box.isConnected) layOver(box, showing.ghost, showing.hit); });
}
/* The grey words follow each letter at once, as on a phone (0.4.367): the reading of the pages comes a moment later, and
   until then the old grey words sat over the letter just typed. A letter that matches the next grey one takes it off
   the front; anything else hides them until the reading is back. */
function keepUp(box) {
  if (!showing || showing.box !== box) return;
  const { hit } = showing, value = box.value, caret = box.selectionStart;
  const typed = value.slice(hit.end, caret);
  if (caret > hit.end && box.selectionStart === box.selectionEnd && value.slice(hit.start, hit.end) === hit.span && caret === value.length
      && typed.length <= hit.ghost.length && hit.ghost.slice(0, typed.length).toLowerCase() === typed.toLowerCase()) {
    showing.hit = { ...hit, end: caret, span: value.slice(hit.start, caret), ghost: hit.ghost.slice(typed.length) };
    layOver(box, showing.ghost, showing.hit);
  } else clear();
}
// Logseq takes Backspace and Delete itself in places (pairs of brackets, the start of a bullet) and sets the words without
// the usual typing signal, so the grey words stayed as they were (the owner, 2026-10-23: "if I press back the text just
// stays there"); the key's release looks again.
function onKeyUp(event) {
  if (event.key === 'Backspace' || event.key === 'Delete') onInput(event);
}
// The Hyper tap, or the keys set (the command in the register): the words become the link, typed as if by hand.
function acceptSuggestion(event) {
  if (!showing || event?.target !== showing.box) return false;
  const { box } = showing;
  let { hit } = showing;
  clear();
  // The screen may be behind the words (a Backspace Logseq took itself): what is suggested for the words as they are now.
  if (box.value.slice(hit.start, hit.end) !== hit.span || box.selectionStart !== hit.end) hit = box.selectionStart === box.selectionEnd ? suggestFor(box.value, box.selectionStart, lastPages) : null;
  if (!hit) return false;
  const link = `[[${hit.title}]]`;
  box.focus();
  // The brackets are hidden before they are typed, so they never show for a moment (0.4.367, the owner: "a little
  // jumpy and flashes sometimes").
  hideBrackets(box);
  box.setSelectionRange(hit.start, hit.end);
  let typed = false;
  try { typed = box.ownerDocument.execCommand('insertText', false, link); } catch (error) { typed = false; }
  if (!typed || box.value.slice(hit.start, hit.start + link.length) !== link) {
    box.setRangeText(link, hit.start, hit.end, 'end');
    box.dispatchEvent(new box.ownerDocument.defaultView.InputEvent('input', { bubbles: true, inputType: 'insertText', data: link }));
  }
  const after = hit.start + link.length;
  box.setSelectionRange(after, after);
  drawMarks();
  return true;
}
function onKey(event) {
  if (!showing) return;
  // Right arrow, alone, with the cursor where the grey words start: take them (it would move nowhere anyway, at the end
  // of the words). Taken before Logseq's own Right, which steps into the bullet's properties.
  if (event.key === 'ArrowRight' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && setting('linkSuggestRightArrow')
      && event.target === showing.box && showing.box.selectionStart === showing.box.selectionEnd && acceptSuggestion(event)) {
    event.preventDefault(); event.stopImmediatePropagation(); return;
  }
  if (event.key === 'Escape') { quiet = { box: showing.box, text: showing.box.value }; clear(); return; } // Logseq's Escape still leaves the bullet
  if (/^(Arrow|Enter|Home|End|Page)/.test(event.key)) clear();                                           // moving on leaves the words as typed
}
/* A lone tap of the Hyper key (the way of 0.4.148): the modifiers come down together (⌘⌃⌥ at once on a modifier key),
   nothing else is pressed, and a modifier comes up within 600 ms. Both halves of an Escape within 300 ms of the tap
   are swallowed, since some setups send one and Logseq would leave the bullet on it. */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Hyper']);
const hyperTap = { armedAt: 0, firedAt: 0 };
function onHyperDown(event) {
  if (event.key === 'Escape' && Date.now() - hyperTap.firedAt <= 300) { event.preventDefault(); event.stopImmediatePropagation(); return; }
  if (!MODIFIER_KEYS.has(event.key)) { hyperTap.armedAt = 0; return; }
  if (event.metaKey && event.ctrlKey && event.altKey && !hyperTap.armedAt) hyperTap.armedAt = Date.now();
}
function onHyperUp(event) {
  if (event.key === 'Escape' && Date.now() - hyperTap.firedAt <= 300) { event.preventDefault(); event.stopImmediatePropagation(); return; }
  if (!MODIFIER_KEYS.has(event.key) || !hyperTap.armedAt) return;
  const quick = Date.now() - hyperTap.armedAt < 600;
  hyperTap.armedAt = 0;
  if (!quick || !showing || !setting('linkSuggestHyperTap')) return;
  if (acceptSuggestion(event)) hyperTap.firedAt = Date.now();
}

const css = `
@font-face { font-family: RfZeroBrackets; src: url(data:font/ttf;base64,${ZERO_BRACKETS}) format('truetype'); unicode-range: U+5B, U+5D; font-display: block; }
.refinement-link-marks { position: fixed; z-index: 8; pointer-events: none; white-space: pre-wrap; overflow-wrap: break-word; overflow: hidden; color: transparent; background: none; }
.refinement-link-marks u { text-decoration: underline; text-decoration-color: var(--rf-link-line); text-decoration-thickness: 1px; text-underline-offset: .22em; }
.refinement-link-suggest { position: fixed; z-index: 9; pointer-events: none; white-space: pre-wrap; overflow-wrap: break-word; overflow: hidden; background: none; }
.refinement-link-suggest .rf-typed { color: transparent; }
.refinement-link-suggest .rf-ghost { opacity: .45; }
.refinement-link-suggest .rf-ghost[data-name]::after { content: "  " attr(data-name); font-size: .8em; opacity: .75; }
`;

function start() {
  ({ propPages, onPageChange, sendStyle, screen } = take(window.refinementCore, ['propPages', 'onPageChange', 'sendStyle', 'screen']));
  sendStyle('refinement-link-suggest', css);
  // The bracket font read now, not on the first link taken: a font still loading hides the letters drawn with it.
  try { host().fonts?.load('16px RfZeroBrackets', '[]').catch(() => {}); } catch (error) { /* an old window without the fonts list */ }
  const win = host().defaultView;
  listen(win, ['input'], onInput);
  listen(win, ['keydown'], onKey);
  listen(win, ['keydown'], bracketsBack);
  listen(win, ['keyup'], onKeyUp);
  listen(win, ['keydown'], onHyperDown);
  listen(win, ['keyup'], onHyperUp);
  listen(win, ['blur'], () => { hyperTap.armedAt = 0; });
  listen(win, ['focusout', 'pointerdown', 'mousedown'], () => { clear(); showBrackets(); });
  listen(win, ['scroll', 'resize'], () => { clear(); drawMarks(); });
  onPageChange(() => { clear(); showBrackets(); });
  onUnload(() => { clear(); showBrackets(); version++; });
}
// For tools/link-suggest-test.js (read-only): the rule and what shows, through the core.
const provide = core => core.provide({ linkSuggestInner: { suggestFor, get showing() { return showing; }, get bare() { return bare; } } });
(window.refinementParts ||= []).push({ name: 'link suggest', schema: settingsSchema, provide, start, stop: runUnloadTasks,
  commands: [{ key: 'accept-suggested-link', label: 'Take the suggested link', icon: 'link', shortcut: 'linkSuggestKeys', places: ['keys'], run: acceptSuggestion }] });
})();
