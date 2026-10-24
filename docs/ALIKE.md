# The "looks like" engine (proposals, piece 3)

Started 2026-10-20 at the owner's word: the guess rules were "too based on the current graph instead of developing a
more dynamic and fluid system with less friction". One mechanism in place of rules: **a new bullet is filled the way
the nodes it most resembles were filled.** Nothing is tuned to the Illness Test Graph; the graph itself is the only
knowledge, and it changes as the owner writes.

## What it does

1. Every node under a tag with link properties is remembered as a bag of tokens: its words (lower-case, lightly
   stemmed so "flagged" and "flagging" meet), the pages it links (`link:id`), and its tags (`tag:id`). Rare tokens
   weigh more (inverse document frequency); "neutrophils" says more than "day".
2. While a bullet is written, its tokens are made the same way and the nearest nodes are found (cosine over the
   weighted bags, through an inverted index: only nodes sharing a token are touched).
3. For each empty property of the record, the nearest nodes that hold it vote for their value, each with its
   similarity. The leading value is proposed as a guess when it is clearly ahead and the nearest node is near enough.
4. The engine is one voice among the readers of what is literally in the words (a link, a name, the journal day);
   as before, the guess rules that speak must agree, or nothing is proposed. The old "same line written before" rule
   is a special case of this engine (similarity near 1) and goes.

What stays as it is, because it reads the words rather than the graph: a page linked ([[Dr. Mei Chen]]), a page named
in plain words ("Dr. Patel"), the page the record is written on, the journal day, the parent's values, a linked page
with no tag yet. Later stages add the plain-language reader (dates and numbers in words) and the pencilled tag line
for an untagged bullet; both are listed in CLAUDE.md section 7.

## Where it lives

- `parts/alike.js`: the engine alone (`buildIndex(entries)`, `neighbours(index, query, options)`, `tokensOf`). No
  DOM, no Logseq; a part like the model, loaded before `parts/shadow.js`, which takes it from the core.
- `parts/shadow-rules.js` (since the split of 0.4.268; `parts/shadow.js` before): builds the index from the history it
  already reads (`addHistory`), asks for neighbours in `guessesFor` (how: `alike`).
- `tools/alike-test.js`: the engine on a small pretend set (what it must and must not find), and its speed on a
  pretend graph of 20,000 nodes. Run by `tools/check.sh`.
- `tools/shadow-check.js`: the scorer on the real graph; the scoreboard below is its output.

## The measures (the scorer, every property hidden in turn, 100 cases on the seed graph "Seed Check")

The rule for every stage: **wrong stays 0 for sure pieces and at most 1 for guesses; right never falls; silent falls.**
A guess costs a look; a wrong fill taken by habit is the one thing that must not happen.

| Stage | Sure right / wrong | Guess right / wrong | Silent | Note |
|---|---|---|---|---|
| 0.4.211 before the engine | 54 / 0 | 23 / 1 | 22 | 15 of the guesses from "the same line before" |
| A engine built, not wired | 54 / 0 | 23 / 1 | 22 | pretend checks and timing only; 20,000 nodes: index 30 ms, a key 2 ms |
| B engine in place of "same line before" (k 5, nearest ≥ .5, lead .7) | 54 / 0 | 23 / 1 | 22 | the same 15 guesses, now by the engine (how: alike) |
| C the sweep, 24 settings; picked k 5, nearest ≥ .3, lead .7 (0.4.212) | 54 / 0 | 26 / 1 | 19 | nearest ≥ .2 let in 3 wrong (lines sharing only "day", "this morning"); k 10 gained nothing; the lead made no difference above .2 |

## Stage D: the tag of an untagged bullet (0.4.213)

A bullet with no tag, and no record above it, is tokened by its words and links alone and compared with every node
under a tag the model knows (a tag with properties, or in a tag hierarchy). The nearest nodes vote for their tag.
A tag costs more when wrong than a property (its properties follow it), so the tag has its own, stricter limits:
`limits.tagNearLeast`, `limits.tagLead`, and `limits.tagLeast`, the least number of nearest nodes that must agree.

