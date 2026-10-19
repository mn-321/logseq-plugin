/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Settings panel: a window listing every setting of the plugin, opened from “Refinements settings”
   in Logseq's three-dots menu (top right) or from the command palette. Sections are listed on the
   left under five umbrella groups (0.4.129: Reading a page, Writing a record, Around the page, Tools,
   Paused; the tag tree moved from Paused to Tools in 0.4.155), each with a numbered picture of where its sections work; the search box looks through every
   setting's name and explanation.
   Logseq 2.0.2 gives plugins no way to add to that menu, so the item is added when the menu opens:
   the plugin notices the click on the three-dots button and puts its item under “Plugins”.
   Settings are saved with logseq.updateSettings, the same place Logseq's own settings page writes. */

const { host } = window.refinementShared; // the shared plumbing (parts/shared.js)
const PANEL_CLASS = 'refinement-settings-backdrop';
const ITEM_CLASS = 'refinement-settings-menu-item';
const PLUGIN_ID = 'logseq-db-refinements';
const COPY = String(Date.now()); // tells this copy's menu item from one left by an earlier copy
const SLIDERS_ICON = '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 6l8 0"/><path d="M16 6l4 0"/>' +
  '<path d="M6 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 12l2 0"/><path d="M10 12l10 0"/>' +
  '<path d="M15 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 18l11 0"/><path d="M19 18l1 0"/>';

