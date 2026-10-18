# Prompt: the third round, on the autocomplete and the look of what is not yet written

You are working with me on DB Refinements, a personal plugin for Logseq DB graphs (Logseq 2.0.2), in `/Users/claude-agent/logseq-plugin` on branch `main`, at 0.4.117. Read, in this order, before anything else: `HANDOFF.md` (the rulings, the vocabulary table, Tried and rejected, the symbols round), `docs/GRAMMAR.md` (the seven places on a row and every cue on that grid), `GUIDE.md` (how to reload, test and write to the graph from the command line), the artifact "Refinements Symbols" (claude.ai/artifact/XEjAJ81nTkWytRHVRYBvjv, the legend of the marks, the proposals of 18 October and the looks that were drawn and chosen), `parts/inline-props.js`, `parts/proposals.js`, `parts/journal-dates.js` and `parts/links.js` (the line list, the proposals, the journal-date ghost and the pickers: the four things this round is about), then `CHANGELOG.md` from 0.4.94 on.

## Where this stands

The plugin now writes structure while I type. Three mechanisms do it, built over four days:

- **The line list** (`p::`, `name::value`, 0.4.94 to 0.4.99): a list under the caret of the record's fields, then every property; letters filter; Enter picks a name and the list turns into its values, predicted by type (days, pages of the class, choices, values already used); a field that takes several stays open; Escape takes the token out.
- **Proposals in the pills** (0.4.105, 0.4.115): after I write a record, what the graph already knows is pencilled in the record's own pills: the journal day in an empty Date, a Person whose first name is a word of the record, the parent's project in a child's empty field. Since 0.4.115 they appear while I am still writing; Tab takes every one of them and keeps my caret, Esc says no, a click takes one.
- **The pickers read as the page** (0.4.100 to 0.4.107, 0.4.113, 0.4.114, 0.4.117): the `[[` menu, the `#` picker, the property picker, the value picker on a pill and the link box carry the page's marks: the rectangle before a page, a grey `#` before a tag, a journal day in the date box, the kind at the right in monospace for tag names only, a row that makes something pencilled in with its `+`.

And a vocabulary for "not yet written", settled on 18 October after dashes of every spacing were drawn and refused: **pencilled in**. A proposed value, a ghost, a Make row, a New page or New tag row is italic in the quiet grey with no box. It stands upright in its box the moment it is written. Dashed is gone from the plugin; a dashed circle is Logseq's Backlog and nothing else.

What is not settled, and what I want this round to take further:

