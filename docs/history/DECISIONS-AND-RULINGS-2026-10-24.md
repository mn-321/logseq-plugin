> **Record, not a plan.** Written 2026-10-24 at 0.4.381, when CLAUDE.md was cut down to a short handoff, so that the
> owner's rulings, what was tried and rejected, and what Logseq 2.0.2 taught would not be lost with it. Gathered from
> the logbook (`docs/LOGBOOK.md`, cited as LOGBOOK:line at 0.4.381), the CHANGELOG, CLAUDE.md as it stood that morning,
> `docs/DECISIONS-AUTONOMOUS.md`, `HANDOFF-2026-10-19.md` and the memory notes. Every entry is a fact about the past.
> The rules still in force are written as rules in CLAUDE.md, `docs/LAYERS.md` section 2 and `docs/MODELLING.md`;
> the current state is `docs/STATE.md`.

# The owner's rulings, what was tried and rejected, and what Logseq taught

## 1. The layer numberings

Two numberings were used. Old logbook entries and CHANGELOG lines can be read with this table.

| Until 2026-10-22 (CLAUDE.md section 3, the HANDOFF, the audit of layers 1 and 2) | From 2026-10-22 evening (`docs/LAYERS.md`, in force) |
|---|---|
| 1 Foundation: 1a the engine, 1b the model | 1 Talking to Logseq (engine, model, diagnostics) |
| (none) | 2 The kit (`parts/shared.js`) |
| 2 Links and properties (tag map, two-way rows, proposals, pickers, link selected text) | 3 Features |
| 3 How things show on each page (the page plan) | 4 Where things sit |
| 4 Getting around (sidebars, search, shortcuts, `p::`) | 4 Where things sit |
| 5 Cosmetics | 5 How things look |
| 6 Separate tools | 6 Separate tools |

CLAUDE.md kept the old list in its section 3 for its detail, with a note saying which numbering it used, until it was
cut down on 2026-10-24.

The renumbering came from the session of 2026-10-22 evening in which the owner settled the kit and commented on the
elements and views pages (LOGBOOK:772: "there is no cohesive use of layers"; "define the consistent shared parts";
"ok plan"). So "layer 2's list" in entries of 2026-10-21 (link selected text, the pickers, the one Undo, long names in
two-way rows …) is layer 3 today, and "layer 3" in CLAUDE.md of 2026-10-23 ("trimmed again and begun, 0.4.336") is
layer 4 today. The audit of 2026-10-22 morning, "closing layers 1 and 2", audited the foundation and the features.

## 2. The owner's rulings, newest first

Each with its version, the record it is in, and the owner's words where the record has them. "Session's choice"
marks a choice made without the owner (those of 2026-10-23 are in `docs/DECISIONS-AUTONOMOUS.md`, each with how to
flip it). Where a later ruling changed an earlier one, both say so.

**2026-10-24**

- 0.4.381: two-way rows wrap like words; the into-a-node arrow a list icon on the right. "can you allow properties to
  wrap naturally if necessary so it looks more natural. also, it is too crowded with the box and chevron for another
  bullet" (LOGBOOK:7).
- 0.4.379: the suggested links learn. "the replay score first, then offer links by how often the words are linked in
  my graph (and what I take or ignore), with the bullet's empty properties as a boost. Show me the scores before and
  after." (LOGBOOK:24).
- 0.4.378: the two-way rows line up. "this has become really clunky ui"; on a sketch with the day first: "it is not
  about dates. the issue is alignment of second column and you can underline the words of a whole sentence"; "it is
  fine if properties follow the end of a wrapped line" (LOGBOOK:40).
