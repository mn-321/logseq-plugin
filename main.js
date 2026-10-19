/* Personal Logseq DB refinements. All commands preserve their source blocks. */
/* The helpers every part shares (the Logseq document, warnings, the clean-up list, dialog boxes…)
   live in parts/shared.js; its header is the contract between the files. This file runs before the
   parts are loaded, so it takes them in useShared() once they have loaded, before Logseq is given the
   settings and before main() runs. Nothing above main() calls them while this file loads.
   Logseq keeps only the most recent beforeunload callback a plugin registers, so every part of the
   plugin keeps its own clean-up list and main() registers one callback that runs them all. */
let host, notify, warnOnce, onUnload, runUnloadTasks, takeOverFromEarlierCopy, updaterFailed, listen, modal, modalButtons, modalHint, openEntity, waitFor, setting, perf;
function useShared() {
  const shared = window.refinementShared;
  if (!shared) throw new Error('parts/shared.js did not load');
  ({ host, notify, modal, modalButtons, modalHint, openEntity, waitFor, perf } = shared);
  // The clean-up stops the screen watcher first, so nothing re-applies while the steps undo their
  // changes; a new copy runs the earlier copy's clean-up and sweeps what it left on screen.
  ({ warnOnce, onUnload, runUnloadTasks, takeOverFromEarlierCopy, updaterFailed, listen } = shared.lifecycle({ prefix: 'Refinements: ', stopKey: STOP_KEY, before: stopWatchingDom, sweep: sweepEarlierCopy }));
  setting = shared.settingReader(settingsSchema);
}

/* One watcher for Logseq's screen, with two kinds of update function. One part failing does not
   stop the others.
   - Early ones (watchDomEarly) run at once on every change, before the screen is drawn, so that
     Logseq's own look never shows first. They are given the changes and must be quick.
   - The others (watchDom) run once in the next frame, so many changes at once cost one pass.
   The watcher does not react to what these functions change themselves: what the early ones
   change is set aside, and what the later pass changes is shown to the early ones once. */
const domWatch = { updaters: new Set(), early: [], observer: null, frame: 0, win: null, doc: null };
function runEarly(records) {
  for (const fn of [...domWatch.early]) {
    try { perf.time(fn.name, () => fn(domWatch.doc, records)); } catch (error) { updaterFailed(fn, error, domWatch.early); }
  }
  domWatch.observer?.takeRecords();
}
function ensureDomWatch() {
  if (domWatch.observer) return domWatch.doc;
  const doc = host(), win = doc.defaultView;
  domWatch.doc = doc;
  domWatch.win = win;
  domWatch.observer = new win.MutationObserver(records => {
    perf.seen('screen watcher', records);
    runEarly(records);
    // A change of class or id alone (pointing, selecting) needs no later pass.
    if (domWatch.frame || !records.some(record => record.type !== 'attributes')) return;
    const timing = perf.frameState();
    domWatch.frame = win.requestAnimationFrame(() => {
      domWatch.frame = 0;
      perf.pass(timing);
      for (const fn of [...domWatch.updaters]) {
        try { perf.time(fn.name, () => fn(doc)); } catch (error) { updaterFailed(fn, error, domWatch.updaters); }
      }
      perf.passDone();
      const own = domWatch.observer?.takeRecords() || [];
      if (own.length) runEarly(own);
    });
  });
  domWatch.observer.observe(doc.body, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['data-ref', 'data-uuid', 'class', 'blockid', 'data-hl-type'] });
  return doc;
}
function watchDom(update) {
  const doc = ensureDomWatch();
  domWatch.updaters.add(update);
  update(doc);
}
function watchDomEarly(update) {
  ensureDomWatch();
  domWatch.early.push(update);
}
const addsElements = records => records.some(record => record.type === 'childList');
function stopWatchingDom() {
  domWatch.observer?.disconnect();
  if (domWatch.frame) domWatch.win?.cancelAnimationFrame(domWatch.frame);
  domWatch.observer = null;
  domWatch.frame = 0;
  domWatch.updaters.clear();
  domWatch.early.length = 0;
}

/* The plugin's watchers live in Logseq's window, so they outlive the plugin's own frame. If an
   earlier copy was removed without its clean-up finishing (an error, or Logseq's ten-second limit),
   they would keep running beside this copy. Each copy therefore leaves its clean-up where the next
   one can find it (takeOverFromEarlierCopy, from shared.js), and a new copy runs it and removes
   anything still left on screen (sweepEarlierCopy). */
const STOP_KEY = '__dbRefinementsStop';
// Each part declares what it may leave on screen in its lifecycle (leaves); shared.js sweeps it all.
const sweepEarlierCopy = doc => window.refinementShared.sweepLeftovers(doc);

/* One small scale for everything the plugin draws, so cues added at different times look alike.
   Colours are mixed from the theme's own text colour, so light, dark and custom themes all work. */
