# The grammar of DB Refinements

Written 2026-10-16 at 0.4.63 and revised at 0.4.64, 0.4.65 and 0.4.66, from what the plugin does today. Nothing here is new; it is the rules the code already follows, written in one place, and a list of where the code departs from them. The departures are proposals. Nothing was changed to write this.

Seen on screen while writing it, in the Plugin Test Graph: the page **Plugin Visual Cues** (every cue with its example), and the page **Ada Okafor** (its property list, its `#Project` tab and its Linked references). The rest was read in the code and the README.

Where things are: the tokens in `tokensCss` in `main.js`; the page stylesheets in `parts/styles.js`; the "points here" rules in `parts/links.js`; the title words in `parts/pages.js`; the toasts, boxes and lifecycle in `parts/shared.js`; the three writing parts in `parts/journal-dates.js`, `parts/todos.js` and `parts/tags.js`; the commands in `parts/editor.js` and `main.js`.

## Part 1: how things look

### The axes

A reader looks at a row and asks a few questions. Each question has one place on the row where the answer sits.

1. **What is this row?** The bullet says so. A plain dot is a block. A page icon in the bullet is a page listed as a row. A quotation mark in place of the bullet is a highlight taken from a PDF. No dot at all is an empty block used as space. Logseq's own ring around the bullet still means folded.

2. **What does this link point to?** A mark before the link says so. Nothing before the words, and a faint underline under them: a page. The page's own icon stays in the text colour. The icon in the tag colour, or a `#` in that colour: a tag's own page. A small dot: a block. The status and priority icons in place of the dot: a block that is a task. A grey document or picture icon: a file. Nothing under or after the words for a block link.

3. **What does this block hold?** Anything after the block's text says so. `↳` then a dashed circle and a number: that many unfinished tasks below, at any depth. `↳` then small file icons: files directly below. The hover gives the counts.

4. **What state is it in?** The status and priority icons. They are Logseq's own. The plugin does not redraw them; it moves them in front of a linked task and uses their colours in Todos.

5. **How quiet?** One scale for everything the plugin draws, in `tokensCss`. Every grey is the theme's own text colour mixed down, so light, dark and custom themes all work.

| Level | Token | Used for |
| --- | --- | --- |
| Full | the text colour | words, values, the page's own icon |
| Quiet | `--rf-quiet` (.7) | labels and other secondary words: the cues after a block, the citation, the Alias of line, the `· n` count |
| Faint | `--rf-faint` (.5) | icons, markup and separators: the dot before a block link, file icons, the `·` between properties, faded brackets |
| Line | `--rf-line-pct` (26%) | underlines, the nesting line beside the branch you point at, the line beside an embed |
| Hair | `--rf-hair-pct` (10%) | resting nesting lines |
| Wash | `--rf-wash-pct` (8%), `--rf-wash-strong-pct` (13%) | the box behind a date, and the same box under the pointer |
| Here | `--rf-here` (7%) over `--rf-here-line` (38%) | the link to the page on screen under Linked references: a wash with a hairline beneath, like a pencil mark |
| Small | `--rf-small` (.82em) | labels beside text |
| Accent | `--rf-accent` | the optional tag chip; the only colour of the plugin's own |
| Tag colour | `--rf-tag-color` | the icon or `#` before a link to a tag's own page; the colour Logseq's theme gives tags |

Two more places hold cues that are not about one row:

6. **Where content sits.** Lines. A faint line beside nested blocks, firmer beside the branch you point at or type in. A faint line down the left of embedded content. A gap, never a line, between source pages under Linked references.

7. **How things are connected.** Small quiet words. Above or under a title: `#Page`, Alias of, Inherited from. Before a reference row: the property's name. After a folded record under a tag tab: `via owner: page`. Under a block: `name: value · name: value`.

The three rules the owner set, which the axes come from: the bullet says what a row is; a mark before a link says what it points to; anything after the text says what the block holds. The arrow symbol is not used.

### Every cue on the grid

