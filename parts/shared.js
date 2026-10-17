/* Loaded by main.js first, before the other parts. Kept in its own scope. */
(() => {
/* Shared plumbing of DB Refinements: the small helpers every part used to carry a copy of, written
   once. This header is the contract between the files.

   WHAT THIS FILE PROVIDES, on window.refinementShared (and nothing else):
   - host()                      the Logseq document (the plugin runs in a frame inside Logseq's window).
   - notify(message, level)      an in-app message through logseq.UI.showMsg.
   - lifecycle({ prefix, stopKey, before, sweep })   one per part; returns
       warnOnce(message, ...details)   a console warning written once per session per message, with the
                                       part's prefix ('Refinements: ', 'Refinements (search): ', …);
       onUnload(task)                  adds a clean-up step (also takes the "off" function of a Logseq hook);
       runUnloadTasks()                runs the steps in reverse order (after `before`, if given) and
                                       returns a promise that waits for any step that finishes later;
       takeOverFromEarlierCopy()       runs the earlier copy's clean-up left under window[stopKey] in
                                       Logseq's window, leaves this one there, then calls sweep(doc);
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
   - perf                         measuring hooks (add, time, seen, style, frameState, pass, passDone,
                                  ownSettingsOnly): no-ops until the diagnostics part measures.
   - warnings                     every distinct warnOnce message of this session (message, first time, count).

   WHAT EVERY OTHER PART MUST DO:
   - wrap itself in its own scope, `(() => { … })();`
   - take what it needs from window.refinementShared (`const shared = window.refinementShared;`), and
     make its own lifecycle with its own prefix and, when it cleans up Logseq's window, its own stopKey,
     so that a reload still stops each part's earlier copy on its own;
   - push { name, schema, start, stop } onto window.refinementParts; main.js joins the schemas, in
     the order of PART_FILES, after its own, and calls start() and stop() from main().

   LOAD ORDER AND WHY: loader.js → main.js → parts/shared.js → the other parts → main().
   loader.js loads main.js with a fresh timestamp (Logseq caches a plugin's script between reloads);
   main.js loads the parts the same way, this file first, because the others read
   window.refinementShared as they load. main.js itself takes its helpers from here once the parts
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
function lifecycle({ prefix, stopKey, before, sweep }) {
  const warnOnce = warner(prefix);
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
function modalButtons(doc, buttons) {
  const row = doc.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
  for (const [text, onClick] of buttons) {
    const b = doc.createElement('button');
    b.textContent = text;
    b.style.cssText = 'padding:4px 12px;border:1px solid var(--ls-border-color);border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer;';
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

// A part's settings: the saved value, or the default when the saved value is missing or of the wrong type.
function settingReader(schema) {
  const settingDefaults = Object.fromEntries(schema.map(item => [item.key, item.default]));
  return function setting(key) {
    const value = logseq.settings?.[key];
    return typeof value === typeof settingDefaults[key] ? value : settingDefaults[key];
  };
}

window.refinementShared = { host, notify, lifecycle, modal, modalButtons, modalHint, showUndoBar, openEntity, waitFor, settingReader, perf, warnings };
})();
