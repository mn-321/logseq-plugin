/* Loaded by loader.js before main.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* Properties in the line (0.4.94): a property typed at the end of the block you are writing, predicted
   as you type, written when you pick, undone from the bar.

   p::            opens a list under the caret: the fields of this record's kind first, then every property,
                  each with its type. Letters filter it; Enter picks a name and the list turns into its values.
   name::value    skips to the values of a field you know (date::fri, owner::ad, stage::pl); the first letters do
                  when they start one field only (pro::at, a::mat), and several open the name list filtered (0.4.97).
   The values are predicted by the property's type: days for a Date (today, tomorrow, the weekdays, "next fri",
   2026-10-23, 23 oct, +3), pages of the right class for a page-valued field, the choices for a closed set,
   the values already used for free text, yes/no for a checkbox, the number or url as typed. While a row is
   highlighted the value it would write is pencilled in (italic, the quiet colour, no box since 0.4.116) in the record's own property row (or at the top of
   the list when the row has no pill for it). Enter writes it, takes the token out of the text, leaves the
   caret where it was, and the dark bar offers Undo. Escape closes the list and leaves the words as typed.
   Only names the graph has are ever written to; a new page is made only through a pencilled "Make …" row, never
   the first row, and a new property still comes from Logseq's own Add property (see unknownRows).
   Since 0.4.118 the list opens on what Proposals in the pills has pencilled into the field (proposalsFor, from
   parts/proposals.js): that value first, highlighted, with why beside it, and one pencilled value per pill.
   It runs only in the graphs named in its settings, as Journal day as date does. */
const shared = window.refinementShared;
const { host, notify, showUndoBar } = shared;
const { warnOnce, onUnload, runUnloadTasks, takeOverFromEarlierCopy, listen } = shared.lifecycle({ prefix: 'Refinements (inline properties): ', stopKey: '__refinementInlinePropsStop',
  sweep: doc => { try { for (const el of doc.querySelectorAll('.rip-menu, .rip-ghost')) el.remove(); for (const el of doc.querySelectorAll('[data-rip-ghost]')) el.removeAttribute('data-rip-ghost'); } catch (error) { /* nothing left over */ } } });
const { graphNamedIn } = shared;
let dsQuery, graphWide, journalTitleFor, coreSetting, proposalsFor, undoBeside;
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };

const settingsSchema = [
  { key: 'inlinePropsHeading', type: 'heading', title: 'Properties in the line', default: null,
    description: 'Type p:: at the end of the block you are writing to pick a property and its value without leaving the line, or name::value when you know the field (date::fri). The value is pencilled in, italic, before you press Enter; after it the bar at the bottom offers Undo.' },
  { key: 'inlineProps', type: 'boolean', title: 'Properties typed in the line', default: true,
    description: 'The list under the caret after p:: or name::. Applies at once. Nothing is written until you press Enter on a value; names the graph does not have are never written to, and a new page comes only from an italic “Make …” row (a new property still comes from Logseq’s own Add property).' },
  { key: 'inlinePropsGraphs', type: 'string', title: 'Only in these graphs', default: '',
    description: 'Comma-separated graph names. The list opens only in the graphs named here; nothing happens while this is empty. Plugin settings are shared by all your graphs, so this keeps the writing out of the others.' },
  { key: 'inlinePropsPrefix', type: 'boolean', title: 'First letters name the field', default: true,
    description: 'The letters before :: need only start a field’s name: pro:: opens project’s values when only one of the record’s own fields (or, failing that, one of all your properties) starts so; when several do, the name list opens filtered by them, so nothing is guessed. The record’s fields are listed in the order of their pills. Applies at once.' },
  { key: 'inlinePropsGather', type: 'boolean', title: 'A field that takes several stays open', default: true,
    description: 'After Enter writes a page into a field that takes several (attendees), the list stays open with the letters cleared and no row chosen; more letters and Enter add the next, Enter with nothing typed (or Escape) finishes and takes the token out of the text. Applies at once.' },
  { key: 'inlinePropsEscapeClears', type: 'boolean', title: 'Escape takes the token out', default: true,
    description: 'Escape closes the list and takes p:: or name:: out of the text (Cmd+Z brings it back); leaving the block with the list open, by Tab or a click elsewhere, does the same, so a block is never saved with the token in it. Off, Escape keeps the words as typed. Applies at once.' },
  { key: 'inlinePropsProposedFirst', type: 'boolean', title: 'The list opens on the proposal', default: true,
    description: 'When Proposals in the pills has pencilled a value into the field you name (c:: on a record whose words name Lumen Labs), the list opens on that value, first and highlighted, with why beside it, so Enter takes it with no more letters; the pill shows one pencilled value at a time. Applies at once.' },
];
const setting = shared.settingReader(settingsSchema);

const bare = value => String(value ?? '').replace(/^:/, '');
// A pulled map comes back with its keys shortened ("db/id" as "id", "block/title" as "title", "logseq.property/type" as "type").
const pick = (node, name) => node?.[name] ?? node?.[':' + name] ?? node?.[name.slice(name.indexOf('/') + 1)];
const idOf = value => typeof value === 'number' ? value : pick(value, 'db/id');
const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shorten = (text, max = 40) => (text.length > max ? text.slice(0, max - 1) + '…' : text);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* The schema: your properties (and the four of Logseq's that a record takes: Deadline, Scheduled, Status,
   Priority) with their type, cardinality, class and choices; and which tag has which fields. Read again at most
   every 30 s while you write. */
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
const typeLabel = prop => {
  const many = prop.many ? ' · many' : '';
  switch (prop.type) {
    case 'date': return 'Date';
    case 'datetime': return 'Date · time';
    case 'node': return (prop.classes.length ? prop.classes.map(c => c.title).join(', ') : 'page') + many;
    case 'default': return (prop.choices.length ? 'choices' : 'text') + many;
    case 'number': return 'number';
    case 'checkbox': return 'yes/no';
    case 'url': return 'url' + many;
    default: return prop.type;
  }
};
/* Marks, as the page draws them. Logseq's type icons are redrawn here as small inline SVGs in the same style
   (24-unit box, a 2-unit round stroke in the current colour); a page, tag, property or choice that has an icon of
   its own shows it when that icon is already drawn somewhere on screen (its SVG is copied once and kept for the
   session; an emoji is just the emoji), else the mark of its kind: the plain page rectangle, or the # in the tag
   colour for a tag's page, as before a link. */
