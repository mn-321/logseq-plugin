/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Proposals, piece 1 (0.4.197): what the plugin is sure of while a bullet is written. Rebuilt on the foundation and the
   model; the old proposals part (parts/proposals.js, resting) pencilled values into the pills and took them with Tab.

   While you write a bullet, what the plugin is sure of shows faintly in the bullet's own properties (since 0.4.201;
   it was a line under the bullet), and is filled in when you leave the bullet (Enter, a click elsewhere, the
   arrows): nothing is written before that, and the bar at the bottom offers Undo after. Escape clears it, and that
   bullet is left alone for good. The words typed are never changed.

   The record a bullet belongs to is the bullet itself when its tags give it properties, else its parent when the
   parent's do (notes under an appointment belong to the appointment). The sure pieces, for the record's empty
   properties only:
   - a page linked in the words ([[Dr. Mei Chen]]) that fits a link property of the record's tags (doctor takes
     #Doctor); one link per property, and nothing when a one-value property would get two (two doctors named: quiet);
   - the page the record is written on, when its tag fits (a consultation written on Dr. Mei Chen's page), once;
   - the journal day, for an empty "date" of a record written on a journal page.

   Piece 2 (0.4.200): guesses, for empty properties the sure pieces leave empty (and not one kept quiet by two names).
   They show in the same place with a dotted line under them as well, and Enter takes them with the rest (under the
   same Undo; before 0.4.202 a click took each); leaving any other way takes only the sure values. A guess is made when every rule that speaks agrees:
   - plain words: a page named without brackets, by its whole title or alias ("Northgate") or by a word of its title
     that no other page of the right tag shares ("Dr. Patel", "the tingling"); a tie names no one;
   - the same line written before: an earlier node under the same tag with nearly the same words gives its values,
     when all such nodes agree ("Wiped out all day." has had Fatigue);
   - the parent's values: a tagged bullet under a tagged bullet gets the parent's values for properties both have;
   - a linked page with no tag yet, for the first empty place it could fill when there are one or two (taking it also
     gives the page that place's tag).
   Writes only in the graphs named in its setting, as every part that writes to notes does. */
const shared = window.refinementShared;
const { host, notify, showUndoBar, graphNamedIn } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Refinements (proposals): ', leaves: { elements: '.rfs-ghost, .rfs-made', attributes: ['data-refinement-proposal'] } });
let dsQuery, UUID, propSchema, propPages, bare, pick, idOf, sendStyle, titleOf, watchDomEarly;
const take = (core, names) => { const all = { ...core, ...core.provided }; for (const name of names) if (all[name] === undefined) warnOnce(`${name} is missing from the core`); return all; };

const settingsSchema = [
  { key: 'shadowHeading', type: 'heading', group: 'writing', rank: 1, title: 'Proposals', default: null,
    legend: 'What the plugin is sure of, shown faintly in the bullet’s own properties and filled in when you leave it',
    zone: '<div><span class="m">Provider:</span> <span class="m"><i><u style="text-decoration-style: dotted">Dr. Raj Patel</u></i></span> <span class="m">· Date: <i>Oct 20</i></span></div>',
    description: 'Changes here apply right away.' },
  { key: 'shadowProposals', type: 'boolean', title: 'Proposals while you write', default: true,
    description: 'While you write a bullet, what the plugin is sure of shows faintly in the bullet’s own properties, where it will go: from your words, the page, the bullet a note is written under and the journal day (a linked doctor for the doctor property, the day for the date). Leaving the bullet (Enter, a click elsewhere, the arrows) fills those in, with Undo in the bar at the bottom. They are in italic grey; a guess has a dotted line under it as well: a page named in plain words (“Dr. Patel”), the values an earlier line like this one had, the parent bullet’s values, a linked page with no tag yet. Enter fills in everything shown, guesses too; leaving the bullet any other way fills in only what is not a guess. Escape clears them, and that bullet is then left alone. Your words are never changed. Applies at once.' },
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
const isBlock = node => !!(node && pick(node, 'block/page'));
const cleanWords = text => String(text || '').replace(/#?\[\[([^\[\]]+)\]\]/g, (m, key) => /^[0-9a-f-]{36}$/i.test(key) ? '' : key).replace(/\s+/g, ' ').trim();
// Logseq keeps the tags typed at the end of a bullet apart from its words, so they are left out when the saved words are compared.
const plainWords = text => cleanWords(String(text || '').replace(TAG, ' ')).toLowerCase();

/* The rules. b is the bullet in edit (pulled), text its words (the text box, or the saved title). Returns the
   record the pieces are for and the pieces: { ident, prop, kind: 'node' | 'day', ids, shown, tagPage?, day?, journalId?, how }. */
function piecesFor(b, text, ctx) {
  const { schema } = ctx;
  const { links, tags: typedTags } = inWords(text, ctx);
  const ownTags = [...new Set([...(pick(b, 'block/tags') || []).map(idOf), ...typedTags])];
  const parent = pick(b, 'block/parent');
  let record = b, fields = fieldsOfTags(ownTags, schema);
  if (!fields.length && isBlock(parent)) {
    const parentFields = fieldsOfTags((pick(parent, 'block/tags') || []).map(idOf), schema);
    if (parentFields.length) { record = parent; fields = parentFields; }
  }
  const pieces = [];
  if (!fields.length) return { record, pieces };
  const recordTags = record === b ? ownTags : (pick(record, 'block/tags') || []).map(idOf);
  const page = pick(b, 'block/page'), journalDay = Number(pick(page, 'block/journal-day') || 0);
  const pageTags = new Set((pick(page, 'block/tags') || []).map(idOf));
  const pageAsPage = page && !journalDay ? { id: idOf(page), uuid: String(pick(page, 'block/uuid') ?? ''), title: String(pick(page, 'block/title') ?? ''), tags: [...pageTags].map(id => ({ id })) } : null;
  const held = new Set(fields.flatMap(prop => valuesOf(record, prop.ident)));
  const free = links.filter(p => !held.has(p.id)), used = new Set(), quiet = new Set();
  let pageUsed = false;
  // The most particular property claims a link first (doctor, taking #Doctor, before with, taking #Person), and a
  // property kept quiet by two names keeps them: two doctors named do not spill into "with" (found by the scorer).
  const depth = id => { let d = 0, q = [id]; const seen = new Set(); while (q.length) { const c = q.shift(); if (seen.has(c)) continue; seen.add(c); for (const p of schema.parentsOf.get(c) || []) { q.push(p); } d = Math.max(d, seen.size); } return d; };
  const particular = prop => prop.type === 'node' ? Math.max(0, ...prop.classes.map(c => depth(c.id))) : -1;
  const ordered = fields.map((prop, i) => ({ prop, i, rank: particular(prop) })).sort((a, b) => b.rank - a.rank || a.i - b.i).map(x => x.prop);
  for (const prop of ordered) {
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
  const guesses = guessesFor({ b, text, record, fields: ordered, recordTags, free, used, quiet, done: new Set(pieces.map(p => p.ident)), ctx });
  guesses.sort((a, b) => fields.indexOf(a.prop) - fields.indexOf(b.prop));
  return { record, pieces: [...pieces, ...guesses] };
}

/* Piece 2: the guesses. Words are compared as lower-case words, links read as the names they show. */
const WORD = /[\p{L}\p{N}]+/gu;
const wordsOf = text => String(text || '').toLowerCase().match(WORD) || [];
// Words that name nothing on their own, even when a title has them.
const COMMON = new Set('with from that this have been after before about again today tomorrow morning evening night week weeks home done back into over than then them they there what when will just very more some other first last next little still feel felt good well better worse every each same also only once twice like says said told rang call called video check post appointment report results result about'.split(' '));
const telling = word => word.length >= 4 && !COMMON.has(word) && !/^\d+$/.test(word);
// The words a bullet's text shows outside its links and tags (what plain words can name).
const freeWords = text => wordsOf(String(text || '').replace(/#?\[\[[^\[\]]*\]\]/g, ' ').replace(TAG, ' '));
// All the words a text shows, a saved link ([[uuid]]) read as its page's title, tags left out (for "the same line").
function shownWords(text, ctx) {
  const named = String(text || '').replace(/#?\[\[([^\[\]]+)\]\]/g, (m, key) => ' ' + (/^[0-9a-f-]{36}$/i.test(key) ? ctx.byKey.get(key.toLowerCase())?.title || '' : key) + ' ');
  return new Set(wordsOf(named.replace(TAG, ' ')));
}
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
// Earlier nodes under the record's tags with nearly the same words (at least three in four words shared).
const SIMILAR = .75;
function similarBefore(text, tagIds, skip, ctx) {
  const words = shownWords(text, ctx), found = new Map();
  if (words.size < 2) return [];
  for (const tag of tagIds) for (const entry of ctx.history?.get(tag) || []) {
    if (skip.has(entry.id) || found.has(entry.id)) continue;
    let shared = 0;
    for (const w of words) if (entry.words.has(w)) shared++;
    if (shared / (words.size + entry.words.size - shared) >= SIMILAR) found.set(entry.id, entry);
  }
  return [...found.values()];
}
const sameIds = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
function guessesFor({ b, text, record, fields, recordTags, free, used, quiet, done, ctx }) {
  const own = record === b, parent = pick(b, 'block/parent');
  const parentTags = own && isBlock(parent) ? (pick(parent, 'block/tags') || []).map(idOf) : [];
  const before = own ? similarBefore(text, recordTags, new Set([idOf(b)]), ctx) : [];
  const words = freeWords(text), spoken = new Set(used), out = [];
  const open = prop => !done.has(prop.ident) && !quiet.has(prop.ident) && !valuesOf(record, prop.ident).length;
  const nodeOf = id => ctx.byId.get(id);
  for (const prop of fields) {
    if (!open(prop)) continue;
    const isNode = prop.type === 'node' && prop.classes.length, isDate = prop.type === 'date';
    if (!isNode && !isDate) continue;
    const said = [];
    // The parent's values, for a property both have.
    if (parentTags.length) { const v = valuesOf(parent, prop.ident); if (v.length) said.push({ ids: v, how: 'parent' }); }
    if (isNode) {
      const classIds = new Set(prop.classes.map(c => c.id));
      // The same line written before: all such nodes that have the property agree.
      const theirs = before.map(entry => entry.values.get(prop.ident)).filter(v => v?.length);
      if (theirs.length && theirs.every(v => sameIds(v, theirs[0]))) said.push({ ids: theirs[0], how: 'before' });
      const named = namedIn(words, classIds, ctx, spoken);
      if (named) said.push({ ids: [named.id], how: 'words' });
    }
    if (!said.length || !said.every(s => sameIds(s.ids, said[0].ids))) continue;
    const ids = said[0].ids;
    if (!prop.many && ids.length !== 1) continue;
    if (isDate) {
      const day = ctx.days?.get(ids[0]);
      if (day) out.push({ ident: prop.ident, prop, kind: 'day', ids, day, journalId: ids[0], shown: dayText(day), how: said.map(s => s.how).join('+'), guess: true });
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
// The nodes under each tag with link properties, their words and values, for "the same line written before"; and
// the aliases (original, alias), for plain words. Kept apart from the context, per graph, read again at most
// every five minutes (guessDataFor).
function addHistory(ctx, entries) {
  ctx.history = new Map();
  for (const entry of entries) {
    const kept = { id: entry.id, words: entry.words || shownWords(entry.title, ctx), values: entry.values };
    if (kept.words.size < 2) continue;
    for (const tag of entry.tags) { if (!ctx.history.has(tag)) ctx.history.set(tag, []); ctx.history.get(tag).push(kept); }
  }
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
  ctx.names = null;
  return addHistory(ctx, data.entries);
}
async function loadGuessData(ctx) {
  const { schema } = ctx;
  const nodeProps = schema.props.filter(p => p.type === 'node' && p.classes.length);
  const tagIds = [...new Set([...schema.classProps.keys(), ...[...schema.parentsOf.keys()]])].filter(c => fieldsOfTags([c], schema).some(p => nodeProps.includes(p)));
  const [rows, aliases] = await Promise.all([
    tagIds.length && nodeProps.length ? dsQuery(`[:find (pull ?b [:db/id :block/title {:block/tags [:db/id]} ${nodeProps.map(p => `{:${p.ident} [:db/id]}`).join(' ')}])
      :where [(ground #{${tagIds.join(' ')}}) [?t ...]] [?b :block/tags ?t] [?b :block/page _] (not [?b :logseq.property/deleted-at _])]`).catch(error => { warnOnce('the earlier lines could not be read', error); return []; }) : [],
    dsQuery('[:find ?o ?a :where [?o :block/alias ?a]]').catch(() => [])]);
  return { aliases: aliases.map(([o, a]) => [Number(o), Number(a)]),
    entries: rows.map(([n]) => ({ id: idOf(n), words: shownWords(String(pick(n, 'block/title') ?? ''), ctx), tags: (pick(n, 'block/tags') || []).map(idOf),
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
// Sure only with evidence: at least 5 such nodes under the tag (or a tag it extends), and 19 in 20 dated the day written.
const DATED_LEAST = 5, DATED_SHARE = .95;
function datedWhenWritten(tagIds, ctx) {
  let same = 0, other = 0;
  for (const id of tagIds) { const n = ctx.dated?.get(id); if (n) { same += n.same; other += n.other; } }
  return same + other >= DATED_LEAST && same / (same + other) >= DATED_SHARE;
}

/* The bullet in edit: its shadow is worked out 40 ms after each key from the text box and one small pull of the
   block, drawn in the record's own properties, and taken when the bullet is left unless Escape cleared it. Only what
   was shown is taken: a record whose row is not on screen (a note zoomed into) gets nothing (second reading). */
// taken: the guesses Enter took in the bullet being written ({ uuid, at, keys }), filled in with the rest when it is left.
const ENTER_LEAVES = 500;
const state = window.refinementShadow = { live: null, times: [], taken: { uuid: '', keys: new Set() } };
const guessKey = piece => `${piece.ident} ${piece.ids.join(',')}`;
const takenIn = uuid => state.taken.uuid === uuid ? state.taken.keys : new Set();
const OFF_KEY = 'refinementShadowOff';
let off = new Set();
const readOff = () => { try { off = new Set(JSON.parse(host().defaultView.localStorage.getItem(OFF_KEY) || '[]')); } catch { off = new Set(); } };
function dismiss(uuid) {
  off.add(uuid);
  while (off.size > 500) off.delete(off.values().next().value);
  try { host().defaultView.localStorage.setItem(OFF_KEY, JSON.stringify([...off])); } catch { /* kept for this session */ }
}
const editingBox = el => (el?.matches?.('textarea') && el.closest('.ls-block[blockid]')) ? el : null;
const uuidOf = box => box.closest('.ls-block[blockid]')?.getAttribute('blockid') || '';
let liveTimer = 0, liveVersion = 0;
async function allowed() {
  return setting('shadowProposals') && await graphNamedIn(setting('shadowGraphs'));
}
// No shadow: nor anything taken in it, so a guess taken earlier is never written on a later visit (second reading).
function clearLive() { state.live = null; state.taken = { uuid: '', keys: new Set() }; hide(); }
async function compute(box) {
  const uuid = uuidOf(box);
  if (!uuid || off.has(uuid)) { clearLive(); return; }
  const version = ++liveVersion, text = box.value, t0 = performance.now();
  try {
    if (!await allowed()) { clearLive(); return; }
    const ctx = await guessDataFor(await daysFor(await contextFor()), { wait: false });
    const b = await pullBlock(uuid);
    if (version !== liveVersion) return;
    if (!b) { clearLive(); return; }
    const { record, pieces } = piecesFor(b, text, ctx);
    state.times.push(Math.round(performance.now() - t0)); if (state.times.length > 50) state.times.shift();
    if (!pieces.length) { clearLive(); return; }
    if (state.taken.uuid !== uuid) state.taken = { uuid, keys: new Set() };
    state.live = { uuid, text, recordUuid: String(pick(record, 'block/uuid') ?? ''), pieces, at: Date.now() };
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
  if (!state.live || state.live.uuid !== uuid) { if (state.taken.uuid === uuid) state.taken = { uuid: '', keys: new Set() }; return; }
  // Enter's taking counts only when the bullet is left right after it: an Enter that kept the bullet in edit (at the
  // very start of its words, or in document mode) must not let a later click away fill in guesses (second reading).
  const live = state.live, taken = Date.now() - (state.taken.at || 0) < ENTER_LEAVES ? new Set(takenIn(uuid)) : new Set();
  setTimeout(() => {
    const now = editingBox(host().activeElement);
    if (now && uuidOf(now) === live.uuid) return;
    if (live.left) return;
    live.left = true;
    live.taken = taken;
    state.left = live; // for tools/shadow-test.js
    if (state.live === live) { state.live = null; hide(); }
    if (state.taken.uuid === live.uuid) state.taken = { uuid: '', keys: new Set() };
    takeShadow(live).catch(error => { warnOnce('the shadow could not be taken', error); notify('The proposed values could not be filled in', 'warning'); });
  }, 120);
}
// Escape clears the shadow, and the bullet is left alone from then on; the caret stays (a second Escape is Logseq's).
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
// The saved words and the typed ones, links left out (a saved link is an id, a typed one a name, and a day's or a
// block's name is not in the page list) but counted, and tags left out (Logseq keeps them apart from the words).
const linksOut = text => { const found = String(text || '').match(LINK) || []; return { n: found.length, words: plainWords(String(text || '').replace(LINK, ' ')) }; };
const sameWords = (saved, text) => { const a = linksOut(saved), b = linksOut(text); return a.n === b.n && a.words === b.words; };
async function takeShadow(live) {
  if (!await allowed() || off.has(live.uuid)) return;
  const ctx = await guessDataFor(await daysFor(await contextFor()), { wait: false });
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
  const { record, pieces: found } = piecesFor(b, live.text, ctx);
  const taken = live.taken || new Set(), shown = live.drawn || new Set();
  const pieces = found.filter(piece => shown.has(guessKey(piece)) && (!piece.guess || taken.has(guessKey(piece))));
  const recordUuid = String(pick(record, 'block/uuid') ?? '');
  if (!pieces.length || !UUID.test(recordUuid)) return;
  const written = [];
  for (const piece of pieces) {
    const tagged = [];
    try {
      if (piece.tagPage) for (const uuid of piece.tagPage.uuids) { await logseq.Editor.addBlockTag(uuid, piece.tagPage.tag.uuid); tagged.push(uuid); }
      if (piece.kind === 'day') await logseq.Editor.upsertBlockProperty(recordUuid, piece.ident, piece.journalId);
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
      await logseq.Editor.removeBlockProperty(recordUuid, piece.ident);
      if (piece.tagPage) for (const uuid of piece.tagPage.uuids) await logseq.Editor.removeBlockTag(uuid, piece.tagPage.tag.uuid);
    }
  };
  showUndoBar(`${written.map(piece => `${piece.prop.title}: ${piece.shown}${piece.tagPage ? ` (tagged #${piece.tagPage.tag.title})` : ''}`).join(' · ')} filled in on “${words.length > 40 ? words.slice(0, 39) + '…' : words}”`, undo,
    error => { warnOnce('the filled-in values could not be taken off again', error); notify('The values could not be taken off again', 'warning'); });
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
    title: piece.guess ? 'A guess: Enter fills it in with the rest' : 'Filled in when you leave the bullet' };
}
function drawInPlace(doc = host()) {
  const live = state.live;
  const want = new Map(), rows = live?.recordUuid ? [...doc.querySelectorAll(`.ls-block[blockid="${live.recordUuid}"]`)] : [];
  for (const piece of live?.pieces || []) want.set(piece.ident, piece);
  // Out with what is no longer proposed (another bullet, a value changed, the bullet left).
  for (const g of doc.querySelectorAll('.rfs-ghost')) {
    const piece = want.get(g.dataset.rfsIdent);
    if (piece && rows.includes(g.closest('.ls-block[blockid]')) && g.dataset.rfsKey === guessKey(piece)) continue;
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
      if (!target) continue;
      const look = ghostLook(piece);
      let g = [...target.querySelectorAll(':scope > .rfs-ghost')].find(el => el.dataset.rfsIdent === piece.ident);
      if (!g) {
        g = doc.createElement('span');
        g.setAttribute('contenteditable', 'false');
        g.dataset.rfsIdent = piece.ident;
        g.dataset.rfsKey = guessKey(piece);
        if (piece.guess) g.dataset.guess = guessKey(piece);
        // A page that would get a tag says so where it shows ("Hannah Reyes #Doctor"; the owner, 0.4.202–0.4.203).
        g.textContent = piece.tagPage ? `${piece.shown} #${piece.tagPage.tag.title}` : piece.shown;
        target.appendChild(g);
      }
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
.rfs-made-pill { display: inline-flex; align-items: baseline; gap: .3em; }
.rfs-made-name { color: color-mix(in srgb, currentColor 60%, transparent); }
`;

function applyStyles() { sendStyle('refinement-shadow', setting('shadowProposals') ? css : ''); }
function start() {
  ({ dsQuery, UUID, propSchema, propPages, bare, pick, idOf, sendStyle, titleOf, watchDomEarly } = take(window.refinementCore, ['dsQuery', 'UUID', 'propSchema', 'propPages', 'bare', 'pick', 'idOf', 'sendStyle', 'titleOf', 'watchDomEarly']));
  void titleOf;
  applyStyles();
  readOff();
  const win = host().defaultView;
  listen(win, ['input'], onInput);
  listen(win, ['focusin'], onFocusIn);
  listen(win, ['focusout'], onFocusOut);
  listen(win, ['keydown'], onKey);
  listen(win, ['pointerdown', 'mousedown', 'mouseup', 'click'], onGuessPress);
  watchDomEarly(drawEarly);
  onUnload(logseq.DB.onChanged(() => { const box = editingBox(host().activeElement); if (box) { clearTimeout(liveTimer); liveTimer = setTimeout(() => compute(box), 150); } }));
  onUnload(logseq.onSettingsChanged((now, before) => { if (settingsSchema.some(item => now?.[item.key] !== before?.[item.key])) { applyStyles(); clearLive(); } }));
  onUnload(() => { clearTimeout(liveTimer); clearLive(); });
}
(window.refinementParts ||= []).push({ name: 'proposals', schema: settingsSchema, start, stop: runUnloadTasks });
// For tools/shadow-check.js and tools/pictures.js (read-only): the rules and what the shadow draws.
window.refinementShadowInner = { piecesFor, contextFor, daysFor, guessDataFor, addHistory, BLOCK_PULL, drawInPlace, css };
})();
