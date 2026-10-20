/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Two-way links part of DB Refinements (0.4.137). A link made by a field reads the same from both ends.
   On the record that holds the field it is a property row, "report: Chest X-ray 2026-08-03". On the page it
   points to, Logseq lists the record under a tab named after the record's tag ("Appointment"), below the
   page's own blocks, so nothing there says how the two belong together. This part draws the far end as a
   row in the page's own property list, with grey names like any property's (0.4.141), read-only:
     report of →    Chest X-ray Aug 3 · Appointment
     doctor of →    9 Appointments · next Nov 12 ▾   (opens into the list of those records)
   One row per field that points here, named by the field read backwards ("doctor" → "doctor of", "prescribed
   by" → "prescribed", or a name from the twoWayNames setting). Up to three records show inline; more become
   a count with the nearest date, which opens into the list (open to begin with, as asked: "the details …
   should by default be unfolded"). Only your own Node properties count; tags, aliases and mentions in
   sentences stay in Linked references. Drawn for the page in the main view only (sidebar and records inside
   a page are open questions, see the "Two-Way Links" sketch). Nothing is written to the graph. The tag tree
   (0.4.174) changes how a field reads backwards, and turns its row off, through this part's settings. */
const shared = window.refinementShared;
const { host, openEntity, showUndoBar, notify } = shared;
const { warnOnce, onUnload, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (two-way): ', leaves: { elements: '.refinement-two-way, .refinement-two-way-peek, .refinement-two-way-add' } });

const settingsSchema = [
  { key: 'twoWayHeading', type: 'heading', group: 'reading', rank: 3, title: 'Two-way links', default: null,
    legend: 'Records that point at this page, as rows in its own properties',
    zone: '<div><span class="m">doctor of →</span> &nbsp;<u>9 Appointments</u> <span class="m">· next Nov 12</span></div>',
    description: 'Changes here apply right away.' },
  { key: 'twoWayRows', type: 'boolean', title: 'Links read the same from both ends', default: true,
    description: 'On a page that one of your fields points to (a doctor named as the “doctor” of visits, a report named as the “report” of a scan), each such field becomes a row in the page’s own property list, with an arrow after its name: “doctor of →   9 Appointments · next Nov 12”. Up to three records show by name; more show as a count that opens into the list. Click a record’s line to open it (Shift-click or the ⇥ at its end: in the sidebar); rest the pointer on it to see its fields and first lines. Click the field’s name to open the field. In a list with several kinds of records, click a kind to show only those. The + at the end of a row adds a new record with that field pointing here (Undo in the bar that follows). A link is not removed from here: change it on the record that holds the field.' },
  { key: 'twoWayNames', type: 'string', title: 'Fields read backwards', default: 'symptoms = logged in; ask = asked; works at = works here; insurer = insurer of; related = related to',
    description: 'How a field’s name reads from the other end, as “field = words; field = words”. A field not listed reads as “field of”, and a field ending in “by” loses it (“prescribed by” reads “prescribed”).' },
  { key: 'twoWayOneEnd', type: 'string', title: 'Fields shown from one end only', default: '',
    description: 'Fields whose link is not shown as a row on the page they point to, as “field; field”. Useful for a field that points at a busy page (a status, a city with hundreds of people). The link itself stays: it still shows in that page’s Linked references and in searches. Set from the tag tree as well.' },
  { key: 'twoWayHideTagLists', type: 'boolean', title: 'Leave out Logseq’s tag lists the rows repeat', default: true,
    description: 'Below a page’s own text, Logseq lists the records that link to the page under a heading named after their tag (“Appointment”, “Project”), for tags with two-way links turned on. The rows above already show those records, with the field that links them, so on a page that has the rows the list is left out. Off: Logseq’s list shows as well.' },
  { key: 'openPropertyRows', type: 'boolean', title: 'Property rows open', default: true,
    description: 'The row of properties under a record wraps onto more lines instead of being cut off at the right edge, so every field shows.' },
];
const setting = shared.settingReader(settingsSchema);
let UUID, isEntityId, watchDomEarly, addsElements, sendStyle, titleOf, provided, dsQuery, uuidsIn;
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };
const esc = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// What is known about the page on screen: its uuid and one group per field that points at it.
// byPage: each page's rows as last read this session, drawn at once when you come back to it (0.4.150).
// indexed (0.4.182): every page's rows were read in one look-up, so a page not in byPage has none, and a page
// opened for the first time gets its rows in the same frame as its title instead of half a second later.
// open, all and only (0.4.184): per row, whether its list is open, shows every record, or only one kind ("Infusion").
const state = window.refinementTwoWay = { version: 0, pageUuid: '', groups: [], byPage: new Map(), indexed: false, open: new Map(), all: new Set(), only: new Map(), box: null, html: '' };
const LIVE = '(not [?b :logseq.property/deleted-at]) (not-join [?b] [?b :block/page ?pg] [?pg :logseq.property/deleted-at])';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const todayNumber = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const dayText = day => {
  if (!day) return '';
  const year = Math.floor(day / 10000), text = `${MONTHS[Math.floor(day / 100) % 100 - 1]} ${day % 100}`;
  return year === Math.floor(todayNumber() / 10000) ? text : `${text}, ${year}`;
};
const plural = (word, n) => n === 1 ? word : /[^aeiou]y$/i.test(word) ? word.slice(0, -1) + 'ies' : /(s|x|z|ch|sh)$/i.test(word) ? word + 'es' : word + 's';
// "symptoms = logged in; works at = works here" -> Map
// Read before the setting's own pairs, which win: a saved setting keeps its old text when this list grows.
const BUILT_IN = [['ask', 'asked'], ['symptoms', 'logged in'], ['works at', 'works here'], ['related', 'related to'], ['attendees', 'attended'], ['authors', 'author of']];
function backwardsNames() {
  const names = new Map(BUILT_IN);
  for (const pair of String(setting('twoWayNames') || '').split(/[;\n]/)) {
    const [field, words] = pair.split('=').map(part => part?.trim());
    if (field && words) names.set(field.toLowerCase(), words);
  }
  return names;
}
// Read in the case of the page's own property names ("Report" made from the + menu reads "report of").
const readBackwards = (name, names) => {
  const words = names.get(name.toLowerCase()) || (/\s+by$/i.test(name) ? name.replace(/\s+by$/i, '') : `${name} of`);
  return /^[A-Z][a-z]/.test(words) ? words[0].toLowerCase() + words.slice(1) : words;
};

// Fields shown from one end only (0.4.174): "status; city" -> Set of lower-case names.
const oneEndNames = () => new Set(String(setting('twoWayOneEnd') || '').split(/[;\n]/).map(name => name.trim().toLowerCase()).filter(Boolean));
// For the tag tree (parts/tags.js): how a field reads from the other end, and whether it shows there. Both
// are written to the settings above, so a change in the tree shows in the settings window too.
const backwardsLabel = name => readBackwards(name, backwardsNames());
const shownAtOtherEnd = name => !oneEndNames().has(name.toLowerCase());
function setBackwards(name, words) {
  words = String(words || '').replace(/[;=\n]/g, ' ').replace(/\s+/g, ' ').trim();
  const pairs = String(setting('twoWayNames') || '').split(/[;\n]/).map(pair => pair.split('=').map(part => part?.trim())).filter(([field, said]) => field && said && field.toLowerCase() !== name.toLowerCase());
  const plain = /\s+by$/i.test(name) ? name.replace(/\s+by$/i, '') : `${name} of`;
  const builtIn = BUILT_IN.find(([field]) => field === name.toLowerCase());
  // Back to how it reads anyway: no pair needed (a built-in name keeps a pair so the plain reading wins over it).
  if (words && (words.toLowerCase() !== plain.toLowerCase() || builtIn)) pairs.push([name, words]);
  if (!words && builtIn) pairs.push([name, plain]);
  logseq.updateSettings({ twoWayNames: pairs.map(([field, said]) => `${field} = ${said}`).join('; ') });
}
function setShownAtOtherEnd(name, shown) {
  const names = String(setting('twoWayOneEnd') || '').split(/[;\n]/).map(n => n.trim()).filter(n => n && n.toLowerCase() !== name.toLowerCase());
  if (!shown) names.push(name);
  logseq.updateSettings({ twoWayOneEnd: names.join('; ') });
}

async function load() {
  const version = ++state.version;
  let pageUuid = '', groups = [];
  try {
    if (setting('twoWayRows')) {
      const page = await logseq.Editor.getCurrentPage();
      // A zoomed-in block comes back with a page of its own; only a page gets the rows.
      if (page && !page.page && isEntityId(page.id) && !page['journal?'] && !page.journalDay) {
        pageUuid = String(page.uuid || '');
        groups = await groupsFor(page.id);
      }
    }
  } catch (error) { warnOnce('could not find the fields that point at this page', error); }
  if (version !== state.version) return;
  state.pageUuid = pageUuid;
  state.groups = groups;
  // Not '' (0.4.185): a page with no rows makes '' too, and the box kept the last page's rows while it held room.
  state.html = null;
  state.readAt = performance.now();
  peek.cache.clear();
  if (pageUuid) state.byPage.set(pageUuid, groups);
  draw(host());
  // Asked the moment the page changed, Logseq can still have named the page being left: ask once more for the one on screen.
  const shown = shownPage(host());
  if (shown && shown !== pageUuid && state.retried !== shown) { state.retried = shown; later(0); }
}
const shownPage = doc => {
  const shown = doc ? [...doc.querySelectorAll('#main-content-container :is(.ls-page-title, .page-title) .ls-block[blockid]')].map(el => el.getAttribute('blockid')) : [];
  return shown.length === 1 ? shown[0] : '';
};
const groupsFor = async id => (await groupsByPage(id)).get(id)?.groups || [];
// The rows of one page (id), or of every page that is not a journal (no id), as a Map of page id to { uuid, groups }.
async function groupsByPage(id) {
  // One round of questions (0.4.150): each is asked about the blocks that point here through a field of
  // yours, rather than waiting for that list first, since every wait right after a page change is long.
  // For every page the fields come first, so the database walks only their values (0.4.182).
  const fields = '[?prop :db/ident ?attr] [(namespace ?attr) ?pns] [(= ?pns "user.property")]';
  const these = id == null
    ? `${fields} [?b ?attr ?page] [?page :block/name] (not [?page :block/journal-day]) [(not= ?b ?page)] (not [?b :block/page ?page]) ${LIVE}`
    : `[(identity ${id}) ?page] [?b ?attr ?page] ${fields} [(not= ?b ?page)] (not [?b :block/page ?page]) ${LIVE}`;
  // Plain finds (a pull here was refused by Logseq's query call: "Extra inputs passed").
  const [links, titled, tagged, dated, written] = await Promise.all([
    logseq.DB.datascriptQuery(`[:find ?page ?pu ?b ?attr ?name ?fu :where ${these} [?prop :block/title ?name] [?page :block/uuid ?pu] [?prop :block/uuid ?fu]]`),
    logseq.DB.datascriptQuery(`[:find ?b ?uuid ?title :where ${these} [?b :block/uuid ?uuid] [?b :block/title ?title]]`),
    logseq.DB.datascriptQuery(`[:find ?b ?tag :where ${these} [?b :block/tags ?t] [?t :db/ident ?ti] [(namespace ?ti) ?ns] [(= ?ns "user.class")] [?t :block/title ?tag]]`),
    // A record's own date: a date field of yours (the one named "date" first), else the journal day it is written on.
    logseq.DB.datascriptQuery(`[:find ?b ?dattr ?day :where ${these} [?dprop :logseq.property/type :date] [?dprop :db/ident ?dattr] [?b ?dattr ?d] [?d :block/journal-day ?day]]`),
    logseq.DB.datascriptQuery(`[:find ?b ?day :where ${these} [?b :block/page ?p] [?p :block/journal-day ?day]]`),
  ]);
  const pages = new Map(), ids = new Set();
  const fieldUuids = new Map(), fieldIdents = new Map();
  for (const [page, pageUuid, b, attr, name, fieldUuid] of links || []) {
    // Only properties you made; built-in links such as tags, aliases and parents are left out.
    if (!isEntityId(b) || !name || !/^:?user\.property\//.test(String(attr))) continue;
    if (fieldUuid) fieldUuids.set(name, String(fieldUuid));
    fieldIdents.set(name, String(attr).replace(/^:/, ''));
    if (!pages.has(page)) pages.set(page, { uuid: String(pageUuid || ''), byField: new Map() });
    const byField = pages.get(page).byField;
    if (!byField.has(name)) byField.set(name, new Set());
    byField.get(name).add(b);
    ids.add(b);
  }
  if (!ids.size) return new Map();
  const days = new Map();
  for (const [b, attr, day] of dated || []) {
    const ident = String(attr).replace(/^:/, '');
    if (!/^user\.property\//.test(ident)) continue;
    const rank = ident === 'user.property/date' ? 0 : 1, had = days.get(b);
    if (!had || rank < had.rank || (rank === had.rank && day < had.day)) days.set(b, { rank, day });
  }
  for (const [b, day] of written || []) if (!days.has(b)) days.set(b, { rank: 2, day });
  const tags = new Map();
  for (const [b, tag] of tagged || []) if (!tags.has(b) || tag < tags.get(b)) tags.set(b, tag);
  const records = new Map();
  // The titles are made readable together (0.4.150): each one with a link in it asks the database for that link's name.
  await Promise.all((titled || []).filter(([b]) => isEntityId(b)).map(async ([b, uuid, raw]) => {
    let title = raw || '';
    try { title = await provided.readableTitle(title); } catch { /* the stored words, then */ }
    // Links read as the words they show (0.4.147): "saw [[Dr. Joe]]" as "saw Dr. Joe", "[the scan]([[CT]])" as "the scan".
    title = String(title).replace(/\s+#(?:\[\[[^\]]*\]\]|[^\s#\[\]]+)/g, '').replace(/\[([^\[\]]+)\]\(\[\[[^\]]*\]\]\)/g, '$1')
      .replace(/\[\[([^\]]+)\]\]/g, '$1').trim() || 'Untitled';
    records.set(b, { uuid: String(uuid), title, tag: tags.get(b) || 'note', day: days.get(b)?.day || 0 });
  }));
  const names = backwardsNames(), today = todayNumber(), oneEnd = oneEndNames();
  const result = new Map();
  for (const [page, { uuid, byField }] of pages) {
    const groups = [];
    for (const [name, set] of byField) {
      if (oneEnd.has(name.toLowerCase())) continue;
      const items = [...set].map(b => records.get(b)).filter(item => item && UUID.test(item.uuid));
      if (!items.length) continue;
      // Coming up first (nearest first), then the past (latest first), then records with no date.
      items.sort((a, b) => (a.day >= today ? 0 : a.day ? 1 : 2) - (b.day >= today ? 0 : b.day ? 1 : 2) ||
        (a.day >= today ? a.day - b.day : b.day - a.day) || a.title.localeCompare(b.title));
      groups.push({ name, label: readBackwards(name, names), items, fieldUuid: fieldUuids.get(name) || '', ident: fieldIdents.get(name) || '' });
    }
    groups.sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
    result.set(page, { uuid, groups });
  }
  return result;
}

// Every page's rows in one look-up (0.4.182), at the start and again when the graph has been still for a while. The
// page on screen still asks for its own rows, which are newer; this only lets a page show its rows from its first
// frame. In a graph with very many links it is read once, at the start, so typing never waits behind it.
const BIG_INDEX = 5000;
let indexVersion = 0, indexSize = 0;
async function loadIndex() {
  const version = ++indexVersion;
  if (!setting('twoWayRows')) { state.indexed = false; return; }
  const all = await groupsByPage(null);
  if (version !== indexVersion) return;
  indexSize = 0;
  for (const { groups } of all.values()) for (const group of groups) indexSize += group.items.length;
  const fresh = new Map();
  for (const { uuid, groups } of all.values()) if (UUID.test(uuid) && groups.length) fresh.set(uuid, groups);
  // The page on screen keeps what its own look-up found.
  if (state.pageUuid && state.byPage.has(state.pageUuid)) fresh.set(state.pageUuid, state.byPage.get(state.pageUuid));
  state.byPage = fresh;
  state.indexed = true;
}

// "9 Appointments · next Nov 12", "4 Lab panels, 3 Imaging studies · Aug 2 – Oct 9"
function summary(items) {
  const counts = new Map();
  for (const item of items) counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
  const kinds = [...counts].sort((a, b) => b[1] - a[1]).map(([tag, n]) => `${n} ${plural(tag, n)}`).join(', ');
  const today = todayNumber(), days = items.map(item => item.day).filter(Boolean);
  const next = days.filter(day => day >= today).sort((a, b) => a - b)[0];
  let when = '';
  if (next) when = `next ${dayText(next)}`;
  else if (days.length) { const first = Math.min(...days), last = Math.max(...days); when = first === last ? dayText(first) : `${dayText(first)} – ${dayText(last)}`; }
  return [kinds, when].filter(Boolean).join(' · ');
}
const INLINE = 3, LISTED = 5;
/* Moving around the rows (0.4.184, the + and the hovers 0.4.185, the owner asked for the rows to be more interactive). A record's line is
   lit under the pointer and opens on a click anywhere along it; the ⇥ at its end opens it in the sidebar (as
   Shift-click does). Resting on a record shows a card with its fields and first lines (peek, below). The field's
   name opens the field's own page. In an open list, a row of kinds ("All 13 · Infusion 8 · Scan 1") shows only
   that kind, as does a kind at the end of a line; a line marked "earlier" parts what is coming up from what is
   past; "show all 13" folds back with "show fewer". Whether a list is open is kept across restarts. */
const recordLink = item => `<a class="rf-tw-record" data-uuid="${esc(item.uuid)}" href="#">${esc(item.title)}</a>`;
const addLink = group => group.ident ? `<a class="rf-tw-add" data-field="${esc(group.name)}" href="#" title="New record with “${esc(group.name)}” set to this page">+</a>` : '';
const sideLink = item => `<a class="rf-tw-side" data-uuid="${esc(item.uuid)}" href="#" title="Open in the sidebar (or Shift-click the name)">⇥</a>`;
function rowHtml(group) {
  const key = `${state.pageUuid}|${group.name}`;
  const tip = `“${esc(group.name)}” on the records listed here points to this page. Change it on the record.`;
  const label = `${esc(group.label)}<span class="rf-tw-arrow">→</span>`;
  // A row that folds has its chevron just before its list, in the room left of the values (0.4.195, the owner's ask).
  const fold = group.items.length > INLINE ? `<a class="rf-tw-fold" data-key="${esc(key)}" href="#" title="${isOpen(key) ? 'Fold the list' : 'Open the list'}" aria-label="${isOpen(key) ? 'Fold' : 'Open'} ${esc(group.label)}"><span class="rf-tw-chevron"></span></a>` : '';
  const name = group.fieldUuid
    ? `<div class="rf-tw-name"><a class="rf-tw-field" data-uuid="${esc(group.fieldUuid)}" href="#" title="${tip} Click to open the “${esc(group.name)}” field.">${label}</a></div>`
    : `<div class="rf-tw-name" title="${tip}">${label}</div>`;
  if (group.items.length <= INLINE) {
    const values = group.items.map(item => `<span class="rf-tw-item" data-uuid="${esc(item.uuid)}">${recordLink(item)}${item.day ? `<span class="rf-tw-day">${esc(dayText(item.day))}</span>` : ''}<span class="rf-tw-tag">${esc(item.tag)}</span>${sideLink(item)}</span>`).join('');
    return `<div class="rf-tw-row" data-field="${esc(group.name)}">${name}<div class="rf-tw-value">${values}${addLink(group)}</div></div>`;
  }
  const open = isOpen(key), all = state.all.has(key);
  const counts = new Map();
  for (const item of group.items) counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
  const only = counts.has(state.only.get(key)) ? state.only.get(key) : '';
  const items = only ? group.items.filter(item => item.tag === only) : group.items;
  const shown = all ? items : items.slice(0, LISTED);
  let list = '';
  if (open) {
    const chip = (tag, text) => `<a class="rf-tw-chip" data-key="${esc(key)}" data-tag="${esc(tag)}" href="#"${tag === only ? ' data-on=""' : ''}>${esc(text)}</a>`;
    const chips = counts.size > 1 ? `<div class="rf-tw-chips">${chip('', `All ${group.items.length}`)}${[...counts].sort((a, b) => b[1] - a[1]).map(([tag, n]) => chip(tag, `${tag} ${n}`)).join('')}</div>` : '';
    const today = todayNumber();
    const lines = shown.map((item, i) => {
      const earlier = i > 0 && item.day && item.day < today && shown[i - 1].day >= today ? '<div class="rf-tw-earlier">earlier</div>' : '';
      const tag = counts.size > 1 ? `<a class="rf-tw-tag" data-key="${esc(key)}" data-tag="${esc(item.tag)}" href="#" title="Show only ${esc(plural(item.tag, 2))}">${esc(item.tag)}</a>` : `<span class="rf-tw-tag">${esc(item.tag)}</span>`;
      return `${earlier}<div class="rf-tw-line" data-uuid="${esc(item.uuid)}"><span class="rf-tw-day">${esc(dayText(item.day))}</span>${recordLink(item)}${tag}${sideLink(item)}</div>`;
    }).join('');
    const more = items.length > LISTED ? `<a class="rf-tw-more" data-key="${esc(key)}" href="#">${all ? 'show fewer' : `show all ${items.length}`}</a>` : '';
    list = `<div class="rf-tw-list">${chips}${lines}${more}</div>`;
  }
  return `<div class="rf-tw-row" data-field="${esc(group.name)}"${open ? ' data-open=""' : ''}>${name}<div class="rf-tw-value">${fold}<a class="rf-tw-toggle" data-key="${esc(key)}" href="#" title="${open ? 'Fold the list' : 'Open the list'}">${esc(summary(group.items))}</a>${addLink(group)}</div>${list}</div>`;
}
// Open or folded, per page and field, kept in Logseq's window storage (0.4.184): open unless you folded it.
const OPEN_KEY = 'refinementTwoWayOpen';
const isOpen = key => state.open.get(key) ?? true;
function readOpen() { try { state.open = new Map(Object.entries(JSON.parse(host().defaultView.localStorage.getItem(OPEN_KEY) || '{}'))); } catch { state.open = new Map(); } }
function setOpen(key, open) {
  state.open.delete(key);
  if (!open) state.open.set(key, false);
  while (state.open.size > 300) state.open.delete(state.open.keys().next().value);
  try { host().defaultView.localStorage.setItem(OPEN_KEY, JSON.stringify(Object.fromEntries(state.open))); } catch { /* kept for this session */ }
}

/* Peek (0.4.184): resting the pointer on a record for a moment shows a card beside it, with the record's tag and
   day, its fields (the one that points here left out) and its first lines, read when asked and kept until the
   graph changes. It goes when the pointer leaves the record and the card. */
const PEEK_MS = 450;
const peek = { timer: 0, hide: 0, el: null, uuid: '', anchor: null, cache: new Map() };
async function peekData(uuid, field) {
  const key = `${uuid}|${field}`;
  if (peek.cache.has(key)) return peek.cache.get(key);
  const where = `[?b :block/uuid #uuid "${uuid}"] [?b ?attr ?v] [?prop :db/ident ?attr] [(namespace ?attr) ?ns] [(= ?ns "user.property")] [?prop :block/title ?name]`;
  const [raw, titled, dated] = await Promise.all([
    dsQuery(`[:find ?name ?v :where ${where}]`),
    dsQuery(`[:find ?name ?v ?t :where ${where} [?v :block/title ?t]]`),
    dsQuery(`[:find ?name ?v ?d :where ${where} [?v :block/journal-day ?d]]`),
  ]);
  const fields = new Map(), add = (name, value) => { if (!fields.has(name)) fields.set(name, []); if (!fields.get(name).includes(value)) fields.get(name).push(value); };
  const known = new Set();
  for (const [name, v, day] of dated) { known.add(`${name}|${v}`); add(name, dayText(day)); }
  for (const [name, v, title] of titled) { if (known.has(`${name}|${v}`)) continue; known.add(`${name}|${v}`); add(name, title); }
  for (const [name, v] of raw) if (!known.has(`${name}|${v}`) && !(typeof v === 'number' && isEntityId(v))) add(name, String(v));
  fields.delete(field);
  const readable = async text => { try { text = await provided.readableTitle(String(text || '')); } catch { /* as stored */ } return String(text).replace(/\[\[([^\]]+)\]\]/g, '$1').trim(); };
  const rows = [];
  for (const [name, values] of [...fields].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 8)) rows.push([name, (await Promise.all(values.map(readable))).filter(Boolean).join(', ')]);
  let lines = [];
  try {
    const entity = await logseq.Editor.getBlock(uuid, { includeChildren: true });
    const children = entity?.name || entity?.originalName ? await logseq.Editor.getPageBlocksTree(uuid) : entity?.children;
    for (const child of children || []) {
      const text = await readable(child?.title ?? child?.content ?? '');
      if (text) lines.push(text);
      if (lines.length >= 4) break;
    }
  } catch { /* no lines, then */ }
  const data = { rows: rows.filter(([, value]) => value), lines };
  peek.cache.set(key, data);
  return data;
}
function peekHtml(item, field, data) {
  const head = `<div class="rf-tw-peek-title">${esc(item.title)}</div><div class="rf-tw-peek-meta">${esc(['#' + item.tag, dayText(item.day)].filter(Boolean).join(' · '))}</div>`;
  // The record's own day is in the line above already.
  const fields = data.rows.filter(([, value]) => !item.day || value !== dayText(item.day));
  const rows = fields.length ? `<div class="rf-tw-peek-fields">${fields.map(([name, value]) => `<span class="rf-tw-peek-name">${esc(name)}</span><span>${esc(value)}</span>`).join('')}</div>` : '';
  const lines = data.lines.length ? `<div class="rf-tw-peek-lines">${data.lines.map(line => `<div>${esc(line.length > 140 ? line.slice(0, 139) + '…' : line)}</div>`).join('')}</div>` : '';
  return head + rows + lines + (rows || lines ? '' : '<div class="rf-tw-peek-meta">Nothing else written on it yet.</div>');
}
function findItem(uuid, rowEl) {
  const group = state.groups.find(g => g.name === rowEl?.dataset.field);
  return group ? { group, item: group.items.find(item => item.uuid === uuid) } : {};
}
function onOver(event) {
  const link = event.target.closest?.('a.rf-tw-record');
  if (!link) return;
  clearTimeout(peek.hide);
  if (peek.anchor === link && peek.el?.isConnected) return;
  clearTimeout(peek.timer);
  peek.timer = setTimeout(() => showPeek(link).catch(error => warnOnce('could not show the record card', error)), PEEK_MS);
}
function onOut(event) {
  if (!event.target.closest?.('a.rf-tw-record')) return;
  clearTimeout(peek.timer);
  hidePeekSoon();
}
const hidePeekSoon = () => { clearTimeout(peek.hide); peek.hide = setTimeout(hidePeek, 200); };
function hidePeek() { clearTimeout(peek.timer); clearTimeout(peek.hide); peek.el?.remove(); peek.el = null; peek.anchor = null; }
async function showPeek(link) {
  const { group, item } = findItem(link.dataset.uuid, link.closest('.rf-tw-row'));
  if (!item) return;
  const data = await peekData(item.uuid, group.name);
  if (!link.isConnected || !link.matches(':hover')) return;
  const doc = link.ownerDocument;
  hidePeek();
  const el = peek.el = doc.createElement('div');
  el.className = 'refinement-two-way-peek';
  el.innerHTML = peekHtml(item, group.name, data);
  el.addEventListener('mouseenter', () => clearTimeout(peek.hide));
  el.addEventListener('mouseleave', hidePeekSoon);
  el.addEventListener('mousedown', event => event.stopPropagation());
  el.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openEntity(item.uuid, event.shiftKey); hidePeek(); });
  doc.body.appendChild(el);
  peek.anchor = link;
  const at = link.getBoundingClientRect(), size = el.getBoundingClientRect(), win = doc.defaultView;
  const left = Math.max(8, Math.min(at.left, win.innerWidth - size.width - 8));
  const below = at.bottom + 6 + size.height < win.innerHeight - 8;
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(below ? at.bottom + 6 : Math.max(8, at.top - 6 - size.height))}px`;
}

// The page's own property list in the main view (not one inside a record, a reference or the sidebar).
function anchorFor(doc) {
  const main = doc.querySelector('#main-content-container');
  if (!main) return null;
  const outside = el => !el.closest('.references, .ls-bidirectional-properties, .ls-block .ls-block, .custom-query');
  const props = [...main.querySelectorAll('.ls-page-properties')].find(outside);
  if (props) return props;
  const titles = [...(provided.pageTitles?.(doc) || [])].filter(el => main.contains(el) && !el.parentElement?.closest('.ls-page-title, .page-title, h1.title'));
  const title = titles.length === 1 ? titles[0] : null;
  return title ? (title.querySelector('.is-page-title-row') || provided.titleAnchor?.(doc, title) || title) : null;
}
/* A page opening in steps (0.4.182). Logseq draws a page's title and its blocks first and its property list in two
   or three steps over the next half second, so the page's own words were pushed down each time, and once more when
   the rows came. Seen in the owner's Logseq: Oxaliplatin's blocks at 223px, then 303, 495 and 820. Now the rows are
   known before the page opens (loadIndex), and for the first two seconds after a page change the box keeps, above
   the rows, the room that lay between the title and the rows when the page was last seen settled, less what is
   there so far: the rows and the blocks start where they end. The room is kept in Logseq's window storage, so this
   works from the second visit on, across restarts. */
const SETTLE_MS = 2000, HEIGHTS_KEY = 'refinementTwoWayRoom';
const settle = { since: 0, page: '', leaving: '', saved: false, timer: 0 };
let heights = new Map();
const readHeights = () => { try { heights = new Map(Object.entries(JSON.parse(host().defaultView.localStorage.getItem(HEIGHTS_KEY) || '{}'))); } catch { heights = new Map(); } };
function remember(page, height) {
  height = Math.round(height);
  if (heights.get(page) === height) return;
  heights.delete(page);
  heights.set(page, height);
  if (heights.size > 500) heights.delete(heights.keys().next().value);
  try { host().defaultView.localStorage.setItem(HEIGHTS_KEY, JSON.stringify(Object.fromEntries(heights))); } catch { /* storage full or off: kept for this session */ }
}
// 'hold' while the page on screen settles, 'save' once when it has, else nothing.
function settling(page) {
  if (!page || page === settle.leaving) return '';
  const age = performance.now() - settle.since;
  if (!settle.page && age < SETTLE_MS) { settle.page = page; settle.saved = false; }
  if (settle.page !== page) return '';
  return age < SETTLE_MS ? 'hold' : settle.saved ? '' : 'save';
}
function holdRoom(doc, box, mode, page) {
  // The title's own row: the box and the property list sit inside the title's block, below that row.
  const title = doc.querySelector('#main-content-container :is(.ls-page-title, .page-title) .is-page-title-row');
  if (!mode || !title) { setHold(box, 0); return; }
  const held = parseFloat(box.style.getPropertyValue('--rf-tw-hold')) || 0;
  const room = box.getBoundingClientRect().top - title.getBoundingClientRect().bottom - held;
  if (mode === 'save') { settle.saved = true; setHold(box, 0); if (room >= 0) remember(page, room); return; }
  setHold(box, heights.has(page) ? Math.max(0, Math.round(heights.get(page) - room)) : 0);
}
const setHold = (box, px) => { if (px) box.style.setProperty('--rf-tw-hold', px + 'px'); else if (box.style.length) box.removeAttribute('style'); };
function onRoute() {
  hidePeek(); closeAdd();
  // The page being left, which may still be on screen for a moment and must not take the new page's place.
  settle.leaving = settle.page || shownPage(host());
  Object.assign(settle, { since: performance.now(), page: '', saved: false });
  clearTimeout(settle.timer);
  // Once settled: no more room held, and the room is kept for next time.
  settle.timer = setTimeout(() => draw(host()), SETTLE_MS + 50);
}
const shownPages = doc => [...doc.querySelectorAll('#main-content-container :is(.ls-page-title, .page-title) .ls-block[blockid]')].map(el => el.getAttribute('blockid'));
function draw(doc) {
  if (!doc) return;
  const on = setting('twoWayRows');
  // The rows belong to the page they were read for; a page drawn before its look-up finishes gets the rows it had
  // when last seen, or none if every page's rows were read and it had none, until the look-up has checked them.
  const shown = shownPages(doc);
  if (shown.length && !shown.includes(state.pageUuid)) {
    const id = shown.find(uuid => state.byPage.has(uuid)) || (shown.length === 1 && state.indexed ? shown[0] : '');
    if (id) { state.pageUuid = id; state.groups = state.byPage.get(id) || []; state.html = null; }
  }
  const anchor = on ? anchorFor(doc) : null;
  // A view with no page title the rows know (the Journals list), reached after the rows were read, has none of them (0.4.185).
  const stale = !shown.length && settle.since > (state.readAt || 0);
  const rows = state.groups.length > 0 && !stale && !(shown.length && !shown.includes(state.pageUuid));
  // A page with an alias has more than one block in its title area; the page is the one the rows were read for.
  const page = shown.includes(state.pageUuid) ? state.pageUuid : shown.length === 1 ? shown[0] : '';
  const mode = anchor ? settling(page) : '';
  if (!anchor || (!rows && !mode)) { state.box?.remove(); return; }
  let box = state.box;
  if (!box || box.ownerDocument !== doc) {
    box = state.box = doc.createElement('div');
    box.className = 'refinement-two-way';
    box.setAttribute('contenteditable', 'false');
    box.addEventListener('mousedown', event => event.stopPropagation());
    box.addEventListener('click', onClick);
    box.addEventListener('mouseover', onOver);
    box.addEventListener('mouseout', onOut);
    state.html = '';
  }
  const html = rows ? state.groups.map(rowHtml).join('') : '';
  if (state.html !== html) { state.html = html; box.innerHTML = html; }
  if (anchor.nextElementSibling !== box) anchor.after(box);
  holdRoom(doc, box, mode, page);
  if (!rows && mode === 'save') box.remove();
}
// Before the screen is drawn (0.4.182), so the rows come in the same frame as the property list they sit under. Only
// when elements came or went, or while a page settles.
const drawEarly = (doc, records) => { if (performance.now() - settle.since < SETTLE_MS || addsElements(records)) draw(doc); };
function onClick(event) {
  const target = event.target.closest?.('a');
  const line = !target && event.target.closest?.('.rf-tw-line, .rf-tw-item');
  if (!target && !line) return;
  event.preventDefault(); event.stopPropagation();
  hidePeek();
  if (line) return openEntity(line.dataset.uuid, event.shiftKey);
  if (target.matches('.rf-tw-record, .rf-tw-field')) return openEntity(target.dataset.uuid, event.shiftKey);
  if (target.matches('.rf-tw-side')) return openEntity(target.dataset.uuid, true);
  if (target.matches('.rf-tw-add')) return openAdd(target).catch(error => { warnOnce('could not open the new record box', error); });
  const key = target.dataset.key;
  if (target.matches('.rf-tw-toggle, .rf-tw-fold')) setOpen(key, !isOpen(key));
  else if (target.matches('.rf-tw-more')) { if (state.all.has(key)) state.all.delete(key); else state.all.add(key); }
  else if (target.matches('.rf-tw-chip, .rf-tw-tag')) {
    const tag = target.dataset.tag || '';
    if (!tag || state.only.get(key) === tag) state.only.delete(key); else state.only.set(key, tag);
  }
  draw(host());
}

/* Adding from the far end (0.4.185, the owner's pick of "Add only"): the + at the end of a row opens a small box,
   "New record · doctor: Dr. Mei Chen", with the kinds the row already holds (the most common chosen) and a name.
   Enter (or Add) makes the record with that name and tag and the field pointing at this page: a page of its own when
   most records in the row are pages (people, places), else a block on today's journal (visits, tests). Add and open
   also opens it in the sidebar to fill in. The bar at the bottom offers Undo, which removes what was made.
   Nothing is unlinked from here: a link is changed on the record that holds it. */
const adding = { el: null };
function closeAdd() { adding.el?.remove(); adding.el = null; }
async function openAdd(button) {
  closeAdd(); hidePeek();
  const group = state.groups.find(g => g.name === button.dataset.field);
  if (!group?.ident) return;
  const doc = button.ownerDocument, pageUuid = state.pageUuid;
  const page = await logseq.Editor.getPage(pageUuid).catch(() => null);
  if (!page?.id) return notify('This page could not be read, so nothing was added', 'warning');
  const counts = new Map();
  for (const item of group.items) if (item.tag !== 'note') counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
  const kinds = [...counts].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  let kind = kinds[0] || '';
  const uuids = group.items.map(item => item.uuid);
  const pages = (await dsQuery(`[:find ?u :where ${uuidsIn('?u', uuids)} [?b :block/uuid ?u] [?b :block/name _]]`)).length;
  const asPage = pages * 2 > uuids.length;
  const title = page.title || page.originalName || page.name || 'this page';
  const el = adding.el = doc.createElement('div');
  el.className = 'refinement-two-way-add';
  el.innerHTML = `<div class="rf-tw-add-head">New record · <span class="rf-tw-add-field">${esc(group.name)}: ${esc(title)}</span></div>
    ${kinds.length ? `<div class="rf-tw-add-kinds">${kinds.map(tag => `<button type="button" data-tag="${esc(tag)}"${tag === kind ? ' data-on=""' : ''}>${esc(tag)}</button>`).join('')}</div>` : ''}
    <input type="text" placeholder="Name, e.g. ${esc(group.items[0]?.title || 'a new visit')}" spellcheck="false">
    <div class="rf-tw-add-foot"><span>${asPage ? 'As a new page' : 'On today’s journal'}</span><button type="button" data-act="open">Add and open</button><button type="button" data-act="add" data-main="">Add</button></div>`;
  const input = el.querySelector('input');
  el.addEventListener('mousedown', event => event.stopPropagation());
  el.addEventListener('click', event => {
    const pick = event.target.closest('button');
    if (!pick) return;
    event.preventDefault(); event.stopPropagation();
    if (pick.dataset.tag != null) {
      kind = kind === pick.dataset.tag ? '' : pick.dataset.tag;
      for (const b of el.querySelectorAll('.rf-tw-add-kinds button')) b.toggleAttribute('data-on', b.dataset.tag === kind);
      input.focus();
    } else submit(pick.dataset.act === 'open');
  });
  input.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); closeAdd(); }
    else if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); submit(event.metaKey || event.shiftKey); }
  });
  const submit = async open => {
    const name = input.value.trim();
    if (!name) { input.focus(); el.querySelector('input').setAttribute('data-empty', ''); return; }
    closeAdd();
    try { await addRecord({ group, page, name, kind, open, asPage }); }
    catch (error) { warnOnce('could not add the new record', error); notify('The new record could not be added', 'warning'); }
  };
  doc.body.appendChild(el);
  const at = button.getBoundingClientRect(), size = el.getBoundingClientRect(), win = doc.defaultView;
  el.style.left = `${Math.round(Math.max(8, Math.min(at.right - size.width, win.innerWidth - size.width - 8)))}px`;
  el.style.top = `${Math.round(at.bottom + 6 + size.height < win.innerHeight - 8 ? at.bottom + 6 : Math.max(8, at.top - 6 - size.height))}px`;
  input.focus();
  // A click anywhere else closes the box.
  const away = event => { if (!adding.el) return doc.removeEventListener('mousedown', away, true); if (!adding.el.contains(event.target)) { closeAdd(); doc.removeEventListener('mousedown', away, true); } };
  doc.addEventListener('mousedown', away, true);
}
async function addRecord({ group, page, name, kind, open, asPage }) {
  if (asPage && await logseq.Editor.getPage(name).catch(() => null)) return notify(`A page named “${name}” already exists, so nothing was added`, 'warning');
  const prop = (await provided.propSchema()).props.find(p => p.ident === group.ident);
  let tagUuid = '';
  if (kind) {
    const tags = await dsQuery(`[:find ?u :where [?t :block/tags :logseq.class/Tag] [?t :block/title ${JSON.stringify(kind)}] [?t :db/ident ?ti] [(namespace ?ti) ?ns] [(= ?ns "user.class")] [?t :block/uuid ?u]]`);
    tagUuid = String(tags[0]?.[0] || '');
  }
  let block, undo;
  if (asPage) {
    block = await logseq.Editor.createPage(name, {}, { redirect: false, createFirstBlock: false });
    if (!block?.uuid) throw new Error('the page was not made');
    // By name, as Properties in the line does: Logseq 2.0.2 left the page in place when asked by its uuid here.
    undo = async () => { await logseq.Editor.deletePage(name); later(300); };
    // A page made now is not in the look-up of every page: it has no rows of its own yet.
    state.byPage.set(String(block.uuid), []);
  } else {
    const now = new Date();
    const journalId = await provided.journalIdFor(todayNumber(), await provided.journalTitleFor(now.getFullYear(), now.getMonth() + 1, now.getDate()));
    const [[journalUuid] = []] = journalId ? await dsQuery(`[:find ?u :where [(identity ${journalId}) ?p] [?p :block/uuid ?u]]`) : [];
    if (!journalUuid) throw new Error('no journal page for today');
    block = await logseq.Editor.appendBlockInPage(String(journalUuid), name);
    if (!block?.uuid) throw new Error('the block was not made');
    undo = async () => { await logseq.Editor.removeBlock(block.uuid); later(300); };
  }
  try {
    if (tagUuid) await logseq.Editor.addBlockTag(block.uuid, tagUuid);
    if (prop?.many) await logseq.Editor.upsertBlockProperty(block.uuid, group.ident, [page.id], { entityId: true, reset: true });
    else await logseq.Editor.upsertBlockProperty(block.uuid, group.ident, page.id, { entityId: true });
  } catch (error) { await undo().catch(() => {}); throw error; }
  later(300);
  showUndoBar(`Added “${name}”${kind ? ` (${kind})` : ''}${asPage ? ' as a page' : ' to today’s journal'}`, undo);
  if (open) openEntity(block.uuid, true);
}

const twoWayCss = `
/* Under the page's own properties, on the same light field: these rows are the far end of a field held by other
   records, so they read like properties but are not this page's own; the → after the name, pointing at the records that hold the field, says so (a ← before the name until 0.4.186). The names are
   the grey of every property name and the days plain grey words (0.4.141, the owner's pick: no blue, no date box).
   Sizes and columns are Logseq's own property rows above, as measured in 2.0.2 (0.4.144): the text at the page's
   size (the names .94 of it, as theirs), a 150px name column, a 12px gap, the values 22px in where theirs start
   after their bullet, 28px rows; the name starts where theirs does, after the room of their property icon (15px and a 4px gap), and the → follows it. */
