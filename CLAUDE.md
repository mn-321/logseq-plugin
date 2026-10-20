# Logseq DB Refinements plugin: handoff for a regular Claude Code session

Written 2026-10-20 from the "Logseq Plugin" project, so the work can carry on in an ordinary Claude Code session.
Save this file as `CLAUDE.md` in `/Users/admin/logseq-plugin` (Claude Code reads it at the start of every session there), or paste it as the first message.

---

## 1. Where everything is

- **Code:** GitHub `mn-321/logseq-plugin`, branch `main`. On the owner's Mac: `/Users/admin/logseq-plugin` (a git clone, pushes over an SSH key already added to GitHub).
- **State at handoff:** `main` is at commit `fab7f31`, version **0.4.186**.
- **Unmerged work:** branch `claude/project-thread-at5qzj` (commit `f9c6d88`, on top of `fab7f31`): the faster tag map. See section 6.
- **Logseq** loads the plugin unpacked from that same folder, so a change on disk shows after a plugin reload. The plugin id is `logseq-db-refinements`. Settings file: `~/.logseq/settings/logseq-db-refinements.json`.
- **Logseq command line:** `~/.local/bin/logseq` (queries, imports, `server stop`). See `GUIDE.md` Part 2.
- **Notes in the repo** (read these before deep work):
  - `GUIDE.md`: how the plugin is built, its rules, Logseq 2.0.2 quirks, the development loop, CLI recipes. The best single reference.
  - `docs/MODELLING.md`: the tag and property principles (section 5 here sums them up).
  - `docs/NEXT.md`, `docs/BASELINE-2026-10-19.md`, `docs/TIMING-2026-10-19.md`: next steps and the speed baselines.
  - `HANDOFF.md`: the long history up to 0.4.165. Older than this file; the "Tried and rejected" and "How the owner likes to work" sections still hold.
  - `CHANGELOG.md`: one plain line per version, says what was seen on screen and what was only read.
- **Pages made in the project** (claude.ai links, the owner can open them):
  - Refinements feature map (layers and their state): https://claude.ai/code/artifact/54c579a9-2986-45cb-8316-5858a5ee7ec1
  - Tag and property map sketch (the design the in-plugin map was built from): https://claude.ai/artifact/XSiVNeF1VzzPwuumJeKatG

## 2. Working rules (the owner set these; follow them)

