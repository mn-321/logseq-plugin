/* Loaded by main.js first, before the other parts. Kept in its own scope. */
(() => {
/* Shared plumbing of DB Refinements: the small helpers every part used to carry a copy of, written
   once. This header is the contract between the files.

   WHAT THIS FILE PROVIDES, on window.refinementShared (and nothing else):
   - host()                      the Logseq document (the plugin runs in a frame inside Logseq's window).
   - notify(message, level)      an in-app message through logseq.UI.showMsg.
   - lifecycle({ prefix, stopKey, before, sweep, leaves })   one per part; returns
       warnOnce(message, ...details)   a console warning written once per session per message, with the
                                       part's prefix ('Refinements: ', 'Refinements (search): ', …);
       onUnload(task)                  adds a clean-up step (also takes the "off" function of a Logseq hook);
       runUnloadTasks()                runs the steps in reverse order (after `before`, if given) and
                                       returns a promise that waits for any step that finishes later;
       takeOverFromEarlierCopy()       runs the earlier copy's clean-up left under window[stopKey] in
                                       Logseq's window, leaves this one there, then calls sweep(doc);
       leaves: { elements, attributes, reset }   what the part may leave on screen if a copy is cut short:
                                       a selector list of its own elements, the names of the attributes it
                                       sets on Logseq's elements, and a reset(doc) for anything else. The
                                       core sweeps every part's leaves before it starts (sweepLeftovers).
   - sweepLeftovers(doc)          removes what every part declared in its leaves, part by part.
       updaterFailed(fn, error, list)  retires a screen updater that threw five times;
       listen(win, types, handler)     a capture-phase listener on Logseq's window, removed on unload.
   - modal(cancelValue, build, width, classes)   a small dialog box in Logseq's window; build(box, finish, doc)
                                       fills it, the promise resolves with what finish() is given, Escape
                                       or a click outside resolves with cancelValue; classes names the
                                       backdrop and box classes (refinement-prompt-* unless given).
   - modalButtons(doc, [[text, onClick], …]) and modalHint(doc, text)   rows for a modal.
   - showUndoBar(text, undo, onFail)   after a write: a dark bar at the bottom with Undo for seven seconds; undo()
                                  is awaited on the press, onFail(error) (or a warning note) runs if it throws.
   - openEntity(uuid, inSidebar)  opens a page or block by uuid, in the right sidebar when asked.
   - waitFor(find, ms)            polls find() every 50 ms until it returns something or ms pass.
   - settingReader(schema)        returns setting(key): the saved value, or the schema's default when
                                  the saved value is missing or of another type.
   - graphNamedIn(list)           true when the open graph is named in the comma-separated list (an "Only in
                                  these graphs" setting); false while the list is empty.
   - perf                         measuring hooks (add, time, seen, style, frameState, pass, passDone,
                                  ownSettingsOnly): no-ops until the diagnostics part measures.
   - warnings                     every distinct warnOnce message of this session (message, first time, count).

   WHAT EVERY OTHER PART MUST DO:
   - wrap itself in its own scope, `(() => { … })();`
   - take what it needs from window.refinementShared (`const shared = window.refinementShared;`), and
     make its own lifecycle with its own prefix and, when it cleans up Logseq's window, its own stopKey,
     so that a reload still stops each part's earlier copy on its own;
   - push { name, schema, provide?, start, ready?, commands?, moved?, foundation?, stop } onto window.refinementParts
     (foundation: true keeps the part running under the setting Foundation only: the model, the troubleshooting
     tools and the settings window);
     main.js joins the schemas, in the order of PART_FILES, after its own, and from main() calls every
     part's provide(core), then every start(), then every ready() (what draws on screen, once every part
     has started), and stop() at unload; it registers each command ({ key, label, run, shortcut, menu }:
     the setting that holds the shortcut, and whether it is also in a bullet's right-click menu) and moves
     a saved setting named in moved ({ key: [old default, new default] }). The core starts no part by name.
   - bring its own troubleshooting: what it looks for on screen and any tool of its own, through
     core.provided.addTroubleshooting({ checks, tools }) from parts/diagnostics.js (0.4.172), never by
     the troubleshooting part reaching into it.

   LOAD ORDER AND WHY: loader.js → main.js → parts/shared.js → parts/model.js → the other parts → main().
   loader.js loads main.js with a fresh timestamp (Logseq caches a plugin's script between reloads);
   main.js loads the parts the same way, this file first, because the others read
   window.refinementShared as they load, and parts/model.js second: the one part that knows what a page,
   block, tag, property, journal day and link are in a DB graph (titles, the stored form of a link, the
   property schema, the pages, days, journal titles, the Logseq version checked with). It provides them
   through core.provided, so every other part reads the graph through it with take(); the core itself knows
   nothing of content. main.js itself takes its helpers from here once the parts
   have loaded (useShared), before it gives Logseq the settings and before main() runs, and main()
   publishes window.refinementCore before it starts any part. */

// The Logseq window. The plugin runs in a frame inside it.
const host = () => window.parent.document;
const notify = (message, level = 'info') => logseq.UI.showMsg(message, level);

/* A warning is written once per session for each distinct message, so a part that fails after every
   change (a look-up after each edit, a screen update on each redraw) does not fill the console. */
// Every distinct warning of this session, for "Copy warnings": message (with its prefix), first time, count.
const warnings = [];
function warner(prefix) {
  const warned = new Map();
  return (message, ...details) => {
    const earlier = warned.get(message);
    if (earlier) { earlier.count++; return; }
    const entry = { message: prefix + message, at: new Date(), count: 1 };
    warned.set(message, entry);
    warnings.push(entry);
    console.warn(prefix + message, ...details);
  };
}

/* Logseq keeps only the most recent beforeunload callback a plugin registers, so every part of the
   plugin keeps its clean-up in a list of its own and main() registers one callback that runs them all.
   The plugin's watchers live in Logseq's window, so they outlive the plugin's own frame. If an earlier
   copy was removed without its clean-up finishing (an error, or Logseq's ten-second limit), they would
   keep running beside this copy. Each copy therefore leaves its clean-up where the next one can find it
   (window[stopKey]), and a new copy runs it and sweeps anything still left on screen. */
const UPDATER_TRIES = 5;
/* What each part may leave on screen, declared by the part in its lifecycle (leaves). A new copy of the
   plugin sweeps all of it before it starts, so an earlier copy cut short (an error, Logseq's ten-second
   limit) leaves no mark behind. The core used to keep one list of every part's marks; each part now
   names its own, beside the code that writes them. */
const leftovers = [];
function sweepLeftovers(doc) {
  for (const { prefix, elements, attributes, reset } of leftovers) {
    try {
      if (reset) reset(doc);
      if (elements) for (const el of doc.querySelectorAll(elements)) el.remove();
      for (const name of attributes || []) for (const el of doc.querySelectorAll(`[${name}]`)) el.removeAttribute(name);
    } catch (error) { console.warn(prefix + 'leftovers could not be cleared', error); }
  }
}
function lifecycle({ prefix, stopKey, before, sweep, leaves }) {
  const warnOnce = warner(prefix);
  if (leaves) leftovers.push({ prefix, ...leaves });
  const unloadTasks = [];
  // Also takes the "off" function every logseq.*.onXxx hook returns.
  const onUnload = task => { if (typeof task === 'function') unloadTasks.push(task); };
  // Every step starts at once, in reverse order of set-up, so the screen is clean by the time this
  // returns; the promise it returns waits for any step that finishes later.
  function runUnloadTasks() {
    if (before) before(); // for example: stop the screen watcher, so nothing re-applies while the steps undo their changes
    const failed = error => warnOnce('clean-up step failed', error);
    const pending = [];
    for (const task of unloadTasks.splice(0).reverse()) {
      try { pending.push(Promise.resolve(task()).catch(failed)); } catch (error) { failed(error); }
    }
    return Promise.all(pending);
  }
  function takeOverFromEarlierCopy() {
    let win;
    try { win = host().defaultView; } catch (error) { return; }
    try { win[stopKey]?.(); } catch (error) { warnOnce('an earlier copy could not be stopped', error); }
    win[stopKey] = runUnloadTasks;
    onUnload(() => { if (win[stopKey] === runUnloadTasks) delete win[stopKey]; });
    if (sweep) try { sweep(win.document); } catch (error) { warnOnce('leftovers could not be cleared', error); }
  }
  /* A screen update that throws again and again is switched off for the rest of the session, with one
     note saying which part stopped. The others carry on; a reload starts it again. */
  const updaterFailures = new Map();
  function updaterFailed(fn, error, list) {
    const n = (updaterFailures.get(fn) || 0) + 1;
    updaterFailures.set(fn, n);
    if (n < UPDATER_TRIES) return warnOnce(`a screen update failed (${fn.name || 'unnamed'})`, error);
    if (list instanceof Set) list.delete(fn);
    else { const at = list.indexOf(fn); if (at >= 0) list.splice(at, 1); }
    warnOnce(`${fn.name || 'a screen update'} stopped for this session after ${n} errors`, error);
  }
  // Listens on Logseq's window before Logseq does (capture phase), until the part unloads.
  function listen(win, types, handler) {
    for (const type of types) win.addEventListener(type, handler, true);
    onUnload(() => { for (const type of types) win.removeEventListener(type, handler, true); });
  }
  return { warnOnce, onUnload, runUnloadTasks, takeOverFromEarlierCopy, updaterFailed, listen };
}

/* Small dialog boxes drawn in Logseq's window (window.prompt is unreliable inside plugin
   frames). build(box, finish) fills the box; the promise resolves with what finish() is given.
   Escape or a click outside resolves with cancelValue. Keys typed in the box never reach Logseq. */
function modal(cancelValue, build, width, classes = {}) {
  const doc = host();
  return new Promise(resolve => {
    const backdrop = doc.createElement('div');
    backdrop.className = classes.backdrop || 'refinement-prompt-backdrop';
    const box = doc.createElement('div');
    box.className = classes.box || 'refinement-prompt';
    if (width) box.style.width = width;
    let finished = false;
    const finish = value => { if (finished) return; finished = true; backdrop.remove(); resolve(value); };
    backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) finish(cancelValue); });
    for (const type of ['keyup', 'keypress']) box.addEventListener(type, event => event.stopPropagation());
    box.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); finish(cancelValue); }
    });
    backdrop.append(box);
    doc.body.appendChild(backdrop);
    build(box, finish, doc);
  });
}
/* The dialog's own look (0.4.169, moved from parts/styles.js): the foundation's dialogs (the troubleshooting box,
   the settings window's questions) must be drawn right when the look parts are not running (Foundation only), so it
   goes out with the core at start (main.js), before any part. The look parts may refine it, never be needed for it. */
