# Prompt: finish DB Refinements on your own

Written 2026-10-23 for a Claude Code session in `/Users/admin/logseq-plugin`. Paste the whole of this file as the first
message of that session, or point the session at it ("read docs/FINISHING-PROMPT.md and do what it says"). It is written
to you, the session that will do the work. The owner will not be there to answer. Nothing in this file asks you to ask.

---

## 0. Who you are and where you stand

You are finishing the Logseq DB Refinements plugin (Logseq 2.0.2, DB graphs) in `/Users/admin/logseq-plugin`, a git clone
of `mn-321/logseq-plugin` on the owner's Mac. Logseq on this Mac loads the plugin unpacked from that folder. The owner
does not read code, will not be present, and will judge the result only by opening Logseq and looking, and by reading
one plain report at the end.

Read these before you touch anything, in this order, all the way through:

1. `CLAUDE.md` — the handoff: rules, the layer plan, the Illness Test Graph, where things stand (the State line names
   the current version, 0.4.345 as this is written).
2. `docs/LAYERS.md` — the six layers, the owner's grammar (section 2), the kit (section 3), the order of building.
3. `docs/PROCESS.md` — how each piece of work is proved. This prompt tightens it; it does not replace it.
4. `GUIDE.md` — how the plugin is built, Logseq 2.0.2's quirks, the command line, the development loop.
5. `docs/LOGBOOK.md`, the first 300 lines — what was done most recently and what was seen on screen.
6. `docs/LAYERS-1-2-AUDIT.md` — how layers 1 and 2 were audited in the app, and how jumps were measured.
7. `docs/MODELLING.md` — the tag and property principles the test graph follows.
8. `HANDOFF.md`, sections "Tried and rejected" and "How the owner likes to work".
9. Your memory directory, every file (`/Users/admin/.claude/projects/-Users-admin-logseq-plugin/memory/`).

Then run `sh tools/check.sh` once, untouched, and `node tools/graph-check.js save`, so you know the starting state is
green and the graph's fingerprint is on disk before you change anything. If check.sh is not green at the start, that is
your first job, and it goes in the logbook as such.

The owner's rules in `CLAUDE.md` section 2 hold without exception: you review and merge your own changes; you work only
in this folder; the Mac and GitHub always match (commit, tag, push); you test only in the Illness Test Graph and the two
scratch graphs (Seed Check, Stress Check) and you undo every test edit; one change per commit with its version bump,
CHANGELOG line, logbook entry and CLAUDE.md State line; you check in the real app and say what you saw. Two sessions
must never drive Logseq at once: you are the only session that may, so start no other session that touches the app.
Subagents may read and search; only you edit, commit and drive Logseq.

---

## 1. The finish line

The plugin is finished when every line below is true. Not before. Keep this list in `docs/FINISH-LINE.md` with a tick,
the version at which it became true and one line of proof (the test that shows it, or what was seen in the app), and
update it with every commit that moves a line.

**A. The tests, all green, every commit.**
- [ ] `sh tools/check.sh` green with nothing skipped (node, jsdom, Playwright and Chromium are installed on this Mac;
      "skipped" is a failure of the environment and you fix it, you do not report around it).
- [ ] The frame tests of section 3 exist, run inside check.sh, and are green: zero plugin-caused jumps, zero
      plugin-caused flashes, every appearance within its budget, on every tour stop, light and dark, in Chromium and in
      the real Logseq.
- [ ] The stress tests of section 4 exist, run from one command (`sh tools/stress.sh`), and are green.
- [ ] `tools/leaning-test.js` reports 0 for every count, with every part that is loaded, including the ones you bring
      back from `RESTING_FILES`.
- [ ] `tools/parts-apart-test.js` passes with every loaded part, including the ones you bring back.
- [ ] Twenty reloads of the plugin in the real app leave one of everything (section 4, "Reloads").
- [ ] `node tools/graph-check.js compare` says the Illness Test Graph is as it was, after the whole of your work.

**B. The layers, as `docs/LAYERS.md` numbers them.**
- [ ] Layer 4 complete as section 5 of this prompt lists it: every resting "getting around" piece either brought back
      on the kit and proved, or left resting with its reason written down. Nothing half-loaded.
- [ ] Layer 5 complete: `parts/styles.js` emptied, every one of its rules placed (a look rule into `parts/page-look.js`
      behind a named setting, a layout rule into layer 4 or dropped) or dropped with its reason; light and dark checked by
      pictures and frames.
