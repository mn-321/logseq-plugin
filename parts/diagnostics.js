/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Troubleshooting tools of DB Refinements. Nothing here changes what is on screen; each tool shows a
   report in a box (and copies it) or measures. This part holds only the tools that know nothing about
   any feature:
   - checkWhatIsFound     how many of each Logseq part the running features look for are on screen, and
                          the plugin's own marks;
   - copyDiagnostics      how Logseq built one block (for aiming a styling rule);
   - togglePerf, copyPerfReport  measuring of the plugin's own work (perf), with logPerfReport for the
     hidden debugPerfEvery setting;
   - copyWarnings         every warnOnce message of this session.
   A feature brings its own tools and screen rows (0.4.172): in its start() it calls
   core.provided.addTroubleshooting({ tools: [{ key, label, run }], checks: [[what, selector, neededFor]] }),
   and its tools show their report with showReport(text), whose first line is versionLine(). A feature that
   is not running (Foundation only) adds nothing, so the box lists only what is running. */
const shared = window.refinementShared;
const { host, notify, modal, modalHint } = shared;
// Warnings keep the plain "Refinements: " prefix these tools always had.
const { warnOnce, onUnload, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements: ' });
// From the model part, taken when the part starts.
let CHECKED_WITH;

/* copyDiagnostics: describe how Logseq built one block, so styling can target the real structure.
   Text is shortened to a few words; nothing is changed or sent anywhere. */

// First line of every troubleshooting report: this plugin's and Logseq's version.
async function versionLine() {
  let logseqVersion = '?';
  try { logseqVersion = (await logseq.App.getInfo('version')) || '?'; } catch (error) { /* ignore */ }
  const note = logseqVersion !== '?' && logseqVersion !== CHECKED_WITH ? ` (the plugin was last checked against Logseq ${CHECKED_WITH})` : '';
  return `DB Refinements ${logseq.baseInfo?.version || '?'} · Logseq ${logseqVersion}${note}`;
}
/* Troubleshooting after a Logseq update: how many of each thing the running features look for are on
   screen. A zero is normal when the page has none of that thing; a zero for something you can see on the
   page means Logseq renamed it, and the features listed beside it have stopped. Nothing is changed.
   Each feature adds its own rows (addTroubleshooting); rows naming the same thing are shown as one. */
const checks = new Map([['the page area', { selector: '#main-content-container', neededFor: ['everything'] }]]);
const TOOLS = [];
let toolsRegistered = false; // after this part's ready(); a tool added later is registered as it comes
// Each tool keeps its command key, registered without a palette entry (a shortcut the owner bound to one still
// works); the troubleshooting box lists them by name.
const registerTool = tool => logseq.App.registerCommand('global', { key: tool.key, label: 'Troubleshooting: ' + tool.label }, tool.run);
function addTroubleshooting({ tools = [], checks: rows = [] } = {}) {
  for (const tool of tools) if (!TOOLS.some(known => known.key === tool.key)) { TOOLS.push(tool); if (toolsRegistered) registerTool(tool); }
  for (const [what, selector, neededFor] of rows) {
    const row = checks.get(what) || checks.set(what, { selector, neededFor: [] }).get(what);
    for (const need of neededFor.split(', ')) if (!row.neededFor.includes(need)) row.neededFor.push(need);
  }
}
async function checkWhatIsFound() {
  try {
    const doc = host();
    const count = selector => { try { return doc.querySelectorAll(selector).length; } catch (error) { return 'bad selector'; } };
    const lines = [await versionLine(), 'What the plugin finds on screen now. A zero is normal when this page has none of that thing.', '',
      'LOGSEQ\'S OWN PARTS  found · what · needed for'];
    for (const [what, { selector, neededFor }] of checks) lines.push(`  ${String(count(selector)).padStart(4)} · ${what} · ${neededFor.join(', ')}`);
    lines.push('', 'THE PLUGIN\'S OWN MARKS  found · mark');
    const marks = new Map();
    for (const el of doc.querySelectorAll('*')) {
      // Every prefix the parts use (0.4.277: the proposals' rfs-, the undo's rf-, the tag map's rtg- were not counted).
      for (const attr of el.attributes) if (/^data-(refinement|rf|rfs)-/.test(attr.name)) marks.set(attr.name, (marks.get(attr.name) || 0) + 1);
      if (typeof el.className === 'string') for (const cls of el.classList) if (/^(refinement-|rf-|rfs-|rfp-|rtg-|rs-)/.test(cls)) marks.set('.' + cls, (marks.get('.' + cls) || 0) + 1);
    }
    for (const [name, n] of [...marks].sort()) lines.push(`  ${String(n).padStart(4)} · ${name}`);
    if (!marks.size) lines.push('  none');
    showDiagnostics(lines.join('\n'));
  } catch (error) { console.error(error); notify(`Check stopped: ${error.message}`, 'error'); }
}
function describeElement(el, depth, lines, blockIds) {
  if (depth > 14 || lines.length > 150) return;
  const cs = el.ownerDocument.defaultView.getComputedStyle(el);
  const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '';
  const attrs = ['data-uuid', 'data-ref', 'blockid'].filter(a => el.hasAttribute(a))
    .map(a => `${a}=${String(el.getAttribute(a)).slice(0, 36)}`);
  const uuid = el.getAttribute('data-uuid');
  const notes = [`deco=${cs.textDecorationLine}`];
  if (uuid) notes.push(blockIds.has(uuid) ? 'block' : 'page');
  const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).filter(Boolean).join(' ').slice(0, 24);
  lines.push(`${'  '.repeat(depth)}<${el.tagName.toLowerCase()}${cls}${attrs.length ? ' ' + attrs.join(' ') : ''}> ${notes.join(' ')}${own ? ` "${own}"` : ''}`);
  if (el.tagName.toLowerCase() === 'svg') return;
  for (const child of el.children) describeElement(child, depth + 1, lines, blockIds);
}
function showDiagnostics(text) {
  modal(null, (box, finish, doc) => {
    const heading = doc.createElement('label');
    heading.textContent = 'Report from the Refinements plugin. Copy and paste it into your chat.';
    const area = doc.createElement('textarea');
    area.readOnly = true;
    area.value = text;
    area.style.cssText = 'width:100%;height:50vh;box-sizing:border-box;font:12px ui-monospace,monospace;padding:6px;border:1px solid var(--rf-ui-field);border-radius:6px;background:transparent;color:inherit;';
    const hint = modalHint(doc, '');
    box.append(heading, area, hint);
    area.focus();
    area.select();
    let copied = false;
    try { copied = doc.execCommand('copy'); } catch (error) { /* fall through */ }
    hint.textContent = copied ? 'Copied to the clipboard · Esc to close' : 'Press Cmd+C (Ctrl+C) to copy · Esc to close';
  }, 'min(720px, 92vw)');
}
async function copyDiagnostics(event) {
  try {
    const clickedId = typeof event?.uuid === 'string' ? event.uuid : null;
    const block = clickedId ? { uuid: clickedId } : (await logseq.Editor.getCurrentBlock() || (await logseq.Editor.getSelectedBlocks())?.[0]);
    if (!block?.uuid) return notify('Click in a block first, then run this again', 'warning');
    await logseq.Editor.exitEditingMode?.();
    const doc = host();
    const row = doc.querySelector(`.ls-block[blockid="${block.uuid}"]`);
    if (!row) return notify('That block is not visible on screen', 'warning');
    const content = [...row.querySelectorAll('.block-content')].find(el => el.closest('.ls-block[blockid]') === row) || row;
    // Which links inside point at a block rather than a page: asked of Logseq for each one (at most 40).
    const blockIds = new Set();
    for (const uuid of [...new Set([...content.querySelectorAll('[data-uuid]')].map(el => el.getAttribute('data-uuid')))].slice(0, 40)) {
      try { const entity = await logseq.Editor.getBlock(uuid); if (entity && !entity.name && !entity.originalName) blockIds.add(uuid); } catch (error) { /* counted as a page */ }
    }
    const lines = [await versionLine(),
      `row parent chain: ${[content.parentElement, content.parentElement?.parentElement].filter(Boolean).map(el => el.tagName.toLowerCase() + (typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '')).join(' < ')}`];
    describeElement(content, 0, lines, blockIds);
    showDiagnostics(lines.join('\n'));
  } catch (error) { console.error(error); notify(`Could not read the block: ${error.message}`, 'error'); }
}