const PATHS = {
  calendar: '<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M16 3v4M8 3v4M4 11h16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  number: '<path d="M5 9h14M5 15h14M11 4l-2 16M17 4l-2 16"/>',
  checkbox: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 12l2 2 4-4"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  link: '<path d="M10 14a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-.5.5"/><path d="M14 10a3.5 3.5 0 0 0-5 0l-4 4a3.5 3.5 0 0 0 5 5l.5-.5"/>',
  text: '<circle cx="17.5" cy="15.5" r="3.5"/><path d="M3 19V8.5a3.5 3.5 0 0 1 7 0V19M3 13h7M21 12v7"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M5 6h.01M5 12h.01M5 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  circle: '<circle cx="12" cy="12" r="7"/>',
};
const svg = (name, cls = '') => `<svg class="rip-ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
const pageMark = () => '<svg class="rip-ic rip-page" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="8" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
const tagMark = () => svg('number', 'rip-hash');
const iconCache = new Map();
// The icon Logseq gives a thing ({type, id} from :logseq.property/icon), as html, or null when it cannot be drawn here.
function ownIcon(icon) {
  if (!icon) return null;
  const type = bare(pick(icon, 'type') ?? icon.type), id = String(pick(icon, 'id') ?? icon.id ?? '');
  if (!id) return null;
  if (type === 'emoji') return `<span class="rip-emoji">${escapeHtml(id)}</span>`;
  if (iconCache.has(id)) return iconCache.get(id);
  const drawn = host().querySelector(`.ui__icon.ls-icon-${CSS.escape(id)} svg`);
  if (!drawn) return null;
  const html = `<span class="rip-own">${drawn.outerHTML}</span>`;
  iconCache.set(id, html);
  return html;
}
const typeIcon = prop => ownIcon(prop.icon) || (prop.type === 'node' ? pageMark() : svg({ date: 'calendar', datetime: 'clock', number: 'number', checkbox: 'checkbox', url: 'link' }[prop.type] || (prop.choices?.length ? 'list' : 'text')));
const pageIcon = page => page.isTag ? tagMark() : (ownIcon(page.icon) || pageMark());

/* Days. A value typed for a Date: today, tomorrow, yesterday, a weekday (the next one after today), "next" and a
   weekday (a week later), +3 or -2 (days from today), 2026-10-23, 23 oct, oct 23 (this year, or next year when
   that day has passed). */
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const dayAfter = (date, n) => { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate() + n); return d; };
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
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = t.match(/^(\d{1,2})\s+([a-z]{3,9})\.?(?:\s+(\d{4}))?$/) || t.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
  if (m) {
    const [a, b] = /^\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
    const month = MONTHS.findIndex(name => name.startsWith(b));
    if (month < 0) return null;
    let date = new Date(m[3] ? Number(m[3]) : today.getFullYear(), month, Number(a));
    if (!m[3] && date < today) date = new Date(today.getFullYear() + 1, month, Number(a));
    return date;
  }
  return null;
}
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayNumber = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
async function dayRows(filter, withTime) {
  const today = new Date();
  // A time may follow the day for a date-and-time field: "fri 19:00".
  let time = null, dayText = filter.trim();
  if (withTime) { const m = dayText.match(/^(.*?)\s*(\d{1,2}):(\d{2})$/); if (m) { dayText = m[1]; time = [Number(m[2]), Number(m[3])]; } }
  const named = [[today, 'today'], [dayAfter(today, 1), 'tomorrow']];
  for (let n = 2; n <= 7; n++) { const d = dayAfter(today, n); named.push([d, DAYS[d.getDay()]]); }
  const typed = parseDay(dayText, today);
  const list = [];
  if (typed && !named.some(([d]) => sameDay(d, typed))) list.push([typed, dayText.trim().toLowerCase()]);
  const f = dayText.trim().toLowerCase().replace(/^next\s+/, '');
  for (const [d, label] of named) if (!f || label.startsWith(f) || (typed && sameDay(d, typed))) list.push([d, label]);
  if (typed && f.startsWith('next')) list.unshift([typed, dayText.trim().toLowerCase()]);
  const rows = [];
  for (const [d, label] of list.slice(0, 9)) {
    const title = await journalTitleFor(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const when = time ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), time[0], time[1]) : d;
    const shown = time ? `${title} ${String(time[0]).padStart(2, '0')}:${String(time[1]).padStart(2, '0')}` : title;
    rows.push({ kind: 'value', label: label.charAt(0).toUpperCase() + label.slice(1), right: shown, day: true, icon: svg(withTime ? 'clock' : 'calendar'), value: { day: dayNumber(d), title, when, shown } });
  }
  return rows;
}

/* The rows of each stage. A row is { kind, label, right?, icon? (html), day?, dashed?, prop?, value? }. */
const state = { box: null, uuid: '', stage: null, prop: null, name: '', prefix: '', filter: '', start: 0, rows: [], sel: 0, menu: null, version: 0, allowed: null, dismissed: null, gather: false };
// The block's property pills as Logseq draws them. A pill's first child reads "attendees:", with the colon, in edit
// as out of it (seen 2026-10-17; the name was never matched before 0.4.96).
const pillName = p => (p.firstElementChild?.textContent || '').trim().replace(/:$/, '').toLowerCase();
function pillsOf(uuid) {
  const block = host().querySelector(`.ls-block[blockid="${uuid}"]`);
  return block ? [...block.querySelectorAll('.positioned-properties.block-below .bottom-property-pill')].filter(p => p.closest('.ls-block[blockid]') === block) : [];
}
// The record's fields in the order of their pills on screen (0.4.97), the ones without a pill after, as the schema has them.
function inPillOrder(fields, uuid) {
  const order = pillsOf(uuid).map(pillName);
  const at = prop => { const i = order.indexOf(prop.lower); return i < 0 ? order.length : i; };
  return fields.map((prop, i) => [prop, at(prop), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([prop]) => prop);
}
async function nameRows(filter, prefix = '') {
  const schema = await graphWide('inlinePropsSchema', loadSchema);
  const fields = inPillOrder(await fieldsOf(state.uuid, schema), state.uuid);
  const f = filter.toLowerCase();
  // With a prefix (d:: for date, Deadline, due date) only names that start so are listed; the letters after :: narrow them.
  const fits = prop => (!prefix || prop.lower.startsWith(prefix)) && (!f || prop.lower.includes(f));
  // Names that start with the letters typed come before names that only contain them.
  const byStart = (a, b) => (b.lower.startsWith(f) - a.lower.startsWith(f)) || (fields.includes(b) - fields.includes(a));
  const asRow = prop => ({ kind: 'prop', prop, label: prop.title, right: typeLabel(prop), icon: typeIcon(prop) });
  const rows = fields.filter(fits).sort(f ? byStart : () => 0).map(asRow);
  const rest = schema.props.filter(prop => !fields.includes(prop) && fits(prop)).sort(f ? byStart : () => 0).map(asRow);
  if (rows.length && rest.length) rows.push({ kind: 'info', label: 'every property' });
  rows.push(...rest);
  // With a prefix that several names start with and letters that fit none of them (st::pl: stage, start date), the
  // names stay and the letters are read as the value: Enter picks a name and carries them over (0.4.120).
  if (!rows.length && f && prefix) {
    const starting = prop => prop.lower.startsWith(prefix);
    const named = [...fields.filter(starting), ...schema.props.filter(prop => !fields.includes(prop) && starting(prop))];
    if (named.length) {
      rows.push(...named.map(prop => ({ ...asRow(prop), carry: filter.trim() })));
      rows.push({ kind: 'info', label: `“${filter.trim()}” names none of these · Enter picks one and keeps the letters` });
      return rows;
    }
  }
  if (!rows.length && f) rows.push(...unknownRows(filter.trim()));
  return rows;
}
// What Proposals in the pills has pencilled into this field of the record (0.4.118): the list opens on it.
const proposedHere = prop => setting('inlinePropsProposedFirst') && proposalsFor ? proposalsFor(state.uuid, prop.ident) : [];
async function valueRows(prop, filter) {
  const f = filter.trim(), lower = f.toLowerCase();
  switch (prop.type) {
    case 'date': {
      const rows = await dayRows(f, false);
      // The journal day proposed for this record goes first, with why, when it is not already a row (today is).
      for (const item of proposedHere(prop)) {
        if (!item.day || rows.some(r => r.value.day === item.day)) { const r = rows.find(r => r.value.day === item.day); if (r) { r.why = item.why; rows.splice(rows.indexOf(r), 1); rows.unshift(r); } continue; }
        if (lower && !item.shown.toLowerCase().includes(lower) && !'journal day'.includes(lower)) continue;
        rows.unshift({ kind: 'value', label: 'Journal day', right: item.shown, day: true, icon: svg('calendar'), why: item.why, value: { day: item.day, title: item.shown, when: null, shown: item.shown } });
      }
      return rows;
    }
    case 'datetime': return dayRows(f, true);
    case 'node': {
      const pages = await graphWide('inlinePropsPages', loadPages);
      const classIds = new Set(prop.classes.map(c => c.id));
      const ofClass = classIds.size ? pages.filter(p => p.tags.some(t => classIds.has(t.id))) : pages;
      const hits = lower ? ofClass.filter(p => p.lower.includes(lower)) : ofClass.slice(0, 12);
      // The proposed pages first (0.4.118), then an exact match, then names that start with the letters.
      const proposed = new Map();
      for (const item of proposedHere(prop)) for (const id of item.ids) proposed.set(id, item.why);
      for (const p of ofClass) if (proposed.has(p.id) && !hits.includes(p) && (!lower || p.lower.includes(lower))) hits.push(p);
      hits.sort((a, b) => proposed.has(b.id) - proposed.has(a.id) || (b.lower === lower) - (a.lower === lower) || b.lower.startsWith(lower) - a.lower.startsWith(lower) || a.lower.localeCompare(b.lower));
      const kindOf = p => p.tags.find(t => t.title !== 'Page')?.title || 'page';
      const rows = hits.slice(0, 9).map(p => ({ kind: 'value', label: p.title, right: p.isTag ? 'tag' : kindOf(p), mono: !p.isTag && kindOf(p) !== 'page', icon: pageIcon(p), why: proposed.get(p.id) || '', value: { id: p.id, uuid: p.uuid, title: p.title } }));
      if (f && !hits.some(p => p.lower === lower)) {
        const cls = prop.classes[0];
        rows.push({ kind: 'make-page', label: `Make ${cls ? cls.title : 'page'} “${f}”`, dashed: true, icon: svg('plus'), value: { title: f, cls } });
      }
      return rows;
    }
    case 'default': {
      if (prop.choices.length) return prop.choices.filter(c => !lower || c.title.toLowerCase().includes(lower)).map(c => ({ kind: 'value', label: c.title, icon: ownIcon(c.icon) || svg('circle'), value: { id: c.id, title: c.title } }));
      const used = await dsQuery(`[:find ?t (count ?b) :where [?b :${prop.ident} ?v] [?v :block/title ?t]]`).catch(() => []);
      const values = used.map(([t, n]) => ({ title: String(t), n })).filter(v => v.title && (!lower || v.title.toLowerCase().includes(lower)));
      values.sort((a, b) => b.n - a.n || a.title.localeCompare(b.title));
      const rows = values.slice(0, 8).map(v => ({ kind: 'value', label: v.title, right: `used · ${v.n}`, icon: svg('text'), value: { text: v.title, title: v.title } }));
      if (f && !values.some(v => v.title.toLowerCase() === lower)) rows.push({ kind: 'value', label: `“${f}” as new text`, dashed: true, icon: svg('plus'), value: { text: f, title: f } });
      return rows;
    }
    case 'number': {
      const n = Number(f.replace(/,/g, ''));
      return f && Number.isFinite(n) ? [{ kind: 'value', label: String(n), icon: svg('number'), value: { number: n, title: String(n) } }] : [{ kind: 'info', label: f ? 'not a number' : 'type a number' }];
    }
    case 'checkbox': return [['yes', true], ['no', false]].filter(([l]) => !lower || l.startsWith(lower)).map(([l, v]) => ({ kind: 'value', label: l, icon: svg(v ? 'checkbox' : 'square'), value: { bool: v, title: l } }));
    case 'url': return /^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(f) ? [{ kind: 'value', label: f, icon: svg('link'), value: { text: f, title: f } }] : [{ kind: 'info', label: 'type a url (https://…)' }];
    default: return [{ kind: 'info', label: `a ${prop.type} value cannot be set here` }];
  }
}
// A name the graph does not have is never written to. (A "Make property" row was tried on 2026-10-17 and taken
// out: a property made through the plugin API belongs to the plugin, plugin.property.logseq-db-refinements/name,
// not to you, so a new field still comes from Logseq's own Add property.)
const unknownRows = name => [{ kind: 'info', label: `no property named “${name}”` }, { kind: 'info', label: 'a new one is made with Logseq’s Add property (/)' }];

/* The token at the caret: "p::filter" (stage name), "title::filter" for a property the graph has (stage value),
   or "word::filter" for one it does not (stage new). Only at the end of the block, with nothing after the caret. */
async function tokenAt(box) {
  const caret = box.selectionStart;
  if (caret !== box.selectionEnd) return null;
  const value = box.value;
  if (value.slice(caret).trim()) return null;
  const before = value.slice(0, caret);
  const m = before.match(/(?:^|\s)(\S[^\n:]{0,60}?)::([^\n:]*)$/);
  if (!m) return null;
  const phrase = m[1], filter = m[2], lowerPhrase = phrase.toLowerCase();
  const schema = await graphWide('inlinePropsSchema', loadSchema);
  let best = null;
  for (const prop of schema.props) if (lowerPhrase === prop.lower || lowerPhrase.endsWith(' ' + prop.lower)) if (!best || prop.lower.length > best.lower.length) best = prop;
  const tail = name => before.length - (name.length + 2 + filter.length);
  if (best) return { stage: 'value', prop: best, name: best.title, filter, start: tail(best.title) };
  if (/(?:^|\s)p$/.test(lowerPhrase)) return { stage: 'name', prop: null, name: 'p', filter, start: tail('p') };
  const word = phrase.trim().match(/(\S+)$/)?.[1] || phrase.trim();
  // The first letters of a name (0.4.97): one of the record's own fields starting so, else one of all properties,
  // goes straight to its values; several open the name list filtered by them; none is a name the graph lacks.
  if (setting('inlinePropsPrefix')) {
    const w = word.toLowerCase(), uuid = box.closest('.ls-block[blockid]')?.getAttribute('blockid') || '';
    const starting = list => list.filter(prop => prop.lower.startsWith(w));
    let hits = starting(await fieldsOf(uuid, schema));
    if (!hits.length) hits = starting(schema.props);
    if (hits.length === 1) return { stage: 'value', prop: hits[0], name: hits[0].title, filter, start: tail(word) };
    if (hits.length > 1) return { stage: 'name', prop: null, name: word, prefix: w, filter, start: tail(word) };
    // The token forgives a missing space (0.4.106): "Mateoa::pri" names no field, but its tail "a" starts one;
    // the shortest tail that starts exactly one of the record's own fields (else of all) is read, and the word before it stays.
    const fields = await fieldsOf(uuid, schema);
    for (let n = 1; n < w.length; n++) {
      const t = w.slice(w.length - n);
      let hits = fields.filter(prop => prop.lower.startsWith(t));
      if (!hits.length) hits = schema.props.filter(prop => prop.lower.startsWith(t));
      if (hits.length === 1) return { stage: 'value', prop: hits[0], name: hits[0].title, filter, start: tail(t) };
    }
  }
  return { stage: 'new', prop: null, name: word, filter, start: tail(word) };
}

/* The list under the caret. */
function menuEl(doc) {
  if (state.menu?.isConnected && state.menu.ownerDocument === doc) return state.menu;
  state.menu?.remove();
  const menu = state.menu = doc.createElement('div');
  menu.className = 'rip-menu';
  menu.setAttribute('role', 'listbox');
  menu.addEventListener('mousedown', event => event.preventDefault()); // the caret stays in the block
  menu.addEventListener('click', event => {
    const row = event.target.closest('.rip-row[data-index]');
    if (!row) return;
    event.preventDefault(); event.stopPropagation();
    state.sel = Number(row.dataset.index);
    pickSelected();
  });
  doc.body.appendChild(menu);
  return menu;
}
function placeMenu(menu, box) {
  const rect = box.getBoundingClientRect(), win = box.ownerDocument.defaultView;
  if (!rect.width && !rect.height) { menu.style.display = 'none'; return; } // the box is gone from the layout
  menu.style.display = '';
  // Under the record's own property row when it has one, so the ghost drawn in a pill stays in view.
  const block = box.closest('.ls-block[blockid]');
  const pills = block && [...block.querySelectorAll('.positioned-properties.block-below')].find(p => p.closest('.ls-block[blockid]') === block);
  const bottom = Math.max(rect.bottom, pills?.getBoundingClientRect().bottom || 0);
  const top = bottom + 2, left = Math.max(8, rect.left);
  menu.style.left = `${Math.min(left, win.innerWidth - 380)}px`;
  if (top + 300 > win.innerHeight && rect.top > 300) { menu.style.top = ''; menu.style.bottom = `${win.innerHeight - rect.top + 2}px`; }
  else { menu.style.bottom = ''; menu.style.top = `${top}px`; }
}
const selectable = row => !!row && row.kind !== 'info';
// One row of a list, as the page draws it (the link box draws its rows with this too, 0.4.102).
const rowHtml = (row, i, selected) => row.kind === 'info'
  ? `<div class="rip-row rip-info">${escapeHtml(row.label)}</div>`
  : `<div class="rip-row${selected ? ' rip-sel' : ''}${row.dashed ? ' rip-make' : ''}" data-index="${i}"><span class="rip-glyph">${row.icon || ''}</span><span class="rip-label">${row.dashed ? `<span class="rip-new">${escapeHtml(row.label)}</span>` : escapeHtml(row.label)}</span>${row.why ? `<span class="rip-why">${escapeHtml(row.why)}</span>` : ''}${row.right ? `<span class="${row.day ? 'rip-day' : row.mono ? 'rip-right rip-mono' : 'rip-right'}">${escapeHtml(row.right)}</span>` : ''}</div>`;
function renderMenu() {
  const doc = host(), menu = menuEl(doc);
  const rows = state.rows;
  // While a "many" field gathers and nothing is typed, no row is chosen, so Enter finishes rather than picks (0.4.98).
  const idle = state.gather && !state.filter.trim();
  if (!rows.some(selectable) || (idle && state.sel < 0)) { state.sel = -1; } else if (state.sel < 0 || !selectable(rows[state.sel])) state.sel = rows.findIndex(selectable);
  const head = state.stage === 'value' && state.prop ? `<div class="rip-head"><span class="rip-head-name">${escapeHtml(state.prop.title)}</span><span class="rip-head-type">${escapeHtml(typeLabel(state.prop))}</span></div>` : '';
  menu.innerHTML = head + rows.map((row, i) => rowHtml(row, i, i === state.sel)).join('');
  // Logseq swaps the text box while it redraws a block, so the live one is taken when it still edits this block.
  const live = doc.activeElement;
  if (live?.matches?.('textarea') && live !== state.box && live.closest('.ls-block[blockid]')?.getAttribute('blockid') === state.uuid) state.box = live;
  placeMenu(menu, state.box);
  // Keeps the highlighted row in view inside the list (scrollIntoView would scroll the page as well).
  const sel = menu.querySelector('.rip-sel');
  if (sel) { const top = sel.offsetTop, bottom = top + sel.offsetHeight; if (top < menu.scrollTop) menu.scrollTop = top; else if (bottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = bottom - menu.clientHeight; }
  drawGhost();
}
function closeMenu() {
  state.menu?.remove(); state.menu = null;
  state.stage = null; state.prop = null; state.rows = []; state.sel = 0; state.gather = false;
  removeGhost();
}
/* The ghost: the highlighted value pencilled in where it will go, in the record's empty pill for that property when
   Logseq shows one, else in the list's own header. */
function removeGhost() {
  const doc = host();
  for (const el of doc.querySelectorAll('.rip-ghost')) el.remove();
  for (const el of doc.querySelectorAll('[data-rip-ghost]')) el.removeAttribute('data-rip-ghost');
}
function drawGhost() {
  removeGhost();
  const row = state.rows[state.sel];
  if (state.stage !== 'value' || !row || row.kind !== 'value') return;
  const doc = host(), name = state.prop.title, shown = row.value.shown || row.value.title;
  const pill = pillsOf(state.uuid).find(p => pillName(p) === name.toLowerCase());
  const g = doc.createElement('span');
  g.className = 'rip-ghost';
  g.setAttribute('contenteditable', 'false');
  g.innerHTML = `${pill ? '' : `<span class="rip-ghost-name">${escapeHtml(name)}:</span>`}<span class="rip-ghost-value">${escapeHtml(shown)}</span>`;
  if (pill) { pill.setAttribute('data-rip-ghost', ''); (pill.querySelector('.bottom-property-content') || pill).appendChild(g); }
  else state.menu?.querySelector('.rip-head')?.appendChild(g);
}

/* Reading the editor: on every input and caret move in a block's text box. */
async function check(box) {
  if (!setting('inlineProps') || state.allowed === false) return closeMenu();
  if (!box?.matches?.('textarea') || !box.closest('.ls-block[blockid]')) return closeMenu();
  if (state.allowed === null) { state.allowed = await graphNamedIn(setting('inlinePropsGraphs')); if (!state.allowed) return; }
  if (state.dismissed !== null) { if (box.value === state.dismissed) return closeMenu(); state.dismissed = null; }
  const version = ++state.version;
  let token;
  try { token = await tokenAt(box); } catch (error) { warnOnce('the token could not be read', error); return closeMenu(); }
  if (version !== state.version) return;
  if (!token || !box.isConnected) return closeMenu();
  const uuid = box.closest('.ls-block[blockid]').getAttribute('blockid');
  // The schema is read again every 30 s, so a property is the same by its ident, not its object.
  const changed = state.stage !== token.stage || state.prop?.ident !== token.prop?.ident || state.uuid !== uuid || state.name !== token.name;
  Object.assign(state, { box, uuid, stage: token.stage, prop: token.prop, name: token.name, prefix: token.prefix || '', filter: token.filter, start: token.start });
  let rows;
  try {
    rows = token.stage === 'name' ? await nameRows(token.filter, state.prefix)
      : token.stage === 'value' ? await valueRows(token.prop, token.filter)
      : unknownRows(token.name);
  } catch (error) { warnOnce('the rows could not be built', error); return closeMenu(); }
  if (version !== state.version) return;
  if (!box.isConnected && !ownBox(host().activeElement)) return closeMenu();
  if (changed) { state.sel = 0; state.gather = false; }
  if (state.gather) { if (!token.filter.trim()) state.sel = -1; rows.push({ kind: 'info', label: 'Enter with nothing typed finishes' }); }
  else if (token.stage === 'value' && !rows.some(selectable)) rows.push({ kind: 'info', label: `nothing matches “${token.filter.trim()}” · Esc takes the token out` });
  state.rows = rows;
  renderMenu();
}

/* Writing. The token leaves the text first (through the editor, so Logseq's own undo keeps it), then the property
   is written, then the bar offers Undo. */
function replaceRange(box, start, end, text) {
  box.focus();
  box.setSelectionRange(start, end);
  const doc = box.ownerDocument;
  const ok = text ? doc.execCommand?.('insertText', false, text) : doc.execCommand?.('delete');
  if (!ok) { box.setRangeText(text, start, end, 'end'); box.dispatchEvent(new doc.defaultView.Event('input', { bubbles: true })); }
}
function removeToken() {
  const box = state.box, value = box.value;
  let start = state.start;
  while (start > 0 && /\s/.test(value[start - 1])) start--;
  replaceRange(box, start, box.selectionStart, '');
}
async function journalIdFor(day, title) {
  const [[p] = []] = await dsQuery(`[:find (pull ?p [:db/id]) :where [?p :block/journal-day ${day}]]`);
  if (p && idOf(p)) return idOf(p);
  const page = await logseq.Editor.createPage(title, {}, { redirect: false, createFirstBlock: false, journal: true });
  return page?.id ?? null;
}
async function currentValues(uuid, ident) {
  return (await dsQuery(`[:find ?v :where [?b :block/uuid #uuid "${uuid}"] [?b :${ident} ?v]]`)).map(([v]) => idOf(v) ?? v);
}
// Writes one value by the property's type; returns the undo.
async function writeValue(prop, value, uuid) {
  const { ident } = prop;
  const remove = () => logseq.Editor.removeBlockProperty(uuid, ident);
  if (prop.type === 'date') {
    const id = await journalIdFor(value.day, value.title);
    if (!id) throw new Error('no journal page for that day');
    await logseq.Editor.upsertBlockProperty(uuid, ident, id);
    return remove;
  }
  if (prop.type === 'datetime') { await logseq.Editor.upsertBlockProperty(uuid, ident, value.when.getTime()); return remove; }
  if (prop.type === 'node' || (prop.type === 'default' && value.id)) {
    if (prop.many) {
      const before = await currentValues(uuid, ident);
      const next = [...new Set([...before, value.id])];
      await logseq.Editor.upsertBlockProperty(uuid, ident, next, { entityId: true, reset: true });
      return () => before.length ? logseq.Editor.upsertBlockProperty(uuid, ident, before, { entityId: true, reset: true }) : remove();
    }
    await logseq.Editor.upsertBlockProperty(uuid, ident, value.id, { entityId: true });
    return remove;
  }
  if (prop.type === 'number') { await logseq.Editor.upsertBlockProperty(uuid, ident, value.number); return remove; }
  if (prop.type === 'checkbox') { await logseq.Editor.upsertBlockProperty(uuid, ident, value.bool); return remove; }
  await logseq.Editor.upsertBlockProperty(uuid, ident, value.text);
  return remove;
}
async function makePage(prop, title, cls) {
  const page = await logseq.Editor.createPage(title, {}, { redirect: false, createFirstBlock: false });
  if (!page) throw new Error('the page could not be made');
  if (cls?.uuid) await logseq.Editor.addBlockTag(page.uuid, cls.uuid).catch(error => warnOnce('the new page could not get its tag', error));
  return { id: page.id, uuid: page.uuid, title };
}
async function blockWords(uuid) {
  const block = await logseq.Editor.getBlock(uuid).catch(() => null);
  return String(block?.title ?? block?.content ?? '').split('\n')[0].replace(/#?\[\[[0-9a-f-]{36}\]\]/gi, '').trim();
}
async function pickSelected() {
  const row = state.rows[state.sel];
  if (!row || !selectable(row)) return;
  const box = state.box;
  if (row.kind === 'prop') {
    // "p::fi" becomes "title::" and the list turns into values; letters that named no field carry over as the value (0.4.120).
    replaceRange(box, state.start, box.selectionStart, `${row.prop.title}::${row.carry || ''}`);
    return;
  }
  const prop = state.prop, uuid = state.uuid;
  let value = row.value;
  // A field that takes several pages keeps its list open (0.4.98): only the letters leave the text, the token stays.
  const gather = setting('inlinePropsGather') && prop.type === 'node' && prop.many && row.kind !== 'make-page';
  try {
    if (gather) { state.gather = true; state.sel = -1; replaceRange(box, box.selectionStart - state.filter.length, box.selectionStart, ''); }
    else removeToken();
    if (row.kind === 'make-page') value = await makePage(prop, value.title, value.cls);
    const undoValue = await writeValue(prop, value, uuid);
    const made = row.kind === 'make-page' ? value : null;
    // The text box already lacks the token; the saved block may still carry it for a moment.
    const words = shorten((gather ? box.value.slice(0, state.start) : box.value).trim().split('\n')[0] || await blockWords(uuid));
    if (!gather) closeMenu();
    const undoAll = async () => {
      await undoValue();
      if (made) await logseq.Editor.deletePage(made.title).catch(error => warnOnce('the new page could not be removed again', error));
    };
    const onFail = error => { warnOnce('the value could not be taken off again', error); notify('The value could not be taken off again', 'warning'); };
    // The quiet undo beside the value (0.4.121, parts/proposals.js), else the bar at the bottom.
    if (undoBeside) undoBeside(uuid, prop.ident, prop.title, `${prop.title}: ${value.shown || value.title}`, undoAll, onFail);
    else showUndoBar(`${prop.title}: ${value.shown || value.title} set on “${words || 'this block'}”`, undoAll, onFail);
    if (box.isConnected) box.focus();
  } catch (error) {
    warnOnce('the value could not be written', error);
    notify(`Could not set ${prop.title}: ${error?.message || error}`, 'warning');
    closeMenu();
  }
}
/* Keys while the list is open: Up and Down move, Enter picks, Escape closes and keeps you in the block; everything
   else goes to the editor and refines the filter. Listened to before Logseq does. */
// The text box of the block the list belongs to; Logseq swaps the box while it redraws, so the block decides.
function ownBox(el) {
  return !!el?.matches?.('textarea') && el.closest('.ls-block[blockid]')?.getAttribute('blockid') === state.uuid;
}
function onKey(event) {
  if (!state.menu?.isConnected || !ownBox(event.target)) return;
  state.box = event.target;
  if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
  const rows = state.rows;
  const move = dir => { let i = state.sel < 0 ? (dir > 0 ? -1 : rows.length) : state.sel; for (let n = 0; n < rows.length; n++) { i = (i + dir + rows.length) % rows.length; if (selectable(rows[i])) { state.sel = i; break; } } renderMenu(); };
  const stop = () => { event.preventDefault(); event.stopImmediatePropagation(); };
  // Gathering with nothing chosen: Enter (or Escape) finishes and takes the token out.
  const finishing = state.gather && (event.key === 'Escape' || (event.key === 'Enter' && state.sel < 0));
  if (event.key === 'ArrowDown') { stop(); move(1); }
  else if (event.key === 'ArrowUp') { stop(); move(-1); }
  else if (finishing) { stop(); removeToken(); closeMenu(); }
  else if (event.key === 'Enter' && rows.some(selectable)) { stop(); pickSelected(); }
  // Enter with nothing to pick does nothing (0.4.106): it used to reach Logseq, which split the block and saved the token.
  else if (event.key === 'Enter') { stop(); }
  // Escape closes the list and keeps you in the block. With the token taken out (0.4.99), Cmd+Z brings it back;
  // without, it stays as typed and is not asked about again until the text changes.
  else if (event.key === 'Escape') { stop(); if (clearsOnLeave()) removeToken(); else state.dismissed = state.box.value; closeMenu(); }
  // Tab closes the list and takes the token out, and does nothing else (0.4.120): before, Logseq indented the block
  // or the proposals part wrote its values in the same press.
  else if (event.key === 'Tab') { stop(); if (clearsOnLeave()) removeToken(); closeMenu(); }
}
const clearsOnLeave = () => setting('inlinePropsEscapeClears');
/* Escape takes [[ or # out of Logseq's own pickers (0.4.106; setting pickerEscapeClears in main.js): the key meant
   "never mind", yet a [[Name]] or #Name left in the text became a page or a tag when the block was saved (seen
   2026-10-17: [[Pri, Escape, Escape made the page Pri). The letters leave through the editor, so Cmd+Z brings them
   back; a new page or tag is made only through the picker's own New row. Logseq's own Escape then closes the picker. */
const PICKER_POPUPS = '[data-editor-popup-ref="page-search"], [data-editor-popup-ref="page-search-hashtag"]';
function onPickerEscape(event) {
  if (event.key !== 'Escape' || event.isComposing || !coreSetting('pickerEscapeClears')) return;
  const box = event.target;
  if (!box?.matches?.('textarea') || !box.closest('.ls-block[blockid]')) return;
  const popup = host().querySelector(PICKER_POPUPS);
  if (!popup) return;
  const caret = box.selectionStart;
  if (caret !== box.selectionEnd) return;
  const before = box.value.slice(0, caret), after = box.value.slice(caret);
  let m;
  if (popup.dataset.editorPopupRef === 'page-search' && (m = before.match(/\[\[([^\[\]\n]*)$/))) replaceRange(box, caret - m[0].length, caret + (after.startsWith(']]') ? 2 : 0), '');
  else if (popup.dataset.editorPopupRef === 'page-search-hashtag' && (m = before.match(/(?:^|\s)(#[^\s#]*)$/))) replaceRange(box, caret - m[1].length, caret, '');
}
// A press outside the list and the block while the list is open (0.4.99): the token leaves the text before the
// block loses the caret, so the block is never saved with p:: or name:: in it.
function onPointerDown(event) {
  if (!state.menu?.isConnected || !clearsOnLeave()) return;
  if (state.menu.contains(event.target) || event.target === state.box) return;
  removeToken(); closeMenu();
}
let checkTimer = 0;
function onEditorChange(event) {
  const box = event.target;
  if (!box?.matches?.('textarea')) return;
  clearTimeout(checkTimer);
  checkTimer = setTimeout(() => check(box), 40);
}
function onFocusOut(event) {
  if (!state.menu?.isConnected || !ownBox(event.target)) return;
  setTimeout(() => { if (!ownBox(host().activeElement)) closeMenu(); }, 120);
}

const menuCss = `
.rip-menu { position: fixed; z-index: 10001; min-width: 260px; max-width: 380px; max-height: 300px; overflow-y: auto; padding: 4px 0; border: 1px solid var(--ls-border-color); border-radius: 8px; background: var(--ls-primary-background-color); color: var(--ls-primary-text-color); box-shadow: 0 6px 20px rgba(0, 0, 0, .14); font-size: .9em; }
.rip-head { display: flex; align-items: baseline; gap: 8px; padding: 4px 12px 5px; border-bottom: 1px solid var(--ls-border-color); margin-bottom: 3px; }
.rip-head-name { font-weight: 500; }
.rip-head-type { font-size: var(--rf-small, .82em); color: var(--ls-secondary-text-color); }
.rip-row { display: flex; align-items: baseline; gap: 8px; padding: 3px 12px; cursor: pointer; white-space: nowrap; }
.rip-row.rip-sel { background: color-mix(in srgb, var(--ls-primary-text-color) var(--rf-wash-pct, 8%), transparent); }
.rip-row.rip-info { color: var(--ls-secondary-text-color); cursor: default; font-size: var(--rf-small, .82em); padding-top: 5px; }
.rip-glyph { flex: 0 0 1.1em; display: inline-flex; justify-content: center; align-items: center; align-self: center; color: var(--ls-secondary-text-color); }
.rip-ic { width: 1em; height: 1em; opacity: var(--rf-quiet, .7); }
.rip-ic.rip-page { opacity: var(--rf-quiet, .7); }
.rip-ic.rip-hash { color: var(--rf-tag-color); opacity: 1; }
.rip-own { display: inline-flex; } .rip-own svg { width: 1em; height: 1em; }
.rip-emoji { font-size: .95em; line-height: 1; }
.rip-day { flex: 0 0 auto; margin-left: auto; font-size: var(--rf-small, .82em); font-variant-numeric: tabular-nums; padding: 0 .3em; border-radius: 3px; background: color-mix(in srgb, var(--ls-primary-text-color) var(--rf-wash-pct, 8%), transparent); }
.rip-label { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; }
/* Monospace is for tag names only (0.4.113): a kind at the right is one, a type or a count is not. */
.rip-right.rip-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.rip-right { flex: 0 0 auto; margin-left: auto; font-size: var(--rf-small, .82em); color: var(--ls-secondary-text-color); font-variant-numeric: tabular-nums; }
/* Why a row is first (0.4.118): "in your words", "from the parent", "the journal day", in plain quiet words before the kind. */
.rip-why { flex: 0 0 auto; margin-left: auto; font-size: var(--rf-small, .82em); color: var(--ls-secondary-text-color); }
.rip-why + .rip-right, .rip-why + .rip-day { margin-left: .6em; }
.rip-why + .rip-right::before { content: '· '; opacity: var(--rf-faint, .5); }
/* One pencilled value per pill (0.4.118): while the list's ghost sits in a pill, the proposal's ghost there steps aside. */
.bottom-property-pill[data-rip-ghost] .rfp-ghost { display: none !important; }
/* A row that makes something is pencilled in (0.4.116): italic in the quiet colour, no box, the + before it. */
.rip-new { font-style: italic; color: var(--ls-secondary-text-color); }
.rip-ghost { display: inline-flex; align-items: baseline; gap: .35em; margin-left: .45em; font-size: .95em; }
.bottom-property-content > .rip-ghost { margin-left: 0; }
.rip-ghost-name { color: var(--ls-secondary-text-color); }
.rip-ghost-value { font-style: italic; padding: .02em .1em; color: var(--ls-secondary-text-color); font-variant-numeric: tabular-nums; }
.ls-block .positioned-properties.block-below .bottom-property-pill[data-rip-ghost] { display: flex !important; opacity: 1 !important; }
.bottom-property-pill[data-rip-ghost] .empty-value { display: none !important; }`;

// The marks and the schema, for the pickers the links part marks and the link box's list (0.4.101).
function provide(core) {
  core.provide({ propSchema: () => graphWide('inlinePropsSchema', loadSchema), propPages: () => graphWide('inlinePropsPages', loadPages), inlinePropsSetting: setting,
    propTypeIcon: typeIcon, propTypeLabel: typeLabel, propPageIcon: pageIcon, ripSvg: svg, ripRowHtml: rowHtml,
    parseDay, dayNumber, journalIdFor /* the day reader and the journal page, for a day in the words (parts/proposals.js, 0.4.122) */ });
}
function start() {
  const core = window.refinementCore;
  ({ dsQuery, graphWide, journalTitleFor, setting: coreSetting, proposalsFor, undoBeside } = take(core, ['dsQuery', 'graphWide', 'journalTitleFor', 'setting', 'proposalsFor', 'undoBeside']));
  takeOverFromEarlierCopy();
  logseq.provideStyle({ key: 'refinements-inline-props', style: menuCss });
  const win = host().defaultView;
  listen(win, ['keydown'], onKey);
  listen(win, ['keydown'], onPickerEscape);
  listen(win, ['input', 'keyup', 'click'], onEditorChange);
  listen(win, ['focusout'], onFocusOut);
  listen(win, ['pointerdown'], onPointerDown); // pointerdown: Logseq takes the editor away before mousedown fires (seen 2026-10-17)
  onUnload(logseq.App.onRouteChanged(() => { state.allowed = null; closeMenu(); }));
  onUnload(logseq.onSettingsChanged(() => { state.allowed = null; }));
  onUnload(() => { clearTimeout(checkTimer); closeMenu(); });
  window.inlinePropsDebug = { state, loadSchema, loadPages, parseDay, tokenAt };
}
(window.refinementParts ||= []).push({ name: 'inline properties', schema: settingsSchema, provide, start, stop: runUnloadTasks });
})();
