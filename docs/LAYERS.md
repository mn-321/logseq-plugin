# The layers, the kit and the order of building

Written 2026-10-22, from a session with the owner that settled the plugin's layers and the look of everything it
draws. The two pages it was decided on, with every element and every view drawn out:

- The elements page: https://claude.ai/artifact/9VE7BaQ8Yz6G14RBpkzZuN (`docs/ELEMENTS.html`): every kind of element the
  loaded parts draw today, how many ways each is drawn, and for each a recommendation with the owner's comments applied.
- The views page: https://claude.ai/artifact/H6jetZ5PEcNsTG9Ux3cJPw (`docs/VIEWS.html`): whole views drawn with the kit:
  a page with two-way rows, the same with a list open and three picked, an outline being written with proposals, the
  tag map in both views, the link box, the settings window, the troubleshooting list.

The pages are the picture; this file is the words. Where they differ, the pages win: they were looked at and commented
on, this file was written afterwards. `tools/pages/` rebuilds them (see the end).

This file is the design of the layers and the rule of leaning. What each layer holds today, part by part, is
`docs/STATE.md`. Marks in brackets ("built at 0.4.3NN", "the owner, later") were added on 2026-10-24 where the code
has since done what is planned here, or a later word of the owner changed it.

## 1. The six layers

A layer may use the layers below it, never the ones above, and never its neighbours. A layer is about leaning, not about
when it was built.

1. **Talking to Logseq.** One way to read and write the graph (`parts/model.js`). One way to watch the screen (the
   watcher in `main.js`). One way to wait for Logseq, press one of its buttons, type into one of its fields, and ask
   whether one of its pop-ups is open. One register of commands: every command with its name, shortcut, icon and where
   it shows (palette, toolbar, right-click, settings), read by the engine and by the settings window. One way to show
   a notice. Diagnostics (measuring, warnings, troubleshooting) belong here.
2. **Shared pieces, the kit** (`parts/shared.js`). One pop-up, one dialog, one field, three buttons, one tick box, the
   words that stand in for chips, one picking bar, one hover card, one Undo, one quiet line and one help paragraph, one
   icon list, one element builder, one text escaper. Section 3 lists them.
3. **Features.** Two-way links, the tag map, the proposals, the pickers, link selected text. Each stands alone, draws
   nothing of its own, and uses only layers 1 and 2. A feature that needs a new kind of thing adds it to the kit first,
   under a name and with a line on the elements page.
4. **Where things sit.** What goes on a page, where, and how you get to it: the trimmed page plan, sidebars, search,
   moving about. Most of the resting parts belong here. (The owner, 2026-10-23: no `p::` typing and no tag summary box;
   `docs/history/DECISIONS-AND-RULINGS-2026-10-24.md`.)
5. **How things look.** Colour, size, spacing. The look half of the old `styles.js`, emptied into `page-look.js` and deleted at 0.4.359. Deliberately last.
6. **Separate tools.** Rich copy, todos. Decided one by one.

**Where things stood (2026-10-22, before the kit was built).** Layer 3 is built and each feature can be left out (`tools/parts-apart-test.js`).
Layers 1 and 2 exist but leak: features call Logseq directly (the tag map about fifty times, the two-way rows
twenty-five, the proposals twenty-three), find each other through nine names on Logseq's window, and draw their own
pop-ups, buttons, fields, tick boxes, chips, bars and icons: about forty drawings of fourteen kinds, five ways of placing
a box, three of waiting for Logseq, two of showing a notice, three of registering a shortcut. The elements page has the
count per kind. Layers 4 to 6 are not started. (Since then: the kit was built and every feature moved onto it at
0.4.311 to 0.4.319, and `tools/leaning-test.js` has counted 0 direct Logseq calls outside layer 1 since 0.4.319;
layers 4 and 5 were begun at 0.4.336 to 0.4.359, layer 6 decided on 2026-10-23: both its tools rest.)

## 2. The grammar (the owner's, in their words)

- **The plugin fades away.** Nothing shows until it is needed; the tick boxes, the + after a node, the sidebar icon,
  the row actions appear when the pointer is on their row.
- **Differences by weight and grey, not by boxes.** No pills, no fills, no edges on buttons. Four greys mixed from
  Logseq's text colour (quiet .7, faint .5, hairline 12%, line 26%), a wash at 7% for the row under the pointer.
- **No colour of the plugin's own.** Only Logseq's pop-up colours (`--popover` and its partner) and its text colour,
  in both themes. The violet accent of that time, the tag map's four hues, the orange for warnings and the settings
  window's blues all go (gone by 0.4.319).
