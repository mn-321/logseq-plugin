/* Loaded by main.js after parts/sidebar.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* How Logseq's own page looks (0.4.337, docs/LAYERS.md layer 5, begun early at the owner's word: a picture of a bullet
   with its capsules and blue links, "no the capsule, plus there is no underline for links"). Three rules of the
   grammar (LAYERS.md section 2), each with its own switch, drawn only with the kit's greys and Logseq's text colour:
   - a link in the words is the text colour with a faint underline, firmer under the pointer, never blue;
   - a tag is a class: its name in mono, the quiet grey, no # (Logseq's # link is made invisible in a fixed slot, and the
     × it swaps in under the pointer takes the same slot, so the name never moves);
   - a bullet's properties have no capsule: no edge, no fill; the name quiet, the value in the text colour, a faint
     dot between one property and the next.
   Stylesheets only; nothing moves on the page (the pills keep their height, the slots their width). A page's own property
   list and Logseq's tables are left as Logseq draws them.
   Four more from the old styles part, emptied into here and deleted at 0.4.359 (docs/STYLES-AUDIT.md): Logseq's "+ Add
   property" under a page's properties only with the pointer there, its room kept; an empty property faint, never hidden
   (the owner, 0.4.79); the pencil after a date value left out (the owner, 0.4.85); the nesting line beside the branch
   under the pointer or being written firmer. */
