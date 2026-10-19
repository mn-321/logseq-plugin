/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Editor part of DB Refinements (moved out of main.js in the October 2026 cleanup): the shortcuts and
   commands that write to the block you are in. Make a page from this block, Link selected text to a
   page, Open selected text as page, Add tags to this page, Delete this block, New block at the
   outermost level, and the year-first date typed inside [[ ]] that becomes a journal name.
   It provides its commands and startEditor / startDateLinkSwap to the core (main() calls them where it
   always did) and readableTitle to the links part; it takes openTagPicker from the pages part. */
const shared = window.refinementShared;
const { host, notify, modal, modalHint } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements: ' });
// From the core and the other parts, taken when the part starts (after every part has provided its own).
let setting, dsQuery, storedRef, titleOf, cleanTitle, openTagPicker, graphWide, UUID, provided;
// A name may be the core's own or one another part provided; a missing one is a broken contract.
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };

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

// The text of blocks and their children, in order, as one batch for Editor.insertBatchBlock.
const copyTree = children => (children || []).filter(child => child && !Array.isArray(child))
  .map(child => ({ content: titleOf(child) || 'Untitled', children: copyTree(child.children) }));

async function blockToPage(event) {
  // The right-click menu passes the clicked block's id; the command palette passes none.
  const clickedId = typeof event?.uuid === 'string' ? event.uuid : null;
  const block = (clickedId && await logseq.Editor.getBlock(clickedId)) ||
    await logseq.Editor.getCurrentBlock() || (await logseq.Editor.getSelectedBlocks())?.[0];
  if (!block) return notify('Click in a block first', 'warning');
  const name = cleanTitle(await readableTitle(titleOf(block)));
  if (!name) return notify('The block needs a title', 'warning');
  try {
    const existing = await logseq.Editor.getPage(name);
    if (existing) return notify(`Page “${name}” already exists; nothing copied`, 'warning');
    const source = await logseq.Editor.getBlock(block.uuid, { includeChildren: true });
    const page = await logseq.Editor.createPage(name, {}, { redirect: false, createFirstBlock: false });
    if (!page) throw new Error('Could not create page');
    // Copy rather than move: no source material is removed, including attachments.
    const body = await logseq.Editor.appendBlockInPage(page.uuid, `Source: [[${block.uuid}]]`);
    if (!body) throw new Error('Could not add source reference');
    const batch = copyTree(source?.children);
    if (batch.length && !await logseq.Editor.insertBatchBlock(body.uuid, batch, { sibling: false }))
      throw new Error('Could not copy the child blocks');
    await logseq.App.pushState('page', { name: page.uuid || name });
    notify(`Created “${name}” and copied its child blocks`);
  } catch (error) { console.error(error); notify(`Page creation stopped: ${error.message}`, 'error'); }
}

