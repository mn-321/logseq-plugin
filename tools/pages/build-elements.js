// Builds docs/ELEMENTS.html: every kind of element the loaded parts draw, with its current variations side by side,
// rendered with the parts' own stylesheets (pulled from the source at build time) and the markup the code builds;
// and, per kind, a recommendation: what to take from Logseq, what from the browser, what the kit must draw itself.
// Run from the repo root: node <this file> <scratchpad dir>
const fs = require('fs'), path = require('path');
const S = process.argv[2];
const css = name => fs.readFileSync(path.join(S, 'css', name + '.css'), 'utf8');
const icons = JSON.parse(fs.readFileSync(path.join(S, 'icons.json'), 'utf8'));
const tabler = JSON.parse(fs.readFileSync(path.join(S, 'tabler.json'), 'utf8'));
const I = key => icons[key];
const T = name => `<i class="ti ti-${name}" aria-hidden="true"></i>`;

const settingsCss = css('settings-panel').replace(/\$\{ITEM_CLASS\}/g, 'refinement-settings-menu-item').replace(/\$\{PANEL_CLASS\}/g, 'refinement-settings-backdrop');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const spec = (part, cls, html, note = '', extra = '') => `
<figure class="spec${extra ? ' ' + extra : ''}">
  <div class="sheet">${html}</div>
  <figcaption><span class="part">${esc(part)}</span><code>${esc(cls)}</code>${note ? `<span class="note">${note}</span>` : ''}</figcaption>
</figure>`;
// A proposed specimen: the same sheet, marked.
const prop = (html, note = '', extra = '') => `
<figure class="spec proposed${extra ? ' ' + extra : ''}">
  <div class="sheet">${html}</div>
  <figcaption><span class="part">proposed</span>${note ? `<span class="note">${note}</span>` : ''}</figcaption>
</figure>`;
// The recommendation card: three lines (use, why, goes) and a verdict chip.
const rec = (verdict, use, why, goes = '') => `
<aside class="rec">
  <div class="verdict ${verdict.toLowerCase().replace(/[^a-z]+/g, '-')}">${esc(verdict)}</div>
  <dl>
    <dt>Use</dt><dd>${use}</dd>
    <dt>Why</dt><dd>${why}</dd>
    ${goes ? `<dt>Goes</dt><dd>${goes}</dd>` : ''}
  </dl>
</aside>`;

const section = (id, title, ways, intro, specs, after = '', recommendation = '', proposals = []) => `
<section id="${id}">
  <h2>${esc(title)} <span class="ways">${ways}</span></h2>
  <p class="intro">${intro}</p>
  <h3>Today</h3>
  <div class="row">${specs.join('')}</div>
  ${after}
  ${recommendation}
  ${proposals.length ? `<h3 class="go">${proposals.length > 1 ? `Proposed: one design, shown in ${proposals.length} pieces` : 'Proposed'}</h3><div class="row">${proposals.join('')}</div>` : ''}
</section>`;

// ---------- Specimens: today ----------
const popTagMenu = `<div class="rf-pop refinement-tags-menu" role="menu" style="width:260px">
  <div class="rtg-mh rf-pop-head">#Consultation</div>
  <button role="menuitem">Rename <kbd>r</kbd></button>
  <button role="menuitem">New tag inside <kbd>n</kbd></button>
  <button role="menuitem">Also put under … <kbd>a</kbd></button>
  <hr>
  <button role="menuitem">Open the page</button>
</div>`;
const popTwoWayMenu = `<div class="rf-pop refinement-two-way-add" style="width:220px">
  <div class="rf-pop-head">provider of</div>
  <div class="rf-pop-row rf-on"><span>Date first</span><span class="rf-pop-kind">✓</span></div>
  <div class="rf-pop-row"><span>Name first</span></div>
  <hr>
  <div class="rf-pop-row"><span>Rename how it reads…</span></div>
</div>`;
const popLink = `<div class="refinement-link-text rf-pop" role="listbox" style="width:300px">
  <div class="rlt-head rf-pop-head">Link “Mei”</div>
  <div class="rlt-field rf-pop-field"><span class="rlt-typed">Mei</span><span class="rlt-caret"></span></div>
  <div class="rf-pop-row rf-on"><span class="rlt-title">Dr. Mei Chen</span><span class="rf-pop-kind">#Doctor</span></div>
  <div class="rf-pop-row"><span class="rlt-title">Mei’s clinic notes</span><span class="rf-pop-kind">page</span></div>
  <div class="rlt-none rf-pop-note">Enter links the row that is lit</div>
</div>`;
const popPickTag = `<div class="rf-pop refinement-tags-menu" role="menu" style="width:260px">
  <div class="rtg-mh rf-pop-head">Also put #Scan under…</div>
  <input type="text" value="Pro" placeholder="Find a tag" spellcheck="false">
  <div class="rf-pop-list"><button>#Procedure</button><button>#Process note</button></div>
</div>`;

const dlgKit = `<div class="rf-dialog" style="width:320px"><h2>Delete 3 records?</h2><p>They go to Logseq’s Recycle.</p><div class="rf-btns"><button class="rf-btn">Cancel</button><button class="rf-btn rf-go">Delete</button></div></div>`;
const dlgAnchored = `<div class="rf-dialog rf-anchored refinement-two-way-ask" style="width:300px"><label>Change “Dr. Mei Chen” to…</label><input type="text" value="" placeholder="Another page"><div class="refinement-prompt-hint">Enter sets it on the 3 picked records</div><div class="rf-btns"><button class="rf-btn">Cancel</button><button class="rf-btn rf-go">OK</button></div></div>`;
const dlgTags = `<div class="rf-dialog rf-anchored refinement-tags-dialog" style="width:100%;max-width:440px"><h2>Turn Topic into links to pages</h2><div class="rtg-namefield"><span class="rtg-note">New property</span><input type="text" value="Topic"></div><div class="rtg-namefield"><span class="rtg-note">Pages tagged</span><input type="text" value="Topic kind"><button class="rtg-make">Pick…</button></div><p class="rtg-note rtg-warn">A property named Topic is there already.</p><div class="rf-btns"><button class="rf-btn">Cancel</button><button class="rf-btn rf-go" disabled>Turn into links</button></div></div>`;
const dlgSettings = `<div class="refinement-settings" style="width:100%;max-width:420px;border:1px solid var(--rf-line,#ccc);border-radius:10px;overflow:hidden">
  <header class="rs-head" style="display:flex;align-items:center;gap:8px;padding:10px 12px"><div class="rs-find"><input type="text" placeholder="Find a setting"><kbd>/</kbd>${I('settings-panel.js:SEARCH_ICON')}</div><button class="rs-close" aria-label="Close">×</button></header>
  <div class="rs-body">
    <div class="rs-row"><div class="rs-main" style="flex:1"><div class="rs-title">Two-way links <span class="rs-tag">after reload</span></div><div class="rs-desc">Show, on a page, every record whose property points at it.</div></div><div class="rs-control"><button class="rs-switch" role="switch" aria-checked="true"></button></div></div>
    <div class="rs-row"><div class="rs-main" style="flex:1"><div class="rs-title">Order of names</div></div><div class="rs-control"><div class="rs-choices" role="group"><button aria-pressed="true">Date first</button><button>Name first</button></div></div></div>
  </div></div>`;
const dlgDiag = `<div class="rf-dialog" style="width:340px"><h2>Troubleshooting tools of the Refinements plugin. None of them changes your notes.</h2><div style="display:flex;flex-direction:column;gap:6px;margin:10px 0;"><button style="text-align:left;padding:6px 12px;border:1px solid var(--rf-ui-field);border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer;">Copy performance report</button><button style="text-align:left;padding:6px 12px;border:1px solid var(--rf-ui-field);border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer;">Check what the plugin finds on this page</button></div><div class="rf-btns"><button class="rf-btn">Close</button></div></div>`;

