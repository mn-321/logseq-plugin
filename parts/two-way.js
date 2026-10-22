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
const { host, openEntity, notify, modal, modalButtons, modalHint } = shared;
const { warnOnce, onUnload, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (two-way): ', leaves: { elements: '.refinement-two-way, .refinement-two-way-peek, .refinement-two-way-add, .refinement-two-way-ask' } });

const settingsSchema = [
  { key: 'twoWayHeading', type: 'heading', group: 'reading', rank: 3, title: 'Two-way links', default: null,
    legend: 'Records that point at this page, as rows in its own properties',
    zone: '<div><span class="m">doctor of →</span> &nbsp;<u>9 Appointments</u> <span class="m">· next Nov 12</span></div>',
    description: 'Changes here apply right away.' },
  { key: 'twoWayRows', type: 'boolean', title: 'Links read the same from both ends', default: true,
    description: 'On a page that one of your fields points to (a doctor named as the “doctor” of visits, a report named as the “report” of a scan), each such field becomes a row in the page’s own property list, with an arrow after its name: “doctor of →   9 Appointments · next Nov 12”. Up to three records show by name; more show as a count that opens into the list. Click a record’s line to open it (Shift-click or the ⇥ at its end: in the sidebar); rest the pointer on it to see its fields and first lines. Click the field’s name to open the field; right-click it to change how it reads here. In a list with several kinds of records, click a kind to show only those. The + at the end of a row adds a new record with that field pointing here (Undo in the bar that follows). Tick the box before records (Shift-click a box: every one between) to act on them together: open in the sidebar, change this page to another one in their field, take the link off, add a tag, copy, set or clear a property, or delete them.' },
  { key: 'twoWayNames', type: 'string', title: 'Fields read backwards', default: 'symptoms = logged in; ask = asked; works at = works here; insurer = insurer of; related = related to',
    description: 'How a field’s name reads from the other end, as “field = words; field = words”. A field not listed reads as “field of”; a field ending in “by” or “of” loses it (“prescribed by” reads “prescribed”, “report of” reads “report”), and one ending in another joining word such as “to” or “with” reads the same both ways (“related to”).' },
  { key: 'twoWayOneEnd', type: 'string', title: 'Fields shown from one end only', default: '',
    description: 'Fields whose link is not shown as a row on the page they point to, as “field; field”. Useful for a field that points at a busy page (a status, a city with hundreds of people). The link itself stays: it still shows in that page’s Linked references and in searches. Set from the tag tree as well.' },
  { key: 'twoWayHideTagLists', type: 'boolean', title: 'Leave out Logseq’s tag lists the rows repeat', default: true,
    description: 'Below a page’s own text, Logseq lists the records that link to the page under a heading named after their tag (“Appointment”, “Project”), for tags with two-way links turned on. The rows above already show those records, with the field that links them, so on a page that has the rows the list is left out. Off: Logseq’s list shows as well.' },
];
const setting = shared.settingReader(settingsSchema);
let UUID, isEntityId, watchDomEarly, addsElements, sendStyle, titleOf, provided, uuidsIn;
const take = (core, names) => shared.take(core, names, warnOnce);
const esc = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// What is known about the page on screen: its uuid and one group per field that points at it.
// byPage: each page's rows as last read this session, drawn at once when you come back to it (0.4.150).
// indexed (0.4.182): every page's rows were read in one look-up, so a page not in byPage has none, and a page
// opened for the first time gets its rows in the same frame as its title instead of half a second later.
// open, all and only (0.4.184): per row, whether its list is open, shows every record, or only one kind ("Infusion").
const state = window.refinementTwoWay = { version: 0, pageUuid: '', groups: [], byPage: new Map(), indexed: false, open: new Map(), all: new Set(), only: new Map(), box: null, html: '', picked: new Set(), lastPick: '' };
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
// How a name reads from the other end by itself (0.4.237, the owner saw "report of of" and "related to of"): "doctor"
// reads "doctor of"; a name ending in "by" or "of" loses it ("prescribed by" reads "prescribed", "report of" reads
// "report": the biopsy's report); a name ending in another joining word reads the same both ways ("related to",
// "works with"), since adding "of" after it never makes sense.
const JOINING = /\s+(to|with|and|for|from|in|on|at|about|into|onto|via|versus|vs)$/i;
// A name ending in a past form ("Agent used", "Drug given") reads "… in" (0.4.264, layer 2 item 6, the odd wordings:
// "agent used of" on Oxaliplatin is now "agent used in"); "need" and "feed" are no past forms.
const PAST = /\s+\S*[^e\s]ed$|\s+(given|taken|seen|done|made|written|sent|shown)$/i;
const plainBackwards = name => /\s+(by|of)$/i.test(name) ? name.replace(/\s+(by|of)$/i, '') : JOINING.test(name) ? name : PAST.test(name) ? `${name} in` : `${name} of`;
// Read in the case of the page's own property names ("Report" made from the + menu reads "report of").
const readBackwards = (name, names) => {
  const words = names.get(name.toLowerCase()) || plainBackwards(name);
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
  const plain = plainBackwards(name);
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
// The nodes that point at the pages come from the model (linksInto, 0.4.225); this shapes them into rows.
async function groupsByPage(id) {
  const { pages, fields, records: found } = await provided.linksInto(id);
  if (!found.size) return new Map();
  const records = new Map();
  // The titles are made readable together (0.4.150): each one with a link in it asks the database for that link's name.
  await Promise.all([...found].map(async ([b, record]) => {
    let title = record.title;
    try { title = await provided.readableTitle(title); } catch { /* the stored words, then */ }
    // Links read as the words they show (0.4.147): "saw [[Dr. Joe]]" as "saw Dr. Joe", "[the scan]([[CT]])" as "the scan".
    title = String(title).replace(/\s+#(?:\[\[[^\]]*\]\]|[^\s#\[\]]+)/g, '').replace(/\[([^\[\]]+)\]\(\[\[[^\]]*\]\]\)/g, '$1')
      .replace(/\[\[([^\]]+)\]\]/g, '$1').trim() || 'Untitled';
    records.set(b, { uuid: record.uuid, title, tag: record.tag || 'note', day: record.day });
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
      groups.push({ name, label: readBackwards(name, names), items, fieldUuid: fields.get(name)?.uuid || '', ident: fields.get(name)?.ident || '' });
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
/* A node's name in a row (0.4.261, layer 2 item 5, "long names in two-way rows"): its first sentence; the whole line
   shows when the pointer rests on it (the card, and the name's own tip). "Post-op check with Dr. Patel. Wounds fine, I
   can drive" reads "Post-op check with Dr. Patel."; a full stop after Dr, Mr, St and the like is not an end. No limit
   on its length (0.4.263, the owner: "get rid of the sentence character limit"). */
const ABBREVIATION = /\b(?:dr|mr|mrs|ms|prof|st|vs|no|approx|e\.g|i\.e|etc)\.$/i;
function shortName(title) {
  const text = String(title || '').trim();
  for (const m of text.matchAll(/[.!?](?=\s+\S)/g)) if (!ABBREVIATION.test(text.slice(0, m.index + 1))) return text.slice(0, m.index + 1);
  return text;
}
const recordLink = item => { const short = shortName(item.title); return `<a class="rf-tw-record" data-uuid="${esc(item.uuid)}" href="#"${short !== item.title ? ` title="${esc(item.title)}"` : ''}>${esc(short)}</a>`; };
const addLink = group => group.ident ? `<a class="rf-tw-add" data-field="${esc(group.name)}" href="#" title="New record with “${esc(group.name)}” set to this page">+</a>` : '';
const pickBox = (group, item) => { const key = `${item.uuid}|${group.name}`, on = state.picked.has(key); return `<span class="rf-tw-pick" data-pick="${esc(key)}" role="checkbox" aria-checked="${on}"${on ? ' data-on=""' : ''} title="Pick (Shift-click: every one from the last picked)"></span>`; };
// A record's tag at the right opens the tag's page, Shift-click in the sidebar (0.4.297, the owner: "should be able to
// click on tag in two-way area on right side"); the kind chips above an open list are what filter it.
const tagLink = item => item.tag && item.tag !== 'note' ? `<a class="rf-tw-tag" data-tag-page="${esc(item.tag)}" href="#" title="Open #${esc(item.tag)} (Shift-click: in the sidebar)">${esc(item.tag)}</a>` : `<span class="rf-tw-tag">${esc(item.tag)}</span>`;
const sideLink = item => `<a class="rf-tw-side" data-uuid="${esc(item.uuid)}" href="#" title="Open in the sidebar (or Shift-click the name)">⇥</a>`;
function rowHtml(group) {
  const key = `${state.pageUuid}|${group.name}`;
  const tip = `“${esc(group.name)}” on the records listed here points to this page. Change it on the record.`;
  const label = `${esc(group.label)}<span class="rf-tw-arrow">→</span>`;
  // A row that folds has its chevron just before its list, in the room left of the values (0.4.195, the owner's ask).
  const fold = group.items.length > INLINE ? `<a class="rf-tw-fold" data-key="${esc(key)}" href="#" title="${isOpen(key) ? 'Fold the list' : 'Open the list'}" aria-label="${isOpen(key) ? 'Fold' : 'Open'} ${esc(group.label)}"><span class="rf-tw-chevron"></span></a>` : '';
  const name = group.fieldUuid
    ? `<div class="rf-tw-name">${addLink(group)}<a class="rf-tw-field" data-uuid="${esc(group.fieldUuid)}" href="#" title="${tip} Click to open the “${esc(group.name)}” field.">${label}</a></div>`
    : `<div class="rf-tw-name" title="${tip}">${addLink(group)}${label}</div>`;
  if (group.items.length <= INLINE) {
    const values = group.items.map(item => `<span class="rf-tw-item" data-uuid="${esc(item.uuid)}">${pickBox(group, item)}${recordLink(item)}${item.day ? `<span class="rf-tw-day">${esc(dayText(item.day))}</span>` : ''}${tagLink(item)}${sideLink(item)}</span>`).join('');
    return `<div class="rf-tw-row" data-field="${esc(group.name)}">${name}<div class="rf-tw-value">${values}</div></div>`;
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
      const tag = tagLink(item);
      return `${earlier}<div class="rf-tw-line" data-uuid="${esc(item.uuid)}">${pickBox(group, item)}<span class="rf-tw-day">${esc(dayText(item.day))}</span>${recordLink(item)}${tag}${sideLink(item)}</div>`;
    }).join('');
    const more = items.length > LISTED ? `<a class="rf-tw-more" data-key="${esc(key)}" href="#">${all ? 'show fewer' : `show all ${items.length}`}</a>` : '';
    list = `<div class="rf-tw-list">${chips}${lines}${more}</div>`;
  }
  return `<div class="rf-tw-row" data-field="${esc(group.name)}"${open ? ' data-open=""' : ''}>${name}<div class="rf-tw-value">${fold}<a class="rf-tw-toggle" data-key="${esc(key)}" href="#" title="${open ? 'Fold the list' : 'Open the list'}">${esc(summary(group.items))}</a></div>${list}</div>`;
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
/* Every piece of the card opens what it names (0.4.262, the owner: "make the different links and elements of the hover
   clickable"): the title the node itself, its tag the tag's page, a property's name the property's page, a value the
   page it points to, a line the bullet it is, a link in a line its page; Shift-click opens it in the right sidebar.
   Words that name nothing (a text value) open the node, as the card always did. */
async function peekData(uuid, field) {
  const key = `${uuid}|${field}`;
  if (peek.cache.has(key)) return peek.cache.get(key);
  const fields = await provided.nodeFields(uuid);
  fields.delete(field);
  const readable = async text => { try { return String(await provided.readableTitle(String(text || ''))).trim(); } catch { return String(text || '').trim(); } };
  const rows = [];
  for (const [name, values] of [...fields].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 8)) {
    const shown = await Promise.all(values.map(async v => ({ text: v.day ? dayText(v.day) : (await readable(v.title ?? v.text)).replace(/\[\[([^\]]+)\]\]/g, '$1'), uuid: v.uuid || '' })));
    const seen = new Set(), kept = shown.filter(v => v.text && !seen.has(v.text) && seen.add(v.text));
    if (kept.length) rows.push({ name, uuid: fields.props?.get(name) || '', values: kept });
  }
  let lines = [];
  try { lines = (await Promise.all((await provided.firstLines(uuid, 4, true)).map(async line => ({ uuid: line.uuid, text: await readable(line.title) })))).filter(line => line.text); } catch { /* no lines, then */ }
  const data = { rows, lines };
  peek.cache.set(key, data);
  return data;
}
// A piece that opens a node by uuid, or a page by its name.
const opens = (html, uuid, page) => uuid ? `<span class="rf-tw-peek-open" data-open-uuid="${esc(uuid)}">${html}</span>` : page ? `<span class="rf-tw-peek-open" data-open-page="${esc(page)}">${html}</span>` : html;
// A line's words with its links open: [[Page]] as Page, [words]([[Page]]) as words, each opening the page.
function lineHtml(text) {
  const short = text.length > 140 ? text.slice(0, 139) + '…' : text;
  let html = '', at = 0;
  for (const m of short.matchAll(/\[([^\[\]]+)\]\(\[\[([^\]]+)\]\]\)|\[\[([^\]]+)\]\]/g)) {
    html += esc(short.slice(at, m.index)) + opens(esc(m[1] ?? m[3]), '', m[2] ?? m[3]);
    at = m.index + m[0].length;
  }
  return html + esc(short.slice(at));
}
function peekHtml(item, field, data) {
  const meta = [item.tag && item.tag !== 'note' ? opens(esc('#' + item.tag), '', item.tag) : '', item.day ? esc(dayText(item.day)) : ''].filter(Boolean).join(' · ');
  const head = `<div class="rf-tw-peek-title">${opens(esc(item.title), item.uuid)}</div><div class="rf-tw-peek-meta">${meta}</div>`;
  // The record's own day is in the line above already.
  const fields = data.rows.filter(row => !item.day || row.values.map(v => v.text).join(', ') !== dayText(item.day));
  const rows = fields.length ? `<div class="rf-tw-peek-fields">${fields.map(row => `<span class="rf-tw-peek-name">${opens(esc(row.name), row.uuid)}</span><span>${row.values.map(v => opens(esc(v.text), v.uuid)).join(', ')}</span>`).join('')}</div>` : '';
  const lines = data.lines.length ? `<div class="rf-tw-peek-lines">${data.lines.map(line => `<div class="rf-tw-peek-line" data-open-uuid="${esc(line.uuid)}">${lineHtml(line.text)}</div>`).join('')}</div>` : '';
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
// A page by its name: its uuid from the page list, else Logseq finds it by name.
async function openPage(name, inSidebar) {
  const page = (await provided.propPages().catch(() => [])).find(p => p.lower === name.toLowerCase());
  if (page?.uuid) return openEntity(page.uuid, inSidebar);
  if (inSidebar) { const found = await logseq.Editor.getPage(name).catch(() => null); if (found?.uuid) return logseq.Editor.openInRightSidebar(found.uuid); }
  logseq.App.pushState('page', { name });
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
  el.className = 'refinement-two-way-peek rf-pop';
  el.innerHTML = peekHtml(item, group.name, data);
  el.addEventListener('mouseenter', () => clearTimeout(peek.hide));
  el.addEventListener('mouseleave', hidePeekSoon);
  el.addEventListener('mousedown', event => event.stopPropagation());
  el.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation();
    // The innermost piece that names something: a link in a line before the line it is in.
    const piece = event.target.closest?.('[data-open-page], [data-open-uuid]');
    const page = piece?.dataset.openPage, uuid = piece?.dataset.openUuid || item.uuid;
    hidePeek();
    if (page) openPage(page, event.shiftKey); else openEntity(uuid, event.shiftKey);
  });
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
const SETTLE_MS = 2000, HEIGHTS_KEY = 'refinementTwoWayRoom', LEAST_KEY = 'refinementTwoWayLeast';
/* A first visit (0.4.283): no room is known for the page, but Logseq always puts at least its "Add property" row
   between the title and the rows, a moment after the title (seen on Zz CUP: the rows and the words pushed down one
   row). The least room any settled page had is held then: never more than Logseq adds on any page seen. */
let least = 0;
const settle = { since: 0, page: '', leaving: '', saved: false, timer: 0, ease: 0 };
let heights = new Map();
const readHeights = () => { try { const storage = host().defaultView.localStorage; heights = new Map(Object.entries(JSON.parse(storage.getItem(HEIGHTS_KEY) || '{}'))); least = Number(storage.getItem(LEAST_KEY)) || 0; } catch { heights = new Map(); least = 0; } };
function remember(page, height) {
  height = Math.round(height);
  if (height > 0 && (!least || height < least)) { least = height; try { host().defaultView.localStorage.setItem(LEAST_KEY, String(least)); } catch { /* kept for this session */ } }
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
  // Settled: the room still held, if any, eases away over a moment instead of snapping (0.4.283); then the room
  // is kept for next time, so the next visit holds the right amount from the start.
  if (mode === 'save') { settle.saved = true; if (room >= 0) remember(page, room); if (held) easeHold(box); else setHold(box, 0); return; }
  setHold(box, Math.max(0, Math.round((heights.has(page) ? heights.get(page) : least) - room)));
}
const setHold = (box, px) => { if (px) box.style.setProperty('--rf-tw-hold', px + 'px'); else if (box.style.length) box.removeAttribute('style'); };
function easeHold(box) {
  box.setAttribute('data-rf-settling', '');
  box.style.setProperty('--rf-tw-hold', '0px');
  clearTimeout(settle.ease);
  settle.ease = setTimeout(() => { box.removeAttribute('data-rf-settling'); if (box.style.getPropertyValue('--rf-tw-hold') === '0px') setHold(box, 0); }, 300);
}
function onRoute() {
  hidePeek(); closeAdd(); state.picked.clear(); state.lastPick = '';
  // The page being left, which may still be on screen for a moment and must not take the new page's place.
  settle.leaving = settle.page || shownPage(host());
  Object.assign(settle, { since: performance.now(), page: '', saved: false });
  clearTimeout(settle.timer); clearTimeout(settle.ease);
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
    box.addEventListener('contextmenu', onRename);
    state.html = '';
  }
  if (!rows) state.picked.clear();
  const html = rows ? barHtml() + state.groups.map(rowHtml).join('') : '';
  if (state.html !== html) { state.html = html; box.innerHTML = html; }
  box.toggleAttribute('data-picking', state.picked.size > 0);
  if (anchor.nextElementSibling !== box) anchor.after(box);
  holdRoom(doc, box, mode, page);
  if (!rows && mode === 'save') box.remove();
}
// Before the screen is drawn (0.4.182), so the rows come in the same frame as the property list they sit under. Only
// when elements came or went, or while a page settles.
const drawEarly = (doc, records) => { if (performance.now() - settle.since < SETTLE_MS || addsElements(records)) draw(doc); };
function onClick(event) {
  const pickEl = event.target.closest?.('.rf-tw-bar button') || event.target.closest?.('.rf-tw-row .rf-tw-pick');
  if (pickEl) { event.preventDefault(); event.stopPropagation(); hidePeek(); return pickEl.dataset.act ? act(pickEl.dataset.act, pickEl) : togglePick(pickEl, event.shiftKey); }
  // A click that just misses the box, anywhere in the room left of the record, ticks it too (0.4.297, the owner: "make
  // checkbox tap area bigger"): before, it opened the record and took you off the page.
  const rowEl = !event.target.closest?.('a') && event.target.closest?.('.rf-tw-line, .rf-tw-item');
  const first = rowEl && rowEl.querySelector(':scope > :not(.rf-tw-pick)');
  const box = rowEl && rowEl.querySelector(':scope > .rf-tw-pick');
  if (box && first && event.clientX < first.getBoundingClientRect().left) { event.preventDefault(); event.stopPropagation(); hidePeek(); return togglePick(box, event.shiftKey); }
  const target = event.target.closest?.('a');
  const line = !target && event.target.closest?.('.rf-tw-line, .rf-tw-item');
  if (!target && !line) return;
  event.preventDefault(); event.stopPropagation();
  hidePeek();
  if (line) return openEntity(line.dataset.uuid, event.shiftKey);
  if (target.matches('.rf-tw-record, .rf-tw-field')) return openEntity(target.dataset.uuid, event.shiftKey);
  if (target.matches('.rf-tw-side')) return openEntity(target.dataset.uuid, true);
  if (target.matches('a.rf-tw-tag[data-tag-page]')) return openPage(target.dataset.tagPage, event.shiftKey);
  if (target.matches('.rf-tw-add')) return openAdd(target).catch(error => { warnOnce('could not open the new record box', error); });
  const key = target.dataset.key;
  if (target.matches('.rf-tw-toggle, .rf-tw-fold')) setOpen(key, !isOpen(key));
  else if (target.matches('.rf-tw-more')) { if (state.all.has(key)) state.all.delete(key); else state.all.add(key); }
  else if (target.matches('.rf-tw-chip')) {
    const tag = target.dataset.tag || '';
    if (!tag || state.only.get(key) === tag) state.only.delete(key); else state.only.set(key, tag);
  }
  draw(host());
}