// On body as well as :root: Logseq defines its theme colours on body, and a value that refers to
// them (--rf-tag-color) is worked out where it is declared, so on :root alone it found none of them.
const tokensCss = `:root, body {
  --rf-quiet: .7;        /* labels and other secondary words */
  --rf-faint: .5;        /* icons, markup and separators */
  --rf-line-pct: 26%;    /* underlines, the active nesting line, the line beside embeds */
  --rf-hair-pct: 10%;    /* resting nesting lines */
  --rf-wash-pct: 8%;     /* the box behind a date */
  --rf-wash-strong-pct: 13%;
  --rf-field-pct: 3%;    /* the field behind a property list */
  --rf-divider-pct: 22%; /* the thick line between right-sidebar items */
  --rf-name: .94em;      /* a property's name beside its value */
  --rf-tiny: .72rem;     /* search headings and paths */
  /* the link to the page on screen, under Linked references: a faint grey wash of the theme's own text
     colour (the same wash as a date box; the hairline alone says "here") with a slightly firmer hairline beneath,
     like a pencil mark (pale on light themes, soft on dark) */
  --rf-here: color-mix(in srgb, var(--ls-primary-text-color, currentColor) var(--rf-wash-pct), transparent);
  --rf-here-line: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 38%, transparent);
  --rf-small: .82em;     /* labels beside text */
  --rf-back: .22;        /* a row (and its chip) stepped back while another is chosen */
  --rf-accent: #8b7fc7;  /* the optional tag chip; the only colour of the plugin's own */
  /* the # of a tag (before a link to a tag's page, a tag word in a sentence, a tag page's title, the pickers): the grey
     of the tag chips (0.4.114, at the owner's word: no blue tag anywhere; it was the colour Logseq's theme gives tags) */
  --rf-tag-color: var(--ls-secondary-text-color, currentColor);
  /* One look for every popup (0.4.140), taken from Logseq's own [[ menu: a box beside the text has its corners,
     its 6px of padding and its shadow; a row in it is 14px with 6px 8px of padding and 4px corners, the chosen row
     on the wash. A box in the middle of the window (the link box, the copy card, the settings) and the dark Undo
     bar are larger things and take the window's rounder corner and deeper shadow. */
  --rf-popup-radius: 6px;
  --rf-popup-shadow: 0 4px 6px -1px rgba(0, 0, 0, .1), 0 2px 4px -2px rgba(0, 0, 0, .1);
  --rf-window-radius: 8px;
  --rf-window-shadow: 0 8px 28px rgba(0, 0, 0, .2);
  --rf-row: .875rem;      /* the text of a row in a popup, Logseq's own size */
}`;
// Logseq ignores an empty stylesheet, which would leave the previous rules in place. A comment
// counts as content, so sending one is how a stylesheet is cleared.
const orNoRules = style => style.trim() ? style : '/* no rules */';
const titleOf = block => (block?.title || block?.content || '').trim();
// Drops a leading bullet, every trailing tag (#work, #[[Long tag]]), and the brackets around links.
const trailingTags = /(?:\s+#(?:\[\[[^\]]*\]\]|[^\s#\[\]]+))+\s*$/;
const cleanTitle = raw => raw.replace(/^[-*]\s*/, '').replace(trailingTags, '')
  .replace(/\[\[([^\]]+)\]\]/g, '$1').trim().slice(0, 180);

/* Database queries. Datascript with Logseq's own idents (:logseq.class/Tag, :block/title...), as
   the plugin SDK's DB guides do. Lists of ids are written into the query text, so only whole
   numbers and well-formed uuids are let in. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isEntityId = id => Number.isSafeInteger(id) && id > 0;
const idsIn = (variable, ids) => `[(identity [${[...new Set(ids)].filter(isEntityId).join(' ')}]) [${variable} ...]]`;
const uuidsIn = (variable, uuids) => `[(identity [${[...new Set(uuids)].map(String).filter(u => UUID.test(u)).map(u => `#uuid "${u}"`).join(' ')}]) [${variable} ...]]`;
// Rows of a query, or [] when it returns nothing.
const dsQuery = async query => {
  const rows = await logseq.DB.datascriptQuery(query);
  return Array.isArray(rows) ? rows : [];
};

// DB graphs store links as [[uuid]] and block references as ((uuid)). Swap in the titles people see.
// pagesOnly leaves ((uuid)) alone, matching what the block editor shows; asShown also leaves a [[uuid]]
// that points at a block (not a page) alone, because the editor shows such a link as its id.
const storedRef = /(\(\(|\[\[)([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(\)\)|\]\])/gi;
// The Logseq version whose page structure the plugin was last checked against. Most of what the
// plugin draws depends on names Logseq uses inside its own pages, which can change in any release.
const CHECKED_WITH = '2.0.2';
/* Self-check after a Logseq update. Once a page has settled, a few pairs are compared: when the page
   plainly has a thing (blocks, a title, references) but the part the plugin finds inside it is missing,
   Logseq has most likely renamed that part, and the features listed beside it have quietly stopped.
   One note in the app per problem per session. Nothing is switched off: a feature that cannot find its
   part already draws nothing. A Logseq version other than CHECKED_WITH gets one note per version. */
