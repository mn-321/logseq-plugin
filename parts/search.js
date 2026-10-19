/* Loaded by loader.js before main.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* Search part of DB Refinements (was the Calmer Search plugin 1.0.1): Logseq's own search window, easier to read, with details, grouping, a preview
   panel and typed filters. Split out of DB Refinements 0.2.156, which kept it under "Search". */
// The shared plumbing (parts/shared.js): its header says what each helper does.
const shared = window.refinementShared;
const { host, notify, openEntity, waitFor } = shared;
// This part's own clean-up list and stop key; a new copy sweeps what an earlier one left on screen.
const { warnOnce, onUnload, runUnloadTasks, takeOverFromEarlierCopy } = shared.lifecycle({ prefix: 'Refinements (search): ', stopKey: '__calmerSearchStop', sweep: sweepEarlierCopy });
// The core's screen watcher (window.refinementCore, taken in main()): this part's updaters run on it,
// so the plugin has one MutationObserver (GUIDE.md), and they run before the core's own.
let watchDom, watchDomEarly;

// What an earlier copy may have left on screen (run by takeOverFromEarlierCopy, from shared.js).
function sweepEarlierCopy(doc) {
  for (const el of doc.querySelectorAll(STRAY_ELEMENTS)) el.remove();
  // Search results grouped by page carry an order; read the mark before it is removed.
  for (const el of doc.querySelectorAll('.search-results[data-rf-grouped]')) for (const child of el.children) child.style.order = '';
  for (const name of STRAY_ATTRIBUTES) for (const el of doc.querySelectorAll(`[${name}]`)) el.removeAttribute(name);
}

// The scale (--rf-quiet, --rf-faint, --rf-line-pct, --rf-tiny …) is declared once, in main.js's tokensCss; this part
// used to carry a copy. The key stays, since a provideStyle key is part of the contract with the settings file.
const tokensCss = '/* the tokens are declared in main.js */';
// The plain page outline DB Refinements uses for page icons, so search results match.
const plainPageMask = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="4" y="3" width="8" height="10" rx="1.5" fill="none" stroke="black" stroke-width="1.2"/></svg>');


const titleOf = block => (block?.title || block?.content || '').trim();
// Every trailing tag (#work, #[[Long tag]]).
const trailingTags = /(?:\s+#(?:\[\[[^\]]*\]\]|[^\s#\[\]]+))+\s*$/;

/* Database queries. Datascript with Logseq's own idents (:logseq.class/Tag, :block/title...), as
   the plugin SDK's DB guides do. Lists of ids are written into the query text, so only whole
   numbers and well-formed uuids are let in. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isEntityId = id => Number.isSafeInteger(id) && id > 0;
const idsIn = (variable, ids) => `[(identity [${[...new Set(ids)].filter(isEntityId).join(' ')}]) [${variable} ...]]`;
const uuidsIn = (variable, uuids) => `[(identity [${[...new Set(uuids)].map(String).filter(u => UUID.test(u)).map(u => `#uuid "${u}"`).join(' ')}]) [${variable} ...]]`;
// Rows of a query, or [] when it returns nothing.
const dsQuery = async query => {
  const rows = await logseq.DB.datascriptQuery(query);
  return Array.isArray(rows) ? rows : [];
};

// DB graphs store links as [[uuid]] and block references as ((uuid)).
const storedRef = /(\(\(|\[\[)([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(\)\)|\]\])/gi;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bareIdent = value => String(value ?? '').replace(/^:/, '');
const keyword = ident => ':' + bareIdent(ident);
// Every tag: [id, title].
const allTags = () => dsQuery(`[:find ?t ?title
  :where [?t :block/tags ?cls] [?cls :db/ident :logseq.class/Tag] [?t :block/title ?title]]`);
// The given tags plus every tag that extends them, at any depth.
async function withExtendingTags(tags) {
  const rows = await dsQuery(`[:find ?child ?parent :where [?child :logseq.property.class/extends ?parent]]`);
  for (let grew = true; grew;) {
    grew = false;
    for (const [child, parent] of rows) if (tags.has(parent) && !tags.has(child)) { tags.add(child); grew = true; }
  }
  return tags;
}
// Titles of the pages that texts mention as [[uuid]].
async function mentionedTitles(texts) {
  const mentioned = new Set();
  for (const text of texts) for (const m of String(text).matchAll(/\[\[([0-9a-f-]{36})\]\]/gi)) mentioned.add(m[1].toLowerCase());
  const titles = new Map();
  if (mentioned.size) {
    for (const [uuid, title] of await dsQuery(`[:find ?uuid ?title :where ${uuidsIn('?uuid', mentioned)}
      [?e :block/uuid ?uuid] [?e :block/title ?title]]`)) titles.set(String(uuid).toLowerCase(), String(title));
  }
  return titles;
}
// The values of some properties on some entities: entity id -> ident -> [{ ref, v }], plus what
// the values point at and the titles their text mentions.


// Logseq's own search (popover, and the copy kept in the right sidebar): calmer rows,
// quiet group headings and softer match highlights. Ranking and keys stay native.
const searchCss = `
.cp__cmdk-input-row { background: transparent !important; border-bottom: 1px solid var(--ls-border-color, rgba(128,128,128,.16)) !important; }
.cp__cmdk-search-input { font-size: 1.05rem !important; padding: 12px 16px !important; }
.cp__cmdk-input-row + div { background: var(--ls-primary-background-color) !important; }
.cp__cmdk__block .cp__cmdk-input-row + div { background: transparent !important; min-height: 0 !important; max-height: none !important; }
.cp__cmdk > .hints { background: transparent !important; border-top-color: var(--ls-border-color, rgba(128,128,128,.16)) !important; opacity: var(--rf-quiet); }

/* Groups: no grey bars or dividers; a small, light heading instead. */
.cp__cmdk div:has(> .search-results) { border-bottom: 0 !important; padding-bottom: 6px !important; }
.cp__cmdk div:has(> .search-results) > div:first-child:not(.search-results) {
  height: auto !important; padding: 10px 12px 3px !important; background: transparent !important;
  font-size: var(--rf-tiny) !important; letter-spacing: .05em; text-transform: uppercase; opacity: var(--rf-quiet);
}
.cp__cmdk div:has(> .search-results) > div:first-child:not(.search-results) > .font-bold { font-weight: 500 !important; }

/* Rows: compact, one weight of text, quiet icon and path. */
/* The rows in the popup look (0.4.140): Logseq's own [[ menu's padding and corner, the chosen row and the row under the pointer on the wash. */
.cp__cmdk [data-cmdk-item] { padding: 6px 8px !important; gap: 1px !important; border-radius: 4px !important; }
.cp__cmdk [data-cmdk-item] > .flex.items-start { gap: 8px !important; }
.cp__cmdk [data-cmdk-item] > .flex.items-start > div:first-child {
  width: 16px !important; height: 20px !important; background: none !important; box-shadow: none !important;
  color: inherit !important; opacity: var(--rf-faint);
}
.cp__cmdk [data-cmdk-item] > .text-xs:first-child { padding-left: 24px !important; margin-top: 0 !important; font-size: var(--rf-tiny) !important; opacity: var(--rf-quiet); }
.cp__cmdk [data-cmdk-item] .breadcrumb a { text-decoration: none !important; }
.cp__cmdk [data-cmdk-item] .cp__cmdk-item-main-text { font-weight: 400 !important; line-height: 1.45; color: var(--ls-primary-text-color) !important; }
.cp__cmdk [data-cmdk-item] .cp__cmdk-item-main-text a { text-decoration: none !important; }
.cp__cmdk-current-page-badge { border: 0 !important; padding: 1px 6px !important; font-size: var(--rf-tiny) !important; font-weight: 400 !important; }

/* Matched words: the soft wash used in the preview, in place of Logseq's yellow block. In a loose match
   Logseq marks stray letters; those stay plain, and the closest word gets the wash instead. */
/* The searched words: bold, as the result list shows them (a wash was tried and dropped in 0.4.83). */
.cp__cmdk mark { background: transparent !important; color: inherit !important; font-weight: 600; padding: 0; border-radius: 0; }
.cp__cmdk [data-rf-loose] mark { background: transparent !important; padding: 0; }
::highlight(refinement-search-near) { background-color: color-mix(in srgb, var(--ls-primary-text-color, #888) 24%, transparent); }
/* Typing markup such as [[ ]] and ** stays visible but faded. */
::highlight(refinement-search-markup) { color: var(--lx-gray-08, rgba(128, 128, 128, .55)); }

/* Selected and hovered rows: a faint grey wash, no outline. */
.cp__cmdk [data-cmdk-item][data-highlighted],
.cp__cmdk [data-cmdk-item][data-kb-highlighted],
.cp__cmdk [data-cmdk-item][data-hoverable][data-highlighted]:hover {
  background-color: color-mix(in srgb, var(--ls-primary-text-color, currentColor) var(--rf-wash-pct), transparent) !important; box-shadow: none !important;
}
.cp__cmdk [data-cmdk-item][data-hoverable]:not([data-highlighted]):hover { background-color: color-mix(in srgb, var(--ls-primary-text-color, currentColor) var(--rf-wash-pct), transparent) !important; box-shadow: none !important; }

/* Page results use the plugin's plain page rectangle. */
.cp__cmdk [data-cmdk-item] :is(svg.tabler-icon-file, svg.icon-tabler-file, svg.tabler-icon-file-description, svg.icon-tabler-file-description) {
  background: currentColor !important;
  mask: url("data:image/svg+xml,${plainPageMask}") center / contain no-repeat !important;
  -webkit-mask: url("data:image/svg+xml,${plainPageMask}") center / contain no-repeat !important;
}
.cp__cmdk [data-cmdk-item] :is(svg.tabler-icon-file, svg.icon-tabler-file, svg.tabler-icon-file-description, svg.icon-tabler-file-description) > * { visibility: hidden !important; }
/* A page that has its own icon shows it beside its name, so the plain rectangle (which read as an
   empty checkbox) is left out there; the name stays in line with the other rows. */
.cp__cmdk [data-cmdk-item] > .flex.items-start:has(.cp__cmdk-item-main-text :is(svg, img, .ui__icon)) > div:first-child:has(:is(svg.tabler-icon-file, svg.icon-tabler-file, svg.tabler-icon-file-description, svg.icon-tabler-file-description)) { visibility: hidden !important; }
`;

// Roomier search: a bigger popover with more space around rows and group headings.
// Only the popover (.ls-dialog-cmdk); the copy kept in the right sidebar stays as it is.
const roomySearchCss = `
.ls-dialog-cmdk { max-width: none !important; }
.ls-dialog-cmdk .cp__cmdk__modal { width: min(1180px, 94dvw) !important; max-width: none !important; }
.ls-dialog-cmdk .cp__cmdk-input-row + div { min-height: 76dvh !important; max-height: 76dvh !important; }
.ls-dialog-cmdk .cp__cmdk-search-input { font-size: 1.3rem !important; padding: 18px 22px !important; }

/* Groups: more room above each one, a plain heading in normal capitals. */
.ls-dialog-cmdk .cp__cmdk div:has(> .search-results) { padding-bottom: 12px !important; }
.ls-dialog-cmdk .cp__cmdk div:has(> .search-results) > div:first-child:not(.search-results) {
  height: auto !important; padding: 20px 22px 8px 48px !important; /* in line with the result titles below */
  font-size: .85rem !important; letter-spacing: 0 !important; text-transform: none !important;
}
.ls-dialog-cmdk .cp__cmdk-input-row + div > div:first-child > div:first-child:not(.search-results) { padding-top: 12px !important; }

/* Rows: more padding, larger text, up to three lines of a block. */
.ls-dialog-cmdk .cp__cmdk .search-results { padding: 0 8px !important; }
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] { padding: 9px 14px !important; gap: 3px !important; }
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] > .flex.items-start { gap: 10px !important; }
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] .cp__cmdk-item-main-text { font-size: .97rem !important; line-height: 1.55 !important; -webkit-line-clamp: 3 !important; }
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] > .text-xs:first-child { font-size: .8rem !important; padding-left: 26px !important; }

/* Steady while typing. Logseq redraws the results in a few quick steps; new rows and headings fade in
   instead of snapping. "Show more" shows only under the pointer, and the key hints at the bottom
   (which change with the selected row) are hidden; the keys still work. */