/* Measuring for troubleshooting; it changes nothing on screen. Off unless the hidden setting
   debugPerf is true ("Turn measuring on or off"). While off, every perf.* call in the other files
   returns at once (shared.perf forwards to this object only while it measures). */
const perf = {
  on: false, win: null, since: 0, raf: 0, channel: null, observers: [], inFrame: false, ownWrite: false, log: [], every: 0,
  times: new Map(), seenBy: new Map(), styles: new Map(), passes: { ok: 0, late: 0, echo: 0 },
  long: { tasks: 0, taskMs: 0, frames: 0, frameMs: 0, worst: 0, pluginMs: 0, otherMs: 0 },
  shifts: { count: 0, score: 0, afterInput: 0, sources: new Map() },
  reset() {
    perf.since = Date.now();
    perf.times.clear(); perf.seenBy.clear(); perf.styles.clear(); perf.shifts.sources.clear();
    Object.assign(perf.passes, { ok: 0, late: 0, echo: 0 });
    Object.assign(perf.long, { tasks: 0, taskMs: 0, frames: 0, frameMs: 0, worst: 0, pluginMs: 0, otherMs: 0 });
    Object.assign(perf.shifts, { count: 0, score: 0, afterInput: 0 });
  },
  // Time spent in one update function.
  add(name, ms) {
    if (!perf.on) return;
    const s = perf.times.get(name) || { n: 0, total: 0, max: 0 };
    s.n++; s.total += ms; if (ms > s.max) s.max = ms;
    perf.times.set(name, s);
  },
  time(name, fn) {
    if (!perf.on) return fn();
    const started = performance.now();
    try { return fn(); } finally { perf.add(name, performance.now() - started); }
  },
  // What one watcher was called for: how many changes, of which kind, and which attributes.
  seen(name, records) {
    if (!perf.on) return;
    const s = perf.seenBy.get(name) || { calls: 0, records: 0, childList: 0, characterData: 0, attributes: 0, names: new Map() };
    s.calls++; s.records += records.length;
    for (const record of records) {
      s[record.type]++;
      if (record.type === 'attributes') s.names.set(record.attributeName, (s.names.get(record.attributeName) || 0) + 1);
    }
    perf.seenBy.set(name, s);
  },
  style(key, text, sent) {
    if (!perf.on) return;
    const s = perf.styles.get(key) || { built: 0, sent: 0, size: 0 };
    s.built++; if (sent) s.sent++; s.size = text.length;
    perf.styles.set(key, s);
  },
  // Was the change the shared watcher is about to handle made while a frame was being drawn (so
  // its pass lands a frame late), by the plugin's own pass (an echo), or in time?
  frameState() { return !perf.on ? '' : perf.ownWrite ? 'echo' : perf.inFrame ? 'late' : 'ok'; },
  pass(state) { if (perf.on && state) perf.passes[state]++; },
  passDone() {
    if (!perf.on) return;
    perf.ownWrite = true;
    queueMicrotask(() => { perf.ownWrite = false; });
  },
  start() {
    if (perf.on) return;
    const win = host().defaultView;
    perf.win = win; perf.on = true; perf.reset();
    shared.perf.impl = perf; // the other files' perf.* calls now reach this object
    // inFrame is true from the start of a frame's drawing until the first task after it.
    perf.channel = new MessageChannel();
    perf.channel.port1.onmessage = () => { perf.inFrame = false; };
    const tick = () => {
      if (!perf.on) return;
      perf.raf = win.requestAnimationFrame(tick);
      perf.inFrame = true;
      perf.channel.port2.postMessage(0);
    };
    perf.raf = win.requestAnimationFrame(tick);
    const seconds = Number(logseq.settings?.debugPerfEvery) || 0;
    if (seconds > 0) perf.every = setInterval(logPerfReport, Math.max(2, seconds) * 1000);
    const watch = (type, onEntry) => {
      try {
        const observer = new win.PerformanceObserver(list => { for (const entry of list.getEntries()) onEntry(entry); });
        observer.observe({ type });
        perf.observers.push(observer);
      } catch (error) { /* this browser does not report that kind */ }
    };
    watch('longtask', entry => { perf.long.tasks++; perf.long.taskMs += entry.duration; });
    watch('long-animation-frame', entry => {
      perf.long.frames++; perf.long.frameMs += entry.duration;
      if (entry.duration > perf.long.worst) perf.long.worst = entry.duration;
      for (const script of entry.scripts || []) {
        if (/(?:main|parts\/[a-z-]+)\.js\?t=/.test(script.sourceURL || '')) perf.long.pluginMs += script.duration; else perf.long.otherMs += script.duration;
      }
    });
    watch('layout-shift', entry => {
      if (entry.hadRecentInput) { perf.shifts.afterInput++; return; }
      perf.shifts.count++; perf.shifts.score += entry.value;
      for (const source of entry.sources || []) {
        const node = source.node, el = node?.nodeType === 1 ? node : node?.parentElement;
        if (!el) continue;
        const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
        const name = el.tagName.toLowerCase() + (cls ? '.' + cls : '');
        perf.shifts.sources.set(name, (perf.shifts.sources.get(name) || 0) + 1);
      }
    });
  },
  stop() {
    if (!perf.on) return;
    perf.on = false; perf.inFrame = false;
    shared.perf.impl = null;
    clearInterval(perf.every); perf.every = 0;
    perf.win?.cancelAnimationFrame(perf.raf);
    for (const observer of perf.observers) observer.disconnect();
    perf.observers = [];
    perf.channel?.port1.close();
    perf.channel = null;
  },
};
function togglePerf() {
  try {
    const on = !perf.on;
    logseq.updateSettings({ debugPerf: on });
    if (on) perf.start(); else perf.stop();
    notify(on ? 'Measuring is on. Use Logseq, then run “Copy performance report”' : 'Measuring is off');
  } catch (error) { console.error(error); notify(`Could not change measuring: ${error.message}`, 'error'); }
}
// Shows what was measured since the last report (or since measuring began), saves the same text
// in the plugin's settings file as perfReport, and starts counting afresh.
async function perfReportText() {
  const ms = value => value.toFixed(1);
  const lines = [await versionLine(), `measured for ${((Date.now() - perf.since) / 1000).toFixed(1)} s`, '',
    'WATCHERS  calls · changes seen (added or removed · text · attributes) · attributes that fired'];
  for (const [name, s] of perf.seenBy) {
    const names = [...s.names].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([attr, n]) => `${attr} ${n}`).join(', ');
    lines.push(`  ${name}: ${s.calls} · ${s.records} (${s.childList} · ${s.characterData} · ${s.attributes})${names ? ' · ' + names : ''}`);
  }
  lines.push('', 'UPDATES  calls · total ms · average ms · longest ms');
  for (const [name, s] of [...perf.times].sort((a, b) => b[1].total - a[1].total))
    lines.push(`  ${name}: ${s.n} · ${ms(s.total)} · ${ms(s.total / s.n)} · ${ms(s.max)}`);
  lines.push('', 'STYLESHEETS  times built · times sent to Logseq · latest size in characters');
  for (const [key, s] of perf.styles) lines.push(`  ${key}: ${s.built} · ${s.sent} · ${s.size}`);
  const p = perf.passes, l = perf.long, sh = perf.shifts;
  lines.push('', `SHARED WATCHER PASSES  in time ${p.ok} · a frame late ${p.late} · echo of the plugin's own changes ${p.echo}`,
    `LONG TASKS (over 50 ms)  ${l.tasks} · ${ms(l.taskMs)} ms in all`,
    `LONG FRAMES (over 50 ms)  ${l.frames} · ${ms(l.frameMs)} ms in all · worst ${ms(l.worst)} ms · plugin's code ${ms(l.pluginMs)} ms · other code ${ms(l.otherMs)} ms`,
    `LAYOUT SHIFTS (things moving without input)  ${sh.count} · score ${sh.score.toFixed(4)} · right after input (not counted) ${sh.afterInput}`);
  for (const [name, n] of [...sh.sources].sort((a, b) => b[1] - a[1]).slice(0, 12)) lines.push(`  moved ${n}×: ${name}`);
  perf.reset();
  return lines.join('\n');
}
async function copyPerfReport() {
  if (!perf.on) return notify('Measuring is off. Run “Turn measuring on or off” first', 'warning');
  const text = await perfReportText();
  logseq.updateSettings({ perfReport: text });
  showDiagnostics(text);
}
// With the hidden setting debugPerfEvery (seconds), a report is added to perfLog in the settings
// file at that interval, newest last, so a session can be measured without running the command.
async function logPerfReport() {
  try {
    const stamp = new Date().toTimeString().slice(0, 8);
    perf.log.push(`--- ${stamp} ---\n${await perfReportText()}`);
    if (perf.log.length > 40) perf.log.splice(0, perf.log.length - 40);
    logseq.updateSettings({ perfLog: perf.log.join('\n\n') });
  } catch (error) { warnOnce('could not save a performance report', error); }
}