// [what is missing, the page has this (at least min), but none of this, what stops, min]
const selfChecks = () => [
  ['the page area', '#head', '#main-content-container', 'almost everything the plugin draws', 1],
  ['block text', '#main-content-container .ls-block[blockid]', '#main-content-container .block-title-wrap', 'cues after blocks, block-link dots, reference rows', 2],
  ['the title row', `#main-content-container :is(${PAGE_TITLE})`, '#main-content-container .is-page-title-row', 'tags beside the title, #Page, Add tags', 1],
  ['reference headings', '#main-content-container .references', '#main-content-container .references .ls-foldable-title', 'the Linked references layout, counts and labels', 1],
  ['the sidebar buttons', '#right-sidebar .sidebar-item', '#right-sidebar .cp__right-sidebar-settings', 'sidebar tidy', 1],
];
const selfCheck = { timer: 0, noted: new Set() };
// Looks twice, a few seconds apart, so a page caught half-drawn does not count.
function scheduleSelfCheck() {
  clearTimeout(selfCheck.timer);
  selfCheck.timer = setTimeout(() => runSelfCheck(true), 4000);
}
function runSelfCheck(first) {
  const doc = host();
  const count = selector => { try { return doc.querySelectorAll(selector).length; } catch (error) { return 0; } };
  const missing = selfChecks().filter(([what, has, needs, , min]) => !selfCheck.noted.has(what) && count(has) >= min && count(needs) === 0);
  if (!missing.length) return;
  if (first) { selfCheck.timer = setTimeout(() => runSelfCheck(false), 3000); return; }
  for (const [what, has, needs] of missing) {
    selfCheck.noted.add(what);
    warnOnce(`self-check: ${what} not found (the page has ${has}, but no ${needs})`);
  }
  notify(`Part of DB Refinements may have stopped, probably after a Logseq update: ${missing.map(([, , , stops]) => stops).join('; ')}. For details, run “Check what the plugin finds on this page”.`, 'warning');
}
async function versionNotice() {
  let version = '';
  try { version = (await logseq.App.getInfo('version')) || ''; } catch (error) { return; }
  if (!version || version === CHECKED_WITH || logseq.settings?.selfCheckSeenVersion === version) return;
  logseq.updateSettings({ selfCheckSeenVersion: version });
  notify(`You are on Logseq ${version}; DB Refinements was last checked with ${CHECKED_WITH}. If something looks off, run “Check what the plugin finds on this page”.`, 'warning');
}
function startSelfCheck() {
  versionNotice();
  scheduleSelfCheck();
  onUnload(logseq.App.onRouteChanged(scheduleSelfCheck));
  onUnload(() => clearTimeout(selfCheck.timer));
}
// Stylesheets that depend on settings are sent again only when their text has changed: every send
// makes Logseq work out the look of the whole page again.
const sentStyles = new Map();
function sendStyle(key, style) {
  const changed = sentStyles.get(key) !== style;
  perf.style(key, style, changed);
  if (!changed) return;
  sentStyles.set(key, style);
  logseq.provideStyle({ key, style: orNoRules(style) });
}
const settingsSchema = [
  { key: 'shortcutsHeading', type: 'heading', title: 'Shortcuts and actions', default: null,
    description: 'Every action is also in the command palette, under the names below. Changes to shortcuts apply after you reload the plugin. Leave a shortcut empty to remove it. Examples: mod+alt+l, mod+alt+p (mod is Cmd on Mac, Ctrl elsewhere).' },
  { key: 'linkShortcut', type: 'string', title: 'Link selected text to a page', default: 'mod+alt+l',
    description: 'Select words in a block, press this, then pick a page or block. The words become [words]([[page]]), a link that counts as a reference to the page, as [[page]] does.' },
  { key: 'openShortcut', type: 'string', title: 'Open selected text as page', default: 'mod+alt+p',
    description: 'Turns the text you selected into a [[link]] and opens (or creates) that page.' },
  { key: 'copyShortcut', type: 'string', title: 'Make a page from this block', default: '',
    description: 'Makes a new page titled with the current block’s text, holding a reference back to the block and copies of its children. The block itself stays where it is. Also in the right-click menu on a bullet.' },
  { key: 'tagShortcut', type: 'string', title: 'Add tags to this page', default: 'mod+t',
    description: 'Opens Logseq’s Set Tags list for the page you are on, the same list that clicking #Page opens.' },
  { key: 'deleteBlockShortcut', type: 'string', title: 'Delete this block', default: 'mod+backspace',
    description: 'With some of the block’s text selected, only that text is deleted. Deletes the block you are typing in, with the blocks nested under it, and puts the cursor at the end of the block above. If no block is being edited, deletes the selected blocks. mod+backspace is Cmd+Delete on a Mac.' },
  { key: 'outermostBlockShortcut', type: 'string', title: 'New block at the outermost level', default: 'alt+enter',
    description: 'At the outermost level of the page, just after the top-level block you are in (after all of its nested blocks), adds an empty block as a spacer and then a new empty block with the cursor in it. alt+enter is Option+Return on a Mac.' },
  { key: 'pageHeading', type: 'heading', title: 'Pages', default: null,
    description: 'Changes here apply after you reload the plugin.' },
  { key: 'showTitleChrome', type: 'boolean', title: 'Always show page title actions and tags', default: true,
    description: 'Keeps buttons like “Add tag property” and the page’s tags visible next to the title, muted until you point at them. Turn off to show them only on hover, as Logseq does.' },
  { key: 'showPageKind', type: 'boolean', title: 'Show what a page is above its title', default: true,
    description: 'Moves the page’s tags from the far right edge to the row of actions just above the title (they stay Logseq’s own, so their # still opens the tag menu), and shows #Page there on a page with no tag of its own. Needs “Always show page title actions and tags” to be visible without hovering. Applies right away.' },
  { key: 'showAliasOf', type: 'boolean', title: 'Show which page an alias belongs to', default: true,
    description: 'Under the title of a page that is an alias, shows a small muted “Alias of …” line; click the name to open the original page. Applies right away.' },
  { key: 'showUsage', type: 'boolean', title: 'Show how a page is used', default: true,
    description: 'Beside the Linked references heading, the references counted by how they arrive, using your own property names: “owner · 3   attendees · 2   in text · 4” (and “tagged · n” on a tag page). Click one and the other references step back, and so do their counts; click it again to bring them all forward. Nothing is written. Applies right away.' },
  { key: 'markReferenceHere', type: 'boolean', title: 'Mark the link to this page in Linked references', default: true,
    description: 'Under Linked references, the link that points to the page you are on is marked with a faint grey wash and a fine line beneath. Applies right away.' },
  { key: 'showShape', type: 'boolean', title: 'Show what a tag or property holds', default: true,
    description: 'Under a tag page’s title, a small box that starts closed to one line: where the tag sits (“#Entity › #Person › #Doctor”), how many fields it has and how many records it tags. Click the line to open the box: each field and what it takes (“facility → Organization · many”), the inherited ones faint. Under a property page’s title, what it takes and its most used values with bars. Each says when the shape looks off: a tag that adds no field of its own, free text that only ever holds a few words. Applies right away.' },
  { key: 'ownTagHidden', type: 'boolean', title: 'Leave a tag page’s own tag off its rows', default: true,
    description: 'On a tag’s page (such as #Task), the rows of its table, the records under it and its Linked references all carry that same tag. It is left off there, so only other tags show. Applies right away.' },
  { key: 'compactJournals', type: 'boolean', title: 'Journal days only as tall as what they hold', default: true,
    description: 'On the Journals list, Logseq gives every day at least a screen’s worth of height, so an empty day is a long gap. Each day is now as tall as its blocks. Applies right away.' },
  { key: 'dayCues', type: 'boolean', title: 'A day says what it holds', default: true,
    description: 'On the Journals list, after each day’s title, in small quiet words: a small circle with the number of unfinished tasks on that day, the nearest due day of one (“due Fri”), and the kinds of record inside by your own tags, counted (“2 Meeting · 1 Decision”), the way a folded block says what it holds. A day with nothing open has a shorter cue; nothing steps back. A journal opened on its own shows none. Applies right away.' },
  { key: 'hierarchyHeading', type: 'heading', title: 'Visual hierarchy', default: null,
    description: 'Quiet cues for the shape of the outline. Changes here apply right away.' },
  { key: 'indentGuides', type: 'boolean', title: 'Faint nesting lines', default: true,
    description: 'Makes the lines beside nested blocks fainter, and the line beside the branch you point at or type in a little stronger.' },
  { key: 'plainProperties', type: 'boolean', title: 'Plainer properties', default: true,
    description: 'The page’s own properties under its title sit on the same light grey field as a property list under a block, with one dot per property (the value’s own bullet is gone) and “Add property” shown only while you point at them. Shows a block’s properties as “name: value” text, separated by dots, instead of outlined capsules; when a row is too long to fit, a small triangle at its start opens it. Property names are grey so the values stand out. A property list under a block sits on a very light grey field, and the tag tabs below a page’s properties start with #.' },
  { key: 'quietEmptyProps', type: 'boolean', title: 'Empty properties faint', default: true,
    description: 'A property with no value yet (Logseq shows it as a dashed line) is drawn faint under a block and in a block’s property list, so a record’s filled values stand out. Nothing is hidden and nothing moves. The page’s own list under its title is not touched. Applies right away.' },
  { key: 'emptySlotsInRow', type: 'boolean', title: 'Empty slots read as the row', default: true,
    description: 'An empty slot Logseq lists under a block (after its own “Show hidden properties”, or a property added with nothing in it) reads like the row of filled properties: “Scheduled: ···”, faint, with no type icon, no bullet and no grey field. The page’s own list under its title is not touched. Applies right away.' },
  { key: 'hiddenPropsChevron', type: 'boolean', title: 'Hidden properties arrow on every block', default: true,
    description: 'While you point at a block, a small arrow right after the block’s own text opens the properties it hides, like the fold arrow beside a block: right while folded, down while open (Logseq shows its “Show hidden properties” button only on a block you have zoomed into). Logseq’s own button becomes the same arrow. Hidden means a value Logseq hides: an empty slot, such as a task’s unset Scheduled, gets no arrow.' },
  { key: 'quietEmptyBullets', type: 'boolean', title: 'Hide the dot on empty blocks', default: true,
    description: 'A block with no text, nothing nested under it, no tags, properties or pictures shows no dot, so empty blocks work as space between groups. Pointing at the block shows the dot faintly, and it is back in full while you type in the block.' },
  { key: 'childTypeCues', type: 'boolean', title: 'Show what a block holds', default: true,
    description: 'On a folded block only, after its text: ↳, a small circle with the number of unfinished tasks hidden below it, small image or PDF icons when its children are files, what kinds of record are inside (“3 #Decision”) and the nearest due day (“due Fri”). An open block shows nothing: its children are on screen. Point at the cue for details.' },
  { key: 'embedLine', type: 'boolean', title: 'Line beside embedded content', default: true,
    description: 'A faint line at the left of embedded blocks and pages, so you can tell they come from somewhere else.' },
  { key: 'dateStyle', type: 'boolean', title: 'Dates in a soft grey box', default: true,
    description: 'Dates in your notes, a record’s own dates in the pill row under it, and date headings of queries grouped by date, get a quiet grey box so they stand out from other links. Tables and the capsules at the side of a block keep plain dates.' },
  { key: 'dateTense', type: 'boolean', title: 'Dates carry their tense', default: true,
    description: 'A date in the past is quieter, today is a little firmer, a date to come stays as it is; an overdue Scheduled or Deadline keeps Logseq’s yellow. Applies right away.' },
  { key: 'plainPageIcons', type: 'boolean', title: 'Simpler page icons', default: true,
    description: 'Replaces Logseq’s generic page icon with a plain outline in titles and sidebars. Custom page icons are never changed.' },
  { key: 'tintTags', type: 'boolean', title: 'Soft background behind tags', default: false,
    description: 'Puts a faint violet chip behind tags, both in the text and at the end of a block.' },
  { key: 'tagMark', type: 'boolean', title: 'Tags as grey class names', default: true,
    description: 'A tag acts like a class, so the tag at the right of a block, the tag label above a title and the tag tabs are drawn as grey monospace names without the #. A tag word left in a sentence keeps its # in the tag colour, and so does the # before a tag page’s own title. Applies right away.' },
  { key: 'linksHeading', type: 'heading', title: 'Links and references', default: null,
    description: 'Changes here apply right away.' },
  { key: 'quietLinks', type: 'boolean', title: 'Quiet page links', default: true,
    description: 'Page links in normal text colour with a faint underline instead of bright blue; page names heading Linked references read as headings; links inside highlights stay readable.' },
  { key: 'referenceLayout', type: 'boolean', title: 'Clearer Linked references', default: true,
    description: 'Under Linked references: a wider gap between source pages, a journal’s date as a plain heading like any other page, the number of references after a heading that holds more than one, a bullet before the grey path that names a reference’s parent block, with the reference stepped in below it, the blocks below a reference stepping back unless they link here too, and Logseq’s fold arrows kept faintly visible. Applies right away.' },
  { key: 'referenceIcons', type: 'boolean', title: 'Icons for block references and files', default: true,
    description: 'A small dot before links to blocks, with no underline (pages keep their solid underline), and grey document or image icons before links to PDFs and pictures.' },
  { key: 'linkLabels', type: 'boolean', title: 'Show how records are linked', default: true,
    description: 'In Linked references, puts the property name before a value (“Doctor: …”). Under a page’s tag tabs, the value that points to the page on screen gets the same faint grey “points here” mark as in Linked references, and a folded record shows that property beside its title (“Diagnosis: page”).' },
  { key: 'tidyPaths', type: 'boolean', title: 'Tidy parent paths', default: true,
    description: 'The grey path above a result or reference uses the width it has before cutting text short, and its [[ ]] brackets fade; a labelled link [words]([[page]]) fades all but its words.' },
  { key: 'quietLinkMenu', type: 'boolean', title: 'Empty [[ ]] menu until you type', default: true,
    description: 'Typing [[ no longer opens a list of date words (Today, Tomorrow, Next week …) straight away; the page menu appears with the first letter you type.' },
  { key: 'hyperLinkTap', type: 'boolean', title: 'Tap the Hyper key to start a [[ link', default: true,
    description: 'If Caps Lock is your Hyper key (Cmd+Ctrl+Opt+Shift, set up with Karabiner or the Hyperkey app), tapping it on its own while you type does what typing [[ does: the brackets appear and the page menu opens. With words selected, they become the link. Holding Hyper with another key works as before. An Escape your setup sends on a tap is ignored here, so the menu stays open.' },
  { key: 'pickerMarks', type: 'boolean', title: 'The [[ menu and the # picker say what each row is', default: true,
    description: 'In the list that opens when you type #, a # in the tag colour before each tag, what the tag sits under and the fields it brings at the right (“under Occurrence · + date”), and the New tag row pencilled in, italic. In the list that opens when you type [[, each row carries the mark its link would have: a # in the tag colour before a tag, a small grey box before a journal day, the plain page rectangle or the page’s own icon before a page, its tags as grey class names at the right rather than “#Person” in the words; the relative days (Today, Last Wednesday …) step back to the quiet colour, and the New page row pencilled in, italic in the quiet colour with no box, since that means “not yet there”. Matched by what Logseq draws and by name, so a page and a tag with the same name cannot be told apart there. Applies right away.' },
  { key: 'propertyPickerTypes', type: 'boolean', title: 'The property picker says each type', default: true,
    description: 'In Logseq’s Add property list, each name is followed by its type in quiet words (Date, Person · many, yes/no) and the T before every name becomes the type’s icon, the one Properties in the line draws. A property the plugin does not know (one of Logseq’s own) keeps its T. Applies right away.' },
  { key: 'valuePickerMarks', type: 'boolean', title: 'The value picker says what each row is', default: true,
    description: 'In the list that opens on a property’s value (Set owner …), the plain page rectangle or the page’s own icon before a page, a # in the tag colour before a tag, a small dot before a block, the kind in quiet words at the right (Person, tag, page, block), a journal day above a block in the grey date box, and the New row pencilled in. Marked by name, as the [[ menu is. Applies right away.' },
  { key: 'linkBoxList', type: 'boolean', title: 'The link box lists your pages', default: true,
    description: 'Under the field of Link selected text to a page, a list of your pages, tags and journal days drawn with the marks the page uses, filtered as you type; Up and Down move, Enter links the highlighted row. A italic “Make page …” row appears only when no title matches exactly, and never above a match, so a typo cannot make a page. Off, the field is bare and Enter links what you typed. Applies right away.' },
  { key: 'linkBoxBeside', type: 'boolean', title: 'The link box opens beside the words', default: true,
    description: 'Link selected text to a page opens its field just under the selected words, as Logseq’s own [[ menu does, with nothing dimmed and nothing covering the page; a press elsewhere or Escape closes it. Off, the box opens in the middle of the window over a dimmed page. Applies right away.' },
  { key: 'linkBoxNodes', type: 'boolean', title: 'The link box lists blocks too', default: true,
    description: 'Under the pages in the link box, up to five blocks whose words match: tagged blocks (a Task, a Meeting) with their tags at the right, then any block Logseq’s own search finds once three letters are typed. The link points at the block, as a [[ ]] link to it would, and the block shows it in its references. Off, only pages, tags and journal days are listed. Applies right away.' },
  { key: 'pickerEscapeClears', type: 'boolean', title: 'Escape takes [[ and # out', default: true,
    description: 'In the [[ menu and the # tag picker, Escape closes the list and takes the [[ or # and the letters typed after it out of the text, so a key that meant “never mind” never makes a page or a tag when the block is saved; Cmd+Z brings the letters back. A new page or tag is made only through the list’s own New row. Off, Escape leaves the text as Logseq does. Applies right away.' },
  { key: 'dateLinkFormats', type: 'boolean', title: 'Year-first dates in [[ ]] link to journals', default: true,
    description: 'Inside [[ ]], a date typed year first (2026 10 14, 2026-10-14, 2026/10/14, 2026.10.14 or 20261014, month and day with two digits) turns into that day\'s journal name, so the menu offers the journal page.' },
  { key: 'pdfCitations', type: 'boolean', title: 'Compact PDF citations', default: true,
    description: 'PDF highlights show as normal text with a quote-mark bullet and a small page and source label at the start; click the line to open the PDF there.' },
  { key: 'innerReferenceLinks', type: 'boolean', title: 'Links inside a reference open their own page', default: true,
    description: 'A page link or tag shown inside a block reference opens its own page when clicked (Shift-click: in the sidebar). Off: clicking anywhere on the reference opens the block, as in Logseq.' },
  { key: 'pageLabels', type: 'boolean', title: 'Page links without trailing tags', default: true,
    description: 'A page link whose shown name ends in a tag (“Name #tag”) shows the page’s own title alone.' },
  { key: 'appearanceHeading', type: 'heading', title: 'Sidebars and toolbar', default: null,
    description: 'Changes here apply after you reload the plugin.' },
  { key: 'quietItems', type: 'string', title: 'Quiet these sidebar and toolbar items', default: 'Flashcards, Graph view',
    description: 'Comma-separated names (as shown, or as in the button tooltip). These stay visible but are smaller and lighter. Applies after you reload the plugin.' },
  { key: 'quietSidebarIcons', type: 'boolean', title: 'Left sidebar icons only where they mean something', default: true,
    description: 'In Favorites and Recent, Logseq’s generic page icon is left out (names stay lined up). A tag’s #, an icon you gave a page and an icon that comes from its tag all stay. Journal days are in grey. Applies right away.' },
  { key: 'tidySidebar', type: 'boolean', title: 'Tidy the right sidebar', default: true,
    description: 'Expand page properties automatically and hide the Page graph, (Dev) RTC, Undo/Redo and Profiler buttons.' },
];
// setting(key), from shared.js (useShared): a setting's current value, or its default from the list
// above when unset or of the wrong type.
// Settings that only take effect when the plugin starts.
const RELOAD_SETTINGS = ['linkShortcut', 'openShortcut', 'copyShortcut', 'tagShortcut', 'deleteBlockShortcut', 'outermostBlockShortcut', 'tidySidebar', 'quietItems', 'showTitleChrome'];

