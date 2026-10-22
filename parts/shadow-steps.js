/* Loaded by main.js after parts/shadow.js. Kept in its own scope; parts/shadow.js links it when the proposals start. */
(() => {
/* Option-Enter: stepping through a bullet's own properties (split out of parts/shadow.js at 0.4.268, layer 2 item 10, so that each piece of the proposals can be read
   and changed on its own). It moves Logseq's own lists and writes through them.
   The pieces share one object, window.refinementProposals (P): each puts there what the others use, and takes what
   it uses from there when the proposals start (P.links), or at once when the piece that has it is loaded before. */
const shared = window.refinementShared;
const { host, notify, graphNamedIn } = shared;
const { warnOnce, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (proposals): ' });
const P = window.refinementProposals ||= { links: [] };
// This piece works inside the proposals while writing (parts/shadow.js); without them it stays out (0.4.269).
if (!P.state) { warnOnce('parts/shadow.js is not loaded, so Option-Enter is off'); return; }
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };
let model, UUID, propSchema;
const { allowed, editingBox, hushed, later, leave, shownGuesses, state, uuidOf, ownRow, pillName, pillsOf, setting } = P;
P.links.push(core => {
  ({ model, UUID, propSchema } = take(core, ['UUID', 'propSchema']));
  model = core.provided; // the graph is read through the model (0.4.226)
});

/* Option-Enter (0.4.204, at the owner's word: "option enter just goes to the empty property that didn't have anything
   guessed or proposed"): from the words of a bullet, open Logseq's own list for the first of the record's properties
   that is empty and has nothing proposed (the "Set Topic" list a click on its empty value opens). Tab in that list
   goes on to the next such property, Shift-Tab back; past either end, back to the words. Enter or Escape in the list
   (Logseq picks or closes) also comes back to the end of the words, with the proposals still shown; Enter there then
   fills them in as usual. Leaving the list any other way (a click elsewhere) is leaving the bullet: what is sure is
   filled in. Logseq has no key of its own into the properties shown under a bullet (tried on screen: Escape and Down
   go to the next bullet, Cmd+J does nothing), so the plugin presses the empty value's own trigger, as a click does.
   Tab and Shift-Tab go through every property of the bullet, filled or empty (0.4.270, at the owner's word: "Tab and
   Shift-Tab step through every property of the bullet, filled or empty, with the ring showing where you are; Enter
   still goes to the next empty one"): an empty one opens ready to type, as before; on a filled one the ring rests
   and nothing opens, so a value is never changed by passing it; Enter there opens it, Escape goes back to the
   words. Tab works the same from Logseq's own Down into the properties (0.4.208).
   Down at the end of the words goes to the bullet's first property, filled or empty (0.4.271): Logseq's own Down aims
   at the first capsule, and when the plugin hides it (empty, nothing proposed) the keyboard fell out of the bullet,
   which left it and filled in what was sure (seen in the app on Jul 30th). From there it is the same stepping.
   Left and Right on a capsule step as Shift-Tab and Tab do, stopping at either end (0.4.272): Logseq's own Left and
   Right could not reach a capsule the plugin hides (the owner, on a bullet in their own graph: Right never got to an empty property; Tab did). */
const picking = state.picking = { uuid: '', text: '', live: null, rowUuid: '', names: [], stops: new Set(), restEl: null, wasOpen: false, at: -1, keyAt: 0, lastKey: '', timer: 0, moving: 0, tab: 0, returning: '', pickerRoot: null, settle: 0, guesses: null, prefill: '' };
const recordRow = (doc, rowUuid) => [...doc.querySelectorAll(`.ls-block[blockid="${rowUuid}"]`)].find(r => r.offsetParent !== null) || doc.querySelector(`.ls-block[blockid="${rowUuid}"]`);
// An empty value's own trigger, for the kinds whose list, box or picker is followed here: a link, a text (or choice),
// a web address, a number, a date (0.4.215). A checkbox's trigger is the box itself, which a press would tick (second
// reading).
const emptyTrigger = el => el.querySelector(['node', 'default', 'url', 'number', 'date'].map(type => `.empty-value[data-type="${type}"] .jtrigger`).join(', '));
const isDateTrigger = el => el?.closest?.('[data-type]')?.dataset.type === 'date';
// A filled value's own trigger, pressed by Enter while the ring rests on it (0.4.270): the value's, not the name's.
const valueTrigger = el => [...el.querySelectorAll('.jtrigger')].find(t => !t.closest('.property-key-inner'));
// Where the keyboard rests on a filled one: the capsule itself (Logseq gives it a tabindex for its own Left/Right),
// else the value's trigger.
const restTarget = el => el.hasAttribute('tabindex') ? el : valueTrigger(el) || el;
// Logseq's date picker, once it has opened (stage F): the keyboard goes to its text box ("e.g. Next week"), found by
// its placeholder, and the picker is the top-level element the box sits in; the plugin needs no class names for it.
// Without the box (another Logseq), the calendar keeps the keys, and whatever outside the page took the focus counts
// as the picker, so the plugin still moves on when it closes.
function settleInDatePicker(doc) {
  clearInterval(picking.settle);
  const started = Date.now(), main = doc.querySelector('#main-content-container');
  picking.settle = setInterval(() => {
    if (!picking.uuid || Date.now() - started > OPEN_WAIT) { clearInterval(picking.settle); picking.settle = 0; return; }
    const box = [...doc.querySelectorAll('input[placeholder]')].find(el => /^e\.g\./i.test(el.placeholder) && !el.closest('.ls-block'));
    const active = doc.activeElement;
    const root = box ? box.closest('body > *') : active && active !== doc.body && !(main || doc.body).contains(active) ? active.closest('body > *') : null;
    if (!root) return;
    picking.pickerRoot = root;
    // The calendar's day button has the keyboard before the box is drawn (seen 0.4.278: typed words went to the
    // calendar and Enter set today): keep looking for the box while there is time.
    if (!box) return;
    if (active !== box) box.focus();
    clearInterval(picking.settle); picking.settle = 0;
  }, 50);
}
// The record's properties, as Logseq shows them: capsules under the bullet, and rows of their own ("Notes", shown like
// a bullet), by name, in the order they show (0.4.205, at the owner's word: "test this on ... both capsules and bullet
// style"). Capsules the plugin made for a proposal are left out.
function propertyPlaces(row) {
  if (!row) return [];
  const own = ownRow(row);
  const capsules = pillsOf(row).filter(p => !p.classList.contains('rfs-made')).map(el => ({ el, name: pillName(el) }));
  const rows = [...row.querySelectorAll('.ls-block-properties .property-pair[data-property-title]')].filter(own)
    .map(el => ({ el, name: String(el.getAttribute('data-property-title')).toLowerCase() }));
  return [...capsules, ...rows].sort((a, b) => a.el.compareDocumentPosition(b.el) & 4 ? -1 : 1);
}
// The record's properties that are empty and have nothing proposed, by name: taken once, at Option-Enter, since the
// proposals may go from the screen while a list is open (found by the pretend check). Properties only a page's tag
// gives the bullet ([[Dr. New]]#Doctor shows Doctor's) are not the bullet's to fill.
// Since 0.4.219 a property holding a guess is a stop too (the owner: "can't i just fix it with option-enter"): only
// what the plugin is sure of is passed over.
function emptyNames(doc, rowUuid) {
  const live = state.live?.recordUuid === rowUuid ? state.live : null;
  const sure = new Set([...(live?.pieces || []).filter(piece => !piece.guess).map(piece => piece.prop.lower), ...live?.skip || []]);
  return propertyPlaces(recordRow(doc, rowUuid)).filter(({ el, name }) => !sure.has(name) && !el.querySelector('.rfs-ghost:not(.rfs-guess)') && emptyTrigger(el)).map(p => p.name);
}
// The guess shown for each stop, by name, taken when Option-Enter starts: its words are typed into Logseq's list when
// that stop opens, so Enter keeps the guess and typing puts something else (one value only; a guess of several is
// left for the list to show as it is).
function guessesAt(rowUuid) {
  const live = state.live?.recordUuid === rowUuid ? state.live : null;
  return new Map((live?.pieces || []).filter(piece => piece.guess && piece.kind !== 'tag' && piece.ids.length === 1 && !piece.asPage && !piece.tagPage).map(piece => [piece.prop.lower, piece.shown]));
}
// Types words into the box Logseq opened, as typing would (its boxes listen for input), and selects them, so the
// next key typed replaces them.
function typeInto(box, words) {
  const win = box.ownerDocument.defaultView, proto = box.matches('textarea') ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(box, words);
  box.dispatchEvent(new win.Event('input', { bubbles: true }));
  box.select?.();
}
// The i-th of the bullet's properties, or the next one going by step: with Tab (any) every property, with its trigger
// when it is empty; with Enter only the empty ones Option-Enter stops at (one filled meanwhile is passed over).
function placeAt(doc, i, step, any) {
  const places = propertyPlaces(recordRow(doc, picking.rowUuid));
  for (; i >= 0 && i < picking.names.length; i += step) {
    const name = picking.names[i], place = places.find(p => p.name === name);
    if (!place) continue;
    const trigger = emptyTrigger(place.el);
    if (any || (trigger && picking.stops.has(name))) return { i, place, trigger };
  }
  return null;
}
// Presses a trigger as the mouse does: Logseq opens its list on the press, not on a click alone (found in the app).
function press(el) {
  const win = el.ownerDocument.defaultView;
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
    el.dispatchEvent(new (type.startsWith('pointer') && win.PointerEvent ? win.PointerEvent : win.MouseEvent)(type, { bubbles: true, cancelable: true, button: 0, buttons: type.endsWith('down') ? 1 : 0, pointerType: 'mouse', isPrimary: true }));
}
// In what a property's value opened: Logseq's list ("Set Topic"), or the box of a text or number value, which Logseq
// opens inside the record's own properties. Nothing else counts (second reading: any input counted before, so the
// search box kept the keys here).
function inPicker(el) {
  if (!el?.closest) return false;
  if (el.closest('.cp__select')) return true;
  if (picking.pickerRoot && picking.pickerRoot.contains(el)) return true; // Logseq's date picker (stage F)
  // A text box inside the record's own drawing, other than the bullet's words (found in the app: a text value's box
  // sits in a block of its own there, so matching it by Logseq's class names missed it).
  if (!picking.rowUuid || !el.matches('input, textarea, [contenteditable="true"]') || ownWords(el)) return false;
  // Only inside one of the record's own property places: a child bullet inside the record is not (second reading).
  const place = el.closest('.property-pair, .bottom-property-pill');
  return !!place && [...el.ownerDocument.querySelectorAll(`.ls-block[blockid="${picking.rowUuid}"]`)].some(row => ownRow(row)(place));
}
// The bullet's own words: Logseq names the box it edits a block in "edit-block-<its id>" (read in the app); a value's
// box inside the bullet's properties is another block's and has another id.
const ownWords = el => !!el && el.matches?.('textarea') && (el.id ? el.id === `edit-block-${picking.uuid}` : uuidOf(el) === picking.uuid);
const OPEN_WAIT = 600, SLOW_OPEN = 4000, KEY_CLOSES = 400;
// A text value's box makes the value as soon as it opens (seen in the app: Tab past an untouched Notes left an empty
// Notes on the bullet). Moving on from one left blank takes that empty value off again, so passing through a property
// leaves nothing behind.
function leaveBlank(rowUuid, name) {
  if (!rowUuid || !name) return;
  later(async () => {
    try {
      if (!await allowed()) return; // writes only in the graphs named in the setting (the code review, 2026-10-21)
      const schema = await propSchema();
      const prop = schema?.props.find(p => p.lower === name && (p.type === 'default' || p.type === 'url'));
      if (!prop || !UUID.test(rowUuid)) return;
      if (await model.valueTitle(rowUuid, prop.ident) === '') await logseq.Editor.removeBlockProperty(rowUuid, prop.ident);
    } catch (error) { warnOnce('an empty value could not be taken off again', error); }
  }, 300);
}
const passOn = () => { if (picking.at >= 0) leaveBlank(picking.rowUuid, picking.names[picking.at]); };
// The property being filled in carries Logseq's own kind of focus ring, so it is clear where you are (0.4.207).
function markAt(doc, el) {
  // On a row of its own the ring goes round the property's name: the row's own box draws no outline (seen in the app).
  if (el?.matches?.('.property-pair')) el = el.querySelector('.property-key-inner') || el;
  for (const old of doc.querySelectorAll('[data-rfs-at]')) if (old !== el) old.removeAttribute('data-rfs-at');
  if (el && !el.hasAttribute('data-rfs-at')) el.setAttribute('data-rfs-at', '');
}
// Opens the i-th remembered property (with Tab, any: a filled one only gets the ring). Past the end going forward
// (Enter): the bullet is done, as Enter in the words does it (the owner: "enter should go to next bullet on last
// enter"); past either end with Tab: back to the words.
function openAt(doc, i, step = 1, pastEnd = backToWords, any = false) {
  passOn();
  const found = placeAt(doc, i, step, any);
  if (!found) return pastEnd();
  Object.assign(picking, { at: found.i, keyAt: 0, lastKey: '', pickerRoot: null, wasOpen: false, restEl: null, prefill: '' });
  markAt(doc, found.place.el);
  if (!found.trigger) return rest(found.place.el);
  picking.moving = Date.now();
  picking.prefill = picking.guesses?.get(picking.names[found.i]) || '';
  press(found.trigger);
  if (isDateTrigger(found.trigger)) settleInDatePicker(doc);
  watchPicker();
}
// The ring rests on a filled property with the keyboard on it; nothing is opened (0.4.270).
function rest(el) {
  picking.moving = 0;
  picking.restEl = restTarget(el);
  picking.restEl.focus({ preventScroll: true });
  watchPicker();
}
// Enter on the property the ring rests on: its value opens, as a click on it does.
function openRested(doc) {
  const place = propertyPlaces(recordRow(doc, picking.rowUuid)).find(p => p.name === picking.names[picking.at]);
  const trigger = place && valueTrigger(place.el);
  if (!trigger) return;
  picking.moving = Date.now();
  picking.wasOpen = false;
  press(trigger);
  if (isDateTrigger(trigger)) settleInDatePicker(doc);
}
// Watches the focus while a list is meant to be open. The list closed: right after Enter in it, on to the next empty
// property (past the last, the next bullet); right after Escape, back to the words; back in the bullet's own words (a
// click there), simply done; anything else is leaving the bullet, and what is sure is filled in. A press that opened
// nothing within a moment ends it with nothing taken (second reading). A list that stays open after Enter (a property
// that holds several) is still in it: Enter adds, Tab moves on, Option-Enter finishes the bullet.
function watchPicker() {
  clearInterval(picking.timer);
  picking.timer = setInterval(() => {
    const doc = host();
    let active = doc.activeElement;
    // Logseq draws a row again when its value's box opens (seen: the ring on Notes went): put the mark back.
    const place = picking.at >= 0 ? propertyPlaces(recordRow(doc, picking.rowUuid)).find(p => p.name === picking.names[picking.at]) : null;
    if (place) markAt(doc, place.el);
    // Resting on a filled one: drawn again, the keyboard is put back on the new one.
    if (picking.restEl && place && !place.el.contains(picking.restEl)) {
      picking.restEl = restTarget(place.el);
      if (!active || active === doc.body || !active.isConnected) { picking.restEl.focus({ preventScroll: true }); active = doc.activeElement; }
    }
    const onRest = !!picking.restEl?.contains?.(active);
    if (!onRest && inPicker(active)) {
      picking.moving = 0;
      picking.wasOpen = true;
      if (picking.prefill && active.matches?.('input, textarea')) { typeInto(active, picking.prefill); picking.prefill = ''; }
      return;
    }
    if (picking.moving && Date.now() - picking.moving < OPEN_WAIT) return;
    // A long list (Topic takes 15 tags) has its box, with the keyboard on it, open well before Logseq puts the
    // keyboard in the list's field (seen 0.4.273: 1.7 s): while that box has the keyboard, the list is still opening.
    if (picking.moving && !picking.wasOpen && active?.closest?.('.ui__popover-content') && Date.now() - picking.moving < SLOW_OPEN) return;
    if (ownWords(active)) return endPicking(false);
    if (picking.wasOpen && picking.keyAt && Date.now() - picking.keyAt < KEY_CLOSES) {
      if (picking.lastKey === 'Enter') return openAt(doc, picking.at + 1, 1, finishBullet);
      return backToWords();
    }
    if (onRest) { picking.moving = 0; return; } // resting on a filled one, or its value opened nothing (a checkbox)
    if (!picking.wasOpen) return endPicking(false); // nothing opened
    endPicking(true);
  }, 100);
}
async function backToWords() {
  passOn();
  const { uuid, text } = picking;
  endPicking(false);
  // Coming back is not leaving: the focus-out it may cause takes nothing (second reading).
  picking.returning = uuid;
  const box = editingBox(host().activeElement);
  try {
    if (!(box && uuidOf(box) === uuid)) await logseq.Editor.editBlock(uuid, text ? { pos: text.length } : undefined);
  } catch (error) { warnOnce('could not go back to the words', error); }
  setTimeout(() => { if (picking.returning === uuid) picking.returning = ''; }, 400);
}
// Done with the bullet from its properties (Enter past the last one, or Option-Enter): as Enter at the end of the
// words, everything proposed and shown is filled in, guesses too, and the next bullet is made and put in edit.
async function finishBullet() {
  passOn();
  const { uuid, live } = picking;
  endPicking(false);
  if (!UUID.test(uuid)) return;
  picking.returning = uuid;
  try {
    // The fill goes on behind the next bullet, as with Enter in the words (second reading: waiting for it left
    // nothing in edit for a moment).
    if (live) leave(live, shownGuesses(live));
    if (hushed.uuid === uuid) hushed.uuid = ''; // the bullet is left: Escape's clearing ends (second reading)
    // Where Logseq's own Enter puts it: the first child of a bullet whose children show, else the next sibling.
    const row = recordRow(host(), uuid);
    const kids = row && [...row.querySelectorAll('.block-children-container .ls-block[blockid]')].some(el => el.parentElement?.closest('.ls-block[blockid]') === row);
    const next = kids ? await logseq.Editor.insertBlock(uuid, '', { sibling: false, before: true }) : await logseq.Editor.insertBlock(uuid, '', { sibling: true });
    if (next?.uuid) await logseq.Editor.editBlock(next.uuid);
  } catch (error) { warnOnce('could not go on to the next bullet', error); }
  later(() => { if (picking.returning === uuid) picking.returning = ''; }, 400);
}
function endPicking(left) {
  if (left) passOn();
  const live = picking.live;
  clearInterval(picking.timer); clearTimeout(picking.tab); clearInterval(picking.settle);
  markAt(host(), null);
  Object.assign(picking, { uuid: '', text: '', live: null, rowUuid: '', names: [], stops: new Set(), restEl: null, wasOpen: false, at: -1, keyAt: 0, lastKey: '', moving: 0, tab: 0, pickerRoot: null, settle: 0, guesses: null, prefill: '' });
  // Left from the list: as leaving the words, the sure values only.
  if (left) leave(live);
}
// Closes what is open in the properties with an Escape of the plugin's own (Logseq closes its list, or saves and
// closes a value's box), then does next.
function closeThen(target, next) {
  const doc = target.ownerDocument;
  picking.moving = Date.now();
  picking.ownKey = true; // not a way back to the words
  target.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  picking.ownKey = false;
  picking.tab = setTimeout(() => { picking.tab = 0; if (picking.uuid) next(doc); }, 60);
}
// The date picker's box is not one: Enter there is Logseq's, which sets the day and closes the picker (stage F).
const isTextBox = el => !!el?.matches?.('input, textarea, [contenteditable="true"]') && !el.closest('.cp__select') && !picking.pickerRoot?.contains(el);
function onPickKey(event) {
  if (event.isComposing) return;
  const plainEnter = event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.shiftKey;
  // Option-Enter in the words (only while the proposals are on).
  if (plainEnter && event.altKey && !picking.uuid) {
    const box = editingBox(event.target);
    if (!box || !setting('shadowProposals') || !state.allowedNow) return;
    const uuid = uuidOf(box), doc = box.ownerDocument;
    const rowUuid = state.live?.uuid === uuid ? state.live.recordUuid : uuid;
    const stops = new Set(emptyNames(doc, rowUuid));
    if (!stops.size) return; // nothing to go to: the key is Logseq's
    event.preventDefault(); event.stopImmediatePropagation();
    endPicking(false);
    Object.assign(picking, { uuid, text: box.value, live: state.live?.uuid === uuid ? state.live : null, rowUuid, names: propertyPlaces(recordRow(doc, rowUuid)).map(p => p.name), stops, guesses: guessesAt(rowUuid) });
    openAt(doc, 0);
    return;
  }
  // Down at the very end of the words: into the bullet's first property, filled or empty (0.4.271).
  if (event.key === 'ArrowDown' && !picking.uuid && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && downIntoProperties(event)) return;
  // Tab in the bullet's properties reached with Logseq's own Down (0.4.208): the same stepping from there (0.4.270);
  // Left and Right too, stopping at the ends (0.4.272).
  const plainKey = !event.metaKey && !event.ctrlKey && !event.altKey;
  if (event.key === 'Tab' && !picking.uuid && plainKey && startFromVisit(event, event.shiftKey ? -1 : 1, backToWords)) return;
  const side = plainKey && !event.shiftKey ? { ArrowRight: 1, ArrowLeft: -1 }[event.key] : 0;
  if (side && !picking.uuid && startFromVisit(event, side, () => endPicking(false))) return;
  // On a filled property the ring rests on (0.4.270): Enter opens it, Escape goes back to the words, Tab moves on,
  // Option-Enter finishes the bullet; other keys (Logseq's Left and Right) are Logseq's.
  if (picking.uuid && picking.restEl?.contains(event.target)) {
    const doc = event.target.ownerDocument;
    if (event.key === 'Tab') { event.preventDefault(); event.stopImmediatePropagation(); const step = event.shiftKey ? -1 : 1; openAt(doc, picking.at + step, step, backToWords, true); }
    else if (side) { event.preventDefault(); event.stopImmediatePropagation(); openAt(doc, picking.at + side, side, () => {}, true); } // at an end: it stays
    else if (plainEnter && event.altKey) { event.preventDefault(); event.stopImmediatePropagation(); finishBullet(); }
    else if (plainEnter) { event.preventDefault(); event.stopImmediatePropagation(); openRested(doc); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); backToWords(); }
    return;
  }
  if (!picking.uuid || !inPicker(event.target)) return;
  // A list or menu of Logseq's open inside a value's box ("[[" pages, "/" commands) keeps its keys (second reading:
  // Enter there would have saved a half-typed link).
  if (isTextBox(event.target) && event.target.ownerDocument.querySelector('#ui__ac, .absolute-modal, [data-editor-popup-ref]')) return;
  // Option-Enter in the properties: done with the bullet, from anywhere (a list that holds several included).
  if (plainEnter && event.altKey) {
    event.preventDefault(); event.stopImmediatePropagation();
    if (!picking.tab) closeThen(event.target, () => finishBullet());
    return;
  }
  if (event.key === 'Tab') {
    event.preventDefault(); event.stopImmediatePropagation();
    if (picking.tab) return; // one move at a time
    const step = event.shiftKey ? -1 : 1, next = picking.at + step;
    closeThen(event.target, doc => openAt(doc, next, step, backToWords, true));
    return;
  }
  // Enter in a text or number value: keep what was typed and move on (Shift-Enter stays a new line in it). In a list,
  // Enter is Logseq's pick; the move on comes when the list closes.
  if (plainEnter && isTextBox(event.target)) {
    event.preventDefault(); event.stopImmediatePropagation();
    if (!picking.tab) closeThen(event.target, doc => openAt(doc, picking.at + 1, 1, finishBullet));
    return;
  }
  if ((event.key === 'Enter' || event.key === 'Escape') && !picking.ownKey) { picking.keyAt = Date.now(); picking.lastKey = event.key; }
}

// The saved words and the typed ones, links left out (a saved link is an id, a typed one a name, and a day's or a
// block's name is not in the page list) but counted, and tags left out (Logseq keeps them apart from the words).
// A tag typed in the words is saved by Logseq as #[[uuid]] (seen 0.4.214: "#Expectation" typed, Escape on its list), which
// is not a link: the tags go first, or the saved words never match the typed ones and nothing is ever filled in.

// Tab, Left or Right on one of a bullet's own properties that Logseq's keys put the keyboard on: stepping starts from
// there, with the bullet's proposals kept as they are (the same conditions as Option-Enter); past an end, pastEnd.
function startFromVisit(event, step, pastEnd) {
  const target = event.target;
  if (!target?.closest || target.matches('input, textarea, [contenteditable="true"]')) return false;
  if (!setting('shadowProposals') || !state.allowedNow) return false;
  const placeEl = target.closest('.bottom-property-pill, .property-pair');
  const row = placeEl?.parentElement?.closest('.ls-block[blockid]');
  if (!row || !ownRow(row)(placeEl)) return false;
  const doc = target.ownerDocument, rowUuid = row.getAttribute('blockid');
  const places = propertyPlaces(row), at = places.findIndex(p => p.el === placeEl || p.el.contains(placeEl));
  if (at < 0) return false;
  event.preventDefault(); event.stopImmediatePropagation();
  const live = [state.visiting?.live, state.live].find(l => l?.recordUuid === rowUuid) || null;
  endPicking(false);
  Object.assign(picking, { uuid: live?.uuid || rowUuid, text: live?.text || '', live, rowUuid, names: places.map(p => p.name), stops: new Set(emptyNames(doc, rowUuid)), guesses: guessesAt(rowUuid) });
  openAt(doc, at + step, step, pastEnd, true);
  return true;
}

// Down in a bullet's words with the caret at the very end, and the bullet has properties of its own: the stepping
// starts on the first one (the conditions as Option-Enter's; Logseq's list of pages or commands keeps its keys).
function downIntoProperties(event) {
  const box = editingBox(event.target);
  if (!box || box !== event.target || box.selectionStart !== box.value.length || box.selectionEnd !== box.value.length) return false;
  if (!setting('shadowProposals') || !state.allowedNow) return false;
  const doc = box.ownerDocument;
  if (doc.querySelector('#ui__ac, .absolute-modal, [data-editor-popup-ref]')) return false;
  const uuid = uuidOf(box), places = propertyPlaces(recordRow(doc, uuid));
  if (!places.length) return false; // nothing under the bullet: Logseq's Down goes on to the next bullet
  event.preventDefault(); event.stopImmediatePropagation();
  const live = state.live?.uuid === uuid ? state.live : null;
  endPicking(false);
  Object.assign(picking, { uuid, text: box.value, live, rowUuid: uuid, names: places.map(p => p.name), stops: new Set(emptyNames(doc, uuid)), guesses: guessesAt(uuid) });
  openAt(doc, 0, 1, backToWords, true);
  return true;
}

Object.assign(P, { picking, endPicking, onPickKey });
(window.refinementParts ||= []).push({ name: 'proposals steps', schema: [], start() {}, stop: runUnloadTasks });
})();