// Every distinct warning of this session, so a problem that warn-once kept quiet can still be found.
async function copyWarnings() {
  const when = date => date.toTimeString().slice(0, 8);
  const lines = [await versionLine(), `${shared.warnings.length} distinct warning${shared.warnings.length === 1 ? '' : 's'} this session (time of the first · times · message)`, ''];
  for (const entry of shared.warnings) lines.push(`  ${when(entry.at)} · ${entry.count}× · ${entry.message}`);
  if (!shared.warnings.length) lines.push('  none');
  showDiagnostics(lines.join('\n'));
}

/* The tour (0.4.187), for checking a change in the real app one stop at a time. The stops are the hidden setting
   tourStops: "Page; Page; theme: dark; #/route; …" (a page's title, a view of its own by its address, or a theme).
   "Take the tour" opens the first stop and F8 goes on to the next, so whoever checks can look at each stop before
   moving on. At each stop it waits until the page has been still for a second (at most 8 s), and records how long
   the page's title and the plugin's own rows took to appear, what moved without input (with its score), and what
   Logseq wrote to its console as errors or warnings meanwhile. The report so far is saved as tourReport in the
   settings file after every stop; after the last one the theme is put back and the F8 key let go. Running "Take the
   tour" again while it runs ends it. It reads the screen only: nothing in your notes is changed. */
