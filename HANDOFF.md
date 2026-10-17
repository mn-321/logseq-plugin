# Handoff: Logseq DB Refinements plugin

Updated 2026-10-16, after the cleanup (0.4.38 to 0.4.62). Read this first, then `GUIDE.md` for how to work on it and `README.md` for what it does. The diaries of earlier sessions, the audit and the reviews are in `docs/history/`.

## What this is

A personal Logseq plugin (DB graphs only, Logseq 2.0.2) for one owner. Most of it changes how pages look, so pages, blocks, links, tags, properties and dates are easier to tell apart; three parts write to notes (journal-day dates, Todos, the tag tree), each within limits the README names. The owner is not asking for new features so much as iterating on a visual vocabulary, one small change at a time, looking at each result in the running app.

## Where everything is

| Thing | Location |
| --- | --- |
| Plugin (git repo, branch `main`) | `/Users/claude-agent/logseq-plugin/` |
| Core | `main.js` (the screen watcher, the database round, stylesheet sending, the settings schema, the self-check, `main()`, the commands, the part loader) |
| Shared helpers and the contract between files | `parts/shared.js` (read its header) |
| The areas, one file each | `parts/editor.js`, `pages.js`, `properties.js`, `links.js`, `chrome.js`, `styles.js`, `diagnostics.js` |
| The former plugins | `parts/sidebar.js`, `search.js`, `journal-dates.js`, `rich-copy.js`, `todos.js`, `tags.js`, `settings-panel.js` |
| Checks and the release zip | `sh tools/check.sh`, `sh tools/release.sh` (zips go to `~/logseq-plugin-archive/releases/`) |
| Old backups, old zips, `main.js.orig` | `~/logseq-plugin-archive/` |
| The gentle theme (a separate Logseq theme) | `~/logseq-gentle-theme/` |
| Standing advice for plugin and CLI work | `GUIDE.md` |
| History (audit, reviews, session diaries, the cleanup prompt) | `docs/history/` |
| Test graph | Logseq graph **Plugin Test Graph** (`~/logseq/graphs/Plugin Test Graph`); seed in `test/plugin-test-graph.edn` (the graph has gained things the seed lacks) |
| Live legend of every cue | page **Plugin Visual Cues** in the test graph |
| Logseq | `/Applications/Logseq.app`, 2.0.2, DB version; CLI `~/.local/bin/logseq` |
| Plugin settings file | `~/.logseq/settings/logseq-db-refinements.json` |
| Other graphs | `Demo` and `Work`. **Do not touch `Work`**; it is the owner's real graph. |

Git: one version per commit. No global identity is set; commit with
`git -c user.name="ynmyz4hwr6" -c user.email="ynmyz4hwr6@privaterelay.appleid.com" commit …`.

## The state today

- 0.4.62 on `main`. Everything the owner sees is as it was at 0.4.37, apart from one change: the command palette's eight troubleshooting entries became one, **Refinements: troubleshooting**, which opens a box listing the tools (plus a new tool, **Copy warnings**).
- The code is a core plus parts (see the table). Every helper exists once (`parts/shared.js`); in the three files the cleanup split (tags, todos, search) no function is over 80 lines; the ones still over it elsewhere are listed under "Cleanup (October 2026)" below.
- The owner uses the plugin in `Work` and lets journal-day dates run there (settings `autoDateGraphs: Plugin Test Graph, Work`).

## Open requests

- **Road to 1.0.0 (asked 2026-10-13).** What is left is a quiet week of use in `Work`; if nothing surprises the owner, bump to 1.0.0. Not needed for 1.0: faster cues on very large pages, hand checks of hover previews and the bullet menu.
- Decided on 2026-10-12, leave as they are unless the owner raises them again: property lists stay as Logseq draws them (bullet beside every value, normal weight); the `↳ ◌ n` task count repeats on every ancestor, and links to PDFs/images count as "files below"; a source page whose only reference is the page itself shows the name twice.

## Known loose ends

