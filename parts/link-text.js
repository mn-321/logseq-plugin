/* Loaded by main.js before main.js starts it. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* Link selected text (0.4.252, layer 2, rebuilt on the model in place of the old link box in parts/editor.js): select
   words in a bullet you are writing and press Cmd+Option+L (Ctrl+Alt+L outside a Mac). A small list opens under the
   words with the pages whose names fit them (Dr. Mei Chen for "Chen"), the closest first, each with its tag at the
   right. With nothing selected (0.4.254, at the owner's word: "I press cmd-option l without any selected text, then i
   can type alias hit enter then the page link search appears"), the words to show are typed first, Enter, then the page
   is looked for the same way and the link goes in at the cursor. Typing changes what the list looks for, as in a search box, though the cursor never leaves the bullet; Up
   and Down move, Enter or a click links the highlighted page, Escape closes the list and leaves the words alone.
   The words become [[Dr. Mei Chen]] when they are the page's name, else a link that keeps them, [the oncologist]([[Dr.
   Mei Chen]]): typed into the bullet as if by hand, so Logseq stores it as a real link, the proposals read it at once,
   and Cmd+Z takes it back. "New page …" is offered only when no page has that name, and is never first when one fits,
   so a typo cannot make a page; Logseq makes the page when the bullet is saved, as it does for a typed [[ ]].
   It writes only the link, only where the key was pressed, so it needs no list of graphs. */
const shared = window.refinementShared;
const { host, notify } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements (link text): ', leaves: { elements: '.refinement-link-text' } });
let propPages;
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };

const settingsSchema = [
  { key: 'linkTextHeading', type: 'heading', group: 'writing', rank: 2, title: 'Link selected text', default: null,
    legend: 'Select words in a bullet and press ⌘⌥L: they become a link to the page you pick',
    zone: '<div><span class="m">Spoke with</span> <span class="m"><u>Chen</u></span> <span class="m">→ Dr. Mei Chen · Doctor</span></div>',
    description: 'Changes here apply right away.' },
  { key: 'linkText', type: 'boolean', title: 'Link selected text with ⌘⌥L', default: true,
    description: 'Select words in a bullet you are writing and press Cmd+Option+L (Ctrl+Alt+L outside a Mac). A list of the pages whose names fit opens under the words; typing changes what it looks for, Up and Down move, Enter or a click links the page, Escape leaves the words alone. With nothing selected, type the words to show first, Enter, then pick the page; the link goes in at the cursor. The words become a link that keeps them; Cmd+Z takes it back. “New page …” is offered only when no page has that name.' },
];
const setting = shared.settingReader(settingsSchema);

const esc = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
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
   (from the old link box, 0.4.137). */
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
  if (!first) return { left: outer.left, top: outer.top, bottom: outer.bottom };
  const dx = outer.left - base.left - box.scrollLeft, dy = outer.top - base.top - box.scrollTop;
  return { left: (lines.length > 1 ? last.left : first.left) + dx, top: first.top + dy, bottom: last.bottom + dy };
}

// The open list: the text box and the selection it was opened on, what is looked for, the rows and the highlighted one.
let open = null;
const isBlockBox = el => el?.tagName === 'TEXTAREA' && !!el.closest('.ls-block');
const isLinkKey = event => event.altKey && !event.shiftKey && event.code === 'KeyL' && (event.metaKey || (event.ctrlKey && !/Mac/.test(navigator.platform)));

