/* Personal Logseq DB refinements. All commands preserve their source blocks. */
/* Logseq keeps only the most recent beforeunload callback a plugin registers, so every part of
   the plugin adds its clean-up here and main() registers one callback that runs them all. */
const unloadTasks = [];
// Also takes the "off" function every logseq.*.onXxx hook returns.
const onUnload = task => { if (typeof task === 'function') unloadTasks.push(task); };
// Every step starts at once, in reverse order of set-up, so the screen is clean by the time this
// returns; the promise it returns waits for any step that finishes later.
function runUnloadTasks() {
  stopWatchingDom(); // first, so nothing re-applies while the parts below undo their changes
  const failed = error => console.warn('Refinements: clean-up step failed', error);
  const pending = [];
  for (const task of unloadTasks.splice(0).reverse()) {
    try { pending.push(Promise.resolve(task()).catch(failed)); } catch (error) { failed(error); }
  }
  return Promise.all(pending);
}

// The Logseq window. The plugin runs in a frame inside it.
const host = () => window.parent.document;

/* One watcher for Logseq's screen, with two kinds of update function. One part failing does not
   stop the others.
   - Early ones (watchDomEarly) run at once on every change, before the screen is drawn, so that
     Logseq's own look never shows first. They are given the changes and must be quick.
   - The others (watchDom) run once in the next frame, so many changes at once cost one pass.
   The watcher does not react to what these functions change themselves: what the early ones
   change is set aside, and what the later pass changes is shown to the early ones once. */
const domWatch = { updaters: new Set(), early: [], observer: null, frame: 0, win: null, doc: null };
function runEarly(records) {
  for (const fn of domWatch.early) {
    try { perf.time(fn.name, () => fn(domWatch.doc, records)); } catch (error) { console.warn('Refinements: a screen update failed', error); }
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
      for (const fn of domWatch.updaters) {
        try { perf.time(fn.name, () => fn(doc)); } catch (error) { console.warn('Refinements: a screen update failed', error); }
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

/* Small dialog boxes drawn in Logseq's window (window.prompt is unreliable inside plugin
   frames). build(box, finish) fills the box; the promise resolves with what finish() is given.
   Escape or a click outside resolves with cancelValue. Keys typed in the box never reach Logseq. */
function modal(cancelValue, build, width) {
  const doc = host();
  return new Promise(resolve => {
    const backdrop = doc.createElement('div');
    backdrop.className = 'refinement-prompt-backdrop';
    const box = doc.createElement('div');
    box.className = 'refinement-prompt';
    if (width) box.style.width = width;
    let finished = false;
    const finish = value => { if (finished) return; finished = true; backdrop.remove(); resolve(value); };
    backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) finish(cancelValue); });
    for (const type of ['keyup', 'keypress']) box.addEventListener(type, event => event.stopPropagation());
    box.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); finish(cancelValue); }
    });
    backdrop.append(box);
    doc.body.appendChild(backdrop);
    build(box, finish, doc);
  });
}
function modalButtons(doc, buttons) {
  const row = doc.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
  for (const [text, onClick] of buttons) {
    const b = doc.createElement('button');
    b.textContent = text;
    b.style.cssText = 'padding:4px 12px;border:1px solid var(--ls-border-color);border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer;';
    b.addEventListener('click', event => { event.preventDefault(); onClick(); });
    row.append(b);
  }
  return row;
}
function modalHint(doc, text) {
  const hint = doc.createElement('div');
  hint.className = 'refinement-prompt-hint';
  hint.textContent = text;
  return hint;
}

/* The plugin's watchers live in Logseq's window, so they outlive the plugin's own frame. If an
   earlier copy was removed without its clean-up finishing (an error, or Logseq's ten-second limit),
   they would keep running beside this copy. Each copy therefore leaves its clean-up where the next
   one can find it, and a new copy runs it and removes anything still left on screen. */
const STOP_KEY = '__dbRefinementsStop';
const STRAY_ELEMENTS = '.refinement-child-assets, .refinement-inline-values, .refinement-title-tags, .refinement-alias-of, .refinement-inherited, [data-refinement-search-button], .refinement-prompt-backdrop';
const STRAY_ATTRIBUTES = ['ref-row', 'date', 'date-heading', 'tag-page', 'property-crumb', 'pdf', 'pdf-line', 'pdf-citation-block',
  'citation', 'quiet', 'sidebar-hidden', 'always-shown', 'page-kind', 'prop-hidden', 'block-link', 'prop-label', 'via', 'crumb-box'].map(name => 'data-refinement-' + name);
function takeOverFromEarlierCopy() {
  let win;
  try { win = host().defaultView; } catch (error) { return; }
  try { win[STOP_KEY]?.(); } catch (error) { console.warn('Refinements: an earlier copy could not be stopped', error); }
  win[STOP_KEY] = runUnloadTasks;
  onUnload(() => { if (win[STOP_KEY] === runUnloadTasks) delete win[STOP_KEY]; });
  try {
    const doc = win.document;
    for (const el of doc.querySelectorAll(STRAY_ELEMENTS)) el.remove();
    for (const name of STRAY_ATTRIBUTES) for (const el of doc.querySelectorAll(`[${name}]`)) el.removeAttribute(name);
    for (const el of doc.querySelectorAll('.is-page-title-row .ls-block-right .block-tags')) el.style.transform = '';
  } catch (error) { console.warn('Refinements: leftovers could not be cleared', error); }
}

// Listens on Logseq's window before Logseq does (capture phase), until the plugin unloads.
function listen(win, types, handler) {
  for (const type of types) win.addEventListener(type, handler, true);
  onUnload(() => { for (const type of types) win.removeEventListener(type, handler, true); });
}
// Opens a page or block by uuid; in the right sidebar when asked (Shift-click).
function openEntity(uuid, inSidebar = false) {
  if (!uuid) return;
  if (inSidebar) logseq.Editor.openInRightSidebar(uuid);
  else logseq.App.pushState('page', { name: uuid });
}

// Tables already provide structure, so several rules leave anything inside one alone.
const notInTable = ':not(:is(table, [role="table"], [role="grid"], .table-view, .ls-table) *)';
/* One small scale for everything the plugin draws, so cues added at different times look alike.
   Colours are mixed from the theme's own text colour, so light, dark and custom themes all work. */
const tokensCss = `:root {
  --rf-quiet: .7;        /* labels and other secondary words */
  --rf-faint: .5;        /* icons, markup and separators */
  --rf-line-pct: 26%;    /* underlines, the active nesting line, the line beside embeds */
  --rf-hair-pct: 10%;    /* resting nesting lines */
  --rf-wash-pct: 8%;     /* the box behind a date */
  --rf-wash-strong-pct: 13%;
  --rf-here-pct: 20%;    /* the link to the page on screen, under Linked references */
  --rf-small: .82em;     /* labels beside text */
  --rf-tiny: .72rem;     /* search headings and paths */
  --rf-accent: #8b7fc7;  /* the optional tag chip; the only colour of the plugin's own */
}`;
// Logseq ignores an empty stylesheet, which would leave the previous rules in place. A comment
// counts as content, so sending one is how a stylesheet is cleared.
const orNoRules = style => style.trim() ? style : '/* no rules */';
const wash = pct => `color-mix(in srgb, var(--ls-primary-text-color, currentColor) var(${pct}), transparent)`;
const dateStyles = selectors => {
  // Leave date values in tables at native size/color.
  selectors = selectors.map(selector => selector + notInTable);
  const select = suffix => selectors.map(selector => selector + suffix).join(',\n');
  return `
${select('')} {
  display: inline;
  color: var(--ls-primary-text-color, currentColor) !important;
  background: ${wash('--rf-wash-pct')} !important;
  border: 0 !important;
  border-radius: .22em;
  padding: .1em .28em;
  font-family: inherit;
  font-size: .95em;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: inherit;
  text-decoration: none !important;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
${select(':hover')} { background: ${wash('--rf-wash-strong-pct')} !important; }
`;
};

