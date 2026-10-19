/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Properties part of DB Refinements (moved out of main.js in the October 2026 cleanup): what the
   plugin does with properties. The properties shown in a list of records (Choose properties shown in
   this list, the one-line layout with inline values), Fold all / Unfold all results in a query with
   their fold state and fold log, the hidden-properties arrow on every block, and the property crumbs
   (the "via …" labels on records that reach the page through a property).
   It provides its commands, its start functions, its state (listProps, the property crumbs) to the core
   and the other parts, and its own troubleshooting (the fold log, its screen rows); it takes pdfCitations,
   dateLinks and attribute from the links area. */
const shared = window.refinementShared;
const { host, notify, modal, modalButtons, modalHint } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements: ',
  leaves: { elements: '.refinement-hidden-toggle, .refinement-inline-values',
    attributes: ['property-crumb', 'prop-hidden', 'crumb-box', 'hidden-toggle', 'hidden-open', 'hidden-extra', 'hidden-hover', 'value-lead'].map(name => 'data-refinement-' + name) } });
// From the core and the other parts, taken when the part starts (after every part has provided its own).
let setting, dsQuery, UUID, isEntityId, idsIn, uuidsIn, watchDom, watchDomEarly, addsElements, sendStyle, REFERENCE_AREAS, referenceAreas;
let provided, pdfCitations, dateLinks, attribute;
// A name may be the core's own or one another part provided; a missing one is a broken contract.
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };

const propertyCrumbs = { values: new Map(), marked: new Set(), boxes: new Map() };
function updatePropertyCrumbs(doc) {
  const found = new Set();
  if (propertyCrumbs.values.size) {
    for (const crumb of doc.querySelectorAll(`${referenceAreas} .breadcrumb.block-parents`)) {
      const labels = [...crumb.querySelectorAll('.breadcrumb__label')].map(label => label.textContent.trim());
      const group = crumb.parentElement?.parentElement;
      if (labels.length !== 1 || !group) continue;
      const hasValue = [...group.querySelectorAll('.ls-block[blockid]')]
        .some(block => propertyCrumbs.values.get(block.getAttribute('blockid')) === labels[0]);
      if (hasValue) found.add(crumb);
    }
  }
  for (const crumb of propertyCrumbs.marked) if (!found.has(crumb)) unmarkPropertyCrumb(crumb);
  for (const crumb of found) {
    if (!propertyCrumbs.marked.has(crumb)) { crumb.setAttribute('data-refinement-property-crumb', ''); propertyCrumbs.marked.add(crumb); }
    // The line is hidden through the box Logseq draws it in. The box itself is marked, so the rule
    // that hides it is a plain one (it used to ask every div on the page whether it held such a line).
    const box = crumb.parentElement?.tagName === 'DIV' ? crumb.parentElement : null;
    if (propertyCrumbs.boxes.get(crumb) !== box) {
      propertyCrumbs.boxes.get(crumb)?.removeAttribute('data-refinement-crumb-box');
      if (box) { box.setAttribute('data-refinement-crumb-box', ''); propertyCrumbs.boxes.set(crumb, box); } else propertyCrumbs.boxes.delete(crumb);
    }
  }
}
function unmarkPropertyCrumb(crumb) {
  crumb.removeAttribute('data-refinement-property-crumb');
  propertyCrumbs.boxes.get(crumb)?.removeAttribute('data-refinement-crumb-box');
  propertyCrumbs.boxes.delete(crumb);
  propertyCrumbs.marked.delete(crumb);
}
/* Property values written out as text, for one-line lists. Read-only.
   Values come from the database by property ident, so renamed properties keep working. */
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bareIdent = value => String(value ?? '').replace(/^:/, '');
const keyword = ident => ':' + bareIdent(ident);
// Property types whose values point at another entity (a page, or a small text block).
const REF_TYPES = new Set(['default', 'url', 'number', 'date', 'node', 'entity', 'page', 'class', 'property']);