// Where an Undo sits (shared.undo, 0.4.258): at the end of a row's name on the page in the main view; the first row's
// when the change was to several rows at once; at the bottom right when no row is left to sit beside.
const rowNames = field => [...host().querySelectorAll('#main-content-container .refinement-two-way .rf-tw-row')]
  .filter(row => field == null || row.dataset.field === field).map(row => row.querySelector('.rf-tw-name')).filter(Boolean);
let undoCount = 0;
const offerUndo = (text, run, field) => shared.undo.offer({ key: `two-way:${++undoCount}`, at: () => field == null ? rowNames().slice(0, 1) : rowNames(field), text, run });

/* Right-click a row's name to change how it reads here (0.4.237, the owner: "I should be able to right click
   “report of of” and edit display name"). Saved in "Fields read backwards", as the tag map's box does; empty goes
   back to how the name reads by itself. Undo is the arrow after the row's name. */
async function onRename(event) {
  const nameEl = event.target.closest?.('.rf-tw-name');
  const group = nameEl && state.groups.find(g => g.name === nameEl.closest('.rf-tw-row')?.dataset.field);
  if (!group) return;
  event.preventDefault(); event.stopPropagation(); hidePeek();
  const before = backwardsLabel(group.name);
  const typed = await ask(`How “${group.name}” reads on the page it points to`, `Empty: back to “${plainBackwards(group.name).toLowerCase()}”. Changes it on every page.`, [], 'Save', before, true, nameEl);
  if (typed == null || typed === before) return;
  setBackwards(group.name, typed);
  offerUndo(typed ? `“${group.name}” now reads “${typed}” here` : `“${group.name}” reads as it does by itself again`, () => setBackwards(group.name, before), group.name);
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
  const pages = await provided.pagesAmong(uuids, uuidsIn);
  const asPage = pages * 2 > uuids.length;
  const title = page.title || page.originalName || page.name || 'this page';
  const el = adding.el = doc.createElement('div');
  el.className = 'refinement-two-way-add rf-pop';
  /* The box (0.4.298, the owner: "should be New `Consultation` Record – Property: Value … consultation as drop down …
     tag in mono … add which page to add it to on bottom left"): one heading line with the tag as a list in monospace and
     the property and this page drawn as Logseq draws a property capsule; the name; then where it goes and the buttons. */
  const listId = `rf-tw-add-pages-${Date.now()}`;
  el.innerHTML = `<div class="rf-tw-add-head">New <span class="rf-tw-add-kind"><select aria-label="Tag of the new node">${kinds.map(tag => `<option value="${esc(tag)}"${tag === kind ? ' selected' : ''}>${esc(tag)}</option>`).join('')}<option value="">no tag</option></select></span> record <span class="rf-tw-add-dash">–</span> <span class="rf-tw-add-pill"><span class="rf-tw-add-prop">${esc(group.name)}:</span> ${esc(title)}</span></div>
    <input type="text" class="rf-tw-add-name" placeholder="Name, e.g. ${esc(group.items[0]?.title || 'a new visit')}" spellcheck="false">
    <div class="rf-tw-add-foot">${asPage ? '<span class="rf-tw-add-where-text">As a new page</span>' : `<span class="rf-tw-add-where"><select aria-label="Where it goes"><option value="journal">On today’s journal</option><option value="here">On ${esc(title)}</option><option value="page">On another page…</option></select><input type="text" class="rf-tw-add-page" list="${listId}" placeholder="Page name" spellcheck="false" hidden><datalist id="${listId}"></datalist></span>`}<button type="button" class="rf-btn" data-act="open">Add and open</button><button type="button" class="rf-btn rf-go" data-act="add" data-main="">Add</button></div>`;
  const input = el.querySelector('.rf-tw-add-name');
  const kindList = el.querySelector('.rf-tw-add-kind select'), whereList = el.querySelector('.rf-tw-add-where select'), pageField = el.querySelector('.rf-tw-add-page');
  kindList.addEventListener('change', () => { kind = kindList.value; });
  whereList?.addEventListener('change', async () => {
    pageField.hidden = whereList.value !== 'page';
    if (pageField.hidden) return input.focus();
    const list = el.querySelector('datalist');
    if (!list.childElementCount) for (const p of (await provided.propPages().catch(() => [])).slice(0, 2000)) { const o = doc.createElement('option'); o.value = p.title; list.append(o); }
    pageField.focus();
  });
  for (const field of [kindList, whereList, pageField]) field?.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); closeAdd(); }
    else if (event.key === 'Enter' && field === pageField && !event.isComposing) { event.preventDefault(); submit(event.metaKey || event.shiftKey); }
  });
  el.addEventListener('mousedown', event => event.stopPropagation());
  el.addEventListener('click', event => {
    const pick = event.target.closest('button');
    if (!pick) return;
    event.preventDefault(); event.stopPropagation();
    submit(pick.dataset.act === 'open');
  });
  input.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); closeAdd(); }
    else if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); submit(event.metaKey || event.shiftKey); }
  });
  const submit = async open => {
    const name = input.value.trim();
    if (!name) { input.focus(); input.setAttribute('data-empty', ''); return; }
    const where = whereList?.value || 'journal', other = pageField?.value.trim() || '';
    if (where === 'page' && !other) { pageField.focus(); pageField.setAttribute('data-empty', ''); return; }
    closeAdd();
    try { await addRecord({ group, page, name, kind, open, asPage, where, other }); }
    catch (error) { warnOnce('could not add the new record', error); notify('The new record could not be added', 'warning'); }
  };
  doc.body.appendChild(el);
  const at = button.getBoundingClientRect(), size = el.getBoundingClientRect(), win = doc.defaultView;
  el.style.left = `${Math.round(Math.max(8, Math.min(at.left, win.innerWidth - size.width - 8)))}px`;
  el.style.top = `${Math.round(at.bottom + 6 + size.height < win.innerHeight - 8 ? at.bottom + 6 : Math.max(8, at.top - 6 - size.height))}px`;
  input.focus();
  // A click anywhere else closes the box.
  const away = event => { if (!adding.el) return doc.removeEventListener('mousedown', away, true); if (!adding.el.contains(event.target)) { closeAdd(); doc.removeEventListener('mousedown', away, true); } };
  doc.addEventListener('mousedown', away, true);
}
async function addRecord({ group, page, name, kind, open, asPage, where = 'journal', other = '' }) {
  if (asPage && await logseq.Editor.getPage(name).catch(() => null)) return notify(`A page named “${name}” already exists, so nothing was added`, 'warning');
  const prop = (await provided.propSchema()).props.find(p => p.ident === group.ident);
  let tagUuid = '';
  if (kind) {
    tagUuid = await provided.tagUuidNamed(kind);
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
    // Where it goes (0.4.298): today's journal, this page, or another page named in the box (an existing one only).
    let target = '';
    if (where === 'here') target = String(page.uuid);
    else if (where === 'page') {
      const found = (await provided.propPages()).find(p => p.lower === other.toLowerCase()) || await logseq.Editor.getPage(other).catch(() => null);
      if (!found?.uuid) return notify(`There is no page named “${other}”, so nothing was added`, 'warning');
      target = String(found.uuid);
    } else {
      const now = new Date();
      const journalId = await provided.journalIdFor(todayNumber(), await provided.journalTitleFor(now.getFullYear(), now.getMonth() + 1, now.getDate()));
      target = journalId ? String(await provided.uuidById(journalId)) : '';
      if (!target) throw new Error('no journal page for today');
    }
    block = await logseq.Editor.appendBlockInPage(target, name);
    if (!block?.uuid) throw new Error('the block was not made');
    undo = async () => { await logseq.Editor.removeBlock(block.uuid); later(300); };
  }
  try {
    if (tagUuid) await logseq.Editor.addBlockTag(block.uuid, tagUuid);
    if (prop?.many) await logseq.Editor.upsertBlockProperty(block.uuid, group.ident, [page.id], { entityId: true, reset: true });
    else await logseq.Editor.upsertBlockProperty(block.uuid, group.ident, page.id, { entityId: true });
  } catch (error) { await undo().catch(() => {}); throw error; }
  later(300);
  offerUndo(`Added “${name}”${kind ? ` (${kind})` : ''}${asPage ? ' as a page' : where === 'here' ? ' to this page' : where === 'page' ? ` to ${other}` : ' to today’s journal'}`, undo, group.name);
  if (open) openEntity(block.uuid, true);
}

