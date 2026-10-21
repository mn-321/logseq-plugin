/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Proposals, piece 1 (0.4.197): what the plugin is sure of while a bullet is written. Rebuilt on the foundation and the
   model; the old proposals part (parts/proposals.js, resting) pencilled values into the pills and took them with Tab.

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
   They show in the same place with a dotted line under them as well, and Enter takes them with the rest (under the
   same Undo; before 0.4.202 a click took each); leaving any other way takes only the sure values. A guess is made when every rule that speaks agrees:
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
   Writes only in the graphs named in its setting, as every part that writes to notes does. */
const shared = window.refinementShared;
const { host, notify, showUndoBar, graphNamedIn } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements (proposals): ', leaves: { elements: '.rfs-ghost, .rfs-made', attributes: ['data-refinement-proposal', 'data-rfs-at'] } });
let dsQuery, UUID, propSchema, propPages, bare, pick, idOf, sendStyle, titleOf, watchDomEarly, alike, parseDay, dayAfter, dayNumber, journalIdFor, journalTitleFor;
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };

const settingsSchema = [
  { key: 'shadowHeading', type: 'heading', group: 'writing', rank: 1, title: 'Proposals', default: null,
    legend: 'What the plugin is sure of, shown faintly in the bullet’s own properties and filled in when you leave it',
    zone: '<div><span class="m">Provider:</span> <span class="m"><i><u style="text-decoration-style: dotted">Dr. Raj Patel</u></i></span> <span class="m">· Date: <i>Oct 20</i></span></div>',
    description: 'Changes here apply right away.' },
  { key: 'shadowProposals', type: 'boolean', title: 'Proposals while you write', default: true,
    description: 'While you write a bullet, what the plugin is sure of shows faintly in the bullet’s own properties, where it will go: from your words, the page, the bullet a note is written under and the journal day (a linked doctor for the doctor property, the day for the date). Leaving the bullet (Enter, a click elsewhere, the arrows) fills those in, with Undo in the bar at the bottom. They are in italic grey; a guess has a dotted line under it as well: a page named in plain words (“Dr. Patel”), the values the earlier lines most like this one had (their words, links and tags), the parent bullet’s values, a linked page with no tag yet, the journal day for a tag with only a few dated bullets so far, a date written in the words (“on Friday”, “the 4th”, “4 Aug”) for a Date nothing else fills, a number beside a number property’s name (“cycle 5”). A bullet with no tag yet gets the tag of the lines it looks like, in a dotted Tags pill, with that tag’s properties beside it; Enter gives it the tag and fills them in. Enter fills in everything shown, guesses too; leaving the bullet any other way fills in only what is not a guess. Escape clears them until you next edit the bullet. Option-Enter opens the first property that is empty and has nothing proposed (a capsule or a row of its own; a date opens Logseq’s date picker with the keyboard in its text box, so “next fri” and Enter set it); Enter there keeps your choice and moves on, and on the last one makes the next bullet; Tab skips; Option-Enter again finishes the bullet; Escape comes back to the words. A tag written right after a link, with no space ([[Dr. New]]#Doctor), is that page’s tag: the page is proposed for the property that takes the tag, and filling it in gives the page the tag and takes it off the bullet and its words. Otherwise your words are never changed. Applies at once.' },
  { key: 'shadowGraphs', type: 'string', title: 'Only in these graphs', default: '',
    description: 'The graphs the proposals may write in, separated by commas (the plugin’s settings are shared by every graph). Empty: none. Applies at once.' },
];
const setting = shared.settingReader(settingsSchema);

