/* Loaded by main.js before main.js starts it. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* Link selected text (0.4.252, layer 2, rebuilt on the model in place of the old link box of the editor part, deleted at 0.4.357): select
   words in a bullet you are writing and press Cmd+Option+L (Ctrl+Alt+L outside a Mac). A small box opens under the
   words; type a page's name and the pages that fit are listed (Dr. Mei Chen for "chen"), the closest first, each with its tag at the
   right. With nothing selected (0.4.254, at the owner's word: "I press cmd-option l without any selected text, then i
   can type alias hit enter then the page link search appears"), the words to show are typed first, Enter, then the page
   is looked for the same way and the link goes in at the cursor. Typing changes what the list looks for, as in a search box, though the cursor never leaves the bullet; Up
   and Down move, Enter or a click links the highlighted page, Escape closes the list and leaves the words alone.
   The words become [[Dr. Mei Chen]] when they are the page's name, else a link that keeps them, [the oncologist]([[Dr.
   Mei Chen]]): typed into the bullet as if by hand, so Logseq stores it as a real link, the proposals read it at once,
   and Cmd+Z takes it back. "New page …" is offered only when no page has that name, and is never first when one fits,
   so a typo cannot make a page; Logseq makes the page when the bullet is saved, as it does for a typed [[ ]].
   It writes only the link, only where the key was pressed, so it needs no list of graphs.
   On the kit since 0.4.314 (docs/LAYERS.md): the box is the kit's pop-up (the browser's popover, anchored at the words'
   place and flipped by the browser when there is no room; `manual`, since its keys stay in the bullet), its rows the
   kit's items with the page's tag in mono at the right, its field the kit's drawn field (drawn, not real, so Logseq's
   own Cmd+Z still takes the link back); the shortcut is a command in the one register (places: keys), changeable in
   the setting Keys for Link selected text; the page change comes from the core; no logseq.* call here. */
const shared = window.refinementShared;
const { host, notify, el, tag, drawnField } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements (link text): ', leaves: { elements: '.refinement-link-text' } });
let propPages, onPageChange;
const take = (core, names) => shared.take(core, names, warnOnce);

const settingsSchema = [
  { key: 'linkTextHeading', type: 'heading', group: 'writing', rank: 2, title: 'Link selected text', default: null,
    legend: 'Select words in a bullet and press ⌘⌥L: they become a link to the page you pick',
    zone: '<div><span class="m">Spoke with</span> <span class="m"><u>Chen</u></span> <span class="m">→ Dr. Mei Chen · Doctor</span></div>',
    description: 'Changes here apply right away.' },
  { key: 'linkText', type: 'boolean', title: 'Link selected text with ⌘⌥L', default: true,
    description: 'Select words in a bullet you are writing and press Cmd+Option+L (Ctrl+Alt+L outside a Mac). A box opens under the words; type a page’s name and the pages that fit are listed; typing changes what it looks for, Up and Down move, Enter or a click links the page, Escape leaves the words alone. With nothing selected, type the words to show first, Enter, then pick the page; the link goes in at the cursor. The words become a link that keeps them; Cmd+Z takes it back. “New page …” is offered only when no page has that name.' },
  { key: 'linkTextShortcut', type: 'string', title: 'Keys for Link selected text', default: 'mod+alt+l',
    description: 'The keys that open the box, in Logseq’s spelling (mod is ⌘ on a Mac and Ctrl elsewhere): mod+alt+l. Empty binds none. Changes here apply right away.' },
];
const setting = shared.settingReader(settingsSchema);

