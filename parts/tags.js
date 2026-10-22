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
   opens a short explanation; nothing else is explained unless asked.
   Editable in place like the Properties view (0.4.306): an open tag's own lines end with a faint line of what can be
   made there (+ Property, + Tag inside, + Description), "also under #X" opens a menu for that parent, each link on
   "Shows up here as" opens a menu (go to the property, change how it reads here, turn it off here), and the Undo
   arrow of a change made on one of those lines sits on that line.
   The tag map, piece 3 of 3 (0.4.295): the tree itself, its look, menus, moving and picking tags, keys, and the page
   and sidebar it is shown in. The graph's side is parts/tags-graph.js, the property map parts/tags-props.js.
   The pieces share one object, window.refinementTagMap (TM): parts/tags-graph.js and parts/tags-props.js put there what
   they have, loaded in that order before parts/tags.js, and each piece takes what it uses from there as it loads.
   parts/tags.js starts the map only when both are loaded, and says so otherwise; the other two alone do nothing. */
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
const TM = window.refinementTagMap ||= {};
const setting = shared.settingReader(settingsSchema);
TM.setting = setting;
// What the other two pieces have (parts/tags-graph.js, parts/tags-props.js); undefined when one is not loaded, and then
// start() below starts nothing.
const { CHEVRON, DOTS, HUES, PAGE_ICON, PARENT_BUILT_INS, PLUS, SIDEBAR_ICON, TREE_ICON, acts, addProp, anchoredPanel, askAccepts, askAddToTag, askChildTag, askChoices, askDescription, askGroupName, askLinks, askNewPropAccepts, askNewPropKind, askNewPropTag, askProperty, askPutInGroup, askRenameProp, below, confirmChildTag, drawProps, el, escapeHtml, folded, groupHeading, groupMenu, hasRows, infoButton, isAbove, keepKeys, kindMenu, loadTags, makeNewProp, makeTag, movePropUp, newProperty, newPropRow, openTag, openViews, passesDown, pathOf, planMerge, plural, propDetails, propGuide, propInfoOf, propMenu, propMoves, propRow, propRows, propsOpen, putInGroup, resetGroups, runMerge, saveFolded, saveInherited, saveProps, setParents, shown, startNewProp, takePropOff, twoWay, typeHtml, useOf } = TM;
// (pointerRow, the "Shows up here as" line, is this piece's own since 0.4.306: each link on it opens a menu.)
// An order changed from the tree is used at once; Logseq hands the saved setting back a little later.
let orderOverride = null;
const topOrder = () => (orderOverride ?? setting('tagTreeRoots')).split(',').map(name => name.trim().replace(/^#/, '')).filter(Boolean);
// Which way round the map is drawn (0.4.236, the owner's ask): by tag (the tree) or by property (every property once,
// with the tags that have it). Kept in Logseq's window storage, shared by the page and the sidebar.
const BY_KEY = 'refinement-tags-by';
let byProp = (() => { try { return localStorage.getItem(BY_KEY) === 'property'; } catch (error) { return false; } })();
const saveBy = () => { try { localStorage.setItem(BY_KEY, byProp ? 'property' : 'tag'); } catch (error) { /* kept for this session only */ } };

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
/* The Properties view's + New property and + New group side by side; the line being typed in takes the first one's place (0.4.305). */
.refinement-tags .rtg-newprops { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.refinement-tags .rtg-addprop { flex: 1; min-width: 180px; max-width: 320px; padding: 0; }
.refinement-tags .rtg-addprop::before { content: none; }
/* The On line: the tags that have the property, each with an × that shows under the pointer. */
.refinement-tags .rtg-onlist { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; }
.refinement-tags .rtg-onchip { display: inline-flex; align-items: baseline; font-weight: 600; }
.refinement-tags .rtg-onchip .rtg-ontag { color: inherit; }
.refinement-tags .rtg-onx { border: 0; padding: 0 4px; background: none; color: var(--rtg-faint); font-size: 15px; line-height: 1; cursor: pointer; opacity: 0; }
.refinement-tags .rtg-onchip:hover .rtg-onx, .refinement-tags .rtg-onx:focus-visible { opacity: 1; }
.refinement-tags .rtg-onx:hover { color: var(--ls-primary-text-color); }
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
/* An open tag's own lines, editable where they sit (0.4.306). The adds line ends the tag's rows: faint, full under the
   pointer or with the cursor on the tag, always in the flow so nothing moves when it brightens. */
.refinement-tags .rtg-adds { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; padding: 1px 8px 3px 26px; font-size: 13px; line-height: 1.5; opacity: .55; }
.refinement-tags .rtg-row:hover + .rtg-kids > .rtg-adds, .refinement-tags .rtg-row.rtg-current + .rtg-kids > .rtg-adds, .refinement-tags .rtg-adds:hover, .refinement-tags .rtg-adds:focus-within { opacity: 1; }
.refinement-tags .rtg-addline { border: 0; padding: 0; background: none; cursor: pointer; color: var(--rtg-faint) !important; font-size: inherit !important; white-space: nowrap; }
.refinement-tags .rtg-addline + .rtg-addline::before { content: '·'; margin-right: 8px; opacity: .7; }
.refinement-tags .rtg-addline:hover { color: var(--ls-primary-text-color) !important; text-decoration: underline; text-underline-offset: 2px; }
.refinement-tags .rtg-alsotag { cursor: pointer; }
.refinement-tags .rtg-alsotag:hover { color: var(--rtg-mid); text-decoration: underline; text-underline-offset: 2px; }
.refinement-tags .rtg-ptr { cursor: pointer; }
.refinement-tags .rtg-ptr:hover .rtg-val { text-decoration: underline; text-decoration-color: var(--rtg-border); text-underline-offset: 3px; }
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
.refinement-tags-menu { min-width: 240px; max-width: 340px; z-index: 10004; } /* above a plan's box too: the pages' tag is picked from one (0.4.305) */
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
.rf-dialog.rf-anchored.refinement-tags-dialog { width: min(440px, 92vw); }
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
  view.cursorSub = null; // the key of one of the tag's own lines last pressed (a property row, the links into it), for the Undo arrow (0.4.306)
  view.cursorSubIn = null; // the key of the box that line is in
  view.menu = null;
  view.adding = null; // { key, parent } while a new tag is being typed
  view.addingProp = null; // { name } while a new property is being typed in the Properties view (0.4.305)
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
  view.inherited = el(view.doc, 'button', { class: 'rtg-tool', title: 'List the properties each tag gets from the tags above it, faded', click: () => { shown.inherited = !shown.inherited; saveInherited(); view.draw(); } });
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
    click: () => { if (byProp === on) return; byProp = on; saveBy(); view.cursorKey = null; view.cursorTag = null; view.cursorSub = null; view.closeMenu(); for (const draw of openViews) draw(); } }, text);
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
  // A press on one of a tag's own lines in the tree (a property row, its open details, the links into the tag) is
  // remembered, so the Undo arrow of what is changed there sits on that line (0.4.306). The tag row itself, and the
  // keys, clear it (setCursor, onKey).
  view.body.addEventListener('mousedown', event => {
    if (byProp) return;
    let line = event.target.closest('.rtg-prow, .rtg-pointrow, .rtg-pinfo, .rtg-guide');
    while (line && !line.dataset.key) line = line.previousElementSibling;
    if (!line) return;
    view.cursorSub = line.dataset.key;
    view.cursorSubIn = line.parentElement?.dataset.key || null;
  });

  // Changes made elsewhere show up here too, unless something is being typed or dragged.
  view.timer = 0;
  view.quietUntil = 0;
  view.offChanged = logseq.DB.onChanged(() => {
    // The map's own changes are redrawn by act(); their echoes from Logseq, during it and just after, are not.
    if (view.busy || performance.now() < view.quietUntil) return;
    clearTimeout(view.timer);
    view.timer = setTimeout(function again() {
      if (view.busy) return;
      if (view.menu || view.dragging || view.adding || view.addingProp || view.renaming || view.doc.activeElement?.classList?.contains('rtg-words')) { view.timer = setTimeout(again, 800); return; }
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
let undoCount = 0;
/* Where the arrow goes (0.4.296, the owner, pointing at a row of arrows after the map's title: "all these are useless"):
   at the end of the row that changed, found again after every redraw; with that row not on screen, in the corner at the
   bottom right with its words, so it says what it takes back; never after the title, where every change of the session
   had piled up as one more arrow saying nothing. Only the map's last three changes keep an arrow, and closing the map
   drops them. */
const MAP_UNDOS = 3;
function showToast(view, text, undo) {
  if (!undo) { logseq.UI.showMsg(text); return; }
  const key = view.cursorKey, tagId = view.cursorTag, sub = view.cursorSub, subIn = view.cursorSubIn;
  const at = () => {
    if (!view.box?.isConnected) return null;
    const css = view.doc.defaultView.CSS;
    // A change made on one of the tag's own lines keeps its arrow on that line (0.4.306); with the line gone (the
    // property taken off), on the tag's row as before.
    if (sub) {
      const box = subIn ? view.box.querySelector(`.rtg-kids[data-key="${css.escape(subIn)}"]`) : view.body;
      const line = box?.querySelector(`:scope > [data-key="${css.escape(sub)}"]`);
      if (line?.isConnected) return line.querySelector('.rtg-line') || line;
    }
    const row = (key && view.box.querySelector(`.rtg-row[data-key="${css.escape(key)}"]`)) || (tagId != null && view.shown?.find(i => i.tag?.id === tagId)?.row);
    return row?.isConnected ? row.querySelector('.rtg-line') : null;
  };
  const n = ++undoCount;
  shared.undo.offer({ key: `tags:${n}`, at, text, run: () => view.act(undo, 'The change could not be undone'), data: { view } });
  shared.undo.forget(entry => entry.key.startsWith('tags:') && Number(entry.key.slice(5)) <= n - MAP_UNDOS);
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
  // Undo puts the old name back in the order too (the audit, 0.4.274: it stayed under the new name).
  if (renamed !== old) view.showToast(`#${old} is now #${renamed}`, async () => {
    await logseq.Editor.renamePage(tag.uuid, old);
    if (topOrder().some(n => view.sameTag(n, renamed))) { view.saveOrder(topOrder().map(n => view.sameTag(n, renamed) ? old : n).join(', ')); view.draw(); }
  });
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
  view.pickTag(anchor, `Merge #${tag.title} into …`, choices, target => view.confirmMerge(tag, target, anchor));
}

async function confirmMerge(view, source, target, anchor) {
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
  panel.classList.add('refinement-tags-dialog');
  const close = anchoredPanel(view, panel, anchor);
  cancel.addEventListener('click', close);
  go.addEventListener('click', async () => {
    close();
    view.cursorTag = target.id; view.cursorKey = null;
    folded.delete(target.uuid); saveFolded();
    await view.act(() => runMerge(plan), `#${source.title} could not be merged into #${target.title}`);
    if (!view.data.tags.has(source.id)) view.showToast(`#${source.title} is merged into #${target.title}`);
  });
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
  view.inherited.textContent = shown.inherited ? 'Hide inherited' : 'Show inherited';
  view.byTags.setAttribute('aria-pressed', String(!byProp)); view.byProps.setAttribute('aria-pressed', String(byProp));
  for (const b of [view.inherited, view.foldAll, view.openAll]) b.hidden = byProp;
  view.box.classList.toggle('rtg-by-prop', byProp);
  // Keep the cursor on its row, or on the tag it was on if that moved. (Not in the Properties view, where no row is a
  // tag's: a tag remembered from a child-tag plan would clear the property row the Undo arrow sits on, second reading.)
  if (view.cursorTag != null && !byProp) {
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
  // Under an open tag: its property rows and the links into it, the line of what can be made there (0.4.306; not
  // while searching, and not under a tag that is only a leaf, so a leaf stays one line), the box for a new tag
  // being typed, then the tags inside it.
  const rows = open ? view.propRows(tag) : [];
  kidNodes.push(...rows);
  if (open && !pass.q && (rows.length || kids.length) && (!tag.builtIn || PARENT_BUILT_INS.has(tag.ident))) kidNodes.push(view.addsRow(tag, key));
  if (view.adding?.key === key) kidNodes.push(view.addRow(tag));
  if (open) {
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
  // Each other parent can be acted on where it is named (0.4.306): go there, take the tag out of it, keep it only here.
  if (parent && others.length) {
    const also = el(view.doc, 'span', { class: 'rtg-small rtg-also' }, 'also under ');
    others.forEach((p, i) => also.append(i ? ', ' : '', el(view.doc, 'span', { class: 'rtg-alsotag', title: `#${tag.title} is also under #${p.title}: click to go there or take it out`,
      click: event => { event.stopPropagation(); view.setCursor(key, false); view.parentMenu(tag, parent, p, event.currentTarget); } }, '#' + p.title)));
    line.append(also);
  }
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
  view.cursorSub = null;
  view.mark(scroll);
}

/* An open tag's own lines (0.4.306) */
// The line that ends a tag's rows: what can be made there, each the same move as the row's menu or its key.
function addsRow(view, tag, key) {
  const doc = view.doc;
  const go = (title, text, run) => el(doc, 'button', { class: 'rtg-addline', title, click: event => { event.stopPropagation(); view.setCursor(key, false); run(event.currentTarget); } }, text);
  const line = el(doc, 'div', { class: 'rtg-adds', 'data-key': 'adds' });
  if (!tag.builtIn) line.append(go(`Add one of your properties to #${tag.title} (p)`, '+ Property', at => view.askProperty(tag, at)));
  line.append(go(`New tag inside #${tag.title} (n)`, '+ Tag inside', () => view.startAdd(tag, key)));
  if (!tag.builtIn && !tag.desc) line.append(go(`Say what #${tag.title} is for`, '+ Description', at => view.askDescription(tag, at)));
  return line;
}
// The menu of one of a tag's other parents, from "also under #X" on its row: here is the parent the row is under.
function parentMenu(view, tag, here, other, anchor) {
  view.showMenu(anchor, `#${tag.title} is also under #${other.title}`, [
    { html: `Go to #${escapeHtml(other.title)}`, run: () => view.revealTag(other) },
    { html: `Take #${escapeHtml(tag.title)} out of #${escapeHtml(other.title)}`, run: () => view.takeOut(tag, other) },
    { html: `Keep it only under #${escapeHtml(here.title)}`, run: () => view.keepOnly(tag, here) },
    '-', { html: 'Also put under …<kbd>a</kbd>', run: () => view.askAlso(tag, anchor) }]);
}
// Puts the cursor on a tag's row, unfolding the tags above it; a tag the tree does not show (searching) opens its page.
function revealTag(view, tag) {
  const seen = new Set();
  for (let up = tag.parents[0]; up && !seen.has(up.id); up = up.parents[0]) { seen.add(up.id); folded.delete(up.uuid); }
  saveFolded();
  view.draw();
  const item = view.shown.find(i => i.tag.id === tag.id);
  if (item) view.setCursor(item.key); else openTag(tag).catch(error => warnOnce('a tag could not be opened', error));
}
// From a link into a tag to the property it is, open under the tag that has it.
function goToProp(view, giver, prop) {
  folded.delete(giver.uuid);
  propsOpen.add(giver.uuid + '|' + prop.id); saveProps();
  view.revealTag(giver);
}
// The links that point at a tag from elsewhere, as the tag's page shows them: each opens its menu (0.4.306).
function pointerRow(view, tag) {
  const doc = view.doc, tw = twoWay();
  const row = el(doc, 'div', { class: 'rtg-pointrow', 'data-key': 'ptr' }, el(doc, 'span', { class: 'rtg-note' }, 'Shows up here as'));
  for (const prop of tag.pointers) {
    const on = tw ? tw.shownAtOtherEnd(prop.title) : true;
    const givers = prop.givenBy?.length ? prop.givenBy.map(t => '#' + t.title).join(', ') : '';
    row.append(el(doc, 'span', { class: 'rtg-ptr', title: `${prop.title}${givers ? ', filled in on ' + givers : ''}: click to go to it, change how it reads here or turn it off here`,
      click: event => { event.stopPropagation(); view.pointerMenu(tag, prop, event.currentTarget); } },
      el(doc, 'span', { class: 'rtg-val' }, tw ? tw.backwardsLabel(prop.title) : prop.title), ' →',
      givers ? el(doc, 'span', { class: 'rtg-note' }, ` filled in on ${givers}`) : '', on ? '' : el(doc, 'span', { class: 'rtg-off rtg-note' }, ' (turned off)')));
  }
  return row;
}
function pointerMenu(view, tag, prop, anchor) {
  const tw = twoWay(), items = [];
  for (const giver of (prop.givenBy || []).slice().sort(view.data.byTitle)) items.push({ html: `Go to ${escapeHtml(prop.title)} on #${escapeHtml(giver.title)}`, run: () => view.goToProp(giver, prop) });
  if (tw) {
    const on = tw.shownAtOtherEnd(prop.title);
    if (items.length) items.push('-');
    items.push({ html: 'Change how it reads here …', run: () => view.askWording(tag, prop, anchor) },
      { html: on ? `Turn off on #${escapeHtml(tag.title)}’s page (the links stay)` : `Turn on on #${escapeHtml(tag.title)}’s page`, run: () => {
        tw.setShownAtOtherEnd(prop.title, !on);
        view.showToast(on ? `${prop.title} no longer shows on #${tag.title}’s page; the links stay` : `${prop.title} shows on #${tag.title}’s page again`, () => { tw.setShownAtOtherEnd(prop.title, on); view.draw(); });
        view.draw();
      } });
  }
  view.showMenu(anchor, `${tw ? tw.backwardsLabel(prop.title) : prop.title} ← ${prop.title}`, items);
}
// How a link reads on the page it points to, typed in a small box under the link (the same as the property's own
// "On the other page" line); empty takes it back to how it reads by itself.
function askWording(view, tag, prop, anchor) {
  const tw = twoWay();
  if (!tw) return;
  view.closeMenu();
  const before = tw.backwardsLabel(prop.title);
  const input = el(view.doc, 'input', { type: 'text', value: before, spellcheck: 'false', 'aria-label': `How ${prop.title} reads on #${tag.title}’s page` });
  view.menu = el(view.doc, 'div', { class: 'rf-pop refinement-tags-menu', role: 'dialog' }, el(view.doc, 'div', { class: 'rtg-mh rf-pop-head' }, `How ${prop.title} reads on #${tag.title}’s page`), input,
    el(view.doc, 'div', { class: 'rtg-mnote rf-pop-note' }, 'Enter keeps it, Esc leaves it. Empty: back to how it reads by itself.'));
  keepKeys(input);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); view.closeMenu(); view.box.focus({ preventScroll: true }); return; }
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    const after = input.value.trim();
    view.closeMenu(); view.box.focus({ preventScroll: true });
    if (after === before) return;
    tw.setBackwards(prop.title, after);
    view.showToast(after ? `${prop.title} reads “${after}” on #${tag.title}’s page` : `${prop.title} reads as it does by itself on #${tag.title}’s page again`, () => { tw.setBackwards(prop.title, before); view.draw(); });
    view.draw();
  });
  view.doc.body.append(view.paint(view.menu));
  input.focus(); input.select();
  view.placeMenu(anchor);
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
  view.cursorSub = null; // a key acts on the tag's row, so its Undo arrow goes there
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
  clearTimeout(view.timer);
  view.doc.removeEventListener('mousedown', view.onDown, true);
  view.doc.removeEventListener('mousemove', view.endDrag, true);
  try { view.offChanged?.(); } catch (error) { /* already off */ }
  openViews.delete(view.draw);
  shared.undo.forget(entry => entry.key.startsWith('tags:') && entry.data?.view === view);
  view.box.remove();
}
// The pieces of createView, each given the view's state; createView binds them to the view by name.
const CREATEVIEW_FUNCTIONS = [closeMenu, paint, morph, placeMenu, menuKeys, showMenu, pickTag, showToast, act, fresh, parentsTitle, reparent, moveTo, alsoUnder, takeOut, targetsFor, askMove, askAlso, addTags, submitAdd, startAdd, rename, keepOnly, askMerge, confirmMerge, pickClick, pickedTags, topFromPicked, movePicked, sameTag, sortSiblings, topTags, siblingsIn, saveOrder, place, moveAmong, hasRows, typeHtml, propInfoOf, infoButton, askRenameProp, askAccepts, kindMenu, askChoices, askChildTag, confirmChildTag, askLinks, groupHeading, putInGroup, groupMenu, askGroupName, askPutInGroup, askDescription, propRows, propRow, propDetails, pointerRow, propGuide, passesDown, propMoves, propMenu, addProp, takePropOff, movePropUp, newProperty, askProperty, rowMenu, highlight, draw, addRow, toggle, setCursor, addsRow, parentMenu, revealTag, goToProp, pointerMenu, askWording, mark, dragRow, endDrag, clearDrop, dropZone, dropTarget, onKey, onDown, refresh, destroy, useOf, askAddToTag, startNewProp, newPropRow, askNewPropKind, askNewPropAccepts, askNewPropTag, makeNewProp];

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
  const missing = [!TM.graphLoaded && 'parts/tags-graph.js', !TM.propsLoaded && 'parts/tags-props.js'].filter(Boolean);
  if (missing.length) { warnOnce(`${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not loaded, so the tag tree is off`); return; }
  if (!setting('tagTreeEnabled')) return; // off: nothing is registered (the one-off switch back on of 0.4.152 went at 0.4.294)
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
  const off = logseq.onSettingsChanged?.(() => { orderOverride = null; resetGroups(); for (const redraw of openViews) redraw(); });
  if (typeof off === 'function') onUnload(off);
  onUnload(() => { host().querySelector('.refinement-tags-menu')?.remove(); host().querySelector('.refinement-tags-dialog')?.remove(); });
}

(window.refinementParts ||= []).push({ name: 'tag tree', schema: settingsSchema, start, stop: runUnloadTasks });
})();
