/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Proposals, piece 1 (0.4.197): what the plugin is sure of while a bullet is written. Rebuilt on the foundation and the
   model; the old proposals part pencilled values into the pills and took them with Tab (removed at 0.4.250).

   While you write a bullet, what the plugin is sure of shows faintly in the bullet's own properties (since 0.4.201;
   it was a line under the bullet), and is filled in when you leave the bullet (Enter, a click elsewhere, the
   arrows): nothing is written before that, and the bar at the bottom offers Undo after. Escape clears it until the
   bullet is next edited (0.4.204; for good before). The words typed are never changed, but for a page's tag (below).

   The record a bullet belongs to is the bullet itself when its tags give it properties, else its parent when the
   parent's do (notes under an appointment belong to the appointment). The sure pieces, for the record's empty
   properties only:
   - a page linked in the words ([[Dr. Mei Chen]]) that fits a link property of the record's tags (doctor takes
     #Doctor); one link per property, and nothing when a one-value property would get two (two doctors named: quiet);
   - the page the record is written on, when its tag fits (a consultation written on Dr. Mei Chen's page), once;
   - the journal day, for an empty "date" of a record written on a journal page;
   - a page tagged in the words, [[Dr. New]]#Doctor with no space (0.4.209, at the owner's word): the page, for the
     property that takes the tag; filling it in gives the page the tag and takes it off the bullet, words and all
     (Logseq makes the bullet a doctor otherwise).

   Piece 2 (0.4.200): guesses, for empty properties the sure pieces leave empty (and not one kept quiet by two names).
   They show in the same place with a dotted line under them as well; Enter takes them with the rest (0.4.202; for one
   version, 0.4.218, Tab accepted them instead), and leaving any other way takes only the sure values. Option-Enter
   stops on them to check (0.4.219).
   A guess is made when every rule that speaks agrees:
   - plain words: a page named without brackets, by its whole title or alias ("Northgate") or by a word of its title
     that no other page of the right tag shares ("Dr. Patel", "the tingling"); a tie names no one;
   - the nodes it looks like (piece 3, 0.4.212, the "looks like" engine in parts/alike.js, docs/ALIKE.md): the
     nearest earlier nodes holding the property, by their words, links and tags, vote for their value, and a clear
     lead is proposed ("Flagging again by teatime." looks like the lines that had Fatigue); it took the place of
     "the same line written before", which it holds as the case of a near-identical line;
   - the parent's values: a tagged bullet under a tagged bullet gets the parent's values for properties both have;
   - a linked page with no tag yet, for the first empty place it could fill when there are one or two (taking it also
     gives the page that place's tag);
   - the journal day for a "date" of a tag with one to four dated nodes, all dated the day written (0.4.211).
   Piece 3, stage D (0.4.213, docs/ALIKE.md): a bullet with no tag, and no record above it, gets the tag of the nodes
   it looks like, pencilled in a "Tags" pill under the bullet where Logseq shows a bullet's tags, with the properties
   that tag gives beside it, filled by the rules above as if the tag were there; every one of them a guess. Enter
   gives the bullet the tag and fills the values, under one Undo; leaving any other way takes nothing. The tag has
   its own, stricter limits in the engine (a wrong tag costs more than a wrong value).
   Piece 3, stage E (0.4.214, docs/ALIKE.md): the plain-language reader. A date written in the words ("on Friday",
   "the 4th", "4 Aug", "tomorrow", "in two weeks"), counted from the day the bullet is written on, is a guess for an
   empty Date nothing else fills; one date, or nothing. A number beside a number property's name ("cycle 5") is a
   guess for it. A journal page the day does not have yet is made when the guess is taken.
   Stage F (0.4.215): Option-Enter reaches an empty Date too. Logseq's date picker opens as for a click, and the
   keyboard goes to its text box ("e.g. Next week"): a day in words and Enter set it and move on, Tab skips, Escape
   comes back to the words.
   0.4.218, at the owner's word ("the undo toast notification is in an awful place and loud and too far down and
   distracting. it should be something just where text is but very subtle, like a faded icon"): Undo is a faded icon
   at the end of the bullet's line, there until the bullet is edited again or the page is left, in place of the bar
   at the bottom of the window. 0.4.219, at the owner's word (after 0.4.218 had Tab accept guesses and Enter fill only
   the sure values): Enter takes the guesses again, and Option-Enter stops on each guessed property as well, with the
   guess already in Logseq's list, so a wrong one is put right before it is written.
   Writes only in the graphs named in its setting, as every part that writes to notes does. */
const shared = window.refinementShared;
const { host, notify, graphNamedIn } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements (proposals): ', leaves: { elements: '.rfs-ghost, .rfs-made, .rfs-undo', attributes: ['data-refinement-proposal', 'data-rfs-at', 'data-rfs-keep-empty'] } });
let model, UUID, propSchema, propPages, bare, pick, idOf, sendStyle, titleOf, watchDomEarly, alike, parseDay, dayAfter, dayNumber, journalIdFor, journalTitleFor, onPageChange, onGraphChange, onDatabaseChange, onSettingsChange;
const P = shared.feature('proposals');
P.links ||= [];
// What the other pieces of the proposals give (parts/shadow-rules.js, -steps.js, -page.js), taken when the proposals start.
let contextFor, daysFor, guessDataFor, ownTagsAtStart, piecesFor, pullBlock, withFreshLinks, LINK, TAG, inWords, pageTagIn, plainWords, sameIds, untagged, withPageTag, withoutPageTag, addHistory, freeWords, guessCache, learnSoon, namedIn, namesFor, pickerOrder, wordsEarned, picking, endPicking, onPickKey, fillPage, pageEarly, pageLive, schedulePage, setPage;
const take = (core, names) => shared.take(core, names, warnOnce);
const { esc, tag: tagWord } = shared;

const settingsSchema = [
  { key: 'shadowHeading', type: 'heading', group: 'writing', rank: 1, title: 'Proposals', default: null,
    legend: 'What the plugin is sure of, shown faintly in the bullet’s own properties and filled in when you leave it',
    zone: '<div><span class="m">Provider:</span> <span class="m"><i><u style="text-decoration-style: dotted">Dr. Raj Patel</u></i></span> <span class="m">· Date: <i>Oct 20</i></span></div>',
    description: 'Changes here apply right away.' },
  { key: 'shadowProposals', type: 'boolean', title: 'Proposals while you write', default: true,
    description: 'While you write a bullet, what the plugin is sure of shows faintly in the bullet’s own properties, where it will go: from your words, the page, the bullet a note is written under and the journal day (a linked doctor for the doctor property, the day for the date). Leaving the bullet (Enter, a click elsewhere, the arrows) fills those in, and a faded undo arrow at the end of the bullet’s line takes them off again until you next edit it. They are in italic grey; a guess has a dotted line under it as well: a page named in plain words (“Dr. Patel”), the values the earlier lines most like this one had (their words, links and tags), the parent bullet’s values, a linked page with no tag yet, the journal day for a tag with only a few dated bullets so far, a date written in the words (“on Friday”, “the 4th”, “4 Aug”) for a Date nothing else fills, a number beside a number property’s name (“cycle 5”). A bullet with no tag yet gets the tag of the lines it looks like, in a dotted Tags pill, with that tag’s properties beside it; Enter gives it the tag and fills them in. Enter fills in everything shown, guesses too; leaving the bullet any other way fills in only what is not a guess. Escape clears them until you type in the bullet again. Option-Enter opens the first property that is empty or holds a guess (a capsule or a row of its own; a date opens Logseq’s date picker with the keyboard in its text box, so “next fri” and Enter set it; a guess is already typed in, so Enter keeps it and typing puts something else); Enter there keeps your choice and moves on, and on the last one makes the next bullet; Tab skips; Option-Enter again finishes the bullet; Escape comes back to the words. A tag written right after a link, with no space ([[Dr. New]]#Doctor), is that page’s tag: the page is proposed for the property that takes the tag, and filling it in gives the page the tag and takes it off the bullet and its words. Otherwise your words are never changed. Applies at once.' },
  { key: 'shadowHideEmpty', type: 'boolean', title: 'Hide empty properties until something is proposed', default: true,
    description: 'Under a bullet, a property with no value is hidden until the plugin proposes something for it (a doctor linked in a consultation brings Provider up, with the doctor in grey); under the bullet you are writing, and in a page’s own properties, they stay, faint, so nothing comes and goes. Option-Enter still steps through the hidden ones. Only in the graphs named below. Applies at once.' },
  { key: 'shadowSkipGraphs', type: 'string', title: 'Not in these graphs', default: '',
    description: 'Graphs the proposals leave alone, separated by commas (the plugin’s settings are shared by every graph). Empty: every graph. Applies at once.' },
  { key: 'shadowStepKeys', type: 'string', title: 'Keys for stepping through a bullet’s properties', default: 'alt+enter',
    description: 'Option-Enter: in the words, opens the first property that is empty or holds a guess; in the properties, finishes the bullet. In Logseq’s spelling (mod is ⌘ on a Mac and Ctrl elsewhere). Empty binds none. Applies at once.' },
  { key: 'shadowAcceptKeys', type: 'string', title: 'Keys for accepting everything shown without a new bullet', default: 'mod+alt+enter',
    description: 'Cmd-Option-Enter: everything shown is accepted, as with Enter, and the bullet is left with no new bullet made. In Logseq’s spelling. Empty binds none. Applies at once.' },
];
const setting = shared.settingReader(settingsSchema);

/* The bullet in edit: its shadow is worked out 40 ms after each key from the text box and one small pull of the
   block, drawn in the record's own properties, and taken when the bullet is left unless Escape cleared it. Only what
   was shown is taken: a record whose row is not on screen (a note zoomed into) gets nothing (second reading). */
// accepted: the guesses Enter took in the bullet being written ({ uuid, at, keys }), filled in with the rest when it
// is left right after (0.4.219, as from 0.4.202; for 0.4.218 alone it was Tab, at the owner's word reversed).
const ENTER_LEAVES = 500;
// undos: what each fill can take back, by the record it was written on (0.4.218: a faded icon on its line).
const state = { live: null, times: [], accepted: { uuid: '', keys: new Set() }, filling: new Map(), get undos() { return ownUndos; } };
/* Being filled in (0.4.283): the values a left bullet is getting, kept on screen, solid, until Logseq's own value
   shows in the same spot. Before, every grey value went the moment the bullet was left and Logseq's values came one
   by one a moment later, so the row emptied and filled again (the owner: "things flash"). Keyed by the record's
   uuid; gone when the write is over, or after FILLING_MS if Logseq never shows the value. */
const FILLING_MS = 6000;
const fillingJobs = () => { const now = Date.now(); for (const [uuid, job] of state.filling) if (job.until < now) state.filling.delete(uuid); return [...state.filling.values()]; };
// A page tagged in the words goes by its name: it may be made, and get an id, only after it was drawn.
const guessKey = piece => `${piece.ident} ${piece.named ?? piece.ids.join(',')}`;
const acceptedIn = uuid => state.accepted.uuid === uuid ? state.accepted.keys : new Set();
const noneAccepted = () => { state.accepted = { uuid: '', keys: new Set() }; };
// Escape clears the proposals until the bullet is next edited (0.4.204, at the owner's word; before, for good, kept
// in Logseq's window storage, which is emptied at start so bullets cleared then show their proposals again).
const OFF_KEY = 'refinementShadowOff';
const forgetOld = () => { try { host().defaultView.localStorage.removeItem(OFF_KEY); } catch { /* nothing kept */ } };
const hushed = state.hushed = { uuid: '' };
// Escape: also drops any check still running, so the values cannot come back from it (the code review, 2026-10-21).
function dismiss(uuid) { hushed.uuid = uuid; liveVersion++; }
// The box of a bullet being written. A property value's box (a text value is drawn as a block of its own, inside the
// record's properties) is not one: proposals are never worked out, shown or taken there (second reading).
const VALUE_PLACE = '.property-pair, .bottom-property-pill, .property-block-container, .property-value-container';
const editingBox = el => (el?.matches?.('textarea') && el.closest('.ls-block[blockid]') && !el.closest(VALUE_PLACE)) ? el : null;
const uuidOf = box => box.closest('.ls-block[blockid]')?.getAttribute('blockid') || '';
let liveTimer = 0, liveVersion = 0;
// The plugin switched off: nothing waiting may write afterwards (the code review, 2026-10-21).
let stopped = false;
// Every timer that can write or take, kept so switching off clears them all.
const pending = new Set();
const later = (fn, ms) => { const t = setTimeout(() => { pending.delete(t); if (!stopped) fn(); }, ms); pending.add(t); return t; };
// Whether the proposals may write in the graph open now, as last seen by a check (Option-Enter must decide at once,
// while its key is still going; the check sets it on every key).
state.allowedNow = false;
// All the guesses shown on a bullet, as Enter takes them.
const shownGuesses = live => new Set(live.pieces.filter(piece => piece.guess && live.drawn?.has(guessKey(piece))).map(guessKey));
/* Leaving a bullet, the one way (the code review, 2026-10-21: four copies of this disagreed about what to check). The
   shadow is taken off the screen, any check still running for it is dropped, and what was shown is filled in, unless
   Escape had cleared it (looked at here, at once: Escape's clearing ends a moment later). taken: the guesses to fill
   with the sure values (the ones Enter took; none for a click away). */
function leave(live, taken = new Set()) {
  if (!live || live.left) return;
  live.left = true;
  live.taken = new Set([...taken, ...live.clicked || []]); // the ones clicked are accepted too (0.4.242)
  live.dismissed = hushed.uuid === live.uuid;
  state.left = live; // for tools/shadow-test.js
  liveVersion++;
  if (state.accepted.uuid === live.uuid) noneAccepted();
  if (!live.dismissed && !stopped && live.recordUuid) {
    const shown = live.drawn || new Set(), pieces = live.pieces.filter(piece => shown.has(guessKey(piece)) && (!piece.guess || live.taken.has(guessKey(piece))));
    if (pieces.length) state.filling.set(live.recordUuid, { recordUuid: live.recordUuid, pieces, until: Date.now() + FILLING_MS });
  }
  if (state.live === live) { state.live = null; hide(); }
  if (live.dismissed || stopped) return;
  // The write over: what was not written goes at once; what was stays until Logseq shows it (its drawing comes a
  // moment after the write returns; seen 0.4.283: the pill was empty for a frame when it went at the write's end).
  takeShadow(live).then(written => {
    const keys = new Set((written || []).map(guessKey)), job = state.filling.get(live.recordUuid);
    if (job) { job.pieces = job.pieces.filter(piece => keys.has(guessKey(piece))); if (!job.pieces.length) state.filling.delete(live.recordUuid); }
  }, error => { state.filling.delete(live.recordUuid); warnOnce('the shadow could not be taken', error); notify('The proposed values could not be filled in', 'warning'); })
    .finally(() => drawInPlace());
}
// The bullet's own tags when its editing began (ownTagsAtStart), read again each time a bullet's box gets the focus.
const startTags = { uuid: '', own: new Set() };
async function allowed() {
  // Every graph but those left out (0.4.360, the owner: a fresh install named no graph, so nothing was ever filled).
  return setting('shadowProposals') && !(await graphNamedIn(setting('shadowSkipGraphs')));
}
// No shadow: nor anything taken in it, so a guess taken earlier is never written on a later visit (second reading).
function clearLive() { state.live = null; noneAccepted(); hide(); }
async function compute(box) {
  const uuid = uuidOf(box);
  if (!uuid || hushed.uuid === uuid) { clearLive(); return; }
  const version = ++liveVersion, text = box.value, t0 = performance.now();
  try {
    const ok = await allowed();
    state.allowedNow = ok;
    if (!ok) { clearLive(); return; }
    const ctx = await withFreshLinks(text, await guessDataFor(await daysFor(await contextFor()), { wait: false }));
    const b = await pullBlock(uuid);
    // Still the newest check, not cleared by Escape meanwhile, and the bullet still the one in edit (the code review,
    // 2026-10-21: a check finishing after Escape brought the values back, and one finishing after the bullet was left
    // drew them on a bullet no longer written in).
    if (version !== liveVersion || stopped || hushed.uuid === uuid) return;
    const now = editingBox(host().activeElement);
    if (!now || uuidOf(now) !== uuid) return;
    if (!b) { clearLive(); return; }
    if (startTags.uuid !== uuid) Object.assign(startTags, { uuid, own: ownTagsAtStart(b, ctx) });
    const { record, pieces, skip, assume } = piecesFor(b, text, ctx, startTags.own);
    state.times.push(Math.round(performance.now() - t0)); if (state.times.length > 50) state.times.shift();
    if (!pieces.length) { clearLive(); return; }
    if (state.accepted.uuid !== uuid) state.accepted = { uuid, keys: new Set() };
    state.live = { uuid, text, recordUuid: String(pick(record, 'block/uuid') ?? ''), pieces, skip, own: startTags.own, assume: assume || null, at: Date.now() };
    drawInPlace(box.ownerDocument);
  } catch (error) { warnOnce('the shadow could not be worked out', error); }
}
function onInput(event) {
  const box = editingBox(event.target);
  if (!box) return;
  // Typing in the bullet again ends Escape's clearing (0.4.292, the owner: "what is usually normal": a dismissed
  // suggestion comes back with the next letter typed, as in any editor's suggestions); before, it lasted until the
  // bullet was left.
  if (hushed.uuid === uuidOf(box)) hushed.uuid = '';
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => compute(box), 40);
}
function onFocusIn(event) {
  const box = editingBox(event.target);
  if (box) startTags.uuid = '';
  // Editing a bullet again ends the undo of what was filled in on it (0.4.218): the icon goes.
  if (box) forgetUndo(uuidOf(box));
  if (box) { clearTimeout(liveTimer); liveTimer = setTimeout(() => compute(box), 40); }
}
// The bullet left: the shadow is taken, once Logseq has saved the words (a link typed a moment ago is in the saved
// title only after that).
// What was taken is read at once: leaving with Enter or the arrows puts the next bullet in edit, and its shadow can
// replace this one before the wait is over (second reading).
function onFocusOut(event) {
  const box = editingBox(event.target);
  if (!box) return;
  const uuid = uuidOf(box);
  // Leaving a bullet whose proposals Escape cleared: they come back the next time it is edited.
  // Leaving a bullet Escape cleared: nothing is taken (decided now, not by which timer runs first), and the clearing
  // ends once the bullet is really left.
  if (hushed.uuid === uuid) { liveVersion++; later(() => { const now = editingBox(host().activeElement); if (!(now && uuidOf(now) === uuid) && picking.uuid !== uuid && picking.returning !== uuid) hushed.uuid = ''; }, 120); return; }
  // Into a property's list with Option-Enter, or coming back from it: the proposals wait for the words.
  if (picking.uuid === uuid || picking.returning === uuid) return;
  if (!state.live || state.live.uuid !== uuid) { if (state.accepted.uuid === uuid) noneAccepted(); return; }
  // Enter's taking counts only when the bullet is left right after it: an Enter that kept the bullet in edit (at the
  // very start of its words, or in document mode) must not let a later click away fill in guesses (second reading).
  // What Enter took is read now: the next bullet's proposals can come before the wait below is over. It counts only
  // when the bullet is left right after it: an Enter that kept the bullet in edit (at the very start of its words)
  // must not let a later click away fill in guesses (second reading).
  const live = state.live, taken = Date.now() - (state.accepted.at || 0) < ENTER_LEAVES ? new Set(acceptedIn(uuid)) : new Set();
  // A check still running for this bullet is dropped now: the bullet is being left (it would draw on it afterwards).
  liveVersion++;
  later(() => {
    const active = host().activeElement, now = editingBox(active);
    if (now && uuidOf(now) === live.uuid) return;
    if (live.left) return;
    // Into the bullet's own properties (Logseq's Down from the words, then Left/Right, Enter): not leaving it. The
    // proposals stay shown and wait (0.4.208, at the owner's word).
    if (inOwnProperties(active, live.recordUuid)) return visitProperties(live);
    leave(live, taken);
  }, 120);
}
/* Moving about the bullet's own properties with Logseq's keys (Down from the end of the words goes into its capsules;
   Left and Right move between them; Enter opens one; Up goes back to the words): the proposals stay shown while you
   are there, and are dealt with when the bullet is really left: back in the words, as usual; anywhere else (a click
   away), what is sure is filled in, as leaving the words does. */
