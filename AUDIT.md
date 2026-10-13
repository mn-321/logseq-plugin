# Audit: API alignment and render stability

Started 2026-10-11 on version 0.2.98. This file tracks what the audit found and what has been fixed.
Update the Status column as steps land. The feature list is the README's version history.

## How it was checked

- Plugin code: read in full (`main.js`, `loader.js`).
- Plugin SDK: the copy shipped inside Logseq 2.0.2 (`lsplugin.core.js`, `lsplugin.user.js`).
  There is no `@logseq/libs` in this folder and the online docs were not consulted.
- Logseq internals: source at tag `2.0.2` (github.com/logseq/logseq).
- Nothing has been measured in a running Logseq yet. Cost figures are estimates until the
  baseline (step 4 below) is recorded.

## Facts about Logseq 2.0.2 the fixes rely on

| Fact | Source |
| --- | --- |
| `provideStyle` ignores an empty or blank stylesheet | `lsplugin.core.js`: `t && t.trim() && …` |
| Only the last `beforeunload` callback is kept; the host waits up to 10 s for it | `lsplugin.user.js` |
| Hooks (`onChanged`, `onRouteChanged`, …) and `onSettingsChanged` return "off" functions | `lsplugin.user.js` |
| On Reload the plugin frame is removed and commands, menu items and hooks are cleared | `lsplugin.core.js`; `frontend/handler/plugin.cljs:1213`, `:1260` |
| `updateSettings` deep-merges, so a saved key can be overwritten but not deleted | `libs/src/LSPlugin.core.ts:273` |
| Logseq draws with React 19, not inside animation frames | `package.json:186` |
| `datascriptQuery` runs in the background worker; each call makes 2–3 extra worker calls | `src/main/logseq/api/db.cljs:21` |
| `DB.onChanged` always passes an empty `txData`; it fires only when blocks changed (max 1,000) | `frontend/modules/outliner/pipeline.cljs:32` |
| A link to a block has `.block-title-wrap` unless the link carries its own label | `frontend/components/block.cljs:919` |
| Page title actions are hidden with `opacity: 0`, so they keep their size | `frontend/components/block.css:1058` |
| Nothing sets the class `embed-page` | no match in any `.cljs` |
| Lists of 64+ blocks that opt in draw only what is near the screen | `frontend/components/block.cljs:5020` |
| `onInputSelectionEnd` fires on the text box's `select` event (mouse and keyboard) | `frontend/ui.cljs:211` |
| No built-in shortcut uses `Mod+T` | `modules/shortcut/config.cljs` |

Still unverified: how often Logseq saves while typing; which class a page embed carries.

## Findings

Severity: H high, M medium, L low. Line numbers are for 0.2.98.

| # | Issue | Where | Severity | Status |
| --- | --- | --- | --- | --- |
| A1 | Empty stylesheet is ignored, so "Faint nesting lines" and the per-block cues do not switch off until reload | `applyHierarchy` 1697; `refreshCues` 1328, 1335 | M | fixed 0.2.99 |
| A2 | Previous page's list choice is applied to the next page until its data loads | `listRows` 2375; state set in `refreshCues` 1282 | M | fixed 0.2.100 |
| A3 | `loadPageKind` has no version guard; an older answer can overwrite a newer one ("Alias of" goes missing) | 1875 | L–M | fixed 0.2.100 |
| A4 | If clean-up fails on Reload, the old copy's observers keep running; nothing stops them | `runUnloadTasks` 7 | M | fixed 0.2.101 |
| A5 | `data-refinement-property-crumb` is not removed on unload | `stopDateLinks` 935 | L | fixed 0.2.101 |
| B1 | Four always-on whole-page observers; one redraw causes 2–4 full passes | 26, 927, 1103, 2155 | M–H | fixed 0.2.106 |
| B2 | `updateDateLinks` runs eight page scans on every change, including any `class` change; the cue scan searches each block before checking it has a cue | 865, 929, 1153, 880 | M | reduced 0.2.104, 0.2.106 (one pass per change; scans are still whole-page) |
| B3 | Stylesheet with four rules per referenced block in the whole graph (about 1.7 KB each) | `refreshCues` 1293 | H in a big graph | fixed 0.2.105 |
| B4 | Seven timers per database change, about 20 queries, settling at 800, 1000 and 1500 ms | 2979 | L–M | fixed 0.2.108 |
| B5 | Auto-date could rewrite the same record every 1.5 s if a write lands but the "no date" test still matches | `autoDateNew` 2881 | L | fixed 0.2.108 |
| B6 | Title tags are re-measured only when page content changes, so they can sit off after a sidebar toggle | `updateTitleTags` 1987 | M (measured: about 800 px off with the right sidebar open) | fixed 0.2.107 |
| B7 | Slow selectors: hover rule for nesting lines (1682), reference-row `*` rule (274), `div:has(> …crumb)` (305) | CSS | M | part fixed 0.2.109 (see step 10) |
| B8 | Fold log observer never stops after the first fold command | 2493 | L | fixed 0.2.110 |
| B9 | Per-frame work that could be skipped: sidebar text scan (1553), title computed styles (1835), list choices re-parsed (2443) | — | L | list choices fixed 0.2.111; the other two left (each measured at 0.1–0.3 ms) |
| C1 | Line beside embedded pages never draws (`.embed-page` matches nothing) | 289 | M | probably not a defect: in a DB graph an embed is a linked block, which Logseq draws as `.embed-block`, and the rule covers that. `.embed-page` is a leftover from file graphs. Not seen on screen: the test graph has no embed |
| C2 | Fold log always reports "0 facts" (`txData` is empty) | 2976 | L | fixed 0.2.110 |
| C3 | `onSettingsChanged` re-sends the main stylesheet on every settings write | 2990 | L | fixed 0.2.111 |
| C4 | Dead code: `data-refinement-page-kind` is set but no rule uses it | 1917 | L | removed 0.2.111 |
| C5 | Fold all says "Folded" even when no arrow was found | `foldQueryResults` 2621 | L | fixed 0.2.110 |
| C6 | Settings file holds leftover `devDump` and `recordCues` keys | settings JSON | L | removed from the file 2026-10-11 |

