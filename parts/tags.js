/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Tag tree (0.4.30): every tag in the graph as one tree, so a tag's children are easy to see and to move.
   Tags move like Logseq's bullets (0.4.221): the top level is every tag with no parent (before, a fixed list of
   "root" names), and tags beside each other keep the order given them, kept in the tagTreeRoots setting.
   - A tag's place in the tree is its "Extends" property (:logseq.property.class/extends). A tag can
     extend more than one tag; it then shows under each of them, marked "also under …".
   - Tags that extend one of Logseq's own tags (Task, Card) are under "Under Logseq's tags".
   - Drag a tag onto another to move it there (hold Option to add the second parent and keep the
     first): above or below another to put it beside, below and to the right to put it inside.
     Tab, Shift+Tab and Cmd+Shift+Up/Down move it as in an outline. Every move can be undone.
   - New tags are made inside the tag they belong to, with the + on its row or the n key.
   Shown as a full view in the main area (a plugin route, #/refinement-tags) or as a panel in the
   right sidebar, both drawn with Logseq's own React like Todos.
   The tag and property map (0.4.174): in the main view an open tag lists its properties as rows, the
   ones it gets from tags above it faded, each with what it holds (text, a date, one of a few choices,
   a link to a #tag), and a property opens into where it comes from, what it accepts, and for a link how
   it reads from the other end, which can be changed there and turned off. Under the properties, the
   links that point at the tag from elsewhere. An i beside a property, and beside "Setting up a new tag",
   opens a short explanation; nothing else is explained unless asked. */
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
    description: 'All your tags as one tree, where you can see what is inside each tag, make new tags in the right place and move tags under other tags. In the full view an open tag also lists its properties (the ones it gets from tags above, faded), what each holds, and for a link how it reads on the page it points to, which you can change there. Open it from the tree button in the toolbar, from the command palette (Tag tree) or with its shortcut.' },
  { key: 'tagTreeEnabled', type: 'boolean', title: 'Use the tag tree', default: true,
    description: 'Off, the tag tree adds no toolbar button, no page, no sidebar panel, no command and no shortcut, and the settings below do nothing. Applies after you reload the plugin.' },
  { key: 'tagTreeRoots', type: 'string', title: 'Order of the tags', default: '',
    description: 'The order of tags beside each other in the tree, at every level (tags with no parent are the top level). Among tags with the same parent, the ones named here come first, in this order, separated by commas; the others follow by name. Dragging a tag above or below another, Cmd+Shift+Up and Down, or Move up and Move down in its menu, changes this for you.' },
  { key: 'propertyGroups', type: 'string', title: 'Groups of properties', default: '',
    description: 'Your own groups for the Properties view of the map, for keeping them in order; nothing in the graph changes. Each group is its name, a colon and its properties, separated by commas; groups are separated by semicolons, in the order shown: People and places: Provider, Spoke with; Dates: Date, End. A property sits in one group. Made, filled, renamed and removed from the map (+ New group, a property’s menu, dragging a property onto a group, a group’s menu), which changes this for you.' },
  { key: 'tagTreeOpensAs', type: 'enum', title: 'The button and shortcut open the tag tree as', default: 'page', enumChoices: ['page', 'sidebar'], enumPicker: 'radio',
    description: 'page: a full view in the main area, like a page. sidebar: a panel in the right sidebar. Both are also in the command palette.' },
  { key: 'tagTreeToolbarButton', type: 'boolean', title: 'Tag tree button in the toolbar', default: true,
    description: 'A tree button at the top right of Logseq opens the tag tree. Applies after you reload the plugin.' },
  { key: 'tagTreeShortcut', type: 'string', title: 'Open the tag tree', default: 'mod+alt+g',
    description: 'mod+alt+g is Cmd+Option+G on a Mac. Leave empty for no shortcut. Applies after you reload the plugin.' },
];
const setting = shared.settingReader(settingsSchema);
// An order changed from the tree is used at once; Logseq hands the saved setting back a little later.
let orderOverride = null;
const openViews = new Set(); // the draw function of every tree on screen, redrawn when the settings change
/* Groups of properties (0.4.243, the owner: "just for own organization, not actually change things, group properties
   together in properties list"): kept in the propertyGroups setting by name, read as [{ name, props: [lower names] }].
   A change from the map is used at once, as the order is. */
