/* Loaded by loader.js before main.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* Copy-as-rich-text part of DB Refinements (was the Copy as Rich Text plugin 0.5.2): turns a Logseq page or block into plain, tidy formatted text for people who
   don't use Logseq. Paste it into Pages, Word, Mail or Google Docs; from there it can become a PDF.
   The plugin only reads your notes. It never changes them. */

// The shared plumbing (parts/shared.js). This part needs Logseq's window itself (for its clipboard).
const { notify } = window.refinementShared;
const hostWindow = () => window.refinementShared.host().defaultView;

/* ---------- Look and feel of the copied text ----------
   Inline styles only: an app receiving pasted text ignores stylesheets. A font is always named,
   because without one most apps fall back to Times. */
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "Menlo, Consolas, 'Courier New', monospace";
const STYLE = {
  body: `font-family:${FONT};font-size:11pt;line-height:1.45;color:#1f1f1f;`,
  h: { 1: 'font-size:20pt;font-weight:600;margin:18pt 0 8pt;', 2: 'font-size:15pt;font-weight:600;margin:14pt 0 6pt;',
    3: 'font-size:12.5pt;font-weight:600;margin:12pt 0 4pt;' },
  p: 'margin:0 0 7pt;',
  ul: 'margin:0 0 7pt;padding-left:18pt;',
  li: 'margin:0 0 3pt;',
  meta: 'color:#6b6b6b;font-size:9.5pt;',
  code: `font-family:${MONO};font-size:9.5pt;background:#f2f2f2;padding:0 2pt;`,
  // Code and quotes are paragraphs, not <pre>/<blockquote>: pasting apps keep a paragraph's spacing more reliably.
  pre: `font-family:${MONO};font-size:9.5pt;background:#f5f5f5;margin:0 0 9pt;`,
  quote: 'margin:0 0 9pt 18pt;padding-left:10pt;border-left:2pt solid #cccccc;color:#444444;font-style:italic;',
  mark: 'background:#fff1a8;',
  a: 'color:#1f5fa8;text-decoration:underline;',
  // Title block: a larger title, then a quiet date / prepared-by line over a thin rule.
  title: 'font-size:22pt;font-weight:600;line-height:1.2;margin:0 0 4pt;',
  byline: 'color:#6b6b6b;font-size:10pt;margin:0 0 14pt;padding-bottom:8pt;border-bottom:0.75pt solid #d0d0d0;',
  // Timelines: a table with the date on the left, grouped under month rows.
  table: 'border-collapse:collapse;width:100%;margin:2pt 0 10pt;',
  month: 'padding:9pt 0 3pt;font-weight:600;font-size:10.5pt;border-bottom:0.75pt solid #d0d0d0;',
  when: 'width:58pt;padding:4pt 10pt 3pt 0;vertical-align:top;color:#6b6b6b;white-space:nowrap;',
  what: 'padding:4pt 0 3pt;vertical-align:top;'
};

const escapeHtml = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Code keeps its line breaks and indentation.
const codeHtml = text => escapeHtml(text).replace(/ {2}/g, '&nbsp; ').replace(/\t/g, '&nbsp;&nbsp;&nbsp; ').replace(/\n/g, '<br>');
const titleOf = node => String(node?.title ?? node?.content ?? '');

/* ---------- Reading the graph ---------- */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidsIn = uuids => `[(identity [${[...new Set(uuids)].map(String).filter(u => UUID.test(u)).map(u => `#uuid "${u}"`).join(' ')}]) [?u ...]]`;
const dsQuery = async query => {
  const rows = await logseq.DB.datascriptQuery(query);
  return Array.isArray(rows) ? rows : [];
};
const idOf = value => typeof value === 'number' ? value : (value && typeof value === 'object' ? value.id ?? value['db/id'] ?? value[':db/id'] : null);
const keyName = value => String(value ?? '').replace(/^:/, '');

/* Everything stored on the given blocks, with each property's name, type and position. Values that
   point at other things (a person, a choice, a date) come back as numbers and are looked up after. */
async function attributesOf(uuids) {
  if (!uuids.length) return new Map();
  const rows = await dsQuery(`[:find ?u ?a ?name ?type ?order ?v
    :in $ :where ${uuidsIn(uuids)} [?b :block/uuid ?u] [?b ?a ?v] [?p :db/ident ?a]
    [(get-else $ ?p :block/title "") ?name] [(get-else $ ?p :logseq.property/type :none) ?type]
    [(get-else $ ?p :block/order "") ?order]]`);
  const byBlock = new Map();
  for (const [u, a, name, type, order, v] of rows) {
    const key = String(u).toLowerCase();
    if (!byBlock.has(key)) byBlock.set(key, new Map());
    const attrs = byBlock.get(key);
    const ident = keyName(a);
    if (!attrs.has(ident)) attrs.set(ident, { ident, name, type: keyName(type), order: String(order || ''), values: [] });
    attrs.get(ident).values.push(v);
  }
  return byBlock;
}

