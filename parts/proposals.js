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
   Nothing is written. While you write a record its ghosts are drawn as you type, from the text box itself
   (0.4.119), and a hint sits on one of them: Tab takes that one and the hint moves to the next, Shift+Tab
   passes one (it stays pencilled), past the last the keys are Logseq's again; Escape never refuses (0.4.120;
   0.4.115 had Tab take all and Escape say no, j and k before that). A click on a ghost fills that one, in
   edit or not. The ghosts of other records stay drawn, so a question never vanishes. Only names the graph
   has are ever written to; only empty fields are ever proposed for; the people and parent rules run in
   the graphs named under Properties in the line, the day in the graphs named under Journal day as date. */
const shared = window.refinementShared;
const { host, notify, showUndoBar, graphNamedIn } = shared;
const { warnOnce, onUnload, runUnloadTasks, takeOverFromEarlierCopy, listen } = shared.lifecycle({ prefix: 'Refinements (proposals): ', stopKey: '__refinementProposalsStop',
  sweep: doc => { try { for (const el of doc.querySelectorAll('.rfp-ghost, .rfp-undo, .rfp-made')) el.remove(); for (const el of doc.querySelectorAll('[data-refinement-proposal]')) el.removeAttribute('data-refinement-proposal'); } catch (error) { /* nothing left over */ } } });
let dsQuery, graphWide, inlinePropsSetting, propSchema, propPages, journalDates, watchDomEarly, addsElements, parseDay, dayNumber, journalIdFor, journalTitleFor;
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };

