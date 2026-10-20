# Logbook

Newest first. One entry per piece of work, in the shape `docs/PROCESS.md` describes.

## 2026-10-20 · Option-Enter to the empty property (done list proposed, not started)

**Tried on screen first:** Logseq has no keyboard way into the properties shown under a bullet: Escape selects the
bullet, Down goes to the next bullet, and Cmd+J did nothing (its property navigation is for properties shown as rows
of their own). What I had told the owner from reading Logseq's code was wrong. A click on an empty value opens
Logseq's own "Set Topic" list: type to narrow it, arrows and Enter pick, Escape closes.

**The owner's refinement:** Option-Enter goes to the empty property that has nothing proposed.

**Done means, on Aug 18, "Post-op check with Dr. Patel" (Provider proposed, Topic empty, Date filled):**
1. Option-Enter in the words opens Logseq's own "Set Topic" list: the first property that is empty and has nothing
   proposed. Typing narrows it; Enter picks, and Logseq writes it.
2. Tab in that list goes on to the next such property, Shift-Tab back; past the last one, back to the words.
3. After a pick, or Escape, the caret is back at the end of the words and the proposals still show.
4. Enter in the words then fills in the proposals, as now.
5. With no such property, Option-Enter does nothing.

## 2026-10-20 · Enter takes the proposals; italic grey (0.4.202)

**The owner:** "I prefer italic grey and then add dotted. I do not want to have to click on it to confirm ... enter
confirms I like things. if I want to change things then maybe option-enter can move focus to the properties and type
or move that way with tab going next one." And: "if you have concern about creating a tag for a page silently then
add ...as #tag".

**Done:** values italic grey in their property, guesses dotted as well; Enter fills in everything shown; leaving any
other way fills in only what is not a guess; a click on a value does nothing; a page with no tag shows "Name as
#Tag" and is offered for one place only. Seen: Aug 18, Enter filled Provider: Dr. Raj Patel, Undo emptied it;
clicking away left it empty. "as #Tag" only in the pretend check (no untagged page left in the graph: the owner
tagged Hannah Reyes). Second reading's fixes: an Enter that kept the bullet in edit no longer counts later; Enter
just before a typed tag fills in nothing.

**Next, to agree:** Option-Enter into the properties (Tab to the next, type to change).

## 2026-10-20 · Proposals drawn where the value goes (0.4.201)

**The owner, after looking:** Hannah Reyes offered for two places is reasonable; "about the tingling" guessing
Tingling fingers as Topic is useful. But the line under the bullet takes the whole line: "all that is necessary is
the name to appear in dotted line where it would be. don't add the extra text about enter, etc".

**Done means:** no line of its own and no keys; the value written faintly in the bullet's own property where Logseq
shows the empty value; a guess with a dotted line, taken by a click; nothing left behind when the bullet is left.

**Seen in the app:** the Aug 18 post-op check in edit read "Provider: Dr. Raj Patel" faint and dotted in its own
pill, nothing else; a click took the dots away, leaving filled it. A new "Wiped out all day. #Symptom Log" read
"Symptom type: Fatigue" (dotted) and "Date: Oct 20" (no dots) in its pills; Escape emptied both, leaving wrote
nothing. Not seen: a property with no pill (the made pill), a note under a record (values in the parent's pills).

**The owner's own edits** were in the graph when I came to test (Aug 25 Provider and Topic, Hannah Reyes #Doctor, a
new consultation "Spoke with Dr. Mei Chen about fatigue" and a symptom log "Severe Fatigue", and Logseq's view
blocks). Left as they are; the graph check was compared against that list instead of the fingerprint, and after my
tests only those remained. The scorer now counts 107 filled properties (the owner's new ones in): sure right 57,
wrong 0; guesses right 23, wrong 1; silent 26.

## 2026-10-20 · Proposals, piece 2 built (0.4.200)

**Against the done list (agreed with the owner today):**
- *Plain words:* Aug 18 "Post-op check with Dr. Patel" showed "Provider: Dr. Raj Patel?"; a click turned it solid and
  kept the bullet in edit; leaving filled it; Undo emptied it. "at Northgate" and "the tingling": pretend checks only.
- *The same line written before:* a new "Wiped out all day. #Symptom Log" on Oct 20 showed "Date: Oct 20 · Symptom
  type: Fatigue?"; taken, then left with Enter: both filled. "Chemo cycle 1 done …": right in the scorer (three agents).
- *A link to a page with no tag:* Aug 25 showed "Provider: Hannah Reyes? (becomes a #Doctor) · Topic: Nausea?". One
  change from the list: the list said "with more than one empty property her page could fill, nothing is offered",
  but Consultation has Provider and Topic both empty there, so that rule would have made the example silent. Built
  instead: a guess for each empty place, up to two, and taking one drops the other. Here Topic was already guessed
  from "nausea" in the words, so only Provider was offered for her. Taking it filled Provider and gave her page
  #Doctor (seen in the graph check).
- *The parent's values:* a new "#Decision" under the Jul 17 consultation (not Oct 7, which has no notes on its own
  page view; same rule) showed "Date: Jul 17?" and filled it.