const dialogCss = `/* Small page-title box (window.prompt is unreliable inside plugin sandboxes). */
.refinement-prompt-backdrop { --rf-bg: var(--ls-primary-background-color, hsl(var(--popover))); --rf-fg: var(--ls-primary-text-color, hsl(var(--popover-foreground))); --rf-line: var(--ls-border-color, hsl(var(--border))); position: fixed; inset: 0; z-index: 10000; display: flex; align-items: flex-start; justify-content: center; padding-top: 18vh; background: rgba(0, 0, 0, .25); }
.refinement-prompt { width: min(420px, 90vw); padding: 14px 16px; border: 1px solid var(--rf-line); border-radius: var(--rf-window-radius, 8px); background: var(--rf-bg); color: var(--rf-fg); box-shadow: var(--rf-window-shadow, 0 8px 28px rgba(0, 0, 0, .2)); }
.refinement-prompt label { display: block; margin-bottom: 8px; font-size: .95em; }
.refinement-prompt input { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--rf-line); border-radius: 6px; background: transparent; color: inherit; font: inherit; }
.refinement-prompt-hint { margin-top: 6px; font-size: var(--rf-small, .85em); opacity: var(--rf-quiet, .6); }
/* The bar at the bottom after a write, with Undo (showUndoBar): the popover's colours the other way round. Only Logseq's
   newer colour names: its --ls-primary-text-color and siblings are empty or unset in 2.0.2, so a bar built on them
   was see-through, its words lying over the page (0.4.197, seen in both themes). */
.refinement-undo-bar { position: fixed; z-index: 10002; left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; align-items: center; gap: 16px; max-width: min(560px, 90vw); padding: 9px 10px 9px 16px; border-radius: var(--rf-window-radius, 8px);
  background: hsl(var(--popover-foreground, 0 0% 15%)); color: hsl(var(--popover, 0 0% 100%)); font-size: var(--rf-row, .875rem); box-shadow: var(--rf-window-shadow, 0 8px 28px rgba(0, 0, 0, .2)); }
.refinement-undo-bar span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.refinement-undo-bar button { flex: none; border: 0; border-radius: 5px; padding: 3px 10px; background: color-mix(in srgb, currentColor 18%, transparent); color: inherit; font: inherit; font-weight: 600; cursor: pointer; }
.refinement-undo-bar button:hover { background: color-mix(in srgb, currentColor 30%, transparent); }
`;
function modalButtons(doc, buttons) {
  const row = doc.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
  for (const [text, onClick] of buttons) {
    const b = doc.createElement('button');
    b.textContent = text;
    b.style.cssText = 'padding:4px 12px;border:1px solid var(--rf-line, var(--ls-border-color));border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer;';
    b.addEventListener('click', event => { event.preventDefault(); onClick(); });
    row.append(b);
  }
  return row;
}
function modalHint(doc, text) {
  const hint = doc.createElement('div');
  hint.className = 'refinement-prompt-hint';
  hint.textContent = text;
  return hint;
}

