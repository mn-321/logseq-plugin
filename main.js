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
  const ids = [...tagPages.uuids].filter(uuid => UUID.test(uuid));
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
    warnOnce('using block-tree type detection', error);
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
    warnOnce('could not load journal date identities', error);
    return undefined;
  }
}

/* Date labels are classified synchronously during DOM updates, before paint.
   Global journal styles stay installed across navigation. */
const journalUuid = uuid => typeof uuid === 'string' && uuid.startsWith('00000001-');
const dateLinks = { document: null, originals: new Map(), version: 0, uuids: new Set(), names: new Set() };
const dateMonth = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const datePattern = new RegExp('^(?:' + dateMonth + ' \\d{1,2},? \\d{4}|\\d{1,2} ' + dateMonth + ',? \\d{4}|\\d{4}-\\d{2}-\\d{2})$', 'i');
function dateLinkName(name) {
  const value = String(name || '').trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  return datePattern.test(value) && Number.isFinite(Date.parse(value));
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
  } catch (error) { warnOnce('could not resolve stored page titles', error); }
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
  if (!setting('pageLabels')) {
    for (const [node, record] of pageLabelOriginals) if (node.nodeValue === record.cleaned) node.nodeValue = record.original;
    pageLabelOriginals.clear();
    return;
  }
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
   - a record listed under a page's tag tabs shows the property that links it ("Diagnosis: <this page>") while folded. */
const cueMarks = { blockUuids: new Set(), incoming: new Map(), marked: new Map() };
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
        const label = [...names].join(', ') + ':', page = cueMarks.incoming.pageTitle || '';
        // The record's own title, not a title drawn inside one of its property values.
        const title = wrapper.querySelector('.block-head-wrap .block-title-wrap') || wrapper.querySelector('.block-title-wrap');
        if (title) {
          found.set(title, ['data-refinement-via', label]);
          if (page && title.parentElement && title.parentElement !== wrapper) found.set(title.parentElement, ['data-refinement-via-value', page]);
        } else found.set(wrapper, ['data-refinement-via', page ? `${label} ${page}` : label]);
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
/* Grey parent paths are drawn from a block's raw text, so links keep their [[ ]] and a labelled link
   ([words]([[page]])) comes out half-cut ("[words"). The text is taken from the database instead, links
   become their plain words, and those words get the faint page-link underline (a highlight, so nothing
   is added to Logseq's own elements). A part is only changed when its words match what Logseq drew. */