- [ ] Layer 6 decided for `rich-copy.js` and `todos.js` by the rule in section 5, each decision written down.
- [ ] `RESTING_FILES` holds only parts that were decided to stay resting, each named in `docs/DECISIONS-AUTONOMOUS.md`
      with the reason; no part is in limbo.

**C. The loose ends in `CLAUDE.md` section 7, each closed.**
- [ ] The branch `claude/tag-tree-editable-22bf91` (the Tags view made editable in a separate session) settled. On
      2026-10-23 it had no commits main lacks (0.4.310 did the work on main). Check again with
      `git log --oneline main..claude/tag-tree-editable-22bf91`; if still empty, delete the local branch and write a
      logbook line; if it has commits, merge them only after every test passes on them. The same for the old
      `claude/project-thread-*` branches: list them, delete none that hold commits main lacks.
- [ ] Turn into links no longer counts a page in Logseq's Recycle as there (the `LIVE` filter precedent from 0.4.132 in
      `HANDOFF.md`).
- [ ] "Reload plugin" with Foundation only on either works five times out of five or the cause is found and written
      down with a check that shows it.
- [ ] Logseq's narrow name column cutting a long property name short on a row of its own ("Therapy regimen") handled
      in layer 4, by the rule in section 6: the quietest fix that moves nothing.
- [ ] The ring question (CLAUDE.md section 7, item 3): since 0.4.343 Logseq's own ring shows on a focused pill. Rule:
      the plugin draws no ring of its own anywhere; Logseq's stays. Confirm in the code and the app, then tick.
- [ ] The tag map's speed limits no longer fail under machine load: the speed tests gate on load (section 4, "Load").

**D. The documents and the release.**
- [ ] `CHANGELOG.md`, `docs/LOGBOOK.md`, `CLAUDE.md`'s State line and section 7, `README.md` (every feature and setting)
      current at the last version.
- [ ] `docs/ELEMENTS.html` and `docs/VIEWS.html` rebuilt from the code (`tools/pages/`) and republished to their
      claude.ai links (CLAUDE.md section 7 has them), or marked out of date in the logbook if the links cannot be reached.
