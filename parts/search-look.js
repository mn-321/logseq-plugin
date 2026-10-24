/* Loaded by main.js after parts/chrome.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* Logseq's search window, easier to read (docs/LAYERS.md layer 4, docs/history/FINISHING-PROMPT-2026-10-23.md section 5, Phase 2 piece 3,
   step 1 of 5). Logseq's search is Logseq's: its list, its order, its keys and its highlight stay; this part only quiets.
   Two switches:
   - Tidy: no grey bars, a small quiet heading over each group, one weight of text in the rows, a quiet path, the searched
     words bold instead of yellow, the chosen row on the kit's wash, and typing markup ([[ ]], **, a table's pipes) in a
     faint grey through the browser's highlights, so Logseq's own text is never edited.
   - Roomy: the search popover (not the copy kept in the right sidebar) larger, with bigger text, up to three lines of a
     block and the page and parents above a block named in full; key shortcuts only on the row under the pointer, their
     room kept.
   Rebuilt from the resting parts/search.js on the kit's greys (2026-10-23). Left out of the old rules: the plugin's own
   plain page icon, the rewriting of a table's text into " · " and " / " (it edited Logseq's text; the pipes are faded
   instead), the fade-in of new rows and the hidden key hints at the bottom. The other four steps (details, grouping,
   the preview panel, typed filters) and the sidebar search button rest: docs/DECISIONS-AUTONOMOUS.md. Nothing here
   reads the graph. */