const css = `
.${ITEM_CLASS}[data-highlighted] { background: var(--lx-gray-04, var(--ls-tertiary-background-color)); }
.${PANEL_CLASS} { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: flex-start; justify-content: center; padding-top: 7vh; background: rgba(0, 0, 0, .25); }
.refinement-settings { --rs-line: color-mix(in srgb, var(--ls-border-color) 70%, transparent); --rs-wash: color-mix(in srgb, var(--ls-primary-text-color) 7%, transparent);
  display: flex; flex-direction: column; width: min(840px, 94vw); height: min(660px, 86vh); border: 1px solid var(--ls-border-color); border-radius: var(--rf-window-radius, 8px); overflow: hidden;
  background: var(--ls-primary-background-color); color: var(--ls-primary-text-color); box-shadow: var(--rf-window-shadow, 0 8px 28px rgba(0, 0, 0, .2)); font-size: 14px; }
.refinement-settings header { display: flex; align-items: center; gap: 12px; padding: 12px 14px 12px 20px; border-bottom: 1px solid var(--ls-border-color); }
.refinement-settings header h2 { margin: 0; width: 170px; flex: none; font-size: 15px; font-weight: 600; }
.refinement-settings .rs-find { flex: 1; position: relative; }
.refinement-settings .rs-find input { width: 100%; box-sizing: border-box; padding: 6px 10px 6px 30px; border: 1px solid var(--ls-border-color); border-radius: 7px; background: transparent; color: inherit; font: inherit; }
.refinement-settings .rs-find svg { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; opacity: .45; pointer-events: none; }
.refinement-settings .rs-find kbd { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); font: inherit; font-size: 11px; opacity: .4; pointer-events: none; }
.refinement-settings .rs-close { border: 0; background: none; color: inherit; opacity: .5; cursor: pointer; font-size: 20px; line-height: 1; padding: 2px 6px; }
.refinement-settings .rs-close:hover { opacity: 1; }
.refinement-settings .rs-main { flex: 1; display: flex; min-height: 0; }
.refinement-settings nav { width: 200px; flex: none; overflow-y: auto; padding: 10px 8px; border-right: 1px solid var(--rs-line); }
.refinement-settings nav button { display: flex; align-items: baseline; gap: 8px; width: 100%; padding: 6px 10px; border: 0; border-radius: 6px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; opacity: .72; }
.refinement-settings nav button:hover { opacity: 1; background: color-mix(in srgb, var(--ls-primary-text-color) 4%, transparent); }
.refinement-settings nav button[aria-current=true] { opacity: 1; background: var(--rs-wash); font-weight: 500; }
.refinement-settings nav button span:first-child { flex: 1; }
.refinement-settings nav .rs-count { font-size: 12px; opacity: .5; font-weight: 400; }
.refinement-settings nav hr { border: 0; border-top: 1px solid var(--rs-line); margin: 8px 10px; }
.refinement-settings.rs-searching nav button { opacity: .45; }
.refinement-settings.rs-searching nav button.rs-has-hits { opacity: .9; }
.refinement-settings .rs-body { flex: 1; overflow-y: auto; padding: 4px 24px 24px; }
.refinement-settings section { padding-top: 16px; }
.refinement-settings section h3 { margin: 0; font-size: 15px; font-weight: 600; }
.refinement-settings.rs-listing section h3 { font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; opacity: .5; }
.refinement-settings .rs-note { margin-top: 3px; font-size: 12.5px; line-height: 1.45; opacity: .6; }
.refinement-settings.rs-listing .rs-note { display: none; }
.refinement-settings .rs-rows { margin-top: 8px; }
.refinement-settings .rs-row { display: flex; align-items: flex-start; gap: 20px; padding: 11px 0; border-top: 1px solid var(--rs-line); }
.refinement-settings .rs-row:first-child { border-top: 0; }
.refinement-settings .rs-text { flex: 1; min-width: 0; }
.refinement-settings .rs-title { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; font-weight: 500; }
.refinement-settings .rs-tag { font-size: 11px; font-weight: 400; padding: 0 6px; border-radius: 4px; background: var(--rs-wash); opacity: .75; }
.refinement-settings .rs-reset { border: 0; padding: 0; background: none; color: inherit; font: inherit; font-size: 12px; font-weight: 400; text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 35%, transparent); text-underline-offset: 2px; cursor: pointer; opacity: 0; }
.refinement-settings .rs-row:hover .rs-reset, .refinement-settings .rs-reset:focus { opacity: .6; }
.refinement-settings .rs-reset:hover { opacity: 1 !important; }
.refinement-settings .rs-changed::before { content: ''; display: inline-block; width: 6px; height: 6px; margin: 0 7px 2px 0; border-radius: 50%; background: color-mix(in srgb, var(--ls-primary-text-color) 45%, transparent); vertical-align: middle; }
.refinement-settings .rs-desc { margin-top: 3px; font-size: 12.5px; line-height: 1.45; opacity: .62; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.refinement-settings .rs-desc.rs-open, .refinement-settings.rs-searching .rs-desc { display: block; -webkit-line-clamp: unset; }
.refinement-settings .rs-more { border: 0; padding: 0; margin-top: 2px; background: none; color: inherit; font: inherit; font-size: 12px; opacity: .5; cursor: pointer; }
.refinement-settings .rs-more:hover { opacity: .9; }
.refinement-settings.rs-searching .rs-more { display: none; }
.refinement-settings .rs-hit { border-radius: 2px; background: color-mix(in srgb, var(--ls-primary-text-color) 13%, transparent); box-shadow: inset 0 -1px color-mix(in srgb, var(--ls-primary-text-color) 45%, transparent); }
.refinement-settings .rs-control { flex: none; display: flex; align-items: flex-start; gap: 14px; padding-top: 1px; }
.refinement-settings .rs-pv { width: 172px; height: 54px; box-sizing: border-box; overflow: hidden; padding: 5px 8px; border: 1px solid var(--rs-line); border-radius: 6px; background: color-mix(in srgb, var(--ls-primary-text-color) 2%, transparent); font-size: 11px; line-height: 1.4; white-space: nowrap; cursor: pointer; }
.refinement-settings .rs-pv i, .refinement-settings .rs-pv u { font-style: normal; }
.refinement-settings .rs-pv u { text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 30%, transparent); text-underline-offset: 2px; }
.refinement-settings .rs-pv .t { font-size: 14px; font-weight: 600; line-height: 1.25; }
.refinement-settings .rs-pv .h { font-weight: 600; }
.refinement-settings .rs-pv .m, .refinement-settings .rs-pv .pn { opacity: .55; }
.refinement-settings .rs-pv .m { font-size: 10px; }
.refinement-settings .rs-pv .b { display: inline-block; width: 4px; height: 4px; margin: 0 5px 2px 0; border-radius: 50%; background: currentColor; opacity: .4; vertical-align: middle; }
.refinement-settings .rs-pv .row { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
.refinement-settings .rs-pv .ind { padding-left: 9px; }
.refinement-settings .rs-pv .tg { color: #4f8bd6; }
.refinement-settings .rs-pv .tg.chip { color: inherit; padding: 0 3px; border-radius: 3px; background: color-mix(in srgb, #8b7fc7 20%, transparent); }
.refinement-settings .rs-pv .lk { color: #2f7fd1; }
.refinement-settings .rs-pv .ql { text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 30%, transparent); text-underline-offset: 2px; }
.refinement-settings .rs-pv .here { background: color-mix(in srgb, var(--ls-primary-text-color) 9%, transparent); box-shadow: inset 0 -1px color-mix(in srgb, var(--ls-primary-text-color) 40%, transparent); }
.refinement-settings .rs-pv .nest { margin-left: 1px; padding-left: 8px; border-left: 1px solid; }
.refinement-settings .rs-pv .nest.faint { border-color: color-mix(in srgb, var(--ls-primary-text-color) 12%, transparent); }
.refinement-settings .rs-pv .nest.firm { border-color: color-mix(in srgb, var(--ls-primary-text-color) 40%, transparent); }
.refinement-settings .rs-pv .pill { padding: 0 5px; border: 1px solid var(--ls-border-color); border-radius: 8px; font-size: 10px; }
.refinement-settings .rs-pv .chev { opacity: .5; }
.refinement-settings .rs-pv .emb { margin-left: 3px; padding-left: 6px; border-left: 1px solid transparent; }
.refinement-settings .rs-pv .emb.line { border-left-color: color-mix(in srgb, var(--ls-primary-text-color) 25%, transparent); }
.refinement-settings .rs-pv .dbox { padding: 0 3px; border-radius: 3px; background: color-mix(in srgb, var(--ls-primary-text-color) 8%, transparent); }
.refinement-settings .rs-pv .pic { display: inline-block; width: 7px; height: 9px; margin-right: 5px; border-radius: 1px; vertical-align: -1px; }
.refinement-settings .rs-pv .pic.outline { border: 1px solid currentColor; opacity: .5; }
.refinement-settings .rs-pv .pic.filled { background: currentColor; opacity: .35; }
.refinement-settings .rs-pv .menu { display: inline-block; margin: 1px 0 0 9px; padding: 1px 5px; border: 1px solid var(--ls-border-color); border-radius: 4px; font-size: 10px; line-height: 1.3; }
.refinement-settings .rs-pv .hl { background: #fde68a; color: #1f1f1f; }
.refinement-settings .rs-pv .wash { background: color-mix(in srgb, var(--ls-primary-text-color) 12%, transparent); }
.refinement-settings .rs-pv .side { padding-left: 6px; border-left: 1px solid var(--rs-line); font-size: 10px; line-height: 1.3; }
.refinement-settings .rs-control input[type=text] { width: 200px; padding: 4px 8px; border: 1px solid var(--ls-border-color); border-radius: 6px; background: transparent; color: inherit; font: inherit; font-size: 13px; }
.refinement-settings .rs-switch { position: relative; display: block; width: 32px; height: 18px; border: 0; border-radius: 9px; padding: 0; cursor: pointer; background: color-mix(in srgb, var(--ls-primary-text-color) 18%, transparent); transition: background .12s; }
.refinement-settings .rs-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--ls-primary-background-color); box-shadow: 0 1px 2px rgba(0, 0, 0, .15); transition: transform .12s; }
.refinement-settings .rs-switch[aria-checked=true] { background: color-mix(in srgb, var(--ls-primary-text-color) 65%, transparent); }
.refinement-settings .rs-switch[aria-checked=true]::after { transform: translateX(14px); }
.refinement-settings .rs-choices { display: flex; border: 1px solid var(--ls-border-color); border-radius: 6px; overflow: hidden; }
.refinement-settings .rs-choices button { border: 0; padding: 3px 10px; background: transparent; color: inherit; font: inherit; font-size: 13px; cursor: pointer; opacity: .6; }
.refinement-settings .rs-choices button[aria-pressed=true] { opacity: 1; background: var(--rs-wash); }
.refinement-settings .rs-list { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; padding: 5px 6px; border: 1px solid var(--ls-border-color); border-radius: 7px; cursor: text; }
.refinement-settings .rs-list:focus-within { border-color: color-mix(in srgb, var(--ls-primary-text-color) 40%, transparent); }
.refinement-settings .rs-chip { display: inline-flex; align-items: center; gap: 2px; padding: 1px 2px 1px 8px; border-radius: 5px; background: var(--rs-wash); font-size: 13px; cursor: default; }
.refinement-settings .rs-chip button { border: 0; padding: 0 5px; background: none; color: inherit; font: inherit; font-size: 14px; line-height: 1.2; opacity: .45; cursor: pointer; }
.refinement-settings .rs-chip button:hover { opacity: 1; }
.refinement-settings .rs-list input { flex: 1; min-width: 90px; padding: 2px 4px; border: 0; background: transparent; color: inherit; font: inherit; font-size: 13px; outline: none; box-shadow: none; }
.refinement-settings .rs-list input::-webkit-calendar-picker-indicator { display: none !important; }
.refinement-settings .rs-empty { padding: 40px 0; text-align: center; opacity: .55; }
.refinement-settings footer { display: flex; align-items: center; gap: 10px; padding: 10px 14px 10px 20px; border-top: 1px solid var(--ls-border-color); font-size: 12.5px; }
.refinement-settings footer .rs-status { flex: 1; opacity: .6; }
.refinement-settings footer .rs-status.rs-needs-reload { opacity: 1; }
.refinement-settings footer button { padding: 4px 10px; border: 1px solid var(--ls-border-color); border-radius: 6px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.refinement-settings footer button:hover, .refinement-settings .rs-find input:focus, .refinement-settings .rs-control input:focus { border-color: color-mix(in srgb, var(--ls-primary-text-color) 40%, transparent); outline: none; box-shadow: none; }
.refinement-settings [hidden] { display: none !important; }
/* Umbrella groups (0.4.129): a group label in the list on the left with its sections under it, and a picture
   at the top of the page that shows where on screen each section works, numbered like the list beside it. */
.refinement-settings nav .rs-group { margin-top: 12px; padding: 5px 10px; font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; opacity: .55; }
.refinement-settings nav .rs-group:first-child { margin-top: 0; }
.refinement-settings nav .rs-group[aria-current=true] { opacity: 1; }
.refinement-settings nav .rs-sec { padding-left: 18px; }
.refinement-settings .rs-card { margin-top: 16px; padding: 12px 14px 14px; border: 1px solid var(--rs-line); border-radius: 9px; background: color-mix(in srgb, var(--ls-primary-text-color) 2%, transparent); }
.refinement-settings .rs-card-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.refinement-settings .rs-card-title { font-size: 15px; font-weight: 600; }
.refinement-settings .rs-card-note { font-size: 12.5px; opacity: .62; }
.refinement-settings .rs-card-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(150px, 205px); gap: 14px; align-items: start; }
.refinement-settings .rs-art { display: grid; gap: 6px; min-width: 0; font-size: 12px; line-height: 1.45; }
.refinement-settings .rs-zone { position: relative; min-width: 0; padding: 6px 8px 6px 30px; border: 1px solid var(--rs-line); border-radius: 7px; background: var(--ls-primary-background-color); cursor: pointer; overflow: hidden; }
.refinement-settings .rs-zone::before, .refinement-settings .rs-legend .rs-n { content: attr(data-n); display: grid; place-items: center; width: 16px; height: 16px; border: 1px solid currentColor; border-radius: 50%; font-size: 10px; font-weight: 600; line-height: 1; opacity: .7; }
.refinement-settings .rs-zone::before { position: absolute; left: 7px; top: 7px; }
.refinement-settings .rs-art.rs-focus .rs-zone { opacity: .45; }
.refinement-settings .rs-art.rs-focus .rs-zone[aria-current], .refinement-settings .rs-zone:hover { opacity: 1 !important; border-color: color-mix(in srgb, var(--ls-primary-text-color) 35%, transparent); }
.refinement-settings .rs-zone.rs-off > * { opacity: .45; text-decoration: line-through; text-decoration-color: color-mix(in srgb, currentColor 45%, transparent); }
.refinement-settings .rs-zone.rs-off { padding-right: 56px; }
.refinement-settings .rs-zone.rs-off::after { content: 'paused'; position: absolute; right: 8px; top: 7px; font-size: 10px; opacity: .6; }
.refinement-settings .rs-art .win { display: grid; grid-template-columns: 1fr 1.5fr 1fr; gap: 6px; }
.refinement-settings .rs-art .win .rs-zone { padding-top: 26px; padding-left: 8px; }
.refinement-settings .rs-art .m { opacity: .55; }
.refinement-settings .rs-art .t { font-size: 15px; font-weight: 600; line-height: 1.25; }
.refinement-settings .rs-art .h { font-weight: 600; }
.refinement-settings .rs-art .b { display: inline-block; width: 4px; height: 4px; margin: 0 6px 2px 0; border-radius: 50%; background: currentColor; opacity: .4; vertical-align: middle; }
.refinement-settings .rs-art .row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.refinement-settings .rs-art .ind { padding-left: 10px; }
.refinement-settings .rs-art u { text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 30%, transparent); text-underline-offset: 2px; }
.refinement-settings .rs-art .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; }
.refinement-settings .rs-art .dbox { padding: 0 3px; border-radius: 3px; background: color-mix(in srgb, var(--ls-primary-text-color) 8%, transparent); }
.refinement-settings .rs-art .pencil { font-style: italic; opacity: .6; }
.refinement-settings .rs-art .cap { display: inline-block; padding: 0 3px; border: 1px solid var(--ls-border-color); border-bottom-width: 2px; border-radius: 3px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; line-height: 1.3; opacity: .75; }
.refinement-settings .rs-art .caret { display: inline-block; width: 1px; height: 1em; margin-left: 1px; background: currentColor; vertical-align: -2px; }
.refinement-settings .rs-art .menu { display: inline-block; margin: 3px 0 0 10px; padding: 2px 0; border: 1px solid var(--ls-border-color); border-radius: 5px; font-size: 11px; }
.refinement-settings .rs-art .menu .mrow { display: flex; gap: 10px; justify-content: space-between; padding: 0 8px; }
.refinement-settings .rs-art .menu .mrow.sel { background: color-mix(in srgb, var(--ls-primary-text-color) 7%, transparent); }
.refinement-settings .rs-art .box { padding: 1px 6px; border: 1px solid var(--ls-border-color); border-radius: 4px; margin-bottom: 3px; }
.refinement-settings .rs-art .tb { margin-top: 4px; padding-top: 3px; border-top: 1px solid var(--rs-line); opacity: .6; font-size: 11px; }
.refinement-settings .rs-art .doc { margin: 4px 0 0 10px; padding: 4px 8px; border: 1px solid var(--rs-line); border-radius: 4px; box-shadow: 0 1px 3px rgba(0, 0, 0, .08); }
.refinement-settings .rs-legend { display: grid; gap: 2px; align-content: start; }
.refinement-settings .rs-legend button { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 4px; align-items: start; padding: 5px 6px; border: 0; border-radius: 6px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; opacity: .75; }
.refinement-settings .rs-legend button:hover, .refinement-settings .rs-legend button[aria-current] { opacity: 1; background: var(--rs-wash); }
.refinement-settings .rs-legend .rs-n { margin-top: 1px; }
.refinement-settings .rs-legend b { display: block; font-weight: 600; font-size: 13px; }
.refinement-settings .rs-legend .rs-d { display: block; font-size: 12px; line-height: 1.35; opacity: .65; }
.refinement-settings .rs-legend button.rs-off b::after { content: ' · paused'; font-weight: 400; opacity: .6; }
/* One section on screen: the picture keeps its zones, the list beside it says only the section's own words, so the settings start higher. */
.refinement-settings .rs-card.rs-card-focus .rs-card-note, .refinement-settings .rs-card.rs-card-focus .rs-legend button:not([aria-current]) .rs-d { display: none; }
.refinement-settings .rs-row.rs-paused > .rs-text, .refinement-settings .rs-row.rs-paused > .rs-control { opacity: .45; }
`;
const SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M21 21l-6 -6"/></svg>';

