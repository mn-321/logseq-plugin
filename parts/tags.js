/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Tag tree (0.4.30): every tag in the graph as one tree, under a few root tags (by default
   Occurrence, Entity and Concept), so a tag's children are easy to see and to move.
   - A tag's place in the tree is its "Extends" property (:logseq.property.class/extends). A tag can
     extend more than one tag; it then shows under each of them, marked "also under …".
   - Tags under none of the roots are listed under "Not placed yet"; tags that extend one of
     Logseq's own tags (Task, Card) under "Under Logseq's tags".
   - Drag a tag onto another to move it there (hold Option to add the second parent and keep the
     first). Tab and Shift+Tab move it in and out, as in an outline. Every move can be undone.
   - New tags are made inside the tag they belong to, with the + on its row or the n key.
   Shown as a full view in the main area (a plugin route, #/refinement-tags) or as a panel in the
   right sidebar, both drawn with Logseq's own React like Todos. */
// The shared plumbing (parts/shared.js): its header says what each helper does.
const shared = window.refinementShared;
const { host } = shared;
// This part's own clean-up list; main.js runs it when the plugin unloads.
const { warnOnce, onUnload, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (tag tree): ' });

const settingsSchema = [
  { key: 'tagTreeHeading', type: 'heading', group: 'tools', rank: 2, title: 'Tag tree', default: null,
    pauseSwitch: 'tagTreeEnabled',
    legend: 'All your tags as one tree',
    zone: '<div># Entity</div><div class="ind"># Person &nbsp;<span class="m"># Company</span></div>',
    description: 'All your tags as one tree under a few root tags, where you can see what is inside each tag, make new tags in the right place and move tags under other tags. Open it from the tree button in the toolbar, from the command palette (Tag tree) or with its shortcut.' },
  { key: 'tagTreeEnabled', type: 'boolean', title: 'Use the tag tree', default: true,
    description: 'Off, the tag tree adds no toolbar button, no page, no sidebar panel, no command and no shortcut, and the settings below do nothing. Applies after you reload the plugin.' },
  { key: 'tagTreeRoots', type: 'string', title: 'Root tags', default: 'Occurrence, Entity, Concept',
    description: 'The tags at the top of the tree, in this order, separated by commas. A root that does not exist yet can be made from the tree. Roots can also be added, reordered and removed from the tree itself (a root’s … menu, and + Root tag below the roots).' },
  { key: 'tagTreeOpensAs', type: 'enum', title: 'The button and shortcut open the tag tree as', default: 'page', enumChoices: ['page', 'sidebar'], enumPicker: 'radio',
    description: 'page: a full view in the main area, like a page. sidebar: a panel in the right sidebar. Both are also in the command palette.' },
  { key: 'tagTreeToolbarButton', type: 'boolean', title: 'Tag tree button in the toolbar', default: true,
    description: 'A tree button at the top right of Logseq opens the tag tree. Applies after you reload the plugin.' },
  { key: 'tagTreeShortcut', type: 'string', title: 'Open the tag tree', default: 'mod+alt+g',
    description: 'mod+alt+g is Cmd+Option+G on a Mac. Leave empty for no shortcut. Applies after you reload the plugin.' },
];
const setting = shared.settingReader(settingsSchema);
// Roots changed from the tree are used at once; Logseq hands the saved setting back a little later.
let rootsOverride = null;
const openViews = new Set(); // the draw function of every tree on screen, redrawn when the settings change
const rootNames = () => (rootsOverride ?? setting('tagTreeRoots')).split(',').map(name => name.trim().replace(/^#/, '')).filter(Boolean);

// Folded tags (by uuid), kept for next time on this computer.
const FOLD_KEY = 'refinement-tags-folded';
const folded = new Set((() => { try { return JSON.parse(localStorage.getItem(FOLD_KEY) || '[]'); } catch (error) { return []; } })());
const saveFolded = () => { try { localStorage.setItem(FOLD_KEY, JSON.stringify([...folded])); } catch (error) { /* kept for this session only */ } };

/* ---------- Reading the tags ---------- */
const dsQuery = async query => {
  const rows = await logseq.DB.datascriptQuery(query);
  return Array.isArray(rows) ? rows : [];
};
// Query results name attributes with or without the leading colon, and some without their namespace.
function pick(node, name) {
  if (!node || typeof node !== 'object') return undefined;
  for (const key of [name, ':' + name, name.split('/').pop()]) if (node[key] !== undefined) return node[key];
  return undefined;
}
const idOf = value => typeof value === 'number' ? value : pick(value, 'db/id');
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
// Logseq's own tags that other tags may extend; the rest of its tags (Page, Journal …) cannot be parents.
const PARENT_BUILT_INS = new Set(['logseq.class/Task', 'logseq.class/Card']);

async function loadTags() {
  const [rows, counts] = await Promise.all([
    dsQuery(`[:find (pull ?t [:db/id :block/uuid :block/title :db/ident
                {:logseq.property.class/extends [:db/id]}
                {:logseq.property.class/properties [:db/id :db/ident :block/title :block/uuid]}
                {:logseq.property/description [:block/title]}])
      :where [?t :block/tags :logseq.class/Tag]]`),
    dsQuery(`[:find ?t (count ?b) :where [?t :block/tags :logseq.class/Tag] [?b :block/tags ?t]]`),
  ]);
  const tags = new Map();
  for (const [node] of rows) {
    const id = idOf(node);
    const ident = String(pick(node, 'db/ident') ?? '').replace(/^:/, '');
    if (id == null || ident === 'logseq.class/Root') continue;
    tags.set(id, {
      id, ident,
      uuid: String(pick(node, 'block/uuid') ?? ''),
      title: String(pick(node, 'block/title') ?? ''),
      builtIn: ident.startsWith('logseq.class/'),
      parentIds: list(pick(node, 'logseq.property.class/extends')).map(idOf).filter(v => v != null),
      propList: list(pick(node, 'logseq.property.class/properties')).map(p => ({ ident: String(pick(p, 'db/ident') ?? '').replace(/^:/, ''), title: String(pick(p, 'block/title') ?? ''), uuid: String(pick(p, 'block/uuid') ?? ''), id: idOf(p) })).filter(p => p.title),
      desc: String(pick(pick(node, 'logseq.property/description'), 'block/title') ?? '').trim(),
      count: 0, parents: [], kids: [],
    });
  }
  for (const [id, n] of counts) if (tags.has(id)) tags.get(id).count = n;
  for (const tag of tags.values()) tag.props = tag.propList.map(p => p.title);
  // Parents that are not shown (Logseq's Root tag) leave a tag at the top level.
  for (const tag of tags.values()) {
    tag.parents = tag.parentIds.map(id => tags.get(id)).filter(Boolean);
    for (const parent of tag.parents) parent.kids.push(tag);
  }
  const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });
  for (const tag of tags.values()) tag.kids.sort(byTitle);
  const byName = new Map([...tags.values()].map(tag => [tag.title.toLowerCase(), tag]));
  // Tags that share a name with another tag (Logseq allows it); they are marked so they can be merged.
  const sameName = new Map();
  for (const tag of tags.values()) if (!tag.builtIn) { const key = tag.title.toLowerCase(); sameName.set(key, [...(sameName.get(key) || []), tag]); }
  for (const [key, list] of sameName) if (list.length < 2) sameName.delete(key);
  return { tags, byName, byTitle, sameName };
}
// The properties a tag gets from the tags above it (Logseq gives a tag every property of the tags it
// extends), nearest first, each once, with the tag it comes from.
function inheritedProps(tag) {
  const have = new Set(tag.propList.map(p => p.ident));
  const out = [], seen = new Set([tag.id]);
  for (let level = tag.parents.slice(); level.length;) {
    const next = [];
    for (const parent of level) {
      if (seen.has(parent.id)) continue;
      seen.add(parent.id);
      for (const prop of parent.propList) if (!have.has(prop.ident)) { have.add(prop.ident); out.push({ ...prop, from: parent }); }
      next.push(...parent.parents);
    }
    level = next;
  }
  return out;
}
// A tag's own properties ("Tag properties"). Logseq 2.0.2's addTagProperty and removeTagProperty refuse
// every tag ("Not a valid tag"), so the list is read and written as the tag's property itself.
const TAG_PROPS = 'logseq.property.class/properties';
async function tagPropIds(tag) {
  return (await dsQuery(`[:find ?p :where [?t :block/uuid #uuid "${tag.uuid}"] [?t :${TAG_PROPS} ?p]]`)).map(([id]) => id);
}
// One value at a time: writing several at once with reset kept only the first in testing.
const addTagProp = (tag, prop) => logseq.Editor.upsertBlockProperty(tag.uuid, TAG_PROPS, prop.id, { entityId: true });
// The list can only be cleared and filled again, so what was there is read first and put back if a
// value cannot be written, rather than leaving the tag with fewer properties than it had.
async function setTagProps(tag, ids) {
  const had = await tagPropIds(tag);
  const want = [...new Set(ids)];
  if (want.length === had.length && want.every(id => had.includes(id))) return;
  await logseq.Editor.removeBlockProperty(tag.uuid, TAG_PROPS);
  const failed = [];
  for (const id of want) { try { await addTagProp(tag, { id }); } catch (error) { console.error(error); failed.push(id); } }
  if (!failed.length) return;
  for (const id of had) if (!want.includes(id) || failed.includes(id)) await addTagProp(tag, { id }).catch(() => {});
  throw new Error('a property could not be written; the list was put back as it was');
}
const removeTagProp = async (tag, prop) => setTagProps(tag, (await tagPropIds(tag)).filter(id => id !== prop.id));
// The graph's own properties (made by you or a plugin), for adding to a tag.
async function loadProps() {
  const rows = await dsQuery('[:find (pull ?p [:db/id :db/ident :block/title :block/uuid :logseq.property/type]) :where [?p :block/tags :logseq.class/Property]]');
  return rows.map(([p]) => ({ ident: String(pick(p, 'db/ident') ?? '').replace(/^:/, ''), title: String(pick(p, 'block/title') ?? ''), uuid: String(pick(p, 'block/uuid') ?? ''), id: idOf(p), type: String(pick(p, 'logseq.property/type') ?? '').replace(/^:/, '') }))
    .filter(p => p.title && /^(user|plugin)\.property/.test(p.ident))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }));
}
// Every tag below this one, once each (a tag reached twice, or a loop, is not counted again).
function below(tag, seen = new Set()) {
  for (const kid of tag.kids) if (!seen.has(kid.id)) { seen.add(kid.id); below(kid, seen); }
  return seen;
}
const isAbove = (maybeAncestor, tag) => maybeAncestor.id === tag.id || below(maybeAncestor).has(tag.id);
// A short path for menus: the tag's first line of parents, top first.
function pathOf(tag) {
  const names = [];
  const seen = new Set([tag.id]);
  for (let at = tag.parents[0]; at && !seen.has(at.id); at = at.parents[0]) { seen.add(at.id); names.unshift(at.title); }
  return names.join(' › ');
}

/* ---------- Writing ---------- */
const EXTENDS = 'logseq.property.class/extends';
// Gives a tag exactly these parents. New ones are added before old ones are taken away, so the tag
// always extends something; with none left, Logseq puts it back under its Root tag.
async function setParents(tag, parents) {
  const now = new Set(tag.parents.map(p => p.id));
  const want = new Set(parents.map(p => p.id));
  for (const parent of parents) if (!now.has(parent.id)) await logseq.Editor.addTagExtends(tag.uuid, parent.uuid);
  if (!want.size) { if (now.size) await logseq.Editor.removeBlockProperty(tag.uuid, EXTENDS); return; }
  for (const parent of tag.parents) if (!want.has(parent.id)) await logseq.Editor.removeTagExtends(tag.uuid, parent.uuid);
}
async function makeTag(name) {
  const page = await logseq.Editor.createPage(name, {}, { redirect: false, class: true, createFirstBlock: false });
  if (!page?.uuid) throw new Error(`#${name} could not be made`);
  return page;
}
/* Merging one tag (source) into another (target): what it would change, then the change itself.
   Logseq deletes a tag outright (no Recycle) and drops the blocks on its page, so everything worth
   keeping is moved to the target first. */
