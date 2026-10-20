/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Proposals, piece 1 (0.4.197): the shadow under the bullet being written. Rebuilt on the foundation and the
   model; the old proposals part (parts/proposals.js, resting) pencilled values into the pills and took them with Tab.

   While you write a bullet, a faint line under it shows what the plugin is sure of and would fill in when you
   leave the bullet (Enter, a click elsewhere, the arrows): nothing is written before that, and the bar at the
   bottom offers Undo after. Escape clears the shadow, and that bullet is left alone for good. The words typed
   are never changed. Only the sure pieces are in this piece; guesses (plain words, a tag from the siblings) come
   later and will need a click.

   The record a bullet belongs to is the bullet itself when its tags give it properties, else its parent when the
   parent's do (notes under an appointment belong to the appointment). The sure pieces, for the record's empty
   properties only:
   - a page linked in the words ([[Dr. Mei Chen]]) that fits a link property of the record's tags (doctor takes
     #Doctor); one link per property, and nothing when a one-value property would get two (two doctors named: quiet);
   - the page the record is written on, when its tag fits (a consultation written on Dr. Mei Chen's page), once;
   - the journal day, for an empty "date" of a record written on a journal page.
   Left for a later piece, as guesses taken by a click (the second reading): a linked page with no tag yet given the tag
   a property takes (a topic page would be made a person), and the parent record's values (a follow-up nested under
   its first visit would get that visit's date). Writes only in the graphs named in its setting, as every part that
   writes to notes does. */
const shared = window.refinementShared;
const { host, notify, showUndoBar, graphNamedIn } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements (proposals): ', leaves: { elements: '.refinement-shadow' } });
let dsQuery, UUID, propSchema, propPages, bare, pick, idOf, sendStyle, titleOf;
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };

const settingsSchema = [
  { key: 'shadowHeading', type: 'heading', group: 'writing', rank: 1, title: 'Proposals', default: null,
    legend: 'What the plugin is sure of, shown under the bullet you write and filled in when you leave it',
    zone: '<div><span class="m">doctor:</span> Dr. Mei Chen <span class="m">· date:</span> Oct 20 <span class="m"><span class="cap">enter</span> takes · <span class="cap">esc</span> clears</span></div>',
    description: 'Changes here apply right away.' },
  { key: 'shadowProposals', type: 'boolean', title: 'Proposals under the bullet', default: true,
    description: 'While you write a bullet, a faint line under it shows what the plugin is sure of from your words, the page, the parent bullet and the journal day: a linked doctor for the doctor property, the day for the date. Leaving the bullet (Enter, a click elsewhere, the arrows) fills those in, with Undo in the bar at the bottom. Escape clears the line, and that bullet is then left alone. Your words are never changed. Applies at once.' },
  { key: 'shadowGraphs', type: 'string', title: 'Only in these graphs', default: '',
    description: 'The graphs the proposals may write in, separated by commas (the plugin’s settings are shared by every graph). Empty: none. Applies at once.' },
];
const setting = shared.settingReader(settingsSchema);

