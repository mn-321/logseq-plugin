/* Loaded by main.js after parts/link-text.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* Suggested links while typing (0.4.360, layer 3; the owner, 2026-10-23: "suggesting wikilinks in line almost like
   autosuggestion like on an iphone … I can easily ignore it by just keeping writing"). While a bullet is written, when
   the last word or words typed start a page's name, or a word inside it, the rest of the name shows in grey right after
   the cursor: "Spoke with Dr. Mei" shows " Chen", "Mei" alone shows " Chen" too (the name is Dr. Mei Chen). A tap of the
   Hyper key takes it (0.4.361; the owner's Caps Lock sends Cmd+Ctrl+Opt+Shift, and "Tab moves a bullet"): the words
   typed become [[Dr. Mei Chen]], typed as if by hand, so Cmd+Z takes it back. Anything else ignores it:
   keep writing and it changes or goes; a space, Enter, an arrow, a click or Escape leaves the words as they are. It shows nothing inside [[ ]], after #, while one of Logseq's own lists is open, or
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
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements (suggested links): ', leaves: { elements: '.refinement-link-suggest' } });
let propPages, onPageChange, sendStyle, screen;
const take = (core, names) => shared.take(core, names, warnOnce);

const settingsSchema = [
  { key: 'linkSuggestHeading', type: 'heading', group: 'writing', rank: 4, title: 'Suggested links', default: null,
    legend: 'While you write, the rest of a page’s name shows in grey after the cursor; a tap of the Hyper key makes the link',
    zone: '<div><span class="m">Spoke with Dr. Mei</span><span class="m" style="opacity:.45"> Chen ⇪</span></div>',
    description: 'Changes here apply right away.' },
  { key: 'linkSuggest', type: 'boolean', title: 'Suggest links while typing', default: true,
    description: 'When the last words typed start a page’s name, or a word in it, the rest of the name shows in grey right after the cursor. A tap of the Hyper key turns the words into [[the page]]; Cmd+Z takes it back. Anything else ignores it: keep writing, press space, an arrow or Enter, and the words stay as typed. Nothing shows inside [[ ]], after #, or for a short lower-case word.' },
  { key: 'linkSuggestHyperTap', type: 'boolean', title: 'A tap of the Hyper key takes the suggested link', default: true,
    description: 'If Caps Lock is your Hyper key (⌘⌃⌥⇧, set up with Karabiner or the Hyperkey app), tapping it on its own while grey words show makes the link. Holding Hyper with another key works as before. An Escape your setup sends on a tap is ignored. Changes here apply right away.' },
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
      if (page.lower === q || page.lower.length <= q.length) continue;
      if (page.lower.startsWith(q)) { starts.push({ page, at: 0 }); continue; }
      const at = wordStarts(page.lower).find(i => page.lower.startsWith(q, i) && page.lower.length > i + q.length);
      if (at !== undefined) inner.push({ page, at });
    }
    const hit = (starts.length ? starts : inner).sort(better)[0];
    if (hit) return { start, end: caret, span, title: hit.page.title, ghost: hit.page.title.slice(hit.at + q.length) };
  }
  return null;
}

/* Where the cursor sits on screen: a hidden copy of the text box, laid out the same, measured up to it (the way the link
   box finds its words, parts/link-text.js). */
