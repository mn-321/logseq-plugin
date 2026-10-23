# `parts/styles.js`, rule by rule

Phase 3 of `docs/FINISHING-PROMPT.md` (layer 5): every rule group of the resting `parts/styles.js`, what it changes, layout
or look, and where it goes. Written 2026-10-23 from the code (a reader agent drafted the table; the claims it rests on were
checked: the kit defines `--rf-quiet` and `--rf-faint` as colours, `parts/shared.js` 756, while `styles.js` defines them
as numbers; no loaded part sets any `data-refinement-*` mark; `links.js` 1589 and `page-look.js` 23 both declare
`quietLinks`). Rows marked **look in the app** are confirmed there before they are built. Line numbers are of
`parts/styles.js` as at 0.4.350.

**Where its marks come from.** Every `data-refinement-*` mark the rules style is set only by resting parts: `links.js`
(date, block-link, ref-row, usage-dim, own-tag, journal, below, date-heading, ref-count, pdf…, tense, pick, mention,
prop-label, via, child-assets/kinds, day-cue, crumb-markup), `properties.js` (crumb-box, value-lead), `chrome.js`
(quiet), `pages.js` (`.refinement-title-tags`), `editor.js` (the old link box). A rule that styles only such marks has
nothing to do unless its part comes back with that piece.

