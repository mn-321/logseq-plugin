# DB Refinements today

Written 2026-10-24 at version 0.4.381 from the code on `main` (`main.js`'s `PART_FILES` and `RESTING_FILES`, each
part's settings and commands as the plugin registers them, the tools and what `tools/check.sh` runs). It is a living
document: when a part is added, rested or deleted, or its settings or keys change, this file changes with it. Version
by version history is `CHANGELOG.md`; how it came to be this way is `docs/LOGBOOK.md` and `docs/history/`.

## 1. What it is

DB Refinements is a personal plugin for Logseq 2.0.2 DB graphs, for one owner. It shows each link from both ends: a
node property that points at a page shows on that page as a row read backwards ("provider of → 2 Consultations"). It
draws the owner's tags and properties as one map that can be edited in place. While a bullet is written it proposes
the property values it can work out, suggests links to existing pages, links selected words, and puts the nodes that
fit first in Logseq's own lists. Around that it makes Logseq's page and window quieter: tags as names in mono, links
without blue, properties without capsules, each property's kind as an icon, PDF highlights as quotations, a page's tags
and the tags above them beside its title, a tidier search window and sidebars. It changes nothing in the notes unless a
key is pressed or a button used, and every change it makes has an Undo arrow.

## 2. The layers

The layers and the rule between them are `docs/LAYERS.md`: a layer uses only the layers below it. Every file in
`parts/` appears below exactly once. Twenty-five files are loaded, in the order of `PART_FILES`; six rest in
`RESTING_FILES`, kept but never loaded. A resting part would not start as it stands: it asks the kit for pieces that
were removed when the kit was built (`waitFor`, `showUndoBar`), so one comes back only by being rebuilt on the kit and
the model (CLAUDE.md).

**The leaning check** (`tools/leaning-test.js`, in check.sh) reported on 2026-10-24: direct Logseq calls outside
layer 1, 0; parts reaching sideways through `window.refinement*`, 0; names on Logseq's window beyond the engine's
three, 0. It does not see three things (found 2026-10-24). Two parts read another part's names through
`core.provided`: the tag map reads the two-way rows' `backwardsLabel` and `setBackwards`, and the pickers read the
proposals' `pickerOrder`, each optional and guarded. Two features share an object among their own files
(`shared.feature('tagMap')`, `shared.feature('proposals')`). And the tag map puts `refinementTagTimes` on Logseq's
window with `||=`, which its pattern misses.

The settings window gathers every section under four groups: **Reading a page**, **Writing a record**, **Around the
page** and **Tools**. A fifth, Paused, stays empty while no paused part is loaded.

### Layer 1: talking to Logseq

The one way to read and write the graph, watch the screen, wait for Logseq, register a command and show a notice.

| File | What it does | Settings | Commands and keys | Tests |
|---|---|---|---|---|
| `loader.js` | Logseq's starting file; loads `main.js` fresh so a reload runs new code | none | none | check.sh (syntax) |
| `main.js` | The engine: the screen watcher, the database round, the hooks, the command register (palette entries, toolbar buttons, keys it listens for), `mountView` for whole views, the self-check after a Logseq update, the part loader. Draws nothing of its own but notices: an installed copy without the effect box, Foundation only, a self-check, "reload to apply" | none | none of its own | boot-test, every pretend-window test |
| `parts/shared.js` (its plumbing) | Host, notices, warnings, the clean-up list, settings reader, the screen door `core.screen` (waiting, pressing Logseq's buttons, typing into its fields), measuring | none | none | undo-test, boot-test, nearly every other test |
| `parts/model.js` | The Logseq model: what a page, bullet, tag, property, journal day and link are, and every read and write of the graph. Runs under Foundation only | none | none | model-test (141 checks, 20,000-page timings; `--big` 100,000) |
| `parts/diagnostics.js` | The troubleshooting tools: Check what the plugin finds on this page, Measuring, Copy performance report, Copy styling details of this block, Copy warnings, Take the tour (F8 for the next stop). Runs under Foundation only | `foundationOnly` (off); reads `debugPerf`, `debugPerfEvery`, `perfLog`, `tourStops`, `tourAuto` from the settings file and writes `perfReport`, `tourReport` | palette: **Refinements: troubleshooting**; the six tools as commands without a palette entry | boot-test |

### Layer 2: the kit

| File | What it does | Tests |
|---|---|---|
| `parts/shared.js` (the kit) | Every pop-up, menu, question, the one dialog, field, the three buttons, tick box, words for chips, picking bar, hover card, the faded Undo arrow (several at once, waiting bottom right when nothing is left to sit beside), quiet line, help paragraph, icon list (Logseq's own Tabler font), `el()` and `esc()`, with one stylesheet. Right-click menus stay open in an installed copy | undo-test (the one Undo), pictures, frames |

### Layer 3: features

Each stands alone (`tools/parts-apart-test.js` boots the plugin with each left out) and draws only with the kit.

| Feature and files | What the owner sees | Settings (default) | Commands and keys | Tests |
|---|---|---|---|---|
| **Two-way rows**, `parts/two-way.js` | On a page a node property points at, each such property is a row in the page's own property list read backwards, with the nodes, their day and tag; a long row folds to a count; hover cards; tick boxes and a picking bar (change or remove the page, Tag, Copy, Property, delete, Sidebar); + adds a node; a list of more than three groups by tag, month or any property, with a + per group; a small arrow before a node opens its bullets to write one into it (0.4.376); Logseq's tag lists at the page's foot hidden where rows are drawn | `twoWayRows` (on), `twoWayNames`, `twoWayOneEnd` (empty), `twoWayHideTagLists` (on) | right-click a row's name: Date first, Name first, Rename how it reads…, Group by… | two-way-rows-test, two-way-check (the real graph), tags-test, odd-text-test, frames, pictures |
| **Tag map**, `parts/tags-graph.js` (state and every change to the graph), `parts/tags-props.js` (the property rows and the Properties view), `parts/tags.js` (the tree, moving, keys, the page and sidebar) | Every tag as one tree moved like bullets, each with its properties and the number of nodes tagged; Tags \| Properties on top; find; Select with tick boxes and a bar of actions; rename, accepts, choices, descriptions (key i), merge, a choice into a child tag, Turn into links to pages, + New property through Logseq's own box; Undo on the row that changed. Shown as a page (`#/refinement-tags`) or in the right sidebar | `tagTreeEnabled` (on), `tagTreeRoots`, `propertyGroups` (empty), `tagTreeOpensAs` (page), `tagTreeToolbarButton` (on), `tagTreeShortcut` (mod+alt+g), `tagTreeGoShortcut` (g m) | palette: **Tag tree** (Cmd+Option+G, toolbar button), **Go to tag tree** (g m, in Logseq's Keymap), **Tag tree as a page**, **Tag tree in the right sidebar**; keys on a row: Enter, arrows, Tab, Shift-Tab, Cmd-Shift-Up/Down, n, m, a, r, x, i, p, j, /, Space | tags-test, tag-drag-test, tags-speed, tags-stress, odd-text-test, frames, pictures |
| **Proposals**, `parts/alike.js` (the "looks like" engine, `docs/ALIKE.md`), `parts/shadow-rules.js` (what is sure, the guesses, the reasons), `parts/shadow.js` (the bullet being written), `parts/shadow-steps.js` (Option-Enter), `parts/shadow-page.js` (a page's own properties) | While a bullet is written, what can be filled shows in its own empty properties in italic grey with a dotted line; Enter fills all, a click away only the sure ones, a click on one accepts it, Escape clears until you type again; a dotted Tags pill for an untagged bullet; `[[Dr. New]]#Doctor` tags the page; empty properties hidden until something is proposed; on a page, proposals in its empty properties; a faded Undo arrow. Every graph but those named | `shadowProposals` (on), `shadowHideEmpty` (on), `shadowSkipGraphs` (empty: every graph), `shadowStepKeys` (alt+enter), `shadowAcceptKeys` (mod+alt+enter) | Option-Enter: step into the first empty or guessed property, Enter sets and moves on, Tab, Shift-Tab, Left, Right, Down step, Escape back; Cmd-Option-Enter: accept all, no new bullet | alike-test, shadow-test, shadow-write-test, shadow-stress, shadow-check (the real graph), frames, pictures |
| **Suggested links**, `parts/link-suggest.js` | While typing pauses, when the last words (5 letters, 3 for a name the graph usually links or one that would fill an empty property) start or sit inside a page's name, the rest shows in grey after the cursor; Right arrow or a tap of the Hyper key makes the link, shown underlined with its brackets hidden while the bullet is written; it learns what is taken or passed over | `linkSuggest` (on), `linkSuggestRightArrow` (on), `linkSuggestHyperTap` (on), `linkSuggestMinLetters` (5), `linkSuggestPause` (350), `linkSuggestLearn` (on), `linkSuggestUnderline` (on), `linkSuggestKeys` (empty); `linkSuggestMemory`, kept by the plugin, not shown | Right arrow, Hyper tap, the keys of `linkSuggestKeys` | link-suggest-test, link-suggest-score (the real graph) |
| **Link selected text**, `parts/link-text.js` | Select words in a bullet, Cmd+Option+L, type a page's name, Enter links, typed as if by hand so Cmd+Z undoes it; with nothing selected the words first, then the page | `linkText` (on), `linkTextShortcut` (mod+alt+l) | Cmd+Option+L (keys only, no palette entry) | link-text-test |
| **Pickers**, `parts/picker.js` | In Logseq's own list for a property, the nodes that fit the bullet first, a faint line, then Logseq's list; Up and Down follow the order shown | `pickerFitsFirst` (on) | none | picker-test |
| **Writing helpers**, `parts/block-commands.js` (kept from the old editor part, 0.4.357) | New bullet at the outermost level; a year-first date typed in `[[ ]]` becomes the journal's name so Logseq's list offers the day | `outermostBlockShortcut` (empty), `dateLinkFormats` (on) | palette: **New bullet at the outermost level** (no keys by default) | boot-test |
| **Settings window**, `parts/settings-panel.js` | The browser's dialog on the kit: sections under the four groups with a numbered picture each, a find box, tick boxes and fields, Reset, a Shortcuts section read from the command register, Reload plugin, Logseq's own settings one click away. Runs under Foundation only. `docs/LAYERS.md` counts it among the features moved onto the kit | none of its own | palette: **Refinements settings**; an item under Plugins in Logseq's three-dots menu | boot-test (opens it, counts its pictures) |
| **PDF quotations**, `parts/pdf-quote.js` (0.4.364, rebuilt from the old links part) | A PDF highlight reads as a quotation with its page after it; a press on the citation or the words opens the PDF there. Drawn by stylesheet and marks, nothing written | `pdfCitations` (on) | none | pdf-quote-test |

**Resting in this layer:** `parts/inline-props.js` (Properties in the line, typing `p::` in a bullet): the owner said
no to `p::` typing on 2026-10-23 (`docs/DECISIONS-AUTONOMOUS.md` 19). Its settings (`inlineProps`,
`inlinePropsGraphs` …) are not in the settings window.

### Layer 4: where things sit

| File | What the owner sees | Settings (default) | Tests |
|---|---|---|---|
| `parts/tag-path.js` | The right end of a page's title row reads its tags and the tags above them, nearest first ("Doctor / Person / Entity" on Dr. Mei Chen; on a tag's page only the tags above it), each a link | `tagPathInTitle` (on) | boot-test, parts-apart |
| `parts/title-row.js` | Logseq's "Add icon" and "Set property" by a title never shown, their room kept | `hideTitleWords` (on) | boot-test, parts-apart |
| `parts/sidebar.js` | A click on a title in the right sidebar opens it in the main view; a line between the sidebar's items | `sidebarTitleOpens` (on), `sidebarThickDividers` (on) | boot-test, frames |
| `parts/chrome.js` | The right sidebar without Page graph and the (Dev) tabs; Flashcards and Graph view quieter; no generic page icon in Favorites and Recent; an empty `[[ ]]` menu until a letter is typed | `tidySidebar` (on), `quietItems` (Flashcards, Graph view), `quietSidebarIcons` (on), `quietLinkMenu` (on) | boot-test, parts-apart |
| `parts/search-look.js` | Logseq's search window tidier and roomier; its results, order and keys stay Logseq's | `tidySearch` (on), `roomySearch` (on) | boot-test, parts-apart |

**Resting in this layer:** `parts/pages.js` (what was drawn around a page's title: the page-kind line, Alias of, the
tag summary box), resting since the rebuild: the owner said no to the tag summary box on 2026-10-23, the page-kind line
was dropped on 2026-10-21, its title tags are `tag-path.js` now (`docs/DECISIONS-AUTONOMOUS.md` 19). `parts/search.js`
(search details, grouping page by page, the preview panel, typed filters, Search in the right sidebar with
Cmd+Option+F): the window's look came back as `search-look.js`, the four extras rest (`docs/DECISIONS-AUTONOMOUS.md`
17). `parts/links.js` (the old cues on links, labels, the Linked references rework, picker marks, the old link box):
judged 2026-10-23, all of it goes but the child asset cues, which rest for want of a file to judge them on; its PDF
citations were rebuilt as `pdf-quote.js` (`docs/DECISIONS-AUTONOMOUS.md` 19). Also left resting from the old chrome
part: pressing "Show properties" in the sidebar, grey journal days in the left sidebar, the Hyper tap to start a `[[`
link (`docs/DECISIONS-AUTONOMOUS.md` 16).

### Layer 5: how things look

| File | What the owner sees | Settings (default) | Tests |
|---|---|---|---|
| `parts/page-look.js` | Links in the text colour with a faint underline; journal days as quiet grey words; property names and values lighter than the words; tags as names in mono without #; a bullet's properties without capsules; "+ Add property" only under the pointer; empty properties faint; no pencil after a date; the nesting line firmer where you are. Stylesheets only | `quietLinks`, `quietDates`, `quietNames`, `tagsAsClasses`, `noCapsules`, `quietAddProperty`, `quietEmptyProps`, `hideDatePencil`, `indentGuides` (all on) | boot-test, parts-apart |
| `parts/property-kinds.js` | In a page's and a bullet's list of properties, the grey dot before a name is the icon of its kind (an arrow for a link to nodes, a calendar, Aa, 123, a box with a chevron for a choice); a name Logseq cuts short shows whole on hover | `propertyKindIcons` (on), `propertyNameTips` (on) | odd-text-test |

The old `parts/styles.js` was emptied into `page-look.js` and deleted at 0.4.359; why each of its other rules went is
in `docs/history/STYLES-AUDIT-2026-10-23.md`.

### Layer 6: separate tools

Nothing of this layer is loaded.

**Resting:** `parts/rich-copy.js` (Copy as rich text, Export page as document: a page or bullets as a tidy document or
PDF in five styles), switched on at 0.4.244 to 0.4.249 and off again at 0.4.251; it rests because its output can be
proved only through the clipboard (`docs/DECISIONS-AUTONOMOUS.md` 20). `parts/todos.js` (Todos and Expectations: every
task in one list, changed in place), paused since 0.4.128; it rests because Logseq 2.0.2's own Task page already lists
every task with sort, filter and views (`docs/DECISIONS-AUTONOMOUS.md` 20).

### What is known to be unfinished or wrong

Facts only, each with where it is recorded.

- **Three checks fail at 0.4.381** (seen in `sh tools/check.sh` on 2026-10-24, before this document was written):
  `tools/tags-test.js` (renaming #Report leaves the order "Report", and a renamed tag shows no Undo arrow), failing since
  0.4.376 (logbook 0.4.378 and 0.4.381: "the tag map checks fail as at 0.4.376, not touched"); `tools/frames.js` on the
  four tag map scenes (what is drawn differs from the approved census in `test/frames/`), "the tag map scenes fail as
  before" (logbook 0.4.381); `tools/shadow-check.js` on the real graph, one wrong proposal (on "Spoke with [[Dr. Chen]]
  about [[Blood in stool]]", Provider would be filled with Dr. Chen while the node holds Dr. Mei Chen), first seen in
  this check on 2026-10-24.
- The two-way rows' settings still say "field" and "record" in their titles ("Fields read backwards", "Fields shown
  from one end only"), against the owner's words; the header of `parts/two-way.js` still says "Nothing is written to
  the graph"; `parts/link-suggest.js`'s says "nothing is written until Tab"; the comment above `PART_FILES` in
  `main.js` describes the plugin of 0.4.294 (2026-10-24, this document).
- The ring on a capsule Logseq's own keys put the keyboard on shows in every graph; keep or limit is the owner's
  question, open since the audit of 2026-10-22 (CLAUDE.md).
- Logseq's narrow name column cuts a long property name short ("Therapy regimen"); since 0.4.353 the whole name shows on
  hover, the column itself waits for the owner (CLAUDE.md).
- Two-way row ideas 4 and 5 (follow a chain; a row for what sits two steps away) were explained, not built
  (logbook 0.4.376; `docs/history/TWO-WAY-IDEAS-2026-10-24.html`).
- Reload plugin with Foundation only on did not stick in four tries (2026-10-22); the self-check warns "block text not
  found" on the Pages list (harmless); a drag in the tag map once moved the tag below the one pressed, not reproduced
  in 20 tries (2026-10-22) (CLAUDE.md, loose ends).

## 3. The tools and tests

All in `tools/`, none in the release zip. The pretend-window tests need node and `jsdom`; the Chromium tests need
Playwright's Chromium (both in `node_modules/`, git-ignored). The checks against the real graph read the Illness Test
Graph through Logseq's command line. The app tests drive the real Logseq over its debugging port (Logseq started with
`open -a Logseq --args --remote-debugging-port=9222`).

**`sh tools/check.sh`**, before every commit (the commit hook runs only its last step):

| Test | What it guards |
|---|---|
| syntax (`check.js` through JavaScriptCore), `TEMP-DEV`, version, part lists | a broken file, a forgotten probe, package.json and the README disagreeing, a file in `parts/` in neither list |
| `boot-test.js` | the plugin starts, runs and unloads in a pretend Logseq with no warning, no timer, listener or mark left; a second copy takes over from a first; Foundation only draws nothing |
| `tags-test.js` | faults found once in the tag map (a box acting for the wrong property after a redraw, choices Logseq refuses to move, renames and their Undo) |
| `tag-drag-test.js` | moving tags like bullets: the top level, before, after, inside, order kept, Undo, Tab, Shift-Tab |
| `alike-test.js` | the looks-like engine's finds and votes, and its speed on 20,000 nodes |
| `shadow-test.js` | the proposals' rules on a pretend graph: every mistake found so far |
| `shadow-write-test.js` | what the proposals write and what Undo takes back |
| `undo-test.js` | the one Undo: several arrows, put back when Logseq redraws, waiting in the corner |
| `picker-test.js`, `link-text-test.js`, `link-suggest-test.js`, `pdf-quote-test.js`, `two-way-rows-test.js` | each feature in a pretend window: what it offers, what it types or writes, its keys |
| `parts-apart-test.js` | the plugin boots with each part left out in turn |
| `leaning-test.js` | the leaning rule (section 2), every count at a baseline that only goes down |
| `shadow-stress.js` | the proposals on tricky words, random text, odd names and a large pretend graph |
| `model-test.js` | the model's readings of pages, tags, properties, days and links, and its timings |
| `tags-speed.js` | the tag map's redraw on 600 tags (first drawing 1 s, a change 0.4 s, no jump), gated on a quiet Mac (`quiet.js`) |
| `frames.js` | pretend pages recorded moving, plugin off and on: no jump, no flash, the drawing's census as approved (`test/frames/`) |
| `pictures.js` | pictures of what the plugin draws, light and dark, against the approved ones (`test/pictures/`) |
| `two-way-check.js` | the two-way rows found on the real Illness Test Graph against an answer key from the raw graph |
| `shadow-check.js` | the proposals on the real graph with every filled property hidden in turn: right, wrong (must stay 0), silent |
| `link-suggest-score.js` | every link in the real graph typed again letter by letter: how many the suggestions catch, how early, how many wrong |
| `docs-check.sh` | CHANGELOG, CLAUDE.md's State line and the logbook name this version; with `--staged` (the hook), a code change brings its version, CHANGELOG, logbook and CLAUDE.md, a setting change the README |

**`sh tools/stress.sh`** (`--no-app` for the first four only): `model-test.js --big` (100,000 pages), `shadow-stress.js`,
`odd-text-test.js` (odd names through the kit, the rows, the map and the model), `tags-stress.js` (200 drags, Undo in
rounds, renames, 1,000 holders, memory), and over the debugging port `app-stress.js` (pages fast, a typing storm,
theme, sidebar and window sizes, twenty reloads and Foundation only, every pop-up in dark) and `app-frames.js` (every
tour stop recorded off and on, light and dark).

**Run by hand:** `graph-check.js save` / `compare` (the Illness Test Graph's fingerprint before and after a test round,
kept in `check.log/`); `bump.sh 0.4.N` (the version in package.json and the README); `release.sh` (a local zip; the
release itself is a pushed `v0.4.N` tag, built by `.github/workflows/publish.yml`); `make-zero-brackets-font.js`
(the font that hides a taken link's brackets); `tools/pages/prepare.js`, `build-elements.js`, `build-views.js` (rebuild
`docs/ELEMENTS.html` and `docs/VIEWS.html`).

**Helpers, not tests:** `app-door.js` (the door to the real app), `frame-kit.js` (recording frames), `pretend-page.js`,
`pretend-model.js`, `marks.js`, `odd-names.js`, `quiet.js`, `logseq-bundle.js` (reads Logseq's own bundle for its icon
font), `check.js`.

`check.log/` (git-ignored) holds only what tools write: `frames/`, `pictures/`, `stress/` and
`graph-fingerprint.json`.

## 4. The test graphs and seeds

| Graph | What it is | Rebuilt by |
|---|---|---|
| **Illness Test Graph** | The only graph tests touch in the app: a made-up patient, Daniel Okoro, colon cancer from July 2026, about 110 journal days, 15 tags with 1 to 3 properties each, about 690 pages and blocks, shaped by `docs/MODELLING.md`. Every test edit is undone | `test/illness-test-graph.py` writes `test/illness-test-graph.edn` (whole) and `-1`, `-2`, `-3` (the parts imported in order); the recipe is in CLAUDE.md |
| **Seed Check** | The same seed, made with the command line, not listed in the app; for scoring (`GRAPH="Seed Check" OWNER=any node tools/shadow-check.js`) | import the three seed parts |
| **Stress Check** | The seed plus six years of journals (31,000 bullets), made with the command line, not listed in the app | the seed's parts, then `test/stress-graph-N.edn` from `test/stress-graph.py`, in order |

The owner deletes graphs in Logseq; Claude may remove and remake the two scratch graphs. `test/plugin-test-graph.edn` is
the seed of the old Plugin Test Graph, which is no longer on the Mac; nothing reads it. `test/frames/` and
`test/pictures/` are the approved frame censuses and pictures.

## 5. Where to read more

| Document | Living or record | What it is |
|---|---|---|
| `CLAUDE.md` | living | The handoff: where things are, the owner's working rules, how the owner likes to hear back, what is open |
| `docs/STATE.md` | living | This file |
| `docs/LAYERS.md` | living | The six layers, the owner's grammar of how things look and behave, the kit, the order of building |
| `GUIDE.md` | living | How the code is built and the rules that keep it so, Logseq 2.0.2's quirks, the development loop, the command line |
| `docs/PROCESS.md` | living | How a change is checked, the tour, the logbook's shape, lessons |
| `docs/MODELLING.md` | living | The owner's principles for tags and properties |
| `docs/ALIKE.md` | living (its scoreboard dated) | The looks-like engine: the design, the stages, the numbers |
| `README.md` | living | What the plugin does and every setting, for a user |
| `docs/ELEMENTS.html`, `docs/VIEWS.html` | living, rebuilt by `tools/pages/` | Every element the kit draws, and whole views drawn with it (rebuilt at 0.4.319) |
| `docs/DECISIONS-AUTONOMOUS.md` | record (from 2026-10-23) | Choices made without the owner, each with how to flip it |
| `docs/LOGBOOK.md`, `CHANGELOG.md` | records, added to with every piece of work | What was asked, built, seen and checked; one line per version |
| `docs/history/` | records | Handoffs, plans, prompts, audits and reports of their day; `docs/history/README.md` lists them, and `docs/history/DECISIONS-AND-RULINGS-2026-10-24.md` gathers the owner's rulings and what was tried and rejected |
