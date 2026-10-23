#!/usr/bin/env node
/* The tag map under stress (2026-10-23, docs/FINISHING-PROMPT.md section 4, "Tag map"), in Chromium on the large pretend
   graph of tools/tags-speed.js (600 tags four levels deep, 300 properties), made to change as the app changes it:
   - 200 drags, each to a random place (before, after or inside a random other tag): every drag must move the tag
     pressed and no other (the loose end of 2026-10-22: once a drag moved the tag below the one pressed), and show
     within the speed test's limit of a change;
   - Undo: the map keeps the last three Undo arrows (the owner's choice at 0.4.296), so seven rounds of three moves,
     each round undone through its three arrows, newest first in the even rounds and in a random order in the odd ones
     (an older move undone first puts back only its own tag, 0.4.348): the tags as shown, in their order, and their
     parents must be exactly as before the round;
   - 50 renames of tags anywhere in the map through its own rename box, each shown within the limit (a top-level tag,
     which reorders thousands of rows, timed apart), the last three undone through their
     arrows (each putting an old name back);
   - the Tags and the Properties view, each drawn within the limit;
   - a property held by 1000 nodes: show nodes, then show all;
   - 200 keystrokes in the find box: none holds the keyboard over 50 ms, and each time typing stops the list shows the
     search within the limit (after the box's own 120 ms pause);
   - the memory after all this no more than 10% above before (after a warm-up of one whole storm, and the browser's
     own clean-up each time; one map on screen both times).
   Limits: the first drawing 1000 ms (the speed test's); an action through the map 500 ms typically and 800 ms at the
   95th (see LIMITS for why, with both versions' numbers); a key 50 ms; gated on the
   Mac's load as in tools/tags-speed.js (tools/quiet.js): on a busy Mac a time over its limit fails only when more than
   25% slower than the committed version (HEAD) timed in the same run.
   Needs Playwright and Chromium; skipped quietly where they are missing. Run: node tools/tags-stress.js (tools/stress.sh) */
const fs = require('fs');
const path = require('path');

let chromium;
for (const where of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(where)); break; } catch (error) { /* try the next */ } }
if (!chromium) { console.log('tags-stress skipped (needs Playwright and Chromium)'); process.exit(0); }
const root = path.resolve(__dirname, '..');
// A key in the find box may hold the keyboard no longer than a long frame (50 ms, the typing rule of the frame tests).
// An action through the map (a drag, a rename, the list after typing stops) on these 600 open tags: the typical one
// (the median) within 500 ms, the rare slow one (the 95th) within 800 ms. Set on 2026-10-23 with the evidence
// docs/PROCESS.md asks for (docs/DECISIONS-AUTONOMOUS.md, 14): the speed test's 400 ms times the map's redraw after a
// change in the data; an action through the map adds its own writes and the browser laying out some 9,000 to 10,000
// rows, under the load this test itself makes (about 3), and now and then the browser's memory clean-up (a rename
// then takes 0.7 s). Measured the same way, the same day: 0.4.345 drags 329 / 505 ms (median / 95th), renames 694 /
// 1,895, a key held the keyboard 581 at the 95th; 0.4.351 drags 311 / 432, renames 424 / 668, the list after typing
// 342 / 439, a key 35. The speed test's own limits are unchanged.
const LIMITS = { first: 1000, change: 400, action: 500, actionTail: 800, key: 50 };