let groupsOverride = null;
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
const topOrder = () => (orderOverride ?? setting('tagTreeRoots')).split(',').map(name => name.trim().replace(/^#/, '')).filter(Boolean);

// Folded tags (by uuid), kept for next time on this computer.
const FOLD_KEY = 'refinement-tags-folded';
const folded = new Set((() => { try { return JSON.parse(localStorage.getItem(FOLD_KEY) || '[]'); } catch (error) { return []; } })());
const saveFolded = () => { try { localStorage.setItem(FOLD_KEY, JSON.stringify([...folded])); } catch (error) { /* kept for this session only */ } };
// The map (0.4.174): properties opened into their details (tag uuid|property id), and whether the properties a
// tag gets from tags above it are listed, both kept on this computer; the explanations opened with an i, for now.
const PROPS_KEY = 'refinement-tags-props-open', INHERITED_KEY = 'refinement-tags-inherited';
const propsOpen = new Set((() => { try { return JSON.parse(localStorage.getItem(PROPS_KEY) || '[]'); } catch (error) { return []; } })());
const saveProps = () => { try { localStorage.setItem(PROPS_KEY, JSON.stringify([...propsOpen])); } catch (error) { /* kept for this session only */ } };
let showInherited = (() => { try { return localStorage.getItem(INHERITED_KEY) !== 'off'; } catch (error) { return true; } })();
// Which way round the map is drawn (0.4.236, the owner's ask): by tag (the tree) or by property (every property once,
// with the tags that have it). Kept in Logseq's window storage, shared by the page and the sidebar.
const BY_KEY = 'refinement-tags-by';
let byProp = (() => { try { return localStorage.getItem(BY_KEY) === 'property'; } catch (error) { return false; } })();
const saveBy = () => { try { localStorage.setItem(BY_KEY, byProp ? 'property' : 'tag'); } catch (error) { /* kept for this session only */ } };
const saveInherited = () => { try { localStorage.setItem(INHERITED_KEY, showInherited ? 'on' : 'off'); } catch (error) { /* kept for this session only */ } };
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
// Logseq's own Add tag property, on the tag's page in the right sidebar, so the map stays open where it is.
async function makeLinkProperty(tag, name) {
  const doc = host(), win = doc.defaultView;
  const waitFor = async (find, tries = 40) => { for (let i = 0; i < tries; i++) { const node = find(); if (node) return node; await sleep(100); } return null; };
  const press = node => { for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) node.dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, view: win })); };
  const shown = node => node.getClientRects().length > 0;
  const item = test => () => [...doc.querySelectorAll('[role="menuitem"], [role="option"], .menu-link, .cp__select-main .menu-link, button, li, a')]
    .filter(shown).find(node => test(node.textContent.trim()));
  await logseq.Editor.openInRightSidebar(tag.uuid);
  await logseq.App.setRightSidebarVisible?.(true);
  // On a tag's page in the sidebar the button under Tag Properties reads "Add property"; in the main view, above the
  // title, "Add tag property" (both seen in the app). The tag just opened is the first item of the sidebar.
  const button = await waitFor(() => [...doc.querySelectorAll('#right-sidebar button')].find(b => /^Add (tag )?property$/.test(b.textContent.trim())));
  if (!button) throw new Error('Logseq’s Add tag property button was not found on the tag’s page');
  press(button);
  const input = await waitFor(() => doc.querySelector('input[placeholder="Add or change property"]') || (doc.activeElement?.matches?.('#right-sidebar input, .ui__popover-content input, [data-radix-popper-content-wrapper] input') ? doc.activeElement : null));
  if (!input) throw new Error('Logseq’s new property box did not open');
  Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, name);
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  const fail = what => { doc.activeElement?.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return new Error(`Logseq’s new property box did not show ${what}`); };
  const fresh = await waitFor(item(text => /^\+?\s*New option/i.test(text) && text.includes(name)));
  if (!fresh) throw fail(`“New option: ${name}”`);
  press(fresh);
  const node = await waitFor(item(text => text === 'Node'));
  if (!node) throw fail('the kind “Node”');
  press(node);
  const skip = await waitFor(item(text => text === 'Skip choosing tag'));
  if (!skip) throw fail('“Skip choosing tag”');
  press(skip);
  for (let i = 0; i < 50; i++) { const made = await model().propNamed(name, 'node'); if (made) return made; await sleep(100); }
  throw new Error(`Logseq did not make ${name}`);
}
async function runLinks(plan, tagName) {
  const { prop, tag } = plan;
  const done = { oldTitle: prop.title, renamed: false, newProp: null, givers: [], madeTag: null, linkTag: null, made: [], tagged: [], filled: [] };
  const undo = () => undoLinks(plan, done);
  try {
    const oldName = await freeName(`${prop.title} (old)`);
    await logseq.Editor.renamePage(prop.uuid, oldName);
    if (await model().titleNow(prop.uuid) !== oldName) throw new Error('Logseq kept the old name');
    done.renamed = true;
    done.newProp = await makeLinkProperty(tag, prop.title);
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

const css = `
.refinement-tags { --rtg-line: color-mix(in srgb, currentColor 16%, transparent); --rtg-wash: color-mix(in srgb, currentColor 7%, transparent); --rtg-border: color-mix(in srgb, currentColor 22%, transparent);
  --rtg-faint: color-mix(in srgb, currentColor 55%, transparent); --rtg-mid: color-mix(in srgb, currentColor 75%, transparent);
  --rtg-h0: #b07a2a; --rtg-h1: #4a76b4; --rtg-h2: #7c5fb3; --rtg-h3: #4e9a62; --rtg-plain: var(--rtg-faint); --rtg-warn: #b8641e;
  color: var(--ls-primary-text-color); font-size: 16px; }
.dark .refinement-tags, html[data-theme=dark] .refinement-tags { --rtg-h0: #dcae5e; --rtg-h1: #86a6db; --rtg-h2: #a990dc; --rtg-h3: #7fbf8c; --rtg-warn: #e09a5a; }
.refinement-tags:focus { outline: none; }
.refinement-tags button { font: inherit; color: inherit; }
.refinement-tags [hidden] { display: none !important; }
.refinement-tags .rtg-title { margin: 0 0 18px; padding: 0 10px; font-size: 2em; font-weight: 600; line-height: 1.2; }
.refinement-tags header { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 0 0 12px 10px; border-bottom: 1px solid var(--rtg-border); }
/* By tag or by property (0.4.236): two buttons in one pill; the pressed one filled. The sidebar's tools sit on a second line. */
.refinement-tags .rtg-switch { flex: none; display: inline-flex; border: 1px solid var(--rtg-border); border-radius: 7px; overflow: hidden; }
.refinement-tags .rtg-switch .rtg-tool { border-radius: 0; height: 26px; }
.refinement-tags .rtg-switch .rtg-tool + .rtg-tool { border-left: 1px solid var(--rtg-border); }
.refinement-tags .rtg-switch .rtg-tool[aria-pressed="true"] { background: var(--rtg-wash); color: var(--ls-primary-text-color) !important; font-weight: 600; }
.refinement-tags .rtg-tools { flex-basis: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.refinement-tags .rtg-ptop { padding-top: 4px; padding-bottom: 4px; }
.refinement-tags .rtg-ptop .rtg-pname { font-weight: 600; }
.refinement-tags .rtg-on { color: var(--rtg-faint); font-size: 14px; }
.refinement-tags .rtg-ontag { cursor: pointer; color: var(--rtg-mid); }
.refinement-tags .rtg-ontag:hover { text-decoration: underline; text-underline-offset: 2px; }
.refinement-tags.rtg-by-prop .rtg-pinfo { margin-left: 26px; }
.refinement-tags .rtg-find { flex: 1; min-width: 100px; padding: 6px 12px; border: 1px solid var(--rtg-border); border-radius: 7px; background: transparent; color: inherit; font: inherit; font-size: 15px; }
.refinement-tags .rtg-find:focus, .refinement-tags .rtg-input:focus { border-color: color-mix(in srgb, var(--ls-primary-text-color) 40%, transparent); outline: none; box-shadow: none; }
.refinement-tags .rtg-tool { flex: none; display: flex; align-items: center; justify-content: center; height: 28px; padding: 0 8px; border: 0; border-radius: 6px; background: none; cursor: pointer; color: var(--rtg-faint) !important; font-size: 13.5px !important; white-space: nowrap; }
.refinement-tags .rtg-tool:hover { background: var(--rtg-wash); color: var(--ls-primary-text-color) !important; }
.refinement-tags .rtg-body { padding: 4px 0 24px; }
.refinement-tags .rtg-section { padding-top: 22px; }
.refinement-tags h3.rtg-ghead { cursor: pointer; margin-left: 0; }
.refinement-tags h3.rtg-gnone { cursor: default; }
.refinement-tags h3.rtg-ghead .rtg-gmenu { opacity: 0; margin-left: auto; }
.refinement-tags h3.rtg-ghead:hover .rtg-gmenu { opacity: 1; }
.refinement-tags h3.rtg-gdrop { outline: 1.5px dashed currentColor; outline-offset: 2px; }
.refinement-tags .rtg-pgroup { margin-bottom: 10px; }
.refinement-tags .rtg-gempty { margin-left: 28px; font-size: 12.5px; }
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
.refinement-tags .rtg-row:not(.rtg-prow) > .rtg-main .rtg-name { font-weight: 600; }
.refinement-tags .rtg-root { padding-top: 5px; padding-bottom: 5px; }
.refinement-tags .rtg-root > .rtg-main .rtg-name { font-size: 19px; font-weight: 600; }
.refinement-tags .rtg-root > .rtg-fold { height: 30px; }
.refinement-tags .rtg-builtin > .rtg-main .rtg-name { color: var(--rtg-faint); }
.refinement-tags .rtg-small { font-size: 14px; color: var(--rtg-faint); font-variant-numeric: tabular-nums; white-space: nowrap; }
.refinement-tags .rtg-small + .rtg-small::before { content: '·'; margin-right: 8px; opacity: .7; }
.refinement-tags .rtg-also { font-style: italic; }
.refinement-tags .rtg-desc { margin-top: 1px; font-size: 13.5px; line-height: 1.4; color: var(--rtg-faint); }
.refinement-tags .rtg-acts { flex: none; display: flex; gap: 2px; opacity: 0; }
.refinement-tags .rtg-row:hover > .rtg-acts, .refinement-tags .rtg-row.rtg-current > .rtg-acts, .refinement-tags .rtg-root > .rtg-acts { opacity: 1; }
.refinement-tags .rtg-root:not(:hover):not(.rtg-current) > .rtg-acts .rtg-more { opacity: 0; }
.refinement-tags .rtg-act { display: flex; align-items: center; justify-content: center; width: 26px; height: 24px; border: 0; padding: 0; border-radius: 5px; background: none; color: var(--rtg-faint); cursor: pointer; }
.refinement-tags .rtg-act:hover { background: var(--rtg-wash); color: var(--ls-primary-text-color); }
.refinement-tags .rtg-kids { margin-left: 12px; padding-left: 10px; border-left: 1px solid var(--rtg-line); }
.refinement-tags .rtg-dim > .rtg-main .rtg-name { opacity: .55; }
.refinement-tags :is(.rtg-name, .rtg-pname) mark { margin: 0; padding: 0; border-radius: 0; background: none; color: inherit; text-decoration: underline; text-decoration-thickness: 2px; text-decoration-color: color-mix(in srgb, currentColor 40%, transparent); text-underline-offset: 3px; }
.refinement-tags .rtg-dragging { opacity: .4; }
.refinement-tags .rtg-drop { background: color-mix(in srgb, var(--rtg-hue, var(--ls-primary-text-color)) 12%, transparent) !important; box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--rtg-hue, var(--ls-primary-text-color)) 60%, transparent); }
.refinement-tags .rtg-drop-before::after, .refinement-tags .rtg-drop-after::after, .refinement-tags .rtg-drop-inside::after { content: ''; position: absolute; left: 24px; right: 8px; height: 3px; border-radius: 2px; background: color-mix(in srgb, var(--rtg-hue, var(--ls-primary-text-color)) 80%, transparent); pointer-events: none; }
.refinement-tags .rtg-drop-before::after { top: -1.5px; }
.refinement-tags .rtg-drop-after::after { bottom: -1.5px; }
.refinement-tags .rtg-drop-inside::after { bottom: -1.5px; left: 56px; }
.refinement-tags .rtg-top > .rtg-root ~ .rtg-root { margin-top: 12px; }
/* While a tag is dragged, a place under the top-level tags to drop it at the end of the top level. */
.refinement-tags .rtg-topzone { display: none; margin: 10px 0 0 24px; padding: 8px 12px; border: 1.5px dashed var(--rtg-border); border-radius: 7px; font-size: 14px; color: var(--rtg-faint); }
.refinement-tags.rtg-dragon .rtg-topzone { display: block; }
.refinement-tags .rtg-topzone.rtg-drop { border-style: solid; color: var(--ls-primary-text-color); }
.refinement-tags .rtg-addrow { display: flex; align-items: center; gap: 6px; padding: 3px 8px 3px 24px; }
.refinement-tags .rtg-addrow::before { content: '#'; color: var(--rtg-hue, var(--rtg-plain)); }
.refinement-tags .rtg-input { flex: 1; min-width: 0; padding: 2px 8px; border: 1px solid var(--rtg-border); border-radius: 6px; background: transparent; color: inherit; font: inherit; font-size: 15px; }
/* Renaming in place keeps the row's height (0.4.182): the box's padding and border sit in the row's own spacing. */
.refinement-tags .rtg-line > .rtg-input { box-sizing: border-box; height: 1.5em; margin-block: 0; padding-block: 0; line-height: 1; }
.refinement-tags .rtg-addrow .rtg-small { white-space: normal; }
.refinement-tags .rtg-make { border: 1px dashed var(--rtg-border); border-radius: 6px; padding: 1px 10px; background: none; cursor: pointer; font-size: 13.5px !important; color: var(--rtg-faint) !important; }
.refinement-tags .rtg-make:hover { border-style: solid; color: var(--ls-primary-text-color) !important; }
.refinement-tags .rtg-row.rtg-picked { background: color-mix(in srgb, var(--rtg-hue, var(--ls-primary-text-color)) 13%, transparent); box-shadow: inset 3px 0 0 color-mix(in srgb, var(--rtg-hue, var(--ls-primary-text-color)) 70%, transparent); }
.refinement-tags .rtg-pickbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 6px; margin: 8px 0 0; padding: 6px 8px 6px 12px; border-radius: 8px; background: var(--rtg-bg); box-shadow: inset 0 0 0 1px var(--rtg-border); }
.refinement-tags .rtg-pickcount { flex: 1; font-size: 14px; font-weight: 500; }
.refinement-tags .rtg-pickbar .rtg-pickgo { color: var(--ls-primary-text-color) !important; font-weight: 600; }
.refinement-tags .rtg-newroot { padding: 14px 8px 0 24px; }
.refinement-tags .rtg-empty { padding: 4px 10px 4px 34px; font-size: 14px; color: var(--rtg-faint); }
/* The map: a tag's properties as rows under it, faded when they come from a tag above. */
.refinement-tags .rtg-prow { padding-top: 2px; padding-bottom: 2px; font-size: 16px; }
.refinement-tags .rtg-prow > .rtg-fold { height: 22px; }
.refinement-tags .rtg-prow .rtg-line { align-items: center; }
.refinement-tags .rtg-pname { cursor: pointer; font-weight: 400; overflow-wrap: anywhere; } /* lighter than a tag's name, so the two are told apart (0.4.227) */
.refinement-tags .rtg-pname:hover { text-decoration: underline; text-underline-offset: 2px; }
.refinement-tags .rtg-inh .rtg-main { opacity: .62; }
.refinement-tags .rtg-inh .rtg-pname { font-weight: 400; }
.refinement-tags .rtg-ptype { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 6px; font-size: 15px; color: var(--rtg-mid); cursor: pointer; }
.refinement-tags .rtg-kind { padding: 0 6px; border: 1px solid var(--rtg-border); border-radius: 4px; font-size: 11.5px; line-height: 17px; letter-spacing: .05em; text-transform: uppercase; color: var(--rtg-faint); }
.refinement-tags .rtg-ptype [data-act] { border-radius: 4px; }
.refinement-tags .rtg-ptype .rtg-kind:hover { border-color: currentColor; color: var(--rtg-mid); }
.refinement-tags .rtg-ptype .rtg-tv:hover { text-decoration: underline; text-decoration-color: var(--rtg-border); text-underline-offset: 3px; }
.refinement-tags .rtg-desc { cursor: text; }
.refinement-tags .rtg-desc:hover { color: var(--rtg-mid); }
.refinement-tags .rtg-tv { font-style: italic; }
.refinement-tags .rtg-prow .rtg-small { color: var(--rtg-faint); font-size: 14px; }
.refinement-tags .rtg-ptype b { font-weight: 500; color: var(--rtg-hue, var(--rtg-plain)); }
.refinement-tags .rtg-i { flex: none; width: 17px; height: 17px; padding: 0; border: 1px solid var(--rtg-border); border-radius: 50%; background: none; cursor: pointer;
  color: var(--rtg-faint) !important; font: italic 600 11px/15px Georgia, 'Times New Roman', serif !important; text-align: center; }
.refinement-tags .rtg-i:hover, .refinement-tags .rtg-i[aria-pressed=true] { color: var(--ls-primary-text-color) !important; border-color: color-mix(in srgb, var(--ls-primary-text-color) 45%, transparent); }
.refinement-tags .rtg-pinfo { display: flex; flex-direction: column; gap: 5px; margin: 2px 0 6px 26px; padding: 4px 12px; border-left: 2px solid var(--rtg-line); font-size: 15px; line-height: 1.45; }
.refinement-tags .rtg-pinfo .rtg-plbl, .refinement-tags .rtg-pinfo .rtg-note { color: var(--rtg-faint); }
.refinement-tags .rtg-pinfo > div { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; }
.refinement-tags .rtg-plbl { min-width: 9.5em; }
.refinement-tags .rtg-pinfo .rtg-val, .refinement-tags .rtg-pointrow .rtg-val { font-weight: 600; }
.refinement-tags .rtg-words { width: 13em; padding: 1px 7px; border: 1px solid var(--rtg-border); border-radius: 5px; background: transparent; color: var(--ls-primary-text-color); font: inherit; }
.refinement-tags .rtg-words:focus { border-color: color-mix(in srgb, var(--ls-primary-text-color) 40%, transparent); outline: none; box-shadow: none; }
.refinement-tags .rtg-pinfo .rtg-make { padding: 0 8px; font-size: 12.5px !important; }
.refinement-tags .rtg-guide { max-width: 60em; margin: 2px 8px 6px 26px; padding: 8px 12px; border-radius: 7px; background: var(--rtg-wash);
  border-left: 3px solid color-mix(in srgb, var(--rtg-hue, var(--ls-primary-text-color)) 55%, transparent); font-size: 13.5px; line-height: 1.5; }
.refinement-tags .rtg-guide p { margin: 0 0 6px; }
.refinement-tags .rtg-guide p:last-child, .refinement-tags .rtg-guide ol { margin-bottom: 0; }
.refinement-tags .rtg-guide ol { margin-top: 0; padding-left: 18px; }
.refinement-tags .rtg-guide li { margin: 2px 0; }
.refinement-tags .rtg-guide .rtg-end { display: block; margin: 2px 0 2px 10px; }
.refinement-tags .rtg-pointrow { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; padding: 4px 8px 4px 26px; font-size: 15px; }
.refinement-tags .rtg-pointrow .rtg-note { color: var(--rtg-faint); }
.refinement-tags .rtg-off { font-style: italic; }
/* The main view: the tree as a page, scrolled with the page. */
.refinement-tags-holder.rtg-holder-page { max-width: var(--ls-main-content-max-width, 900px); margin: 0 auto; padding: 24px 12px 80px; }
/* The sidebar panel: smaller, no title or key list. */
.refinement-tags.rtg-mode-sidebar { font-size: 15px; }
.refinement-tags.rtg-mode-sidebar header { padding: 4px 0 10px; gap: 6px; }
.refinement-tags.rtg-mode-sidebar .rtg-root > .rtg-main .rtg-name { font-size: 16.5px; }
.refinement-tags.rtg-mode-sidebar .rtg-section { padding-top: 14px; }
.refinement-tags.rtg-mode-sidebar .rtg-kids { margin-left: 10px; padding-left: 6px; }
/* Menus and dialogs: the plugin's one pop-up and dialog look (.rf-pop, .rf-dialog, parts/shared.js, 0.4.257); here only
   what the tag map's own boxes add to it. */
.refinement-tags-menu { min-width: 240px; max-width: 340px; }
.refinement-tags-menu button.rtg-on { background: var(--rf-ui-hover); }
.refinement-tags-menu button kbd { margin-left: auto; font: inherit; font-size: 11px; opacity: .45; }
.refinement-tags-menu .rtg-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.refinement-tags-menu.rtg-choices { width: 320px; }
.refinement-tags-menu .rtg-crow { display: flex; align-items: center; gap: 2px; padding-right: 4px; }
.refinement-tags-menu .rtg-crow input { flex: 1; min-width: 0; width: auto; margin: 2px 4px; }
.refinement-tags-menu button.rtg-cb { flex: none; display: flex; justify-content: center; align-items: center; width: 26px; height: 26px; padding: 0; border: 0;
  border-radius: 5px; background: none; color: inherit; font: inherit; cursor: pointer; opacity: .75; }
.refinement-tags-menu button.rtg-cb:hover { opacity: 1; background: var(--rf-ui-hover); }
.refinement-tags-menu button.rtg-cb[disabled] { opacity: .2; cursor: default; background: none; }
.refinement-tags-menu.rtg-descbox { width: 340px; }
.refinement-tags-menu textarea { line-height: 1.45; resize: vertical; }
.refinement-tags .rtg-same { color: var(--rtg-warn) !important; cursor: pointer; }
.refinement-tags .rtg-same:hover { text-decoration: underline; text-underline-offset: 2px; }
.refinement-tags-dialog li { margin: 2px 0; }
.refinement-tags-dialog .rtg-namefield { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; }
.refinement-tags-dialog .rtg-namefield input { flex: 1; min-width: 0; width: auto; }
.refinement-tags-dialog .rtg-note { color: var(--rf-ui-muted); }
.refinement-tags-dialog p.rtg-warn { color: #b8641e; }
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
  view.picked = new Set(); // ids of tags picked with Cmd-click, Shift-click or x
  view.dragging = null; // { tag, parent }
  view.busy = false;
  view.loaded = false; // nothing is drawn until the tags have been read once

  view.find = el(view.doc, 'input', { class: 'rtg-find', type: 'text', placeholder: 'Find a tag or property', spellcheck: 'false', 'aria-label': 'Find a tag or property' });
  keepKeys(view.find);
  view.find.addEventListener('input', () => { view.cursorKey = null; view.cursorTag = null; view.draw(); });
  // keepKeys holds the find box's keys back from Logseq; the arrows and Enter still drive the tree.
  view.find.addEventListener('keydown', event => { if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) view.onKey(event); });
  view.foldAll = el(view.doc, 'button', { class: 'rtg-tool', title: 'Fold every tag that has tags or properties inside', click: () => { for (const tag of view.data.tags.values()) if (tag.kids.length || view.hasRows(tag)) folded.add(tag.uuid); for (const top of view.topTags()) folded.delete(top.uuid); saveFolded(); view.draw(); } }, 'Fold');
  view.openAll = el(view.doc, 'button', { class: 'rtg-tool', title: 'Unfold every tag', click: () => { folded.clear(); saveFolded(); view.draw(); } }, 'Unfold');
  view.inherited = el(view.doc, 'button', { class: 'rtg-tool', title: 'List the properties each tag gets from the tags above it, faded', click: () => { showInherited = !showInherited; saveInherited(); view.draw(); } });
  view.moveButton = view.compact
    ? el(view.doc, 'button', { class: 'rtg-tool', title: 'Show the tag tree as a full view in the main area', html: PAGE_ICON, click: () => openPage() })
    : el(view.doc, 'button', { class: 'rtg-tool', title: 'Show the tag tree in the right sidebar', html: SIDEBAR_ICON, click: () => openSidebar() });
  view.body = el(view.doc, 'div', { class: 'rtg-body' });
  // The bar that appears while several tags are picked.
  view.pickCount = el(view.doc, 'span', { class: 'rtg-pickcount' });
  view.pickBar = el(view.doc, 'div', { class: 'rtg-pickbar', hidden: true }, view.pickCount,
    el(view.doc, 'button', { class: 'rtg-tool rtg-pickgo', title: 'Take the picked tags out of their parents, to the top level', click: () => view.topFromPicked() }, 'To the top level'),
    el(view.doc, 'button', { class: 'rtg-tool', title: 'Put the picked tags inside another tag', click: event => view.movePicked(event.currentTarget) }, 'Move to …'),
    el(view.doc, 'button', { class: 'rtg-tool', title: 'Unpick them (Esc)', click: () => { view.picked.clear(); view.mark(false); } }, 'Clear'));
  // By tag or by property (0.4.236). The sidebar has the same tools as the page now (the owner: "fully functional").
  const byButton = (on, text, title) => el(view.doc, 'button', { class: 'rtg-tool rtg-by', 'data-by': on ? 'property' : 'tag', title, 'aria-pressed': String(byProp === on),
    click: () => { if (byProp === on) return; byProp = on; saveBy(); view.cursorKey = null; view.cursorTag = null; view.closeMenu(); for (const draw of openViews) draw(); } }, text);
  view.byTags = byButton(false, 'Tags', 'Every tag as a tree, with its properties');
  view.byProps = byButton(true, 'Properties', 'Every property once, with the tags that have it');
  view.toggle2 = el(view.doc, 'div', { class: 'rtg-switch', role: 'group', 'aria-label': 'Arrange by' }, view.byTags, view.byProps);
  view.box = el(view.doc, 'div', { class: 'refinement-tags rtg-mode-' + view.mode, role: 'region', 'aria-label': 'Tag tree', tabindex: '-1' });
  if (view.compact) view.box.append(el(view.doc, 'header', {}, view.find, view.moveButton, el(view.doc, 'div', { class: 'rtg-tools' }, view.toggle2, view.inherited, view.foldAll, view.openAll)), view.pickBar, view.body);
  else view.box.append(el(view.doc, 'h1', { class: 'rtg-title' }, 'Tags and properties'), el(view.doc, 'header', {}, view.find, view.toggle2, view.inherited, view.foldAll, view.openAll, view.moveButton), view.pickBar, view.body);

  /* The note at the bottom after a change, with Undo */
  view.box.addEventListener('keydown', view.onKey);
  view.doc.addEventListener('mousedown', view.onDown, true);
  // Clicking a blank part of the tree gives it the keyboard, for the arrow keys.
  view.box.addEventListener('mousedown', event => { if (!event.target.closest('input, button')) view.box.focus({ preventScroll: true }); });

  // Changes made elsewhere show up here too, unless something is being typed or dragged.
  view.timer = 0;
  view.quietUntil = 0;
  view.offChanged = logseq.DB.onChanged(() => {
    // The map's own changes are redrawn by act(); their echoes from Logseq, during it and just after, are not.
    if (view.busy || performance.now() < view.quietUntil) return;
    clearTimeout(view.timer);
    view.timer = setTimeout(function again() {
      if (view.busy) return;
      if (view.menu || view.dragging || view.adding || view.renaming || view.doc.activeElement?.classList?.contains('rtg-words')) { view.timer = setTimeout(again, 800); return; }
      view.refresh();
    }, 400);
  });
  openViews.add(view.draw);
  view.draw();
  return { node: view.box, refresh: view.refresh, destroy: view.destroy, focus: () => view.box.focus({ preventScroll: true }) };
}

/* Menus */
function closeMenu(view) { view.menu?.remove(); view.menu = null; }

// Menus, dialogs and notes float over the page, so they need a solid background. Logseq's colour variables
// are not always set (some dark themes leave them empty), so the colours are read from what is on screen.
const alphaOf = colour => { const m = /rgba?\(([^)]+)\)/.exec(colour || ''); if (!m) return 0; const parts = m[1].split(/[ ,/]+/).filter(Boolean); return parts.length > 3 ? parseFloat(parts[3]) : 1; };
function paint(view, node) {
  const win = view.doc.defaultView;
  const fg = win.getComputedStyle(view.box).color || 'rgb(30, 30, 30)';
  let bg = '';
  for (let n = view.box; n && n.nodeType === 1 && !bg; n = n.parentElement) { const c = win.getComputedStyle(n).backgroundColor; if (alphaOf(c) > .6) bg = c; }
  if (!bg) { const nums = (/rgba?\(([^)]+)\)/.exec(fg)?.[1] || '0,0,0').split(/[ ,/]+/).map(Number); bg = (nums[0] + nums[1] + nums[2]) / 3 > 128 ? 'rgb(28, 28, 30)' : 'rgb(255, 255, 255)'; }
  node.style.setProperty('--rtg-bg', bg);
  node.style.setProperty('--rtg-fg', fg);
  node.style.setProperty('--rtg-fborder', `color-mix(in srgb, ${fg} 22%, transparent)`);
  return node;
}

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
  view.menu = el(view.doc, 'div', { class: 'rf-pop refinement-tags-menu', role: 'menu' });
  if (header) view.menu.append(el(view.doc, 'div', { class: 'rtg-mh rf-pop-head' }, header));
  for (const item of items) {
    if (item === '-') { view.menu.append(el(view.doc, 'hr')); continue; }
    view.menu.append(el(view.doc, 'button', { role: 'menuitem', html: item.html, click: () => { view.closeMenu(); view.box.focus({ preventScroll: true }); item.run(); } }));
  }
  view.menu.addEventListener('keydown', view.menuKeys);
  view.doc.body.append(view.paint(view.menu));
  view.menu.querySelector('button')?.focus({ preventScroll: true });
  view.placeMenu(anchor);
}

// A menu with a search box that lists tags to pick from.
function pickTag(view, anchor, header, choices, onPick) {
  view.closeMenu();
  const input = el(view.doc, 'input', { type: 'text', placeholder: 'Type to find a tag', spellcheck: 'false' });
  const listBox = el(view.doc, 'div', { class: 'rtg-list rf-pop-list' });
  view.menu = el(view.doc, 'div', { class: 'rf-pop refinement-tags-menu', role: 'menu' }, el(view.doc, 'div', { class: 'rtg-mh rf-pop-head' }, header), input, listBox);
  const fill = () => {
    const q = input.value.trim().toLowerCase();
    const hits = choices.filter(c => !q || c.tag.title.toLowerCase().includes(q)).slice(0, 60);
    listBox.replaceChildren(...hits.map(c => el(view.doc, 'button', { role: 'menuitem', click: () => { view.closeMenu(); view.box.focus({ preventScroll: true }); onPick(c.tag); } },
      el(view.doc, 'span', {}, c.label ?? '#' + c.tag.title), c.path ? el(view.doc, 'span', { class: 'rtg-path rf-pop-kind' }, c.path) : null)));
    if (!hits.length) listBox.append(el(view.doc, 'div', { class: 'rtg-none rf-pop-note' }, 'No tag by that name'));
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
  view.doc.body.append(view.paint(view.menu));
  input.focus({ preventScroll: true });
  view.placeMenu(anchor);
}

// After a change: the plugin's one Undo (shared.undo, 0.4.258), a faded arrow at the end of the row the change was made
// on (the row with the cursor), or of the map's title when that row is gone; a change with nothing to undo is said in
// Logseq's own message. The bar this map kept of its own until 0.4.257 is gone.
function hideToast() {}
let undoCount = 0;
function showToast(view, text, undo) {
  if (!undo) { logseq.UI.showMsg(text); return; }
  const key = view.cursorKey, tagId = view.cursorTag;
  const at = () => {
    if (!view.box?.isConnected) return null;
    const item = view.shown?.find(i => key ? i.key === key : tagId != null && i.tag?.id === tagId);
    return item?.row?.isConnected && item.row.querySelector('.rtg-line') || view.box.querySelector('.rtg-title, header');
  };
  shared.undo.offer({ key: `tags:${++undoCount}`, at, text, run: () => view.act(undo, 'The change could not be undone') });
}

async function act(view, run, failText) {
  view.busy = true;
  let done = false;
  try { await run(); done = true; }
  catch (error) { warnOnce(failText, error); logseq.UI.showMsg(`${failText}: ${error?.message || error}`, 'warning'); }
  try { await view.refresh(); }
  finally { view.busy = false; view.quietUntil = performance.now() + 600; clearTimeout(view.timer); }
  return done;
}

/* Changes */
function fresh(view, tag) { return view.data.tags.get(tag.id) || tag; }

function parentsTitle(view, parents) { return parents.length ? 'under ' + parents.map(p => '#' + p.title).join(', ') : 'at the top level'; }

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
  // Its place among the tags beside it goes with the new name.
  const renamed = view.fresh(tag).title;
  if (renamed !== old && topOrder().some(n => view.sameTag(n, old))) { view.saveOrder(topOrder().map(n => view.sameTag(n, old) ? renamed : n).join(', ')); view.draw(); }
  view.mark(true); // the renamed tag moves to its new place in the order; keep it on screen
  if (view.fresh(tag).title !== old) view.showToast(`#${old} is now #${view.fresh(tag).title}`, () => logseq.Editor.renamePage(tag.uuid, old));
}

// A tag shown in several places stays only in this one (or only at the top level).
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
  const doc2 = view.doc;
  const go = el(doc2, 'button', { class: 'rtg-go rf-btn rf-go' }, 'Merge');
  const cancel = el(doc2, 'button', {}, 'Cancel');
  const panel = el(doc2, 'div', { class: 'rf-dialog', role: 'dialog', 'aria-label': 'Merge tags' },
    el(doc2, 'h2', {}, `Merge #${source.title} into #${target.title}?`),
    el(doc2, 'ul', {}, ...lines.map(line => el(doc2, 'li', {}, line))),
    el(doc2, 'p', {}, 'The moves cannot be undone in one step, and Logseq deletes a tag for good (it does not go to the Recycle).'),
    el(doc2, 'div', { class: 'rtg-btns rf-btns' }, cancel, go));
  const backdrop = el(doc2, 'div', { class: 'refinement-tags-dialog rf-dialog-backdrop' }, panel);
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
  doc2.body.append(view.paint(backdrop));
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

// The picked tags all go to the top level, out of every parent; Undo puts each back.
async function topFromPicked(view) {
  const tags = view.pickedTags().filter(t => t.parents.length);
  view.picked.clear();
  if (!tags.length) { view.mark(false); return; }
  const before = tags.map(t => [t, t.parents.slice()]);
  const done = await view.act(async () => { for (const t of tags) await setParents(t, []); }, 'The tags could not be moved');
  if (done) view.showToast(`${plural(tags.length, 'tag')} moved to the top level`, async () => { for (const [t, parents] of before) await setParents(view.fresh(t), parents); });
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

/* The top level: every tag with no parent, in the order kept in the setting, the rest by name */
function sameTag(view, a, b) { return a.toLowerCase() === b.toLowerCase(); }

// Tags are kept in order like bullets (0.4.221). Logseq keeps no order among the tags a tag extends, so the order is one
// list of tag names (the tagTreeRoots setting): among siblings, a tag named earlier in it comes first, the rest by name.
function rankOf() {
  const at = new Map();
  topOrder().forEach((name, i) => { const key = name.toLowerCase(); if (!at.has(key)) at.set(key, i); });
  return tag => at.get(tag.title.toLowerCase()) ?? at.size + 1e6;
}
function sortSiblings(view, list, rank = rankOf()) { return list.slice().sort((a, b) => rank(a) - rank(b) || view.data.byTitle(a, b)); }
function topTags(view, rank) { return view.sortSiblings([...view.data.tags.values()].filter(tag => !tag.builtIn && !tag.parents.length), rank); }
// The tags beside a tag: inside the same parent, or at the top level.
function siblingsIn(view, parent) { return parent ? view.sortSiblings(view.fresh(parent).kids.filter(t => !t.builtIn)) : view.topTags(); }

function saveOrder(view, value) { orderOverride = value; logseq.updateSettings({ tagTreeRoots: value }); }

// The order list with these siblings in this order: they take the place of the first of them already named,
// and every other name keeps its place.
function orderWith(siblings) {
  const keys = new Set(siblings.map(t => t.title.toLowerCase()));
  const old = topOrder();
  const first = old.findIndex(n => keys.has(n.toLowerCase()));
  const rest = old.filter(n => !keys.has(n.toLowerCase()));
  const at = first < 0 ? rest.length : old.slice(0, first).filter(n => !keys.has(n.toLowerCase())).length;
  rest.splice(at, 0, ...siblings.map(t => t.title));
  return rest.join(', ');
}

// Puts a tag inside parent (null: the top level) just before the sibling `before` (null: last), as a bullet is moved
// in an outline. It leaves the parent it was dragged from (`from`) and keeps any other; at the top level it leaves
// them all. With keep (Option held) it stays where it was too. One Undo puts back its place and the order.
async function place(view, tag, from, parent, before, keep = false) {
  tag = view.fresh(tag);
  if (parent && isAbove(tag, parent)) { logseq.UI.showMsg(`#${tag.title} cannot go inside #${parent.title}, which is inside it`, 'warning'); return; }
  const wasOrder = topOrder().join(', ');
  const wasParents = tag.parents.slice();
  const parents = !parent ? [] : [...wasParents.filter(p => p.id !== parent.id && (keep || p.id !== from?.id)), parent];
  const siblings = view.siblingsIn(parent).filter(t => t.id !== tag.id);
  const at = before ? siblings.findIndex(t => t.id === before.id) : -1;
  siblings.splice(at < 0 ? siblings.length : at, 0, tag);
  view.saveOrder(orderWith(siblings));
  if (parent) { folded.delete(parent.uuid); saveFolded(); }
  view.cursorTag = tag.id; view.cursorKey = null;
  const moving = parents.map(p => p.id).sort().join() !== wasParents.map(p => p.id).sort().join();
  if (moving) { if (!await view.act(() => setParents(tag, parents), `#${tag.title} could not be moved`)) { view.saveOrder(wasOrder); view.draw(); return; } }
  else view.draw();
  view.mark(true);
  const said = !moving ? `#${tag.title} moved` : keep ? `#${tag.title} is now also under #${parent.title}` : `#${tag.title} is now ${view.parentsTitle(view.fresh(tag).parents)}`;
  view.showToast(said, async () => {
    view.saveOrder(wasOrder);
    view.cursorTag = tag.id;
    if (moving) await setParents(view.fresh(tag), wasParents);
  });
}

// Move up / Move down among its siblings (Cmd+Shift+Up / Down, as for a bullet).
function moveAmong(view, tag, parent, by) {
  const list = view.siblingsIn(parent);
  const at = list.findIndex(t => t.id === tag.id);
  if (at < 0 || at + by < 0 || at + by >= list.length) return;
  return view.place(tag, parent, parent, by < 0 ? list[at - 1] : list[at + 2] || null);
}

/* Tag properties */
/* The map: a tag's properties as rows */
// Whether an open tag has rows of its own under it (properties, or links that point at it). The sidebar has them too (0.4.236).
function hasRows(view, tag) {
  return !!(tag.propList.length || tag.pointers?.length || (showInherited && inheritedProps(tag).length));
}
// What a property holds, as separate pieces: a small kind label ("choice", "link", "date"), then what it
// accepts or offers, then "several" when it takes more than one value.
const KINDS = { default: 'text', number: 'number', date: 'date', datetime: 'date and time', checkbox: 'checkbox', url: 'web address' };
function typeHtml(view, prop) {
  const kind = text => `<span class="rtg-kind" data-act="kind" title="What kind of value it holds">${escapeHtml(text)}</span>`;
  const several = prop.many ? kind('several') : '';
  if (prop.type === 'node') {
    const to = prop.accepts.map(id => view.data.tags.get(id)).filter(Boolean);
    // A wide property (Topic takes 15 tags) shows the first few and how many more; the row's details list them all (0.4.236).
    const shown = to.slice(0, 4).map(t => `<b>#</b>${escapeHtml(t.title)}`).join(', ') + (to.length > 4 ? ` · ${to.length - 4} more` : '');
    return kind('link') + `<span class="rtg-tv" data-act="values" title="Change what it accepts">${to.length ? shown : 'any node'}</span>` + several;
  }
  if (prop.choices.length) return kind('choice') + `<span class="rtg-tv" data-act="values" title="Edit the choices">${escapeHtml(prop.choices.slice(0, 4).join(' · ') + (prop.choices.length > 4 ? ' · …' : ''))}</span>` + several;
  return kind(KINDS[prop.type] || prop.type) + several;
}
// A property as Logseq has it, with what it holds; one the schema read does not know is read as text.
function propInfoOf(view, prop) {
  return view.data.propInfo?.get(prop.id) || { ...prop, type: 'default', many: false, accepts: [], choices: [], givenBy: [] };
}
function infoButton(view, key, what) {
  return el(view.doc, 'button', { class: 'rtg-i', tabindex: '-1', title: 'What this means', 'aria-label': 'Explain ' + what, 'aria-pressed': String(infoOpen.has(key)),
    click: event => { event.stopPropagation(); flip(infoOpen, key); view.draw(); } }, 'i');
}
// The rows under an open tag: the properties it gets from above (faded), its own, then what points at it.
function propRows(view, tag) {
  const rows = [];
  if (showInherited) for (const prop of inheritedProps(tag)) rows.push(...view.propRow(tag, propInfoOf(view, prop), prop.from));
  for (const prop of tag.propList) rows.push(...view.propRow(tag, propInfoOf(view, prop), null));
  if (tag.pointers?.length) rows.push(view.pointerRow(tag));
  return rows;
}
function propRow(view, tag, prop, from) {
  const doc = view.doc, key = tag.uuid + '|' + prop.id, infoKey = 'prop|' + key, open = propsOpen.has(key);
  const fold = el(doc, 'button', { class: 'rtg-fold' + (open ? '' : ' rtg-shut'), tabindex: '-1', 'aria-label': open ? 'Fold' : 'Unfold', html: CHEVRON,
    click: event => { event.stopPropagation(); flip(propsOpen, key); saveProps(); view.draw(); } });
  const name = el(doc, 'span', { class: 'rtg-pname', title: from ? `${prop.title} comes from #${from.title}` : view.passesDown(tag, prop),
    click: event => { event.stopPropagation(); view.propMenu(tag, prop, from, event.currentTarget); } });
  const words = el(doc, 'span');
  view.highlight(words, prop.title, view.q || '');
  name.append(words);
  const type = el(doc, 'span', { class: 'rtg-ptype', html: view.typeHtml(prop), click: event => {
    event.stopPropagation();
    const piece = event.target.closest('[data-act]');
    if (piece?.dataset.act === 'values') { if (prop.type === 'node') view.askAccepts(prop, piece); else view.askChoices(prop, piece); }
    else view.kindMenu(prop, piece || event.currentTarget);
  } });
  const line = el(doc, 'div', { class: 'rtg-line' }, name, type);
  if (from) line.append(el(doc, 'span', { class: 'rtg-small' }, 'from #' + from.title));
  else {
    const others = (prop.givenBy || []).filter(t => t.id !== tag.id).length;
    if (others) line.append(el(doc, 'span', { class: 'rtg-small' }, `also on ${plural(others, 'other tag')}`));
    line.append(view.infoButton(infoKey, prop.title));
  }
  const row = el(doc, 'div', { class: 'rtg-row rtg-prow' + (from ? ' rtg-inh' : ''), 'data-key': `p${prop.id}<${from ? from.id : ''}` }, fold, el(doc, 'div', { class: 'rtg-main' }, line));
  row.rtgLive = [tag, prop, from]; // what its clicks read, brought up to date if the row is kept (see morph)
  row.addEventListener('click', event => { if (!event.target.closest('button, input, .rtg-pname')) fold.click(); });
  const nodes = [row];
  if (open) nodes.push(view.propDetails(tag, prop, from));
  if (!from && infoOpen.has(infoKey)) nodes.push(view.propGuide(tag, prop));
  return nodes;
}
// A property opened: which tags give it, its choices, what a link accepts and how it reads from the other end.
function propDetails(view, tag, prop, from) {
  const doc = view.doc, box = el(doc, 'div', { class: 'rtg-pinfo' });
  const line = (label, ...rest) => box.append(el(doc, 'div', {}, el(doc, 'span', { class: 'rtg-plbl' }, label), ...rest));
  const tagNames = list => list.map(t => '#' + t.title).join(', ');
  const givers = (prop.givenBy?.length ? prop.givenBy : [from || tag]).filter(Boolean);
  line('Given by', el(doc, 'span', { class: givers.length ? 'rtg-val' : 'rtg-note' }, givers.length ? tagNames(givers) : 'no tag yet'), givers.some(t => t.kids.length) ? el(doc, 'span', { class: 'rtg-note' }, 'and the tags inside them') : null);
  const holds = (KINDS[prop.type] || (prop.type === 'node' ? 'a link' : prop.type)) + (prop.choices.length ? ', from a list of choices' : '');
  line('Holds', el(doc, 'span', { class: 'rtg-val' }, holds), el(doc, 'span', { class: 'rtg-note' }, prop.many ? '· several at once' : '· one at a time'),
    el(doc, 'button', { class: 'rtg-make', title: 'What kind of value it holds, and one or several, are changed in Logseq’s own settings for the property', click: event => { event.stopPropagation(); view.kindMenu(prop, event.currentTarget); } }, 'Change'));
  if (prop.choices.length || CHOICE_TYPES.has(prop.type)) line('Choices', el(doc, 'span', { class: prop.choices.length ? 'rtg-val' : 'rtg-note' }, prop.choices.length ? prop.choices.join(' · ') : 'none, anything can be typed'),
    el(doc, 'button', { class: 'rtg-make', title: prop.choices.length ? 'Rename or remove choices; add or reorder them in its settings' : 'Give it a list to pick from', click: event => { event.stopPropagation(); view.askChoices(prop, event.currentTarget); } }, prop.choices.length ? 'Edit' : 'Add choices'));
  if (prop.type !== 'node') return box;
  const to = prop.accepts.map(id => view.data.tags.get(id)).filter(Boolean);
  const inside = new Set(to.flatMap(t => [...below(t)]));
  line('Accepts', el(doc, 'span', { class: 'rtg-val' }, to.length ? tagNames(to) : 'any node'),
    el(doc, 'button', { class: 'rtg-make', title: 'Choose the tags this link accepts', click: event => { event.stopPropagation(); view.askAccepts(prop, event.currentTarget); } }, 'Change'),
    to.length && inside.size ? el(doc, 'span', { class: 'rtg-note' }, `and the ${plural(inside.size, 'tag')} inside`) : null);
  const tw = twoWay();
  if (!tw) return box;
  const input = el(doc, 'input', { class: 'rtg-words', type: 'text', spellcheck: 'false', value: tw.backwardsLabel(prop.title), 'aria-label': `How ${prop.title} reads on the other page`,
    title: 'Type how it should read on the page it points to, then press Enter. Empty: back to how it reads by itself.' });
  keepKeys(input);
  const save = () => {
    const before = tw.backwardsLabel(prop.title), after = input.value.trim();
    if (after === before) return;
    tw.setBackwards(prop.title, after);
    view.showToast(after ? `${prop.title} now reads “${after}” on the other page` : `${prop.title} reads as it does by itself on the other page again`, () => tw.setBackwards(prop.title, before));
  };
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); input.blur(); }
    if (event.key === 'Escape') { event.preventDefault(); input.value = tw.backwardsLabel(prop.title); input.blur(); }
  });
  input.addEventListener('blur', save);
  const shown = tw.shownAtOtherEnd(prop.title);
  const turn = el(doc, 'button', { class: 'rtg-make', title: shown
    ? 'Off: the page it points to no longer lists these at the top. The link stays, in Linked references at the bottom and in searches.'
    : 'On: the page it points to lists these at the top again.',
    click: event => { event.stopPropagation(); tw.setShownAtOtherEnd(prop.title, !shown); view.showToast(shown ? `${prop.title} no longer shows on the other page; the links stay` : `${prop.title} shows on the other page again`, () => tw.setShownAtOtherEnd(prop.title, shown)); } },
    shown ? 'Turn off' : 'Turn on');
  line('On the other page', input, el(doc, 'span', { class: 'rtg-note' }, '→'), shown ? null : el(doc, 'span', { class: 'rtg-off rtg-note' }, 'not shown there'), turn);
  return box;
}
// The links that point at a tag from elsewhere, as the tag's page shows them.
function pointerRow(view, tag) {
  const doc = view.doc, tw = twoWay();
  const row = el(doc, 'div', { class: 'rtg-pointrow' }, el(doc, 'span', { class: 'rtg-note' }, 'Shows up here as'));
  for (const prop of tag.pointers) {
    const on = tw ? tw.shownAtOtherEnd(prop.title) : true;
    row.append(el(doc, 'span', {}, el(doc, 'span', { class: 'rtg-val' }, tw ? tw.backwardsLabel(prop.title) : prop.title), ' →',
      prop.givenBy?.length ? el(doc, 'span', { class: 'rtg-note' }, ` filled in on ${prop.givenBy.map(t => '#' + t.title).join(', ')}`) : '', on ? '' : el(doc, 'span', { class: 'rtg-off rtg-note' }, ' (turned off)')));
  }
  return row;
}
// The explanation under a property, opened with its i.
function propGuide(view, tag, prop) {
  const doc = view.doc, inside = [...below(tag)].map(id => view.data.tags.get(id)).filter(Boolean);
  const p = html => el(doc, 'p', { html });
  const e = escapeHtml, name = `<b>${e(prop.title)}</b>`, tw = twoWay();
  const box = el(doc, 'div', { class: 'rtg-guide', role: 'note' },
    p(`<b>What this means.</b> Every node tagged #${e(tag.title)}${inside.length ? ` (and the ${plural(inside.length, 'tag')} inside it)` : ''} gets an empty ${name} to fill in. Taking it off the tag later only hides it; values already filled in stay.`));
  if (prop.type === 'node') {
    const to = prop.accepts.map(id => view.data.tags.get(id)).filter(Boolean);
    const there = to.length ? `#${e(to[0].title)}` : 'other';
    const back = e(tw ? tw.backwardsLabel(prop.title) : prop.title + ' of');
    box.append(p(`<b>How it looks from each end.</b><span class="rtg-end">On a #${e(tag.title)} node: ${name}: the ${there} node you pick. You fill it in here.</span><span class="rtg-end">On that ${there} node: ← ${back}: every #${e(tag.title)} node that names it. This shows up by itself.</span>`),
      p(`<b>Which way to link.</b> Put the property on the side that has one answer; the other side then lists everything that points at it, with nothing to keep up to date there.`));
    if (!to.length) box.append(p(`<b>It accepts any node.</b> Choosing a tag for it, in the property’s own settings, keeps the list you pick from short and the links tidy. A tag also lets in the tags inside it.`));
    else box.append(p(`<b>What it accepts.</b> Nodes tagged ${to.map(t => '#' + e(t.title)).join(', ')}, and nodes tagged with any tag inside ${to.length === 1 ? 'it' : 'them'}.`));
    if (tw) box.append(p(`<b>Turned off on the other page.</b> The ${there} page no longer lists these at the top. The link is not deleted: it still shows in Linked references at the bottom of that page, and searches and queries still find it. Worth it for a busy page, such as a status or a city with hundreds of people.`));
  }
  box.append(p(prop.many
    ? `<b>Several values.</b> Each value is its own link, so each shows on its own page and can be counted and filtered. Good for lists, such as the people at a meeting. If one value matters most, a separate one-value property says so more clearly.`
    : prop.type === 'node' || prop.choices.length
      ? `<b>One value.</b> Right when there is truly one answer. If you find yourself wanting two, make it a several-values property; typing “A, B” into one value links neither.`
      : prop.type === 'default'
        ? `<b>Plain text.</b> For words you will never look up as a thing, such as a note or a reason. A [[link]] inside the text is fine for mentioning something in a sentence. If the whole answer is always one page (a city, a person), make it a link to a tag instead: you pick from a list, and that page lists it back.`
        : `<b>One value</b> of this kind for each node.`));
  return box;
}
// "Setting up a new tag", above the tree, opened with its i.
function passesDown(view, tag, prop) {
  const inside = [...below(tag)].map(id => view.data.tags.get(id)).filter(t => t && !t.propList.some(p => p.ident === prop.ident)).length;
  return inside ? `${prop.title}: on #${tag.title} and the ${plural(inside, 'tag')} inside it` : `${prop.title}: on #${tag.title}`;
}