.refinement-two-way {
  --rf-tw-accent: var(--ls-secondary-text-color, currentColor);
  margin: calc(.15rem + var(--rf-tw-hold, 0px)) 0 .6rem -.5rem; padding: .3rem .9rem .3rem .5rem;
  background: color-mix(in srgb, var(--ls-primary-text-color, currentColor) var(--rf-field-pct, 3%), transparent);
  line-height: 1.5; user-select: text;
}
/* Only holding room while the page settles: no field, no rows. */
.refinement-two-way:not(:has(.rf-tw-row)) { margin: var(--rf-tw-hold, 0px) 0 0; padding: 0; background: none; }
.refinement-two-way .rf-tw-row { display: grid; grid-template-columns: minmax(150px, max-content) 1fr; column-gap: 12px; padding: 2px 0; }
.refinement-two-way .rf-tw-name { color: var(--rf-tw-accent); font-size: var(--rf-name, .94em); white-space: nowrap; cursor: default; }
.refinement-two-way .rf-tw-name { padding-left: 19px; }
.refinement-two-way .rf-tw-arrow { display: inline-block; margin-left: .35em; opacity: .85; }
.refinement-two-way .rf-tw-value { min-width: 0; padding-left: 22px; display: flex; flex-wrap: wrap; column-gap: 1.1em; }
.refinement-two-way a { color: inherit; text-decoration: none; cursor: pointer; }
.refinement-two-way .rf-tw-line a.rf-tw-record { justify-self: start; }
.refinement-two-way a.rf-tw-record { border-bottom: 1px solid color-mix(in srgb, currentColor var(--rf-line-pct, 26%), transparent); }
.refinement-two-way a.rf-tw-record:hover { border-bottom-color: currentColor; }
.refinement-two-way .rf-tw-day { margin-left: .45em; color: var(--ls-secondary-text-color); font-size: var(--rf-small, .82em); font-variant-numeric: tabular-nums; }
.refinement-two-way .rf-tw-tag { margin-left: .5em; color: var(--ls-secondary-text-color); opacity: var(--rf-quiet, .7); font-size: var(--rf-small, .82em); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.refinement-two-way .rf-tw-toggle:hover { color: var(--ls-primary-text-color, currentColor); }
.refinement-two-way .rf-tw-value { position: relative; }
.refinement-two-way .rf-tw-fold { position: absolute; left: 3px; top: .75em; width: 16px; height: 16px; margin-top: -8px; display: flex; align-items: center; justify-content: center; border-radius: 4px; color: var(--ls-secondary-text-color); }
.refinement-two-way .rf-tw-fold:hover { color: var(--ls-primary-text-color, currentColor); background: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 11%, transparent); }
.refinement-two-way .rf-tw-chevron { display: inline-block; width: 7px; height: 8px; background: currentColor; opacity: var(--rf-faint, .5);
  clip-path: polygon(0 0, 100% 50%, 0 100%); transition: transform .16s ease; }