| Place | Cue | Means | Setting (key) | Where |
| --- | --- | --- | --- | --- |
| Bullet | small plain rectangle in place of Logseq's generic page icon | a page listed as a row; also in titles and sidebars | Simpler page icons (`plainPageIcons`) | styles.js |
| Bullet | `“` in place of the dot | a highlight taken from a PDF | Compact PDF citations (`pdfCitations`) | styles.js, links.js |
| Bullet | no dot; faint on hover, back while typing | an empty block used as space | Hide the dot on empty blocks (`quietEmptyBullets`) | styles.js |
| Bullet | a dot before the grey parent path, the reference stepped in below | the path names the block the reference sits under | Clearer Linked references (`referenceLayout`) | styles.js |
| Before the link | nothing; faint solid underline under the words, clearer on hover; normal text colour | a page | Quiet page links (`quietLinks`) | styles.js |
| Before the link | the page's own icon in the text colour | a page with an icon | Quiet page links (`quietLinks`) | styles.js |
| Before the link | the icon in the tag colour, or a `#` in that colour when the tag has none; the name underlined | a tag's own page | Quiet page links (`quietLinks`) | styles.js (`applyTagPageStyle`) |
| Before the link | a small faint dot; no underline, nothing after | a block | Icons for block references and files (`referenceIcons`) | styles.js, links.js |
| Before the link | the status and priority icons; the dot moves in front of them | a block that is a task | Icons for block references and files (`referenceIcons`) | styles.js |
| Before the link | a grey document or picture icon; the words with the page underline | a PDF or an image | Icons for block references and files (`referenceIcons`) | styles.js |
| Before the link | `•` before each row of the `((` picker | every row there is a block | Icons for block references and files (`referenceIcons`) | styles.js |
| Around the words | a grey box in the text font; no icon, no border | a date, or a link to a journal page | Dates in a soft grey box (`dateStyle`) | styles.js |
| Around the words | a faint wash with a hairline beneath, square corners | the link to the page on screen, under Linked references and in the records under its tag tabs; on a journal, a date that points to that day | Mark the link to this page in Linked references (`markReferenceHere`) | links.js |
| Around the words | the shown name without its trailing tag | a page link written as "Name #tag" | Page links without trailing tags (`pageLabels`) | links.js |
| Around the words | plain words with a 2px underline in the grey path, instead of `[[Name]]` | a link in a parent path | Plain links in grey paths (`plainPathLinks`) | styles.js, links.js |
| Around the words | brackets faded in the grey path; the path uses its room before cutting | markup in a parent path | Tidy parent paths (`tidyPaths`) | styles.js, links.js |
| Around the words | a faint violet chip | a tag (off by default) | Soft background behind tags (`tintTags`) | styles.js |
| Around the words | a muted steel blue | a page link on a highlight, so it stays readable | Quiet page links (`quietLinks`) | styles.js |
| After the text | `↳`, a dashed circle and a number | unfinished tasks below, at any depth | Show what a block holds (`childTypeCues`) | styles.js, links.js |
| After the text | `↳` and small picture or document icons | files directly below | Show what a block holds (`childTypeCues`) | styles.js, links.js |
| After the text | `pdf`, `png`, `jpg` … in small grey | the type of a file link | Icons for block references and files (`referenceIcons`) | styles.js |
| After the text | `”` then `(p. 1)` or `(Document title, p. 1)` in small grey | the source of a PDF highlight | Compact PDF citations (`pdfCitations`) | styles.js, links.js |
| After the text | `via owner: page`, the page marked | why a folded record is listed under this page's tab | Show how records are linked (`linkLabels`) | styles.js, links.js |
| After the text | `· n` after a source page's heading | that page holds n references | Clearer Linked references (`referenceLayout`) | styles.js, links.js |
| After the text | a small grey chevron while you point at the block | the block has hidden properties; click opens them | Hidden properties arrow on every block (`hiddenPropsChevron`) | properties.js |
| State | the status and priority icons as Logseq draws them | status and priority | (Logseq's own) | |
| State, in Todos | the circle's colour: yellow doing, blue in review, green done; priority bars orange and red; a red outline on a late date; today in the text colour; a planned day in italics; canceled struck through | where a task stands | Todos, Expectations | todos.js |
| Lines | a faint line beside nested blocks, firmer beside the branch under the pointer or caret | nesting | Faint nesting lines (`indentGuides`) | styles.js |
| Lines | a faint line down the left | content embedded from somewhere else | Line beside embedded content (`embedLine`) | styles.js |
| Lines | a gap, no line, between source pages; one plain semibold heading per page; the blocks below a reference stepped back | the shape of Linked references | Clearer Linked references (`referenceLayout`) | styles.js, links.js |
| Lines | a thick grey line between items | the items of the right sidebar | Thick line between sidebar items (`sidebarThickDividers`) | sidebar.js |
| Lines | flat panels, no cards; properties opened; Page graph and (Dev) buttons gone | the right sidebar | Tidy the right sidebar (`tidySidebar`) | styles.js, chrome.js |
| Lines | each journal day only as tall as what it holds | the Journals list | Journal days only as tall as what they hold (`compactJournals`) | styles.js |
| Small words | the page's tags and actions above the title, muted until pointed at | what can be done with the page | Always show page title actions and tags (`showTitleChrome`) | pages.js |
| Small words | `#Page` above the title of an untagged page; the tags beside the actions on a tagged one | what the page is | Show what a page is above its title (`showPageKind`) | pages.js |
| Small words | "Alias of …" under the title | the page is another page's alias | Show which page an alias belongs to (`showAliasOf`) | pages.js |
| Small words | "Inherited from #Media: keywords, rating" closing the Tag Properties list | where a tag's properties come from | Show inherited properties on tag pages (`showInherited`) | pages.js |
| Small words | a property's name in grey before a reference row | the row is a property's value | Show how records are linked (`linkLabels`) | styles.js, links.js |
| Small words | `name: value · name: value`, grey names, no capsules; a list on a very light field; `#` before each tag tab; Add property only on hover | properties under a block and under a title | Plainer properties (`plainProperties`) | styles.js |
| Small words | the tag's own tag left off its rows, table and references | a tag page's rows | Leave a tag page's own tag off its rows (`ownTagHidden`) | styles.js, links.js |
| Chrome | named items smaller and lighter, in place | rarely used sidebar and toolbar items | Quiet these sidebar and toolbar items (`quietItems`) | chrome.js |
| Chrome | generic icon gone from Favorites and Recent; journal days grey | the left sidebar's lists | Left sidebar icons only where they mean something (`quietSidebarIcons`) | styles.js, chrome.js |
| Chrome | a faint underline while you point at a sidebar item's title | the title opens the page | Sidebar titles open their page (`sidebarTitleOpens`) | sidebar.js |
| Chrome | a Search button at the top of the right sidebar | search can stay in the sidebar | Search button in the right sidebar (`sidebarSearchButton`) | search.js |
| Chrome | a checklist, an hourglass and a tree button at the top right | Todos, Expectations, the tag tree | `todosToolbarButton`, `expectationsToolbarButton`, `tagTreeToolbarButton` | todos.js, tags.js |
| Search window | compact rows, faded markup, small light group headings, bold matched words, a faint wash on the selected row, the plain page rectangle | a calmer search | Tidy the search window (`tidySearch`) | search.js |
| Search window | a larger window, more room, results fade in, hints only under the pointer, the page and parents named in full | a roomier search | Roomier search window (`roomySearch`) | search.js |
| Search window | at the right of a row, what it is and when it was edited; a first line under a heading | more about each result | Say more about each search result (`searchDetails`) | search.js |
| Search window | results from one page together, the page named once | grouping | Put search results page by page (`groupSearch`) | search.js |
| Search window | a panel at the right showing the selected result and its blocks; a soft wash on the searched words | the preview | Preview the selected result (`searchPreview`), Preview: edit with Logseq's own editor (`searchPreviewEditor`) | search.js |
| Search window | a list of names under the box as you type a code | the typed filters | Filter search with codes (`searchFilters`) | search.js |
| Tag tree | `#` in the root's colour before every tag under it; heavier names on tags with tags inside; light chips for a tag's own properties, grey words for inherited ones | the tree | Root tags (`tagTreeRoots`) and the tag tree's other settings | tags.js |

A tag belongs to the block, not to the text: Logseq shows it at the right of the row as a blue link, and a tag typed at the end of the text moves there. A tag word left in the middle of a sentence stays as a plain mention in the text colour. The plugin changes neither (HANDOFF's table says a tag on a block is bold with no underline; seen today, it is Logseq's blue link at the right).

## Part 2: how it behaves

### When the plugin writes to notes

The plugin writes to notes in three ways, and no other.

- **From its own views, when you change something there.** Todos and Expectations write a task's status, priority, date or first line when you change it in the list, add a task when you press Enter in the add box, and delete one from its menu. The tag tree moves, makes, renames and merges tags, and moves properties between tags, when you do that in the tree. The search preview saves a line you edited, splits one on Enter and removes an empty one on Backspace.
- **After asking.** Journal day as date fills an empty Date property on a new record only in the graphs named in its settings, and with Ask before filling on, only after you answer the note. Fill missing dates from journal days asks in a box first and says how many it found.
- **When you run a command.** Link selected text to a page, Open selected text as page, Make a page from this block, Delete this block and New block at the outermost level write to the block you are in, when you run them. A year-first date typed inside `[[ ]]` becomes the journal's name as you type it. Fold all and Unfold all press Logseq's fold arrows, which Logseq saves.

Nothing writes on a timer, on a reload or on a page change. Copy as rich text only reads. Choose properties shown in this list writes to the plugin's settings, not to notes, and says so in its box.

### How it asks

- **The note**, for "may I, while you write": a small box at the top right that names the property, the day and the record. `j` or **Yes** fills it. `k` or **No** leaves that record alone for the rest of the session. `Esc` leaves it for now, and it may be asked again on the next change. While you are typing in a block, `j`, `k` and `Esc` stay yours and the note's buttons work instead. A note nobody answers goes away after 25 seconds. One record at a time.
- **The box**, for "here is what will happen": a small dialog in the middle of the window, drawn from `shared.modal`. Enter in its field confirms. Escape or a click outside cancels. Keys typed in the box never reach Logseq. Link selected text asks for the page title in it. Fill missing dates asks "n records … have no Date. Fill each with the journal day it was written on?" in it, with Cancel and Fill dates. Choose properties shows its tick list in it. Troubleshooting lists its tools in it.
- **The tag tree's merge box**: a summary of what will change, then **Merge**. It says in words that the moves cannot be undone in one step and that Logseq deletes the old tag for good.
- **Todos' delete**: a second menu, "Delete this task and the blocks under it?", with Delete and Keep it.
- **Copy as rich text**: its own card listing layout, properties and the title block. Return copies, Escape cancels.

### How it refuses

One toast, through Logseq's own message, at warning level, that names what to do: "Click in a block first", "Select text in a block, then run the command within 30 seconds", "Open a page first", "No query found on this page. Click in a query or one of its results first". A refusal never changes anything. When a command can do part of its work it does that part and says what it left: "Opened the page; the selected text was left as it was". An error that stops a command is a toast at error level: "Page creation stopped: …". A warning the plugin writes for itself goes to the console once per session and is listed by Copy warnings.

### What can be undone

- **In Todos and Expectations**: a change of status, priority, due date, planned date or text shows a dark bar at the bottom, "“Task” is now Doing, due Oct 17", with **Undo**, for seven seconds. Undo puts the old values back. Adding a task and deleting one have no undo.
- **In the tag tree**: a move, a new tag, a rename, a property added, taken off or moved up, a root added or removed, show the same bar with **Undo** for seven seconds. Undo deletes a new tag by its id and puts a moved one back. A merge has no undo and says so before it runs. Moving a root up or down has no bar.
- **Journal dates**: no undo of the plugin's own. A filled date is an ordinary property; it can be cleared by hand.
- **The commands**: no undo of the plugin's own. The typed date inside `[[ ]]` is typed text, so Cmd+Z brings the digits back. Fold all is undone by Unfold all.
- **The search preview**: no undo of the plugin's own.

### What Escape and a click outside do

| Where | Escape | A click outside |
| --- | --- | --- |
| The box (`shared.modal`) | cancels | on the backdrop: cancels |
| The journal note | leaves it for now | nothing; the note stays until answered or 25 s pass |
| Todos as a window | closes a menu first, then clears the search box, then closes the window | on the backdrop: closes the window |
| Todos as a page or in the sidebar | closes a menu, clears the search box, or drops the highlight; never closes the view | nothing |
| The tag tree | closes a menu, clears the search box, unpicks picked tags, or drops the cursor; never closes the view | nothing |
| The merge box | cancels | on the backdrop: cancels |
| A menu in Todos or the tree | closes it | closes it |
| An edit in place (a task's text, a tag's name) | leaves the text as it was | saves (a task's text) or leaves it (a tag's name) |
| The dark Undo bar | nothing; it goes after 7 s | nothing |
| Copy as rich text | cancels | nothing |

### What a reload must never do

A reload must leave one of everything: the new copy runs the old copy's clean-up, stops its watchers and sweeps any mark, note or box the old copy left. It must never write to notes. It must never show "Reload the plugin to apply this change" for a default being filled in. It must redraw every cue as it was. Three reloads in a row are the test. One thing a reload forgets: the records you answered `k` to, so a record made in the minute before the reload may be asked about once more.

### Every command

Shortcuts are the settings in the Shortcuts section; each applies after a reload. "Bullet" means the right-click menu on a bullet.

| Command (setting) | Writes | Asks | Refuses with | Undo | Where |
| --- | --- | --- | --- | --- | --- |
| Link selected text to a page (`linkShortcut`) | the block: `[words]([[page]])` | the box, for the page title | "Select the words to display, then press Mod+Shift+L"; "The selection changed…"; "Use a single-line label without ]" | none of its own | editor.js |
| Open selected text as page (`openShortcut`) | the block: `[[name]]`; makes the page | no | "Select text in a block, then run the command within 30 seconds"; part done: "Opened the page; the selected text was left as it was" | none of its own | editor.js |
| Make a page from this block (`copyShortcut`; bullet) | a new page with a link back and copies of the children; the block stays | no | "Select a block first"; "The block needs a title"; "Page … already exists; nothing copied" | none | editor.js |
| Add tags to this page (`tagShortcut`; `#Page` above the title) | nothing itself; opens Logseq's Set tags | Logseq's dialog | "Open a page first" (also on the Journals list) | Logseq's | editor.js, pages.js |
| Delete this block (`deleteBlockShortcut`) | removes the block and its children, or the selected blocks, or only selected text | no | "Click in a block first" | none of its own | editor.js |
| New block at the outermost level (`outermostBlockShortcut`) | a spacer and a new top-level block | no | "Click in a block first" | none of its own | editor.js |
| Fold all / Unfold all results in this query | the fold state Logseq saves | no | "No query found on this page. Click in a query or one of its results first" | its twin | properties.js |
| Choose properties shown in this list | the plugin's settings only | the box, with the tick list | "Click in a record of a query or list first" | Show all | properties.js |
| Refinements settings | settings | no | | Reset beside each setting | settings-panel.js |
| Refinements: troubleshooting (and its eight tools) | nothing | the box listing the tools | each tool: "Click into the block to check first, then run this again", "Open a page first", "Measuring is off…" | | diagnostics.js |
| Search in right sidebar (`searchShortcut`) | nothing | no | "Search did not open. You can also press Mod+Enter inside search…" | | search.js |
| Fill missing dates from journal days | the Date property of every undated record | the box, with the count | "This graph is not listed under Only in these graphs…"; "Couldn't find the tags … or a Date-type property…"; "Every record already has a date…" | none | journal-dates.js |
| Copy page as rich text (page menu), Copy selected blocks as rich text (bullet: Copy as rich text) | nothing; reads only | its own card | "Nothing to copy here"; "Open a page first"; with nothing selected it offers the page | | rich-copy.js |
| Todos, Todos as a window / as a page / in the right sidebar (`todosShortcut`, `todosOpensAs`, `todosToolbarButton`, `todosDoneDays`) | see the view below | | | | todos.js |
| Expectations and its three (`expectationsShortcut`, `expectationsTag`, `expectationsStateProperty`, `expectationsToolbarButton`) | see the view below | | | | todos.js |
| Tag tree, Tag tree as a page, Tag tree in the right sidebar (`tagTreeShortcut`, `tagTreeOpensAs`, `tagTreeToolbarButton`, `tagTreeRoots`) | see the view below | | | | tags.js |

Typed, not a command: a year-first date inside `[[ ]]` becomes the journal's name (`dateLinkFormats`); the `[[` menu stays empty until you type (`quietLinkMenu`); a link inside a reference opens its own page on click (`innerReferenceLinks`). Copy as rich text's one setting, Layout (`layout`), is remembered from its card.

### The three writing parts

| | Journal day as date | Todos and Expectations | Tag tree |
| --- | --- | --- | --- |
| Writes | an empty Date property, with the journal day | status, priority, due and planned dates, the first line, a new task, a deleted task | Extends between tags, new tags, names, tag properties, merges, the Root tags setting |
| Only when | the graph is named in Only in these graphs (`autoDateGraphs`), the record carries a named tag (`autoDateTags`), the property is a Date property (`autoDateProperty`), Fill dates automatically is on (`autoDate`) | you change it in the list | you do it in the tree |
| Asks | the note, with Ask before filling on (`autoDateAsk`); the box for the command | a menu before a delete | the merge box before a merge |
| Refuses | one warning toast naming the setting to check | "Could not change the task: …" | "#A cannot go inside #B, which is inside it"; "A tag name cannot have a / in it"; "#Task is one of Logseq's own tags and stays where it is" |
| Undo | none | the dark bar for seven seconds, for changes; none for add and delete | the dark bar for seven seconds; none for a merge or a root moved up or down |
| Escape | leaves it for now | see the table above | see the table above |
| Reload | forgets the `k` answers of the last minute | the view is closed and opened clean | the view is closed and opened clean; folded tags are remembered on this computer |

## Ten changes that would make a page read better

The departures further down make the code keep its own rules; none of them changes how a page reads. These ten do. Each follows one of the axes further than the plugin takes it today. For each: what is there now, what is proposed, why, and what it would take. None is built. They are for the owner to pick from by looking at the drawing on the grammar page, then at a trial in the test graph.

1. **A link to a record shows its kind, with the dot where the task rule puts it.** Now: Logseq already draws a tag's icon in the bullet of a tagged block and before a link to it, when the tag has an icon (seen today with #Book: the row's bullet is the book, and the link reads book, dot, words); a tag without an icon gives nothing, and the plugin's dot lands after the icon, where for a task it lands before. Proposed: give every tag in the tree an icon (the tree gets a Set icon action per tag, which Logseq lets a plugin write) and put the dot first, dot, icon, words, as for a task. Why: Logseq already uses the bullet to say what a record is; the plugin only has to make the owner's tags take part and keep one order. Takes: a menu entry in tags.js that writes the tag's icon property; one rule in styles.js for the order.
2. **A folded block says what it holds.** Now: `↳ ◌ 2` counts unfinished tasks below, and file icons say files. Proposed: on a folded block, the kinds inside and the nearest date: `↳ 3 #Decision · ◌ 2 · due Fri`. Why: a folded block is the one place a reader cannot see for themselves, and the tags are what they would look for. Takes: the tree the cue pass already reads, plus each child's tags and Deadline; shown only while folded, so open blocks stay as they are.
3. **Space comes from the stylesheet, not from empty blocks.** Now: the owner leaves empty blocks between groups, the plugin hides their dots, and New block at the outermost level inserts a spacer block first. Proposed: a gap above every top-level block drawn in CSS, no spacer inserted by the command, empty blocks still hidden where they exist. Why: fewer junk blocks in the graph (they count in search, in "n blocks" and in exports), and the same air on every page without typing it. Takes: one rule in styles.js, one line removed in editor.js, a decision by looking at how much gap.
4. **The question lives where the answer goes.** Now: journal day as date asks in a note at the top right, "Date: Oct 16th for “Atlas…”?", j or k, and after j nothing is shown. Proposed: the proposed value is drawn in the record's own property row as a ghost, `Date: Oct 16th` in a dashed box; `j` or a click makes it solid and written, `k` makes it go; dashed means "proposed, not written" everywhere the plugin draws it, as the dashed circle already means "not finished". Fill missing dates lists its records the same way in its box. Why: the eye does not have to travel, the record and the day are in view, and the answer is visible as a state, not as a toast. Takes: a drawn row in the property area (the plugin already inserts lines there: Inherited from), the same keys as today, one write.
5. **A page says how it is used.** Now: under a title, Alias of and Inherited from; the Linked references far below say the rest, by source page. Proposed: one quiet line under the title that counts the references by how they arrive, using the property names as they are in the graph: `owner · 3 · attendees · 2 · in text · 4`, each a filter that leaves only those references on screen. Nothing is created or written: "owner" and "attendees" are the names of the properties whose values point here, counted; "in text" is a mention in a block's words. Why: on a person or project page the first question is "what is this page to the graph", and the answer is spread over a scroll. Takes: the incoming-property look-up links.js already runs for the via labels, counted per property; a mark on the reference rows to filter.
6. **A tag page says where it sits.** Now: a tag page shows `#Tag` above the title and Inherited from under its properties; the tree is a view of its own. Proposed: the tag's path above the title, "Entity › Person › Doctor", each part a link, the `#` in the root's hue the tree uses; the tree button opens the tree at that tag. Why: tag against page is the distinction that matters most, and a tag's place in the owner's tree is what makes it a tag. Takes: the Extends chain the tree already reads, drawn by pages.js; the hue table shared from tags.js.
7. **The `[[` picker gets the grammar.** Now: the picker lists pages, tags and date words alike; the plugin only keeps it empty until you type. Proposed: a `#` in the tag colour before the rows that are tags, the date box around the rows that are journal days, pages plain, matched by name against what the plugin already knows. Why: the link's kind is decided at the moment of typing, and that is where the cue is missing. Takes: a try. Tag names are few and known (`tagPages`), journal names match a pattern; the rows are plain text, so matching by name can misfire where a page and a tag share a name.
8. **A command acts on the last thing you clicked.** Now: Make a page, Delete this block and the selection commands refuse with "Click in a block first" when nothing is in edit; Choose properties already falls back to the record you last clicked. Proposed: every block command falls back the same way, and the block it will act on flashes a faint outline for a moment before it does. Why: the owner has already said which block by clicking; most refusals disappear. Takes: the click tracking properties.js has (`clickedRecord`), used by editor.js; a short outline rule.
9. **One write path with an inverse.** Now: each view writes in its own way; some writes show the Undo bar, some nothing, and merges and Fill dates have no undo and only one of them says so. Proposed: every write the plugin makes goes through one helper that takes the write and its inverse, runs the write, and shows one bar with Undo; a write with no inverse must say "cannot be undone" in its box before it runs. Why: the rule becomes "the plugin never writes without knowing how to unwrite it", and departures 22 to 27 fall out of it. Takes: a helper in shared.js, the views moved onto it.
10. **Dates carry their tense.** Now: every date is the same grey box; Todos alone writes today firm, a planned day in italics, a late date red. Proposed: on the page too, a past day quiet, today in the text colour and a little firmer, a future day as it is, overdue still yellow. Why: an old journal is full of past dates, and the one that matters is the one that is near. Takes: the date pass already parses the day (`isJournalDate`); one mark, three rules.