function propMoves(view, tag, prop) { return view.fresh(tag).parents.filter(p => !p.builtIn && !p.propList.some(q => q.ident === prop.ident)); }

function propMenu(view, tag, prop, from, anchor, alone) {
  tag = tag ? view.fresh(tag) : null;
  const items = [{ html: 'Rename …', run: () => view.askRenameProp(prop, anchor) }];
  if (prop.type === 'node') items.push({ html: 'Change what it accepts …', run: () => view.askAccepts(prop, anchor) });
  if (prop.choices.length || CHOICE_TYPES.has(prop.type)) items.push({ html: prop.choices.length ? 'Edit the choices …' : 'Give it choices …', run: () => view.askChoices(prop, anchor) });
  if (prop.choices.length && tag && !tag.builtIn && !alone) items.push({ html: 'Make a choice its own child tag …', run: () => view.askChildTag(tag, prop, anchor) });
  const linkFrom = tag && !tag.builtIn ? tag : (prop.givenBy || []).find(t => !t.builtIn);
  if (prop.type === 'default' && linkFrom) items.push({ html: 'Turn into links to pages …', run: () => view.askLinks(linkFrom, prop) });
  items.push({ html: 'Kind of value, one or several …', run: () => view.kindMenu(prop, anchor) });
  // In the by-property view (alone) the property is not under any one tag: taking it off each is offered by name.
  if (alone) {
    items.push({ html: 'Put in a group …', run: () => view.askPutInGroup(prop, anchor) });
    const givers = (prop.givenBy || []).filter(t => !t.builtIn);
    if (givers.length) items.push('-');
    for (const giver of givers) items.push({ html: `Take it off #${escapeHtml(giver.title)}`, run: () => view.takePropOff(giver, prop) });
    view.showMenu(anchor, prop.title, items);
    return;
  }
  items.push('-');
  if (from) {
    items.push({ html: `Go to #${escapeHtml(from.title)}`, run: () => { const at = view.shown.find(i => i.tag.id === from.id); if (at) view.setCursor(at.key); } });
    if (!from.builtIn) items.push({ html: `Take it off #${escapeHtml(from.title)}`, run: () => view.takePropOff(from, prop) });
  } else {
    for (const parent of view.propMoves(tag, prop)) items.push({ html: `Move up to #${escapeHtml(parent.title)}`, run: () => view.movePropUp(tag, prop, parent) });
    if (!tag.builtIn) items.push({ html: `Take it off #${escapeHtml(tag.title)}`, run: () => view.takePropOff(tag, prop) });
  }
  view.showMenu(anchor, from ? `${prop.title}, from #${from.title}` : view.passesDown(tag, prop), items);
}