.refinement-two-way .rf-tw-fold:hover .rf-tw-chevron { opacity: 1; }
.refinement-two-way .rf-tw-row[data-open] .rf-tw-chevron { transform: rotate(90deg); }
/* The list a count opens into: date, record, tag, one per line, under the value. */
/* The line drops from under the fold arrow (centred 11px in, 0.4.196), as Logseq's own guide lines drop from theirs; the words stay where they were. */
.refinement-two-way .rf-tw-list { grid-column: 2; margin: .1rem 0 .25rem 10.5px; border-left: 1px solid color-mix(in srgb, var(--rf-tw-accent) 35%, transparent); padding-left: calc(.6rem + 11.5px); }
.refinement-two-way .rf-tw-line { display: grid; grid-template-columns: 3.6em minmax(0, 1fr) auto; column-gap: .5em; align-items: baseline; }
.refinement-two-way .rf-tw-line .rf-tw-day { margin-left: 0; }
.refinement-two-way .rf-tw-more { display: inline-block; margin-top: .1rem; color: var(--ls-secondary-text-color); font-size: var(--rf-small, .82em); }
.refinement-two-way .rf-tw-more:hover { color: var(--ls-primary-text-color, currentColor); }
/* Moving around (0.4.184): a record's line lit under the pointer, the ⇥ to the sidebar shown there, the field's
   name and the kinds as quiet links, the kinds row above an open list, "earlier" before what is past. */
