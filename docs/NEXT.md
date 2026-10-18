# Next steps for DB Refinements

Updated 2026-10-18 at 0.4.135 (the right sidebar done: 0.4.134 tag chips stay on the row in narrow columns, 0.4.135 a page in the right sidebar has its own via labels and usage line). Read `HANDOFF.md` first (where things stand, the owner's rulings, Tried and rejected), then this file before picking up work. The drawn guide to every part of the plugin is the private artifact "DB Refinements Field Guide" (claude.ai/artifact/4QaqVXXJM8fxT1EPhw7hSZ); its source is `docs/VISUAL-GUIDE.html`.

**When you ship a version, refresh this file and the guide in the same pass:** strike or remove what the version finished, add what it left open, move the version line above, and change the guide's picture, caption and version stamp for anything that looks or behaves differently (then republish it to the same link with the Artifact tool's `url`).

## The goal

1.0.0 after a quiet week of use in `Work` with nothing that surprises the owner (asked 2026-10-13). Everything below is ranked by how much it stands between now and that week, then by how much it changes what the owner sees. The owner decides by looking: each item is one setting, one commit, looked at on screen before it is kept.

## Ranked

1. **Waiting on the owner's "go": the autocomplete round's unchecked looks** (thread "Refine autocomplete and visuals"). The pencilled look in dark theme and in the right sidebar after 0.4.124; the made pill (`proposeDayInWords`) on a Meeting's `date` and a `due date`, looked at on a Task only; the "proposed" word in the value picker, read in code only; where the hint's cursor is once the hint has left after twenty takes.
2. **Everything never looked at on screen**, before the quiet week: dark theme across the page cues, the hover preview, a narrow Logseq window (the settings card has a 150px floor), Logseq's own settings page for the plugin, a tag with its own icon in the `[[` menu, the New tag row, a url property, the Linked references look on a reference that arrives through a `#tag` (Idea tag page), the right sidebar's copy of a proposal, and the right sidebar after 0.4.135. Look, then fix only what is wrong.
3. **The quiet week in `Work`**, then bump to 1.0.0. The owner uses the plugin there with journal-day dates on (`autoDateGraphs: Plugin Test Graph, Work`). Never drive the app in `Work`; ask the owner what they noticed.
4. **The search window's rows in the line list's grammar** (review follow-up): the kind in monospace at the right, the tag taken out of the words. Visible, small, the search part already has the data.
5. **Block rows in the link box** (review follow-up, drawn in "Refinements Diagnosis" proposal 3 and left): through `logseq.App.search`, the call the search part already makes.
6. **The nested copy of a record listed twice under one source page**, stepped back in Linked references (review follow-up; regrouping the rows was rejected because rows cannot move).
7. **Offered, never decided; ask once with one recommendation:** the letters after `::` continuing the name begun (`st::at` leaves Status alone) rather than matching anywhere in it; whether the `[[` menu has to list every date (Logseq's own list).
8. **Seen once, not reproduced:** a record written from the command line about ten seconds after a reload not noticed by `DB.onChanged` (0.4.77); the right sidebar's marks and Search button missing for a moment after three rapid reloads (cleanup). Watch for them during the quiet week rather than chase them.

## After 1.0, or only if the owner asks

- **Todos and the tag tree** are paused (0.4.128) and off limits. Their open grammar items wait with them: change 9 (one write path with an inverse), housekeeping 10, 17, 21, 24 to 26 in `docs/GRAMMAR.md`.
- **Code health, invisible to the owner:** functions still over 80 lines (`open` in settings-panel.js, `buildDocument` and `chooseProperties` in rich-copy.js, `updatePdfCitations` in links.js, `main()` in main.js); code comments in `parts/links.js` (lines near `'↳'` and the day cue) still say "dashed circle" where the circle has been solid since 0.4.112. Fix a comment when you are in that file anyway.
- **The settings window by the vocabulary's families** (review follow-up): 0.4.129 put the sections under five umbrella groups, which may be enough. Ask before doing more.

## Rules every change keeps

These came from the owner across the rounds; do not relitigate them. The prompts they were first written in are in `docs/history/`.

- Tags act like classes: grey monospace names without the `#`, and monospace is for tag names only; no blue tag anywhere. Keep it simple. Logseq's own spacing, no air added between blocks. No property Logseq shows may ever be invisible; faint is fine. Nothing may move under the pointer. The ↳ cue only on a folded block, with a solid circle. No pencil after a date; dates carry their tense. The usage counts sit under the Linked references heading. The arrow only where a value is hidden; an empty slot reads as the row. Nothing steps back by age.
- "Pencilled in" (italic, the quiet grey, no box) is the look of a thing not yet written. Rejected in every form: a dashed outline of any spacing or shape, a hollow box, a half-strength wash, a dotted underline, angle brackets, a lighter weight, a trailing `?`, and `j`/`k` as the keys for a proposal. Tab takes, Shift+Tab passes, Escape never refuses.
- Anything that writes to notes writes only when the owner acts (Enter, Tab, a click), or proposes pencilled with an Undo after; never silently; limited by graph the way Journal day as date is; only names the graph has are written; only empty fields are proposed for; a new thing is made only through a pencilled make-row that is never the default when a match exists.
- A proposal has to change what the owner sees or does. Token clean-ups, wording and the same colour in two places are housekeeping: a separate list at the end, or left out. One recommendation with its reason, drawn now against proposed, never a menu.
- Every change: one setting, one commit, a CHANGELOG line saying what was seen on screen and what was only read in code, the version bumped in `package.json` and the README's first paragraph, the README's tables updated, `docs/GRAMMAR.md` kept true, `sh tools/check.sh` green, committed with `git -c user.name="ynmyz4hwr6" -c user.email="ynmyz4hwr6@privaterelay.appleid.com" commit` and the session's attribution line; `HANDOFF.md`, this file and the guide updated at the end.
- Looks are checked by the session in the running app, with computer use on the Plugin Test Graph, never on `Work` (it sits one row below the test graph in every list). Ask before taking the screen while the owner is in Logseq, and never drive the app while a block of theirs is in edit. Before every command typed at the devtools console, type one harmless character and zoom to see it at the prompt; never press Cmd+K there; make and remove scratch records from the command line. If a Reload in the Plugins panel leaves the old version running, quit and reopen Logseq. Three reloads in a row must leave one of everything.
