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
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements: ' });
// From the core and the other parts, taken when the part starts (after every part has provided its own).
let setting, dsQuery, UUID, isEntityId, idsIn, watchDom, watchDomEarly, addsElements, PAGE_TITLE, escapeHtml, attribute;
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
const pageKind = { timer: 0, aliasOf: [], aliasLine: null, tagPath: null, pathLine: null, inheritedBy: new Map(), inheritedAsked: new Set(), inheritLine: null, pageUuid: '', plain: false, isTag: false, titleTags: null, tagged: new Set(), offsets: new WeakMap() };
async function loadPageKind() {
  // Lookups can overlap (a page change, then an edit); only the newest one's answer is used.
  const version = pageKind.version = (pageKind.version || 0) + 1;
  let isTag = false, pageId = 0, aliasOf = [], inherited = [], plain = false, pageUuid = '', tagPath = null;
  try {
    const page = await logseq.Editor.getCurrentPage?.();
    pageId = page?.id;
    pageUuid = String(page?.uuid || '');
    if (isEntityId(pageId) && logseq.DB?.datascriptQuery) {
      const rows = await logseq.DB.datascriptQuery(`[:find ?ident
        :where [(identity ${pageId}) ?p] [?p :block/tags ?c] [?c :db/ident ?ident]]`);
      const idents = new Set((rows || []).map(row => String(row[0]).replace(/^:/, '')));
      isTag = idents.has('logseq.class/Tag');
      plain = idents.size === 1 && idents.has('logseq.class/Page'); // an ordinary page with no tag of its own
      // Logseq records an alias only on the original page; look it up from the alias's side.
      const originals = await logseq.DB.datascriptQuery(`[:find ?uuid ?title
        :where [(identity ${pageId}) ?p] [?o :block/alias ?p] [?o :block/uuid ?uuid] [?o :block/title ?title]]`);
      aliasOf = (originals || []).filter(row => UUID.test(String(row[0]))).map(row => [String(row[0]), String(row[1])])
        .sort((a, b) => a[1].localeCompare(b[1]));
      if (isTag) { inherited = await inheritedTagProperties(pageId); tagPath = await tagPathOf(pageId); }
    }
  } catch (error) { warnOnce('could not tell the page type', error); }
  if (version !== pageKind.version) return;
  pageKind.aliasOf = aliasOf;
  pageKind.tagPath = tagPath;
  if (pageUuid) pageKind.inheritedBy.set(pageUuid, inherited);
  pageKind.plain = plain;
  pageKind.isTag = isTag;
  pageKind.pageUuid = pageUuid;
  try { updatePageKind(host()); updateOwnTags(host()); } catch (error) { /* shown on the next change */ }
}
function schedulePageKind(delay = 300) {
  clearTimeout(pageKind.timer);
  pageKind.timer = setTimeout(loadPageKind, delay);
}
function updatePageKind(doc) {
  const on = setting('showPageKind');
  const titles = [...pageTitles(doc)].filter(el => !el.parentElement?.closest(':is(.ls-page-title, .page-title, h1.title)'));
  // Only a single page view (journals list several titles).
  updateTitleTags(doc, on && titles.length === 1 ? titles[0] : null);
  // What was loaded may still describe the page just left; its lines wait until it is this page's.
  const known = titles.length === 1 && pageKind.pageUuid && titles[0].querySelector('.ls-block[blockid]')?.getAttribute('blockid') === pageKind.pageUuid;
  updateAliasLine(doc, setting('showAliasOf') && known ? titles[0] : null);
  updateTagPathLine(doc, setting('showTagPath') && known && pageKind.isTag ? titles[0] : null);
  updateInheritedLine(doc, setting('showInherited') && titles.length === 1 ? titles[0] : null);
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
    chip.textContent = '#Page';
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
// For a tag page: the properties its records get from the tags it extends, nearest tag first.
// Logseq's own list on a tag page shows only the properties added to that tag itself.
async function inheritedTagProperties(tagId) {
  const parents = new Map();
  for (const [child, parent] of await dsQuery(`[:find ?child ?parent :where [?child :logseq.property.class/extends ?parent]]`)) {
    if (!parents.has(child)) parents.set(child, []);
    parents.get(child).push(parent);
  }
  const order = [], seen = new Set([tagId]);
  for (let level = parents.get(tagId) || []; level.length;) {
    const next = [];
    for (const id of level) {
      if (seen.has(id)) continue;
      seen.add(id); order.push(id); next.push(...(parents.get(id) || []));
    }
    level = next;
  }
  if (!order.length) return [];
  const rows = await dsQuery(`[:find ?t ?tuuid ?ttitle ?puuid ?ptitle
    :where ${idsIn('?t', order)} [?t :logseq.property.class/properties ?p]
    (not [?p :logseq.property/hide? true])
    [?t :block/uuid ?tuuid] [?t :block/title ?ttitle] [?p :block/uuid ?puuid] [?p :block/title ?ptitle]]`);
  const byTag = new Map();
  for (const [t, tuuid, ttitle, puuid, ptitle] of rows) {
    if (!byTag.has(t)) byTag.set(t, { uuid: String(tuuid), title: String(ttitle), props: [] });
    byTag.get(t).props.push([String(puuid), String(ptitle)]);
  }
  return order.filter(id => byTag.has(id)).map(id => {
    const tag = byTag.get(id);
    tag.props.sort((a, b) => a[1].localeCompare(b[1]));
    return tag;
  });
}
// "Inherited from #Media: keywords, rating, website" on a tag page, one line per parent tag. It
// closes Logseq's own "Tag Properties" list, so it is there only while the title's triangle has
// the page's properties open.
// What is shown is looked up by the uuid of the page on screen and kept, so the line arrives with
// the list instead of after the page's other details have loaded.
async function loadInherited(uuid) {
  pageKind.inheritedAsked.add(uuid);
  let inherited = [];
  try {
    const rows = await dsQuery(`[:find ?p :where [?p :block/uuid #uuid "${uuid}"] [?p :block/tags ?c] [?c :db/ident :logseq.class/Tag]]`);
    if (rows.length) inherited = await inheritedTagProperties(rows[0][0]);
  } catch (error) { warnOnce('could not read inherited properties', error); }
  pageKind.inheritedBy.set(uuid, inherited);
  pageKind.inheritedAsked.delete(uuid);
  try { updateInheritedLine(host(), currentTitle(host())); } catch (error) { /* shown on the next change */ }
}
function currentTitle(doc) {
  const titles = [...pageTitles(doc)].filter(el => !el.parentElement?.closest(':is(.ls-page-title, .page-title, h1.title)'));
  return setting('showInherited') && titles.length === 1 ? titles[0] : null;
}
function updateInheritedLine(doc, title) {
  if (pageKind.stopped) return;
  const uuid = title?.querySelector('.ls-block[blockid]')?.getAttribute('blockid') || '';
  if (UUID.test(uuid) && !pageKind.inheritedBy.has(uuid) && !pageKind.inheritedAsked.has(uuid)) loadInherited(uuid);
  const tags = pageKind.inheritedBy.get(uuid) || [];
  let line = pageKind.inheritLine;
  const section = tags.length ? title.querySelector('.ls-page-properties > :not(.properties-panel)') : null;
  if (!section) { line?.remove(); return; }
  if (!line || line.ownerDocument !== doc) {
    line = pageKind.inheritLine = doc.createElement('div');
    line.className = 'refinement-inherited';
    line.addEventListener('click', openTitleNoteLink);
  }
  const link = ([uuid, name]) => `<a data-uuid="${escapeHtml(uuid)}" href="#" title="Open ${escapeHtml(name)}">${escapeHtml(name)}</a>`;
  const tagLink = tag => `<a class="rf-tag" data-uuid="${escapeHtml(tag.uuid)}" href="#" title="Open ${escapeHtml(tag.title)}">#${escapeHtml(tag.title)}</a>`;
  const html = tags.map(tag => `<div>Inherited from ${tagLink(tag)}: ${tag.props.map(link).join(', ')}</div>`).join('');
  if (pageKind.inheritHtml !== html || !line.firstChild) { pageKind.inheritHtml = html; line.innerHTML = html; }
  if (section.lastElementChild !== line) section.appendChild(line);
}
// Where a tag sits: the chain of tags it extends, from the top down, following the first parent at
// each step, plus any other tag it sits directly under. A tag's place in the owner's tree is what
// makes it a tag, so the page says it under the title.
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
function updateTagPathLine(doc, title) {
  const path = title ? pageKind.tagPath : null;
  let line = pageKind.pathLine;
  if (!path || !path.chain.length && !path.others.length) { line?.remove(); return; }
  if (!line || line.ownerDocument !== doc) {
    line = pageKind.pathLine = doc.createElement('div');
    line.className = 'refinement-tag-path';
    line.addEventListener('click', openTitleNoteLink);
  }
  const tagLink = tag => `<a class="rf-tag" data-uuid="${escapeHtml(tag.uuid)}" href="#" title="Open ${escapeHtml(tag.title)}"><span class="rf-hash">#</span>${escapeHtml(tag.title)}</a>`;
  const own = title.querySelector('.block-title-wrap')?.textContent.trim() || '';
  const parts = [...path.chain.map(tagLink), `<span class="rf-own"><span class="rf-hash">#</span>${escapeHtml(own)}</span>`];
  const html = parts.join(' <span class="rf-sep">›</span> ') + (path.others.length ? ` <span class="rf-sep">·</span> also under ${path.others.map(tagLink).join(', ')}` : '');
  if (line.dataset.key !== html) { line.dataset.key = html; line.innerHTML = html; }
  // After the Alias of line when there is one, else right under the title row.
  const after = pageKind.aliasLine?.isConnected && pageKind.aliasLine.ownerDocument === doc ? pageKind.aliasLine : titleAnchor(doc, title);
  if (after.nextElementSibling !== line) after.after(line);
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
.refinement-title-tags { margin-left: .6rem; font-size: var(--rf-small); line-height: 1.5rem; white-space: nowrap; color: var(--ls-link-text-color, inherit); cursor: pointer; text-decoration: none; }
.refinement-title-tags:hover { text-decoration: underline; }
:is(.refinement-alias-of, .refinement-inherited, .refinement-tag-path, .refinement-usage) {
  margin: .15rem 0 .25rem;
  font-size: var(--rf-small);
  font-weight: 400;
  line-height: 1.3;
  color: var(--ls-primary-text-color, currentColor);
  opacity: var(--rf-quiet);
}
:is(.refinement-alias-of, .refinement-inherited, .refinement-tag-path, .refinement-usage) a { color: inherit; text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor var(--rf-line-pct), transparent); cursor: pointer; }
:is(.refinement-inherited, .refinement-tag-path) a.rf-tag { text-decoration: none; }
.refinement-tag-path .rf-hash { color: var(--rf-tag-color); }
.refinement-tag-path .rf-own { color: var(--ls-primary-text-color, currentColor); }
.refinement-tag-path .rf-sep { opacity: var(--rf-faint); margin: 0 .1em; }
/* How the page is used: each count mirrors the rows it stands for. All dark while every row shows; while one is
   chosen, the others step back exactly as their rows do (--rf-back). Beside the Linked references heading. */
.refinement-usage { opacity: 1; color: var(--ls-primary-text-color, currentColor); }
.refinement-usage.rf-at-heading { display: inline-flex; align-items: baseline; margin: 0 0 0 1.2em; vertical-align: baseline; }
.refinement-usage a { text-decoration: none !important; color: inherit; padding: 0; transition: opacity .15s; }
.refinement-usage a .rf-n { opacity: var(--rf-quiet); font-variant-numeric: tabular-nums; }
.refinement-usage[data-filtered] a:not([data-on]) { opacity: var(--rf-back); }
.refinement-usage a:hover { opacity: 1; }
.refinement-usage .rf-gap { display: inline-block; width: 1em; }
.ls-page-properties .refinement-inherited { margin: .25rem 0 0 1.25rem; }
:is(.refinement-alias-of, .refinement-inherited, .refinement-tag-path, .refinement-usage) a:hover { color: var(--ls-primary-text-color, currentColor); }` });
    for (const stray of host().querySelectorAll('.refinement-inherited')) stray.remove(); // left by an earlier load
    watchDom(updatePageKind);
    // The later pass can land a frame after Logseq draws a title (measured: about one pass in four
    // while moving between pages), which showed the tags at the far right first. So when a change
    // touches a page title, the title's parts are placed at once as well.
    watchDomEarly(function titleEarly(doc, records) {
      if (!touchesTitle(records)) return;
      if (titleChrome.started) updateTitleChrome(doc);
      updatePageKind(doc);
    });
    // The inherited line is put in the moment the property list is, so the two are painted together.
    watchDomEarly(function inheritedLineEarly(doc, records) {
      if (addsElements(records)) updateInheritedLine(doc, currentTitle(doc));
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
      pageKind.pathLine?.remove();
      pageKind.inheritLine?.remove();
      pageKind.titleTags?.remove();
      for (const el of pageKind.tagged) el.style.transform = '';
      pageKind.tagged.clear();
    });
  } catch (error) { warnOnce('page type label is unavailable', error); }
}

function provide(core) {
  core.provide({ startTitleChrome, startPageKind, schedulePageKind, updatePageKind, loadPageKind, pageKind, pageTitles, pageHeaderOf, openTagPicker, currentTitle, titleAnchor });
  core.onDbRound('loadPageKind', loadPageKind);
}
function start() {
  const core = window.refinementCore;
  provided = core.provided;
  ({ setting, dsQuery, UUID, isEntityId, idsIn, watchDom, watchDomEarly, addsElements, PAGE_TITLE, escapeHtml, attribute, isJournalDate, updateOwnTags } =
    take(core, ['setting', 'dsQuery', 'UUID', 'isEntityId', 'idsIn', 'watchDom', 'watchDomEarly', 'addsElements', 'PAGE_TITLE', 'escapeHtml', 'attribute', 'isJournalDate', 'updateOwnTags']));
}
(window.refinementParts ||= []).push({ name: 'pages', schema: [], provide, start, stop: runUnloadTasks });
})();
