/* Loaded by main.js after parts/two-way.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* Where a tag sits, in its page's title corner (0.4.328, docs/LAYERS.md layer 4, the first piece of the page plan; the
   owner: "All I care about is hierarchy of tags"). On a tag's own page, the right end of the title row reads the tags
   above it, nearest first: Consultation reads "Occurrence", Doctor "Person / Entity" (its own name is the title,
   0.4.331), each name opening its page (Shift: in the sidebar). That end is where Logseq keeps a page's own tags and fades them in only under the
   pointer; the chain stays, and takes their place there, so nothing above or below it moves (a line of its own under
   the title would push the page down one line when it arrived). A long chain is cut at the far end, never wrapped.
   Drawn in the same frame as the title, from an index of every tag (0.4.331, measured with the tour).
   A tag with no parent of yours reads nothing, the corner kept so Logseq's faded #Tag does not stand in (0.4.330, the
   owner on Entity: "loses its tag and #tag just appears"). Drawn with the kit's tag (no #, mono).
   A page with tags of its own (0.4.329, the owner: "can this be applied to pages with the tag?") reads each tag's whole
   chain: Dr. Mei Chen, "Doctor / Person / Entity", where Logseq fades in #Doctor; two tags are kept apart by a dot.
   Logseq's kinds of page (Page, Journal) are not tags of yours and show nothing. */
