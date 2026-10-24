/* Loaded by main.js after parts/sidebar.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* Logseq's own chrome made quieter (docs/LAYERS.md layer 4, back on the kit 2026-10-23, docs/history/FINISHING-PROMPT-2026-10-23.md section 5,
   Phase 2 piece 2). Four things, each with its own switch:
   - The right sidebar's header without the Page graph and the (Dev) tabs (RTC, Undo/Redo, Profiler): Contents and Help
     stay. Found by their words, since Logseq gives them no names of their own, and hidden, so nothing else moves.
   - Rarely used items of the left sidebar and the toolbar (Flashcards and Graph view unless you name others) in the
     kit's quiet grey and a little smaller; still there and still working.
   - In the left sidebar's Favorites and Recent, Logseq's generic page icon left out, its room kept so the names line
     up; a tag's #, an icon you chose and one that comes from a tag stay.
   - Typing [[ no longer opens Logseq's list of date words at once; the list comes with the first letter typed, and
     while it is held back the keys that would pick from it do nothing.
   Left resting from the old part (decided 2026-10-23, docs/DECISIONS-AUTONOMOUS.md): pressing Logseq's "Show
   properties" in the sidebar on its own (the plugin does not press Logseq's controls for you), journal days in grey in
   the left sidebar (it needed dates read by the resting links part), and the Hyper key tap (a personal keyboard setup
   the plan does not list). Nothing here reads the graph; everything goes through the core's watcher and stylesheets. */
const shared = window.refinementShared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements (chrome): ',
  leaves: { attributes: ['data-refinement-quiet', 'data-refinement-sidebar-hidden', 'data-refinement-quiet-menu'] } });
let sendStyle, watchDom, watchDomEarly, ensureDomWatch, onSettingsChange;
const take = (core, names) => shared.take(core, names, warnOnce);

const settingsSchema = [
  { key: 'appearanceHeading', type: 'heading', group: 'around', rank: 1, title: 'Sidebars and toolbar', default: null, icon: 'sidebar',
    legend: 'The left and right sidebars, the toolbar and the [[ menu, quieter',
    zone: '<div class="m">Favorites</div><div>Echo</div><div class="m">Recent</div><div>Mateo Ruiz</div><div class="tb">⌂ ← → ···</div>',
    description: 'Changes here apply right away.' },
  { key: 'tidySidebar', type: 'boolean', title: 'The right sidebar without its Page graph and (Dev) tabs', default: true,
    description: 'The right sidebar’s header shows Contents and Help; Page graph, (Dev) RTC, (Dev) Undo/Redo and (Dev) Profiler are left out. Off: Logseq shows them all.' },
  { key: 'quietItems', type: 'string', title: 'Quiet these sidebar and toolbar items', default: 'Flashcards, Graph view',
    description: 'Names as shown (or as in the button’s tooltip), with commas between. These stay and still work, a little smaller and in a quieter grey.' },
  { key: 'quietSidebarIcons', type: 'boolean', title: 'Left sidebar icons only where they mean something', default: true,
    description: 'In Favorites and Recent, Logseq’s generic page icon is left out and its room kept, so the names line up. A tag’s #, an icon you gave a page and one that comes from its tag stay.' },
  { key: 'quietLinkMenu', type: 'boolean', title: 'Empty [[ ]] menu until you type', default: true,
    description: 'Typing [[ no longer opens Logseq’s list of date words (Today, Tomorrow, Next week …) at once; the page menu comes with the first letter you type.' },
];
const setting = shared.settingReader(settingsSchema);

/* The right sidebar's header: the tabs and buttons whose words are Page graph or (Dev) …, hidden. Matched by their whole
   words on the smallest control holding them, never a panel that happens to contain the words. */
const HIDDEN_TABS = new Set(['Page graph', 'Page Graph', '(Dev) RTC', '(Dev) Undo/Redo', '(Dev) Profiler']);
const hiddenTabs = new Set();
function updateSidebarTabs(doc) {
  for (const el of hiddenTabs) if (!el.isConnected) hiddenTabs.delete(el);
  const sidebar = setting('tidySidebar') ? doc.querySelector('#right-sidebar') : null;
  const found = new Set();
  if (sidebar) for (const el of sidebar.querySelectorAll('a, button, [role="tab"], [role="button"]')) {
    const words = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (HIDDEN_TABS.has(words) && el.childElementCount <= 3) found.add(el);
  }
  for (const el of hiddenTabs) if (!found.has(el)) { el.removeAttribute('data-refinement-sidebar-hidden'); hiddenTabs.delete(el); }
  for (const el of found) if (!el.hasAttribute('data-refinement-sidebar-hidden')) { el.setAttribute('data-refinement-sidebar-hidden', ''); hiddenTabs.add(el); }
}

/* Quiet items. Logseq's built-in sidebar items and the search button carry fixed names of their own (left_sidebar.cljs,
   header.cljs), whatever language Logseq is shown in: quietened by plain rules on those names. Other items are found
   by their words (an item's aria-label or title, its whole text, or one of its own parts). */
