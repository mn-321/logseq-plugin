// Builds docs/VIEWS.html: whole views drawn with the proposed kit (the .px- sketch shared with docs/ELEMENTS.html):
// a page with two-way rows, the same page with a list open and three picked, an outline being written with
// proposals, the tag map in its Tags and Properties views, the link box, the settings window and the troubleshooting
// list. Run from the repo root: node <this file> <scratchpad dir>
const fs = require('fs'), path = require('path');
const S = process.argv[2];
const tabler = JSON.parse(fs.readFileSync(path.join(S, 'tabler.json'), 'utf8'));
const pxCss = fs.readFileSync(path.join(S, 'px-shared.css'), 'utf8');
const T = name => `<i class="ti ti-${name}" aria-hidden="true"></i>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tag = t => `<a class="tag px-lstag" href="#">${esc(t)}</a>`;

const view = (id, title, intro, html, notes, extra = '') => `
<section id="${id}">
  <h2>${esc(title)}</h2>
  <p class="intro">${intro}</p>
  <figure class="spec proposed${extra ? ' ' + extra : ''}"><div class="sheet pv">${html}</div></figure>
  <ul class="notes">${notes.map(n => `<li>${n}</li>`).join('')}</ul>
</section>`;

// ---- Logseq-like page furniture ----
const bullet = (text, cls = '') => `<div class="pv-bullet${cls ? ' ' + cls : ''}"><span class="pv-dot"></span><div class="pv-bt">${text}</div></div>`;
const propRow = (name, value) => `<div class="pv-prop"><span class="pv-pname">${esc(name)}</span><span class="pv-pval">${value}</span></div>`;

// ---- 1. A page with two-way rows ----
const twRow = (name, items, more = '') => `<div class="pv-tw"><span class="pv-twname">${esc(name)} ${T('arrow-right')}</span><div class="pv-twval">${items}${more}</div></div>`;
const twItem = (day, text, t, plus = false) => `<div class="pv-twitem"><input type="checkbox" class="pv-pick" aria-label="Pick"><span class="px-day">${day}</span><span class="pv-namecell"><a class="px-record" href="#">${esc(text)}</a>${plus ? `<button class="px-quiet px-faint pv-plus">+</button>` : ''}</span>${tag(t)}<button class="px-quiet pv-side">${T('layout-sidebar-right')}</button></div>`;
const page1 = `
<div class="pv-titlebar"><h1 class="pv-title">Dr. Mei Chen</h1>${tag('Doctor')}</div>
<div class="pv-props">
  ${propRow('Specialty', 'Oncology')}
  ${propRow('Works at', '<a class="px-record" href="#">Northgate Cancer Center</a>')}
</div>
<div class="pv-tws">
  ${twRow('provider of', twItem('12 Aug', 'Follow-up on the scan', 'Consultation') + twItem('23 Jun', 'Scan results explained', 'Consultation', true))}
  ${twRow('spoke with', `<div class="pv-twitem pv-twfold"><button class="px-quiet pv-chev">${T('chevron-right')}</button><span class="pv-namecell"><a class="px-record" href="#">9 Conversations</a><span class="px-note">21 Jul to 2 Jun</span><button class="px-quiet px-faint pv-plus">+</button></span><span></span></div>`)}
  ${twRow('decided by', twItem('14 Jul', 'Decision on oxaliplatin dose', 'Decision', true))}
</div>
<div class="pv-addrow"><span>Add icon</span><span>Set property</span></div>
<div class="pv-blocks">
  ${bullet('Oncologist at <a class="px-record" href="#">Northgate Cancer Center</a> since 2019. Leads the colorectal clinic on Tuesdays.')}
  ${bullet('Prefers written questions before a consultation.')}