const btn = (html, wrap = '') => wrap ? `<div class="${wrap}" style="display:inline-block">${html}</div>` : html;
const buttons = [
  spec('kit', '.rf-btn', `<button class="rf-btn">Cancel</button>`, 'plain'),
  spec('kit', '.rf-btn.rf-go', `<button class="rf-btn rf-go">OK</button>`, 'the one that does it'),
  spec('tag map', '.rtg-tool', btn(`<button class="rtg-tool">Unfold</button>`, 'refinement-tags'), 'tool, no edge'),
  spec('tag map', '.rtg-make', btn(`<button class="rtg-make">+ New tag</button>`, 'refinement-tags'), 'dashed edge'),
  spec('tag map', '.rtg-act', btn(`<button class="rtg-act">${I('tags-graph.js:PLUS')}</button><button class="rtg-act">${I('tags-graph.js:DOTS')}</button>`, 'refinement-tags'), 'icon only, on hover'),
  spec('tag map', '.rtg-addline', btn(`<div class="rtg-adds" style="opacity:1;padding-left:0"><button class="rtg-addline">+ Property</button><button class="rtg-addline">+ Tag inside</button></div>`, 'refinement-tags'), 'bare words'),
  spec('two-way rows', '.rf-tw-bar button', `<div class="refinement-two-way"><div class="rf-tw-bar" style="position:static"><button type="button">Sidebar</button><button type="button">Copy</button></div></div>`, 'in the picking bar'),
  spec('settings', '.rs-reset', btn(`<button class="rs-reset" style="opacity:1;visibility:visible;display:inline">Reset</button>`, 'refinement-settings rs-bare'), 'underlined words'),
  spec('settings', '.rs-close', btn(`<button class="rs-close">×</button>`, 'refinement-settings rs-bare'), 'a bare ×'),
  spec('troubleshooting', 'style="…"', `<button style="text-align:left;padding:6px 12px;border:1px solid var(--rf-ui-field);border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer;">Copy warnings</button>`, 'inline style, no class'),
];
const finds = [
  spec('tag map', '.rtg-find', `<div class="refinement-tags"><header style="border:0;padding:0"><input class="rtg-find" type="text" placeholder="Find a tag or property"></header></div>`, 'the map’s own'),
  spec('settings', '.rs-find', `<div class="refinement-settings"><div class="rs-find">${I('settings-panel.js:SEARCH_ICON')}<input type="text" placeholder="Find a setting"><kbd>/</kbd></div></div>`, 'icon and a key hint'),
  spec('link selected text', '.rlt-field', `<div class="refinement-link-text rf-pop" style="width:260px;padding:6px"><div class="rlt-field rf-pop-field"><span class="rlt-placeholder">Type a page’s name</span><span class="rlt-caret"></span></div></div>`, 'not a real field: drawn text and a drawn caret'),
  spec('tag map menus', '.rf-pop input', `<div class="rf-pop refinement-tags-menu" style="width:240px"><div class="rtg-mh rf-pop-head">Add a property to #Doctor</div><input type="text" placeholder="Find a property"></div>`, 'the kit’s field in a menu'),
  spec('two-way rows, settings', '<datalist>', `<div class="rf-dialog rf-anchored" style="width:260px"><label>Give them all a tag</label><input type="text" list="dl1" placeholder="Pick or type"><datalist id="dl1"><option value="Doctor"><option value="Nurse"></datalist></div>`, 'the browser’s own drop-down'),
];
const ticks = [
  spec('two-way rows', '.rf-tw-pick', `<div class="refinement-two-way" style="padding-left:20px"><span class="rf-tw-pick" role="checkbox" aria-checked="false" style="position:static;visibility:visible"></span> &nbsp; <span class="rf-tw-pick" role="checkbox" aria-checked="true" data-on style="position:static;visibility:visible"></span></div>`, 'off, on'),
  spec('tag map, two-way menus', '“✓” as text', `<div class="rf-pop" style="width:200px;position:static"><div class="rf-pop-row rf-on"><span>#Doctor</span><span class="rf-pop-kind">✓</span></div><div class="rf-pop-row"><span>#Nurse</span></div></div>`, 'a tick typed as a character'),
  spec('settings', '.rs-switch', `<div class="refinement-settings" style="display:flex;gap:12px"><button class="rs-switch" role="switch" aria-checked="false"></button><button class="rs-switch" role="switch" aria-checked="true"></button></div>`, 'a sliding switch'),
  spec('tag map', '.rtg-i', `<div class="refinement-tags" style="display:flex;gap:10px;align-items:center"><button class="rtg-i" aria-pressed="false">i</button><button class="rtg-i" aria-pressed="true">i</button></div>`, 'pressed or not; serif i'),
];
const segs = [
  spec('tag map', '.rtg-switch', `<div class="refinement-tags"><div class="rtg-switch" role="group"><button class="rtg-tool rtg-by" aria-pressed="true">Tags</button><button class="rtg-tool rtg-by" aria-pressed="false">Properties</button></div></div>`),
  spec('settings', '.rs-choices', `<div class="refinement-settings"><div class="rs-choices" role="group"><button aria-pressed="true">Date first</button><button>Name first</button></div></div>`),
];
const chips = [
  spec('tag map', '.rtg-onchip', `<div class="refinement-tags"><span class="rtg-onlist"><span class="rtg-onchip"><span class="rtg-ontag">#Consultation</span><button class="rtg-onx" style="opacity:1">×</button></span> &nbsp; <span class="rtg-onchip"><span class="rtg-ontag">#Visit</span><button class="rtg-onx" style="opacity:1">×</button></span></span></div>`, 'bold name, × on hover'),
  spec('settings', '.rs-chip', `<div class="refinement-settings"><span class="rs-chip"><span>Illness Test Graph</span><button>×</button></span> <span class="rs-chip"><span>Seed Check</span><button>×</button></span></div>`, 'washed box, × on hover'),
  spec('two-way rows', '.rf-tw-chip', `<div class="refinement-two-way"><div class="rf-tw-chips"><a class="rf-tw-chip" data-on href="#">All 9</a><a class="rf-tw-chip" href="#">Consultation 6</a><a class="rf-tw-chip" href="#">Decision 3</a></div></div>`, 'filter pills, one lit'),
  spec('tag map', '.rtg-kind', `<div class="refinement-tags"><span class="rtg-ptype"><span class="rtg-kind">link</span> <span class="rtg-tv"><b>#</b>Doctor, <b>#</b>Nurse</span> <span class="rtg-kind">several</span></span> &nbsp; <span class="rtg-ptype"><span class="rtg-kind">date</span></span></div>`, 'what a property holds'),
  spec('two-way rows', '.rf-tw-tag', `<div class="refinement-two-way"><a class="rf-tw-tag tag" href="#">#Consultation</a> <span class="rf-tw-tag">note</span></div>`, 'a tag as Logseq’s own #tag, or quiet text'),
  spec('settings', '.rs-tag', `<div class="refinement-settings"><span class="rs-title">Two-way links <span class="rs-tag">after reload</span></span></div>`, 'a small note pill'),
];
const bars = [
  spec('two-way rows', '.rf-tw-bar', `<div class="refinement-two-way"><div class="rf-tw-bar" style="position:static;transform:none"><button type="button" class="rf-tw-bar-count"><span class="rf-tw-pick" data-on style="position:static;visibility:visible"></span>Picked: 3</button><button type="button">Sidebar</button><button type="button">Change “Dr. Mei Chen” to…</button><button type="button">Remove “Dr. Mei Chen”</button><button type="button">#</button><button type="button">Copy</button><button type="button">Set property</button><button type="button">Unset property</button><button type="button">${I('two-way.js:TRASH')}</button></div></div>`, 'eight actions, trash as an icon'),
  spec('tag map', '.rtg-pickbar', `<div class="refinement-tags"><div class="rtg-pickbar" style="position:static"><span class="rtg-pickcount">2 picked</span><button class="rtg-tool rtg-pickgo">To the top level</button><button class="rtg-tool">Move to …</button><button class="rtg-tool">Clear</button></div></div>`, 'three actions, tool buttons'),
];
const pluses = [
  spec('two-way rows', '.rf-tw-add', `<div class="refinement-two-way"><div class="rf-tw-row"><div class="rf-tw-name">provider of<span class="rf-tw-arrow">→</span></div><div class="rf-tw-value"><span class="rf-tw-item rf-tw-datefirst"><span class="rf-tw-day">12 Aug</span><span class="rf-tw-namecell"><a class="rf-tw-record" href="#">Follow-up on the scan</a><a class="rf-tw-add" href="#" style="opacity:1">+</a></span><a class="rf-tw-tag tag" href="#">#Consultation</a></span></div></div></div>`, 'a + after the last node, shown on hover', 'wide'),
  spec('two-way rows', '.rf-tw-draft', `<div class="refinement-two-way"><div class="rf-tw-row"><div class="rf-tw-name">provider of<span class="rf-tw-arrow">→</span></div><div class="rf-tw-value"></div><div class="rf-tw-draft rf-tw-drafting"><span class="rf-tw-draft-plus">+</span><span class="rf-tw-draft-main"><input type="text" class="rf-tw-draft-field rf-tw-draft-name" placeholder="Add a Consultation"></span><a class="rf-tw-tag tag rf-tw-draft-tag" href="#">#Consultation</a></div></div></div>`, 'the line that opens after the +', 'wide'),
  spec('tag map', '.rtg-adds', `<div class="refinement-tags"><div class="rtg-adds" style="opacity:1"><button class="rtg-addline">+ Property</button><button class="rtg-addline">+ Tag inside</button><button class="rtg-addline">+ Description</button></div></div>`, 'faint words under an open tag'),
  spec('tag map', '.rtg-make', `<div class="refinement-tags"><div class="rtg-newroot"><button class="rtg-make">+ New tag</button></div></div>`, 'dashed button at the bottom'),
  spec('tag map', '.rtg-act (PLUS)', `<div class="refinement-tags"><span class="rtg-acts" style="display:inline-flex;opacity:1"><button class="rtg-act">${I('tags-graph.js:PLUS')}</button></span></div>`, 'an icon on the row, on hover'),
];
const peek = [
  spec('two-way rows', '.refinement-two-way-peek', `<div class="refinement-two-way-peek rf-pop" style="position:static;width:300px"><div class="rf-tw-peek-title"><span class="rf-tw-peek-open">Follow-up on the scan</span></div><div class="rf-tw-peek-meta"><span class="rf-tw-peek-open">#Consultation</span> · 12 Aug</div><div class="rf-tw-peek-fields"><span class="rf-tw-peek-name">Provider</span><span>Dr. Mei Chen</span><span class="rf-tw-peek-name">Topic</span><span>Scan results</span></div><div class="rf-tw-peek-lines"><div class="rf-tw-peek-line">Scan looked stable, next one in October.</div></div></div>`, 'the only card; every piece opens something'),
  spec('everything else', 'title="…"', `<div class="tooltip-mock"><span class="tip-anchor">Spoke with</span><span class="tip">Open the “Spoke with” field</span></div>`, 'the browser’s own tooltip, after a pause: on a Mac a neutral grey box in the system’s colours, drawn by the system, not the plugin'),
];
const glyph = (part, name, html, note = '') => `<div class="glyph"><div class="g">${html}</div><div class="gl"><span class="part">${esc(part)}</span><code>${esc(name)}</code>${note ? `<span class="note">${note}</span>` : ''}</div></div>`;
const iconsHtml = `<div class="glyphs">
${glyph('kit', 'UNDO_ICON', I('shared.js:UNDO_ICON'), 'not shared with the parts')}
${glyph('tag map', 'TREE_ICON', I('tags-graph.js:TREE_ICON'))}
${glyph('tag map', 'SIDEBAR_ICON', I('tags-graph.js:SIDEBAR_ICON'))}
${glyph('tag map', 'PAGE_ICON', I('tags-graph.js:PAGE_ICON'))}
${glyph('tag map', 'CHEVRON', I('tags-graph.js:CHEVRON'), 'drawn')}
${glyph('two-way rows', '.rf-tw-chevron', `<div class="refinement-two-way" style="display:inline-block"><span class="rf-tw-chevron" style="opacity:1"></span></div>`, 'cut from a square in CSS')}
${glyph('tag map', 'PLUS', I('tags-graph.js:PLUS'), 'drawn')}
${glyph('tag map, two-way rows', '“+” as text', `<span style="font-size:18px">+</span>`, 'typed')}
${glyph('tag map', 'DOTS', I('tags-graph.js:DOTS'), 'drawn')}
${glyph('tag map', '“⋯” as text', `<span style="font-size:18px">⋯</span>`, 'typed, group menu')}
${glyph('two-way rows', 'TRASH', I('two-way.js:TRASH'))}
${glyph('settings', 'SLIDERS_ICON', `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I('settings-panel.js:SLIDERS_ICON')}</svg>`, 'a bare path, wrapped where used')}
${glyph('settings', 'SEARCH_ICON', I('settings-panel.js:SEARCH_ICON'))}
${glyph('two-way rows', '“⇥” as text', `<span style="font-size:18px">⇥</span>`, 'open in sidebar')}
${glyph('tag map, settings', '“×” as text', `<span style="font-size:18px">×</span>`, 'remove, close')}
${glyph('tag map, two-way', '“✓” as text', `<span style="font-size:18px">✓</span>`, 'chosen')}
${glyph('tag map', '“i” in a serif', `<div class="refinement-tags" style="display:inline-block"><button class="rtg-i">i</button></div>`, 'help')}
${glyph('two-way rows', '“→” as text', `<span style="font-size:18px">→</span>`, 'after a row’s name')}
</div>`;
const undos = [
  spec('kit', '.rf-undo', `<span>Provider: Dr. Mei Chen <span class="rf-undo" role="button" style="opacity:.28">${I('shared.js:UNDO_ICON')}</span></span>`, 'faded arrow at the end of what changed'),
  spec('kit', '.rf-undo-docked', `<div class="rf-undo-dock" style="position:static;align-items:flex-start"><span class="rf-undo rf-undo-docked">${I('shared.js:UNDO_ICON')}<span class="rf-undo-words">Deleted 3 records</span></span></div>`, 'waiting at the bottom right-hand corner when nothing is left on screen to sit beside, with its words; a click takes the change back'),
  spec('kit, used by no loaded part', '.refinement-undo-bar', `<div class="refinement-undo-bar" style="position:static;transform:none"><span>Spoke with is now Dr. Mei Chen</span><button type="button">Undo</button></div>`, 'the old bar, still in the code; to be deleted'),
];
const ghost = [
  spec('proposals', '.rfs-ghost', `<div class="ls-block" style="font-size:14px"><div class="positioned-properties block-below flex flex-col gap-1 text-sm"><div class="bottom-properties-row" style="display:flex;gap:10px;flex-wrap:wrap"><span class="bottom-property-pill"><span class="property-key-inner" style="opacity:.7">Provider:</span> <span class="bottom-property-content"><span class="empty-value"><span class="rfs-ghost">Dr. Mei Chen</span></span></span></span><span class="bottom-property-pill"><span class="property-key-inner" style="opacity:.7">Topic:</span> <span class="bottom-property-content"><span class="empty-value"><span class="rfs-ghost rfs-guess">Scan results</span></span></span></span></div></div></div>`, 'sure: italic grey; a guess: dotted line too'),
  spec('proposals', '.rfs-made-pill', `<div class="ls-block" style="font-size:14px"><div class="positioned-properties block-below flex flex-col gap-1 text-sm rfs-made"><div class="bottom-properties-row" style="display:flex;gap:10px"><span class="bottom-property-pill rfs-made rfs-made-pill"><span class="rfs-made-name">Tags:</span><span class="bottom-property-content"><span class="rfs-ghost rfs-guess">#Consultation</span></span></span></div></div></div>`, 'a pill the plugin makes to look like Logseq’s'),
];
const help = [
  spec('tag map', '.rtg-guide', `<div class="refinement-tags"><div class="rtg-guide" role="note" style="margin-left:0"><p><b>What this means.</b> Every node tagged #Consultation gets an empty Provider to fill in.</p><p><b>Which way to link.</b> Put the property on the side that has one answer.</p></div></div>`, 'opens under the i button'),
  spec('kit', '.rf-pop-note', `<div class="rf-pop" style="position:static;width:260px"><div class="rf-pop-note">Everywhere it is used. Enter to rename, Esc to leave it.</div></div>`, 'a quiet line in a pop-up'),
  spec('kit', '.refinement-prompt-hint', `<div class="rf-dialog rf-anchored" style="width:260px"><label>Rename</label><input type="text" value="Provider"><div class="refinement-prompt-hint">Enter renames it everywhere</div></div>`, 'a quiet line in a dialog'),
  spec('tag map', '.rtg-note', `<div class="refinement-tags"><span class="rtg-note">Shows up here as</span> <span class="rtg-ptr">provider of</span> <span class="rtg-small">also on 2 other tags</span></div>`, 'quiet words on a row'),
];

