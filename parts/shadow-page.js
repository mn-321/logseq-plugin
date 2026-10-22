/* Loaded by main.js after parts/shadow-steps.js. Kept in its own scope; parts/shadow.js links it when the proposals start. */
(() => {
/* Proposals on a page's own properties (split out of parts/shadow.js at 0.4.268, layer 2 item 10, so that each piece of the proposals can be read
   and changed on its own). It draws in the page's own property rows.
   The pieces share one object, window.refinementProposals (P): each puts there what the others use, and takes what
   it uses from there when the proposals start (P.links), or at once when the piece that has it is loaded before. */
const shared = window.refinementShared;
const { host, notify, graphNamedIn } = shared;
const { warnOnce, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (proposals): ' });
const P = window.refinementProposals ||= { links: [] };
// This piece works inside the proposals while writing (parts/shadow.js); without them it stays out (0.4.269).
if (!P.state) { warnOnce('parts/shadow.js is not loaded, so proposals on a page’s own properties is off'); return; }
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };
let model, UUID, idOf, pick;
const { allowed, contextFor, daysFor, ghostLook, guessDataFor, guessKey, later, pending, piecesFor, pullBlock, rememberUndo, state, undoText, withFreshLinks, writePieces } = P;
P.links.push(core => {
  ({ model, UUID, idOf, pick } = take(core, ['UUID', 'idOf', 'pick']));
  model = core.provided; // the graph is read through the model (0.4.226)
});

/* Proposals on a page's own properties (0.4.239, at the owner's word: "it is fine if they appear, since new pages are
   always being created that may apply to them"). For the page open in the main view, not a journal day: what could
   fill its empty properties shows in them in italic grey, as on a bullet, worked out from its title, the first lines
   on it and the earlier pages and bullets it looks like. Nothing is filled in by itself, since a page is not left as
   a bullet is: a click on a grey value fills it in, and the faded arrow at the end of the title takes it back (until
   the title is edited or the page is left). A click beside it still opens Logseq's own list, to choose another. */
// The open page's own properties box (its id is Logseq's own for the box, not the page's: the page comes from Logseq).
const PAGE_PROPS = '#main-content-container .ls-page-properties';
const pageLive = state.page = { uuid: '', box: null, asked: null, pieces: [], version: 0, timer: 0 };
const openBox = doc => doc.querySelector(PAGE_PROPS);
function schedulePage(ms = 120) { clearTimeout(pageLive.timer); pending.delete(pageLive.timer); pageLive.timer = later(computePage, ms); }
function setPage(uuid, pieces, box = pageLive.box) { Object.assign(pageLive, { uuid, pieces, box }); drawPage(); }
async function computePage() {
  const box = openBox(host()), version = ++pageLive.version;
  pageLive.asked = box;
  if (!box) return setPage('', [], null);
  try {
    const uuid = String((await logseq.Editor.getCurrentPage())?.uuid || '');
    if (version !== pageLive.version || P.stopped) return;
    if (!UUID.test(uuid) || !await allowed()) return setPage(uuid, [], box);
    const page = await pullBlock(uuid);
    if (version !== pageLive.version || P.stopped) return;
    if (!page || pick(page, 'block/journal-day')) return setPage(uuid, [], box);
    // A tag's or a property's own page (0.4.260, the owner on the Consultation tag page: "Why aren't properties showing
    // at top?"): its rows are the tag's own setup (Extends, Tag Properties with Provider and Topic), drawn empty by
    // Logseq, not values waiting to be filled; they are never hidden there and nothing is proposed for them.
    const kind = await model.kindOfPage(idOf(page));
    if (version !== pageLive.version || P.stopped) return;
    box.toggleAttribute('data-rfs-keep-empty', kind.isTag || kind.isProperty);
    if (kind.isTag || kind.isProperty) return setPage(uuid, [], box);
    const lines = await model.pageLines(uuid);
    const text = [String(pick(page, 'block/title') ?? ''), ...lines].join('\n');
    const ctx = await withFreshLinks(text, await guessDataFor(await daysFor(await contextFor())));
    if (version !== pageLive.version || P.stopped || openBox(host()) !== box) return;
    const { record, pieces } = piecesFor(page, text, ctx);
    // Only values for the page itself: no tag for it, and no page to make from its words.
    setPage(uuid, idOf(record) === idOf(page) ? pieces.filter(x => !x.asPage && x.kind !== 'tag' && !x.needsTag) : [], box);
  } catch (error) { warnOnce('the page proposals could not be worked out', error); }
}
function pageEarly(doc) {
  const box = openBox(doc);
  if (box !== pageLive.asked) { pageLive.asked = box; schedulePage(); }
  else if (pageLive.pieces.length || doc.querySelector('.rfs-page-ghost')) drawPage(doc);
}
const rowName = row => String(row.dataset.propertyTitle || '').toLowerCase();
function drawPage(doc = host()) {
  const box = pageLive.box?.isConnected ? pageLive.box : null;
  const want = new Map(box ? pageLive.pieces.map(piece => [piece.prop.lower, piece]) : []);
  for (const g of doc.querySelectorAll('.rfs-page-ghost')) {
    const row = g.closest('.property-pair'), piece = row && want.get(rowName(row));
    if (piece && box?.contains(g) && row.querySelector('.empty-value') && g.dataset.rfsKey === guessKey(piece)) continue;
    row?.removeAttribute('data-refinement-proposal');
    g.remove();
  }
  if (box) for (const row of box.querySelectorAll('.property-pair[data-property-title]')) {
    const piece = want.get(rowName(row)), empty = row.querySelector('.empty-value');
    if (!piece || !empty || row.querySelector('.rfs-page-ghost')) continue;
    const g = doc.createElement('span'), look = ghostLook(piece);
    g.className = `${look.cls} rfs-page-ghost`;
    g.textContent = piece.tagPage ? `${piece.shown} #${piece.tagPage.tag.title}` : piece.shown;
    g.title = piece.guess ? 'A guess: click to fill it in' : 'Click to fill it in';
    g.dataset.rfsKey = guessKey(piece);
    g.dataset.rfsIdent = piece.ident;
    g.setAttribute('contenteditable', 'false');
    g.setAttribute('role', 'button');
    empty.parentElement.insertBefore(g, empty);
    row.setAttribute('data-refinement-proposal', '');
  }
}
async function fillPage(key) {
  const uuid = pageLive.uuid, piece = pageLive.pieces.find(x => guessKey(x) === key);
  if (!piece || P.stopped || !await allowed()) return;
  setPage(uuid, pageLive.pieces.filter(x => x !== piece));
  try {
    const { written, undo } = await writePieces(uuid, [piece], uuid);
    // The page's title is a block of the page's own: the arrow goes at the end of it, as on a bullet's line.
    if (written.length) rememberUndo(uuid, uuid, undoText(written), async () => { try { await undo(); } finally { schedulePage(400); } });
  } finally { schedulePage(400); }
}


Object.assign(P, { fillPage, pageEarly, pageLive, schedulePage, setPage });
(window.refinementParts ||= []).push({ name: 'proposals page', schema: [], start() {}, stop: runUnloadTasks });
})();
