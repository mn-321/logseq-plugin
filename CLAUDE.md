# Logseq DB Refinements plugin: handoff

Claude Code reads this file at the start of every session in `/Users/admin/logseq-plugin`. Written 2026-10-20 and cut
down to a short handoff on 2026-10-24; the longer version of that morning is `docs/history/CLAUDE-2026-10-24.md`.

## 1. Where everything is

- **State (2026-10-24):** `main` at version **0.4.381**: every layer of `docs/LAYERS.md` built or decided, the record
  tidied (2026-10-24). What each part is today, by layer, is `docs/STATE.md`; what changed in each version is
  `CHANGELOG.md`; the work behind it is `docs/LOGBOOK.md`.
- **Code:** GitHub `mn-321/logseq-plugin` (public since 2026-10-22), branch `main`. On the owner's Mac:
  `/Users/admin/logseq-plugin`, a git clone that pushes over an SSH key already on GitHub.
- **Logseq** loads the plugin unpacked from that folder, so a change on disk shows after a plugin reload. The plugin id
  is `logseq-db-refinements`; its settings file is `~/.logseq/settings/logseq-db-refinements.json`. Keep the owner's
  Mac on the unpacked copy, never an installed one beside it (two copies both draw).
- **Releases:** every version commit gets a tag `v0.4.N`, pushed (`git tag v0.4.N && git push origin v0.4.N`);
  `.github/workflows/publish.yml` attaches the zip to a GitHub Release. On another computer, Logseq's **Install plugin
  from GitHub release** with `https://github.com/mn-321/logseq-plugin`, with the **effect** box ticked (without it
  nothing of the plugin draws but the toolbar button; the plugin then shows one notice saying so). An installed copy is
  named `logseq-plugin` and has its own settings file.
- **Logseq command line:** `~/.local/bin/logseq` (queries, imports, `server stop`); `GUIDE.md` Part 2.
- **Documents** (the map, living or record, is `docs/STATE.md` section 5):
  - `docs/STATE.md`: the plugin today, every part by layer with its settings, keys and tests. Start here.
  - `docs/LAYERS.md`: the six layers, the rule that a layer leans only on those below, the owner's grammar of how
    things look and behave, the kit.
  - `GUIDE.md`: how the code is built and the rules that keep it so, Logseq 2.0.2's quirks, the development loop, the
    command line.
  - `docs/PROCESS.md`: how each change is checked, the tour, the logbook's shape, lessons.
  - `docs/MODELLING.md`: the owner's principles for tags and properties. `docs/ALIKE.md`: the proposals' engine.
  - `docs/history/`: records, not plans. `docs/history/DECISIONS-AND-RULINGS-2026-10-24.md` holds every ruling of the
    owner, everything tried and rejected, and what Logseq taught the hard way; read it before proposing anything.
    `docs/DECISIONS-AUTONOMOUS.md` holds the choices made without the owner, each with how to flip it.
- **Pages made in the project** (claude.ai links the owner can open):
  - Refinements feature map (layers and their state): https://claude.ai/code/artifact/54c579a9-2986-45cb-8316-5858a5ee7ec1
  - The elements page (`docs/ELEMENTS.html`): https://claude.ai/artifact/9VE7BaQ8Yz6G14RBpkzZuN, and the views page
    (`docs/VIEWS.html`): https://claude.ai/artifact/H6jetZ5PEcNsTG9Ux3cJPw, both rebuilt by `tools/pages/` and
    republished to the same links.
  - Older pages (the tag map sketch, the two-way ideas, the audit report) are listed in `docs/history/README.md`.

## 2. Working rules (the owner set these; follow them)

1. **The owner does not read code.** Never hand them a pull request, a diff or code to review. Review your own change
   (a second careful read of the whole diff before merging), merge it yourself, and report in plain words: what
   changed on screen, and what to look at in Logseq to see it.
2. **Work on the Mac, in `/Users/admin/logseq-plugin`, on `main`.** Make changes there, run the checks there, commit
   and push from there to GitHub, so the Mac and GitHub always match. No cloud copies, no zips, no downloads. Other
   sessions may share the folder: stage files by name (never `git add -A`), never stash or reset edits you did not
   make, and keep the folder on `main`. Logseq runs the plugin from this folder, never from a worktree, and only one
   session drives Logseq at a time.
3. **The owner only reloads the plugin.** Never ask them to install, unzip, pull or run commands. (Once a Mac safety
   check blocked `git stash` on edits Claude hadn't made, and the owner had to run one Terminal line. Avoid creating
   that situation.)
4. **Test only in the "Illness Test Graph"**, and undo every test edit. It is a test copy: reload and look without
   asking first, but take a screenshot and press Escape before the first click, and leave the owner's own edits alone.
