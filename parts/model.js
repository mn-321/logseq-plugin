/* Loaded by main.js right after parts/shared.js, before the other parts. Kept in its own scope. */
(() => {
/* The Logseq model (0.4.164): the one place that knows what a page, block, tag, property, journal day and
   link are in a DB graph, so that the parts above read the graph through it instead of each working it out.
   Gathered from main.js (the title helpers, the stored-link form, the version and screen checks), from
   parts/inline-props.js (the property schema, the pages, the fields of a record, the day reader, the journal
   page of a day) and from parts/editor.js (the journal title format, stored ids as the titles people see).
   It knows nothing of how anything is drawn; it writes nothing except a journal page a day needs (journalIdFor,
   through Logseq's own Editor.createPage, on behalf of a part that is writing).

   WHAT IT PROVIDES (core.provided):
   - titleOf(block), trailingTags, cleanTitle(raw), storedRef      the words of a block and how a link is stored
   - readableTitle(text, { pagesOnly, depth, asShown })             stored [[uuid]] and ((uuid)) as the titles people see
   - propSchema(), propPages(), fieldsOf(uuid, schema)              your properties with their types, every page with its
                                                                    tags, the fields a record's tags give it (remembered
                                                                    for the session; read again when the graph changes)
   - parseDay(text, today), dayNumber(d), sameDay(a, b), dayAfter(d, n), DAYS   a day typed in words, and days as numbers
   - journalIdFor(day, title), journalTitleFor(y, m, d), formatJournalTitle(date, format)   journal pages and their titles
   - CHECKED_WITH, PAGE_TITLE, screenChecks()                       the Logseq version the plugin was checked with, the
                                                                    title selector, and what a drawn page must hold
   - bare(value), pick(node, name), idOf(value)                     readers of a pulled map (keys come back shortened) */
const shared = window.refinementShared;
const { warnOnce, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (model): ' });
// From the core, taken when the part starts.
let dsQuery, graphWide;
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };

// The Logseq version whose page structure the plugin was last checked against. Most of what the
// plugin draws depends on names Logseq uses inside its own pages, which can change in any release.
const CHECKED_WITH = '2.0.2';
const PAGE_TITLE = '.ls-page-title, .page-title, h1.title';
/* What a drawn page must hold, for the core's self-check after a Logseq update: when the page plainly has a
   thing (blocks, a title, references) but the part the plugin finds inside it is missing, Logseq has most
   likely renamed that part, and the features listed beside it have quietly stopped.
   [what is missing, the page has this (at least min), but none of this, what stops, min] */
const screenChecks = () => [
  ['the page area', '#head', '#main-content-container', 'almost everything the plugin draws', 1],
  ['block text', '#main-content-container .ls-block[blockid]', '#main-content-container .block-title-wrap', 'cues after blocks, block-link dots, reference rows', 2],
  ['the title row', `#main-content-container :is(${PAGE_TITLE})`, '#main-content-container .is-page-title-row', 'tags beside the title, #Page, Add tags', 1],
  ['reference headings', '#main-content-container .references', '#main-content-container .references .ls-foldable-title', 'the Linked references layout, counts and labels', 1],
  ['the sidebar buttons', '#right-sidebar .sidebar-item', '#right-sidebar .cp__right-sidebar-settings', 'sidebar tidy', 1],
];

// The words of a block, and a title without its trailing tags.
const titleOf = block => (block?.title || block?.content || '').trim();
// Drops a leading bullet, every trailing tag (#work, #[[Long tag]]), and the brackets around links.
const trailingTags = /(?:\s+#(?:\[\[[^\]]*\]\]|[^\s#\[\]]+))+\s*$/;
const cleanTitle = raw => raw.replace(/^[-*]\s*/, '').replace(trailingTags, '')
  .replace(/\[\[([^\]]+)\]\]/g, '$1').trim().slice(0, 180);
// DB graphs store links as [[uuid]] and block references as ((uuid)). Swap in the titles people see.
// pagesOnly leaves ((uuid)) alone, matching what the block editor shows; asShown also leaves a [[uuid]]
// that points at a block (not a page) alone, because the editor shows such a link as its id.
const storedRef = /(\(\(|\[\[)([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(\)\)|\]\])/gi;
async function readableTitle(text, { pagesOnly = false, depth = 2, asShown = false } = {}) {
  const value = String(text || '');
  const names = new Map();
  for (const [, open, uuid] of value.matchAll(storedRef)) {
    const key = uuid.toLowerCase();
    if (names.has(key) || (pagesOnly && open === '((')) continue;
    let entity = null;
    try { entity = await logseq.Editor.getPage(key) || await logseq.Editor.getBlock(key); } catch (error) { /* keep the id */ }
    if (asShown && entity && !entity.name && !entity.originalName) { names.set(key, ''); continue; } // a block: shown as its id
    let name = titleOf(entity) || entity?.originalName || entity?.name || '';
    if (name && depth > 1) name = await readableTitle(name, { pagesOnly, depth: depth - 1 });
    names.set(key, name);
  }
  return value.replace(storedRef, (match, open, uuid, close) => {
    const name = names.get(uuid.toLowerCase());
    if (!name || (open === '[[') !== (close === ']]')) return match;
    return open === '[[' ? `[[${name}]]` : name;
  });
}

// Readers of a pulled map: a value comes back with its keys shortened ("db/id" as "id", "block/title" as "title").
const bare = value => String(value ?? '').replace(/^:/, '');
const pick = (node, name) => node?.[name] ?? node?.[':' + name] ?? node?.[name.slice(name.indexOf('/') + 1)];
const idOf = value => typeof value === 'number' ? value : pick(value, 'db/id');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* The schema: your properties (and the four of Logseq's that a record takes: Deadline, Scheduled, Status,
   Priority) with their type, cardinality, class and choices; and which tag has which fields. Remembered for the
   session (graphWide) and read again when the graph has changed. */
const OWN_PROP = /^(?:user\.property\/|logseq\.property\/(?:deadline|scheduled|status|priority)$)/;
async function loadSchema() {
  const rows = await dsQuery(`[:find (pull ?p [:db/id :db/ident :block/uuid :block/title :logseq.property/type :db/cardinality :logseq.property/icon
      {:logseq.property/classes [:db/id :block/uuid :block/title]}])
    :where [?p :block/tags :logseq.class/Property] [?p :db/ident _]]`);
  const props = [], byId = new Map();
  for (const [p] of rows) {
    const ident = bare(pick(p, 'db/ident')), title = String(pick(p, 'block/title') ?? '');
    if (!OWN_PROP.test(ident) || !title) continue;
    const classes = (pick(p, 'logseq.property/classes') || []).map(c => ({ id: idOf(c), uuid: String(pick(c, 'block/uuid') ?? ''), title: String(pick(c, 'block/title') ?? '') }));
    const prop = { id: idOf(p), uuid: String(pick(p, 'block/uuid') ?? ''), ident, title, lower: title.toLowerCase(),
      type: bare(pick(p, 'logseq.property/type')) || 'default', many: bare(pick(p, 'db/cardinality')) === 'db.cardinality/many', classes, choices: [], icon: pick(p, 'logseq.property/icon') };
    props.push(prop); byId.set(prop.id, prop);
  }
  for (const [pid, v] of await dsQuery(`[:find ?p (pull ?v [:db/id :block/title :block/order :logseq.property/icon]) :where [?v :block/closed-value-property ?p]]`)) {
    const prop = byId.get(pid);
    if (prop) prop.choices.push({ id: idOf(v), title: String(pick(v, 'block/title') ?? ''), order: String(pick(v, 'block/order') ?? ''), icon: pick(v, 'logseq.property/icon') });
  }
  for (const prop of props) prop.choices.sort((a, b) => a.order.localeCompare(b.order));
  props.sort((a, b) => a.lower.localeCompare(b.lower));
  const classProps = new Map();
  for (const [c, p] of await dsQuery(`[:find ?c ?p :where [?c :logseq.property.class/properties ?p]]`)) { if (!classProps.has(c)) classProps.set(c, []); classProps.get(c).push(p); }
  const parentsOf = new Map();
  for (const [child, parent] of await dsQuery(`[:find ?child ?parent :where [?child :logseq.property.class/extends ?parent]]`)) { if (!parentsOf.has(child)) parentsOf.set(child, []); parentsOf.get(child).push(parent); }
  return { props, byId, classProps, parentsOf };
}
// Pages a page-valued field can point at: every page with its tags (journals left out: a day is a Date's business).
async function loadPages() {
  const rows = await dsQuery(`[:find (pull ?p [:db/id :block/uuid :block/title :logseq.property/icon {:block/tags [:db/id :block/title :db/ident]}])
    :where [?p :block/name _] (not [?p :block/tags :logseq.class/Property]) (not [?p :block/journal-day _])]`);
  const pages = [];
  for (const [p] of rows) {
    const title = String(pick(p, 'block/title') ?? '');
    if (!title || title.startsWith('$$$')) continue;
    const tags = (pick(p, 'block/tags') || []).map(t => ({ id: idOf(t), title: String(pick(t, 'block/title') ?? ''), ident: bare(pick(t, 'db/ident')) })).filter(t => t.title);
    pages.push({ id: idOf(p), uuid: String(pick(p, 'block/uuid') ?? ''), title, lower: title.toLowerCase(), tags, icon: pick(p, 'logseq.property/icon'), isTag: tags.some(t => t.ident === 'logseq.class/Tag') });
  }
  pages.sort((a, b) => a.lower.localeCompare(b.lower));
  return pages;
}
// The cache keys are the ones Properties in the line used, so nothing else changes (0.4.164).
const propSchema = () => graphWide('inlinePropsSchema', loadSchema);
const propPages = () => graphWide('inlinePropsPages', loadPages);
// The fields of the block's own tags, own tags first, then what they inherit, without repeats.
async function fieldsOf(uuid, schema) {
  if (!UUID.test(uuid)) return [];
  const tags = (await dsQuery(`[:find ?t :where [?b :block/uuid #uuid "${uuid}"] [?b :block/tags ?t]]`)).map(([t]) => t);
  const seen = new Set(), fields = [], queue = [...tags];
  while (queue.length) {
    const c = queue.shift();
    if (seen.has(c)) continue;
    seen.add(c);
    for (const p of schema.classProps.get(c) || []) { const prop = schema.byId.get(p); if (prop && !fields.includes(prop)) fields.push(prop); }
    queue.push(...(schema.parentsOf.get(c) || []));
  }
  return fields;
}

/* Days. A value typed for a Date: today, tomorrow, yesterday, a weekday (the next one after today), "next" and a
   weekday (a week later), +3 or -2 (days from today), 2026-10-23, 23 oct, oct 23 (this year, or next year when
   that day has passed). */
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const dayAfter = (date, n) => { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate() + n); return d; };
// A date only when the day exists: 30 February or 31 September is no day (0.4.168: they used to roll over into the
// next month, so "31 sep" read as 1 October).
const exactDay = (year, month, day) => { const d = new Date(year, month, day); return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day ? d : null; };
const weekdayIndex = word => DAYS.findIndex(d => d.startsWith(word) && word.length >= 2);
function parseDay(text, today) {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (t === 'today') return today;
  if (t === 'tomorrow' || t === 'tmr') return dayAfter(today, 1);
  if (t === 'yesterday') return dayAfter(today, -1);
  let m = t.match(/^([+-])(\d{1,3})$/);
  if (m) return dayAfter(today, (m[1] === '-' ? -1 : 1) * Number(m[2]));
  m = t.match(/^(next\s+)?([a-z]{2,9})$/);
  if (m) {
    const wd = weekdayIndex(m[2]);
    if (wd >= 0) { let n = (wd - today.getDay() + 7) % 7 || 7; if (m[1]) n += 7; return dayAfter(today, n); }
  }
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return exactDay(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = t.match(/^(\d{1,2})\s+([a-z]{3,9})\.?(?:\s+(\d{4}))?$/) || t.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
  if (m) {
    const [a, b] = /^\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
    const month = MONTHS.findIndex(name => name.startsWith(b));
    if (month < 0) return null;
    let date = exactDay(m[3] ? Number(m[3]) : today.getFullYear(), month, Number(a));
    if (!m[3] && date && date < today) date = exactDay(today.getFullYear() + 1, month, Number(a));
    return date;
  }
  return null;
}
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayNumber = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

/* Journal pages. A day's page by its number (made when it does not exist yet, as Logseq would), and a day's title
   in the format the graph uses (MMM do, yyyy; E, dd.MM.yyyy; yyyyMMdd ...), read once from Logseq's settings. */
async function journalIdFor(day, title) {
  const [[p] = []] = await dsQuery(`[:find (pull ?p [:db/id]) :where [?p :block/journal-day ${day}]]`);
  if (p && idOf(p)) return idOf(p);
  const page = await logseq.Editor.createPage(title, {}, { redirect: false, createFirstBlock: false, journal: true });
  return page?.id ?? null;
}
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
function formatJournalTitle(date, format) {
  const pad = n => String(n).padStart(2, '0');
  const parts = {
    yyyy: date.getFullYear(), yy: pad(date.getFullYear() % 100),
    MMMM: MONTH_NAMES[date.getMonth()], MMM: MONTH_NAMES[date.getMonth()].slice(0, 3), MM: pad(date.getMonth() + 1), M: date.getMonth() + 1,
    do: ordinal(date.getDate()), dd: pad(date.getDate()), d: date.getDate(),
    EEEE: DAY_NAMES[date.getDay()], EEE: DAY_NAMES[date.getDay()].slice(0, 3), E: DAY_NAMES[date.getDay()].slice(0, 3),
  };
  return format.replace(/yyyy|yy|MMMM|MMM|MM|M|do|dd|d|EEEE|EEE|E/g, token => parts[token]);
}
const journalFormat = { value: null };
async function journalTitleFor(year, month, day) {
  const journalDay = year * 10000 + month * 100 + day;
  try {
    const [[title] = []] = await dsQuery(`[:find ?t :where [?p :block/journal-day ${journalDay}] [?p :block/title ?t]]`);
    if (title) return String(title);
  } catch (error) { /* no such journal yet: use the format below */ }
  if (!journalFormat.value) {
    try { journalFormat.value = (await logseq.App.getUserConfigs())?.preferredDateFormat || null; } catch (error) { /* default below */ }
  }
  return formatJournalTitle(new Date(year, month - 1, day), journalFormat.value || 'MMM do, yyyy');
}

function provide(core) {
  core.provide({ titleOf, trailingTags, cleanTitle, storedRef, readableTitle, bare, pick, idOf,
    propSchema, propPages, fieldsOf, parseDay, dayNumber, sameDay, dayAfter, DAYS,
    journalIdFor, journalTitleFor, formatJournalTitle, CHECKED_WITH, PAGE_TITLE, screenChecks });
}
function start() {
  ({ dsQuery, graphWide } = take(window.refinementCore, ['dsQuery', 'graphWide']));
}
(window.refinementParts ||= []).push({ name: 'model', foundation: true, schema: [], provide, start, stop: runUnloadTasks });
})();