@keyframes rf-search-in { from { opacity: 0; } to { opacity: 1; } }
.ls-dialog-cmdk .cp__cmdk :is([data-cmdk-item], div:has(> .search-results) > div:first-child:not(.search-results)) { animation: rf-search-in 160ms ease-out; }
@media (prefers-reduced-motion: reduce) { .ls-dialog-cmdk .cp__cmdk :is([data-cmdk-item], div:has(> .search-results) > div:first-child) { animation: none; } }
.ls-dialog-cmdk .cp__cmdk div:has(> .search-results) > div:first-child a.select-node { opacity: 0 !important; transition: opacity .15s; }
.ls-dialog-cmdk .cp__cmdk div:has(> .search-results):hover > div:first-child a.select-node { opacity: .7 !important; }
.ls-dialog-cmdk .cp__cmdk > .hints { display: none !important; }
/* The page and parent above a block are shown in full; a long path wraps instead of ending in "…". */
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] > .text-xs:first-child { white-space: normal !important; flex-wrap: wrap !important; overflow: visible !important; row-gap: 2px; }
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] > .text-xs:first-child .breadcrumb { flex-wrap: wrap !important; white-space: normal !important; overflow: visible !important; max-width: none !important; }
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] > .text-xs:first-child :is(.breadcrumb__segment, .breadcrumb__label) {
  max-width: none !important; overflow: visible !important; text-overflow: clip !important; white-space: normal !important;
}
/* Logseq's "···" for skipped levels is drawn as a plain "…" in the line's own tone, right after the page name. */
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] > .text-xs:first-child .breadcrumb > [role="button"] {
  display: inline-flex !important; align-items: center; font-size: 0 !important; opacity: 1 !important; padding: 0 !important; margin-left: 8px !important;
}
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] > .text-xs:first-child .breadcrumb > [role="button"]::after { content: '…'; font-size: .8rem; }
/* After the "…" the bullet sits as far from it as the "…" sits from the page name. */
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] > .text-xs:first-child .breadcrumb > [role="button"] ~ .breadcrumb__segment::before { margin-left: 8px !important; }
/* The page name is firmer than the blocks after it: medium weight, in the normal text colour (still quiet, like the whole line). */
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] > .text-xs:first-child .breadcrumb > .breadcrumb__segment:first-child { font-weight: 500 !important; color: var(--ls-primary-text-color) !important; }
/* The first part names the page; each part after it is a block, so it gets a small bullet instead of "/". */
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] > .text-xs:first-child .breadcrumb > :not(.breadcrumb__segment, [role="button"]) { display: none !important; }
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] > .text-xs:first-child .breadcrumb__segment ~ .breadcrumb__segment::before {
  content: ''; flex: none; display: inline-block; width: 4px; height: 4px; border-radius: 50%;
  margin: 0 7px 0 9px; background: currentColor; opacity: .8;
}
/* Key shortcuts beside results show only on the row under the pointer; they keep their room, so nothing moves. */
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] [data-shortcut-binding] { visibility: hidden !important; }
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item]:hover [data-shortcut-binding] { visibility: visible !important; }
`;

// Opens Logseq's own search and moves it into the right sidebar (search's own Mod+Enter
// action), so results stay listed while you open them. Reuses a search already there.
async function searchInSidebar() {
  let step = 'finding the sidebar';
  try {
    const doc = host(), win = doc.defaultView;
    const sidebarInput = () => doc.querySelector('#right-sidebar .cp__cmdk-search-input');
    const existing = sidebarInput();
    if (existing && existing.offsetParent) { existing.focus(); existing.select(); return; }
    step = 'opening search';
    // Logseq's own search button, pressed as a click would; the command call is the fallback (it opens
    // search too, but Logseq then logs an error about a reply it cannot clone).
    const button = doc.getElementById('search-button') || doc.querySelector('#head button[data-keep-selection]');
    if (button) button.click();
    else Promise.resolve(logseq.App.invokeExternalCommand('logseq.go/search')).catch(() => {});
    const root = await waitFor(() => [...doc.querySelectorAll('.cp__cmdk')].find(el => !el.closest('#right-sidebar')));
    if (!root) { notify('Search did not open. You can also press Mod+Enter inside search to keep it in the sidebar.', 'warning'); return; }
    step = 'moving search to the sidebar';
    // Search's own Mod+Enter action. Sent to the search window first (so no result is opened),
    // then from the search box if that window ignored it.
    const press = target => target.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', metaKey: true, ctrlKey: true, bubbles: true, cancelable: true }));
    press(root);
    let input = await waitFor(sidebarInput, 700);
    const box = root.isConnected && root.querySelector('.cp__cmdk-search-input');
    if (!input && box) { box.focus(); press(box); input = await waitFor(sidebarInput, 700); }
    if (input) input.focus();
    else notify('Search stayed as a popover. Press Mod+Enter inside search to move it to the sidebar.', 'warning');
  } catch (error) {
    warnOnce('sidebar search failed', error);
    notify(`Sidebar search stopped while ${step}: ${error?.message || error}`, 'warning');
  }
}

// A "Search" button at the start of the right sidebar's top row (next to Contents and Help).
function ensureSidebarSearchButton(doc) {
  const row = doc.querySelector('#right-sidebar .cp__right-sidebar-settings');
  if (!row || row.querySelector('[data-refinement-search-button]')) return;
  const wrap = doc.createElement('div');
  wrap.className = 'text-sm';
  wrap.setAttribute('data-refinement-search-button', '');
  const button = doc.createElement('button');
  button.className = 'button cp__right-sidebar-settings-btn';
  button.textContent = 'Search';
  button.addEventListener('click', event => { event.preventDefault(); searchInSidebar(); });
  wrap.append(button);
  row.prepend(wrap);
}
function startSidebarSearchButton() {
  try {
    watchDom(ensureSidebarSearchButton);
    onUnload(() => { for (const el of host().querySelectorAll('[data-refinement-search-button]')) el.remove(); });
  } catch (error) { warnOnce('sidebar search button is unavailable', error); }
}

// Search shows block text as typed, so links and bold come through as [[Page]] and **text**.
// Fade that markup in result text and paths. Uses the browser's highlight ranges, so
// Logseq's own text is never edited. The one exception is a block holding a table: its
// pipes and "| --- |" rule are rewritten (in the search row only) into cells split by " · "
// and rows split by " / ", and those separators are faded too.
const searchMarkup = /\[\[|\]\]|\*\*|__|~~|\^\^|==|`| · | \/ /g;
const tableCell = ' · ', tableRow = ' / ';
function tidyTableText(text, first, last) {
  let out = text
    .replace(/\|(?:[ \t]*:?-{3,}:?[ \t]*\|)+/g, '|')  // the rule under the header row
    .replace(/\|(?:\s*\|)+/g, '\u0000')              // end of one row and start of the next
    .replace(/\s*\|\s*/g, tableCell);
  if (first) out = out.replace(/^\s*(?:\u0000|· )\s*/, '');
  if (last) out = out.replace(/\s*(?:\u0000| ·)\s*$/, '');
  return out.replace(/\s*\u0000\s*/g, tableRow);
}
function tidySearchTables(doc) {
  for (const area of doc.querySelectorAll('.cp__cmdk [data-cmdk-item] .cp__cmdk-item-main-text')) {
    if (!/^\s*\|[^|\n]*\|/.test(area.textContent)) continue;
    const walker = doc.createTreeWalker(area, doc.defaultView.NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
    nodes.forEach((node, i) => {
      if (!node.nodeValue.includes('|')) return;
      const tidy = tidyTableText(node.nodeValue, i === 0, i === nodes.length - 1);
      if (tidy !== node.nodeValue) node.nodeValue = tidy;
    });
  }
}
function cleanSearchResults(doc) {
  const win = doc.defaultView;
  if (!win.CSS?.highlights || !win.Highlight || !doc.querySelector('.cp__cmdk')) return;
  tidySearchTables(doc);
  const ranges = [];
  for (const area of doc.querySelectorAll('[data-cmdk-item] .cp__cmdk-item-main-text, [data-cmdk-item] > .text-xs:first-child')) {
    const walker = doc.createTreeWalker(area, win.NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const match of node.nodeValue.matchAll(searchMarkup)) {
        const range = doc.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        ranges.push(range);
      }
    }
  }
  win.CSS.highlights.set('refinement-search-markup', new win.Highlight(...ranges));
}
function startSearchCleanup() {
  try {
    // Tables are rewritten before the screen is drawn, so their pipes never show.
    watchDomEarly(function searchTablesEarly(doc) { if (doc.querySelector('.cp__cmdk')) tidySearchTables(doc); });
    watchDom(cleanSearchResults);
    onUnload(() => { for (const name of ['refinement-search-markup', 'refinement-search-near']) host().defaultView.CSS?.highlights?.delete(name); });
  } catch (error) { warnOnce('search text cleanup is unavailable', error); }
}

/* Search details, grouping and the preview panel. Logseq's search rows carry no block ids, so the
   plugin asks Logseq's own search (App.search, the same engine with the same options) for the same
   words, and pairs its answers with the rows in order, checking that the words agree. With the ids
   it can add, per row: what the result is (its tags) and when it was last edited; the first line of
   what sits under a result whose own text is only a heading; and, when the searched words are not
   in the text shown, where they were found. Rows of a group are put page by page (the arrow keys
   follow that order), and a panel to the right of the search popover shows the selected result
   with its blocks, each of which can be edited there. */