/* Small pictures of what a look setting changes, drawn beside its switch. Each one shows the setting's
   current state (on or off) and changes when the switch is flipped. Only settings with a visible
   effect have one. */
const B = '<i class="b"></i>';
const PREVIEWS = {
  showTitleChrome: on => `<div class="m">${on ? 'Add icon · Set property · <span class="tg">#Project</span>' : '&nbsp;'}</div><div class="t">Echo</div>`,
  showPageKind: on => on ? `<div class="m"><span class="tg">#Project</span></div><div class="t">Echo</div>`
    : `<div class="m">&nbsp;</div><div class="row"><span class="t">Echo</span><span class="tg">#Project</span></div>`,
  showAliasOf: on => `<div class="t">JS</div>${on ? '<div class="m">Alias of <u>JavaScript</u></div>' : ''}`,
  markReferenceHere: on => `<div class="m">Linked references</div><div>${B}Call with <span class="${on ? 'here' : 'ql'}">Mateo</span> about it</div>`,
  showShape: on => `<div class="t"># Doctor</div>${on ? '<div class="m"><span class="tg">#Person</span> › #Doctor · 2 fields&nbsp; ▸</div>' : ''}`,
  quietEmptyBullets: on => `<div>${B}Milk</div><div>${on ? '<i class="b" style="visibility:hidden"></i>' : B}&nbsp;</div><div>${B}Call Mateo</div>`,
  indentGuides: on => `<div>${B}Plan</div><div class="nest ${on ? 'faint' : 'firm'}"><div>${B}Draft</div><div>${B}Review</div></div>`,
  ownTagHidden: on => `<div class="t"># Task</div><div class="row"><span>${B}Renew certificate</span>${on ? '' : '<span class="tg">#Task</span>'}</div><div class="row"><span>${B}Send invites</span>${on ? '' : '<span class="tg">#Task</span>'}</div>`,
  compactJournals: on => `<div class="h">Oct 15th</div>${on ? '' : '<div>&nbsp;</div><div>&nbsp;</div>'}<div class="h">Oct 14th</div><div>${B}Call Mateo</div>`,
  quietSidebarIcons: on => `<div><span class="m">#</span> Project</div><div>${on ? '<span class="m" style="visibility:hidden">#</span> ' : '<span class="pic outline"></span>'}Mateo Ruiz</div><div class="${on ? 'm' : ''}">${on ? '<span class="m" style="visibility:hidden">#</span> ' : '<span class="pic outline"></span>'}Oct 14th</div>`,
  plainProperties: on => `<div>${B}Echo</div><div class="ind">${on
    ? '<span class="pn">stage:</span> Idea <span class="m">·</span> <span class="pn">owner:</span> Mateo'
    : '<span class="pill">stage Idea</span> <span class="pill">owner Mateo</span>'}</div>`,
  hiddenPropsChevron: on => `<div>${B}Send invites${on ? ' <span class="chev">›</span>' : ''}</div><div class="m ind">Deadline: Oct 30</div>`,
  childTypeCues: on => `<div>${B}Launch plan${on ? ' <span class="m">↳ ◌ 2</span>' : ''}</div>`,
  embedLine: on => `<div>${B}See:</div><div class="emb ${on ? 'line' : ''}">${B}Embedded block</div>`,
  dateStyle: on => `<div>${B}Due <span class="${on ? 'dbox' : 'lk'}">Oct 14th, 2026</span></div>`,
  plainPageIcons: on => `<div><span class="pic ${on ? 'outline' : 'filled'}"></span>Echo</div><div><span class="pic ${on ? 'outline' : 'filled'}"></span>Compass</div>`,
  tintTags: on => `<div>${B}Kickoff <span class="tg ${on ? 'chip' : ''}">#Project</span></div>`,
  quietLinks: on => `<div>${B}Ask <span class="${on ? 'ql' : 'lk'}">Mateo Ruiz</span> about <span class="${on ? 'ql' : 'lk'}">Echo</span></div>`,
  referenceLayout: on => `<div class="m">Linked references</div><div class="h">Echo${on ? ' <span class="m">3</span>' : ''}</div><div>${B}Kickoff call</div>`,
  referenceIcons: on => `<div>${B}${on ? '<span class="m">•</span> ' : ''}<span class="${on ? 'plain' : 'ql'}">the budget block</span></div><div>${B}${on ? '<span class="m">▤</span> ' : ''}<span class="ql">report</span>${on ? ' <span class="m">PDF</span>' : ''}</div>`,
  linkLabels: on => `<div class="m">Linked references</div><div>${B}${on ? '<span class="pn">Doctor:</span> ' : ''}<span class="ql">Mateo Ruiz</span></div>`,
  tidyPaths: on => `<div class="m">${on ? 'Project / Echo / Kickoff notes' : '[[Project]] / [[Echo]] / Kic…'}</div><div>${B}Found here</div>`,
  quietLinkMenu: on => `<div>${B}[[</div><div class="menu">${on ? '<span class="m">type to find a page</span>' : 'Today<br>Tomorrow'}</div>`,
  hyperLinkTap: on => `<div>${B}Call ${on ? '[[<span class="m">▏</span>]]' : ''}</div><div class="m">${on ? 'Hyper tapped: link started' : 'Hyper tapped: nothing'}</div>`,
  dateLinkFormats: on => `<div>${B}[[2026 10 14</div><div class="menu">${on ? 'Oct 14th, 2026' : '<span class="m">New page “2026 10 14”</span>'}</div>`,
  pdfCitations: on => on ? `<div><span class="m">❝ p. 3 · Report</span> Talking felt faster</div>` : `<div>${B}<span class="hl">Talking felt faster</span></div>`,
  pageLabels: on => `<div>${B}Call <span class="ql">Mateo Ruiz${on ? '' : ' #doctor'}</span></div>`,
  tidySidebar: on => `<div class="m">Page graph${on ? '' : ' · Undo · Redo · Profiler'}</div><div>${B}Echo</div>`,
  tidySearch: on => `<div>${B}Kickoff for <span class="${on ? 'wash' : 'hl'}">Echo</span></div><div>${B}<span class="${on ? 'wash' : 'hl'}">Echo</span> budget</div>`,
  groupSearch: on => on ? `<div class="h">Echo</div><div class="ind">${B}Kickoff · ${B}Budget</div>` : `<div>${B}Kickoff <span class="m">Echo</span></div><div>${B}Budget <span class="m">Echo</span></div>`,
  searchDetails: on => `<div class="row"><span>${B}Echo</span>${on ? '<span class="m">#Project · today</span>' : ''}</div>`,
  roomySearch: on => on ? `<div style="font-size:12px">${B}Echo kickoff</div><div style="font-size:12px;margin-top:3px">${B}Echo budget</div>`
    : `<div style="font-size:10px;line-height:1.2">${B}Echo kickoff<br>${B}Echo budget<br>${B}Echo notes</div>`,
  searchFilters: on => `<div class="menu" style="margin-left:0">${on ? '<span class="pill">#Task</span> todo' : '#Task todo'}</div><div class="m">${on ? '3 open tasks tagged Task' : 'pages mentioning “Task todo”'}</div>`,
  searchPreview: on => `<div class="row"><span>${B}Echo</span>${on ? '<span class="side">Echo<br>· Kickoff</span>' : ''}</div>`,
};

