/* Loaded by main.js after parts/shadow.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* The pickers (0.4.253, layer 2): when Logseq's own list for a property opens ("Set Spoke with", from a click on the
   property or from Option-Enter), the nodes that fit this bullet come first, then Logseq's own alphabetical list as it
   was. What fits is the proposals' reading (parts/shadow.js, pickerOrder): the pages the bullet's words link that the
   property takes, then what the nodes the bullet looks like hold for it. On the Jul 30th line "The anaesthetist rang,
   [[Dr. Kenji Watanabe]]" Logseq lists Amara Okoro first and Dr. Kenji Watanabe fifth; with this, he is first.
   Logseq draws and owns the list, so nothing is added to it and no row is moved in it: the fitting rows are shown first
   by their order on screen (CSS order), with a faint line after them, and Up and Down follow the order you see by
   moving Logseq's own highlight (the pointer moving over a row, which is how Logseq highlights one). Enter, a click and
   typing to filter are Logseq's own, unchanged. Checked with Logseq 2.0.2 (2026-10-21): each row is a .menu-link-wrap
   in one plain container, the highlighted row is .menu-link.chosen, the box is input.cp__select-input "Set …". */
const shared = window.refinementShared;
const { host } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements (pickers): ',
  leaves: { attributes: ['data-refinement-fit', 'data-refinement-fit-last', 'data-refinement-fit-list'] } });
let propPages, watchDomEarly, provided;
const take = (core, names) => shared.take(core, names, warnOnce);

const settingsSchema = [
  { key: 'pickerHeading', type: 'heading', group: 'writing', rank: 3, title: 'Pickers', default: null,
    legend: 'In Logseq’s list for a property, the nodes that fit this bullet come first',
    zone: '<div><span class="m">Set Spoke with</span></div><div><span class="m">Dr. Kenji Watanabe</span></div><div><span class="m">Amara Okoro · Daniel Okoro …</span></div>',
    description: 'Changes here apply right away.' },
  { key: 'pickerFitsFirst', type: 'boolean', title: 'What fits this bullet first', default: true,
    description: 'When Logseq’s list for a property opens, the nodes that fit the bullet come first: a page its words link, then what the bullets it looks like had. A faint line follows them, then Logseq’s own list. Up and Down follow the order you see; Enter, a click and typing are Logseq’s own.' },
];
const setting = shared.settingReader(settingsSchema);

const SELECT_INPUT = 'input.cp__select-input';
// The bullet a list was opened from: the last one pressed in, or typed in, a moment before the list's box took the keys.
const lastBlock = { uuid: '', at: 0, words: null };
function noteBlock(event) {
  const block = event.target?.closest?.('.ls-block[blockid]');
  if (!block) return;
  const box = event.target.matches?.('textarea') ? event.target : null;
  Object.assign(lastBlock, { uuid: block.getAttribute('blockid'), at: Date.now(), words: box ? box.value : null });
}
// The open list: its box, the property's name, the fitting titles in order, and its version (a later reading wins).
let open = null, version = 0;
const rowsOf = box => {
  const popup = box.closest('[data-radix-popper-content-wrapper], .ui__dropdown-menu-content, .cp__select') || box.parentElement?.parentElement;
  return popup ? [...popup.querySelectorAll('.menu-link-wrap')] : [];
};
const rowTitle = wrap => (wrap.querySelector('.menu-link')?.textContent || wrap.textContent || '').trim().toLowerCase();

async function onFocus(event) {
  const box = event.target;
  if (!box?.matches?.(SELECT_INPUT) || !setting('pickerFitsFirst')) return;
  const title = /^Set (.+)$/.exec(box.getAttribute('placeholder') || '')?.[1];
  if (!title || !lastBlock.uuid || Date.now() - lastBlock.at > 5000 || !provided.pickerOrder) return;
  const mine = ++version, uuid = lastBlock.uuid;
  const [ids, pages] = await Promise.all([provided.pickerOrder(uuid, title, lastBlock.words).catch(error => { warnOnce('what fits could not be read', error); return []; }), propPages()]);
  if (mine !== version || !box.isConnected) return;
  const byId = new Map(pages.map(p => [p.id, p]));
  const titles = ids.map(id => byId.get(id)?.title).filter(Boolean).map(t => t.toLowerCase());
  open = titles.length ? { box, titles, moved: false } : null;
  apply();
}
// Shows the fitting rows first, in their order, with the faint line after the last. The top row gets Logseq's highlight
// until Up or Down moves it: Logseq highlights its own first row after every letter typed, which may now be lower down,
// and Enter would take a row that is not the one at the top (seen in the app: "dr" left Dr. Mei Chen highlighted
// under Dr. Kenji Watanabe).
function apply() {
  if (!open) return;
  if (!open.box.isConnected) { open = null; return; }
  const wraps = rowsOf(open.box);
  let last = null, n = 0;
  for (const wrap of wraps) {
    const at = open.titles.indexOf(rowTitle(wrap));
    const fit = at >= 0 ? String(at) : null;
    if (wrap.getAttribute('data-refinement-fit') !== fit) fit === null ? wrap.removeAttribute('data-refinement-fit') : wrap.setAttribute('data-refinement-fit', fit);
    wrap.removeAttribute('data-refinement-fit-last');
    if (fit !== null) { n++; if (!last || at > Number(last.getAttribute('data-refinement-fit'))) last = wrap; }
  }
  const list = wraps[0]?.parentElement;
  if (list && !list.hasAttribute('data-refinement-fit-list')) list.setAttribute('data-refinement-fit-list', '');
  // The line only when something else follows the fitting rows.
  if (last && n < wraps.length) last.setAttribute('data-refinement-fit-last', '');
  if (n && !open.moved) { const top = shown(wraps)[0]; if (top && !top.querySelector('.menu-link.chosen')) highlight(top); }
}
// The rows in the order they show: the fitting ones first, then Logseq's.
const shown = wraps => wraps.map((wrap, i) => ({ wrap, i, at: wrap.hasAttribute('data-refinement-fit') ? Number(wrap.getAttribute('data-refinement-fit')) - 100 : 0 }))
  .sort((a, b) => a.at - b.at || a.i - b.i).map(x => x.wrap);
