# How each piece of work is done and checked

Agreed with the owner on 2026-10-19; brought to how it is run on 2026-10-24 (0.4.381). This is the loop every change goes
through, so a session can run alone for a long stretch and the owner can still trust what comes out. The owner says what
to build; CLAUDE.md holds the working rules; this file says how a change is proved.

## 1. Before the change: what "done" looks like

Know, in plain words, what the owner should see in the Illness Test Graph when the piece works: which page, what shows,
what a click does, what Undo does. The logbook entry opens with the owner's own words (**Asked:**), which usually say it.
If it cannot be said, the piece is not clear yet: ask the owner instead of guessing.

## 2. Three levels of checking

**a. Automatic, every commit (`sh tools/check.sh`, no screen needed).**

It runs, in this order: the syntax of every file, no `TEMP-DEV` block, the version agreeing, every part listed; the
pretend-window tests (the boot test, each feature's own test, parts-apart, leaning-down, the proposals' stress); the
model test; the tag map's timings; the frame and picture tests in Chromium; the checks against the real Illness Test
Graph through the command line (two-way rows, proposals, suggested links); and the documents check. `docs/STATE.md`
section 3 lists every test with what it guards. While working on one part, its own test, the boot test, leaning and
parts-apart are run first, then check.sh in full. `sh tools/stress.sh` (the stress tests, two of them over Logseq's
debugging port) runs before a big change is called done.

A check that already fails is said to fail in the logbook entry ("the tag map checks fail as at 0.4.376, not touched"),
never left unsaid.

**Pictures and frames:** when a picture changes on purpose, look at `check.log/pictures/` (the new one, and
`-changes.png` with the changed pixels in red), and only then run `node tools/pictures.js --approve`. The same for the
frame scenes: look at `check.log/frames/<scene>/`, then `node tools/frames.js --approve`. Never approve without
looking. The approved pictures are in `test/pictures/`, the approved frame censuses in `test/frames/`, both committed.

**b. In real Logseq, after each finished piece.** Reload the plugin and look at the piece on the page it belongs to
(computer use on the Mac, Logseq only), and say in the logbook what was seen (**Seen in the app:**) and what was not.
`node tools/app-frames.js` records the tour stops off and on over Logseq's debugging port, for jumps and late pieces.
The full tour, for a layer or a change that touches every page:

1. `node tools/graph-check.js save` (a fingerprint of every page and block of the Illness Test Graph).
2. Reload the plugin.
3. Palette → "Refinements: troubleshooting" → "Take the tour (F8 for the next stop)". The stops are `tourStops` in
   `~/.logseq/settings/logseq-db-refinements.json`; the usual set is below. At each stop take a screenshot and look
   (pictures of the real app cannot be saved to disk on this Mac; describe what was seen in the logbook), then F8.
4. Read `tourReport` from the settings file: per stop, when the title and the plugin's rows appeared, what moved
   without input, and Logseq's console errors and warnings.
5. Make the piece's own test edits (the "done" list), and undo every one.
6. `node tools/graph-check.js compare`. It must say the graph is as it was; otherwise it names what differs, and
   that is put right before anything else.

Usual tour stops: `theme: light; Dr. Mei Chen; Consultation; Nausea; Northgate Cancer Center; Oxaliplatin; #/refinement-tags;
theme: dark; Dr. Mei Chen; Consultation; Tingling fingers; #/refinement-tags` (the theme is put back at the end
whatever it was).

**c. The owner's look, once per layer.** A short list: which pages to open, what to try. The owner says go or says
what is wrong.

## 3. The ratchet: every bug becomes a check

When something is found broken, first add a check that fails because of it (in the model test, the boot test, the
speed test or a picture), then fix it and watch that check pass. The check stays. A bug fixed once cannot come back
without a check failing.

## 4. The debugging loop

1. Reproduce it reliably, in the pretend setup where possible (seconds instead of minutes).
2. Write the failing check.
3. Fix, then run everything again, not only the new check.
4. Three failed attempts at the same problem: stop. Write in the logbook what was tried and what is suspected, and
   leave it for the owner instead of stacking guesses.

## 5. Before anything joins main

- `sh tools/check.sh` passes.
- The tour is clean, and the graph check says the graph is as it was.
- A second reader (a fresh agent that did not write the change) reads the whole diff for mistakes; what it finds
  is fixed or answered.
- One change per commit, version bumped (`sh tools/bump.sh`), a `CHANGELOG.md` line saying what was seen on screen
  and what was only read, README updated when a feature or setting changes.

## 6. Gates between layers

A layer is finished when every "done" list is met, the full tour is clean including the layers below, speed is no
worse than the limits, the feature map page is updated, and the owner has looked and said go. The plan was to tag that
commit `layer-N-good`; no such tag was ever made (2026-10-24): every version has its `v0.4.N` tag instead, and a
layer's close is the logbook entry that says the owner looked.

