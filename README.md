# Logseq DB Refinements

A personal plugin for Logseq DB graphs. Most of it changes how pages, links, tags and properties look, and changes nothing in your notes. What writes, writes only when you use it, and each change has a faded Undo arrow: the two-way rows (their picking bar, the + that adds a node), the tag map's edits, **Link selected text** and a taken **Suggested link** (typed into the bullet as if by hand, so Cmd+Z takes them back), and **New bullet at the outermost level**. **Proposals** fill in what they show when you leave a bullet you wrote (with Enter, the guesses too), in every graph but those you name. Version 0.4.381.

**What runs (0.4.381):** the features (two-way links, the tag and property map, proposals, suggested links, link selected text, the pickers, PDF quotations, the writing helpers), the pieces around a page (its tags beside the title, the words by the title left out, the right sidebar, the sidebars and toolbar, the search window) and the look of Logseq's page. Six older parts rest: their code is kept in `parts/`, but `main.js` does not load them (**Resting parts**, below). `docs/STATE.md` lists every part by layer.

Besides the look of pages, it holds:

- **Search**: Logseq's search window easier to read and roomier (loaded since 0.4.356); its details, grouping, preview, typed filters and sidebar search button rest.
- **Links, tags and properties** (on since 0.4.337; five switches under **Reading a page**): a link is the text colour with a faint underline, not blue, in a bullet's words, a property's value, Logseq's tables and the Linked references alike (0.4.338); a journal day is quiet grey words with no underline (0.4.338); a property's value is a lighter grey than the words and its name lighter still, in a bullet's pills and in a page's own list (0.4.338, 0.4.340); a tag at the right of a bullet reads as its name in mono, grey, without the #; a bullet's properties have no capsules, “Provider: Hannah Reyes · Date: Oct 21st”, the name grey and the value in the text colour.
- **Right sidebar** (on since 0.4.336; its two switches under **Around the page**): clicking the title of a page or block in the right sidebar opens it in the main view (the small arrow before it still folds it; Shift-click as in Logseq), and a line between the sidebar's items.
- **Where a tag sits** (on; switch off with **A page’s tags and the tags above them, beside its title** under **Reading a page**): the right end of a page's title row reads its tag and the tags that tag sits under, nearest first (“Doctor / Person / Entity” on Dr. Mei Chen; on a tag's own page only the tags above it, “Occurrence” on Consultation, since its name is the title), each name opening its page, Shift-click in the right sidebar. It stays where Logseq shows a page's tags only under the pointer, so nothing on the page moves.
- **Property kinds** (on; switch off with **Each property’s kind as an icon before its name** under **Reading a page**): in a page's list of properties, the grey dot before each property's name is the icon of its kind, as in the tag map: an arrow for a link to a node (one or several), a calendar for a date, Aa for text, 123 for a number, a box with a chevron for a choice. An icon you gave a property stays.
- **PDF quotations** (on; switch off with **PDF highlights as quotations** under **Reading a page**): a highlight from a PDF shows its words between quotation marks with the page after them, small and grey: (p. 1) under the PDF, (the PDF's title, p. 1) wherever a note cites it. Its bullet becomes a quotation mark; a highlight of an area keeps its picture. A press on the citation, or on the highlight's own words, opens the PDF there.
- **Two-way links** (on; switch off with **Links read the same from both ends** under **Reading a page**): on a page that one of your properties points to, each such property is a row in the page's own property list, read backwards (“doctor of →”), with the nodes that hold it, their day and their tag; a long row folds to a count and opens into the list. Since 0.4.318 the rows draw with the plugin's kit: a tag reads as a class (its name in mono right after the node's name, no #), the tick boxes are small rounded squares, the picking bar is one line of quiet words above the rows, in room kept for it (the count with its tick box, which clears; Select all; the page's own name with a menu to change it or take it out; Tag; Copy; Property with a menu to set or unset one; the trash; Sidebar at the right), the kinds above a list are plain words, the chevron, the arrow and the sidebar icon come from Logseq's own icon font, and the menus, the question boxes and the hover card are the kit's pop-ups placed by the browser. Since 0.4.376 a list of more than three can be grouped (the word “group” after its count, or right-click the name and choose “Group by…”) by tag, month or any property its nodes hold, each group folding, and the + at a group's name adds a node with that group's tag or value already set; a small arrow before a node opens its first bullets under it, with a line to add a new one inside it.
- **Proposals** (on; switch off with **Proposals while you write** under **Writing a record**; in every graph but those named in **Not in these graphs**): while you write a bullet, what the plugin is sure of shows faintly in the bullet’s own properties, where the value goes, and is filled in when you leave the bullet (Enter, a click elsewhere, the arrows): a page linked in your words for the property that takes its tag (a linked doctor for `doctor`; two doctors named, and nothing is proposed), the page you are writing on (a consultation on Dr. Mei Chen's page gets her as its doctor), and the journal day for the `date` of a tag whose nodes the graph shows are dated the day they are written (symptom logs, not appointments written ahead). Notes under an appointment propose for the appointment. A faded arrow at the end of the bullet’s line takes them off again (pointed at, it says what it takes off); it stays until you edit that bullet again or leave the page, and takes off only what is still as it was filled in, so a value you changed by hand afterwards stays. Moving about the bullet’s own properties with Logseq’s keys (Down at the end of the words goes into its capsules, Left and Right move between them, Enter opens one, Up goes back) is not leaving the bullet: the proposals stay shown and wait; leaving from there for anywhere else fills in what is sure, as leaving the words does. Escape clears them until you type in the bullet again. **Option-Enter** (in every graph but those named in **Not in these graphs**) opens the first property that is empty or holds a guess, whether shown as a capsule under the bullet or as a row of its own (Notes); on a guess, the guess is typed into Logseq’s list, selected, so Enter keeps it and typing puts something else: Logseq’s own list for a link or a choice, its own box for text or a number, its date picker for a date with the keyboard in the picker’s text box (“next fri” and Enter set the day; on a consultation with Provider proposed and Topic empty: “Set Topic”); a ring shows which property you are on; type to narrow the list and Enter picks, as Logseq does, and moves on to the next such property (Enter in a text or number value keeps what you typed and moves on; Shift-Enter is a new line; with Logseq’s `[[` or `/` list open, Enter is Logseq’s); Enter on the last one fills in the proposals and makes the next bullet, as Enter in the words does; a property that holds several (Spoke with) keeps its list open after Enter so you can add more, and Option-Enter, from anywhere in the properties, finishes the bullet the same way; Tab and Shift-Tab step through every property of the bullet, filled or empty: an empty one opens ready to type, on a filled one the ring only rests (nothing changes by passing it) and Enter opens it, while Enter after setting a value still goes on to the next empty one; Down at the very end of the words goes to the bullet’s first property, filled or empty, even one hidden while empty (it shows while the ring is on it); Tab works the same after it, and Left and Right step one property at a time the same way (stopping at either end), hidden ones included, and the ring shows which capsule has the keyboard there too, drawn inside the capsule; Escape, or Tab past the last, brings you back to the end of the words with the proposals still shown; a click elsewhere leaves the bullet. A tag written right after a link, with no space (`[[Dr. New]]#Doctor`), is that page’s tag: Logseq would make the bullet a doctor, so the page is proposed for the property that takes the tag (it reads “Dr. New #Doctor”), and filling it in gives the page the tag and takes it off the bullet and its words, under the same Undo (with a space, `#Doctor` is the bullet’s, as in Logseq; picking the tag from Logseq’s own list right after a link already gives it to the page, and the proposals see the page as a doctor at once). Otherwise your words are never changed. Nothing else is drawn: no line of its own, no keys. The values are in italic grey, and a guess has a dotted line under it as well. Enter fills in everything shown, guesses too, under one Undo; leaving the bullet any other way (a click elsewhere, the arrows) fills in only what is not a guess. To check a guess before it is written, Option-Enter stops on it (below). A click on a proposed value under a bullet accepts it: it turns solid and is filled in, guess or not, when you leave the bullet, so going back into an old bullet you click the ones you want and click away, with no Enter and no new bullet; a second click takes it back. **Cmd-Option-Enter** accepts everything shown, as Enter does, and leaves the bullet without making a new one. **Hide empty properties until something is proposed** (on, under **Proposals**; in every graph but those named in **Not in these graphs**): under a bullet and on a page, a property with no value stays hidden until the plugin proposes something for it (a doctor linked in a consultation brings Provider up, with the doctor in grey), except under the bullet you are writing and in a page's own properties, where empty ones stay faint so nothing comes and goes; Option-Enter still steps through the hidden ones, showing each as it opens it. On a page’s own properties (the page open in the main view, not a journal day) the same proposals show in its empty properties, from its title, the bullets on it and the pages and bullets it looks like (Works at on a doctor’s page with “Dietitian at Northgate.”); nothing is filled in by itself there: a click on the grey value fills it in, the faded arrow after the title takes it back, and a click beside it opens Logseq’s own list. The guesses: a page named in plain words, by its whole name or alias (“at Northgate”) or a word of its title no other page of that tag shares (“Dr. Patel”, “the tingling”; a tie names no one; a word only names a page when the earlier lines holding it are mostly about that page); the values the earlier nodes it most looks like had, by their words, links and tags (“Flagging again by teatime.” looks like the lines that had Fatigue; the nearest five that hold the property vote, a near-identical line counts most, and a clear lead is needed, else nothing); the parent bullet’s values for a tagged bullet under a tagged one; the journal day for the `date` of a tag with only a few dated nodes so far (one to four), all dated the day they were written (a treatment), or of a tag dated the day written at least 4 times in 5 but not 19 in 20; and a linked page with no tag yet, offered for the first empty place it could fill when there are one or two (it reads “Hannah Reyes #Doctor”, and taking it also gives the page that tag). A date written in the words (“on Friday”, “next Tuesday”, “tomorrow”, “on the 4th”, “4 Aug”, “in two weeks”), counted from the day the bullet is written on, is a guess for a `date` nothing else fills, for kinds usually dated ahead (an Expectation, not a Consultation) (one date in the words, or nothing; a journal page the day has not got yet is made when the guess is taken). A number beside a number property’s name (“cycle 5”, “3 cycles”) is a guess for that property. Two doctors linked keep the doctor quiet, guesses too. A property that takes tags of two or more separate families (a Topic that takes symptoms, decisions and people) is treated with care: a link in your words is only a guess for it, a link in a note below is not taken, a name in plain words is never taken for it, and a narrower property that takes the same link gets it first. A bullet with no tag, and no record above it, gets the tag of the lines it most looks like, pencilled in a dotted Tags pill under the bullet where Logseq shows a bullet’s tags, with that tag’s properties beside it, filled as if the tag were there (all guesses): Enter gives the bullet the tag and fills them in, under one Undo; leaving any other way takes nothing. The tag is proposed only when the nearest line is very much like this one and the lines agree, since a wrong tag costs more than a wrong value.
- **Suggested links** (on; switch off with **Suggest links while typing** under **Writing a record**): while you write a bullet and pause, when the last words typed (five letters or more, or three for a name your graph usually links or that would fill one of the bullet's empty properties) start a page's name, sit inside it or finish it, the rest of the name shows in grey right after the cursor, and the whole name after them, faint, when the words are inside it ("general hospital" → Riverside General Hospital); Right arrow, or a tap of the Hyper key (Caps Lock as ⌘⌃⌥⇧), turns the words into `[[the page]]`, shown underlined without its brackets while you go on writing the bullet (typing [ shows them again) and Cmd+Z takes it back. Keep writing and it changes or goes; a space, Tab, Left, Up, Down, Enter, a click or Escape leave the words as typed. A plain key can take it too, through the setting **Keys for Suggested links** (empty as it comes).
- **Link selected text** (on; switch off with **Link selected text with ⌘⌥L** under **Writing a record**): select words in a bullet you are writing and press `Cmd+Option+L`; a box opens under the words, you type a page's name and the pages that fit are listed, and Enter or a click makes the words a link to the page. With nothing selected, type the words first, Enter, then pick the page. Cmd+Z takes it back.
- **Pickers** (on; switch off with **What fits this bullet first** under **Writing a record**): when Logseq's own list for a property opens, the nodes that fit the bullet come first (a page its words link, then what similar bullets had), with a faint line before Logseq's own list. Up and Down follow the order you see.
- **Tag tree** (on; switch off with **Use the tag tree** under **Tools** in the settings): all your tags as one tree, moved about like Logseq's bullets, where you make new tags in the right place and move tags under other tags. In the full view and in the sidebar it is also the map of your properties (**Tags** and **Properties** at the top turn it round: by tag, or every property once with the tags that have it, opening into the same details): each open tag lists its properties (inherited ones faded), each with its kind as a small icon left of its name (an arrow for a link to nodes, one or several, a calendar, Aa, 123, a box with a chevron for a choice) and what it accepts or offers after it (tags in mono), a link property opens into what it accepts and how it reads on the other page (changed there, or turned off), and an i beside a property explains it. In the Properties view an opened property is an outline of its lines, each the place to change that thing: what it holds (with how many nodes hold it, and **Change …** for the conversions below), the nodes that hold it (**show nodes**: each by its first sentence with its value, a click opens it, eight then **show all**, **hide nodes** folds them away), its choices, the tags it is on (each with an × to take it off, **+ Tag** to put it on another), what a link accepts, how it reads on the other page, and its group; **+ New property** at the bottom asks the name, what it holds (text, number, date, checkbox, web address, or a link to nodes of a tag) and the tag it goes on, then makes it with Logseq's own Add property box on that tag's page, with Undo on the new row; double-click a property's name to rename it. The find box at the top finds tags and properties by name (a property shows under the tags that have it). From the map you can rename a property, change what a link accepts, add, rename and remove a property's choices (a choice still in use is not removed; a new choice typed in the panel is made by the plugin through Logseq's own Add choice box on the property's page in the right sidebar, since Logseq lets only itself make one, with Undo on the property's row; the order of the choices is changed in Logseq's own settings, which **Reorder in its settings** opens), make a choice its own child tag (**Make a choice its own child tag …** in the property's menu: the nodes with that choice move to the new tag with all their values, the choice is cleared on them and stays in the list for you to remove, and Undo puts everything back), turn a text or choice property into links to pages (**Turn into links to pages …** in the property's menu, the owner's way of doing it by hand made one step: the old property is renamed “Specialty (old)” and keeps its values; a new Specialty is made with Logseq's own Add property box, which opens on the tag's page in the right sidebar and is filled in by the plugin, since Logseq lets only itself make a property of yours; one page per value is made, or found, and tagged “Specialty kind” (typed new, or one of the tags there are with **Pick …**; it cannot be the property's own name), and the new property can have a name of its own (then the old one keeps its name and its words); the new property accepts that tag, and every node gets its link, so the Oncology page shows “specialty of → Dr. Mei Chen”; delete the old one yourself when it looks right; Undo puts everything back, the pages going to Logseq's Recycle; a property some nodes hold several of is not handled yet), and write a tag's description (click it, or **Add a description …** in the tag's menu). What kind of value a property holds, and one versus several, open in Logseq's own settings for it in the right sidebar: Logseq lets a plugin change those only for the plugin's own properties. Each refresh of the map is timed; Logseq's developer console shows the last 50 with `console.table(refinementTagTimes)`.

## What is in the folder

The first group is the plugin itself and is all the release zip holds. The rest is for working on the plugin and stays out of the zip.

| File or folder | What it is |
| --- | --- |
| `package.json` | Tells Logseq the plugin's name, version and starting file. |
| `loader.js` | The starting file. It loads `main.js` fresh each time, so a reload picks up changes. |
| `main.js` | The core: the screen watcher, the database round, the hooks, the self-check after a Logseq update, the commands, and the loader of the parts. It knows nothing about pages or blocks. |
| `parts/` | The rest of the plugin, one file per area, loaded by `main.js` in a fixed order (see below). |
| `README.md` | This guide. |
| `CHANGELOG.md` | What changed in each version, and what was seen on screen before it was kept. |
| `GUIDE.md` | How to work on the plugin: the rules the code keeps, Logseq's quirks, the reload loop, the command line. Not in the zip. |
| `CLAUDE.md` | The handoff for the next working session: where things are, the owner's working rules, what is open. Not in the zip. |
| `docs/` | Work notes: `STATE.md` (every part by layer, today), `LAYERS.md` (the layers and the grammar of the look), `PROCESS.md` (how a change is checked), `MODELLING.md` (how to shape tags and properties), `ALIKE.md` (the proposals' engine), `LOGBOOK.md` (every piece of work), `DECISIONS-AUTONOMOUS.md`, the elements and views pages, and `history/` (records: old handoffs, plans, prompts, audits, the owner's rulings). Not in the zip. |
| `tools/` | `check.sh` runs every check before a commit (the tests are listed in `docs/STATE.md`), `stress.sh` the stress tests, `bump.sh` sets the version, `release.sh` builds a zip locally, `hooks/pre-commit` stops a commit whose documents are behind, `pages/` rebuilds the elements and views pages. Not in the zip. |
| `test/` | `illness-test-graph.py` writes the seed of the Illness Test Graph, whole (`illness-test-graph.edn`) and in three parts imported in order (`-1.edn` to `-3.edn`); `stress-graph.py` the years of journals for the Stress Check graph; `frames/` and `pictures/` the approved frame censuses and pictures; `plugin-test-graph.edn` the seed of the old Plugin Test Graph, no longer on the Mac. Not in the zip. |

The files in `parts/`:

| File | What it holds |
| --- | --- |
| `shared.js` | The helpers every file uses (the one look of pop-ups and dialogs, the one Undo, settings, clean-up). Loaded first. |
| `model.js` | What a page, block, tag, property, journal day and link are in a DB graph: the one place that reads them. Loaded second. |
| `alike.js` | The “looks like” engine (0.4.212): which earlier nodes a bullet resembles, by its words, links and tags, and what they agree on, for a value or for the tag of an untagged bullet (0.4.213). Knows nothing of any graph; the proposals’ guesses read it. |
| `shadow-rules.js` | Proposals, the rules: what the graph holds, what is sure, the guesses, learning, the reasons. Draws nothing. |
| `shadow.js` | Proposals while you write a bullet: the grey values, the keys, filling in, the Undo arrow. |
| `shadow-steps.js` | Proposals: Option-Enter, stepping through a bullet's own properties. |
| `shadow-page.js` | Proposals on a page's own properties. |
| `diagnostics.js` | The troubleshooting tools (Check what the plugin finds, Copy warnings and the rest). |
| `pages.js` | Resting: what was drawn around a page's title (the page's kind, Alias of, the shape box). |
| `links.js` | Resting: the marks on links and rows, dates, references and file cues (its PDF citations are `pdf-quote.js` since 0.4.364). |
| `chrome.js` | Quieter sidebar and toolbar items, the right sidebar without its Page graph and (Dev) tabs, plain page icons in the left sidebar, the empty `[[ ]]` menu (loaded since 0.4.355). |
| `page-look.js` | How Logseq's own page looks: links with a faint underline, tags as class names, properties without capsules. |
| `sidebar.js` | Right sidebar titles that open their page, and the line between items. |
| `tag-path.js` | A page's tags and the tags above them, in its title's corner (Doctor / Person / Entity). |
| `property-kinds.js` | Each property's kind as an icon before its name, and a cut name whole on hover. |
| `pdf-quote.js` | A PDF highlight as a quotation with its page after it; a press on the citation opens the PDF there. |
| `title-row.js` | Logseq's “Add icon” and “Set property” by a page's title left out, their room kept (0.4.354). |
| `search-look.js` | Logseq's search window easier to read and roomier (loaded since 0.4.356). |
| `search.js` | Resting: search details, grouping, the preview, the typed codes, the sidebar search button. |
| `inline-props.js` | Resting: Properties in the line, the list after `p::`. |
| `rich-copy.js` | Resting: Copy as rich text, Export page as document. |
| `todos.js` | Resting: Todos and Expectations. |
| `link-text.js` | Link selected text: the list under the selected words after `Cmd+Option+L`. |
| `link-suggest.js` | Suggested links: the rest of a page's name in grey after the cursor while typing; a Hyper tap makes the link. |
| `block-commands.js` | New bullet at the outermost level, and dates typed year first in `[[ ]]` (loaded since 0.4.357; the rest of the old editor part went). |
| `picker.js` | The pickers: what fits the bullet first in Logseq's list for a property. |
| `tags-graph.js` | The tag map, piece 1 of 3 (0.4.295): its state kept on this computer, reading the tags, and every change it makes to the graph (parents, tag properties, choices, merging, a choice made a child tag, turned into links). |
| `tags-props.js` | The tag map, piece 2 of 3: the property map, a tag's properties as rows with their menus and boxes, and the Properties view with its groups. |
| `tags.js` | The tag map, piece 3 of 3: the tree itself, moving and picking tags, keys, and the page and sidebar it shows in (on since 0.4.152; off only if switched off in the settings, or when one of its other two pieces is missing). |
| `settings-panel.js` | The settings window, its four groups and their pictures. |

## Install

**From GitHub (any computer):** in Logseq, run **Install plugin from GitHub release** from the command palette, paste `https://github.com/mn-321/logseq-plugin`, tick **effect**, and press Install. The effect tick matters: it lets the plugin draw on Logseq's own page (the rows, the map, the settings item in the three-dots menu); without it Logseq keeps the plugin in a sealed frame and nothing shows but the tag tree's toolbar button. Installed without the tick, the plugin shows one notice saying so: uninstall it (the gear on its card in the Plugins panel) and install it again with the box ticked. (The plugin's `package.json` asks for effect too, but Logseq's installer writes the box's value over it, so the box is what counts.) Logseq downloads the newest release's zip and runs it; **Check update** on the plugin's card in the Plugins panel (`t p`) brings the next version. Every version pushed to GitHub with a tag (`v0.4.280` and so on) becomes such a release; `.github/workflows/publish.yml` builds its zip. Installed this way, Logseq names the copy after the repository (`logseq-plugin`) and keeps its settings in `~/.logseq/settings/logseq-plugin.json`.

**Unpacked (the owner's Mac):**

1. Unzip the download, or use the repository folder itself. In Logseq Desktop, turn on **Developer mode** in Settings.
2. Open Plugins (`t p`), choose **Load unpacked plugin**, and pick the `logseq-db-refinements` folder. Keep the `parts` folder next to `main.js`.
3. If an earlier copy is loaded, replace its files and press **Reload** on the plugin in the Plugins panel. The plugin needs no internet connection.

## Settings

Open the settings from **Refinements settings** in Logseq's three-dots menu (top right, under Plugins), or run **Refinements settings** from the command palette.

- Sections are listed on the left under four groups: **Reading a page** (Tags beside the title, By the title, Property kinds, PDF quotations, Two-way links, Links, tags and properties), **Writing a record** (Proposals, Link selected text, Suggested links, Pickers, Writing helpers), **Around the page** (Sidebars and toolbar, Right sidebar, Search) and **Tools** (Tag tree, Shortcuts, Troubleshooting), each with its icon. **Shortcuts** (0.4.317) gathers every key the plugin listens for, read from its one register, so each can be changed there. **Changed by you** lists everything you have changed. The resting parts' sections come back with their parts.
- At the top of each group, a picture shows where on screen each of its sections works, numbered like the list beside it; a click on a part of the picture or on a name in the list opens that section. A click on a group's name shows all its sections at once.
- The tag tree, in **Tools**, has a first switch (**Use the tag tree**, on); while it is off the rest of its settings are shown faint and do nothing.
- A search box (press `/` or `Cmd+F` in the window) looks through every setting's name and explanation.
- A changed setting has a small dot and a faint **Reset** word. Each change is saved as you make it. On or off is a tick box; a choice of two or three is a row of words; a list of names is words with a × on hover and a field to add to it (a tag setting offers the graph's tags as you type); text is a field drawn as an underline (0.4.317, the kit's pieces).
- Most settings apply at once. Those that need a reload say “after reload”, and a **Reload plugin** button is at the bottom.
- Logseq's own settings page for the plugin (Plugins, `t p`) still works and is one click away at the bottom of the window.

### Every setting

Grouped as in the settings window's sections (the window gathers them under the four groups above). Only the settings of the parts that run are listed; a resting part's settings come back with it, and a value already in the settings file is kept meanwhile. One more key, `linkSuggestMemory`, is kept by the plugin itself (what was taken or passed over) and is not shown. The key is the name in the settings file (`~/.logseq/settings/logseq-db-refinements.json`); "Starts as" is the value a fresh install has.

| Setting | Key | Starts as | Where |
| --- | --- | --- | --- |
| Foundation only | `foundationOnly` | off | Troubleshooting |
| A page’s tags and the tags above them, beside its title | `tagPathInTitle` | on | Tags beside the title |
| Leave out “Add icon” and “Set property” by a title (their room kept, so nothing moves) | `hideTitleWords` | on | By the title |
| Each property’s kind as an icon before its name | `propertyKindIcons` | on | Property kinds |
| PDF highlights as quotations | `pdfCitations` | on | PDF quotations |
| A cut property name whole on hover (Logseq cuts a long name in its narrow column; the pointer on it shows the whole name) | `propertyNameTips` | on | Property kinds |
| Sidebar titles open their page | `sidebarTitleOpens` | on | Right sidebar |
| A line between sidebar items | `sidebarThickDividers` | on | Right sidebar |
| The right sidebar without its Page graph and (Dev) tabs | `tidySidebar` | on | Sidebars and toolbar |
| Quiet these sidebar and toolbar items | `quietItems` | Flashcards, Graph view | Sidebars and toolbar |
| Left sidebar icons only where they mean something | `quietSidebarIcons` | on | Sidebars and toolbar |
| Empty [[ ]] menu until you type | `quietLinkMenu` | on | Sidebars and toolbar |
| Links in the text colour with a faint underline | `quietLinks` | on | Links, tags and properties |
| Journal days as quiet grey words | `quietDates` | on | Links, tags and properties |
| Property names and values lighter than the words | `quietNames` | on | Links, tags and properties |
| Tags as class names | `tagsAsClasses` | on | Links, tags and properties |
| Properties without capsules | `noCapsules` | on | Links, tags and properties |
| “+ Add property” only with the pointer on the properties | `quietAddProperty` | on | Links, tags and properties |
| Empty properties faint | `quietEmptyProps` | on | Links, tags and properties |
| No pencil after a date | `hideDatePencil` | on | Links, tags and properties |
| The nesting line firmer where you are | `indentGuides` | on | Links, tags and properties |
| Tidy the search window | `tidySearch` | on | Search |
| Roomier search window | `roomySearch` | on | Search |
| Keys for New bullet at the outermost level | `outermostBlockShortcut` | empty | Writing helpers |
| Year-first dates in [[ ]] link to journals | `dateLinkFormats` | on | Writing helpers |
| Links read the same from both ends | `twoWayRows` | on | Two-way links |
| Fields read backwards | `twoWayNames` | symptoms = logged in; ask = asked; works at = works here; insurer = insurer of; related = related to | Two-way links |
| Fields shown from one end only | `twoWayOneEnd` | empty | Two-way links |
| Leave out Logseq’s tag lists the rows repeat | `twoWayHideTagLists` | on | Two-way links |
| Link selected text with ⌘⌥L | `linkText` | on | Link selected text |
| Keys for Link selected text | `linkTextShortcut` | `mod+alt+l` | Link selected text |
| Suggest links while typing | `linkSuggest` | on | Suggested links |
| Learn from the graph and from what you take | `linkSuggestLearn` | on | Suggested links |
| Letters typed before a suggestion shows | `linkSuggestMinLetters` | 5 | Suggested links |
| Pause before a suggestion shows (milliseconds) | `linkSuggestPause` | 350 | Suggested links |
| A link just taken shows underlined, without [[ ]] | `linkSuggestUnderline` | on | Suggested links |
| Right arrow takes the suggested link | `linkSuggestRightArrow` | on | Suggested links |
| A tap of the Hyper key takes the suggested link | `linkSuggestHyperTap` | on | Suggested links |
| Keys for Suggested links | `linkSuggestKeys` | empty | Suggested links |
| Proposals while you write | `shadowProposals` | on | Proposals |
| Hide empty properties until something is proposed | `shadowHideEmpty` | on | Proposals |
| Not in these graphs (empty: proposals work in every graph) | `shadowSkipGraphs` | empty | Proposals |
| Keys for stepping through a bullet’s properties | `shadowStepKeys` | `alt+enter` | Proposals |
| Keys for accepting everything shown without a new bullet | `shadowAcceptKeys` | `mod+alt+enter` | Proposals |
| What fits this bullet first | `pickerFitsFirst` | on | Pickers |
| Use the tag tree | `tagTreeEnabled` | on | Tag tree |
| Order of the tags | `tagTreeRoots` | empty | Tag tree |
| Groups of properties | `propertyGroups` | empty | Tag tree |
| The button and shortcut open the tag tree as | `tagTreeOpensAs` | page | Tag tree |
| Tag tree button in the toolbar | `tagTreeToolbarButton` | on | Tag tree |
| Open the tag tree | `tagTreeShortcut` | mod+alt+g | Tag tree |
| Go to the tag tree (a chord, listed in Logseq's Keymap) | `tagTreeGoShortcut` | g m | Tag tree |

## Shortcuts

All can be changed or cleared in the settings window under **Shortcuts**. On a Mac, `mod` is Cmd; elsewhere it is Ctrl. The tag tree's and New bullet at the outermost level are also in the command palette under the same name; the keys used while writing (Link selected text, the suggested link, Option-Enter, Cmd-Option-Enter) are not.

| Shortcut | Action |
| --- | --- |
| `Cmd+Option+L` | Link selected text to a page |
| Right arrow or Hyper tapped alone (while grey words show) | Take the suggested link |
| `Option+Enter` | Proposals: step into the first empty or guessed property of the bullet; in the properties, finish the bullet |
| `Cmd+Option+Enter` | Proposals: accept everything shown, without a new bullet |
| `Cmd+Option+G` | Tag tree, while it is switched on |
| `g` then `m` | Go to the tag tree (listed in Logseq's Keymap) |
| none | New bullet at the outermost level (give it keys under **Writing helpers**) |

## Appearance

Only what runs now. Every look is drawn in greys mixed from Logseq's own text colour, so light, dark and other themes work alike, and none of them moves anything on the page. Each has its switch in the settings window.

| Feature | What you see | Switch |
| --- | --- | --- |
| Page links | The text colour with a faint underline, firmer under the pointer, never blue: in the words, in a property's value, in Logseq's tables and in the Linked references | **Links in the text colour with a faint underline** |
| Journal days | A link to a day reads as quiet grey words with no underline | **Journal days as quiet grey words** |
| Property names and values | Values a lighter grey than the words, names lighter still, under a bullet and in a page's own list | **Property names and values lighter than the words** |
| Tags | A tag reads as its name alone, grey, in a monospace face, without the `#`; the × that removes it takes the `#`'s place | **Tags as class names** |
| Properties under a bullet | `Provider: Hannah Reyes · Date: Oct 21st`: no capsule edge or fill, a faint dot between properties; Logseq's ring stays while the keyboard is on one | **Properties without capsules** |
| + Add property | Under a page's properties, shown only while you point at them or type in them; its room kept | **“+ Add property” only with the pointer on the properties** |
| Empty properties | A property with no value yet stays, faint (in a graph where the proposals write, they decide instead) | **Empty properties faint** |
| Dates | No pencil after a date value; a click on the date still opens Logseq's picker | **No pencil after a date** |
| Nesting lines | The line beside the bullets under the one you point at or type in is a little firmer than Logseq's faint lines | **The nesting line firmer where you are** |
| Property kinds | The icon of a property's kind before its name, as in the tag map; a cut name whole on hover | **Property kinds** section |
| PDF quotations | A PDF highlight as a quotation, the page after it; a press on the citation opens the PDF | **PDF quotations** section |
| By the title | A page's tags and the tags above them at the title's right end; Logseq's “Add icon” and “Set property” left out, their room kept | **Tags beside the title**, **By the title** |
| Sidebars and toolbar | Flashcards and Graph view quieter; the right sidebar without Page graph and the (Dev) tabs; no generic page icon in Favorites and Recent; sidebar titles open their page, a line between sidebar items | **Sidebars and toolbar**, **Right sidebar** |
| Search | Quiet headings, the searched words bold instead of yellow, `[[ ]]` and `**` faded, a roomier window | **Search** |

The old looks of the resting parts (block-link dots, file icons, date boxes, a date's tense, folded-block cues, empty-block dots, embed lines, tag chips, the Linked references rework, the parent-path tidying, picker marks, page labels, tag-page tabs, the Journals list) went with the old `styles.js` at 0.4.359; why each went is in `docs/history/STYLES-AUDIT-2026-10-23.md`.

## Tag tree

**On since 0.4.152** (it was paused from 0.4.128). With **Use the tag tree** switched off in the settings window, the tag tree adds no toolbar button, page, sidebar panel, command or shortcut until it is switched on again and the plugin reloaded.

All your tags as one tree, so you can see what is inside each tag, make new tags in the right place and move tags around. Open it with the tree button at the top right of Logseq (Logseq may put it in the puzzle-piece menu first; the pin there keeps it in the toolbar), with `Cmd+Option+G`, or by running **Tag tree** from the command palette. It shows as a full view in the main area, or as a smaller panel in the right sidebar (**Tag tree in the right sidebar**).

- A tag's place in the tree is its **Extends** property: a tag inside #Entity extends Entity and inherits its properties. A tag can extend more than one tag; it then shows under each, marked "also under …".
- The tree works like Logseq's bullets. The **top level** is every tag with no parent (Logseq's own Root tag is not shown). A tag reads as its name alone, without the `#`, in the kit's greys; the map has no colour of its own.
- Below them, **Under Logseq's tags** lists the tags that extend Logseq's own Task or Card.
- The tree is just the outline: each row is the tag's name and its description, with its properties under it in the full view. After a tag's name, faint, is the number of nodes tagged with it (0.4.375). Only something unusual is written beside a name: "also under …" for a tag under two tags, and "same name as another tag". Tags with tags inside them are a little heavier; a top-level tag is the largest.
- **Make a tag inside another**: the **+** on its row, or `n`. Type a name and press Enter; several names separated by commas make several tags. A name that is already a tag is put inside as well, instead of making a second one; one of Logseq's own tags (Task, Page…) is left where it is. **Undo** takes a new tag away again and puts a moved one back.
- **Move a tag**: drag it as you would a bullet. Over the upper half of another tag a line shows above it, and the tag goes just before it; over the lower half, just after it; move the pointer to the right of the name and the line is indented, and the tag goes inside it as its first tag (below an open tag it always goes inside). Hold `Option` to keep it where it was too, so it extends both. While dragging, **Drop here to put it at the top level** shows under the top level. Or press `m` (Move to …) and type the new parent's name, or `a` (Also put under …). **Select** (beside the search box) shows a tick box before every row, in both views, and a bar of actions on what is ticked: tags can go to the top level, move into another tag, be given a property, or open in the sidebar; properties can be put on a tag, put in a group, or open in the sidebar. Esc or Done puts the ticks away. A property's menu starts with **Open** and **Open in the right sidebar** (over a property in the Properties view: `Enter`, `Shift+Enter`; `x` ticks it). `i` says what the tag is for (its description); in the Properties view it does the same for the property under the pointer. `Tab` puts a tag last inside the tag just above it, `Shift+Tab` moves it out to just after its parent, as in an outline. A tag cannot go inside one of the tags inside it. Every move has **Undo**.
- **Rename**: `r`, double-click the row, or the row's menu. Tags are renamed everywhere, as Logseq's own rename does.
- **Properties**: under each tag, its own properties are listed, and the ones it gets from the tags above it follow in grey, grouped as "from Entity …" (in Logseq a tag has every property of the tags it is inside). Click a property to **Move up** to a tag above (it then applies to that tag and everything inside it), **Take it off**, or open it. `p` (or **Add a property …** in the row's menu) adds one of your properties; a name that is not a property yet opens Logseq's own **Add tag property** on the tag's page with the name typed in, where you choose its type. Taking a property off a tag keeps values already filled in.
- **Everything about a tag is on its own lines** (0.4.310, in the shape of the Properties view): under an open tag, after its properties and the links into it, a faint line offers **+ Property** (the same picker as `p`), **+ Tag inside** (a line to type the name in, right there, as `n`) and **+ Description** (gone once the tag has one; the description itself sits under the name and a click changes it). "also under #X" on a tag that is inside several tags can be clicked: **Go to #X**, **Take it out of #X**, **Keep it only under** the tag it is shown in, **Also put under …**. Each link on "Shows up here as" (doctor of → filled in on #Appointment) opens a menu: **Go to** the property on the tag that has it, **Change how it reads here …**, **Turn off** or **Turn on** on this tag's page. The Undo arrow of a change made on one of these lines sits on that line. A tag with nothing under it stays one line.
- **Order**: tags beside each other keep the order you give them, at every level, as bullets do: drag one above or below another, press `Cmd+Shift+Up` / `Cmd+Shift+Down`, or use **Move up** / **Move down** in its menu. Tags you have not placed follow by name. This is the **Order of the tags** setting, so it is the same in every graph. To move several tags at once, pick them with `Cmd`-click on their names or rows (or `x` on the current row; `Shift`-click a row picks every row from the current one to it); the bar that appears has **To the top level** and **Move to …** to put them all inside one tag, and `Esc` unpicks.
- **A tag under two tags**: its menu has **Keep only under #X** (drops the other parents) and, for a tag that is also at the top level, **Keep only at the top**.
- **Merge two tags** (`j`, or **Merge into …** in the row's menu): pick the tag to keep. Works for two tags with the same name (marked "same name as another tag"; click the mark), a tag into its parent, or two tags beside each other. Everything tagged with the old tag gets the kept one; links, property values, aliases and "tags of its values" point to it; tags inside it move into the kept tag; its own properties and blocks, and the aliases, icon and property values on its page, move over; and its description is kept if the other has none (the summary says when it is dropped). A summary shows what will change and nothing happens until you press **Merge**. Logseq then deletes the old tag for good: this cannot be undone in one step, so try it in a test graph first.
- Click a tag's name to open its page (`Shift` click: right sidebar). Right-click a row, or its `…`, for all of these. `↑` `↓` move between rows, `←` `→` fold and unfold, `Enter` opens, `/` finds. Folded tags are remembered on this computer.

- **Groups of properties** (Properties view only, for your own order; nothing in the graph changes): **+ New group** at the bottom makes one; a property goes in with **Put in a group …** in its menu or by dragging it onto the group's name (onto **Not in a group** takes it out); a property sits in one group; a group's name folds it, and its menu (right-click, or ⋯) renames it, moves it up or down, or removes it (its properties stay, in no group); renaming a property from the map keeps it in its group. Kept in **Groups of properties** by name, which you can also edit by hand.

Settings (section **Tag tree**): **Order of the tags** (empty: by name), **Groups of properties** (empty: none), **The button and shortcut open the tag tree as** (page), **Tag tree button in the toolbar** (on), **Open the tag tree** shortcut (`mod+alt+g`).

## Search

Logseq's search window, easier to read (part `search-look.js`, 0.4.356). Its results, their order and its keys are Logseq's own; nothing is added to its list. Changes apply right away.

**Tidy the search window** (on): quieter group headings, one weight of text in the results, a quiet icon and path, the searched words in bold instead of yellow, a faint grey wash on the chosen row, and typing markup in results (`[[ ]]`, `**`, a table's `|`) in a faint grey so the words stand out (your blocks are unchanged).

**Roomier search window** (on): the search window larger (up to 1100 px wide), with bigger text, more room between results, up to three lines of each block, and the page and parent blocks above a result named in full. Key shortcuts beside results show only with the pointer on the row. The search kept in the right sidebar (Logseq's own `Cmd+Enter` inside search) stays as it is.

## Commands

**Link selected text** (0.4.252, the rebuilt one)

1. While writing a bullet, select the words to link, such as `Chen` or `the oncologist`. Or select nothing: the list first asks for the words to show; type them and press `Enter`, and the link goes in at the cursor.
2. Press `Cmd+Option+L` (`Ctrl+Alt+L` outside a Mac; the keys can be changed in the setting **Keys for Link selected text**, 0.4.314). A box opens under the words; type a page's name and the pages that fit are listed, the closest first, each with its tag at the right.
3. Type to look for another page; the bullet's words stay as they are while you type. `Up` and `Down` move, `Enter` or a click links the highlighted page, `Esc` closes the list and leaves the words alone.
4. The words become `[[Dr. Mei Chen]]` when they are the page's name, otherwise a link that keeps them, `[the oncologist]([[Dr. Mei Chen]])`. It is typed into the bullet as if by hand, so the proposals see it at once and `Cmd+Z` takes it back. **New page “…”** is offered only when no page has that name, and is never first when a page fits.

**New bullet at the outermost level** (part `block-commands.js`, 0.4.357)

Run it from the command palette while typing in a bullet (no keys by default; set some under **Writing helpers**). After the top bullet you are in, and everything under it, an empty bullet is added as a spacer and then a new empty bullet at the outermost level with the cursor in it.

The old commands Make a page from this block, Open selected text as page, Add tags to this page and Delete this block went at 0.4.357: Logseq does each itself (a bullet tagged #Page becomes a page; selected words typed over with `[[` become a link; a page's tags are its Tags property; `Esc` then `Backspace` deletes a bullet), `docs/DECISIONS-AUTONOMOUS.md` 18.

The old commands Fold all results in this query, Unfold all results and Choose properties shown in this list went at 0.4.358: a query in Logseq 2.0.2 is a table with its own sort, filter, columns and list view (`docs/DECISIONS-AUTONOMOUS.md` 19).

**Refinements: troubleshooting**

One palette entry opens a small box listing the troubleshooting tools; choosing one runs it. They change nothing: **Check what the plugin finds on this page** (how many of each Logseq part the plugin relies on are on screen, and the plugin's own marks), **Copy styling details of this block** (how Logseq built the block you are in), **Measuring** (on or off, ticked while on), **Copy performance report** (timings of the plugin's work), **Copy warnings** (every warning the plugin wrote to the console this session) and **Take the tour** (for checking a change: it visits the pages listed in the hidden setting `tourStops` one at a time, F8 for the next, and saves what it measured at each, when the title and the plugin's rows appeared, when each of the plugin's pieces showed and how often it was put on screen, what moved and what Logseq logged (with the hidden setting `tourAuto` true it goes from stop to stop by itself), as `tourReport` in the settings file). Each tool keeps a command of its own, so a shortcut you bound to one still works.

Logseq themes and releases can change the names the plugin relies on; after an update, run **Check what the plugin finds on this page**.

## Resting parts

Six older parts are kept in `parts/` but not loaded: they show nothing, and their settings are not in the settings
window (a value already in the settings file is kept). Their descriptions as they were are in
`docs/history/README-RESTING-PARTS-2026-10-24.md`; why each rests is in `docs/STATE.md`.

- **Todos and Expectations** (`todos.js`): every task in one list, changed in place. Logseq's own Task page lists every task with sort, filter and views.
- **Copy as rich text / Export page as document** (`rich-copy.js`): a page or bullets as a tidy document or PDF. Its output can be checked only through the clipboard.
- **Search extras** (`search.js`): details on each result, results page by page, a preview panel, typed filters, Search in the right sidebar (`Cmd+Option+F`). The search window's look is loaded (`search-look.js`).
- **Properties in the line** (`inline-props.js`): `p::` typed in a bullet. The owner said no to it on 2026-10-23.
- **Page extras** (`pages.js`): the page-kind line, Alias of, the tag summary box. The owner said no to the summary box on 2026-10-23.
- **The old links part** (`links.js`): cues on links, labels, the Linked references rework, the old link box. Its PDF citations came back as `pdf-quote.js`.

## Version history

See `CHANGELOG.md`.
