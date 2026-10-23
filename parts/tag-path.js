/* Loaded by main.js after parts/two-way.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* Where a tag sits, in its page's title corner (0.4.328, docs/LAYERS.md layer 4, the first piece of the page plan; the
   owner: "All I care about is hierarchy of tags"). On a tag's own page, the right end of the title row reads the tag and
   the tags above it, nearest first: "Consultation / Occurrence", "Doctor / Person / Entity", each name opening its
   page (Shift: in the sidebar). That end is where Logseq keeps a page's own tags and fades them in only under the
   pointer; the chain stays, and takes their place there, so nothing above or below it moves (a line of its own under
   the title would push the page down one line when it arrived). A long chain is cut at the far end, never wrapped.
   A tag with no parent of yours shows nothing: its chain would be its own name. Drawn with the kit's tag (no #, mono). */
const shared = window.refinementShared;
const { host, openEntity, tag } = shared;
const { warnOnce, onUnload, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (tag path): ', leaves: { elements: '.rf-tag-path' } });
let model, sendStyle, watchDom, onPageChange, onDatabaseChange, onSettingsChange;
const take = (core, names) => shared.take(core, names, warnOnce);

const settingsSchema = [
  { key: 'tagPathHeading', type: 'heading', group: 'reading', rank: 1, title: 'Tag pages', default: null,
    legend: 'Where a tag sits, in its title’s corner',
    zone: '<div><b>Consultation</b> &nbsp; <span class="m">Consultation / Occurrence</span></div>',
    description: 'Changes here apply right away.' },
  { key: 'tagPathInTitle', type: 'boolean', title: 'The tags above a tag, beside its title', default: true,
    description: 'On a tag’s own page, the right end of the title row reads the tag and the tags it sits under, nearest first: “Consultation / Occurrence”. Each name opens its page; Shift-click opens it in the right sidebar. It stays where Logseq shows a page’s tags only under the pointer, so the page does not move. A tag that sits under none of yours shows nothing there.' },
];
const setting = shared.settingReader(settingsSchema);

const css = `
/* The chain in the title row's right end (Logseq's .ls-block-right, where it fades in a page's tags under the pointer). */
/* Lowered as Logseq lowers its own tags there (.ls-page-title .block-tags { margin-top: 17px }), level with the title's words. */
.rf-tag-path { display: inline-block; align-self: flex-start; max-width: 24em; margin: 17px 0 0 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; line-height: 1.6; vertical-align: middle; }
.rf-tag-path .rf-sep { margin: 0 .35em; opacity: .4; }
.rf-tag-path .rf-also { opacity: .5; font-size: 12px; }
/* Logseq's own faded tags on a tag page (its Tag) give way to the chain. */
.ls-block-right:has(> .rf-tag-path) > .block-tags { display: none; }
`;

const state = { uuid: '', loading: '', path: null, box: null, key: '', version: 0, timer: 0 };
// The page shown in the main view, by its title's block (the page Logseq names a moment after a change can still be the old one).
function shownTitle(doc) {
  const titles = [...(model.pageTitles?.(doc) || [])].filter(t => t.querySelector('.ls-block[blockid]'));
  return titles.length === 1 ? titles[0] : null;
}
async function load(uuid) {
  const version = ++state.version;
  let path = null;
  try { path = uuid ? await model.tagChain(uuid) : null; } catch (error) { warnOnce('could not read where this tag sits', error); }
  if (version !== state.version) return;
  Object.assign(state, { uuid, path, loading: '' });
  draw(host());
}
const later = (uuid, ms) => { clearTimeout(state.timer); state.timer = setTimeout(() => load(uuid), ms); };

function build(doc, path) {
  const parts = [];
  path.chain.forEach((t, i) => {
    if (i) parts.push(shared.el(doc, 'span', { class: 'rf-sep', 'aria-hidden': 'true' }, '/'));
    parts.push(tag(doc, t.title, { href: '#', 'data-uuid': t.uuid, title: `Open ${t.title} (Shift: in the sidebar)` }));
  });
  if (path.others.length) {
    parts.push(shared.el(doc, 'span', { class: 'rf-also' }, ' · also '));
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
  if (!doc) return;
  const title = shownTitle(doc);
  const uuid = title?.querySelector('.ls-block[blockid]')?.getAttribute('blockid') || '';
  if (!uuid) { Object.assign(state, { uuid: '', path: null }); return remove(); }
  // Another page: read its tags once (the screen changes many times while Logseq draws it).
  if (uuid !== state.uuid) { remove(); if (state.loading !== uuid) { state.loading = uuid; later(uuid, 0); } return; }
  const path = state.path;
  const row = title.querySelector('.is-page-title-row');
  if (!setting('tagPathInTitle') || !row || !path || path.chain.length + path.others.length < 2) return remove();
  const spot = row.querySelector('.ls-block-right') || row;
  let box = state.box;
  if (!box || box.ownerDocument !== doc) {
    box = state.box = shared.el(doc, 'span', { class: 'rf-tag-path', click: open, mousedown: keep, pointerdown: keep });
    state.key = '';
  }
  const key = JSON.stringify(path);
  if (key !== state.key) { state.key = key; box.replaceChildren(...build(doc, path)); }
  if (box.parentElement !== spot) spot.append(box);
}

let stopped = false;
function start() {
  ({ sendStyle, watchDom, onPageChange, onDatabaseChange, onSettingsChange } = take(window.refinementCore, ['sendStyle', 'watchDom', 'onPageChange', 'onDatabaseChange', 'onSettingsChange', 'tagChain', 'pageTitles']));
  model = window.refinementCore.provided; // the graph through the model's doors
  stopped = false;
  sendStyle('refinement-tag-path', css);
  watchDom(function drawTagPath(doc) { if (!stopped) draw(doc); });
  onPageChange(() => { if (!stopped) draw(host()); });
  // A tag put under another, or renamed, shows at once.
  onDatabaseChange(() => { if (!stopped && state.uuid) later(state.uuid, 900); });
  onSettingsChange((now, before) => { if (!stopped && now?.tagPathInTitle !== before?.tagPathInTitle) draw(host()); });
  onUnload(() => { stopped = true; clearTimeout(state.timer); remove(); state.box = null; });
}
(window.refinementParts ||= []).push({ name: 'tag-path', schema: settingsSchema, start, stop: runUnloadTasks });
})();
