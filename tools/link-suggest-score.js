#!/usr/bin/env node
/* The replay score of the suggested links (parts/link-suggest.js, 0.4.373): every link written in the real Illness Test
   Graph, read through Logseq's command line, is typed again letter by letter in a pretend window with everything before
   it as it stands, and the rule is asked at each letter what it would show. Counted:
     caught      the right page shown by the time the name is typed out; letters: how many it took (median)
     short       the same for names of four letters or fewer (MRI, CEA), the ones a letter rule cannot reach
     after       caught only by the space that ends the name (0.4.373: a sure name is still offered then)
     wrong first a page other than the right one shown first (a look, nothing written)
     pops        a page offered at the end of a word that was written plain, per 100 such words: the distraction
   Two scores: "before", the rule as it was (letters and the lower-case rule alone), and "after", with the graph's
   link rates and the bullet's empty properties. Runs only while the app has the graph open (as tools/shadow-check.js);
   skipped quietly otherwise. Reads only.
     node tools/link-suggest-score.js           both scores
     node tools/link-suggest-score.js --missed  also every link not caught, and every pop */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { JSDOM } = require('jsdom');

const GRAPH = process.env.GRAPH || 'Illness Test Graph';
const CLI = path.join(os.homedir(), '.local/bin/logseq');
const root = path.resolve(__dirname, '..');
const MIN = Number(process.env.MIN || 5);
const showMissed = process.argv.includes('--missed');
const ask = query => new Promise((resolve, reject) => execFile(CLI, ['query', '-g', GRAPH, '-o', 'json', '--timeout-ms', '120000', '--query', query],
  { encoding: 'utf8', maxBuffer: 1 << 29, timeout: 180000 }, (error, stdout) => {
    if (error) return reject(new Error(String(stdout || error.message).slice(0, 300)));
    const out = JSON.parse(stdout);
    if (out.status !== 'ok') return reject(new Error('the command line said: ' + stdout.slice(0, 300)));
    resolve(out.data.result);
  }));

function plugin() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.parent = window;
  window.logseq = { settings: { linkSuggest: true }, App: { getCurrentGraph: async () => ({ name: GRAPH }) }, UI: { showMsg() {} }, DB: {} };
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  window.eval(read('parts/shared.js'));
  window.eval(read('parts/model.js'));
  window.refinementCore = { dsQuery: ask, provided: {}, sendStyle() {}, onPageChange() {}, screen: window.refinementShared.screen };
  window.eval(require('./pretend-model'));
  window.eval(read('parts/link-suggest.js'));
  const part = window.refinementParts.find(p => p.name === 'link suggest');
  part.provide(window.refinementCore);
  return { model: window.refinementCore.provided, inner: window.refinementCore.provided.linkSuggestInner };
}
const median = xs => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const letters = t => (t.match(/[\p{L}\p{N}]/gu) || []).length;

