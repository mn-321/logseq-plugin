#!/usr/bin/env node
/* Times the tag map (parts/tags.js) in a real browser (Chromium, through Playwright) on a large pretend graph:
   600 tags four levels deep, 300 properties, three on each tag, some with choices, everything unfolded.
   Logseq's own query time is left out; this is the plugin's own work. It measures:
   - the first drawing of the map;
   - after a change (a tag moved, a property added, a choice renamed), the time until the map shows it;
   - how far the rows on screen jump when a change happens below them (they should not move at all).
   Fails when one is over its limit, on a quiet Mac. The gate on load (2026-10-23, tools/quiet.js): the Mac's load is
   read first (waiting up to two minutes for it to fall under 2); on a busy Mac a measure over its limit is taken again
   of the previous version (the parts as committed, HEAD) in the same browser, and it fails only when this one is more
   than 25% slower than that under the same load. The jump limit (0 px) holds whatever the load.

   Needs Playwright and Chromium; skipped quietly where they are missing (tools/check.sh runs it when they are there).
   Run from the repo root: node tools/tags-speed.js */
const fs = require('fs');
const path = require('path');

let chromium;
for (const where of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(where)); break; } catch (error) { /* try the next */ } }
if (!chromium) { console.log('tag map timings skipped (needs Playwright and Chromium)'); process.exit(0); }

const root = path.resolve(__dirname, '..');
// Measured on the owner's Mac once redraws kept unchanged rows (0.4.190): about 300 ms for the first drawing and
// 100 to 130 ms after a change. The limits are about three times that, so a real slowdown fails and a busy moment does not.
// Elsewhere (a slower cloud machine took 1.2 s per change) they are the old, looser ones.
const LIMITS = process.platform === "darwin" ? { first: 1000, change: 400, jump: 0 } : { first: 3000, change: 3500, jump: 0 };

// The pretend Logseq, run inside the page.
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
  const choices = props.filter(p => p[':db/id'] % 6 === 1).flatMap(p => ['Low', 'Middle', 'High'].map((t, k) => [p[':db/id'], { ':block/title': t, ':block/order': 'a' + k }]));
  const settings = { tagTreeRoots: 'Tag 000, Tag 001, Tag 002', twoWayNames: '', twoWayOneEnd: '' };
  window.parent = window;
  window.pretend = { props, tags, choices, ref };
  window.logseq = {
    settings, updateSettings: o => Object.assign(settings, o),
    DB: { datascriptQuery: async q => q.includes('logseq.property/classes [') ? props.map(p => [p])
      : q.includes('closed-value') ? choices
      : q.includes('class/extends [:db/id]') ? tags.map(t => [t])
      : q.includes('count') ? tags.map(t => [t[':db/id'], 7]) : [], onChanged: () => () => {} },
    UI: { showMsg() {} }, App: { pushState() {} }, Editor: {},
  };
  window.refinementCore = { provided: { backwardsLabel: n => n + ' of', setBackwards() {}, shownAtOtherEnd: () => true, setShownAtOtherEnd() {} } };
}

const { execSync } = require('child_process');
const gate = require('./quiet');
// The parts' text now, or as committed (HEAD) for the comparison under load.
const FILES = ['parts/shared.js', 'parts/model.js', 'parts/tags-graph.js', 'parts/tags-props.js', 'parts/tags.js'];
const sources = which => Object.fromEntries(FILES.map(file => [file, which === 'HEAD'
  ? execSync(`git show HEAD:${file}`, { cwd: root, maxBuffer: 1 << 26 }).toString() : fs.readFileSync(path.join(root, file), 'utf8')]));