/* Umbrella groups (0.4.129): the sections gathered by what they are for, each group with a picture of where on
   screen its sections work. A zone of the picture is marked data-section with the heading key of the section it
   explains; the number on it is given when it is drawn, so the picture and the list beside it always agree. A
   section no group names goes into Other. */
const ART_B = '<i class="b"></i>';
const GROUPS = [
  { key: 'reading', title: 'Reading a page', note: 'How pages, rows and links look. Nothing here writes to your notes.',
    headings: ['pageHeading', 'hierarchyHeading', 'twoWayHeading', 'linksHeading'],
    legend: { pageHeading: 'Around the title: what the page is, its tags and path, how it is used',
      hierarchyHeading: 'The rows: properties, empty slots, dates, what a folded block holds',
      twoWayHeading: 'Records that point at this page, as rows in its own properties',
      linksHeading: 'Links: the mark before a link, references, the pickers' },
    art: () => `
      <div class="rs-zone" data-section="pageHeading"><div class="m">Add icon · Set property &nbsp;<span class="mono">Project</span></div><div class="t">Echo</div><div class="m"># Entity › # Project</div></div>
      <div class="rs-zone" data-section="hierarchyHeading"><div class="row"><span>${ART_B}Kickoff call <span class="m">↳ ● 2 · 1 Decision</span></span><span class="mono m">Meeting</span></div>
        <div class="ind"><span class="m">attendees:</span> <u>Mateo Ruiz</u> <span class="m">·</span> <span class="m">date:</span> <span class="dbox">Oct 14th</span> <span class="m">· Scheduled: ···</span></div></div>
      <div class="rs-zone" data-section="twoWayHeading"><div><span class="m">← doctor of</span> &nbsp;<u>9 Appointments</u> <span class="m">· next Nov 12</span></div></div>
      <div class="rs-zone" data-section="linksHeading"><div>${ART_B}Ask <u>Mateo Ruiz</u> about <span class="m">•</span> the budget block</div><div class="m">Linked references &nbsp; attendees · 3 &nbsp; in text · 4</div></div>` },
  { key: 'writing', title: 'Writing a record', note: 'Help while you write: a list for a field, values guessed from your words, the journal day. Nothing is written until you press a key.',
    headings: ['inlinePropsHeading', 'proposalsHeading', 'journalDateHeading'],
    legend: { inlinePropsHeading: 'Type a field’s name and :: and pick its value from a list',
      proposalsHeading: 'Values guessed from your words, pencilled in; Tab takes one',
      journalDateHeading: 'The day you wrote a record on, as its date' },
    art: () => `
      <div class="rs-zone" data-section="inlinePropsHeading"><div>${ART_B}Met Priya about Atlas <span class="mono">o::pri</span><span class="caret"></span></div>
        <div class="menu"><div class="mrow sel"><span>▭ Priya Nair</span><span class="m mono">Person</span></div><div class="mrow"><span class="pencil">+ Make Person “pri”</span></div></div></div>
      <div class="rs-zone" data-section="proposalsHeading"><div><span class="m">attendees:</span> <span class="pencil">Priya Nair</span> <span class="m"><span class="cap">tab</span> takes · <span class="cap">⇧tab</span> passes</span></div>
        <div><span class="m">project:</span> <u>Atlas</u> <span class="m">undo <span class="cap">⌘z</span></span></div></div>
      <div class="rs-zone" data-section="journalDateHeading"><div><span class="m">date:</span> <span class="pencil">Oct 18th, 2026</span> <span class="m">· the day the record was written</span></div></div>` },
  { key: 'around', title: 'Around the page', note: 'The sidebars, the toolbar and search.',
    headings: ['appearanceHeading', 'searchHeading', 'searchSidebarHeading'],
    legend: { appearanceHeading: 'The left and right sidebars and the toolbar',
      searchHeading: 'The search window: grouping, details, a preview',
      searchSidebarHeading: 'Search kept open in the right sidebar' },
    art: () => `<div class="win">
      <div class="rs-zone" data-section="appearanceHeading"><div class="m">Favorites</div><div>Echo</div><div class="m">Recent</div><div>Mateo Ruiz</div><div class="m">Oct 14th</div><div class="tb">⌂ ← → ···</div></div>
      <div class="rs-zone" data-section="searchHeading"><div class="box">echo</div><div class="h">Echo</div><div class="ind">${ART_B}Kickoff <span class="m">· today</span></div><div class="ind">${ART_B}Budget <span class="m">· Oct 9</span></div></div>
      <div class="rs-zone" data-section="searchSidebarHeading"><div class="h">Search</div><div class="box">echo</div><div>${ART_B}Kickoff</div></div></div>` },
  { key: 'tools', title: 'Tools', note: 'Copying for people who don’t use Logseq, the tag tree, and the plugin’s keys.',
    headings: ['richCopyHeading', 'tagTreeHeading', 'shortcutsHeading'],
    legend: { richCopyHeading: 'Copy a page or a block as tidy formatted text',
      tagTreeHeading: 'All your tags as one tree',
      shortcutsHeading: 'Keys for linking, tagging, deleting and new blocks' },
    art: () => `
      <div class="rs-zone" data-section="richCopyHeading"><div class="row"><span>${ART_B}Kickoff call</span><span class="m">Copy as rich text</span></div>
        <div class="doc"><b>Kickoff call</b><br><span class="m">Attendees: Mateo Ruiz · Oct 14th, 2026</span></div></div>
      <div class="rs-zone" data-section="tagTreeHeading"><div># Entity</div><div class="ind"># Person &nbsp;<span class="m"># Company</span></div></div>
      <div class="rs-zone" data-section="shortcutsHeading"><div><span class="cap">⌘⌥L</span> Link selected text to a page</div><div><span class="cap">⌘T</span> Add tags to this page</div><div><span class="cap">⌥↩</span> New block at the outermost level</div></div>` },
  { key: 'paused', title: 'Paused', note: 'Switched off for now. Turn one on with its first switch, then reload the plugin.',
    headings: ['todosHeading', 'expectationsHeading'],
    legend: { todosHeading: 'Every task in the graph in one list',
      expectationsHeading: 'What you are waiting on others for' },
    art: () => `
      <div class="rs-zone" data-section="todosHeading"><div class="row"><span>◯ Renew certificate</span><span class="m">today</span></div><div class="row"><span>◯ Send invites</span><span class="m">Fri</span></div></div>
      <div class="rs-zone" data-section="expectationsHeading"><div class="row"><span>⧗ Contract back from Kestrel</span><span class="m">waiting</span></div></div>` },
];
// A paused part's sections, by the switch that turns it back on. The tag tree, on since 0.4.152, sits in Tools
// and steps back the same way when its switch is turned off.
const PAUSE_SWITCH = { todosHeading: 'todosEnabled', expectationsHeading: 'todosEnabled', tagTreeHeading: 'tagTreeEnabled' };
function groupsOf(sections) {
  const groups = GROUPS.map(group => ({ ...group, sections: [] }));
  const other = { key: 'other', title: 'Other', note: '', headings: [], legend: {}, art: null, sections: [] };
  for (const section of sections) (groups.find(group => group.headings.includes(section.heading.key)) || other).sections.push(section);
  for (const group of groups) group.sections.sort((a, b) => group.headings.indexOf(a.heading.key) - group.headings.indexOf(b.heading.key));
  const shown = [...groups, other].filter(group => group.sections.length);
  for (const group of shown) for (const section of group.sections) section.group = group;
  return shown;
}

