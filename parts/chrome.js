/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Chrome part of DB Refinements (moved out of main.js in the October 2026 cleanup): Logseq's own
   chrome made quieter. The right sidebar's presentation (properties opened, Page graph and (Dev)
   buttons hidden), the quiet sidebar and toolbar items (Flashcards, Graph view…) and the empty [[ ]]
   menu until you type. It provides its three start functions to the core; main() calls them where it
   always did. */
const shared = window.refinementShared;
const { host } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements: ',
  leaves: { attributes: ['data-refinement-quiet', 'data-refinement-sidebar-hidden', 'data-refinement-quiet-menu'] } });
// From the core, taken when the part starts.
let setting, watchDom, watchDomEarly, ensureDomWatch, sendStyle;
// A name may be the core's own or one another part provided; a missing one is a broken contract.
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };

// Use native controls to expand properties, so Logseq still renders editable values.
const sidebarPresentation = { hidden: new Set(), pending: new WeakMap() };
function updateSidebarPresentation(doc) {
  const sidebar = doc.querySelector('#right-sidebar');
  if (!sidebar) return;
  for (const el of sidebarPresentation.hidden) if (!el.isConnected) sidebarPresentation.hidden.delete(el);
  const normalize = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const devTabs = new Set(['(Dev) RTC', '(Dev) Undo/Redo', '(Dev) Profiler', 'Page graph', 'Page Graph']);
  for (const el of sidebar.querySelectorAll('a, button, [role="tab"], [role="button"], span, div')) {
    if (el.childElementCount > 3) continue; // tabs and toggles are small; skip big containers cheaply
    const label = normalize(el);
    const propertyToggle = /^(?:Show|Open|Hide) properties$/i.test(label);
    if (!devTabs.has(label) && !propertyToggle) continue;
    // Match the smallest label/control, never a panel containing the same text.
    if ([...el.children].some(child => normalize(child) === label)) continue;
    const control = el.closest('a, button, [role="tab"], [role="button"]') || el;
    if (!sidebar.contains(control) || normalize(control) !== label) continue;
    if (/^(?:Show|Open) properties$/i.test(label)) {
      if (sidebarPresentation.pending.get(control) !== label) {
        sidebarPresentation.pending.set(control, label);
        control.click();
      }
      // Keep the opener available if this build doesn't expand successfully.
      continue;
    }
    sidebarPresentation.pending.delete(control);
    if (!control.hasAttribute('data-refinement-sidebar-hidden')) {
      control.setAttribute('data-refinement-sidebar-hidden', '');
      sidebarPresentation.hidden.add(control);
    }
  }
}
function startSidebarPresentation() {
  try {
    logseq.provideStyle({ key: 'personal-db-sidebar', style:
      '#right-sidebar [data-refinement-sidebar-hidden] { display: none !important; }' });
    watchDom(updateSidebarPresentation);
    onUnload(() => {
      for (const el of sidebarPresentation.hidden) el.removeAttribute('data-refinement-sidebar-hidden');
      sidebarPresentation.hidden.clear();
    });
  } catch (error) { warnOnce('sidebar presentation is unavailable', error); }
}


const quietUi = { marked: new Set() };
const quietItemNames = () => new Set(setting('quietItems').split(',').map(name => name.trim().toLowerCase()).filter(Boolean));
// Logseq's built-in sidebar items and the search button carry fixed names of their own
// (frontend/components/left_sidebar.cljs and header.cljs), whatever language Logseq is shown in.
// Those are quietened by plain rules on those names; other items are still found by their words.
const QUIET_BUILT_IN = {
  'journals': '#left-sidebar .journals-nav > a.item',
  'flashcards': '#left-sidebar .flashcards-nav > a.item',
  'graph view': '#left-sidebar .graph-view-nav > a.item',
  'all pages': '#left-sidebar .all-pages-nav > a.item',
  'search': '#head button#search-button',
};
function applyQuietItemsStyle() {
  const sels = [...quietItemNames()].map(name => QUIET_BUILT_IN[name]).filter(Boolean);
  sendStyle('personal-db-quiet-items', sels.length ? `:is(${sels.join(', ')}) { font-size: var(--rf-small) !important; color: var(--ls-secondary-text-color) !important; opacity: var(--rf-quiet) !important; }
:is(${sels.join(', ')}) :is(svg, .ui__icon) { transform: scale(.85); }` : '');
}
function updateQuietUi(doc) {
  for (const el of quietUi.marked) if (!el.isConnected) quietUi.marked.delete(el);
  const names = new Set([...quietItemNames()].filter(name => !QUIET_BUILT_IN[name]));
  const clean = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const mark = el => { if (!el.hasAttribute('data-refinement-quiet')) { el.setAttribute('data-refinement-quiet', ''); quietUi.marked.add(el); } };
  // Named sidebar/toolbar items: the item's aria-label or title, its whole text, or the text of one of
  // its own parts (a sidebar item holds its name, a keyboard shortcut and a count as separate parts).
  if (names.size) {
    for (const root of doc.querySelectorAll('#left-sidebar, #head')) {
      for (const el of root.querySelectorAll('a, button, [role="button"]')) {
        if (el.parentElement?.closest('[data-refinement-quiet]')) continue;
        const labels = [el.getAttribute('aria-label'), el.getAttribute('title'), clean(el), ...[...el.children].map(clean)];
        if (labels.some(label => label && names.has(label.toLowerCase()))) mark(el);
      }
    }
  }
}
function startQuietUi() {
  try {
    applyQuietItemsStyle();
    // Only items named by their words need the screen watched.
    if ([...quietItemNames()].some(name => !QUIET_BUILT_IN[name])) watchDom(updateQuietUi);
    onUnload(() => {
      for (const el of quietUi.marked) el.removeAttribute('data-refinement-quiet');
      quietUi.marked.clear();
    });
  } catch (error) { warnOnce('quiet items are unavailable', error); }
}