function caretRect(box, pos) {
  const doc = box?.ownerDocument;
  if (!doc || !box.isConnected) return null;
  const outer = box.getBoundingClientRect();
  const style = doc.defaultView.getComputedStyle(box), copy = doc.createElement('div');
  for (const p of ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth',
    'borderBottomWidth', 'borderLeftWidth', 'borderStyle', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight',
    'textTransform', 'wordSpacing', 'textIndent', 'tabSize']) copy.style[p] = style[p];
  Object.assign(copy.style, { position: 'fixed', left: '0', top: '0', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', pointerEvents: 'none' });
  copy.textContent = box.value.slice(0, pos);
  const mark = doc.createElement('span');
  mark.textContent = '​';
  copy.append(mark, doc.createTextNode(box.value.slice(pos)));
  doc.body.append(copy);
  const base = copy.getBoundingClientRect(), at = mark.getBoundingClientRect();
  copy.remove();
  const dx = outer.left - base.left - box.scrollLeft, dy = outer.top - base.top - box.scrollTop;
  return { left: at.left + dx, top: at.top + dy, height: at.height, right: outer.right, style };
}

// What shows: the box, the suggestion and the grey words.
let showing = null, quiet = null, version = 0;
const isBlockBox = node => node?.tagName === 'TEXTAREA' && !!node.closest('.ls-block');
function clear() {
  if (!showing) return;
  showing.ghost.remove();
  showing = null;
}
function draw(box, hit) {
  const doc = box.ownerDocument;
  const ghost = showing?.box === box ? showing.ghost : el(doc, 'span', { class: 'refinement-link-suggest', 'aria-hidden': 'true' });
  if (showing && showing.box !== box) clear();
  showing = { box, hit, ghost };
  ghost.textContent = hit.ghost;
  ghost.title = `Hyper: [[${hit.title}]]`;
  const at = caretRect(box, hit.end);
  if (at) {
    for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight']) ghost.style[p] = at.style[p];
    Object.assign(ghost.style, { left: at.left + 'px', top: at.top + 'px', height: at.height + 'px', maxWidth: Math.max(0, at.right - at.left) + 'px', color: at.style.color });
  }
  if (!ghost.isConnected) doc.body.append(ghost);
}
async function look(box) {
  if (!setting('linkSuggest') || !isBlockBox(box) || box.selectionStart !== box.selectionEnd) return clear();
  const text = box.value, caret = box.selectionStart;
  if (quiet && quiet.box === box && quiet.text === text) return;   // Escape: quiet until something else is typed
  quiet = null;
  const mine = ++version;
  const pages = await propPages().catch(error => { warnOnce('the pages could not be read', error); return []; });
  if (mine !== version || !box.isConnected || box.value !== text || box.selectionStart !== caret || box.ownerDocument.activeElement !== box) return;
  if (screen.popupOpen()) return clear();                             // Logseq's own list ([[, /, a picker) has the keys
  const hit = suggestFor(text, caret, pages);
  if (!hit) return clear();
  draw(box, hit);
}
function onInput(event) {
  const box = event.target;
  if (!isBlockBox(box)) return;
  look(box).catch(error => warnOnce('the suggestion could not be made', error));
}
// The Hyper tap, or the keys set (the command in the register): the words become the link, typed as if by hand.
function acceptSuggestion(event) {
  if (!showing || event?.target !== showing.box) return false;
  const { box, hit } = showing;
  clear();
  if (box.value.slice(hit.start, hit.end) !== hit.span || box.selectionStart !== hit.end) return false; // the words changed meanwhile
  const link = `[[${hit.title}]]`;
  box.focus();
  box.setSelectionRange(hit.start, hit.end);
  let typed = false;
  try { typed = box.ownerDocument.execCommand('insertText', false, link); } catch (error) { typed = false; }
  if (!typed || box.value.slice(hit.start, hit.start + link.length) !== link) {
    box.setRangeText(link, hit.start, hit.end, 'end');
    box.dispatchEvent(new box.ownerDocument.defaultView.InputEvent('input', { bubbles: true, inputType: 'insertText', data: link }));
  }
  const after = hit.start + link.length;
  box.setSelectionRange(after, after);
  return true;
}
function onKey(event) {
  if (!showing) return;
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
.refinement-link-suggest { position: fixed; z-index: 9; pointer-events: none; white-space: pre; overflow: hidden; opacity: .45; }
.refinement-link-suggest::after { content: " ⇪"; font-family: var(--rf-mono); font-size: .8em; opacity: .7; }
`;

function start() {
  ({ propPages, onPageChange, sendStyle, screen } = take(window.refinementCore, ['propPages', 'onPageChange', 'sendStyle', 'screen']));
  sendStyle('refinement-link-suggest', css);
  const win = host().defaultView;
  listen(win, ['input'], onInput);
  listen(win, ['keydown'], onKey);
  listen(win, ['keydown'], onHyperDown);
  listen(win, ['keyup'], onHyperUp);
  listen(win, ['blur'], () => { hyperTap.armedAt = 0; });
  listen(win, ['focusout', 'pointerdown', 'mousedown'], () => clear());
  listen(win, ['scroll', 'resize'], () => clear());
  onPageChange(() => clear());
  onUnload(() => { clear(); version++; });
}
// For tools/link-suggest-test.js (read-only): the rule and what shows, through the core.
const provide = core => core.provide({ linkSuggestInner: { suggestFor, get showing() { return showing; } } });
(window.refinementParts ||= []).push({ name: 'link suggest', schema: settingsSchema, provide, start, stop: runUnloadTasks,
  commands: [{ key: 'accept-suggested-link', label: 'Take the suggested link', icon: 'link', shortcut: 'linkSuggestKeys', places: ['keys'], run: acceptSuggestion }] });
})();