const attrName = value => String(value ?? '').replace(/^:/, '');
async function planMerge(source, target, tags) {
  const S = source.id;
  const [tagged, refs, propRefs, pageBlocks, ownValues, targetValues] = await Promise.all([
    dsQuery(`[:find ?u :where [?b :block/tags ${S}] [?b :block/uuid ?u]]`),
    dsQuery(`[:find ?u ?t :where [?b :block/refs ${S}] [?b :block/uuid ?u] [?b :block/title ?t]]`),
    // Only your own properties are looked at (binding the property first keeps this quick).
    dsQuery(`[:find ?u ?a :where [?p :block/tags :logseq.class/Property] [?p :db/ident ?a] [?b ?a ${S}] [?b :block/uuid ?u]]`),
    dsQuery(`[:find ?u ?o :where [?b :block/parent ${S}] [?b :block/page ${S}] [?b :block/uuid ?u] [?b :block/order ?o] (not [?b :logseq.property/created-from-property])]`),
    // Values set on each tag's own page: aliases, the icon, and your own properties.
    dsQuery(`[:find ?a ?v :where [${S} ?a ?v] [?p :db/ident ?a] [?p :block/tags :logseq.class/Property]]`),
    dsQuery(`[:find ?a :where [${target.id} ?a _] [?p :db/ident ?a] [?p :block/tags :logseq.class/Property]]`),
  ]);
  const targetHas = new Set(targetValues.map(([a]) => attrName(a)));
  const pageValues = new Map();
  for (const [a, v] of ownValues) {
    const attr = attrName(a);
    const alias = attr === 'logseq.property/alias';
    if (!(/^(user|plugin)\.property/.test(attr) || alias || attr === 'logseq.property/icon')) continue;
    if (!alias && targetHas.has(attr)) continue;
    const value = idOf(v) ?? v;
    if (value === target.id || value === S) continue;
    pageValues.set(attr, [...(pageValues.get(attr) || []), value]);
  }
  const textRefs = refs.map(([uuid, title]) => ({ uuid: String(uuid), title: String(title ?? '') })).filter(r => r.title.includes(source.uuid));
  // Your own properties, and the two of Logseq's that can point at a tag: a page's aliases and a
  // property's "tags of its values".
  const props = propRefs.map(([uuid, a]) => ({ uuid: String(uuid), attr: attrName(a) })).filter(r => /^(user|plugin)\.property/.test(r.attr) || r.attr === 'logseq.property/alias' || r.attr === 'logseq.property/classes');
  const kids = source.kids.filter(kid => kid.id !== target.id);
  const newProps = source.propList.filter(p => p.ident && !target.propList.some(q => q.ident === p.ident));
  return {
    source, target,
    tagged: tagged.map(([u]) => String(u)),
    textRefs,
    props,
    kids, newProps,
    pageBlocks: pageBlocks.sort((a, b) => String(a[1]).localeCompare(String(b[1]))).map(([u]) => String(u)),
    desc: !target.desc && source.desc ? source.desc : '',
    descDropped: !!(target.desc && source.desc && target.desc !== source.desc),
    pageValues,
    tags,
  };
}
async function runMerge(plan) {
  const { source, target, tags } = plan;
  // 1. Links written in text point at the kept tag (this also changes #tags typed in the text).
  for (const ref of plan.textRefs) await logseq.Editor.updateBlock(ref.uuid, ref.title.split(source.uuid).join(target.uuid));
  // 2. Every node with the old tag gets the kept one.
  for (const uuid of plan.tagged) {
    await logseq.Editor.addBlockTag(uuid, target.uuid).catch(error => warnOnce('a node could not get the kept tag', error));
    await logseq.Editor.removeBlockTag(uuid, source.uuid).catch(() => {});
  }
  // 3. Property values that point at the old tag point at the kept one.
  for (const ref of plan.props) {
    const values = (await dsQuery(`[:find ?v :where [?b :block/uuid #uuid "${ref.uuid}"] [?b :${ref.attr} ?v]]`)).map(([v]) => idOf(v) ?? v);
    const next = [...new Set(values.map(v => v === source.id ? target.id : v))];
    await logseq.Editor.upsertBlockProperty(ref.uuid, ref.attr, next.length === 1 ? next[0] : next, { entityId: true, reset: true });
  }
  // 4. Tags inside the old tag move inside the kept one (or up, where that would make a loop).
  for (const kid of plan.kids) {
    const others = kid.parents.filter(p => p.id !== source.id);
    const up = isAbove(kid, target) ? source.parents.filter(p => p.id !== kid.id) : [target];
    await setParents(kid, [...others, ...up.filter(p => !others.some(o => o.id === p.id))]);
  }
  // The kept tag, if it was inside the old one, takes the old one's place.
  if (target.parents.some(p => p.id === source.id)) {
    const others = target.parents.filter(p => p.id !== source.id);
    await setParents(target, [...others, ...source.parents.filter(p => p.id !== target.id && !others.some(o => o.id === p.id))]);
  }
  // 5. The old tag's properties and description.
  for (const prop of plan.newProps) await addTagProp(target, prop).catch(error => warnOnce('a tag property could not be added', error));
  if (plan.desc) await logseq.Editor.upsertBlockProperty(target.uuid, 'logseq.property/description', plan.desc).catch(error => warnOnce('the description could not be copied', error));
  // Aliases, the icon and your own values on the old tag's page go to the kept tag's page.
  for (const [attr, values] of plan.pageValues) {
    const entity = values.every(v => typeof v === 'number');
    const alias = attr === 'logseq.property/alias';
    await logseq.Editor.upsertBlockProperty(target.uuid, attr, values.length === 1 && !alias ? values[0] : values, entity ? { entityId: true, reset: !alias } : {})
      .catch(error => warnOnce(`a value on #${source.title}’s page could not be copied (${attr})`, error));
  }
  // 6. Blocks written on the old tag's page go to the end of the kept tag's page.
  if (plan.pageBlocks.length) {
    const tree = await logseq.Editor.getPageBlocksTree(target.uuid).catch(() => null) || [];
    let anchor = tree[tree.length - 1]?.uuid;
    let spare = null;
    if (!anchor) { spare = await logseq.Editor.appendBlockInPage(target.uuid, ''); anchor = spare?.uuid; }
    for (const uuid of plan.pageBlocks) { await logseq.Editor.moveBlock(uuid, anchor, { before: false, children: false }); anchor = uuid; }
    if (spare?.uuid) await logseq.Editor.removeBlock(spare.uuid).catch(() => {});
  }
  // 7. The old tag goes.
  await logseq.Editor.deletePage(source.uuid);
  void tags;
}
async function openTag(tag, sidebar) {
  if (sidebar) await logseq.Editor.openInRightSidebar(tag.uuid);
  else logseq.App.pushState('page', { name: tag.uuid });
}

/* ---------- Look ---------- */
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function el(doc, tag, props = {}, ...children) {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (typeof value === 'function') node.addEventListener(key, value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.filter(child => child != null && child !== false));
  return node;
}
// Keys typed in the tree's boxes stay out of Logseq's shortcuts.
const keepKeys = input => { for (const type of ['keydown', 'keyup', 'keypress']) input.addEventListener(type, event => { if (event.key !== 'Escape') event.stopPropagation(); }); };
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

const TREE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3.5" width="6" height="4.5" rx="1"/><rect x="3.5" y="16" width="6" height="4.5" rx="1"/><rect x="14.5" y="16" width="6" height="4.5" rx="1"/><path d="M12 8v4M6.5 16v-2a2 2 0 0 1 2 -2h7a2 2 0 0 1 2 2v2"/></svg>';
const SIDEBAR_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M14.5 4.5v15"/></svg>';
const PAGE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 8.5h17"/></svg>';
const CHEVRON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4l-4 4"/></svg>';
const PLUS = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3.5v9M3.5 8h9"/></svg>';
const DOTS = '<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><circle cx="3.5" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="12.5" cy="8" r="1.2"/></svg>';
// Each root has its own colour; every tag below it carries that colour on its # mark, so the branch a
// tag belongs to shows at a glance. Tags not under a root keep a plain grey #.
const HUES = 4;

