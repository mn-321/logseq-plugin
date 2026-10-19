/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Pages part of DB Refinements (moved out of main.js in the October 2026 cleanup): what the plugin
   draws around a page's title. The title chrome (the tags and actions above the title, always shown),
   the page kind ("#Page" on an untagged page, the tags beside the actions, the "Alias of …" line and
   the "Inherited from #Tag: …" line on a tag page) and the tag picker they open.
   It provides startTitleChrome, startPageKind, schedulePageKind, updatePageKind, loadPageKind, pageKind,
   pageTitles, pageHeaderOf and openTagPicker to the core and the other parts; it takes isJournalDate,
   updateOwnTags and attribute from the links area (still in main.js until that area moves). */
const shared = window.refinementShared;
const { host, notify } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements: ',
  leaves: { elements: '.refinement-title-tags, .refinement-alias-of, .refinement-shape, .refinement-inherited, .refinement-tag-path', attributes: ['data-refinement-always-shown'],
    // The tags beside a title are placed by a transform (updatePageKind).
    reset: doc => { for (const el of doc.querySelectorAll('.is-page-title-row .ls-block-right .block-tags')) el.style.transform = ''; } } });
// From the core and the other parts, taken when the part starts (after every part has provided its own).
let setting, dsQuery, UUID, isEntityId, idsIn, watchDom, watchDomEarly, PAGE_TITLE, escapeHtml, attribute;
let provided, isJournalDate, updateOwnTags;
// A name may be the core's own or one another part provided; a missing one is a broken contract.
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };

/* Page title area: Logseq hides some actions ("Add tag property", "Set property") and the page's
   tags until you hover. Show them all the time, muted, and full strength on hover.
   Hidden parts are found by how they are hidden on screen, not by exact class names, because
   those change between releases. Only clickable things with words are shown (not the collapse arrow). */
const titleChrome = { marked: new Set() };
function pageHeaderOf(title) {
  // Widest container around the title that holds no page blocks or references.
  let header = title;
  while (header.parentElement && header.parentElement.id !== 'main-content-container' &&
         !header.parentElement.querySelector('.ls-block, .references, .ls-page-blocks')) header = header.parentElement;
  return header;
}
// Whether any of these changes added something to a page title, or added a page title.
function touchesTitle(records) {
  for (const record of records) {
    if (record.type !== 'childList') continue;
    const target = record.target;
    if (target.nodeType !== 1 || !target.closest('#main-content-container')) {
      // Outside the page area, only something that brings the page area with it counts.
      if (![...record.addedNodes].some(node => node.nodeType === 1 && (node.id === 'main-content-container' || node.querySelector('#main-content-container')))) continue;
      return true;
    }
    if (target.closest(PAGE_TITLE)) return true;
    for (const node of record.addedNodes) if (node.nodeType === 1 && (node.matches(PAGE_TITLE) || node.querySelector(PAGE_TITLE))) return true;
  }
  return false;
}
function pageTitles(doc) {
  return doc.querySelectorAll('#main-content-container :is(.ls-page-title, .page-title, h1.title)');
}
function updateTitleChrome(doc) {
  const win = doc.defaultView;
  for (const el of titleChrome.marked) if (!el.isConnected) titleChrome.marked.delete(el);
  const headers = new Set([...pageTitles(doc)].map(pageHeaderOf));
  for (const header of headers) {
    for (const el of header.querySelectorAll('*')) {
      if (el.hasAttribute('data-refinement-always-shown') || el.parentElement?.closest('[data-refinement-always-shown]')) continue;
      if (!el.textContent.trim() || el.matches('input, textarea, [contenteditable="true"]') ||
          el.querySelector('input, textarea, [contenteditable="true"]')) continue;
      if (!el.matches('button, a, [role="button"]') && !el.querySelector('button, a, [role="button"]')) continue;
      const cls = el.getAttribute('class') || '';
      const cs = win.getComputedStyle(el);
      const hoverOnly = /(?:^|\s)(?:group-hover|hover)[^\s]*:(?:opacity|visible|flex|block|inline|inline-flex|inline-block)\b/.test(cls);
      if (!hoverOnly && cs.opacity !== '0' && cs.visibility !== 'hidden') continue;
      // Elements removed with display:none come back with the display their hover rule would give.
      const display = cs.display === 'none' ? (cls.match(/hover:(inline-flex|inline-block|flex|block|inline)\b/)?.[1] || 'block') : '';
      el.setAttribute('data-refinement-always-shown', display);
      titleChrome.marked.add(el);
    }
  }
}
function startTitleChrome() {
  try {
    logseq.provideStyle({ key: 'personal-db-title-chrome', style: `
[data-refinement-always-shown] { opacity: var(--rf-quiet) !important; visibility: visible !important; }
[data-refinement-always-shown]:hover, [data-refinement-always-shown]:focus-within { opacity: 1 !important; }
[data-refinement-always-shown="flex"] { display: flex !important; }
[data-refinement-always-shown="block"] { display: block !important; }
[data-refinement-always-shown="inline"] { display: inline !important; }
[data-refinement-always-shown="inline-flex"] { display: inline-flex !important; }
[data-refinement-always-shown="inline-block"] { display: inline-block !important; }
` });
    watchDom(updateTitleChrome);
    titleChrome.started = true;
    onUnload(() => {
      for (const el of titleChrome.marked) el.removeAttribute('data-refinement-always-shown');
      titleChrome.marked.clear();
    });
  } catch (error) { warnOnce('page title actions stay native', error); }
}
/* Page type: a small muted word under the title of tag pages ("Tag") and property pages
   ("Property"). Ordinary and journal pages get nothing. The word is drawn by CSS from an
   attribute on the title, so nothing is inserted into Logseq's own page structure. */
