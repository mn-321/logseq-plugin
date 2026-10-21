#!/usr/bin/env node
/* Pictures of what the plugin draws, in a real browser (Chromium, through Playwright), compared with approved ones.
   Each scene is drawn from a small pretend graph shaped like the Illness Test Graph, in a light and a dark page,
   on a fixed day (2026-10-19), and photographed. The approved pictures are in test/pictures/; a picture that
   differs from its approved one by more than a few pixels fails, and the new picture and one with the changed
   pixels in red are left in check.log/pictures/ to look at.
     node tools/pictures.js            compare with the approved pictures
     node tools/pictures.js --approve  take the new pictures as the approved ones (after looking at them)
   Fonts differ between machines, so the pictures are compared only on the Mac they were approved on (macOS);
   elsewhere this is skipped. Needs Playwright and Chromium; skipped quietly where they are missing. */
const fs = require('fs');
const path = require('path');

let chromium;
for (const where of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(where)); break; } catch (error) { /* try the next */ } }
if (!chromium) { console.log('pictures skipped (needs Playwright and Chromium)'); process.exit(0); }
if (process.platform !== 'darwin') { console.log('pictures skipped (approved on the Mac; fonts differ elsewhere)'); process.exit(0); }

const root = path.resolve(__dirname, '..');
const approvedDir = path.join(root, 'test/pictures');
const newDir = path.join(root, 'check.log/pictures');
const approve = process.argv.includes('--approve');
// A pixel counts as changed when a colour channel moves by more than this; a picture fails above this many changed pixels.
const CHANNEL = 24, PIXELS = 20;
// Logseq 2.0.2 sets its newer theme colours (--background, --popover, --border, as "h s% l%") and, in dark mode, leaves
// the older --ls-* names unset (read in the app on 2026-10-19); the pretend page does the same.
const THEMES = {
  light: { attrs: '', css: ':root { --background: 0 0% 100%; --popover: 0 0% 100%; --popover-foreground: 0 0% 15%; --border: 0 0% 89%; } body { background: #fff; color: #262626; }' },
  dark: { attrs: ' data-theme="dark" class="dark"', css: ':root { --background: 0 0% 11%; --popover: 0 0% 7%; --popover-foreground: 0 0% 95%; --border: 0 0% 16%; } body { background: rgb(28, 28, 28); color: #d6d8db; }' },
};

// A small graph shaped like the Illness Test Graph, run inside the page as a pretend Logseq.
function pretendLogseq() {
  let next = 10;
  const props = [], tags = [], choices = [];
  const prop = (title, type, many, accepts = []) => { const p = { ':db/id': next++, ':db/ident': ':user.property/' + title.replace(/\W/g, ''), ':block/title': title, ':block/uuid': 'p-' + title.replace(/\W/g, '-'),
    ':logseq.property/type': ':' + type, ':db/cardinality': many ? ':db.cardinality/many' : ':db.cardinality/one', ':logseq.property/classes': accepts.map(id => ({ ':db/id': id })) }; props.push(p); return p; };
  const tag = (title, parent, own = [], desc = '') => { const t = { ':db/id': next++, ':db/ident': ':user.class/' + title.replace(/\W/g, ''), ':block/uuid': 't-' + title.replace(/\W/g, '-'), ':block/title': title,
    ':logseq.property.class/extends': parent ? [{ ':db/id': parent[':db/id'] }] : [], ':logseq.property.class/properties': own.map(p => ({ ':db/id': p[':db/id'], ':db/ident': p[':db/ident'], ':block/title': p[':block/title'], ':block/uuid': p[':block/uuid'] })) };
    if (desc) t[':logseq.property/description'] = { ':block/title': desc };
    tags.push(t); return t; };
  const entity = tag('Entity', null, [], 'Things that exist: people, places, medicines.');
  const person = tag('Person', entity, [prop('phone', 'default', false)]);
  const doctor = tag('Doctor', person, [prop('speciality', 'default', false)]);
  const place = tag('Place', entity, [prop('address', 'default', false)]);
  const hospital = tag('Hospital', place);
  const medicine = tag('Medicine', entity, [prop('dose', 'default', false)]);
  const concept = tag('Concept', null);
  const symptom = tag('Symptom', concept);
  const occurrence = tag('Occurrence', null, [prop('date', 'date', false)]);
  const severity = prop('severity', 'default', false);
  const appointment = tag('Appointment', occurrence, [prop('doctor', 'node', false, [doctor[':db/id']]), prop('hospital', 'node', false, [hospital[':db/id']]), prop('symptoms', 'node', true, [symptom[':db/id']])], 'A visit, a scan or a treatment.');
  tag('Infusion', appointment, [prop('medicines', 'node', true, [medicine[':db/id']])]);
  tag('Scan', appointment, [prop('report', 'node', false)]);
  const procedureType = prop('procedure type', 'default', false);
  tag('Procedure', occurrence, [procedureType]);
  tag('Symptom log', occurrence, [severity]);
  ['Imaging', 'Biopsy', 'Surgery'].forEach((t, k) => choices.push([procedureType[':db/id'], { ':block/title': t, ':block/order': 'a' + k }]));
  ['Mild', 'Moderate', 'Severe'].forEach((t, k) => choices.push([severity[':db/id'], { ':block/title': t, ':block/order': 'a' + k }]));
  const counts = tags.map((t, i) => [t[':db/id'], [0, 2, 6, 0, 4, 9, 0, 14, 0, 13, 8, 3, 2, 21][i] || 0]);
  const settings = { tagTreeRoots: 'Entity, Occurrence, Concept', twoWayNames: '', twoWayOneEnd: '' };
  window.parent = window;
  window.logseq = {
    settings, updateSettings: o => Object.assign(settings, o),
    DB: { datascriptQuery: async q => q.includes('logseq.property/classes [') ? props.map(p => [p])
      : q.includes('closed-value') ? choices
      : q.includes('class/extends [:db/id]') ? tags.map(t => [t])
      : q.includes('count') ? counts : [], onChanged: () => () => {} },
    UI: { showMsg() {} }, App: { pushState() {} }, Editor: {},
  };
  window.refinementCore = { provided: { backwardsLabel: n => n + ' of', setBackwards() {}, shownAtOtherEnd: () => true, setShownAtOtherEnd() {} } };
}