const settingsSchema = [
  { key: 'proposalsHeading', type: 'heading', title: 'Proposals in the pills', default: null,
    description: 'While you write a record, what the graph can already tell (the people named in your words, a day such as “next fri”, the parent’s project, the journal day) is pencilled in, italic, in the record’s own pills. Tab takes the one with the hint, Shift+Tab passes it, a click takes one. Nothing is written until then; a small undo sits beside a value just written.' },
  { key: 'pillProposals', type: 'boolean', title: 'Proposals in the pills', default: true,
    description: 'The pencilled values in a record’s pills while it is written: Tab takes the one with the hint and moves to the next, Shift+Tab passes one, Escape only closes or leaves and never refuses. While it is on, Journal day as date asks here instead of after the record’s title; its graphs, tags and property still decide which records get a day. Applies at once.' },
  { key: 'pillProposalRules', type: 'string', title: 'What is proposed', default: 'journal day, people named, the parent’s fields',
    description: 'Comma-separated, any of: journal day (an empty Date field on a record Journal day as date names), people named (a page whose first name or whole name is a word of the record, in an empty field that takes its class, only when one page matches), the parent’s fields (a child’s empty field filled from its parent’s, or from the page the record is written on, when the value is a page the field can hold). The last two run only in the graphs named under Properties in the line. Applies at once.' },
  { key: 'proposeDayInWords', type: 'boolean', title: 'A day in the words', default: true,
    description: 'The last words of the record read as a day (tomorrow, friday, next fri, 23 oct, +3; a bare weekday needs four letters or more) are pencilled into the record’s empty Deadline, else due date, else date, and nowhere else. Runs in the graphs named under Properties in the line. Applies at once.' },
  { key: 'undoBesideValue', type: 'boolean', title: 'Undo beside the value', default: true,
    description: 'After a value is written into a record (Tab on a proposal, Enter in the line list), a small grey “undo ⌘z” sits beside it in the record’s own row for seven seconds; a click on it, or Cmd+Z while the caret is still in that block, takes the value back to pencilled. Off, the dark bar at the bottom offers Undo as before. Applies at once.' },
  { key: 'proposalHintTakes', type: 'number', title: 'Show the key hint until this many takes', default: 20,
    description: 'The small “tab takes · ⇧tab passes” beside the value Tab will take is a teaching device: it stops showing once you have taken that many values (the count is kept in the plugin’s settings file as proposalTakesSoFar; set it back to 0 there, or raise this number, to see the hint again; 0 shows it always). Applies at once.' },
  { key: 'pillProposalsLive', type: 'boolean', title: 'While you type', default: true,
    description: 'The proposals are worked out from the words in the text box as you type them, so a name is pencilled in the moment its word is finished, and a value whose word you delete goes away; the record you are writing gets them whatever its age. Off, they come only after the plugin’s check that follows a save, a second or two later. Applies at once.' },
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
const state = { started: Date.now(), proposals: new Map(), running: false, again: false,
  live: null /* { uuid, words, items, cursor } for the block in edit, from its text box (0.4.119) */ };
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
// What the rules may run on: the graphs named for the line list (people, parent) and for the journal day.
async function allowed() {
  if (!own('pillProposals')) return null;
  const inline = (rule('people named') || rule("the parent's fields") || own('proposeDayInWords')) && await graphNamedIn(inlinePropsSetting('inlinePropsGraphs'));
  const days = ownsDates() && journalDates.setting('autoDate') && journalDates.setting('autoDateAsk') && await journalDates.allowedHere();
  if (!inline && !days) return null;
  const [schema, pages, setup] = await Promise.all([propSchema(), propPages(), days ? journalDates.setup() : null]);
  return { inline, days, schema, pages, setup, pageById: new Map(pages.map(p => [p.id, p])) };
}
/* The rules, on one pulled block and the words it is read with (its saved title, or the text box while it is in edit):
   the people named, the parent's (or the page's) same-named field, the journal day. recent says whether the
   record counts as written now (the block in edit always does). */
/* A day in the words (0.4.122): the last one to three words of the record read as a day with the line list's reader
   (tomorrow, friday, next fri, 23 oct, oct 23, 2026-10-23, +3). A bare weekday needs four letters or more (friday,
   not fri: "sat" and "sun" are words), "next" and a weekday three; never a bare number, never a month alone. */
const DAY_WORDS = /^(?:today|tomorrow|yesterday|tmr|next\s+[a-z]{3,9}|[a-z]{4,9}|[+-]\d{1,3}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\s+[a-z]{3,9}\.?(?:\s+\d{4})?|[a-z]{3,9}\.?\s+\d{1,2}(?:,?\s+\d{4})?)$/i;
function dayInWords(title) {
  if (!parseDay) return null;
  const words = String(title || '').replace(/#?\[\[[0-9a-f-]{36}\]\]/gi, ' ').trim().replace(/[.,;:!?]+$/, '').split(/\s+/).filter(Boolean);
  const today = new Date();
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    const tail = words.slice(-n).join(' ').toLowerCase();
    if (!DAY_WORDS.test(tail)) continue;
    const d = parseDay(tail, today);
    if (d) return { date: d, tail };
  }
  return null;
}
async function itemsFor(b, title, ctx, recent) {
  const { inline, schema, pages, setup, pageById } = ctx;
  const tags = (pick(b, 'block/tags') || []).map(idOf), wordSet = words(title);
  const fields = fieldsOfTags(tags, schema), parent = pick(b, 'block/parent'), page = pick(b, 'block/page'), items = [];
  const parentIsBlock = parent && pick(parent, 'block/page');
  const pageTags = new Set((pick(page, 'block/tags') || []).map(idOf));
  for (const prop of fields) {
    if (prop.type !== 'node' || !prop.classes.length || valuesOf(b, prop.ident).length) continue;
    const classIds = new Set(prop.classes.map(c => c.id));
    let found = null, how = '';
    if (inline && rule('people named')) { found = peopleNamed(prop, wordSet, title, pages); how = 'named'; }
    if (!found && inline && rule("the parent's fields") && parentIsBlock) {
      const theirs = valuesOf(parent, prop.ident).map(id => pageById.get(id)).filter(p => p && p.tags.some(t => classIds.has(t.id)));
      if (theirs.length && (prop.many || theirs.length === 1)) { found = theirs; how = 'parent'; }
    }
    // The page a record is written on is a parent too (0.4.119): a Meeting on Ada Okafor's page proposes Ada.
    if (!found && inline && rule("the parent's fields") && page && !pick(page, 'block/journal-day') && [...pageTags].some(t => classIds.has(t)) && pageById.has(idOf(page))) { found = [pageById.get(idOf(page))]; how = 'page'; }
    if (found) items.push({ ident: prop.ident, prop, ids: found.map(p => p.id), shown: found.map(p => p.title).join(', '), how });
  }
  if (setup && setup.tags.some(t => tags.includes(t)) && !valuesOf(b, setup.ident).length) {
    const prop = schema.props.find(p => p.ident === setup.ident);
    if (prop && pick(page, 'block/journal-day') && recent) items.push({ ident: setup.ident, prop, ids: [], journal: idOf(page), day: Number(pick(page, 'block/journal-day')), shown: String(pick(page, 'block/title') ?? ''), how: 'day' });
  }
  // A day in the words goes into the record's empty Deadline, else due date, else date, and nowhere else.
  if (inline && own('proposeDayInWords')) {
    const found = dayInWords(title);
    const target = found && ['logseq.property/deadline', 'due date', 'date'].map(key => fields.find(p => (p.ident === key || p.lower === key) && (p.type === 'date' || p.type === 'datetime'))).find(Boolean);
    if (target && !valuesOf(b, target.ident).length && !items.some(item => item.ident === target.ident)) {
      const d = found.date, day = dayNumber(d);
      const shown = await journalTitleFor(d.getFullYear(), d.getMonth() + 1, d.getDate());
      items.push({ ident: target.ident, prop: target, ids: [], day, when: target.type === 'datetime' ? d.getTime() : null, shown, how: 'words' });
    }
  }
  return items;
}
const cleanWords = title => String(title || '').replace(/#?\[\[[0-9a-f-]{36}\]\]/gi, '').trim();
async function compute() {
  const proposals = new Map();
  const ctx = await allowed();
  if (!ctx) return proposals;
  for (const b of await recentRecords()) {
    const uuid = String(pick(b, 'block/uuid') ?? '');
    if (!uuid) continue;
    const title = String(pick(b, 'block/title') ?? '');
    const items = await itemsFor(b, title, ctx, Number(pick(b, 'block/created-at') || 0) >= state.started - 60000);
    // The cursor (0.4.120) is kept across rounds: a passed value stays passed while the record is on screen.
    if (items.length) proposals.set(uuid, { words: cleanWords(title), items, cursor: Math.min(recFor(uuid)?.cursor || 0, items.length) });
  }
  return proposals;
}
/* While you type (0.4.119): the same rules on the text box of the block in edit, 40 ms after each key, from the
   lists already in memory and one small pull of the block (its tags, values, parent and page). The block in edit
   counts as written now whatever its age; the round after the save confirms. */
const BLOCK_PULL = '[* {:block/tags [:db/id]} {:block/page [:db/id :block/title :block/journal-day {:block/tags [:db/id]}]} {:block/parent [* {:block/page [:db/id]}]}]';
let liveTimer = 0, liveVersion = 0;
async function liveCompute(box) {
  const uuid = box.closest('.ls-block[blockid]')?.getAttribute('blockid');
  if (!uuid || !own('pillProposalsLive')) return;
  const version = ++liveVersion, text = box.value.split('\n')[0];
  try {
    const ctx = await allowed();
    if (!ctx || version !== liveVersion) return;
    const [[b] = []] = await dsQuery(`[:find (pull ?b ${BLOCK_PULL}) :where [?b :block/uuid #uuid "${uuid}"]]`);
    if (!b || version !== liveVersion) return;
    const items = await itemsFor(b, text, ctx, true);
    if (version !== liveVersion) return;
    state.live = items.length ? { uuid, words: cleanWords(text), items, cursor: Math.min(recFor(uuid)?.cursor || 0, items.length) } : null;
    if (!items.length) state.proposals.delete(uuid); // a word deleted takes its value away, from the round's copy too
    draw(host(), null);
  } catch (error) { warnOnce('the proposals could not be read from the text box', error); }
}
function onEditorInput(event) {
  const box = event.target;
  if (!box?.matches?.('textarea') || !box.closest('.ls-block[blockid]')) return;
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => liveCompute(box), 40);
}
// The block left edit: its live proposals hand over to the round's copy (the saved text now has the same words).
function onFocusOut(event) {
  const box = event.target;
  if (!box?.matches?.('textarea') || !state.live) return;
  const uuid = box.closest('.ls-block[blockid]')?.getAttribute('blockid');
  if (uuid !== state.live.uuid) return;
  setTimeout(() => {
    const live = host().activeElement;
    if (live?.matches?.('textarea') && live.closest('.ls-block[blockid]')?.getAttribute('blockid') === uuid) return;
    if (state.live?.uuid === uuid) { state.proposals.set(uuid, state.live); state.live = null; draw(host(), null); }
  }, 120);
}
// The record's proposals: the live ones while it is in edit, else the round's.
const recFor = uuid => (state.live?.uuid === uuid ? state.live : state.proposals.get(uuid)) || null;
function setRec(uuid, rec) {
  if (state.live?.uuid === uuid) state.live = rec;
  if (rec) state.proposals.set(uuid, rec); else state.proposals.delete(uuid);
}
function allRecs() { const m = new Map(state.proposals); if (state.live) m.set(state.live.uuid, state.live); return m; }
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
  g.innerHTML = `${withName ? `<span class="rfp-name">${escapeHtml(item.prop.title)}:</span>` : ''}<button type="button" class="rfp-value" title="Fill it">${escapeHtml(item.shown)}</button><span class="rfp-keys"><kbd>tab</kbd> takes · <kbd>⇧tab</kbd> passes</span>`;
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
  const recs = allRecs();
  for (const g of doc.querySelectorAll('.rfp-ghost')) {
    const row = g.closest('.ls-block[blockid]'), rec = recs.get(row?.getAttribute('blockid') || '');
    if (!rec || !rec.items.some(item => item.ident === g.dataset.rfpIdent)) { g.closest('[data-refinement-proposal]')?.removeAttribute('data-refinement-proposal'); const made = g.closest('.rfp-made-pill'); g.remove(); if (made && !made.querySelector('.rfp-undo')) made.remove(); }
  }
  for (const el of doc.querySelectorAll('.rfp-made')) if (!el.querySelector('.rfp-ghost, .rfp-undo, .rfp-made-pill')) el.remove(); // a made pill or row with nothing left in it
  for (const [uuid, rec] of recs) {
    for (const row of doc.querySelectorAll(`.ls-block[blockid="${uuid}"]`)) {
      const owned = el => el.closest('.ls-block[blockid]') === row;
      const pills = [...row.querySelectorAll('.positioned-properties.block-below .bottom-property-pill')].filter(owned);
      for (const item of rec.items) {
        // A field with no pill yet (a Task's Deadline hides while empty) gets one made for its ghost (0.4.122), so the
        // value is pencilled where it will land; the made pill goes when the ghost does and Logseq's own pill arrives.
        const pill = pills.find(p => pillName(p) === item.prop.lower) || makePill(doc, row, item);
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
  drawUndos(doc);
}

/* The quiet undo (0.4.121): after a value is written into a record, a small grey "undo ⌘z" beside it in the record's
   own row for seven seconds, in place of the dark bar at the bottom; a click, or Cmd+Z while the caret is still in
   that block, runs the undo. Drawn on the early pass like the ghosts, so Logseq's redraw of the pill cannot lose it. */
const UNDO_FOR = 7000;
const undos = []; // { uuid, ident, name, text, undo, onFail, until }
function undoBeside(uuid, ident, name, text, undo, onFail) {
  if (!own('undoBesideValue')) { showUndoBar(text, undo, onFail); return; }
  const i = undos.findIndex(u => u.uuid === uuid && u.ident === ident);
  if (i >= 0) undos.splice(i, 1);
  undos.push({ uuid, ident, name, text, undo, onFail, until: Date.now() + UNDO_FOR });
  draw(host(), null);
  setTimeout(() => { expireUndos(); draw(host(), null); }, UNDO_FOR + 50);
}
function expireUndos() { const now = Date.now(); for (let i = undos.length - 1; i >= 0; i--) if (undos[i].until <= now) undos.splice(i, 1); }
async function runUndo(u) {
  const i = undos.indexOf(u);
  if (i >= 0) undos.splice(i, 1);
  draw(host(), null);
  try { await u.undo(); } catch (error) { if (u.onFail) u.onFail(error); else { warnOnce('the value could not be taken off again', error); notify('The value could not be taken off again', 'warning'); } }
}
function undoEl(doc, u) {
  const el = doc.createElement('span');
  el.className = 'rfp-undo';
  el.setAttribute('contenteditable', 'false');
  el.dataset.rfpUndo = u.ident;
  el.innerHTML = `<button type="button" title="${escapeHtml(u.text)}">undo</button><kbd>⌘z</kbd>`;
  el.addEventListener('mousedown', event => event.stopPropagation());
  el.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); runUndo(u); });
  return el;
}
function drawUndos(doc) {
  expireUndos();
  for (const el of doc.querySelectorAll('.rfp-undo')) {
    const uuid = el.closest('.ls-block[blockid]')?.getAttribute('blockid');
    if (!undos.some(u => u.uuid === uuid && u.ident === el.dataset.rfpUndo)) el.remove();
  }
  for (const u of undos) {
    for (const row of doc.querySelectorAll(`.ls-block[blockid="${u.uuid}"]`)) {
      const owned = el => el.closest('.ls-block[blockid]') === row;
      const pill = [...row.querySelectorAll('.positioned-properties.block-below .bottom-property-pill')].filter(owned).find(p => pillName(p) === u.name.toLowerCase());
      const target = pill ? (pill.querySelector('.bottom-property-content') || pill) : [...row.querySelectorAll('.block-title-wrap')].find(owned);
      if (!target || [...target.querySelectorAll(':scope > .rfp-undo')].some(el => el.dataset.rfpUndo === u.ident)) continue;
      target.appendChild(undoEl(doc, u));
    }
  }
}
// Cmd+Z while the caret is in a block with a fresh undo beside a value runs that undo instead of Logseq's.
function onUndoKey(event) {
  if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== 'z') return;
  const box = event.target;
  if (!box?.matches?.('textarea')) return;
  const uuid = box.closest('.ls-block[blockid]')?.getAttribute('blockid');
  expireUndos();
  const u = [...undos].reverse().find(u => u.uuid === uuid);
  if (!u) return;
  event.preventDefault(); event.stopImmediatePropagation();
  runUndo(u);
}
// A pill made for a field Logseq shows no pill for, in the record's own pill row (made too when the record has none).
function makePill(doc, row, item) {
  const main = [...row.querySelectorAll('.block-main-container')].find(el => el.closest('.ls-block[blockid]') === row);
  if (!main) return null;
  // Logseq's shape (read 2026-10-18): block-main-container > div.flex-col > div.flex-col > [the content, positioned-properties.block-below > bottom-properties-row > pills].
  let rowEl = [...main.querySelectorAll('.positioned-properties.block-below')].find(el => el.closest('.ls-block[blockid]') === row);
  if (!rowEl) {
    const inner = [...main.querySelectorAll(':scope > .flex-col > .flex-col')].find(el => el.closest('.ls-block[blockid]') === row) || main.querySelector(':scope > .flex-col') || main;
    rowEl = doc.createElement('div'); rowEl.className = 'positioned-properties block-below flex flex-col gap-1 text-sm rfp-made';
    rowEl.innerHTML = '<div class="bottom-properties-row"></div>';
    inner.appendChild(rowEl);
  }
  const strip = rowEl.querySelector('.bottom-properties-row') || rowEl;
  const pill = doc.createElement('div');
  pill.className = 'bottom-property-pill rfp-made rfp-made-pill';
  pill.setAttribute('contenteditable', 'false');
  pill.innerHTML = `<span class="rfp-made-name">${escapeHtml(item.prop.title)}:</span><span class="bottom-property-content"></span>`;
  strip.appendChild(pill);
  return pill;
}
// The record being written, when it has ghosts: the ghost under its cursor carries the keys (0.4.120: one value
// at a time; the cursor moves on with Tab and Shift+Tab, and past the last value the keys are Logseq's again).
const current = rec => (rec && rec.items[Math.min(rec.cursor || 0, rec.items.length)]) || null;
function firstOnScreen(doc) {
  for (const g of doc.querySelectorAll('.rfp-ghost')) {
    const row = g.closest('.ls-block[blockid]');
    if (!row || !inEdit(row)) continue;
    const item = current(recFor(row.getAttribute('blockid')));
    if (item && item.ident === g.dataset.rfpIdent) return g;
  }
  return null;
}
// The hint leaves once learnt (0.4.126): after proposalHintTakes takes, counted in the settings file; 0 keeps it always.
const takesSoFar = () => Number(logseq.settings?.proposalTakesSoFar) || 0;
const hintWanted = () => { const limit = Number(own('proposalHintTakes')); return !(limit > 0) || takesSoFar() < limit; };
function countTake() {
  const limit = Number(own('proposalHintTakes'));
  if (limit > 0 && takesSoFar() <= limit) logseq.updateSettings({ proposalTakesSoFar: takesSoFar() + 1 });
}
function markFirst(doc) {
  const first = hintWanted() ? firstOnScreen(doc) : null;
  for (const g of doc.querySelectorAll('.rfp-ghost[data-rfp-first]')) if (g !== first) g.removeAttribute('data-rfp-first');
  first?.setAttribute('data-rfp-first', '');
}

