/* Loaded by main.js after parts/link-text.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* Two things from the old editor part kept for writing (docs/FINISHING-PROMPT.md section 5, Phase 2 piece 4; the rest of
   its commands went, docs/DECISIONS-AUTONOMOUS.md 18):
   - New bullet at the outermost level: from anywhere inside a bullet, a new empty bullet at the page's outermost
     level, after the top bullet holding this one and all it holds, with an empty bullet before it as a spacer. In the
     command palette; no keys by default (Option-Enter, its old keys, is the proposals' own key now).
   - A date typed year first inside [[ ]] (2026 10 14, 2026-10-14, 2026/10/14, 2026.10.14 or 20261014) becomes that day's
     journal name ("Oct 14th, 2026") once the day's second digit is typed, so Logseq's own [[ menu offers the day and
     Enter links to it. Typed as if by hand, so Cmd+Z brings the digits back.
   The graph through the model's doors; the command through the register. */
const shared = window.refinementShared;
const { host, notify } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements (block commands): ' });
let model;
const take = (core, names) => shared.take(core, names, warnOnce);

const settingsSchema = [
  { key: 'blockCommandsHeading', type: 'heading', group: 'writing', rank: 3, title: 'Writing helpers', default: null, icon: 'add',
    legend: 'A bullet at the outermost level, and dates typed year first in [[ ]]',
    zone: '<div><i class="b"></i>Kickoff</div><div class="ind"><i class="b"></i>notes</div><div>&nbsp;</div><div><i class="b"></i><span class="m">|</span></div>',
    description: 'Changes here apply right away.' },
  { key: 'outermostBlockShortcut', type: 'string', title: 'Keys for New bullet at the outermost level', default: '',
    description: 'From anywhere inside a bullet: a new empty bullet at the page’s outermost level, after the top bullet you are in and all it holds, with an empty bullet before it as a spacer. Also in the command palette. Empty: no keys (Option-Enter, alt+enter, is the proposals’ key).' },
  { key: 'dateLinkFormats', type: 'boolean', title: 'Year-first dates in [[ ]] link to journals', default: true,
    description: 'Typing [[2026 10 14 (or 2026-10-14, 2026/10/14, 2026.10.14, 20261014) turns the date into that day’s journal name, so Logseq’s own list offers the day. Cmd+Z brings the digits back.' },
];
const setting = shared.settingReader(settingsSchema);

const refId = ref => ref?.id ?? ref?.['db/id'] ?? ref;
async function newOutermostBlock() {
  const current = await model.currentBlock() || (await model.pickedBlocks())[0];
  if (!current) return notify('Click in a bullet first', 'warning');
  try {
    let top = await model.getBlock(current.uuid);
    for (let depth = 0; top && depth < 100; depth++) {
      const parentId = refId(top.parent);
      if (!parentId || parentId === refId(top.page)) break;
      const parent = await model.getBlock(parentId);
      if (!parent?.uuid || parent.name) break;
      top = parent;
    }
    if (!top?.uuid) return;
    await model.exitEditing();
    const spacer = await model.insertBlock(top.uuid, '', { sibling: true, before: false });
    const block = spacer?.uuid && await model.insertBlock(spacer.uuid, '', { sibling: true, before: false });
    if (block?.uuid) await model.editBlock(block.uuid);
    // Logseq hides the dot of an empty bullet, but shows it on one made in the last half second and decides only when it
    // draws the bullet; the spacer is never typed in, so a pointer passing over it a moment later has Logseq draw it again.
    if (spacer?.uuid) setTimeout(() => {
      const row = host().querySelector(`.ls-block[blockid="${spacer.uuid}"] > .block-main-container`);
      if (!row) return;
      const view = row.ownerDocument.defaultView, outside = row.ownerDocument.body;
      row.dispatchEvent(new view.MouseEvent('mouseover', { bubbles: true, relatedTarget: outside }));
      setTimeout(() => row.dispatchEvent(new view.MouseEvent('mouseout', { bubbles: true, relatedTarget: outside })), 80);
    }, 700);
  } catch (error) { warnOnce('a bullet at the outermost level could not be made', error); notify(`Could not add the bullet: ${error?.message || error}`, 'warning'); }
}

// Month and day need two digits, so the change waits until the date is complete; 2026 02 30 is left as typed.
const YEAR_FIRST_DATE = /^(\d{4})([ ./_-]?)(\d{2})\2(\d{2})$/;
let swapping = false;
function openLinkQuery(box) {
  if (!box || box.tagName !== 'TEXTAREA' || !box.closest('.ls-block') || box.selectionStart !== box.selectionEnd) return null;
  const before = box.value.slice(0, box.selectionStart), open = before.lastIndexOf('[[');
  if (open < 0 || before.indexOf(']]', open) >= 0) return null;
  return { start: open + 2, end: box.selectionStart, text: before.slice(open + 2) };
}
async function swapDateInLink(doc) {
  if (swapping || !setting('dateLinkFormats')) return;
  const box = doc.activeElement, query = openLinkQuery(box);
  const m = query && YEAR_FIRST_DATE.exec(query.text);
  if (!m) return;
  const [year, month, day] = [Number(m[1]), Number(m[3]), Number(m[4])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return;
  swapping = true;
  try {
    const title = await model.journalTitleFor(year, month, day);
    const now = openLinkQuery(doc.activeElement);
    if (doc.activeElement !== box || !now || now.start !== query.start || now.text !== query.text || !title || title === query.text) return;
    box.setSelectionRange(query.start, query.end);
    if (!doc.execCommand('insertText', false, title)) box.setSelectionRange(query.end, query.end);
  } catch (error) { warnOnce('a typed date could not become a journal link', error); }
  finally { swapping = false; }
}

function start() {
  take(window.refinementCore, ['currentBlock', 'pickedBlocks', 'getBlock', 'exitEditing', 'insertBlock', 'editBlock', 'journalTitleFor']);
  model = window.refinementCore.provided; // the graph through the model's doors
  const doc = host();
  listen(doc.defaultView, ['input'], () => { swapDateInLink(doc); });
  onUnload(() => { swapping = false; });
}
(window.refinementParts ||= []).push({ name: 'block-commands', schema: settingsSchema, start, stop: runUnloadTasks,
  commands: [{ key: 'new-outermost-block', label: 'New bullet at the outermost level', icon: 'add', shortcut: 'outermostBlockShortcut', run: () => newOutermostBlock() }] });
})();
