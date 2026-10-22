# Closing layers 1 and 2: a full audit

A brief for an agent working in a fresh Claude Code session in `/Users/admin/logseq-plugin`. Written 2026-10-22,
at version 0.4.272.

The owner wants to be **done with layers 1 and 2**: the foundation (layer 1), and links and properties (layer 2).
Your job is to prove three things, fix what fails, and hand back a plain report:

1. **Separated:** each part does one job, talks to the others only through the agreed doors, and nothing from layers
   3 to 6 has crept in.
2. **Working:** every feature of the two layers does what the README says, in the real Logseq app, on the Illness Test
   Graph, in light and dark mode.
3. **Fast:** nothing the two layers do is slow enough to feel or to move the page, on the test graph and on the large
   scratch graph.

At the end, either the owner can say "layers 1 and 2 are done", or you hand them a short, ranked list of what is
still in the way.

---

## 0. Read first (do not skip)

- `CLAUDE.md`: the house rules, the layer plan and where things stand. Its rules override anything here.
- `GUIDE.md`: how the plugin is built, Logseq 2.0.2 quirks, the command line, the development loop.
- `README.md`: what every feature and setting is meant to do. This is your **spec** for "working".
- `docs/LOGBOOK.md` (newest first): the last two days of work, including mistakes made while testing.
- `docs/ALIKE.md`: the proposals' "looks like" engine, its stages and its scoreboard.
- `docs/BASELINE-2026-10-19.md`, `docs/TIMING-2026-10-19.md`: the speed baselines and how they were taken.
- `CHANGELOG.md`, last 40 lines: what was **seen on screen** and what was **only read** for each version.

## 1. House rules that bind you

- **The owner does not read code.** Never hand them a diff or code. Report in plain, short words, using Logseq's own
  terms: node, page, block, tag, property, child tag, capsule, row. No invented words.
- **Work on the Mac, in `/Users/admin/logseq-plugin`.** Commit and push from there. One change per commit. Each code
  change goes with:
  - the version bump, `sh tools/bump.sh 0.4.N`;
  - a CHANGELOG line saying what was seen on screen and what was only read;
  - a LOGBOOK entry;
  - CLAUDE.md's State line;
  - the README, when a feature or setting changes.

  The pre-commit hook checks this. Commit with
  `git -c user.name="ynmyz4hwr6" -c user.email="ynmyz4hwr6@privaterelay.appleid.com" commit`, ending the message
  with the Co-Authored-By line for your model.
- **Run `sh tools/check.sh` before every commit.** If a **speed** limit fails, time the previous version on the same
  Mac straight after, in a `git worktree` of `HEAD`, before blaming the change. On 2026-10-22 the Mac's load alone
  pushed the tag map test over its limit for both versions.
- **Test only in the "Illness Test Graph".** Undo every test edit and confirm it by query afterwards.
  - The owner uses the plugin on **their own graph** too. Never type, click or write there.
  - If Logseq has another graph open, **ask the owner** before switching graphs.
  - "Seed Check" and "Stress Check" are scratch graphs made with the command line. You may remove and remake them
    (CLAUDE.md section 6 says how).
  - Never delete a graph the app lists.
- **Check in the real app** with computer use, controlling **Logseq only**: no clipboard, no other apps. The owner
  said Claude may drive the test graph without asking (memory: "test graph free to drive").
- **Hard-won testing rules** (each one cost a mistake on 2026-10-22):
  - **Screenshot before your first click** and press Escape until nothing is open. A "Set Topic" list the owner left
    open took a stray click and wrote Topic and Provider onto a bullet.
  - **Leaving a bullet that shows proposals fills in the sure ones.** A click away, Down onto a hidden capsule, or
    the developer console taking the focus all count as leaving. Clear the proposals with Escape before leaving,
    and query every bullet you touched afterwards.
  - Opening the developer console (Cmd+Option+I) takes the keyboard from Logseq: an open list or Option-Enter
    stepping ends. Put the cursor in with `logseq.api.edit_block(uuid, { pos })` from the console instead of
    clicking. Close the console before pressing keys meant for Logseq.
  - The console's `const` names persist between commands, and it adds closing braces as you type. Wrap each command
    in `(() => { … })()`.
  - A capsule's ring may show only while the console is open (Logseq's own focus rules). Judge looks with the
    console closed.