- *Kept quiet:* Jul 17 in edit, no line at all.

**The scorer:** sure right 54, wrong 0; guesses right 19 (15 from earlier lines, 4 from plain words), wrong 1
("Video call with Dr. Mei Chen about the tingling": Topic guessed Tingling fingers, holds Peripheral neuropathy);
silent 46 down to 26. Limits set to these (`GUESS_WRONG_LIMIT` 1, `GUESS_RIGHT_LEAST` 15).

**Found on the way:** the first click on a guess did nothing: holding back the pointer press in the app also stops
the mouse press the click was read from. Pretend check added, fixed, seen working. The second reader found the same,
plus: leaving with Enter could lose what was taken (the next bullet's line comes first); a taken guess could carry
over to a later visit; the earlier lines were read again every 30 seconds and waited for while typing; a tag could
stay on a page when its fill failed; the README listed the parent's values as sure. All fixed; Enter seen working.

**Tour after:** 12 stops, rows with the title in 49 to 95 ms, nothing moved, no console errors or warnings, no plugin
warnings. Every test edit removed (the command line for the bullets and Hannah's tag); the graph check says the graph
is as it was (690).

**My mistakes in the app:** a click beside a bullet's words did not put it in edit, and the words I typed went to
Logseq as shortcuts (the Journals scrolled; nothing in the notes changed, graph check). The End key scrolls on a Mac
instead of moving the caret: Cmd+Right. The Undo bar lasts 7 seconds, shorter than my round trip twice; the values
were taken off with the command line instead. Lessons in PROCESS.md.

**For the owner to look at:** Aug 25 with Hannah Reyes (two places offered, or one, as now); whether "about the
tingling" guessing Tingling fingers as the Topic is a useful guess or noise.

## 2026-10-20 · Proposals, piece 2: guesses taken by a click (done list, agreed)

**What a guess is:** something the plugin is fairly but not fully sure of. It shows in the same faint line under the
bullet, set apart from the sure pieces (a dotted underline and a "?"), and is taken only by a click on it. Leaving the
bullet takes the sure pieces as now and never a guess. Escape clears both. A taken guess goes in with Undo in the bar,
like a sure piece. The words are never changed.

**The guesses in this piece, each with where to see it in the Illness Test Graph:**
1. *A page named in plain words.* A word or two of a page's title or alias, written without brackets, for a page whose
   tag fits an empty property. Aug 18, "Post-op check with Dr. Patel" (#Consultation, Provider empty): the line offers
   "Provider: Dr. Raj Patel ?"; a click fills it. "at Northgate" offers Northgate Cancer Center where a hospital
   property is empty; "the tingling" offers Tingling fingers on a symptom log. Two pages that fit the same words
   (e.g. "Dr." alone) offer nothing.
2. *The same line written before.* A line under a tag that reads like an earlier line under that tag (the same words,
   or nearly) offers the earlier one's values for the empty properties. "Wiped out all day." (#Symptom log, Symptom
   type empty) offers "Symptom type: Fatigue ?", as the earlier ones have; "Chemo cycle 1 done …" (#Treatment) offers
   the three agents of cycles 2 and 3. Earlier lines that disagree offer nothing.
3. *A link to a page with no tag.* Aug 25, "Video call with [[Hannah Reyes]], the dietitian" (#Consultation,
   Provider empty): offers "Provider: Hannah Reyes ? (gives her #Doctor)". A click fills Provider and tags her
   page; Undo takes both back. With more than one empty property her page could fill, nothing is offered.
4. *The parent's values.* A tagged bullet under a tagged bullet offers the parent's values for properties both tags
   have: a new "#Decision" bullet written under the Oct 7 video call with Dr. Mei Chen offers "Date: Oct 7 ?". Not
   offered when the child already says otherwise.

**Kept quiet, on purpose:** Jul 17, "Saw [[Dr. Raj Patel]] and [[Dr. Mei Chen]] together" offers no Provider, sure or
guessed. A bullet with nothing to offer shows nothing, and typing costs no measurable time (the tour's timings).

**Left out of this piece (my recommendation, for the owner to say):** a tag from the siblings ("Bloods for tomorrow's
chemo …" has no tagged line like it anywhere in the graph, so there is nothing to learn from; it waits until the
graph has one); dates in words ("Colonoscopy on Friday", "Operation on the 4th"), which is its own small piece next;
Topic, which the words rarely say.

**The scorer:** `tools/shadow-check.js` counts guesses apart from sure pieces. Sure pieces: right stays 54 or more,
wrong stays 0. Guesses: right and wrong counted and each wrong one listed here; the silent count (46 now) must drop.
I expect most of the 20 silent symptom types and the 3 treatment agents to become right guesses.

**Checks:** each case above becomes a case in the pretend test (`tools/shadow-test.js`); the tour; the four lines
above tried in the app, each guess taken by a click and undone; the graph check says the graph is as it was.

## 2026-10-20 · The Illness Test Graph rebuilt on the 0.4.199 seed

Made from Logseq's own "Create a new graph" dialog (the name came out exactly "Illness Test Graph"), the app switched
to Demo, the three parts imported through the command line (no errors), `graph validate` clean (691 entities, no
errors), the command-line server stopped, the graph opened in the app. The journal opens on Oct 20 with "Bloods at
Northgate this morning …".

**Tour (12 stops):** rows with the title on every page, 147 to 263 ms on these first visits; nothing moved without
input (0 on every stop); no console errors or warnings. Seen: Dr. Mei Chen with "decided →" (3) and "provider of →"
(2); Nausea and Tingling fingers with their symptom logs under the title; Northgate with "works here → Dr. Mei Chen";
Oxaliplatin with "agent of →" the three cycles, now short lines ("Chemo cycle 3 done. Zoë Müller did the drip, pump
home for two days."); the tag map in both themes. The plugin counted one warning of its own this session (not read:
reading it needs the clipboard; most likely the known "block text not found" on the Pages list). The tour reports
0.4.198: Logseq had not reloaded the plugin since the version bump, which changed only the seed. Fingerprint saved
after the tour: 690 pages and blocks.

**check.sh:** everything passes on the new graph: two-way rows 24 pages, 40 rows, 76 links as the answer key;
proposals right 54, wrong 0, silent 46 of 100. The tag map speed failed twice while I was controlling the screen
(first drawing 2.1 s, changes 0.7 to 1.2 s); with the screen released and the Mac quiet it passed (273 ms, changes
99 to 126 ms). Lesson: run the speed test with the screen released.

## 2026-10-20 · The test graph reshaped on the owner's map, expanded by its principle (0.4.198)

**Done means:** the seed has the owner's shape (one to three properties a tag), expanded where the owner's own
principle says so, every record a sentence with its links; imports without errors; the checks run on it.

**What the owner said:** the old graph's nodes carry far more properties than they would ever use (Consultation 10
with what it inherits). A tag should exist only when its nodes need properties the others don't, on a consistent
basis, or for sorting; a property only for what one will list or sort by; not every detail belongs in a schema; the
main bits live in both the words and the properties; and a linked page that already has a tag carries its quality,
which makes extracting structure from free writing cheap. They sent a screenshot of their own map ("Hospital prop"
on Hospitalization a mistake: it is Hospital), then asked for it expanded, not copied. Written into
`docs/MODELLING.md` as the opening principle.

**The expansion, each by the owner's test:** trimmed Expectation's Completed (Status says it) and Doctor's Location
(its hospital has one); Symptom Log gets one Date, not "Date & Time" beside it. Added Treatment (Agent, Cycle: a
chemo cycle that has happened is not an expectation, and one lists treatments by cycle and drug), Decision
(Decided by, Date: the few lines one would want listed in a year, with who said them), Severity on Symptom Log (the
one thing worth plotting). Material for the later guesses, on purpose: a post-op check naming Dr. Patel and Riverside
in plain words with Provider empty; "Bloods before cycle N" as plain lines shaped like their siblings; and the quiet
cases kept (two doctors in one sentence, the untagged dietitian, logs without a date).

**The seed:** `test/illness-test-graph.py` rewritten: 15 tags, 23 properties, 54 pages, 111 journal days, 31 records,
25 symptom logs, 12 reports, 4 decisions, 3 treatments; 690 entities. Imported through the command line into a scratch
graph, "Seed Check" (made with `graph create`, so the app does not list it; removed and made again for the second
shape), all three parts without errors; `graph validate` clean.

**The checks on it:** two-way rows 24 pages, 40 rows, 76 links, all as the answer key. Proposals: 100 properties
hidden in turn, right 80, wrong 0, silent 20 (on the old shape: right 22 of 214). The one wrong found on the way:
a note under a conversation ("Rang [[Amara]] and [[Tunde]]") proposed them as the conversation's "spoke with"; now a
list of people in a note is never a sure piece (a doctor named in a note still is the provider). Case added to the
pretend test (13).

**The rebuild (same day):** the owner deleted the old graph in Logseq. Deleting it in the app only unlinks it (its
folder moved to "Unlinked graphs"), and the first new graph came out as "Illness Test Graph-1" because the old folder
still held the name; the owner put "Unlinked graphs" in the Trash. The new empty graph was then made from Logseq's own
"Create a new graph" dialog (by me, through the screen, at the owner's go-ahead), the app switched to Demo, the three
parts imported through the command line (no errors), `graph validate` clean (691 entities), the command-line servers
stopped, and the graph opened in the app. Lesson in PROCESS.md.

**On the rebuilt graph:** `check.sh` passes: two-way rows 24 pages, 40 rows, 76 links as the answer key; proposals
right 80, wrong 0, silent 20 of 100, so `RIGHT_LEAST` is 70. Tour stops now Consultation and Tingling fingers in place
of Appointment and the second Nausea; the map's roots Occurrence, Interpretation, Phenomena, Entity (were Occurrence,
Entity, Concept). Tour: 12 stops, rows with the title (65 to 105 ms), no errors, no warnings; on Oxaliplatin a small
jump (0.032) as Logseq filled in its own references. The first visits made Logseq save seven view blocks; with no test
edit made, the fingerprint was saved again after the tour with them in (690).

**Seen, for the owner (layer 3):** with records written as sentences, the two-way rows show the whole sentence as the
name ("Chemo cycle 3 at Northgate: Oxaliplatin, Fluorouracil (5-FU) and Leucovorin, Zoë Müller on the drip. Cold cap
on, pump home for 46 hours." on Oxaliplatin's "agent of"). Readable, but long; how a sentence reads in a row (the
first clause, up to a colon or full stop?) is a question for the page layer.

**Left on the Mac:** the scratch graph "Seed Check" (made with the command line, so the app does not list it), for
the owner to delete or keep.

## 2026-10-20 · Proposals, piece 1: the shadow under a bullet (0.4.197)

**The design (agreed with the owner today):** while you type a bullet, a faint shadow under it shows what the node
would become; leaving the bullet (Enter, a click elsewhere, arrowing away) takes the sure pieces, with Undo in the
bar; a faint guess is taken only by a click on it (not in piece 1); Escape clears the shadow and that bullet is left
alone for good; Tab stays Logseq's indent. The plugin never changes the words typed.

**Done means (piece 1, sure pieces only: links in the words, the page, the parent, the journal day):**
- On the Aug 25 dietitian appointment (empty doctor), entering the bullet and leaving it fills `doctor` from the
  link in the words, with Undo; Undo puts the graph back exactly.
- On the Jul 17 appointment (two doctors named), nothing is proposed for `doctor`; the date and anything else sure
  still show.
- A new bullet on Dr. Mei Chen's page tagged #Consultation gets `doctor: Dr. Mei Chen` as a sure piece.
- A new bullet under an #Infusion on a journal day gets that day as its date.
- Escape clears the shadow; that bullet is never proposed for again.
- Typing in a bullet with nothing to propose shows nothing and costs no measurable time (the tour's timings).
- A hidden-property test on the whole Illness Test Graph reports right / wrong / silent, with wrong at or near zero,
  and `check.sh` fails if wrong goes up.

**Changed on screen:** a faint line under the bullet being written ("doctor: Dr. Mei Chen · enter takes · esc clears");
the values filled in when the bullet is left; the Undo bar (now solid in both themes; it was see-through in the app).

**The scorer (`tools/shadow-check.js`) earned its keep before anything was tried in the app.** First run: 18 wrong.
- *The journal day is not sure*: appointments written on Oct 19 for Dec 2 would have got Oct 19 (14 wrong). Now the
  journal day is proposed only for a tag whose nodes the graph shows are dated the day they are written (symptom
  logs 18 of 18; appointments 3 of 8, so never). 18 right, 0 wrong after.
- *Two doctors named spilled into "with"* (which takes any person): the most particular property claims a link first,
  and one kept quiet by two names keeps them. A second doctor named when doctor is filled does not become "with" either.
- *A dietitian offered as a hospital*: an untagged link could be given the tag of any empty one-tag property; now only
  when there is exactly one such place.
Final: 214 properties hidden, right 22, wrong 0, silent 192. The pretend check `tools/shadow-test.js` holds each of
these as a case (10), plus the page filling two properties (seen in the app) and a two-word tag written as Logseq
shows it ("#Symptom log", found in the app: no shadow came).

**Seen in Logseq (0.4.197):**
- Dr. Mei Chen's page, new bullet "Review of the tingling #Consultation": the shadow read "doctor: Dr. Mei Chen"
  (and, before the fix, also "with: Dr. Mei Chen"); leaving the bullet filled doctor in about 0.4 s (traced in the
  console: left, saved words matched, written). Removed with the command line; graph matched.
- Escape: the shadow went, the caret stayed, leaving wrote nothing.
- Today's journal, "Queasy after lunch #Symptom log" (picked from Logseq's list): the shadow came once the tag was
  saved ("Date: Oct 20"), leaving filled it, the bar read "Date: Oct 20 filled in on “Queasy after lunch” · Undo",
  Undo emptied it. Removed; graph matched.
- The note under the Aug 25 dietitian: quiet, by the one-place rule (Hannah Reyes could be the doctor or the "with").
  The done list expected a fill here; the rule is right and the done list was wrong: with the graph's Appointment
  having both doctor and with, no one can say which. This is a guess for piece 2 (a click), not a sure piece.
- Jul 17 (two doctors in the note): quiet, by the scorer; not tried on screen.

**The owner, during the trials:** the examples use nodes with far more properties than they would ever have
(Consultation: 10 with what it inherits; Appointment 7, Medication 7). Trials on such nodes stopped. The whole test
graph is built that way; a decision for the owner (below).

**Mistakes of mine on the way:** a palette shortcut typed while Logseq had no keyboard focus went into a property's
value box as "Refinements: troubleshooting" with "+ New option"; Escape closed it, nothing was saved (graph check).
Lesson: after a click in the page, Logseq's focus can sit in a property box; press Escape before typing a shortcut.
Opening the Journals makes Logseq save a "Linked references" view block for the day, like the "All" view: removed after
leaving the page.

**Also found:** the plugin's self-check warns "block text not found" on the Pages list (a table of pages with no
block text); the foundation's, not this piece's; harmless; to fix with the self-check.

**Not checked in the app:** the parent rule (a tagged child under a tagged parent); the "becomes a #Doctor" piece
(no node in the graph has exactly one place for an untagged link).

**Tour (0.4.197):** 12 stops, rows with the title (61 to 158 ms), nothing of the plugin's moved, no errors, no
warnings; the shadow costs nothing on a page opened (it draws only while a bullet is in edit). Graph check after: as
it was (922).

**Second reading (before the commit):** two real faults, both fixed: after waiting for Logseq's save, the shadow was
taken anyway when the saved words never matched the typed ones (a link deleted just before leaving would still have
been written); now nothing is written unless the saved words match. And the match itself never held for a bullet
linking a journal day or a block, or one with several lines; the comparison now leaves links out (but counts them)
and reads the whole bullet. Two rules taken out of the sure pieces on its advice: an untagged link given the tag a
property takes (a topic page would have been made a person: "discussed [[Insurance]]" → with: Insurance) and the
parent record's values (a follow-up nested under its first visit would get that visit's date). Both are guesses for a
later piece. The carry-over of the old "Properties in the line" graphs into the new setting was taken out: the owner
names the graph in the setting (done for the Illness Test Graph during the trials). Noted, not changed: a second Undo
bar replaces the first; a text property edited in a textarea inside the block could be read as the bullet's words
(not seen in 2.0.2).

**Waits on the owner:** a realistic test graph. Every tag here carries 3 to 10 properties; the owner would have 2 to
4. The rules get surer with fewer properties (no "with" beside "doctor"), so the next piece should be measured on a
graph shaped like the owner's own.

## 2026-10-20 · Two-way links: full workup, and the fold arrow before the list (0.4.195)

**Done means:** on a page that nodes point at, each property that points here is a row with every such node, in
order (coming up first, then the past, then undated), with the right counts; the row folds from an arrow just before
its list (the owner's ask); a node opens on a click, in the sidebar with ⇥ or Shift-click; resting on it shows its
card; the property's name opens the property; kinds filter the list; show all / show fewer and "earlier" work; + makes
a new node pointing here and Undo takes it away, leaving the graph as it was.

**Changed on screen (0.4.195):** the fold arrow sits just before the list ("▾ 8 Infusions, …"), not after the count.
A first try put it before the row's name; the owner meant before the list, so it moved there before the commit.

**New check:** `tools/two-way-check.js` runs the plugin's own row-finding on the real Illness Test Graph through the
command line and compares it with an answer key worked out from every raw fact: 48 pages, 62 rows, 251 links, all
the same; order and counts right; Dr. Mei Chen is the doctor of 13. Breaking the order and the same-page rule on
purpose made it fail (9 problems); put back. In `check.sh`, skipped where the command line cannot read the graph.

**Seen in Logseq (0.4.195):** on Dr. Mei Chen, the arrow opens and folds; show all 13 with "earlier" before Oct 7 and
show fewer; Consultation 3 shows only the three; resting on Review after cycle 6 shows its card (tag, day, fields);
on Northgate, Chemo cycle 4's card also shows its first line ("Bring the pump bag back"); a click opens the node, ⇥
opens it in the sidebar; "doctor of" opens the doctor property. + on "doctor of", Consultation, "Test visit": added to
today's journal, the row read 14 at once; Undo took it away; graph check matched. + on "works here" at Northgate,
Doctor, "Dr. Test Person": "As a new page", added at once; Undo took it off the row, **but Logseq kept the page in its
recycle bin** (the graph check caught it); removed with `logseq remove page --id … --force`; graph matched.

**Owner's pick (kept as is):** Undo after + on a page leaves the page in Logseq's recycle bin, so anything written in it is not lost. Logseq 2.0.2
has a plugin call to delete a recycled page for good (`delete_recycled_page_permanently`); using it would make Undo
leave nothing, but a page opened with "Add and open" and written in before Undo would then be gone for good.

**Noticed:** a property named "with" reads "with of" on the other page (Ruth Okoro, Zoë Müller); its wording can be
set on the map. Logseq's own search (Cmd+K) found nothing for "Dr. Raj Patel", which exists; Logseq's, not the plugin's.

**Tour (0.4.195):** 12 stops, rows with the title (52 to 75 ms), nothing of the plugin's moved, no errors, no
warnings. Graph check after: as it was (922).

**Second reading:** nothing wrong in the arrow move. The new check could have started a command-line server for the
graph when the app was not on it (leaving the graph unusable in the app), would fail if the doctor row were turned
off or reworded, and had no time limit; all fixed: it now runs only while the app has the graph open.

**Not checked:** "Leave out Logseq's tag lists" switched off; a graph big enough for the one-look-up limit (5,000 links).

## 2026-10-20 · Every edit on the tag map tried in Logseq (0.4.193, 0.4.194)

**Done means:** each map edit never tried in the real app is made once in the Illness Test Graph, seen, undone, and
the graph check matches after each; whatever fails is fixed with a check first.

**Seen in Logseq (0.4.192, on #Report):**
- *Renaming a property* (summary → "summary test"): renamed on the map with Undo; Undo put it back. Graph matched.
- *Renaming a tag* (#Report → "Report test", with r): renamed with Undo; Undo put it back. Graph matched.
- *Changing what a link accepts* (ordered by: added #Appointment): showed "#Doctor, #Appointment" with Undo; Undo put
  it back. Graph matched.
- *Renaming a choice* (Unclear on result): renamed everywhere, but the message had no Undo (the only map edit
  without one); renamed back by hand. Graph matched. **Fixed in 0.4.194**: the message has Undo; seen working.
- *Moving a choice*: **failed.** Up: Logseq refused ("DB write failed with invalid data"). Down (Normal): Normal
  went last with the same place number as Unclear, and Logseq wrote "result: Normal" on the result property's own
  page. Put back: Logseq's Cmd+Z once (the order came back, with another place number), the stray value removed with
  `logseq upsert page --id … --remove-properties`, the place number set back with `logseq upsert block --id …
  --update-properties '{:block/order "b1A"}'` (the command line does write `:block/order`). Graph matched.
  **Fixed in 0.4.193**: no ↑/↓ in the choices panel; "Add or reorder in its settings ⇥" opens the property in the
  right sidebar, and the note says where Logseq's own list is (the column headed with the property's name →
  Available choices, where choices have drag handles; seen, not dragged).
- *A tag's description* (Add a description … on #Report): shown under the tag with Undo; Undo took it away. Graph matched.
- *Two-way wording* (ordered by → "ordered test"): Undo worked; done again, Dr. Mei Chen's page read
  "ordered test → 7 Reports"; emptied again, the settings back exactly as before.
- *Turning a row off* (ordered by): the map said "not shown there", Dr. Mei Chen's page lost the row; Turn on put it
  back; settings exactly as before.

**The error after renaming (item 2):** Logseq's own title editing (Nausea → "Nause testa" → Nausea) logs no error;
each rename through the plugin call (`logseq.Editor.renamePage`, tag or property, and its Undo) logs Logseq's
`TypeError … 'toLowerCase'` for `:page/renamed`. Logseq's own fault in its plugin rename; the rename itself is done. Moving on.

**Checks:** `check.sh` passes. New `tools/tags-test.js` (pretend window): an open property box stays with its own
property after a redraw (fails with the 0.4.192 line taken out; the missing ratchet from that reading), the choices
panel offers no moving, a renamed choice can be undone. One `check.sh` run failed while Logseq was busy (that run's
map timings were 2 to 3 times the usual); three runs after it passed.

**Tour (0.4.194):** all 12 stops; rows came with the title (53 to 107 ms); only Logseq's own blocks moved (Appointment
0.28 on its first visit, as known); no console errors; the plugin's warnings 0. Graph check after: as it was (922).

**On the way:** opening the result property in the sidebar made Logseq save "All" views for result and kind; removed
only after closing them in the sidebar (removed while open, Logseq made them again at once).

**Second reading:** nothing wrong in the plugin; one misspelt call in the new test's failure path and a stray blank line, both fixed.

**Not checked:** removing a choice (every choice in the graph is in use; removing has no Undo, by Logseq's limit);
dragging choices in Logseq's own list.

## 2026-10-20 · Faster map and choices within Logseq's limits (0.4.190, 0.4.191)

**Done means:** the faster tag map on main; making a choice its own child tag keeps the old choice and Undo puts the
graph back exactly; "Add a choice" leads to Logseq's own settings instead of failing.

**Owner's pick:** keep the old choice in the list when it becomes a child tag; the owner removes it when nothing needs it.

**Checks:** `check.sh` passed; the tag map redraw on the pretend 600-tag graph shows a change in 105 to 124 ms, nothing
moved, with the limit back at 0.4 s.

**Seen in Logseq (0.4.191):** the dialog for "Pathology" on #Report says the choice stays. Making it moved both
pathology reports (28 tags, 23 reports), the message read "2 nodes moved to #Pathology; “Pathology” is still a choice
of kind", and Undo brought back 27 tags and 25 reports; the graph check matched the fingerprint exactly. The choices
panel shows "Add a choice in its settings ⇥", which opens the kind property in the right sidebar.

**On the way:** the dialog had grown a line, so two clicks at the old place of its button missed (nothing happened,
the graph check agreed). Opening the kind property's page made Logseq save an "All" view; removed.

**Not checked:** renaming a tag, changing what a link accepts, renaming or moving a choice, description editing.

**Second reading (0.4.192):** nothing that harms the graph; one real fault (after a redraw, an open property's box
could stay for another property that looked the same, so its Change acted on the wrong one) and three small ones
(Make could run twice; Escape did nothing in a choices panel without choices; wrong version notes). All fixed. No
picture or test holds the first one yet: the pretend graph would need two open text properties; to add.

## 2026-10-20 · Second reading, tour fixes, merged (0.4.189)

**Second reader:** nothing serious; three small faults in the tour (a logged value that cannot become text could break
the logging, two quick starts could run two tours, ending mid-stop left its measuring running) and two lesser ones.
All fixed in 0.4.189.

**On main:** the checking system, the tour, the dark-mode fix and these fixes, merged and pushed; the Mac folder is on
`main`. The faster tag map and the child-tag action stay on `claude/project-thread-ocmi6u` until the owner decides how
the child-tag action treats the old choice. On main the tag map's speed limit for a change is 1.5 s (the map there
takes about 1 s on the Mac); it goes back to 0.4 s when the faster map joins.

**Seen in Logseq (0.4.189), light theme:** Dr. Mei Chen, Appointment, Nausea and Northgate Cancer Center look right;
the rows come with the title (42 to 87 ms), nothing of the plugin moved, no errors. Starting the tour again ended it
at once, wrote "ended early" and put the dark theme back.

## 2026-10-19 · Trial run on the tag map close-out

**Done means:** the tour runs in the real app; the faster tag map (`f9c6d88`, `38eb6f3` from the "Close out map work
on Mac" session) and its child-tag action work, and Undo puts the graph back exactly.

**Tour (0.4.187, dark theme):** all 12 stops visited. The plugin's rows came with the page title (36 to 51 ms after
opening), nothing of the plugin's moved, Logseq logged no errors, the plugin no warnings. Only the Appointment tag
page moved (score 0.28 on a first visit, 0.05 on the second), all of it Logseq's own table filling in, as known. The
tag map opened and drew normally with the faster redraw.

**Found and fixed (0.4.188):** the troubleshooting box and the settings window were see-through in dark mode. Cause:
Logseq 2.0.2 leaves `--ls-primary-background-color` and its siblings unset in dark mode. A picture of the box over a
page now holds it in place. Seen fixed in the app.

**Found, not fixed (needs a decision):**
- *Adding a choice from the map has never worked in the real app.* Logseq refuses it ("Invalid data writing to db!").
  Logseq 2.0.2 lets a plugin turn only an existing value of the property into a choice, and does not let a plugin
  make a new value for a property it did not create (`ensure-property-upsert-control`, `add-existing-values-to-closed-values!`
  in Logseq's own code). One fix tried (set the value on the property's page first): Logseq would not make the value.
  The way out that fits the map's other limits: "Add a choice" opens the property's own settings in the sidebar.
- *The child-tag action works, its Undo does not.* Making "Pathology" (kind, on #Report) its own child tag moved both
  pathology reports to #Pathology with every value kept, cleared the old value and removed the choice. Undo then
  failed at its first step, bringing the choice back, for the reason above. Logseq's own Cmd+Z does put it all back
  (nine steps), but also leaves "kind: Pathology" on the kind property's own page, which had to be taken off by hand.
  Decision for the owner: keep the choice when making the child tag (Undo then works fully, and the unused choice is
  removed from the map afterwards), or remove it and accept that Undo cannot bring it back.

**Graph check:** caught every leftover. Twice the test edits were not undone at first (once the Undo bar had gone
before it was pressed, once Undo failed); both times the graph check named exactly what differed, and the graph was
put back until it matched (922 pages and blocks).

**Mistakes of mine on the way:** typing into the developer console through the screen missed once and the keys went
to Logseq: it opened Settings → Keymap and the right sidebar. Nothing in the graph or the shortcuts changed (checked);
both closed again. Lesson in PROCESS.md: no typing into the console through the screen.

**Not checked:** light theme in the real app (the tour started in dark, and its light stop came last); renaming a
tag, changing what a link accepts, renaming or moving a choice, description editing (item 4 of the close-out).

## 2026-10-19 · The checking system itself

**Done means:** every check in PROCESS.md runs on the Mac; a deliberate change makes the pictures fail; the graph
check says the test graph is unchanged when nothing was done.

**Changed:** nothing on screen in normal use. New: node installed in the home folder (`~/.local/node`, linked from
`~/.local/bin`), with jsdom, Playwright and its Chromium in the project's `node_modules` (not committed). New checks:
`tools/pictures.js` (tag map and two-way rows, light and dark), `tools/graph-check.js` (fingerprint of the test
graph). The tag map speed limits on the Mac went from 3 s / 3.5 s to 1 s / 0.4 s. A troubleshooting tool, "Take the
tour (F8 for the next stop)".

**Checks:** `check.sh` all passed, including the boot test, 123 model checks, the tag map speed (first drawing 317 ms,
changes 102 to 132 ms, nothing moved) and the four pictures. Changing one number in the two-way rows made both
two-way pictures fail, as it should; put back. The graph check saved and compared the Illness Test Graph: 922 pages
and blocks, as it was.

**Not checked:** the tour in real Logseq. The screen was locked, so Logseq could not be controlled.