// Two-way rows as on Dr. Mei Chen's page: one short row, one long open list with several kinds of records.
const TWO_WAY_GROUPS = (() => {
  const item = (i, title, tag, day) => ({ uuid: 'r' + i, title, tag, day });
  const visits = [
    item(1, 'Consultation with Dr. Chen', 'Appointment', 20261112), item(2, 'Infusion 9', 'Infusion', 20261105),
    item(3, 'Infusion 8', 'Infusion', 20261015), item(4, 'CT abdomen', 'Scan', 20261002), item(5, 'Infusion 7', 'Infusion', 20260924),
    item(6, 'Infusion 6', 'Infusion', 20260910), item(7, 'Infusion 5', 'Infusion', 20260827),
  ];
  return [
    { name: 'doctor', label: 'doctor of', ident: 'user.property/doctor', fieldUuid: 'f1', items: visits },
    { name: 'works at', label: 'works here', ident: 'user.property/worksat', fieldUuid: 'f2', items: [item(9, 'Northgate Cancer Center', 'Hospital', 0)] },
  ];
})();

const exposeAtEnd = (source, names, file) => {
  const out = source.replace(/\}\)\(\);\s*$/, `${names.map(n => `window.__${n} = ${n};`).join(' ')} })();`);
  if (out === source) throw new Error(`the end of ${file} changed; tools/pictures.js cannot reach it`);
  return out;
};