- **Command line:** `~/.local/bin/logseq query -g "Illness Test Graph" -o json --query '…'` reads the graph while the
  app has it open. Do not import into the open test graph. After any command-line session on a graph the app will
  open, run `logseq server stop --graph "<name>"`.
- **Decisions are the owner's.** Fix what is plainly a bug, small and inside the spec. When a fix would change how
  something works or looks, or you are unsure whether it is wanted, **don't build it**: put it on the list for the
  owner with one recommendation and a concrete example from the test graph.

## 2. What is in each layer (the scope)

`main.js` loads `PART_FILES` in this order. `RESTING_FILES` are never loaded and are **out of scope**, except to check
that nothing loaded depends on them.

| Layer | Files | Job |
| --- | --- | --- |
| 1a engine | `main.js`, `loader.js`, `parts/shared.js` | loading, clean-up, watching the screen, the database round, settings, the shared kit (`.rf-pop`, `shared.modal`, `shared.undo`), warnings. Names no feature. |
| 1b model | `parts/model.js` | the only place that knows pages, blocks, tags, properties, journal days and links, and the **only** part that queries the database |
| 1 tools | `parts/diagnostics.js`, `parts/settings-panel.js` | the troubleshooting box (measuring, reports, warnings, Foundation only) and the settings window |
| 2 tag map | `parts/tags.js` | the tag and property map: tree, Properties view, groups, every edit in place, Turn into links to pages, drag and keys |
| 2 two-way | `parts/two-way.js` | rows on the pointed-at page, hover cards, filters, ticks and bulk actions, the + box, renaming how a row reads, hiding Logseq's tag lists where rows are drawn (this hiding belongs to layer 2, the owner's word) |
| 2 proposals | `parts/alike.js` (engine), `parts/shadow-rules.js` (rules, learning, reasons, `pickerOrder`), `parts/shadow.js` (while writing a bullet: drawing, writing, Undo, hiding empty properties), `parts/shadow-steps.js` (Option-Enter, Tab, Shift-Tab, Down, Left, Right through the properties), `parts/shadow-page.js` (a page's own properties) | proposals |
| 2 link text | `parts/link-text.js` | Cmd+Option+L, link selected text (or type the words first) |
| 2 pickers | `parts/picker.js` | in Logseq's own property list, what fits the bullet comes first |

Settings now loaded (22): `foundationOnly`, the troubleshooting and settings-window ones, `twoWayRows`, `twoWayNames`,
`twoWayOneEnd`, `twoWayHideTagLists`, `tagTreeEnabled`, `tagTreeOpensAs`, `tagTreeRoots`, `tagTreeShortcut`,
`tagTreeToolbarButton`, `propertyGroups`, `shadowProposals`, `shadowGraphs`, `shadowHideEmpty`, `linkText`,
`pickerFitsFirst`. Check the list against the code: `grep -n "key: '" parts/*.js`.

## 3. Part A: separation, read in the code

Answer each question with evidence (file and line), then **add a check to the tests** where one is missing, so the
answer stays true.

1. **Layer 1 names no feature.**
   - `main.js`, `shared.js` and `model.js` must not mention tags, two-way, proposals, pickers or link text by name,
     nor read their settings or their `window.refinement*` objects.
   - Each part registers itself (`window.refinementParts.push`) and offers what others may use through
     `core.provide(...)`.
2. **Only the model asks the database.**
   - `grep -nE "dsQuery|datascriptQuery|DB\.q\(" parts/*.js` should find only `model.js` among the loaded parts
     (58 hits there on 2026-10-22).
   - Writes (`logseq.Editor.*`) are allowed in features. List every write and confirm it is gated by the
     **Only in these graphs** setting (`shadowGraphs`) where the README says so.
3. **Parts talk only through agreed doors.**
   - The agreed doors:
     - `core.provided.*`;
     - the shared kit;
     - the proposals' shared object `window.refinementProposals` (its four files only);
     - read-only `window.refinement*Inner` objects that exist for tests.
   - Make a table, part by part: what each one publishes and what it reads from others.
   - Flag any part reading another's internals, any loaded part calling into a resting part, and any circular need.
4. **Each part can be left out.**
   - `tools/parts-apart-test.js` boots the plugin 14 ways. Run it, read it, and judge whether a pass means what it
     claims.
   - Extend it so leaving out a **feature** part also checks the remaining features still **do** something, not just
     start: two-way rows drawn, tag map opens, proposals shown. Use the existing pretend tests as the means.
   - The proposals' rules part is required by the others on purpose. That is fine, but it must say so (it does: one
     warning).