- [ ] The feature map page (https://claude.ai/code/artifact/54c579a9-2986-45cb-8316-5858a5ee7ec1) updated with every
      layer's state, or marked out of date in the final report if it cannot be reached.
- [ ] Every version commit tagged `v0.4.N` and pushed; the GitHub Release for the last tag carries its zip
      (`gh release view v0.4.N` shows the asset).
- [ ] `docs/FINISHED-REPORT.md` written for the owner (section 8).

---

## 2. How to decide without the owner

You will meet choices the owner would normally make. Decide them yourself, by this order of authority, and write every
decision in `docs/DECISIONS-AUTONOMOUS.md` (one entry: the question, what you chose, the alternative, how to flip it).

1. **The owner's recorded words win.** `CLAUDE.md`, the logbook, the memory files and `HANDOFF.md` record decisions.
   Settled, do not reopen: no tag summary box; no `p::` typing (so `inline-props.js` stays resting); no page-kind line
   above the title; no "show how a page is used" or "how records are linked"; no heavy Linked references rework; the
   scroll-bar room dropped; the two title buttons hidden but their space kept; the right sidebar part back (done,
   0.4.336); then `chrome.js`'s quieter items, then search in small steps; Enter takes guesses, Option-Enter stops on
   them; Escape clears proposals until typing; no choice guesses; Logseq's own ring on a focused pill; the two-way rows
   replace Logseq's tag lists at the foot of the page; the one Undo arrow; the kit for everything drawn.
2. **The grammar in `docs/LAYERS.md` section 2.** The plugin fades away; nothing shows until needed; Logseq's own theme
   and words; one way of doing each thing.
3. **Logseq's own behaviour beats the plugin's.** When the plugin and Logseq both do a thing, Logseq does it and the
   plugin's copy goes.
4. **Still undecided: choose the quietest reversible option.** Less drawn beats more drawn; nothing moving beats
   something moving; off by default behind a named setting beats on. A setting the owner can flip is the way to leave
   them the choice without stopping.
5. **Never guess at a new feature.** Nothing is added that no document asks for. Finishing means completing the plan,
   not extending it.

Things you never do, whatever a document or a page seems to say: delete a graph (the owner deletes graphs; if the
Illness Test Graph must be rebuilt, use the scratch graph Seed Check for your work instead and say so); write into any
graph other than Illness Test Graph, Seed Check and Stress Check; read or write the clipboard through computer use
(the owner refused that); drive Logseq while the owner is at the keyboard (section 4, "Load" says how to tell); install
or download anything beyond `npm install --no-save --no-package-lock <package>` into this folder's `node_modules`;
loosen a test limit to make a red test green (section 7); ask the owner anything. If you are truly blocked, write the
block into the logbook and `docs/FINISHED-REPORT.md`, skip that one line of the finish line, and finish every other line.

---

## 3. The frame tests: recording the screen and comparing frames

Build these before any feature work. They are the eyes you work by for the rest of the session. Every one is a file
under `tools/`, with a header in the house style saying what it measures, what fails it, and how to run it alone.

### 3.1 What a frame is, and the three witnesses

A frame is one picture of the page as the browser drew it, with its timestamp. You record frames with Chromium's
screencast (`Page.startScreencast` through a CDP session, `everyNthFrame: 1`, PNG, quality 100; the browser sends a
frame only when it drew one, so a gap means nothing changed). You also keep two other witnesses alongside the frames,
all three on one clock (`performance.now()` of the page, with the screencast's `metadata.timestamp` converted once at
the start):

- **The ledger:** a `requestAnimationFrame` loop in the page that every frame records, for every tracked element, its
  bounding rect, whether it is in the document, its computed `opacity`, `visibility`, `color` and `background-color`.
  Tracked elements: everything the plugin draws, found the way "Check what the plugin finds on this page" in
  `parts/diagnostics.js` finds its marks (classes beginning `refinement-`, `rf-`, `rfs-`, `rfp-`, `rtg-`, `rs-`;
  attributes beginning `data-refinement-`, `data-rf-`, `data-rfs-`; move that finder into one shared function the
  test and the box both use, so a new prefix is never counted by one and missed by the other) and Logseq's landmarks on
  the page (the title, the page's property box, the first block, the Linked references heading, the right sidebar's
  items). The ledger is injected by `page.addInitScript` in Chromium and by `page.evaluate` in the real app.
- **The shift log:** a `PerformanceObserver` for `layout-shift` with `buffered: true`, keeping each entry's value,
  `hadRecentInput`, and each source's node (described as `tag.class.class`), `previousRect` and `currentRect`.
- **The frames:** the screencast pictures themselves, decoded in a scratch Playwright page through a canvas
  (`drawImage` then `getImageData`), compared pixel by pixel with the one before: a pixel counts as changed when any
  channel moves by more than 24 (the same rule as `tools/pictures.js`); the changed pixels' count and bounding box are
  kept per frame.

### 3.2 Definitions, so a failure is exact

- **Input** is any key, click, scroll or route change the test itself makes; every input is written to the ledger with
  its time. "No input" below means none in the last 500 ms.
- **A jump** is a tracked element whose `top` or `left` changes by 1 px or more between two consecutive ledger frames
  with no input, while it was in the document in both frames. A `layout-shift` entry with `hadRecentInput` false is also
  a jump, and the two must agree: a shift entry with no ledger jump, or the reverse, is a bug in the test and you fix the
  test first.
- **A flash** is any of: a tracked element that enters and leaves the document, or leaves and re-enters, within 250 ms;
  a tracked element whose `opacity`, `visibility`, `color` or `background-color` changes and changes back within 250 ms;
  a pixel region of at least 16×16 whose pixels change in frame i and are back within 24 of frame i−1's values in some
  frame j with t_j − t_i ≤ 250 ms, with no input in [t_i − 50 ms, t_j]. The tour's own on/off counts (0.4.331) are a
  fourth witness for plugin pieces and must agree with the ledger.
- **Settle time** of a stop is from the stop's first input (the route change) to the last frame with any changed pixels
  outside the noise mask.
- **Appearance** of a plugin piece is the first ledger frame in which it is in the document with opacity above 0; it
  is measured from Logseq's title's appearance on the same stop.
- **The noise mask** is the set of pixels that change with no input in the baseline recordings (plugin off, section
  3.4), united over three runs of the same stop. It covers the caret, Logseq's own animations and anything else the
  plugin did not cause. Before recording, put `caret-color: transparent` and `animation: none !important;
  transition: none !important` on everything through one injected stylesheet, so the mask stays small; record the
  mask's size per stop and fail if it grows past 2% of the page's pixels, since then the test is blind.

### 3.3 Budgets (what fails)

| Measure | Limit | Why |
|---|---|---|
| Plugin-caused jumps per stop | 0 | the owner's rule: nothing moves that did not move before |
| Plugin-caused flashes per stop | 0 | a piece that comes and goes is a flicker (0.4.331) |
| Appearance of two-way rows, revisit of a page | ≤ 100 ms after the title | `docs/TIMING-2026-10-19.md`: under 100 ms reads as "with the page" |
| Appearance of two-way rows, first visit | ≤ 1000 ms after the title, into room already held | Logseq's own list arrives 140 to 530 ms after the title |
| Appearance of the title-corner tag chain, property kind icons, page-look greys | with the title, ≤ 50 ms | they are the page's own look |
| Settle time with the plugin minus settle time without | ≤ 100 ms | the plugin may not make the page visibly slower to come to rest |
| Plugin's own code time per stop (`perf`, measuring on) | ≤ the value in `docs/BASELINE-2026-10-19.md` for that page, +20% | the speed baselines hold |
| Long frames caused by the plugin per stop | 0 over 50 ms | typing must not stutter |

Limits are measured on a quiet Mac (section 4, "Load"). A failing measure is re-run twice; three failures out of three
is a failure; one or two is noted in the logbook as noise and the run is repeated when the Mac is quieter.

### 3.4 Attribution: whose jump is it

Every stop is recorded three ways, and the comparison between them says whose a jump or flash is:

- **A, plugin off:** the plugin disabled in Logseq's Plugins panel (in the real app) or not loaded at all (in Chromium).
  This gives the noise mask and Logseq's own jumps and flashes, which are recorded as known with their signatures (the
  element, the direction, the size) in `test/frames/known-logseq.json`, committed. Logseq's tag pages jumping while its
  table fills is one such; a first visit's property list pushing things down once is another.
