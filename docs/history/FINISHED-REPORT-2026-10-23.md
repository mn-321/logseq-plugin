> **Record, not a plan.** Written 2026-10-23 at 0.4.359 as `docs/FINISHED-REPORT.md`, the plain report to the owner at the end of the finishing push; moved here 2026-10-24. The plugin went on changing at the owner's word from 0.4.360; the current state is `docs/STATE.md`.

# The plugin is finished: what I did

The plugin is now at version 0.4.359. Reload it once in Logseq to see everything below. All of it was tried in the
Illness Test Graph, and every test change was undone afterwards.

## 1. I built tests that watch the screen

Before changing anything, I made tests that open pages and watch for anything that jumps or flickers.

- They open the same pages twice, once with the plugin off and once with it on. Anything that moves only with the
  plugin on counts as the plugin's fault.
- They run in light and dark mode.
- They run in a pretend Logseq window, and also in your real Logseq app.
- I also made "stress" tests. They type fast, undo many times, reload the plugin 20 times, switch themes, open the
  sidebar, and use a tag map with 600 tags. Then they check that nothing breaks, slows down or gets left behind.

## 2. I fixed what the tests found

**The tag map**
- It used to jump a little while opening. Now it opens still.
- Undo of an older move used to put back more than that one move. Now it puts back only the tag you moved.
- Renaming a tag redrew the map twice. Now it redraws once.
- On a very big map, the find box now waits until you stop typing, so typing stays smooth.
- "Turn into links" used to link nodes to pages sitting in Logseq's Recycle. Now it brings those pages back first,
  and puts them back in the Recycle if you press Undo.

**Writing a bullet**
- The plugin drew its own ring round a property when the keyboard was on it. Logseq already shows one, so the
  plugin's ring is gone.

**Reading a page**
- Logseq cuts a long property name short, like "Therapy reg…". Now, when you point at the cut name, it shows in full.

## 3. I brought back the "getting around" pieces, one at a time

Each piece was rebuilt on the plugin's one shared look and checked in the app before the next.

- **Above a page's title:** "Add icon" and "Set property" no longer pop up when you point at the title. Their space
  stays, so nothing on the page moves. Try it on Dr. Mei Chen.
- **Left sidebar:** Flashcards and Graph view are a little smaller and greyer. Favorites and Recent no longer show
  Logseq's plain page icon, and the names still line up. A tag still shows its #.
- **Right sidebar:** the Page graph and the "(Dev)" tabs are gone from its top. Contents and Help stay.
- **Typing `[[`:** the list of date words (Today, Tomorrow…) no longer pops up at once. The page list appears as
  soon as you type a letter.
- **Search:** the window is roomier, the matching words are bold instead of yellow, and the `[[ ]]` round links is
  faint, so the words stand out. Logseq's own results, order and keys are unchanged. Try typing "nausea".
- **Two writing helpers came back:**
  - "New bullet at the outermost level" is in the command palette. It has no keys of its own, because Option-Enter
    now belongs to the proposals.
  - Typing a date year first, like `[[2026 10 14`, turns into `[[Oct 14th, 2026`, so Logseq offers that day's page.

## 4. I decided what to leave out

Your rule: when Logseq already does something, Logseq's way wins. So these old pieces are gone:

- **Make a page from this block:** in Logseq, tag the bullet #Page.
- **Open selected text as page:** select the words and type `[[`.
- **Add tags to this page:** use the page's Tags property.
- **Delete this block:** press Escape, then Backspace.
- **Fold all results in a query, and choosing a query's columns:** Logseq's query tables already have sort, filter,
  columns and a list view. Have a look at "Care overview".
- **The extra search features** (more words on each result, regrouped results, a preview panel, typed codes, a sidebar
  Search button): each added to Logseq's own list. Logseq's Cmd-Enter already keeps search open in the sidebar.

## 5. I finished the old "looks"

The old file of looks was mixed and out of date. I went through it rule by rule, then deleted it. Four looks came
back:

- "+ Add property" under a page's properties shows only when you point at them. Its space stays.
- A property with no value yet is faint, not hidden. In the Illness Test Graph the proposals already handle this, so
  there you won't see a change.
- The small pencil after a date is gone. A click on the date still opens the date picker.
- The line beside nested bullets gets a little darker under the pointer. Try it on Jul 3rd, 2026.

Everything else in the old file was dropped, with the reason for each written down.

## 6. I decided the two separate tools

- **Document export:** it stays switched off. It needs the clipboard, which I'm not allowed to use, and you switched
  it off twice yourself.
- **Todos:** it stays switched off. Logseq's own Task page already lists all 21 tasks in the test graph, with status,
  priority and dates.

## 7. What still rests, and why

- **The tag summary box and the line above the title:** you said no to both.
- **`p::` typing:** you said no.
- **PDF quotes and file icons:** the test graph has no PDFs or files to try them on.
- **The search extras, the export and Todos:** see sections 4 and 6.

## 8. Tidying up

- I cleared out 14 old branches on GitHub that were already merged.
- I updated the README, the guide, the change list, the logbook and CLAUDE.md.
- I rebuilt the elements page and the views page from the code, and put them back at their links.
- I added a "Finished" section to the feature map page.
- Every version is tagged on GitHub with its zip. I downloaded the last zip and started the plugin from it in a test
  window, and it ran cleanly.

## 9. What I couldn't test

- Anything that copies to the clipboard, such as the Copy buttons in troubleshooting.
- Switching to another graph.
- The tour.
- Installing from GitHub on a second real computer.
- Giving "New bullet at the outermost level" keys of its own.
- The roomy search window on a small screen.

## 10. If something looks wrong

- Reload the plugin: Plugins (`t p`), then Reload.
- If nothing of the plugin shows, open its settings and turn off **Foundation only** (under Troubleshooting).
- Each new look in sections 3 and 5 has its own switch in the plugin’s settings, so you can turn any one off.
- Each decision and how to undo it is in `docs/DECISIONS-AUTONOMOUS.md`.
