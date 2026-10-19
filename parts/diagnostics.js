/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Troubleshooting tools of DB Refinements. Nothing here changes what is on screen; each tool shows a
   report in a box (and copies it) or measures. The palette entries are registered by main.js, which
   calls these tools by name through window.refinementDiagnostics:
   - checkWhatIsFound     how many of each Logseq part the plugin looks for are on screen, and its own marks;
   - copyDiagnostics      how Logseq built one block (for aiming a styling rule);
   - copyHeaderDiagnostics  how Logseq built the page title area;
   - checkLinkLabels      what the database says links to this page, and how it is drawn;
   - copyFoldLog          what happened to each result after a fold-all command (startFoldLog records it);
   - togglePerf, copyPerfReport  measuring of the plugin's own work (perf), with logPerfReport for the
     hidden debugPerfEvery setting;
   - copyWarnings         every warnOnce message of this session.
   The tools read the core's state (the fold-all lists, the page title selector, the look-ups) through
   window.refinementCore, which main.js publishes before it starts any part. */
const shared = window.refinementShared;
const { host, notify, modal, modalHint } = shared;
// Warnings keep the plain "Refinements: " prefix these tools always had.
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements: ' });
// From the core (window.refinementCore), taken when the part starts.
let CHECKED_WITH, PAGE_TITLE, REFERENCE_AREAS, referencedNodeIds, incomingPropertyLinks, pageTitles, pageHeaderOf, listFold, listRows, foldLog, logFold, rowName;

/* copyDiagnostics: describe how Logseq built one block, so styling can target the real structure.
   Text is shortened to a few words; nothing is changed or sent anywhere. */

// First line of every troubleshooting report: this plugin's and Logseq's version.
async function versionLine() {
  let logseqVersion = '?';
  try { logseqVersion = (await logseq.App.getInfo('version')) || '?'; } catch (error) { /* ignore */ }
  const note = logseqVersion !== '?' && logseqVersion !== CHECKED_WITH ? ` (the plugin was last checked against Logseq ${CHECKED_WITH})` : '';
  return `DB Refinements ${logseq.baseInfo?.version || '?'} · Logseq ${logseqVersion}${note}`;
}
/* Troubleshooting after a Logseq update: how many of each thing the plugin looks for are on screen.
   A zero is normal when the page has none of that thing; a zero for something you can see on the
   page means Logseq renamed it, and the features listed beside it have stopped. Nothing is changed. */
