/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Settings window: a window listing every setting of the plugin, opened from “Refinements settings”
   in Logseq's three-dots menu (top right) or from the command palette. Sections are listed on the
   left under umbrella groups (0.4.129: Reading a page, Writing a record, Around the page, Tools,
   Paused; the tag tree moved from Paused to Tools in 0.4.155), each with a numbered picture of where its sections work; the search box looks through every
   setting's name and explanation.
   Logseq 2.0.2 gives plugins no way to add to that menu, so the item is added when the menu opens:
   the plugin notices the click on the three-dots button and puts its item under “Plugins”.
   On the kit since 0.4.317 (docs/LAYERS.md; the views page): the one real window, the browser's own dialog dressed
   by the kit (Escape, the keyboard and the backdrop are the browser's); the find box is the kit's field with its
   icon and key hint; the sections on the left are quiet words with their icons; a row is a title, a quiet line and
   the control at the right: on or off is a tick box, a choice of two or three is quiet words with a hairline between
   them, a list of names is words with a × on hover and a field to add to it (the graph's tags offered in the kit's
   list pop-up as you type), text is an underline; Reset is a faint word that shows when a value differs from its
   default; the shortcuts are a group of their own, read from the one register, so every key the plugin listens for
   is changed here. Nothing of the window's own is drawn but its layout; no colour of its own; no logseq.* call:
   the settings, the schema, the register, the graph's tags and the reload come through the core. */

const shared = window.refinementShared;
const { host, el, icon, quiet, field, tick, chip, note } = shared;
const { warnOnce, onUnload, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (settings): ', leaves: { elements: 'dialog.refinement-settings, .refinement-settings-menu-item' } });
const take = (core, names) => shared.take(core, names, warnOnce);
let sendStyle, settingsNow, settingsSchema, saveSettings, openLogseqSettings, reloadPlugin, pluginVersion, commands, tagTitles;
const ITEM_CLASS = 'refinement-settings-menu-item';
const COPY = String(Date.now()); // tells this copy's menu item from one left by an earlier copy

/* The window's own layout only (0.4.317): the kit draws the dialog, the field, the tick box, the quiet words, the
   chips and the notes. Greys from the kit's tokens. */
const css = `
dialog.refinement-settings { display: none; width: min(800px, 94vw); height: min(640px, 86vh); max-height: 86vh; overflow: hidden; }
dialog.refinement-settings[open] { display: flex; flex-direction: column; }
.rf-settings-head { display: flex; align-items: center; gap: 10px; padding: 8px 10px 8px 14px; border-bottom: 1px solid var(--rf-hair); }
.rf-settings-head h2 { margin: 0; width: 170px; flex: none; font-size: 15px; font-weight: 600; }
.rf-settings-head .rf-field { flex: 1; }
.rf-settings-main { flex: 1; display: flex; min-height: 0; }
.rf-settings-nav { width: 190px; flex: none; overflow-y: auto; padding: 8px 6px; border-right: 1px solid var(--rf-hair); display: flex; flex-direction: column; gap: 1px; }
.rf-settings-nav .rf-quiet { justify-content: flex-start; width: 100%; height: 26px; text-align: left; }
.rf-settings-nav .rf-quiet .rf-note { margin-left: auto; padding: 0; }
.rf-settings-nav .rf-quiet > .ti { color: var(--rf-faint); }
.rf-settings-group { margin: 12px 0 2px; padding: 0 8px; font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--rf-faint); }
.rf-settings-group:first-child { margin-top: 0; }
.rf-settings-nav hr { width: 100%; margin: 8px 0; border: 0; border-top: 1px solid var(--rf-hair); }
.rf-settings.rf-searching .rf-settings-nav .rf-quiet { color: var(--rf-faint); }
.rf-settings.rf-searching .rf-settings-nav .rf-quiet.rf-has-hits { color: var(--rf-quiet); }
.rf-settings-body { flex: 1; overflow-y: auto; padding: 4px 16px 16px; }
.rf-settings-body section { padding-top: 16px; }
.rf-settings-body section h3 { margin: 0; font-size: 15px; font-weight: 600; }
.rf-settings.rf-listing section h3 { font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: var(--rf-faint); }
.rf-settings.rf-listing .rf-settings-note { display: none; }
.rf-settings-rows { margin-top: 8px; }
.rf-settings-row { display: flex; align-items: flex-start; gap: 16px; padding: 9px 0; border-top: 1px solid var(--rf-hair); }
.rf-settings-row:first-child { border-top: 0; }
.rf-settings-text { flex: 1; min-width: 0; }
.rf-settings-title { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; font-weight: 500; }
.rf-settings-title .rf-quiet { height: 20px; font-size: 12px; }
.rf-settings-changed::before { content: ''; display: inline-block; width: 6px; height: 6px; margin: 0 7px 2px 0; border-radius: 50%; background: var(--rf-line); vertical-align: middle; }
.rf-settings-desc { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.rf-settings-desc.rf-open, .rf-settings.rf-searching .rf-settings-desc { display: block; -webkit-line-clamp: unset; }
.rf-settings-more { height: 20px; font-size: 12px; margin-top: 1px; }
.rf-settings.rf-searching .rf-settings-more { display: none; }
.rf-settings-hit { border-radius: 2px; background: var(--rf-wash); box-shadow: inset 0 -1px var(--rf-line); }
.rf-settings-control { flex: none; display: flex; align-items: center; gap: 10px; padding-top: 2px; }
.rf-settings-control .rf-field { width: 200px; }
.rf-settings-list { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; margin-top: 6px; }
.rf-settings-list .rf-field { min-width: 120px; flex: 1; }
.rf-settings-empty { padding: 40px 0; text-align: center; color: var(--rf-faint); }
.rf-settings-foot { display: flex; align-items: center; gap: 10px; padding: 6px 10px 6px 14px; border-top: 1px solid var(--rf-hair); }
.rf-settings-foot .rf-settings-status { flex: 1; }
.rf-settings-status.rf-needs-reload { color: inherit; }
dialog.refinement-settings [hidden] { display: none !important; }
/* The group's picture (0.4.129): a zone per section, numbered like the list beside it. The window's own layout; the
   words of the zones (.m, .t, .h, u, .mono, .ind, .row, .b) are quiet marks in the kit's greys, no colour. */
.rf-settings-card { margin-top: 16px; padding: 12px 14px 14px; border: 1px solid var(--rf-hair); border-radius: 8px; }
.rf-settings-card-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.rf-settings-card-title { font-size: 15px; font-weight: 600; }
.rf-settings-card-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(150px, 205px); gap: 14px; align-items: start; }
.rs-art { display: grid; gap: 6px; min-width: 0; font-size: 12px; line-height: 1.45; }
.rs-zone { position: relative; min-width: 0; padding: 6px 8px 6px 30px; border: 1px solid var(--rf-hair); border-radius: 6px; cursor: pointer; overflow: hidden; }
.rs-zone::before, .rs-legend .rs-n { content: attr(data-n); display: grid; place-items: center; width: 16px; height: 16px; border: 1px solid var(--rf-line); border-radius: 50%; font-size: 10px; font-weight: 600; line-height: 1; color: var(--rf-quiet); }
.rs-zone::before { position: absolute; left: 7px; top: 7px; }
.rs-art.rs-focus .rs-zone { opacity: .45; }
.rs-art.rs-focus .rs-zone[aria-current], .rs-zone:hover { opacity: 1 !important; border-color: var(--rf-line); }
.rs-zone.rs-off > * { opacity: .45; text-decoration: line-through; text-decoration-color: var(--rf-line); }
.rs-zone.rs-off { padding-right: 56px; }
.rs-zone.rs-off::after { content: 'paused'; position: absolute; right: 8px; top: 7px; font-size: 10px; color: var(--rf-faint); }
.rs-art .win { display: grid; grid-template-columns: 1fr 1.5fr 1fr; gap: 6px; }
.rs-art .win .rs-zone { padding-top: 26px; padding-left: 8px; }
.rs-art .m { color: var(--rf-faint); }
.rs-art .t { font-size: 15px; font-weight: 600; line-height: 1.25; }
.rs-art .h { font-weight: 600; }
.rs-art .b { display: inline-block; width: 4px; height: 4px; margin: 0 6px 2px 0; border-radius: 50%; background: var(--rf-line); vertical-align: middle; }
.rs-art .row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.rs-art .ind { padding-left: 10px; }
.rs-art u { text-decoration: underline; text-decoration-color: var(--rf-line); text-underline-offset: 2px; }
.rs-art .mono { font-family: var(--rf-mono); font-size: 11px; }
.rs-art .dbox { padding: 0 3px; border-radius: 3px; background: var(--rf-wash); }
.rs-art .pencil { font-style: italic; color: var(--rf-faint); text-decoration: underline dotted; text-underline-offset: 2px; }
.rs-art .cap { display: inline-block; padding: 0 3px; border-bottom: 1px solid var(--rf-line); font-family: var(--rf-mono); font-size: 10px; line-height: 1.3; color: var(--rf-quiet); }
.rs-art .caret { display: inline-block; width: 1px; height: 1em; margin-left: 1px; background: currentColor; vertical-align: -2px; }
.rs-art .menu { display: inline-block; margin: 3px 0 0 10px; padding: 2px 0; border: 1px solid var(--rf-hair); border-radius: 5px; font-size: 11px; }
.rs-art .menu .mrow { display: flex; gap: 10px; justify-content: space-between; padding: 0 8px; }
.rs-art .menu .mrow.sel { background: var(--rf-wash); }
.rs-art .box { padding: 1px 6px; border-bottom: 1px solid var(--rf-line); margin-bottom: 3px; }
.rs-art .tb { margin-top: 4px; padding-top: 3px; border-top: 1px solid var(--rf-hair); color: var(--rf-faint); font-size: 11px; }
.rs-art .doc { margin: 4px 0 0 10px; padding: 4px 8px; border: 1px solid var(--rf-hair); border-radius: 4px; }
.rs-legend { display: grid; gap: 2px; align-content: start; }
.rs-legend button { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 4px; align-items: start; padding: 5px 6px; border: 0; border-radius: 4px; background: none; color: var(--rf-quiet); font: inherit; text-align: left; cursor: pointer; }
.rs-legend button:hover, .rs-legend button[aria-current] { color: inherit; background: var(--rf-wash); }
.rs-legend .rs-n { margin-top: 1px; }
.rs-legend b { display: block; font-weight: 600; font-size: 13px; }
.rs-legend .rs-d { display: block; font-size: 12px; line-height: 1.35; color: var(--rf-faint); }
.rs-legend button.rs-off b::after { content: ' · paused'; font-weight: 400; color: var(--rf-faint); }
.rf-settings-card.rf-settings-card-focus .rf-settings-card-note, .rf-settings-card.rf-settings-card-focus .rs-legend button:not([aria-current]) .rs-d { display: none; }
.rf-settings-row.rf-settings-paused > .rf-settings-text, .rf-settings-row.rf-settings-paused > .rf-settings-control { opacity: .45; }
/* A small picture of what a look setting changes (0.4.173), beside its tick box; only a setting with a preview has one. */
.rs-pv { width: 172px; height: 54px; box-sizing: border-box; overflow: hidden; padding: 5px 8px; border: 1px solid var(--rf-hair); border-radius: 6px; font-size: 11px; line-height: 1.4; white-space: nowrap; cursor: pointer; }
`;

/* Umbrella groups (0.4.129): the sections gathered by what they are for, each group with a picture of where on
   screen its sections work. This part holds only the groups' shells; each section's heading brings the rest in
   its part's own schema (since 0.4.163, its words and picture since 0.4.173): group and rank (its place), legend
   (its line beside the picture), zone (its piece of the picture), pauseSwitch (a paused part: the switch that
   turns it back on; its other rows step back while that is off), icon (the kit's name; a default by its key
   otherwise) and last (shown after the others). A section that names no group goes into Other. The number on a
   zone is given when it is drawn, so the picture and the list beside it always agree. layout 'win' lays the zones
   side by side, like the parts of Logseq's window. */
const GROUPS = [
  { key: 'reading', title: 'Reading a page', note: 'How pages, rows and links look. Nothing here writes to your notes.' },
  { key: 'writing', title: 'Writing a record', note: 'Help while you write. Nothing is written until you press a key.' },
  { key: 'around', title: 'Around the page', note: 'The parts of Logseq’s window around the page.', layout: 'win' },
  { key: 'tools', title: 'Tools', note: 'Things you run when you need them, and the plugin’s keys.' },
  { key: 'paused', title: 'Paused', note: 'Switched off for now. Turn one on with its first switch, then reload the plugin.' },
];
// A section's icon, from the kit's list: its heading's own, else by what its key says, else its group's.
const ICON_BY_KEY = [[/twoWay/, 'twoWay'], [/tagTree|tags/i, 'map'], [/shadow|proposal/i, 'proposals'], [/linkText/, 'link'], [/picker/, 'picked'], [/troubleshoot/, 'settings'], [/shortcut/, 'shortcut']];
const ICON_BY_GROUP = { reading: 'page', writing: 'proposals', around: 'sidebar', tools: 'settings', paused: 'hide' };
const iconOf = heading => heading.icon || ICON_BY_KEY.find(([re]) => re.test(heading.key))?.[1] || ICON_BY_GROUP[heading.group] || 'settings';
// A section's picture, from its heading's zone; a group's picture is its sections' zones in their order.
const zoneOf = heading => heading.zone ? `<div class="rs-zone" data-section="${heading.key}">${heading.zone}</div>` : '';
const artOf = group => {
  const zones = group.sections.map(section => zoneOf(section.heading)).join('');
  return zones && (group.layout === 'win' ? `<div class="win">${zones}</div>` : zones);
};
function groupsOf(sections) {
  const groups = GROUPS.map(group => ({ ...group, sections: [] }));
  const other = { key: 'other', title: 'Other', note: '', sections: [] };
  for (const section of sections) (groups.find(group => group.key === section.heading.group) || other).sections.push(section);
  const rank = section => section.heading.rank ?? 0;
  for (const group of groups) group.sections.sort((a, b) => rank(a) - rank(b) || sections.indexOf(a) - sections.indexOf(b));
  const shown = [...groups, other].filter(group => group.sections.length);
  for (const group of shown) for (const section of group.sections) section.group = group;
  return shown;
}

const valueOf = item => {
  const value = settingsNow()?.[item.key];
  return value === undefined || value === null || typeof value !== typeof item.default ? item.default : value;
};
const RELOAD_RE = /after you reload/i;
// Settings that hold several names separated by commas are shown as separate items.
const isList = item => item.type === 'string' && /^Comma-separated/i.test(item.description || '');
// “Applies right away.” is the usual case and goes unsaid; “after you reload” becomes a small note.
const tidyText = text => (text || '').replace(/\s*(Changes here apply|Changes to [^.]* apply|Applies) (right away|after you reload the plugin|at once)\.?/g, '').trim();
let lastSection = null;

// Text with the searched words picked out.
function fillMarked(doc, node, text, words) {
  node.textContent = '';
  if (!words.length) { node.textContent = text; return; }
  const re = new RegExp(words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
  let at = 0;
  for (const match of text.matchAll(re)) {
    if (match.index > at) node.append(text.slice(at, match.index));
    node.append(el(doc, 'span', { class: 'rf-settings-hit' }, match[0]));
    at = match.index + match[0].length;
  }
  if (at < text.length) node.append(text.slice(at));
}
// Settings grouped under their headings, in the order shown in the list on the left; the shortcuts of the register
// (0.4.317) as a section of their own under Tools, each one's setting taken out of its own section.
function sectionsOf(items) {
  const sections = [];
  let current = null;
  const bound = new Map((commands?.() || []).filter(c => c.shortcut).map(c => [c.shortcut, c]));
  const shortcuts = { heading: { key: 'shortcuts', title: 'Shortcuts', group: 'tools', rank: 3, icon: 'shortcut', legend: 'Every key the plugin listens for, in Logseq’s spelling (mod is ⌘ on a Mac, Ctrl elsewhere)',
    zone: '<div><span class="mono">mod+alt+l</span> <span class="m">link selected text</span></div><div><span class="mono">alt+enter</span> <span class="m">step through the properties</span></div>' }, items: [] };
  for (const item of items) {
    if (item.type === 'heading') { current = { heading: item, items: [] }; sections.push(current); continue; }
    if (!current) { current = { heading: { key: 'general', title: 'General' }, items: [] }; sections.push(current); }
    if (bound.has(item.key)) { shortcuts.items.push({ ...item, title: bound.get(item.key).label, command: bound.get(item.key) }); continue; }
    if (['boolean', 'string', 'number', 'enum'].includes(item.type)) current.items.push(item);
  }
  if (shortcuts.items.length) sections.push(shortcuts);
  // Lists kept by other windows (such as rich copy's left-out properties) are not shown.
  return sections.filter(section => section.items.length)
    .sort((a, b) => !!a.heading.last - !!b.heading.last); // such as shortcuts, looked up least often
}

// The window open now, so an unload can close it (0.4.279: a reload from Logseq's Plugins panel with the window open
// left its Escape listener on Logseq's document; the window's own Reload button already closes it first).
let closeOpen = null;
function open() {
  const doc = host();
  closeOpen?.();
  let reloadWanted = false;
  const status = note(doc, 'Changes are saved as you make them.', 'rf-settings-status');
  const save = (entry, value) => {
    saveSettings({ [entry.item.key]: value });
    entry.value = value;
    entry.markChanged();
    entry.drawPreview?.(value);
    if (entry.reload) reloadWanted = true;
    if (sections.some(section => section.heading.pauseSwitch === entry.item.key)) markPaused();
    status.textContent = reloadWanted ? 'Saved. Some changes show after you reload the plugin.' : 'Saved.';
    status.classList.toggle('rf-needs-reload', reloadWanted);
    updateCounts();
  };

  /* A comma-separated setting (tags, graph names, sidebar items) as separate words: each with a × on hover, and the
     kit's field at the end to add more (Enter or a comma adds; Backspace in the empty field takes back the last). It
     is still saved as one comma-separated line, which is what the parts read. A tag setting offers the graph's tags
     in the kit's list pop-up as you type. */
  const listControl = entry => {
    const { item } = entry;
    let items = [], pop = null, tags = null;
    const box = el(doc, 'div', { class: 'rf-settings-list', role: 'group', 'aria-label': item.title });
    const closePop = () => { pop?.close(); pop = null; };
    const commit = () => save(entry, items.join(', '));
    const draw = () => {
      for (const word of [...box.querySelectorAll('.rf-chip')]) word.remove();
      for (const [index, name] of items.entries()) f.before(chip(doc, { label: name, remove: () => { items.splice(index, 1); draw(); commit(); } }));
    };
    const add = (text = f.input.value) => {
      const fresh = text.split(',').map(word => word.trim().replace(/^#/, '')).filter(Boolean)
        .filter(word => !items.some(have => have.toLowerCase() === word.toLowerCase()));
      f.input.value = '';
      closePop();
      if (!fresh.length) return;
      items.push(...fresh);
      draw();
      commit();
    };
    const suggest = () => {
      if (!tags) return;
      const q = f.input.value.trim().toLowerCase();
      const hits = q ? tags.filter(t => t.toLowerCase().includes(q) && !items.some(have => have.toLowerCase() === t.toLowerCase())).slice(0, 8) : [];
      if (!hits.length) { closePop(); return; }
      const list = hits.map(t => ({ icon: 'tag', label: t, run: () => add(t) }));
      if (pop && !pop.isClosed) pop.items(list); else pop = shared.popup({ doc, at: f, manual: true, items: list, width: 240, onClose: () => { pop = null; } });
      pop.lit(0);
    };
    const f = field(doc, { placeholder: 'Add…', inline: true, title: `Add to ${item.title}`,
      keys: event => {
        if (pop && !pop.isClosed && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { const n = pop.body.querySelectorAll('.rf-item').length; pop.lit(((pop.litAt < 0 ? 0 : pop.litAt) + (event.key === 'ArrowDown' ? 1 : n - 1)) % n); return true; }
        if (event.key === 'Enter' || event.key === ',') { const lit = pop && !pop.isClosed ? pop.body.querySelectorAll('.rf-item')[pop.litAt] : null; if (lit) lit.click(); else add(); return true; }
        if (event.key === 'Escape' && pop) { closePop(); return true; }
        if (event.key === 'Backspace' && !f.input.value && items.length) { items.pop(); draw(); commit(); return true; }
        return false;
      },
      input: suggest });
    f.input.addEventListener('blur', () => setTimeout(() => { if (!pop?.el.contains(doc.activeElement)) { add(); } }, 120));
    if (/tag/i.test(item.key)) tagTitles().then(list => { tags = list; }).catch(() => {});
    box.addEventListener('mousedown', event => { if (event.target === box) { event.preventDefault(); f.input.focus(); } });
    box.append(f);
    const show = value => { items = String(value ?? '').split(',').map(word => word.trim()).filter(Boolean); draw(); };
    return [box, show, true];
  };

  // One control per kind of setting; each returns the control and a way to show a new value in it.
  const control = entry => {
    const { item } = entry;
    if (item.type === 'boolean') {
      const box = tick(doc, { checked: valueOf(item), title: item.title, change: on => save(entry, on) });
      box.setAttribute('aria-label', item.title);
      return [box, value => { box.checked = !!value; }];
    }
    if (item.type === 'enum') {
      const box = el(doc, 'span', { class: 'rf-seg', role: 'group', 'aria-label': item.title });
      const show = value => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.choice === value)); };
      for (const choice of item.enumChoices || []) {
        const b = quiet(doc, { label: choice, run: () => { show(choice); save(entry, choice); } });
        b.dataset.choice = choice;
        box.append(b);
      }
      return [box, show];
    }
    if (isList(item)) return listControl(entry);
    // Text and numbers (the shortcuts among them): the field, saved on Enter or when it is left.
    const f = field(doc, { inline: true, title: item.title, icon: item.command ? 'shortcut' : null, keys: event => { if (event.key === 'Enter') { f.input.blur(); return true; } return false; } });
    f.input.setAttribute('aria-label', item.title);
    const show = value => { f.input.value = String(value ?? ''); };
    f.input.addEventListener('change', () => {
      const next = item.type === 'number' ? Number(f.input.value) : f.input.value;
      if (item.type === 'number' && Number.isNaN(next)) { show(entry.value); return; }
      save(entry, next);
    });
    return [f, show];
  };

  const groups = groupsOf(sectionsOf(settingsSchema()));
  const sections = groups.flatMap(group => group.sections);
  const entries = [];
  const body = el(doc, 'div', { class: 'rf-settings-body' });
  const card = el(doc, 'div', { class: 'rf-settings-card' });
  body.append(card);
  const empty = el(doc, 'div', { class: 'rf-settings-empty', hidden: true });
  for (const section of sections) {
    const sectionReload = RELOAD_RE.test(section.heading.description || '');
    const noteText = tidyText(section.heading.description);
    const rows = el(doc, 'div', { class: 'rf-settings-rows' });
    section.node = el(doc, 'section', {}, el(doc, 'h3', {}, section.heading.title),
      sectionReload ? note(doc, [noteText, 'Changes here show after you reload the plugin.'].filter(Boolean).join(' '), 'rf-settings-note')
        : noteText ? note(doc, noteText, 'rf-settings-note') : null,
      rows);
    body.append(section.node);
    for (const item of section.items) {
      const entry = { item, section, value: valueOf(item), reload: sectionReload || RELOAD_RE.test(item.description || '') };
      const [input, show, wide] = control(entry);
      // A small picture of the setting's effect, where one is drawn; clicking it flips the tick box.
      let preview = null;
      if (item.type === 'boolean' && Array.isArray(item.preview)) {
        preview = el(doc, 'div', { class: 'rs-pv', 'aria-hidden': 'true', title: 'What this changes (click to switch)' });
        preview.addEventListener('click', () => input.click());
        entry.drawPreview = value => { preview.innerHTML = item.preview[value ? 1 : 0] || ''; };
        entry.drawPreview(entry.value);
      }
      show(entry.value);
      const titleText = el(doc, 'span');
      const reset = quiet(doc, { label: 'Reset', faint: true, title: `Back to the default: ${item.type === 'boolean' ? (item.default ? 'on' : 'off') : item.default === '' ? 'empty' : item.default}`, run: () => { show(item.default); save(entry, item.default); } });
      const title = el(doc, 'div', { class: 'rf-settings-title' }, titleText,
        entry.reload && !sectionReload ? note(doc, 'after reload') : null, reset);
      const desc = el(doc, 'div', { class: 'rf-note rf-settings-desc' });
      const more = quiet(doc, { label: 'More', faint: true, cls: 'rf-settings-more', run: () => { const opened = desc.classList.toggle('rf-open'); more.lastChild.textContent = opened ? 'Less' : 'More'; } });
      more.hidden = true;
      // A list shows its names one by one, so “Comma-separated tag names” reads “Tag names”.
      const descText = tidyText(item.description).replace(/^Comma-separated (\w)/i, (_, first) => first.toUpperCase());
      entry.row = el(doc, 'div', { class: 'rf-settings-row' },
        el(doc, 'div', { class: 'rf-settings-text' }, title, descText ? desc : null, descText ? more : null, wide ? input : null),
        wide ? null : el(doc, 'div', { class: 'rf-settings-control' }, preview, input));
      entry.mark = words => { fillMarked(doc, titleText, item.title, words); fillMarked(doc, desc, descText, words); };
      entry.markChanged = () => {
        const changed = entry.value !== item.default;
        titleText.classList.toggle('rf-settings-changed', changed);
        titleText.title = changed ? 'Changed from the default' : '';
        reset.hidden = !changed;
      };
      entry.haystack = `${item.title} ${descText} ${section.heading.title}`.toLowerCase();
      entry.more = more;
      entry.desc = desc;
      entry.mark([]);
      entry.markChanged();
      rows.append(entry.row);
      entries.push(entry);
    }
  }
  body.append(empty);

  // The list on the left: the groups as small labels, one quiet word with its icon per section, then the settings
  // that differ from their defaults.
  const nav = el(doc, 'nav', { class: 'rf-settings-nav', 'aria-label': 'Sections' });
  const navButton = (label, key, name) => {
    const count = note(doc, '');
    const b = quiet(doc, { icon: name, label, run: () => { find.input.value = ''; show(key); } });
    b.append(count);
    nav.append(b);
    return b;
  };
  for (const group of groups) {
    group.label = el(doc, 'div', { class: 'rf-settings-group' }, group.title);
    group.label.addEventListener('click', () => { find.input.value = ''; show('group:' + group.key); });
    nav.append(group.label);
    for (const section of group.sections) section.button = navButton(section.heading.title, section.heading.key, iconOf(section.heading));
  }
  nav.append(el(doc, 'hr'));
  const changedButton = navButton('Changed by you', 'changed', 'chosen');
  function updateCounts() {
    changedButton.lastChild.textContent = String(entries.filter(entry => entry.value !== entry.item.default).length || '');
  }

  let current = lastSection && (lastSection === 'changed' || sections.some(s => s.heading.key === lastSection) || groups.some(g => 'group:' + g.key === lastSection))
    ? lastSection : groups[0] ? 'group:' + groups[0].key : sections[0]?.heading.key;
  const pauseSwitchOf = headingKey => sections.find(section => section.heading.key === headingKey)?.heading.pauseSwitch;
  const isPaused = headingKey => !!pauseSwitchOf(headingKey) && !entries.find(entry => entry.item.key === pauseSwitchOf(headingKey))?.value;
  // A paused part's rows step back, all but the switch that turns it on.
  function markPaused() {
    for (const entry of entries) entry.row.classList.toggle('rf-settings-paused', isPaused(entry.section.heading.key) && entry.item.key !== entry.section.heading.pauseSwitch);
  }
  // The group's picture: each zone numbered like the list beside it; the section on screen stands out.
  function drawCard(group, sectionKey) {
    card.textContent = '';
    card.hidden = !group || !artOf(group);
    card.classList.toggle('rf-settings-card-focus', !!sectionKey);
    if (card.hidden) return;
    const art = el(doc, 'div', { class: 'rs-art' + (sectionKey ? ' rs-focus' : '') });
    art.innerHTML = artOf(group);
    const legend = el(doc, 'div', { class: 'rs-legend' });
    group.sections.forEach((section, index) => {
      const key = section.heading.key, n = String(index + 1), off = isPaused(key);
      for (const zone of art.querySelectorAll(`[data-section="${key}"]`)) {
        zone.dataset.n = n;
        zone.title = section.heading.title;
        zone.toggleAttribute('aria-current', key === sectionKey);
        zone.classList.toggle('rs-off', off);
        zone.addEventListener('click', () => show(key));
      }
      const button = el(doc, 'button', { type: 'button' }, el(doc, 'span', { class: 'rs-n' }, n),
        el(doc, 'span', {}, el(doc, 'b', {}, section.heading.title), el(doc, 'span', { class: 'rs-d' }, section.heading.legend || '')));
      button.toggleAttribute('aria-current', key === sectionKey);
      button.classList.toggle('rs-off', off);
      button.addEventListener('click', () => show(key));
      legend.append(button);
    });
    card.append(el(doc, 'div', { class: 'rf-settings-card-head' }, el(doc, 'span', { class: 'rf-settings-card-title' }, group.title), group.note ? note(doc, group.note, 'rf-settings-card-note') : null),
      el(doc, 'div', { class: 'rf-settings-card-grid' }, art, legend));
  }
  function show(key = current) {
    current = key;
    lastSection = key;
    const words = find.input.value.toLowerCase().split(/\s+/).filter(Boolean);
    const groupKey = key.startsWith('group:') ? key.slice(6) : null;
    const searching = words.length > 0;
    box.classList.toggle('rf-searching', searching);
    box.classList.toggle('rf-listing', searching || key === 'changed');
    for (const entry of entries) {
      const shown = searching ? words.every(word => entry.haystack.includes(word))
        : key === 'changed' ? entry.value !== entry.item.default
        : groupKey ? entry.section.group.key === groupKey
        : entry.section.heading.key === key;
      entry.row.hidden = !shown;
      entry.mark(searching ? words : []);
    }
    for (const section of sections) {
      const hits = section.items.length && [...section.node.querySelectorAll('.rf-settings-row')].some(row => !row.hidden);
      section.node.hidden = !hits;
      section.button.classList.toggle('rf-has-hits', searching && hits);
      section.button.setAttribute('aria-pressed', String(!searching && section.heading.key === key));
    }
    for (const group of groups) group.label.classList.toggle('rf-settings-group-on', !searching && groupKey === group.key);
    changedButton.setAttribute('aria-pressed', String(!searching && key === 'changed'));
    if (searching || key === 'changed') { card.hidden = true; card.textContent = ''; }
    else drawCard(groupKey ? groups.find(group => group.key === groupKey) : sections.find(section => section.heading.key === key)?.group, groupKey ? null : key);
    const none = !entries.some(entry => !entry.row.hidden);
    empty.hidden = !none;
    empty.textContent = searching ? `No setting matches “${find.input.value.trim()}”.` : 'Every setting is at its default.';
    body.scrollTop = 0;
    // “More” only where the explanation is cut short.
    if (!searching) doc.defaultView.requestAnimationFrame(() => {
      for (const entry of entries) if (!entry.row.hidden && !entry.desc.classList.contains('rf-open')) {
        entry.more.hidden = entry.desc.scrollHeight <= entry.desc.clientHeight + 1;
      }
    });
  }

  const find = field(doc, { placeholder: 'Find a setting', icon: 'find', kbd: '/', title: 'Find a setting',
    // The first Escape empties the find box; the next closes the window (the browser's dialog does that).
    keys: event => { if (event.key === 'Escape' && find.input.value) { find.input.value = ''; find.input.dispatchEvent(new doc.defaultView.Event('input')); return true; } return false; },
    input: () => { find.querySelector('kbd').hidden = !!find.input.value; show(); } });
  let box = null, finishDialog = null;
  const close = () => finishDialog?.();
  closeOpen = close;
  shared.dialog({ doc, cls: 'refinement-settings rf-settings', build: (dialogEl, finish) => {
    box = dialogEl;
    finishDialog = finish;
    dialogEl.setAttribute('aria-label', 'Refinements settings');
    // / or Cmd/Ctrl+F goes to the find box; the other keys stay in the window (the browser's dialog keeps them).
    dialogEl.addEventListener('keydown', event => {
      const typing = event.target?.matches?.('input, textarea');
      if (!typing && (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f'))) { event.preventDefault(); find.input.focus(); find.input.select(); }
    });
    const closeButton = quiet(doc, { icon: 'close', title: 'Close (Esc)', run: close });
    closeButton.setAttribute('aria-label', 'Close');
    const reload = quiet(doc, { label: 'Reload plugin', faint: true, run: () => { close(); reloadPlugin(); } });
    const logseqPage = quiet(doc, { label: 'Logseq’s settings page', faint: true, run: () => { close(); openLogseqSettings(); } });
    dialogEl.append(
      el(doc, 'header', { class: 'rf-settings-head' }, el(doc, 'h2', {}, 'Refinements settings'), find, closeButton),
      el(doc, 'div', { class: 'rf-settings-main' }, nav, body),
      el(doc, 'footer', { class: 'rf-settings-foot' }, status, note(doc, pluginVersion() || ''), logseqPage, reload));
  } }).then(() => { if (closeOpen === close) closeOpen = null; });
  updateCounts();
  markPaused();
  show(current);
  find.input.focus();
}

/* The three-dots menu is drawn only while open. After a click on its button, look for the menu for a
   few frames and add the item below “Plugins” (or at the end if that item is missing). */
function addMenuItem(menu) {
  const doc = menu.ownerDocument;
  // An item left by an earlier copy of the plugin would open that copy's panel, so it is replaced.
  for (const old of menu.querySelectorAll('.' + ITEM_CLASS)) old.remove();
  const items = [...menu.querySelectorAll('[role="menuitem"]')];
  const plugins = items.find(item => item.querySelector('[class*="icon-apps"]')) ||
    items.find(item => item.textContent.trim() === 'Plugins');
  const model = plugins || items[0];
  if (!model) return;
  const item = model.cloneNode(true);
  item.classList.add(ITEM_CLASS);
  item.dataset.copy = COPY;
  item.removeAttribute('data-highlighted');
  item.removeAttribute('id');
  const label = [...item.querySelectorAll('div')].find(div => !div.children.length) || item;
  label.textContent = 'Refinements settings';
  // Logseq draws its menu icons from the same font (Tabler); the settings icon from the kit's list takes the drawing's place.
  const svg = item.querySelector('svg');
  if (svg) svg.replaceWith(icon(doc, 'settings'));
  item.addEventListener('pointerenter', () => item.setAttribute('data-highlighted', ''));
  item.addEventListener('pointerleave', () => item.removeAttribute('data-highlighted'));
  item.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    // Escape closes the menu the way Logseq's own items do.
    menu.dispatchEvent(new (doc.defaultView.KeyboardEvent)('keydown', { key: 'Escape', bubbles: true }));
    open();
  });
  (plugins || items[items.length - 1]).after(item);
}
function watchDotsButton() {
  const doc = host(), win = doc.defaultView;
  const onClick = event => {
    // A copy of the plugin whose frame is gone (removed without its clean-up) steps aside.
    if (!window.parent) { doc.removeEventListener('click', onClick, true); return; }
    if (!event.target.closest?.('.toolbar-dots-btn')) return;
    let tries = 0;
    const look = () => {
      const menu = [...doc.querySelectorAll('[role="menu"]')].find(m => m.querySelector('[role="menuitem"]'));
      if (menu) { if (!menu.querySelector(`.${ITEM_CLASS}[data-copy="${COPY}"]`)) addMenuItem(menu); }
      else if (++tries < 30) win.requestAnimationFrame(look);
    };
    win.requestAnimationFrame(look);
  };
  doc.addEventListener('click', onClick, true);
  return () => doc.removeEventListener('click', onClick, true);
}

const menuCss = `.${ITEM_CLASS}[data-highlighted] { background: var(--rf-wash); }`;
function provide(core) {
  // For tools/boot-test.js and the palette: the window, through the core (no name on the window since 0.4.317).
  core.provide({ settingsPanel: { open } });
}
function start() {
  ({ sendStyle, settingsNow, settingsSchema, saveSettings, openLogseqSettings, reloadPlugin, pluginVersion, commands, tagTitles } = take(window.refinementCore,
    ['sendStyle', 'settingsNow', 'settingsSchema', 'saveSettings', 'openLogseqSettings', 'reloadPlugin', 'pluginVersion', 'commands', 'tagTitles']));
  sendStyle('refinement-settings-panel', css + menuCss);
  onUnload(watchDotsButton());
  onUnload(() => {
    closeOpen?.();
    const doc = host();
    for (const item of doc.querySelectorAll('.' + ITEM_CLASS)) item.remove();
  });
}

// The palette entry that opens the window (Logseq's own settings page for the plugin, should the window fail to open).
const commandList = [{ key: 'show-settings', label: 'Refinements settings', icon: 'settings', run: () => { try { open(); } catch (error) { warnOnce('the settings window could not open', error); openLogseqSettings(); } } }];
(window.refinementParts ||= []).push({ name: 'settings panel', foundation: true, schema: [], provide, start, commands: commandList, stop: runUnloadTasks });
})();