(async () => {
  const servers = await new Promise(resolve => execFile(CLI, ['server', 'list', '-o', 'json'], { encoding: 'utf8', timeout: 30000 },
    (error, stdout) => { try { resolve(JSON.parse(stdout).data.servers || []); } catch { resolve([]); } }));
  if (!servers.some(s => s.graph === GRAPH && s.status === 'ready' && (s['owner-source'] === 'electron' || process.env.OWNER === 'any'))) { console.log(`suggested links score skipped (the app does not have "${GRAPH}" open)`); process.exit(0); }
  const { model, inner } = plugin();
  const [pages, schema, rates] = await Promise.all([model.propPages(), model.propSchema(), model.linkRates()]);
  const byUuid = new Map(pages.filter(p => p.uuid).map(p => [p.uuid.toLowerCase(), p])), byLower = new Map(pages.map(p => [p.lower, p]));
  const rows = await ask(`[:find (pull ?b [:block/uuid :block/title {:block/tags [:db/id]}]) :where [?b :block/page _] [?b :block/title ?t] [(not= ?t "")] (not [?b :block/name _]) (not [?b :logseq.property/deleted-at _])]`);
  const blocks = rows.map(([b]) => ({ title: String(b['block/title'] ?? b.title ?? ''), tags: (b['block/tags'] || b.tags || []).map(t => Number(t['db/id'] ?? t.id)).filter(Boolean) }));
  const usualCount = [...rates.values()].filter(r => r.linked >= 2 && r.linked / (r.linked + r.plain) >= 0.6).length;
  console.log(`suggested links on "${GRAPH}": ${pages.length} pages, ${blocks.length} bullets; ${usualCount} names the graph usually links`);

  for (const mode of ['before', 'after']) {
    const tally = { links: 0, caught: 0, letters: [], short: 0, shortCaught: 0, after: 0, wrongFirst: 0, plainEnds: 0, pops: 0 };
    const missed = [], pops = [];
    for (const block of blocks) {
      const boost = mode === 'after' ? inner.boostFor(block.tags, schema, pages) : null;
      const options = mode === 'after' ? { min: MIN, rates, boost } : { min: MIN };
      // The words as the writer sees them: earlier links as [[Name]], the link being written as its plain name.
      const parts = [];
      let at = 0;
      for (const m of block.title.matchAll(/\[\[([^\[\]]+)\]\]/g)) {
        if (m.index > at) parts.push({ text: block.title.slice(at, m.index) });
        const key = m[1].trim().toLowerCase(), page = byUuid.get(key) || byLower.get(key) || null; // by uuid (the app) or by name (an import)
        parts.push(page ? { link: page } : { text: m[0] });
        at = m.index + m[0].length;
      }
      if (at < block.title.length) parts.push({ text: block.title.slice(at) });
      let prefix = '';
      for (const part of parts) {
        if (part.link) {
          const name = part.link.title;
          tally.links++;
          const isShort = letters(name) <= 4; if (isShort) tally.short++;
          let got = 0, wrong = false, firstWrong = false;
          for (let i = 1; i <= name.length; i++) {
            const typed = prefix + name.slice(0, i);
            const hit = inner.suggestFor(typed, typed.length, pages, options);
            if (!hit) continue;
            if (hit.title === name) { got = i; break; }
            if (!wrong) { wrong = true; firstWrong = true; }
          }
          if (!got) { const typed = prefix + name + ' '; const hit = inner.suggestFor(typed, typed.length, pages, options); if (hit?.title === name) { got = name.length; tally.after++; } }
          if (got) { tally.caught++; tally.letters.push(got); if (isShort) tally.shortCaught++; } else missed.push(`${name} ← ${prefix.slice(-40)}`);
          if (firstWrong) tally.wrongFirst++;
          prefix += `[[${name}]]`;
        } else {
          // Every word written plain, at its end: an offer here is a pop.
          for (const m of part.text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’.\-]*/gu)) {
            const typed = prefix + part.text.slice(0, m.index + m[0].length);
            if (!/[\p{L}\p{N}]$/u.test(typed) || /[[\]]/.test(m[0])) continue;
            tally.plainEnds++;
            const hit = inner.suggestFor(typed, typed.length, pages, options);
            if (hit) { tally.pops++; pops.push(`${hit.title} ← ${typed.slice(-40)}`); }
          }
          prefix += part.text;
        }
      }
    }
    const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
    console.log(`${mode}: ${tally.links} links, caught ${tally.caught} (${pct(tally.caught, tally.links)}%) at ${median(tally.letters)} letters (median); short names ${tally.shortCaught} of ${tally.short}; by the space ${tally.after}; wrong first ${tally.wrongFirst}; pops ${tally.pops} in ${tally.plainEnds} plain words (${(100 * tally.pops / Math.max(1, tally.plainEnds)).toFixed(1)} per 100)`);
    if (showMissed) { console.log('  missed:'); for (const m of missed) console.log('    ' + m); console.log('  pops:'); for (const p of pops.slice(0, 60)) console.log('    ' + p); }
  }
})().catch(error => { console.log('FAILED ' + error.stack); process.exit(1); });