// Small monochrome icons use the existing text color and leave native links intact.
const referenceIcon = (selector, path) => {
  const svg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="black" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`);
  return `${selector}::before { content: ''; display: inline-block; width: .8em; height: .8em; margin-right: .25em; vertical-align: -.05em; background: currentColor; opacity: var(--rf-faint); mask: url("data:image/svg+xml,${svg}") center / contain no-repeat; -webkit-mask: url("data:image/svg+xml,${svg}") center / contain no-repeat; }`;
};
const documentIcon = 'M4 2h5l3 3v9H4z M9 2v4h3';
// A link to a block starts with a dot, a smaller version of the bullet every block has. Pages get no mark.
// A row that is only such a link looks the same. Nothing is drawn under the words or after them
// (a dashed line and a closing arrow were both tried and dropped).
// The dot is a character joined to the first word by a no-break space, so the two never end up on
// different lines.
const blockDot = selector => `${selector}::before { content: '\\2022\\00A0'; font-size: .72em; vertical-align: .14em; opacity: var(--rf-faint); }`;
const hashMask = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h14 M5 15h14 M11 4l-4 16 M17 4l-4 16"/></svg>');
const imageIcon = 'M2 3h12v10H2z M2 11l4-4 3 3 2-2 3 3 M10 5h.1';
const plainPageMask = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="4" y="3" width="8" height="10" rx="1.5" fill="none" stroke="black" stroke-width="1.2"/></svg>');

/* Main styles, in sections. A section with a setting's name is left out when that setting is off;
   the order never changes, because later rules rely on overriding earlier ones. */
const cssParts = [
  ['plainPageIcons', `/* Replace native generic page icons; preserve custom icons and asset links. */
:is(.page-title, .page-title-container, .sidebar-item-header, .sidebar-item .header, #left-sidebar, .left-sidebar-inner, .page-icon) :is(.ti-file, .ti-file-description, .ti-file-text)::before {
  content: '' !important;
  display: inline-block;
  width: .8em;
  height: 1em;
  vertical-align: -.08em;
  background: currentColor;
  opacity: var(--rf-quiet);
  mask: url("data:image/svg+xml,${plainPageMask}") center / contain no-repeat;
  -webkit-mask: url("data:image/svg+xml,${plainPageMask}") center / contain no-repeat;
}
/* SVG icon variants used by newer DB builds and sidebar navigation, and the bullet of a page listed as a row. */
:is(.page-title, .page-title-container, .sidebar-item-header, .sidebar-item .header, #left-sidebar, .left-sidebar-inner, .page-icon, .bullet-container)
:is(svg.tabler-icon-file, svg.icon-tabler-file, svg.tabler-icon-file-description, svg.icon-tabler-file-description, svg.lucide-file, svg[data-icon="file"], svg[data-lucide="file"]) {
  background: currentColor !important;
  opacity: var(--rf-quiet);
  mask: url("data:image/svg+xml,${plainPageMask}") center / contain no-repeat !important;
  -webkit-mask: url("data:image/svg+xml,${plainPageMask}") center / contain no-repeat !important;
}
:is(.page-title, .page-title-container, .sidebar-item-header, .sidebar-item .header, #left-sidebar, .left-sidebar-inner, .page-icon, .bullet-container)
:is(svg.tabler-icon-file, svg.icon-tabler-file, svg.tabler-icon-file-description, svg.icon-tabler-file-description, svg.lucide-file, svg[data-icon="file"], svg[data-lucide="file"]) > * {
  visibility: hidden !important;
}
`],
  ['tidySidebar', `/* Sidebar panels share their surrounding surface instead of floating as cards. */
#right-sidebar :is(.sidebar-item, .sidebar-item-header, .sidebar-item-content, .sidebar-item > .content) {
  box-shadow: none !important;
  background: transparent !important;
  border-radius: 0 !important;
}
#right-sidebar .sidebar-item { border: 0 !important; }
#right-sidebar .sidebar-item + .sidebar-item {
  border-top: 1px solid var(--ls-border-color, rgba(128,128,128,.16)) !important;
}
`],
  ['quietLinks', `/* A faint underline identifies ordinary page links without bright blue. */
.page-reference a.page-ref, a.page-ref:not(.tag), .page-reference:not(:has(a.tag)) {
  color: var(--ls-primary-text-color) !important;
  text-decoration-line: underline !important;
  text-decoration-style: solid;
  text-decoration-color: color-mix(in srgb, currentColor var(--rf-line-pct), transparent) !important;
  text-decoration-thickness: 1px;
  text-underline-offset: .2em;
}
.page-reference a.page-ref:hover, a.page-ref:not(.tag):hover {
  text-decoration-color: currentColor !important;
}
`],
  ['childTypeCues', `/* Trailing child-type cue, independent of the native bullet. */
.refinement-child-assets { display: inline-flex; align-items: center; gap: .18em; margin-left: .5em; color: var(--ls-secondary-text-color); opacity: var(--rf-quiet); font-size: var(--rf-small); white-space: nowrap; user-select: none; }
${referenceIcon('.refinement-child-asset-image', imageIcon)}
${referenceIcon('.refinement-child-asset-pdf', documentIcon)}
${referenceIcon('.refinement-child-asset-asset', documentIcon)}
.refinement-child-assets span::before { margin-right: 0; opacity: 1; }
.refinement-child-task { display: inline-block; box-sizing: border-box; width: .72em; height: .72em; border: 1px dashed currentColor; border-radius: 50%; }
`],
  ['quietLinks', `/* Type cues on rendered references. Keep Logseq's side tags native. */
.ls-block .block-content a.tag {
  color: var(--ls-primary-text-color) !important;
  text-decoration: none !important;
  font-weight: 600;
}
.ls-block .block-content a.tag:hover { text-decoration: underline !important; }
/* A link to a tag's own page looks like a page link (underlined name) but its icon is grey, where a
   page's icon is in the full text colour. The icon is the tag's own, or a # drawn as an icon. */
a.page-ref[data-refinement-tag-page]:not(.tag) > .icon-emoji-wrap { opacity: var(--rf-faint); }
a.page-ref[data-refinement-tag-page]:not(.tag):not(:has(> .icon-emoji-wrap, .block-title-wrap))::before {
  content: ''; display: inline-block; width: 1em; height: 1em; margin-right: .22em; vertical-align: -.14em;
  background: currentColor; opacity: var(--rf-faint);
  mask: url("data:image/svg+xml,${hashMask}") center / contain no-repeat; -webkit-mask: url("data:image/svg+xml,${hashMask}") center / contain no-repeat;
}
.page-reference[data-ref] a.page-ref { text-decoration-color: color-mix(in srgb, currentColor var(--rf-line-pct), transparent) !important; }
`],
  ['referenceIcons', `${referenceIcon('.ls-block .block-content a[href*=".pdf" i]:not(:has(img))', documentIcon)}
${referenceIcon('.ls-block .block-content a:is([href*=".png" i], [href*=".jpg" i], [href*=".jpeg" i], [href*=".webp" i]):not(:has(img))', imageIcon)}
/* Links to files: the words in normal text with the same faint underline as a page link; the icon
   alone carries the link colour. */
.ls-block .block-content a:is([href*=".pdf" i], [href*=".png" i], [href*=".jpg" i], [href*=".jpeg" i], [href*=".webp" i]):not(:has(img)) {
  color: var(--ls-primary-text-color, inherit) !important; border-bottom: 0 !important;
  text-decoration: underline solid color-mix(in srgb, currentColor var(--rf-line-pct), transparent) 1px !important; text-underline-offset: .2em;
}
.ls-block .block-content a:is([href*=".pdf" i], [href*=".png" i], [href*=".jpg" i], [href*=".jpeg" i], [href*=".webp" i]):not(:has(img)):hover { text-decoration-color: currentColor !important; }
.ls-block .block-content a:is([href*=".pdf" i], [href*=".png" i], [href*=".jpg" i], [href*=".jpeg" i], [href*=".webp" i]):not(:has(img))::before { text-decoration: none; }
.ls-block .block-content a:is([href*=".pdf" i], [href*=".png" i], [href*=".jpg" i], [href*=".jpeg" i], [href*=".webp" i]):not(:has(img))::before {
  background: var(--ls-link-text-color, #2563eb); opacity: 1;
}
.ls-datetime a::before, .timestamp a::before, a.page-ref[data-refinement-date]::before,
a.page-ref:has(.prefix-link[data-refinement-pdf])::before { content: none !important; }
/* A block reference contains the referenced block's title area; a page link never does.
   This lets references be styled from the rendered page, before it is painted. */
${blockDot('.ls-block a.page-ref:not(.tag):not(:has(.prefix-link, img)) .block-title-wrap')}
/* A linked task shows its status and priority icons before the link, and the icons stand in for the
   dot. A word joiner in the dot's place keeps the icons on the same line as the first word. */
.ls-block .page-reference:has(> .inline-block > .positioned-properties.block-left) a.page-ref .block-title-wrap::before { content: '\\2060' !important; }
.ls-block .page-reference:has(a.page-ref .block-title-wrap) > .inline-block:has(> .positioned-properties.block-left) { padding-right: .25em; }
/* The icon of a linked page or tag page stays on the same line as the first word of its name. */
.ls-block .block-content a.page-ref:not(.tag) > .icon-emoji-wrap + span::before,
.ls-block .block-content a.page-ref[data-refinement-tag-page]:not(.tag):not(:has(> .icon-emoji-wrap, .block-title-wrap)) > span:first-child::before { content: '\\2060'; }
.ls-block a.page-ref:has(.block-title-wrap):not(.tag), .ls-block a.page-ref:has(.block-title-wrap):not(.tag):hover,
.ls-block a.page-ref:has(.block-title-wrap):not(.tag) *,
.ls-block .page-reference:has(a.page-ref .block-title-wrap), .ls-block .page-reference:has(a.page-ref .block-title-wrap):hover {
  text-decoration: none !important;
  border-bottom: 0 !important;
}
.ls-block[data-refinement-ref-row] > .block-main-container .block-content,
.ls-block[data-refinement-ref-row] > .block-main-container .block-content *,
.ls-block[data-refinement-ref-row] > .block-main-container .block-content *:hover { text-decoration: none !important; border-bottom: 0 !important; }
`],
  ['plainProperties', `/* Block properties read as "name: value · name: value" with no capsule outline. Property lists
   are left as Logseq draws them: its own weight, and its bullet beside every value. */
/* Logseq draws the capsule outline on ::after; it stays while a capsule has keyboard focus. */
.ls-block .positioned-properties.block-below .bottom-property-pill { background: transparent !important; padding-left: 0 !important; padding-right: 0 !important; }
.ls-block .positioned-properties.block-below .bottom-property-pill:not(:focus)::after { box-shadow: none !important; }
.ls-block .positioned-properties.block-below .bottom-property-pill + .bottom-property-pill::before {
  content: '·'; margin-right: .5rem; opacity: var(--rf-faint);
}
`],
  ['embedLine', `/* Content shown from somewhere else (embedded blocks and pages) gets a faint left line.
   Inset shadows draw the line without moving any text. */
:is(.ls-block.embed-block:not(.embed-block .ls-block), .embed-page) {
  position: relative;
  box-shadow: inset 2px 0 0 color-mix(in srgb, var(--ls-secondary-text-color, currentColor) var(--rf-line-pct), transparent) !important;
}
`],
  ['quietLinks', `/* Page names that head each group in Linked references read as headings, not as links in text. */
:is(.references, .unlinked-references) .ls-foldable-title a.page-ref:not(.tag),
:is(.references, .unlinked-references) .ls-foldable-title .page-reference:has(a.page-ref) {
  font-weight: 600; text-decoration: none !important; border-bottom: 0 !important;
}
:is(.references, .unlinked-references) .ls-foldable-title a.page-ref:not(.tag):hover { text-decoration: underline !important; text-decoration-color: color-mix(in srgb, currentColor var(--rf-line-pct), transparent) !important; }
`],
  ['referenceLayout', `/* Linked references: each source page is a group set apart from the next. */
#main-content-container .references .group-list-view > div > div > div + div { padding-top: 1.6em; }
/* One kind of heading for every source page: a journal's date reads as a heading too, without its box. */
:is(.references, .unlinked-references) .ls-view-body .ls-foldable-header [data-refinement-date-heading],
:is(.references, .unlinked-references) .ls-view-body .ls-foldable-header [data-refinement-date-heading]:hover {
  background: transparent !important; padding: 0 !important; font-size: inherit !important; font-weight: 600 !important;
}
/* The grey path above a reference names the block it sits under, so it gets a bullet and the reference steps in below it. */
#main-content-container .references .breadcrumb.block-parents::before {
  content: ''; flex: none; align-self: center; display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  margin: 0 .65em 0 .15em; vertical-align: middle; background: currentColor; opacity: var(--rf-faint);
}
#main-content-container .references div:not([data-refinement-crumb-box]):has(> .breadcrumb.block-parents) + .content { margin-left: 1.4em; }
/* Logseq's fold arrows (the section, a source page, a block with something below it) stay faintly
   visible instead of showing only under the pointer. */
:is(.references, .unlinked-references) :is(.ls-foldable-title-control, .block-control-wrap[data-has-children="true"] > .block-control) > .control-hide { display: block !important; }
/* A source page's arrow hangs to the left of its heading, where the list is cut off; the list's edge moves out to make room. */
:is(.references, .unlinked-references) .ls-foldable-content-inner:has(> .ls-view-body) { margin-left: -27px; padding-left: 27px; }
:is(.references, .unlinked-references) :is(.ls-foldable-title-control, .block-control-wrap[data-has-children="true"] > .block-control):not(:hover) { opacity: calc(var(--rf-faint) * .6) !important; }
/* How many references a source page holds, when it holds more than one. */
.references .ls-foldable-header[data-refinement-ref-count]::after {
  content: '· ' attr(data-refinement-ref-count); margin-left: .5em; color: var(--ls-secondary-text-color, inherit);
  opacity: var(--rf-quiet); font-size: var(--rf-small); font-weight: 400; white-space: nowrap;
}
`],
  ['showTitleChrome', `/* On the Journals list, the line that closes one day sat right against the next day's "Add icon" and
   "Set property". Padding (not margin: Logseq measures each day's height) moves them down from it. */
#journals .journal-item:not(:has(.is-today-page)) { padding-top: 2em; }
`],
  ['tidyPaths', `/* Brackets around dates and pages in grey paths fade, as in search. */
::highlight(refinement-crumb-markup) { color: var(--lx-gray-08, rgba(128, 128, 128, .55)); opacity: var(--rf-faint); }
`],
  ['linkLabels', `/* A lone property name above a group of references; the value's own label replaces it. */
[data-refinement-crumb-box] { display: none !important; }
`],
  ['tidyPaths', `/* Parent paths on pages use the room they have: each part is cut short only when the whole path runs out of space. */
:is(#main-content-container, #right-sidebar) .breadcrumb.block-parents .breadcrumb__segment { max-width: none; flex-shrink: .1; }
:is(#main-content-container, #right-sidebar) .breadcrumb.block-parents .breadcrumb__segment:not(:has(~ .breadcrumb__segment)) { flex-shrink: 1; }
`],
  ['referenceIcons', `/* A block (not a page) shown inside a reference stays without an underline. */
.ls-block .block-content a.page-ref[data-uuid] a.page-ref[data-uuid]:not(.tag):not([data-refinement-date]):has(.block-title-wrap),
.ls-block .block-content a.page-ref[data-uuid] a.page-ref[data-uuid]:not(.tag):not([data-refinement-date]):has(.block-title-wrap):hover { text-decoration: none !important; }
/* Native block references use the same dot, without underlines. */
${blockDot('.block-ref:not(:has(.prefix-link))')}
.block-ref, .block-ref:hover, .block-ref *,
.page-reference:has(.block-ref), .page-reference:has(.block-ref):hover {
  text-decoration: none !important;
  border-bottom: 0 !important;
}
/* (( block )) picker is unambiguously blocks; its row label stays quiet. */
#ui__ac.ac-block-search .menu-link::before {
  content: '•'; opacity: var(--rf-faint); margin-right: .35em;
}
`],
  ['pdfCitations', `/* Native PDF citations: normal excerpt text and a quiet source at its start. */
.block-content[data-type="annotation"] .prefix-link::before,
.block-title-wrap > .prefix-link:has(> .hl-page)::before { content: none !important; display: none !important; }
.block-title-wrap[data-refinement-pdf-line] { cursor: pointer; }
.ls-block[blockid][data-refinement-pdf-citation-block] > .block-main-container .bullet-container.cursor[blockid]:not(.typed-list) {
  background: transparent !important;
}
.ls-block[blockid][data-refinement-pdf-citation-block] > .block-main-container .bullet-container.cursor[blockid]:not(.typed-list) > .bullet {
  background: transparent !important;
  border: 0 !important;
  width: .65em;
  height: .65em;
  border-radius: 0 !important;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ls-block[blockid][data-refinement-pdf-citation-block] > .block-main-container .bullet-container.cursor[blockid]:not(.typed-list) > .bullet::before {
  content: '“';
  color: var(--ls-secondary-text-color, #798087);
  font-family: Georgia, serif;
  font-size: 1.3em;
  font-weight: 400;
  line-height: .75;
  transform: translateY(.15em);
  pointer-events: none;
}
.prefix-link[data-refinement-pdf]::before,
.prefix-link[data-refinement-pdf] .hl-page::before { content: none !important; display: none !important; }
.prefix-link[data-refinement-pdf] {
  display: inline !important;
  margin-left: 0 !important;
  margin-right: .45em !important;
  padding: 0 !important;
  background: transparent !important;
  border: 0 !important;
  cursor: pointer;
  text-decoration: none !important;
}
.prefix-link[data-refinement-pdf="area"] { margin-left: 0 !important; }
.prefix-link[data-refinement-pdf] .hl-page {
  color: var(--ls-secondary-text-color, #798087) !important;
  font-family: inherit;
  font-size: var(--rf-small);
  font-weight: 400;
  white-space: nowrap;
  opacity: var(--rf-quiet);
  text-decoration: none !important;
}
.prefix-link[data-refinement-pdf] .hl-page > strong { display: none !important; }
.prefix-link[data-refinement-pdf] .hl-page::after { content: attr(data-refinement-citation); }
.prefix-link[data-refinement-pdf]:hover .hl-page,
.prefix-link[data-refinement-pdf]:focus-visible .hl-page {
  opacity: 1;
  text-decoration: none !important;
}
.prefix-link[data-refinement-pdf]:focus-visible { outline: 1px solid currentColor; outline-offset: 2px; }
.page-reference:has(.prefix-link[data-refinement-pdf]),
a.page-ref:has(.prefix-link[data-refinement-pdf]) { text-decoration: none !important; }

`],
  ['dateStyle', `/* Dates use a quiet inline-code treatment with a neutral tint. */
${dateStyles(['.ls-datetime', '.timestamp', '.ls-block a.page-ref[data-refinement-date]'])}
.page-reference:has(a.page-ref[data-refinement-date])${notInTable} { text-decoration: none !important; }
.ls-block .ls-datetime a.page-ref[data-refinement-date],
.ls-block .timestamp a.page-ref[data-refinement-date],
.ls-block .ls-datetime a.page-ref[data-refinement-date]:hover,
.ls-block .timestamp a.page-ref[data-refinement-date]:hover { background: transparent !important; padding: 0; font-size: inherit; color: inherit !important; }
.ls-datetime::before { content: none !important; }
/* A date is a link to its journal page, never to a block: no dot inside the box. */
:is(.ls-datetime, .timestamp) a.page-ref .block-title-wrap::before, a.page-ref[data-refinement-date] .block-title-wrap::before { content: none !important; }
/* The time follows the date after a space, as Logseq spaces them. */
.ls-datetime > * + * { margin-left: .35em; }
/* In a property list the date keeps its box but takes the weight of the values around it. */
.property-value-container :is(.ls-datetime, .timestamp, a.page-ref[data-refinement-date]) { font-weight: inherit !important; }
/* Inside property capsules at the side or below a block, a date is plain text in the normal text colour. */
:is(html, .dark) .ls-block .positioned-properties :is(.ls-datetime, .timestamp, a.page-ref[data-refinement-date]),
:is(html, .dark) .ls-block .positioned-properties :is(.ls-datetime, .timestamp, a.page-ref[data-refinement-date]):hover,
:is(html, .dark) .ls-block .positioned-properties :is(.ls-datetime, .timestamp) :is(a, .page-reference) {
  background: transparent !important; padding: 0 !important; border-radius: 0 !important;
  color: var(--ls-primary-text-color, currentColor) !important; font-size: inherit !important; font-weight: inherit !important; text-decoration: none !important;
}
/* Date headings of a query grouped by date: one plain date box, no link styling inside it. */
${dateStyles(['.ls-view-body .ls-foldable-header [data-refinement-date-heading]']).replaceAll(notInTable, '')}
.ls-view-body .ls-foldable-header [data-refinement-date-heading] * { color: inherit !important; background: transparent !important; text-decoration: none !important; border: 0 !important; padding: 0 !important; font: inherit !important; }
.ls-view-body .ls-foldable-header [data-refinement-date-heading] *::before { content: none !important; }
.ls-datetime a.page-ref, .ls-datetime .page-reference,
.timestamp a, .timestamp .page-reference {
  color: inherit !important;
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  text-decoration: none !important;
}

`],
  [null, `/* Rarely used sidebar and toolbar items: still visible and findable, just smaller and lighter. */
[data-refinement-quiet] { font-size: var(--rf-small) !important; color: var(--ls-secondary-text-color) !important; opacity: var(--rf-quiet) !important; }
[data-refinement-quiet] :is(svg, .ui__icon) { transform: scale(.85); }

`],
  [null, `/* Links inside a reference open their own page on click. */
.ls-block a.page-ref a:is(.page-ref, .tag)[data-uuid] { cursor: pointer; }
`],
  ['quietLinks', `/* Pages inside a reference keep the faint page-link underline (tags, dates and blocks do not). */
.ls-block .block-content a.page-ref[data-uuid] a.page-ref[data-uuid]:not(.tag):not([data-refinement-date]) {
  text-decoration-line: underline !important;
  text-decoration-style: solid !important;
  text-decoration-color: color-mix(in srgb, currentColor var(--rf-line-pct), transparent) !important;
  text-decoration-thickness: 1px !important;
  text-underline-offset: .2em !important;
}
.ls-block .block-content a.page-ref[data-uuid] a.page-ref[data-uuid]:not(.tag):not([data-refinement-date]):hover {
  text-decoration-color: currentColor !important;
}

/* Inside a highlight, links and tags take the highlight's own text color so they stay readable. */
mark .page-reference:not(:has(a.tag)), mark .page-reference:has(a.tag),
mark a.page-ref:not(.tag), mark .page-reference a.page-ref:not(.tag),
.ls-block .block-content mark a.tag, mark a.page-ref:not(.tag):hover { color: inherit !important; }
/* On a highlight, page links use a muted steel blue so they stand apart from the dark highlight text.
   At least 5.2:1 on every light highlight color; the usual faint underline is kept. */
mark a.page-ref:not(.tag):not([data-refinement-date]),
mark a.page-ref:not(.tag):not([data-refinement-date]):hover,
.ls-block .block-content mark a.page-ref[data-uuid] a.page-ref[data-uuid]:not(.tag):not([data-refinement-date]) { color: #2f5d8a !important; }

`],
  [null, `/* Small page-title box (window.prompt is unreliable inside plugin sandboxes). */
.refinement-prompt-backdrop { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: flex-start; justify-content: center; padding-top: 18vh; background: rgba(0, 0, 0, .25); }
.refinement-prompt { width: min(420px, 90vw); padding: 14px 16px; border: 1px solid var(--ls-border-color); border-radius: 8px; background: var(--ls-primary-background-color); color: var(--ls-primary-text-color); box-shadow: 0 8px 28px rgba(0, 0, 0, .2); }
.refinement-prompt label { display: block; margin-bottom: 8px; font-size: .95em; }
.refinement-prompt input { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--ls-border-color); border-radius: 6px; background: transparent; color: inherit; font: inherit; }
.refinement-prompt-hint { margin-top: 6px; font-size: var(--rf-small); opacity: var(--rf-quiet); }

`],
];
// Settings whose cues are drawn per record, from the database, when the page refreshes.
const CUE_SETTINGS = ['childTypeCues', 'referenceIcons', 'linkLabels'];
const mainCss = () => cssParts.filter(([key]) => !key || setting(key)).map(([, text]) => text).join('');

// Logseq's own search (popover, and the copy kept in the right sidebar): calmer rows,
// quiet group headings and softer match highlights. Ranking and keys stay native.
const searchCss = `
.cp__cmdk-input-row { background: transparent !important; border-bottom: 1px solid var(--ls-border-color, rgba(128,128,128,.16)) !important; }
.cp__cmdk-search-input { font-size: 1.05rem !important; padding: 12px 16px !important; }
.cp__cmdk-input-row + div { background: var(--ls-primary-background-color) !important; }
.cp__cmdk__block .cp__cmdk-input-row + div { background: transparent !important; min-height: 0 !important; max-height: none !important; }
.cp__cmdk > .hints { background: transparent !important; border-top-color: var(--ls-border-color, rgba(128,128,128,.16)) !important; opacity: var(--rf-quiet); }

/* Groups: no grey bars or dividers; a small, light heading instead. */
.cp__cmdk div:has(> .search-results) { border-bottom: 0 !important; padding-bottom: 6px !important; }
.cp__cmdk div:has(> .search-results) > div:first-child:not(.search-results) {
  height: auto !important; padding: 10px 12px 3px !important; background: transparent !important;
  font-size: var(--rf-tiny) !important; letter-spacing: .05em; text-transform: uppercase; opacity: var(--rf-quiet);
}
.cp__cmdk div:has(> .search-results) > div:first-child:not(.search-results) > .font-bold { font-weight: 500 !important; }

/* Rows: compact, one weight of text, quiet icon and path. */
.cp__cmdk [data-cmdk-item] { padding: 5px 10px !important; gap: 1px !important; border-radius: 6px !important; }
.cp__cmdk [data-cmdk-item] > .flex.items-start { gap: 8px !important; }
.cp__cmdk [data-cmdk-item] > .flex.items-start > div:first-child {
  width: 16px !important; height: 20px !important; background: none !important; box-shadow: none !important;
  color: inherit !important; opacity: var(--rf-faint);
}
.cp__cmdk [data-cmdk-item] > .text-xs:first-child { padding-left: 24px !important; margin-top: 0 !important; font-size: var(--rf-tiny) !important; opacity: var(--rf-quiet); }
.cp__cmdk [data-cmdk-item] .breadcrumb a { text-decoration: none !important; }
.cp__cmdk [data-cmdk-item] .cp__cmdk-item-main-text { font-weight: 400 !important; line-height: 1.45; color: var(--ls-primary-text-color) !important; }
.cp__cmdk [data-cmdk-item] .cp__cmdk-item-main-text a { text-decoration: none !important; }
.cp__cmdk-current-page-badge { border: 0 !important; padding: 1px 6px !important; font-size: var(--rf-tiny) !important; font-weight: 400 !important; }

/* Matched words: slightly firmer text instead of a yellow block. */
.cp__cmdk mark { background: transparent !important; color: inherit !important; font-weight: 600; }
/* Typing markup such as [[ ]] and ** stays visible but faded. */
::highlight(refinement-search-markup) { color: var(--lx-gray-08, rgba(128, 128, 128, .55)); }

/* Selected and hovered rows: a faint grey wash, no outline. */
.cp__cmdk [data-cmdk-item][data-highlighted],
.cp__cmdk [data-cmdk-item][data-kb-highlighted],
.cp__cmdk [data-cmdk-item][data-hoverable][data-highlighted]:hover {
  background-color: rgba(128, 128, 128, .14) !important; box-shadow: none !important;
}
.cp__cmdk [data-cmdk-item][data-hoverable]:not([data-highlighted]):hover { background-color: rgba(128, 128, 128, .08) !important; box-shadow: none !important; }

/* Page results use the plugin's plain page rectangle. */
.cp__cmdk [data-cmdk-item] :is(svg.tabler-icon-file, svg.icon-tabler-file, svg.tabler-icon-file-description, svg.icon-tabler-file-description) {
  background: currentColor !important;
  mask: url("data:image/svg+xml,${plainPageMask}") center / contain no-repeat !important;
  -webkit-mask: url("data:image/svg+xml,${plainPageMask}") center / contain no-repeat !important;
}
.cp__cmdk [data-cmdk-item] :is(svg.tabler-icon-file, svg.icon-tabler-file, svg.tabler-icon-file-description, svg.icon-tabler-file-description) > * { visibility: hidden !important; }
`;

const titleOf = block => (block?.title || block?.content || '').trim();
// Drops a leading bullet, every trailing tag (#work, #[[Long tag]]), and the brackets around links.
const trailingTags = /(?:\s+#(?:\[\[[^\]]*\]\]|[^\s#\[\]]+))+\s*$/;
const cleanTitle = raw => raw.replace(/^[-*]\s*/, '').replace(trailingTags, '')
  .replace(/\[\[([^\]]+)\]\]/g, '$1').trim().slice(0, 180);
const notify = (message, level = 'info') => logseq.UI.showMsg(message, level);

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
// pagesOnly leaves ((uuid)) alone, matching what the block editor shows.
const storedRef = /(\(\(|\[\[)([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(\)\)|\]\])/gi;
async function readableTitle(text, { pagesOnly = false, depth = 2 } = {}) {
  const value = String(text || '');
  const names = new Map();
  for (const [, open, uuid] of value.matchAll(storedRef)) {
    const key = uuid.toLowerCase();
    if (names.has(key) || (pagesOnly && open === '((')) continue;
    let entity = null;
    try { entity = await logseq.Editor.getPage(key) || await logseq.Editor.getBlock(key); } catch (error) { /* keep the id */ }
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
  if (!block) return notify('Select a block first', 'warning');
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

/* Current-page descendant types change the existing bullet shape. */
const attribute = (node, ident, legacy) => node[ident] ?? node[':' + ident] ??
  node.properties?.[ident] ?? node.properties?.[':' + ident] ?? node.properties?.[legacy];
const entityLabel = value => String(value?.ident || value?.['db/ident'] || value?.[':db/ident'] ||
  value?.title || value?.name || value || '').replace(/^:/, '').toLowerCase();
const tagsInclude = (node, name) => (node.tags || node['block/tags'] || node[':block/tags'] || []).some(tag => {
  const label = entityLabel(tag);
  return label === name || label === 'logseq.class/' + name;
});
const ownKinds = (node, metadata) => {
  const title = titleOf(node);
  const status = attribute(node, 'logseq.property/status', 'status') ?? node.marker;
  const label = entityLabel(status).replace(/^logseq\.property\/status\./, '');
  const completed = /^(done|canceled|cancelled)$/.test(label) ||
    attribute(status || {}, 'logseq.property/choice-checkbox-state') === true;
  const typed = metadata?.get(node.uuid);
  return {
    task: typed?.task ?? (!completed && Boolean(status || tagsInclude(node, 'task'))),
    asset: Boolean(typed?.asset || attribute(node, 'logseq.property/asset', 'asset') || attribute(node, 'logseq.property.asset/type', 'asset/type') || tagsInclude(node, 'asset') ||
      /!\[[^\]]*\]\([^)]*\)|(?:^|[\s(])(?:assets\/|\.\/assets\/)/i.test(title))
  };
};
function summarize(node, badges, metadata, assetTypes) {
  const own = ownKinds(node, metadata);
  const descendants = { task: 0, asset: 0, assetTypes: new Set() };
  for (const child of node.children || []) {
    if (!child || Array.isArray(child)) continue;
    const kinds = summarize(child, badges, metadata, assetTypes);
    descendants.task += kinds.task;
    const types = assetTypes.get(child.uuid);
    if (ownKinds(child, metadata).asset || types?.size) {
      descendants.asset++;
      for (const type of types || ['asset']) descendants.assetTypes.add(type);
    }
  }
  if (UUID.test(node.uuid || '') && (descendants.task || descendants.asset))
    badges.set(node.uuid, descendants);
  return { task: Number(own.task) + descendants.task, asset: Number(own.asset) + descendants.asset };
}
function collectNodes(tree, nodes = []) {
  for (const node of tree || []) {
    if (!node || Array.isArray(node)) continue;
    nodes.push(node);
    collectNodes(node.children, nodes);
  }
  return nodes;
}
const treeIds = tree => [...new Set(collectNodes(tree).map(node => node.id).filter(isEntityId))];
function typeQuery(ids) {
  return `[:find ?uuid ?kind
    :where
    ${idsIn('?b', ids)}
    [?b :block/uuid ?uuid]
    (or-join [?b ?kind]
      (and [?b :logseq.property/status ?s]
           (not [?s :db/ident :logseq.property/status.done])
           (not [?s :db/ident :logseq.property/status.canceled])
           (not [?s :logseq.property/choice-checkbox-state true])
           [(identity "task") ?kind])
      (and [?b :block/tags ?tag]
           [?tag :db/ident :logseq.class/Task]
           (not [?b :logseq.property/status _])
           [(identity "task") ?kind])
      (and [?b :logseq.property.asset/type _] [(identity "asset") ?kind])
      (and [?b :logseq.property/asset _] [(identity "asset") ?kind])
      (and [?b :block/tags ?tag]
           [?tag :db/ident :logseq.class/Asset]
           [(identity "asset") ?kind])
      (and [?b :block/refs ?asset]
           (or-join [?asset] [?asset :logseq.property.asset/type _]
               (and [?asset :block/tags ?assetTag]
                    [?assetTag :db/ident :logseq.class/Asset]))
           [(identity "asset") ?kind]))]`;
}
async function descendantMetadata(tree) {
  const nodes = collectNodes(tree);
  const ids = treeIds(tree);
  if (!ids.length || !logseq.DB?.datascriptQuery) return undefined;
  try {
    const rows = await logseq.DB.datascriptQuery(typeQuery(ids));
    if (!Array.isArray(rows)) return undefined;
    const idSet = new Set(ids);
    const metadata = new Map(nodes.filter(node => idSet.has(node.id)).map(node => [node.uuid, { task: false, asset: false }]));
    for (const [uuid, kind] of rows) {
      if (metadata.has(uuid) && (kind === 'task' || kind === 'asset')) metadata.get(uuid)[kind] = true;
    }
    return metadata;
  } catch (error) {
    console.warn('Refinements: using block-tree type detection', error);
    return undefined;
  }
}

async function loadJournalDates() {
  if (!logseq.DB?.datascriptQuery) return undefined;
  try {
    const rows = await logseq.DB.datascriptQuery(`[:find ?uuid ?title
      :where [?journal :block/journal-day _]
      [?journal :block/uuid ?uuid]
      [(get-else $ ?journal :block/title "") ?title]]`);
    const uuids = new Set(), names = new Set();
    for (const [uuid, title] of rows || []) {
      if (!UUID.test(uuid)) continue;
      uuids.add(uuid);
      if (title) names.add(String(title).toLowerCase());
    }
    return { uuids, names };
  } catch (error) {
    console.warn('Refinements: could not load journal date identities', error);
    return undefined;
  }
}

/* Date labels are classified synchronously during DOM updates, before paint.
   Global journal styles stay installed across navigation. */
const dateLinks = { document: null, originals: new Map(), version: 0, uuids: new Set(), names: new Set() };
function dateLinkName(name) {
  const value = String(name || '').trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  const month = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const pattern = new RegExp('^(?:' + month + ' \\d{1,2},? \\d{4}|\\d{1,2} ' + month + ',? \\d{4}|\\d{4}-\\d{2}-\\d{2})$', 'i');
  return pattern.test(value) && Number.isFinite(Date.parse(value));
}
// Unique page titles may append tag names as plain text, rather than tag elements.
// Resolve the actual stored title so literal # characters and aliases remain intact.
const pageLabelTitles = new Map();
const pageLabelOriginals = new Map();
let pageLabelGeneration = 0;
function cleanPageLabel(value, title) {
  if (!title || !value.startsWith(title)) return value;
  const suffix = value.slice(title.length);
  return /^(?:\s+#[^#]+)+$/.test(suffix) ? title : value;
}
async function loadPageLabelTitles() {
  const generation = ++pageLabelGeneration;
  try {
    const rows = await logseq.DB.datascriptQuery(`[:find ?uuid ?title
      :where [?b :block/uuid ?uuid] [?b :block/title ?title] [?b :block/tags _]]`);
    if (generation !== pageLabelGeneration || !dateLinks.document || !Array.isArray(rows)) return;
    pageLabelTitles.clear();
    for (const [uuid, title] of rows) if (title) pageLabelTitles.set(String(uuid), String(title));
    updatePageLabels(dateLinks.document);
  } catch (error) { console.warn('Refinements: could not resolve stored page titles', error); }
}
function pageLabelTitle(value, uuid) {
  if (uuid && pageLabelTitles.has(uuid)) return pageLabelTitles.get(uuid);
  // Sidebar links lack UUID attributes. Prefer the longest exact stored title.
  let best = '';
  for (const title of pageLabelTitles.values()) if (title === value) return value;
  for (const title of pageLabelTitles.values()) {
    if (title.length > best.length && cleanPageLabel(value, title) !== value) best = title;
  }
  return best;
}
function updatePageLabels(doc) {
  for (const [node] of pageLabelOriginals) if (!node.isConnected) pageLabelOriginals.delete(node);
  const labels = new Map();
  for (const link of doc.querySelectorAll('a.page-ref:not(.page-property-key)')) {
    const label = link.lastElementChild;
    if (label?.tagName === 'SPAN') labels.set(label, link.getAttribute('data-uuid'));
  }
  for (const label of doc.querySelectorAll('a.link-item .page-title')) labels.set(label, null);
  for (const [label, uuid] of labels) {
    // Leave nested links, editors, and rich block excerpts intact.
    if (label.querySelector('a, input, textarea, button, .block-title-wrap, [contenteditable]')) continue;
    const value = label.textContent;
    if (!/\s+#/.test(value)) continue;
    const cleaned = cleanPageLabel(value, pageLabelTitle(value, uuid));
    if (cleaned === value) continue;
    const walker = doc.createTreeWalker(label, 4), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let remaining = cleaned.length;
    for (const node of nodes) {
      const original = node.nodeValue;
      const keep = original.slice(0, Math.max(remaining, 0));
      remaining -= original.length;
      if (keep !== original) {
        pageLabelOriginals.set(node, { original, cleaned: keep });
        node.nodeValue = keep;
      }
    }
  }
}
function restorePageLabels() {
  ++pageLabelGeneration;
  for (const [node, record] of pageLabelOriginals) {
    if (node.nodeValue === record.cleaned) node.nodeValue = record.original;
  }
  pageLabelOriginals.clear();
  pageLabelTitles.clear();
}
const refRows = new Set();
function referenceOnly(row) {
  const wrap = [...row.querySelectorAll('.block-title-wrap')]
    .find(el => el.closest('.ls-block[blockid]') === row && !el.parentElement?.closest('a.page-ref'));
  if (!wrap) return false;
  const links = [...wrap.querySelectorAll('a.page-ref')].filter(a => !a.parentElement?.closest('a.page-ref'));
  if (links.length !== 1 || !links[0].querySelector('.block-title-wrap')) return false;
  if (links[0].querySelector('.prefix-link, .hl-page, img')) return false; // PDF citations and images keep their own look
  // Brackets around the link are Logseq's own (shown when "show brackets" is on), not text of the row.
  const squash = text => text.replace(/\s+|\[\[|\]\]/g, '');
  let text = wrap.textContent;
  for (const cue of wrap.querySelectorAll('.refinement-child-assets')) text = text.replace(cue.textContent, '');
  return squash(text) === squash(links[0].textContent);
}
function updateReferenceRows(doc) {
  const rows = new Set();
  for (const title of doc.querySelectorAll('a.page-ref .block-title-wrap')) {
    const row = title.closest('.ls-block[blockid]');
    if (row && !rows.has(row) && referenceOnly(row)) rows.add(row);
  }
  for (const row of refRows) if (!rows.has(row)) { row.removeAttribute('data-refinement-ref-row'); refRows.delete(row); }
  for (const row of rows) if (!refRows.has(row)) { row.setAttribute('data-refinement-ref-row', ''); refRows.add(row); }
}
// Logseq groups reference rows by parent and shows one grey path for the group, taken from
// whichever row it saw first. A property value's path is the property's name, so that name can
// end up above ordinary blocks. The value carries its own label, so hide such a lone name.
const REFERENCE_AREAS = '.references, .unlinked-references, .references-blocks-wrap';
const referenceAreas = `:is(${REFERENCE_AREAS})`;
const propertyCrumbs = { values: new Map(), marked: new Set(), boxes: new Map() };
function updatePropertyCrumbs(doc) {
  const found = new Set();
  if (propertyCrumbs.values.size) {
    for (const crumb of doc.querySelectorAll(`${referenceAreas} .breadcrumb.block-parents`)) {
      const labels = [...crumb.querySelectorAll('.breadcrumb__label')].map(label => label.textContent.trim());
      const group = crumb.parentElement?.parentElement;
      if (labels.length !== 1 || !group) continue;
      const hasValue = [...group.querySelectorAll('.ls-block[blockid]')]
        .some(block => propertyCrumbs.values.get(block.getAttribute('blockid')) === labels[0]);
      if (hasValue) found.add(crumb);
    }
  }
  for (const crumb of propertyCrumbs.marked) if (!found.has(crumb)) unmarkPropertyCrumb(crumb);
  for (const crumb of found) {
    if (!propertyCrumbs.marked.has(crumb)) { crumb.setAttribute('data-refinement-property-crumb', ''); propertyCrumbs.marked.add(crumb); }
    // The line is hidden through the box Logseq draws it in. The box itself is marked, so the rule
    // that hides it is a plain one (it used to ask every div on the page whether it held such a line).
    const box = crumb.parentElement?.tagName === 'DIV' ? crumb.parentElement : null;
    if (propertyCrumbs.boxes.get(crumb) !== box) {
      propertyCrumbs.boxes.get(crumb)?.removeAttribute('data-refinement-crumb-box');
      if (box) { box.setAttribute('data-refinement-crumb-box', ''); propertyCrumbs.boxes.set(crumb, box); } else propertyCrumbs.boxes.delete(crumb);
    }
  }
}
function unmarkPropertyCrumb(crumb) {
  crumb.removeAttribute('data-refinement-property-crumb');
  propertyCrumbs.boxes.get(crumb)?.removeAttribute('data-refinement-crumb-box');
  propertyCrumbs.boxes.delete(crumb);
  propertyCrumbs.marked.delete(crumb);
}
/* Cues that depend on what the database says about a link or a row. The answer is kept, and each
   element it applies to is marked as it is drawn, so one fixed set of rules does the drawing however
   large the graph is (there used to be four rules for every referenced block in the graph):
   - a link to a block drawn without the block's title area (a link with its own label) gets the dot;
   - a property value listed under Linked references starts with its property's name ("Doctor:");
   - a record listed under a page's tag tabs ends with the property that links it ("via Diagnosis"). */
const cueMarks = { blockUuids: new Set(), incoming: new Map(), marked: new Map() };
const blockLink = '.page-ref[data-refinement-block-link]:not(.tag):not([data-refinement-date])';
// Browsers reject a :has() inside another :has(), and one bad selector discards a whole rule, so
// the check on the surrounding reference uses the plain form.
const blockLinkPlain = blockLink + ':not(:has(.prefix-link, img))';
const viaLook = 'margin-left: .6em; color: var(--ls-secondary-text-color, inherit); opacity: var(--rf-quiet); font-size: var(--rf-small); font-weight: 400; white-space: nowrap;';
const cueCss = `${blockDot(blockLinkPlain + ':not(:has(.block-title-wrap))')}
/* A block (not a page) shown inside another reference stays without an underline. */
.ls-block .block-content a.page-ref[data-uuid] ${blockLinkPlain}.page-ref, .ls-block .block-content a.page-ref[data-uuid] ${blockLinkPlain}.page-ref:hover { text-decoration: none !important; }
.ls-block ${blockLinkPlain}, .ls-block ${blockLinkPlain}:hover, .ls-block ${blockLinkPlain} * { text-decoration: none !important; border-bottom: 0 !important; }
.ls-block .page-reference:has(${blockLink}):not(:has(.prefix-link, img)), .ls-block .page-reference:has(${blockLink}):not(:has(.prefix-link, img)):hover { text-decoration: none !important; border-bottom: 0 !important; }
/* In references, a property value is introduced by its property's name in muted text. */
${referenceAreas} .ls-block[blockid] > .block-main-container .block-content-wrapper[data-refinement-prop-label]::before { content: attr(data-refinement-prop-label); flex: none; align-self: baseline; margin-right: .4em; color: var(--ls-secondary-text-color, inherit); opacity: var(--rf-quiet); white-space: nowrap; }
/* "via Diagnosis" sits right after the record's title, on the same text line; for a row drawn
   without a title area, at the end of the row. */
.ls-block[blockid] > .block-main-container .block-content-wrapper .block-title-wrap[data-refinement-via]::after { content: attr(data-refinement-via); display: inline; ${viaLook} }
.ls-block[blockid] > .block-main-container .block-content-wrapper[data-refinement-via]::after { content: attr(data-refinement-via); flex: none; align-self: center; ${viaLook} }`;
function updateCueMarks(doc) {
  const found = new Map(); // element -> [attribute, value]
  if (cueMarks.blockUuids.size) {
    for (const link of doc.querySelectorAll('.page-ref[data-uuid], .page-ref[data-ref]')) {
      const uuid = link.getAttribute('data-uuid'), ref = link.getAttribute('data-ref');
      if (cueMarks.blockUuids.has(uuid) || (ref && cueMarks.blockUuids.has(ref.toLowerCase()))) found.set(link, ['data-refinement-block-link', '']);
    }
  }
  if (setting('linkLabels')) {
    const wrapperOf = row => [...row.querySelectorAll('.block-content-wrapper')].find(el => el.closest('.ls-block[blockid]') === row);
    if (propertyCrumbs.values.size) {
      for (const row of doc.querySelectorAll(`${referenceAreas} .ls-block[blockid]`)) {
        const name = propertyCrumbs.values.get(row.getAttribute('blockid'));
        const wrapper = name && wrapperOf(row);
        if (wrapper) found.set(wrapper, ['data-refinement-prop-label', name + ':']);
      }
    }
    if (cueMarks.incoming.size) {
      for (const row of doc.querySelectorAll('.ls-block[blockid]')) {
        const uuid = row.getAttribute('blockid'), names = cueMarks.incoming.get(uuid);
        // The page's own blocks say so in their properties, and Linked references already show the property.
        if (!names || listProps.pageBlocks.has(uuid) || row.closest(REFERENCE_AREAS)) continue;
        const wrapper = wrapperOf(row);
        if (!wrapper) continue;
        const label = 'via ' + [...names].join(', ');
        const titles = wrapper.querySelectorAll('.block-title-wrap');
        if (titles.length) for (const title of titles) found.set(title, ['data-refinement-via', label]);
        else found.set(wrapper, ['data-refinement-via', label]);
      }
    }
  }
  for (const [el, [attr]] of cueMarks.marked) {
    if (found.get(el)?.[0] !== attr) { el.removeAttribute(attr); cueMarks.marked.delete(el); }
  }
  for (const [el, mark] of found) {
    if (el.getAttribute(mark[0]) !== mark[1]) el.setAttribute(mark[0], mark[1]);
    cueMarks.marked.set(el, mark);
  }
}
function fadeCrumbBrackets(doc) {
  const win = doc.defaultView;
  if (!win.CSS?.highlights || !win.Highlight) return;
  const ranges = [];
  for (const label of doc.querySelectorAll('.breadcrumb .breadcrumb__label')) {
    const walker = doc.createTreeWalker(label, win.NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const match of node.nodeValue.matchAll(/\[\[|\]\]/g)) {
        const range = doc.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + 2);
        ranges.push(range);
      }
    }
  }
  win.CSS.highlights.set('refinement-crumb-markup', new win.Highlight(...ranges));
}
// The heading of each group when a query is grouped by a date: mark the part that holds the date.
const dateHeadings = new Set();
function isJournalDate(text) {
  return dateLinkName(text) || dateLinks.names.has(String(text || '').trim().toLowerCase());
}
function updateDateHeadings(doc) {
  const found = new Set();
  for (const header of doc.querySelectorAll('.ls-view-body .ls-foldable-header')) {
    const title = [...header.children].find(el => !el.matches('.ls-foldable-title-control'));
    if (!title || !isJournalDate(title.textContent)) continue;
    let target = title;
    for (let inner = target.firstElementChild; inner && inner.textContent.trim() === target.textContent.trim() &&
      target.children.length === 1; inner = target.firstElementChild) target = inner;
    found.add(target);
  }
  for (const el of dateHeadings) if (!found.has(el)) { el.removeAttribute('data-refinement-date-heading'); dateHeadings.delete(el); }
  for (const el of found) { if (!el.hasAttribute('data-refinement-date-heading')) el.setAttribute('data-refinement-date-heading', ''); dateHeadings.add(el); }
}
// Under Linked references, the heading of a source page says how many references it holds.
const refCounts = new Set();
function updateReferenceCounts(doc) {
  const found = new Map();
  if (setting('referenceLayout')) for (const title of doc.querySelectorAll('#main-content-container .references .group-list-view .ls-foldable-title')) {
    // The heading of a whole list (a page shown inside a reference has its own Linked references) is not a source page.
    if (title.querySelector('.ls-view-head')) continue;
    const header = title.querySelector('.ls-foldable-header');
    // Only the references themselves: what an open reference shows inside it (children, property values,
    // a page's own references) are blocks too, and are not counted.
    const content = title.parentElement.querySelector(':scope > .ls-foldable-content');
    const count = content ? [...content.querySelectorAll('.ls-block[level="0"]')].filter(block => {
      const outer = block.parentElement.closest('.ls-block');
      return !outer || !content.contains(outer);
    }).length : 0;
    if (header && count > 1) found.set(header, String(count));
  }
  for (const el of refCounts) if (!found.has(el)) { el.removeAttribute('data-refinement-ref-count'); refCounts.delete(el); }
  for (const [el, count] of found) { if (el.getAttribute('data-refinement-ref-count') !== count) el.setAttribute('data-refinement-ref-count', count); refCounts.add(el); }
}
function updateDateLinks() {
  const doc = dateLinks.document;
  if (!doc) return;
  for (const part of [updateReferenceRows, updateChildAssetCues, updatePropertyCrumbs, fadeCrumbBrackets,
    updatePageLabels, updateDateHeadings, updateReferenceCounts, updateTagPageLinks, updateCueMarks]) perf.time(part.name, () => part(doc));
  for (const [link] of dateLinks.originals) if (!link.isConnected) dateLinks.originals.delete(link);
  for (const link of doc.querySelectorAll('a.page-ref[data-ref], a.page-ref[data-uuid]')) {
    if (dateLinkName(link.getAttribute('data-ref')) || dateLinks.uuids.has(link.getAttribute('data-uuid')) ||
        dateLinks.names.has(String(link.getAttribute('data-ref') || '').toLowerCase())) {
      if (!dateLinks.originals.has(link)) dateLinks.originals.set(link, link.getAttribute('data-refinement-date'));
      if (!link.hasAttribute('data-refinement-date')) link.setAttribute('data-refinement-date', '');
    } else if (dateLinks.originals.has(link)) {
      const original = dateLinks.originals.get(link);
      if (original === null) link.removeAttribute('data-refinement-date');
      else link.setAttribute('data-refinement-date', original);
      dateLinks.originals.delete(link);
    }
  }
}
// Tag pages: a [[link]] to one looks like any page link, and a tag's # and icon can be customised,
// so links to them are marked from the database and their icon is drawn in grey.
const tagPages = { uuids: new Set(), marked: new Set() };
async function loadTagPages() {
  try {
    const rows = await dsQuery(`[:find ?uuid
      :where [?tag :block/tags ?class] [?class :db/ident :logseq.class/Tag] [?tag :block/uuid ?uuid]]`);
    tagPages.uuids = new Set(rows.map(([uuid]) => String(uuid)).filter(uuid => UUID.test(uuid)));
  } catch (error) { console.warn('Refinements: could not find tag pages', error); }
}
function updateTagPageLinks(doc) {
  const found = new Set();
  if (tagPages.uuids.size) {
    for (const link of doc.querySelectorAll('a.page-ref[data-uuid]:not(.tag)'))
      if (tagPages.uuids.has(link.getAttribute('data-uuid'))) found.add(link);
  }
  for (const link of tagPages.marked) if (!found.has(link)) { link.removeAttribute('data-refinement-tag-page'); tagPages.marked.delete(link); }
  for (const link of found) if (!tagPages.marked.has(link)) { link.setAttribute('data-refinement-tag-page', ''); tagPages.marked.add(link); }
}
async function refreshJournalDates() {
  const version = ++dateLinks.version;
  const [dates] = await Promise.all([loadJournalDates(), loadTagPages()]);
  if (version !== dateLinks.version || !dates) return;
  dateLinks.uuids = dates.uuids;
  dateLinks.names = dates.names;
  updateDateLinks();
}
function startDateLinks() {
  try {
    const doc = host();
    dateLinks.document = doc;
    updateDateLinks();
    // Early: this runs before the screen is painted, so the native look never flashes.
    watchDomEarly(updateDateLinks);
    onUnload(stopDateLinks);
  } catch (error) { console.warn('Refinements: immediate date styling is unavailable', error); }
  refreshJournalDates();
  loadPageLabelTitles();
}
function stopDateLinks() {
  try { dateLinks.document?.defaultView?.CSS?.highlights?.delete('refinement-crumb-markup'); } catch {}
  for (const row of refRows) row.removeAttribute('data-refinement-ref-row');
  refRows.clear();
  for (const el of dateHeadings) el.removeAttribute('data-refinement-date-heading');
  dateHeadings.clear();
  for (const el of refCounts) el.removeAttribute('data-refinement-ref-count');
  refCounts.clear();
  for (const crumb of [...propertyCrumbs.marked]) unmarkPropertyCrumb(crumb);
  for (const [el, [attr]] of cueMarks.marked) el.removeAttribute(attr);
  cueMarks.marked.clear();
  ++dateLinks.version;
  restorePageLabels();
  childAssetCues.clear();
  for (const cue of dateLinks.document?.querySelectorAll('.refinement-child-assets') || []) cue.remove();
  for (const [link, original] of dateLinks.originals) {
    if (original === null) link.removeAttribute('data-refinement-date');
    else link.setAttribute('data-refinement-date', original);
  }
  dateLinks.originals.clear();
  for (const link of tagPages.marked) link.removeAttribute('data-refinement-tag-page');
  tagPages.marked.clear();
  dateLinks.document = null;
}

/* Move native PDF links, keeping Logseq's own highlight-navigation handler. */
const pdfCitations = { document: null, records: new Map(), blocks: new Map(), sources: new Map(), pageUuid: null };
async function pdfAnnotationSources(tree) {
  const ids = treeIds(tree);
  let page;
  try {
    page = await logseq.Editor.getCurrentPage?.();
    if (!ids.length || !logseq.DB?.datascriptQuery) return { sources: new Map(), pageUuid: page?.uuid };
    const rows = await logseq.DB.datascriptQuery(`[:find ?uuid ?page ?sourceUuid ?title
      :where ${idsIn('?b', ids)}
      (or-join [?b ?annotation]
        [(identity ?b) ?annotation]
        [?b :block/refs ?annotation])
      [?annotation :logseq.property.pdf/hl-page ?page]
      [?annotation :block/uuid ?uuid]
      [?annotation :logseq.property/asset ?source]
      [?source :block/uuid ?sourceUuid]
      [(get-else $ ?source :block/title "PDF") ?title]]`);
    const sources = new Map();
    for (const [uuid, number, sourceUuid, title] of rows || []) {
      if (UUID.test(uuid) && UUID.test(sourceUuid)) sources.set(uuid, { page: number, sourceUuid, title: String(title || 'PDF') });
    }
    return { sources, pageUuid: page?.uuid };
  } catch (error) {
    console.warn('Refinements: could not resolve PDF citation titles', error);
    return { sources: new Map(), pageUuid: page?.uuid };
  }
}
function pdfCitationIdentity(prefix) {
  const link = prefix.closest('a.page-ref[data-uuid]');
  const reference = prefix.closest('.page-reference[data-ref]');
  return link?.getAttribute('data-uuid') || reference?.getAttribute('data-ref') ||
    prefix.closest('.ls-block[blockid]')?.getAttribute('blockid');
}
function pdfSourceContext(prefix, sourceUuid) {
  if (!sourceUuid) return false;
  if (pdfCitations.pageUuid === sourceUuid) return true;
  let block = prefix.closest('.ls-block[blockid]');
  while (block) {
    if (block.getAttribute('blockid') === sourceUuid) return true;
    block = block.parentElement?.closest('.ls-block[blockid]');
  }
  return false;
}
function updatePdfCitations() {
  const doc = pdfCitations.document;
  if (!doc) return;
  {
    if (!setting('pdfCitations')) return restorePdfCitations();
    for (const [prefix] of pdfCitations.records) {
      if (!prefix.isConnected) pdfCitations.records.delete(prefix);
    }
    const activeBlocks = new Set();
    for (const prefix of doc.querySelectorAll('.block-title-wrap > .prefix-link:has(> .hl-page)')) {
      const wrap = prefix.parentElement;
      const label = prefix.querySelector(':scope > .hl-page');
      const nativeLabel = label?.querySelector('strong');
      const pageMatch = nativeLabel?.textContent.trim().match(/^P\s*(\d+|\?)$/i);
      if (!label || !pageMatch || wrap.querySelector('textarea, [contenteditable="true"]')) continue;
      const block = wrap.closest('.ls-block[blockid]');
      if (block) {
        activeBlocks.add(block);
        if (!pdfCitations.blocks.has(block)) pdfCitations.blocks.set(block, block.getAttribute('data-refinement-pdf-citation-block'));
        block.setAttribute('data-refinement-pdf-citation-block', '');
      }
      const area = wrap.getAttribute('data-hl-type') === 'area';
      let record = pdfCitations.records.get(prefix);
      if (!record) {
        const attributes = new Map(['title', 'aria-label', 'role', 'tabindex', 'data-refinement-pdf']
          .map(name => [name, prefix.getAttribute(name)]));
        const onKeyDown = event => {
          if (event.target !== prefix) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          const Event = doc.defaultView.PointerEvent || doc.defaultView.MouseEvent;
          prefix.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
        };
        const plainExcerptTarget = event => {
          if (area || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
              prefix.contains(event.target)) return false;
          const element = event.target.nodeType === 1 ? event.target : event.target.parentElement;
          const control = element?.closest('a, button, input, textarea, select, [contenteditable="true"], [role="button"]');
          return !control || !wrap.contains(control);
        };
        const onMouseDown = event => {
          // Allow a normal text-selection drag without starting Logseq's editor.
          if (plainExcerptTarget(event)) event.stopPropagation();
        };
        const onLineClick = event => {
          if (!plainExcerptTarget(event)) return;
          const selection = doc.getSelection();
          if (selection && !selection.isCollapsed &&
              (wrap.contains(selection.anchorNode) || wrap.contains(selection.focusNode))) return;
          event.preventDefault();
          event.stopPropagation();
          const Event = doc.defaultView.PointerEvent || doc.defaultView.MouseEvent;
          prefix.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
        };
        record = { wrap, label, next: prefix.nextSibling, labelNext: label.nextSibling, attributes,
          citation: label.getAttribute('data-refinement-citation'), area, onKeyDown, onMouseDown, onLineClick,
          lineAttribute: wrap.getAttribute('data-refinement-pdf-line') };
        pdfCitations.records.set(prefix, record);
        prefix.addEventListener('keydown', onKeyDown);
        wrap.addEventListener('mousedown', onMouseDown);
        wrap.addEventListener('click', onLineClick);
        if (!area) wrap.setAttribute('data-refinement-pdf-line', '');
        prefix.setAttribute('role', 'link');
        prefix.setAttribute('tabindex', '0');
      }
      // Area selections keep their image in place; only the page label moves.
      if (area) {
        if (label !== prefix.firstChild) prefix.insertBefore(label, prefix.firstChild);
      } else if (prefix !== wrap.firstChild) {
        wrap.insertBefore(prefix, wrap.firstChild);
      }
      const source = pdfCitations.sources.get(pdfCitationIdentity(prefix));
      const page = pageMatch[1] === '?' ? source?.page ?? '?' : pageMatch[1];
      const fullTitle = source?.title || 'PDF highlight';
      const shortTitle = fullTitle.replace(/\.pdf$/i, '');
      const compactTitle = shortTitle.length > 38 ? shortTitle.slice(0, 35).trimEnd() + '…' : shortTitle;
      const suffix = `p. ${page}`;
      const citation = source && !pdfSourceContext(prefix, source.sourceUuid) ? `${suffix} · ${compactTitle}` : suffix;
      prefix.setAttribute('data-refinement-pdf', area ? 'area' : 'text');
      label.setAttribute('data-refinement-citation', citation);
      prefix.setAttribute('title', `${fullTitle} · ${suffix}`);
      prefix.setAttribute('aria-label', `Open PDF highlight: ${fullTitle}, page ${page}`);
    }
    for (const [block, original] of pdfCitations.blocks) {
      if (activeBlocks.has(block)) continue;
      if (original === null) block.removeAttribute('data-refinement-pdf-citation-block');
      else block.setAttribute('data-refinement-pdf-citation-block', original);
      pdfCitations.blocks.delete(block);
    }
  }
}
function startPdfCitations() {
  try {
    const doc = host();
    if (!doc.body) return;
    pdfCitations.document = doc;
    // Early (before paint), so the native citation never flashes.
    watchDomEarly(updatePdfCitations);
    updatePdfCitations();
    onUnload(stopPdfCitations);
  } catch (error) {
    console.warn('Refinements: PDF citation presentation is unavailable', error);
    notify('PDF citation styling could not access the Logseq window.', 'warning');
  }
}
function stopPdfCitations() {
  restorePdfCitations();
  pdfCitations.document = null;
}
// Puts every citation back the way Logseq drew it.
function restorePdfCitations() {
  for (const [prefix, record] of pdfCitations.records) {
    prefix.removeEventListener('keydown', record.onKeyDown);
    record.wrap.removeEventListener('mousedown', record.onMouseDown);
    record.wrap.removeEventListener('click', record.onLineClick);
    if (record.lineAttribute === null) record.wrap.removeAttribute('data-refinement-pdf-line');
    else record.wrap.setAttribute('data-refinement-pdf-line', record.lineAttribute);
    for (const [name, value] of record.attributes) {
      if (value === null) prefix.removeAttribute(name); else prefix.setAttribute(name, value);
    }
    if (record.citation === null) record.label.removeAttribute('data-refinement-citation');
    else record.label.setAttribute('data-refinement-citation', record.citation);
    if (record.area && record.label.parentElement === prefix) {
      prefix.insertBefore(record.label, record.labelNext?.parentNode === prefix ? record.labelNext : prefix.firstChild);
    } else if (prefix.parentElement === record.wrap) {
      record.wrap.insertBefore(prefix, record.next?.parentNode === record.wrap ? record.next : record.wrap.firstChild);
    }
  }
  pdfCitations.records.clear();
  for (const [block, original] of pdfCitations.blocks) {
    if (original === null) block.removeAttribute('data-refinement-pdf-citation-block');
    else block.setAttribute('data-refinement-pdf-citation-block', original);
  }
  pdfCitations.blocks.clear();
}

const childAssetCues = new Map();
// What sits below a block, written after its text: ↳, then a dashed circle and a count for
// unfinished tasks at any depth, then an icon for each kind of file directly below.
function updateChildAssetCues(doc) {
  for (const cue of doc.querySelectorAll('.refinement-child-assets')) {
    const uuid = cue.closest('.ls-block[blockid]')?.getAttribute('blockid');
    if (!childAssetCues.has(uuid)) cue.remove();
  }
  // Cues of blocks that no longer have one were removed above, so only blocks with a cue to show
  // need looking at, and with none to show there is nothing more to do.
  if (!childAssetCues.size) return;
  for (const block of doc.querySelectorAll('.ls-block[blockid]')) {
    const uuid = block.getAttribute('blockid'), kinds = childAssetCues.get(uuid);
    if (!kinds) continue;
    const wrap = [...block.querySelectorAll('.block-title-wrap')].find(el => el.closest('.ls-block[blockid]') === block);
    if (!wrap) continue;
    const old = [...wrap.children].find(el => el.classList.contains('refinement-child-assets'));
    if (block.querySelector('textarea, [contenteditable="true"]')) { old?.remove(); continue; }
    const types = kinds.asset ? [...kinds.assetTypes].sort() : [];
    const signature = `${kinds.task}|${kinds.asset}|${types.join(',')}`;
    if (old?.getAttribute('data-types') === signature) continue;
    old?.remove();
    const label = [kinds.task && `${kinds.task} unfinished task${kinds.task === 1 ? '' : 's'} below`,
      kinds.asset && `${kinds.asset} file${kinds.asset === 1 ? '' : 's'} directly below`].filter(Boolean).join(' · ');
    const cue = doc.createElement('span');
    cue.className = 'refinement-child-assets';
    cue.setAttribute('data-types', signature);
    cue.setAttribute('contenteditable', 'false');
    cue.setAttribute('aria-label', label);
    cue.setAttribute('title', label);
    cue.appendChild(doc.createTextNode('↳'));
    const icon = name => {
      const el = doc.createElement('span');
      el.className = `refinement-child-${name}`;
      el.setAttribute('aria-hidden', 'true');
      cue.appendChild(el);
    };
    if (kinds.task) { icon('task'); cue.appendChild(doc.createTextNode(String(kinds.task))); }
    for (const type of types) icon(`asset-${type}`);
    wrap.appendChild(cue);
  }
}
async function directAssetTypes(tree) {
  const ids = treeIds(tree);
  const result = new Map();
  if (!ids.length) return result;
  try {
    const rows = await logseq.DB.datascriptQuery(`[:find ?uuid ?type
      :where ${idsIn('?b', ids)} [?b :block/uuid ?uuid]
      (or-join [?b ?asset] [(identity ?b) ?asset] [?b :block/refs ?asset] [?b :logseq.property/asset ?asset])
      [?asset :logseq.property.asset/type ?type]]`);
    for (const [uuid, type] of rows || []) {
      const label = String(type).replace(/^:/, '').toLowerCase();
      const kind = label === 'pdf' ? 'pdf' : /^(png|jpe?g|gif|webp|svg|avif|heic|bmp|tiff?)$/.test(label) ? 'image' : 'asset';
      const key = String(uuid);
      if (!result.has(key)) result.set(key, new Set());
      result.get(key).add(kind);
    }
  } catch (error) { console.warn('Refinements: could not identify child asset types', error); }
  // File-graph fallback and readable DB titles.
  for (const node of collectNodes(tree)) {
    if (result.has(node.uuid)) continue;
    const title = titleOf(node), raw = attribute(node, 'logseq.property.asset/type', 'asset/type');
    const types = new Set();
    if (String(raw).toLowerCase() === 'pdf' || /\.pdf(?:[)\s?#]|$)/i.test(title)) types.add('pdf');
    if (/^(png|jpe?g|gif|webp|svg|avif|heic)$/i.test(String(raw)) || /\.(?:png|jpe?g|gif|webp|svg|avif|heic)(?:[)\s?#]|$)/i.test(title)) types.add('image');
    if (types.size) result.set(node.uuid, types);
  }
  return result;
}
async function referencedNodeIds() {
  try {
    const rows = await logseq.DB.datascriptQuery(`[:find ?uuid
      :where [?source :block/refs ?target] [?target :block/uuid ?uuid]
      [?target :block/parent ?parent]
      (not [?target :block/name _])
      (not-join [?target] [?target :block/tags ?pageTag]
        [?pageTag :db/ident :logseq.class/Page])
      (not-join [?target] [?target :block/tags ?tagClass]
        [?tagClass :db/ident :logseq.class/Tag])
      (not [?target :block/journal-day _])
      (not [?target :logseq.property.asset/type _])
      (not [?target :logseq.property.pdf/hl-page _]) ]`);
    return new Set((rows || []).map(([uuid]) => String(uuid)).filter(uuid => UUID.test(uuid)));
  } catch (error) {
    console.warn('Refinements: could not identify linked nodes', error);
    return new Set();
  }
}
// Property values that are blocks (text-type properties) show up in Linked references looking like
// ordinary bullets. Find them, with their property's name, so they can carry a small label.
async function propertyValueBlocks() {
  try {
    const rows = await logseq.DB.datascriptQuery(`[:find ?uuid ?name
      :where [?value :logseq.property/created-from-property ?property]
      [?value :block/refs _]
      [?value :block/uuid ?uuid]
      [?property :block/title ?name]]`);
    const result = new Map();
    for (const [uuid, name] of rows || []) if (UUID.test(String(uuid)) && name) result.set(String(uuid), String(name));
    return result;
  } catch (error) {
    console.warn('Refinements: could not identify property values', error);
    return new Map();
  }
}
// Records that point at the open page through one of your own Node properties (for example a test
// whose Diagnosis is this page). Logseq lists them under tag tabs below the page's properties but
// doesn't say which property links them, so collect each record with its property names.
async function incomingPropertyLinks() {
  const result = new Map();
  try {
    const page = await logseq.Editor.getCurrentPage?.();
    const id = page?.id;
    if (!isEntityId(id) || !logseq.DB?.datascriptQuery) return result;
    const rows = await logseq.DB.datascriptQuery(`[:find ?uuid ?name ?attr
      :where [(identity ${id}) ?page]
      [?prop :block/tags ?class]
      [?class :db/ident :logseq.class/Property]
      [?prop :db/ident ?attr]
      [?b ?attr ?page]
      [?prop :block/title ?name]
      [?b :block/uuid ?uuid]]`);
    for (const [uuid, name, attr] of rows || []) {
      // Only properties you made; built-in links such as tags, aliases and parents are left out.
      if (!UUID.test(String(uuid)) || !name || !/^:?user\.property\//.test(String(attr))) continue;
      const key = String(uuid);
      if (!result.has(key)) result.set(key, new Set());
      result.get(key).add(String(name));
    }
  } catch (error) { console.warn('Refinements: could not find records linking to this page', error); }
  return result;
}
let refreshTimer;
let refreshVersion = 0;
// The Journals list shows several pages at once and Logseq names none of them as the current page,
// so the blocks of every page whose title is on screen are read instead.
async function shownPagesTree() {
  const doc = dateLinks.document;
  if (!doc) return [];
  const uuids = [...new Set([...pageTitles(doc)].map(title => title.querySelector('.ls-block[blockid]')?.getAttribute('blockid') || '')
    .filter(uuid => UUID.test(uuid)))].slice(0, 12);
  const trees = await Promise.all(uuids.map(async uuid => {
    try {
      const tree = await logseq.Editor.getPageBlocksTree(uuid);
      if (tree?.length) return tree;
      const page = await logseq.Editor.getPage(uuid);
      const name = page?.name || page?.title || page?.originalName;
      return name ? await logseq.Editor.getPageBlocksTree(name) || [] : [];
    } catch { return []; }
  }));
  return trees.flat().filter(Boolean);
}
async function refreshCues(version = ++refreshVersion) {
  const started = performance.now();
  try {
    let tree = await logseq.Editor.getCurrentPageBlocksTree();
    if (!tree?.length) tree = await shownPagesTree();
    const [metadata, pdfSources, nodeIds, assetTypes, propertyValues, incoming] = await Promise.all([descendantMetadata(tree), pdfAnnotationSources(tree), referencedNodeIds(), directAssetTypes(tree), propertyValueBlocks(), incomingPropertyLinks()]);
    if (version !== refreshVersion) return;
    pdfCitations.sources = pdfSources.sources;
    pdfCitations.pageUuid = pdfSources.pageUuid;
    listProps.pageBlocks = new Set(collectNodes(tree).map(node => String(node.uuid)));
    if (dateLinks.document) updateListProps(dateLinks.document);
    updatePdfCitations();
    const badges = new Map();
    for (const block of tree || []) summarize(block, badges, metadata, assetTypes);
    childAssetCues.clear();
    if (setting('childTypeCues')) for (const [uuid, kinds] of badges) childAssetCues.set(uuid, kinds);
    if (dateLinks.document) updateChildAssetCues(dateLinks.document);
    // UUID syntax alone also identifies pages. Only database-confirmed blocks count as block links.
    cueMarks.blockUuids = setting('referenceIcons') ? nodeIds : new Set();
    propertyCrumbs.values = propertyValues;
    if (dateLinks.document) updatePropertyCrumbs(dateLinks.document);
    cueMarks.incoming = incoming;
    if (dateLinks.document) updateCueMarks(dateLinks.document);
    perf.add('refreshCues (start to finish)', performance.now() - started);
  } catch (error) {
    if (version !== refreshVersion) return;
    childAssetCues.clear();
    if (dateLinks.document) updateChildAssetCues(dateLinks.document);
    cueMarks.blockUuids = new Set();
    cueMarks.incoming = new Map();
    if (dateLinks.document) updateCueMarks(dateLinks.document);
    console.warn('Refinements: could not refresh current-page cues', error);
  }
}
function scheduleRefresh(delay = 300) {
  clearTimeout(refreshTimer);
  const version = ++refreshVersion;
  refreshTimer = setTimeout(() => refreshCues(version), delay);
}

/* Troubleshooting: describe how Logseq built one block, so styling can target the real structure.
   Text is shortened to a few words; nothing is changed or sent anywhere. */
// First line of every troubleshooting report: this plugin's and Logseq's version.
// The Logseq version whose page structure the plugin was last checked against. Most of what the
// plugin draws depends on names Logseq uses inside its own pages, which can change in any release.
const CHECKED_WITH = '2.0.2';
async function versionLine() {
  let logseqVersion = '?';
  try { logseqVersion = (await logseq.App.getInfo('version')) || '?'; } catch (error) { /* ignore */ }
  const note = logseqVersion !== '?' && logseqVersion !== CHECKED_WITH ? ` (the plugin was last checked against Logseq ${CHECKED_WITH})` : '';
  return `DB Refinements ${logseq.baseInfo?.version || '?'} · Logseq ${logseqVersion}${note}`;
}
/* Troubleshooting after a Logseq update: how many of each thing the plugin looks for are on screen.
   A zero is normal when the page has none of that thing; a zero for something you can see on the
   page means Logseq renamed it, and the features listed beside it have stopped. Nothing is changed. */
const healthChecks = () => [
  ['the page area', '#main-content-container', 'everything'],
  ['blocks', '.ls-block[blockid]', 'cues, reference rows, list properties, fold all'],
  ['block text', '.block-title-wrap', 'cues after a block, block-link dot, reference rows'],
  ['block content', '.block-content', 'tags, file icons, links inside references'],
  ['block row', '.block-main-container .block-content-wrapper', '“Doctor:” and “via …” labels'],
  ['bullets', '.bullet-container', 'PDF quote bullet, list properties'],
  ['fold arrows', 'a.block-control', 'fold all, always-visible title triangle'],
  ['fold state', '.ls-block[data-collapsed]', 'fold all'],
  ['nesting lines', '.block-children', 'faint nesting lines'],
  ['page links', 'a.page-ref', 'quiet links, dates, tag-page icons'],
  ['page links with an id', 'a.page-ref[data-uuid]', 'block links, tag pages, journal dates'],
  ['link wrappers', '.page-reference', 'quiet links'],
  ['tags', 'a.tag', 'bold tags, tag background'],
  ['PDF highlight labels', '.prefix-link .hl-page', 'compact PDF citations'],
  ['date values', '.ls-datetime, .timestamp', 'date boxes'],
  ['page title', PAGE_TITLE, 'title tags, #Page, alias and inherited lines'],
  ['title row', '.is-page-title-row', 'title tags, title triangle'],
  ['title actions', '.ls-page-title-actions > div', 'always-visible actions, #Page, Add tags'],
  ['title tags', '.is-page-title-row .ls-block-right .block-tags', 'tags beside the title actions'],
  ['page properties', '.ls-page-properties', 'inherited line'],
  ['block properties', '.positioned-properties', 'plainer properties'],
  ['property capsules', '.bottom-property-pill', 'plainer properties'],
  ['property names', '.property-key, .page-property-key', 'list property picker'],
  ['reference areas', REFERENCE_AREAS, 'reference headings, “Doctor:” labels, the wash on the link here'],
  ['parent paths', '.breadcrumb.block-parents', 'tidy parent paths, hidden property path'],
  ['path parts', '.breadcrumb__label', 'faded brackets in paths'],
  ['group headings', '.ls-foldable-header', 'date headings of grouped queries'],
  ['queries', '.custom-query', 'fold all, list properties per query'],
  ['embedded blocks', '.embed-block', 'line beside embedded content'],
  ['right sidebar', '#right-sidebar', 'sidebar tidy, sidebar search'],
  ['right sidebar buttons', '.cp__right-sidebar-settings', 'Search button, hidden Page graph and (Dev) buttons'],
  ['left sidebar', '#left-sidebar', 'quiet items, plain page icons, page labels'],
  ['toolbar', '#head', 'quiet items'],
  ['search window', '.cp__cmdk', 'tidy search (zero unless search is open)'],
];
async function checkWhatIsFound() {
  try {
    const doc = host();
    const count = selector => { try { return doc.querySelectorAll(selector).length; } catch (error) { return 'bad selector'; } };
    const lines = [await versionLine(), 'What the plugin finds on screen now. A zero is normal when this page has none of that thing.', '',
      'LOGSEQ\'S OWN PARTS  found · what · needed for'];
    for (const [what, selector, neededFor] of healthChecks()) lines.push(`  ${String(count(selector)).padStart(4)} · ${what} · ${neededFor}`);
    lines.push('', 'THE PLUGIN\'S OWN MARKS  found · mark');
    const marks = new Map();
    for (const el of doc.querySelectorAll('*')) {
      for (const attr of el.attributes) if (attr.name.startsWith('data-refinement-')) marks.set(attr.name, (marks.get(attr.name) || 0) + 1);
      if (typeof el.className === 'string') for (const cls of el.classList) if (cls.startsWith('refinement-')) marks.set('.' + cls, (marks.get('.' + cls) || 0) + 1);
    }
    for (const [name, n] of [...marks].sort()) lines.push(`  ${String(n).padStart(4)} · ${name}`);
    if (!marks.size) lines.push('  none');
    showDiagnostics(lines.join('\n'));
  } catch (error) { console.error(error); notify(`Check stopped: ${error.message}`, 'error'); }
}
const innerPageUnderline = '.ls-block .block-content a.page-ref[data-uuid] a.page-ref[data-uuid]:not(.tag):not([data-refinement-date])';
function describeElement(el, depth, lines, nodeIds) {
  if (depth > 14 || lines.length > 150) return;
  const cs = el.ownerDocument.defaultView.getComputedStyle(el);
  const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '';
  const attrs = ['data-uuid', 'data-ref', 'blockid'].filter(a => el.hasAttribute(a))
    .map(a => `${a}=${String(el.getAttribute(a)).slice(0, 36)}`);
  const uuid = el.getAttribute('data-uuid');
  const notes = [`deco=${cs.textDecorationLine}`];
  if (uuid) notes.push(nodeIds.has(uuid) ? 'block' : 'page');
  try { if (el.matches(innerPageUnderline)) notes.push('underline-rule'); } catch (error) { /* ignore */ }
  const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).filter(Boolean).join(' ').slice(0, 24);
  lines.push(`${'  '.repeat(depth)}<${el.tagName.toLowerCase()}${cls}${attrs.length ? ' ' + attrs.join(' ') : ''}> ${notes.join(' ')}${own ? ` "${own}"` : ''}`);
  if (el.tagName.toLowerCase() === 'svg') return;
  for (const child of el.children) describeElement(child, depth + 1, lines, nodeIds);
}
function showDiagnostics(text) {
  modal(null, (box, finish, doc) => {
    const heading = doc.createElement('label');
    heading.textContent = 'Styling details for this block. Copy and paste them into your chat.';
    const area = doc.createElement('textarea');
    area.readOnly = true;
    area.value = text;
    area.style.cssText = 'width:100%;height:50vh;box-sizing:border-box;font:12px ui-monospace,monospace;padding:6px;border:1px solid var(--ls-border-color);border-radius:6px;background:transparent;color:inherit;';
    const hint = modalHint(doc, '');
    box.append(heading, area, hint);
    area.focus();
    area.select();
    let copied = false;
    try { copied = doc.execCommand('copy'); } catch (error) { /* fall through */ }
    hint.textContent = copied ? 'Copied to the clipboard · Esc to close' : 'Press Cmd+C (Ctrl+C) to copy · Esc to close';
  }, 'min(720px, 92vw)');
}
async function copyDiagnostics(event) {
  try {
    const clickedId = typeof event?.uuid === 'string' ? event.uuid : null;
    const block = clickedId ? { uuid: clickedId } : (await logseq.Editor.getCurrentBlock() || (await logseq.Editor.getSelectedBlocks())?.[0]);
    if (!block?.uuid) return notify('Right-click the bullet of the block to check', 'warning');
    await logseq.Editor.exitEditingMode?.();
    const doc = host();
    const row = doc.querySelector(`.ls-block[blockid="${block.uuid}"]`);
    if (!row) return notify('That block is not visible on screen', 'warning');
    const content = [...row.querySelectorAll('.block-content')].find(el => el.closest('.ls-block[blockid]') === row) || row;
    const nodeIds = await referencedNodeIds();
    const lines = [await versionLine(),
      `row parent chain: ${[content.parentElement, content.parentElement?.parentElement].filter(Boolean).map(el => el.tagName.toLowerCase() + (typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '')).join(' < ')}`];
    describeElement(content, 0, lines, nodeIds);
    showDiagnostics(lines.join('\n'));
  } catch (error) { console.error(error); notify(`Could not read the block: ${error.message}`, 'error'); }
}

/* Troubleshooting for the "via Diagnosis" labels: what the database says links to this page,
   and how Logseq draws those records on screen. Nothing is changed. */
async function checkLinkLabels() {
  try {
    const page = await logseq.Editor.getCurrentPage?.();
    if (!page?.id) return notify('Open the page whose tabbed list you want to check', 'warning');
    const lines = [await versionLine(),
      `page id=${page.id} uuid=${page.uuid}`];
    const run = async (label, query) => {
      try {
        const rows = await logseq.DB.datascriptQuery(query);
        lines.push(`${label}: ${Array.isArray(rows) ? rows.length + ' rows' : typeof rows}`);
        for (const row of (rows || []).slice(0, 12)) lines.push('  ' + JSON.stringify(row).slice(0, 160));
        return rows || [];
      } catch (error) { lines.push(`${label}: ERROR ${error?.message || error}`); return []; }
    };
    const pointing = await run('A. anything pointing at this page', `[:find ?uuid ?attr
      :where [(identity ${page.id}) ?page] [?b ?attr ?page] [?b :block/uuid ?uuid]]`);
    await run('B. property entities (count)', `[:find (count ?p)
      :where [?p :block/tags ?c] [?c :db/ident :logseq.class/Property]]`);
    await run('C. label query without filter', `[:find ?uuid ?name ?attr
      :where [(identity ${page.id}) ?page]
      [?prop :block/tags ?class] [?class :db/ident :logseq.class/Property]
      [?prop :db/ident ?attr] [?b ?attr ?page] [?prop :block/title ?name] [?b :block/uuid ?uuid]]`);
    const found = await incomingPropertyLinks();
    lines.push(`D. labels the plugin would show: ${found.size}`);
    for (const [uuid, names] of found) lines.push(`  ${uuid} → via ${[...names].join(', ')}`);
    const doc = host();
    const uuids = new Set([...pointing.map(row => String(row[0])), ...found.keys()]);
    lines.push('E. on screen:');
    for (const uuid of [...uuids].slice(0, 8)) {
      const hits = doc.querySelectorAll(`[blockid="${uuid}"], [data-uuid="${uuid}"], [data-ref="${uuid}"], [data-id="${uuid}"]`);
      lines.push(`  ${uuid}: ${hits.length} element(s)`);
      for (const el of [...hits].slice(0, 4)) {
        const chain = [];
        for (let node = el, i = 0; node && node !== doc.body && i < 6; node = node.parentElement, i++) {
          const cls = typeof node.className === 'string' && node.className.trim() ? '.' + node.className.trim().split(/\s+/).slice(0, 4).join('.') : '';
          chain.push(node.tagName.toLowerCase() + cls);
        }
        const inRefs = Boolean(el.closest(REFERENCE_AREAS));
        lines.push(`    ${chain.join(' < ')}${inRefs ? '  [in linked references]' : ''}`);
      }
    }
    showDiagnostics(lines.join('\n'));
  } catch (error) { console.error(error); notify(`Check stopped: ${error.message}`, 'error'); }
}

function askPageTitle(label) {
  try {
    return modal(null, (box, finish, doc) => {
      const heading = doc.createElement('label');
      heading.textContent = `Link “${label}” to which page?`;
      const input = doc.createElement('input');
      input.type = 'text';
      input.placeholder = 'Page title';
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); finish(input.value); }
      });
      box.append(heading, input, modalHint(doc, 'Enter to link · Esc to cancel'));
      input.focus();
    });
  } catch (error) { return Promise.resolve(window.prompt('Page title:', '')); }
}

// The selection was measured in the editor, which shows links by name; the saved block
// stores them as ids. Use the editor's text when the saved block still matches it.
// Returns null when the selected words are no longer where they were.
async function selectedBlockText(selection, before) {
  const saved = titleOf(await logseq.Editor.getBlock(selection.blockId));
  const shown = before && await readableTitle(saved, { pagesOnly: true }) === before.trim() ? before : saved;
  return shown.slice(selection.start, selection.end) === selection.text ? shown : null;
}

async function labeledPageLink() {
  const selection = recentSelection;
  if (!selection?.text?.trim() || !Number.isInteger(selection.start) || !Number.isInteger(selection.end))
    return notify('Select the words to display, then press Mod+Shift+L', 'warning');
  const current = await logseq.Editor.getCurrentBlock();
  if (current && current.uuid !== selection.blockId)
    return notify('Select the display text in this block again', 'warning');
  const before = (await logseq.Editor.getEditingBlockContent()) || selection.content;
  if (before?.slice(selection.start, selection.end) !== selection.text)
    return notify('The selection changed. Select the display text again', 'warning');
  const label = selection.text;
  if (label.includes(']') || /[\r\n]/.test(label))
    return notify('Use a single-line label without ]', 'warning');
  const answer = await askPageTitle(label);
  if (answer === null) return;
  const target = answer.trim().replace(/^\[\[/, '').replace(/\]\]$/, '');
  if (!target || /[\[\]\r\n]/.test(target))
    return notify('Enter a page title without brackets or line breaks', 'warning');
  try {
    await logseq.Editor.exitEditingMode();
    const shown = await selectedBlockText(selection, before);
    if (shown === null) return notify('The block changed; select the display text again', 'warning');
    const link = `[${label}]([[${target}]])`;
    await logseq.Editor.updateBlock(selection.blockId,
      shown.slice(0, selection.start) + link + shown.slice(selection.end));
    recentSelection = null;
    await logseq.Editor.editBlock(selection.blockId, { pos: selection.start + link.length });
  } catch (error) { console.error(error); notify(`Could not insert labeled link: ${error.message}`, 'error'); }
}

let recentSelection = null;
// Turns the selected words into [[page]] in their block. Skips, with a note, anything it can't do safely.
async function linkSelection(selection, name) {
  const words = selection.text;
  if (!Number.isInteger(selection.start) || !Number.isInteger(selection.end) || /[\[\]\r\n]/.test(words))
    return notify('Opened the page; the selected text was left as it was', 'info');
  try {
    if (await logseq.Editor.getCurrentBlock()) await logseq.Editor.exitEditingMode();
    const before = selection.content;
    const shown = await selectedBlockText(selection, before);
    if (shown === null) return notify('Opened the page; the block had changed, so no link was added', 'warning');
    if (shown.slice(Math.max(0, selection.start - 2), selection.start) === '[[' &&
        shown.slice(selection.end, selection.end + 2) === ']]') return; // already a link
    // Spaces around the words, and tags after them, stay outside the brackets.
    const core = words.trim();
    if (!core.startsWith(name)) return notify('Opened the page; the selected text was left as it was', 'info');
    const link = words.match(/^\s*/)[0] + `[[${name}]]` + core.slice(name.length) + words.match(/\s*$/)[0];
    await logseq.Editor.updateBlock(selection.blockId,
      shown.slice(0, selection.start) + link + shown.slice(selection.end));
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

// Use native controls to expand properties, so Logseq still renders editable values.
const sidebarPresentation = { hidden: new Set(), pending: new WeakMap() };
function updateSidebarPresentation(doc) {
  const sidebar = doc.querySelector('#right-sidebar');
  if (!sidebar) return;
  const normalize = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const devTabs = new Set(['(Dev) RTC', '(Dev) Undo/Redo', '(Dev) Profiler', 'Page graph', 'Page Graph']);
  for (const el of sidebar.querySelectorAll('a, button, [role="tab"], [role="button"], span, div')) {
    if (el.childElementCount > 3) continue; // tabs and toggles are small; skip big containers cheaply
    const label = normalize(el);
    const propertyToggle = /^(?:Show|Open|Hide) properties$/i.test(label);
    if (!devTabs.has(label) && !propertyToggle) continue;
    // Match the smallest label/control, never a panel containing the same text.
    if ([...el.children].some(child => normalize(child) === label)) continue;
    const control = el.closest('a, button, [role="tab"], [role="button"]') || el;
    if (!sidebar.contains(control) || normalize(control) !== label) continue;
    if (/^(?:Show|Open) properties$/i.test(label)) {
      if (sidebarPresentation.pending.get(control) !== label) {
        sidebarPresentation.pending.set(control, label);
        control.click();
      }
      // Keep the opener available if this build doesn't expand successfully.
      continue;
    }
    sidebarPresentation.pending.delete(control);
    if (!control.hasAttribute('data-refinement-sidebar-hidden')) {
      control.setAttribute('data-refinement-sidebar-hidden', '');
      sidebarPresentation.hidden.add(control);
    }
  }
}
function startSidebarPresentation() {
  try {
    logseq.provideStyle({ key: 'personal-db-sidebar', style:
      '#right-sidebar [data-refinement-sidebar-hidden] { display: none !important; }' });
    watchDom(updateSidebarPresentation);
    onUnload(() => {
      for (const el of sidebarPresentation.hidden) el.removeAttribute('data-refinement-sidebar-hidden');
      sidebarPresentation.hidden.clear();
    });
  } catch (error) { console.warn('Refinements: sidebar presentation is unavailable', error); }
}

// Opens Logseq's own search and moves it into the right sidebar (search's own Mod+Enter
// action), so results stay listed while you open them. Reuses a search already there.
const waitFor = (find, ms = 1500) => new Promise(resolve => {
  const started = Date.now();
  const tick = () => { const found = find(); if (found || Date.now() - started > ms) resolve(found || null); else setTimeout(tick, 50); };
  tick();
});
async function searchInSidebar() {
  let step = 'finding the sidebar';
  try {
    const doc = host(), win = doc.defaultView;
    const sidebarInput = () => doc.querySelector('#right-sidebar .cp__cmdk-search-input');
    const existing = sidebarInput();
    if (existing && existing.offsetParent) { existing.focus(); existing.select(); return; }
    step = 'opening search';
    // Don't wait on this call: it can finish without replying to the plugin.
    Promise.resolve(logseq.App.invokeExternalCommand('logseq.go/search')).catch(() => {});
    const root = await waitFor(() => [...doc.querySelectorAll('.cp__cmdk')].find(el => !el.closest('#right-sidebar')));
    if (!root) { notify('Search did not open. You can also press Mod+Enter inside search to keep it in the sidebar.', 'warning'); return; }
    step = 'moving search to the sidebar';
    // Search's own Mod+Enter action. Sent to the search window first (so no result is opened),
    // then from the search box if that window ignored it.
    const press = target => target.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', metaKey: true, ctrlKey: true, bubbles: true, cancelable: true }));
    press(root);
    let input = await waitFor(sidebarInput, 700);
    const box = root.isConnected && root.querySelector('.cp__cmdk-search-input');
    if (!input && box) { box.focus(); press(box); input = await waitFor(sidebarInput, 700); }
    if (input) input.focus();
    else notify('Search stayed as a popover. Press Mod+Enter inside search to move it to the sidebar.', 'warning');
  } catch (error) {
    console.warn('Refinements: sidebar search failed', error);
    notify(`Sidebar search stopped while ${step}: ${error?.message || error}`, 'warning');
  }
}

// A "Search" button at the start of the right sidebar's top row (next to Contents and Help).
function ensureSidebarSearchButton(doc) {
  const row = doc.querySelector('#right-sidebar .cp__right-sidebar-settings');
  if (!row || row.querySelector('[data-refinement-search-button]')) return;
  const wrap = doc.createElement('div');
  wrap.className = 'text-sm';
  wrap.setAttribute('data-refinement-search-button', '');
  const button = doc.createElement('button');
  button.className = 'button cp__right-sidebar-settings-btn';
  button.textContent = 'Search';
  button.addEventListener('click', event => { event.preventDefault(); searchInSidebar(); });
  wrap.append(button);
  row.prepend(wrap);
}
function startSidebarSearchButton() {
  try {
    watchDom(ensureSidebarSearchButton);
    onUnload(() => { for (const el of host().querySelectorAll('[data-refinement-search-button]')) el.remove(); });
  } catch (error) { console.warn('Refinements: sidebar search button is unavailable', error); }
}

// Search shows block text as typed, so links and bold come through as [[Page]] and **text**.
// Fade that markup in result text and paths. Uses the browser's highlight ranges, so
// Logseq's own text is never edited.
const searchMarkup = /\[\[|\]\]|\*\*|__|~~|\^\^|==|`/g;
function cleanSearchResults(doc) {
  const win = doc.defaultView;
  if (!win.CSS?.highlights || !win.Highlight || !doc.querySelector('.cp__cmdk')) return;
  const ranges = [];
  for (const area of doc.querySelectorAll('[data-cmdk-item] .cp__cmdk-item-main-text, [data-cmdk-item] > .text-xs:first-child')) {
    const walker = doc.createTreeWalker(area, win.NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const match of node.nodeValue.matchAll(searchMarkup)) {
        const range = doc.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        ranges.push(range);
      }
    }
  }
  win.CSS.highlights.set('refinement-search-markup', new win.Highlight(...ranges));
}
function startSearchCleanup() {
  try {
    watchDom(cleanSearchResults);
    onUnload(() => host().defaultView.CSS?.highlights?.delete('refinement-search-markup'));
  } catch (error) { console.warn('Refinements: search text cleanup is unavailable', error); }
}

/* Visual hierarchy: the shape of the outline rather than the things it links to. Each part has
   its own setting and applies as soon as it changes. Colors are mixed from the theme's text
   color, so light, dark and custom themes all work without separate palettes. */
const hierarchyParts = {
  // Faint nesting lines; the line beside the branch you point at or type in is a little firmer.
  // Logseq draws the line as a border, so nothing moves when it changes strength.
  indentGuides: `
.ls-block { --ls-guideline-color: color-mix(in srgb, var(--ls-primary-text-color, currentColor) var(--rf-hair-pct), transparent); }
.ls-block .block-children { border-left-color: var(--ls-guideline-color) !important; }
.ls-block .block-children-container:hover:not(:has(.block-children-container:hover)) > .block-children,
.ls-block .block-children-container:focus-within:not(:has(.block-children-container:focus-within)) > .block-children {
  border-left-color: color-mix(in srgb, var(--ls-primary-text-color, currentColor) var(--rf-line-pct), transparent) !important;
}`,
  // Optional soft chip behind tags, inline and at the end of a block. Off by default: the plugin
  // otherwise keeps color for dates only.
  tintTags: `
.ls-block :is(.block-content, .block-tags) a.tag:not(mark *) {
  background: color-mix(in srgb, var(--rf-accent) 14%, transparent) !important;
  border-radius: .25em;
  padding: 0 .25em;
}`,
};
// Stylesheets that depend on settings are sent again only when their text has changed: every send
// makes Logseq work out the look of the whole page again.
const sentStyles = new Map();
function sendStyle(key, style) {
  if (sentStyles.get(key) === style) return;
  sentStyles.set(key, style);
  logseq.provideStyle({ key, style: orNoRules(style) });
}
function applyHierarchy() {
  sendStyle('personal-db-hierarchy', Object.keys(hierarchyParts).filter(setting).map(key => hierarchyParts[key]).join('\n'));
}

const settingsSchema = [
  { key: 'shortcutsHeading', type: 'heading', title: 'Shortcuts and actions', default: null,
    description: 'Every action is also in the command palette: search for “Refinements”. Changes to shortcuts apply after you reload the plugin. Leave a shortcut empty to remove it. Examples: mod+shift+l, mod+alt+p (mod is Cmd on Mac, Ctrl elsewhere).' },
  { key: 'linkShortcut', type: 'string', title: 'Link selected text to a page', default: 'mod+shift+l',
    description: 'Select words in a block, press this, then type the page title. The words become [words]([[page title]]).' },
  { key: 'openShortcut', type: 'string', title: 'Open selected text as page', default: 'mod+alt+p',
    description: 'Turns the text you selected into a [[link]] and opens (or creates) that page.' },
  { key: 'copyShortcut', type: 'string', title: 'Copy block and children to new page', default: '',
    description: 'Copies the current block and its children to a new page. Also in the right-click menu on a bullet.' },
  { key: 'searchShortcut', type: 'string', title: 'Search in the right sidebar', default: 'mod+alt+f',
    description: 'Opens Logseq search in the right sidebar, where it stays while you open results. Shift-click a result to open it in the sidebar too.' },
  { key: 'tagShortcut', type: 'string', title: 'Add tags to this page', default: 'mod+t',
    description: 'Opens Logseq’s Set Tags list for the page you are on, the same list that clicking #Page opens.' },
  { key: 'searchHeading', type: 'heading', title: 'Search', default: null,
    description: 'Changes here apply after you reload the plugin.' },
  { key: 'tidySearch', type: 'boolean', title: 'Tidy the search window', default: true,
    description: 'Compact result rows, quieter group headings, bold matches instead of yellow highlights, and faded [[ ]] and ** markup in results. Turn off to get Logseq’s original look.' },
  { key: 'pageHeading', type: 'heading', title: 'Pages', default: null,
    description: 'Changes here apply after you reload the plugin.' },
  { key: 'showTitleChrome', type: 'boolean', title: 'Always show page title actions and tags', default: true,
    description: 'Keeps buttons like “Add tag property” and the page’s tags visible next to the title, muted until you point at them. Turn off to show them only on hover, as Logseq does.' },
  { key: 'showPageKind', type: 'boolean', title: 'Show what a page is above its title', default: true,
    description: 'Moves the page’s tags from the far right edge to the row of actions just above the title (they stay Logseq’s own, so their # still opens the tag menu), and shows #Page there on a page with no tag of its own. Needs “Always show page title actions and tags” to be visible without hovering. Applies right away.' },
  { key: 'showAliasOf', type: 'boolean', title: 'Show which page an alias belongs to', default: true,
    description: 'Under the title of a page that is an alias, shows a small muted “Alias of …” line; click the name to open the original page. Applies right away.' },
  { key: 'markReferenceHere', type: 'boolean', title: 'Mark the link to this page in Linked references', default: true,
    description: 'Under Linked references, the link that points to the page you are on gets a clear grey highlight. Applies right away.' },
  { key: 'showInherited', type: 'boolean', title: 'Show inherited properties on tag pages', default: true,
    description: 'Under the title of a tag that extends another tag, shows a small muted line such as “Inherited from #Media: keywords, rating, website”, one line per parent tag. Click a name to open it. Applies right away.' },
  { key: 'datesHeading', type: 'heading', title: 'Journal day as date', default: null,
    description: 'A record tagged with one of these tags (or a tag that extends them) gets its empty date filled with the journal day it was written on. Dates you enter yourself are never changed. For records made before this was on, run “Refinements: Fill missing dates from journal days”.' },
  { key: 'autoDate', type: 'boolean', title: 'Fill dates automatically', default: true,
    description: 'Fill the date of new records as you write them.' },
  { key: 'autoDateTags', type: 'string', title: 'Tags', default: 'Occurrence, Results',
    description: 'Comma-separated tag names, without #. Tags that extend these are included. To cover a new tag, add its name here.' },
  { key: 'autoDateProperty', type: 'string', title: 'Date property', default: 'Date',
    description: 'The name of the date property to fill.' },
  { key: 'hierarchyHeading', type: 'heading', title: 'Visual hierarchy', default: null,
    description: 'Quiet cues for the shape of the outline. Changes here apply right away.' },
  { key: 'indentGuides', type: 'boolean', title: 'Faint nesting lines', default: true,
    description: 'Makes the lines beside nested blocks fainter, and the line beside the branch you point at or type in a little stronger.' },
  { key: 'plainProperties', type: 'boolean', title: 'Plainer properties', default: true,
    description: 'Shows a block’s properties as “name: value” text, separated by dots, instead of outlined capsules.' },
  { key: 'childTypeCues', type: 'boolean', title: 'Show what a block holds', default: true,
    description: 'After a block’s text: ↳, a dashed circle with the number of unfinished tasks below it, and small image or PDF icons when its children are files. Point at it for details.' },
  { key: 'embedLine', type: 'boolean', title: 'Line beside embedded content', default: true,
    description: 'A faint line at the left of embedded blocks and pages, so you can tell they come from somewhere else.' },
  { key: 'dateStyle', type: 'boolean', title: 'Dates in a soft grey box', default: true,
    description: 'Dates in your notes, and date headings of queries grouped by date, get a quiet grey box so they stand out from other links. Tables and property capsules keep plain dates.' },
  { key: 'plainPageIcons', type: 'boolean', title: 'Simpler page icons', default: true,
    description: 'Replaces Logseq’s generic page icon with a plain outline in titles and sidebars. Custom page icons are never changed.' },
  { key: 'tintTags', type: 'boolean', title: 'Soft background behind tags', default: false,
    description: 'Puts a faint violet chip behind tags, both in the text and at the end of a block.' },
  { key: 'linksHeading', type: 'heading', title: 'Links and references', default: null,
    description: 'Changes here apply right away.' },
  { key: 'quietLinks', type: 'boolean', title: 'Quiet page links', default: true,
    description: 'Page links in normal text colour with a faint underline instead of bright blue; tags as bold text; page names heading Linked references read as headings; links inside highlights stay readable.' },
  { key: 'referenceLayout', type: 'boolean', title: 'Clearer Linked references', default: true,
    description: 'Under Linked references: a wider gap between source pages, a journal’s date as a plain heading like any other page, the number of references after a heading that holds more than one, a bullet before the grey path that names a reference’s parent block, with the reference stepped in below it, the blocks below a reference stepping back unless they link here too, and Logseq’s fold arrows kept faintly visible. Applies right away.' },
  { key: 'referenceIcons', type: 'boolean', title: 'Icons for block references and files', default: true,
    description: 'A small dot before links to blocks, with no underline (pages keep their solid underline), and document or image icons before links to PDFs and pictures.' },
  { key: 'linkLabels', type: 'boolean', title: 'Show how records are linked', default: true,
    description: 'In Linked references, puts the property name before a value (“Doctor: …”); records under a page’s tag tabs end with “via Diagnosis” when one of your properties links them.' },
  { key: 'tidyPaths', type: 'boolean', title: 'Tidy parent paths', default: true,
    description: 'The grey path above a result or reference uses the width it has before cutting text short, and its [[ ]] brackets fade.' },
  { key: 'pdfCitations', type: 'boolean', title: 'Compact PDF citations', default: true,
    description: 'PDF highlights show as normal text with a quote-mark bullet and a small page and source label at the start; click the line to open the PDF there.' },
  { key: 'appearanceHeading', type: 'heading', title: 'Right sidebar', default: null,
    description: 'Changes here apply after you reload the plugin.' },
  { key: 'quietItems', type: 'string', title: 'Quiet these sidebar and toolbar items', default: 'Flashcards, Graph view',
    description: 'Comma-separated names (as shown, or as in the button tooltip). These stay visible but are smaller and lighter. Applies after you reload the plugin.' },
  { key: 'tidySidebar', type: 'boolean', title: 'Tidy the right sidebar', default: true,
    description: 'Expand page properties automatically and hide the Page graph, (Dev) RTC, Undo/Redo and Profiler buttons.' },
];
// A setting's current value, or its default from the list above when unset or of the wrong type.
const settingDefaults = Object.fromEntries(settingsSchema.map(item => [item.key, item.default]));
function setting(key) {
  const value = logseq.settings?.[key];
  return typeof value === typeof settingDefaults[key] ? value : settingDefaults[key];
}
// Settings that only take effect when the plugin starts.
const RELOAD_SETTINGS = ['linkShortcut', 'openShortcut', 'copyShortcut', 'searchShortcut', 'tagShortcut', 'tidySidebar', 'tidySearch', 'quietItems', 'showTitleChrome'];

/* Links inside a reference: Logseq lets the surrounding reference handle the click last, so it
   opens the referenced block instead. Catch clicks on the inner link first and open that page. */
function nestedReferenceLink(event) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return null;
  const node = event.target, el = node?.nodeType === 1 ? node : node?.parentElement;
  const inner = el?.closest?.('a:is(.page-ref, .tag)[data-uuid]');
  if (!inner || !inner.closest('.ls-block')) return null;
  const outer = inner.parentElement?.closest('a.page-ref');
  return outer ? inner : null;
}
function startNestedReferenceLinks() {
  try {
    const win = host().defaultView;
    listen(win, ['pointerdown', 'mousedown', 'pointerup', 'mouseup'], event => {
      if (!nestedReferenceLink(event)) return;
      event.stopPropagation();
      if (event.type !== 'pointerup' && event.type !== 'mouseup') event.preventDefault();
    });
    listen(win, ['click'], event => {
      const link = nestedReferenceLink(event);
      if (!link) return;
      event.stopPropagation();
      event.preventDefault();
      openEntity(link.getAttribute('data-uuid'), event.shiftKey);
    });
  } catch (error) { console.warn('Refinements: links inside references stay native', error); }
}

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
const PAGE_TITLE = '.ls-page-title, .page-title, h1.title';
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
/* The triangle left of a page title, which shows or hides the page's properties, is always there
   (Logseq shows it only while you point at the title): muted, and full strength on hover. */
#main-content-container .is-page-title-row .block-control-wrap a.block-control,
#main-content-container .is-page-title-row .block-control-wrap a.block-control > span {
  display: inline-flex !important; visibility: visible !important; opacity: var(--rf-faint) !important;
}
#main-content-container .is-page-title-row .block-control-wrap a.block-control > span { opacity: 1 !important; }
#main-content-container .is-page-title-row:hover .block-control-wrap a.block-control { opacity: 1 !important; }
` });
    watchDom(updateTitleChrome);
    titleChrome.started = true;
    onUnload(() => {
      for (const el of titleChrome.marked) el.removeAttribute('data-refinement-always-shown');
      titleChrome.marked.clear();
    });
  } catch (error) { console.warn('Refinements: page title actions stay native', error); }
}
/* Page type: a small muted word under the title of tag pages ("Tag") and property pages
   ("Property"). Ordinary and journal pages get nothing. The word is drawn by CSS from an
   attribute on the title, so nothing is inserted into Logseq's own page structure. */
const pageKind = { pageId: 0, timer: 0, aliasOf: [], aliasLine: null, inherited: [], inheritedBy: new Map(), inheritedAsked: new Set(), inheritLine: null, pageUuid: '', plain: false, titleTags: null, tagged: new Set(), offsets: new WeakMap() };
async function loadPageKind() {
  // Lookups can overlap (a page change, then an edit); only the newest one's answer is used.
  const version = pageKind.version = (pageKind.version || 0) + 1;
  let kind = '', pageId = 0, aliasOf = [], inherited = [], plain = false, pageUuid = '';
  try {
    const page = await logseq.Editor.getCurrentPage?.();
    pageId = page?.id;
    pageUuid = String(page?.uuid || '');
    if (isEntityId(pageId) && logseq.DB?.datascriptQuery) {
      const rows = await logseq.DB.datascriptQuery(`[:find ?ident
        :where [(identity ${pageId}) ?p] [?p :block/tags ?c] [?c :db/ident ?ident]]`);
      const idents = new Set((rows || []).map(row => String(row[0]).replace(/^:/, '')));
      kind = idents.has('logseq.class/Tag') ? 'Tag' : idents.has('logseq.class/Property') ? 'Property' : '';
      plain = idents.size === 1 && idents.has('logseq.class/Page'); // an ordinary page with no tag of its own
      // Logseq records an alias only on the original page; look it up from the alias's side.
      const originals = await logseq.DB.datascriptQuery(`[:find ?uuid ?title
        :where [(identity ${pageId}) ?p] [?o :block/alias ?p] [?o :block/uuid ?uuid] [?o :block/title ?title]]`);
      aliasOf = (originals || []).filter(row => UUID.test(String(row[0]))).map(row => [String(row[0]), String(row[1])])
        .sort((a, b) => a[1].localeCompare(b[1]));
      if (kind === 'Tag') inherited = await inheritedTagProperties(pageId);
    }
  } catch (error) { console.warn('Refinements: could not tell the page type', error); }
  if (version !== pageKind.version) return;
  pageKind.pageId = pageId;
  pageKind.aliasOf = aliasOf;
  pageKind.inherited = inherited;
  if (pageUuid) pageKind.inheritedBy.set(pageUuid, inherited);
  pageKind.plain = plain;
  pageKind.pageUuid = pageUuid;
  try { updatePageKind(host()); } catch (error) { /* shown on the next change */ }
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
  updateInheritedLine(doc, setting('showInherited') && titles.length === 1 ? titles[0] : null);
  updateReferenceHere(titles);
}
// Under "Linked references" a block is listed because it links to the page on screen, but it may
// hold other links too. The link that points here gets a clear wash, stronger than the box behind a
// date, so it can be found at once; the blocks below a reference that do not hold that link step back.
function updateReferenceHere(titles) {
  const mark = setting('markReferenceHere'), layout = setting('referenceLayout');
  const pages = [];
  if (mark || layout) for (const title of titles) {
    const block = title.querySelector('.ls-block[blockid]');
    const uuid = block?.getAttribute('blockid') || '';
    if (!UUID.test(uuid)) continue;
    // A journal is also pointed at by dates (a Scheduled or Deadline value), which carry its name, not its uuid.
    const name = (block.querySelector('.block-title-wrap') || block).textContent.trim();
    pages.push({ uuid, name: isJournalDate(name) ? name : '', listed: !!title.closest('.journal-item') });
  }
  // One page on screen, or the Journals list, where every day has its own Linked references.
  const shown = pages.length === 1 || (pages.length && pages.every(page => page.listed)) ? pages : [];
  const state = shown.length ? `${shown.map(page => page.uuid + page.name).join(' ')} ${mark} ${layout}` : '';
  if (state === pageKind.referenceHere) return;
  pageKind.referenceHere = state;
  const rules = shown.map(({ uuid, name }) => {
    const scope = shown.length === 1 ? '#main-content-container'
      : `#main-content-container .journal-item:has(:is(.ls-page-title, .page-title, h1.title) .ls-block[blockid="${uuid}"])`;
    const here = `:is(a.page-ref, a.tag)[data-uuid="${uuid}"]${name ? `, a.page-ref[data-ref=${JSON.stringify(name)} i]` : ''}`;
    const link = `${scope} .references .ls-block :is(${here})`;
    const below = `${scope} .references .ls-block[level="0"] .block-children .ls-block:not(:has(:is(${here})))`;
    return `${mark ? `
${link} { background: ${wash('--rf-here-pct')} !important; }
${link}:not([data-refinement-date]) { padding: .05em .2em; margin: 0 -.2em; border-radius: .2em; }` : ''}${layout ? `
${below} > .block-main-container { opacity: var(--rf-quiet); }
${below}:hover > .block-main-container { opacity: 1; }` : ''}`;
  }).join('');
  logseq.provideStyle({ key: 'personal-db-reference-here', style: shown.length ? orNoRules(rules) : '/* no single page on screen */' });
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
    // The menu lists a few properties at first; typing narrows it to Tags.
    if (!tagsEntry()) {
      Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, 'Tags');
      input.dispatchEvent(new win.Event('input', { bubbles: true }));
    }
    const entry = await waitFor(tagsEntry, 2000);
    if (!entry) return notify('Type “Tags” in the menu that opened to choose it.', 'info');
    entry.click();
  } catch (error) { console.error(error); notify(`Could not open the tag list: ${error.message}`, 'warning'); }
}
// Command and shortcut: open the Set Tags list for the page in the main area.
function addTagsToPage() {
  const actions = host().querySelector('#main-content-container .is-page-title-row .ls-page-title-actions > div');
  if (!actions) return notify('Open a page first', 'warning');
  return openTagPicker(actions);
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
  } catch (error) { console.warn('Refinements: could not read inherited properties', error); }
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
.refinement-title-tags { margin-left: .6rem; font-size: .75rem; line-height: 1.5rem; white-space: nowrap; color: var(--ls-link-text-color, inherit); cursor: pointer; text-decoration: none; }
.refinement-title-tags:hover { text-decoration: underline; }
:is(.refinement-alias-of, .refinement-inherited) {
  margin: .15rem 0 .25rem;
  font-size: .8rem;
  font-weight: 400;
  line-height: 1.3;
  color: var(--ls-primary-text-color, currentColor);
  opacity: var(--rf-quiet);
}
:is(.refinement-alias-of, .refinement-inherited) a { color: inherit; text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor var(--rf-line-pct), transparent); cursor: pointer; }
.refinement-inherited a.rf-tag { text-decoration: none; }
.ls-page-properties .refinement-inherited { margin: .25rem 0 0 1.25rem; }
:is(.refinement-alias-of, .refinement-inherited) a:hover { color: var(--ls-primary-text-color, currentColor); }` });
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
      pageKind.inheritLine?.remove();
      pageKind.titleTags?.remove();
      for (const el of pageKind.tagged) el.style.transform = '';
      pageKind.tagged.clear();
    });
  } catch (error) { console.warn('Refinements: page type label is unavailable', error); }
}
// Troubleshooting: how Logseq builds the page title area, so the always-shown rule can be aimed.
async function copyHeaderDiagnostics() {
  try {
    const doc = host();
    const titles = [...pageTitles(doc)];
    if (!titles.length) return notify('Open a page first', 'warning');
    const lines = [await versionLine(), `page titles found: ${titles.length}`];
    const header = pageHeaderOf(titles[0]);
    lines.push(`header parent chain: ${[header.parentElement, header.parentElement?.parentElement].filter(Boolean).map(el => el.tagName.toLowerCase() + (el.getAttribute('class') ? '.' + el.getAttribute('class').trim().split(/\s+/).join('.') : '')).join(' < ')}`);
    const win = doc.defaultView;
    for (const el of [header, ...header.querySelectorAll('*')].slice(0, 150)) {
      let depth = 0;
      for (let node = el; node && node !== header; node = node.parentElement) depth++;
      const cs = win.getComputedStyle(el);
      const cls = el.getAttribute('class') ? '.' + el.getAttribute('class').trim().split(/\s+/).join('.') : '';
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).filter(Boolean).join(' ').slice(0, 24);
      const shown = el.hasAttribute('data-refinement-always-shown') ? ' [always shown]' : '';
      lines.push(`${'  '.repeat(depth)}<${el.tagName.toLowerCase()}${cls}> opacity=${cs.opacity} vis=${cs.visibility} display=${cs.display}${shown}${own ? ` "${own}"` : ''}`);
    }
    showDiagnostics(lines.join('\n'));
  } catch (error) { console.error(error); notify(`Could not read the page title area: ${error.message}`, 'error'); }
}

/* Property values written out as text, for one-line lists. Read-only.
   Values come from the database by property ident, so renamed properties keep working. */
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bareIdent = value => String(value ?? '').replace(/^:/, '');
const keyword = ident => ':' + bareIdent(ident);
const ednString = text => '"' + String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
// Property types whose values point at another entity (a page, or a small text block).
const REF_TYPES = new Set(['default', 'url', 'number', 'date', 'node', 'entity', 'page', 'class', 'property']);

// Every property, by lower-case name. If two share a name, your own wins over a built-in one.
async function propertiesByName() {
  const rows = await dsQuery(`[:find ?ident ?title ?type
    :where [?p :block/tags ?c] [?c :db/ident :logseq.class/Property] [?p :block/title ?title] [?p :db/ident ?ident]
    [(get-else $ ?p :logseq.property/type :default) ?type]]`);
  const byName = new Map();
  for (const [ident, title, type] of rows) {
    const key = String(title).toLowerCase(), info = { ident: bareIdent(ident), title: String(title), type: bareIdent(type) };
    if (!byName.has(key) || info.ident.startsWith('user.property/')) byName.set(key, info);
  }
  return byName;
}
// Every tag: [id, title].
const allTags = () => dsQuery(`[:find ?t ?title
  :where [?t :block/tags ?cls] [?cls :db/ident :logseq.class/Tag] [?t :block/title ?title]]`);
// The given tags plus every tag that extends them, at any depth.
async function withExtendingTags(tags) {
  const rows = await dsQuery(`[:find ?child ?parent :where [?child :logseq.property.class/extends ?parent]]`);
  for (let grew = true; grew;) {
    grew = false;
    for (const [child, parent] of rows) if (tags.has(parent) && !tags.has(child)) { tags.add(child); grew = true; }
  }
  return tags;
}
// Titles of the pages that texts mention as [[uuid]].
async function mentionedTitles(texts) {
  const mentioned = new Set();
  for (const text of texts) for (const m of String(text).matchAll(/\[\[([0-9a-f-]{36})\]\]/gi)) mentioned.add(m[1].toLowerCase());
  const titles = new Map();
  if (mentioned.size) {
    for (const [uuid, title] of await dsQuery(`[:find ?uuid ?title :where ${uuidsIn('?uuid', mentioned)}
      [?e :block/uuid ?uuid] [?e :block/title ?title]]`)) titles.set(String(uuid).toLowerCase(), String(title));
  }
  return titles;
}
// The values of some properties on some entities: entity id -> ident -> [{ ref, v }], plus what
// the values point at and the titles their text mentions.
async function readValues(ids, props) {
  const values = new Map(), refs = new Set();
  if (props.length && ids.length) {
    const byIdent = new Map(props.map(prop => [prop.ident, prop]));
    for (const [b, a, v] of await dsQuery(`[:find ?b ?a ?v :where ${idsIn('?b', ids)}
      [(identity [${props.map(p => keyword(p.ident)).join(' ')}]) [?a ...]] [?b ?a ?v]]`)) {
      const prop = byIdent.get(bareIdent(a));
      if (!prop) continue;
      const ref = REF_TYPES.has(prop.type) && Number.isSafeInteger(v);
      if (ref) refs.add(v);
      if (!values.has(b)) values.set(b, new Map());
      const own = values.get(b);
      if (!own.has(prop.ident)) own.set(prop.ident, []);
      own.get(prop.ident).push({ ref, v });
    }
  }
  const entities = new Map();
  if (refs.size) {
    for (const [e, uuid, title, name, day, value] of await dsQuery(`[:find ?e ?uuid ?title ?name ?day ?value
      :where ${idsIn('?e', refs)} [?e :block/uuid ?uuid]
      [(get-else $ ?e :block/title "") ?title] [(get-else $ ?e :block/name "") ?name]
      [(get-else $ ?e :block/journal-day 0) ?day] [(get-else $ ?e :logseq.property/value "") ?value]]`))
      entities.set(e, { uuid: String(uuid), title: String(title || value || ''), page: Boolean(name), day });
  }
  const titles = await mentionedTitles([...entities.values()].map(entity => entity.title));
  return { values, entities, titles };
}
// Text with [[links]]: links stay clickable, tags inside the text are left out.
function linkedText(text, titles) {
  let html = '', last = 0;
  const source = String(text);
  for (const m of source.matchAll(/#?\[\[([^\]]+)\]\]/g)) {
    html += escapeHtml(source.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[0].startsWith('#')) continue;
    const target = m[1], uuid = /^[0-9a-f-]{36}$/i.test(target) ? target : null;
    const label = uuid ? titles.get(uuid.toLowerCase()) || 'link' : target;
    html += `<a class="rt-link" data-uuid="${escapeHtml(uuid || '')}" data-name="${escapeHtml(uuid ? '' : target)}">${escapeHtml(label)}</a>`;
  }
  html += escapeHtml(source.slice(last));
  return html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\s+$/, '');
}
// ": value · Label value", or '' when none of the properties has a value.
// Labels name each value when more than one property is shown.
function valuesHtml(shown, own = new Map(), { entities, titles }) {
  const one = item => {
    if (!item.ref) return escapeHtml(item.v === true ? 'Yes' : item.v === false ? 'No' : item.v);
    const entity = entities.get(item.v);
    if (!entity) return '';
    if (entity.page || entity.day) return `<a class="rt-link" data-uuid="${escapeHtml(entity.uuid)}">${escapeHtml(entity.title)}</a>`;
    return linkedText(entity.title, titles);
  };
  const named = shown.length > 1;
  const parts = shown.map(prop => {
    const list = (own.get(prop.ident) || []).map(one).filter(Boolean);
    if (!list.length) return '';
    return `<span class="rt-value">${named ? `<span class="rt-label">${escapeHtml(prop.title)}</span> ` : ''}${list.join(', ')}</span>`;
  }).filter(Boolean);
  return parts.length ? '<span class="rt-sep">: </span>' + parts.join('<span class="rt-sep"> · </span>') : '';
}

/* Choose which properties a list shows. Logseq's List view always shows every property of each
   record; tables have a column picker, lists don't. This adds one per list: a query (remembered by
   the query block) or the lists on a page such as a tag page (remembered by the page).
   Choices are saved in the plugin's settings. Nothing in the graph changes; other properties are
   only hidden from view in that list, and "Show all" brings them back. */
const listProps = { names: new Set(), marked: new Set(), pageBlocks: new Set(), lastTarget: null,
  inline: new Map(), pending: new Set(), injected: new Set(), inlineTimer: null, inlineVersion: 0,
  localChoices: new Map(), localEdits: 0 };
const NO_PROPERTIES = '\u0000none'; // saved when every property is unticked
const BODY = '\u0000body'; // ticked = show the blocks under each record (its notes, attachments)
const BODY_LABEL = 'Body (notes and files under each record)';
const COMPACT = '\u0000compact'; // ticked = one line per record: title, then the chosen values
const COMPACT_LABEL = 'One line per record (timeline layout)';
// The record a menu or command is about. The same record can be drawn in several places (a query,
// the page itself, linked references), so prefer the copy you actually right-clicked or clicked.
function clickedRecord(event) {
  const doc = host();
  const last = listProps.lastTarget?.closest?.('.ls-block[blockid]');
  if (typeof event?.uuid !== 'string') return listProps.lastTarget;
  if (last?.getAttribute('blockid') === event.uuid && last.isConnected) return last;
  return doc.querySelector(`#main-content-container .ls-block[blockid="${event.uuid}"]`) || doc.querySelector(`.ls-block[blockid="${event.uuid}"]`);
}
// Saved settings arrive in the background, so choices made in this session take priority.
const savedListChoices = () => ({ ...(logseq.settings?.listProperties || {}), ...Object.fromEntries(listProps.localChoices) });
// Read again only when the saved settings or this session's choices have changed.
const listChoicesMemo = { saved: undefined, local: -1, result: new Map() };
function listChoices() {
  const memo = listChoicesMemo, saved = logseq.settings?.listProperties;
  if (memo.saved === saved && memo.local === listProps.localChoices.size + listProps.localEdits) return memo.result;
  memo.saved = saved;
  memo.local = listProps.localChoices.size + listProps.localEdits;
  const result = memo.result = new Map();
  for (const [key, value] of Object.entries(savedListChoices())) {
    try {
      const names = JSON.parse(value || '[]');
      if (Array.isArray(names) && names.length) result.set(key, new Set(names.map(String)));
    } catch (error) { /* ignore a damaged entry */ }
  }
  return result;
}
async function loadPropertyNames() {
  try {
    const rows = await logseq.DB.datascriptQuery(`[:find ?name
      :where [?p :block/tags ?c] [?c :db/ident :logseq.class/Property] [?p :block/title ?name]]`);
    listProps.names = new Set((rows || []).map(([name]) => String(name)).filter(Boolean));
    if (dateLinks.document) updateListProps(dateLinks.document);
  } catch (error) { console.warn('Refinements: could not load property names', error); }
}
const ownedBy = (el, row) => el.closest('.ls-block') === row;
function ownQuery(block) {
  const query = block.querySelector('.custom-query');
  return Boolean(query && query.closest('.ls-block') === block);
}
// Which list an element belongs to: the nearest query block, otherwise the open page.
function listKeyFor(el) {
  for (let block = el?.closest?.('.ls-block[blockid]'); block; block = block.parentElement?.closest('.ls-block[blockid]')) {
    if (ownQuery(block)) return { key: 'query:' + block.getAttribute('blockid'), label: 'this query' };
  }
  if (el?.closest?.('#main-content-container') && pdfCitations.pageUuid)
    return { key: 'page:' + pdfCitations.pageUuid, label: 'lists on this page' };
  return null;
}
// The records shown in a list (not their child blocks, and not the page's own blocks).
function listRows(doc, key) {
  const [kind, uuid] = key.split(':');
  const rows = [];
  if (kind === 'query') {
    for (const container of doc.querySelectorAll(`.ls-block[blockid="${uuid}"]`)) {
      for (const row of container.querySelectorAll('.ls-block[blockid]'))
        if (row !== container && row.parentElement?.closest('.ls-block') === container) rows.push(row);
    }
  } else if (kind === 'page' && uuid === pdfCitations.pageUuid) {
    const main = doc.getElementById('main-content-container');
    for (const row of main?.querySelectorAll('.ls-block[blockid]') || []) {
      if (row.parentElement?.closest('.ls-block') || listProps.pageBlocks.has(row.getAttribute('blockid'))) continue;
      if (row.closest(REFERENCE_AREAS)) continue;
      rows.push(row);
    }
  }
  return rows;
}
// A property's name as it appears on screen ("Diagnosis" or "Diagnosis:"), if it is one.
function propertyNameOf(el) {
  const text = (el.textContent || '').trim().replace(/:$/, '').trim();
  return text && listProps.names.has(text) ? text : null;
}
function propertyKeys(row) {
  const keys = [];
  for (const el of row.querySelectorAll('*')) {
    if (!ownedBy(el, row) || el.closest('.block-title-wrap, .bullet-container')) continue;
    const isKey = el.classList.contains('page-property-key') || el.classList.contains('property-key') ||
      (el.childElementCount === 0 && propertyNameOf(el));
    if (!isKey) continue;
    const name = propertyNameOf(el);
    if (name && !keys.some(k => k.el.contains(el))) keys.push({ el, name });
  }
  return keys;
}
// Widen from the property's name to its whole row or pill, stopping before anything that holds
// another property, the record's title or its bullet.
// Property values are small blocks with bullets of their own, so only the record's own title or
// bullet counts as a stopping point, not those inside a value.
// The record's own bullet and title are the first ones it draws; property names and values come
// after and have bullets of their own, which must not count.
function recordAnchors(row) {
  const first = selector => [...row.querySelectorAll(selector)].find(el => ownedBy(el, row));
  return [first('.bullet-container'), first('.block-title-wrap')].filter(Boolean);
}
function holdsRecordTitle(el, row) {
  if (recordAnchors(row).some(anchor => el.contains(anchor))) return true;
  return [...el.querySelectorAll('textarea, [contenteditable="true"], .editor-wrapper')].some(found => ownedBy(found, row));
}
// A record you're typing in is left exactly as Logseq draws it: its text becomes an editing box,
// which must never be hidden.
const beingEdited = row => [...row.querySelectorAll('textarea, [contenteditable="true"], .editor-wrapper')].some(el => ownedBy(el, row));
function propertyBox(key, row, keys) {
  let box = key;
  for (let parent = box.parentElement; parent && parent !== row; parent = parent.parentElement) {
    if (holdsRecordTitle(parent, row)) break;
    if (keys.some(other => other.el !== key && parent.contains(other.el))) break;
    box = parent;
  }
  return box;
}
// Everything to hide for one property: its row, or, when Logseq lays names and values out as
// side-by-side cells, the name cell and the value cell that follows it.
function propertyParts(key, name, row, keys) {
  const box = propertyBox(key, row, keys);
  const parts = [box];
  const text = (box.textContent || '').trim().replace(/:$/, '').trim();
  if (text === name) {
    const value = box.nextElementSibling;
    if (value && !keys.some(other => value.contains(other.el)) && !holdsRecordTitle(value, row) &&
        !value.matches('.block-children-container, .block-children') && !value.querySelector('.block-children-container, .block-children'))
      parts.push(value);
  }
  return parts;
}
function updateListProps(doc) {
  const choices = listChoices();
  const hide = new Set(), inline = new Map();
  if (choices.size && listProps.names.size) {
    for (const [key, shown] of choices) {
      const compact = shown.has(COMPACT);
      const names = compact ? [...shown].filter(name => name !== COMPACT && name !== BODY && name !== NO_PROPERTIES) : [];
      for (const row of listRows(doc, key)) {
        if (beingEdited(row)) continue;
        const keys = propertyKeys(row);
        for (const { el, name } of keys) if (compact || !shown.has(name)) for (const part of propertyParts(el, name, row, keys)) hide.add(part);
        if (!shown.has(BODY))
          for (const children of row.querySelectorAll('.block-children-container')) if (ownedBy(children, row)) hide.add(children);
        if (compact) {
          // Leftover property areas (empty rows, the add-property button) would still take space.
          for (const area of row.querySelectorAll('.positioned-properties.block-below, .ls-properties-area'))
            if (ownedBy(area, row) && !holdsRecordTitle(area, row)) hide.add(area);
          inline.set(row, names);
        }
      }
    }
  }
  updateInlineValues(doc, inline);
  for (const el of listProps.marked) if (!hide.has(el)) { el.removeAttribute('data-refinement-prop-hidden'); listProps.marked.delete(el); }
  for (const el of hide) if (!listProps.marked.has(el)) { el.setAttribute('data-refinement-prop-hidden', ''); listProps.marked.add(el); }
}
/* Fold or unfold every result of a query (or every record listed on a page) at once.
   Inside a query, Logseq keeps each result's fold state on screen, per list, and resets it when
   a result is drawn again (pages always come back folded). The plugin API's setBlockCollapsed
   only changes the saved state, so results folded back on their own. Instead this presses each
   result's own fold arrow, exactly as a click would, and remembers the choice for that list
   while the page is open: results drawn later (scrolling, or after Logseq redraws the list)
   are set the same way. A result you fold or unfold yourself afterwards keeps your choice. */