const crumbLinks = { originals: new Map(), ancestors: new Map(), loading: new Set(), generation: 0 };
const crumbSquash = text => String(text || '').replace(/[\s\[\]()*_~=^`…]+/g, '');
// Plain words of a stored title, with where each link sits in them.
function crumbWords(raw) {
  let text = '';
  const links = [];
  const source = String(raw || '').replace(/^#{1,6}\s+/, '');
  const token = /#\[\[([^\]]+)\]\]|\[([^\]\[]+)\]\((\[\[[^\]]+\]\]|\(\([^)]+\)\)|[^)\s]+)\)|\[\[([^\]]+)\]\]/g;
  let last = 0;
  for (const m of source.matchAll(token)) {
    text += source.slice(last, m.index);
    if (m[1] !== undefined) text += '#' + m[1]; // a tag keeps its #, as tags do elsewhere
    else {
      const words = m[2] ?? m[4];
      links.push([text.length, text.length + words.length]);
      text += words;
    }
    last = m.index + m[0].length;
  }
  return { text: text + source.slice(last), links };
}
// Titles of a block's parents, nearest first, each as crumbWords gives them.
async function loadCrumbAncestors(uuid, generation) {
  const titles = [];
  try {
    let block = await logseq.Editor.getBlock(uuid);
    for (let i = 0; block && i < 30; i++) {
      const parentId = block.parent?.id, pageId = block.page?.id;
      if (!parentId || parentId === pageId) break;
      block = await logseq.Editor.getBlock(parentId);
      if (!block || block.name) break;
      titles.push(crumbWords(await provided.readableTitle(titleOf(block))));
    }
  } catch (error) { warnOnce('could not read parent paths', error); }
  crumbLinks.loading.delete(uuid);
  if (generation !== crumbLinks.generation) return;
  if (crumbLinks.ancestors.size > 500) crumbLinks.ancestors.clear();
  crumbLinks.ancestors.set(uuid, titles);
  if (dateLinks.document) updateCrumbLinks(dateLinks.document);
}
// After a change in the graph, parent titles are read again as their paths are next drawn.
function refreshCrumbLinks() {
  ++crumbLinks.generation;
  crumbLinks.ancestors.clear();
  crumbLinks.loading.clear();
  if (dateLinks.document) updateCrumbLinks(dateLinks.document);
}
function restoreCrumbLinks(doc) {
  for (const [node, record] of crumbLinks.originals) if (node.nodeValue === record.shown) node.nodeValue = record.original;
  crumbLinks.originals.clear();
  try { doc?.defaultView?.CSS?.highlights?.delete('refinement-crumb-link'); } catch {}
}
function updateCrumbLinks(doc) {
  if (!setting('plainPathLinks')) { if (crumbLinks.originals.size) restoreCrumbLinks(doc); return; }
  for (const [node] of crumbLinks.originals) if (!node.isConnected) crumbLinks.originals.delete(node);
  for (const crumb of doc.querySelectorAll('.breadcrumb.block-parents')) {
    // In a query result the path sits inside the row it belongs to; in references, above the group of rows.
    // In the right sidebar an item's title is the path of the block it shows; the block is its content.
    const item = crumb.closest('#right-sidebar .sidebar-item');
    const row = item ? item.querySelector('.ls-block[blockid]')
      : crumb.parentElement?.closest('.ls-block[blockid]') === crumb.parentElement ? crumb.parentElement
      : crumb.parentElement?.parentElement?.querySelector('.ls-block[blockid]');
    const uuid = row?.getAttribute('blockid');
    if (!uuid) continue;
    const labels = [...crumb.querySelectorAll('.breadcrumb__label')];
    const ancestors = crumbLinks.ancestors.get(uuid);
    if (!ancestors) {
      if (!crumbLinks.loading.has(uuid) && labels.some(label => /[\[\]]/.test(label.textContent))) {
        crumbLinks.loading.add(uuid);
        loadCrumbAncestors(uuid, crumbLinks.generation);
      }
      continue;
    }
    labels.forEach((label, index) => {
      const node = label.firstChild;
      if (!node || node.nodeType !== 3 || node !== label.lastChild) return;
      const record = crumbLinks.originals.get(node);
      if (record && node.nodeValue === record.shown) return;
      const words = ancestors[labels.length - 1 - index];
      const value = node.nodeValue;
      if (!words || !words.links.length || !crumbSquash(words.text).startsWith(crumbSquash(value)) || !crumbSquash(value)) return;
      crumbLinks.originals.set(node, { original: value, shown: words.text, links: words.links });
      node.nodeValue = words.text;
    });
  }
  const win = doc.defaultView;
  if (!win.CSS?.highlights || !win.Highlight) return;
  const ranges = [];
  for (const [node, record] of crumbLinks.originals) {
    for (const [start, end] of record.links) {
      if (end > node.nodeValue.length) continue;
      const range = doc.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      ranges.push(range);
    }
  }
  win.CSS.highlights.set('refinement-crumb-link', new win.Highlight(...ranges));
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
const refCountSeen = new Map();
function updateReferenceCounts(doc) {
  const found = new Map();
  // Not tied to .group-list-view: a journal's Linked references are drawn without that wrapper.
  if (setting('referenceLayout')) for (const title of doc.querySelectorAll('#main-content-container .references .ls-view-body .ls-foldable-title')) {
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
    if (!header) continue;
    // A folded source page draws no references, so its last counted number is kept (per page on screen).
    const key = pageKind.pageUuid + '|' + header.textContent.trim();
    if (count) { if (refCountSeen.size > 500) refCountSeen.clear(); refCountSeen.set(key, count); }
    const shown = count || refCountSeen.get(key) || 0;
    if (shown > 1) found.set(header, String(shown));
  }
  for (const el of refCounts) if (!found.has(el)) { el.removeAttribute('data-refinement-ref-count'); refCounts.delete(el); }
  for (const [el, count] of found) { if (el.getAttribute('data-refinement-ref-count') !== count) el.setAttribute('data-refinement-ref-count', count); refCounts.add(el); }
}
// On a tag's own page, the tag on each of its rows (records, Linked references, the cells of its table)
// says what the title already says, so those tags are marked and hidden. The page is known from its
// uuid (loadPageKind) once the title on screen is that page's.
const ownTags = new Set();
function updateOwnTags(doc) {
  const found = new Set();
  const uuid = pageKind.isTag && UUID.test(pageKind.pageUuid) ? pageKind.pageUuid : '';
  if (setting('ownTagHidden') && uuid && doc.querySelector(`#main-content-container :is(.ls-page-title, .page-title) .ls-block[blockid="${uuid}"]`)) {
    for (const tag of doc.querySelectorAll(`#main-content-container a.tag[data-uuid="${uuid}"]`)) {
      if (tag.closest('.is-page-title-row, .ls-page-title, .page-title, .editor-wrapper')) continue;
      const item = tag.closest('.block-tag, .select-item') || tag;
      found.add(item);
      // When the row's tag list held only this tag, the whole list goes, so no empty line is left behind.
      const list = item.parentElement;
      if (list?.classList.contains('block-tags') && [...list.children].every(child => child.querySelector(`a.tag[data-uuid="${uuid}"]`))) found.add(list);
    }
  }
  for (const el of ownTags) if (!found.has(el)) { el.removeAttribute('data-refinement-own-tag'); ownTags.delete(el); }
  for (const el of found) { if (!el.hasAttribute('data-refinement-own-tag')) el.setAttribute('data-refinement-own-tag', ''); ownTags.add(el); }
}
// Journal days in the left sidebar's lists are marked, so they can be drawn in grey.
const sidebarJournals = new Set();
function updateSidebarJournals(doc) {
  const found = new Set();
  if (setting('quietSidebarIcons')) for (const item of doc.querySelectorAll('#left-sidebar a.link-item')) {
    const title = item.querySelector('.page-title');
    if (title && isJournalDate(title.textContent)) found.add(item);
  }
  for (const el of sidebarJournals) if (!found.has(el)) { el.removeAttribute('data-refinement-journal'); sidebarJournals.delete(el); }
  for (const el of found) { if (!el.hasAttribute('data-refinement-journal')) el.setAttribute('data-refinement-journal', ''); sidebarJournals.add(el); }
}
function updateDateLinks() {
  const doc = dateLinks.document;
  if (!doc) return;
  for (const part of [updateReferenceRows, updateChildAssetCues, updatePropertyCrumbs, updateCrumbLinks, fadeCrumbBrackets, updateReferenceHere,
    updatePageLabels, updateDateHeadings, updateReferenceCounts, updateCueMarks, updateOwnTags, updateSidebarJournals]) perf.time(part.name, () => part(doc));
  for (const [link] of dateLinks.originals) if (!link.isConnected) dateLinks.originals.delete(link);
  for (const link of doc.querySelectorAll('a.page-ref[data-ref], a.page-ref[data-uuid]')) {
    // A link to a journal day needs no mark: Logseq gives every journal page an id that starts with
    // 00000001- (logseq.common.uuid), and the rules match that id directly as the link is drawn.
    if (!journalUuid(link.getAttribute('data-uuid')) && (dateLinkName(link.getAttribute('data-ref')) || dateLinks.uuids.has(link.getAttribute('data-uuid')) ||
        dateLinks.names.has(String(link.getAttribute('data-ref') || '').toLowerCase()))) {
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
// The uuids of every tag page, or null when the look-up failed (the known set is then kept).
async function loadTagPages() {
  try {
    const rows = await dsQuery(`[:find ?uuid
      :where [?tag :block/tags ?class] [?class :db/ident :logseq.class/Tag] [?tag :block/uuid ?uuid]]`);
    return new Set(rows.map(([uuid]) => String(uuid)).filter(uuid => UUID.test(uuid)));
  } catch (error) { warnOnce('could not find tag pages', error); return null; }
}
async function refreshJournalDates() {
  const version = ++dateLinks.version;
  const [dates, tags] = await Promise.all([loadJournalDates(), loadTagPages()]);
  if (version !== dateLinks.version) return;
  if (tags) { tagPages.uuids = tags; applyTagPageStyle(); }
  if (!dates) return;
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
  } catch (error) { warnOnce('immediate date styling is unavailable', error); }
  refreshJournalDates();
  loadPageLabelTitles();
}
function stopDateLinks() {
  ++crumbLinks.generation;
  restoreCrumbLinks(dateLinks.document);
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
  for (const el of referenceHere.links) el.removeAttribute('data-refinement-here');
  referenceHere.links.clear();
  for (const el of referenceHere.below) el.removeAttribute('data-refinement-below');
  referenceHere.below.clear();
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
    warnOnce('could not resolve PDF citation titles', error);
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
      // Area selections keep their image in place, citation first; a text selection's citation follows the
      // words, before any cue the plugin adds after the block's text.
      if (area) {
        if (label !== prefix.firstChild) prefix.insertBefore(label, prefix.firstChild);
      } else {
        const cue = [...wrap.children].find(el => el.classList.contains('refinement-child-assets')) || null;
        if (prefix.nextSibling !== cue) wrap.insertBefore(prefix, cue);
      }
      const source = pdfCitations.sources.get(pdfCitationIdentity(prefix));
      const page = pageMatch[1] === '?' ? source?.page ?? '?' : pageMatch[1];
      const fullTitle = source?.title || 'PDF highlight';
      const shortTitle = fullTitle.replace(/\.pdf$/i, '');
      const compactTitle = shortTitle.length > 38 ? shortTitle.slice(0, 35).trimEnd() + '…' : shortTitle;
      const suffix = `p. ${page}`;
      const citation = source && !pdfSourceContext(prefix, source.sourceUuid) ? `(${compactTitle}, ${suffix})` : `(${suffix})`;
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
    warnOnce('PDF citation presentation is unavailable', error);
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
  } catch (error) { warnOnce('could not identify child asset types', error); }
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
    warnOnce('could not identify linked nodes', error);
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
    warnOnce('could not identify property values', error);
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
    result.pageTitle = String(page.title || page.originalName || page.name || '');
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
  } catch (error) { warnOnce('could not find records linking to this page', error); }
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
    const [metadata, pdfSources, nodeIds, assetTypes, propertyValues, incoming] = await Promise.all([descendantMetadata(tree), pdfAnnotationSources(tree), graphWide('referenced', referencedNodeIds), directAssetTypes(tree), graphWide('propertyValues', propertyValueBlocks), incomingPropertyLinks()]);
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
    warnOnce('could not refresh current-page cues', error);
  }
}
function scheduleRefresh(delay = 300) {
  clearTimeout(refreshTimer);
  const version = ++refreshVersion;
  refreshTimer = setTimeout(() => refreshCues(version), delay);
}

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
      if (!setting('innerReferenceLinks') || !nestedReferenceLink(event)) return;
      event.stopPropagation();
      if (event.type !== 'pointerup' && event.type !== 'mouseup') event.preventDefault();
    });
    listen(win, ['click'], event => {
      const link = setting('innerReferenceLinks') && nestedReferenceLink(event);
      if (!link) return;
      event.stopPropagation();
      event.preventDefault();
      openEntity(link.getAttribute('data-uuid'), event.shiftKey);
    });
  } catch (error) { warnOnce('links inside references stay native', error); }
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
` });
    watchDom(updateTitleChrome);
    titleChrome.started = true;
    onUnload(() => {
      for (const el of titleChrome.marked) el.removeAttribute('data-refinement-always-shown');
      titleChrome.marked.clear();
    });
  } catch (error) { warnOnce('page title actions stay native', error); }
}
/* Page type: a small muted word under the title of tag pages ("Tag") and property pages
   ("Property"). Ordinary and journal pages get nothing. The word is drawn by CSS from an
   attribute on the title, so nothing is inserted into Logseq's own page structure. */
const pageKind = { timer: 0, aliasOf: [], aliasLine: null, inheritedBy: new Map(), inheritedAsked: new Set(), inheritLine: null, pageUuid: '', plain: false, isTag: false, titleTags: null, tagged: new Set(), offsets: new WeakMap() };
async function loadPageKind() {
  // Lookups can overlap (a page change, then an edit); only the newest one's answer is used.
  const version = pageKind.version = (pageKind.version || 0) + 1;
  let isTag = false, pageId = 0, aliasOf = [], inherited = [], plain = false, pageUuid = '';
  try {
    const page = await logseq.Editor.getCurrentPage?.();
    pageId = page?.id;
    pageUuid = String(page?.uuid || '');
    if (isEntityId(pageId) && logseq.DB?.datascriptQuery) {
      const rows = await logseq.DB.datascriptQuery(`[:find ?ident
        :where [(identity ${pageId}) ?p] [?p :block/tags ?c] [?c :db/ident ?ident]]`);
      const idents = new Set((rows || []).map(row => String(row[0]).replace(/^:/, '')));
      isTag = idents.has('logseq.class/Tag');
      plain = idents.size === 1 && idents.has('logseq.class/Page'); // an ordinary page with no tag of its own
      // Logseq records an alias only on the original page; look it up from the alias's side.
      const originals = await logseq.DB.datascriptQuery(`[:find ?uuid ?title
        :where [(identity ${pageId}) ?p] [?o :block/alias ?p] [?o :block/uuid ?uuid] [?o :block/title ?title]]`);
      aliasOf = (originals || []).filter(row => UUID.test(String(row[0]))).map(row => [String(row[0]), String(row[1])])
        .sort((a, b) => a[1].localeCompare(b[1]));
      if (isTag) inherited = await inheritedTagProperties(pageId);
    }
  } catch (error) { warnOnce('could not tell the page type', error); }
  if (version !== pageKind.version) return;
  pageKind.aliasOf = aliasOf;
  if (pageUuid) pageKind.inheritedBy.set(pageUuid, inherited);
  pageKind.plain = plain;
  pageKind.isTag = isTag;
  pageKind.pageUuid = pageUuid;
  try { updatePageKind(host()); updateOwnTags(host()); } catch (error) { /* shown on the next change */ }
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
}
// Under "Linked references" a block is listed because it links to the page on screen, but it may
// hold other links too. The link that points here gets a clear wash, stronger than the box behind a
// date, so it can be found at once; the blocks below a reference that do not hold that link step back.
// Both are marks on the elements, set as Logseq draws them (one page on screen, or each day's own
// references on the Journals list), and drawn by fixed rules in cssParts.
const referenceHere = { links: new Set(), below: new Set(), names: new Map() };
// A page and its aliases are one page to Logseq: Linked references also list links written with an
// alias. The uuids that count as the page on screen (itself, its aliases, the page it is an alias of
// and that page's other aliases) are looked up once per page shown and kept until the route changes.
function samePageUuids(uuid) {
  const known = referenceHere.names.get(uuid);
  if (known) return known;
  const names = new Set([uuid]);
  referenceHere.names.set(uuid, names);
  (async () => {
    const id = (await logseq.Editor.getPage?.(uuid))?.id;
    if (!isEntityId(id) || !logseq.DB?.datascriptQuery) return;
    const rows = await logseq.DB.datascriptQuery(`[:find ?u
      :where [(identity ${id}) ?p]
      (or-join [?p ?a] [?p :block/alias ?a] [?a :block/alias ?p] (and [?o :block/alias ?p] [?o :block/alias ?a]))
      [?a :block/uuid ?u]]`);
    let added = false;
    for (const row of rows || []) { const other = String(row[0]); if (UUID.test(other) && !names.has(other)) { names.add(other); added = true; } }
    if (added && referenceHere.names.get(uuid) === names && dateLinks.document) updateReferenceHere(dateLinks.document);
  })().catch(error => warnOnce('aliases are not marked in Linked references', error));
  return names;
}
// The look of a link that points here (a faint grey wash over a hairline, square, close to the letters, in the text's own
// weight; a date's grey box gives way to it). The link is named by the ids it points to, so Logseq applies
// these rules as it draws Linked references and no link is marked. Logseq cuts each property to a pill
// shape, which would round off the wash on the last value, so that pill's corners are made square.
const hereCss = (scope, targets) => `${scope} :is(.references, .ls-bidirectional-block-container) .ls-block :is(a.page-ref, a.tag):is(${targets}) {
  background: var(--rf-here) !important; padding: 0 .06em !important; border-radius: 0 !important;
  text-decoration: none !important; box-shadow: inset 0 -1px 0 var(--rf-here-line) !important;
  -webkit-box-decoration-break: clone; box-decoration-break: clone;
}
${scope} :is(.references, .ls-bidirectional-block-container) .bottom-property-pill:has(:is(a.page-ref, a.tag):is(${targets})) { border-radius: 0 !important; }`;
const cssQuote = value => String(value).replace(/["\\]/g, '\\$&');
function updateReferenceHere(doc) {
  const mark = setting('markReferenceHere'), layout = setting('referenceLayout');
  const rules = [], below = new Set();
  if (mark || layout) {
    const titles = [...pageTitles(doc)].filter(el => !el.parentElement?.closest(PAGE_TITLE));
    const pages = [];
    for (const title of titles) {
      const block = title.querySelector('.ls-block[blockid]');
      const uuid = block?.getAttribute('blockid') || '';
      if (!UUID.test(uuid)) continue;
      // A journal is also pointed at by dates (a Scheduled or Deadline value), which carry its name, not its uuid.
      const name = (block.querySelector('.block-title-wrap') || block).textContent.trim();
      pages.push({ uuid, name: isJournalDate(name) ? name.toLowerCase() : '', item: title.closest('.journal-item') });
    }
    // One page on screen, or the Journals list, where every day has its own Linked references.
    const single = pages.length === 1;
    const shown = single ? pages : pages.length && pages.every(page => page.item) ? pages : [];
    for (const { uuid, name, item } of shown) {
      const scope = single ? doc.getElementById('main-content-container') : item;
      if (!scope) continue;
      const uuids = samePageUuids(uuid);
      if (mark) {
        const targets = [...uuids].filter(id => UUID.test(id)).map(id => `[data-uuid="${id}"]`);
        if (name) targets.push(`a.page-ref[data-ref="${cssQuote(name)}" i]`);
        rules.push(hereCss(single ? '#main-content-container'
          : `#main-content-container .journal-item:has(:is(${PAGE_TITLE}) .ls-block[blockid="${uuid}"])`, targets.join(', ')));
      }
      if (!layout) continue;
      const here = link => uuids.has(link.getAttribute('data-uuid')) ||
        (name && (link.getAttribute('data-ref') || '').toLowerCase() === name);
      for (const block of scope.querySelectorAll('.references .ls-block[level="0"] .block-children .ls-block'))
        if (![...block.querySelectorAll(':is(a.page-ref, a.tag)[data-uuid], a.page-ref[data-ref]')].some(here)) below.add(block);
    }
  }
  sendStyle('personal-db-reference-here', rules.join('\n'));
  for (const el of referenceHere.below) if (!below.has(el)) { el.removeAttribute('data-refinement-below'); referenceHere.below.delete(el); }
  for (const el of below) if (!referenceHere.below.has(el)) { el.setAttribute('data-refinement-below', ''); referenceHere.below.add(el); }
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
    const setValue = value => {
      Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new win.Event('input', { bubbles: true }));
    };
    // The menu lists a few properties at first; typing narrows it to Tags.
    if (!tagsEntry()) setValue('Tags');
    const entry = await waitFor(tagsEntry, 2000);
    // Leave nothing typed: Enter on a leftover "Tags" could make Logseq create a new property.
    if (!entry) { if (input.isConnected) setValue(''); return notify('Choose Tags in the menu that opened.', 'info'); }
    entry.click();
  } catch (error) { console.error(error); notify(`Could not open the tag list: ${error.message}`, 'warning'); }
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
  } catch (error) { warnOnce('could not read inherited properties', error); }
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
  } catch (error) { warnOnce('page type label is unavailable', error); }
}
/* Property values written out as text, for one-line lists. Read-only.
   Values come from the database by property ident, so renamed properties keep working. */
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bareIdent = value => String(value ?? '').replace(/^:/, '');
const keyword = ident => ':' + bareIdent(ident);
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
  const version = listProps.namesVersion = (listProps.namesVersion || 0) + 1;
  try {
    const rows = await logseq.DB.datascriptQuery(`[:find ?name
      :where [?p :block/tags ?c] [?c :db/ident :logseq.class/Property] [?p :block/title ?name]]`);
    if (version !== listProps.namesVersion) return;
    listProps.names = new Set((rows || []).map(([name]) => String(name)).filter(Boolean));
    if (dateLinks.document) updateListProps(dateLinks.document);
  } catch (error) { warnOnce('could not load property names', error); }
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
const foldAllListeners = []; // run when a fold-all command starts (the diagnostics part's fold log)
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
const listFold = { wanted: new Map(), pressed: new WeakMap(), manual: new WeakSet(), round: 0, timers: [], observer: null, frame: 0 };
// A press takes Logseq a moment; until the result changes, pressing again would undo it.
const PRESS_WAIT = 600;
const MAX_MISSES = 3; // presses that changed nothing, so a result Logseq refuses to change can't loop
const MAX_PRESSES = 6; // in all, per result per command, so a tug-of-war with Logseq ends
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
      // A press that worked but that Logseq keeps undoing would otherwise be repeated forever.
      const total = (last?.round === round ? last.total || 0 : 0) + 1;
      if (!arrow || misses >= MAX_MISSES || total > MAX_PRESSES) {
        if (!last?.gaveUp) logFold(`${rowName(row)} left as is: ${!arrow ? 'no fold arrow found' : total > MAX_PRESSES ? 'Logseq kept changing it back' : 'pressing did not change it'}`);
        listFold.pressed.set(row, { round, at: Date.now(), misses, total, gaveUp: true });
        continue;
      }
      listFold.pressed.set(row, { round, at: Date.now(), misses, total, changed: false });
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
    if (!target) return notify('No query found on this page. Click in a query or one of its results first', 'warning');
    for (const fn of foldAllListeners) fn();
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
    else if (noArrow) notify(`${noArrow} of ${n} folded result${n === 1 ? '' : 's'} in ${target.label} ${noArrow === 1 ? 'has' : 'have'} no fold arrow to press and stay${noArrow === 1 ? 's' : ''} folded. Run “Copy fold log” for details`, 'warning');
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
  } catch (error) { warnOnce('could not load values for one-line lists', error); }
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
  } catch (error) { warnOnce('list property choices are unavailable', error); }
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
    if (!target) return notify('Click in a record of a query or list first', 'warning');
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