/* Picking records and acting on them together (0.4.228, the owner's ask: "selected in groups and be acted on", like
   Logseq's own tables). A tick box before each record, shown under the pointer and on every record while any is
   ticked; Shift-click ticks every record from the last one ticked. A pick is a record under one field ("uuid|field"),
   since a record can point here through two fields. The bar above the rows, as Logseq's table has: how many are
   picked, then open in the sidebar, point to another page, take the link off (these two through the picked record's
   own field), add a tag, copy, set a property, clear a property, delete. Every change but delete has Undo in the bar
   at the bottom; delete asks first. Escape or the bar's box clears the picks; going to another page does too. */
const TRASH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
function barHtml() {
  if (!state.picked.size) return '';
  const b = (act, text, title) => `<button type="button" data-act="${act}" title="${esc(title)}">${text}</button>`;
  return `<div class="rf-tw-bar"><button type="button" data-act="clear" class="rf-tw-bar-count" title="Clear the picks (Escape)"><span class="rf-tw-pick" data-on=""></span>Picked: ${state.picked.size}</button>${
    b('sidebar', 'Sidebar', 'Open them in the sidebar')}${b('point', `Change “${esc(pageTitle())}” to…`, 'Name another page in their field instead of this one')}${
    b('unlink', `Remove “${esc(pageTitle())}”`, 'Take this page out of their field')}${b('tag', '#', 'Add a tag')}${b('copy', 'Copy', 'Copy them as references')}${
    b('set', 'Set property', 'Give them all one value')}${b('unset', 'Unset property', 'Clear a property on them all')}${b('delete', TRASH, 'Delete them')}</div>`;
}
// The page's own name, for the bar's "Change “Dr. Mei Chen” to…" (0.4.233, the owner: "make it clear"), read once per page.
const named = { uuid: '', title: '' };
const pageTitle = () => named.uuid === state.pageUuid && named.title ? named.title : 'this page';
async function readTitle() {
  const uuid = state.pageUuid;
  if (named.uuid === uuid) return;
  const title = await provided.titleNow(uuid).catch(() => null);
  if (state.pageUuid !== uuid || !title) return;
  Object.assign(named, { uuid, title: await provided.readableTitle(title).catch(() => title) });
  draw(host());
}
function togglePick(el, range) {
  const key = el.dataset.pick, all = [...state.box.querySelectorAll('.rf-tw-row .rf-tw-pick')].map(p => p.dataset.pick);
  const from = all.indexOf(state.lastPick), to = all.indexOf(key);
  if (range && from >= 0 && to >= 0) { const on = !state.picked.has(key); for (const k of all.slice(Math.min(from, to), Math.max(from, to) + 1)) on ? state.picked.add(k) : state.picked.delete(k); }
  else if (state.picked.has(key)) state.picked.delete(key); else state.picked.add(key);
  state.lastPick = key;
  draw(host());
  readTitle().catch(() => {});
}
const picks = () => [...state.picked].map(key => { const at = key.indexOf('|'); return { uuid: key.slice(0, at), group: state.groups.find(g => g.name === key.slice(at + 1)) }; }).filter(p => p.group);
const nodesPicked = () => [...new Set(picks().map(p => p.uuid))];
const titleFor = uuid => { for (const g of state.groups) for (const item of g.items) if (item.uuid === uuid) return item.title; return 'a record'; };
const counted = n => `${n} ${n === 1 ? 'record' : 'records'}`;
// A small box asking for one thing, with a list to choose from; resolves with what was typed, or null. It opens right
// under the button or name that asked (0.4.287, the audit: no box in the middle of the window over a darkened page).
const ask = (heading, hint, options, button = 'OK', value = '', allowEmpty = false, at = null) => modal(null, (box, finish, doc) => {
  box.classList.add('refinement-two-way-ask');
  const label = doc.createElement('label'); label.textContent = heading;
  const input = doc.createElement('input'); input.type = 'text'; input.spellcheck = false; input.value = value;
  const done = () => finish(allowEmpty ? input.value.trim() : input.value.trim() || null);
  const list = doc.createElement('datalist'); list.id = `rf-tw-ask-${Date.now()}`;
  for (const option of options) { const o = doc.createElement('option'); o.value = option; list.append(o); }
  input.setAttribute('list', list.id);
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); done(); } });
  box.append(label, input, list);
  if (hint) box.append(modalHint(doc, hint));
  const row = modalButtons(doc, [['Cancel', () => finish(null)], [button, done, 'go']]);
  box.append(row);
  input.focus(); input.select();
}, null, {}, at);
const sure = (heading, button, at = null) => modal(false, (box, finish, doc) => {
  const label = doc.createElement('label'); label.textContent = heading;
  const row = modalButtons(doc, [['Cancel', () => finish(false)], [button, () => finish(true), 'go']]);
  box.append(label, row); row.lastChild.focus();
}, null, {}, at);
// What a node holds under a property, as ids, so it can be put back exactly (the tag tree's way, parts/tags.js).
async function setValues(uuid, prop, values) {
  if (!values.length) return logseq.Editor.removeBlockProperty(uuid, prop.ident);
  return logseq.Editor.upsertBlockProperty(uuid, prop.ident, prop.many ? values : values[0], { entityId: true, reset: true });
}
// Runs one change on every picked node; a node that fails is left as it was and the rest go on. Undo puts back the rest.
async function writeAll(text, steps) {
  const undos = [];
  let failed = 0;
  for (const step of steps) {
    try { const undo = await step(); if (undo) undos.push(undo); } catch (error) { failed++; warnOnce('a picked record could not be changed', error); }
  }
  state.picked.clear(); later(300); draw(host());
  if (failed) notify(`${failed} of the picked records could not be changed`, 'warning');
  if (undos.length) offerUndo(text, async () => {
    let missed = 0;
    for (const undo of undos.reverse()) { try { await undo(); } catch (error) { missed++; warnOnce('a picked record could not be put back', error); } }
    later(300);
    if (missed) notify(`${missed} of the records could not be put back`, 'warning');
  });
}
const propNamed = async name => (await provided.propSchema()).props.find(p => p.lower === name.toLowerCase());
async function pageNamed(name, prop) {
  const pages = (await provided.propPages()).filter(page => page.lower === name.toLowerCase());
  const fits = pages.filter(page => !prop?.classes?.length || page.tags.some(t => prop.classes.some(c => c.id === t.id)));
  return fits[0] || pages[0] || null;
}
async function act(what, at = null) {
  const chosen = picks(), nodes = nodesPicked();
  if (what === 'clear') { state.picked.clear(); return draw(host()); }
  if (!chosen.length) return;
  if (what === 'sidebar') { for (const uuid of nodes) openEntity(uuid, true); state.picked.clear(); return draw(host()); }
  try {
    if (what === 'copy') {
      const lines = await Promise.all(nodes.map(async uuid => { const page = await logseq.Editor.getPage(uuid).catch(() => null); return page?.name ? `[[${page.title || page.originalName || page.name}]]` : `((${uuid}))`; }));
      await host().defaultView.navigator.clipboard.writeText(lines.join('\n'));
      notify(`Copied ${counted(nodes.length)}`);
      state.picked.clear(); return draw(host());
    }
    const schema = await provided.propSchema();
    const here = await provided.idByUuid(state.pageUuid);
    if (what === 'point' || what === 'unlink') {
      const fields = [...new Set(chosen.map(p => p.group.ident))].map(ident => schema.props.find(p => p.ident === ident)).filter(Boolean);
      let target = null;
      if (what === 'point') {
        const fits = (await provided.propPages()).filter(page => page.id !== here && fields.some(f => !f.classes.length || page.tags.some(t => f.classes.some(c => c.id === t.id))));
        const name = await ask(`Change “${pageTitle()}” to …`, `On ${counted(nodes.length)}: their “${fields.map(f => f.title).join('”, “')}” will name the page you pick instead.`, fits.map(page => page.title), 'Change', '', false, at);
        if (!name) return;
        target = await pageNamed(name, fields[0]);
        if (!target) return notify(`There is no page named “${name}”, so nothing was changed`, 'warning');
      }
      return writeAll(`${what === 'point' ? `Changed “${pageTitle()}” to “${target.title}” on ${counted(chosen.length)}` : `Removed “${pageTitle()}” from ${counted(chosen.length)}`}`, chosen.map(({ uuid, group }) => async () => {
        const prop = schema.props.find(p => p.ident === group.ident);
        if (!prop) return null;
        const had = await provided.valuesOf(uuid, prop.ident);
        let now = had.filter(id => id !== here);
        if (target && !now.includes(target.id)) now = prop.many ? [...now, target.id] : [target.id];
        await setValues(uuid, prop, now);
        return () => setValues(uuid, prop, had);
      }));
    }
    if (what === 'tag') {
      const tags = (await provided.propPages()).filter(page => page.isTag);
      const name = await ask(`Add a tag to ${counted(nodes.length)}`, '', tags.map(t => t.title), 'Add', '', false, at);
      if (!name) return;
      const tagUuid = await provided.tagUuidNamed(tags.find(t => t.lower === name.replace(/^#/, '').toLowerCase())?.title || name.replace(/^#/, ''));
      if (!tagUuid) return notify(`There is no tag named “${name}”, so nothing was changed`, 'warning');
      return writeAll(`Tagged ${counted(nodes.length)} #${name.replace(/^#/, '')}`, nodes.map(uuid => async () => {
        if (await provided.hasTag(uuid, tagUuid)) return null;
        await logseq.Editor.addBlockTag(uuid, tagUuid);
        return () => logseq.Editor.removeBlockTag(uuid, tagUuid);
      }));
    }
    if (what === 'set' || what === 'unset') {
      let names = schema.props.map(p => p.title);
      if (what === 'unset') {
        const held = new Set((await Promise.all(nodes.map(uuid => provided.userValues(uuid)))).flat());
        names = schema.props.filter(p => held.has(p.ident)).map(p => p.title);
        if (!names.length) return notify('The picked records hold none of your properties', 'warning');
      }
      const name = await ask(what === 'set' ? `Set a property on ${counted(nodes.length)}` : `Clear a property on ${counted(nodes.length)}`, what === 'unset' ? `They hold: ${names.join(', ')}` : '', names, 'Next', '', false, at);
      if (!name) return;
      const prop = await propNamed(name);
      if (!prop) return notify(`There is no property named “${name}”, so nothing was changed`, 'warning');
      let value = null;
      if (what === 'set') {
        const kind = prop.choices.length ? 'choice' : prop.type;
        const options = kind === 'choice' ? prop.choices.map(c => c.title)
          : ['node', 'page'].includes(kind) ? (await provided.propPages()).filter(page => !prop.classes.length || page.tags.some(t => prop.classes.some(c => c.id === t.id))).map(page => page.title)
          : kind === 'checkbox' ? ['yes', 'no'] : [];
        const typed = await ask(`${prop.title} for ${counted(nodes.length)}`, kind === 'date' ? 'A day: today, friday, 4 aug, 2026-08-04 …' : prop.many ? 'Added to what each one holds.' : '', options, 'Set', '', false, at);
        if (!typed) return;
        if (kind === 'choice') value = prop.choices.find(c => c.title.toLowerCase() === typed.toLowerCase())?.id;
        else if (['node', 'page'].includes(kind)) value = (await pageNamed(typed, prop))?.id;
        else if (kind === 'date') {
          const day = provided.parseDay(typed, new Date());
          value = day && await provided.journalIdFor(provided.dayNumber(day), await provided.journalTitleFor(day.getFullYear(), day.getMonth() + 1, day.getDate()));
        } else if (kind === 'checkbox') value = /^(y|yes|true|1|on)$/i.test(typed) ? true : /^(n|no|false|0|off)$/i.test(typed) ? false : undefined;
        else if (kind === 'number') value = Number.isFinite(Number(typed)) ? Number(typed) : undefined;
        else value = typed;
        if (value == null) return notify(`“${typed}” is not a value “${prop.title}” takes, so nothing was changed`, 'warning');
      }
      const entity = what === 'set' && (prop.choices.length || ['node', 'page', 'date'].includes(prop.type));
      return writeAll(what === 'set' ? `Set “${prop.title}” on ${counted(nodes.length)}` : `Cleared “${prop.title}” on ${counted(nodes.length)}`, nodes.map(uuid => async () => {
        const had = await provided.valuesOf(uuid, prop.ident);
        if (what === 'unset') { if (!had.length) return null; await logseq.Editor.removeBlockProperty(uuid, prop.ident); }
        else if (entity) await setValues(uuid, prop, prop.many ? [...new Set([...had, value])] : [value]);
        else await logseq.Editor.upsertBlockProperty(uuid, prop.ident, value);
        return () => setValues(uuid, prop, had);
      }));
    }
    if (what === 'delete') {
      const one = nodes.length === 1 ? `“${titleFor(nodes[0])}”` : counted(nodes.length);
      if (!await sure(`Delete ${one}? This cannot be undone from here.`, 'Delete', at)) return;
      return writeAll('', nodes.map(uuid => async () => {
        const page = await logseq.Editor.getPage(uuid).catch(() => null);
        if (page?.name) await logseq.Editor.deletePage(page.name); else await logseq.Editor.removeBlock(uuid);
        return null;
      }));
    }
  } catch (error) { warnOnce(`could not ${what} the picked records`, error); notify('That could not be done', 'warning'); }
}

const twoWayCss = `
/* Under the page's own properties, as more property rows (the light field around them went at the design audit,
   0.4.286, docs/DESIGN-AUDIT-2026-10-22.md: a box around rows meant to read as rows): these rows are the far end of a field held by other
   records, so they read like properties but are not this page's own; the → after the name, pointing at the records that hold the field, says so (a ← before the name until 0.4.186). The names are
   the grey of every property name and the days plain grey words (0.4.141, the owner's pick: no blue, no date box).
   Sizes and columns are Logseq's own property rows above, as measured in 2.0.2 (0.4.144): the text at the page's
   size (the names .94 of it, as theirs), a 150px name column, a 12px gap, the values 22px in where theirs start
   after their bullet, 28px rows; the name starts where theirs does, after the room of their property icon (15px and a 4px gap), and the → follows it. */
.refinement-two-way {
  --rf-tw-accent: var(--ls-secondary-text-color, currentColor);
  margin: calc(.15rem + var(--rf-tw-hold, 0px)) 0 .5rem; padding: 0;
  line-height: 1.5; user-select: text;
}
/* Only holding room while the page settles: no field, no rows. */
.refinement-two-way:not(:has(.rf-tw-row)) { margin: var(--rf-tw-hold, 0px) 0 0; }
/* The room held while the page settled eases away (0.4.283), only then: while the page settles the held room shrinks in the same frame Logseq's list grows, and must not lag. */
.refinement-two-way[data-rf-settling] { transition: margin-top .25s ease; }
.refinement-two-way .rf-tw-row { display: grid; grid-template-columns: minmax(150px, max-content) 1fr; column-gap: 12px; padding: 2px 0; }
.refinement-two-way .rf-tw-name { color: var(--rf-tw-accent); font-size: var(--rf-name, .94em); white-space: nowrap; cursor: default; }
.refinement-two-way .rf-tw-name { padding-left: 19px; }
.refinement-two-way .rf-tw-arrow { display: inline-block; margin-left: .35em; opacity: .85; }
.refinement-two-way .rf-tw-value { min-width: 0; padding-left: 22px; display: flex; flex-wrap: wrap; column-gap: 1.1em; }
.refinement-two-way a { color: inherit; text-decoration: none; cursor: pointer; }
.refinement-two-way .rf-tw-line a.rf-tw-record { justify-self: start; }
.refinement-two-way a.rf-tw-record { border-bottom: 1px solid color-mix(in srgb, currentColor var(--rf-line-pct, 26%), transparent); }
.refinement-two-way a.rf-tw-record:hover { border-bottom-color: currentColor; }
/* A little more room between records (0.4.230, the owner: "just increase line spacing of items", in place of taking the line away). */
.refinement-two-way .rf-tw-line { padding-top: 2px; padding-bottom: 2px; }
.refinement-two-way .rf-tw-value { row-gap: 4px; }
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
/* The + (0.4.297, the owner: "plus should be placed to the left of the property name but on hover"): in the room left
   of the name kept for Logseq's property icon, shown while the pointer is on the row. */
.refinement-two-way .rf-tw-name { position: relative; }
.refinement-two-way .rf-tw-name a.rf-tw-add { position: absolute; left: 0; top: 0; width: 16px; margin: 0; padding: 0; text-align: center; color: var(--ls-secondary-text-color); visibility: hidden; }
.refinement-two-way .rf-tw-row:hover > .rf-tw-name a.rf-tw-add, .refinement-two-way .rf-tw-name a.rf-tw-add:focus-visible { visibility: visible; }
.refinement-two-way .rf-tw-chips { display: flex; flex-wrap: wrap; gap: .3rem; margin: .1rem 0 .3rem; font-size: var(--rf-small, .82em); }
.refinement-two-way .rf-tw-chip { padding: 0 .45rem; border-radius: 999px; color: var(--ls-secondary-text-color); border: 1px solid color-mix(in srgb, var(--rf-tw-accent) 30%, transparent); }
.refinement-two-way .rf-tw-chip { transition: background-color .1s ease, color .1s ease, border-color .1s ease; }
.refinement-two-way .rf-tw-chip:hover { color: var(--ls-primary-text-color, currentColor); border-color: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 45%, transparent); background: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 6%, transparent); }
.refinement-two-way .rf-tw-chip[data-on] { color: var(--ls-primary-text-color, currentColor); background: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 9%, transparent); }
.refinement-two-way .rf-tw-earlier { margin: .2rem 0 .1rem; color: var(--ls-secondary-text-color); opacity: var(--rf-quiet, .7); font-size: var(--rf-small, .82em); display: flex; align-items: center; gap: .5em; }
.refinement-two-way .rf-tw-earlier::after { content: ''; flex: 1; border-top: 1px dashed color-mix(in srgb, var(--rf-tw-accent) 35%, transparent); }
/* The card a record shows when the pointer rests on it: the plugin's one pop-up look (.rf-pop, parts/shared.js). */
.refinement-two-way-peek { z-index: 999; width: max-content; max-width: 360px; padding: 6px 8px; cursor: pointer; }
.refinement-two-way-peek .rf-tw-peek-title { font-weight: 600; }
/* Every piece that opens something is underlined under the pointer, as a link is (0.4.262). */
.refinement-two-way-peek .rf-tw-peek-open { text-decoration: underline transparent; text-underline-offset: 2px; transition: text-decoration-color .1s ease; }
.refinement-two-way-peek .rf-tw-peek-open:hover { text-decoration-color: currentColor; }
.refinement-two-way-peek .rf-tw-peek-line { border-radius: 4px; margin: 0 -4px; padding: 0 4px; }
.refinement-two-way-peek .rf-tw-peek-line:hover { background: var(--rf-ui-hover); }
.refinement-two-way-peek .rf-tw-peek-meta { color: var(--ls-secondary-text-color); font-size: .9em; }
.refinement-two-way-peek .rf-tw-peek-fields { display: grid; grid-template-columns: max-content minmax(0, 1fr); column-gap: 10px; margin-top: 4px; }
.refinement-two-way-peek .rf-tw-peek-name { color: var(--ls-secondary-text-color); }
.refinement-two-way-peek .rf-tw-peek-lines { margin-top: 4px; padding-top: 4px; border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent); }
.refinement-two-way-peek .rf-tw-peek-lines > div::before { content: '• '; color: var(--ls-secondary-text-color); }
/* The box the + opens (0.4.298): the one pop-up look (.rf-pop); a heading line with the tag as a list in monospace and the
   property and this page as a capsule like Logseq's, the name, then where it goes and the buttons (.rf-btn). */
.refinement-two-way-add { z-index: 999; width: 400px; padding: 6px; display: flex; flex-direction: column; gap: 6px; }
.refinement-two-way-add.rf-pop input { width: 100%; margin: 0; }
.refinement-two-way-add [hidden] { display: none !important; }
.refinement-two-way-add .rf-tw-add-head { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 5px; padding: 2px 2px 0; font-weight: 600; }
.refinement-two-way-add .rf-tw-add-dash { font-weight: 400; color: var(--rf-ui-muted); }
.refinement-two-way-add select { font: inherit; color: inherit; background: transparent; cursor: pointer; outline: none; }
.refinement-two-way-add .rf-tw-add-kind select { appearance: none; height: 22px; padding: 0 18px 0 6px; border: 1px solid var(--rf-ui-field); border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .9em; font-weight: 400;
  background: color-mix(in srgb, currentColor 6%, transparent) no-repeat right 5px center / 8px 5px url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 5'%3E%3Cpath d='M0 0h8L4 5z' fill='%23888'/%3E%3C/svg%3E"); }
.refinement-two-way-add select:focus-visible { box-shadow: 0 0 0 2px color-mix(in srgb, var(--rf-ui-fg) 30%, transparent); }
.refinement-two-way-add .rf-tw-add-pill { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 9999px; box-shadow: inset 0 0 0 1px var(--rf-ui-field); font-weight: 400; font-size: .92em; white-space: nowrap; }
.refinement-two-way-add .rf-tw-add-prop { color: var(--rf-ui-muted); }
.refinement-two-way-add input[data-empty] { border-color: #d9534f; }
.refinement-two-way-add .rf-tw-add-foot { display: flex; align-items: center; gap: 6px; }
.refinement-two-way-add .rf-tw-add-where { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.refinement-two-way-add .rf-tw-add-where select { appearance: none; align-self: flex-start; max-width: 100%; padding: 2px 16px 2px 0; border: 0; color: var(--rf-ui-muted); font-size: .9em; overflow: hidden; text-overflow: ellipsis;
  background: no-repeat right 4px center / 8px 5px url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 5'%3E%3Cpath d='M0 0h8L4 5z' fill='%23888'/%3E%3C/svg%3E"); }
.refinement-two-way-add .rf-tw-add-where select:hover { color: var(--rf-ui-fg); }
.refinement-two-way-add .rf-tw-add-where-text { flex: 1; white-space: nowrap; color: var(--rf-ui-muted); font-size: .9em; }
/* Picking (0.4.228): a small box before each record, in the room left of it, as Logseq's table rows have; filled
   with the text colour and a tick when picked. The bar is Logseq's own: a hairline strip of buttons, floating just above the rows so nothing moves when it comes. */
.refinement-two-way .rf-tw-line, .refinement-two-way .rf-tw-item { position: relative; }
.refinement-two-way .rf-tw-row .rf-tw-pick { position: absolute; left: -15px; top: .38em; visibility: hidden; }
/* The box answers 6px round it as well (0.4.297); the room left of the record ticks it too (onClick). */
.refinement-two-way .rf-tw-row .rf-tw-pick::before { content: ''; position: absolute; inset: -6px; }
/* In an open list the box sits left of the outline's line (0.4.229, the owner: "to the left of the outline, not within it"). */
.refinement-two-way .rf-tw-line .rf-tw-pick { left: -34px; top: calc(.38em + 2px); }
/* Records not in a list too, one to a line so their boxes share that column (0.4.230, the owner: "even those not in a outline"). */
.refinement-two-way .rf-tw-item .rf-tw-pick { left: -24px; }
/* Each record on a line of its own, its tag at the right edge as in an open list (0.4.297, the owner: "the tags under
   decided should be right aligned"); the ⇥ keeps the list's last column. */
.refinement-two-way .rf-tw-item { flex-basis: 100%; min-width: 0; display: grid; grid-template-columns: minmax(0, max-content) minmax(0, 1fr) auto 1.2em; column-gap: .5em; align-items: baseline; }
.refinement-two-way .rf-tw-item .rf-tw-day { margin-left: 0; }
/* A record with no day still has its tag and ⇥ in the last two columns. */
.refinement-two-way .rf-tw-item .rf-tw-tag { grid-column: 3; }
.refinement-two-way .rf-tw-item .rf-tw-side { grid-column: 4; }
.refinement-two-way .rf-tw-item a.rf-tw-record { justify-self: start; min-width: 0; } /* a long name wraps, never cut (0.4.263) */
/* The room left of a record, where its box sits, counts as the record under the pointer, so the box shows there too. */
.refinement-two-way :is(.rf-tw-line, .rf-tw-item)::before { content: ''; position: absolute; top: 0; bottom: 0; left: -36px; width: 36px; }
.refinement-two-way .rf-tw-item::before { left: -26px; width: 26px; }
.refinement-two-way .rf-tw-pick { display: inline-block; box-sizing: border-box; width: 12px; height: 12px; border-radius: 3px; cursor: pointer;
  border: 1px solid color-mix(in srgb, var(--ls-primary-text-color, currentColor) 45%, transparent); background: hsl(var(--popover)); }
.refinement-two-way .rf-tw-pick[data-on] { background: hsl(var(--popover-foreground)); border-color: hsl(var(--popover-foreground)); }
.refinement-two-way .rf-tw-pick[data-on]::after { content: ''; display: block; width: 3px; height: 6px; margin: 1px 0 0 3.5px; border: solid var(--ls-primary-background-color, Canvas); border-width: 0 1.5px 1.5px 0; border-color: hsl(var(--popover)); transform: rotate(45deg); }
.refinement-two-way :is(.rf-tw-line, .rf-tw-item):hover .rf-tw-pick, .refinement-two-way[data-picking] .rf-tw-row .rf-tw-pick { visibility: visible; }
.refinement-two-way { position: relative; }
.refinement-two-way .rf-tw-bar { position: absolute; z-index: 5; bottom: calc(100% - 4px); left: 19px; display: flex; flex-wrap: wrap; align-items: stretch; width: max-content; max-width: calc(100% - 19px); box-shadow: var(--rf-popup-shadow, 0 2px 6px rgba(0, 0, 0, .12)); border-radius: 7px; overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--ls-primary-text-color, currentColor) 14%, transparent); background: hsl(var(--popover)); color: hsl(var(--popover-foreground)); font-size: var(--rf-row, .875rem); }
.refinement-two-way .rf-tw-bar button { display: flex; align-items: center; gap: 7px; padding: 3px 10px; border: 0; border-left: 1px solid color-mix(in srgb, var(--ls-primary-text-color, currentColor) 14%, transparent); background: transparent; color: inherit; font: inherit; cursor: pointer; }
.refinement-two-way .rf-tw-bar button:first-child { border-left: 0; }
.refinement-two-way .rf-tw-bar button:hover { background: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 8%, transparent); }
.refinement-two-way-ask input { margin-top: 2px; }
/* Undo after adding or changing: the plugin's one arrow (shared.undo, parts/shared.js, 0.4.258), after the row's name. */
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
  // openRowsCss changes how Logseq lays out its own properties: page looks wait for layer 3 (0.4.251), so it is not sent.
  sendStyle('refinement-open-property-rows', '');
}

let timer = 0, indexTimer = 0;
const later = (ms = 600) => { clearTimeout(timer); timer = setTimeout(() => load().catch(error => warnOnce('could not refresh the two-way rows', error)), ms); };
// Right after Logseq starts its database is not ready for a while (the audit, 0.4.275: the read 1.5 s after a cold
// start failed, and nothing read again until the graph changed): a few quiet tries before saying so.
let indexTries = 0;
const indexLater = ms => { clearTimeout(indexTimer); indexTimer = setTimeout(() => loadIndex().then(() => { indexTries = 0; }, error => {
  if (++indexTries < 5) indexLater(2000 * indexTries); else { indexTries = 0; warnOnce('could not read the rows of every page', error); }
}), ms); };
function start() {
  ({ UUID, isEntityId, watchDomEarly, addsElements, sendStyle, titleOf, provided, uuidsIn } = take(window.refinementCore, ['UUID', 'isEntityId', 'watchDomEarly', 'addsElements', 'sendStyle', 'titleOf', 'provided', 'uuidsIn']));
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
  const escape = event => { if (event.key === 'Escape' && state.picked.size && !event.target.closest?.('input, textarea, [contenteditable="true"]')) { state.picked.clear(); draw(host()); } };
  host().addEventListener('keydown', escape);
  onUnload(() => host().removeEventListener('keydown', escape));
  onUnload(() => { clearTimeout(timer); clearTimeout(indexTimer); clearTimeout(settle.timer); clearTimeout(settle.ease); hidePeek(); closeAdd(); state.box?.remove(); state.box = null; });
  later(0);
  indexLater(1500);
}
function provide(core) {
  core.provide({ backwardsLabel, setBackwards, shownAtOtherEnd, setShownAtOtherEnd });
}
(window.refinementParts ||= []).push({ name: 'two-way', schema: settingsSchema, provide, start, stop: runUnloadTasks });
})();
