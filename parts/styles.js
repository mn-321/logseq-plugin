/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Styles part of DB Refinements (moved out of main.js in the October 2026 cleanup): the fixed
   stylesheets, kept as the same template strings. The main stylesheet in sections (cssParts, joined by
   mainCss by the settings that are on), the cue stylesheet (cueCss, drawn from the marks the links part
   sets), the hierarchy rules (hierarchyParts, applyHierarchy), the tag-page link rule (applyTagPageStyle),
   the icon masks and the small helpers the rules are written with (wash, dateStyles, referenceIcon,
   blockDot). Logseq takes stylesheets only through provideStyle, so they stay JavaScript strings.
   It provides mainCss, cueCss, applyHierarchy, applyTagPageStyle, wash and the cue selectors to the core
   and the other parts, with the Linked references selectors (REFERENCE_AREAS) the rules are written
   with; it takes tagPages from the links part. */
const shared = window.refinementShared;
const { warnOnce, onUnload, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements: ' });
// From the core and the other parts, taken when the part starts (after every part has provided its own).
let setting, sendStyle, UUID, provided;
// A name may be the core's own or one another part provided; a missing one is a broken contract.
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };

// Tables already provide structure, so several rules leave anything inside one alone.
const notInTable = ':not(:is(table, [role="table"], [role="grid"], .table-view, .ls-table) *)';
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
/* The kinds inside and the nearest due day show while the block is folded; a cue that has nothing else to say waits with them. */
.refinement-child-kinds { display: none; }
.refinement-child-kinds .rf-sep { opacity: var(--rf-faint); margin: 0 .25em 0 .1em; }
.refinement-child-kinds .rf-hash { color: var(--rf-tag-color); }
.ls-block[data-collapsed="true"] > .block-main-container .refinement-child-kinds { display: inline; }
.ls-block:not([data-collapsed="true"]) > .block-main-container .refinement-child-assets[data-only-folded] { display: none; }
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
   icon in front, and nothing after: the icon says file, and the slot after the text is for what the
   block holds (the file type word that used to follow was dropped in 0.4.70).
   A link to a file on the web has an href; Logseq draws a link to a file in the graph's assets folder
   with data-href instead (seen in 2.0.2), so both are matched. The row of an asset block (the file itself,
   listed with Logseq's own icon in its bullet) carries data-url as well and is left alone. */
.ls-block .block-content a:is([href*=".pdf" i], [data-href*=".pdf" i]:not([data-url]), [href*=".png" i], [data-href*=".png" i]:not([data-url]), [href*=".jpg" i], [data-href*=".jpg" i]:not([data-url]), [href*=".jpeg" i], [data-href*=".jpeg" i]:not([data-url]), [href*=".webp" i], [data-href*=".webp" i]:not([data-url])):not(:has(img)) {
  color: var(--ls-primary-text-color, inherit) !important; border-bottom: 0 !important;
  text-decoration: underline solid color-mix(in srgb, currentColor var(--rf-line-pct), transparent) 1px !important; text-underline-offset: .2em;
}
.ls-block .block-content a:is([href*=".pdf" i], [data-href*=".pdf" i]:not([data-url]), [href*=".png" i], [data-href*=".png" i]:not([data-url]), [href*=".jpg" i], [data-href*=".jpg" i]:not([data-url]), [href*=".jpeg" i], [data-href*=".jpeg" i]:not([data-url]), [href*=".webp" i], [data-href*=".webp" i]:not([data-url])):not(:has(img)):hover { text-decoration-color: currentColor !important; }
.ls-block .block-content a:is([href*=".pdf" i], [data-href*=".pdf" i]:not([data-url]), [href*=".png" i], [data-href*=".png" i]:not([data-url]), [href*=".jpg" i], [data-href*=".jpg" i]:not([data-url]), [href*=".jpeg" i], [data-href*=".jpeg" i]:not([data-url]), [href*=".webp" i], [data-href*=".webp" i]:not([data-url])):not(:has(img))::before { text-decoration: none; }
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
/* A link to a block that carries its tag's icon (Logseq draws the icon first, then the title area two levels down, inside an unclassed span): the dot
   moves in front of the icon, so a linked record reads dot, icon, words, as a linked task reads dot, icons, words.
   A labelled link already has its dot on its first span, which is the icon when there is one. */
.ls-block a.page-ref:not(.tag):has(> .icon-emoji-wrap):has(.block-title-wrap) .block-title-wrap::before { content: none !important; }
${blockDot('.ls-block a.page-ref:not(.tag):not(:has(.prefix-link, img)):has(> .icon-emoji-wrap):has(.block-title-wrap) > .icon-emoji-wrap')}
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
  ['quietEmptyProps', `/* A fresh record shows every property of its tag with no value (Logseq marks the pill .empty-value and
   the list row .property-panel-row-empty). Those wait until the caret is in the block (you are typing in it),
   then come back quiet, so a record shows what it knows. Not on hover: a row that appears under the pointer
   pushes every block below it down (seen by the owner, 0.4.76). The page's own list under its title is left alone. */
.ls-block > .block-main-container .positioned-properties.block-below .bottom-property-pill:has(.empty-value) { display: none; }
.ls-block > .block-main-container:focus-within .positioned-properties.block-below .bottom-property-pill:has(.empty-value) { display: flex; opacity: var(--rf-quiet); }
/* No stray dot before the first pill that shows while the empty ones are hidden. */
.ls-block > .block-main-container:not(:focus-within) .positioned-properties.block-below .bottom-property-pill:has(.empty-value) + .bottom-property-pill::before { content: none; }
/* The list sits beside the block's row (.ls-block > .ls-block-content-indent), so the block itself is what is pointed at;
   a nested block under the pointer does not count. */
.ls-block > .ls-block-content-indent > .ls-properties-area .property-pair.property-panel-row-empty { display: none; }
.ls-block:focus-within:not(:has(.ls-block:focus-within)) > .ls-block-content-indent > .ls-properties-area .property-pair.property-panel-row-empty { display: grid; opacity: var(--rf-quiet); }
/* A list with nothing filled in at all: its field waits too. */
.ls-block:not(:focus-within) > .ls-block-content-indent > .ls-properties-area:has(.property-pair):not(:has(.property-pair:not(.property-panel-row-empty))) { display: none; }
`],
  ['showUsage', `/* While one count of the usage line is on, the other reference rows step back (not away: Logseq's list
   measures its rows, and a row of no height breaks it); one comes forward under the pointer. Marked by
   updateUsageLine in the links part. */
#main-content-container .references .ls-block[data-refinement-usage-dim] > .block-main-container, #main-content-container .references .ls-block[data-refinement-usage-dim] > .ls-block-content-indent { opacity: .22; }
#main-content-container .references .ls-block[data-refinement-usage-dim]:hover > .block-main-container, #main-content-container .references .ls-block[data-refinement-usage-dim]:hover > .ls-block-content-indent { opacity: 1; }
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
  ['dateTense', `/* A date carries its tense: a past day in the secondary text colour, today a little firmer on the
   stronger wash, a day to come as it is. An overdue Scheduled or Deadline keeps Logseq's yellow (the
   overdue rule above wins on colour). Marked by updateDateTense in the links part. */
.ls-block a.page-ref[data-refinement-tense="past"]:not(.overdue *) { color: var(--ls-secondary-text-color, currentColor) !important; }
.ls-block .positioned-properties a.page-ref[data-refinement-tense="past"]:not(.overdue *) { color: var(--ls-secondary-text-color, currentColor) !important; }
.ls-block a.page-ref[data-refinement-tense="today"] { font-weight: 600 !important; background: ${wash('--rf-wash-strong-pct')} !important; }
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
  // Space between groups comes from the stylesheet, not from empty blocks: every top-level block on a
  // page body (and on a journal day) after the first gets a little air above it. Blocks under Linked
  // references are level 0 too, so the rule is tied to the page body's own wrapper.
  topLevelGap: `
.ls-page-blocks .page-blocks-inner > .blocks-container > .blocks-list-wrap > .ls-block + .ls-block { margin-top: var(--rf-group-gap) !important; }`,
  // No dot on an empty block (no text, children, tags, properties or pictures), so it reads as a
  // gap between groups. The dot comes back faintly on hover, and fully while you type in the block.
  quietEmptyBullets: `
.ls-block:not([data-collapsed="true"]):not(:has(> .block-children-container .ls-block)):has(> .block-main-container .block-content .block-title-wrap:empty):not(:has(> .block-main-container :is(.editor-wrapper, .block-content-wrapper :is(img, input, button, video, iframe, a, svg, .ls-properties-area, .block-body), .ls-block-right :is(.block-tags, .positioned-properties *), .block-content-or-editor-wrap > .positioned-properties *))) > .block-main-container .bullet-container { opacity: 0; transition: opacity .15s; }
.ls-block:not([data-collapsed="true"]):not(:has(> .block-children-container .ls-block)):has(> .block-main-container .block-content .block-title-wrap:empty):not(:has(> .block-main-container :is(.editor-wrapper, .block-content-wrapper :is(img, input, button, video, iframe, a, svg, .ls-properties-area, .block-body), .ls-block-right :is(.block-tags, .positioned-properties *), .block-content-or-editor-wrap > .positioned-properties *))) > .block-main-container:hover .bullet-container { opacity: .35; }`,
  // A tag is not a link, so it does not take the link's blue: Logseq draws every tag chip as a # link
  // (a.hash-symbol) beside the name (a.tag > span), at the right of a block, above a tag page's title
  // and before that title alike. The # alone takes the tag colour, the name the text colour, which is
  // the mark a link to a tag page already carries. A tag word left in a sentence is a plain <span>#Tag</span>;
  // the links part marks it (data-refinement-mention) and its first letter, the #, takes the colour.
  tagMark: `
:is(#main-content-container, #right-sidebar, #left-sidebar) a.hash-symbol { color: var(--rf-tag-color) !important; }
:is(#main-content-container, #right-sidebar) a.tag:not(mark *) { color: var(--ls-primary-text-color, currentColor) !important; }
:is(#main-content-container, #right-sidebar) a.tag:not(mark *):hover { text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor var(--rf-line-pct), transparent); text-underline-offset: .2em; }
.ls-block .block-content span[data-refinement-mention] { display: inline-block; }
.ls-block .block-content span[data-refinement-mention]::first-letter { color: var(--rf-tag-color); }
.ls-bidirectional-properties [role="tab"] > span > span:last-child::before { color: var(--rf-tag-color); }
/* The # before a tag page's title is Logseq's hash icon inside its Add icon button. */
#main-content-container .ls-page-title .ls-icon-hash { color: var(--rf-tag-color) !important; }
.refinement-title-tags { display: inline-block; color: var(--ls-primary-text-color, currentColor) !important; }
.refinement-title-tags::first-letter { color: var(--rf-tag-color); }`,
  // Optional soft chip behind tags, inline and at the end of a block. Off by default: the plugin
  // otherwise keeps color for dates only.
  tintTags: `
.ls-block :is(.block-content, .block-tags) a.tag:not(mark *) {
  background: color-mix(in srgb, var(--rf-accent) 14%, transparent) !important;
  border-radius: .25em;
  padding: 0 .25em;
}`,
};
function applyHierarchy() {
  sendStyle('personal-db-hierarchy', Object.keys(hierarchyParts).filter(setting).map(key => hierarchyParts[key]).join('\n'));
}


function provide(core) {
  core.provide({ mainCss, cueCss, applyHierarchy, applyTagPageStyle, wash, blockLink, blockLinkPlain, viaLook, REFERENCE_AREAS, referenceAreas });
}
function start() {
  const core = window.refinementCore;
  provided = core.provided;
  ({ setting, sendStyle, UUID } = take(core, ['setting', 'sendStyle', 'UUID']));
}
(window.refinementParts ||= []).push({ name: 'styles', schema: [], provide, start, stop: runUnloadTasks });
})();