// run changes when a tour starts or ends, so a stop still being measured knows it is no longer wanted.
const tour = { stops: [], at: -1, lines: [], doc: null, keys: null, theme: '', console: null, busy: false, run: 0, stopVisit: null };
const TOUR_STILL = 1000, TOUR_LONGEST = 8000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const describeNode = node => !node ? '?' : node.nodeType !== 1 ? 'text' : node.tagName.toLowerCase() + (typeof node.className === 'string' && node.className.trim() ? '.' + node.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
async function tourBegin() {
  if (tour.doc) return tourEnd('ended early');
  tour.stops = String(logseq.settings?.tourStops || '').split(';').map(stop => stop.trim()).filter(Boolean);
  if (!tour.stops.length) return notify('No tour stops. Put them in the settings file as tourStops: "Page; Page; theme: dark; …"', 'warning');
  tour.doc = host();
  tour.run++;
  const win = tour.doc.defaultView;
  tour.theme = tour.doc.documentElement.getAttribute('data-theme') || '';
  tour.lines = [await versionLine(), `Tour of ${tour.stops.length} stops, started ${new Date().toTimeString().slice(0, 8)}. Times are from opening the stop, in ms.`, '',
    'STOP  title shown · plugin rows shown · still · moved without input (score) · console errors and warnings'];
  tour.console = { error: win.console.error, warn: win.console.warn, seen: [] };
  for (const kind of ['error', 'warn']) {
    win.console[kind] = (...args) => {
      // Recording must never break the caller: some values cannot be turned into text.
      try { tour.console.seen.push(`${kind}: ${args.map(arg => arg?.message || String(arg)).join(' ').slice(0, 200)}`); } catch (error) { tour.console.seen.push(`${kind}: (not readable)`); }
      return tour.console[kind].apply(win.console, args);
    };
  }
  tour.keys = event => { if (event.key === 'F8') { event.preventDefault(); event.stopPropagation(); tourNext(); } };
  tour.doc.addEventListener('keydown', tour.keys, true);
  tour.at = -1;
  tourNext();
}
async function tourNext() {
  if (tour.busy || !tour.doc) return;
  tour.at++;
  if (tour.at >= tour.stops.length) return tourEnd('end of the tour');
  tour.busy = true;
  const stop = tour.stops[tour.at], run = tour.run;
  let lines;
  try {
    const theme = stop.match(/^theme:\s*(light|dark)$/i);
    if (theme) { await logseq.App.setThemeMode(theme[1].toLowerCase()); await sleep(600); lines = ['', `— ${theme[1].toLowerCase()} —`]; }
    else lines = await tourVisit(stop);
  } catch (error) { lines = [`${stop}: could not be visited (${error.message})`]; }
  if (run !== tour.run) return; // ended meanwhile: its report is already saved
  tour.lines.push(...lines);
  tour.busy = false;
  logseq.updateSettings({ tourReport: tour.lines.join('\n'), tourAt: `${tour.at + 1} of ${tour.stops.length}: ${stop}` });
}
async function tourVisit(stop) {
  const doc = tour.doc, win = doc.defaultView, now = () => win.performance.now(), run = tour.run;
  const titleSelector = '#main-content-container :is(.ls-page-title, .page-title)';
  const oldTitle = doc.querySelector(titleSelector);
  const shifts = [], consoleFrom = tour.console.seen.length;
  const shiftWatch = new win.PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) shifts.push(entry); });
  shiftWatch.observe({ type: 'layout-shift' });
  const begun = now();
  let lastChange = begun, titleAt = 0, rowsAt = 0;
  const changes = new win.MutationObserver(() => {
    lastChange = now();
    const title = doc.querySelector(titleSelector);
    if (!titleAt && title && (title !== oldTitle || stop.startsWith('#'))) titleAt = lastChange;
    if (titleAt && !rowsAt && doc.querySelector('#main-content-container [class*="refinement-"]')) rowsAt = lastChange;
  });
  changes.observe(doc.body, { childList: true, subtree: true, characterData: true });
  if (stop.startsWith('#')) win.location.hash = stop; else logseq.App.pushState('page', { name: stop });
  let stopped = false;
  const stopWatching = () => { stopped = true; changes.disconnect(); shiftWatch.disconnect(); };
  tour.stopVisit = stopWatching;
  for (;;) {
    if (stopped || run !== tour.run) break;
    await sleep(100);
    const t = now();
    if ((t - lastChange > TOUR_STILL && t - begun > 400) || t - begun > TOUR_LONGEST) break;
  }
  stopWatching();
  if (tour.stopVisit === stopWatching) tour.stopVisit = null;
  const ms = t => t ? String(Math.round(t - begun)) : '–';
  const score = shifts.reduce((sum, entry) => sum + entry.value, 0);
  const seen = tour.console.seen.slice(consoleFrom);
  const lines = [`${stop}  ${ms(titleAt)} · ${ms(rowsAt)} · ${ms(lastChange)}${lastChange - begun >= TOUR_LONGEST - TOUR_STILL ? ' (still moving at 8 s)' : ''} · ${shifts.length} (${score.toFixed(4)}) · ${seen.length}`];
  const moved = new Map();
  for (const entry of shifts) for (const source of entry.sources || []) {
    const node = source.node, own = node?.nodeType === 1 && node.closest('[class*="refinement-"]') ? ' (the plugin\'s)' : '';
    const name = describeNode(node) + own;
    moved.set(name, (moved.get(name) || 0) + 1);
  }
  for (const [name, n] of [...moved].sort((a, b) => b[1] - a[1]).slice(0, 6)) lines.push(`    moved ${n}×: ${name}`);
  for (const line of [...new Set(seen)].slice(0, 6)) lines.push(`    ${line}`);
  return lines;
}
async function tourEnd(how) {
  const doc = tour.doc;
  tour.doc = null;
  tour.run++;
  tour.stopVisit?.();
  tour.stopVisit = null;
  tour.at = -1;
  tour.busy = false;
  if (!doc) return;
  doc.removeEventListener('keydown', tour.keys, true);
  const win = doc.defaultView;
  if (tour.console) { win.console.error = tour.console.error; win.console.warn = tour.console.warn; }
  if (tour.theme && doc.documentElement.getAttribute('data-theme') !== tour.theme) { try { await logseq.App.setThemeMode(tour.theme); } catch (error) { /* left as it is */ } }
  tour.lines.push('', `${how}. The plugin's own warnings this session: ${shared.warnings.length}.`);
  logseq.updateSettings({ tourReport: tour.lines.join('\n'), tourAt: 'done' });
  notify('Tour finished. The report is saved in the plugin\'s settings file as tourReport');
}
onUnload(() => { if (tour.doc) tourEnd('ended by a reload'); });

