# Handoff: Logseq DB Refinements plugin

Written 2026-10-11, updated 2026-10-12 (evening), for the next chat session. Read this first, then `README.md` for the feature list.
The plugin is at 0.2.131 on `main` (the readiness branch was merged, fast-forward, on 2026-10-12); the newest work is under "State after the readiness review".

## What this is

A personal Logseq plugin (DB graphs only) that makes the UI say more clearly what things are:
quieter links, type cues on links and bullets, clearer properties, page-kind cues in titles.
The owner is not asking for new features so much as iterating on a visual vocabulary, one
small change at a time, looking at each result in the running app.

## Where everything is

| Thing | Location |
| --- | --- |
| Plugin (git repo, branch `main` at 0.2.131; `readiness-0.2.119` points at the same commit) | `/Users/claude-agent/logseq-plugin/` |
| Plugin code | `main.js` (about 3,800 lines, one file), entry is `loader.js` |
| Test graph | Logseq graph named **Plugin Test Graph** (`~/logseq/graphs/Plugin Test Graph`) |
| Seed for the test graph | `test/plugin-test-graph.edn` (committed; the graph has since gained things the seed lacks, see below) |
| Live legend of every cue | page **Plugin Visual Cues** in the test graph |
| Logseq | `/Applications/Logseq.app`, version 2.0.2, DB version |
| Logseq CLI | `~/.local/bin/logseq` |
| Plugin settings file | `~/.logseq/settings/logseq-db-refinements.json` |
| Other graphs | `Demo` and `Work`. **Do not touch `Work`**; it is the owner's real graph. |

Git: the history is in `git log`, one version per commit where possible. Commit after each change the owner confirms works.
No global git identity is set; commits were made with
`git -c user.name="ynmyz4hwr6" -c user.email="ynmyz4hwr6@privaterelay.appleid.com" commit ...`.

## State after the audit (2026-10-11, later session)

`AUDIT.md` is the record of an audit of API use and render stability: findings, what Logseq 2.0.2's
source says, the fix plan with a status per step, and measurements. Versions 0.2.99 to 0.2.113 are
its fixes, one per commit, merged into `main` on 2026-10-11 (the branch `audit-fixes` still points at the same commit). The
version before them is in `backups/logseq-db-refinements-0.2.98/` (untracked).

What changed in how the plugin is built:

- **One screen watcher** (`domWatch`). `watchDomEarly(fn)` runs `fn(doc, records)` at once on every
  change, before paint; `watchDom(fn)` runs `fn(doc)` once in the next frame. The watcher ignores
  its own changes. Add new on-screen work to one of these; do not create another MutationObserver.
- **Marks, not generated stylesheets.** `updateCueMarks` marks links and rows from what the
  database said (`cueMarks`), and `cueCss` is a fixed stylesheet. `sendStyle` sends a stylesheet
  only when its text changed; an empty one must go through `orNoRules`, because Logseq ignores
  empty stylesheets.
- **One round after database changes** (`scheduleDbWork` / `runDbWork`). Add a new look-up to the
  list in `runDbWork`, not a new timer. `DB.onChanged` gives no change details in 2.0.2 (`txData`
  is always empty).
- **Measuring tool** (PERF-DEBUG block): `debugPerf: true` and optionally `debugPerfEvery: 10` in
  the settings file, then reload; reports go to `perfLog`. Or the two “measuring” commands.
- **Check after a Logseq update:** “Refinements: Check what the plugin finds on this page”.

How the changes were checked without clicking through Logseq (worth reusing):

- Logseq re-reads `~/.logseq/settings/logseq-db-refinements.json` when the plugin is reloaded, so a
  setting written to that file is a way to pass instructions in, and `logseq.updateSettings` a way
  to get results out.
- A temporary block appended to `main.js` (marked TEMP-DEV) read a list of page names from a
  setting, opened each with `logseq.App.pushState`, waited, and wrote what was drawn (each link's
  computed underline, `::before` content and background, labels, cues, title positions) to a
  setting. Run on the old and the new build, the two results are compared. Code inside `main.js`
  can also call the plugin's own functions, make and remove a test block, and open or close the
  sidebars (`logseq.App.setRightSidebarVisible`).
- With the Plugins panel left open, each reload is one click on **Reload**; the page behind the
  panel is still drawn and can be read.