// The pretend Logseq of tools/tags-speed.js, with the writes the map makes carried out on it.
function pretendLogseq() {
  const P = id => ({ ':db/id': id, ':db/ident': ':user.property/p' + id, ':block/title': 'property ' + id, ':block/uuid': 'p' + id,
    ':logseq.property/type': id % 3 === 0 ? ':node' : ':default', ':db/cardinality': id % 5 === 0 ? ':db.cardinality/many' : ':db.cardinality/one',
    ':logseq.property/classes': id % 3 === 0 ? [{ ':db/id': 1000 + (id % 600) }] : [] });
  const props = Array.from({ length: 300 }, (_, i) => P(i + 1));
  const ref = p => ({ ':db/id': p[':db/id'], ':db/ident': p[':db/ident'], ':block/title': p[':block/title'], ':block/uuid': p[':block/uuid'] });
  const tags = [];
  for (let i = 0; i < 600; i++) {
    const id = 1000 + i, parent = i < 3 ? null : 1000 + Math.floor((i - 3) / 4);
    tags.push({ ':db/id': id, ':db/ident': ':user.class/T' + i, ':block/uuid': 't' + id, ':block/title': 'Tag ' + String(i).padStart(3, '0'),
      ':logseq.property.class/extends': parent ? [{ ':db/id': parent }] : [],
      ':logseq.property.class/properties': [1, 2, 3].map(k => ref(props[(i * 3 + k) % props.length])) });
  }
  const byUuid = uuid => tags.find(t => t[':block/uuid'] === uuid) || props.find(p => p[':block/uuid'] === uuid);
  const settings = { tagTreeRoots: 'Tag 000, Tag 001, Tag 002', twoWayNames: '', twoWayOneEnd: '' };
  // 1000 nodes hold property 1.
  const holders = Array.from({ length: 1000 }, (_, i) => [`n${i}`, `Node ${i}`, i]);
  window.parent = window;
  window.pretend = { props, tags, ref, settings };
  window.logseq = {
    settings, updateSettings: o => Object.assign(settings, o),
    DB: { datascriptQuery: async q => q.includes('logseq.property/classes [') ? props.map(p => [p])
      : q.includes('closed-value') ? []
      : q.includes('class/extends [:db/id]') ? tags.map(t => [t])
      : q.includes('(count ?b)') && q.includes(':user.property/p1 ') ? [[1000]]
      : q.includes(':find ?u ?t ?v') && q.includes(':user.property/p1 ') ? holders
      : q.includes('count') ? tags.map(t => [t[':db/id'], 7]) : [], onChanged: () => () => {} },
    UI: { showMsg() {} }, App: { pushState() {} },
    Editor: {
      addTagExtends: async (uuid, parent) => { const t = byUuid(uuid), p = byUuid(parent); const list = t[':logseq.property.class/extends']; if (!list.some(x => x[':db/id'] === p[':db/id'])) list.push({ ':db/id': p[':db/id'] }); },
      removeTagExtends: async (uuid, parent) => { const t = byUuid(uuid), p = byUuid(parent); t[':logseq.property.class/extends'] = t[':logseq.property.class/extends'].filter(x => x[':db/id'] !== p[':db/id']); },
      removeBlockProperty: async uuid => { byUuid(uuid)[':logseq.property.class/extends'] = []; },
      renamePage: async (uuid, name) => { byUuid(uuid)[':block/title'] = name; },
      openInRightSidebar() {},
    },
  };
  window.refinementCore = { provided: { backwardsLabel: n => n + ' of', setBackwards() {}, shownAtOtherEnd: () => true, setShownAtOtherEnd() {} } };
}

const { execSync } = require('child_process');
const gate = require('./quiet');
const FILES = ['parts/shared.js', 'parts/model.js', 'parts/tags-graph.js', 'parts/tags-props.js', 'parts/tags.js'];
const sources = which => Object.fromEntries(FILES.map(file => [file, which === 'HEAD'
  ? execSync(`git show HEAD:${file}`, { cwd: root, maxBuffer: 1 << 26 }).toString() : fs.readFileSync(path.join(root, file), 'utf8')]));