## Housekeeping: where the code departs from its own rules

These change nothing about how a page reads; they make the code keep its own rules. For each: what is there now, one proposal, and the reason. The owner decides by looking; "write it in" means the grammar changes, not the code.

### Visual

1. **The `#` mark has four colours.** Now: the tag colour before a link to a tag page (`quietLinks`, styles.js); the name's own colour on a tag tab (`plainProperties`, styles.js); the link colour for `#Page` above a title (`showPageKind`, pages.js); the root's colour in the tag tree (tags.js). Proposal: the tag colour wherever a `#` means "this is a tag", so the tab's `#` and `#Page` take it; the tree keeps its root hues, because there the colour says which branch, not "a tag". Why: tag against page is the distinction the owner cares about most, and one colour for "tag" makes it readable at a glance.
2. **The file type word sits in the wrong slot.** Now: `pdf`, `png` after a file link, in the place reserved for what the block holds (`referenceIcons`, styles.js). Proposal: remove the word and keep the icon. Why: the icon in front already says file and the slot after the text keeps one meaning; the exact type is in the link on hover.
3. **A date's cue wraps the words.** Now: a grey box, not a mark before (`dateStyle`, styles.js). Proposal: keep it and write it in as the one cue that wraps the words. Why: a mark before every date would make journals noisier, and the box has stood through every round.
4. **A link-only row keeps a plain bullet.** Now: the dot sits before the link, the bullet is plain (`referenceIcons`, styles.js). Proposal: keep it and write the rule as "a row that is a link is still a block; the dot says where the link goes". Why: the arrow bullet was tried in 0.2.37 and dropped; the row's identity has not changed.
5. **Two washes of almost the same strength.** Now: the here-mark at 7% over a 38% hairline, the date box at 8% (`--rf-here`, `--rf-wash-pct` in main.js; `markReferenceHere`, `dateStyle`). Proposal: one wash token for both (8%), and let the hairline alone say "here". Why: the eye cannot use a 1% difference; two numbers for one grey is a trap for the next change.
6. **The property field is a bare number.** Now: 3%, written in the rule (`plainProperties`, styles.js). Proposal: a token, `--rf-field-pct: 3%`, beside the other washes. Why: every other grey is on the scale.
7. **The sidebar has numbers of its own.** Now: the title's hover underline at 45%, the divider at 22% and 3px (`sidebarTitleOpens`, `sidebarThickDividers`, sidebar.js). Proposal: the underline takes `--rf-line-pct` like every other underline; the divider's two numbers become tokens as they are. Why: on the scale first, then decide by looking whether 45 should be 26.
8. **Small words beside text come in four sizes.** Now: `#Page` .75rem, Alias of and Inherited from .8rem, property names .94em, every other label `--rf-small` .82em (`showPageKind`, `showAliasOf`, `showInherited`, pages.js; `plainProperties`, styles.js). Proposal: the three title words take `--rf-small`; property names keep .94em, since they sit beside values, not beside text, and that number becomes a token. Why: labels beside text should be one size.
9. **The journal note repeats the box's numbers.** Now: .85em and .7 written out in `promptCss` (journal-dates.js). Proposal: `--rf-small` and `--rf-quiet`. Why: the tokens are already on the page when the note is drawn.
10. **Todos and the tree have grey scales of their own.** Now: faint at 55% and 52%, washes at 6%, lines at 13% (todos.js, tags.js). Proposal: try the shared tokens in Todos first (`--rf-quiet`, `--rf-wash-pct`, `--rf-line-pct`) and look; if a list needs more contrast than a page, write the two views in as rooms of their own. Why: one scale is easier to keep, but a list is not a page.
11. **Search keeps its own copy of the tokens.** Now: a second `tokensCss` with `--rf-mark` and `--rf-tiny` added (search.js). Proposal: move the two into main.js and drop the copy. Why: one scale, written once.
12. **The views have colours of their own.** Now: Todos' red, yellow, blue, green and the tree's four root hues, while the scale says `--rf-accent` is the only colour (todos.js, tags.js). Proposal: keep them and write them in as state colours, the same family Logseq's status icons use. Why: state is the one axis that has always been in colour.
13. **The hidden-properties chevron sits in the "holds" slot.** Now: after the block's text, a control among cues (`hiddenPropsChevron`, properties.js). Proposal: write it in. Why: hidden properties are something the block holds.
14. **A page link on a highlight is steel blue.** Now: the one place a page link leaves the text colour (`quietLinks`, styles.js). Proposal: keep it and write it in. Why: contrast on a yellow highlight.
15. **The searched words are shown two ways.** Now: bold in the result list, a wash in the preview (`tidySearch`, `searchPreview`, search.js). Proposal: bold in the preview too, and drop `--rf-mark`. Why: bold reads without colour and is what the list already uses.

