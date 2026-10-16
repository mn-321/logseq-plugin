/* Loaded by main.js before the plugin starts. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* Right sidebar part of DB Refinements (0.4.16). Two things, each with its own switch:
   - Clicking the title of a page or block in the right sidebar opens it in the main view. In Logseq
     the whole title bar folds and unfolds the item; the small arrow before the title still does that.
   - A thick line between the sidebar's items, so where one ends and the next begins is plain.
   Logseq 2.0.2 draws each item as div.sidebar-item.item-type-<type>, with a header button
   (id sidebar-panel-header-<n>: the arrow span, then the title div) and the item's content in
   #sidebar-panel-content-<n> (right_sidebar.cljs sidebar-item-inner). A page item's content starts
   is the page; a block item's content starts with the block as .ls-block[blockid]. */
const unloadTasks = [];
const onUnload = task => { if (typeof task === 'function') unloadTasks.push(task); };
function runUnloadTasks() {
  const pending = [];
  for (const task of unloadTasks.splice(0).reverse()) {
    try { pending.push(Promise.resolve(task()).catch(error => warnOnce('clean-up step failed', error))); } catch (error) { warnOnce('clean-up step failed', error); }
  }
  return Promise.all(pending);
}
// The Logseq window. The plugin runs in a frame inside it.
const host = () => window.parent.document;
const warned = new Set();
function warnOnce(message, ...details) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn('Refinements (sidebar): ' + message, ...details);
}
// A copy removed without its clean-up finishing is stopped by the next one.
const STOP_KEY = '__refinementSidebarStop';
function takeOverFromEarlierCopy() {
  let win;
  try { win = host().defaultView; } catch (error) { return; }
  try { win[STOP_KEY]?.(); } catch (error) { warnOnce('an earlier copy could not be stopped', error); }
  win[STOP_KEY] = runUnloadTasks;
  onUnload(() => { if (win[STOP_KEY] === runUnloadTasks) delete win[STOP_KEY]; });
}

const settingsSchema = [
  { key: 'sidebarTitleOpens', type: 'boolean', title: 'Sidebar titles open their page', default: true,
    description: 'Clicking the title of a page or block in the right sidebar opens it in the main view. The small arrow before the title, and the empty part of the title bar, still fold and unfold it. Shift-click and other clicks with a key held work as in Logseq. Off: the whole title bar folds and unfolds, as in Logseq.' },
  { key: 'sidebarThickDividers', type: 'boolean', title: 'Thick line between sidebar items', default: true,
    description: 'A thick line separates the items in the right sidebar, so each page or block stands apart from the next.' },
];
const settingDefaults = Object.fromEntries(settingsSchema.map(item => [item.key, item.default]));
function setting(key) {
  const value = logseq.settings?.[key];
  return typeof value === typeof settingDefaults[key] ? value : settingDefaults[key];
}

// Items that show a page or a block, which can be opened in the main view. Search, Help, Page graph,
// Shortcuts and plugin panels have nothing to open, so their title still folds them.
const OPENABLE = ':is(.item-type-page, .item-type-block, .item-type-block-ref, .item-type-contents)';
const TITLE = `#right-sidebar .sidebar-item${OPENABLE} .sidebar-item-header > button[id^="sidebar-panel-header-"] > div:nth-child(2)`;

const titleCss = `
${TITLE} { cursor: pointer; }
${TITLE}:hover :is(span, a) {
  text-decoration-line: underline;
  text-decoration-color: color-mix(in srgb, currentColor 45%, transparent);
  text-decoration-thickness: 1px;
  text-underline-offset: .2em;
}`;
// The items sit side by side in .sidebar-item-list with drop markers between them, so every item
// after the first is "an item preceded somewhere by another item".
const dividerCss = `
#right-sidebar .sidebar-item-list > .sidebar-item ~ .sidebar-item {
  border-top: 3px solid color-mix(in srgb, var(--ls-primary-text-color, #888) 22%, transparent) !important;
  margin-top: 10px;
  padding-top: 6px;
}`;
function applyStyles() {
  logseq.provideStyle({ key: 'refinement-sidebar-titles', style: setting('sidebarTitleOpens') ? titleCss : '' });
  logseq.provideStyle({ key: 'refinement-sidebar-dividers', style: setting('sidebarThickDividers') ? dividerCss : '' });
}

// The page or block an item shows. A page item names its page in the title (its content also holds
// property values and references, which are blocks of their own); a block item's content starts with the block.
async function itemUuid(item) {
  // A page shown as an item of type "block" (as Shift-click opens it) still has the page title in its header.
  // The title text is the page-title's own span; the span before it, inside the icon box, holds the icon.
  const titled = item.querySelector('.sidebar-item-header .page-title > span');
  if (titled || item.matches('.item-type-contents')) {
    const name = item.matches('.item-type-contents') ? 'Contents' : titled.textContent.trim();
    const page = name ? await logseq.Editor.getPage(name) : null;
    if (page?.uuid) return page.uuid;
  }
  const header = item.querySelector('button[id^="sidebar-panel-header-"]');
  const index = header?.id.slice('sidebar-panel-header-'.length);
  const content = index != null ? item.ownerDocument.getElementById('sidebar-panel-content-' + index) : null;
  return (content || item).querySelector('.ls-block[blockid]')?.getAttribute('blockid') || null;
}

async function openItem(item) {
  const uuid = await itemUuid(item);
  if (!uuid) { warnOnce('could not tell which page a sidebar item shows'); return; }
  logseq.App.pushState('page', { name: uuid });
}

// Runs before Logseq's own click handler on the title bar (which folds the item), and keeps it from running.
function onClick(event) {
  if (!setting('sidebarTitleOpens')) return;
  if (event.button !== 0 || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
  const target = event.target;
  if (!target?.closest) return;
  const title = target.closest(TITLE);
  if (!title) return;
  event.stopPropagation();
  event.preventDefault();
  openItem(title.closest('.sidebar-item')).catch(error => warnOnce('a sidebar item could not be opened', error));
}

function start() {
  takeOverFromEarlierCopy();
  applyStyles();
  const win = host().defaultView;
  win.addEventListener('click', onClick, true);
  onUnload(() => win.removeEventListener('click', onClick, true));
  onUnload(logseq.onSettingsChanged((now, before) => {
    if (settingsSchema.some(item => now?.[item.key] !== before?.[item.key])) applyStyles();
  }));
}
(window.refinementParts ||= []).push({ name: 'sidebar', schema: settingsSchema, start, stop: runUnloadTasks });
})();