Checked and found fine: nothing runs before `logseq.ready`; every hook's off function is kept;
`loader.js` cannot create duplicate instances on a normal Reload; `onInputSelectionEnd` making two
calls is not a problem; no endless loop between observers.

Withdrawn after reading Logseq's source: "the shared watcher is always a frame late" (React draws
in ordinary tasks, so this should be rare); "queries can freeze the screen" (they run in the
worker); "title tags can jump to the corner" (hidden actions keep their size).

## Fix plan

One fix per commit, version bumped and a README note each time. Backup of 0.2.98 is in
`backups/logseq-db-refinements-0.2.98/`.

| Step | Change | Fixes | Version | Status |
| --- | --- | --- | --- | --- |
| 1 | Send a comment instead of an empty stylesheet | A1 | 0.2.99 | done |
| 2 | Version guard in `loadPageKind`; clear page state on route change | A2, A3 | 0.2.100 | done |
| 3 | New copy stops a leftover one and sweeps strays; crumb marks cleared on unload | A4, A5 | 0.2.101 | done |
| 4 | Measuring tool (off by default), then record the baseline | — | 0.2.102, 0.2.103 | done on the test graph; a real graph still to measure |
| 5 | Early exits in `updateDateLinks` | B2 (part) | 0.2.104 | done |
| 6 | Attribute marks replace the per-block stylesheet | B3 | 0.2.105 | done; drawn styles identical on 8 test pages |
| 7 | Merge the observers into one, keeping a before-paint phase (the baseline shows late passes) | B1, B2 | 0.2.106 | done; drawn output identical on 8 test pages |
| 8 | Title tags follow size changes | B6 | 0.2.107 | done; gap stays 10 px with either sidebar opened or closed |
| 9 | One scheduler for database changes; auto-date remembers what it filled | B4, B5 | 0.2.108 | done; two quick edits gave one round. Auto-date itself not exercised (the test graph has no Occurrence or Results tag) |
| 10 | Tighten selectors; decide the hover rule from measurements | B7 | 0.2.109 | part done: the `div:has(…)` rule is now a plain attribute rule. The hover rule and the reference-row `*` rule are left as they are: nothing measured so far shows them costing anything, and changing them risks the look |
| 11 | Small fixes | B8, B9, C1–C6 | 0.2.110–0.2.113 | done, except C1 (see its row) |

## Cannot be fixed from a plugin

- Logseq's own look before the plugin loads, at startup and during Reload.
- The delay on anything that needs a database lookup on the first visit to a page.
- Anything Logseq stops giving plugins (for example `txData`, or access to its window).

## Stays fragile

Most on-screen features depend on Logseq's internal class names, English labels, or pressing its
own controls. Highest risk first: fold all, the `#Page` click and `Mod+T`, search in the sidebar,
sidebar tidy, title tags, the property picker, PDF citations, then all link/date/cue styling.
Mitigation (0.2.112): **Refinements: Check what the plugin finds on this page** counts each of
Logseq's parts the plugin relies on, and troubleshooting reports say when Logseq's version differs
from the one the plugin was last checked against (2.0.2).

## Baseline (to record at step 4)

Run **Refinements: Turn measuring on or off (troubleshooting)**, then after each of these run
**Refinements: Copy performance report (troubleshooting)**. Each report is also saved as
`perfReport` in `~/.logseq/settings/logseq-db-refinements.json` and covers the time since the last one:

1. Open the largest page and wait 5 seconds.
2. Scroll top to bottom for 10 seconds.
3. Type about 20 words in one block.
4. Move the pointer across blocks for 10 seconds.
5. Switch plain page → tag page with a saved list choice → journal, twice.

To measure without the command: set `debugPerf: true` and `debugPerfEvery: 10` in the settings file
and reload the plugin; reports collect in `perfLog`. Set `debugPerf` back to `false` and reload to stop.

### Results on the test graph, 2026-10-11 (0.2.102, Logseq 2.0.2)

Run in Logseq by computer use: plugin reloaded, then journals opened and scrolled, then back and
forward between the journals, a book page and the Book tag page. No typing, no pointer hover, and
not the Work graph. Three plugin reloads in a row left one inherited line, one set of cues and no
doubled elements.

