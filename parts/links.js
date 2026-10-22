/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Links part of DB Refinements (moved out of main.js in the October 2026 cleanup): what the plugin
   draws on links and rows from what the database says. The cue marks (block links, labelled links,
   tag pages, "via …" labels), date links and date headings, page labels without trailing tags,
   reference rows and counts, the parent-path links, the PDF citations, the child asset cues, the
   "points here" marks under Linked references, the links inside a reference, and the refresh that
   reads the page's tree after a change (refreshCues). It provides its start functions, updaters,
   look-ups and state to the core and the other parts; it takes pageKind, pageTitles and readableTitle
   from the pages and editor parts, the list and crumb state from the properties part, and the
   cue selectors and wash from the core (the styles area). */
const shared = window.refinementShared;
const { host, notify, openEntity, perf } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements: ',
  leaves: { elements: '.refinement-child-assets, .refinement-usage, .refinement-prop-icon, .refinement-value-icon',
    attributes: ['ref-row', 'date', 'date-heading', 'tag-page', 'pdf', 'pdf-line', 'pdf-citation-block', 'citation', 'block-link', 'prop-label', 'via', 'via-value', 'ref-count', 'here', 'below',
      'mention', 'tense', 'usage-dim', 'pick', 'pick-tags', 'prop', 'prop-type', 'value', 'value-kind', 'value-day'].map(name => 'data-refinement-' + name) } });
// From the core and the other parts, taken when the part starts (after every part has provided its own).
let setting, dsQuery, storedRef, titleOf, trailingTags, UUID, isEntityId, idsIn, uuidsIn, graphWide, watchDom, watchDomEarly, addsElements, sendStyle, PAGE_TITLE, REFERENCE_AREAS, referenceAreas, wash, applyTagPageStyle, blockLink, blockLinkPlain, viaLook;
let provided, escapeHtml;
// A name may be the core's own or one another part provided; a missing one is a broken contract.
const take = (core, names) => shared.take(core, names, warnOnce);

/* Current-page descendant types change the existing bullet shape. */
const attribute = (node, ident, legacy) => node[ident] ?? node[':' + ident] ??
  node.properties?.[ident] ?? node.properties?.[':' + ident] ?? node.properties?.[legacy];
const entityLabel = value => String(value?.ident || value?.['db/ident'] || value?.[':db/ident'] ||
  value?.title || value?.name || value || '').replace(/^:/, '').toLowerCase();