- **A tag is a class, not a tag.** Its name alone, no `#`, in a monospace face, the tag grey, with the faint underline of
  a link. Everywhere: after a node in a two-way row, in a pill, in a menu, beside a title. Never Logseq's blue `#tag`.
- **Property names lighter than their values**, on pills under a bullet and on page rows alike.
- **A value's kind is an icon left of the property's name**: a plain arrow to the right for "points to a node" (the
  same arrow as after a two-way row's name; not the `[[ ]]` of a link in the words, not an arrow leaving), a calendar
  for a date, a box with a chevron for a choice, 123 for a number, Aa for text; the same single arrow for a property that
  links to several nodes (the owner, 2026-10-23, in place of the arrow twice). The Properties view's Value line says one
  or several in words.
- **Nothing is assumed about a new node's tag.** The + after a two-way row opens a line to type the name; Enter then
  offers the tags the property accepts as quiet words, the most used first, and "no tag"; a property that accepts one
  tag skips that step (the owner: a property can take many kinds of page).
- **An action happens in stages**, one thing appearing after the other, in place, never as a window of everything at
  once. The elements page shows adding a property to a tag in four stages: faint "+ Property" on hover, a line opens
  to type the name, Enter shows the kinds as quiet words on the same line, Enter again makes it with a faded Undo arrow.
- **Italic is only for a value the proposals pencil in, and every such value has a dotted line under it**, whether the
  plugin was sure or guessing (the owner, late on 22 October: "they are essentially the same thing"; built at 0.4.315: before it
  only a guess had the line). The keys stay: Enter takes all, a click away only the sure ones, Option-Enter stops on each guess.
  Nothing else is italic: what a property accepts is its tags in mono, a choice list is quiet words.
- **Everything on a row sits on one set of columns**: days where Logseq's values start, names at one edge, tags at
  the right edge, tick boxes and fold chevrons in the margin. (The owner, later: at 0.4.320 the two-way rows' tags moved
  right after each node's name, "move tags for two-way link next to item, not right aligned"; at 0.4.378 every row
  shares one name column, and since 0.4.381 a short row's day, tag and + follow its words and wrap with them.)
- **Undo is the faded arrow** at the end of what changed; waiting at the bottom right-hand corner when nothing is left
  on screen to sit beside. The old dark bar is deleted (0.4.311).
- **Plain words** on the Properties view's lines: Value, On tags, Links to, Seen from Doctor as, Group, Nodes with it.

## 3. The kit: what each piece comes from

Three sources, tried in this order. The further down, the more of the plugin's own code, and code is what drifts.

**From Logseq** (plain things its markup can wear; never its components, whose look lives in utility-class lists in
its code that change between versions): its colours; its property pills, which the proposals sit inside; its own
lists for the pickers; its icon font (Tabler, loaded on every page: an icon is `<i class="ti ti-name">`); its notice
at the top.

**From the browser** (Logseq 2.0.2 runs on Chrome 148): the `<dialog>` for the one real window; pop-ups as
`popover` elements that dismiss on Escape or a click outside; placement of a pop-up under its button by CSS anchor
positioning, flipped when there is no room (this removes five placement routines and three Escape handlers); the
checkbox, drawn over by six lines of CSS; tooltips (`title`) for short hints on controls: on a Mac a neutral grey box
in the system's colours, not ours to choose.

**Drawn by the kit, once each:**

| Piece | What it is | Custom because |
|---|---|---|
| Pop-up box | Logseq's own `[[` menu look: 6px corners, its light shadow, 14px rows. Two fillings: a **menu** (actions, icon left, key or tick right) and a **list** (the field, then rows). Arrows and Enter handled once. | the list's keys; the look is taste |
| Dialog dressing | the browser's dialog in the kit's colours; settings only | taste |
| Three buttons | **quiet** (greyed words or an icon, no edge, lit on hover), **go** (the one that does what was asked: text colour, bold, a faint underline), **pressed** (a quiet button kept in the text colour while in force). No fills, no edges. | taste |
| One field | a real text box drawn as a hairline underneath, firmer while typing; optional icon left and key hint right; inline on a line. One exception: the link box's field is drawn, not real, so keystrokes keep going to the bullet and Cmd+Z works; it wears the same look. | taste |
| Tick box | the browser's checkbox as a small rounded square, hairline edge; a small check mark inside when on | taste |
| Words for chips | a filter is a greyed word, the one in force in the text colour; a removable item is a word with a × on hover; no pill | only the × is behaviour |
| Picking bar | the count with its tick box, then the actions as quiet words with icons, on one line above the list with a hairline under it; Escape clears; stays while the list scrolls | needed |
| Hover card | a node's preview: title, tag, day, properties, first lines, each clickable; 10/12 px edge, 4 px between rows, a hairline before the lines; a browser popover of the hint kind | needed |
| Undo arrow | the faded arrow, several at once, docked at the bottom right when nothing is left to sit beside | needed |
| Quiet line, help paragraph | a smaller greyed line for hints and notes; a quiet paragraph with a hairline down its left for "what this means" | taste |
| Icon list | one named list, every icon from Logseq's font | not custom |
| Element builder, text escaper, placement, waiting, pressing, notice | one of each, in the kit or layer 1 | plumbing |

Four of the ten drawn pieces are custom because nothing else does the job (the list's keys, the bar, the card, the
Undo); six are taste and would still work if dropped to the browser's bare look. That is what makes layer 5 cheap.

**The icon list** (Tabler names): undo `arrow-back-up`; open in the sidebar `layout-sidebar-right`; open as a page
`file-text`; fold `chevron-right` (turns down when open); add `plus`, only inside a button that says what it adds;
more `dots`; delete `trash`; find `search`; settings and tools `adjustments-horizontal`; close and remove `x`;
chosen `check`; what this means `info-circle`; the tag map `hierarchy`; a tag `tag` (never a #); a property
`forms`; rename `cursor-text`; copy `copy`; points to `arrow-right`; picked `square-check`; warning
`alert-triangle`; show and hide `eye`, `eye-off`; shortcut `keyboard`; two-way links `arrows-left-right`; order
`arrows-sort`; proposals `bulb`; kinds: a date `calendar`, text `letter-case`, a number `123`, a choice `select`,
several `stack-2`, yes or no `checkbox`, a web address `world`.

## 4. The order of building

The house rules hold throughout: one change per commit, each with its version bump, CHANGELOG line, logbook entry and
CLAUDE.md State line; each reloaded and looked at in Logseq on the Illness Test Graph before the next; nothing moves
on a page that did not move before (`tools/parts-apart-test.js` and the jump check after each step).

1. **The kit** (`parts/shared.js`, `main.js`): the pieces of section 3 with their names and one stylesheet; the command
   register; the icon list; one `el()` and one `esc()`; placement and dismissal handed to the browser; `waitFor`,
   `press`, `typeInto`, "is a Logseq pop-up open" moved into layer 1 as one door; `showUndoBar` deleted. Nothing uses
   the new pieces yet; the boot test and the parts-apart test pass.
2. **One feature at a time onto the kit**, in this order, smallest first so the kit is proved before the big one:
   the pickers; link selected text; the proposals (the ghost in Logseq's pill, the tag guess in mono without #, the
   stepping keys named in the register); troubleshooting; the settings window (the browser's dialog, the register's
   shortcuts as a group); the two-way rows (rows on one set of columns, tags in mono, the bar as a line, the card with
   room); the tag map, Tags view then Properties view (kinds as icons left of the name, plain words on the lines,
   stages for every edit). Each step deletes the feature's own drawings and direct Logseq calls as it goes, and is a
   commit of its own, checked in the app.
3. **The leaning-down check**: a test that counts direct Logseq calls outside layer 1, parts reaching sideways, and
   names on the window beyond one, and fails the commit when any grows. Added once the first feature is moved, so it
   starts with the true count and only ever goes down.
4. **Both pages rebuilt** from the code once everything is moved, so "today" on the elements page shows one drawing per
   kind and the proposals match.

Then layer 4, one piece at a time. (The plan of 2026-10-22 put the tag summary box first; on 2026-10-23 the owner said
no to it, and layer 4 began with the right sidebar at 0.4.336.)

## 5. Rebuilding the two pages

`tools/pages/prepare.js <dir>` pulls the parts' stylesheets, the icon constants and Logseq's own icon font (from the
app's bundle on this Mac) into a scratch directory; `tools/pages/build-elements.js <dir>` and
`tools/pages/build-views.js <dir>` then write `docs/ELEMENTS.html` and `docs/VIEWS.html`. The pages embed the parts'
CSS verbatim, so rebuilding after the kit lands shows the variations collapse. Publish with the Artifact tool to the
links above (read them first) so the owner's comments stay attached.

**Rebuilt 2026-10-22 at 0.4.319 (step 4 of section 4 done).** The sketch (`.px-`) is gone from the builders: the elements
page shows one drawing per kind, built from the kit's own markup with the kit's stylesheet and the parts' layout pulled
from the source; the views page shows each view from the parts' real markup. `prepare.js` reads the kit's icon list
(`ICONS`) instead of the deleted icon constants.
