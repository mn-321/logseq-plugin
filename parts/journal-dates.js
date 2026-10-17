/* Loaded by loader.js before main.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* Journal-day dates part of DB Refinements (was the Journal Day Dates plugin 1.0.0): fills an empty Date property on chosen records with the journal day they were
   written on. Split out of DB Refinements 0.2.156, which kept it under "Journal day as date". This is
   the only part of the plugin that writes to your notes, so it only runs in the graphs you name. */
// The shared plumbing (parts/shared.js): its header says what each helper does.
const shared = window.refinementShared;
const { host, notify, modalButtons, showUndoBar } = shared;
// This part's own clean-up list and stop key: a copy removed without its clean-up finishing is stopped
// by the next one, which also removes a note or box the earlier copy left on screen.
const { warnOnce, onUnload, runUnloadTasks, takeOverFromEarlierCopy } = shared.lifecycle({ prefix: 'Refinements (journal dates): ', stopKey: '__journalDayDatesStop',
  sweep: doc => { try { for (const el of doc.querySelectorAll('.jdd-prompt-backdrop, .jdd-ask, .jdd-ghost')) el.remove(); for (const el of doc.querySelectorAll('[data-jdd-ghost]')) el.removeAttribute('data-jdd-ghost'); } catch (error) { /* nothing left over */ } } });
// The shared dialog box, drawn with this part's own class names (styled in promptCss below).
const modal = (cancelValue, build, width) => shared.modal(cancelValue, build, width, { backdrop: 'jdd-prompt-backdrop', box: 'jdd-prompt' });

/* Database queries. Datascript with Logseq's own idents (:logseq.class/Tag, :block/title...), as
   the plugin SDK's DB guides do. Lists of ids are written into the query text, so only whole
   numbers and well-formed uuids are let in. */
const isEntityId = id => Number.isSafeInteger(id) && id > 0;
const idsIn = (variable, ids) => `[(identity [${[...new Set(ids)].filter(isEntityId).join(' ')}]) [${variable} ...]]`;
// Rows of a query, or [] when it returns nothing.
const dsQuery = async query => {
  const rows = await logseq.DB.datascriptQuery(query);
  return Array.isArray(rows) ? rows : [];
};
const bareIdent = value => String(value ?? '').replace(/^:/, '');
const keyword = ident => ':' + bareIdent(ident);
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

// Whole-graph look-ups (the tags and the date property) are read again at most this often while you edit.
const GRAPH_WIDE_EVERY = 30000;
const graphCache = new Map();
function graphWide(name, load) {
  const hit = graphCache.get(name);
  if (hit && Date.now() - hit.at < GRAPH_WIDE_EVERY) return hit.promise;
  const promise = Promise.resolve().then(load);
  graphCache.set(name, { at: Date.now(), promise });
  promise.catch(() => { if (graphCache.get(name)?.promise === promise) graphCache.delete(name); });
  return promise;
}

/* Journal day as date: a record tagged (for example) #Occurrence or #Results, or any tag that
   extends them, gets its empty Date filled with the journal day it was written on. A date you
   entered yourself is never changed. New records are filled automatically; older ones are filled
   only when you run "Fill missing dates from journal days" and confirm. Where the day comes from:
   a block written on a journal page gets that page's day. A page made from a journal (for example by
   typing [[Name]]#Tag there) is left alone: it has no day of its own.
   With "Ask before filling" on (the default), each new record is asked about first (showAsk). */