## 7. Limits when working alone

**May:** change the plugin's files, run checks, reload the plugin, use Logseq through the screen, make test edits in
the Illness Test Graph (and undo them), commit, merge to `main` when everything is green, push.

**Never:** delete or rebuild a graph, touch an app other than Logseq, use the clipboard, change Logseq's or the Mac's
settings, decide a design question for the owner.

**Stop and ask:** a design choice, a check that cannot run, a graph that does not match its fingerprint, three
failed attempts.

## 8. The logbook

`docs/LOGBOOK.md`, newest first. One entry per piece, headed `## YYYY-MM-DD · what changed (0.4.N)` (the documents
check looks for the version), in short labelled parts: **Asked:** the owner's words; **Built:** what changed and where;
**Seen in the app:** what was looked at, or "not yet"; **Checks:** which ran and how they came out, failures included;
**Not done** or **Not seen:** what could not be checked and why, what waits on the owner. Old entries are never edited.

## Lessons

- Check a test's Undo with the graph check afterwards. (Until 0.4.258 the plugin's Undo was a bar lasting a few seconds,
  hence the old habit of pressing it at once; the faded arrow waits.)
- Do not type into Logseq's developer console through the screen: a missed click sends the keys to Logseq as
  shortcuts. Read values with the tour, the troubleshooting tools or the command line instead.
- Before typing into a bullet, zoom in and see the caret: a click beside the words can leave Logseq out of edit, and
  the letters then go in as shortcuts. On a Mac, End scrolls the page; Cmd+Right moves the caret to the line's end.
- Taking a value off with `logseq upsert block --remove-properties` leaves Logseq's link records (`block/refs`) behind, so
  the bullet still shows in the old value's Linked references: re-save its words with `--content "<the same words>"`,
  then run the graph check.
- Test values can always be taken off with the command line when an Undo was missed.
- Run the tag map speed test with the screen released: while Claude controls the screen it ran six times slower and failed.
- Logseq's own Cmd+Z goes back further than the test: undo one step at a time and run the graph check after each.
- Take a screenshot before every click on a dialog: a changed wording moves its buttons, and a missed click looks like
  "nothing happened". A graph that is unchanged after a test only proves something if the action is seen to happen.
- Logseq re-makes an "All" view at once while its page is open in the sidebar: close it there first, then remove it.
- The command line can put a block's hidden place back (`logseq upsert block --id … --update-properties '{:block/order "…"}'`)
  and take a value off a page (`logseq upsert page --id … --remove-properties '[:user.property/…]'`).
- Undo after a two-way + that made a page leaves it in Logseq's recycle bin (the owner's pick); after a test, remove it with
  `logseq remove page --id … --force` (by id: the command line does not find a recycled page by name).
- After a click in the page, Logseq's keyboard focus can sit in a property's value box: a shortcut typed then goes in as
  words ("+ New option"). Press Escape before typing a shortcut, and look. Opening the Journals makes Logseq save a
  "Linked references" block for the day; remove it after leaving the page, like the "All" view.
- Deleting a graph in Logseq 2.0.2 only unlinks it: its folder moves to `~/logseq/graphs/Unlinked graphs`, and a new graph
  of the same name becomes "Name-1" until that folder is gone. Rebuilding: delete in the app, the owner trashes the
  unlinked folder, create in the app, switch to another graph, import, `server stop`, open, then Logseq's **Rebuild search
  index** (palette): an imported graph has none, and `[[ ]]` and search then find no page that exists.
- A freshly imported graph saves a view block ("All", "Linked references") the first time each page is opened: run the tour
  once, then save the fingerprint.
- Documents fall behind quietly (CLAUDE.md stood at 0.4.200 while the plugin reached 0.4.211): `tools/docs-check.sh`,
  run by the commit hook and by check.sh, now stops that.
- The page and property lists (`propPages`, `propSchema`) are read at most every 30 s: a page made or tagged a moment
  ago is not in them. A rule about pages the bullet links to must read those pages fresh (0.4.210: Provider stayed empty).
- `[[Page]]#Tag` typed and left as is tags the bullet; picked from Logseq's tag list with Enter right after the link, the
  tag goes to the page and leaves the words. Test both ways.
- A background click (the app_* tools) carries the Command key: in Logseq it selects the bullet instead of editing it.
  Use full-screen control to type into bullets.
- Opening a property's own page the first time makes Logseq save an "All" table view for it. The graph check shows it as
  added; it is Logseq's, harmless, and can be removed with `logseq remove block --uuid …`.

## Known limits

- The tour uses the screen. The Mac must be awake and unlocked, with Logseq open on the Illness Test Graph.
- Screenshots of the real app can be looked at but not saved (the Mac does not allow screen recording here), so the
  saved before/after pictures are the pretend ones; the real app is described in words.
- Pictures catch "changed" and "broken", not "clumsy": that is the owner's look.
