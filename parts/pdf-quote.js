/* Loaded by main.js after parts/property-kinds.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* A PDF highlight read as a quotation (0.4.364; first made at 0.2.130, at the owner's word, and resting since 0.4.358
   for want of a PDF to judge it on; rebuilt on the kit and the model with the two papers the owner gave, 2026-10-23).
   Logseq draws a highlight as a coloured dot, a "P1" label, then the words. Here the words sit between quotation marks
   and the citation follows them, small and grey: (p. 1) under the PDF itself, (Intrahepatic cholangiocarcinoma hidden…,
   p. 1) anywhere else, as when a note cites the highlight. The highlight's own bullet becomes an opening quotation mark.
   A click on the citation, or on the words of the highlight's own bullet, opens the PDF at the highlight, as Logseq's
   label does; a drag over the words still selects them. A highlight of an area (a picture) keeps its picture, with the
   citation and no quotation marks.
   Nothing of Logseq's is moved: its label is hidden and pressed for it (Logseq opens a highlight on the press of the
   pointer, checked 2026-10-23), the marks and the citation are drawn by the stylesheet from two attributes. The PDF's
   title comes from the model (pdfSources); no logseq.* call here. */
const shared = window.refinementShared;
const { host } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements (PDF quotations): ',
  leaves: { attributes: ['data-rf-pdf', 'data-rf-cite', 'data-rf-pdf-quote'] } });
let model, sendStyle, watchDom, watchDomEarly, addsElements, onDatabaseChange, onPageChange, onSettingsChange;
const take = (core, names) => shared.take(core, names, warnOnce);

const settingsSchema = [
  { key: 'pdfQuotesHeading', type: 'heading', group: 'reading', rank: 4, title: 'PDF quotations', default: null,
    legend: 'A highlight from a PDF reads as a quotation, with its page after it',
    zone: '<div>“In this study, 34% of patients …” <span class="m">(p. 1)</span></div>',
    description: 'Changes here apply right away.' },
  // The key of 0.2.130, so a choice saved then still holds.
  { key: 'pdfCitations', type: 'boolean', title: 'PDF highlights as quotations', default: true,
    description: 'A highlight from a PDF shows its words between quotation marks with the page after them, small and grey: (p. 1) under the PDF itself, (the PDF’s title, p. 1) wherever a note cites it. Its bullet becomes a quotation mark. A click on the citation, or on the words under the PDF, opens the PDF at the highlight. Applies at once.' },
];
const setting = shared.settingReader(settingsSchema);

// Logseq's label, "P1" (the page; "P?" when it does not know), inside the line of the highlight's words.
const LABEL = /^P\s*(\d+|\?)$/i;
const short = title => { const t = String(title || 'PDF').replace(/\.pdf$/i, ''); return t.length > 38 ? t.slice(0, 35).trimEnd() + '…' : t; };
// The highlight a line shows: in a note's reference, the referenced node; on its own bullet, the bullet.
const highlightOf = wrap => (wrap.closest('a.page-ref[data-uuid]')?.getAttribute('data-uuid') || wrap.closest('.ls-block[blockid]')?.getAttribute('blockid') || '').toLowerCase();
// Under its PDF: the PDF is the page open, or a bullet above this one (in a DB graph a highlight is the PDF's child).
function underSource(wrap, sourceUuid) {
  if (!sourceUuid) return false;
  if (openPage === sourceUuid) return true;
  for (let block = wrap.closest('.ls-block[blockid]'); block; block = block.parentElement?.closest('.ls-block[blockid]'))
    if (block.getAttribute('blockid')?.toLowerCase() === sourceUuid) return true;
  return false;
}
/* What a line says, pure (for tools/pdf-quote-test.js): the citation for a highlight on page `page` of `source`, shown
   under the PDF or elsewhere. */
function citationFor(page, source, under) {
  const p = page === '?' && source ? source.page : page;
  return source && !under ? `(${short(source.title)}, p. ${p})` : `(p. ${p})`;
}