</div>
<div class="pv-linked"><span class="px-quiet pv-chev">${T('chevron-right')}</span>Linked references <span class="px-note">14</span></div>`;

// ---- 2. The same page, a list open, three picked ----
const line = (day, text, t, on = false) => `<div class="pv-line${on ? ' pv-on' : ''}"><input type="checkbox" class="pv-pick"${on ? ' checked' : ''} aria-label="Pick"><span class="px-day">${day}</span><a class="px-record" href="#">${esc(text)}</a>${tag(t)}<button class="px-quiet pv-side">${T('layout-sidebar-right')}</button></div>`;
const page2 = `
<div class="pv-titlebar"><h1 class="pv-title">Dr. Mei Chen</h1>${tag('Doctor')}</div>
<div class="pv-props">${propRow('Specialty', 'Oncology')}${propRow('Works at', '<a class="px-record" href="#">Northgate Cancer Center</a>')}</div>
<div class="px-bar pv-bar"><span class="px-count"><input type="checkbox" checked> 3 picked</span><button class="px-quiet">${T('layout-sidebar-right')}Sidebar</button><button class="px-quiet">Change “Dr. Mei Chen” to…</button><button class="px-quiet">Remove “Dr. Mei Chen”</button><button class="px-quiet">${T('tag')}Tag</button><button class="px-quiet">${T('copy')}Copy</button><button class="px-quiet">${T('trash')}</button><button class="px-quiet px-faint">Clear</button></div>
<div class="pv-tws">
  ${twRow('provider of', twItem('12 Aug', 'Follow-up on the scan', 'Consultation') + twItem('23 Jun', 'Scan results explained', 'Consultation', true))}
  <div class="pv-tw pv-open"><span class="pv-twname">spoke with ${T('arrow-right')}</span><div class="pv-twval">
    <div class="pv-twitem pv-twfold"><button class="px-quiet pv-chev pv-down">${T('chevron-right')}</button><span class="pv-namecell"><a class="px-record" href="#">9 Conversations</a><button class="px-quiet px-faint pv-plus">+</button></span><span></span></div>
    <div class="pv-filters"><span class="px-chip" aria-pressed="true">All 9</span><span class="px-chip">Conversation 6</span><span class="px-chip">Consultation 3</span></div>
    ${line('21 Jul', 'Asked about tingling fingers', 'Conversation', true)}
    ${line('14 Jul', 'Second opinion on the dose', 'Conversation')}
    ${line('7 Jul', 'Cycle 3 side effects', 'Conversation', true)}
    <div class="pv-earlier"><span>earlier</span></div>
    ${line('23 Jun', 'Scan results explained', 'Consultation', true)}
    ${line('16 Jun', 'Port care questions', 'Conversation')}
    <div class="px-note" style="margin:2px 0 0 0">show all 9</div>
  </div></div>
  ${twRow('decided by', twItem('14 Jul', 'Decision on oxaliplatin dose', 'Decision', true))}
</div>`;

// ---- 3. An outline being written, with proposals ----
const pill = (name, html, ghost = '', made = false) => `<span class="pv-pill${made ? ' pv-made' : ''}"><span class="pv-pillname">${esc(name)}:</span>${ghost ? `<span class="rfs-ghost ${ghost}">${html}</span>` : html}</span>`;
const outline = `
<div class="pv-titlebar"><h1 class="pv-title">Oct 22nd, 2026</h1></div>
<div class="pv-blocks">
  ${bullet('Bloods came back fine, cycle 5 on Monday. <span class="px-undo">' + T('arrow-back-up') + '</span><div class="pv-pills">' + pill('Tags', tag('Report')) + pill('Date', '22 Oct') + pill('Findings', 'Normal') + '</div>')}
  ${bullet('Spoke with <a class="px-record" href="#">Dr. Mei Chen</a> about the next scan, on Friday<span class="pv-caret"></span><div class="pv-pills">' + pill('Spoke with', 'Dr. Mei Chen', 'rfs-ghost') + pill('Topic', 'Scan', 'rfs-guess') + pill('Date', '24 Oct', 'rfs-guess') + pill('Tags', `<span class="px-monotag">Conversation</span>`, 'rfs-guess', true) + '</div>', 'pv-editing')}
  ${bullet('<span class="px-faint">Nausea again in the evening</span>')}
