/* Loaded by loader.js before main.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* Proposals in the pills (0.4.105): the record asks once, where the answer goes. After a block has
   been written, the plugin works out what it can infer from what the graph already holds and draws each
   answer pencilled in (italic, the quiet colour) in the record's own pill, with the line list's ghost (parts/inline-props.js, 0.4.96):
   - the journal day, in an empty Date field of a record the Journal day as date settings name (its
     graphs, tags and property; this part takes over that part's asking while it is on);
   - a Person (or a page of any class a field takes) whose first name, or whole name, is a word of the
     record's text, in an empty field that takes that class, only when exactly one such page matches;
   - the parent's value, in a child's empty field of the same name (a Decision under a Meeting gets its
     project), when that value is a page the field can hold.
   Nothing is written. While you write a record its ghosts are drawn as you type (0.4.115): Tab takes every
   one of them and the bar offers one Undo, Escape says no and the record is not asked about again this
   session; a second Escape leaves the block, as in Logseq. With nothing proposed, Tab and Escape are
   Logseq's. A click on a ghost fills that one, in edit or not. The ghosts of other records stay drawn, so
   a question never vanishes. (j and k, outside edit on the record nearest the top, were retired: the
   answer belongs to the record you are writing.) Only names the graph
   has are ever written to; only empty fields are ever proposed for; the people and parent rules run in
   the graphs named under Properties in the line, the day in the graphs named under Journal day as date. */
const shared = window.refinementShared;
const { host, notify, showUndoBar, graphNamedIn } = shared;
const { warnOnce, onUnload, runUnloadTasks, takeOverFromEarlierCopy, listen } = shared.lifecycle({ prefix: 'Refinements (proposals): ', stopKey: '__refinementProposalsStop',
  sweep: doc => { try { for (const el of doc.querySelectorAll('.rfp-ghost')) el.remove(); for (const el of doc.querySelectorAll('[data-refinement-proposal]')) el.removeAttribute('data-refinement-proposal'); } catch (error) { /* nothing left over */ } } });
let dsQuery, graphWide, inlinePropsSetting, propSchema, propPages, journalDates, watchDomEarly, addsElements;
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };

const settingsSchema = [
  { key: 'proposalsHeading', type: 'heading', title: 'Proposals in the pills', default: null,
    description: 'After you write a record, what the graph can already tell (the journal day, the people named in the words, the parent’s project) is pencilled in, italic, in the record’s own pills. While you write the record, Tab takes them and Escape says no; a click fills one value. Nothing is written until then; the bar at the bottom offers Undo.' },
  { key: 'pillProposals', type: 'boolean', title: 'Proposals in the pills', default: true,
    description: 'The pencilled values in a record’s pills while it is written, and Tab to take them or Escape to say no while you write the record. While it is on, Journal day as date asks here instead of after the record’s title; its graphs, tags and property still decide which records get a day. Applies at once.' },
  { key: 'pillProposalRules', type: 'string', title: 'What is proposed', default: 'journal day, people named, the parent’s fields',
    description: 'Comma-separated, any of: journal day (an empty Date field on a record Journal day as date names), people named (a page whose first name or whole name is a word of the record, in an empty field that takes its class, only when one page matches), the parent’s fields (a child’s empty field filled from its parent’s, when the value is a page the field can hold). The last two run only in the graphs named under Properties in the line. Applies at once.' },
];
const own = shared.settingReader(settingsSchema);
const rulesOn = () => new Set(String(own('pillProposalRules') || '').toLowerCase().replace(/’/g, "'").split(',').map(s => s.trim()).filter(Boolean));
const rule = name => rulesOn().has(name);
const ownsDates = () => own('pillProposals') && rule('journal day');

const bare = value => String(value ?? '').replace(/^:/, '');
const pick = (node, name) => node?.[name] ?? node?.[':' + name] ?? node?.[name.slice(name.indexOf('/') + 1)];
const idOf = value => typeof value === 'number' ? value : pick(value, 'db/id');
const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shorten = (text, max = 48) => (text.length > max ? text.slice(0, max - 1) + '…' : text);
// A pulled map's value under a property, by its ident, whatever the key's spelling; [] when the field is empty.
function valuesOf(node, ident) {
  for (const key of Object.keys(node || {})) if (bare(key) === ident) { const v = node[key]; return (Array.isArray(v) ? v : v == null ? [] : [v]).map(idOf).filter(id => id != null); }
  return [];
}
// The fields of a block's tags, own first, then what they inherit (the line list's fieldsOf, from tag ids).
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