function inOwnProperties(el, rowUuid) {
  if (!el?.closest || !rowUuid) return false;
  if (el.closest('.cp__select')) return true; // a list Logseq opened from one of them
  const place = el.closest('.bottom-property-pill, .property-pair, .bottom-properties-row, .positioned-properties');
  return !!place && [...el.ownerDocument.querySelectorAll(`.ls-block[blockid="${rowUuid}"]`)].some(row => ownRow(row)(place));
}
const visiting = state.visiting = { live: null, timer: 0, out: 0 };
// The bullet visited is left: what is sure is filled in, as leaving the words does.
function leaveVisited(live) { leave(live); }
function visitProperties(live) {
  // A visit still going for another bullet ends as leaving it (second reading: it was dropped unfilled).
  if (visiting.live && visiting.live !== live) leaveVisited(visiting.live);
  clearInterval(visiting.timer);
  Object.assign(visiting, { live, out: 0 });
  visiting.timer = setInterval(() => {
    const active = host().activeElement, box = editingBox(active);
    // Another bullet's proposals coming up does not end this visit unfilled (second reading): only leaving does.
    if (live.left) return stopVisiting();
    if (box && uuidOf(box) === live.uuid) return stopVisiting(); // back in the words: they take it from here
    if (inOwnProperties(active, live.recordUuid) || picking.rowUuid === live.recordUuid) { visiting.out = 0; return; }
    if (++visiting.out < 2) return; // a moment on nothing, as a list closes, is not leaving
    stopVisiting();
    leaveVisited(live);
  }, 150);
}
function stopVisiting() { clearInterval(visiting.timer); Object.assign(visiting, { live: null, timer: 0, out: 0 }); }