- Do not use `scrollIntoView` in such a script: it scrolled Logseq's whole window content and hid
  the toolbar until the window was reloaded (bring Logseq to the front, then **View > Reload**).
- Animation-frame work does not run while the display is asleep; keep it awake during a run
  (`caffeinate -d -u -t 120 &`).
- Background clicks do not follow links inside a page, but they do work on the left sidebar's
  page links and the toolbar buttons. Look at a fresh screenshot before every click by index: the
  indexes shift whenever a sidebar opens.

The legend page **Plugin Visual Cues** gained one example in this session: a labelled link to a
block (the case drawn from the database rather than from the page).

## State after the readiness review (2026-10-12, 0.2.119 → 0.2.131, branch `readiness-0.2.119`)

The owner asked for a readiness review before using the plugin on the real graph. `AUDIT.md` → "Readiness review" has the feature map, the findings, the measurements and the remaining risks. What the next session should know:

- **Branch.** All of it is on `readiness-0.2.119`, one version per commit, not merged into `main`. The owner's own uncommitted look changes that were in the working tree at the start (accent-coloured wash under Linked references, dimmer fold arrows, title triangle only on pages with properties) are kept, unreviewed, on `wip-uncommitted-look-changes`. Two look changes the owner asked for during the review were made as 0.2.130 (a cited PDF excerpt reads “words” (source, p. n)) and 0.2.131 (the link-here box is an accent wash, rounder, with room around the words, inside the row); the dimmer fold arrows and the conditional title triangle from the WIP branch were not brought over.
- **How the checks were run.** A TEMP-DEV block appended to `main.js` (kept in the scratchpad as `dev-block.js`, never committed; `scratchpad/commit.sh` strips it before each commit and puts it back) reads `dev*` keys from the settings file and, after the reload, opens pages (`logseq.App.pushState`), flips settings through `logseq.updateSettings` and measures computed styles and mark counts, runs the plugin's own command functions, records every console warning of the plugin frame and of Logseq's window, and writes everything back as `devDump`, `devConsole`, `devMessages`. It also runs the measuring tool through the AUDIT's five steps. The reload loop that worked: click **…** at (989, 22), **Plugins** by coordinate (y = 288 on a journal, 316 on a page whose menu has "Convert to Tag"), **Reload** at (290, 482), Escape. Background clicks cannot open right-click menus or hover previews.
- **Still to do (next session).** (1) Merged into `main` on 2026-10-12. (2) The cues on a 900-block page arrive about 2 s after the page (the three per-page queries list every block id); narrowing them to the blocks Logseq has drawn is the next improvement. (3) The self-check proposed under Fragility in AUDIT.md waits for the owner's yes. (4) Not exercised by hand: the bullet right-click menu entries, hover previews, the palette entries by keyboard, a second page with the same title as another (page-label shortening), the alias line (Logseq opens the original page), a real PDF highlight made in the app. (5) The synthetic graph `Readiness Synthetic App` is still in the app's list; remove it from All graphs when no longer wanted. (6) The owner's remaining WIP look changes (dimmer fold arrows, title triangle only on pages with properties) sit on `wip-uncommitted-look-changes`.
- **Settings file.** `devDump` was removed at the start; `autoDateGraphs` was set to `Plugin Test Graph` for the session and put back to its original empty value at the end; the `dev*` keys were removed at the end.
- **Test graph additions.** See AUDIT "Readiness review" → "Test graph". Notable: the CLI cannot give a block the built-in #PDF Annotation tag, so the PDF highlight could not be made from the shell; a link written as `[[Block title]]` through the CLI makes a new page of that name (use `[[uuid]]`); the CLI cannot make a second page with the same title as an existing one; `{{embed}}` is deprecated in 2.0.2 and a Node embed is an empty block with `:block/link` → target (made through `upsert block --content " " --update-properties '{:block/link <id>}'`); Logseq opens the original page when you navigate to an alias.
- **Logseq 2.0.2 facts learned.** A tag typed in a block's text is drawn as plain `<span>#Idea</span>`, not as `a.tag` (only side tags and property values are `a.tag`). A sidebar navigation link's text runs name, shortcut and count together ("FlashcardsGF2"). A journal's menu has no "Convert to Tag" item, so the Plugins item sits one row higher.
- **Synthetic graph.** `Readiness Synthetic App` (kept; about 60,000 blocks; remove it from the All graphs page when no longer wanted). It had to be created from the app's own "Create a new graph" dialog, because the app lists only graphs it made or opened itself; the content was then imported from the shell in 24 chunks of about 300 KB (`scratchpad/gen-graph.rb` writes them; the CLI's EDN parser takes about a minute per megabyte and its worker is shut down before a 1 MB file is parsed, so a single large file fails with "fetch failed"), with the app switched to another graph meanwhile (the import must own the graph's server), and the window reloaded afterwards (View > Reload) so the app read the new database. While the import runs, the graph looks empty or stale in the app and nothing opens on click. **After any CLI import or heavy CLI use, stop the CLI's worker before opening the graph in the app**: `logseq server stop --graph "<name>"` (check with `logseq server list`, column `owner-source`: `cli` or `ele`). A graph whose worker is still owned by the CLI opens in the app but is unusable with a real mouse: blocks will not unfold, text will not select, bullets will not zoom in (seen on 2026-10-12 with the synthetic graph; accessibility presses from the background still worked, which hid it). The fix was `server stop` for that graph, then View > Reload; the app then started its own worker.

## State after the safety round (2026-10-12, 0.2.117)

Made in a cloud session from a code review, then loaded into Logseq from the branch `safety-0.2.117` and tried with a
TEMP-DEV probe (removed). What each line says about checking is the state after that.

- `selectedRange` / `toSavedRange` replace `selectedBlockText`: the two selected-text commands insert into the
  stored text (`[[uuid]]` kept) instead of re-saving the block with names. `toSavedRange` checked in Logseq on a legend
  line whose link is stored as an id: words before and after the link map to the right place, a selection inside the link
  gives null, a whole link maps to the stored `[[uuid]]`. The commands themselves were not run from the keyboard.
  Fixed here: `linkSelection` now checks "already a link" in the shown text first; in the stored text a link is an id,
  so the old check never matched and the command warned that the block had changed.
  Note: `getBlock().title` is the stored text, and some seed blocks store page links by name (`PM for [[Atlas]]`), so
  shown and stored can be equal.
- Auto-date: `autoDateSetup` keeps only a property whose `:logseq.property/type` is `:date`;
  `autoDateAllowedHere` reads the new setting `autoDateGraphs` and compares with `App.getCurrentGraph()`
  (name, url, path; `logseq_db_` stripped). In 2.0.2 `name` and `url` are both `logseq_db_Plugin Test Graph` and `path`
  ends in the plain name, so a setting of `Plugin Test Graph` matches. The Date-type query was run against the test graph
  (`due date` is `:date`, `published at` is `:datetime`). Filling itself not tried: no dated tag in the test graph.
- `graphWide(name, load)` caches whole-graph look-ups for 30 s (`GRAPH_WIDE_EVERY`); `runDbWork` runs the page
  jobs every round and a full round (cache cleared, plus titles, journals, property names) when due.
  The cache is also cleared on route change. Seen: two calls with one name share a promise. The timing was not watched.
- Fold all: `MAX_PRESSES` (6) per result per command. Read, not exercised.
- `openTagPicker` clears the typed "Tags" when no entry appears. Read, not exercised.
- Tag-page link icons use `--rf-tag-color` (Logseq's tag colour variables, falling back to the link colour); the
  owner asked for this, replacing the grey icon. File links: grey icon, file type as `::after`. Both seen on
  **Plugin Visual Cues** (blue Book and `#` icons; `pdf` and `png` after the file links), whose three lines were reworded.
  As downloaded the colour did not apply: Logseq defines `--lx-accent-11` and `--ls-link-text-color` on `body`, and a
  token declared on `:root` that refers to them resolves there, to `currentColor`. `tokensCss` is now `:root, body`.
  `--ls-tag-text-color` does not exist in 2.0.2; the colour comes from `--lx-accent-11`.

- **0.2.118, icons in links.** Logseq's page link ignores a pointer press whose target is the `<a>` itself
  (`frontend.util/link?` is true for `A` and `BUTTON`), so anything drawn as `a::before` cannot be clicked. The `#` of a
  tag-page link is now `a > span:first-child::before`: an inline box holding a word joiner, 1em of left padding, the
  mask at `0 calc(50% + 1px)`, 3px margin (Logseq's own link icon is a 16px svg in a 19px box, `vertical-align: middle`).
  A probe's `elementFromPoint` on the `#` returns the span; an actual click was not made (background clicks do not
  follow links). The same limit still applies to the dot of a labelled block link (`a::before` in `cueCss`).
  The word joiner from 0.2.116 did **not** keep Logseq's icon with its name (seen: Ada Okafor's icon alone at a line
  end), so a page link with an icon is now `display: inline-block; max-width: 100%` and moves as one piece. Seen on
  **Plugin Visual Cues**. The 0.2.116 note below about icons is superseded by this.

## State after the links and journals round (2026-10-12, 0.2.116)

Asked for as one list; each item was looked at in the app after a reload unless it says otherwise.

- **Links to blocks**: the dashed line under them is gone. They keep the small dot in front and have
  nothing after them. Seen on **Plugin Visual Cues**, whose three example lines were reworded to match.
- **Icons stay with their words**: a linked task's status icons, and the icon of a linked page or tag
  page, are joined to the first word by a word joiner (U+2060) in a `::before`, so a line never breaks
  between them. Seen holding for the task example; the page and tag icons were not seen at a line end.
- **The `↳` cue on the Journals list**: it was missing because `getCurrentPageBlocksTree()` returns
  nothing there. `shownPagesTree()` now reads every page whose title is on screen (up to 12).
  Days that scroll into view later get their cue at the next refresh, not at once.
- **Fold arrows under Linked references** stay faintly visible (section, source page, block with
  something below). A source page's arrow hangs 27px left of its heading and was cut off by
  `overflow: hidden` on `.ls-foldable-content-inner`, so it never showed, even under the pointer; that
  box now has `margin-left: -27px; padding-left: 27px`. Part of `referenceLayout`.
- **Journal references are highlighted**: on a journal, most references point to the day through a
  date (a Scheduled or Deadline value, drawn as `a.page-ref[data-ref="oct 12th, 2026"]` with no
  uuid), so `updateReferenceHere` now also matches the page's name, case-insensitively. It takes every
  title on screen, so each day on the Journals list is handled inside its own `.journal-item`. Seen on
  the single page **Oct 12th, 2026**; the Journals list was not looked at after this change.
- **Journals list spacing**: a day's "Add icon" and "Set property" sit 2em lower, clear of the line
  that closes the day before (`#journals .journal-item:not(:has(.is-today-page))`, padding, under
  `showTitleChrome`). Each day is the only child of its own wrapper, so `:first-child` matches every day.
- `README.md`: the Appearance table was brought up to date; the stale rows are gone.

## State after the Linked references session (2026-10-12)

Versions 0.2.114 and 0.2.115, one commit (`4c77539`), both looked at on the **Priya Nair** page of the
test graph after a plugin reload.

- **0.2.114**: the link to the page on screen, under Linked references, has a stronger wash
  (`--rf-here-pct`, 20%; the date box stays at 8%). It is `!important`, so on a journal page it also
  covers the date link to that day (not looked at on screen).
- **0.2.115**, setting **Clearer Linked references** (`referenceLayout`, on by default):
  - a wider gap between source pages (1.6em, no line);
  - blocks below a reference are drawn at `--rf-quiet` unless they hold a link to the page on screen;
    pointing at one brings it back (the hover was not tried);
  - a journal's date heading loses its box there, so every source page has the same semibold heading;
  - the grey parent path above a reference starts with a bullet, and the reference is stepped in
    1.4em below it, so the two read as parent and child;
  - a heading is followed by `· n` when its page holds two or more references (`updateReferenceCounts`).
- Under **Simpler page icons**: a page listed as a row has the plain page icon in its bullet, as in the
  sidebar (`.bullet-container` added to the scope of the svg page-icon rule). It applies to any page
  row's bullet; only Linked references was looked at.

Where the code is: the fixed rules are the `referenceLayout` entry in `cssParts`; the wash and the
quiet-children rule are in `updateReferenceHere`, because both need the uuid of the page on screen;
the count is `updateReferenceCounts`, run from `updateDateLinks`.

Not looked at: Unlinked references, the right sidebar, a reference through a `#tag`.

What cost time, worth knowing:

- **The Linked references list measures its rows.** A `margin` on a source-page group is not counted,
  and the bottom of the list is cut off by that much (a whole group was hidden). Use `padding`.
- **Rows are drawn late.** A probe that ran 3 seconds after reload found the groups empty; 7 seconds
  was enough.
- **Blocks inside a reference are also `.ls-block[level="0"]`**: property values, the blocks of a page
  shown as a row, and that page's own Linked references. Anything that counts or styles "the
  references" has to leave out blocks that sit inside another block of the same group.
- The layout, for the next change: `.references .group-list-view > div > div > div` is one source page;
  inside it `.ls-foldable-title` (heading; a journal's has `[data-refinement-date-heading]`) and
  `.ls-foldable-content`, which holds one `div` per reference: an optional
  `.breadcrumb.block-parents` in a wrapper, then `.content` with the `.ls-block[level="0"]`.
- Reload loop that worked every time: screenshot, click **…** by coordinate (993, 20), click
  **Plugins** by index from that screenshot, screenshot again (the panel moves as it opens), find
  **Reload** with `app_ax_find`, click it, close the panel at (1004, 77). The window was 1038 wide.

### Tried and rejected in this session (do not bring back)

- A hairline between source pages, full width or short. Spacing alone is wanted.
- A `›` closing the parent path. A path does not end with an arrow; it has a bullet now.
- A dashed line under links to blocks (removed in 0.2.116 after several versions).
- A small `↗` closing a link to a block (tried in 0.2.116 and removed the same hour).

### The test graph gained things the seed does not have

Made at the owner's request, outside the plugin:

- Tag **#Expectation** with properties `juncture`, `date` (date), `completed` (date) and the built-in
  **Scheduled**. `juncture` has the choices Waiting, Updated, No change, Done, sits at the beginning of
  the block, and uses the task icons (Todo, InProgress50, Backlog, Done), so a block tagged
  `#Expectation` shows a circle like a task. Waiting is unchecked and Done is checked.
- An example block on **Oct 11th, 2026**: "Example: Priya promised the beta invite list" (Waiting,
  scheduled Oct 12 12:00). The owner's own `test` task is on **Priya Nair**.
- The example does **not** show in the journal's grey Scheduled and Deadline boxes. Logseq 2.0.2 lists
  there only blocks that have the built-in Status and are not Done or Canceled (read from the app's
  source, `get-date-scheduled-or-deadlines`). The owner chose to leave this.

CLI notes from that work: `upsert property` cannot add choices or a position (done in the app:
property page, **Configure**; a submenu opens with a click and then the right-arrow key); a choice's
icon can be set with `upsert block --id N --update-properties '{:logseq.property/icon {:type :tabler-icon :id "Todo"}}'`;
Scheduled takes milliseconds, not a date string; the graph's `config.edn` is stored inside `db.sqlite`.

## The development loop

1. Edit `main.js`.
2. Syntax-check (there is **no node, npm or python** on this machine; Xcode tools are not installed):

   ```bash
   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc check.js -- /Users/claude-agent/logseq-plugin/main.js
   ```

   where `check.js` is three lines: read the file, `new Function('logseq', 'window', src)`,
   print OK or the error. Recreate it in the scratchpad.
3. Reload the plugin in Logseq: toolbar **…** menu, **Plugins**, **Reload** on the DB Refinements
   card, close the panel. `loader.js` loads `main.js` with a timestamp so the reload picks up
   the edit. (Logseq otherwise caches the script; `View > Reload` from the menu bar does not work
   in the background.)
4. Look at the result with computer use (`mcp__computer-use__app_screenshot` / `app_zoom` on
   `com.logseq.logseq`).

### Editing tips that cost time to learn

- `main.js` contains non-ASCII characters. For scripted multi-part edits use system Ruby with
  explicit UTF-8: `LC_ALL=en_US.UTF-8 /usr/bin/ruby -E UTF-8:UTF-8 script.rb main.js`, reading and
  writing with `encoding: "UTF-8"`. Have each replacement raise if its anchor text is not found
  exactly once.
- To read the app's DOM (computer use cannot run JavaScript in the app), append a temporary block
  at the end of `main.js` that, after a timeout, calls
  `logseq.updateSettings({ devDump: JSON.stringify(...) })`, reload the plugin, then read
  `~/.logseq/settings/logseq-db-refinements.json`. Remove the block afterwards
  (`grep -c TEMP-DEV main.js` must be 0). `fetch` to localhost is blocked from the plugin.
- The CLI can query and write the test graph while the app has it open:
  `logseq query -g "Plugin Test Graph" --query '[:find ...]'`,
  `logseq show -g "Plugin Test Graph" --page "..."`,
  `logseq upsert block ... --id N --content "..."`. Use it to test Datascript queries before
  putting them in the plugin, and to edit the Plugin Visual Cues page.
  `upsert task` cannot create under a block id; create a block, then set its status by id.

### Computer-use cautions

- The owner is usually using Logseq at the same time and resizes the window, collapses the
  sidebar and navigates. **Take a fresh screenshot before clicking by coordinate.** Blind
  coordinate clicks from an old layout have hit the wrong things (opened a property page, ticked
  a table row, put a table cell into edit mode). Prefer `element_index` from the latest
  screenshot; the **…** button has been index 11 and **Plugins** index 20 on ordinary pages
  (18 on the Pages list).
- Background clicks are accessibility presses: they fire `click` but not `pointerdown`.
  Background typing into Logseq's search is lossy and its results redraw late.
- Never press Enter in a Logseq menu to "pick the first item". It once added an `active`
  property to a page. Find the exact item and click it.

## Visual vocabulary as it stands

Shared scale lives in `tokensCss` (`--rf-quiet`, `--rf-faint`, `--rf-line-pct`, and so on). Use
those instead of new numbers.

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
| Page title row | page's tags sit beside the actions above the title; `#Page` on an untagged page, clickable to open Set Tags; properties triangle always visible |
| Tag page | "Inherited from #Media: keywords, rating, website" line closing the Tag Properties list |
| Linked references | the link to the page on screen sits in a clear grey box (20%, stronger than a date); on a journal the same box on a date that points to that day; source pages set apart by a gap; fold arrows faintly visible; plain semibold headings, `· n` after one that holds several references; bullet before the parent path, reference stepped in below; blocks below a reference quiet |
| Page listed as a row | plain page icon in the bullet, as in the sidebar |

Rules agreed along the way: the bullet says what a row is, a mark before a link says what it
points to, anything after the text says what the block holds. The arrow symbol is no longer used.

### Things the owner tried and rejected (do not bring back)

- Square bullet / square before links for "tagged record".
- Bold, italic, a framed icon, or an underlined icon for links to tag pages.
- A `#` written into a tag page's title.
- Muted property names (removed back in 0.2.94).
- Showing `#Page` next to other tags.

## Open requests (start here)

- The owner's uncommitted look changes on `wip-uncommitted-look-changes` (accent wash, dimmer fold arrows, triangle only on pages with properties): bring onto the readiness branch or drop; the owner asked why the wash looked different and was told.
- The last highlighted value in a property row is clipped by Logseq's overflow clip because the wash hangs 0.2em outside the words (negative margin); the proposed fix (no negative margin, words after it move 0.4em) waits for the owner's yes.

Decided on 2026-10-12, leave as they are unless the owner raises them again:

- Property lists stay as Logseq draws them (bullet beside every value, normal weight). Do not hide the
  value bullet without handling text values, which draw a bullet of their own.
- The `↳ ◌ n` task count repeats on every ancestor, and links to PDFs/images count as "files below".
- A source page whose only reference is the page itself shows the name twice, as heading and as row
  (**Why Block References Matter** under Priya Nair, through its `authors` property).

## Known loose ends

- The Cmd+T command only works on ordinary pages (it goes through the "Set property" button).
- On **Book** in the test graph, `published at`, `authors` and `isbn` hold empty descriptions, so
  Logseq shows an empty value instead of "Add description". Test data, not plugin code.
- The Linked references look on a reference that comes through a `#tag`: the test graph now has one ("The #Idea backlog…" on Readiness Tests) but the Idea tag page was not looked at.
- The owner asked whether the `[[ ]]` dropdown has to list every date. It is Logseq's own list of
  pages, journals included; hiding dates there was offered and not decided.

## How the owner likes to work

- Short, concrete proposals; then just make the change and show it. They decide by looking.
- When asked "should we…", give one recommendation with the reason, not a menu.
- Say plainly what was verified on screen and what was not.
- They care about the page-versus-block and tag-versus-page distinctions most; those drove
  nearly every change this session.
