# Handoff: Logseq DB Refinements plugin

Written 2026-10-11 for the next chat session. Read this first, then `README.md` for the feature list.

## What this is

A personal Logseq plugin (DB graphs only) that makes the UI say more clearly what things are:
quieter links, type cues on links and bullets, clearer properties, page-kind cues in titles.
The owner is not asking for new features so much as iterating on a visual vocabulary, one
small change at a time, looking at each result in the running app.

## Where everything is

| Thing | Location |
| --- | --- |
| Plugin (git repo, branch `main`) | `/Users/claude-agent/logseq-plugin/` |
| Plugin code | `main.js` (about 3,000 lines, one file), entry is `loader.js` |
| Test graph | Logseq graph named **Plugin Test Graph** (`~/logseq/graphs/Plugin Test Graph`) |
| Seed for the test graph | `test/plugin-test-graph.edn` (untracked, see "Uncommitted" below) |
| Live legend of every cue | page **Plugin Visual Cues** in the test graph |
| Logseq | `/Applications/Logseq.app`, version 2.0.2, DB version |
| Logseq CLI | `~/.local/bin/logseq` |
| Plugin settings file | `~/.logseq/settings/logseq-db-refinements.json` |
| Other graphs | `Demo` and `Work`. **Do not touch `Work`**; it is the owner's real graph. |

Git: two commits, `1324673` (0.2.96 baseline of `main.js`) and `595f068` (0.2.97, everything up
to and including the Cmd+T command). Commit after each change the owner confirms works.
No global git identity is set; commits were made with
`git -c user.name="ynmyz4hwr6" -c user.email="ynmyz4hwr6@privaterelay.appleid.com" commit ...`.

### Uncommitted

- `HANDOFF.md` (this file) and `test/plugin-test-graph.edn` are new and untracked. Commit them
  if the owner agrees.

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
| Link to a tag's own page | same underline, icon in grey (a grey `#` icon if the tag has none) |
| `#tag` on a block | bold, no underline |
| Link to a block (inline or whole row) | small dot in front, light dashed underline with wide gaps |
| Link to a task block | status/priority icons stand in for the dot, same dashed line under them |
| Date | grey box |
| Link to a PDF or image | blue icon in front, text with the page underline, not blue |
| Block with unfinished tasks or files below | trailing `↳`, dashed circle + count, file icons |
| Block properties | `name: value · name: value`, value slightly firmer, no capsule outline |
| Page property list | no second bullet beside the value |
| Page title row | page's tags sit beside the actions above the title; `#Page` on an untagged page, clickable to open Set Tags; properties triangle always visible |
| Tag page | "Inherited from #Media: keywords, rating, website" line under the title |

Rules agreed along the way: the bullet says what a row is, a mark before a link says what it
points to, anything after the text says what the block holds. The arrow symbol is no longer used.

### Things the owner tried and rejected (do not bring back)

- Square bullet / square before links for "tagged record".
- Bold, italic, a framed icon, or an underlined icon for links to tag pages.
- A `#` written into a tag page's title.
- Muted property names (removed back in 0.2.94).
- Showing `#Page` next to other tags.

## Open requests (start here)

The owner's last two requests were interrupted before any work was done:

1. **Inherited-properties line flickers on navigation.** After leaving a tag page, the
   "Inherited from …" line appears briefly on the next page, pushing content down, then
   disappears. Cause to check: `updateInheritedLine` uses `pageKind.inherited` from the previous
   page until `loadPageKind` finishes for the new one. `updateTitleTags` already guards against
   this by comparing `pageKind.pageUuid` with the title block's `blockid`; apply the same guard
   to the inherited line (and probably the alias line).
2. **Show the inherited line only when the tag page's properties are shown**, that is, when the
   title's triangle is expanded. Place it with the "Tag Properties" list rather than under the
   whole property area.

## Known loose ends

- Tag link with a custom tag icon in grey: only seen once, briefly; the owner changes icons often.
- The dot before a block link can sit apart from status icons; icons do not wrap with the text.
- `↳ ◌ n` task count repeats on every ancestor, and links to PDFs/images count as "files below".
  The owner has not said whether to change either.
- On the Journals list, a collapsed block with tasks showed no `↳` cue; not investigated.
- Title tags are positioned by measuring and a CSS transform; re-measured on resize. Watch for
  them sitting slightly off.
- The Cmd+T command only works on ordinary pages (it goes through the "Set property" button).
- `README.md` still has stale older paragraphs near the top (for example describing block
  references with `↳`); the accurate record is the "Version 0.2.97" list at the end.
- Logseq leftovers from setup: an `Unlinked graphs` folder under `~/logseq/graphs`, and CLI
  worker processes for `Demo` and the test graph.

## How the owner likes to work

- Short, concrete proposals; then just make the change and show it. They decide by looking.
- When asked "should we…", give one recommendation with the reason, not a menu.
- Say plainly what was verified on screen and what was not.
- They care about the page-versus-block and tag-versus-page distinctions most; those drove
  nearly every change this session.