// ---------- Specimens: proposed (a sketch of the kit after the change, drawn with the .px- classes below).
// The owner's grammar: fade away; tell things apart by weight and grey, not boxes; no pills, no fills; an action in
// stages, one thing appearing after the other; a pop-up looks like Logseq's own [[ menu. ----------
const pxMenu = `<div class="px-pop" style="width:230px"><div class="px-head">#Consultation</div><button class="px-item">${T('cursor-text')}Rename<kbd>r</kbd></button><button class="px-item">${T('plus')}New tag inside<kbd>n</kbd></button><button class="px-item">${T('hierarchy')}Also put under…<kbd>a</kbd></button><hr><button class="px-item">${T('file-text')}Open the page</button></div>`;
const pxMenuCheck = `<div class="px-pop" style="width:210px"><div class="px-head">provider of</div><button class="px-item px-on">Date first<span class="px-end">${T('check')}</span></button><button class="px-item">Name first</button><hr><button class="px-item">Rename how it reads…</button></div>`;
const pxList = `<div class="px-pop" style="width:240px"><div class="px-head">Also put #Scan under…</div><div class="px-field"><input type="text" value="Pro" placeholder="Find a tag"></div><button class="px-item px-on">#Procedure</button><button class="px-item">#Process note</button></div>`;
const pxDialog = `<div class="px-pop" style="width:300px;padding:8px 10px"><div class="px-ask">Delete 3 records?</div><div class="px-note">They go to Logseq’s Recycle.</div><div class="px-btns"><button class="px-quiet">Cancel</button><button class="px-go">Delete</button></div></div>`;
const pxButtons = `<div class="px-line"><button class="px-quiet">Cancel</button><button class="px-go">Delete</button><button class="px-quiet">Unfold</button><button class="px-quiet">${T('dots')}</button><button class="px-quiet">${T('x')}</button><button class="px-quiet px-faint">+ Property</button></div>`;
const pxField = `<div class="px-line" style="flex-direction:column;align-items:stretch;gap:14px"><div class="px-field"><input type="text" placeholder="Find a tag or property"></div><div class="px-field">${T('search')}<input type="text" placeholder="Find a setting"><kbd>/</kbd></div></div>`;
const pxTicks = `<div class="px-line"><label class="px-tick"><input type="checkbox"> Picked</label><label class="px-tick"><input type="checkbox" checked> Picked</label><label class="px-tick"><input type="checkbox" checked> Two-way links</label></div>`;
const pxLong = (() => { const rows = [["12 Aug","Follow-up on the scan","Consultation",true],["9 Aug","Bloods before cycle 5","Report",false],["2 Aug","Cycle 4 given","Treatment",true],["28 Jul","Nausea after cycle 4","Symptom Log",false],["21 Jul","Asked about tingling fingers","Conversation",false],["14 Jul","Decision on oxaliplatin dose","Decision",true],["7 Jul","Cycle 3 given","Treatment",false],["30 Jun","Port check","Procedure",false],["23 Jun","Scan results explained","Consultation",false],["16 Jun","Cycle 2 given","Treatment",false],["9 Jun","Fatigue most of the week","Symptom Log",false],["2 Jun","Cycle 1 given","Treatment",false]];
  return `<div class="px-longlist"><div class="px-bar"><span class="px-count"><input type="checkbox" checked> 3 of 12 picked</span><button class="px-quiet">${T("layout-sidebar-right")}Sidebar</button><button class="px-quiet">Change “Dr. Mei Chen” to…</button><button class="px-quiet">${T("tag")}Tag</button><button class="px-quiet">${T("trash")}</button><button class="px-quiet px-faint">Clear</button></div>${rows.map(([d,n,t,on]) => `<div class="px-row${on ? " px-row-on" : ""}"><input type="checkbox"${on ? " checked" : ""} aria-label="Pick"><span class="px-day">${d}</span><a class="px-record" href="#">${n}</a><a class="tag px-lstag" href="#">${t}</a></div>`).join("")}<div class="px-note" style="margin-top:6px">show all 27</div></div>`; })();
const pxSeg = `<div class="px-line"><div class="px-seg"><button class="px-quiet" aria-pressed="true">Tags</button><button class="px-quiet">Properties</button></div><div class="px-seg"><button class="px-quiet" aria-pressed="true">Date first</button><button class="px-quiet">Name first</button></div></div>`;
const pxTag = `<div class="px-line"><span>Follow-up on the scan</span> <a class="tag px-lstag" href="#">Consultation</a></div>`;
const pxRemovable = `<div class="px-line"><span class="px-note" style="margin-right:4px">Graphs:</span><span class="px-chip">Illness Test Graph<button>${T('x')}</button></span><span class="px-chip px-hovered">Seed Check<button style="opacity:1">${T('x')}</button></span></div>`;
const pxFilter = `<div class="px-line"><span class="px-chip" aria-pressed="true">All 9</span><span class="px-chip">Consultation 6</span><span class="px-chip">Decision 3</span></div>`;
const pxKinds = `<div class="px-line" style="flex-direction:column;align-items:flex-start;gap:6px"><div class="px-proprow" style="padding-left:0"><span class="px-kindicon" title="A link to a node">${T('arrow-right')}</span><span class="px-pname">Provider</span><a class="tag px-lstag" href="#">Doctor</a>, <a class="tag px-lstag" href="#">Nurse</a></div><div class="px-proprow" style="padding-left:0"><span class="px-kindicon" title="A link to a node">${T('arrow-right')}</span><span class="px-pname">Topic</span><a class="tag px-lstag" href="#">Topic kind</a> <span class="px-kindicon" title="Several values">${T('stack-2')}</span></div><div class="px-proprow" style="padding-left:0"><span class="px-kindicon" title="A date">${T('calendar')}</span><span class="px-pname">Date</span></div><div class="px-proprow" style="padding-left:0"><span class="px-kindicon" title="A choice">${T('select')}</span><span class="px-pname">Status</span><span class="px-plainv">Open · Met · Closed</span></div></div>`;
const pxBar = `<div class="px-bar"><span class="px-count"><input type="checkbox" checked> 3 picked</span><button class="px-quiet">${T('layout-sidebar-right')}Sidebar</button><button class="px-quiet">Change “Dr. Mei Chen” to…</button><button class="px-quiet">${T('tag')}Tag</button><button class="px-quiet">${T('copy')}Copy</button><button class="px-quiet">${T('trash')}</button><button class="px-quiet px-faint">Clear</button></div>`;
const pxPlus = `<div class="px-line" style="flex-direction:column;align-items:stretch;gap:4px"><div class="px-twline"><span class="px-rowname">provider of ${T('arrow-right')}</span><span class="px-day">12 Aug</span><span class="px-cell"><a href="#" class="px-record">Follow-up on the scan</a><button class="px-quiet px-faint">+</button></span><a class="tag px-lstag" href="#">Consultation</a></div><div class="px-twline"><span class="px-rowname" style="visibility:hidden">provider of</span><span class="px-day"></span><span class="px-field px-inline"><span class="px-faint">+</span><input type="text" placeholder="Add a Consultation"></span><a class="tag px-lstag" href="#">Consultation</a></div><div style="margin-top:8px"><button class="px-quiet px-faint">+ Property</button><button class="px-quiet px-faint">+ Tag inside</button><button class="px-quiet px-faint">+ Description</button></div></div>`;
const pxPeek = `<div class="px-pop px-peek" style="width:300px"><div class="px-peek-title">Follow-up on the scan</div><div class="px-note"><a class="tag px-lstag" href="#">Consultation</a> · 12 Aug</div><div class="px-peek-fields"><span class="px-pname">Provider</span><span>Dr. Mei Chen</span><span class="px-pname">Topic</span><span>Scan results</span></div><div class="px-peek-lines">Scan looked stable, next one in October.</div></div>`;
const pxHelp = `<div class="px-line" style="flex-direction:column;align-items:stretch"><div class="px-note">Everywhere it is used. Enter to rename, Esc to leave it.</div><div class="px-guide"><p><b>What this means.</b> Every node tagged #Consultation gets an empty Provider to fill in.</p></div></div>`;