Where it shows: the tag is pencilled where Logseq would show it, a "Tags" pill under the bullet, dotted; beside it
the properties that tag gives, filled by the usual rules as if the tag were there, every one a guess. Enter takes
the tag first and then the values, under one Undo; leaving any other way takes nothing (a tag is never sure).

The measure, two counts on the seed graph:

- every tagged record with its tag hidden: right / wrong / silent;
- every untagged bullet (the plain notes of the journal, "Hair cut. Silly thing to do but I wanted to."): spoke
  (a tag proposed on a plain note, the one thing that must stay at zero) / silent.

| Stage | Tag right / wrong | Silent | Plain notes spoke / silent | Property guesses | Note |
|---|---|---|---|---|---|
| D1 built, limits as the properties' (.3, .7, 1) | 28 / 9 | 42 | 6 / 199 | 26 / 1, silent 19 | Logseq's own #Task was proposed on addresses; a planned operation taken for a hospital stay, a call for a visit |
| D1 with only the owner's own tags voted | 28 / 7 | 21 | 5 / 223 | 26 / 1, silent 19 | 56 records, 228 other bullets once Logseq's tags are left out |
| D2 the sweep, 36 settings; picked nearest ≥ .6, lead .7, agreeing ≥ 1 (0.4.213) | 22 / 0 | 34 | 1 / 227 | 26 / 1, silent 19 | the one plain note is "Blood again this morning. Third time this month.", offered #Symptom Log: the feature working |

What stage D showed: the tags the engine gets right are the ones whose lines repeat (symptom logs, chemo cycles);
it is silent on a line of its own kind, and loosening the limits trades that silence for wrong tags between
neighbouring kinds (Consultation and Conversation, Expectation and Hospitalization), which the words alone cannot
tell apart. Agreement of two or three nodes bought nothing the nearest-node floor did not.

## Stage E: dates and numbers in words (0.4.214)

The plain-language reader: what is literally in the words, read the same in every graph. Not the engine, but the
same discipline: a stage, a scoreboard, the limits set by the scorer.

- **A date in the words**, for an empty Date of a record that nothing sure or no other guess fills: a weekday ("on
  Friday", "next Tuesday": the coming one, counted from the journal day the bullet is written on), "tomorrow",
  "today", "yesterday", a day of the month ("on the 4th": the next 4th), a day and month ("4 Aug", "Aug 4th"),
  "in 3 days", "in two weeks", a full date. One date found is a guess, dotted; two different ones, nothing. A
  journal page the day does not have yet is made when the guess is taken, as Logseq would.
- **A number in the words**, for an empty number property named beside it ("Chemo cycle 5 done" fills Cycle 5;
  "3 cycles" too). A guess.

The measure: the scorer now hides number properties as well (Cycle on treatments). Before this stage the silent
cases that are dates in words: "Colonoscopy on Friday", "CT scan on Tuesday", "Operation on the 4th. In at 7." (all
Expectations, planned ahead).

| Stage | Sure right / wrong | Guess right / wrong | Silent | Note |
|---|---|---|---|---|
| 0.4.213, with number properties counted (128 cases) | 54 / 0 | 26 / 1 | 47 | Severity on every symptom log and Cycle on every treatment now count |
| E dates and numbers in words (0.4.214) | 54 / 0 | 32 / 1 | 41 | words-day right 3, wrong 0 (the three planned Expectations); words-number right 3, wrong 0 (the chemo cycles). Found on the way: a number value is an entity holding the number, so the scorer reads it through `:logseq.property/value` |

Still silent after stage E: Severity on symptom logs (a number never in the words; the engine could vote on it from
the lines alike, a later stage), planned things with no date in the words ("Chemo cycle 5", "Flu jab"), Topic.

## Stage F: Option-Enter into dates (0.4.215)

Not the engine, but the same discipline. Seen in the app first (2026-10-21): an empty Date opens Logseq's own date
picker, a calendar with today marked and a text box under it ("e.g. Next week"). The keyboard is on the calendar:
letters typed go nowhere and Enter picks the marked day (today). A click in the text box and "next fri" with Enter set
Oct 30th, 2026 and closed the picker. So the design: Option-Enter on an empty Date presses it as before, then puts
the keyboard in the picker's text box; words and Enter set the day and move on; Tab skips; Escape comes back to the
words. The box is found by its placeholder ("e.g. …"), and the picker by the top-level element the box sits in, so
the plugin needs no class names of Logseq's. If the box is not found, the calendar keeps the keys (Enter picks the
marked day), and the plugin still moves on when the picker closes.