/* One palette entry, "Refinements: troubleshooting", opens this box; each tool keeps its command key
   (registered without a palette entry), so a shortcut bound to one still works. The features' own tools
   (addTroubleshooting) follow these. */
TOOLS.push(...[
  ['check-what-is-found', 'Check what the plugin finds on this page', () => checkWhatIsFound()],
  ['toggle-perf', 'Turn measuring on or off', () => togglePerf()],
  ['copy-perf-report', 'Copy performance report', () => copyPerfReport()],
  ['copy-styling-details', 'Copy styling details of this block', event => copyDiagnostics(event)],
  ['copy-warnings', 'Copy warnings', () => copyWarnings()],
  ['take-the-tour', 'Take the tour (F8 for the next stop)', () => tourBegin()],
].map(([key, label, run]) => ({ key, label, run })));
function openTroubleshooting() {
  return modal(null, (box, finish, doc) => {
    const heading = doc.createElement('label');
    heading.textContent = 'Troubleshooting tools of the Refinements plugin. None of them changes your notes.';
    const list = doc.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin:10px 0;';
    for (const tool of TOOLS) {
      const button = doc.createElement('button');
      button.textContent = tool.label;
      button.style.cssText = 'text-align:left;padding:6px 12px;border:1px solid var(--rf-ui-field);border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer;';
      button.addEventListener('click', event => { event.preventDefault(); finish(tool); tool.run(); });
      list.append(button);
    }
    box.append(heading, list, modalHint(doc, 'Esc to close'));
    list.firstElementChild?.focus();
  }, 'min(460px, 92vw)');
}