let sources = new Map(), asked = new Set(), openPage = '', timer = 0, stopped = false;
const lines = doc => [...doc.querySelectorAll('.block-title-wrap')].filter(wrap => {
  const label = wrap.querySelector(':scope > .prefix-link > .hl-page > strong');
  return label && LABEL.test(label.textContent.trim());
});
function draw(doc) {
  if (!doc || stopped) return;
  if (!setting('pdfCitations')) return clear(doc);
  const missing = [];
  for (const wrap of lines(doc)) {
    const page = LABEL.exec(wrap.querySelector(':scope > .prefix-link > .hl-page > strong').textContent.trim())[1];
    const uuid = highlightOf(wrap), source = sources.get(uuid);
    if (uuid && !source && !asked.has(uuid) && !missing.includes(uuid)) missing.push(uuid);
    const area = !!wrap.querySelector('img') || wrap.closest('[data-hl-type="area"]') !== null;
    const cite = citationFor(page, source, underSource(wrap, source?.sourceUuid));
    const kind = area ? 'area' : 'text';
    if (wrap.getAttribute('data-rf-pdf') !== kind) wrap.setAttribute('data-rf-pdf', kind);
    // The citation is drawn by the line's holder (Logseq's inline box around the words), after the closing mark, so it
    // can be small while the mark keeps the words' size, and a press on it is told apart from one on the words.
    // An area has no closing mark: its line draws the citation itself, right after Logseq's words for the picture.
    const holder = area ? wrap : wrap.parentElement;
    if (holder && holder.getAttribute('data-rf-cite') !== cite) holder.setAttribute('data-rf-cite', cite);
    // The highlight's own bullet (not a note citing it): its bullet becomes the opening quotation mark.
    const own = !wrap.closest('a.page-ref') && wrap.closest('.block-content[data-type="annotation"]');
    const block = own && wrap.closest('.ls-block[blockid]');
    if (block && !block.hasAttribute('data-rf-pdf-quote')) block.setAttribute('data-rf-pdf-quote', '');
  }
  // A holder whose line is no longer a highlight's, and a bullet no longer showing one (its words being edited), go back.
  for (const holder of doc.querySelectorAll('[data-rf-cite]'))
    if (!holder.matches('.block-title-wrap[data-rf-pdf="area"]') && !holder.querySelector(':scope > .block-title-wrap[data-rf-pdf="text"]')) holder.removeAttribute('data-rf-cite');
  for (const block of doc.querySelectorAll('.ls-block[data-rf-pdf-quote]'))
    if (!block.querySelector(':scope > .block-main-container .block-title-wrap[data-rf-pdf]')) block.removeAttribute('data-rf-pdf-quote');
  if (missing.length) read(missing);
}
// The PDFs' titles for highlights not read yet, then the lines again.
async function read(uuids) {
  for (const uuid of uuids) asked.add(uuid);
  try {
    const found = await model.pdfSources(uuids);
    if (stopped) return;
    for (const [uuid, source] of found) sources.set(uuid, source);
    draw(host());
  } catch (error) { warnOnce('could not read which PDF a highlight is from', error); }
}
function clear(doc = host()) {
  for (const name of ['data-rf-pdf', 'data-rf-cite', 'data-rf-pdf-quote']) for (const el of doc.querySelectorAll(`[${name}]`)) el.removeAttribute(name);
}

/* The citation and the highlight's own words open the PDF at the highlight: Logseq's hidden label is pressed for them.
   On the highlight's own bullet a plain press on the words does not start editing (a drag still selects them); in a
   note, only the citation does this, and the words stay the reference Logseq made of them. */
const ownWords = (target, wrap) => !wrap.closest('a.page-ref') && wrap.contains(target) && !target.closest?.('a, button, input, textarea, [contenteditable="true"]');
// A press on the citation lands on its holder itself (the citation is the holder's own drawing); one on the words lands
// inside the line.
function lineAt(event) {
  const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
  // Only a person's press: the plugin's own press on Logseq's hidden label goes through to Logseq.
  if (pressing || !target || target.closest('.prefix-link') || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null;
  if (target.hasAttribute?.('data-rf-cite')) {
    const wrap = target.matches('.block-title-wrap[data-rf-pdf]') ? target : target.querySelector(':scope > .block-title-wrap[data-rf-pdf]');
    return wrap ? { wrap, citation: true } : null;
  }
  const wrap = target.closest('.block-title-wrap[data-rf-pdf="text"]');
  return wrap && ownWords(target, wrap) ? { wrap, citation: false } : null;
}
let pressing = false;
function press(wrap) {
  const label = wrap.querySelector(':scope > .prefix-link');
  const win = wrap.ownerDocument.defaultView;
  pressing = true;
  try { label?.dispatchEvent(new (win.PointerEvent || win.MouseEvent)('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', view: win })); }
  finally { pressing = false; }
}
let pressed = null;
function onDown(event) {
  if (!setting('pdfCitations')) return;
  const at = lineAt(event);
  pressed = at ? { ...at, x: event.clientX, y: event.clientY } : null;
  if (!at) return;
  // The citation in a note: not the reference's own press. The words: not the editor's.
  event.stopPropagation();
  if (at.citation) event.preventDefault();
}
function onUp(event) {
  if (!pressed) return;
  const was = pressed;
  pressed = null;
  event.stopPropagation();
  const moved = Math.abs(event.clientX - was.x) > 3 || Math.abs(event.clientY - was.y) > 3;
  const selected = String(event.target?.ownerDocument?.getSelection?.() || '').trim();
  if (!was.citation && (moved || selected)) return; // a drag over the words selects them
  event.preventDefault();
  press(was.wrap);
}
function onClick(event) {
  if (!lineAt(event)) return;
  event.stopPropagation();
  event.preventDefault();
}

