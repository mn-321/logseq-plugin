#!/usr/bin/env node
/* Boots the plugin without Logseq: every part is loaded into a pretend Logseq window (jsdom), with a
   stand-in for the `logseq` API that answers every call harmlessly and remembers the hooks. Then the
   plugin is started, a page is drawn, the hooks are fired, the plugin is unloaded, and a second copy
   is loaded over the first the way a Reload does. It fails on any warning the plugin writes, any
   error, and anything left on screen after the unload.

   This checks the engine (layer 1): loading, starting, the hooks, the clean-up and the take-over. It
   cannot check what anything looks like; that is still done in the running app.

   Needs node and jsdom:   npm install --no-save --no-package-lock jsdom
   Run from the repo root: node tools/boot-test.js   (tools/check.sh runs it when node and jsdom are there) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const PART_FILES = (() => {
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const line = main.match(/^const PART_FILES = \[(.*)\];/m);
  if (!line) throw new Error('PART_FILES not found in main.js');
  return line[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
})();

const problems = [];
const problem = text => { problems.push(text); console.log('PROBLEM: ' + text); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// A page as Logseq draws one, enough for the watchers to have something to look at.
const PAGE_HTML = `<!doctype html><html><head></head><body>
<div id="head"></div>
<div id="main-content-container">
  <div class="ls-page-title"><h1 class="title">Echo</h1></div>
  <div class="ls-block" blockid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" level="0" data-uuid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa">
    <div class="block-content"><div class="block-title-wrap">Kickoff call <a class="page-ref" data-ref="mateo ruiz">Mateo Ruiz</a></div></div>
  </div>
  <div class="references"><div class="ls-foldable-title">Linked references</div></div>
</div>
<div id="right-sidebar"><div class="sidebar-item"><div class="cp__right-sidebar-settings"></div></div></div>
</body></html>`;

/* The stand-in for Logseq's API: any member is a function that returns a function (the "off" of a hook),
   except the few the plugin reads as values or awaits for an answer. Hooks are kept so the test can fire them. */
function fakeLogseq(log) {
  const hooks = {};
  const answers = {
    'DB.datascriptQuery': async () => [],
    'DB.q': async () => [],
    'App.getInfo': async () => '2.0.2',
    'App.getCurrentGraph': async () => ({ name: 'Plugin Test Graph', url: 'logseq_db_Plugin Test Graph' }),
    'App.getUserConfigs': async () => ({ preferredDateFormat: 'MMM do, yyyy' }),
    'Editor.getCurrentPage': async () => null,
    'Editor.getCurrentBlock': async () => null,
    'Editor.getEditingBlockContent': async () => '',
    'Editor.getPage': async () => null,
    'Editor.getBlock': async () => null,
    'Editor.getSelectedBlocks': async () => null,
    'Editor.getAllTags': async () => [],
    'Editor.getPageBlocksTree': async () => [],
    'Editor.getCurrentPageBlocksTree': async () => [],
    'UI.showMsg': message => { log.push('showMsg: ' + message); },
    'provideStyle': style => { api.calls.push({ name: 'provideStyle', args: [style] }); },
    'provideModel': () => {},
    'updateSettings': patch => { Object.assign(api.settings, patch); },
    'useSettingsSchema': schema => { api._settingsSchema = schema; },
    'ready': fn => { api._main = fn; },
    'beforeunload': fn => { api._unload = fn; },
  };
  const member = (name, pathName) => {
    const full = pathName ? pathName + '.' + name : name;
    if (answers[full]) return answers[full];
    if (/^on[A-Z]/.test(name)) return handler => { (hooks[full] ||= []).push(handler); return () => { const list = hooks[full]; const at = list.indexOf(handler); if (at >= 0) list.splice(at, 1); }; };
    return leaf(full);
  };
  const leaf = full => new Proxy(function () {}, {
    get: (target, name) => typeof name === 'string' ? member(name, full) : undefined,
    apply: (target, self, args) => { api.calls.push({ name: full, args }); return undefined; },
  });
  const api = {
    calls: [],
    settings: {},
    _settingsSchema: [],
    baseInfo: { id: 'logseq-db-refinements', version: '0.0.0' },
    fire: (full, ...args) => { for (const handler of hooks[full] || []) handler(...args); },
    hooks,
  };
  return new Proxy(api, { get: (target, name) => (name in target ? target[name] : typeof name === 'string' ? member(name) : undefined) });
}

// Loads one copy of the plugin into the host window: a plugin window whose parent is the host.
function loadPlugin(host, logseq) {
  const pluginWindow = { parent: host.window, console, setTimeout, clearTimeout, Promise, Date, Map, Set, URL, location: { href: 'file:///plugin/main.js' } };
  pluginWindow.window = pluginWindow;
  const document = { currentScript: null, createElement: () => ({}), body: { appendChild() {} } };
  for (const file of [...PART_FILES, 'main.js']) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    // The same wrapping as tools/check.js, with the globals a part reaches for.
    const run = new Function('logseq', 'window', 'document', 'location', 'console', src);
    try { run(logseq, pluginWindow, document, pluginWindow.location, console); } catch (error) { problem(`${file} threw while loading: ${error && error.stack || error}`); }
  }
  return pluginWindow;
}