1. The autocomplete is three mechanisms with three keyboards, three ways of appearing and three ways of saying no. I want it to feel like one.
2. Pencilled in is one day old and has been seen on four places. It has not been seen everywhere a thing can be unwritten, in dark mode, on a narrow window, in the right sidebar, in the search window's preview, or beside Logseq's own placeholders.
3. The proposals know three things (the day, a person named, the parent's field). I write more than that, and the graph knows more than that.

## What I am asking for

Use the plugin the way I do for long enough to feel where the autocomplete still resists, then diagnose, then propose, then build what I pick, one change per commit, each looked at on screen before its commit. Work in the Plugin Test Graph; never in the graph named Work, which sits one row below it in every list.

### 1. Use it, then diagnose

On today's journal, with scratch blocks made from the command line (`logseq upsert block -g "Plugin Test Graph" --target-page "Oct 18th, 2026" --pos last-child --content "…" --update-tags '["Meeting"]'`; a block made through the API with `#Tag` in its content keeps the tag inline in the sentence, so pass tags as tags) and removed at the end (`logseq remove block --id N`), write, as I write:

- a Meeting that names two people in its prose, one by first name and one by full name, and names a project by a word that is not the project's title;
- a Decision under that Meeting, with nothing but its words;
- a Project with a stage, where the stage is a closed set and I type two letters of a choice;
- a Person with a company that does not exist yet;
- a task with a deadline typed as a weekday, then changed to a date;
- a note that mentions a page by its alias;
- a record whose tag has a field I never fill (what does the empty slot look like now, after 0.4.111, and does the pencilled proposal ever land in it);
- a block I start as plain prose and only tag at the end, after the proposals have already been worked out;
- a block I write fast, with a typo in a person's name, and a block where two people share a first name.

For each, count the keys from the first letter to the record filed as the database should hold it, and note where the hand left the line (a mouse reach, a picker that needed arrows, a value retyped). Note every moment the three mechanisms meet: the line list open while a proposal is pencilled; Tab pressed while the `[[` menu is open; Escape pressed to close a picker that also says no to the proposals (0.4.116's changelog records this: Escape, Escape, Escape is now close the picker, decline, leave the block); a proposal for a field the line list is about to fill; a proposal that arrives after I have already typed the value by hand.

Then read, as pages, every surface where something can be not yet written, and photograph each with the proposal on it: a record on the Journals list; the same record in the right sidebar; a record inside a Linked references list; the search window with a line in its preview; the hover preview of a page; a record in a table view; the line list's rows (the Make row, the "as new text" row, the ghost at the top of the list when the record has no pill); the `[[` menu's New page row with and without a `+`; the `#` picker's New tag row; the property picker's New option; the value picker's New row; the link box's Make page row; the Undo bar after a take. Light and dark theme. A window 700 px wide. Tag each with seen or read.

Then judge against these classes, with evidence:

- **Three keyboards.** The line list: letters, Up, Down, Enter, Escape. The proposals: Tab, Esc, click. The pickers: Logseq's own, with the plugin holding Escape. Where do they collide, and which is the one keyboard? Say what Tab, Enter, Escape, Space and the arrows each mean in every state (nothing open; the line list open; a proposal pencilled; a Logseq picker open; a proposal and a picker at once), as one table, and mark every cell that is wrong, surprising or undefined today.
- **Three ways of appearing.** The line list opens on a token I type. The proposals arrive on a database round, a second or two after I pause. The pickers open on `[[`, `#` or a click. Where does a thing appear too late to be useful, too early to be right, or in a place my eye is not?
- **Three ways of saying no.** Escape takes the line list's token out. Esc declines the proposals for the session. Escape takes `[[` and `#` out of Logseq's pickers. Is "no" one gesture with one consequence, and is "not now" distinct from "never"? Today a declined record is declined for the session and the plugin never says so.
- **Pencilled in, everywhere.** Where a proposed thing is still drawn some other way (a box, a dash, a colour, a `+` that is the only cue, Logseq's own grey placeholder `···` next to a pencilled value); where italic is already used for something else (Logseq's own emphasis in prose, a planned date in Todos); where italic is too quiet to be noticed (the top of the line list, a long name, a date with a time); where the upright moment after Tab is not seen because the value is re-rendered rather than transformed.
- **What the proposals do not know.** List what the graph could propose and does not: a tag from the words (a block that says "decided" under a Meeting is a Decision); a stage from the previous Project's stage; a status from a deadline that passed; a company from the person named; the alias's page; a field a sibling record of the same kind always carries; the same value I gave the last three records of this kind. For each, say whether it is a proposal (pencilled, Tab takes it) or a default (written, Undo takes it back), and why. Only empty fields may ever be proposed for.
- **What the proposals get wrong.** Build the cases where a proposal is wrong and count what it costs to refuse it: a person named in passing who was not there; a word that is also a page's name; the parent's project on a Decision that belongs to another; a first name shared by two people (today: no proposal, silently). Does a wrong proposal cost more than no proposal? Where should the plugin stay quiet?
- **Logseq's own autocomplete** fights or helps: its `[[` menu lists every date; its `#` picker's first row is New tag while it loads; its value picker puts the checkbox first; its property picker says nothing about type until the plugin draws it; it has placeholders of its own (`···`, "Empty", the grey T). Where the plugin and Logseq both answer the same question, which should give way?

Rank everything on one list by what it costs me each record, reading and writing together, with how it was found: seen, counted or read.

### 2. Draw the one autocomplete

Before proposing changes, draw what the autocomplete would be if it had been designed once:

- **One keyboard**, as a table of states against keys, every cell filled, with the rule that produced it (a key does the nearest thing to what it does in prose; Tab completes, Escape backs out one step, Enter confirms the row, Space is never taken, the arrows move in the list).
- **One way of appearing**: when a thing is pencilled and when a list opens, in one rule about where my attention is (under the caret while I type; in the pill when I pause; never in a note at the corner).
- **One way of saying no**, with "not now" and "never" told apart, and the record told what it was told.
- **One drawing of "not yet written"**, pencilled in, as it should look in every place listed above, drawn on paper panels that imitate the Logseq page, light and dark, with the upright moment drawn as a second frame.
- **One drawing of the hint.** Today the first ghost of the record being written carries `tab takes · esc no` in small keycaps. Is a hint needed at all once the gesture is learned; should it fade after the first week; should it sit at the end of the pill row rather than after the first value; what does it say when there are three proposals and one is wrong?

Then measure the plugin against the drawing and list every departure.

### 3. Propose, in rank order

Three to five proposals, each removing a cost near the top of your list, each drawn now against proposed on a real record from the test graph, the same content in both, keys counted before and after. Keep the kinds apart:

- **One keyboard**: the collisions resolved and the table made true.
- **One appearance**: proposals that arrive where and when the hand is, including proposals worked out from the words as I type rather than after a database round, if the cost is acceptable (the line list already reads the editor on every input; say what it would take and what it would cost on a large graph).
- **More known**: one or two new things proposed, chosen by how often I would take them, with the quiet rule for when the plugin says nothing.
- **Pencilled in, finished**: every place made the same, and the departures from the drawing fixed.

For every proposal: the problem in one sentence with where I feel it; the mechanism, what I will see and do and no longer see and do; the drawing; what it takes (stylesheet only; marks from the database; a behaviour with a ghost and an undo; a change Logseq would have to make, and then it stays a note); what it risks (a wrong write, a key taken from Logseq, a slower pass); and one recommendation, not a menu.

### 4. Be imaginative, within the medium

Each of these is to be explored and rejected if it only looks different, with a drawing either way:

- **The record that fills itself as I type the sentence.** "Met Priya and Mateo about Atlas, decided to ship Friday" pencils attendees, project, a Decision child with a deadline, while the sentence is still being typed, each word that became a value marked by nothing more than its pencilled echo in the pill below. Tab takes all, or Tab takes the next one and Tab again the one after.
- **The pill as the place I write.** Today a value is typed in the line through `name::` and lands in the pill. Could the pill itself be where the caret goes after Tab, the next empty field pencilled with its best guess, Tab again moving to the next, so that a record is filled left to right along its own pill row without a list ever opening?
- **The hint that is the value.** Instead of `tab takes` in a keycap, the pencilled value itself carries the affordance: pencilled means "Tab takes me", and nothing else on the page is ever pencilled. The hint disappears once that holds everywhere.
- **"Never" as a mark.** A declined proposal leaves a faint trace in the pill (an empty slot that is quieter than the others) so I can see that I was asked and said no, and a click asks again.
- **The proposal that explains itself.** Hover or a key on a pencilled value says where it came from in four words ("Priya in the words", "from the Meeting above", "the day it was written").
- **Space as the taker** was considered and refused on 18 October because a proposal fills another field, not the word being typed. Reconsider only for the case where the pencilled thing is the completion of the word under the caret (a person's first name completing to the full name in the prose, with the relation written as a side effect). Say whether that case exists and whether it is worth a different key.

## Rules that hold, do not relitigate

- Decided by me, 16 to 18 October: tags act like classes and wear grey monospace names without the `#`; monospace is for tag names only, never for property names or types; there is no blue tag anywhere, the tag's `#` is the grey of the chips; keep it simple; Logseq's own spacing; no property Logseq shows may ever be invisible, faint is fine; nothing may move under the pointer; the ↳ cue only on a folded block and its circle is solid; no pencil after a date; dates carry their tense; a hidden-properties arrow only where a filled value is hidden; an empty slot under a block reads `name: ···` in the row's grammar; Tab takes a proposal while I write and Esc says no, j and k are retired; a thing not yet written is pencilled in, italic in the quiet grey, no box, no dashes of any spacing or shape.
- Rejected, do not bring back in any form: everything under Tried and rejected in `HANDOFF.md`; the dashed box and every dashed-line variant drawn on 18 October (browser dashes, 6 on 4, dots, brackets, hollow box, half wash, dotted underline, angle brackets, the light face, the question mark); Space as the taker for a value in another field; j and k; hover reveals; a note at the top right as the place a question is asked (it remains only for a record not on screen).
- Anything that writes to my notes writes only when I act (Tab, Enter, a click) or proposes pencilled with Undo after; it never writes silently; it is limited by graph the way Journal day as date is; only names the graph has are ever written to; a new thing is made only through a pencilled Make or New row that is never the default when a match exists; only empty fields are ever proposed for.
- Every change is one setting, one commit, with a CHANGELOG line that says what was seen on screen and what was only read in code, the version bumped in `package.json` and the README's first paragraph, the README's tables updated, `sh tools/check.sh` green, committed with `git -c user.name="ynmyz4hwr6" -c user.email="ynmyz4hwr6@privaterelay.appleid.com" commit` and the Co-Authored-By line the session is given. `sh tools/release.sh` builds the zip when I ask for it.
- Looks and behaviours are checked by you, in the running app, with computer use on the Plugin Test Graph. The devtools console (Cmd+Opt+I, docked at the bottom) reloads the plugin with `await LSPluginCore.reload('logseq-db-refinements')`. Before every command at the console prompt type one harmless character and zoom to see it there: twice on 18 October keys meant for the console ran as Logseq shortcuts, once making a page, once opening Settings. Never press Cmd+K at the prompt. Make and remove scratch blocks from the command line, not the console. If I am typing in Logseq when you look, wait or ask; do not reload under my hands.
- Say plainly what was seen on screen and what was only read. A proposal needs a drawing; a sentence is not a proposal. One recommendation with its reason, never a menu.

## What I want back first

Not code. One private artifact, "Refinements Autocomplete", drawn the way the symbols page was (paper panels that imitate a Logseq page, now against proposed side by side, the plugin's marks drawn as they are, pencilled values in italic grey, evidence tagged seen, counted or read): the ranked diagnosis (step 1) with the keyboard table and the photographs of every unwritten thing; the one-autocomplete drawing and the departures (step 2); the three to five proposals (step 3); the imaginative ones explored and kept or refused (step 4). Then stop and let me pick. Build nothing until I do. When I pick, build one at a time, look at each on screen, commit each, and write what you saw.