// Every property, by lower-case name. If two share a name, your own wins over a built-in one.
async function propertiesByName() {
  const rows = await dsQuery(`[:find ?ident ?title ?type
    :where [?p :block/tags ?c] [?c :db/ident :logseq.class/Property] [?p :block/title ?title] [?p :db/ident ?ident]
    [(get-else $ ?p :logseq.property/type :default) ?type]]`);
  const byName = new Map();
  for (const [ident, title, type] of rows) {
    const key = String(title).toLowerCase(), info = { ident: bareIdent(ident), title: String(title), type: bareIdent(type) };
    if (!byName.has(key) || info.ident.startsWith('user.property/')) byName.set(key, info);
  }
  return byName;
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
async function readValues(ids, props) {
  const values = new Map(), refs = new Set();
  if (props.length && ids.length) {
    const byIdent = new Map(props.map(prop => [prop.ident, prop]));
    for (const [b, a, v] of await dsQuery(`[:find ?b ?a ?v :where ${idsIn('?b', ids)}
      [(identity [${props.map(p => keyword(p.ident)).join(' ')}]) [?a ...]] [?b ?a ?v]]`)) {
      const prop = byIdent.get(bareIdent(a));
      if (!prop) continue;
      const ref = REF_TYPES.has(prop.type) && Number.isSafeInteger(v);
      if (ref) refs.add(v);
      if (!values.has(b)) values.set(b, new Map());
      const own = values.get(b);
      if (!own.has(prop.ident)) own.set(prop.ident, []);
      own.get(prop.ident).push({ ref, v });
    }
  }
  const entities = new Map();
  if (refs.size) {
    for (const [e, uuid, title, name, day, value] of await dsQuery(`[:find ?e ?uuid ?title ?name ?day ?value
      :where ${idsIn('?e', refs)} [?e :block/uuid ?uuid]
      [(get-else $ ?e :block/title "") ?title] [(get-else $ ?e :block/name "") ?name]
      [(get-else $ ?e :block/journal-day 0) ?day] [(get-else $ ?e :logseq.property/value "") ?value]]`))
      entities.set(e, { uuid: String(uuid), title: String(title || value || ''), page: Boolean(name), day });
  }
  const titles = await mentionedTitles([...entities.values()].map(entity => entity.title));
  return { values, entities, titles };
}
// Text with [[links]]: links stay clickable, tags inside the text are left out.
function linkedText(text, titles) {
  let html = '', last = 0;
  const source = String(text);
  for (const m of source.matchAll(/#?\[\[([^\]]+)\]\]/g)) {
    html += escapeHtml(source.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[0].startsWith('#')) continue;
    const target = m[1], uuid = /^[0-9a-f-]{36}$/i.test(target) ? target : null;
    const label = uuid ? titles.get(uuid.toLowerCase()) || 'link' : target;
    html += `<a class="rt-link" data-uuid="${escapeHtml(uuid || '')}" data-name="${escapeHtml(uuid ? '' : target)}">${escapeHtml(label)}</a>`;
  }
  html += escapeHtml(source.slice(last));
  return html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\s+$/, '');
}
// ": value · Label value", or '' when none of the properties has a value.
// Labels name each value when more than one property is shown.
function valuesHtml(shown, own = new Map(), { entities, titles }) {
  const one = item => {
    if (!item.ref) return escapeHtml(item.v === true ? 'Yes' : item.v === false ? 'No' : item.v);
    const entity = entities.get(item.v);
    if (!entity) return '';
    if (entity.page || entity.day) return `<a class="rt-link" data-uuid="${escapeHtml(entity.uuid)}">${escapeHtml(entity.title)}</a>`;
    return linkedText(entity.title, titles);
  };
  const named = shown.length > 1;
  const parts = shown.map(prop => {
    const list = (own.get(prop.ident) || []).map(one).filter(Boolean);
    if (!list.length) return '';
    return `<span class="rt-value">${named ? `<span class="rt-label">${escapeHtml(prop.title)}</span> ` : ''}${list.join(', ')}</span>`;
  }).filter(Boolean);
  return parts.length ? '<span class="rt-sep">: </span>' + parts.join('<span class="rt-sep"> · </span>') : '';
}

/* Choose which properties a list shows. Logseq's List view always shows every property of each
   record; tables have a column picker, lists don't. This adds one per list: a query (remembered by
   the query block) or the lists on a page such as a tag page (remembered by the page).
   Choices are saved in the plugin's settings. Nothing in the graph changes; other properties are
   only hidden from view in that list, and "Show all" brings them back. */
const listProps = { names: new Set(), marked: new Set(), pageBlocks: new Set(), lastTarget: null,
  inline: new Map(), pending: new Set(), injected: new Set(), inlineTimer: null, inlineVersion: 0,
  localChoices: new Map(), localEdits: 0 };
const NO_PROPERTIES = '\u0000none'; // saved when every property is unticked
const BODY = '\u0000body'; // ticked = show the blocks under each record (its notes, attachments)
const BODY_LABEL = 'Body (notes and files under each record)';
const COMPACT = '\u0000compact'; // ticked = one line per record: title, then the chosen values
const COMPACT_LABEL = 'One line per record (timeline layout)';
// The record a menu or command is about. The same record can be drawn in several places (a query,
// the page itself, linked references), so prefer the copy you actually right-clicked or clicked.
function clickedRecord(event) {
  const doc = host();
  const last = listProps.lastTarget?.closest?.('.ls-block[blockid]');
  if (typeof event?.uuid !== 'string') return listProps.lastTarget;
  if (last?.getAttribute('blockid') === event.uuid && last.isConnected) return last;
  return doc.querySelector(`#main-content-container .ls-block[blockid="${event.uuid}"]`) || doc.querySelector(`.ls-block[blockid="${event.uuid}"]`);
}
// Saved settings arrive in the background, so choices made in this session take priority.
const savedListChoices = () => ({ ...(logseq.settings?.listProperties || {}), ...Object.fromEntries(listProps.localChoices) });
// Read again only when the saved settings or this session's choices have changed.
const listChoicesMemo = { saved: undefined, local: -1, result: new Map() };
function listChoices() {
  const memo = listChoicesMemo, saved = logseq.settings?.listProperties;
  if (memo.saved === saved && memo.local === listProps.localChoices.size + listProps.localEdits) return memo.result;
  memo.saved = saved;
  memo.local = listProps.localChoices.size + listProps.localEdits;
  const result = memo.result = new Map();
  for (const [key, value] of Object.entries(savedListChoices())) {
    try {
      const names = JSON.parse(value || '[]');
      if (Array.isArray(names) && names.length) result.set(key, new Set(names.map(String)));
    } catch (error) { /* ignore a damaged entry */ }
  }
  return result;
}
async function loadPropertyNames() {
  const version = listProps.namesVersion = (listProps.namesVersion || 0) + 1;
  try {
    const rows = await logseq.DB.datascriptQuery(`[:find ?name
      :where [?p :block/tags ?c] [?c :db/ident :logseq.class/Property] [?p :block/title ?name]]`);
    if (version !== listProps.namesVersion) return;
    listProps.names = new Set((rows || []).map(([name]) => String(name)).filter(Boolean));
    if (dateLinks.document) updateListProps(dateLinks.document);
  } catch (error) { warnOnce('could not load property names', error); }
}
const ownedBy = (el, row) => el.closest('.ls-block') === row;
function ownQuery(block) {
  const query = block.querySelector('.custom-query');
  return Boolean(query && query.closest('.ls-block') === block);
}
// Which list an element belongs to: the nearest query block, otherwise the open page.
function listKeyFor(el) {
  for (let block = el?.closest?.('.ls-block[blockid]'); block; block = block.parentElement?.closest('.ls-block[blockid]')) {
    if (ownQuery(block)) return { key: 'query:' + block.getAttribute('blockid'), label: 'this query' };
  }
  if (el?.closest?.('#main-content-container') && pdfCitations.pageUuid)
    return { key: 'page:' + pdfCitations.pageUuid, label: 'lists on this page' };
  return null;
}
// The records shown in a list (not their child blocks, and not the page's own blocks).
function listRows(doc, key) {
  const [kind, uuid] = key.split(':');
  const rows = [];
  if (kind === 'query') {
    for (const container of doc.querySelectorAll(`.ls-block[blockid="${uuid}"]`)) {
      for (const row of container.querySelectorAll('.ls-block[blockid]'))
        if (row !== container && row.parentElement?.closest('.ls-block') === container) rows.push(row);
    }
  } else if (kind === 'page' && uuid === pdfCitations.pageUuid) {
    const main = doc.getElementById('main-content-container');
    for (const row of main?.querySelectorAll('.ls-block[blockid]') || []) {
      if (row.parentElement?.closest('.ls-block') || listProps.pageBlocks.has(row.getAttribute('blockid'))) continue;
      if (row.closest(REFERENCE_AREAS)) continue;
      rows.push(row);
    }
  }
  return rows;
}
// A property's name as it appears on screen ("Diagnosis" or "Diagnosis:"), if it is one.
function propertyNameOf(el) {
  const text = (el.textContent || '').trim().replace(/:$/, '').trim();
  return text && listProps.names.has(text) ? text : null;
}
function propertyKeys(row) {
  const keys = [];
  for (const el of row.querySelectorAll('*')) {
    if (!ownedBy(el, row) || el.closest('.block-title-wrap, .bullet-container')) continue;
    const isKey = el.classList.contains('page-property-key') || el.classList.contains('property-key') ||
      (el.childElementCount === 0 && propertyNameOf(el));
    if (!isKey) continue;
    const name = propertyNameOf(el);
    if (name && !keys.some(k => k.el.contains(el))) keys.push({ el, name });
  }
  return keys;
}
// Widen from the property's name to its whole row or pill, stopping before anything that holds
// another property, the record's title or its bullet.
// Property values are small blocks with bullets of their own, so only the record's own title or
// bullet counts as a stopping point, not those inside a value.
// The record's own bullet and title are the first ones it draws; property names and values come
// after and have bullets of their own, which must not count.
function recordAnchors(row) {
  const first = selector => [...row.querySelectorAll(selector)].find(el => ownedBy(el, row));
  return [first('.bullet-container'), first('.block-title-wrap')].filter(Boolean);
}
function holdsRecordTitle(el, row) {
  if (recordAnchors(row).some(anchor => el.contains(anchor))) return true;
  return [...el.querySelectorAll('textarea, [contenteditable="true"], .editor-wrapper')].some(found => ownedBy(found, row));
}
// A record you're typing in is left exactly as Logseq draws it: its text becomes an editing box,
// which must never be hidden.
const beingEdited = row => [...row.querySelectorAll('textarea, [contenteditable="true"], .editor-wrapper')].some(el => ownedBy(el, row));
function propertyBox(key, row, keys) {
  let box = key;
  for (let parent = box.parentElement; parent && parent !== row; parent = parent.parentElement) {
    if (holdsRecordTitle(parent, row)) break;
    if (keys.some(other => other.el !== key && parent.contains(other.el))) break;
    box = parent;
  }
  return box;
}
// Everything to hide for one property: its row, or, when Logseq lays names and values out as
// side-by-side cells, the name cell and the value cell that follows it.
function propertyParts(key, name, row, keys) {
  const box = propertyBox(key, row, keys);
  const parts = [box];
  const text = (box.textContent || '').trim().replace(/:$/, '').trim();
  if (text === name) {
    const value = box.nextElementSibling;
    if (value && !keys.some(other => value.contains(other.el)) && !holdsRecordTitle(value, row) &&
        !value.matches('.block-children-container, .block-children') && !value.querySelector('.block-children-container, .block-children'))
      parts.push(value);
  }
  return parts;
}
function updateListProps(doc) {
  const choices = listChoices();
  const hide = new Set(), inline = new Map();
  if (choices.size && listProps.names.size) {
    for (const [key, shown] of choices) {
      const compact = shown.has(COMPACT);
      const names = compact ? [...shown].filter(name => name !== COMPACT && name !== BODY && name !== NO_PROPERTIES) : [];
      for (const row of listRows(doc, key)) {
        if (beingEdited(row)) continue;
        const keys = propertyKeys(row);
        for (const { el, name } of keys) if (compact || !shown.has(name)) for (const part of propertyParts(el, name, row, keys)) hide.add(part);
        if (!shown.has(BODY))
          for (const children of row.querySelectorAll('.block-children-container')) if (ownedBy(children, row)) hide.add(children);
        if (compact) {
          // Leftover property areas (empty rows, the add-property button) would still take space.
          for (const area of row.querySelectorAll('.positioned-properties.block-below, .ls-properties-area'))
            if (ownedBy(area, row) && !holdsRecordTitle(area, row)) hide.add(area);
          inline.set(row, names);
        }
      }
    }
  }
  updateInlineValues(doc, inline);
  for (const el of listProps.marked) if (!hide.has(el)) { el.removeAttribute('data-refinement-prop-hidden'); listProps.marked.delete(el); }
  for (const el of hide) if (!listProps.marked.has(el)) { el.setAttribute('data-refinement-prop-hidden', ''); listProps.marked.add(el); }
}
/* Fold or unfold every result of a query (or every record listed on a page) at once.
   Inside a query, Logseq keeps each result's fold state on screen, per list, and resets it when
   a result is drawn again (pages always come back folded). The plugin API's setBlockCollapsed
   only changes the saved state, so results folded back on their own. Instead this presses each
   result's own fold arrow, exactly as a click would, and remembers the choice for that list
   while the page is open: results drawn later (scrolling, or after Logseq redraws the list)
   are set the same way. A result you fold or unfold yourself afterwards keeps your choice. */
/* Troubleshooting for fold-all: once a fold command runs, note every fold change on a query result
   and what happened around it, so "Copy fold log" can show why a result folded back. */
const foldLog = { lines: [], last: '', start: 0, observer: null, scrollAt: 0, pressedAt: new WeakMap() };
function logFold(text) {
  if (!foldLog.start || text === foldLog.last) return; // repeats (like waiting while you type) once
  foldLog.last = text;
  foldLog.lines.push(`${((Date.now() - foldLog.start) / 1000).toFixed(2)}s ${text}`);
  if (foldLog.lines.length > 400) foldLog.lines.splice(0, foldLog.lines.length - 400);
}
const rowName = row => {
  const content = [...row.querySelectorAll('.block-content')].find(el => el.closest('.ls-block') === row);
  return `"${(content?.textContent || row.getAttribute('blockid') || '?').trim().replace(/\s+/g, ' ').slice(0, 30)}"`;
};
const listFold = { wanted: new Map(), pressed: new WeakMap(), manual: new WeakSet(), round: 0, timers: [], observer: null, frame: 0 };
// A press takes Logseq a moment; until the result changes, pressing again would undo it.
const PRESS_WAIT = 600;
const MAX_MISSES = 3; // presses that changed nothing, so a result Logseq refuses to change can't loop
const MAX_PRESSES = 6; // in all, per result per command, so a tug-of-war with Logseq ends
// The fold arrow a record draws for itself (not one of its children's).
const foldArrow = row => [...row.querySelectorAll('a.block-control')].find(el => el.closest('.ls-block') === row);
function applyListFolds(doc) {
  // Logseq's arrow ends any editing, so never press while you are typing; it catches up afterwards.
  const typing = doc.activeElement?.matches('textarea, input, [contenteditable="true"]') && doc.activeElement.closest('.ls-block');
  if (!listFold.wanted.size) return;
  if (typing) return logFold('waiting: you are editing a block');
  let pressedAny = false;
  for (const [key, { collapse, round }] of listFold.wanted) {
    for (const row of listRows(doc, key)) {
      if (listFold.manual.has(row)) continue; // you folded or unfolded this one yourself
      if ((row.getAttribute('data-collapsed') === 'true') === collapse) continue;
      if (collapse && row.getAttribute('haschild') === 'false') continue; // nothing to fold
      const arrow = foldArrow(row);
      const last = listFold.pressed.get(row);
      const earlier = last?.round === round && !last.changed ? last : null; // a press not yet seen to act
      // Still waiting for the last press to show? Then leave it alone.
      if (earlier && Date.now() - earlier.at < PRESS_WAIT) continue;
      // A press that changed nothing counts as a miss; one that worked (and Logseq later undid) does not.
      const misses = earlier ? earlier.misses + 1 : 0;
      // A press that worked but that Logseq keeps undoing would otherwise be repeated forever.
      const total = (last?.round === round ? last.total || 0 : 0) + 1;
      if (!arrow || misses >= MAX_MISSES || total > MAX_PRESSES) {
        if (!last?.gaveUp) logFold(`${rowName(row)} left as is: ${!arrow ? 'no fold arrow found' : total > MAX_PRESSES ? 'Logseq kept changing it back' : 'pressing did not change it'}`);
        listFold.pressed.set(row, { round, at: Date.now(), misses, total, gaveUp: true });
        continue;
      }
      listFold.pressed.set(row, { round, at: Date.now(), misses, total, changed: false });
      foldLog.pressedAt.set(row, Date.now());
      logFold(`plugin presses ${rowName(row)}${misses ? ` (again: ${misses} without effect)` : ''}`);
      arrow.click();
      pressedAny = true;
    }
  }
  // Logseq's arrow acts a moment after the press; look again shortly after, in case it was undone.
  if (pressedAny) recheckListFolds();
}
/* Logseq draws a result first, then sets its fold a moment later by changing only the result's
   data-collapsed attribute. The shared watcher doesn't see attribute changes, so while a fold-all
   choice is active a small watcher looks at just that attribute. */
function watchFoldState() {
  if (listFold.observer) return;
  const doc = host(), win = doc.defaultView;
  listFold.observer = new win.MutationObserver(records => {
    for (const record of records) {
      const pressed = listFold.pressed.get(record.target);
      if (pressed && !pressed.gaveUp && record.oldValue !== record.target.getAttribute('data-collapsed')) pressed.changed = true;
    }
    if (listFold.frame) return;
    listFold.frame = win.requestAnimationFrame(() => { listFold.frame = 0; applyListFolds(doc); });
  });
  listFold.observer.observe(doc.body, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-collapsed'] });
}
function stopFoldState() {
  if (listFold.wanted.size) logFold('page changed: fold-all choice cleared');
  // The log's watcher looks at every change on screen, so it runs only while a choice is active.
  foldLog.observer?.disconnect();
  foldLog.observer = null;
  listFold.wanted.clear();
  listFold.observer?.disconnect();
  listFold.observer = null;
  for (const timer of listFold.timers) clearTimeout(timer);
}
function recheckListFolds() {
  for (const timer of listFold.timers) clearTimeout(timer);
  listFold.timers = [PRESS_WAIT + 50, 1200, 2500].map(ms => setTimeout(() => applyListFolds(host()), ms));
}
// The list a command is about: the record you right-clicked or last clicked, the block you are
// editing, or else the query on screen (the one nearest the top when there are several).
async function foldTarget(event) {
  const doc = host();
  const direct = listKeyFor(clickedRecord(event));
  if (direct) return direct;
  const editing = await logseq.Editor.getCurrentBlock().catch(() => null);
  const editingRow = editing && doc.querySelector(`#main-content-container .ls-block[blockid="${editing.uuid}"]`);
  const fromEditing = editingRow && listKeyFor(editingRow);
  if (fromEditing) return fromEditing;
  const height = doc.defaultView.innerHeight;
  const queries = [...doc.querySelectorAll('#main-content-container .custom-query')]
    .map(query => query.closest('.ls-block[blockid]')).filter(Boolean)
    .map(block => ({ block, top: block.getBoundingClientRect().top, bottom: block.getBoundingClientRect().bottom }));
  const onScreen = queries.filter(q => q.bottom > 0 && q.top < height);
  const pick = (onScreen.length ? onScreen : queries)[0];
  return pick ? listKeyFor(pick.block) : null;
}
async function foldQueryResults(event, collapse) {
  try {
    const target = await foldTarget(event);
    if (!target) return notify('No query found on this page. Click in a query or one of its results first', 'warning');
    startFoldLog();
    logFold(`command: ${collapse ? 'fold' : 'unfold'} all in ${target.key.slice(0, 14)}… (${listRows(host(), target.key).length} results drawn)`);
    listFold.wanted.set(target.key, { collapse, round: ++listFold.round });
    // A new command applies to every result again, including ones you changed by hand before.
    listFold.manual = new WeakSet();
    // What there is to do, counted before pressing. A result with no fold arrow has nothing under it.
    const rows = listRows(host(), target.key);
    const folded = row => row.getAttribute('data-collapsed') === 'true';
    const toChange = rows.filter(row => folded(row) !== collapse && (!collapse || (row.getAttribute('haschild') !== 'false' && foldArrow(row))));
    const noArrow = toChange.filter(row => !foldArrow(row)).length; // only a folded result that cannot be unfolded
    watchFoldState();
    applyListFolds(host());
    recheckListFolds();
    const done = collapse ? 'folded' : 'unfolded', n = toChange.length, later = `results drawn later will be ${done} too`;
    if (!rows.length) notify(`No results are drawn in ${target.label} yet; they will be ${done} as they appear`);
    else if (noArrow) notify(`${noArrow} of ${n} folded result${n === 1 ? '' : 's'} in ${target.label} ${noArrow === 1 ? 'has' : 'have'} no fold arrow to press and stay${noArrow === 1 ? 's' : ''} folded. Run “Copy fold log” for details`, 'warning');
    else if (n) notify(`${collapse ? 'Folding' : 'Unfolding'} ${n} result${n === 1 ? '' : 's'} in ${target.label}; ${later}`);
    else if (collapse && !rows.some(folded)) notify(`None of the ${rows.length} result${rows.length === 1 ? '' : 's'} drawn in ${target.label} has anything under it to fold; ${later}`);
    else notify(`Every result drawn in ${target.label} is already ${done}; ${later}`);
  } catch (error) { console.error(error); notify(`Could not fold the results: ${error.message}`, 'error'); }
}
/* One line per record: for lists set to the timeline layout, the chosen values are written after
   each record's title (from the database), and Logseq's own property rows are hidden. The list
   stays Logseq's: its query, filters, sorting, grouping and live updates are unchanged. */
const inlineWritten = new WeakMap();
const inlineKey = (uuid, names) => uuid + '|' + names.join('|');
function updateInlineValues(doc, inline) {
  const keep = new Set();
  for (const [row, names] of inline) {
    const uuid = row.getAttribute('blockid');
    const wrap = [...row.querySelectorAll('.block-title-wrap')].find(el => ownedBy(el, row));
    if (!uuid || !wrap || !names.length) continue;
    const key = inlineKey(uuid, names);
    if (!listProps.inline.has(key)) { listProps.pending.add(key); continue; }
    const html = listProps.inline.get(key);
    let span = [...wrap.children].find(el => el.classList.contains('refinement-inline-values'));
    if (!html) { span?.remove(); continue; }
    if (!span) {
      span = doc.createElement('span');
      span.className = 'refinement-inline-values';
      span.setAttribute('contenteditable', 'false');
      wrap.appendChild(span);
    }
    // Compare with what was last written, not innerHTML: the browser re-spells HTML, which would rewrite it forever.
    if (span.getAttribute('data-key') !== key || inlineWritten.get(span) !== html) { span.setAttribute('data-key', key); span.innerHTML = html; inlineWritten.set(span, html); }
    keep.add(span);
  }
  for (const span of listProps.injected) if (!keep.has(span)) span.remove();
  listProps.injected = keep;
  if (listProps.pending.size) scheduleInlineValues(50);
}
// After an edit, reload the values of every one-line row on screen.
function refreshInlineValues() {
  for (const span of listProps.injected) { const key = span.getAttribute('data-key'); if (key) listProps.pending.add(key); }
  if (listProps.pending.size) scheduleInlineValues(0);
}
function scheduleInlineValues(delay = 800) {
  clearTimeout(listProps.inlineTimer);
  listProps.inlineTimer = setTimeout(loadInlineValues, delay);
}
async function loadInlineValues() {
  const keys = [...listProps.pending];
  listProps.pending.clear();
  if (!keys.length) return;
  const version = ++listProps.inlineVersion;
  try {
    const wanted = keys.map(key => { const [uuid, ...names] = key.split('|'); return { key, uuid, names }; });
    const propByName = await propertiesByName();
    const shownFor = names => names.map(name => propByName.get(name.toLowerCase())).filter(Boolean);
    const props = [...new Set(wanted.flatMap(w => shownFor(w.names)))];
    const idRows = await dsQuery(`[:find ?b ?uuid :where ${uuidsIn('?uuid', wanted.map(w => w.uuid))} [?b :block/uuid ?uuid]]`);
    const idOf = new Map(idRows.map(([b, uuid]) => [String(uuid), b]));
    const { values, entities, titles } = await readValues([...idOf.values()], props);
    if (version !== listProps.inlineVersion) return;
    for (const { key, uuid, names } of wanted)
      listProps.inline.set(key, valuesHtml(shownFor(names), values.get(idOf.get(uuid)), { entities, titles }));
    if (dateLinks.document) updateListProps(dateLinks.document);
  } catch (error) { warnOnce('could not load values for one-line lists', error); }
}
function startListProps() {
  try {
    const doc = host(), win = doc.defaultView;
    logseq.provideStyle({ key: 'personal-db-list-props', style: `[data-refinement-prop-hidden] { display: none !important; }
.refinement-inline-values { font-weight: normal; }
.refinement-inline-values .rt-link { cursor: pointer; color: var(--ls-link-text-color, inherit); }
.refinement-inline-values .rt-link:hover { text-decoration: underline; }
.refinement-inline-values .rt-label { font-size: var(--rf-small); opacity: var(--rf-faint); }
.refinement-inline-values .rt-sep { opacity: var(--rf-faint); }` });
    // Links inside the one-line values open their page (Shift opens it in the sidebar) without starting an edit.
    listen(win, ['mousedown', 'click'], event => {
      const link = event.target?.closest?.('.refinement-inline-values .rt-link');
      if (!link) return;
      event.preventDefault(); event.stopPropagation();
      if (event.type === 'click') openEntity(link.getAttribute('data-uuid'), event.shiftKey);
    });
    // A result you fold or unfold yourself keeps your choice over a fold-all command.
    listen(win, ['click'], event => {
      if (!event.isTrusted) return;
      const row = event.target?.closest?.('a.block-control')?.closest('.ls-block');
      if (row) { listFold.manual.add(row); logFold(`you clicked the arrow of ${rowName(row)}`); }
    });
    // Remember where you last clicked, so the command palette knows which list you mean.
    listen(win, ['pointerdown'], event => { listProps.lastTarget = event.target; });
    watchDom(updateListProps);
    watchDomEarly(function listPropsEarly(doc, records) {
      if (addsElements(records) && listChoices().size) updateListProps(doc);
    });
    watchDom(applyListFolds);
    loadPropertyNames();
    onUnload(() => {
      clearTimeout(listProps.inlineTimer);
      stopFoldState();
      for (const span of listProps.injected) span.remove();
      listProps.injected.clear();
      for (const el of listProps.marked) el.removeAttribute('data-refinement-prop-hidden');
      listProps.marked.clear();
    });
  } catch (error) { warnOnce('list property choices are unavailable', error); }
}
// Properties the records in a list actually use, for the picker.
async function propertiesInList(doc, key) {
  const ids = [];
  for (const row of listRows(doc, key).slice(0, 300)) {
    const uuid = row.getAttribute('blockid');
    try {
      const entity = await logseq.Editor.getBlock(uuid) || await logseq.Editor.getPage(uuid);
      if (isEntityId(entity?.id)) ids.push(entity.id);
    } catch (error) { /* skip */ }
  }
  if (!ids.length) return [];
  const rows = await logseq.DB.datascriptQuery(`[:find ?name ?a
    :where ${idsIn('?b', ids)}
    [?b ?a _] [?p :db/ident ?a]
    [?p :block/tags ?c] [?c :db/ident :logseq.class/Property]
    [?p :block/title ?name]]`);
  // Your own properties, plus the few built-in ones Logseq shows on a record. Internal ones
  // ("Node created at", "Node collapsed?" and the like) are never shown, so they are not offered.
  const visibleBuiltIns = /^:?(?:(?:block\/)?alias|logseq\.property\/(?:description|status|priority|deadline|scheduled))$/;
  const offered = (rows || []).filter(([, ident]) => /^:?user\.property\//.test(String(ident)) || visibleBuiltIns.test(String(ident)));
  return [...new Set(offered.map(([name]) => String(name)))].filter(Boolean).sort((a, b) => a.localeCompare(b));
}
function askListProperties(label, names, shown) {
  return modal(null, (box, finish, doc) => {
    const heading = doc.createElement('label');
    heading.textContent = `Properties to show in ${label}`;
    const list = doc.createElement('div');
    list.style.cssText = 'max-height:50vh;overflow:auto;margin:4px 0 10px;';
    // Drawn by the plugin rather than as browser checkboxes, which Logseq's own styling can hide.
    const boxes = names.map(name => {
      const line = doc.createElement('div');
      line.setAttribute('role', 'checkbox');
      line.tabIndex = 0;
      line.style.cssText = 'display:flex;align-items:center;gap:10px;margin:0;padding:4px 2px;font-size:.95em;cursor:pointer;user-select:none;border-radius:4px;';
      const mark = doc.createElement('span');
      mark.style.cssText = 'flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1px solid var(--ls-border-color, rgba(128,128,128,.5));border-radius:4px;font-size:12px;line-height:1;';
      line.append(mark, doc.createTextNode(name === BODY ? BODY_LABEL : name === COMPACT ? COMPACT_LABEL : name));
      if (name === BODY) line.style.cssText += 'margin-top:6px;padding-top:8px;border-top:1px solid var(--ls-border-color, rgba(128,128,128,.25));';
      list.append(line);
      const item = { name, checked: name === COMPACT ? shown.has(COMPACT) : shown.has(name) || (!shown.size) };
      const paint = () => {
        line.setAttribute('aria-checked', String(item.checked));
        mark.textContent = item.checked ? '✓' : '';
        mark.style.background = item.checked ? 'var(--ls-secondary-text-color, #777)' : 'transparent';
        mark.style.color = 'var(--ls-primary-background-color, #fff)';
        mark.style.borderColor = item.checked ? 'transparent' : 'var(--ls-border-color, rgba(128,128,128,.5))';
      };
      const toggle = () => { item.checked = !item.checked; paint(); };
      line.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); toggle(); });
      line.addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggle(); } });
      paint();
      return item;
    });
    const buttons = modalButtons(doc, [
      ['Show all', () => finish([])],
      ['Cancel', () => finish(null)],
      ['Save', () => {
        const picked = boxes.filter(b => b.checked).map(b => b.name);
        const plain = boxes.filter(b => b.name !== COMPACT);
        // All ticked (and no one-line layout) means Logseq's normal view; none ticked means hide every property.
        finish(!picked.includes(COMPACT) && plain.every(b => b.checked) ? [] : picked.length ? picked : [NO_PROPERTIES]);
      }],
    ]);
    box.append(heading, list, buttons, modalHint(doc, 'Unticked properties are hidden in this list only. Nothing in your notes changes.'));
    list.firstElementChild?.focus();
  });
}
async function chooseListProperties(event) {
  try {
    const doc = host();
    // The bullet menu passes the clicked record; the command palette uses where you last clicked.
    const clicked = clickedRecord(event);
    const target = listKeyFor(clicked);
    if (!target) return notify('Click in a record first', 'warning');
    if (!listProps.names.size) await loadPropertyNames();
    const names = [...await propertiesInList(doc, target.key), BODY, COMPACT];
    const saved0 = listChoices().get(target.key);
    // Nothing saved: everything starts ticked. "Hide all" saved: everything starts unticked.
    const current = !saved0 ? new Set() : saved0.has(NO_PROPERTIES) ? new Set([NO_PROPERTIES]) : saved0;
    const picked = await askListProperties(target.label, names, current);
    if (picked === null) return;
    const saved = savedListChoices();
    saved[target.key] = JSON.stringify(picked);
    listProps.localChoices.set(target.key, saved[target.key]);
    listProps.localEdits++;
    logseq.updateSettings({ listProperties: saved });
    // Settings update in the background; apply right away from what was picked.
    setTimeout(() => updateListProps(doc), 150);
    const count = picked.filter(name => name !== NO_PROPERTIES && name !== BODY && name !== COMPACT).length;
    notify(!picked.length ? `Showing all properties in ${target.label}`
      : count ? `Showing ${count} propert${count === 1 ? 'y' : 'ies'} in ${target.label}` : `Hiding all properties in ${target.label}`);
  } catch (error) { console.error(error); notify(`Could not choose properties: ${error.message}`, 'error'); }
}