/* After a write from one of the plugin's flows: one dark bar at the bottom, "… is now …", with Undo for seven
   seconds, drawn by styles.js as .refinement-undo-bar. Journal dates and the search preview use it; Todos and the
   tag tree keep bars of their own for now. */
const undoBar = { el: null, timer: 0 };
function showUndoBar(text, undo, onFail) {
  const doc = host();
  clearTimeout(undoBar.timer); undoBar.el?.remove();
  const el = undoBar.el = doc.createElement('div');
  el.className = 'refinement-undo-bar';
  el.setAttribute('role', 'status');
  const words = doc.createElement('span'); words.textContent = text;
  const button = doc.createElement('button'); button.type = 'button'; button.textContent = 'Undo';
  button.addEventListener('click', async () => {
    clearTimeout(undoBar.timer); el.remove();
    try { await undo(); } catch (error) { if (onFail) onFail(error); else notify('The change could not be undone', 'warning'); }
  });
  el.append(words, button);
  doc.body.appendChild(el);
  undoBar.timer = setTimeout(() => el.remove(), 7000);
}

// Opens a page or block by uuid; in the right sidebar when asked (Shift-click).
function openEntity(uuid, inSidebar = false) {
  if (!uuid) return;
  if (inSidebar) logseq.Editor.openInRightSidebar(uuid);
  else logseq.App.pushState('page', { name: uuid });
}
const waitFor = (find, ms = 1500) => new Promise(resolve => {
  const started = Date.now();
  const tick = () => { const found = find(); if (found || Date.now() - started > ms) resolve(found || null); else setTimeout(tick, 50); };
  tick();
});