/* Troubleshooting for fold-all: once a fold command runs, note every fold change on a query result
   and what happened around it, so "Copy fold log" can show why a result folded back. */
const foldLog = { lines: [], last: '', start: 0, observer: null, scrollAt: 0, pressedAt: new WeakMap() };
function logFold(text) {
  if (!foldLog.start || text === foldLog.last) return; // repeats (like waiting while you type) once
  foldLog.last = text;
  foldLog.lines.push(`${((Date.now() - foldLog.start) / 1000).toFixed(2)}s ${text}`);
  if (foldLog.lines.length > 400) foldLog.lines.splice(0, foldLog.lines.length - 400);
}
const rowName = row => {
  const content = [...row.querySelectorAll('.block-content')].find(el => el.closest('.ls-block') === row);
  return `"${(content?.textContent || row.getAttribute('blockid') || '?').trim().replace(/\s+/g, ' ').slice(0, 30)}"`;
};
const resultRow = row => [...listFold.wanted.keys()].some(key => listRows(row.ownerDocument, key).includes(row));
function startFoldLog() {
  if (foldLog.observer) return;
  const doc = host(), win = doc.defaultView;
  foldLog.start = foldLog.start || Date.now();
  foldLog.observer = new win.MutationObserver(records => {
    let added = 0, removed = 0;
    for (const record of records) {
      if (record.type === 'attributes') {
        const row = record.target;
        if (!row.matches?.('.ls-block[blockid]') || !row.parentElement?.closest('.custom-query, .ls-view-body')) continue;
        const pressed = Date.now() - (foldLog.pressedAt.get(row) || 0) < 1500;
        logFold(`${rowName(row)} ${record.oldValue} -> ${row.getAttribute('data-collapsed')}${pressed ? ' (after plugin press)' : ''}${listFold.manual.has(row) ? ' (yours)' : ''}${resultRow(row) ? '' : ' (not in a fold-all list)'}`);
      } else {
        const count = nodes => [...nodes].filter(n => n.nodeType === 1 && n.matches('.ls-block[blockid], :has(.ls-block[blockid])') && n.closest?.('.custom-query, .ls-view-body')).length;
        added += count(record.addedNodes);
        removed += [...record.removedNodes].filter(n => n.nodeType === 1 && n.matches('.ls-block[blockid], :has(.ls-block[blockid])')).length;
      }
    }
    if (added || removed) logFold(`results drawn: ${added} added, ${removed} removed`);
  });
  foldLog.observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-collapsed'] });
  if (foldLog.listening) return;
  foldLog.listening = true;
  listen(win, ['scroll'], () => { if (Date.now() - foldLog.scrollAt > 1000) { foldLog.scrollAt = Date.now(); logFold('scrolling'); } });
  listen(doc, ['focusin'], event => { if (event.target.matches?.('textarea')) logFold('started editing a block'); });
  listen(doc, ['focusout'], event => { if (event.target.matches?.('textarea')) logFold('stopped editing a block'); });
  onUnload(() => { foldLog.observer?.disconnect(); foldLog.observer = null; });
}
async function copyFoldLog() {
  if (!foldLog.start) return notify('Run "Unfold all results" first, then wait until a result folds back, then run this', 'warning');
  const doc = host();
  const now = [...listFold.wanted].map(([key, { collapse }]) => {
    const rows = listRows(doc, key);
    const wrong = rows.filter(row => (row.getAttribute('data-collapsed') === 'true') !== collapse);
    return `active: ${collapse ? 'fold' : 'unfold'} ${key.slice(0, 14)}… · ${rows.length} results drawn · ${wrong.length} not as chosen: ${wrong.slice(0, 5).map(row => `${rowName(row)}${listFold.manual.has(row) ? ' (yours)' : ''} misses=${listFold.pressed.get(row)?.misses || 0}`).join(', ')}`;
  });
  showDiagnostics([await versionLine(), ...(now.length ? now : ['active: none (cleared by a page change, or never set)']), '', ...foldLog.lines].join('\n'));
}
const listFold = { wanted: new Map(), pressed: new WeakMap(), manual: new WeakSet(), round: 0, timers: [], observer: null, frame: 0 };
// A press takes Logseq a moment; until the result changes, pressing again would undo it.
const PRESS_WAIT = 600;
const MAX_MISSES = 3; // presses that changed nothing, so a result Logseq refuses to change can't loop
// The fold arrow a record draws for itself (not one of its children's).
const foldArrow = row => [...row.querySelectorAll('a.block-control')].find(el => el.closest('.ls-block') === row);
function applyListFolds(doc) {
  // Logseq's arrow ends any editing, so never press while you are typing; it catches up afterwards.
  const typing = doc.activeElement?.matches('textarea, input, [contenteditable="true"]') && doc.activeElement.closest('.ls-block');
  if (!listFold.wanted.size) return;
  if (typing) return logFold('waiting: you are editing a block');
  let pressedAny = false;
  for (const [key, { collapse, round }] of listFold.wanted) {
    for (const row of listRows(doc, key)) {
      if (listFold.manual.has(row)) continue; // you folded or unfolded this one yourself
      if ((row.getAttribute('data-collapsed') === 'true') === collapse) continue;
      if (collapse && row.getAttribute('haschild') === 'false') continue; // nothing to fold
      const arrow = foldArrow(row);
      const last = listFold.pressed.get(row);
      const earlier = last?.round === round && !last.changed ? last : null; // a press not yet seen to act
      // Still waiting for the last press to show? Then leave it alone.
      if (earlier && Date.now() - earlier.at < PRESS_WAIT) continue;
      // A press that changed nothing counts as a miss; one that worked (and Logseq later undid) does not.
      const misses = earlier ? earlier.misses + 1 : 0;
      if (!arrow || misses >= MAX_MISSES) {
        if (!earlier?.gaveUp) logFold(`${rowName(row)} left as is: ${arrow ? 'pressing did not change it' : 'no fold arrow found'}`);
        listFold.pressed.set(row, { round, at: Date.now(), misses, gaveUp: true });
        continue;
      }
      listFold.pressed.set(row, { round, at: Date.now(), misses, changed: false });
      foldLog.pressedAt.set(row, Date.now());
      logFold(`plugin presses ${rowName(row)}${misses ? ` (again: ${misses} without effect)` : ''}`);
      arrow.click();
      pressedAny = true;
    }
  }
  // Logseq's arrow acts a moment after the press; look again shortly after, in case it was undone.
  if (pressedAny) recheckListFolds();
}
/* Logseq draws a result first, then sets its fold a moment later by changing only the result's
   data-collapsed attribute. The shared watcher doesn't see attribute changes, so while a fold-all
   choice is active a small watcher looks at just that attribute. */