/* The proposals: uuid → { words, items: [{ ident, prop, ids, journal?, shown }] }, worked out after each
   database round from the records written since the plugin started (and a minute before), graph-wide
   in one query. Drawing is done from this map on the screen watcher's early pass. */
const state = { started: Date.now(), proposals: new Map(), declined: new Set(), running: false, again: false };
const words = title => new Set(String(title || '').toLowerCase().replace(/\[\[[0-9a-f-]{36}\]\]/gi, ' ').split(/[^\p{L}\p{N}]+/u).filter(Boolean));
async function recentRecords() {
  const since = state.started - 60000;
  return (await dsQuery(`[:find (pull ?b [* {:block/tags [:db/id]} {:block/page [:db/id :block/title :block/journal-day]} {:block/parent [* {:block/page [:db/id]}]}])
    :where [?b :block/updated-at ?u] [(>= ?u ${since})] [?b :block/tags ?t] [?t :block/tags ?cls] [?cls :db/ident :logseq.class/Tag] [?b :block/page _] [?b :block/uuid _]]`)).map(([b]) => b);
}
// The people named: pages of the field's class whose first name (three letters or more) or whole name is a word of the record.
function peopleNamed(prop, wordSet, title, pages) {
  const classIds = new Set(prop.classes.map(c => c.id));
  const byWord = new Map();
  for (const page of pages) {
    if (!page.tags.some(t => classIds.has(t.id))) continue;
    const first = page.lower.split(/\s+/)[0];
    const hits = [];
    if (first.length >= 3 && wordSet.has(first)) hits.push(first);
    if (page.lower.includes(' ') && new RegExp(`(?:^|[^\\p{L}\\p{N}])${page.lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^\\p{L}\\p{N}])`, 'u').test(title.toLowerCase())) hits.push(page.lower);
    for (const word of hits) { if (!byWord.has(word)) byWord.set(word, []); byWord.get(word).push(page); }
  }
  const found = [];
  for (const [, list] of byWord) if (list.length === 1 && !found.includes(list[0])) found.push(list[0]);
  if (!found.length || (!prop.many && found.length > 1)) return null;
  return found;
}
async function compute() {
  const proposals = new Map();
  if (!own('pillProposals')) return proposals;
  const inline = (rule('people named') || rule("the parent's fields")) && await graphNamedIn(inlinePropsSetting('inlinePropsGraphs'));
  const days = ownsDates() && journalDates.setting('autoDate') && journalDates.setting('autoDateAsk') && await journalDates.allowedHere();
  if (!inline && !days) return proposals;
  const [schema, pages, setup, records] = await Promise.all([propSchema(), propPages(), days ? journalDates.setup() : null, recentRecords()]);
  const pageById = new Map(pages.map(p => [p.id, p]));
  for (const b of records) {
    const uuid = String(pick(b, 'block/uuid') ?? '');
    if (!uuid || state.declined.has(uuid)) continue;
    const tags = (pick(b, 'block/tags') || []).map(idOf), title = String(pick(b, 'block/title') ?? ''), wordSet = words(title);
    const fields = fieldsOfTags(tags, schema), parent = pick(b, 'block/parent'), items = [];
    const parentIsBlock = parent && pick(parent, 'block/page');
    for (const prop of fields) {
      if (prop.type !== 'node' || !prop.classes.length || valuesOf(b, prop.ident).length) continue;
      let found = null, how = '';
      if (inline && rule('people named')) { found = peopleNamed(prop, wordSet, title, pages); how = 'named'; }
      if (!found && inline && rule("the parent's fields") && parentIsBlock) {
        const classIds = new Set(prop.classes.map(c => c.id));
        const theirs = valuesOf(parent, prop.ident).map(id => pageById.get(id)).filter(p => p && p.tags.some(t => classIds.has(t.id)));
        if (theirs.length && (prop.many || theirs.length === 1)) { found = theirs; how = 'parent'; }
      }
      if (found) items.push({ ident: prop.ident, prop, ids: found.map(p => p.id), shown: found.map(p => p.title).join(', '), how });
    }
    if (setup && setup.tags.some(t => tags.includes(t)) && !valuesOf(b, setup.ident).length) {
      const page = pick(b, 'block/page'), created = Number(pick(b, 'block/created-at') || 0);
      const prop = schema.props.find(p => p.ident === setup.ident);
      if (prop && pick(page, 'block/journal-day') && created >= state.started - 60000) items.push({ ident: setup.ident, prop, ids: [], journal: idOf(page), shown: String(pick(page, 'block/title') ?? ''), how: 'day' });
    }
    if (items.length) proposals.set(uuid, { words: title.replace(/#?\[\[[0-9a-f-]{36}\]\]/gi, '').trim(), items });
  }
  return proposals;
}
async function refresh() {
  if (state.running) { state.again = true; return; }
  state.running = true;
  try { state.proposals = await compute(); draw(host(), null); }
  catch (error) { warnOnce('the proposals could not be worked out', error); }
  finally { state.running = false; if (state.again) { state.again = false; refresh(); } }
}

/* Drawing, on the early pass: a ghost in each proposed pill of every row of the record on screen (the main
   area and the sidebar alike), skipped while the block is in edit; stale ghosts taken out; the keys written
   once, after the first ghost of the record nearest the top of the main area. */
const pillName = p => (p.firstElementChild?.textContent || '').trim().replace(/:$/, '').toLowerCase();
const inEdit = row => [...row.querySelectorAll('textarea')].some(t => t.closest('.ls-block[blockid]') === row);
function ghostEl(doc, item, withName) {
  const g = doc.createElement('span');
  g.className = 'rfp-ghost';
  g.setAttribute('contenteditable', 'false');
  g.dataset.rfpIdent = item.ident;
  g.innerHTML = `${withName ? `<span class="rfp-name">${escapeHtml(item.prop.title)}:</span>` : ''}<button type="button" class="rfp-value" title="Fill it">${escapeHtml(item.shown)}</button><span class="rfp-keys"><kbd>tab</kbd> takes · <kbd>esc</kbd> no</span>`;
  g.addEventListener('mousedown', event => event.stopPropagation());
  g.addEventListener('click', event => {
    if (!event.target.closest('.rfp-value')) return;
    event.preventDefault(); event.stopPropagation();
    const uuid = g.closest('.ls-block[blockid]')?.getAttribute('blockid');
    if (uuid) fill(uuid, item.ident);
  });
  return g;
}
function draw(doc, records) {
  if (records && !addsElements(records)) return;
  for (const g of doc.querySelectorAll('.rfp-ghost')) {
    const row = g.closest('.ls-block[blockid]'), rec = state.proposals.get(row?.getAttribute('blockid') || '');
    if (!rec || !rec.items.some(item => item.ident === g.dataset.rfpIdent)) { g.closest('[data-refinement-proposal]')?.removeAttribute('data-refinement-proposal'); g.remove(); }
  }
  for (const [uuid, rec] of state.proposals) {
    for (const row of doc.querySelectorAll(`.ls-block[blockid="${uuid}"]`)) {
      const owned = el => el.closest('.ls-block[blockid]') === row;
      const pills = [...row.querySelectorAll('.positioned-properties.block-below .bottom-property-pill')].filter(owned);
      for (const item of rec.items) {
        const pill = pills.find(p => pillName(p) === item.prop.lower);
        const target = pill ? (pill.querySelector('.bottom-property-content') || pill) : [...row.querySelectorAll('.block-title-wrap')].find(owned);
        if (!target) continue;
        const had = [...target.querySelectorAll(':scope > .rfp-ghost')].find(g => g.dataset.rfpIdent === item.ident);
        if (had) { const v = had.querySelector('.rfp-value'); if (v && v.textContent !== item.shown) v.textContent = item.shown; continue; }
        if (pill) pill.setAttribute('data-refinement-proposal', '');
        target.appendChild(ghostEl(doc, item, !pill));
      }
    }
  }
  markFirst(doc);
}
// The record being written, when it has ghosts: its first ghost carries the keys.
function firstOnScreen(doc) {
  return [...doc.querySelectorAll('.rfp-ghost')].find(g => { const row = g.closest('.ls-block[blockid]'); return row && inEdit(row); }) || null;
}
function markFirst(doc) {
  const first = firstOnScreen(doc);
  for (const g of doc.querySelectorAll('.rfp-ghost[data-rfp-first]')) if (g !== first) g.removeAttribute('data-rfp-first');
  first?.setAttribute('data-rfp-first', '');
}

/* Writing: Tab fills every ghost of the record being written, a click fills one; one bar with one Undo. Escape leaves the record. */
async function fill(uuid, onlyIdent) {
  const rec = state.proposals.get(uuid);
  if (!rec) return;
  const items = onlyIdent ? rec.items.filter(item => item.ident === onlyIdent) : rec.items;
  const left = rec.items.filter(item => !items.includes(item));
  if (left.length) state.proposals.set(uuid, { ...rec, items: left }); else state.proposals.delete(uuid);
  draw(host(), null);
  const undos = [], done = [];
  for (const item of items) {
    try {
      if (item.journal) await logseq.Editor.upsertBlockProperty(uuid, item.ident, item.journal);
      else if (item.prop.many) await logseq.Editor.upsertBlockProperty(uuid, item.ident, item.ids, { entityId: true, reset: true });
      else await logseq.Editor.upsertBlockProperty(uuid, item.ident, item.ids[0], { entityId: true });
      undos.push(() => logseq.Editor.removeBlockProperty(uuid, item.ident));
      done.push(`${item.prop.title}: ${item.shown}`);
    } catch (error) {
      warnOnce('a proposed value could not be written', error);
      notify(`Could not set ${item.prop.title}: ${error?.message || error}`, 'warning');
    }
  }
  if (!done.length) return;
  showUndoBar(`${done.join(' · ')} set on “${shorten(rec.words || 'this record')}”`,
    async () => { for (const undo of undos.reverse()) await undo(); },
    error => { warnOnce('the proposed values could not be taken off again', error); notify('The values could not be taken off again', 'warning'); });
}
function decline(uuid) {
  state.declined.add(uuid);
  state.proposals.delete(uuid);
  draw(host(), null);
}
// Tab and Escape in the text box of a record that has proposals; a picker open under the caret (Logseq's, or the
// line list) keeps its keys. Taken in the capture phase on Logseq's window, before Logseq's own handlers.
function onKey(event) {
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) return;
  if (event.key !== 'Tab' && event.key !== 'Escape') return;
  const box = event.target;
  if (!box?.matches?.('textarea')) return;
  const uuid = box.closest('.ls-block[blockid]')?.getAttribute('blockid');
  if (!uuid || !state.proposals.has(uuid)) return;
  const doc = box.ownerDocument;
  if (doc.querySelector('#ui__ac, .rip-menu, .absolute-modal, [data-editor-popup-ref]')) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (event.key === 'Tab') fill(uuid); else decline(uuid);
}

const css = `
/* A proposed value, pencilled in as the line list's ghost: proposed, not written. */
.rfp-ghost { display: inline-flex; align-items: baseline; gap: .45em; margin-left: .35em; font-size: .95em; vertical-align: baseline; }
.bottom-property-content > .rfp-ghost { margin-left: 0; }
.rfp-name { color: var(--ls-secondary-text-color, currentColor); }
/* Pencilled in (0.4.116): italic in the quiet colour, no box; the value stands upright in its box once taken. */
.rfp-value { border: 0; border-radius: 0; background: transparent; color: var(--ls-secondary-text-color, currentColor); padding: .02em .1em; font: inherit; font-style: italic; font-size: .95em; font-variant-numeric: tabular-nums; cursor: pointer; line-height: inherit; }
.rfp-value:hover { color: var(--ls-primary-text-color, currentColor); }
.rfp-keys { display: none; font-size: var(--rf-small, .82em); color: var(--ls-secondary-text-color, currentColor); opacity: var(--rf-quiet, .7); white-space: nowrap; }
.rfp-ghost[data-rfp-first] .rfp-keys { display: inline; }
.rfp-keys kbd { text-transform: lowercase; }
.rfp-keys kbd { padding: 0 3px; border: 1px solid var(--ls-border-color); border-radius: 3px; font: inherit; font-size: .9em; }
.ls-block .positioned-properties.block-below .bottom-property-pill[data-refinement-proposal] { display: flex !important; opacity: 1 !important; }
.bottom-property-pill[data-refinement-proposal] .empty-value { display: none !important; }`;

function provide(core) {
  core.provide({ proposalsOwnDates: ownsDates, refreshProposals: refresh });
}
function start() {
  const core = window.refinementCore;
  ({ dsQuery, graphWide, inlinePropsSetting, propSchema, propPages, journalDates, watchDomEarly, addsElements } = take(core, ['dsQuery', 'graphWide', 'inlinePropsSetting', 'propSchema', 'propPages', 'journalDates', 'watchDomEarly', 'addsElements']));
  takeOverFromEarlierCopy();
  logseq.provideStyle({ key: 'refinements-proposals', style: css });
  listen(host().defaultView, ['keydown'], onKey);
  watchDomEarly(function drawProposals(doc, records) { draw(doc, records); });
  core.onDbRound('proposals', refresh);
  onUnload(logseq.onSettingsChanged(() => { state.proposals = new Map(); refresh(); }));
  onUnload(() => { state.proposals = new Map(); try { draw(host(), null); } catch (error) { /* the window may be gone */ } });
  refresh();
  window.proposalsDebug = { state, compute, refresh };
}
(window.refinementParts ||= []).push({ name: 'proposals', schema: settingsSchema, provide, start, stop: runUnloadTasks });
})();
