# Logseq DB Refinements

A personal starter plugin for Logseq DB graphs. Version 0.2.105.

Generic page icons in page headings and sidebar labels use a small soft-corner rectangle with no fold or internal lines. Custom icons and inline asset icons remain unchanged. Right-sidebar panels have transparent backgrounds, no shadows, and square edges, with a faint divider between items.

Sidebar page properties automatically expand using Logseq's native control. Once expanded, the Hide properties control is hidden. The sidebar's Page graph, (Dev) RTC, (Dev) Undo/Redo, and (Dev) Profiler buttons are hidden, and a Search button is added at the start of that row. Property values remain editable. This targets the English labels and the right sidebar only; main-page property controls are unchanged.

## Install

1. Unzip the download. In Logseq Desktop, enable **Developer mode** in Settings.
2. Open Plugins (`t p`), choose **Load unpacked plugin**, and select the unzipped `logseq-db-refinements` folder.
3. Reload the plugin after replacing an earlier copy. This version uses Logseq Desktop’s bundled SDK and has no CDN dependency.

## Settings

Open the plugin's settings from Plugins (`t p`), or run **Refinements: Show shortcuts and settings** from the command palette. The panel lists each action with its shortcut, lets you change or clear the shortcuts, and can turn off the right-sidebar tidying. Reload the plugin after changing these. Shortcuts can also be edited in Logseq's own Keymap settings.

## Appearance

| Feature | What you see | How it works |
| --- | --- | --- |
| Page links | Normal text color and a faint underline, clearer on hover | No change to the underlying reference. |
| Inline tag links | A visible `#` and slightly firmer lettering, with no page-link underline | Only rendered tag links change; side tags retain Logseq’s placement and design. |
| Block references | A quiet `↳` preceding `((block references))` on the current page | The plugin reads current-page block text and targets only explicit block UUID references. |
| `((` results | A small `↳` beside each result | This menu searches blocks. The mixed `[[` menu does not expose reliable type labels to plugin styling, so it remains native. |
| PDF selections | A small, muted `p. 1` citation before normal excerpt text, with no underline or colored emoji. A muted double quotation mark (`“`) replaces the citation bullet. Elsewhere, the citation reads `p. 1 · Document title`. Hover shows the full title. | Clicking the excerpt or its citation opens the exact highlight through Logseq’s native link. Drag to select text; links inside the excerpt remain clickable. Text selections put the citation first; area selections keep their image and put the citation before it. Enter or Space on the citation also opens the highlight. |
| Dates | Normal text font with high-contrast blue-gray lettering (slightly larger and firmer) on a soft blue tint, with compact inline-code padding | No border or calendar icon; adapts to light and dark themes. Covers DB date values and references to journal pages. Standard date links are styled during rendering; journal styles remain installed across page navigation. Removes the date link underline while keeping it clickable. |
| Child types | An empty dashed circle means unfinished tasks below; a muted `↳` followed by image/PDF icons at the end of the parent text indicates assets in immediate children. Unrecognized file types use a generic document icon. | Hover shows unfinished tasks at any depth and immediate asset child counts. PDF citation quote bullets, numbered bullets, and custom icons retain their presentation. |
| Nesting lines | Faint lines beside nested blocks; the line beside the branch you point at or type in is a little stronger | Recolors Logseq's own line, so nothing moves. Turn off with **Faint nesting lines**. |
| Tag background (optional) | A faint violet chip behind tags, in text and at the end of a block | Off by default; turn on with **Soft background behind tags**. |
| Page type | A small muted “Tag” or “Property” under the title of tag and property pages | Ordinary and journal pages get nothing. Read from the page's type in the database. Turn off with **Label tag and property pages**. |
| Alias pages | A small muted “Alias of …” line under the title of a page that another page lists as its alias; the name opens the original | Turn off with **Show which page an alias belongs to**. |

Branch cues refresh on navigation and graph edits. The plugin reads the current page’s block tree and queries DB metadata for task status, asset blocks, and references to assets. Done and canceled tasks are excluded. Counts describe blocks containing each type, rather than individual files. Some custom task or asset representations may not be recognized. This plugin does not alter the native mixed `[[` picker; labeling its rows accurately would require a supported type-aware menu extension.

## Search