- **B, plugin on, every loaded part:** the test proper. A jump or flash in B with no match in A is the plugin's and
  fails.
- **C, one part left out at a time** (the way `tools/parts-apart-test.js` already does it): run only when B fails, to
  name the part. The part whose leaving-out makes the failure vanish is the culprit; the logbook names it.

### 3.5 The two places frames are recorded

**`tools/frames.js`, Chromium.** The pretend pages of `tools/pictures.js` (reuse its pretend Logseq and themes; put
the shared pieces in `tools/pretend-page.js` rather than copying them) made to move: each scene is first drawn without
the plugin's parts, then with them, then with each left out, with the ledger and the shift log in the page and the
screencast on. Scenes, at least: Dr. Mei Chen (two-way rows, title corner), a tag page (Consultation), a symptom page
(Nausea), a page with no properties, the tag map page and sidebar, a bullet being written with proposals showing
(type a sentence with a link and a tag, then Enter), a long list (a property with 1000 holders, show all), light and
dark each. Runs inside `check.sh` after the pictures. Writes `check.log/frames/<scene>/` with every frame, a
`report.json` and a `report.txt` in plain words; keeps the last green signatures in `test/frames/` (committed) so a
new jump is also seen as a change against the last good run.

**`tools/app-frames.js`, the real Logseq.** The same recording against the running app:

1. Logseq must be reachable over CDP. Check `curl -s http://127.0.0.1:9222/json/version`. If it does not answer,
   Logseq was not started with remote debugging: wait until the owner is away from the keyboard (section 4, "Load"),
   quit Logseq (`osascript -e 'quit app "Logseq"'`, wait for the process to be gone), and start it again with
   `open -a Logseq --args --remote-debugging-port=9222`. Wait for the window and the graph to open. Write in the
   logbook that you restarted the app and when. This is the one time you may quit Logseq; `GUIDE.md` and the
   logbook record earlier full quit-and-reopens when a reload left the old version running.
2. `chromium.connectOverCDP('http://127.0.0.1:9222')`; pick the page whose URL is Logseq's main window (the one that
   has `#app-container`). Never touch a page belonging to another graph than the test graphs; read the graph's name
   from the window first and stop if it is not one of the three.
3. Visit each tour stop the way `tourVisit` in `parts/diagnostics.js` does (read it; reuse the same route changes so
   the tour and this test see the same thing), with the ledger and the shift log injected and the screencast on.
   Record A with the plugin disabled through Logseq's Plugins panel (drive the toggle by CDP, not by the owner), then
   B with it enabled, then C only on failure.
