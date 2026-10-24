# Prompt: take stock of DB Refinements, describe it by layer, tidy the record

Written 2026-10-24 at 0.4.380, for a fresh Claude Code session in `/Users/admin/logseq-plugin`. Paste this as the first
message, or say "follow docs/TIDY-PROMPT-2026-10-24.md".

---

## 0. Who you are working for and what this job is

You are working on **DB Refinements**, a personal Logseq 2.0.2 plugin (DB graphs only) for one owner. Read `CLAUDE.md`
first and follow its working rules (section 2) exactly. The ones that matter most here:

- **The owner does not read code.** Never hand them a diff or a pull request. Review your own work, commit it, push it,
  and report in plain, short words: what changed, where to look.
- **Work only in `/Users/admin/logseq-plugin`**, on `main`. Commit and push from there. No worktrees, no cloud copies.
- **The owner only reloads the plugin.** Never ask them to run anything.
- **Use Logseq's words:** node, tag, property, child tag, extends. No invented words ("record", "field").
- **Commits:** one change per commit, `git -c user.name=… -c user.email=… commit`, stage files **by name** (other
  sessions share this folder; never `git add -A`, never stash or reset someone else's edits).

**The job is about the written record, not the plugin's behaviour.** Over five weeks and 380 versions the repository
has piled up handoffs, plans, prompts, audits, a logbook, a changelog and a 6,000-word CLAUDE.md, each written at a
different moment. They now disagree with each other and with the code. Your job:

1. **Take stock:** find out what the plugin actually is today, from the code.
2. **Describe it in layers:** one current, accurate description of the repo in the six layers of `docs/LAYERS.md`.
3. **Clean up:** remove clutter, dead files and stale claims; make the folder easy to find one's way in.
4. **Reconcile conflicting accounts:** where two documents (or a document and the code) disagree, find the truth and
   make every living document say it.
5. **Keep history as history:** everything worth remembering (decisions, rulings, what was tried and rejected, why
   things are the way they are) survives, written down as **a record of what happened, dated, in the past tense**, not
   as a plan, a to-do or an instruction that a later session might act on again.

**Nothing the owner sees in Logseq may change.** If you find a real bug, write it down (section 7) and leave it; do not
fix it in this job.

---

## 1. Before you start: the state of the folder

1. `git status` and `git log --oneline -15`. **At the time of writing, `parts/two-way.js` and two pictures in
   `test/pictures/` had uncommitted edits from another session.** Do not touch, stage, commit, stash or revert files
   you did not change. If they are still uncommitted, work around them; if your work needs them settled, stop and say so.
2. Check whether another session is running in this folder (`mcp__ccd_session_mgmt__list_sessions` if you have it,
   or ask). Two sessions must not drive Logseq at once; this job mostly does not need Logseq at all.
3. Run `sh tools/check.sh` once and keep its output. It is your baseline: the same checks must pass at the end.
   `node -v` works on this Mac (v24 at the time of writing), so the node tests run; say so in the report.
4. Read, in this order, skimming where long: `CLAUDE.md`, `docs/LAYERS.md`, `GUIDE.md`, `docs/PROCESS.md`,
   `README.md`, `docs/DECISIONS-AUTONOMOUS.md`, `docs/FINISH-LINE.md`, the first ~300 lines of `docs/LOGBOOK.md`, the
   last ~80 lines of `CHANGELOG.md`, `HANDOFF.md`, `docs/NEXT.md`, then every other file in `docs/` and
   `docs/history/` at least to the end of its first section. Also read the owner's memory folder,
   `/Users/admin/.claude/projects/-Users-admin-logseq-plugin/memory/` (index in `MEMORY.md`).

---

## 2. What counts as true: the order of witnesses

When two accounts disagree, believe them in this order:

1. **The code as it is on `main`** (`main.js`'s `PART_FILES` and `RESTING_FILES`, the parts, the settings declared in
   them, the tools and what `tools/check.sh` actually runs).
2. **What was seen in the app,** as recorded in a CHANGELOG line or a logbook entry that says it was *seen* (as opposed
   to "only read").
3. **`git log`** (dates, order, what landed together).
4. **The owner's own words**, quoted in the logbook, CLAUDE.md, `docs/DECISIONS-AUTONOMOUS.md` or the memory folder.
   A ruling by the owner outranks a session's own choice, and a later ruling outranks an earlier one.
5. **Everything else** (handoffs, plans, prompts, audits), in order of date, newest first.

Never settle a conflict by guessing. If the code and the record cannot settle it, list it as an open question for the
owner (section 7). Where a fact can only be settled by looking at Logseq (for example "does this still show?"), you
may look in the **Illness Test Graph** only, change nothing there, and say what you saw; if you cannot look, say that.

---

## 3. Step one: the inventory (write it before changing anything)

Make a working inventory in your scratchpad (not in the repo). For **every file** outside `node_modules/`:

| Column | What to write |
|---|---|
| Path | |
| Kind | plugin code (loaded) · plugin code (resting) · tool/test · seed/test data · living document · record (history) · page source (`.html`) · generated/scratch |
| Claims to be | its own first lines: "current state", "plan", "prompt", "report", "kept for history"… |
| Actually is | what it is in fact today |
| Last meaningful date/version | from its text and `git log -1 -- <path>` |
| Used by | which tool, test, page or document points at it (`grep -rn` the name) |
| Verdict | keep as is · update · mark as history and move · merge into X · delete (with the reason) |

Things already noticed that you should confirm, not take on trust:

- **Two layer numberings.** `docs/LAYERS.md` (2026-10-22) has six layers: 1 talking to Logseq, 2 the kit, 3 features,
  4 where things sit, 5 how things look, 6 tools. `CLAUDE.md` section 3 still uses an earlier numbering in which
  "layer 2" is the features and "layer 3" is where things sit, with a note saying so. Logbook entries, CHANGELOG lines
  and `docs/DECISIONS-AUTONOMOUS.md` use both. Living documents must use LAYERS.md's numbers only.
- **`CLAUDE.md`'s State line** is one sentence of several thousand words listing nearly every version since 0.4.217.
  That list already exists, better, in `CHANGELOG.md`.
- **`CLAUDE.md`'s `PART_FILES` list** (section 3, "loaded, 0.4.359") lacks `parts/link-suggest.js`, which `main.js`
  loads. Check every such list against `main.js`.
- **`GUIDE.md`** says there is no node, npm or python on this Mac and names a "Plugin Test Graph"; node is installed
  and the test graph is the Illness Test Graph.
- **`HANDOFF.md`** (0.4.165) gives the repo's path as `/Users/claude-agent/logseq-plugin` and describes parts that
  were deleted (`proposals.js`, `journal-dates.js`, `styles.js`, `editor.js`, `properties.js`).
- **`docs/NEXT.md`** (0.4.165) is a ranked to-do list for a plugin that no longer exists in that shape (Field Guide,
  1.0.0 after a quiet week), with only a one-line note on top saying it is history.
- **CLAUDE.md sections 6 and 7** are dated 2026-10-20 to 2026-10-23 and mix finished work, old plans
  ("Proposals are done up to 0.4.220", "Before layer 3", "Next … lets go in order"), open questions and loose ends.
- **The two-way row ideas.** The memory file `two-way-ideas-kept.md` and the outcome note on
  `docs/PROMPT-TWO-WAY-VALUE.md` say the five ideas are kept for later, none built; 0.4.376 built ideas 1 to 3 at the
  owner's word. Find which is true and fix the ones that are wrong (memory files included).
- **Plugin settings that belong to resting or deleted parts** (for example `inlinePropsGraphs`, which belonged to the
  resting `inline-props`; `autoDateGraphs`, deleted at 0.4.250). Check what the README and settings window still say.
- **`check.log/`** is git-ignored but holds ~70 scratch files from 2026-10-22 and 23 (probes, copies of parts such as
  `tags-fixed.js`, `shadow-fixed.js`, check outputs per version). Some tools write into it (`check.log/pictures/`,
  `check.log/frames/`, `graph-fingerprint.json`). Keep what a tool reads or writes; the rest is scratch.
- **Seeds:** `test/illness-test-graph.edn` (one file) beside `-1`, `-2`, `-3`; `test/plugin-test-graph.edn` for a graph
  that no longer exists. Find what still reads each before deciding.
- **The page sources** `docs/ELEMENTS.html`, `docs/VIEWS.html` (rebuilt by `tools/pages/`), `docs/VISUAL-GUIDE.html`
  (the old Field Guide, at 0.4.142), `docs/TWO-WAY-IDEAS.html`, `docs/TWO-WAY-ROWS-SKETCH.html`.
- **Several prompts** (`docs/FINISHING-PROMPT.md`, `docs/PROMPT-TWO-WAY-VALUE.md`, the ones already in
  `docs/history/`): instructions to a past session. Each is a record of what was asked, not a standing order.

Also look for: documents that point at files that no longer exist; tools no test or script runs and no document
mentions; comments in the code that describe a part that is gone (note them; see section 5 before editing code);
duplicate explanations of the same thing in three places.

---

## 4. Step two: the description in layers (`docs/STATE.md`)

Write one new living document, `docs/STATE.md`, that a newcomer could read in ten minutes and know what the plugin is
**today**. Build it from the code, not from the other documents. Shape:

1. **One paragraph:** what DB Refinements does for the owner, in Logseq's words, at version 0.4.N, dated.
2. **The six layers** (LAYERS.md's numbering, its names). For each layer:
   - what it is for, in one or two sentences;
   - the parts that make it, each with one line: its file(s), what the owner sees it do, its settings, its commands
     and keys, and the test(s) that cover it;
   - which parts of this layer rest (in `RESTING_FILES`) and why, pointing to the decision that rested them;
   - what is known to be unfinished or wrong (only facts, each with where it is recorded).
   Every loaded file in `PART_FILES` and every file in `RESTING_FILES` must appear exactly once. Check the leaning rule
   (a layer uses only the layers below it) against `tools/leaning-test.js` and say what it reports.
3. **The tools and tests:** what `tools/check.sh`, `tools/stress.sh` and the app tests (`tools/app-*.js`) run, what
   each test guards, which need Logseq open with its debugging port.
4. **The test graphs and seeds:** what each is, how it is rebuilt, who may delete what (the owner deletes graphs).
5. **Where to read more:** a short map of the documents that remain, with one line each saying whether it is living
   (kept up to date) or a record (dated, not updated).

Keep it short and plain. Tables are fine. No version-by-version history in it: that is the CHANGELOG's job.

Then make the other living documents agree with `docs/STATE.md`:

- **`CLAUDE.md`** becomes a short handoff: where things are, the working rules (unchanged in substance; they are the
  owner's), how the owner likes to hear back, a **short** State line (version, date, one or two sentences, a pointer to
  `docs/STATE.md` and `CHANGELOG.md`), the test graph and the tag/property principles, and "what comes next" reduced to
  what is genuinely open and the owner's standing rulings. Everything removed from it that is worth keeping goes to a
  record (section 6). **`tools/docs-check.sh` greps CLAUDE.md for `State (… **0.4.N**`: keep that exact shape**, and
  run the check after editing.
- **`README.md`**: what the plugin does and its settings, matching the code. No settings for parts that do not load,
  unless clearly marked as resting.
- **`GUIDE.md`**: the facts about the machine, the tools and Logseq 2.0.2's quirks, corrected.
- **`docs/LAYERS.md`** stays the design of the layers; correct any statement in it the code contradicts, and mark
  what it planned that was later done ("built at 0.4.3NN").
- **`docs/PROCESS.md`**: the loop as it is actually run today.
- The **feature map page** (claude.ai link in CLAUDE.md section 1) and the two pages built by `tools/pages/`: if you can
  reach them with the Artifact tool, read them and say how far behind they are; republish only if the owner's record
  says that is the routine (it is for ELEMENTS and VIEWS: rebuild with `tools/pages/`, republish to the same link).
  Otherwise list them as out of date in the report.

---

## 5. Step three: the cleanup

Rules:

- **Delete only what has no use and no history worth keeping**, and say why in the commit message. Scratch files in
  `check.log/` that no tool reads: delete. Copies of parts made during past debugging: delete. A document whose whole
  content is already, accurately, in another: merge, then move the shell to history or delete it.
- **Never delete a record of a decision or of something tried and rejected.** Move it, mark it, fold it into a record;
  don't drop it. "Tried and rejected" lists and the owner's rulings are the most valuable things in the folder
  (memory: dropped ideas stay dropped; a rejected idea is never quietly brought back).
- **Do not delete resting parts** (`parts/pages.js`, `links.js`, `search.js`, `inline-props.js`, `rich-copy.js`,
  `todos.js`). Resting is the owner's choice. Note in STATE.md what each still holds.
- **Code:** this job does not change code. If a code comment is wrong, list it; fix comments only if it is trivial
  **and** you are willing to make it a proper versioned change: the commit hook requires any change to `main.js`,
  `loader.js` or `parts/*.js` to come with `sh tools/bump.sh 0.4.N`, a CHANGELOG line, a logbook entry and CLAUDE.md's
  State line. Prefer one such commit at the end for all comment fixes, saying "nothing changes on screen". Tools and
  tests (`tools/`) may be tidied without a bump, but must still pass.
- **Seeds and pictures:** keep everything a tool reads. `test/pictures/` is the pictures test's baseline; leave it alone.
- **Git branches and worktrees:** list them; remove nothing that is not already merged in substance, and say what you
  removed. CLAUDE.md section 1 names three old branches kept on purpose.

---

## 6. Step four: history as history

Everything that is no longer current but is worth remembering becomes a **record**. A record:

- lives in `docs/history/` (keep the existing naming: `WHAT-YYYY-MM-DD.md`);
- opens with a short banner, for example:

  > **Record, not a plan.** Written 2026-10-19 at 0.4.165 as the handoff of that day. Kept for its history: the
  > owner's rulings and the "Tried and rejected" list (section 4). What it says is next was done, dropped or
  > overtaken; the current state is `docs/STATE.md`.

- keeps its original words below the banner. **Do not rewrite a record into the present tense or "improve" it**; the
  banner is what turns it from a plan into history. Fixing a broken link inside it is fine.

Do this for at least: `HANDOFF.md`, `docs/NEXT.md`, `docs/FINISHING-PROMPT.md`, `docs/PROMPT-TWO-WAY-VALUE.md`,
`docs/FINISHED-REPORT.md`, `docs/FINISH-LINE.md` (if it describes a finished push rather than a standing checklist),
the dated audits and baselines (`docs/BASELINE-2026-10-19.md`, `docs/TIMING-2026-10-19.md`,
`docs/LAYERS-1-2-AUDIT.md`, `docs/DESIGN-AUDIT-2026-10-22.md`, `docs/STYLES-AUDIT.md`), and the old Field Guide source
`docs/VISUAL-GUIDE.html`, unless you find a reason one of them is still living. Decide each from the inventory. Update
every link that pointed at a moved file (`grep -rn` the old name across the repo, the tools and the memory folder),
and check the tools: `tools/docs-check.sh` reads `CHANGELOG.md`, `CLAUDE.md` and `docs/LOGBOOK.md`; some tools read
`docs/*.html`.

Then write **one new record that keeps what would otherwise be lost** when CLAUDE.md is cut down:
`docs/history/DECISIONS-AND-RULINGS-2026-10-24.md` (or extend `docs/DECISIONS-AUTONOMOUS.md` if that reads better;
say which you chose and why). It gathers, with dates and the owner's own words quoted where they exist:

- every ruling the owner made (what to build, what not to build, how a thing should behave or look), newest first,
  each with its version and where it was recorded;
- everything tried and rejected, with why;
- the Logseq 2.0.2 facts learned the hard way (the effect box on install, `lsp://logseq.io` vs `logseq.com`, the
  search index after a command-line import, view blocks on fresh pages, the plugin's limits on properties it did not
  make, and so on), unless GUIDE.md already holds them;
- the layer renumbering of 2026-10-22, so old logbook entries can be read: a small table, old number → new number.

Write each entry as a fact about the past: "On 2026-10-23 the owner said no to the tag summary box ('I already decided
no to this')", not "Don't build the tag summary box". Standing rules that still apply (the working rules, "two-way is
on by default") stay in the living documents as rules, and are recorded here as when and why they were made.

**The logbook and the changelog are records already.** Do not edit old entries. Add one logbook entry for this job.
Add a CHANGELOG line only if you made a versioned code change.

**The memory folder:** read every memory file. Fix any that is now wrong (the two-way ideas file, for one), delete any
that turned out false, and keep `MEMORY.md` one line per file. Do not copy repository facts into memory.

---

## 7. What not to decide alone

Make a list, in plain words, for the owner. Put on it, rather than deciding:

- anything where the code and the record disagree and you cannot tell which the owner meant;
- any document or file whose deletion would lose something the owner might still want (ask; meanwhile, move to history);
- any bug you found (what you saw, where, how to see it in the Illness Test Graph);
- any decision still open in the record (for example: the ring on a capsule Logseq's own keys reach, keep or limit;
  Logseq's narrow name column cutting "Therapy regimen" short).

Keep the list short. One example each. No edge-case lists.

---

## 8. The order of work and the commits

One change per commit, each passing `sh tools/check.sh` (and so the commit hook), pushed after each:

1. Scratch removed from `check.log/` (not tracked, so no commit: just say what you removed).
2. Records moved to `docs/history/` with their banners, links updated. One commit, or one per group.
3. `docs/history/DECISIONS-AND-RULINGS-2026-10-24.md` (or the extended DECISIONS-AUTONOMOUS.md).
4. `docs/STATE.md`.
5. `README.md`, `GUIDE.md`, `docs/LAYERS.md`, `docs/PROCESS.md` corrected (one commit each).
6. `CLAUDE.md` cut down to a handoff, with its State line in the shape the docs check reads.
7. Memory files corrected.
8. If needed, the one versioned commit fixing stale comments in the code ("nothing changes on screen").
9. A logbook entry for the job, newest first, in the shape `docs/PROCESS.md` gives. (It can ride with step 6 if the
   docs check asks for it.)

Before each commit, read the whole diff once more, as a reviewer would, asking: did I lose a fact? did I turn history
into an instruction or an instruction into history by mistake? does every link still point somewhere?

At the end, run `sh tools/check.sh` again and compare with the baseline: the same checks pass. Run
`git grep -n` for the names of every moved or deleted file to be sure nothing points at them.

---

## 9. Done looks like

- `docs/STATE.md` describes every part, loaded and resting, under LAYERS.md's six layers, and matches `main.js`.
- No living document contradicts the code or another living document. No living document uses the old layer numbers.
- Every plan, prompt, handoff, report and audit that is no longer current is in `docs/history/`, under a banner that
  says when it was written and that it is a record, not a plan.
- The owner's rulings and everything tried and rejected are in one dated record, written as facts about the past.
- `CLAUDE.md` is a short handoff a new session can act on, and `tools/docs-check.sh` still passes.
- `check.log/` holds only what tools use. Nothing the owner sees in Logseq changed.
- The same checks pass as at the start. Everything committed and pushed; files other sessions were editing untouched.

---

## 10. The report for the owner

Short and plain, leading with the answer. Roughly:

- one or two sentences: the folder is tidied, nothing in Logseq changed, nothing to reload (or: reload once, if a
  versioned commit was made);
- where to read what the plugin is today (`docs/STATE.md`, and its link if you published it as a page);
- three to five of the most important disagreements you found and what you settled them to, one line each;
- the short list from section 7, as questions, one example each;
- what you could not check (for example the feature map page, if you could not reach it).

No code, no diffs, no file-by-file lists unless asked.