const pageKind = { byPage: new Map(), shape: null, shapeBox: null, isProperty: false, timer: 0, aliasOf: [], aliasLine: null, tagPath: null, pageUuid: '', plain: false, isTag: false, titleTags: null, tagged: new Set(), offsets: new WeakMap() };
async function loadPageKind() {
  // Lookups can overlap (a page change, then an edit); only the newest one's answer is used.
  const version = pageKind.version = (pageKind.version || 0) + 1;
  let isTag = false, isProperty = false, pageId = 0, aliasOf = [], plain = false, pageUuid = '', tagPath = null, shape = null;
  try {
    const page = await logseq.Editor.getCurrentPage?.();
    pageId = page?.id;
    pageUuid = String(page?.uuid || '');
    if (isEntityId(pageId) && logseq.DB?.datascriptQuery) {
      // Asked together (0.4.150): right after a page change each answer waits behind Logseq loading the page,
      // so the eight questions this used to ask one after another cost eight waits (2.2 s, measured).
      const [rows, originals] = await Promise.all([
        logseq.DB.datascriptQuery(`[:find ?ident
          :where [(identity ${pageId}) ?p] [?p :block/tags ?c] [?c :db/ident ?ident]]`),
        // Logseq records an alias only on the original page; look it up from the alias's side.
        logseq.DB.datascriptQuery(`[:find ?uuid ?title
          :where [(identity ${pageId}) ?p] [?o :block/alias ?p] [?o :block/uuid ?uuid] [?o :block/title ?title]]`),
      ]);
      const idents = new Set((rows || []).map(row => String(row[0]).replace(/^:/, '')));
      isTag = idents.has('logseq.class/Tag');
      isProperty = idents.has('logseq.class/Property');
      plain = idents.size === 1 && idents.has('logseq.class/Page'); // an ordinary page with no tag of its own
      aliasOf = (originals || []).filter(row => UUID.test(String(row[0]))).map(row => [String(row[0]), String(row[1])])
        .sort((a, b) => a[1].localeCompare(b[1]));
      const shapeOf = () => (isTag ? tagShape(pageId) : propertyShape(pageId)).catch(error => { warnOnce('could not read what the page holds', error); return null; });
      if (isTag) [tagPath, shape] = await Promise.all([tagPathOf(pageId), shapeOf()]);
      else if (isProperty) shape = await shapeOf();
    }
  } catch (error) { warnOnce('could not tell the page type', error); }
  if (version !== pageKind.version) return;
  const known = { aliasOf, tagPath, plain, isTag, isProperty, shape, pageUuid };
  if (pageUuid) {
    pageKind.byPage.delete(pageUuid);
    pageKind.byPage.set(pageUuid, known);
    if (pageKind.byPage.size > 60) pageKind.byPage.delete(pageKind.byPage.keys().next().value);
  }
  Object.assign(pageKind, known);
  try { updatePageKind(host()); updateOwnTags(host()); } catch (error) { /* shown on the next change */ }
  // Asked the moment the page changed, Logseq can still have named the page being left: ask once more for the one on screen.
  const titles = [...pageTitles(host())].filter(el => !el.parentElement?.closest(':is(.ls-page-title, .page-title, h1.title)'));
  const shown = titles.length === 1 ? titles[0].querySelector('.ls-block[blockid]')?.getAttribute('blockid') : '';
  if (shown && shown !== pageUuid && pageKind.retried !== shown) { pageKind.retried = shown; schedulePageKind(0); }
}
// Back on a page seen this session: its lines and box are drawn at once from what was found last time, while
// the look-up the page change started checks them again (0.4.150).
function recallPageKind(uuid) {
  const known = uuid && uuid !== pageKind.pageUuid && pageKind.byPage.get(uuid);
  if (known) Object.assign(pageKind, known);
}
function schedulePageKind(delay = 300) {
  clearTimeout(pageKind.timer);
  pageKind.timer = setTimeout(loadPageKind, delay);
}
function updatePageKind(doc) {
  const on = setting('showPageKind');
  const titles = [...pageTitles(doc)].filter(el => !el.parentElement?.closest(':is(.ls-page-title, .page-title, h1.title)'));
  if (titles.length === 1) recallPageKind(titles[0].querySelector('.ls-block[blockid]')?.getAttribute('blockid'));
  // Only a single page view (journals list several titles).
  updateTitleTags(doc, on && titles.length === 1 ? titles[0] : null);
  // What was loaded may still describe the page just left; its lines wait until it is this page's.
  const known = titles.length === 1 && pageKind.pageUuid && titles[0].querySelector('.ls-block[blockid]')?.getAttribute('blockid') === pageKind.pageUuid;
  updateAliasLine(doc, setting('showAliasOf') && known ? titles[0] : null);
  updateShapeBox(doc, setting('showShape') && known ? titles[0] : null);
}
// Opens Logseq's own "Set Tags" list for the page, the way you would by hand: press "Set property"
// in the title's action row, then pick Tags in the menu that opens. The Tags entry is found by its
// built-in id (:block/tags), never by position, so no other property can be picked by mistake.
async function openTagPicker(actions) {
  try {
    const doc = host(), win = doc.defaultView;
    const button = [...(actions?.querySelectorAll('button') || [])].find(b => /^set property$/i.test(b.textContent.trim()));
    if (!button) return notify('Could not find “Set property” above the title. Use it to add Tags.', 'warning');
    button.click();
    const menu = await waitFor(() => doc.querySelector('.ui__popover-content .ls-property-dialog'));
    const input = menu?.querySelector('input.cp__select-input');
    if (!input) return notify('The property menu did not open. Click “Set property”, then choose Tags.', 'warning');
    const tagsEntry = () => menu.querySelector('a.menu-link:has([title=":block/tags"])');
    const setValue = value => {
      Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new win.Event('input', { bubbles: true }));
    };
    // The menu lists a few properties at first; typing narrows it to Tags.
    if (!tagsEntry()) setValue('Tags');
    const entry = await waitFor(tagsEntry, 2000);
    // Leave nothing typed: Enter on a leftover "Tags" could make Logseq create a new property.
    if (!entry) { if (input.isConnected) setValue(''); return notify('Choose Tags in the menu that opened.', 'warning'); }
    entry.click();
  } catch (error) { console.error(error); notify(`Could not open the tag list: ${error.message}`, 'warning'); }
}
// The page's tags sit beside the actions above its title ("Set property  #Person  #Client") instead
// of at the far right edge of the title row. They are Logseq's own tags, shifted into place, so they
// appear with the page and their # still opens Logseq's tag menu. Only the shift is the plugin's.
// A page with no tag of its own gets a plain "#Page" in the same spot.
function updateTitleTags(doc, title) {
  const row = title?.querySelector('.is-page-title-row');
  const actions = row?.querySelector('.ls-page-title-actions > div');
  const native = row?.querySelector('.ls-block-right .block-tags');
  const hasTags = Boolean(actions && native?.querySelector('a.tag'));
  // Watch the row the tags sit in: when it changes size, the tags are placed again.
  if (pageKind.sizeWatch && (row || null) !== (pageKind.sizedRow || null)) {
    if (pageKind.sizedRow) pageKind.sizeWatch.unobserve(pageKind.sizedRow);
    if (row) pageKind.sizeWatch.observe(row);
    pageKind.sizedRow = row || null;
  }
  for (const el of pageKind.tagged) {
    if (el === native && hasTags) continue;
    el.style.transform = '';
    pageKind.offsets.delete(el);
    pageKind.tagged.delete(el);
  }
  let chip = pageKind.titleTags;
  if (hasTags) {
    chip?.remove();
    // Where the tags are now, less the shift already applied, is where Logseq put them.
    const last = [...actions.children].filter(el => el !== chip).pop() || actions;
    const to = last.getBoundingClientRect(), from = native.getBoundingClientRect();
    const [dx0, dy0] = pageKind.offsets.get(native) || [0, 0];
    const dx = Math.round(to.right + 10 - (from.left - dx0)), dy = Math.round(to.top + (to.height - from.height) / 2 - (from.top - dy0));
    if (dx !== dx0 || dy !== dy0 || !native.style.transform) {
      native.style.transform = `translate(${dx}px, ${dy}px)`;
      pageKind.offsets.set(native, [dx, dy]);
    }
    pageKind.tagged.add(native);
    return;
  }
  // No tag of its own: "#Page", shown at once unless the title is a date (journals are not #Page),
  // and corrected if the database then says otherwise.
  const known = pageKind.pageUuid && title?.querySelector('.ls-block[blockid]')?.getAttribute('blockid') === pageKind.pageUuid;
  const name = row?.querySelector('.block-title-wrap')?.textContent || '';
  const plain = actions && (known ? pageKind.plain : Boolean(name) && !isJournalDate(name));
  if (!plain) { chip?.remove(); return; }
  if (!chip || chip.ownerDocument !== doc) {
    chip = pageKind.titleTags = doc.createElement('a');
    chip.className = 'refinement-title-tags';
    chip.textContent = 'Page';
    chip.setAttribute('role', 'button');
    chip.setAttribute('title', 'Add a tag to this page');
    // A second press closes the list. Logseq closes a pop-up as soon as you press outside it, so
    // whether one was open has to be noted when the press starts, before the click arrives.
    let wasOpen = false;
    const popover = () => doc.querySelector('.ui__popover-content');
    chip.addEventListener('pointerdown', () => { wasOpen = Boolean(popover()); }, true);
    chip.addEventListener('mousedown', event => event.stopPropagation());
    chip.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      if (!wasOpen) return openTagPicker(chip.parentElement);
      wasOpen = false;
      if (popover()) (doc.activeElement || doc.body).dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
    });
  }
  if (chip.parentElement !== actions) actions.appendChild(chip);
}
// Small lines under a page title go below the row the title sits in (beside its icon or buttons),
// not squeezed in next to it.
function titleAnchor(doc, title) {
  let anchor = title;
  const win = doc.defaultView;
  while (anchor.parentElement && anchor.parentElement.id !== 'main-content-container') {
    const cs = win.getComputedStyle(anchor.parentElement);
    if (!cs.display.includes('flex') || cs.flexDirection.startsWith('column')) break;
    anchor = anchor.parentElement;
  }
  return anchor;
}
function openTitleNoteLink(event) {
  const link = event.target.closest('a[data-uuid]');
  if (!link) return;
  event.preventDefault();
  openEntity(link.getAttribute('data-uuid'), event.shiftKey);
}
// Where a tag sits: the chain of tags it extends, from the top down, following the first parent at
// each step, plus any other tag it sits directly under. A tag's place in the owner's tree is what
// makes it a tag, so the shape box's top line says it (0.4.151; it was a line of its own under the title).
async function tagPathOf(tagId) {
  const parents = new Map();
  for (const [child, parent] of await dsQuery(`[:find ?child ?parent :where [?child :logseq.property.class/extends ?parent]]`)) {
    if (!parents.has(child)) parents.set(child, []);
    parents.get(child).push(parent);
  }
  const direct = parents.get(tagId) || [];
  if (!direct.length) return null;
  const chain = [], seen = new Set([tagId]);
  for (let id = direct[0]; id && !seen.has(id) && chain.length < 12; id = (parents.get(id) || [])[0]) { seen.add(id); chain.unshift(id); }
  const others = direct.slice(1).filter(id => !chain.includes(id));
  // Logseq's own classes (Root Tag, which every tag extends; Task; Card …) are not part of the owner's tree.
  const rows = await dsQuery(`[:find ?t ?uuid ?title ?ident :where ${idsIn('?t', [...chain, ...others])} [?t :block/uuid ?uuid] [?t :block/title ?title] [(get-else $ ?t :db/ident :none) ?ident]]`);
  const byId = new Map(rows.filter(([, , , ident]) => !/^:?logseq\.class\//.test(String(ident))).map(([t, uuid, title]) => [t, { uuid: String(uuid), title: String(title) }]));
  const named = ids => ids.map(id => byId.get(id)).filter(Boolean);
  return { chain: named(chain), others: named(others) };
}
// What a tag or property holds, in a small box under the title (showShape). A tag page shows the
// record it defines: each field with what it takes, the inherited ones faint. A property page shows
// what it takes and its most used values with bars. Both say so when the shape looks off for the
// model: a child tag that adds no field of its own, free text that only ever holds a few words.
// The box is closed to its top line until you click it (0.4.151), so arriving after the page it moves
// the page by one line; open or closed is remembered. A tag's top line is where it sits (#Entity ›
// #Person › #Doctor) and how many fields it has.
const SHAPE_OPEN_KEY = 'refinement-shape-open';
const shapeOpen = () => { try { return localStorage.getItem(SHAPE_OPEN_KEY) === '1'; } catch (error) { return false; } };
function toggleShape(event) {
  if (event.target.closest('a[data-uuid]')) return openTitleNoteLink(event);
  if (!event.target.closest('.rf-shape-hd') || !pageKind.shapeBox?.hasAttribute('data-body')) return;
  const open = !pageKind.shapeBox.hasAttribute('data-open');
  pageKind.shapeBox.toggleAttribute('data-open', open);
  try { localStorage.setItem(SHAPE_OPEN_KEY, open ? '1' : '0'); } catch (error) { /* kept for this page only */ }
}
const SHAPE_VALUES = 5;
function takesWords(prop) {
  const tags = list => list.map(c => `<span class="rf-cls">${escapeHtml(c.title)}</span>`).join(', ');
  const many = prop.many ? ' · many' : '';
  switch (prop.type) {
    case 'node': return `→ ${prop.classes.length ? tags(prop.classes) : 'any page'}${many}`;
    case 'default': {
      if (!prop.choices.length) return `text${many}`;
      const first = prop.choices.slice(0, 3).map(c => escapeHtml(c.title)).join(', ');
      return `${prop.many ? 'any of' : 'one of'} ${first}${prop.choices.length > 3 ? ' …' : ''}`;
    }
    case 'date': return `date${many}`;
    case 'datetime': return `date and time${many}`;
    case 'number': return `number${many}`;
    case 'checkbox': return 'yes or no';
    case 'url': return `web link${many}`;
    default: return escapeHtml(prop.type) + many;
  }
}
async function tagShape(tagId) {
  const schema = await provided.propSchema?.();
  if (!schema) return null;
  const fields = [], seen = new Set(), visited = new Set();
  // Own fields first, then each parent's, nearest first.
  const queue = [[tagId, null]];
  while (queue.length) {
    const [c, from] = queue.shift();
    if (visited.has(c)) continue;
    visited.add(c);
    for (const id of schema.classProps.get(c) || []) {
      const prop = schema.byId.get(id);
      if (prop && !seen.has(prop.id)) { seen.add(prop.id); fields.push({ prop, from }); }
    }
    for (const parent of schema.parentsOf.get(c) || []) queue.push([parent, parent]);
  }
  const fromIds = [...new Set(fields.map(f => f.from).filter(Boolean))];
  // Asked together (0.4.150).
  const [fromRows, [[count] = [0]], [[name] = ['']]] = await Promise.all([
    fromIds.length ? dsQuery(`[:find ?t ?title :where ${idsIn('?t', fromIds)} [?t :block/title ?title]]`) : [],
    dsQuery(`[:find (count ?b) :where [?b :block/tags ${tagId}]]`),
    dsQuery(`[:find ?title :where [(identity ${tagId}) ?t] [?t :block/title ?title]]`),
  ]);
  const names = new Map(fromRows.map(([t, title]) => [t, String(title)]));
  const ownParents = (schema.parentsOf.get(tagId) || []).length > 0;
  return { kind: 'tag', name: String(name), count: Number(count) || 0, adds: fields.some(f => !f.from), hasParent: ownParents,
    fields: fields.map(({ prop, from }) => ({ uuid: prop.uuid, title: prop.title, takes: takesWords(prop), from: from ? names.get(from) || '' : '' })) };
}
async function propertyShape(pageId) {
  const schema = await provided.propSchema?.();
  const prop = schema?.byId.get(pageId);
  if (!prop || !/^[\w.-]+\/[\w.-]+$/.test(prop.ident)) return null;
  // Every block and value pair, counted here: one plain query, no aggregates.
  const pairs = await dsQuery(`[:find ?b ?v :in $ :where [?b :${prop.ident} ?v]]`);
  const tally = new Map(), holders = new Set();
  for (const [b, v] of pairs) { holders.add(b); tally.set(v, (tally.get(v) || 0) + 1); }
  const blocks = holders.size, rows = [...tally].sort((a, b) => b[1] - a[1]);
  const top = rows.slice(0, SHAPE_VALUES), ids = top.map(([v]) => v).filter(v => typeof v === 'number');
  const byId = new Map();
  if (ids.length) {
    for (const [e] of await dsQuery(`[:find (pull ?e [:db/id :block/uuid :block/title :block/name :logseq.property/value]) :in $ :where ${idsIn('?e', ids)}]`)) {
      const id = e?.['db/id'] ?? e?.[':db/id'] ?? e?.id;
      const title = e?.['block/title'] ?? e?.[':block/title'] ?? e?.title ?? e?.['logseq.property/value'] ?? e?.[':logseq.property/value'] ?? e?.value;
      const isPage = Boolean(e?.['block/name'] ?? e?.[':block/name'] ?? e?.name);
      byId.set(id, { title: String(title ?? ''), uuid: isPage ? String(e?.['block/uuid'] ?? e?.[':block/uuid'] ?? e?.uuid ?? '') : '' });
    }
  }
  const values = top.map(([v, n]) => {
    const known = byId.get(v);
    const title = known ? known.title : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v);
    return { title: title || '(empty)', uuid: known?.uuid || '', count: Number(n) || 0 };
  });
  const rest = rows.slice(SHAPE_VALUES).reduce((sum, [, n]) => sum + (Number(n) || 0), 0);
  const freeText = prop.type === 'default' && !prop.choices.length;
  return { kind: 'property', takes: takesWords(prop), blocks: Number(blocks) || 0, distinct: rows.length, values, more: rows.length - top.length, rest, freeText };
}
function updateShapeBox(doc, title) {
  const shape = title && (pageKind.isTag || pageKind.isProperty) ? pageKind.shape : null;
  let box = pageKind.shapeBox;
  if (!shape) { box?.remove(); return; }
  if (!box || box.ownerDocument !== doc) {
    box = pageKind.shapeBox = doc.createElement('div');
    box.className = 'refinement-shape';
    box.toggleAttribute('data-open', shapeOpen());
    box.addEventListener('click', toggleShape);
  }
  const link = (uuid, text) => uuid && UUID.test(uuid) ? `<a data-uuid="${escapeHtml(uuid)}" href="#" title="Open ${text}">${text}</a>` : text;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  let head, side, body = '';
  if (shape.kind === 'tag') {
    const tagLink = tag => `<a class="rf-tag" data-uuid="${escapeHtml(tag.uuid)}" href="#" title="Open ${escapeHtml(tag.title)}"><span class="rf-hash">#</span>${escapeHtml(tag.title)}</a>`;
    const path = pageKind.tagPath || { chain: [], others: [] };
    const where = [...path.chain.map(tagLink), `<span class="rf-own"><span class="rf-hash">#</span>${escapeHtml(shape.name)}</span>`].join(' <span class="rf-sep">›</span> ')
      + (path.others.length ? ` <span class="rf-sep">·</span> also under ${path.others.map(tagLink).join(', ')}` : '');
    head = `${where} <span class="rf-sep">·</span> <span class="rf-q">${shape.fields.length ? plural(shape.fields.length, 'field', 'fields') : 'no fields yet'}</span>`;
    side = `${shape.count} tagged`;
    const rows = shape.fields.map(f => `<div class="rf-shape-row${f.from ? ' rf-from' : ''}"><span class="rf-shape-name">${link(f.uuid, escapeHtml(f.title))}</span><span class="rf-shape-takes">${f.takes}${f.from ? ` · from <span class="rf-cls">${escapeHtml(f.from)}</span>` : ''}</span></div>`).join('');
    const hint = shape.hasParent && !shape.adds ? `<div class="rf-shape-hint">Adds no field of its own to what it inherits.</div>` : '';
    body = (rows ? `<div class="rf-shape-bd">${rows}</div>` : '') + hint;
  } else {
    const max = Math.max(1, ...shape.values.map(v => v.count));
    const rows = shape.values.map(v => `<div class="rf-shape-row"><span class="rf-shape-name">${link(v.uuid, escapeHtml(v.title))}</span><span class="rf-bar"><i style="width:${Math.round(v.count / max * 100)}%"></i></span><span class="rf-n">${v.count}</span></div>`).join('')
      + (shape.more ? `<div class="rf-shape-row rf-from"><span class="rf-shape-name">${plural(shape.more, 'other', 'others')}</span><span></span><span class="rf-n">${shape.rest}</span></div>` : '');
    const few = shape.freeText && shape.blocks >= 8 && shape.distinct <= 5;
    const hint = few ? `<div class="rf-shape-hint">Only ${plural(shape.distinct, 'different value', 'different values')}: a choice list may fit.</div>` : '';
    head = `<span class="rf-q">${shape.takes}</span>`;
    side = `${plural(shape.blocks, 'block', 'blocks')}${shape.freeText && shape.blocks ? ` · ${shape.distinct} different` : ''}`;
    body = (rows ? `<div class="rf-shape-bd rf-values">${rows}</div>` : '') + hint;
  }
  const html = `<div class="rf-shape-hd"><span>${head}</span><span class="rf-q">${side}${body ? '<span class="rf-fold"></span>' : ''}</span></div>${body}`;
  box.toggleAttribute('data-body', Boolean(body));
  if (box.dataset.key !== html) { box.dataset.key = html; box.innerHTML = html; }
  // After the Alias of line when there is one, else right under the title row.
  const after = pageKind.aliasLine?.isConnected && pageKind.aliasLine.ownerDocument === doc ? pageKind.aliasLine : titleAnchor(doc, title);
  if (after.nextElementSibling !== box) after.after(box);
}
// "Alias of <page>" under the title of a page that another page lists as its alias.
function updateAliasLine(doc, title) {
  const originals = title ? pageKind.aliasOf : [];
  const key = originals.map(([uuid]) => uuid).join(',');
  let line = pageKind.aliasLine;
  if (!originals.length) { line?.remove(); return; }
  if (!line || line.ownerDocument !== doc) {
    line = pageKind.aliasLine = doc.createElement('div');
    line.className = 'refinement-alias-of';
    line.addEventListener('click', openTitleNoteLink);
  }
  if (line.dataset.key !== key) {
    line.dataset.key = key;
    line.innerHTML = 'Alias of ' + originals.map(([uuid, name]) =>
      `<a data-uuid="${uuid}" href="#" title="Open ${escapeHtml(name)}">${escapeHtml(name)}</a>`).join(', ');
  }
  const anchor = titleAnchor(doc, title);
  if (anchor.nextElementSibling !== line) anchor.after(line);
}
function startPageKind() {
  try {
    logseq.provideStyle({ key: 'personal-db-page-kind', style: `
/* "#Page" on a page with no tag of its own, in the row of actions above the title. */
.refinement-title-tags { margin-left: .6rem; font-size: .75rem; /* rem, not --rf-small: the title row's own font is large */ line-height: 1.5rem; white-space: nowrap; color: var(--ls-link-text-color, inherit); cursor: pointer; text-decoration: none; }
.refinement-title-tags:hover { text-decoration: underline; }
:is(.refinement-alias-of, .refinement-usage) {
  margin: .15rem 0 .25rem;
  font-size: var(--rf-small);
  font-weight: 400;
  line-height: 1.3;
  color: var(--ls-primary-text-color, currentColor);
  opacity: var(--rf-quiet);
}
:is(.refinement-alias-of, .refinement-usage) a { color: inherit; text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor var(--rf-line-pct), transparent); cursor: pointer; }
/* How the page is used: each count mirrors the rows it stands for. All dark while every row shows; while one is
   chosen, the others step back exactly as their rows do (--rf-back). Beside the Linked references heading. */
.refinement-usage { opacity: 1; color: var(--ls-primary-text-color, currentColor); }
.refinement-usage.rf-at-heading { display: flex; align-items: baseline; margin: 0 0 .6rem; }
.refinement-usage a { text-decoration: none !important; color: inherit; padding: 0; transition: opacity .15s; }
.refinement-usage a .rf-n { opacity: var(--rf-quiet); font-variant-numeric: tabular-nums; }
.refinement-usage[data-filtered] a:not([data-on]) { opacity: var(--rf-back); }
.refinement-usage a:hover { opacity: 1; }
.refinement-usage .rf-gap { display: inline-block; width: 1em; }
:is(.refinement-alias-of, .refinement-usage) a:hover { color: var(--ls-primary-text-color, currentColor); }
/* What a tag or property holds: a small box on the faint property field, names and what they take in two columns. */
.refinement-shape { max-width: 34rem; margin: .5rem 0 .75rem; font-size: var(--rf-small); line-height: 1.45; border: 1px solid color-mix(in srgb, var(--ls-primary-text-color, currentColor) var(--rf-hair-pct), transparent); border-radius: var(--rf-popup-radius); overflow: hidden; }
.refinement-shape .rf-shape-hd { display: flex; justify-content: space-between; gap: 1rem; padding: .3rem .65rem; background: color-mix(in srgb, var(--ls-primary-text-color, currentColor) var(--rf-field-pct), transparent); color: var(--ls-primary-text-color, currentColor); }
.refinement-shape .rf-q { opacity: var(--rf-quiet); }
.refinement-shape .rf-shape-hd > span:last-child { font-variant-numeric: tabular-nums; white-space: nowrap; }
/* Closed to its top line until clicked; the triangle says which. */
.refinement-shape[data-body] .rf-shape-hd { cursor: pointer; }
.refinement-shape:not([data-open]) > :not(.rf-shape-hd) { display: none; }
.refinement-shape .rf-fold::after { content: '▸'; display: inline-block; margin-left: .5em; opacity: var(--rf-faint); }
.refinement-shape[data-open] .rf-fold::after { content: '▾'; }
.refinement-shape .rf-hash { color: var(--rf-tag-color); }
.refinement-shape .rf-sep { opacity: var(--rf-faint); margin: 0 .1em; }
.refinement-shape .rf-shape-hd a.rf-tag { opacity: var(--rf-quiet); }
.refinement-shape .rf-shape-bd { display: grid; grid-template-columns: max-content 1fr; gap: .1rem 1.1rem; padding: .4rem .65rem; border-top: 1px solid color-mix(in srgb, var(--ls-primary-text-color, currentColor) var(--rf-hair-pct), transparent); }
.refinement-shape .rf-shape-bd.rf-values { grid-template-columns: max-content minmax(4rem, 1fr) max-content; align-items: center; }
.refinement-shape .rf-shape-row { display: contents; }
.refinement-shape .rf-shape-name { color: var(--ls-primary-text-color, currentColor); }
.refinement-shape .rf-shape-takes { color: var(--ls-primary-text-color, currentColor); opacity: var(--rf-quiet); }
.refinement-shape .rf-from > * { opacity: var(--rf-faint); }
.refinement-shape .rf-cls { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .92em; }
.refinement-shape a { color: inherit; text-decoration: none; cursor: pointer; }
.refinement-shape a:hover { text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor var(--rf-line-pct), transparent); }
.refinement-shape .rf-bar { height: 5px; border-radius: 3px; background: color-mix(in srgb, var(--ls-primary-text-color, currentColor) var(--rf-wash-pct), transparent); position: relative; }
.refinement-shape .rf-bar i { position: absolute; inset: 0 auto 0 0; border-radius: 3px; background: var(--ls-primary-text-color, currentColor); opacity: .3; }
.refinement-shape .rf-n { font-variant-numeric: tabular-nums; opacity: var(--rf-quiet); text-align: right; }
.refinement-shape .rf-shape-hint { padding: .3rem .65rem; border-top: 1px dashed color-mix(in srgb, var(--ls-primary-text-color, currentColor) var(--rf-hair-pct), transparent); opacity: var(--rf-quiet); }` });
    for (const stray of host().querySelectorAll('.refinement-inherited, .refinement-tag-path')) stray.remove(); // left by an earlier version
    watchDom(updatePageKind);
    // The later pass can land a frame after Logseq draws a title (measured: about one pass in four
    // while moving between pages), which showed the tags at the far right first. So when a change
    // touches a page title, the title's parts are placed at once as well.
    watchDomEarly(function titleEarly(doc, records) {
      if (!touchesTitle(records)) return;
      if (titleChrome.started) updateTitleChrome(doc);
      updatePageKind(doc);
    });
    onUnload(() => { pageKind.stopped = true; });
    // The tags are placed by measuring, so place them again when the window changes size, and
    // whenever the page area or the title row does (a sidebar opening or closing, a title wrapping
    // onto a second line). The browser reports those size changes before it draws the frame.
    const place = () => { try { updatePageKind(host()); } catch (error) { /* placed on the next change */ } };
    listen(host().defaultView, ['resize'], place);
    const SizeWatch = host().defaultView.ResizeObserver;
    if (SizeWatch) {
      pageKind.sizeWatch = new SizeWatch(place);
      const area = host().getElementById('main-content-container');
      if (area) pageKind.sizeWatch.observe(area);
      onUnload(() => { pageKind.sizeWatch.disconnect(); pageKind.sizeWatch = null; pageKind.sizedRow = null; });
    }
    loadPageKind();
    onUnload(() => {
      clearTimeout(pageKind.timer);
      pageKind.aliasLine?.remove();
      pageKind.shapeBox?.remove();
      pageKind.titleTags?.remove();
      for (const el of pageKind.tagged) el.style.transform = '';
      pageKind.tagged.clear();
    });
  } catch (error) { warnOnce('page type label is unavailable', error); }
}

function provide(core) {
  core.provide({ startTitleChrome, startPageKind, schedulePageKind, updatePageKind, loadPageKind, pageKind, pageTitles, pageHeaderOf, openTagPicker, titleAnchor });
  core.onDbRound('loadPageKind', loadPageKind);
}
function start() {
  const core = window.refinementCore;
  provided = core.provided;
  ({ setting, dsQuery, UUID, isEntityId, idsIn, watchDom, watchDomEarly, PAGE_TITLE, escapeHtml, attribute, isJournalDate, updateOwnTags } =
    take(core, ['setting', 'dsQuery', 'UUID', 'isEntityId', 'idsIn', 'watchDom', 'watchDomEarly', 'PAGE_TITLE', 'escapeHtml', 'attribute', 'isJournalDate', 'updateOwnTags']));
}
(window.refinementParts ||= []).push({ name: 'pages', schema: [], provide, start, stop: runUnloadTasks });
})();