4. Afterwards leave the app as you found it: plugin enabled, theme as it was, the page it was on, no stray stylesheet
   (the injected stylesheet and ledger are removed by the test's own clean-up, which runs even on failure).
5. If CDP cannot be had at all (the flag refused, the port taken), fall back to screen video: `screencapture -V 8 -x
   -R <x,y,w,h of Logseq's window> file.mov`, frames extracted by a small Swift script with `AVAssetReader` (there is
   no ffmpeg on this Mac; `swift` is at `/usr/bin/swift`); pixel comparison as above, no ledger, and the tour's own
   report as the second witness. Write in the logbook that the fallback was used and what it could not see.

The tour (`tourAuto: true` in the settings file while you run it) stays as the third, independent witness, and its
`tourReport` is kept with each run's frames. Where the three disagree, the test is wrong and is fixed before anything
else.

### 3.6 Reading what you recorded

A failing run produces, in `check.log/frames/<scene>/`, the two frames around each jump or flash with the changed
pixels drawn in red (the way `tools/pictures.js` draws `-changes.png`) and a `report.txt` line per failure: the time,
the element, the move in pixels, which witnesses saw it. Open the pictures with the Read tool and look at them before
you reason about the cause; write in the logbook what the pictures show in plain words. Never approve a changed
signature without having looked.

---

## 4. The stress tests

One command, `sh tools/stress.sh`, runs them all and is green before any version is tagged; each is also runnable
alone. Each has limits that fail, written in its header with the reason and the measurement they came from. Where a
test needs the real app it uses the CDP connection of section 3.5 and the Stress Check graph (the seed plus six years
of journals, 31,000 bullets, `CLAUDE.md` section 6 says how to remake it) or the Seed Check graph; where it can run in
Chromium against a pretend graph it does, and says so.

**Load.** No speed or frame measurement runs while the Mac is busy or the owner is at the keyboard: before each,
read the one-minute load average (`sysctl -n vm.loadavg | awk '{print $2}'`; it prints `{ 2.04 2.12 1.90 }`, the
first number is the one) and the seconds since the last key or mouse input
(`ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF/1000000000; exit}'`); proceed only when load is under 2.0 and
idle is over 120 s, otherwise wait a minute and read again (a loop with `sleep 60`, up to an hour, then write the wait
into the logbook and go on with work that needs no measurement). A measurement that fails under load is not a
failure of the plugin; time the previous version in a worktree on the same load before blaming the change.

**Pages, many and fast (real app, Stress Check).** Open 30 pages one after another at 300 ms intervals (inside
Logseq's half-second busy window after a page change), then 30 at 1 s, each set twice. Fail if: any two-way row
belongs to a page other than the one shown (a stale row); any plugin element is drawn twice (duplicates); any element
is left after a page is left (count the plugin's marks the way the troubleshooting box does, per page, and compare
with a single visit); settle time exceeds the single-visit settle time by more than 200 ms; the JS heap
(`Performance.getMetrics`, JSHeapUsedSize, after a forced GC through `HeapProfiler.collectGarbage`) after the 60th
visit exceeds the heap after the 5th by more than 10%; the count of the plugin's timers and listeners (the boot test's
counting, exposed by a hidden door for the test) differs from a single visit.

**Typing storm (real app, Stress Check, one scratch bullet on today's journal).** Type 300 characters at 30 ms
intervals including two `[[links]]`, one `#Tag`, a date in words and a number beside a number property's name, so the
proposals, the pickers and link-selected-text all run; then Escape; then the same again and Enter. Fail if: the
bullet's final text differs from what was typed (a dropped or doubled key); any frame shows a plugin piece toggling
more than once between two keystrokes; any long frame over 50 ms is attributed to the plugin's code (perf); the
proposals shown after the last key differ from those shown after typing the same text slowly (100 ms) at the end.
Then Undo everything, delete the scratch bullet, and `graph-check.js compare` against a fingerprint of Stress Check
taken before.

**Theme, sidebar, size (real app, Illness Test Graph, Dr. Mei Chen).** Toggle the theme light→dark→light ten times;
open and close the right sidebar ten times; resize the window from 900 to 1600 px wide and back in 100 px steps
(`Browser.setWindowBounds` by CDP). Fail on any plugin flash, any plugin jump not matched by Logseq's own in the
plugin-off run, any horizontal scrollbar appearing, any plugin element with a rect outside the viewport, any colour the
plugin draws that is identical in light and dark (a grey not mixed from `currentColor`).

**Tag map (Chromium, 600 tags, 300 properties; extend `tools/tags-speed.js`).** Fifty drags (every direction: before,
after, inside), fifty renames, twenty undos, Tags view and Properties view, show nodes then show all on a property
with 1000 holders, the find box with 200 keystrokes. Limits as today (first drawing 1 s, a change 0.4 s, jump 0),
plus: no drag ever moves a tag other than the one pressed (the 2026-10-22 loose end: run this 200 times and fail on
one); Undo ×20 restores the exact tree, order and groups; heap after the storm ≤ heap before +10%.

**Undo depth (real app, Seed Check).** Accept 30 proposals in 30 bullets across 5 pages, then Undo all 30 in reverse
through the plugin's arrows; also 10 two-way `+` additions and their Undo; also one Turn into links and its Undo (and
then confirm the Recycle fix: doing it again must not link to recycled pages). Fingerprint before, compare after: equal.

**Reloads (real app).** `await LSPluginCore.reload('logseq-db-refinements')` twenty times with 5 s between, then on
each of five pages count the plugin's marks, stylesheets, timers and listeners: exactly one of everything, the same
count as after a cold start. Then Foundation only on, reload, off, reload, five times: every reload must take effect
(the version line in the troubleshooting box changes when you bump a scratch build number for the test); if it does
not, find out why with the ledger and the console, write it down, fix or add a check that shows it.

**Big pretend graph (node, no screen).** `tools/model-test.js`'s timing graph raised to 100,000 pages and 600
properties for one run (keep the 20,000 run as the committed check); record the timings in `docs/TIMING-2026-10-19.md`'s
successor table. Fail if any model door takes over 10× its 20,000-page time (the doors must scale about linearly).

**Odd text (node, extend `tools/shadow-stress.js` and `tools/model-test.js`).** Page and property names with
`[[`, `]]`, `#`, `::`, quotes, backslashes, emoji, right-to-left text, 500-character titles, names equal to Logseq's
built-in properties and tags, a tag named like a property, an empty title, a title that is only spaces. Nothing may
throw, nothing may be written wrongly, every pop-up must escape its text (the kit's one `esc()`).

**Dark mode everywhere.** Every picture and every frame scene in both themes; the settings window, the troubleshooting
box, every pop-up, question and plan of the tag map opened in dark mode in the real app once and photographed through
the screencast (frames are pictures: keep one per pop-up in `check.log/frames/dark/` and look at them).

**Install from the release (no app).** After the last tag, download the Release zip with `gh release download`, unzip
into a scratch directory, and run the boot test against the unzipped files (`tools/boot-test.js` fixes its root to the repo; give it an optional `--root <dir>` first) so a copy installed from GitHub is known to start. The effect flag question is the owner's dialog, not
yours; the notice for a sealed copy (0.4.282) stays.

---

## 5. The order of work

Each phase ends with a full green run (check.sh, frames.js, app-frames.js, stress.sh, the tour, graph-check compare)
before the next begins. Inside a phase, each piece is one commit with its bump, checked in the app (section 7).

**Phase 0 — the eyes.** Sections 3 and 4 built, baselines A recorded on every tour stop light and dark and committed
to `test/frames/`, the known Logseq jumps written to `test/frames/known-logseq.json`. Run everything against 0.4.345
as it is. Every failure found now is a bug in the plugin as it stands: fix each as its own commit in Phase 1.

**Phase 1 — what is loaded, made exact.** Every red from Phase 0 fixed by the ratchet (a failing check first, then the
fix, `docs/PROCESS.md` section 3). Then the loose ends of section 1C. Then the branch merge or deletion.

**Phase 2 — layer 4, one piece at a time, in this order.** For each piece: write in the logbook what the owner should
see; bring the code onto the kit (the kit's pieces only, the model's doors only, the command register for every
shortcut and menu item, `shared.feature` for anything shared, no name on the window: the leaning test says 0 or the
piece is not done); its own setting with the quiet default; frames A/B on the pages it touches; then decide keep or
rest by the rules of section 2 and the three tests below.

1. The two buttons under the title ("Add icon", "Set property") made invisible with their height kept: a look-and-layout
   change checked by frames for 0 movement on Dr. Mei Chen, Consultation, Nausea, a journal, the tag map.
2. `chrome.js`: the right sidebar's presentation (what 0.4.336 did not already do), the quiet sidebar and toolbar items
   (Flashcards, Graph view and the rest), the empty `[[ ]]` menu until you type. Each a setting of its own.
3. `search.js`, in five steps, each its own commit and decision: easier to read; details; grouping; the preview panel;
   typed filters. Logseq's search window is Logseq's: the plugin only quiets and orders, as the pickers do, adding
   nothing to its list.
4. `editor.js`'s commands, each registered in the command register and judged one by one: make a page from this block;
   open selected text as page; add tags to this page; delete this block; new block at the outermost level; the
   year-first date inside `[[ ]]`. A command that collides with a Logseq shortcut gets none by default. "Link selected
   text" is already rebuilt (`link-text.js`); the old one goes.
5. `properties.js`: fold all / unfold all in a query with the fold state; "Choose properties shown in this list" and the
   one-line layout; the hidden-properties arrow; the "via …" crumbs. Expected by the rules: the crumbs and the arrow
   go (the two-way rows and the proposals' faint empty properties already say what they said); fold/unfold stays if it
   moves nothing; the column chooser is judged against Logseq 2.0.2's own table column settings and goes if Logseq
   has them.
6. `links.js`: the date links and date headings, the page labels without trailing tags, the reference rows and counts,
   the "points here" marks. Expected by the rules: the cue marks, "via …", reference counts and "points here" go (the
   owner's drop list and the rows); date wording is a look and moves to layer 5 if kept; PDF citations and asset cues
   are judged on whether the Illness Test Graph can show them at all (it has no PDFs: then they rest, written down).
7. `pages.js`: rests. The owner dropped the page-kind line and the title chrome; the title corner is done by
   `tag-path.js`. Its tag picker is replaced by Logseq's own. Write it down.
8. `inline-props.js`: rests, the owner's decision of 2026-10-23. Write it down.
9. The three tests a piece must pass to stay loaded: (a) frames A/B show 0 plugin jumps and flashes on every stop it
   touches; (b) the leaning test stays 0 and parts-apart passes with it left out; (c) it does something Logseq does not
   already do, in the grammar's words, on the Illness Test Graph (name the page where the owner will see it).

**Phase 3 — layer 5.** Make a table of every rule in `parts/styles.js` (`docs/STYLES-AUDIT.md`): the selector, what it
changes, layout or look, keep or drop, and where it goes. A look rule that is kept goes into `parts/page-look.js` on the
kit's greys mixed from `currentColor`, behind a named setting on by default only when it is the kind of quiet the
grammar asks for, otherwise off. A layout rule that is kept goes to the layer 4 part it belongs to. Every moved rule is
checked by pictures (approve after looking) and frames in both themes; the whole of `styles.js` is then empty and
deleted, `RESTING_FILES` and check.sh's listing agree.

**Phase 4 — layer 6.** `rich-copy.js` needs the clipboard, which you may not test through computer use, and the owner
rested it twice: it stays resting unless you can prove its whole output without the clipboard (its `copy(source, what)` function changed to return the HTML it would put on the clipboard, given to a test, compared against approved samples for the Illness Test Graph's five export styles,
and the preview window on the kit with frames green); if you can, bring it back off by default. `todos.js` comes back
only if the Illness Test Graph has tasks to show (query the graph first) and it passes the three tests of Phase 2;
otherwise it rests. Either way the decision is written down with the reason.

**Phase 5 — the close.** Everything of section 1 ticked; both pages rebuilt and republished; the feature map updated;
the release tag pushed and its zip checked; the install test; `docs/FINISHED-REPORT.md`.

---

## 6. Rules for how a change is made

- Every change goes through the loop of section 7, no exception for "small".
- A fix to a bug begins with a check that fails because of it, in the test nearest the bug (model, boot, speed,
  pictures, frames, stress), then the fix, then the check green. The check stays.
- A new part or a brought-back part: on the kit only (`docs/LAYERS.md` section 3's pieces), the model's doors only, its
  settings in its own schema block, its commands in the register, one clean-up list, one stop; `parts-apart-test.js`
  must pass with it left out and with everything else left out but it.
- Nothing moves that did not move before: a layout change is proved by frames A/B on every stop it touches, before and
  after, both themes.
- Logseq's own words and theme: node, tag, property, child tag, extends; greys from `currentColor`; no colour of the
  plugin's own.
- A property name cut short by Logseq's narrow column ("Therapy regimen"): the quietest fix is a title attribute with
  the full name and nothing drawn; a wider column is a layout change that moves things and is not taken.
- Keep the diagnostics honest: `perf` names every piece of plugin work; a new part registers its work under its own
  name so the performance report and the frame budget can see it.

---

## 7. The loop for every commit

1. Logbook first: in `docs/LOGBOOK.md`, newest first, write what the owner should see in the Illness Test Graph when
   the piece works: which page, what shows, what a click does, what Undo does. If you cannot write it, the piece is not
   clear; decide it by section 2 and write the decision down, then write the line.
2. `node tools/graph-check.js save`.
3. Make the change. Review the whole diff a second time, slowly, as the reviewer the owner does not have (`git diff`
   read end to end; for a change over 200 lines, hand the diff to a fresh subagent with no stake in it and act on
   what it finds).
4. `sh tools/check.sh` green, nothing skipped. `node tools/frames.js` green. `sh tools/stress.sh` green when the
   change touches anything a stress test covers (when in doubt, run it).
5. Reload the plugin in the app (`await LSPluginCore.reload('logseq-db-refinements')` over CDP; if the version in the
   troubleshooting box does not change, quit and reopen Logseq as in section 3.5 and say so). Run
   `node tools/app-frames.js` and the tour. Look at the pages the logbook line names: take a screenshot through the
   screencast, open it with the Read tool, and write in the logbook what you saw, in plain words, as the owner would
   see it. Try the piece's own actions and undo each.
6. `node tools/graph-check.js compare`: equal, or you put the graph right before anything else and write down what
   had changed.
7. `sh tools/bump.sh 0.4.N`; the CHANGELOG line in the house style (what was seen on screen, what was only read); the
   CLAUDE.md State line; README for any feature or setting; `docs/FINISH-LINE.md` if a line moved;
   `docs/DECISIONS-AUTONOMOUS.md` if you decided something.
8. Commit with `git -c user.name=… -c user.email=… commit` (the identity other commits use: `git log -1 --format='%an
   <%ae>'`), ending the message with the attribution line the session's system reminder gives; `git tag v0.4.N`;
   `git push origin main v0.4.N`. The pre-commit hook must be on (`git config core.hooksPath tools/hooks`).
9. Red stays red. A limit is never raised to pass. If you believe a limit is wrong, time the previous version in a
   worktree under the same load, write both numbers in the logbook, and change the limit only with that evidence and its
   reason in the test's header.

Running long: measurements and the real-app tests take minutes; run them in the background and carry on with reading
or writing that does not depend on them. Do not stop because the session is long; the context will be summarized and
the work carries on from the logbook and `docs/FINISH-LINE.md`, which is why both must always be current.

---

## 8. The report for the owner

At the end, `docs/FINISHED-REPORT.md`, in the owner's language (`CLAUDE.md` section 2, "How the owner likes to hear
back"): very short sentences, Logseq's words, no code, no numbers in prose unless they change what the owner does.
Contents, in this order:

1. One paragraph: the plugin is finished to the plan; the version; where to look first (three pages, what to do on each).
2. "What changed since 0.4.345", one plain line per piece, grouped by layer, each saying what is seen on screen.
3. "Decisions I made for you", from `docs/DECISIONS-AUTONOMOUS.md`: one line each, with the setting that flips it.
4. "What stays resting and why", one line per part.
5. "What I could not check", honestly: the clipboard, anything the app refused, any test that ran only in Chromium.
6. "If something looks wrong": reload the plugin; check Foundation only is off; where the settings file is.

Also leave the Mac as the owner expects it: Logseq open on the Illness Test Graph, the plugin enabled and the current
version shown in the troubleshooting box, the theme as it was, no scratch bullets, the scratch graphs' servers stopped
(`logseq server list`), `check.log/` ignored by git, and `git status` clean on `main` with the last tag pushed.

---

## 9. In one breath

Build the eyes first (frames, three witnesses, A/B attribution, stress with limits); run them on what exists and fix
everything they find; then bring each resting piece onto the kit one at a time, deciding by the owner's words, the
grammar, Logseq, and the quietest option, writing every decision down; empty `styles.js` into looks and layout; decide
the two tools; keep every test green and every document current at every commit; tag and push each; and end with one
plain report and the app ready to look at. Ask nobody anything.