const healthChecks = () => [
  ['the page area', '#main-content-container', 'everything'],
  ['blocks', '.ls-block[blockid]', 'cues, reference rows, list properties, fold all'],
  ['block text', '.block-title-wrap', 'cues after a block, block-link dot, reference rows'],
  ['block content', '.block-content', 'tags, file icons, links inside references'],
  ['block row', '.block-main-container .block-content-wrapper', '“Doctor:” and “via …” labels'],
  ['bullets', '.bullet-container', 'PDF quote bullet, list properties'],
  ['fold arrows', 'a.block-control', 'fold all, always-visible title triangle'],
  ['fold state', '.ls-block[data-collapsed]', 'fold all'],
  ['nesting lines', '.block-children', 'faint nesting lines'],
  ['page links', 'a.page-ref', 'quiet links, dates, tag-page icons'],
  ['page links with an id', 'a.page-ref[data-uuid]', 'block links, tag pages, journal dates'],
  ['link wrappers', '.page-reference', 'quiet links'],
  ['tags', 'a.tag', 'tag background'],
  ['PDF highlight labels', '.prefix-link .hl-page', 'compact PDF citations'],
  ['date values', '.ls-datetime, .timestamp', 'date boxes'],
  ['page title', PAGE_TITLE, 'title tags, #Page, alias and inherited lines'],
  ['title row', '.is-page-title-row', 'title tags, title triangle'],
  ['title actions', '.ls-page-title-actions > div', 'always-visible actions, #Page, Add tags'],
  ['title tags', '.is-page-title-row .ls-block-right .block-tags', 'tags beside the title actions'],
  ['page properties', '.ls-page-properties', 'inherited line'],
  ['block properties', '.positioned-properties', 'plainer properties'],
  ['property capsules', '.bottom-property-pill', 'plainer properties'],
  ['property names', '.property-key, .page-property-key', 'list property picker'],
  ['reference areas', REFERENCE_AREAS, 'reference headings, “Doctor:” labels, the wash on the link here'],
  ['parent paths', '.breadcrumb.block-parents', 'tidy parent paths, hidden property path'],
  ['path parts', '.breadcrumb__label', 'faded brackets in paths'],
  ['group headings', '.ls-foldable-header', 'date headings of grouped queries'],
  ['queries', '.custom-query', 'fold all, list properties per query'],
  ['embedded blocks', '.embed-block', 'line beside embedded content'],
  ['right sidebar', '#right-sidebar', 'sidebar tidy'],
  ['right sidebar buttons', '.cp__right-sidebar-settings', 'hidden Page graph and (Dev) buttons'],
  ['left sidebar', '#left-sidebar', 'quiet items, plain page icons, page labels'],
  ['left sidebar links', '#left-sidebar a.link-item .page-icon', 'icons only where they mean something'],
  ['page properties list', '.ls-page-properties.ls-properties-area', 'grey field, one column of dots, Add property on hover'],
  ['journal days', '#journals .journal-item', 'days as tall as what they hold'],
  ['toolbar', '#head', 'quiet items'],
];
async function checkWhatIsFound() {
  try {
    const doc = host();
    const count = selector => { try { return doc.querySelectorAll(selector).length; } catch (error) { return 'bad selector'; } };
    const lines = [await versionLine(), 'What the plugin finds on screen now. A zero is normal when this page has none of that thing.', '',
      'LOGSEQ\'S OWN PARTS  found · what · needed for'];
    for (const [what, selector, neededFor] of healthChecks()) lines.push(`  ${String(count(selector)).padStart(4)} · ${what} · ${neededFor}`);
    lines.push('', 'THE PLUGIN\'S OWN MARKS  found · mark');
    const marks = new Map();
    for (const el of doc.querySelectorAll('*')) {
      for (const attr of el.attributes) if (attr.name.startsWith('data-refinement-')) marks.set(attr.name, (marks.get(attr.name) || 0) + 1);
      if (typeof el.className === 'string') for (const cls of el.classList) if (cls.startsWith('refinement-')) marks.set('.' + cls, (marks.get('.' + cls) || 0) + 1);
    }
    for (const [name, n] of [...marks].sort()) lines.push(`  ${String(n).padStart(4)} · ${name}`);
    if (!marks.size) lines.push('  none');
    showDiagnostics(lines.join('\n'));
  } catch (error) { console.error(error); notify(`Check stopped: ${error.message}`, 'error'); }
}
const innerPageUnderline = '.ls-block .block-content a.page-ref[data-uuid] a.page-ref[data-uuid]:not(.tag):not([data-refinement-date], [data-uuid^="00000001-"])';
function describeElement(el, depth, lines, nodeIds) {
  if (depth > 14 || lines.length > 150) return;
  const cs = el.ownerDocument.defaultView.getComputedStyle(el);
  const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '';
  const attrs = ['data-uuid', 'data-ref', 'blockid'].filter(a => el.hasAttribute(a))
    .map(a => `${a}=${String(el.getAttribute(a)).slice(0, 36)}`);
  const uuid = el.getAttribute('data-uuid');
  const notes = [`deco=${cs.textDecorationLine}`];
  if (uuid) notes.push(nodeIds.has(uuid) ? 'block' : 'page');
  try { if (el.matches(innerPageUnderline)) notes.push('underline-rule'); } catch (error) { /* ignore */ }
  const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).filter(Boolean).join(' ').slice(0, 24);
  lines.push(`${'  '.repeat(depth)}<${el.tagName.toLowerCase()}${cls}${attrs.length ? ' ' + attrs.join(' ') : ''}> ${notes.join(' ')}${own ? ` "${own}"` : ''}`);
  if (el.tagName.toLowerCase() === 'svg') return;
  for (const child of el.children) describeElement(child, depth + 1, lines, nodeIds);
}
function showDiagnostics(text) {
  modal(null, (box, finish, doc) => {
    const heading = doc.createElement('label');
    heading.textContent = 'Report from the Refinements plugin. Copy and paste it into your chat.';
    const area = doc.createElement('textarea');
    area.readOnly = true;
    area.value = text;
    area.style.cssText = 'width:100%;height:50vh;box-sizing:border-box;font:12px ui-monospace,monospace;padding:6px;border:1px solid var(--ls-border-color);border-radius:6px;background:transparent;color:inherit;';
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
    const nodeIds = await referencedNodeIds();
    const lines = [await versionLine(),
      `row parent chain: ${[content.parentElement, content.parentElement?.parentElement].filter(Boolean).map(el => el.tagName.toLowerCase() + (typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '')).join(' < ')}`];
    describeElement(content, 0, lines, nodeIds);
    showDiagnostics(lines.join('\n'));
  } catch (error) { console.error(error); notify(`Could not read the block: ${error.message}`, 'error'); }
}

/* Troubleshooting for the "via Diagnosis" labels: what the database says links to this page,
   and how Logseq draws those records on screen. Nothing is changed. */
async function checkLinkLabels() {
  try {
    const page = await logseq.Editor.getCurrentPage?.();
    if (!page?.id) return notify('Open the page whose tabbed list you want to check', 'warning');
    const lines = [await versionLine(),
      `page id=${page.id} uuid=${page.uuid}`];
    const run = async (label, query) => {
      try {
        const rows = await logseq.DB.datascriptQuery(query);
        lines.push(`${label}: ${Array.isArray(rows) ? rows.length + ' rows' : typeof rows}`);
        for (const row of (rows || []).slice(0, 12)) lines.push('  ' + JSON.stringify(row).slice(0, 160));
        return rows || [];
      } catch (error) { lines.push(`${label}: ERROR ${error?.message || error}`); return []; }
    };
    const pointing = await run('A. anything pointing at this page', `[:find ?uuid ?attr
      :where [(identity ${page.id}) ?page] [?b ?attr ?page] [?b :block/uuid ?uuid]]`);
    await run('B. property entities (count)', `[:find (count ?p)
      :where [?p :block/tags ?c] [?c :db/ident :logseq.class/Property]]`);
    await run('C. label query without filter', `[:find ?uuid ?name ?attr
      :where [(identity ${page.id}) ?page]
      [?prop :block/tags ?class] [?class :db/ident :logseq.class/Property]
      [?prop :db/ident ?attr] [?b ?attr ?page] [?prop :block/title ?name] [?b :block/uuid ?uuid]]`);
    const found = await incomingPropertyLinks();
    lines.push(`D. labels the plugin would show: ${found.size}`);
    for (const [uuid, names] of found) lines.push(`  ${uuid} → via ${[...names].join(', ')}`);
    const doc = host();
    const uuids = new Set([...pointing.map(row => String(row[0])), ...found.keys()]);
    lines.push('E. on screen:');
    for (const uuid of [...uuids].slice(0, 8)) {
      const hits = doc.querySelectorAll(`[blockid="${uuid}"], [data-uuid="${uuid}"], [data-ref="${uuid}"], [data-id="${uuid}"]`);
      lines.push(`  ${uuid}: ${hits.length} element(s)`);
      for (const el of [...hits].slice(0, 4)) {
        const chain = [];
        for (let node = el, i = 0; node && node !== doc.body && i < 6; node = node.parentElement, i++) {
          const cls = typeof node.className === 'string' && node.className.trim() ? '.' + node.className.trim().split(/\s+/).slice(0, 4).join('.') : '';
          chain.push(node.tagName.toLowerCase() + cls);
        }
        const inRefs = Boolean(el.closest(REFERENCE_AREAS));
        lines.push(`    ${chain.join(' < ')}${inRefs ? '  [in linked references]' : ''}`);
      }
    }
    showDiagnostics(lines.join('\n'));
  } catch (error) { console.error(error); notify(`Check stopped: ${error.message}`, 'error'); }
}

// Troubleshooting: how Logseq builds the page title area, so the always-shown rule can be aimed.
async function copyHeaderDiagnostics() {
  try {
    const doc = host();
    const titles = [...pageTitles(doc)];
    if (!titles.length) return notify('Open a page first', 'warning');
    const lines = [await versionLine(), `page titles found: ${titles.length}`];
    const header = pageHeaderOf(titles[0]);
    lines.push(`header parent chain: ${[header.parentElement, header.parentElement?.parentElement].filter(Boolean).map(el => el.tagName.toLowerCase() + (el.getAttribute('class') ? '.' + el.getAttribute('class').trim().split(/\s+/).join('.') : '')).join(' < ')}`);
    const win = doc.defaultView;
    for (const el of [header, ...header.querySelectorAll('*')].slice(0, 150)) {
      let depth = 0;
      for (let node = el; node && node !== header; node = node.parentElement) depth++;
      const cs = win.getComputedStyle(el);
      const cls = el.getAttribute('class') ? '.' + el.getAttribute('class').trim().split(/\s+/).join('.') : '';
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).filter(Boolean).join(' ').slice(0, 24);
      const shown = el.hasAttribute('data-refinement-always-shown') ? ' [always shown]' : '';
      lines.push(`${'  '.repeat(depth)}<${el.tagName.toLowerCase()}${cls}> opacity=${cs.opacity} vis=${cs.visibility} display=${cs.display}${shown}${own ? ` "${own}"` : ''}`);
    }
    showDiagnostics(lines.join('\n'));
  } catch (error) { console.error(error); notify(`Could not read the page title area: ${error.message}`, 'error'); }
}