// Renaming a property: it is a page, so Logseq's own rename is asked; the name is read back to be sure.
function askRenameProp(view, prop, anchor) {
  view.closeMenu();
  const input = el(view.doc, 'input', { type: 'text', value: prop.title, spellcheck: 'false', 'aria-label': 'New name' });
  view.menu = el(view.doc, 'div', { class: 'rf-pop refinement-tags-menu', role: 'menu' }, el(view.doc, 'div', { class: 'rtg-mh rf-pop-head' }, `Rename ${prop.title}`), input,
    el(view.doc, 'div', { class: 'rtg-mnote rf-pop-note' }, 'Everywhere it is used. Enter to rename, Esc to leave it.'));
  keepKeys(input);
  input.addEventListener('keydown', async event => {
    if (event.key === 'Escape') { event.preventDefault(); view.closeMenu(); view.box.focus({ preventScroll: true }); return; }
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    const name = input.value.trim(), old = prop.title;
    view.closeMenu();
    if (!name || name === old) return;
    const done = await view.act(async () => {
      await logseq.Editor.renamePage(prop.uuid, name);
      const now = await model().titleNow(prop.uuid);
      if (now !== name) throw new Error('Logseq kept the old name');
    }, `${old} could not be renamed`);
    if (done) {
      // Its group goes with it (0.4.243): groups keep properties by name.
      const groups = readGroups(), g = groupOf(groups, old);
      if (g) saveGroups(groups.map(x => x === g ? { ...x, props: x.props.map(p => p.toLowerCase() === old.toLowerCase() ? name : p) } : x));
      view.showToast(`${old} is now ${name}`, () => logseq.Editor.renamePage(prop.uuid, old));
    }
  });
  view.doc.body.append(view.paint(view.menu));
  input.focus(); input.select();
  view.placeMenu(anchor);
}
// What a link property accepts: pick a tag to add it or take it away; "Any node" clears the list.
function askAccepts(view, prop, anchor) {
  const now = new Set(view.data.propInfo?.get(prop.id)?.accepts || prop.accepts || []);
  const choices = [{ tag: { id: -1, title: '' }, label: 'Any node (no tag)', path: now.size ? 'clears the list' : 'now' },
    ...[...view.data.tags.values()].filter(t => !t.builtIn || PARENT_BUILT_INS.has(t.ident)).sort((a, b) => (now.has(b.id) - now.has(a.id)) || view.data.byTitle(a, b))
      .map(t => ({ tag: t, label: (now.has(t.id) ? '✓ #' : '#') + t.title, path: now.has(t.id) ? 'click to take away' : pathOf(t) }))];
  view.pickTag(anchor, `${prop.title} accepts …`, choices, async picked => {
    const before = [...now];
    const next = picked.id === -1 ? [] : now.has(picked.id) ? before.filter(id => id !== picked.id) : [...before, picked.id];
    const done = await view.act(() => setAccepts(prop, next), `What ${prop.title} accepts could not be changed`);
    if (done) view.showToast(next.length ? `${prop.title} accepts ${next.map(id => '#' + (view.data.tags.get(id)?.title || '?')).join(', ')}` : `${prop.title} accepts any node`, () => setAccepts(prop, before));
  });
}