const shared = window.refinementShared;
const { warnOnce, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (page look): ' });
let sendStyle, onSettingsChange;
const take = (core, names) => shared.take(core, names, warnOnce);

const settingsSchema = [
  { key: 'pageLookHeading', type: 'heading', group: 'reading', rank: 3, title: 'Links, tags and properties', default: null, icon: 'page',
    legend: 'Links underlined faintly, days in grey, tags as class names, properties without capsules',
    zone: '<div>Talked to <u>Hannah Reyes</u> &nbsp; <span class="m">Consultation</span></div><div class="m">Provider: <span style="color:inherit">Hannah Reyes</span> · Date: <span style="color:inherit">Oct 21st</span></div>',
    description: 'Changes here apply right away. Only greys mixed from the text colour; nothing on the page moves.' },
  { key: 'quietLinks', type: 'boolean', title: 'Links in the text colour with a faint underline', default: true,
    description: 'A link to a page is the text colour with a faint line under it, firmer while you point at it, instead of blue: in a bullet’s words, in a property’s value, in Logseq’s tables and in the Linked references.' },
  { key: 'quietDates', type: 'boolean', title: 'Journal days as quiet grey words', default: true,
    description: 'A link to a journal day (“Oct 21st, 2026”) is grey words with no underline, the text colour while you point at it, instead of blue.' },
  { key: 'quietNames', type: 'boolean', title: 'Property names and values lighter than the words', default: true,
    description: 'A property’s value is a lighter grey than the bullet’s words, and its name and colon lighter still, in a bullet’s properties and in a page’s own list under its title.' },
  { key: 'tagsAsClasses', type: 'boolean', title: 'Tags as class names', default: true,
    description: 'A tag at the right of a bullet reads as its name alone in a monospace face, grey, without the #. The × that removes it takes the #’s place under the pointer, so the name does not move.' },
  { key: 'noCapsules', type: 'boolean', title: 'Properties without capsules', default: true,
    description: 'A bullet’s properties read as “Provider: Hannah Reyes · Date: Oct 21st”: no edge, no fill, the name grey and the value in the text colour, a faint dot between one property and the next.' },
  { key: 'quietAddProperty', type: 'boolean', title: '“+ Add property” only with the pointer on the properties', default: true,
    description: 'Under a page’s properties, Logseq’s “+ Add property” shows only while you point at the list or type in it; its room is kept, so nothing moves.' },
  { key: 'quietEmptyProps', type: 'boolean', title: 'Empty properties faint', default: true,
    description: 'A property with no value yet stays on screen, faint, under a bullet and in a bullet’s list of properties. A page’s own list under its title is left as it is.' },
  { key: 'hideDatePencil', type: 'boolean', title: 'No pencil after a date', default: true,
    description: 'Logseq puts a small pencil after a date value; it is left out. A click on the date still opens Logseq’s date picker.' },
  { key: 'indentGuides', type: 'boolean', title: 'The nesting line firmer where you are', default: true,
    description: 'The line beside the bullets nested under the one you point at or type in is a little firmer than Logseq’s faint nesting lines. Nothing moves: Logseq draws the line as a border.' },
];
const setting = shared.settingReader(settingsSchema);

const AREA = ':is(#main-content-container, #right-sidebar)';
const DAY = ':is([data-uuid^="00000001-"], .ls-datetime *)'; // Logseq 2.0.2 gives every journal page a uuid starting 00000001-
const linksCss = `
/* A link: the text colour, a faint underline, firmer under the pointer. Everywhere Logseq draws one (a bullet's words, a
   property's value, a table cell, the Linked references); tags and journal days are not links of this kind. */
${AREA} a.page-ref:not(.tag):not(${DAY}) { color: inherit !important; text-decoration: underline !important; text-decoration-color: var(--rf-line) !important; text-decoration-thickness: 1px; text-underline-offset: .2em; }
${AREA} a.page-ref:not(.tag):not(${DAY}):hover { text-decoration-color: currentColor !important; }
`;
const datesCss = `
/* A journal day: quiet grey words, no underline; the text colour under the pointer. */
${AREA} a.page-ref${DAY}, ${AREA} .ls-datetime a { color: var(--rf-quiet) !important; text-decoration: none !important; }
${AREA} a.page-ref${DAY}:hover, ${AREA} .ls-datetime a:hover { color: inherit !important; }
`;
const namesCss = `
/* The greys are mixed from currentColor, so they must be set ONCE per box and inherited, never on every descendant: at
   0.4.343 the value side was coloured on each nested element and a link three levels deep ended near 20% (the owner:
   "you made it even worse"). The pill (and a page list's value box) takes the quiet grey; everything inside inherits it
   but a tag and a pencilled proposal; the name, one level in, takes the share of the pill's grey that lands on the kit's
   faint (50 / 70); at 0.4.345 the name lighter still, 40% of the text colour, the owner's pick from two pictures. */
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill,
${AREA} .ls-properties-area .property-pair .property-value-container { color: var(--rf-quiet) !important; }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill *:not(.tag):not(.tag *):not(.rfs-ghost):not(.rfs-ghost *),
${AREA} .ls-properties-area .property-pair .property-value-container *:not(.tag):not(.tag *):not(.rfs-ghost):not(.rfs-ghost *) { color: inherit !important; }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill > div:first-child { color: color-mix(in srgb, currentColor 57%, transparent) !important; } /* 40% of the text colour (the owner at 0.4.345: "do the lighter version") */
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill .rfs-ghost { color: color-mix(in srgb, currentColor 71.5%, transparent) !important; }
${AREA} .ls-properties-area .property-pair .property-key-panel { color: color-mix(in srgb, currentColor 40%, transparent) !important; }
${AREA} .ls-properties-area .property-pair .property-key-panel * { color: inherit !important; }
`;
const tagsCss = `
/* Logseq draws a # link before the name and swaps it for an × (remove) link under the pointer. The # is made
   invisible but keeps a fixed slot, and the × takes the same slot, so the name never moves. */
${AREA} .block-tag :is(a.hash-symbol, a[title="Remove this tag"]) { display: inline-flex !important; align-items: center; justify-content: center; width: 1.1em; margin: 0 !important; padding: 0 !important; }
${AREA} .block-tag a.hash-symbol { visibility: hidden; }
${AREA} a.tag:not(mark *) { color: inherit !important; opacity: .7; font-family: var(--rf-mono); font-size: 12.5px; letter-spacing: .01em; text-decoration: none !important; }
${AREA} a.tag:not(mark *):hover { opacity: 1; }
`;
const capsulesCss = `
/* Logseq draws the capsule's edge on ::after (kept while a capsule has keyboard focus) and its fill on the pill. */
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill { background: transparent !important; padding-left: 0 !important; padding-right: 0 !important; }
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill:not(:focus-within)::after { box-shadow: none !important; border: 0 !important; }
/* Logseq's ring stays while the keyboard is on a pill (the owner at 0.4.343: "But I use keyboard"). */
/* The dot sits before a pill that a shown pill comes before: an empty property the proposals hide (parts/shadow.js) does
   not count, or the first shown one would carry a dot of its own. */
${AREA} .ls-block .positioned-properties.block-below .bottom-property-pill:is(:not(:has(.empty-value)), [data-refinement-proposal], [data-rfs-at]) ~ .bottom-property-pill::before { content: '·'; margin-right: .5rem; color: var(--rf-faint); }
`;
const addPropertyCss = `
/* Logseq's "+ Add property" under a page's own list: invisible until the pointer is on the list or the keyboard in it. */
.ls-page-properties .ls-new-property { opacity: 0 !important; transition: opacity .15s; }
.ls-page-properties:is(:hover, :focus-within) .ls-new-property { opacity: .7 !important; }
.ls-page-properties .ls-new-property:is(:hover, :focus-within) { opacity: 1 !important; }
`;
const emptyPropsCss = `
/* Logseq marks an empty pill .empty-value and an empty row .property-panel-row-empty; faint, never hidden. In a graph
   where the proposals write (html.rfs-hide-empty, parts/shadow.js) they own empty properties, so this stays out; a
   focused one keeps Logseq's look. */
html:not(.rfs-hide-empty) ${AREA} .ls-block > .block-main-container .positioned-properties.block-below .bottom-property-pill:has(.empty-value):not(:focus-within) { opacity: .5; }
html:not(.rfs-hide-empty) ${AREA} .ls-block > .ls-block-content-indent > .ls-properties-area .property-pair.property-panel-row-empty:not(:focus-within) { opacity: .5; }
`;
const pencilCss = `
${AREA} .ls-block .bottom-property-edit-icon { display: none !important; }
`;
// Logseq's nesting line is a border in --ls-guideline-color (8% here); only the branch you are in is drawn firmer.
const guidesCss = `
${AREA} .ls-block .block-children-container:is(:hover:not(:has(.block-children-container:hover)), :focus-within:not(:has(.block-children-container:focus-within))) > .block-children { border-left-color: var(--rf-line) !important; }
`;
function applyStyles() {
  sendStyle('refinement-page-look-links', setting('quietLinks') ? linksCss : '');
  sendStyle('refinement-page-look-dates', setting('quietDates') ? datesCss : '');
  sendStyle('refinement-page-look-names', setting('quietNames') ? namesCss : '');
  sendStyle('refinement-page-look-tags', setting('tagsAsClasses') ? tagsCss : '');
  sendStyle('refinement-page-look-capsules', setting('noCapsules') ? capsulesCss : '');
  sendStyle('refinement-page-look-add-property', setting('quietAddProperty') ? addPropertyCss : '');
  sendStyle('refinement-page-look-empty', setting('quietEmptyProps') ? emptyPropsCss : '');
  sendStyle('refinement-page-look-pencil', setting('hideDatePencil') ? pencilCss : '');
  sendStyle('refinement-page-look-guides', setting('indentGuides') ? guidesCss : '');
}

function start() {
  ({ sendStyle, onSettingsChange } = take(window.refinementCore, ['sendStyle', 'onSettingsChange']));
  applyStyles();
  onSettingsChange((now, before) => { if (settingsSchema.some(item => now?.[item.key] !== before?.[item.key])) applyStyles(); });
}
(window.refinementParts ||= []).push({ name: 'page-look', schema: settingsSchema, start, stop: runUnloadTasks });
})();