5. **House rules for commits:** a commit hook (`tools/hooks/pre-commit`, running `tools/docs-check.sh`) stops a commit
   whose documents are behind: a change to the plugin's code must come with the version bump, its CHANGELOG line, a
   logbook entry and this file's State line, and a changed setting with the README; `tools/check.sh` runs the same
   check. If a fresh clone does not stop such a commit, turn the hook on once with `git config core.hooksPath
   tools/hooks`. One change per commit; bump the version with `sh tools/bump.sh 0.4.N` (package.json and the README's
   first lines must agree); add a `CHANGELOG.md` line in the existing plain style, saying what was seen on screen and
   what was only read; update the README and `docs/STATE.md` when a feature or setting changes; push the version tag.
   The feature map page cannot be checked from here: update it when a layer changes. No global git identity is set,
   so commit with `git -c user.name=… -c user.email=… commit`.
6. **Check in the real app.** After a change, reload the plugin in Logseq and look, using computer use on the Mac where
   available (control Logseq only; the owner pushed back when a request also asked for the clipboard). Say plainly what
   you saw on screen and what you could not check.

### How the owner likes to hear back

- Plain, short, conversational. Lead with the answer. Assume no technical background. Very short, simple sentences,
  one example; no lists of edge cases unless asked ("you speak convoluted").
- Use Logseq's own words: **node** (a page or block), **tag**, **property**, **child tag** / **extends**. Don't invent
  words like "record" or "field" (the owner had to ask what they meant).
- When they ask "should we…", give one recommendation and the reason, not a menu. They decide by looking, so show
  rather than describe when possible. Mockups are plain HTML pages showing what the tool does on any graph, with
  complex knowledge as the example (never tasks and meetings), never the Design canvas.
- They often think out loud about design. Engage with the idea, push back when something won't work in Logseq, and
  explain the trade-off with a concrete example from the Illness Test Graph. An idea they reject is replaced with a
  new one, never reworked.
- No time estimates. Don't narrate the investigation; give the result.

## 3. The plugin

DB Refinements adds to Logseq 2.0.2 DB graphs: two-way links shown on both pages, a tag and property map edited in
place, proposals while a bullet is written, suggested links, link selected text, pickers, PDF quotations, a page's
tags beside its title, quieter sidebars, search and page looks. It is built in the six layers of `docs/LAYERS.md`
(1 talking to Logseq, 2 the kit, 3 features, 4 where things sit, 5 how things look, 6 separate tools), each leaning
only on those below, checked by `tools/leaning-test.js`. Every part stands on its own (`tools/parts-apart-test.js`).

`main.js` loads the files in `PART_FILES`; the files in `RESTING_FILES` are kept but never loaded (`docs/STATE.md`
says what each holds and why it rests). A resting part comes back only by being rebuilt on the kit and the model:
moved from one list to the other, then checked on its own and measured. A **"Foundation only"** switch (settings,
Tools, Troubleshooting) loads only the foundation; if the owner says "nothing shows", check it first.

## 4. Tests

