/* Loaded by main.js after parts/tag-path.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* The words by a page's title (docs/LAYERS.md layer 4, where things sit; the owner, 2026-10-21 and 2026-10-23: "hide
   text but keep space"). Logseq 2.0.2 puts "Add icon" and "Set property" in a row of their own just above the title
   (.ls-page-title-actions, 24 px; seen in the app 2026-10-23) and shows them while the pointer is over the title, so the title area keeps their height
   either way. Here they are never shown and their room is kept, so nothing on the page moves: on Dr. Mei Chen the
   title, its tags and its properties stay exactly where they are. One switch, on by default; off, Logseq's own
   behaviour comes back at once. Nothing is read from the graph and nothing is drawn: one stylesheet. */
const shared = window.refinementShared;
const { warnOnce, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (title row): ' });
let sendStyle, onSettingsChange;
const take = (core, names) => shared.take(core, names, warnOnce);

const settingsSchema = [
  { key: 'titleRowHeading', type: 'heading', group: 'reading', rank: 0, title: 'By the title', default: null, icon: 'page',
    legend: 'Logseq’s “Add icon” and “Set property” words by a title, never shown, their room kept',
    zone: '<div class="m">&nbsp;</div><div class="t">Dr. Mei Chen</div>',
    description: 'Changes here apply right away.' },
  { key: 'hideTitleWords', type: 'boolean', title: 'Leave out “Add icon” and “Set property” by a title', default: true,
    description: 'Logseq shows “Add icon” and “Set property” by a page’s title while the pointer is over it. They are left out and their room kept, so the title and everything below stay where they are. Logseq’s own “+ Add property” under a page’s properties stays. Off: Logseq shows the two words as usual, to use them.' },
];
const setting = shared.settingReader(settingsSchema);

// Logseq's row of words by a page's title, in the main view and the right sidebar; visibility keeps its room.
const css = `
:is(#main-content-container, #right-sidebar) .ls-page-title-actions { visibility: hidden !important; pointer-events: none !important; }`;
const applyStyles = () => sendStyle('refinement-title-row', setting('hideTitleWords') ? css : '');

function start() {
  ({ sendStyle, onSettingsChange } = take(window.refinementCore, ['sendStyle', 'onSettingsChange']));
  window.refinementCore.provided.addTroubleshooting?.({ checks: [['title words', '.ls-page-title-actions', 'the words under a title left out']] });
  applyStyles();
  onSettingsChange((now, before) => { if (settingsSchema.some(item => now?.[item.key] !== before?.[item.key])) applyStyles(); });
}
(window.refinementParts ||= []).push({ name: 'title-row', schema: settingsSchema, start, stop: runUnloadTasks });
})();