/* Writing: Tab fills the ghost under the cursor of the record being written, a click fills one; one bar with one
   Undo. Shift+Tab passes one (the cursor moves on, the value stays pencilled). Escape never refuses (0.4.120). */
async function fill(uuid, onlyIdent) {
  const rec = recFor(uuid);
  if (!rec) return;
  const items = onlyIdent ? rec.items.filter(item => item.ident === onlyIdent) : rec.items;
  const left = rec.items.filter(item => !items.includes(item));
  // The cursor stays on its index, so the next value steps under it; a value taken before the cursor moves it back one.
  const taken = rec.items.findIndex(item => items.includes(item));
  const cursor = Math.max(0, Math.min((rec.cursor || 0) - (taken >= 0 && taken < (rec.cursor || 0) ? 1 : 0), left.length));
  setRec(uuid, left.length ? { ...rec, items: left, cursor } : null);
  draw(host(), null);
  const written = [];
  for (const item of items) {
    try {
      if (item.journal) await logseq.Editor.upsertBlockProperty(uuid, item.ident, item.journal);
      else if (item.when) await logseq.Editor.upsertBlockProperty(uuid, item.ident, item.when);
      else if (item.day) { const id = await journalIdFor(item.day, item.shown); if (!id) throw new Error('no journal page for that day'); await logseq.Editor.upsertBlockProperty(uuid, item.ident, id); }
      else if (item.prop.many) await logseq.Editor.upsertBlockProperty(uuid, item.ident, item.ids, { entityId: true, reset: true });
      else await logseq.Editor.upsertBlockProperty(uuid, item.ident, item.ids[0], { entityId: true });
      written.push(item);
    } catch (error) {
      warnOnce('a proposed value could not be written', error);
      notify(`Could not set ${item.prop.title}: ${error?.message || error}`, 'warning');
    }
  }
  if (!written.length) return;
  if (!onlyIdent || items.length) countTake();
  // Undo takes the value off again and pencils it back in, so one Tab can take it once more.
  const onFail = error => { warnOnce('the proposed values could not be taken off again', error); notify('The values could not be taken off again', 'warning'); };
  const restore = async item => {
    await logseq.Editor.removeBlockProperty(uuid, item.ident);
    const now = recFor(uuid) || { words: rec.words, items: [], cursor: 0 };
    if (!now.items.some(i => i.ident === item.ident)) setRec(uuid, { ...now, items: [...now.items, item] });
    draw(host(), null);
  };
  if (own('undoBesideValue')) for (const item of written) undoBeside(uuid, item.ident, item.prop.title, `${item.prop.title}: ${item.shown}`, () => restore(item), onFail);
  else showUndoBar(`${written.map(item => `${item.prop.title}: ${item.shown}`).join(' · ')} set on “${shorten(rec.words || 'this record')}”`, async () => { for (const item of [...written].reverse()) await restore(item); }, onFail);
}
// Shift+Tab passes the value under the cursor: it stays pencilled (a click still takes it), the hint moves on.
function pass(uuid) {
  const rec = recFor(uuid);
  if (!rec) return;
  setRec(uuid, { ...rec, cursor: Math.min((rec.cursor || 0) + 1, rec.items.length) });
  draw(host(), null);
}
// Tab and Shift+Tab in the text box of a record that has a value under its cursor; a picker open under the caret
// (Logseq's, or the line list) keeps its keys, and past the last value the keys are Logseq's (indent, outdent).
// Taken in the capture phase on Logseq's window, before Logseq's own handlers. Escape is Logseq's: it never refuses.
function onKey(event) {
  if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
  if (event.key !== 'Tab') return;
  const box = event.target;
  if (!box?.matches?.('textarea')) return;
  const uuid = box.closest('.ls-block[blockid]')?.getAttribute('blockid');
  if (!uuid || !current(recFor(uuid))) return;
  const doc = box.ownerDocument;
  if (doc.querySelector('#ui__ac, .rip-menu, .absolute-modal, [data-editor-popup-ref]')) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (event.shiftKey) pass(uuid); else fill(uuid, current(recFor(uuid)).ident);
}