const searchExtras = {
  results: new Map(),   // query -> { list, done } from App.search
  meta: new Map(),      // uuid -> { tags, updated, page, pageTitle, isPage, children, first, where }
  pending: new Set(),   // uuids being looked up
  byTitle: new Map(),   // page title -> uuid or '' (rows without a path, such as Recently updated)
  doc: null, failed: false,
};
const searchLetters = text => String(text || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');
const searchMarkers = /\$pfts_2lqh>\$|\$<pfts_2lqh\$/g;
const rowMainText = row => row.querySelector('.cp__cmdk-item-main-text');
// What a row says, for telling rows and results apart: its main text and its path.
function rowSignature(row) {
  const main = rowMainText(row), header = row.querySelector(':scope > .text-xs:first-child');
  return searchLetters(main?.textContent) + '|' + searchLetters(header?.textContent);
}
// Rows that can stand for a page or a block: not commands, themes or "Create" rows (told by their
// icon or key hints), not filters (they end in "— Add filter").
const notNodeIcon = /tabler-icon-(command|palette|plus|file-plus|square-plus|circle-plus|new-section|search)\b/;
const searchableRow = row => rowMainText(row) && !row.querySelector('.shui-shortcut-row') &&
  !rowMainText(row).querySelector(':scope > span.text-xs') &&
  ![...row.querySelectorAll(':scope > .flex.items-start > div:first-child svg')].some(svg => notNodeIcon.test(svg.getAttribute('class') || ''));

function searchResultsFor(query) {
  const known = searchExtras.results.get(query);
  if (known) return known.done ? known.list : null;
  const entry = { done: false, list: [] };
  searchExtras.results.set(query, entry);
  if (searchExtras.results.size > 30) searchExtras.results.delete(searchExtras.results.keys().next().value);
  const options = { limit: 100, 'search-limit': 100, 'built-in?': true, 'enable-snippet?': true };
  const blocksOf = found => Array.isArray(found?.blocks) ? found.blocks : Array.isArray(found) ? found : [];
  // The "Current page" group is searched within the open page, in its own order, so its results
  // are asked for the same way and added after the whole-graph ones.
  const onPage = Promise.resolve(logseq.Editor.getCurrentPage())
    .then(page => page?.uuid && !page.page ? logseq.App.search(query, { ...options, page: String(page.uuid) }) : null)
    .catch(() => null);
  Promise.all([Promise.resolve().then(() => logseq.App.search(query, options)), onPage])
    .then(([found, foundOnPage]) => {
      const blocks = [...blocksOf(found), ...blocksOf(foundOnPage)];
      entry.list = blocks.map(block => {
        const strings = Object.values(block || {}).filter(value => typeof value === 'string');
        const uuid = [block?.uuid, block?.['block/uuid'], block?.id, ...strings].map(String).find(value => UUID.test(value));
        const fields = strings.filter(value => !UUID.test(value))
          .map(value => searchLetters(value.replace(searchMarkers, '').replace(storedRef, ' ')));
        return { uuid: uuid?.toLowerCase(), fields, blob: fields.join('|') };
      }).filter(result => result.uuid);
    })
    .catch(error => { warnOnce('search details: Logseq search did not answer', error); })
    .finally(() => { entry.done = true; if (searchExtras.doc) updateSearchExtras(searchExtras.doc); });
  return null;
}
// How well a row's words agree with a search result: 2 the same text, 1 parts of it, 0 no.
function searchAgreement(rowWords, result) {
  if (!rowWords) return 0;
  if (result.fields.includes(rowWords)) return 2;
  if (rowWords.length <= 12) return result.blob.includes(rowWords) ? 1 : 0;
  const size = 10, spots = [0, Math.floor((rowWords.length - size) / 2), rowWords.length - size];
  return spots.some(at => result.blob.includes(rowWords.slice(at, at + size))) ? 1 : 0;
}

// Gives each result row its block or page id (data-rf-uuid), refreshed when Logseq reuses a row.
function pairSearchRows(root) {
  const query = root.querySelector('.cp__cmdk-search-input')?.value?.trim() || '';
  const results = query ? searchResultsFor(query) : [];
  if (results === null) return false;
  for (const list of root.querySelectorAll('.search-results')) {
    let next = 0;
    for (const row of list.querySelectorAll('[data-cmdk-item]')) {
      const signature = rowSignature(row);
      if (row.dataset.rfSig === signature && row.dataset.rfQuery === query) {
        const at = results.findIndex(result => result.uuid === row.dataset.rfUuid);
        if (at >= 0) next = at + 1;
        continue;
      }
      row.dataset.rfSig = signature;
      row.dataset.rfQuery = query;
      delete row.dataset.rfUuid;
      if (!searchableRow(row)) continue;
      // A page's row may add its tags to its name ("Atlas #Project"); the name alone is tried too.
      const shown = rowMainText(row).textContent, words = searchLetters(shown);
      const bare = searchLetters(shown.replace(trailingTags, ''));
      // Results come in the rows' order, so the search goes on from the last match; a group with its
      // own order (Current page) is then looked for from the start.
      const agrees = result => searchAgreement(words, result) || (bare && bare !== words && searchAgreement(bare, result));
      let found = -1;
      for (let i = next; i < results.length && found < 0; i++) if (agrees(results[i])) found = i;
      for (let i = 0; i < Math.min(next, results.length) && found < 0; i++) if (agrees(results[i])) found = i;
      if (found >= 0) { row.dataset.rfUuid = results[found].uuid; next = found + 1; continue; }
      // A row with no path, such as a page under Recently updated: look the page up by its title.
      if (row.querySelector(':scope > .text-xs:first-child')) continue;
      const title = rowMainText(row).textContent.replace(trailingTags, '').trim();
      if (!title || title.length > 200) continue;
      if (searchExtras.byTitle.has(title)) {
        if (searchExtras.byTitle.get(title)) row.dataset.rfUuid = searchExtras.byTitle.get(title);
      } else {
        searchExtras.byTitle.set(title, '');
        Promise.resolve(logseq.Editor.getPage(title)).then(page => {
          if (page?.uuid) searchExtras.byTitle.set(title, String(page.uuid).toLowerCase());
        }).catch(() => {}).finally(() => {
          for (const el of root.querySelectorAll('[data-cmdk-item][data-rf-sig]')) delete el.dataset.rfSig;
          if (searchExtras.doc) updateSearchExtras(searchExtras.doc);
        });
      }
    }
  }
  return true;
}

// Tags, last edit, page, first child and number of children of the given ids, in four queries.
async function loadSearchMeta(uuids) {
  const ids = uuids.filter(uuid => !searchExtras.meta.has(uuid) && !searchExtras.pending.has(uuid));
  if (!ids.length) return;
  ids.forEach(uuid => searchExtras.pending.add(uuid));
  try {
    const where = `${uuidsIn('?u', ids)} [?b :block/uuid ?u]`;
    const [basics, tags, pages, children] = await Promise.all([
      dsQuery(`[:find ?u ?updated ?name :where ${where}
        [(get-else $ ?b :block/updated-at 0) ?updated] [(get-else $ ?b :block/name "") ?name]]`),
      dsQuery(`[:find ?u ?title :where ${where} [?b :block/tags ?t] [?t :block/title ?title]]`),
      dsQuery(`[:find ?u ?pu ?title :where ${where} [?b :block/page ?p] [?p :block/uuid ?pu] [?p :block/title ?title]]`),
      dsQuery(`[:find ?u ?order ?title :where ${where} [?c :block/parent ?b] [?c :block/order ?order] [?c :block/title ?title]]`),
    ]);
    const entry = uuid => {
      const key = String(uuid).toLowerCase();
      if (!searchExtras.meta.has(key)) searchExtras.meta.set(key, { tags: [], updated: 0, isPage: false, children: 0, first: null });
      return searchExtras.meta.get(key);
    };
    ids.forEach(entry);
    for (const [u, updated, name] of basics) Object.assign(entry(u), { updated: Number(updated) || 0, isPage: !!name });
    for (const [u, title] of tags) entry(u).tags.push(String(title));
    for (const [u, pu, title] of pages) Object.assign(entry(u), { page: String(pu).toLowerCase(), pageTitle: String(title) });
    const firsts = new Map();
    for (const [u, order, title] of children) {
      const meta = entry(u);
      meta.children++;
      if (!firsts.has(meta) || String(order) < firsts.get(meta).order) firsts.set(meta, { order: String(order), title: String(title) });
    }
    const names = await mentionedTitles([...firsts.values()].map(first => first.title));
    for (const [meta, first] of firsts) meta.first = plainSearchText(first.title, names);
    if (searchExtras.meta.size > 2000) searchExtras.meta.clear();
  } catch (error) { warnOnce('search details: could not look up results', error); }
  finally {
    ids.forEach(uuid => searchExtras.pending.delete(uuid));
    if (searchExtras.doc) updateSearchExtras(searchExtras.doc);
  }
}
// Stored text as words: links by name, without markup.
const plainSearchText = (text, names) => String(text || '')
  .replace(storedRef, (match, open, uuid) => names.get(uuid.toLowerCase()) || '…')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*|__|~~|\^\^|==|`/g, '').replace(/\s*\n\s*/g, ' ').trim();

// Why Logseq may have listed a block that holds none of the searched words: a word in it that
// shares a run of letters with a searched word ("testing" for "meeting"), or the searched word's
// letters spread through the text in order.
function nearMatchReason(terms, text, near = []) {
  const words = [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])];
  const common = (a, b) => {
    let best = '';
    for (let i = 0; i < a.length; i++) for (let j = i + best.length + 1; j <= a.length; j++) {
      if (b.includes(a.slice(i, j))) best = a.slice(i, j); else break;
    }
    return best;
  };
  const reasons = terms.map(term => {
    let pick = null;
    for (const word of words) {
      const part = common(term, word);
      if (part.length >= 3 && (!pick || part.length > pick.part.length)) pick = { word, part };
    }
    if (pick) { near.push(pick.word); return `closest word “${pick.word}” shares “${pick.part}”`; }
    const spread = [];
    let at = 0;
    for (const letter of term) {
      const found = text.toLowerCase().indexOf(letter, at);
      if (found < 0) return `no word close to “${term}”`;
      const word = text.slice(text.lastIndexOf(' ', found) + 1).split(/\s/)[0];
      if (spread[spread.length - 1] !== word) spread.push(word);
      at = found + 1;
    }
    return `the letters of “${term}” are spread across ${spread.length > 3 ? `${spread[0]} … ${spread[spread.length - 1]}` : spread.join(', ')}`;
  });
  return `Loose match: ${reasons.map((reason, i) => terms.length > 1 ? `${terms[i]}, ${reason}` : reason).join('; ')}`;
}
// The searched words, lower case, without quotes; one letter alone is left out.
const searchTerms = query => String(query || '').toLowerCase().split(/\s+/).map(term => term.replace(/^"|"$/g, '')).filter(term => term.length > 1);
// When searched words are not in the text shown: where in the block they are. Logseq also lists
// near matches, which hold none of them; those are said to be near matches. Kept per set of words.
async function whereSearchMatched(uuid, terms) {
  const meta = searchExtras.meta.get(uuid), key = terms.join(' ');
  if (!meta || meta.whereFor === key) return;
  meta.whereFor = key;
  meta.where = '';
  meta.near = [];
  const hit = text => terms.some(term => String(text || '').toLowerCase().includes(term));
  const say = text => { if (meta.whereFor === key) meta.where = text; };
  try {
    const tag = meta.tags.find(hit);
    if (tag) { say(`Found in its tag ${tag}`); return; }
    // Logseq gives Logseq's own attributes (:block/…, :db/…) by their bare name ("title", "refs"),
    // and keeps the full name, with its slash, for properties.
    const rows = await dsQuery(`[:find ?a ?v :where [?b :block/uuid #uuid "${uuid}"] [?b ?a ?v]]`);
    const internal = ident => !ident.includes('/') || /^(block|db)\//.test(ident);
    const isText = ident => ident === 'title' || ident === 'block/title';
    const refs = rows.filter(([a, v]) => Number.isSafeInteger(v) && !internal(bareIdent(a)) && !/^logseq\.property\.embedding\//.test(bareIdent(a)));
    const titles = new Map(refs.length ? await dsQuery(`[:find ?e ?t :where ${idsIn('?e', refs.map(([, v]) => v))} [?e :block/title ?t]]`) : []);
    for (const [a, v] of rows) {
      const ident = bareIdent(a);
      if (internal(ident) && !isText(ident)) continue;
      const value = typeof v === 'string' ? v : titles.get(v);
      if (!hit(value)) continue;
      if (isText(ident)) { say('Found further into the text'); return; }
      const [name] = (await dsQuery(`[:find ?t :where [?p :db/ident ${keyword(ident)}] [?p :block/title ?t]]`))[0] || [ident.split('/').pop()];
      say(`Found in ${name}: ${String(value).replace(storedRef, '…').slice(0, 80)}`);
      return;
    }
    const [[title] = []] = await dsQuery(`[:find ?t :where [?b :block/uuid #uuid "${uuid}"] [?b :block/title ?t]]`);
    const near = [];
    say(nearMatchReason(terms, String(title || '').replace(storedRef, ' '), near));
    if (meta.whereFor === key) meta.near = near;
  } catch (error) { warnOnce('search details: could not tell where a result matched', error); }
  finally { if (searchExtras.doc) updateSearchExtras(searchExtras.doc); }
}

function editedLabel(ms) {
  if (!ms) return '';
  const day = value => { const d = new Date(value); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((day(Date.now()) - day(ms)) / 864e5);
  if (days <= 0) return 'edited today';
  if (days === 1) return 'edited yesterday';
  if (days < 7) return `edited ${days} days ago`;
  const date = new Date(ms), sameYear = date.getFullYear() === new Date().getFullYear();
  return 'edited ' + date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}
// What a result is, in a few words: its tags (or Page / Journal for a page without others).
function kindLabel(meta) {
  const tags = meta.tags.filter(tag => !(meta.isPage && tag === 'Page'));
  return (tags.length ? tags : meta.isPage ? ['Page'] : []).slice(0, 3).join(' · ');
}
function setExtra(parent, className, text, before = null) {
  let el = parent.querySelector(`:scope > .${className}`);
  if (!text) { el?.remove(); return; }
  if (!el) { el = parent.ownerDocument.createElement('div'); el.className = className; parent.insertBefore(el, before); }
  if (el.textContent !== text) el.textContent = text;
}

// Rows of one group put page by page: a page first, then its blocks, in the order each first appears.
function groupSearchRows(list) {
  const wrappers = [...list.children];
  const keyOf = wrapper => {
    const uuid = wrapper.querySelector('[data-cmdk-item]')?.dataset.rfUuid;
    const meta = uuid && searchExtras.meta.get(uuid);
    return meta ? (meta.isPage ? uuid : meta.page || uuid) : wrapper;
  };
  const groups = new Map();
  wrappers.forEach(wrapper => { const key = keyOf(wrapper); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(wrapper); });
  let position = 0, moved = false;
  for (const members of groups.values()) {
    members.forEach((wrapper, i) => {
      const order = String(position++);
      if (wrapper.style.order !== order) wrapper.style.order = order;
      if (Number(order) !== wrappers.indexOf(wrapper)) moved = true;
      const row = wrapper.querySelector('[data-cmdk-item]');
      if (row) row.toggleAttribute('data-rf-same-page', i > 0);
      if (row) row.toggleAttribute('data-rf-group-end', i === members.length - 1 && members.length > 1);
    });
  }
  list.toggleAttribute('data-rf-grouped', true);
  list.toggleAttribute('data-rf-moved', moved);
}
// The rows of a search window in the order they are shown.
function shownSearchRows(root) {
  const rows = [];
  for (const list of root.querySelectorAll('.search-results')) {
    const wrappers = [...list.children];
    if (list.hasAttribute('data-rf-grouped')) wrappers.sort((a, b) => (Number(a.style.order) || 0) - (Number(b.style.order) || 0));
    for (const wrapper of wrappers) { const row = wrapper.querySelector('[data-cmdk-item]'); if (row) rows.push(row); }
  }
  return rows;
}
// Up and Down follow the rows as shown. Logseq moves through its own order, so where the two
// differ the key is taken here and the row is selected the way pointing at it would.
function searchArrowKeys(event) {
  if (event.defaultPrevented || event.metaKey || event.altKey || event.isComposing) return;
  const down = event.key === 'ArrowDown' || (event.ctrlKey && event.key === 'n');
  const up = event.key === 'ArrowUp' || (event.ctrlKey && event.key === 'p');
  if (!down && !up) return;
  const root = event.target?.closest?.('.cp__cmdk');
  if (!root || root.hasAttribute('data-rf-filtering') || !root.querySelector('.search-results[data-rf-moved]')) return;
  const shown = shownSearchRows(root), logseqOrder = [...root.querySelectorAll('[data-cmdk-item]')];
  const current = root.querySelector('[data-cmdk-item][data-highlighted]') || logseqOrder[0];
  const at = shown.indexOf(current);
  if (at < 0) return;
  const target = shown[at + (down ? 1 : -1)];
  const logseqTarget = logseqOrder[logseqOrder.indexOf(current) + (down ? 1 : -1)];
  if (!target || target === logseqTarget) return;
  event.preventDefault();
  event.stopPropagation();
  const win = root.ownerDocument.defaultView;
  target.dispatchEvent(new win.MouseEvent('mousemove', { bubbles: true, movementX: 1, movementY: 1 }));
  const scroller = root.querySelector('.cp__cmdk-input-row + div');
  if (scroller) {
    const box = scroller.getBoundingClientRect(), r = target.getBoundingClientRect();
    if (r.top < box.top + 40) scroller.scrollTop -= box.top + 40 - r.top;
    else if (r.bottom > box.bottom - 40) scroller.scrollTop += r.bottom - box.bottom + 40;
  }
}

function updateSearchExtras(doc) {
  searchExtras.doc = doc;
  const roots = doc.querySelectorAll('.cp__cmdk');
  if (!roots.length) { searchPreview.uuid = searchPreview.key = null; updateSearchFilters(doc); return; }
  if (typeof logseq.App.search !== 'function' && !searchExtras.failed) {
    searchExtras.failed = true;
    warnOnce('search details: this Logseq has no search for plugins');
  }
  updateSearchFilters(doc);
  for (const root of roots) {
    if (root.hasAttribute('data-rf-filtering')) { refreshFilterLabels(root); continue; }
    if (!pairSearchRows(root)) continue;
    const rows = [...root.querySelectorAll('[data-cmdk-item][data-rf-uuid]')];
    nearRanges.length = 0;
    loadSearchMeta(rows.map(row => row.dataset.rfUuid));
    const query = root.querySelector('.cp__cmdk-search-input')?.value?.trim() || '';
    for (const row of root.querySelectorAll('[data-cmdk-item]')) {
      const meta = row.dataset.rfUuid && searchExtras.meta.get(row.dataset.rfUuid);
      const mainRow = row.querySelector(':scope > .flex.items-start'), column = rowMainText(row)?.parentElement;
      if (!mainRow || !column) continue;
      if (!meta || !setting('searchDetails')) {
        for (const el of row.querySelectorAll('.rf-search-meta, .rf-search-peek, .rf-search-where')) el.remove();
        continue;
      }
      setExtra(mainRow, 'rf-search-meta', [kindLabel(meta), editedLabel(meta.updated)].filter(Boolean).join(' · '));
      // Under a heading-like result: the first line beneath it.
      const own = searchLetters(rowMainText(row).textContent);
      const peek = meta.first && meta.children && (meta.isPage || own.length <= 40)
        ? meta.first.slice(0, 160) + (meta.children > 1 ? `  · ${meta.children - 1} more` : '') : '';
      setExtra(column, 'rf-search-peek', peek);
      // Searched words (of three letters or more) that are not in the text shown: say where they
      // were found. Told by the text, not by Logseq's bold, which also marks letters of a near match.
      const marked = rowMainText(row).querySelector('mark');
      const shown = rowMainText(row).textContent.toLowerCase();
      const absent = meta.isPage ? [] : searchTerms(query).filter(term => term.length > 2 && !shown.includes(term));
      if (absent.length) whereSearchMatched(row.dataset.rfUuid, absent);
      const answered = absent.length && meta.whereFor === absent.join(' ');
      setExtra(column, 'rf-search-where', answered ? meta.where || '' : '');
      // A loose match: Logseq's marks on stray letters are left plain, and the closest word is marked.
      const loose = !!(answered && meta.where?.startsWith('Loose match'));
      row.toggleAttribute('data-rf-loose', loose);
      if (loose && meta.near?.length) nearRanges.push(...wordRanges(rowMainText(row), meta.near));
      if (marked && !loose) revealSearchMatch(row);
    }
    const win = doc.defaultView;
    if (win.CSS?.highlights && win.Highlight) win.CSS.highlights.set('refinement-search-near', new win.Highlight(...nearRanges));
    if (setting('groupSearch')) for (const list of root.querySelectorAll('.search-results')) groupSearchRows(list);
  }
  if (setting('searchPreview')) updateSearchPreview(doc);
}
// The closest words of loose matches, drawn with the CSS highlight API so Logseq's own text is untouched.
const nearRanges = [];
// The first place each word appears in an element's text, as a whole word.
function wordRanges(main, words) {
  const ranges = [];
  if (!main) return ranges;
  const doc = main.ownerDocument;
  for (const word of words) {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![\\p{L}\\p{N}])`, 'iu');
    const walker = doc.createTreeWalker(main, doc.defaultView.NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const found = pattern.exec(node.nodeValue);
      if (!found) continue;
      const range = doc.createRange(), start = found.index + found[1].length;
      range.setStart(node, start);
      range.setEnd(node, start + found[2].length);
      ranges.push(range);
      break;
    }
  }
  return ranges;
}
// A long block whose matched words fall below the lines shown: start the text a little before them.
function revealSearchMatch(row) {
  const main = rowMainText(row), mark = main.querySelector('mark');
  if (main.scrollHeight <= main.clientHeight + 2) return;
  if (mark.getBoundingClientRect().bottom <= main.getBoundingClientRect().bottom) return;
  const doc = main.ownerDocument, walker = doc.createTreeWalker(main, doc.defaultView.NodeFilter.SHOW_TEXT);
  const before = [];
  for (let node = walker.nextNode(); node && !mark.contains(node); node = walker.nextNode()) before.push(node);
  let keep = 60;
  for (let i = before.length - 1; i >= 0; i--) {
    const node = before[i], text = node.nodeValue;
    if (keep <= 0) { if (text) node.nodeValue = ''; continue; }
    if (text.length > keep) { node.nodeValue = '… ' + text.slice(text.length - keep).replace(/^\S*\s/, ''); keep = 0; }
    else keep -= text.length;
  }
}

/* The preview panel: the selected result, its tags and last edit, and its blocks (up to 80, four
   levels down). Each line shows its text with links by name; click it to edit. A change is saved a
   moment after you stop typing, and when you leave the line. Links keep pointing at the same page:
   the names shown are turned back into the ids the block stores. */
const searchPreview = { uuid: null, key: null, generation: 0, timer: 0, watcher: null };
/* Trial: Logseq's own page editor in the preview, from the plugin kit (logseq.Experiments.Components.Editor,
   which is logseq.sdk.experiments.cp_page_editor in Logseq); given a block's id it shows that block zoomed in.
   The editor only works inside Logseq's own drawing, where Logseq's app state is within reach: drawn in a
   separate React root it fails ("Subscription does not exist in registry"). So a small piece that Logseq
   always draws (a daemon renderer, also from the plugin kit) puts the editor into the panel from there
   (a React portal), which keeps it inside Logseq's drawing. */
const previewHost = { target: null, show: null, registered: false, count: 0 };
function nativePreviewEditor(doc) {
  const win = doc.defaultView;
  const editor = win.logseq?.sdk?.experiments?.cp_page_editor;
  return setting('searchPreviewEditor') && editor && win.React?.createElement && win.ReactDOM?.createPortal ? editor : null;
}
// Catches an error inside Logseq's editor and shows it as a short note, instead of an empty panel.
function previewBoundary(React) {
  if (previewBoundary.type?.React === React) return previewBoundary.type;
  class Boundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error) { warnOnce('Logseq\'s editor could not be shown in the preview', error); }
    render() {
      const error = this.state.error;
      return error ? React.createElement('div', { className: 'rf-pv-empty rf-pv-native-error' },
        `Logseq's editor could not be shown here (${error?.message || error}).`) : this.props.children;
    }
  }
  Boundary.React = React;
  return previewBoundary.type = Boundary;
}
function setPreviewTarget(target) {
  previewHost.target = target;
  previewHost.show?.(target);
}
function registerPreviewHost() {
  const win = window.parent, React = win.React;
  if (previewHost.registered || !React?.useState || !win.ReactDOM?.createPortal || !logseq.Experiments?.registerDaemonRenderer) return;
  function PreviewEditorHost() {
    const [target, setTarget] = React.useState(previewHost.target);
    React.useEffect(() => {
      previewHost.show = setTarget;
      setTarget(previewHost.target);
      return () => { if (previewHost.show === setTarget) previewHost.show = null; };
    }, []);
    // The editor is made once per result: each call takes a new place id ("container") in Logseq, and a
    // block being edited only shows its text box in the place where editing began.
    const page = React.useMemo(() => {
      const editor = win.logseq?.sdk?.experiments?.cp_page_editor;
      return editor && target ? editor({ page: target.uuid }) : null;
    }, [target?.key]);
    if (!page || !target?.box?.isConnected) return null;
    return win.ReactDOM.createPortal(React.createElement(previewBoundary(React), { key: target.key }, page), target.box);
  }
  try {
    const off = logseq.Experiments.registerDaemonRenderer('rf-preview-editor', { render: () => React.createElement(PreviewEditorHost) });
    previewHost.registered = true;
    onUnload(() => { setPreviewTarget(null); previewHost.registered = false; if (typeof off === 'function') off(); });
  } catch (error) { warnOnce('the preview editor could not be set up', error); }
}
function unmountPreviewEditor() {
  if (previewHost.target) setPreviewTarget(null);
}
function mountPreviewEditor(pane, uuid) {
  const box = pane.querySelector('.rf-pv-native'), win = pane.ownerDocument.defaultView;
  if (!nativePreviewEditor(pane.ownerDocument) || !box) return false;
  registerPreviewHost();
  if (!previewHost.registered) return false;
  setPreviewTarget({ box, uuid, key: ++previewHost.count });
  // The simple lines stay until Logseq's editor has drawn something, so an editor that fails or
  // draws nothing leaves them in place.
  const observer = new win.MutationObserver(() => {
    if (!box.isConnected) return observer.disconnect();
    if (!box.textContent.trim()) return;
    observer.disconnect();
    if (box.querySelector('.rf-pv-native-error')) return;
    // Logseq's page brings its own title, properties and lines.
    pane.querySelectorAll(':scope > :is(.rf-pv-body, .rf-pv-title, .rf-pv-props)').forEach(el => el.remove());
  });
  observer.observe(box, { childList: true, subtree: true, characterData: true });
  return true;
}
function previewPane(doc) {
  const modal = doc.querySelector('.ls-dialog-cmdk .cp__cmdk__modal');
  if (!modal?.parentElement) return null;
  let pane = modal.parentElement.querySelector(':scope > .rf-search-preview');
  if (!pane) {
    pane = doc.createElement('div');
    pane.className = 'rf-search-preview';
    pane.innerHTML = '<div class="rf-pv-empty">Select a result to see it here.</div>';
    modal.parentElement.setAttribute('data-rf-with-preview', '');
    modal.after(pane);
    pane.addEventListener('click', previewClick);
    // Keys typed in the panel stay out of the search window; in Logseq's own editor (trial) they must
    // reach Logseq, which handles Enter, Tab and the rest through its shortcuts.
    pane.addEventListener('keydown', event => { if (!event.target.closest?.('.rf-pv-native')) event.stopPropagation(); });
    // A slim bar along the bottom of the window names the search codes. Clicking one puts it in the
    // box (its suggestions then open); “? More tips” shows the full guide in the panel.
    const guide = doc.createElement('div');
    guide.className = 'rf-search-guide';
    guide.innerHTML = [['#', '<b>#</b>tag'], ['in:', '<b>in:</b>page'], ['p:', '<b>p:</b>property=value'],
      ['is:', '<b>is:</b>task · todo · done · page · journal · block'], ['edited:', '<b>edited:</b>today · week · 3d']]
      .map(([code, label]) => `<span data-rf-insert="${code}" title="Add ${code} to the search">${label}</span>`).join('')
      + '<span class="rf-sg-quiet">Names with spaces in [[ ]]</span>'
      + '<span class="rf-sg-keys" title="Opens the selected result in the right sidebar instead of the main edit"><b>⇧ Enter</b> or <b>⇧ click</b> opens in sidebar</span>'
      + '<span class="rf-sg-more" data-rf-tips title="Show the full guide">? More tips</span>';
    guide.addEventListener('mousedown', event => event.preventDefault()); // keeps the cursor in the box
    guide.addEventListener('click', event => {
      if (event.target.closest('[data-rf-tips]')) { showSearchTips(pane); return; }
      const code = event.target.closest('[data-rf-insert]')?.dataset.rfInsert;
      const input = modal.querySelector('.cp__cmdk-search-input');
      if (!code || !input) return;
      const win = doc.defaultView, value = input.value.replace(/\s+$/, '');
      Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, (value ? value + ' ' : '') + code);
      input.dispatchEvent(new win.Event('input', { bubbles: true }));
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
    pane.after(guide);
    searchPreview.uuid = searchPreview.key = null;
    // Moving the selection only changes an attribute, which the plugin's screen watcher leaves
    // alone; this watcher follows it while the panel is open.
    searchPreview.watcher?.disconnect();
    const watcher = searchPreview.watcher = new doc.defaultView.MutationObserver(() => {
      if (!pane.isConnected) { watcher.disconnect(); unmountPreviewEditor(); return; }
      updateSearchPreview(doc);
    });
    watcher.observe(modal, { subtree: true, attributes: true, attributeFilter: ['data-highlighted'] });
  }
  return pane;
}
function updateSearchPreview(doc) {
  const pane = previewPane(doc);
  if (!pane) return;
  const root = pane.parentElement.querySelector('.cp__cmdk');
  const row = root?.hasAttribute('data-rf-filtering') ? root.querySelector('.rf-fr-row[data-rf-current]')
    : root?.querySelector('[data-cmdk-item][data-highlighted]') || root?.querySelector('[data-cmdk-item][data-rf-uuid]');
  // A lone ? in the box shows the guide to the search codes.
  if (root?.querySelector('.cp__cmdk-search-input')?.value.trim() === '?') {
    if (searchPreview.key !== 'tips') { searchPreview.key = 'tips'; searchPreview.uuid = null; showSearchTips(pane); }
    return;
  }
  const uuid = row?.dataset.rfUuid || null;
  // Shown again once the result's details are in (they say whether it is a page).
  const key = uuid && uuid + (searchExtras.meta.has(uuid) ? '' : '?') + '|' + previewWords(pane, uuid).join(' ');
  if (key === searchPreview.key || pane.querySelector('textarea')) return;
  searchPreview.uuid = uuid;
  searchPreview.key = key;
  clearTimeout(searchPreview.timer);
  const generation = ++searchPreview.generation;
  searchPreview.timer = setTimeout(() => fillPreview(pane, uuid, generation), 120);
}
// The guide to the search codes, shown in the panel until another result is selected. Each example
// can be clicked to put it in the search box.
const searchTipRows = [
  ['#tag', 'tagged with it, or with a tag that extends it', '#Project'],
  ['in:page', 'blocks on that page', 'in:Atlas'],
  ['p:name', 'has that property (property: works too)', 'p:status'],
  ['p:name=word', 'a value of that property holds the word', 'p:status=doing'],
  ['is:task, todo, done', 'tasks; tasks not done; finished tasks', 'is:todo'],
  ['is:page, journal, block', 'only pages, journal days or blocks', 'is:journal'],
  ['edited:today, week, month', 'changed since then (also yesterday, year)', 'edited:week'],
  ['edited:3d, 2w', 'changed in the last 3 days, 2 weeks', 'edited:3d'],
];
function showSearchTips(pane) {
  clearTimeout(searchPreview.timer);
  searchPreview.generation++;
  pane.innerHTML = `
    <div class="rf-pv-title">Search tips</div>
    <p class="rf-tips-lead">Type words to find the pages and blocks that hold them. Add codes to narrow the results; codes and words can be used together.</p>
    <div class="rf-tips">${searchTipRows.map(([code, what, example]) => `<code>${escapeHtml(code)}</code><span>${escapeHtml(what)}</span><button data-rf-try="${escapeHtml(example)}" title="Search for this">${escapeHtml(example)}</button>`).join('')}</div>
    <ul class="rf-tips-notes">
      <li>Names with spaces go in [[ ]] or quotes: <code>in:[[Team Handbook]]</code></li>
      <li>With a code, every other word must be in the text: <code>in:Atlas sync</code> finds blocks on Atlas that say “sync”.</li>
      <li>While you type a code, a list suggests names; ↑ ↓ to choose, Tab or Enter to use one.</li>
      <li>Shift+Enter, or Shift-click, opens the selected result in the right sidebar instead of the main edit.</li>
      <li>Type <code>?</code> in the box, or click “? More tips” at the bottom, to see these tips again.</li>
    </ul>`;
  pane.scrollTop = 0;
}
// The words being searched for, to mark in the panel: the plain words of the box (codes left out).
function previewWords(pane, uuid) {
  const root = pane.parentElement?.querySelector('.cp__cmdk');
  if (root?.hasAttribute('data-rf-filtering')) return searchFilter.words.filter(word => word.length > 1);
  // For a loose match, its closest words are marked too.
  return [...searchTerms(root?.querySelector('.cp__cmdk-search-input')?.value), ...(searchExtras.meta.get(uuid)?.near || [])];
}
// The properties set on a page or block, as [name, values] pairs, the owner's own properties first;
// hidden and internal ones (and tags, which the line above already names) are left out.
async function previewProperties(uuid) {
  const rows = await dsQuery(`[:find ?a ?name ?v :where [?b :block/uuid #uuid "${uuid}"] [?b ?a ?v] [?p :db/ident ?a]
    [?p :block/tags ?c] [?c :db/ident :logseq.class/Property] [?p :block/title ?name]
    (not [?p :logseq.property/hide? true]) (not [?p :logseq.property/public? false])]`);
  const kept = rows.filter(([a]) => !/^(block|db)\/|(^|\/)tags$/.test(bareIdent(a)));
  const texts = await valueTexts(kept.map(([, , v]) => v));
  const byName = new Map();
  for (const [a, name, v] of kept) {
    const text = v === true ? 'Yes' : v === false ? 'No' : texts.get(v);
    if (!text) continue;
    const entry = byName.get(name) || byName.set(name, { user: bareIdent(a).startsWith('user.'), values: [] }).get(name);
    if (!entry.values.includes(text)) entry.values.push(text);
  }
  return [...byName].sort(([a, x], [b, y]) => Number(y.user) - Number(x.user) || a.localeCompare(b))
    .map(([name, { values }]) => [name, values.join(', ')]);
}
// The page and the blocks above a block, outermost first, as the result row names them.
async function previewPath(uuid) {
  const path = [];
  if (!UUID.test(uuid)) return path;
  let from = `[?b :block/uuid #uuid "${uuid}"]`;
  for (let level = 0; level < 12; level++) {
    const [above] = await dsQuery(`[:find ?p ?title ?name :where ${from} [?b :block/parent ?p] [?p :block/title ?title]
      [(get-else $ ?p :block/name "") ?name]]`);
    if (!above || !isEntityId(above[0])) break;
    path.unshift(String(above[1]));
    if (above[2]) break;
    from = `[(identity ${above[0]}) ?b]`;
  }
  const names = await mentionedTitles(path);
  return path.map(title => plainSearchText(title, names).replace(/\[\[([^\]]+)\]\]/g, '$1')).filter(Boolean);
}
// Block text as simple HTML: links by name, bold, code, tags, and a table as a table.
function previewHtml(text, names) {
  const lines = String(text || '').split('\n');
  if (lines.length > 1 && lines.every(line => /^\s*\|.*\|\s*$/.test(line))) {
    const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => `<td>${previewInline(cell.trim(), names)}</td>`).join('');
    return '<table>' + lines.filter(line => !/^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line)).map(line => `<tr>${cells(line)}</tr>`).join('') + '</table>';
  }
  return lines.map(line => previewInline(line, names)).join('<br>');
}
function previewInline(text, names) {
  return escapeHtml(text)
    .replace(/\[\[([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\]\]/gi, (m, uuid) => `<span class="rf-pv-ref">${escapeHtml(names.get(uuid.toLowerCase()) || '…')}</span>`)
    .replace(/\(\(([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\)\)/gi, (m, uuid) => `<span class="rf-pv-bref">${escapeHtml(names.get(uuid.toLowerCase()) || '…')}</span>`)
    .replace(/\[\[([^\]]+)\]\]/g, '<span class="rf-pv-ref">$1</span>')
    .replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '<span class="rf-pv-ref">$1</span>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/(^|\s)#([^\s#<]+)/g, '$1<span class="rf-pv-tag">#$2</span>');
}
// Stored text for editing: [[id]] shown as [[Name]], and the names that can be turned back.
function editableText(text, names) {
  const back = new Map();
  const shown = String(text || '').replace(/\[\[([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\]\]/gi, (m, uuid) => {
    const name = names.get(uuid.toLowerCase());
    if (!name || /[\[\]]/.test(name) || (back.has(name) && back.get(name) !== uuid)) return m;
    back.set(name, uuid);
    return `[[${name}]]`;
  });
  return { shown, back };
}
async function fillPreview(pane, uuid, generation) {
  if (!uuid) { unmountPreviewEditor(); pane.innerHTML = '<div class="rf-pv-empty">Select a result to see it here.</div>'; return; }
  try {
    const meta = searchExtras.meta.get(uuid) || { tags: [] };
    const isPage = meta.isPage;
    const top = isPage ? await logseq.Editor.getPageBlocksTree(uuid) : [await logseq.Editor.getBlock(uuid, { includeChildren: true })];
    const page = isPage ? await logseq.Editor.getPage(uuid) : null;
    if (generation !== searchPreview.generation) return;
    const lines = [];
    const walk = (blocks, depth) => {
      for (const block of blocks || []) {
        if (!block || Array.isArray(block) || lines.length >= 80) continue;
        lines.push({ uuid: String(block.uuid), text: titleOf(block), depth });
        if (depth < 4) walk(block.children, depth + 1);
      }
    };
    walk(top.filter(Boolean), 0);
    const names = await mentionedTitles(lines.map(line => line.text));
    const blockRefs = new Set(lines.flatMap(line => [...line.text.matchAll(/\(\(([0-9a-f-]{36})\)\)/gi)].map(m => m[1].toLowerCase())));
    if (blockRefs.size) for (const [u, t] of await dsQuery(`[:find ?u ?t :where ${uuidsIn('?u', blockRefs)} [?e :block/uuid ?u] [?e :block/title ?t]]`)) names.set(String(u).toLowerCase(), plainSearchText(t, names));
    let path = [];
    if (!isPage) try { path = await previewPath(uuid); } catch (error) { warnOnce('search preview could not read where a result is', error); }
    if (!path.length && meta.pageTitle) path = [meta.pageTitle];
    if (generation !== searchPreview.generation) return;
    const kind = kindLabel(meta), edited = editedLabel(meta.updated);
    const heading = isPage ? (page?.title || page?.originalName || page?.name || '') : '';
    let props = [];
    try { props = await previewProperties(uuid); } catch (error) { warnOnce('search preview could not read properties', error); }
    if (generation !== searchPreview.generation) return;
    const words = previewWords(pane, uuid);
    const native = !!nativePreviewEditor(pane.ownerDocument);
    unmountPreviewEditor();
    pane.innerHTML = `
      ${path.length ? `<div class="rf-pv-path">${path.map(part => `<span>${escapeHtml(part.length > 80 ? part.slice(0, 80) + '…' : part)}</span>`).join('')}</div>` : ''}
      ${heading ? `<div class="rf-pv-title">${escapeHtml(heading)}</div>` : ''}
      <div class="rf-pv-meta">${escapeHtml([kind, edited].filter(Boolean).join(' · '))}</div>
      ${props.length ? `<div class="rf-pv-props">${props.map(([name, value]) => `<span class="rf-pv-pname">${escapeHtml(name)}</span><span>${markHtml(escapeHtml(value), words)}</span>`).join('')}</div>` : ''}
      <div class="rf-pv-actions"><button data-rf-act="open">Open</button><button data-rf-act="side">Open in sidebar</button></div>
      <div class="rf-pv-body">${lines.map(line => `<div class="rf-pv-block" data-uuid="${escapeHtml(line.uuid)}" style="--rf-depth:${line.depth}"><div class="rf-pv-text">${markHtml(previewHtml(line.text, names), words) || '<span class="rf-pv-blank">Empty</span>'}</div></div>`).join('')}
        ${lines.length ? '' : '<div class="rf-pv-empty">Nothing written here yet.</div>'}
        ${lines.length >= 80 ? '<div class="rf-pv-empty">Open it to see the rest.</div>' : ''}</div>`;
    pane.rfNames = names;
    pane.rfWords = words;
    // Trial: Logseq's own editor takes the place of the lines once it has drawn (they stay if it can't).
    if (native) {
      const body = pane.querySelector('.rf-pv-body'), box = pane.ownerDocument.createElement('div');
      box.className = 'rf-pv-native';
      body?.after(box);
      if (!mountPreviewEditor(pane, uuid)) box.remove();
    }
    // The first marked word is brought into edit when it is further down (the panel scrolls on its own).
    const first = pane.querySelector('.rf-pv-body mark');
    const below = first ? first.getBoundingClientRect().top - pane.getBoundingClientRect().top : 0;
    pane.scrollTop = below > pane.clientHeight * .7 ? below - pane.clientHeight / 3 : 0;
    pane.rfTexts = new Map(lines.map(line => [line.uuid, line.text]));
  } catch (error) {
    warnOnce('search preview could not load a result', error);
    if (generation === searchPreview.generation) pane.innerHTML = '<div class="rf-pv-empty">This result could not be shown.</div>';
  }
}
function previewClick(event) {
  const pane = event.currentTarget, action = event.target.closest('[data-rf-act]');
  const example = event.target.closest('[data-rf-try]');
  if (example) {
    const input = pane.parentElement.querySelector('.cp__cmdk-search-input');
    if (!input) return;
    const win = pane.ownerDocument.defaultView;
    Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, example.dataset.rfTry + ' ');
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
    input.focus();
    return;
  }
  if (action) {
    const root = pane.parentElement.querySelector('.cp__cmdk');
    if (root?.hasAttribute('data-rf-filtering')) { openFilterResult(root, searchPreview.uuid, action.dataset.rfAct === 'side'); return; }
    const row = pane.parentElement.querySelector(`.cp__cmdk [data-cmdk-item][data-rf-uuid="${searchPreview.uuid}"]`);
    if (!row) return;
    const win = pane.ownerDocument.defaultView;
    row.dispatchEvent(new win.MouseEvent('click', { bubbles: true, shiftKey: action.dataset.rfAct === 'side' }));
    return;
  }
  const line = event.target.closest('.rf-pv-block');
  if (!line || line.querySelector('textarea') || event.target.closest('a')) return;
  editPreviewLine(pane, line);
}
// One line of the panel as a text box, saved as you type. As on a page, Enter starts a new bullet
// below (taking the words after the cursor with it), Backspace at the start of an empty bullet
// removes it, and Escape stops editing.
function editPreviewLine(pane, line, caret = null) {
  const edit = { pane, line, caret };
  for (const fn of EDITPREVIEWLINE_FUNCTIONS) edit[fn.name] = (...args) => fn(edit, ...args);
  edit.doc = edit.pane.ownerDocument;
  edit.uuid = edit.line.dataset.uuid; edit.stored = edit.pane.rfTexts?.get(edit.uuid) ?? '';
  ({ shown: edit.shown, back: edit.back } = editableText(edit.stored, edit.pane.rfNames || new Map()));
  edit.box = edit.doc.createElement('textarea');
  edit.box.className = 'rf-pv-edit';
  edit.box.value = edit.shown;
  edit.line.querySelector('.rf-pv-text, .rf-pv-edit').replaceWith(edit.box);
  edit.fit();
  edit.box.focus();
  if (edit.caret !== null) edit.box.setSelectionRange(Math.min(edit.caret, edit.box.value.length), Math.min(edit.caret, edit.box.value.length));
  edit.timer = 0; edit.removed = false;
  edit.box.addEventListener('input', () => { edit.fit(); clearTimeout(edit.timer); edit.timer = setTimeout(edit.save, 700); });
  edit.box.addEventListener('keydown', key => {
    if (key.isComposing) return;
    if (key.key === 'Enter' && !key.shiftKey) { key.preventDefault(); edit.split(); }
    else if (key.key === 'Escape') { key.preventDefault(); edit.box.blur(); }
    else if (key.key === 'Backspace' && !edit.box.value && edit.uuid !== searchPreview.uuid) {
      // Only a bullet with nothing under it, and with a line above to move to.
      const prev = edit.line.previousElementSibling;
      if (!prev?.matches('.rf-pv-block') || edit.depthOf(edit.below()[0]) > edit.depthOf(edit.line)) return;
      key.preventDefault();
      edit.remove(prev);
    }
  });
  edit.box.addEventListener('blur', async () => {
    if (edit.removed) return;
    await edit.save();
    if (edit.removed) return;
    const text = edit.doc.createElement('div');
    text.className = 'rf-pv-text';
    text.innerHTML = markHtml(previewHtml(edit.pane.rfTexts.get(edit.uuid), edit.pane.rfNames || new Map()), edit.pane.rfWords || []) || '<span class="rf-pv-blank">Empty</span>';
    if (edit.box.isConnected) edit.box.replaceWith(text);
  });
}

function fit(edit) { edit.box.style.height = 'auto'; edit.box.style.height = edit.box.scrollHeight + 'px'; }

function toStored(edit, text = edit.box.value) { return text.replace(/\[\[([^\]]+)\]\]/g, (m, name) => edit.back.has(name) ? `[[${edit.back.get(name)}]]` : m); }

// Before writing, the block is read again: a line is only saved over the text the panel showed,
// never over a block that changed meanwhile or that is not the one the panel loaded.
async function unchanged(edit, expected) {
  const block = await logseq.Editor.getBlock(edit.uuid).catch(() => null);
  return !!block && String(block.title ?? block.content ?? '') === expected;
}

async function save(edit) {
  clearTimeout(edit.timer);
  const text = edit.toStored();
  const was = edit.pane.rfTexts.get(edit.uuid);
  if (text === was) return;
  if (!(await edit.unchanged(was))) { notify('This block changed elsewhere; the line was not saved. Open it to edit it.', 'warning'); return; }
  edit.pane.rfTexts.set(edit.uuid, text);
  try {
    await logseq.Editor.updateBlock(edit.uuid, text);
    searchExtras.meta.delete(searchPreview.uuid);
    // A saved line is a write to notes from a view, so it gets the bar with Undo, as a task's text does.
    if (typeof was === 'string') window.refinementShared.showUndoBar('Line saved', () => logseq.Editor.updateBlock(edit.uuid, was));
  }
  catch (error) { notify(`Could not save this line: ${error.message || error}`, 'warning'); }
}

function depthOf(edit, el) { return Number(el?.style.getPropertyValue('--rf-depth')) || 0; }

function below(edit) {
  const lines = [...edit.pane.querySelectorAll('.rf-pv-block')];
  return lines.slice(lines.indexOf(edit.line) + 1);
}

// A new bullet: the first child when this one's children are shown under it, else the next sibling.
// Logseq puts a child last unless asked for the start, so `start` keeps the page and the panel in step.
async function split(edit) {
  const rest = edit.toStored(edit.box.value.slice(edit.box.selectionEnd));
  edit.box.value = edit.box.value.slice(0, edit.box.selectionStart);
  const depth = edit.depthOf(edit.line), after = edit.below();
  const intoChildren = edit.depthOf(after[0]) > depth;
  edit.box.blur();
  let block;
  try { block = await logseq.Editor.insertBlock(edit.uuid, rest, intoChildren ? { sibling: false, start: true } : { sibling: true }); }
  catch (error) { notify(`Could not add a bullet: ${error.message || error}`, 'warning'); return; }
  if (!block?.uuid) return;
  searchExtras.meta.delete(searchPreview.uuid);
  const added = edit.doc.createElement('div');
  added.className = 'rf-pv-block';
  added.dataset.uuid = String(block.uuid);
  added.style.setProperty('--rf-depth', intoChildren ? depth + 1 : depth);
  added.innerHTML = '<div class="rf-pv-text"></div>';
  let last = edit.line;
  if (!intoChildren) for (const el of after) { if (edit.depthOf(el) <= depth) break; last = el; }
  last.after(added);
  edit.pane.rfTexts.set(added.dataset.uuid, rest);
  editPreviewLine(edit.pane, added, 0);
}

async function remove(edit, prev) {
  edit.removed = true;
  clearTimeout(edit.timer);
  // Only an empty bullet is removed, and only if it is still empty in the graph.
  if (!(await edit.unchanged(''))) { edit.removed = false; notify('This bullet is not empty in the graph; it was left alone.', 'warning'); return; }
  try { await logseq.Editor.removeBlock(edit.uuid); }
  catch (error) { edit.removed = false; notify(`Could not remove this bullet: ${error.message || error}`, 'warning'); return; }
  searchExtras.meta.delete(searchPreview.uuid);
  edit.pane.rfTexts.delete(edit.uuid);
  edit.line.remove();
  editPreviewLine(edit.pane, prev, Infinity);
}
// The pieces of editPreviewLine, each given the edit's state; editPreviewLine binds them to the edit by name.
const EDITPREVIEWLINE_FUNCTIONS = [fit, toStored, unchanged, save, depthOf, below, split, remove];

/* Typed filters. Codes in the search box narrow what is found:
     #Tag                     tagged with it, or with a tag that extends it
     in:Page                  on that page
     p:Name                   has that property; p:Name=word, a value of it holds the word
                              (property: and prop: work too)
     is:page / journal / block / task / todo / done
     edited:today / yesterday / week / month / year, or a count such as 3d or 2w
   A name with spaces goes in [[ ]] or quotes: in:[[Plugin Test]]. Logseq's search does not know
   these codes, so when the box has one the plugin finds the results itself, straight from the graph
   (each other word must be in the text), and lists them in place of Logseq's. While a code is being
   typed, a list under the box suggests tags, pages, properties or values, narrowing as you type;
   the arrow keys move in it, and Tab or Enter takes one. */
const searchFilter = {
  key: '', generation: 0, timer: 0, loading: false, list: [], total: 0, note: '', heading: '', words: [], current: 0,
  catalog: null, values: new Map(), suggest: [], suggestAt: 0, suggestFor: '', dismissed: '',
};
const filterKinds = {
  page: 'page', pages: 'page', journal: 'journal', journals: 'journal', block: 'block', blocks: 'block',
  task: 'task', tasks: 'task', todo: 'todo', open: 'todo', done: 'done',
};
const filterKindWords = { page: 'pages', journal: 'journal days', block: 'blocks', task: 'tasks', todo: 'tasks not done', done: 'finished tasks' };
const filterPrefix = /^(#|in:|is:|edited:|property:|prop:|p:)/i;
const unwrapName = value => String(value || '').trim().replace(/^"|"$/g, '').replace(/^\[\[|\]\]$/g, '').trim();
const wrapName = name => /[\s"=]/.test(name) ? `[[${name}]]` : name;
// The search box as words and codes, each with where it starts and ends.
function filterTokens(input) {
  return [...String(input).matchAll(/(?:#|in:|is:|edited:|p(?:rop(?:erty)?)?:)?(?:"[^"]*"?|\[\[[^\]]*(?:\]\]?)?|[^\s"[]+|\[)(?:=(?:"[^"]*"?|\[\[[^\]]*(?:\]\]?)?|\S*))?/gi)]
    .map(m => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
}
function parseSearchFilters(input) {
  const parsed = { any: false, tags: [], pages: [], props: [], kinds: [], since: 0, sinceLabel: '', bad: [], words: [] };
  for (const { text } of filterTokens(input)) {
    const prefix = text.match(filterPrefix)?.[1]?.toLowerCase();
    if (!prefix) { const word = unwrapName(text).toLowerCase(); if (word) parsed.words.push(word); continue; }
    parsed.any = true;
    const rest = text.slice(prefix.length);
    if (prefix === 'property:' || prefix === 'prop:' || prefix === 'p:') {
      const [, name, value] = rest.match(/^("[^"]*"?|\[\[[^\]]*(?:\]\]?)?|[^=]*)(?:=(.*))?$/) || [];
      if (unwrapName(name)) parsed.props.push({ name: unwrapName(name), value: unwrapName(value).toLowerCase() || null });
      continue;
    }
    const value = unwrapName(rest);
    if (!value) continue;
    if (prefix === '#') parsed.tags.push(value);
    else if (prefix === 'in:') parsed.pages.push(value);
    else if (prefix === 'is:') { const kind = filterKinds[value.toLowerCase()]; if (kind) parsed.kinds.push(kind); else parsed.bad.push(text); }
    else { const since = editedSince(value); if (since) Object.assign(parsed, { since: since.ms, sinceLabel: since.label }); else parsed.bad.push(text); }
  }
  return parsed;
}
function editedSince(value) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const v = value.toLowerCase();
  if (v === 'today') return { ms: start.getTime(), label: 'edited today' };
  if (v === 'yesterday') return { ms: start.getTime() - 864e5, label: 'edited since yesterday' };
  const m = v.match(/^(\d+)\s*([dwmy])$/);
  const days = { week: 7, month: 30, year: 365 }[v] || (m && Number(m[1]) * { d: 1, w: 7, m: 30, y: 365 }[m[2]]);
  // To the minute, so the same words give the same filter while the window stays open.
  return days ? { ms: Math.floor(Date.now() / 6e4) * 6e4 - days * 864e5, label: `edited in the last ${days} day${days === 1 ? '' : 's'}` } : null;
}

// Tags, pages and properties of the graph, read once each time the search window opens.
function filterCatalog() {
  searchFilter.catalog ||= (async () => {
    const [tags, pages, props] = await Promise.all([
      allTags(),
      dsQuery(`[:find ?p ?title :where [?p :block/name _] [?p :block/title ?title] (not [?p :logseq.property/hide? true])]`),
      dsQuery(`[:find ?p ?ident ?title :where [?p :block/tags ?c] [?c :db/ident :logseq.class/Property] [?p :db/ident ?ident]
        [?p :block/title ?title] (not [?p :logseq.property/hide? true]) (not [?p :logseq.property/public? false])]`),
    ]);
    const named = rows => rows.map(([id, ...rest]) => ({ id, title: String(rest[rest.length - 1]), lower: String(rest[rest.length - 1]).toLowerCase(), ident: rest.length > 1 ? bareIdent(rest[0]) : null }));
    const properties = named(props).sort((a, b) => Number(b.ident.startsWith('user.')) - Number(a.ident.startsWith('user.')));
    return { tags: named(tags), pages: named(pages), props: properties };
  })().catch(error => { searchFilter.catalog = null; throw error; });
  return searchFilter.catalog;
}
// The values a property has across the graph, as text, for suggesting.
async function propertyValues(prop) {
  if (searchFilter.values.has(prop.ident)) return searchFilter.values.get(prop.ident);
  const rows = await dsQuery(`[:find ?v :where [_ ${keyword(prop.ident)} ?v]]`);
  const texts = await valueTexts(rows.map(([v]) => v));
  const list = [...new Set([...texts.values()].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  searchFilter.values.set(prop.ident, list);
  return list;
}
// Property values as text: what a linked page or value is called, or the value itself.
async function valueTexts(values) {
  const ids = values.filter(isEntityId);
  const known = new Map(ids.length ? await dsQuery(`[:find ?e ?t :where ${idsIn('?e', ids)}
    (or-join [?e ?t] [?e :block/title ?t] (and [(missing? $ ?e :block/title)] [?e :logseq.property/value ?t]))]`) : []);
  const names = await mentionedTitles([...known.values()].map(String));
  const texts = new Map();
  for (const v of values) texts.set(v, known.has(v) ? plainSearchText(String(known.get(v)), names) : typeof v === 'object' ? '' : String(v));
  return texts;
}

// Finds what the codes and words ask for, newest edit first (texts that start with the words first).
async function runSearchFilters(parsed) {
  const catalog = await filterCatalog();
  const clauses = await filterClauses(parsed, catalog);
  if (clauses.note || clauses.handBack) return clauses;
  const { where, described, valueChecks } = clauses;
  let rows = await dsQuery(`[:find ?b ?u ?title ?updated ?p ?name :where ${where.join(' ')}
    [?b :block/uuid ?u] [?b :block/title ?title]
    [(get-else $ ?b :block/updated-at 0) ?updated] [(get-else $ ?b :block/page 0) ?p] [(get-else $ ?b :block/name "") ?name]
    (not [?b :logseq.property/built-in? true]) (not [?b :logseq.property/hide? true])
    [(missing? $ ?b :logseq.property/created-from-property)]]`);
  let names;
  ({ rows, names } = await narrowFilterRows(rows, parsed, valueChecks));
  const shown = rows.slice(0, 100);
  if (!parsed.words.length) names = await mentionedTitles(shown.map(row => String(row[2])));
  const pageIds = [...new Set(shown.map(row => row[4]).filter(isEntityId))];
  const pages = new Map(pageIds.length ? (await dsQuery(`[:find ?p ?u ?t :where ${idsIn('?p', pageIds)} [?p :block/uuid ?u] [?p :block/title ?t]]`))
    .map(([p, u, t]) => [p, { uuid: String(u).toLowerCase(), title: String(t) }]) : []);
  const list = shown.map(([, u, title, updated, p, name]) => ({
    uuid: String(u).toLowerCase(), isPage: !!name, updated: Number(updated) || 0,
    text: plainSearchText(String(title), names).replace(/\[\[([^\]]+)\]\]/g, '$1').slice(0, 400) || 'Untitled',
    pageUuid: pages.get(p)?.uuid || null, pageTitle: pages.get(p)?.title || '',
  }));
  // A search that is only #Tag (0.4.131): the tag's own page is the first row, then what is tagged with it, so Enter
  // on #Meeting opens the Meeting page, as Logseq's own search would. Before, only the tagged records were listed.
  const loneTag = parsed.tags.length === 1 && !parsed.words.length && !parsed.pages.length && !parsed.props.length &&
    !parsed.kinds.length && !parsed.since && !parsed.bad.length;
  if (loneTag) {
    const ids = catalog.tags.filter(tag => tag.lower === parsed.tags[0].toLowerCase()).map(tag => tag.id).filter(isEntityId);
    const own = ids.length ? await dsQuery(`[:find ?u ?t ?updated :where ${idsIn('?p', ids)} [?p :block/uuid ?u] [?p :block/title ?t]
      [(get-else $ ?p :block/updated-at 0) ?updated]]`) : [];
    list.unshift(...own.map(([u, t, updated]) => ({ uuid: String(u).toLowerCase(), isPage: true, isTag: true, updated: Number(updated) || 0, text: String(t), pageUuid: null, pageTitle: '' })));
    if (own.length) return { list, total: rows.length, heading: `${described.join(', ')}, after the tag’s own page` };
  }
  return { list, total: rows.length, heading: described.join(', ') };
}

// The Datascript clauses the codes ask for, and the words that describe them; or a note when a name is
// unknown (or still being typed), or handBack when a lone #word names no tag.
async function filterClauses(parsed, catalog) {
  const where = [], described = [];
  const pick = (list, name) => list.filter(item => item.lower === name.toLowerCase());
  // A name that is only the start of one is still being typed.
  const missing = (list, name, what) => ({ note: list.some(item => item.lower.startsWith(name.toLowerCase()))
    ? `Keep typing, or pick a ${what} from the list.` : `No ${what} is called “${name}”.` });
  // A lone #word that names no tag is left to Logseq, whose search then offers to create that tag.
  const loneTag = parsed.tags.length === 1 && !parsed.words.length && !parsed.pages.length && !parsed.props.length &&
    !parsed.kinds.length && !parsed.since && !parsed.bad.length;
  if (loneTag && !pick(catalog.tags, parsed.tags[0]).length) return { handBack: true };
  for (const [i, name] of parsed.tags.entries()) {
    const found = pick(catalog.tags, name);
    if (!found.length) return missing(catalog.tags, name, 'tag');
    const all = await withExtendingTags(new Set(found.map(tag => tag.id)));
    where.push(`${idsIn(`?tag${i}`, [...all])} [?b :block/tags ?tag${i}]`);
    described.push(`tagged ${found[0].title}`);
  }
  for (const [i, name] of parsed.pages.entries()) {
    const found = pick(catalog.pages, name);
    if (!found.length) return missing(catalog.pages, name, 'page');
    where.push(`${idsIn(`?in${i}`, found.map(page => page.id))} [?b :block/page ?in${i}]`);
    described.push(`in ${found[0].title}`);
  }
  const valueChecks = [];
  for (const [i, prop] of parsed.props.entries()) {
    const found = pick(catalog.props, prop.name);
    if (!found.length) return missing(catalog.props, prop.name, 'property');
    where.push(`[?b ${keyword(found[0].ident)} _]`);
    if (prop.value) valueChecks.push({ ident: found[0].ident, value: prop.value });
    described.push(prop.value ? `${found[0].title} has “${prop.value}”` : `with ${found[0].title}`);
  }
  for (const [i, kind] of parsed.kinds.entries()) {
    where.push({
      page: '[?b :block/name _]',
      journal: '[?b :block/journal-day _]',
      block: '[?b :block/page _]',
      task: `(or-join [?b] [?b :logseq.property/status _] (and [?b :block/tags ?task${i}] [?task${i} :db/ident :logseq.class/Task]))`,
      todo: `[?b :logseq.property/status ?st${i}] (not [?st${i} :db/ident :logseq.property/status.done]) (not [?st${i} :db/ident :logseq.property/status.canceled])`,
      done: `[?b :logseq.property/status ?st${i}] [?st${i} :db/ident :logseq.property/status.done]`,
    }[kind]);
    described.push(filterKindWords[kind]);
  }
  if (parsed.since) {
    where.push(`[?b :block/updated-at ?edited] [(>= ?edited ${Math.floor(parsed.since)})]`);
    described.push(parsed.sinceLabel);
  }
  if (parsed.bad.length) described.push(`not understood: ${parsed.bad.join(' ')}`);
  if (!where.length) return { note: parsed.bad.length ? `Not understood: ${parsed.bad.join(' ')}` : 'Type a name after the code, or pick one from the list.' };
  return { where, described, valueChecks };
}
// The rows that also hold the asked-for property values and every word, newest first (a phrase at the
// start first); names are the page titles the links in those rows show.
async function narrowFilterRows(rows, parsed, valueChecks) {
  // p:Name=word: keep what has a value holding the word.
  for (const check of valueChecks) {
    const pairs = await dsQuery(`[:find ?b ?v :where ${idsIn('?b', rows.map(([b]) => b))} [?b ${keyword(check.ident)} ?v]]`);
    const texts = await valueTexts(pairs.map(([, v]) => v));
    const keep = new Set(pairs.filter(([, v]) => String(texts.get(v) || '').toLowerCase().includes(check.value)).map(([b]) => b));
    rows = rows.filter(([b]) => keep.has(b));
  }
  // Each word in the text, with links read as the names they show.
  let names = new Map();
  if (parsed.words.length) {
    const raw = ([, , title]) => String(title).toLowerCase();
    const linked = rows.filter(row => !parsed.words.every(word => raw(row).includes(word)) && /\[\[[0-9a-f-]{36}\]\]/i.test(row[2]));
    names = await mentionedTitles(linked.slice(0, 3000).map(row => String(row[2])));
    rows = rows.filter(row => {
      const plain = plainSearchText(String(row[2]), names).toLowerCase();
      return parsed.words.every(word => plain.includes(word));
    });
  }
  const phrase = parsed.words.join(' ');
  rows.sort((a, b) => {
    if (phrase) {
      const starts = row => plainSearchText(String(row[2]), names).toLowerCase().startsWith(phrase) ? 0 : 1;
      const order = starts(a) - starts(b);
      if (order) return order;
    }
    return (Number(b[3]) || 0) - (Number(a[3]) || 0);
  });
  return { rows, names };
}

const dialogSearch = doc => doc.querySelector('.ls-dialog-cmdk .cp__cmdk');
function updateSearchFilters(doc) {
  const root = dialogSearch(doc);
  if (!root) { Object.assign(searchFilter, { catalog: null, key: '', dismissed: '', handBack: '' }); searchFilter.values.clear(); return; }
  const input = root.querySelector('.cp__cmdk-search-input');
  const parsed = setting('searchFilters') && input ? parseSearchFilters(input.value) : { any: false };
  const key = JSON.stringify(parsed);
  // A lone #word that names no tag: Logseq's own rows stay (with its "Create tag"), and only the
  // list of tag names is offered; Escape closes it so Enter reaches Logseq.
  if (parsed.any && key === searchFilter.handBack) {
    root.removeAttribute('data-rf-filtering');
    root.querySelector('.rf-filter-results')?.remove();
    searchFilter.key = '';
    updateFilterSuggestions(root, input);
    return;
  }
  if (!parsed.any) {
    if (root.hasAttribute('data-rf-filtering')) {
      root.removeAttribute('data-rf-filtering');
      for (const el of root.querySelectorAll('.rf-filter-results, .rf-filter-suggest')) el.remove();
      searchFilter.key = '';
      if (setting('searchPreview')) updateSearchPreview(doc);
    }
    return;
  }
  root.setAttribute('data-rf-filtering', '');
  updateFilterSuggestions(root, input);
  if (key === searchFilter.key) {
    if (!root.querySelector('.rf-filter-results')) renderFilterResults(root);
    return;
  }
  searchFilter.key = key;
  clearTimeout(searchFilter.timer);
  const generation = ++searchFilter.generation;
  searchFilter.loading = true;
  renderFilterResults(root);
  searchFilter.timer = setTimeout(async () => {
    let found;
    try { found = await runSearchFilters(parsed); } catch (error) {
      warnOnce('search filters could not be run', error);
      found = { note: 'These filters could not be run.' };
    }
    if (generation !== searchFilter.generation) return;
    if (found.handBack) {
      Object.assign(searchFilter, { loading: false, handBack: key });
      updateSearchFilters(doc);
      return;
    }
    Object.assign(searchFilter, { loading: false, list: found.list || [], total: found.total || 0, note: found.note || '',
      heading: found.heading || '', words: parsed.words, current: 0 });
    const now = dialogSearch(doc);
    if (now) renderFilterResults(now);
    loadSearchMeta(searchFilter.list.map(item => item.uuid));
  }, 180);
}

const filterHelp = '<b>#</b>tag · <b>in:</b>page · <b>p:</b>property=value · <b>is:</b>task, todo, done, page, journal, block · <b>edited:</b>today, week, month, 3d';
// Marks each word in HTML, in the text between tags and character entities only.
function markHtml(html, words) {
  for (const word of words) {
    if (!word) continue;
    const pattern = new RegExp(escapeHtml(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    html = html.replace(/(<[^>]*>|&[#\w]+;)|([^<&]+|&)/g, (m, whole, plain) => whole || plain.replace(pattern, found => `<mark>${found}</mark>`));
  }
  return html;
}
const markWords = (text, words) => markHtml(escapeHtml(text), words);
function renderFilterResults(root) {
  const scroller = root.querySelector('.cp__cmdk-input-row + div');
  if (!scroller) return;
  let box = scroller.querySelector(':scope > .rf-filter-results');
  if (!box) {
    box = root.ownerDocument.createElement('div');
    box.className = 'rf-filter-results';
    box.addEventListener('mousemove', event => {
      const row = event.target.closest('.rf-fr-row');
      if (row && (event.movementX || event.movementY)) setFilterCurrent(root, Number(row.dataset.i));
    });
    box.addEventListener('click', event => {
      const row = event.target.closest('.rf-fr-row');
      if (row) openFilterResult(root, row.dataset.rfUuid, event.shiftKey || event.metaKey || event.ctrlKey);
    });
    scroller.appendChild(box);
  }
  const f = searchFilter;
  const head = f.loading ? 'Looking…' : f.note ||
    `${f.total} found${f.heading ? ' · ' + f.heading : ''}${f.total > f.list.length ? ` · showing the first ${f.list.length}` : ''}`;
  const rows = f.loading || f.note ? '' : f.list.map((item, i) => `
    <div class="rf-fr-row" data-i="${i}" data-rf-uuid="${escapeHtml(item.uuid)}"${i === f.current ? ' data-rf-current' : ''}>
      ${item.isPage ? '' : `<div class="rf-fr-path">${escapeHtml(item.pageTitle)}</div>`}
      <div class="rf-fr-line"><span class="rf-fr-icon">${item.isTag ? '#' : item.isPage ? '▢' : '•'}</span><span class="rf-fr-text">${markWords(item.text, f.words)}</span><span class="rf-fr-meta"></span></div>
    </div>`).join('');
  box.innerHTML = `<div class="rf-fr-head">${escapeHtml(head)}</div>${rows}
    ${!f.loading && !f.note && !f.list.length ? '<div class="rf-fr-none">Nothing matches.</div>' : ''}
    <div class="rf-fr-help">${filterHelp}</div>`;
  refreshFilterLabels(root);
  if (setting('searchPreview')) updateSearchPreview(root.ownerDocument);
}
// What each listed result is and when it was edited, once its details are in.
function refreshFilterLabels(root) {
  for (const row of root.querySelectorAll('.rf-fr-row')) {
    const meta = searchExtras.meta.get(row.dataset.rfUuid), item = searchFilter.list[Number(row.dataset.i)];
    const label = [item?.isTag ? 'tag page' : meta ? kindLabel(meta) : item?.isPage ? 'Page' : '', editedLabel(meta?.updated || item?.updated)].filter(Boolean).join(' · ');
    const el = row.querySelector('.rf-fr-meta');
    if (el && el.textContent !== label) el.textContent = label;
  }
}
function setFilterCurrent(root, i) {
  const rows = root.querySelectorAll('.rf-fr-row');
  if (!rows.length) return;
  i = Math.max(0, Math.min(rows.length - 1, i));
  searchFilter.current = i;
  rows.forEach(row => row.toggleAttribute('data-rf-current', Number(row.dataset.i) === i));
  // Only the list scrolls (scrollIntoView would also move the window around it).
  const row = rows[i], list = row.closest('.rf-filter-results')?.parentElement;
  if (list) {
    const top = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
    if (top < 0) list.scrollTop += top;
    else if (top + row.offsetHeight > list.clientHeight) list.scrollTop += top + row.offsetHeight - list.clientHeight;
  }
  if (setting('searchPreview')) updateSearchPreview(root.ownerDocument);
}
// Logseq's own Escape: the first clears the box, the next closes the window.
function closeSearchWindow(root) {
  const input = root.querySelector('.cp__cmdk-search-input'), win = root.ownerDocument.defaultView;
  const escape = () => input?.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  escape();
  setTimeout(() => { if (root.isConnected) escape(); }, 30);
}
function openFilterResult(root, uuid, inSidebar) {
  if (!uuid) return;
  const item = searchFilter.list.find(entry => entry.uuid === uuid);
  closeSearchWindow(root);
  if (inSidebar) logseq.Editor.openInRightSidebar(uuid);
  else if (item && !item.isPage && item.pageUuid) logseq.App.pushState('page', { name: item.pageUuid }, { anchor: `ls-block-${uuid}` });
  else openEntity(uuid);
}

// The code being typed at the cursor, if any.
function codeAtCursor(input) {
  const at = input.selectionStart ?? input.value.length;
  return filterTokens(input.value).find(token => token.start < at && at <= token.end && filterPrefix.test(token.text)) || null;
}
async function filterSuggestions(token) {
  const prefix = token.text.match(filterPrefix)[1].toLowerCase(), rest = token.text.slice(prefix.length);
  const rank = (list, typed, label) => {
    const want = unwrapName(typed).toLowerCase();
    return list.map(item => ({ item, at: label(item).toLowerCase().indexOf(want) }))
      .filter(entry => entry.at >= 0)
      .sort((a, b) => (a.at > 0) - (b.at > 0) || label(a.item).length - label(b.item).length)
      .slice(0, 8).map(entry => entry.item);
  };
  if (prefix === 'is:') {
    return rank(['task', 'todo', 'done', 'page', 'journal', 'block'], rest, kind => kind)
      .map(kind => ({ label: kind, hint: filterKindWords[kind], insert: `is:${kind} ` }));
  }
  if (prefix === 'edited:') {
    return rank(['today', 'yesterday', 'week', 'month', 'year'], rest, word => word)
      .map(word => ({ label: word, hint: editedSince(word).label, insert: `edited:${word} ` }))
      .concat(/^\d+$/.test(rest) ? ['d', 'w'].map(unit => ({ label: rest + unit, hint: editedSince(rest + unit).label, insert: `edited:${rest}${unit} ` })) : []);
  }
  const catalog = await filterCatalog();
  if (prefix === '#') return rank(catalog.tags, rest, tag => tag.title).map(tag => ({ label: tag.title, hint: 'tag', insert: `#${wrapName(tag.title)} ` }));
  if (prefix === 'in:') return rank(catalog.pages, rest, page => page.title).map(page => ({ label: page.title, hint: 'page', insert: `in:${wrapName(page.title)} ` }));
  const [, name, value] = rest.match(/^("[^"]*"?|\[\[[^\]]*(?:\]\]?)?|[^=]*)(?:=(.*))?$/) || [];
  if (value === undefined) {
    return rank(catalog.props, name || '', prop => prop.title)
      .map(prop => ({ label: prop.title, hint: 'property · add =value or a space', insert: `${prefix}${wrapName(prop.title)}=`, keepOpen: true }));
  }
  const prop = catalog.props.find(p => p.lower === unwrapName(name).toLowerCase());
  if (!prop) return [];
  return rank(await propertyValues(prop), value, text => text)
    .map(text => ({ label: text, hint: prop.title, insert: `${prefix}${wrapName(prop.title)}=${/[\s"]/.test(text) ? `"${text.replace(/"/g, '')}"` : text} ` }));
}
function updateFilterSuggestions(root, input) {
  const token = root.ownerDocument.activeElement === input ? codeAtCursor(input) : null;
  const key = token ? `${token.start}:${token.text}` : '';
  if (!token || key === searchFilter.dismissed) { closeFilterSuggestions(root); return; }
  if (key === searchFilter.suggestFor && root.querySelector('.rf-filter-suggest')) return;
  searchFilter.suggestFor = key;
  filterSuggestions(token).then(list => {
    if (searchFilter.suggestFor !== key) return;
    // A name typed out in full needs no list (so Enter opens the selected result).
    const typed = unwrapName(token.text.replace(filterPrefix, '')).toLowerCase();
    if (list.some(entry => !entry.keepOpen && entry.label.toLowerCase() === typed.replace(/^.*?=/, ''))) list = [];
    searchFilter.suggest = list.map(entry => ({ ...entry, token }));
    searchFilter.suggestAt = 0;
    renderFilterSuggestions(root);
  }).catch(error => warnOnce('search filters could not suggest names', error));
}
function closeFilterSuggestions(root) {
  searchFilter.suggest = [];
  searchFilter.suggestFor = '';
  root.querySelector('.rf-filter-suggest')?.remove();
}
function renderFilterSuggestions(root) {
  let box = root.querySelector(':scope > .rf-filter-suggest');
  if (!searchFilter.suggest.length) { box?.remove(); return; }
  if (!box) {
    box = root.ownerDocument.createElement('div');
    box.className = 'rf-filter-suggest';
    box.addEventListener('mousedown', event => {
      const item = event.target.closest('.rf-fs-item');
      if (!item) return;
      event.preventDefault();
      takeFilterSuggestion(root, Number(item.dataset.i));
    });
    root.appendChild(box);
  }
  const row = root.querySelector('.cp__cmdk-input-row');
  if (row) box.style.top = row.offsetHeight + 'px';
  box.innerHTML = searchFilter.suggest.map((entry, i) => `
    <div class="rf-fs-item" data-i="${i}"${i === searchFilter.suggestAt ? ' data-rf-current' : ''}>
      <span class="rf-fs-label">${escapeHtml(entry.label)}</span><span class="rf-fs-hint">${escapeHtml(entry.hint || '')}</span>
    </div>`).join('') + '<div class="rf-fs-keys">↑ ↓ to choose · Tab or Enter to use · Esc to close</div>';
}
function takeFilterSuggestion(root, i) {
  const entry = searchFilter.suggest[i], input = root.querySelector('.cp__cmdk-search-input');
  if (!entry || !input) return;
  const { start, end } = entry.token, value = input.value;
  const after = value.slice(end).replace(/^\s+/, '');
  const next = value.slice(0, start) + entry.insert + (entry.keepOpen && after ? ' ' : '') + after;
  const win = root.ownerDocument.defaultView;
  Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, next);
  const caret = start + entry.insert.length;
  input.setSelectionRange(caret, caret);
  closeFilterSuggestions(root);
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  input.focus();
}

// Keys while filtering: the suggestion list first, then the results the plugin lists.
function searchFilterKeys(event) {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
  const root = event.target?.closest?.('.ls-dialog-cmdk .cp__cmdk');
  const filtering = root?.hasAttribute('data-rf-filtering');
  if (!filtering && !root?.querySelector('.rf-filter-suggest')) return;
  const down = event.key === 'ArrowDown' || (event.ctrlKey && event.key === 'n');
  const up = event.key === 'ArrowUp' || (event.ctrlKey && event.key === 'p');
  const take = () => { event.preventDefault(); event.stopPropagation(); };
  if (searchFilter.suggest.length && root.querySelector('.rf-filter-suggest')) {
    if (down || up) {
      take();
      searchFilter.suggestAt = (searchFilter.suggestAt + (down ? 1 : -1) + searchFilter.suggest.length) % searchFilter.suggest.length;
      renderFilterSuggestions(root);
      return;
    }
    if ((event.key === 'Tab' || event.key === 'Enter') && !event.shiftKey) { take(); takeFilterSuggestion(root, searchFilter.suggestAt); return; }
    if (event.key === 'Escape') { take(); searchFilter.dismissed = searchFilter.suggestFor; closeFilterSuggestions(root); return; }
  }
  if (!filtering) return;
  if (down || up) { take(); setFilterCurrent(root, searchFilter.current + (down ? 1 : -1)); return; }
  if (event.key === 'Enter') {
    take();
    const row = root.querySelector('.rf-fr-row[data-rf-current]');
    if (row) openFilterResult(root, row.dataset.rfUuid, event.shiftKey || event.metaKey || event.ctrlKey);
  }
}
// Typing, and moving the cursor, update the filters at once (Logseq redraws its rows a little later).
function searchFilterInput(event) {
  if (!event.target?.matches?.('.ls-dialog-cmdk .cp__cmdk-search-input')) return;
  if (event.type === 'keyup' && !/^(Arrow(Left|Right)|Home|End)$/.test(event.key)) return;
  updateSearchFilters(event.target.ownerDocument);
}

function startSearchExtras() {
  try {
    if (!setting('searchDetails') && !setting('groupSearch') && !setting('searchPreview') && !setting('searchFilters')) return;
    logseq.provideStyle({ key: 'personal-db-search-extras', style: searchExtrasCss });
    watchDom(updateSearchExtras);
    const doc = host();
    doc.addEventListener('keydown', searchFilterKeys, true);
    doc.addEventListener('keydown', searchArrowKeys, true);
    for (const type of ['input', 'keyup', 'focusin']) doc.addEventListener(type, searchFilterInput, true);
    onUnload(() => {
      doc.removeEventListener('keydown', searchFilterKeys, true);
      doc.removeEventListener('keydown', searchArrowKeys, true);
      for (const type of ['input', 'keyup', 'focusin']) doc.removeEventListener(type, searchFilterInput, true);
      for (const el of doc.querySelectorAll('.rf-filter-results, .rf-filter-suggest')) el.remove();
      for (const el of doc.querySelectorAll('[data-rf-filtering]')) el.removeAttribute('data-rf-filtering');
      searchPreview.watcher?.disconnect();
      for (const el of doc.querySelectorAll('.rf-search-preview, .rf-search-guide, .rf-search-meta, .rf-search-peek, .rf-search-where')) el.remove();
      for (const el of doc.querySelectorAll('[data-rf-with-preview]')) el.removeAttribute('data-rf-with-preview');
      for (const el of doc.querySelectorAll('.search-results[data-rf-grouped]')) {
        el.removeAttribute('data-rf-grouped'); el.removeAttribute('data-rf-moved');
        for (const child of el.children) child.style.order = '';
      }
    });
  } catch (error) { warnOnce('search details are unavailable', error); }
}
const searchExtrasCss = `
/* Search details: what a result is and when it was edited, at the right of its row; the first line
   under a heading-like result, and where an unseen match was found, under its text. */
.cp__cmdk [data-cmdk-item] > .flex.items-start > .rf-search-meta {
  margin-left: auto; padding-left: 12px; flex: 0 0 auto; max-width: 40%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-size: var(--rf-tiny); line-height: 20px; color: var(--ls-primary-text-color); opacity: var(--rf-faint);
}
/* The text column may shrink, so a long first line ends in "…" instead of pushing the label out. */
.cp__cmdk [data-cmdk-item] > .flex.items-start > .flex-1 { min-width: 0; }
.cp__cmdk [data-cmdk-item] :is(.rf-search-peek, .rf-search-where) {
  font-size: .8rem; line-height: 1.4; color: var(--ls-primary-text-color); opacity: var(--rf-quiet);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px;
}
.cp__cmdk [data-cmdk-item] .rf-search-peek::before { content: '• '; opacity: var(--rf-faint); }
.cp__cmdk [data-cmdk-item] .rf-search-where { font-style: italic; }

/* Results put page by page: rows after the first of a page leave out the page name and sit a little in. */
.cp__cmdk .search-results[data-rf-grouped] { display: flex; flex-direction: column; }
.cp__cmdk [data-cmdk-item][data-rf-same-page] { margin-left: 18px; }
.cp__cmdk [data-cmdk-item][data-rf-same-page] > .text-xs:first-child .breadcrumb > .breadcrumb__segment:first-child { display: none !important; }
.cp__cmdk [data-cmdk-item][data-rf-same-page] > .text-xs:first-child .breadcrumb > .breadcrumb__segment:first-child + * + .breadcrumb__segment::before,
.cp__cmdk [data-cmdk-item][data-rf-same-page] > .text-xs:first-child .breadcrumb > .breadcrumb__segment:first-child ~ .breadcrumb__segment:nth-child(3)::before { margin-left: 0 !important; }
.cp__cmdk [data-cmdk-item][data-rf-same-page] > .text-xs:first-child:not(:has(.breadcrumb__segment ~ .breadcrumb__segment)) { display: none !important; }
.cp__cmdk [data-cmdk-item][data-rf-group-end] { margin-bottom: 6px; }

/* The preview panel at the right of the search popover. */
/* Logseq's window is overflow:hidden, which still lets a scrollIntoView inside it shift its contents
   up out of reach; clip makes it a plain box that never scrolls. */
.ls-dialog-cmdk { overflow: clip !important; }
/* The window has a set width that grows with the screen, shared by the list and the panel (about
   55/45); left to size itself it filled the whole screen width, with the panel stuck at 640px and an
   empty strip beside it, and clicks on that strip counted as inside, so they did not close search. */
[data-rf-with-preview] { display: flex !important; flex-direction: row !important; align-items: stretch !important; max-width: none !important; width: min(1760px, 96dvw) !important; }
/* When the row above sits inside Logseq's window box, that box shrinks to it. */
.ls-dialog-cmdk:has([data-rf-with-preview]) { width: fit-content !important; max-width: 96dvw !important; }
[data-rf-with-preview] > .cp__cmdk__modal { flex: 11 1 0; min-width: 420px; width: auto !important; border-top-right-radius: 0 !important; border-bottom-right-radius: 0 !important; }
/* The panel takes the height of the search list beside it and scrolls inside; without contain, a long
   result made the whole popover taller, and Logseq, which centres it, slid it up the screen. */
.rf-search-preview {
  flex: 9 1 0; min-width: 300px; min-height: 0; overflow-y: auto; box-sizing: border-box; contain: size;
  padding: 20px 24px 28px; border-left: 1px solid var(--ls-border-color, rgba(128,128,128,.16));
  background: var(--ls-primary-background-color); color: var(--ls-primary-text-color);
  font-size: .93rem; line-height: 1.55; border-radius: 0 8px 8px 0;
}
.rf-search-preview .rf-pv-empty { opacity: var(--rf-faint); font-size: .85rem; padding: 8px 0; }
.rf-search-preview .rf-pv-path { font-size: var(--rf-tiny); opacity: var(--rf-quiet); margin-bottom: 2px; }
/* The path reads as in the result row: the page, then a small bullet before each block above the result. */
.rf-search-preview .rf-pv-path > span:first-child { font-weight: 600; }
.rf-search-preview .rf-pv-path > span + span::before { content: '•'; margin: 0 .5em; opacity: var(--rf-faint); }
/* The searched words, marked the way a highlighter would. */
.rf-search-preview mark { background: transparent; font-weight: 600; color: inherit; padding: 0 .06em; border-radius: 2px; }
.rf-search-preview .rf-pv-title { font-size: 1.3rem; font-weight: 600; line-height: 1.3; margin-bottom: 2px; }
.rf-search-preview .rf-pv-meta { font-size: var(--rf-tiny); opacity: var(--rf-faint); min-height: 1em; }
/* Properties: names in a faint column, values beside them, as on the page itself. */
.rf-search-preview .rf-pv-props { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin-top: 8px; font-size: .88rem; }
.rf-search-preview .rf-pv-pname { opacity: var(--rf-quiet); }
.rf-search-preview .rf-pv-props > span { overflow-wrap: anywhere; }
.rf-search-preview .rf-pv-actions { display: flex; gap: 6px; margin: 10px 0 14px; }
.rf-search-preview .rf-pv-actions button {
  font: inherit; font-size: .78rem; padding: 2px 9px; border-radius: 5px; cursor: pointer;
  border: 1px solid var(--ls-border-color, rgba(128,128,128,.25)); background: transparent; color: inherit; opacity: var(--rf-quiet);
}
.rf-search-preview .rf-pv-actions button:hover { opacity: 1; background: rgba(128,128,128,.08); }
/* The guide to the search codes, and the button that opens it at the bottom right of the panel. */
/* The slim guide to the codes along the bottom: the window's row wraps so the bar takes a line of its own. */
[data-rf-with-preview] { flex-wrap: wrap !important; }
.rf-search-guide {
  flex: 0 0 100%; order: 9; display: flex; flex-wrap: wrap; align-items: center; gap: 3px 18px; box-sizing: border-box;
  padding: 7px 18px; border-top: 1px solid var(--ls-border-color, rgba(128,128,128,.16));
  font-size: var(--rf-tiny); color: var(--ls-primary-text-color); background: var(--ls-primary-background-color);
}
.rf-search-guide > span { white-space: nowrap; opacity: var(--rf-quiet); cursor: pointer; }
.rf-search-guide > span:hover { opacity: 1; }
.rf-search-guide > span b { font-weight: 600; }
.rf-search-guide > .rf-sg-quiet { opacity: var(--rf-faint); cursor: default; }
.rf-search-guide > .rf-sg-keys { cursor: default; }
.rf-search-guide > .rf-sg-keys:hover { opacity: var(--rf-quiet); }
.rf-search-guide > .rf-sg-more { margin-left: auto; }
.rf-search-preview .rf-tips-lead { margin: 6px 0 14px; opacity: var(--rf-quiet); }
.rf-search-preview .rf-tips { display: grid; grid-template-columns: max-content 1fr max-content; gap: 7px 14px; align-items: baseline; font-size: .88rem; }
.rf-search-preview .rf-tips code { white-space: nowrap; }
.rf-search-preview .rf-tips button {
  font: inherit; font-size: var(--rf-tiny); padding: 1px 8px; border-radius: 5px; white-space: nowrap; cursor: pointer;
  color: inherit; background: transparent; border: 1px solid var(--ls-border-color, rgba(128,128,128,.25));
}
.rf-search-preview .rf-tips button:hover { background: rgba(128,128,128,.12); }
.rf-search-preview .rf-tips-notes { margin: 16px 0 0; padding-left: 1.1em; font-size: .85rem; opacity: var(--rf-quiet); }
.rf-search-preview .rf-tips-notes li { margin: 4px 0; list-style: disc; }
.rf-search-preview .rf-pv-block { position: relative; padding: 2px 4px 2px calc(18px + var(--rf-depth) * 20px); border-radius: 5px; cursor: text; }
.rf-search-preview .rf-pv-block::before {
  content: ''; position: absolute; left: calc(6px + var(--rf-depth) * 20px); top: .78em; width: 5px; height: 5px; border-radius: 50%;
  background: currentColor; opacity: var(--rf-faint);
}
.rf-search-preview .rf-pv-block:hover { background: rgba(128,128,128,.06); }
.rf-search-preview .rf-pv-text { overflow-wrap: anywhere; }
.rf-search-preview .rf-pv-text table { border-collapse: collapse; font-size: .85rem; margin: 2px 0; }
.rf-search-preview .rf-pv-text td { border: 1px solid var(--ls-border-color, rgba(128,128,128,.2)); padding: 2px 6px; }
.rf-search-preview .rf-pv-text tr:first-child td { font-weight: 600; }
.rf-search-preview .rf-pv-ref { text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor var(--rf-line-pct), transparent); text-underline-offset: 2px; }
.rf-search-preview .rf-pv-bref::before { content: '• '; opacity: var(--rf-faint); }
.rf-search-preview .rf-pv-tag { font-weight: 600; }
.rf-search-preview .rf-pv-blank { opacity: var(--rf-faint); font-style: italic; }
.rf-search-preview code { font-size: .88em; padding: 0 .25em; border-radius: 3px; background: rgba(128,128,128,.12); }
.rf-search-preview .rf-pv-edit {
  display: block; width: 100%; box-sizing: border-box; resize: none; overflow: hidden; font: inherit; line-height: inherit; color: inherit;
  background: rgba(128,128,128,.07); border: 0; outline: 1px solid var(--ls-border-color, rgba(128,128,128,.3)); border-radius: 4px; padding: 1px 4px; margin: -1px -4px;
}
/* Logseq rings a focused text box in its accent blue; the line being edited keeps only the faint grey edge. */
.rf-search-preview .rf-pv-edit:focus, .rf-search-preview .rf-pv-edit:focus-visible {
  outline: 1px solid var(--ls-border-color, rgba(128,128,128,.3)) !important; box-shadow: none !important; border: 0 !important;
}
/* Typed filters: Logseq's rows give way to the plugin's list; suggestions open under the box. */
.cp__cmdk[data-rf-filtering] .cp__cmdk-input-row + div > :not(.rf-filter-results) { display: none !important; }
.rf-filter-results { padding: 4px 8px 24px; }
.rf-filter-results .rf-fr-head { font-size: var(--rf-tiny); opacity: var(--rf-quiet); padding: 8px 10px 6px; }
.rf-filter-results .rf-fr-row { padding: 6px 10px; border-radius: 6px; cursor: pointer; }
.rf-filter-results .rf-fr-row[data-rf-current] { background: rgba(128,128,128,.12); }
.rf-filter-results .rf-fr-path { font-size: var(--rf-tiny); opacity: var(--rf-quiet); margin-left: 22px; }
.rf-filter-results .rf-fr-line { display: flex; align-items: baseline; gap: 8px; }
.rf-filter-results .rf-fr-icon { flex: 0 0 14px; text-align: center; opacity: var(--rf-faint); }
.rf-filter-results .rf-fr-text { flex: 1 1 auto; min-width: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.rf-filter-results .rf-fr-meta { flex: 0 0 auto; max-width: 40%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: var(--rf-tiny); opacity: var(--rf-faint); }
.rf-filter-results mark { background: none; color: inherit; font-weight: 600; }
.rf-filter-results .rf-fr-none { padding: 8px 10px; opacity: var(--rf-faint); }
.rf-filter-results .rf-fr-help { margin-top: 14px; padding: 8px 10px; font-size: var(--rf-tiny); opacity: var(--rf-faint); }
.rf-filter-suggest {
  position: absolute; left: 12px; z-index: 30; min-width: 300px; max-width: 75%; padding: 4px; border-radius: 8px;
  background: var(--ls-primary-background-color); color: var(--ls-primary-text-color);
  border: 1px solid var(--ls-border-color, rgba(128,128,128,.25)); box-shadow: 0 8px 24px rgba(0,0,0,.18);
}
.rf-filter-suggest .rf-fs-item { display: flex; gap: 16px; justify-content: space-between; align-items: baseline; padding: 5px 10px; border-radius: 5px; cursor: pointer; }
.rf-filter-suggest .rf-fs-item[data-rf-current], .rf-filter-suggest .rf-fs-item:hover { background: rgba(128,128,128,.14); }
.rf-filter-suggest .rf-fs-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-filter-suggest .rf-fs-hint, .rf-filter-suggest .rf-fs-keys { font-size: var(--rf-tiny); opacity: var(--rf-faint); white-space: nowrap; }
.rf-filter-suggest .rf-fs-keys { padding: 4px 10px 2px; }
`;

const settingsSchema = [
  { key: 'searchSidebarHeading', type: 'heading', title: 'Search in the right sidebar', default: null,
    description: 'Also in the command palette: search for “Search in right sidebar”. Changes here apply after you reload the plugin.' },
  { key: 'searchShortcut', type: 'string', title: 'Search in the right sidebar', default: 'mod+alt+f',
    description: 'Opens Logseq search in the right sidebar, where it stays while you open results. Shift-click a result to open it in the sidebar too.' },
  { key: 'sidebarSearchButton', type: 'boolean', title: 'Search button in the right sidebar', default: true,
    description: 'A Search button at the start of the right sidebar’s top row, next to Contents and Help.' },
  { key: 'searchHeading', type: 'heading', title: 'Search', default: null,
    description: 'Changes here apply after you reload the plugin.' },
  { key: 'tidySearch', type: 'boolean', title: 'Tidy the search window', default: true,
    description: 'Compact result rows, quieter group headings, a soft grey wash on matches instead of yellow highlights, and faded [[ ]] and ** markup in results. Turn off to get Logseq’s original look.' },
  { key: 'roomySearch', type: 'boolean', title: 'Roomier search window', default: true,
    description: 'A larger search window with bigger text, more space between results and groups, and up to three lines of each block. The page and parent blocks above a result are named in full, with a small bullet before each parent block. Results fade in as you type, “Show more” and key shortcuts appear only under the pointer, and the key hints at the bottom are hidden. Turn off to get Logseq’s normal size.' },
  { key: 'searchDetails', type: 'boolean', title: 'Say more about each search result', default: true,
    description: 'At the right of each result: what it is (its tags, or Page) and when it was last edited. Under a result that is only a heading, such as “Timeline”, the first line beneath it and how many more there are. When the searched words are not in the text shown, where they were found (a property, a tag, further into the text).' },
  { key: 'groupSearch', type: 'boolean', title: 'Put search results page by page', default: true,
    description: 'Results from the same page sit together, under the page if it is among the results, with the page name shown once. The arrow keys follow this order.' },
  { key: 'searchPreview', type: 'boolean', title: 'Preview the selected result', default: true,
    description: 'A panel at the right of the search window shows the selected result with its blocks. Click a line to edit it; changes are saved as you type. “Open” and “Open in sidebar” are at the top of the panel.' },
  { key: 'searchPreviewEditor', type: 'boolean', title: 'Preview: edit with Logseq\'s own editor (trial)', default: false,
    description: 'The preview panel shows the result through Logseq\'s own page editor (an experimental part of Logseq\'s plugin kit): the real page, with its properties and references, and you can click a line and type. Logseq turns off its keyboard shortcuts while the search window is open, so Enter, Tab and the other editing keys act as in a plain text box there. Off: the panel\'s simpler line editor.' },
  { key: 'searchFilters', type: 'boolean', title: 'Filter search with codes', default: true,
    description: 'Type codes in the search box to narrow what is found: #tag, in:page, p:name or p:name=value (for a property; property: works too), is:task, todo, done, page, journal or block, and edited:today, week, month or a count of days such as 3d. A list under the box suggests names as you type; Tab or Enter takes one. Names with spaces go in [[ ]]. With a code, every other word must be in the text. A bar along the bottom of the search window names the codes (click one to add it); type ? or click “? More tips” for a short guide. Shift+Enter or Shift-click opens a result in the right sidebar.' },
];
const setting = shared.settingReader(settingsSchema);
// Settings that only take effect when the plugin starts: all of them.
const RELOAD_SETTINGS = settingsSchema.filter(item => item.type !== 'heading').map(item => item.key);

function main() {
  // The plugin's one beforeunload callback (in main.js) runs this part's clean-up.
  ({ watchDom, watchDomEarly } = window.refinementCore);
  takeOverFromEarlierCopy();
  logseq.provideStyle({ key: 'calmer-search-tokens', style: tokensCss });
  if (setting('tidySearch')) {
    logseq.provideStyle({ key: 'personal-db-search', style: searchCss });
    startSearchCleanup();
  }
  if (setting('roomySearch')) logseq.provideStyle({ key: 'personal-db-search-roomy', style: roomySearchCss });
  startSearchExtras();
  onUnload(unmountPreviewEditor);
  // Registered early: Logseq draws the piece that hosts its editor the next time it redraws the app.
  if (setting('searchPreviewEditor')) registerPreviewHost();
  if (setting('sidebarSearchButton')) startSidebarSearchButton();
  onUnload(logseq.onSettingsChanged((now, before) => {
    // Logseq rewrites every setting when the plugin starts, so a setting with no earlier value is a
    // default being filled in, not a change.
    if (RELOAD_SETTINGS.some(key => before && key in before && now?.[key] !== before[key])) notify('Reload the Refinements plugin to apply this change', 'info');
  }));
  const binding = setting('searchShortcut').trim().toLowerCase();
  logseq.App.registerCommandPalette({ key: 'search-in-sidebar', label: 'Search in right sidebar', ...(binding ? { keybinding: { binding } } : {}) }, searchInSidebar);
}
(window.refinementParts ||= []).push({ name: 'search', schema: settingsSchema, start: main, stop: runUnloadTasks });
})();