/* Typing [[ opens Logseq's page menu at once, filled with date words (Today, Tomorrow, Next week ...)
   before anything is typed. While nothing follows the [[ the menu stays hidden, and the keys that would
   pick from it (arrows, Enter, Tab) do nothing; the first letter typed brings it back as usual. */
const quietLinkMenu = { menu: null };
function linkMenuIsEmpty(doc) {
  const box = doc.activeElement;
  if (!box || box.tagName !== 'TEXTAREA' || box.selectionStart !== box.selectionEnd) return false;
  return box.value.slice(Math.max(0, box.selectionStart - 2), box.selectionStart) === '[[';
}
function updateQuietLinkMenu(doc) {
  const menu = setting('quietLinkMenu') ? doc.getElementById('ui__ac') : null;
  const quiet = !!menu && !menu.classList.contains('ac-block-search') && linkMenuIsEmpty(doc);
  if (quietLinkMenu.menu && (quietLinkMenu.menu !== menu || !quiet)) quietLinkMenu.menu.removeAttribute('data-refinement-quiet-menu');
  quietLinkMenu.menu = quiet ? menu : null;
  if (quiet && !menu.hasAttribute('data-refinement-quiet-menu')) menu.setAttribute('data-refinement-quiet-menu', '');
}
function startQuietLinkMenu() {
  try {
    const doc = ensureDomWatch(), win = doc.defaultView;
    watchDomEarly(function updateQuietLinkMenuEarly(d) { updateQuietLinkMenu(d); });
    listen(win, ['input', 'keyup'], () => updateQuietLinkMenu(doc));
    listen(win, ['keydown'], event => {
      if (!quietLinkMenu.menu?.isConnected || !['ArrowUp', 'ArrowDown', 'Enter', 'Tab'].includes(event.key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    });
    logseq.provideStyle({ key: 'personal-db-quiet-link-menu', style: `
#ui__ac[data-refinement-quiet-menu],
[data-radix-popper-content-wrapper]:has(#ui__ac[data-refinement-quiet-menu]),
.ui__popover-content:has(#ui__ac[data-refinement-quiet-menu]) { visibility: hidden !important; }` });
    onUnload(() => { quietLinkMenu.menu?.removeAttribute('data-refinement-quiet-menu'); quietLinkMenu.menu = null; });
  } catch (error) { warnOnce('the quiet [[ menu is unavailable', error); }
}

/* A lone tap of the Hyper key starts a [[ link where you are typing. Hyper is Caps Lock remapped (Karabiner,
   the Hyperkey app) to hold Cmd+Ctrl+Opt (+Shift); a tap sends those keys down and up with nothing between.
   The tap is answered as two typed [ keys, so Logseq pairs them and opens its page menu as usual; selected
   words become the link's text. Setups that also send Escape on a tap would end the editing right after,
   so an Escape that arrives within 0.3 seconds of the tap is swallowed (no hand presses Escape that fast). */
const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift', 'Hyper', 'CapsLock']);
const hyperTap = { armedAt: 0, firedAt: 0 };
function editingBox(doc) {
  const box = doc.activeElement;
  return box?.tagName === 'TEXTAREA' && box.closest('.ls-block, .block-editor') ? box : null;
}
function startLinkFromHyper(doc, box) {
  const win = doc.defaultView, before = box.value;
  const type = () => box.dispatchEvent(new win.KeyboardEvent('keydown', { key: '[', code: 'BracketLeft', keyCode: 219, which: 219, bubbles: true, cancelable: true }));
  type(); type();
  if (box.value !== before || !box.isConnected) return;
  // Logseq ignored the typed brackets: write them, the cursor between.
  const { selectionStart: start, selectionEnd: end } = box;
  const words = before.slice(start, end);
  if (!doc.execCommand('insertText', false, `[[${words}]]`)) { box.setRangeText(`[[${words}]]`, start, end, 'end'); box.dispatchEvent(new win.Event('input', { bubbles: true })); }
  const caret = start + 2 + words.length;
  box.setSelectionRange(caret, caret);
}
function startHyperLinkTap() {
  try {
    const doc = host(), win = doc.defaultView;
    // Both halves of that Escape, so neither Logseq nor the [[ picker sees it and takes the brackets out.
    listen(win, ['keydown', 'keyup'], event => {
      if (event.key !== 'Escape' || Date.now() - hyperTap.firedAt > 300) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    });
    listen(win, ['keydown'], event => {
      if (!event.isTrusted || event.key === 'Escape' && Date.now() - hyperTap.firedAt <= 300) return;
      if (!MODIFIER_KEYS.has(event.key)) { hyperTap.armedAt = 0; return; }
      if (event.metaKey && event.ctrlKey && event.altKey && !hyperTap.armedAt) hyperTap.armedAt = Date.now();
    });
    listen(win, ['keyup'], event => {
      if (!event.isTrusted || !MODIFIER_KEYS.has(event.key) || !hyperTap.armedAt) return;
      const quick = Date.now() - hyperTap.armedAt < 600;
      hyperTap.armedAt = 0;
      const box = quick && setting('hyperLinkTap') && editingBox(doc);
      if (!box) return;
      hyperTap.firedAt = Date.now();
      startLinkFromHyper(doc, box);
    });
    listen(win, ['blur'], () => { hyperTap.armedAt = 0; });
  } catch (error) { warnOnce('the Hyper key tap is unavailable', error); }
}

// The sidebars and the toolbar (read by this part and the links part; the sidebar part's settings follow in the same section). Declared here since 0.4.163; every part reads them through the core's setting().
const settingsSchema = [
  { key: 'appearanceHeading', type: 'heading', group: 'around', rank: 1, title: 'Sidebars and toolbar', default: null,
    legend: 'The left and right sidebars and the toolbar',
    zone: '<div class="m">Favorites</div><div>Echo</div><div class="m">Recent</div><div>Mateo Ruiz</div><div class="m">Oct 14th</div><div class="tb">⌂ ← → ···</div>',
    description: 'Changes here apply after you reload the plugin.' },
  { key: 'quietItems', type: 'string', title: 'Quiet these sidebar and toolbar items', default: 'Flashcards, Graph view',
    description: 'Comma-separated names (as shown, or as in the button tooltip). These stay visible but are smaller and lighter. Applies after you reload the plugin.' },
  { key: 'quietSidebarIcons', type: 'boolean', title: 'Left sidebar icons only where they mean something', default: true,
    preview: ['<div><span class="m">#</span> Project</div><div><span class="pic outline"></span>Mateo Ruiz</div><div class=""><span class="pic outline"></span>Oct 14th</div>', '<div><span class="m">#</span> Project</div><div><span class="m" style="visibility:hidden">#</span> Mateo Ruiz</div><div class="m"><span class="m" style="visibility:hidden">#</span> Oct 14th</div>'],
    description: 'In Favorites and Recent, Logseq’s generic page icon is left out (names stay lined up). A tag’s #, an icon you gave a page and an icon that comes from its tag all stay. Journal days are in grey. Applies right away.' },
  { key: 'tidySidebar', type: 'boolean', title: 'Tidy the right sidebar', default: true,
    preview: ['<div class="m">Page graph · Undo · Redo · Profiler</div><div><i class="b"></i>Echo</div>', '<div class="m">Page graph</div><div><i class="b"></i>Echo</div>'],
    description: 'Expand page properties automatically and hide the Page graph, (Dev) RTC, Undo/Redo and Profiler buttons.' },
];
function start() {
  const core = window.refinementCore;
  // What this part looks for on screen, for "Check what the plugin finds on this page".
  core.provided.addTroubleshooting?.({ checks: [
    ['left sidebar', '#left-sidebar', 'quiet items, plain page icons, page labels'],
    ['toolbar', '#head', 'quiet items'],
  ] });
  ({ setting, watchDom, watchDomEarly, ensureDomWatch, sendStyle } = take(core, ['setting', 'watchDom', 'watchDomEarly', 'ensureDomWatch', 'sendStyle']));
}
function ready() {
  if (setting('tidySidebar')) startSidebarPresentation();
  startQuietUi();
  startQuietLinkMenu();
  startHyperLinkTap();
}
(window.refinementParts ||= []).push({ name: 'chrome', schema: settingsSchema, start, ready, stop: runUnloadTasks });
})();