// An action in stages: adding a property to a tag in the tag map, one thing appearing after the other.
const stageRow = (extra = '') => `<div class="px-tagrow"><span class="px-chev">${T('chevron-down')}</span><b>Consultation</b> <span class="px-faint">2 properties</span></div><div class="px-proprow"><span class="px-kindicon">${T('arrow-right')}</span><span class="px-pname">Provider</span><a class="tag px-lstag" href="#">Doctor</a></div><div class="px-proprow"><span class="px-kindicon">${T('arrow-right')}</span><span class="px-pname">Topic</span><a class="tag px-lstag" href="#">Topic kind</a></div>${extra}`;
const stage1 = stageRow(`<div class="px-adds px-adds-hover"><button class="px-quiet px-faint">+ Property</button><button class="px-quiet px-faint">+ Tag inside</button></div>`);
const stage2 = stageRow(`<div class="px-proprow"><span class="px-field px-inline" style="min-width:160px"><input type="text" value="Follow-up"></span><span class="px-note">Enter</span></div>`);
const stage3 = stageRow(`<div class="px-proprow"><span class="px-pname">Follow-up</span><span class="px-pick"><button class="px-quiet">${T('letter-case')}text</button><button class="px-quiet">${T('123')}number</button><button class="px-quiet" aria-pressed="true">${T('calendar')}date</button><button class="px-quiet">${T('arrow-right')}link</button><button class="px-quiet">${T('select')}choice</button></span></div>`);
const stage4 = stageRow(`<div class="px-proprow"><span class="px-kindicon">${T('calendar')}</span><span class="px-pname">Follow-up</span><span class="px-undo">${T('arrow-back-up')}</span></div>`);
const stagesHtml = `<div class="stages">
  <figure class="spec proposed"><div class="sheet">${stage1}</div><figcaption><span class="part">1</span><span class="note">The pointer rests on the tag: faint words appear under its properties.</span></figcaption></figure>
  <figure class="spec proposed"><div class="sheet">${stage2}</div><figcaption><span class="part">2</span><span class="note">“+ Property” pressed: a line opens in place to type the name. Nothing else changes.</span></figcaption></figure>
  <figure class="spec proposed"><div class="sheet">${stage3}</div><figcaption><span class="part">3</span><span class="note">Enter: the kinds appear on the same line as quiet words with their icons; arrows or a click pick one.</span></figcaption></figure>
  <figure class="spec proposed"><div class="sheet">${stage4}</div><figcaption><span class="part">4</span><span class="note">Enter again: the property is made through Logseq’s own box and takes its row, with a faded Undo arrow. No window at any point.</span></figcaption></figure>
</div>`;

const proposedIcons = [
  ['Undo', 'arrow-back-up', 'the faded arrow, as now'],
  ['Open in the sidebar', 'layout-sidebar-right', 'for ⇥ and SIDEBAR_ICON'],
  ['Open as a page', 'file-text', 'for PAGE_ICON'],
  ['Fold, unfold', 'chevron-right', 'turns down when open; one chevron for both parts'],
  ['Add', 'plus', 'only inside a button that says what it adds'],
  ['More', 'dots', 'for DOTS and “⋯”'],
  ['Delete', 'trash', 'as now'],
  ['Find', 'search', 'in every find box'],
  ['Settings, tools', 'adjustments-horizontal', 'for SLIDERS_ICON'],
  ['Close, remove', 'x', 'for every “×”'],
  ['Chosen, on', 'check', 'for every “✓”'],
  ['What this means', 'info-circle', 'for the serif “i”'],
  ['Tag map', 'hierarchy', 'the toolbar button, for TREE_ICON'],
  ['A tag', 'tag', 'in menus that act on tags; never a # (a tag reads as a class)'],
  ['A property', 'forms', 'in menus that act on properties: a field with its line, not a to-do list'],
  ['Rename', 'cursor-text', 'in menus: a text cursor, lighter than a pencil'],
  ['Copy', 'copy', 'in the picking bar'],
  ['Points to', 'arrow-right', 'after a two-way row’s name, for “→”'],
  ['Picked', 'square-check', 'the picking bar’s count'],
  ['Warning', 'alert-triangle', 'a note that stops something'],
  ['Show, hide nodes', 'eye', 'with eye-off, the Nodes line'],
  ['Shortcut', 'keyboard', 'the settings window’s shortcut group'],
  ['Points to a node', 'arrow-right', 'a kind of value, on the property’s row: the same arrow as after a two-way row’s name, “points to”; not the [[ ]] of a link in the words, not an arrow leaving'],
  ['A date', 'calendar', 'a kind of value'],
  ['Text', 'letter-case', 'a kind of value'],
  ['A number', '123', 'a kind of value'],
  ['A choice', 'select', 'a kind of value: a box with a chevron, as Logseq’s own choice field (you: the list icon “looks like a list”)'],
  ['Several values', 'stack-2', 'a property that holds more than one'],
  ['Yes or no', 'checkbox', 'a kind of value'],
  ['A web address', 'world', 'a kind of value'],
];
const proposedIconsHtml = `<div class="glyphs">${proposedIcons.map(([what, name, note]) => `<div class="glyph"><div class="g">${T(name)}</div><div class="gl"><span class="part">${esc(what)}</span><code>ti-${esc(name)}</code><span class="note">${esc(note)}</span></div></div>`).join('')}</div>`;

// ---------- Tables ----------
const behind = `
<table class="behind">
<thead><tr><th>Done behind the scenes</th><th>Ways today</th><th>Where</th><th>Proposed</th></tr></thead>
<tbody>
<tr><td>Putting a box under what it belongs to</td><td>5</td><td>the kit’s placeBelow; the tag map’s placeMenu; the choices panel; the hover card’s own; the link box’s own</td><td>0 of the plugin’s own: the browser places pop-ups (anchor positioning) and flips them when there is no room</td></tr>
<tr><td>Closing a box on Escape or a click outside</td><td>3</td><td>the kit’s modal; the tag map’s anchoredPanel; the settings window</td><td>0: the browser does it for a dialog and a popover</td></tr>
<tr><td>Waiting for Logseq to draw something</td><td>3</td><td>the kit’s waitFor; the tag map’s; an older one in the Properties view</td><td>1, in layer 1</td></tr>
<tr><td>Pressing one of Logseq’s own buttons</td><td>2</td><td>the tag map (Add property, Add choice); the proposals (a value’s trigger)</td><td>1 door in layer 1: press, type, wait</td></tr>
<tr><td>Typing into one of Logseq’s fields</td><td>3</td><td>the tag map, twice; the proposals</td><td>the same door</td></tr>
<tr><td>Showing a notice at the top</td><td>2</td><td>the kit’s notify; Logseq’s own showMsg called directly, about 23 times in the tag map</td><td>1: notify, which is Logseq’s own notice</td></tr>
<tr><td>Making an element</td><td>2</td><td>an el() in the tag map and another in the settings window</td><td>1, in the kit</td></tr>
<tr><td>Making text safe for the page</td><td>3</td><td>escapeHtml and two esc</td><td>1</td></tr>
<tr><td>“Is one of Logseq’s pop-ups open?”</td><td>3 copies</td><td>the proposals, three places</td><td>1, in layer 1</td></tr>
<tr><td>A shortcut or menu item</td><td>3</td><td>through the engine’s list (troubleshooting, settings); registered by the part itself (tag map); listened for by hand, cannot be changed (link selected text, proposals, pickers)</td><td>1 register: every command with its name, shortcut, icon and where it shows</td></tr>
</tbody></table>`;

const summary = `
<table class="sum">
<thead><tr><th>Element</th><th>Ways today</th><th>Proposed</th><th>From</th></tr></thead>
<tbody>
<tr><td><a href="#pops">Pop-up menu</a></td><td>1 box, 4 fillings</td><td>1 box, 2 fillings</td><td>kit, placed by the browser</td></tr>
<tr><td><a href="#dialogs">Dialog</a></td><td>3</td><td>stages in place; 1 window (settings)</td><td>the kit’s pop-up; the browser’s dialog for settings</td></tr>
<tr><td><a href="#buttons">Button</a></td><td>9</td><td>3, none filled or edged</td><td>kit</td></tr>
<tr><td><a href="#finds">Find box</a></td><td>5</td><td>1 (+ the link box’s drawn one)</td><td>kit</td></tr>
<tr><td><a href="#ticks">Tick box, switch</a></td><td>4</td><td>1</td><td>the browser’s checkbox</td></tr>
<tr><td><a href="#segs">Two-way choice</a></td><td>2</td><td>0 new: quiet buttons, one pressed</td><td>kit</td></tr>
<tr><td><a href="#chips">Chip, pill</a></td><td>6</td><td>0 pills: words at two weights</td><td>kit: tags in mono grey; kinds as icons</td></tr>
<tr><td><a href="#bars">Picking bar</a></td><td>2</td><td>1</td><td>kit</td></tr>
<tr><td><a href="#pluses">The “+” to add</a></td><td>5</td><td>2</td><td>kit: a quiet + button, a field on the line</td></tr>
<tr><td><a href="#peek">Hover card</a></td><td>1 + tooltips</td><td>same</td><td>kit card; the browser’s tooltip for hints</td></tr>
<tr><td><a href="#icons">Icon</a></td><td>18 in 4 files</td><td>0 drawn by the plugin</td><td>Logseq’s own icon font (Tabler)</td></tr>
<tr><td><a href="#undo">Undo</a></td><td>1 (+ the old bar)</td><td>1; the bar deleted</td><td>kit</td></tr>
<tr><td><a href="#ghost">Proposed value</a></td><td>2</td><td>1</td><td>Logseq’s own pills, one mark</td></tr>
<tr><td><a href="#help">Quiet words, help</a></td><td>4</td><td>2</td><td>kit</td></tr>
</tbody></table>`;