- 0.4.377: "add the map in the shortcuts section of main app with g m" (LOGBOOK:52).
- 0.4.376: two-way row ideas 1 to 3 built: "just write 1 to 3" (LOGBOOK:56). Earlier that morning the owner had kept
  five ideas from the ideas page "but not yet" (memory note; `PROMPT-TWO-WAY-VALUE-2026-10-23.md`'s outcome note);
  ideas 4 (follow a chain) and 5 (a row two steps away) were explained, not built. Rejected on the way: tables and
  boards, journal-based rows, "+ Link" from the page that holds the property, mentions into links, dragging nodes
  between pages or onto a row kept in the sidebar, "new since last visit".
- 0.4.375: "I meant number of nodes with that tag next to its name. same style as this", replacing 0.4.374's count of
  tags inside, which had read "put number of tags for each tag" the other way (LOGBOOK:74, 78).
- 0.4.373: the tag map's Tags | Properties picker on top, Select with tick boxes in both views, a property's own page
  from its menu (LOGBOOK:82).
- 0.4.372: suggested links wait for five letters and a pause: "suggestions are popping too often just with a couple
  letters. it is somewhat distracting" (LOGBOOK:92).
- 0.4.371 and 0.4.368: the description is the key i, shown beside the menu item: "no i just wanted i as a shortcut like
  connected to items in the contextual menu"; "no, I just wanted I as a shortcut on keyboard", replacing 0.4.367's i
  button (LOGBOOK:122, 129, 136).
- 0.4.369: a taken link underlined with its brackets hidden while the bullet is written: "is there a way to underline
  the work that will become a link while I type instead of [[ ]] … just for the first time"; then "smooth now"
  (LOGBOOK:109).

**2026-10-23**

- 0.4.366: no ⇪ mark, Right arrow takes a suggestion: "I don't like the caps arrow you created. also add right arrow as
  well to be able to complete" (LOGBOOK:143).
- 0.4.365: "why is there a chevron? the quotes should be the bullet" (LOGBOOK:151).
- 0.4.364: PDF quotations rebuilt: "What happened to the quotes and the citation style that was in an earlier
  version?" (LOGBOOK:158).
- 0.4.362: the Hyper tap takes a suggestion and Tab stays Logseq's indent: "Wait tab moves a bullet though"; this
  overrode the session's choice of Tab at 0.4.361 (LOGBOOK:188, 198). Branch `inline-links` merged at the owner's word
  after trying it.
- 0.4.361: suggested links begun on a branch: "a separate tree or branch to build on proposals to now suggesting
  wikilinks in line almost like autosuggestion like on an iphone … complete with a space or tab or maybe a hyperkey"
  (LOGBOOK:198).
- 0.4.360: from the owner's main computer, after "did you really assess the most basic things": proposals in every
  graph (`shadowSkipGraphs`, "Not in these graphs", in place of a list of graphs to write in), the journal day as a
  guess for any empty Date, right-click menus staying open in an installed copy (LOGBOOK:211;
  `docs/DECISIONS-AUTONOMOUS.md` 21).
- 0.4.346 to 0.4.359: the finishing push, at "read FINISHING-PROMPT.md and run" and "you can take over screen anytime"
  (LOGBOOK:440). Its choices are the session's, in `docs/DECISIONS-AUTONOMOUS.md` 1 to 20: the editor part's commands
  judged one by one and the part deleted (18), the properties and links parts judged (19), the export and Todos rest
  (20), search's extras rest (17), three of chrome's pieces back and two rest (16).
- 0.4.352: no ring of the plugin's own, by the finishing prompt's line ("the plugin draws no ring of its own anywhere;
  Logseq's stays"); Logseq's ring had come back at 0.4.343 at the owner's word (LOGBOOK:336).
- 0.4.345 to 0.4.339: the greys of property names and values, settled by looking: "properties should be this light?
  isn't there spec for this somewhere?" (0.4.339); "no it should be lighter, not full black" (0.4.340); "why are there
  two different colors for values?" (0.4.341); "the link should have an underline" (0.4.342); "But I use keyboard. I
  didn't say make values lighter than property labels. just revert to this", Logseq's ring back on a focused pill,
  reversing 0.4.342 (0.4.343); "you made it even worse" (0.4.344); "why don't you just make it like this. you keep
  making ordered by darker. do the lighter version" (0.4.345) (LOGBOOK:461 to 485).
- 0.4.338 and 0.4.337: layer 5 begun: "can you implement the subtle ui changes laid out in plans like docs/ELEMENTS.html
  especially Proposed values. don't add the double arrow icon"; "don't take everything from old code. take it and mold
  for newer decisions" (LOGBOOK:489, 493).
- 0.4.336: layer 4 settled (LOGBOOK:497; memory note): **no tag summary box** on tag pages ("I already decided no to
  this"), which reversed CLAUDE.md's plan of 2026-10-21 to bring it back first; **no `p::` typing**; the scroll-bar
  room dropped after looking ("I am unfamiliar with this plan"; a long and a short page sat at the same spot, the Mac's
  scroll bars take no room); yes to hiding the words by the title with their room kept (already said 2026-10-21: "hide
  text but keep space"); "yes, begin this" for the sidebar, search and getting-around parts one at a time.
- 0.4.335: several links show one arrow, not two: "you can change the linked property with multiple back to a normal
  right pointing arrow"; an icon the owner gave a property overrides (LOGBOOK:501), reversing 0.4.334's arrow twice.
- 0.4.334: "why don't the properties of pages not have the icons of the tag map page?", "yes do that" (LOGBOOK:505).
- 0.4.333 to 0.4.328: the tag path by the title: "All I care about is hierarchy of tags. What would cause less
  movement"; "yes build it and make sure each is clickable"; "you don't need to underline mono-style tags. they should
  always be clickable" (0.4.332); "actually it is redundant to have the name of the tag on the tag hierarchy" (0.4.331,
  which replaced 0.4.330's own name at the top); "what is jumping or actually sliding up is the two-link table"
  (0.4.333) (LOGBOOK:509 to 529).

**2026-10-22**

- 0.4.327: the picking bar on one line, Select all, the sidebar icon at the far right (LOGBOOK:533).
- 0.4.325: the bar's room always kept: "that space is fine. allows breathing room" (LOGBOOK:541).
- 0.4.322: the bullet being written keeps its empty properties, faint, so its line no longer comes and goes ("ok"),
  narrowing 0.4.242's hidden empties (LOGBOOK:553).
- 0.4.320: "move tags for two-way link next to item, not right aligned", reversing 0.4.297 and 0.4.299 and the
  grammar's "tags at the right edge" (LOGBOOK:561).
- 0.4.311 to 0.4.319: the kit built and every feature moved onto it, in the order of `docs/LAYERS.md`: "Build the kit
  and move each feature onto it … one change per commit … each change reloaded and looked at in Logseq … where
  LAYERS.md and the pages differ, the pages win" (LOGBOOK:745). Late that day: every proposed value italic with a
  dotted line, sure or guessed, "they are essentially the same thing" (built 0.4.315).
- The grammar of `docs/LAYERS.md` section 2 (the plugin fades away; differences by weight and grey, not boxes; no
  colour of the plugin's own; a tag is a class in mono without #; property names lighter than values; a value's kind as
  an icon; nothing assumed about a new node's tag; actions in stages; Undo the faded arrow; plain words), from the
  owner's comments on the elements and views pages (29 and 6 comments, LOGBOOK:772).
- 0.4.310: the tag map's Tags view editable in place: "can you create a separate session that consolidated the design
  and editability of the tags trees" (LOGBOOK:795).
- 0.4.309: new choices made from the map through Logseq's own box: "I cannot add choices. I understand that changing
  the type of property a plugin cannot do, why can't a plugin do this. and not via the property page"; "Yes, build Add
  a choice the same way" (LOGBOOK:828).
- 0.4.308 and 0.4.307: a property's nodes in the Properties view, only when asked: "i don't need them present all the
  time like this. have show nodes some can show, then show all to see all. make sure it can potentially handle
  hundred" (LOGBOOK:848, 860).
- 0.4.305: "I want the Properties page to be useful and not just seen. It should allow creation, the editing, the
  convesion, for example of a list of choise to a linked property of nodes. You can design it like an actual outline
  logseq if that makes code easier"; Turn into links asks the new property's name and the pages' tag (LOGBOOK:872).
- 0.4.304: "allow name or date to be chosen for each group through a right click" (LOGBOOK:911).
- 0.4.303 and 0.4.302: adding from the two-way rows: "Nothing is this poorly designed elsewhere in the app. the staging
  and elements that appear is awful" (0.4.302, ending the + box of 0.4.298 and 0.4.300); "no the point is to create it
  from this page and you can decide where to put it"; "before the plus button used to be on at the end of the last item
  in each group. return that code" (0.4.303, ending 0.4.302's sidebar) (LOGBOOK:922 to 938).
- 0.4.301: two-way tags drawn as Logseq's own #tags: "also make the tags look like normal tags"; reversed by the
  grammar of that evening and 0.4.318 (tags in mono) (LOGBOOK:951).
- 0.4.298: "should be New `Consultation` Record – Property: Value … put tag in mono" (the owner's own word "record",
  LOGBOOK:985).
- 0.4.297: "the tags under decided should be right aligned and plus should be placed to the left of the property name
  but on hover"; "make checkbox tap area bigger" (LOGBOOK:999).
- 0.4.296: "all these are useless" (eleven faded arrows): the tag map's Undo, the last three only (LOGBOOK:1014).
- 0.4.295 to 0.4.292: the audit's decisions: split the tag map ("then do 1"); the tidy-up ("clean"); Escape clears the
  proposals until the next letter typed ("What is usually normal in general", replacing "until the bullet is next
  edited"); choice guesses dropped ("Drop", after 255 wrong on Stress Check, reversing 0.4.265) (LOGBOOK:1027 to 1063).
- 0.4.291: no ring on a property row Logseq already greys: "I don't know if it is necessary if a caret is already
  there" (LOGBOOK:1070).
- 0.4.285 to 0.4.290: the design audit: "remove excess design and padding and make things inline instead of this big
  central popovers. This isn't about a stylesheet, but a basic aspect of design." (LOGBOOK:1143).
- 0.4.284 and 0.4.283: "visual transitions are not smooth. you select a proposal and things flash, you open a pages and
  elements move. look up official documentation"; "Did you do a full UI analysis, using measurement …?"
  (LOGBOOK:1163, 1186).
- 0.4.280 and 0.4.281: installable from GitHub: "are you able to do this so I can install this on my other computer
  from my private github repo?"; the repo made public by the owner ("ok it is public. try it now") (LOGBOOK:1220,
  1233).
- The audit: "close layers 1 and 2" (LOGBOOK:1244).
- 0.4.272 to 0.4.270: stepping through a bullet's properties with Tab, Shift-Tab, Left, Right and Down, the ring inside
  the capsule (LOGBOOK:1325 to 1349); "but the plugin doesn't hide that, logseq hides it when you say hide by default".
- 0.4.269: "ok do it": each part stands on its own (LOGBOOK:1364).

**2026-10-21**

- 0.4.268 to 0.4.252: "lets go in order", through the list given to the owner: link selected text (0.4.252, refined
  0.4.254 to 0.4.256: "it should be empty not test which was the selected text"), the pickers (0.4.253), long names in
  two-way rows (0.4.261; "get rid of the sentence character limit", 0.4.263), odd wordings (0.4.264), numbers and
  choices (0.4.265: choices yes, numbers by vote no), why a guess on hover (0.4.266), learning at once (0.4.267),
  splitting the proposals' code (0.4.268) (LOGBOOK:1377 to 1502).
- 0.4.262: "just make the different links and elements of the hover clickable" (LOGBOOK:1420).
- 0.4.259: "instead of ctrl enter accepting proposals but not creating a new bullet, make it cmd-opt-enter", replacing
  0.4.242's Ctrl-Enter (LOGBOOK:1443).
- 0.4.258 and 0.4.257: "we have created a lot of things that use different elements instead of a consistency"; "make
  one pop-up, one Undo and one dialog" (LOGBOOK:1449, 1460). Undo has no time limit.
- 0.4.251: "continue to disable the document exporter … no capsules around properties. all cosmetic must still be
  disabled", ending 0.4.244 to 0.4.249's export (LOGBOOK:1511).
- 0.4.250: "lets get rid of the old code related to pencil and old proposals" (LOGBOOK:1520).
- 0.4.244 to 0.4.249: the document export switched on and worked on: "Can we enable the document export and focus on
  that … a big focus will be on timetable"; "get rid of that … just keep alias" (LOGBOOK:1528 to 1566). Switched off
  again at 0.4.251; rests since (`docs/DECISIONS-AUTONOMOUS.md` 20).
- 0.4.243: property groups for the owner's own order, nothing written to the graph (LOGBOOK:1575).
- 0.4.242: a click on a proposal accepts it; empty properties hidden until something is proposed: "is it possible to
  keep properties hidden until there is a proposal?"; "I thought clicking on a proposal accepted it"; "if I click in an
  old bullet … I don't want to have to hit enter" (LOGBOOK:1584).
- 0.4.241: Turn into links to pages: "create future Specialty property, rename old property Specialty, then transfer"
  (LOGBOOK:1594).
- 0.4.239: proposals on a page's own properties: "It is fine if they appear since new pages are always being created
  that may apply to them" (LOGBOOK:1612).
- 0.4.238: "I should be able to right click \"report of of\" and edit display name" (LOGBOOK:1622).
- 0.4.236: a Properties view of the map, "and make the sidebar version of both tag and property view fully
  functional" (LOGBOOK:1636).
- 0.4.233 and 0.4.234: "make it clear like change \"Dr. Mei Chen\" to X"; "rename Unlink to Remove “Dr. Mei Chen”"
  (LOGBOOK:1654, 1659).
- 0.4.231 to 0.4.228: ticking two-way rows and acting on them together; "undo line removal" (reversing 0.4.230's
  "an underline is not necessary under pages"); tick boxes "to the left of the outline, not within it"
  (LOGBOOK:1671 to 1690).
- 0.4.227: property names in regular weight in the tag map, after "nevermind" and "show me difference" (LOGBOOK:1700).
- 0.4.226 to 0.4.224: every part reads the graph through the model: "is the setup of this plugin modular with concern
  of separation so things are not muddled" (LOGBOOK:1731).
- 0.4.223: "clean this up and remove all thes shortcuts and text and make just an outline" (LOGBOOK:1745).
- 0.4.221: the tag tree moves tags like bullets: "Don't need to have this label of root. just think in terms of
  levels" (LOGBOOK:1758).
- 0.4.220: Topic widened to 15 tags on purpose, "because topic is wide thing" (LOGBOOK:1773).
- 0.4.219: Enter takes guesses again, Option-Enter stops on them: "Why did you take away guesses from enter?", "can't i
  just fix it with option-enter", "do that", reversing the session's switch at 0.4.218 (LOGBOOK:1785).
- 0.4.218: Undo as a faded arrow: the undo toast "is in an awful place and loud and too far down and distracting. it
  should be something just where text is but very subtle, like a faded icon" (LOGBOOK:1799).
- 0.4.217: "fix them in that order: tests for writing and Undo, one leave path with the Escape fix, then the date
  reader" (LOGBOOK:1814).
- 0.4.216: "stress test them, both if they can work and timing" (LOGBOOK:1830).
- 0.4.215: "build Option-Enter into dates next, the same systematic way" (LOGBOOK:1848).
- On 2026-10-21 too: Logseq's own tag in the title's corner shown all the time ("one already exists in corner, it just
  fades away so show it full time"); a layout change and a look change kept apart; Logseq's tag lists hidden where the
  two-way rows are drawn belong to the rows (CLAUDE.md section 3 as it stood); the Illness Test Graph is free to drive:
  "you try again. I wasn't using it. this is just a test version" (memory note).

**2026-10-20**

- 0.4.214 and 0.4.213: "build dates and numbers in words as guesses, the same systematic way"; "build the pencilled tag
  line for an untagged bullet, the same systematic way" (LOGBOOK:1862, 1877).
- 0.4.212: one "looks like" engine in place of rules: the guesses "seem too based on the current graph instead of
  developing a more dynamic and fluid system with less friction"; no rules tuned to the test graph (LOGBOOK:1894;
  `docs/ALIKE.md`).
- 0.4.209: `[[example]]#tag1` with no space is the page's tag (LOGBOOK:1921).
- 0.4.207: "enter should go to next bullet on last enter" (LOGBOOK:1941).
- 0.4.202: Enter takes everything shown: "I prefer italic grey and then add dotted. I do not want to have to click on
  it to confirm ... enter confirms I like things. if I want to change things then maybe option-enter can move focus to
  the properties", reversing 0.4.200 and 0.4.201's click to take a guess (LOGBOOK:1981).
- 0.4.201: "all that is necessary is the name to appear in dotted line where it would be. don't add the extra text"
  (LOGBOOK:1997).
- 0.4.198: the Illness Test Graph reshaped on the owner's principle, written into `docs/MODELLING.md`: structure is
  extracted from free writing; a tag only when its nodes need properties others don't; a property only for what one
  would list or sort (LOGBOOK:2119 to 2125).
- 0.4.197: the proposals' design agreed: shown under the bullet, leaving takes the sure ones, Tab stays Logseq's
  indent, the words typed never changed (LOGBOOK:2170; later: Enter takes guesses, 0.4.202; Escape until the next
  letter, 0.4.293).
- Reports: "take a step back, your descriptions are confusing"; "please speak very simply. you speak convoluted"
  (memory note). The documents kept up: "make sure things are updated as things go" (`tools/docs-check.sh`).
- Two-way is on by default for every property, turned off only for a page so many nodes point at that the rows become
  clutter (CLAUDE.md section 5 as it stood).
- 0.4.195: Undo after a two-way + that made a page leaves it in Logseq's Recycle (the owner's pick, LOGBOOK:2275).
- 0.4.191: a choice made a child tag stays in the list (the owner's pick, LOGBOOK:2342).

**Before 2026-10-20** (`HANDOFF-2026-10-19.md`): the tag tree back on at the owner's word (0.4.152); Todos paused
(0.4.128); the look changes of the old `wip-uncommitted-look-changes` branch dropped (2026-10-13); one small change at
a time, each behind its own setting and its own commit; the session checks in the running app itself, never by handing
the owner steps.

**2026-10-23 and 24, about how proposals are shown to the owner** (memory notes): mockups show the tool's own abilities
on any graph, as a plain HTML page, never the Design canvas ("Never use that canvas again. just do like css or
artifacts"), with complex knowledge as the example, never tasks and meetings ("I work with complex things, not just
basic tasks and meetings"); a rejected idea is replaced by a new one, never reworked ("you are trying to rework the
ideas I didn't like").

## 3. Tried and rejected

From 2026-10-20 on (the logbook):

- Tab taking a suggested link (0.4.361): Tab is Logseq's indent (0.4.362). A ⇪ mark for the Hyper tap (0.4.362 to
  0.4.363, removed 0.4.366).
- An i button on each property for a description (0.4.367): the key i instead (0.4.368).
- The count of tags inside each tag (0.4.374): the count of nodes with the tag instead (0.4.375).
- The arrow twice for a property linking several nodes (0.4.334): one arrow (0.4.335).
- A tag's own name at the top of its tag path (0.4.330): only the tags above it (0.4.331).
- Values lighter than property names, and the plugin's own ring on pills (0.4.342): reverted (0.4.343).
- `content-visibility` to speed up the tag map: rows moved 498 px (0.4.350, LOGBOOK:384).
- Dashed "make" buttons in the tag map: too heavy fourteen times over (0.4.310, LOGBOOK:808).
- The two-way rows' + box (0.4.298 to 0.4.300), opening the new node in the sidebar (0.4.302), a + in the gap and a +
  after the last name (0.4.303): the + after each group's last item, then a line to type in.
- Two-way tags at the right edge (0.4.297, 0.4.299) and as Logseq's #tags (0.4.301): right after the name, in mono.
- Eleven faded Undo arrows in the tag map: "all these are useless" (0.4.296).
- Choice guesses such as Status (0.4.265, dropped 0.4.292: wrong 255 times on Stress Check); number guesses by vote
  (0.4.265: Severity 0 right of 6).
- A 60-letter cut of a two-way row's name (0.4.261, removed 0.4.263).
- Ctrl-Enter to accept without a new bullet (0.4.242): Cmd-Option-Enter (0.4.259).
- No underline under two-way pages (0.4.230): put back (0.4.231).
- A "root" label in the tag tree (before 0.4.221); shortcuts and text around the tree (before 0.4.223).
- Tab accepting guesses (0.4.218): Enter (0.4.219). The 7-second Undo bar (to 0.4.218 for proposals, 0.4.258 for the
  rest; deleted 0.4.311).
- A guess taken only by a click, with a "?" mark (0.4.200 and 0.4.201): Enter takes it (0.4.202).
- Rules for guesses tuned to the test graph: one engine that learns (0.4.212).
- The document export (on 0.4.244 to 0.4.250, off 0.4.251) and Todos (paused 0.4.128): both rest.
- The tag summary box, `p::` typing, the scroll-bar room (2026-10-23), the page-kind line above the title, "show how a
  page is used", "show how records are linked", the heavy Linked references rework (2026-10-21).
- Two-way row ideas: tables and boards, journal-based rows, "+ Link" from the property's page, mentions into links,
  dragging nodes between pages or onto a sidebar row, "new since last visit" (2026-10-24).
- Mockups on the Design canvas; meeting-based examples (2026-10-23).

Before 2026-10-20 (`HANDOFF-2026-10-19.md`, "Tried and rejected"): air above top-level blocks (0.4.68); empty
properties hidden until pointed at (0.4.71, 0.4.76: nothing may move under the pointer, nothing Logseq shows may become
invisible); the chosen usage count wearing the "here" mark; a bar under the chosen tag tab, an indent under the usage
counts, a second `#` in the `[[` menu (0.4.90, 0.4.91); past journal days stepped back ("nothing steps back by age");
housekeeping offered as a proposal; a Set icon entry in the tag tree (the API refuses every icon); commands acting on
the last clicked block with a flash ("too complicated"); hiding reference rows under a usage filter; a square bullet
for a tagged node; a `#` in place of the bullet; bold, italic or framed marks for links to tag pages; a `#` in a tag
page's title; muted property names (0.2.94); `#Page` beside other tags; a hairline between source pages in Linked
references; a `›` closing the parent path; a dashed line under links to blocks (0.2.116); a `↗` after a block link;
rounded or accent marks for the page's own link in Linked references; the look changes of `wip-uncommitted-look-changes`
(2026-10-13); `j`/`k` as the keys of the old proposals.

## 4. What Logseq 2.0.2 taught, the hard way

Those already written in `GUIDE.md` (the command line, a link's press, the screen's names) or in `docs/PROCESS.md`'s
lessons (no search index after a command-line import, view blocks saved on a first visit, deleting a graph only unlinks
it, the Recycle, a property's own page saving an "All" view) are not repeated here.

**Installing and running**

- An installed plugin without the **effect** box runs on `lsp://logseq.io`, a different origin from Logseq's window
  (`lsp://logseq.com`): `window.parent.document` throws and nothing of the plugin draws but what goes through the API
  (the toolbar button). An unpacked plugin runs on `logseq.com` whatever its flag. `"effect": true` in package.json is
  overwritten by the install dialog's box (0.4.281, 0.4.282).
- Install from GitHub reads the public API: a private repo answers "GitHub API Failed (500)"; an installed copy is named
  after the repo (`logseq-plugin`) and has its own settings file (0.4.280). Logseq's fetching service handed out the
  previous release for a while after a new tag (0.4.282).
- Logseq keeps an uninstalled plugin's styles until a restart (LOGBOOK:1082).
- Logseq's database took 2.4 s to be ready on a cold start (`invoke-db-worker-error` before that, 0.4.275).
- Logseq 2.0.2 runs on Electron 42 / Chromium 148: the browser's dialog, popover and anchor positioning are there; its
  own components are Tailwind class lists that change between versions, not reusable (LOGBOOK:772, 1186).
- Slot hooks fire about 50 ms after paint, and React drops foreign nodes when it re-renders (0.4.283).

**Properties, choices, tags**

- A plugin can make or change only its own properties ("Plugins can only upsert its own properties",
  `ensure-property-upsert-control`): the kind, one or several, and choices of the owner's properties are Logseq's.
  Neither a plugin nor the command line can make a link property of the owner's; the plugin presses Logseq's own Add
  property box and Add choice box instead (0.4.241, 0.4.305, 0.4.309). The path to Add choice: the property's page in
  the sidebar, its column header, Available choices, Add choice; a pointer click closed the menus, Enter opened the box.
- Logseq locks a property's kind once it holds values (unlocked again when empty) (0.4.241).
- Moving a choice is refused ("DB write failed with invalid data"); the command line does write `:block/order`; the
  order of choices is left to Logseq (0.4.193).
- The plugin API refuses every icon value ("Invalid icon"); an icon is set with Logseq's own Add icon.
- A rename through `logseq.Editor.renamePage` logs Logseq's own TypeError (`toLowerCase` on `:page/renamed`), harmless.
- Logseq puts a made property on its tag a moment after making it; the first "Add property" button in the sidebar can
  be another page's, so the one under the sidebar item headed with the tag's name is pressed (0.4.305).
- A deleted page keeps its tags; the command line refuses to change a recycled page ("page is recycled"); making a page
  with a recycled page's name hands back the recycled page (0.4.305, 0.4.349).
- A number value is a node of its own with `:logseq.property/value`; a typed tag is saved as `#[[uuid]]` (0.4.214;
  0.4.376 found Severity read as ids).
- A journal page's uuid starts `00000001-` (0.4.338).
- A view's settings are stored on a node with `logseq.property/view-for`; a table's columns are not stored until changed
  (0.4.247).
- A property limited to a tag offers that tag's child tags' nodes in Logseq's own list (Spoke with lists the doctors);
  the list is alphabetical, its highlight follows the pointer and goes back to the first row after each letter (0.4.253).
- `[[Page]]#Tag` typed as is tags the bullet; picked from Logseq's tag list with Enter right after the link, the tag
  goes to the page (0.4.209). Logseq's tag list stays open after a typed #tag, and Enter there picks; one Enter once
  made a tag of a whole sentence (LOGBOOK:365).
- Logseq's own Clear in a property's list is offered only for a property that holds one value (LOGBOOK:1173).

**The screen**

- Logseq's theme variables (`--ls-*`) are empty in some themes and in dark mode (`--ls-primary-background-color`), so
  greys are mixed from `currentColor` (0.4.188, 0.4.257); `currentColor` inside a highlight reads as nothing in dark
  (0.4.356) and inside the typed layer is transparent (0.4.380); a grey mixed from `currentColor` compounds through
  nesting, so it is set once and inherited (0.4.344).
- `scrollIntoView` scrolls Logseq's frame, which is `overflow: hidden` (0.4.222, 0.4.240).
- A hidden capsule cannot take the keyboard: focus falls to the body, the bullet is left and the sure values are filled
  (0.4.271). The capsule strip is `overflow-x: hidden`, so a ring outside a capsule is cut (0.4.270). Logseq greys a
  whole property row while the keyboard is on it (0.4.291).
- Logseq's list for a property with a long list (Topic, 15 tags) has its field about 1.7 s after its box (0.4.273).
- Logseq's hover preview is a component around its page link (`page-preview-trigger`); a plugin's links cannot have it
  (0.4.262).
- A page's own tags sit in `.ls-page-title-container .ls-block-right > .block-tags`, at opacity 0 until hovered
  (0.4.328); "Add icon" and "Set property" sit in a 24 px row at opacity 0 until hovered (0.4.354).
- A property row carries `data-property-title` and its type (0.4.334).
- Logseq paints a tick box blue through a forms rule (LOGBOOK:652).
- A browser popover in light dismiss closes when a press outside ends, so a right-click menu showed under a second
  unless held (0.4.323).
- Logseq sent no `dragend` after the source row moved; real mouse drags through computer use only selected text
  (0.4.221).
- Logseq has no keyboard way into a bullet's properties except Down at the very end of the words (0.4.208; an earlier
  reading of Logseq's code had said there was none).
- Opening the Journals makes Logseq save a "Linked references" view for the day; an "All" view removed while its page
  is open in the sidebar is made again at once (LOGBOOK:2222, 2329).
- `two-way-check.js` could start a command-line server for the graph while the app was not on it, leaving the graph
  unusable in the app (LOGBOOK:2285).

**Working on the Mac**

- Typed letters that miss a field go to Logseq as shortcuts (a console window that shrank, a click beside the words,
  Cmd+K into search made a page "wait R('nb')"); press Escape and look before typing (LOGBOOK:962, 1244, 2410).
- The Mac's safety check refused switching graphs from a session and once a `git stash` on edits the session had not
  made (0.4.276; CLAUDE.md).
- The debugging port cannot size Logseq's window (LOGBOOK:367).
- Importing a year of journals per file timed out after 4 minutes: a month per file (0.4.216).

## 5. Standing rules and when they were made

| Rule | Made | Why |
|---|---|---|
| The owner does not read code; no diffs or pull requests; report in plain words, Logseq's words | from 2026-10-11 (HANDOFF), sharpened 2026-10-20 | the owner decides by looking; "you speak convoluted" |
| Work only on the Mac in `/Users/admin/logseq-plugin`, commit and push from there | by 2026-10-20 | the Mac and GitHub always match; Logseq loads the plugin from that folder |
| The owner only reloads the plugin | by 2026-10-20 | once the owner had to run a Terminal line after a refused `git stash` |
| Test only in the Illness Test Graph, undo every test edit, check in the app without asking | 2026-10-20, 2026-10-21 | "this is just a test version" |
| One session drives Logseq; a worktree's change cannot be seen until merged | 2026-10-22 | sessions collided; the owner tries things between turns |
| Stage files by name; keep the folder on `main` | 2026-10-23 | another session's edits appeared on a branch in the shared folder |
| One change per commit, version, CHANGELOG, logbook, State line; the commit hook | 2026-10-20 | "make sure things are updated as things go" |
| A version tag `v0.4.N` pushed with every version | 0.4.280, 2026-10-22 | install on another computer |
| Two-way on by default | 2026-10-20 | the rows replace Logseq's tag lists |
| No rules tuned to the test graph; one engine that learns | 2026-10-20 | "too based on the current graph" |
| Leaning down only (`docs/LAYERS.md`), checked by `tools/leaning-test.js` | 2026-10-22 | "there is no cohesive use of layers" |
| Every bug becomes a check first (`docs/PROCESS.md`) | 2026-10-19 | a bug fixed once cannot come back |
| Never decide a design question for the owner; three failed attempts: stop | 2026-10-19 (`docs/PROCESS.md`) | the owner decides by looking |

## 6. Open on 2026-10-24

- The ring on a capsule Logseq's own keys put the keyboard on, in every graph: keep or limit (the audit, 2026-10-22).
  Since 0.4.291 none on a row Logseq greys, since 0.4.352 none of the plugin's own; the question was not put again.
- Logseq's narrow name column cutting a long property name ("Therapy regimen"): waiting for the owner; the whole name
  on hover since 0.4.353.
- A quiet trial of the proposals on the owner's real graph (reads only, a week of logs): proposed 2026-10-21, not
  decided.
- Two-way row ideas 4 and 5: explained, not built; 5 was called the practical next one (memory note).
- Three old branches (`claude/project-thread-at5qzj`, `-ocmi6u`, `-qogakv`), kept on 2026-10-23 although their commits
  are in `main` in substance (`git cherry`, 2026-10-24).
