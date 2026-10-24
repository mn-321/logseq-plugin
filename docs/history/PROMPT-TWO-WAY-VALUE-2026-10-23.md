> **Record, not a plan.** Written 2026-10-23 as `docs/PROMPT-TWO-WAY-VALUE.md`, a design prompt for the two-way rows; moved here 2026-10-24. The outcome note under this banner was written on the morning of 2026-10-24, when none of the five ideas was built; later that day the owner said "just write 1 to 3", and ideas 1 to 3 were built at 0.4.376 (ideas 4 and 5 explained on the ideas page, `TWO-WAY-IDEAS-2026-10-24.html`, not built); the current state is `docs/STATE.md`.

> **Outcome (2026-10-24).** The proposal was made in this session instead, as a plain page: `docs/TWO-WAY-IDEAS.html` (published at https://claude.ai/artifact/48DQdpxk2WDA6NTFB7KvcG). The owner kept five ideas to build later, none yet: group a row by anything; add a node inside a group, already filled in; write into a node without leaving; follow a chain without leaving; a row for what sits two steps away. Dropped on the way: tables and boards, journal-based rows, linking from the page that holds the property, mentions into links, moving nodes between pages by drag, keeping a row in the sidebar, "new since last visit". Examples must be complex knowledge (a concept with claims and sources), never tasks and meetings.

# Prompt: make the two-way link section earn its place

You are working in `/Users/admin/logseq-plugin`, the Logseq DB Refinements plugin. Read `CLAUDE.md` first and follow its working rules exactly: the owner does not read code, works only by looking at Logseq, and wants plain, short answers in Logseq's own words (node, tag, property, child tag). This is a **design task, not a build task**: the deliverable is a proposal the owner can decide on by looking. Do not change any code.

## Why this matters

The two-way link section (the rows at the top of a page: "doctor of → 9 Consultations · next Nov 12") is the heart of this plugin and of how the owner will use Logseq. Today it shows relationships well: every node property that points at a page appears on that page as a row, with hover cards, filters, a + to add a node, tick boxes to act on several at once, and one Undo. The owner's judgement: that is still mostly *seeing* relationships. They want the section to be **dynamic and useful**: a place where things happen, where the page tells you what matters now, and where the owner does work rather than just reads.

Your job is to propose what that could be, grounded in what Logseq 2.0.2 actually allows and in what the plugin already has.

## Read before you think

- `parts/two-way.js` (the whole file; its opening comment says what it does and why). Note `linksInto` at line ~140, `summary`, `rowHtml`, `barHtml`, the draft line (`draftFor`, `onDraftKey`) and the picking bar. Everything the rows know comes from the model door `provided.linksInto(id)` in `parts/model.js`.
- `parts/model.js`: what the model can already answer about a page, its nodes, dates, tags and properties. A proposal that needs a new question answered must say so.
- `docs/LAYERS.md` sections 1 to 4: the six layers, the grammar, the kit, the order of building. Anything proposed must sit on the kit (`.rf-pop`, `shared.ask`, `shared.undo.offer`) and read the graph only through the model.
- `docs/MODELLING.md`: the tag and property principles. The rows exist because a property is "a fact you'd want to list, sort or see from the other side".
- `HANDOFF.md`, sections "Tried and rejected" and "How the owner likes to work". Do not re-propose what was rejected. In particular: no tag summary box, no `p::` typing (owner, 2026-10-23); no time estimates; no menus of options.
- `docs/NEXT.md`, `docs/FINISHED-REPORT.md`, `docs/DECISIONS-AUTONOMOUS.md`: where things stand and what was decided without the owner.
- `CHANGELOG.md` lines 0.4.137 to 0.4.333 for the two-way rows' history: what was tried, seen, and changed at the owner's word.

## Look, don't only read

Open the Illness Test Graph in Logseq (it is a test copy; driving it is fine, undo any test edit, and make sure no other session is driving Logseq). Spend real time on the pages where the rows carry weight and write down what you would want to do there that you cannot:

- **Dr. Mei Chen**: provider of, spoke with, decided by. What would a patient want from this page the day before an appointment?
- **Oxaliplatin**: agent of. Treatments by cycle; what is next, what was skipped, what symptoms followed each one?
- **Nausea** and **Tingling fingers**: symptom logs under the title. Severity over time, which treatment they followed.
- **Northgate Cancer Center**: everything that happened there.
- The **Consultation**, **Treatment** and **Expectation** tag pages: Expectation has a Status; what is open, overdue, met?
- A **journal day**: nothing shows there today. Should it?

Think as the owner: a person tracking an illness, not a database user. The question on every page is "what does this page tell me to do or watch, and what can I do from right here?"

## What to propose

Propose **three to five** directions. Each one is a concrete thing seen on a named page of the Illness Test Graph. For each direction, give the owner:

1. **One sentence a child could follow.** Say what changes on the page and what it does for the owner. Example: "On Dr. Mei Chen's page, the next appointment shows at the top, so you know when you see her next."
2. **A picture** (see "Pictures" below).
3. **What you can do from it**, in one or two short sentences. Say what gets written into the notes, and that every change can be undone with the faded arrow.
4. **Why it helps**, with one example from the test graph. Ask: "would I use this every week?"

Keep the harder questions out of the owner's way. Put them in a folded section at the bottom of each direction, titled **"Behind the scenes"**, which the owner can skip:

- What Logseq allows. Which model doors answer it today, what new question the model would need, and anything a plugin cannot do in Logseq 2.0.2. Check `GUIDE.md`'s quirks list before claiming either way.
- Cost and risk. Is it cheap or expensive to change later (per `docs/MODELLING.md`)? Could the page jump, or slow down with hundreds of links? The Stress Check graph exists to test this. What settings would it add?
- Whether it is a *layout* change (adds, moves or removes something, so it must be checked for jumps) or a *look* change (only colour, size or spacing).

Directions worth weighing (not a checklist; drop any that fail the tests above and add your own):

- **Time**: the rows already know every linked node's day. Next and last, overdue, "nothing for 3 weeks", a row sorted by what is soonest rather than by property. A "today / this week" sense on the page.
- **State**: properties like Status, Severity, End, Cycle carried into the row so the page reads as a status board, not a list ("3 expectations open, 1 overdue").
- **Doing**: things started from the row. Today the + adds one node. What about logging a symptom from the symptom's page with today's day and the last severity ready, marking an expectation met, scheduling the next cycle from the last one, writing a journal line that already links the page?
- **Across rows**: what the rows say together. A doctor who is provider of consultations *and* decided by decisions: the page as a timeline of everything that involves this page, one stream, grouped by day, tag as the quiet word.
- **Questions the page answers**: a row that is a small answer rather than a list ("Tingling fingers: worse after cycles 4 and 5"), only where the model can answer it honestly without inventing rules tuned to this graph (the owner's direction: no rules tuned to the test graph; learn from the graph as it is).
- **The journal**: the rows on the day's page, or a day's nodes reading back to the pages they touch.

## Variations of the recommendation

Pick **one direction** to recommend, and say why in one or two sentences.

Then show **three variations** of that direction, side by side, so the owner can choose by looking:

- **Quiet:** the smallest change that still helps. Little new on the page.
- **Middle:** what you would build first.
- **Bold:** the fullest version, even if it changes the page a lot.

Each variation gets its own picture, one simple sentence, and a short "good / not so good" line. Example: "Good: you see everything at once. Not so good: the top of the page gets busier." Say which variation you would pick, and why, in one sentence.

The other directions get one picture each. A second variation is welcome only where it really changes the choice.

## Pictures

The owner decides by looking, so the pictures carry the proposal and the words only explain them.

- **Draw each idea as it would look on the real page.** Use Logseq's look and the plugin's own rows: the same greys, fonts, tags in mono and arrows. `docs/ELEMENTS.html` and `docs/VIEWS.html` show how the plugin's pieces are drawn. Build the pictures from those, not from scratch.
- **Show before and after.** Next to each idea, show the same page as it looks today. A screenshot from the app is best; a careful drawing is fine.
- **Use real names from the test graph.** Use Dr. Mei Chen, Oxaliplatin, Tingling fingers, and the real dates and counts, so the owner recognises the page.
- **Mark what is new.** Use a soft highlight or a small numbered dot, explained in one line under the picture.
- **Show things that move as steps.** If something happens on a click (a list opens, a node gets made), show it as two or three small pictures in a row: before, click, after.
- **Check both light and dark mode,** and make sure the pictures read on a phone.

## Words: super simple

- Short sentences. One idea each. No technical words.
- Use Logseq's own words: node, tag, property, page, journal day. Explain each one once, the first time it appears, in a few words. Example: "a property (a labelled fact, like Provider: Dr. Mei Chen)".
- Never use words like "query", "entity", "schema", "render", "state", "UI" or "data model" in the owner's part of the page. They may appear only under "Behind the scenes".
- Prefer an example over an explanation.
- Start the page with three lines: what this page is, what to look at, and what to decide.

## Rules for every idea

Respect the plugin's rules in every direction: nothing in `parts/two-way.js` talks to Logseq directly (the leaning-down check must stay at 0); dark mode works; a page with rows must still open without anything moving (the rows' held room, `holdRoom`, is there for this); the rows stay the plugin's own layout drawn with the kit's pieces.

## Deliverable

Publish one claude.ai page the owner can open and comment on, and put its link in your report. Use this order:

1. Three opening lines: what this is, what to look at, what to decide.
2. The recommended direction, with its three variations side by side.
3. The other directions, one picture each.
4. A short list of what you could not check in the app.

Keep the words short, so the pictures do the talking. Do not build anything until the owner has chosen.