1. **The owner does not read code.** Never hand them a pull request, a diff or code to review. Review your own change (a second careful read of the whole diff before merging), merge it yourself, and report in plain words: what changed on screen, and what to look at in Logseq to see it.
2. **Work on the Mac, in `/Users/admin/logseq-plugin`.** Make changes there, run the checks there, commit and push from there to GitHub, so the Mac and GitHub always match. No cloud copies, no zips, no downloads.
3. **The owner only reloads the plugin.** Never ask them to install, unzip, pull or run commands. (Once a Mac safety check blocked `git stash` on edits Claude hadn't made, and the owner had to run one Terminal line. Avoid creating that situation.)
4. **Test only in the "Illness Test Graph"**, and undo every test edit. The older "Work" graph no longer exists; don't mention it.
5. **House rules for commits:** one change per commit; bump the version with `sh tools/bump.sh 0.4.N` (package.json and the README's first lines must agree); add a `CHANGELOG.md` line in the existing plain style, saying what was seen on screen and what was only read; update the README when a feature or setting changes. No global git identity is set, so commit with `git -c user.name=… -c user.email=… commit`.
6. **Check in the real app.** After a change, reload the plugin in Logseq and look, using computer use on the Mac where available (control Logseq only; the owner pushed back when a request also asked for the clipboard). Say plainly what you saw on screen and what you could not check.

### How the owner likes to hear back

- Plain, short, conversational. Lead with the answer. Assume no technical background.
- Use Logseq's own words: **node** (a page or block), **tag**, **property**, **child tag** / **extends**. Don't invent words like "record" or "field" (the owner had to ask what they meant).
- When they ask "should we…", give one recommendation and the reason, not a menu. They decide by looking, so show rather than describe when possible.
- They often think out loud about design. Engage with the idea, push back when something won't work in Logseq, and explain the trade-off with a concrete example from the Illness Test Graph.
- No time estimates. Don't narrate the investigation; give the result.

## 3. The plugin and the rebuild plan

The plugin ("DB Refinements") adds to Logseq 2.0.2 DB graphs: a tag and property map, two-way links shown on both pages, proposals, pickers, page extras, sidebars, search, cosmetics and a few separate tools.

The owner is **rebuilding it layer by layer, bottom up.** Every part of the old plugin is still in `parts/`, but only the rebuilt layers are loaded. In `main.js`:

- `PART_FILES` (loaded): `shared.js`, `model.js`, `diagnostics.js`, `two-way.js`, `tags.js`, `settings-panel.js`.
- `RESTING_FILES` (kept, never loaded): `editor`, `pages`, `properties`, `links`, `chrome`, `sidebar`, `styles`, `search`, `journal-dates`, `inline-props`, `proposals`, `rich-copy`, `todos`.
- Bringing a part back is moving it from one list to the other, then checking it on its own and measuring it.
- A **"Foundation only"** switch (settings, Tools, Troubleshooting) loads only the foundation. It must be **off** for the tag map and two-way rows to show. If the owner says "nothing shows", check it first.

### Layer order (the owner's latest order) and where each stands

1. **Foundation: done.**
   - 1a the engine: loading, clean-up, watching the screen, the database round, settings, dialogs, warnings. It names no feature; each part registers itself.
   - 1b the Logseq model (`parts/model.js`): the one place that knows what a page, block, tag, property, journal day and link are, including what kind of page is open and finding a page's title.
   - Measured in the real app: the foundation's own work is effectively zero.
2. **Links and properties: in progress.** In this order:
   - **Tag and property map (done, being finished).** One foldable tree of tags with their properties: inherited ones faded with "from #Parent", boxed kinds (TEXT, DATE, CHOICE, LINK, SEVERAL), "Shows up here as …" for links pointing at a tag, small **i** buttons for guidance (how to set up a new tag, one value vs several, which way to link). Editable in place: rename, change what a link property accepts, edit choices (refuses to remove a used choice), edit descriptions, edit the two-way wording, turn a row off on the other page. The kind of value and one vs several can't be changed by a plugin on properties it didn't make, so those open Logseq's own property settings in the sidebar. Opens from the toolbar tree icon, Cmd+Option+G, or the palette ("Tag tree"); it needs to open as a page to show properties.
   - **Two-way links (done).** Every node property that points at a page shows on that page as a row, e.g. "doctor of → 8 Infusions…", with no per-property setup (on by default, can be turned off per property for noisy pages). Rows appear together with the page (no jump on reopen), are clickable, have hover cards, filters by kind, an "earlier" divider, show all / show fewer, a ⇥ to open in the sidebar, and a **+** to add a new linked node (with Undo). Pages without properties get the rows under the title.
   - **Proposals, "Tab to add", linking selected text, pickers: not started. This is next** after the map work closes. The owner wants the friction-free part first: proposals that appear just from recognising tags from links or names typed in the words, taken with Tab. Typing grammar like `p::` / `name::` was moved later (layer 4); don't lead with it.
3. **How things show on each page: off.** Title area, Linked references, the tag summary box, tidy property rows, small relation marks. Two pieces are already done and waiting: pages no longer slide sideways when the scroll bar appears, and a hint in the tag summary box that suggests a child tag when a property is filled on half or fewer of a tag's nodes (only from 6 nodes up).
4. **Getting around: not started.** Sidebars, search, general shortcuts, and the `p::` typing.
5. **Cosmetics: deliberately late.** The plugin's own colours and sizes. Until then, layers 2 and 3 must use only Logseq's own theme (and work in dark mode; mix greys from `currentColor`, since Logseq's `--ls-*` variables fell back to plain text colour in dark mode).
6. **Separate tools: last, or dropped.** Rich copy, todos and the like. The owner said to keep them listed in the feature map and decide each when its layer comes.

When a layer changes, update the feature map page too (link above) if you can reach it; otherwise tell the owner it is out of date.

## 4. Tests and measurements

- **`sh tools/check.sh`** before every commit. On the Mac it checks syntax (JavaScriptCore), no leftover `TEMP-DEV` block, version agreement, and that every `parts/` file is listed. Where node is installed it also runs:
  - `tools/boot-test.js` (needs `jsdom`): starts, runs and unloads the plugin in a pretend Logseq window; fails on any warning or leftover.
  - `tools/model-test.js`: 118+ checks of the model on a small pretend graph, plus timings on a 20,000-page / 300-property pretend graph.
  - `tools/tags-speed.js` (needs Playwright and Chromium): times the tag map's redraw on a 600-tag pretend graph, and how much it jumps.
  The GUIDE says the Mac had no node; check `node -v`. If these are skipped, say so in the report rather than implying they ran.
- **In the real app:** the troubleshooting box (palette: "Refinements: troubleshooting") has measuring on/off, Copy performance report, Check what the plugin finds on this page, and Copy warnings. Since 0.4.180 every tag map redraw is timed and the last 50 are kept on Logseq's own window as `refinementTagTimes`; read it in the developer console.
- **Jumps and appearance timing in real Logseq:** in the developer console (Cmd+Option+I), a `PerformanceObserver` for `layout-shift` (sum the scores, log the moved elements) plus a `MutationObserver` that timestamps when the plugin's elements appear. Remove the script afterwards.
- **Reload:** in the Plugins panel (`t p`) press Reload, or run `await LSPluginCore.reload('logseq-db-refinements')` in the console. If the old version keeps running, quit and reopen Logseq. With "Foundation only" on, "Reload plugin" once got stuck; reloading the window fixed it, cause unknown.
- **Last measured (0.4.185, real Logseq):** reopening any page with two-way rows moves nothing; on a first-ever visit Logseq's own property list can push things down once (seen on Oxaliplatin). Tag pages still jump while Logseq fills its own table of tagged nodes; that is Logseq, not the plugin.

## 5. The Illness Test Graph and the tag/property principles

**The graph:** "Illness Test Graph" on the Mac. A made-up patient, Daniel Okoro, 58, colon cancer from July 2026: about 110 journal days, doctors, hospitals, medicines, reports, appointments into December. Reshaped on 2026-10-20 on the owner's own map, expanded by its principle: fifteen tags with one to three properties each (Consultation: Provider, Topic; Conversation: Topic, Spoke with; Expectation: Status; Treatment: Agent, Cycle; Hospitalization: Hospital, End; Symptom Log: Symptom type, Severity; Report: Date, Findings; Decision: Decided by, Date; Doctor: Specialty, Works at; and so on), and every record a sentence written freely with its links. About 690 entities; Dr. Mei Chen is the provider of 2 consultations. `docs/MODELLING.md` opens with the principle. The seed is made by `test/illness-test-graph.py` into `test/illness-test-graph-1.edn`, `-2`, `-3` (fixed ids, so re-importing can't create doubles).

- To rebuild it: the owner deletes the old one in Logseq (Claude must not delete graphs); create the empty DB graph from Logseq's own "Create a new graph" dialog with the same name; switch the app to another graph (Demo); import parts 1, 2, 3 in order with `~/.local/bin/logseq graph import --graph "Illness Test Graph" --type edn --input <file> --timeout-ms 300000`; then `logseq server stop --graph "Illness Test Graph"` and check `server list` before opening it in the app.
- The plugin settings `autoDateGraphs` and `inlinePropsGraphs` include this graph.
- Good places to look: Dr. Mei Chen (provider of, spoke with, decided by), the Consultation, Treatment and Expectation tag pages, Nausea and Tingling fingers (symptom logs under the title), Northgate Cancer Center, Oxaliplatin (agent of).

**Principles the owner agreed (also in `docs/MODELLING.md`):**

- A **tag** says what a node is. A **property** records a fact you'd want to list, sort or see from the other side. A **link in the words** is just a mention. Test: "would I ever want a list of these?" If yes, it's a property.
- **Node property vs text:** if the value *is* a thing (a person, city, hospital), make it a node property limited to a tag. Text is for words you'd never look up; a [[link]] inside text is only for mentioning something in a longer sentence, never as a stand-in for a node property.
- **Child tags for broad kinds.** The owner prefers child tags over a "type" property for short lists that rarely change (Imaging, Biopsy, Surgery extending #Procedure). Make a child tag when some nodes need properties the others don't. Details (MRI vs CT) go in the title or a property of the child tag, not new tags.
- **Pages for open-ended lists.** Growing lists (symptoms, medicines, doctors) are pages under one tag, e.g. [[Cough]] #Symptom, pointed at by a property.
- **Naming when a type property is used:** the property is "… type" (procedure type, on #Procedure); the tag on the list pages is "… kind" ([[Imaging]] #Procedure kind). A single shared "Type" property can't work cleanly, because which tags a property accepts is one setting for the whole graph.
- **Two-way is on by default**; turn it off only for a page so many nodes point at that the rows become clutter. Off hides only the rows at the top; the link itself and Linked references stay.
- Umbrella tags (Entity, Occurrence, Concept) are for sharing properties down and gathering children, not for tagging nodes directly.
- Cheap to change later: renaming, adding a property or a choice, adding or moving a child tag. Expensive: turning a choice into a child tag, text into node links, changing a property's kind once used. Hence the child-tag action below.

## 6. In progress right now ("Close out map work on Mac")

A session on the Mac was working through these, one at a time, running the checks after each and confirming in real Logseq. Check `git log`, `git status` and the branch list first to see how far it got before carrying on.

1. **Faster tag map.** Start from branch `claude/project-thread-at5qzj` rather than redoing it. It makes the map redraw keep unchanged rows (matched by `data-key`; changed rows replaced whole; `view.shown` re-pointed) and copy parsed markup instead of re-parsing. On the 600-tag pretend graph a redraw went from about 2.3 s to 1.2 s with no jump; `check.sh` passes. Not yet tried in real Logseq. Next thing to look at: forced layout in `draw()` (`getBoundingClientRect` and `scrollTop` on the held row).
2. **Error after renaming a tag on the map.** Probably Logseq's own bug: its rename-page op is a plain save-block with no `:data` in tx-meta, so `after-page-renamed!` (`frontend/handler/common/page.cljs`) calls `page-name-sanity-lc` on a nil old name and throws a `toLowerCase` error. (CHANGELOG 0.4.181 offers another guess: the open page is the plugin's, not a Logseq page.) It doesn't harm the map; the rename itself is done. To confirm, rename a page with Logseq's own title editing and see whether the same error appears. If it's Logseq's, tell the owner in one line and move on.
3. **"Make this its own child tag" action on the map.** Start from a value, e.g. the choice "Imaging" of procedure type on #Procedure (or the [[Imaging]] page if procedure type is a node property). One step: create #Imaging extending #Procedure; move *every* #Procedure node whose procedure type is Imaging to #Imaging, keeping all their properties; clear the old value on them and remove "Imaging" from the choices. It acts on the whole group, not on selected nodes, and must be undoable. Test it on the Illness Test Graph and undo.
4. **Try the map's editing in real Logseq:** rename, change what it accepts, choice editing, description editing. Fix what fails. None of these had been tried in the real app yet.

Then: merge, push, make sure the Mac folder is on `main`, and tell the owner in plain words what changed on screen and what to try.

## 7. What comes next

- **Layer 2's proposals and "Tab to add".** The old code is in `parts/proposals.js` (and `inline-props.js`, `links.js`), resting. Rebuild rather than switch it back on: on the foundation and model, Logseq's theme only, measured against the baseline, one piece at a time. Focus on proposals that appear from links or names typed in the words (e.g. a link to Dr. Chen in an appointment proposes doctor: Dr. Chen; a link to an untagged page proposes its tag), taken with Tab. The test graph has nodes left half-filled on purpose for this (Aug 25 dietitian with an empty doctor; Jul 17 with two doctors named, where the plugin should stay quiet).
- Then linking selected text and the pickers, then layer 3.
- Open loose ends: "Reload plugin" stuck once in Foundation only mode; a property limited to a parent tag (e.g. #Entity) should offer nodes of its child tags in the picker, believed true but not yet checked in this Logseq version; the map has no "Shows up here as" entry for a link property that names no tag.