const css = `
.refinement-tags { --rtg-line: color-mix(in srgb, var(--ls-primary-text-color) 13%, transparent); --rtg-wash: color-mix(in srgb, var(--ls-primary-text-color) 6%, transparent);
  --rtg-faint: color-mix(in srgb, var(--ls-primary-text-color) 52%, transparent);
  --rtg-h0: #b07a2a; --rtg-h1: #4a76b4; --rtg-h2: #7c5fb3; --rtg-h3: #4e9a62; --rtg-plain: var(--rtg-faint); --rtg-warn: #b8641e;
  color: var(--ls-primary-text-color); font-size: 16px; }
.dark .refinement-tags, html[data-theme=dark] .refinement-tags { --rtg-h0: #dcae5e; --rtg-h1: #86a6db; --rtg-h2: #a990dc; --rtg-h3: #7fbf8c; --rtg-warn: #e09a5a; }
.refinement-tags:focus { outline: none; }
.refinement-tags button { font: inherit; color: inherit; }
.refinement-tags [hidden] { display: none !important; }
.refinement-tags .rtg-title { margin: 0 0 18px; padding: 0 10px; font-size: 2em; font-weight: 600; line-height: 1.2; }
.refinement-tags header { display: flex; align-items: center; gap: 12px; padding: 0 0 12px 10px; border-bottom: 1px solid var(--ls-border-color); }
.refinement-tags .rtg-count { font-size: 14px; color: var(--rtg-faint); font-variant-numeric: tabular-nums; white-space: nowrap; }
.refinement-tags .rtg-find { flex: 1; min-width: 100px; padding: 6px 12px; border: 1px solid var(--ls-border-color); border-radius: 7px; background: transparent; color: inherit; font: inherit; font-size: 15px; }
.refinement-tags .rtg-find:focus, .refinement-tags .rtg-input:focus { border-color: color-mix(in srgb, var(--ls-primary-text-color) 40%, transparent); outline: none; box-shadow: none; }
.refinement-tags .rtg-tool { flex: none; display: flex; align-items: center; justify-content: center; height: 28px; padding: 0 8px; border: 0; border-radius: 6px; background: none; cursor: pointer; color: var(--rtg-faint) !important; font-size: 13.5px !important; white-space: nowrap; }
.refinement-tags .rtg-tool:hover { background: var(--rtg-wash); color: var(--ls-primary-text-color) !important; }
.refinement-tags .rtg-body { padding: 4px 0 24px; }
.refinement-tags .rtg-section { padding-top: 22px; }
.refinement-tags h3.rtg-group { display: flex; align-items: baseline; gap: 10px; margin: 6px 0 4px 10px; padding: 3px 0; font-size: 12.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--rtg-faint); border-radius: 6px; }
.refinement-tags h3.rtg-group .rtg-hint { font-weight: 400; letter-spacing: 0; text-transform: none; opacity: .85; }
.refinement-tags .rtg-row { position: relative; display: flex; align-items: flex-start; gap: 4px; padding: 3px 8px 3px 2px; border-radius: 6px; line-height: 1.5; cursor: default; }
.refinement-tags .rtg-row:hover, .refinement-tags .rtg-row.rtg-current { background: var(--rtg-wash); }
.refinement-tags:focus-within .rtg-row.rtg-current, .refinement-tags:focus .rtg-row.rtg-current { box-shadow: inset 2px 0 0 color-mix(in srgb, var(--ls-primary-text-color) 35%, transparent); }
.refinement-tags .rtg-fold { flex: none; display: flex; align-items: center; justify-content: center; width: 22px; height: 24px; border: 0; padding: 0; background: none; color: var(--rtg-faint); cursor: pointer; border-radius: 4px; }
.refinement-tags .rtg-fold svg { transition: transform .12s ease; transform: rotate(90deg); }
.refinement-tags .rtg-fold.rtg-shut svg { transform: none; }
.refinement-tags .rtg-fold:hover { color: var(--ls-primary-text-color); background: var(--rtg-wash); }
.refinement-tags .rtg-fold.rtg-leaf { visibility: hidden; }
.refinement-tags .rtg-main { flex: 1; min-width: 0; }
.refinement-tags .rtg-line { display: flex; align-items: baseline; flex-wrap: wrap; column-gap: 8px; }
.refinement-tags .rtg-name { cursor: pointer; overflow-wrap: anywhere; }
.refinement-tags .rtg-name:hover { text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 35%, transparent); text-underline-offset: 2px; }
.refinement-tags .rtg-name::before { content: '#'; margin-right: 1px; font-weight: 400; color: var(--rtg-hue, var(--rtg-plain)); }
.refinement-tags .rtg-branch > .rtg-main .rtg-name { font-weight: 500; }
.refinement-tags .rtg-root { padding-top: 5px; padding-bottom: 5px; }
.refinement-tags .rtg-root > .rtg-main .rtg-name { font-size: 19px; font-weight: 600; }
.refinement-tags .rtg-root > .rtg-fold { height: 30px; }
.refinement-tags .rtg-builtin > .rtg-main .rtg-name { color: var(--rtg-faint); }
.refinement-tags .rtg-small { font-size: 13px; color: var(--rtg-faint); font-variant-numeric: tabular-nums; white-space: nowrap; }
.refinement-tags .rtg-small + .rtg-small::before { content: '·'; margin-right: 8px; opacity: .7; }
.refinement-tags .rtg-also { font-style: italic; }
.refinement-tags .rtg-propline { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 5px; margin-top: 2px; font-size: 13px; line-height: 1.6; color: var(--rtg-faint); }
.refinement-tags .rtg-plabel { margin-right: 1px; opacity: .8; }
.refinement-tags .rtg-plabel:not(:first-child) { margin-left: 8px; }
.refinement-tags .rtg-plabel b { font-weight: 400; color: var(--rtg-hue, var(--rtg-plain)); }
/* A tag's own properties sit on a light chip; the ones it gets from a tag above are plain grey text. */
.refinement-tags .rtg-prop { padding: 0 6px; border-radius: 4px; background: var(--rtg-wash); color: color-mix(in srgb, var(--ls-primary-text-color) 78%, transparent); cursor: pointer; }
.refinement-tags .rtg-prop:hover { background: color-mix(in srgb, var(--ls-primary-text-color) 11%, transparent); color: var(--ls-primary-text-color); }
.refinement-tags .rtg-prop.rtg-inh { padding: 0 2px; background: none; color: var(--rtg-faint); }
.refinement-tags .rtg-prop.rtg-inh:hover { color: var(--ls-primary-text-color); text-decoration: underline; text-underline-offset: 2px; }
.refinement-tags .rtg-desc { margin-top: 1px; font-size: 13.5px; line-height: 1.4; color: var(--rtg-faint); }
.refinement-tags .rtg-acts { flex: none; display: flex; gap: 2px; opacity: 0; }
.refinement-tags .rtg-row:hover > .rtg-acts, .refinement-tags .rtg-row.rtg-current > .rtg-acts, .refinement-tags .rtg-root > .rtg-acts { opacity: 1; }
.refinement-tags .rtg-root:not(:hover):not(.rtg-current) > .rtg-acts .rtg-more { opacity: 0; }
.refinement-tags .rtg-act { display: flex; align-items: center; justify-content: center; width: 26px; height: 24px; border: 0; padding: 0; border-radius: 5px; background: none; color: var(--rtg-faint); cursor: pointer; }
.refinement-tags .rtg-act:hover { background: var(--rtg-wash); color: var(--ls-primary-text-color); }
.refinement-tags .rtg-kids { margin-left: 12px; padding-left: 10px; border-left: 1px solid var(--rtg-line); }
.refinement-tags .rtg-dim > .rtg-main .rtg-name { opacity: .55; }
.refinement-tags .rtg-name mark { margin: 0; padding: 0; border-radius: 0; background: none; color: inherit; text-decoration: underline; text-decoration-thickness: 2px; text-decoration-color: color-mix(in srgb, currentColor 40%, transparent); text-underline-offset: 3px; }
.refinement-tags .rtg-dragging { opacity: .4; }
.refinement-tags .rtg-drop { background: color-mix(in srgb, var(--rtg-hue, var(--ls-primary-text-color)) 12%, transparent) !important; box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--rtg-hue, var(--ls-primary-text-color)) 60%, transparent); }
.refinement-tags h3.rtg-drop { color: var(--ls-primary-text-color); }
.refinement-tags .rtg-addrow { display: flex; align-items: center; gap: 6px; padding: 3px 8px 3px 24px; }
.refinement-tags .rtg-addrow::before { content: '#'; color: var(--rtg-hue, var(--rtg-plain)); }
.refinement-tags .rtg-input { flex: 1; min-width: 0; padding: 2px 8px; border: 1px solid var(--ls-border-color); border-radius: 6px; background: transparent; color: inherit; font: inherit; font-size: 15px; }
.refinement-tags .rtg-addrow .rtg-small { white-space: normal; }
.refinement-tags .rtg-missing { display: flex; align-items: baseline; gap: 12px; padding: 5px 8px 5px 24px; }
.refinement-tags .rtg-missing .rtg-ghost { font-size: 19px; font-weight: 600; color: var(--rtg-faint); }
.refinement-tags .rtg-missing .rtg-ghost::before { content: '#'; font-weight: 400; color: var(--rtg-hue); }
.refinement-tags .rtg-make { border: 1px dashed var(--ls-border-color); border-radius: 6px; padding: 1px 10px; background: none; cursor: pointer; font-size: 13.5px !important; color: var(--rtg-faint) !important; }
.refinement-tags .rtg-make:hover { border-style: solid; color: var(--ls-primary-text-color) !important; }
.refinement-tags .rtg-row.rtg-picked { background: color-mix(in srgb, var(--rtg-hue, var(--ls-primary-text-color)) 13%, transparent); box-shadow: inset 3px 0 0 color-mix(in srgb, var(--rtg-hue, var(--ls-primary-text-color)) 70%, transparent); }
.refinement-tags .rtg-pickbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 6px; margin: 8px 0 0; padding: 6px 8px 6px 12px; border-radius: 8px; background: var(--ls-primary-background-color); box-shadow: inset 0 0 0 1px var(--ls-border-color); }
.refinement-tags .rtg-pickcount { flex: 1; font-size: 14px; font-weight: 500; }
.refinement-tags .rtg-pickbar .rtg-pickgo { color: var(--ls-primary-text-color) !important; font-weight: 600; }
.refinement-tags .rtg-newroot { padding: 14px 8px 0 24px; }
.refinement-tags .rtg-missing .rtg-leave { border-color: transparent; }
.refinement-tags .rtg-missing .rtg-leave:hover { border-color: var(--ls-border-color); }
.refinement-tags .rtg-empty { padding: 4px 10px 4px 34px; font-size: 14px; color: var(--rtg-faint); }
.refinement-tags footer { display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 14px 10px 0; border-top: 1px solid var(--ls-border-color); font-size: 12.5px; color: var(--rtg-faint); }
.refinement-tags footer kbd { font: inherit; padding: 0 4px; border: 1px solid var(--rtg-line); border-radius: 3px; }
/* The main view: the tree as a page, scrolled with the page. */
.refinement-tags-holder.rtg-holder-page { max-width: var(--ls-main-content-max-width, 900px); margin: 0 auto; padding: 24px 12px 80px; }
/* The sidebar panel: smaller, no title or key list. */
.refinement-tags.rtg-mode-sidebar { font-size: 15px; }
.refinement-tags.rtg-mode-sidebar header { padding: 4px 0 10px; gap: 6px; }
.refinement-tags.rtg-mode-sidebar .rtg-root > .rtg-main .rtg-name { font-size: 16.5px; }
.refinement-tags.rtg-mode-sidebar .rtg-missing .rtg-ghost { font-size: 16.5px; }
.refinement-tags.rtg-mode-sidebar .rtg-propline, .refinement-tags.rtg-mode-sidebar .rtg-desc { display: none; }
.refinement-tags.rtg-mode-sidebar .rtg-section { padding-top: 14px; }
.refinement-tags.rtg-mode-sidebar .rtg-kids { margin-left: 10px; padding-left: 6px; }
.refinement-tags-menu { position: fixed; z-index: 10001; min-width: 240px; max-width: 340px; padding: 4px; border: 1px solid var(--ls-border-color); border-radius: 8px; background: var(--ls-primary-background-color); color: var(--ls-primary-text-color); box-shadow: 0 6px 20px rgba(0, 0, 0, .16); font-size: 14.5px; }
.refinement-tags-menu .rtg-mh { padding: 4px 12px 5px; font-size: 12.5px; color: color-mix(in srgb, var(--ls-primary-text-color) 55%, transparent); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.refinement-tags-menu button { display: flex; align-items: baseline; gap: 10px; width: 100%; padding: 6px 12px; border: 0; border-radius: 5px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.refinement-tags-menu button:focus { outline: none; }
.refinement-tags-menu button:hover, .refinement-tags-menu button:focus-visible, .refinement-tags-menu button.rtg-on { background: color-mix(in srgb, var(--ls-primary-text-color) 7%, transparent); }
.refinement-tags-menu button kbd { margin-left: auto; font: inherit; font-size: 11px; opacity: .45; }
.refinement-tags-menu .rtg-mnote { padding: 2px 12px 6px; font-size: 12.5px; line-height: 1.45; color: color-mix(in srgb, var(--ls-primary-text-color) 55%, transparent); }
.refinement-tags-menu button .rtg-path { margin-left: auto; padding-left: 12px; font-size: 12px; opacity: .5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.refinement-tags-menu hr { border: 0; border-top: 1px solid var(--ls-border-color); margin: 4px 6px; }
.refinement-tags-menu input { width: calc(100% - 8px); margin: 2px 4px 4px; padding: 4px 8px; border: 1px solid var(--ls-border-color); border-radius: 5px; background: transparent; color: inherit; font: inherit; font-size: 14px; outline: none; box-shadow: none; }
.refinement-tags-menu .rtg-list { max-height: 300px; overflow-y: auto; }
.refinement-tags-menu .rtg-none { padding: 6px 12px; font-size: 13px; opacity: .55; }
.refinement-tags .rtg-same { color: var(--rtg-warn) !important; cursor: pointer; }
.refinement-tags .rtg-same:hover { text-decoration: underline; text-underline-offset: 2px; }
.refinement-tags-dialog { position: fixed; inset: 0; z-index: 10003; display: flex; align-items: flex-start; justify-content: center; padding-top: 14vh; background: rgba(0, 0, 0, .25); }
.refinement-tags-dialog > div { width: min(480px, 92vw); padding: 20px 22px 16px; border: 1px solid var(--ls-border-color); border-radius: 10px; background: var(--ls-primary-background-color); color: var(--ls-primary-text-color); box-shadow: 0 10px 32px rgba(0, 0, 0, .2); font-size: 15px; line-height: 1.5; }
.refinement-tags-dialog h2 { margin: 0 0 10px; font-size: 17px; font-weight: 600; }
.refinement-tags-dialog ul { margin: 0 0 12px; padding-left: 18px; }
.refinement-tags-dialog li { margin: 2px 0; }
.refinement-tags-dialog p { margin: 0 0 12px; font-size: 14px; color: color-mix(in srgb, var(--ls-primary-text-color) 60%, transparent); }
.refinement-tags-dialog .rtg-btns { display: flex; justify-content: flex-end; gap: 8px; }
.refinement-tags-dialog button { border: 1px solid var(--ls-border-color); border-radius: 6px; padding: 5px 14px; background: none; color: inherit; font: inherit; font-size: 14px; cursor: pointer; }
.refinement-tags-dialog button.rtg-go { border-color: transparent; background: var(--ls-primary-text-color); color: var(--ls-primary-background-color); font-weight: 600; }
.refinement-tags-dialog button:focus-visible { outline: 2px solid color-mix(in srgb, var(--ls-primary-text-color) 40%, transparent); outline-offset: 1px; }
.refinement-tags-toast { position: fixed; z-index: 10002; left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; align-items: center; gap: 16px; max-width: min(560px, 90vw); padding: 9px 10px 9px 16px; border-radius: 8px;
  background: var(--ls-primary-text-color); color: var(--ls-primary-background-color); font-size: 14px; box-shadow: 0 6px 20px rgba(0, 0, 0, .18); }
.refinement-tags-toast span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.refinement-tags-toast button { flex: none; border: 0; border-radius: 5px; padding: 3px 10px; background: color-mix(in srgb, var(--ls-primary-background-color) 18%, transparent); color: inherit; font: inherit; font-weight: 600; cursor: pointer; }
.refinement-tags-toast button:hover { background: color-mix(in srgb, var(--ls-primary-background-color) 30%, transparent); }
`;

