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
   (0.4.174) changes how a field reads backwards, and turns its row off, through this part's settings.
   On the kit since 0.4.318 (docs/LAYERS.md; the pages): the rows keep their own layout (one set of columns: the
   day where Logseq's values start, the name, its tag right after it (0.4.320), the tick box in the margin) and draw
   everything else with the kit: a tag as a class (mono, no #), the tick box, the picking bar as a line of quiet
   words above the rows, filters as words, the fold chevron and the arrow after a name from Logseq's font, the +
   and the sidebar icon as quiet buttons, the draft line's field, the menus and the lists as the kit's pop-up
   placed by the browser, a question beside what it asked, the hover card; the graph is read and written only
   through the model's doors, the page and settings changes come from the core; no logseq.* call here. */
const shared = window.refinementShared;
const { host, openEntity, openPageNamed, notify, esc, iconHtml } = shared;
const { warnOnce, onUnload, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (two-way): ', leaves: { elements: '.refinement-two-way' } });

const settingsSchema = [
  { key: 'twoWayHeading', type: 'heading', group: 'reading', rank: 3, title: 'Two-way links', default: null,
    legend: 'Records that point at this page, as rows in its own properties',
    zone: '<div><span class="m">doctor of →</span> &nbsp;<u>9 Appointments</u> <span class="m">· next Nov 12</span></div>',
    description: 'Changes here apply right away.' },
  { key: 'twoWayRows', type: 'boolean', title: 'Links read the same from both ends', default: true,
    description: 'On a page that one of your fields points to (a doctor named as the “doctor” of visits, a report named as the “report” of a scan), each such field becomes a row in the page’s own property list, with an arrow after its name: “doctor of →   9 Appointments · next Nov 12”. Up to three records show by name; more show as a count that opens into the list. Click a record’s line to open it (Shift-click or the sidebar icon at its end: in the sidebar); rest the pointer on it to see its fields and first lines. Click the field’s name to open the field; right-click it to change how it reads here. In a list with several kinds of records, click a kind to show only those. The + at the end of a row adds a new record with that field pointing here (Undo is the faded arrow after the row’s name). Tick the box before records (Shift-click a box: every one between) to act on them together: open in the sidebar, change this page to another one in their field, take the link off, add a tag, copy, set or clear a property, or delete them. A list of more than three can be grouped: the word “group” after its count (or right-click the name, “Group by…”) groups it by tag, month or any property its nodes hold, each group folding, and the + at the end of a group adds a node with that group’s tag or value already set. The small arrow before a node opens its first bullets under it, with a line to add a new one inside it.' },
  { key: 'twoWayNames', type: 'string', title: 'Fields read backwards', default: 'symptoms = logged in; ask = asked; works at = works here; insurer = insurer of; related = related to',
    description: 'How a field’s name reads from the other end, as “field = words; field = words”. A field not listed reads as “field of”; a field ending in “by” or “of” loses it (“prescribed by” reads “prescribed”, “report of” reads “report”), and one ending in another joining word such as “to” or “with” reads the same both ways (“related to”).' },
  { key: 'twoWayOneEnd', type: 'string', title: 'Fields shown from one end only', default: '',
    description: 'Fields whose link is not shown as a row on the page they point to, as “field; field”. Useful for a field that points at a busy page (a status, a city with hundreds of people). The link itself stays: it still shows in that page’s Linked references and in searches. Set from the tag tree as well.' },
  { key: 'twoWayHideTagLists', type: 'boolean', title: 'Leave out Logseq’s tag lists the rows repeat', default: true,
    description: 'Below a page’s own text, Logseq lists the records that link to the page under a heading named after their tag (“Appointment”, “Project”), for tags with two-way links turned on. The rows above already show those records, with the field that links them, so on a page that has the rows the list is left out. Off: Logseq’s list shows as well.' },
];
const setting = shared.settingReader(settingsSchema);
let UUID, isEntityId, watchDomEarly, addsElements, sendStyle, provided, uuidsIn, saveSettings, onPageChange, onDatabaseChange, onSettingsChange, model;
const take = (core, names) => shared.take(core, names, warnOnce);

// What is known about the page on screen: its uuid and one group per field that points at it.
// byPage: each page's rows as last read this session, drawn at once when you come back to it (0.4.150).
// indexed (0.4.182): every page's rows were read in one look-up, so a page not in byPage has none, and a page
// opened for the first time gets its rows in the same frame as its title instead of half a second later.
// open, all and only (0.4.184): per row, whether its list is open, shows every record, or only one kind ("Infusion").
const state = { version: 0, pageUuid: '', groups: [], byPage: new Map(), indexed: false, open: new Map(), all: new Set(), only: new Map(), box: null, html: '', picked: new Set(), lastPick: '', group: new Map(), values: new Map(), opened: new Set(), bullets: new Map(), nodeDraft: null };
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
  saveSettings({ twoWayNames: pairs.map(([field, said]) => `${field} = ${said}`).join('; ') });
}
function setShownAtOtherEnd(name, shown) {
  const names = String(setting('twoWayOneEnd') || '').split(/[;\n]/).map(n => n.trim()).filter(n => n && n.toLowerCase() !== name.toLowerCase());
  if (!shown) names.push(name);
  saveSettings({ twoWayOneEnd: names.join('; ') });
}

async function load() {
  const version = ++state.version;
  let pageUuid = '', groups = [];
  try {
    if (setting('twoWayRows')) {
      const page = await model.currentPage();
      // A zoomed-in block comes back with a page of its own; only a page gets the rows.
      if (page && !page.page && isEntityId(page.id) && !page['journal?'] && !page.journalDay) {
        pageUuid = String(page.uuid || '');
        groups = await groupsFor(page.id);
        await readValues(groupedUuids(groups)).catch(error => warnOnce('could not read the values the rows are grouped by', error));
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
  for (const uuid of state.opened) readBullets(uuid).catch(error => warnOnce('could not read the bullets of a node', error));
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
  const want = [...fresh.values()].flatMap(groupedUuids);
  if (want.length) await readValues(want.slice(0, 2000)).catch(error => warnOnce('could not read the values the rows are grouped by', error));
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
   lit under the pointer and opens on a click anywhere along it; the sidebar icon at its end opens it in the sidebar (as
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
/* The + (as it was until 0.4.296, at the owner's word, 0.4.303: "return that code before we moved around the plus"): at the
   end of the last node of a short row, after the summary of a list, faint until the pointer is on the row. A click opens
   the line to type the new node in. Since 0.4.297 a short row's nodes span the row so their tags line up, so the + sits
   just after the last node's date (or name). The kit's quiet faint button. */
const addLink = group => group.ident && state.draft?.field !== group.name ? `<button type="button" class="rf-quiet rf-faint rf-tw-add" data-field="${esc(group.name)}" title="Add a${/^[aeiou]/i.test(kindsOf(group)[0] || '') ? 'n' : ''} ${esc(kindsOf(group)[0] || 'node')} with “${esc(group.name)}” set to this page">+</button>` : '';
// The kit's tick box, in the margin left of the record (0.4.228; the kit's since 0.4.318).
const pickBox = (group, item) => { const key = `${item.uuid}|${group.name}`, on = state.picked.has(key); return `<input type="checkbox" class="rf-check rf-tw-pick" data-pick="${esc(key)}"${on ? ' checked' : ''} aria-label="Pick" title="Pick (Shift-click: every one from the last picked)">`; };
// A record's tag at the right opens the tag's page, Shift-click in the sidebar (0.4.297, the owner: "should be able to
// click on tag in two-way area on right side"); a tag reads as a class, mono with no # (the kit's tag, 0.4.318).
const tagLink = item => item.tag && item.tag !== 'note' ? `<a class="rf-tag rf-tw-tag" data-tag-page="${esc(item.tag)}" href="#" title="Open ${esc(item.tag)} (Shift-click: in the sidebar)">${esc(item.tag)}</a>` : `<span class="rf-tag rf-tw-tag">${esc(item.tag)}</span>`;
const sideLink = item => `<a class="rf-quiet rf-tw-side" data-uuid="${esc(item.uuid)}" href="#" title="Open in the sidebar (or Shift-click the name)" aria-label="Open in the sidebar">${iconHtml('sidebar')}</a>`;
function rowHtml(group) {
  const key = `${state.pageUuid}|${group.name}`;
  const tip = `“${esc(group.name)}” on the records listed here points to this page. Change it on the record.`;
  const label = `${esc(group.label)}<span class="rf-tw-arrow">${iconHtml('to')}</span>`;
  // A row that folds has its chevron just before its list, in the room left of the values (0.4.195, the owner's ask).
  const fold = group.items.length > INLINE ? `<a class="rf-quiet rf-tw-fold" data-key="${esc(key)}" href="#" title="${isOpen(key) ? 'Fold the list' : 'Open the list'}" aria-label="${isOpen(key) ? 'Fold' : 'Open'} ${esc(group.label)}">${iconHtml('fold')}</a>` : '';
  const name = group.fieldUuid
    ? `<div class="rf-tw-name"><a class="rf-tw-field" data-uuid="${esc(group.fieldUuid)}" href="#" title="${tip} Click to open the “${esc(group.name)}” field.">${label}</a></div>`
    : `<div class="rf-tw-name" title="${tip}">${label}</div>`;
  if (group.items.length <= INLINE) {
    const dateFirst = orderOf(group) === 'date';
    // The words lead (0.4.377, the owner: "it is fine if properties follow the end of a wrapped line"): the day, the
    // tag and the + follow the words wherever they end, together (a + never alone on a line); the sidebar icon at the
    // line's far right.
    const values = group.items.map((item, i, all) => { const last = i === all.length - 1 ? addLink(group) : ''; const day = item.day ? `<span class="rf-tw-day rf-day">${esc(dayText(item.day))}</span>` : ''; if (dateFirst) return `<span class="rf-tw-item rf-tw-datefirst" data-uuid="${esc(item.uuid)}">${pickBox(group, item)}${intoBtn(item)}${day}${recordLink(item)}<span class="rf-tw-tail">${tagLink(item)}${last}</span>${sideLink(item)}</span>${nodeBoxHtml(item)}`; return `<span class="rf-tw-item" data-uuid="${esc(item.uuid)}">${pickBox(group, item)}${intoBtn(item)}${recordLink(item)}<span class="rf-tw-tail">${day}${tagLink(item)}${last}</span>${sideLink(item)}</span>${nodeBoxHtml(item)}`; }).join('');
    return `<div class="rf-tw-row" data-field="${esc(group.name)}">${name}<div class="rf-tw-value">${values}</div>${addLineHtml(group)}</div>`;
  }
  const open = isOpen(key), all = state.all.has(key);
  const counts = new Map();
  for (const item of group.items) counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
  const only = counts.has(state.only.get(key)) ? state.only.get(key) : '';
  const items = only ? group.items.filter(item => item.tag === only) : group.items;
  const shown = all ? items : items.slice(0, LISTED);
  let list = '';
  if (open) {
    // The kinds as the kit's filter words: the one in force in the text colour.
    const chip = (tag, text) => `<button type="button" class="rf-chip rf-tw-chip" data-key="${esc(key)}" data-tag="${esc(tag)}" aria-pressed="${tag === only}">${esc(text)}</button>`;
    const chips = counts.size > 1 ? `<div class="rf-tw-chips">${chip('', `All ${group.items.length}`)}${[...counts].sort((a, b) => b[1] - a[1]).map(([tag, n]) => chip(tag, `${tag} ${n}`)).join('')}</div>` : '';
    const today = todayNumber();
    // Grouped (0.4.369): the nodes in groups by a tag, a month or a property's value, each group folding.
    const grouping = groupingOf(group, items);
    if (grouping) list = `<div class="rf-tw-list">${chips}${grouping.parts.map(part => groupHtml(group, part, grouping.by)).join('')}</div>`;
    else {
      const lines = shown.map((item, i) => lineFor(group, item, i > 0 && item.day && item.day < today && shown[i - 1].day >= today ? '<div class="rf-tw-earlier rf-note">earlier</div>' : '')).join('');
      const more = items.length > LISTED ? `<button type="button" class="rf-quiet rf-faint rf-tw-more" data-key="${esc(key)}">${all ? 'show fewer' : `show all ${items.length}`}</button>` : '';
      list = `<div class="rf-tw-list">${chips}${lines}${more}</div>`;
    }
  }
  return `<div class="rf-tw-row" data-field="${esc(group.name)}"${open ? ' data-open=""' : ''}>${name}<div class="rf-tw-value">${fold}<a class="rf-tw-toggle" data-key="${esc(key)}" href="#" title="${open ? 'Fold the list' : 'Open the list'}">${esc(summary(group.items))}</a>${addLink(group)}${groupBtn(group)}</div>${list}${addLineHtml(group)}</div>`;
}
// One node of an open list (0.4.369, so a group can draw the same line): its box, its arrow, its day, name and tag.
function lineFor(group, item, earlier = '') {
  const tag = tagLink(item);
  if (orderOf(group) === 'name') return `${earlier}<div class="rf-tw-line rf-tw-namefirst" data-uuid="${esc(item.uuid)}">${pickBox(group, item)}${intoBtn(item)}${recordLink(item)}<span class="rf-tw-day rf-day">${esc(dayText(item.day))}</span>${tag}${sideLink(item)}</div>${nodeBoxHtml(item)}`;
  return `${earlier}<div class="rf-tw-line" data-uuid="${esc(item.uuid)}">${pickBox(group, item)}${intoBtn(item)}<span class="rf-tw-day rf-day">${esc(dayText(item.day))}</span>${recordLink(item)}${tag}${sideLink(item)}</div>${nodeBoxHtml(item)}`;
}
/* Write into a node without leaving (0.4.369, the owner kept it from the ideas page: "write into a node"): a small arrow
   before a node, shown with the pointer on its line, opens the node's own first bullets under it, with a line to type
   a new one. Enter adds it as the node's last bullet, in the node itself, as if typed there; the faded Undo arrow takes
   it away. The bullets are read as words (a link in one opens its page); the existing ones are not edited here. */
const BULLETS = 8;
const intoBtn = item => { const on = state.opened.has(item.uuid); return `<a class="rf-quiet rf-tw-into" data-uuid="${esc(item.uuid)}" href="#"${on ? ' data-on=""' : ''} title="${on ? 'Close its bullets' : 'Open its bullets here, to read them and add one'}" aria-label="${on ? 'Close' : 'Open'} the bullets of ${esc(shortName(item.title))}">${iconHtml('fold')}</a>`; };
function nodeBoxHtml(item) {
  if (!state.opened.has(item.uuid)) return '';
  const data = state.bullets.get(item.uuid);
  const lines = data
    ? data.lines.map(line => `<div class="rf-tw-bullet" data-uuid="${esc(line.uuid)}"><span class="rf-tw-bdot rf-faint" aria-hidden="true">•</span><span class="rf-tw-btext">${lineHtml(line.text, 400)}</span></div>`).join('')
      + (data.more ? `<div class="rf-tw-bullet"><span class="rf-tw-bdot" aria-hidden="true"></span><a class="rf-tw-record rf-faint" data-uuid="${esc(item.uuid)}" href="#">and more: open it</a></div>` : '')
    : '<div class="rf-tw-bullet rf-faint"><span class="rf-tw-bdot" aria-hidden="true"></span>Reading…</div>';
  const hint = data && !data.lines.length ? 'Write its first bullet' : 'Add a bullet';
  return `<div class="rf-tw-node" data-uuid="${esc(item.uuid)}">${lines}<div class="rf-tw-bullet rf-tw-bnew"><span class="rf-tw-bdot rf-faint" aria-hidden="true">+</span><span class="rf-field rf-field-inline"><input type="text" class="rf-tw-node-field" data-uuid="${esc(item.uuid)}" placeholder="${hint}" spellcheck="false" aria-label="A new bullet inside ${esc(shortName(item.title))}"></span></div></div>`;
}
async function readBullets(uuid) {
  const lines = await provided.firstLines(uuid, BULLETS + 1, true);
  const read = await Promise.all(lines.map(async line => ({ uuid: line.uuid, text: String(await provided.readableTitle(line.title).catch(() => line.title) || '').trim() })));
  state.bullets.set(uuid, { lines: read.filter(line => line.text).slice(0, BULLETS), more: lines.length > BULLETS });
  if (state.opened.has(uuid)) { state.html = null; draw(host()); }
}
function toggleInto(uuid) {
  if (state.opened.has(uuid)) { state.opened.delete(uuid); if (state.nodeDraft?.uuid === uuid) state.nodeDraft = null; }
  else { state.opened.add(uuid); readBullets(uuid).catch(error => warnOnce('could not read the bullets of a node', error)); }
  state.html = null; draw(host());
  if (state.opened.has(uuid)) focusNodeField(uuid);
}
function focusNodeField(uuid) {
  const field = state.box?.querySelector(`.rf-tw-node-field[data-uuid="${CSS.escape(uuid)}"]`);
  if (field) { field.focus({ preventScroll: true }); field.setSelectionRange(field.value.length, field.value.length); }
}
// The lines to type in are drawn again with the rows; what was typed comes back with them.
function keepNodeField(box) {
  for (const field of box.querySelectorAll('.rf-tw-node-field')) {
    const uuid = field.dataset.uuid;
    if (state.nodeDraft?.uuid === uuid) field.value = state.nodeDraft.text;
    field.addEventListener('input', () => { state.nodeDraft = { uuid, text: field.value }; });
    field.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.isComposing) return;
      if (event.key === 'Enter') { event.preventDefault(); writeBullet(uuid, field.value).catch(error => warnOnce('could not add the bullet', error)); }
      else if (event.key === 'Escape') { event.preventDefault(); field.blur(); }
    });
    for (const type of ['keyup', 'keypress']) field.addEventListener(type, event => event.stopPropagation());
  }
}
async function writeBullet(uuid, typed) {
  const text = String(typed || '').trim();
  if (!text) return;
  state.nodeDraft = null;
  const group = state.groups.find(g => g.items.some(item => item.uuid === uuid));
  try {
    const block = await model.addLineTo(uuid, text);
    if (!block?.uuid) throw new Error('the bullet was not made');
    await readBullets(uuid);
    focusNodeField(uuid);
    offerUndo(`Added a bullet to “${shortName(titleFor(uuid))}”`, async () => { await model.removeBlock(block.uuid); await readBullets(uuid); later(300); }, group?.name);
  } catch (error) { warnOnce('could not add the bullet', error); notify('The bullet could not be added', 'warning'); }
  later(300);
}
// A click inside an opened node: a link in a bullet opens its page, a bullet opens itself, "and more" opens the node.
function onNodeClick(event, node) {
  if (event.target.closest('input')) return true;
  const page = event.target.closest('[data-open-page]')?.dataset.openPage;
  if (page) { event.preventDefault(); event.stopPropagation(); openPage(page, event.shiftKey); return true; }
  const more = event.target.closest('a.rf-tw-record');
  if (more) return false;
  const bullet = event.target.closest('.rf-tw-bullet[data-uuid]');
  if (bullet) { event.preventDefault(); event.stopPropagation(); openEntity(bullet.dataset.uuid, event.shiftKey); return true; }
  return true;
}

/* Group a row by anything (0.4.369, the owner kept it from the ideas page): a list of nodes (more than three) can be
   grouped by their tag, their month, or the value of any property they hold (a claim's Confidence, a task's Project),
   each group folding, biggest first, those with none last. Chosen from the word after the count ("group", then "by
   Confidence") or from the right-click menu on the row's name, and remembered per property. Only how the row is shown:
   nothing is written. The values are read through the model (nodeValues) when a property is chosen and again whenever
   the rows are read, so a row grouped on a page opens grouped. */
const GROUP_KEY = 'refinementTwoWayGroup', GROUP_LISTED = 12;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const groupOf = group => state.group.get(group.name) || '';
const groupName = by => by === 'tag' ? 'tag' : by === 'month' ? 'month' : by.slice(2);
function readGroup() { try { state.group = new Map(Object.entries(JSON.parse(host().defaultView.localStorage.getItem(GROUP_KEY) || '{}'))); } catch { state.group = new Map(); } }
function setGroup(field, by) {
  if (by) state.group.set(field, by); else state.group.delete(field);
  try { host().defaultView.localStorage.setItem(GROUP_KEY, JSON.stringify(Object.fromEntries(state.group))); } catch { /* kept for this session */ }
}
function groupingOf(group, items) {
  const by = groupOf(group);
  if (!by) return null;
  const buckets = new Map();
  const put = (key, label, item, value, none) => { let b = buckets.get(key); if (!b) buckets.set(key, b = { key: String(key), label, items: [], value, none: !!none }); b.items.push(item); };
  if (by === 'tag') for (const item of items) { const none = !item.tag || item.tag === 'note'; put(none ? '' : item.tag, none ? 'No tag' : item.tag, item, null, none); }
  else if (by === 'month') for (const item of items) { if (!item.day) put('', 'No date', item, null, true); else { const m = Math.floor(item.day / 100); put(m, `${MONTH_NAMES[m % 100 - 1]} ${Math.floor(m / 100)}`, item, null); } }
  else if (by.startsWith('p:')) {
    const name = by.slice(2);
    // Not read yet: the plain list until it is.
    if (!items.some(item => state.values.has(item.uuid))) return null;
    for (const item of items) {
      const held = state.values.get(item.uuid)?.get(name);
      if (!held?.values.length) { put('', `No ${name}`, item, null, true); continue; }
      const seen = new Set();
      for (const v of held.values) {
        let label = v.day ? dayText(v.day) : v.text;
        if (!label || seen.has(label)) continue;
        seen.add(label);
        // A bare number says nothing as a group's name: "Severity 3".
        put(label, /^-?\d+(\.\d+)?$/.test(label) ? `${name} ${label}` : label, item, { ident: held.ident, ...v });
      }
    }
  } else return null;
  // Biggest first; a month newest first; numbers, a scale, in order; those with none last.
  const parts = [...buckets.values()], numbers = by.startsWith('p:') && parts.filter(p => !p.none).every(p => p.value && typeof p.value.number === 'number');
  parts.sort((a, b) => a.none - b.none || (by === 'month' ? Number(b.key) - Number(a.key) : numbers ? a.value.number - b.value.number : b.items.length - a.items.length) || a.label.localeCompare(b.label));
  return { by, parts };
}
const groupKey = (group, by, part) => `${state.pageUuid}|${group.name}|${by}|${part.key}`;
function groupHtml(group, part, by) {
  const gkey = groupKey(group, by, part);
  const open = isOpen(gkey), all = state.all.has(gkey);
  const adding = state.draft?.field === group.name && state.draft.gkey === gkey;
  // The + puts a node here with the row's field pointing at this page and the group's value set (not for a month, nor for "none").
  const addable = group.ident && by !== 'month' && (by === 'tag' || !part.none);
  const plus = addable ? `<button type="button" class="rf-quiet rf-faint rf-tw-gadd" data-gkey="${esc(gkey)}" data-field="${esc(group.name)}" title="Add a node here: “${esc(group.name)}” set to this page${by === 'tag' ? `, tagged ${esc(part.label)}` : `, ${esc(groupName(by))} set to ${esc(part.label)}`}">+</button>` : '';
  const shown = all ? part.items : part.items.slice(0, GROUP_LISTED);
  const more = open && part.items.length > GROUP_LISTED ? `<button type="button" class="rf-quiet rf-faint rf-tw-more" data-key="${esc(gkey)}">${all ? 'show fewer' : `show all ${part.items.length}`}</button>` : '';
  const label = by === 'tag' && !part.none ? `<span class="rf-tag rf-tw-gname">${esc(part.label)}</span>` : `<span class="rf-tw-gname">${esc(part.label)}</span>`;
  return `<div class="rf-tw-group"${open ? ' data-open=""' : ''}><div class="rf-tw-ghead"><a class="rf-tw-gtoggle" data-gkey="${esc(gkey)}" href="#" title="${open ? 'Fold' : 'Open'} this group"><span class="rf-tw-gchev">${iconHtml('fold')}</span>${label}<span class="rf-note rf-tw-gn">${part.items.length}</span></a>${plus}</div>${open && adding ? draftLineHtml(group, state.draft) : ''}${open ? shown.map(item => lineFor(group, item)).join('') : ''}${more}</div>`;
}
const groupBtn = group => { const by = groupOf(group); return `<button type="button" class="rf-quiet rf-faint rf-tw-groupby"${by ? ' data-on=""' : ''} data-field="${esc(group.name)}" title="Group the list by a tag, a month or a property">${by ? `by ${esc(groupName(by))}` : 'group'}${iconHtml('chevron-down')}</button>`; };
// The values of these nodes, read through the model (400 at a time) into the cache the groups are made from.
async function readValues(uuids) {
  const need = [...new Set(uuids)].filter(uuid => UUID.test(uuid));
  for (let at = 0; at < need.length; at += 400) {
    const part = need.slice(at, at + 400), found = await provided.nodeValues(part);
    for (const uuid of part) state.values.set(uuid, found.get(uuid) || new Map());
  }
}
const groupedUuids = groups => groups.filter(g => g.items.length > INLINE && groupOf(g).startsWith('p:')).flatMap(g => g.items.map(item => item.uuid));
// What a row can be grouped by, as the kit's menu: nothing, the tag, the month, then each property its nodes hold.
async function groupMenu(group, anchor) {
  closeAdd(); hidePeek();
  await readValues(group.items.map(item => item.uuid)).catch(error => warnOnce('could not read the values to group by', error));
  const by = groupOf(group), held = new Map();
  for (const item of group.items) for (const [name, entry] of state.values.get(item.uuid) || []) {
    if (name === group.name) continue;
    if (!held.has(name)) held.set(name, { nodes: 0, values: new Set() });
    const h = held.get(name); h.nodes++;
    for (const v of entry.values) h.values.add(v.day ? `d${v.day}` : v.text);
  }
  const choose = to => { setGroup(group.name, to); if (state.draft?.gkey) { state.draft = null; closeAdd(); } state.html = null; draw(host()); };
  const items = [{ label: 'Nothing', chosen: !by, run: () => choose('') }];
  if (new Set(group.items.map(item => item.tag)).size > 1) items.push({ icon: 'tag', label: 'Tag', chosen: by === 'tag', run: () => choose('tag') });
  if (group.items.some(item => item.day)) items.push({ icon: 'date', label: 'Month', chosen: by === 'month', run: () => choose('month') });
  const props = [...held].filter(([, h]) => h.values.size > 1 || h.nodes < group.items.length).sort((a, b) => b[1].nodes - a[1].nodes || a[0].localeCompare(b[0]));
  if (props.length) items.push({ sep: true }, ...props.map(([name, h]) => ({ icon: 'property', label: name, right: `${h.values.size} ${h.values.size === 1 ? 'value' : 'values'}`, chosen: by === `p:${name}`, run: () => choose(`p:${name}`) })));
  else items.push({ note: 'These nodes hold no property to group by' });
  adding.pop = shared.popup({ at: anchor, head: `Group “${group.label}” by`, width: 250, items, onClose: () => { adding.pop = null; } });
}
// The + in a group: the line to type in opens under the group's name, with what the group has in common set when it is made.
function startGroupDraft(group, gkey) {
  const grouping = groupingOf(group, group.items);
  const part = grouping?.parts.find(p => groupKey(group, grouping.by, p) === gkey);
  if (!part) return;
  closeAdd(); state.draft = null;
  const d = draftFor(group);
  d.gkey = gkey; d.step = 'name';
  if (grouping.by === 'tag') d.kind = part.none ? '' : part.label;
  d.set = grouping.by.startsWith('p:') && !part.none ? part.value : null;
  setOpen(gkey, true);
  state.html = null; draw(host()); focusDraft();
}
// What a group has in common, put on the new node: a node, a choice or a day by its id, a number or words as they are.
async function setGroupValue(uuid, set) {
  const prop = (await provided.propSchema()).props.find(p => p.ident === set.ident);
  if (!prop) return;
  if (prop.choices.length || ['node', 'page', 'date'].includes(prop.type)) { if (set.id != null) await setValues(uuid, prop, [set.id]); }
  else if (set.number != null) await model.setValue(uuid, prop.ident, set.number);
  else if (set.boolean != null) await model.setValue(uuid, prop.ident, set.boolean);
  else if (set.text != null) await model.setValue(uuid, prop.ident, set.text);
}

// Open or folded, per page and field, kept in Logseq's window storage (0.4.184): open unless you folded it.
/* Date first or name first, per property on every page (0.4.304, the owner: "allow name or date to be chosen for each
   group through a right click"). Unless chosen: a list (more than three) dated first, a short row by name. */
const ORDER_KEY = 'refinementTwoWayOrder';
const orderOf = group => state.order?.get(group.name) || (group.items.length > INLINE ? 'date' : 'name');
function readOrder() { try { state.order = new Map(Object.entries(JSON.parse(host().defaultView.localStorage.getItem(ORDER_KEY) || '{}'))); } catch { state.order = new Map(); } }
function setOrder(field, order) {
  state.order ||= new Map();
  state.order.set(field, order);
  try { host().defaultView.localStorage.setItem(ORDER_KEY, JSON.stringify(Object.fromEntries(state.order))); } catch { /* kept for this session */ }
}
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
   graph changes. It goes when the pointer leaves the record and the card. The card is the kit's (0.4.318). */
const PEEK_MS = 450;
const peek = { timer: 0, hide: 0, card: null, uuid: '', anchor: null, cache: new Map() };
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
// A line's words with its links open: [[Page]] as Page, [words]([[Page]]) as words, each opening the page.
function lineHtml(text, limit = 140) {
  const short = text.length > limit ? text.slice(0, limit - 1) + '…' : text;
  let html = '', at = 0;
  for (const m of short.matchAll(/\[([^\[\]]+)\]\(\[\[([^\]]+)\]\]\)|\[\[([^\]]+)\]\]/g)) {
    html += esc(short.slice(at, m.index)) + `<span class="rf-tw-peek-open" data-open-page="${esc(m[2] ?? m[3])}">${esc(m[1] ?? m[3])}</span>`;
    at = m.index + m[0].length;
  }
  return html + esc(short.slice(at));
}
function findItem(uuid, rowEl) {
  const group = state.groups.find(g => g.name === rowEl?.dataset.field);
  return group ? { group, item: group.items.find(item => item.uuid === uuid) } : {};
}
function onOver(event) {
  const link = event.target.closest?.('a.rf-tw-record');
  if (!link) return;
  clearTimeout(peek.hide);
  if (peek.anchor === link && peek.card && !peek.card.isClosed) return;
  clearTimeout(peek.timer);
  peek.timer = setTimeout(() => showPeek(link).catch(error => warnOnce('could not show the record card', error)), PEEK_MS);
}
function onOut(event) {
  if (!event.target.closest?.('a.rf-tw-record')) return;
  clearTimeout(peek.timer);
  hidePeekSoon();
}
// A page by its name: its uuid from the page list, else Logseq finds it by name (openPageNamed, parts/shared.js).
async function openPage(name, inSidebar) {
  const page = (await provided.propPages().catch(() => [])).find(p => p.lower === name.toLowerCase());
  if (page?.uuid) return openEntity(page.uuid, inSidebar);
  return openPageNamed(name, inSidebar);
}
const hidePeekSoon = () => { clearTimeout(peek.hide); peek.hide = setTimeout(hidePeek, 200); };
function hidePeek() { clearTimeout(peek.timer); clearTimeout(peek.hide); peek.card?.close(); peek.card = null; peek.anchor = null; }
async function showPeek(link) {
  const { group, item } = findItem(link.dataset.uuid, link.closest('.rf-tw-row'));
  if (!item) return;
  const data = await peekData(item.uuid, group.name);
  if (!link.isConnected || !link.matches(':hover')) return;
  const doc = link.ownerDocument;
  hidePeek();
  // The record's own day is in the line above already.
  const fields = data.rows.filter(row => !item.day || row.values.map(v => v.text).join(', ') !== dayText(item.day));
  const card = peek.card = shared.card({ doc, at: link, title: item.title, tag: item.tag && item.tag !== 'note' ? item.tag : '', day: item.day ? dayText(item.day) : '',
    fields: fields.map(row => ({ name: row.name, uuid: row.uuid, values: row.values })),
    lines: data.lines.map(line => ({ uuid: line.uuid, html: lineHtml(line.text) })),
    empty: fields.length || data.lines.length ? '' : 'Nothing else written on it yet.',
    open: (what, value, event) => {
      // The innermost piece that names something: a link in a line before the line it is in.
      const page = event?.target?.closest?.('[data-open-page]')?.dataset.openPage;
      hidePeek();
      if (page) return openPage(page, event.shiftKey);
      if (what === 'tag') return openPage(value, event.shiftKey);
      if (what === 'prop') return value?.uuid ? openEntity(value.uuid, event.shiftKey) : openEntity(item.uuid, event.shiftKey);
      if (what === 'value' || what === 'line') return openEntity(value?.uuid || item.uuid, event.shiftKey);
      return openEntity(item.uuid, event.shiftKey);
    } });
  card.el.classList.add('refinement-two-way-peek');
  card.el.addEventListener('mouseenter', () => clearTimeout(peek.hide));
  card.el.addEventListener('mouseleave', hidePeekSoon);
  peek.anchor = link;
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
/* The keys end in 2 since 0.4.333: the rooms remembered before were measured while proposals still brought hidden
   property rows up and down, and a room remembered too large is let go at settle as a slide up (measured on Marcus
   Bell: 168 px, two seconds after the page). The old ones are dropped. */
const SETTLE_MS = 2000, HEIGHTS_KEY = 'refinementTwoWayRoom2', OLD_KEYS = ['refinementTwoWayRoom', 'refinementTwoWayLeast'];
/* A first visit (0.4.333, measured with the tour): the rows came under the title some 50 ms before Logseq's own property
   list, which then pushed them down (Dr. Raj Patel: 109 px). Now, on a page with no room remembered, they wait unseen in
   their place until that list is there, at most WAIT_MS, and no room is held for them: the least room of any page seen,
   held since 0.4.283, could be more than this page takes, and was let go at settle as a slide up (Marcus Bell: 56 px). */
const WAIT_MS = 600;
const settle = { since: 0, page: '', leaving: '', saved: false, timer: 0, ease: 0, wait: 0 };
let heights = new Map();
const readHeights = () => { try { const storage = host().defaultView.localStorage; for (const key of OLD_KEYS) storage.removeItem(key); heights = new Map(Object.entries(JSON.parse(storage.getItem(HEIGHTS_KEY) || '{}'))); } catch { heights = new Map(); } };
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
  // Settled: the room still held, if any, eases away over a moment instead of snapping (0.4.283); then the room
  // is kept for next time, so the next visit holds the right amount from the start.
  if (mode === 'save') { settle.saved = true; if (room >= 0) remember(page, room); if (held) easeHold(box); else setHold(box, 0); return; }
  setHold(box, heights.has(page) ? Math.max(0, Math.round(heights.get(page) - room)) : 0);
}
const setHold = (box, px) => { if (px) box.style.setProperty('--rf-tw-hold', px + 'px'); else if (box.style.length) box.removeAttribute('style'); };
function easeHold(box) {
  box.setAttribute('data-rf-settling', '');
  box.style.setProperty('--rf-tw-hold', '0px');
  clearTimeout(settle.ease);
  settle.ease = setTimeout(() => { box.removeAttribute('data-rf-settling'); if (box.style.getPropertyValue('--rf-tw-hold') === '0px') setHold(box, 0); }, 300);
}
function onRoute() {
  hidePeek(); closeAdd(); state.draft = null; state.picked.clear(); state.lastPick = ''; state.opened.clear(); state.nodeDraft = null;
  // The page being left, which may still be on screen for a moment and must not take the new page's place.
  settle.leaving = settle.page || shownPage(host());
  Object.assign(settle, { since: performance.now(), page: '', saved: false });
  clearTimeout(settle.timer); clearTimeout(settle.ease); clearTimeout(settle.wait);
  // Once settled: no more room held, and the room is kept for next time.
  settle.timer = setTimeout(() => draw(host()), SETTLE_MS + 50);
  settle.wait = setTimeout(() => draw(host()), WAIT_MS + 20);
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
  if (state.html !== html) {
    const active = box.contains(box.ownerDocument.activeElement) ? box.ownerDocument.activeElement : null;
    const typing = active?.matches('.rf-tw-draft-name'), typingNode = active?.matches('.rf-tw-node-field') ? active.dataset.uuid : '';
    state.html = html; box.innerHTML = html; keepDraft(box); keepNodeField(box);
    if (typing) focusDraft();
    if (typingNode) focusNodeField(typingNode);
  }
  box.toggleAttribute('data-picking', state.picked.size > 0);
  if (anchor.nextElementSibling !== box) anchor.after(box);
  holdRoom(doc, box, mode, page);
  box.toggleAttribute('data-rf-waiting', mode === 'hold' && !heights.has(page) && !anchor.matches('.ls-page-properties') && performance.now() - settle.since < WAIT_MS);
  if (!rows && mode === 'save') box.remove();
}
// Before the screen is drawn (0.4.182), so the rows come in the same frame as the property list they sit under. Only
// when elements came or went, or while a page settles.
const drawEarly = (doc, records) => { if (performance.now() - settle.since < SETTLE_MS || addsElements(records)) draw(doc); };
function onClick(event) {
  const pickEl = event.target.closest?.('.rf-tw-bar [data-act]') || event.target.closest?.('.rf-tw-row .rf-tw-pick');
  if (pickEl) { event.preventDefault(); event.stopPropagation(); hidePeek(); return pickEl.dataset.act ? act(pickEl.dataset.act, pickEl) : togglePick(pickEl, event.shiftKey); }
  const inNode = event.target.closest?.('.rf-tw-node');
  if (inNode && onNodeClick(event, inNode)) return;
  const into = event.target.closest?.('.rf-tw-into');
  if (into) { event.preventDefault(); event.stopPropagation(); hidePeek(); return toggleInto(into.dataset.uuid); }
  const groupBy = event.target.closest?.('.rf-tw-groupby');
  if (groupBy) {
    event.preventDefault(); event.stopPropagation();
    const group = state.groups.find(g => g.name === groupBy.dataset.field);
    if (group) groupMenu(group, groupBy).catch(error => warnOnce('could not open the group menu', error));
    return;
  }
  const groupAdd = event.target.closest?.('.rf-tw-gadd');
  if (groupAdd) { event.preventDefault(); event.stopPropagation(); hidePeek(); const group = state.groups.find(g => g.name === groupAdd.dataset.field); if (group) startGroupDraft(group, groupAdd.dataset.gkey); return; }
  // A click that just misses the box, anywhere in the room left of the record, ticks it too (0.4.297, the owner: "make
  // checkbox tap area bigger"): before, it opened the record and took you off the page.
  const rowEl = !event.target.closest?.('a, button') && event.target.closest?.('.rf-tw-line, .rf-tw-item');
  const first = rowEl && rowEl.querySelector(':scope > :not(.rf-tw-pick):not(.rf-tw-into)');
  const box = rowEl && rowEl.querySelector(':scope > .rf-tw-pick');
  if (box && first && event.clientX < first.getBoundingClientRect().left) { event.preventDefault(); event.stopPropagation(); hidePeek(); return togglePick(box, event.shiftKey); }
  const plus = event.target.closest?.('.rf-tw-add');
  if (plus) { event.preventDefault(); event.stopPropagation(); hidePeek(); const group = state.groups.find(g => g.name === plus.dataset.field); if (group) { closeAdd(); draftFor(group); draw(host()); focusDraft(); } return; }
  const lineEl = event.target.closest?.('.rf-tw-draft');
  if (lineEl && !event.target.closest('a, input, button')) { lineEl.querySelector('.rf-tw-draft-field')?.focus(); return; }
  const target = event.target.closest?.('a, button');
  const line = !target && event.target.closest?.('.rf-tw-line, .rf-tw-item');
  if (!target && !line) return;
  event.preventDefault(); event.stopPropagation();
  hidePeek();
  if (line) return openEntity(line.dataset.uuid, event.shiftKey);
  if (target.matches('.rf-tw-record, .rf-tw-field')) return openEntity(target.dataset.uuid, event.shiftKey);
  if (target.matches('.rf-tw-side')) return openEntity(target.dataset.uuid, true);
  if (target.matches('.rf-tw-tag[data-tag-page]')) return openPage(target.dataset.tagPage, event.shiftKey);
  if (target.matches('[data-draft="tag"]')) return tagList(target);
  const key = target.dataset.key;
  if (target.matches('.rf-tw-gtoggle')) setOpen(target.dataset.gkey, !isOpen(target.dataset.gkey));
  else if (target.matches('.rf-tw-toggle, .rf-tw-fold')) setOpen(key, !isOpen(key));
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
/* Since 0.4.304 the right-click opens a short menu under the name, the kit's pop-up: Date first, Name first (the one
   in use ticked), then Rename how it reads…, which opens the question under the name. */
function onRename(event) {
  const nameEl = event.target.closest?.('.rf-tw-name');
  const group = nameEl && state.groups.find(g => g.name === nameEl.closest('.rf-tw-row')?.dataset.field);
  if (!group) return;
  event.preventDefault(); event.stopPropagation(); hidePeek(); closeAdd();
  const now = orderOf(group);
  const pick = order => { setOrder(group.name, order); state.html = null; draw(host()); };
  adding.pop = shared.popup({ at: nameEl.querySelector('.rf-tw-field') || nameEl, head: group.label, width: 220, onClose: () => { adding.pop = null; }, items: [
    { label: 'Date first', chosen: now === 'date', run: () => pick('date') },
    { label: 'Name first', chosen: now === 'name', run: () => pick('name') },
    ...(group.items.length > INLINE ? [{ icon: 'order', label: 'Group by…', run: () => { groupMenu(group, nameEl.querySelector('.rf-tw-field') || nameEl).catch(error => warnOnce('could not open the group menu', error)); } }] : []),
    { sep: true },
    { icon: 'rename', label: 'Rename how it reads…', run: () => { renameRow(group, nameEl).catch(error => warnOnce('could not rename the row', error)); } },
  ] });
}
async function renameRow(group, nameEl) {
  const before = backwardsLabel(group.name);
  const typed = await shared.ask({ at: nameEl, question: `How “${group.name}” reads on the page it points to`, note: `Empty: back to “${plainBackwards(group.name).toLowerCase()}”. Changes it on every page.`, go: 'Save', field: { value: before, placeholder: 'How it reads here' } });
  if (typed == null || typed.trim() === before) return;
  setBackwards(group.name, typed.trim());
  offerUndo(typed.trim() ? `“${group.name}” now reads “${typed.trim()}” here` : `“${group.name}” reads as it does by itself again`, () => setBackwards(group.name, before), group.name);
}

/* Adding from the far end (0.4.185, the owner's pick of "Add only"): the + at the end of a row opens a small box,
   "New record · doctor: Dr. Mei Chen", with the kinds the row already holds (the most common chosen) and a name.
   Enter (or Add) makes the record with that name and tag and the field pointing at this page: a page of its own when
   most records in the row are pages (people, places), else a block on today's journal (visits, tests). Add and open
   also opens it in the sidebar to fill in. The bar at the bottom offers Undo, which removes what was made.
   Nothing is unlinked from here: a link is changed on the record that holds it. */
/* Adding a node from the page (0.4.303, the owner: "a line under each section that once upon hover a plus appears you
   can start typing. you hit enter, another logseq input appears about where if it is a node. otherwise it is just a
   page"). Under each row a quiet line; with the pointer on the row a + shows at its left and the words "Add a …".
   Typing there is the new node's name. Enter: where most of the linked nodes are pages, the page is made at once;
   otherwise a second field takes its place on the line, asking where it goes, with today's journal, this page and the
   pages matching what is typed as rows under it (the kit's pop-up); Enter takes the lit one. The tag it gets sits
   at the line's right in the tags' column, a click lists the others. Escape steps back, then drops it. The faded
   arrow by the row's name takes a made node away. */
const adding = { pop: null };
function closeAdd() { adding.pop?.close(); adding.pop = null; }
const pageTitleNow = () => named.uuid === state.pageUuid && named.title ? named.title : 'this page';
function kindsOf(group) {
  const counts = new Map();
  for (const item of group.items) if (item.tag !== 'note') counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}
function draftFor(group) {
  if (state.draft?.field === group.name) return state.draft;
  const kinds = kindsOf(group);
  state.draft = { field: group.name, kinds, kind: kinds[0] || '', step: 'name', name: '', where: '', asPage: null, lit: 0, gkey: '', set: null };
  readTitle().catch(() => {});
  provided.pagesAmong(group.items.map(item => item.uuid), uuidsIn).then(pages => { if (state.draft?.field === group.name) state.draft.asPage = pages * 2 > group.items.length; }).catch(() => {});
  return state.draft;
}
function addLineHtml(group) {
  if (!group.ident) return '';
  const d = state.draft?.field === group.name ? state.draft : null;
  // The + in the gap under the row (0.4.303, the owner: "you can just have a plus in the gap that then open input"):
  // shown with the pointer on the row, it takes no room; the line comes only once it is clicked. A line begun from a
  // group's + is drawn in that group (0.4.369).
  if (!d || d.gkey) return '';
  return draftLineHtml(group, d);
}
function draftLineHtml(group, d) {
  const kind = d ? d.kind : kindsOf(group)[0] || '';
  const tag = `<a class="rf-tag rf-tw-tag rf-tw-draft-tag" href="#" data-draft="tag" title="The tag it gets (click for the others)">${kind ? esc(kind) : 'no tag'}</a>`;
  const field = d?.step === 'where'
    ? `<span class="rf-tw-draft-typed">${esc(d.name)}</span><span class="rf-field rf-field-inline"><input type="text" class="rf-tw-draft-field rf-tw-draft-where" placeholder="Where? Enter: today’s journal" spellcheck="false" aria-label="Where the new node goes"></span>`
    : `<span class="rf-field rf-field-inline"><input type="text" class="rf-tw-draft-field rf-tw-draft-name" placeholder="Add a${/^[aeiou]/i.test(kind) ? 'n' : ''} ${esc(kind || 'node')}" spellcheck="false" aria-label="Name of a new node"></span>`;
  return `<div class="rf-tw-draft rf-tw-drafting" data-field="${esc(group.name)}"><span class="rf-tw-draft-plus rf-faint" aria-hidden="true">+</span><span class="rf-tw-draft-main">${field}</span>${tag}</div>`;
}
// The line is drawn again with the rows; what was typed and the caret come back with it.
function keepDraft(box) {
  for (const field of box.querySelectorAll('.rf-tw-draft-field')) {
    const line = field.closest('.rf-tw-draft'), group = state.groups.find(g => g.name === line.dataset.field);
    const d = state.draft?.field === line.dataset.field ? state.draft : null;
    if (d) field.value = field.matches('.rf-tw-draft-where') ? d.where : d.name;
    field.addEventListener('focus', () => { if (group && state.draft?.field !== group.name) { closeAdd(); draftFor(group); draw(host()); focusDraft(); } else if (field.matches('.rf-tw-draft-where')) whereList(field); });
    field.addEventListener('input', () => {
      const now = state.draft?.field === line.dataset.field ? state.draft : group && draftFor(group);
      if (!now) return;
      if (field.matches('.rf-tw-draft-where')) { now.where = field.value; now.lit = 0; whereList(field); } else now.name = field.value;
    });
    field.addEventListener('keydown', onDraftKey);
    for (const type of ['keyup', 'keypress']) field.addEventListener(type, event => event.stopPropagation());
  }
}
function focusDraft() {
  const d = state.draft;
  const field = d && state.box?.querySelector(`.rf-tw-draft[data-field="${CSS.escape(d.field)}"] .rf-tw-draft-field`);
  if (field) { field.focus({ preventScroll: true }); field.setSelectionRange(field.value.length, field.value.length); }
}
function dropDraft() { state.draft = null; closeAdd(); draw(host()); }
function onDraftKey(event) {
  event.stopPropagation();
  if (event.isComposing) return;
  const d = state.draft, onWhere = event.target.matches('.rf-tw-draft-where');
  if (event.key === 'Escape') {
    event.preventDefault();
    if (onWhere) { d.step = 'name'; d.where = ''; closeAdd(); draw(host()); focusDraft(); }
    else { dropDraft(); event.target.blur?.(); }
  } else if (onWhere && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault();
    const rows = adding.pop?.body.querySelectorAll('.rf-item').length || 0;
    if (rows) { d.lit = (d.lit + (event.key === 'ArrowDown' ? 1 : rows - 1)) % rows; adding.pop.lit(d.lit); }
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (!d?.name.trim()) return;
    if (onWhere) { const lit = adding.pop?.body.querySelectorAll('.rf-item')[d.lit]; return makeDraft(lit?.item?.act || 'journal', event.metaKey || event.ctrlKey); }
    // From a group's +: no question where, today's journal (a page of its own where the nodes are pages).
    if (d.gkey) return makeDraft(d.asPage ? 'page-itself' : 'journal', event.metaKey || event.ctrlKey);
    if (d.asPage) return makeDraft('page-itself', event.metaKey || event.ctrlKey);
    d.step = 'where'; d.lit = 0;
    draw(host()); focusDraft();
  }
}
// The rows under the where field: today's journal, this page, then the pages that match what is typed.
let pagesRead = null;
async function whereList(field) {
  const d = state.draft;
  if (!d || d.step !== 'where' || !field.isConnected) return;
  pagesRead ||= await provided.propPages().catch(() => []);
  if (state.draft !== d || !field.isConnected) return;
  const q = d.where.trim().toLowerCase();
  const rows = [['journal', 'Today’s journal', 'date'], ['here', pageTitleNow(), 'page']].filter(([, text]) => !q || text.toLowerCase().includes(q));
  if (q) for (const p of pagesRead.filter(p => p.lower.includes(q) && p.uuid !== state.pageUuid).sort((a, b) => (b.lower.startsWith(q) - a.lower.startsWith(q)) || a.lower.length - b.lower.length).slice(0, 6)) rows.push(['page:' + p.title, p.title, 'page']);
  d.lit = Math.min(d.lit, Math.max(0, rows.length - 1));
  const items = rows.length ? rows.map(([act, text, name]) => ({ icon: name, label: text, act, run: item => makeDraft(item.act, false) })) : [{ note: 'No page by that name' }];
  if (!adding.pop || adding.pop.isClosed) adding.pop = shared.popup({ at: field.closest('.rf-field') || field, manual: true, cls: 'refinement-two-way-add', width: 260, items, onClose: () => { adding.pop = null; } });
  else adding.pop.items(items);
  if (rows.length) adding.pop.lit(d.lit);
}
async function makeDraft(target, open) {
  const d = state.draft, group = d && state.groups.find(g => g.name === d.field);
  if (!group) return dropDraft();
  const name = d.name.trim();
  if (!name) return focusDraft();
  const page = await model.getPage(state.pageUuid).catch(() => null);
  if (!page?.id) return notify('This page could not be read, so nothing was added', 'warning');
  const asPage = target === 'page-itself';
  const where = asPage || target === 'journal' ? 'journal' : target === 'here' ? 'here' : 'page';
  const other = where === 'page' ? target.slice(5) : '';
  dropDraft();
  try { await addRecord({ group, page, name, kind: d.kind, open, asPage, where, other, set: d.set }); }
  catch (error) { warnOnce('could not add the new record', error); notify('The new record could not be added', 'warning'); }
}
// The other tags, under the tag at the line's right: the kit's pop-up, the one in force ticked.
function tagList(anchor) {
  const line = anchor.closest('.rf-tw-draft'), group = state.groups.find(g => g.name === line?.dataset.field);
  if (!group) return;
  closeAdd();
  const d = draftFor(group);
  draw(host());
  const at = state.box?.querySelector(`.rf-tw-draft[data-field="${CSS.escape(d.field)}"] .rf-tw-draft-tag`) || anchor;
  adding.pop = shared.popup({ at, cls: 'refinement-two-way-add', width: 200, onClose: () => { adding.pop = null; },
    items: [...d.kinds, ''].map(k => ({ icon: k ? 'tag' : null, label: k || 'no tag', faint: !k, chosen: k === d.kind, run: () => { d.kind = k; draw(host()); focusDraft(); } })) });
}
async function addRecord({ group, page, name, kind, open, asPage, where = 'journal', other = '', edit = false, set = null }) {
  if (asPage && await model.getPage(name).catch(() => null)) return notify(`A page named “${name}” already exists, so nothing was added`, 'warning');
  const prop = (await provided.propSchema()).props.find(p => p.ident === group.ident);
  let tagUuid = '';
  if (kind) {
    tagUuid = await provided.tagUuidNamed(kind);
  }
  let block, undo;
  if (asPage) {
    block = await model.createPage(name, {}, { redirect: false, createFirstBlock: false });
    if (!block?.uuid) throw new Error('the page was not made');
    // By name, as Properties in the line does: Logseq 2.0.2 left the page in place when asked by its uuid here.
    undo = async () => { await model.deletePage(name); later(300); };
    // A page made now is not in the look-up of every page: it has no rows of its own yet.
    state.byPage.set(String(block.uuid), []);
  } else {
    // Where it goes (0.4.298): today's journal, this page, or another page named in the box (an existing one only).
    let target = '';
    if (where === 'here') target = String(page.uuid);
    else if (where === 'page') {
      const found = (await provided.propPages()).find(p => p.lower === other.toLowerCase()) || await model.getPage(other).catch(() => null);
      if (!found?.uuid) return notify(`There is no page named “${other}”, so nothing was added`, 'warning');
      target = String(found.uuid);
    } else {
      const now = new Date();
      const journalId = await provided.journalIdFor(todayNumber(), await provided.journalTitleFor(now.getFullYear(), now.getMonth() + 1, now.getDate()));
      target = journalId ? String(await provided.uuidById(journalId)) : '';
      if (!target) throw new Error('no journal page for today');
    }
    block = await model.appendBlock(target, name);
    if (!block?.uuid) throw new Error('the block was not made');
    undo = async () => { await model.removeBlock(block.uuid); later(300); };
  }
  try {
    if (tagUuid) await model.addTag(block.uuid, tagUuid);
    if (prop?.many) await model.setValue(block.uuid, group.ident, [page.id], { entityId: true, reset: true });
    else await model.setValue(block.uuid, group.ident, page.id, { entityId: true });
    if (set?.ident) await setGroupValue(block.uuid, set);
  } catch (error) { await undo().catch(() => {}); throw error; }
  later(300);
  offerUndo(`Added “${name}”${kind ? ` (${kind})` : ''}${asPage ? ' as a page' : where === 'here' ? ' to this page' : where === 'page' ? ` to ${other}` : ' to today’s journal'}`, undo, group.name);
  if (open) openEntity(block.uuid, true);
  // Into its words at once (0.4.302): the sidebar draws it a moment after it opens.
  if (edit && !asPage) { const uuid = block.uuid; window.refinementCore.screen.waitFor(() => host().querySelector(`#right-sidebar .ls-block[blockid="${uuid}"]`), 3000).then(found => found && model.editBlock(uuid, { pos: 0 })).catch(error => warnOnce('the new record could not be put in edit', error)); }
}

/* Picking records and acting on them together (0.4.228, the owner's ask: "selected in groups and be acted on", like
   Logseq's own tables). A tick box before each record, shown under the pointer and on every record while any is
   ticked; Shift-click ticks every record from the last one ticked. A pick is a record under one field ("uuid|field"),
   since a record can point here through two fields. The bar above the rows, the kit's: how many are picked with its
   tick box, then open in the sidebar, point to another page, take the link off (these two through the picked
   record's own field), add a tag, copy, set a property, clear a property, delete, as quiet words with their icons,
   and Clear. Every change but delete has Undo (the faded arrow); delete asks first. Escape or the bar's box clears
   the picks; going to another page does too. */
/* The bar's room is always kept above the rows, the bar shown in it only while something is picked (0.4.325, the owner:
   "the toolbar jumps in and causes the link table to jump down … that space is fine. allows breathing room"). */
function barHtml() {
  const idle = !state.picked.size;
  const total = allKeys().length, n = state.picked.size;
  /* One line (0.4.327, the owner: "why are two lines needed? the clear button can be consolidated. some of the menu items
     like change and remove can go under one menu item and so can property. the sidebar items should be on far right";
     "have select all button"): the count's tick box clears, Select all picks every node listed here, the page's own two
     actions and the two property actions each under one word with a menu, Sidebar last at the right. */
  const b = (act, text, title, name, cls = '') => `<button type="button" class="rf-quiet${cls ? ' ' + cls : ''}" data-act="${act}" title="${esc(title)}">${name ? iconHtml(name) : ''}${text}</button>`;
  const menu = (act, text, title, name) => `<button type="button" class="rf-quiet rf-tw-menu" data-act="${act}" title="${esc(title)}" aria-haspopup="menu">${name ? iconHtml(name) : ''}<span class="rf-tw-menu-words">${text}</span>${iconHtml('chevron-down')}</button>`;
  return `<div class="rf-bar rf-tw-bar"${idle ? ' data-idle="" aria-hidden="true"' : ''}><label class="rf-count"><input type="checkbox" class="rf-check" checked data-act="clear" title="Clear the picks (Escape)" aria-label="Clear the picks">${n} picked</label>${
    n < total ? b('all', 'Select all', `Pick all ${total} listed here`, '') : ''}${
    menu('page-menu', `“${esc(pageTitle())}”`, `Change “${pageTitle()}” to another page in their field, or take it out`, '')}${
    b('tag', 'Tag', 'Add a tag', 'tag')}${b('copy', 'Copy', 'Copy them as references', 'copy')}${
    menu('prop-menu', 'Property', 'Give them all one value, or clear one', 'property')}${b('delete', '', 'Delete them', 'delete')}${
    b('sidebar', 'Sidebar', 'Open them in the right sidebar', 'sidebar', 'rf-tw-to-side')}</div>`;
}
// Every node listed here, as picks are kept: "uuid|property".
const allKeys = () => state.groups.flatMap(g => g.items.map(item => `${item.uuid}|${g.name}`));
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
/* A question with a list to choose from (the kit's list pop-up in place of the browser's drop-down, 0.4.318): the
   options that fit what is typed, Enter takes the lit one, or what was typed when nothing fits (or allowEmpty).
   Resolves with the words, or null. It opens right under the word or name that asked (0.4.287, the audit). */
const ask = (heading, hint, options, button = 'OK', value = '', allowEmpty = false, at = null) => new Promise(resolve => {
  let answer = null;
  const doc = host();
  const fits = q => { const lower = q.trim().toLowerCase(); return (lower ? options.filter(o => o.toLowerCase().includes(lower)).sort((a, b) => (b.toLowerCase().startsWith(lower) - a.toLowerCase().startsWith(lower)) || a.length - b.length) : options).slice(0, 8); };
  const pop = shared.popup({ doc, at, head: heading, width: 300, field: { value, placeholder: button, keys: event => {
    if (event.key !== 'Enter' || event.isComposing) return false;
    const lit = pop.body.querySelectorAll('.rf-item')[pop.litAt];
    if (lit?.item?.label != null && lit.item.pick) { answer = lit.item.label; pop.close(); return true; }
    const typed = pop.query.trim();
    if (typed || allowEmpty) { answer = typed; pop.close(); }
    return true;
  } }, rows: q => [...(hint ? [{ note: hint }] : []), ...fits(q).map(o => ({ label: o, pick: true, run: () => { answer = o; pop.close(); } }))], onClose: () => resolve(answer) });
});
const sure = (heading, button, at = null) => shared.ask({ at, question: heading, go: button });
// What a node holds under a property, as ids, so it can be put back exactly (the tag tree's way, parts/tags.js).
async function setValues(uuid, prop, values) {
  if (!values.length) return model.unsetValue(uuid, prop.ident);
  return model.setValue(uuid, prop.ident, prop.many ? values : values[0], { entityId: true, reset: true });
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
  if (what === 'all') { for (const key of allKeys()) state.picked.add(key); readTitle().catch(() => {}); return draw(host()); }
  if (!chosen.length) return;
  // The two words with a menu (0.4.327): the menu opens under the word, and what is picked from it acts as its own word did.
  if (what === 'page-menu' || what === 'prop-menu') {
    const items = what === 'page-menu'
      ? [{ icon: 'to', label: `Change “${pageTitle()}” to…`, run: () => { act('point', at); } }, { icon: 'remove', label: `Remove “${pageTitle()}”`, run: () => { act('unlink', at); } }]
      : [{ icon: 'property', label: 'Set property…', run: () => { act('set', at); } }, { icon: 'remove', label: 'Unset property…', run: () => { act('unset', at); } }];
    shared.popup({ at, width: 240, items });
    return;
  }
  if (what === 'sidebar') { for (const uuid of nodes) openEntity(uuid, true); state.picked.clear(); return draw(host()); }
  try {
    if (what === 'copy') {
      const lines = await Promise.all(nodes.map(async uuid => { const page = await model.getPage(uuid).catch(() => null); return page?.name ? `[[${page.title || page.originalName || page.name}]]` : `((${uuid}))`; }));
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
      return writeAll(`Tagged ${counted(nodes.length)} ${name.replace(/^#/, '')}`, nodes.map(uuid => async () => {
        if (await provided.hasTag(uuid, tagUuid)) return null;
        await model.addTag(uuid, tagUuid);
        return () => model.removeTag(uuid, tagUuid);
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
        if (what === 'unset') { if (!had.length) return null; await model.unsetValue(uuid, prop.ident); }
        else if (entity) await setValues(uuid, prop, prop.many ? [...new Set([...had, value])] : [value]);
        else await model.setValue(uuid, prop.ident, value);
        return () => setValues(uuid, prop, had);
      }));
    }
    if (what === 'delete') {
      const one = nodes.length === 1 ? `“${titleFor(nodes[0])}”` : counted(nodes.length);
      if (!await sure(`Delete ${one}? This cannot be undone from here.`, 'Delete', at)) return;
      return writeAll('', nodes.map(uuid => async () => {
        const page = await model.getPage(uuid).catch(() => null);
        if (page?.name) await model.deletePage(page.name); else await model.removeBlock(uuid);
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
   after their bullet, 28px rows; the name starts where theirs does, after the room of their property icon (15px and a 4px gap), and the → follows it.
   Only the rows' own layout is here (0.4.318): the tag, the tick box, the bar, the filter words, the icons, the
   buttons, the field, the card and the pop-ups are the kit's. */
.refinement-two-way {
  margin: calc(.15rem + var(--rf-tw-hold, 0px)) 0 .5rem; padding: 0;
  line-height: 1.5; user-select: text;
  /* One name column for every row (0.4.377, the owner: "alignment of second column"): each row is a subgrid of the box,
     so the longest name sets where every row's values start, as in Logseq's own property list. */
  display: grid; grid-template-columns: minmax(150px, max-content) minmax(0, 1fr); column-gap: 12px;
}
.refinement-two-way > * { grid-column: 1 / -1; }
/* Waiting unseen in its place for Logseq's property list on a first visit (0.4.333). */
.refinement-two-way[data-rf-waiting] { visibility: hidden; }
/* Only holding room while the page settles: no field, no rows. */
.refinement-two-way:not(:has(.rf-tw-row)) { margin: var(--rf-tw-hold, 0px) 0 0; }
/* The room held while the page settled eases away (0.4.283), only then: while the page settles the held room shrinks in the same frame Logseq's list grows, and must not lag. */
.refinement-two-way[data-rf-settling] { transition: margin-top .25s ease; }
.refinement-two-way .rf-tw-row { display: grid; grid-template-columns: subgrid; column-gap: 12px; padding: 2px 0; }
.refinement-two-way .rf-tw-name { color: var(--rf-faint); font-size: var(--rf-name, .94em); white-space: nowrap; cursor: default; padding-left: 19px; position: relative; }
.refinement-two-way .rf-tw-arrow { display: inline-flex; margin-left: .35em; vertical-align: -2px; }
.refinement-two-way .rf-tw-value { min-width: 0; padding-left: 22px; display: flex; flex-wrap: wrap; column-gap: 1.1em; row-gap: 4px; position: relative; }
.refinement-two-way a { color: inherit; text-decoration: none; cursor: pointer; }
.refinement-two-way .rf-tw-line a.rf-tw-record { justify-self: start; }
/* The underline under the words, on every line of a name that wraps (0.4.377, the owner: "you can underline the words of a whole
   sentence not just the bottom part of wrapped line"). */
.refinement-two-way a.rf-tw-record { text-decoration: underline; text-decoration-color: var(--rf-line); text-decoration-thickness: 1px; text-underline-offset: 4px; }
.refinement-two-way a.rf-tw-record:hover { text-decoration-color: currentColor; }
/* In an open list the name keeps the pixel the old underline (a border) took, so the lines stay where they were. */
.refinement-two-way .rf-tw-line a.rf-tw-record { padding-bottom: 1px; }
/* A little more room between records (0.4.230, the owner: "just increase line spacing of items", in place of taking the line away). */
.refinement-two-way .rf-tw-line { padding-top: 2px; padding-bottom: 2px; }
.refinement-two-way .rf-tw-day { margin-left: .45em; }
.refinement-two-way .rf-tw-tag { margin-left: .5em; }
.refinement-two-way .rf-tw-toggle:hover { color: inherit; }
.refinement-two-way .rf-tw-fold { position: absolute; left: 3px; top: .75em; width: 16px; height: 16px; margin-top: -8px; padding: 0; justify-content: center; }
.refinement-two-way .rf-tw-fold .ti { transition: transform .16s ease; }
.refinement-two-way .rf-tw-row[data-open] .rf-tw-fold .ti { transform: rotate(90deg); }
/* The list a count opens into: date, record, tag, one per line, under the value. */
/* The line drops from under the fold arrow (centred 11px in, 0.4.196), as Logseq's own guide lines drop from theirs; the words stay where they were. */
.refinement-two-way .rf-tw-list { grid-column: 2; margin: .1rem 0 .25rem 10.5px; border-left: 1px solid var(--rf-line); padding-left: calc(.6rem + 11.5px); }
.refinement-two-way .rf-tw-line { display: grid; grid-template-columns: 3.6em minmax(0, max-content) auto 1fr 1.4em; column-gap: .5em; align-items: baseline; margin: 0 -.35rem; padding: 0 .35rem; }
.refinement-two-way .rf-tw-line .rf-tw-day { margin-left: 0; }
.refinement-two-way .rf-tw-more { display: inline-flex; margin-top: .1rem; height: 22px; padding: 0 4px; }
/* Moving around (0.4.184): a record's line lit under the pointer, the sidebar icon shown there, the field's name
   and the kinds as quiet words, the kinds row above an open list, "earlier" before what is past. */
.refinement-two-way .rf-tw-line, .refinement-two-way .rf-tw-item { cursor: pointer; border-radius: 4px; position: relative; }
.refinement-two-way .rf-tw-item { margin: 0 -.3rem; padding: 0 .3rem; }
.refinement-two-way .rf-tw-line:hover, .refinement-two-way .rf-tw-item:hover { background: var(--rf-wash); }
.refinement-two-way .rf-tw-side { visibility: hidden; height: 20px; padding: 0 3px; }
.refinement-two-way :is(.rf-tw-line, .rf-tw-item):hover .rf-tw-side { visibility: visible; }
/* The field's name and the count that opens a list get the same soft patch under the pointer (0.4.185), drawn in the
   padding a negative margin gives back, so nothing moves. */
.refinement-two-way :is(.rf-tw-field, .rf-tw-toggle) { border-radius: 4px; padding: 0 .25em; margin-left: -.25em; margin-right: -.25em; transition: background-color .1s ease, color .1s ease; }
.refinement-two-way :is(.rf-tw-field, .rf-tw-toggle):hover { color: inherit; background: var(--rf-wash); }
.refinement-two-way a.rf-tw-field { color: inherit; }
.refinement-two-way .rf-tw-chips { display: flex; flex-wrap: wrap; gap: .3rem .9rem; margin: .1rem 0 .3rem; }
.refinement-two-way .rf-tw-earlier { display: flex; align-items: center; gap: .5em; margin: .2rem 0 .1rem; padding: 0; }
.refinement-two-way .rf-tw-earlier::after { content: ''; flex: 1; border-top: 1px solid var(--rf-hair); }
/* The line for adding a node (0.4.303): under the row's values, in the value column; a + at its left, the kit's
   field inline, the tag right after it. */
/* A node's tag sits right after its name, and the sidebar icon after the tag (0.4.320, the owner: "move tags for two-way
   link next to item, not right aligned"); the last column takes the rest of the row. */
.refinement-two-way .rf-tw-draft { grid-column: 2; position: relative; display: grid; grid-template-columns: minmax(8em, 22em) auto 1.4em 1fr; column-gap: .5em; align-items: baseline; margin: 0 -.35rem; padding: 0 .35rem 0 calc(22px + .35rem); cursor: text; }
.refinement-two-way .rf-tw-row { position: relative; }
.refinement-two-way .rf-tw-add { margin-left: .6em; height: 20px; padding: 0 5px; }
.refinement-two-way .rf-tw-row:hover .rf-tw-add { color: inherit; }
.refinement-two-way .rf-tw-item .rf-tw-add { margin-left: .5em; }
/* Date first in a short row, name first in a list (0.4.304): the same columns as the other kind, the other way round. */
.refinement-two-way .rf-tw-item.rf-tw-datefirst > .rf-tw-day { margin-left: 0; margin-right: .5em; }
.refinement-two-way .rf-tw-line.rf-tw-namefirst { grid-template-columns: minmax(0, max-content) max-content auto 1fr 1.4em; }
.refinement-two-way .rf-tw-draft-plus { position: absolute; left: calc(.35rem + 3px); width: 16px; text-align: center; }
.refinement-two-way .rf-tw-draft-main { display: flex; align-items: baseline; gap: .5em; min-width: 0; }
.refinement-two-way .rf-tw-draft-main .rf-field { flex: 1; min-width: 0; }
.refinement-two-way .rf-tw-draft-typed { flex: none; max-width: 50%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.refinement-two-way .rf-tw-draft .rf-tw-draft-tag { margin-left: 0; white-space: nowrap; }
/* Group a row by anything (0.4.369): the word after the count, a group's name with its count and its +, the lines
   under it. Write into a node (0.4.369): the small arrow before a node, its bullets under its line. */
.refinement-two-way .rf-tw-groupby { margin-left: .6em; height: 20px; padding: 0 5px; gap: 2px; visibility: hidden; }
.refinement-two-way .rf-tw-row:hover .rf-tw-groupby, .refinement-two-way .rf-tw-groupby[data-on], .refinement-two-way .rf-tw-groupby:focus-visible { visibility: visible; }
.refinement-two-way .rf-tw-groupby .ti { font-size: 12px; }
.refinement-two-way .rf-tw-ghead { display: flex; align-items: baseline; gap: .3em; margin: .4rem 0 .05rem; }
.refinement-two-way .rf-tw-group:first-child .rf-tw-ghead { margin-top: .1rem; }
.refinement-two-way .rf-tw-gtoggle { display: inline-flex; align-items: baseline; gap: .35em; border-radius: 4px; padding: 0 .25em; margin-left: -.25em; color: var(--rf-quiet); }
.refinement-two-way .rf-tw-gtoggle:hover { background: var(--rf-wash); color: inherit; }
.refinement-two-way .rf-tw-gchev { display: inline-flex; align-self: center; width: 14px; justify-content: center; }
.refinement-two-way .rf-tw-gchev .ti { font-size: 13px; transition: transform .16s ease; }
.refinement-two-way .rf-tw-group[data-open] .rf-tw-gchev .ti { transform: rotate(90deg); }
.refinement-two-way .rf-tw-gn { font-size: .88em; }
.refinement-two-way .rf-tw-gadd { height: 20px; padding: 0 5px; visibility: hidden; }
.refinement-two-way .rf-tw-ghead:hover .rf-tw-gadd, .refinement-two-way .rf-tw-gadd:focus-visible { visibility: visible; }
.refinement-two-way .rf-tw-group .rf-tw-draft { padding-left: .35rem; }
.refinement-two-way .rf-tw-group .rf-tw-draft-plus { display: none; }
.refinement-two-way .rf-tw-into { position: absolute; left: -15px; top: .3em; width: 14px; height: 16px; padding: 0; justify-content: center; visibility: hidden; }
.refinement-two-way .rf-tw-item > .rf-tw-into { left: -9px; }
.refinement-two-way :is(.rf-tw-line, .rf-tw-item):hover .rf-tw-into, .refinement-two-way .rf-tw-into[data-on], .refinement-two-way .rf-tw-into:focus-visible { visibility: visible; }
.refinement-two-way .rf-tw-into .ti { font-size: 13px; transition: transform .16s ease; }
.refinement-two-way .rf-tw-into[data-on] .ti { transform: rotate(90deg); }
.refinement-two-way .rf-tw-node { flex-basis: 100%; min-width: 0; margin: .05rem 0 .35rem 4em; padding-left: .6rem; border-left: 1px solid var(--rf-line); display: grid; gap: 1px; }
.refinement-two-way .rf-tw-namefirst + .rf-tw-node, .refinement-two-way .rf-tw-item:not(.rf-tw-datefirst) + .rf-tw-node { margin-left: .4em; }
.refinement-two-way .rf-tw-bullet { display: grid; grid-template-columns: 1em minmax(0, 1fr); column-gap: .3em; align-items: baseline; }
.refinement-two-way .rf-tw-bullet[data-uuid] { cursor: pointer; }
.refinement-two-way .rf-tw-bdot { text-align: center; }
.refinement-two-way .rf-tw-btext .rf-tw-peek-open { border-bottom: 1px solid var(--rf-line); cursor: pointer; }
.refinement-two-way .rf-tw-bnew .rf-field { min-width: 0; }
/* Picking (0.4.228): the kit's tick box before each record, in the room left of it; shown under the pointer and on
   every record while any is picked. The bar is the kit's, above the rows. */
.refinement-two-way .rf-tw-row .rf-tw-pick { position: absolute; left: -15px; top: .45em; visibility: hidden; }
/* The box answers 6px round it as well (0.4.297); the room left of the record ticks it too (onClick). */
.refinement-two-way .rf-tw-row .rf-tw-pick::after { content: ''; position: absolute; inset: -6px; }
/* In an open list the box sits left of the outline's line (0.4.229, the owner: "to the left of the outline, not within it"). */
.refinement-two-way .rf-tw-line .rf-tw-pick { left: -34px; top: calc(.45em + 2px); }
/* Records not in a list too, one to a line so their boxes share that column (0.4.230, the owner: "even those not in a outline"). */
.refinement-two-way .rf-tw-item .rf-tw-pick { left: -24px; }
/* Each record on a line of its own, as in an open list (0.4.297); its tag right after its name since 0.4.320 (it was at
   the right edge from 0.4.297, the owner then: "the tags under decided should be right aligned"). */
/* In the wrapping row a negative margin shifts a node instead of widening it (measured in the app, 0.4.299: its right edge
   5 px and its tag 10 px short of an open list's): so it is widened by the margins themselves, the open list's .35rem. */
.refinement-two-way .rf-tw-value > .rf-tw-item { margin: 0 -.35rem; padding: 0 calc(.35rem + 1.6em) 0 .35rem; flex-basis: calc(100% + .7rem); max-width: calc(100% + .7rem); box-sizing: border-box; }
.refinement-two-way .rf-tw-item { flex-basis: 100%; min-width: 0; display: block; }
.refinement-two-way .rf-tw-tail { white-space: nowrap; }
/* The same room as in an open list: half a letter before the day, a letter before the tag. */
.refinement-two-way .rf-tw-tail > .rf-tw-day { margin-left: .5em; }
.refinement-two-way .rf-tw-tail > .rf-tw-tag { margin-left: 1em; }
/* The sidebar icon at the far right of its line (0.4.327, the owner: "the sidebar items should be on far right and have
   some sort of arrow to the right signifying sidebar opening"): the last column; the icon is a sidebar with an arrow. */
.refinement-two-way .rf-tw-line .rf-tw-side { grid-column: -2; justify-self: end; }
.refinement-two-way .rf-tw-item .rf-tw-side { position: absolute; right: .2rem; top: 1px; }
/* a long name wraps, never cut (0.4.263) */
/* The room left of a record, where its box sits, counts as the record under the pointer, so the box shows there too. */
.refinement-two-way :is(.rf-tw-line, .rf-tw-item)::before { content: ''; position: absolute; top: 0; bottom: 0; left: -36px; width: 36px; }
.refinement-two-way .rf-tw-item::before { left: -26px; width: 26px; }
.refinement-two-way :is(.rf-tw-line, .rf-tw-item):hover .rf-tw-pick, .refinement-two-way[data-picking] .rf-tw-row .rf-tw-pick { visibility: visible; }
.refinement-two-way { position: relative; }
.refinement-two-way .rf-tw-bar { margin: 0 0 6px 19px; }
.refinement-two-way .rf-tw-bar[data-idle] { visibility: hidden; }
.refinement-two-way .rf-tw-bar { flex-wrap: nowrap; min-width: 0; }
.refinement-two-way .rf-tw-bar .rf-tw-to-side { margin-left: auto; }
.refinement-two-way .rf-tw-menu { gap: 3px; min-width: 0; }
.refinement-two-way .rf-tw-menu-words { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 14em; }
.refinement-two-way .rf-tw-menu > .ti:last-child { font-size: 12px; opacity: .7; }
.refinement-two-way .rf-tw-bar .rf-count { white-space: nowrap; }
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
let stopped = false;
function start() {
  ({ UUID, isEntityId, watchDomEarly, addsElements, sendStyle, provided, uuidsIn, saveSettings, onPageChange, onDatabaseChange, onSettingsChange } = take(window.refinementCore, ['UUID', 'isEntityId', 'watchDomEarly', 'addsElements', 'sendStyle', 'provided', 'uuidsIn', 'saveSettings', 'onPageChange', 'onDatabaseChange', 'onSettingsChange', 'currentPage', 'getPage', 'createPage', 'deletePage', 'appendBlock', 'removeBlock', 'addTag', 'removeTag', 'setValue', 'unsetValue', 'editBlock']));
  model = window.refinementCore.provided; // the graph is read and written through the model's doors (0.4.318)
  stopped = false;
  applyStyles();
  readHeights();
  readOpen();
  readOrder();
  readGroup();
  watchDomEarly(drawEarly);
  draw(host());
  // At once (0.4.150): the look-up waits in line behind Logseq loading the page anyway. The box stays until the next
  // page is drawn (0.4.182): draw() moves it, or takes it away, in the same frame. The hooks are the core's.
  onPageChange(() => { if (stopped) return; onRoute(); later(0); });
  onDatabaseChange(() => { if (stopped) return; later(900); if (indexSize < BIG_INDEX) indexLater(10000); });
  onSettingsChange((now, before) => {
    if (stopped) return;
    if (settingsSchema.some(item => now?.[item.key] !== before?.[item.key])) { applyStyles(); later(0); indexLater(0); }
  });
  // A click away from an empty draft line drops it; one with words keeps them.
  const away = event => { if (state.draft && !state.draft.name.trim() && !event.target.closest?.('.rf-tw-draft, .refinement-two-way-add, .rf-tw-add, .rf-tw-gadd')) { state.draft = null; closeAdd(); draw(host()); } };
  host().addEventListener('mousedown', away, true);
  onUnload(() => host().removeEventListener('mousedown', away, true));
  const escape = event => { if (event.key === 'Escape' && state.picked.size && !event.target.closest?.('input, textarea, [contenteditable="true"]')) { state.picked.clear(); draw(host()); } };
  host().addEventListener('keydown', escape);
  onUnload(() => host().removeEventListener('keydown', escape));
  onUnload(() => { stopped = true; clearTimeout(timer); clearTimeout(indexTimer); clearTimeout(settle.timer); clearTimeout(settle.ease); clearTimeout(settle.wait); hidePeek(); closeAdd(); state.box?.remove(); state.box = null; });
  later(0);
  indexLater(1500);
}
function provide(core) {
  core.provide({ backwardsLabel, setBackwards, shownAtOtherEnd, setShownAtOtherEnd });
}
(window.refinementParts ||= []).push({ name: 'two-way', schema: settingsSchema, provide, start, stop: runUnloadTasks });
})();