const PAGE_TITLE = '.ls-page-title, .page-title, h1.title';
/* After the database changes, everything the plugin knows from it is looked up again in one round:
   as soon as the changes pause, or every few seconds while they keep coming (typing). Seven
   separate timers used to do this, finishing at three different moments after each edit. */
const dbWork = { timer: 0, since: 0, slowTimer: 0, slowAt: 0 };
// Lists that cover the whole graph (every linked block, every property value,
// page titles, journals, property names) change rarely; while you edit, they are read again at most
// this often, plus once more after you stop. Looking at a new page reads them fresh only when something
// changed since they were read (0.4.150): read on every page change they held up the page's own extras.
const GRAPH_WIDE_EVERY = 30000;
const graphCache = new Map();
function graphWide(name, load) {
  const hit = graphCache.get(name);
  if (hit && Date.now() - hit.at < GRAPH_WIDE_EVERY) return hit.promise;
  const promise = Promise.resolve().then(load);
  graphCache.set(name, { at: Date.now(), promise });
  promise.catch(() => { if (graphCache.get(name)?.promise === promise) graphCache.delete(name); });
  return promise;
}
const DB_PAUSE = 800, DB_LONGEST = 2500;
function scheduleDbWork() {
  const now = Date.now();
  if (!dbWork.since) dbWork.since = now;
  clearTimeout(dbWork.timer);
  dbWork.timer = setTimeout(runDbWork, Math.max(0, Math.min(DB_PAUSE, dbWork.since + DB_LONGEST - now)));
}
function runDbWork() {
  dbWork.since = 0;
  perf.add('database round (calls only)', 0);
  // A job's look-up still waiting from a page change is not needed too: each job says what to cancel first.
  for (const job of dbJobs) if (job.before) { try { job.before(); } catch (error) { warnOnce(`${job.name} could not cancel its earlier look-up`, error); } }
  const failed = error => warnOnce('a look-up after a change failed', error);
  const run = jobs => { for (const job of jobs) { try { Promise.resolve(job.fn()).catch(failed); } catch (error) { failed(error); } } };
  // About the page on screen: after every round.
  const pageJobs = dbJobs.filter(job => job.scope === 'page');
  // Whole-graph lists: now if they are due; otherwise one full round when they fall due.
  const fullRound = () => {
    clearTimeout(dbWork.slowTimer);
    dbWork.slowTimer = 0;
    dbWork.slowAt = Date.now();
    graphCache.clear();
    graphCache.changed = false;
    run([...dbJobs.filter(job => job.scope === 'graph'), ...pageJobs]);
  };
  const wait = dbWork.slowAt + GRAPH_WIDE_EVERY - Date.now();
  if (wait <= 0) return fullRound();
  run(pageJobs);
  if (!dbWork.slowTimer) dbWork.slowTimer = setTimeout(fullRound, wait);
}
/* The core, as the other files see it: window.refinementCore, published by main() before any part
   starts. It holds the core's own tools (the screen watcher, the database round, stylesheets, settings,
   the query helpers) and a registry for the area parts (parts/editor.js, pages.js, … in step 7 of the
   cleanup): each part gives its functions and state to the core by name (core.provide, in its provide()
   step) and takes what it needs from core.provided in its start() step, after every part has provided,
   so the order of the parts does not matter. Database look-ups register with
   core.onDbRound(name, fn, { scope, before }): scope 'page' (the default) runs after every round, 'graph'
   only when the whole-graph lists fall due; before() is run at the start of every round to cancel a
   look-up of the job's own still waiting. runDbWork knows no job by name (one database round, GUIDE.md). */