| What | Idle page (10 s) | Navigation and scrolling (10 s) |
| --- | --- | --- |
| Dates-and-cues watcher calls | 3 | 48 |
| Other three watchers, calls each | 1 | 44 |
| `class` changes among what the dates-and-cues watcher saw | 2 of 8 | 14 of 217 |
| `updateDateLinks`, average per call | 0.3 ms | 0.3 ms (12 ms in all) |
| `updateTitleChrome`, total | 0.7 ms | 9.8 ms over 34 passes |
| `refreshCues`, start to finish | 82 ms | 48 ms, twice |
| Per-block stylesheet | 4,021 characters | rebuilt twice, not re-sent |
| Shared watcher passes: in time / a frame late | 1 / 0 | 25 / 9 |
| Long tasks, long frames | 0, 1 (69 ms, at reload) | 0, 0 |
| Layout shifts | 1 (score 0.0005) | 12 (score 0.196), mostly Logseq's own page parts |

What this settles:

- **A frame late does happen:** 9 of 34 shared-watcher passes while navigating and scrolling. So
  the before-paint watchers are worth keeping, and step 7 should move flash-prone work (title
  tags, hidden list properties, hidden sidebar buttons) into a before-paint phase rather than
  move everything into the per-frame pass.
- **`class` changes are a small share** of what the dates-and-cues watcher sees here (about 6%),
  so dropping `class` from its filter would save little on this graph.
- **Every watcher is called for every change:** 44 to 48 calls each in ten seconds, which is the
  duplication step 7 removes.
- **The test graph is too small to show cost.** Each call takes well under a millisecond. Scan
  cost on long pages and the stylesheet size in a large graph still need a run on a real graph.

## After the fixes (0.2.113, 2026-10-11)

All checks were run in Logseq 2.0.2 on the test graph, driven by a temporary script inside the
plugin (removed again; see `HANDOFF.md` for how it works).

**Nothing drawn has changed.** Eight pages (Plugin Visual Cues, Atlas, Block Types, Ada Okafor,
Book, Formatting Samples, Why Block References Matter, Designing Data-Intensive Notes) were recorded
on 0.2.104 and again after steps 6, 7, 9 and at the end: every link's underline, dot and
background, every label, every cue, the hidden elements and the title's parts are identical.

| Check | Before | After |
| --- | --- | --- |
| Per-block stylesheet | 4,021 to 8,215 characters, by page, growing with the graph | 2,709, fixed |
| Always-on watchers | 4, each called for every change | 1 |
| Gap between title actions and tags with the right sidebar open | about 800 px off, and still wrong after closing it | 10 px in every sidebar state |
| Look-up rounds after two quick edits | finishing at 0.8, 1.0 and 1.5 s | 1 round |
| Fold all on a query whose results have nothing under them | “Folded every result” | says none of the 13 results has anything to fold |
| Fold log watcher after leaving the page | still running | stopped |

**A long page.** A page of 1,740 blocks was made for the test and recycled afterwards. Logseq drew
143 of them on opening and 705 (22,000 elements) after scrolling. With 705 drawn:

| What | Result |
| --- | --- |
| The whole before-paint pass (dates, cues, labels, marks) | 1.7 ms on average, 3.0 ms at most |
| All of the plugin's work for one change | about 4 ms |
| Long frames while scrolling | 20 (1,150 ms in all), none of it in the plugin's code |
| Passes that landed a frame late | 0 of 21 |

So the remaining whole-page scans (B2) are not worth narrowing: they cost a few milliseconds on
a page far longer than Logseq draws at once, and the slow frames while scrolling are Logseq's own.

**Not checked on screen**, because the test graph has no example: “Doctor: …” labels on property
values under Linked references, “via …” labels, the hidden property path, auto-date, PDF
citations, an actual fold or unfold, and a list that hides properties. Their code paths are the
same functions as before, called from the new places.

**Still open:** the hover rule for nesting lines and the `*` rule for reference-only rows (B7),
the sidebar and title scans that run every frame (B9), and the measuring tool, which is still in
`main.js` (PERF-DEBUG block, off by default) in case a real graph should be measured.

## After the safety round (0.2.117, 2026-10-12)

From a later code review, since checked in part in Logseq (see `HANDOFF.md`, "State after the safety round"): selected-text commands no longer rewrite existing links
by name; auto-date only fills a Date-type property and can be limited to named graphs; whole-graph look-ups
after edits run at most every 30 s; fold all stops after six presses per result; the tag picker clears its
typed text when it gives up. Auto-date and a real graph's typing cost remain unmeasured.

## Readiness review (2026-10-12, 0.2.118 → 0.2.131, Logseq 2.0.2)

A review of whether the plugin is ready for daily use on the owner's real graph: a feature map, a code review with fixes, new examples in the test graph, on-screen checks of every feature, speed measurements on the test graph and on a synthetic large graph, and the remaining risks. The checks were driven from inside Logseq by a temporary block in `main.js` (removed before every commit) that opens pages, switches settings off and on through `logseq.updateSettings`, counts what the plugin marks, reads computed styles, and writes the results into the plugin's settings file; the owner's own eyes were replaced by screenshots of the running app. Branch: `readiness-0.2.119`.

### Feature map

Status: **screen** = seen on screen this session, or measured in the running app by the probe (counts, computed styles, switched off and on live); **read** = read in the code only; **inert** = the code runs but Logseq 2.0.2 never draws what it targets; **no** = not working.