/* ---------- The tree ---------- */
/* One tag tree. mode is 'page' (the main view) or 'sidebar'. */
function createView(doc, mode) {
  const view = { doc, mode };
  for (const fn of CREATEVIEW_FUNCTIONS) view[fn.name] = (...args) => fn(view, ...args);
  view.compact = view.mode === 'sidebar';
  view.data = { tags: new Map(), byName: new Map(), byTitle: () => 0, sameName: new Map() };
  view.shown = []; // visible rows in order, for the arrow keys: { key, tag, parent, row, depth }
  view.cursorKey = null;
  view.cursorTag = null; // kept so the cursor finds a tag again after it moved
  view.menu = null;
  view.adding = null; // { key, parent } while a new tag is being typed
  view.renaming = null; // key of the row being renamed
  view.addingRoot = false; // while a new root is being typed
  view.picked = new Set(); // ids of tags picked with Cmd-click, Shift-click or x
  view.dragging = null; // { tag, parent }
  view.busy = false;
  view.loaded = false; // nothing is drawn until the tags have been read once, so missing roots do not flash up

  view.count = el(view.doc, 'span', { class: 'rtg-count' });
  view.find = el(view.doc, 'input', { class: 'rtg-find', type: 'text', placeholder: 'Find a tag', spellcheck: 'false', 'aria-label': 'Find a tag' });
  keepKeys(view.find);
  view.find.addEventListener('input', () => { view.cursorKey = null; view.cursorTag = null; view.draw(); });
  // keepKeys holds the find box's keys back from Logseq; the arrows and Enter still drive the tree.
  view.find.addEventListener('keydown', event => { if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) view.onKey(event); });
  view.foldAll = el(view.doc, 'button', { class: 'rtg-tool', title: 'Fold every tag that has tags inside', click: () => { for (const tag of view.data.tags.values()) if (tag.kids.length) folded.add(tag.uuid); for (const name of rootNames()) { const r = view.data.byName.get(name.toLowerCase()); if (r) folded.delete(r.uuid); } saveFolded(); view.draw(); } }, 'Fold');
  view.openAll = el(view.doc, 'button', { class: 'rtg-tool', title: 'Unfold every tag', click: () => { folded.clear(); saveFolded(); view.draw(); } }, 'Unfold');
  view.moveButton = view.compact
    ? el(view.doc, 'button', { class: 'rtg-tool', title: 'Show the tag tree as a full view in the main area', html: PAGE_ICON, click: () => openPage() })
    : el(view.doc, 'button', { class: 'rtg-tool', title: 'Show the tag tree in the right sidebar', html: SIDEBAR_ICON, click: () => openSidebar() });
  view.body = el(view.doc, 'div', { class: 'rtg-body' });
  // The bar that appears while several tags are picked.
  view.pickCount = el(view.doc, 'span', { class: 'rtg-pickcount' });
  view.pickBar = el(view.doc, 'div', { class: 'rtg-pickbar', hidden: true }, view.pickCount,
    el(view.doc, 'button', { class: 'rtg-tool rtg-pickgo', title: 'Show the picked tags at the top of the tree', click: () => view.rootsFromPicked() }, 'Make them roots'),
    el(view.doc, 'button', { class: 'rtg-tool', title: 'Put the picked tags inside another tag', click: event => view.movePicked(event.currentTarget) }, 'Move to …'),
    el(view.doc, 'button', { class: 'rtg-tool', title: 'Unpick them (Esc)', click: () => { view.picked.clear(); view.mark(false); } }, 'Clear'));
  view.footer = el(view.doc, 'footer', { html: '<span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>←</kbd> <kbd>→</kbd> fold, unfold</span><span><kbd>Enter</kbd> open tag · <kbd>⇧ Enter</kbd> in sidebar</span><span><kbd>n</kbd> new tag inside</span><span><kbd>m</kbd> move to … · <kbd>a</kbd> also under …</span><span><kbd>Tab</kbd> <kbd>⇧ Tab</kbd> in, out</span><span><kbd>⌘</kbd> click or <kbd>x</kbd> pick several · <kbd>⇧</kbd> click a row: pick a run</span><span><kbd>p</kbd> add a property</span><span><kbd>r</kbd> rename · <kbd>j</kbd> merge into …</span><span>Click a property to move it up, take it off or open it</span><span>Drag a tag onto another to move it; hold <kbd>⌥</kbd> to keep it where it was too</span>' });
  view.box = el(view.doc, 'div', { class: 'refinement-tags rtg-mode-' + view.mode, role: 'region', 'aria-label': 'Tag tree', tabindex: '-1' });
  if (view.compact) view.box.append(el(view.doc, 'header', {}, view.find, view.moveButton), view.pickBar, view.body);
  else view.box.append(el(view.doc, 'h1', { class: 'rtg-title' }, 'Tags'), el(view.doc, 'header', {}, view.count, view.find, view.foldAll, view.openAll, view.moveButton), view.pickBar, view.body, view.footer);

  /* The note at the bottom after a change, with Undo */
  view.toast = null; view.toastTimer = 0;
  view.box.addEventListener('keydown', view.onKey);
  view.doc.addEventListener('mousedown', view.onDown, true);
  // Clicking a blank part of the tree gives it the keyboard, for the arrow keys.
  view.box.addEventListener('mousedown', event => { if (!event.target.closest('input, button')) view.box.focus({ preventScroll: true }); });

  // Changes made elsewhere show up here too, unless something is being typed or dragged.
  view.timer = 0;
  view.offChanged = logseq.DB.onChanged(() => {
    clearTimeout(view.timer);
    view.timer = setTimeout(function again() {
      if (view.busy) return;
      if (view.menu || view.dragging || view.adding || view.renaming) { view.timer = setTimeout(again, 800); return; }
      view.refresh();
    }, 400);
  });
  openViews.add(view.draw);
  view.draw();
  return { node: view.box, refresh: view.refresh, destroy: view.destroy, focus: () => view.box.focus({ preventScroll: true }) };
}

/* Menus */
function closeMenu(view) { view.menu?.remove(); view.menu = null; }

function placeMenu(view, anchor) {
  const r = anchor.getBoundingClientRect(), m = view.menu.getBoundingClientRect();
  const win = view.doc.defaultView;
  view.menu.style.left = Math.max(8, Math.min(r.left, win.innerWidth - m.width - 8)) + 'px';
  view.menu.style.top = (r.bottom + m.height + 6 > win.innerHeight ? Math.max(8, r.top - m.height - 4) : r.bottom + 4) + 'px';
}

function menuKeys(view, event) {
  const buttons = [...view.menu.querySelectorAll('button')];
  const at = buttons.indexOf(view.doc.activeElement);
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const next = at < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1) : (at + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
    buttons[next]?.focus();
  } else if (event.key === 'Escape') { event.preventDefault(); view.closeMenu(); view.box.focus({ preventScroll: true }); }
  event.stopPropagation();
}

function showMenu(view, anchor, header, items) {
  view.closeMenu();
  view.menu = el(view.doc, 'div', { class: 'refinement-tags-menu', role: 'menu' });
  if (header) view.menu.append(el(view.doc, 'div', { class: 'rtg-mh' }, header));
  for (const item of items) {
    if (item === '-') { view.menu.append(el(view.doc, 'hr')); continue; }
    view.menu.append(el(view.doc, 'button', { role: 'menuitem', html: item.html, click: () => { view.closeMenu(); view.box.focus({ preventScroll: true }); item.run(); } }));
  }
  view.menu.addEventListener('keydown', view.menuKeys);
  view.doc.body.append(view.menu);
  view.menu.querySelector('button')?.focus({ preventScroll: true });
  view.placeMenu(anchor);
}

// A menu with a search box that lists tags to pick from.
function pickTag(view, anchor, header, choices, onPick) {
  view.closeMenu();
  const input = el(view.doc, 'input', { type: 'text', placeholder: 'Type to find a tag', spellcheck: 'false' });
  const listBox = el(view.doc, 'div', { class: 'rtg-list' });
  view.menu = el(view.doc, 'div', { class: 'refinement-tags-menu', role: 'menu' }, el(view.doc, 'div', { class: 'rtg-mh' }, header), input, listBox);
  const fill = () => {
    const q = input.value.trim().toLowerCase();
    const hits = choices.filter(c => !q || c.tag.title.toLowerCase().includes(q)).slice(0, 60);
    listBox.replaceChildren(...hits.map(c => el(view.doc, 'button', { role: 'menuitem', click: () => { view.closeMenu(); view.box.focus({ preventScroll: true }); onPick(c.tag); } },
      el(view.doc, 'span', {}, c.label ?? '#' + c.tag.title), c.path ? el(view.doc, 'span', { class: 'rtg-path' }, c.path) : null)));
    if (!hits.length) listBox.append(el(view.doc, 'div', { class: 'rtg-none' }, 'No tag by that name'));
  };
  input.addEventListener('input', fill);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); listBox.querySelector('button')?.click(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); listBox.querySelector('button')?.focus(); }
    else if (event.key === 'Escape') { event.preventDefault(); view.closeMenu(); view.box.focus({ preventScroll: true }); }
    event.stopPropagation();
  });
  keepKeys(input);
  view.menu.addEventListener('keydown', event => { if (event.target !== input) view.menuKeys(event); });
  fill();
  view.doc.body.append(view.menu);
  input.focus({ preventScroll: true });
  view.placeMenu(anchor);
}

function hideToast(view) { clearTimeout(view.toastTimer); view.toast?.remove(); view.toast = null; }

function showToast(view, text, undo) {
  view.hideToast();
  view.toast = el(view.doc, 'div', { class: 'refinement-tags-toast', role: 'status' }, el(view.doc, 'span', {}, text));
  if (undo) {
    const button = el(view.doc, 'button', {}, 'Undo');
    button.addEventListener('click', async () => { view.hideToast(); await view.act(undo, 'The change could not be undone'); });
    view.toast.append(button);
  }
  view.doc.body.append(view.toast);
  view.toastTimer = setTimeout(view.hideToast, 7000);
}

async function act(view, run, failText) {
  view.busy = true;
  let done = false;
  try { await run(); done = true; }
  catch (error) { warnOnce(failText, error); logseq.UI.showMsg(`${failText}: ${error?.message || error}`, 'warning'); }
  finally { view.busy = false; }
  await view.refresh();
  return done;
}

/* Changes */
function fresh(view, tag) { return view.data.tags.get(tag.id) || tag; }

function parentsTitle(view, parents) { return parents.length ? 'under ' + parents.map(p => '#' + p.title).join(', ') : 'at the top level, not placed yet'; }

// Puts a tag under new parents and offers to put it back.
async function reparent(view, tag, parents, said) {
  tag = view.fresh(tag);
  const before = tag.parents.slice();
  for (const parent of parents) if (isAbove(tag, parent)) { logseq.UI.showMsg(`#${tag.title} cannot go inside #${parent.title}, which is inside it`, 'warning'); return; }
  for (const parent of parents) folded.delete(parent.uuid);
  saveFolded();
  view.cursorTag = tag.id; view.cursorKey = null;
  await view.act(() => setParents(tag, parents), `#${tag.title} could not be moved`);
  const after = view.fresh(tag);
  if (after.parents.map(p => p.id).sort().join() === before.map(p => p.id).sort().join()) return;
  view.showToast(said || `#${tag.title} is now ${view.parentsTitle(after.parents)}`, async () => { view.cursorTag = tag.id; await setParents(view.fresh(tag), before); });
}

function moveTo(view, tag, from, to) { return view.reparent(tag, [...view.fresh(tag).parents.filter(p => p.id !== from?.id && p.id !== to?.id), ...(to ? [to] : [])]); }

function alsoUnder(view, tag, to) { return view.reparent(tag, [...view.fresh(tag).parents.filter(p => p.id !== to.id), to], `#${tag.title} is now also under #${to.title}`); }

function takeOut(view, tag, from) { return view.reparent(tag, view.fresh(tag).parents.filter(p => p.id !== from.id), `#${tag.title} is no longer under #${from.title}`); }

// Tags a tag may go under: user tags and Logseq's Task and Card, without the tag itself and what is inside it.
function targetsFor(view, tag, leaveOut = []) {
  const inside = tag ? below(tag) : new Set();
  return [...view.data.tags.values()]
    .filter(t => (!t.builtIn || PARENT_BUILT_INS.has(t.ident)) && (!tag || (t.id !== tag.id && !inside.has(t.id))) && !leaveOut.includes(t.id))
    .sort(view.data.byTitle)
    .map(t => ({ tag: t, path: pathOf(t) }));
}

function askMove(view, tag, parent, anchor) {
  const choices = view.targetsFor(tag, parent ? [parent.id] : []);
  if (parent || view.fresh(tag).parents.length) choices.unshift({ tag: null, label: 'The top level (no parent)' });
  view.pickTag(anchor, `Move #${tag.title} under …`, choices.map(c => c.tag ? c : { ...c, tag: { id: -1, title: '' } }), to => view.moveTo(tag, parent, to.id === -1 ? null : to));
}

function askAlso(view, tag, anchor) {
  view.pickTag(anchor, `Also put #${tag.title} under …`, view.targetsFor(tag, view.fresh(tag).parents.map(p => p.id)), to => view.alsoUnder(tag, to));
}