/* The hooks the parts register with the core (onPageChange, onDatabaseChange, onSettingsChange): the core
   listens to Logseq once, does its own housekeeping first (its caches), then runs each part's function
   in the order registered, one failing not stopping the next. */
const hooks = { page: [], database: [], settings: [] };
const runHooks = (list, what, ...args) => { for (const fn of list) { try { fn(...args); } catch (error) { warnOnce(`a part's ${what} step failed (${fn.name || 'unnamed'})`, error); } } };
const provided = {}; // what the area parts give the core and each other, by name
const dbJobs = [];   // database-round jobs, in the order the parts registered them (core.onDbRound)
function publishCore() {
  window.refinementCore = {
    host, setting, notify, graphWide, scheduleDbWork, sendStyle, orNoRules, tokensCss, watchDom, watchDomEarly, addsElements, ensureDomWatch,
    RELOAD_SETTINGS, UUID, isEntityId, idsIn, uuidsIn, dsQuery, storedRef, titleOf, trailingTags, cleanTitle,
    CHECKED_WITH, PAGE_TITLE,
    onFoldAll: fn => provided.onFoldAll(fn),
    provided, provide: things => Object.assign(provided, things),
    onDbRound: (name, fn, { scope = 'page', before } = {}) => { dbJobs.push({ name, fn, scope, before }); },
    onPageChange: fn => hooks.page.push(fn), onDatabaseChange: fn => hooks.database.push(fn), onSettingsChange: fn => hooks.settings.push(fn),
  };
}
// The troubleshooting tools live in parts/diagnostics.js; the palette entries below call them by name.
const diag = name => (...args) => window.refinementDiagnostics?.[name]?.(...args);
// A command of an area part (parts/editor.js, properties.js), by the name it provided to the core.
const act = name => (...args) => provided[name](...args);
// Old default shortcuts that clash with the system, moved to the new default where the saved value is still the old one
// (Logseq saves every default, so a changed default alone would not reach an existing install). Cmd+Shift+L is the
// Mac's own "Search With Safari" service, which opened Safari over Logseq.
const MOVED_SHORTCUTS = { linkShortcut: ['mod+shift+l', 'mod+alt+l'] };
function main() {
  logseq.beforeunload(runUnloadTasks);
  for (const [key, [old, now]] of Object.entries(MOVED_SHORTCUTS)) if (logseq.settings?.[key] === old) logseq.updateSettings({ [key]: now });
  takeOverFromEarlierCopy();
  publishCore();
  // The parts (parts/*.js, loaded before this file). Each keeps its own clean-up, run from here; one
  // that fails to start leaves the rest of the plugin working. A part that has a provide() step gives
  // the core its functions and state first, so that every part's start() can take the others' things.
  for (const part of plugInParts) {
    try { part.provide?.(window.refinementCore); } catch (error) { warnOnce(`the ${part.name} part could not provide its functions`, error); }
  }
  for (const part of plugInParts) {
    try { part.start(); } catch (error) { warnOnce(`the ${part.name} part could not start`, error); }
    onUnload(part.stop);
  }
  logseq.provideStyle({ key: 'personal-db-tokens', style: tokensCss });
  sendStyle('personal-db-refinements', provided.mainCss());
  provided.applyHierarchy();
  provided.startDateLinks();
  provided.startPdfCitations();
  if (setting('tidySidebar')) provided.startSidebarPresentation();
  provided.startQuietUi();
  provided.startQuietLinkMenu();
  provided.startHyperLinkTap();
  provided.startDateLinkSwap();
  if (setting('showTitleChrome')) provided.startTitleChrome();
  provided.startPageKind();
  provided.startListProps();
  provided.startHiddenProps();
  startSelfCheck();
  provided.startNestedReferenceLinks();
  logseq.provideStyle({ key: 'personal-db-context-cues', style: provided.cueCss });
  provided.scheduleRefresh();
  onUnload(provided.stopRefresh);

  // Every hook returns an "off" function; each is called when the plugin unloads. The core listens
  // once and runs what the parts registered (hooks) after its own housekeeping.
  onUnload(logseq.App.onRouteChanged(() => {
    if (graphCache.changed) { graphCache.clear(); graphCache.changed = false; } // a new page reads changed whole-graph lists fresh
    runHooks(hooks.page, 'page change');
  }));
  // Edits fire this constantly while typing, so the database round waits for a pause before re-querying.
  onUnload(logseq.DB.onChanged(({ blocks } = {}) => {
    perf.add('DB.onChanged (calls only)', 0);
    graphCache.changed = true;
    runHooks(hooks.database, 'database change', blocks);
    scheduleDbWork();
  }));
  onUnload(logseq.App.onCurrentGraphChanged(() => graphCache.clear())); // another graph has other lists
  onUnload(() => { clearTimeout(dbWork.timer); clearTimeout(dbWork.slowTimer); });
  provided.startEditor(); // the editor keys and the last text selection (parts/editor.js)
  onUnload(logseq.onSettingsChanged((now, before) => {
    if (perf.ownSettingsOnly(now, before)) return;
    runHooks(hooks.settings, 'settings change', now, before);
    // Logseq rewrites every setting when the plugin starts, so a setting with no earlier value is a
    // default being filled in (first install, or a new setting after an update), not a change.
    if (RELOAD_SETTINGS.some(key => before && key in before && now?.[key] !== before[key])) notify('Reload the Refinements plugin to apply this change', 'info');
  }));

  // Command palette entries: [key, label, action, shortcut setting]. A shortcut left empty in the settings is not bound.
  const commands = [
    ['copy-block-children-to-page', 'Make a page from this block', act('blockToPage'), 'copyShortcut'],
    ['labeled-page-link', 'Link selected text to a page', act('labeledPageLink'), 'linkShortcut'],
    ['selected-text-to-page', 'Open selected text as page', act('selectionToPage'), 'openShortcut'],
    ['add-page-tags', 'Add tags to this page', act('addTagsToPage'), 'tagShortcut'],
    ['delete-current-block', 'Delete this block', act('deleteCurrentBlock'), 'deleteBlockShortcut'],
    ['new-outermost-block', 'New block at the outermost level', act('newOutermostBlock'), 'outermostBlockShortcut'],
    // The plugin's own settings panel (parts/settings-panel.js), or Logseq's settings page if that part did not load.
    ['show-settings', 'Refinements settings', () => window.refinementSettingsPanel ? window.refinementSettingsPanel.open() : logseq.showSettingsUI()],
    // The troubleshooting tools (parts/diagnostics.js) sit behind one entry that opens a box listing them.
    ['troubleshooting', 'Refinements: troubleshooting', diag('openTroubleshooting')],
    ['fold-query-results', 'Fold all results in this query', () => provided.foldQueryResults(null, true)],
    ['unfold-query-results', 'Unfold all results in this query', () => provided.foldQueryResults(null, false)],
    ['choose-list-properties', 'Choose properties shown in this list', act('chooseListProperties')],
  ];
  for (const [key, label, action, shortcut] of commands) {
    let binding = shortcut && setting(shortcut).trim().toLowerCase();
    if (binding && MOVED_SHORTCUTS[shortcut]?.[0] === binding) binding = MOVED_SHORTCUTS[shortcut][1]; // the saved setting may not show the move yet
    logseq.App.registerCommandPalette({ key, label, ...(binding ? { keybinding: { binding } } : {}) }, action);
  }
  // Each troubleshooting tool keeps its command key, registered without a palette entry (a shortcut
  // the owner bound to one of them still works); the box above lists them by name.
  for (const tool of window.refinementDiagnostics?.tools || []) logseq.App.registerCommand('global', { key: tool.key, label: 'Troubleshooting: ' + tool.label }, tool.run);
  // Right-click menu on a bullet: only what applies to any block. The list, fold and troubleshooting
  // commands are in the command palette, where they act on the block or query you last clicked in.
  logseq.Editor.registerBlockContextMenuItem('Make a page from this block', act('blockToPage'));
}
/* Search, journal-day dates, copy as rich text, todos, the tag tree and the settings panel live in parts/*.js. Each file adds itself to
   window.refinementParts; they are loaded here, in order, before the settings are given, because
   Logseq can keep an older loader.js cached that only loads this file. */