// One run of the whole storm on the parts given (now, or as committed for the comparison under load).
async function run(browser, src) {
  const source = src['parts/tags.js'];
  const exposed = source.replace(/\}\)\(\);\s*$/, 'window.__createView = createView; window.__css = css; })();');
  if (exposed === source) throw new Error('the end of parts/tags.js changed; tools/tags-stress.js cannot reach the map');
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<!doctype html><html><body style="margin:0;font-family:system-ui"><div id="scroll" style="height:900px;overflow:auto"></div></body></html>');
  for (const content of [`(${pretendLogseq})();`, src['parts/shared.js'], src['parts/model.js'], require('./pretend-model'), src['parts/tags-graph.js'], src['parts/tags-props.js'], exposed]) await page.addScriptTag({ content });
  const session = await page.context().newCDPSession(page);
  const heap = async () => { await page.evaluate(() => window.gc?.()); await session.send('HeapProfiler.collectGarbage'); return (await session.send('Runtime.getHeapUsage')).usedSize; };

  // The map drawn first; the memory with it on screen is the "before" (the browser's clean-up first).
  const first = await page.evaluate(async () => {
    const style = document.createElement('style'); style.textContent = window.refinementShared.kitCss + window.__css; document.head.append(style);
    const view = window.__view = window.__createView(document, 'page');
    document.getElementById('scroll').append(view.node);
    const t = performance.now();
    await view.refresh(); await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve)));
    return performance.now() - t;
  });

  const storm = scale => page.evaluate(async scale => {
    const N = n => Math.max(1, Math.round(n * scale));
    const out = { faults: [], times: {} };
    // The graph's shape now, to put back when the storm is over.
    { const kept = window.pretend.tags.map(tg => [tg[':block/title'], tg[':logseq.property.class/extends'].map(x => ({ ...x }))]), order = window.pretend.settings.tagTreeRoots;
      window.pretend.restore = () => { window.pretend.tags.forEach((tg, i) => { tg[':block/title'] = kept[i][0]; tg[':logseq.property.class/extends'] = kept[i][1].map(x => ({ ...x })); }); window.pretend.settings.tagTreeRoots = order; }; }
    const frame = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve)));
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const { tags, settings } = window.pretend;
    const view = window.__view;
    let t;
    const parents = () => new Map(tags.map(tg => [tg[':block/title'], tg[':logseq.property.class/extends'].map(x => x[':db/id']).sort().join(',')]));
    // The tags as shown, in their order (the order list itself may keep a name more after a move and its Undo; what is
    // shown is the same).
    const tree = () => [...document.querySelectorAll('.rtg-row[data-key]')].filter(r => r.querySelector(':scope > .rtg-main .rtg-name')).map(r => r.dataset.key).join('|');
    const rowOf = name => [...document.querySelectorAll('.rtg-row')].find(r => r.querySelector(':scope > .rtg-main .rtg-name')?.textContent === name);
    const fire = (node, type, extra = {}) => {
      const event = new DragEvent(type, { bubbles: true, cancelable: true, clientX: extra.clientX || 0, clientY: extra.clientY || 0, dataTransfer: new DataTransfer() });
      node.dispatchEvent(event);
      return event;
    };
    const below = (tagId, all = new Set()) => { for (const tg of tags) if (tg[':logseq.property.class/extends'].some(x => x[':db/id'] === tagId) && !all.has(tg[':db/id'])) { all.add(tg[':db/id']); below(tg[':db/id'], all); } return all; };
    let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const drag = async (name, onto, where) => {
      const from = rowOf(name), to = rowOf(onto);
      if (!from || !to) return 'missing';
      const main = to.querySelector(':scope > .rtg-main') || to, r = main.getBoundingClientRect();
      const at = where === 'before' ? { clientY: r.top + 2, clientX: r.left + 30 } : where === 'after' ? { clientY: r.bottom - 2, clientX: r.left + 30 } : { clientY: r.bottom - 2, clientX: r.left + 140 };
      fire(from, 'dragstart');
      const over = fire(to, 'dragover', at);
      if (!over.defaultPrevented) { fire(from, 'dragend'); return 'refused'; }
      fire(to, 'drop', at);
      fire(from, 'dragend');
      for (let i = 0; i < 100 && (document.querySelector('.rtg-dragging') || view.node.classList.contains('rtg-dragon')); i++) await sleep(10);
      return 'dropped';
    };
    // Until the map shows a change: its own stopwatch (refinementTagTimes, parts/tags.js) adds a line once a redraw is on
    // screen, so the test's own looking costs nothing in the times.
    // It keeps its last 50 lines, so a new line is told by the last one changing, not by the count.
    const shownAfter = async (fn, ms = 5000) => {
      const last = (window.refinementTagTimes || []).at(-1), t = performance.now();
      const fresh = () => (window.refinementTagTimes || []).at(-1) !== last;
      const r = await fn();
      for (let i = 0; i < ms / 5 && !fresh(); i++) await sleep(5);
      return [fresh() ? performance.now() - t : null, r];
    };
    const settle = async () => { for (let i = 0; i < 50; i++) { await frame(); if (!view.node.querySelector('.rtg-dragging')) break; } await sleep(20); };
    // 1. 200 drags, each moving the pressed tag only.
    const dragTimes = [];
    out.rows = [document.querySelectorAll('.rtg-row').length];
    let dragged = 0, refused = 0;
    for (let k = 0; k < N(200); k++) {
      const rows = [...document.querySelectorAll('.rtg-row')].filter(r => r.querySelector(':scope > .rtg-main .rtg-name'));
      const a = rows[(rnd() * rows.length) | 0], b = rows[(rnd() * rows.length) | 0];
      const an = a.querySelector(':scope > .rtg-main .rtg-name').textContent, bn = b.querySelector(':scope > .rtg-main .rtg-name').textContent;
      const aTag = tags.find(tg => tg[':block/title'] === an), bTag = tags.find(tg => tg[':block/title'] === bn);
      if (!aTag || !bTag || an === bn || below(aTag[':db/id']).has(bTag[':db/id'])) continue;
      const where = ['before', 'after', 'inside'][(rnd() * 3) | 0];
      const before = parents();
      const [took, how] = await shownAfter(() => drag(an, bn, where));
      await settle();
      if (how === 'refused') { refused++; continue; }
      // A drop on the place it already had changes nothing and redraws nothing.
      if (took == null) { if ([...parents()].some(([name, p]) => before.get(name) !== p)) out.faults.push(`drag ${k}: ${an} ${where} ${bn} was never shown`); }
      else dragTimes.push(took);
      dragged++;
      const after = parents();
      for (const [name, was] of before) if (name !== an && after.get(name) !== was) out.faults.push(`drag ${k}: ${an} ${where} ${bn} also moved ${name} (${was} → ${after.get(name)})`);
      if (out.faults.length > 5) break;
    }
    out.dragged = dragged; out.refused = refused; out.times.drags = dragTimes;
    out.rows.push(document.querySelectorAll('.rtg-row').length);
    // 2. Undo, three moves a round, seven rounds.
    for (let round = 0; round < N(7); round++) {
      const before = tree(), beforeParents = JSON.stringify([...parents()]);
      const rows = [...document.querySelectorAll('.rtg-row')].filter(r => r.querySelector(':scope > .rtg-main .rtg-name'));
      let moved = 0;
      // The arrows this round adds are the ones it undoes, however many (a drop that changed nothing adds none).
      const arrowsBefore = new Set(window.refinementShared.undo.keys());
      for (let tries = 0; moved < 3 && tries < 40; tries++) {
        const a = rows[(rnd() * rows.length) | 0], b = rows[(rnd() * rows.length) | 0];
        const an = a.querySelector(':scope > .rtg-main .rtg-name')?.textContent, bn = b.querySelector(':scope > .rtg-main .rtg-name')?.textContent;
        const aTag = tags.find(tg => tg[':block/title'] === an), bTag = tags.find(tg => tg[':block/title'] === bn);
        if (!aTag || !bTag || an === bn || below(aTag[':db/id']).has(bTag[':db/id'])) continue;
        if (await drag(an, bn, ['before', 'after', 'inside'][moved]) === 'dropped') { moved++; await settle(); }
      }
      const mine = window.refinementShared.undo.keys().filter(k => k.startsWith('tags:') && !arrowsBefore.has(k));
      for (let u = 0; u < mine.length; u++) {
        // Newest first by the Undo's own order (an arrow sits on its row, so the page's order is not the time's).
        const keys = window.refinementShared.undo.keys().filter(k => mine.includes(k));
        const pickKey = round % 2 ? keys[(rnd() * keys.length) | 0] : keys.at(-1);
        const newest = document.querySelector(`[data-rf-undo="${CSS.escape(pickKey || '')}"]`);
        if (!newest) { out.faults.push(`undo round ${round}: no Undo arrow for one of its moves`); break; }
        newest.click();
        for (let i = 0; i < 60; i++) { await sleep(15); if (!newest.isConnected) break; }
        await settle(); await sleep(60);
      }
      await view.refresh(); await frame();
      if (JSON.stringify([...parents()]) !== beforeParents) out.faults.push(`undo round ${round}: the parents differ after three Undos`);
      else if (tree() !== before) out.faults.push(`undo round ${round}: the order differs after three Undos`);
      if (out.faults.length > 5) break;
    }
    // 3. 50 renames through the rename box.
    const renameTimes = [], topRenameTimes = [];
    for (let k = 0; k < N(50); k++) {
      const rows = [...document.querySelectorAll('.rtg-row')].filter(r => r.querySelector(':scope > .rtg-main .rtg-name'));
      // Any tag in the map; a top-level tag reorders thousands of rows under it, so those renames are reported apart.
      const row = rows[(rnd() * rows.length) | 0];
      const top = !!row.closest('.rtg-section') && row.parentElement?.classList.contains('rtg-section');
      const name = row.querySelector(':scope > .rtg-main .rtg-name').textContent;
      row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await frame();
      const input = view.node.querySelector('.rtg-row input');
      if (!input) { out.faults.push(`rename ${k}: no rename box for ${name}`); break; }
      input.value = name + ' r';
      const [took] = await shownAfter(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });
      if (took != null) (top ? topRenameTimes : renameTimes).push(took);
      if (!rowOf(name + ' r')) { out.faults.push(`rename ${k}: ${name} was not shown renamed`); break; }
    }
    out.times.renames = renameTimes; out.times.topRenames = topRenameTimes;
    // The last three renames undone through their arrows, newest first: the old names back.
    const renamedKeys = window.refinementShared.undo.keys().filter(k => k.startsWith('tags:')).slice(-3).reverse();
    for (const key of renamedKeys) {
      const arrow = document.querySelector(`[data-rf-undo="${CSS.escape(key)}"]`);
      if (!arrow) { out.faults.push('a rename\'s Undo arrow was not there'); break; }
      const before = new Set(tags.map(tg => tg[':block/title']));
      arrow.click();
      const changed = () => tags.some(tg => !before.has(tg[':block/title']));
      for (let i = 0; i < 100 && !changed(); i++) await sleep(10);
      if (!changed()) out.faults.push('Undo of a rename put no old name back');
    }
    // 4. Both views.
    const [byTags, byProps] = view.node.querySelectorAll('.rtg-by');
    t = performance.now(); byProps.click(); await frame(); out.times.toProps = performance.now() - t;
    // 5. A property with 1000 holders: open it, show nodes, show all.
    const propRow = [...view.node.querySelectorAll('.rtg-row, [data-key]')].find(r => r.dataset.key === 'P1');
    if (!propRow) out.faults.push('the Properties view has no row for property 1');
    else {
      // Open it unless an earlier storm left it open (the map remembers open properties).
      if (propRow.querySelector('.rtg-fold.rtg-shut')) propRow.querySelector('.rtg-fold').click();
      for (let i = 0; i < 100 && !view.node.querySelector('.rtg-pmore:not([hidden])'); i++) await sleep(10);
      const more = view.node.querySelector('.rtg-pmore:not([hidden])');
      if (!more) out.faults.push('property 1 offers no "show nodes"');
      else {
        t = performance.now(); more.click();
        for (let i = 0; i < 200 && !view.node.querySelector('.rtg-pnodes .rtg-pmore'); i++) await sleep(10);
        const all = view.node.querySelector('.rtg-pnodes .rtg-pmore');
        if (!all || !/1000/.test(all.textContent)) out.faults.push(`"show all 1000" not offered (${all?.textContent})`);
        else { all.click(); await frame(); out.times.showAll = performance.now() - t; out.nodesShown = view.node.querySelectorAll('.rtg-pnodes [class*="rtg-pnode"], .rtg-pnodes a').length; }
      }
    }
    t = performance.now(); byTags.click(); await frame(); out.times.toTags = performance.now() - t;
    // 6. 200 keystrokes in the find box.
    const find = view.node.querySelector('input');
    // Each key: how long it holds the keyboard (the key's own work and the frame after it). After each run of 25 keys,
    // typing stops: how long until the list shows the search, less the find box's own pause before it draws (120 ms,
    // a wait by design, not work).
    const keyTimes = [], listTimes = [];
    const text = 'tag 0'.repeat(40);
    const listShown = async () => {
      const t0 = performance.now(); let last = t0;
      const obs = new MutationObserver(() => { last = performance.now(); });
      obs.observe(view.node, { childList: true, subtree: true, attributes: true, characterData: true });
      while (performance.now() - Math.max(last, t0 + 120) < 150 && performance.now() - t0 < 5000) await sleep(10);
      obs.disconnect();
      return Math.max(0, last - t0 - 120);
    };
    for (let k = 0; k < N(200); k++) {
      const value = k % 50 < 25 ? text.slice(0, (k % 25) + 1) : text.slice(0, 25 - (k % 25));
      find.value = value;
      t = performance.now();
      find.dispatchEvent(new Event('input', { bubbles: true }));
      await frame();
      keyTimes.push(performance.now() - t);
      if (k % 25 === 24) listTimes.push(await listShown());
    }
    find.value = ''; find.dispatchEvent(new Event('input', { bubbles: true }));
    await listShown();
    out.times.keys = keyTimes; out.times.lists = listTimes;
    // The storm over: the pretend graph put back as it was before it (drags nest tags deeper, and a deeper tag lists
    // more inherited properties, so the map itself grows: not a leak), this map gone, a fresh one drawn, so the memory
    // is measured with the same map on screen as before.
    window.pretend.restore?.();
    view.destroy(); view.node?.remove?.(); document.getElementById('scroll').replaceChildren();
    const fresh = window.__view = window.__createView(document, 'page');
    document.getElementById('scroll').append(fresh.node);
    await fresh.refresh(); await frame();
    return out;
  }, scale).catch(error => ({ faults: ['the stress run threw: ' + error.message], times: {} }));
  // A whole storm first, so the browser's compiled code and caches are warm when "before" is read (measured
  // 2026-10-23: 20.6 MB after a third of a storm, 30.7 after the first whole one, 33.7 after the second and the third
  // alike); then the storm.
  await storm(1);
  const heapBefore = await heap();
  const result = await storm(1);
  result.times.first = first;
  const heapAfter = await heap();
  await page.close();
  return { result, errors, heapBefore, heapAfter };
}