/* Hidden properties: Logseq draws its "Show hidden properties" button only on the block you have
   zoomed into. This draws it on every block that has hidden properties, as a small fold arrow; Logseq's
   own button (when zoomed in) loses its words too. Logseq's per-block switch behind its button cannot
   be reached by a plugin, so the arrow uses Logseq's "show all properties" for that one block (as
   selecting it and pressing p a does) and hides the rows that adds which are not hidden properties,
   so the same list opens. A hidden property is a value that Logseq hides: a property set to hide by default
   that the block holds. An empty slot (a tag's property set to hide when empty, with nothing in it; Logseq's
   four task fields are all so) is not one (0.4.110): the arrow sat on nearly every task and opened blanks. */
const hiddenProps = { byBlock: new Map(), buttons: new Set(), marked: new Set(), generation: 0, hover: null };
// Properties Logseq never lists (its own internal ones) and the query of a query block.
const HIDDEN_LISTED = `(or-join [?p] (not [?p :logseq.property/built-in? true]) [?p :logseq.property/public? true])
  [?p :db/ident ?pi] [(not= ?pi :logseq.property/query)] [?p :block/title ?title]`;
async function loadHiddenProps() {
  if (!setting('hiddenPropsChevron')) return;
  const generation = ++hiddenProps.generation;
  try {
    const rows = await dsQuery(`[:find ?u ?title :where [?p :logseq.property/hide? true] ${HIDDEN_LISTED} [?b ?pi] [?b :block/uuid ?u]]`);
    if (generation !== hiddenProps.generation) return;
    const byBlock = new Map();
    for (const [uuid, title] of rows) {
      if (!byBlock.has(uuid)) byBlock.set(uuid, new Set());
      byBlock.get(uuid).add(String(title));
    }
    hiddenProps.byBlock = byBlock;
    updateHiddenProps(host());
  } catch (error) { warnOnce('hidden properties could not be read', error); }
}
// Blocks whose properties are all shown through Logseq's "show all properties" (one block at a time).
function hiddenPropsOpen(doc) {
  try {
    const state = doc.defaultView.logseq?.api?.get_state_from_store?.('ui/show-empty-and-hidden-properties?');
    if (!state?.['show?'] || state.mode !== 'block') return new Set();
    return new Set([...(state.ids || [])].map(String));
  } catch (error) { return new Set(); }
}
// The arrow itself is drawn by hiddenPropsCss, like the fold arrow beside a block.
function setHiddenToggle(button, open) {
  const state = open ? 'open' : 'closed';
  if (button.getAttribute('data-refinement-hidden-open') === state) return;
  button.setAttribute('data-refinement-hidden-open', state);
  button.setAttribute('aria-label', open ? 'Collapse hidden properties' : 'Show hidden properties');
  button.title = open ? 'Collapse hidden properties' : 'Show hidden properties';
}
// The arrows show while you point at their block (not at a block inside it), as fold arrows do, or
// anywhere near the arrow itself, even outside its block.
const HIDDEN_TOGGLES = '.bottom-property-hidden-toggle-btn, .hidden-properties-toggle-row, [data-refinement-hidden-toggle]';
function hiddenTogglesOf(block) {
  return block ? [...block.querySelectorAll(HIDDEN_TOGGLES)].filter(el => el.closest('.ls-block[blockid]') === block) : [];
}
const HIDDEN_NEAR_X = 48, HIDDEN_NEAR_Y = 16; // how far from the arrow (px) still counts as near it
function hoverHiddenProps(block, x, y, doc) {
  hiddenProps.hover = block;
  const show = new Set(hiddenTogglesOf(block));
  if (doc && x !== undefined) {
    for (const el of doc.querySelectorAll(HIDDEN_TOGGLES)) {
      const box = el.getBoundingClientRect();
      if (!box.width) continue;
      if (x >= box.left - HIDDEN_NEAR_X && x <= box.right + HIDDEN_NEAR_X && y >= box.top - HIDDEN_NEAR_Y && y <= box.bottom + HIDDEN_NEAR_Y) show.add(el);
    }
  }
  for (const el of hiddenProps.shown || []) if (!show.has(el)) el.removeAttribute('data-refinement-hidden-hover');
  for (const el of show) if (!el.hasAttribute('data-refinement-hidden-hover')) el.setAttribute('data-refinement-hidden-hover', '');
  hiddenProps.shown = show;
}
// Where the arrow goes: after the row of properties under the block, else at the end of its
// property list, else in the empty space Logseq keeps for that list.
// The arrow sits right after the block's own text, the same place on every block. While the block is being
// edited it has no such text, and the arrow waits. A block drawn without that text keeps the old places.
function hiddenTogglePlace(block, own) {
  if ([...block.querySelectorAll('textarea, [contenteditable="true"]')].some(own)) return null;
  return [...block.querySelectorAll('.block-title-wrap')].find(el => own(el) && !el.closest('a.page-ref, .positioned-properties, .ls-properties-area'))
    || [...block.querySelectorAll('.positioned-properties.block-below .bottom-properties-pills-strip')].find(own)
    || [...block.querySelectorAll('.ls-properties-area')].find(own)
    || [...block.querySelectorAll('.ls-block-content-indent')].find(el => own(el) && !el.classList.contains('ls-inline-comments'));
}
function updateHiddenProps(doc) {
  const on = setting('hiddenPropsChevron');
  const open = on ? hiddenPropsOpen(doc) : new Set();
  const buttons = new Set(), marks = new Set();
  if (on) for (const block of doc.querySelectorAll('.ls-block[blockid]')) {
    const uuid = block.getAttribute('blockid');
    // A block left open keeps its arrow and its filtering even when nothing on it is hidden any more
    // (a tag's property was set to show when empty), so it can still be closed.
    const hidden = hiddenProps.byBlock.get(uuid) || (open.has(uuid) ? new Set() : null);
    if (!hidden || block.closest('.ls-page-title, .page-title')) continue;
    const own = el => el.closest('.ls-block') === block;
    // A folded block shows none of its properties (Logseq folds even a block with no children), so the arrow
    // would change nothing there and is left off until the block is unfolded.
    if ([...block.querySelectorAll('.bullet-container.bullet-closed')].some(own)) continue;
    const toggles = hiddenTogglesOf(block);
    if (toggles.some(el => !el.hasAttribute('data-refinement-hidden-toggle'))) continue; // zoomed in: Logseq's own button
    const isOpen = open.has(uuid);
    if (isOpen) {
      for (const row of block.querySelectorAll('.ls-properties-area .property-pair.property-panel-row[data-property-title]')) {
        if (own(row) && !hidden.has(row.getAttribute('data-property-title'))) marks.add(row);
      }
    }
    const place = hiddenTogglePlace(block, own);
    if (!place) continue;
    let button = toggles[0];
    if (!button) {
      button = doc.createElement('button');
      button.type = 'button';
      button.className = 'refinement-hidden-toggle';
      button.setAttribute('data-refinement-hidden-toggle', uuid);
    }
    setHiddenToggle(button, isOpen);
    if (block === hiddenProps.hover) button.setAttribute('data-refinement-hidden-hover', '');
    if (button.parentElement !== place || button !== place.lastElementChild) place.appendChild(button);
    buttons.add(button);
  }
  for (const button of hiddenProps.buttons) if (!buttons.has(button)) button.remove();
  hiddenProps.buttons = buttons;
  for (const row of hiddenProps.marked) if (!marks.has(row)) row.removeAttribute('data-refinement-hidden-extra');
  for (const row of marks) if (!row.hasAttribute('data-refinement-hidden-extra')) row.setAttribute('data-refinement-hidden-extra', '');
  hiddenProps.marked = marks;
}
async function toggleHiddenProps(uuid) {
  try {
    await logseq.Editor.selectBlock(uuid);
    await logseq.App.invokeExternalCommand('logseq.editor/toggle-display-hidden-properties');
  } catch (error) { warnOnce('hidden properties could not be shown', error); }
  try { await logseq.Editor.clearSelectedBlocks(); } catch (error) { /* nothing was selected */ }
  updateHiddenProps(host());
}
const hiddenPropsCss = `/* Logseq's own button (on a zoomed-in block) and the plugin's: no words, just a small muted
   chevron that turns like the fold arrow beside a block, pointing right while the hidden properties are folded
   and down while they are open. It shows while you point at its block, or while it is open. */
.ls-block .bottom-property-hidden-toggle-btn { font-size: 0 !important; gap: 0 !important; padding: 0 .25rem !important;
  background: transparent !important; color: var(--ls-secondary-text-color, currentColor) !important; }
.ls-block .bottom-property-hidden-toggle-btn .ui__icon,
.hidden-properties-toggle-row .property-icon .ui__icon, .hidden-properties-toggle-row .property-k { display: none !important; }
.ls-block .bottom-property-hidden-toggle-btn:not(:focus-visible)::after { box-shadow: none !important; }
.refinement-hidden-toggle { display: inline-flex; align-items: center; justify-content: center; flex: none;
  height: 1.5rem; padding: 0 .25rem; border: 0; background: transparent; cursor: pointer;
  color: var(--ls-secondary-text-color, currentColor); }
.ls-properties-area > .refinement-hidden-toggle, .ls-block-content-indent > .refinement-hidden-toggle { display: flex; }
.block-title-wrap > .refinement-hidden-toggle { height: 1.2em; padding: 0 .1em; margin-left: .25em; vertical-align: -.2em; }
:is(.ls-block .bottom-property-hidden-toggle-btn, .refinement-hidden-toggle, .hidden-properties-toggle-row .property-icon) {
  opacity: var(--rf-faint); transition: opacity .12s ease; }
:is(.ls-block .bottom-property-hidden-toggle-btn, .refinement-hidden-toggle, .hidden-properties-toggle-row .property-icon):hover { opacity: 1; }
:is(.ls-block .bottom-property-hidden-toggle-btn, .refinement-hidden-toggle[data-refinement-hidden-open=closed], .hidden-properties-toggle-row):not(:has(.ls-icon-chevron-up)):not([data-refinement-hidden-hover]):not(:focus-visible),
.hidden-properties-toggle-row:not(:has(.ls-icon-chevron-up)):not([data-refinement-hidden-hover]) .property-icon { opacity: 0 !important; }
.ls-block .bottom-property-hidden-toggle-btn::before, .refinement-hidden-toggle::before, .hidden-properties-toggle-row .property-icon::before {
  content: '' !important; display: block !important; margin: 0 !important; opacity: 1 !important;
  width: 16px; height: 16px; background: currentColor; transition: transform .16s ease;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 6l6 6l-6 6'/%3E%3C/svg%3E") center / 16px 16px no-repeat; }
.ls-block .bottom-property-hidden-toggle-btn:has(.ls-icon-chevron-up)::before, .refinement-hidden-toggle[data-refinement-hidden-open=open]::before,
.hidden-properties-toggle-row:has(.ls-icon-chevron-up) .property-icon::before { transform: rotate(90deg); }
[data-refinement-hidden-extra] { display: none !important; }`;
function startHiddenProps() {
  try {
    const win = host().defaultView;
    // The arrow must not start editing the block it sits in.
    listen(win, ['pointerdown', 'mousedown'], event => {
      if (!event.target?.closest?.('[data-refinement-hidden-toggle]')) return;
      event.preventDefault(); event.stopPropagation();
    });
    // Checked once a frame while the pointer moves.
    let pending = null;
    listen(win, ['pointermove'], event => {
      const first = !pending;
      pending = event;
      if (!first) return;
      win.requestAnimationFrame(() => {
        const e = pending; pending = null;
        if (!setting('hiddenPropsChevron') || !e) return;
        hoverHiddenProps(e.target?.closest?.('.ls-block[blockid]') || null, e.clientX, e.clientY, win.document);
      });
    });
    listen(win, ['blur'], () => hoverHiddenProps(null));
    listen(win, ['click'], event => {
      const button = event.target?.closest?.('[data-refinement-hidden-toggle]');
      if (!button) return;
      event.preventDefault(); event.stopPropagation();
      toggleHiddenProps(button.getAttribute('data-refinement-hidden-toggle'));
    });
    sendStyle('personal-db-hidden-props', setting('hiddenPropsChevron') ? hiddenPropsCss : '');
    watchDom(updateHiddenProps);
    loadHiddenProps();
    onUnload(() => {
      for (const button of hiddenProps.buttons) button.remove();
      hiddenProps.buttons.clear();
      for (const row of hiddenProps.marked) row.removeAttribute('data-refinement-hidden-extra');
      hiddenProps.marked.clear();
      hoverHiddenProps(null);
    });
  } catch (error) { warnOnce('the hidden-properties arrow is unavailable', error); }
}