const tagsInclude = (node, name) => (node.tags || node['block/tags'] || node[':block/tags'] || []).some(tag => {
  const label = entityLabel(tag);
  return label === name || label === 'logseq.class/' + name;
});
const ownKinds = (node, metadata) => {
  const title = titleOf(node);
  const status = attribute(node, 'logseq.property/status', 'status') ?? node.marker;
  const label = entityLabel(status).replace(/^logseq\.property\/status\./, '');
  const completed = /^(done|canceled|cancelled)$/.test(label) ||
    attribute(status || {}, 'logseq.property/choice-checkbox-state') === true;
  const typed = metadata?.get(node.uuid);
  return {
    task: typed?.task ?? (!completed && Boolean(status || tagsInclude(node, 'task'))),
    asset: Boolean(typed?.asset || attribute(node, 'logseq.property/asset', 'asset') || attribute(node, 'logseq.property.asset/type', 'asset/type') || tagsInclude(node, 'asset') ||
      /!\[[^\]]*\]\([^)]*\)|(?:^|[\s(])(?:assets\/|\.\/assets\/)/i.test(title))
  };
};
// What sits below a block: unfinished tasks and files at any depth (shown always), and, for a folded block,
// the kinds inside (the owner's own tags, counted) and the nearest due day of an unfinished task.
function summarize(node, badges, metadata, assetTypes, inside) {
  const own = ownKinds(node, metadata);
  const descendants = { task: 0, asset: 0, assetTypes: new Set(), tags: new Map(), due: 0 };
  for (const child of node.children || []) {
    if (!child || Array.isArray(child)) continue;
    const kinds = summarize(child, badges, metadata, assetTypes, inside);
    descendants.task += kinds.task;
    for (const [title, n] of kinds.tags) descendants.tags.set(title, (descendants.tags.get(title) || 0) + n);
    if (kinds.due && (!descendants.due || kinds.due < descendants.due)) descendants.due = kinds.due;
    const types = assetTypes.get(child.uuid);
    if (ownKinds(child, metadata).asset || types?.size) {
      descendants.asset++;
      for (const type of types || ['asset']) descendants.assetTypes.add(type);
    }
  }
  if (UUID.test(node.uuid || '') && (descendants.task || descendants.asset || descendants.tags.size || descendants.due))
    badges.set(node.uuid, descendants);
  const tags = new Map(descendants.tags);
  for (const title of inside?.tags.get(String(node.uuid)) || []) tags.set(title, (tags.get(title) || 0) + 1);
  const ownDue = own.task ? inside?.due.get(String(node.uuid)) || 0 : 0;
  const due = ownDue && (!descendants.due || ownDue < descendants.due) ? ownDue : descendants.due;
  return { task: Number(own.task) + descendants.task, asset: Number(own.asset) + descendants.asset, tags, due };
}
// For every block on the page: its own tags (the owner's, by title; Logseq's own classes such as Task are
// left out) and its due day (Deadline, else Scheduled), as the journal day number.
async function descendantKinds(tree) {
  const ids = treeIds(tree);
  const result = { tags: new Map(), due: new Map() };
  if (!ids.length || !logseq.DB?.datascriptQuery) return result;
  try {
    const tagRows = await logseq.DB.datascriptQuery(`[:find ?uuid ?title ?ident
      :where ${idsIn('?b', ids)} [?b :block/uuid ?uuid] [?b :block/tags ?t] [?t :block/title ?title] [(get-else $ ?t :db/ident :none) ?ident]]`);
    for (const [uuid, title, ident] of tagRows || []) {
      if (/^:?logseq\.class\//.test(String(ident))) continue;
      const key = String(uuid);
      if (!result.tags.has(key)) result.tags.set(key, []);
      result.tags.get(key).push(String(title));
    }
    const dueRows = await logseq.DB.datascriptQuery(`[:find ?uuid ?day
      :where ${idsIn('?b', ids)} [?b :block/uuid ?uuid]
      (or-join [?b ?day] (and [?b :logseq.property/deadline ?d] [?d :block/journal-day ?day]) (and [?b :logseq.property/scheduled ?d] [?d :block/journal-day ?day]))]`);
    for (const [uuid, day] of dueRows || []) {
      const key = String(uuid), n = Number(day);
      if (Number.isFinite(n) && (!result.due.has(key) || n < result.due.get(key))) result.due.set(key, n);
    }
    // A Deadline or Scheduled of the Date-and-time kind is a timestamp, not a journal page (0.4.108; a ref is a small
    // entity id, a timestamp is past 1e11, so the comparison tells them apart without a type predicate).
    const stampRows = await logseq.DB.datascriptQuery(`[:find ?uuid ?ms
      :where ${idsIn('?b', ids)} [?b :block/uuid ?uuid] (or [?b :logseq.property/deadline ?ms] [?b :logseq.property/scheduled ?ms]) [(> ?ms 100000000000)]]`);
    for (const [uuid, ms] of stampRows || []) {
      const key = String(uuid), d = new Date(Number(ms));
      if (Number.isNaN(d.getTime())) continue;
      const n = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
      if (!result.due.has(key) || n < result.due.get(key)) result.due.set(key, n);
    }
  } catch (error) { warnOnce('could not read what folded blocks hold', error); }
  return result;
}
// "due Fri" within the week, "due today", else "due Oct 20".
function dueLabel(day) {
  const date = new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100);
  const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((date - today) / 86400000);
  if (days === 0) return 'due today';
  if (days > 0 && days < 7) return 'due ' + date.toLocaleDateString(undefined, { weekday: 'short' });
  return 'due ' + date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function collectNodes(tree, nodes = []) {
  for (const node of tree || []) {
    if (!node || Array.isArray(node)) continue;
    nodes.push(node);
    collectNodes(node.children, nodes);
  }
  return nodes;
}
const treeIds = tree => [...new Set(collectNodes(tree).map(node => node.id).filter(isEntityId))];
function typeQuery(ids) {
  return `[:find ?uuid ?kind
    :where
    ${idsIn('?b', ids)}
    [?b :block/uuid ?uuid]
    (or-join [?b ?kind]
      (and [?b :logseq.property/status ?s]
           (not [?s :db/ident :logseq.property/status.done])
           (not [?s :db/ident :logseq.property/status.canceled])
           (not [?s :logseq.property/choice-checkbox-state true])
           [(identity "task") ?kind])
      (and [?b :block/tags ?tag]
           [?tag :db/ident :logseq.class/Task]
           (not [?b :logseq.property/status _])
           [(identity "task") ?kind])
      (and [?b :logseq.property.asset/type _] [(identity "asset") ?kind])
      (and [?b :logseq.property/asset _] [(identity "asset") ?kind])
      (and [?b :block/tags ?tag]
           [?tag :db/ident :logseq.class/Asset]
           [(identity "asset") ?kind])
      (and [?b :block/refs ?asset]
           (or-join [?asset] [?asset :logseq.property.asset/type _]
               (and [?asset :block/tags ?assetTag]
                    [?assetTag :db/ident :logseq.class/Asset]))
           [(identity "asset") ?kind]))]`;
}
async function descendantMetadata(tree) {
  const nodes = collectNodes(tree);
  const ids = treeIds(tree);
  if (!ids.length || !logseq.DB?.datascriptQuery) return undefined;
  try {
    const rows = await logseq.DB.datascriptQuery(typeQuery(ids));
    if (!Array.isArray(rows)) return undefined;
    const idSet = new Set(ids);
    const metadata = new Map(nodes.filter(node => idSet.has(node.id)).map(node => [node.uuid, { task: false, asset: false }]));
    for (const [uuid, kind] of rows) {
      if (metadata.has(uuid) && (kind === 'task' || kind === 'asset')) metadata.get(uuid)[kind] = true;
    }
    return metadata;
  } catch (error) {
    warnOnce('using block-tree type detection', error);
    return undefined;
  }
}

async function loadJournalDates() {
  if (!logseq.DB?.datascriptQuery) return undefined;
  try {
    const rows = await logseq.DB.datascriptQuery(`[:find ?uuid ?title
      :where [?journal :block/journal-day _]
      [?journal :block/uuid ?uuid]
      [(get-else $ ?journal :block/title "") ?title]]`);
    const uuids = new Set(), names = new Set();
    for (const [uuid, title] of rows || []) {
      if (!UUID.test(uuid)) continue;
      uuids.add(uuid);
      if (title) names.add(String(title).toLowerCase());
    }
    return { uuids, names };
  } catch (error) {
    warnOnce('could not load journal date identities', error);
    return undefined;
  }
}

/* Date labels are classified synchronously during DOM updates, before paint.
   Global journal styles stay installed across navigation. */
const journalUuid = uuid => typeof uuid === 'string' && uuid.startsWith('00000001-');
const dateLinks = { document: null, originals: new Map(), version: 0, uuids: new Set(), names: new Set() };
const dateMonth = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const datePattern = new RegExp('^(?:' + dateMonth + ' \\d{1,2},? \\d{4}|\\d{1,2} ' + dateMonth + ',? \\d{4}|\\d{4}-\\d{2}-\\d{2})$', 'i');
function dateLinkName(name) {
  const value = String(name || '').trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  return datePattern.test(value) && Number.isFinite(Date.parse(value));
}
// Unique page titles may append tag names as plain text, rather than tag elements.
// Resolve the actual stored title so literal # characters and aliases remain intact.
const pageLabelTitles = new Map();
const pageLabelOriginals = new Map();
let pageLabelGeneration = 0;
function cleanPageLabel(value, title) {
  if (!title || !value.startsWith(title)) return value;
  const suffix = value.slice(title.length);
  return /^(?:\s+#[^#]+)+$/.test(suffix) ? title : value;
}
async function loadPageLabelTitles() {
  const generation = ++pageLabelGeneration;
  try {
    const rows = await logseq.DB.datascriptQuery(`[:find ?uuid ?title
      :where [?b :block/uuid ?uuid] [?b :block/title ?title] [?b :block/tags _]]`);
    if (generation !== pageLabelGeneration || !dateLinks.document || !Array.isArray(rows)) return;
    pageLabelTitles.clear();
    for (const [uuid, title] of rows) if (title) pageLabelTitles.set(String(uuid), String(title));
    updatePageLabels(dateLinks.document);
  } catch (error) { warnOnce('could not resolve stored page titles', error); }
}
function pageLabelTitle(value, uuid) {
  if (uuid && pageLabelTitles.has(uuid)) return pageLabelTitles.get(uuid);
  // Sidebar links lack UUID attributes. Prefer the longest exact stored title.
  let best = '';
  for (const title of pageLabelTitles.values()) if (title === value) return value;
  for (const title of pageLabelTitles.values()) {
    if (title.length > best.length && cleanPageLabel(value, title) !== value) best = title;
  }
  return best;
}
function updatePageLabels(doc) {
  if (!setting('pageLabels')) {
    for (const [node, record] of pageLabelOriginals) if (node.nodeValue === record.cleaned) node.nodeValue = record.original;
    pageLabelOriginals.clear();
    return;
  }
  for (const [node] of pageLabelOriginals) if (!node.isConnected) pageLabelOriginals.delete(node);
  const labels = new Map();
  for (const link of doc.querySelectorAll('a.page-ref:not(.page-property-key)')) {
    const label = link.lastElementChild;
    if (label?.tagName === 'SPAN') labels.set(label, link.getAttribute('data-uuid'));
  }
  for (const label of doc.querySelectorAll('a.link-item .page-title')) labels.set(label, null);
  for (const [label, uuid] of labels) {
    // Leave nested links, editors, and rich block excerpts intact.
    if (label.querySelector('a, input, textarea, button, .block-title-wrap, [contenteditable]')) continue;
    const value = label.textContent;
    if (!/\s+#/.test(value)) continue;
    const cleaned = cleanPageLabel(value, pageLabelTitle(value, uuid));
    if (cleaned === value) continue;
    const walker = doc.createTreeWalker(label, 4), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let remaining = cleaned.length;
    for (const node of nodes) {
      const original = node.nodeValue;
      const keep = original.slice(0, Math.max(remaining, 0));
      remaining -= original.length;
      if (keep !== original) {
        pageLabelOriginals.set(node, { original, cleaned: keep });
        node.nodeValue = keep;
      }
    }
  }
}
function restorePageLabels() {
  ++pageLabelGeneration;
  for (const [node, record] of pageLabelOriginals) {
    if (node.nodeValue === record.cleaned) node.nodeValue = record.original;
  }
  pageLabelOriginals.clear();
  pageLabelTitles.clear();
}
const refRows = new Set();
function referenceOnly(row) {
  const wrap = [...row.querySelectorAll('.block-title-wrap')]
    .find(el => el.closest('.ls-block[blockid]') === row && !el.parentElement?.closest('a.page-ref'));
  if (!wrap) return false;
  const links = [...wrap.querySelectorAll('a.page-ref')].filter(a => !a.parentElement?.closest('a.page-ref'));
  if (links.length !== 1 || !links[0].querySelector('.block-title-wrap')) return false;
  if (links[0].querySelector('.prefix-link, .hl-page, img')) return false; // PDF citations and images keep their own look
  // Brackets around the link are Logseq's own (shown when "show brackets" is on), not text of the row.
  const squash = text => text.replace(/\s+|\[\[|\]\]/g, '');
  let text = wrap.textContent;
  for (const cue of wrap.querySelectorAll('.refinement-child-assets')) text = text.replace(cue.textContent, '');
  return squash(text) === squash(links[0].textContent);
}
function updateReferenceRows(doc) {
  const rows = new Set();
  for (const title of doc.querySelectorAll('a.page-ref .block-title-wrap')) {
    const row = title.closest('.ls-block[blockid]');
    if (row && !rows.has(row) && referenceOnly(row)) rows.add(row);
  }
  for (const row of refRows) if (!rows.has(row)) { row.removeAttribute('data-refinement-ref-row'); refRows.delete(row); }
  for (const row of rows) if (!refRows.has(row)) { row.setAttribute('data-refinement-ref-row', ''); refRows.add(row); }
}
/* Cues that depend on what the database says about a link or a row. The answer is kept, and each
   element it applies to is marked as it is drawn, so one fixed set of rules does the drawing however
   large the graph is (there used to be four rules for every referenced block in the graph):
   - a link to a block drawn without the block's title area (a link with its own label) gets the dot;
   - a property value listed under Linked references starts with its property's name ("Doctor:");
   - a record listed under a page's tag tabs shows the property that links it ("Diagnosis: <this page>") while folded. */
const cueMarks = { blockUuids: new Set(), incoming: new Map(), marked: new Map() };
function updateCueMarks(doc) {
  const found = new Map(); // element -> [attribute, value]
  if (cueMarks.blockUuids.size) {
    for (const link of doc.querySelectorAll('.page-ref[data-uuid], .page-ref[data-ref]')) {
      const uuid = link.getAttribute('data-uuid'), ref = link.getAttribute('data-ref');
      if (cueMarks.blockUuids.has(uuid) || (ref && cueMarks.blockUuids.has(ref.toLowerCase()))) found.set(link, ['data-refinement-block-link', '']);
    }
  }
  if (setting('linkLabels')) {
    const wrapperOf = row => [...row.querySelectorAll('.block-content-wrapper')].find(el => el.closest('.ls-block[blockid]') === row);
    if (provided.propertyCrumbs.values.size) {
      for (const row of doc.querySelectorAll(`${referenceAreas} .ls-block[blockid]`)) {
        const name = provided.propertyCrumbs.values.get(row.getAttribute('blockid'));
        const wrapper = name && wrapperOf(row);
        if (wrapper) found.set(wrapper, ['data-refinement-prop-label', name + ':']);
      }
    }
    // A row in the right sidebar is judged against the page that sidebar item shows (0.4.135), the rest against the main view's.
    // The main view's rows against the page it shows, from memory while that page's look-up is still out (0.4.150).
    const titles = [...provided.pageTitles(doc)].filter(el => !el.parentElement?.closest(PAGE_TITLE));
    const shownUuid = titles.length === 1 ? titles[0].querySelector('.ls-block[blockid]')?.getAttribute('blockid') : '';
    const mainIncoming = (shownUuid && incomingFor(shownUuid)) || (shownUuid ? new Map() : cueMarks.incoming);
    const incomingOf = row => { const item = row.closest('#right-sidebar .sidebar-item'); return item ? sidebarCues.pages.get(item) : mainIncoming; };
    if (mainIncoming.size || sidebarCues.pages.size) {
      for (const row of doc.querySelectorAll('.ls-block[blockid]')) {
        const incoming = incomingOf(row);
        if (!incoming?.size) continue;
        const uuid = row.getAttribute('blockid'), names = incoming.get(uuid);
        // The page's own blocks say so in their properties, and Linked references already show the property.
        if (!names || incoming.own?.has(uuid) || row.closest(REFERENCE_AREAS)) continue;
        const wrapper = wrapperOf(row);
        if (!wrapper) continue;
        const label = [...names].join(', ') + ':', page = incoming.pageTitle || '';
        // The record's own title, not a title drawn inside one of its property values.
        const title = wrapper.querySelector('.block-head-wrap .block-title-wrap') || wrapper.querySelector('.block-title-wrap');
        if (title) {
          found.set(title, ['data-refinement-via', label]);
          if (page && title.parentElement && title.parentElement !== wrapper) found.set(title.parentElement, ['data-refinement-via-value', page]);
        } else found.set(wrapper, ['data-refinement-via', page ? `${label} ${page}` : label]);
      }
    }
  }
  for (const [el, [attr]] of cueMarks.marked) {
    if (found.get(el)?.[0] !== attr) { el.removeAttribute(attr); cueMarks.marked.delete(el); }
  }
  for (const [el, mark] of found) {
    if (el.getAttribute(mark[0]) !== mark[1]) el.setAttribute(mark[0], mark[1]);
    cueMarks.marked.set(el, mark);
  }
}
/* Grey parent paths are drawn from a block's raw text, so links keep their [[ ]] and a labelled link
   shows as [words]([[page]]). The markup fades where it stands, from the text on screen; the words are
   never changed (0.4.151: they used to be rewritten from the database a moment later, changing as you read). */
function fadeCrumbBrackets(doc) {
  const win = doc.defaultView;
  if (!win.CSS?.highlights || !win.Highlight) return;
  const ranges = [];
  for (const label of doc.querySelectorAll('.breadcrumb .breadcrumb__label')) {
    const walker = doc.createTreeWalker(label, win.NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const fade = (start, end) => {
        const range = doc.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        ranges.push(range);
      };
      // Every bracket: Logseq cuts links in a path unevenly ("called [Mateo Ruiz]] about [the plan").
      for (const match of node.nodeValue.matchAll(/\[+|\]+/g)) fade(match.index, match.index + match[0].length);
      // [words]([[page]]): all but the words.
      for (const match of node.nodeValue.matchAll(/\[([^\[\]]+)\]\((?:\[\[[^\]]+\]\]|\(\([^)]+\)\)|[^)\s]+)\)/g)) {
        fade(match.index, match.index + 1);
        fade(match.index + 1 + match[1].length, match.index + match[0].length);
      }
    }
  }
  win.CSS.highlights.set('refinement-crumb-markup', new win.Highlight(...ranges));
}
// The heading of each group when a query is grouped by a date: mark the part that holds the date.
const dateHeadings = new Set();
function isJournalDate(text) {
  return dateLinkName(text) || dateLinks.names.has(String(text || '').trim().toLowerCase());
}
function updateDateHeadings(doc) {
  const found = new Set();
  for (const header of doc.querySelectorAll('.ls-view-body .ls-foldable-header')) {
    const title = [...header.children].find(el => !el.matches('.ls-foldable-title-control'));
    if (!title || !isJournalDate(title.textContent)) continue;
    let target = title;
    for (let inner = target.firstElementChild; inner && inner.textContent.trim() === target.textContent.trim() &&
      target.children.length === 1; inner = target.firstElementChild) target = inner;
    found.add(target);
  }
  for (const el of dateHeadings) if (!found.has(el)) { el.removeAttribute('data-refinement-date-heading'); dateHeadings.delete(el); }
  for (const el of found) { if (!el.hasAttribute('data-refinement-date-heading')) el.setAttribute('data-refinement-date-heading', ''); dateHeadings.add(el); }
}
// Under Linked references, the heading of a source page says how many references it holds.
const refCounts = new Set();
const refCountSeen = new Map();
function updateReferenceCounts(doc) {
  const found = new Map();
  // Not tied to .group-list-view: a journal's Linked references are drawn without that wrapper.
  if (setting('referenceLayout')) for (const title of doc.querySelectorAll('#main-content-container .references .ls-view-body .ls-foldable-title')) {
    // The heading of a whole list (a page shown inside a reference has its own Linked references) is not a source page.
    if (title.querySelector('.ls-view-head')) continue;
    const header = title.querySelector('.ls-foldable-header');
    // Only the references themselves: what an open reference shows inside it (children, property values,
    // a page's own references) are blocks too, and are not counted.
    const content = title.parentElement.querySelector(':scope > .ls-foldable-content');
    const count = content ? [...content.querySelectorAll('.ls-block[level="0"]')].filter(block => {
      const outer = block.parentElement.closest('.ls-block');
      return !outer || !content.contains(outer);
    }).length : 0;
    if (!header) continue;
    // A folded source page draws no references, so its last counted number is kept (per page on screen).
    const key = provided.pageKind.pageUuid + '|' + header.textContent.trim();
    if (count) { if (refCountSeen.size > 500) refCountSeen.clear(); refCountSeen.set(key, count); }
    const shown = count || refCountSeen.get(key) || 0;
    if (shown > 1) found.set(header, String(shown));
  }
  for (const el of refCounts) if (!found.has(el)) { el.removeAttribute('data-refinement-ref-count'); refCounts.delete(el); }
  for (const [el, count] of found) { if (el.getAttribute('data-refinement-ref-count') !== count) el.setAttribute('data-refinement-ref-count', count); refCounts.add(el); }
}
// On a tag's own page, the tag on each of its rows (records, Linked references, the cells of its table)
// says what the title already says, so those tags are marked and hidden. The page is known from its
// uuid (loadPageKind) once the title on screen is that page's.
const ownTags = new Set();
function updateOwnTags(doc) {
  const found = new Set();
  const uuid = provided.pageKind.isTag && UUID.test(provided.pageKind.pageUuid) ? provided.pageKind.pageUuid : '';
  if (setting('ownTagHidden') && uuid && doc.querySelector(`#main-content-container :is(.ls-page-title, .page-title) .ls-block[blockid="${uuid}"]`)) {
    for (const tag of doc.querySelectorAll(`#main-content-container a.tag[data-uuid="${uuid}"]`)) {
      if (tag.closest('.is-page-title-row, .ls-page-title, .page-title, .editor-wrapper')) continue;
      const item = tag.closest('.block-tag, .select-item') || tag;
      found.add(item);
      // When the row's tag list held only this tag, the whole list goes, so no empty line is left behind.
      const list = item.parentElement;
      if (list?.classList.contains('block-tags') && [...list.children].every(child => child.querySelector(`a.tag[data-uuid="${uuid}"]`))) found.add(list);
    }
  }
  for (const el of ownTags) if (!found.has(el)) { el.removeAttribute('data-refinement-own-tag'); ownTags.delete(el); }
  for (const el of found) { if (!el.hasAttribute('data-refinement-own-tag')) el.setAttribute('data-refinement-own-tag', ''); ownTags.add(el); }
}
// Journal days in the left sidebar's lists are marked, so they can be drawn in grey.
const sidebarJournals = new Set();
function updateSidebarJournals(doc) {
  const found = new Set();
  if (setting('quietSidebarIcons')) for (const item of doc.querySelectorAll('#left-sidebar a.link-item')) {
    const title = item.querySelector('.page-title');
    if (title && isJournalDate(title.textContent)) found.add(item);
  }
  for (const el of sidebarJournals) if (!found.has(el)) { el.removeAttribute('data-refinement-journal'); sidebarJournals.delete(el); }
  for (const el of found) { if (!el.hasAttribute('data-refinement-journal')) el.setAttribute('data-refinement-journal', ''); sidebarJournals.add(el); }
}
// A date's tense: past, today or future, worked out from the link's own name ("Oct 14th, 2026") once per
// pass, so a page read in the evening and again the next morning shows the change. Links to a journal
// day and dates typed in a block are a.page-ref with the day in data-ref; a Scheduled or Deadline value
// holds the same link inside .ls-datetime.
const dateTense = { marked: new Set() };
function tenseOf(name, today) {
  const value = String(name || '').trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const day = new Date(ms);
  const stamp = day.getFullYear() * 10000 + (day.getMonth() + 1) * 100 + day.getDate();
  return stamp < today ? 'past' : stamp > today ? 'future' : 'today';
}
function updateDateTense(doc) {
  for (const el of dateTense.marked) if (!el.isConnected) dateTense.marked.delete(el);
  if (!setting('dateTense')) {
    for (const el of dateTense.marked) el.removeAttribute('data-refinement-tense');
    dateTense.marked.clear();
    return;
  }
  const now = new Date(), today = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  for (const link of doc.querySelectorAll('.ls-block a.page-ref:is([data-refinement-date], [data-uuid^="00000001-"])')) {
    const tense = tenseOf(link.getAttribute('data-ref'), today);
    if (!tense) { if (link.hasAttribute('data-refinement-tense')) { link.removeAttribute('data-refinement-tense'); dateTense.marked.delete(link); } continue; }
    if (link.getAttribute('data-refinement-tense') !== tense) link.setAttribute('data-refinement-tense', tense);
    dateTense.marked.add(link);
  }
}
/* How the page is used: one line under the title, "owner · 3   attendees · 2   in text · 4", counted from the
   incoming links the cue pass already reads (the property names are the graph's own). A count is a filter:
   while one is on, the other rows under Linked references step back, and the count wears the "here" mark.
   Nothing is written. Drawn for the page in the main view and for each page open in the right sidebar
   (0.4.135), each with its own count and filter. */