// Shortcut: delete the block being typed in (with its children), or the selected blocks. The cursor then
// goes to the block shown just above, as Backspace in an empty block does.
const refId = ref => ref?.id ?? ref?.['db/id'] ?? ref;
async function lastShownBlock(uuid) {
  let block = await logseq.Editor.getBlock(uuid, { includeChildren: true });
  for (let depth = 0; block && !block.collapsed && depth < 50; depth++) {
    const last = (block.children || []).filter(child => child && !Array.isArray(child)).pop();
    if (!last) break;
    block = await logseq.Editor.getBlock(last.uuid, { includeChildren: true });
  }
  return block;
}
// Is the block being typed in, with some of its text selected? Then the shortcut leaves the block
// alone and deletes only the selected text, as the Mac's own Cmd+Backspace would. The command
// reaches the plugin a moment after the key, when the editor may already have lost the focus, so the
// text box and its selection are noted on the key press itself (see watchEditorKeys).
const editorKey = { at: 0, box: null, start: 0, end: 0 };
function watchEditorKeys() {
  listen(host(), ['keydown'], event => {
    if (!(event.metaKey || event.ctrlKey || event.altKey)) return;
    const box = event.target;
    if (!box?.matches?.('textarea') || !box.closest('.ls-block')) return;
    Object.assign(editorKey, { at: Date.now(), box, start: box.selectionStart, end: box.selectionEnd });
  });
}
function deleteSelectedText() {
  // Logseq collapses the selection before the command arrives, so the one noted on the key press
  // counts (as long as it is fresh and the same text box); otherwise the box's own selection.
  let box = host().activeElement, start, end;
  const noted = Date.now() - editorKey.at < 1500 && editorKey.box?.isConnected;
  if (noted && (editorKey.box === box || !box?.matches?.('textarea'))) ({ box, start, end } = editorKey);
  else if (box?.matches?.('textarea') && box.closest('.ls-block')) ({ selectionStart: start, selectionEnd: end } = box);
  else return false;
  if (!(start < end)) return false;
  box.focus();
  box.setSelectionRange(start, end);
  if (!box.ownerDocument.execCommand?.('delete')) {
    box.setRangeText('', start, end, 'start');
    box.dispatchEvent(new box.ownerDocument.defaultView.Event('input', { bubbles: true }));
  }
  return true;
}
// A selected block whose parent is selected too goes with its parent; removing it on its own as well
// would fail halfway through the list.
async function withoutNested(blocks) {
  const chosen = new Set(blocks.map(block => block.uuid));
  const kept = [];
  for (const block of blocks) {
    let nested = false, node = block;
    for (let depth = 0; node && depth < 100; depth++) {
      const parentId = refId(node.parent);
      if (!parentId || parentId === refId(node.page)) break;
      node = await logseq.Editor.getBlock(parentId).catch(() => null);
      if (node?.uuid && chosen.has(node.uuid)) { nested = true; break; }
    }
    if (!nested) kept.push(block);
  }
  return kept;
}
async function deleteCurrentBlock() {
  if (deleteSelectedText()) return;
  const current = await logseq.Editor.getCurrentBlock().catch(() => null);
  const blocks = current ? [current] : await withoutNested((await logseq.Editor.getSelectedBlocks().catch(() => null)) || []);
  if (!blocks.length) return notify('Click in a block first', 'warning');
  try {
    let next = null;
    if (current) {
      const before = await logseq.Editor.getPreviousSiblingBlock(current.uuid).catch(() => null);
      if (before) next = await lastShownBlock(before.uuid);
      else if (refId(current.parent) !== refId(current.page)) next = await logseq.Editor.getBlock(refId(current.parent));
      // Leave the editor first, so Logseq does not save the typed text back into a removed block.
      await logseq.Editor.exitEditingMode();
    }
    const failed = [];
    for (const block of blocks) {
      try { await logseq.Editor.removeBlock(block.uuid); } catch (error) { console.error(error); failed.push(block); }
    }
    if (failed.length) notify(`${failed.length === blocks.length ? 'The block' : `${failed.length} of the blocks`} could not be deleted`, 'warning');
    if (next?.uuid) await logseq.Editor.editBlock(next.uuid, { pos: String(titleOf(next) || '').length });
  } catch (error) { console.error(error); notify(`Could not delete the block: ${error.message}`, 'warning'); }
}
// Shortcut: at the outermost level of the page, just after the top-level block that holds the current
// one (and all of its children), an empty spacer block and then a new empty block with the cursor in it.
async function newOutermostBlock() {
  const current = await logseq.Editor.getCurrentBlock().catch(() => null) ||
    (await logseq.Editor.getSelectedBlocks().catch(() => null))?.[0];
  if (!current) return notify('Click in a block first', 'warning');
  try {
    let top = await logseq.Editor.getBlock(current.uuid);
    for (let depth = 0; top && depth < 100; depth++) {
      const parentId = refId(top.parent);
      if (!parentId || parentId === refId(top.page)) break;
      const parent = await logseq.Editor.getBlock(parentId);
      if (!parent?.uuid || parent.name) break;
      top = parent;
    }
    if (!top?.uuid) return;
    await logseq.Editor.exitEditingMode();
    const spacer = await logseq.Editor.insertBlock(top.uuid, '', { sibling: true, before: false });
    const block = spacer?.uuid && await logseq.Editor.insertBlock(spacer.uuid, '', { sibling: true, before: false });
    if (block?.uuid) await logseq.Editor.editBlock(block.uuid);
    // Logseq hides the dot of an empty block itself, but shows it on a block made in the last half
    // second and only decides when it draws the block. The spacer is never typed in, so it would keep
    // its dot until redrawn; a pointer passing over it later makes Logseq redraw it.
    if (spacer?.uuid) setTimeout(() => {
      const row = host().querySelector(`.ls-block[blockid="${spacer.uuid}"] > .block-main-container`);
      if (!row) return;
      const view = row.ownerDocument.defaultView, outside = row.ownerDocument.body;
      row.dispatchEvent(new view.MouseEvent('mouseover', { bubbles: true, relatedTarget: outside }));
      // Leaving in the same moment cancels out before Logseq redraws, so leave a moment later.
      setTimeout(() => row.dispatchEvent(new view.MouseEvent('mouseout', { bubbles: true, relatedTarget: outside })), 80);
    }, 700);
  } catch (error) { console.error(error); notify(`Could not add the block: ${error.message}`, 'warning'); }
}