function watchFoldState() {
  if (listFold.observer) return;
  const doc = host(), win = doc.defaultView;
  listFold.observer = new win.MutationObserver(records => {
    for (const record of records) {
      const pressed = listFold.pressed.get(record.target);
      if (pressed && !pressed.gaveUp && record.oldValue !== record.target.getAttribute('data-collapsed')) pressed.changed = true;
    }
    if (listFold.frame) return;
    listFold.frame = win.requestAnimationFrame(() => { listFold.frame = 0; applyListFolds(doc); });
  });
  listFold.observer.observe(doc.body, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-collapsed'] });
}
function stopFoldState() {
  if (listFold.wanted.size) logFold('page changed: fold-all choice cleared');
  // The log's watcher looks at every change on screen, so it runs only while a choice is active.
  foldLog.observer?.disconnect();
  foldLog.observer = null;
  listFold.wanted.clear();
  listFold.observer?.disconnect();
  listFold.observer = null;
  for (const timer of listFold.timers) clearTimeout(timer);
}
function recheckListFolds() {
  for (const timer of listFold.timers) clearTimeout(timer);
  listFold.timers = [PRESS_WAIT + 50, 1200, 2500].map(ms => setTimeout(() => applyListFolds(host()), ms));
}
// The list a command is about: the record you right-clicked or last clicked, the block you are
// editing, or else the query on screen (the one nearest the top when there are several).
async function foldTarget(event) {
  const doc = host();
  const direct = listKeyFor(clickedRecord(event));
  if (direct) return direct;
  const editing = await logseq.Editor.getCurrentBlock().catch(() => null);
  const editingRow = editing && doc.querySelector(`#main-content-container .ls-block[blockid="${editing.uuid}"]`);
  const fromEditing = editingRow && listKeyFor(editingRow);
  if (fromEditing) return fromEditing;
  const height = doc.defaultView.innerHeight;
  const queries = [...doc.querySelectorAll('#main-content-container .custom-query')]
    .map(query => query.closest('.ls-block[blockid]')).filter(Boolean)
    .map(block => ({ block, top: block.getBoundingClientRect().top, bottom: block.getBoundingClientRect().bottom }));
  const onScreen = queries.filter(q => q.bottom > 0 && q.top < height);
  const pick = (onScreen.length ? onScreen : queries)[0];
  return pick ? listKeyFor(pick.block) : null;
}
async function foldQueryResults(event, collapse) {
  try {
    const target = await foldTarget(event);
    if (!target) return notify('No query found on this page. Right-click the bullet of a query or one of its results', 'warning');
    startFoldLog();
    logFold(`command: ${collapse ? 'fold' : 'unfold'} all in ${target.key.slice(0, 14)}… (${listRows(host(), target.key).length} results drawn)`);
    listFold.wanted.set(target.key, { collapse, round: ++listFold.round });
    // A new command applies to every result again, including ones you changed by hand before.
    listFold.manual = new WeakSet();
    // What there is to do, counted before pressing. A result with no fold arrow has nothing under it.
    const rows = listRows(host(), target.key);
    const folded = row => row.getAttribute('data-collapsed') === 'true';
    const toChange = rows.filter(row => folded(row) !== collapse && (!collapse || (row.getAttribute('haschild') !== 'false' && foldArrow(row))));
    const noArrow = toChange.filter(row => !foldArrow(row)).length; // only a folded result that cannot be unfolded
    watchFoldState();
    applyListFolds(host());
    recheckListFolds();
    const done = collapse ? 'folded' : 'unfolded', n = toChange.length, later = `results drawn later will be ${done} too`;
    if (!rows.length) notify(`No results are drawn in ${target.label} yet; they will be ${done} as they appear`);
    else if (noArrow) notify(`${noArrow} of ${n} folded result${n === 1 ? '' : 's'} in ${target.label} ${noArrow === 1 ? 'has' : 'have'} no fold arrow to press and stay${noArrow === 1 ? 's' : ''} folded. Run “Refinements: Copy fold log” for details`, 'warning');
    else if (n) notify(`${collapse ? 'Folding' : 'Unfolding'} ${n} result${n === 1 ? '' : 's'} in ${target.label}; ${later}`);
    else if (collapse && !rows.some(folded)) notify(`None of the ${rows.length} result${rows.length === 1 ? '' : 's'} drawn in ${target.label} has anything under it to fold; ${later}`);
    else notify(`Every result drawn in ${target.label} is already ${done}; ${later}`);
  } catch (error) { console.error(error); notify(`Could not fold the results: ${error.message}`, 'error'); }
}
/* One line per record: for lists set to the timeline layout, the chosen values are written after
   each record's title (from the database), and Logseq's own property rows are hidden. The list
   stays Logseq's: its query, filters, sorting, grouping and live updates are unchanged. */
const inlineWritten = new WeakMap();
const inlineKey = (uuid, names) => uuid + '|' + names.join('|');
function updateInlineValues(doc, inline) {
  const keep = new Set();
  for (const [row, names] of inline) {
    const uuid = row.getAttribute('blockid');
    const wrap = [...row.querySelectorAll('.block-title-wrap')].find(el => ownedBy(el, row));
    if (!uuid || !wrap || !names.length) continue;
    const key = inlineKey(uuid, names);
    if (!listProps.inline.has(key)) { listProps.pending.add(key); continue; }
    const html = listProps.inline.get(key);
    let span = [...wrap.children].find(el => el.classList.contains('refinement-inline-values'));
    if (!html) { span?.remove(); continue; }
    if (!span) {
      span = doc.createElement('span');
      span.className = 'refinement-inline-values';
      span.setAttribute('contenteditable', 'false');
      wrap.appendChild(span);
    }
    // Compare with what was last written, not innerHTML: the browser re-spells HTML, which would rewrite it forever.
    if (span.getAttribute('data-key') !== key || inlineWritten.get(span) !== html) { span.setAttribute('data-key', key); span.innerHTML = html; inlineWritten.set(span, html); }
    keep.add(span);
  }
  for (const span of listProps.injected) if (!keep.has(span)) span.remove();
  listProps.injected = keep;
  if (listProps.pending.size) scheduleInlineValues(50);
}
// After an edit, reload the values of every one-line row on screen.
function refreshInlineValues() {
  for (const span of listProps.injected) { const key = span.getAttribute('data-key'); if (key) listProps.pending.add(key); }
  if (listProps.pending.size) scheduleInlineValues(0);
}
function scheduleInlineValues(delay = 800) {
  clearTimeout(listProps.inlineTimer);
  listProps.inlineTimer = setTimeout(loadInlineValues, delay);
}
async function loadInlineValues() {
  const keys = [...listProps.pending];
  listProps.pending.clear();
  if (!keys.length) return;
  const version = ++listProps.inlineVersion;
  try {
    const wanted = keys.map(key => { const [uuid, ...names] = key.split('|'); return { key, uuid, names }; });
    const propByName = await propertiesByName();
    const shownFor = names => names.map(name => propByName.get(name.toLowerCase())).filter(Boolean);
    const props = [...new Set(wanted.flatMap(w => shownFor(w.names)))];
    const idRows = await dsQuery(`[:find ?b ?uuid :where ${uuidsIn('?uuid', wanted.map(w => w.uuid))} [?b :block/uuid ?uuid]]`);
    const idOf = new Map(idRows.map(([b, uuid]) => [String(uuid), b]));
    const { values, entities, titles } = await readValues([...idOf.values()], props);
    if (version !== listProps.inlineVersion) return;
    for (const { key, uuid, names } of wanted)
      listProps.inline.set(key, valuesHtml(shownFor(names), values.get(idOf.get(uuid)), { entities, titles }));
    if (dateLinks.document) updateListProps(dateLinks.document);
  } catch (error) { console.warn('Refinements: could not load values for one-line lists', error); }
}
function startListProps() {
  try {
    const doc = host(), win = doc.defaultView;
    logseq.provideStyle({ key: 'personal-db-list-props', style: `[data-refinement-prop-hidden] { display: none !important; }
.refinement-inline-values { font-weight: normal; }
.refinement-inline-values .rt-link { cursor: pointer; color: var(--ls-link-text-color, inherit); }
.refinement-inline-values .rt-link:hover { text-decoration: underline; }
.refinement-inline-values .rt-label { font-size: var(--rf-small); opacity: var(--rf-faint); }
.refinement-inline-values .rt-sep { opacity: var(--rf-faint); }` });
    // Links inside the one-line values open their page (Shift opens it in the sidebar) without starting an edit.
    listen(win, ['mousedown', 'click'], event => {
      const link = event.target?.closest?.('.refinement-inline-values .rt-link');
      if (!link) return;
      event.preventDefault(); event.stopPropagation();
      if (event.type === 'click') openEntity(link.getAttribute('data-uuid'), event.shiftKey);
    });
    // A result you fold or unfold yourself keeps your choice over a fold-all command.
    listen(win, ['click'], event => {
      if (!event.isTrusted) return;
      const row = event.target?.closest?.('a.block-control')?.closest('.ls-block');
      if (row) { listFold.manual.add(row); logFold(`you clicked the arrow of ${rowName(row)}`); }
    });
    // Remember where you last clicked, so the command palette knows which list you mean.
    listen(win, ['pointerdown'], event => { listProps.lastTarget = event.target; });
    watchDom(updateListProps);
    watchDomEarly(function listPropsEarly(doc, records) {
      if (addsElements(records) && listChoices().size) updateListProps(doc);
    });
    watchDom(applyListFolds);
    loadPropertyNames();
    onUnload(() => {
      clearTimeout(listProps.inlineTimer);
      stopFoldState();
      for (const span of listProps.injected) span.remove();
      listProps.injected.clear();
      for (const el of listProps.marked) el.removeAttribute('data-refinement-prop-hidden');
      listProps.marked.clear();
    });
  } catch (error) { console.warn('Refinements: list property choices are unavailable', error); }
}
// Properties the records in a list actually use, for the picker.
async function propertiesInList(doc, key) {
  const ids = [];
  for (const row of listRows(doc, key).slice(0, 300)) {
    const uuid = row.getAttribute('blockid');
    try {
      const entity = await logseq.Editor.getBlock(uuid) || await logseq.Editor.getPage(uuid);
      if (isEntityId(entity?.id)) ids.push(entity.id);
    } catch (error) { /* skip */ }
  }
  if (!ids.length) return [];
  const rows = await logseq.DB.datascriptQuery(`[:find ?name ?a
    :where ${idsIn('?b', ids)}
    [?b ?a _] [?p :db/ident ?a]
    [?p :block/tags ?c] [?c :db/ident :logseq.class/Property]
    [?p :block/title ?name]]`);
  // Your own properties, plus the few built-in ones Logseq shows on a record. Internal ones
  // ("Node created at", "Node collapsed?" and the like) are never shown, so they are not offered.
  const visibleBuiltIns = /^:?(?:(?:block\/)?alias|logseq\.property\/(?:description|status|priority|deadline|scheduled))$/;
  const offered = (rows || []).filter(([, ident]) => /^:?user\.property\//.test(String(ident)) || visibleBuiltIns.test(String(ident)));
  return [...new Set(offered.map(([name]) => String(name)))].filter(Boolean).sort((a, b) => a.localeCompare(b));
}
function askListProperties(label, names, shown) {
  return modal(null, (box, finish, doc) => {
    const heading = doc.createElement('label');
    heading.textContent = `Properties to show in ${label}`;
    const list = doc.createElement('div');
    list.style.cssText = 'max-height:50vh;overflow:auto;margin:4px 0 10px;';
    // Drawn by the plugin rather than as browser checkboxes, which Logseq's own styling can hide.
    const boxes = names.map(name => {
      const line = doc.createElement('div');
      line.setAttribute('role', 'checkbox');
      line.tabIndex = 0;
      line.style.cssText = 'display:flex;align-items:center;gap:10px;margin:0;padding:4px 2px;font-size:.95em;cursor:pointer;user-select:none;border-radius:4px;';
      const mark = doc.createElement('span');
      mark.style.cssText = 'flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1px solid var(--ls-border-color, rgba(128,128,128,.5));border-radius:4px;font-size:12px;line-height:1;';
      line.append(mark, doc.createTextNode(name === BODY ? BODY_LABEL : name === COMPACT ? COMPACT_LABEL : name));
      if (name === BODY) line.style.cssText += 'margin-top:6px;padding-top:8px;border-top:1px solid var(--ls-border-color, rgba(128,128,128,.25));';
      list.append(line);
      const item = { name, checked: name === COMPACT ? shown.has(COMPACT) : shown.has(name) || (!shown.size) };
      const paint = () => {
        line.setAttribute('aria-checked', String(item.checked));
        mark.textContent = item.checked ? '✓' : '';
        mark.style.background = item.checked ? 'var(--ls-secondary-text-color, #777)' : 'transparent';
        mark.style.color = 'var(--ls-primary-background-color, #fff)';
        mark.style.borderColor = item.checked ? 'transparent' : 'var(--ls-border-color, rgba(128,128,128,.5))';
      };
      const toggle = () => { item.checked = !item.checked; paint(); };
      line.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); toggle(); });
      line.addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggle(); } });
      paint();
      return item;
    });
    const buttons = modalButtons(doc, [
      ['Show all', () => finish([])],
      ['Cancel', () => finish(null)],
      ['Save', () => {
        const picked = boxes.filter(b => b.checked).map(b => b.name);
        const plain = boxes.filter(b => b.name !== COMPACT);
        // All ticked (and no one-line layout) means Logseq's normal view; none ticked means hide every property.
        finish(!picked.includes(COMPACT) && plain.every(b => b.checked) ? [] : picked.length ? picked : [NO_PROPERTIES]);
      }],
    ]);
    box.append(heading, list, buttons, modalHint(doc, 'Unticked properties are hidden in this list only. Nothing in your notes changes.'));
    list.firstElementChild?.focus();
  });
}
async function chooseListProperties(event) {
  try {
    const doc = host();
    // The bullet menu passes the clicked record; the command palette uses where you last clicked.
    const clicked = clickedRecord(event);
    const target = listKeyFor(clicked);
    if (!target) return notify('Right-click the bullet of a record in a query or list first', 'warning');
    if (!listProps.names.size) await loadPropertyNames();
    const names = [...await propertiesInList(doc, target.key), BODY, COMPACT];
    const saved0 = listChoices().get(target.key);
    // Nothing saved: everything starts ticked. "Hide all" saved: everything starts unticked.
    const current = !saved0 ? new Set() : saved0.has(NO_PROPERTIES) ? new Set([NO_PROPERTIES]) : saved0;
    const picked = await askListProperties(target.label, names, current);
    if (picked === null) return;
    const saved = savedListChoices();
    saved[target.key] = JSON.stringify(picked);
    listProps.localChoices.set(target.key, saved[target.key]);
    listProps.localEdits++;
    logseq.updateSettings({ listProperties: saved });
    // Settings update in the background; apply right away from what was picked.
    setTimeout(() => updateListProps(doc), 150);
    const count = picked.filter(name => name !== NO_PROPERTIES && name !== BODY && name !== COMPACT).length;
    notify(!picked.length ? `Showing all properties in ${target.label}`
      : count ? `Showing ${count} propert${count === 1 ? 'y' : 'ies'} in ${target.label}` : `Hiding all properties in ${target.label}`);
  } catch (error) { console.error(error); notify(`Could not choose properties: ${error.message}`, 'error'); }
}