/* What a referenced thing is called: a page's or block's title, a stored value, or a built-in name. */
const entityCache = new Map();
async function describeEntities(ids) {
  const wanted = [...new Set(ids)].filter(id => Number.isSafeInteger(id) && id > 0 && !entityCache.has(id));
  if (!wanted.length) return;
  const rows = await dsQuery(`[:find (pull ?e [:db/id :db/ident :block/title :logseq.property/value :block/journal-day]) :in $ :where [(identity [${wanted.join(' ')}]) [?e ...]]]`);
  for (const [entity] of rows) {
    if (!entity) continue;
    const value = entity[':logseq.property/value'] ?? entity['logseq.property/value'] ?? entity.value;
    entityCache.set(entity.id ?? entity['db/id'], {
      title: entity.title ?? '', value: value && typeof value === 'object' ? (value.title ?? '') : (value ?? ''),
      ident: keyName(entity.ident ?? entity['db/ident'] ?? ''),
      journalDay: entity['journal-day'] ?? entity[':block/journal-day'] ?? entity['block/journal-day'] ?? null
    });
  }
}
const entityText = id => {
  const entity = entityCache.get(id);
  if (!entity) return '';
  if (entity.value !== '' && entity.value != null) return String(entity.value);
  return entity.title || '';
};

// Links in DB graphs are stored as [[uuid]], tags as #[[uuid]], block references as ((uuid)).
const storedRef = /(#?\[\[|\(\()([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(\]\]|\)\))/gi;
const refCache = new Map();
async function refName(uuid, depth = 2) {
  const key = uuid.toLowerCase();
  if (refCache.has(key)) return refCache.get(key);
  let name = '';
  try {
    const entity = await logseq.Editor.getPage(key) || await logseq.Editor.getBlock(key);
    name = titleOf(entity) || entity?.originalName || entity?.name || '';
    if (depth > 1) name = await resolveRefs(name, depth - 1);
  } catch (error) { /* left blank */ }
  refCache.set(key, name);
  return name;
}
// Swaps stored ids for the words people see, keeping [[ ]] and # so the formatter can recognise them.
async function resolveRefs(text, depth = 2) {
  const value = String(text || '');
  const names = new Map();
  for (const [, , uuid] of value.matchAll(storedRef)) names.set(uuid.toLowerCase(), await refName(uuid, depth));
  return value.replace(storedRef, (match, open, uuid) => {
    const name = names.get(uuid.toLowerCase()) || '';
    if (open === '((') return name;
    return open === '#[[' ? `#[[${name}]]` : `[[${name}]]`;
  });
}

/* ---------- Turning one block's text into formatted text ---------- */
const bareUrl = /\bhttps?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g;

function inlineHtml(raw) {
  const kept = [];
  const keep = html => `\u0000${kept.push(html) - 1}\u0000`;
  let text = String(raw);
  text = text.replace(/`([^`\n]+)`/g, (m, code) => keep(`<code style="${STYLE.code}">${escapeHtml(code)}</code>`));
  // [label](url), and [label]([[page]]) which in Logseq is a labelled link to a page: just the label.
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, target) => /^\[\[.*\]\]$|^\(\(.*\)\)$/.test(target)
    ? keep(inlineHtml(label))
    : keep(`<a href="${escapeHtml(target)}" style="${STYLE.a}">${inlineHtml(label)}</a>`));
  text = text.replace(bareUrl, url => keep(`<a href="${escapeHtml(url)}" style="${STYLE.a}">${escapeHtml(url)}</a>`));
  // Page links and tags read as ordinary words. (In DB graphs a real tag is stored as #[[id]]; a bare #word is just text.)
  text = text.replace(/#?\[\[([^\]]*)\]\]/g, (m, name) => keep(escapeHtml(name)));
  text = escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_(?!\s)(.+?)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/(==|\^\^)(.+?)\1/g, `<span style="${STYLE.mark}">$2</span>`)
    .replace(/(^|[^\w$])\$(?!\s)([^$\n]+?)(?<!\s)\$(?![\w$])/g, '$1<em>$2</em>')
    .replace(/\n/g, '<br>');
  return text.replace(/\u0000(\d+)\u0000/g, (m, i) => kept[Number(i)]);
}

// The same text without formatting, for apps that only take plain text.
function inlinePlain(raw) {
  return String(raw)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, target) => /^\[\[|^\(\(/.test(target) ? label : `${label} (${target})`)
    .replace(/#?\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, '$1$2')
    .replace(/~~(.+?)~~|==(.+?)==|\^\^(.+?)\^\^/g, '$1$2$3')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1$2')
    .replace(/(^|[^\w$])\$(?!\s)([^$\n]+?)(?<!\s)\$(?![\w$])/g, '$1$2');
}

/* ---------- One block, made simple for outside readers ---------- */
// A task's status is shown as a quiet word in front: "Open: …", "Done: …". A chose words over boxes or circles.
const STATUS_WORD = { backlog: 'Backlog', todo: 'Open', doing: 'In progress', 'in-review': 'In review', done: 'Done', canceled: 'Cancelled', cancelled: 'Cancelled' };
function taskMark(statusId) {
  if (!statusId) return { html: '', plain: '', afterHtml: '', afterPlain: '' };
  const ident = entityCache.get(statusId)?.ident?.replace(/^logseq\.property\/status\./, '') || 'todo';
  const word = STATUS_WORD[ident] || 'Open';
  return { html: `<span style="color:#6b6b6b;">${escapeHtml(word)}:</span> `, plain: word + ': ', afterHtml: '', afterPlain: '' };
}

async function describeBlock(node, attrs, shown) {
  const text = await resolveRefs(titleOf(node));
  const a = attrs.get(String(node.uuid).toLowerCase()) || new Map();
  const first = ident => (a.get(ident) || a.get(ident.split('/').pop()))?.values?.[0];
  const display = keyName(first('logseq.property.node/display-type'));
  let heading = Number(first('logseq.property/heading')) || 0;
  let body = text.trim();
  const md = body.match(/^(#{1,6})\s+(.*)$/s);
  if (md) { heading = md[1].length; body = md[2]; }
  const tagIds = (a.get('block/tags') || a.get('tags'))?.values || [];
  const statusId = idOf(first('logseq.property/status'));
  // A tag written in the text (#Idea) reads as the plain word, like any other link.
  for (const id of tagIds) {
    const name = entityCache.get(idOf(id))?.title;
    if (name) body = body.replace(new RegExp(`(^|[\\s(])#${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'g'), `$1${name}`);
  }
  const properties = [...a.values()].filter(p => p.ident.startsWith('user.property/') && shown.has(p.ident))
    .sort((x, y) => x.order.localeCompare(y.order) || x.name.localeCompare(y.name));
  // Blocks that only hold a property's value (a URL, a text value) are shown with the property instead.
  const isValue = first('logseq.property/created-from-property') != null;
  return { node, body, heading: Math.min(heading, 3), display, tagIds, statusId, properties, isValue };
}

