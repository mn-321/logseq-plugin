# Guide: working on this plugin and on the graph from the command line

Written 2026-10-12 from what the audit, the safety round and the readiness review learned the hard way; updated 2026-10-15 for the one-plugin layout (0.4.x). This file is for working on the plugin and is not part of the release zip. `HANDOFF.md` says where things are and what the last session did; `AUDIT.md` records findings and measurements; this file is the standing advice. Everything here was checked against Logseq 2.0.2 (DB graphs); re-check after an update.

## Part 1: the plugin

### Where the code is

- `loader.js` is Logseq's starting file; it loads `main.js` with a fresh timestamp so a reload picks up edits.
- `main.js` holds the look of pages, the shortcuts and the commands. Before it starts, it loads `parts/sidebar.js`, `parts/search.js`, `parts/journal-dates.js`, `parts/rich-copy.js` and `parts/settings-panel.js` in that order (`PART_FILES`). Each part is wrapped in its own scope, pushes `{name, schema, start, stop}` onto `window.refinementParts`, and has its own clean-up and `STOP_KEY`. Their settings are joined after `main.js`'s own.
- Only one session at a time should edit `main.js`; make small in-place edits and re-read the file first.

### What goes in the release zip

Only what Logseq needs and what a reader needs: `package.json`, `loader.js`, `main.js`, `parts/*.js`, `README.md` and `CHANGELOG.md`, inside a folder named `logseq-db-refinements`. Work notes (`AUDIT.md`, `HANDOFF.md`, this guide, reviews), `test/`, `backups/`, `releases/`, `gentle-theme/` and `main.js.orig` stay out. Zips are named `logseq-plugin-<version>.zip` (with a date suffix when the version did not change) and go to `releases/`.

### How the plugin is built, and the rules that keep it that way