/* The link box (Link selected text to a page). With linkBoxList (0.4.102) a list under the field, drawn from the
   graph with the marks the page uses (the line list's rows: a page's own icon or the plain rectangle, the # in
   the tag colour for a tag's page, the small grey box for a journal day, the kind in quiet monospace words at the
   right), filtered as you type; Up and Down move, Enter links the highlighted row, a click picks one. An italic
   "Make page …" row is offered only when no title matches the letters exactly, and never above a match, so a
   typo cannot make a page. With linkBoxNodes (0.4.137) blocks are listed too, as the [[ menu lists them: tagged
   blocks (a Task, a Meeting) by their words from one cached query, and any other block through Logseq's own
   search once three letters are typed. A chosen row is written by its id, [words]([[uuid]]), the form Logseq
   itself stores, so the link counts as a reference exactly as [[page]] does (checked in the test graph: a
   labelled link's target is in the block's refs and its linked references). With linkBoxBeside (0.4.137) the box
   opens under the selected words, as Logseq's own [[ menu does, with no dimmed backdrop; a press elsewhere or
   Escape closes it. Off, the field is bare and Enter links what was typed, as before. */
const linkBox = { pages: null, journals: null, nodes: null, at: 0, found: new Map() };
// A block's words on one line, its links by the titles the link box knows, without the search's highlight marks.
const blockWords = text => String(text || '').replace(/\$pfts_2lqh>\$|\$<pfts_2lqh\$/g, '')
  .replace(/\[\[([0-9a-f-]{36})\]\]/gi, (m, id) => linkBox.titles?.get(id.toLowerCase()) ?? '…')
  .replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 120);