### Behavioural

16. **The box exists in five looks.** Now: the shared box, the journal part's copy, the merge box with a dark Merge button, the rich-copy card in its own window with a blue button, Todos' window (shared.js, journal-dates.js, tags.js, rich-copy.js, todos.js). Proposal: every question goes through `shared.modal`; the merge box and the rich-copy card move onto it; Todos' window stays a window, because it is a view, not a question. Why: one shape for "the plugin is asking".
17. **There are two toasts.** Now: refusals and results through Logseq's own message at the top; changes in Todos and the tree in a dark bar at the bottom with Undo; the bar's stylesheet is written twice (todos.js, tags.js). Proposal: keep both on purpose, since a refusal and a change are different events, and move the bar into shared.js so it is written once. Why: the two places already mean two things.
18. **"Nothing is in edit" is refused four ways.** Now: "Select a block first", "Click in a block first", "Click into the block to check first, then run this again", "Click in a record of a query or list first" (editor.js, diagnostics.js, properties.js). Proposal: "Click in a block first" everywhere, "Click in a record first" for lists. Why: one sentence is learned once.
19. **A refusal names a key that may be rebound.** Now: "Select the words to display, then press Mod+Shift+L" (`linkShortcut`, editor.js). Proposal: name the command. Why: the key is a setting.
20. **Levels are mixed.** Now: two refusals arrive as info, one success as success, the rest warnings and plain notes (editor.js, pages.js, rich-copy.js). Proposal: a warning refuses, a plain note reports, nothing else. Why: the colour of the toast should say which it is.
21. **The plugin asks in four shapes.** Now: the note, the box, the merge box, a second menu for deleting a task (journal-dates.js, tags.js, todos.js). Proposal: the note for "may I, while you write"; the box for everything else, the task delete included. Why: two shapes, two meanings.
22. **A filled date has no note and no undo.** Now: after `j`, or with asking off, nothing comes back (`autoDate`, `autoDateAsk`, journal-dates.js). Proposal: the dark bar, "Date: Oct 16th filled for “…”", with Undo removing the property. Why: it is the one write the owner did not press a key for on that record.
23. **Fill missing dates has no undo and does not say so.** Now: "Filled 5 dates" after, nothing before (journal-dates.js). Proposal: the box says "This cannot be undone in one step", as the merge box does. Why: the owner should know before pressing Fill dates.
24. **Adding a task has no note and no undo.** Now: Enter in the add box, and the list refreshes (todos.js). Proposal: the bar, "Added “…” to today's journal", with Undo deleting the block. Why: every other change from the view has it.
25. **Deleting a task asks, then has no undo.** Now: a second menu, Delete or Keep it (todos.js). Proposal: the box, saying "cannot be undone". Why: a delete deserves the same words as a merge.
26. **A root moved up or down is silent.** Now: no bar, no Undo, where every other root change has both (`tagTreeRoots`, tags.js). Proposal: the bar. Why: it writes a setting like the others.
27. **Search-preview edits have no undo.** Now: a line saved, split or removed, with no note (`searchPreview`, search.js). Proposal: the bar with Undo for a saved line, as Todos' text edit has; nothing for split and remove, which are typing. Why: a saved line is the same kind of write as a task's text.
28. **The commands lean on Logseq's undo, unchecked.** Now: no undo of their own (editor.js). Proposal: press Cmd+Z after each in the test graph and write the answer in. Why: not verified.
29. **Fold all writes without asking.** Now: it presses fold arrows, which Logseq saves (properties.js). Proposal: write it in as reversible by its twin. Why: no harm can come of it.
30. **Escape on the note means later.** Now: everywhere else it means no (journal-dates.js). Proposal: keep it and write it in, since `k` is the no. Why: a question asked while you write should be easy to put off.
31. **Set tags opens in two places.** Now: `#Page` opens the list under the title; Cmd+T opens Logseq's dialog in the middle (`tagShortcut`, pages.js, editor.js). Proposal: Cmd+T opens the list under the title too. Why: that is where the owner's eye is.
32. **Windows and views close differently on Escape.** Now: the Todos window closes; the page, the sidebar and the tree never do (todos.js, tags.js). Proposal: write it in as the rule for windows against views. Why: it is already consistent, only unsaid.