/* Hidden properties: Logseq draws its "Show hidden properties" button only on the block you have
   zoomed into. This draws it on every block that has hidden properties, as a small fold arrow; Logseq's
   own button (when zoomed in) loses its words too. Logseq's per-block switch behind its button cannot
   be reached by a plugin, so the arrow uses Logseq's "show all properties" for that one block (as
   selecting it and pressing p a does) and hides the rows that adds which are not hidden properties,
   so the same list opens. A property is hidden as Logseq decides it: set to hide by default, or set
   to hide when empty and empty on a tag's property. */
const hiddenProps = { byBlock: new Map(), buttons: new Set(), marked: new Set(), generation: 0, hover: null };
// Properties Logseq never lists (its own internal ones) and the query of a query block.
const HIDDEN_LISTED = `(or-join [?p] (not [?p :logseq.property/built-in? true]) [?p :logseq.property/public? true])
  [?p :db/ident ?pi] [(not= ?pi :logseq.property/query)] [?p :block/title ?title]`;
// A block's tags, and the tags those extend.
const HIDDEN_TAGGED = '(or-join [?b ?c] [?b :block/tags ?c] (and [?b :block/tags ?c0] [?c0 :logseq.property.class/extends ?c]))';
async function loadHiddenProps() {
  if (!setting('hiddenPropsChevron')) return;
  const generation = ++hiddenProps.generation;
  try {
    const rows = (await Promise.all([
      dsQuery(`[:find ?u ?title :where [?p :logseq.property/hide? true] ${HIDDEN_LISTED} [?b ?pi] [?b :block/uuid ?u]]`),
      dsQuery(`[:find ?u ?title :where [?p :logseq.property/hide? true] ${HIDDEN_LISTED}
        [?c :logseq.property.class/properties ?p] ${HIDDEN_TAGGED} [?b :block/uuid ?u]]`),
      dsQuery(`[:find ?u ?title :where [?p :logseq.property/hide-empty-value true] ${HIDDEN_LISTED}
        [?c :logseq.property.class/properties ?p] ${HIDDEN_TAGGED} (not [?b ?pi]) [?b :block/uuid ?u]]`),
    ])).flat();
    if (generation !== hiddenProps.generation) return;
    const byBlock = new Map();
    for (const [uuid, title] of rows) {
      if (!byBlock.has(uuid)) byBlock.set(uuid, new Set());
      byBlock.get(uuid).add(String(title));
    }
    hiddenProps.byBlock = byBlock;
    updateHiddenProps(host());
  } catch (error) { warnOnce('hidden properties could not be read', error); }
}
// Blocks whose properties are all shown through Logseq's "show all properties" (one block at a time).
function hiddenPropsOpen(doc) {
  try {
    const state = doc.defaultView.logseq?.api?.get_state_from_store?.('ui/show-empty-and-hidden-properties?');
    if (!state?.['show?'] || state.mode !== 'block') return new Set();
    return new Set([...(state.ids || [])].map(String));
  } catch (error) { return new Set(); }
}
// The arrow itself is drawn by hiddenPropsCss, like the fold arrow beside a block.
function setHiddenToggle(button, open) {
  const state = open ? 'open' : 'closed';
  if (button.getAttribute('data-refinement-hidden-open') === state) return;
  button.setAttribute('data-refinement-hidden-open', state);
  button.setAttribute('aria-label', open ? 'Collapse hidden properties' : 'Show hidden properties');
  button.title = open ? 'Collapse hidden properties' : 'Show hidden properties';
}
// The arrows show while you point at their block (not at a block inside it), as fold arrows do, or
// anywhere near the arrow itself, even outside its block.
const HIDDEN_TOGGLES = '.bottom-property-hidden-toggle-btn, .hidden-properties-toggle-row, [data-refinement-hidden-toggle]';
function hiddenTogglesOf(block) {
  return block ? [...block.querySelectorAll(HIDDEN_TOGGLES)].filter(el => el.closest('.ls-block[blockid]') === block) : [];
}
const HIDDEN_NEAR_X = 48, HIDDEN_NEAR_Y = 16; // how far from the arrow (px) still counts as near it
function hoverHiddenProps(block, x, y, doc) {
  hiddenProps.hover = block;
  const show = new Set(hiddenTogglesOf(block));
  if (doc && x !== undefined) {
    for (const el of doc.querySelectorAll(HIDDEN_TOGGLES)) {
      const box = el.getBoundingClientRect();
      if (!box.width) continue;
      if (x >= box.left - HIDDEN_NEAR_X && x <= box.right + HIDDEN_NEAR_X && y >= box.top - HIDDEN_NEAR_Y && y <= box.bottom + HIDDEN_NEAR_Y) show.add(el);
    }
  }
  for (const el of hiddenProps.shown || []) if (!show.has(el)) el.removeAttribute('data-refinement-hidden-hover');
  for (const el of show) if (!el.hasAttribute('data-refinement-hidden-hover')) el.setAttribute('data-refinement-hidden-hover', '');
  hiddenProps.shown = show;
}
// Where the arrow goes: after the row of properties under the block, else at the end of its
// property list, else in the empty space Logseq keeps for that list.
// The arrow sits right after the block's own text, the same place on every block. While the block is being
// edited it has no such text, and the arrow waits. A block drawn without that text keeps the old places.
function hiddenTogglePlace(block, own) {
  if ([...block.querySelectorAll('textarea, [contenteditable="true"]')].some(own)) return null;
  return [...block.querySelectorAll('.block-title-wrap')].find(el => own(el) && !el.closest('a.page-ref, .positioned-properties, .ls-properties-area'))
    || [...block.querySelectorAll('.positioned-properties.block-below .bottom-properties-pills-strip')].find(own)
    || [...block.querySelectorAll('.ls-properties-area')].find(own)
    || [...block.querySelectorAll('.ls-block-content-indent')].find(el => own(el) && !el.classList.contains('ls-inline-comments'));
}
function updateHiddenProps(doc) {
  const on = setting('hiddenPropsChevron');
  const open = on ? hiddenPropsOpen(doc) : new Set();
  const buttons = new Set(), marks = new Set();
  if (on) for (const block of doc.querySelectorAll('.ls-block[blockid]')) {
    const uuid = block.getAttribute('blockid');
    // A block left open keeps its arrow and its filtering even when nothing on it is hidden any more
    // (a tag's property was set to show when empty), so it can still be closed.
    const hidden = hiddenProps.byBlock.get(uuid) || (open.has(uuid) ? new Set() : null);
    if (!hidden || block.closest('.ls-page-title, .page-title')) continue;
    const own = el => el.closest('.ls-block') === block;
    // A folded block shows none of its properties (Logseq folds even a block with no children), so the arrow
    // would change nothing there and is left off until the block is unfolded.
    if ([...block.querySelectorAll('.bullet-container.bullet-closed')].some(own)) continue;
    const toggles = hiddenTogglesOf(block);
    if (toggles.some(el => !el.hasAttribute('data-refinement-hidden-toggle'))) continue; // zoomed in: Logseq's own button
    const isOpen = open.has(uuid);
    if (isOpen) {
      for (const row of block.querySelectorAll('.ls-properties-area .property-pair.property-panel-row[data-property-title]')) {
        if (own(row) && !hidden.has(row.getAttribute('data-property-title'))) marks.add(row);
      }
    }
    const place = hiddenTogglePlace(block, own);
    if (!place) continue;
    let button = toggles[0];
    if (!button) {
      button = doc.createElement('button');
      button.type = 'button';
      button.className = 'refinement-hidden-toggle';
      button.setAttribute('data-refinement-hidden-toggle', uuid);
    }
    setHiddenToggle(button, isOpen);
    if (block === hiddenProps.hover) button.setAttribute('data-refinement-hidden-hover', '');
    if (button.parentElement !== place || button !== place.lastElementChild) place.appendChild(button);
    buttons.add(button);
  }
  for (const button of hiddenProps.buttons) if (!buttons.has(button)) button.remove();
  hiddenProps.buttons = buttons;
  for (const row of hiddenProps.marked) if (!marks.has(row)) row.removeAttribute('data-refinement-hidden-extra');
  for (const row of marks) if (!row.hasAttribute('data-refinement-hidden-extra')) row.setAttribute('data-refinement-hidden-extra', '');
  hiddenProps.marked = marks;
}
async function toggleHiddenProps(uuid) {
  try {
    await logseq.Editor.selectBlock(uuid);
    await logseq.App.invokeExternalCommand('logseq.editor/toggle-display-hidden-properties');
  } catch (error) { warnOnce('hidden properties could not be shown', error); }
  try { await logseq.Editor.clearSelectedBlocks(); } catch (error) { /* nothing was selected */ }
  updateHiddenProps(host());
}
const hiddenPropsCss = `/* Logseq's own button (on a zoomed-in block) and the plugin's: no words, just a small muted
   chevron that turns like the fold arrow beside a block, pointing right while the hidden properties are folded
   and down while they are open. It shows while you point at its block, or while it is open. */
.ls-block .bottom-property-hidden-toggle-btn { font-size: 0 !important; gap: 0 !important; padding: 0 .25rem !important;
  background: transparent !important; color: var(--ls-secondary-text-color, currentColor) !important; }
.ls-block .bottom-property-hidden-toggle-btn .ui__icon,
.hidden-properties-toggle-row .property-icon .ui__icon, .hidden-properties-toggle-row .property-k { display: none !important; }
.ls-block .bottom-property-hidden-toggle-btn:not(:focus-visible)::after { box-shadow: none !important; }
.refinement-hidden-toggle { display: inline-flex; align-items: center; justify-content: center; flex: none;
  height: 1.5rem; padding: 0 .25rem; border: 0; background: transparent; cursor: pointer;
  color: var(--ls-secondary-text-color, currentColor); }
.ls-properties-area > .refinement-hidden-toggle, .ls-block-content-indent > .refinement-hidden-toggle { display: flex; }
.block-title-wrap > .refinement-hidden-toggle { height: 1.2em; padding: 0 .1em; margin-left: .25em; vertical-align: -.2em; }
:is(.ls-block .bottom-property-hidden-toggle-btn, .refinement-hidden-toggle, .hidden-properties-toggle-row .property-icon) {
  opacity: var(--rf-faint); transition: opacity .12s ease; }
:is(.ls-block .bottom-property-hidden-toggle-btn, .refinement-hidden-toggle, .hidden-properties-toggle-row .property-icon):hover { opacity: 1; }
:is(.ls-block .bottom-property-hidden-toggle-btn, .refinement-hidden-toggle[data-refinement-hidden-open=closed], .hidden-properties-toggle-row):not(:has(.ls-icon-chevron-up)):not([data-refinement-hidden-hover]):not(:focus-visible),
.hidden-properties-toggle-row:not(:has(.ls-icon-chevron-up)):not([data-refinement-hidden-hover]) .property-icon { opacity: 0 !important; }
.ls-block .bottom-property-hidden-toggle-btn::before, .refinement-hidden-toggle::before, .hidden-properties-toggle-row .property-icon::before {
  content: '' !important; display: block !important; margin: 0 !important; opacity: 1 !important;
  width: 16px; height: 16px; background: currentColor; transition: transform .16s ease;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 6l6 6l-6 6'/%3E%3C/svg%3E") center / 16px 16px no-repeat; }
.ls-block .bottom-property-hidden-toggle-btn:has(.ls-icon-chevron-up)::before, .refinement-hidden-toggle[data-refinement-hidden-open=open]::before,
.hidden-properties-toggle-row:has(.ls-icon-chevron-up) .property-icon::before { transform: rotate(90deg); }
[data-refinement-hidden-extra] { display: none !important; }`;
function startHiddenProps() {
  try {
    const win = host().defaultView;
    // The arrow must not start editing the block it sits in.
    listen(win, ['pointerdown', 'mousedown'], event => {
      if (!event.target?.closest?.('[data-refinement-hidden-toggle]')) return;
      event.preventDefault(); event.stopPropagation();
    });
    // Checked once a frame while the pointer moves.
    let pending = null;
    listen(win, ['pointermove'], event => {
      const first = !pending;
      pending = event;
      if (!first) return;
      win.requestAnimationFrame(() => {
        const e = pending; pending = null;
        if (!setting('hiddenPropsChevron') || !e) return;
        hoverHiddenProps(e.target?.closest?.('.ls-block[blockid]') || null, e.clientX, e.clientY, win.document);
      });
    });
    listen(win, ['blur'], () => hoverHiddenProps(null));
    listen(win, ['click'], event => {
      const button = event.target?.closest?.('[data-refinement-hidden-toggle]');
      if (!button) return;
      event.preventDefault(); event.stopPropagation();
      toggleHiddenProps(button.getAttribute('data-refinement-hidden-toggle'));
    });
    sendStyle('personal-db-hidden-props', setting('hiddenPropsChevron') ? hiddenPropsCss : '');
    watchDom(updateHiddenProps);
    loadHiddenProps();
    onUnload(() => {
      for (const button of hiddenProps.buttons) button.remove();
      hiddenProps.buttons.clear();
      for (const row of hiddenProps.marked) row.removeAttribute('data-refinement-hidden-extra');
      hiddenProps.marked.clear();
      hoverHiddenProps(null);
    });
  } catch (error) { warnOnce('the hidden-properties arrow is unavailable', error); }
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
  clearTimeout(refreshTimer);
  clearTimeout(pageKind.timer);
  const failed = error => warnOnce('a look-up after a change failed', error);
  const run = jobs => { for (const job of jobs) { try { Promise.resolve(job()).catch(failed); } catch (error) { failed(error); } } };
  // About the page on screen: after every round.
  const pageJobs = [refreshCues, loadPageKind, refreshInlineValues, refreshCrumbLinks, loadHiddenProps];
  // Whole-graph lists: now if they are due; otherwise one full round when they fall due.
  const fullRound = () => {
    clearTimeout(dbWork.slowTimer);
    dbWork.slowTimer = 0;
    dbWork.slowAt = Date.now();
    graphCache.clear();
    run([loadPageLabelTitles, refreshJournalDates, loadPropertyNames, ...pageJobs]);
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
    CHECKED_WITH, PAGE_TITLE, REFERENCE_AREAS, referencedNodeIds, incomingPropertyLinks, pageTitles, pageHeaderOf,
    // Still here until their areas move to parts of their own; the parts that need them take them from the core meanwhile.
    openTagPicker, isJournalDate, updateOwnTags, attribute, escapeHtml,
    listFold, listRows, foldLog, logFold, rowName, onFoldAll: fn => foldAllListeners.push(fn),
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
  startDateLinks();
  startPdfCitations();
  if (setting('tidySidebar')) startSidebarPresentation();
  startQuietUi();
  startQuietLinkMenu();
  provided.startDateLinkSwap();
  if (setting('showTitleChrome')) startTitleChrome();
  startPageKind();
  startListProps();
  startHiddenProps();
  startSelfCheck();
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
    graphCache.clear(); // a new page (or a new graph) reads the whole-graph lists fresh
    referenceHere.names.clear(); // and looks up the page's aliases again
    scheduleRefresh(); schedulePageKind();
    loadHiddenProps(); // another graph has other blocks
  }));
  // Edits fire this constantly while typing, so each part waits for a pause before re-querying.
  onUnload(logseq.DB.onChanged(({ blocks } = {}) => {
    perf.add('DB.onChanged (calls only)', 0);
    if (foldLog.start) logFold(`database changed (${blocks?.length ?? '?'} block${blocks?.length === 1 ? '' : 's'})`);
    scheduleDbWork();
  }));
  onUnload(() => { clearTimeout(dbWork.timer); clearTimeout(dbWork.slowTimer); });
  provided.startEditor(); // the editor keys and the last text selection (parts/editor.js)
  onUnload(logseq.onSettingsChanged((now, before) => {
    if (perf.ownSettingsOnly(now, before)) return;
    try { updateListProps(host()); } catch (error) { /* list choices apply on the next change */ }
    applyHierarchy();
    sendStyle('personal-db-refinements', mainCss());
    applyTagPageStyle();
    if (CUE_SETTINGS.some(key => now?.[key] !== before?.[key])) scheduleRefresh(0);
    if (now?.pdfCitations !== before?.pdfCitations) updatePdfCitations();
    try { updatePageKind(host()); updateOwnTags(host()); } catch (error) { /* shown on the next change */ }
    if (now?.hiddenPropsChevron !== before?.hiddenPropsChevron) {
      sendStyle('personal-db-hidden-props', setting('hiddenPropsChevron') ? hiddenPropsCss : '');
      try { updateHiddenProps(host()); } catch (error) { /* shown on the next change */ }
      loadHiddenProps();
    }
    updateDateLinks();
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
    ['fold-query-results', 'Fold all results in this query', () => foldQueryResults(null, true)],
    ['unfold-query-results', 'Unfold all results in this query', () => foldQueryResults(null, false)],
    ['choose-list-properties', 'Choose properties shown in this list', chooseListProperties],
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
const PART_FILES = ['parts/shared.js', 'parts/diagnostics.js', 'parts/editor.js', 'parts/sidebar.js', 'parts/search.js', 'parts/journal-dates.js', 'parts/rich-copy.js', 'parts/todos.js', 'parts/tags.js', 'parts/settings-panel.js'];
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



