async function addTags(view, parent, text) {
  const names = text.split(',').map(name => name.trim().replace(/^#/, '').trim()).filter(Boolean);
  const made = [], moved = [];
  for (const name of names) {
    if (name.includes('/')) { logseq.UI.showMsg(`A tag name cannot have a / in it (${name})`, 'warning'); continue; }
    const existing = view.data.byName.get(name.toLowerCase());
    if (existing) {
      if (existing.builtIn) { logseq.UI.showMsg(`#${existing.title} is one of Logseq's own tags and stays where it is`, 'warning'); continue; }
      if (!parent || existing.parents.some(p => p.id === parent.id)) continue;
      if (isAbove(existing, parent)) { logseq.UI.showMsg(`#${existing.title} cannot go inside #${parent.title}, which is inside it`, 'warning'); continue; }
      const before = existing.parents.slice();
      await setParents(existing, [...existing.parents, parent]);
      moved.push({ title: existing.title, id: existing.id, before });
      continue;
    }
    const page = await logseq.Editor.getPage(name).catch(() => null);
    if (page && !view.data.tags.has(page.id)) { logseq.UI.showMsg(`There is already a page called “${page.title || name}” that is not a tag. Make it a tag on its page first.`, 'warning'); continue; }
    const tag = await makeTag(name);
    if (parent) await logseq.Editor.addTagExtends(tag.uuid, parent.uuid);
    made.push({ title: tag.title || tag.originalName || name, uuid: tag.uuid });
  }
  return { made, moved };
}

async function submitAdd(view, parent, text) {
  view.adding = null;
  if (parent) { folded.delete(parent.uuid); saveFolded(); }
  let result = { made: [], moved: [] };
  await view.act(async () => { result = await view.addTags(parent, text); }, 'The tag could not be made');
  const { made, moved } = result;
  const last = made.length ? view.data.byName.get(made[made.length - 1].title.toLowerCase()) : null;
  if (last) { view.cursorTag = last.id; view.cursorKey = null; view.draw(); }
  const where = parent ? ` inside #${parent.title}` : '';
  const bits = [];
  if (made.length) bits.push(`Made ${made.map(m => '#' + m.title).join(', ')}${where}`);
  if (moved.length) bits.push(`${moved.map(m => '#' + m.title).join(', ')} ${moved.length === 1 ? 'was' : 'were'} already a tag, now also${where}`);
  // Undo deletes a new tag by its id (never another tag with the same name) and puts a moved one back.
  if (bits.length) view.showToast(bits.join('. '), async () => {
    for (const m of moved) { const tag = view.data.tags.get(m.id); if (tag) await setParents(tag, m.before); }
    for (const m of made) await logseq.Editor.deletePage(m.uuid);
  });
}

function startAdd(view, parent, key) {
  view.adding = { parent, key };
  if (parent) { folded.delete(parent.uuid); saveFolded(); }
  view.draw();
}

async function rename(view, tag, name) {
  view.renaming = null;
  name = name.trim().replace(/^#/, '').trim();
  if (!name || name === tag.title) { view.draw(); return; }
  if (name.includes('/')) { logseq.UI.showMsg('A tag name cannot have a / in it', 'warning'); view.draw(); return; }
  const old = tag.title;
  view.cursorTag = tag.id;
  await view.act(() => logseq.Editor.renamePage(tag.uuid, name), `#${old} could not be renamed`);
  if (view.fresh(tag).title !== old) view.showToast(`#${old} is now #${view.fresh(tag).title}`, () => logseq.Editor.renamePage(tag.uuid, old));
}

// A tag shown in several places stays only in this one (or only at the top, for a root row).
function keepOnly(view, tag, parent) { return view.reparent(tag, parent ? [parent] : [], parent ? `#${tag.title} is now only under #${parent.title}` : `#${tag.title} is now only at the top`); }

// Merging: the kept tag is picked from a list that starts with the likely ones.
function askMerge(view, tag, parent, anchor) {
  const sameName = (view.data.sameName.get(tag.title.toLowerCase()) || []).filter(t => t.id !== tag.id);
  const siblings = parent ? parent.kids.filter(t => t.id !== tag.id && !t.builtIn) : [];
  const first = [...sameName.map(t => [t, 'same name']), ...tag.parents.filter(t => !t.builtIn).map(t => [t, 'parent']), ...siblings.map(t => [t, 'beside it']), ...tag.kids.filter(t => !t.builtIn).map(t => [t, 'inside it'])];
  const seen = new Set([tag.id]);
  const choices = [];
  for (const [t, why] of first) if (!seen.has(t.id)) { seen.add(t.id); choices.push({ tag: t, path: why }); }
  for (const t of [...view.data.tags.values()].filter(t => !t.builtIn).sort(view.data.byTitle)) if (!seen.has(t.id)) { seen.add(t.id); choices.push({ tag: t, path: pathOf(t) }); }
  view.pickTag(anchor, `Merge #${tag.title} into …`, choices, target => view.confirmMerge(tag, target));
}

async function confirmMerge(view, source, target) {
  source = view.fresh(source); target = view.fresh(target);
  let plan;
  try { plan = await planMerge(source, target, view.data.tags); }
  catch (error) { warnOnce('a merge could not be prepared', error); logseq.UI.showMsg('Could not look up what the merge would change: ' + (error?.message || error), 'warning'); return; }
  const n = (count, one, many) => plural(count, one, many);
  const lines = [];
  if (plan.tagged.length) lines.push(`${n(plan.tagged.length, 'node')} tagged #${source.title} get #${target.title} instead`);
  if (plan.textRefs.length) lines.push(`${n(plan.textRefs.length, 'block')} that mention #${source.title} in their text will point at #${target.title}`);
  if (plan.props.length) lines.push(`${n(plan.props.length, 'property value')} pointing at #${source.title} will point at #${target.title}`);
  if (plan.kids.length) lines.push(`${n(plan.kids.length, 'tag')} inside #${source.title} (${plan.kids.map(k => '#' + k.title).join(', ')}) move inside #${target.title}`);
  if (plan.newProps.length) lines.push(`#${target.title} gets the tag ${plan.newProps.length === 1 ? 'property' : 'properties'} ${plan.newProps.map(p => p.title).join(', ')}`);
  if (plan.desc) lines.push(`#${target.title} gets #${source.title}’s description`);
  if (plan.descDropped) lines.push(`#${source.title}’s description is dropped (#${target.title} has its own)`);
  if (plan.pageValues.size) {
    const what = [plan.pageValues.has('logseq.property/alias') && 'aliases', plan.pageValues.has('logseq.property/icon') && 'the icon', [...plan.pageValues.keys()].some(a => /^(user|plugin)\.property/.test(a)) && 'your own property values'].filter(Boolean);
    lines.push(`${what.join(', ')} on #${source.title}’s page go to #${target.title}’s page`);
  }
  if (plan.pageBlocks.length) lines.push(`${n(plan.pageBlocks.length, 'block')} written on #${source.title}’s page move to the end of #${target.title}’s page`);
  lines.push(`then #${source.title} is deleted`);
  const isRoot = rootNames().some(name => name.toLowerCase() === source.title.toLowerCase()) && !(view.data.sameName.get(source.title.toLowerCase())?.length > 1);
  const doc2 = view.doc;
  const go = el(doc2, 'button', { class: 'rtg-go' }, 'Merge');
  const cancel = el(doc2, 'button', {}, 'Cancel');
  const panel = el(doc2, 'div', { role: 'dialog', 'aria-label': 'Merge tags' },
    el(doc2, 'h2', {}, `Merge #${source.title} into #${target.title}?`),
    el(doc2, 'ul', {}, ...lines.map(line => el(doc2, 'li', {}, line))),
    el(doc2, 'p', {}, (isRoot ? `#${source.title} is one of your root tags; the tree will offer to make it again. ` : '') + 'The moves cannot be undone in one step, and Logseq deletes a tag for good (it does not go to the Recycle).'),
    el(doc2, 'div', { class: 'rtg-btns' }, cancel, go));
  const backdrop = el(doc2, 'div', { class: 'refinement-tags-dialog' }, panel);
  const close = () => { backdrop.remove(); view.box.focus({ preventScroll: true }); };
  cancel.addEventListener('click', close);
  backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) close(); });
  backdrop.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); close(); } });
  go.addEventListener('click', async () => {
    close();
    view.cursorTag = target.id; view.cursorKey = null;
    folded.delete(target.uuid); saveFolded();
    await view.act(() => runMerge(plan), `#${source.title} could not be merged into #${target.title}`);
    if (!view.data.tags.has(source.id)) view.showToast(`#${source.title} is merged into #${target.title}`);
  });
  doc2.body.append(backdrop);
  cancel.focus();
}

/* Picking several tags */
// Cmd-click picks or unpicks one tag; Shift-click on a row picks every row from the cursor to it.
function pickClick(view, item, event) {
  if (item.tag.builtIn) return;
  if (event.shiftKey && view.cursorKey) {
    const a = view.shown.findIndex(i => i.key === view.cursorKey), b = view.shown.findIndex(i => i.key === item.key);
    if (a >= 0 && b >= 0) for (const i of view.shown.slice(Math.min(a, b), Math.max(a, b) + 1)) if (!i.tag.builtIn) view.picked.add(i.tag.id);
    view.mark(false);
    return;
  }
  if (event.metaKey || event.ctrlKey) {
    if (view.picked.has(item.tag.id)) view.picked.delete(item.tag.id); else view.picked.add(item.tag.id);
    view.cursorKey = item.key; view.cursorTag = item.tag.id;
    view.mark(false);
    return;
  }
  if (view.picked.size) { view.picked.clear(); view.mark(false); }
}

function pickedTags(view) { return [...view.picked].map(id => view.data.tags.get(id)).filter(Boolean).sort(view.data.byTitle); }

function rootsFromPicked(view) {
  const tags = view.pickedTags();
  if (!tags.length) return;
  const titles = tags.map(t => t.title);
  view.picked.clear();
  view.setRoots([...rootNames().filter(n => !titles.some(t => view.sameTag(t, n))), ...titles], `${titles.map(t => '#' + t).join(', ')} ${titles.length === 1 ? 'is now a root' : 'are now roots'}`);
}

function movePicked(view, anchor) {
  const tags = view.pickedTags();
  if (!tags.length) return;
  const choices = [...view.data.tags.values()].filter(t => (!t.builtIn || PARENT_BUILT_INS.has(t.ident)) && !tags.some(m => isAbove(m, t))).sort(view.data.byTitle).map(t => ({ tag: t, path: pathOf(t) }));
  view.pickTag(anchor, `Move ${plural(tags.length, 'tag')} into …`, choices, async target => {
    const before = tags.map(t => [t, t.parents.slice()]);
    // A picked tag that sits inside another picked tag stays inside it; the others go under the
    // new tag alone. Parents that are dropped are named, and Undo puts them back.
    const dropped = [];
    const done = await view.act(async () => {
      for (const t of tags) {
        const keep = t.parents.filter(p => view.picked.has(p.id));
        for (const p of t.parents) if (!view.picked.has(p.id) && p.id !== target.id) dropped.push(`#${t.title} out of #${p.title}`);
        await setParents(t, keep.length ? keep : [target]);
      }
    }, 'The tags could not be moved');
    if (!done) return;
    view.picked.clear();
    view.showToast(`${plural(tags.length, 'tag')} moved into #${target.title}${dropped.length ? ` (${dropped.join(', ')})` : ''}`, async () => { for (const [t, parents] of before) await setParents(view.fresh(t), parents); });
  });
}

/* Root tags: the setting, changed from the tree */
function sameTag(view, a, b) { return a.toLowerCase() === b.toLowerCase(); }

async function setRoots(view, names, said) {
  const before = rootNames().join(', ');
  const save = value => { rootsOverride = value; logseq.updateSettings({ tagTreeRoots: value }); view.draw(); };
  save(names.join(', '));
  if (said) view.showToast(said, async () => save(before));
}

function moveRoot(view, tag, by) {
  const names = rootNames();
  const at = names.findIndex(n => view.sameTag(n, tag.title));
  const to = at + by;
  if (at < 0 || to < 0 || to >= names.length) return;
  [names[at], names[to]] = [names[to], names[at]];
  view.setRoots(names);
}

function unRoot(view, tag) { return view.setRoots(rootNames().filter(n => !view.sameTag(n, tag.title)), `#${tag.title} is no longer a root`); }

function makeRoot(view, tag) { return view.setRoots([...rootNames().filter(n => !view.sameTag(n, tag.title)), tag.title], `#${tag.title} is now a root`); }