const usage = { scopes: new Map() }; // the main view, or a sidebar item -> { line, filter, hidden, html, pageUuid }
function usageParts(incoming) {
  const counts = new Map();
  for (const names of incoming.values()) for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);
  const parts = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, n]) => [name, name, n]);
  if (incoming.tagged?.size) parts.push(['tagged', 'tagged', incoming.tagged.size]);
  if (incoming.inText?.size) parts.push(['text', 'in text', incoming.inText.size]);
  return parts;
}
function applyUsageFilter(scope, state, incoming, filter) {
  const hide = new Set();
  if (filter) {
    for (const row of scope.querySelectorAll('.references .ls-block[blockid]')) {
      // Only rows that are references themselves are judged (a parent drawn above one, or a block below one, goes
      // with the reference it belongs to); a reference nested under its parent row is judged on its own.
      const uuid = row.getAttribute('blockid'), names = incoming.get(uuid);
      const tagged = incoming.tagged?.has(uuid), inText = incoming.inText?.has(uuid);
      if (!names && !tagged && !inText) continue;
      const match = filter === 'text' ? inText : filter === 'tagged' ? tagged : names?.has(filter);
      if (!match) hide.add(row);
    }
  }
  for (const el of state.hidden) if (!hide.has(el)) { el.removeAttribute('data-refinement-usage-dim'); state.hidden.delete(el); }
  for (const el of hide) if (!state.hidden.has(el)) { el.setAttribute('data-refinement-usage-dim', ''); state.hidden.add(el); }
}
function usageScopes(doc) {
  const scopes = [];
  const titles = [...provided.pageTitles(doc)].filter(el => !el.parentElement?.closest(PAGE_TITLE));
  const title = titles.length === 1 ? titles[0] : null;
  const uuid = title?.querySelector('.ls-block[blockid]')?.getAttribute('blockid') || '';
  const main = doc.querySelector('#main-content-container');
  if (main) scopes.push({ scope: main, title, uuid, incoming: title ? incomingFor(uuid) : null });
  for (const [item, incoming] of sidebarCues.pages) if (item.isConnected) scopes.push({ scope: item, title: null, uuid: incoming.pageUuid, incoming });
  return scopes;
}
function updateUsageLine(doc) {
  checkSidebarPages(doc);
  const seen = new Set();
  for (const { scope, title, uuid, incoming } of usageScopes(doc)) {
    seen.add(scope);
    let state = usage.scopes.get(scope);
    if (!state) usage.scopes.set(scope, state = { line: null, filter: null, hidden: new Set(), html: '', pageUuid: '' });
    drawUsageLine(doc, scope, state, title, uuid, incoming);
  }
  for (const [scope, state] of usage.scopes) if (!seen.has(scope)) { state.line?.remove(); applyUsageFilter(scope, state, new Map(), null); usage.scopes.delete(scope); }
}
function drawUsageLine(doc, scope, state, title, uuid, incoming) {
  if (uuid !== state.pageUuid) { state.pageUuid = uuid; state.filter = null; }
  // Not on a journal: what points at a day (a record's date) is the day's own rows, and says nothing new (0.4.133).
  const parts = setting('showUsage') && incoming && uuid && !journalUuid(uuid) ? usageParts(incoming) : [];
  // Beside the Linked references heading, which the counts are about; in the main view under the title row
  // while that heading is not drawn yet (Logseq draws the references late).
  const heading = [...scope.querySelectorAll('.references .ls-foldable-title')].find(el => /^\s*linked references/i.test(el.textContent));
  const after = heading || (title && (title.querySelector('.is-page-title-row') || provided.titleAnchor(doc, title)));
  let line = state.line;
  if (!parts.length || !after) { line?.remove(); applyUsageFilter(scope, state, incoming || new Map(), null); return; }
  if (!line || line.ownerDocument !== doc) {
    line = state.line = doc.createElement('div');
    line.className = 'refinement-usage';
    line.addEventListener('mousedown', event => event.stopPropagation());
    line.addEventListener('click', event => {
      const chip = event.target.closest('a[data-usage]');
      if (!chip) return;
      event.preventDefault(); event.stopPropagation();
      state.filter = state.filter === chip.dataset.usage ? null : chip.dataset.usage;
      updateUsageLine(doc);
    });
  }
  if (state.filter && !parts.some(([key]) => key === state.filter)) state.filter = null;
  const html = parts.map(([key, label, n]) => `<a href="#" data-usage="${escapeHtml(key)}"${state.filter === key ? ' data-on=""' : ''} title="${state.filter === key ? 'Bring every reference forward again' : 'Step the other references back'}">${escapeHtml(label)} <span class="rf-n">· ${n}</span></a>`).join('<span class="rf-gap"></span>');
  if (state.html !== html) { state.html = html; line.innerHTML = html; }
  if (line.hasAttribute('data-filtered') !== Boolean(state.filter)) line.toggleAttribute('data-filtered', Boolean(state.filter));
  line.classList.toggle('rf-at-heading', Boolean(heading));
  if (after.nextElementSibling !== line) after.after(line);
  applyUsageFilter(scope, state, incoming, state.filter);
}
/* Pages open in the right sidebar: each gets its own look-up of what points at it, so its records carry the via
   label and its Linked references the usage line, as in the main view (0.4.135). Logseq draws a sidebar page's
   title as plain words in the item's header, so the page is found from its first block of its own. */
const sidebarCues = { pages: new Map(), key: null }; // sidebar item -> the incoming map of the page it shows
const SIDEBAR_PAGE = '#right-sidebar .sidebar-item.item-type-page';
function sidebarPageKey(doc) {
  return [...doc.querySelectorAll(SIDEBAR_PAGE)].map(item => {
    const first = [...item.querySelectorAll('.ls-block[blockid]')].find(row => !row.closest(`${REFERENCE_AREAS}, .ls-bidirectional-properties`));
    return first?.getAttribute('blockid') || item.querySelector('.page-title')?.textContent.trim() || '';
  }).join('|');
}
function checkSidebarPages(doc) {
  const key = sidebarPageKey(doc);
  if (sidebarCues.key !== null && key !== sidebarCues.key) { sidebarCues.key = key; scheduleRefresh(); }
}
async function sidebarIncoming(doc) {
  const found = new Map(), byPage = new Map();
  sidebarCues.key = sidebarPageKey(doc);
  for (const item of doc.querySelectorAll(SIDEBAR_PAGE)) {
    const first = [...item.querySelectorAll('.ls-block[blockid]')].find(row => !row.closest(`${REFERENCE_AREAS}, .ls-bidirectional-properties`));
    let page = null;
    if (first) {
      const block = await logseq.Editor.getBlock(first.getAttribute('blockid'));
      if (isEntityId(block?.page?.id)) page = await logseq.Editor.getPage(block.page.id);
    }
    if (!page) {
      const name = item.querySelector('.page-title')?.textContent.trim();
      if (name) page = await logseq.Editor.getPage(name);
    }
    if (!isEntityId(page?.id)) continue;
    const key = String(page.uuid);
    if (!byPage.has(key)) byPage.set(key, incomingPropertyLinks(page));
    found.set(item, await byPage.get(key));
  }
  return found;
}
/* The [[ menu says what each row is (pickerMarks; 0.4.84, 0.4.90, the whole family in 0.4.100). Each row of
   Logseq's page search is marked by what Logseq drew in its icon slot, and by its name against what the plugin
   knows: tag (Logseq's # icon, or a name among the tag pages: the stylesheet colours the #), date (a journal day's
   title: the grey box), page (the generic file icon: the plain page rectangle in its place), page-own (a page with
   an icon of its own, which Logseq draws before the words: the generic icon makes way for it, as in the left
   sidebar), relative (the calendar icon with words that are no journal title, Today or Last Wednesday: stepped
   back to the quiet colour, never hidden), new (the + icon and "New page …": pencilled in, italic, since that already
   means "not yet there"). A page's trailing tags ("Ada Okafor #Person") leave the words and are drawn at the right
   as grey monospace names (the text node is shortened and put back when the mark goes). Only the page-search
   popup: the slash menu and the (( menu share the id and are left alone. A page and a tag with the same name
   cannot be told apart by name alone. */
