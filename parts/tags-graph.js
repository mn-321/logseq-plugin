/* Loaded by main.js before parts/tags-props.js and parts/tags.js. Kept in its own scope; it draws nothing by itself. */
(() => {
/* The tag map, piece 1 of 3 (split out of parts/tags.js at 0.4.295, the audit of layers 1 and 2: "about twenty jobs in
   one file"): the map's state kept on this computer (folded tags, open properties, groups), reading the tags, and
   every change to the graph (parents, tag properties, what a property accepts, choices, descriptions, merging, a
   choice made its own child tag, a text property turned into links), with the small drawing helpers every piece uses.
   The pieces share one object, window.refinementTagMap (TM): parts/tags-graph.js and parts/tags-props.js put there what
   they have, loaded in that order before parts/tags.js, and each piece takes what it uses from there as it loads.
   parts/tags.js starts the map only when both are loaded, and says so otherwise; the other two alone do nothing. */
const shared = window.refinementShared;
const { host } = shared;
const { warnOnce, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (tag tree): ' });
const TM = window.refinementTagMap ||= {};
const setting = key => TM.setting(key);
const openViews = new Set(); // the draw function of every tree on screen, redrawn when the settings change
/* Groups of properties (0.4.243, the owner: "just for own organization, not actually change things, group properties
   together in properties list"): kept in the propertyGroups setting by name, read as [{ name, props: [lower names] }].
   A change from the map is used at once, as the order is. */
let groupsOverride = null;
const resetGroups = () => { groupsOverride = null; };
const readGroups = () => String(groupsOverride ?? setting('propertyGroups') ?? '').split(';').map(part => {
  const at = part.indexOf(':');
  const name = (at < 0 ? part : part.slice(0, at)).trim();
  const props = at < 0 ? [] : part.slice(at + 1).split(',').map(p => p.trim()).filter(Boolean);
  return { name, props };
}).filter(g => g.name);
const writeGroups = groups => groups.map(g => `${g.name}: ${g.props.join(', ')}`).join('; ');
function saveGroups(groups) { const value = writeGroups(groups); groupsOverride = value; logseq.updateSettings({ propertyGroups: value }); for (const draw of openViews) draw(); }
const groupOf = (groups, title) => groups.find(g => g.props.some(p => p.toLowerCase() === title.toLowerCase())) || null;
// A property put in a group leaves any other; null takes it out of every group.
function placeInGroup(title, groupName) {
  const before = readGroups(), groups = before.map(g => ({ name: g.name, props: g.props.filter(p => p.toLowerCase() !== title.toLowerCase()) }));
  if (groupName) { let g = groups.find(x => x.name.toLowerCase() === groupName.toLowerCase()); if (!g) { g = { name: groupName, props: [] }; groups.push(g); } g.props.push(title); }
  saveGroups(groups);
  return before;
}
const GROUPS_SHUT_KEY = 'refinement-tags-groups-shut';
const groupsShut = new Set((() => { try { return JSON.parse(localStorage.getItem(GROUPS_SHUT_KEY) || '[]'); } catch (error) { return []; } })());
const saveGroupsShut = () => { try { localStorage.setItem(GROUPS_SHUT_KEY, JSON.stringify([...groupsShut])); } catch (error) { /* kept for this session only */ } };

// Folded tags (by uuid), kept for next time on this computer.
const FOLD_KEY = 'refinement-tags-folded';
const folded = new Set((() => { try { return JSON.parse(localStorage.getItem(FOLD_KEY) || '[]'); } catch (error) { return []; } })());
const saveFolded = () => { try { localStorage.setItem(FOLD_KEY, JSON.stringify([...folded])); } catch (error) { /* kept for this session only */ } };
// The map (0.4.174): properties opened into their details (tag uuid|property id), and whether the properties a
// tag gets from tags above it are listed, both kept on this computer; the explanations opened with an i, for now.
const PROPS_KEY = 'refinement-tags-props-open', INHERITED_KEY = 'refinement-tags-inherited';
const propsOpen = new Set((() => { try { return JSON.parse(localStorage.getItem(PROPS_KEY) || '[]'); } catch (error) { return []; } })());
const saveProps = () => { try { localStorage.setItem(PROPS_KEY, JSON.stringify([...propsOpen])); } catch (error) { /* kept for this session only */ } };
// Whether the properties a tag gets from tags above it are listed: one object, so the tree's button and the property map
// read and set the same value (0.4.295).
const shown = { inherited: (() => { try { return localStorage.getItem(INHERITED_KEY) !== 'off'; } catch (error) { return true; } })() };
const saveInherited = () => { try { localStorage.setItem(INHERITED_KEY, shown.inherited ? 'on' : 'off'); } catch (error) { /* kept for this session only */ } };
const infoOpen = new Set();
const flip = (set, key) => { if (set.has(key)) set.delete(key); else set.add(key); };
// How a property reads backwards and whether it shows at the other end, from the two-way part; missing when that part is not running.
const twoWay = () => { const p = window.refinementCore?.provided; return p?.backwardsLabel && p.setBackwards ? p : null; };

/* ---------- Reading the tags ---------- */
// The graph is read through the model (parts/model.js, 0.4.224): every tag with its parents, properties and count,
// and what a tag, property, choice or node holds right now. Taken when asked, so a view made before start() (the
// tests) finds it too.
const model = () => window.refinementCore.provided;
// Logseq's own tags that other tags may extend; the rest of its tags (Page, Journal …) cannot be parents.
const PARENT_BUILT_INS = new Set(['logseq.class/Task', 'logseq.class/Card']);
const loadTags = () => model().tagGraph(error => warnOnce('what the properties hold could not be read', error));
const inheritedProps = tag => model().inheritedProps(tag);
// A tag's own properties ("Tag properties"). Logseq 2.0.2's addTagProperty and removeTagProperty refuse
// every tag ("Not a valid tag"), so the list is read and written as the tag's property itself.
const TAG_PROPS = 'logseq.property.class/properties';
const tagPropIds = tag => model().tagPropIds(tag);
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
// A property's "Specify node tags" (0.4.179), written the same way as a tag's properties: cleared, then one at a time,
// with what was there put back if a value cannot be written.
const ACCEPTS = 'logseq.property/classes';
async function setAccepts(prop, ids) {
  const read = () => model().acceptedIds(prop);
  const had = await read(), want = [...new Set(ids)];
  if (want.length === had.length && want.every(id => had.includes(id))) return;
  if (had.length) await logseq.Editor.removeBlockProperty(prop.uuid, ACCEPTS);
  const failed = [];
  for (const id of want) { try { await logseq.Editor.upsertBlockProperty(prop.uuid, ACCEPTS, id, { entityId: true }); } catch (error) { console.error(error); failed.push(id); } }
  const now = await read();
  if (!failed.length && want.every(id => now.includes(id))) return;
  for (const id of had) if (!now.includes(id)) await logseq.Editor.upsertBlockProperty(prop.uuid, ACCEPTS, id, { entityId: true }).catch(() => {});
  throw new Error('Logseq did not take the change; the list was put back as it was');
}
const removeTagProp = async (tag, prop) => setTagProps(tag, (await tagPropIds(tag)).filter(id => id !== prop.id));
// Choices: each is a small block that belongs to its property. Every change is read back to be sure.
const CHOICE_TYPES = new Set(['default', 'number', 'url']);
const choicesOf = prop => model().choicesOf(prop);
async function renameChoice(prop, choice, title) {
  await logseq.Editor.updateBlock(choice.uuid, title);
  if ((await choicesOf(prop)).find(c => c.uuid === choice.uuid)?.title !== title) throw new Error('Logseq kept the old name');
}
async function removeChoice(prop, choice) {
  const used = await model().choiceUse(prop, choice);
  if (used) throw new Error(`${plural(used, 'node')} still ${used === 1 ? 'has' : 'have'} it. Change ${used === 1 ? 'that node' : 'those nodes'} first, or rename the choice instead`);
  await logseq.Editor.removeBlock(choice.uuid);
  if ((await choicesOf(prop)).some(c => c.uuid === choice.uuid)) throw new Error('Logseq kept it');
}
// Choices are not moved from the map (0.4.193): Logseq 2.0.2 refuses a plugin's move up ("invalid data"), and a move
// down puts the choice last and writes it as a value on the property's own page. Their order is changed in the
// property's own settings, where Logseq does it itself.
// A tag's description; empty takes it away.
const DESCRIPTION = 'logseq.property/description';
async function setDescription(tag, text) {
  if (text) await logseq.Editor.upsertBlockProperty(tag.uuid, DESCRIPTION, text);
  else await logseq.Editor.removeBlockProperty(tag.uuid, DESCRIPTION);
  if ((await model().descriptionOf(tag)).trim() !== text) throw new Error('Logseq did not keep it');
}

// The graph's own properties (made by you or a plugin), for adding to a tag.
const loadProps = () => model().ownProps();
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
async function planMerge(source, target, tags) {
  const S = source.id;
  const facts = await model().mergeFacts(source, target);
  const pageValues = new Map();
  for (const [attr, value] of facts.ownValues) {
    const alias = attr === 'logseq.property/alias';
    if (!(/^(user|plugin)\.property/.test(attr) || alias || attr === 'logseq.property/icon')) continue;
    if (!alias && facts.targetAttrs.has(attr)) continue;
    if (value === target.id || value === S) continue;
    pageValues.set(attr, [...(pageValues.get(attr) || []), value]);
  }
  const textRefs = facts.refs.filter(r => r.title.includes(source.uuid));
  // Your own properties, and the two of Logseq's that can point at a tag: a page's aliases and a
  // property's "tags of its values".
  const props = facts.propRefs.filter(r => /^(user|plugin)\.property/.test(r.attr) || r.attr === 'logseq.property/alias' || r.attr === 'logseq.property/classes');
  const kids = source.kids.filter(kid => kid.id !== target.id);
  const newProps = source.propList.filter(p => p.ident && !target.propList.some(q => q.ident === p.ident));
  return {
    source, target,
    tagged: facts.tagged,
    textRefs,
    props,
    kids, newProps,
    pageBlocks: facts.pageBlocks,
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
    const values = await valuesOf(ref.uuid, ref.attr);
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
/* A choice made its own child tag (0.4.190), e.g. procedure type “Imaging” on #Procedure becomes #Imaging inside
   #Procedure: the nodes tagged #Procedure with that choice get #Imaging instead (they keep every value, since
   #Imaging gets all of #Procedure's properties), and the choice is cleared on them. The choice itself stays in
   the property's list, for you to remove from the map when nothing needs it (0.4.191, the owner's pick): Logseq
   2.0.2 does not let a plugin make a choice again once it is gone, so removing it here would leave Undo unable to
   bring it back. Every step is noted as it is made, so a failure puts back what was done and Undo puts back the
   whole of it (docs/MODELLING.md: child tags for short lists of broad kinds). */
const userValues = uuid => model().userValues(uuid);
const valuesOf = (uuid, ident) => model().valuesOf(uuid, ident);
async function setValues(uuid, prop, values) {
  if (!values.length) { await logseq.Editor.removeBlockProperty(uuid, prop.ident); return; }
  await logseq.Editor.upsertBlockProperty(uuid, prop.ident, prop.many ? values : values[0], { entityId: true, reset: true });
}
async function planChildTag(tag, prop, choice, data) {
  const [nodes, choiceId] = await Promise.all([model().choiceNodes(tag, prop, choice), model().idByUuid(choice.uuid)]);
  return { tag, prop, choice, choiceId, nodes, data };
}
// Is the name free for the new tag? A tag of that name already inside the tag is used as it is.
async function childTagName(plan, name) {
  if (!name) return { problem: 'Give the new tag a name' };
  if (name.includes('/')) return { problem: 'A tag name cannot have a / in it' };
  const existing = plan.data.byName.get(name.toLowerCase());
  if (existing) {
    if (existing.parents.some(p => p.id === plan.tag.id)) return { existing };
    return { problem: `There is already a tag #${existing.title}${existing.parents.length ? ' under ' + existing.parents.map(p => '#' + p.title).join(', ') : ''}. Pick another name, or move it inside #${plan.tag.title} first.` };
  }
  const page = await logseq.Editor.getPage(name).catch(() => null);
  if (page) return { problem: `There is already a page called “${page.title || name}” that is not a tag. Pick another name, or make that page a tag first.` };
  return {};
}
async function runChildTag(plan, name, existing) {
  const { tag, prop } = plan;
  const done = { made: null, child: existing || null, moved: [] };
  const undo = () => undoChildTag(plan, done);
  try {
    if (!done.child) {
      done.made = await makeTag(name);
      done.child = done.made;
      await logseq.Editor.addTagExtends(done.made.uuid, tag.uuid);
    }
    const lost = [];
    for (const uuid of plan.nodes) {
      const [had, values, tags] = await Promise.all([userValues(uuid), valuesOf(uuid, prop.ident), valuesOf(uuid, 'block/tags')]);
      const hadChild = !!done.made ? false : tags.includes(existing.id);
      if (!hadChild) await logseq.Editor.addBlockTag(uuid, done.child.uuid);
      done.moved.push({ uuid, values, hadChild, tagged: false, cleared: false });
      const step = done.moved[done.moved.length - 1];
      await logseq.Editor.removeBlockTag(uuid, tag.uuid); step.tagged = true;
      await setValues(uuid, prop, values.filter(v => v !== plan.choiceId)); step.cleared = true;
      const now = new Set(await userValues(uuid));
      if (had.some(a => a !== prop.ident && !now.has(a))) lost.push(uuid);
    }
    if (lost.length) throw new Error(`${plural(lost.length, 'node')} lost a value on the way`);
  } catch (error) {
    await undo().catch(again => warnOnce('a half-made child tag could not be put back', again));
    throw error;
  }
  return { done, undo };
}
async function undoChildTag(plan, done) {
  const { tag, prop } = plan;
  for (const step of done.moved.slice().reverse()) {
    if (step.cleared) await setValues(step.uuid, prop, step.values);
    if (step.tagged) await logseq.Editor.addBlockTag(step.uuid, tag.uuid);
    if (!step.hadChild) await logseq.Editor.removeBlockTag(step.uuid, done.child.uuid);
  }
  done.moved = [];
  if (done.made) { await logseq.Editor.deletePage(done.made.uuid); done.made = null; }
}
/* Turning a text property into links to pages (0.4.241, the owner: "create future Specialty property, rename old
   property Specialty, then transfer"). Logseq lets only itself make a property of yours, and locks a property's kind
   once it holds values, so: the old one is renamed "Specialty (old)" and keeps its values; a new Specialty is made
   with Logseq's own Add tag property, on the tag's page in the right sidebar, the plugin pressing its buttons (the
   name, Node, Skip choosing tag); one page per value is made or found and given a tag, "Specialty kind" unless renamed; the new
   property accepts that tag; each node gets its link. Everything is undone in reverse if a step fails, and by Undo. */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function planLinks(tag, prop, data) {
  const rows = await model().propTextValues(prop.ident);
  const byNode = new Map();
  for (const row of rows) byNode.set(row.uuid, [...byNode.get(row.uuid) || [], row.value]);
  const several = [...byNode.values()].some(values => values.length > 1);
  const titles = [...new Set(rows.map(r => r.value))].sort((a, b) => a.localeCompare(b));
  const pages = new Map();
  for (const title of titles) { const page = await logseq.Editor.getPage(title).catch(() => null); if (page?.uuid && page.uuid !== prop.uuid) pages.set(title, page); }
  return { tag, prop, data, byNode, several, titles, pages };
}
async function freeName(base) {
  for (let n = 1; n < 50; n++) { const name = n === 1 ? base : `${base} ${n}`; if (!await logseq.Editor.getPage(name).catch(() => null)) return name; }
  throw new Error(`no free name like “${base}”`);
}
// Logseq's own Add tag property, on the tag's page in the right sidebar, so the map stays open where it is. Since
// 0.4.305 it makes a property of any kind (the Properties view's + New property): the kind is picked in the box by
// the word Logseq shows for it, and a link skips choosing a tag (the map sets what it accepts itself).
const BOX_KINDS = { default: /^text$/i, number: /^number$/i, date: /^date$/i, datetime: /^date ?time$/i, checkbox: /^checkbox$/i, url: /^url$/i, node: /^node$/i };
const KIND_WORDS = { default: 'Text', number: 'Number', date: 'Date', datetime: 'DateTime', checkbox: 'Checkbox', url: 'Url', node: 'Node' };
async function makeProperty(tag, name, kind = 'node') {
  const doc = host(), win = doc.defaultView;
  const waitFor = async (find, tries = 40) => { for (let i = 0; i < tries; i++) { const node = find(); if (node) return node; await sleep(100); } return null; };
  const press = node => { for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) node.dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, view: win })); };
  // Only what floats over the page counts (the box and its lists): the tag's own page in the sidebar shows its
  // properties and its table's columns, so a "Date" there would be pressed in place of the box's Date (second reading).
  const shown = node => node.getClientRects().length > 0 && !node.closest('#right-sidebar, #main-content-container, #left-sidebar, .cp__header, .refinement-tags');
  const item = test => () => [...doc.querySelectorAll('[role="menuitem"], [role="option"], .menu-link, .cp__select-main .menu-link, button, li, a')]
    .filter(shown).find(node => test(node.textContent.trim()));
  await logseq.Editor.openInRightSidebar(tag.uuid);
  await logseq.App.setRightSidebarVisible?.(true);
  // On a tag's page in the sidebar the button under Tag Properties reads "Add property"; in the main view, above the
  // title, "Add tag property" (both seen in the app). The button is taken from the sidebar item whose header names
  // this tag (Logseq's .sidebar-item with its .sidebar-item-header, read in the app's own source): with another page
  // open in the sidebar first, the first such button was that page's, and the property landed on the wrong tag
  // (seen in the app, 0.4.305: a Date meant for #Report made on #Doctor).
  const named = text => text.replace(/^[#\s]+/, '').trim().toLowerCase();
  const button = await waitFor(() => [...doc.querySelectorAll('#right-sidebar .sidebar-item')]
    .filter(item => named(item.querySelector('.sidebar-item-header')?.textContent || '').startsWith(tag.title.toLowerCase()))
    .flatMap(item => [...item.querySelectorAll('button')]).find(b => /^Add (tag )?property$/.test(b.textContent.trim())));
  if (!button) throw new Error(`#${tag.title}’s page, with its Add property button, was not found in the right sidebar`);
  press(button);
  const input = await waitFor(() => doc.querySelector('input[placeholder="Add or change property"]') || (doc.activeElement?.matches?.('#right-sidebar input, .ui__popover-content input, [data-radix-popper-content-wrapper] input') ? doc.activeElement : null));
  if (!input) throw new Error('Logseq’s new property box did not open');
  Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, name);
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  const fail = what => { doc.activeElement?.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return new Error(`Logseq’s new property box did not show ${what}`); };
  const fresh = await waitFor(item(text => /^\+?\s*New option/i.test(text) && text.includes(name)));
  if (!fresh) throw fail(`“New option: ${name}”`);
  press(fresh);
  const want = BOX_KINDS[kind] || BOX_KINDS.node;
  const kindItem = await waitFor(item(text => want.test(text)));
  if (!kindItem) throw fail(`the kind “${KIND_WORDS[kind] || kind}”`);
  press(kindItem);
  if (kind === 'node') {
    const skip = await waitFor(item(text => text === 'Skip choosing tag'));
    if (!skip) throw fail('“Skip choosing tag”');
    press(skip);
  }
  let made = null;
  for (let i = 0; i < 50 && !made; i++) { made = await model().propNamed(name, kind); if (!made) await sleep(100); }
  if (!made) throw new Error(`Logseq did not make ${name}`);
  // Logseq makes the property first and puts it on the tag a moment later; the map waits for that too, or its first
  // reading would list the property on no tag (seen in the app, 0.4.305).
  for (let i = 0; i < 30; i++) { if ((await tagPropIds(tag)).includes(made.id)) break; await sleep(100); }
  return made;
}
const makeLinkProperty = (tag, name) => makeProperty(tag, name, 'node');
// Since 0.4.305 the new property may have a name of its own (the owner: "name of new property"); then the old one keeps
// its name and its words, and only a new property of the same name sends the old one to "… (old)".
async function runLinks(plan, tagName, propName = plan.prop.title) {
  const { prop, tag } = plan;
  const done = { oldTitle: prop.title, renamed: false, newProp: null, givers: [], madeTag: null, linkTag: null, made: [], tagged: [], filled: [] };
  const undo = () => undoLinks(plan, done);
  try {
    if (propName.toLowerCase() === prop.title.toLowerCase()) {
      const oldName = await freeName(`${prop.title} (old)`);
      await logseq.Editor.renamePage(prop.uuid, oldName);
      if (await model().titleNow(prop.uuid) !== oldName) throw new Error('Logseq kept the old name');
      done.renamed = true;
    }
    done.newProp = await makeLinkProperty(tag, propName);
    for (const giver of [...plan.data.tags.values()].filter(t => !t.builtIn && t.id !== tag.id && (t.propList || []).some(p => p.id === prop.id))) { await addTagProp(giver, done.newProp); done.givers.push(giver); }
    const existing = plan.data.byName.get(tagName.toLowerCase());
    if (existing && !existing.builtIn) done.linkTag = existing;
    else { done.madeTag = await makeTag(tagName); done.linkTag = done.madeTag; }
    if (done.linkTag.uuid === prop.uuid || done.linkTag.uuid === done.newProp.uuid) throw new Error(`#${tagName} came back as the property itself`);
    await setAccepts(done.newProp, [done.linkTag.id]);
    const ids = new Map();
    for (const title of plan.titles) {
      let page = plan.pages.get(title);
      if (page) {
        const tags = await valuesOf(page.uuid, 'block/tags');
        if (!tags.includes(done.linkTag.id)) { await logseq.Editor.addBlockTag(page.uuid, done.linkTag.uuid); done.tagged.push(page.uuid); }
      } else {
        page = await logseq.Editor.createPage(title, {}, { redirect: false, createFirstBlock: false });
        if (!page?.uuid) throw new Error(`the page “${title}” could not be made`);
        done.made.push(page.uuid);
        await logseq.Editor.addBlockTag(page.uuid, done.linkTag.uuid);
      }
      ids.set(title, page.id);
    }
    for (const [uuid, values] of plan.byNode) {
      await logseq.Editor.upsertBlockProperty(uuid, done.newProp.ident, ids.get(values[0]), { entityId: true });
      done.filled.push(uuid);
    }
  } catch (error) {
    await undo().catch(again => warnOnce('a half-done change to links could not be put back', again));
    throw error;
  }
  return { done, undo };
}
async function undoLinks(plan, done) {
  for (const uuid of done.filled.splice(0).reverse()) await logseq.Editor.removeBlockProperty(uuid, done.newProp.ident);
  for (const uuid of done.made.splice(0).reverse()) await logseq.Editor.deletePage(uuid);
  for (const uuid of done.tagged.splice(0)) await logseq.Editor.removeBlockTag(uuid, done.linkTag.uuid);
  if (done.madeTag) { await logseq.Editor.deletePage(done.madeTag.uuid); done.madeTag = null; }
  for (const giver of done.givers.splice(0)) await removeTagProp(giver, done.newProp);
  if (done.newProp) { await removeTagProp(plan.tag, done.newProp).catch(() => {}); await logseq.Editor.deletePage(done.newProp.uuid); done.newProp = null; }
  if (done.renamed) { await logseq.Editor.renamePage(plan.prop.uuid, done.oldTitle); done.renamed = false; }
}
async function openTag(tag, sidebar) {
  if (sidebar) await logseq.Editor.openInRightSidebar(tag.uuid);
  else logseq.App.pushState('page', { name: tag.uuid });
}

/* ---------- Look ---------- */
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Markup given as html (icons, a property's kind) is read once and copied after that: reading markup is the
// slowest part of drawing thousands of rows.
const parsed = new Map();
function fromHtml(doc, html) {
  let t = parsed.get(html);
  if (!t || t.ownerDocument !== doc) {
    if (parsed.size > 2000) parsed.clear();
    t = doc.createElement('template'); t.innerHTML = html; parsed.set(html, t);
  }
  return t.content.cloneNode(true);
}
// Elements given a handler here (a click, a key), so the redraw knows which old elements would act on old data.
const acting = new WeakSet();
const acts = node => node.nodeType === 1 && (acting.has(node) || [...node.querySelectorAll('*')].some(child => acting.has(child)));
function el(doc, tag, props = {}, ...children) {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.append(fromHtml(doc, value));
    else if (typeof value === 'function') { node.addEventListener(key, value); acting.add(node); }
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
// Each top-level tag has its own colour (four, in turn); every tag below it carries that colour on its # mark,
// so the branch a tag belongs to shows at a glance. Tags under Logseq's own tags keep a plain grey #.
const HUES = 4;
/* A plan's box sits under the row or menu it came from (0.4.288, the audit: no box in the middle of the window over a
   darkened page): the kit's anchored dialog (.rf-dialog.rf-anchored, parts/shared.js). A click anywhere else, Escape or
   Cancel closes it; onKey sees the other keys. Returns close(). */
function anchoredPanel(view, panel, anchor, onKey) {
  const doc = view.doc;
  panel.classList.add('rf-anchored');
  // A pick list opened from the box (the pages' tag, 0.4.305) is the map's menu: a click in it keeps the box.
  const away = event => { if (!panel.contains(event.target) && !view.menu?.contains(event.target)) close(); };
  const close = () => { panel.remove(); doc.removeEventListener('mousedown', away, true); view.box.focus({ preventScroll: true }); };
  panel.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); close(); return; } onKey?.(event); });
  for (const type of ['keyup', 'keypress']) panel.addEventListener(type, event => event.stopPropagation());
  doc.body.append(view.paint(panel));
  shared.placeBelow(panel, anchor?.isConnected ? anchor : view.box);
  doc.addEventListener('mousedown', away, true);
  return close;
}