const css = `
/* A proposed value, pencilled in as the line list's ghost: proposed, not written. */
/* The pencilled value at the pill's own size (0.4.124): it was .95em of .95em, 12.6px against a written 14px. */
.rfp-ghost { display: inline-flex; align-items: baseline; gap: .45em; margin-left: .35em; vertical-align: baseline; }
.bottom-property-content > .rfp-ghost { margin-left: 0; }
.rfp-name { color: var(--ls-secondary-text-color, currentColor); }
/* Pencilled in (0.4.116): italic in the quiet colour, no box; the value stands upright in its box once taken. */
.rfp-value { border: 0; border-radius: 0; background: transparent; color: var(--ls-secondary-text-color, currentColor); padding: .02em .1em; font: inherit; font-style: italic; font-variant-numeric: tabular-nums; cursor: pointer; line-height: inherit; }
.rfp-value:hover { color: var(--ls-primary-text-color, currentColor); }
.rfp-keys { display: none; font-size: var(--rf-small, .82em); color: var(--ls-secondary-text-color, currentColor); opacity: var(--rf-quiet, .7); white-space: nowrap; }
.rfp-ghost[data-rfp-first] .rfp-keys { display: inline; }
.rfp-keys kbd { text-transform: lowercase; }
.rfp-keys kbd { padding: 0 3px; border: 1px solid var(--ls-border-color); border-radius: 3px; font: inherit; font-size: .9em; }
.ls-block .positioned-properties.block-below .bottom-property-pill[data-refinement-proposal] { display: flex !important; opacity: 1 !important; }
.bottom-property-pill[data-refinement-proposal] .empty-value { display: none !important; }
/* A pill made for a field with no pill yet (0.4.122): the name as the row writes it, the ghost after it. */
.rfp-made-pill { display: inline-flex; align-items: baseline; gap: .3em; }
.rfp-made-name { color: var(--ls-secondary-text-color, currentColor); }
/* The quiet undo (0.4.121): a small grey word and its key beside the value just written, for seven seconds. */
.rfp-undo { display: inline-flex; align-items: baseline; gap: .3em; margin-left: .45em; font-size: var(--rf-small, .82em); color: var(--ls-secondary-text-color, currentColor); opacity: var(--rf-quiet, .7); white-space: nowrap; vertical-align: baseline; }
.rfp-undo button { all: unset; cursor: pointer; font: inherit; color: inherit; }
.rfp-undo button:hover { color: var(--ls-primary-text-color, currentColor); }
.rfp-undo kbd { padding: 0 3px; border: 1px solid var(--ls-border-color); border-radius: 3px; font: inherit; font-size: .9em; text-transform: lowercase; }`;