const MAX_ROWS = 7;
// How closely a page's name fits what is looked for: 0 the name itself, 1 the start of it, 2 the start of one of its
// words, 3 anywhere in it, 4 every word looked for somewhere in it; null when it does not fit.
function fit(lower, q) {
  if (!q) return null;
  if (lower === q) return 0;
  if (lower.startsWith(q)) return 1;
  if (lower.split(/[\s.,()\-–/]+/).some(word => word && word.startsWith(q))) return 2;
  if (lower.includes(q)) return 3;
  const words = q.split(/\s+/).filter(Boolean);
  return words.length > 1 && words.every(word => lower.includes(word)) ? 4 : null;
}
// What a page is, for the right side of its row: "tag" for a tag's page, else its first tag of yours.
const kindOf = page => page.isTag ? 'tag' : (page.tags || []).map(t => t.title).find(t => t && !/^(page|tag)$/i.test(t)) || '';
// The rows for what is looked for: the fitting pages, closest and shortest first, then "New page …" when none has the name.
function rowsFor(pages, looked) {
  const q = String(looked || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return [];
  const hits = [];
  for (const page of pages) { const score = fit(page.lower, q); if (score !== null) hits.push({ page, score }); }
  hits.sort((a, b) => a.score - b.score || a.page.title.length - b.page.title.length || a.page.lower.localeCompare(b.page.lower));
  const rows = hits.slice(0, MAX_ROWS).map(({ page }) => ({ kind: 'page', title: page.title, right: kindOf(page) }));
  const name = String(looked).trim().replace(/\s+/g, ' ');
  if (!hits.some(h => h.score === 0) && !/[[\]\r\n]/.test(name)) rows.push({ kind: 'new', title: name, right: '' });
  return rows;
}
// The words typed in place of the selection: [[Page]] when the words are its name, else [words]([[Page]]); the
// spaces around the words stay outside the link.
function linkFor(words, title) {
  const lead = words.match(/^\s*/)[0], trail = words.match(/\s*$/)[0], core = words.trim();
  const link = core.toLowerCase() === title.toLowerCase() ? `[[${title}]]` : `[${core}]([[${title}]])`;
  return lead + link + trail;
}

/* Where the selected words sit on screen: a hidden copy of the text box, laid out the same, measured up to them
   (from the old link box, 0.4.137). The kit's pop-up is anchored there. */
function wordsRect(box, start, end) {
  const doc = box?.ownerDocument;
  if (!doc || !box.isConnected) return null;
  const outer = box.getBoundingClientRect();
  if (!outer.width && !outer.height) return null;
  const style = doc.defaultView.getComputedStyle(box), copy = doc.createElement('div');
  for (const p of ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth',
    'borderBottomWidth', 'borderLeftWidth', 'borderStyle', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight',
    'textTransform', 'wordSpacing', 'textIndent', 'tabSize']) copy.style[p] = style[p];
  Object.assign(copy.style, { position: 'fixed', left: '0', top: '0', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', pointerEvents: 'none' });
  copy.textContent = box.value.slice(0, start);
  const words = doc.createElement('span');
  words.textContent = box.value.slice(start, end) || '​';
  copy.append(words);
  doc.body.append(copy);
  const base = copy.getBoundingClientRect(), lines = words.getClientRects();
  const first = lines[0], last = lines[lines.length - 1] || first;
  copy.remove();
  if (!first) return { left: outer.left, top: outer.top, right: outer.left, bottom: outer.bottom };
  const dx = outer.left - base.left - box.scrollLeft, dy = outer.top - base.top - box.scrollTop;
  const left = (lines.length > 1 ? last.left : first.left) + dx;
  return { left: left - 6, top: first.top + dy, right: left - 6, bottom: last.bottom + dy };
}

// The open list: the text box and the selection it was opened on, what is looked for, the rows and the highlighted one.
let open = null;
const isBlockBox = el => el?.tagName === 'TEXTAREA' && !!el.closest('.ls-block');

async function openList(box) {
  const start = box.selectionStart, end = box.selectionEnd, words = box.value.slice(start, end);
  if (/[\r\n]/.test(words) || /[[\]]/.test(words)) return notify('Select words on one line, outside any link', 'warning');
  const pages = await propPages().catch(error => { warnOnce('the pages could not be read', error); return []; });
  if (box.ownerDocument.activeElement !== box || box.selectionStart !== start || box.selectionEnd !== end) return; // moved on meanwhile
  close();
  const doc = box.ownerDocument;
  // Nothing selected (0.4.254): first the words to show, typed here, then the page, as for selected words. The page
  // field starts empty either way (0.4.256, the owner: "it should be empty not test which was the selected text").
  const label = words.trim();
  const pop = shared.popup({ doc, at: wordsRect(box, start, end), manual: true, cls: 'refinement-link-text', width: Math.min(420, doc.defaultView.innerWidth - 16), onClose: () => { if (open?.pop === pop) open = null; } });
  pop.el.setAttribute('role', 'listbox');
  // A press in the box stays out of the bullet's way: the cursor never leaves the words.
  pop.el.addEventListener('mousedown', event => event.preventDefault());
  open = { box, start, end, selected: words, words: label ? words : '', step: label ? 'page' : 'words', pages, looked: '', fresh: false, rows: [], at: 0, pop };
  draw();
}
// The shortcut, as the register shows it beside the field: ⌘⌥L on a Mac.
const keysShown = () => String(setting('linkTextShortcut') || '').split('+').map(k => ({ mod: /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl+', alt: /Mac/.test(navigator.platform) ? '⌥' : 'Alt+', shift: '⇧', ctrl: '⌃' }[k] || k.toUpperCase())).join('');
function draw() {
  if (!open) return;
  const { pop } = open, doc = pop.el.ownerDocument;
  pop.el.querySelector('.rf-pop-head')?.remove();
  pop.el.querySelector('.rf-field')?.remove();
  const body = pop.body;
  if (open.step === 'words') {
    open.rows = [];
    body.before(el(doc, 'div', { class: 'rf-pop-head' }, 'The words to show'), drawnField(doc, { text: open.looked, placeholder: 'Type the words, then Enter' }));
    pop.items([{ note: 'Enter: choose the page they link to' }]);
    return;
  }
  open.rows = rowsFor(open.pages, open.looked);
  // "New page …" is never the default while a page fits.
  open.at = Math.min(open.at, Math.max(0, open.rows.length - 1));
  body.before(el(doc, 'div', { class: 'rf-pop-head' }, `Link “${open.words.trim()}” to`), drawnField(doc, { text: open.looked, placeholder: 'Type a page’s name', fresh: open.fresh, kbd: keysShown() }));
  pop.items(open.rows.length
    ? open.rows.map((row, i) => row.kind === 'new'
      ? { label: `New page “${row.title}”`, cls: 'rf-new', faint: true, on: i === open.at, title: row.title, run: () => choose(i) }
      : { label: row.title, on: i === open.at, title: row.title, right: row.right === 'tag' ? 'tag' : row.right ? tag(doc, row.right, { plain: true }) : 'page', run: () => choose(i) })
    : [{ note: 'Type the page’s name' }]);
}
function close() {
  if (!open) return;
  const { pop } = open;
  open = null;
  pop.close();
}
// Types the link in place of the selected words (or at the cursor, when nothing was selected), as if by hand: Logseq
// saves it as a link and Cmd+Z takes it back.
function choose(i) {
  const row = open?.rows[i];
  if (!row) return;
  const { box, start, end, selected, words } = open;
  close();
  if (!box.isConnected || box.value.slice(start, end) !== selected) return notify('The words changed; select them again', 'warning');
  box.focus();
  box.setSelectionRange(start, end);
  const link = linkFor(words, row.title);
  let typed = false;
  try { typed = box.ownerDocument.execCommand('insertText', false, link); } catch (error) { typed = false; }
  if (!typed || box.value.slice(start, start + link.length) !== link) {
    box.setRangeText(link, start, end, 'end');
    box.dispatchEvent(new box.ownerDocument.defaultView.InputEvent('input', { bubbles: true, inputType: 'insertText', data: link }));
  }
  const after = start + link.length;
  box.setSelectionRange(after, after);
}

// The keys while the list is open: they keep going to the bullet's box, and the list reads them first.
function onKey(event) {
  if (!open) return;
  const key = event.key;
  if (event.target !== open.box) { close(); return; }
  const own = () => { event.preventDefault(); event.stopImmediatePropagation(); };
  if (key === 'Escape') { own(); const { box, start, end } = open; close(); box.setSelectionRange(start, end); return; }
  if (key === 'Enter') {
    own();
    if (open.step === 'page') { choose(open.at); return; }
    if (!open.looked.trim()) return; // no words yet
    // The page is looked for from an empty field (0.4.255, the owner: "I hit enter after yes, but appears still in input").
    Object.assign(open, { step: 'page', words: open.looked.trim(), looked: '', fresh: false, at: 0 });
    draw();
    return;
  }
  if (key === 'ArrowDown' || key === 'ArrowUp') { own(); if (open.rows.length) open.at = (open.at + (key === 'ArrowDown' ? 1 : open.rows.length - 1)) % open.rows.length; draw(); return; }
  if (key === 'Backspace') { own(); open.looked = open.fresh ? '' : open.looked.slice(0, -1); open.fresh = false; open.at = 0; draw(); return; }
  if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
    own();
    if (/[[\]\r\n]/.test(key)) return; // the words of a link cannot hold brackets
    open.looked = (open.fresh ? '' : open.looked) + key; open.fresh = false; open.at = 0; draw(); return;
  }
  if (['Shift', 'Alt', 'Meta', 'Control', 'CapsLock'].includes(key)) return;
  close(); // any other key (Left, Tab, a shortcut) is the bullet's again
}
// The command (the one register, places: keys): true when the key was the plugin's.
function linkSelectedText(event) {
  if (open || !setting('linkText') || !isBlockBox(event?.target)) return false;
  openList(event.target).catch(error => warnOnce('the list could not open', error));
  return true;
}
// A press anywhere outside the box closes the list (the box itself keeps the cursor in the bullet, above).
function onPress(event) {
  if (!open || event.target.closest?.('.refinement-link-text')) return;
  close();
}

function start() {
  ({ propPages, onPageChange } = take(window.refinementCore, ['propPages', 'onPageChange']));
  const win = host().defaultView;
  listen(win, ['keydown'], onKey);
  listen(win, ['mousedown', 'pointerdown'], onPress);
  listen(win, ['scroll', 'resize'], () => close());
  onPageChange(() => close());
  onUnload(() => close());
}
// For tools/link-text-test.js (read-only): the rules, through the core.
const provide = core => core.provide({ linkTextInner: { fit, rowsFor, linkFor, get open() { return open; } } });
(window.refinementParts ||= []).push({ name: 'link text', schema: settingsSchema, provide, start, stop: runUnloadTasks,
  commands: [{ key: 'link-selected-text', label: 'Link selected text', icon: 'link', shortcut: 'linkTextShortcut', places: ['keys'], run: linkSelectedText }] });
})();