const css = `
/* A PDF highlight as a quotation (0.4.364). Words: the whole label goes (Logseq's coloured dot and "P1"). An area: Logseq puts the picture inside the label, so
   only "P1" and the dot go and the picture stays. */
.block-title-wrap[data-rf-pdf="text"] > .prefix-link { display: none !important; }
.block-title-wrap[data-rf-pdf="area"] > .prefix-link > .hl-page { display: none !important; }
.block-title-wrap[data-rf-pdf="area"] > .prefix-link::before { content: none !important; display: none !important; }
/* Logseq stacks an area's picture and its words in a column; in a row that wraps, the picture keeps its own line and the
   words and the citation share the next. */
.block-title-wrap[data-rf-pdf="area"] { flex-direction: row !important; flex-wrap: wrap; align-items: baseline; }
.block-title-wrap[data-rf-pdf="area"] > .prefix-link { flex: 0 0 100%; }
.block-title-wrap[data-rf-pdf="text"]::before { content: '“'; }
.block-title-wrap[data-rf-pdf="text"]::after { content: '”'; }
/* The citation, after the closing mark: small, in the kit's faint grey, darker on hover; a press on it opens the PDF at
   the highlight. A little box of its own, so a reference's underline does not reach it. */
[data-rf-cite]::after { content: attr(data-rf-cite); display: inline-block; margin-left: .3em; text-indent: 0; font-size: .82em; font-weight: 400; color: var(--rf-faint); white-space: nowrap; cursor: pointer; text-decoration: none; }
[data-rf-cite]:hover::after { color: var(--rf-quiet); }
.ls-block .block-content:not(:has(a.page-ref)) .block-title-wrap[data-rf-pdf="text"] { cursor: pointer; }
/* The highlight's own bullet: an opening quotation mark in place of the dot. */
.ls-block[data-rf-pdf-quote] > .block-main-container .bullet-container:not(.typed-list) { background: transparent !important; }
.ls-block[data-rf-pdf-quote] > .block-main-container .bullet-container:not(.typed-list) > .bullet {
  background: transparent !important; border: 0 !important; width: .65em; height: .65em; border-radius: 0 !important;
  display: flex; align-items: center; justify-content: center; }
.ls-block[data-rf-pdf-quote] > .block-main-container .bullet-container:not(.typed-list) > .bullet::before {
  content: '“'; color: var(--rf-faint); font-family: Georgia, serif; font-size: 1.3em; line-height: .75; transform: translateY(.15em); pointer-events: none; }
`;

function start() {
  ({ sendStyle, watchDom, watchDomEarly, addsElements, onDatabaseChange, onPageChange, onSettingsChange } = take(window.refinementCore,
    ['sendStyle', 'watchDom', 'watchDomEarly', 'addsElements', 'onDatabaseChange', 'onPageChange', 'onSettingsChange', 'pdfSources', 'currentPage']));
  model = window.refinementCore.provided; // the graph through the model's doors
  stopped = false;
  sendStyle('refinement-pdf-quote', css);
  // Before the screen is drawn, so Logseq's label never shows first.
  watchDomEarly((doc, records) => { if (addsElements(records)) draw(doc); });
  watchDom(function drawPdfQuotes(doc) { draw(doc); });
  const win = host().defaultView;
  listen(win, ['pointerdown', 'mousedown'], onDown);
  listen(win, ['pointerup', 'mouseup'], onUp);
  listen(win, ['click'], onClick);
  const page = async () => { try { openPage = String((await model.currentPage())?.uuid || '').toLowerCase(); } catch (error) { openPage = ''; } draw(host()); };
  onPageChange(() => { if (!stopped) page(); });
  // A highlight made or a PDF renamed shows soon after: what was read is read again.
  onDatabaseChange(() => { if (stopped) return; clearTimeout(timer); timer = setTimeout(() => { asked = new Set(); sources = new Map(); draw(host()); }, 900); });
  onSettingsChange((now, before) => { if (!stopped && now?.pdfCitations !== before?.pdfCitations) draw(host()); });
  onUnload(() => { stopped = true; clearTimeout(timer); pressed = null; clear(); });
  page();
}
// For tools/pdf-quote-test.js (read-only), through the core.
const provide = core => core.provide({ pdfQuoteInner: { citationFor, short, LABEL } });
(window.refinementParts ||= []).push({ name: 'pdf-quote', schema: settingsSchema, provide, start, stop: runUnloadTasks });
})();