async function measure(browser, src) {
  const source = src['parts/tags.js'];
  const exposed = source.replace(/\}\)\(\);\s*$/, 'window.__createView = createView; window.__css = css; })();');
  if (exposed === source) throw new Error('the end of parts/tags.js changed; tools/tags-speed.js cannot reach the map');
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<!doctype html><html><body style="margin:0;font-family:system-ui"><div id="scroll" style="height:900px;overflow:auto"></div></body></html>');
  await page.addScriptTag({ content: `(${pretendLogseq})();` });
  await page.addScriptTag({ content: src['parts/shared.js'] });
  await page.addScriptTag({ content: src['parts/model.js'] });
  await page.addScriptTag({ content: require('./pretend-model') });
  for (const piece of ['parts/tags-graph.js', 'parts/tags-props.js']) await page.addScriptTag({ content: src[piece] });
  await page.addScriptTag({ content: exposed });
  const result = await page.evaluate(async () => {
    const style = document.createElement('style'); style.textContent = window.__css; document.head.append(style);
    const frame = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve)));
    const view = window.__createView(document, 'page');
    document.getElementById('scroll').append(view.node);
    let t = performance.now();
    await view.refresh(); await frame();
    const first = performance.now() - t;
    const { tags, props, choices, ref } = window.pretend;
    // Rows on screen, by key, and where they are.
    const onScreen = () => new Map([...document.querySelectorAll('.rtg-row[data-key]')].map(r => [r.dataset.key, r.getBoundingClientRect().top]).filter(([, y]) => y >= 0 && y < 900));
    const changes = [
      ['a tag moved under another', () => { tags[599][':logseq.property.class/extends'] = [{ ':db/id': 1001 }]; }],
      ['a property added to a tag', () => { tags[598][':logseq.property.class/properties'].push(ref(props[10])); }],
      ['a choice renamed', () => { choices[0][1] = 'Lowest'; }],
    ];
    const out = { first, changes: [], rows: document.querySelectorAll('.rtg-row').length };
    document.getElementById('scroll').scrollTop = 4000;
    await frame();
    for (const [what, change] of changes) {
      const before = onScreen();
      change();
      t = performance.now();
      await view.refresh(); await frame();
      const ms = performance.now() - t;
      const after = onScreen();
      let jump = 0;
      for (const [key, y] of before) if (after.has(key)) jump = Math.max(jump, Math.abs(after.get(key) - y));
      out.changes.push({ what, ms, jump });
    }
    view.destroy();
    return out;
  });
  await page.close();
  return { result, errors };
}

(async () => {
  let browser;
  try { browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}); }
  catch (error) { console.log('tag map timings skipped (Chromium did not start)'); process.exit(0); }
  const mac = await gate.waitQuiet({ minutes: process.argv.includes('--no-wait') ? 0 : 2 });
  const { result, errors } = await measure(browser, sources('now'));
  const problems = [...errors.map(e => 'error in the page: ' + e)];
  // Over a limit on a busy Mac: the committed version timed in the same run decides (a 25% margin).
  const over = result.first > LIMITS.first || result.changes.some(c => c.ms > LIMITS.change);
  let head = null;
  if (over && !mac.quiet) { try { head = (await measure(browser, sources('HEAD'))).result; } catch (error) { head = null; } }
  await browser.close();
  // No committed time to compare with (a measure new since HEAD): judged by the limit alone.
  const slower = (now, was) => head && was != null ? now > was * 1.25 : true;
  if (!mac.quiet) console.log(`  (the Mac is busy, load ${mac.load.toFixed(2)}: a time over its limit fails only when more than 25% slower than the committed version${head ? `, which took ${head.first.toFixed(0)} ms to draw and ${head.changes.map(c => c.ms.toFixed(0)).join(', ')} ms for the changes` : ''})`);
  console.log(`tag map timings in a real browser, on a large pretend graph (600 tags, 300 properties, ${result.rows} rows):`);
  console.log(`  first drawing: ${result.first.toFixed(0)} ms`);
  if (result.first > LIMITS.first && slower(result.first, head?.first)) problems.push(`the first drawing took ${result.first.toFixed(0)} ms (limit ${LIMITS.first})`);
  for (const c of result.changes) {
    console.log(`  ${c.what}: shown after ${c.ms.toFixed(0)} ms; rows on screen moved ${c.jump.toFixed(0)} px`);
    if (c.ms > LIMITS.change && slower(c.ms, head?.changes.find(h => h.what === c.what)?.ms)) problems.push(`${c.what} took ${c.ms.toFixed(0)} ms to show (limit ${LIMITS.change})`);
    if (c.jump > LIMITS.jump) problems.push(`${c.what} moved the rows on screen by ${c.jump.toFixed(0)} px (should not move)`);
  }
  for (const p of problems) console.log('PROBLEM: ' + p);
  if (problems.length) { console.log(`tags-speed: FAILED (${problems.length})`); process.exit(1); }
  console.log('tags-speed: OK');
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