function rootAddRow(view) {
  const input = el(view.doc, 'input', { class: 'rtg-input', type: 'text', spellcheck: 'false', placeholder: 'Root tag: an existing tag or a new name', title: 'Several at once: separate them with commas', 'aria-label': 'New root tag' });
  keepKeys(input);
  const done = () => { view.addingRoot = false; view.draw(); view.box.focus({ preventScroll: true }); };
  input.addEventListener('keydown', async event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); done(); return; }
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    const names = input.value.split(',').map(n => n.trim().replace(/^#/, '').trim()).filter(Boolean);
    view.addingRoot = false;
    if (!names.length) { done(); return; }
    const newNames = names.filter(n => !view.data.byName.has(n.toLowerCase()));
    if (newNames.length) await view.act(async () => { await view.addTags(null, newNames.join(', ')); }, 'The tag could not be made');
    const titles = names.map(n => view.data.byName.get(n.toLowerCase())?.title || n);
    view.setRoots([...rootNames().filter(n => !titles.some(t => view.sameTag(t, n))), ...titles], `${titles.map(t => '#' + t).join(', ')} ${titles.length === 1 ? 'is' : 'are'} now ${titles.length === 1 ? 'a root' : 'roots'}`);
  });
  input.addEventListener('blur', () => setTimeout(() => { if (view.addingRoot && !input.value.trim() && view.doc.activeElement !== input) { view.addingRoot = false; view.draw(); } }, 150));
  setTimeout(() => input.focus());
  return el(view.doc, 'div', { class: 'rtg-addrow', style: `--rtg-hue: var(--rtg-h${rootNames().length % HUES})` }, input);
}

/* Tag properties */
// The line under a tag's name: its own properties, then the ones it gets from each tag above it.
function propLine(view, tag, key) {
  const inherited = inheritedProps(tag);
  if (!tag.propList.length && !inherited.length) return null;
  const line = el(view.doc, 'div', { class: 'rtg-propline' });
  const chip = (prop, from) => el(view.doc, 'span', { class: 'rtg-prop' + (from ? ' rtg-inh' : ''), role: 'button',
    title: from ? `${prop.title} comes from #${from.title}` : view.passesDown(tag, prop),
    click: event => { event.stopPropagation(); view.setCursor(key); view.propMenu(tag, prop, from, event.currentTarget); } }, prop.title);
  if (tag.propList.length) line.append(el(view.doc, 'span', { class: 'rtg-plabel' }, 'properties'), ...tag.propList.map(p => chip(p)));
  const groups = new Map();
  for (const prop of inherited) groups.set(prop.from, [...(groups.get(prop.from) || []), prop]);
  for (const [from, props] of groups) line.append(el(view.doc, 'span', { class: 'rtg-plabel' }, 'from ', el(view.doc, 'b', {}, '#'), from.title), ...props.map(p => chip(p, from)));
  return line;
}

function passesDown(view, tag, prop) {
  const inside = [...below(tag)].map(id => view.data.tags.get(id)).filter(t => t && !t.propList.some(p => p.ident === prop.ident)).length;
  return inside ? `${prop.title}: on #${tag.title} and the ${plural(inside, 'tag')} inside it` : `${prop.title}: on #${tag.title}`;
}

function propMoves(view, tag, prop) { return view.fresh(tag).parents.filter(p => !p.builtIn && !p.propList.some(q => q.ident === prop.ident)); }

function propMenu(view, tag, prop, from, anchor) {
  tag = view.fresh(tag);
  const items = [{ html: `Open the property ${escapeHtml(prop.title)}`, run: () => openTag(prop) }];
  if (from) {
    items.push({ html: `Go to #${escapeHtml(from.title)}`, run: () => { const at = view.shown.find(i => i.tag.id === from.id); if (at) view.setCursor(at.key); } });
    if (!from.builtIn) items.push({ html: `Take it off #${escapeHtml(from.title)}`, run: () => view.takePropOff(from, prop) });
  } else {
    for (const parent of view.propMoves(tag, prop)) items.push({ html: `Move up to #${escapeHtml(parent.title)}`, run: () => view.movePropUp(tag, prop, parent) });
    if (!tag.builtIn) items.push({ html: `Take it off #${escapeHtml(tag.title)}`, run: () => view.takePropOff(tag, prop) });
  }
  view.showMenu(anchor, from ? `${prop.title}, from #${from.title}` : view.passesDown(tag, prop), items);
}

async function addProp(view, tag, prop) {
  if (await view.act(() => addTagProp(tag, prop), `${prop.title} could not be added`)) view.showToast(`#${tag.title} now has ${prop.title}`, () => removeTagProp(tag, prop));
}

async function takePropOff(view, tag, prop) {
  if (await view.act(() => removeTagProp(tag, prop), `${prop.title} could not be taken off`)) view.showToast(`#${tag.title} no longer has ${prop.title}; values already filled in stay`, () => addTagProp(tag, prop));
}

async function movePropUp(view, tag, prop, parent) {
  const moved = await view.act(async () => { await addTagProp(parent, prop); await removeTagProp(tag, prop); }, `${prop.title} could not be moved`);
  if (moved) view.showToast(`${prop.title} is now on #${parent.title} and every tag inside it`, async () => { await addTagProp(tag, prop); await removeTagProp(parent, prop); });
}

// Logseq lets a plugin make properties only under the plugin's own name, so a property of your own is
// made with Logseq's own Add tag property on the tag's page: it is opened and the name typed in for you.
async function newProperty(view, tag, name) {
  await openTag(tag);
  const hostDoc = host(), win = hostDoc.defaultView;
  const waitFor = async find => { for (let i = 0; i < 30; i++) { const node = find(); if (node) return node; await new Promise(r => setTimeout(r, 100)); } return null; };
  const button = await waitFor(() => [...hostDoc.querySelectorAll('#main-content-container button')].find(b => b.textContent.trim() === 'Add tag property'));
  const input = button && (button.click(), await waitFor(() => hostDoc.querySelector('input[placeholder="Add or change property"]')));
  if (input) {
    Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, name);
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
    input.focus();
  } else logseq.UI.showMsg(`On the #${tag.title} page, use Add tag property (above the title) to make “${name}”.`, 'info', { timeout: 9000 });
}

// A menu with a search box listing the graph's properties that the tag does not have yet.
async function askProperty(view, tag, anchor) {
  tag = view.fresh(tag);
  let all = [];
  try { all = await loadProps(); } catch (error) { warnOnce('properties could not be read', error); }
  const have = new Map([...tag.propList.map(p => [p.ident, null]), ...inheritedProps(tag).map(p => [p.ident, p.from])]);
  view.closeMenu();
  const input = el(view.doc, 'input', { type: 'text', placeholder: 'Type to find a property', spellcheck: 'false' });
  const listBox = el(view.doc, 'div', { class: 'rtg-list' });
  view.menu = el(view.doc, 'div', { class: 'refinement-tags-menu', role: 'menu' }, el(view.doc, 'div', { class: 'rtg-mh' }, `Add a property to #${tag.title}`), input, listBox);
  const pickIt = run => () => { view.closeMenu(); view.box.focus({ preventScroll: true }); run(); };
  const fill = () => {
    const q = input.value.trim().toLowerCase();
    const hits = all.filter(p => !have.has(p.ident) || have.get(p.ident)).filter(p => !q || p.title.toLowerCase().includes(q)).slice(0, 60);
    listBox.replaceChildren(...hits.map(p => {
      const from = have.get(p.ident);
      return el(view.doc, 'button', { role: 'menuitem', click: pickIt(() => view.addProp(tag, p)) }, el(view.doc, 'span', {}, p.title),
        el(view.doc, 'span', { class: 'rtg-path' }, from ? `already from #${from.title}` : p.type === 'default' ? 'text' : p.type));
    }));
    const exact = all.some(p => p.title.toLowerCase() === q);
    if (q && !exact) listBox.append(el(view.doc, 'button', { role: 'menuitem', click: pickIt(() => view.newProperty(tag, input.value.trim())) }, el(view.doc, 'span', {}, `New property “${input.value.trim()}” …`)));
    if (!listBox.childNodes.length) listBox.append(el(view.doc, 'div', { class: 'rtg-none' }, 'Type the name of a property'));
  };
  input.addEventListener('input', fill);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); listBox.querySelector('button')?.click(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); listBox.querySelector('button')?.focus(); }
    else if (event.key === 'Escape') { event.preventDefault(); view.closeMenu(); view.box.focus({ preventScroll: true }); }
    event.stopPropagation();
  });
  keepKeys(input);
  view.menu.addEventListener('keydown', event => { if (event.target !== input) view.menuKeys(event); });
  fill();
  view.doc.body.append(view.menu);
  input.focus({ preventScroll: true });
  view.placeMenu(anchor);
}

function rowMenu(view, item, anchor) {
  const { tag, parent } = item;
  const items = [{ html: `Open #${escapeHtml(tag.title)}<kbd>Enter</kbd>`, run: () => openTag(tag) },
    { html: 'Open in the right sidebar<kbd>⇧ Enter</kbd>', run: () => openTag(tag, true) }];
  if (!tag.builtIn || PARENT_BUILT_INS.has(tag.ident)) items.push('-', { html: 'New tag inside<kbd>n</kbd>', run: () => view.startAdd(tag, item.key) });
  if (!tag.builtIn) {
    items.push({ html: 'Move to …<kbd>m</kbd>', run: () => view.askMove(tag, parent, anchor) },
      { html: 'Also put under …<kbd>a</kbd>', run: () => view.askAlso(tag, anchor) });
    if (parent && tag.parents.length > 1) items.push({ html: `Take out of #${escapeHtml(parent.title)}`, run: () => view.takeOut(tag, parent) },
      { html: `Keep only under #${escapeHtml(parent.title)}`, run: () => view.keepOnly(tag, parent) });
    else if (parent) items.push({ html: 'Move to the top level', run: () => view.moveTo(tag, parent, null) });
    else if (tag.parents.length) items.push({ html: 'Keep only at the top', run: () => view.keepOnly(tag, null) });
    if (item.root) {
      const names = rootNames(), at = names.findIndex(n => view.sameTag(n, tag.title));
      items.push('-');
      if (at > 0) items.push({ html: 'Move this root up', run: () => view.moveRoot(tag, -1) });
      if (at < names.length - 1) items.push({ html: 'Move this root down', run: () => view.moveRoot(tag, 1) });
      items.push({ html: 'Stop showing it as a root', run: () => view.unRoot(tag) });
    } else if (!tag.parents.length) items.push({ html: 'Make it a root', run: () => view.makeRoot(tag) });
    items.push('-', { html: 'Add a property …<kbd>p</kbd>', run: () => view.askProperty(tag, anchor) },
      { html: 'Rename<kbd>r</kbd>', run: () => { view.renaming = item.key; view.draw(); } },
      { html: 'Merge into …<kbd>j</kbd>', run: () => view.askMerge(tag, parent, anchor) });
  } else if (item.root) items.push('-', { html: 'Stop showing it as a root', run: () => view.unRoot(tag) });
  if (view.picked.size > 1 && view.picked.has(tag.id)) items.unshift({ html: `Make the ${view.picked.size} picked tags roots`, run: () => view.rootsFromPicked() }, { html: `Move the ${view.picked.size} picked tags to …`, run: () => view.movePicked(anchor) }, '-');
  view.showMenu(anchor, '#' + tag.title, items);
}

/* Drawing */
function roots(view) { return rootNames().map((name, i) => ({ name, hue: i % HUES, tag: view.data.byName.get(name.toLowerCase()) })); }

function highlight(view, node, title, q) {
  const at = q ? title.toLowerCase().indexOf(q) : -1;
  if (at < 0) { node.textContent = title; return; }
  node.append(title.slice(0, at), el(view.doc, 'mark', {}, title.slice(at, at + q.length)), title.slice(at + q.length));
}

function draw(view) {
  if (!view.box.isConnected && view.shown.length) return;
  if (!view.loaded) { view.body.replaceChildren(el(view.doc, 'div', { class: 'rtg-empty' }, 'Reading your tags …')); return; }
  const q = view.find.value.trim().toLowerCase();
  // With a search, only matching tags and the tags above them are shown, unfolded.
  const keep = new Set();
  if (q) {
    const markMatch = tag => { if (keep.has(tag.id)) return; keep.add(tag.id); tag.parents.forEach(markMatch); };
    for (const tag of view.data.tags.values()) if (tag.title.toLowerCase().includes(q)) markMatch(tag);
  }
  const pass = { q, keep, visible: tag => !q || keep.has(tag.id), rootIds: null, section: '' }; // what every piece of the drawing reads
  const scrollKeep = view.box.closest('.sidebar-item-list, .cp__sidebar-main-content, #main-content-container') || view.doc.scrollingElement;
  const top = scrollKeep?.scrollTop;
  view.shown = [];
  const rootList = view.roots();
  pass.rootIds = new Set(rootList.filter(r => r.tag).map(r => r.tag.id));
  const sections = [];
  let tagTotal = 0;
  for (const tag of view.data.tags.values()) if (!tag.builtIn) tagTotal++;

  drawRoots(view, pass, rootList, sections);
  drawLoose(view, pass, sections);

  view.body.replaceChildren(...sections);
  view.count.textContent = plural(tagTotal, 'tag');
  // Keep the cursor on its row, or on the tag it was on if that moved.
  if (view.cursorTag != null) {
    const again = view.shown.find(item => item.key === view.cursorKey) || view.shown.find(item => item.tag.id === view.cursorTag);
    view.cursorKey = again?.key || null;
  }
  view.mark(false);
  if (scrollKeep && top != null) scrollKeep.scrollTop = top;
}