| Feature (README row) | Setting · live? | Code | Logseq parts relied on | Writes | Clean-up | Status |
|---|---|---|---|---|---|---|
| Page links: normal colour, faint underline | quietLinks · live | cssParts quietLinks | .page-reference, a.page-ref, .tag | no | styles go with the plugin | screen (colour off/on measured) |
| Tags on a block: bold | quietLinks | cssParts | .ls-block .block-content a.tag | no | styles | inert: 2.0.2 draws a tag typed in text as plain `<span>#Idea</span>` |
| Links to a tag's own page: icon in tag colour, `#` | quietLinks (icon colour) | updateTagPageLinks ← loadTagPages (graph query); CSS on `> span:first-child::before` | a.page-ref[data-uuid], .icon-emoji-wrap, --lx-accent-11 on body | no | stopDateLinks | screen (`#` before Project; a press on the `#` lands on the span) |
| Links to blocks: dot, no underline; task icons | referenceIcons · live | blockDot on .block-title-wrap; data-refinement-block-link ← referencedNodeIds; data-refinement-ref-row ← updateReferenceRows | a.page-ref .block-title-wrap, .positioned-properties.block-left | no | stopDateLinks | screen (dot, rows, labelled link; off/on measured) |
| PDF selections: `p. 1 · title` first, quote bullet | pdfCitations · live | updatePdfCitations (early), pdfAnnotationSources | .prefix-link > .hl-page > strong "P n", data-hl-type, .bullet-container.cursor, :logseq.property.pdf/hl-page, :logseq.property/asset | no (synthetic press on Logseq's link) | restorePdfCitations | screen (annotation row and citing block on Readiness Tests, in the 0.2.130 form); clicking the citation not tried; off/on not measured |
| Links to PDFs and images: icon, file type after | referenceIcons | cssParts referenceIcons (href match) | a[href*=".pdf"] in .block-content | no | styles | screen: web links (earlier sessions) and, since 0.2.129, links to local files on Readiness Tests; the asset block's own row is left to Logseq |
| Dates: grey box | dateStyle · live | dateStyles CSS; data-refinement-date ← updateDateLinks + loadJournalDates (graph query); date headings | .ls-datetime, .timestamp, a.page-ref[data-ref], .ls-foldable-header | no | stopDateLinks | screen (text dates on Readiness Tests off/on measured; journal references) |
| What sits below a block: `↳ ◌ n`, file icons | childTypeCues · live | refreshCues → summarize; typeQuery, directAssetTypes; .refinement-child-assets | page block tree, .ls-block[blockid] .block-title-wrap | no | stopDateLinks | screen (3 cues on Plugin Visual Cues; off/on measured) |
| Nesting lines | indentGuides · live | hierarchyParts | .ls-block .block-children, --ls-guideline-color | no | styles | screen (border colour off/on measured) |
| Tag background | tintTags · live, off | hierarchyParts | a.tag | no | styles | read (no inline a.tag in 2.0.2 text; side tags would take it) |
| Page title row: tags beside actions, `#Page`, triangle | showPageKind · live; showTitleChrome · reload | updateTitleTags (transform on Logseq's .block-tags), .refinement-title-tags → openTagPicker; updateTitleChrome marks; ResizeObserver | .is-page-title-row, .ls-page-title-actions > div, .ls-block-right .block-tags, a.block-control, "Set property", .ls-property-dialog, input.cp__select-input, [title=":block/tags"] | no (Logseq writes the tag the user picks) | onUnload | screen (chip and transform off/on measured; actions always shown; Set Tags list opened by the command) |
| Linked references: wash on the link here; gap, headings, `· n`, bullet path, quiet children, fold arrows | markReferenceHere · live; referenceLayout · live | updateReferenceHere marks (0.2.123), cssParts referenceLayout, updateReferenceCounts | .references, .group-list-view, .ls-foldable-*, .breadcrumb.block-parents, .block-control, .journal-item | no | stopDateLinks | screen (Priya Nair, Ada Okafor, Journals list, dark theme; off/on measured; accent box since 0.2.131) |
| Alias pages: "Alias of …" | showAliasOf · live | loadPageKind (:block/alias), .refinement-alias-of | page title, flex chain | no | onUnload | read: navigating to an alias opens the original page in 2.0.2, so the line was never shown |
| Tag pages: "Inherited from #Media: …" | showInherited · live | loadInherited, inheritedTagProperties, .refinement-inherited | .ls-page-properties > :not(.properties-panel), :logseq.property.class/extends | no | onUnload | screen (Book, with the properties open; off/on measured) |
| Simpler page icons | plainPageIcons · live | cssParts | .ti-file*, svg.tabler-icon-file*, .bullet-container | no | styles | screen (mask off/on measured) |
| Plainer block properties | plainProperties · live | cssParts | .positioned-properties.block-below .bottom-property-pill | no | styles | screen (capsule shadow off/on measured) |
| Line beside embedded content | embedLine · live | cssParts | .ls-block.embed-block | no | styles | screen (Node embed on Readiness Tests; off/on measured) |
| Tidy parent paths | tidyPaths · live | cssParts + fadeCrumbBrackets (CSS highlight) | .breadcrumb__segment/__label | no | highlight deleted | screen (max-width off/on measured) |
| "Doctor:" and "via …" labels; hidden lone property path | linkLabels · live | updateCueMarks ← propertyValueBlocks (graph query), incomingPropertyLinks; updatePropertyCrumbs | .references…, .block-content-wrapper, .breadcrumb__label, :logseq.property/created-from-property, user.property/* | no | stopDateLinks | screen for "via owner" (Ada Okafor, Priya Nair, after bidirectional properties were enabled on Project; off/on measured); "Doctor:" and the hidden path: read (no text-property value in the test graph) |
| Links inside a reference open their own page | none | startNestedReferenceLinks | a.page-ref a[data-uuid] | no | listen() off | read |
| Page labels "Name #tag" shortened | none | updatePageLabels ← loadPageLabelTitles (graph query) | a.page-ref span, a.link-item .page-title | no (DOM text) | restorePageLabels | read (no such label seen; the CLI cannot make a second same-title page) |
| Quiet sidebar/toolbar items | quietItems (list) · reload | updateQuietUi | #left-sidebar, #head, item parts | no | onUnload | screen (was **no** on 2.0.2 until 0.2.124) |
| Tidy right sidebar | tidySidebar · reload | cssParts tidySidebar; updateSidebarPresentation | #right-sidebar, .sidebar-item*, "Show/Hide properties", "(Dev) …", "Page graph" | no (presses Logseq's toggle) | onUnload | screen for the flat panels and the Search button (right sidebar open during the command run); the property toggle and hidden buttons: read |
| Search button in right sidebar | none | ensureSidebarSearchButton | .cp__right-sidebar-settings | no | removed | screen |
| Tidy search window | tidySearch · reload | searchCss, cleanSearchResults | .cp__cmdk*, [data-cmdk-item] | no | highlight deleted | screen (search opened in the sidebar during the command run); faded markup: read |

| Command | Shortcut / menu | Writes | Status |
|---|---|---|---|
| Link selected text to a page | mod+shift+l | updateBlock | screen-equivalent: run through the editor's selection event; link inserted as `[words]([[uuid]])`, other links untouched; refuses without a selection |
| Open selected text as page | mod+alt+p | createPage, updateBlock | run (twice): page created and opened; after 0.2.127 the words became a link in a block that also holds a block link |
| Copy block and children to new page | (empty); bullet menu | createPage, appendBlockInPage, insertBatchBlock | run: page made with the two children copied |
| Search in right sidebar | mod+alt+f; Search button | no | run (twice): search opened in the sidebar; after 0.2.128 the console stays clean |
| Add tags to this page | mod+t; `#Page` chip | no | run: Logseq's Set Tags list opened with the tag names |
| Fold all / Unfold all results | palette; bullet menu | screen-only (query); | run: on a table-view query the message says nothing can fold; on the list-view query the two parents folded and unfolded (fold log), and Logseq saved their fold state ("database changed") |
| Choose properties shown in this list | palette; bullet menu | settings | run: box opened for the query (Body, One line) |
| Fill missing dates from journal days | palette | upsertBlockProperty after confirm | run: refusal when nothing is undated; confirmation box ("1 record … Fill dates"); Cancel leaves the record; Fill dates wrote Oct 11th, 2026 to it ("Filled 1 date") |
| Check what the plugin finds / Copy page title area details / Check linked-record labels / Copy fold log | palette | no | run: all four produced their report |
| Copy styling details | bullet menu | no | read (needs the bullet menu) |
| Turn measuring on or off / Copy performance report | palette | settings | screen (used for the measurements) |
| Show shortcuts and settings | palette | no | read |

Not reachable from background control (no right-click, no pointer hover): the bullet menu entries themselves and hover previews. The palette entries were not opened by keyboard; the functions behind them were run directly.

### Findings and how each was resolved

| # | Finding | Where | Sev | Resolution |
|---|---|---|---|---|
| R1 | A failing screen updater logged "a screen update failed" on every mutation batch for the whole session; a failing look-up logged up to 8 warnings per database round. | runEarly, watcher, runDbWork, every console.warn | H | 0.2.119: warnOnce (one line per distinct message per session); an updater that throws 5 times is removed from the watcher with one note. Verified: no console lines in any later run; the retire path read only. |
| R21 | Quiet sidebar items never matched in 2.0.2: a sidebar link's text is "FlashcardsGF2" (name + shortcut + count). The setting did nothing. | updateQuietUi | H (feature off) | 0.2.124: match the item's own parts too. Seen: Flashcards and Graph view smaller and lighter. |
| R3 | Auto-date matched its property title letter for letter; "Date" vs "date" meant no filling, silently. | autoDateSetup | M | 0.2.120: case-insensitive. Verified: two new #Occurrence/#Imaging records on Oct 12 got the journal day. |
| R2 | Link-here wash and quiet children were a stylesheet generated per page with a deep `:not(:has())`. | updateReferenceHere | M | 0.2.123: marks data-refinement-here / -below set before paint, two fixed rules. Verified on Priya Nair and the Journals list; settings still live. |
| R4 | Dot of a labelled block link drawn on the `<a>`, which Logseq ignores on press. | cueCss | M | 0.2.121: drawn on the label's span. Probe: a press at the dot lands on the span. Same look. |
| R5 | Page-label shortening ("Name #tag"): whole-graph query each full round, per-pass link scan, text-node edits, no setting; it is unclear 2.0.2 draws such labels. | updatePageLabels | M | Left in place (harmless when nothing matches; the query is cheap on the test graph). Not seen on screen; a second page with the same title could not be made through the CLI. Risk listed. |
| R6 | Stray clean-up lists missed data-refinement-ref-count and .refinement-inline-values; listed the dead page-kind. | STRAY_* | L | 0.2.122 (and 0.2.123 adds here/below). |
| R7 | RegExp built on every call of dateLinkName. | dateLinkName | L | 0.2.122: built once. |
| R8 | perf.style never called: STYLESHEETS section always empty. | sendStyle | L | 0.2.122: sendStyle reports to perf. |
| R9 | Dead fields pageKind.inherited/pageId; kind computed only for one test. | loadPageKind | L | 0.2.122. |
| R10 | quietUi.marked and sidebarPresentation.hidden never pruned. | | L | 0.2.122: pruned each pass. |
| R11 | .embed-page matches nothing in 2.0.2. | cssParts embedLine | L | 0.2.125: removed; a Node embed is .embed-block (seen with the faint line). |
| R12 | loadTagPages / loadPropertyNames assigned answers without a version guard. | | L | 0.2.122. |
| R13 | Every report box said "Styling details for this block". | showDiagnostics | L | 0.2.122. |
| R14 | README lacked most commands and five Appearance rows. | README | L | 0.2.125. |
| R15 | No setting: sidebar Search button, page-label shortening, click-through on links inside references; quiet items is a list, not a switch. | | L | Reported; documented as "always on" in the README rows. |
| R16 | Sidebar tidy scans every a/button/span/div of the right sidebar each pass. | updateSidebarPresentation | L–M | Measured (see Speed). |
| R17 | Page-tree queries carry every block id of the page in three query strings per round. | typeQuery etc. | L–M | Measured on the long synthetic page (see Speed). |
| R18 | Title tags placed by measuring inside the before-paint pass. | updateTitleTags | L | Left (measured small in the audit; needed to avoid the flash). |
| R19 | Fold all on a page's list presses Logseq arrows that may save fold state. | applyListFolds | L | Documented in the README command entry. |
| R20 | autoDateGraphs empty by default: fills in every graph. | settings | — | Recommendation to the owner. |
| R22 | README row "Tags on a block: bold, no underline": in 2.0.2 a tag typed in the text is drawn as plain text (`<span>#Idea</span>`), not as a link, so the rule has nothing to act on; side tags and property values are a.tag and are untouched by design. | cssParts quietLinks | L | Inert; README row marked. |
| R23 | Alias pages: navigating to an alias opens the original page in 2.0.2, so "Alias of …" could not be seen; its code path is unchanged. | loadPageKind | L | Read only; risk listed. |
| R24 | **Open selected text as page** and **Link selected text** refused ("the block had changed") in any block that also held a link to a block: the editor shows such a link as its id, the plugin expected its title, so the editor's text never matched the saved text. | toSavedRange / readableTitle | H (the commands fail on exactly the blocks the owner cares about) | 0.2.127: a block link is kept as its id when the two texts are compared. Rerun: the words became `[[page]]` and the page opened. |
| R25 | **Search in right sidebar** opened search through `invokeExternalCommand`, and Logseq logged "could not be cloned" to its console on every use. | searchInSidebar | L–M | 0.2.128: presses Logseq's search button; the command call stays as a fallback. Rerun: search in the sidebar, console clean. |
| R26 | README: "Links to PDFs and images… come from the link's address", but Logseq 2.0.2 draws a link to a file in the assets folder with `data-href` and no `href`, so those stayed plain blue. | cssParts referenceIcons | M | 0.2.129: both forms matched; the asset block's own row (which carries `data-url`) is left to Logseq. Seen on Readiness Tests. |
| — | Owner's requests during the review: a cited PDF excerpt as a quotation, “words” (source, p. n); the link-here box in the accent colour, rounder, with room around the words and no clipping at a property row's edge. | pdfCitations CSS and updatePdfCitations; tokensCss, markReferenceHere CSS | — | 0.2.130, 0.2.131; both seen on screen. |

### Speed

Measured with the plugin's own tool (0.2.125, Logseq 2.0.2), driven by the probe through the AUDIT's steps: open a page and wait 5 s, scroll for 10 s, type 20 words (through the editor API, one word every 180 ms), move plain page → tag page → journal twice. Pointer hovering could not be driven from the background and was left out. Each "pass" is one run of the plugin's screen updaters after one batch of changes Logseq made.

**Test graph** (about 60 pages, a few hundred blocks; pages Plugin Visual Cues, Atlas, Readiness Tests):

| Step | Watcher calls | Longest single updater | Plugin's work per pass | Passes a frame late | Long tasks / frames (plugin's share) |
| --- | --- | --- | --- | --- | --- |
| Open a page, 5 s | 12 | updateDateLinks 0.6 ms | about 1.5 ms (early) + 1 ms (frame) | 2 of 10 | 0 / 0 |
| Scroll Atlas, 10 s | 115 | updateDateLinks 1.7 ms | about 1.5 ms + 1 ms | 59 of 102 | 0 / 0 |
| Type 20 words | 30 | updateDateLinks 0.7 ms | about 1 ms | 3 of 27 | 0 / 0; one database round |
| Navigate ×6 | 75 | titleEarly 3.5 ms | about 1.5 ms + 1 ms | 11 of 54 | 1 long task of 53 ms (0 ms in the plugin) |

The database rounds after a page change (`refreshCues`, start to finish) take 100–160 ms on the test graph and run in the worker, not on the drawing thread. "A frame late" counts the per-frame updaters (title chrome, quiet items, page kind, search cleanup, list properties): while scrolling, Logseq draws inside frames, so most of those passes land in the next frame; the parts that would flash (dates, cues, citations, reference marks, title parts) run in the before-paint pass and were on time. No layout shift was caused by the plugin's elements in any step (the sources listed were Logseq's own page parts).

**Synthetic graph** `Readiness Synthetic App` (made in the app, filled from the shell: 1,723 pages, 59,320 blocks, 4,542 tasks, 9,661 blocks with links, 300 journal days, properties and tags in the shape of a notes graph, one page of 900 top-level blocks). Same steps, 0.2.131:

| Step | Watcher calls | Longest single updater | Plugin's work per change | Passes a frame late | Long tasks / frames (plugin's share) |
| --- | --- | --- | --- | --- | --- |
| Open the 900-block page, 5 s | 29 | updateDateLinks 5.0 ms (once; 0.5 ms average) | about 1.2 ms | 6 of 19 | 1 of 66 ms / 2 of 220 ms (0 ms) |
| Scroll it, 10 s | 787 (Logseq added or removed 4,918 elements) | updateTitleChrome 11.1 ms (once; 0.6 ms average) | about 1.4 ms; 1.1 s in all over 10 s | 121 of 372 | 2 of 107 ms / 5 of 304 ms (0 ms) |
| Type 20 words on a journal page (the editor call is refused on the 900-block page) | 22 | updateDateLinks 2.3 ms (1.5 ms average) | about 3 ms | 2 of 22 | 0 / 0; one database round of 1.3 s after the edit |
| Navigate project → tag page → journal, ×2 | 128 | titleEarly 3.0 ms | about 1 ms | 12 of 69 | 2 of 143 ms / 3 of 214 ms (0 ms) |

What costs time in a large graph is the database round, not the screen passes: opening the 900-block page, the look-ups that draw the `↳` cues and block-link dots (`refreshCues`, start to finish) took 2.0 s, and the rounds after navigation 0.3 s on average (0.7 s at most). They run in Logseq's worker and do not block typing or scrolling, but the cues on a page of that size appear about two seconds after the page does. The three look-ups that carry every block id of the page (task and asset types, PDF sources, direct asset types) are the part that grows with the page; the whole-graph look-ups are cached for 30 s. The layout shifts recorded are Logseq's own (brackets, block containers); the plugin's cue spans appear in the list only after Logseq redraws the blocks they sit in.


### Remaining risks, most likely to bite first

1. **A Logseq update renames a class or label.** Every on-screen feature depends on names inside Logseq's pages (the feature map lists them). When one goes, that feature stops drawing, quietly; the plugin no longer repeats warnings (0.2.119). What to do: after an update, run **Refinements: Check what the plugin finds on this page** on a page, a journal and a tag page, and compare the zeros with what the page shows. Since 0.2.141 a self-check does a short form of this by itself after each page opens and says in the app which features have stopped (see the Fragility section).
2. **Auto-date writes to the real graph.** It is the only automatic write: a new record tagged Occurrence or Results (or a tag extending them) with an empty Date gets the journal day, up to three tries per record per session. It is on by default and runs in every graph unless **Only in these graphs** names the graphs. Checked here on the test graph only: two records filled with the right day, one through an extending tag, and the fill command's confirmation and count. Watch the first week's new records for a Date you did not expect; **Fill missing dates** always asks first.
3. **Fold all on query results saves fold state.** On a list-view query, pressing the results' arrows made Logseq write the collapsed state of the two parent blocks (the fold log shows "database changed (2 blocks)"). It is what a click does, but it is a write to your notes by a command; the README now says so.
4. **Rules written for links Logseq no longer draws.** A tag typed in a block's text is plain text in 2.0.2; the "Alias of" line could not be seen because Logseq opens the original page for an alias; the page-label shortening ("Name #tag") was never seen. These rules are inert rather than wrong, but they are the first to look at if a future Logseq draws such links again and something looks off.
5. **Hover previews, the bullet menu entries and the palette entries were not exercised by hand.** Background control cannot open a right-click menu or hover; the functions behind the menu entries were run directly and the entries are registered in code. A preview that closes on the first hover (noted in 0.2.65) is Logseq's own behaviour that the plugin's styling can make a little more frequent.
6. **The right sidebar gets less than the main area by design.** The link-here wash, the reference count and the "via" labels are placed in the main area only; a page opened in the right sidebar shows Logseq's references plainly (seen: Priya Nair in the sidebar, no wash). Not a defect, but worth knowing when something "is missing" there.
7. **Lists that hide properties scan every row's elements on each pass** (`propertyKeys` walks all elements of each record). With a saved choice on a long list this is the one updater whose cost grows with the list; it was not measured with a saved choice because the test graph's queries have no user properties to hide. If a long list with hidden properties feels slow, set the list back to **Show all**.
8. **Local file links now get the icon and type (0.2.129)** on the strength of one example in the test graph. If a local link in the real graph is drawn with both `href` and `data-url` in a way not seen here, it may lose the icon or get it twice; the asset row itself is excluded.
9. **PDF citations** were checked only with an annotation made from the shell (no real highlight could be made in the background). The citation label and the quote bullet drew correctly; clicking the citation to open the PDF was not tried.
10. **Large graphs.** On a page of 900 top-level blocks in a 59,000-block graph, the cues after blocks and the dots before block links arrive about two seconds after the page is drawn (one database round whose queries list every block id of the page). Scrolling, typing and moving between pages cost the plugin about a millisecond per change there, with no long task of its own. If the real graph has pages of that size, the late cues are the one thing you will notice; narrowing those queries to the blocks Logseq has drawn would be the next improvement.

### Test graph: what was added (Plugin Test Graph only, through the CLI unless noted)

- Tags **Occurrence** (tag property `date`, the graph's existing Date-type property) and **Imaging** (extends Occurrence), for auto-date. On **Oct 12th, 2026**: "Blood test at the clinic (auto-date test)" #Occurrence and "Chest X-ray (auto-date test, tag extends Occurrence)" #Imaging, both filled by the plugin with Oct 12th, 2026. On **Oct 11th, 2026**: "Follow-up visit" #Occurrence (filled automatically) and "Dentist (undated, for the fill command)" #Occurrence, filled by **Fill missing dates** with Oct 11th, 2026.
- The "Date and time" case: the graph's `published at` property is `:datetime`; the property-type check was exercised in 0.2.117 and read again here, not run (the plugin's Date property is global, so a datetime property of the same name cannot exist beside it).
- Page **Readiness Tests**: a Node embed of Orphan Target (an empty block with `:block/link`, made with `upsert block --content " " --update-properties '{:block/link 400}'`; `{{embed}}` is deprecated in 2.0.2); a block with a link to a block (`[[f0000000-…-0002]]`) and a page link, used by the selected-text commands; "The #Idea backlog needs pruning…" (a tag in the text); two parents with children and a query `(page "readiness tests")` switched to **List View** in the app, for fold all; a typing test block; a block with two dates in the text; a block with web links to a PDF and an image; a block with links to the local asset and a local image path; the PDF asset **sync-spec.pdf** (one page, made by hand), an annotation-like block (`:logseq.property/ls-type :annotation`, `hl-page 1`, `:logseq.property/asset` → the asset; the CLI refuses the built-in #PDF Annotation tag) and a block citing it. These four were first put on **Special Blocks**, which turned out to be an alias of Block Types that Logseq never opens, and were moved.
- Tag **Project**: bidirectional properties enabled, so Ada Okafor and Priya Nair show a Project tab with "via owner".
- Page **Mercury** (#Project). A second page titled Mercury with a different tag could not be made through the CLI (`upsert page` adds the tag to the existing page); it is still to be made in the app if the page-label shortening is to be seen.
- Left over from the runs and recycled: a page "A log is the simplest possible storage abstraction." (made by writing `[[title]]` through the CLI), "second highlight" and "Parent with results under it (for fold all)" (made by the command run). The query view and the Book tag's open properties are UI state the runs changed.
- A list that hides properties with the one-line layout was shown in the picker but not saved: the test graph's queries carry no user properties to hide, so the layout could not be judged.

### Fragility (Phase 6)

What the review did: every warning the plugin writes now goes through `warnOnce` (one line per distinct message per session), and a screen updater that throws five times is switched off for the session with one note (0.2.119). Every on-screen feature finds Logseq's parts with `querySelectorAll`; when a class is renamed the selector matches nothing, the feature draws nothing, and nothing is logged (checked by reading each updater: none of them throws on an empty match). The commands that press Logseq's controls (Add tags, fold all, sidebar search, the PDF citation's synthetic press) each stop with one message when the control is missing. The English labels relied on: "Set property" (Add tags), "Show/Hide properties", "(Dev) …", "Page graph" (sidebar tidy), the "P n" of a PDF citation label, the quiet-item names from the settings.

Built in 0.2.141, in a simpler form: the checks below (plus "a toolbar but no page area"), one in-app note per missing part per session and one per new Logseq version, and nothing switched off. The original proposal: a self-check at start-up (and once after each route change) that compares the counts of **Refinements: Check what the plugin finds** against what the page plainly has, and switches a feature off for the session when the part it needs is missing while the page shows the thing:

- blocks on screen (`.ls-block[blockid]` > 0) but no `.block-title-wrap` → cues after a block, block-link dot, reference rows off; one warning;
- a page title (`#main-content-container .ls-page-title`) but no `.is-page-title-row` or no `.ls-page-title-actions > div` → title tags, `#Page`, Add tags off;
- `.references` present but no `.ls-foldable-title` → reference layout, counts, labels off;
- `#right-sidebar .cp__right-sidebar-settings` missing while the sidebar is open → Search button and sidebar tidy off;
- `logseq.App.getInfo('version')` different from `CHECKED_WITH` → the troubleshooting line already says so; the self-check would add one notification at start-up: "Logseq x.y.z is newer than the version this plugin was checked with; run Check what the plugin finds".

Each rule would be a row in the existing `healthChecks` table (selector, feature keys to switch off, the "page shows the thing" selector), evaluated by one function after the first full round. Cost: one `querySelectorAll` per row, once per page. It needs the owner's decision on two points: whether a feature switched off this way should stay off until reload or be retried on the next page, and whether the notification should appear in the app or only in the console.