// Logseq highlights the row the pointer moves over: the same, sent to the row.
let ownMove = false;
function highlight(wrap) {
  const link = wrap.querySelector('.menu-link') || wrap;
  const view = wrap.ownerDocument.defaultView;
  ownMove = true;
  try { for (const type of ['mouseover', 'mouseenter', 'mousemove']) link.dispatchEvent(new view.MouseEvent(type, { bubbles: type !== 'mouseenter', cancelable: true })); }
  finally { ownMove = false; }
  wrap.scrollIntoView?.({ block: 'nearest' });
}
function onKey(event) {
  if (!open || event.target !== open.box || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') || event.metaKey || event.ctrlKey || event.altKey) return;
  const rows = shown(rowsOf(open.box));
  if (!rows.some(wrap => wrap.hasAttribute('data-refinement-fit'))) return; // nothing moved: Logseq's own keys
  event.preventDefault();
  event.stopImmediatePropagation();
  const now = rows.findIndex(wrap => wrap.querySelector('.menu-link.chosen'));
  const next = now < 0 ? 0 : (now + (event.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length;
  open.moved = true;
  highlight(rows[next]);
}

const css = `
[data-refinement-fit-list] { display: flex; flex-direction: column; }
[data-refinement-fit-list] > [data-refinement-fit="0"] { order: -100; }
[data-refinement-fit-list] > [data-refinement-fit="1"] { order: -99; }
[data-refinement-fit-list] > [data-refinement-fit="2"] { order: -98; }
[data-refinement-fit-list] > [data-refinement-fit="3"] { order: -97; }
[data-refinement-fit-list] > [data-refinement-fit="4"] { order: -96; }
[data-refinement-fit-list] > [data-refinement-fit-last] { border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent); margin-bottom: 3px; padding-bottom: 3px; }
`;

function start() {
  ({ propPages, watchDomEarly } = take(window.refinementCore, ['propPages', 'watchDomEarly']));
  provided = window.refinementCore.provided;
  logseq.provideStyle({ key: 'refinement-picker', style: css });
  const win = host().defaultView;
  listen(win, ['pointerdown', 'keydown'], noteBlock);
  listen(win, ['focusin'], event => { onFocus(event).catch(error => warnOnce('the list could not be ordered', error)); });
  listen(win, ['keydown'], onKey);
  // The pointer moving over a row is the person choosing: the highlight is theirs from then on (not the plugin's own moves).
  listen(win, ['mousemove'], event => { if (open && !ownMove && event.target?.closest?.('.menu-link-wrap')) open.moved = true; });
  // A letter typed starts the highlight from the top again.
  listen(win, ['input'], event => { if (open && event.target === open.box) open.moved = false; });
  // Logseq draws the rows again as you type in its box, and moves its highlight back to its own first row: the order
  // and the top row's highlight are put back (a highlight already on the top row is left alone, so this settles).
  watchDomEarly((doc, records) => { if (open && records.some(record => record.type === 'childList' || record.target?.classList?.contains('menu-link'))) apply(); });
  onUnload(() => {
    open = null; version++;
    for (const name of ['data-refinement-fit', 'data-refinement-fit-last', 'data-refinement-fit-list']) for (const el of host().querySelectorAll(`[${name}]`)) el.removeAttribute(name);
  });
}
(window.refinementParts ||= []).push({ name: 'pickers', schema: settingsSchema, start, stop: runUnloadTasks });
// For tools/picker-test.js (read-only).
window.refinementPickerInner = { shown, get open() { return open; } };
})();