const esc = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayText = day => day ? `${MONTHS[Math.floor(day / 100) % 100 - 1]} ${day % 100}` : '';
// A pulled map's values under a property, by its ident, whatever the key's spelling; [] when the property is empty.
function valuesOf(node, ident) {
  for (const key of Object.keys(node || {})) if (bare(key) === ident) { const v = node[key]; return (Array.isArray(v) ? v : v == null ? [] : [v]).map(idOf).filter(id => id != null); }
  return [];
}
// The properties the tags give, own first, then what they inherit, without repeats.
function fieldsOfTags(tagIds, schema) {
  const seen = new Set(), fields = [], queue = [...tagIds];
  while (queue.length) {
    const c = queue.shift();
    if (seen.has(c)) continue;
    seen.add(c);
    for (const p of schema.classProps.get(c) || []) { const prop = schema.byId.get(p); if (prop && !fields.includes(prop)) fields.push(prop); }
    queue.push(...(schema.parentsOf.get(c) || []));
  }
  return fields;
}
// A page fits a link property when one of its tags, or a tag that tag extends, is a tag the property takes.
function fits(page, classIds, schema) {
  const seen = new Set(), queue = page.tags.map(t => t.id);
  while (queue.length) {
    const c = queue.shift();
    if (seen.has(c)) continue;
    seen.add(c);
    if (classIds.has(c)) return true;
    queue.push(...(schema.parentsOf.get(c) || []));
  }
  return false;
}
// A page with no tag of yours (only Logseq's own, such as Page).
const untagged = page => !page.isTag && !page.tags.some(t => !/^logseq\.class\//.test(t.ident));

/* What the graph holds, remembered for the session by the model (read again when the graph changes): the
   properties with their tags, every page with its tags, and the pages by name and by uuid. */
let context = null;
async function contextFor() {
  const [schema, pages] = await Promise.all([propSchema(), propPages()]);
  if (context && context.schema === schema && context.pages === pages) return context;
  const byKey = new Map(), byId = new Map();
  for (const page of pages) { byKey.set(page.lower, page); if (page.uuid) byKey.set(page.uuid.toLowerCase(), page); byId.set(page.id, page); }
  // Tag names, longest first, for "#Symptom log" written without brackets.
  const tagNames = pages.filter(p => p.isTag).map(p => p.lower).sort((a, b) => b.length - a.length);
  return (context = { schema, pages, byKey, byId, tagNames });
}
// The bullet in edit with what the rules read: its tags and values, its parent (and the parent's), its page.
const PAGE_PULL = '[:db/id :block/uuid :block/title :block/journal-day {:block/tags [:db/id]}]';
const BLOCK_PULL = `[* {:block/tags [:db/id]} {:block/page ${PAGE_PULL}} {:block/parent [* {:block/tags [:db/id]} {:block/page [:db/id]} {:block/parent [* {:block/tags [:db/id]} {:block/page [:db/id]}]}]}]`;
async function pullBlock(uuid) {
  if (!UUID.test(uuid)) return null;
  const [[b] = []] = await dsQuery(`[:find (pull ?b ${BLOCK_PULL}) :where [?b :block/uuid #uuid "${uuid}"]]`);
  return b || null;
}
// The pages linked in the words ([[uuid]] as saved, [[Name]] in the text box), in order, each once; and the tags
// written in the words (#Consultation, #[[Symptom log]]), as tag ids.
const LINK = /\[\[([^\[\]]+)\]\]/g, TAG = /(?:^|\s)#(?:\[\[([^\]]+)\]\]|([^\s#\[\]]+))/g;
function inWords(text, ctx) {
  const links = [], tags = [];
  const words = String(text || '');
  for (const [, key] of words.matchAll(LINK)) { const page = ctx.byKey.get(key.trim().toLowerCase()); if (page && !links.includes(page)) links.push(page); }
  const lower = words.toLowerCase();
  for (const m of words.matchAll(TAG)) {
    // The longest tag name that follows the #: Logseq shows a two-word tag as "#Symptom log", no brackets.
    const at = m.index + m[0].indexOf('#') + 1, rest = lower.slice(at);
    const name = m[1] ? m[1].trim().toLowerCase() : (ctx.tagNames || []).find(t => rest.startsWith(t) && !/[\w]/.test(rest.charAt(t.length))) || m[2].toLowerCase();
    const page = ctx.byKey.get(name);
    if (page?.isTag && !tags.includes(page.id)) tags.push(page.id);
  }
  return { links, tags };
}
const isBlock = node => !!(node && pick(node, 'block/page'));
const cleanWords = text => String(text || '').replace(/#?\[\[([^\[\]]+)\]\]/g, (m, key) => /^[0-9a-f-]{36}$/i.test(key) ? '' : key).replace(/\s+/g, ' ').trim();
// Logseq keeps the tags typed at the end of a bullet apart from its words, so they are left out when the saved words are compared.
const plainWords = text => cleanWords(String(text || '').replace(TAG, ' ')).toLowerCase();

/* The rules. b is the bullet in edit (pulled), text its words (the text box, or the saved title). Returns the
   record the pieces are for and the pieces: { ident, prop, kind: 'node' | 'day', ids, shown, tagPage?, day?, journalId?, how }. */
function piecesFor(b, text, ctx) {
  const { schema } = ctx;
  const { links, tags: typedTags } = inWords(text, ctx);
  const ownTags = [...new Set([...(pick(b, 'block/tags') || []).map(idOf), ...typedTags])];
  const parent = pick(b, 'block/parent');
  let record = b, fields = fieldsOfTags(ownTags, schema);
  if (!fields.length && isBlock(parent)) {
    const parentFields = fieldsOfTags((pick(parent, 'block/tags') || []).map(idOf), schema);
    if (parentFields.length) { record = parent; fields = parentFields; }
  }
  const pieces = [];
  if (!fields.length) return { record, pieces };
  const recordTags = record === b ? ownTags : (pick(record, 'block/tags') || []).map(idOf);
  const page = pick(b, 'block/page'), journalDay = Number(pick(page, 'block/journal-day') || 0);
  const pageTags = new Set((pick(page, 'block/tags') || []).map(idOf));
  const pageAsPage = page && !journalDay ? { id: idOf(page), uuid: String(pick(page, 'block/uuid') ?? ''), title: String(pick(page, 'block/title') ?? ''), tags: [...pageTags].map(id => ({ id })) } : null;
  const held = new Set(fields.flatMap(prop => valuesOf(record, prop.ident)));
  const free = links.filter(p => !held.has(p.id)), used = new Set();
  let pageUsed = false;
  void untagged;
  // The most particular property claims a link first (doctor, taking #Doctor, before with, taking #Person), and a
  // property kept quiet by two names keeps them: two doctors named do not spill into "with" (found by the scorer).
  const depth = id => { let d = 0, q = [id]; const seen = new Set(); while (q.length) { const c = q.shift(); if (seen.has(c)) continue; seen.add(c); for (const p of schema.parentsOf.get(c) || []) { q.push(p); } d = Math.max(d, seen.size); } return d; };
  const particular = prop => prop.type === 'node' ? Math.max(0, ...prop.classes.map(c => depth(c.id))) : -1;
  const ordered = fields.map((prop, i) => ({ prop, i, rank: particular(prop) })).sort((a, b) => b.rank - a.rank || a.i - b.i).map(x => x.prop);
  for (const prop of ordered) {
    const filled = valuesOf(record, prop.ident).length > 0;
    if (prop.type === 'node' && prop.classes.length) {
      const classIds = new Set(prop.classes.map(c => c.id));
      const fitting = free.filter(p => !used.has(p) && fits(p, classIds, schema));
      // A filled property still claims the links it takes: a second doctor named when doctor is filled does not become "with".
      if (fitting.length) {
        for (const p of fitting) used.add(p);
        if (!filled && (prop.many || fitting.length === 1)) pieces.push({ ident: prop.ident, prop, kind: 'node', ids: fitting.map(p => p.id), shown: fitting.map(p => p.title).join(', '), how: 'linked' });
        continue; // two names for one place: quiet, and the names are spoken for
      }
      if (filled) continue;
      // The page fills one property only, the most particular that takes it (doctor, not also "with"; seen in the app).
      if (pageAsPage && !pageUsed && pageAsPage.id !== idOf(record) && fits(pageAsPage, classIds, schema)) { pageUsed = true; pieces.push({ ident: prop.ident, prop, kind: 'node', ids: [pageAsPage.id], shown: pageAsPage.title, how: 'page' }); continue; }
    } else if (!filled && prop.type === 'date' && prop.lower === 'date') {
      // The journal day only for tags whose nodes are dated the day they are written, as the graph shows (symptom logs
      // are; appointments are often written ahead, so the day would be wrong; found by the scorer).
      if (journalDay && datedWhenWritten(recordTags, ctx)) pieces.push({ ident: prop.ident, prop, kind: 'day', ids: [idOf(page)], day: journalDay, journalId: idOf(page), shown: dayText(journalDay), how: 'day' });
    }
  }
  pieces.sort((a, b) => fields.indexOf(a.prop) - fields.indexOf(b.prop)); // shown in the order the tag gives them
  return { record, pieces };
}
// Journal days by page id, for the parent's date, and for each tag how many of its dated nodes written on a journal
// page carry that page's day (a small look-up kept with the context).
async function daysFor(ctx) {
  if (ctx.days) return ctx;
  ctx.days = new Map((await dsQuery('[:find ?p ?d :where [?p :block/journal-day ?d]]')).map(([p, d]) => [p, Number(d)]));
  ctx.dated = new Map();
  const rows = await dsQuery('[:find ?t ?same (count ?b) :where [?b :block/tags ?t] [?b :user.property/date ?dp] [?dp :block/journal-day ?d] [?b :block/page ?pg] [?pg :block/journal-day ?pd] [(= ?d ?pd) ?same]]').catch(() => []);
  for (const [t, same, count] of rows) { const n = ctx.dated.get(t) || { same: 0, other: 0 }; n[same ? 'same' : 'other'] += Number(count) || 0; ctx.dated.set(t, n); }
  return ctx;
}
// Sure only with evidence: at least 5 such nodes under the tag (or a tag it extends), and 19 in 20 dated the day written.
const DATED_LEAST = 5, DATED_SHARE = .95;
function datedWhenWritten(tagIds, ctx) {
  let same = 0, other = 0;
  for (const id of tagIds) { const n = ctx.dated?.get(id); if (n) { same += n.same; other += n.other; } }
  return same + other >= DATED_LEAST && same / (same + other) >= DATED_SHARE;
}

/* The bullet in edit: its shadow is worked out 40 ms after each key from the text box and one small pull of the
   block, drawn under the text box, and taken when the bullet is left unless Escape cleared it. */
const state = window.refinementShadow = { live: null, el: null, times: [] };
const OFF_KEY = 'refinementShadowOff';
let off = new Set();
const readOff = () => { try { off = new Set(JSON.parse(host().defaultView.localStorage.getItem(OFF_KEY) || '[]')); } catch { off = new Set(); } };
function dismiss(uuid) {
  off.add(uuid);
  while (off.size > 500) off.delete(off.values().next().value);
  try { host().defaultView.localStorage.setItem(OFF_KEY, JSON.stringify([...off])); } catch { /* kept for this session */ }
}
const editingBox = el => (el?.matches?.('textarea') && el.closest('.ls-block[blockid]')) ? el : null;
const uuidOf = box => box.closest('.ls-block[blockid]')?.getAttribute('blockid') || '';
let liveTimer = 0, liveVersion = 0;
async function allowed() {
  return setting('shadowProposals') && await graphNamedIn(setting('shadowGraphs'));
}
async function compute(box) {
  const uuid = uuidOf(box);
  if (!uuid || off.has(uuid)) { state.live = null; hide(); return; }
  const version = ++liveVersion, text = box.value, t0 = performance.now();
  try {
    if (!await allowed()) { state.live = null; hide(); return; }
    const ctx = await daysFor(await contextFor());
    const b = await pullBlock(uuid);
    if (version !== liveVersion) return;
    if (!b) { state.live = null; hide(); return; }
    const { record, pieces } = piecesFor(b, text, ctx);
    state.times.push(Math.round(performance.now() - t0)); if (state.times.length > 50) state.times.shift();
    if (!pieces.length) { state.live = null; hide(); return; }
    state.live = { uuid, text, recordUuid: String(pick(record, 'block/uuid') ?? ''), forWords: record === b ? '' : cleanWords(String(pick(record, 'block/title') ?? '')), pieces, at: Date.now() };
    draw(box);
  } catch (error) { warnOnce('the shadow could not be worked out', error); }
}
function onInput(event) {
  const box = editingBox(event.target);
  if (!box) return;
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => compute(box), 40);
}
function onFocusIn(event) {
  const box = editingBox(event.target);
  if (box) { clearTimeout(liveTimer); liveTimer = setTimeout(() => compute(box), 40); }
}
// The bullet left: the shadow is taken, once Logseq has saved the words (a link typed a moment ago is in the saved
// title only after that).
function onFocusOut(event) {
  const box = editingBox(event.target);
  if (!box || !state.live || state.live.uuid !== uuidOf(box)) return;
  const live = state.live;
  setTimeout(() => {
    const now = editingBox(host().activeElement);
    if (now && uuidOf(now) === live.uuid) return;
    if (state.live === live) { state.live = null; hide(); takeShadow(live).catch(error => { warnOnce('the shadow could not be taken', error); notify('The proposed values could not be filled in', 'warning'); }); }
  }, 120);
}
// Escape clears the shadow, and the bullet is left alone from then on; the caret stays (a second Escape is Logseq's).
function onKey(event) {
  if (event.key !== 'Escape' || event.isComposing || !state.live) return;
  const box = editingBox(event.target);
  if (!box || uuidOf(box) !== state.live.uuid) return;
  if (box.ownerDocument.querySelector('#ui__ac, .absolute-modal, [data-editor-popup-ref]')) return;
  event.preventDefault(); event.stopImmediatePropagation();
  dismiss(state.live.uuid);
  state.live = null;
  hide();
}
// The saved words and the typed ones, links left out (a saved link is an id, a typed one a name, and a day's or a
// block's name is not in the page list) but counted, and tags left out (Logseq keeps them apart from the words).
const linksOut = text => { const found = String(text || '').match(LINK) || []; return { n: found.length, words: plainWords(String(text || '').replace(LINK, ' ')) }; };
const sameWords = (saved, text) => { const a = linksOut(saved), b = linksOut(text); return a.n === b.n && a.words === b.words; };
async function takeShadow(live) {
  if (!await allowed() || off.has(live.uuid)) return;
  const ctx = await daysFor(await contextFor());
  let b = null;
  let saved = false;
  for (let tries = 0; tries < 12 && !saved; tries++) {
    b = await pullBlock(live.uuid);
    if (!b) return; // the bullet is gone
    saved = sameWords(pick(b, 'block/title'), live.text);
    if (!saved) await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!saved) return; // the words changed after the shadow was drawn, or never got saved: nothing is written (second reading)
  const { record, pieces } = piecesFor(b, live.text, ctx);
  const recordUuid = String(pick(record, 'block/uuid') ?? '');
  if (!pieces.length || !UUID.test(recordUuid)) return;
  const written = [];
  for (const piece of pieces) {
    try {
      if (piece.tagPage) for (const uuid of piece.tagPage.uuids) await logseq.Editor.addBlockTag(uuid, piece.tagPage.tag.uuid);
      if (piece.kind === 'day') await logseq.Editor.upsertBlockProperty(recordUuid, piece.ident, piece.journalId);
      else if (piece.prop.many) await logseq.Editor.upsertBlockProperty(recordUuid, piece.ident, piece.ids, { entityId: true, reset: true });
      else await logseq.Editor.upsertBlockProperty(recordUuid, piece.ident, piece.ids[0], { entityId: true });
      written.push(piece);
    } catch (error) { warnOnce(`${piece.prop.title} could not be filled in`, error); notify(`${piece.prop.title} could not be filled in`, 'warning'); }
  }
  if (!written.length) return;
  const words = cleanWords(String(pick(record, 'block/title') ?? '')) || 'the bullet';
  const undo = async () => {
    for (const piece of [...written].reverse()) {
      await logseq.Editor.removeBlockProperty(recordUuid, piece.ident);
      if (piece.tagPage) for (const uuid of piece.tagPage.uuids) await logseq.Editor.removeBlockTag(uuid, piece.tagPage.tag.uuid);
    }
  };
  showUndoBar(`${written.map(piece => `${piece.prop.title}: ${piece.shown}`).join(' · ')} filled in on “${words.length > 40 ? words.slice(0, 39) + '…' : words}”`, undo,
    error => { warnOnce('the filled-in values could not be taken off again', error); notify('The values could not be taken off again', 'warning'); });
}

/* Drawing: one faint line under the text box, in Logseq's own window, placed by the box's edges; it follows the box
   as the words wrap and goes when the box does. Nothing of Logseq's is touched. */
function shadowHtml(live) {
  const head = live.forWords ? `<span class="rfs-for">${esc(live.forWords.length > 32 ? live.forWords.slice(0, 31) + '…' : live.forWords)} ·</span>` : '';
  const pieces = live.pieces.map(piece => `<span class="rfs-piece"><span class="rfs-name">${esc(piece.prop.title)}:</span> ${esc(piece.shown)}${piece.note ? ` <span class="rfs-note">(${esc(piece.note)})</span>` : ''}</span>`).join('<span class="rfs-dot">·</span>');
  return `${head}${pieces}<span class="rfs-keys"><kbd>enter</kbd> takes · <kbd>esc</kbd> clears</span>`;
}
function draw(box) {
  const doc = box.ownerDocument;
  if (!state.el || state.el.ownerDocument !== doc || !state.el.isConnected) { state.el?.remove(); state.el = doc.createElement('div'); state.el.className = 'refinement-shadow'; state.el.setAttribute('role', 'status'); doc.body.appendChild(state.el); }
  state.el.innerHTML = shadowHtml(state.live);
  place(box);
}
function place(box) {
  if (!state.el || !state.live) return;
  const at = box.getBoundingClientRect(), win = box.ownerDocument.defaultView;
  if (!at.width && !at.height) { hide(); return; }
  state.el.style.left = `${Math.round(Math.max(8, Math.min(at.left, win.innerWidth - 420)))}px`;
  state.el.style.top = `${Math.round(at.bottom + 2)}px`;
  state.el.style.maxWidth = `${Math.round(Math.max(240, win.innerWidth - at.left - 16))}px`;
}
function hide() { state.el?.remove(); state.el = null; }
function onMove() {
  if (!state.live) return;
  const box = editingBox(host().activeElement);
  if (box && uuidOf(box) === state.live.uuid) place(box); else hide();
}

const css = `
/* The shadow (0.4.197): a faint line under the bullet being written, in the quiet colour, no box; the keys smaller still. */
.refinement-shadow { position: fixed; z-index: 998; pointer-events: none; padding: 1px 6px 2px; margin-left: -6px; border-radius: 4px;
  font-size: .85em; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--ls-primary-text-color, currentColor); background: hsl(var(--background, 0 0% 100%)); }
.refinement-shadow .rfs-for, .refinement-shadow .rfs-name, .refinement-shadow .rfs-note, .refinement-shadow .rfs-dot { color: var(--ls-secondary-text-color, currentColor); opacity: .75; }
.refinement-shadow .rfs-for { margin-right: .4em; }
.refinement-shadow .rfs-dot { margin: 0 .5em; }
.refinement-shadow .rfs-note { font-style: italic; }
.refinement-shadow .rfs-keys { margin-left: 1em; font-size: .9em; color: var(--ls-secondary-text-color, currentColor); opacity: .55; }
.refinement-shadow kbd { font: inherit; font-size: .9em; padding: 0 .3em; border: 1px solid color-mix(in srgb, currentColor 35%, transparent); border-radius: 3px; }
`;

function applyStyles() { sendStyle('refinement-shadow', setting('shadowProposals') ? css : ''); }
function start() {
  ({ dsQuery, UUID, propSchema, propPages, bare, pick, idOf, sendStyle, titleOf } = take(window.refinementCore, ['dsQuery', 'UUID', 'propSchema', 'propPages', 'bare', 'pick', 'idOf', 'sendStyle', 'titleOf']));
  void titleOf;
  applyStyles();
  readOff();
  const win = host().defaultView;
  listen(win, ['input'], onInput);
  listen(win, ['focusin'], onFocusIn);
  listen(win, ['focusout'], onFocusOut);
  listen(win, ['keydown'], onKey);
  listen(win, ['scroll', 'resize'], onMove);
  onUnload(logseq.DB.onChanged(() => { const box = editingBox(host().activeElement); if (box) { clearTimeout(liveTimer); liveTimer = setTimeout(() => compute(box), 150); } }));
  onUnload(logseq.onSettingsChanged((now, before) => { if (settingsSchema.some(item => now?.[item.key] !== before?.[item.key])) { applyStyles(); hide(); state.live = null; } }));
  onUnload(() => { clearTimeout(liveTimer); hide(); state.live = null; });
}
(window.refinementParts ||= []).push({ name: 'proposals', schema: settingsSchema, start, stop: runUnloadTasks });
// For tools/shadow-check.js and tools/pictures.js (read-only): the rules and what the shadow draws.
window.refinementShadowInner = { piecesFor, contextFor, daysFor, BLOCK_PULL, shadowHtml, css };
})();