async function openList(box) {
  const start = box.selectionStart, end = box.selectionEnd, words = box.value.slice(start, end);
  if (/[\r\n]/.test(words) || /[[\]]/.test(words)) return notify('Select words on one line, outside any link', 'warning');
  const pages = await propPages().catch(error => { warnOnce('the pages could not be read', error); return []; });
  if (box.ownerDocument.activeElement !== box || box.selectionStart !== start || box.selectionEnd !== end) return; // moved on meanwhile
  close();
  const doc = box.ownerDocument, el = doc.createElement('div');
  el.className = 'refinement-link-text';
  el.setAttribute('role', 'listbox');
  el.style.background = backgroundOf(box);
  el.style.color = box.ownerDocument.defaultView.getComputedStyle(box).color;
  doc.body.append(el);
  // Nothing selected (0.4.254): first the words to show, typed here, then the page, as for selected words.
  const label = words.trim();
  open = { box, start, end, selected: words, words: label ? words : '', step: label ? 'page' : 'words', pages, looked: label, fresh: !!label, rows: [], at: 0, el };
  place(el, wordsRect(box, start, end));
  draw();
}
// The page's own background, read from the bullet up: Logseq's colour variables are not set in every theme (dark mode
// fell back to white, seen 2026-10-21).
function backgroundOf(el) {
  const view = el.ownerDocument.defaultView;
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const bg = view.getComputedStyle(node).backgroundColor;
    if (bg && !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(bg)) return bg;
  }
  return '';
}
function place(el, at) {
  const win = el.ownerDocument.defaultView, width = Math.min(520, win.innerWidth - 16);
  el.style.width = `${width}px`;
  if (!at) return;
  el.style.left = `${Math.max(8, Math.min(at.left - 6, win.innerWidth - width - 8))}px`;
  if (win.innerHeight - at.bottom < 300 && at.top > win.innerHeight - at.bottom) { el.style.top = ''; el.style.bottom = `${win.innerHeight - at.top + 4}px`; }
  else { el.style.bottom = ''; el.style.top = `${at.bottom + 4}px`; }
}
// What is typed shows in a field of its own at the top, in the text colour, with a caret; while it is still the
// selected words untouched it shows selected, since the first letter typed replaces it.
function field(text, placeholder, fresh) {
  return `<div class="rlt-field">${text ? `<span class="rlt-typed${fresh ? ' rlt-fresh' : ''}">${esc(text)}</span>` : `<span class="rlt-placeholder">${esc(placeholder)}</span>`}<span class="rlt-caret"></span></div>`;
}
function draw() {
  if (!open) return;
  if (open.step === 'words') {
    open.rows = [];
    open.el.innerHTML = '<div class="rlt-head">The words to show</div>' + field(open.looked, 'Type the words, then Enter', false)
      + '<div class="rlt-none">Enter: choose the page they link to</div>';
    return;
  }
  open.rows = rowsFor(open.pages, open.looked);
  // "New page …" is never the default while a page fits.
  open.at = Math.min(open.at, Math.max(0, open.rows.length - 1));
  open.el.innerHTML = `<div class="rlt-head">Link “${esc(open.words.trim())}” to</div>` + field(open.looked, 'Type a page’s name', open.fresh)
    + (open.rows.length ? open.rows.map((row, i) => `<div class="rlt-row${i === open.at ? ' rlt-on' : ''}${row.kind === 'new' ? ' rlt-new' : ''}" role="option" data-i="${i}" title="${esc(row.title)}">`
      + `<span class="rlt-title">${row.kind === 'new' ? `New page “${esc(row.title)}”` : esc(row.title)}</span>${row.right ? `<span class="rlt-kind">${esc(row.right)}</span>` : ''}</div>`).join('')
      : '');
}
function close() {
  if (!open) return;
  open.el.remove();
  open = null;
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

function onKey(event) {
  if (open) {
    const key = event.key;
    if (event.target !== open.box) { close(); return; }
    const own = () => { event.preventDefault(); event.stopImmediatePropagation(); };
    if (key === 'Escape') { own(); const { box, start, end } = open; close(); box.setSelectionRange(start, end); return; }
    if (key === 'Enter') {
      own();
      if (open.step === 'page') { choose(open.at); return; }
      if (!open.looked.trim()) return; // no words yet
      Object.assign(open, { step: 'page', words: open.looked.trim(), fresh: true, at: 0 });
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
    return;
  }
  if (!isLinkKey(event) || !setting('linkText') || !isBlockBox(event.target)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openList(event.target).catch(error => warnOnce('the list could not open', error));
}
// A press on a row picks it, without taking the cursor out of the bullet; a press anywhere else closes the list.
function onPress(event) {
  if (!open) return;
  const row = event.target.closest?.('.refinement-link-text .rlt-row');
  if (row) { event.preventDefault(); event.stopImmediatePropagation(); if (event.type === 'mousedown') choose(Number(row.dataset.i)); return; }
  if (event.target.closest?.('.refinement-link-text')) { event.preventDefault(); return; }
  close();
}

// Logseq's own theme only (layer 2): greys mixed from the text colour, so dark mode works too.
const css = `
.refinement-link-text { position: fixed; z-index: 9999; padding: 4px; border-radius: 8px; font-size: 14px; line-height: 1.35;
  background: var(--ls-primary-background-color, Canvas); color: var(--ls-primary-text-color, CanvasText);
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent); box-shadow: 0 6px 20px rgba(0, 0, 0, .14); }
.refinement-link-text .rlt-head { padding: 4px 8px 6px; font-size: 12px; color: color-mix(in srgb, currentColor 55%, transparent); }
.refinement-link-text .rlt-looked { color: color-mix(in srgb, currentColor 85%, transparent); }
.refinement-link-text .rlt-row { display: flex; align-items: baseline; gap: 10px; padding: 5px 8px; border-radius: 5px; cursor: pointer; }
.refinement-link-text .rlt-row.rlt-on { background: color-mix(in srgb, currentColor 9%, transparent); }
.refinement-link-text .rlt-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.refinement-link-text .rlt-new .rlt-title { font-style: italic; color: color-mix(in srgb, currentColor 65%, transparent); }
.refinement-link-text .rlt-kind { flex: none; font-size: 12px; color: color-mix(in srgb, currentColor 50%, transparent); }
.refinement-link-text .rlt-none { padding: 5px 8px; color: color-mix(in srgb, currentColor 50%, transparent); }
.refinement-link-text .rlt-field { display: flex; align-items: baseline; margin: 0 4px 4px; padding: 5px 8px; border-radius: 5px; font-size: 15px;
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent); min-height: 1.4em; }
.refinement-link-text .rlt-typed { white-space: pre; overflow: hidden; text-overflow: ellipsis; }
.refinement-link-text .rlt-typed.rlt-fresh { background: color-mix(in srgb, currentColor 16%, transparent); border-radius: 2px; }
.refinement-link-text .rlt-placeholder { color: color-mix(in srgb, currentColor 45%, transparent); }
.refinement-link-text .rlt-caret { display: inline-block; width: 1.5px; height: 1.1em; margin-left: 1px; align-self: center; background: currentColor; animation: rlt-blink 1s steps(1) infinite; }
.refinement-link-text .rlt-placeholder + .rlt-caret { order: -1; margin: 0 1px 0 0; }
@keyframes rlt-blink { 50% { opacity: 0; } }
`;

function start() {
  ({ propPages } = take(window.refinementCore, ['propPages']));
  logseq.provideStyle({ key: 'refinement-link-text', style: css });
  const win = host().defaultView;
  listen(win, ['keydown'], onKey);
  listen(win, ['mousedown', 'pointerdown', 'click'], onPress);
  listen(win, ['scroll', 'resize'], () => close());
  const offRoute = logseq.App.onRouteChanged?.(() => close());
  if (typeof offRoute === 'function') onUnload(offRoute);
  onUnload(() => close());
}
(window.refinementParts ||= []).push({ name: 'link text', schema: settingsSchema, start, stop: runUnloadTasks });
// For tools/link-text-test.js (read-only): the rules.
window.refinementLinkTextInner = { fit, rowsFor, linkFor, get open() { return open; } };
})();