// What kind of value a property holds, and one or several: Logseq lets plugins change these only for their own
// properties, so this opens Logseq's own settings for it in the right sidebar, next to the map.
function kindMenu(view, prop, anchor) {
  const holds = (KINDS[prop.type] || (prop.type === 'node' ? 'a link' : prop.type)) + (prop.choices.length ? ' from a list of choices' : '');
  const items = [];
  if (prop.type === 'node') items.push({ html: 'Change what it accepts …', run: () => view.askAccepts(prop, anchor) });
  if (prop.choices.length || CHOICE_TYPES.has(prop.type)) items.push({ html: prop.choices.length ? 'Edit the choices …' : 'Give it choices …', run: () => view.askChoices(prop, anchor) });
  items.push({ html: `Open ${escapeHtml(prop.title)}’s settings in the sidebar`, run: () => logseq.Editor.openInRightSidebar(prop.uuid) });
  view.showMenu(anchor, `${prop.title} holds ${holds}, ${prop.many ? 'several at once' : 'one at a time'}`, items);
  view.menu.append(el(view.doc, 'div', { class: 'rtg-mnote rf-pop-note' }, 'To make it hold another kind of value, or one instead of several, use its settings: Logseq lets only itself change those. They open in the right sidebar, so this map stays where it is.'));
  view.placeMenu(anchor);
}

// The choices of a property, edited in a small panel: rename in place and remove; adding and reordering open Logseq's own settings.
function askChoices(view, prop, anchor, at, focusAt = 0) {
  const doc = view.doc;
  const where = at || (() => { const r = anchor.getBoundingClientRect(); return { left: r.left, top: r.bottom + 4 }; })();
  view.closeMenu();
  const panel = el(doc, 'div', { class: 'rf-pop refinement-tags-menu rtg-choices', role: 'dialog', 'aria-label': `Choices for ${prop.title}` }, el(doc, 'div', { class: 'rtg-mh rf-pop-head' }, `Choices for ${prop.title}`));
  view.menu = panel;
  const again = index => { if (view.menu === panel) view.askChoices(propInfoOf(view, prop), anchor, where, index); };
  const run = async (job, failText, said, undo) => {
    const index = Math.max(0, [...box.querySelectorAll('input')].indexOf(doc.activeElement));
    if (await view.act(job, failText) && said) view.showToast(said, undo);
    again(index);
  };
  // Keys pressed anywhere in the panel stay out of Logseq's shortcuts, and Escape closes it.
  panel.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); view.closeMenu(); view.box.focus({ preventScroll: true }); }
  });
  for (const type of ['keyup', 'keypress']) panel.addEventListener(type, event => event.stopPropagation());
  const box = el(doc, 'div', { class: 'rtg-list rf-pop-list' }, el(doc, 'div', { class: 'rtg-none rf-pop-note' }, 'Reading the choices …'));
  // A new choice is added, and the order changed, in the property's own settings (0.4.191, 0.4.193): Logseq 2.0.2
  // lets only itself make a choice or move one.
  const add = el(doc, 'button', { class: 'rtg-addchoice', click: event => { event.stopPropagation(); view.closeMenu(); logseq.Editor.openInRightSidebar(prop.uuid); } }, 'Add or reorder in its settings ⇥');
  panel.append(box, add, el(doc, 'div', { class: 'rtg-mnote rf-pop-note' }, `Enter saves a new name. A choice that nodes still use can be renamed, not removed. New choices are added, and the order changed, in Logseq’s own list, which only Logseq may change: in the right sidebar, click the column headed ${prop.title}, then Available choices.`));
  const keys = (input, onEnter, reset) => {
    keepKeys(input);
    input.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); if (reset && input.value !== reset()) { input.value = reset(); return; } view.closeMenu(); view.box.focus({ preventScroll: true }); }
      if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); onEnter(); }
    });
  };
  choicesOf(prop).then(list => {
    if (view.menu !== panel) return;
    box.replaceChildren(...(list.length ? [] : [el(doc, 'div', { class: 'rtg-none rf-pop-note' }, 'No choices yet: anything can be typed.')]));
    list.forEach(choice => {
      const input = el(doc, 'input', { type: 'text', value: choice.title, spellcheck: 'false', 'aria-label': `Rename ${choice.title}` });
      keys(input, () => {
        const title = input.value.trim();
        if (!title || title === choice.title) return;
        if (list.some(c => c !== choice && c.title.toLowerCase() === title.toLowerCase())) { logseq.UI.showMsg(`${prop.title} already has “${title}”`, 'warning'); return; }
        run(() => renameChoice(prop, choice, title), `“${choice.title}” could not be renamed`, `“${choice.title}” is now “${title}” everywhere`,
          () => renameChoice(prop, choice, choice.title)); // a rename can be undone (0.4.194); a removal cannot: Logseq lets only itself make a choice
      }, () => choice.title);
      const button = (label, text, enabled, job) => el(doc, 'button', { class: 'rtg-cb', title: text, 'aria-label': text, disabled: enabled ? null : '', click: event => { event.stopPropagation(); if (enabled) job(); } }, label);
      box.append(el(doc, 'div', { class: 'rtg-crow' }, input,
        button('×', 'Remove', true, () => run(() => removeChoice(prop, choice), `“${choice.title}” was not removed`, `“${choice.title}” is no longer a choice`))));
    });
    const inputs = box.querySelectorAll('input');
    (inputs[Math.min(focusAt, inputs.length - 1)] || add).focus({ preventScroll: true });
  }).catch(error => { warnOnce('the choices could not be read', error); box.replaceChildren(el(doc, 'div', { class: 'rtg-none rf-pop-note' }, 'The choices could not be read.')); });
  doc.body.append(view.paint(panel));
  const win = doc.defaultView;
  panel.style.left = Math.max(8, Math.min(where.left, win.innerWidth - 340)) + 'px';
  panel.style.top = Math.max(8, Math.min(where.top, win.innerHeight - 320)) + 'px';
  add.focus({ preventScroll: true });
}

// Making one of a property's choices its own child tag: the choice is picked from a menu, then a dialog says
// what will happen, with the new tag's name to change if wanted.
async function askChildTag(view, tag, prop, anchor) {
  tag = view.fresh(tag);
  let list = [];
  try {
    list = await choicesOf(prop);
    const by = await model().choiceCounts(tag, prop);
    for (const choice of list) choice.count = by.get(choice.uuid) || 0;
  } catch (error) { warnOnce('the choices could not be read', error); logseq.UI.showMsg('The choices could not be read: ' + (error?.message || error), 'warning'); return; }
  if (!list.length) { logseq.UI.showMsg(`${prop.title} has no choices yet`, 'warning'); return; }
  view.showMenu(anchor, `Which ${prop.title} becomes its own tag inside #${tag.title}?`, list.map(choice => ({
    html: `${escapeHtml(choice.title)}<kbd>${plural(choice.count, 'node')}</kbd>`, run: () => view.confirmChildTag(tag, prop, choice) })));
  view.menu.append(el(view.doc, 'div', { class: 'rtg-mnote rf-pop-note' }, `Best for a short list of broad kinds that rarely changes. The nodes move to the new tag and keep all their values.`));
  view.placeMenu(anchor);
}
async function confirmChildTag(view, tag, prop, choice) {
  let plan;
  try { plan = await planChildTag(view.fresh(tag), prop, choice, view.data); }
  catch (error) { warnOnce('a child tag could not be prepared', error); logseq.UI.showMsg('Could not look up what it would change: ' + (error?.message || error), 'warning'); return; }
  const doc = view.doc, T = '#' + tag.title, n = plan.nodes.length;
  const input = el(doc, 'input', { class: 'rtg-input', type: 'text', value: choice.title, spellcheck: 'false', 'aria-label': 'Name of the new tag' });
  keepKeys(input);
  const lines = el(doc, 'ul');
  const note = el(doc, 'p');
  const go = el(doc, 'button', { class: 'rtg-go rf-btn rf-go' });
  const cancel = el(doc, 'button', {}, 'Cancel');
  let check = {};
  const fill = async () => {
    const name = input.value.trim().replace(/^#/, '').trim(), C = '#' + (name || '…');
    check = await childTagName(plan, name);
    const items = [check.existing ? `${C} is already inside ${T} and is used as it is` : `${C} is made inside ${T}, so it gets every property ${T} has`,
      n ? `${plural(n, 'node')} tagged ${T} with ${prop.title} “${choice.title}” get ${C} instead of ${T}. They keep all their values and still count as ${T}`
        : `No node tagged ${T} has ${prop.title} “${choice.title}” yet`,
      ...(n ? [`their ${prop.title} “${choice.title}” is cleared, since ${C} now says it`] : []),
      `“${choice.title}” stays in ${prop.title}’s choices; remove it from there when nothing needs it`];
    lines.replaceChildren(...items.map(text => el(doc, 'li', {}, text)));
    note.textContent = check.problem || 'Undo puts everything back, for a few seconds after.';
    note.classList.toggle('rtg-warn', !!check.problem);
    go.textContent = check.existing ? `Move to ${C}` : `Make ${C}`;
    go.disabled = !!check.problem;
  };
  const panel = el(doc, 'div', { class: 'rf-dialog', role: 'dialog', 'aria-label': 'Make a child tag' },
    el(doc, 'h2', {}, `Make “${choice.title}” its own tag inside ${T}?`),
    el(doc, 'div', { class: 'rtg-namefield' }, el(doc, 'span', { class: 'rtg-note' }, 'Name'), input), lines, note,
    el(doc, 'div', { class: 'rtg-btns rf-btns' }, cancel, go));
  const backdrop = el(doc, 'div', { class: 'refinement-tags-dialog rf-dialog-backdrop' }, panel);
  const close = () => { backdrop.remove(); view.box.focus({ preventScroll: true }); };
  cancel.addEventListener('click', close);
  backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) close(); });
  backdrop.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Enter' && event.target === input && !event.isComposing) { event.preventDefault(); if (!go.disabled) go.click(); }
  });
  input.addEventListener('input', () => { fill().catch(() => {}); });
  go.addEventListener('click', async () => {
    if (go.disabled) return;
    go.disabled = true; // a second press while the name is checked does nothing
    const name = input.value.trim().replace(/^#/, '').trim();
    check = await childTagName(plan, name);
    if (check.problem) { fill(); return; }
    close();
    folded.delete(tag.uuid); saveFolded();
    let result = null;
    const done = await view.act(async () => { result = await runChildTag(plan, name, check.existing); }, `“${choice.title}” could not be made its own tag`);
    if (!done || !result) return;
    const child = view.data.byName.get(name.toLowerCase());
    if (child) { view.cursorTag = child.id; view.cursorKey = null; view.draw(); }
    view.showToast(`${n ? plural(n, 'node') + ' moved to' : 'Made'} #${name}; “${choice.title}” is still a choice of ${prop.title}`, result.undo);
  });
  doc.body.append(view.paint(backdrop));
  await fill().catch(() => {});
  input.focus(); input.select();
}