async function scenes(page) {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  return {
    'tag-map': {
      scripts: [`(${pretendLogseq})();`, read('parts/shared.js'), read('parts/model.js'), require('./pretend-model'), exposeAtEnd(read('parts/tags.js'), ['createView', 'css'], 'parts/tags.js')],
      draw: async () => {
        const style = document.createElement('style'); style.textContent = window.__css; document.head.append(style);
        const view = window.__createView(document, 'page');
        document.getElementById('stage').append(view.node);
        await view.refresh();
      },
    },
    'two-way-rows': {
      scripts: [`window.parent = window; window.logseq = { settings: {}, DB: {}, UI: {}, App: {}, Editor: {} };`, read('parts/shared.js'),
        exposeAtEnd(read('parts/two-way.js'), ['rowHtml', 'twoWayCss', 'state'], 'parts/two-way.js')],
      draw: async groups => {
        const style = document.createElement('style'); style.textContent = window.__twoWayCss; document.head.append(style);
        window.__state.pageUuid = 'page-mei-chen';
        const box = document.createElement('div');
        box.className = 'refinement-two-way';
        box.innerHTML = groups.map(window.__rowHtml).join('');
        document.getElementById('stage').append(box);
      },
      arg: TWO_WAY_GROUPS,
    },
    // Proposals (parts/shadow.js): the values written faintly in the bullet's own properties, a guess with a dotted
    // line, a taken guess without; the bullets are pretend ones shaped as Logseq draws them.
    'shadow': {
      scripts: [`window.parent = window; window.logseq = { settings: {}, DB: {}, UI: {}, App: {}, Editor: {} };`, read('parts/shared.js'), read('parts/shadow.js')],
      draw: async () => {
        const inner = window.refinementShadowInner;
        const style = document.createElement('style');
        style.textContent = inner.css + ' .ls-block { margin-bottom: 14px; } .block-main-container > .flex-col > .flex-col { display: flex; flex-direction: column; gap: 2px; } .bullet { display: flex; gap: 8px; align-items: flex-start; } .bullet i { width: 6px; height: 6px; margin-top: 9px; border-radius: 50%; background: currentColor; opacity: .5; flex: none; } .bottom-properties-row { display: flex; gap: 18px; margin-left: 14px; font-size: 13px; } .bottom-property-pill { display: flex; gap: 4px; } .bottom-property-pill > span:first-child { opacity: .8; } .empty-value { opacity: .4; }';
        document.head.append(style);
        const stage = document.getElementById('stage');
        stage.style.height = '170px';
        const block = (uuid, words, pills) => `<div class="ls-block" blockid="${uuid}"><div class="block-main-container"><div class="flex-col"><div class="flex-col">`
          + `<div class="bullet"><i></i><div>${words}</div></div><div class="positioned-properties block-below"><div class="bottom-properties-row">`
          + pills.map(([name, value]) => `<div class="bottom-property-pill"><span>${name}:</span><span class="bottom-property-content">${value || '<span class="empty-value">—</span>'}</span></div>`).join('')
          + '</div></div></div></div></div></div>';
        stage.innerHTML = block('a', 'Post-op check with Dr. Patel. Wounds fine.', [['Provider'], ['Topic'], ['Date']])
          + block('b', 'Wiped out all day.', [['Symptom type'], ['Severity'], ['Date']]);
        const piece = (title, shown, guess, id) => ({ prop: { title, lower: title.toLowerCase() }, ident: title.toLowerCase(), ids: [id], shown, guess });
        const draw = (uuid, pieces) => { window.refinementShadow.live = { uuid, recordUuid: uuid, pieces }; inner.drawInPlace(document); };
        // A guess (Provider, dotted) and a sure value (Date) on the first; the same on the second.
        draw('a', [piece('Provider', 'Dr. Raj Patel', true, 1), piece('Date', 'Aug 18', false, 2)]);
        const first = [...document.querySelectorAll('.rfs-ghost')];
        window.refinementShadow.live = null;
        draw('b', [piece('Symptom type', 'Fatigue', true, 3), piece('Date', 'Oct 20', false, 4)]);
        // drawInPlace keeps only the live bullet's values; put the first bullet's back for the picture.
        const pills = document.querySelectorAll('.ls-block[blockid="a"] .bottom-property-content');
        pills[0].replaceChildren(first[0]); pills[2].replaceChildren(first[1]);
        for (const p of [pills[0], pills[2]]) p.closest('.bottom-property-pill').setAttribute('data-refinement-proposal', '');
      },
    },
    // A dialog of the plugin's own (the troubleshooting box) over a page full of words, so a see-through box shows.
    'dialog': {
      scripts: [`window.parent = window; window.logseq = { settings: {}, DB: {}, UI: {}, App: {}, Editor: {} };`, read('parts/shared.js')],
      draw: async () => {
        const shared = window.refinementShared;
        const style = document.createElement('style'); style.textContent = shared.dialogCss; document.head.append(style);
        const stage = document.getElementById('stage');
        stage.style.height = '560px';
        stage.textContent = 'Linked references, Chemo cycle 7, Date: Dec 2nd, 2026, drugs: Oxaliplatin, Leucovorin. '.repeat(40);
        // The bar at the bottom after a write, with Undo (0.4.197: see-through in dark mode until its rules got the dialogs' fallbacks).
        shared.showUndoBar('doctor: Dr. Mei Chen filled in on “Review of the tingling”', () => {});
        shared.modal(null, (box, finish, doc) => {
          const heading = doc.createElement('label');
          heading.textContent = 'Troubleshooting tools of the Refinements plugin. None of them changes your notes.';
          box.append(heading, shared.modalButtons(doc, [['Check what the plugin finds', () => {}], ['Copy warnings', () => {}]]), shared.modalHint(doc, 'Esc to close'));
        }, 'min(460px, 92vw)');
      },
    },
  };
}