// The plugin's whole settings list, as given to Logseq (main.js gives its own and every part's).
const schema = () => logseq._settingsSchema || [];
const valueOf = item => {
  const value = logseq.settings?.[item.key];
  return value === undefined || value === null || typeof value !== typeof item.default ? item.default : value;
};
const RELOAD_RE = /after you reload/i;
// Settings that hold several names separated by commas are shown as separate items.
const isList = item => item.type === 'string' && /^Comma-separated/i.test(item.description || '');
// “Applies right away.” is the usual case and goes unsaid; “after you reload” becomes a small tag.
const tidyText = text => (text || '').replace(/\s*(Changes here apply|Changes to [^.]* apply|Applies) (right away|after you reload the plugin)\.?/g, '').trim();
// Shortcuts are looked up least often, so they come last.
const LAST_SECTIONS = ['shortcutsHeading'];
let lastSection = null;

function el(doc, tag, props = {}, ...children) {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key in node && typeof value !== 'string') node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter(child => child != null));
  return node;
}
// Text with the searched words picked out.
function fillMarked(doc, node, text, words) {
  node.textContent = '';
  if (!words.length) { node.textContent = text; return; }
  const re = new RegExp(words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
  let at = 0;
  for (const match of text.matchAll(re)) {
    if (match.index > at) node.append(text.slice(at, match.index));
    node.append(el(doc, 'span', { class: 'rs-hit' }, match[0]));
    at = match.index + match[0].length;
  }
  if (at < text.length) node.append(text.slice(at));
}

// Settings grouped under their headings, in the order shown in the list on the left.
function sectionsOf(items) {
  const sections = [];
  let current = null;
  for (const item of items) {
    if (item.type === 'heading') { current = { heading: item, items: [] }; sections.push(current); continue; }
    if (!current) { current = { heading: { key: 'general', title: 'General' }, items: [] }; sections.push(current); }
    if (['boolean', 'string', 'number', 'enum'].includes(item.type)) current.items.push(item);
  }
  // Lists kept by other windows (such as rich copy's left-out properties) are not shown.
  return sections.filter(section => section.items.length)
    .sort((a, b) => LAST_SECTIONS.includes(a.heading.key) - LAST_SECTIONS.includes(b.heading.key));
}

function open() {
  const doc = host();
  doc.querySelector('.' + PANEL_CLASS)?.remove();
  let reloadWanted = false;
  const backdrop = el(doc, 'div', { class: PANEL_CLASS });

  const status = el(doc, 'span', { class: 'rs-status' }, 'Changes are saved as you make them.');
  const save = (entry, value) => {
    logseq.updateSettings({ [entry.item.key]: value });
    entry.value = value;
    entry.markChanged();
    entry.drawPreview?.(value);
    if (entry.reload) reloadWanted = true;
    if (Object.values(PAUSE_SWITCH).includes(entry.item.key)) markPaused();
    status.textContent = reloadWanted ? 'Saved. Some changes show after you reload the plugin.' : 'Saved.';
    status.classList.toggle('rs-needs-reload', reloadWanted);
    updateCounts();
  };

  /* A comma-separated setting (tags, graph names, sidebar items) as separate items: each one with a
     × to remove it, and a box at the end to add more (Enter or a comma adds; Backspace in the empty
     box takes back the last). It is still saved as one comma-separated line, which is what the
     parts read. Tag settings suggest the graph's tags. */
  const listControl = entry => {
    const { item } = entry;
    let items = [];
    const box = el(doc, 'div', { class: 'rs-list', role: 'group', 'aria-label': item.title });
    const input = el(doc, 'input', { type: 'text', spellcheck: 'false', placeholder: 'Add…', 'aria-label': `Add to ${item.title}` });
    if (/tag/i.test(item.key)) {
      const list = el(doc, 'datalist', { id: `rs-list-${item.key}` });
      input.setAttribute('list', list.id);
      box.append(list);
      logseq.Editor.getAllTags?.().then(tags => {
        for (const name of [...new Set((tags || []).map(tag => tag.title || tag.originalName || tag.name).filter(Boolean))].sort()) list.append(el(doc, 'option', { value: name }));
      }).catch(() => {});
    }
    const commit = () => save(entry, items.join(', '));
    const draw = () => {
      for (const chip of [...box.querySelectorAll('.rs-chip')]) chip.remove();
      for (const [index, name] of items.entries()) {
        const remove = el(doc, 'button', { 'aria-label': `Remove ${name}`, title: 'Remove' }, '×');
        remove.addEventListener('click', () => { items.splice(index, 1); draw(); commit(); });
        input.before(el(doc, 'span', { class: 'rs-chip' }, el(doc, 'span', {}, name), remove));
      }
    };
    const add = () => {
      const fresh = input.value.split(',').map(word => word.trim().replace(/^#/, '')).filter(Boolean)
        .filter(word => !items.some(have => have.toLowerCase() === word.toLowerCase()));
      input.value = '';
      if (!fresh.length) return;
      items.push(...fresh);
      draw();
      commit();
    };
    for (const type of ['keydown', 'keyup', 'keypress']) input.addEventListener(type, event => {
      if (event.key !== 'Escape') event.stopPropagation();
      if (type !== 'keydown') return;
      if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(); }
      else if (event.key === 'Backspace' && !input.value && items.length) { items.pop(); draw(); commit(); }
    });
    // A tag picked from the suggestions is added at once.
    input.addEventListener('input', event => { if (event.inputType === 'insertReplacementText' || !event.inputType) add(); });
    input.addEventListener('blur', add);
    box.addEventListener('mousedown', event => { if (event.target === box) { event.preventDefault(); input.focus(); } });
    box.append(input);
    const show = value => { items = String(value ?? '').split(',').map(word => word.trim()).filter(Boolean); draw(); };
    return [box, show, true];
  };

  // One control per kind of setting; each returns the control and a way to show a new value in it.
  const control = entry => {
    const { item } = entry;
    if (item.type === 'boolean') {
      const sw = el(doc, 'button', { class: 'rs-switch', role: 'switch', 'aria-label': item.title });
      const show = value => sw.setAttribute('aria-checked', String(value));
      sw.addEventListener('click', () => { const next = sw.getAttribute('aria-checked') !== 'true'; show(next); save(entry, next); });
      return [sw, show];
    }
    if (item.type === 'enum') {
      const box = el(doc, 'div', { class: 'rs-choices', role: 'group', 'aria-label': item.title });
      const show = value => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.choice === value)); };
      for (const choice of item.enumChoices || []) {
        const b = el(doc, 'button', {}, choice);
        b.dataset.choice = choice;
        b.addEventListener('click', () => { show(choice); save(entry, choice); });
        box.append(b);
      }
      return [box, show];
    }
    if (isList(item)) return listControl(entry);
    const input = el(doc, 'input', { type: 'text', spellcheck: 'false', 'aria-label': item.title });
    const show = value => { input.value = String(value ?? ''); };
    // Keys typed here stay here: Logseq's shortcuts would otherwise act on them.
    for (const type of ['keydown', 'keyup', 'keypress']) input.addEventListener(type, event => {
      if (type === 'keydown' && event.key === 'Enter') input.blur();
      if (event.key !== 'Escape') event.stopPropagation();
    });
    input.addEventListener('change', () => {
      const next = item.type === 'number' ? Number(input.value) : input.value;
      if (item.type === 'number' && Number.isNaN(next)) { show(entry.value); return; }
      save(entry, next);
    });
    return [input, show];
  };

  const groups = groupsOf(sectionsOf(schema()));
  const sections = groups.flatMap(group => group.sections);
  const entries = [];
  const body = el(doc, 'div', { class: 'rs-body' });
  const card = el(doc, 'div', { class: 'rs-card' });
  body.append(card);
  const empty = el(doc, 'div', { class: 'rs-empty', hidden: true });
  for (const section of sections) {
    const sectionReload = RELOAD_RE.test(section.heading.description || '');
    const note = tidyText(section.heading.description);
    const rows = el(doc, 'div', { class: 'rs-rows' });
    section.node = el(doc, 'section', {}, el(doc, 'h3', {}, section.heading.title),
      sectionReload ? el(doc, 'div', { class: 'rs-note' }, [note, 'Changes here show after you reload the plugin.'].filter(Boolean).join(' '))
        : note ? el(doc, 'div', { class: 'rs-note' }, note) : null,
      rows);
    body.append(section.node);
    for (const item of section.items) {
      const entry = { item, section, value: valueOf(item), reload: sectionReload || RELOAD_RE.test(item.description || '') };
      const [input, show, wide] = control(entry);
      // A small picture of the setting's effect, where one is drawn; clicking it flips the switch.
      let preview = null;
      if (item.type === 'boolean' && PREVIEWS[item.key]) {
        preview = el(doc, 'div', { class: 'rs-pv', 'aria-hidden': 'true', title: 'What this changes (click to switch)' });
        preview.addEventListener('click', () => input.click());
        entry.drawPreview = value => { preview.innerHTML = PREVIEWS[item.key](value); };
        entry.drawPreview(entry.value);
      }
      show(entry.value);
      const titleText = el(doc, 'span');
      const reset = el(doc, 'button', { class: 'rs-reset', title: `Back to the default: ${item.type === 'boolean' ? (item.default ? 'on' : 'off') : item.default === '' ? 'empty' : item.default}` }, 'Reset');
      reset.addEventListener('click', () => { show(item.default); save(entry, item.default); });
      const title = el(doc, 'div', { class: 'rs-title' }, titleText,
        entry.reload && !sectionReload ? el(doc, 'span', { class: 'rs-tag', title: 'Shows after you reload the plugin' }, 'after reload') : null, reset);
      const desc = el(doc, 'div', { class: 'rs-desc' });
      const more = el(doc, 'button', { class: 'rs-more', hidden: true }, 'More');
      more.addEventListener('click', () => { const open = desc.classList.toggle('rs-open'); more.textContent = open ? 'Less' : 'More'; });
      // A list shows its names one by one, so “Comma-separated tag names” reads “Tag names”.
      const descText = tidyText(item.description).replace(/^Comma-separated (\w)/i, (_, first) => first.toUpperCase());
      entry.row = el(doc, 'div', { class: 'rs-row' },
        el(doc, 'div', { class: 'rs-text' }, title, descText ? desc : null, descText ? more : null, wide ? input : null),
        wide ? null : el(doc, 'div', { class: 'rs-control' }, preview, input));
      entry.mark = words => { fillMarked(doc, titleText, item.title, words); fillMarked(doc, desc, descText, words); };
      entry.markChanged = () => {
        const changed = entry.value !== item.default;
        titleText.classList.toggle('rs-changed', changed);
        titleText.title = changed ? 'Changed from the default' : '';
        reset.hidden = !changed;
      };
      entry.haystack = `${item.title} ${descText} ${section.heading.title}`.toLowerCase();
      entry.more = more;
      entry.desc = desc;
      entry.mark([]);
      entry.markChanged();
      rows.append(entry.row);
      entries.push(entry);
    }
  }
  body.append(empty);

  // The list on the left: one button per section, then the settings that differ from their defaults.
  const nav = el(doc, 'nav', { 'aria-label': 'Sections' });
  const navButton = (label, key) => {
    const b = el(doc, 'button', {}, el(doc, 'span', {}, label), el(doc, 'span', { class: 'rs-count' }));
    b.addEventListener('click', () => { find.value = ''; show(key); });
    nav.append(b);
    return b;
  };
  for (const group of groups) {
    group.button = navButton(group.title, 'group:' + group.key);
    group.button.classList.add('rs-group');
    for (const section of group.sections) { section.button = navButton(section.heading.title, section.heading.key); section.button.classList.add('rs-sec'); }
  }
  nav.append(el(doc, 'hr'));
  const changedButton = navButton('Changed by you', 'changed');
  function updateCounts() {
    for (const section of sections) section.button.lastChild.textContent = section.items.length;
    for (const group of groups) group.button.lastChild.textContent = '';
    changedButton.lastChild.textContent = entries.filter(entry => entry.value !== entry.item.default).length;
  }

  let current = lastSection && (lastSection === 'changed' || sections.some(s => s.heading.key === lastSection) || groups.some(g => 'group:' + g.key === lastSection))
    ? lastSection : groups[0] ? 'group:' + groups[0].key : sections[0]?.heading.key;
  const isPaused = headingKey => !!PAUSE_SWITCH[headingKey] && !entries.find(entry => entry.item.key === PAUSE_SWITCH[headingKey])?.value;
  // A paused part's rows step back, all but the switch that turns it on.
  function markPaused() {
    for (const entry of entries) entry.row.classList.toggle('rs-paused', isPaused(entry.section.heading.key) && entry.item.key !== PAUSE_SWITCH[entry.section.heading.key]);
  }
  // The group's picture: each zone numbered like the list beside it; the section on screen stands out.
  function drawCard(group, sectionKey) {
    card.textContent = '';
    card.hidden = !group?.art;
    card.classList.toggle('rs-card-focus', !!sectionKey);
    if (card.hidden) return;
    const art = el(doc, 'div', { class: 'rs-art' + (sectionKey ? ' rs-focus' : '') });
    art.innerHTML = group.art();
    const legend = el(doc, 'div', { class: 'rs-legend' });
    group.sections.forEach((section, index) => {
      const key = section.heading.key, n = String(index + 1), off = isPaused(key);
      for (const zone of art.querySelectorAll(`[data-section="${key}"]`)) {
        zone.dataset.n = n;
        zone.title = section.heading.title;
        zone.toggleAttribute('aria-current', key === sectionKey);
        zone.classList.toggle('rs-off', off);
        zone.addEventListener('click', () => show(key));
      }
      const button = el(doc, 'button', { type: 'button' }, el(doc, 'span', { class: 'rs-n' }, n),
        el(doc, 'span', {}, el(doc, 'b', {}, section.heading.title), el(doc, 'span', { class: 'rs-d' }, group.legend[key] || '')));
      button.toggleAttribute('aria-current', key === sectionKey);
      button.classList.toggle('rs-off', off);
      button.addEventListener('click', () => show(key));
      legend.append(button);
    });
    card.append(el(doc, 'div', { class: 'rs-card-head' }, el(doc, 'span', { class: 'rs-card-title' }, group.title), group.note ? el(doc, 'span', { class: 'rs-card-note' }, group.note) : null),
      el(doc, 'div', { class: 'rs-card-grid' }, art, legend));
  }
  function show(key = current) {
    current = key;
    lastSection = key;
    const words = find.value.toLowerCase().split(/\s+/).filter(Boolean);
    const groupKey = key.startsWith('group:') ? key.slice(6) : null;
    const searching = words.length > 0;
    box.classList.toggle('rs-searching', searching);
    box.classList.toggle('rs-listing', searching || key === 'changed');
    for (const entry of entries) {
      const shown = searching ? words.every(word => entry.haystack.includes(word))
        : key === 'changed' ? entry.value !== entry.item.default
        : groupKey ? entry.section.group.key === groupKey
        : entry.section.heading.key === key;
      entry.row.hidden = !shown;
      entry.mark(searching ? words : []);
    }
    for (const section of sections) {
      const hits = section.items.length && [...section.node.querySelectorAll('.rs-row')].some(row => !row.hidden);
      section.node.hidden = !hits;
      section.button.classList.toggle('rs-has-hits', searching && hits);
      section.button.setAttribute('aria-current', String(!searching && section.heading.key === key));
    }
    for (const group of groups) group.button.setAttribute('aria-current', String(!searching && groupKey === group.key));
    changedButton.setAttribute('aria-current', String(!searching && key === 'changed'));
    if (searching || key === 'changed') { card.hidden = true; card.textContent = ''; }
    else drawCard(groupKey ? groups.find(group => group.key === groupKey) : sections.find(section => section.heading.key === key)?.group, groupKey ? null : key);
    const none = !entries.some(entry => !entry.row.hidden);
    empty.hidden = !none;
    empty.textContent = searching ? `No setting matches “${find.value.trim()}”.` : 'Every setting is at its default.';
    body.scrollTop = 0;
    // “More” only where the explanation is cut short.
    if (!searching) doc.defaultView.requestAnimationFrame(() => {
      for (const entry of entries) if (!entry.row.hidden && !entry.desc.classList.contains('rs-open')) {
        entry.more.hidden = entry.desc.scrollHeight <= entry.desc.clientHeight + 1;
      }
    });
  }

  const find = el(doc, 'input', { type: 'text', placeholder: 'Search settings', spellcheck: 'false', 'aria-label': 'Search settings' });
  const findBox = el(doc, 'div', { class: 'rs-find' }, find, el(doc, 'kbd', {}, '/'));
  findBox.insertAdjacentHTML('afterbegin', SEARCH_ICON);
  find.addEventListener('input', () => { findBox.querySelector('kbd').hidden = !!find.value; show(); });
  for (const type of ['keydown', 'keyup', 'keypress']) find.addEventListener(type, event => {
    if (event.key !== 'Escape') event.stopPropagation();
  });

  const close = () => { backdrop.remove(); doc.removeEventListener('keydown', onKey, true); };
  // Escape empties the search box, then closes; / or Cmd/Ctrl+F goes to the search box. Other keys stay out of Logseq while the panel is open.
  const onKey = event => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      // The first Escape empties the search box; the next closes the window.
      if (find.value) { find.value = ''; find.dispatchEvent(new Event('input')); } else close();
      return;
    }
    const typing = event.target?.matches?.('input, textarea');
    if (!typing && (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f'))) {
      event.preventDefault(); event.stopPropagation(); find.focus(); find.select(); return;
    }
    if (!typing) event.stopPropagation();
  };
  doc.addEventListener('keydown', onKey, true);
  backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) close(); });

  const closeButton = el(doc, 'button', { class: 'rs-close', 'aria-label': 'Close', title: 'Close (Esc)' }, '×');
  closeButton.addEventListener('click', close);
  const reload = el(doc, 'button', {}, 'Reload plugin');
  reload.addEventListener('click', () => {
    close();
    // Run from Logseq's window: this plugin's own frame is removed during the reload.
    const win = doc.defaultView;
    win.setTimeout(() => win.LSPluginCore?.reload(PLUGIN_ID), 0);
  });
  const logseqPage = el(doc, 'button', {}, 'Logseq’s settings page');
  logseqPage.addEventListener('click', () => { close(); logseq.showSettingsUI(); });

  const box = el(doc, 'div', { class: 'refinement-settings', role: 'dialog', 'aria-label': 'Refinements settings' },
    el(doc, 'header', {}, el(doc, 'h2', {}, 'Refinements settings'), findBox, closeButton),
    el(doc, 'div', { class: 'rs-main' }, nav, body),
    el(doc, 'footer', {}, status, logseqPage, reload));
  backdrop.append(box);
  doc.body.append(backdrop);
  updateCounts();
  markPaused();
  show(current);
  find.focus();
}