// What turning a property into links would change, and the go-ahead.
async function askLinks(view, tag, prop) {
  view.closeMenu();
  let plan;
  try { plan = await planLinks(view.fresh(tag), prop, view.data); }
  catch (error) { warnOnce('links could not be prepared', error); logseq.UI.showMsg('Could not look up what it would change: ' + (error?.message || error), 'warning'); return; }
  const n = plan.byNode.size;
  if (!n) { logseq.UI.showMsg(`No node has ${prop.title} yet: change its kind in its own settings instead (Kind of value …)`, 'info'); return; }
  if (plan.several) { logseq.UI.showMsg(`Some nodes hold more than one ${prop.title}; that is not handled yet`, 'warning'); return; }
  const doc = view.doc, P = prop.title, T = '#' + tag.title;
  // The pages' tag is "… kind" by default (docs/MODELLING.md: the property "… type", the tag on its pages "… kind"):
  // a tag cannot share its name with the property (Logseq hands back the property's page; seen in the app).
  const input = el(doc, 'input', { class: 'rtg-input', type: 'text', value: `${P} kind`, spellcheck: 'false', 'aria-label': 'Tag for the pages' });
  keepKeys(input);
  const lines = el(doc, 'ul'), note = el(doc, 'p'), go = el(doc, 'button', { class: 'rtg-go rf-btn rf-go' }, 'Turn into links'), cancel = el(doc, 'button', {}, 'Cancel');
  const newPages = plan.titles.filter(t => !plan.pages.has(t)).length;
  const first = [...plan.byNode][0];
  const firstName = await model().titleNow(first[0]).catch(() => '') || 'a node';
  const fill = async () => {
    const name = input.value.trim().replace(/^#/, '').trim(), G = '#' + (name || '…');
    const items = [`${P} is renamed “${P} (old)” and keeps its values, so nothing is lost`,
      `a new ${P} is made on ${T}, holding a link to a ${G} page (Logseq’s own new-property box opens in the right sidebar for a moment; the plugin fills it in)`,
      `${plural(plan.titles.length, 'page')}: ${plan.titles.join(', ')}${newPages < plan.titles.length ? ` (${plan.titles.length - newPages} already there, given ${G})` : ''}`,
      `${plural(n, 'node')} get their link, for example ${firstName} → ${first[1][0]}`];
    lines.replaceChildren(...items.map(text => el(doc, 'li', {}, text)));
    const tagNamed = plan.data.byName.get(name.toLowerCase());
    const page = name && !tagNamed ? await logseq.Editor.getPage(name).catch(() => null) : null;
    const bad = !name ? 'Give the tag a name' : name.includes('/') ? 'A tag name cannot have a / in it'
      : tagNamed?.builtIn ? `#${name} is one of Logseq’s own tags`
      : name.toLowerCase() === P.toLowerCase() || page ? `“${page?.title || name}” is already ${page?.uuid === prop.uuid || name.toLowerCase() === P.toLowerCase() ? 'the property’s own name' : 'a page that is not a tag'}; pick another name` : '';
    note.textContent = bad || `When it looks right, delete “${P} (old)” yourself. Undo puts everything back, for a minute after.`;
    note.classList.toggle('rtg-warn', !!bad);
    go.disabled = !!bad;
  };
  const panel = el(doc, 'div', { class: 'rf-dialog', role: 'dialog', 'aria-label': 'Turn into links' },
    el(doc, 'h2', {}, `Turn ${P} into links to pages?`),
    el(doc, 'div', { class: 'rtg-namefield' }, el(doc, 'span', { class: 'rtg-note' }, 'Pages tagged'), input), lines, note,
    el(doc, 'div', { class: 'rtg-btns rf-btns' }, cancel, go));
  const backdrop = el(doc, 'div', { class: 'refinement-tags-dialog rf-dialog-backdrop' }, panel);
  const close = () => { backdrop.remove(); view.box.focus({ preventScroll: true }); };
  cancel.addEventListener('click', close);
  backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) close(); });
  backdrop.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Enter' && event.target === input && !event.isComposing) { event.preventDefault(); if (!go.disabled) go.click(); }
  });
  input.addEventListener('input', () => { fill().catch(() => {}); });
  go.addEventListener('click', async () => {
    if (go.disabled) return;
    go.disabled = true;
    await fill().catch(() => {});
    if (go.disabled && note.classList.contains('rtg-warn')) return;
    const name = input.value.trim().replace(/^#/, '').trim();
    close();
    let result = null;
    const done = await view.act(async () => { result = await runLinks(plan, name); }, `${P} could not be turned into links`);
    if (!done || !result) return;
    // A larger change gets a minute to be undone (seen in the app: seven seconds went by while the result was looked at).
    view.showToast(`${P} now links ${plural(n, 'node')} to ${plural(plan.titles.length, 'page')} tagged #${name}; the old one is “${P} (old)”`, result.undo, 60000);
  });
  doc.body.append(view.paint(backdrop));
  await fill().catch(() => {});
  input.focus(); input.select();
}
// A tag's description, the line under its name.
function askDescription(view, tag, anchor) {
  view.closeMenu();
  const input = el(view.doc, 'textarea', { rows: '3', spellcheck: 'true', 'aria-label': 'Description' });
  input.value = tag.desc || '';
  view.menu = el(view.doc, 'div', { class: 'rf-pop refinement-tags-menu rtg-descbox', role: 'dialog' }, el(view.doc, 'div', { class: 'rtg-mh rf-pop-head' }, `What #${tag.title} is for`), input,
    el(view.doc, 'div', { class: 'rtg-mnote rf-pop-note' }, 'Enter saves, Shift-Enter starts a new line, Esc leaves it. Empty removes it.'));
  keepKeys(input);
  input.addEventListener('keydown', async event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); view.closeMenu(); view.box.focus({ preventScroll: true }); return; }
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    const text = input.value.trim(), old = tag.desc || '';
    view.closeMenu();
    if (text === old) return;
    if (await view.act(() => setDescription(tag, text), `#${tag.title}’s description could not be saved`)) view.showToast(text ? `#${tag.title} has a new description` : `#${tag.title} has no description now`, () => setDescription(tag, old));
  });
  view.doc.body.append(view.paint(view.menu));
  input.focus();
  view.placeMenu(anchor);
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
  const listBox = el(view.doc, 'div', { class: 'rtg-list rf-pop-list' });
  view.menu = el(view.doc, 'div', { class: 'rf-pop refinement-tags-menu', role: 'menu' }, el(view.doc, 'div', { class: 'rtg-mh rf-pop-head' }, `Add a property to #${tag.title}`), input, listBox);
  const pickIt = run => () => { view.closeMenu(); view.box.focus({ preventScroll: true }); run(); };
  const fill = () => {
    const q = input.value.trim().toLowerCase();
    const hits = all.filter(p => !have.has(p.ident) || have.get(p.ident)).filter(p => !q || p.title.toLowerCase().includes(q)).slice(0, 60);
    listBox.replaceChildren(...hits.map(p => {
      const from = have.get(p.ident);
      return el(view.doc, 'button', { role: 'menuitem', click: pickIt(() => view.addProp(tag, p)) }, el(view.doc, 'span', {}, p.title),
        el(view.doc, 'span', { class: 'rtg-path rf-pop-kind' }, from ? `already from #${from.title}` : p.type === 'default' ? 'text' : p.type));
    }));
    const exact = all.some(p => p.title.toLowerCase() === q);
    if (q && !exact) listBox.append(el(view.doc, 'button', { role: 'menuitem', click: pickIt(() => view.newProperty(tag, input.value.trim())) }, el(view.doc, 'span', {}, `New property “${input.value.trim()}” …`)));
    if (!listBox.childNodes.length) listBox.append(el(view.doc, 'div', { class: 'rtg-none rf-pop-note' }, 'Type the name of a property'));
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
  view.doc.body.append(view.paint(view.menu));
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
    const list = view.siblingsIn(parent), at = list.findIndex(t => t.id === tag.id);
    if (at > 0) items.push({ html: 'Move up<kbd>⌘ ⇧ ↑</kbd>', run: () => view.moveAmong(tag, parent, -1) });
    if (at >= 0 && at < list.length - 1) items.push({ html: 'Move down<kbd>⌘ ⇧ ↓</kbd>', run: () => view.moveAmong(tag, parent, 1) });
    items.push('-', { html: 'Add a property …<kbd>p</kbd>', run: () => view.askProperty(tag, anchor) },
      { html: 'Rename<kbd>r</kbd>', run: () => { view.renaming = item.key; view.draw(); } },
      { html: tag.desc ? 'Change the description …' : 'Add a description …', run: () => view.askDescription(tag, anchor) },
      { html: 'Merge into …<kbd>j</kbd>', run: () => view.askMerge(tag, parent, anchor) });
  }
  if (view.picked.size > 1 && view.picked.has(tag.id)) items.unshift({ html: `Move the ${view.picked.size} picked tags to the top level`, run: () => view.topFromPicked() }, { html: `Move the ${view.picked.size} picked tags to …`, run: () => view.movePicked(anchor) }, '-');
  view.showMenu(anchor, '#' + tag.title, items);
}

/* Drawing */
function highlight(view, node, title, q) {
  const at = q ? title.toLowerCase().indexOf(q) : -1;
  if (at < 0) { node.textContent = title; return; }
  node.append(title.slice(0, at), el(view.doc, 'mark', {}, title.slice(at, at + q.length)), title.slice(at + q.length));
}

const matches = (tag, q) => tag.title.toLowerCase().includes(q) || tag.propList.some(p => String(p.title || '').toLowerCase().includes(q));
function draw(view) {
  if (!view.box.isConnected && view.shown.length) return;
  if (!view.loaded) { view.body.replaceChildren(el(view.doc, 'div', { class: 'rtg-empty' }, 'Reading your tags …')); return; }
  view.paint(view.box); // for the bar that stays at the top while picking
  const q = view.find.value.trim().toLowerCase();
  // With a search, only matching tags and the tags above them are shown, unfolded. A tag matches by its name or by
  // the name of a property of its own (0.4.235, the owner: "search properties in the tag and properties page").
  const keep = new Set();
  view.q = q;
  if (q) {
    const markMatch = tag => { if (keep.has(tag.id)) return; keep.add(tag.id); tag.parents.forEach(markMatch); };
    for (const tag of view.data.tags.values()) if (matches(tag, q)) markMatch(tag);
  }
  const pass = { q, keep, visible: tag => !q || keep.has(tag.id), section: '', rank: rankOf() }; // what every piece of the drawing reads
  const scrollKeep = view.box.closest('.sidebar-item-list, .cp__sidebar-main-content, #main-content-container') || view.doc.scrollingElement;
  const top = scrollKeep?.scrollTop;
  // The row with the cursor stays where it is on screen (0.4.182): a renamed tag that sorts elsewhere, or a tag
  // moved under another, brings the map along with it instead of jumping away from under the eye.
  const held = view.cursorTag != null && (view.shown.find(item => item.key === view.cursorKey) || view.shown.find(item => item.tag.id === view.cursorTag));
  const heldTop = held?.row?.isConnected ? held.row.getBoundingClientRect().top : null;
  view.shown = [];
  const sections = [];

  if (byProp) drawProps(view, pass, sections);
  else { drawTop(view, pass, sections); drawLogseq(view, pass, sections); }

  view.morph(view.body, sections);
  view.inherited.textContent = showInherited ? 'Hide inherited' : 'Show inherited';
  view.byTags.setAttribute('aria-pressed', String(!byProp)); view.byProps.setAttribute('aria-pressed', String(byProp));
  for (const b of [view.inherited, view.foldAll, view.openAll]) b.hidden = byProp;
  view.box.classList.toggle('rtg-by-prop', byProp);
  // Keep the cursor on its row, or on the tag it was on if that moved.
  if (view.cursorTag != null) {
    const again = view.shown.find(item => item.key === view.cursorKey) || view.shown.find(item => item.tag.id === view.cursorTag);
    view.cursorKey = again?.key || null;
  }
  view.mark(false);
  if (scrollKeep && top != null) scrollKeep.scrollTop = top;
  const again = heldTop != null && view.shown.find(item => item.key === view.cursorKey)?.row;
  const scroller = again?.isConnected && scrollingParent(view.box);
  if (scroller) scroller.scrollTop += again.getBoundingClientRect().top - heldTop;
}

// Puts the freshly built rows on screen, keeping every row that has not changed as it is (0.4.190). A whole map
// replaced after each change made the browser lay out every row again (about 2 s for 600 open tags); now only
// what changed is swapped in. Rows and the boxes holding them are matched by their data-key; a row that differs
// at all is replaced whole, so its clicks are the new ones, and a kept row's clicks are its own, made from the
// same tag when it was drawn the same way. view.shown is pointed at the rows actually on screen.
function morph(view, parent, fresh) {
  const kept = new Map(); // freshly built row -> the row on screen that stays in its place
  // A kept row's clicks were made with the tag, property and place it was drawn from; those objects take the
  // freshly read values, so a row that looks the same also acts on what is true now (a tag's kids, a property's choices).
  const keep = (fresh, old) => {
    kept.set(fresh, old);
    const was = old.rtgLive, now = fresh.rtgLive;
    if (!was || !now) return;
    was.forEach((thing, i) => { if (thing && now[i] && thing !== now[i] && typeof thing === 'object') Object.assign(thing, now[i]); });
    if (was[0]?.row) was[0].row = old;
  };
  const sameKids = (a, b) => {
    const olds = a.querySelectorAll('.rtg-row'), news = b.querySelectorAll('.rtg-row');
    news.forEach((row, i) => { if (olds[i]) keep(row, olds[i]); });
  };
  const typing = node => node.nodeType === 1 && !!(node.matches('input, textarea') || node.querySelector('input, textarea'));
  const isBox = node => node.nodeType === 1 && (node.classList.contains('rtg-kids') || node.classList.contains('rtg-section'));
  const walk = (into, children) => {
    const old = [...into.childNodes];
    const byKey = new Map(), loose = [];
    for (const node of old) { const k = node.nodeType === 1 && node.dataset.key; if (k && !byKey.has(k)) byKey.set(k, node); else loose.push(node); }
    let li = 0;
    const chosen = children.map(node => {
      const k = node.nodeType === 1 && node.dataset.key;
      const was = k ? byKey.get(k) : loose[li++];
      if (!was || (k && byKey.get(k) !== was)) return node;
      if (k) byKey.delete(k);
      if (was.nodeName !== node.nodeName || typing(node) || typing(was)) return node;
      // Without a key, an old element is matched only by its place: one that acts (a property's box with its Change
      // button) could belong to another property that now stands there, so it is replaced (0.4.192, second reading).
      if (!k && !isBox(node) && acts(was)) return node;
      if (was.isEqualNode(node)) { sameKids(was, node); if (node.matches?.('.rtg-row')) keep(node, was); return was; }
      if (isBox(node) && isBox(was)) {
        for (const { name } of [...was.attributes]) if (!node.hasAttribute(name)) was.removeAttribute(name);
        for (const { name, value } of [...node.attributes]) if (was.getAttribute(name) !== value) was.setAttribute(name, value);
        walk(was, [...node.childNodes]);
        return was;
      }
      return node;
    });
    let ref = into.firstChild;
    for (const node of chosen) { if (node === ref) ref = ref.nextSibling; else into.insertBefore(node, ref); }
    const stays = new Set(chosen);
    for (const node of [...into.childNodes]) if (!stays.has(node)) node.remove();
  };
  walk(parent, fresh);
  for (const item of view.shown) { const onScreen = kept.get(item.row); if (onScreen) item.row = onScreen; }
}