// The fold log (0.4.172: here, not in the troubleshooting part): what happened to each result after a fold-all command.
const resultRow = row => [...listFold.wanted.keys()].some(key => listRows(row.ownerDocument, key).includes(row));
function startFoldLog() {
  if (foldLog.observer) return;
  const doc = host(), win = doc.defaultView;
  foldLog.start = foldLog.start || Date.now();
  foldLog.observer = new win.MutationObserver(records => {
    let added = 0, removed = 0;
    for (const record of records) {
      if (record.type === 'attributes') {
        const row = record.target;
        if (!row.matches?.('.ls-block[blockid]') || !row.parentElement?.closest('.custom-query, .ls-view-body')) continue;
        const pressed = Date.now() - (foldLog.pressedAt.get(row) || 0) < 1500;
        logFold(`${rowName(row)} ${record.oldValue} -> ${row.getAttribute('data-collapsed')}${pressed ? ' (after plugin press)' : ''}${listFold.manual.has(row) ? ' (yours)' : ''}${resultRow(row) ? '' : ' (not in a fold-all list)'}`);
      } else {
        const count = nodes => [...nodes].filter(n => n.nodeType === 1 && n.matches('.ls-block[blockid], :has(.ls-block[blockid])') && n.closest?.('.custom-query, .ls-view-body')).length;
        added += count(record.addedNodes);
        removed += [...record.removedNodes].filter(n => n.nodeType === 1 && n.matches('.ls-block[blockid], :has(.ls-block[blockid])')).length;
      }
    }
    if (added || removed) logFold(`results drawn: ${added} added, ${removed} removed`);
  });
  foldLog.observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-collapsed'] });
  if (foldLog.listening) return;
  foldLog.listening = true;
  listen(win, ['scroll'], () => { if (Date.now() - foldLog.scrollAt > 1000) { foldLog.scrollAt = Date.now(); logFold('scrolling'); } });
  listen(doc, ['focusin'], event => { if (event.target.matches?.('textarea')) logFold('started editing a block'); });
  listen(doc, ['focusout'], event => { if (event.target.matches?.('textarea')) logFold('stopped editing a block'); });
  onUnload(() => { foldLog.observer?.disconnect(); foldLog.observer = null; });
}
async function copyFoldLog() {
  if (!foldLog.start) return notify('Run "Unfold all results" first, then wait until a result folds back, then run this', 'warning');
  const doc = host();
  const now = [...listFold.wanted].map(([key, { collapse }]) => {
    const rows = listRows(doc, key);
    const wrong = rows.filter(row => (row.getAttribute('data-collapsed') === 'true') !== collapse);
    return `active: ${collapse ? 'fold' : 'unfold'} ${key.slice(0, 14)}… · ${rows.length} results drawn · ${wrong.length} not as chosen: ${wrong.slice(0, 5).map(row => `${rowName(row)}${listFold.manual.has(row) ? ' (yours)' : ''} misses=${listFold.pressed.get(row)?.misses || 0}`).join(', ')}`;
  });
  provided.showReport([await provided.versionLine(), ...(now.length ? now : ['active: none (cleared by a page change, or never set)']), '', ...foldLog.lines].join('\n'));
}
// What this part looks for on screen, for "Check what the plugin finds on this page". [what, selector, what stops]
const screenRows = () => [
  ['blocks', '.ls-block[blockid]', 'list properties, fold all'],
  ['bullets', '.bullet-container', 'list properties'],
  ['fold arrows', 'a.block-control', 'fold all'],
  ['fold state', '.ls-block[data-collapsed]', 'fold all'],
  ['queries', '.custom-query', 'fold all, list properties per query'],
  ['parent paths', '.breadcrumb.block-parents', 'hidden property path'],
  ['property names', '.property-key, .page-property-key', 'list property picker'],
];
function provide(core) {
  core.provide({ foldQueryResults, chooseListProperties, stopFoldState, updateListProps, updateHiddenProps, loadHiddenProps, hiddenPropsCss,
    listProps,
    propertyCrumbs, updatePropertyCrumbs, unmarkPropertyCrumb, escapeHtml });
  core.onDbRound('refreshInlineValues', refreshInlineValues);
  core.onDbRound('loadHiddenProps', loadHiddenProps);
  core.onDbRound('loadPropertyNames', loadPropertyNames, { scope: 'graph' });
}
/* A page property value that starts with a page's icon (0.4.130): a text value whose first thing is a link to a page
   with an icon of its own (Hospital: City of Hope). It is marked so the stylesheet can put the icon where the other
   values' bullets are. Only the first node counts: "See [[City of Hope]]" starts with words, not the icon. */