async function linkBoxCandidates() {
  if (linkBox.pages && Date.now() - linkBox.at < 30000) return linkBox;
  const [pages, days, nodes] = await Promise.all([provided.propPages(), graphWide('linkBoxJournals', () =>
    dsQuery('[:find ?t ?d ?u :where [?p :block/journal-day ?d] [?p :block/title ?t] [?p :block/uuid ?u]]')),
    setting('linkBoxNodes') ? graphWide('linkBoxNodes', () => dsQuery(`[:find ?u ?t ?tt :where [?b :block/tags ?tag] [?tag :block/title ?tt]
      [?b :block/title ?t] [(missing? $ ?b :block/name)] [?b :block/uuid ?u]]`)) : []]);
  linkBox.pages = pages;
  linkBox.journals = days.map(([t, d, u]) => ({ title: String(t), lower: String(t).toLowerCase(), day: d, uuid: String(u) })).sort((a, b) => b.day - a.day);
  // A block's words keep their links as ids; they are shown by the titles the lists above know.
  const titles = linkBox.titles = new Map([...pages, ...linkBox.journals].map(p => [p.uuid, p.title]));
  const byUuid = new Map();
  for (const [u, t, tt] of nodes) {
    const uuid = String(u), node = byUuid.get(uuid);
    if (node) { node.tags.push(String(tt)); continue; }
    const title = blockWords(t);
    if (title) byUuid.set(uuid, { uuid, title, lower: title.toLowerCase(), tags: [String(tt)] });
  }
  linkBox.nodes = [...byUuid.values()];
  linkBox.at = Date.now();
  return linkBox;
}
// Blocks Logseq's own search finds for the letters (three or more), as { uuid, title, lower }; cached per query.
async function linkBoxFound(filter, skip) {
  const q = filter.trim();
  if (!setting('linkBoxNodes') || q.length < 3 || typeof logseq.App.search !== 'function') return [];
  if (!linkBox.found.has(q)) {
    linkBox.found.set(q, Promise.resolve(logseq.App.search(q, { limit: 20 })).then(found => {
      const blocks = Array.isArray(found?.blocks) ? found.blocks : Array.isArray(found) ? found : [];
      return blocks.map(b => {
        const uuid = String(b?.uuid ?? b?.['block/uuid'] ?? b?.id ?? '').toLowerCase();
        const title = blockWords(b?.title ?? b?.content ?? b?.['block/title'] ?? b?.['block/content']);
        return { uuid, title, lower: title.toLowerCase() };
      }).filter(b => UUID.test(b.uuid) && b.title && !linkBox.titles?.has(b.uuid)); // pages are listed above
    }).catch(error => { warnOnce('the link box could not search blocks', error); return []; }));
    if (linkBox.found.size > 30) linkBox.found.delete(linkBox.found.keys().next().value);
  }
  return (await linkBox.found.get(q)).filter(b => !skip.has(b.uuid));
}
const dateBox = () => '<span class="rf-datebox"></span>';
const blockDot = () => '<span class="rf-blockdot"></span>';
function linkBoxRows(filter, found = [], self = '') {
  const f = filter.trim().toLowerCase();
  if (!f) return [];
  const rank = (lower) => (lower === f ? 0 : lower.startsWith(f) ? 1 : 2);
  const kindOf = p => p.isTag ? 'tag' : (p.tags.find(t => t.title !== 'Page')?.title || 'page');
  const named = [
    ...linkBox.pages.filter(p => p.lower.includes(f)).map(p => ({ kind: 'value', label: p.title, right: kindOf(p), mono: !p.isTag && kindOf(p) !== 'page', icon: provided.propPageIcon(p), lower: p.lower, value: p.title, uuid: p.uuid })),
    ...linkBox.journals.filter(j => j.lower.includes(f)).map(j => ({ kind: 'value', label: j.title, right: 'journal', icon: dateBox(), lower: j.lower, value: j.title, uuid: j.uuid })),
  ].sort((a, b) => rank(a.lower) - rank(b.lower) || a.lower.localeCompare(b.lower)).slice(0, 9);
  // Blocks after the pages, a tagged block first, never the block being linked from; five at most.
  const seen = new Set([self, ...named.map(r => r.uuid)]);
  const blocks = [];
  for (const n of [...(linkBox.nodes || []).filter(n => n.lower.includes(f)), ...found]) {
    if (blocks.length >= 5 || seen.has(n.uuid)) continue;
    seen.add(n.uuid);
    blocks.push({ kind: 'value', label: n.title, right: n.tags ? n.tags.join(' ') : 'block', mono: !!n.tags, icon: blockDot(), lower: n.lower, value: n.title, uuid: n.uuid });
  }
  const hits = [...named, ...blocks];
  if (!named.some(h => h.lower === f)) hits.push({ kind: 'value', label: `Make page “${filter.trim()}”`, dashed: true, icon: provided.ripSvg('plus'), value: filter.trim() });
  return hits;
}
// Where the selected words sit on screen: the box of their last line, measured with a hidden copy of the text box
// (a text box cannot say where a letter is). Null when the text box is not on screen.
function wordsRect(box, start, end) {
  const doc = box?.ownerDocument;
  if (!doc || !box.isConnected || !Number.isInteger(start)) return null;
  const outer = box.getBoundingClientRect();
  if (!outer.width && !outer.height) return null;
  const style = doc.defaultView.getComputedStyle(box), copy = doc.createElement('div');
  for (const p of ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth',
    'borderBottomWidth', 'borderLeftWidth', 'borderStyle', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight',
    'textTransform', 'wordSpacing', 'textIndent', 'tabSize']) copy.style[p] = style[p];
  Object.assign(copy.style, { position: 'fixed', left: '0', top: '0', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', pointerEvents: 'none' });
  copy.textContent = box.value.slice(0, start);
  const words = doc.createElement('span');
  words.textContent = box.value.slice(start, end) || '​';
  copy.append(words);
  doc.body.append(copy);
  const base = copy.getBoundingClientRect(), lines = words.getClientRects();
  const first = lines[0], last = lines[lines.length - 1] || first;
  copy.remove();
  if (!first) return null;
  const dx = outer.left - base.left - box.scrollLeft, dy = outer.top - base.top - box.scrollTop;
  return { left: (lines.length > 1 ? last.left : first.left) + dx, top: first.top + dy, bottom: last.bottom + dy };
}
// The text box the words were selected in: the one the shortcut was pressed in, else the open editor of the block.
function selectionBox(blockId) {
  const noted = Date.now() - editorKey.at < 3000 && editorKey.box?.isConnected ? editorKey.box : null;
  const active = host().activeElement;
  return noted || (active?.matches?.('textarea') && active.closest('.ls-block') ? active : null)
    || host().querySelector(`.ls-block[blockid="${blockId}"] textarea`);
}
// Puts the box under the words (above them when there is no room below), kept inside the window.
function placeBeside(box, at) {
  const win = box.ownerDocument.defaultView, width = Math.min(360, win.innerWidth - 16);
  box.style.width = `${width}px`;
  box.style.left = `${Math.max(8, Math.min(at.left - 8, win.innerWidth - width - 8))}px`;
  if (win.innerHeight - at.bottom < 320 && at.top > win.innerHeight - at.bottom) { box.style.top = ''; box.style.bottom = `${win.innerHeight - at.top + 4}px`; }
  else { box.style.bottom = ''; box.style.top = `${at.bottom + 4}px`; }
}
// Resolves with the page or block to link to ({ uuid } for a row the graph has, { name } for a new page), or null.
function askPageTitle(label, at, self) {
  try {
    const beside = !!at && setting('linkBoxBeside');
    return modal(null, (box, finish, doc) => {
      const heading = doc.createElement('label');
      heading.textContent = `Link “${label}” to which page?`;
      const input = doc.createElement('input');
      input.type = 'text';
      input.placeholder = beside ? `Link “${label.length > 24 ? label.slice(0, 23) + '…' : label}” to …` : 'Page title';
      const withList = setting('linkBoxList') && provided.propPages && provided.ripRowHtml;
      const list = doc.createElement('div');
      list.className = 'refinement-link-list';
      let rows = [], sel = 0, version = 0;
      const pick = row => finish(row.uuid ? { uuid: row.uuid } : { name: row.value });
      const render = () => {
        if (!rows.length) { list.innerHTML = ''; list.hidden = true; return; }
        if (sel < 0 || sel >= rows.length) sel = 0;
        list.hidden = false;
        list.innerHTML = rows.map((row, i) => provided.ripRowHtml(row, i, i === sel)).join('');
        list.querySelector('.rip-sel')?.scrollIntoView?.({ block: 'nearest' });
      };
      const refresh = async () => {
        const my = ++version, filter = input.value;
        try { await linkBoxCandidates(); } catch (error) { warnOnce('the link box could not read the graph', error); return; }
        if (my !== version || !box.isConnected) return;
        rows = linkBoxRows(filter, [], self); sel = 0; render();
        // Logseq's search answers a moment later; its blocks join the list without moving the highlight.
        const found = await linkBoxFound(filter, new Set(rows.map(r => r.uuid)));
        if (my !== version || !box.isConnected || !found.length) return;
        const chosen = rows[sel];
        rows = linkBoxRows(filter, found, self); sel = Math.max(0, rows.indexOf(rows.find(r => r.value === chosen?.value && r.uuid === chosen?.uuid))); render();
      };
      input.addEventListener('keydown', event => {
        if (event.isComposing) return;
        if (event.key === 'Enter') { event.preventDefault(); rows[sel] ? pick(rows[sel]) : finish(input.value.trim() ? { name: input.value } : null); }
        else if (withList && event.key === 'ArrowDown' && rows.length) { event.preventDefault(); sel = (sel + 1) % rows.length; render(); }
        else if (withList && event.key === 'ArrowUp' && rows.length) { event.preventDefault(); sel = (sel - 1 + rows.length) % rows.length; render(); }
      });
      if (withList) {
        input.addEventListener('input', refresh);
        list.addEventListener('mousedown', event => event.preventDefault()); // the caret stays in the field
        list.addEventListener('click', event => { const row = event.target.closest('.rip-row[data-index]'); if (row) pick(rows[Number(row.dataset.index)]); });
        list.hidden = true;
        linkBoxCandidates().catch(() => {});
      }
      if (beside) {
        // No backdrop to catch the press: the page stays usable, and leaving the field closes the box. Logseq may
        // take the focus back just after the command, so for a moment the field takes it back.
        const opened = Date.now();
        input.addEventListener('blur', () => setTimeout(() => {
          if (!box.isConnected || doc.activeElement === input) return;
          if (Date.now() - opened < 400) input.focus(); else finish(null);
        }, 0));
        placeBeside(box, at);
        box.append(input, ...(withList ? [list] : []));
      } else box.append(heading, input, ...(withList ? [list] : []), modalHint(doc, withList ? 'Enter links the highlighted row · Esc to cancel' : 'Enter to link · Esc to cancel'));
      input.focus();
    }, null, beside ? { backdrop: 'refinement-prompt-backdrop refinement-beside', box: 'refinement-prompt refinement-beside-box' } : undefined);
  } catch (error) { const name = window.prompt('Page title:', ''); return Promise.resolve(name === null ? null : { name }); }
}

// The editor shows links by name; the saved block stores them as ids. Finds where a stretch of
// the shown text sits in the saved text, so new text can go in without rewriting existing links
// (rewriting them by name could point a link at another page with the same title, or turn a
// link to a block into a new page). Returns null when the two texts don't match, or when either
// end of the stretch falls inside a link.
async function toSavedRange(saved, shown, start, end) {
  const segments = [];
  let built = '', last = 0;
  for (const m of saved.matchAll(storedRef)) {
    if (m[1] !== '[[' || m[3] !== ']]') continue; // ((uuid)) is shown as stored
    const plain = saved.slice(last, m.index);
    segments.push({ link: false, saved: last, shown: built.length, length: plain.length });
    built += plain;
    const readable = await readableTitle(m[0], { pagesOnly: true, asShown: true });
    segments.push({ link: true, saved: m.index, savedEnd: m.index + m[0].length,
      shown: built.length, shownEnd: built.length + readable.length });
    built += readable;
    last = m.index + m[0].length;
  }
  segments.push({ link: false, saved: last, shown: built.length, length: saved.length - last });
  built += saved.slice(last);
  if (built.trim() !== shown.trim()) return null;
  // The editor may show leading spaces the saved text lacks (or the other way round).
  const shift = (shown.length - shown.trimStart().length) - (built.length - built.trimStart().length);
  const map = pos => {
    pos -= shift;
    for (const s of segments) {
      if (s.link) {
        if (pos === s.shown) return s.saved;
        if (pos === s.shownEnd) return s.savedEnd;
        if (pos > s.shown && pos < s.shownEnd) return null;
      } else if (pos >= s.shown && pos <= s.shown + s.length) return s.saved + pos - s.shown;
    }
    return null;
  };
  const from = map(start), to = map(end);
  return from === null || to === null ? null : { start: from, end: to };
}
// The saved block and where the selection sits in it, or null when the selected words are no
// longer there (or the selection runs across a link).
async function selectedRange(selection, before) {
  const saved = titleOf(await logseq.Editor.getBlock(selection.blockId));
  const range = !before || before === saved ? { start: selection.start, end: selection.end }
    : await toSavedRange(saved, before, selection.start, selection.end);
  if (!range || saved.slice(range.start, range.end) !== selection.text) return null;
  return { saved, ...range };
}

async function labeledPageLink() {
  const selection = recentSelection;
  if (!selection?.text?.trim() || !Number.isInteger(selection.start) || !Number.isInteger(selection.end))
    return notify('Select the words to display, then run Link selected text to a page', 'warning');
  const current = await logseq.Editor.getCurrentBlock();
  if (current && current.uuid !== selection.blockId)
    return notify('Select the display text in this block again', 'warning');
  const before = (await logseq.Editor.getEditingBlockContent()) || selection.content;
  if (before?.slice(selection.start, selection.end) !== selection.text)
    return notify('The selection changed. Select the display text again', 'warning');
  const label = selection.text;
  if (label.includes(']') || /[\r\n]/.test(label))
    return notify('Use a single-line label without ]', 'warning');
  // Measured now, while the words are still on screen in their text box.
  const at = wordsRect(selectionBox(selection.blockId), selection.start, selection.end);
  const answer = await askPageTitle(label, at, selection.blockId);
  if (answer === null) return;
  let uuid = answer.uuid, shownAs;
  try {
    if (!uuid) {
      const target = answer.name.trim().replace(/^\[\[/, '').replace(/\]\]$/, '');
      if (!target || /[\[\]\r\n]/.test(target))
        return notify('Enter a page title without brackets or line breaks', 'warning');
      // The page by that name, or a new one: the link is written by its id either way.
      const page = await logseq.Editor.getPage(target) || await logseq.Editor.createPage(target, {}, { redirect: false });
      if (!page?.uuid) return notify(`Could not make the page ${target}`, 'warning');
      uuid = String(page.uuid);
      shownAs = page.title || target;
    } else shownAs = linkBox.titles?.get(uuid) ?? uuid;
    await logseq.Editor.exitEditingMode();
    const range = await selectedRange(selection, before);
    if (!range) return notify('The block changed, or the selection runs across a link; select the display text again', 'warning');
    // By id, as Logseq stores every link, so it counts as a reference as [[page]] does.
    const link = `[${label}]([[${uuid}]])`;
    await logseq.Editor.updateBlock(selection.blockId,
      range.saved.slice(0, range.start) + link + range.saved.slice(range.end));
    recentSelection = null;
    // The editor shows a page's link by its title.
    await logseq.Editor.editBlock(selection.blockId, { pos: selection.start + `[${label}]([[${shownAs}]])`.length });
  } catch (error) { console.error(error); notify(`Could not insert labeled link: ${error.message}`, 'error'); }
}

let recentSelection = null;
// Turns the selected words into [[page]] in their block. Skips, with a note, anything it can't do safely.
async function linkSelection(selection, name) {
  const words = selection.text;
  if (!Number.isInteger(selection.start) || !Number.isInteger(selection.end) || /[\[\]\r\n]/.test(words))
    return notify('Opened the page; the selected text was left as it was', 'warning');
  try {
    if (await logseq.Editor.getCurrentBlock()) await logseq.Editor.exitEditingMode();
    const before = selection.content;
    // Already a link: checked in the text as the editor showed it, because inside the saved text a
    // link is an id and the selected name is not there to be found.
    const shown = before || '';
    if (shown.slice(Math.max(0, selection.start - 2), selection.start) === '[[' &&
        shown.slice(selection.end, selection.end + 2) === ']]') return;
    const range = await selectedRange(selection, before);
    if (!range) return notify('Opened the page; the block had changed, or the selection runs across a link, so no link was added', 'warning');
    const { saved } = range;
    if (saved.slice(Math.max(0, range.start - 2), range.start) === '[[' &&
        saved.slice(range.end, range.end + 2) === ']]') return; // already a link
    // Spaces around the words, and tags after them, stay outside the brackets.
    const core = words.trim();
    if (!core.startsWith(name)) return notify('Opened the page; the selected text was left as it was', 'warning');
    const link = words.match(/^\s*/)[0] + `[[${name}]]` + core.slice(name.length) + words.match(/\s*$/)[0];
    await logseq.Editor.updateBlock(selection.blockId,
      saved.slice(0, range.start) + link + saved.slice(range.end));
    recentSelection = null;
  } catch (error) { console.error(error); notify(`Opened the page, but could not add the link: ${error.message}`, 'warning'); }
}
async function selectionToPage() {
  const current = await logseq.Editor.getCurrentBlock();
  const text = recentSelection?.text?.trim();
  // Opening the command palette leaves editing mode, so having no current block is expected.
  if (!text || (current && current.uuid !== recentSelection.blockId) || Date.now() - recentSelection.at > 30000)
    return notify('Select text in a block, then run the command within 30 seconds', 'warning');
  const name = cleanTitle(text);
  if (!name) return notify('Select a page title first', 'warning');
  const selection = recentSelection;
  try {
    const page = await logseq.Editor.getPage(name) || await logseq.Editor.createPage(name, {}, { redirect: false });
    if (!page) throw new Error('Could not create page');
    await linkSelection(selection, name);
    await logseq.App.pushState('page', { name: page.uuid || name });
  } catch (error) { console.error(error); notify(`Could not open page: ${error.message}`, 'error'); }
}

// Command and shortcut: open the Tags list under the page's title, the same list the #Page label above the
// title opens, so Set tags happens in one place (it used to call Logseq's own command, whose dialog opens in
// the middle of the window). Nothing may be in edit or selected, or Logseq would tag the block instead.
async function addTagsToPage() {
  const doc = host();
  const actions = () => doc.querySelector('#main-content-container .is-page-title-row .ls-page-title-actions > div');
  if (!actions()) return notify('Open a page first', 'warning');
  try {
    await logseq.Editor.exitEditingMode(false);
    await logseq.Editor.clearSelectedBlocks();
  } catch (error) { /* nothing was being edited or selected */ }
  return openTagPicker(actions());
}
/* A date typed year first inside [[ ]] (2026 10 14, 2026-10-14, 2026/10/14, 2026.10.14 or 20261014)
   becomes that day's journal name ("Oct 14th, 2026") once the day's second digit is typed, so
   Logseq's own menu offers the journal page and Enter links to it. Month and day need two digits,
   so the change waits until the date is complete. Typed text, so Undo brings the digits back. */
const YEAR_FIRST_DATE = /^(\d{4})([ ./_-]?)(\d{2})\2(\d{2})$/;
const dateLinkSwap = { busy: false, format: null };
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
// The journal title formats Logseq offers (MMM do, yyyy; E, dd.MM.yyyy; yyyyMMdd ...).
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
async function journalTitleFor(year, month, day) {
  const journalDay = year * 10000 + month * 100 + day;
  try {
    const [[title] = []] = await dsQuery(`[:find ?t :where [?p :block/journal-day ${journalDay}] [?p :block/title ?t]]`);
    if (title) return String(title);
  } catch (error) { /* no such journal yet: use the format below */ }
  if (!dateLinkSwap.format) {
    try { dateLinkSwap.format = (await logseq.App.getUserConfigs())?.preferredDateFormat || null; } catch (error) { /* default below */ }
  }
  return formatJournalTitle(new Date(year, month - 1, day), dateLinkSwap.format || 'MMM do, yyyy');
}
// What is typed between an open [[ and the caret, if the caret is inside one.
function openLinkQuery(box) {
  if (!box || box.tagName !== 'TEXTAREA' || box.selectionStart !== box.selectionEnd) return null;
  const before = box.value.slice(0, box.selectionStart), open = before.lastIndexOf('[[');
  if (open < 0 || before.indexOf(']]', open) >= 0) return null;
  return { start: open + 2, end: box.selectionStart, text: before.slice(open + 2) };
}
async function swapDateInLink(doc) {
  if (dateLinkSwap.busy || !setting('dateLinkFormats')) return;
  const box = doc.activeElement, query = openLinkQuery(box);
  const m = query && YEAR_FIRST_DATE.exec(query.text);
  if (!m) return;
  const [year, month, day] = [Number(m[1]), Number(m[3]), Number(m[4])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return; // 2026 02 30
  dateLinkSwap.busy = true;
  try {
    const title = await journalTitleFor(year, month, day);
    const now = openLinkQuery(doc.activeElement);
    // Only when nothing moved while the name was looked up.
    if (doc.activeElement !== box || !now || now.start !== query.start || now.text !== query.text || title === query.text) return;
    box.setSelectionRange(query.start, query.end);
    if (!doc.execCommand('insertText', false, title)) box.setSelectionRange(query.end, query.end);
  } catch (error) { warnOnce('a typed date could not become a journal link', error); }
  finally { dateLinkSwap.busy = false; }
}
function startDateLinkSwap() {
  try {
    const doc = host();
    listen(doc.defaultView, ['input'], () => { swapDateInLink(doc); });
  } catch (error) { warnOnce('typed dates in links are unavailable', error); }
}


// The editor's own hooks, started by main() where they always were: the key watcher, and the last
// text selection, kept for Link selected text and Open selected text as page.
function startEditor() {
  watchEditorKeys();
  onUnload(logseq.Editor.onInputSelectionEnd(async ({ text, start, end }) => {
    const block = await logseq.Editor.getCurrentBlock();
    const content = await logseq.Editor.getEditingBlockContent();
    if (text && block) recentSelection = { text, blockId: block.uuid, start, end, content, at: Date.now() };
  }));
}
function provide(core) {
  core.provide({ blockToPage, labeledPageLink, selectionToPage, addTagsToPage, deleteCurrentBlock, newOutermostBlock, readableTitle, startEditor, startDateLinkSwap, journalTitleFor });
}
function start() {
  const core = window.refinementCore;
  provided = core.provided;
  ({ setting, dsQuery, storedRef, titleOf, cleanTitle, openTagPicker, graphWide, UUID } = take(core, ['setting', 'dsQuery', 'storedRef', 'titleOf', 'cleanTitle', 'openTagPicker', 'graphWide', 'UUID', 'propPages', 'propPageIcon', 'ripSvg', 'ripRowHtml']));
}
(window.refinementParts ||= []).push({ name: 'editor', schema: [], provide, start, stop: runUnloadTasks });
})();
