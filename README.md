# Logseq DB Refinements

A personal plugin for Logseq DB graphs that changes how things look, so pages, blocks, links, tags, properties and dates are easier to tell apart. Version 0.4.56.

Besides the look of pages, it holds:

- **Search**: a calmer search window with details, grouping, a preview and typed filters, and search that can stay open in the right sidebar.
- **Right sidebar**: titles that open their page in the main view, and a clear line between items.
- **Todos**: a window with every task in the graph, grouped by when it needs you, by status or by page, where you change a task's status, priority and due date in place.
- **Tag tree**: all your tags as one tree under a few root tags (Occurrence, Entity and Concept), where you make new tags in the right place and move tags under other tags.
- **Shortcuts** for linking, making pages, tagging, deleting a block and starting a new top-level block.
- **Journal day as date**: fills an empty Date property with the journal day a record was written on. It is the only part that writes to your notes, and only in the graphs and for the tags you name in its settings.
- **Copy as rich text**: copies a page or block as tidy formatted text, or saves it as a PDF, for people who don't use Logseq. It only reads your notes.

## What is in the folder

| File | What it is |
| --- | --- |
| `package.json` | Tells Logseq the plugin's name, version and starting file. |
| `loader.js` | The starting file. It loads `main.js` fresh each time, so a reload picks up changes. |
| `main.js` | The look of pages, the shortcuts and the commands. |
| `parts/` | The other parts, loaded by `main.js`: `sidebar.js`, `search.js`, `journal-dates.js`, `rich-copy.js`, `todos.js` and `settings-panel.js` (the settings window). |
| `README.md` | This guide. |
| `CHANGELOG.md` | What changed in each version. |

## Install

1. Unzip the download. In Logseq Desktop, turn on **Developer mode** in Settings.
2. Open Plugins (`t p`), choose **Load unpacked plugin**, and pick the unzipped `logseq-db-refinements` folder. Keep the `parts` folder next to `main.js`.
3. If an earlier copy is loaded, replace its files and press **Reload** on the plugin in the Plugins panel. The plugin needs no internet connection.

## Settings

Open the settings from **Refinements settings** in Logseq's three-dots menu (top right, under Plugins), or run **Refinements settings** from the command palette.

- Sections are listed on the left, with **Shortcuts** last and **Changed by you** for everything you have changed.
- A search box (press `/` or `Cmd+F` in the window) looks through every setting's name and explanation.
- Most look settings have a small picture of what they change; clicking the picture flips the switch.
- A changed setting has a small dot and a **Reset** link. Each change is saved as you make it.
- Most switches apply at once. Those that need a reload say “after reload”, and a **Reload plugin** button is at the bottom.
- Logseq's own settings page for the plugin (Plugins, `t p`) still works and is one click away at the bottom of the window.

## Shortcuts

All can be changed or cleared in the settings window under **Shortcuts** (they apply after a reload). On a Mac, `mod` is Cmd; elsewhere it is Ctrl. Every action is also in the command palette under the same name.

