/* Loaded by main.js after parts/tag-path.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* A property's kind, left of its name in a page's or a bullet's list of property rows (0.4.334, the owner, with a picture
   of Jay Varughese's page: "why don't the properties of pages not have the icons of the tag map page?"). Logseq draws
   a grey dot there (or its point icon); it gives way to the same icon as in the tag map: an arrow for a link to a node,
   two for several, a calendar for a date, Aa for text, 123 for a number, a box with a chevron for a choice. Only the dot
   goes: an icon you gave a property yourself stays, and a property the plugin does not know (Alias) keeps Logseq's. The
   icon takes the dot's place in Logseq's own button, so nothing moves and a click on it does what Logseq's does. */
const shared = window.refinementShared;
const { host, kindIcon } = shared;
const { warnOnce, onUnload, runUnloadTasks } = shared.lifecycle({ prefix: 'Refinements (property kinds): ', leaves: { elements: '.property-m > .rf-kind', attributes: ['data-rf-kind'] } });
let model, sendStyle, watchDom, watchDomEarly, addsElements, onDatabaseChange, onSettingsChange;
const take = (core, names) => shared.take(core, names, warnOnce);

const settingsSchema = [
  { key: 'propertyKindsHeading', type: 'heading', group: 'reading', rank: 2, title: 'Property kinds', default: null,
    legend: 'Each property’s kind before its name, as in the tag map',
    zone: '<div><span class="m">→</span> Works at &nbsp; <span class="m">Aa</span> Notes</div>',
    description: 'Changes here apply right away.' },
  { key: 'propertyKindIcons', type: 'boolean', title: 'Each property’s kind as an icon before its name', default: true,
    description: 'In the list of properties under a page’s title, and in a bullet’s list of properties, the grey dot before a property’s name becomes the icon of its kind, as in the tag map: an arrow for a link to a node (two for several), a calendar for a date, Aa for text, 123 for a number, a box with a chevron for a choice. An icon you gave a property yourself stays. Applies at once.' },
];
const setting = shared.settingReader(settingsSchema);

const css = `
/* Logseq's dot gives way to the kind's icon, in the same button (0.4.334). */
.property-m[data-rf-kind] > :is(.bullet-container, .ls-icon-point-filled) { display: none; }
.property-m > .rf-kind { display: inline-flex; justify-content: center; width: 15px; font-size: 15px; vertical-align: 0; }
`;

const ROWS = '.ls-properties-area .property-pair.property-panel-row[data-property-title]';
let byTitle = null, loading = null, timer = 0, stopped = false;
async function load() {
  const asked = loading = model.propSchema();
  try {
    const schema = await asked;
    if (asked !== loading || stopped) return;
    byTitle = new Map(schema.props.map(prop => [prop.title, prop]));
    draw(host());
  } catch (error) { warnOnce('could not read the properties’ kinds', error); }
}
const kindOf = prop => prop.choices.length ? 'choice' : prop.type;
function draw(doc) {
  if (!doc || !byTitle) return;
  const on = setting('propertyKindIcons');
  for (const row of doc.querySelectorAll(ROWS)) {
    const button = row.querySelector(':scope > .property-key-panel .property-icon > .property-m');
    if (!button) continue;
    const prop = on ? byTitle.get(row.getAttribute('data-property-title')) : null;
    // Only Logseq's own dot is taken over; a property with an icon of its own keeps it.
    const dot = button.querySelector(':scope > :is(.bullet-container, .ls-icon-point-filled)');
    const want = prop && dot && !prop.icon ? `${kindOf(prop)}${prop.many ? '+' : ''}` : '';
    let mine = button.querySelector(':scope > .rf-kind');
    if (!want) { if (mine) { mine.remove(); button.removeAttribute('data-rf-kind'); } continue; }
    if (mine?.dataset.kind === want) continue;
    mine?.remove();
    mine = kindIcon(doc, kindOf(prop), { several: prop.many });
    mine.dataset.kind = want;
    button.append(mine);
    button.setAttribute('data-rf-kind', '');
  }
}
// Before the screen is drawn, whenever rows came (a page opening, a property added); the frame pass catches the rest.
const drawEarly = (doc, records) => { if (addsElements(records)) draw(doc); };
function clear() {
  for (const el of host().querySelectorAll('.property-m > .rf-kind')) el.remove();
  for (const el of host().querySelectorAll('.property-m[data-rf-kind]')) el.removeAttribute('data-rf-kind');
}

function start() {
  ({ sendStyle, watchDom, watchDomEarly, addsElements, onDatabaseChange, onSettingsChange } = take(window.refinementCore, ['sendStyle', 'watchDom', 'watchDomEarly', 'addsElements', 'onDatabaseChange', 'onSettingsChange', 'propSchema']));
  model = window.refinementCore.provided; // the graph through the model's doors
  stopped = false;
  sendStyle('refinement-property-kinds', css);
  watchDomEarly(drawEarly);
  watchDom(function drawPropertyKinds(doc) { if (!stopped) draw(doc); });
  // A property made, renamed or turned into another kind shows soon after (the model reads its schema again).
  onDatabaseChange(() => { if (stopped) return; clearTimeout(timer); timer = setTimeout(load, 900); });
  onSettingsChange((now, before) => { if (!stopped && now?.propertyKindIcons !== before?.propertyKindIcons) draw(host()); });
  onUnload(() => { stopped = true; clearTimeout(timer); loading = null; clear(); });
  load();
}
(window.refinementParts ||= []).push({ name: 'property-kinds', schema: settingsSchema, start, stop: runUnloadTasks });
})();
