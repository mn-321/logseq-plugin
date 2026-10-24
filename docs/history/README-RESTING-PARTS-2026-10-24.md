> **Record, not a plan.** Written 2026-10-24 at 0.4.381: the README's descriptions of the parts that rest, moved here
> word for word when the README was brought to what runs. They describe each part as it was when it last ran (Todos and
> Expectations to 0.4.128, the search extras to 0.4.355, Properties in the line and the old link box to 0.4.250, the
> document export at 0.4.249); none of it loads today. Why each rests: `docs/STATE.md` and
> `docs/DECISIONS-AUTONOMOUS.md` 17, 19 and 20. A part comes back only by being rebuilt on the kit and the model.

# The resting parts, as the README described them

## Todos

**Paused for now.** With **Use Todos and Expectations** off (the default since 0.4.128) Todos and Expectations add no toolbar button, no command and no shortcut. Switch it on in the settings window and reload the plugin to use them again; everything below then applies.

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

## Search (the resting extras)

The rest of the old search part rests, not loaded (`docs/DECISIONS-AUTONOMOUS.md` 17): what follows describes it as it was.

**Search in right sidebar**

1. Click **Search** at the top of the right sidebar, press `Cmd+Option+F` (`Ctrl+Alt+F` outside a Mac), or run **Search in right sidebar** from the command palette.
2. Logseq's search opens in the right sidebar and stays there. Click a result to open it in the main area; Shift-click opens it in the sidebar too. The search box keeps your words until you change them.
3. Running the command again jumps back to the sidebar search if it is already open. Close it like any sidebar item.

This uses Logseq's own "keep search in the sidebar" action (also available by pressing `Cmd+Enter` inside search), so results match normal search.

The **Search** button at the top of the right sidebar can be hidden with **Search button in the right sidebar**.

**Say more about each search result**: at the right of each row, what the result is (its tags, or Page, Journal, Property) and when it was last edited; under a result that is only a heading, the first line beneath it; when the searched words are not in the text shown, where they were found.

**Put search results page by page**: results from the same page sit together, with the page name shown once. The arrow keys follow this order.

**Preview the selected result**: a panel at the right of the search window shows the selected result with its blocks; empty bullets are left out, and what is under one moves up into its place. Click a line to edit it; a saved line shows a bar at the bottom with **Undo** for a few seconds. **Preview: edit with Logseq's own editor (trial)** is off by default.

**Filter search with codes**: type `#tag`, `in:Page`, `p:Name` or `p:Name=value` for a property (`property:` and `prop:` work too), `is:task`, `todo`, `done`, `page`, `journal` or `block`, and `edited:today`, `yesterday`, `week`, `month`, `year` or a count such as `3d` or `2w`. A list under the box suggests names as you type; Tab or Enter takes one. Names with spaces go in `[[ ]]`. The window's **? More tips** guide lists them all. A search that is only `#Tag`, for a tag you have, lists the tag's own page first (marked `#`, “tag page” at the right), so Enter opens it, and the records tagged with it below.

## Properties in the line