// The element that actually scrolls the map (in the main view an inner box of Logseq's, not the one named above).
function scrollingParent(node) {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight && /(auto|scroll)/.test(el.ownerDocument.defaultView.getComputedStyle(el).overflowY)) return el;
  }
  return node.ownerDocument.scrollingElement;
}

// One tag's row and, unless folded, the rows of the tags inside it.
function drawBranch(view, pass, tag, parent, depth, hue, path, keyBase) {
  const key = keyBase + '/' + tag.id;
  const kids = view.sortSiblings(tag.kids.filter(kid => !path.has(kid.id) && pass.visible(kid)), pass.rank);
  const open = pass.q ? true : !folded.has(tag.uuid);
  const isRoot = depth === 0 && pass.section === 'top';
  const row = el(view.doc, 'div', { class: 'rtg-row' + (kids.length ? ' rtg-branch' : '') + (isRoot ? ' rtg-root' : '') + (tag.builtIn ? ' rtg-builtin' : '') + (pass.q && !matches(tag, pass.q) ? ' rtg-dim' : ''),
    'data-key': key, draggable: tag.builtIn ? null : 'true', style: hue != null ? `--rtg-hue: var(--rtg-h${hue})` : null });
  const item = { key, tag, parent, row, depth, sec: pass.section, root: isRoot };
  row.rtgLive = [item, tag, parent]; // what its clicks read, brought up to date if the row is kept (see morph)
  view.shown.push(item);
  const fold = el(view.doc, 'button', { class: 'rtg-fold' + (kids.length || view.hasRows(tag) ? '' : ' rtg-leaf') + (open ? '' : ' rtg-shut'), tabindex: '-1', 'aria-label': open ? 'Fold' : 'Unfold', html: CHEVRON,
    click: event => { event.stopPropagation(); view.toggle(tag); } });
  const main = el(view.doc, 'div', { class: 'rtg-main' });
  const line = el(view.doc, 'div', { class: 'rtg-line' });
  if (view.renaming === key) {
    const input = renameBox(view, tag, key);
  line.append(input);
    setTimeout(() => { input.focus(); input.select(); });
  } else {
    const name = el(view.doc, 'span', { class: 'rtg-name', title: `Open #${tag.title} (⇧ click: right sidebar)${tag.count ? ` · ${plural(tag.count, 'node')}` : ''}${kids.length ? ` · ${plural(below(tag).size, 'tag')} inside` : ''}` });
    view.highlight(name, tag.title, pass.q);
    name.addEventListener('click', event => { event.stopPropagation(); if ((event.metaKey || event.ctrlKey) && !tag.builtIn) { view.pickClick(item, event); return; } view.setCursor(key); openTag(tag, event.shiftKey).catch(error => warnOnce('a tag could not be opened', error)); });
    line.append(name);
  }
  rowLabels(view, line, tag, parent, key, open, kids, isRoot);
  main.append(line);
  if (tag.desc) main.append(el(view.doc, 'div', { class: 'rtg-desc', title: 'Change the description', click: event => { event.stopPropagation(); view.setCursor(key); view.askDescription(tag, event.currentTarget); } }, tag.desc));
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
    kidNodes.push(...view.propRows(tag));
    const nextPath = new Set(path).add(tag.id);
    for (const kid of kids) kidNodes.push(...drawBranch(view, pass, kid, tag, depth + 1, hue, nextPath, key));
  }
  if (kidNodes.length) nodes.push(el(view.doc, 'div', { class: 'rtg-kids', 'data-key': key + '>', style: hue != null ? `--rtg-hue: var(--rtg-h${hue})` : null }, ...kidNodes));
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
// The small grey words after a tag's name, only when they matter (0.4.223): its other parents, a namesake. How many
// nodes and tags are inside it is in the name's tooltip.
function rowLabels(view, line, tag, parent, key, open, kids, isRoot) {
  const others = tag.parents.filter(p => p.id !== parent?.id);
  if (parent && others.length) line.append(el(view.doc, 'span', { class: 'rtg-small rtg-also' }, 'also under ' + others.map(p => '#' + p.title).join(', ')));
  if (view.data.sameName.has(tag.title.toLowerCase())) line.append(el(view.doc, 'span', { class: 'rtg-small rtg-same', title: 'Another tag has the same name. Click to merge them.', click: event => { event.stopPropagation(); view.setCursor(key); view.askMerge(tag, parent, event.currentTarget); } }, 'same name as another tag'));
}
// Clicks on a row: the cursor, picking, the menu, renaming.
function rowListeners(view, row, item, tag, key) {
  row.addEventListener('mousedown', event => { if (!event.target.closest('input')) { if (event.shiftKey || event.metaKey || event.ctrlKey) event.preventDefault(); else view.setCursor(key, false); } });
  row.addEventListener('click', event => { if (!event.target.closest('button, input, .rtg-name')) view.pickClick(item, event); });
  row.addEventListener('contextmenu', event => { event.preventDefault(); view.setCursor(key); view.rowMenu(item, { getBoundingClientRect: () => ({ left: event.clientX, top: event.clientY, bottom: event.clientY }) }); });
  row.addEventListener('dblclick', event => { if (!tag.builtIn && !event.target.closest('button, input')) { view.renaming = key; view.draw(); } });
}
// The top level: every tag with no parent, each with its colour; then, while a tag is dragged, a place to drop
// it last at the top level, and the button for a new tag there.
function drawTop(view, pass, sections) {
  pass.section = 'top';
  const tops = view.topTags(pass.rank).filter(pass.visible);
  const nodes = tops.flatMap((tag, i) => drawBranch(view, pass, tag, null, 0, i % HUES, new Set(), ''));
  if (!pass.q) {
    const zone = el(view.doc, 'div', { class: 'rtg-topzone', 'data-key': 'topzone' }, 'Drop here to put it at the top level');
    view.dropTarget(zone, null);
    nodes.push(zone);
    if (view.adding?.key === 'top') nodes.push(view.addRow(null));
    else nodes.push(el(view.doc, 'div', { class: 'rtg-newroot', 'data-key': 'newtop' }, el(view.doc, 'button', { class: 'rtg-make', title: 'Make a tag at the top level', click: () => view.startAdd(null, 'top') }, '+ New tag')));
  }
  sections.push(el(view.doc, 'div', { class: 'rtg-section rtg-top', 'data-key': 'top' }, ...nodes));
}
// Tags that extend Logseq's own tags, under those tags.
function drawLogseq(view, pass, sections) {
  const builtIns = [...view.data.tags.values()].filter(tag => tag.builtIn && !tag.parents.length && tag.kids.some(kid => !kid.builtIn) && pass.visible(tag)).sort(view.data.byTitle);
  pass.section = 'logseq';
  if (builtIns.length) sections.push(el(view.doc, 'div', { class: 'rtg-section', 'data-key': 'logseq' }, el(view.doc, 'h3', { class: 'rtg-group' }, 'Under Logseq’s tags'), ...builtIns.flatMap(tag => drawBranch(view, pass, tag, null, 1, null, new Set(), 'logseq'))));
  if (pass.q && !pass.keep.size) sections.push(el(view.doc, 'div', { class: 'rtg-empty' }, 'No tag or property by that name. Press Enter to make a tag of it.'));
}

/* By property (0.4.236): every property of yours once, in name order, each a row like the ones under a tag, with the
   tags that have it after its kind ("on #Consultation, #Conversation"); it opens into the same details (what it
   holds, its choices, what a link accepts, how it reads on the other page) and its name opens the same menu. A
   property on no tag is listed last, under its own heading. A search matches a property's name or the name of a
   tag that has it. */