const pickerMarks = { marked: new Set(), tags: new Map() };  // tags: row -> { node, original }
const PICKER_TAGS = /(?:^|\s+)#[^#\s\[\]]+(?:\s+#[^#\s\[\]]+)*\s*$/;
function pickerKind(row) {
  const line = row.querySelector('.flex-col > .items-start');
  const icon = line?.querySelector(':scope > .opacity-50 .ui__icon');
  const text = (line?.textContent || row.textContent).trim();
  if (!line || !icon) return '';
  const is = name => icon.classList.contains('ls-icon-' + name);
  const lower = text.toLowerCase();
  if (is('hash') || tagPages.titles.has(lower)) return 'tag';
  // Logseq draws a journal day with the generic file icon, and the relative days with a calendar.
  if (dateLinks.names.has(lower) || dateLinkName(text)) return 'date';
  if (is('calendar')) return 'relative';
  if (is('plus')) return /^new (?:page|tag)\b/i.test(text) ? 'new' : '';
  if (is('file')) return line.querySelector(':scope > .gap-1 > .ui__icon') ? 'page-own' : 'page';
  return '';
}
// The last text node of a page row, when it ends in the page's tags: shortened to the words, the tags kept on
// the row for the stylesheet. React sets a text node's value itself and never removes one it cannot find, so a
// shortened node is safe; a node it rewrites (a new search) is simply read again.
function markPickerTags(row) {
  const line = row.querySelector('.flex-col > .items-start');
  const walker = row.ownerDocument.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  let node = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.trim()) node = n;
  const kept = pickerMarks.tags.get(row);
  // A node shortened to nothing (the whole node was the tags) is blank, so the walker passes it by: the kept node
  // decides, as long as it is still in the row with the shortened words.
  if (kept) { if (kept.node.nodeValue === kept.shortened && line.contains(kept.node)) return; unmarkPickerTags(row); }
  const m = node && PICKER_TAGS.exec(node.nodeValue);
  if (!m) return;
  const names = m[0].trim().split(/\s+/).map(t => t.replace(/^#/, '')).join('  ');
  const shortened = node.nodeValue.slice(0, m.index);
  pickerMarks.tags.set(row, { node, original: node.nodeValue, shortened });
  node.nodeValue = shortened;
  row.setAttribute('data-refinement-pick-tags', names);
}
function unmarkPickerTags(row) {
  const kept = pickerMarks.tags.get(row);
  if (!kept) return;
  if (kept.node.nodeValue === kept.shortened) kept.node.nodeValue = kept.original;
  row.removeAttribute('data-refinement-pick-tags');
  pickerMarks.tags.delete(row);
}
function unmarkPickerRow(row) {
  if (row.isConnected) { row.removeAttribute('data-refinement-pick'); if (!pickerMarks.tags.has(row)) row.removeAttribute('data-refinement-pick-tags'); }
  unmarkPickerTags(row);
  pickerMarks.marked.delete(row);
}
/* The # tag picker (0.4.107, under the same setting): Logseq draws its rows without an icon slot, so a tag row is
   known by its name (tagPages.titles) and the stylesheet draws the # in the tag colour before the words; at the right,
   in the slot the [[ menu uses for a page's tags, what the tag sits under and the fields it brings ("under Occurrence
   · + date"), from the schema the line list reads; the "New tag …" row is pencilled in, as every row that makes something. */
const tagInfo = { byLower: null, at: 0, loading: null };
function loadTagInfo(doc) {
  if (tagInfo.loading || (tagInfo.byLower && Date.now() - tagInfo.at < 30000) || !provided.propSchema) return;
  tagInfo.loading = Promise.all([provided.propSchema(), provided.propPages()]).then(([schema, pages]) => {
    const byId = new Map(pages.map(p => [p.id, p])), map = new Map();
    for (const p of pages) {
      if (!p.isTag) continue;
      const under = (schema.parentsOf.get(p.id) || []).map(id => byId.get(id)?.title).filter(t => t && t !== 'Root Tag');
      const adds = (schema.classProps.get(p.id) || []).map(id => schema.byId.get(id)?.title).filter(Boolean);
      map.set(p.lower, [under.length ? `under ${under.join(', ')}` : '', adds.length ? `+ ${adds.join(', ')}` : ''].filter(Boolean).join(' · '));
    }
    tagInfo.byLower = map; tagInfo.at = Date.now(); tagInfo.loading = null;
    updatePickerMarks(doc);
  }).catch(error => { tagInfo.loading = null; warnOnce('the parents of the tags could not be read', error); });
}
function hashtagKind(row) {
  const text = (row.querySelector('.flex-col > .items-start')?.textContent || row.textContent).trim();
  if (/^new tag\b/i.test(text)) return 'new';
  return tagPages.titles.has(text.toLowerCase()) ? 'tag' : '';
}
function updatePickerMarks(doc) {
  const menus = setting('pickerMarks') ? doc.querySelectorAll(':is([data-editor-popup-ref="page-search"], [data-editor-popup-ref="page-search-hashtag"]) #ui__ac') : [];
  const seen = new Set();
  for (const menu of menus) {
    const hashtag = !!menu.closest('[data-editor-popup-ref="page-search-hashtag"]');
    if (hashtag) loadTagInfo(doc);
    for (const row of menu.querySelectorAll('.menu-link')) {
      const kind = hashtag ? hashtagKind(row) : pickerKind(row);
      if (!kind) continue;
      if (row.getAttribute('data-refinement-pick') !== kind) row.setAttribute('data-refinement-pick', kind);
      if (hashtag) {
        const info = kind === 'tag' ? tagInfo.byLower?.get(row.textContent.trim().toLowerCase()) || '' : '';
        if (info) { if (row.getAttribute('data-refinement-pick-tags') !== info) row.setAttribute('data-refinement-pick-tags', info); } else row.removeAttribute('data-refinement-pick-tags');
      } else if (kind === 'page' || kind === 'page-own') markPickerTags(row); else unmarkPickerTags(row);
      seen.add(row); pickerMarks.marked.add(row);
    }
  }
  for (const row of pickerMarks.marked) if (!seen.has(row)) unmarkPickerRow(row);
}
/* The property picker says each name's type (propertyPickerTypes, 0.4.101). After each name in Logseq's Add
   property list its type in quiet monospace words (Date, Person · many, yes/no …), and in place of the letter T
   Logseq draws before every name the type icon the line list draws (parts/inline-props.js provides typeIcon,
   typeLabel and its schema, read through the core's graphWide cache). A row names its property in a title
   (":user.property/date"), so the type is found by ident; a property the schema lacks (Logseq's own) keeps its T.
   The icon is a small element put first into Logseq's icon slot and taken out again when the mark goes. */
const propertyPicker = { marked: new Set(), byIdent: null, at: 0, loading: null };
function loadPropertyTypes(doc) {
  if (propertyPicker.loading || (propertyPicker.byIdent && Date.now() - propertyPicker.at < 30000)) return;
  propertyPicker.loading = provided.propSchema().then(schema => {
    propertyPicker.byIdent = new Map(schema.props.map(prop => [prop.ident, prop]));
    propertyPicker.at = Date.now(); propertyPicker.loading = null;
    updatePropertyPicker(doc);
  }).catch(error => { propertyPicker.loading = null; warnOnce('the property types could not be read', error); });
}
function updatePropertyPicker(doc) {
  const rows = setting('propertyPickerTypes') && provided.propSchema ? doc.querySelectorAll('.ls-property-dialog .cp__select-results .menu-link') : [];
  if (rows.length) loadPropertyTypes(doc);
  const seen = new Set();
  for (const row of rows) {
    const ident = String(row.querySelector('[title^=":"]')?.getAttribute('title') || '').slice(1);
    const prop = propertyPicker.byIdent?.get(ident);
    // Logseq's own "+ New option: …" row makes a property: pencilled in, as every row that makes something.
    const kind = prop ? prop.type : /^\+?\s*New option\b/i.test(row.textContent.trim()) ? 'new' : '';
    if (!kind) continue;
    const label = prop ? provided.propTypeLabel(prop) : '';
    if (row.getAttribute('data-refinement-prop') !== kind) row.setAttribute('data-refinement-prop', kind);
    if (row.getAttribute('data-refinement-prop-type') !== label) row.setAttribute('data-refinement-prop-type', label);
    const slot = prop && row.querySelector('.pt-1');
    if (slot) {
      // React keeps a row's elements and shows another property in them when the list is filtered, so the icon
      // is kept by ident and drawn again when the row's property changes.
      let icon = slot.querySelector('.refinement-prop-icon');
      if (!icon) { icon = doc.createElement('span'); icon.className = 'refinement-prop-icon'; slot.prepend(icon); }
      if (icon.dataset.ident !== ident) { icon.dataset.ident = ident; icon.innerHTML = provided.propTypeIcon(prop); }
    }
    seen.add(row); propertyPicker.marked.add(row);
  }
  for (const row of propertyPicker.marked) if (!seen.has(row)) unmarkPropertyRow(row);
}
function unmarkPropertyRow(row) {
  row.removeAttribute('data-refinement-prop'); row.removeAttribute('data-refinement-prop-type');
  for (const icon of row.querySelectorAll('.refinement-prop-icon')) icon.remove();
  propertyPicker.marked.delete(row);
}
// A tag word left in a sentence: Logseq draws it as a plain <span>#Tag</span> with no class. It is marked so
// the stylesheet can colour its # (see tagMark in styles.js); the mark is taken off when the setting is off.
const mentions = { marked: new Set() };
/* The value picker on a pill says what each row is (valuePickerMarks, 0.4.107): Logseq's Set <property> list draws a
   page or a block as bare words, a block with its page as a small line above. Each row gets the mark the page uses:
   the plain page rectangle or the page's own icon (which Logseq draws itself) before a page, the # in the tag colour
   before a tag's page, a small dot before a block; the kind in quiet monospace words at the right (Person, tag, page,
   block); a journal day in the line above a block in the grey date box; the New row pencilled in. By name, as the [[ menu. */
const valuePicker = { marked: new Set(), pages: null, at: 0, loading: null };
function loadValuePages(doc) {
  if (valuePicker.loading || (valuePicker.pages && Date.now() - valuePicker.at < 30000)) return;
  valuePicker.loading = provided.propPages().then(pages => {
    valuePicker.pages = new Map(pages.map(p => [p.lower, p])); valuePicker.at = Date.now(); valuePicker.loading = null;
    updateValuePicker(doc);
  }).catch(error => { valuePicker.loading = null; warnOnce('the pages for the value picker could not be read', error); });
}
function updateValuePicker(doc) {
  const rows = setting('valuePickerMarks') && provided.propPages ? doc.querySelectorAll('.property-select .cp__select-results .menu-link') : [];
  if (rows.length) loadValuePages(doc);
  const seen = new Set();
  for (const row of rows) {
    const main = row.querySelector('.justify-between > .items-center');
    if (!main) continue;
    const name = main.textContent.trim(), lower = name.toLowerCase(), crumb = row.querySelector('.breadcrumb__label');
    const page = crumb ? null : valuePicker.pages?.get(lower);
    const kind = /^\+?\s*new\b/i.test(name) ? 'new' : crumb ? 'block' : page ? (page.isTag ? 'tag' : 'page') : '';
    if (!kind) continue;
    const label = kind === 'block' ? 'block' : kind === 'tag' ? 'tag' : kind === 'page' ? (page.tags.find(t => t.title !== 'Page')?.title || 'page') : '';
    if (row.getAttribute('data-refinement-value') !== kind) row.setAttribute('data-refinement-value', kind);
    if (label) { if (row.getAttribute('data-refinement-value-kind') !== label) row.setAttribute('data-refinement-value-kind', label); } else row.removeAttribute('data-refinement-value-kind');
    if (crumb) { const day = crumb.textContent.trim(); crumb.toggleAttribute('data-refinement-value-day', !!(dateLinkName(day) || dateLinks.names.has(day.toLowerCase()))); }
    // The mark before the words: a page with an icon of its own already has it (Logseq draws it), the rest get one.
    const wanted = kind === 'new' ? '' : kind === 'block' ? 'block' : main.querySelector('.ui__icon') ? '' : kind;
    let icon = main.querySelector('.refinement-value-icon');
    if (!wanted) icon?.remove();
    else {
      // After Logseq's checkbox, in the slot where a page's own icon sits (0.4.117: before it, the checkbox stood in a
      // column of its own and the rows with an icon of their own did not line up).
      if (!icon) { icon = doc.createElement('span'); icon.className = 'refinement-value-icon'; const box = main.querySelector(':scope > .ui__checkbox'); if (box) box.after(icon); else main.prepend(icon); }
      if (icon.dataset.kind !== wanted) { icon.dataset.kind = wanted; icon.innerHTML = wanted === 'block' ? '<span class="refinement-value-dot">•</span>' : provided.propPageIcon(page); }
    }
    seen.add(row); valuePicker.marked.add(row);
  }
  for (const row of valuePicker.marked) if (!seen.has(row)) unmarkValueRow(row);
}
function unmarkValueRow(row) {
  row.removeAttribute('data-refinement-value'); row.removeAttribute('data-refinement-value-kind');
  for (const el of row.querySelectorAll('[data-refinement-value-day]')) el.removeAttribute('data-refinement-value-day');
  for (const icon of row.querySelectorAll('.refinement-value-icon')) icon.remove();
  valuePicker.marked.delete(row);
}
function updateMentions(doc) {
  for (const el of mentions.marked) if (!el.isConnected) mentions.marked.delete(el);
  if (!setting('tagMark')) {
    for (const el of mentions.marked) el.removeAttribute('data-refinement-mention');
    mentions.marked.clear();
    return;
  }
  for (const span of doc.querySelectorAll('.ls-block .block-content .block-title-wrap span:not([class])')) {
    if (span.children.length || span.hasAttribute('data-refinement-mention') || !/^#[^\s#\[\]]+$/.test(span.textContent)) continue;
    span.setAttribute('data-refinement-mention', '');
    mentions.marked.add(span);
  }
}
function updateDateLinks() {
  const doc = dateLinks.document;
  if (!doc) return;
  for (const part of [updateReferenceRows, updateChildAssetCues, updateDayCues, provided.updatePropertyCrumbs, fadeCrumbBrackets, updateReferenceHere,
    updatePageLabels, updateDateHeadings, updateReferenceCounts, updateCueMarks, updateOwnTags, updateSidebarJournals, updateMentions, updateUsageLine, updatePickerMarks, updatePropertyPicker, updateValuePicker]) perf.time(part.name, () => part(doc));
  for (const [link] of dateLinks.originals) if (!link.isConnected) dateLinks.originals.delete(link);
  for (const link of doc.querySelectorAll('a.page-ref[data-ref], a.page-ref[data-uuid]')) {
    // A link to a journal day needs no mark: Logseq gives every journal page an id that starts with
    // 00000001- (logseq.common.uuid), and the rules match that id directly as the link is drawn.
    if (!journalUuid(link.getAttribute('data-uuid')) && (dateLinkName(link.getAttribute('data-ref')) || dateLinks.uuids.has(link.getAttribute('data-uuid')) ||
        dateLinks.names.has(String(link.getAttribute('data-ref') || '').toLowerCase()))) {
      if (!dateLinks.originals.has(link)) dateLinks.originals.set(link, link.getAttribute('data-refinement-date'));
      if (!link.hasAttribute('data-refinement-date')) link.setAttribute('data-refinement-date', '');
    } else if (dateLinks.originals.has(link)) {
      const original = dateLinks.originals.get(link);
      if (original === null) link.removeAttribute('data-refinement-date');
      else link.setAttribute('data-refinement-date', original);
      dateLinks.originals.delete(link);
    }
  }
  perf.time('updateDateTense', () => updateDateTense(doc));
}
// Tag pages: a [[link]] to one looks like any page link, and a tag's # and icon can be customised,
// so links to them are marked from the database and their icon is drawn in grey.
const tagPages = { uuids: new Set(), titles: new Set(), marked: new Set() };
// The uuids of every tag page, or null when the look-up failed (the known set is then kept).
async function loadTagPages() {
  try {
    const rows = await dsQuery(`[:find ?uuid ?title
      :where [?tag :block/tags ?class] [?class :db/ident :logseq.class/Tag] [?tag :block/uuid ?uuid] [?tag :block/title ?title]]`);
    const uuids = new Set(), titles = new Set();
    for (const [uuid, title] of rows) { if (UUID.test(String(uuid))) { uuids.add(String(uuid)); titles.add(String(title).trim().toLowerCase()); } }
    return { uuids, titles };
  } catch (error) { warnOnce('could not find tag pages', error); return null; }
}
async function refreshJournalDates() {
  const version = ++dateLinks.version;
  const [dates, tags] = await Promise.all([loadJournalDates(), loadTagPages()]);
  if (version !== dateLinks.version) return;
  if (tags) { tagPages.uuids = tags.uuids; tagPages.titles = tags.titles; applyTagPageStyle(); }
  if (!dates) return;
  dateLinks.uuids = dates.uuids;
  dateLinks.names = dates.names;
  updateDateLinks();
}
function startDateLinks() {
  window.pickerMarksDebug = { pickerMarks, pickerKind, markPickerTags, updatePickerMarks };
  try {
    const doc = host();
    dateLinks.document = doc;
    updateDateLinks();
    // Early: this runs before the screen is painted, so the native look never flashes.
    watchDomEarly(updateDateLinks);
    onUnload(stopDateLinks);
  } catch (error) { warnOnce('immediate date styling is unavailable', error); }
  refreshJournalDates();
  loadPageLabelTitles();
}
function stopDateLinks() {
  try { dateLinks.document?.defaultView?.CSS?.highlights?.delete('refinement-crumb-markup'); } catch {}
  for (const row of refRows) row.removeAttribute('data-refinement-ref-row');
  refRows.clear();
  for (const el of dateHeadings) el.removeAttribute('data-refinement-date-heading');
  dateHeadings.clear();
  for (const el of refCounts) el.removeAttribute('data-refinement-ref-count');
  refCounts.clear();
  for (const crumb of [...provided.propertyCrumbs.marked]) provided.unmarkPropertyCrumb(crumb);
  for (const [el, [attr]] of cueMarks.marked) el.removeAttribute(attr);
  cueMarks.marked.clear();
  for (const el of mentions.marked) el.removeAttribute('data-refinement-mention');
  mentions.marked.clear();
  for (const el of dateTense.marked) el.removeAttribute('data-refinement-tense');
  dateTense.marked.clear();
  for (const state of usage.scopes.values()) {
    state.line?.remove();
    for (const el of state.hidden) el.removeAttribute('data-refinement-usage-dim');
  }
  usage.scopes.clear();
  sidebarCues.pages = new Map(); sidebarCues.key = null;
  for (const row of [...pickerMarks.marked]) unmarkPickerRow(row);
  for (const row of [...propertyPicker.marked]) unmarkPropertyRow(row);
  for (const row of [...valuePicker.marked]) unmarkValueRow(row);
  ++dateLinks.version;
  restorePageLabels();
  childAssetCues.clear();
  for (const cue of dateLinks.document?.querySelectorAll('.refinement-child-assets') || []) cue.remove();
  for (const [link, original] of dateLinks.originals) {
    if (original === null) link.removeAttribute('data-refinement-date');
    else link.setAttribute('data-refinement-date', original);
  }
  dateLinks.originals.clear();
  for (const link of tagPages.marked) link.removeAttribute('data-refinement-tag-page');
  tagPages.marked.clear();
  for (const el of referenceHere.links) el.removeAttribute('data-refinement-here');
  referenceHere.links.clear();
  for (const el of referenceHere.below) el.removeAttribute('data-refinement-below');
  referenceHere.below.clear();
  dateLinks.document = null;
}

/* Move native PDF links, keeping Logseq's own highlight-navigation handler. */
const pdfCitations = { document: null, records: new Map(), blocks: new Map(), sources: new Map(), pageUuid: null };
async function pdfAnnotationSources(tree) {
  const ids = treeIds(tree);
  let page;
  try {
    page = await logseq.Editor.getCurrentPage?.();
    if (!ids.length || !logseq.DB?.datascriptQuery) return { sources: new Map(), pageUuid: page?.uuid };
    const rows = await logseq.DB.datascriptQuery(`[:find ?uuid ?page ?sourceUuid ?title
      :where ${idsIn('?b', ids)}
      (or-join [?b ?annotation]
        [(identity ?b) ?annotation]
        [?b :block/refs ?annotation])
      [?annotation :logseq.property.pdf/hl-page ?page]
      [?annotation :block/uuid ?uuid]
      [?annotation :logseq.property/asset ?source]
      [?source :block/uuid ?sourceUuid]
      [(get-else $ ?source :block/title "PDF") ?title]]`);
    const sources = new Map();
    for (const [uuid, number, sourceUuid, title] of rows || []) {
      if (UUID.test(uuid) && UUID.test(sourceUuid)) sources.set(uuid, { page: number, sourceUuid, title: String(title || 'PDF') });
    }
    return { sources, pageUuid: page?.uuid };
  } catch (error) {
    warnOnce('could not resolve PDF citation titles', error);
    return { sources: new Map(), pageUuid: page?.uuid };
  }
}
function pdfCitationIdentity(prefix) {
  const link = prefix.closest('a.page-ref[data-uuid]');
  const reference = prefix.closest('.page-reference[data-ref]');
  return link?.getAttribute('data-uuid') || reference?.getAttribute('data-ref') ||
    prefix.closest('.ls-block[blockid]')?.getAttribute('blockid');
}
function pdfSourceContext(prefix, sourceUuid) {
  if (!sourceUuid) return false;
  if (pdfCitations.pageUuid === sourceUuid) return true;
  let block = prefix.closest('.ls-block[blockid]');
  while (block) {
    if (block.getAttribute('blockid') === sourceUuid) return true;
    block = block.parentElement?.closest('.ls-block[blockid]');
  }
  return false;
}
function updatePdfCitations() {
  const doc = pdfCitations.document;
  if (!doc) return;
  {
    if (!setting('pdfCitations')) return restorePdfCitations();
    for (const [prefix] of pdfCitations.records) {
      if (!prefix.isConnected) pdfCitations.records.delete(prefix);
    }
    const activeBlocks = new Set();
    for (const prefix of doc.querySelectorAll('.block-title-wrap > .prefix-link:has(> .hl-page)')) {
      const wrap = prefix.parentElement;
      const label = prefix.querySelector(':scope > .hl-page');
      const nativeLabel = label?.querySelector('strong');
      const pageMatch = nativeLabel?.textContent.trim().match(/^P\s*(\d+|\?)$/i);
      if (!label || !pageMatch || wrap.querySelector('textarea, [contenteditable="true"]')) continue;
      const block = wrap.closest('.ls-block[blockid]');
      if (block) {
        activeBlocks.add(block);
        if (!pdfCitations.blocks.has(block)) pdfCitations.blocks.set(block, block.getAttribute('data-refinement-pdf-citation-block'));
        block.setAttribute('data-refinement-pdf-citation-block', '');
      }
      const area = wrap.getAttribute('data-hl-type') === 'area';
      let record = pdfCitations.records.get(prefix);
      if (!record) {
        const attributes = new Map(['title', 'aria-label', 'role', 'tabindex', 'data-refinement-pdf']
          .map(name => [name, prefix.getAttribute(name)]));
        const onKeyDown = event => {
          if (event.target !== prefix) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          const Event = doc.defaultView.PointerEvent || doc.defaultView.MouseEvent;
          prefix.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
        };
        const plainExcerptTarget = event => {
          if (area || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
              prefix.contains(event.target)) return false;
          const element = event.target.nodeType === 1 ? event.target : event.target.parentElement;
          const control = element?.closest('a, button, input, textarea, select, [contenteditable="true"], [role="button"]');
          return !control || !wrap.contains(control);
        };
        const onMouseDown = event => {
          // Allow a normal text-selection drag without starting Logseq's editor.
          if (plainExcerptTarget(event)) event.stopPropagation();
        };
        const onLineClick = event => {
          if (!plainExcerptTarget(event)) return;
          const selection = doc.getSelection();
          if (selection && !selection.isCollapsed &&
              (wrap.contains(selection.anchorNode) || wrap.contains(selection.focusNode))) return;
          event.preventDefault();
          event.stopPropagation();
          const Event = doc.defaultView.PointerEvent || doc.defaultView.MouseEvent;
          prefix.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
        };
        record = { wrap, label, next: prefix.nextSibling, labelNext: label.nextSibling, attributes,
          citation: label.getAttribute('data-refinement-citation'), area, onKeyDown, onMouseDown, onLineClick,
          lineAttribute: wrap.getAttribute('data-refinement-pdf-line') };
        pdfCitations.records.set(prefix, record);
        prefix.addEventListener('keydown', onKeyDown);
        wrap.addEventListener('mousedown', onMouseDown);
        wrap.addEventListener('click', onLineClick);
        if (!area) wrap.setAttribute('data-refinement-pdf-line', '');
        prefix.setAttribute('role', 'link');
        prefix.setAttribute('tabindex', '0');
      }
      // Area selections keep their image in place, citation first; a text selection's citation follows the
      // words, before any cue the plugin adds after the block's text.
      if (area) {
        if (label !== prefix.firstChild) prefix.insertBefore(label, prefix.firstChild);
      } else {
        const cue = [...wrap.children].find(el => el.classList.contains('refinement-child-assets')) || null;
        if (prefix.nextSibling !== cue) wrap.insertBefore(prefix, cue);
      }
      const source = pdfCitations.sources.get(pdfCitationIdentity(prefix));
      const page = pageMatch[1] === '?' ? source?.page ?? '?' : pageMatch[1];
      const fullTitle = source?.title || 'PDF highlight';
      const shortTitle = fullTitle.replace(/\.pdf$/i, '');
      const compactTitle = shortTitle.length > 38 ? shortTitle.slice(0, 35).trimEnd() + '…' : shortTitle;
      const suffix = `p. ${page}`;
      const citation = source && !pdfSourceContext(prefix, source.sourceUuid) ? `(${compactTitle}, ${suffix})` : `(${suffix})`;
      prefix.setAttribute('data-refinement-pdf', area ? 'area' : 'text');
      label.setAttribute('data-refinement-citation', citation);
      prefix.setAttribute('title', `${fullTitle} · ${suffix}`);
      prefix.setAttribute('aria-label', `Open PDF highlight: ${fullTitle}, page ${page}`);
    }
    for (const [block, original] of pdfCitations.blocks) {
      if (activeBlocks.has(block)) continue;
      if (original === null) block.removeAttribute('data-refinement-pdf-citation-block');
      else block.setAttribute('data-refinement-pdf-citation-block', original);
      pdfCitations.blocks.delete(block);
    }
  }
}
function startPdfCitations() {
  try {
    const doc = host();
    if (!doc.body) return;
    pdfCitations.document = doc;
    // Early (before paint), so the native citation never flashes.
    watchDomEarly(updatePdfCitations);
    updatePdfCitations();
    onUnload(stopPdfCitations);
  } catch (error) {
    warnOnce('PDF citation presentation is unavailable', error);
    notify('PDF citation styling could not access the Logseq window.', 'warning');
  }
}
function stopPdfCitations() {
  restorePdfCitations();
  pdfCitations.document = null;
}
// Puts every citation back the way Logseq drew it.
function restorePdfCitations() {
  for (const [prefix, record] of pdfCitations.records) {
    prefix.removeEventListener('keydown', record.onKeyDown);
    record.wrap.removeEventListener('mousedown', record.onMouseDown);
    record.wrap.removeEventListener('click', record.onLineClick);
    if (record.lineAttribute === null) record.wrap.removeAttribute('data-refinement-pdf-line');
    else record.wrap.setAttribute('data-refinement-pdf-line', record.lineAttribute);
    for (const [name, value] of record.attributes) {
      if (value === null) prefix.removeAttribute(name); else prefix.setAttribute(name, value);
    }
    if (record.citation === null) record.label.removeAttribute('data-refinement-citation');
    else record.label.setAttribute('data-refinement-citation', record.citation);
    if (record.area && record.label.parentElement === prefix) {
      prefix.insertBefore(record.label, record.labelNext?.parentNode === prefix ? record.labelNext : prefix.firstChild);
    } else if (prefix.parentElement === record.wrap) {
      record.wrap.insertBefore(prefix, record.next?.parentNode === record.wrap ? record.next : record.wrap.firstChild);
    }
  }
  pdfCitations.records.clear();
  for (const [block, original] of pdfCitations.blocks) {
    if (original === null) block.removeAttribute('data-refinement-pdf-citation-block');
    else block.setAttribute('data-refinement-pdf-citation-block', original);
  }
  pdfCitations.blocks.clear();
}

const childAssetCues = new Map();
const keepNewest = (map, most) => { while (map.size > most) map.delete(map.keys().next().value); };
// What sits below a block, written after its text: ↳, then a dashed circle and a count for
// unfinished tasks at any depth, then an icon for each kind of file directly below.
function updateChildAssetCues(doc) {
  for (const cue of doc.querySelectorAll('.refinement-child-assets:not(.refinement-day-cue)')) {
    const uuid = cue.closest('.ls-block[blockid]')?.getAttribute('blockid');
    if (!childAssetCues.has(uuid)) cue.remove();
  }
  // Cues of blocks that no longer have one were removed above, so only blocks with a cue to show
  // need looking at, and with none to show there is nothing more to do.
  if (!childAssetCues.size) return;
  for (const block of doc.querySelectorAll('.ls-block[blockid]')) {
    const uuid = block.getAttribute('blockid'), kinds = childAssetCues.get(uuid);
    if (!kinds) continue;
    const wrap = [...block.querySelectorAll('.block-title-wrap')].find(el => el.closest('.ls-block[blockid]') === block);
    if (!wrap) continue;
    const old = [...wrap.children].find(el => el.classList.contains('refinement-child-assets'));
    if (block.querySelector('textarea, [contenteditable="true"]')) { old?.remove(); continue; }
    const types = kinds.asset ? [...kinds.assetTypes].sort() : [];
    const insideTags = [...(kinds.tags || [])].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
    const signature = `${kinds.task}|${kinds.asset}|${types.join(',')}|${insideTags.map(([t, n]) => t + n).join(',')}|${kinds.due || 0}`;
    if (old?.getAttribute('data-types') === signature) continue;
    old?.remove();
    const label = [kinds.task && `${kinds.task} unfinished task${kinds.task === 1 ? '' : 's'} below`,
      kinds.asset && `${kinds.asset} file${kinds.asset === 1 ? '' : 's'} directly below`].filter(Boolean).join(' · ');
    const cue = doc.createElement('span');
    cue.className = 'refinement-child-assets';
    cue.setAttribute('data-types', signature);
    cue.setAttribute('contenteditable', 'false');
    cue.setAttribute('aria-label', label);
    cue.setAttribute('title', label);
    cue.appendChild(doc.createTextNode('↳'));
    const icon = name => {
      const el = doc.createElement('span');
      el.className = `refinement-child-${name}`;
      el.setAttribute('aria-hidden', 'true');
      cue.appendChild(el);
    };
    if (kinds.task) { icon('task'); cue.appendChild(doc.createTextNode(String(kinds.task))); }
    for (const type of types) icon(`asset-${type}`);
    // While the block is folded: the kinds inside and the nearest due day (hidden by the stylesheet while open).
    if (insideTags.length || kinds.due) {
      const more = doc.createElement('span');
      more.className = 'refinement-child-kinds';
      for (const [title, n] of insideTags) {
        const part = doc.createElement('span');
        part.className = 'rf-kind';
        part.innerHTML = `<span class="rf-sep">·</span> ${n} <span class="rf-hash">#</span>${escapeHtml(title)}`;
        more.appendChild(part);
      }
      if (kinds.due) {
        const part = doc.createElement('span');
        part.className = 'rf-kind';
        part.innerHTML = `<span class="rf-sep">·</span> ${escapeHtml(dueLabel(kinds.due))}`;
        more.appendChild(part);
      }
      cue.appendChild(more);
      if (!kinds.task && !kinds.asset) cue.setAttribute('data-only-folded', '');
    }
    wrap.appendChild(cue);
  }
}
async function directAssetTypes(tree) {
  const ids = treeIds(tree);
  const result = new Map();
  if (!ids.length) return result;
  try {
    const rows = await logseq.DB.datascriptQuery(`[:find ?uuid ?type
      :where ${idsIn('?b', ids)} [?b :block/uuid ?uuid]
      (or-join [?b ?asset] [(identity ?b) ?asset] [?b :block/refs ?asset] [?b :logseq.property/asset ?asset])
      [?asset :logseq.property.asset/type ?type]]`);
    for (const [uuid, type] of rows || []) {
      const label = String(type).replace(/^:/, '').toLowerCase();
      const kind = label === 'pdf' ? 'pdf' : /^(png|jpe?g|gif|webp|svg|avif|heic|bmp|tiff?)$/.test(label) ? 'image' : 'asset';
      const key = String(uuid);
      if (!result.has(key)) result.set(key, new Set());
      result.get(key).add(kind);
    }
  } catch (error) { warnOnce('could not identify child asset types', error); }
  // File-graph fallback and readable DB titles.
  for (const node of collectNodes(tree)) {
    if (result.has(node.uuid)) continue;
    const title = titleOf(node), raw = attribute(node, 'logseq.property.asset/type', 'asset/type');
    const types = new Set();
    if (String(raw).toLowerCase() === 'pdf' || /\.pdf(?:[)\s?#]|$)/i.test(title)) types.add('pdf');
    if (/^(png|jpe?g|gif|webp|svg|avif|heic)$/i.test(String(raw)) || /\.(?:png|jpe?g|gif|webp|svg|avif|heic)(?:[)\s?#]|$)/i.test(title)) types.add('image');
    if (types.size) result.set(node.uuid, types);
  }
  return result;
}
async function referencedNodeIds() {
  try {
    const rows = await logseq.DB.datascriptQuery(`[:find ?uuid
      :where [?source :block/refs ?target] [?target :block/uuid ?uuid]
      [?target :block/parent ?parent]
      (not [?target :block/name _])
      (not-join [?target] [?target :block/tags ?pageTag]
        [?pageTag :db/ident :logseq.class/Page])
      (not-join [?target] [?target :block/tags ?tagClass]
        [?tagClass :db/ident :logseq.class/Tag])
      (not [?target :block/journal-day _])
      (not [?target :logseq.property.asset/type _])
      (not [?target :logseq.property.pdf/hl-page _]) ]`);
    return new Set((rows || []).map(([uuid]) => String(uuid)).filter(uuid => UUID.test(uuid)));
  } catch (error) {
    warnOnce('could not identify linked nodes', error);
    // Not kept as an empty list for the next half minute (graphWide drops a failed look-up): asked while Logseq
    // is still opening the graph, it fails, and the refresh asks again (0.4.150).
    throw error;
  }
}
// Property values that are blocks (text-type properties) show up in Linked references looking like
// ordinary bullets. Find them, with their property's name, so they can carry a small label.
async function propertyValueBlocks() {
  try {
    const rows = await logseq.DB.datascriptQuery(`[:find ?uuid ?name
      :where [?value :logseq.property/created-from-property ?property]
      [?value :block/refs _]
      [?value :block/uuid ?uuid]
      [?property :block/title ?name]]`);
    const result = new Map();
    for (const [uuid, name] of rows || []) if (UUID.test(String(uuid)) && name) result.set(String(uuid), String(name));
    return result;
  } catch (error) {
    warnOnce('could not identify property values', error);
    throw error; // not kept as an empty list; the refresh asks again (0.4.150)
  }
}
// Records that point at the open page through one of your own Node properties (for example a test
// whose Diagnosis is this page). Logseq lists them under tag tabs below the page's properties but
// doesn't say which property links them, so collect each record with its property names.
const LIVE = '(not [?b :logseq.property/deleted-at]) (not-join [?b] [?b :block/page ?pg] [?pg :logseq.property/deleted-at])';
async function incomingPropertyLinks(given) {
  const result = new Map();
  try {
    const page = given || await logseq.Editor.getCurrentPage?.();
    const id = page?.id;
    if (!isEntityId(id) || !logseq.DB?.datascriptQuery) return result;
    result.pageTitle = String(page.title || page.originalName || page.name || '');
    result.pageUuid = String(page.uuid || '');
    // Blocks in the recycle bin keep their refs; Logseq lists none of them, so neither does the line (0.4.132:
    // a recycled stress page made Atlas read in text · 1503 over ten references).
    const uuidsOf = rows => new Set((rows || []).map(row => String(row[0])).filter(uuid => UUID.test(uuid)));
    // Asked together (0.4.150): right after a page change each answer waits behind Logseq loading the page, so
    // four questions one after another cost four waits.
    const [rows, tagged, refs, own] = await Promise.all([
      logseq.DB.datascriptQuery(`[:find ?uuid ?name ?attr
        :where [(identity ${id}) ?page]
        [?prop :block/tags ?class]
        [?class :db/ident :logseq.class/Property]
        [?prop :db/ident ?attr]
        [?b ?attr ?page]
        [?prop :block/title ?name]
        [?b :block/uuid ?uuid]
        ${LIVE}]`),
      // For the usage line: the blocks tagged with the page (a tag page), and the blocks that only mention
      // it in their words (a reference that is neither a property value nor a tag, and not on the page itself).
      logseq.DB.datascriptQuery(`[:find ?uuid :where [(identity ${id}) ?page] [?b :block/tags ?page] [?b :block/uuid ?uuid] ${LIVE}]`),
      logseq.DB.datascriptQuery(`[:find ?uuid :where [(identity ${id}) ?page] [?b :block/refs ?page] [?b :block/uuid ?uuid] (not [?b :block/page ?page]) ${LIVE}]`),
      // The page's own blocks say so in their properties, and get no via label.
      logseq.DB.datascriptQuery(`[:find ?uuid :where [(identity ${id}) ?page] [?b :block/page ?page] [?b :block/uuid ?uuid]]`),
    ]);
    for (const [uuid, name, attr] of rows || []) {
      // Only properties you made; built-in links such as tags, aliases and parents are left out.
      if (!UUID.test(String(uuid)) || !name || !/^:?user\.property\//.test(String(attr))) continue;
      const key = String(uuid);
      if (!result.has(key)) result.set(key, new Set());
      result.get(key).add(String(name));
    }
    result.tagged = uuidsOf(tagged);
    result.inText = new Set([...uuidsOf(refs)].filter(uuid => !result.has(uuid) && !result.tagged.has(uuid)));
    result.own = uuidsOf(own);
  } catch (error) { warnOnce('could not find records linking to this page', error); }
  return result;
}
let refreshTimer, refreshRetried = '', refreshRetriedAfterFailure = false;
let refreshVersion = 0;
// The Journals list shows several pages at once and Logseq names none of them as the current page,
// so the blocks of every page whose title is on screen are read instead.
const dayOf = new Map(); // top-level block uuid -> the page (journal day) it sits on, for the day cues (0.4.108)
async function shownPagesTree() {
  const doc = dateLinks.document;
  dayOf.clear();
  if (!doc) return [];
  // Started the moment the page changes (0.4.150), the refresh can be ahead of Logseq drawing the days.
  if (!provided.pageTitles(doc).length) await shared.waitFor(() => provided.pageTitles(doc).length || null, 1500);
  const uuids = [...new Set([...provided.pageTitles(doc)].map(title => title.querySelector('.ls-block[blockid]')?.getAttribute('blockid') || '')
    .filter(uuid => UUID.test(uuid)))].slice(0, 12);
  daysRead = new Set(uuids);
  daysPending = false;
  const trees = await Promise.all(uuids.map(async uuid => {
    try {
      let tree = await logseq.Editor.getPageBlocksTree(uuid);
      if (!tree?.length) {
        const page = await logseq.Editor.getPage(uuid);
        const name = page?.name || page?.title || page?.originalName;
        tree = name ? await logseq.Editor.getPageBlocksTree(name) || [] : [];
      }
      for (const node of tree || []) if (node?.uuid) dayOf.set(String(node.uuid), uuid);
      return tree;
    } catch { return []; }
  }));
  return trees.flat().filter(Boolean);
}
/* A day says what it holds (dayCues, 0.4.108): on the Journals list, after each day's title, the folded cue's family
   without the ↳: the dashed circle with the unfinished tasks of the day, the nearest due day, and the kinds of record
   inside by the owner's tags (up to three, counted), in the slot after the text, as a folded block says what it holds.
   Nothing steps back: a day with nothing open has a shorter cue. A journal opened on its own shows none; its rows are there. */
const dayCues = new Map();
function addDayKinds(days, uuid, kinds) {
  const day = days.get(uuid) || { task: 0, tags: new Map(), due: 0 };
  day.task += kinds.task;
  for (const [title, n] of kinds.tags) day.tags.set(title, (day.tags.get(title) || 0) + n);
  if (kinds.due && (!day.due || kinds.due < day.due)) day.due = kinds.due;
  days.set(uuid, day);
}
// The Journals list draws its days a few at a time (on opening, and as you scroll), so a refresh that started before
// a day was drawn missed it: when the days on screen change, the cues are read again (0.4.150).
let shownDaysKey = '', daysRead = new Set(), daysPending = false;
function checkShownDays(doc) {
  const titles = [...provided.pageTitles(doc)].filter(el => el.closest('.journal-item'));
  const key = titles.length > 1 ? titles.map(el => el.querySelector('.ls-block[blockid]')?.getAttribute('blockid') || '').join('|') : '';
  if (key === shownDaysKey) return;
  shownDaysKey = key;
  // A refresh that has not read the days yet will read these too; restarting it would only lose its work.
  if (key && setting('dayCues') && !daysPending && key.split('|').some(uuid => uuid && !daysRead.has(uuid))) scheduleRefresh(150);
}
function updateDayCues(doc) {
  checkShownDays(doc);
  for (const cue of doc.querySelectorAll('.refinement-day-cue')) {
    const uuid = cue.closest('.ls-block[blockid]')?.getAttribute('blockid');
    if (!dayCues.has(uuid)) cue.remove();
  }
  if (!dayCues.size) return;
  for (const title of provided.pageTitles(doc)) {
    const block = title.querySelector('.ls-block[blockid]'), uuid = block?.getAttribute('blockid'), kinds = dayCues.get(uuid);
    if (!kinds || !title.closest('.journal-item')) continue;
    const wrap = [...block.querySelectorAll('.block-title-wrap')].find(el => el.closest('.ls-block[blockid]') === block);
    if (!wrap) continue;
    const old = [...wrap.children].find(el => el.classList.contains('refinement-day-cue'));
    if (block.querySelector('textarea, [contenteditable="true"]')) { old?.remove(); continue; }
    const insideTags = [...kinds.tags].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
    const signature = `${kinds.task}|${insideTags.map(([t, n]) => t + n).join(',')}|${kinds.due || 0}`;
    if (old?.getAttribute('data-types') === signature) continue;
    old?.remove();
    const cue = doc.createElement('span');
    cue.className = 'refinement-child-assets refinement-day-cue';
    cue.setAttribute('data-types', signature);
    cue.setAttribute('contenteditable', 'false');
    const label = [kinds.task && `${kinds.task} unfinished task${kinds.task === 1 ? '' : 's'}`, kinds.due && dueLabel(kinds.due), ...insideTags.map(([t, n]) => `${n} ${t}`)].filter(Boolean).join(' · ');
    cue.setAttribute('aria-label', label); cue.setAttribute('title', label);
    const parts = [];
    if (kinds.task) parts.push(`<span class="refinement-child-task" aria-hidden="true"></span>${kinds.task}`);
    if (kinds.due) parts.push(escapeHtml(dueLabel(kinds.due)));
    for (const [t, n] of insideTags) parts.push(`<span class="rf-day-kind">${n} ${escapeHtml(t)}</span>`);
    cue.innerHTML = parts.map(part => `<span class="rf-kind">${part}</span>`).join('<span class="rf-sep">·</span>');
    wrap.appendChild(cue);
  }
}
/* Each part of the refresh is drawn as soon as its own answers are back (0.4.150). Right after a page change
   Logseq is busy loading the page for about half a second and every look-up waits behind it; when all of them
   were awaited together, the usage line waited for the page's blocks (0.7 s) and the block cues for the
   graph-wide lists, and everything arrived at once, about a second late. */
async function refreshCues(version = ++refreshVersion) {
  const started = performance.now();
  const current = () => version === refreshVersion;
  const doc = dateLinks.document;
  let failures = 0;
  const failed = (what, undo) => error => {
    if (!current()) return;
    failures++;
    undo();
    warnOnce(`could not refresh ${what}`, error);
  };
  // What points at the page: the usage line and the via labels. Needs no blocks of the page.
  const incomingDone = incomingPropertyLinks().then(incoming => {
    if (!current()) return;
    cueMarks.incoming = incoming;
    rememberIncoming(incoming);
    if (doc) { updateCueMarks(doc); updateUsageLine(doc); }
    // Asked the moment the page changed, Logseq can still have named the page being left: ask once more for the one on screen.
    const shown = doc && usageScopes(doc)[0]?.uuid;
    if (shown && incoming.pageUuid && shown !== incoming.pageUuid && refreshRetried !== shown) { refreshRetried = shown; scheduleRefresh(0); }
  }).catch(failed('what points at this page', () => {
    cueMarks.incoming = new Map();
    if (doc) { updateCueMarks(doc); updateUsageLine(doc); }
  }));
  // The whole-graph lists: block links and the property names under Linked references. Asked after what
  // points at the page, which is drawn larger: the database answers in the order it is asked.
  const linksDone = incomingDone.then(() => graphWide('referenced', referencedNodeIds)).then(nodeIds => {
    if (!current()) return;
    // UUID syntax alone also identifies pages. Only database-confirmed blocks count as block links.
    cueMarks.blockUuids = setting('referenceIcons') ? nodeIds : new Set();
    if (doc) updateCueMarks(doc);
  }).catch(failed('block links', () => { cueMarks.blockUuids = new Set(); if (doc) updateCueMarks(doc); }));
  const valuesDone = incomingDone.then(() => graphWide('propertyValues', propertyValueBlocks)).then(propertyValues => {
    if (!current()) return;
    provided.propertyCrumbs.values = propertyValues;
    if (doc) { provided.updatePropertyCrumbs(doc); updateCueMarks(doc); }
  }).catch(failed('property names under Linked references', () => {}));
  const sidebarDone = incomingDone.then(() => doc ? sidebarIncoming(doc) : new Map()).then(sidebarPages => {
    if (!current()) return;
    sidebarCues.pages = sidebarPages;
    if (doc) { updateCueMarks(doc); updateUsageLine(doc); }
  }).catch(failed('the sidebar pages', () => { sidebarCues.pages = new Map(); if (doc) { updateCueMarks(doc); updateUsageLine(doc); } }));
  // The page's blocks: the folded-block and day cues, list properties, PDF citations.
  daysPending = true;
  const treeDone = (async () => {
    let tree, daysShown = [];
    try {
      tree = await logseq.Editor.getCurrentPageBlocksTree();
      if (!tree?.length) { tree = await shownPagesTree(); daysShown = [...daysRead]; }
    } finally { daysPending = false; }
    if (!current()) return;
    provided.listProps.pageBlocks = new Set(collectNodes(tree).map(node => String(node.uuid)));
    if (doc) provided.updateListProps(doc);
    const pdfDone = pdfAnnotationSources(tree).then(pdfSources => {
      if (!current()) return;
      pdfCitations.sources = pdfSources.sources;
      pdfCitations.pageUuid = pdfSources.pageUuid;
      updatePdfCitations();
    });
    const [metadata, assetTypes, inside] = await Promise.all([descendantMetadata(tree), directAssetTypes(tree), descendantKinds(tree)]);
    if (!current()) return;
    const badges = new Map(), days = new Map();
    for (const block of tree || []) {
      const kinds = summarize(block, badges, metadata, assetTypes, inside);
      const day = dayOf.get(String(block?.uuid));
      if (day) addDayKinds(days, day, kinds);
    }
    // Kept for the blocks and days of other pages (0.4.150): back on a page its cues are drawn at once from
    // what was read last time; only this page's own entries are replaced here.
    if (!setting('childTypeCues')) childAssetCues.clear();
    else {
      for (const uuid of provided.listProps.pageBlocks) childAssetCues.delete(uuid);
      for (const [uuid, kinds] of badges) childAssetCues.set(uuid, kinds);
      keepNewest(childAssetCues, 3000);
    }
    if (doc) updateChildAssetCues(doc);
    if (!setting('dayCues')) dayCues.clear();
    else {
      for (const uuid of new Set([...daysShown, ...(tree || []).map(block => dayOf.get(String(block?.uuid)))])) dayCues.delete(uuid);
      for (const [uuid, kinds] of days) if (kinds.task || kinds.tags.size || kinds.due) dayCues.set(uuid, kinds);
      keepNewest(dayCues, 500);
    }
    if (doc) updateDayCues(doc);
    await pdfDone;
  })().catch(failed('current-page cues', () => {
    childAssetCues.clear(); dayCues.clear();
    if (doc) { updateChildAssetCues(doc); updateDayCues(doc); }
  }));
  await Promise.all([incomingDone, linksDone, valuesDone, sidebarDone, treeDone]);
  if (!current()) return;
  perf.add('refreshCues (start to finish)', performance.now() - started);
  // Asked while Logseq is still opening the graph, look-ups fail; ask once more a second later.
  if (failures && !refreshRetriedAfterFailure) { refreshRetriedAfterFailure = true; scheduleRefresh(1000); }
  else if (!failures) refreshRetriedAfterFailure = false;
}
/* What points at each page seen this session, so going back to a page draws its usage line and via labels at once
   from memory while the look-up checks them again (0.4.150). */
const incomingByPage = cueMarks.byPage = new Map();
function rememberIncoming(incoming) {
  if (!incoming?.pageUuid) return;
  incomingByPage.delete(incoming.pageUuid);
  incomingByPage.set(incoming.pageUuid, incoming);
  if (incomingByPage.size > 60) incomingByPage.delete(incomingByPage.keys().next().value);
}
// The answer for the page in the main view: the latest look-up when it is about that page, else the page's last one.
function incomingFor(uuid) {
  if (!uuid) return null;
  return cueMarks.incoming.pageUuid === uuid ? cueMarks.incoming : incomingByPage.get(uuid) || null;
}
function scheduleRefresh(delay = 300) {
  clearTimeout(refreshTimer);
  const version = ++refreshVersion;
  refreshTimer = setTimeout(() => refreshCues(version), delay);
}

/* Links inside a reference: Logseq lets the surrounding reference handle the click last, so it
   opens the referenced block instead. Catch clicks on the inner link first and open that page. */
function nestedReferenceLink(event) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return null;
  const node = event.target, el = node?.nodeType === 1 ? node : node?.parentElement;
  const inner = el?.closest?.('a:is(.page-ref, .tag)[data-uuid]');
  if (!inner || !inner.closest('.ls-block')) return null;
  const outer = inner.parentElement?.closest('a.page-ref');
  return outer ? inner : null;
}
function startNestedReferenceLinks() {
  try {
    const win = host().defaultView;
    listen(win, ['pointerdown', 'mousedown', 'pointerup', 'mouseup'], event => {
      if (!setting('innerReferenceLinks') || !nestedReferenceLink(event)) return;
      event.stopPropagation();
      if (event.type !== 'pointerup' && event.type !== 'mouseup') event.preventDefault();
    });
    listen(win, ['click'], event => {
      const link = setting('innerReferenceLinks') && nestedReferenceLink(event);
      if (!link) return;
      event.stopPropagation();
      event.preventDefault();
      openEntity(link.getAttribute('data-uuid'), event.shiftKey);
    });
  } catch (error) { warnOnce('links inside references stay native', error); }
}

// Under "Linked references" a block is listed because it links to the page on screen, but it may
// hold other links too. The link that points here gets a clear wash, stronger than the box behind a
// date, so it can be found at once; the blocks below a reference that do not hold that link step back.
// Both are marks on the elements, set as Logseq draws them (one page on screen, or each day's own
// references on the Journals list), and drawn by fixed rules in cssParts.
const referenceHere = { links: new Set(), below: new Set(), names: new Map() };
// A page and its aliases are one page to Logseq: Linked references also list links written with an
// alias. The uuids that count as the page on screen (itself, its aliases, the page it is an alias of
// and that page's other aliases) are looked up once per page shown and kept until the route changes.
function samePageUuids(uuid) {
  const known = referenceHere.names.get(uuid);
  if (known) return known;
  const names = new Set([uuid]);
  referenceHere.names.set(uuid, names);
  (async () => {
    const id = (await logseq.Editor.getPage?.(uuid))?.id;
    if (!isEntityId(id) || !logseq.DB?.datascriptQuery) return;
    const rows = await logseq.DB.datascriptQuery(`[:find ?u
      :where [(identity ${id}) ?p]
      (or-join [?p ?a] [?p :block/alias ?a] [?a :block/alias ?p] (and [?o :block/alias ?p] [?o :block/alias ?a]))
      [?a :block/uuid ?u]]`);
    let added = false;
    for (const row of rows || []) { const other = String(row[0]); if (UUID.test(other) && !names.has(other)) { names.add(other); added = true; } }
    if (added && referenceHere.names.get(uuid) === names && dateLinks.document) updateReferenceHere(dateLinks.document);
  })().catch(error => warnOnce('aliases are not marked in Linked references', error));
  return names;
}
// The look of a link that points here (a faint grey wash over a hairline, square, close to the letters, in the text's own
// weight; a date's grey box gives way to it). The link is named by the ids it points to, so Logseq applies
// these rules as it draws Linked references and no link is marked. Logseq cuts each property to a pill
// shape, which would round off the wash on the last value, so that pill's corners are made square.
const hereCss = (scope, targets) => `${scope} :is(.references, .ls-bidirectional-block-container) .ls-block :is(a.page-ref, a.tag):is(${targets}) {
  background: var(--rf-here) !important; padding: 0 .06em !important; border-radius: 0 !important;
  text-decoration: none !important; box-shadow: inset 0 -1px 0 var(--rf-here-line) !important;
  -webkit-box-decoration-break: clone; box-decoration-break: clone;
}
${scope} :is(.references, .ls-bidirectional-block-container) .bottom-property-pill:has(:is(a.page-ref, a.tag):is(${targets})) { border-radius: 0 !important; }`;
const cssQuote = value => String(value).replace(/["\\]/g, '\\$&');
function updateReferenceHere(doc) {
  const mark = setting('markReferenceHere'), layout = setting('referenceLayout');
  const rules = [], below = new Set();
  if (mark || layout) {
    const titles = [...provided.pageTitles(doc)].filter(el => !el.parentElement?.closest(PAGE_TITLE));
    const pages = [];
    for (const title of titles) {
      const block = title.querySelector('.ls-block[blockid]');
      const uuid = block?.getAttribute('blockid') || '';
      if (!UUID.test(uuid)) continue;
      // A journal is also pointed at by dates (a Scheduled or Deadline value), which carry its name, not its uuid.
      const name = (block.querySelector('.block-title-wrap') || block).textContent.trim();
      pages.push({ uuid, name: isJournalDate(name) ? name.toLowerCase() : '', item: title.closest('.journal-item') });
    }
    // One page on screen, or the Journals list, where every day has its own Linked references.
    const single = pages.length === 1;
    const shown = single ? pages : pages.length && pages.every(page => page.item) ? pages : [];
    for (const { uuid, name, item } of shown) {
      const scope = single ? doc.getElementById('main-content-container') : item;
      if (!scope) continue;
      const uuids = samePageUuids(uuid);
      if (mark) {
        const targets = [...uuids].filter(id => UUID.test(id)).map(id => `[data-uuid="${id}"]`);
        if (name) targets.push(`a.page-ref[data-ref="${cssQuote(name)}" i]`);
        rules.push(hereCss(single ? '#main-content-container'
          : `#main-content-container .journal-item:has(:is(${PAGE_TITLE}) .ls-block[blockid="${uuid}"])`, targets.join(', ')));
      }
      if (!layout) continue;
      const here = link => uuids.has(link.getAttribute('data-uuid')) ||
        (name && (link.getAttribute('data-ref') || '').toLowerCase() === name);
      for (const block of scope.querySelectorAll('.references .ls-block[level="0"] .block-children .ls-block'))
        if (![...block.querySelectorAll(':is(a.page-ref, a.tag)[data-uuid], a.page-ref[data-ref]')].some(here)) below.add(block);
    }
  }
  sendStyle('personal-db-reference-here', rules.join('\n'));
  for (const el of referenceHere.below) if (!below.has(el)) { el.removeAttribute('data-refinement-below'); referenceHere.below.delete(el); }
  for (const el of below) if (!referenceHere.below.has(el)) { el.setAttribute('data-refinement-below', ''); referenceHere.below.add(el); }
}

// Settings whose cues are drawn per record, from the database, when the page refreshes.
const CUE_SETTINGS = ['childTypeCues', 'referenceIcons', 'linkLabels'];
// The refresh timer and version are this part's own; the database round cancels a waiting refresh (before).
const cancelRefresh = () => clearTimeout(refreshTimer);
const stopRefresh = () => { clearTimeout(refreshTimer); ++refreshVersion; };
// Links, references and the pickers (read by this part, the editor, the chrome part and the inline properties part). Declared here since 0.4.163; every part reads them through the core's setting().
const settingsSchema = [
  { key: 'linksHeading', type: 'heading', group: 'reading', rank: 4, title: 'Links and references', default: null,
    legend: 'Links: the mark before a link, references, the pickers',
    zone: '<div><i class="b"></i>Ask <u>Mateo Ruiz</u> about <span class="m">•</span> the budget block</div><div class="m">Linked references &nbsp; attendees · 3 &nbsp; in text · 4</div>',
    description: 'Changes here apply right away.' },
  { key: 'quietLinks', type: 'boolean', title: 'Quiet page links', default: true,
    preview: ['<div><i class="b"></i>Ask <span class="lk">Mateo Ruiz</span> about <span class="lk">Echo</span></div>', '<div><i class="b"></i>Ask <span class="ql">Mateo Ruiz</span> about <span class="ql">Echo</span></div>'],
    description: 'Page links in normal text colour with a faint underline instead of bright blue; page names heading Linked references read as headings; links inside highlights stay readable.' },
  { key: 'referenceLayout', type: 'boolean', title: 'Clearer Linked references', default: true,
    preview: ['<div class="m">Linked references</div><div class="h">Echo</div><div><i class="b"></i>Kickoff call</div>', '<div class="m">Linked references</div><div class="h">Echo <span class="m">3</span></div><div><i class="b"></i>Kickoff call</div>'],
    description: 'Under Linked references: a wider gap between source pages, a journal’s date as a plain heading like any other page, the number of references after a heading that holds more than one, a bullet before the grey path that names a reference’s parent block, with the reference stepped in below it, the blocks below a reference stepping back unless they link here too, and Logseq’s fold arrows kept faintly visible. Applies right away.' },
  { key: 'referenceIcons', type: 'boolean', title: 'Icons for block references and files', default: true,
    preview: ['<div><i class="b"></i><span class="ql">the budget block</span></div><div><i class="b"></i><span class="ql">report</span></div>', '<div><i class="b"></i><span class="m">•</span> <span class="plain">the budget block</span></div><div><i class="b"></i><span class="m">▤</span> <span class="ql">report</span> <span class="m">PDF</span></div>'],
    description: 'A small dot before links to blocks, with no underline (pages keep their solid underline), and grey document or image icons before links to PDFs and pictures.' },
  { key: 'linkLabels', type: 'boolean', title: 'Show how records are linked', default: true,
    preview: ['<div class="m">Linked references</div><div><i class="b"></i><span class="ql">Mateo Ruiz</span></div>', '<div class="m">Linked references</div><div><i class="b"></i><span class="pn">Doctor:</span> <span class="ql">Mateo Ruiz</span></div>'],
    description: 'In Linked references, puts the property name before a value (“Doctor: …”). Under a page’s tag tabs, the value that points to the page on screen gets the same faint grey “points here” mark as in Linked references, and a folded record shows that property beside its title (“Diagnosis: page”).' },
  { key: 'tidyPaths', type: 'boolean', title: 'Tidy parent paths', default: true,
    preview: ['<div class="m">[[Project]] / [[Echo]] / Kic…</div><div><i class="b"></i>Found here</div>', '<div class="m">Project / Echo / Kickoff notes</div><div><i class="b"></i>Found here</div>'],
    description: 'The grey path above a result or reference uses the width it has before cutting text short, and its [[ ]] brackets fade; a labelled link [words]([[page]]) fades all but its words.' },
  { key: 'quietLinkMenu', type: 'boolean', title: 'Empty [[ ]] menu until you type', default: true,
    preview: ['<div><i class="b"></i>[[</div><div class="menu">Today<br>Tomorrow</div>', '<div><i class="b"></i>[[</div><div class="menu"><span class="m">type to find a page</span></div>'],
    description: 'Typing [[ no longer opens a list of date words (Today, Tomorrow, Next week …) straight away; the page menu appears with the first letter you type.' },
  { key: 'hyperLinkTap', type: 'boolean', title: 'Tap the Hyper key to start a [[ link', default: true,
    preview: ['<div><i class="b"></i>Call </div><div class="m">Hyper tapped: nothing</div>', '<div><i class="b"></i>Call [[<span class="m">▏</span>]]</div><div class="m">Hyper tapped: link started</div>'],
    description: 'If Caps Lock is your Hyper key (Cmd+Ctrl+Opt+Shift, set up with Karabiner or the Hyperkey app), tapping it on its own while you type does what typing [[ does: the brackets appear and the page menu opens. With words selected, they become the link. Holding Hyper with another key works as before. An Escape your setup sends on a tap is ignored here, so the menu stays open.' },
  { key: 'pickerMarks', type: 'boolean', title: 'The [[ menu and the # picker say what each row is', default: true,
    description: 'In the list that opens when you type #, a # in the tag colour before each tag, what the tag sits under and the fields it brings at the right (“under Occurrence · + date”), and the New tag row pencilled in, italic. In the list that opens when you type [[, each row carries the mark its link would have: a # in the tag colour before a tag, a small grey box before a journal day, the plain page rectangle or the page’s own icon before a page, its tags as grey class names at the right rather than “#Person” in the words; the relative days (Today, Last Wednesday …) step back to the quiet colour, and the New page row pencilled in, italic in the quiet colour with no box, since that means “not yet there”. Matched by what Logseq draws and by name, so a page and a tag with the same name cannot be told apart there. Applies right away.' },
  { key: 'propertyPickerTypes', type: 'boolean', title: 'The property picker says each type', default: true,
    description: 'In Logseq’s Add property list, each name is followed by its type in quiet words (Date, Person · many, yes/no) and the T before every name becomes the type’s icon, the one Properties in the line draws. A property the plugin does not know (one of Logseq’s own) keeps its T. Applies right away.' },
  { key: 'valuePickerMarks', type: 'boolean', title: 'The value picker says what each row is', default: true,
    description: 'In the list that opens on a property’s value (Set owner …), the plain page rectangle or the page’s own icon before a page, a # in the tag colour before a tag, a small dot before a block, the kind in quiet words at the right (Person, tag, page, block), a journal day above a block in the grey date box, and the New row pencilled in. Marked by name, as the [[ menu is. Applies right away.' },
  { key: 'linkBoxList', type: 'boolean', title: 'The link box lists your pages', default: true,
    description: 'Under the field of Link selected text to a page, a list of your pages, tags and journal days drawn with the marks the page uses, filtered as you type; Up and Down move, Enter links the highlighted row. A italic “Make page …” row appears only when no title matches exactly, and never above a match, so a typo cannot make a page. Off, the field is bare and Enter links what you typed. Applies right away.' },
  { key: 'linkBoxBeside', type: 'boolean', title: 'The link box opens beside the words', default: true,
    description: 'Link selected text to a page opens its field just under the selected words, as Logseq’s own [[ menu does, with nothing dimmed and nothing covering the page; a press elsewhere or Escape closes it. Off, the box opens in the middle of the window over a dimmed page. Applies right away.' },
  { key: 'linkBoxNodes', type: 'boolean', title: 'The link box lists blocks too', default: true,
    description: 'Under the pages in the link box, up to five blocks whose words match: tagged blocks (a Task, a Meeting) with their tags at the right, then any block Logseq’s own search finds once three letters are typed. The link points at the block, as a [[ ]] link to it would, and the block shows it in its references. Off, only pages, tags and journal days are listed. Applies right away.' },
  { key: 'pickerEscapeClears', type: 'boolean', title: 'Escape takes [[ and # out', default: true,
    description: 'In the [[ menu and the # tag picker, Escape closes the list and takes the [[ or # and the letters typed after it out of the text, so a key that meant “never mind” never makes a page or a tag when the block is saved; Cmd+Z brings the letters back. A new page or tag is made only through the list’s own New row. Off, Escape leaves the text as Logseq does. Applies right away.' },
  { key: 'dateLinkFormats', type: 'boolean', title: 'Year-first dates in [[ ]] link to journals', default: true,
    preview: ['<div><i class="b"></i>[[2026 10 14</div><div class="menu"><span class="m">New page “2026 10 14”</span></div>', '<div><i class="b"></i>[[2026 10 14</div><div class="menu">Oct 14th, 2026</div>'],
    description: 'Inside [[ ]], a date typed year first (2026 10 14, 2026-10-14, 2026/10/14, 2026.10.14 or 20261014, month and day with two digits) turns into that day\'s journal name, so the menu offers the journal page.' },
  { key: 'pdfCitations', type: 'boolean', title: 'Compact PDF citations', default: true,
    preview: ['<div><i class="b"></i><span class="hl">Talking felt faster</span></div>', '<div><span class="m">❝ p. 3 · Report</span> Talking felt faster</div>'],
    description: 'PDF highlights show as normal text with a quote-mark bullet and a small page and source label at the start; click the line to open the PDF there.' },
  { key: 'innerReferenceLinks', type: 'boolean', title: 'Links inside a reference open their own page', default: true,
    description: 'A page link or tag shown inside a block reference opens its own page when clicked (Shift-click: in the sidebar). Off: clicking anywhere on the reference opens the block, as in Logseq.' },
  { key: 'pageLabels', type: 'boolean', title: 'Page links without trailing tags', default: true,
    preview: ['<div><i class="b"></i>Call <span class="ql">Mateo Ruiz #doctor</span></div>', '<div><i class="b"></i>Call <span class="ql">Mateo Ruiz</span></div>'],
    description: 'A page link whose shown name ends in a tag (“Name #tag”) shows the page’s own title alone.' },
];
/* Troubleshooting for the "via Diagnosis" labels: what the database says links to this page,
   and how Logseq draws those records on screen. Nothing is changed. */
async function checkLinkLabels() {
  try {
    const page = await logseq.Editor.getCurrentPage?.();
    if (!page?.id) return notify('Open the page whose tabbed list you want to check', 'warning');
    const lines = [await provided.versionLine(),
      `page id=${page.id} uuid=${page.uuid}`];
    const run = async (label, query) => {
      try {
        const rows = await logseq.DB.datascriptQuery(query);
        lines.push(`${label}: ${Array.isArray(rows) ? rows.length + ' rows' : typeof rows}`);
        for (const row of (rows || []).slice(0, 12)) lines.push('  ' + JSON.stringify(row).slice(0, 160));
        return rows || [];
      } catch (error) { lines.push(`${label}: ERROR ${error?.message || error}`); return []; }
    };
    const pointing = await run('A. anything pointing at this page', `[:find ?uuid ?attr
      :where [(identity ${page.id}) ?page] [?b ?attr ?page] [?b :block/uuid ?uuid]]`);
    await run('B. property entities (count)', `[:find (count ?p)
      :where [?p :block/tags ?c] [?c :db/ident :logseq.class/Property]]`);
    await run('C. label query without filter', `[:find ?uuid ?name ?attr
      :where [(identity ${page.id}) ?page]
      [?prop :block/tags ?class] [?class :db/ident :logseq.class/Property]
      [?prop :db/ident ?attr] [?b ?attr ?page] [?prop :block/title ?name] [?b :block/uuid ?uuid]]`);
    const found = await incomingPropertyLinks();
    lines.push(`D. labels the plugin would show: ${found.size}`);
    for (const [uuid, names] of found) lines.push(`  ${uuid} → via ${[...names].join(', ')}`);
    const doc = host();
    const uuids = new Set([...pointing.map(row => String(row[0])), ...found.keys()]);
    lines.push('E. on screen:');
    for (const uuid of [...uuids].slice(0, 8)) {
      const hits = doc.querySelectorAll(`[blockid="${uuid}"], [data-uuid="${uuid}"], [data-ref="${uuid}"], [data-id="${uuid}"]`);
      lines.push(`  ${uuid}: ${hits.length} element(s)`);
      for (const el of [...hits].slice(0, 4)) {
        const chain = [];
        for (let node = el, i = 0; node && node !== doc.body && i < 6; node = node.parentElement, i++) {
          const cls = typeof node.className === 'string' && node.className.trim() ? '.' + node.className.trim().split(/\s+/).slice(0, 4).join('.') : '';
          chain.push(node.tagName.toLowerCase() + cls);
        }
        const inRefs = Boolean(el.closest(REFERENCE_AREAS));
        lines.push(`    ${chain.join(' < ')}${inRefs ? '  [in linked references]' : ''}`);
      }
    }
    provided.showReport(lines.join('\n'));
  } catch (error) { console.error(error); notify(`Check stopped: ${error.message}`, 'error'); }
}

// What this part looks for on screen, for "Check what the plugin finds on this page" (0.4.172: here, not in the
// troubleshooting part). [what, selector, what stops without it]
const screenRows = () => [
  ['blocks', '.ls-block[blockid]', 'cues, reference rows'],
  ['block text', '.block-title-wrap', 'cues after a block, block-link dot, reference rows'],
  ['block content', '.block-content', 'links inside references'],
  ['block row', '.block-main-container .block-content-wrapper', '“Doctor:” and “via …” labels'],
  ['page links', 'a.page-ref', 'dates, tag-page icons'],
  ['page links with an id', 'a.page-ref[data-uuid]', 'block links, tag pages, journal dates'],
  ['PDF highlight labels', '.prefix-link .hl-page', 'compact PDF citations'],
  ['reference areas', REFERENCE_AREAS, 'reference headings, “Doctor:” labels, the wash on the link here'],
];
function provide(core) {
  core.provide({ scheduleRefresh, cancelRefresh, stopRefresh, updateDateLinks, updatePdfCitations, updateOwnTags,
    isJournalDate, attribute, pdfCitations, dateLinks, cueMarks, referenceHere, tagPages, referencedNodeIds, incomingPropertyLinks, updateUsageLine, usage });
  // The page's cues and details: after every round, a refresh still waiting from a page change cancelled first.
  core.onDbRound('refreshCues', refreshCues, { before: cancelRefresh });
  // Whole-graph lists: when they fall due.
  core.onDbRound('loadPageLabelTitles', loadPageLabelTitles, { scope: 'graph' });
  core.onDbRound('refreshJournalDates', refreshJournalDates, { scope: 'graph' });
}
function start() {
  const core = window.refinementCore;
  provided = core.provided;
  core.onPageChange(function linksPageChange() {
    // What is known about the page just left must not be applied to the one arriving.
    pdfCitations.pageUuid = null;
    cueMarks.incoming = new Map();
    referenceHere.names.clear(); // the page's aliases are looked up again
    // At once (0.4.150): Logseq is busy loading the new page for about half a second and the look-ups wait in
    // line behind it anyway; a pause before asking only added to that.
    scheduleRefresh(0);
  });
  core.onSettingsChange(function linksSettingsChange(now, before) {
    if (CUE_SETTINGS.some(key => now?.[key] !== before?.[key])) scheduleRefresh(0);
    if (now?.pdfCitations !== before?.pdfCitations) updatePdfCitations();
    try { updateOwnTags(host()); } catch (error) { /* shown on the next change */ }
    updateDateLinks();
  });
  ({ setting, dsQuery, storedRef, titleOf, trailingTags, UUID, isEntityId, idsIn, uuidsIn, graphWide, watchDom, watchDomEarly, addsElements, sendStyle, PAGE_TITLE, REFERENCE_AREAS, referenceAreas, wash, applyTagPageStyle, blockLink, blockLinkPlain, viaLook, escapeHtml } =
    take(core, ['setting', 'dsQuery', 'storedRef', 'titleOf', 'trailingTags', 'UUID', 'isEntityId', 'idsIn', 'uuidsIn', 'graphWide', 'watchDom', 'watchDomEarly', 'addsElements', 'sendStyle', 'PAGE_TITLE', 'REFERENCE_AREAS', 'referenceAreas', 'wash', 'applyTagPageStyle', 'blockLink', 'blockLinkPlain', 'viaLook', 'escapeHtml']));
}
function ready() {
  provided.addTroubleshooting?.({ checks: screenRows(),
    tools: [{ key: 'check-link-labels', label: 'Check linked-record labels', run: () => checkLinkLabels() }] });
  startDateLinks();
  startPdfCitations();
  startNestedReferenceLinks();
  scheduleRefresh();
  onUnload(stopRefresh);
}
(window.refinementParts ||= []).push({ name: 'links', schema: settingsSchema, provide, start, ready, stop: runUnloadTasks });
})();