/* Measuring, for the troubleshooting tools (parts/diagnostics.js). The core calls perf.* on its hot
   paths (every screen change, every stylesheet, every database round); while nothing is measuring,
   each call returns at once. The diagnostics part puts its measuring object in perf.impl while
   measuring is on and takes it out when it is off. */
const perf = {
  impl: null,
  add(name, ms) { if (perf.impl) perf.impl.add(name, ms); },
  time(name, fn) { return perf.impl ? perf.impl.time(name, fn) : fn(); },
  seen(name, records) { if (perf.impl) perf.impl.seen(name, records); },
  style(key, text, sent) { if (perf.impl) perf.impl.style(key, text, sent); },
  frameState() { return perf.impl ? perf.impl.frameState() : ''; },
  pass(state) { if (perf.impl) perf.impl.pass(state); },
  passDone() { if (perf.impl) perf.impl.passDone(); },
  // Measuring or not: whether a settings change touched only the plugin's own keys (reports, debugPerf, the self-check note).
  ownSettingsOnly(now, before) {
    const changed = Object.keys({ ...now, ...before }).filter(key => JSON.stringify(now?.[key]) !== JSON.stringify(before?.[key]));
    return changed.length > 0 && changed.every(key => /^(?:perf|debugPerf|selfCheck)/.test(key));
  },
};

/* Plugin settings are shared by every graph; a part that writes to notes keeps to the graphs named in one of its
   settings ("Only in these graphs", a comma-separated list). True when the open graph is one of them. */
async function graphNamedIn(list) {
  const names = String(list || '').split(',').map(n => n.trim().toLowerCase()).filter(Boolean);
  if (!names.length) return false;
  const graph = await logseq.App.getCurrentGraph().catch(() => null);
  // A DB graph's name may carry an internal prefix ("logseq_db_"), and its url or path ends in the name.
  const strip = value => String(value || '').toLowerCase().replace(/^logseq_db_/, '');
  const candidates = [graph?.name, graph?.url, String(graph?.path || '').split(/[\\/]/).pop()]
    .map(strip).map(value => value.replace(/^.*[\\/]/, '')).filter(Boolean);
  return candidates.some(value => names.includes(value));
}

// A part's settings: the saved value, or the default when the saved value is missing or of the wrong type.
function settingReader(schema) {
  const settingDefaults = Object.fromEntries(schema.map(item => [item.key, item.default]));
  return function setting(key) {
    const value = logseq.settings?.[key];
    return typeof value === typeof settingDefaults[key] ? value : settingDefaults[key];
  };
}

// This file's own boxes: the dialog backdrop and the Undo bar.
leftovers.push({ prefix: 'Refinements: ', elements: '.refinement-prompt-backdrop, .refinement-undo-bar' });

window.refinementShared = { host, notify, lifecycle, sweepLeftovers, modal, modalButtons, modalHint, dialogCss, showUndoBar, openEntity, waitFor, settingReader, graphNamedIn, perf, warnings };
})();