const QUIET_BUILT_IN = {
  'journals': '#left-sidebar .journals-nav > a.item',
  'flashcards': '#left-sidebar .flashcards-nav > a.item',
  'graph view': '#left-sidebar .graph-view-nav > a.item',
  'all pages': '#left-sidebar .all-pages-nav > a.item',
  'search': '#head button#search-button',
};
const quietNames = () => new Set(String(setting('quietItems') || '').split(',').map(name => name.trim().toLowerCase()).filter(Boolean));
const quieted = new Set();
function updateQuietItems(doc) {
  for (const el of quieted) if (!el.isConnected) quieted.delete(el);
  const names = new Set([...quietNames()].filter(name => !QUIET_BUILT_IN[name]));
  const found = new Set();
  const clean = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (names.size) for (const root of doc.querySelectorAll('#left-sidebar, #head')) for (const el of root.querySelectorAll('a, button, [role="button"]')) {
    if (el.parentElement?.closest('[data-refinement-quiet]')) continue;
    const labels = [el.getAttribute('aria-label'), el.getAttribute('title'), clean(el), ...[...el.children].map(clean)];
    if (labels.some(label => label && names.has(label.toLowerCase()))) found.add(el);
  }
  for (const el of quieted) if (!found.has(el)) { el.removeAttribute('data-refinement-quiet'); quieted.delete(el); }
  for (const el of found) if (!el.hasAttribute('data-refinement-quiet')) { el.setAttribute('data-refinement-quiet', ''); quieted.add(el); }
}

/* The empty [[ menu: while nothing follows the [[ just typed, Logseq's list (#ui__ac, not the block search of (( ) is
   held back, and the keys that would pick from it do nothing; the first letter brings it back as usual. */
const linkMenu = { menu: null };
function linkMenuIsEmpty(doc) {
  const box = doc.activeElement;
  if (!box || box.tagName !== 'TEXTAREA' || box.selectionStart !== box.selectionEnd) return false;
  return box.value.slice(Math.max(0, box.selectionStart - 2), box.selectionStart) === '[[';
}
function updateLinkMenu(doc) {
  const menu = setting('quietLinkMenu') ? doc.getElementById('ui__ac') : null;
  const quiet = !!menu && !menu.classList.contains('ac-block-search') && linkMenuIsEmpty(doc);
  if (linkMenu.menu && (linkMenu.menu !== menu || !quiet)) linkMenu.menu.removeAttribute('data-refinement-quiet-menu');
  linkMenu.menu = quiet ? menu : null;
  if (quiet && !menu.hasAttribute('data-refinement-quiet-menu')) menu.setAttribute('data-refinement-quiet-menu', '');
}

function styles() {
  const sels = [...quietNames()].map(name => QUIET_BUILT_IN[name]).filter(Boolean);
  sendStyle('refinement-chrome-sidebar', '#right-sidebar [data-refinement-sidebar-hidden] { display: none !important; }');
  // The kit's quiet grey, and 13 px against Logseq's 14 px items (in the root's units: .9em of the item's parent came out
  // larger, seen in the app); an icon in the item a little smaller too.
  sendStyle('refinement-chrome-quiet', `:is(${[...sels, '[data-refinement-quiet]'].join(', ')}) { font-size: .8125rem !important; color: var(--rf-quiet) !important; }
:is(${[...sels, '[data-refinement-quiet]'].join(', ')}) :is(svg, .ui__icon, .ti) { transform: scale(.85); }`);
  sendStyle('refinement-chrome-icons', setting('quietSidebarIcons') ? '#left-sidebar a.link-item .page-icon .ls-icon-file { visibility: hidden; }' : '');
  sendStyle('refinement-chrome-link-menu', `#ui__ac[data-refinement-quiet-menu],
[data-radix-popper-content-wrapper]:has(#ui__ac[data-refinement-quiet-menu]),
.ui__popover-content:has(#ui__ac[data-refinement-quiet-menu]) { visibility: hidden !important; }`);
}

function start() {
  ({ sendStyle, watchDom, watchDomEarly, ensureDomWatch, onSettingsChange } = take(window.refinementCore, ['sendStyle', 'watchDom', 'watchDomEarly', 'ensureDomWatch', 'onSettingsChange']));
  // What this part looks for on screen, for "Check what the plugin finds on this page".
  window.refinementCore.provided.addTroubleshooting?.({ checks: [
    ['left sidebar', '#left-sidebar', 'quiet items, plain page icons'], ['toolbar', '#head', 'quiet items'], ['right sidebar', '#right-sidebar', 'sidebar tabs left out'],
  ] });
  styles();
  watchDom(function updateChrome(doc) { updateSidebarTabs(doc); updateQuietItems(doc); });
  const doc = ensureDomWatch(), win = doc.defaultView;
  watchDomEarly(function updateLinkMenuEarly(d) { updateLinkMenu(d); });
  listen(win, ['input', 'keyup'], () => updateLinkMenu(doc));
  listen(win, ['keydown'], event => {
    if (!linkMenu.menu?.isConnected || !['ArrowUp', 'ArrowDown', 'Enter', 'Tab'].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  });
  onSettingsChange((now, before) => {
    if (!settingsSchema.some(item => now?.[item.key] !== before?.[item.key])) return;
    styles(); updateSidebarTabs(doc); updateQuietItems(doc); updateLinkMenu(doc);
  });
  onUnload(() => {
    for (const set of [hiddenTabs, quieted]) { for (const el of set) el.removeAttribute(set === hiddenTabs ? 'data-refinement-sidebar-hidden' : 'data-refinement-quiet'); set.clear(); }
    linkMenu.menu?.removeAttribute('data-refinement-quiet-menu'); linkMenu.menu = null;
  });
}
(window.refinementParts ||= []).push({ name: 'chrome', schema: settingsSchema, start, stop: runUnloadTasks });
})();