/* The three-dots menu is drawn only while open. After a click on its button, look for the menu for a
   few frames and add the item below “Plugins” (or at the end if that item is missing). */
function addMenuItem(menu) {
  const doc = menu.ownerDocument;
  // An item left by an earlier copy of the plugin would open that copy's panel, so it is replaced.
  for (const old of menu.querySelectorAll('.' + ITEM_CLASS)) old.remove();
  const items = [...menu.querySelectorAll('[role="menuitem"]')];
  const plugins = items.find(item => item.querySelector('[class*="icon-apps"]')) ||
    items.find(item => item.textContent.trim() === 'Plugins');
  const model = plugins || items[0];
  if (!model) return;
  const item = model.cloneNode(true);
  item.classList.add(ITEM_CLASS);
  item.dataset.copy = COPY;
  item.removeAttribute('data-highlighted');
  item.removeAttribute('id');
  const label = [...item.querySelectorAll('div')].find(div => !div.children.length) || item;
  label.textContent = 'Refinements settings';
  // Logseq draws menu icons as inline drawings (Tabler icons); this is Tabler's “adjustments-horizontal”.
  const svg = item.querySelector('svg');
  if (svg) svg.innerHTML = SLIDERS_ICON;
  item.addEventListener('pointerenter', () => item.setAttribute('data-highlighted', ''));
  item.addEventListener('pointerleave', () => item.removeAttribute('data-highlighted'));
  item.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    // Escape closes the menu the way Logseq's own items do.
    menu.dispatchEvent(new (doc.defaultView.KeyboardEvent)('keydown', { key: 'Escape', bubbles: true }));
    open();
  });
  (plugins || items[items.length - 1]).after(item);
}
function watchDotsButton() {
  const doc = host(), win = doc.defaultView;
  const onClick = event => {
    // A copy of the plugin whose frame is gone (removed without its clean-up) steps aside.
    if (!window.parent) { doc.removeEventListener('click', onClick, true); return; }
    if (!event.target.closest?.('.toolbar-dots-btn')) return;
    let tries = 0;
    const look = () => {
      const menu = [...doc.querySelectorAll('[role="menu"]')].find(m => m.querySelector('[role="menuitem"]'));
      if (menu) { if (!menu.querySelector(`.${ITEM_CLASS}[data-copy="${COPY}"]`)) addMenuItem(menu); }
      else if (++tries < 30) win.requestAnimationFrame(look);
    };
    win.requestAnimationFrame(look);
  };
  doc.addEventListener('click', onClick, true);
  return () => doc.removeEventListener('click', onClick, true);
}

let stopWatching = null;
function start() {
  logseq.provideStyle({ key: 'refinement-settings-panel', style: css });
  stopWatching = watchDotsButton();
  window.refinementSettingsPanel = { open };
}
function stop() {
  stopWatching?.();
  const doc = host();
  doc.querySelector('.' + PANEL_CLASS)?.remove();
  for (const item of doc.querySelectorAll('.' + ITEM_CLASS)) item.remove();
}

(window.refinementParts ||= []).push({ name: 'settings panel', schema: [], start, stop });
})();