Logseq's search window is calmer and easier to read. Typing markup in result text and paths, such as `[[ ]]` and `**`, is faded so the words stand out (your blocks are unchanged). It also has compact rows, small light group headings instead of grey bars, a quiet icon and path, bold matched words instead of yellow highlights, and a faint grey wash on the selected row. Page results use the plugin's plain page rectangle. Results, ranking and keyboard keys are Logseq's own. Turn this off with **Tidy the search window** in the plugin settings.

**Search in right sidebar**

1. Click **Search** at the top of the right sidebar, press `Mod+Alt+F` (`Cmd+Option+F` on Mac, `Ctrl+Alt+F` elsewhere), or run **Refinements: Search in right sidebar** from the command palette.
2. Logseq's search opens in the right sidebar and stays there. Click a result to open it in the main area; Shift-click opens it in the sidebar too. The search box keeps your words until you change them.
3. Running the command again jumps back to the sidebar search if it is already open. Close it like any sidebar item.

This uses Logseq's own "keep search in the sidebar" action (also available by pressing `Mod+Enter` inside search), so results match normal search.

## Commands

**Link selected text to a page**

1. Select the words you want readers to see, such as `rename`.
2. Press `Mod+Shift+L` (`Cmd+Shift+L` on Mac, `Ctrl+Shift+L` elsewhere).
3. Type the real page title and press Enter. The selection becomes `[rename]([[real name of link]])`.

Cancel leaves the block unchanged. The command accepts a single-line label and page title; it checks the saved block again before replacing text. It creates the link, not the destination page itself; Logseq can resolve or create that page when you follow the link.


**Copy block and children to new page**

1. Put the cursor in a block or select it. Use the command palette and run **Refinements: Copy block and children to new page**, or right-click its bullet and choose **Refinements: Copy children to new page**.
2. The block's text becomes the page title. The new page contains a reference back to the original block, with copies of the child blocks nested beneath that reference.
3. The original block and children remain where they are. An existing page with the same title is left alone. Text is copied; block properties, tag associations, and asset metadata are not copied.

**Open selected text as page**