const valueLeads = new Set();
function markValueLeads(doc) {
  const seen = new Set();
  if (setting('plainProperties')) for (const box of doc.querySelectorAll('.ls-page-properties .property-value-container:not(:has(> .property-panel-bullet))')) {
    let first = box.querySelector('.block-title-wrap')?.firstChild;
    while (first && first.nodeType === 3 && !first.nodeValue.trim()) first = first.nextSibling;
    const link = first?.nodeType === 1 && first.matches('.page-reference') ? first.querySelector('a.page-ref') : null;
    if (!link?.firstElementChild?.matches('.icon-emoji-wrap')) continue;
    seen.add(box);
    if (box.getAttribute('data-refinement-value-lead') !== 'icon') box.setAttribute('data-refinement-value-lead', 'icon');
  }
  for (const box of valueLeads) if (!seen.has(box)) box.removeAttribute('data-refinement-value-lead');
  valueLeads.clear();
  for (const box of seen) valueLeads.add(box);
}
function start() {
  const core = window.refinementCore;
  provided = core.provided;
  core.onPageChange(function propertiesPageChange() {
    stopFoldState(); // a fold-all choice lasts while its page is open
    // What is known about the page just left must not be applied to the one arriving: its list
    // choice would hide parts of the new page until the new page's own details have loaded.
    listProps.pageBlocks = new Set();
    loadHiddenProps(); // another graph has other blocks
  });
  core.onDatabaseChange(function propertiesDatabaseChange(blocks) {
    if (foldLog.start) logFold(`database changed (${blocks?.length ?? '?'} block${blocks?.length === 1 ? '' : 's'})`);
  });
  core.onSettingsChange(function propertiesSettingsChange(now, before) {
    try { updateListProps(host()); } catch (error) { /* list choices apply on the next change */ }
    if (now?.hiddenPropsChevron !== before?.hiddenPropsChevron) {
      sendStyle('personal-db-hidden-props', setting('hiddenPropsChevron') ? hiddenPropsCss : '');
      try { updateHiddenProps(host()); } catch (error) { /* shown on the next change */ }
      loadHiddenProps();
    }
  });
  ({ setting, dsQuery, UUID, isEntityId, idsIn, uuidsIn, watchDom, watchDomEarly, addsElements, sendStyle, REFERENCE_AREAS, referenceAreas, pdfCitations, dateLinks, attribute } =
    take(core, ['setting', 'dsQuery', 'UUID', 'isEntityId', 'idsIn', 'uuidsIn', 'watchDom', 'watchDomEarly', 'addsElements', 'sendStyle', 'REFERENCE_AREAS', 'referenceAreas', 'pdfCitations', 'dateLinks', 'attribute']));
  watchDomEarly(function valueLeadsEarly(doc) { markValueLeads(doc); });
  // Once now and once after a reload has swept the earlier copy's marks, when the page may not change again for a while.
  markValueLeads(host());
  const leadTimer = setTimeout(() => markValueLeads(host()), 600);
  onUnload(() => clearTimeout(leadTimer));
  onUnload(() => { for (const box of valueLeads) box.removeAttribute('data-refinement-value-lead'); valueLeads.clear(); });
}
function ready() {
  provided.addTroubleshooting?.({ checks: screenRows(),
    tools: [{ key: 'copy-fold-log', label: 'Copy fold log', run: () => copyFoldLog() }] });
  startListProps();
  startHiddenProps();
}
// The fold and list commands act on the block or query you last clicked in, so they are in the palette only.
const commands = [
  { key: 'fold-query-results', label: 'Fold all results in this query', run: () => foldQueryResults(null, true) },
  { key: 'unfold-query-results', label: 'Unfold all results in this query', run: () => foldQueryResults(null, false) },
  { key: 'choose-list-properties', label: 'Choose properties shown in this list', run: (...args) => chooseListProperties(...args) },
];
(window.refinementParts ||= []).push({ name: 'properties', schema: [], provide, start, ready, commands, stop: runUnloadTasks });
})();
