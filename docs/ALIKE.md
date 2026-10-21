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
- `parts/shadow.js`: builds the index from the history it already reads (`addHistory`), asks for neighbours in
  `guessesFor` (how: `alike`).
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