const resultRow = row => [...listFold.wanted.keys()].some(key => listRows(row.ownerDocument, key).includes(row));
function startFoldLog() {
  if (foldLog.observer) return;
  const doc = host(), win = doc.defaultView;
  foldLog.start = foldLog.start || Date.now();
  foldLog.observer = new win.MutationObserver(records => {
    let added = 0, removed = 0;
    for (const record of records) {
      if (record.type === 'attributes') {
        const row = record.target;
        if (!row.matches?.('.ls-block[blockid]') || !row.parentElement?.closest('.custom-query, .ls-view-body')) continue;
        const pressed = Date.now() - (foldLog.pressedAt.get(row) || 0) < 1500;
        logFold(`${rowName(row)} ${record.oldValue} -> ${row.getAttribute('data-collapsed')}${pressed ? ' (after plugin press)' : ''}${listFold.manual.has(row) ? ' (yours)' : ''}${resultRow(row) ? '' : ' (not in a fold-all list)'}`);
      } else {
        const count = nodes => [...nodes].filter(n => n.nodeType === 1 && n.matches('.ls-block[blockid], :has(.ls-block[blockid])') && n.closest?.('.custom-query, .ls-view-body')).length;
        added += count(record.addedNodes);
        removed += [...record.removedNodes].filter(n => n.nodeType === 1 && n.matches('.ls-block[blockid], :has(.ls-block[blockid])')).length;
      }
    }
    if (added || removed) logFold(`results drawn: ${added} added, ${removed} removed`);
  });
  foldLog.observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-collapsed'] });
  if (foldLog.listening) return;
  foldLog.listening = true;
  listen(win, ['scroll'], () => { if (Date.now() - foldLog.scrollAt > 1000) { foldLog.scrollAt = Date.now(); logFold('scrolling'); } });
  listen(doc, ['focusin'], event => { if (event.target.matches?.('textarea')) logFold('started editing a block'); });
  listen(doc, ['focusout'], event => { if (event.target.matches?.('textarea')) logFold('stopped editing a block'); });
  onUnload(() => { foldLog.observer?.disconnect(); foldLog.observer = null; });
}
async function copyFoldLog() {
  if (!foldLog.start) return notify('Run "Unfold all results" first, then wait until a result folds back, then run this', 'warning');
  const doc = host();
  const now = [...listFold.wanted].map(([key, { collapse }]) => {
    const rows = listRows(doc, key);
    const wrong = rows.filter(row => (row.getAttribute('data-collapsed') === 'true') !== collapse);
    return `active: ${collapse ? 'fold' : 'unfold'} ${key.slice(0, 14)}… · ${rows.length} results drawn · ${wrong.length} not as chosen: ${wrong.slice(0, 5).map(row => `${rowName(row)}${listFold.manual.has(row) ? ' (yours)' : ''} misses=${listFold.pressed.get(row)?.misses || 0}`).join(', ')}`;
  });
  showDiagnostics([await versionLine(), ...(now.length ? now : ['active: none (cleared by a page change, or never set)']), '', ...foldLog.lines].join('\n'));
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

/* One palette entry, "Refinements: troubleshooting", opens this box; each tool keeps its command key
   (registered by main.js without a palette entry), so a shortcut bound to one still works. */
const TOOLS = [
  ['check-link-labels', 'Check linked-record labels', () => checkLinkLabels()],
  ['copy-header-details', 'Copy page title area details', () => copyHeaderDiagnostics()],
  ['check-what-is-found', 'Check what the plugin finds on this page', () => checkWhatIsFound()],
  ['copy-fold-log', 'Copy fold log', () => copyFoldLog()],
  ['toggle-perf', 'Turn measuring on or off', () => togglePerf()],
  ['copy-perf-report', 'Copy performance report', () => copyPerfReport()],
  ['copy-styling-details', 'Copy styling details of this block', event => copyDiagnostics(event)],
  ['copy-warnings', 'Copy warnings', () => copyWarnings()],
].map(([key, label, run]) => ({ key, label, run }));
function openTroubleshooting() {
  return modal(null, (box, finish, doc) => {
    const heading = doc.createElement('label');
    heading.textContent = 'Troubleshooting tools of the Refinements plugin. None of them changes your notes.';
    const list = doc.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin:10px 0;';
    for (const tool of TOOLS) {
      const button = doc.createElement('button');
      button.textContent = tool.label;
      button.style.cssText = 'text-align:left;padding:6px 12px;border:1px solid var(--ls-border-color);border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer;';
      button.addEventListener('click', event => { event.preventDefault(); finish(tool); tool.run(); });
      list.append(button);
    }
    box.append(heading, list, modalHint(doc, 'Esc to close'));
    list.firstElementChild?.focus();
  }, 'min(460px, 92vw)');
}

function start() {
  const core = window.refinementCore;
  ({ CHECKED_WITH, PAGE_TITLE } = core.provided); // from the model part
  ({ pageTitles, pageHeaderOf, listFold, listRows, foldLog, logFold, rowName, referencedNodeIds, incomingPropertyLinks, REFERENCE_AREAS } = core.provided); // from the pages, properties, links and styles parts
  core.onFoldAll(startFoldLog);
  try { if (logseq.settings?.debugPerf === true) perf.start(); } catch (error) { warnOnce('measuring could not start', error); }
  onUnload(perf.stop);
}
window.refinementDiagnostics = { checkWhatIsFound, copyDiagnostics, copyHeaderDiagnostics, checkLinkLabels, copyFoldLog, togglePerf, copyPerfReport, copyWarnings, openTroubleshooting, tools: TOOLS };
function ready() {
  // Each tool keeps its command key, registered without a palette entry (a shortcut the owner bound to one
  // still works); the troubleshooting box lists them by name.
  for (const tool of TOOLS) logseq.App.registerCommand('global', { key: tool.key, label: 'Troubleshooting: ' + tool.label }, tool.run);
}
// One palette entry opens the box that lists the tools.
const commands = [{ key: 'troubleshooting', label: 'Refinements: troubleshooting', run: () => openTroubleshooting() }];
/* Foundation only (0.4.167): the plugin runs just its foundation, the engine and the Logseq model (parts/model.js),
   with these tools and the settings window, so the foundation can be measured alone before the layers above it are
   built on it. The core reads the setting; the parts that stay mark themselves `foundation: true`. */
const settingsSchema = [
  { key: 'troubleshootHeading', type: 'heading', group: 'tools', rank: 4, title: 'Troubleshooting', default: null,
    description: 'For finding out what the plugin does and what it costs. The tools themselves are in the command palette under “Refinements: troubleshooting”.' },
  { key: 'foundationOnly', type: 'boolean', title: 'Foundation only', default: false,
    description: 'Runs only the plugin’s foundation: the part that watches Logseq and the part that knows what pages, blocks, tags and days are. Nothing is drawn and no shortcut works; the settings window and the troubleshooting tools stay. For measuring the foundation alone (turn measuring on in the troubleshooting tools). Applies after you reload the plugin.' },
];
(window.refinementParts ||= []).push({ name: 'diagnostics', foundation: true, schema: settingsSchema, start, ready, commands, stop: runUnloadTasks });
})();