</div>
<div class="pv-keys"><span><kbd>Enter</kbd> fills in everything shown, guesses too</span><span><kbd>⌥ Enter</kbd> stops on each guess to check it</span><span><kbd>Esc</kbd> clears them until you type again</span></div>`;

// ---- 4. The tag map, Tags view ----
const mapHeader = (byTags) => `<div class="pv-maphead"><div class="px-field pv-find">${T('search')}<input type="text" placeholder="Find a tag or property"></div><div class="px-seg"><button class="px-quiet" aria-pressed="${byTags}">Tags</button><button class="px-quiet" aria-pressed="${!byTags}">Properties</button></div><button class="px-quiet px-faint">Inherited</button><button class="px-quiet px-faint">Fold</button><button class="px-quiet px-faint">Unfold</button><button class="px-quiet">${T('layout-sidebar-right')}</button></div>`;
const tagRow = (name, small, open, depth = 0, acts = false, root = false) => `<div class="pv-trow${root ? ' pv-root' : ''}" style="padding-left:${depth * 22}px"><button class="px-quiet pv-chev${open ? ' pv-down' : ''}">${T('chevron-right')}</button><span class="pv-tname">${esc(name)}</span><span class="px-note">${small}</span>${acts ? `<span class="pv-acts"><button class="px-quiet">${T('plus')}</button><button class="px-quiet">${T('dots')}</button></span>` : ''}</div>`;
const pRow = (name, kind, accepts, extra = '', depth = 1, inh = '') => `<div class="pv-prow${inh ? ' pv-inh' : ''}" style="padding-left:${depth * 22 + 22}px"><span class="px-kindicon" title="${esc(kind)}">${T(kind === 'link' ? 'arrow-right' : kind === 'date' ? 'calendar' : kind === 'choice' ? 'select' : kind === 'number' ? '123' : 'letter-case')}</span><span class="pv-pn">${esc(name)}</span>${accepts ? accepts.split(', ').map(tag).join(', ') : ''}${extra}${inh ? `<span class="px-note">from ${inh}</span>` : ''}<button class="px-quiet pv-info">${T('info-circle')}</button></div>`;
const tagsView = `
${mapHeader(true)}
<div class="pv-tree">
  ${tagRow('Occurrence', '7 tags inside', true, 0, false, true)}
  ${tagRow('Consultation', '12 nodes', true, 1, true)}
    ${pRow('Provider', 'link', 'Doctor', '', 1)}
    ${pRow('Topic', 'link', 'Topic kind', ` <span class="px-kindicon" title="Several values">${T('stack-2')}</span>`, 1)}
    ${pRow('Date', 'date', '', '', 1, 'Occurrence')}
    <div class="pv-ptr" style="padding-left:66px"><span class="px-note">Shows up here as</span> <span class="pv-ptrlink">provider of</span><span class="px-note">on Doctor</span> · <span class="pv-ptrlink">topic of</span><span class="px-note">on Topic kind</span></div>
    <div class="px-adds px-adds-hover" style="padding-left:66px"><button class="px-quiet px-faint">+ Property</button><button class="px-quiet px-faint">+ Tag inside</button><button class="px-quiet px-faint">+ Description</button></div>
    ${tagRow('Follow-up', '3 nodes', false, 2)}
  ${tagRow('Conversation', '9 nodes', false, 1)}
  ${tagRow('Treatment', '14 nodes', false, 1)}
  ${tagRow('Decision', '4 nodes', false, 1)}
  ${tagRow('Entity', '4 tags inside', false, 0, false, true)}
  ${tagRow('Interpretation', '2 tags inside', false, 0, false, true)}
  <div class="px-adds" style="padding-left:22px;opacity:.55"><button class="px-quiet px-faint">+ New tag</button></div>
</div>`;

// ---- 5. The tag map, Properties view ----
const lineOf = (label, html) => `<div class="pv-pline"><span class="pv-plbl">${esc(label)}</span><span>${html}</span></div>`;
const propsView = `
${mapHeader(false)}
<div class="pv-tree">
  <div class="pv-group">Clinical</div>
  <div class="pv-prow pv-ptop" style="padding-left:22px"><button class="px-quiet pv-chev pv-down">${T('chevron-right')}</button><span class="px-kindicon">${T('arrow-right')}</span><span class="pv-pn">Provider</span><a class="tag px-lstag" href="#">Doctor</a><span class="px-note">on 2 tags</span><button class="px-quiet pv-info">${T('info-circle')}</button></div>
  <div class="pv-pinfo">
    ${lineOf('Value', `a link to a ${tag('Doctor')} node <button class="px-quiet px-faint">Change…</button>`)}
    ${lineOf('On tags', `${tag('Consultation')}<button class="px-quiet pv-x">${T('x')}</button> ${tag('Treatment')}<button class="px-quiet pv-x">${T('x')}</button> <button class="px-quiet px-faint">+ Tag</button>`)}
    ${lineOf('Links to', `${tag('Doctor')} <span class="px-note">nodes, and the tags inside it</span> <button class="px-quiet px-faint">Change…</button>`)}
    ${lineOf('Seen from Doctor as', `<span class="pv-ptrlink">provider of</span> <span class="px-note">a row on every Doctor node</span> <button class="px-quiet px-faint">Reword…</button> <button class="px-quiet px-faint">Turn off</button>`)}
    ${lineOf('Group', `Clinical <button class="px-quiet px-faint">Change…</button>`)}
    ${lineOf('Nodes with it', `<button class="px-quiet px-faint">show nodes</button>`)}
  </div>
  <div class="pv-prow pv-ptop" style="padding-left:22px"><button class="px-quiet pv-chev">${T('chevron-right')}</button><span class="px-kindicon">${T('arrow-right')}</span><span class="pv-pn">Topic</span><a class="tag px-lstag" href="#">Topic kind</a> <span class="px-kindicon">${T('stack-2')}</span><span class="px-note">on 15 tags</span></div>
  <div class="pv-prow pv-ptop" style="padding-left:22px"><button class="px-quiet pv-chev">${T('chevron-right')}</button><span class="px-kindicon">${T('select')}</span><span class="pv-pn">Status</span><span class="px-plainv">Open · Met · Closed</span><span class="px-note">on Expectation</span></div>
  <div class="pv-group">Timing</div>
  <div class="pv-prow pv-ptop" style="padding-left:22px"><button class="px-quiet pv-chev">${T('chevron-right')}</button><span class="px-kindicon">${T('calendar')}</span><span class="pv-pn">Date</span><span class="px-note">on Occurrence, from there on 7 tags</span></div>
  <div class="pv-prow pv-ptop" style="padding-left:22px"><button class="px-quiet pv-chev">${T('chevron-right')}</button><span class="px-kindicon">${T('123')}</span><span class="pv-pn">Cycle</span><span class="px-note">on Treatment</span></div>
  <div class="px-adds" style="padding-left:22px;opacity:.55"><button class="px-quiet px-faint">+ New property</button><button class="px-quiet px-faint">+ Group</button></div>