function leftovers(doc) {
  const found = [];
  for (const el of doc.querySelectorAll('*')) {
    for (const name of el.getAttributeNames()) if (/^data-(refinement|rf)-/.test(name)) found.push(`[${name}] on <${el.tagName.toLowerCase()}>`);
    for (const cls of el.classList) if (/^(refinement-|rf-|rfp-)/.test(cls)) found.push(`.${cls}`);
  }
  return found;
}

async function main() {
  const log = [];
  const warnings = [];
  const realWarn = console.warn, realError = console.error;
  console.warn = (...args) => { warnings.push(args.map(String).join(' ')); realWarn(...args); };
  console.error = (...args) => { warnings.push('error: ' + args.map(String).join(' ')); realError(...args); };
  const host = new JSDOM(PAGE_HTML, { pretendToBeVisual: true });
  const doc = host.window.document;
  process.on('unhandledRejection', error => problem('unhandled rejection: ' + (error && error.stack || error)));
  host.window.addEventListener('error', event => problem('error in the window: ' + event.message));

  // 1. Load and start.
  const logseq = fakeLogseq(log);
  const pluginWindow = loadPlugin(host, logseq);
  await sleep(50);
  if (!logseq._main) problem('main() was never given to logseq.ready');
  const parts = pluginWindow.refinementParts || [];
  console.log(`loaded ${parts.length} parts, ${logseq._settingsSchema.length} settings`);
  if (parts.length !== PART_FILES.length - 1) problem(`expected ${PART_FILES.length - 1} parts to register, found ${parts.length}`);
  try { logseq._main(); } catch (error) { problem('main() threw: ' + (error && error.stack || error)); }
  if (!logseq._unload) problem('no beforeunload callback registered');
  await sleep(100);
  const palette = logseq.calls.filter(call => call.name === 'App.registerCommandPalette').map(call => call.args[0]);
  const menu = logseq.calls.filter(call => call.name === 'Editor.registerBlockContextMenuItem').map(call => call.args[0]);
  console.log(`${palette.length} palette commands, ${palette.filter(c => c.keybinding).length} with a shortcut, ${menu.length} bullet-menu items`);
  for (const key of ['labeled-page-link', 'show-settings', 'troubleshooting', 'fold-query-results', 'search-in-sidebar']) if (!palette.some(c => c.key === key)) problem(`palette command ${key} was not registered`);
  if (menu.filter(label => label === 'Make a page from this block').length !== 1) problem(`the bullet menu should hold Make a page from this block once; it holds: ${menu.join(', ')}`);
  const keys = palette.map(c => c.key);
  if (new Set(keys).size !== keys.length) problem('a palette command was registered twice');
  // The troubleshooting tools (0.4.172): the generic ones from the troubleshooting part, each feature's own from that feature.
  const toolKeys = logseq.calls.filter(call => call.name === 'App.registerCommand').map(call => call.args[1]?.key).sort();
  if (toolKeys.join() !== 'check-link-labels,check-what-is-found,copy-fold-log,copy-header-details,copy-perf-report,copy-styling-details,copy-warnings,toggle-perf')
    problem('troubleshooting tools: ' + toolKeys.join(', '));
  // The settings window (0.4.173): every picture comes from the setting or section that owns it.
  pluginWindow.refinementSettingsPanel.open();
  const panel = doc.querySelector('.refinement-settings');
  const previews = panel ? panel.querySelectorAll('.rs-pv').length : 0;
  if (previews !== 34) problem(`the settings window drew ${previews} small pictures, not 34`);
  const zones = panel ? [...panel.querySelectorAll('.rs-zone')] : [];
  const legends = panel ? [...panel.querySelectorAll('.rs-legend button')] : [];
  if (!zones.length || zones.length !== legends.length || zones.some(zone => !zone.dataset.n) || legends.some(button => !button.querySelector('.rs-d')?.textContent))
    problem(`the settings window's picture: ${zones.length} zones, ${legends.length} lines beside it`);
  console.log(`settings window: ${previews} small pictures, ${zones.length} zones in the first group's picture`);
  doc.querySelector('.refinement-settings-backdrop, .refinement-settings')?.remove();
  // Its screen report holds every running feature's rows, each thing once, with every feature that needs it.
  await pluginWindow.refinementDiagnostics.checkWhatIsFound();
  const report = doc.querySelector('textarea')?.value || '';
  for (const row of ['the page area', 'reference areas', 'title row', 'fold state', 'nesting lines', 'right sidebar', 'toolbar'])
    if (!report.includes(` · ${row} · `)) problem(`the screen report misses the row “${row}”`);
  if (!/ · blocks · (?=.*cues)(?=.*fold all).*\n/.test(report)) problem('the screen report did not join the features needing blocks');
  if (report.split('\n').filter(line => / · \D/.test(line) && /^ +\d+ · /.test(line) && !/data-refinement|\.refinement-/.test(line)).length !== 36) problem('the screen report should hold 36 rows of Logseq parts');
  const backdrop = doc.querySelector('.refinement-prompt-backdrop');
  backdrop?.dispatchEvent(Object.assign(new host.window.MouseEvent('mousedown', { bubbles: true })));
  await sleep(50);

  // 2. The screen changes, the hooks fire, time passes for the database round and the self-check.
  const block = doc.createElement('div');
  block.className = 'ls-block';
  block.setAttribute('blockid', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  block.innerHTML = '<div class="block-content"><div class="block-title-wrap">Budget <a class="page-ref" data-ref="atlas">Atlas</a> <a class="tag" data-ref="meeting">#Meeting</a></div></div>';
  doc.getElementById('main-content-container').appendChild(block);
  await sleep(100);
  logseq.fire('App.onRouteChanged', { path: '/page/echo' });
  logseq.fire('DB.onChanged', { blocks: [] });
  logseq.fire('onSettingsChanged', { ...logseq.settings, indentGuides: false }, { ...logseq.settings });
  logseq.fire('App.onCurrentGraphChanged');
  await sleep(1300); // the database round after a pause (800 ms) and the first self-check (4 s is too long to wait; it is harmless)

  // 3. Unload, as Logseq does before a reload.
  const stopKey = Object.keys(host.window).find(key => /Stop$/.test(key) && typeof host.window[key] === 'function');
  if (!stopKey) problem('no clean-up was left on the host window for the next copy');
  try { await logseq._unload(); } catch (error) { problem('unload threw: ' + (error && error.stack || error)); }
  await sleep(100);
  for (const key of Object.keys(host.window)) if (/Stop$/.test(key) && typeof host.window[key] === 'function') problem(`clean-up ${key} still on the host window after unload`);
  const left = leftovers(doc);
  if (left.length) problem('left on screen after unload: ' + [...new Set(left)].join(', '));
  const hooksLeft = Object.entries(logseq.hooks).filter(([, list]) => list.length).map(([name, list]) => `${name} × ${list.length}`);
  if (hooksLeft.length) problem('Logseq hooks still registered after unload: ' + hooksLeft.join(', '));

  // 4. A second copy loaded over a first that was never unloaded (a reload cut short).
  const logseq2 = fakeLogseq(log);
  const first = loadPlugin(host, logseq2);
  logseq2._main();
  await sleep(100);
  const logseq3 = fakeLogseq(log);
  const second = loadPlugin(host, logseq3);
  logseq3._main();
  await sleep(200);
  if (first === second) problem('the two copies are the same window');
  await logseq3._unload();
  await sleep(100);
  const left2 = leftovers(doc);
  if (left2.length) problem('left on screen after the take-over and unload: ' + [...new Set(left2)].join(', '));

  // 5. Foundation only (0.4.167): the same page, with only the foundation running. Nothing may be drawn, only the
  // foundation's commands registered, and the unload must still leave nothing behind.
  const logseq4 = fakeLogseq(log);
  logseq4.settings.foundationOnly = true;
  loadPlugin(host, logseq4);
  await sleep(50);
  try { logseq4._main(); } catch (error) { problem('main() threw with Foundation only on: ' + (error && error.stack || error)); }
  await sleep(100);
  logseq4.fire('App.onRouteChanged', { path: '/page/echo' });
  logseq4.fire('DB.onChanged', { blocks: [] });
  await sleep(1000);
  const drawn = leftovers(doc);
  if (drawn.length) problem('drawn with Foundation only on: ' + [...new Set(drawn)].join(', '));
  const keys4 = logseq4.calls.filter(call => call.name === 'App.registerCommandPalette').map(call => call.args[0].key).sort();
  if (keys4.join() !== 'show-settings,troubleshooting') problem('palette commands with Foundation only on: ' + keys4.join(', '));
  const tools4 = logseq4.calls.filter(call => call.name === 'App.registerCommand').map(call => call.args[1]?.key).sort();
  if (tools4.join() !== 'check-what-is-found,copy-perf-report,copy-styling-details,copy-warnings,toggle-perf') problem('troubleshooting tools with Foundation only on: ' + tools4.join(', '));
  if (!logseq4.calls.some(call => call.name === 'provideStyle' && call.args[0]?.key === 'refinements-dialog')) problem('the dialogs’ look was not sent with Foundation only on');
  console.log(`foundation only: ${keys4.length} palette commands (${keys4.join(', ')}), nothing drawn`);
  await logseq4._unload();
  await sleep(100);
  const left4 = leftovers(doc);
  if (left4.length) problem('left on screen after the foundation-only unload: ' + [...new Set(left4)].join(', '));

  console.warn = realWarn; console.error = realError;
  const own = warnings.filter(text => /Refinements|refinement|Error|error/i.test(text));
  for (const text of own) problem('warning: ' + text.slice(0, 300));
  for (const text of log) console.log('  ' + text);
  if (problems.length) { console.log(`boot-test: FAILED (${problems.length})`); process.exit(1); }
  console.log('boot-test: OK');
  process.exit(0);
}
main().catch(error => { problem(error && error.stack || String(error)); process.exit(1); });