(async () => {
  let browser;
  try { browser = await chromium.launch({ args: ['--js-flags=--expose-gc'] }); } catch (error) { console.log('tags-stress skipped (Chromium did not start)'); process.exit(0); }
  const mac = await gate.waitQuiet({ minutes: process.argv.includes('--no-wait') ? 0 : 5 });
  const { result, errors, heapBefore, heapAfter } = await run(browser, sources('now'));
  const p95 = list => { const a = [...(list || [])].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(.95 * a.length))] : 0; };
  const median = list => { const a = [...(list || [])].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
  const timed = r => ({ first: r.times.first, drags: median(r.times.drags), dragsTail: p95(r.times.drags), renames: median(r.times.renames), renamesTail: p95(r.times.renames),
    lists: median(r.times.lists), listsTail: p95(r.times.lists), keys: p95(r.times.keys), toProps: r.times.toProps, toTags: r.times.toTags });
  const now = timed(result);
  const over = now.first > LIMITS.first || ['drags', 'renames', 'lists'].some(k => now[k] > LIMITS.action || now[k + 'Tail'] > LIMITS.actionTail) || now.keys > LIMITS.key || now.toProps > LIMITS.first || now.toTags > LIMITS.first;
  // Over a limit on a busy Mac: the committed version, timed in the same run, decides (a 25% margin).
  let head = null;
  if (over && !mac.quiet) { try { head = timed((await run(browser, sources('HEAD'))).result); } catch (error) { head = null; } }
  await browser.close();
  const slower = what => !head || head[what] == null || now[what] > head[what] * 1.25;

  const problems = [...errors.map(e => 'error in the page: ' + e), ...result.faults];
  if (!mac.quiet) console.log(`  (the Mac is busy, load ${mac.load.toFixed(2)}: a time over its limit fails only when more than 25% slower than the committed version${head ? `: ${Object.entries(head).map(([k, v]) => `${k} ${Math.round(v)} ms`).join(', ')}` : ''})`);
  const spread = list => { if (!list?.length) return 'none'; const a = [...list].sort((x, y) => x - y); const at = q => a[Math.min(a.length - 1, Math.floor(q * a.length))]; return `median ${at(.5).toFixed(0)} ms, 95th ${at(.95).toFixed(0)} ms, slowest ${a[a.length - 1].toFixed(0)} ms`; };
  console.log('the tag map under stress (600 tags, 300 properties, a property held by 1000 nodes):');
  console.log(`  first drawing: ${result.times.first?.toFixed(0)} ms`);
  console.log(`  ${result.dragged} drags (${result.refused} refused as the map refuses them): ${spread(result.times.drags)}`);
  console.log(`  seven rounds of three moves and three Undos`);
  console.log(`  ${result.times.renames?.length || 0} renames: ${spread(result.times.renames)}; ${result.times.topRenames?.length || 0} of top-level tags (thousands of rows reordered, told apart): ${spread(result.times.topRenames)}`);
  console.log(`  to the Properties view ${result.times.toProps?.toFixed(0)} ms, back ${result.times.toTags?.toFixed(0)} ms; show all 1000 nodes ${result.times.showAll?.toFixed(0)} ms`);
  console.log(`  200 keys in the find box, each held the keyboard: ${spread(result.times.keys)}; the list after typing stops: ${spread(result.times.lists)}`);
  console.log(`  memory before the storm ${(heapBefore / 1e6).toFixed(1)} MB, after it ${(heapAfter / 1e6).toFixed(1)} MB`);
  if (now.first > LIMITS.first && slower('first')) problems.push(`the first drawing took ${now.first.toFixed(0)} ms (limit ${LIMITS.first})`);
  for (const [k, what] of [['drags', 'drags'], ['renames', 'renames'], ['lists', 'the list after typing stops']]) {
    if (now[k] > LIMITS.action && slower(k)) problems.push(`${what}: the typical one (median) took ${now[k].toFixed(0)} ms (limit ${LIMITS.action})`);
    if (now[k + 'Tail'] > LIMITS.actionTail && slower(k + 'Tail')) problems.push(`${what}: the 95th slowest took ${now[k + 'Tail'].toFixed(0)} ms (limit ${LIMITS.actionTail})`);
  }
  if (now.keys > LIMITS.key && slower('keys')) problems.push(`keys in the find box: the 95th slowest held the keyboard ${now.keys.toFixed(0)} ms (limit ${LIMITS.key})`);
  for (const [k, what] of [['toProps', 'the Properties view'], ['toTags', 'the Tags view']]) if (now[k] > LIMITS.first && slower(k)) problems.push(`${what} took ${now[k].toFixed(0)} ms (limit ${LIMITS.first})`);
  if (result.dragged < 150) problems.push(`only ${result.dragged} of 200 drags were made`);
  if (heapAfter > heapBefore * 1.1) problems.push(`memory grew from ${(heapBefore / 1e6).toFixed(1)} to ${(heapAfter / 1e6).toFixed(1)} MB over the storm, one map on screen before and after (limit +10%)`);
  for (const p of problems) console.log('PROBLEM: ' + p);
  if (problems.length) { console.log(`tags-stress: FAILED (${problems.length})`); process.exit(1); }
  console.log('tags-stress: OK');
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
