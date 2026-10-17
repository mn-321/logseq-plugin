/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Todos (0.4.18): a window listing every task in the graph, easier to scan than Logseq's Tasks
   table and changeable in place. Opened from the toolbar button, the command palette ("Todos") or
   its shortcut.
   - Tasks are grouped by when they need you (late, today, tomorrow, this week, later, no date), or
     by status, or by page. Chips at the top pick open, doing, recently done or all tasks.
   - The circle before a task changes its status, the bars after it its priority, the date its due
     date. Changes are written straight to the task, as Logseq's own property editor would.
   - Clicking a task's text goes to it; Shift-click opens it in the right sidebar.
   - The box at the top adds a task to today's journal.
   A task is a block with a status, or a block tagged #Task (or a tag that extends Task). Logseq 2.0.2
   stores the status and priority as built-in choices (:logseq.property/status.todo ...) and due and
   planned dates as times in milliseconds (:logseq.property/deadline, :logseq.property/scheduled).
   Giving a block a status also tags it #Task. Everything is drawn in Logseq's own page, so it follows
   the theme.
   0.4.19: the same list also shows as a full view in the main area (a plugin route, #/refinement-todos)
   and, simpler, as a panel in the right sidebar (a plugin sidebar renderer). Both are React components
   from Logseq's own React (logseq.Experiments.React) that hold the plugin's plain DOM view. */
// The shared plumbing (parts/shared.js): its header says what each helper does.
const shared = window.refinementShared;
const { host } = shared;
const PANEL_CLASS = 'refinement-todos-backdrop';
// This part's own clean-up list; main.js runs it when the plugin unloads.
const { warnOnce, onUnload, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (todos): ' });

const settingsSchema = [
  { key: 'todosHeading', type: 'heading', title: 'Todos', default: null,
    description: 'A window with every task in the graph, grouped by when it needs you, by status or by page. Open it from the checklist button in the toolbar, from the command palette (Todos) or with its shortcut.' },
  { key: 'todosToolbarButton', type: 'boolean', title: 'Todos button in the toolbar', default: true,
    description: 'A checklist button at the top right of Logseq opens Todos. Applies after you reload the plugin.' },
  { key: 'todosOpensAs', type: 'enum', title: 'The buttons and shortcuts open Todos and Expectations as', default: 'page', enumChoices: ['window', 'page', 'sidebar'], enumPicker: 'radio',
    description: 'page: a full view in the main area, like a page. window: a window over the page. sidebar: a simpler list in the right sidebar. All three are also in the command palette, and each one has buttons to move to the others.' },
  { key: 'todosShortcut', type: 'string', title: 'Open Todos', default: 'mod+alt+t',
    description: 'Opens Todos the way chosen above. mod+alt+t is Cmd+Option+T on a Mac. Leave empty for no shortcut. Applies after you reload the plugin.' },
  { key: 'todosDoneDays', type: 'number', title: 'Days shown under “Done”', default: 14,
    description: 'The Done chip lists tasks finished or canceled in this many past days, newest first. Expectations use it too.' },
  { key: 'expectationsHeading', type: 'heading', title: 'Expectations', default: null,
    description: 'Things you are waiting on someone else for, which are not tasks of your own. A list like Todos, made from the blocks with the tag below. These blocks are left out of Todos.' },
  { key: 'expectationsTag', type: 'string', title: 'Tag of an expectation', default: 'Expectation',
    description: 'Blocks with this tag (or a tag that extends it) are expectations. Write the tag name without #.' },
  { key: 'expectationsStateProperty', type: 'string', title: 'Property that holds where it stands', default: 'juncture',
    description: 'A choice property of the tag, such as juncture (Waiting, Updated, No change, Done). Its choices take the place of a task’s status; a choice named Done, Received or Canceled counts as finished. Leave empty to use Logseq’s own status.' },
  { key: 'expectationsToolbarButton', type: 'boolean', title: 'Expectations button in the toolbar', default: true,
    description: 'An hourglass button at the top right of Logseq opens Expectations, the same way as Todos. Applies after you reload the plugin.' },
  { key: 'expectationsShortcut', type: 'string', title: 'Open Expectations', default: 'mod+alt+e',
    description: 'Opens Expectations the way chosen for Todos. mod+alt+e is Cmd+Option+E on a Mac. Leave empty for no shortcut. Applies after you reload the plugin.' },
];
const setting = shared.settingReader(settingsSchema);

// Each list's own choices (grouping, chips), kept for next time on this computer.
const prefsCache = {};
function savedPrefsFor(key) {
  return prefsCache[key] ||= Object.assign({ group: 'when', view: 'open', urgent: false, hideBacklog: false }, (() => {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (error) { return {}; }
  })());
}
const savePrefsFor = key => { try { localStorage.setItem(key, JSON.stringify(prefsCache[key])); } catch (error) { /* kept for this session only */ } };

/* ---------- Reading tasks ---------- */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dsQuery = async query => {
  const rows = await logseq.DB.datascriptQuery(query);
  return Array.isArray(rows) ? rows : [];
};
// Query results name attributes with or without the leading colon.
const pick = (node, name) => node?.[name] ?? node?.[':' + name] ?? node?.[name.replace(/^block\//, '')];
const identOf = value => String(pick(value, 'db/ident') ?? pick(value, 'ident') ?? '').replace(/^:/, '');

const STATUS_LABEL = { backlog: 'Backlog', todo: 'Todo', doing: 'Doing', 'in-review': 'In review', done: 'Done', canceled: 'Canceled' };
// The Status property's choices, in the graph's order: Logseq's six built-in ones (known by the end of
// their ident) and any the user added (known by their title, and drawn as a dotted circle, or as
// finished or dropped when their name says so). Filled by loadChoiceTitles().
let statusChoices = Object.entries(STATUS_LABEL).map(([key, title]) => ({ key, title, id: null, ident: 'logseq.property/status.' + key }));
const statusKeyOf = value => {
  if (!value) return 'todo';
  const ident = identOf(value).replace(/^logseq\.property\/status\./, '');
  if (ident && ident !== identOf(value)) return ident;
  const id = pick(value, 'db/id') ?? value?.id;
  return statusChoices.find(choice => choice.id != null && choice.id === id)?.key || String(pick(value, 'block/title') ?? '').toLowerCase() || 'todo';
};
function statusLook(key) {
  if (STATUS_LABEL[key]) return key;
  if (/^(done|received|complete|completed|finished|closed|resolved|shipped)$/.test(key)) return 'done';
  if (/^(canceled|cancelled|dropped|abandoned|wont.?do|won.?t do)$/.test(key)) return 'canceled';
  return 'other';
}
// Groups and menus: doing and in review first, then the other open ones in the graph's order, then finished and dropped ones.
const statusOrder = () => {
  const rank = choice => ({ doing: 0, 'in-review': 1 }[choice.key] ?? (statusLook(choice.key) === 'done' ? 8 : statusLook(choice.key) === 'canceled' ? 9 : 5));
  return statusChoices.map((choice, i) => [rank(choice), i, choice.key]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(item => item[2]);
};
const PRIORITIES = ['urgent', 'high', 'medium', 'low'];
const PRIORITY_LABEL = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' };
const isOpen = task => task.status !== 'done' && task.status !== 'canceled';
// The titles Logseq gives its built-in choices; a value is written by its title.
const choiceTitles = { status: {}, priority: {} };
async function loadChoiceTitles() {
  const rows = await dsQuery(`[:find ?pi (pull ?v [:db/id :db/ident :block/title :block/order])
    :where [?p :db/ident ?pi] [(contains? #{:logseq.property/status :logseq.property/priority} ?pi)]
           [?v :block/closed-value-property ?p]]`);
  const statuses = [];
  for (const [propIdent, value] of rows) {
    const ident = identOf(value);
    const title = String(pick(value, 'block/title') ?? '');
    const m = ident.match(/^logseq\.property\/(status|priority)\.(.+)$/);
    if (m) choiceTitles[m[1]][m[2]] = title;
    if (String(propIdent).replace(/^:/, '') !== 'logseq.property/status' || !title) continue;
    statuses.push({ key: m ? m[2] : title.toLowerCase(), title, id: pick(value, 'db/id') ?? value?.id ?? null, ident: m ? ident : null, order: String(pick(value, 'block/order') ?? '') });
  }
  if (statuses.length) {
    statuses.sort((a, b) => a.order.localeCompare(b.order));
    statusChoices = statuses;
  }
}

const PULL = `[:db/id :block/uuid :block/title :block/updated-at :block/name
  :logseq.property/deadline :logseq.property/scheduled
  {:logseq.property/status [:db/id :db/ident :block/title]} {:logseq.property/priority [:db/ident]}
  {:block/tags [:db/id :db/ident :block/title]}
  {:block/page [:block/uuid :block/title :block/journal-day]}]`;
// Tags given by id, together with every tag that extends them, at any depth.
async function withExtending(ids) {
  const found = new Set(ids);
  if (!found.size) return found;
  const extendsRows = await dsQuery(`[:find ?child ?parent :where [?child :logseq.property.class/extends ?parent]]`);
  for (let grew = true; grew;) {
    grew = false;
    for (const [child, parent] of extendsRows) if (found.has(parent) && !found.has(child)) { found.add(child); grew = true; }
  }
  return found;
}
// The expectation tag (by its name in the settings) and the tags that extend it.
async function expectationTags() {
  const name = setting('expectationsTag').trim().replace(/^#/, '').toLowerCase();
  if (!name) return new Set();
  const rows = await dsQuery(`[:find ?t ?title :where [?t :block/tags ?c] [?c :db/ident :logseq.class/Tag] [?t :block/title ?title]]`);
  return withExtending(rows.filter(([, title]) => String(title).toLowerCase() === name).map(([id]) => id));
}
// The choice property that tells where an expectation stands, and its choices in their own order.
const stateProp = { name: null, ident: null, choices: [] };
async function loadStateProperty() {
  const name = setting('expectationsStateProperty').trim().toLowerCase();
  stateProp.name = name;
  stateProp.ident = null;
  stateProp.choices = [];
  if (!name) return;
  const props = await dsQuery(`[:find ?p ?ident ?title :where [?p :logseq.property/type _] [?p :db/ident ?ident] [?p :block/title ?title]]`);
  const prop = props.find(([, , title]) => String(title).toLowerCase() === name);
  if (!prop) { warnOnce(`no property named “${name}” was found; expectations use Logseq’s status`); return; }
  stateProp.ident = String(prop[1]).replace(/^:/, '');
  const choices = await dsQuery(`[:find ?v ?title ?order :where [?v :block/closed-value-property ${prop[0]}] [?v :block/title ?title] [(get-else $ ?v :block/order "") ?order]]`);
  choices.sort((a, b) => String(a[2]).localeCompare(String(b[2])));
  stateProp.choices = choices.map(([id, title]) => ({ id, title: String(title) }));
}
async function loadTasks(kind = 'todos') {
  const expTags = await expectationTags();
  const isExp = kind === 'expectations';
  let rows;
  if (isExp) {
    const tagSet = [...expTags].filter(id => Number.isSafeInteger(id)).join(' ');
    const pull = stateProp.ident ? PULL.replace('{:block/tags', `{:${stateProp.ident} [:db/id :block/title]} {:block/tags`) : PULL;
    rows = tagSet ? await dsQuery(`[:find (pull ?b ${pull}) :where [?b :block/tags ?t] [(contains? #{${tagSet}} ?t)]]`) : [];
  } else {
    // Tags that are Task or extend it (Bug extends Task in the test graph), at any depth.
    const taskRows = await dsQuery(`[:find ?t :where [?t :db/ident :logseq.class/Task]]`);
    const taskTags = await withExtending(taskRows.map(row => row[0]));
    const tagSet = [...taskTags].filter(id => Number.isSafeInteger(id)).join(' ');
    const [withStatus, tagged] = await Promise.all([
      dsQuery(`[:find (pull ?b ${PULL}) :where [?b :logseq.property/status _]]`),
      tagSet ? dsQuery(`[:find (pull ?b ${PULL}) :where [?b :block/tags ?t] [(contains? #{${tagSet}} ?t)]]`) : [],
    ]);
    rows = [...withStatus, ...tagged];
  }
  const byId = new Map();
  for (const row of rows) {
    const node = Array.isArray(row) ? row[0] : row;
    const uuid = String(pick(node, 'block/uuid') ?? node?.uuid ?? '');
    if (!UUID.test(uuid) || byId.has(uuid)) continue;
    // Tag pages and property definitions are not tasks, even when they carry a status default.
    const page = pick(node, 'block/page');
    const tags = (pick(node, 'block/tags') || []).map(tag => ({ id: pick(tag, 'db/id') ?? tag?.id, ident: identOf(tag), title: String(pick(tag, 'block/title') ?? '') }));
    if (tags.some(tag => /^logseq\.class\/(Tag|Property)$/.test(tag.ident))) continue;
    // Expectations have their own list, so Todos leaves them out.
    if (!isExp && tags.some(tag => expTags.has(tag.id))) continue;
    const stateValue = isExp && stateProp.ident ? pick(node, stateProp.ident) : null;
    const num = value => (typeof value === 'number' && value > 0 ? value : null);
    byId.set(uuid, {
      uuid,
      title: String(pick(node, 'block/title') ?? ''),
      status: isExp && stateProp.ident ? expStateKey(stateValue ? String(pick(stateValue, 'block/title') ?? '') : '')
        : statusKeyOf(pick(node, 'logseq.property/status')),
      // Whether the block has a status (or juncture) of its own, so Undo can take a set one off again.
      hasState: !!(isExp && stateProp.ident ? stateValue : pick(node, 'logseq.property/status')),
      priority: identOf(pick(node, 'logseq.property/priority')).replace(/^logseq\.property\/priority\./, ''),
      deadline: num(pick(node, 'logseq.property/deadline')),
      scheduled: num(pick(node, 'logseq.property/scheduled')),
      updated: num(pick(node, 'block/updated-at')) || 0,
      pageUuid: page ? String(pick(page, 'block/uuid') ?? '') : uuid,
      pageTitle: page ? String(pick(page, 'block/title') ?? '') : '',
      journalDay: (page && Number(pick(page, 'block/journal-day'))) || 0,
      isPage: !page,
      tags: tags.filter(tag => tag.ident !== 'logseq.class/Task' && tag.title && !(isExp && expTags.has(tag.id))).map(tag => tag.title),
    });
  }
  const tasks = [...byId.values()];
  // Pages a title links to are stored as [[uuid]]; their titles are looked up once.
  const mentioned = new Set();
  for (const task of tasks) for (const m of task.title.matchAll(/\[\[([0-9a-f-]{36})\]\]/gi)) mentioned.add(m[1].toLowerCase());
  const names = new Map();
  if (mentioned.size) {
    const list = [...mentioned].filter(u => UUID.test(u)).map(u => `#uuid "${u}"`).join(' ');
    for (const [uuid, title] of await dsQuery(`[:find ?uuid ?title :where [(identity [${list}]) [?uuid ...]] [?e :block/uuid ?uuid] [?e :block/title ?title]]`))
      names.set(String(uuid).toLowerCase(), String(title));
  }
  // Subtasks: child blocks with a status, counted for each task (done ones apart).
  const subs = new Map();
  if (tasks.length) {
    const wanted = new Set(tasks.map(task => task.uuid));
    for (const [parent, ident] of await dsQuery(`[:find ?pu ?c ?si :where [?c :logseq.property/status ?s] [?c :block/parent ?p] [?p :block/uuid ?pu] [?s :db/ident ?si]]`).then(rows => rows.map(r => [String(r[0]).toLowerCase(), String(r[2])])).catch(() => [])) {
      if (!wanted.has(parent)) continue;
      const key = ident.replace(/^:?logseq\.property\/status\./, '');
      if (key === 'canceled') continue;
      const sub = subs.get(parent) || { done: 0, total: 0 };
      sub.total++;
      if (key === 'done') sub.done++;
      subs.set(parent, sub);
    }
  }
  return { tasks, names, subs };
}

/* ---------- The two lists ---------- */
// An expectation's state is one of the property's choices, kept by its title in lower case.
const expStateKey = title => (title || stateProp.choices[0]?.title || 'waiting').toLowerCase();
// Each choice is drawn with the status circle closest to it: the first empty, finished ones ticked,
// dropped ones crossed, the ones between half and three quarters full.
function expLook(key) {
  if (/^(done|received|complete|completed|finished|closed)$/.test(key)) return 'done';
  if (/^(canceled|cancelled|dropped|abandoned)$/.test(key)) return 'canceled';
  const index = stateProp.choices.findIndex(choice => choice.title.toLowerCase() === key);
  if (index <= 0) return 'todo';
  return index % 2 ? 'doing' : 'in-review';
}
const KINDS = {
  todos: {
    key: 'todos', name: 'Todos', one: 'task', many: 'tasks', prefsKey: 'refinement-todos-prefs', icon: () => CHECKLIST_ICON,
    hasDoing: true, hasBacklog: true,
    async prepare() { if (!Object.keys(choiceTitles.status).length) await loadChoiceTitles(); },
    look: statusLook,
    title: key => statusChoices.find(choice => choice.key === key)?.title || STATUS_LABEL[key] || key,
    menuStates: () => statusChoices.map(choice => choice.key),
    groupStates: statusOrder,
    doneKey: 'done', openKey: () => 'todo',
    setState: (task, key) => setChoice(task, 'status', key),
    add: text => addTask(text),
    empty: 'No tasks in this graph yet.<br>Type one into “Add a task” above, or give any block a status.',
  },
  expectations: {
    key: 'expectations', name: 'Expectations', one: 'expectation', many: 'expectations', prefsKey: 'refinement-expectations-prefs', icon: () => HOURGLASS_ICON,
    hasDoing: false, hasBacklog: false,
    async prepare() { await loadStateProperty(); if (!stateProp.ident && !Object.keys(choiceTitles.status).length) await loadChoiceTitles(); },
    look: key => (stateProp.ident ? expLook(key) : statusLook(key)),
    title: key => (stateProp.ident ? stateProp.choices.find(choice => choice.title.toLowerCase() === key)?.title || key : statusChoices.find(choice => choice.key === key)?.title || STATUS_LABEL[key] || key),
    menuStates: () => (stateProp.ident ? stateProp.choices.map(choice => choice.title.toLowerCase()) : statusChoices.map(choice => choice.key)),
    groupStates: () => (stateProp.ident ? stateProp.choices.map(choice => choice.title.toLowerCase()) : statusOrder()),
    get doneKey() { return stateProp.ident ? (stateProp.choices.map(choice => choice.title.toLowerCase()).find(key => expLook(key) === 'done') || 'done') : 'done'; },
    openKey: () => (stateProp.ident ? expStateKey('') : 'todo'),
    setState: (task, key) => setExpectationState(task, key),
    add: text => addExpectation(text),
    empty: 'Nothing you are waiting on yet.<br>Type one into “Add an expectation” above, or tag any block with the expectation tag from the settings.',
  },
};
const stateIsOpen = (kind, key) => { const look = kind.look(key); return look !== 'done' && look !== 'canceled'; };

/* ---------- Dates ---------- */
const DAY = 86400000;
const startOfDay = (time = Date.now()) => { const d = new Date(time); d.setHours(0, 0, 0, 0); return d.getTime(); };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortDate(time) {
  const today = startOfDay(), day = startOfDay(time);
  const d = new Date(time);
  const clock = d.getHours() || d.getMinutes() ? ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : '';
  if (day === today) return 'today' + clock;
  if (day === today + DAY) return 'tomorrow' + clock;
  if (day === today - DAY) return 'yesterday' + clock;
  const year = d.getFullYear() !== new Date().getFullYear() ? ', ' + d.getFullYear() : '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${year}${clock}`;
}
// The date that decides when a task needs you: its due date, or else the day it is planned for.
const whenOf = task => task.deadline ?? task.scheduled;
function whenBucket(task) {
  const time = whenOf(task);
  if (time == null) return 'none';
  const today = startOfDay();
  if (time < today) return 'late';
  if (time < today + DAY) return 'today';
  if (time < today + 2 * DAY) return 'tomorrow';
  if (time < today + 7 * DAY) return 'week';
  return 'later';
}
function doneBucket(task) {
  const today = startOfDay();
  if (task.updated >= today) return 'today';
  if (task.updated >= today - DAY) return 'yesterday';
  if (task.updated >= today - 6 * DAY) return 'week';
  return 'earlier';
}
const WHEN_GROUPS = [['late', 'Late'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'Next 7 days'], ['later', 'Later'], ['none', 'No date']];
const DONE_GROUPS = [['today', 'Finished today'], ['yesterday', 'Yesterday'], ['week', 'Earlier this week'], ['earlier', 'Before that']];

/* ---------- Text ---------- */
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// A task's title as shown: links by their page's title, markup turned into its look, block references as a mark.
function titleHtml(raw, names) {
  let text = escapeHtml(String(raw).split('\n')[0]);
  text = text
    .replace(/\[([^\]\[]+)\]\(\[\[([^\]]+)\]\]\)/g, '<u data-page="$2">$1</u>')
    .replace(/\[([^\]\[]+)\]\((?:\(\([^)]+\)\)|[^)\s]+)\)/g, '<u>$1</u>')
    .replace(/#?\[\[([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\]\]/gi, (m, uuid) => `<u data-page="${uuid}">${escapeHtml(names.get(uuid.toLowerCase()) || '…')}</u>`)
    .replace(/\[\[([^\]]+)\]\]/g, '<u data-page="$1">$1</u>')
    .replace(/\(\(([0-9a-f-]{36})\)\)/gi, '<i class="rt-ref">↗</i>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/==([^=]+)==/g, '<mark>$1</mark>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/(^|\s)#([^\s#<]+)/g, '$1<span class="rt-tag" data-page="$2">#$2</span>');
  return text.trim() || '<span class="rt-dim">Untitled task</span>';
}
const plainTitle = (raw, names) => String(raw).replace(/\[\[([0-9a-f-]{36})\]\]/gi, (m, uuid) => names.get(uuid.toLowerCase()) || '')
  .replace(/\[\[|\]\]|\*\*|~~|==|`/g, '').toLowerCase();

/* ---------- Pictures ---------- */
// Status circles, close to Logseq's own: dashed for backlog, empty for todo, half for doing, three
// quarters for in review, a tick for done, a cross for canceled.
function statusIcon(status) {
  const ring = (dash = '') => `<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"${dash}/>`;
  const body = {
    backlog: ring(' stroke-dasharray="2.2 2.2"'),
    todo: ring(),
    doing: ring() + '<path d="M8 3.5a4.5 4.5 0 0 1 0 9z" fill="currentColor"/>',
    'in-review': ring() + '<path d="M8 3.5a4.5 4.5 0 1 1 -4.5 4.5h4.5z" fill="currentColor"/>',
    done: '<circle cx="8" cy="8" r="6.75" fill="currentColor"/><path d="M5.2 8.2l1.9 1.9 3.7-3.9" fill="none" stroke="var(--ls-primary-background-color)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    canceled: ring() + '<path d="M5.9 5.9l4.2 4.2M10.1 5.9l-4.2 4.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    other: ring() + '<circle cx="8" cy="8" r="2" fill="currentColor"/>',
  }[status] || ring();
  return `<svg viewBox="0 0 16 16" class="rt-st rt-st-${status}" aria-hidden="true">${body}</svg>`;
}
// Priority as signal bars: one to three filled; urgent is three in red. No priority: three faint outlines, shown on hover.
function priorityIcon(priority) {
  const filled = { low: 1, medium: 2, high: 3, urgent: 3 }[priority] || 0;
  const bars = [0, 1, 2].map(i => `<rect x="${2 + i * 4.5}" y="${10 - i * 3}" width="3" height="${4 + i * 3}" rx=".8" ${i < filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width=".9" opacity=".45"'}/>`).join('');
  return `<svg viewBox="0 0 16 16" class="rt-pr rt-pr-${priority || 'none'}" aria-hidden="true">${bars}</svg>`;
}
const PAGE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 8.5h17"/></svg>';
const SIDEBAR_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M14.5 4.5v15"/></svg>';
const HOURGLASS_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h11"/><path d="M6.5 20.5h11"/><path d="M7.5 3.5c0 4.5 4.5 5.5 4.5 8.5s-4.5 4-4.5 8.5"/><path d="M16.5 3.5c0 4.5 -4.5 5.5 -4.5 8.5s4.5 4 4.5 8.5"/></svg>';
const CHECKLIST_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 5.5l1.5 1.5l2.5 -2.5"/><path d="M3.5 11.5l1.5 1.5l2.5 -2.5"/><path d="M3.5 17.5l1.5 1.5l2.5 -2.5"/><path d="M11 6l9 0"/><path d="M11 12l9 0"/><path d="M11 18l9 0"/></svg>';

const css = `
.${PANEL_CLASS} { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: flex-start; justify-content: center; padding-top: 6vh; background: rgba(0, 0, 0, .25); }
.refinement-todos { --rt-line: color-mix(in srgb, var(--ls-border-color) 70%, transparent); --rt-wash: color-mix(in srgb, var(--ls-primary-text-color) 6%, transparent);
  --rt-faint: color-mix(in srgb, var(--ls-primary-text-color) 55%, transparent);
  --rt-late: #c4473b; --rt-doing: #c99325; --rt-review: #5b84c4; --rt-done: #4e9a62; --rt-high: #c9822b; --rt-urgent: #c4473b;
  display: flex; flex-direction: column; width: min(960px, 94vw); height: min(800px, 88vh); border: 1px solid var(--ls-border-color); border-radius: 10px; overflow: hidden;
  background: var(--ls-primary-background-color); color: var(--ls-primary-text-color); box-shadow: 0 10px 32px rgba(0, 0, 0, .2); font-size: 16px; }
.dark .refinement-todos, html[data-theme=dark] .refinement-todos { --rt-late: #e0675c; --rt-doing: #e2b24c; --rt-review: #86a6db; --rt-done: #7fbf8c; --rt-high: #e0a24d; --rt-urgent: #e0675c; }
.refinement-todos button { font: inherit; color: inherit; }
.refinement-todos header { display: flex; align-items: center; gap: 14px; padding: 16px 18px 14px 24px; }
.refinement-todos header h2 { margin: 0; font-size: 17px; font-weight: 600; }
.refinement-todos .rt-count { font-size: 14px; color: var(--rt-faint); font-variant-numeric: tabular-nums; }
.refinement-todos .rt-find { flex: 1; min-width: 120px; padding: 7px 12px; border: 1px solid var(--ls-border-color); border-radius: 7px; background: transparent; color: inherit; font: inherit; font-size: 15px; }
.refinement-todos .rt-seg { display: inline-flex; border: 1px solid var(--ls-border-color); border-radius: 6px; overflow: hidden; flex: none; }
.refinement-todos .rt-seg button { border: 0; padding: 5px 12px; background: transparent; font-size: 14px; cursor: pointer; opacity: .6; }
.refinement-todos .rt-seg button[aria-pressed=true] { opacity: 1; background: var(--rt-wash); font-weight: 500; }
.refinement-todos .rt-close { border: 0; background: none; opacity: .5; cursor: pointer; font-size: 20px; line-height: 1; padding: 2px 6px; }
.refinement-todos .rt-close:hover { opacity: 1; }
.refinement-todos .rt-bar2 { display: flex; align-items: center; gap: 8px; padding: 0 18px 14px 24px; border-bottom: 1px solid var(--ls-border-color); flex-wrap: wrap; }
.refinement-todos .rt-chip { border: 1px solid var(--rt-line); border-radius: 14px; padding: 3px 12px; background: transparent; font-size: 14px; cursor: pointer; color: var(--rt-faint) !important; }
.refinement-todos .rt-chip:hover { color: var(--ls-primary-text-color) !important; }
.refinement-todos .rt-chip[aria-pressed=true] { border-color: transparent; background: var(--rt-wash); color: var(--ls-primary-text-color) !important; font-weight: 500; }
.refinement-todos .rt-chip .n { font-weight: 400; opacity: .6; margin-left: 4px; font-variant-numeric: tabular-nums; }
.refinement-todos .rt-sep { width: 1px; height: 18px; background: var(--rt-line); margin: 0 4px; }
.refinement-todos .rt-add { margin-left: auto; width: 270px; padding: 5px 12px; border: 1px dashed var(--ls-border-color); border-radius: 7px; background: transparent; color: inherit; font: inherit; font-size: 14px; }
.refinement-todos .rt-add:focus { border-style: solid; }
.refinement-todos .rt-find:focus, .refinement-todos .rt-add:focus { border-color: color-mix(in srgb, var(--ls-primary-text-color) 40%, transparent); outline: none; box-shadow: none; }
.refinement-todos .rt-body { flex: 1; overflow-y: auto; padding: 6px 18px 28px 18px; }
.refinement-todos .rt-group { padding-top: 26px; }
.refinement-todos .rt-group:first-child { padding-top: 14px; }
.refinement-todos .rt-group h3 { display: flex; align-items: baseline; gap: 8px; margin: 0 0 6px 10px; font-size: 12.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--rt-faint); }
.refinement-todos .rt-group h3 .n { font-weight: 400; letter-spacing: 0; text-transform: none; font-variant-numeric: tabular-nums; opacity: .75; }
.refinement-todos .rt-group.rt-today h3 { color: var(--ls-primary-text-color); }
.refinement-todos .rt-group.rt-late h3 { width: fit-content; padding: 0 8px; border: 1.5px solid var(--rt-late); border-radius: 999px; background: color-mix(in srgb, var(--rt-late) 9%, transparent); color: var(--ls-primary-text-color); }
.refinement-todos .rt-group h3 .rt-prog { align-self: center; width: 70px; height: 3px; border-radius: 2px; background: var(--rt-line); overflow: hidden; }
.refinement-todos .rt-group h3 .rt-prog i { display: block; height: 100%; background: var(--rt-done); }
.refinement-todos .rt-group h3 .rt-open { text-transform: none; letter-spacing: 0; font-weight: 600; cursor: pointer; }
.refinement-todos .rt-group h3 .rt-open:hover { text-decoration: underline; text-underline-offset: 2px; }
.refinement-todos .rt-row { display: flex; align-items: flex-start; gap: 12px; padding: 7px 10px; border-radius: 6px; }
.refinement-todos .rt-row:hover, .refinement-todos .rt-row.rt-current { background: var(--rt-wash); }
.refinement-todos .rt-row.rt-closed .rt-title { color: var(--rt-faint); }
.refinement-todos .rt-row.rt-closed .rt-sub { opacity: .7; }
.refinement-todos .rt-row.rt-st-canceled-row .rt-title { text-decoration: line-through; text-decoration-color: color-mix(in srgb, currentColor 50%, transparent); }
.refinement-todos .rt-icon { flex: none; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: 0; padding: 0; background: none; border-radius: 4px; cursor: pointer; }
.refinement-todos .rt-icon:hover { background: var(--rt-wash); }
.refinement-todos .rt-st { width: 17px; height: 17px; color: var(--rt-faint); }
.refinement-todos .rt-st-doing { color: var(--rt-doing); }
.refinement-todos .rt-st-in-review { color: var(--rt-review); }
.refinement-todos .rt-st-done { color: var(--rt-done); }
.refinement-todos .rt-main { flex: 1; min-width: 0; line-height: 1.5; padding-top: 1px; }
.refinement-todos .rt-sub { display: flex; flex-wrap: wrap; margin-top: 1px; font-size: 13px; line-height: 1.4; color: var(--rt-faint); }
.refinement-todos .rt-sub > span + span::before { content: '·'; margin: 0 7px; opacity: .7; }
.refinement-todos .rt-subtasks { font-variant-numeric: tabular-nums; }
.refinement-todos .rt-subtasks.rt-all { color: var(--rt-done); }
.refinement-todos .rt-edit { width: 100%; padding: 0 0 1px; border: 0; border-bottom: 1.5px solid color-mix(in srgb, var(--ls-primary-text-color) 35%, transparent); background: transparent; color: inherit; font: inherit; outline: none; box-shadow: none; }
.refinement-todos .rt-title [data-page]:hover { text-decoration-color: currentColor; }
.refinement-todos .rt-title { cursor: pointer; }
.refinement-todos .rt-title:hover { text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 35%, transparent); text-underline-offset: 2px; }
.refinement-todos .rt-title u { text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 30%, transparent); text-underline-offset: 2px; }
.refinement-todos .rt-title code { font-size: 14px; padding: 0 3px; border-radius: 3px; background: var(--rt-wash); }
.refinement-todos .rt-tag, .refinement-todos .rt-dim, .refinement-todos .rt-ref { color: var(--rt-faint); font-style: normal; }
.refinement-todos .rt-src, .refinement-todos .rt-kind { white-space: nowrap; }
.refinement-todos .rt-meta { flex: none; display: flex; align-items: center; gap: 6px; }
.refinement-todos .rt-date { border: 0; background: none; padding: 2px 7px; border-radius: 4px; font-size: 13.5px !important; color: var(--rt-faint) !important; cursor: pointer; white-space: nowrap; font-variant-numeric: tabular-nums; }
.refinement-todos .rt-date:hover { background: var(--rt-wash); color: var(--ls-primary-text-color) !important; }
.refinement-todos .rt-date.rt-is-late { box-shadow: inset 0 0 0 1.5px var(--rt-late); background: color-mix(in srgb, var(--rt-late) 9%, transparent); color: var(--ls-primary-text-color) !important; border-radius: 999px; padding-left: 9px; padding-right: 9px; }
.refinement-todos .rt-date.rt-is-today { color: var(--ls-primary-text-color) !important; font-weight: 500; }
.refinement-todos .rt-date.rt-is-planned:not(.rt-is-today) { font-style: italic; }
.refinement-todos .rt-date.rt-empty { opacity: 0; }
.refinement-todos .rt-row:hover .rt-date.rt-empty, .refinement-todos .rt-row.rt-current .rt-date.rt-empty { opacity: .7; }
.refinement-todos .rt-pr { width: 17px; height: 17px; color: var(--rt-faint); }
.refinement-todos .rt-pr-high { color: var(--rt-high); }
.refinement-todos .rt-pr-urgent { color: var(--rt-urgent); }
.refinement-todos .rt-pr-none { opacity: 0; }
.refinement-todos .rt-row:hover .rt-pr-none, .refinement-todos .rt-row.rt-current .rt-pr-none { opacity: .7; }
.refinement-todos .rt-empty-note { padding: 60px 20px; text-align: center; color: var(--rt-faint); line-height: 1.6; }
.refinement-todos footer { display: flex; gap: 6px 20px; padding: 10px 24px; border-top: 1px solid var(--ls-border-color); font-size: 12.5px; color: var(--rt-faint); flex-wrap: wrap; }
.refinement-todos .rt-addwrap { position: relative; margin-left: auto; display: inline-flex; }
.refinement-todos .rt-addwrap .rt-add { margin-left: 0; }
.refinement-todos .rt-addhint { position: absolute; right: 2px; top: 100%; margin-top: 3px; font-size: 12.5px; color: var(--rt-faint); white-space: nowrap; pointer-events: none; }
.refinement-todos .rt-addhint:empty { display: none; }
.refinement-todos-toast { position: fixed; z-index: 10002; left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; align-items: center; gap: 16px; max-width: min(560px, 90vw); padding: 9px 10px 9px 16px; border-radius: 8px;
  background: var(--ls-primary-text-color); color: var(--ls-primary-background-color); font-size: 14px; box-shadow: 0 6px 20px rgba(0, 0, 0, .18); }
.refinement-todos-toast span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.refinement-todos-toast button { flex: none; border: 0; border-radius: 5px; padding: 3px 10px; background: color-mix(in srgb, var(--ls-primary-background-color) 18%, transparent); color: inherit; font: inherit; font-weight: 600; cursor: pointer; }
.refinement-todos-toast button:hover { background: color-mix(in srgb, var(--ls-primary-background-color) 30%, transparent); }
.refinement-todos footer kbd { font: inherit; padding: 0 4px; border: 1px solid var(--rt-line); border-radius: 3px; }
.refinement-todos-menu { position: fixed; z-index: 10001; min-width: 150px; padding: 4px; border: 1px solid var(--ls-border-color); border-radius: 8px; background: var(--ls-primary-background-color); color: var(--ls-primary-text-color); box-shadow: 0 6px 20px rgba(0, 0, 0, .16); font-size: 14.5px; }
.refinement-todos-menu .rt-mh { padding: 4px 12px 5px; font-size: 12.5px; color: color-mix(in srgb, var(--ls-primary-text-color) 55%, transparent); }
.refinement-todos-menu button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 12px; border: 0; border-radius: 5px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.refinement-todos-menu button:focus { outline: none; }
.refinement-todos-menu button:focus-visible { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--ls-primary-text-color) 30%, transparent); }
.refinement-todos-menu button:hover, .refinement-todos-menu button.rt-on { background: color-mix(in srgb, var(--ls-primary-text-color) 7%, transparent); }
.refinement-todos-menu button kbd { margin-left: auto; font: inherit; font-size: 11px; opacity: .45; }
.refinement-todos-menu input[type=date] { margin: 4px 6px 2px; padding: 3px 6px; border: 1px solid var(--ls-border-color); border-radius: 5px; background: transparent; color: inherit; font: inherit; font-size: 14px; }
.refinement-todos-menu button.rt-danger { color: #c4473b; }
.refinement-todos-menu .rt-mh { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.refinement-todos-menu hr { border: 0; border-top: 1px solid var(--ls-border-color); margin: 4px 6px; }
.refinement-todos-menu .rt-st, .refinement-todos-menu .rt-pr { width: 17px; height: 17px; }
.refinement-todos-menu .rt-st { color: color-mix(in srgb, var(--ls-primary-text-color) 55%, transparent); }
.refinement-todos-menu .rt-st-doing { color: #c99325; } .refinement-todos-menu .rt-st-in-review { color: #5b84c4; } .refinement-todos-menu .rt-st-done { color: #4e9a62; }
.refinement-todos-menu .rt-pr { color: color-mix(in srgb, var(--ls-primary-text-color) 55%, transparent); }
.refinement-todos-menu .rt-pr-high { color: #c9822b; } .refinement-todos-menu .rt-pr-urgent { color: #c4473b; }
.refinement-todos [hidden] { display: none !important; }
.refinement-todos .rt-move { flex: none; display: flex; align-items: center; justify-content: center; width: 28px; height: 26px; border: 0; border-radius: 6px; background: none; cursor: pointer; opacity: .5; }
.refinement-todos .rt-move:hover { opacity: 1; background: var(--rt-wash); }
.refinement-todos .rt-still { cursor: default; }
.refinement-todos .rt-still:hover { background: none; }
.refinement-todos:focus { outline: none; }
/* The main view: the list as a page, scrolled with the page. */
.refinement-todos.rt-mode-page { width: 100%; height: auto; border: 0; border-radius: 0; box-shadow: none; background: transparent; overflow: visible; }
.refinement-todos-holder.rt-holder-page { max-width: var(--ls-main-content-max-width, 960px); margin: 0 auto; padding: 24px 12px 80px; }
.refinement-todos.rt-mode-page .rt-page-title { margin: 0 0 18px; padding: 0 24px; font-size: 2em; font-weight: 600; line-height: 1.2; }
.refinement-todos.rt-mode-page header { padding: 0 0 14px 24px; }
.refinement-todos.rt-mode-page .rt-bar2 { padding-left: 24px; padding-right: 0; }
.refinement-todos.rt-mode-page .rt-body { overflow: visible; padding-right: 0; }
.refinement-todos.rt-mode-page footer { border-top: 0; padding-top: 18px; }
/* The sidebar panel: a short, plain list. */
.refinement-todos.rt-mode-sidebar { width: 100%; height: auto; border: 0; border-radius: 0; box-shadow: none; background: transparent; overflow: visible; font-size: 15px; }
.refinement-todos.rt-mode-sidebar header { padding: 6px 0 10px; gap: 6px; }
.refinement-todos.rt-mode-sidebar .rt-bar2 { padding: 0 0 10px; border-bottom: 0; }
.refinement-todos.rt-mode-sidebar .rt-add { margin-left: 0; width: 100%; }
.refinement-todos.rt-mode-sidebar .rt-addwrap { margin-left: 0; width: 100%; }
.refinement-todos.rt-mode-sidebar .rt-bar2 { padding-bottom: 14px; }
.refinement-todos.rt-mode-sidebar .rt-body { overflow: visible; padding: 0 0 8px; }
.refinement-todos.rt-mode-sidebar .rt-group { padding-top: 16px; }
.refinement-todos.rt-mode-sidebar .rt-group h3 { margin-left: 6px; font-size: 12px; }
.refinement-todos.rt-mode-sidebar .rt-row { padding: 5px 6px; gap: 8px; }
.refinement-todos.rt-mode-sidebar .rt-date { padding: 1px 5px; font-size: 13px !important; }
.refinement-todos.rt-mode-sidebar .rt-date.rt-empty { display: none; }
`;

/* ---------- Writing ---------- */
async function setChoice(task, kind, value) {
  const key = 'logseq.property/' + kind;
  if (!value) { await logseq.Editor.removeBlockProperty(task.uuid, key); return; }
  const custom = kind === 'status' ? statusChoices.find(choice => choice.key === value && !choice.ident && choice.id != null) : null;
  if (custom) await logseq.Editor.upsertBlockProperty(task.uuid, key, custom.id);
  else await logseq.Editor.upsertBlockProperty(task.uuid, key, choiceTitles[kind][value] || (kind === 'status' ? STATUS_LABEL[value] : PRIORITY_LABEL[value]));
}
async function setDate(task, key, time) {
  if (time == null) await logseq.Editor.removeBlockProperty(task.uuid, 'logseq.property/' + key);
  else await logseq.Editor.upsertBlockProperty(task.uuid, 'logseq.property/' + key, time);
}
async function addTask(text, asTask = true) {
  let page = await logseq.Editor.getTodayPage?.().catch(() => null);
  if (!page) {
    const d = new Date();
    page = await logseq.Editor.createJournalPage?.(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`).catch(() => null);
  }
  if (!page?.uuid) throw new Error('today’s journal page could not be found');
  const block = await logseq.Editor.appendBlockInPage(page.uuid, text);
  if (!block?.uuid) throw new Error('the block could not be added');
  if (!asTask) return block;
  // A status makes the block a task; Logseq adds the #Task tag itself.
  await logseq.Editor.upsertBlockProperty(block.uuid, 'logseq.property/status', choiceTitles.status.todo || 'Todo');
  return block;
}
// What the add box understands besides the text: !urgent / !high / !medium / !low for the priority,
// and a day at the end (today, tomorrow, a weekday, next week), or after "due", for the due date.
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
// Short forms that are also ordinary words (sun, sat, wed, tod) count only as part of a full day name,
// so "Write about the sun" keeps its last word.
const DAY_WORD = '(today|tomorrow|tmr|tmrw|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|thu|thur|thurs|fri)';
function dayFor(word) {
  const today = startOfDay();
  const noon = days => startOfDay(today + days * DAY + DAY / 2);
  word = word.toLowerCase();
  if (word === 'today') return today;
  if (/^(tomorrow|tmr|tmrw)$/.test(word)) return noon(1);
  if (word === 'next week') return noon(((8 - new Date(today).getDay()) % 7) || 7);
  const index = WEEKDAYS.indexOf(word.slice(0, 3));
  return index < 0 ? null : noon((index - new Date(today).getDay() + 7) % 7);
}
function parseAdd(text) {
  let rest = ` ${text} `, priority = '', due = null;
  rest = rest.replace(/\s!(urgent|high|medium|med|low)(?=\s)/i, (m, word) => { priority = word.toLowerCase() === 'med' ? 'medium' : word.toLowerCase(); return ' '; });
  const take = (m, word) => { due = dayFor(word); return due == null ? m : ' '; };
  // "due <day>" anywhere; "by <day>" only at the end, since "by" is common in task text ("Stop by Monday standup").
  rest = rest.replace(new RegExp(`\\sdue\\s+${DAY_WORD}(?=\\s)`, 'i'), take);
  if (due == null) rest = rest.replace(new RegExp(`\\sby\\s+${DAY_WORD}\\s*$`, 'i'), take);
  if (due == null) rest = rest.replace(new RegExp(`\\s(?:on\\s+)?${DAY_WORD}\\s*$`, 'i'), take);
  return { text: rest.replace(/\s+/g, ' ').trim(), priority, due };
}
async function addParsed(kind, raw) {
  const { text, priority, due } = parseAdd(raw);
  const block = await kind.add(text || raw);
  if (block?.uuid && priority) await setChoice({ uuid: block.uuid }, 'priority', priority);
  if (block?.uuid && due != null) await setDate({ uuid: block.uuid }, 'deadline', due);
}
async function setExpectationState(task, key) {
  if (!stateProp.ident) return setChoice(task, 'status', key);
  const choice = stateProp.choices.find(c => c.title.toLowerCase() === key);
  if (!choice) throw new Error('no choice named ' + key);
  await logseq.Editor.upsertBlockProperty(task.uuid, stateProp.ident, choice.id);
}
async function addExpectation(text) {
  const name = setting('expectationsTag').trim().replace(/^#/, '');
  const block = await addTask(text, false);
  const tag = name && await logseq.Editor.getPage(name).catch(() => null);
  if (tag?.uuid && logseq.Editor.addBlockTag) await logseq.Editor.addBlockTag(block.uuid, tag.uuid);
  else if (name) await logseq.Editor.updateBlock(block.uuid, `${text} #[[${name}]]`);
  if (stateProp.ident && stateProp.choices[0]) await logseq.Editor.upsertBlockProperty(block.uuid, stateProp.ident, stateProp.choices[0].id);
  return block;
}
async function goTo(task, sidebar) {
  if (sidebar) { await logseq.Editor.openInRightSidebar(task.uuid); return; }
  if (task.isPage) { logseq.App.pushState('page', { name: task.uuid }); return; }
  try { await logseq.Editor.scrollToBlockInPage(task.pageUuid, task.uuid); }
  catch (error) { logseq.App.pushState('page', { name: task.uuid }); }
}

/* ---------- The window ---------- */
let current = null; // the open window: { kind, close, focus }

function el(doc, tag, props = {}, ...children) {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (typeof value === 'function') node.addEventListener(key, value);
    else node.setAttribute(key, value);
  }
  node.append(...children.filter(child => child != null));
  return node;
}
// Keys typed in the window's boxes stay out of Logseq's shortcuts.
const keepKeys = input => { for (const type of ['keydown', 'keyup', 'keypress']) input.addEventListener(type, event => { if (event.key !== 'Escape') event.stopPropagation(); }); };

/* One Todos list. mode is 'window' (the window over the page), 'page' (the main view) or 'sidebar'
   (a simpler list: open tasks by when, with status and date only). leave() is called when going to a
   task should take the list away (the window closes); the page and sidebar stay. */
function createView(doc, mode, leave = () => {}, kind = KINDS.todos) {
  const view = { doc, mode, leave, kind };
  for (const fn of CREATEVIEW_FUNCTIONS) view[fn.name] = (...args) => fn(view, ...args);
  view.compact = view.mode === 'sidebar';
  // The sidebar list keeps to open tasks by when; the window and the page share the saved choices.
  view.prefs = view.compact ? { group: 'when', view: 'open', urgent: false, hideBacklog: false } : savedPrefsFor(view.kind.prefsKey);
  view.One = view.kind.one[0].toUpperCase() + view.kind.one.slice(1);
  view.a = /^[aeiou]/.test(view.kind.one) ? 'an' : 'a';
  view.data = { tasks: [], names: new Map() };
  view.loaded = false;
  view.shown = []; // tasks in display order, for the arrow keys
  view.cursor = -1;
  view.menu = null; view.missed = false;
  // Tasks changed in the window stay in view (with their new look) until another chip or grouping is
  // picked, so a task ticked off does not jump away under the pointer.
  view.kept = new Set();
  view.count = el(view.doc, 'span', { class: 'rt-count' });
  view.find = el(view.doc, 'input', { class: 'rt-find', type: 'text', placeholder: `Find ${view.a} ${view.kind.one}`, spellcheck: 'false', 'aria-label': `Find ${view.a} ${view.kind.one}` });
  keepKeys(view.find);
  view.find.addEventListener('input', () => { view.cursor = -1; view.draw(); });
  view.groupButtons = [['when', 'When'], ['status', 'Status'], ['page', 'Page']].map(([key, label]) =>
    el(view.doc, 'button', { 'data-group': key, click: () => { view.prefs.group = key; view.savePrefs(); view.forget(); view.draw(); } }, label));
  view.seg = el(view.doc, 'span', { class: 'rt-seg', title: `Group ${view.kind.many} by` }, ...view.groupButtons);
  view.closeButton = el(view.doc, 'button', { class: 'rt-close', 'aria-label': 'Close', title: 'Close (Esc)', click: () => view.leave() }, '×');
  // Buttons to show the same list in the other places.
  view.moveButtons = [];
  if (view.mode !== 'page') view.moveButtons.push(el(view.doc, 'button', { class: 'rt-move', title: `Show ${view.kind.name} as a full view in the main area`, html: PAGE_ICON, click: () => { view.leave(); openPage(view.kind); } }));
  if (view.mode !== 'sidebar') view.moveButtons.push(el(view.doc, 'button', { class: 'rt-move', title: `Show ${view.kind.name} in the right sidebar`, html: SIDEBAR_ICON, click: () => { view.leave(); openSidebar(view.kind); } }));

  view.viewChips = [['open', 'Open'], ...(view.kind.hasDoing ? [['doing', 'Doing']] : []), ['done', 'Done'], ['all', 'All']].map(([key, label]) =>
    el(view.doc, 'button', { class: 'rt-chip', 'data-view': key, click: () => { view.prefs.view = key; view.savePrefs(); view.forget(); view.cursor = -1; view.draw(); } }, label, el(view.doc, 'span', { class: 'n' })));
  view.urgentChip = el(view.doc, 'button', { class: 'rt-chip', title: `Only ${view.kind.many} with urgent or high priority`, click: () => { view.prefs.urgent = !view.prefs.urgent; view.savePrefs(); view.forget(); view.draw(); } }, 'Urgent and high');
  view.backlogChip = el(view.doc, 'button', { class: 'rt-chip', title: 'Leave out tasks in the backlog', click: () => { view.prefs.hideBacklog = !view.prefs.hideBacklog; view.savePrefs(); view.forget(); view.draw(); } }, 'Hide backlog');
  view.add = el(view.doc, 'input', { class: 'rt-add', type: 'text', placeholder: `+ Add ${view.a} ${view.kind.one} to today’s journal`, spellcheck: 'false', 'aria-label': `Add ${view.a} ${view.kind.one} to today’s journal` });
  keepKeys(view.add);
  view.addHint = el(view.doc, 'span', { class: 'rt-addhint', 'aria-live': 'polite' });
  view.addWrap = el(view.doc, 'span', { class: 'rt-addwrap' }, view.add, view.addHint);
  addBoxListeners(view);

  view.body = el(view.doc, 'div', { class: 'rt-body' });
  view.footer = el(view.doc, 'footer', { html: `<span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> go to ${view.kind.one}</span><span><kbd>⇧ Enter</kbd> or ⇧ click: right sidebar</span><span><kbd>x</kbd> done / not done</span><span><kbd>s</kbd> status · <kbd>p</kbd> priority · <kbd>d</kbd> date</span><span><kbd>e</kbd> or double-click: edit text</span><span><kbd>/</kbd> find</span>` });
  view.box = el(view.doc, 'div', { class: 'refinement-todos rt-mode-' + view.mode, role: view.mode === 'window' ? 'dialog' : 'region', 'aria-label': view.kind.name });
  if (view.compact) view.box.append(el(view.doc, 'header', {}, view.find, ...view.moveButtons), el(view.doc, 'div', { class: 'rt-bar2' }, view.addWrap), view.body);
  else {
    const chips = el(view.doc, 'div', { class: 'rt-bar2' }, ...view.viewChips, el(view.doc, 'span', { class: 'rt-sep' }), view.urgentChip, ...(view.kind.hasBacklog ? [view.backlogChip] : []), view.addWrap);
    if (view.mode === 'page') view.box.append(el(view.doc, 'h1', { class: 'rt-page-title' }, view.kind.name), el(view.doc, 'header', {}, view.count, view.find, view.seg, ...view.moveButtons), chips, view.body, view.footer);
    else view.box.append(el(view.doc, 'header', {}, el(view.doc, 'h2', {}, view.kind.name), view.count, view.find, view.seg, ...view.moveButtons, view.closeButton), chips, view.body, view.footer);
  }
  // The page and sidebar lists take the arrow keys only while they hold the keyboard.
  if (view.mode !== 'window') view.box.tabIndex = -1;

  // After a change, a small note at the bottom says what changed, with Undo, for a few seconds.
  view.toast = null; view.toastTimer = 0;
  // Double-click (or e) edits a task's first line in place. Links show by their page's name while editing
  // and are stored by the page's id again on saving, as Logseq keeps them.
  view.editing = null; view.drawLater = false;
  view.loading = null; view.again = false;
  // The window takes every key while it is open; the page and sidebar lists only keys pressed inside them.
  view.keyTarget = view.mode === 'window' ? view.doc : view.box;
  view.keyTarget.addEventListener('keydown', view.onKey, view.mode === 'window');
  view.doc.addEventListener('mousedown', view.onDown, true);
  // While the window is open, edits made elsewhere (or by Logseq itself) show up in it.
  // A refresh skipped while a menu is open runs when it closes; one during text editing waits in draw().
  view.timer = 0;
  view.offChanged = logseq.DB.onChanged(() => { clearTimeout(view.timer); view.timer = setTimeout(() => { if (view.menu) view.missed = true; else view.refresh(); }, 400); });

  // Clicking a blank part of the list gives it the keyboard, for the arrow keys.
  if (view.mode !== 'window') view.box.addEventListener('mousedown', event => { if (!event.target.closest('input, button, .rt-title, .rt-open')) view.box.focus({ preventScroll: true }); });
  view.draw();
  return { node: view.box, refresh: view.refresh, destroy: view.destroy, focus: () => view.find.focus() };
}

function savePrefs(view) { if (!view.compact) savePrefsFor(view.kind.prefsKey); }

function kindIsOpen(view, task) { return stateIsOpen(view.kind, task.status); }

function forget(view) { return view.kept.clear(); }

function closeMenu(view) { const was = view.menu; view.menu?.remove(); view.menu = null; if (was && view.missed) { view.missed = false; view.refresh(); } }

function showMenu(view, anchor, header, items) {
  view.closeMenu();
  view.menu = el(view.doc, 'div', { class: 'refinement-todos-menu', role: 'menu' });
  if (header) view.menu.append(el(view.doc, 'div', { class: 'rt-mh' }, header));
  for (const item of items) {
    if (item === '-') { view.menu.append(el(view.doc, 'hr')); continue; }
    if (item.node) { view.menu.append(item.node); continue; }
    view.menu.append(el(view.doc, 'button', { role: 'menuitem', class: (item.on ? 'rt-on' : '') + (item.danger ? ' rt-danger' : ''), html: item.html, click: async () => { view.closeMenu(); if (view.mode !== 'window') view.box.focus({ preventScroll: true }); if (item.plain) item.run(); else await view.change(item.run, item.task); } }));
  }
  // Arrows move through the menu, Enter picks, Escape closes it.
  view.menu.addEventListener('keydown', event => {
    if (event.target.matches?.('input')) { if (event.key === 'Escape') { view.closeMenu(); view.box.focus({ preventScroll: true }); } return; }
    const items = [...view.menu.querySelectorAll('button')];
    const at = items.indexOf(view.doc.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); items[(at + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus(); }
    else if (event.key === 'Escape') { event.preventDefault(); view.closeMenu(); if (view.mode !== 'window') view.box.focus({ preventScroll: true }); }
    event.stopPropagation();
  });
  view.doc.body.append(view.menu);
  (view.menu.querySelector('button.rt-on') || view.menu.querySelector('button'))?.focus({ preventScroll: true });
  const r = anchor.getBoundingClientRect(), m = view.menu.getBoundingClientRect();
  const win = view.doc.defaultView;
  view.menu.style.left = Math.max(8, Math.min(r.left, win.innerWidth - m.width - 8)) + 'px';
  view.menu.style.top = (r.bottom + m.height + 6 > win.innerHeight ? Math.max(8, r.top - m.height - 4) : r.bottom + 4) + 'px';
}

async function change(view, run, task) {
  if (task) view.kept.add(task.uuid);
  const before = task && view.data.tasks.find(t => t.uuid === task.uuid);
  const snap = before && { status: before.status, hasState: before.hasState, priority: before.priority, deadline: before.deadline, scheduled: before.scheduled };
  try { await run(); } catch (error) { warnOnce('a task could not be changed', error); logseq.UI.showMsg('Could not change the task: ' + (error?.message || error), 'warning'); }
  await view.refresh();
  const after = snap && view.data.tasks.find(t => t.uuid === task.uuid);
  if (after) view.offerUndo(after, snap);
}

function hideToast(view) { clearTimeout(view.toastTimer); view.toast?.remove(); view.toast = null; }

function showToast(view, text, undo) {
  view.hideToast();
  const button = el(view.doc, 'button', {}, 'Undo');
  view.toast = el(view.doc, 'div', { class: 'refinement-todos-toast', role: 'status' }, el(view.doc, 'span', {}, text), button);
  button.addEventListener('click', async () => { view.hideToast(); try { await undo(); } catch (error) { warnOnce('a change could not be undone', error); } await view.refresh(); });
  view.doc.body.append(view.toast);
  view.toastTimer = setTimeout(view.hideToast, 7000);
}

function offerUndo(view, task, snap) {
  const said = [];
  if (task.status !== snap.status) said.push(view.kind.title(task.status));
  if (task.priority !== snap.priority) said.push(task.priority ? `${choiceTitles.priority[task.priority] || PRIORITY_LABEL[task.priority]} priority` : 'no priority');
  if (task.deadline !== snap.deadline) said.push(task.deadline != null ? 'due ' + shortDate(task.deadline) : 'no due date');
  if (task.scheduled !== snap.scheduled) said.push(task.scheduled != null ? 'planned ' + shortDate(task.scheduled) : 'no planned date');
  if (!said.length) return;
  const name = el(view.doc, 'div', { html: titleHtml(task.title, view.data.names) }).textContent.trim();
  view.showToast(`“${name.length > 40 ? name.slice(0, 39) + '…' : name}” is now ${said.join(', ')}`, async () => {
    if (task.status !== snap.status) {
      if (snap.hasState) await view.kind.setState(task, snap.status);
      else await logseq.Editor.removeBlockProperty(task.uuid, view.kind.key === 'expectations' && stateProp.ident ? stateProp.ident : 'logseq.property/status');
    }
    if (task.priority !== snap.priority) await setChoice(task, 'priority', snap.priority);
    if (task.deadline !== snap.deadline) await setDate(task, 'deadline', snap.deadline ?? null);
    if (task.scheduled !== snap.scheduled) await setDate(task, 'scheduled', snap.scheduled ?? null);
  });
}

function editTitle(view, task, titleNode) {
  if (view.editing || !titleNode) return;
  const lines = String(task.title).split('\n');
  const back = new Map();
  const shownText = lines[0].replace(/\[\[([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\]\]/gi, (m, uuid) => {
    const name = view.data.names.get(uuid.toLowerCase());
    if (!name || name.includes(']]')) return m;
    back.set(name, uuid);
    return `[[${name}]]`;
  });
  const input = el(view.doc, 'input', { class: 'rt-edit', type: 'text', spellcheck: 'true', 'aria-label': `Text of the ${view.kind.one}` });
  input.value = shownText;
  titleNode.replaceWith(input);
  view.editing = input;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  let done = false;
  const finish = async save => {
    if (done) return;
    done = true;
    view.editing = null;
    const typed = input.value.trim();
    if (save && typed && typed !== shownText.trim()) {
      const first = typed.replace(/\[\[([^\]]+)\]\]/g, (m, name) => (back.has(name) ? `[[${back.get(name)}]]` : m));
      // The lines after the first are taken from the block as it is now, in case they changed meanwhile.
      const now = await logseq.Editor.getBlock(task.uuid).catch(() => null);
      const rest = now && typeof now.title === 'string' ? now.title.split('\n').slice(1) : lines.slice(1);
      const text = [first, ...rest].join('\n');
      try {
        await logseq.Editor.updateBlock(task.uuid, text);
        view.showToast('Text changed', () => logseq.Editor.updateBlock(task.uuid, task.title));
      } catch (error) { warnOnce('a task’s text could not be saved', error); logseq.UI.showMsg('Could not save the text: ' + (error?.message || error), 'warning'); }
    }
    if (view.mode !== 'window') view.box.focus({ preventScroll: true });
    await view.refresh();
  };
  for (const type of ['keydown', 'keyup', 'keypress']) input.addEventListener(type, event => {
    event.stopPropagation();
    if (type !== 'keydown' || event.isComposing) return;
    if (event.key === 'Enter') { event.preventDefault(); finish(true); }
    if (event.key === 'Escape') { event.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('click', event => event.stopPropagation());
}

function openLink(view, event, name) {
  event.stopPropagation();
  if (!event.shiftKey) view.leave();
  if (event.shiftKey) logseq.Editor.openInRightSidebar(name).catch?.(() => {});
  else logseq.App.pushState('page', { name });
}

function statusMenu(view, anchor, task) { return view.showMenu(anchor, view.kind.key === 'todos' || !stateProp.ident ? 'Status' : view.kind.title(stateProp.name), view.kind.menuStates().map(status => ({
    html: statusIcon(view.kind.look(status)) + escapeHtml(view.kind.title(status)), on: task.status === status,
    task, run: () => view.kind.setState(task, status),
  }))); }

function priorityMenu(view, anchor, task) { return view.showMenu(anchor, 'Priority', [...PRIORITIES.map(priority => ({
    html: priorityIcon(priority) + escapeHtml(choiceTitles.priority[priority] || PRIORITY_LABEL[priority]), on: task.priority === priority,
    task, run: () => setChoice(task, 'priority', priority),
  })), '-', { html: priorityIcon('') + 'No priority', on: !task.priority, task, run: () => setChoice(task, 'priority', '') }]); }

// The date shown on a row is its due date, or its planned date when it only has that; the menu changes that one.
function dateMenu(view, anchor, task) {
  const key = task.deadline == null && task.scheduled != null ? 'scheduled' : 'deadline';
  const now = task[key];
  const today = startOfDay();
  const nextMonday = today + (((8 - new Date(today).getDay()) % 7) || 7) * DAY;
  const at = days => startOfDay(today + days * DAY + DAY / 2); // noon first, so a clock change does not shift the day
  const picker = el(view.doc, 'input', { type: 'date', 'aria-label': 'Pick a date' });
  if (now != null) { const d = new Date(now); picker.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  keepKeys(picker);
  picker.addEventListener('change', async () => {
    const [y, mo, d] = picker.value.split('-').map(Number);
    if (!y) return;
    view.closeMenu();
    await view.change(() => setDate(task, key, new Date(y, mo - 1, d).getTime()), task);
  });
  view.showMenu(anchor, key === 'deadline' ? 'Due date' : 'Planned for', [
    { task, html: 'Today<kbd>' + shortDate(today).replace('today', MONTHS[new Date().getMonth()] + ' ' + new Date().getDate()) + '</kbd>', run: () => setDate(task, key, today) },
    { task, html: 'Tomorrow', run: () => setDate(task, key, at(1)) },
    { task, html: 'Next Monday<kbd>' + shortDate(nextMonday) + '</kbd>', run: () => setDate(task, key, startOfDay(nextMonday + DAY / 2)) },
    { task, html: 'In a week<kbd>' + shortDate(at(7)) + '</kbd>', run: () => setDate(task, key, at(7)) },
    { node: picker },
    ...(now != null ? ['-', { task, html: key === 'deadline' ? 'Remove due date' : 'Remove planned date', run: () => setDate(task, key, null) }] : []),
  ]);
}

// Right-click on a row: open the task, change it, or delete it. The menu sits at the pointer.
function rowMenu(view, event, task) {
  event.preventDefault();
  event.stopPropagation();
  const x = event.clientX, y = event.clientY;
  const at = { getBoundingClientRect: () => ({ left: x, top: y, bottom: y }) };
  const open = sidebar => () => { if (!sidebar) view.leave(); goTo(task, sidebar).catch(error => warnOnce('a task could not be opened', error)); };
  const name = el(view.doc, 'div', { html: titleHtml(task.title, view.data.names) }).textContent.trim();
  const items = [
    { plain: true, html: 'Open', run: open(false) },
    { plain: true, html: 'Open in right sidebar', run: open(true) },
    { plain: true, html: 'Edit text<kbd>e</kbd>', run: () => view.editTitle(task, view.body.querySelector(`.rt-row[data-uuid="${task.uuid}"] .rt-title`)) },
    '-',
    { plain: true, html: 'Status…<kbd>s</kbd>', run: () => view.statusMenu(at, task) },
    { plain: true, html: 'Priority…<kbd>p</kbd>', run: () => view.priorityMenu(at, task) },
    { plain: true, html: (task.deadline == null && task.scheduled != null ? 'Planned date…' : 'Due date…') + '<kbd>d</kbd>', run: () => view.dateMenu(at, task) },
  ];
  if (!task.isPage) items.push('-', { plain: true, danger: true, html: `Delete ${view.kind.one}…`, run: () => view.showMenu(at, `Delete this ${view.kind.one} and the blocks under it?`, [
    { danger: true, task, html: 'Delete', run: () => logseq.Editor.removeBlock(task.uuid) },
    { plain: true, html: 'Keep it', run: () => {} },
  ]) });
  view.showMenu(at, name, items);
}

// Which tasks the chips and the search box let through.
function visible(view) {
  const words = view.find.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const since = startOfDay() - Math.max(0, setting('todosDoneDays') - 1) * DAY;
  return view.data.tasks.filter(task => {
    const keep = view.kept.has(task.uuid);
    if (view.prefs.view === 'open' && !view.kindIsOpen(task) && !keep) return false;
    if (view.prefs.view === 'doing' && task.status !== 'doing' && task.status !== 'in-review' && !keep) return false;
    if (view.prefs.view === 'done' && (view.kindIsOpen(task) || task.updated < since) && !keep) return false;
    if (view.prefs.urgent && task.priority !== 'urgent' && task.priority !== 'high' && !keep) return false;
    if (view.kind.hasBacklog && view.prefs.hideBacklog && task.status === 'backlog' && !keep) return false;
    if (words.length) {
      const hay = plainTitle(task.title, view.data.names) + ' ' + task.pageTitle.toLowerCase() + ' ' + task.tags.join(' ').toLowerCase();
      if (!words.every(word => hay.includes(word))) return false;
    }
    return true;
  });
}

function rank(view, task) { return [view.kind.groupStates().indexOf(task.status), task.priority ? PRIORITIES.indexOf(task.priority) : 9, whenOf(task) ?? Infinity]; }

function byRank(view, a, b) {
  const ra = view.rank(a), rb = view.rank(b);
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] < rb[i] ? -1 : 1;
  return plainTitle(a.title, view.data.names).localeCompare(plainTitle(b.title, view.data.names));
}

function groups(view, tasks) {
  if (view.prefs.group === 'status') {
    return view.kind.groupStates().map(status => ({ key: status, title: view.kind.title(status), tasks: tasks.filter(task => task.status === status).sort(view.byRank) }));
  }
  if (view.prefs.group === 'page') {
    const pages = new Map();
    for (const task of tasks) {
      const key = task.isPage ? 'pages' : task.pageUuid;
      if (!pages.has(key)) pages.set(key, { key, title: task.isPage ? 'Pages that are tasks' : task.pageTitle || 'Untitled', pageUuid: task.isPage ? null : key, journalDay: task.journalDay, tasks: [] });
      pages.get(key).tasks.push(task);
    }
    // Every task of the page counts toward its bar, also those the chips leave out.
    for (const page of pages.values()) {
      page.tasks.sort(view.byRank);
      if (!page.pageUuid) continue;
      const all = view.data.tasks.filter(task => task.pageUuid === page.key);
      page.done = all.filter(task => view.kind.look(task.status) === 'done').length;
      page.total = all.filter(task => view.kind.look(task.status) !== 'canceled').length;
    }
    // Pages with most to do first; journal days after named pages, newest first.
    return [...pages.values()].sort((a, b) => (Boolean(a.journalDay) - Boolean(b.journalDay)) || (b.journalDay - a.journalDay) ||
      (b.tasks.filter(view.kindIsOpen).length - a.tasks.filter(view.kindIsOpen).length) || a.title.localeCompare(b.title));
  }
  if (view.prefs.view === 'done') {
    return DONE_GROUPS.map(([key, title]) => ({ key, title, tasks: tasks.filter(task => doneBucket(task) === key).sort((a, b) => b.updated - a.updated) }));
  }
  return WHEN_GROUPS.map(([key, title]) => ({ key, title, tasks: tasks.filter(task => whenBucket(task) === key).sort(key === 'none' ? view.byRank : (a, b) => (whenOf(a) - whenOf(b)) || view.byRank(a, b)) }));
}

function row(view, task) {
  // Red only for a due date that has passed; a planned day that has passed is late too, but not overdue.
  const late = view.kindIsOpen(task) && task.deadline != null && task.deadline < startOfDay();
  const daysLate = late ? Math.round((startOfDay() - startOfDay(task.deadline)) / DAY) : 0;
  const dateLabel = task.deadline != null ? `due ${shortDate(task.deadline)}${daysLate > 1 ? ` · ${daysLate} days late` : ''}`
    : task.scheduled != null ? `planned ${shortDate(task.scheduled)}` : 'add date';
  const statusButton = el(view.doc, 'button', { class: 'rt-icon', title: view.kind.title(task.status), html: statusIcon(view.kind.look(task.status)) });
  statusButton.addEventListener('click', event => { event.stopPropagation(); view.statusMenu(statusButton, task); });
  const title = el(view.doc, 'span', { class: 'rt-title', html: titleHtml(task.title, view.data.names) });
  // One click goes to the task (after a moment, so a double-click can edit it instead); a link in it opens its page.
  let clickTimer = 0;
  title.addEventListener('click', event => {
    event.stopPropagation();
    const link = event.target.closest?.('[data-page]');
    if (link && title.contains(link)) { view.openLink(event, link.dataset.page); return; }
    clearTimeout(clickTimer);
    if (event.detail > 1) return;
    const sidebar = event.shiftKey;
    clickTimer = setTimeout(() => { if (!sidebar) view.leave(); goTo(task, sidebar).catch(error => warnOnce('a task could not be opened', error)); }, 400);
  });
  title.addEventListener('mousedown', event => { if (event.detail > 1) { clearTimeout(clickTimer); event.preventDefault(); } });
  title.addEventListener('dblclick', event => { event.stopPropagation(); clearTimeout(clickTimer); view.editTitle(task, title); });
  // Under the text, quieter: subtasks, then the task's tags and page.
  const sub = el(view.doc, 'div', { class: 'rt-sub' });
  const subtasks = view.data.subs?.get(task.uuid);
  if (subtasks?.total) sub.append(el(view.doc, 'span', { class: 'rt-subtasks' + (subtasks.done === subtasks.total ? ' rt-all' : '') }, `${subtasks.done} of ${subtasks.total} subtasks`));
  if (!view.compact) {
    for (const tag of task.tags) sub.append(el(view.doc, 'span', { class: 'rt-kind' }, '#' + tag));
    if (view.prefs.group !== 'page' && !task.isPage) sub.append(el(view.doc, 'span', { class: 'rt-src' }, task.pageTitle));
  }
  const main = el(view.doc, 'div', { class: 'rt-main' }, el(view.doc, 'div', { class: 'rt-line' }, title), sub.childNodes.length ? sub : null);
  const isToday = view.kindIsOpen(task) && whenOf(task) != null && startOfDay(whenOf(task)) === startOfDay();
  const dateButton = el(view.doc, 'button', { class: 'rt-date' + (late ? ' rt-is-late' : '') + (isToday ? ' rt-is-today' : '') + (task.deadline == null && task.scheduled != null ? ' rt-is-planned' : '') + (whenOf(task) == null ? ' rt-empty' : ''), title: task.deadline != null && task.scheduled != null ? `planned ${shortDate(task.scheduled)}` : '' }, dateLabel);
  dateButton.addEventListener('click', event => { event.stopPropagation(); view.dateMenu(dateButton, task); });
  const prioButton = el(view.doc, 'button', { class: 'rt-icon', title: 'Priority: ' + (task.priority ? choiceTitles.priority[task.priority] || PRIORITY_LABEL[task.priority] : 'none'), html: priorityIcon(task.priority) });
  prioButton.addEventListener('click', event => { event.stopPropagation(); view.priorityMenu(prioButton, task); });
  // The sidebar list leaves out the priority bars, except as a mark on urgent and high tasks.
  const meta = view.compact ? el(view.doc, 'div', { class: 'rt-meta' }, dateButton, ...(task.priority === 'urgent' || task.priority === 'high' ? [el(view.doc, 'span', { class: 'rt-icon rt-still', html: priorityIcon(task.priority) })] : []))
    : el(view.doc, 'div', { class: 'rt-meta' }, dateButton, prioButton);
  const node = el(view.doc, 'div', { class: `rt-row${view.kindIsOpen(task) ? '' : ' rt-closed'} rt-st-${view.kind.look(task.status)}-row`, 'data-uuid': task.uuid },
    statusButton, main, meta);
  node.addEventListener('contextmenu', event => view.rowMenu(event, task));
  node.addEventListener('mousemove', () => { if (view.shown[view.cursor] !== task) { view.cursor = view.shown.indexOf(task); view.mark(false); } });
  return node;
}

function draw(view) {
  // Redrawing would remove the text box of a task being edited, and with it what was typed.
  if (view.editing) { view.drawLater = true; return; }
  view.drawLater = false;
  for (const button of view.groupButtons) button.setAttribute('aria-pressed', String(button.dataset.group === view.prefs.group));
  const since = startOfDay() - Math.max(0, setting('todosDoneDays') - 1) * DAY;
  const counts = {
    open: view.data.tasks.filter(view.kindIsOpen).length,
    doing: view.data.tasks.filter(task => task.status === 'doing' || task.status === 'in-review').length, // Todos only
    done: view.data.tasks.filter(task => !view.kindIsOpen(task) && task.updated >= since).length,
    all: view.data.tasks.length,
  };
  for (const chip of view.viewChips) { chip.setAttribute('aria-pressed', String(chip.dataset.view === view.prefs.view)); chip.lastChild.textContent = counts[chip.dataset.view]; }
  view.urgentChip.setAttribute('aria-pressed', String(view.prefs.urgent));
  view.backlogChip.setAttribute('aria-pressed', String(view.prefs.hideBacklog));
  const tasks = view.visible();
  view.count.textContent = view.loaded ? `${tasks.length} shown` : 'Loading…';
  if (view.compact) view.find.placeholder = view.loaded ? `Find in ${tasks.length} open ${view.kind.many}` : 'Loading…';
  const scroll = view.body.scrollTop;
  view.body.textContent = '';
  view.shown = [];
  for (const group of view.groups(tasks)) {
    if (!group.tasks.length) continue;
    const h3 = el(view.doc, 'h3', {});
    if (group.pageUuid) {
      const name = el(view.doc, 'span', { class: 'rt-open', title: 'Open this page' }, group.title);
      name.addEventListener('click', event => { if (!event.shiftKey) view.leave(); event.shiftKey ? logseq.Editor.openInRightSidebar(group.pageUuid) : logseq.App.pushState('page', { name: group.pageUuid }); });
      h3.append(name);
    } else h3.append(group.title);
    h3.append(el(view.doc, 'span', { class: 'n' }, String(group.tasks.length)));
    if (group.total) h3.append(el(view.doc, 'span', { class: 'rt-prog', html: `<i style="width:${Math.round(100 * group.done / group.total)}%"></i>`, title: `${group.done} of ${group.total} done` }), el(view.doc, 'span', { class: 'n' }, `${group.done} of ${group.total} done`));
    const section = el(view.doc, 'section', { class: 'rt-group rt-' + group.key }, h3);
    for (const task of group.tasks) { section.append(view.row(task)); view.shown.push(task); }
    view.body.append(section);
  }
  if (!view.shown.length) {
    view.body.append(el(view.doc, 'div', { class: 'rt-empty-note', html: !view.loaded ? `Loading ${view.kind.many}…`
      : view.data.tasks.length ? (view.compact ? `No open ${view.kind.many} match.` : `No ${view.kind.many} match.<br>Try another chip above, or clear the search box.`)
      : view.kind.empty }));
  }
  view.body.scrollTop = scroll;
  if (view.cursor >= view.shown.length) view.cursor = view.shown.length - 1;
  view.mark(false);
}

function mark(view, scrollIntoView) {
  const rows = view.body.querySelectorAll('.rt-row');
  rows.forEach((node, i) => node.classList.toggle('rt-current', i === view.cursor));
  if (scrollIntoView && rows[view.cursor]) rows[view.cursor].scrollIntoView({ block: 'nearest' });
}

async function refresh(view) {
  if (view.loading) { view.again = true; return view.loading; }
  view.loading = (async () => {
    try {
      await view.kind.prepare().catch(error => warnOnce('status names could not be read', error));
      view.data = await loadTasks(view.kind.key);
      view.loaded = true;
    } catch (error) { warnOnce('tasks could not be read', error); view.loaded = true; }
    view.draw();
  })();
  await view.loading;
  view.loading = null;
  if (view.again) { view.again = false; return view.refresh(); }
}

// Arrows move through the tasks, Enter goes to one, Space ticks it off, / goes to the search box.
function onKey(view, event) {
  if (!view.box.isConnected || event.target === view.editing || view.menu?.contains(event.target)) return;
  if (event.key === 'Escape') {
    if (view.menu) view.closeMenu();
    else if (event.target === view.find && view.find.value) { view.find.value = ''; view.draw(); }
    else if (view.mode === 'window') view.leave();
    else { view.doc.activeElement?.blur?.(); view.cursor = -1; view.mark(false); }
    event.preventDefault(); event.stopPropagation();
    return;
  }
  const typing = event.target?.matches?.('input, textarea');
  if (view.menu && !typing) { event.stopPropagation(); return; }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (typing && event.target !== view.find) return;
    event.preventDefault(); event.stopPropagation();
    if (!view.shown.length) return;
    view.cursor = event.key === 'ArrowDown' ? Math.min(view.shown.length - 1, view.cursor + 1) : Math.max(0, view.cursor - 1);
    if (typing) view.find.blur();
    view.mark(true);
    return;
  }
  if (event.key === 'Enter' && view.shown[view.cursor] && (!typing || event.target === view.find)) {
    event.preventDefault(); event.stopPropagation();
    const task = view.shown[view.cursor];
    if (!event.shiftKey) view.leave();
    goTo(task, event.shiftKey).catch(error => warnOnce('a task could not be opened', error));
    return;
  }
  if (typing) return;
  const rowKey = !event.metaKey && !event.ctrlKey && !event.altKey && view.shown[view.cursor] ? event.key.toLowerCase() : '';
  const rowNode = rowKey && view.body.querySelectorAll('.rt-row')[view.cursor];
  if (rowNode && ['s', 'p', 'd', 'e'].includes(rowKey)) {
    event.preventDefault(); event.stopPropagation();
    const task = view.shown[view.cursor];
    if (rowKey === 's') view.statusMenu(rowNode.querySelector('.rt-icon') || rowNode, task);
    if (rowKey === 'p') view.priorityMenu(rowNode.querySelector('.rt-meta button.rt-icon') || rowNode.querySelector('.rt-meta') || rowNode, task);
    if (rowKey === 'd') view.dateMenu(rowNode.querySelector('.rt-date') || rowNode, task);
    if (rowKey === 'e') view.editTitle(task, rowNode.querySelector('.rt-title'));
    return;
  }
  if ((event.key === ' ' || rowKey === 'x') && view.shown[view.cursor]) {
    event.preventDefault(); event.stopPropagation();
    const task = view.shown[view.cursor];
    view.change(() => view.kind.setState(task, view.kind.look(task.status) === 'done' ? view.kind.openKey() : view.kind.doneKey), task);
    return;
  }
  if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f')) {
    event.preventDefault(); event.stopPropagation(); view.find.focus(); view.find.select(); return;
  }
  // Shortcuts with Cmd, Ctrl or Option (such as the ones that open Todos and Expectations) still reach Logseq.
  if (!(event.metaKey || event.ctrlKey || event.altKey)) event.stopPropagation();
}

function onDown(view, event) { if (view.menu && !view.menu.contains(event.target)) view.closeMenu(); }

function destroy(view) {
  view.missed = false;
  view.closeMenu();
  view.hideToast();
  view.keyTarget.removeEventListener('keydown', view.onKey, view.mode === 'window');
  view.doc.removeEventListener('mousedown', view.onDown, true);
  clearTimeout(view.timer);
  try { view.offChanged?.(); } catch (error) { /* already off */ }
  view.box.remove();
}
// The add box: a hint under it says what it understood (priority, due day); Enter adds the task.
function addBoxListeners(view) {
  view.add.addEventListener('input', () => {
    const { priority, due } = parseAdd(view.add.value);
    const bits = [];
    if (due != null) bits.push('due ' + shortDate(due));
    if (priority) bits.push((choiceTitles.priority[priority] || PRIORITY_LABEL[priority]) + ' priority');
    view.addHint.textContent = bits.join(' · ');
  });
  view.add.addEventListener('keydown', async event => {
    if (event.key !== 'Enter' || event.isComposing) return;
    const text = view.add.value.trim();
    if (!text) return;
    view.add.disabled = true;
    try { await addParsed(view.kind, text); view.add.value = ''; view.addHint.textContent = ''; await view.refresh(); }
    catch (error) { warnOnce(`${view.a} ${view.kind.one} could not be added`, error); logseq.UI.showMsg(`Could not add the ${view.kind.one}: ` + (error?.message || error), 'warning'); }
    finally { view.add.disabled = false; view.add.focus(); }
  });
}

// The pieces of createView, each given the view's state; createView binds them to the view by name.
const CREATEVIEW_FUNCTIONS = [savePrefs, kindIsOpen, forget, closeMenu, showMenu, change, hideToast, showToast, offerUndo, editTitle, openLink, statusMenu, priorityMenu, dateMenu, rowMenu, visible, rank, byRank, groups, row, draw, mark, refresh, onKey, onDown, destroy];

function open(kind = KINDS.todos) {
  if (current?.kind === kind) { current.focus(); return; }
  current?.close();
  const doc = host();
  doc.querySelector('.' + PANEL_CLASS)?.remove();
  const close = () => { view.destroy(); backdrop.remove(); current = null; };
  const view = createView(doc, 'window', close, kind);
  const backdrop = el(doc, 'div', { class: PANEL_CLASS }, view.node);
  backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) close(); });
  current = { kind, close, focus: view.focus };
  doc.body.append(backdrop);
  view.focus();
  view.refresh();
}

/* The main view and the sidebar panel. Logseq draws them with its own React; each holds a view made
   by createView, made when Logseq shows it and taken down when Logseq removes it. */
const ROUTE_PATH = { todos: '/refinement-todos', expectations: '/refinement-expectations' };
const SIDEBAR_KEY = { todos: 'todos', expectations: 'expectations' };
function hostComponent(mode, kind) {
  const React = logseq.Experiments.React;
  return function RefinementTodos() {
    const ref = React.useRef(null);
    React.useEffect(() => {
      const holder = ref.current;
      if (!holder) return undefined;
      const view = createView(holder.ownerDocument, mode, () => {}, kind);
      holder.append(view.node);
      // Logseq titles a plugin's sidebar panel with its inner name (logseq-db-refinements/_sidebar.todos).
      const heading = mode === 'sidebar' && holder.closest('.sidebar-item')?.querySelector('.page-title h3');
      if (heading) heading.textContent = kind.name;
      view.refresh();
      return () => view.destroy();
    }, []);
    return React.createElement('div', { ref, className: 'refinement-todos-holder rt-holder-' + mode });
  };
}
const hosted = {};
function registerHosts(kind) {
  const React = logseq.Experiments?.React;
  hosted[kind.key] = { page: false, sidebar: false };
  if (!React?.createElement) { warnOnce(`Logseq gives plugins no React here, so ${kind.name} shows only as a window`); return; }
  const name = 'refinement-' + kind.key;
  try {
    const Page = hostComponent('page', kind);
    logseq.Experiments.registerRouteRenderer(name, { name, path: ROUTE_PATH[kind.key], render: () => React.createElement(Page) });
    hosted[kind.key].page = true;
  } catch (error) { warnOnce(`the ${kind.name} page could not be added`, error); }
  try {
    const Side = hostComponent('sidebar', kind);
    logseq.Experiments.registerSidebarRenderer(SIDEBAR_KEY[kind.key], { title: kind.name, render: () => React.createElement(Side) });
    hosted[kind.key].sidebar = true;
  } catch (error) { warnOnce(`the ${kind.name} sidebar panel could not be added`, error); }
}
function openPage(kind = KINDS.todos) {
  if (!hosted[kind.key]?.page) { open(kind); return; }
  host().defaultView.location.hash = '#' + ROUTE_PATH[kind.key];
}
async function openSidebar(kind = KINDS.todos) {
  if (!hosted[kind.key]?.sidebar) { open(kind); return; }
  try {
    await logseq.Editor.openInRightSidebar('_sidebar.' + SIDEBAR_KEY[kind.key]);
    await logseq.App.setRightSidebarVisible?.(true);
  } catch (error) { warnOnce(`${kind.name} could not open in the sidebar`, error); open(kind); }
}
const openAs = (kind = KINDS.todos) => ({ page: openPage, sidebar: openSidebar }[setting('todosOpensAs')] || open)(kind);

function start() {
  logseq.provideStyle({ key: 'refinement-todos', style: css });
  const models = {};
  for (const kind of Object.values(KINDS)) {
    const binding = setting(kind.key + 'Shortcut').trim().toLowerCase();
    registerHosts(kind);
    logseq.App.registerCommandPalette({ key: 'show-' + kind.key, label: kind.name, ...(binding ? { keybinding: { binding } } : {}) }, () => openAs(kind));
    logseq.App.registerCommandPalette({ key: `show-${kind.key}-window`, label: `${kind.name} as a window` }, () => open(kind));
    logseq.App.registerCommandPalette({ key: `show-${kind.key}-page`, label: `${kind.name} as a page` }, () => openPage(kind));
    logseq.App.registerCommandPalette({ key: `show-${kind.key}-sidebar`, label: `${kind.name} in the right sidebar` }, () => openSidebar(kind));
    if (!setting(kind.key + 'ToolbarButton')) continue;
    const model = 'refinementOpen' + kind.name;
    models[model] = () => openAs(kind);
    logseq.App.registerUIItem('toolbar', {
      key: 'refinement-' + kind.key,
      template: `<a class="button" data-on-click="${model}" title="${kind.name}${binding ? ' (' + escapeHtml(binding) + ')' : ''}">${kind.icon()}</a>`,
    });
  }
  logseq.provideModel(models);
  window.refinementTodos = { open, openPage, openSidebar, KINDS };
  onUnload(() => { current?.close(); host().querySelector('.' + PANEL_CLASS)?.remove(); host().querySelector('.refinement-todos-menu')?.remove(); });
}

(window.refinementParts ||= []).push({ name: 'todos', schema: settingsSchema, start, stop: runUnloadTasks });
})();