### Written down

33. **"Three parts write to notes."** Now: the README's first paragraph. Proposal: "three parts write on their own; the commands write when you run them". Why: the shortcuts, the search preview and the typed date also write.
34. **Search settings need a reload.** Now: all of them, and the README's Appearance table does not say so (search.js, README.md). Proposal: say it. Why: the right sidebar's row does.
36. **HANDOFF's vocabulary table says "`#tag` on a block: bold, no underline".** Now: the tag sits at the right of the row as Logseq's blue link, and a mention left in the text is plain; neither is bold (seen today). Proposal: correct the row. Why: the table is what the next session reads first.
35. **"The only part that writes to your notes."** Now: the journal part's description in the settings window (journal-dates.js). Proposal: "the only part that writes without you pressing anything, and only after asking". Why: it is the true distinction.

## What Logseq still draws against the grammar

The plugin changes how Logseq draws things; some of Logseq's own drawing still bends the rules. For each: what Logseq draws, which rule it bends, and one proposal. "Leave" is a proposal too, with its reason.

1. **The block's tags sit at the right of the row as blue links.** A tag belongs to the block; Logseq shows it at the right of the row in its link blue, and a tag typed at the end of the text moves there. A tag word left in a sentence stays as a plain mention. The blue is the only strong colour on the page besides the status icons, and it is the same blue as a link, which a tag is not. The plugin stopped fading side tags in 0.2.42 and leaves them. Proposal: the tag's words in the text colour and the `#` alone in the tag colour, the same mark a link to a tag page already carries, and the same for a mention left in the text. Drawn with a first-letter rule, so no text changes. Seen today on Plugin Visual Cues.
2. **The `#` before a tag page's title is grey, the `#Tag` above it blue.** Two more `#` colours beside the plugin's four (housekeeping 1). Writing a `#` into the title was tried and rejected; these are Logseq's own. Proposal: colour both with the tag colour, so every `#` in the app means "tag" in one colour. Seen today on Idea.
3. **A tagged block's bullet is its tag's icon.** When a tag has an icon, Logseq draws it in the bullet of every block tagged with it, and before a link to the block. That is the bullet rule, done by Logseq. A tag with no icon gets nothing. Proposal: take it as the main case of the bullet rule, and let the tag tree set an icon on any tag (change 1). Seen today with #Book.
4. **A fresh record shows every empty property.** A block tagged #Book shows `authors: --- · published at: --- · rating: ---` under its text and an empty list of `isbn`, `website`, `keywords` on the light field, before anything is filled in. Logseq's; the plugin only styles the rows. Proposal: an empty value and an empty list stay hidden until the pointer is on the record, as Add property already does; a record then shows what it knows, not what it lacks. Seen today.
5. **Tables and grid views.** Dates unboxed, tags as blue chips, a trailing comma after a tag in a Tags cell ("#Decision,"). The plugin leaves tables alone on purpose, since a table gives its own structure. Proposal: leave, apart from the tag rule above, which should hold in a cell too. Seen today on Idea.
6. **The `[[` picker.** Pages, tags and date words in one list with no cue for which is which; the plugin only keeps it empty until you type. Proposal: change 7, the `#` and the date box on its rows, as a try. Whether it has to list every date was offered on 2026-10-13 and not decided.
7. **Status and priority colours.** Green done, yellow doing, red urgent are Logseq's, and the only colour on the page besides tags. Proposal: leave; the grammar takes them as the state axis, and Todos uses the same family.
8. **Property lists.** Logseq's bullet beside every value, its type icon before every name, its blue tick for a checkbox. The owner decided on 2026-10-12 to leave the bullets. Proposal: leave; the tick is a control and state is in colour.
9. **A bare count on a page row.** Under a tag tab and under Linked references, a page listed as a row carries a number at the right ("Atlas … 7"); nothing says what it counts. Proposal: find out what Logseq counts there, then draw it in the grammar's own form after the text, `· 7 references`, small and quiet, with a hover title. Seen today on Ada Okafor.
10. **Set tags opens in the middle.** Logseq's command puts its dialog in the middle of the window; the plugin's `#Page` opens the list under the title. Proposal: housekeeping 31, one place, under the title.
11. **Fold arrows, the hover preview, the bullet menu.** Logseq's own. The arrows under Linked references stay as Logseq draws them (decided). Proposal: check the hover preview once; it draws blocks with the same classes, so the plugin's cues are probably already in it; write the answer in.
12. **Overdue dates.** Logseq's yellow on an overdue Scheduled or Deadline stays inside the plugin's grey box. Proposal: leave; change 10 adds the tense of ordinary dates around it.
13. **A page link and a block link are one element.** Logseq draws both the same way; only the database says which is which, so the plugin's dot can arrive a moment after a fresh page is drawn. Handled; the flash is the cost. No proposal.
14. **Behind the scenes.** Three habits the code works around and the reader never sees: a press on the link element itself is ignored, so every clickable mark is drawn on an inner span; pressing a fold arrow is a database write; a database change carries no details, so the plugin re-reads the page's tree after every edit. Constraints, not choices.