</div>`;

// ---- 6. The link box ----
const linkBox = `
<div class="pv-blocks">
  ${bullet('Asked <mark class="pv-sel">Mei</mark> about the port before cycle 5.', 'pv-editing')}
</div>
<div class="px-pop pv-linkpop" style="width:320px;margin-left:60px">
  <div class="px-head">Link “Mei” to</div>
  <div class="px-field"><input type="text" value="" placeholder="A page’s name"><kbd>⌘⌥L</kbd></div>
  <button class="px-item px-on">Dr. Mei Chen<span class="px-end">${tag('Doctor')}</span></button>
  <button class="px-item">Mei’s clinic notes<span class="px-end">page</span></button>
  <button class="px-item px-faint"><a class="tag px-lstag" href="#">New page “Mei”</a></button>
</div>`;

// ---- 7. The settings window ----
const srow = (title, desc, control, icon = 'arrows-left-right') => `<div class="pv-srow"><div class="pv-smain"><div class="pv-stitle"><span class="px-kindicon">${T(icon)}</span>${esc(title)}</div><div class="px-note">${desc}</div></div><div class="pv-sctl">${control}</div></div>`;
const settings = `
<div class="pv-settings">
  <div class="pv-shead"><div class="px-field pv-find">${T('search')}<input type="text" placeholder="Find a setting"><kbd>/</kbd></div><button class="px-quiet">${T('x')}</button></div>
  <div class="pv-sbody">
    <nav class="pv-snav"><button class="px-quiet" aria-pressed="true">${T('arrows-left-right')}Two-way links</button><button class="px-quiet">${T('hierarchy')}Tag map</button><button class="px-quiet">${T('bulb')}Proposals</button><button class="px-quiet">${T('keyboard')}Shortcuts</button><button class="px-quiet">${T('adjustments-horizontal')}Tools</button></nav>
    <div class="pv-srows">
      ${srow('Two-way links', 'Show, on a page, every node whose property points at it.', `<label class="px-tick"><input type="checkbox" checked></label>`)}
      ${srow('Order in a row', 'Date first, or the name first.', `<div class="px-seg"><button class="px-quiet" aria-pressed="true">Date first</button><button class="px-quiet">Name first</button></div>`, 'arrows-sort')}
      ${srow('Turned off on', 'Pages where the rows would be clutter.', `<span class="px-chip">Northgate Cancer Center<button>${T('x')}</button></span> <button class="px-quiet px-faint">+ Page</button>`, 'eye-off')}
      ${srow('Proposals may write in', 'Graphs named here get proposals filled in; others only show them.', `<span class="px-chip">Illness Test Graph<button>${T('x')}</button></span> <button class="px-quiet px-faint">+ Graph</button>`, 'pencil')}
      ${srow('Tag map shortcut', 'Opens the tag map.', `<div class="px-field px-inline" style="min-width:120px"><input type="text" value="mod+alt+g"></div> <button class="px-quiet px-faint">Reset</button>`, 'keyboard')}
    </div>
  </div>
  <div class="pv-sfoot"><span class="px-note">0.4.310</span><button class="px-quiet px-faint">Reload plugin</button></div>
</div>`;

// ---- 8. Troubleshooting ----
const tools = `
<div class="px-pop" style="width:330px">
  <div class="px-head">Troubleshooting · none of these changes your notes</div>
  <button class="px-item">${T('copy')}Copy performance report</button>
  <button class="px-item">${T('eye')}Check what the plugin finds on this page</button>
  <button class="px-item">${T('alert-triangle')}Copy warnings</button>
  <hr>
  <button class="px-item">${T('adjustments-horizontal')}Measuring<span class="px-end">${T('check')}</span></button>
  <button class="px-item">${T('adjustments-horizontal')}Foundation only</button>