5. **No layer 3 or 5 has crept in.**
   - Read every stylesheet a loaded part sends: `sendStyle` and `logseq.provideStyle` in `main.js`, `two-way.js`,
     `tags.js`, `shadow.js`, `picker.js`, `link-text.js`, `settings-panel.js`, and `dialogCss` in `shared.js`.
   - For each rule, say whether it styles **only what the plugin draws** or **changes Logseq's own page**.
   - Changes to Logseq's own page allowed in layer 2:
     - hiding Logseq's tag lists where two-way rows are drawn;
     - hiding empty properties until something is proposed (`shadowHideEmpty`);
     - the proposals' grey values and dotted guesses;
     - the ring on the property being stepped through;
     - the pickers' CSS `order` and faint line.
   - Everything else that touches Logseq's page is a finding:
     - capsule backgrounds, link colours, sizes, spacing;
     - the scroll-bar room (commented out in `main.js`, keep it so);
     - anything the old `styles.js` did.
   - Note: on 2026-10-22 the owner's screen showed capsules drawn as boxes and links in blue. Find out whether that is
     the plugin or the owner's theme, and say which.
6. **Clean-up.**
   - After unload, nothing is left: no `data-refinement-*` or `rf-*` marks, no styles, no listeners, no timers, no
     Undo arrows.
   - `boot-test.js` checks marks and hooks. Add timers and window listeners if you can catch them in jsdom.
   - In the real app: reload three times in a row, then check the console for warnings and the page for leftovers.
7. **Duplication and dead code.**
   - `take()` is copied into several parts. Say whether it belongs in `shared.js`.
   - List functions, CSS and settings that nothing uses any more, for example `refinement-open-property-rows`,
     still sent empty.
   - Don't delete anything the README still promises.
8. **Size.**
   - `tags.js` is 2,339 lines and `two-way.js` 964. Say whether either has the same problem `shadow.js` had before
     its split (several jobs in one file).
   - Recommend a split, or say none is needed. Don't split without the owner's word.

## 4. Part B: does it work, in the real app

Setup:
- Open the Illness Test Graph, with the owner's go-ahead if another graph is open.
- Turn **Foundation only** off.
- Reload the plugin: in the console, `await LSPluginCore.reload('logseq-db-refinements')`.
- Confirm the version in the console:
  `LSPluginCore.registeredPlugins.get('logseq-db-refinements').options.version`.

Do every item in **light and dark mode**, and in the **right sidebar** where the feature exists there. For each one,
note **seen** (with what you saw), **failed** (what happened instead) or **could not check** (why).

Good places to look:
- Dr. Mei Chen: provider of, spoke with, decided by.
- The Consultation, Treatment and Expectation tag pages.
- Nausea and Tingling fingers: symptom logs under the title.
- Northgate Cancer Center.
- Oxaliplatin: agent of.
- The journal days Jul 30th, Aug 18th and Oct 20th to 21st.

