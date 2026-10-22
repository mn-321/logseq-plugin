// Prepares the inputs the two page builders read: the loaded parts' stylesheets (pulled from their source), the icon
// constants, Logseq's Tabler icon font and the codepoints the pages use (from the app's bundle on this Mac), and the
// kit sketch's CSS (cut out of build-elements.js for build-views.js). Run from the repo root:
//   node tools/pages/prepare.js <dir> && node tools/pages/build-elements.js <dir> && node tools/pages/build-views.js <dir>
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/pages/prepare.js <scratch dir>'); process.exit(1); }
fs.mkdirSync(path.join(dir, 'css'), { recursive: true });
// 1. the parts' stylesheets
const want = { 'parts/shared.js': ['dialogCss'], 'parts/two-way.js': ['twoWayCss', 'openRowsCss', 'hideTagListsCss'], 'parts/tags.js': ['css'], 'parts/link-text.js': ['css'], 'parts/shadow.js': ['css'], 'parts/settings-panel.js': ['css'], 'parts/picker.js': ['css'] };
for (const [file, names] of Object.entries(want)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const n of names) {
    const m = src.match(new RegExp('const ' + n + ' = `([\\s\\S]*?)`;'));
    if (!m) { console.error('no', n, 'in', file); process.exit(1); }
    fs.writeFileSync(path.join(dir, 'css', file.replace('parts/', '').replace('.js', '') + (n === 'css' ? '' : '-' + n) + '.css'), m[1]);
  }
}
// 2. the icon constants the parts draw today
const icons = {};
const grab = (file, names) => { const s = fs.readFileSync(file, 'utf8'); for (const n of names) { const m = s.match(new RegExp('const ' + n + " = '([^']*)'")); if (m) icons[file.replace('parts/', '') + ':' + n] = m[1]; } };
grab('parts/shared.js', ['UNDO_ICON']); grab('parts/tags-graph.js', ['TREE_ICON', 'SIDEBAR_ICON', 'PAGE_ICON', 'CHEVRON', 'PLUS', 'DOTS']); grab('parts/two-way.js', ['TRASH']); grab('parts/settings-panel.js', ['SLIDERS_ICON', 'SEARCH_ICON']);
fs.writeFileSync(path.join(dir, 'icons.json'), JSON.stringify(icons, null, 1));
// 3. Logseq's icon font and the codepoints, from the app's bundle (asar: an 8-byte header, a JSON index, the files)
const A = '/Applications/Logseq.app/Contents/Resources/app.asar';
const fd = fs.openSync(A, 'r'); const h = Buffer.alloc(16); fs.readSync(fd, h, 0, 16, 0);
const jsonSize = h.readUInt32LE(12); const jb = Buffer.alloc(jsonSize); fs.readSync(fd, jb, 0, jsonSize, 16); const idx = JSON.parse(jb.toString());
const base = 8 + h.readUInt32LE(4);
const list = (n, pre, out) => { for (const [k, v] of Object.entries(n.files || {})) { if (v.files) list(v, pre + k + '/', out); else out.push([pre + k, v]); } return out; };
const all = list(idx, '', []);
const read = p => { const f = all.find(([q]) => q.endsWith(p))?.[1]; if (!f) { console.error('not in the bundle:', p); process.exit(1); } const b = Buffer.alloc(f.size); fs.readSync(fd, b, 0, f.size, base + Number(f.offset)); return b; };
const tcss = read('css/tabler-icons.min.css').toString('utf8');
const names = 'arrow-back-up layout-sidebar-right file-text chevron-right chevron-down plus dots trash search adjustments-horizontal x check info-circle hierarchy hash list-details link pencil copy arrow-right square-check alert-triangle eye eye-off arrows-maximize keyboard calendar letter-case 123 list stack-2 checkbox world tag dots-vertical chevron-left circle point bulb arrow-up-right select circle-dot corner-up-right arrows-left-right arrows-sort brackets brackets-contain forms cursor-text arrows-right'.split(' ');
const map = {};
for (const n of names) { const m = tcss.match(new RegExp('\\.ti-' + n + ':before\\{content:"\\\\([0-9a-f]+)"')); if (!m) { console.error('no icon', n); process.exit(1); } map[n] = m[1]; }
fs.writeFileSync(path.join(dir, 'tabler.json'), JSON.stringify({ map, font: read('css/fonts/tabler-icons.woff2').toString('base64') }));
// 4. the kit sketch's CSS, shared by both builders
const e = fs.readFileSync(path.join(__dirname, 'build-elements.js'), 'utf8');
const i = e.indexOf('/* ===== A sketch of the kit after the change'), j = e.indexOf('</style>', i);
fs.writeFileSync(path.join(dir, 'px-shared.css'), e.slice(i, j));
console.log('prepared', dir);