| Shortcut | Action |
| --- | --- |
| `Cmd+Shift+L` | Link selected text to a page |
| `Cmd+Option+P` | Open selected text as page |
| `Cmd+T` | Add tags to this page |
| `Cmd+Delete` | Delete this block (with the blocks nested under it) |
| `Option+Return` | New block at the outermost level |
| `Cmd+Option+F` | Search in the right sidebar |
| `Cmd+Option+T` | Todos (changed under **Todos** in the settings window) |
| `Cmd+Option+E` | Expectations (changed under **Expectations** in the settings window) |
| `Cmd+Option+G` | Tag tree (changed under **Tag tree** in the settings window) |
| none | Make a page from this block (also in a bullet's right-click menu) |

## Appearance

| Feature | What you see | How it works |
| --- | --- | --- |
| Page links | Normal text colour and a faint underline, clearer on hover | Turn off with **Quiet page links**. |
| Links to a tag’s own page | Underlined like a page link, with the tag’s icon in the colour Logseq gives tags (a `#` in that colour when the tag has no icon) | A page’s own icon stays in the normal text colour, and an icon stays on the same line as the first word of the name. |
| Links to blocks | A small dot in front, and no underline; a linked task shows its status icons in place of the dot | Blocks are confirmed from the database, so a page is never marked as a block. Turn off with **Icons for block references and files**. |
| PDF selections | The excerpt reads as a quotation: the words between quotation marks, then a small muted citation in parentheses, `(p. 1)` on the PDF’s own page and `(Document title, p. 1)` elsewhere. A muted double quotation mark (`“`) replaces the citation bullet. Hover shows the full title. | Clicking the excerpt or its citation opens the exact highlight through Logseq’s native link. Drag to select text; links inside the excerpt remain clickable. Area selections keep their image and put the citation before it. Enter or Space on the citation also opens the highlight. Turn off with **Compact PDF citations**. |
| Links to PDFs and images | A grey document or picture icon in front, the words with a page link’s faint underline, and the file type (`pdf`, `png`…) after in small grey | The icon and file type come from the link’s address. Turn off with **Icons for block references and files**. |
| Dates | A grey box in the normal text font | No border or calendar icon. Covers date values and links to journal pages. Turn off with **Dates in a soft grey box**. |
| What sits below a block | After the block’s text: `↳`, a dashed circle with the number of unfinished tasks at any depth, and small image or PDF icons for files directly below | Hover shows the counts. Shown on ordinary pages and on the Journals list. Done and canceled tasks are not counted. Turn off with **Show what a block holds**. |
| Nesting lines | Faint lines beside nested blocks; the line beside the branch you point at or type in is a little stronger | Recolors Logseq's own line, so nothing moves. Turn off with **Faint nesting lines**. |
| Empty blocks | A block with no text, nothing nested under it and no tags, properties or pictures shows no dot, so empty blocks work as space between groups. Pointing at it shows the dot faintly; it is back in full while you type in it | Turn off with **Hide the dot on empty blocks**. |
| Embeds | A faint line at the left of embedded blocks and pages | Turn off with **Line beside embedded content**. |
| Tag background (optional) | A faint violet chip behind tags, in text and at the end of a block | Off by default; turn on with **Soft background behind tags**. |
| Page title row | The page’s tags and actions (such as **Set property**) stay visible above the title, muted until you point at them, with `#Page` on an untagged page (click it to set tags) | Turn off with **Always show page title actions and tags** and **Show what a page is above its title**. |
| Linked references | The link to the page on screen has a faint grey wash behind it with a fine line beneath (on a journal, so does a date that points to that day); source pages are set apart by a gap and share one plain heading, followed by `· n` when a page holds several references; the grey parent path has a bullet with the reference stepped in below it; blocks below a reference are quiet | Turn off with **Mark the link to this page in Linked references** and **Clearer Linked references**. |
| Alias pages | A small muted “Alias of …” line under the title of a page that another page lists as its alias; the name opens the original | Turn off with **Show which page an alias belongs to**. |
| Tag pages | Under the tag's own properties, a line such as “Inherited from #Media: keywords, rating, website”, one per tag it extends; names open the tag or property | Turn off with **Show inherited properties on tag pages**. |
| Links inside a reference | A page link or tag shown inside a block reference opens its own page when clicked (Shift-click: in the sidebar); the rest of the reference still opens the block | Turn off with **Links inside a reference open their own page**. |
| Sidebar and toolbar items | The items named under **Quiet these sidebar and toolbar items** (default: Flashcards, Graph view) are smaller and lighter, in place | Set the list empty to turn it off; applies after a reload. |
| Right sidebar | Flat panels; page properties opened and their Hide control hidden; Page graph and (Dev) buttons hidden | Turn off with **Tidy the right sidebar** (reload). The **Search** button there is turned on and off under **Search in the right sidebar**. |
| Right sidebar titles | Clicking the title of a page or block in the right sidebar opens it in the main view, with a faint underline while you point at it. The small arrow before the title, and the empty part of the title bar, still fold and unfold it; Shift-click works as before. Search, Help and other items with nothing to open still fold | Turn off with **Sidebar titles open their page**. |
| Lines between sidebar items | A thick grey line between the items in the right sidebar | Turn off with **Thick line between sidebar items**. |
| Page icons | Generic page icons in titles and sidebars become a small plain rectangle; custom icons are unchanged | Turn off with **Simpler page icons**. |
| Grey parent paths | The grey line above a reference or query result shows a link as its words with a soft underline (twice as thick as other links' underline, so it shows on the small grey text), instead of `[[Name]]`; a labelled link `[words]([[page]])`, which Logseq cuts to `[words` there, shows just `words`, underlined. The words are not clickable on their own: a click opens that parent block, as before. The path also uses the room it has before cutting text short | Turn off with **Plain links in grey paths** and **Tidy parent paths**. |
| The `[[` page menu | Typing `[[` no longer opens a list of date words (Today, Tomorrow, Next week …) at once; the menu appears with the first letter you type, and until then the arrow keys, Enter and Tab leave it alone | Turn off with **Empty [[ ]] menu until you type**. |
| Dates typed in `[[ ]]` | A date typed year first inside `[[ ]]` (`2026 10 14`, `2026-10-14`, `2026/10/14`, `2026.10.14` or `20261014`, month and day with two digits) turns into that day's journal name (“Oct 14th, 2026”) as the last digit is typed, so the menu offers the journal page | Uses the journal's own title, or Logseq's date format when that day has no page yet. Undo brings the digits back. Turn off with **Year-first dates in [[ ]] link to journals**. |
| Page labels | A page link whose shown name ends in a tag name (“Name #tag”) shows the stored title alone | Turn off with **Page links without trailing tags**. |
| Properties | Under a block, properties read as `name: value · name: value` with no capsule outlines; property names are grey so the values stand out. A property list under a block (one name per line) sits on a very light grey field with square corners, and so does the page's own list under its title, with one dot per property and **Add property** shown only while you point at the list (on the page and in the right sidebar). | Turn off with **Plainer properties**. |
| Tag pages | On a tag's own page, the rows of its table, the records under it and its Linked references do not repeat that tag; other tags stay. | Turn off with **Leave a tag page's own tag off its rows**. |
| Left sidebar lists | Favorites and Recent show an icon only where it says something: Logseq's generic page icon is left out (names stay lined up); a tag's #, a page's own icon and an icon from its tag stay. Journal days are in grey. | Turn off with **Left sidebar icons only where they mean something**. |
| Journals list | Each day is only as tall as what it holds, instead of at least 500px. | Turn off with **Journal days only as tall as what they hold**. |
| Hidden properties | While you point at a block that has hidden properties, or near the spot where its arrow sits, a small grey chevron shows right after the block's own text, turning like the fold arrow beside a block: pointing right while they are folded, down while they are open (an open one stays visible). Click it to open or fold them. Logseq shows its own “Show hidden properties” button only on a block you have zoomed into; there it becomes the same arrow. Tasks get it too, because Logseq counts an empty Priority or Deadline as hidden. It is left off a folded block and waits while the block is being edited. | Turn off with **Hidden properties arrow on every block**. |
| Records under a page's tag tabs | Each tab name starts with `#` in the name's own colour (a tab is not a link). In each record, the value that points to the page on screen has the faint grey “points here” mark; a folded record shows that property beside its title (“owner: page”) | The `#` comes with **Plainer properties**; the mark and the folded label with **Show how records are linked**. |

Branch cues refresh on navigation and graph edits. The plugin reads the current page’s block tree and queries DB metadata for task status, asset blocks, and references to assets. Done and canceled tasks are excluded. Counts describe blocks containing each type, rather than individual files. Some custom task or asset representations may not be recognized. This plugin does not alter the native mixed `[[` picker; labeling its rows accurately would require a supported type-aware menu extension.

## Todos

Open it with the checklist button at the top right of Logseq, with `Cmd+Option+T`, or by running **Todos** from the command palette.

Todos can show three ways:

- **Window**: a window over the page. Its top right has buttons to move it to the main area or the right sidebar.
- **Page** (the default): a full view in the main area, like a page. Logseq's back and forward buttons work with it. A button at its top right moves it to the sidebar.
- **Sidebar**: a simpler list in the right sidebar, so you can keep it open beside your pages. It shows open tasks grouped by when, with a search box and a box to add a task. Each row has the status circle, the task's text and its date; only urgent and high priority show. A button at its top opens the full page view.

The setting **The button and shortcut open Todos as** picks which one the toolbar button, the shortcut and **Todos** open. The command palette also has **Todos as a window**, **Todos as a page** and **Todos in the right sidebar**. It lists every task in the graph: every block with a status, and every block tagged `#Task` or a tag that extends Task (such as `#Bug`). The statuses are read from your graph's **Status** property: Logseq's six, plus any choice you add to it (Configure > Available choices on the Status page), in your order. An added status gets a dotted circle, unless its name says it is finished (Done, Received, Complete…) or dropped (Canceled, Dropped…).

- **Grouping** (top right): **When** puts late tasks first, then today, tomorrow, the next 7 days, later and no date. A task's date is its due date (Deadline), or the day it is planned for (Scheduled) when it has no due date. **Status** groups by Doing, In review, then the other open statuses in the order of your graph, then Done and Canceled. **Page** groups by the page or journal day the task is on, with a small bar showing how many of that page's tasks are done.
- **Chips**: **Open** (not done or canceled), **Doing** (doing and in review), **Done** (finished or canceled in the last 14 days, newest first; the number of days is a setting) and **All**. **Urgent and high** and **Hide backlog** narrow the list further. The window remembers your choices.
- **Each row**: the circle is the status, then the task's text (links show their page's title; click a link to open that page, Shift-click for the sidebar), its date and its priority bars. Under the text, smaller and grey: how many of its subtasks are done (blocks under it that have a status), its other tags and the page it is on. Click the circle, the date or the bars to change them; the change is written to the task at once, and a note at the bottom offers **Undo** for a few seconds. A task you change stays in view, faded if it no longer fits the chip, until you pick another chip or grouping.
- **Editing the text**: double-click the text (or press `e` on the highlighted row) to change the task's first line in place; Enter saves, Esc leaves it. Links are shown by their page names while editing.
- **Dates** with a red outline and a very light red fill are due dates that have passed; the **Late** heading looks the same. A date that is today is written in the normal text colour, a planned day in italics. The date menu offers Today, Tomorrow, Next Monday, In a week or any day, and can remove the date. It changes the date shown: the due date, or the planned day when that is all the task has.
- **Going to a task**: click its text to open it where it is; Shift-click opens it in the right sidebar. In the sidebar list, the task opens in the main area and the list stays.
- **Adding**: type into **Add a task to today's journal** and press Enter. The task goes to the end of today's journal with status Todo (Logseq tags it `#Task` itself). The box understands `!urgent`, `!high`, `!medium` or `!low` for the priority, and a day at the end (or after "due" anywhere, or after "by" at the end) for the due date: `today`, `tomorrow`, a weekday name (a short form such as `fri` or `thu` works too, but not `sun`, `sat` or `wed`, which are ordinary words) or `next week`. A line under the box shows what it understood, and these words are left out of the task's text.
- **Keys**: `↑` `↓` move through the tasks (the pointer highlights a row too), `Enter` goes to the task (`Shift+Enter` to the right sidebar), `x` or `Space` marks it done or not done, `s` opens its status menu, `p` its priority menu, `d` its date menu, `e` edits its text, `/` goes to the search box, `Esc` closes the window. Menus take the arrow keys and Enter. In the page and sidebar views the keys work once you click inside the list.
- The list updates while the window is open when tasks change elsewhere.

Settings (section **Todos**): **Todos button in the toolbar** (on), **The buttons and shortcuts open Todos and Expectations as** (page), **Open Todos** shortcut (`mod+alt+t`), **Days shown under “Done”** (14).

**Right-click** a task for a menu: Open, Open in right sidebar, Edit text, Status, Priority, Due date (or Planned date) and Delete task, which asks once more before it deletes the task and the blocks under it.

## Expectations

Things you are waiting on someone else for, which are not your own tasks. It is the same list as Todos, with the same grouping, chips, search, keys, right-click menu and the three places to show it (main view, window, right sidebar). Open it with the hourglass button at the top right of Logseq, with `Cmd+Option+E`, or by running **Expectations** from the command palette. Logseq puts a plugin's second toolbar button in the puzzle-piece menu at first; the pin next to it there keeps it in the toolbar.

- An expectation is a block with the tag **Expectation** (or a tag that extends it). These blocks are left out of Todos.
- In place of a status, the circle shows where the expectation stands: the choices of its **juncture** property (Waiting, Updated, No change, Done). A choice named Done, Received or Canceled counts as finished. An expectation with no juncture counts as the first choice (Waiting).
- **Add an expectation to today's journal** adds a block there with the tag and the first choice.
- Due and planned dates and priority work as in Todos.

Settings (section **Expectations**): **Tag of an expectation** (`Expectation`), **Property that holds where it stands** (`juncture`; leave empty to use Logseq's status), **Expectations button in the toolbar** (on), **Open Expectations** shortcut (`mod+alt+e`).

## Tag tree

All your tags as one tree, so you can see what is inside each tag, make new tags in the right place and move tags around. Open it with the tree button at the top right of Logseq (Logseq may put it in the puzzle-piece menu first; the pin there keeps it in the toolbar), with `Cmd+Option+G`, or by running **Tag tree** from the command palette. It shows as a full view in the main area, or as a smaller panel in the right sidebar (**Tag tree in the right sidebar**).

- A tag's place in the tree is its **Extends** property: a tag inside #Entity extends Entity and inherits its properties. A tag can extend more than one tag; it then shows under each, marked "also under …".
- At the top are the **root tags**, by default **Occurrence**, **Entity** and **Concept**, each with its own colour. Every tag below a root carries that colour on its `#`, so you can see at a glance which branch a tag belongs to. A root that does not exist yet has a **Make** button.
- Below them, **Not placed yet** lists tags that sit under none of the roots, and **Under Logseq's tags** the tags that extend Logseq's own Task or Card.
- Each row shows how many nodes carry the tag, the tag's own properties and its description. A folded tag says how many tags are inside it. Tags with tags inside them are a little heavier; a root is the largest.
- **Make a tag inside another**: the **+** on its row, or `n`. Type a name and press Enter; several names separated by commas make several tags. A name that is already a tag is put inside as well, instead of making a second one; one of Logseq's own tags (Task, Page…) is left where it is. **Undo** takes a new tag away again and puts a moved one back.
- **Move a tag**: drag it onto another tag (hold `Option` to keep it where it was too, so it extends both), or onto **Not placed yet** to take it out of the tag you dragged it from. Or press `m` (Move to …) and type the new parent's name, or `a` (Also put under …). `Tab` puts a tag inside the tag just above it, `Shift+Tab` moves it out one level, as in an outline. A tag cannot go inside one of its own tags. Every move shows a note with **Undo** for a few seconds.
- **Rename**: `r`, double-click the row, or the row's menu. Tags are renamed everywhere, as Logseq's own rename does.
- **Properties**: under each tag, its own properties sit on light chips, and the ones it gets from the tags above it follow in grey, grouped as "from #Entity …" (in Logseq a tag has every property of the tags it is inside). Click a property to **Move up** to a tag above (it then applies to that tag and everything inside it), **Take it off**, or open it. `p` (or **Add a property …** in the row's menu) adds one of your properties; a name that is not a property yet opens Logseq's own **Add tag property** on the tag's page with the name typed in, where you choose its type. Taking a property off a tag keeps values already filled in.
- **Root tags** are yours to choose: **+ Root tag** below the roots adds an existing tag or makes a new one; a root's menu has **Move this root up / down** and **Stop showing it as a root** (the tag itself stays); a tag at the top level has **Make it a root**. To make several roots at once, pick the tags with `Cmd`-click on their names or rows (or `x` on the current row; `Shift`-click a row picks every row from the current one to it), then press **Make them roots** in the bar that appears; the bar also has **Move to …** to put them all inside one tag, and `Esc` unpicks. A root that does not exist yet has **Make** and **Not a root**. This is the **Root tags** setting, so it is the same in every graph.
- **A tag under two tags**: its menu has **Keep only under #X** (drops the other parents) and, for a tag that is also a root or at the top, **Keep only at the top**.
- **Merge two tags** (`j`, or **Merge into …** in the row's menu): pick the tag to keep. Works for two tags with the same name (marked "same name as another tag"; click the mark), a tag into its parent, or two tags beside each other, roots included. Everything tagged with the old tag gets the kept one; links, property values, aliases and "tags of its values" point to it; tags inside it move into the kept tag; its own properties and blocks, and the aliases, icon and property values on its page, move over; and its description is kept if the other has none (the summary says when it is dropped). A summary shows what will change and nothing happens until you press **Merge**. Logseq then deletes the old tag for good: this cannot be undone in one step, so try it in a test graph first.
- Click a tag's name to open its page (`Shift` click: right sidebar). Right-click a row, or its `…`, for all of these. `↑` `↓` move between rows, `←` `→` fold and unfold, `Enter` opens, `/` finds. Folded tags are remembered on this computer.

Settings (section **Tag tree**): **Root tags** (`Occurrence, Entity, Concept`), **The button and shortcut open the tag tree as** (page), **Tag tree button in the toolbar** (on), **Open the tag tree** shortcut (`mod+alt+g`).

## Search

Logseq's search window is calmer and easier to read. Typing markup in result text and paths, such as `[[ ]]` and `**`, is faded so the words stand out (your blocks are unchanged). It also has compact rows, small light group headings instead of grey bars, a quiet icon and path, bold matched words instead of yellow highlights, and a faint grey wash on the selected row. Page results use the plugin's plain page rectangle. Results, ranking and keyboard keys are Logseq's own. **Shift+Enter** or **Shift-click** opens the selected result in the right sidebar instead of the main view (the bar along the bottom of the window says so), and search closes. Turn this off with **Tidy the search window**.

**Roomier search window** (on by default): a larger search window with bigger text and more room between results and groups. Results fade in as you type. “Show more” and key shortcuts appear only under the pointer, and the key hints at the bottom are hidden. The page and parent blocks above a result are named in full, with the page in firmer text, a small bullet before each parent block, and “…” where Logseq skips levels. Turn it off in the plugin settings.

**Search in right sidebar**

1. Click **Search** at the top of the right sidebar, press `Cmd+Option+F` (`Ctrl+Alt+F` outside a Mac), or run **Search in right sidebar** from the command palette.
2. Logseq's search opens in the right sidebar and stays there. Click a result to open it in the main area; Shift-click opens it in the sidebar too. The search box keeps your words until you change them.
3. Running the command again jumps back to the sidebar search if it is already open. Close it like any sidebar item.

This uses Logseq's own "keep search in the sidebar" action (also available by pressing `Cmd+Enter` inside search), so results match normal search.

The **Search** button at the top of the right sidebar can be hidden with **Search button in the right sidebar**.

**Say more about each search result**: at the right of each row, what the result is (its tags, or Page, Journal, Property) and when it was last edited; under a result that is only a heading, the first line beneath it; when the searched words are not in the text shown, where they were found.

**Put search results page by page**: results from the same page sit together, with the page name shown once. The arrow keys follow this order.

**Preview the selected result**: a panel at the right of the search window shows the selected result with its blocks. Click a line to edit it. **Preview: edit with Logseq's own editor (trial)** is off by default.

**Filter search with codes**: type `#tag`, `in:Page`, `p:Name` or `p:Name=value` for a property (`property:` and `prop:` work too), `is:task`, `todo`, `done`, `page`, `journal` or `block`, and `edited:today`, `yesterday`, `week`, `month`, `year` or a count such as `3d` or `2w`. A list under the box suggests names as you type; Tab or Enter takes one. Names with spaces go in `[[ ]]`. The window's **? More tips** guide lists them all.

## Journal day as date

Fills an empty Date property on chosen records with the journal day they were written on. A date you entered yourself is never changed. By default it asks first: a small note at the top right says the day and the record; `j` (or **Yes**) fills it, `k` (or **No**) leaves that record alone for the rest of the session, `Esc` leaves it for now. While you are typing in a block, `j` and `k` stay yours and the note's buttons work instead; a note nobody answers goes away after about half a minute. One record is asked about at a time.

| Setting | What it does |
| --- | --- |
| Fill dates automatically | Fills the date of new records as you write them. |
| Ask before filling | Shows the j / k note first (on). Turn off to fill without asking. |
| Tags | Records with these tags (or a tag that extends them) are filled. Nothing is filled while this is empty. |
| Date property | The Date-type property to fill (not Date and time). |
| Only in these graphs | Dates are filled only in the graphs named here. Nothing is filled while this is empty. |

### Where the day comes from

A block written on a journal page gets that page's day. A page made from a journal (for example by typing `[[Name]]#Tag` there) is left alone: a page has no day of its own, so nothing is guessed for it.

New records are asked about (or filled) automatically. Older ones are filled only when you run **Fill missing dates from journal days** from the command palette, which says how many it found and asks first.

## Copy as rich text

Copies a page or a block as tidy formatted text for people who don't use Logseq. Paste it into Pages, Word, Mail or Google Docs, or save it straight to a PDF. It only reads your notes.

### How to use it

- **A whole page:** the page's "..." menu (top right) > **Copy page as rich text**.
- **One block and everything under it:** right-click its bullet > **Copy as rich text**.
- **Several blocks:** select them, then the command palette > **Copy selected blocks as rich text**.

Each copy opens a small window. Pick a layout:

- **Document:** top-level blocks become paragraphs, nested blocks become indented bullets.
- **Outline:** every block is a bullet, indented exactly as in Logseq.

If what you copy has properties, the window also lists them with tick boxes. Only ticked ones are
included. Your choices are remembered for next time; properties you haven't seen before start ticked.
Press Return to copy, Escape to cancel.

#### Title and pages

When you copy a whole page, the window offers a **title block**: the page name as a large title,
then today's date and an optional "Prepared by" name over a thin line. For PDFs you can add a short
**footer** (bottom left, e.g. "Confidential") and **page numbers** ("Page 2 of 5", bottom right).
These choices are remembered.

#### Queries and timelines

Query blocks (simple or advanced) are copied as their results, so a query becomes a list you can
send. For each query the window offers a date to sort by: the journal page the result sits on,
any date property (such as a start or due date), Deadline, Scheduled, or the date it was created.
Tick **newest first** to reverse the order. Sorted results are laid out as a timeline: month
headings ("October 2026"), with each result's day in a column on the left. Results without that
date go at the end, under "No date". The sort you
pick is remembered per query; choose "Logseq's order" to keep the query's own order.

Ordinary bullet lists keep the order you wrote them in; only query results are sorted.

**Save as PDF…** in the same window lays the same text out on pages and opens the Mac's print
window. Click **PDF** at the bottom left, then **Save as PDF**; the page title becomes the file name.

### What it simplifies for outside readers

- Page links and tags become ordinary words; block references become the referenced text.
- Indentation follows the layout you pick (see above). Collapsed blocks are included.
- Heading blocks become headings. Bold, italic, strikethrough, highlight, code and web links are kept.
- Tasks start with their status as a word: "Open: …", "In progress: …", "Done: …", "Cancelled: …".
- Properties appear as a small grey line, "name: value · name: value".
- Templates, empty bullets and Logseq's own built-in properties are left out.
- Code and maths blocks are kept as monospaced text. Images are not copied yet.

## Commands

**Link selected text to a page**

1. Select the words you want readers to see, such as `rename`.
2. Press `Cmd+Shift+L` (`Ctrl+Shift+L` outside a Mac).
3. Type the real page title and press Enter. The selection becomes `[rename]([[real name of link]])`.

Cancel leaves the block unchanged. The command accepts a single-line label and page title; it checks the saved block again before replacing text. It creates the link, not the destination page itself; Logseq can resolve or create that page when you follow the link.


**Make a page from this block**

1. Put the cursor in a block or select it. Run **Make a page from this block** from the command palette, or right-click its bullet and choose the same name. 
2. The block's text becomes the page title. The new page contains a reference back to the original block, with copies of the child blocks nested beneath that reference.
3. The original block and children remain where they are. An existing page with the same title is left alone. Text is copied; block properties, tag associations, and asset metadata are not copied.

**Open selected text as page**

1. Select text while editing a block. Within 30 seconds, run **Open selected text as page** from the command palette or press `Cmd+Option+P` (`Ctrl+Alt+P` outside a Mac).
2. The selected words become a `[[link]]` in their block, then the plugin opens the page with that name (creating it if needed). Trailing tags are left out of the page name. If the block changed in the meantime, or the selection contains brackets or line breaks, the page still opens and the text is left as it was.

**Add tags to this page**

Press `Cmd+T` (changeable in the settings window), run **Add tags to this page**, or click the `#Page` above the title of an untagged page. The command and shortcut call Logseq's own **Set tags** command (`p t`), so its tag dialog opens in the middle of the window for the page you are on; the `#Page` click opens the same list just under it. On the Journals list the command says so and does nothing.

**Delete this block**

Press `Cmd+Delete` while typing in a block. The block and the blocks nested under it are deleted, and the cursor goes to the end of the block just above. If some of the block's text is selected, only that text is deleted, as the Mac's own Cmd+Delete would do. With no block being edited, the selected blocks are deleted (a block inside another selected block goes with it).

**New block at the outermost level**

Press `Option+Return` while typing in a block. After the top-level block you are in (and everything nested under it), the plugin adds an empty block as a spacer and then a new empty top-level block with the cursor in it.

**Fold all results / Unfold all results**

Click in a query or one of its results, then run **Fold all results in this query** or **Unfold all results in this query** from the command palette (with no click, the query on screen is used). They press each result's own fold arrow, so Logseq keeps the fold while the page is open, and results drawn later get the same fold. A result you fold or unfold by hand afterwards keeps your choice. With no query on the page the command says so. **Copy fold log (troubleshooting)** shows what happened to each result.

**Choose properties shown in this list**

Click in a record of a query (or of a list on a page such as a tag page) and run **Choose properties shown in this list** from the command palette. Tick the properties to show, untick **Body** to hide the notes under each record, tick **One line per record** for a timeline layout; **Show all** returns to Logseq's view. The choice is saved in the plugin's settings, not in your notes.

**Troubleshooting commands**

These change nothing: **Check what the plugin finds on this page** (how many of each Logseq part the plugin relies on are on screen, and the plugin's own marks), **Copy styling details of this block** (how Logseq built the block you are in), **Copy page title area details**, **Check linked-record labels**, **Copy fold log**, **Turn measuring on or off** and **Copy performance report** (timings of the plugin's work).

Logseq themes and releases can change the names the plugin relies on; after an update, run **Check what the plugin finds on this page**.

## Version history

See `CHANGELOG.md`.