// shared.js first: the other parts read window.refinementShared as they load. sidebar.js next: its
// settings have no heading of their own, so they join "Sidebars and toolbar", the last section above.
const PART_FILES = ['parts/shared.js', 'parts/diagnostics.js', 'parts/editor.js', 'parts/pages.js', 'parts/properties.js', 'parts/links.js', 'parts/two-way.js', 'parts/chrome.js', 'parts/styles.js', 'parts/sidebar.js', 'parts/search.js', 'parts/journal-dates.js', 'parts/inline-props.js', 'parts/proposals.js', 'parts/rich-copy.js', 'parts/todos.js', 'parts/tags.js', 'parts/settings-panel.js'];
const partsBase = document.currentScript?.src || location.href;
let plugInParts = [];
function loadParts() {
  if (window.refinementParts) return Promise.resolve();
  const stamp = Date.now();
  return Promise.all(PART_FILES.map(file => new Promise(resolve => {
    const script = document.createElement('script');
    script.async = false; // run in the order listed
    script.src = new URL(file + '?t=' + stamp, partsBase).href;
    script.onload = resolve;
    script.onerror = () => { console.warn(`Refinements: ${file} could not be loaded`); resolve(); };
    document.body.appendChild(script);
  })));
}
// Given before ready, so the settings already hold their defaults when main runs. The parts' settings
// follow the plugin's own, each under its heading.
loadParts().then(() => {
  useShared();
  plugInParts = window.refinementParts || [];
  logseq.useSettingsSchema([...settingsSchema, ...plugInParts.flatMap(part => part.schema)]);
  return logseq.ready(main);
}).catch(console.error);



























