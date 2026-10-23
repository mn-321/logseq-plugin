/* Loaded by main.js after parts/tags-graph.js and before parts/tags.js. Kept in its own scope; it draws nothing by itself. */
(() => {
/* The tag map, piece 2 of 3 (split out of parts/tags.js at 0.4.295): the property map. A tag's properties as rows
   under it, what each holds and accepts, the menus and boxes that change them (rename, accepts, choices, a choice
   made its own child tag, turned into links, a description, adding or taking a property off), and the Properties
   view with its groups and its + New property (0.4.305). Its functions are the tree's view methods (view.propRows …), added by parts/tags.js.
   The pieces share one bag, shared.feature('tagMap') (TM): parts/tags-graph.js and parts/tags-props.js put there what
   they have, loaded in that order before parts/tags.js, and each piece takes what it uses from there as it loads.
   parts/tags.js starts the map only when both are loaded, and says so otherwise; the other two alone do nothing.
   On the kit since 0.4.320 (docs/LAYERS.md; the views page): a property's kind is the kit's icon left of its name (an
   arrow for a link, twice for several, a calendar, Aa, 123, a box with a chevron for a choice), what it accepts or
   offers follows in plain words with tags as classes (mono, no #); an opened property's lines end in quiet words
   (Change …, Edit, + Tag, Turn off); the menus are the kit's pop-up, the lists its list pop-up, every question its
   question beside what asked (a name, a description in a taller field, a group's name), the choices panel and the
   two plans (a child tag, links) its pop-up with the kit's fields and the two words; the explanation under a property
   the kit's help paragraph; the graph is read and written only through the model's doors. */
const shared = window.refinementShared;
const { notify, iconHtml } = shared;
const { warnOnce, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (tag tree): ' });
const TM = shared.feature('tagMap');
const { CHOICE_TYPES, PARENT_BUILT_INS, addTagProp, below, childTagName, choicesOf, el, escapeHtml, flip, folded, groupOf, groupsShut, infoOpen, inheritedProps, loadProps, model, openTag, pathOf, placeInGroup, planChildTag, planLinks, plural, propsOpen, readGroups, removeChoice, removeTagProp, renameChoice, runChildTag, runLinks, saveFolded, saveGroups, saveGroupsShut, saveProps, setAccepts, setDescription, shown, tagHtml, tagWord, twoWay } = TM;
/* Tag properties */
/* The map: a tag's properties as rows */
// Whether an open tag has rows of its own under it (properties, or links that point at it). The sidebar has them too (0.4.236).
function hasRows(view, tag) {
  return !!(tag.propList.length || tag.pointers?.length || (shown.inherited && inheritedProps(tag).length));
}
// What a property holds, in words: for the kind's icon's tip and the Holds line.
const KINDS = { default: 'text', number: 'number', date: 'date', datetime: 'date and time', checkbox: 'checkbox', url: 'web address' };
const holdsWords = prop => (KINDS[prop.type] || (prop.type === 'node' ? 'a link' : prop.type)) + (prop.choices.length ? ', from a list of choices' : '');
// The kind as the kit's icon, left of the name (0.4.320): a click opens the kind menu.
function kindIconOf(view, prop) {
  const meaning = prop.type === 'node' ? 'node' : prop.choices.length ? 'choice' : prop.type;
  const i = shared.kindIcon(view.doc, meaning, { several: !!prop.many, title: `Holds ${holdsWords(prop)}, ${prop.many ? 'several at once' : 'one at a time'}: click to change` });
  i.dataset.act = 'kind';
  return i;
}
// What a property accepts or offers, after its name: the tags a link accepts (the first few of a wide one, 0.4.236), or
// the choices; a click on them changes them. The kind itself is the icon.
function typeHtml(view, prop) {
  if (prop.type === 'node') {
    const to = prop.accepts.map(id => view.data.tags.get(id)).filter(Boolean);
    const shown = to.slice(0, 4).map(t => tagHtml(t.title)).join(', ') + (to.length > 4 ? ` <span class="rtg-note">· ${to.length - 4} more</span>` : '');
    return `<span class="rtg-tv" data-act="values" title="Change what it accepts">${to.length ? shown : 'any node'}</span>`;
  }
  if (prop.choices.length) return `<span class="rtg-tv" data-act="values" title="Edit the choices">${escapeHtml(prop.choices.slice(0, 4).join(' · ') + (prop.choices.length > 4 ? ' · …' : ''))}</span>`;
  return '';
}
// A property as Logseq has it, with what it holds; one the schema read does not know is read as text.
function propInfoOf(view, prop) {
  return view.data.propInfo?.get(prop.id) || { ...prop, type: 'default', many: false, accepts: [], choices: [], givenBy: [] };
}
function infoButton(view, key, what) {
  const b = shared.quiet(view.doc, { icon: 'help', title: 'What this means', pressed: infoOpen.has(key), cls: 'rtg-i', run: event => { event.stopPropagation(); flip(infoOpen, key); view.draw(); } });
  b.setAttribute('aria-label', 'Explain ' + what);
  b.tabIndex = -1;
  return b;
}
// The quiet word at the end of a line: the place to change what the line says.
function lineWord(view, text, title, run, aim) {
  return shared.quiet(view.doc, { label: text, title, faint: true, cls: 'rtg-make', run: event => { event.stopPropagation(); aim?.(); run(event.currentTarget); } });
}
// A pointer's place as a rect, for a pop-up opened from a right-click.
const rectAt = event => ({ left: event.clientX, top: event.clientY, right: event.clientX, bottom: event.clientY });
const rectOf = node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
// The rows under an open tag: the properties it gets from above (faded), its own, then what points at it.
function propRows(view, tag) {
  const rows = [];
  if (shown.inherited) for (const prop of inheritedProps(tag)) rows.push(...view.propRow(tag, propInfoOf(view, prop), prop.from));
  for (const prop of tag.propList) rows.push(...view.propRow(tag, propInfoOf(view, prop), null));
  if (tag.pointers?.length) rows.push(view.pointerRow(tag));
  return rows;
}
// The pieces of a property's line, shared by its row under a tag and its row in the Properties view: the kind's icon,
// the name, what it accepts or offers.
function propLineParts(view, prop, q, nameProps, onKind) {
  const doc = view.doc;
  const kind = kindIconOf(view, prop);
  kind.addEventListener('click', event => { event.stopPropagation(); onKind(event.currentTarget); });
  const name = el(doc, 'span', { class: 'rtg-pname', ...nameProps });
  const words = el(doc, 'span');
  view.highlight(words, prop.title, q || '');
  name.append(words);
  const type = el(doc, 'span', { class: 'rtg-ptype', html: view.typeHtml(prop), click: event => {
    event.stopPropagation();
    const piece = event.target.closest('[data-act]');
    if (piece?.dataset.act === 'values') { if (prop.type === 'node') view.askAccepts(prop, piece); else view.askChoices(prop, piece); }
    else onKind(piece || event.currentTarget);
  } });
  return [kind, name, type];
}
function propRow(view, tag, prop, from) {
  const doc = view.doc, key = tag.uuid + '|' + prop.id, infoKey = 'prop|' + key, open = propsOpen.has(key);
  const fold = shared.quiet(doc, { icon: 'fold', title: open ? 'Fold' : 'Unfold', cls: 'rtg-fold' + (open ? '' : ' rtg-shut'), run: event => { event.stopPropagation(); flip(propsOpen, key); saveProps(); view.draw(); } });
  fold.tabIndex = -1; fold.setAttribute('aria-label', open ? 'Fold' : 'Unfold');
  const [kind, name, type] = propLineParts(view, prop, view.q, { title: from ? `${prop.title} comes from ${from.title}` : view.passesDown(tag, prop),
    click: event => { event.stopPropagation(); view.propMenu(tag, prop, from, event.currentTarget); } }, at => view.kindMenu(prop, at));
  const line = el(doc, 'div', { class: 'rtg-line' }, kind, name, type);
  if (from) line.append(el(doc, 'span', { class: 'rtg-small' }, 'from ', tagWord(doc, from)));
  else {
    const others = (prop.givenBy || []).filter(t => t.id !== tag.id).length;
    if (others) line.append(el(doc, 'span', { class: 'rtg-small' }, `also on ${plural(others, 'other tag')}`));
    line.append(view.infoButton(infoKey, prop.title));
  }
  const row = el(doc, 'div', { class: 'rtg-row rtg-prow' + (from ? ' rtg-inh' : ''), 'data-key': `p${prop.id}<${from ? from.id : ''}` }, fold, el(doc, 'div', { class: 'rtg-main' }, line));
  row.rtgLive = [tag, prop, from]; // what its clicks read, brought up to date if the row is kept (see morph)
  row.addEventListener('click', event => { if (!event.target.closest('button, input, .rtg-pname, .rf-kind')) fold.click(); });
  const nodes = [row];
  if (open) nodes.push(view.propDetails(tag, prop, from));
  if (!from && infoOpen.has(infoKey)) nodes.push(view.propGuide(tag, prop));
  return nodes;
}
/* A property opened: its lines, each the place to change that thing (0.4.305, the owner: "useful and not just seen …
   creation, editing, conversion … like an actual outline"). Holds (the kind, one or several, how many nodes hold it;
   Change… turns a used property into a new one), Choices (edit, or one made its own child tag), On (the tags that have
   it, each with an × to take it off, and + to add one), what a link accepts, how it reads on the other page, and in
   the Properties view its group. */
function propDetails(view, tag, prop, from, alone) {
  const doc = view.doc, box = el(doc, 'div', { class: 'rtg-pinfo' });
  // The label in the first column, everything else on one line in the second (the pieces wrap there, never under the label).
  const line = (label, ...rest) => box.append(el(doc, 'div', {}, el(doc, 'span', { class: 'rtg-plbl' }, label), el(doc, 'span', { class: 'rtg-pline' }, ...rest)));
  const note = text => el(doc, 'span', { class: 'rtg-note' }, text);
  const aim = () => { if (alone) view.cursorKey = `P${prop.id}`; };
  const button = (text, title, run) => lineWord(view, text, title, run, aim);
  const givers = (prop.givenBy || []).slice().sort(view.data.byTitle);
  const giver = (tag && !tag.builtIn ? tag : null) || givers.find(t => !t.builtIn) || null;
  const used = note('');
  // The nodes that hold it, when asked (0.4.307, the owner: "show the nodes that have the properties"; 0.4.308: "i don't
  // need them present all the time"): show nodes lists the first few with their values, show all the rest, hide nodes
  // folds them away. view.nodesShown keeps each property's state for the session.
  view.nodesShown ||= new Map();
  const state = view.nodesShown.get(prop.id) || '';
  const toggle = el(doc, 'a', { class: 'rtg-pmore rf-faint', href: '#', hidden: true, click: event => { event.preventDefault(); event.stopPropagation(); view.nodesShown.set(prop.id, state ? '' : 'some'); view.draw(); } }, state ? 'hide nodes' : 'show nodes');
  view.useOf(prop).then(n => { used.textContent = n ? `· on ${plural(n, 'node')} ·` : ''; toggle.hidden = !n; }).catch(() => {});
  line('Holds', el(doc, 'span', { class: 'rtg-val' }, holdsWords(prop)), note(prop.many ? '· several at once' : '· one at a time'), used, toggle,
    button('Change …', 'Turn it into links to pages, or open what Logseq lets only itself change', at => view.kindMenu(prop, at, giver)));
  if (state) {
    const nodesBox = el(doc, 'div', { class: 'rtg-pnodes' }, note('…'));
    line('Nodes', nodesBox);
    view.holdersOf(prop).then(list => view.fillNodes(nodesBox, prop, list)).catch(() => { nodesBox.replaceChildren(note('could not be read')); });
  }
  if (prop.choices.length || CHOICE_TYPES.has(prop.type)) line('Choices', el(doc, 'span', { class: prop.choices.length ? 'rtg-val' : 'rtg-note' }, prop.choices.length ? prop.choices.join(' · ') : 'none, anything can be typed'),
    button(prop.choices.length ? 'Edit' : 'Add choices', prop.choices.length ? 'Rename or remove choices; add or reorder them in its settings' : 'Give it a list to pick from', at => view.askChoices(prop, at)),
    prop.choices.length && giver ? button('One its own tag …', `Make a choice its own child tag inside ${giver.title}: the nodes with it move there`, at => view.askChildTag(giver, prop, at)) : null);
  // The tags that have it: each opens its tag, its × takes the property off it (values already filled in stay).
  const on = el(doc, 'span', { class: 'rtg-onlist' });
  for (const t of givers) {
    const chip = el(doc, 'span', { class: 'rtg-onchip' }, tagWord(doc, t, { class: 'rf-tag rtg-ontag', title: `Open ${t.title} (⇧ click: right sidebar)`, click: event => { event.stopPropagation(); openTag(t, event.shiftKey).catch(error => warnOnce('a tag could not be opened', error)); } }));
    if (!t.builtIn) { const x = shared.quiet(doc, { icon: 'remove', title: `Take it off ${t.title}; values already filled in stay`, cls: 'rtg-onx', run: event => { event.stopPropagation(); aim(); view.takePropOff(t, prop); } }); x.setAttribute('aria-label', `Take it off ${t.title}`); chip.append(x); }
    on.append(chip);
  }
  if (!givers.length) on.append(note('no tag yet'));
  line('On', on, button('+ Tag', 'Put it on another tag too', at => view.askAddToTag(prop, at)), givers.some(t => t.kids.length) ? note('and the tags inside') : null);
  if (prop.type === 'node') {
    const to = prop.accepts.map(id => view.data.tags.get(id)).filter(Boolean);
    const inside = new Set(to.flatMap(t => [...below(t)]));
    const accepts = el(doc, 'span', { class: 'rtg-val' });
    if (to.length) to.forEach((t, i) => accepts.append(i ? ', ' : '', tagWord(doc, t))); else accepts.append('any node');
    line('Accepts', accepts, button('Change', 'Choose the tags this link accepts', at => view.askAccepts(prop, at)),
      to.length && inside.size ? note(`and the ${plural(inside.size, 'tag')} inside`) : null);
    const tw = twoWay();
    if (tw) {
      // How it reads on the page it points to: the kit's field on the line; Enter or leaving it keeps the words, Escape puts the old ones back.
      const f = shared.field(doc, { value: tw.backwardsLabel(prop.title), inline: true, title: 'Type how it should read on the page it points to, then press Enter. Empty: back to how it reads by itself.',
        keys: event => { if (event.key === 'Enter' && !event.isComposing) { f.input.blur(); return true; } if (event.key === 'Escape') { f.input.value = tw.backwardsLabel(prop.title); f.input.blur(); return true; } return false; } });
      f.input.classList.add('rtg-words');
      f.input.setAttribute('aria-label', `How ${prop.title} reads on the other page`);
      const save = () => {
        const before = tw.backwardsLabel(prop.title), after = f.input.value.trim();
        if (after === before) return;
        aim();
        tw.setBackwards(prop.title, after);
        view.showToast(after ? `${prop.title} now reads “${after}” on the other page` : `${prop.title} reads as it does by itself on the other page again`, () => tw.setBackwards(prop.title, before));
      };
      f.input.addEventListener('blur', save);
      const shownThere = tw.shownAtOtherEnd(prop.title);
      const turn = button(shownThere ? 'Turn off' : 'Turn on', shownThere
        ? 'Off: the page it points to no longer lists these at the top. The link stays, in Linked references at the bottom and in searches.'
        : 'On: the page it points to lists these at the top again.',
        () => { tw.setShownAtOtherEnd(prop.title, !shownThere); view.showToast(shownThere ? `${prop.title} no longer shows on the other page; the links stay` : `${prop.title} shows on the other page again`, () => tw.setShownAtOtherEnd(prop.title, shownThere)); });
      line('On the other page', f, el(doc, 'span', { class: 'rtg-note', html: iconHtml('to') }), shownThere ? null : el(doc, 'span', { class: 'rtg-off rtg-note' }, 'not shown there'), turn);
    }
  }
  if (alone) {
    const group = groupOf(readGroups(), prop.title);
    line('Group', group ? el(doc, 'span', { class: 'rtg-val' }, group.name) : note('none'), button('Change …', 'Put it in a group of this map; nothing in the graph changes', at => view.askPutInGroup(prop, at)));
  }
  return box;
}
// How many nodes hold a property, and which (read only when they are shown), each once per reading of the tags.
function useOf(view, prop) {
  if (view.useData !== view.data) { view.useData = view.data; view.useCounts = new Map(); }
  if (!view.useCounts.has(prop.ident)) view.useCounts.set(prop.ident, model().propUse(prop.ident).catch(() => null));
  return view.useCounts.get(prop.ident);
}
function holdersOf(view, prop) {
  view.useOf(prop);
  const key = 'nodes|' + prop.ident;
  if (!view.useCounts.has(key)) view.useCounts.set(key, model().propHolders(prop.ident));
  return view.useCounts.get(key);
}
// A node's name in the Nodes line: its first sentence, as the two-way rows name a node (0.4.261); the whole line is its tip.
const ABBREVIATION = /\b(?:dr|mr|mrs|ms|prof|st|vs|no|approx|e\.g|i\.e|etc)\.$/i;
function firstSentence(title) {
  const text = String(title || '').trim();
  for (const m of text.matchAll(/[.!?](?=\s+\S)/g)) if (!ABBREVIATION.test(text.slice(0, m.index + 1))) return text.slice(0, m.index + 1);
  return text;
}
const NODES_SHOWN = 8;
function fillNodes(view, box, prop, list) {
  const doc = view.doc, note = text => el(doc, 'span', { class: 'rtg-note' }, text);
  const all = view.nodesShown.get(prop.id) === 'all', shownList = all ? list : list.slice(0, NODES_SHOWN);
  box.replaceChildren();
  if (!list.length) { box.append(note('none yet')); return; }
  // The words come readable from the model (every link resolved in one question, 0.4.308); only the cut is done here.
  for (const node of shownList) {
    const short = firstSentence(node.title) || '…';
    const link = el(doc, 'a', { class: 'rtg-pnode', href: '#', title: short !== node.title ? node.title : 'Open it (⇧ click: right sidebar)',
      click: event => { event.preventDefault(); event.stopPropagation(); shared.openEntity(node.uuid, event.shiftKey); } }, short);
    box.append(el(doc, 'div', { class: 'rtg-pnoderow' }, link, node.values.length ? note(node.values.join(', ')) : null));
  }
  if (list.length > NODES_SHOWN) box.append(el(doc, 'a', { class: 'rtg-pmore rf-faint', href: '#', click: event => { event.preventDefault(); event.stopPropagation(); view.nodesShown.set(prop.id, all ? 'some' : 'all'); view.fillNodes(box, prop, list); } }, all ? 'show fewer' : `show all ${list.length}`));
}
// Putting a property on another tag (the On line's +): the tags that do not have it yet.
function askAddToTag(view, prop, anchor) {
  const have = new Set((prop.givenBy || []).map(t => t.id));
  const choices = [...view.data.tags.values()].filter(t => !t.builtIn && !have.has(t.id)).sort(view.data.byTitle).map(t => ({ tag: t, path: pathOf(t) }));
  if (!choices.length) { notify(`Every tag already has ${prop.title}`, 'info'); return; }
  view.pickTag(anchor, `Put ${prop.title} on …`, choices, tag => view.addProp(tag, prop));
}
// The explanation under a property, opened with its i: the kit's help paragraph.
function propGuide(view, tag, prop) {
  const doc = view.doc, inside = [...below(tag)].map(id => view.data.tags.get(id)).filter(Boolean);
  const p = html => el(doc, 'p', { html });
  const e = escapeHtml, name = `<b>${e(prop.title)}</b>`, T = tagHtml(tag.title, true), tw = twoWay();
  const paragraphs = [p(`<b>What this means.</b> Every node tagged ${T}${inside.length ? ` (and the ${plural(inside.length, 'tag')} inside it)` : ''} gets an empty ${name} to fill in. Taking it off the tag later only hides it; values already filled in stay.`)];
  if (prop.type === 'node') {
    const to = prop.accepts.map(id => view.data.tags.get(id)).filter(Boolean);
    const there = to.length ? tagHtml(to[0].title, true) : 'other';
    const back = e(tw ? tw.backwardsLabel(prop.title) : prop.title + ' of');
    paragraphs.push(p(`<b>How it looks from each end.</b><span class="rtg-end">On a ${T} node: ${name}: the ${there} node you pick. You fill it in here.</span><span class="rtg-end">On that ${there} node: ${iconHtml('to')} ${back}: every ${T} node that names it. This shows up by itself.</span>`),
      p(`<b>Which way to link.</b> Put the property on the side that has one answer; the other side then lists everything that points at it, with nothing to keep up to date there.`));
    if (!to.length) paragraphs.push(p(`<b>It accepts any node.</b> Choosing a tag for it, in the property’s own settings, keeps the list you pick from short and the links tidy. A tag also lets in the tags inside it.`));
    else paragraphs.push(p(`<b>What it accepts.</b> Nodes tagged ${to.map(t => tagHtml(t.title, true)).join(', ')}, and nodes tagged with any tag inside ${to.length === 1 ? 'it' : 'them'}.`));
    if (tw) paragraphs.push(p(`<b>Turned off on the other page.</b> The ${there} page no longer lists these at the top. The link is not deleted: it still shows in Linked references at the bottom of that page, and searches and queries still find it. Worth it for a busy page, such as a status or a city with hundreds of people.`));
  }
  paragraphs.push(p(prop.many
    ? `<b>Several values.</b> Each value is its own link, so each shows on its own page and can be counted and filtered. Good for lists, such as the people at a meeting. If one value matters most, a separate one-value property says so more clearly.`
    : prop.type === 'node' || prop.choices.length
      ? `<b>One value.</b> Right when there is truly one answer. If you find yourself wanting two, make it a several-values property; typing “A, B” into one value links neither.`
      : prop.type === 'default'
        ? `<b>Plain text.</b> For words you will never look up as a thing, such as a note or a reason. A [[link]] inside the text is fine for mentioning something in a sentence. If the whole answer is always one page (a city, a person), make it a link to a tag instead: you pick from a list, and that page lists it back.`
        : `<b>One value</b> of this kind for each node.`));
  return shared.guide(doc, paragraphs);
}
// "Setting up a new tag", above the tree, opened with its i.
function passesDown(view, tag, prop) {
  const inside = [...below(tag)].map(id => view.data.tags.get(id)).filter(t => t && !t.propList.some(p => p.ident === prop.ident)).length;
  return inside ? `${prop.title}: on ${tag.title} and the ${plural(inside, 'tag')} inside it` : `${prop.title}: on ${tag.title}`;
}

function propMoves(view, tag, prop) { return view.fresh(tag).parents.filter(p => !p.builtIn && !p.propList.some(q => q.ident === prop.ident)); }

function propMenu(view, tag, prop, from, anchor, alone) {
  tag = tag ? view.fresh(tag) : null;
  const items = [{ icon: 'rename', label: 'Rename …', run: () => view.askRenameProp(prop, anchor) }];
  if (prop.type === 'node') items.push({ icon: 'tag', label: 'Change what it accepts …', run: () => view.askAccepts(prop, anchor) });
  if (prop.choices.length || CHOICE_TYPES.has(prop.type)) items.push({ icon: 'choice', label: prop.choices.length ? 'Edit the choices …' : 'Give it choices …', run: () => view.askChoices(prop, anchor) });
  if (prop.choices.length && tag && !tag.builtIn && !alone) items.push({ icon: 'map', label: 'Make a choice its own child tag …', run: () => view.askChildTag(tag, prop, anchor) });
  const linkFrom = tag && !tag.builtIn ? tag : (prop.givenBy || []).find(t => !t.builtIn);
  if (prop.type === 'default' && linkFrom) items.push({ icon: 'link', label: 'Turn into links to pages …', run: () => view.askLinks(linkFrom, prop, anchor) });
  items.push({ icon: 'settings', label: 'Kind of value, one or several …', run: () => view.kindMenu(prop, anchor) });
  // In the by-property view (alone) the property is not under any one tag: taking it off each is offered by name.
  if (alone) {
    items.push({ icon: 'add', label: 'Add to a tag …', run: () => view.askAddToTag(prop, anchor) }, { icon: 'order', label: 'Put in a group …', run: () => view.askPutInGroup(prop, anchor) });
    const givers = (prop.givenBy || []).filter(t => !t.builtIn);
    if (givers.length) items.push('-');
    for (const giver of givers) items.push({ icon: 'remove', label: `Take it off ${giver.title}`, run: () => view.takePropOff(giver, prop) });
    view.showMenu(anchor, prop.title, items);
    return;
  }
  items.push('-');
  if (from) {
    items.push({ icon: 'to', label: `Go to ${from.title}`, run: () => { const at = view.shown.find(i => i.tag.id === from.id); if (at) view.setCursor(at.key); } });
    if (!from.builtIn) items.push({ icon: 'remove', label: `Take it off ${from.title}`, run: () => view.takePropOff(from, prop) });
  } else {
    for (const parent of view.propMoves(tag, prop)) items.push({ icon: 'order', label: `Move up to ${parent.title}`, run: () => view.movePropUp(tag, prop, parent) });
    if (!tag.builtIn) items.push({ icon: 'remove', label: `Take it off ${tag.title}`, run: () => view.takePropOff(tag, prop) });
  }
  view.showMenu(anchor, from ? `${prop.title}, from ${from.title}` : view.passesDown(tag, prop), items);
}

// Renaming a property: it is a page, so Logseq's own rename is asked; the name is read back to be sure.
async function askRenameProp(view, prop, anchor) {
  const typed = await view.askText(anchor, { head: `Rename ${prop.title}`, value: prop.title, select: true, note: 'Everywhere it is used. Enter renames, Esc leaves it.' });
  if (typed == null) return;
  const name = typed.trim(), old = prop.title;
  if (!name || name === old) return;
  const done = await view.act(async () => {
    await model().renamePage(prop.uuid, name);
    const now = await model().titleNow(prop.uuid);
    if (now !== name) throw new Error('Logseq kept the old name');
  }, `${old} could not be renamed`);
  if (!done) return;
  // Its group goes with it (0.4.243): groups keep properties by name.
  const groups = readGroups(), g = groupOf(groups, old);
  if (g) saveGroups(groups.map(x => x === g ? { ...x, props: x.props.map(p => p.toLowerCase() === old.toLowerCase() ? name : p) } : x));
  // Undo takes its group back to the old name too (the audit, 0.4.274).
  view.showToast(`${old} is now ${name}`, async () => {
    await model().renamePage(prop.uuid, old);
    const now = readGroups(), back = groupOf(now, name);
    if (back) saveGroups(now.map(x => x === back ? { ...x, props: x.props.map(p => p.toLowerCase() === name.toLowerCase() ? old : p) } : x));
  });
}
// What a link property accepts: pick a tag to add it or take it away; "Any node" clears the list.
function askAccepts(view, prop, anchor) {
  const now = new Set(view.data.propInfo?.get(prop.id)?.accepts || prop.accepts || []);
  const choices = [{ tag: { id: -1, title: '' }, label: 'Any node (no tag)', path: now.size ? 'clears the list' : 'now' },
    ...[...view.data.tags.values()].filter(t => !t.builtIn || PARENT_BUILT_INS.has(t.ident)).sort((a, b) => (now.has(b.id) - now.has(a.id)) || view.data.byTitle(a, b))
      .map(t => ({ tag: t, chosen: now.has(t.id), path: now.has(t.id) ? '' : pathOf(t) }))];
  view.pickTag(anchor, `${prop.title} accepts …`, choices, async picked => {
    const before = [...now];
    const next = picked.id === -1 ? [] : now.has(picked.id) ? before.filter(id => id !== picked.id) : [...before, picked.id];
    const done = await view.act(() => setAccepts(prop, next), `What ${prop.title} accepts could not be changed`);
    if (done) view.showToast(next.length ? `${prop.title} accepts ${next.map(id => view.data.tags.get(id)?.title || '?').join(', ')}` : `${prop.title} accepts any node`, () => setAccepts(prop, before));
  });
}

// What kind of value a property holds, and one or several. Logseq lets a plugin change those only on the plugin's own
// properties, and lets itself change them only while the property holds nothing; so a property in use is turned into a
// new one from here (0.4.305: the conversions sit in this menu too), and an empty one opens its own settings.
function kindMenu(view, prop, anchor, giver) {
  giver ||= (prop.givenBy || []).find(t => !t.builtIn) || null;
  const items = [];
  if (prop.type === 'node') items.push({ icon: 'tag', label: 'Change what it accepts …', run: () => view.askAccepts(prop, anchor) });
  if (prop.choices.length || CHOICE_TYPES.has(prop.type)) items.push({ icon: 'choice', label: prop.choices.length ? 'Edit the choices …' : 'Give it choices …', run: () => view.askChoices(prop, anchor) });
  if (prop.type === 'default' && giver) items.push({ icon: 'link', label: 'Turn into links to pages …', run: () => view.askLinks(giver, prop, anchor) });
  if (prop.choices.length && giver) items.push({ icon: 'map', label: 'Make a choice its own child tag …', run: () => view.askChildTag(giver, prop, anchor) });
  if (items.length) items.push('-');
  items.push({ icon: 'sidebar', label: `Open ${prop.title}’s settings in the sidebar`, run: () => model().openInSidebar(prop.uuid) },
    { note: 'Another kind of value, or one instead of several: Logseq changes those only in its own settings, and only while the property holds nothing. A property in use is turned into a new one from here; the old one stays as “… (old)” until you delete it.' });
  view.showMenu(anchor, `${prop.title} holds ${holdsWords(prop)}, ${prop.many ? 'several at once' : 'one at a time'}`, items);
}

// The choices of a property, edited in the kit's pop-up: each a field to rename in place with an × to remove it, a field
// for a new one; reordering opens Logseq's own settings.
function askChoices(view, prop, anchor, at, focusAt = 0) {
  const doc = view.doc;
  const where = at || rectOf(anchor);
  view.closeMenu();
  const pop = shared.popup({ doc, at: where, head: `Choices for ${prop.title}`, cls: 'refinement-tags-menu rtg-choices', width: 320, onClose: () => { if (view.menu === pop) view.menu = null; } });
  view.menu = pop;
  pop.el.setAttribute('role', 'dialog');
  pop.el.setAttribute('aria-label', `Choices for ${prop.title}`);
  // The panel is opened again after a change, even when the box the plugin pressed for a new choice closed it (its
  // presses are mousedowns outside the panel, 0.4.309).
  const again = index => { if (view.menu === pop || !view.menu) view.askChoices(propInfoOf(view, prop), anchor, where, index); };
  const run = async (job, failText, said, undo) => {
    const index = doc.activeElement === fresh.input ? 99 : Math.max(0, [...box.querySelectorAll('input')].indexOf(doc.activeElement)); // 99: past the last, the new-choice field
    if (await view.act(job, failText) && said) view.showToast(said, undo);
    again(index);
  };
  const box = el(doc, 'div', { class: 'rf-pop-list rtg-list' }, shared.note(doc, 'Reading the choices …'));
  // A field in the panel: Enter does its job, Escape puts the old words back or closes the panel.
  const fieldFor = (value, placeholder, onEnter, reset) => shared.field(doc, { value, placeholder, inline: true, keys: event => {
    if (event.key === 'Escape') { if (reset && event.currentTarget.value !== reset()) { event.currentTarget.value = reset(); return true; } pop.close(); view.box.focus({ preventScroll: true }); return true; }
    if (event.key === 'Enter' && !event.isComposing) { onEnter(); return true; }
    return false;
  } });
  // A new choice (0.4.309): typed here, made by the plugin through Logseq's own box on the property's page in the
  // right sidebar (makeChoice), since Logseq lets only itself make one; the order is still changed in its settings.
  const fresh = fieldFor('', 'New choice', () => {
    const title = fresh.input.value.trim();
    if (!title) return;
    choicesOf(prop).then(list => {
      if (list.some(c => c.title.toLowerCase() === title.toLowerCase())) { notify(`${prop.title} already has “${title}”`, 'warning'); return; }
      let made = null;
      run(async () => { made = await TM.makeChoice(prop, title); }, `“${title}” could not be made a choice`, `“${title}” is a choice of ${prop.title} now`, () => removeChoice(prop, made));
    }).catch(error => { warnOnce('the choices could not be read', error); });
  });
  fresh.input.classList.add('rtg-newchoice');
  fresh.input.setAttribute('aria-label', 'New choice');
  const reorder = shared.quiet(doc, { icon: 'sidebar', label: 'Reorder in its settings', faint: true, cls: 'rtg-addchoice', run: event => { event.stopPropagation(); pop.close(); model().openInSidebar(prop.uuid); } });
  pop.body.append(box, el(doc, 'div', { class: 'rtg-newrow' }, fresh), reorder, shared.note(doc, `Enter saves a name, or makes the new choice (Logseq’s own box opens on ${prop.title}’s page in the right sidebar for a moment; the plugin fills it in). A choice that nodes still use can be renamed, not removed. The order is changed in Logseq’s own settings.`));
  choicesOf(prop).then(list => {
    if (view.menu !== pop) return;
    box.replaceChildren(...(list.length ? [] : [shared.note(doc, 'No choices yet: anything can be typed.')]));
    list.forEach(choice => {
      const f = fieldFor(choice.title, '', () => {
        const title = f.input.value.trim();
        if (!title || title === choice.title) return;
        if (list.some(c => c !== choice && c.title.toLowerCase() === title.toLowerCase())) { notify(`${prop.title} already has “${title}”`, 'warning'); return; }
        run(() => renameChoice(prop, choice, title), `“${choice.title}” could not be renamed`, `“${choice.title}” is now “${title}” everywhere`,
          () => renameChoice(prop, choice, choice.title)); // a rename can be undone (0.4.194); a removal cannot: Logseq lets only itself make a choice
      }, () => choice.title);
      f.input.setAttribute('aria-label', `Rename ${choice.title}`);
      const x = shared.quiet(doc, { icon: 'remove', title: 'Remove', cls: 'rtg-cb', run: event => { event.stopPropagation(); run(() => removeChoice(prop, choice), `“${choice.title}” was not removed`, `“${choice.title}” is no longer a choice`); } });
      x.setAttribute('aria-label', 'Remove');
      box.append(el(doc, 'div', { class: 'rtg-crow' }, f, x));
    });
    const inputs = box.querySelectorAll('input');
    (focusAt >= inputs.length ? fresh.input : inputs[focusAt] || fresh.input).focus({ preventScroll: true });
  }).catch(error => { warnOnce('the choices could not be read', error); box.replaceChildren(shared.note(doc, 'The choices could not be read.')); });
}

// Making one of a property's choices its own child tag: the choice is picked from a menu, then a plan says
// what will happen, with the new tag's name to change if wanted.
async function askChildTag(view, tag, prop, anchor) {
  tag = view.fresh(tag);
  let list = [];
  try {
    list = await choicesOf(prop);
    const by = await model().choiceCounts(tag, prop);
    for (const choice of list) choice.count = by.get(choice.uuid) || 0;
  } catch (error) { warnOnce('the choices could not be read', error); notify('The choices could not be read: ' + (error?.message || error), 'warning'); return; }
  if (!list.length) { notify(`${prop.title} has no choices yet`, 'warning'); return; }
  view.showMenu(anchor, `Which ${prop.title} becomes its own tag inside ${tag.title}?`, [...list.map(choice => ({
    label: choice.title, right: plural(choice.count, 'node'), run: () => view.confirmChildTag(tag, prop, choice, anchor) })),
    { note: 'Best for a short list of broad kinds that rarely changes. The nodes move to the new tag and keep all their values.' }]);
}
async function confirmChildTag(view, tag, prop, choice, anchor) {
  let plan;
  try { plan = await planChildTag(view.fresh(tag), prop, choice, view.data); }
  catch (error) { warnOnce('a child tag could not be prepared', error); notify('Could not look up what it would change: ' + (error?.message || error), 'warning'); return; }
  const doc = view.doc, T = tag.title, n = plan.nodes.length;
  let check = {};
  const panel = view.planPanel(anchor, { title: `Make “${choice.title}” its own tag inside ${T}?`, go: '', onGo: async () => {
    panel.go.disabled = true; // a second press while the name is checked does nothing
    const name = f.input.value.trim().replace(/^#/, '').trim();
    check = await childTagName(plan, name);
    if (check.problem) { fill(); return; }
    panel.close();
    folded.delete(tag.uuid); saveFolded();
    let result = null;
    const done = await view.act(async () => { result = await runChildTag(plan, name, check.existing); }, `“${choice.title}” could not be made its own tag`);
    if (!done || !result) return;
    const child = view.data.byName.get(name.toLowerCase());
    if (child) { view.cursorTag = child.id; view.cursorKey = null; view.draw(); }
    view.showToast(`${n ? plural(n, 'node') + ' moved to' : 'Made'} ${name}; “${choice.title}” is still a choice of ${prop.title}`, result.undo);
  } });
  const f = shared.field(doc, { value: choice.title, inline: true, title: 'Name of the new tag', input: () => { fill().catch(() => {}); },
    keys: event => { if (event.key === 'Enter' && !event.isComposing) { if (!panel.go.disabled) panel.go.click(); return true; } return false; } });
  f.input.setAttribute('aria-label', 'Name of the new tag');
  const fill = async () => {
    const name = f.input.value.trim().replace(/^#/, '').trim(), C = name || '…';
    check = await childTagName(plan, name);
    const items = [check.existing ? `${C} is already inside ${T} and is used as it is` : `${C} is made inside ${T}, so it gets every property ${T} has`,
      n ? `${plural(n, 'node')} tagged ${T} with ${prop.title} “${choice.title}” get ${C} instead of ${T}. They keep all their values and still count as ${T}`
        : `No node tagged ${T} has ${prop.title} “${choice.title}” yet`,
      ...(n ? [`their ${prop.title} “${choice.title}” is cleared, since ${C} now says it`] : []),
      `“${choice.title}” stays in ${prop.title}’s choices; remove it from there when nothing needs it`];
    panel.lines.replaceChildren(...items.map(text => el(doc, 'li', {}, text)));
    panel.note.textContent = check.problem || 'The faded arrow on its row puts everything back.';
    panel.note.classList.toggle('rtg-warn', !!check.problem);
    panel.go.textContent = check.existing ? `Move to ${C}` : `Make ${C}`;
    panel.go.disabled = !!check.problem;
  };
  panel.body.append(el(doc, 'div', { class: 'rtg-namefield' }, el(doc, 'span', { class: 'rtg-note' }, 'Name'), f), panel.lines, panel.note, panel.buttons);
  await fill().catch(() => {});
  f.input.focus(); f.input.select();
}

// What turning a property into links would change, and the go-ahead.
async function askLinks(view, tag, prop, anchor) {
  view.closeMenu();
  let plan;
  try { plan = await planLinks(view.fresh(tag), prop, view.data); }
  catch (error) { warnOnce('links could not be prepared', error); notify('Could not look up what it would change: ' + (error?.message || error), 'warning'); return; }
  const n = plan.byNode.size;
  if (!n) { notify(`No node has ${prop.title} yet: change its kind in its own settings instead (Kind of value …)`, 'info'); return; }
  if (plan.several) { notify(`Some nodes hold more than one ${prop.title}; that is not handled yet`, 'warning'); return; }
  const doc = view.doc, P = prop.title, T = tag.title;
  // The pages' tag is "… kind" by default (docs/MODELLING.md: the property "… type", the tag on its pages "… kind"):
  // a tag cannot share its name with the property (Logseq hands back the property's page; seen in the app). Since
  // 0.4.305 the tag can be picked from the tags there are (the owner: "allow the choice of new #Tag to be used with
  // pages and name of new property"), and the new property named: with another name the old one keeps its own.
  const panel = view.planPanel(anchor, { title: `Turn ${P} into links to pages?`, go: 'Turn into links', onGo: async () => {
    panel.go.disabled = true;
    await fill().catch(() => {});
    if (panel.go.disabled && panel.note.classList.contains('rtg-warn')) return;
    const name = tagField.input.value.trim().replace(/^#/, '').trim(), newName = nameField.input.value.trim();
    panel.close();
    let result = null;
    const done = await view.act(async () => { result = await runLinks(plan, name, newName); }, `${P} could not be turned into links`);
    if (!done || !result) return;
    const same = newName.toLowerCase() === P.toLowerCase();
    view.showToast(`${newName} now links ${plural(n, 'node')} to ${plural(plan.titles.length, 'page')} tagged ${name}; ${same ? `the old one is “${P} (old)”` : `${P} kept its words`}`, result.undo);
  } });
  const enterGoes = event => { if (event.key === 'Enter' && !event.isComposing) { if (!panel.go.disabled) panel.go.click(); return true; } return false; };
  const tagField = shared.field(doc, { value: `${P} kind`, inline: true, title: 'Tag for the pages', input: () => { fill().catch(() => {}); }, keys: enterGoes });
  const nameField = shared.field(doc, { value: P, inline: true, title: 'Name of the new property', input: () => { fill().catch(() => {}); }, keys: enterGoes });
  tagField.input.setAttribute('aria-label', 'Tag for the pages'); nameField.input.setAttribute('aria-label', 'Name of the new property');
  const pick = shared.quiet(doc, { label: 'Pick …', faint: true, title: 'Pick one of the tags there are; the pages get it', run: event => {
    event.stopPropagation();
    const tags = [...view.data.tags.values()].filter(t => !t.builtIn).sort(view.data.byTitle).map(t => ({ tag: t, path: pathOf(t) }));
    const list = shared.popup({ doc, at: event.currentTarget, head: 'The pages are tagged …', cls: 'refinement-tags-menu', width: 300, field: { placeholder: 'Type to find a tag' },
      rows: q => { const lower = q.trim().toLowerCase(); const hits = tags.filter(c => !lower || c.tag.title.toLowerCase().includes(lower)).slice(0, 60);
        return hits.length ? hits.map(c => ({ html: tagHtml(c.tag.title), right: c.path, run: () => { tagField.input.value = c.tag.title; fill().catch(() => {}); tagField.input.focus(); } })) : [{ note: 'No tag by that name' }]; } });
    void list;
  } });
  const newPages = plan.titles.filter(t => !plan.pages.has(t)).length;
  const first = [...plan.byNode][0];
  const firstName = await model().titleNow(first[0]).catch(() => '') || 'a node';
  const fill = async () => {
    const name = tagField.input.value.trim().replace(/^#/, '').trim(), G = name || '…';
    const newName = nameField.input.value.trim(), N = newName || '…', same = newName.toLowerCase() === P.toLowerCase();
    const tagNamed = plan.data.byName.get(name.toLowerCase());
    const items = [same ? `${P} is renamed “${P} (old)” and keeps its values, so nothing is lost` : `${P} stays as it is, with its words; delete it yourself when ${N} looks right`,
      `a new ${N} is made on ${T}, holding a link to a ${G} page (Logseq’s own new-property box opens in the right sidebar for a moment; the plugin fills it in)`,
      `${plural(plan.titles.length, 'page')}: ${plan.titles.join(', ')}${newPages < plan.titles.length ? ` (${plan.titles.length - newPages} already there, given ${G})` : ''}${tagNamed && !tagNamed.builtIn ? ` (${G} is a tag already: used as it is)` : ''}`,
      `${plural(n, 'node')} get their link, for example ${firstName} → ${first[1][0]}`];
    panel.lines.replaceChildren(...items.map(text => el(doc, 'li', {}, text)));
    const page = name && !tagNamed ? await model().getPage(name).catch(() => null) : null;
    const propNamed = !same && newName ? [...(view.data.propInfo?.values() || [])].find(p => p.title.toLowerCase() === newName.toLowerCase()) : null;
    const namePage = !same && newName && !propNamed ? await model().getPage(newName).catch(() => null) : null;
    const bad = !newName ? 'Give the new property a name'
      : propNamed ? `There is already a property called ${propNamed.title}; pick another name, or keep “${P}”`
      : namePage ? `“${namePage.title || newName}” is already a page; pick another name`
      : !name ? 'Give the tag a name' : name.includes('/') ? 'A tag name cannot have a / in it'
      : tagNamed?.builtIn ? `${name} is one of Logseq’s own tags`
      : name.toLowerCase() === newName.toLowerCase() || name.toLowerCase() === P.toLowerCase() || page ? `“${page?.title || name}” is already ${page?.uuid === prop.uuid || name.toLowerCase() === P.toLowerCase() || name.toLowerCase() === newName.toLowerCase() ? 'the property’s own name' : 'a page that is not a tag'}; pick another name` : '';
    panel.note.textContent = bad || (same ? `When it looks right, delete “${P} (old)” yourself. The faded arrow on its row puts everything back.` : 'The faded arrow on its row puts everything back.');
    panel.note.classList.toggle('rtg-warn', !!bad);
    panel.go.disabled = !!bad;
  };
  panel.body.append(
    el(doc, 'div', { class: 'rtg-namefield' }, el(doc, 'span', { class: 'rtg-note' }, 'New property'), nameField),
    el(doc, 'div', { class: 'rtg-namefield' }, el(doc, 'span', { class: 'rtg-note' }, 'Pages tagged'), tagField, pick), panel.lines, panel.note, panel.buttons);
  await fill().catch(() => {});
  tagField.input.focus(); tagField.input.select();
}
// A tag's description, the line under its name: the kit's question with a taller field.
async function askDescription(view, tag, anchor) {
  const typed = await view.askText(anchor, { head: `What ${tag.title} is for`, value: tag.desc || '', multiline: true, note: 'Enter saves, Shift-Enter starts a new line, Esc leaves it. Empty removes it.' });
  if (typed == null) return;
  const text = typed.trim(), old = tag.desc || '';
  if (text === old) return;
  if (await view.act(() => setDescription(tag, text), `${tag.title}’s description could not be saved`)) view.showToast(text ? `${tag.title} has a new description` : `${tag.title} has no description now`, () => setDescription(tag, old));
}

async function addProp(view, tag, prop) {
  if (await view.act(() => addTagProp(tag, prop), `${prop.title} could not be added`)) view.showToast(`${tag.title} now has ${prop.title}`, () => removeTagProp(tag, prop));
}

async function takePropOff(view, tag, prop) {
  if (await view.act(() => removeTagProp(tag, prop), `${prop.title} could not be taken off`)) view.showToast(`${tag.title} no longer has ${prop.title}; values already filled in stay`, () => addTagProp(tag, prop));
}

async function movePropUp(view, tag, prop, parent) {
  const moved = await view.act(async () => { await addTagProp(parent, prop); await removeTagProp(tag, prop); }, `${prop.title} could not be moved`);
  if (moved) view.showToast(`${prop.title} is now on ${parent.title} and every tag inside it`, async () => { await addTagProp(tag, prop); await removeTagProp(parent, prop); });
}

// A property of your own that is not there yet (typed in the picker under a tag): its kind is asked, then it is made with
// Logseq's own Add property box on the tag's page (makeProperty), as the Properties view's + New property does (0.4.320).
function newProperty(view, tag, name, anchor) { view.askNewPropKind(name, anchor, tag); }

// The kit's list with a search box: the graph's properties that the tag does not have yet.
async function askProperty(view, tag, anchor) {
  tag = view.fresh(tag);
  let all = [];
  try { all = await loadProps(); } catch (error) { warnOnce('properties could not be read', error); }
  const have = new Map([...tag.propList.map(p => [p.ident, null]), ...inheritedProps(tag).map(p => [p.ident, p.from])]);
  view.closeMenu();
  const pop = shared.popup({ doc: view.doc, at: anchor, head: `Add a property to ${tag.title}`, cls: 'refinement-tags-menu', width: 300, field: { placeholder: 'Type to find a property' },
    rows: q => {
      const lower = q.trim().toLowerCase();
      const hits = all.filter(p => !have.has(p.ident) || have.get(p.ident)).filter(p => !lower || p.title.toLowerCase().includes(lower)).slice(0, 60);
      const items = hits.map(p => { const from = have.get(p.ident); return { icon: p.type === 'node' ? 'node' : p.type === 'default' ? 'text' : (shared.KINDS[p.type] || 'text'), label: p.title, right: from ? `already from ${from.title}` : '', run: () => view.addProp(tag, p) }; });
      const exact = all.some(p => p.title.toLowerCase() === lower);
      if (lower && !exact) items.push({ icon: 'add', label: `New property “${q.trim()}” …`, run: () => view.newProperty(tag, q.trim(), anchor) });
      if (!items.length) items.push({ note: 'Type the name of a property' });
      return items;
    }, onClose: () => { if (view.menu === pop) view.menu = null; view.box.focus({ preventScroll: true }); } });
  view.menu = pop;
}

function drawProps(view, pass, sections) {
  pass.section = 'props';
  const doc = view.doc;
  const all = [...(view.data.propInfo?.values() || [])].filter(prop => prop.title).sort((a, b) => a.title.localeCompare(b.title));
  const fits = prop => !pass.q || prop.title.toLowerCase().includes(pass.q) || (prop.givenBy || []).some(t => t.title.toLowerCase().includes(pass.q));
  const groups = readGroups(), grouped = new Set();
  groups.forEach((group, i) => {
    const members = group.props.map(name => all.find(p => p.title.toLowerCase() === name.toLowerCase())).filter(Boolean);
    for (const p of members) grouped.add(p);
    const shownProps = members.filter(fits);
    if (pass.q && !shownProps.length && !group.name.toLowerCase().includes(pass.q)) return;
    const shut = groupsShut.has(group.name.toLowerCase()) && !pass.q;
    sections.push(el(doc, 'div', { class: 'rtg-section rtg-pgroup', 'data-key': `group-${i}` }, view.groupHeading(group, i, groups.length, members.length, shut),
      ...(shut ? [] : shownProps.length ? shownProps.flatMap(prop => propTopRow(view, pass, prop)) : [el(doc, 'div', { class: 'rtg-empty rtg-gempty' }, 'Drag a property onto the name, or use Put in a group in its menu.')])));
  });
  const rest = all.filter(prop => !grouped.has(prop) && fits(prop));
  const onTags = rest.filter(prop => prop.givenBy?.length), loose = rest.filter(prop => !prop.givenBy?.length);
  const restHead = groups.length ? [view.groupHeading(null)] : [];
  if (onTags.length || groups.length) sections.push(el(doc, 'div', { class: 'rtg-section rtg-top', 'data-key': 'props' }, ...restHead, ...onTags.flatMap(prop => propTopRow(view, pass, prop))));
  if (loose.length) sections.push(el(doc, 'div', { class: 'rtg-section', 'data-key': 'props-loose' }, el(doc, 'h3', { class: 'rtg-group' }, 'On no tag'), ...loose.flatMap(prop => propTopRow(view, pass, prop))));
  if (!grouped.size && !onTags.length && !loose.length) sections.push(el(doc, 'div', { class: 'rtg-empty' }, pass.q ? 'No property by that name.' : 'No properties yet.'));
  if (!pass.q) sections.push(el(doc, 'div', { class: 'rtg-newroot rtg-newprops', 'data-key': 'newgroup' },
    view.addingProp ? view.newPropRow() : shared.quiet(doc, { label: '+ New property', faint: true, cls: 'rtg-make', title: 'Make a property: its name, what it holds, and the tag it goes on', run: () => view.startNewProp() }),
    shared.quiet(doc, { label: '+ New group', faint: true, cls: 'rtg-make', title: 'Make a group of properties, for your own order; nothing in the graph changes', run: event => view.askGroupName(null, event.currentTarget) })));
}
/* + New property (0.4.305): a line to type the name in, then what it holds, a link's tag, and the tag it goes on, each
   a list under the line; the property is made with Logseq's own Add property box on that tag's page in the right
   sidebar (makeProperty), since Logseq lets only itself make a property of yours, and a link is given what it accepts. */
const NEW_KINDS = [['default', 'Text', '', 'text'], ['number', 'Number', '', 'number'], ['date', 'Date', '', 'date'], ['checkbox', 'Checkbox', 'yes or no', 'yesNo'], ['url', 'Web address', '', 'web'], ['node', 'Link to nodes', 'picked from a tag', 'node']];
function startNewProp(view) { view.closeMenu(); view.addingProp = { name: '' }; view.draw(); }
function stopNewProp(view, focus) { view.addingProp = null; view.draw(); if (focus) view.box.focus({ preventScroll: true }); }
function newPropRow(view) {
  const f = shared.field(view.doc, { value: view.addingProp.name, placeholder: 'New property', inline: true, title: 'Name of the new property',
    keys: event => {
      if (event.key === 'Enter' && !event.isComposing) { const name = f.input.value.trim(); if (!name) { stopNewProp(view); return true; } view.addingProp.name = name; view.askNewPropKind(name, f); return true; }
      if (event.key === 'Escape') { stopNewProp(view, true); return true; }
      return false;
    }, input: value => { if (view.addingProp) view.addingProp.name = value; } });
  f.input.setAttribute('aria-label', 'Name of the new property');
  f.input.addEventListener('blur', () => setTimeout(() => { if (view.addingProp && !f.input.value.trim() && !view.menu && view.doc.activeElement !== f.input) stopNewProp(view); }, 150));
  setTimeout(() => f.input.focus({ preventScroll: true })); // redrawn with every draw while open; a fold higher up must not scroll here
  return el(view.doc, 'div', { class: 'rtg-addrow rtg-addprop' }, f);
}
// What the new property holds; with a tag given (from the picker under a tag) it is made on that tag at once.
function askNewPropKind(view, name, anchor, tag) {
  const clash = [...(view.data.propInfo?.values() || [])].find(p => p.title.toLowerCase() === name.toLowerCase());
  if (clash) { notify(`There is already a property called ${clash.title}: put that one on a tag with + Tag on its On line`, 'warning'); return; }
  view.showMenu(anchor, `${name} holds …`, NEW_KINDS.map(([kind, label, hint, icon]) => ({ icon, label, right: hint,
    run: () => kind === 'node' ? view.askNewPropAccepts(name, anchor, tag) : tag ? view.makeNewProp(name, kind, [], tag) : view.askNewPropTag(name, kind, [], anchor) })));
}
function askNewPropAccepts(view, name, anchor, tag) {
  const choices = [{ tag: { id: -1, title: '' }, label: 'Any node (no tag)', path: '' },
    ...[...view.data.tags.values()].filter(t => !t.builtIn || PARENT_BUILT_INS.has(t.ident)).sort(view.data.byTitle).map(t => ({ tag: t, path: pathOf(t) }))];
  view.pickTag(anchor, `${name} accepts …`, choices, picked => { const accepts = picked.id === -1 ? [] : [picked.id]; if (tag) view.makeNewProp(name, 'node', accepts, tag); else view.askNewPropTag(name, 'node', accepts, anchor); });
}
function askNewPropTag(view, name, kind, accepts, anchor) {
  const tags = [...view.data.tags.values()].filter(t => !t.builtIn).sort(view.data.byTitle);
  if (!tags.length) { notify('Make a tag first: a property goes on a tag', 'warning'); return; }
  view.pickTag(anchor, `Put ${name} on which tag?`, tags.map(t => ({ tag: t, path: pathOf(t) })), tag => view.makeNewProp(name, kind, accepts, tag));
}
async function makeNewProp(view, name, kind, accepts, tag) {
  view.addingProp = null;
  let made = null;
  const done = await view.act(async () => { made = await TM.makeProperty(tag, name, kind); }, `${name} could not be made`); // looked up when called, so a test can stand in for Logseq's box
  if (!done || !made) { view.draw(); return; }
  // The property is on the tag now whatever happens next: what it accepts is a second step with its own message.
  if (accepts.length) await view.act(() => setAccepts(made, accepts), `${name} is made, but what it accepts could not be set (it accepts any node)`);
  propsOpen.add(`P${made.id}`); saveProps();
  view.cursorKey = `P${made.id}`;
  view.draw();
  view.showToast(`Made ${name} on ${tag.title}`, async () => {
    // Values filled in since would go with it (second reading): then it stays, and the message says why.
    const used = await model().propUse(made.ident);
    if (used) throw new Error(`${name} is on ${plural(used, 'node')} now; take it off them first`);
    await removeTagProp(tag, made).catch(() => {});
    await model().deletePage(made.uuid);
  });
}
// A group's heading (group null: "Not in a group"): click to fold, its name opens its menu, a property dropped on it goes in.
function groupHeading(view, group, i, count, members, shut) {
  const doc = view.doc;
  const head = el(doc, 'h3', { class: 'rtg-group rtg-ghead' + (group ? '' : ' rtg-gnone'), title: group ? 'Click to fold; right-click or ⋯ for the group’s menu; drop a property here to put it in' : 'Drop a property here to take it out of its group' });
  if (group) {
    const fold = shared.quiet(doc, { icon: 'fold', cls: 'rtg-fold' + (shut ? ' rtg-shut' : ''), title: shut ? 'Unfold' : 'Fold' });
    fold.tabIndex = -1; fold.setAttribute('aria-label', shut ? 'Unfold' : 'Fold');
    head.append(fold, el(doc, 'span', {}, group.name), el(doc, 'span', { class: 'rtg-small' }, String(members)),
      shared.quiet(doc, { icon: 'more', cls: 'rtg-make rtg-gmenu', title: 'The group’s menu', run: event => { event.stopPropagation(); view.groupMenu(group, i, count, event.currentTarget); } }));
    head.addEventListener('click', event => { if (event.target.closest('.rtg-gmenu')) return; const key = group.name.toLowerCase(); if (groupsShut.has(key)) groupsShut.delete(key); else groupsShut.add(key); saveGroupsShut(); view.draw(); });
    head.addEventListener('contextmenu', event => { event.preventDefault(); event.stopPropagation(); view.groupMenu(group, i, count, rectAt(event)); });
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
  const items = [{ icon: 'rename', label: 'Rename …', run: () => view.askGroupName(group, anchor) }];
  if (i > 0) items.push({ icon: 'order', label: 'Move up', run: () => move(-1) });
  if (i < count - 1) items.push({ icon: 'order', label: 'Move down', run: () => move(1) });
  items.push('-', { icon: 'remove', label: 'Remove the group (its properties stay)', run: () => { const before = readGroups(); saveGroups(before.filter((_, k) => k !== i)); view.showToast(`${group.name} removed; its properties are in no group now`, async () => saveGroups(before)); } });
  view.showMenu(anchor, group.name, items);
}
// A name for a new group, or a new name for one: the kit's question; Enter keeps it, Esc leaves it.
async function askGroupName(view, group, anchor, then) {
  const typed = await view.askText(anchor, { head: group ? `Rename ${group.name}` : 'New group of properties', value: group?.name || '', placeholder: 'People and places', select: true, note: 'Only for the order in this map; nothing in the graph changes. Enter to keep, Esc to leave it.' });
  if (typed == null) return;
  const name = typed.trim().replace(/[;:]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) return;
  const before = readGroups();
  const clash = before.find(g => g.name.toLowerCase() === name.toLowerCase() && g.name !== group?.name);
  if (clash) { notify(`There is already a group called ${clash.name}`, 'warning'); return; }
  if (group) { saveGroups(before.map(g => g.name === group.name ? { ...g, name } : g)); view.showToast(`${group.name} is now ${name}`, async () => saveGroups(before)); }
  else { saveGroups([...before, { name, props: [] }]); then?.(name); if (!then) view.showToast(`Made the group ${name}`, async () => saveGroups(before)); }
}
function askPutInGroup(view, prop, anchor) {
  const groups = readGroups(), now = groupOf(groups, prop.title);
  const items = groups.filter(g => g !== now).map(g => ({ label: g.name, run: () => view.putInGroup(prop, g.name) }));
  items.push({ icon: 'add', label: 'New group …', run: () => view.askGroupName(null, anchor, name => view.putInGroup(prop, name)) });
  if (now) items.push('-', { icon: 'remove', label: `Take it out of ${now.name}`, run: () => view.putInGroup(prop, null) });
  view.showMenu(anchor, `Put ${prop.title} in a group`, items);
}
function propTopRow(view, pass, prop) {
  const doc = view.doc, key = `P${prop.id}`, open = propsOpen.has(key);
  const tag = prop.givenBy?.[0] || null;
  const fold = shared.quiet(doc, { icon: 'fold', cls: 'rtg-fold' + (open ? '' : ' rtg-shut'), title: open ? 'Fold' : 'Unfold', run: event => { event.stopPropagation(); flip(propsOpen, key); saveProps(); view.draw(); } });
  fold.tabIndex = -1; fold.setAttribute('aria-label', open ? 'Fold' : 'Unfold');
  const aim = () => { view.cursorKey = key; }; // the Undo arrow of a change made here sits on this row (0.4.305)
  const [kind, name, type] = propLineParts(view, prop, pass.q, { title: 'Its menu; double-click to rename',
    click: event => { event.stopPropagation(); aim(); view.propMenu(tag, prop, null, event.currentTarget, true); },
    dblclick: event => { event.stopPropagation(); aim(); view.askRenameProp(prop, event.currentTarget); } }, at => { aim(); view.kindMenu(prop, at); });
  const line = el(doc, 'div', { class: 'rtg-line' }, kind, name, type);
  if (prop.givenBy?.length) {
    const on = el(doc, 'span', { class: 'rtg-small rtg-on' }, 'on ');
    prop.givenBy.slice().sort(view.data.byTitle).forEach((t, i) => {
      const link = shared.tag(doc, '', { class: 'rf-tag rtg-ontag', title: `Open ${t.title} (⇧ click: right sidebar)`, click: event => { event.stopPropagation(); openTag(t, event.shiftKey).catch(error => warnOnce('a tag could not be opened', error)); } });
      view.highlight(link, t.title, pass.q);
      on.append(i ? ', ' : '', link);
    });
    line.append(on);
  }
  const row = el(doc, 'div', { class: 'rtg-row rtg-prow rtg-ptop', 'data-key': key, draggable: 'true' }, fold, el(doc, 'div', { class: 'rtg-main' }, line));
  row.addEventListener('dragstart', event => { view.draggingProp = prop; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', prop.title); event.stopPropagation(); });
  row.addEventListener('dragend', () => { view.draggingProp = null; for (const h of doc.querySelectorAll('.rtg-gdrop')) h.classList.remove('rtg-gdrop'); });
  row.addEventListener('click', event => { if (!event.target.closest('button, input, .rtg-pname, .rtg-ontag, .rf-kind')) fold.click(); });
  row.addEventListener('contextmenu', event => { event.preventDefault(); event.stopPropagation(); aim(); view.propMenu(tag, prop, null, rectAt(event), true); });
  const nodes = [row];
  if (open) nodes.push(view.propDetails(tag, prop, null, true));
  return nodes;
}

Object.assign(TM, { KINDS, NEW_KINDS, addProp, askAccepts, askAddToTag, askChildTag, askChoices, askDescription, askGroupName, askLinks, askNewPropAccepts, askNewPropKind, askNewPropTag, askProperty, askPutInGroup, askRenameProp, confirmChildTag, drawProps, fillNodes, groupHeading, groupMenu, hasRows, holdersOf, infoButton, kindMenu, makeNewProp, movePropUp, newPropRow, newProperty, passesDown, propDetails, propGuide, propInfoOf, propMenu, propMoves, propRow, propRows, propTopRow, putInGroup, startNewProp, takePropOff, typeHtml, useOf });
TM.propsLoaded = true;
(window.refinementParts ||= []).push({ name: 'tag map: properties', schema: [], start() {}, stop: runUnloadTasks });
})();
