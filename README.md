# Logseq DB Refinements

A personal plugin for Logseq DB graphs. Most of it changes how things look, so pages, blocks, links, tags, properties and dates are easier to tell apart, and changes nothing in your notes. The shortcuts, the search preview, a date typed inside `[[ ]]` and **Properties in the line** write only when you use them. Three parts write on their own, each within a limit you set: **Proposals** fills what it is sure of when you leave a bullet you wrote, and a guess only when you click it, only in the graphs named in its settings, with Undo; **Todos** changes a task's status, priority, due date or first line only when you change it in its list; the **Tag tree** moves, renames, makes and merges tags, and changes properties, choices and descriptions, only when you do that in the tree. **Copy as rich text** only reads. Version 0.4.287.

**For now (0.4.175) only the foundation, the tag and property map and the two-way links run.** Everything else below is resting: its code is kept in `parts/` unchanged, but `main.js` does not load it, so it shows nothing and its settings are not listed. The parts come back one layer at a time; the comment above `PART_FILES` in `main.js` says where each one goes back.

Besides the look of pages, it holds:

- **Search**: a calmer search window with details, grouping, a preview and typed filters, and search that can stay open in the right sidebar.
- **Right sidebar**: titles that open their page in the main view, and a clear line between items.
- **Todos** (paused for now; switch on under **Paused** in the settings): a window with every task in the graph, grouped by when it needs you, by status or by page, where you change a task's status, priority and due date in place.
- **Proposals** (on; switch off with **Proposals while you write** under **Writing a record**; writes only in the graphs named in **Only in these graphs**): while you write a bullet, what the plugin is sure of shows faintly in the bullet’s own properties, where the value goes, and is filled in when you leave the bullet (Enter, a click elsewhere, the arrows): a page linked in your words for the property that takes its tag (a linked doctor for `doctor`; two doctors named, and nothing is proposed), the page you are writing on (a consultation on Dr. Mei Chen's page gets her as its doctor), and the journal day for the `date` of a tag whose nodes the graph shows are dated the day they are written (symptom logs, not appointments written ahead). Notes under an appointment propose for the appointment. A faded arrow at the end of the bullet’s line takes them off again (pointed at, it says what it takes off); it stays until you edit that bullet again or leave the page, and takes off only what is still as it was filled in, so a value you changed by hand afterwards stays. Moving about the bullet’s own properties with Logseq’s keys (Down at the end of the words goes into its capsules, Left and Right move between them, Enter opens one, Up goes back) is not leaving the bullet: the proposals stay shown and wait; leaving from there for anywhere else fills in what is sure, as leaving the words does. Escape clears them until you next edit the bullet. **Option-Enter** (only in the graphs named in **Only in these graphs**) opens the first property that is empty or holds a guess, whether shown as a capsule under the bullet or as a row of its own (Notes); on a guess, the guess is typed into Logseq’s list, selected, so Enter keeps it and typing puts something else: Logseq’s own list for a link or a choice, its own box for text or a number, its date picker for a date with the keyboard in the picker’s text box (“next fri” and Enter set the day; on a consultation with Provider proposed and Topic empty: “Set Topic”); a ring shows which property you are on; type to narrow the list and Enter picks, as Logseq does, and moves on to the next such property (Enter in a text or number value keeps what you typed and moves on; Shift-Enter is a new line; with Logseq’s `[[` or `/` list open, Enter is Logseq’s); Enter on the last one fills in the proposals and makes the next bullet, as Enter in the words does; a property that holds several (Spoke with) keeps its list open after Enter so you can add more, and Option-Enter, from anywhere in the properties, finishes the bullet the same way; Tab and Shift-Tab step through every property of the bullet, filled or empty: an empty one opens ready to type, on a filled one the ring only rests (nothing changes by passing it) and Enter opens it, while Enter after setting a value still goes on to the next empty one; Down at the very end of the words goes to the bullet’s first property, filled or empty, even one hidden while empty (it shows while the ring is on it); Tab works the same after it, and Left and Right step one property at a time the same way (stopping at either end), hidden ones included, and the ring shows which capsule has the keyboard there too, drawn inside the capsule; Escape, or Tab past the last, brings you back to the end of the words with the proposals still shown; a click elsewhere leaves the bullet. A tag written right after a link, with no space (`[[Dr. New]]#Doctor`), is that page’s tag: Logseq would make the bullet a doctor, so the page is proposed for the property that takes the tag (it reads “Dr. New #Doctor”), and filling it in gives the page the tag and takes it off the bullet and its words, under the same Undo (with a space, `#Doctor` is the bullet’s, as in Logseq; picking the tag from Logseq’s own list right after a link already gives it to the page, and the proposals see the page as a doctor at once). Otherwise your words are never changed. Nothing else is drawn: no line of its own, no keys. The values are in italic grey, and a guess has a dotted line under it as well. Enter fills in everything shown, guesses too, under one Undo; leaving the bullet any other way (a click elsewhere, the arrows) fills in only what is not a guess. To check a guess before it is written, Option-Enter stops on it (below). A click on a proposed value under a bullet accepts it: it turns solid and is filled in, guess or not, when you leave the bullet, so going back into an old bullet you click the ones you want and click away, with no Enter and no new bullet; a second click takes it back. **Cmd-Option-Enter** accepts everything shown, as Enter does, and leaves the bullet without making a new one. **Hide empty properties until something is proposed** (on, under **Proposals**; only in the graphs named in **Only in these graphs**): under a bullet and on a page, a property with no value stays hidden until the plugin proposes something for it (a doctor linked in a consultation brings Provider up, with the doctor in grey); Option-Enter still steps through the hidden ones, showing each as it opens it. On a page’s own properties (the page open in the main view, not a journal day) the same proposals show in its empty properties, from its title, the bullets on it and the pages and bullets it looks like (Works at on a doctor’s page with “Dietitian at Northgate.”); nothing is filled in by itself there: a click on the grey value fills it in, the faded arrow after the title takes it back, and a click beside it opens Logseq’s own list. The guesses: a page named in plain words, by its whole name or alias (“at Northgate”) or a word of its title no other page of that tag shares (“Dr. Patel”, “the tingling”; a tie names no one; a word only names a page when the earlier lines holding it are mostly about that page); the values the earlier nodes it most looks like had, by their words, links and tags (“Flagging again by teatime.” looks like the lines that had Fatigue; the nearest five that hold the property vote, a near-identical line counts most, and a clear lead is needed, else nothing); the parent bullet’s values for a tagged bullet under a tagged one; the journal day for the `date` of a tag with only a few dated nodes so far (one to four), all dated the day they were written (a treatment), or of a tag dated the day written at least 4 times in 5 but not 19 in 20; and a linked page with no tag yet, offered for the first empty place it could fill when there are one or two (it reads “Hannah Reyes #Doctor”, and taking it also gives the page that tag). A date written in the words (“on Friday”, “next Tuesday”, “tomorrow”, “on the 4th”, “4 Aug”, “in two weeks”), counted from the day the bullet is written on, is a guess for a `date` nothing else fills, for kinds usually dated ahead (an Expectation, not a Consultation) (one date in the words, or nothing; a journal page the day has not got yet is made when the guess is taken). A number beside a number property’s name (“cycle 5”, “3 cycles”) is a guess for that property. Two doctors linked keep the doctor quiet, guesses too. A property that takes tags of two or more separate families (a Topic that takes symptoms, decisions and people) is treated with care: a link in your words is only a guess for it, a link in a note below is not taken, a name in plain words is never taken for it, and a narrower property that takes the same link gets it first. A bullet with no tag, and no record above it, gets the tag of the lines it most looks like, pencilled in a dotted Tags pill under the bullet where Logseq shows a bullet’s tags, with that tag’s properties beside it, filled as if the tag were there (all guesses): Enter gives the bullet the tag and fills them in, under one Undo; leaving any other way takes nothing. The tag is proposed only when the nearest line is very much like this one and the lines agree, since a wrong tag costs more than a wrong value.
- **Link selected text** (on; switch off with **Link selected text with ⌘⌥L** under **Writing a record**): select words in a bullet you are writing and press `Cmd+Option+L`; a box opens under the words, you type a page's name and the pages that fit are listed, and Enter or a click makes the words a link to the page. With nothing selected, type the words first, Enter, then pick the page. Cmd+Z takes it back.
- **Pickers** (on; switch off with **What fits this bullet first** under **Writing a record**): when Logseq's own list for a property opens, the nodes that fit the bullet come first (a page its words link, then what similar bullets had), with a faint line before Logseq's own list. Up and Down follow the order you see.
- **Tag tree** (on; switch off with **Use the tag tree** under **Tools** in the settings): all your tags as one tree, moved about like Logseq's bullets, where you make new tags in the right place and move tags under other tags. In the full view and in the sidebar it is also the map of your properties (**Tags** and **Properties** at the top turn it round: by tag, or every property once with the tags that have it, opening into the same details): each open tag lists its properties (inherited ones faded) and what each holds, a link property opens into what it accepts and how it reads on the other page (changed there, or turned off), and an i beside a property explains it. The find box at the top finds tags and properties by name (a property shows under the tags that have it). From the map you can rename a property, change what a link accepts, rename and remove a property's choices (a choice still in use is not removed; a new choice is added, and the order of the choices changed, in Logseq's own settings for the property, which **Add or reorder in its settings** opens in the right sidebar, since Logseq lets only itself do those), make a choice its own child tag (**Make a choice its own child tag …** in the property's menu: the nodes with that choice move to the new tag with all their values, the choice is cleared on them and stays in the list for you to remove, and Undo puts everything back), turn a text or choice property into links to pages (**Turn into links to pages …** in the property's menu, the owner's way of doing it by hand made one step: the old property is renamed “Specialty (old)” and keeps its values; a new Specialty is made with Logseq's own Add property box, which opens on the tag's page in the right sidebar and is filled in by the plugin, since Logseq lets only itself make a property of yours; one page per value is made, or found, and tagged “Specialty kind” (the name can be changed; it cannot be the property's own); the new property accepts that tag, and every node gets its link, so the Oncology page shows “specialty of → Dr. Mei Chen”; delete the old one yourself when it looks right; Undo, for a minute, puts everything back, the pages going to Logseq's Recycle; a property some nodes hold several of is not handled yet), and write a tag's description (click it, or **Add a description …** in the tag's menu). What kind of value a property holds, and one versus several, open in Logseq's own settings for it in the right sidebar: Logseq lets a plugin change those only for the plugin's own properties. Each refresh of the map is timed; Logseq's developer console shows the last 50 with `console.table(refinementTagTimes)`.
- **Shortcuts** for linking, making pages, tagging, deleting a block and starting a new top-level block.
- **Properties in the line**: type `p::` at the end of the block you are writing and pick a property and its value from a list under the caret, without leaving the line; `date::fri` skips to the values of a field you know, and the first letters do (`da::fri`, `pro::at`); `;;` in place of `::` also keeps the value in your words (`deadline;;today`). Only in the graphs you name.
- **Copy as rich text** (resting since 0.4.251: not loaded until its layer comes): copies a page or block as tidy formatted text, or saves it as a PDF, for people who don't use Logseq. It only reads your notes.

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
| `GUIDE.md` | How to work on the plugin: the rules the code keeps, the reload loop, the command line. Not in the zip. |
| `HANDOFF.md` | Where things stand: the owner's decisions, what each round built, what is left open. Not in the zip. |
| `docs/` | Work notes: `NEXT.md` (what to do next, ranked, and the standing rules), `VISUAL-GUIDE.html` (the drawn guide to every part), `GRAMMAR.md` (every cue and how the plugin writes, asks and refuses), `MODELLING.md` (how to shape tags and fields, the principle behind the tag tree), and `history/` (the audit, the reviews, earlier session diaries, the prompts of finished rounds). Not in the zip. |
| `tools/` | `check.sh` (with `check.js`) checks every file, `boot-test.js` starts the plugin in a pretend Logseq window to check that it loads, starts, cleans up and reloads without a warning (needs node and jsdom), `parts-apart-test.js` boots it with each part left out in turn, `bump.sh` sets the version, `release.sh` runs the checks and builds the zip. Not in the zip. |
| `test/` | `plugin-test-graph.edn`, the seed of the Plugin Test Graph, and `illness-test-graph.edn` and the same seed in three parts, `illness-test-graph-1.edn` to `-3.edn` (all written by `illness-test-graph.py`), the seed of the Illness Test Graph. Not in the zip. |
| `dist/` | Copies of the release zips made for handing over; the zips themselves are not kept in git. The full set is in `~/logseq-plugin-archive/releases/`. |

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
| `editor.js` | The shortcuts and commands that write to a block, and the link box. |
| `pages.js` | What is drawn around a page's title: the page's kind, Alias of, and the shape box (what a tag or property holds, and where a tag sits). |
| `properties.js` | List properties, fold all, hidden properties, one column for a page's property values. |
| `links.js` | The marks on links and rows, dates, references, PDF citations, and the marks in Logseq's pickers. |
| `chrome.js` | Quieter sidebar and toolbar items, the right sidebar's presentation, the empty `[[ ]]` menu. |
| `styles.js` | The stylesheets. |
| `sidebar.js` | Right sidebar titles that open their page, and the line between items. |
| `search.js` | The search window: tidying, details, grouping, the preview, the typed codes. |
| `inline-props.js` | Properties in the line: the list after `p::`, `name::` or `name;;`. |
| `rich-copy.js` | Copy as rich text. |
| `todos.js` | Todos and Expectations (paused: off unless switched on in the settings). |
| `link-text.js` | Link selected text: the list under the selected words after `Cmd+Option+L`. |
| `picker.js` | The pickers: what fits the bullet first in Logseq's list for a property. |
| `tags.js` | The tag tree (on since 0.4.152; off only if switched off in the settings). |
| `settings-panel.js` | The settings window, its five groups and their pictures. |

## Install

**From GitHub (any computer):** in Logseq, run **Install plugin from GitHub release** from the command palette, paste `https://github.com/mn-321/logseq-plugin`, tick **effect**, and press Install. The effect tick matters: it lets the plugin draw on Logseq's own page (the rows, the map, the settings item in the three-dots menu); without it Logseq keeps the plugin in a sealed frame and nothing shows but the tag tree's toolbar button. Installed without the tick, the plugin shows one notice saying so: uninstall it (the gear on its card in the Plugins panel) and install it again with the box ticked. (The plugin's `package.json` asks for effect too, but Logseq's installer writes the box's value over it, so the box is what counts.) Logseq downloads the newest release's zip and runs it; **Check update** on the plugin's card in the Plugins panel (`t p`) brings the next version. Every version pushed to GitHub with a tag (`v0.4.280` and so on) becomes such a release; `.github/workflows/publish.yml` builds its zip. Installed this way, Logseq names the copy after the repository (`logseq-plugin`) and keeps its settings in `~/.logseq/settings/logseq-plugin.json`.

**Unpacked (the owner's Mac):**

1. Unzip the download, or use the repository folder itself. In Logseq Desktop, turn on **Developer mode** in Settings.
2. Open Plugins (`t p`), choose **Load unpacked plugin**, and pick the `logseq-db-refinements` folder. Keep the `parts` folder next to `main.js`.
3. If an earlier copy is loaded, replace its files and press **Reload** on the plugin in the Plugins panel. The plugin needs no internet connection.

## Settings

Open the settings from **Refinements settings** in Logseq's three-dots menu (top right, under Plugins), or run **Refinements settings** from the command palette.

- Sections are listed on the left under five groups: **Reading a page** (Pages, Visual hierarchy, Two-way links, Links and references), **Writing a record** (Properties in the line, Proposals while you write), **Around the page** (Sidebars and toolbar, Search, Search in the right sidebar), **Tools** (Copy as rich text, Tag tree, Shortcuts and actions) and **Paused** (Todos, Expectations). **Changed by you** lists everything you have changed.
- At the top of each group, a picture shows where on screen each of its sections works, numbered like the list beside it; a click on a part of the picture or on a name in the list opens that section. A click on a group's name shows all its sections at once.
- In **Paused**, Todos and Expectations share a first switch (**Use Todos and Expectations**); while it is off the rest of their settings are shown faint and do nothing. The tag tree, in **Tools**, has the same kind of switch (**Use the tag tree**, on).
- A search box (press `/` or `Cmd+F` in the window) looks through every setting's name and explanation.
- Most look settings have a small picture of what they change; clicking the picture flips the switch.
- A changed setting has a small dot and a **Reset** link. Each change is saved as you make it.
- Most switches apply at once. Those that need a reload say “after reload”, and a **Reload plugin** button is at the bottom.
- Logseq's own settings page for the plugin (Plugins, `t p`) still works and is one click away at the bottom of the window.

### Every setting

Grouped as in the settings window's sections (the window gathers them under the five groups above). The key is the name in the settings file (`~/.logseq/settings/logseq-db-refinements.json`); "Starts as" is the value a fresh install has.

| Setting | Key | Starts as | Where |
| --- | --- | --- | --- |
| Link selected text to a page | `linkShortcut` | mod+alt+l | Shortcuts and actions |
| Open selected text as page | `openShortcut` | mod+alt+p | Shortcuts and actions |
| Make a page from this block | `copyShortcut` | empty | Shortcuts and actions |
| Add tags to this page | `tagShortcut` | mod+t | Shortcuts and actions |
| Delete this block | `deleteBlockShortcut` | mod+backspace | Shortcuts and actions |
| New block at the outermost level | `outermostBlockShortcut` | alt+enter | Shortcuts and actions |
| Always show page title actions and tags | `showTitleChrome` | on | Pages |
| Show what a page is above its title | `showPageKind` | on | Pages |
| Show which page an alias belongs to | `showAliasOf` | on | Pages |
| Show how a page is used | `showUsage` | on | Pages |
| Mark the link to this page in Linked references | `markReferenceHere` | on | Pages |
| Show what a tag or property holds | `showShape` | on | Pages |
| Leave a tag page’s own tag off its rows | `ownTagHidden` | on | Pages |
| Journal days only as tall as what they hold | `compactJournals` | on | Pages |
| A day says what it holds | `dayCues` | on | Pages |
| Faint nesting lines | `indentGuides` | on | Visual hierarchy |
| Plainer properties | `plainProperties` | on | Visual hierarchy |
| Empty properties faint | `quietEmptyProps` | on | Visual hierarchy |
| Empty slots read as the row | `emptySlotsInRow` | on | Visual hierarchy |
| Hidden properties arrow on every block | `hiddenPropsChevron` | on | Visual hierarchy |
| Hide the dot on empty blocks | `quietEmptyBullets` | on | Visual hierarchy |
| Show what a block holds | `childTypeCues` | on | Visual hierarchy |
| Line beside embedded content | `embedLine` | on | Visual hierarchy |
| Dates in a soft grey box | `dateStyle` | on | Visual hierarchy |
| Dates carry their tense | `dateTense` | on | Visual hierarchy |
| Simpler page icons | `plainPageIcons` | on | Visual hierarchy |
| Soft background behind tags | `tintTags` | off | Visual hierarchy |
| Tags as grey class names | `tagMark` | on | Visual hierarchy |
| Quiet page links | `quietLinks` | on | Links and references |
| Clearer Linked references | `referenceLayout` | on | Links and references |
| Icons for block references and files | `referenceIcons` | on | Links and references |
| Show how records are linked | `linkLabels` | on | Links and references |
| Tidy parent paths | `tidyPaths` | on | Links and references |
| Empty [[ ]] menu until you type | `quietLinkMenu` | on | Links and references |
| Tap the Hyper key to start a [[ link | `hyperLinkTap` | on | Links and references |
| The [[ menu and the # picker say what each row is | `pickerMarks` | on | Links and references |
| The property picker says each type | `propertyPickerTypes` | on | Links and references |
| The value picker says what each row is | `valuePickerMarks` | on | Links and references |
| The link box lists your pages | `linkBoxList` | on | Links and references |
| The link box opens beside the words | `linkBoxBeside` | on | Links and references |
| The link box lists blocks too | `linkBoxNodes` | on | Links and references |
| Link selected text with ⌘⌥L | `linkText` | on | Link selected text |
| What fits this bullet first | `pickerFitsFirst` | on | Pickers |
| Links read the same from both ends (a row “doctor of → …” on the page a field points to, grey names, lines open on a click, a card on hover, kinds to filter by, a + to add a linked record, right-click a row's name to change how it reads, tick boxes to pick records and act on them together) | `twoWayRows` | on | Two-way links |
| Fields read backwards (names for those rows) | `twoWayNames` | a few pairs | Two-way links |
| Fields shown from one end only (no row on the page they point to; set from the tag tree too) | `twoWayOneEnd` | empty | Two-way links |
| Leave out Logseq's tag lists the rows repeat | `twoWayHideTagLists` | on | Two-way links |
| Escape takes [[ and # out | `pickerEscapeClears` | on | Links and references |
| Year-first dates in [[ ]] link to journals | `dateLinkFormats` | on | Links and references |
| Compact PDF citations | `pdfCitations` | on | Links and references |
| Links inside a reference open their own page | `innerReferenceLinks` | on | Links and references |
| Page links without trailing tags | `pageLabels` | on | Links and references |
| Quiet these sidebar and toolbar items | `quietItems` | Flashcards, Graph view | Sidebars and toolbar |
| Left sidebar icons only where they mean something | `quietSidebarIcons` | on | Sidebars and toolbar |
| Tidy the right sidebar | `tidySidebar` | on | Sidebars and toolbar |
| Sidebar titles open their page | `sidebarTitleOpens` | on | Sidebars and toolbar |
| Thick line between sidebar items | `sidebarThickDividers` | on | Sidebars and toolbar |
| Search in the right sidebar | `searchShortcut` | mod+alt+f | Search in the right sidebar |
| Search button in the right sidebar | `sidebarSearchButton` | on | Search in the right sidebar |
| Tidy the search window | `tidySearch` | on | Search |
| Roomier search window | `roomySearch` | on | Search |
| Say more about each search result | `searchDetails` | on | Search |
| Put search results page by page | `groupSearch` | on | Search |
| Preview the selected result | `searchPreview` | on | Search |
| Preview: edit with Logseq's own editor (trial) | `searchPreviewEditor` | off | Search |
| Filter search with codes | `searchFilters` | on | Search |
| Properties typed in the line | `inlineProps` | on | Properties in the line |
| Only in these graphs | `inlinePropsGraphs` | empty | Properties in the line |
| First letters name the field | `inlinePropsPrefix` | on | Properties in the line |
| A field that takes several stays open | `inlinePropsGather` | on | Properties in the line |
| Escape takes the token out | `inlinePropsEscapeClears` | on | Properties in the line |
| Style | `layout` | document (or outline, timeline, column, timetable) | Export as document |
| Use Todos and Expectations | `todosEnabled` | off | Todos |
| Todos button in the toolbar | `todosToolbarButton` | on | Todos |
| The buttons and shortcuts open Todos and Expectations as | `todosOpensAs` | page | Todos |
| Open Todos | `todosShortcut` | mod+alt+t | Todos |
| Days shown under “Done” | `todosDoneDays` | 14 | Todos |
| Tag of an expectation | `expectationsTag` | Expectation | Expectations |
| Property that holds where it stands | `expectationsStateProperty` | juncture | Expectations |
| Expectations button in the toolbar | `expectationsToolbarButton` | on | Expectations |
| Open Expectations | `expectationsShortcut` | mod+alt+e | Expectations |
| Use the tag tree | `tagTreeEnabled` | on | Tag tree |
| Order of the tags | `tagTreeRoots` | (empty: by name) | Tag tree |
| Groups of properties | `propertyGroups` | (empty: no groups) | Tag tree |
| The button and shortcut open the tag tree as | `tagTreeOpensAs` | page | Tag tree |
| Tag tree button in the toolbar | `tagTreeToolbarButton` | on | Tag tree |
| Open the tag tree | `tagTreeShortcut` | mod+alt+g | Tag tree |

## Shortcuts

All can be changed or cleared in the settings window under **Shortcuts** (they apply after a reload). On a Mac, `mod` is Cmd; elsewhere it is Ctrl. Every action is also in the command palette under the same name.

| Shortcut | Action |
| --- | --- |
| `Cmd+Option+L` | Link selected text to a page |
| `Cmd+Option+P` | Open selected text as page |
| `Cmd+T` | Add tags to this page |
| `Cmd+Delete` | Delete this block (with the blocks nested under it) |
| `Option+Return` | New block at the outermost level |
| `Cmd+Option+F` | Search in the right sidebar |
| `Cmd+Option+T` | Todos, while it is switched on (changed under **Todos** in the settings window) |
| `Cmd+Option+E` | Expectations, while Todos is switched on (changed under **Expectations** in the settings window) |
| `Cmd+Option+G` | Tag tree, while it is switched on (changed under **Tag tree** in the settings window) |
| none | Make a page from this block (also in a bullet's right-click menu) |

## Appearance

| Feature | What you see | How it works |
| --- | --- | --- |
| Page links | Normal text colour and a faint underline, clearer on hover | Turn off with **Quiet page links**. |
| Links to a tag’s own page | Underlined like a page link, with the tag’s icon in the colour Logseq gives tags (a `#` in that colour when the tag has no icon) | A page’s own icon stays in the normal text colour, and an icon stays on the same line as the first word of the name. |
| Links to blocks | A small dot in front, and no underline; a linked task shows its status icons in place of the dot | Blocks are confirmed from the database, so a page is never marked as a block. Turn off with **Icons for block references and files**. |
| PDF selections | The excerpt reads as a quotation: the words between quotation marks, then a small muted citation in parentheses, `(p. 1)` on the PDF’s own page and `(Document title, p. 1)` elsewhere. A muted double quotation mark (`“`) replaces the citation bullet. Hover shows the full title. | Clicking the excerpt or its citation opens the exact highlight through Logseq’s native link. Drag to select text; links inside the excerpt remain clickable. Area selections keep their image and put the citation before it. Enter or Space on the citation also opens the highlight. Turn off with **Compact PDF citations**. |
| Links to PDFs and images | A grey document or picture icon in front and the words with a page link’s faint underline; nothing after | The icon comes from the link’s address. Turn off with **Icons for block references and files**. |
| Dates | A grey box in the normal text font, in prose, in a page’s property list and in the pill row under a record alike; no pencil after a date value | No border, calendar icon or edit pencil (a click on the value still opens the date picker). Covers date values and links to journal pages; the capsules at the side of a block and tables keep plain dates. Turn off with **Dates in a soft grey box**. |
| A date's tense | A past day in the quieter text colour, today a little firmer on a stronger wash, a day to come as it is; an overdue Scheduled or Deadline keeps Logseq's yellow | Worked out from the date's own words each time the page is drawn. Turn off with **Dates carry their tense**. |
| What a folded block hides | On a folded block only, after its text: `↳`, a small open circle with the number of unfinished tasks at any depth, small image or PDF icons for files directly below, the kinds of record inside by your own tags (“· 3 #Decision”, up to three), and the nearest due day of an unfinished task (“· due Fri”, “· due Oct 20”). An open block shows nothing, since its children are on screen | Hover shows the counts. Shown on ordinary pages and on the Journals list. Done and canceled tasks are not counted. Turn off with **Show what a block holds**. |
| Nesting lines | Faint lines beside nested blocks; the line beside the branch you point at or type in is a little stronger | Recolors Logseq's own line, so nothing moves. Turn off with **Faint nesting lines**. |
| Empty blocks | A block with no text, nothing nested under it and no tags, properties or pictures shows no dot, so empty blocks work as space between groups. Pointing at it shows the dot faintly; it is back in full while you type in it | Turn off with **Hide the dot on empty blocks**. |
| Embeds | A faint line at the left of embedded blocks and pages | Turn off with **Line beside embedded content**. |
| Tags | A tag at the right of a block, the tag label above a title and the tag tabs are grey monospace names without the `#`, since a tag acts like a class. A tag word left in a sentence keeps its `#` in the tag colour, and so does the `#` before a tag page's own title | Turn off with **Tags as grey class names**. |
| Tag background (optional) | A faint violet chip behind tags, in text and at the end of a block | Off by default; turn on with **Soft background behind tags**. |
| Page title row | The page’s tags and actions (such as **Set property**) stay visible above the title, muted until you point at them, with `Page` on an untagged page (click it to set tags) | Turn off with **Always show page title actions and tags** and **Show what a page is above its title**. |
| Linked references | The link to the page on screen has a faint grey wash behind it with a fine line beneath (on a journal, so does a date that points to that day); source pages are set apart by a gap and share one plain heading, followed by `· n` when a page holds several references; the grey parent path has a bullet with the reference stepped in below it; blocks below a reference are quiet | Turn off with **Mark the link to this page in Linked references** and **Clearer Linked references**. |
| Alias pages | A small muted “Alias of …” line under the title of a page that another page lists as its alias; the name opens the original | Turn off with **Show which page an alias belongs to**. |
| How a page is used | Beside the Linked references heading, the references counted by how they arrive, with your own property names: “owner · 3   attendees · 2   in text · 4” (“tagged · n” on a tag page). The counts look like the rows they stand for: all dark while every reference shows; click one and the other references and their counts step back together; click again to bring them all forward | Counted from the database; nothing is written. Turn off with **Show how a page is used**. |
| What a tag or property holds | Under a tag page's title, a box closed to one line: where the tag sits (“#Entity › #Person › #Doctor”, “also under #X” for a second parent), how many fields it has and how many records it tags. Click the line to open it: each field and what it takes (“authors → Person · many”), the inherited ones faint. On a property page the line says what it takes and how many blocks hold it; opened, its most used values with bars. Open or closed is remembered | Turn off with **Show what a tag or property holds**. |
| Links inside a reference | A page link or tag shown inside a block reference opens its own page when clicked (Shift-click: in the sidebar); the rest of the reference still opens the block | Turn off with **Links inside a reference open their own page**. |
| Sidebar and toolbar items | The items named under **Quiet these sidebar and toolbar items** (default: Flashcards, Graph view) are smaller and lighter, in place | Set the list empty to turn it off; applies after a reload. |
| Right sidebar | Flat panels; page properties opened and their Hide control hidden; Page graph and (Dev) buttons hidden | Turn off with **Tidy the right sidebar** (reload). The **Search** button there is turned on and off under **Search in the right sidebar**. |
| Right sidebar titles | Clicking the title of a page or block in the right sidebar opens it in the main view, with a faint underline while you point at it. The small arrow before the title, and the empty part of the title bar, still fold and unfold it; Shift-click works as before. Search, Help and other items with nothing to open still fold | Turn off with **Sidebar titles open their page**. |
| Lines between sidebar items | A thick grey line between the items in the right sidebar | Turn off with **Thick line between sidebar items**. |
| Page icons | Generic page icons in titles and sidebars become a small plain rectangle; custom icons are unchanged | Turn off with **Simpler page icons**. |
| Grey parent paths | In the grey line above a reference or query result, the `[[ ]]` of a link fade, and a labelled link `[words]([[page]])` fades all but its words; the words themselves are never changed | Turn off with **Tidy parent paths**. |
| The `[[` page menu | Typing `[[` no longer opens a list of date words (Today, Tomorrow, Next week …) at once; the menu appears with the first letter you type, and until then the arrow keys, Enter and Tab leave it alone. In the list, each row carries the mark its link would have on the page: a `#` in the tag colour before a tag, a small grey box before a journal day, the plain page rectangle before a page, or the page's own icon alone when it has one, with the page's tags as grey class names at the right rather than “#Person” in the words; the relative days (Today, Last Wednesday …) are in the quiet colour, and the New page row is pencilled in, italic with the `+` outside, since that means “not yet there”; a row that is a value **Proposals in the pills** has pencilled into the record you are writing says “proposed” after its name (Logseq orders its rows, so the plugin cannot put it first) | Escape closes the menu and takes the `[[` and the letters after it out of the text (and the `#` and its letters in the tag picker), so a key that meant “never mind” never makes a page or a tag when the block is saved; Cmd+Z brings them back | Marked by what Logseq draws in each row and by name, so a page and a tag with the same name cannot be told apart there. Turn off with **Empty [[ ]] menu until you type**, **The [[ menu says what each row is** and **Escape takes [[ and # out**. |
| The `#` tag picker | In the list that opens when you type `#`, a `#` in the tag colour before each tag, and at the right, in grey monospace, what the tag sits under and the fields it brings (“under Occurrence · + date”); the New tag row sits pencilled in, italic | Known by name against your tags; the parents and fields come from the schema the line list reads. Turn off with **The [[ menu and the # picker say what each row is**. |
| The value picker on a pill | In the list that opens on a property's value (Set owner …), the plain page rectangle or the page's own icon before a page, a `#` in the tag colour before a tag, a small dot before a block, the kind in quiet monospace words at the right (Person, tag, page, block), a journal day above a block in the grey date box, and the New row pencilled in, italic | Known by name, as the `[[` menu is. Turn off with **The value picker says what each row is**. |
| The property picker | In Logseq's **Add property** list (after `/` and Add property, or **Set property** above a title), each name is followed by its type in quiet monospace words: `Date`, `Person · many`, `choices`, `text`, `number`, `yes/no`, `url`; the `T` before every name becomes the type's icon, the one **Properties in the line** draws | Found by the property's ident on each row. A property the plugin does not know (one of Logseq's own) keeps its `T`. Turn off with **The property picker says each type**. |
| Dates typed in `[[ ]]` | A date typed year first inside `[[ ]]` (`2026 10 14`, `2026-10-14`, `2026/10/14`, `2026.10.14` or `20261014`, month and day with two digits) turns into that day's journal name (“Oct 14th, 2026”) as the last digit is typed, so the menu offers the journal page | Uses the journal's own title, or Logseq's date format when that day has no page yet. Undo brings the digits back. Turn off with **Year-first dates in [[ ]] link to journals**. |
| Page labels | A page link whose shown name ends in a tag name (“Name #tag”) shows the stored title alone | Turn off with **Page links without trailing tags**. |
| Properties | Under a block, properties read as `name: value · name: value` with no capsule outlines; property names are grey so the values stand out. A property list under a block (one name per line) sits on a very light grey field with square corners, and so does the page's own list under its title, with one dot per property and **Add property** shown only while you point at the list (on the page and in the right sidebar); the grey ends above the Add property row, which keeps its place and has no grey of its own. In a page's list every value starts in one column: Logseq puts a bullet before most values but none before text, so text is moved in to where the other values' words start, and a text value that starts with a page's icon (a link to a page that has one) shows that icon where the bullet would be. | Turn off with **Plainer properties**. |
| Empty properties | A property with no value yet is drawn faint under a block and in a block's property list, so filled values stand out; nothing is hidden and nothing moves | Turn off with **Empty properties faint**. |
| Empty slots under a block | An empty slot Logseq lists under a block reads like the row of filled properties above it, `Scheduled: ···`, faint, without the type icon, the value's bullet or the grey field; a click on the `···` still opens Logseq's picker | Turn off with **Empty slots read as the row**. |
| Tag pages | On a tag's own page, the rows of its table, the records under it and its Linked references do not repeat that tag; other tags stay. | Turn off with **Leave a tag page's own tag off its rows**. |
| Left sidebar lists | Favorites and Recent show an icon only where it says something: Logseq's generic page icon is left out (names stay lined up); a tag's #, a page's own icon and an icon from its tag stay. Journal days are in grey. | Turn off with **Left sidebar icons only where they mean something**. |
| Journals list | Each day is only as tall as what it holds, instead of at least 500px. After each day’s title, in small quiet words, what the day holds, the way a folded block says it: a solid circle with the number of unfinished tasks on that day, the nearest due day of one (“due Fri”), and the kinds of record inside by your own tags, counted (“2 Meeting · 1 Decision”); a day with nothing open has a shorter cue, and nothing steps back. A journal opened on its own shows none. | Turn off with **Journal days only as tall as what they hold** and **A day says what it holds**. |
| Hidden properties | While you point at a block that has hidden properties, or near the spot where its arrow sits, a small grey chevron shows right after the block's own text, turning like the fold arrow beside a block: pointing right while they are folded, down while they are open (an open one stays visible). Click it to open or fold them. Logseq shows its own “Show hidden properties” button only on a block you have zoomed into; there it becomes the same arrow. A block gets it only when it holds a value Logseq hides (a property set to hide by default); an empty slot, such as a task's unset Scheduled, is not a hidden property and gets no arrow. It is left off a folded block and waits while the block is being edited. | Turn off with **Hidden properties arrow on every block**. |
| Records under a page's tag tabs | Each tab name is a grey monospace name without the `#`, like every tag, with a hairline under the chosen tab. In each record, the value that points to the page on screen has the faint grey “points here” mark; a folded record shows that property beside its title (“owner: page”) | The tab names come with **Tags as grey class names**; the mark and the folded label with **Show how records are linked**. |

Branch cues refresh on navigation and graph edits. The plugin reads the current page’s block tree and queries DB metadata for task status, asset blocks, and references to assets. Done and canceled tasks are excluded. Counts describe blocks containing each type, rather than individual files. Some custom task or asset representations may not be recognized. The `[[` menu's rows are marked by name (see **The `[[` page menu** above), so a page and a tag with the same name cannot be told apart there.

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

## Tag tree

**On since 0.4.152** (it was paused from 0.4.128). With **Use the tag tree** switched off in the settings window, the tag tree adds no toolbar button, page, sidebar panel, command or shortcut until it is switched on again and the plugin reloaded.

All your tags as one tree, so you can see what is inside each tag, make new tags in the right place and move tags around. Open it with the tree button at the top right of Logseq (Logseq may put it in the puzzle-piece menu first; the pin there keeps it in the toolbar), with `Cmd+Option+G`, or by running **Tag tree** from the command palette. It shows as a full view in the main area, or as a smaller panel in the right sidebar (**Tag tree in the right sidebar**).

- A tag's place in the tree is its **Extends** property: a tag inside #Entity extends Entity and inherits its properties. A tag can extend more than one tag; it then shows under each, marked "also under …".
- The tree works like Logseq's bullets. The **top level** is every tag with no parent (Logseq's own Root tag is not shown), each with its own colour; every tag inside one carries that colour on its `#`, so you can see at a glance which branch a tag belongs to.
- Below them, **Under Logseq's tags** lists the tags that extend Logseq's own Task or Card.
- The tree is just the outline: each row is the tag's name and its description, with its properties under it in the full view. Hover a tag's name to see how many nodes carry it and how many tags are inside it. Only something unusual is written beside a name: "also under …" for a tag under two tags, and "same name as another tag". Tags with tags inside them are a little heavier; a top-level tag is the largest.
- **Make a tag inside another**: the **+** on its row, or `n`. Type a name and press Enter; several names separated by commas make several tags. A name that is already a tag is put inside as well, instead of making a second one; one of Logseq's own tags (Task, Page…) is left where it is. **Undo** takes a new tag away again and puts a moved one back.
- **Move a tag**: drag it as you would a bullet. Over the upper half of another tag a line shows above it, and the tag goes just before it; over the lower half, just after it; move the pointer to the right of the name and the line is indented, and the tag goes inside it as its first tag (below an open tag it always goes inside). Hold `Option` to keep it where it was too, so it extends both. While dragging, **Drop here to put it at the top level** shows under the top level. Or press `m` (Move to …) and type the new parent's name, or `a` (Also put under …). `Tab` puts a tag last inside the tag just above it, `Shift+Tab` moves it out to just after its parent, as in an outline. A tag cannot go inside one of the tags inside it. Every move has **Undo**.
- **Rename**: `r`, double-click the row, or the row's menu. Tags are renamed everywhere, as Logseq's own rename does.
- **Properties**: under each tag, its own properties sit on light chips, and the ones it gets from the tags above it follow in grey, grouped as "from #Entity …" (in Logseq a tag has every property of the tags it is inside). Click a property to **Move up** to a tag above (it then applies to that tag and everything inside it), **Take it off**, or open it. `p` (or **Add a property …** in the row's menu) adds one of your properties; a name that is not a property yet opens Logseq's own **Add tag property** on the tag's page with the name typed in, where you choose its type. Taking a property off a tag keeps values already filled in.
- **Order**: tags beside each other keep the order you give them, at every level, as bullets do: drag one above or below another, press `Cmd+Shift+Up` / `Cmd+Shift+Down`, or use **Move up** / **Move down** in its menu. Tags you have not placed follow by name. This is the **Order of the tags** setting, so it is the same in every graph. To move several tags at once, pick them with `Cmd`-click on their names or rows (or `x` on the current row; `Shift`-click a row picks every row from the current one to it); the bar that appears has **To the top level** and **Move to …** to put them all inside one tag, and `Esc` unpicks.
- **A tag under two tags**: its menu has **Keep only under #X** (drops the other parents) and, for a tag that is also at the top level, **Keep only at the top**.
- **Merge two tags** (`j`, or **Merge into …** in the row's menu): pick the tag to keep. Works for two tags with the same name (marked "same name as another tag"; click the mark), a tag into its parent, or two tags beside each other. Everything tagged with the old tag gets the kept one; links, property values, aliases and "tags of its values" point to it; tags inside it move into the kept tag; its own properties and blocks, and the aliases, icon and property values on its page, move over; and its description is kept if the other has none (the summary says when it is dropped). A summary shows what will change and nothing happens until you press **Merge**. Logseq then deletes the old tag for good: this cannot be undone in one step, so try it in a test graph first.
- Click a tag's name to open its page (`Shift` click: right sidebar). Right-click a row, or its `…`, for all of these. `↑` `↓` move between rows, `←` `→` fold and unfold, `Enter` opens, `/` finds. Folded tags are remembered on this computer.

- **Groups of properties** (Properties view only, for your own order; nothing in the graph changes): **+ New group** at the bottom makes one; a property goes in with **Put in a group …** in its menu or by dragging it onto the group's name (onto **Not in a group** takes it out); a property sits in one group; a group's name folds it, and its menu (right-click, or ⋯) renames it, moves it up or down, or removes it (its properties stay, in no group); renaming a property from the map keeps it in its group. Kept in **Groups of properties** by name, which you can also edit by hand.

Settings (section **Tag tree**): **Order of the tags** (empty: by name), **Groups of properties** (empty: none), **The button and shortcut open the tag tree as** (page), **Tag tree button in the toolbar** (on), **Open the tag tree** shortcut (`mod+alt+g`).

## Search

Logseq's search window is calmer and easier to read. Every setting in this section applies after a reload. Typing markup in result text and paths, such as `[[ ]]` and `**`, is faded so the words stand out (your blocks are unchanged). It also has compact rows, small light group headings instead of grey bars, a quiet icon and path, bold matched words instead of yellow highlights, and a faint grey wash on the selected row. Page results use the plugin's plain page rectangle. Results, ranking and keyboard keys are Logseq's own. **Shift+Enter** or **Shift-click** opens the selected result in the right sidebar instead of the main view (the bar along the bottom of the window says so), and search closes. Turn this off with **Tidy the search window**.

**Roomier search window** (on by default): a larger search window with bigger text and more room between results and groups. Results fade in as you type. “Show more” and key shortcuts appear only under the pointer, and the key hints at the bottom are hidden. The page and parent blocks above a result are named in full, with the page in firmer text, a small bullet before each parent block, and “…” where Logseq skips levels. Turn it off in the plugin settings.

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

## Commands

**Link selected text** (0.4.252, the rebuilt one)

1. While writing a bullet, select the words to link, such as `Chen` or `the oncologist`. Or select nothing: the list first asks for the words to show; type them and press `Enter`, and the link goes in at the cursor.
2. Press `Cmd+Option+L` (`Ctrl+Alt+L` outside a Mac). A box opens under the words; type a page's name and the pages that fit are listed, the closest first, each with its tag at the right.
3. Type to look for another page; the bullet's words stay as they are while you type. `Up` and `Down` move, `Enter` or a click links the highlighted page, `Esc` closes the list and leaves the words alone.
4. The words become `[[Dr. Mei Chen]]` when they are the page's name, otherwise a link that keeps them, `[the oncologist]([[Dr. Mei Chen]])`. It is typed into the bullet as if by hand, so the proposals see it at once and `Cmd+Z` takes it back. **New page “…”** is offered only when no page has that name, and is never first when a page fits.

The older **Link selected text to a page** below belongs to a resting part and is not loaded.

**Link selected text to a page**

1. Select the words you want readers to see, such as `rename`.
2. Press `Cmd+Option+L` (`Ctrl+Alt+L` outside a Mac).
3. Type a few letters of the page's title. The field opens just under the selected words, as Logseq's own `[[` menu does, with nothing dimmed or covered. A list of your pages, tags and journal days opens under the field, drawn with the marks the page uses (a page's own icon or the plain rectangle, a `#` in the tag colour, a small grey box for a journal day, the kind in grey monospace words at the right), filtered as you type; under them, up to five blocks whose words match (a small dot before each; a tagged block such as a Task first, with its tags at the right; any other block once three letters are typed, found by Logseq's own search). `Up` and `Down` move, `Enter` links the highlighted row, a click picks one. The selection becomes `[rename]([[real name of link]])`.

The link is written by the page's or block's id, the form Logseq stores every link in, so it is a real reference: the words show in the target's Linked references and count wherever a `[[page]]` link would. An italic **Make page “…”** row is offered only when no title matches the letters exactly, and never above a match, so a typo cannot make a page; `Enter` on it makes the page and links to it. Cancel (`Esc`, or a press anywhere else) leaves the block unchanged. The command accepts a single-line label; it checks the saved block again before replacing text. With **The link box lists your pages** off, the field is bare and `Enter` links what you typed; with **The link box lists blocks too** off, only pages, tags and days are listed; with **The link box opens beside the words** off, the box opens in the middle of the window as before.


**Make a page from this block**

1. Put the cursor in a block or select it. Run **Make a page from this block** from the command palette, or right-click its bullet and choose the same name. 
2. The block's text becomes the page title. The new page contains a reference back to the original block, with copies of the child blocks nested beneath that reference.
3. The original block and children remain where they are. An existing page with the same title is left alone. Text is copied; block properties, tag associations, and asset metadata are not copied.

**Open selected text as page**

1. Select text while editing a block. Within 30 seconds, run **Open selected text as page** from the command palette or press `Cmd+Option+P` (`Ctrl+Alt+P` outside a Mac).
2. The selected words become a `[[link]]` in their block, then the plugin opens the page with that name (creating it if needed). Trailing tags are left out of the page name. If the block changed in the meantime, or the selection contains brackets or line breaks, the page still opens and the text is left as it was.

**Add tags to this page**

Press `Cmd+T` (changeable in the settings window), run **Add tags to this page**, or click the `#Page` above the title of an untagged page. All three open the same Tags list just under the title of the page you are on. On the Journals list the command says so and does nothing.

**Delete this block**

Press `Cmd+Delete` while typing in a block. The block and the blocks nested under it are deleted, and the cursor goes to the end of the block just above. If some of the block's text is selected, only that text is deleted, as the Mac's own Cmd+Delete would do. With no block being edited, the selected blocks are deleted (a block inside another selected block goes with it).

**New block at the outermost level**

Press `Option+Return` while typing in a block. After the top-level block you are in (and everything nested under it), the plugin adds an empty block as a spacer and then a new empty top-level block with the cursor in it.

**Fold all results / Unfold all results**

Click in a query or one of its results, then run **Fold all results in this query** or **Unfold all results in this query** from the command palette (with no click, the query on screen is used). They press each result's own fold arrow, so Logseq keeps the fold while the page is open, and results drawn later get the same fold. A result you fold or unfold by hand afterwards keeps your choice. With no query on the page the command says so. **Copy fold log (troubleshooting)** shows what happened to each result.

**Choose properties shown in this list**

Click in a record of a query (or of a list on a page such as a tag page) and run **Choose properties shown in this list** from the command palette. Tick the properties to show, untick **Body** to hide the notes under each record, tick **One line per record** for a timeline layout; **Show all** returns to Logseq's view. The choice is saved in the plugin's settings, not in your notes.

**Refinements: troubleshooting**

One palette entry opens a small box listing the troubleshooting tools; choosing one runs it. They change nothing: **Check what the plugin finds on this page** (how many of each Logseq part the plugin relies on are on screen, and the plugin's own marks), **Copy styling details of this block** (how Logseq built the block you are in), **Copy page title area details**, **Check linked-record labels**, **Copy fold log**, **Turn measuring on or off**, **Copy performance report** (timings of the plugin's work) **Copy warnings** (every warning the plugin wrote to the console this session) and **Take the tour** (for checking a change: it visits the pages listed in the hidden setting `tourStops` one at a time, F8 for the next, and saves what it measured at each, when the title and the plugin's rows appeared, what moved and what Logseq logged, as `tourReport` in the settings file). Each tool keeps a command of its own, so a shortcut you bound to one still works.

Logseq themes and releases can change the names the plugin relies on; after an update, run **Check what the plugin finds on this page**.

## Version history

See `CHANGELOG.md`.