- **One screen watcher.** `watchDomEarly(fn)` runs `fn(doc, records)` on every change Logseq makes, before paint; `watchDom(fn)` runs `fn(doc)` once in the next frame. Put flash-prone work (dates, cues, citations, marks under Linked references, the title's parts) in the early pass and everything else in the frame pass. Never add a `MutationObserver` of your own; the two exceptions (`listFold`, `foldLog`) run only while a fold-all command is active and stop on the next page.
- **One database round.** Anything that reads the graph after an edit goes into the list in `runDbWork`, not into a timer of its own. Whole-graph look-ups go through `graphWide(name, load)` (cached 30 s); look-ups about the page on screen run every round. Keep a version counter in any async look-up whose answer is applied to the page (`refreshVersion`, `pageKind.version`, `dateLinks.version`, `listProps.inlineVersion`) and throw the answer away when a newer round has started.
- **Marks, not generated stylesheets.** What the database says is written onto the elements as `data-refinement-*` attributes or `refinement-*` classes, and a fixed stylesheet draws from them. When you add a mark: add it to `STRAY_ATTRIBUTES` (or the element to `STRAY_ELEMENTS`), remove it in the part's clean-up, and diff old and new sets each pass (see `updateCueMarks`) so nothing is written twice.
- **Clean-up for everything.** Every part registers its undo with `onUnload`; every Logseq hook's "off" function goes through `onUnload` too. `runUnloadTasks` runs them in reverse, and a new copy of the plugin runs the previous copy's clean-up (`takeOverFromEarlierCopy`) and sweeps strays. After a change, three reloads in a row must leave one of everything (count with **Check what the plugin finds**).
- **Stylesheets.** Send a stylesheet only when its text changed (`sendStyle`); Logseq re-lays out the page on every send. An empty stylesheet is ignored by Logseq, so send a comment (`orNoRules`) to clear one. Declare tokens on `:root, body`: Logseq defines its theme variables on `body`, and a token on `:root` that refers to them resolves to nothing.
- **One scale.** Use the tokens in `tokensCss` (`--rf-quiet`, `--rf-faint`, `--rf-line-pct`, `--rf-small`, …) instead of new numbers, and the three placement rules: the bullet says what a row is, a mark before a link says what it points to, anything after the text says what the block holds. Check `HANDOFF.md` → "Tried and rejected" before proposing a look.
- **Warnings.** Use `warnOnce(message, …)`; a message is written once per session. A screen updater that throws five times is retired for the session by the watcher itself (`updaterFailed`); write updaters so an empty `querySelectorAll` result is a quiet no-op, never an error.
- **Settings.** Add new settings to `settingsSchema` with a plain description that says whether it applies at once or after a reload; list reload-only ones in `RELOAD_SETTINGS`. Read settings with `setting(key)`, which falls back to the default when the stored value is missing or of the wrong type. Settings are shared by every graph: anything that writes to the graph needs a way to limit it (`autoDateGraphs` is the model).

### What Logseq 2.0.2 does that the code must respect

- A page link's press is ignored when the event target is the `<a>` itself (`frontend.util/link?` is true for `A` and `BUTTON`), so anything that must be clickable is drawn on `a > span:first-child::before`, never on `a::before` (the `#` of a tag-page link and the dot of a labelled block link both learned this).
- The editor shows a link to a page by name and a link to a block as `[[uuid]]`; saved text stores both as ids. Anything that maps the editor's text onto the saved text (`toSavedRange`) has to treat the two differently (0.2.127).
- A tag typed in a block's text is drawn as plain `<span>#Tag</span>`; only side tags and property values are `a.tag`.
- A link to a file in the assets folder is drawn with `data-href` and no `href`; the asset block's own row carries `data-url` as well.
- Navigating to an alias opens the original page. A Node embed is an empty block with `:block/link` → target, drawn as `.embed-block`; `{{embed}}` is deprecated.
- The Linked references list measures its rows: use `padding`, not `margin`, on a source-page group, or the bottom of the list is cut off. Its rows are drawn late (a probe needs about 7 s after a reload).
- Blocks inside a reference are also `.ls-block[level="0"]`; anything that counts references must leave out blocks that sit inside another block of the same group.
- A sidebar navigation link's text runs name, shortcut and count together ("FlashcardsGF2"); match the parts, not the whole.
- Pressing a query result's fold arrow in list view is a database write (collapsed state); pressing Logseq's controls is "a click", with everything a click does.
- `DB.onChanged` gives no change details (`txData` is empty); `datascriptQuery` runs in the worker, so a long query delays what it draws but does not freeze the screen.
- English labels the plugin still depends on: "Set property" (Add tags), "Show/Hide properties", "(Dev) …", "Page graph" (sidebar tidy), the "P n" of a PDF citation label.

### The development loop

1. Edit `main.js`. For scripted edits use system Ruby with explicit UTF-8 (`LC_ALL=en_US.UTF-8 /usr/bin/ruby -E UTF-8:UTF-8`) and make each replacement raise unless its anchor is found exactly once. There is no node, npm or python on this machine.
2. Syntax-check: `jsc check.js -- main.js` where `check.js` wraps the file in `new Function('logseq', 'window', src)` (see `HANDOFF.md`).
3. Reload the plugin: `t` then `p` (Plugins panel), **Reload** on the plugin, close the panel; `loader.js` loads `main.js` with a fresh timestamp. Or, in the devtools console (`Cmd+Opt+I`): `await LSPluginCore.reload('logseq-db-refinements')`; click the console prompt right before typing, or the text can land in a block. `View > Reload` reloads the window but does not pick up `main.js` changes. Test in the **Plugin Test Graph**, never in **Work**.
4. Look at the result: a screenshot or zoom of the running app, and the plugin's own commands (**Check what the plugin finds on this page**, **Copy styling details**, **Copy page title area details**).
5. Measure when the change touches the watcher or the database round: **Turn measuring on or off** then **Copy performance report** (or `debugPerf` and `debugPerfEvery` in the settings file). Go through the AUDIT's five steps and compare with the baselines there.
6. Commit one fix per commit, version bumped in `package.json` (and the version line at the top of `README.md`), with a `CHANGELOG.md` note in the plain style of the existing ones; update the README's tables when a feature or setting changes. `git -c user.name=… -c user.email=… commit` (no global identity is set). Say in the note what was seen on screen and what was only read.

### Testing without a human at the keyboard

- A temporary block appended to `main.js` (marked `TEMP-DEV`, never committed: `grep -c TEMP-DEV main.js` must be 0 before a commit) can read instructions from the settings file at load, drive the app through the plugin API (`pushState`, `updateSettings`, `editBlock`, `insertAtEditingCursor`, `openInRightSidebar`, `invokeExternalCommand('logseq.ui/toggle-theme')`), call the plugin's own functions, read computed styles and `elementFromPoint`, hook `console.warn`/`console.error` of both the plugin frame and Logseq's window, wrap `logseq.UI.showMsg`, and write results back with `updateSettings` for the shell to read. Never read code from the settings file into the block; keep it data-driven (names, selectors, page names).
- Switching a setting with `logseq.updateSettings({key: false})` exercises the same path as the settings panel; measure before, after off, after on again, and expect the first and last to match.
- A command that opens one of the plugin's own boxes returns only when the box closes: do not `await` it before reading the box; read, close (a `mousedown` on the backdrop), then await.
- Background control (`app_*` tools) cannot open right-click menus or hover previews, and cannot type at a caret (only replace a whole field); accessibility presses fire `click` without `pointerdown`, so a graph that fails with a real mouse can still seem fine from the background. Keep the display awake (`caffeinate -d -u -t …`) during timed runs.
- Keep every check in one place: the probe's dumps go to the settings file; remove the `dev*` keys at the end of the session.

### Before calling anything done

- Every feature in the README's Appearance table: setting on → off → on without a reload where the README says it is live; one page kind of each (plain, tag, property, journal, Journals list, alias); light and dark; both sidebars; a narrow window; the right sidebar.
- Every command from the palette, the shortcut and the bullet menu, including its refusals.
- No console lines from the plugin; no errors from Logseq caused by a plugin call.
- Three reloads in a row: nothing doubled, no leftover marks.
- After a Logseq update: run **Check what the plugin finds on this page** on a page, a journal and a tag page; a zero beside something you can see is a renamed part. Update `CHECKED_WITH` when the plugin has been checked against the new version.

## Part 2: the command line (`~/.local/bin/logseq`)

### What it is good for

- Reading and changing the test graph while the app has it open: `logseq query -g "Plugin Test Graph" --query '[:find …]'`, `logseq show --page "…"`, `logseq list page|tag|property|node|asset`, `logseq upsert block|page|tag|property|task|asset`, `logseq remove page` (recycles unless `--force`).
- Trying a Datascript query before putting it in the plugin: the plugin's own queries paste in unchanged.
- Seeding examples the plugin needs (tags with properties, journals, assets, queries, embeds) without typing in the app.

### How to write things so they come out right

- **Entity ids in queries:** `:db/id` cannot be a datom attribute in `:where`; bind ids with `:in $ ?id` / `[?id ...]` and `--inputs '[123]'` / `--inputs '[[1 2 3]]'`.
- **Links to blocks:** write `[[<uuid>]]`. Writing `[[Block title]]` makes a new *page* of that name (then recycle it: `remove page`).
- **Tags:** `--update-tags '["Name"]'` for your own tags. Built-in classes (PDF Annotation, Query through `update-properties` works, but `:block/tags [179]` does not) cannot be set from the CLI; a real PDF highlight has to be made in the app.
- **Tag structure:** `upsert tag --name X --add-properties '["prop"]'`; "extends" through `upsert page --id <tagId> --update-properties '{:logseq.property.class/extends [<parentId>]}'`; bidirectional properties through `{:logseq.property.class/enable-bidirectional? true}` on the tag's page. `upsert block` refuses a page id ("source must be a non-page block"); use `upsert page --id`.
- **Choices, icons, positions:** `upsert property` cannot add choices or a position (do it in the app); a choice's icon can be set with `upsert block --id N --update-properties '{:logseq.property/icon {:type :tabler-icon :id "Todo"}}'`.
- **Dates:** Scheduled and Deadline take milliseconds; a Date-type property takes a journal page (`[:build/page {:build/journal 20261012}]` in a seed, the journal's id through the API).
- **Queries:** a query block is `--update-tags '["Query"]' --update-properties '{:logseq.property/query "(page \"name\")"}'`; it opens in table view, and the view type switch has to be made in the app for fold-all to have arrows.
- **Embeds:** `upsert block --content " " --update-properties '{:block/link <targetId>}'` (content is required; a single space keeps the block empty-looking).
- **Same-title pages:** `upsert page --page X --update-tags` adds the tag to the existing page; a second page with the same title cannot be made from the CLI.
- **Assets:** `upsert asset --path file.pdf --target-page "…"` copies the file into the graph's `assets` folder under its new uuid and makes the asset block.
- **Chunk EDN imports.** `graph import --type edn` parses at roughly a minute per megabyte and its worker is shut down before a large file finishes ("fetch failed"); split a seed into files under 1 MB (300 KB took 10–40 s each), order them so every uuid reference points at an earlier file, and import them in sequence, stopping on the first `Failure`. Sets in EDN (`#{…}`) must not repeat an element.
- **Graph ownership.** The app lists only graphs it created or opened itself; a graph made by `graph create` is invisible to it (make the graph from the app's "Create a new graph" dialog instead, then import into it). An import must own the graph's server: switch the app to another graph first, or it fails with `server-owned-by-other`. **After any import or long CLI session, run `logseq server stop --graph "<name>"` before opening the graph in the app** (`logseq server list` shows `owner-source`: `cli` or `ele`). A graph whose worker the CLI still owns opens in the app but is unusable with a real mouse (no unfold, no selection, no zoom); the fix is that stop, then View > Reload.
- **Never touch the graph named "Work."** Its name sits one row below the test graph in every list the CLI and the app print.

### Shell habits that saved time

- `tr -d` strips every listed character wherever it appears (it mangled a uuid containing `d`); extract uuids with `grep -o '[0-9a-f-]\{36\}'`.
- `grep -c` exits 1 when the count is 0, which ends an `&&` chain; put such counts last or outside the chain.
- Long-running imports go in the background with a waiter that stops on both the success line and `Failure|Error`; silence is not success.
- Keep a `PROGRESS.md` in the scratchpad while a long session runs: which fixes are committed, what the graph gained, what settings were changed and must be put back.