const esc = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayText = day => day ? `${MONTHS[Math.floor(day / 100) % 100 - 1]} ${day % 100}` : '';
// A pulled map's values under a property, by its ident, whatever the key's spelling; [] when the property is empty.
function valuesOf(node, ident) {
  for (const key of Object.keys(node || {})) if (bare(key) === ident) { const v = node[key]; return (Array.isArray(v) ? v : v == null ? [] : [v]).map(idOf).filter(id => id != null); }
  return [];
}
// The properties the tags give, own first, then what they inherit, without repeats.
function fieldsOfTags(tagIds, schema) {
  const seen = new Set(), fields = [], queue = [...tagIds];
  while (queue.length) {
    const c = queue.shift();
    if (seen.has(c)) continue;
    seen.add(c);
    for (const p of schema.classProps.get(c) || []) { const prop = schema.byId.get(p); if (prop && !fields.includes(prop)) fields.push(prop); }
    queue.push(...(schema.parentsOf.get(c) || []));
  }
  return fields;
}
// A page fits a link property when one of its tags, or a tag that tag extends, is a tag the property takes.
function fits(page, classIds, schema) {
  const seen = new Set(), queue = page.tags.map(t => t.id);
  while (queue.length) {
    const c = queue.shift();
    if (seen.has(c)) continue;
    seen.add(c);
    if (classIds.has(c)) return true;
    queue.push(...(schema.parentsOf.get(c) || []));
  }
  return false;
}
// A page with no tag of yours (only Logseq's own, such as Page).
const untagged = page => !page.isTag && !page.tags.some(t => !/^logseq\.class\//.test(t.ident));

/* What the graph holds, remembered for the session by the model (read again when the graph changes): the
   properties with their tags, every page with its tags, and the pages by name and by uuid. */
let context = null;
async function contextFor() {
  const [schema, pages] = await Promise.all([propSchema(), propPages()]);
  if (context && context.schema === schema && context.pages === pages) return context;
  const byKey = new Map(), byId = new Map();
  for (const page of pages) { byKey.set(page.lower, page); if (page.uuid) byKey.set(page.uuid.toLowerCase(), page); byId.set(page.id, page); }
  // Tag names, longest first, for "#Symptom log" written without brackets.
  const tagNames = pages.filter(p => p.isTag).map(p => p.lower).sort((a, b) => b.length - a.length);
  return (context = { schema, pages, byKey, byId, tagNames });
}
// The pages linked in the words, read fresh (0.4.210, at the owner's word: "properties do not recognize the new page"):
// the page list is read at most every 30 s, so a page made or tagged a moment ago ([[Dr. New]] with #Doctor picked
// from Logseq's list right after it) was unknown, or known without its tag, and Provider stayed empty (seen in the
// app). Returns the context with those pages as they are now, or the context itself when nothing changed.
async function withFreshLinks(text, ctx) {
  const names = [...new Set([...String(text || '').matchAll(LINK)].map(([, key]) => key.trim().toLowerCase()).filter(key => key && !UUID.test(key)))];
  if (!names.length) return ctx;
  const rows = await dsQuery(`[:find (pull ?p [:db/id :block/uuid :block/title {:block/tags [:db/id :block/title :db/ident]}])
    :where [(ground [${names.map(name => JSON.stringify(name)).join(' ')}]) [?n ...]] [?p :block/name ?n] (not [?p :block/tags :logseq.class/Property]) (not [?p :block/journal-day _])]`).catch(() => []);
  const fresh = [];
  for (const [p] of rows) {
    const title = String(pick(p, 'block/title') ?? ''), id = idOf(p);
    if (!title || title.startsWith('$$$')) continue; // as the page list leaves them out (and properties, above; second reading)
    const tags = (pick(p, 'block/tags') || []).map(t => ({ id: idOf(t), title: String(pick(t, 'block/title') ?? ''), ident: bare(pick(t, 'db/ident')) })).filter(t => t.title);
    const known = ctx.byId.get(id);
    if (known && known.title === title && sameIds(known.tags.map(t => t.id), tags.map(t => t.id))) continue;
    fresh.push({ ...known, id, uuid: String(pick(p, 'block/uuid') ?? ''), title, lower: title.toLowerCase(), tags, isTag: tags.some(t => t.ident === 'logseq.class/Tag') });
  }
  if (!fresh.length) return ctx;
  if (ctx.history) namesFor(ctx); // built once on the shared context, not again on each copy (second reading)
  const byKey = new Map(ctx.byKey), byId = new Map(ctx.byId);
  for (const page of fresh) { byKey.set(page.lower, page); if (page.uuid) byKey.set(page.uuid.toLowerCase(), page); byId.set(page.id, page); }
  return { ...ctx, byKey, byId };
}
// The bullet in edit with what the rules read: its tags and values, its parent (and the parent's), its page.
const PAGE_PULL = '[:db/id :block/uuid :block/title :block/journal-day {:block/tags [:db/id]}]';
const BLOCK_PULL = `[* {:block/tags [:db/id]} {:block/page ${PAGE_PULL}} {:block/parent [* {:block/tags [:db/id]} {:block/page [:db/id]} {:block/parent [* {:block/tags [:db/id]} {:block/page [:db/id]}]}]}]`;
async function pullBlock(uuid) {
  if (!UUID.test(uuid)) return null;
  const [[b] = []] = await dsQuery(`[:find (pull ?b ${BLOCK_PULL}) :where [?b :block/uuid #uuid "${uuid}"]]`);
  return b || null;
}
// The pages linked in the words ([[uuid]] as saved, [[Name]] in the text box), in order, each once; and the tags
// written in the words (#Consultation, #[[Symptom log]]), as tag ids.
const LINK = /\[\[([^\[\]]+)\]\]/g, TAG = /(?:^|\s)#(?:\[\[([^\]]+)\]\]|([^\s#\[\]]+))/g;
function inWords(text, ctx) {
  const links = [], tags = [];
  const words = String(text || '');
  for (const [, key] of words.matchAll(LINK)) { const page = ctx.byKey.get(key.trim().toLowerCase()); if (page && !links.includes(page)) links.push(page); }
  const lower = words.toLowerCase();
  for (const m of words.matchAll(TAG)) {
    // The longest tag name that follows the #: Logseq shows a two-word tag as "#Symptom log", no brackets.
    const at = m.index + m[0].indexOf('#') + 1, rest = lower.slice(at);
    const name = m[1] ? m[1].trim().toLowerCase() : (ctx.tagNames || []).find(t => rest.startsWith(t) && !/[\w]/.test(rest.charAt(t.length))) || m[2].toLowerCase();
    const page = ctx.byKey.get(name);
    if (page?.isTag && !tags.includes(page.id)) tags.push(page.id);
  }
  return { links, tags };
}
// A tag written right after a link, with no space ([[Dr. New]]#Doctor), is the page's tag, not the bullet's (0.4.209,
// at the owner's word). Logseq gives it to the bullet; the proposals put the page in the record's property that takes
// that tag, and filling in moves the tag to the page. The page by its name in the words (a page made a moment ago is
// not in the page list yet: page is then null), each once.
const PAGE_TAG = /\[\[([^\[\]]+)\]\]#(?:\[\[([^\[\]]+)\]\]|([^\s#\[\]]+))/g;
function pagesTaggedIn(text, ctx) {
  const words = String(text || ''), lower = words.toLowerCase(), out = [];
  for (const m of words.matchAll(PAGE_TAG)) {
    const rest = lower.slice(m.index + m[0].indexOf(']]#') + 3);
    // Logseq reads #Doctor's as a tag "Doctor's" (second reading), so a longer word is not the shorter tag.
    const tagName = m[2] ? m[2].trim().toLowerCase() : (ctx.tagNames || []).find(t => rest.startsWith(t) && !/[\w'’-]/.test(rest.charAt(t.length))) || m[3].toLowerCase();
    const tag = ctx.byKey.get(tagName), key = m[1].trim().toLowerCase(), page = ctx.byKey.get(key) || null;
    if (!tag?.isTag || page?.isTag || out.some(x => x.key === key)) continue;
    out.push({ key, name: page ? page.title : m[1].trim(), page, tag });
  }
  return out;
}
// Where the tag written right after a page's link is in the words (as saved, the link is [[its uuid]], or its name):
// { at, text } with text the tag as written ("#Doctor", "#[[…]]"), or null.
function pageTagIn(title, page, tag) {
  const lower = title.toLowerCase();
  for (const key of [page.uuid, page.title]) {
    const mark = `[[${String(key).toLowerCase()}]]#`, at = lower.indexOf(mark);
    if (at < 0) continue;
    const from = at + mark.length, rest = title.slice(from), restLower = rest.toLowerCase();
    const n = rest.startsWith('[[') ? rest.indexOf(']]') + 2
      : restLower.startsWith(tag.lower) && !/[\w'’-]/.test(restLower.charAt(tag.lower.length)) ? tag.lower.length
      : (rest.match(/^[^\s#\[\]]+/) || [''])[0].length;
    return { at: from - 1, text: title.slice(from - 1, from + n) };
  }
  return null;
}
// The words without that tag.
function withoutPageTag(title, page, tag) {
  const found = pageTagIn(title, page, tag);
  return found ? title.slice(0, found.at) + title.slice(found.at + found.text.length) : title;
}
// The tag put back after the page's link (Undo, when the words were changed meanwhile).
function withPageTag(title, page, text) {
  for (const key of [page.uuid, page.title]) {
    const mark = `[[${String(key).toLowerCase()}]]`, at = title.toLowerCase().indexOf(mark);
    if (at >= 0 && title.charAt(at + mark.length) !== '#') return title.slice(0, at + mark.length) + text + title.slice(at + mark.length);
  }
  return title;
}
const isBlock = node => !!(node && pick(node, 'block/page'));
const cleanWords = text => String(text || '').replace(/#?\[\[([^\[\]]+)\]\]/g, (m, key) => /^[0-9a-f-]{36}$/i.test(key) ? '' : key).replace(/\s+/g, ' ').trim();
// Logseq keeps the tags typed at the end of a bullet apart from its words, so they are left out when the saved words are compared.
const plainWords = text => cleanWords(String(text || '').replace(TAG, ' ')).toLowerCase();

/* The rules. b is the bullet in edit (pulled), text its words (the text box, or the saved title). Returns the
   record the pieces are for and the pieces: { ident, prop, kind: 'node' | 'day', ids, shown, tagPage?, day?, journalId?, how }. */
// The record (the bullet, or its parent when only the parent's tags give properties) and its properties, the most
// particular first: a link is claimed by doctor, taking #Doctor, before with, taking #Person.
function recordOf(b, ownTags, schema) {
  const parent = pick(b, 'block/parent');
  let record = b, fields = fieldsOfTags(ownTags, schema);
  if (!fields.length && isBlock(parent)) {
    const parentFields = fieldsOfTags((pick(parent, 'block/tags') || []).map(idOf), schema);
    if (parentFields.length) { record = parent; fields = parentFields; }
  }
  const depth = id => { let d = 0, q = [id]; const seen = new Set(); while (q.length) { const c = q.shift(); if (seen.has(c)) continue; seen.add(c); for (const p of schema.parentsOf.get(c) || []) { q.push(p); } d = Math.max(d, seen.size); } return d; };
  const particular = prop => prop.type === 'node' ? Math.max(0, ...prop.classes.map(c => depth(c.id))) : -1;
  const ordered = fields.map((prop, i) => ({ prop, i, rank: particular(prop) })).sort((a, b) => b.rank - a.rank || a.i - b.i).map(x => x.prop);
  return { record, fields, ordered };
}
// The bullet's own tags, as it was when its editing began: those on it that its saved words do not give a page
// ([[Dr. New]]#Doctor saved earlier is a page's). A tag of its own is never set aside or taken off (second reading:
// a consultation writing [[Jul 3 visit]]#Consultation would have lost its own tag).
function ownTagsAtStart(b, ctx) {
  const toPages = new Set(pagesTaggedIn(String(pick(b, 'block/title') ?? ''), ctx).map(x => x.tag.id));
  return new Set((pick(b, 'block/tags') || []).map(idOf).filter(id => !toPages.has(id)));
}
function piecesFor(b, text, ctx, ownAtStart = new Set(), assume = null) {
  const { schema } = ctx;
  const { links, tags: typedTags } = inWords(text, ctx);
  const allTags = [...new Set([...(pick(b, 'block/tags') || []).map(idOf), ...typedTags])];
  // Pages tagged in the words ([[Dr. New]]#Doctor): their tags are not the bullet's, and each goes in the most
  // particular property of the record that takes its tag, when that one is empty (one that holds several takes them
  // all); filled, or taken by another page, it stays quiet, as a link does. A tag with a page left unplaced is left to
  // Logseq, the bullet's after all, for every page it follows; so is one also written apart (#Doctor) or the bullet's own.
  let asPage = pagesTaggedIn(text, ctx).filter(x => !typedTags.includes(x.tag.id) && !ownAtStart.has(x.tag.id));
  const settle = () => {
    const aside = new Set(asPage.map(x => x.tag.id));
    const ownTags = allTags.filter(id => !aside.has(id));
    const found = recordOf(b, ownTags, schema), claimed = new Map();
    for (const x of asPage) {
      const prop = found.ordered.find(p => p.type === 'node' && p.classes.length && fits({ tags: [{ id: x.tag.id }] }, new Set(p.classes.map(c => c.id)), schema));
      if (prop && !valuesOf(found.record, prop.ident).length && (!claimed.has(prop.ident) || prop.many)) claimed.set(prop.ident, [...claimed.get(prop.ident) || [], x]);
    }
    return { ...found, ownTags, aside, claimed };
  };
  let settled = settle();
  for (let round = 0; round < 3; round++) {
    const placed = new Set([...settled.claimed.values()].flat());
    const unplaced = new Set(asPage.filter(x => !placed.has(x)).map(x => x.tag.id));
    if (!unplaced.size) break;
    asPage = asPage.filter(x => placed.has(x) && !unplaced.has(x.tag.id));
    settled = settle();
  }
  const { record, fields, ordered, ownTags, aside, claimed } = settled;
  // The properties only a page's tag gives the bullet (Logseq shows them until the tag is moved): Option-Enter skips them.
  const skip = fieldsOfTags([...aside], schema).filter(p => !fields.includes(p)).map(p => p.lower);
  const pieces = [];
  // Stage D: no tag, and no record above: the tag of the nodes it looks like, with the properties it brings, all guesses.
  if (!fields.length) {
    const tag = allTags.length || asPage.length || !isBlock(b) ? null : assume || tagFor(b, text, ctx);
    if (!tag) return { record, pieces, skip };
    const assumed = piecesFor({ ...b, 'block/tags': [{ 'db/id': tag.id }] }, text, ctx, ownAtStart, tag);
    const tagPiece = { ident: 'block/tags', prop: { ident: 'block/tags', title: 'Tags', lower: 'tags', type: 'tag', many: true, classes: [] }, kind: 'tag', ids: [tag.id], tag, shown: `#${tag.title}`, how: 'alike-tag', guess: true };
    return { record: b, pieces: [tagPiece, ...assumed.pieces.map(piece => ({ ...piece, guess: true, needsTag: true }))], skip: assumed.skip, assume: tag };
  }
  const recordTags = record === b ? ownTags : (pick(record, 'block/tags') || []).map(idOf);
  const page = pick(b, 'block/page'), journalDay = Number(pick(page, 'block/journal-day') || 0);
  const pageTags = new Set((pick(page, 'block/tags') || []).map(idOf));
  const pageAsPage = page && !journalDay ? { id: idOf(page), uuid: String(pick(page, 'block/uuid') ?? ''), title: String(pick(page, 'block/title') ?? ''), tags: [...pageTags].map(id => ({ id })) } : null;
  const held = new Set(fields.flatMap(prop => valuesOf(record, prop.ident)));
  const free = links.filter(p => !held.has(p.id)), used = new Set(), quiet = new Set();
  let pageUsed = false;
  for (const [ident, xs] of claimed) {
    for (const x of xs) if (x.page) used.add(x.page);
    pieces.push({ ident, prop: ordered.find(p => p.ident === ident), kind: 'node', ids: xs.map(x => x.page?.id ?? 0), named: xs.map(x => x.key).join(','), asPage: xs, how: 'page-tag',
      shown: xs.map(x => x.page?.tags.some(t => t.id === x.tag.id) ? x.name : `${x.name} #${x.tag.title}`).join(', ') });
  }
  // A property kept quiet by two names keeps them: two doctors named do not spill into "with" (found by the scorer).
  for (const prop of ordered) {
    // A property a tagged page went in still speaks for the links it takes: a doctor linked beside [[Dr. New]]#Doctor
    // does not spill into "with" (second reading).
    if (claimed.has(prop.ident)) { if (prop.classes.length) { const classIds = new Set(prop.classes.map(c => c.id)); for (const p of free) if (fits(p, classIds, schema)) used.add(p); } continue; }
    const filled = valuesOf(record, prop.ident).length > 0;
    if (prop.type === 'node' && prop.classes.length) {
      const classIds = new Set(prop.classes.map(c => c.id));
      const fitting = free.filter(p => !used.has(p) && fits(p, classIds, schema));
      // A filled property still claims the links it takes: a second doctor named when doctor is filled does not become "with".
      if (fitting.length) {
        for (const p of fitting) used.add(p);
        // From a note under the record, only a one-value property is sure: a list of people in a note ("rang Amara and
        // Tunde") is not the record's "spoke with" (found by the scorer on the lean graph).
        if (!filled && (prop.many ? record === b : fitting.length === 1)) pieces.push({ ident: prop.ident, prop, kind: 'node', ids: fitting.map(p => p.id), shown: fitting.map(p => p.title).join(', '), how: 'linked' });
        else quiet.add(prop.ident); // no guess either
        continue; // two names for one place: quiet, and the names are spoken for
      }
      if (filled) continue;
      // The page fills one property only, the most particular that takes it (doctor, not also "with"; seen in the app).
      if (pageAsPage && !pageUsed && pageAsPage.id !== idOf(record) && fits(pageAsPage, classIds, schema)) { pageUsed = true; used.add(ctx.byId.get(pageAsPage.id) || pageAsPage); pieces.push({ ident: prop.ident, prop, kind: 'node', ids: [pageAsPage.id], shown: pageAsPage.title, how: 'page' }); continue; }
    } else if (!filled && prop.type === 'date' && prop.lower === 'date') {
      // The journal day only for tags whose nodes are dated the day they are written, as the graph shows (symptom logs
      // are; appointments are often written ahead, so the day would be wrong; found by the scorer).
      if (journalDay && datedWhenWritten(recordTags, ctx)) pieces.push({ ident: prop.ident, prop, kind: 'day', ids: [idOf(page)], day: journalDay, journalId: idOf(page), shown: dayText(journalDay), how: 'day' });
    }
  }
  pieces.sort((a, b) => fields.indexOf(a.prop) - fields.indexOf(b.prop)); // shown in the order the tag gives them
  const guesses = guessesFor({ b, text, record, fields: ordered, recordTags, links, free, used, quiet, done: new Set(pieces.map(p => p.ident)), ctx });
  guesses.sort((a, b) => fields.indexOf(a.prop) - fields.indexOf(b.prop));
  return { record, pieces: [...pieces, ...guesses], skip };
}

/* Piece 2: the guesses. Words are compared as lower-case words, links read as the names they show. */
const WORD = /[\p{L}\p{N}]+/gu;
const wordsOf = text => String(text || '').toLowerCase().match(WORD) || [];
// Words that name nothing on their own, even when a title has them.
const COMMON = new Set('with from that this have been after before about again today tomorrow morning evening night week weeks home done back into over than then them they there what when will just very more some other first last next little still feel felt good well better worse every each same also only once twice like says said told rang call called video check post appointment report results result about'.split(' '));
const telling = word => word.length >= 4 && !COMMON.has(word) && !/^\d+$/.test(word);
// The words a bullet's text shows outside its links and tags (what plain words can name).
const freeWords = text => wordsOf(String(text || '').replace(/#?\[\[[^\[\]]*\]\]/g, ' ').replace(TAG, ' '));
// All the words a text shows, a saved link ([[uuid]]) read as its page's title, tags left out (for the engine).
function shownWords(text, ctx) {
  const named = String(text || '').replace(/#?\[\[([^\[\]]+)\]\]/g, (m, key) => ' ' + (/^[0-9a-f-]{36}$/i.test(key) ? ctx.byKey.get(key.toLowerCase())?.title || '' : key) + ' ');
  return new Set(wordsOf(named.replace(TAG, ' ')));
}
// The pages a saved title links ([[uuid]], or [[Name]] in the text box), as ids, for the engine's link tokens.
const linkIdsIn = (text, ctx) => [...new Set([...String(text || '').matchAll(LINK)].map(([, key]) => ctx.byKey.get(key.trim().toLowerCase())?.id).filter(id => id != null))];
// Every page by the names it goes by (its title and its aliases), for plain words: the telling words of each name,
// and each whole name. Alias pages themselves are left out: they stand for their original.
function namesFor(ctx) {
  if (ctx.names) return ctx.names;
  const aliasOf = new Map((ctx.aliases || []).map(([original, alias]) => [alias, original]));
  const byWord = new Map(), whole = new Map();
  const add = (page, name) => {
    const words = wordsOf(name);
    if (!words.length || name.length < 3) return;
    if (!whole.has(words[0])) whole.set(words[0], []);
    whole.get(words[0]).push({ page, words });
    for (const word of new Set(words.filter(telling))) { if (!byWord.has(word)) byWord.set(word, new Set()); byWord.get(word).add(page); }
  };
  for (const page of ctx.pages) if (!page.isTag && !aliasOf.has(page.id)) add(page, page.title);
  for (const [alias, original] of aliasOf) { const page = ctx.byId.get(original), name = ctx.byId.get(alias)?.title; if (page && name) add(page, name); }
  return (ctx.names = { byWord, whole, aliasIds: new Set(aliasOf.keys()) });
}
// The one page of the property's tags the words name, or null: a whole name counts more than a word of it, and a tie
// names no one.
function namedIn(words, classIds, ctx, spoken) {
  const { byWord, whole } = namesFor(ctx), score = new Map();
  const bump = (page, n) => { if (!spoken.has(page) && fits(page, classIds, ctx.schema)) score.set(page, (score.get(page) || 0) + n); };
  for (const word of new Set(words)) for (const page of byWord.get(word) || []) bump(page, 1);
  words.forEach((word, i) => { for (const { page, words: name } of whole.get(word) || []) if (name.every((w, k) => words[i + k] === w)) bump(page, 10); });
  let best = null, top = 0, tie = false;
  for (const [page, n] of score) { if (n > top) { best = page; top = n; tie = false; } else if (n === top) tie = true; }
  return tie ? null : best;
}
/* The plain-language reader (stage E): what is literally in the words, read the same in every graph. */
const WEEKDAY = '(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?';
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';
const SMALL = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const asDate = day => new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100);
// The days the words name, as day numbers, each once, counted from `base` (the journal day the bullet is written on,
// else today): a weekday is the coming one; "the 4th" the next 4th; a day and month the next such day; "in two weeks".
function daysInWords(text, base) {
  const words = ' ' + cleanWords(text).toLowerCase().replace(/[.,;:!?()]/g, ' ') + ' ', today = asDate(base), found = new Set();
  const add = date => { if (date && !Number.isNaN(date.getTime())) found.add(dayNumber(date)); };
  for (const [, word] of words.matchAll(/\s(today|tomorrow|tmr|yesterday)\s/g)) add(parseDay(word, today));
  for (const [, next, day] of words.matchAll(new RegExp(`\\s(?:(next)\\s+|(?:on|this|by|until|till)\\s+)?(${WEEKDAY})\\s`, 'g'))) add(parseDay(`${next ? 'next ' : ''}${day}`, today));
  for (const [, n] of words.matchAll(/\s(?:on|by|until|till)?\s*the\s+(\d{1,2})(?:st|nd|rd|th)\s/g)) {
    const d = Number(n);
    if (d < 1 || d > 31) continue;
    let date = new Date(today.getFullYear(), today.getMonth(), d);
    if (date.getDate() !== d || date < today) date = new Date(today.getFullYear(), today.getMonth() + 1, d);
    if (date.getDate() === d) add(date);
  }
  for (const [, d, month] of words.matchAll(new RegExp(`\\s(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH})\\s`, 'g'))) add(parseDay(`${d} ${month.slice(0, 3)}`, today));
  for (const [, month, d] of words.matchAll(new RegExp(`\\s(${MONTH})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s`, 'g'))) add(parseDay(`${month.slice(0, 3)} ${d}`, today));
  for (const [, n, unit] of words.matchAll(/\sin\s+(\d{1,2}|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|days|week|weeks)\s/g)) add(dayAfter(today, (SMALL[n] ?? Number(n)) * (unit.startsWith('week') ? 7 : 1)));
  for (const [, iso] of words.matchAll(/\s(\d{4}-\d{1,2}-\d{1,2})\s/g)) add(parseDay(iso, today));
  return [...found];
}
// The number written beside a number property's name ("cycle 5", "5 cycles"), or null; two different ones, null.
function numberInWords(text, prop) {
  const words = ' ' + cleanWords(text).toLowerCase().replace(/[,;:!?()]/g, ' ') + ' ', found = new Set();
  const name = prop.lower.replace(/[^\p{L}\p{N} ]/gu, ' ').trim();
  if (!name) return null;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  for (const [, n] of words.matchAll(new RegExp(`\\s${esc}s?\\s+(?:no\\.?\\s*|#)?(\\d+(?:\\.\\d+)?)\\s`, 'g'))) found.add(Number(n));
  for (const [, n] of words.matchAll(new RegExp(`\\s(\\d+(?:\\.\\d+)?)\\s+${esc}s?\\s`, 'g'))) found.add(Number(n));
  return found.size === 1 ? [...found][0] : null;
}
// The journal page of a day, by its number, when the graph has one; ctx.days is read the other way round once.
const dayIdFor = (ctx, day) => (ctx.dayIds ||= new Map([...(ctx.days || [])].map(([id, d]) => [d, id]))).get(day) ?? null;

// The tag of the nodes an untagged bullet looks like (stage D): by its words and links alone, among every node under
// a tag the model knows; the nearest vote, under the tag's own stricter limits. One tag, a tag page the plugin knows.
function tagFor(b, text, ctx) {
  if (!ctx.alike || !alike) return null;
  const { links } = inWords(text, ctx);
  const tokens = alike.tokensOf(shownWords(text, ctx), links.map(p => p.id), []);
  if (tokens.length < 2) return null;
  const near = alike.neighbours(ctx.alike, tokens, { skip: new Set([idOf(b)]), keep: entry => entry.values.get('block/tags')?.length > 0 });
  const { tagNearLeast: nearLeast, tagLead: lead, tagLeast: least } = alike.limits;
  const voted = alike.vote(near, 'block/tags', { nearLeast, lead, least });
  if (!voted || voted.ids.length !== 1) return null;
  const page = ctx.byId.get(voted.ids[0]);
  return page?.isTag && page.uuid && (!ctx.knownTags || ctx.knownTags.has(page.id)) ? page : null;
}
// The nodes the bullet looks like, for one property: the nearest earlier holders of it, by the bullet's words
// (links read as titles), its links and the record's tags; the bullet itself left out. Only from the bullet's own
// words (not a note's under the record), and only once the engine's index is there (never waited for while typing).
function looksLike(text, links, tagIds, prop, skip, ctx) {
  if (!ctx.alike || !alike) return [];
  const tokens = alike.tokensOf(shownWords(text, ctx), links.map(p => p.id), tagIds);
  return alike.neighbours(ctx.alike, tokens, { skip, keep: entry => entry.values.get(prop.ident)?.length > 0 });
}
const sameIds = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
function guessesFor({ b, text, record, fields, recordTags, links, free, used, quiet, done, ctx }) {
  const own = record === b, parent = pick(b, 'block/parent'), journalDay = Number(pick(pick(b, 'block/page'), 'block/journal-day') || 0);
  const parentTags = own && isBlock(parent) ? (pick(parent, 'block/tags') || []).map(idOf) : [];
  const skip = new Set([idOf(b)]);
  const words = freeWords(text), spoken = new Set(used), out = [];
  const open = prop => !done.has(prop.ident) && !quiet.has(prop.ident) && !valuesOf(record, prop.ident).length;
  const nodeOf = id => ctx.byId.get(id);
  for (const prop of fields) {
    if (!open(prop)) continue;
    const isNode = prop.type === 'node' && prop.classes.length, isDate = prop.type === 'date', isNumber = prop.type === 'number';
    if (!isNode && !isDate && !isNumber) continue;
    const said = [];
    // Stage E: a number beside the property's name ("cycle 5").
    if (isNumber) {
      const n = own ? numberInWords(text, prop) : null;
      if (n != null) out.push({ ident: prop.ident, prop, kind: 'number', ids: [n], shown: String(n), how: 'words-number', guess: true });
      continue;
    }
    // The parent's values, for a property both have.
    if (parentTags.length) { const v = valuesOf(parent, prop.ident); if (v.length) said.push({ ids: v, how: 'parent' }); }
    if (isNode) {
      const classIds = new Set(prop.classes.map(c => c.id));
      // The nodes it looks like: the nearest earlier holders of the property vote, and a clear lead speaks.
      const voted = own ? alike?.vote(looksLike(text, links, recordTags, prop, skip, ctx), prop.ident) : null;
      if (voted) said.push({ ids: voted.ids, how: 'alike' });
      const named = namedIn(words, classIds, ctx, spoken);
      if (named) said.push({ ids: [named.id], how: 'words' });
    }
    // The journal day, as a guess, for a "date" of a tag the graph has too few dated nodes of to be sure (fewer than
    // 5) but at least one, none of them dated another day (0.4.211, at the owner's word: "the date is not taking the date of journal";
    // a treatment had 3). A tag whose nodes are dated other days (an expectation, written ahead) still gets nothing.
    if (isDate && !said.length && prop.lower === 'date' && journalDay && fewDatedAllSameDay(recordTags, ctx)) said.push({ ids: [idOf(pick(b, 'block/page'))], how: 'day' });
    // Stage E: a date written in the words, counted from the day the bullet is written on (else today); one, or nothing.
    if (isDate && own && prop.lower === 'date') {
      const days = daysInWords(text, journalDay || dayNumber(new Date()));
      if (days.length === 1) { const id = dayIdFor(ctx, days[0]); said.push({ ids: [id ?? -days[0]], day: days[0], how: 'words-day' }); }
    }
    if (!said.length || !said.every(s => sameIds(s.ids, said[0].ids))) continue;
    const ids = said[0].ids;
    if (!prop.many && ids.length !== 1) continue;
    if (isDate) {
      const day = said.find(s => s.day)?.day || ctx.days?.get(ids[0]);
      if (day) out.push({ ident: prop.ident, prop, kind: 'day', ids, day, journalId: ids[0] > 0 ? ids[0] : null, shown: dayText(day), how: said.map(s => s.how).join('+'), guess: true });
      continue;
    }
    const pages = ids.map(nodeOf);
    if (pages.some(p => !p)) continue;
    for (const p of pages) spoken.add(p);
    out.push({ ident: prop.ident, prop, kind: 'node', ids, shown: pages.map(p => p.title).join(', '), how: said.map(s => s.how).join('+'), guess: true });
  }
  // A linked page with no tag yet: a guess for the first empty place it could fill (a property taking one tag, the
  // most particular first), when there are one or two such places and no other such page competes for them. Taking
  // it gives the page that tag too. Only one place, since Enter takes every guess (0.4.202; it offered both before).
  const { aliasIds } = namesFor(ctx);
  const loose = free.filter(p => !used.has(p) && untagged(p) && !aliasIds.has(p.id));
  const places = fields.filter(prop => open(prop) && prop.type === 'node' && prop.classes.length === 1 && !out.some(g => g.ident === prop.ident));
  if (loose.length === 1 && places.length && places.length <= 2) {
    const [p] = loose;
    for (const prop of places.slice(0, 1)) {
      const tag = prop.classes[0];
      out.push({ ident: prop.ident, prop, kind: 'node', ids: [p.id], shown: p.title, how: 'untagged', guess: true,
        tagPage: { tag, uuids: [p.uuid] }, note: `becomes a #${tag.title}` });
    }
  }
  return out;
}
// The nodes under tags with link properties, their words, links, tags and values, made into the engine's index (the
// nodes a bullet may look like); and the aliases (original, alias), for plain words. Kept apart from the context, per
// graph, read again at most every five minutes (guessDataFor). ctx.history marks that it was read.
function addHistory(ctx, entries) {
  ctx.history = true;
  const kept = [];
  for (const entry of entries) {
    const words = entry.words || shownWords(entry.title, ctx);
    if (words.size < 2) continue;
    const values = new Map(entry.values);
    if (entry.tags?.length) values.set('block/tags', entry.tags);
    kept.push({ id: entry.id, tokens: alike ? alike.tokensOf(words, entry.links || linkIdsIn(entry.title, ctx), entry.tags) : [], values });
  }
  ctx.alike = alike ? alike.buildIndex(kept) : null;
  return ctx;
}
// Read at most every five minutes, apart from the context (which is read again every 30 s while you write), and
// never waited for while typing: until it is there, the guesses go without aliases and earlier lines.
const GUESS_DATA_EVERY = 300000;
const guessCache = { graph: null, at: 0, data: null, loading: null };
async function guessDataFor(ctx, { wait = true } = {}) {
  if (ctx.history) return ctx;
  const graph = (await Promise.resolve(logseq.App.getCurrentGraph?.()).catch(() => null))?.name || '';
  let data = guessCache.graph === graph ? guessCache.data : null;
  if (!data || Date.now() - guessCache.at > GUESS_DATA_EVERY) {
    guessCache.loading ||= loadGuessData(ctx).then(fresh => Object.assign(guessCache, { graph, at: Date.now(), data: fresh }).data).finally(() => { guessCache.loading = null; });
    if (!data && wait) data = await guessCache.loading;
  }
  if (!data) return ctx;
  ctx.aliases = data.aliases;
  ctx.knownTags = new Set(data.tagIds || []);
  ctx.names = null;
  return addHistory(ctx, data.entries);
}
async function loadGuessData(ctx) {
  const { schema } = ctx;
  const nodeProps = schema.props.filter(p => p.type === 'node' && p.classes.length);
  // Every tag of the owner's own (user.class/…), for stage D's tag votes: never Logseq's (Task, Card, Query), which
  // the schema knows too; before 0.4.213 only the tags with link properties.
  const tagIds = (await dsQuery('[:find ?t ?i :where [?t :block/tags :logseq.class/Tag] [?t :db/ident ?i]]').catch(() => []))
    .filter(([, ident]) => /^:?user\.class\//.test(String(ident))).map(([t]) => Number(t));
  const [rows, aliases] = await Promise.all([
    tagIds.length ? dsQuery(`[:find (pull ?b [:db/id :block/title {:block/tags [:db/id]} ${nodeProps.map(p => `{:${p.ident} [:db/id]}`).join(' ')}])
      :where [(ground #{${tagIds.join(' ')}}) [?t ...]] [?b :block/tags ?t] [?b :block/page _] (not [?b :logseq.property/deleted-at _])]`).catch(error => { warnOnce('the earlier lines could not be read', error); return []; }) : [],
    dsQuery('[:find ?o ?a :where [?o :block/alias ?a]]').catch(() => [])]);
  return { aliases: aliases.map(([o, a]) => [Number(o), Number(a)]), tagIds,
    entries: rows.map(([n]) => ({ id: idOf(n), words: shownWords(String(pick(n, 'block/title') ?? ''), ctx), links: linkIdsIn(String(pick(n, 'block/title') ?? ''), ctx), tags: (pick(n, 'block/tags') || []).map(idOf),
      values: new Map(nodeProps.map(p => [p.ident, valuesOf(n, p.ident)]).filter(([, v]) => v.length)) })) };
}
// Journal days by page id, for the parent's date, and for each tag how many of its dated nodes written on a journal
// page carry that page's day (a small look-up kept with the context).
async function daysFor(ctx) {
  if (ctx.days) return ctx;
  ctx.days = new Map((await dsQuery('[:find ?p ?d :where [?p :block/journal-day ?d]]')).map(([p, d]) => [p, Number(d)]));
  ctx.dated = new Map();
  const rows = await dsQuery('[:find ?t ?same (count ?b) :where [?b :block/tags ?t] [?b :user.property/date ?dp] [?dp :block/journal-day ?d] [?b :block/page ?pg] [?pg :block/journal-day ?pd] [(= ?d ?pd) ?same]]').catch(() => []);
  for (const [t, same, count] of rows) { const n = ctx.dated.get(t) || { same: 0, other: 0 }; n[same ? 'same' : 'other'] += Number(count) || 0; ctx.dated.set(t, n); }
  return ctx;
}
// Sure only with evidence: at least 5 such nodes under the record's own tags, and 19 in 20 dated the day written.
const DATED_LEAST = 5, DATED_SHARE = .95;
function datedWhenWritten(tagIds, ctx) {
  let same = 0, other = 0;
  for (const id of tagIds) { const n = ctx.dated?.get(id); if (n) { same += n.same; other += n.other; } }
  return same + other >= DATED_LEAST && same / (same + other) >= DATED_SHARE;
}
function fewDatedAllSameDay(tagIds, ctx) {
  let same = 0, other = 0;
  for (const id of tagIds) { const n = ctx.dated?.get(id); if (n) { same += n.same; other += n.other; } }
  // At least one: no evidence is not permission (second reading: a new tag's first "Scan next Tuesday" would get today,
  // and so would every tag while the counts are still being read).
  return same >= 1 && same + other < DATED_LEAST && other === 0;
}

/* The bullet in edit: its shadow is worked out 40 ms after each key from the text box and one small pull of the
   block, drawn in the record's own properties, and taken when the bullet is left unless Escape cleared it. Only what
   was shown is taken: a record whose row is not on screen (a note zoomed into) gets nothing (second reading). */
// taken: the guesses Enter took in the bullet being written ({ uuid, at, keys }), filled in with the rest when it is left.
const ENTER_LEAVES = 500;
const state = window.refinementShadow = { live: null, times: [], taken: { uuid: '', keys: new Set() } };
// A page tagged in the words goes by its name: it may be made, and get an id, only after it was drawn.
const guessKey = piece => `${piece.ident} ${piece.named ?? piece.ids.join(',')}`;
const takenIn = uuid => state.taken.uuid === uuid ? state.taken.keys : new Set();
// Escape clears the proposals until the bullet is next edited (0.4.204, at the owner's word; before, for good, kept
// in Logseq's window storage, which is emptied at start so bullets cleared then show their proposals again).
const OFF_KEY = 'refinementShadowOff';
const forgetOld = () => { try { host().defaultView.localStorage.removeItem(OFF_KEY); } catch { /* nothing kept */ } };
const hushed = state.hushed = { uuid: '' };
function dismiss(uuid) { hushed.uuid = uuid; }
// The box of a bullet being written. A property value's box (a text value is drawn as a block of its own, inside the
// record's properties) is not one: proposals are never worked out, shown or taken there (second reading).
const VALUE_PLACE = '.property-pair, .bottom-property-pill, .property-block-container, .property-value-container';
const editingBox = el => (el?.matches?.('textarea') && el.closest('.ls-block[blockid]') && !el.closest(VALUE_PLACE)) ? el : null;
const uuidOf = box => box.closest('.ls-block[blockid]')?.getAttribute('blockid') || '';
let liveTimer = 0, liveVersion = 0;
// The bullet's own tags when its editing began (ownTagsAtStart), read again each time a bullet's box gets the focus.
const startTags = { uuid: '', own: new Set() };
async function allowed() {
  return setting('shadowProposals') && await graphNamedIn(setting('shadowGraphs'));
}
// No shadow: nor anything taken in it, so a guess taken earlier is never written on a later visit (second reading).
function clearLive() { state.live = null; state.taken = { uuid: '', keys: new Set() }; hide(); }
async function compute(box) {
  const uuid = uuidOf(box);
  if (!uuid || hushed.uuid === uuid) { clearLive(); return; }
  const version = ++liveVersion, text = box.value, t0 = performance.now();
  try {
    if (!await allowed()) { clearLive(); return; }
    const ctx = await withFreshLinks(text, await guessDataFor(await daysFor(await contextFor()), { wait: false }));
    const b = await pullBlock(uuid);
    if (version !== liveVersion) return;
    if (!b) { clearLive(); return; }
    if (startTags.uuid !== uuid) Object.assign(startTags, { uuid, own: ownTagsAtStart(b, ctx) });
    const { record, pieces, skip, assume } = piecesFor(b, text, ctx, startTags.own);
    state.times.push(Math.round(performance.now() - t0)); if (state.times.length > 50) state.times.shift();
    if (!pieces.length) { clearLive(); return; }
    if (state.taken.uuid !== uuid) state.taken = { uuid, keys: new Set() };
    state.live = { uuid, text, recordUuid: String(pick(record, 'block/uuid') ?? ''), pieces, skip, own: startTags.own, assume: assume || null, at: Date.now() };
    drawInPlace(box.ownerDocument);
  } catch (error) { warnOnce('the shadow could not be worked out', error); }
}
function onInput(event) {
  const box = editingBox(event.target);
  if (!box) return;
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => compute(box), 40);
}
function onFocusIn(event) {
  const box = editingBox(event.target);
  if (box) startTags.uuid = '';
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
  if (hushed.uuid === uuid) setTimeout(() => { const now = editingBox(host().activeElement); if (!(now && uuidOf(now) === uuid) && picking.uuid !== uuid && picking.returning !== uuid) hushed.uuid = ''; }, 120);
  // Into a property's list with Option-Enter, or coming back from it: the proposals wait for the words.
  if (picking.uuid === uuid || picking.returning === uuid) return;
  if (!state.live || state.live.uuid !== uuid) { if (state.taken.uuid === uuid) state.taken = { uuid: '', keys: new Set() }; return; }
  // Enter's taking counts only when the bullet is left right after it: an Enter that kept the bullet in edit (at the
  // very start of its words, or in document mode) must not let a later click away fill in guesses (second reading).
  const live = state.live, taken = Date.now() - (state.taken.at || 0) < ENTER_LEAVES ? new Set(takenIn(uuid)) : new Set();
  setTimeout(() => {
    const active = host().activeElement, now = editingBox(active);
    if (now && uuidOf(now) === live.uuid) return;
    if (live.left) return;
    // Into the bullet's own properties (Logseq's Down from the words, then Left/Right, Enter): not leaving it. The
    // proposals stay shown and wait (0.4.208, at the owner's word).
    if (inOwnProperties(active, live.recordUuid)) return visitProperties(live);
    live.left = true;
    live.taken = taken;
    state.left = live; // for tools/shadow-test.js
    if (state.live === live) { state.live = null; hide(); }
    if (state.taken.uuid === live.uuid) state.taken = { uuid: '', keys: new Set() };
    takeShadow(live).catch(error => { warnOnce('the shadow could not be taken', error); notify('The proposed values could not be filled in', 'warning'); });
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
function leaveVisited(live) {
  if (live.left) return;
  live.left = true;
  live.taken = new Set();
  state.left = live; // for tools/shadow-test.js
  if (state.taken.uuid === live.uuid) state.taken = { uuid: '', keys: new Set() };
  if (state.live === live) { state.live = null; hide(); }
  takeShadow(live).catch(error => { warnOnce('the shadow could not be taken', error); notify('The proposed values could not be filled in', 'warning'); });
}
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

// Escape clears the proposals until the bullet is next edited; the caret stays (a second Escape is Logseq's).
// Enter (plain, with no list of Logseq's open) takes the guesses too: the bullet is then left as usual, and everything
// shown is filled in (the owner: "enter confirms I like things"; 0.4.202). Leaving any other way takes the sure values
// only. Nothing of Enter is held back: Logseq still makes the next bullet.
function onKey(event) {
  if ((event.key !== 'Escape' && event.key !== 'Enter') || event.isComposing || !state.live) return;
  const box = editingBox(event.target);
  if (!box || uuidOf(box) !== state.live.uuid) return;
  if (box.ownerDocument.querySelector('#ui__ac, .absolute-modal, [data-editor-popup-ref]')) return;
  if (event.key === 'Enter') {
    if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
    state.taken = { uuid: state.live.uuid, at: Date.now(), keys: new Set(state.live.pieces.filter(p => p.guess && state.live.drawn?.has(guessKey(p))).map(guessKey)) };
    return;
  }
  event.preventDefault(); event.stopImmediatePropagation();
  dismiss(state.live.uuid);
  state.live = null;
  state.taken = { uuid: '', keys: new Set() };
  hide();
}
// A press on a proposed value does nothing (0.4.202: no click to confirm; Enter does): Logseq never hears of it, so
// its value editor does not open under the value, and the mouse press is held back so the bullet stays in edit. The
// pointer press is not held back: that would stop the mouse press, and its holding back, from coming at all.
function onGuessPress(event) {
  const el = event.target?.closest?.('.rfs-ghost');
  if (!el) return;
  event.stopImmediatePropagation();
  if (event.type !== 'pointerdown') event.preventDefault();
}
/* Option-Enter (0.4.204, at the owner's word: "option enter just goes to the empty property that didn't have anything
   guessed or proposed"): from the words of a bullet, open Logseq's own list for the first of the record's properties
   that is empty and has nothing proposed (the "Set Topic" list a click on its empty value opens). Tab in that list
   goes on to the next such property, Shift-Tab back; past either end, back to the words. Enter or Escape in the list
   (Logseq picks or closes) also comes back to the end of the words, with the proposals still shown; Enter there then
   fills them in as usual. Leaving the list any other way (a click elsewhere) is leaving the bullet: what is sure is
   filled in. Logseq has no key of its own into the properties shown under a bullet (tried on screen: Escape and Down
   go to the next bullet, Cmd+J does nothing), so the plugin presses the empty value's own trigger, as a click does. */
const picking = state.picking = { uuid: '', text: '', live: null, rowUuid: '', names: [], at: -1, keyAt: 0, lastKey: '', timer: 0, moving: 0, tab: 0, returning: '', pickerRoot: null, settle: 0 };
const recordRow = (doc, rowUuid) => [...doc.querySelectorAll(`.ls-block[blockid="${rowUuid}"]`)].find(r => r.offsetParent !== null) || doc.querySelector(`.ls-block[blockid="${rowUuid}"]`);
// An empty value's own trigger, for the kinds whose list, box or picker is followed here: a link, a text (or choice),
// a web address, a number, a date (0.4.215). A checkbox's trigger is the box itself, which a press would tick (second
// reading).
const emptyTrigger = el => el.querySelector(['node', 'default', 'url', 'number', 'date'].map(type => `.empty-value[data-type="${type}"] .jtrigger`).join(', '));
const isDateTrigger = el => el?.closest?.('.empty-value')?.dataset.type === 'date';
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
    if (box && active !== box) box.focus();
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
function emptyNames(doc, rowUuid) {
  const live = state.live?.recordUuid === rowUuid ? state.live : null;
  const proposed = new Set([...(live?.pieces || []).map(piece => piece.prop.lower), ...live?.skip || []]);
  return propertyPlaces(recordRow(doc, rowUuid)).filter(({ el, name }) => !proposed.has(name) && !el.querySelector('.rfs-ghost') && emptyTrigger(el)).map(p => p.name);
}
// The trigger of the i-th of them, if it is still empty (one filled meanwhile is passed over).
function triggerAt(doc, i, step) {
  const places = propertyPlaces(recordRow(doc, picking.rowUuid));
  for (; i >= 0 && i < picking.names.length; i += step) {
    const place = places.find(p => p.name === picking.names[i]);
    const trigger = place && emptyTrigger(place.el);
    if (trigger) return { i, trigger };
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
const OPEN_WAIT = 600, KEY_CLOSES = 400;
// A text value's box makes the value as soon as it opens (seen in the app: Tab past an untouched Notes left an empty
// Notes on the bullet). Moving on from one left blank takes that empty value off again, so passing through a property
// leaves nothing behind.
function leaveBlank(rowUuid, name) {
  if (!rowUuid || !name) return;
  setTimeout(async () => {
    try {
      const schema = await propSchema();
      const prop = schema?.props.find(p => p.lower === name && (p.type === 'default' || p.type === 'url'));
      if (!prop || !UUID.test(rowUuid)) return;
      const [[title] = []] = await dsQuery(`[:find ?t :where [?r :block/uuid #uuid "${rowUuid}"] [?r :${prop.ident} ?v] [?v :block/title ?t]]`);
      if (title === '') await logseq.Editor.removeBlockProperty(rowUuid, prop.ident);
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
// Opens the i-th remembered property. Past the end going forward (Enter): the bullet is done, as Enter in the words
// does it (the owner: "enter should go to next bullet on last enter"); past either end with Tab: back to the words.
function openAt(doc, i, step = 1, pastEnd = backToWords) {
  passOn();
  const found = triggerAt(doc, i, step);
  if (!found) return pastEnd();
  picking.at = found.i;
  picking.keyAt = 0;
  picking.lastKey = '';
  picking.moving = Date.now();
  picking.pickerRoot = null;
  markAt(doc, found.trigger.closest('.bottom-property-pill, .property-pair'));
  press(found.trigger);
  if (isDateTrigger(found.trigger)) settleInDatePicker(doc);
  watchPicker();
}
// Watches the focus while a list is meant to be open. The list closed: right after Enter in it, on to the next empty
// property (past the last, the next bullet); right after Escape, back to the words; back in the bullet's own words (a
// click there), simply done; anything else is leaving the bullet, and what is sure is filled in. A press that opened
// nothing within a moment ends it with nothing taken (second reading). A list that stays open after Enter (a property
// that holds several) is still in it: Enter adds, Tab moves on, Option-Enter finishes the bullet.
function watchPicker() {
  clearInterval(picking.timer);
  picking.timer = setInterval(() => {
    const active = host().activeElement;
    // Logseq draws a row again when its value's box opens (seen: the ring on Notes went): put the mark back.
    if (picking.at >= 0) { const doc = host(), place = propertyPlaces(recordRow(doc, picking.rowUuid)).find(p => p.name === picking.names[picking.at]); if (place) markAt(doc, place.el); }
    if (inPicker(active)) { picking.moving = 0; return; }
    if (picking.moving && Date.now() - picking.moving < OPEN_WAIT) return;
    const opened = !picking.moving;
    if (ownWords(active)) return endPicking(false);
    if (!opened) return endPicking(false); // nothing opened
    if (picking.keyAt && Date.now() - picking.keyAt < KEY_CLOSES) {
      if (picking.lastKey === 'Enter') return openAt(active?.ownerDocument || host(), picking.at + 1, 1, finishBullet);
      return backToWords();
    }
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
    if (!(box && uuidOf(box) === uuid)) await logseq.Editor.editBlock(uuid, { pos: text.length });
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
  if (hushed.uuid === uuid) hushed.uuid = ''; // the bullet is left: Escape's clearing ends (second reading)
  try {
    // The fill goes on behind the next bullet, as with Enter in the words (second reading: waiting for it left
    // nothing in edit for a moment).
    if (live && !live.left) {
      live.left = true;
      live.taken = new Set(live.pieces.filter(piece => piece.guess && live.drawn?.has(guessKey(piece))).map(guessKey));
      if (state.live === live) { state.live = null; hide(); }
      takeShadow(live).catch(error => { warnOnce('the shadow could not be taken', error); notify('The proposed values could not be filled in', 'warning'); });
    }
    // Where Logseq's own Enter puts it: the first child of a bullet whose children show, else the next sibling.
    const row = recordRow(host(), uuid);
    const kids = row && [...row.querySelectorAll('.block-children-container .ls-block[blockid]')].some(el => el.parentElement?.closest('.ls-block[blockid]') === row);
    const next = kids ? await logseq.Editor.insertBlock(uuid, '', { sibling: false, before: true }) : await logseq.Editor.insertBlock(uuid, '', { sibling: true });
    if (next?.uuid) await logseq.Editor.editBlock(next.uuid);
  } catch (error) { warnOnce('could not go on to the next bullet', error); }
  setTimeout(() => { if (picking.returning === uuid) picking.returning = ''; }, 400);
}
function endPicking(left) {
  if (left) passOn();
  const live = picking.live;
  clearInterval(picking.timer); clearTimeout(picking.tab); clearInterval(picking.settle);
  markAt(host(), null);
  Object.assign(picking, { uuid: '', text: '', live: null, rowUuid: '', names: [], at: -1, keyAt: 0, lastKey: '', moving: 0, tab: 0, pickerRoot: null, settle: 0 });
  if (!left || !live || live.left) return;
  // Left from the list: as leaving the words, the sure values only.
  live.left = true;
  live.taken = new Set();
  if (state.live === live) { state.live = null; hide(); }
  takeShadow(live).catch(error => { warnOnce('the shadow could not be taken', error); notify('The proposed values could not be filled in', 'warning'); });
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
    if (!box || !setting('shadowProposals')) return;
    const uuid = uuidOf(box), doc = box.ownerDocument;
    const rowUuid = state.live?.uuid === uuid ? state.live.recordUuid : uuid;
    const names = emptyNames(doc, rowUuid);
    if (!names.length) return; // nothing to go to: the key is Logseq's
    event.preventDefault(); event.stopImmediatePropagation();
    endPicking(false);
    Object.assign(picking, { uuid, text: box.value, live: state.live?.uuid === uuid ? state.live : null, rowUuid, names });
    openAt(doc, 0);
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
    closeThen(event.target, doc => openAt(doc, next, step));
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
const linksOut = text => { const bare = String(text || '').replace(TAG, ' '); const found = bare.match(LINK) || []; return { n: found.length, words: plainWords(bare.replace(LINK, ' ')) }; };
const sameWords = (saved, text) => { const a = linksOut(saved), b = linksOut(text); return a.n === b.n && a.words === b.words; };
async function takeShadow(live) {
  if (!await allowed() || hushed.uuid === live.uuid) return;
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
  if (!pieces.length || !UUID.test(recordUuid)) return;
  const written = [];
  for (const piece of pieces) {
    const tagged = [];
    // A value that rests on a proposed tag (stage D) is written only once the bullet has the tag.
    if (piece.needsTag && !written.some(w => w.kind === 'tag')) continue;
    try {
      if (piece.kind === 'tag') { await logseq.Editor.addBlockTag(recordUuid, piece.tag.uuid); written.push(piece); continue; }
      if (piece.asPage) { if (await takeAsPage(piece, live.uuid, recordUuid)) written.push(piece); continue; }
      if (piece.tagPage) for (const uuid of piece.tagPage.uuids) { await logseq.Editor.addBlockTag(uuid, piece.tagPage.tag.uuid); tagged.push(uuid); }
      if (piece.kind === 'day') await logseq.Editor.upsertBlockProperty(recordUuid, piece.ident, piece.journalId ?? await journalPageFor(piece.day));
      else if (piece.kind === 'number') await logseq.Editor.upsertBlockProperty(recordUuid, piece.ident, piece.ids[0]);
      else if (piece.prop.many) await logseq.Editor.upsertBlockProperty(recordUuid, piece.ident, piece.ids, { entityId: true, reset: true });
      else await logseq.Editor.upsertBlockProperty(recordUuid, piece.ident, piece.ids[0], { entityId: true });
      written.push(piece);
    } catch (error) {
      // The tag a page was given for this fill goes again when the fill fails.
      for (const uuid of tagged) await logseq.Editor.removeBlockTag(uuid, piece.tagPage.tag.uuid).catch(() => {});
      warnOnce(`${piece.prop.title} could not be filled in`, error); notify(`${piece.prop.title} could not be filled in`, 'warning');
    }
  }
  if (!written.length) return;
  const words = cleanWords(String(pick(record, 'block/title') ?? '')) || 'the bullet';
  const undo = async () => {
    for (const piece of [...written].reverse()) {
      if (piece.undo) { await piece.undo(); continue; }
      if (piece.kind === 'tag') { await logseq.Editor.removeBlockTag(recordUuid, piece.tag.uuid); continue; }
      await logseq.Editor.removeBlockProperty(recordUuid, piece.ident);
      if (piece.tagPage) for (const uuid of piece.tagPage.uuids) await logseq.Editor.removeBlockTag(uuid, piece.tagPage.tag.uuid);
    }
  };
  showUndoBar(`${written.map(piece => `${piece.prop.title}: ${piece.shown}${piece.tagPage ? ` (tagged #${piece.tagPage.tag.title})` : ''}`).join(' · ')} filled in on “${words.length > 40 ? words.slice(0, 39) + '…' : words}”`, undo,
    error => { warnOnce('the filled-in values could not be taken off again', error); notify('The values could not be taken off again', 'warning'); });
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
  const titleNow = async () => { const [[title] = []] = await dsQuery(`[:find ?t :where [?b :block/uuid #uuid "${bulletUuid}"] [?b :block/title ?t]]`); return title == null ? null : String(title); };
  const rows = await dsQuery(`[:find ?p ?u ?t :where [?b :block/uuid #uuid "${bulletUuid}"] [?b :block/refs ?p] [?p :block/title ?t] [?p :block/uuid ?u]]`);
  const linked = new Map(rows.map(([id, uuid, title]) => [String(title).toLowerCase(), { id: Number(id), uuid: String(uuid), title: String(title) }]));
  const pairs = piece.asPage.map(x => ({ x, page: linked.get(x.key) }));
  const before = await titleNow();
  // The saved words must still have each tag right after its page: Enter between them sends the tag to the next
  // bullet, and nothing is moved then (second reading).
  if (before == null || pairs.some(pair => !pair.page || !pageTagIn(before, pair.page, pair.x.tag))) return false;
  try {
    for (const { x, page } of pairs) {
      const has = await dsQuery(`[:find ?t :where [?p :block/uuid #uuid "${page.uuid}"] [?p :block/tags ?t] [?t :block/uuid #uuid "${x.tag.uuid}"]]`);
      if (has.length) continue;
      await logseq.Editor.addBlockTag(page.uuid, x.tag.uuid);
      done.push(() => logseq.Editor.removeBlockTag(page.uuid, x.tag.uuid));
    }
    const ids = pairs.map(pair => pair.page.id);
    if (piece.prop.many) await logseq.Editor.upsertBlockProperty(recordUuid, piece.ident, ids, { entityId: true, reset: true });
    else await logseq.Editor.upsertBlockProperty(recordUuid, piece.ident, ids[0], { entityId: true });
    done.push(() => logseq.Editor.removeBlockProperty(recordUuid, piece.ident));
    const removed = pairs.map(({ x, page }) => ({ page, text: pageTagIn(before, page, x.tag).text }));
    const after = pairs.reduce((title, { x, page }) => withoutPageTag(title, page, x.tag), before);
    await logseq.Editor.updateBlock(bulletUuid, after);
    // Undo puts the words back as they were, or, when they were written on meanwhile, only the tags after their pages
    // (second reading: the whole old words would have lost what was written since).
    done.push(async () => {
      const now = await titleNow();
      if (now == null) return;
      await logseq.Editor.updateBlock(bulletUuid, now === after ? before : removed.reduce((title, r) => withPageTag(title, r.page, r.text), now));
    });
    for (const tag of new Set(pairs.map(pair => pair.x.tag))) {
      await logseq.Editor.removeBlockTag(bulletUuid, tag.uuid);
      done.push(() => logseq.Editor.addBlockTag(bulletUuid, tag.uuid));
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
// What one value looks like and says when pointed at; the page that gets a tag is named only there.
function ghostLook(piece) {
  return { cls: `rfs-ghost${piece.guess ? ' rfs-guess' : ''}`,
    title: piece.kind === 'tag' ? 'A guess from the lines this one looks like: Enter gives the bullet this tag and fills in the rest'
      : piece.guess ? 'A guess: Enter fills it in with the rest' : 'Filled in when you leave the bullet' };
}
function drawInPlace(doc = host()) {
  const live = state.live;
  const want = new Map(), rows = live?.recordUuid ? [...doc.querySelectorAll(`.ls-block[blockid="${live.recordUuid}"]`)] : [];
  for (const piece of live?.pieces || []) want.set(piece.ident, piece);
  // Out with what is no longer proposed (another bullet, a value changed, the bullet left).
  for (const g of doc.querySelectorAll('.rfs-ghost')) {
    const piece = want.get(g.dataset.rfsIdent);
    const filled = !g.closest('.rfs-made') && !g.parentElement?.querySelector('.empty-value');
    if (piece && !filled && rows.includes(g.closest('.ls-block[blockid]')) && g.dataset.rfsKey === guessKey(piece)) continue;
    g.closest('[data-refinement-proposal]')?.removeAttribute('data-refinement-proposal');
    g.remove();
  }
  for (const el of doc.querySelectorAll('.rfs-made-pill')) if (!el.querySelector('.rfs-ghost')) el.remove();
  for (const el of doc.querySelectorAll('.positioned-properties.rfs-made')) if (!el.querySelector('.bottom-property-pill')) el.remove();
  for (const row of rows) {
    const pills = pillsOf(row);
    for (const piece of want.values()) {
      const pill = pills.find(p => pillName(p) === piece.prop.lower) || makePill(doc, row, piece);
      const target = pill && (pill.querySelector('.bottom-property-content') || pill);
      // Filled meanwhile in Logseq's own way (from the properties): the proposal for it goes.
      if (target && !pill.classList.contains('rfs-made') && !target.querySelector('.empty-value')) continue;
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
      // A page that would get a tag says so where it shows ("Hannah Reyes #Doctor"; the owner, 0.4.202–0.4.203).
      const words = piece.tagPage ? `${piece.shown} #${piece.tagPage.tag.title}` : piece.shown;
      if (g.textContent !== words) g.textContent = words;
      if (g.className !== look.cls) g.className = look.cls;
      if (g.title !== look.title) g.title = look.title;
      if (!pill.hasAttribute('data-refinement-proposal')) pill.setAttribute('data-refinement-proposal', '');
      (live.drawn ||= new Set()).add(guessKey(piece));
    }
  }
  // A pill marked with nothing of ours left in it (a copy cut short) is given back to Logseq (second reading).
  for (const pill of doc.querySelectorAll('[data-refinement-proposal]')) if (!pill.querySelector('.rfs-ghost')) pill.removeAttribute('data-refinement-proposal');
}
function hide() { drawInPlace(); }
const drawEarly = (doc, records) => { if (!state.live && !doc.querySelector('.rfs-ghost, .rfs-made, [data-refinement-proposal]')) return; if (records.some(r => r.type === 'childList' && ![...r.addedNodes, ...r.removedNodes].every(n => n.nodeType === 1 && n.matches?.('.rfs-ghost, .rfs-made')))) drawInPlace(doc); };

const css = `
/* A proposed value (0.4.202): italic grey, in the record's own property where the value goes; a guess has a dotted
   line under it as well. Greys mixed from the text colour (dark mode). */
.ls-block .positioned-properties.block-below .bottom-property-pill[data-refinement-proposal] { display: flex !important; opacity: 1 !important; }
.bottom-property-pill[data-refinement-proposal] .empty-value { display: none !important; }
.rfs-ghost { color: color-mix(in srgb, currentColor 50%, transparent); font-style: italic; white-space: nowrap; }
.rfs-ghost.rfs-guess { text-decoration: underline dotted; text-decoration-thickness: 1px; text-underline-offset: 3px; }
/* The property Option-Enter is on (0.4.207): a ring in the text colour, as Logseq marks a focused value. */
[data-rfs-at] { outline: 1.5px solid color-mix(in srgb, currentColor 45%, transparent); outline-offset: 2px; border-radius: 4px; }
/* On a row's name the ring is drawn just inside it: the row's box cuts off what is outside (seen in the app). */
.property-key-inner[data-rfs-at] { outline-offset: -2px; }
/* A pill row the plugin made (an untagged bullet, 0.4.213): the pills side by side, as Logseq lays out its own. */
.positioned-properties.rfs-made .bottom-properties-row { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 1rem; row-gap: .25rem; }
.rfs-made-pill { display: inline-flex; align-items: baseline; gap: .3em; }
.rfs-made-name { color: color-mix(in srgb, currentColor 60%, transparent); }
`;

function applyStyles() { sendStyle('refinement-shadow', setting('shadowProposals') ? css : ''); }
function start() {
  ({ dsQuery, UUID, propSchema, propPages, bare, pick, idOf, sendStyle, titleOf, watchDomEarly, alike, parseDay, dayAfter, dayNumber, journalIdFor, journalTitleFor } = take(window.refinementCore, ['dsQuery', 'UUID', 'propSchema', 'propPages', 'bare', 'pick', 'idOf', 'sendStyle', 'titleOf', 'watchDomEarly', 'alike', 'parseDay', 'dayAfter', 'dayNumber', 'journalIdFor', 'journalTitleFor']));
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
  watchDomEarly(drawEarly);
  onUnload(logseq.DB.onChanged(() => { const box = editingBox(host().activeElement); if (box) { clearTimeout(liveTimer); liveTimer = setTimeout(() => compute(box), 150); } }));
  onUnload(logseq.onSettingsChanged((now, before) => { if (settingsSchema.some(item => now?.[item.key] !== before?.[item.key])) { applyStyles(); clearLive(); } }));
  onUnload(() => { clearTimeout(liveTimer); endPicking(false); stopVisiting(); clearLive(); });
}
(window.refinementParts ||= []).push({ name: 'proposals', schema: settingsSchema, start, stop: runUnloadTasks });
// For tools/shadow-check.js and tools/pictures.js (read-only): the rules and what the shadow draws.
window.refinementShadowInner = { piecesFor, withFreshLinks, withoutPageTag, withPageTag, contextFor, daysFor, guessDataFor, addHistory, BLOCK_PULL, drawInPlace, css };
})();
