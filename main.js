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
// Each part declares what it may leave on screen in its lifecycle (leaves); shared.js sweeps it all.
const sweepEarlierCopy = doc => window.refinementShared.sweepLeftovers(doc);

// Logseq ignores an empty stylesheet, which would leave the previous rules in place. A comment
// counts as content, so sending one is how a stylesheet is cleared.
const orNoRules = style => style.trim() ? style : '/* no rules */';

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

/* Self-check after a Logseq update. Once a page has settled, a few pairs are compared (screenChecks, from
   parts/model.js: what a drawn page must hold): when the page plainly has a thing (blocks, a title,
   references) but the part the plugin finds inside it is missing, Logseq has most likely renamed that
   part, and the features listed beside it have quietly stopped. One note in the app per problem per
   session. Nothing is switched off: a feature that cannot find its part already draws nothing. A Logseq
   version other than the one the model was checked with (CHECKED_WITH) gets one note per version. */
const selfCheck = { timer: 0, noted: new Set() };
// Looks twice, a few seconds apart, so a page caught half-drawn does not count.
function scheduleSelfCheck() {
  clearTimeout(selfCheck.timer);
  selfCheck.timer = setTimeout(() => runSelfCheck(true), 4000);
}
function runSelfCheck(first) {
  const doc = host();
  const count = selector => { try { return doc.querySelectorAll(selector).length; } catch (error) { return 0; } };
  const missing = provided.screenChecks().filter(([what, has, needs, , min]) => !selfCheck.noted.has(what) && count(has) >= min && count(needs) === 0);
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
  if (!version || version === provided.CHECKED_WITH || logseq.settings?.selfCheckSeenVersion === version) return;
  logseq.updateSettings({ selfCheckSeenVersion: version });
  notify(`You are on Logseq ${version}; DB Refinements was last checked with ${provided.CHECKED_WITH}. If something looks off, run “Check what the plugin finds on this page”.`, 'warning');
}
function startSelfCheck() {
  versionNotice();
  scheduleSelfCheck();
  onUnload(logseq.App.onRouteChanged(scheduleSelfCheck));
  onUnload(() => clearTimeout(selfCheck.timer));
}
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
/* The settings are the parts': each declares its own (schema), with the heading of its section saying which
   group of the settings window it sits in (group, rank). setting(key), from shared.js, reads the joined list:
   a setting's current value, or its default when unset or of the wrong type. A setting that only takes effect
   when the plugin starts says so in its description, or its heading does for the whole section; the core
   finds them there (reloadOnly) to say "reload" when one changes. */
const RELOAD_RE = /after you reload/i, AT_ONCE_RE = /right away|at once/i;
function reloadOnly(schema) {
  const keys = []; let sectionReload = false;
  for (const item of schema) {
    if (item.type === 'heading') { sectionReload = RELOAD_RE.test(item.description || ''); continue; }
    const text = item.description || '';
    if (RELOAD_RE.test(text) || (sectionReload && !AT_ONCE_RE.test(text))) keys.push(item.key);
  }
  return keys;
}
let RELOAD_SETTINGS = [];

/* After the database changes, everything the plugin knows from it is looked up again in one round:
   as soon as the changes pause, or every few seconds while they keep coming (typing). Seven
   separate timers used to do this, finishing at three different moments after each edit. */
