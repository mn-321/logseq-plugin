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
| B1 | Four always-on whole-page observers; one redraw causes 2–4 full passes | 26, 927, 1103, 2155 | M–H | open |
| B2 | `updateDateLinks` runs eight page scans on every change, including any `class` change; the cue scan searches each block before checking it has a cue | 865, 929, 1153, 880 | M | open |
| B3 | Stylesheet with four rules per referenced block in the whole graph (about 1.7 KB each) | `refreshCues` 1293 | H in a big graph | fixed 0.2.105 |
| B4 | Seven timers per database change, about 20 queries, settling at 800, 1000 and 1500 ms | 2979 | L–M | open |
| B5 | Auto-date could rewrite the same record every 1.5 s if a write lands but the "no date" test still matches | `autoDateNew` 2881 | L | open |
| B6 | Title tags are re-measured only when page content changes, so they can sit off after a sidebar toggle | `updateTitleTags` 1987 | M | open |
| B7 | Slow selectors: hover rule for nesting lines (1682), reference-row `*` rule (274), `div:has(> …crumb)` (305) | CSS | M | open |
| B8 | Fold log observer never stops after the first fold command | 2493 | L | open |
| B9 | Per-frame work that could be skipped: sidebar text scan (1553), title computed styles (1835), list choices re-parsed (2443) | — | L | open |
| C1 | Line beside embedded pages never draws (`.embed-page` matches nothing) | 289 | M | open |
| C2 | Fold log always reports "0 facts" (`txData` is empty) | 2976 | L | open |
| C3 | `onSettingsChanged` re-sends the main stylesheet on every settings write | 2990 | L | open |
| C4 | Dead code: `data-refinement-page-kind` is set but no rule uses it | 1917 | L | open |
| C5 | Fold all says "Folded" even when no arrow was found | `foldQueryResults` 2621 | L | open |
| C6 | Settings file holds leftover `devDump` and `recordCues` keys | settings JSON | L | open |

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
| 7 | Merge the observers into one, keeping a before-paint phase (the baseline shows late passes) | B1, B2 | | open |
| 8 | Title tags follow size changes | B6 | | open |
| 9 | One scheduler for database changes; auto-date remembers what it filled | B4, B5 | | open |
| 10 | Tighten selectors; decide the hover rule from measurements | B7 | | open |
| 11 | Small fixes | B8, B9, C1–C6 | | open |

## Cannot be fixed from a plugin

- Logseq's own look before the plugin loads, at startup and during Reload.
- The delay on anything that needs a database lookup on the first visit to a page.
- Anything Logseq stops giving plugins (for example `txData`, or access to its window).

## Stays fragile

Most on-screen features depend on Logseq's internal class names, English labels, or pressing its
own controls. Highest risk first: fold all, the `#Page` click and `Mod+T`, search in the sidebar,
sidebar tidy, title tags, the property picker, PDF citations, then all link/date/cue styling.
Planned mitigation (step 11): a selector health check in the troubleshooting report and a
"checked against Logseq 2.0.2" note.

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