const autoDate = { started: Date.now(), running: false, again: false, warned: false, tried: new Map() };
const AUTO_DATE_TRIES = 3;
const autoDateTagNames = () => setting('autoDateTags').split(',').map(name => name.trim().replace(/^#/, '')).filter(Boolean);
const autoDatePropertyName = () => setting('autoDateProperty').trim() || 'Date';
async function autoDateSetup() {
  // The date property: one of yours with that name, whatever its case ("Date" finds "date"). If there
  // are several, prefer one a tag uses.
  const wantedName = autoDatePropertyName().toLowerCase();
  const propRows = (await dsQuery(`[:find ?ident ?p ?type ?title
    :where [?p :block/tags ?c] [?c :db/ident :logseq.class/Property] [?p :db/ident ?ident] [?p :block/title ?title]
    [(get-else $ ?p :logseq.property/type :default) ?type]]`)).filter(([, , , title]) => String(title).toLowerCase() === wantedName);
  // Only a property of the Date type: a journal day is the right value for it and for no other type
  // (a "date and time" property would read the day as a timestamp near 1970).
  const props = propRows.filter(([ident, , type]) =>
    /^:?user\.property\//.test(String(ident)) && bareIdent(type) === 'date');
  if (!props.length) return null;
  const tagProps = await dsQuery(`[:find ?t ?p :where [?t :logseq.property.class/properties ?p]]`);
  const usedProps = new Set(tagProps.map(([, p]) => p));
  const [ident] = props.find(([, p]) => usedProps.has(p)) || props[0];
  // Only the tags named in the settings, and every tag that extends them (they inherit the date property).
  const wanted = new Set(autoDateTagNames().map(name => name.toLowerCase()));
  const tags = new Set();
  if (wanted.size) for (const [t, title] of await allTags()) if (wanted.has(String(title).toLowerCase())) tags.add(t);
  if (!tags.size) return null;
  await withExtendingTags(tags);
  return { tags: [...tags], ident: bareIdent(ident) };
}
// Records missing the date, with the journal day each should get: blocks on a journal page (or
// directly under one). since = earliest creation time.
async function undatedRecords(setup, since) {
  const attr = keyword(setup.ident);
  const common = `${idsIn('?t', setup.tags)}
      [?b :block/tags ?t]
      (not [?b ${attr} _])
      [?b :block/created-at ?created] [(>= ?created ${Math.floor(since)})]
      [?b :block/uuid ?uuid]`;
  const direct = await logseq.DB.datascriptQuery(`[:find ?uuid ?j
    :where ${common}
      (or-join [?b ?j]
        (and [?b :block/page ?j] [?j :block/journal-day _])
        (and [?b :block/parent ?j] [?j :block/journal-day _]))]`);
  // Only blocks that sit on a journal page. A page has no day of its own, so it is never guessed
  // from the journals that mention it (A asked for that guess to be left out, 0.4.36).
  const result = new Map();
  for (const [uuid, journal] of direct || []) result.set(String(uuid), journal);
  return result;
}
async function fillDates(setup, records) {
  let filled = 0;
  for (const [uuid, journalId] of records) {
    try {
      await logseq.Editor.upsertBlockProperty(uuid, setup.ident, journalId);
      filled++;
    } catch (error) {
      warnOnce('could not fill a date', uuid, error);
      if (!autoDate.warned) { autoDate.warned = true; notify(`Could not fill a journal date: ${error?.message || error}`, 'warning'); }
    }
  }
  return filled;
}
// Plugin settings are shared by every graph; this keeps date filling to the graphs named in the settings.
async function autoDateAllowedHere() {
  const names = setting('autoDateGraphs').split(',').map(n => n.trim().toLowerCase()).filter(Boolean);
  if (!names.length) return false;
  const graph = await logseq.App.getCurrentGraph().catch(() => null);
  // A DB graph's name may carry an internal prefix ("logseq_db_"), and its url or path ends in the name.
  const strip = value => String(value || '').toLowerCase().replace(/^logseq_db_/, '');
  const candidates = [graph?.name, graph?.url, String(graph?.path || '').split(/[\\/]/).pop()]
    .map(strip).map(value => value.replace(/^.*[\\/]/, '')).filter(Boolean);
  return candidates.some(value => names.includes(value));
}
async function autoDateNew() {
  if (!setting('autoDate') || !await autoDateAllowedHere()) return;
  if (autoDate.running) { autoDate.again = true; return; } // looked at once more when this round ends
  autoDate.running = true;
  try {
    const setup = await graphWide('autoDateSetup', autoDateSetup);
    if (!setup) return;
    // Only records made since the plugin started; older ones wait for the fill command.
    const records = await undatedRecords(setup, autoDate.started - 60000);
    // Filling a date changes the database, which brings the plugin back here. A record whose date
    // still counts as empty after being filled must not be filled again and again, so each record
    // gets a few tries per session; the fill command remains for anything left over.
    for (const uuid of [...records.keys()]) {
      const tries = autoDate.tried.get(uuid) || 0;
      if (tries >= AUTO_DATE_TRIES) records.delete(uuid); else autoDate.tried.set(uuid, tries + 1);
    }
    if (records.size) await (setting('autoDateAsk') ? askThenFill(setup, records) : fillDates(setup, records));
  } catch (error) { warnOnce('journal dates could not be checked', error); }
  finally {
    autoDate.running = false;
    if (autoDate.again) { autoDate.again = false; autoDateNew(); }
  }
}
/* The quick question before a date is filled: a small note at the top right naming the record and
   the day. j fills it, k leaves it (it is not asked again this session), Escape or a click elsewhere
   leaves it for now. While you are typing in a block the keys stay yours; the note's own buttons
   work meanwhile, and it goes away by itself after a while. One record is asked at a time. */
const ask = { open: null, queue: [] };
const askTitle = async id => {
  const block = await logseq.Editor.getBlock(id).catch(() => null);
  return String(block?.title ?? block?.content ?? block?.originalName ?? '').split('\n')[0].replace(/#?\[\[[0-9a-f-]{36}\]\]/gi, '').trim();
};
const shorten = (text, max = 48) => (text.length > max ? text.slice(0, max - 1) + '…' : text);
async function askThenFill(setup, records) {
  for (const [uuid, journalId] of records) {
    if (ask.queue.some(item => item.uuid === uuid) || ask.open?.uuid === uuid) continue;
    ask.queue.push({ setup, uuid, journalId });
  }
  askNext();
}
function askNext() {
  if (ask.open || !ask.queue.length) return;
  const item = ask.queue.shift();
  ask.open = item;
  showAsk(item).catch(error => { warnOnce('the date question could not be shown', error); ask.open = null; askNext(); });
}
/* The question lives where the answer goes. The proposed day is drawn as a ghost value in the record's
   own row: in its empty date pill when Logseq shows one, else right after its title. The ghost is a
   dashed box, as the dashed circle means "not finished": proposed, not written. j, or a click on the
   day, writes it and a bar at the bottom offers Undo; k leaves the record alone for the session; Escape
   or the record leaving the screen leaves it for now. While the record is not on screen (written from
   somewhere else), the small note at the top right asks instead, as before. One record at a time.
   Logseq redraws the row on every change, so the ghost is put back twice a second while it is open. */
const GHOST_EVERY = 500, GHOST_GONE_AFTER = 6; // ticks without the row before "later"
function removeGhost(doc) {
  for (const el of doc.querySelectorAll('.jdd-ghost')) el.remove();
  for (const el of doc.querySelectorAll('[data-jdd-ghost]')) el.removeAttribute('data-jdd-ghost');
}
async function showAsk(item) {
  const [title, day] = await Promise.all([askTitle(item.uuid), askTitle(item.journalId)]);
  if (!day) { ask.open = null; askNext(); return; }
  const doc = host(), win = doc.defaultView;
  doc.querySelector('.jdd-ask')?.remove();
  removeGhost(doc);
  const name = autoDatePropertyName();
  let done = false, note = null, gone = 0, usedGhost = false;
  const finish = async answer => {
    if (done) return;
    done = true;
    clearInterval(keep);
    win.removeEventListener('keydown', onKey, true);
    note?.remove();
    removeGhost(doc);
    if (answer === 'yes') {
      const filled = await fillDates(item.setup, new Map([[item.uuid, item.journalId]]));
      if (filled) showUndoBar(`${name}: ${day} filled for “${shorten(title || 'this record')}”`, () => logseq.Editor.removeBlockProperty(item.uuid, item.setup.ident),
        error => { warnOnce('the date could not be taken off again', error); notify('The date could not be taken off again', 'warning'); });
    }
    // A no is final for this session; a record left for later may be asked again on the next change.
    if (answer !== 'later') autoDate.tried.set(item.uuid, AUTO_DATE_TRIES);
    ask.open = null;
    askNext();
  };
  const typing = el => !!el && (el.matches?.('input, textarea, select, [contenteditable="true"]') || el.closest?.('[contenteditable="true"]'));
  const onKey = event => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
    // While a block is being edited every key belongs to it, Escape included (it leaves the block).
    if (typing(event.target)) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish('later'); return; }
    const key = event.key.toLowerCase();
    if (key !== 'j' && key !== 'k') return;
    event.preventDefault(); event.stopPropagation();
    finish(key === 'j' ? 'yes' : 'no');
  };
  const answerClick = event => { const button = event.target.closest('button[data-answer]'); if (button) { event.preventDefault(); event.stopPropagation(); finish(button.dataset.answer); } };
  const showNote = () => {
    if (note?.isConnected) return;
    note = doc.createElement('div');
    note.className = 'jdd-ask';
    note.setAttribute('role', 'dialog');
    note.innerHTML = `<div class="jdd-ask-text"><span class="jdd-ask-what">${escapeHtml(name)}: ${escapeHtml(day)}</span> for “${escapeHtml(shorten(title || 'this record'))}”?</div>
      <div class="jdd-ask-keys"><button type="button" data-answer="yes">Yes <kbd>j</kbd></button><button type="button" data-answer="no">No <kbd>k</kbd></button></div>`;
    note.addEventListener('mousedown', event => event.stopPropagation());
    note.addEventListener('click', answerClick);
    doc.body.appendChild(note);
  };
  // The record's row on screen, and its empty pill for the date property when Logseq shows one.
  const ghost = () => {
    if (done) return;
    const row = doc.querySelector(`.ls-block[blockid="${item.uuid}"]`);
    if (!row) {
      if (usedGhost && ++gone >= GHOST_GONE_AFTER) { finish('later'); return; }
      if (!usedGhost) showNote();
      return;
    }
    gone = 0;
    const own = el => el.closest('.ls-block[blockid]') === row;
    const pill = [...row.querySelectorAll('.positioned-properties.block-below .bottom-property-pill')].find(p => own(p) && p.firstElementChild?.textContent.trim().toLowerCase() === name.toLowerCase());
    const target = pill || [...row.querySelectorAll('.block-title-wrap')].find(own);
    if (!target) { if (!usedGhost) showNote(); return; }
    if (target.querySelector(':scope > .jdd-ghost')) return;
    usedGhost = true;
    note?.remove();
    const g = doc.createElement('span');
    g.className = 'jdd-ghost';
    g.setAttribute('contenteditable', 'false');
    g.innerHTML = `${pill ? '' : `<span class="jdd-ghost-name">${escapeHtml(name)}:</span>`}<button type="button" data-answer="yes" class="jdd-ghost-value" title="Fill it (j)">${escapeHtml(day)}</button><span class="jdd-ghost-keys"><kbd>j</kbd> fills · <kbd>k</kbd> leaves it</span>`;
    g.addEventListener('mousedown', event => event.stopPropagation());
    g.addEventListener('click', answerClick);
    if (pill) pill.setAttribute('data-jdd-ghost', '');
    target.appendChild(g);
  };
  win.addEventListener('keydown', onKey, true);
  ghost();
  const keep = setInterval(ghost, GHOST_EVERY);
  // The note alone goes away by itself; a ghost in the row waits until answered or the row leaves the screen.
  setTimeout(() => { if (!usedGhost) finish('later'); }, 25000);
  onUnload(() => { if (!done) { done = true; clearInterval(keep); win.removeEventListener('keydown', onKey, true); note?.remove(); removeGhost(doc); } });
}
const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function confirmBox(message, okLabel) {
  return modal(false, (box, finish, doc) => {
    const text = doc.createElement('label');
    text.textContent = message;
    text.style.lineHeight = '1.5';
    const buttons = modalButtons(doc, [['Cancel', () => finish(false)], [okLabel, () => finish(true)]]);
    buttons.style.marginTop = '12px';
    box.append(text, buttons);
    buttons.lastElementChild.focus();
  });
}
async function fillMissingDates() {
  try {
    if (!await autoDateAllowedHere()) return notify('This graph is not listed under “Only in these graphs” in the Refinements settings (Journal day as date), so no dates were filled', 'warning');
    const setup = await autoDateSetup();
    if (!setup) return notify(`Couldn't find the tags (${autoDateTagNames().join(', ')}) or a Date-type property named “${autoDatePropertyName()}”. Check the plugin settings.`, 'warning');
    const records = await undatedRecords(setup, 0);
    if (!records.size) return notify('Every record already has a date, or none was written on a journal day');
    const ok = await confirmBox(`${records.size} record${records.size === 1 ? '' : 's'} tagged ${autoDateTagNames().map(n => '#' + n).join(' or ')} (or a tag that extends them) ${records.size === 1 ? 'has' : 'have'} no ${autoDatePropertyName()}. Fill each with the journal day it was written on? Dates you've already entered are not touched. This cannot be undone in one step.`, 'Fill dates');
    if (!ok) return;
    autoDate.warned = false;
    const filled = await fillDates(setup, records);
    notify(`Filled ${filled} date${filled === 1 ? '' : 's'}`);
  } catch (error) { console.error(error); notify(`Filling dates stopped: ${error.message}`, 'error'); }
}


const settingsSchema = [
  { key: 'journalDateHeading', type: 'heading', title: 'Journal day as date', default: null,
    description: 'The only part of the plugin that writes to your notes. Also in the command palette: “Fill missing dates from journal days”.' },
  { key: 'autoDate', type: 'boolean', title: 'Fill dates automatically', default: true,
    description: 'Fill the date of new records as you write them, in the graphs listed below.' },
  { key: 'autoDateAsk', type: 'boolean', title: 'Ask before filling', default: true,
    description: 'The proposed day is drawn in the record’s own row as a dashed ghost value: j (or a click on it) writes it and a bar at the bottom offers Undo, k leaves the record alone for good, Escape leaves it for now. While you are typing in a block, j, k and Escape stay yours. A record that is not on screen is asked about in a small note at the top right instead. Turn off to fill without asking.' },
  { key: 'autoDateTags', type: 'string', title: 'Tags', default: '',
    description: 'Comma-separated tag names, without #. Tags that extend these are included. Nothing is filled while this is empty.' },
  { key: 'autoDateProperty', type: 'string', title: 'Date property', default: 'Date',
    description: 'The name of the date property to fill. It must be a Date property, not Date and time.' },
  { key: 'autoDateGraphs', type: 'string', title: 'Only in these graphs', default: '',
    description: 'Comma-separated graph names. Dates are filled only in the graphs named here; nothing is filled while this is empty. Plugin settings are shared by all your graphs, so this keeps date filling out of the others.' },
];
const setting = shared.settingReader(settingsSchema);

const promptCss = `
.jdd-prompt-backdrop { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: flex-start; justify-content: center; padding-top: 18vh; background: rgba(0, 0, 0, .25); }
.jdd-prompt { width: min(420px, 90vw); padding: 14px 16px; border: 1px solid var(--ls-border-color); border-radius: 8px; background: var(--ls-primary-background-color); color: var(--ls-primary-text-color); box-shadow: 0 8px 28px rgba(0, 0, 0, .2); }
.jdd-prompt label { display: block; margin-bottom: 8px; font-size: .95em; }
.jdd-prompt input { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--ls-border-color); border-radius: 6px; background: transparent; color: inherit; font: inherit; }
.jdd-prompt-hint { margin-top: 6px; font-size: var(--rf-small, .82em); opacity: var(--rf-quiet, .7); }
.jdd-ask { position: fixed; top: 48px; right: 16px; z-index: 10000; display: flex; align-items: center; gap: 12px; max-width: min(460px, 80vw); padding: 8px 12px; border: 1px solid var(--ls-border-color); border-radius: 8px; background: var(--ls-primary-background-color); color: var(--ls-primary-text-color); box-shadow: 0 4px 16px rgba(0, 0, 0, .12); font-size: .9em; }
.jdd-ask-what { color: var(--ls-secondary-text-color); }
.jdd-ask-keys { display: flex; gap: 6px; flex: none; }
.jdd-ask-keys button { padding: 3px 8px; border: 1px solid var(--ls-border-color); border-radius: 6px; background: transparent; color: inherit; font: inherit; font-size: .95em; cursor: pointer; }
.jdd-ask-keys button:hover { background: var(--ls-tertiary-background-color); }
.jdd-ask-keys kbd { margin-left: 4px; padding: 0 4px; border: 1px solid var(--ls-border-color); border-radius: 4px; font: inherit; font-size: var(--rf-small, .82em); color: var(--ls-secondary-text-color); }
/* The ghost value in the record's own row: dashed means proposed, not written. */
.jdd-ghost { display: inline-flex; align-items: center; gap: .45em; margin-left: .35em; font-size: .95em; vertical-align: baseline; }
.jdd-ghost-name { color: var(--ls-secondary-text-color, currentColor); }
.jdd-ghost-value { border: 1px dashed color-mix(in srgb, var(--ls-primary-text-color, currentColor) 45%, transparent); border-radius: .22em; padding: .02em .28em; background: transparent; color: var(--ls-secondary-text-color, currentColor); font: inherit; font-size: .95em; font-weight: 500; font-variant-numeric: tabular-nums; cursor: pointer; line-height: inherit; }
.jdd-ghost-value:hover { color: var(--ls-primary-text-color, currentColor); border-style: solid; }
.jdd-ghost-keys { font-size: var(--rf-small, .82em); color: var(--ls-secondary-text-color, currentColor); opacity: var(--rf-quiet, .7); white-space: nowrap; }
.jdd-ghost-keys kbd { padding: 0 3px; border: 1px solid var(--ls-border-color); border-radius: 3px; font: inherit; font-size: .9em; }
.ls-block .positioned-properties.block-below .bottom-property-pill[data-jdd-ghost] { display: flex !important; opacity: 1 !important; }
.bottom-property-pill[data-jdd-ghost] .empty-value { display: none !important; }`;

const DB_PAUSE = 800, DB_LONGEST = 2500;
const dbWork = { timer: 0, since: 0 };
function scheduleDbWork() {
  const now = Date.now();
  if (!dbWork.since) dbWork.since = now;
  clearTimeout(dbWork.timer);
  dbWork.timer = setTimeout(() => { dbWork.since = 0; autoDateNew(); }, Math.max(0, Math.min(DB_PAUSE, dbWork.since + DB_LONGEST - now)));
}

function main() {
  // The plugin's one beforeunload callback (in main.js) runs this part's clean-up.
  takeOverFromEarlierCopy();
  logseq.provideStyle({ key: 'journal-day-dates-prompt', style: promptCss });
  // Edits fire this constantly while typing, so the check waits for a pause.
  onUnload(logseq.DB.onChanged(scheduleDbWork));
  onUnload(logseq.App.onRouteChanged(() => graphCache.clear()));
  onUnload(logseq.onSettingsChanged(() => graphCache.clear()));
  onUnload(() => clearTimeout(dbWork.timer));
  logseq.App.registerCommandPalette({ key: 'fill-missing-dates', label: 'Fill missing dates from journal days' }, fillMissingDates);
  // For troubleshooting from the devtools console (the part's own scope is closed otherwise).
  window.journalDatesDebug = { autoDate, ask, autoDateNew, autoDateSetup, undatedRecords, autoDateAllowedHere };
}
(window.refinementParts ||= []).push({ name: 'journal dates', schema: settingsSchema, start: main, stop: runUnloadTasks });
})();