// ---------- The page ----------
const page = `<meta charset="utf-8">
<title>Refinements Elements</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;700;800&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: the field guide's bench and sheets (docs/VISUAL-GUIDE.html). Every specimen sits on a white Logseq-like sheet
   and is drawn by the parts' own stylesheets, pulled from the source when this page was built. The guide's own marks are
   in one cobalt ink; proposals in a green ink, so they never read as the plugin's. */
:root {
  --bench: #eceef1; --ink: #1b1f25; --ink-2: #565e69; --rule: #d3d8de; --anno: #2849b8; --anno-wash: #2849b814; --go: #1f7a4d; --go-wash: #1f7a4d14;
  --sheet: #ffffff; --sheet-fg: #262a30; --sheet-sec: #6c737d; --sheet-border: #e2e5e9;
  --f-display: "Schibsted Grotesk", "Avenir Next", system-ui, sans-serif;
  --f-body: "Source Sans 3", system-ui, -apple-system, "Segoe UI", sans-serif;
  --f-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --f-ls: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bench: #14171b; --ink: #e5e8ec; --ink-2: #9aa3ae; --rule: #2b3138; --anno: #8ea8ff; --anno-wash: #8ea8ff1f; --go: #6fcf97; --go-wash: #6fcf971f; color-scheme: dark; } }
:root[data-theme="dark"] { --bench: #14171b; --ink: #e5e8ec; --ink-2: #9aa3ae; --rule: #2b3138; --anno: #8ea8ff; --anno-wash: #8ea8ff1f; --go: #6fcf97; --go-wash: #6fcf971f; color-scheme: dark; }
@font-face { font-family: "tabler-icons"; src: url(data:font/woff2;base64,${tabler.font}) format("woff2"); font-weight: 400; font-style: normal; }
.ti { font-family: "tabler-icons" !important; font-style: normal; font-weight: 400; font-variant: normal; text-transform: none; line-height: 1; display: inline-block; -webkit-font-smoothing: antialiased; }
${Object.entries(tabler.map).map(([n, c]) => `.ti-${n}::before { content: "\\${c}"; }`).join('\n')}
* { box-sizing: border-box; }
body { background: var(--bench); color: var(--ink); font: 17px/1.55 var(--f-body); }
.wrap { max-width: 1100px; margin: 0 auto; padding-block: 40px 90px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
h1, h2, h3 { font-family: var(--f-display); text-wrap: balance; margin: 0; }
h1 { font-size: clamp(2rem, 5vw, 3rem); font-weight: 800; line-height: 1.05; letter-spacing: -.015em; }
h2 { font-size: 1.5rem; font-weight: 700; line-height: 1.15; margin-top: 56px; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
h3.go { color: var(--go); }
h3 { font: 600 .75rem var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-2); margin: 18px 0 8px; }
.ways { font: 500 .8rem var(--f-mono); color: var(--anno); background: var(--anno-wash); padding: 2px 8px; border-radius: 4px; }
.lead { font-size: 1.15rem; max-width: 60ch; color: var(--ink-2); margin: 14px 0 0; }
.intro { max-width: 70ch; margin: 6px 0 0; color: var(--ink-2); }
.prose { max-width: 70ch; }
.prose p { margin: 10px 0; }
.prose ol, .prose ul { padding-left: 22px; }
.prose li { margin: 6px 0; }
.key { max-width: 70ch; margin: 14px 0 0; font-size: .98rem; color: var(--ink-2); }
.k-anno { color: var(--anno); font-weight: 600; }
.k-go { color: var(--go); font-weight: 600; }
.toolbar { display: flex; gap: 10px; align-items: center; margin: 22px 0 8px; font-size: .95rem; color: var(--ink-2); }
.toolbar button { font: inherit; padding: 4px 12px; border: 1px solid var(--rule); border-radius: 6px; background: transparent; color: var(--ink); cursor: pointer; }
.toolbar button[aria-pressed="true"] { background: var(--anno); color: #fff; border-color: var(--anno); }
.toolbar button:focus-visible { outline: 2px solid var(--anno); outline-offset: 2px; }
table.sum, table.behind { width: 100%; border-collapse: collapse; margin: 18px 0 0; font-size: .98rem; }
table.sum th, table.behind th { text-align: left; font: 600 .75rem var(--f-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--ink-2); padding: 6px 10px 6px 0; border-bottom: 1px solid var(--rule); }
table.sum td, table.behind td { padding: 7px 10px 7px 0; border-bottom: 1px solid var(--rule); vertical-align: top; }
table.sum td:nth-child(2), table.behind td:nth-child(2) { font-family: var(--f-mono); font-size: .9rem; white-space: nowrap; }
table.sum td:nth-child(3) { color: var(--go); font-weight: 600; }
table.sum a { color: var(--ink); text-decoration: underline; text-decoration-color: var(--anno); text-underline-offset: 3px; }
.tablewrap { overflow-x: auto; }
.row { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
.spec { margin: 0; flex: 1 1 260px; max-width: 100%; min-width: 0; }
.spec.wide { flex-basis: 100%; }
.spec.wide .sheet { max-width: 640px; }
.sheet { background: var(--sheet); color: var(--sheet-fg); border: 1px solid var(--sheet-border); border-radius: 8px; padding: 18px 16px; font: 16px/1.5 var(--f-ls); overflow: auto; min-height: 60px;
  --popover: 0 0% 100%; --popover-foreground: 0 0% 9%;
  --ls-primary-text-color: #262a30; --ls-secondary-text-color: #6c737d; --ls-primary-background-color: #ffffff; --ls-secondary-background-color: #f6f7f8; --ls-tertiary-background-color: #eceef1; --ls-border-color: #e2e5e9; --lx-gray-04: #eceef1; --lx-accent-11: #2d6cc0; }
.dark .sheet { --sheet: #1f2328; --sheet-fg: #d8dce1; --sheet-sec: #8e96a0; --sheet-border: #343a42;
  --popover: 220 7% 14%; --popover-foreground: 0 0% 88%;
  --ls-primary-text-color: #d8dce1; --ls-secondary-text-color: #8e96a0; --ls-primary-background-color: #1f2328; --ls-secondary-background-color: #272c32; --ls-tertiary-background-color: #2f353c; --ls-border-color: #343a42; --lx-gray-04: #2f353c; --lx-accent-11: #8ab4f8; }
.proposed .sheet { border-color: var(--sheet-border); }
.sheet a { color: inherit; text-decoration: none; }
figcaption { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-top: 6px; font-size: .86rem; color: var(--ink-2); }
figcaption .part { color: var(--anno); font-weight: 600; }
.proposed figcaption .part { color: var(--go); }
figcaption code, .gl code { font: 500 .78rem var(--f-mono); color: var(--ink); background: var(--anno-wash); padding: 1px 5px; border-radius: 3px; }
figcaption .note, .gl .note { flex-basis: 100%; }
.glyphs { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.glyph .g { background: var(--sheet); color: var(--sheet-fg); border: 1px solid var(--sheet-border); border-radius: 8px; height: 64px; display: flex; align-items: center; justify-content: center; font-family: var(--f-ls); font-size: 22px;
  --ls-primary-text-color: #262a30; --ls-secondary-text-color: #6c737d; }
.dark .glyph .g { --sheet: #1f2328; --sheet-fg: #d8dce1; --sheet-border: #343a42; --ls-primary-text-color: #d8dce1; }
.glyph .g svg { width: 22px; height: 22px; }
.gl { display: flex; flex-wrap: wrap; gap: 2px 8px; margin-top: 5px; font-size: .8rem; color: var(--ink-2); }
.gl .part { color: var(--anno); font-weight: 600; }
.pglyphs .gl .part { color: var(--go); }
.rec { margin: 18px 0 14px; padding: 14px 16px 14px 18px; border-left: 3px solid var(--go); background: var(--go-wash); border-radius: 0 8px 8px 0; max-width: 78ch; }
.rec .verdict { font: 600 .75rem var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--go); margin-bottom: 6px; }
.rec dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 0; }
.rec dt { font-weight: 600; color: var(--ink-2); }
.rec dd { margin: 0; }
.tooltip-mock { position: relative; display: inline-block; padding-bottom: 34px; }
.tip-anchor { border-bottom: 1px dotted currentColor; }
.tip { position: absolute; left: 12px; top: 26px; font: 12px system-ui; background: #f2f2f2; color: #1d1d1f; border: 1px solid rgba(0,0,0,.18); border-radius: 4px; padding: 3px 7px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,.12); }
.dark .tip { background: #2c2c2e; color: #e5e5e7; border-color: rgba(255,255,255,.14); }
.sheet :is(.rf-pop, .rf-dialog, .refinement-two-way-peek, .refinement-link-text) { position: static !important; }
.sheet .rf-dialog { margin: 0; }
.sheet .refinement-settings { position: static; display: block; height: auto; max-height: none; font-size: 14px; }
.sheet .rs-body { padding: 0 12px 8px; }
.sheet .refinement-tags { padding: 0; font-size: 15px; }
.sheet .refinement-tags .rtg-adds { padding-left: 0; }
.sheet .refinement-two-way { margin: 0; }
.sheet .rfs-ghost { font-style: italic; opacity: .6; }
.sheet .rfs-ghost.rfs-guess { border-bottom: 1px dotted currentColor; }
.sheet .bottom-property-pill { display: inline-flex; gap: 4px; align-items: baseline; }
kbd { font: inherit; font-size: .85em; opacity: .55; margin-left: auto; }
footer { margin-top: 60px; color: var(--ink-2); font-size: .9rem; border-top: 1px solid var(--rule); padding-top: 14px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }

/* ===== The parts' own stylesheets, as the plugin sends them to Logseq (built from the source) ===== */
${css('shared-dialogCss')}
${css('two-way-twoWayCss')}
${css('tags')}
${css('link-text')}
${css('shadow')}
${settingsCss}
${css('picker')}
/* ===== end of the parts' stylesheets ===== */
.sheet .rf-pop, .sheet .rf-dialog, .sheet .refinement-two-way-peek { position: static !important; }
.sheet .rtg-pickbar, .sheet .rf-tw-bar { position: static !important; }
.sheet .refinement-settings { --rf-bg: var(--ls-primary-background-color); --rf-fg: var(--ls-primary-text-color); --rf-line: var(--ls-border-color); background: var(--rf-bg); color: var(--rf-fg); }
.sheet .refinement-two-way-peek { z-index: auto; }
.sheet .refinement-settings.rs-bare { box-shadow: none !important; border: 0 !important; background: none !important; padding: 0 !important; width: auto !important; min-height: 0 !important; color: var(--ls-primary-text-color) !important; }

/* ===== A sketch of the kit after the change (.px-), for the proposed sheets only. The owner's grammar: things fade
   away; differences by weight and grey, never by boxes; no pills, no fills; a pop-up looks like Logseq's own [[ menu
   (6px corners, its light shadow, 14px rows); greys mixed from the text colour, so both themes. ===== */
.sheet { --px-fg: hsl(var(--popover-foreground)); --px-bg: hsl(var(--popover)); --px-hair: color-mix(in srgb, var(--px-fg) 12%, transparent); --px-line: color-mix(in srgb, var(--px-fg) 26%, transparent); --px-quiet: color-mix(in srgb, var(--px-fg) 70%, transparent); --px-faintc: color-mix(in srgb, var(--px-fg) 50%, transparent); --px-wash: color-mix(in srgb, var(--px-fg) 7%, transparent); }
.px-line { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; font-size: 14px; }
.px-pop { background: var(--px-bg); color: var(--px-fg); border: 1px solid var(--px-hair); border-radius: 6px; padding: 4px; box-shadow: 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1); font-size: 14px; line-height: 1.4; }
.px-head { padding: 3px 8px; font-size: 12px; color: var(--px-quiet); }
.px-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border: 0; border-radius: 4px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.px-item .ti { width: 16px; color: var(--px-faintc); }
.px-item:hover, .px-item.px-on { background: var(--px-wash); }
.px-item kbd, .px-end { margin-left: auto; font: inherit; font-size: 12px; color: var(--px-faintc); }
.px-pop hr { margin: 4px 6px; border: 0; border-top: 1px solid var(--px-hair); }
.px-ask { font-weight: 600; margin: 2px 0 2px; }
.px-btns { display: flex; justify-content: flex-end; gap: 4px; margin-top: 8px; }
.px-quiet { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 6px; border: 0; border-radius: 4px; background: none; color: var(--px-quiet); font: inherit; font-size: 14px; cursor: pointer; }
.px-quiet:hover { background: var(--px-wash); color: var(--px-fg); }
.px-quiet[aria-pressed="true"] { color: var(--px-fg); font-weight: 600; background: none; }
.px-go { display: inline-flex; align-items: center; height: 24px; padding: 0 6px; border: 0; border-radius: 4px; background: none; color: var(--px-fg); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: underline; text-decoration-color: var(--px-line); text-underline-offset: 3px; }
.px-go:hover { background: var(--px-wash); }
.px-faint { color: var(--px-faintc); }
.px-field { display: flex; align-items: center; gap: 6px; padding: 2px 2px; border: 0; border-bottom: 1px solid var(--px-line); background: transparent; min-height: 26px; font-size: 14px; }
.px-field:focus-within { border-bottom-color: var(--px-fg); }
.px-field input { flex: 1; min-width: 0; border: 0; background: none; color: inherit; font: inherit; outline: none; padding: 0; }
.px-field .ti, .px-field kbd { color: var(--px-faintc); }
.px-field.px-inline { display: inline-flex; min-height: 22px; }
.px-pop .px-field { margin: 0 8px 4px; }
.px-tick { display: inline-flex; align-items: center; gap: 6px; }
.px-tick input { opacity: .6; }
.sheet :is(.px-tick, .px-count, .px-row) input[type=checkbox], .sheet .pv-pick { appearance: none; width: 13px; height: 13px; margin: 0; border: 1px solid var(--px-line); border-radius: 3px; background: none; vertical-align: -1px; cursor: pointer; }
.sheet :is(.px-tick, .px-count, .px-row) input[type=checkbox], .sheet .pv-pick { position: relative; }
.sheet :is(.px-tick, .px-count, .px-row) input[type=checkbox]:checked, .sheet .pv-pick:checked { border-color: var(--px-fg); }
.sheet :is(.px-tick, .px-count, .px-row) input[type=checkbox]:checked::before, .sheet .pv-pick:checked::before { content: ""; position: absolute; inset: 2px; border-radius: 1.5px; background: var(--px-fg); }
.px-tick:hover input, .px-tick input:checked { opacity: 1; }
.px-seg { display: inline-flex; gap: 0; }
.px-seg .px-quiet + .px-quiet { border-left: 1px solid var(--px-line); border-radius: 0 4px 4px 0; }
.px-seg .px-quiet:first-child { border-radius: 4px 0 0 4px; }
.px-chip { display: inline-flex; align-items: center; gap: 2px; font-size: 14px; color: var(--px-quiet); }
.px-chip[aria-pressed="true"] { color: var(--px-fg); font-weight: 600; }
.px-chip button { border: 0; padding: 0 2px; background: none; color: var(--px-faintc); font-size: 12px; cursor: pointer; display: inline-flex; opacity: 0; }
.px-chip:hover button { opacity: 1; }
.px-plainv { color: var(--px-quiet); }
.px-kindline { display: inline-flex; align-items: center; gap: 5px; font-size: 14px; }
.px-kindicon { color: var(--px-faintc); font-size: 15px; display: inline-flex; }
.px-lstag { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; color: var(--ls-secondary-text-color); opacity: .7; border-bottom: 1px solid color-mix(in srgb, currentColor 30%, transparent); }
.px-lstag:hover { border-bottom-color: currentColor; }
.px-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; padding: 2px 0 6px; margin-bottom: 6px; border-bottom: 1px solid var(--px-hair); font-size: 14px; }
.px-count { display: inline-flex; align-items: center; gap: 6px; padding-right: 10px; font-weight: 600; }
.px-count input { margin: 0; }
.px-twline { display: grid; grid-template-columns: 110px 3.4em minmax(0, 1fr) auto; column-gap: 8px; align-items: baseline; }
.px-cell { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.px-rowname { color: var(--px-quiet); font-size: 14px; display: inline-flex; align-items: center; gap: 4px; min-width: 110px; }
.px-record { border-bottom: 1px solid var(--px-line); justify-self: start; }
.px-longlist { font-size: 14px; max-width: 560px; }
.px-row { display: grid; grid-template-columns: 18px 3.6em minmax(0,1fr) auto; column-gap: 8px; align-items: baseline; padding: 2px 4px; margin: 0 -4px; border-radius: 4px; }
.px-row input { margin: 0; opacity: .3; }
.px-row:hover, .px-row-on { background: var(--px-wash); }
.px-row:hover input, .px-row-on input, .px-longlist:hover .px-row input { opacity: 1; }
.px-day { color: var(--px-faintc); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.px-note { font-size: 12px; color: var(--px-faintc); line-height: 1.45; }
.px-peek { padding: 10px 12px; font-size: 14px; }
.px-peek-title { font-weight: 600; margin-bottom: 3px; }
.px-peek-fields { display: grid; grid-template-columns: max-content minmax(0,1fr); column-gap: 12px; row-gap: 4px; margin-top: 8px; }
.px-peek-lines { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--px-hair); color: var(--px-quiet); }
.px-monotag { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; font-style: normal; }
.px-guide { padding: 2px 0 2px 10px; border-left: 1px solid var(--px-line); font-size: 14px; color: var(--px-quiet); }
.px-guide p { margin: 0; }
/* the stages */
.stages { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 10px; }
.stages .spec { flex: none; }
.stages .sheet { font-size: 14px; min-height: 150px; }
.px-tagrow { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
.px-chev { color: var(--px-faintc); display: inline-flex; }
.px-proprow { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; padding: 2px 0 2px 22px; }
.px-pname { color: var(--px-faintc); min-width: 70px; }
.px-adds { display: flex; gap: 6px; padding: 1px 0 1px 18px; opacity: .55; }
.px-adds-hover { opacity: 1; }
.px-pick { display: inline-flex; flex-wrap: wrap; gap: 2px; }
.px-pick .px-quiet { font-size: 13px; height: 22px; padding: 0 5px; }
.px-undo { color: var(--px-fg); opacity: .28; display: inline-flex; font-size: 14px; margin-left: 6px; }
</style>
<div class="wrap">
  <header>
    <h1>The plugin’s elements: how each is drawn today, and what to keep</h1>
    <p class="lead">Every kind of thing the loaded parts put on screen, side by side, in the parts’ own styles; then, for each, a recommendation: take it from Logseq, take it from the browser, or draw it once in the kit.</p>
    <p class="key"><span class="k-anno">Blue</span> marks are this page’s own notes about what exists. <span class="k-go">Green</span> words under a sheet mark it as a proposal; the other sheets show what the plugin draws today. The sheets themselves carry no mark of this page: what is on a sheet is exactly what Logseq would show.</p>
    <div class="toolbar" role="group" aria-label="Sheet colours"><span>Logseq’s theme on the sheets:</span><button type="button" id="light" aria-pressed="true">Light</button><button type="button" id="dark" aria-pressed="false">Dark</button></div>
  </header>

  <section id="summary">
    <h2>At a glance</h2>
    <div class="tablewrap">${summary}</div>
  </section>

  <section id="how">
    <h2>How I chose</h2>
    <div class="prose">
      <p><b>Rule zero, yours:</b> the plugin fades away. Things are told apart by weight and grey, not by boxes, pills or fills. An action happens in stages, one thing appearing after the other, in place, never as a window of everything at once. Every choice below is measured against that first. Italic is only for a value the proposals pencil in, always with a dotted line under it; nothing else is italic.</p>
      <p><b>No colour of the plugin’s own.</b> The kit uses only greys mixed from Logseq’s text colour, Logseq’s own pop-up colours and the tag grey, in both themes. The green and blue on this page are the page’s inks for “proposed” and “note”; they never reach Logseq. Today’s code carries a violet accent, four hues in the tag map, an orange for warnings and a few blues in the settings window; all of them go.</p>
      <p>Then, three places an element can come from, tried in this order. The further down the list, the more of the plugin’s own code it costs, and code is what drifts and breaks.</p>
      <ol>
        <li><b>Logseq’s own, where the plugin’s markup can simply wear it.</b> That is less than it sounds. Logseq 2.0.2 builds its buttons, fields, menus and dialogs from a toolkit whose look lives in long lists of utility classes written in its code, not in a class the plugin could reuse: its <code>.ui__button</code> rule holds almost nothing. Copying those lists would tie the plugin to one Logseq version. What <em>is</em> plain and safe to wear: its colours (<code>--popover</code> and its partners, which the kit already uses), its <code>#tag</code> link, its property pills (which the proposals already sit inside), its lists for pickers, and its icon font, loaded on every page.</li>
        <li><b>The browser’s own, where it does the job with no code.</b> Logseq 2.0.2 runs on Chrome 148, which has three things the plugin writes by hand today: a dialog that traps Escape, focus and clicks outside by itself; a pop-up that dismisses itself; and placement of a pop-up beside the thing it belongs to, flipped when there is no room. A tick box with the theme’s colour is one line of CSS. Taking these removes five placement routines, three Escape handlers and two kinds of switch.</li>
        <li><b>The kit, for what neither gives.</b> A list with a field to narrow it, a chip, a picking bar, a hover card, an Undo arrow, a quiet note. Each drawn once, used everywhere. A feature that needs a new kind of thing adds it to the kit first, under a name, so the next feature finds it there.</li>
      </ol>
      <p><b>The trade-off, stated plainly.</b> Logseq’s own look follows its theme for free and never needs touching, but its components are not reusable and its class names change between versions, so leaning on them beyond colours and icons would break silently. The browser’s elements are the most stable thing on the page and cost nothing, but they look like the browser’s, not Logseq’s, unless dressed; the kit dresses them with a dozen lines. The kit’s own elements look exactly right and are under our control, but every one is code that must be kept, so the aim is as few kinds as possible: three buttons, one field, one chip, one bar, one card, one note. What stays custom stays because consolidation would cost more than it saves: a value proposed inside Logseq’s own pill, and the link box’s drawn field, whose keystrokes must keep going to the bullet so that Cmd+Z still works.</p>
    </div>
  </section>

  <section id="stages">
    <h2>An action in stages <span class="ways">the shape of every edit</span></h2>
    <p class="intro">How the kit stages an action, with one example: adding a property to a tag in the tag map. Nothing appears before it is needed, each step appears where the last one was, and the thing is done where it will live.</p>
    ${stagesHtml}
  </section>

  ${section('pops', 'Pop-up menus', '1 box, 4 fillings', 'The kit gives one box (<code>.rf-pop</code>: the colours, edge, shadow and text size). What goes inside is built by each part: menu buttons with key hints, rows with a ✓, a drawn text field with a list, or a real field with a list.', [
    spec('tag map', '.refinement-tags-menu', popTagMenu, 'buttons, key hints on the right'),
    spec('two-way rows', '.refinement-two-way-add', popTwoWayMenu, 'rows, a ✓ for the one in force'),
    spec('link selected text', '.refinement-link-text', popLink, 'a drawn field, rows with a kind'),
    spec('tag map', 'pickTag', popPickTag, 'a real field, then buttons'),
  ], '', rec('Keep the box, two fillings, placed by the browser',
    'The kit’s box, with two fillings only: a <b>menu</b> (actions, an icon on the left, a key or a tick on the right) and a <b>list</b> (a field, then rows). The box is a browser popover: it dismisses on Escape or a click outside, and anchor positioning puts it under its button and flips it up when there is no room.',
    'Two fillings cover every pop-up the parts have. The browser’s placement and dismissal replace five placement routines and three Escape handlers, the code most often found wrong in the audit (boxes off screen, boxes left behind). Arrow keys and Enter are handled once, in the kit.',
    'the tag map’s own menu code and placeMenu; the two-way rows’ hand-built rows; the link box’s own placement'),
  [prop(pxMenu, 'a menu: icon, words, key'), prop(pxMenuCheck, 'the one in force ticked with the icon'), prop(pxList, 'a list: the kit’s field, then rows')])}

  ${section('dialogs', 'Dialogs', '3', 'A box that asks one thing. The kit has one (<code>modal</code>), in the middle or beside what it is about. The tag map runs its own copy of it, and the settings window is a window of its own.', [
    spec('kit', '.rf-dialog', dlgKit, 'in the middle, over a faint backdrop'),
    spec('kit', '.rf-dialog.rf-anchored', dlgAnchored, 'beside the button that asked'),
    spec('tag map', 'anchoredPanel', dlgTags, 'the kit’s look, its own handling of Escape and clicks', 'wide'),
    spec('troubleshooting', 'modal + inline styles', dlgDiag, 'the kit’s box, buttons styled by hand'),
    spec('settings', '.refinement-settings', dlgSettings, 'its own window, backdrop, find box and rows', 'wide'),
  ], '', rec('Stages first; a dialog only when something must be answered before going on',
    'Most of what is a dialog today becomes stages in place: a line opens under the thing, then the next piece appears, then it is done (see “An action in stages”). A question that must be answered before going on (Delete 3 records?) is the pop-up beside what it is about, with Cancel and the one that does it as words, no backdrop, no fill. The browser’s own <code>&lt;dialog&gt;</code> stays for the one real window, settings, because it is a list to browse, and it gives Escape, focus and the backdrop for free.',
    'A browser dialog traps focus, closes on Escape and draws its own backdrop, all of which the kit, the tag map and the settings window each wrote by hand (and the settings window forgot its backdrop on an interrupted unload). One box means one place to get the look right for both themes.',
    'the tag map’s anchoredPanel; the settings window’s own backdrop, Escape and “/” handling; the troubleshooting box’s hand-styled buttons'),
  [prop(pxDialog, 'a question beside what it is about: a line, a note, Cancel and the one that does it; no backdrop, no fill')])}

  ${section('buttons', 'Buttons', '9', 'Something to press. The kit has a plain one and a filled one. The parts add seven more: tool, dashed, icon-only, bare words, bar buttons, an underlined word, a bare ×, and buttons styled by hand.', buttons, '', rec('Three buttons, none filled',
    '<b>Quiet</b> (greyed words or an icon, no edge, lit on hover: tools, icons, “+ words”, Cancel, Clear, Reset, the ×), <b>go</b> (the one that does what was asked: the text colour, bold, a faint underline; no fill), and <b>pressed</b> (a quiet button that stays in the text colour while it is the one in force: Tags / Properties, a filter). No edges, no fills anywhere: a button is words that are a little darker than the words around them.',
    'Nine styles say nothing to the reader that three do not, and your grammar has no room for a filled or boxed button: a thing that fades away cannot have a dark block in it. The filled “go” of 0.4.257 goes too; bold underlined words say “this one does it” as clearly and weigh nothing. The dashed edge was already dropped once (0.4.310) as too heavy.',
    'the plain edged button, the filled button, the dashed button, the inline-styled buttons, the bare ×, the bar’s own buttons'),
  [prop(pxButtons, 'quiet; the one that does it; quiet with words; quiet with an icon; quiet and faint')])}

  ${section('finds', 'Find boxes', '5', 'A field to type into to narrow a list. Three big ones that do not match, a field inside menus, and the browser’s own drop-down list in two places.', finds, '', rec('One field: an underline, not a box',
    'One kit field: a real text box drawn as a hairline underneath, firmer while typing, with an optional icon on the left and a key hint on the right. No box around it. It is the find box of the tag map, of the settings window and of every list pop-up, and on a line it is the same thing inline. The browser’s drop-down (<code>datalist</code>) goes; those two places use the list pop-up instead.',
    'One drawing, one focus ring, one placeholder colour, one way the arrows and Enter behave. The browser’s own drop-down looks like the browser, not like the rest, and cannot show a kind beside each row.',
    'the tag map’s and the settings window’s own find boxes; the two datalists. <b>One exception stays:</b> the link box’s field is drawn, not real, because the keystrokes must keep going into the bullet so that Logseq’s own Cmd+Z takes the link back. It wears the same look, so nobody can tell.'),
  [prop(pxField, 'the field: an underline, plain and with an icon and a key hint')])}

  ${section('ticks', 'Tick boxes and switches', '4', 'Something that is on or off. The two-way rows draw a box, menus type a ✓, settings slides a switch, and the i button is a round pressed-or-not button.', ticks, '', rec('The browser’s tick box, drawn as a small rounded square',
    'A real checkbox, drawn as a small rounded square by six lines of CSS (you: “rounded squares, but not like before”): a hairline edge; when on, a rounded shape of the same form fills it, with a thin gap to the edge. The behaviour, keyboard and screen-reader are still the browser’s. It is the pick box on rows, the count in the picking bar, and the on/off in settings. A chosen row in a menu shows the check icon. The i button becomes a quiet button with the info icon, pressed or not.',
    'Almost no drawing code, keyboard and screen-reader behaviour for free, and it follows the theme. The sliding switch is pleasant but is a second drawing of the same fact, and Logseq’s own settings are not something the plugin can borrow. One trade-off: a settings list of plain tick boxes looks a little plainer than switches. Worth it for one element instead of four.',
    'the drawn pick box, the typed ✓, the switch, the serif i'),
  [prop(pxTicks, 'off, on, and as a setting: a hairline rounded square, filled when on'), prop(pxLong, 'a long list: the box sits in the margin of every line, shown faint until the pointer is on the list or something is picked; the bar sits above and stays while scrolling. Shift-click picks a run, Escape clears, as today', 'wide')])}

  ${section('segs', 'Two-way choices', '2', 'Pick one of two or three. Two drawings of the same thing.', segs, '', rec('No new element: quiet buttons, one pressed',
    'A row of quiet buttons inside a thin edge, the pressed one lit. For more than three choices, the list pop-up.',
    'It needs nothing that the quiet button does not already have: a pressed state. Two parts drew it separately because neither had a quiet button to build from.',
    'the tag map’s switch and the settings window’s choices'),
  [prop(pxSeg, 'the same thing in both places: two quiet words, a hairline between them, the one in force in the text colour')])}

  ${section('chips', 'Chips and pills', '6', 'A small labelled thing: a tag, a kind, a filter, a note. Six styles.', chips, '', rec('Tags in mono grey; quiet words; no pills',
    'A tag is its name alone, no #, in the tag grey and a monospace face, as your old code drew it (0.4.114: no blue tag anywhere): it should feel like a class, not a tag. Not Logseq’s own blue #tag link, which 0.4.301 had switched to. Everything else is quiet words, not a chip: a filter is a greyed word that goes to the text colour when it is the one in force; a removable item is a word with a × that appears on hover. No edge, no pill. A value’s kind (link, date, text, number, choice, several) is not a chip at all but an icon from the list, left of the property’s name, with its name in the tooltip.',
    'The mono grey tag is yours and reads as a class, not a word; it costs four lines. The other chips differ only in whether they can be removed or pressed, which is state, not a new drawing. The uppercase kind box goes (you: “I don’t like this square”) and so do the pills: an icon says link or date at a glance, and a word in the right grey says chosen or not. Nothing on the page is a shape; it is all words at four weights.',
    'the tag map’s bold chip, the settings chip, the filter pill, the note pill'),
  [prop(pxTag, 'a tag already on a node: its name alone, mono, tag grey, the faint underline of a link; no #. A tag the proposals guess looks different: upright grey with a dotted line, under “Proposed values”'), prop(pxRemovable, 'a removable item (a graph named in settings): a word; the × shows when the pointer is on it, as on the second'), prop(pxFilter, 'filters above a long list: the one in force in the text colour, the others grey'), prop(pxKinds, 'a property’s kind as an icon left of its name, the name faded like the names on a bullet’s pills, then what it accepts: tags in mono, choices as quiet words, never italic (italic is only for what the proposals pencil in); a second icon at the end when it holds several')])}

  ${section('bars', 'Picking bars', '2', 'The bar that appears when several things are ticked. Two of them, with different buttons.', bars, '', rec('One bar: a line of words, not a box',
    'One kit bar: the count with its tick box, then the actions as quiet words with icons where an action is a common one (sidebar, tag, copy, delete), on one line above the list with a hairline under it. No box, no background. Each part hands the bar its list of actions.',
    'The two bars already do the same thing with different buttons. One bar means the keyboard (Escape clears) and the look are written once, and a third part that picks things gets it free.',
    'the two-way rows’ bar and the tag map’s bar'),
  [prop(pxBar, 'count, actions, clear', 'wide')])}

  ${section('pluses', 'The “+” to add', '5', 'Where a new thing can be made. Five drawings: a + after a node, a line with a + in the margin, faint words, a dashed button, an icon on hover.', pluses, '', rec('Two pieces: a quiet + button, and a field on the line',
    'Adding is always a quiet, faint button whose words say what it adds (“+ Property”, “+ Tag inside”, or just “+” at the end of a row where the row already says what). Pressing it opens the kit’s field in place, on the line, underlined rather than boxed, with the tag at the right. Shown fully when the pointer is on its row, faint otherwise.',
    'The reader learns one thing: faint words starting with + make something. The dashed button and the icon on hover said the same with a different face, and the two-way rows’ draft line was a third field style; it becomes the one field in its inline coat.',
    'the dashed “+ New tag”, the PLUS icon on hover, the draft line’s own field'),
  [prop(pxPlus, 'the + at the end of a row, after the node and before its tag; the field that opens on the next line, with the tag the new node will get beside it; the faint words under a tag in the map', 'wide')])}

  ${section('peek', 'Hover cards', '1 + tooltips', 'What shows when the pointer rests on something. One real card (the two-way rows); everywhere else the browser’s plain tooltip.', peek, '', rec('Keep both, as they are',
    'The kit’s card for a node’s preview (title, tag, day, properties, first lines, each clickable), with a little more room than today’s (you: “provide a little more spacing”): 10 and 12 px of edge, 4 px between property rows, a hairline before the lines. The browser’s tooltip for a short hint on a control: on a Mac it is the system’s neutral grey box (the yellow one is Windows’), and its colour is not ours to choose. The card becomes a browser popover of the “hint” kind, placed by the browser like the menus.',
    'A node preview is content and needs clicks; a hint is three words and needs none. Logseq’s own hover previews cannot be called by a plugin, so the card stays custom. Browser tooltips cost nothing and the reader knows them. Making every hint a card would be more code for a worse wait.',
    'the card’s own placement code'),
  [prop(pxPeek, 'the card with more room: the tag in mono grey without #, a hairline before the node’s own lines')])}

  ${section('icons', 'Icons', '18 in 4 files', 'Ten drawn icons in four files, and eight more that are typed characters. The chevron exists both drawn and cut in CSS; the + both drawn and typed.', [], iconsHtml, rec('Logseq’s own icon font, one named list',
    'No icon drawn by the plugin. Logseq loads the Tabler icon font on every page (it draws its own toolbar with it), so an icon is one short tag with a name. The kit keeps one list: what each icon means and where it is used. The 32 below cover every use today, the kinds of value, and the menus to come.',
    'They match Logseq’s own icons in weight and size, follow its theme, and cost no code: the ten drawn ones go, and the typed stand-ins (⇥ ✓ ⋯ × i →) become real icons of the same weight as the rest. The one risk is a Logseq version dropping the font; it has shipped it since the first version with icons, and the fallback is the character.',
    'UNDO_ICON, TREE_ICON, SIDEBAR_ICON, PAGE_ICON, CHEVRON, PLUS, DOTS, TRASH, SLIDERS_ICON, SEARCH_ICON, the CSS chevron, the typed characters'),
  [])}
  <section id="icons-proposed" class="pglyphs">
    <h3>Proposed: the kit’s icon list, drawn from Logseq’s font</h3>
    ${proposedIconsHtml}
  </section>

  ${section('undo', 'Undo', '1 (+ the old bar)', 'The one Undo of the kit, in its two places. The third sheet is the old dark bar: still in the code today, used by no loaded part, kept there only for the parts that are not loaded. It is on this page as the record of what exists; the recommendation deletes it.', undos, '', rec('Keep the arrow; the old bar goes now',
    'The faded arrow, with the Undo icon from the font. The old dark bar is deleted from the kit now, not kept for the resting parts (you: “all black is too dark and too striking, button is too loud”); a resting part that comes back gets the arrow.',
    'The arrow is already one element, chosen by you (0.4.258). The bar was the thing it replaced, and nothing loaded uses it.',
    'the old Undo bar'),
  [])}

  ${section('ghost', 'Proposed values', '2', 'What the proposals draw inside a bullet’s own properties, and a pill they make to look like Logseq’s.', ghost, '', rec('Keep Logseq’s pill; one mark for every proposed value; a proposed tag in mono without the #',
    'A proposed value lives inside Logseq’s own property pill, in italic grey with a dotted line under it, whether the plugin is sure of it or guessing (you: “underline them both with a dotted line, they are essentially the same thing, keep them both italic”); today only a guess has the line. The made pill copies Logseq’s pill classes so that it sits in Logseq’s own row. A proposed tag in the Tags pill reads in mono without the # (you: “mono without #”), as Logseq itself shows a tag inside its pill. The keys stay as they are: Enter takes all, a click away only the sure ones, Option-Enter stops on each guess.',
    'One look says “the plugin wrote this, not you”, which is what matters; whether it was sure is not worth a second look. Copying Logseq’s pill classes is the one place the plugin wears Logseq’s own component, and it is worth the version risk because the value must sit exactly where Logseq’s own will; a kit pill beside it would jump when Logseq’s replaced it.'),
  [prop(`<div class="ls-block" style="font-size:14px"><div class="positioned-properties block-below flex flex-col gap-1 text-sm"><div class="bottom-properties-row" style="display:flex;gap:10px;flex-wrap:wrap"><span class="bottom-property-pill"><span class="property-key-inner" style="opacity:.5">Provider:</span> <span class="bottom-property-content"><span class="rfs-ghost rfs-guess">Dr. Mei Chen</span></span></span><span class="bottom-property-pill"><span class="property-key-inner" style="opacity:.5">Topic:</span> <span class="bottom-property-content"><span class="rfs-ghost rfs-guess">Scan results</span></span></span><span class="bottom-property-pill"><span class="property-key-inner" style="opacity:.5">Tags:</span><span class="bottom-property-content"><span class="rfs-ghost rfs-guess px-monotag">Consultation</span></span></span></div></div></div>`, 'every proposed value the same: italic grey with a dotted line, sure or guessed; a proposed tag in mono, no #, upright')])}

  ${section('help', 'Quiet words and help', '4', 'Explanations and notes. A box under the i button, quiet lines in pop-ups and dialogs, quiet words on a row.', help, '', rec('Two: a quiet line, a help box',
    'One <b>quiet line</b> (smaller, greyed) for a hint under a field, a note in a pop-up, or quiet words on a row. One <b>help paragraph</b>, quiet grey with a hairline down its left like embedded content, for the longer “what this means” under a quiet info button. No washed block.',
    'Three of the four are the same quiet line under three names. The help box is a different thing: paragraphs, opened on purpose.',
    'rf-pop-note, refinement-prompt-hint and rtg-note become one'),
  [prop(pxHelp, 'the quiet line; the help box')])}

  <section id="behind">
    <h2>Behind the scenes <span class="ways">not drawn</span></h2>
    <p class="intro">Things done more than one way that have no picture: how a box is placed, how Logseq is waited for and pressed, how a notice is shown, how shortcuts are registered. The last column says what the proposal leaves.</p>
    <div class="tablewrap">${behind}</div>
  </section>

  <section id="kit">
    <h2>The kit after this</h2>
    <div class="prose">
      <p><b>From Logseq:</b> colours; property pills for proposed values; its own lists for the pickers; its icon font; its notice at the top.</p>
      <p><b>From the browser:</b> the dialog; pop-ups that dismiss and place themselves; the tick box; tooltips for hints.</p>
      <p><b>Drawn by the kit, once each:</b></p>
      <ul>
        <li>the pop-up box, with a menu filling and a list filling</li>
        <li>the dialog’s dressing</li>
        <li>three buttons: quiet, go, pressed; none filled or edged</li>
        <li>one field, with its inline coat for a line</li>
        <li>quiet words for filters and removable items; kinds as icons</li>
        <li>the picking bar</li>
        <li>the hover card</li>
        <li>the Undo arrow</li>
        <li>the quiet line and the help paragraph</li>
        <li>the icon list</li>
      </ul>
      <p>Ten pieces where there are about forty drawings today. The rule that keeps it there: a feature draws nothing of its own; a new kind of thing goes into the kit first, with a name and a line on this page.</p>
    </div>
  </section>

  <section id="custom">
    <h2>Truly custom, or taste? <span class="ways">4 of 10</span></h2>
    <p class="intro">Of the ten pieces the kit draws, four exist because nothing in Logseq or the browser does the job. The other six work bare; their look is a choice, and could be dropped to the browser’s plain look or changed in one place later.</p>
    <div class="tablewrap"><table class="behind">
<thead><tr><th>Piece</th><th>Why it is custom</th><th>If the dressing were dropped</th></tr></thead>
<tbody>
<tr><td><b>Hover card</b></td><td>Needed. A node’s preview with clickable pieces; Logseq’s own previews cannot be called by a plugin.</td><td>Still custom: it is behaviour.</td></tr>
<tr><td><b>Undo arrow</b></td><td>Needed. Sits at the end of what changed, holds several changes, waits at the corner when the thing is gone.</td><td>Still custom.</td></tr>
<tr><td><b>Pop-up: the list filling</b></td><td>Needed. The browser places and dismisses the box; arrows, Enter and narrowing by typing are ours.</td><td>Still custom; the box itself would be the browser’s bare popover.</td></tr>
<tr><td><b>Picking bar</b></td><td>Needed. The count, the actions, Escape to clear, staying put while the list scrolls.</td><td>Still custom; it would be a bare row of buttons.</td></tr>
<tr><td>Pop-up box look</td><td>Taste. Colours, edge, shadow.</td><td>A plain box with a black edge; works.</td></tr>
<tr><td>Dialog dressing</td><td>Taste.</td><td>The browser’s plain dialog; works.</td></tr>
<tr><td>Three buttons</td><td>Taste: words at three weights. The quiet one is close to Logseq’s own toolbar button.</td><td>The browser’s grey buttons; work.</td></tr>
<tr><td>Field</td><td>Taste.</td><td>The browser’s plain text box; works.</td></tr>
<tr><td>Filter and removable words</td><td>Taste. Only the × is behaviour.</td><td>Plain words with a × after them; works.</td></tr>
<tr><td>Quiet line, help paragraph</td><td>Taste. Smaller, greyer words.</td><td>Ordinary text; works.</td></tr>
</tbody></table></div>
    <div class="prose"><p>Today the parts carry about 70,000 characters of their own CSS. After this, the six dressings are one small stylesheet that reads Logseq’s colours, and the four custom pieces keep their behaviour whatever the paint. That is what makes the cosmetic layer cheap later.</p></div>
  </section>

  <footer>Built ${new Date().toISOString().slice(0, 10)} from the plugin’s source at 0.4.310: the stylesheets are the parts’ own, the markup follows what each part builds, and Logseq’s colours are approximated on the sheets. The proposed sheets are a sketch, not the kit. Source of truth: <code>docs/ELEMENTS.html</code> in the plugin folder, built by a script kept with the session.</footer>
</div>
<script>
(function () {
  var wrap = document.querySelector('.wrap'), light = document.getElementById('light'), dark = document.getElementById('dark');
  function set(isDark) {
    wrap.classList.toggle('dark', isDark);
    light.setAttribute('aria-pressed', String(!isDark)); dark.setAttribute('aria-pressed', String(isDark));
    try { localStorage.setItem('rf-elements-theme', isDark ? 'dark' : 'light'); } catch (e) {}
  }
  light.addEventListener('click', function () { set(false); });
  dark.addEventListener('click', function () { set(true); });
  var saved = null; try { saved = localStorage.getItem('rf-elements-theme'); } catch (e) {}
  if (saved === 'dark') set(true);
})();
</script>
`;
fs.writeFileSync(path.join(process.cwd(), 'docs', 'ELEMENTS.html'), page);
console.log('wrote docs/ELEMENTS.html', Math.round(page.length / 1024), 'KB');
