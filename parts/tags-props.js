/* Loaded by main.js after parts/tags-graph.js and before parts/tags.js. Kept in its own scope; it draws nothing by itself. */
(() => {
/* The tag map, piece 2 of 3 (split out of parts/tags.js at 0.4.295): the property map. A tag's properties as rows
   under it, what each holds and accepts, the menus and boxes that change them (rename, accepts, choices, a choice
   made its own child tag, turned into links, a description, adding or taking a property off), and the Properties
   view with its groups. Its functions are the tree's view methods (view.propRows …), added by parts/tags.js.
   The pieces share one object, window.refinementTagMap (TM): parts/tags-graph.js and parts/tags-props.js put there what
   they have, loaded in that order before parts/tags.js, and each piece takes what it uses from there as it loads.
   parts/tags.js starts the map only when both are loaded, and says so otherwise; the other two alone do nothing. */
const shared = window.refinementShared;
const { host } = shared;
const { warnOnce, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (tag tree): ' });
const TM = window.refinementTagMap ||= {};
const { CHEVRON, CHOICE_TYPES, PARENT_BUILT_INS, addTagProp, anchoredPanel, below, childTagName, choicesOf, el, escapeHtml, flip, folded, groupOf, groupsShut, infoOpen, inheritedProps, keepKeys, loadProps, model, openTag, pathOf, placeInGroup, planChildTag, planLinks, plural, propsOpen, readGroups, removeChoice, removeTagProp, renameChoice, runChildTag, runLinks, saveFolded, saveGroups, saveGroupsShut, saveProps, setAccepts, setDescription, shown, twoWay } = TM;
/* Tag properties */
/* The map: a tag's properties as rows */
// Whether an open tag has rows of its own under it (properties, or links that point at it). The sidebar has them too (0.4.236).
function hasRows(view, tag) {
  return !!(tag.propList.length || tag.pointers?.length || (shown.inherited && inheritedProps(tag).length));
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
  if (shown.inherited) for (const prop of inheritedProps(tag)) rows.push(...view.propRow(tag, propInfoOf(view, prop), prop.from));
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
  if (prop.type === 'default' && linkFrom) items.push({ html: 'Turn into links to pages …', run: () => view.askLinks(linkFrom, prop, anchor) });
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
      // Undo takes its group back to the old name too (the audit, 0.4.274).
      view.showToast(`${old} is now ${name}`, async () => {
        await logseq.Editor.renamePage(prop.uuid, old);
        const now = readGroups(), back = groupOf(now, name);
        if (back) saveGroups(now.map(x => x === back ? { ...x, props: x.props.map(p => p.toLowerCase() === name.toLowerCase() ? old : p) } : x));
      });
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
    html: `${escapeHtml(choice.title)}<kbd>${plural(choice.count, 'node')}</kbd>`, run: () => view.confirmChildTag(tag, prop, choice, anchor) })));
  view.menu.append(el(view.doc, 'div', { class: 'rtg-mnote rf-pop-note' }, `Best for a short list of broad kinds that rarely changes. The nodes move to the new tag and keep all their values.`));
  view.placeMenu(anchor);
}
async function confirmChildTag(view, tag, prop, choice, anchor) {
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
    note.textContent = check.problem || 'The faded arrow on its row puts everything back.';
    note.classList.toggle('rtg-warn', !!check.problem);
    go.textContent = check.existing ? `Move to ${C}` : `Make ${C}`;
    go.disabled = !!check.problem;
  };
  const panel = el(doc, 'div', { class: 'rf-dialog', role: 'dialog', 'aria-label': 'Make a child tag' },
    el(doc, 'h2', {}, `Make “${choice.title}” its own tag inside ${T}?`),
    el(doc, 'div', { class: 'rtg-namefield' }, el(doc, 'span', { class: 'rtg-note' }, 'Name'), input), lines, note,
    el(doc, 'div', { class: 'rtg-btns rf-btns' }, cancel, go));
  panel.classList.add('refinement-tags-dialog');
  const close = anchoredPanel(view, panel, anchor, event => { if (event.key === 'Enter' && event.target === input && !event.isComposing) { event.preventDefault(); if (!go.disabled) go.click(); } });
  cancel.addEventListener('click', close);
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
  await fill().catch(() => {});
  input.focus(); input.select();
}

// What turning a property into links would change, and the go-ahead.
async function askLinks(view, tag, prop, anchor) {
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
    note.textContent = bad || `When it looks right, delete “${P} (old)” yourself. The faded arrow on its row puts everything back.`;
    note.classList.toggle('rtg-warn', !!bad);
    go.disabled = !!bad;
  };
  const panel = el(doc, 'div', { class: 'rf-dialog', role: 'dialog', 'aria-label': 'Turn into links' },
    el(doc, 'h2', {}, `Turn ${P} into links to pages?`),
    el(doc, 'div', { class: 'rtg-namefield' }, el(doc, 'span', { class: 'rtg-note' }, 'Pages tagged'), input), lines, note,
    el(doc, 'div', { class: 'rtg-btns rf-btns' }, cancel, go));
  panel.classList.add('refinement-tags-dialog');
  const close = anchoredPanel(view, panel, anchor, event => { if (event.key === 'Enter' && event.target === input && !event.isComposing) { event.preventDefault(); if (!go.disabled) go.click(); } });
  cancel.addEventListener('click', close);
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
    view.showToast(`${P} now links ${plural(n, 'node')} to ${plural(plan.titles.length, 'page')} tagged #${name}; the old one is “${P} (old)”`, result.undo);
  });
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


Object.assign(TM, { KINDS, addProp, askAccepts, askChildTag, askChoices, askDescription, askGroupName, askLinks, askProperty, askPutInGroup, askRenameProp, confirmChildTag, drawProps, groupHeading, groupMenu, hasRows, infoButton, kindMenu, movePropUp, newProperty, passesDown, pointerRow, propDetails, propGuide, propInfoOf, propMenu, propMoves, propRow, propRows, propTopRow, putInGroup, takePropOff, typeHtml });
TM.propsLoaded = true;
(window.refinementParts ||= []).push({ name: 'tag map: properties', schema: [], start() {}, stop: runUnloadTasks });
})();
