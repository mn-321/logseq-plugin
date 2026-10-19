/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Two-way links part of DB Refinements (0.4.137). A link made by a field reads the same from both ends.
   On the record that holds the field it is a property row, "report: Chest X-ray 2026-08-03". On the page it
   points to, Logseq lists the record under a tab named after the record's tag ("Appointment"), below the
   page's own blocks, so nothing there says how the two belong together. This part draws the far end as a
   row in the page's own property list, with grey names like any property's (0.4.141), read-only:
     ← report of    Chest X-ray Aug 3 · Appointment
     ← doctor of    9 Appointments · next Nov 12 ▾   (opens into the list of those records)
   One row per field that points here, named by the field read backwards ("doctor" → "doctor of", "prescribed
   by" → "prescribed", or a name from the twoWayNames setting). Up to three records show inline; more become
   a count with the nearest date, which opens into the list (open to begin with, as asked: "the details …
   should by default be unfolded"). Only your own Node properties count; tags, aliases and mentions in
   sentences stay in Linked references. Drawn for the page in the main view only (sidebar and records inside
   a page are open questions, see the "Two-Way Links" sketch). Nothing is written. */
const shared = window.refinementShared;
const { host, openEntity } = shared;
const { warnOnce, onUnload, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (two-way): ' });

const settingsSchema = [
  { key: 'twoWayHeading', type: 'heading', title: 'Two-way links', default: null,
    description: 'Changes here apply right away.' },
  { key: 'twoWayRows', type: 'boolean', title: 'Links read the same from both ends', default: true,
    description: 'On a page that one of your fields points to (a doctor named as the “doctor” of visits, a report named as the “report” of a scan), each such field becomes a row in the page’s own property list, with an arrow before its name: “← doctor of   9 Appointments · next Nov 12”. Up to three records show by name; more show as a count that opens into the list. Click a record to open it (Shift-click: in the sidebar). The rows are read-only: change the link on the record that holds the field.' },
  { key: 'twoWayNames', type: 'string', title: 'Fields read backwards', default: 'symptoms = logged in; ask = asked; works at = works here; insurer = insurer of; related = related to',
    description: 'How a field’s name reads from the other end, as “field = words; field = words”. A field not listed reads as “field of”, and a field ending in “by” loses it (“prescribed by” reads “prescribed”).' },
  { key: 'openPropertyRows', type: 'boolean', title: 'Property rows open', default: true,
    description: 'The row of properties under a record wraps onto more lines instead of being cut off at the right edge, so every field shows.' },
];
const setting = shared.settingReader(settingsSchema);
let UUID, isEntityId, watchDom, sendStyle, titleOf, provided;
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };
const esc = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// What is known about the page on screen: its uuid and one group per field that points at it.
const state = window.refinementTwoWay = { version: 0, pageUuid: '', groups: [], open: new Map(), all: new Set(), box: null, html: '' };
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
const BUILT_IN = [['ask', 'asked'], ['symptoms', 'logged in'], ['works at', 'works here'], ['related', 'related to'], ['attendees', 'attended']];
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
  state.html = '';
  draw(host());
}
async function groupsFor(id) {
  const links = await logseq.DB.datascriptQuery(`[:find ?b ?attr ?name
    :where [(identity ${id}) ?page]
    [?b ?attr ?page]
    [?prop :db/ident ?attr]
    [?prop :block/title ?name]
    [(not= ?b ?page)]
    (not [?b :block/page ?page])
    ${LIVE}]`) || [];
  const byField = new Map(), ids = new Set();
  for (const [b, attr, name] of links) {
    // Only properties you made; built-in links such as tags, aliases and parents are left out.
    if (!isEntityId(b) || !name || !/^:?user\.property\//.test(String(attr))) continue;
    if (!byField.has(name)) byField.set(name, new Set());
    byField.get(name).add(b);
    ids.add(b);
  }
  if (!ids.size) return [];
  const list = [...ids].join(' '), these = `[(identity [${list}]) [?b ...]]`;
  // Plain finds (a pull here was refused by Logseq's query call: "Extra inputs passed").
  const [titled, tagged, dated, written] = await Promise.all([
    logseq.DB.datascriptQuery(`[:find ?b ?uuid ?title :where ${these} [?b :block/uuid ?uuid] [?b :block/title ?title]]`),
    logseq.DB.datascriptQuery(`[:find ?b ?tag :where ${these} [?b :block/tags ?t] [?t :db/ident ?ti] [(namespace ?ti) ?ns] [(= ?ns "user.class")] [?t :block/title ?tag]]`),
    // A record's own date: a date field of yours (the one named "date" first), else the journal day it is written on.
    logseq.DB.datascriptQuery(`[:find ?b ?attr ?day :where ${these} [?prop :logseq.property/type :date] [?prop :db/ident ?attr] [?b ?attr ?d] [?d :block/journal-day ?day]]`),
    logseq.DB.datascriptQuery(`[:find ?b ?day :where ${these} [?b :block/page ?p] [?p :block/journal-day ?day]]`),
  ]);
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
  for (const [b, uuid, raw] of titled || []) {
    if (!isEntityId(b)) continue;
    let title = raw || '';
    try { title = await provided.readableTitle(title); } catch { /* the stored words, then */ }
    title = String(title).replace(/\s+#(?:\[\[[^\]]*\]\]|[^\s#\[\]]+)/g, '').trim() || 'Untitled';
    records.set(b, { uuid: String(uuid), title, tag: tags.get(b) || 'note', day: days.get(b)?.day || 0 });
  }
  const names = backwardsNames(), today = todayNumber();
  const groups = [];
  for (const [name, set] of byField) {
    const items = [...set].map(b => records.get(b)).filter(item => item && UUID.test(item.uuid));
    if (!items.length) continue;
    // Coming up first (nearest first), then the past (latest first), then records with no date.
    items.sort((a, b) => (a.day >= today ? 0 : a.day ? 1 : 2) - (b.day >= today ? 0 : b.day ? 1 : 2) ||
      (a.day >= today ? a.day - b.day : b.day - a.day) || a.title.localeCompare(b.title));
    groups.push({ name, label: readBackwards(name, names), items });
  }
  groups.sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
  return groups;
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
const recordLink = item => `<a class="rf-tw-record" data-uuid="${esc(item.uuid)}" href="#">${esc(item.title)}</a>`;
function rowHtml(group) {
  const key = `${state.pageUuid}|${group.name}`;
  const name = `<div class="rf-tw-name" title="“${esc(group.name)}” on the records listed here points to this page. Change it on the record."><span class="rf-tw-arrow">←</span>${esc(group.label)}</div>`;
  if (group.items.length <= INLINE) {
    const values = group.items.map(item => `<span class="rf-tw-item">${recordLink(item)}${item.day ? `<span class="rf-tw-day">${esc(dayText(item.day))}</span>` : ''}<span class="rf-tw-tag">${esc(item.tag)}</span></span>`).join('');
    return `<div class="rf-tw-row" data-field="${esc(group.name)}">${name}<div class="rf-tw-value">${values}</div></div>`;
  }
  const open = state.open.get(key) ?? true, all = state.all.has(key);
  const shown = all ? group.items : group.items.slice(0, LISTED);
  const list = open ? `<div class="rf-tw-list">${shown.map(item => `<div class="rf-tw-line"><span class="rf-tw-day">${esc(dayText(item.day))}</span>${recordLink(item)}<span class="rf-tw-tag">${esc(item.tag)}</span></div>`).join('')}${
    group.items.length > shown.length ? `<a class="rf-tw-more" data-key="${esc(key)}" href="#">show all ${group.items.length}</a>` : ''}</div>` : '';
  return `<div class="rf-tw-row" data-field="${esc(group.name)}"${open ? ' data-open=""' : ''}>${name}<div class="rf-tw-value"><a class="rf-tw-toggle" data-key="${esc(key)}" href="#">${esc(summary(group.items))}<span class="rf-tw-chevron"></span></a></div>${list}</div>`;
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
function draw(doc) {
  if (!doc) return;
  const anchor = state.groups.length && setting('twoWayRows') ? anchorFor(doc) : null;
  // The rows belong to the page they were read for; a page drawn before its look-up finishes gets none yet.
  const shown = [...doc.querySelectorAll('#main-content-container :is(.ls-page-title, .page-title) .ls-block[blockid]')].map(el => el.getAttribute('blockid'));
  if (!anchor || (shown.length && !shown.includes(state.pageUuid))) { state.box?.remove(); return; }
  let box = state.box;
  if (!box || box.ownerDocument !== doc) {
    box = state.box = doc.createElement('div');
    box.className = 'refinement-two-way';
    box.setAttribute('contenteditable', 'false');
    box.addEventListener('mousedown', event => event.stopPropagation());
    box.addEventListener('click', onClick);
    state.html = '';
  }
  const html = state.groups.map(rowHtml).join('');
  if (state.html !== html) { state.html = html; box.innerHTML = html; }
  if (anchor.nextElementSibling !== box) anchor.after(box);
}
function onClick(event) {
  const target = event.target.closest?.('a');
  if (!target) return;
  event.preventDefault(); event.stopPropagation();
  if (target.matches('.rf-tw-record')) return openEntity(target.dataset.uuid, event.shiftKey);
  const key = target.dataset.key;
  if (target.matches('.rf-tw-toggle')) state.open.set(key, !(state.open.get(key) ?? true));
  else if (target.matches('.rf-tw-more')) state.all.add(key);
  draw(host());
}

const twoWayCss = `
/* Under the page's own properties, on the same light field: these rows are the far end of a field held by other
   records, so they read like properties but are not this page's own; the ← before the name says so. The names are
   the grey of every property name and the days plain grey words (0.4.141, the owner's pick: no blue, no date box).
   Sizes and columns are Logseq's own property rows above, as measured in 2.0.2 (0.4.144): the text at the page's
   size (the names .94 of it, as theirs), a 150px name column, a 12px gap, the values 22px in where theirs start
   after their bullet, 28px rows; the ← sits where their property icon does, 15px and a 4px gap before the name. */
.refinement-two-way {
  --rf-tw-accent: var(--ls-secondary-text-color, currentColor);
  margin: .15rem 0 .6rem -.5rem; padding: .3rem .9rem .3rem .5rem;
  background: color-mix(in srgb, var(--ls-primary-text-color, currentColor) var(--rf-field-pct, 3%), transparent);
  line-height: 1.5; user-select: text;
}
.refinement-two-way .rf-tw-row { display: grid; grid-template-columns: minmax(150px, max-content) 1fr; column-gap: 12px; padding: 2px 0; }
.refinement-two-way .rf-tw-name { color: var(--rf-tw-accent); font-size: var(--rf-name, .94em); white-space: nowrap; cursor: default; }
.refinement-two-way .rf-tw-arrow { display: inline-block; width: 19px; opacity: .85; }
.refinement-two-way .rf-tw-value { min-width: 0; padding-left: 22px; display: flex; flex-wrap: wrap; column-gap: 1.1em; }
.refinement-two-way a { color: inherit; text-decoration: none; cursor: pointer; }
.refinement-two-way .rf-tw-line a.rf-tw-record { justify-self: start; }
.refinement-two-way a.rf-tw-record { border-bottom: 1px solid color-mix(in srgb, currentColor var(--rf-line-pct, 26%), transparent); }
.refinement-two-way a.rf-tw-record:hover { border-bottom-color: currentColor; }
.refinement-two-way .rf-tw-day { margin-left: .45em; color: var(--ls-secondary-text-color); font-size: var(--rf-small, .82em); font-variant-numeric: tabular-nums; }
.refinement-two-way .rf-tw-tag { margin-left: .5em; color: var(--ls-secondary-text-color); opacity: var(--rf-quiet, .7); font-size: var(--rf-small, .82em); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.refinement-two-way .rf-tw-toggle:hover { color: var(--ls-primary-text-color, currentColor); }
.refinement-two-way .rf-tw-chevron { display: inline-block; width: 7px; height: 8px; margin-left: .45em; background: currentColor; opacity: var(--rf-faint, .5);
  clip-path: polygon(0 0, 100% 50%, 0 100%); transition: transform .16s ease; }
.refinement-two-way .rf-tw-row[data-open] .rf-tw-chevron { transform: rotate(90deg); }
/* The list a count opens into: date, record, tag, one per line, under the value. */
.refinement-two-way .rf-tw-list { grid-column: 2; margin: .1rem 0 .25rem 22px; border-left: 1px solid color-mix(in srgb, var(--rf-tw-accent) 35%, transparent); padding-left: .6rem; }
.refinement-two-way .rf-tw-line { display: grid; grid-template-columns: 3.6em minmax(0, 1fr) auto; column-gap: .5em; align-items: baseline; }
.refinement-two-way .rf-tw-line .rf-tw-day { margin-left: 0; }
.refinement-two-way .rf-tw-more { display: inline-block; margin-top: .1rem; color: var(--ls-secondary-text-color); font-size: var(--rf-small, .82em); }
.refinement-two-way .rf-tw-more:hover { color: var(--ls-primary-text-color, currentColor); }
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
function applyStyles() {
  sendStyle('refinement-two-way', setting('twoWayRows') ? twoWayCss : '');
  sendStyle('refinement-open-property-rows', setting('openPropertyRows') ? openRowsCss : '');
}

let timer = 0;
const later = (ms = 600) => { clearTimeout(timer); timer = setTimeout(() => load().catch(error => warnOnce('could not refresh the two-way rows', error)), ms); };
function start() {
  ({ UUID, isEntityId, watchDom, sendStyle, titleOf, provided } = take(window.refinementCore, ['UUID', 'isEntityId', 'watchDom', 'sendStyle', 'titleOf', 'provided']));
  applyStyles();
  watchDom(draw);
  onUnload(logseq.App.onRouteChanged(() => { state.box?.remove(); later(150); }));
  onUnload(logseq.DB.onChanged(() => later(900)));
  onUnload(logseq.onSettingsChanged((now, before) => {
    if (settingsSchema.some(item => now?.[item.key] !== before?.[item.key])) { applyStyles(); later(0); }
  }));
  onUnload(() => { clearTimeout(timer); state.box?.remove(); state.box = null; });
  later(0);
}
(window.refinementParts ||= []).push({ name: 'two-way', schema: settingsSchema, start, stop: runUnloadTasks });
})();