// Since 0.4.243 your groups come first, each under its name, in the order you gave them; the rest follow under "Not
// in a group" (only when there are groups), and a property on no tag, in no group, last. A group's name opens its
// menu; dragging a property onto a group's name puts it there.
function drawProps(view, pass, sections) {
  pass.section = 'props';
  const doc = view.doc;
  const all = [...(view.data.propInfo?.values() || [])].filter(prop => prop.title).sort((a, b) => a.title.localeCompare(b.title));
  const fits = prop => !pass.q || prop.title.toLowerCase().includes(pass.q) || (prop.givenBy || []).some(t => t.title.toLowerCase().includes(pass.q));
  const groups = readGroups(), grouped = new Set();
  groups.forEach((group, i) => {
    const members = group.props.map(name => all.find(p => p.title.toLowerCase() === name.toLowerCase())).filter(Boolean);
    for (const p of members) grouped.add(p);
    const shown = members.filter(fits);
    if (pass.q && !shown.length && !group.name.toLowerCase().includes(pass.q)) return;
    const shut = groupsShut.has(group.name.toLowerCase()) && !pass.q;
    sections.push(el(doc, 'div', { class: 'rtg-section rtg-pgroup', 'data-key': `group-${i}` }, view.groupHeading(group, i, groups.length, members.length, shut),
      ...(shut ? [] : shown.length ? shown.flatMap(prop => propTopRow(view, pass, prop)) : [el(doc, 'div', { class: 'rtg-empty rtg-gempty' }, 'Drag a property onto the name, or use Put in a group in its menu.')])));
  });
  const rest = all.filter(prop => !grouped.has(prop) && fits(prop));
  const onTags = rest.filter(prop => prop.givenBy?.length), loose = rest.filter(prop => !prop.givenBy?.length);
  const restHead = groups.length ? [view.groupHeading(null)] : [];
  if (onTags.length || groups.length) sections.push(el(doc, 'div', { class: 'rtg-section rtg-top', 'data-key': 'props' }, ...restHead, ...onTags.flatMap(prop => propTopRow(view, pass, prop))));
  if (loose.length) sections.push(el(doc, 'div', { class: 'rtg-section', 'data-key': 'props-loose' }, el(doc, 'h3', { class: 'rtg-group' }, 'On no tag'), ...loose.flatMap(prop => propTopRow(view, pass, prop))));
  if (!grouped.size && !onTags.length && !loose.length) sections.push(el(doc, 'div', { class: 'rtg-empty' }, pass.q ? 'No property by that name.' : 'No properties yet.'));
  if (!pass.q) sections.push(el(doc, 'div', { class: 'rtg-newroot', 'data-key': 'newgroup' }, el(doc, 'button', { class: 'rtg-make', title: 'Make a group of properties, for your own order; nothing in the graph changes', click: event => view.askGroupName(null, event.currentTarget) }, '+ New group')));
}
// A group's heading (group null: "Not in a group"): click to fold, its name opens its menu, a property dropped on it goes in.
function groupHeading(view, group, i, count, members, shut) {
  const doc = view.doc;
  const head = el(doc, 'h3', { class: 'rtg-group rtg-ghead' + (group ? '' : ' rtg-gnone'), title: group ? 'Click to fold; right-click or ⋯ for the group’s menu; drop a property here to put it in' : 'Drop a property here to take it out of its group' });
  if (group) {
    head.append(el(doc, 'button', { class: 'rtg-fold' + (shut ? ' rtg-shut' : ''), tabindex: '-1', 'aria-label': shut ? 'Unfold' : 'Fold', html: CHEVRON }),
      el(doc, 'span', {}, group.name), el(doc, 'span', { class: 'rtg-small' }, String(members)),
      el(doc, 'button', { class: 'rtg-make rtg-gmenu', title: 'The group’s menu', click: event => { event.stopPropagation(); view.groupMenu(group, i, count, event.currentTarget); } }, '⋯'));
    head.addEventListener('click', event => { if (event.target.closest('.rtg-gmenu')) return; const key = group.name.toLowerCase(); if (groupsShut.has(key)) groupsShut.delete(key); else groupsShut.add(key); saveGroupsShut(); view.draw(); });
    head.addEventListener('contextmenu', event => { event.preventDefault(); view.groupMenu(group, i, count, { getBoundingClientRect: () => ({ left: event.clientX, top: event.clientY, bottom: event.clientY }) }); });
  } else head.append(el(doc, 'span', {}, 'Not in a group'));
  head.addEventListener('dragover', event => { if (!view.draggingProp) return; event.preventDefault(); head.classList.add('rtg-gdrop'); });
  head.addEventListener('dragleave', () => head.classList.remove('rtg-gdrop'));
  head.addEventListener('drop', event => {
    if (!view.draggingProp) return;
    event.preventDefault(); head.classList.remove('rtg-gdrop');
    const prop = view.draggingProp; view.draggingProp = null;
    view.putInGroup(prop, group?.name || null);
  });
  return head;
}
function putInGroup(view, prop, name) {
  const was = groupOf(readGroups(), prop.title)?.name || null;
  if ((was || '').toLowerCase() === (name || '').toLowerCase()) return;
  const before = placeInGroup(prop.title, name);
  view.showToast(name ? `${prop.title} is in ${name} now` : `${prop.title} is in no group now`, async () => saveGroups(before));
}
function groupMenu(view, group, i, count, anchor) {
  const move = by => { const before = readGroups(), groups = before.slice(); const [g] = groups.splice(i, 1); groups.splice(i + by, 0, g); saveGroups(groups); view.showToast(`${group.name} moved ${by < 0 ? 'up' : 'down'}`, async () => saveGroups(before)); };
  const items = [{ html: 'Rename …', run: () => view.askGroupName(group, anchor) }];
  if (i > 0) items.push({ html: 'Move up', run: () => move(-1) });
  if (i < count - 1) items.push({ html: 'Move down', run: () => move(1) });
  items.push('-', { html: 'Remove the group (its properties stay)', run: () => { const before = readGroups(); saveGroups(before.filter((_, k) => k !== i)); view.showToast(`${group.name} removed; its properties are in no group now`, async () => saveGroups(before)); } });
  view.showMenu(anchor, group.name, items);
}
// A name for a new group, or a new name for one; Enter keeps it, Esc leaves it.
function askGroupName(view, group, anchor, then) {
  view.closeMenu();
  const input = el(view.doc, 'input', { type: 'text', value: group?.name || '', placeholder: 'People and places', spellcheck: 'false', 'aria-label': 'Name of the group' });
  view.menu = el(view.doc, 'div', { class: 'rf-pop refinement-tags-menu', role: 'menu' }, el(view.doc, 'div', { class: 'rtg-mh rf-pop-head' }, group ? `Rename ${group.name}` : 'New group of properties'), input,
    el(view.doc, 'div', { class: 'rtg-mnote rf-pop-note' }, 'Only for the order in this map; nothing in the graph changes. Enter to keep, Esc to leave it.'));
  keepKeys(input);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); view.closeMenu(); view.box.focus({ preventScroll: true }); return; }
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    const name = input.value.trim().replace(/[;:]/g, ' ').replace(/\s+/g, ' ').trim();
    view.closeMenu();
    if (!name) return;
    const before = readGroups();
    const clash = before.find(g => g.name.toLowerCase() === name.toLowerCase() && g.name !== group?.name);
    if (clash) { logseq.UI.showMsg(`There is already a group called ${clash.name}`, 'warning'); return; }
    if (group) { saveGroups(before.map(g => g.name === group.name ? { ...g, name } : g)); view.showToast(`${group.name} is now ${name}`, async () => saveGroups(before)); }
    else { saveGroups([...before, { name, props: [] }]); then?.(name); if (!then) view.showToast(`Made the group ${name}`, async () => saveGroups(before)); }
  });
  view.doc.body.append(view.paint(view.menu));
  input.focus(); input.select();
  view.placeMenu(anchor);
}
function askPutInGroup(view, prop, anchor) {
  const groups = readGroups(), now = groupOf(groups, prop.title);
  const items = groups.filter(g => g !== now).map(g => ({ html: escapeHtml(g.name), run: () => view.putInGroup(prop, g.name) }));
  items.push({ html: 'New group …', run: () => view.askGroupName(null, anchor, name => view.putInGroup(prop, name)) });
  if (now) items.push('-', { html: `Take it out of ${escapeHtml(now.name)}`, run: () => view.putInGroup(prop, null) });
  view.showMenu(anchor, `Put ${prop.title} in a group`, items);
}
function propTopRow(view, pass, prop) {
  const doc = view.doc, key = `P${prop.id}`, open = propsOpen.has(key);
  const tag = prop.givenBy?.[0] || null;
  const fold = el(doc, 'button', { class: 'rtg-fold' + (open ? '' : ' rtg-shut'), tabindex: '-1', 'aria-label': open ? 'Fold' : 'Unfold', html: CHEVRON,
    click: event => { event.stopPropagation(); flip(propsOpen, key); saveProps(); view.draw(); } });
  const name = el(doc, 'span', { class: 'rtg-pname', title: 'Rename, or change what it holds',
    click: event => { event.stopPropagation(); view.propMenu(tag, prop, null, event.currentTarget, true); } });
  const words = el(doc, 'span');
  view.highlight(words, prop.title, pass.q);
  name.append(words);
  const type = el(doc, 'span', { class: 'rtg-ptype', html: view.typeHtml(prop), click: event => {
    event.stopPropagation();
    const piece = event.target.closest('[data-act]');
    if (piece?.dataset.act === 'values') { if (prop.type === 'node') view.askAccepts(prop, piece); else view.askChoices(prop, piece); }
    else view.kindMenu(prop, piece || event.currentTarget);
  } });
  const line = el(doc, 'div', { class: 'rtg-line' }, name, type);
  if (prop.givenBy?.length) {
    const on = el(doc, 'span', { class: 'rtg-small rtg-on' }, 'on ');
    prop.givenBy.slice().sort(view.data.byTitle).forEach((t, i) => {
      const link = el(doc, 'span', { class: 'rtg-ontag', title: `Open #${t.title} (⇧ click: right sidebar)`, click: event => { event.stopPropagation(); openTag(t, event.shiftKey).catch(error => warnOnce('a tag could not be opened', error)); } });
      view.highlight(link, '#' + t.title, pass.q);
      on.append(i ? ', ' : '', link);
    });
    line.append(on);
  }
  const row = el(doc, 'div', { class: 'rtg-row rtg-prow rtg-ptop', 'data-key': key, draggable: 'true' }, fold, el(doc, 'div', { class: 'rtg-main' }, line));
  row.addEventListener('dragstart', event => { view.draggingProp = prop; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', prop.title); event.stopPropagation(); });
  row.addEventListener('dragend', () => { view.draggingProp = null; for (const h of doc.querySelectorAll('.rtg-gdrop')) h.classList.remove('rtg-gdrop'); });
  row.addEventListener('click', event => { if (!event.target.closest('button, input, .rtg-pname, .rtg-ontag')) fold.click(); });
  row.addEventListener('contextmenu', event => { event.preventDefault(); view.propMenu(tag, prop, null, { getBoundingClientRect: () => ({ left: event.clientX, top: event.clientY, bottom: event.clientY }) }, true); });
  const nodes = [row];
  if (open) nodes.push(view.propDetails(tag, prop, null));
  return nodes;
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
  if (scroll && item) scrollToRow(item.row);
}

// Brings a row into view by scrolling only the box the map scrolls in (0.4.222). The browser's scrollIntoView also
// scrolled Logseq's own frame, which is not meant to scroll and cannot be scrolled back, so after a move the top
// of the whole window, the page title and the sidebar's header, stayed cut off.
function scrollToRow(row) {
  const scroller = scrollingParent(row);
  const doc = row.ownerDocument;
  const view = scroller === doc.scrollingElement ? { top: 0, bottom: doc.defaultView.innerHeight } : scroller.getBoundingClientRect();
  const r = row.getBoundingClientRect();
  if (r.top < view.top) scroller.scrollTop -= view.top - r.top + 8;
  else if (r.bottom > view.bottom) scroller.scrollTop += r.bottom - view.bottom + 8;
}

/* Dragging a tag onto another, or between two */
function dragRow(view, row, item) {
  if (!item.tag.builtIn) {
    row.addEventListener('dragstart', event => {
      view.dragging = { tag: item.tag, parent: item.parent };
      event.dataTransfer.effectAllowed = 'copyMove';
      event.dataTransfer.setData('text/plain', '#' + item.tag.title);
      setTimeout(() => { if (view.dragging) { row.classList.add('rtg-dragging'); view.box.classList.add('rtg-dragon'); } });
      // The browser sends no dragend when the row it started from was moved by the drop (seen in Logseq), so the
      // drag also ends at the first ordinary mouse move after it (none come while a drag is on).
      view.doc.addEventListener('mousemove', view.endDrag, { once: true, capture: true });
    });
    row.addEventListener('dragend', view.endDrag);
  }
  view.dropTarget(row, item.tag, item);
}

function endDrag(view) {
  view.dragging = null;
  view.box.classList.remove('rtg-dragon');
  view.body.querySelectorAll('.rtg-dragging').forEach(node => node.classList.remove('rtg-dragging'));
  view.clearDrop();
}

const DROP_MARKS = ['rtg-drop', 'rtg-drop-before', 'rtg-drop-after', 'rtg-drop-inside'];
function clearDrop(view) { return view.body.querySelectorAll(DROP_MARKS.map(c => '.' + c).join(', ')).forEach(node => node.classList.remove(...DROP_MARKS)); }

// Where a dragged tag would go, as with Logseq's bullets: over the upper half of a row, just before it (beside it,
// under the same parent); over the lower half, just after it, or, with the pointer moved to the right past the
// start of its name, inside it as its first tag. A row whose own tags show below it takes the lower half as
// inside, like an open bullet. A line shows the place, indented for inside. Without a row (the zone below the top
// level), the tag goes last at the top level.
function dropZone(view, node, target, item, event) {
  if (!item) return 'top';
  const canInside = !target.builtIn || PARENT_BUILT_INS.has(target.ident);
  const canBeside = !target.builtIn && (item.parent || item.sec === 'top');
  const r = node.getBoundingClientRect();
  const nameLeft = node.querySelector(':scope > .rtg-main')?.getBoundingClientRect().left ?? r.left + 24;
  const kidsShown = !!node.nextElementSibling?.classList.contains('rtg-kids') && node.nextElementSibling.childElementCount > 0;
  const upper = event.clientY < r.top + r.height / 2;
  if (upper) return canBeside ? 'before' : canInside ? 'inside' : null;
  if (canInside && (kidsShown || event.clientX > nameLeft + 30 || !canBeside)) return 'inside';
  return canBeside ? 'after' : null;
}

function dropTarget(view, node, target, item) {
  const allowed = zone => {
    if (!view.dragging || !zone) return false;
    const tag = view.fresh(view.dragging.tag);
    if (zone === 'top') return true;
    if (zone === 'inside') return !isAbove(tag, target);
    if (target.id === tag.id) return false;
    return !item.parent || !isAbove(tag, item.parent);
  };
  node.addEventListener('dragover', event => {
    const zone = view.dropZone(node, target, item, event);
    if (!allowed(zone)) { if (DROP_MARKS.some(c => node.classList.contains(c))) view.clearDrop(); return; }
    event.preventDefault(); event.stopPropagation();
    event.dataTransfer.dropEffect = event.altKey && zone !== 'top' && (zone === 'inside' || item.parent) ? 'copy' : 'move';
    const mark = zone === 'top' ? 'rtg-drop' : 'rtg-drop-' + zone;
    if (!node.classList.contains(mark)) { view.clearDrop(); node.classList.add(mark); }
  });
  node.addEventListener('dragleave', event => { if (!node.contains(event.relatedTarget)) node.classList.remove(...DROP_MARKS); });
  node.addEventListener('drop', event => {
    const zone = view.dropZone(node, target, item, event);
    if (!allowed(zone)) return;
    event.preventDefault(); event.stopPropagation();
    const { tag, parent } = view.dragging;
    view.endDrag();
    const keep = event.altKey;
    if (zone === 'top') view.place(tag, parent, null, null);
    // Inside: as its first tag.
    else if (zone === 'inside') view.place(tag, parent, target, view.siblingsIn(target).find(t => t.id !== tag.id) || null, keep);
    else if (zone === 'before') view.place(tag, parent, item.parent, target, keep && !!item.parent);
    else {
      const list = view.siblingsIn(item.parent).filter(t => t.id !== tag.id);
      view.place(tag, parent, item.parent, list[list.findIndex(t => t.id === target.id) + 1] || null, keep && !!item.parent);
    }
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
  if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !(item && (event.metaKey || event.ctrlKey) && event.shiftKey)) {
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
    if (byProp) return;
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
    if ((tag.kids.length || view.hasRows(tag)) && folded.has(tag.uuid)) view.toggle(tag);
    else if (view.shown[at + 1]?.depth > item.depth) view.setCursor(view.shown[at + 1].key);
    return;
  }
  if (event.key === 'ArrowLeft') {
    stop();
    if ((tag.kids.length || view.hasRows(tag)) && !folded.has(tag.uuid) && !view.find.value) view.toggle(tag);
    else { const up = view.shown.slice(0, at).reverse().find(i => i.sec === item.sec && i.depth < item.depth); if (up) view.setCursor(up.key); }
    return;
  }
  if (event.key === 'Tab' && !tag.builtIn) {
    stop();
    if (event.shiftKey) {
      // Out, as for a bullet: just after its parent, beside it.
      if (!parent) return;
      const grand = view.shown.slice(0, at).reverse().find(i => i.depth < item.depth && i.tag.id === parent.id)?.parent ?? null;
      const list = view.siblingsIn(grand).filter(t => t.id !== tag.id);
      view.place(tag, parent, grand, list[list.findIndex(t => t.id === parent.id) + 1] || null);
    } else {
      // In: the last tag inside the tag just above it at the same level.
      const prev = view.shown.slice(0, at).reverse().find(i => i.depth <= item.depth);
      if (prev && prev.sec === item.sec && prev.depth === item.depth && prev.tag.id !== tag.id && (!prev.tag.builtIn || PARENT_BUILT_INS.has(prev.tag.ident))) view.place(tag, parent, prev.tag, null);
    }
    return;
  }
  // Cmd+Shift+Up / Down move it among the tags beside it, as Logseq moves a bullet.
  if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && (event.metaKey || event.ctrlKey) && event.shiftKey && !tag.builtIn) { stop(); view.moveAmong(tag, parent, event.key === 'ArrowUp' ? -1 : 1); return; }
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
  const t0 = performance.now();
  try { view.data = await loadTags(); view.loaded = true; }
  catch (error) { warnOnce('the tags could not be read', error); }
  const t1 = performance.now();
  view.draw();
  stopwatch(view, t0, t1, performance.now());
}

// A stopwatch for the map: how long each refresh took to read the tags, to build the rows, and until the
// browser had them on screen. Kept (the last 50) on Logseq's own window, where its developer console reads
// it: refinementTagTimes, or console.table(refinementTagTimes).
function stopwatch(view, t0, t1, t2) {
  const win = view.doc.defaultView;
  if (!win || !view.box.isConnected) return;
  win.requestAnimationFrame(() => win.setTimeout(() => {
    try {
      const list = (win.refinementTagTimes ||= []);
      list.push({ at: new Date().toLocaleTimeString(), rows: view.box.querySelectorAll('.rtg-row').length,
        readMs: Math.round(t1 - t0), buildMs: Math.round(t2 - t1), onScreenMs: Math.round(performance.now() - t0) });
      if (list.length > 50) list.shift();
    } catch (error) { /* the stopwatch never gets in the way */ }
  }));
}

function destroy(view) {
  view.closeMenu();
  view.hideToast();
  clearTimeout(view.timer);
  view.doc.removeEventListener('mousedown', view.onDown, true);
  view.doc.removeEventListener('mousemove', view.endDrag, true);
  try { view.offChanged?.(); } catch (error) { /* already off */ }
  openViews.delete(view.draw);
  view.box.remove();
}
// The pieces of createView, each given the view's state; createView binds them to the view by name.
const CREATEVIEW_FUNCTIONS = [closeMenu, paint, morph, placeMenu, menuKeys, showMenu, pickTag, hideToast, showToast, act, fresh, parentsTitle, reparent, moveTo, alsoUnder, takeOut, targetsFor, askMove, askAlso, addTags, submitAdd, startAdd, rename, keepOnly, askMerge, confirmMerge, pickClick, pickedTags, topFromPicked, movePicked, sameTag, sortSiblings, topTags, siblingsIn, saveOrder, place, moveAmong, hasRows, typeHtml, propInfoOf, infoButton, askRenameProp, askAccepts, kindMenu, askChoices, askChildTag, confirmChildTag, askLinks, groupHeading, putInGroup, groupMenu, askGroupName, askPutInGroup, askDescription, propRows, propRow, propDetails, pointerRow, propGuide, passesDown, propMoves, propMenu, addProp, takePropOff, movePropUp, newProperty, askProperty, rowMenu, highlight, draw, addRow, toggle, setCursor, mark, dragRow, endDrag, clearDrop, dropZone, dropTarget, onKey, onDown, refresh, destroy];

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
  const off = logseq.onSettingsChanged?.(() => { orderOverride = null; groupsOverride = null; for (const redraw of openViews) redraw(); });
  if (typeof off === 'function') onUnload(off);
  onUnload(() => { host().querySelector('.refinement-tags-menu')?.remove(); host().querySelector('.refinement-tags-dialog')?.remove(); });
}

(window.refinementParts ||= []).push({ name: 'tag tree', schema: settingsSchema, start, stop: runUnloadTasks });
})();