</div>`;

const page = `<meta charset="utf-8">
<title>Refinements Views</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;700;800&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: the field guide's bench and sheets. Each sheet is a whole view drawn with the proposed kit (the same .px-
   sketch as docs/ELEMENTS.html), in Logseq's page layout. Green ink marks what is proposed. */
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
h1, h2 { font-family: var(--f-display); text-wrap: balance; margin: 0; }
h1 { font-size: clamp(2rem, 5vw, 3rem); font-weight: 800; line-height: 1.05; letter-spacing: -.015em; }
h2 { font-size: 1.5rem; font-weight: 700; line-height: 1.15; margin-top: 56px; }
.lead { font-size: 1.15rem; max-width: 60ch; color: var(--ink-2); margin: 14px 0 0; }
.intro { max-width: 70ch; margin: 6px 0 12px; color: var(--ink-2); }
.key { max-width: 70ch; margin: 14px 0 0; font-size: .98rem; color: var(--ink-2); }
.k-go { color: var(--go); font-weight: 600; }
.toolbar { display: flex; gap: 10px; align-items: center; margin: 22px 0 8px; font-size: .95rem; color: var(--ink-2); }
.toolbar button { font: inherit; padding: 4px 12px; border: 1px solid var(--rule); border-radius: 6px; background: transparent; color: var(--ink); cursor: pointer; }
.toolbar button[aria-pressed="true"] { background: var(--anno); color: #fff; border-color: var(--anno); }
.spec { margin: 0; max-width: 100%; }
.sheet { background: var(--sheet); color: var(--sheet-fg); border: 1px solid var(--sheet-border); border-radius: 8px; padding: 22px 28px; font: 16px/1.5 var(--f-ls); overflow: auto; max-width: 760px;
  --popover: 0 0% 100%; --popover-foreground: 0 0% 9%; --ls-primary-text-color: #262a30; --ls-secondary-text-color: #6c737d; --lx-accent-11: #2d6cc0; }
.dark .sheet { --sheet: #1f2328; --sheet-fg: #d8dce1; --sheet-sec: #8e96a0; --sheet-border: #343a42; --popover: 220 7% 14%; --popover-foreground: 0 0% 88%; --ls-primary-text-color: #d8dce1; --ls-secondary-text-color: #8e96a0; --lx-accent-11: #8ab4f8; }
.proposed .sheet { border-color: var(--sheet-border); }
.sheet a { color: inherit; text-decoration: none; }
.notes { margin: 12px 0 0; padding-left: 20px; max-width: 78ch; color: var(--ink-2); }
.notes li { margin: 4px 0; }
.notes b { color: var(--go); }
kbd { font: inherit; font-size: .85em; opacity: .7; padding: 0 4px; border: 1px solid var(--rule); border-radius: 3px; }
footer { margin-top: 60px; color: var(--ink-2); font-size: .9rem; border-top: 1px solid var(--rule); padding-top: 14px; }
.rfs-ghost { font-style: italic; opacity: .6; }
.rfs-ghost.rfs-guess { border-bottom: 1px dotted currentColor; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }

${pxCss}

/* ===== The views (.pv-): Logseq's page layout, the kit's pieces on it ===== */
.pv { font-size: 16px; }
.pv-titlebar { display: flex; align-items: baseline; gap: 12px; margin-bottom: 10px; }
.pv-title { font: 700 28px/1.2 var(--f-ls); letter-spacing: -.01em; margin: 0; }
.pv-titlebar .px-lstag { font-size: 13px; }
.pv-props { display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px; }
.pv-prop { display: grid; grid-template-columns: 150px 1fr; column-gap: 20px; min-height: 28px; align-items: baseline; }
.pv-pname { color: var(--px-faintc); font-size: 15px; }
.pv-tws { display: flex; flex-direction: column; gap: 2px; margin: 2px 0 8px; }
.pv-tw { display: grid; grid-template-columns: 150px 1fr; column-gap: 20px; align-items: baseline; min-height: 28px; }
.pv-twname { color: var(--px-faintc); font-size: 15px; display: inline-flex; align-items: center; gap: 4px; }
.pv-twname .ti { font-size: 13px; opacity: .7; }
.pv-twval { display: flex; flex-direction: column; gap: 2px; min-width: 0; position: relative; }
.pv-twitem, .pv-line { position: relative; display: grid; grid-template-columns: 3.4em minmax(0, 1fr) auto 1.4em; column-gap: 8px; align-items: baseline; padding: 1px 4px; margin: 0 -4px; border-radius: 4px; }
.pv-twitem.pv-twfold { grid-template-columns: minmax(0, 1fr) auto 1.4em; }
.pv-twfold .pv-chev { position: absolute; left: -24px; top: .05em; }
.pv-pick { position: absolute; left: -22px; top: .45em; opacity: 0; }
.pv-tws:hover .pv-pick, .pv-pick:checked, .pv-on .pv-pick { opacity: .35; }
.pv-line:hover .pv-pick, .pv-twitem:hover .pv-pick, .pv-pick:checked { opacity: 1; }
.pv-line:hover, .pv-twitem:hover, .pv-on { background: var(--px-wash); }
.pv-side { visibility: hidden; height: 20px; padding: 0 4px; }
.pv-line:hover .pv-side, .pv-twitem:hover .pv-side { visibility: visible; }
.pv-plus { height: 20px; padding: 0 5px; opacity: .5; margin-left: 6px; }
.pv-twitem:hover .pv-plus, .pv-tw:hover .pv-plus { opacity: 1; }
.pv-chev { height: 20px; padding: 0 2px; font-size: 14px; color: var(--px-faintc); }
.pv-chev.pv-down .ti { display: inline-block; transform: rotate(90deg); }
.pv-namecell { display: flex; align-items: baseline; gap: 6px; min-width: 0; flex-wrap: wrap; }
.pv-namecell .px-record { min-width: 0; }
.pv-filters { display: flex; gap: 14px; padding: 2px 0 4px 0; font-size: 14px; }

.pv-earlier { display: flex; align-items: center; gap: 8px; padding-left: 0; font-size: 13px; color: var(--px-faintc); }
.pv-earlier::after { content: ''; flex: 1; border-top: 1px dashed var(--px-hair); }
.pv-bar { margin: 0 0 8px; }
.pv-addrow { display: flex; gap: 16px; min-height: 28px; visibility: hidden; }
.pv-blocks { display: flex; flex-direction: column; gap: 6px; }
.pv-bullet { display: grid; grid-template-columns: 18px 1fr; column-gap: 6px; align-items: start; }
.pv-dot { width: 6px; height: 6px; margin: 10px 0 0 6px; border-radius: 50%; background: color-mix(in srgb, var(--px-fg) 45%, transparent); }
.pv-editing .pv-bt { background: var(--px-wash); border-radius: 4px; padding: 2px 6px; margin-left: -6px; }
.pv-caret { display: inline-block; width: 1px; height: 1em; background: currentColor; vertical-align: -2px; margin-left: 1px; animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.pv-pills { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 4px; font-size: 14px; }
.pv-pill { display: inline-flex; gap: 4px; align-items: baseline; }
.pv-pillname { color: var(--px-faintc); }
.pv-keys { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--px-hair); font-size: 13px; color: var(--px-faintc); }
.pv-linked { display: flex; align-items: center; gap: 4px; margin-top: 18px; padding-top: 10px; border-top: 1px solid var(--px-hair); color: var(--px-quiet); font-size: 15px; }
mark.pv-sel { background: color-mix(in srgb, var(--px-fg) 18%, transparent); color: inherit; border-radius: 2px; }
.pv-linkpop { margin-top: 6px; }
/* the tag map */
.pv-maphead { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding-bottom: 10px; margin-bottom: 8px; border-bottom: 1px solid var(--px-hair); }
.pv-find { flex: 1; min-width: 180px; }
.pv-tree { display: flex; flex-direction: column; gap: 1px; font-size: 15px; }
.pv-trow { display: flex; align-items: center; gap: 6px; min-height: 28px; border-radius: 4px; }
.pv-trow:hover { background: var(--px-wash); }
.pv-root .pv-tname { font-weight: 600; font-size: 16px; }
.pv-tname { font-weight: 500; }
.pv-acts { margin-left: auto; display: inline-flex; gap: 2px; opacity: 0; }
.pv-trow:hover .pv-acts { opacity: 1; }
.pv-prow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-height: 26px; border-radius: 4px; }
.pv-prow:hover { background: var(--px-wash); }
.pv-pn { color: var(--px-quiet); min-width: 72px; }
.pv-inh { opacity: .6; }
.pv-info { margin-left: auto; opacity: 0; height: 20px; padding: 0 4px; }
.pv-prow:hover .pv-info { opacity: 1; }
.pv-ptr { font-size: 14px; padding: 2px 0; }
.pv-ptrlink { border-bottom: 1px solid var(--px-line); }
.pv-group { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--px-faintc); padding: 10px 0 4px 22px; }
.pv-ptop .pv-pn { color: var(--px-fg); font-weight: 500; }
.pv-pinfo { display: flex; flex-direction: column; gap: 3px; padding: 2px 0 8px 70px; font-size: 14px; }
.pv-pline { display: grid; grid-template-columns: 150px 1fr; column-gap: 10px; align-items: baseline; }
.pv-plbl { color: var(--px-faintc); }
.pv-x { height: 18px; padding: 0 2px; font-size: 11px; opacity: 0; }
.pv-pline:hover .pv-x { opacity: 1; }
/* settings */
.pv-settings { border: 1px solid var(--px-hair); border-radius: 8px; box-shadow: 0 8px 28px rgba(0,0,0,.14); background: var(--px-bg); color: var(--px-fg); font-size: 14px; max-width: 700px; }
.pv-shead { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--px-hair); }
.pv-sbody { display: flex; min-height: 260px; }
.pv-snav { display: flex; flex-direction: column; gap: 2px; padding: 12px 8px; border-right: 1px solid var(--px-hair); min-width: 140px; }
.pv-snav .px-quiet { justify-content: flex-start; }
.pv-srows { flex: 1; padding: 6px 16px; }
.pv-srow { display: flex; gap: 16px; align-items: flex-start; padding: 9px 0; border-top: 1px solid var(--px-hair); }
.pv-srow:first-child { border-top: 0; }
.pv-smain { flex: 1; }
.pv-stitle { font-weight: 500; display: flex; align-items: center; gap: 7px; }
.pv-stitle .px-kindicon { font-size: 14px; }
.pv-snav .px-quiet .ti { color: var(--px-faintc); }
.pv-sctl { flex: none; display: flex; align-items: center; gap: 6px; padding-top: 2px; }
.pv-sfoot { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-top: 1px solid var(--px-hair); }
</style>
<div class="wrap">
  <header>
    <h1>The plugin’s views, drawn with the kit</h1>
    <p class="lead">Whole views as they would look after the kit: a page with its two-way rows, the same page with a list open and things picked, an outline being written with proposals, the tag map both ways, the link box, the settings window and the tools. Everything in the plugin’s grammar: it fades away, differences by weight and grey, tags in mono as a class, an action in stages.</p>
    <p class="key"><span class="k-go">Green</span> words are this page’s own marks; every view here is proposed, not what the plugin draws today. The sheets themselves carry no mark of this page: what is on a sheet is exactly what Logseq would show, with no colour of the plugin’s own.</p>
    <div class="toolbar" role="group" aria-label="Sheet colours"><span>Logseq’s theme on the sheets:</span><button type="button" id="light" aria-pressed="true">Light</button><button type="button" id="dark" aria-pressed="false">Dark</button></div>
  </header>

  ${view('page', 'A page: Dr. Mei Chen', 'A Doctor page as Logseq lays it out, with the plugin’s additions. The tag sits beside the title all the time, in mono as a class. Logseq’s own property rows come first; the two-way rows follow on the same grid, as if they were more properties.', page1, [
    '<b>The tag beside the title</b> is Logseq’s own tag in the corner, shown full time, in mono, no #.',
    '<b>Two-way rows</b> sit on Logseq’s grid: name column, values at the same edge. A short row lists its nodes with their day, name and tag; a long row folds to a summary with a chevron.',
    '<b>Nothing shows until needed:</b> the tick boxes in the margin, the + after the last node, the sidebar icon, all appear when the pointer is on the rows.',
    '<b>Logseq’s “Add icon” and “Set property” line</b> keeps its height but is not shown, so nothing on the page moves.',
    '<b>Linked references</b> stay Logseq’s own, folded and quiet; the rows above already say what points here.',
  ])}

  ${view('picked', 'The same page: a list open, three picked', 'The “spoke with” row opened. Filters as quiet words, lines with their tick boxes, three picked, and the bar above the rows: a line of words, no box.', page2, [
    '<b>The bar</b> appears above the rows when the first thing is picked and goes when the last is cleared; Escape clears. The count sits first, the actions as quiet words with icons.',
    '<b>Filters</b> are words: the one in force in the text colour, the others grey.',
    '<b>Picked lines</b> get the wash; unpicked lines show their box faint while the pointer is on the list.',
    '<b>“earlier”</b> is a hairline between what is to come and what has been.',
  ])}

  ${view('outline', 'An outline being written', 'A journal page. The bullet being written has its own properties under it, Logseq’s pills, and the plugin pencils in what it can: a sure value in italic grey, a guess with a dotted line, a tag guess in mono without #. The bullet above was filled a moment ago and keeps its faded Undo arrow.', outline, [
    '<b>Property names</b> are lighter than their values, on pills and on page rows alike. <b>Sure values</b> (the page named in the words) are italic grey; <b>guesses</b> (the topic from the nodes this looks like, the date from “on Friday”) add a dotted line.',
    '<b>A tag guess</b> is a made pill that looks like Logseq’s, the tag in mono without #.',
    '<b>Enter</b> fills in everything shown; <b>Option-Enter</b> stops on each guess; <b>Escape</b> clears them until you type again. The keys line at the bottom is for this page only, not drawn in Logseq.',
    '<b>The Undo arrow</b> stays at the end of the bullet above until it is edited again or the page is left.',
  ])}

  ${view('tags', 'The tag map: Tags', 'The map as an outline of tags. Find field as an underline, Tags | Properties with a hairline between, the tools as quiet words. Under an open tag: its properties with their kind as an icon and what they accept in italic, inherited ones faded with where they come from, the “Shows up here as” line, and the faint line of what can be made.', tagsView, [
    '<b>Rows are the outline:</b> a chevron, the name, a faint count. Top-level tags a little bolder. The + and ⋯ on a row appear on hover.',
    '<b>A property row</b> reads kind icon, name, what it accepts; a second icon when it holds several; “from Occurrence” faint on an inherited one; the info icon on hover opens the help paragraph under it.',
    '<b>“Shows up here as”</b> names the two-way wordings as underlined words; a click opens the small pop-up to reword or turn off.',
    '<b>“+ Property · + Tag inside · + Description”</b> is faint under the open tag, full when the pointer is on it; each opens a line in place (see “An action in stages” on the elements page).',
  ])}

  ${view('props', 'The tag map: Properties', 'The map turned round: every property once, in your groups, with the tags that have it. An open property’s lines say, in plain words, what it holds, which tags have it, what it links to, how it is seen from the other end, its group and its nodes; every change is a quiet word at the end of its line.', propsView, [
    '<b>Groups</b> are small uppercase labels, nothing else; drag a property between them.',
    '<b>An open property</b> lists Value, On tags, Links to, Seen from Doctor as, Group and Nodes with it. Each line ends in the quiet word that changes it: Change…, + Tag, Reword…, Turn off, show nodes. The × on a tag appears on hover.',
    '<b>Kinds are icons:</b> link, choice, date, number; a stack icon for “several”.',
    '<b>+ New property</b> and <b>+ Group</b> are faint at the bottom; + New property walks name, kind and tag on one line, then makes it through Logseq’s own box.',
  ])}

  ${view('link', 'Link selected text', 'Words selected in a bullet, Cmd+Option+L. The box opens under the words with the field as an underline and the pages that fit, each with its tag in mono at the right; Enter links the lit row. New page only when no page has the name.', linkBox, [
    '<b>The field</b> is drawn, not real, so the keystrokes keep going to the bullet and Logseq’s own Cmd+Z takes the link back; it looks like every other field.',
    '<b>Rows</b> show the page and, at the right, its tag in mono or the word “page”.',
    '<b>New page</b> is last and italic, never first while a page fits.',
  ])}

  ${view('settings', 'The settings window', 'The one real window, the browser’s own dialog dressed by the kit: a find field, groups on the left as quiet words, rows of title, a quiet line, and the control at the right: a tick box, two words with a hairline, named things as words with a × on hover, a field as an underline.', settings, [
    '<b>One kind of control per kind of setting:</b> on/off is a tick box, a choice of two is two words, a list of names is words with ×, text is an underline.',
    '<b>Reset</b> is a faint word that appears when a value differs from its default.',
    '<b>Shortcuts</b> are a group like any other, read from the one register, so every shortcut can be changed here, including the ones that are hard-wired today.',
  ])}

  ${view('tools', 'Troubleshooting', 'The tools as a list pop-up from the palette, each with its icon; the measuring switches ticked or not. No window.', tools, [
    '<b>A list pop-up,</b> the same as every other menu, placed by the browser under the palette.',
    '<b>Reports</b> open the same pop-up again with the text to copy and one quiet word, Copy.',
  ])}

  <footer>Built ${new Date().toISOString().slice(0, 10)}. A sketch of whole views with the kit proposed on the elements page (https://claude.ai/artifact/9VE7BaQ8Yz6G14RBpkzZuN), in Logseq’s page layout with its colours approximated. Source of truth: <code>docs/VIEWS.html</code> in the plugin folder.</footer>
</div>
<script>
(function () {
  var wrap = document.querySelector('.wrap'), light = document.getElementById('light'), dark = document.getElementById('dark');
  function set(isDark) { wrap.classList.toggle('dark', isDark); light.setAttribute('aria-pressed', String(!isDark)); dark.setAttribute('aria-pressed', String(isDark)); try { localStorage.setItem('rf-views-theme', isDark ? 'dark' : 'light'); } catch (e) {} }
  light.addEventListener('click', function () { set(false); }); dark.addEventListener('click', function () { set(true); });
  var saved = null; try { saved = localStorage.getItem('rf-views-theme'); } catch (e) {} if (saved === 'dark') set(true);
})();
</script>
`;
fs.writeFileSync(path.join(process.cwd(), 'docs', 'VIEWS.html'), page);
console.log('wrote docs/VIEWS.html', Math.round(page.length / 1024), 'KB');