Type `p::` at the end of the block you are writing. A list opens under the record's property row with the fields of the record's own tags first, in the order of their pills (a Meeting shows attendees and project), each with its type, then every property of yours. Letters filter it; `Enter` picks a name and the list turns into values of that type. `name::value` skips the first step when you know the field: `date::fri`, `owner::ad`, `stage::pl`. The first letters do when they start one field only: `pro::at`, `a::mat` on a Meeting (the record's own fields are tried first, then every property); when several start so, `d::` lists date, Deadline and due date and the letters after `::` narrow them. While a row is highlighted, the value it would write is pencilled in, italic, where it will go: in the record's own pill for that field when Logseq shows one, else at the top of the list. `Enter` writes it, takes the token out of your text, leaves the caret where it was, and a small grey **undo ⌘z** sits beside the value in the record’s row for seven seconds (a click, or `Cmd+Z` while the caret is still in the block, takes it back; with **Undo beside the value** off, the dark bar at the bottom offers Undo instead). A field that takes several pages (attendees) keeps its list open after `Enter`, with the letters cleared and no row chosen: more letters and `Enter` add the next, `Enter` with nothing typed (or `Esc`) finishes. `Esc` closes the list and takes the token out of your text (`Cmd+Z` brings it back); `Tab` does the same and nothing more (it no longer indents the block or takes a proposal in the same press); a click elsewhere does the same, so a block is never saved with `p::` in it. When several names start with the letters before `::` and the letters after it fit none of them (`st::pl` on a Project: stage, start date), the names stay listed and `Enter` picks one, carrying the letters over as its value, so `st::pl`, `Enter` becomes `stage::pl` and Planned is next. `Up` and `Down` move; a click on a row picks it. `Enter` with nothing to pick does nothing: the list says so, and `Esc` takes the token out. The letters before `::` may run into the word before them: `Mateoa::pri` reads as `a::pri` (attendees) when no field is named `mateoa` and the tail `a` starts exactly one of the record’s fields, and the word stays.

**Keeping the value in your words (`;;`).** Two semicolons in place of the two colons do everything `::` does and also leave the value in your sentence where the token was. `Meeting joe deadline;;today`, `Enter` sets Deadline to today and the block reads `Meeting joe` followed by a link to today’s journal page. What stays depends on the field: a field that holds pages (attendees, project) leaves a link to the page, the same page the field holds; a date leaves a link to the day (a time typed after it stays as typed), because a word like “today” would be wrong tomorrow; free text, a choice, a number or a url stays as plain words, exactly as written in the field. A field that takes several pages leaves them all, joined by commas, when you finish. `p;;` works as `p::` does and keeps the `;;` when it turns into the name. Undo takes the value out of the field and leaves the words. With **Two semicolons keep the value in the words** off, `;;` is plain text.

What the list offers, by the property's type:

| Type | The list | You can also type |
| --- | --- | --- |
| Date | today, tomorrow, the next weekdays, each with its day | `fri`, `next fri`, `+3`, `2026-10-23`, `23 oct` |
| Date and time | the same days; a time may follow | `fri 19:00` |
| Page (one or many) | pages of the field's class (owner lists Persons), with their kind; an italic **Make Person “…”** row when nothing matches exactly | a few letters |
| Choices | the choices | a letter |
| Text | the values already used, most used first; an italic **“…” as new text** row | anything |
| Number | the number as typed | digits |
| Yes/no | yes, no (`Enter` alone means yes) | |
| Url | the url as typed | `https://…` |

Nothing is written until you press `Enter` on a value. Only names the graph has are ever written to: a name it does not have shows “no property named …” and nothing else, so a typo cannot make a field (a new property still comes from Logseq's own **Add property**; one made through the plugin API would belong to the plugin, not to you). A new page is made only through the italic **Make …** row, which is never the first row; **Undo** removes the page again. The token must be at the end of the block, so a `::` inside a sentence does nothing.

| Setting | What it does |
| --- | --- |
| Properties typed in the line | The list after `p::` or `name::`. Applies at once. |
| Only in these graphs | The list opens only in the graphs named here. Nothing happens while this is empty. |
| First letters name the field | `pro::` opens project's values when one field starts so; several open the name list filtered. Off, the whole name is needed. Applies at once. |
| A field that takes several stays open | The list stays after `Enter` on a field that takes several pages; `Enter` with nothing typed finishes. Applies at once. |
| Escape takes the token out | `Esc`, `Tab` or a click elsewhere takes `p::` or `name::` out of the text and closes the list. Off, `Esc` keeps the words as typed. Applies at once. |
| Two semicolons keep the value in the words | `name;;value` works as `name::value` and also leaves the value in your words: a page or a day as its link, anything else as typed. Off, `;;` is plain text. Applies at once. |

## Export as document

Turns a page or some bullets into a tidy document for people who don't use Logseq: a PDF, or text to
paste into Pages, Word, Mail or Google Docs. It only reads your notes.

### How to use it

- **A whole page:** the page's "..." menu (top right) > **Export page as document…**.
- **One bullet and everything under it:** right-click its bullet > **Export as document…**.
- **Several bullets:** select them, then the command palette > **Export selected blocks as document**.

A window opens, in numbered steps:

1. **Style.**
   - **Document:** paragraphs, like a letter or a report. A short line with lines under it becomes a heading.
   - **Outline:** bullets, indented as in Logseq.
   - **Timeline:** the date on the left (and, if you pick one, a property such as a hospital under it),
     a line with dots, the event on the right with its details in small text. A bullet with a second,
     later date of its own (an End date) shows as a range, "Aug 4 – 8", in a shaded box.
   - **Timeline, one column:** month headings, then each event under its date.
   - **Calendar table:** one row per day, the day on the left and that day's bullets on the right.
   For the last three, **Dates** sets where the date comes from (Automatic: a Date property, then
   Logseq's scheduled or deadline date, then the journal day; an End date only closes a range),
   what shows **under the date**, and **newest first**.
2. **Title:** a line above the title, a subtitle (both kept for that page), today's date, Prepared by.
3. **PDF pages:** a footer and page numbers.
4. **Properties to show:** tick the ones to include. Remembered.

Beside the window, a small preview of the page changes as you choose.

**Preview and PDF…** shows the result on a white page. Click any text to change its words; the
buttons above it make the line with the cursor a **Title**, **Subtitle**, **Heading**, **Text** or
**Small** line, or **B** for bold. Then **Save as PDF…** or **Copy**. The changes go only into this
export, never into your notes. **Copy** in the window copies without a preview.

On a tag page, the nodes with that tag are included. A query is exported as its table on the page
(same columns and order), or, if you choose, as a timeline by one of its dates.

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
- Tasks show their words only, without their status.
- Properties appear as a small grey line, "name: value · name: value".
- Templates, empty bullets and Logseq's own built-in properties are left out.
- Code and maths blocks are kept as monospaced text. Images are not copied yet.

## Link selected text to a page (the old one)

**Link selected text to a page**

1. Select the words you want readers to see, such as `rename`.
2. Press `Cmd+Option+L` (`Ctrl+Alt+L` outside a Mac).
3. Type a few letters of the page's title. The field opens just under the selected words, as Logseq's own `[[` menu does, with nothing dimmed or covered. A list of your pages, tags and journal days opens under the field, drawn with the marks the page uses (a page's own icon or the plain rectangle, a `#` in the tag colour, a small grey box for a journal day, the kind in grey monospace words at the right), filtered as you type; under them, up to five blocks whose words match (a small dot before each; a tagged block such as a Task first, with its tags at the right; any other block once three letters are typed, found by Logseq's own search). `Up` and `Down` move, `Enter` links the highlighted row, a click picks one. The selection becomes `[rename]([[real name of link]])`.

The link is written by the page's or block's id, the form Logseq stores every link in, so it is a real reference: the words show in the target's Linked references and count wherever a `[[page]]` link would. An italic **Make page “…”** row is offered only when no title matches the letters exactly, and never above a match, so a typo cannot make a page; `Enter` on it makes the page and links to it. Cancel (`Esc`, or a press anywhere else) leaves the block unchanged. The command accepts a single-line label; it checks the saved block again before replacing text. With **The link box lists your pages** off, the field is bare and `Enter` links what you typed; with **The link box lists blocks too** off, only pages, tags and days are listed; with **The link box opens beside the words** off, the box opens in the middle of the window as before.
