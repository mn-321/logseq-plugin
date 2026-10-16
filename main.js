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
// Search marks (data-rf-*, .rf-search-*) belong to the search part (parts/search.js), which clears its own.
const STRAY_ELEMENTS = '.refinement-child-assets, .refinement-hidden-toggle, .refinement-inline-values, .refinement-title-tags, .refinement-alias-of, .refinement-inherited, .refinement-prompt-backdrop';
// Every mark the plugin sets on Logseq's own elements (grep "data-refinement-" when adding one).
const STRAY_ATTRIBUTES = [...['ref-row', 'date', 'date-heading', 'tag-page', 'property-crumb', 'pdf', 'pdf-line', 'pdf-citation-block',
  'citation', 'quiet', 'sidebar-hidden', 'always-shown', 'prop-hidden', 'block-link', 'prop-label', 'via', 'via-value', 'crumb-box', 'ref-count', 'here', 'below', 'quiet-menu', 'hidden-toggle', 'hidden-open', 'hidden-extra', 'hidden-hover'].map(name => 'data-refinement-' + name)];
function sweepEarlierCopy(doc) {
  for (const el of doc.querySelectorAll(STRAY_ELEMENTS)) el.remove();
  for (const name of STRAY_ATTRIBUTES) for (const el of doc.querySelectorAll(`[${name}]`)) el.removeAttribute(name);
  for (const el of doc.querySelectorAll('.is-page-title-row .ls-block-right .block-tags')) el.style.transform = '';
}