### B1. Foundation (layer 1)
- Starts with no warning, and **Copy warnings** in the troubleshooting box is empty.
- Every item in the troubleshooting box works:
  - measuring on/off;
  - Copy performance report;
  - Check what the plugin finds on this page;
  - Copy warnings;
  - the tour.
- The settings window:
  - every setting of the two layers is there with its picture;
  - each change takes effect as the README says, live or after a reload.
- **Foundation only** on: only the foundation's two commands, nothing drawn. Then off again.
  - Open item: "Reload plugin" once got stuck in this mode. Try to reproduce it and say what happened.
- Changing graphs (to Demo and back) and changing pages leave nothing behind, and every Undo arrow goes on a page
  change.

### B2. Tag and property map
- Opens from the toolbar tree icon, Cmd+Option+G and the palette ("Tag tree"). The page and the right sidebar show the
  same.
- **Tags view:**
  - top level is every tag with no parent;
  - inherited properties faded with "from #Parent";
  - the kind boxes (TEXT, DATE, CHOICE, LINK, SEVERAL);
  - "Shows up here as …";
  - the small **i** guides.
- **Properties view:** every property once with its tags, and groups. Add, rename, move and remove a group; the order
  is kept in the setting.
- **Find box:** finds tags and properties.
- **Every edit in place, then undo it:**
  - rename a tag;
  - rename a property;
  - change what a link property accepts;
  - add, rename and remove a choice. Removing a used choice must be refused;
  - edit a description;
  - edit the two-way wording;
  - turn a row off on the other page;
  - "Turn into links to pages" on a scratch property you make yourself, then undo it all within the minute.
- The kind of value and "one vs several" open Logseq's own property settings in the sidebar.
- **Moving tags:**
  - drag before, after and inside;
  - Tab, Shift+Tab, Cmd+Shift+Up/Down;
  - the order is kept;
  - Undo works;
  - Logseq's frame does not scroll.
  - Put the tree back exactly as it was (`tagTreeRoots`).

### B3. Two-way rows
- On Dr. Mei Chen: "provider of → 4 Consultations · next Oct 29", "decided →" and the rest.
  - Rows appear **with** the page.
  - Reopening the page moves nothing.
  - Logseq's own Consultation list at the bottom is hidden.
- Pages without properties (Nausea) get the rows under the title.
- Long names show their first sentence; abbreviations like "Dr." don't cut it.
- **Wordings:** "agent used in", "… in" for past forms, no "of of". Right-click a row's name to rename how it reads,
  then put it back.
- **Hover card:** every piece is clickable and opens the right node or page.
- Filters by kind, the "earlier" divider, show all / show fewer, ⇥ to the right sidebar.
- **+ adds a linked node:** its Undo arrow takes it back.
- **Ticks:** tick two rows and try each action, undoing each:
  - sidebar;
  - point to ("Change “Dr. Mei Chen” to…");
  - unlink ("Remove “Dr. Mei Chen”");
  - tag;
  - copy;
  - set or unset a property;
  - delete.
- **Turned off per property:** only the rows go; the link and Linked references stay.
- Compare with the answer key: `node tools/two-way-check.js` (28 pages, 48 rows, 96 links on 2026-10-22).

### B4. Proposals while writing (`shadow*.js`, `alike.js`)
Write each case as a **new bullet on a journal day**. Look, then remove the bullet (`logseq.api.remove_block`), and
confirm by query.

- **A linked doctor in a consultation:**
  - write `Saw [[Dr. Raj Patel]] about the scan #Consultation`;
  - grey "Provider: Dr. Raj Patel", a dotted Topic guess, and the Date;
  - **Enter** fills all and makes the next bullet;
  - **a click away** fills only the sure ones;
  - **Escape** clears until the next edit;
  - **Cmd+Option+Enter** fills all with no new bullet;
  - **a click on a proposal** accepts that one.
