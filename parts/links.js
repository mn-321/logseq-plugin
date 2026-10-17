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
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements: ' });
// From the core and the other parts, taken when the part starts (after every part has provided its own).
let setting, dsQuery, storedRef, titleOf, trailingTags, UUID, isEntityId, idsIn, uuidsIn, graphWide, watchDom, watchDomEarly, addsElements, sendStyle, PAGE_TITLE, REFERENCE_AREAS, referenceAreas, wash, applyTagPageStyle, blockLink, blockLinkPlain, viaLook;
let provided, escapeHtml;
// A name may be the core's own or one another part provided; a missing one is a broken contract.
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };

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
    if (cueMarks.incoming.size) {
      for (const row of doc.querySelectorAll('.ls-block[blockid]')) {
        const uuid = row.getAttribute('blockid'), names = cueMarks.incoming.get(uuid);
        // The page's own blocks say so in their properties, and Linked references already show the property.
        if (!names || provided.listProps.pageBlocks.has(uuid) || row.closest(REFERENCE_AREAS)) continue;
        const wrapper = wrapperOf(row);
        if (!wrapper) continue;
        const label = [...names].join(', ') + ':', page = cueMarks.incoming.pageTitle || '';
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
   ([words]([[page]])) comes out half-cut ("[words"). The text is taken from the database instead, links
   become their plain words, and those words get the faint page-link underline (a highlight, so nothing
   is added to Logseq's own elements). A part is only changed when its words match what Logseq drew. */
const crumbLinks = { originals: new Map(), ancestors: new Map(), loading: new Set(), generation: 0 };
const crumbSquash = text => String(text || '').replace(/[\s\[\]()*_~=^`…]+/g, '');
// Plain words of a stored title, with where each link sits in them.
function crumbWords(raw) {
  let text = '';
  const links = [];
  const source = String(raw || '').replace(/^#{1,6}\s+/, '');
  const token = /#\[\[([^\]]+)\]\]|\[([^\]\[]+)\]\((\[\[[^\]]+\]\]|\(\([^)]+\)\)|[^)\s]+)\)|\[\[([^\]]+)\]\]/g;
  let last = 0;
  for (const m of source.matchAll(token)) {
    text += source.slice(last, m.index);
    if (m[1] !== undefined) text += '#' + m[1]; // a tag keeps its #, as tags do elsewhere
    else {
      const words = m[2] ?? m[4];
      links.push([text.length, text.length + words.length]);
      text += words;
    }
    last = m.index + m[0].length;
  }
  return { text: text + source.slice(last), links };
}
// Titles of a block's parents, nearest first, each as crumbWords gives them.
async function loadCrumbAncestors(uuid, generation) {
  const titles = [];
  try {
    let block = await logseq.Editor.getBlock(uuid);
    for (let i = 0; block && i < 30; i++) {
      const parentId = block.parent?.id, pageId = block.page?.id;
      if (!parentId || parentId === pageId) break;
      block = await logseq.Editor.getBlock(parentId);
      if (!block || block.name) break;
      titles.push(crumbWords(await provided.readableTitle(titleOf(block))));
    }
  } catch (error) { warnOnce('could not read parent paths', error); }
  crumbLinks.loading.delete(uuid);
  if (generation !== crumbLinks.generation) return;
  if (crumbLinks.ancestors.size > 500) crumbLinks.ancestors.clear();
  crumbLinks.ancestors.set(uuid, titles);
  if (dateLinks.document) updateCrumbLinks(dateLinks.document);
}
// After a change in the graph, parent titles are read again as their paths are next drawn.
function refreshCrumbLinks() {
  ++crumbLinks.generation;
  crumbLinks.ancestors.clear();
  crumbLinks.loading.clear();
  if (dateLinks.document) updateCrumbLinks(dateLinks.document);
}
function restoreCrumbLinks(doc) {
  for (const [node, record] of crumbLinks.originals) if (node.nodeValue === record.shown) node.nodeValue = record.original;
  crumbLinks.originals.clear();
  try { doc?.defaultView?.CSS?.highlights?.delete('refinement-crumb-link'); } catch {}
}
function updateCrumbLinks(doc) {
  if (!setting('plainPathLinks')) { if (crumbLinks.originals.size) restoreCrumbLinks(doc); return; }
  for (const [node] of crumbLinks.originals) if (!node.isConnected) crumbLinks.originals.delete(node);
  for (const crumb of doc.querySelectorAll('.breadcrumb.block-parents')) {
    // In a query result the path sits inside the row it belongs to; in references, above the group of rows.
    // In the right sidebar an item's title is the path of the block it shows; the block is its content.
    const item = crumb.closest('#right-sidebar .sidebar-item');
    const row = item ? item.querySelector('.ls-block[blockid]')
      : crumb.parentElement?.closest('.ls-block[blockid]') === crumb.parentElement ? crumb.parentElement
      : crumb.parentElement?.parentElement?.querySelector('.ls-block[blockid]');
    const uuid = row?.getAttribute('blockid');
    if (!uuid) continue;
    const labels = [...crumb.querySelectorAll('.breadcrumb__label')];
    const ancestors = crumbLinks.ancestors.get(uuid);
    if (!ancestors) {
      if (!crumbLinks.loading.has(uuid) && labels.some(label => /[\[\]]/.test(label.textContent))) {
        crumbLinks.loading.add(uuid);
        loadCrumbAncestors(uuid, crumbLinks.generation);
      }
      continue;
    }
    labels.forEach((label, index) => {
      const node = label.firstChild;
      if (!node || node.nodeType !== 3 || node !== label.lastChild) return;
      const record = crumbLinks.originals.get(node);
      if (record && node.nodeValue === record.shown) return;
      const words = ancestors[labels.length - 1 - index];
      const value = node.nodeValue;
      if (!words || !words.links.length || !crumbSquash(words.text).startsWith(crumbSquash(value)) || !crumbSquash(value)) return;
      crumbLinks.originals.set(node, { original: value, shown: words.text, links: words.links });
      node.nodeValue = words.text;
    });
  }
  const win = doc.defaultView;
  if (!win.CSS?.highlights || !win.Highlight) return;
  const ranges = [];
  for (const [node, record] of crumbLinks.originals) {
    for (const [start, end] of record.links) {
      if (end > node.nodeValue.length) continue;
      const range = doc.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      ranges.push(range);
    }
  }
  win.CSS.highlights.set('refinement-crumb-link', new win.Highlight(...ranges));
}
function fadeCrumbBrackets(doc) {
  const win = doc.defaultView;
  if (!win.CSS?.highlights || !win.Highlight) return;
  const ranges = [];
  for (const label of doc.querySelectorAll('.breadcrumb .breadcrumb__label')) {
    const walker = doc.createTreeWalker(label, win.NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const match of node.nodeValue.matchAll(/\[\[|\]\]/g)) {
        const range = doc.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + 2);
        ranges.push(range);
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
   Nothing is written. */
const usage = { line: null, filter: null, hidden: new Set(), html: '', pageUuid: '' };
function usageParts() {
  const incoming = cueMarks.incoming, counts = new Map();
  for (const names of incoming.values()) for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);
  const parts = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, n]) => [name, name, n]);
  if (incoming.tagged?.size) parts.push(['tagged', 'tagged', incoming.tagged.size]);
  if (incoming.inText?.size) parts.push(['text', 'in text', incoming.inText.size]);
  return parts;
}
function applyUsageFilter(doc, filter) {
  const hide = new Set();
  if (filter) {
    const incoming = cueMarks.incoming;
    for (const row of doc.querySelectorAll('#main-content-container .references .ls-block[blockid]')) {
      if (row.parentElement?.closest('.ls-block')) continue; // a block below a reference goes with its reference
      const uuid = row.getAttribute('blockid'), names = incoming.get(uuid);
      const match = filter === 'text' ? !names && !incoming.tagged?.has(uuid) : filter === 'tagged' ? incoming.tagged?.has(uuid) : names?.has(filter);
      if (!match) hide.add(row);
    }
  }
  for (const el of usage.hidden) if (!hide.has(el)) { el.removeAttribute('data-refinement-usage-dim'); usage.hidden.delete(el); }
  for (const el of hide) if (!usage.hidden.has(el)) { el.setAttribute('data-refinement-usage-dim', ''); usage.hidden.add(el); }
}
function updateUsageLine(doc) {
  const titles = [...provided.pageTitles(doc)].filter(el => !el.parentElement?.closest(PAGE_TITLE));
  const title = titles.length === 1 ? titles[0] : null;
  const uuid = title?.querySelector('.ls-block[blockid]')?.getAttribute('blockid') || '';
  if (uuid !== usage.pageUuid) { usage.pageUuid = uuid; usage.filter = null; }
  const parts = setting('showUsage') && title && uuid && cueMarks.incoming.pageUuid === uuid ? usageParts() : [];
  let line = usage.line;
  if (!parts.length) { line?.remove(); applyUsageFilter(doc, null); return; }
  if (!line || line.ownerDocument !== doc) {
    line = usage.line = doc.createElement('div');
    line.className = 'refinement-usage';
    line.addEventListener('mousedown', event => event.stopPropagation());
    line.addEventListener('click', event => {
      const chip = event.target.closest('a[data-usage]');
      if (!chip) return;
      event.preventDefault(); event.stopPropagation();
      usage.filter = usage.filter === chip.dataset.usage ? null : chip.dataset.usage;
      updateUsageLine(doc);
    });
  }
  if (usage.filter && !parts.some(([key]) => key === usage.filter)) usage.filter = null;
  const html = parts.map(([key, label, n]) => `<a href="#" data-usage="${escapeHtml(key)}"${usage.filter === key ? ' data-on=""' : ''} title="${usage.filter === key ? 'Show every reference again' : 'Show only these references'}">${escapeHtml(label)} <span class="rf-n">· ${n}</span></a>`).join('<span class="rf-gap"></span>');
  if (usage.html !== html) { usage.html = html; line.innerHTML = html; }
  // Right under the title row, above the page's own property list (the Alias of and path lines are placed again after it).
  const after = title.querySelector('.is-page-title-row') || provided.titleAnchor(doc, title);
  if (after.nextElementSibling !== line) after.after(line);
  applyUsageFilter(doc, usage.filter);
}
// A tag word left in a sentence: Logseq draws it as a plain <span>#Tag</span> with no class. It is marked so
// the stylesheet can colour its # (see tagMark in styles.js); the mark is taken off when the setting is off.
const mentions = { marked: new Set() };
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
  for (const part of [updateReferenceRows, updateChildAssetCues, provided.updatePropertyCrumbs, updateCrumbLinks, fadeCrumbBrackets, updateReferenceHere,
    updatePageLabels, updateDateHeadings, updateReferenceCounts, updateCueMarks, updateOwnTags, updateSidebarJournals, updateMentions, updateUsageLine]) perf.time(part.name, () => part(doc));
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
const tagPages = { uuids: new Set(), marked: new Set() };
// The uuids of every tag page, or null when the look-up failed (the known set is then kept).
async function loadTagPages() {
  try {
    const rows = await dsQuery(`[:find ?uuid
      :where [?tag :block/tags ?class] [?class :db/ident :logseq.class/Tag] [?tag :block/uuid ?uuid]]`);
    return new Set(rows.map(([uuid]) => String(uuid)).filter(uuid => UUID.test(uuid)));
  } catch (error) { warnOnce('could not find tag pages', error); return null; }
}
async function refreshJournalDates() {
  const version = ++dateLinks.version;
  const [dates, tags] = await Promise.all([loadJournalDates(), loadTagPages()]);
  if (version !== dateLinks.version) return;
  if (tags) { tagPages.uuids = tags; applyTagPageStyle(); }
  if (!dates) return;
  dateLinks.uuids = dates.uuids;
  dateLinks.names = dates.names;
  updateDateLinks();
}
function startDateLinks() {
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
  ++crumbLinks.generation;
  restoreCrumbLinks(dateLinks.document);
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
  usage.line?.remove();
  for (const el of usage.hidden) el.removeAttribute('data-refinement-usage-dim');
  usage.hidden.clear();
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
// What sits below a block, written after its text: ↳, then a dashed circle and a count for
// unfinished tasks at any depth, then an icon for each kind of file directly below.
function updateChildAssetCues(doc) {
  for (const cue of doc.querySelectorAll('.refinement-child-assets')) {
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
    return new Set();
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
    return new Map();
  }
}
// Records that point at the open page through one of your own Node properties (for example a test
// whose Diagnosis is this page). Logseq lists them under tag tabs below the page's properties but
// doesn't say which property links them, so collect each record with its property names.
async function incomingPropertyLinks() {
  const result = new Map();
  try {
    const page = await logseq.Editor.getCurrentPage?.();
    const id = page?.id;
    if (!isEntityId(id) || !logseq.DB?.datascriptQuery) return result;
    result.pageTitle = String(page.title || page.originalName || page.name || '');
    const rows = await logseq.DB.datascriptQuery(`[:find ?uuid ?name ?attr
      :where [(identity ${id}) ?page]
      [?prop :block/tags ?class]
      [?class :db/ident :logseq.class/Property]
      [?prop :db/ident ?attr]
      [?b ?attr ?page]
      [?prop :block/title ?name]
      [?b :block/uuid ?uuid]]`);
    for (const [uuid, name, attr] of rows || []) {
      // Only properties you made; built-in links such as tags, aliases and parents are left out.
      if (!UUID.test(String(uuid)) || !name || !/^:?user\.property\//.test(String(attr))) continue;
      const key = String(uuid);
      if (!result.has(key)) result.set(key, new Set());
      result.get(key).add(String(name));
    }
    // For the usage line: the blocks tagged with the page (a tag page), and the blocks that only mention
    // it in their words (a reference that is neither a property value nor a tag, and not on the page itself).
    result.pageUuid = String(page.uuid || '');
    const uuidsOf = rows => new Set((rows || []).map(row => String(row[0])).filter(uuid => UUID.test(uuid)));
    result.tagged = uuidsOf(await logseq.DB.datascriptQuery(`[:find ?uuid :where [(identity ${id}) ?page] [?b :block/tags ?page] [?b :block/uuid ?uuid]]`));
    const refs = uuidsOf(await logseq.DB.datascriptQuery(`[:find ?uuid :where [(identity ${id}) ?page] [?b :block/refs ?page] [?b :block/uuid ?uuid] (not [?b :block/page ?page])]`));
    result.inText = new Set([...refs].filter(uuid => !result.has(uuid) && !result.tagged.has(uuid)));
  } catch (error) { warnOnce('could not find records linking to this page', error); }
  return result;
}
let refreshTimer;
let refreshVersion = 0;
// The Journals list shows several pages at once and Logseq names none of them as the current page,
// so the blocks of every page whose title is on screen are read instead.
async function shownPagesTree() {
  const doc = dateLinks.document;
  if (!doc) return [];
  const uuids = [...new Set([...provided.pageTitles(doc)].map(title => title.querySelector('.ls-block[blockid]')?.getAttribute('blockid') || '')
    .filter(uuid => UUID.test(uuid)))].slice(0, 12);
  const trees = await Promise.all(uuids.map(async uuid => {
    try {
      const tree = await logseq.Editor.getPageBlocksTree(uuid);
      if (tree?.length) return tree;
      const page = await logseq.Editor.getPage(uuid);
      const name = page?.name || page?.title || page?.originalName;
      return name ? await logseq.Editor.getPageBlocksTree(name) || [] : [];
    } catch { return []; }
  }));
  return trees.flat().filter(Boolean);
}
async function refreshCues(version = ++refreshVersion) {
  const started = performance.now();
  try {
    let tree = await logseq.Editor.getCurrentPageBlocksTree();
    if (!tree?.length) tree = await shownPagesTree();
    const [metadata, pdfSources, nodeIds, assetTypes, propertyValues, incoming, inside] = await Promise.all([descendantMetadata(tree), pdfAnnotationSources(tree), graphWide('referenced', referencedNodeIds), directAssetTypes(tree), graphWide('propertyValues', propertyValueBlocks), incomingPropertyLinks(), descendantKinds(tree)]);
    if (version !== refreshVersion) return;
    pdfCitations.sources = pdfSources.sources;
    pdfCitations.pageUuid = pdfSources.pageUuid;
    provided.listProps.pageBlocks = new Set(collectNodes(tree).map(node => String(node.uuid)));
    if (dateLinks.document) provided.updateListProps(dateLinks.document);
    updatePdfCitations();
    const badges = new Map();
    for (const block of tree || []) summarize(block, badges, metadata, assetTypes, inside);
    childAssetCues.clear();
    if (setting('childTypeCues')) for (const [uuid, kinds] of badges) childAssetCues.set(uuid, kinds);
    if (dateLinks.document) updateChildAssetCues(dateLinks.document);
    // UUID syntax alone also identifies pages. Only database-confirmed blocks count as block links.
    cueMarks.blockUuids = setting('referenceIcons') ? nodeIds : new Set();
    provided.propertyCrumbs.values = propertyValues;
    if (dateLinks.document) provided.updatePropertyCrumbs(dateLinks.document);
    cueMarks.incoming = incoming;
    if (dateLinks.document) { updateCueMarks(dateLinks.document); updateUsageLine(dateLinks.document); }
    perf.add('refreshCues (start to finish)', performance.now() - started);
  } catch (error) {
    if (version !== refreshVersion) return;
    childAssetCues.clear();
    if (dateLinks.document) updateChildAssetCues(dateLinks.document);
    cueMarks.blockUuids = new Set();
    cueMarks.incoming = new Map();
    if (dateLinks.document) { updateCueMarks(dateLinks.document); updateUsageLine(dateLinks.document); }
    warnOnce('could not refresh current-page cues', error);
  }
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

// The refresh timer and version are this part's own; main() cancels them where it always did.
const cancelRefresh = () => clearTimeout(refreshTimer);
const stopRefresh = () => { clearTimeout(refreshTimer); ++refreshVersion; };
function provide(core) {
  core.provide({ startDateLinks, startPdfCitations, startNestedReferenceLinks, scheduleRefresh, cancelRefresh, stopRefresh, updateDateLinks, updatePdfCitations, updateOwnTags,
    isJournalDate, attribute, pdfCitations, dateLinks, cueMarks, referenceHere, tagPages, referencedNodeIds, incomingPropertyLinks, updateUsageLine, usage });
  core.onDbRound('refreshCues', refreshCues);
  core.onDbRound('refreshCrumbLinks', refreshCrumbLinks);
  core.onDbRound('loadPageLabelTitles', loadPageLabelTitles);
  core.onDbRound('refreshJournalDates', refreshJournalDates);
}
function start() {
  const core = window.refinementCore;
  provided = core.provided;
  ({ setting, dsQuery, storedRef, titleOf, trailingTags, UUID, isEntityId, idsIn, uuidsIn, graphWide, watchDom, watchDomEarly, addsElements, sendStyle, PAGE_TITLE, REFERENCE_AREAS, referenceAreas, wash, applyTagPageStyle, blockLink, blockLinkPlain, viaLook, escapeHtml } =
    take(core, ['setting', 'dsQuery', 'storedRef', 'titleOf', 'trailingTags', 'UUID', 'isEntityId', 'idsIn', 'uuidsIn', 'graphWide', 'watchDom', 'watchDomEarly', 'addsElements', 'sendStyle', 'PAGE_TITLE', 'REFERENCE_AREAS', 'referenceAreas', 'wash', 'applyTagPageStyle', 'blockLink', 'blockLinkPlain', 'viaLook', 'escapeHtml']));
}
(window.refinementParts ||= []).push({ name: 'links', schema: [], provide, start, stop: runUnloadTasks });
})();