const dbWork = { timer: 0, since: 0, slowTimer: 0, slowAt: 0 };
// Lists that cover the whole graph (every linked block, every property value,
// page titles, journals, property names) change rarely; while you edit, they are read again at most
// this often, plus once more after you stop. Looking at a new page reads them fresh only when something
// changed since they were read (0.4.150): read on every page change they held up the page's own extras.
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
  // A job's look-up still waiting from a page change is not needed too: each job says what to cancel first.
  for (const job of dbJobs) if (job.before) { try { job.before(); } catch (error) { warnOnce(`${job.name} could not cancel its earlier look-up`, error); } }
  const failed = error => warnOnce('a look-up after a change failed', error);
  const run = jobs => { for (const job of jobs) { try { Promise.resolve(job.fn()).catch(failed); } catch (error) { failed(error); } } };
  // About the page on screen: after every round.
  const pageJobs = dbJobs.filter(job => job.scope === 'page');
  // Whole-graph lists: now if they are due; otherwise one full round when they fall due.
  const fullRound = () => {
    clearTimeout(dbWork.slowTimer);
    dbWork.slowTimer = 0;
    dbWork.slowAt = Date.now();
    graphCache.clear();
    graphCache.changed = false;
    run([...dbJobs.filter(job => job.scope === 'graph'), ...pageJobs]);
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
   so the order of the parts does not matter. Database look-ups register with
   core.onDbRound(name, fn, { scope, before }): scope 'page' (the default) runs after every round, 'graph'
   only when the whole-graph lists fall due; before() is run at the start of every round to cancel a
   look-up of the job's own still waiting. runDbWork knows no job by name (one database round, GUIDE.md). */
/* The hooks the parts register with the core (onPageChange, onDatabaseChange, onSettingsChange): the core
   listens to Logseq once, does its own housekeeping first (its caches), then runs each part's function
   in the order registered, one failing not stopping the next. */
const hooks = { page: [], database: [], settings: [] };
const runHooks = (list, what, ...args) => { for (const fn of list) { try { fn(...args); } catch (error) { warnOnce(`a part's ${what} step failed (${fn.name || 'unnamed'})`, error); } } };
const provided = {}; // what the area parts give the core and each other, by name
const dbJobs = [];   // database-round jobs, in the order the parts registered them (core.onDbRound)
function publishCore() {
  window.refinementCore = {
    host, setting, notify, graphWide, scheduleDbWork, sendStyle, orNoRules, watchDom, watchDomEarly, addsElements, ensureDomWatch,
    UUID, isEntityId, idsIn, uuidsIn, dsQuery,
    onFoldAll: fn => provided.onFoldAll?.(fn), // none when the part that folds is not running (Foundation only)
    provided, provide: things => Object.assign(provided, things),
    onDbRound: (name, fn, { scope = 'page', before } = {}) => { dbJobs.push({ name, fn, scope, before }); },
    onPageChange: fn => hooks.page.push(fn), onDatabaseChange: fn => hooks.database.push(fn), onSettingsChange: fn => hooks.settings.push(fn),
  };
}
// A saved setting whose old default clashed with something (a part declares it in `moved`) is moved to the new
// default where the saved value is still the old one: Logseq saves every default, so a changed default alone would
// not reach an existing install.
function moveOldDefaults() {
  for (const part of plugInParts) for (const [key, [old, now]] of Object.entries(part.moved || {})) if (logseq.settings?.[key] === old) logseq.updateSettings({ [key]: now });
}
// The palette commands the parts declare ({ key, label, run, shortcut, menu }): each gets its palette entry, with
// the shortcut read from the setting it names (left empty, none is bound), and a bullet's right-click menu item when asked.
function registerCommands(parts) {
  for (const part of parts) for (const { key, label, run, shortcut, menu } of part.commands || []) {
    let binding = shortcut && setting(shortcut).trim().toLowerCase();
    const moved = part.moved?.[shortcut];
    if (binding && moved?.[0] === binding) binding = moved[1]; // the saved setting may not show the move yet
    logseq.App.registerCommandPalette({ key, label, ...(binding ? { keybinding: { binding } } : {}) }, run);
    if (menu) logseq.Editor.registerBlockContextMenuItem(label, run);
  }
}
function main() {
  logseq.beforeunload(runUnloadTasks);
  moveOldDefaults();
  takeOverFromEarlierCopy();
  publishCore();
  logseq.provideStyle({ key: 'refinements-dialog', style: window.refinementShared.dialogCss }); // the dialogs' look, before any part (0.4.169)
  // The parts (parts/*.js, loaded before this file). Each keeps its own clean-up, run from here; one
  // that fails to start leaves the rest of the plugin working. Three steps, each over every part before the
  // next: provide() gives the core the part's functions and state; start() takes the others' things and
  // registers with the core; ready() starts what draws on screen, once every part has started. The core
  // starts no part by name. With the setting Foundation only (0.4.167), only the parts marked foundation run:
  // the model, the troubleshooting tools and the settings window; the others stay loaded (their settings
  // keep their place) but are never started.
  const foundationOnly = setting('foundationOnly') === true;
  const running = foundationOnly ? plugInParts.filter(part => part.foundation) : plugInParts;
  if (foundationOnly) notify('DB Refinements is running only its foundation (Foundation only, under Troubleshooting in its settings). Turn it off and reload the plugin to get everything back.', 'warning');
  for (const part of running) {
    try { part.provide?.(window.refinementCore); } catch (error) { warnOnce(`the ${part.name} part could not provide its functions`, error); }
  }
  for (const part of running) {
    try { part.start(); } catch (error) { warnOnce(`the ${part.name} part could not start`, error); }
    onUnload(part.stop);
  }
  for (const part of running) {
    try { part.ready?.(); } catch (error) { warnOnce(`the ${part.name} part could not get ready`, error); }
  }
  startSelfCheck();

  // Every hook returns an "off" function; each is called when the plugin unloads. The core listens
  // once and runs what the parts registered (hooks) after its own housekeeping.
  onUnload(logseq.App.onRouteChanged(() => {
    if (graphCache.changed) { graphCache.clear(); graphCache.changed = false; } // a new page reads changed whole-graph lists fresh
    runHooks(hooks.page, 'page change');
  }));
  // Edits fire this constantly while typing, so the database round waits for a pause before re-querying.
  onUnload(logseq.DB.onChanged(({ blocks } = {}) => {
    perf.add('DB.onChanged (calls only)', 0);
    graphCache.changed = true;
    runHooks(hooks.database, 'database change', blocks);
    scheduleDbWork();
  }));
  onUnload(logseq.App.onCurrentGraphChanged(() => graphCache.clear())); // another graph has other lists
  onUnload(() => { clearTimeout(dbWork.timer); clearTimeout(dbWork.slowTimer); });
  onUnload(logseq.onSettingsChanged((now, before) => {
    if (perf.ownSettingsOnly(now, before)) return;
    runHooks(hooks.settings, 'settings change', now, before);
    // Logseq rewrites every setting when the plugin starts, so a setting with no earlier value is a
    // default being filled in (first install, or a new setting after an update), not a change.
    if (RELOAD_SETTINGS.some(key => before && key in before && now?.[key] !== before[key])) notify('Reload the Refinements plugin to apply this change', 'info');
  }));

  registerCommands(running);
}
/* Search, journal-day dates, copy as rich text, todos, the tag tree and the settings panel live in parts/*.js. Each file adds itself to
   window.refinementParts; they are loaded here, in order, before the settings are given, because
   Logseq can keep an older loader.js cached that only loads this file. */
// shared.js first: the other parts read window.refinementShared as they load. model.js second: the Logseq
// model, which every part reads the graph through (core.provided). sidebar.js right after
// chrome.js: its settings have no heading of their own, so they join chrome's "Sidebars and toolbar".
const PART_FILES = ['parts/shared.js', 'parts/model.js', 'parts/diagnostics.js', 'parts/editor.js', 'parts/pages.js', 'parts/properties.js', 'parts/links.js', 'parts/two-way.js', 'parts/chrome.js', 'parts/sidebar.js', 'parts/styles.js', 'parts/search.js', 'parts/journal-dates.js', 'parts/inline-props.js', 'parts/proposals.js', 'parts/rich-copy.js', 'parts/todos.js', 'parts/tags.js', 'parts/settings-panel.js'];
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
// Given before ready, so the settings already hold their defaults when main runs: the parts' settings,
// in the order of PART_FILES, each under its heading.
loadParts().then(() => {
  useShared();
  plugInParts = window.refinementParts || [];
  const schema = plugInParts.flatMap(part => part.schema);
  setting = window.refinementShared.settingReader(schema);
  RELOAD_SETTINGS = reloadOnly(schema);
  logseq.useSettingsSchema(schema);
  return logseq.ready(main);
}).catch(console.error);



