function propertyText(property) {
  const values = property.values.map(v => {
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    if (property.type === 'datetime' && typeof v === 'number') return new Date(v).toLocaleString();
    const id = idOf(v);
    if (id != null && entityCache.get(id)?.journalDay) return showDate(entityCache.get(id).journalDay);
    if (id != null && property.type !== 'number' && property.type !== 'checkbox' || (id != null && entityCache.has(id))) {
      const words = entityText(id);
      if (words) return words;
    }
    return typeof v === 'object' ? '' : String(v);
  }).filter(Boolean).sort();
  return values.length ? `${property.name || property.ident.replace(/^user\.property\//, '')}: ${values.join(', ')}` : '';
}

/* ---------- The whole copy ---------- */
function collect(nodes, out = []) {
  for (const node of nodes || []) {
    if (!node || Array.isArray(node)) continue;
    out.push(node);
    collect(node.children, out);
  }
  return out;
}

// Reads everything the copy needs, and lists the properties found, before anything is formatted.
const isQueryAttr = ident => /^(logseq\.property\/)?query$/.test(ident);
function scan(attrs, uuids, found, pending) {
  for (const uuid of uuids) for (const p of (attrs.get(String(uuid).toLowerCase()) || new Map()).values()) {
    // Only things that point elsewhere: your properties, tags, status, the query text and the page a
    // block is on. Timestamps are numbers too, so they are left alone.
    const isUser = p.ident.startsWith('user.property/');
    if (isUser ? !['checkbox', 'datetime'].includes(p.type) : /(^|\/)(tags|status|page)$/.test(p.ident) || isQueryAttr(p.ident)) {
      for (const v of p.values) {
        const id = idOf(v);
        if (Number.isSafeInteger(id) && id > 0 && id < 2147483647) pending.push(id);
      }
    }
    if (!isUser) continue;
    const entry = found.get(p.ident) || { ident: p.ident, name: p.name || p.ident.replace(/^user\.property\//, ''), type: p.type, count: 0 };
    entry.count += 1;
    found.set(p.ident, entry);
  }
}

/* Live queries: their results are read once and copied as a plain list, so outside readers see what
   the query showed. Simple queries ("(task todo)") go through DB.q, advanced ones through customQuery. */
async function runQuery(text) {
  const query = String(text || '').trim();
  if (!query) return [];
  let rows = [];
  try {
    rows = /^[[{]/.test(query) ? await logseq.DB.customQuery(query) : await logseq.DB.q(query);
  } catch (error) { console.warn('Copy as Rich Text: query failed', query, error); }
  const seen = new Set();
  return (Array.isArray(rows) ? rows.flat(Infinity) : []).filter(row => {
    if (!row || typeof row !== 'object' || !row.uuid || seen.has(String(row.uuid))) return false;
    seen.add(String(row.uuid));
    return true;
  });
}

async function prepare({ title, titleNode, roots }) {
  const all = [...collect(roots), ...(titleNode ? [titleNode] : [])];
  const attrs = await attributesOf(all.map(n => n.uuid));
  const found = new Map();
  let pending = [];
  scan(attrs, all.map(n => n.uuid), found, pending);
  await describeEntities(pending);

  // Queries in what is being copied.
  const results = [];
  const queries = [];
  for (const node of all) {
    const a = attrs.get(String(node.uuid).toLowerCase());
    const query = a && [...a.values()].find(p => isQueryAttr(p.ident));
    if (!query) continue;
    const value = query.values[0];
    const text = typeof value === 'string' ? value : entityText(idOf(value));
    node.queryResults = (await runQuery(text)).filter(row => String(row.uuid) !== String(node.uuid));
    results.push(...node.queryResults);
    queries.push({ uuid: String(node.uuid), label: (await resolveRefs(titleOf(node))).trim() || text, node });
  }
  if (results.length) {
    const more = await attributesOf(results.map(r => r.uuid));
    for (const [key, value] of more) if (!attrs.has(key)) attrs.set(key, value);
    pending = [];
    scan(attrs, results.map(r => r.uuid), found, pending);
    await describeEntities(pending);
  }

  // Dates each query's results could be sorted by.
  for (const query of queries) query.dates = dateChoices(attrs, query.node.queryResults, found);
  const properties = [...found.values()].sort((x, y) => x.name.localeCompare(y.name));
  return { title, titleNode, roots, attrs, properties, queries: queries.filter(q => q.node.queryResults.length) };
}

function dateChoices(attrs, results, found) {
  const dates = [];
  const resultAttrs = results.map(r => attrs.get(String(r.uuid).toLowerCase()) || new Map());
  const has = ident => resultAttrs.some(a => a.has(ident) || (ident.startsWith('logseq.property/') && a.has(ident.split('/').pop())));
  if (resultAttrs.some(a => (a.get('journal-day') || a.get('block/journal-day')) ||
    entityCache.get(idOf((a.get('page') || a.get('block/page'))?.values?.[0]))?.journalDay)) dates.push({ key: 'journal', name: 'Journal date' });
  for (const p of found.values()) if (['date', 'datetime'].includes(p.type) && has(p.ident)) dates.push({ key: p.ident, name: p.name });
  // Logseq's own task dates.
  for (const [ident, name] of [['logseq.property/deadline', 'Deadline'], ['logseq.property/scheduled', 'Scheduled']])
    if (has(ident)) dates.push({ key: ident, name });
  dates.push({ key: 'created', name: 'Date created' });
  return dates;
}

// The date a block is sorted by, as a number (yyyymmdd for days, or a timestamp), or null.
const DAY = /^\d{8}$/;
function sortDate(attrs, uuid, key) {
  const a = attrs.get(String(uuid).toLowerCase()) || new Map();
  const first = ident => (a.get(ident) || (ident.startsWith('logseq.property/') ? a.get(ident.split('/').pop()) : null))?.values?.[0];
  if (key === 'created') return first('created-at') ?? first('block/created-at') ?? null;
  if (key === 'journal') return first('journal-day') ?? first('block/journal-day') ??
    entityCache.get(idOf(first('page') ?? first('block/page')))?.journalDay ?? null;
  const value = first(key);
  if (typeof value === 'number' && !entityCache.has(value)) return value; // a date and time
  return entityCache.get(idOf(value))?.journalDay ?? null;
}
const toDate = n => DAY.test(String(n)) ? new Date(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100) : new Date(n);
const showDate = n => toDate(n).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const sameScale = n => DAY.test(String(n)) ? toDate(n).getTime() : n;

// layout 'document': top-level blocks are paragraphs, nested ones bullets. 'outline': every block is a
// bullet, indented exactly as in Logseq.
async function buildDocument({ title, titleNode, roots, attrs }, { shown, layout = 'document', sorts = {}, format = {} }) {
  const html = [];
  const plain = [];
  if (title) {
    const words = await resolveRefs(title);
    if (format.titleBlock) {
      const byline = [new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })];
      if (format.preparedBy?.trim()) byline.push(`Prepared by ${format.preparedBy.trim()}`);
      html.push(`<h1 style="${STYLE.title}">${inlineHtml(words)}</h1><p style="${STYLE.byline}">${byline.map(escapeHtml).join(' · ')}</p>`);
      plain.push(inlinePlain(words), byline.join(' · '), '');
    } else {
      html.push(`<h1 style="${STYLE.h[1]}">${inlineHtml(words)}</h1>`);
      plain.push(inlinePlain(words), '');
    }
    if (titleNode) {
      const page = await describeBlock(titleNode, attrs, shown);
      const meta = page.properties.map(propertyText).filter(Boolean);
      if (meta.length) {
        html.push(`<p style="${STYLE.p}${STYLE.meta}">${meta.map(escapeHtml).join('<br>')}</p>`);
        plain.push(...meta, '');
      }
    }
  }

  async function render(nodes, depth) {
    const items = [];
    for (const node of nodes || []) {
      if (!node || Array.isArray(node)) continue;
      const block = await describeBlock(node, attrs, shown);
      const tags = block.tagIds.map(id => entityCache.get(idOf(id))?.ident || '').map(t => t.replace(/^logseq\.class\//, ''));
      if (block.isValue || tags.some(t => /^template$/i.test(t))) continue; // templates mean nothing outside Logseq
      if (node.queryResults) { items.push({ block, children: [], results: node.queryResults }); continue; }
      const children = (node.children || []).filter(c => c && !Array.isArray(c));
      if (!block.body.trim() && !children.length) continue; // empty bullets
      items.push({ block, children });
    }
    if (!items.length) return;
    const asList = depth > 0 || layout === 'outline';
    if (asList) html.push(`<ul style="${STYLE.ul}">`);
    for (const { block, children, results } of items) {
      if (results) { await renderResults(block, results, depth, asList); continue; }
      const mark = taskMark(block.statusId);
      const meta = block.properties.map(propertyText).filter(Boolean);
      const metaHtml = meta.length ? `<br><span style="${STYLE.meta}">${meta.map(escapeHtml).join(' · ')}</span>` : '';
      let inner;
      if (block.display === 'code' || block.display === 'math') inner = { html: `<p style="${STYLE.pre}">${codeHtml(block.body)}</p>`, block: true };
      else if (block.display === 'quote') inner = { html: `<p style="${STYLE.quote}">${inlineHtml(block.body)}</p>`, block: true };
      else inner = { html: mark.html + inlineHtml(block.body) + mark.afterHtml };
      const indent = '    '.repeat(Math.max(layout === 'outline' ? depth : depth - 1, 0));
      const words = block.display === 'code' || block.display === 'math' ? block.body : inlinePlain(block.body);
      plain.push((asList ? indent + '• ' : '') + (inner.block ? '' : mark.plain) + words.replace(/\n/g, '\n' + indent + '  ') + (inner.block ? '' : mark.afterPlain));
      if (meta.length) plain.push(indent + (asList ? '  ' : '') + meta.join(' · '));

      if (asList) {
        html.push(`<li style="${STYLE.li}">${block.heading && !inner.block ? `<strong>${inner.html}</strong>` : inner.html}${metaHtml}`);
        await render(children, depth + 1);
        html.push('</li>');
      } else {
        if (inner.block) html.push(inner.html);
        else if (block.heading) {
          const level = Math.min(block.heading + (title ? 1 : 0), 3);
          html.push(`<h${level} style="${STYLE.h[level]}">${inner.html}</h${level}>`);
        }
        else html.push(`<p style="${STYLE.p}">${inner.html}</p>`);
        if (meta.length) html.push(`<p style="${STYLE.p}${STYLE.meta}">${meta.map(escapeHtml).join(' · ')}</p>`);
        await render(children, depth + 1);
        if (!block.heading) plain.push('');
      }
    }
    if (asList) html.push('</ul>');
  }
  // A query: its title (if any), then its results as a list, sorted by the chosen date. When sorted
  // by a date, each result starts with that date, which makes a timeline.
  async function renderResults(block, results, depth, asList) {
    const { sortKey = 'none', newestFirst = false } = sorts[String(block.node.uuid)] || {};
    const rows = [];
    for (const row of results) {
      const described = await describeBlock(row, attrs, shown);
      const when = sortKey === 'none' ? null : sortDate(attrs, row.uuid, sortKey);
      rows.push({ described, when });
    }
    if (sortKey !== 'none') {
      rows.sort((x, y) => (x.when == null) - (y.when == null) ||
        (newestFirst ? sameScale(y.when) - sameScale(x.when) : sameScale(x.when) - sameScale(y.when)));
    }
    const label = block.body.replace(/\s*\((simple|advanced) query\)\s*$/i, '').trim();
    const indent = '    '.repeat(Math.max(layout === 'outline' ? depth : depth - 1, 0));
    if (label) {
      if (asList) html.push(`<li style="${STYLE.li}">${inlineHtml(label)}`);
      else html.push(`<p style="${STYLE.p}"><strong>${inlineHtml(label)}</strong></p>`);
      plain.push((asList ? indent + '• ' : '') + inlinePlain(label));
    }
    const inner = asList && label ? indent + '    ' : (asList ? indent : '');
    if (sortKey !== 'none') {
      timeline(rows, sortKey, inner);
      if (asList && label) html.push('</li>');
      if (!asList) plain.push('');
      return;
    }
    html.push(`<ul style="${STYLE.ul}">`);
    for (const { described, when } of rows) {
      const mark = taskMark(described.statusId);
      const meta = described.properties.filter(p => p.ident !== sortKey).map(propertyText).filter(Boolean);
      const date = when == null ? '' : showDate(when);
      const words = described.body.split('\n')[0];
      html.push(`<li style="${STYLE.li}">${date ? `<strong>${escapeHtml(date)}</strong> · ` : ''}${mark.html}${inlineHtml(words)}${mark.afterHtml}` +
        `${meta.length ? `<br><span style="${STYLE.meta}">${meta.map(escapeHtml).join(' · ')}</span>` : ''}</li>`);
      plain.push(`${inner}• ${date ? date + ' · ' : ''}${mark.plain}${inlinePlain(words)}${mark.afterPlain}`);
      if (meta.length) plain.push(`${inner}  ${meta.join(' · ')}`);
    }
    html.push('</ul>');
    if (asList && label) html.push('</li>');
    if (!asList) plain.push('');
  }

  // Sorted results as a timeline: month rows ("October 2026"), then one row per result with its
  // day on the left. Results without the date come last, under "No date".
  function timeline(rows, sortKey, inner) {
    html.push(`<table style="${STYLE.table}">`);
    let group = null;
    for (const { described, when } of rows) {
      const date = when == null ? null : toDate(when);
      const month = date ? date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'No date';
      if (month !== group) {
        // Each month is its own table body, so a PDF page break doesn't strand a month heading.
        html.push(`${group === null ? '' : '</tbody>'}<tbody style="break-inside:avoid-page;">`);
        group = month;
        html.push(`<tr><td colspan="2" style="${STYLE.month}">${escapeHtml(month)}</td></tr>`);
        plain.push(`${inner}${month}`);
      }
      const day = date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
      const mark = taskMark(described.statusId);
      const meta = described.properties.filter(p => p.ident !== sortKey).map(propertyText).filter(Boolean);
      const words = described.body.split('\n')[0];
      html.push(`<tr><td style="${STYLE.when}">${escapeHtml(day)}</td><td style="${STYLE.what}">${mark.html}${inlineHtml(words)}${mark.afterHtml}` +
        `${meta.length ? `<br><span style="${STYLE.meta}">${meta.map(escapeHtml).join(' · ')}</span>` : ''}</td></tr>`);
      plain.push(`${inner}  ${day.padEnd(8)}${mark.plain}${inlinePlain(words)}${mark.afterPlain}`);
      if (meta.length) plain.push(`${inner}  ${' '.repeat(8)}${meta.join(' · ')}`);
    }
    html.push(group === null ? '</table>' : '</tbody></table>');
  }

  await render(roots, 0);

  return {
    html: `<div style="${STYLE.body}">${html.join('')}</div>`,
    plain: plain.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
  };
}

/* ---------- The clipboard ----------
   Tries the plugin's own frame first (it has focus after a click in the chooser), then Logseq's
   window (which has focus after a menu click), then the older copy command in each. */
async function writeClipboard({ html, plain }) {
  for (const win of [window, hostWindow()]) {
    try {
      const item = new win.ClipboardItem({
        'text/html': new win.Blob([html], { type: 'text/html' }),
        'text/plain': new win.Blob([plain], { type: 'text/plain' })
      });
      await win.navigator.clipboard.write([item]);
      return true;
    } catch (error) { /* try the next way */ }
  }
  for (const doc of [document, hostWindow().document]) {
    let done = false;
    const onCopy = event => {
      event.clipboardData.setData('text/html', html);
      event.clipboardData.setData('text/plain', plain);
      event.preventDefault();
      done = true;
    };
    doc.addEventListener('copy', onCopy, true);
    try { doc.execCommand('copy'); } catch (error) { /* try the next way */ } finally { doc.removeEventListener('copy', onCopy, true); }
    if (done) return true;
  }
  return false;
}

/* ---------- Saving as PDF ----------
   The same simplified text, laid out on A4/Letter pages in a hidden frame, then handed to the Mac's
   print window, where "Save as PDF" (bottom left) writes the file. The page title becomes the file name. */
const cssString = text => `"${String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '\\3c ').replace(/\n/g, ' ')}"`;
function printToPdf({ html }, title, format = {}) {
  const box = `font-family:${FONT};font-size:8.5pt;color:#8a8a8a;`;
  const footer = (format.footer?.trim() ? `@bottom-left { content: ${cssString(format.footer.trim())}; ${box} }` : '') +
    (format.pageNumbers ? `@bottom-right { content: "Page " counter(page) " of " counter(pages); ${box} }` : '');
  return new Promise(resolve => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:1000px;border:0;';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(String(title).replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Logseq export')}</title>
      <style>@page { margin: 18mm 18mm 20mm; ${footer} } body { margin: 0; } h1, h2, h3, p:has(+ table) { break-after: avoid; } li, p, tr { break-inside: avoid-page; }</style>
      </head><body>${html}</body></html>`);
    doc.close();
    setTimeout(() => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print(); // waits while the print window is open
      } catch (error) {
        console.error(error);
        notify(`Could not open the print window: ${error.message}`, 'error');
      }
      setTimeout(() => { frame.remove(); resolve(); }, 500);
    }, 200);
  });
}

/* ---------- Choosing which properties to include ----------
   A small window lists the properties found in what is being copied. Unticked ones are remembered
   in the plugin's settings, so the next copy starts from the same choice. New properties start ticked. */
const hiddenProperties = () => {
  try {
    const list = logseq.settings?.hiddenProperties;
    return new Set(Array.isArray(list) ? list : []);
  } catch (error) { return new Set(); }
};
const savedLayout = () => {
  try { return logseq.settings?.layout === 'outline' ? 'outline' : 'document'; } catch (error) { return 'document'; }
};
let chosenLayout = 'document';
// Title block and PDF page options, remembered.
const savedFormat = () => {
  const s = logseq.settings || {};
  return { titleBlock: s.titleBlock !== false, preparedBy: typeof s.preparedBy === 'string' ? s.preparedBy : '',
    footer: typeof s.footer === 'string' ? s.footer : '', pageNumbers: s.pageNumbers !== false };
};
let chosenFormat = { titleBlock: true, preparedBy: '', footer: '', pageNumbers: true };
// How each query's results are sorted, remembered per query block.
let chosenSorts = {};
const savedSorts = () => {
  try { const value = logseq.settings?.querySorts; return value && typeof value === 'object' ? { ...value } : {}; }
  catch (error) { return {}; }
};
const rememberHidden = hidden => {
  try { logseq.updateSettings({ hiddenProperties: [...hidden], layout: chosenLayout, querySorts: chosenSorts, ...chosenFormat }); } catch (error) { console.warn('Copy as Rich Text: could not remember the choice', error); }
};

const CHOOSER_CSS = `
  html, body { background: transparent; margin: 0; }
  .rc-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.28); display: flex; align-items: flex-start; justify-content: center; padding-top: 12vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif; font-size: 14px; color: #222; }
  .rc-card { background: #fff; border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,.25); width: 360px; max-height: 70vh; display: flex; flex-direction: column; }
  .rc-head { padding: 16px 18px 6px; font-weight: 600; }
  .rc-sub { padding: 0 18px 10px; color: #777; font-size: 12.5px; }
  .rc-list { overflow: auto; padding: 4px 10px; border-top: 1px solid #eee; border-bottom: 1px solid #eee; }
  .rc-list label { display: flex; align-items: center; gap: 9px; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
  .rc-list label:hover { background: #f4f4f4; }
  .rc-count { margin-left: auto; color: #999; font-size: 12px; }
  .rc-all { padding: 0 18px 6px; font-size: 12.5px; }
  .rc-sort { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 0 18px 8px; font-size: 13px; }
  .rc-qname { flex: 1 1 100%; font-weight: 500; }
  .rc-sort select { font: inherit; padding: 2px 4px; }
  .rc-sort label { display: flex; align-items: center; gap: 5px; cursor: pointer; }
  .rc-layout { padding: 4px 10px 12px; font-size: 13px; }
  .rc-layout label { display: flex; align-items: flex-start; gap: 9px; padding: 5px 8px; border-radius: 6px; cursor: pointer; line-height: 1.35; }
  .rc-layout label:hover { background: #f4f4f4; }
  .rc-layout input { margin-top: 3px; }
  .rc-field { display: flex; align-items: center; gap: 8px; padding: 3px 18px; font-size: 13px; }
  .rc-field span { width: 92px; color: #555; }
  .rc-field select { flex: 1; font: inherit; padding: 2px 4px; }
  .rc-field input { flex: 1; font: inherit; padding: 3px 6px; border: 1px solid #ccc; border-radius: 5px; }
  .rc-check { display: flex; align-items: center; gap: 8px; padding: 3px 18px; font-size: 13px; cursor: pointer; }
  .rc-all a { color: #1f5fa8; cursor: pointer; margin-right: 12px; }
  .rc-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px 16px; }
  .rc-foot button { font: inherit; padding: 6px 14px; border-radius: 6px; border: 1px solid #ccc; background: #fff; cursor: pointer; }
  .rc-foot button.rc-go { background: #1f5fa8; border-color: #1f5fa8; color: #fff; }
  @media (prefers-color-scheme: dark) {
    .rc-card { background: #2a2a2a; color: #eee; } .rc-list { border-color: #3a3a3a; } .rc-list label:hover { background: #333; }
    .rc-layout label:hover { background: #333; }
    .rc-field span { color: #aaa; } .rc-field input { background: #333; color: #eee; border-color: #555; }
    .rc-foot button { background: #333; color: #eee; border-color: #555; } .rc-all a { color: #8bb8ee; }
  }`;

function chooseProperties({ properties, queries, title }, what, onChoose) {
  return new Promise(resolve => {
    let style = document.getElementById('rc-style');
    if (!style) {
      style = Object.assign(document.createElement('style'), { id: 'rc-style', textContent: CHOOSER_CSS });
      document.head.appendChild(style);
    }
    const hidden = hiddenProperties();
    const layout = savedLayout();
    const saved = savedSorts();
    const format = savedFormat();
    // Timelines: each query sorts by its first date unless you chose otherwise for it before.
    const sortOf = q => {
      const last = saved[q.uuid] || {};
      const key = last.sortKey === 'none' ? 'none' : (q.dates.find(d => d.key === last.sortKey) || q.dates[0] || { key: 'none' }).key;
      return { key, newest: last.newestFirst === true };
    };
    const root = document.createElement('div');
    root.className = 'rc-backdrop';
    root.innerHTML = `<div class="rc-card" role="dialog" aria-label="Copy options">
      <div class="rc-head">Copy ${escapeHtml(what)} as rich text</div>
      <div class="rc-layout">
        <label><input type="radio" name="rc-layout" value="document" ${layout === 'document' ? 'checked' : ''}><span><b>Document</b>: top level as paragraphs, nested blocks as indented bullets</span></label>
        <label><input type="radio" name="rc-layout" value="outline" ${layout === 'outline' ? 'checked' : ''}><span><b>Outline</b>: every block a bullet, indented as in Logseq</span></label>
      </div>
      ${title ? `<label class="rc-check"><input type="checkbox" class="rc-title" ${format.titleBlock ? 'checked' : ''}> Title block with today's date</label>
      <label class="rc-field"><span>Prepared by</span><input type="text" class="rc-by" placeholder="optional" value="${escapeHtml(format.preparedBy)}"></label>` : ''}
      <label class="rc-field"><span>PDF footer</span><input type="text" class="rc-footer" placeholder="optional, e.g. Confidential" value="${escapeHtml(format.footer)}"></label>
      <label class="rc-check" style="padding-bottom:10px"><input type="checkbox" class="rc-pages" ${format.pageNumbers ? 'checked' : ''}> Page numbers on the PDF</label>
      ${queries.length ? `<div class="rc-sub">Query results, sorted by date as a timeline:</div>
      ${queries.map(q => { const { key, newest } = sortOf(q); return `<div class="rc-sort" data-query="${escapeHtml(q.uuid)}">
        <span class="rc-qname">${escapeHtml(inlinePlain(q.label).slice(0, 60))}</span>
        <select><option value="none" ${key === 'none' ? 'selected' : ''}>Logseq's order</option>
        ${q.dates.map(d => `<option value="${escapeHtml(d.key)}" ${d.key === key ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}</select>
        <label><input type="checkbox" ${newest ? 'checked' : ''}> newest first</label></div>`; }).join('')}` : ''}
      ${properties.length ? `<div class="rc-sub">Ticked properties are included. Your choices are remembered.</div>
      <div class="rc-all"><a data-all="1">Tick all</a><a data-all="0">Untick all</a></div>
      <div class="rc-list">${properties.map(p => `<label><input type="checkbox" value="${escapeHtml(p.ident)}" ${hidden.has(p.ident) ? '' : 'checked'}>
        <span>${escapeHtml(p.name)}</span><span class="rc-count">${p.count}</span></label>`).join('')}</div>` : ''}
      <div class="rc-foot"><button class="rc-cancel">Cancel</button><button class="rc-pdf">Save as PDF…</button><button class="rc-go">Copy</button></div></div>`;
    document.body.appendChild(root);
    const boxes = [...root.querySelectorAll('.rc-list input[type=checkbox]')];
    let finished = false;
    const finish = async (go, action = 'copy') => {
      if (finished) return;
      finished = true;
      document.removeEventListener('keydown', onKey, true);
      let shown = null;
      if (go) {
        shown = new Set(boxes.filter(b => b.checked).map(b => b.value));
        chosenLayout = root.querySelector('input[name=rc-layout]:checked')?.value || 'document';
        chosenSorts = savedSorts();
        chosenFormat = { titleBlock: root.querySelector('.rc-title')?.checked ?? format.titleBlock,
          preparedBy: root.querySelector('.rc-by')?.value ?? format.preparedBy,
          footer: root.querySelector('.rc-footer').value, pageNumbers: root.querySelector('.rc-pages').checked };
        for (const row of root.querySelectorAll('.rc-sort')) chosenSorts[row.dataset.query] =
          { sortKey: row.querySelector('select').value, newestFirst: row.querySelector('input').checked };
        const nextHidden = hiddenProperties();
        for (const b of boxes) b.checked ? nextHidden.delete(b.value) : nextHidden.add(b.value);
        rememberHidden(nextHidden);
      }
      try { if (shown) await onChoose({ shown, layout: chosenLayout, sorts: chosenSorts, format: chosenFormat }, action); } // copied here, while this frame still has the click
      catch (error) { console.error(error); notify(`Copy stopped: ${error.message}`, 'error'); }
      finally {
        root.remove();
        logseq.hideMainUI({ restoreEditingCursor: true });
        resolve();
      }
    };
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); finish(false); }
      if (event.key === 'Enter') { event.preventDefault(); finish(true); }
    };
    document.addEventListener('keydown', onKey, true);
    root.addEventListener('click', event => {
      if (event.target === root || event.target.closest('.rc-cancel')) finish(false);
      else if (event.target.closest('.rc-go')) finish(true);
      else if (event.target.closest('.rc-pdf')) finish(true, 'pdf');
      const all = event.target.closest('[data-all]');
      if (all) boxes.forEach(b => { b.checked = all.dataset.all === '1'; });
    });
    logseq.showMainUI({ autoFocus: true });
    setTimeout(() => root.querySelector('.rc-go').focus(), 50);
  });
}

async function copy(source, what) {
  try {
    const prepared = await prepare(source);
    const run = async (choice, action) => {
      const result = await buildDocument(prepared, choice);
      if (!result.plain.trim()) return notify('Nothing to copy here', 'warning');
      if (action === 'pdf') return printToPdf(result, source.title || result.plain.split('\n')[0], choice.format);
      if (await writeClipboard(result)) notify(`Copied ${what} as rich text`);
      else notify('Could not reach the clipboard', 'error');
    };
    await chooseProperties({ ...prepared, title: source.title }, what, run);
  } catch (error) {
    console.error(error);
    notify(`Copy stopped: ${error.message}`, 'error');
  }
}

/* ---------- What gets copied ---------- */
async function blockTree(uuid) {
  return logseq.Editor.getBlock(uuid, { includeChildren: true });
}

// Selected blocks, without repeating a block whose parent is also selected.
async function selectedTrees() {
  const selected = await logseq.Editor.getSelectedBlocks();
  if (!selected?.length) return [];
  const trees = [];
  for (const block of selected) {
    const tree = await blockTree(block.uuid);
    if (tree) trees.push(tree);
  }
  const inside = new Set();
  for (const tree of trees) for (const node of collect(tree.children)) inside.add(String(node.uuid));
  return trees.filter(tree => !inside.has(String(tree.uuid)));
}

async function copyPage(pageId) {
  const page = pageId ? await logseq.Editor.getPage(pageId) : await logseq.Editor.getCurrentPage();
  if (!page) return notify('Open a page first', 'warning');
  if (!page.name && !page.originalName && page.page) return copyBlock({ uuid: page.uuid }); // zoomed into a block
  const roots = await logseq.Editor.getPageBlocksTree(page.uuid);
  await copy({ title: titleOf(page) || page.originalName || page.name, titleNode: page, roots }, 'page');
}

async function copyBlock(event) {
  const uuid = typeof event?.uuid === 'string' ? event.uuid : null;
  if (uuid) {
    const tree = await blockTree(uuid);
    if (!tree) return notify('Could not read that block', 'error');
    return copy({ roots: [tree] }, 'block');
  }
  const trees = await selectedTrees();
  if (trees.length) return copy({ roots: trees }, trees.length > 1 ? `${trees.length} blocks` : 'block');
  const current = await logseq.Editor.getCurrentBlock();
  if (current) return copy({ roots: [await blockTree(current.uuid)] }, 'block');
  return copyPage();
}

function main() {
  logseq.Editor.registerBlockContextMenuItem('Copy as rich text', copyBlock);
  logseq.App.registerPageMenuItem?.('Copy page as rich text', event => copyPage(event?.page));
  logseq.App.registerCommandPalette({ key: 'rich-copy-page', label: 'Copy page as rich text' }, () => copyPage());
  logseq.App.registerCommandPalette({ key: 'rich-copy-selection', label: 'Copy selected blocks as rich text' }, () => copyBlock());
}

const settingsSchema = [{
  key: 'richCopyHeading', type: 'heading', title: 'Copy as rich text', default: null,
  description: 'Bullet right-click menu, page “…” menu or command palette. Title block, footer, page numbers and query sort order are chosen in the copy window and remembered.'
}, {
  key: 'layout', type: 'enum', enumPicker: 'radio', enumChoices: ['document', 'outline'], default: 'document', title: 'Layout',
  description: 'document: top-level blocks as paragraphs, nested ones as bullets. outline: every block a bullet, indented as in Logseq. Also chosen in the copy window.'
}, {
  key: 'hiddenProperties', type: 'object', default: [], title: 'Properties left out',
  description: 'Property names unticked in the copy window. Change them there, not here.'
}];
(window.refinementParts ||= []).push({ name: 'rich copy', schema: settingsSchema, start: main, stop: () => {} });
})();
