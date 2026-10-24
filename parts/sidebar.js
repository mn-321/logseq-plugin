/* Loaded by main.js after parts/pdf-quote.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* The right sidebar (0.4.16; back on and on the kit at 0.4.336, docs/LAYERS.md layer 4, the first of the resting
   "getting around" pieces, at the owner's word). Two things, each with its own switch:
   - Clicking the title of a page or block in the right sidebar opens it in the main view. In Logseq the whole title
     bar folds and unfolds the item; the small arrow before the title still does that.
   - A line between the sidebar's items, so where one ends and the next begins is plain: the kit's line grey.
   Logseq 2.0.2 draws each item as div.sidebar-item.item-type-<type>, with a header button (id sidebar-panel-header-<n>:
   the arrow span, then the title div) and the item's content in #sidebar-panel-content-<n> (right_sidebar.cljs
   sidebar-item-inner). A page item names its page in the title; a block item's content starts with the block as
   .ls-block[blockid]. Nothing is read from the graph: a page opens by its name, a block by its uuid, through layer 1. */
const shared = window.refinementShared;
const { host, openEntity, openPageNamed } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements (sidebar): ' });
let sendStyle, onSettingsChange;
const take = (core, names) => shared.take(core, names, warnOnce);

const settingsSchema = [
  { key: 'sidebarHeading', type: 'heading', group: 'around', rank: 2, title: 'Right sidebar', default: null, icon: 'sidebar',
    legend: 'Titles in the right sidebar open their page; a line between its items',
    zone: '<div><u>Dr. Mei Chen</u></div><div class="m">────</div><div><u>Consultation</u></div>',
    description: 'Changes here apply right away.' },
  { key: 'sidebarTitleOpens', type: 'boolean', title: 'Sidebar titles open their page', default: true,
    description: 'Clicking the title of a page or block in the right sidebar opens it in the main view. The small arrow before the title, and the empty part of the title bar, still fold and unfold it. Shift-click and other clicks with a key held work as in Logseq. Off: the whole title bar folds and unfolds, as in Logseq.' },
  { key: 'sidebarThickDividers', type: 'boolean', title: 'A line between sidebar items', default: true,
    description: 'A line separates the items in the right sidebar, so each page or block stands apart from the next.' },
];
const setting = shared.settingReader(settingsSchema);

// Items that show a page or a block, which can be opened in the main view. Search, Help, Page graph,
// Shortcuts and plugin panels have nothing to open, so their title still folds them.
const OPENABLE = ':is(.item-type-page, .item-type-block, .item-type-block-ref, .item-type-contents)';
const TITLE = `#right-sidebar .sidebar-item${OPENABLE} .sidebar-item-header > button[id^="sidebar-panel-header-"] > div:nth-child(2)`;

// The title under the pointer reads as a link: the kit's faint underline, as its tags and go buttons wear.
const titleCss = `
${TITLE} { cursor: pointer; }
${TITLE}:hover :is(span, a) { text-decoration: underline; text-decoration-color: var(--rf-line); text-decoration-thickness: 1px; text-underline-offset: .2em; }`;
// The items sit side by side in .sidebar-item-list with drop markers between them, so every item
// after the first is "an item preceded somewhere by another item". The line is the kit's, the one every hairline
// and divider of the plugin is mixed from (no grey of this part's own).
const dividerCss = `
#right-sidebar .sidebar-item-list > .sidebar-item ~ .sidebar-item { border-top: 2px solid var(--rf-line) !important; margin-top: 10px; padding-top: 6px; }`;
function applyStyles() {
  sendStyle('refinement-sidebar-titles', setting('sidebarTitleOpens') ? titleCss : '');
  sendStyle('refinement-sidebar-dividers', setting('sidebarThickDividers') ? dividerCss : '');
}

// What an item shows: a page by its name (its content also holds property values and references, which are blocks of
// their own), a block by its uuid (its content starts with the block).
function openItem(item) {
  // A page shown as an item of type "block" (as Shift-click opens it) still has the page title in its header.
  // The title text is the page-title's own span; the span before it, inside the icon box, holds the icon.
  const titled = item.querySelector('.sidebar-item-header .page-title > span');
  const name = item.matches('.item-type-contents') ? 'Contents' : titled?.textContent.trim();
  if (name) return openPageNamed(name);
  const header = item.querySelector('button[id^="sidebar-panel-header-"]');
  const index = header?.id.slice('sidebar-panel-header-'.length);
  const content = index != null ? item.ownerDocument.getElementById('sidebar-panel-content-' + index) : null;
  const uuid = (content || item).querySelector('.ls-block[blockid]')?.getAttribute('blockid');
  if (uuid) return openEntity(uuid);
  warnOnce('could not tell which page a sidebar item shows');
}

// Runs before Logseq's own click handler on the title bar (which folds the item), and keeps it from running.
function onClick(event) {
  if (!setting('sidebarTitleOpens')) return;
  if (event.button !== 0 || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
  const title = event.target?.closest?.(TITLE);
  if (!title) return;
  event.stopPropagation();
  event.preventDefault();
  Promise.resolve(openItem(title.closest('.sidebar-item'))).catch(error => warnOnce('a sidebar item could not be opened', error));
}

function start() {
  ({ sendStyle, onSettingsChange } = take(window.refinementCore, ['sendStyle', 'onSettingsChange']));
  // What this part looks for on screen, for "Check what the plugin finds on this page".
  window.refinementCore.provided.addTroubleshooting?.({ checks: [['right sidebar', '#right-sidebar', 'sidebar titles and lines']] });
  applyStyles();
  listen(host().defaultView, ['click'], onClick);
  onSettingsChange((now, before) => { if (settingsSchema.some(item => now?.[item.key] !== before?.[item.key])) applyStyles(); });
}
(window.refinementParts ||= []).push({ name: 'sidebar', schema: settingsSchema, start, stop: runUnloadTasks });
})();