const shared = window.refinementShared;
const { host } = shared;
const { warnOnce, onUnload, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (search): ' });
let sendStyle, watchDom, onSettingsChange;
const take = (core, names) => shared.take(core, names, warnOnce);

const settingsSchema = [
  { key: 'searchHeading', type: 'heading', group: 'around', rank: 3, title: 'Search', default: null, icon: 'find',
    legend: 'Logseq’s search window, easier to read',
    zone: '<div class="box">echo</div><div class="m">Pages</div><div><i class="b"></i><b>Echo</b> kickoff</div><div><i class="b"></i><b>Echo</b> budget</div>',
    description: 'Changes here apply right away. Logseq’s results, their order and its keys stay as they are.' },
  { key: 'tidySearch', type: 'boolean', title: 'Tidy the search window', default: true,
    preview: ['<div><i class="b"></i>Kickoff for <span class="hl">Echo</span></div><div><i class="b"></i><span class="hl">Echo</span> budget</div>', '<div><i class="b"></i>Kickoff for <b>Echo</b></div><div><i class="b"></i><b>Echo</b> budget</div>'],
    description: 'Quieter group headings, one weight of text in the results, the searched words in bold instead of yellow, and [[ ]], ** and a table’s | in a faint grey. Off: Logseq’s own look.' },
  { key: 'roomySearch', type: 'boolean', title: 'Roomier search window', default: true,
    preview: ['<div style="font-size:10px;line-height:1.2"><i class="b"></i>Echo kickoff<br><i class="b"></i>Echo budget<br><i class="b"></i>Echo notes</div>', '<div style="font-size:12px"><i class="b"></i>Echo kickoff</div><div style="font-size:12px;margin-top:3px"><i class="b"></i>Echo budget</div>'],
    description: 'A larger search window with bigger text, more room between results, up to three lines of each block, and the page and parent blocks above a result named in full. Key shortcuts beside results show only with the pointer on the row. The search kept in the right sidebar stays as it is. Off: Logseq’s normal size.' },
];
const setting = shared.settingReader(settingsSchema);

// Rows, headings and the box in the kit's greys; Logseq's own marks, order and keys untouched.
const tidyCss = `
.cp__cmdk-input-row { background: transparent !important; border-bottom: 1px solid var(--rf-hair) !important; }
.cp__cmdk-input-row + div { background: transparent !important; }
.cp__cmdk > .hints { background: transparent !important; border-top-color: var(--rf-hair) !important; color: var(--rf-quiet); }
/* Groups: no grey bar, a small quiet heading. */
.cp__cmdk div:has(> .search-results) { border-bottom: 0 !important; padding-bottom: 6px !important; }
.cp__cmdk div:has(> .search-results) > div:first-child:not(.search-results) {
  height: auto !important; padding: 10px 12px 3px !important; background: transparent !important;
  font-size: 12px !important; color: var(--rf-quiet) !important; }
.cp__cmdk div:has(> .search-results) > div:first-child:not(.search-results) .font-bold { font-weight: 500 !important; }
/* Rows: one weight of text, a quiet icon and path, the chosen row and the row under the pointer on the wash. */
.cp__cmdk [data-cmdk-item] { padding: 6px 8px !important; border-radius: 4px !important; }
.cp__cmdk [data-cmdk-item] > .flex.items-start > div:first-child { background: none !important; box-shadow: none !important; color: var(--rf-faint) !important; }
.cp__cmdk [data-cmdk-item] > .text-xs:first-child { color: var(--rf-quiet) !important; }
.cp__cmdk [data-cmdk-item] :is(.breadcrumb a, .cp__cmdk-item-main-text a) { text-decoration: none !important; }
.cp__cmdk [data-cmdk-item] .cp__cmdk-item-main-text { font-weight: 400 !important; }
.cp__cmdk [data-cmdk-item]:is([data-highlighted], [data-kb-highlighted]),
.cp__cmdk [data-cmdk-item][data-hoverable]:hover { background-color: var(--rf-wash) !important; box-shadow: none !important; }
/* The searched words bold, as Logseq's own lists show a match, in place of the yellow block. */
.cp__cmdk mark { background: transparent !important; color: inherit !important; font-weight: 600; padding: 0; border-radius: 0; }
::highlight(refinement-search-markup) { color: color-mix(in srgb, var(--ls-primary-text-color, #888) 45%, transparent); } /* currentColor reads as nothing inside a highlight in dark mode (seen) */
`;

// Only the popover; the copy kept in the right sidebar keeps Logseq's size.
const roomyCss = `
.ls-dialog-cmdk { max-width: min(1100px, 92dvw) !important; }
.ls-dialog-cmdk .cp__cmdk__modal { width: 100% !important; max-width: none !important; }
.ls-dialog-cmdk .cp__cmdk-input-row + div { min-height: 76dvh !important; max-height: 76dvh !important; }
.ls-dialog-cmdk .cp__cmdk-search-input { font-size: 1.3rem !important; padding: 18px 22px !important; }
.ls-dialog-cmdk .cp__cmdk div:has(> .search-results) { padding-bottom: 12px !important; }
.ls-dialog-cmdk .cp__cmdk div:has(> .search-results) > div:first-child:not(.search-results) { padding: 20px 22px 8px 48px !important; font-size: .85rem !important; }
.ls-dialog-cmdk .cp__cmdk .search-results { padding: 0 8px !important; }
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] { padding: 9px 14px !important; gap: 3px !important; }
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] > .flex.items-start { gap: 10px !important; }
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] .cp__cmdk-item-main-text { font-size: .97rem !important; line-height: 1.55 !important; -webkit-line-clamp: 3 !important; }
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] > .text-xs:first-child { font-size: .8rem !important; padding-left: 26px !important; }
/* The page and parents above a block in full; a long path wraps instead of ending in "…". */
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] > .text-xs:first-child,
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] > .text-xs:first-child :is(.breadcrumb, .breadcrumb__segment, .breadcrumb__label) {
  white-space: normal !important; flex-wrap: wrap !important; overflow: visible !important; max-width: none !important; text-overflow: clip !important; }
/* Key shortcuts beside results only on the row under the pointer; they keep their room. */
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item] [data-shortcut-binding] { visibility: hidden !important; }
.ls-dialog-cmdk .cp__cmdk [data-cmdk-item]:hover [data-shortcut-binding] { visibility: visible !important; }
`;

// Typing markup in result text and paths, faded with the browser's highlights (Logseq's text is never edited).
const MARKUP = /\[\[|\]\]|\*\*|__|~~|\^\^|==|`|\|(?:[ \t]*:?-{3,}:?[ \t]*\|)*/g;
const AREAS = '.cp__cmdk [data-cmdk-item] :is(.cp__cmdk-item-main-text, .breadcrumb)';
function fadeMarkup(doc) {
  const win = doc.defaultView;
  if (!win.CSS?.highlights || !win.Highlight) return;
  if (!setting('tidySearch') || !doc.querySelector('.cp__cmdk')) { win.CSS.highlights.delete('refinement-search-markup'); return; }
  const ranges = [];
  for (const area of doc.querySelectorAll(AREAS)) {
    const walker = doc.createTreeWalker(area, win.NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const match of node.nodeValue.matchAll(MARKUP)) {
        const range = doc.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        ranges.push(range);
      }
    }
  }
  win.CSS.highlights.set('refinement-search-markup', new win.Highlight(...ranges));
}

function styles() {
  sendStyle('refinement-search-tidy', setting('tidySearch') ? tidyCss : '');
  sendStyle('refinement-search-roomy', setting('roomySearch') ? roomyCss : '');
}

function start() {
  ({ sendStyle, watchDom, onSettingsChange } = take(window.refinementCore, ['sendStyle', 'watchDom', 'onSettingsChange']));
  window.refinementCore.provided.addTroubleshooting?.({ checks: [['search window', '.cp__cmdk', 'quieter rows, faded markup']] });
  styles();
  watchDom(function fadeSearchMarkup(doc) { fadeMarkup(doc); });
  onSettingsChange((now, before) => {
    if (!settingsSchema.some(item => now?.[item.key] !== before?.[item.key])) return;
    styles(); fadeMarkup(host());
  });
  onUnload(() => host().defaultView.CSS?.highlights?.delete('refinement-search-markup'));
}
(window.refinementParts ||= []).push({ name: 'search-look', schema: settingsSchema, start, stop: runUnloadTasks });
})();