// One tag's row and, unless folded, the rows of the tags inside it.
function drawBranch(view, pass, tag, parent, depth, hue, path, keyBase) {
  const key = keyBase + '/' + tag.id;
  const kids = tag.kids.filter(kid => !path.has(kid.id) && pass.visible(kid));
  const open = pass.q ? true : !folded.has(tag.uuid);
  const isRoot = depth === 0 && pass.rootIds.has(tag.id);
  const row = el(view.doc, 'div', { class: 'rtg-row' + (kids.length ? ' rtg-branch' : '') + (isRoot ? ' rtg-root' : '') + (tag.builtIn ? ' rtg-builtin' : '') + (pass.q && !tag.title.toLowerCase().includes(pass.q) ? ' rtg-dim' : ''),
    'data-key': key, draggable: tag.builtIn ? null : 'true', style: hue != null ? `--rtg-hue: var(--rtg-h${hue})` : null });
  const item = { key, tag, parent, row, depth, sec: pass.section, root: isRoot };
  view.shown.push(item);
  const fold = el(view.doc, 'button', { class: 'rtg-fold' + (kids.length ? '' : ' rtg-leaf') + (open ? '' : ' rtg-shut'), tabindex: '-1', 'aria-label': open ? 'Fold' : 'Unfold', html: CHEVRON,
    click: event => { event.stopPropagation(); view.toggle(tag); } });
  const main = el(view.doc, 'div', { class: 'rtg-main' });
  const line = el(view.doc, 'div', { class: 'rtg-line' });
  if (view.renaming === key) {
    const input = renameBox(view, tag, key);
  line.append(input);
    setTimeout(() => { input.focus(); input.select(); });
  } else {
    const name = el(view.doc, 'span', { class: 'rtg-name', title: `Open #${tag.title} (⇧ click: right sidebar)` });
    view.highlight(name, tag.title, pass.q);
    name.addEventListener('click', event => { event.stopPropagation(); if ((event.metaKey || event.ctrlKey) && !tag.builtIn) { view.pickClick(item, event); return; } view.setCursor(key); openTag(tag, event.shiftKey).catch(error => warnOnce('a tag could not be opened', error)); });
    line.append(name);
  }
  rowLabels(view, line, tag, parent, key, open, kids, isRoot);
  main.append(line);
  if (tag.desc) main.append(el(view.doc, 'div', { class: 'rtg-desc' }, tag.desc));
  if (view.mode !== 'sidebar') { const props = view.propLine(tag, key); if (props) main.append(props); }
  const acts = el(view.doc, 'span', { class: 'rtg-acts' });
  if (!tag.builtIn || PARENT_BUILT_INS.has(tag.ident)) acts.append(el(view.doc, 'button', { class: 'rtg-act', tabindex: '-1', title: `New tag inside #${tag.title} (n)`, html: PLUS, click: event => { event.stopPropagation(); view.setCursor(key); view.startAdd(tag, key); } }));
  acts.append(el(view.doc, 'button', { class: 'rtg-act rtg-more', tabindex: '-1', title: 'More', html: DOTS, click: event => { event.stopPropagation(); view.setCursor(key); view.rowMenu(item, event.currentTarget); } }));
  row.append(fold, main, acts);
  rowListeners(view, row, item, tag, key);
  view.dragRow(row, item);
  const nodes = [row];
  const kidNodes = [];
  if (view.adding?.key === key) kidNodes.push(view.addRow(tag));
  if (open) {
    const nextPath = new Set(path).add(tag.id);
    for (const kid of kids) kidNodes.push(...drawBranch(view, pass, kid, tag, depth + 1, hue, nextPath, key));
  }
  if (kidNodes.length) nodes.push(el(view.doc, 'div', { class: 'rtg-kids', style: hue != null ? `--rtg-hue: var(--rtg-h${hue})` : null }, ...kidNodes));
  return nodes;
}

// The box that renames a tag in place (Enter renames, Escape leaves it).
function renameBox(view, tag, key) {
  const input = el(view.doc, 'input', { class: 'rtg-input', type: 'text', value: tag.title, spellcheck: 'false', 'aria-label': 'New name' });
    keepKeys(input);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); view.rename(tag, input.value); }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); view.renaming = null; view.draw(); view.box.focus({ preventScroll: true }); }
    });
    input.addEventListener('blur', () => { if (view.renaming === key) { view.renaming = null; view.draw(); } });
    return input;
}
// The small grey words after a tag's name: what is inside, how many nodes, its other parents, a namesake.
function rowLabels(view, line, tag, parent, key, open, kids, isRoot) {
  const inside = below(tag).size;
  if (isRoot) line.append(el(view.doc, 'span', { class: 'rtg-small' }, inside ? plural(inside, 'tag') + ' inside' : 'nothing inside yet'));
  else if (!open && kids.length) line.append(el(view.doc, 'span', { class: 'rtg-small', title: 'Folded' }, `${inside} inside`));
  if (tag.count) line.append(el(view.doc, 'span', { class: 'rtg-small', title: `${plural(tag.count, 'node')} tagged #${tag.title}` }, plural(tag.count, 'node')));
  const others = tag.parents.filter(p => p.id !== parent?.id);
  if (parent && others.length) line.append(el(view.doc, 'span', { class: 'rtg-small rtg-also' }, 'also under ' + others.map(p => '#' + p.title).join(', ')));
  if (view.data.sameName.has(tag.title.toLowerCase())) line.append(el(view.doc, 'span', { class: 'rtg-small rtg-same', title: 'Another tag has the same name. Click to merge them.', click: event => { event.stopPropagation(); view.setCursor(key); view.askMerge(tag, parent, event.currentTarget); } }, 'same name as another tag'));
}
// Clicks on a row: the cursor, picking, the menu, renaming.
function rowListeners(view, row, item, tag, key) {
  row.addEventListener('mousedown', event => { if (!event.target.closest('input')) { if (event.shiftKey || event.metaKey || event.ctrlKey) event.preventDefault(); else view.setCursor(key, false); } });
  row.addEventListener('click', event => { if (!event.target.closest('button, input, .rtg-name, .rtg-prop')) view.pickClick(item, event); });
  row.addEventListener('contextmenu', event => { event.preventDefault(); view.setCursor(key); view.rowMenu(item, { getBoundingClientRect: () => ({ left: event.clientX, top: event.clientY, bottom: event.clientY }) }); });
  row.addEventListener('dblclick', event => { if (!tag.builtIn && !event.target.closest('button, input')) { view.renaming = key; view.draw(); } });
}
// The roots, each with its colour, then the row that adds a root.
function drawRoots(view, pass, rootList, sections) {
// The roots, each with its colour.
for (const root of rootList) {
  pass.section = 'root:' + root.name;
  if (root.tag) { if (pass.visible(root.tag)) sections.push(el(view.doc, 'div', { class: 'rtg-section' }, ...drawBranch(view, pass, root.tag, null, 0, root.hue, new Set(), ''))); continue; }
  if (pass.q) continue;
  const make = el(view.doc, 'button', { class: 'rtg-make', click: () => view.act(async () => { await makeTag(root.name); }, `#${root.name} could not be made`) }, `Make #${root.name}`);
  const leave = el(view.doc, 'button', { class: 'rtg-make rtg-leave', title: `Stop showing #${root.name} as a root`, click: () => view.setRoots(rootNames().filter(n => n.toLowerCase() !== root.name.toLowerCase())) }, 'Not a root');
  sections.push(el(view.doc, 'div', { class: 'rtg-section' }, el(view.doc, 'div', { class: 'rtg-missing', style: `--rtg-hue: var(--rtg-h${root.hue})` }, el(view.doc, 'span', { class: 'rtg-ghost' }, root.name), make, leave)));
}
// Adding a root: an existing tag or a new one.
if (!pass.q) {
  if (view.addingRoot) sections.push(el(view.doc, 'div', { class: 'rtg-section' }, view.rootAddRow()));
  else sections.push(el(view.doc, 'div', { class: 'rtg-newroot' }, el(view.doc, 'button', { class: 'rtg-make', title: 'Show another tag at the top of the tree, or make a new one', click: () => { view.addingRoot = true; view.draw(); } }, '+ Root tag')));
}
}
// Tags under none of the roots, then the tags that extend Logseq's own tags.
function drawLoose(view, pass, sections) {
// Tags under none of the roots.
const loose = [...view.data.tags.values()].filter(tag => !tag.builtIn && !pass.rootIds.has(tag.id) && !tag.parents.length && pass.visible(tag)).sort(view.data.byTitle);
const looseHead = el(view.doc, 'h3', { class: 'rtg-group', 'data-drop': 'top' }, 'Not placed yet', el(view.doc, 'span', { class: 'rtg-hint' }, loose.length ? (view.compact ? String(loose.length) : 'Drag a tag onto a root, or press m to move it') : 'Every tag has a place'));
view.dropTarget(looseHead, null);
pass.section = 'loose';
const looseNodes = loose.flatMap(tag => drawBranch(view, pass, tag, null, 1, null, new Set(), 'loose'));
if (!pass.q || loose.length) sections.push(el(view.doc, 'div', { class: 'rtg-section rtg-loose' }, looseHead, ...looseNodes));
// Tags that extend Logseq's own tags, under those tags.
const builtIns = [...view.data.tags.values()].filter(tag => tag.builtIn && !tag.parents.length && tag.kids.some(kid => !kid.builtIn) && pass.visible(tag)).sort(view.data.byTitle);
pass.section = 'logseq';
if (builtIns.length) sections.push(el(view.doc, 'div', { class: 'rtg-section' }, el(view.doc, 'h3', { class: 'rtg-group' }, 'Under Logseq’s tags'), ...builtIns.flatMap(tag => drawBranch(view, pass, tag, null, 1, null, new Set(), 'logseq'))));
if (pass.q && !pass.keep.size) sections.push(el(view.doc, 'div', { class: 'rtg-empty' }, 'No tag by that name. Press Enter to make it.'));
}

function addRow(view, parent) {
  const input = el(view.doc, 'input', { class: 'rtg-input', type: 'text', spellcheck: 'false', placeholder: parent ? `New tag inside #${parent.title}` : 'New tag', title: 'Several at once: separate them with commas', 'aria-label': 'New tag' });
  keepKeys(input);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); const text = input.value.trim(); if (text) view.submitAdd(parent, text); else { view.adding = null; view.draw(); } }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); view.adding = null; view.draw(); view.box.focus({ preventScroll: true }); }
  });
  input.addEventListener('blur', () => setTimeout(() => { if (view.adding && !input.value.trim() && view.doc.activeElement !== input) { view.adding = null; view.draw(); } }, 150));
  setTimeout(() => input.focus());
  return el(view.doc, 'div', { class: 'rtg-addrow' }, input);
}

function toggle(view, tag) {
  if (folded.has(tag.uuid)) folded.delete(tag.uuid); else folded.add(tag.uuid);
  saveFolded();
  view.draw();
}

function setCursor(view, key, scroll = true) {
  view.cursorKey = key;
  view.cursorTag = view.shown.find(item => item.key === key)?.tag.id ?? null;
  view.mark(scroll);
}

function mark(view, scroll) {
  for (const item of view.shown) { item.row.classList.toggle('rtg-current', item.key === view.cursorKey); item.row.classList.toggle('rtg-picked', view.picked.has(item.tag.id)); }
  for (const id of [...view.picked]) if (!view.data.tags.has(id)) view.picked.delete(id);
  view.pickBar.hidden = !view.picked.size;
  view.pickCount.textContent = view.picked.size === 1 ? '1 tag picked' : `${view.picked.size} tags picked`;
  const item = view.shown.find(i => i.key === view.cursorKey);
  if (scroll && item) item.row.scrollIntoView({ block: 'nearest' });
}

/* Dragging a tag onto another */
function dragRow(view, row, item) {
  if (!item.tag.builtIn) {
    row.addEventListener('dragstart', event => {
      view.dragging = { tag: item.tag, parent: item.parent };
      event.dataTransfer.effectAllowed = 'copyMove';
      event.dataTransfer.setData('text/plain', '#' + item.tag.title);
      setTimeout(() => row.classList.add('rtg-dragging'));
    });
    row.addEventListener('dragend', () => { view.dragging = null; row.classList.remove('rtg-dragging'); view.clearDrop(); });
  }
  if (!item.tag.builtIn || PARENT_BUILT_INS.has(item.tag.ident)) view.dropTarget(row, item.tag);
}