(async () => {
  let browser;
  try { browser = await chromium.launch(); } catch (error) { console.log('pictures skipped (Chromium did not start)'); process.exit(0); }
  fs.mkdirSync(newDir, { recursive: true });
  for (const f of fs.readdirSync(newDir)) fs.rmSync(path.join(newDir, f));
  const problems = [], lines = [];
  const page0 = await browser.newPage();
  const list = await scenes(page0);
  await page0.close();
  for (const [name, scene] of Object.entries(list)) for (const [theme, look] of Object.entries(THEMES)) {
    const file = `${name}-${theme}.png`;
    const page = await browser.newPage({ viewport: { width: 760, height: 600 }, deviceScaleFactor: 1 });
    await page.clock.setFixedTime(new Date('2026-10-19T10:00:00'));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<!doctype html><html${look.attrs}><head><style>${look.css} body { margin: 0; font: 16px -apple-system, system-ui, sans-serif; } #stage { padding: 16px 24px; width: 712px; }</style></head><body><div id="stage"></div></body></html>`);
    for (const content of scene.scripts) await page.addScriptTag({ content });
    await page.evaluate(scene.draw, scene.arg);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(100);
    const shot = await page.locator('#stage').screenshot({ animations: 'disabled', caret: 'hide' });
    for (const e of errors) problems.push(`${file}: error in the page: ${e}`);
    const approvedFile = path.join(approvedDir, file);
    if (approve && errors.length) {
      lines.push(`  ${file}: not approved, the page had errors`);
    } else if (approve) {
      fs.mkdirSync(approvedDir, { recursive: true });
      fs.writeFileSync(approvedFile, shot);
      lines.push(`  ${file}: approved`);
    } else if (!fs.existsSync(approvedFile)) {
      fs.writeFileSync(path.join(newDir, file), shot);
      problems.push(`${file}: no approved picture yet (look at check.log/pictures/${file}, then run node tools/pictures.js --approve)`);
    } else {
      const result = await page.evaluate(async ([a, b, channel]) => {
        const load = src => new Promise((ok, fail) => { const img = new Image(); img.onload = () => ok(img); img.onerror = fail; img.src = src; });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
        const px = img => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h); };
        const da = px(ia), db = px(ib);
        const out = document.createElement('canvas'); out.width = w; out.height = h;
        const ox = out.getContext('2d'); ox.globalAlpha = .25; ox.drawImage(ib, 0, 0); ox.globalAlpha = 1;
        const marks = ox.getImageData(0, 0, w, h);
        let changed = 0;
        for (let i = 0; i < da.data.length; i += 4) {
          if (Math.max(...[0, 1, 2, 3].map(k => Math.abs(da.data[i + k] - db.data[i + k]))) > channel) {
            changed++; marks.data[i] = 230; marks.data[i + 1] = 0; marks.data[i + 2] = 0; marks.data[i + 3] = 255;
          }
        }
        ox.putImageData(marks, 0, 0);
        return { changed, size: ia.width === ib.width && ia.height === ib.height, was: `${ia.width}×${ia.height}`, now: `${ib.width}×${ib.height}`, marks: out.toDataURL('image/png') };
      }, ['data:image/png;base64,' + fs.readFileSync(approvedFile).toString('base64'), 'data:image/png;base64,' + shot.toString('base64'), CHANNEL]);
      if (!result.size || result.changed > PIXELS) {
        fs.writeFileSync(path.join(newDir, file), shot);
        fs.writeFileSync(path.join(newDir, file.replace('.png', '-changes.png')), Buffer.from(result.marks.split(',')[1], 'base64'));
        problems.push(`${file}: differs from the approved picture (${result.size ? `${result.changed} pixels changed` : `size ${result.was} became ${result.now}`}); see check.log/pictures/`);
      } else lines.push(`  ${file}: same as approved${result.changed ? ` (${result.changed} pixels within tolerance)` : ''}`);
    }
    await page.close();
  }
  await browser.close();
  console.log('pictures of what the plugin draws, light and dark, on a pretend graph:');
  for (const line of lines) console.log(line);
  for (const p of problems) console.log('PROBLEM: ' + p);
  if (problems.length) { console.log(`pictures: FAILED (${problems.length})`); process.exit(1); }
  console.log('pictures: OK');
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