- **The Undo arrow:** at the end of the bullet's line; takes everything back; stays until the bullet is edited or the
  page is left.
- **Pointing at a proposal** says why ("Named in your words", "Earlier bullets like this one had …").
- **An untagged bullet** like an earlier symptom log gets a dotted Tags pill. Enter gives the tag and fills its
  properties.
  - Also try `Spoke with Dr. Mei Chen about fatigue`, untagged. On 2026-10-21 it got nothing. Find out why, in
    words the owner can follow.
- **`[[Dr. New]]#Doctor` with no space:** the page is proposed for the doctor property; filling gives the page
  #Doctor and takes it off the bullet. Undo all of it, and delete the page you made.
- **Dates and numbers in the words:** "on Friday", "the 4th", "4 Aug" guess a Date; "cycle 5" guesses Cycle.
- **Choices:** Status is guessed from the bullets it looks like.
- **A page's own properties:** grey in its empty properties, a click fills one, and the arrow after the title takes
  it back.
- **Learning at once:** fill a value by hand, then write a near-identical bullet; the guess follows straight away.
- **Writes only in named graphs:** remove the test graph from **Only in these graphs**: nothing shown, nothing
  written, Option-Enter left to Logseq. Then put it back.
- **Empty properties hidden until something is proposed** (`shadowHideEmpty`); tag and property pages keep their
  empty rows.

### B5. Moving through a bullet's properties (new on 2026-10-22, seen only partly)
- **Option-Enter:** opens the first empty property or one holding a guess. A guess is typed in, selected.
  - Enter sets it and moves to the next empty one; the last Enter makes the next bullet.
  - Escape goes back to the words, proposals kept.
  - Option-Enter inside a list finishes the bullet.
- **Tab / Shift-Tab (0.4.270):** every property, filled or empty.
  - An empty one opens.
  - A filled one only gets the ring, and Enter opens it.
  - Tab past the last goes back to the words.
- **Down (0.4.271):** from the very end of the words, to the first property, even a hidden one. Down in the middle of
  the words stays Logseq's.
- **Left / Right (0.4.272, never seen in the app):** one property at a time, hidden ones included, stopping at the
  ends.
  - Reproduce the owner's case on a test-graph bullet with a filled, an empty and a filled capsule in a row: Right
    must reach the empty one.
- **The ring:** whole inside the capsule, round ends, light and dark. It also shows when Logseq's own keys put the
  keyboard on a capsule.
- **The kinds:** a date (its picker, "next fri" then Enter), a text value (passing an untouched one leaves no empty
  value behind), a number, and a property holding several (the list stays open).
- **Properties shown as rows of their own** (Notes) work too.
- **Seen only in pretend checks so far; try each in the app:**
  - going from one bullet's properties straight into another bullet with proposals;
  - a number property in Option-Enter;
  - the next bullet as first child when children show;
  - Enter between a link and its tag;
  - Undo after more words were written;
  - the bullet's own tag kept.

### B6. Link selected text and the pickers
- **Link selected text:**
  - select words, Cmd+Option+L: an empty page field, 520 px wide, the typed text clearly visible;
  - typing lists the pages that fit;
  - Enter links as if typed by hand, so Cmd+Z undoes it;
  - New page only when no page has the name.
  - With nothing selected: type the words, Enter, then the page.
  - Over a line break: a note, nothing written.
- **Pickers:**
  - in Logseq's own list for a property (Option-Enter or a click on an empty value), the nodes that fit the bullet
    come first, then a faint line, then Logseq's own list;
  - Up and Down follow the order shown, and the top row is the one Enter takes, also after typing;
  - the pointer moving over a row takes over.
  - Open item: does a property limited to a parent tag offer nodes of its child tags? Say which.
- **One Undo** (`shared.undo`): two changes keep two arrows. With nothing left on screen to sit beside, the arrow
  waits at the bottom right.