// Why a value is proposed, in the words the line list shows beside it (0.4.118).
const WHY = { named: 'in your words', words: 'in your words', parent: 'from the parent', page: 'this page', day: 'the journal day' };
// The record's proposals for one field (or all of them), for the line list, which opens on them (0.4.118).
function proposalsFor(uuid, ident) {
  const rec = recFor(uuid);
  if (!rec) return [];
  return rec.items.filter(item => !ident || item.ident === ident).map(item => ({ ...item, why: WHY[item.how] || '' }));
}
function provide(core) {
  core.provide({ proposalsOwnDates: ownsDates, refreshProposals: refresh, proposalsFor, undoBeside });
}
function start() {
  const core = window.refinementCore;
  ({ dsQuery, graphWide, inlinePropsSetting, propSchema, propPages, journalDates, watchDomEarly, addsElements, parseDay, dayNumber, journalIdFor, journalTitleFor } = take(core, ['dsQuery', 'graphWide', 'inlinePropsSetting', 'propSchema', 'propPages', 'journalDates', 'watchDomEarly', 'addsElements', 'parseDay', 'dayNumber', 'journalIdFor', 'journalTitleFor']));
  takeOverFromEarlierCopy();
  logseq.provideStyle({ key: 'refinements-proposals', style: css });
  listen(host().defaultView, ['keydown'], onKey);
  listen(host().defaultView, ['keydown'], onUndoKey);
  // keyup too: Logseq handles Backspace itself and sets the text without an input event (seen 2026-10-18); focusin: a record clicked into gets its proposals at once.
  listen(host().defaultView, ['input', 'keyup', 'focusin'], onEditorInput);
  listen(host().defaultView, ['focusout'], onFocusOut);
  watchDomEarly(function drawProposals(doc, records) { draw(doc, records); });
  core.onDbRound('proposals', refresh);
  onUnload(logseq.onSettingsChanged(() => { state.proposals = new Map(); state.live = null; refresh(); }));
  onUnload(() => { clearTimeout(liveTimer); state.proposals = new Map(); state.live = null; undos.length = 0; try { draw(host(), null); } catch (error) { /* the window may be gone */ } });
  refresh();
  window.proposalsDebug = { state, compute, refresh, liveCompute };
}
(window.refinementParts ||= []).push({ name: 'proposals', schema: settingsSchema, provide, start, stop: runUnloadTasks });
})();