The measure: the pretend check (a Date opens a popup with the box; the box gets the keys; Enter there is left to
Logseq; Tab and Escape behave as in a list) and the look in the app. Nothing is guessed, so the scorer has nothing
to say.

## Stage G: the stress test (0.4.216)

A large scratch graph, "Stress Check" (made by `test/stress-graph.py`, imported with the command line, never opened in
the app): the seed plus 2020-01-01 to 2026-06-21, 31,000 bullets, 15,600 records, 3,100 pages with shared surnames.

| Graph | Sure right / wrong | Guess right / wrong | Silent | Tags right / wrong / silent | Tag on a plain note |
|---|---|---|---|---|---|
| Large, before the fixes | 20,866 / 0 | 8,763 / 1,400 | 9,277 | 12,750 / 50 / 2,799 | 45 of 8,620 |
| Large, after (0.4.216) | 20,866 / 0 | 9,128 / 41 | 10,271 | 11,250 / 1 / 4,348 | 1 of 8,620 |
| Large, honest (earlier days only) | 20,866 / 0 | 8,877 / 98 | 10,465 | 9,063 / 0 / 6,536 | 0 of 8,620 |
| Seed, after | 54 / 0 | 31 / 1 | 42 | 22 / 0 / 34 | 1 of 228 |

What it taught:
- **A name needs evidence too.** One word of a title is evidence only if the lines holding that word are mostly about
  that page (`wordsEarned`); a whole name stands alone. 1,381 wrong became 0 from that rule on its own words.
- **The tag is the words' to decide.** A link says who; with links in the vote, a call from a doctor seen mostly at
  consultations was voted a consultation. Plain lines vote "no tag", so a line like many plain notes stays plain.
- **The learning is real.** Honestly scored, wrong guesses go from 15 in the first month to about one a month after a
  year, on the same habits. More lines of the same kinds help; more look-alike names make it quieter, not wronger.
- **Timing is not the problem at this size.** Per key the plugin's own work stays under 3.5 ms and Logseq's two
  look-ups about 1 ms each; the cost is in the background reading every five minutes (0.8 s in Logseq's worker).

## Settings the engine has (in `parts/alike.js`, named so the scorer can try them)

- `limits.stem`: a trailing s, ed or ing taken off words of five letters or more.
- `limits.nearLeast`: the least similarity of the nearest holder for the engine to speak.
- `limits.lead`: the share of the vote (similarity squared) the leading value must hold.
- `limits.k`: how many nearest holders vote.

The numbers are picked by the scoreboard, not by hand, and written here with the stage that picked them. To try others:
`GRAPH="Seed Check" OWNER=any ALIKE_K=5 ALIKE_NEAR=.3 ALIKE_LEAD=.7 node tools/shadow-check.js --all`.

## What the sweep showed (stage C)

- The one wrong guess left is from plain words ("about the tingling" names Tingling fingers; the Topic holds Peripheral
  neuropathy), not from the engine. Once a few consultations about the tingling carry Peripheral neuropathy the engine will
  disagree with it, and the rules that disagree are silent: that is how it learns, by the owner writing.
- The wrong guesses at the loosest setting all came from common words ("day", "this", "morning") shared with one
  other line. The tag token gives every node of the tag a floor of similarity, so the floor of .3 is what keeps them
  out; a stop-list of common English words was not added (it would be a rule again). Watch this on a bigger graph.
- Still silent after stage C: dates written ahead (the plain-language reader, next), Topic on conversations with
  nothing alike yet, and symptom lines whose words appear nowhere else ("Dull ache on the right side").