.refinement-two-way .rf-tw-line, .refinement-two-way .rf-tw-item { cursor: pointer; border-radius: 4px; }
.refinement-two-way .rf-tw-line { margin: 0 -.35rem; padding: 0 .35rem; grid-template-columns: 3.6em minmax(0, 1fr) auto 1.2em; }
.refinement-two-way .rf-tw-item { margin: 0 -.3rem; padding: 0 .3rem; }
.refinement-two-way .rf-tw-line:hover, .refinement-two-way .rf-tw-item:hover { background: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 7%, transparent); }
.refinement-two-way .rf-tw-side { visibility: hidden; margin-left: .4em; color: var(--ls-secondary-text-color); font-size: var(--rf-small, .82em); text-align: center; }
.refinement-two-way :is(.rf-tw-line, .rf-tw-item):hover .rf-tw-side { visibility: visible; }
/* Every other thing that answers a click gets the same soft patch under the pointer (0.4.185, the owner's ask: the
   field's name, the count that opens a list, the kinds, show all, the ⇥ and the +), drawn in the padding a negative
   margin gives back, so nothing moves. */
.refinement-two-way :is(.rf-tw-field, .rf-tw-toggle, a.rf-tw-tag, .rf-tw-more, .rf-tw-side, .rf-tw-add) { border-radius: 4px; padding: 0 .25em; margin-left: -.25em; margin-right: -.25em; transition: background-color .1s ease, color .1s ease; }
.refinement-two-way :is(.rf-tw-field, .rf-tw-toggle, a.rf-tw-tag, .rf-tw-more, .rf-tw-side, .rf-tw-add):hover { color: var(--ls-primary-text-color, currentColor); background: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 11%, transparent); }
.refinement-two-way .rf-tw-line:hover a.rf-tw-tag:hover, .refinement-two-way .rf-tw-line:hover .rf-tw-side:hover { background: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 14%, transparent); }
.refinement-two-way a.rf-tw-field { color: inherit; }
.refinement-two-way .rf-tw-side { margin-left: .15em; }
.refinement-two-way .rf-tw-add { margin-left: .6em; color: var(--ls-secondary-text-color); opacity: var(--rf-faint, .5); }
.refinement-two-way .rf-tw-row:hover .rf-tw-add { opacity: 1; }
.refinement-two-way .rf-tw-chips { display: flex; flex-wrap: wrap; gap: .3rem; margin: .1rem 0 .3rem; font-size: var(--rf-small, .82em); }
.refinement-two-way .rf-tw-chip { padding: 0 .45rem; border-radius: 999px; color: var(--ls-secondary-text-color); border: 1px solid color-mix(in srgb, var(--rf-tw-accent) 30%, transparent); }
.refinement-two-way .rf-tw-chip { transition: background-color .1s ease, color .1s ease, border-color .1s ease; }
.refinement-two-way .rf-tw-chip:hover { color: var(--ls-primary-text-color, currentColor); border-color: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 45%, transparent); background: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 6%, transparent); }
.refinement-two-way .rf-tw-chip[data-on] { color: var(--ls-primary-text-color, currentColor); background: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 9%, transparent); }
.refinement-two-way .rf-tw-earlier { margin: .2rem 0 .1rem; color: var(--ls-secondary-text-color); opacity: var(--rf-quiet, .7); font-size: var(--rf-small, .82em); display: flex; align-items: center; gap: .5em; }
.refinement-two-way .rf-tw-earlier::after { content: ''; flex: 1; border-top: 1px dashed color-mix(in srgb, var(--rf-tw-accent) 35%, transparent); }
/* The card a record shows when the pointer rests on it: the popup look of the plugin's other popups. */
.refinement-two-way-peek { position: fixed; z-index: 999; width: max-content; max-width: 360px; padding: 8px 10px; cursor: pointer;
  background: hsl(var(--popover)); color: hsl(var(--popover-foreground)); border-radius: var(--rf-popup-radius, 6px);
  box-shadow: var(--rf-popup-shadow, 0 4px 6px -1px rgba(0, 0, 0, .1), 0 2px 4px -2px rgba(0, 0, 0, .1));
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent); font-size: var(--rf-row, .875rem); line-height: 1.45; }
.refinement-two-way-peek .rf-tw-peek-title { font-weight: 600; text-decoration: underline transparent; transition: text-decoration-color .1s ease; }
.refinement-two-way-peek:hover .rf-tw-peek-title { text-decoration-color: currentColor; }
.refinement-two-way-peek .rf-tw-peek-meta { color: var(--ls-secondary-text-color); font-size: .9em; }
.refinement-two-way-peek .rf-tw-peek-fields { display: grid; grid-template-columns: max-content minmax(0, 1fr); column-gap: 10px; margin-top: 6px; }
.refinement-two-way-peek .rf-tw-peek-name { color: var(--ls-secondary-text-color); }
.refinement-two-way-peek .rf-tw-peek-lines { margin-top: 6px; padding-top: 6px; border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent); }
.refinement-two-way-peek .rf-tw-peek-lines > div::before { content: '• '; color: var(--ls-secondary-text-color); }
/* The box the + opens: the same popup look, a row of kinds, a name and two buttons. */
.refinement-two-way-add { position: fixed; z-index: 999; width: 340px; padding: 10px; display: flex; flex-direction: column; gap: 8px;
  background: hsl(var(--popover)); color: hsl(var(--popover-foreground)); border-radius: var(--rf-popup-radius, 6px);
  box-shadow: var(--rf-popup-shadow, 0 4px 6px -1px rgba(0, 0, 0, .1), 0 2px 4px -2px rgba(0, 0, 0, .1));
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent); font-size: var(--rf-row, .875rem); line-height: 1.4; }
.refinement-two-way-add .rf-tw-add-head { font-weight: 600; }
.refinement-two-way-add .rf-tw-add-field { font-weight: 400; color: var(--ls-secondary-text-color); }
.refinement-two-way-add .rf-tw-add-kinds { display: flex; flex-wrap: wrap; gap: 4px; }
.refinement-two-way-add button { font: inherit; color: inherit; cursor: pointer; border-radius: 5px; padding: 2px 9px; background: transparent; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); transition: background-color .1s ease, border-color .1s ease; }
.refinement-two-way-add button:hover { background: color-mix(in srgb, currentColor 9%, transparent); border-color: color-mix(in srgb, currentColor 45%, transparent); }
.refinement-two-way-add .rf-tw-add-kinds button { border-radius: 999px; font-size: .92em; color: var(--ls-secondary-text-color); }
.refinement-two-way-add .rf-tw-add-kinds button[data-on] { color: inherit; background: color-mix(in srgb, currentColor 12%, transparent); border-color: color-mix(in srgb, currentColor 45%, transparent); }
.refinement-two-way-add input { width: 100%; box-sizing: border-box; padding: 5px 8px; border-radius: 5px; font: inherit; color: inherit; background: color-mix(in srgb, currentColor 5%, transparent); border: 1px solid color-mix(in srgb, currentColor 22%, transparent); outline: none; }
.refinement-two-way-add input:focus { border-color: color-mix(in srgb, currentColor 50%, transparent); }
.refinement-two-way-add input[data-empty] { border-color: #d9534f; }
.refinement-two-way-add .rf-tw-add-foot { display: flex; align-items: center; gap: 6px; }
.refinement-two-way-add .rf-tw-add-foot span { flex: 1; white-space: nowrap; color: var(--ls-secondary-text-color); font-size: .9em; }
.refinement-two-way-add .rf-tw-add-foot button[data-main] { background: color-mix(in srgb, currentColor 14%, transparent); font-weight: 600; }
.refinement-two-way-add .rf-tw-add-foot button[data-main]:hover { background: color-mix(in srgb, currentColor 22%, transparent); }
/* The bar after adding, with Undo: shared.showUndoBar, drawn by the rules in parts/shared.js (moved there in 0.4.197). */
`;
/* Logseq draws the properties under a record as one strip (.bottom-properties-pills-strip, flex-nowrap and
   overflow-x hidden), so a record with several fields is cut off at the right edge, behind an Expand button the
   plugin's plainProperties turns into a triangle. Here the strip wraps onto more lines, a field never split
   across two, so every field shows (seen in 2.0.2 on a scan visit: "report · date · doctor · facility · visit ty…"). */
const STRIP = '.ls-block .positioned-properties.block-below .bottom-properties-pills-strip';
// The row around the strip is held to one line's height (max-height 32px, overflow hidden) and centres it.
const openRowsCss = `
.ls-block .positioned-properties.block-below .bottom-properties-row { max-height: none !important; height: auto !important; overflow: visible !important; align-items: flex-start !important; }
${STRIP} { flex-wrap: wrap !important; overflow: visible !important; row-gap: .1rem; }
${STRIP} > .bottom-property-pill { max-width: 100%; }
`;
/* Logseq's own far end (0.4.146, the owner's pick): the tag-named tabs below a page's blocks list the same records
   as the rows, without the field that links them. Left out only in the main view, and only while the rows are drawn
   there, so a page in the sidebar (which gets no rows) and a page with none keep Logseq's list. */
const hideTagListsCss = `
#main-content-container:has(.refinement-two-way .rf-tw-row) :is(.ls-bidirectional-properties, .ls-bidirectional-block-container) { display: none !important; }
`;
function applyStyles() {
  sendStyle('refinement-two-way', setting('twoWayRows') ? twoWayCss : '');
  sendStyle('refinement-two-way-hide-tag-lists', setting('twoWayRows') && setting('twoWayHideTagLists') ? hideTagListsCss : '');
  sendStyle('refinement-open-property-rows', setting('openPropertyRows') ? openRowsCss : '');
}

let timer = 0, indexTimer = 0;
const later = (ms = 600) => { clearTimeout(timer); timer = setTimeout(() => load().catch(error => warnOnce('could not refresh the two-way rows', error)), ms); };
const indexLater = ms => { clearTimeout(indexTimer); indexTimer = setTimeout(() => loadIndex().catch(error => warnOnce('could not read the rows of every page', error)), ms); };
function start() {
  ({ UUID, isEntityId, watchDomEarly, addsElements, sendStyle, titleOf, provided, dsQuery, uuidsIn } = take(window.refinementCore, ['UUID', 'isEntityId', 'watchDomEarly', 'addsElements', 'sendStyle', 'titleOf', 'provided', 'dsQuery', 'uuidsIn']));
  applyStyles();
  readHeights();
  readOpen();
  watchDomEarly(drawEarly);
  draw(host());
  // At once (0.4.150): the look-up waits in line behind Logseq loading the page anyway. The box stays until the next
  // page is drawn (0.4.182): draw() moves it, or takes it away, in the same frame.
  onUnload(logseq.App.onRouteChanged(() => { onRoute(); later(0); }));
  onUnload(logseq.DB.onChanged(() => { later(900); if (indexSize < BIG_INDEX) indexLater(10000); }));
  onUnload(logseq.onSettingsChanged((now, before) => {
    if (settingsSchema.some(item => now?.[item.key] !== before?.[item.key])) { applyStyles(); later(0); indexLater(0); }
  }));
  onUnload(() => { clearTimeout(timer); clearTimeout(indexTimer); clearTimeout(settle.timer); hidePeek(); closeAdd(); state.box?.remove(); state.box = null; });
  later(0);
  indexLater(1500);
}
function provide(core) {
  core.provide({ backwardsLabel, setBackwards, shownAtOtherEnd, setShownAtOtherEnd });
}
(window.refinementParts ||= []).push({ name: 'two-way', schema: settingsSchema, provide, start, stop: runUnloadTasks });
})();