// Tables already provide structure, so several rules leave anything inside one alone.
const notInTable = ':not(:is(table, [role="table"], [role="grid"], .table-view, .ls-table) *)';
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
  /* the link to the page on screen, under Linked references: a faint grey wash of the theme's own text
     colour with a slightly firmer hairline beneath, like a pencil mark (pale on light themes, soft on dark) */
  --rf-here: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 7%, transparent);
  --rf-here-line: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 38%, transparent);
  --rf-small: .82em;     /* labels beside text */
  --rf-accent: #8b7fc7;  /* the optional tag chip; the only colour of the plugin's own */
  /* the icon of a link to a tag's page: the colour Logseq's theme gives tags, checked in Logseq's order */
  --rf-tag-color: var(--lx-accent-11, var(--ls-tag-text-color, var(--ls-link-text-color, currentColor)));
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
  ['quietLinks', `/* Type cues on rendered references. Tags keep Logseq's own look. */
/* A link to a tag's own page looks like a page link (underlined name) but its icon is in the colour
   Logseq gives tags, where a page's icon is in the full text colour. The icon is the tag's own, or a
   # drawn as an icon. Only the icon takes the colour; the name stays in the text colour.
   The # is drawn at the start of the name's own span, not on the link element: Logseq ignores a
   press whose target is the <a> itself (frontend.util/link?), so a # drawn as the link's ::before
   could not be clicked. It is an inline box holding a word joiner, so it cannot be left behind at
   a line end either. */
.page-reference[data-ref] a.page-ref { text-decoration-color: color-mix(in srgb, currentColor var(--rf-line-pct), transparent) !important; }
`],
  ['referenceIcons', `${referenceIcon('.ls-block .block-content a:is([href*=".pdf" i], [data-href*=".pdf" i]:not([data-url])):not(:has(img))', documentIcon)}
${referenceIcon('.ls-block .block-content a:is([href*=".png" i], [data-href*=".png" i]:not([data-url]), [href*=".jpg" i], [data-href*=".jpg" i]:not([data-url]), [href*=".jpeg" i], [data-href*=".jpeg" i]:not([data-url]), [href*=".webp" i], [data-href*=".webp" i]:not([data-url])):not(:has(img))', imageIcon)}
/* Links to files: the words in normal text with the same faint underline as a page link, a grey
   icon in front, and the file type after in the same small grey as the cues after a block.
   A link to a file on the web has an href; Logseq draws a link to a file in the graph's assets folder
   with data-href instead (seen in 2.0.2), so both are matched. The row of an asset block (the file itself,
   listed with Logseq's own icon in its bullet) carries data-url as well and is left alone. */
.ls-block .block-content a:is([href*=".pdf" i], [data-href*=".pdf" i]:not([data-url]), [href*=".png" i], [data-href*=".png" i]:not([data-url]), [href*=".jpg" i], [data-href*=".jpg" i]:not([data-url]), [href*=".jpeg" i], [data-href*=".jpeg" i]:not([data-url]), [href*=".webp" i], [data-href*=".webp" i]:not([data-url])):not(:has(img)) {
  color: var(--ls-primary-text-color, inherit) !important; border-bottom: 0 !important;
  text-decoration: underline solid color-mix(in srgb, currentColor var(--rf-line-pct), transparent) 1px !important; text-underline-offset: .2em;
}
.ls-block .block-content a:is([href*=".pdf" i], [data-href*=".pdf" i]:not([data-url]), [href*=".png" i], [data-href*=".png" i]:not([data-url]), [href*=".jpg" i], [data-href*=".jpg" i]:not([data-url]), [href*=".jpeg" i], [data-href*=".jpeg" i]:not([data-url]), [href*=".webp" i], [data-href*=".webp" i]:not([data-url])):not(:has(img)):hover { text-decoration-color: currentColor !important; }
.ls-block .block-content a:is([href*=".pdf" i], [data-href*=".pdf" i]:not([data-url]), [href*=".png" i], [data-href*=".png" i]:not([data-url]), [href*=".jpg" i], [data-href*=".jpg" i]:not([data-url]), [href*=".jpeg" i], [data-href*=".jpeg" i]:not([data-url]), [href*=".webp" i], [data-href*=".webp" i]:not([data-url])):not(:has(img))::before { text-decoration: none; }
.ls-block .block-content a:is([href*=".pdf" i], [data-href*=".pdf" i]:not([data-url]), [href*=".png" i], [data-href*=".png" i]:not([data-url]), [href*=".jpg" i], [data-href*=".jpg" i]:not([data-url]), [href*=".jpeg" i], [data-href*=".jpeg" i]:not([data-url]), [href*=".webp" i], [data-href*=".webp" i]:not([data-url])):not(:has(img))::after {
  display: inline-block; margin-left: .35em; text-decoration: none; color: var(--ls-secondary-text-color, inherit);
  opacity: var(--rf-quiet); font-size: var(--rf-small); font-weight: 400; white-space: nowrap; user-select: none;
}
.ls-block .block-content a:is([href*=".pdf" i], [data-href*=".pdf" i]:not([data-url])):not(:has(img))::after { content: 'pdf'; }
.ls-block .block-content a:is([href*=".png" i], [data-href*=".png" i]:not([data-url])):not(:has(img))::after { content: 'png'; }
.ls-block .block-content a:is([href*=".jpg" i], [data-href*=".jpg" i]:not([data-url])):not(:has(img))::after { content: 'jpg'; }
.ls-block .block-content a:is([href*=".jpeg" i], [data-href*=".jpeg" i]:not([data-url])):not(:has(img))::after { content: 'jpeg'; }
.ls-block .block-content a:is([href*=".webp" i], [data-href*=".webp" i]:not([data-url])):not(:has(img))::after { content: 'webp'; }
.ls-datetime a::before, .timestamp a::before, a.page-ref:is([data-refinement-date], [data-uuid^="00000001-"])::before,
a.page-ref:has(.prefix-link[data-refinement-pdf])::before { content: none !important; }
/* A block reference contains the referenced block's title area; a page link never does.
   This lets references be styled from the rendered page, before it is painted. */
${blockDot('.ls-block a.page-ref:not(.tag):not(:has(.prefix-link, img)) .block-title-wrap')}
/* A linked task shows its status and priority icons before the link. The dot stays, moved in front of
   the icons (dot, icons, words); a word joiner in its old place keeps the icons on the same line as
   the first word. (:has() may not sit inside another :has(), so the exclusions stand beside it.) */
.ls-block .page-reference:has(> .inline-block > .positioned-properties.block-left) a.page-ref .block-title-wrap::before { content: '\\2060' !important; }
${blockDot('.ls-block .page-reference:has(> .inline-block > .positioned-properties.block-left):has(a.page-ref:not(.tag) .block-title-wrap):not(:has(.prefix-link, a.page-ref img))')}
.ls-block .page-reference:has(a.page-ref .block-title-wrap) > .inline-block:has(> .positioned-properties.block-left) { padding-right: .25em; }
/* The icon of a linked page or tag page stays with its name. Logseq's icon is a box of its own, and
   a line may break after such a box whatever follows it (a word joiner did not hold it: seen in
   2.0.2), so the link is kept whole: it moves to the next line together when it does not fit. */
.ls-block .block-content a.page-ref:not(.tag):has(> .icon-emoji-wrap) { display: inline-block; max-width: 100%; }
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
/* When the row is too long, Logseq adds an outlined "Expand" capsule after it. It becomes a small
   triangle at the start of the row instead, like the one beside a parent block: pointing right while
   the row is cut short, down while it is open. Logseq marks the row data-expanded. */
.ls-block .positioned-properties.block-below .bottom-property-expand-btn {
  order: -1; align-self: flex-start !important; flex: none; width: 1rem !important; height: 1.5rem !important;
  padding: 0 !important; margin-right: -.125rem; background: transparent !important; border-radius: 0 !important;
  font-size: 0 !important; color: var(--ls-primary-text-color); opacity: var(--rf-faint);
}
.ls-block .positioned-properties.block-below .bottom-property-expand-btn:hover { opacity: 1; }
.ls-block .positioned-properties.block-below .bottom-property-expand-btn:not(:focus-visible) { box-shadow: none !important; }
.ls-block .positioned-properties.block-below .bottom-property-expand-btn .bottom-property-action-icon { display: none; }
.ls-block .positioned-properties.block-below .bottom-property-expand-btn::before {
  content: ''; width: 7px; height: 8px; background: currentColor; clip-path: polygon(0 0, 100% 50%, 0 100%);
  transition: transform .16s ease;
}
.ls-block .positioned-properties.block-below .bottom-properties-row[data-expanded=true] .bottom-property-expand-btn::before { transform: rotate(90deg); }
/* Layers of a record, from loudest to quietest: its title, the values of its properties, and the
   names of those properties. A property's name (and its colon) takes the theme's secondary text
   colour, so the value is what the eye lands on; values keep full contrast. Greys only. */
.ls-block .positioned-properties.block-below .bottom-property-pill > div:first-child,
.ls-block .positioned-properties.block-below .bottom-property-pill > div:first-child :is(.property-k, a) {
  color: var(--ls-secondary-text-color, currentColor) !important;
}
.ls-properties-area .property-pair.property-panel-row .property-key-panel,
.ls-properties-area .property-pair.property-panel-row .property-key-panel :is(.property-k, a) {
  color: var(--ls-secondary-text-color, currentColor) !important;
}
.ls-properties-area .property-pair.property-panel-row .property-key-panel { font-size: .94em; }
/* A property list under a block sits on an ultra-light grey field with square corners, so its values read as
   facts filed under names, not as more blocks. The page's own list under its title is left as it is. */
.ls-block .ls-properties-area:not(:is(.ls-page-title, .page-title) *):has(.property-pair) {
  background: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 3%, transparent); border-radius: 0;
  padding: .15rem .9rem .15rem 0; margin-right: .5rem;
}
/* That box starts where the child blocks below start, so its bullets and names sit in their column, and
   it stops at the right edge the #tags end on. */
/* The tabs below a page's properties are tags (the records listed under each are tagged with it), so
   each tab name starts with a #. A tab is not a link, so the # keeps the name's own colour and weight. */
.ls-bidirectional-properties [role="tab"] > span > span:last-child::before { content: '#'; margin-right: .05em; }
/* Records listed under a tag tab start where the page's own blocks start. */
.ls-bidirectional-block-container .blocks-list-wrap > .ls-block[level="0"] { margin-left: -1.25rem; }
/* A value written as text (such as an email) sat a few pixels right of the values beside it. */
.property-pair .property-value-inner:has(.property-block-container) { position: relative; left: -4px; }
/* A query's "2 results" sits on the same line as its title and ends where the #tags end. */
.custom-query-title.justify-between { align-items: baseline; }
.custom-query-title .results-count { margin-right: .5rem; }
/* A little air between a record's properties and the blocks written beneath it. */
.ls-block > .block-main-container :is(.positioned-properties.block-below, .ls-block-properties):last-child { margin-bottom: .2rem; }
/* The page's own properties under its title sit on the same light field, so properties look the same
   wherever they are. The field starts where the names start (the padding is taken back on the left). */
.ls-page-properties.ls-properties-area:has(.property-pair) {
  background: color-mix(in srgb, var(--ls-primary-text-color, currentColor) 3%, transparent); border-radius: 0;
  padding: .3rem .9rem .3rem .5rem; margin-left: -.5rem;
}
/* One column of dots: a value is a block of its own and carried a bullet, so four properties showed
   eight dots. The name's dot (or type icon) stays; the value's bullet goes. */
.ls-page-properties .property-value-panel .block-control-wrap { display: none !important; }
/* "Add property" waits until you point at the properties (or move into them with the keyboard), on a
   page and in the right sidebar alike, so a page with nothing to add shows no button. */
.ls-page-properties .ls-new-property { opacity: 0 !important; transition: opacity .15s; }
.ls-page-properties:is(:hover, :focus-within) .ls-new-property { opacity: var(--rf-quiet) !important; }
.ls-page-properties .ls-new-property:is(:hover, :focus-within) { opacity: 1 !important; }
`],
  ['ownTagHidden', `/* On a tag's own page, every record and reference carries that tag; the tag is left off there.
   The rows (and the Tags cells of its table) are marked by updateOwnTags. */
[data-refinement-own-tag] { display: none !important; }
`],
  ['quietSidebarIcons', `/* The left sidebar's lists: an icon only where it says something. Logseq's generic page icon goes
   (its room stays, so names line up); a tag's # and an icon you chose, or that comes from a tag, stay.
   Journal days are in grey: a date already looks like a date. Marked by updateSidebarJournals. */
#left-sidebar a.link-item .page-icon .ls-icon-file { visibility: hidden; }
#left-sidebar a.link-item[data-refinement-journal] .page-title { color: var(--ls-secondary-text-color, currentColor); }
`],
  ['compactJournals', `/* On the Journals list Logseq gives every day at least 500px and a wide band below it, so an empty
   day is a screen of nothing. A day is now as tall as what it holds. */
#journals .journal-item { min-height: 0 !important; padding-bottom: 2em !important; }
`],
  ['embedLine', `/* Content shown from somewhere else (a Node embed of a block or a page, which Logseq draws as
   .embed-block) gets a faint left line. Inset shadows draw the line without moving any text. */
.ls-block.embed-block:not(.embed-block .ls-block) {
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
  ['referenceLayout', `/* The blocks below a reference step back unless they hold a link to the page on screen themselves. */
#main-content-container .references .ls-block[level="0"] .block-children .ls-block[data-refinement-below] > .block-main-container { opacity: var(--rf-quiet); }
#main-content-container .references .ls-block[level="0"] .block-children .ls-block[data-refinement-below]:hover > .block-main-container { opacity: 1; }
`],
  ['referenceLayout', `/* Linked and Unlinked references: each source page is a group set apart from the next. */
#main-content-container :is(.references, .unlinked-references) .group-list-view > div > div > div + div { padding-top: 1.6em; }
/* A journal's Linked references (and Unlinked references, on any page where the wrapper is missing) are drawn without .group-list-view; the same gap goes before every
   source page after the first there (the box that holds a source page's heading, or the one around it). */
#main-content-container :is(.references, .unlinked-references):not(:has(.group-list-view)) .ls-view-body > div > div.content + div.content:has(> div > .ls-foldable-title),
#main-content-container :is(.references, .unlinked-references):not(:has(.group-list-view)) .ls-view-body > div > div.content > div + div:has(> .ls-foldable-title) { padding-top: 1.6em; }
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
/* Logseq's fold arrows are left as Logseq shows them (under the pointer). A source page's arrow hangs to
   the left of its heading, where the list is cut off; the list's edge moves out to make room. */
:is(.references, .unlinked-references) .ls-foldable-content-inner:has(> .ls-view-body) { margin-left: -27px; padding-left: 27px; }
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
  ['plainPathLinks', `/* Links in grey parent paths: their plain words with the faint page-link underline. */
::highlight(refinement-crumb-link) {
  text-decoration-line: underline; text-decoration-style: solid; text-decoration-thickness: 2px;
  text-decoration-color: color-mix(in srgb, currentColor var(--rf-line-pct), transparent);
}
`],
  ['linkLabels', `/* A lone property name above a group of references; the value's own label replaces it. */
[data-refinement-crumb-box] { display: none !important; }
`],
  ['tidyPaths', `/* Parent paths on pages use the room they have: each part is cut short only when the whole path runs out of space. */
:is(#main-content-container, #right-sidebar) .breadcrumb.block-parents .breadcrumb__segment { max-width: none; flex-shrink: .1; }
:is(#main-content-container, #right-sidebar) .breadcrumb.block-parents .breadcrumb__segment:not(:has(~ .breadcrumb__segment)) { flex-shrink: 1; }
`],
  ['referenceIcons', `/* A block (not a page) shown inside a reference stays without an underline. */
.ls-block .block-content a.page-ref[data-uuid] a.page-ref[data-uuid]:not(.tag):not([data-refinement-date], [data-uuid^="00000001-"]):has(.block-title-wrap),
.ls-block .block-content a.page-ref[data-uuid] a.page-ref[data-uuid]:not(.tag):not([data-refinement-date], [data-uuid^="00000001-"]):has(.block-title-wrap):hover { text-decoration: none !important; }
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
  ['pdfCitations', `/* Native PDF citations: the excerpt reads as a quotation, “words” (source, p. n). The citation
   stays Logseq's own link, moved after the words; an area selection keeps its image, citation first. */
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
.prefix-link[data-refinement-pdf="area"] .hl-page::before { content: none !important; display: none !important; }
/* The words sit between quotation marks; the closing one is drawn at the start of Logseq's label, right
   before the citation, in the text's own size and colour. */
.block-title-wrap[data-refinement-pdf-line]::before { content: '“'; }
.prefix-link[data-refinement-pdf="text"] .hl-page::before { content: '”'; display: inline; color: var(--ls-primary-text-color, currentColor); font-size: 1rem; opacity: 1; }
.prefix-link[data-refinement-pdf] {
  display: inline !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: 0 !important;
  cursor: pointer;
  text-decoration: none !important;
}
.prefix-link[data-refinement-pdf="area"] { margin-right: .45em !important; }
.prefix-link[data-refinement-pdf] .hl-page { font-family: inherit; font-size: inherit; color: inherit; text-decoration: none !important; }
.prefix-link[data-refinement-pdf] .hl-page > strong { display: none !important; }
/* The citation itself, small and quiet, a little after the words. */
.prefix-link[data-refinement-pdf] .hl-page::after {
  content: attr(data-refinement-citation); margin-left: .35em;
  color: var(--ls-secondary-text-color, #798087); font-size: var(--rf-small); font-weight: 400; white-space: nowrap; opacity: var(--rf-quiet);
}
.prefix-link[data-refinement-pdf="area"] .hl-page::after { margin-left: 0; }
.prefix-link[data-refinement-pdf]:hover .hl-page::after,
.prefix-link[data-refinement-pdf]:focus-visible .hl-page::after { opacity: 1; }
.prefix-link[data-refinement-pdf]:focus-visible { outline: 1px solid currentColor; outline-offset: 2px; }
.page-reference:has(.prefix-link[data-refinement-pdf]),
a.page-ref:has(.prefix-link[data-refinement-pdf]) { text-decoration: none !important; }

`],
  ['dateStyle', `/* Dates use a quiet inline-code treatment with a neutral tint. */
${dateStyles(['.ls-datetime', '.timestamp', '.ls-block a.page-ref:is([data-refinement-date], [data-uuid^="00000001-"])'])}
.page-reference:has(a.page-ref:is([data-refinement-date], [data-uuid^="00000001-"]))${notInTable} { text-decoration: none !important; }
.ls-block .ls-datetime a.page-ref:is([data-refinement-date], [data-uuid^="00000001-"]),
.ls-block .timestamp a.page-ref:is([data-refinement-date], [data-uuid^="00000001-"]),
.ls-block .ls-datetime a.page-ref:is([data-refinement-date], [data-uuid^="00000001-"]):hover,
.ls-block .timestamp a.page-ref:is([data-refinement-date], [data-uuid^="00000001-"]):hover { background: transparent !important; padding: 0; font-size: inherit; color: inherit !important; }
.ls-datetime::before { content: none !important; }
/* A date is a link to its journal page, never to a block: no dot inside the box. */
:is(.ls-datetime, .timestamp) a.page-ref .block-title-wrap::before, a.page-ref:is([data-refinement-date], [data-uuid^="00000001-"]) .block-title-wrap::before { content: none !important; }
/* The time follows the date after a space, as Logseq spaces them. */
.ls-datetime > * + * { margin-left: .35em; }
/* In a property list the date keeps its box but takes the weight of the values around it. */
.property-value-container :is(.ls-datetime, .timestamp, a.page-ref:is([data-refinement-date], [data-uuid^="00000001-"])) { font-weight: inherit !important; }
/* Inside property capsules at the side or below a block, a date is plain text in the normal text colour. */
:is(html, .dark) .ls-block .positioned-properties :is(.ls-datetime, .timestamp, a.page-ref:is([data-refinement-date], [data-uuid^="00000001-"])),
:is(html, .dark) .ls-block .positioned-properties :is(.ls-datetime, .timestamp, a.page-ref:is([data-refinement-date], [data-uuid^="00000001-"])):hover,
:is(html, .dark) .ls-block .positioned-properties :is(.ls-datetime, .timestamp) :is(a, .page-reference) {
  background: transparent !important; padding: 0 !important; border-radius: 0 !important;
  color: var(--ls-primary-text-color, currentColor) !important; font-size: inherit !important; font-weight: inherit !important; text-decoration: none !important;
}
/* An overdue Scheduled or Deadline date keeps Logseq's yellow warning colour inside its box. */
:is(html, .dark) .ls-block .overdue.overdue :is(.ls-datetime, .timestamp, a.page-ref:is([data-refinement-date], [data-uuid^="00000001-"])),
:is(html, .dark) .ls-block .overdue.overdue :is(.ls-datetime, .timestamp, a.page-ref:is([data-refinement-date], [data-uuid^="00000001-"])):hover,
:is(html, .dark) .ls-block .overdue.overdue :is(.ls-datetime, .timestamp) :is(a, .page-reference) { color: inherit !important; }
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
.ls-block .block-content a.page-ref[data-uuid] a.page-ref[data-uuid]:not(.tag):not([data-refinement-date], [data-uuid^="00000001-"]) {
  text-decoration-line: underline !important;
  text-decoration-style: solid !important;
  text-decoration-color: color-mix(in srgb, currentColor var(--rf-line-pct), transparent) !important;
  text-decoration-thickness: 1px !important;
  text-underline-offset: .2em !important;
}
.ls-block .block-content a.page-ref[data-uuid] a.page-ref[data-uuid]:not(.tag):not([data-refinement-date], [data-uuid^="00000001-"]):hover {
  text-decoration-color: currentColor !important;
}

/* Inside a highlight, links and tags take the highlight's own text color so they stay readable. */
mark .page-reference:not(:has(a.tag)), mark .page-reference:has(a.tag),
mark a.page-ref:not(.tag), mark .page-reference a.page-ref:not(.tag),
.ls-block .block-content mark a.tag, mark a.page-ref:not(.tag):hover { color: inherit !important; }
/* On a highlight, page links use a muted steel blue so they stand apart from the dark highlight text.
   At least 5.2:1 on every light highlight color; the usual faint underline is kept. */
mark a.page-ref:not(.tag):not([data-refinement-date], [data-uuid^="00000001-"]),
mark a.page-ref:not(.tag):not([data-refinement-date], [data-uuid^="00000001-"]):hover,
.ls-block .block-content mark a.page-ref[data-uuid] a.page-ref[data-uuid]:not(.tag):not([data-refinement-date], [data-uuid^="00000001-"]) { color: #2f5d8a !important; }

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
/* Links to tag pages are picked out by the tag pages' own ids (from the database), so Logseq applies
   these rules as it draws each link and nothing is marked. Tags are few, so the list stays short. */
const tagPageCss = sel => `${sel}:not(.tag) > .icon-emoji-wrap { color: var(--rf-tag-color) !important; opacity: 1; }
${sel}:not(.tag):not(:has(> .icon-emoji-wrap, .block-title-wrap)) > span:first-child::before {
  content: '\\2060'; padding-left: 1em; margin-right: 3px; /* 16px and 3px: the size and gap of Logseq's own link icons */
  background: var(--rf-tag-color);
  mask: url("data:image/svg+xml,${hashMask}") 0 calc(50% + 1px) / 1em 1em no-repeat; -webkit-mask: url("data:image/svg+xml,${hashMask}") 0 calc(50% + 1px) / 1em 1em no-repeat;
}
`;
function applyTagPageStyle() {
  const ids = [...provided.tagPages.uuids].filter(uuid => UUID.test(uuid));
  const sel = ids.length ? `a.page-ref:is(${ids.map(uuid => `[data-uuid="${uuid}"]`).join(', ')})` : '';
  sendStyle('personal-db-tag-pages', setting('quietLinks') && sel ? tagPageCss(sel) : '');
}
const mainCss = () => cssParts.filter(([key]) => !key || setting(key)).map(([, text]) => text).join('');

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
// Logseq groups reference rows by parent and shows one grey path for the group, taken from
// whichever row it saw first. A property value's path is the property's name, so that name can
// end up above ordinary blocks. The value carries its own label, so hide such a lone name.
const REFERENCE_AREAS = '.references, .unlinked-references, .references-blocks-wrap';
const referenceAreas = `:is(${REFERENCE_AREAS})`;
const blockLink = '.page-ref[data-refinement-block-link]:not(.tag):not([data-refinement-date], [data-uuid^="00000001-"])';
// Browsers reject a :has() inside another :has(), and one bad selector discards a whole rule, so
// the check on the surrounding reference uses the plain form.
const blockLinkPlain = blockLink + ':not(:has(.prefix-link, img))';
const viaLook = 'margin-left: .6em; color: var(--ls-secondary-text-color, inherit); opacity: var(--rf-quiet); font-size: var(--rf-small); font-weight: 400; white-space: nowrap;';
/* The dot of a labelled link ([words]([[block]])) is drawn at the start of the label's own span, not on
   the link element: Logseq ignores a press whose target is the <a> itself (see the # of a tag-page link). */
const cueCss = `${blockDot(blockLinkPlain + ':not(:has(.block-title-wrap)) > span:first-child')}
/* A block (not a page) shown inside another reference stays without an underline. */
.ls-block .block-content a.page-ref[data-uuid] ${blockLinkPlain}.page-ref, .ls-block .block-content a.page-ref[data-uuid] ${blockLinkPlain}.page-ref:hover { text-decoration: none !important; }
.ls-block ${blockLinkPlain}, .ls-block ${blockLinkPlain}:hover, .ls-block ${blockLinkPlain} * { text-decoration: none !important; border-bottom: 0 !important; }
.ls-block .page-reference:has(${blockLink}):not(:has(.prefix-link, img)), .ls-block .page-reference:has(${blockLink}):not(:has(.prefix-link, img)):hover { text-decoration: none !important; border-bottom: 0 !important; }
/* In references, a property value is introduced by its property's name in muted text. */
${referenceAreas} .ls-block[blockid] > .block-main-container .block-content-wrapper[data-refinement-prop-label]::before { content: attr(data-refinement-prop-label); flex: none; align-self: baseline; margin-right: .4em; color: var(--ls-secondary-text-color, inherit); opacity: var(--rf-quiet); white-space: nowrap; }
/* A record listed under a page's tag tabs shows why it is there. While it is open, its property row says
   so, with the value that points here marked (see hereCss). While it is folded, that row is hidden, so the
   linking property moves up beside the title, in the same form: "Diagnosis: <this page>", the name muted,
   the page marked. A row drawn without a title area always ends with it, unmarked. */
.ls-block[blockid][data-collapsed="true"] > .block-main-container .block-content-wrapper .block-title-wrap[data-refinement-via]::after { content: attr(data-refinement-via); display: inline; ${viaLook} }
.ls-block[blockid][data-collapsed="true"] > .block-main-container .block-content-wrapper [data-refinement-via-value]::after {
  content: attr(data-refinement-via-value); display: inline; margin-left: .3em; font-size: var(--rf-small); font-weight: 400; white-space: nowrap;
  color: var(--ls-primary-text-color, currentColor); background: var(--rf-here); box-shadow: inset 0 -1px 0 var(--rf-here-line); padding: 0 .06em;
}
.ls-block[blockid] > .block-main-container .block-content-wrapper[data-refinement-via]::after { content: attr(data-refinement-via); flex: none; align-self: center; ${viaLook} }`;
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
// Use native controls to expand properties, so Logseq still renders editable values.
const sidebarPresentation = { hidden: new Set(), pending: new WeakMap() };
function updateSidebarPresentation(doc) {
  const sidebar = doc.querySelector('#right-sidebar');
  if (!sidebar) return;
  for (const el of sidebarPresentation.hidden) if (!el.isConnected) sidebarPresentation.hidden.delete(el);
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
  } catch (error) { warnOnce('sidebar presentation is unavailable', error); }
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
  // No dot on an empty block (no text, children, tags, properties or pictures), so it reads as a
  // gap between groups. The dot comes back faintly on hover, and fully while you type in the block.
  quietEmptyBullets: `
.ls-block:not([data-collapsed="true"]):not(:has(> .block-children-container .ls-block)):has(> .block-main-container .block-content .block-title-wrap:empty):not(:has(> .block-main-container :is(.editor-wrapper, .block-content-wrapper :is(img, input, button, video, iframe, a, svg, .ls-properties-area, .block-body), .ls-block-right :is(.block-tags, .positioned-properties *), .block-content-or-editor-wrap > .positioned-properties *))) > .block-main-container .bullet-container { opacity: 0; transition: opacity .15s; }
.ls-block:not([data-collapsed="true"]):not(:has(> .block-children-container .ls-block)):has(> .block-main-container .block-content .block-title-wrap:empty):not(:has(> .block-main-container :is(.editor-wrapper, .block-content-wrapper :is(img, input, button, video, iframe, a, svg, .ls-properties-area, .block-body), .ls-block-right :is(.block-tags, .positioned-properties *), .block-content-or-editor-wrap > .positioned-properties *))) > .block-main-container:hover .bullet-container { opacity: .35; }`,
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
  const changed = sentStyles.get(key) !== style;
  perf.style(key, style, changed);
  if (!changed) return;
  sentStyles.set(key, style);
  logseq.provideStyle({ key, style: orNoRules(style) });
}
function applyHierarchy() {
  sendStyle('personal-db-hierarchy', Object.keys(hierarchyParts).filter(setting).map(key => hierarchyParts[key]).join('\n'));
}

const settingsSchema = [
  { key: 'shortcutsHeading', type: 'heading', title: 'Shortcuts and actions', default: null,
    description: 'Every action is also in the command palette, under the names below. Changes to shortcuts apply after you reload the plugin. Leave a shortcut empty to remove it. Examples: mod+shift+l, mod+alt+p (mod is Cmd on Mac, Ctrl elsewhere).' },
  { key: 'linkShortcut', type: 'string', title: 'Link selected text to a page', default: 'mod+shift+l',
    description: 'Select words in a block, press this, then type the page title. The words become [words]([[page title]]).' },
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
  { key: 'markReferenceHere', type: 'boolean', title: 'Mark the link to this page in Linked references', default: true,
    description: 'Under Linked references, the link that points to the page you are on is marked with a faint grey wash and a fine line beneath. Applies right away.' },
  { key: 'showInherited', type: 'boolean', title: 'Show inherited properties on tag pages', default: true,
    description: 'Under the title of a tag that extends another tag, shows a small muted line such as “Inherited from #Media: keywords, rating, website”, one line per parent tag. Click a name to open it. Applies right away.' },
  { key: 'ownTagHidden', type: 'boolean', title: 'Leave a tag page’s own tag off its rows', default: true,
    description: 'On a tag’s page (such as #Task), the rows of its table, the records under it and its Linked references all carry that same tag. It is left off there, so only other tags show. Applies right away.' },
  { key: 'compactJournals', type: 'boolean', title: 'Journal days only as tall as what they hold', default: true,
    description: 'On the Journals list, Logseq gives every day at least a screen’s worth of height, so an empty day is a long gap. Each day is now as tall as its blocks. Applies right away.' },
  { key: 'hierarchyHeading', type: 'heading', title: 'Visual hierarchy', default: null,
    description: 'Quiet cues for the shape of the outline. Changes here apply right away.' },
  { key: 'indentGuides', type: 'boolean', title: 'Faint nesting lines', default: true,
    description: 'Makes the lines beside nested blocks fainter, and the line beside the branch you point at or type in a little stronger.' },
  { key: 'plainProperties', type: 'boolean', title: 'Plainer properties', default: true,
    description: 'The page’s own properties under its title sit on the same light grey field as a property list under a block, with one dot per property (the value’s own bullet is gone) and “Add property” shown only while you point at them. Shows a block’s properties as “name: value” text, separated by dots, instead of outlined capsules; when a row is too long to fit, a small triangle at its start opens it. Property names are grey so the values stand out. A property list under a block sits on a very light grey field, and the tag tabs below a page’s properties start with #.' },
  { key: 'hiddenPropsChevron', type: 'boolean', title: 'Hidden properties arrow on every block', default: true,
    description: 'While you point at a block, a small arrow right after the block’s own text opens the properties it hides, like the fold arrow beside a block: right while folded, down while open (Logseq shows its “Show hidden properties” button only on a block you have zoomed into). Logseq’s own button becomes the same arrow.' },
  { key: 'quietEmptyBullets', type: 'boolean', title: 'Hide the dot on empty blocks', default: true,
    description: 'A block with no text, nothing nested under it, no tags, properties or pictures shows no dot, so empty blocks work as space between groups. Pointing at the block shows the dot faintly, and it is back in full while you type in the block.' },
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
    description: 'Page links in normal text colour with a faint underline instead of bright blue; page names heading Linked references read as headings; links inside highlights stay readable.' },
  { key: 'referenceLayout', type: 'boolean', title: 'Clearer Linked references', default: true,
    description: 'Under Linked references: a wider gap between source pages, a journal’s date as a plain heading like any other page, the number of references after a heading that holds more than one, a bullet before the grey path that names a reference’s parent block, with the reference stepped in below it, the blocks below a reference stepping back unless they link here too, and Logseq’s fold arrows kept faintly visible. Applies right away.' },
  { key: 'referenceIcons', type: 'boolean', title: 'Icons for block references and files', default: true,
    description: 'A small dot before links to blocks, with no underline (pages keep their solid underline), and grey document or image icons before links to PDFs and pictures, with the file type after them.' },
  { key: 'linkLabels', type: 'boolean', title: 'Show how records are linked', default: true,
    description: 'In Linked references, puts the property name before a value (“Doctor: …”). Under a page’s tag tabs, the value that points to the page on screen gets the same faint grey “points here” mark as in Linked references, and a folded record shows that property beside its title (“Diagnosis: page”).' },
  { key: 'tidyPaths', type: 'boolean', title: 'Tidy parent paths', default: true,
    description: 'The grey path above a result or reference uses the width it has before cutting text short, and its [[ ]] brackets fade.' },
  { key: 'plainPathLinks', type: 'boolean', title: 'Plain links in grey paths', default: true,
    description: 'In the grey path above a reference or query result, a link shows as its words with a faint underline instead of [[ ]], and a labelled link [words]([[page]]) shows just its words.' },
  { key: 'quietLinkMenu', type: 'boolean', title: 'Empty [[ ]] menu until you type', default: true,
    description: 'Typing [[ no longer opens a list of date words (Today, Tomorrow, Next week …) straight away; the page menu appears with the first letter you type.' },
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
const quietUi = { marked: new Set() };
const quietItemNames = () => new Set(setting('quietItems').split(',').map(name => name.trim().toLowerCase()).filter(Boolean));
// Logseq's built-in sidebar items and the search button carry fixed names of their own
// (frontend/components/left_sidebar.cljs and header.cljs), whatever language Logseq is shown in.
// Those are quietened by plain rules on those names; other items are still found by their words.
const QUIET_BUILT_IN = {
  'journals': '#left-sidebar .journals-nav > a.item',
  'flashcards': '#left-sidebar .flashcards-nav > a.item',
  'graph view': '#left-sidebar .graph-view-nav > a.item',
  'all pages': '#left-sidebar .all-pages-nav > a.item',
  'search': '#head button#search-button',
};
function applyQuietItemsStyle() {
  const sels = [...quietItemNames()].map(name => QUIET_BUILT_IN[name]).filter(Boolean);
  sendStyle('personal-db-quiet-items', sels.length ? `:is(${sels.join(', ')}) { font-size: var(--rf-small) !important; color: var(--ls-secondary-text-color) !important; opacity: var(--rf-quiet) !important; }
:is(${sels.join(', ')}) :is(svg, .ui__icon) { transform: scale(.85); }` : '');
}
function updateQuietUi(doc) {
  for (const el of quietUi.marked) if (!el.isConnected) quietUi.marked.delete(el);
  const names = new Set([...quietItemNames()].filter(name => !QUIET_BUILT_IN[name]));
  const clean = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const mark = el => { if (!el.hasAttribute('data-refinement-quiet')) { el.setAttribute('data-refinement-quiet', ''); quietUi.marked.add(el); } };
  // Named sidebar/toolbar items: the item's aria-label or title, its whole text, or the text of one of
  // its own parts (a sidebar item holds its name, a keyboard shortcut and a count as separate parts).
  if (names.size) {
    for (const root of doc.querySelectorAll('#left-sidebar, #head')) {
      for (const el of root.querySelectorAll('a, button, [role="button"]')) {
        if (el.parentElement?.closest('[data-refinement-quiet]')) continue;
        const labels = [el.getAttribute('aria-label'), el.getAttribute('title'), clean(el), ...[...el.children].map(clean)];
        if (labels.some(label => label && names.has(label.toLowerCase()))) mark(el);
      }
    }
  }
}
function startQuietUi() {
  try {
    applyQuietItemsStyle();
    // Only items named by their words need the screen watched.
    if ([...quietItemNames()].some(name => !QUIET_BUILT_IN[name])) watchDom(updateQuietUi);
    onUnload(() => {
      for (const el of quietUi.marked) el.removeAttribute('data-refinement-quiet');
      quietUi.marked.clear();
    });
  } catch (error) { warnOnce('quiet items are unavailable', error); }
}

/* Typing [[ opens Logseq's page menu at once, filled with date words (Today, Tomorrow, Next week ...)
   before anything is typed. While nothing follows the [[ the menu stays hidden, and the keys that would
   pick from it (arrows, Enter, Tab) do nothing; the first letter typed brings it back as usual. */
const quietLinkMenu = { menu: null };
function linkMenuIsEmpty(doc) {
  const box = doc.activeElement;
  if (!box || box.tagName !== 'TEXTAREA' || box.selectionStart !== box.selectionEnd) return false;
  return box.value.slice(Math.max(0, box.selectionStart - 2), box.selectionStart) === '[[';
}
function updateQuietLinkMenu(doc) {
  const menu = setting('quietLinkMenu') ? doc.getElementById('ui__ac') : null;
  const quiet = !!menu && !menu.classList.contains('ac-block-search') && linkMenuIsEmpty(doc);
  if (quietLinkMenu.menu && (quietLinkMenu.menu !== menu || !quiet)) quietLinkMenu.menu.removeAttribute('data-refinement-quiet-menu');
  quietLinkMenu.menu = quiet ? menu : null;
  if (quiet && !menu.hasAttribute('data-refinement-quiet-menu')) menu.setAttribute('data-refinement-quiet-menu', '');
}
function startQuietLinkMenu() {
  try {
    const doc = ensureDomWatch(), win = doc.defaultView;
    watchDomEarly(function updateQuietLinkMenuEarly(d) { updateQuietLinkMenu(d); });
    listen(win, ['input', 'keyup'], () => updateQuietLinkMenu(doc));
    listen(win, ['keydown'], event => {
      if (!quietLinkMenu.menu?.isConnected || !['ArrowUp', 'ArrowDown', 'Enter', 'Tab'].includes(event.key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    });
    logseq.provideStyle({ key: 'personal-db-quiet-link-menu', style: `
#ui__ac[data-refinement-quiet-menu],
[data-radix-popper-content-wrapper]:has(#ui__ac[data-refinement-quiet-menu]),
.ui__popover-content:has(#ui__ac[data-refinement-quiet-menu]) { visibility: hidden !important; }` });
    onUnload(() => { quietLinkMenu.menu?.removeAttribute('data-refinement-quiet-menu'); quietLinkMenu.menu = null; });
  } catch (error) { warnOnce('the quiet [[ menu is unavailable', error); }
}

/* After the database changes, everything the plugin knows from it is looked up again in one round:
   as soon as the changes pause, or every few seconds while they keep coming (typing). Seven
   separate timers used to do this, finishing at three different moments after each edit. */
const dbWork = { timer: 0, since: 0, slowTimer: 0, slowAt: 0 };
// Lists that cover the whole graph (every linked block, every property value,
// page titles, journals, property names) change rarely; while you edit, they are read again at most
// this often, plus once more after you stop. Looking at a new page reads them fresh.
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
  // The page's cues and details are part of this round; a look-up still waiting from a page change is not needed too.
  provided.cancelRefresh();
  clearTimeout(provided.pageKind.timer);
  const failed = error => warnOnce('a look-up after a change failed', error);
  const run = jobs => { for (const job of jobs) { try { Promise.resolve(job()).catch(failed); } catch (error) { failed(error); } } };
  // About the page on screen: after every round.
  const pageJobs = [dbJobs.refreshCues, dbJobs.loadPageKind, dbJobs.refreshInlineValues, dbJobs.refreshCrumbLinks, dbJobs.loadHiddenProps];
  // Whole-graph lists: now if they are due; otherwise one full round when they fall due.
  const fullRound = () => {
    clearTimeout(dbWork.slowTimer);
    dbWork.slowTimer = 0;
    dbWork.slowAt = Date.now();
    graphCache.clear();
    run([dbJobs.loadPageLabelTitles, dbJobs.refreshJournalDates, dbJobs.loadPropertyNames, ...pageJobs]);
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
   so the order of the parts does not matter. Database look-ups register with core.onDbRound(name, fn);
   runDbWork runs them in its own fixed order (one database round, GUIDE.md). */
const provided = {}; // what the area parts give the core and each other, by name
const dbJobs = {};   // database-round jobs by name (core.onDbRound)
function publishCore() {
  window.refinementCore = {
    host, setting, notify, graphWide, scheduleDbWork, sendStyle, orNoRules, tokensCss, watchDom, watchDomEarly, addsElements, ensureDomWatch,
    STRAY_ELEMENTS, STRAY_ATTRIBUTES, RELOAD_SETTINGS, CUE_SETTINGS, UUID, isEntityId, idsIn, uuidsIn, dsQuery, storedRef, titleOf, trailingTags, cleanTitle,
    CHECKED_WITH, PAGE_TITLE, REFERENCE_AREAS, referenceAreas,
    // Still here until the styles area moves to a part of its own; the parts that need them take them from the core meanwhile.
    wash, applyTagPageStyle, blockLink, blockLinkPlain, viaLook,
    onFoldAll: fn => provided.onFoldAll(fn),
    provided, provide: things => Object.assign(provided, things), onDbRound: (name, fn) => { dbJobs[name] = fn; },
  };
}
// The troubleshooting tools live in parts/diagnostics.js; the palette entries below call them by name.
const diag = name => (...args) => window.refinementDiagnostics?.[name]?.(...args);
// A command of an area part (parts/editor.js, properties.js), by the name it provided to the core.
const act = name => (...args) => provided[name](...args);
function main() {
  logseq.beforeunload(runUnloadTasks);
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
  sendStyle('personal-db-refinements', mainCss());
  applyHierarchy();
  provided.startDateLinks();
  provided.startPdfCitations();
  if (setting('tidySidebar')) startSidebarPresentation();
  startQuietUi();
  startQuietLinkMenu();
  provided.startDateLinkSwap();
  if (setting('showTitleChrome')) provided.startTitleChrome();
  provided.startPageKind();
  provided.startListProps();
  provided.startHiddenProps();
  startSelfCheck();
  provided.startNestedReferenceLinks();
  logseq.provideStyle({ key: 'personal-db-context-cues', style: cueCss });
  provided.scheduleRefresh();
  onUnload(provided.stopRefresh);

  // Every hook returns an "off" function; each is called when the plugin unloads.
  // A fold-all choice lasts while its page is open.
  onUnload(logseq.App.onRouteChanged(() => {
    provided.stopFoldState();
    // What is known about the page just left must not be applied to the one arriving: its list
    // choice would hide parts of the new page until the new page's own details have loaded.
    provided.pdfCitations.pageUuid = null;
    provided.listProps.pageBlocks = new Set();
    provided.cueMarks.incoming = new Map();
    graphCache.clear(); // a new page (or a new graph) reads the whole-graph lists fresh
    provided.referenceHere.names.clear(); // and looks up the page's aliases again
    provided.scheduleRefresh(); provided.schedulePageKind();
    provided.loadHiddenProps(); // another graph has other blocks
  }));
  // Edits fire this constantly while typing, so each part waits for a pause before re-querying.
  onUnload(logseq.DB.onChanged(({ blocks } = {}) => {
    perf.add('DB.onChanged (calls only)', 0);
    if (provided.foldLog.start) provided.logFold(`database changed (${blocks?.length ?? '?'} block${blocks?.length === 1 ? '' : 's'})`);
    scheduleDbWork();
  }));
  onUnload(() => { clearTimeout(dbWork.timer); clearTimeout(dbWork.slowTimer); });
  provided.startEditor(); // the editor keys and the last text selection (parts/editor.js)
  onUnload(logseq.onSettingsChanged((now, before) => {
    if (perf.ownSettingsOnly(now, before)) return;
    try { provided.updateListProps(host()); } catch (error) { /* list choices apply on the next change */ }
    applyHierarchy();
    sendStyle('personal-db-refinements', mainCss());
    applyTagPageStyle();
    if (CUE_SETTINGS.some(key => now?.[key] !== before?.[key])) provided.scheduleRefresh(0);
    if (now?.pdfCitations !== before?.pdfCitations) provided.updatePdfCitations();
    try { provided.updatePageKind(host()); provided.updateOwnTags(host()); } catch (error) { /* shown on the next change */ }
    if (now?.hiddenPropsChevron !== before?.hiddenPropsChevron) {
      sendStyle('personal-db-hidden-props', setting('hiddenPropsChevron') ? provided.hiddenPropsCss : '');
      try { provided.updateHiddenProps(host()); } catch (error) { /* shown on the next change */ }
      provided.loadHiddenProps();
    }
    provided.updateDateLinks();
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
    const binding = shortcut && setting(shortcut).trim().toLowerCase();
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
const PART_FILES = ['parts/shared.js', 'parts/diagnostics.js', 'parts/editor.js', 'parts/pages.js', 'parts/properties.js', 'parts/links.js', 'parts/sidebar.js', 'parts/search.js', 'parts/journal-dates.js', 'parts/rich-copy.js', 'parts/todos.js', 'parts/tags.js', 'parts/settings-panel.js'];
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



