## 5. Part C: is it fast

- **Pretend graphs:** the timings in `tools/check.sh`:
  - model: 20,000 pages;
  - looks-like engine;
  - proposals stress: 20,000 random bullets, a 10,000-letter bullet, typing on a 50,000-line pretend graph;
  - tag map in Chromium: 600 tags, first drawing, redraws, 0 px moved.

  Record each against its limit, as the median of three runs. Note the Mac's load (`uptime`).
- **The large scratch graph:**
  - start its server: `logseq server start --graph "Stress Check"`;
  - run `GRAPH="Stress Check" OWNER=any node tools/shadow-check.js --timing --honest` (about 4 minutes; 31,000
    bullets);
  - then stop the server.

  Report:
  - the plugin's work per key, median and 95th percentile, tagged and untagged;
  - reading on start;
  - building the index.

  Morning of 2026-10-22, for comparison: per key, median 0.01 ms and 95th 8.7 ms tagged; median 0.36 ms and 95th
  22.6 ms untagged.
- **In the real app, on the test graph:** turn measuring on in the troubleshooting box, then:
  - open Dr. Mei Chen, the Consultation tag page, Oxaliplatin and a journal day, three times each;
  - write and remove three proposal bullets;
  - open the tag map and make one edit and its undo;
  - copy the performance report.
- **Page jumps:** in the console, a `PerformanceObserver` for `layout-shift` (sum the scores, log what moved) and a
  `MutationObserver` that timestamps when the plugin's elements appear. Remove both afterwards.
  - Opening a page with two-way rows must move nothing.
  - On first visits, say whether anything moves because of the plugin or because of Logseq.
  - The baseline: foundation only 0.077, whole old plugin 0.652.
- **Stepping keys feel instant:** Option-Enter, Tab, Down, Left and Right each show the next property within about
  100 ms (the watch runs every 100 ms, a list is waited for up to 600 ms). Say if anything feels slow.
- **Done for speed means:**
  - nothing the two layers do takes over 50 ms on a key in the test graph;
  - opening a page with two-way rows moves nothing;
  - every check.sh limit passes on a quiet Mac.

  If one fails, find which part costs the time (the performance report names it) and fix it, or put it on the list.

## 6. Part D: what to hand back

1. **Fixes**, one commit each, following section 1, each seen in the app where it can be. Say "seen" or "only read"
   in the CHANGELOG line.
2. **A report for the owner**, published as an Artifact page (load the `artifact-design` skill first), and its link
   in your last message. It holds:
   - **Verdict:** are layers 1 and 2 done? Yes, or "not yet, because …" in two sentences.
   - **Separated:** the part-by-part table of doors used, in plain words, and every finding.
   - **Working:** every item from section 4, marked seen, failed or could not check, with a one-line note.
   - **Fast:** the numbers against their limits, with the Mac's load.
   - **For the owner to decide:** at most five items. Each has one recommendation and an example from the test graph.
   - **Fixed on the way:** each fix in one line, with its version.
3. Update `CLAUDE.md`: section 3's layer list (layers 1 and 2 "done" only if the verdict is yes), section 7, and the
   State line. Update the feature map page
   (https://claude.ai/code/artifact/54c579a9-2986-45cb-8316-5858a5ee7ec1) if you can reach it. Otherwise say it is
   out of date.
4. Leave the graph as you found it:
   - every test bullet and page removed, confirmed by query;
   - `tagTreeRoots`, `propertyGroups` and the other settings back as they were. Save
     `~/.logseq/settings/logseq-db-refinements.json` aside at the start and compare at the end;
   - the scratch graphs' servers stopped.

## 7. How to talk to the owner

- Lead with the answer, in short, simple sentences. Give one example, from the test graph.
- No time estimates. Don't narrate the investigation.
- When something needs a decision, give one recommendation and the reason, not a menu.
- Say plainly what you saw on screen and what you could not check.