const shared = window.refinementShared;
const { host, openEntity, tag } = shared;
const { warnOnce, onUnload, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (tag path): ', leaves: { elements: '.rf-tag-path' } });
let model, sendStyle, watchDom, watchDomEarly, addsElements, onPageChange, onDatabaseChange, onSettingsChange;
const take = (core, names) => shared.take(core, names, warnOnce);

const settingsSchema = [
  { key: 'tagPathHeading', type: 'heading', group: 'reading', rank: 1, title: 'Tags beside the title', default: null,
    legend: 'A page’s tags and the tags above them, in its title’s corner',
    zone: '<div><b>Dr. Mei Chen</b> &nbsp; <span class="m">Doctor / Person / Entity</span></div>',
    description: 'Changes here apply right away.' },
  { key: 'tagPathInTitle', type: 'boolean', title: 'A page’s tags and the tags above them, beside its title', default: true,
    description: 'The right end of a page’s title row reads its tag and the tags that tag sits under, nearest first: “Doctor / Person / Entity” on Dr. Mei Chen; on a tag’s own page, only the tags above it, “Occurrence” on Consultation. Each name opens its page; Shift-click opens it in the right sidebar. It stays where Logseq shows a page’s tags only under the pointer, so the page does not move.' },
];
const setting = shared.settingReader(settingsSchema);

const css = `
/* The chain in the title row's right end (Logseq's .ls-block-right, where it fades in a page's tags under the pointer). */
/* Lowered as Logseq lowers its own tags there (.ls-page-title .block-tags { margin-top: 17px }), level with the title's words. */
.rf-tag-path { display: inline-block; align-self: flex-start; max-width: 24em; margin: 17px 0 0 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; line-height: 1.6; vertical-align: middle; }
.rf-tag-path .rf-sep { margin: 0 .35em; opacity: .4; }
.rf-tag-path .rf-also { opacity: .5; font-size: 12px; }
/* Logseq's own faded tags (a tag page's Tag, a page's #Doctor) give way to the chain. */
.ls-block-right:has(> .rf-tag-path) > .block-tags { display: none; }
`;

const state = { index: null, box: null, key: '', timer: 0, loading: null };
// The page shown in the main view, by its title's block (the page Logseq names a moment after a change can still be the old one).
function shownTitle(doc) {
  const titles = [...(model.pageTitles?.(doc) || [])].filter(t => t.querySelector('.ls-block[blockid]'));
  return titles.length === 1 ? titles[0] : null;
}
/* The chains come from an index of every tag, read once and again when the graph changes (0.4.331), so the corner is
   drawn in the same frame as the title: Logseq draws the page's own tags there (faded) with the title, each link
   carrying its tag's uuid, and a tag page's own uuid is on its title block. Before, the corner was read from the graph
   after each page change and came 100 to 300 ms after the title, moving the row's right end once on every page. */
async function loadIndex() {
  const loading = state.loading = model.tagChainIndex();
  try {
    const index = await loading;
    if (state.loading !== loading || stopped) return;
    state.index = index;
    draw(host());
  } catch (error) { warnOnce('could not read where the tags sit', error); }
}
const later = ms => { clearTimeout(state.timer); state.timer = setTimeout(loadIndex, ms); };
// What the corner reads. A tag page: the tags above it only, since its own name is the title (0.4.331, the owner:
// "redundant to have the name of the tag on the tag hierarchy"); at the top, nothing, the corner kept so Logseq's faded
// #Tag does not stand in. A page with tags: each tag's whole chain, as the title row shows them. Logseq's kinds of page
// (Page, Journal, Tag …) say what a page is, not a tag of yours.
function groupsOf(index, title, uuid) {
  const groups = [], own = index.byUuid(uuid);
  if (own && !index.isPageKind(uuid)) { groups.tagPage = true; if (own.chain.length > 1 || own.others.length) groups.push({ chain: own.chain.slice(1), others: own.others }); return groups; }
  for (const link of title.querySelectorAll('.is-page-title-row .ls-block-right .block-tags a.tag[data-uuid]')) {
    const chain = index.byUuid(link.getAttribute('data-uuid'));
    if (chain && !index.isPageKind(link.getAttribute('data-uuid')) && !groups.includes(chain)) groups.push(chain);
  }
  return groups;
}
function build(doc, groups) {
  const parts = [];
  groups.forEach((path, n) => { if (n) parts.push(shared.el(doc, 'span', { class: 'rf-sep', 'aria-hidden': 'true' }, '·')); parts.push(...buildOne(doc, path)); });
  return parts;
}
function buildOne(doc, path) {
  const parts = [];
  path.chain.forEach((t, i) => {
    if (i) parts.push(shared.el(doc, 'span', { class: 'rf-sep', 'aria-hidden': 'true' }, '/'));
    parts.push(tag(doc, t.title, { href: '#', 'data-uuid': t.uuid, title: `Open ${t.title} (Shift: in the sidebar)` }));
  });
  if (path.others.length) {
    parts.push(shared.el(doc, 'span', { class: 'rf-also' }, path.chain.length ? ' · also ' : 'also '));
    path.others.forEach((t, i) => { if (i) parts.push(', '); parts.push(tag(doc, t.title, { href: '#', 'data-uuid': t.uuid, title: `Open ${t.title} (Shift: in the sidebar)` })); });
  }
  return parts;
}
// Logseq's title is a block: a press in its row would put it in edit, so the chain keeps its presses to itself.
const keep = event => event.stopPropagation();
function open(event) {
  event.preventDefault(); event.stopPropagation();
  const link = event.target.closest('a[data-uuid]');
  if (link) openEntity(link.getAttribute('data-uuid'), event.shiftKey);
}
function remove() { state.box?.remove(); }
function draw(doc) {
  if (!doc || !state.index) return;
  const title = shownTitle(doc);
  const uuid = title?.querySelector('.ls-block[blockid]')?.getAttribute('blockid') || '';
  const row = title?.querySelector('.is-page-title-row');
  const groups = uuid && row && setting('tagPathInTitle') ? groupsOf(state.index, title, uuid) : [];
  if (!groups.length && !groups.tagPage) return remove();
  const spot = row.querySelector('.ls-block-right') || row;
  let box = state.box;
  if (!box || box.ownerDocument !== doc) {
    box = state.box = shared.el(doc, 'span', { class: 'rf-tag-path', click: open, mousedown: keep, pointerdown: keep });
    state.key = '';
  }
  const key = JSON.stringify(groups);
  if (key !== state.key) { state.key = key; box.replaceChildren(...build(doc, groups)); }
  if (box.parentElement !== spot) spot.append(box);
}
// Before the screen is drawn, whenever something was added (the title row with its tags); the frame pass catches the rest.
const drawEarly = (doc, records) => { if (addsElements(records)) draw(doc); };

let stopped = false;
function start() {
  ({ sendStyle, watchDom, watchDomEarly, addsElements, onPageChange, onDatabaseChange, onSettingsChange } = take(window.refinementCore, ['sendStyle', 'watchDom', 'watchDomEarly', 'addsElements', 'onPageChange', 'onDatabaseChange', 'onSettingsChange', 'tagChainIndex', 'pageTitles']));
  model = window.refinementCore.provided; // the graph through the model's doors
  stopped = false;
  sendStyle('refinement-tag-path', css);
  watchDomEarly(drawEarly);
  watchDom(function drawTagPath(doc) { if (!stopped) draw(doc); });
  onPageChange(() => { if (!stopped) draw(host()); });
  // A tag put under another, or renamed, shows soon after.
  onDatabaseChange(() => { if (!stopped) later(900); });
  onSettingsChange((now, before) => { if (!stopped && now?.tagPathInTitle !== before?.tagPathInTitle) draw(host()); });
  onUnload(() => { stopped = true; clearTimeout(state.timer); state.loading = null; remove(); state.box = null; });
  loadIndex();
}
(window.refinementParts ||= []).push({ name: 'tag-path', schema: settingsSchema, start, stop: runUnloadTasks });
})();