function provide(core) {
  core.provide({ addTroubleshooting, showReport: showDiagnostics, versionLine });
}
function start() {
  ({ CHECKED_WITH } = window.refinementCore.provided); // from the model part
  try { if (logseq.settings?.debugPerf === true) perf.start(); } catch (error) { warnOnce('measuring could not start', error); }
  onUnload(perf.stop);
}
window.refinementDiagnostics = { checkWhatIsFound, copyDiagnostics, togglePerf, copyPerfReport, copyWarnings, openTroubleshooting, tools: TOOLS };
function ready() {
  for (const tool of TOOLS) registerTool(tool);
  toolsRegistered = true;
}
// One palette entry opens the box that lists the tools.
const commands = [{ key: 'troubleshooting', label: 'Refinements: troubleshooting', run: () => openTroubleshooting() }];
/* Foundation only (0.4.167): the plugin runs just its foundation, the engine and the Logseq model (parts/model.js),
   with these tools and the settings window, so the foundation can be measured alone before the layers above it are
   built on it. The core reads the setting; the parts that stay mark themselves `foundation: true`. */
const settingsSchema = [
  { key: 'troubleshootHeading', type: 'heading', group: 'tools', rank: 4, title: 'Troubleshooting', default: null,
    legend: 'Run only the foundation, to measure it alone',
    zone: '<div><span class="m">Foundation only</span> · nothing drawn, measured alone</div>',
    description: 'For finding out what the plugin does and what it costs. The tools themselves are in the command palette under “Refinements: troubleshooting”.' },
  { key: 'foundationOnly', type: 'boolean', title: 'Foundation only', default: false,
    description: 'Runs only the plugin’s foundation: the part that watches Logseq and the part that knows what pages, blocks, tags and days are. Nothing is drawn and no shortcut works; the settings window and the troubleshooting tools stay. For measuring the foundation alone (turn measuring on in the troubleshooting tools). Applies after you reload the plugin.' },
];
(window.refinementParts ||= []).push({ name: 'diagnostics', foundation: true, schema: settingsSchema, provide, start, ready, commands, stop: runUnloadTasks });
})();