1. Select text while editing a block. Within 30 seconds, run **Refinements: Open selected text as page** from the command palette or press `Mod+Alt+P` (`Cmd+Option+P` on Mac, `Ctrl+Alt+P` elsewhere; `Mod+Shift+P` is Logseq's own command palette).
2. The selected words become a `[[link]]` in their block, then the plugin opens the page with that name (creating it if needed). Trailing tags are left out of the page name. If the block changed in the meantime, or the selection contains brackets or line breaks, the page still opens and the text is left as it was.

The plugin has not been tested in a live Logseq instance here. Try it in a sample DB graph first; Logseq themes and releases can change rendered CSS selectors.

Page links keep their subtle underline without an icon; recognized block references use a bent arrow. Tag pages retain their native #. PDF file links use a document icon, and common image file links use a landscape icon. Dates, PDF citations, and embedded images are excluded. Asset-link icons depend on a recognizable file extension in the rendered URL.

Reference page labels omit appended tag names such as `#doctor`, including linked-reference headings and Recent/Favorites sidebar labels. The stored page title is resolved before shortening, preserving titles containing literal # characters and custom aliases. Tags on the original page are unchanged.

Linked non-page nodes use a small connected-node icon; explicit block references use a bent arrow. These links have no underline. Ordinary page links retain the subtle underline without a document icon. Classification excludes journal, tag, asset, and PDF annotation targets.

Version 0.2.30 extends the plain page rectangle to SVG file icons and left-sidebar navigation. Dates use a desaturated blue-gray tint.

Version 0.2.31 reduces the page rectangle to a compact 8:10 shape while preserving alignment.

Version 0.2.32 leaves date links in HTML tables and table/grid views unstyled; outline dates retain their subtle tint.

Version 0.2.35 uses a small northeast arrow for block references and removes their underline, including on hover.

Recognizes DB [[UUID]] references as well as ((UUID)). Standalone reference rows use a northeast-arrow bullet; inline references use an arrow before the link.

Version 0.2.35 limits reference arrows and underline removal to targets confirmed as child blocks in the database. UUID page links retain ordinary page styling.

Version 0.2.36 makes date text easier to read, writes the copied source reference as a DB `[[UUID]]` link, and fixes the block right-click menu (it now uses the block you clicked), keeps copied child blocks in their original order, makes Open selected text as page work from the command palette, replaces the browser pop-up for page titles with a small built-in box, moves that command's shortcut to `Mod+Alt+P`, and reduces background work while typing.

Version 0.2.37 shows a single arrow for a standalone block-reference row (the bullet) instead of two, removes underlines from page links inside a referenced block, and adds a settings panel for shortcuts and the sidebar tidy-up.

Version 0.2.38 strips underlines and inline arrows from all text inside a reference-only row, regardless of which element Logseq uses to draw the reference.

Version 0.2.39 adds three quiet, always-visible cues. A muted `↙ 3` after a block's text shows how many other blocks reference it (shown only when above zero; it is not hover-only). Sidebar and toolbar items named in the plugin settings (default: Flashcards, Graph view) become smaller and lighter but stay in place. Linked and Unlinked References headings and their counts become smaller and lighter, also in place.

Version 0.2.40 restores the faint underline on page links shown inside a block reference. The reference itself still has no underline, and a reference-only row still shows a single arrow.

Version 0.2.41 removes the underline from a block reference as a whole, while page links shown inside the reference keep their faint underline. It also fixes a long-standing rule the browser was silently discarding (a `:has()` nested inside another `:has()`), which had left inline references underlined.

Version 0.2.42 removes the incoming-reference count (`↙ 3`), removes every underline inside a block reference (the arrow is the cue, and links inside a reference are not clickable there), and stops fading the `#Task` side tag, so tags stay visible all the time.

Version 0.2.43 makes page links inside a block reference open their own page when clicked (Shift-click opens it in the right sidebar). Clicking anywhere else on the reference still opens the referenced block.

Version 0.2.44 restores the faint underline on page links inside a block reference, now that they can be clicked. Tags, dates, links to other blocks and plain text inside a reference stay without an underline.

Version 0.2.45 adds **Refinements: Copy styling details (troubleshooting)** to the bullet right-click menu. It lists how Logseq built that block (element names, classes, and whether each item is underlined), with text shortened to a few words, so styling problems can be fixed precisely. It changes nothing.

Version 0.2.46 styles block references as soon as Logseq draws them, so a reference-only row shows the arrow bullet immediately instead of first flashing a regular bullet. References are recognised from the rendered page (a block reference contains the block's title area; a page link never does) rather than from a delayed database lookup.

Version 0.2.47 returns the Linked and Unlinked References headings to Logseq's original style.

Version 0.2.48 keeps page links and tags readable inside highlights: they take the highlight's own text color instead of the theme's main text color (which made them white on yellow in dark mode).

Version 0.2.49 restores the quotation-mark bullet on blocks that cite a PDF highlight. Since 0.2.46 those rows were also given the reference-arrow bullet, which distorted the quotation mark.

Version 0.2.50 makes the page-link underline firmer inside highlights (55% instead of 24% of the text color, still 1px), so links stay recognizable on a highlight's light background.

Version 0.2.51 marks page links inside highlights with a muted steel blue (#2f5d8a, at least 5.2:1 on every light highlight color) instead of a firmer underline. The underline returns to its usual faint strength.

Version 0.2.52 fixes three bugs. Copy block and children to new page now names the page with the titles of any links in the block, instead of their hidden IDs. Link selected text to a page now works in blocks that already contain links, instead of saying the block changed. New page titles drop every trailing tag ("Meeting #work #urgent" becomes "Meeting"), not just the last one.

Version 0.2.53 makes Open selected text as page also turn the selected words into a `[[link]]` in their block before opening the page.

Version 0.2.54 tidies Logseq's search window (compact rows, quiet headings, bold matches) and adds **Refinements: Search in right sidebar** (`Mod+Alt+F`), which keeps search open in the right sidebar while you open results.

Version 0.2.55 hides `[[ ]]`, `**`, `__`, `~~`, `^^`, `==` and backtick markup in search results and their paths, returns the search window to Logseq's normal width, and makes Search in right sidebar send its key press from the search box itself, which should let it move into the sidebar.

Version 0.2.56 shows search markup again, faded instead of hidden.

Version 0.2.57 adds a **Search** button at the top of the right sidebar, hides the sidebar's Page graph button, and should fix Search in right sidebar stopping with an error (it no longer waits for Logseq to confirm that search opened). If it still fails, its message now says which step stopped.

Version 0.2.58 marks property values in Linked references. A bullet that is really the value of a property starts with the property's name in muted text, like "Doctor: Pashtoon Kasi", so it no longer looks like an ordinary block. When Logseq puts a lone property name as the grey line above a group of references (it sometimes lands above ordinary blocks), that line is hidden. Embedded blocks, embedded pages and query results get a faint line on their left and a tiny "embedded block", "embedded page" or "query" label in their top corner. In Linked references, the page names that head each group are semi-bold without an underline, so they read as headings. The [[ ]] brackets in grey paths (like "[[Oct 6th, 2026]]") are faded, as in search.

Version 0.2.59 removes the small "embedded block", "embedded page" and "query" labels. Embeds and query results keep only the faint line on their left.

Version 0.2.60 names the linking property for records listed under the tag tabs below a page's properties (the list that bidirectional properties create). Each record ends with muted text such as "via Diagnosis", so you can see which of your properties points it at this page. When several of your properties do, they are listed together ("via Diagnosis, Ruled out"). Built-in links such as tags and aliases are not shown, and Linked references are unchanged.

Version 0.2.61 adds **Refinements: Check linked-record labels (troubleshooting)** to the command palette. Run it on a page with the tabbed list. It reports what the database says links to the page, which "via" labels the plugin would show, and how Logseq draws those records on screen, so the labels can be aimed correctly. It changes nothing.

Version 0.2.62 moves the "via Diagnosis" label from the row's far edge to right after the record's title, on the same text line.

Version 0.2.63 keeps the page title's hover-only actions (such as **Add tag property** and **Set property**) and the page's tags visible all the time, muted, and full strength when you point at them. Only clickable items with words are shown, so the collapse arrow keeps its normal behavior. Turn this off with **Always show page title actions and tags** in the plugin settings. If something doesn't appear, run **Refinements: Copy page title area details (troubleshooting)** on that page and send the result.

Version 0.2.64 leaves hover previews and other pop-ups exactly as Logseq draws them. The plugin used to adjust labels, bullets and cues inside a preview as it opened, which could make Logseq close it on the first hover. Logseq still does this occasionally on its own, but the plugin no longer adds to it. Inside previews, links, dates and bullets now look like plain Logseq.

Version 0.2.65 returns the plugin's styling to hover previews (undoing 0.2.64). Logseq sometimes closes a preview on the first hover by itself; the plugin's styling can make that a little more frequent until Logseq fixes it.

Version 0.2.66 lets each list choose which properties it shows. Logseq's tables have a column picker; its List view shows every property. Right-click the bullet of any record in a query (or in a list on a page, such as a tag page) and choose **Refinements: Choose properties shown in this list**, or click in the list and run the same command from the command palette. Tick the properties to show and press **Save**; **Show all** returns to Logseq's normal view. Each query remembers its own choice; lists on a page share one choice for that page. Unticked properties are only hidden on screen, in that list; nothing in your notes changes, and Linked references are not affected.

Version 0.2.67 fixes the property picker. Its tick boxes are now drawn by the plugin (Logseq's styling had made the browser's checkboxes unusable), and click or Space toggles them. The list offers only your own properties plus Alias, Description, Status, Priority, Deadline and Scheduled; Logseq's internal ones such as "Node created at" are no longer listed. Unticking everything now hides every property instead of showing them all.

Version 0.2.68 fills dates from journal days. A record tagged #Occurrence or #Results, or any tag that extends them (such as #Imaging), gets its empty **Date** set to the journal day it was written on, so it sorts correctly in queries and tables. For a block, that is the journal page it sits on; for a page made from a journal block, the journal it sits under; for a page created with `[[Name]]#Tag`, the earliest journal that links to it. A date you entered yourself is never changed. New records are filled as you write them. For records made earlier, run **Refinements: Fill missing dates from journal days**, which says how many it found and asks before filling. The tags, the property name, and the automatic filling can be changed under **Journal day as date** in the plugin settings.

Version 0.2.69 extends journal-day dates to any tag that has the **Date** property among its tag properties, including tags you create later, plus every tag that extends one of them. A new tag needs no setup beyond giving it a Date property. Tags named under **Also these tags** in the settings (default: Occurrence, Results) are still covered too. Turn off **Any tag with the date property** to limit filling to the named tags.

Version 0.2.70 removes the "any tag with the date property" option added in 0.2.69. Dates are filled only for the tags listed under **Journal day as date → Tags** in the settings (default: Occurrence, Results) and tags that extend them. To cover a new tag, add its name to that list.

Version 0.2.71 follows a review against Logseq's current plugin API and DB schema (logseq/logseq master, October 2026). Three fixes: (1) Logseq keeps only the last clean-up callback a plugin registers, so the plugin now registers one that runs every part's clean-up when it is turned off or reloaded; before, only one part cleaned up after itself. (2) Query results name built-in fields without their `block/` prefix, so **Alias** was missing from the property picker; it is now offered. (3) Links to pages that sit under another page and carry only their own tag (for example a record page made from a journal block) could be styled as block references; pages are now recognized by their page name, which every page has and no block has.

Version 0.2.72 fixes the property picker leaving values behind. A hidden property's value is now hidden with its name, whether Logseq draws the two as one row or as side-by-side cells (before, the value stayed and could squeeze into the name's column). The picker also has a **Body** option, last in the list, for the notes and files under each record; untick it to show only the record's title and chosen properties. A list saved with an earlier version hides the body until you tick Body.

Version 0.2.73 removes the faint line beside query results. Embedded blocks and pages keep it.

Version 0.2.74 fixes text disappearing when you click a record in a query that hides some properties. A record you are editing is now left exactly as Logseq draws it; the hiding resumes when you click away.

Version 0.2.75 fixes hidden properties leaving their bullet and value behind in lists. Property names have bullets of their own, which the plugin had treated like the record's own bullet, so it stopped short; now only the record's first bullet and title are left alone.

Version 0.2.76 adds a **Visual hierarchy** group to the settings, which applies without a reload. **Faint nesting lines** (on) makes the lines beside nested blocks fainter and the line beside the branch you point at or type in a little stronger. **Muted property names** (on) shows property names small and muted so a block's own words lead, with values at full strength. **Soft background behind tags** (off) puts a faint violet chip behind tags. The previous version is saved in `backups/logseq-db-refinements-0.2.75` in the project folder.

Version 0.2.77 adds a small muted word under the title of special pages: “Tag” on a tag page (such as #Task) and “Property” on a property page (such as Status). Ordinary pages and journal pages get nothing extra. Turn it off with **Label tag and property pages** under Pages in the settings; this applies right away.

Version 0.2.78 adds **timelines**: a list built from your records that shows only the properties you choose, grouped by month and day. In any block, type `/Timeline` and pick it, or type this yourself:

`{{renderer :timeline, tags: Occurrence, Results; show: Diagnosis, Notes, Impression}}`

- **tags**: which records to include. Tags that extend them (such as #Imaging under #Occurrence) are included too. Type the names without `#`, so Logseq doesn't tag the block itself.
- **show**: the properties to show after each record's title, in this order. Values that are pages stay clickable.
- Optional: `date: Date` (which property holds the day; default Date; records without one use the journal they were written on), `order: newest` (newest first; default oldest first), `labels: off` (hide the small property names).

Each record is one line: its tag's icon, its title, then the chosen values. Click a title or date to open it. Click **Edit** at the top to change the settings. The timeline updates as you edit your records. It only reads your notes; nothing is changed. The previous version is saved in `backups/logseq-db-refinements-0.2.77` in the project folder.

Version 0.2.79 adds a **one-line layout** to your own queries, so a live query can read like a timeline. Right-click the bullet of any record in the query and choose **Refinements: Choose properties shown in this list**. Tick the properties you want (for example Diagnosis, Notes, Impression), untick **Body** if you don't want the notes underneath, and tick **One line per record (timeline layout)**. Each record then shows as its title followed by those values on the same line (`Liver Biopsy: Diagnosis Malignant Neoplasm · Notes Origin unknown…`), and the other property rows are hidden. It is still Logseq's query: its filters, sorting and live updates work as before. For date headings, use the query's **…** menu → **Group by** → **Date**. Clicking a record to edit it shows it in full until you click away.

Version 0.2.80 lets you open records in a list that hides some properties. Each record starts folded to the view you chose, with a small arrow after its title. Click the arrow to open that one record in full (all its properties and notes), and click again to fold it. To open or fold **every** record in the list at once, Alt-click (Option-click on Mac) any arrow, or right-click a record's bullet and choose **Refinements: Open or fold every record in this list** (also in the command palette). This only changes what you see; nothing in your notes changes.

Version 0.2.81 removes the arrows added in 0.2.80 (Logseq's own fold arrows already do this) and replaces "open or fold every record" with **Refinements: Fold all results** and **Refinements: Unfold all results**. Right-click the bullet of the query (or of any result) and pick one. They use Logseq's own fold, exactly as if you clicked each result's arrow. Logseq's built-in "Expand all" on a query only reaches the query block's own sub-blocks, not its results, which is why it seemed to do nothing. If you unticked **Body** in "Choose properties shown in this list", the notes under each result stay hidden either way; tick Body to fold and unfold them.

Version 0.2.82 keeps the property picker's ticks in step with the list. Two causes are fixed: (1) a record that appears in more than one place (in a query and on its own page, for example) could open the picker for a different list than the one you right-clicked; the picker now uses the copy you clicked; (2) right after Save, reopening the picker could show the previous choice while Logseq was still storing the new one; the new choice is now used immediately.

Version 0.2.83 is a clean-up with no visible changes. The code is about 150 lines shorter: leftovers from earlier versions (the 0.2.80 row arrows, clean-up for 0.2.39–0.2.41) are gone, and pieces that were written twice (dialog boxes, property-value lookups shared by one-line lists and the timeline, settings defaults) now exist once. Seven separate screen watchers became one shared watcher, so Logseq does less work after each change, and one part failing no longer stops the others. Every Logseq hook the plugin listens to is now switched off when the plugin is turned off or reloaded, as the plugin SDK recommends, and "Copy block and children to new page" copies all child blocks in one step (`insertBatchBlock`) instead of one at a time. The version shown in troubleshooting reports now comes from package.json.

Version 0.2.84 removes the separate timeline block from 0.2.78 (`{{renderer :timeline ...}}` and the `/Timeline` command). For a timeline, use a real query with **One line per record (timeline layout)** in "Choose properties shown in this list"; that stays. Any old `{{renderer :timeline ...}}` block left in your notes no longer draws anything and can be deleted.

Version 0.2.85 fixes **Fold all results** and **Unfold all results**. They now press each result's own fold arrow, exactly like clicking it, so results change all at once and no longer fold back by themselves a few seconds later. (Logseq remembers a query result's fold on screen, per list, and the old way only changed the saved state, which Logseq then reset.) Results that Logseq draws later, for example as you scroll a long query, get the same fold while the page stays open. If you fold or unfold one result by hand afterwards, it stays the way you set it. From the command palette, the commands now work without right-clicking first: they use the query you last clicked in, or the query on screen.

Version 0.2.86 fixes **Unfold all results** and **Fold all results** for results further down a long query. Logseq only draws the results near the screen and sets each one's fold a moment after drawing it, which undid the plugin's change. The plugin now checks again shortly after each result appears, so results get the chosen fold as you scroll. A result you fold or unfold yourself keeps your choice until you run a fold-all command again.

Version 0.2.87 fixes the cause found in Logseq's source code. Logseq draws a query result first and sets its fold a moment later, and that second step only changes an attribute on the result (`data-collapsed`). The plugin's screen watcher did not watch attributes, so results that appeared while scrolling were never corrected. While a fold-all choice is active, the plugin now watches that attribute too, and results take the chosen fold as they appear.

Version 0.2.88 lets the grey parent path above a result or reference use the space it has. Logseq caps each part of that path at about 28 characters and cuts the rest with "…", even when the line is mostly empty. On pages and in the sidebar the plugin removes that cap, so the path is cut only when it really runs out of room, and the last part gives way first.

Version 0.2.89 gives the date headings of a query grouped by date the same quiet date box as dates in your notes. Inside that box the date shows as plain text, without link colour or underline.

Version 0.2.90 extends **Muted property names** to the property list at the top of a page (Hospital, Date, Diagnosis and so on). The names and their icons are now a softer grey at the same size, like property names inside blocks; bullets and values are unchanged. Pointing at a name shows it at full strength again.

Version 0.2.91 drops the grey date box inside the small property capsules beside or below a block (like "Date: Oct 12th, 2026"). There the date is plain text in the normal text colour, white or black depending on the theme. Dates everywhere else keep their box.

Version 0.2.92 adds **Refinements: Copy fold log (troubleshooting)** to the command palette. After you run Fold or Unfold all results, the plugin notes each time a result folds or unfolds and what happened around it: scrolling, editing, page changes and database changes. The command shows that list so you can paste it into the chat. Nothing is sent anywhere.

Version 0.2.93 fixes results folding back after **Unfold all results**, found with your fold log. When Logseq folded a result again while you scrolled, the plugin sometimes pressed its arrow twice before the first press had finished. The second press undid the first, and after six presses the plugin gave up on that result. Now the plugin waits until a press has taken effect before pressing again, and only gives up on a result that does not respond at all. Property values inside blocks are also back to their normal size, so they no longer grow when you click to edit them.

Version 0.2.94 puts property names back to the normal text colour everywhere, in blocks and in the list at the top of a page. The **Muted property names** setting is removed.

Version 0.2.95 shows which page an alias belongs to. Logseq records an alias only on the original page, so an alias page itself gave no sign. Now a small grey line under its title says "Alias of …" and names the original page; click the name to open it (Shift-click opens it in the sidebar). If several pages list it as an alias, all are named. The original page is unchanged. Turn it off with **Show which page an alias belongs to**.

Version 0.2.96 adds an on/off switch in the plugin settings for each visual change that had none. They are all on by default and apply right away. Under **Visual hierarchy**: **Show what a block holds** (task circle bullets and file icons after a block), **Line beside embedded content**, **Dates in a soft grey box** and **Simpler page icons**. Under a new **Links and references** group: **Quiet page links**, **Icons for block references and files**, **Show how records are linked** ("Doctor: …" in Linked references and "via Diagnosis" under tag tabs), **Tidy parent paths** and **Compact PDF citations**. **Tidy the right sidebar** now also covers the flat sidebar panels.

Version 0.2.97 gives the plugin one visual scale and three placement rules, and makes properties plainer.

- **One scale.** Every muted label, icon, underline and line now uses one of a few shared values (two levels of muted, one small size, one line strength) instead of the ten opacities and nine sizes that had built up. Dates take their box from the theme's own text colour, so they follow custom themes; the separate dark-mode colours are gone.
- **Where a cue goes.** The bullet says what a row is. A mark before a link says what it points to. Anything after the text says what the block holds or how it is connected. To fit that, the unfinished-tasks cue moved out of the bullet: a block with unfinished tasks below now ends with `↳`, a dashed circle and the count, next to the file icons.
- **Plainer properties.** Properties under a block read as `name: value · name: value` with the value a little firmer, without the capsule outline. In a property list, the second bullet beside each value is gone. Turn off with **Plainer properties**.
- "via …" labels no longer appear on a page's own blocks, only on records listed from elsewhere.
- The plugin now starts from `loader.js`, which loads `main.js` fresh each time. Logseq otherwise keeps the old script when you press **Reload**, which is why earlier versions had to be removed and added again.
- A link to a block now starts with a small dot, like a bullet, and its words sit on a light dashed line with wide gaps; page links keep their solid underline. A row that is only a link to a block looks the same, after the row's own bullet: the small dot, then the dashed text. The arrow is no longer used.
- Links to PDFs and images show their words in normal text with the same faint underline as a page link; only the icon in front is blue.
- On the page of a tag that extends another tag, a small line under the title lists the properties it inherits and from which tag (“Inherited from #Media: keywords, rating, website”). Logseq's own list there shows only the tag's own properties. Turn off with **Show inherited properties on tag pages**.
- A `[[link]]` to a tag's own page looks like a page link, with the name underlined, but its icon is grey where a page's icon is in the full text colour. The icon is the tag's own, or a `#` when it has none, so the two can be told apart whatever icon you choose. A `#tag` stays bold with no underline.
- A page's tags now sit just above its title, beside the actions, instead of at the far right edge. They are Logseq's own tags moved into place, so their `#` still opens the tag menu. A page with no tag of its own shows `#Page` there. The small “Tag”/“Property” word under the title is gone.
- Clicking `#Page` above the title of an untagged page opens Logseq's own “Set Tags” list for that page.
- The triangle left of a page title, which shows or hides the page's properties, is always visible (muted until you point at the title). Pressing `#Page` a second time closes the tag list.
- **Refinements: Add tags to this page** (`Mod+T`, changeable in the plugin settings) opens Logseq's Set Tags list for the page you are on.

Version 0.2.98 puts property lists back to Logseq's own look and tidies three cues.

- **Property lists as Logseq draws them.** Every value in a property list has its bullet again, and values are back at normal weight, so “Add description” is no longer bold. Hiding the bullet had left some values with one and others without. **Plainer properties** now only covers the properties under a block (`name: value · name: value`).
- **Dates.** A date no longer picks up the dot and dashed line of a link to a block. A date with a time keeps the space between them (“Dec 31st, 2024 18:00”). In a property list the date keeps its grey box but takes the weight of the values around it.
- **Inherited properties.** The “Inherited from #Media: …” line now closes the tag's own “Tag Properties” list, under **Add property**, so it shows only while the title's triangle has the properties open. It arrives with the list instead of a moment later, and no longer flashes on the next page when you leave a tag page. The “Alias of …” line no longer flashes there either.
- **The link that points here.** Under Linked references, the link to the page you are on sits in a very light grey box, so it can be found among a block's other links. Turn off with **Mark the link to this page in Linked references**.

Version 0.2.99 fixes switches that did not switch off. Turning off **Faint nesting lines** (with the tag background off) left the lines faint until the plugin was reloaded, and the dot before labelled block links and the “Doctor: …” / “via …” labels could stay after their settings were turned off. Logseq ignores an empty stylesheet, so the old rules were never replaced; the plugin now sends a one-line placeholder instead. Found by the audit recorded in `AUDIT.md` (A1). The version before the audit's fixes is saved in `backups/logseq-db-refinements-0.2.98`.

Version 0.2.100 fixes two cases of one page's details showing on another. (1) After leaving a page whose lists hide some properties or the Body, the next page's blocks could briefly lose their properties or the notes under them; the choice of the page you left is now dropped the moment you navigate, and the new page's own choice applies once its details have loaded. (2) The “Alias of …” line could stay missing after quick navigation, because an older page lookup could finish after a newer one and replace it; only the newest lookup's answer is used now. Audit items A2 and A3 in `AUDIT.md`.

Version 0.2.101 makes Reload safe when the previous copy did not finish cleaning up. The plugin's screen watchers live in Logseq's window, so if a reload was cut short (an error, or Logseq's ten-second limit) the old copy kept running beside the new one, which could double the Search button, cues and labels. A new copy now stops any earlier copy first and removes whatever it left on screen. The marks that hide a lone property name above a group of references are also removed when the plugin is turned off; before, that line could stay hidden until Logseq redrew it. No change when a reload goes normally. Audit items A4 and A5 in `AUDIT.md`.

Version 0.2.102 adds a measuring tool for troubleshooting. It is off unless you turn it on, and it changes nothing on screen. Run **Refinements: Turn measuring on or off (troubleshooting)**, use Logseq for a while, then run **Refinements: Copy performance report (troubleshooting)**. The report lists how often each of the plugin's screen watchers was called and for what, how long each update took, how large the per-block stylesheet is, whether the shared watcher's passes landed in time or a frame late, and the long tasks, long frames and layout shifts the browser recorded. Each report covers the time since the previous one, and is also saved as `perfReport` in the plugin's settings file. It is one marked block in `main.js` (PERF-DEBUG) and can be removed once the audit's remaining steps are done. Step 4 in `AUDIT.md`.

Version 0.2.103 lets the measuring tool from 0.2.102 report by itself. With the hidden setting `debugPerfEvery` (a number of seconds) next to `debugPerf` in the plugin's settings file, a report is added to `perfLog` in that file at that interval, so a session can be measured without running the command each time. The tool's own settings writes no longer set off the plugin's settings work. Nothing changes unless measuring is on. The first results, from the test graph, are in `AUDIT.md`.

Version 0.2.104 does less work on every screen change, with no visible difference. The scan that draws the `↳` cues used to search inside every block on the page before checking whether that block has a cue at all; it now checks first, and stops at once on a page with no cues. A date link that is already marked is no longer marked again on every pass. Step 5 in `AUDIT.md` (part of B2).

Version 0.2.105 replaces the stylesheet that grew with your graph. To put a dot before a labelled link to a block, and the “Doctor: …” and “via …” labels on references, the plugin used to write four style rules for every referenced block in the whole graph (about 1.7 KB each) and re-send them when they changed. It now marks the links and rows that are actually on screen, as Logseq draws them, and one fixed set of rules does the drawing. On the test graph the stylesheet went from 4,000 to 8,000 characters, depending on the page, to a constant 2,700; in a large graph the old one would have run to megabytes. Every link, label and cue on eight test pages is drawn exactly as before (compared element by element). The “via …” labels of the page you left are also dropped the moment you navigate. Step 6 in `AUDIT.md` (B3).