/* Journal day as date: a record tagged (for example) #Occurrence or #Results, or any tag that
   extends them, gets its empty Date filled with the journal day it was written on. A date you
   entered yourself is never changed. New records are filled automatically; older ones are filled
   only when you run "Fill missing dates from journal days" and confirm. Where the day comes from:
   1. a block written on a journal page: that page's day;
   2. a page made from a journal block: the journal it sits under;
   3. a page created with [[Name]]#Tag in a journal: the earliest journal that links to it. */
const autoDate = { started: Date.now(), running: false, again: false, warned: false, tried: new Map() };
const AUTO_DATE_TRIES = 3;
const autoDateTagNames = () => setting('autoDateTags').split(',').map(name => name.trim().replace(/^#/, '')).filter(Boolean);
const autoDatePropertyName = () => setting('autoDateProperty').trim() || 'Date';
async function autoDateSetup() {
  // The date property: one of yours with that name. If there are several, prefer one a tag uses.
  const propRows = await dsQuery(`[:find ?ident ?p
    :where [?p :block/title ${ednString(autoDatePropertyName())}]
    [?p :block/tags ?c] [?c :db/ident :logseq.class/Property] [?p :db/ident ?ident]]`);
  const props = propRows.filter(([ident]) => /^:?user\.property\//.test(String(ident)));
  if (!props.length) return null;
  const tagProps = await dsQuery(`[:find ?t ?p :where [?t :logseq.property.class/properties ?p]]`);
  const usedProps = new Set(tagProps.map(([, p]) => p));
  const [ident] = props.find(([, p]) => usedProps.has(p)) || props[0];
  // Only the tags named in the settings, and every tag that extends them (they inherit the date property).
  const wanted = new Set(autoDateTagNames().map(name => name.toLowerCase()));
  const tags = new Set();
  if (wanted.size) for (const [t, title] of await allTags()) if (wanted.has(String(title).toLowerCase())) tags.add(t);
  if (!tags.size) return null;
  await withExtendingTags(tags);
  return { tags: [...tags], ident: bareIdent(ident) };
}
// Records missing the date, with the journal day each should get. since = earliest creation time.
async function undatedRecords(setup, since) {
  const attr = keyword(setup.ident);
  const common = `${idsIn('?t', setup.tags)}
      [?b :block/tags ?t]
      (not [?b ${attr} _])
      [?b :block/created-at ?created] [(>= ?created ${Math.floor(since)})]
      [?b :block/uuid ?uuid]`;
  const direct = await logseq.DB.datascriptQuery(`[:find ?uuid ?j
    :where ${common}
      (or-join [?b ?j]
        (and [?b :block/page ?j] [?j :block/journal-day _])
        (and [?b :block/parent ?j] [?j :block/journal-day _]))]`);
  const result = new Map();
  for (const [uuid, journal] of direct || []) result.set(String(uuid), journal);
  const linked = await logseq.DB.datascriptQuery(`[:find ?uuid ?j ?day
    :where ${common}
      (not [?b :block/page _])
      [?r :block/refs ?b] [?r :block/page ?j] [?j :block/journal-day ?day]]`);
  const earliest = new Map();
  for (const [uuid, journal, day] of linked || []) {
    const key = String(uuid);
    if (result.has(key)) continue;
    if (!earliest.has(key) || day < earliest.get(key).day) earliest.set(key, { journal, day });
  }
  for (const [key, { journal }] of earliest) result.set(key, journal);
  return result;
}
async function fillDates(setup, records) {
  let filled = 0;
  for (const [uuid, journalId] of records) {
    try {
      await logseq.Editor.upsertBlockProperty(uuid, setup.ident, journalId);
      filled++;
    } catch (error) {
      console.warn('Refinements: could not fill a date', uuid, error);
      if (!autoDate.warned) { autoDate.warned = true; notify(`Could not fill a journal date: ${error?.message || error}`, 'warning'); }
    }
  }
  return filled;
}
async function autoDateNew() {
  if (!setting('autoDate')) return;
  if (autoDate.running) { autoDate.again = true; return; } // looked at once more when this round ends
  autoDate.running = true;
  try {
    const setup = await autoDateSetup();
    if (!setup) return;
    // Only records made since the plugin started; older ones wait for the fill command.
    const records = await undatedRecords(setup, autoDate.started - 60000);
    // Filling a date changes the database, which brings the plugin back here. A record whose date
    // still counts as empty after being filled must not be filled again and again, so each record
    // gets a few tries per session; the fill command remains for anything left over.
    for (const uuid of [...records.keys()]) {
      const tries = autoDate.tried.get(uuid) || 0;
      if (tries >= AUTO_DATE_TRIES) records.delete(uuid); else autoDate.tried.set(uuid, tries + 1);
    }
    if (records.size) await fillDates(setup, records);
  } catch (error) { console.warn('Refinements: journal dates could not be checked', error); }
  finally {
    autoDate.running = false;
    if (autoDate.again) { autoDate.again = false; autoDateNew(); }
  }
}
function confirmBox(message, okLabel) {
  return modal(false, (box, finish, doc) => {
    const text = doc.createElement('label');
    text.textContent = message;
    text.style.lineHeight = '1.5';
    const buttons = modalButtons(doc, [['Cancel', () => finish(false)], [okLabel, () => finish(true)]]);
    buttons.style.marginTop = '12px';
    box.append(text, buttons);
    buttons.lastElementChild.focus();
  });
}
async function fillMissingDates() {
  try {
    const setup = await autoDateSetup();
    if (!setup) return notify(`Couldn't find the tags (${autoDateTagNames().join(', ')}) or a property named “${autoDatePropertyName()}”. Check the plugin settings.`, 'warning');
    const records = await undatedRecords(setup, 0);
    if (!records.size) return notify('Every record already has a date, or none was written on a journal day');
    const ok = await confirmBox(`${records.size} record${records.size === 1 ? '' : 's'} tagged ${autoDateTagNames().map(n => '#' + n).join(' or ')} (or a tag that extends them) ${records.size === 1 ? 'has' : 'have'} no ${autoDatePropertyName()}. Fill each with the journal day it was written on? Dates you've already entered are not touched.`, 'Fill dates');
    if (!ok) return;
    autoDate.warned = false;
    const filled = await fillDates(setup, records);
    notify(`Filled ${filled} date${filled === 1 ? '' : 's'}`);
  } catch (error) { console.error(error); notify(`Filling dates stopped: ${error.message}`, 'error'); }
}

const quietUi = { marked: new Set() };
const quietItemNames = () => new Set(setting('quietItems').split(',').map(name => name.trim().toLowerCase()).filter(Boolean));
function updateQuietUi(doc) {
  const names = quietItemNames();
  const clean = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const mark = el => { if (!el.hasAttribute('data-refinement-quiet')) { el.setAttribute('data-refinement-quiet', ''); quietUi.marked.add(el); } };
  // Named sidebar/toolbar items: match visible text, title or aria-label.
  if (names.size) {
    for (const root of doc.querySelectorAll('#left-sidebar, #head')) {
      for (const el of root.querySelectorAll('a, button, [role="button"]')) {
        const label = (el.getAttribute('aria-label') || el.getAttribute('title') || clean(el)).toLowerCase();
        if (names.has(label)) mark(el);
      }
    }
  }
}
function startQuietUi() {
  try {
    watchDom(updateQuietUi);
    onUnload(() => {
      for (const el of quietUi.marked) el.removeAttribute('data-refinement-quiet');
      quietUi.marked.clear();
    });
  } catch (error) { console.warn('Refinements: quiet items are unavailable', error); }
}

/* PERF-DEBUG start. Measuring for troubleshooting; it changes nothing on screen. Off unless the
   hidden setting debugPerf is true ("Refinements: Turn measuring on or off"). While off, every
   perf.* call returns at once. To remove: delete this block, the two perf commands in main(), and
   each line that mentions perf (`grep -c "perf\." main.js` must then be 0). */
const perf = {
  on: false, win: null, since: 0, raf: 0, channel: null, observers: [], inFrame: false, ownWrite: false, log: [], every: 0,
  times: new Map(), seenBy: new Map(), styles: new Map(), passes: { ok: 0, late: 0, echo: 0 },
  long: { tasks: 0, taskMs: 0, frames: 0, frameMs: 0, worst: 0, pluginMs: 0, otherMs: 0 },
  shifts: { count: 0, score: 0, afterInput: 0, sources: new Map() },
  reset() {
    perf.since = Date.now();
    perf.times.clear(); perf.seenBy.clear(); perf.styles.clear(); perf.shifts.sources.clear();
    Object.assign(perf.passes, { ok: 0, late: 0, echo: 0 });
    Object.assign(perf.long, { tasks: 0, taskMs: 0, frames: 0, frameMs: 0, worst: 0, pluginMs: 0, otherMs: 0 });
    Object.assign(perf.shifts, { count: 0, score: 0, afterInput: 0 });
  },
  // Time spent in one update function.
  add(name, ms) {
    if (!perf.on) return;
    const s = perf.times.get(name) || { n: 0, total: 0, max: 0 };
    s.n++; s.total += ms; if (ms > s.max) s.max = ms;
    perf.times.set(name, s);
  },
  time(name, fn) {
    if (!perf.on) return fn();
    const started = performance.now();
    try { return fn(); } finally { perf.add(name, performance.now() - started); }
  },
  // What one watcher was called for: how many changes, of which kind, and which attributes.
  seen(name, records) {
    if (!perf.on) return;
    const s = perf.seenBy.get(name) || { calls: 0, records: 0, childList: 0, characterData: 0, attributes: 0, names: new Map() };
    s.calls++; s.records += records.length;
    for (const record of records) {
      s[record.type]++;
      if (record.type === 'attributes') s.names.set(record.attributeName, (s.names.get(record.attributeName) || 0) + 1);
    }
    perf.seenBy.set(name, s);
  },
  style(key, text, sent) {
    if (!perf.on) return;
    const s = perf.styles.get(key) || { built: 0, sent: 0, size: 0 };
    s.built++; if (sent) s.sent++; s.size = text.length;
    perf.styles.set(key, s);
  },
  // Was the change the shared watcher is about to handle made while a frame was being drawn (so
  // its pass lands a frame late), by the plugin's own pass (an echo), or in time?
  ownSettingsOnly(now, before) {
    const changed = Object.keys({ ...now, ...before }).filter(key => JSON.stringify(now?.[key]) !== JSON.stringify(before?.[key]));
    return changed.length > 0 && changed.every(key => /^(?:perf|debugPerf)/.test(key));
  },
  frameState() { return !perf.on ? '' : perf.ownWrite ? 'echo' : perf.inFrame ? 'late' : 'ok'; },
  pass(state) { if (perf.on && state) perf.passes[state]++; },
  passDone() {
    if (!perf.on) return;
    perf.ownWrite = true;
    queueMicrotask(() => { perf.ownWrite = false; });
  },
  start() {
    if (perf.on) return;
    const win = host().defaultView;
    perf.win = win; perf.on = true; perf.reset();
    // inFrame is true from the start of a frame's drawing until the first task after it.
    perf.channel = new MessageChannel();
    perf.channel.port1.onmessage = () => { perf.inFrame = false; };
    const tick = () => {
      if (!perf.on) return;
      perf.raf = win.requestAnimationFrame(tick);
      perf.inFrame = true;
      perf.channel.port2.postMessage(0);
    };
    perf.raf = win.requestAnimationFrame(tick);
    const seconds = Number(logseq.settings?.debugPerfEvery) || 0;
    if (seconds > 0) perf.every = setInterval(logPerfReport, Math.max(2, seconds) * 1000);
    const watch = (type, onEntry) => {
      try {
        const observer = new win.PerformanceObserver(list => { for (const entry of list.getEntries()) onEntry(entry); });
        observer.observe({ type });
        perf.observers.push(observer);
      } catch (error) { /* this browser does not report that kind */ }
    };
    watch('longtask', entry => { perf.long.tasks++; perf.long.taskMs += entry.duration; });
    watch('long-animation-frame', entry => {
      perf.long.frames++; perf.long.frameMs += entry.duration;
      if (entry.duration > perf.long.worst) perf.long.worst = entry.duration;
      for (const script of entry.scripts || []) {
        if (/main\.js\?t=/.test(script.sourceURL || '')) perf.long.pluginMs += script.duration; else perf.long.otherMs += script.duration;
      }
    });
    watch('layout-shift', entry => {
      if (entry.hadRecentInput) { perf.shifts.afterInput++; return; }
      perf.shifts.count++; perf.shifts.score += entry.value;
      for (const source of entry.sources || []) {
        const node = source.node, el = node?.nodeType === 1 ? node : node?.parentElement;
        if (!el) continue;
        const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
        const name = el.tagName.toLowerCase() + (cls ? '.' + cls : '');
        perf.shifts.sources.set(name, (perf.shifts.sources.get(name) || 0) + 1);
      }
    });
  },
  stop() {
    if (!perf.on) return;
    perf.on = false; perf.inFrame = false;
    clearInterval(perf.every); perf.every = 0;
    perf.win?.cancelAnimationFrame(perf.raf);
    for (const observer of perf.observers) observer.disconnect();
    perf.observers = [];
    perf.channel?.port1.close();
    perf.channel = null;
  },
};
function togglePerf() {
  try {
    const on = !perf.on;
    logseq.updateSettings({ debugPerf: on });
    if (on) perf.start(); else perf.stop();
    notify(on ? 'Measuring is on. Use Logseq, then run “Refinements: Copy performance report”' : 'Measuring is off');
  } catch (error) { console.error(error); notify(`Could not change measuring: ${error.message}`, 'error'); }
}
// Shows what was measured since the last report (or since measuring began), saves the same text
// in the plugin's settings file as perfReport, and starts counting afresh.
async function perfReportText() {
  const ms = value => value.toFixed(1);
  const lines = [await versionLine(), `measured for ${((Date.now() - perf.since) / 1000).toFixed(1)} s`, '',
    'WATCHERS  calls · changes seen (added or removed · text · attributes) · attributes that fired'];
  for (const [name, s] of perf.seenBy) {
    const names = [...s.names].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([attr, n]) => `${attr} ${n}`).join(', ');
    lines.push(`  ${name}: ${s.calls} · ${s.records} (${s.childList} · ${s.characterData} · ${s.attributes})${names ? ' · ' + names : ''}`);
  }
  lines.push('', 'UPDATES  calls · total ms · average ms · longest ms');
  for (const [name, s] of [...perf.times].sort((a, b) => b[1].total - a[1].total))
    lines.push(`  ${name}: ${s.n} · ${ms(s.total)} · ${ms(s.total / s.n)} · ${ms(s.max)}`);
  lines.push('', 'STYLESHEETS  times built · times sent to Logseq · latest size in characters');
  for (const [key, s] of perf.styles) lines.push(`  ${key}: ${s.built} · ${s.sent} · ${s.size}`);
  const p = perf.passes, l = perf.long, sh = perf.shifts;
  lines.push('', `SHARED WATCHER PASSES  in time ${p.ok} · a frame late ${p.late} · echo of the plugin's own changes ${p.echo}`,
    `LONG TASKS (over 50 ms)  ${l.tasks} · ${ms(l.taskMs)} ms in all`,
    `LONG FRAMES (over 50 ms)  ${l.frames} · ${ms(l.frameMs)} ms in all · worst ${ms(l.worst)} ms · plugin's code ${ms(l.pluginMs)} ms · other code ${ms(l.otherMs)} ms`,
    `LAYOUT SHIFTS (things moving without input)  ${sh.count} · score ${sh.score.toFixed(4)} · right after input (not counted) ${sh.afterInput}`);
  for (const [name, n] of [...sh.sources].sort((a, b) => b[1] - a[1]).slice(0, 12)) lines.push(`  moved ${n}×: ${name}`);
  perf.reset();
  return lines.join('\n');
}
async function copyPerfReport() {
  if (!perf.on) return notify('Measuring is off. Run “Refinements: Turn measuring on or off” first', 'warning');
  const text = await perfReportText();
  logseq.updateSettings({ perfReport: text });
  showDiagnostics(text);
}
// With the hidden setting debugPerfEvery (seconds), a report is added to perfLog in the settings
// file at that interval, newest last, so a session can be measured without running the command.
async function logPerfReport() {
  try {
    const stamp = new Date().toTimeString().slice(0, 8);
    perf.log.push(`--- ${stamp} ---\n${await perfReportText()}`);
    if (perf.log.length > 40) perf.log.splice(0, perf.log.length - 40);
    logseq.updateSettings({ perfLog: perf.log.join('\n\n') });
  } catch (error) { console.warn('Refinements: could not save a performance report', error); }
}
/* PERF-DEBUG end */

/* After the database changes, everything the plugin knows from it is looked up again in one round:
   as soon as the changes pause, or every few seconds while they keep coming (typing). Seven
   separate timers used to do this, finishing at three different moments after each edit. */
const dbWork = { timer: 0, since: 0 };
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
  // The page's cues and details are part of this round; a look-up still waiting from a page change is not needed too.
  clearTimeout(refreshTimer);
  clearTimeout(pageKind.timer);
  const failed = error => console.warn('Refinements: a look-up after a change failed', error);
  for (const job of [loadPageLabelTitles, refreshCues, refreshJournalDates, loadPropertyNames, loadPageKind, refreshInlineValues, autoDateNew]) {
    try { Promise.resolve(job()).catch(failed); } catch (error) { failed(error); }
  }
}
function main() {
  logseq.beforeunload(runUnloadTasks);
  takeOverFromEarlierCopy();
  try { if (logseq.settings?.debugPerf === true) perf.start(); } catch (error) { console.warn('Refinements: measuring could not start', error); }
  onUnload(perf.stop);
  logseq.useSettingsSchema(settingsSchema);
  logseq.provideStyle({ key: 'personal-db-tokens', style: tokensCss });
  sendStyle('personal-db-refinements', mainCss());
  applyHierarchy();
  startDateLinks();
  startPdfCitations();
  if (setting('tidySidebar')) startSidebarPresentation();
  if (setting('tidySearch')) {
    logseq.provideStyle({ key: 'personal-db-search', style: searchCss });
    startSearchCleanup();
  }
  startQuietUi();
  if (setting('showTitleChrome')) startTitleChrome();
  startPageKind();
  startListProps();
  startSidebarSearchButton();
  startNestedReferenceLinks();
  logseq.provideStyle({ key: 'personal-db-context-cues', style: cueCss });
  scheduleRefresh();
  onUnload(() => { clearTimeout(refreshTimer); ++refreshVersion; });

  // Every hook returns an "off" function; each is called when the plugin unloads.
  // A fold-all choice lasts while its page is open.
  onUnload(logseq.App.onRouteChanged(() => {
    stopFoldState();
    // What is known about the page just left must not be applied to the one arriving: its list
    // choice would hide parts of the new page until the new page's own details have loaded.
    pdfCitations.pageUuid = null;
    listProps.pageBlocks = new Set();
    cueMarks.incoming = new Map();
    scheduleRefresh(); schedulePageKind();
  }));
  // Edits fire this constantly while typing, so each part waits for a pause before re-querying.
  onUnload(logseq.DB.onChanged(({ blocks } = {}) => {
    perf.add('DB.onChanged (calls only)', 0);
    if (foldLog.start) logFold(`database changed (${blocks?.length ?? '?'} block${blocks?.length === 1 ? '' : 's'})`);
    scheduleDbWork();
  }));
  onUnload(() => clearTimeout(dbWork.timer));
  onUnload(logseq.Editor.onInputSelectionEnd(async ({ text, start, end }) => {
    const block = await logseq.Editor.getCurrentBlock();
    const content = await logseq.Editor.getEditingBlockContent();
    if (text && block) recentSelection = { text, blockId: block.uuid, start, end, content, at: Date.now() };
  }));
  onUnload(logseq.onSettingsChanged((now, before) => {
    if (perf.ownSettingsOnly(now, before)) return;
    try { updateListProps(host()); } catch (error) { /* list choices apply on the next change */ }
    applyHierarchy();
    sendStyle('personal-db-refinements', mainCss());
    if (CUE_SETTINGS.some(key => now?.[key] !== before?.[key])) scheduleRefresh(0);
    if (now?.pdfCitations !== before?.pdfCitations) updatePdfCitations();
    try { updatePageKind(host()); } catch (error) { /* shown on the next change */ }
    if (RELOAD_SETTINGS.some(key => now?.[key] !== before?.[key])) notify('Reload the Refinements plugin to apply this change', 'info');
  }));

  // Command palette entries: [key, label, action, shortcut setting]. A shortcut left empty in the settings is not bound.
  const commands = [
    ['copy-block-children-to-page', 'Copy block and children to new page', blockToPage, 'copyShortcut'],
    ['labeled-page-link', 'Link selected text to a page', labeledPageLink, 'linkShortcut'],
    ['selected-text-to-page', 'Open selected text as page', selectionToPage, 'openShortcut'],
    ['search-in-sidebar', 'Search in right sidebar', searchInSidebar, 'searchShortcut'],
    ['add-page-tags', 'Add tags to this page', addTagsToPage, 'tagShortcut'],
    ['show-settings', 'Show shortcuts and settings', () => logseq.showSettingsUI()],
    ['check-link-labels', 'Check linked-record labels (troubleshooting)', checkLinkLabels],
    ['copy-header-details', 'Copy page title area details (troubleshooting)', copyHeaderDiagnostics],
    ['check-what-is-found', 'Check what the plugin finds on this page (troubleshooting)', checkWhatIsFound],
    ['fold-query-results', 'Fold all results in this query', () => foldQueryResults(null, true)],
    ['unfold-query-results', 'Unfold all results in this query', () => foldQueryResults(null, false)],
    ['copy-fold-log', 'Copy fold log (troubleshooting)', copyFoldLog],
    ['toggle-perf', 'Turn measuring on or off (troubleshooting)', togglePerf],
    ['copy-perf-report', 'Copy performance report (troubleshooting)', copyPerfReport],
    ['choose-list-properties', 'Choose properties shown in this list', chooseListProperties],
    ['fill-missing-dates', 'Fill missing dates from journal days', fillMissingDates],
  ];
  for (const [key, label, action, shortcut] of commands) {
    const binding = shortcut && setting(shortcut).trim().toLowerCase();
    logseq.App.registerCommandPalette({ key, label: 'Refinements: ' + label, ...(binding ? { keybinding: { binding } } : {}) }, action);
  }
  // Right-click menu on a bullet.
  const blockMenu = [
    ['Copy children to new page', blockToPage],
    ['Choose properties shown in this list', chooseListProperties],
    ['Fold all results', event => foldQueryResults(event, true)],
    ['Unfold all results', event => foldQueryResults(event, false)],
    ['Copy styling details (troubleshooting)', copyDiagnostics],
  ];
  for (const [label, action] of blockMenu) logseq.Editor.registerBlockContextMenuItem('Refinements: ' + label, action);
}
logseq.ready(main).catch(console.error);