`sh tools/check.sh` before every commit; `sh tools/stress.sh` before a big change is called done. Node, jsdom and
Playwright's Chromium are on the Mac, so they run in full; if any is skipped, say so. What each test guards is
`docs/STATE.md` section 3. Three checks already fail at 0.4.381 (the tag map's rename checks and frame scenes, one
proposal on the real graph; `docs/STATE.md` section 2): say so in each logbook entry until they are mended.
The app tests drive Logseq over its debugging port (`open -a Logseq --args --remote-debugging-port=9222`). Reload:
in the Plugins panel (`t p`) press Reload, or `await LSPluginCore.reload('logseq-db-refinements')` in the console; if
the old version keeps running, quit and reopen Logseq. The troubleshooting box (palette: "Refinements:
troubleshooting") has Check what the plugin finds on this page, Measuring, the performance report, Copy warnings and
the tour (`docs/PROCESS.md`).

## 5. The Illness Test Graph and the tag/property principles

**The graph:** "Illness Test Graph" on the Mac. A made-up patient, Daniel Okoro, 58, colon cancer from July 2026:
about 110 journal days, doctors, hospitals, medicines, reports, appointments into December. Fifteen tags with one to
three properties each (Consultation: Provider, Topic; Conversation: Topic, Spoke with; Expectation: Status; Treatment:
Agent, Cycle; Hospitalization: Hospital, End; Symptom Log: Symptom type, Severity; Report: Date, Findings; Decision:
Decided by, Date; Doctor: Specialty, Works at; and so on), every node a sentence written freely with its links; about
690 pages and blocks. Topic takes 15 tags on purpose (the owner, 2026-10-21). The seed is made by
`test/illness-test-graph.py` into `test/illness-test-graph-1.edn`, `-2`, `-3` (fixed ids, so re-importing can't create
doubles).

- To rebuild it: the owner deletes the old one in Logseq and trashes "Unlinked graphs" (Claude must not delete
  graphs); create the empty DB graph from Logseq's own "Create a new graph" dialog with the same name; switch the app
  to another graph (Demo); import parts 1, 2, 3 in order with `~/.local/bin/logseq graph import --graph "Illness Test
  Graph" --type edn --input <file> --timeout-ms 300000`; `logseq server stop --graph "Illness Test Graph"` and check
  `server list`; open it in the app; run Logseq's **Rebuild search index** (an imported graph has none); run the tour
  once (fresh pages make Logseq save view blocks); `node tools/graph-check.js save`. Re-importing over an existing
  graph leaves old text values as loose blocks: always rebuild clean.
- Two scratch graphs made with the command line, not listed in the app, which Claude may remove and remake: **Seed
  Check** (the same seed, for scoring: `GRAPH="Seed Check" OWNER=any node tools/shadow-check.js`) and **Stress Check**
  (the seed plus six years of journals from `test/stress-graph.py`, 31,000 bullets; import a month per file).
- Plugin settings set for this graph: `tourStops` and `tagTreeRoots`.
- Good places to look: Dr. Mei Chen (provider of, spoke with, decided by), the Consultation, Treatment and Expectation
  tag pages, Nausea and Tingling fingers (symptom logs under the title), Northgate Cancer Center, Oxaliplatin (agent
  of).

**Principles the owner agreed (also in `docs/MODELLING.md`):**

- Structure is extracted from free writing, not planned ahead of it; no rules tuned to the test graph.
- A **tag** says what a node is. A **property** records a fact you'd want to list, sort or see from the other side. A
  **link in the words** is just a mention. Test: "would I ever want a list of these?" If yes, it's a property.
- **Node property vs text:** if the value *is* a thing (a person, city, hospital), make it a node property limited to
  a tag. Text is for words you'd never look up; a [[link]] inside text is only for mentioning something in a longer
  sentence, never as a stand-in for a node property.
- **Child tags for broad kinds.** The owner prefers child tags over a "type" property for short lists that rarely
  change (Imaging, Biopsy, Surgery extending #Procedure). Make a child tag when some nodes need properties the others
  don't. Details (MRI vs CT) go in the title or a property of the child tag, not new tags.
- **Pages for open-ended lists.** Growing lists (symptoms, medicines, doctors) are pages under one tag, e.g. [[Cough]]
  #Symptom, pointed at by a property.
- **Naming when a type property is used:** the property is "… type" (procedure type, on #Procedure); the tag on the
  list pages is "… kind" ([[Imaging]] #Procedure kind). A single shared "Type" property can't work cleanly, because
  which tags a property accepts is one setting for the whole graph.
- **Two-way is on by default**; turn it off only for a page so many nodes point at that the rows become clutter. Off
  hides only the rows at the top; the link itself and Linked references stay.
- Umbrella tags (Entity, Occurrence, Concept) are for sharing properties down and gathering children, not for tagging
  nodes directly.
- Cheap to change later: renaming, adding a property or a choice, adding or moving a child tag. Expensive: turning a
  choice into a child tag, text into node links, changing a property's kind once used (the tag map's Make a choice
  its own child tag and Turn into links to pages make these one step).

## 6. What is open

Nothing is planned: what comes next is the owner's to ask for. Open, each waiting for the owner:

- The ring on a capsule Logseq's own keys put the keyboard on shows in every graph: keep or limit (since the audit of
  2026-10-22).
- Logseq's narrow name column cuts a long property name short ("Therapy regimen"); the whole name shows on hover since
  0.4.353, the column itself waits.
- Two-way row ideas 4 (follow a chain) and 5 (a row for what sits two steps away): explained on 2026-10-24, not built;
  build only when asked.
- A quiet trial of the proposals on the owner's real graph (reads only, a week of logs beside what they set): proposed
  2026-10-21, not decided.
- The three failing checks (section 4) and the loose ends in `docs/STATE.md` section 2.

Standing rulings worth knowing before proposing anything (the full list, dated, is
`docs/history/DECISIONS-AND-RULINGS-2026-10-24.md`): no tag summary box and no `p::` typing (2026-10-23); the words by
the title hidden with their room kept; Enter takes every proposal shown, guesses too, and Option-Enter stops on each;
Escape clears the proposals until something is typed again; no choice or number guesses; Undo is the faded arrow,
with no time limit; tags read as names in mono without #, never Logseq's blue; no colour of the plugin's own.
