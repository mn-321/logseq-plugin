#!/usr/bin/env node
/* PDF highlights as quotations (parts/pdf-quote.js, 0.4.364) in a pretend Logseq window, on the markup Logseq 2.0.2 draws
   (copied from the Illness Test Graph, 2026-10-23): a highlight's own bullet under its PDF, a note citing it, a highlight
   of an area; the citations, the marks, the presses that open the PDF and the ones left to Logseq, a clean unload.
   Needs node and jsdom. Run from the repo root: node tools/pdf-quote-test.js   (tools/check.sh runs it) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const problems = [];
let cases = 0;
const check = (ok, text) => { cases++; if (!ok) { problems.push(text); console.log('PROBLEM: ' + text); } };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const PDF = '6adbf698-ab17-44a4-ade4-78804115a46f', HL = '6adbf6ec-fc80-4e5b-9509-96911648e342', AREA = '6adbf876-e2f8-4358-9a06-8b4d40fface2', NOTE = '6adbf728-424e-4beb-a5e0-2feb30077044';
const label = page => `<div class=" prefix-link"><span class=" hl-page"><strong class=" forbid-edit">P${page}</strong></span></div>`;
const words = 'In this study, 34% of patients with liver-involved pCUP, fulfilled the radiological criteria for an iCCA diagnosis';
const block = (id, inner, children = '') => `<div class="ls-block" blockid="${id}"><div class="block-main-container"><span class="bullet-container cursor"><span class="bullet"></span></span>${inner}</div>${children}</div>`;
const html = `<!doctype html><html><body>
${block(PDF, `<div class="block-content" data-type="default"><a class="asset-ref is-pdf">Intrahepatic cholangiocarcinoma hidden within cancer of unknown primary</a></div>`,
  block(HL, `<div class="block-content" data-type="annotation"><div class="block-head-wrap"><div class="w-full inline"><span class=" block-title-wrap">${label(1)}${words}</span></div></div></div>`)
  + block(AREA, `<div class="block-content" data-type="annotation"><div class="block-head-wrap"><div class="w-full inline"><span data-hl-type="area" class=" block-title-wrap"><div class=" prefix-link"><span class=" hl-page"><strong class=" forbid-edit">P1</strong></span><div class=" hl-area"><img src="x.png"></div></div>Oct 23, 2026</span></div></div></div>`))}
${block(NOTE, `<div class="block-content" data-type="default"><div class="block-head-wrap"><div class="w-full inline"><span class=" block-title-wrap">Dr. Mei Chen pointed to this: <span data-ref="${HL}" class=" page-reference"><a data-uuid="${HL}" class="page-ref"><span><div class="w-full inline"><span class=" block-title-wrap">${label(1)}${words}</span></div></span></a></span></span></div></div></div>`)}
${block('6adbf000-0000-4000-8000-000000000001', `<div class="block-content" data-type="default"><div class="w-full inline"><span class=" block-title-wrap">P1 is a plain word here</span></div></div>`)}
</body></html>`;
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.parent = window;
const doc = window.document;
window.logseq = { settings: { pdfCitations: true } };
for (const file of ['parts/shared.js', 'parts/pdf-quote.js']) window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
const watchers = [];
let asked = [];
const core = window.refinementCore = { provided: {}, sendStyle: () => {}, addsElements: () => true, watchDomEarly: fn => watchers.push(fn), watchDom: fn => watchers.push(fn),
  onDatabaseChange: () => {}, onPageChange: () => {}, onSettingsChange: () => {} };
core.provide = things => Object.assign(core.provided, things);
core.provided.currentPage = async () => ({ uuid: '00000001-2026-1023-0000-000000000000' });
core.provided.pdfSources = async uuids => { asked.push(...uuids); return new Map(uuids.filter(u => u === HL || u === AREA).map(u => [u, { page: 1, sourceUuid: PDF, title: 'Intrahepatic cholangiocarcinoma hidden within cancer of unknown primary' }])); };
const part = window.refinementParts.find(p => p.name === 'pdf-quote');
part.provide(core);
const inner = core.provided.pdfQuoteInner;

// The rules.
const src = { page: 3, sourceUuid: PDF, title: 'Epidemiology of cholangiocarcinoma.pdf' };
check(inner.citationFor('2', src, true) === '(p. 2)', 'under its PDF, the page alone');
check(inner.citationFor('2', src, false) === '(Epidemiology of cholangiocarcinoma, p. 2)', 'elsewhere, the PDF’s title without .pdf: ' + inner.citationFor('2', src, false));
check(inner.citationFor('?', src, false).endsWith('p. 3)'), 'a page Logseq does not know is read from the highlight');
check(inner.citationFor('4', null, false) === '(p. 4)', 'no title read yet: the page alone');
check(inner.short('Intrahepatic cholangiocarcinoma hidden within cancer of unknown primary') === 'Intrahepatic cholangiocarcinoma hid…', 'a long title is cut: ' + inner.short('Intrahepatic cholangiocarcinoma hidden within cancer of unknown primary'));
check(inner.LABEL.test('P1') && inner.LABEL.test('P ?') && !inner.LABEL.test('Page 1'), 'Logseq’s label read as it draws it');

(async () => {
  part.start();
  await wait(30);
  for (const fn of watchers) fn(doc, []);
  await wait(10);
  const own = doc.querySelector(`.ls-block[blockid="${HL}"] .block-title-wrap`);
  const note = doc.querySelector(`.ls-block[blockid="${NOTE}"] a.page-ref .block-title-wrap`);
  const area = doc.querySelector(`.ls-block[blockid="${AREA}"] .block-title-wrap`);
  check(own.getAttribute('data-rf-pdf') === 'text' && own.parentElement.getAttribute('data-rf-cite') === '(p. 1)', 'the highlight under its PDF: words, (p. 1): ' + own.parentElement.getAttribute('data-rf-cite'));
  check(note.getAttribute('data-rf-pdf') === 'text' && note.parentElement.getAttribute('data-rf-cite') === '(Intrahepatic cholangiocarcinoma hid…, p. 1)', 'the note citing it: the PDF’s title and page: ' + note.parentElement.getAttribute('data-rf-cite'));
  check(area.getAttribute('data-rf-pdf') === 'area' && area.getAttribute('data-rf-cite') === '(p. 1)', 'an area: its line holds the citation itself');
  check(!doc.querySelector('.ls-block[blockid="6adbf000-0000-4000-8000-000000000001"] [data-rf-pdf]'), 'a plain line with “P1” in its words is left alone');
  check(doc.querySelector(`.ls-block[blockid="${HL}"]`).hasAttribute('data-rf-pdf-quote') && doc.querySelector(`.ls-block[blockid="${AREA}"]`).hasAttribute('data-rf-pdf-quote'), 'the highlights’ own bullets become quotation marks');
  check(!doc.querySelector(`.ls-block[blockid="${NOTE}"]`).hasAttribute('data-rf-pdf-quote'), 'the note keeps its bullet');
  check(asked.length === 2 && asked.includes(HL) && asked.includes(AREA), 'each highlight’s PDF read once: ' + asked);
  for (const fn of watchers) fn(doc, []);
  await wait(10);
  check(asked.length === 2, 'and not again on the next pass');

  // The presses: Logseq's label gets a press of the pointer, which is how Logseq opens the PDF at the highlight.
  const opened = [];
  for (const id of [HL, AREA]) doc.querySelector(`.ls-block[blockid="${id}"] .prefix-link`).addEventListener('pointerdown', () => opened.push(id));
  const noteLabel = note.querySelector('.prefix-link');
  noteLabel.addEventListener('pointerdown', () => opened.push('note'));
  let reachedLogseq = 0;
  doc.body.addEventListener('pointerdown', event => { if (!event.target.closest('.prefix-link')) reachedLogseq++; });
  const pressAt = (target, extra = {}) => {
    for (const type of ['pointerdown', 'mousedown']) target.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 10, clientY: 10, ...extra }));
    for (const type of ['pointerup', 'mouseup']) target.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: extra.toX ?? 10, clientY: 10 }));
    target.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: 10, clientY: 10 }));
  };
  pressAt(own.parentElement);
  check(opened.join() === HL, 'a press on the citation under the PDF opens the highlight: ' + opened);
  opened.length = 0; reachedLogseq = 0;
  pressAt(own);
  check(opened.join() === HL && reachedLogseq === 0, 'a press on the highlight’s own words opens it, and does not start editing');
  opened.length = 0;
  pressAt(own, { toX: 80 });
  check(!opened.length, 'a drag over the words selects them, nothing opens');
  opened.length = 0;
  pressAt(note.parentElement);
  check(opened.join() === 'note', 'a press on the citation in a note opens the highlight: ' + opened);
  opened.length = 0; reachedLogseq = 0;
  pressAt(note);
  check(!opened.length && reachedLogseq === 1, 'a press on the words in a note is Logseq’s own (the reference)');
  opened.length = 0;
  pressAt(area);
  check(opened.join() === AREA, 'a press on an area’s citation line opens it: ' + opened);
  opened.length = 0; reachedLogseq = 0;
  pressAt(own, { metaKey: true });
  check(!opened.length && reachedLogseq === 1, 'Cmd with the press is Logseq’s own');

  // Off in the settings: everything back as Logseq drew it.
  window.logseq.settings.pdfCitations = false;
  for (const fn of watchers) fn(doc, []);
  check(!doc.querySelector('[data-rf-pdf], [data-rf-cite], [data-rf-pdf-quote]'), 'off in the settings, nothing of the plugin’s is left');
  window.logseq.settings.pdfCitations = true;
  for (const fn of watchers) fn(doc, []);
  check(doc.querySelectorAll('[data-rf-cite]').length === 3, 'on again, the three come back');
  // Words being edited: the line is gone (Logseq draws a text box), the bullet gets its dot back.
  doc.querySelector(`.ls-block[blockid="${HL}"] .block-head-wrap`).innerHTML = '<textarea></textarea>';
  for (const fn of watchers) fn(doc, []);
  check(!doc.querySelector(`.ls-block[blockid="${HL}"]`).hasAttribute('data-rf-pdf-quote'), 'a highlight being edited gives its bullet back');
  await part.stop();
  check(!doc.querySelector('[data-rf-pdf], [data-rf-cite], [data-rf-pdf-quote]'), 'unload leaves nothing');
  console.log(`pdf-quote-test: ${cases} checks, ${problems.length} problems`);
  process.exit(problems.length ? 1 : 0);
})().catch(error => { console.log('PROBLEM: ' + error.stack); process.exit(1); });