- The Cmd+T command calls Logseq's own "Set tags" command; on the Journals list it says so and does nothing.
- On **Book** in the test graph, `published at`, `authors` and `isbn` hold empty descriptions (test data, not plugin code).
- The Linked references look on a reference that comes through a `#tag` has not been looked at on the Idea tag page.
- Whether the `[[ ]]` dropdown has to list every date (it is Logseq's own list) was offered and not decided.
- Seen once during the cleanup, in nine probe runs: after three reloads three seconds apart, the right sidebar's tidy marks and Search button were missing at the moment of a dump and back a moment later. Not reproduced.

## Visual vocabulary as it stands

Shared scale lives in `tokensCss` (`--rf-quiet`, `--rf-faint`, `--rf-line-pct`, and so on). Use those instead of new numbers.

| Thing | How it looks |
| --- | --- |
| Link to a page | faint solid underline, page's own icon in normal text colour |
| Link to a tag's own page | same underline, icon in the tag colour (`--rf-tag-color`; a `#` icon in that colour if the tag has none) |
| `#tag` on a block | bold, no underline |
| Link to a block (inline or whole row) | small dot in front, nothing under or after the words |
| Link to a task block | status/priority icons stand in for the dot |
| Date | grey box |
| Link to a PDF or image | grey icon in front, text with the page underline, file type (`pdf`, `png`…) after in small grey |
| Block with unfinished tasks or files below | trailing `↳`, dashed circle + count, file icons |
| Block properties | `name: value · name: value`, no capsule outline |
| Page property list | as Logseq draws it |
| Page title row | page's tags sit beside the actions above the title; `#Page` on an untagged page, clickable to open Set Tags; properties triangle as Logseq draws it |
| Tag page | "Inherited from #Media: keywords, rating, website" line closing the Tag Properties list |
| Linked references | the link to the page on screen sits in a clear grey box; on a journal the same box on a date that points to that day; source pages set apart by a gap; fold arrows as Logseq draws them; plain semibold headings, `· n` after one that holds several references; bullet before the parent path, reference stepped in below; blocks below a reference quiet |
| Page listed as a row | plain page icon in the bullet, as in the sidebar |

Rules agreed along the way: the bullet says what a row is, a mark before a link says what it points to, anything after the text says what the block holds. The arrow symbol is no longer used.

## Tried and rejected (do not bring back)

- Square bullet / square before links for "tagged record".
- A `#` in the tag colour in place of the bullet dot on tagged blocks (0.2.140, removed the same day): the tags at the right of the block already say it.
- Bold, italic, a framed icon, or an underlined icon for links to tag pages.
- A `#` written into a tag page's title.
- Muted property names (removed back in 0.2.94).
- Showing `#Page` next to other tags.
- A hairline between source pages under Linked references, full width or short. Spacing alone is wanted.
- A `›` closing the parent path. A path does not end with an arrow; it has a bullet now.
- A dashed line under links to blocks (removed in 0.2.116 after several versions).
- A small `↗` closing a link to a block (tried in 0.2.116 and removed the same hour).
- Rounded, padded or accent-coloured marks for the link to the page on screen under Linked references (read as "a button, not a highlight"); the owner settled on a plain grey wash.
- The look changes on the old `wip-uncommitted-look-changes` branch (accent wash, dimmer fold arrows, title triangle only on pages with properties) were dropped at the owner's word on 2026-10-13.

## How the owner likes to work

- Short, concrete proposals; then just make the change and show it. They decide by looking.
- When asked "should we…", give one recommendation with the reason, not a menu.
- Say plainly what was verified on screen and what was not.
- They care about the page-versus-block and tag-versus-page distinctions most.
- Checks are done by the session itself, in the running app, with computer use on the Plugin Test Graph (reload, look, measure); never by handing the owner steps.

## Cleanup (October 2026)

Done 2026-10-16, versions 0.4.38 to 0.4.62, one commit per step or file (`git log`), each with a CHANGELOG line that says what was seen on screen and what was only read in code. The check after every commit was a probe (GUIDE → "Testing without a human at the keyboard") that reloaded the plugin, dumped the computed styles and marks of five pages, the right sidebar, the Todos page, the tag tree and the search window, reloaded three more times and dumped again, and diffed everything against the baseline taken before the first commit; the dump never differed apart from the one agreed change.

- **What moved where.** `backups/`, `releases/` and `main.js.orig` to `~/logseq-plugin-archive/`; the gentle theme to `~/logseq-gentle-theme/`; the helpers every file carried a copy of into `parts/shared.js`; the troubleshooting tools into `parts/diagnostics.js`; the areas of `main.js` into `parts/editor.js`, `pages.js`, `properties.js`, `links.js`, `chrome.js` and `styles.js` (the stylesheets byte for byte); `AUDIT.md`, `REVIEW-2026-10-14.md`, the diary sections of the old HANDOFF and the cleanup prompt into `docs/history/`. `main.js` went from 4,248 lines to about 515.
- **The big functions.** `createView` in tags.js (786 lines) and todos.js (490) became a state object per view plus module-level functions bound to it by name; `editPreviewLine` and `runSearchFilters` in search.js were split the same way. The search part's own MutationObserver is gone; its updaters run on the core's watcher (passes and time per pass unchanged, see 0.4.60).
- **New tools.** `tools/check.sh` and `tools/release.sh`; the registry on `window.refinementCore` (`provide`, `provided`, `onDbRound`, `onFoldAll`); `take(core, names)` in every area part, which warns once when a name it needs is missing; the list of warnings in `shared.js` and **Copy warnings**.
- **The one visible change.** The palette's eight troubleshooting entries are one entry, **Refinements: troubleshooting**, opening a box that lists the tools (0.4.49).
- **Left undone, and why.** Functions still over 80 lines outside the three files the step named: `open` in settings-panel.js (258), `buildDocument` (149) and `chooseProperties` (85) in rich-copy.js, `updatePdfCitations` in links.js (93) and `main()` in main.js (102); the prompt asked for the split in tags, todos and search, and these were left rather than risk them without their own checks. Counts after the cleanup: 77 settings-schema entries (65 settings, 12 headings), the same `provideStyle` keys, 9 everyday palette entries plus the troubleshooting one. A probe run once caught the right sidebar without the plugin's marks after three rapid reloads (see "Known loose ends"). The `dev*` keys of the probe were removed from the settings file at the end.
- **Checked by hand at the end (0.4.62).** In the tag tree, with events sent from the console: a tag dragged onto another and Undo, Tab and Shift+Tab, `n` making a tag inside another and Undo deleting it; the tree was the same as before after each. The refusals of Make a page from this block, Delete this block, New block at the outermost level, Link selected text to a page and Open selected text as page with nothing in edit; Copy selected blocks as rich text with nothing selected (it offers the page); Fill missing dates (its confirmation box named 5 undated records in the test graph; cancelled); Search in right sidebar; **Copy warnings** (none). Not checked: a narrow window, the hover on hidden properties, the key bindings themselves (the commands were run from the console and the search window, not from the keyboard) and the bullet-menu entries.