| # | Rule (lines) | What it changes | Kind | Fate | Why |
|---|---|---|---|---|---|
| 1 | `tokensCss` (24–55) | the old scale: opacities as numbers, washes, a violet accent `#8b7fc7`, popup shadows | — | **drop** | the kit's scale (`kitCss`) replaces it; loading it would turn the kit's colour greys into numbers |
| 2 | `plainPageIcons` (104–128) | Logseq's generic file icon drawn as a plain outline | look | **drop** | an icon of the plugin's own; nothing the grammar asks for |
| 3 | `tidySidebar` (129–139) | right-sidebar items without card, shadow or corners; a 1 px line | look | the line: **drop**, in `sidebar.js` (`sidebarThickDividers`); the card: **with `chrome.js`'s tidy sidebar, judged in layer 4** | one way of doing each thing |
| 4, 7 | `quietLinks` (140–152, 178–187) | links in the text colour, a faint underline | look | **drop**, done in `page-look.js` (`linksCss`) | — |
| 5 | `childTypeCues` (153–168) | ↳, task circle, file icons, "3 #Decision" after a folded block | layout | **drop** | marks from `links.js`, whose cue marks go (§5.6); a `#` |
| 6 | `dayCues` (169–177) | what a journal day holds, after its title | layout | **drop** | `links.js` marks; `pages.js` rests |
| 8, 24 | `referenceIcons` (188–231, 416–430) | file icons before pdf/png links, a dot before links to blocks, ((ref)) dots | layout | **drop** | drawings of the plugin's own; marks from `links.js`; no files in the test graph |
| 9a | `plainProperties` (235–239) | no capsule, a dot between properties | look | **drop**, done in `page-look.js` (`noCapsules`) | — |
| 9b | 〃 (243–255) | the expand capsule as a triangle at the row's start | layout | **drop** | moves the row |
| 9c | 〃 (259–267) | property names grey, smaller in a page's list | look + size | **drop**, done in `page-look.js` (`quietNames`) | the size would move things |
| 9d | 〃 (270–273, 303–308) | a grey field behind property lists | look (a fill) | **drop** | no fills (grammar) |
| 9e | 〃 (278, 280) | `#` before tag-tab names | look | **drop** | the two-way rows hide those tabs; no `#` |
| 9f | 〃 (287–292) | text values lined up with bulleted ones in a page's list | layout | **drop**, unless **looked at in the app** and still out of line | Logseq's own layout |
| 9g, 9h | 〃 (294–297, 311) | query count on the title's baseline; value bullets hidden in a page's list | layout | **drop** | Logseq's spacing; `property-kinds.js` owns the name's icon |
| 9i | 〃 (314–318) | "Add property" shown only with the pointer on the properties, its room kept | look (opacity) | **keep → `page-look.js`, `quietAddProperty`, on** (**look in the app**) | "nothing shows until needed", as the title words |
| 10 | `quietEmptyProps` (320–325) | empty properties faint | look | **keep → `page-look.js`, `quietEmptyProps`, on** (**look in the app** beside the proposals' own rule) | owner-approved at 0.4.79; the proposals cover only their graphs |
| 11 | `emptySlotsInRow` (326–337) | empty list rows reading "Scheduled: ···" | layout | **drop** | moves rows; hides the icon `property-kinds.js` draws |
| 12, 18, 19, 22 | `showUsage`, `referenceLayout`, `linkLabels` (338–343, 372–401, 409–411) | Linked references reworked: rows stepping back, gaps, crumbs, counts, lone names hidden | layout | **drop** | the owner: no heavy Linked references rework, no "show how a page is used / records are linked" |
| 13 | `ownTagHidden` (344–347) | a tag page's own tag left off its rows | layout | **drop** | marks from `links.js` |
| 14 | `quietSidebarIcons` (348–353) | left sidebar: generic page icons hidden (room kept), journal days grey | look | **with `chrome.js`, judged in layer 4** | its journal mark is `links.js`'s |
| 15, 20 | `compactJournals`, `showTitleChrome` (354–357, 402–405) | journal days shorter; padding between days | layout | **drop** | `pages.js` rests; moves the Journals list |
| 16 | `embedLine` (358–364) | a faint line beside embeds | look | **drop** | a drawn edge the grammar does not ask for |
| 17 | `quietLinks` (365–371) | Linked references' source headings bold, no underline | look | **drop** | no Linked references rework |
| 21, 23 | `tidyPaths` (406–408, 412–415) | brackets in paths fade; path parts use their room | look / layout | **drop** | a `links.js` mark; Logseq's own truncation |
| 25 | `pdfCitations` (431–490) | PDF excerpts as quotations | layout | **drop** | `links.js` marks; no PDFs in the test graph; hard-coded colour and font |
| 26 | `dateStyle` (491–533) | dates in a grey box; overdue colour | look + padding | **drop**, dates done in `page-look.js` (`quietDates`); the pencil after a date value (501): **look in the app** whether 2.0.2 still draws it | a box is against the grammar |
| 27 | `dateTense` (534–540) | past days grey, today firmer | look | **drop** | rejected (`HANDOFF.md`: nothing steps back by age) |
| 28 | (541–545) | rarely used sidebar and toolbar items smaller and greyer | look + size | **with `chrome.js`, judged in layer 4** | `chrome.js`'s mark |
| 29 | (546–548) | a pointer cursor on a link inside a reference | look | **drop** | Logseq's own |
| 30 | `quietLinks` (549–571) | nested links underlined; links on highlights steel blue | look | **drop** | done in `page-look.js`; a colour of its own |
| 31 | (572–577) | the old dark Undo bar | layout | **drop** | the kit's Undo replaces it |
| 32–35 | `pickerMarks`, `valuePickerMarks`, `propertyPickerTypes`, `linkBoxList`, `linkBoxBeside` (578–638) | marks in Logseq's lists; the old link box | look + layout | **drop** | `picker.js` and `link-text.js` own these on the kit; `#` and italic against the grammar |
| 36 | `tagPageCss` (640–653) | a `#` icon on links to tag pages | look | **drop** | a tag is a class, no `#` |
| 37 | `cueCss` (655–684) | block-link dots, "via …", property labels in references | layout | **drop** | `links.js` marks; "via" and "points here" go (§5.6) |
| 38 | `indentGuides` (691–697) | nesting lines fainter, firmer beside the branch under the pointer | look | **keep → `page-look.js`, `indentGuides`, on**, on the kit's hairline and line (**look in the app**: Logseq's `--ls-guideline-color`) | quiet greys, nothing moves |
| 39 | `quietEmptyBullets` (700–702) | no dot on empty blocks | look | **drop** | makes something Logseq shows invisible (`HANDOFF.md`, tried and rejected in spirit) |
| 40a | `tagMark` (711–714) | the `#` slot hidden; tags grey mono | look | **drop**, done in `page-look.js` (`tagsAsClasses`) | — |
| 40b | 〃 (719–722) | under 600 px wide a block's row stays a row | layout | **drop** | Logseq's own narrow layout (Logseq's behaviour beats the plugin's); the rule moved Logseq's tags in narrow places |
| 40c | 〃 (724–733) | title tag label size, mention `#`, tab mono | look | **drop** | the title corner is `tag-path.js`; no `#` |
| 41 | `tintTags` (736–741) | a violet chip behind tags | look | **drop** | a colour of its own and a pill |

**Settings.** Gone with `styles.js`: `hierarchyHeading`, `plainProperties`, `emptySlotsInRow`, `childTypeCues`,
`dateStyle`, `dateTense`, `tintTags`, `tagMark`, `hiddenPropsChevron`, `quietEmptyBullets`, `embedLine`,
`plainPageIcons`. Moved to `page-look.js` under the same name, so the owner's saved value carries over:
`indentGuides` (on), `quietEmptyProps` (on). New: `quietAddProperty` (on). The keys in `cssParts` that belong to
other parts' schemas (`pages.js`, `links.js`, `chrome.js`) go or stay with those parts.

**Open, to be looked at in the app before building:** whether page links to blocks should keep the underline
`page-look.js` gives every page link (`styles.js` left them without); whether 2.0.2 still draws the pencil after a date
value and still uses `--ls-guideline-color`; how empty properties read under a bullet being written in a graph with the
proposals on (theirs .45) beside one without.