// Escape clears the proposals until something is typed in the bullet again (0.4.292); the caret stays (a second Escape is Logseq's).
// Enter (plain, with no list of Logseq's open) takes the guesses too: the bullet is then left as usual, and everything
// shown is filled in (the owner: "enter confirms I like things"; 0.4.202, and again 0.4.219). Leaving any other way
// takes the sure values only. Nothing of Enter is held back: Logseq still makes the next bullet. To check a guess
// first, Option-Enter stops on it (0.4.219).
function onKey(event) {
  if ((event.key !== 'Escape' && event.key !== 'Enter') || event.isComposing || !state.live) return;
  const box = editingBox(event.target);
  if (!box || uuidOf(box) !== state.live.uuid) return;
  if (box.ownerDocument.querySelector('#ui__ac, .absolute-modal, [data-editor-popup-ref]')) return;
  if (event.key === 'Enter') {
    if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
    state.accepted = { uuid: state.live.uuid, at: Date.now(), keys: shownGuesses(state.live) };
    return;
  }
  event.preventDefault(); event.stopImmediatePropagation();
  dismiss(state.live.uuid);
  state.live = null;
  noneAccepted();
  hide();
}
// Cmd-Option-Enter (0.4.259, the owner: "instead of ctrl enter … make it cmd-opt-enter"; Ctrl-Enter from 0.4.242,
// "accepting … with enter and modifier that doesn't create new bullet"; a command in the one register since 0.4.315,
// its keys in the setting shadowAcceptKeys): everything shown is accepted, as with Enter, and the bullet is simply
// left, with no new bullet made. True when taken.
function acceptAllKey(event) {
  if (event.isComposing || !state.live) return false;
  const box = editingBox(event.target);
  if (!box || uuidOf(box) !== state.live.uuid) return false;
  if (box.ownerDocument.querySelector('#ui__ac, .absolute-modal, [data-editor-popup-ref]')) return false;
  state.accepted = { uuid: state.live.uuid, at: Date.now(), keys: shownGuesses(state.live) };
  Promise.resolve(model.exitEditing()).catch(error => warnOnce('the bullet could not be left', error));
  return true;
}
// A press on a proposed value does nothing (0.4.202: no click to confirm; Enter does): Logseq never hears of it, so
// its value editor does not open under the value, and the mouse press is held back so the bullet stays in edit. The
// pointer press is not held back: that would stop the mouse press, and its holding back, from coming at all.
// Since 0.4.242 a click on one accepts it (the owner: going back into an old bullet, "I don't want to have to hit
// enter to just accept since I would create a new bullet"): it turns solid and is filled in, guess or not, when the
// bullet is left; a second click takes the acceptance back. On a page's own properties a click fills it at once.
function onGuessPress(event) {
  const el = event.target?.closest?.('.rfs-ghost');
  if (!el) return;
  event.stopImmediatePropagation();
  if (event.type !== 'pointerdown') event.preventDefault();
  if (event.type !== 'click') return;
  if (el.classList.contains('rfs-page-ghost')) { fillPage(el.dataset.rfsKey); return; }
  const live = state.live, key = el.dataset.rfsKey;
  if (!live || !live.pieces.some(piece => guessKey(piece) === key)) return;
  live.clicked ||= new Set();
  if (live.clicked.has(key)) live.clicked.delete(key); else live.clicked.add(key);
  drawInPlace(el.ownerDocument);
}
const linksOut = text => { const bare = String(text || '').replace(TAG, ' '); const found = bare.match(LINK) || []; return { n: found.length, words: plainWords(bare.replace(LINK, ' ')) }; };
const sameWords = (saved, text) => { const a = linksOut(saved), b = linksOut(text); return a.n === b.n && a.words === b.words; };
async function takeShadow(live) {
  if (stopped || live.dismissed || !await allowed()) return;
  const ctx = await withFreshLinks(live.text, await guessDataFor(await daysFor(await contextFor()), { wait: false }));
  let b = null;
  let saved = false;
  for (let tries = 0; tries < 12 && !saved; tries++) {
    b = await pullBlock(live.uuid);
    if (!b) return; // the bullet is gone
    saved = sameWords(pick(b, 'block/title'), live.text);
    if (!saved) await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!saved) return; // the words changed after the shadow was drawn, or never got saved: nothing is written (second reading)
  // A tag typed in the words must be on the bullet as saved: Enter just before a typed tag moves the tag to the next
  // bullet, and this one must not get that tag's properties (second reading).
  const savedTags = new Set((pick(b, 'block/tags') || []).map(idOf));
  if (inWords(live.text, ctx).tags.some(tag => !savedTags.has(tag))) return;
  const { record, pieces: found } = piecesFor(b, live.text, ctx, live.own, live.assume);
  const taken = live.taken || new Set(), shown = live.drawn || new Set();
  const pieces = found.filter(piece => shown.has(guessKey(piece)) && (!piece.guess || taken.has(guessKey(piece))));
  const recordUuid = String(pick(record, 'block/uuid') ?? '');
  if (!pieces.length || !UUID.test(recordUuid) || stopped) return;
  const { written, undo } = await writePieces(recordUuid, pieces, live.uuid);
  if (!written.length) return [];
  rememberUndo(recordUuid, live.uuid, undoText(written), undo);
  return written;
}
const undoText = written => written.map(piece => `${piece.prop.title}: ${piece.shown}${piece.tagPage ? ` (tagged #${piece.tagPage.tag.title})` : ''}`).join(' · ');
// Writing what was proposed, for a bullet left or a page's value clicked; and the undo of it.
async function writePieces(recordUuid, pieces, bulletUuid) {
  const written = [];
  for (const piece of pieces) {
    const tagged = [];
    // A value that rests on a proposed tag (stage D) is written only once the bullet has the tag.
    if (piece.needsTag && !written.some(w => w.kind === 'tag')) continue;
    try {
      if (piece.kind === 'tag') { await model.addTag(recordUuid, piece.tag.uuid); written.push(piece); continue; }
      if (piece.asPage) { if (await takeAsPage(piece, bulletUuid, recordUuid)) written.push(piece); continue; }
      if (piece.tagPage) for (const uuid of piece.tagPage.uuids) { await model.addTag(uuid, piece.tagPage.tag.uuid); tagged.push(uuid); }
      if (piece.kind === 'day') { piece.wrote = [piece.journalId ?? await journalPageFor(piece.day)]; await model.setValue(recordUuid, piece.ident, piece.wrote[0]); }
      else if (piece.kind === 'number') await model.setValue(recordUuid, piece.ident, piece.ids[0]);
      else if (piece.prop.many) await model.setValue(recordUuid, piece.ident, piece.ids, { entityId: true, reset: true });
      else await model.setValue(recordUuid, piece.ident, piece.ids[0], { entityId: true });
      piece.wrote ||= piece.ids;
      written.push(piece);
    } catch (error) {
      // The tag a page was given for this fill goes again when the fill fails.
      for (const uuid of tagged) await model.removeTag(uuid, piece.tagPage.tag.uuid).catch(() => {});
      warnOnce(`${piece.prop.title} could not be filled in`, error); notify(`${piece.prop.title} could not be filled in`, 'warning');
    }
  }
  // Undo takes off only what is still as it was filled in: a value chosen by hand since is the owner's, and stays. Every
  // step is tried even when one fails, and a failure is reported at the end (the code review, 2026-10-21).
  const undo = async () => {
    const failed = [];
    for (const piece of [...written].reverse()) {
      try {
        if (piece.undo) { await piece.undo(); continue; }
        if (piece.kind === 'tag') { await model.removeTag(recordUuid, piece.tag.uuid); continue; }
        if (await stillAsFilled(recordUuid, piece)) await model.unsetValue(recordUuid, piece.ident);
        if (piece.tagPage) for (const uuid of piece.tagPage.uuids) await model.removeTag(uuid, piece.tagPage.tag.uuid);
      } catch (error) { failed.push(error); }
    }
    if (failed.length) throw failed[0];
  };
  return { written, undo };
}

// Whether a property still holds what the fill wrote (Logseq keeps a number as a value of its own: the number in it is
// what is compared).
async function stillAsFilled(recordUuid, piece) {
  if (piece.kind === 'number') {
    const now = await model.numberValues(recordUuid, piece.ident);
    return now.length === 1 && now[0] === Number(piece.ids[0]);
  }
  const now = (await model.valuesOf(recordUuid, piece.ident)).map(Number);
  return sameIds(now, (piece.wrote || piece.ids).map(Number));
}
// The journal page of a day a date in the words names (stage E), made when the graph has none yet, as Logseq would
// (through the model, in the graph's own title format). The page stays after Undo, as an empty journal does.
async function journalPageFor(day) {
  const id = await journalIdFor(day, await journalTitleFor(Math.floor(day / 10000), Math.floor(day / 100) % 100, day % 100));
  if (id == null) throw new Error(`no journal page for ${day}`);
  return id;
}
/* [[Dr. New]]#Doctor taken (0.4.209): the page gets the tag (unless it has it), the record's property gets the page,
   and the tag goes from the bullet, from its words too, so the bullet is not made a doctor. The page is found among
   what the bullet links to, by its name: one made a moment ago is not in the page list yet. Whatever was done is put
   back when a step fails, and by Undo (piece.undo). */
async function takeAsPage(piece, bulletUuid, recordUuid) {
  const done = [];
  const undo = async () => { for (const step of [...done].reverse()) await step().catch(error => warnOnce('a step could not be undone', error)); };
  const titleNow = () => model.titleNow(bulletUuid);
  const linked = await model.linkedPages(bulletUuid);
  const pairs = piece.asPage.map(x => ({ x, page: linked.get(x.key) }));
  const before = await titleNow();
  // The saved words must still have each tag right after its page: Enter between them sends the tag to the next
  // bullet, and nothing is moved then (second reading).
  if (before == null || pairs.some(pair => !pair.page || !pageTagIn(before, pair.page, pair.x.tag))) return false;
  try {
    for (const { x, page } of pairs) {
      if (await model.hasTag(page.uuid, x.tag.uuid)) continue;
      await model.addTag(page.uuid, x.tag.uuid);
      done.push(() => model.removeTag(page.uuid, x.tag.uuid));
    }
    const ids = pairs.map(pair => pair.page.id);
    if (piece.prop.many) await model.setValue(recordUuid, piece.ident, ids, { entityId: true, reset: true });
    else await model.setValue(recordUuid, piece.ident, ids[0], { entityId: true });
    done.push(() => model.unsetValue(recordUuid, piece.ident));
    const removed = pairs.map(({ x, page }) => ({ page, text: pageTagIn(before, page, x.tag).text }));
    const after = pairs.reduce((title, { x, page }) => withoutPageTag(title, page, x.tag), before);
    // The words read again just before they are changed: words written meanwhile are never lost (the code review,
    // 2026-10-21); then the fill is put back and nothing is taken.
    if (await titleNow() !== before) { await undo(); return false; }
    await model.setWords(bulletUuid, after);
    // Undo puts the words back as they were, or, when they were written on meanwhile, only the tags after their pages
    // (second reading: the whole old words would have lost what was written since).
    done.push(async () => {
      const now = await titleNow();
      if (now == null) return;
      await model.setWords(bulletUuid, now === after ? before : removed.reduce((title, r) => withPageTag(title, r.page, r.text), now));
    });
    for (const tag of new Set(pairs.map(pair => pair.x.tag))) {
      await model.removeTag(bulletUuid, tag.uuid);
      done.push(() => model.addTag(bulletUuid, tag.uuid));
    }
    piece.undo = undo;
    return true;
  } catch (error) { await undo(); throw error; }
}

/* Drawing (0.4.201, at the owner's word: "all that is necessary is the name to appear in dotted line where it would
   be"): each proposed value is written faintly into the record's own property, where Logseq shows the empty value,
   and nothing else: no line of its own, no keys. Values are italic grey; a guess has a dotted underline as well and
   is filled in only when the bullet is left with Enter (0.4.202). A property Logseq
   shows no pill for gets one made for the value, in the record's own pill row (made too when there is none), as the
   resting proposals part did (0.4.122). Drawn again on the foundation's early pass, so Logseq's redraw of the row
   cannot lose it; only the plugin's own elements are added, and they go with the proposal. */
const pillName = pill => (pill.firstElementChild?.textContent || '').trim().replace(/:$/, '').toLowerCase();
const ownRow = row => el => el.closest('.ls-block[blockid]') === row;
const pillsOf = row => [...row.querySelectorAll('.positioned-properties.block-below .bottom-property-pill')].filter(ownRow(row));
// A pill for a property Logseq shows none for, in the record's own pill row; the row is made too when there is none.
// Logseq's shape (read 2026-10-18): block-main-container > div.flex-col > div.flex-col > [the content, positioned-properties.block-below > bottom-properties-row > pills].
function makePill(doc, row, piece) {
  const main = [...row.querySelectorAll('.block-main-container')].find(ownRow(row));
  if (!main) return null;
  let rowEl = [...main.querySelectorAll('.positioned-properties.block-below')].find(ownRow(row));
  if (!rowEl) {
    const inner = [...main.querySelectorAll(':scope > .flex-col > .flex-col')].find(ownRow(row)) || main.querySelector(':scope > .flex-col') || main;
    rowEl = doc.createElement('div');
    rowEl.className = 'positioned-properties block-below flex flex-col gap-1 text-sm rfs-made';
    rowEl.innerHTML = '<div class="bottom-properties-row"></div>';
    inner.appendChild(rowEl);
  }
  const pill = doc.createElement('div');
  pill.className = 'bottom-property-pill rfs-made rfs-made-pill';
  pill.setAttribute('contenteditable', 'false');
  pill.innerHTML = `<span class="rfs-made-name">${esc(piece.prop.title)}:</span><span class="bottom-property-content"></span>`;
  (rowEl.querySelector('.bottom-properties-row') || rowEl).appendChild(pill);
  return pill;
}
/* Undo (0.4.218, at the owner's word: the bar at the bottom was "loud and too far down and distracting"): a faded
   arrow at the end of the line of the bullet the values were filled in on, saying what it takes off when pointed at.
   A click takes them off. It stays until that bullet is edited again or the page is left, so it never times out
   while you look elsewhere; each filled bullet keeps its own. Since 0.4.258 it is the plugin's one Undo
   (shared.undo, parts/shared.js), which every part now uses; here only where it sits and when it is forgotten. */
const undoKey = uuid => 'proposals:' + uuid;
const bulletLines = uuid => [...host().querySelectorAll(`.ls-block[blockid="${uuid}"]`)].map(row => [...row.querySelectorAll('.block-title-wrap')].find(ownRow(row))).filter(Boolean);
function rememberUndo(recordUuid, bulletUuid, text, undo) {
  // A second fill on the same bullet adds to its undo: one arrow takes both back, the later first (shared.undo does it).
  shared.undo.offer({ key: undoKey(recordUuid), at: () => bulletLines(recordUuid), text, run: undo, cls: 'rfs-undo', data: { record: recordUuid, bullet: bulletUuid },
    onFail: error => { warnOnce('the filled-in values could not be taken off again', error); notify('The values could not be taken off again', 'warning'); } });
}
function forgetUndo(uuid) { shared.undo.forget(entry => entry.key.startsWith('proposals:') && (entry.data?.record === uuid || entry.data?.bullet === uuid)); }
// The proposals' own arrows, for the checks (tools/shadow-write-test.js): how many, and forgetting them all.
const ownUndos = { get size() { return shared.undo.keys().filter(key => key.startsWith('proposals:')).length; }, clear: () => shared.undo.forget(entry => entry.key.startsWith('proposals:')) };
// What one value looks like and says when pointed at; the page that gets a tag is named only there.
/* Why (0.4.266, layer 2 item 8, "why a guess was made, on hover"): pointing at a value says where it came from, and for
   a guess from the bullets this one looks like, the two nearest of them: "Earlier bullets like this one had Planned:
   “CT scan on Tuesday.”, “Colonoscopy on Friday”". Then what Enter does, as before. */
const REASONS = {
  alike: piece => `Earlier bullets like this one had ${piece.shown}`, 'alike-tag': () => 'Earlier lines like this one have this tag',
  words: () => 'Named in your words', parent: () => 'The bullet above has it', day: () => 'The day this is written on', 'guess-day': () => 'The day this is written on; change it if it happens another day',
  'words-day': () => 'A day named in your words', 'words-number': piece => `The number beside “${piece.prop.title.toLowerCase()}” in your words`,
  untagged: () => 'A page linked in your words that has no tag yet; taking it gives the page the tag too',
  linked: () => 'A page linked in your words', 'linked-wide': () => 'A page linked in your words', page: () => 'The page this is written on',
  'page-tag': () => 'The page this is written on', 'page-wide': () => 'The page this is written on',
};
function reasonOf(piece) {
  const parts = String(piece.how || '').split('+').map(how => REASONS[how]?.(piece)).filter(Boolean);
  const from = piece.from?.length ? `: ${piece.from.map(t => `“${t.length > 70 ? t.slice(0, 69) + '…' : t}”`).join(', ')}` : '';
  return parts.length ? parts.join('; ') + from : '';
}
function ghostLook(piece) {
  const what = piece.kind === 'tag' ? 'A guess: Enter gives the bullet this tag and fills in the rest'
    : piece.guess ? 'A guess: Enter fills it in with the rest; Option-Enter stops on it to check' : 'Filled in when you leave the bullet';
  const why = reasonOf(piece);
  // Sure or guessed, one look (0.4.315, the owner: "they are essentially the same thing"); rfs-guess still says which for the keys.
  return { cls: `rfs-ghost${piece.guess ? ' rfs-guess' : ''}`, title: why ? `${why}.\n${what}` : what };
}
// What a proposed value shows: its words; a tag as a class, its name in mono with no # (the grammar, docs/LAYERS.md);
// a page that would get a tag says so after its name ("Hannah Reyes Doctor", the tag in mono).
function fillGhost(g, piece) {
  const doc = g.ownerDocument;
  const words = piece.kind === 'tag' ? '' : piece.shown, tagTitle = piece.kind === 'tag' ? piece.tag?.title || String(piece.shown).replace(/^#/, '') : piece.tagPage?.tag.title || '';
  const same = g.dataset.rfsWords === words && g.dataset.rfsTag === tagTitle;
  if (same) return;
  g.dataset.rfsWords = words; g.dataset.rfsTag = tagTitle;
  g.replaceChildren(...[words ? doc.createTextNode(words) : null, words && tagTitle ? doc.createTextNode(' ') : null, tagTitle ? tagWord(doc, tagTitle, { class: 'rf-tag rfs-ghost-tag', plain: true }) : null].filter(Boolean));
}
// The names of the properties Logseq itself shows filled on a row: a proposal for one of them is over.
const filledNames = row => new Set(pillsOf(row).filter(p => !p.classList.contains('rfs-made') && !(p.querySelector('.bottom-property-content') || p).querySelector('.empty-value')).map(pillName));
// The names of the properties Logseq itself shows on a row, filled or empty: a pill the plugin made for one of them
// gives way to Logseq's (0.4.284; seen: Enter in Option-Enter's list made Logseq draw its own row of capsules under
// the plugin's made row, with Topic in both, and the words below moved down a line).
const ownNames = row => new Set(pillsOf(row).filter(p => !p.classList.contains('rfs-made')).map(pillName));
function drawInPlace(doc = host()) {
  const live = state.live;
  // What to draw: the bullet being written, and the bullets left a moment ago whose values are being filled in
  // (0.4.283), each with its rows on screen and the pieces wanted, by property.
  const jobs = [];
  for (const job of [...(live?.recordUuid ? [{ recordUuid: live.recordUuid, pieces: live.pieces, live }] : []), ...fillingJobs().filter(job => job.recordUuid !== live?.recordUuid)]) {
    const rows = [...doc.querySelectorAll(`.ls-block[blockid="${job.recordUuid}"]`)];
    const want = new Map();
    for (const piece of job.pieces) want.set(piece.ident, piece);
    jobs.push({ ...job, rows, want });
  }
  // Out with what is no longer proposed (another bullet, a value changed, the bullet left and its values written).
  for (const g of doc.querySelectorAll('.rfs-ghost:not(.rfs-page-ghost)')) {
    const row = g.closest('.ls-block[blockid]'), job = jobs.find(job => job.rows.includes(row)), piece = job?.want.get(g.dataset.rfsIdent);
    const filled = !g.closest('.rfs-made') ? !g.parentElement?.querySelector('.empty-value') : piece && ownNames(row).has(piece.prop.lower);
    if (piece && !filled && g.dataset.rfsKey === guessKey(piece)) continue;
    g.closest('[data-refinement-proposal]')?.removeAttribute('data-refinement-proposal');
    g.remove();
  }
  for (const el of doc.querySelectorAll('.rfs-made-pill')) if (!el.querySelector('.rfs-ghost')) el.remove();
  for (const el of doc.querySelectorAll('.positioned-properties.rfs-made')) if (!el.querySelector('.bottom-property-pill')) el.remove();
  for (const job of jobs) for (const row of job.rows) {
    const pills = pillsOf(row), filled = filledNames(row);
    for (const piece of job.want.values()) {
      // Filled meanwhile in Logseq's own way (from the properties, or the write under way): the proposal for it goes.
      if (filled.has(piece.prop.lower)) continue;
      // Logseq's own pill first, then one the plugin made earlier, else one made now.
      const pill = pills.find(p => pillName(p) === piece.prop.lower && !p.classList.contains('rfs-made')) || pills.find(p => pillName(p) === piece.prop.lower) || makePill(doc, row, piece);
      const target = pill && (pill.querySelector('.bottom-property-content') || pill);
      if (!target) continue;
      const look = ghostLook(piece);
      let g = [...target.querySelectorAll(':scope > .rfs-ghost')].find(el => el.dataset.rfsIdent === piece.ident);
      if (!g) {
        g = doc.createElement('span');
        g.setAttribute('contenteditable', 'false');
        g.dataset.rfsIdent = piece.ident;
        g.dataset.rfsKey = guessKey(piece);
        if (piece.guess) g.dataset.guess = guessKey(piece);
        target.appendChild(g);
      }
      // A page that would get a tag says so where it shows ("Hannah Reyes Doctor", the tag in mono; the owner, 0.4.202–0.4.203).
      fillGhost(g, piece);
      // Taken (clicked, or the bullet left and this value on its way): solid, as it will be.
      const taken = job.live ? job.live.clicked?.has(guessKey(piece)) : true;
      const cls = look.cls + (taken ? ' rfs-taken' : '');
      if (g.className !== cls) g.className = cls;
      const title = job.live ? look.title : 'Being filled in';
      if (g.title !== title) g.title = title;
      if (!pill.hasAttribute('data-refinement-proposal')) pill.setAttribute('data-refinement-proposal', '');
      if (job.live) (job.live.drawn ||= new Set()).add(guessKey(piece));
    }
  }
  // A pill marked with nothing of ours left in it (a copy cut short) is given back to Logseq (second reading).
  for (const pill of doc.querySelectorAll('[data-refinement-proposal]:not(.property-pair)')) if (!pill.querySelector('.rfs-ghost')) pill.removeAttribute('data-refinement-proposal');
  shared.undo.draw();
}
function hide() { drawInPlace(); }
const drawEarly = (doc, records) => { pageEarly(doc); if (!state.live && !state.filling.size && !state.undos.size && !doc.querySelector('.rfs-ghost, .rfs-made, .rfs-undo, [data-refinement-proposal]')) return; if (records.some(r => r.type === 'childList' && ![...r.addedNodes, ...r.removedNodes].every(n => n.nodeType === 1 && n.matches?.('.rfs-ghost, .rfs-made, .rfs-undo')))) drawInPlace(doc); };

const css = `
/* A proposed value (0.4.202): italic grey with a dotted line under it, in the record's own property where the value
   goes, sure or guessed alike (0.4.315, the owner: "underline them both with a dotted line, they are essentially the
   same thing, keep them both italic"). The kit's greys (parts/shared.js). A proposed tag reads in mono with no #. */
.ls-block .positioned-properties.block-below .bottom-property-pill[data-refinement-proposal] { display: flex !important; opacity: 1 !important; }
.bottom-property-pill[data-refinement-proposal] .empty-value { display: none !important; }
/* A guessed property Option-Enter has opened (0.4.219): Logseq's own empty value is back, for its list to sit under,
   and the guess steps aside; it is typed into the list instead. */
.bottom-property-pill[data-refinement-proposal][data-rfs-at] .empty-value { display: revert !important; }
.bottom-property-pill[data-rfs-at] .rfs-ghost { display: none; }
/* A proposal comes in with a short fade, not a pop (0.4.283; @starting-style, Chromium 117+, Logseq 2.0.2 runs on 148). */
.rfs-ghost { color: var(--rf-faint); font-style: italic; white-space: nowrap; opacity: 1; transition: opacity .15s ease, color .15s ease; text-decoration: underline dotted; text-decoration-thickness: 1px; text-underline-offset: 3px; }
@starting-style { .rfs-ghost { opacity: 0; } }
.rfs-ghost .rfs-ghost-tag { opacity: 1; border-bottom: 0; color: inherit; }
/* No ring of the plugin's own (2026-10-23, docs/history/FINISHING-PROMPT-2026-10-23.md section 1C): the property Option-Enter or Logseq's
   own Down, Left and Right rest on is shown by Logseq's ring round a focused capsule (kept since 0.4.343, the owner: "I use
   keyboard") and by its own grey on a property row; the plugin's ring (0.4.207, 0.4.270, 0.4.291) said the same again. */
/* A pill row the plugin made (an untagged bullet, 0.4.213): the pills side by side, as Logseq lays out its own. */
.positioned-properties.rfs-made .bottom-properties-row { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 1rem; row-gap: .25rem; }
.rfs-made-pill { display: inline-flex; align-items: baseline; gap: .3em; }
/* The undo arrow (0.4.218): faded, at the end of the bullet's line, a little clearer under the pointer. */
.rfs-made-name { color: var(--rf-faint); }
/* A proposal clicked (0.4.242): solid, not grey, filled in when the bullet is left. */
.rfs-ghost.rfs-taken { color: inherit; font-style: normal; text-decoration: none; }
/* Empty properties hidden until something is proposed (0.4.242), only in the graphs the proposals write in: the class
   is on Logseq's page while that holds. One Option-Enter is on (data-rfs-at), or being typed in, stays. */
html.rfs-hide-empty .ls-block .positioned-properties .bottom-property-pill:has(.empty-value):not([data-refinement-proposal]):not([data-rfs-at]):not(:focus-within):not(.block-main-container:has(textarea) *) { display: none !important; }
/* Not under the bullet being written (0.4.322, the owner saw elements "jump up and down"): its empty properties stay, faint,
   so the line under it appears once, with its tag, and proposals coming and going (or Escape clearing them) change only
   the words in it, never its height. Hidden again once the bullet is left. */
html.rfs-hide-empty .block-main-container:has(textarea) .positioned-properties .bottom-property-pill:has(.empty-value):not([data-refinement-proposal]):not([data-rfs-at]):not(:focus-within) { opacity: .45; }
/* Never on a tag's or a property's page (0.4.260): known at once from Logseq's own Tag Properties row, else when the page is read. */
html.rfs-hide-empty .ls-block-properties .property-pair.property-panel-row-empty:not([data-refinement-proposal]):not(:has([data-rfs-at])):not(:focus-within) { display: none !important; }
/* A page's own empty properties stay, faint (0.4.333, measured with the tour: on Leucovorin, Side Effects came up with
   its proposal 0.8 s after the page, pushing everything under it down a row); a tag's or property's page keeps them as
   they are (0.4.260). */
html.rfs-hide-empty .ls-page-properties .property-pair.property-panel-row-empty:not([data-refinement-proposal]):not(:has([data-rfs-at])):not(:focus-within):not(.ls-page-properties:is([data-rfs-keep-empty], :has([data-property-title="Tag Properties"], [data-property-title="Extends"])) *) { opacity: .45; }
/* A page's own empty property with a proposal (0.4.239): the grey value before Logseq's dashed mark, which is hidden
   but still opens Logseq's list beside it. */
.ls-page-properties .property-pair[data-refinement-proposal] .empty-value .ui__icon { visibility: hidden; }
.rfs-page-ghost { cursor: pointer; align-self: center; margin-left: 3px; margin-right: .5em; }
.rfs-page-ghost:hover { color: var(--rf-quiet); }
`;

function applyStyles() { sendStyle('refinement-shadow', setting('shadowProposals') ? css : ''); applyHide(); }
// Hiding empty properties only where the proposals write: elsewhere nothing would ever bring them back.
let hideVersion = 0;
async function applyHide() {
  const version = ++hideVersion;
  const on = !stopped && setting('shadowProposals') && setting('shadowHideEmpty') && await allowed().catch(() => false);
  if (version === hideVersion) host().documentElement.classList.toggle('rfs-hide-empty', !!on);
}
// Option-Enter (parts/shadow-steps.js) and a page's own properties (parts/shadow-page.js) are their own pieces: when
// one is not loaded, these stand in for it and the proposals while writing go on without it (0.4.269).
const SPARE = { picking: {}, endPicking() {}, onPickKey() {}, fillPage() {}, pageEarly() {}, pageLive: {}, schedulePage() {}, setPage() {} };
function start() {
  // The rules (parts/shadow-rules.js) are what this piece shows; without them it stays off and says so.
  if (!P.piecesFor) { warnOnce('the rules, parts/shadow-rules.js, are not loaded, so the proposals are off'); return; }
  // The pieces of the proposals (0.4.268): each takes what it uses, then this one takes theirs.
  for (const link of P.links) link(window.refinementCore);
  ({ contextFor, daysFor, guessDataFor, ownTagsAtStart, piecesFor, pullBlock, withFreshLinks, LINK, TAG, inWords, pageTagIn, plainWords, sameIds, untagged, withPageTag, withoutPageTag, addHistory, freeWords, guessCache, learnSoon, namedIn, namesFor, pickerOrder, wordsEarned, picking, endPicking, onPickKey, fillPage, pageEarly, pageLive, schedulePage, setPage } = { ...SPARE, ...P });
  ({ UUID, propSchema, propPages, bare, pick, idOf, sendStyle, titleOf, watchDomEarly, alike, parseDay, dayAfter, dayNumber, journalIdFor, journalTitleFor, onPageChange, onGraphChange, onDatabaseChange, onSettingsChange } = take(window.refinementCore, ['UUID', 'propSchema', 'propPages', 'bare', 'pick', 'idOf', 'sendStyle', 'titleOf', 'watchDomEarly', 'alike', 'parseDay', 'dayAfter', 'dayNumber', 'journalIdFor', 'journalTitleFor', 'onPageChange', 'onGraphChange', 'onDatabaseChange', 'onSettingsChange', 'setValue', 'unsetValue', 'addTag', 'removeTag', 'setWords', 'exitEditing', 'blockInEdit', 'pagesNamed', 'userTagIds', 'taggedNodes', 'aliasPairs', 'plainLines', 'journalDays', 'datedByTag', 'valueTitle', 'numberValues', 'valuesOf', 'titleNow', 'linkedPages', 'hasTag', 'pageLines']));
  model = window.refinementCore.provided; // the graph is read through the model (0.4.226)
  void titleOf;
  applyStyles();
  forgetOld();
  const win = host().defaultView;
  listen(win, ['input'], onInput);
  listen(win, ['focusin'], onFocusIn);
  listen(win, ['focusout'], onFocusOut);
  listen(win, ['keydown'], onPickKey);
  listen(win, ['keydown'], onKey);
  listen(win, ['pointerdown', 'mousedown', 'mouseup', 'click'], onGuessPress);
  // Leaving the page ends every undo (0.4.218): the arrows belong to what was just written. The page, graph, database
  // and settings changes come from the core (0.4.315), which listens to Logseq once.
  onPageChange(() => { if (stopped) return; state.undos.clear(); schedulePage(); });
  // Another graph: the answer to "may this graph be written in" is not known yet (the audit, 0.4.276: Option-Enter
  // or Down right after a switch started stepping on the old answer), and nothing shown belongs to the new one.
  onGraphChange(() => { if (stopped) return; state.allowedNow = false; clearLive(); applyHide(); });
  watchDomEarly(drawEarly);
  onDatabaseChange(blocks => { if (stopped) return; learnSoon(blocks); const box = editingBox(host().activeElement); if (box) { clearTimeout(liveTimer); liveTimer = setTimeout(() => compute(box), 150); } if (pageLive.asked) schedulePage(600); });
  onSettingsChange((now, before) => { if (stopped) return; if (settingsSchema.some(item => now?.[item.key] !== before?.[item.key])) { applyStyles(); clearLive(); schedulePage(); } });
  stopped = false;
  onUnload(() => { stopped = true; liveVersion++; clearTimeout(liveTimer); for (const t of pending) clearTimeout(t); pending.clear(); endPicking(false); stopVisiting(); clearLive(); state.filling.clear(); state.undos.clear(); setPage('', [], null); hideVersion++; host().documentElement.classList.remove('rfs-hide-empty'); });
  schedulePage(300);
  applyHide();
}
Object.assign(P, { later, pending, allowed, editingBox, hushed, leave, shownGuesses, state, uuidOf, ownRow, pillName, pillsOf, ghostLook, guessKey, rememberUndo, undoText, writePieces, setting });
Object.defineProperty(P, 'stopped', { get: () => stopped, configurable: true });
// For tools/shadow-check.js, the tests and tools/pictures.js (read-only): the rules and what the shadow draws, through
// the core (proposalsInner, proposalsState; names on the window before 0.4.315). The rules live in
// parts/shadow-rules.js since 0.4.268, so they are looked up there when used.
const fromRules = name => (...args) => P[name](...args);
const inner = { reasonOf, drawInPlace, css, guessData: () => P.guessCache?.data, get BLOCK_PULL() { return model.BLOCK_PULL; },
  ...Object.fromEntries(['piecesFor', 'namedIn', 'namesFor', 'freeWords', 'wordsEarned', 'withFreshLinks', 'withoutPageTag', 'withPageTag', 'contextFor', 'daysFor', 'guessDataFor', 'addHistory'].map(name => [name, fromRules(name)])) };
const provide = core => core.provide({ proposalsInner: inner, proposalsState: state });
// The keys in the one register (0.4.315): the engine listens for them and reads their setting at each key.
const commands = [
  { key: 'proposals-step', label: 'Proposals: step through the bullet’s properties (Option-Enter)', icon: 'proposals', shortcut: 'shadowStepKeys', places: ['keys'], run: event => !!P.stepKey?.(event) },
  { key: 'proposals-accept-all', label: 'Proposals: accept everything shown, no new bullet', icon: 'proposals', shortcut: 'shadowAcceptKeys', places: ['keys'], run: acceptAllKey },
];
(window.refinementParts ||= []).push({ name: 'proposals', schema: settingsSchema, provide, start, stop: runUnloadTasks, commands });

})();