Object.assign(TM, { ACCEPTS, CHEVRON, CHOICE_TYPES, DESCRIPTION, DOTS, EXTENDS, FOLD_KEY, GROUPS_SHUT_KEY, HUES, PAGE_ICON, PARENT_BUILT_INS, PLUS, PROPS_KEY, SIDEBAR_ICON, TAG_PROPS, TREE_ICON, acting, acts, addTagProp, anchoredPanel, below, childTagName, choicesOf, el, escapeHtml, flip, folded, freeName, fromHtml, groupOf, groupsOverride, groupsShut, infoOpen, inheritedProps, isAbove, keepKeys, loadProps, loadTags, makeLinkProperty, makeProperty, makeTag, model, openTag, openViews, parsed, pathOf, placeInGroup, planChildTag, planLinks, planMerge, plural, propsOpen, readGroups, removeChoice, removeTagProp, renameChoice, resetGroups, runChildTag, runLinks, runMerge, saveFolded, saveGroups, saveGroupsShut, saveInherited, saveProps, setAccepts, setDescription, setParents, setTagProps, setValues, shown, sleep, tagPropIds, twoWay, undoChildTag, undoLinks, userValues, valuesOf, writeGroups });
TM.graphLoaded = true;
(window.refinementParts ||= []).push({ name: 'tag map: the graph', schema: [], start() {}, stop: runUnloadTasks });
})();