function clearDrop(view) { return view.body.querySelectorAll('.rtg-drop').forEach(node => node.classList.remove('rtg-drop')); }

function dropTarget(view, node, target) {
  const allowed = () => {
    if (!view.dragging) return false;
    const tag = view.fresh(view.dragging.tag);
    if (!target) return tag.parents.length > 0;
    return target.id !== tag.id && !isAbove(tag, target) && !tag.parents.some(p => p.id === target.id);
  };
  node.addEventListener('dragover', event => {
    if (!allowed()) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = event.altKey ? 'copy' : 'move';
    if (!node.classList.contains('rtg-drop')) { view.clearDrop(); node.classList.add('rtg-drop'); }
  });
  node.addEventListener('dragleave', event => { if (!node.contains(event.relatedTarget)) node.classList.remove('rtg-drop'); });
  node.addEventListener('drop', event => {
    if (!allowed()) return;
    event.preventDefault(); event.stopPropagation();
    const { tag, parent } = view.dragging;
    view.dragging = null;
    view.clearDrop();
    if (!target) view.moveTo(tag, parent, null);
    else if (event.altKey) view.alsoUnder(tag, target);
    else view.moveTo(tag, parent, target);
  });
}

/* Keys */
function onKey(view, event) {
  if (!view.box.isConnected || view.menu?.contains(event.target)) return;
  const typing = event.target?.matches?.('input, textarea');
  if (event.key === 'Escape') {
    if (view.menu) view.closeMenu();
    else if (event.target === view.find && view.find.value) { view.find.value = ''; view.draw(); }
    else if (view.picked.size) { view.picked.clear(); view.mark(false); }
    else { view.doc.activeElement?.blur?.(); view.cursorKey = null; view.mark(false); }
    event.preventDefault(); event.stopPropagation();
    return;
  }
  if (view.menu && !typing) { event.stopPropagation(); return; }
  const at = view.shown.findIndex(item => item.key === view.cursorKey);
  const item = view.shown[at];
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (typing && event.target !== view.find) return;
    event.preventDefault(); event.stopPropagation();
    if (!view.shown.length) return;
    const next = event.key === 'ArrowDown' ? Math.min(view.shown.length - 1, at + 1) : Math.max(0, at < 0 ? 0 : at - 1);
    if (typing) { view.find.blur(); view.box.focus({ preventScroll: true }); }
    view.setCursor(view.shown[next].key);
    return;
  }
  if (event.key === 'Enter' && event.target === view.find && !item) {
    event.preventDefault(); event.stopPropagation();
    const name = view.find.value.trim();
    const hit = name && view.data.byName.get(name.replace(/^#/, '').toLowerCase());
    if (hit) { const row = view.shown.find(i => i.tag.id === hit.id); if (row) { view.find.blur(); view.box.focus({ preventScroll: true }); view.setCursor(row.key); } }
    else if (name) { view.find.value = ''; view.submitAdd(null, name); }
    return;
  }
  if (typing && !(event.key === 'Enter' && event.target === view.find)) return;
  if (!item) {
    if (event.key === '/') { event.preventDefault(); event.stopPropagation(); view.find.focus(); }
    else if (!(event.metaKey || event.ctrlKey || event.altKey)) event.stopPropagation();
    return;
  }
  const { tag, parent } = item;
  const plain = !event.metaKey && !event.ctrlKey && !event.altKey;
  const key = plain ? event.key.toLowerCase() : '';
  const stop = () => { event.preventDefault(); event.stopPropagation(); };
  if (event.key === 'Enter') { stop(); if (typing) { view.find.blur(); view.box.focus({ preventScroll: true }); } openTag(tag, event.shiftKey).catch(error => warnOnce('a tag could not be opened', error)); return; }
  if (event.key === 'ArrowRight') {
    stop();
    if (tag.kids.length && folded.has(tag.uuid)) view.toggle(tag);
    else if (view.shown[at + 1]?.depth > item.depth) view.setCursor(view.shown[at + 1].key);
    return;
  }
  if (event.key === 'ArrowLeft') {
    stop();
    if (tag.kids.length && !folded.has(tag.uuid) && !view.find.value) view.toggle(tag);
    else { const up = view.shown.slice(0, at).reverse().find(i => i.sec === item.sec && i.depth < item.depth); if (up) view.setCursor(up.key); }
    return;
  }
  if (event.key === 'Tab' && !tag.builtIn && !item.row.classList.contains('rtg-root')) {
    stop();
    if (event.shiftKey) {
      // Out: from its parent to the parent's parent (or the top level).
      if (!parent) return;
      const grand = view.shown.slice(0, at).reverse().find(i => i.depth < item.depth && i.tag.id === parent.id)?.parent ?? null;
      view.moveTo(tag, parent, grand);
    } else {
      // In: under the tag just above it at the same level.
      const prev = view.shown.slice(0, at).reverse().find(i => i.depth <= item.depth);
      if (prev && prev.sec === item.sec && prev.depth === item.depth && prev.tag.id !== tag.id && (!prev.tag.builtIn || PARENT_BUILT_INS.has(prev.tag.ident))) view.moveTo(tag, parent, prev.tag);
    }
    return;
  }
  if ((key === 'n' || event.key === '+') && (!tag.builtIn || PARENT_BUILT_INS.has(tag.ident))) { stop(); view.startAdd(tag, item.key); return; }
  if (key === 'm' && !tag.builtIn) { stop(); view.askMove(tag, parent, item.row.querySelector('.rtg-name') || item.row); return; }
  if (key === 'a' && !tag.builtIn) { stop(); view.askAlso(tag, item.row.querySelector('.rtg-name') || item.row); return; }
  if (key === 'r' && !tag.builtIn) { stop(); view.renaming = item.key; view.draw(); return; }
  if (key === 'x' && !tag.builtIn) { stop(); if (view.picked.has(tag.id)) view.picked.delete(tag.id); else view.picked.add(tag.id); view.mark(false); return; }
  if (key === 'p' && !tag.builtIn) { stop(); view.askProperty(tag, item.row.querySelector('.rtg-name') || item.row); return; }
  if (key === 'j' && !tag.builtIn) { stop(); view.askMerge(tag, parent, item.row.querySelector('.rtg-name') || item.row); return; }
  if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f')) { stop(); view.find.focus(); view.find.select(); return; }
  if (event.key === ' ' || event.key === 'ContextMenu') { stop(); view.rowMenu(item, item.row.querySelector('.rtg-more') || item.row); return; }
  // Shortcuts with Cmd, Ctrl or Option still reach Logseq.
  if (plain) event.stopPropagation();
}

function onDown(view, event) { if (view.menu && !view.menu.contains(event.target)) view.closeMenu(); }

async function refresh(view) {
  try { view.data = await loadTags(); view.loaded = true; }
  catch (error) { warnOnce('the tags could not be read', error); }
  view.draw();
}

function destroy(view) {
  view.closeMenu();
  view.hideToast();
  clearTimeout(view.timer);
  view.doc.removeEventListener('mousedown', view.onDown, true);
  try { view.offChanged?.(); } catch (error) { /* already off */ }
  openViews.delete(view.draw);
  view.box.remove();
}
// The pieces of createView, each given the view's state; createView binds them to the view by name.
const CREATEVIEW_FUNCTIONS = [closeMenu, placeMenu, menuKeys, showMenu, pickTag, hideToast, showToast, act, fresh, parentsTitle, reparent, moveTo, alsoUnder, takeOut, targetsFor, askMove, askAlso, addTags, submitAdd, startAdd, rename, keepOnly, askMerge, confirmMerge, pickClick, pickedTags, rootsFromPicked, movePicked, sameTag, setRoots, moveRoot, unRoot, makeRoot, rootAddRow, propLine, passesDown, propMoves, propMenu, addProp, takePropOff, movePropUp, newProperty, askProperty, rowMenu, roots, highlight, draw, addRow, toggle, setCursor, mark, dragRow, clearDrop, dropTarget, onKey, onDown, refresh, destroy];

/* ---------- The main view and the sidebar panel ---------- */
const ROUTE = '/refinement-tags';
const SIDEBAR_KEY = 'tag-tree';
const hosted = { page: false, sidebar: false };
function hostComponent(mode) {
  const React = logseq.Experiments.React;
  return function RefinementTagTree() {
    const ref = React.useRef(null);
    React.useEffect(() => {
      const holder = ref.current;
      if (!holder) return undefined;
      const view = createView(holder.ownerDocument, mode);
      holder.append(view.node);
      // Logseq titles a plugin's sidebar panel with its inner name.
      const heading = mode === 'sidebar' && holder.closest('.sidebar-item')?.querySelector('.page-title h3');
      if (heading) heading.textContent = 'Tag tree';
      view.refresh();
      return () => view.destroy();
    }, []);
    return React.createElement('div', { ref, className: 'refinement-tags-holder rtg-holder-' + mode });
  };
}
function registerHosts() {
  const React = logseq.Experiments?.React;
  if (!React?.createElement) { warnOnce('Logseq gives plugins no React here, so the tag tree cannot be shown'); return; }
  try {
    const Page = hostComponent('page');
    logseq.Experiments.registerRouteRenderer('refinement-tags', { name: 'refinement-tags', path: ROUTE, render: () => React.createElement(Page) });
    hosted.page = true;
  } catch (error) { warnOnce('the tag tree page could not be added', error); }
  try {
    const Side = hostComponent('sidebar');
    logseq.Experiments.registerSidebarRenderer(SIDEBAR_KEY, { title: 'Tag tree', render: () => React.createElement(Side) });
    hosted.sidebar = true;
  } catch (error) { warnOnce('the tag tree sidebar panel could not be added', error); }
}
function openPage() {
  if (!hosted.page) { openSidebar(); return; }
  host().defaultView.location.hash = '#' + ROUTE;
}
async function openSidebar() {
  if (!hosted.sidebar) { if (hosted.page) openPage(); return; }
  try {
    await logseq.Editor.openInRightSidebar('_sidebar.' + SIDEBAR_KEY);
    await logseq.App.setRightSidebarVisible?.(true);
  } catch (error) { warnOnce('the tag tree could not open in the sidebar', error); }
}
const openAs = () => (setting('tagTreeOpensAs') === 'sidebar' ? openSidebar : openPage)();

function start() {
  // Back on at the owner's word (0.4.152): the pause of 0.4.128 saved "off" in the settings, so it is
  // switched on once here; turned off again after that, it stays off.
  if (logseq.settings?.tagTreeEnabled === false && !logseq.settings?.tagTreeReinstated) {
    logseq.updateSettings({ tagTreeEnabled: true, tagTreeReinstated: true });
  } else if (!setting('tagTreeEnabled')) return; // off: nothing is registered
  else if (!logseq.settings?.tagTreeReinstated) logseq.updateSettings({ tagTreeReinstated: true });
  logseq.provideStyle({ key: 'refinement-tags', style: css });
  registerHosts();
  const binding = setting('tagTreeShortcut').trim().toLowerCase();
  logseq.App.registerCommandPalette({ key: 'show-tag-tree', label: 'Tag tree', ...(binding ? { keybinding: { binding } } : {}) }, openAs);
  logseq.App.registerCommandPalette({ key: 'show-tag-tree-page', label: 'Tag tree as a page' }, openPage);
  logseq.App.registerCommandPalette({ key: 'show-tag-tree-sidebar', label: 'Tag tree in the right sidebar' }, openSidebar);
  if (setting('tagTreeToolbarButton')) {
    logseq.provideModel({ refinementOpenTagTree: openAs });
    logseq.App.registerUIItem('toolbar', {
      key: 'refinement-tag-tree',
      template: `<a class="button" data-on-click="refinementOpenTagTree" title="Tag tree${binding ? ' (' + escapeHtml(binding) + ')' : ''}">${TREE_ICON}</a>`,
    });
  }
  window.refinementTags = { openPage, openSidebar, loadTags };
  const off = logseq.onSettingsChanged?.(() => { rootsOverride = null; for (const redraw of openViews) redraw(); });
  if (typeof off === 'function') onUnload(off);
  onUnload(() => { host().querySelector('.refinement-tags-menu')?.remove(); host().querySelector('.refinement-tags-toast')?.remove(); host().querySelector('.refinement-tags-dialog')?.remove(); });
}

(window.refinementParts ||= []).push({ name: 'tag tree', schema: settingsSchema, start, stop: runUnloadTasks });
})();
