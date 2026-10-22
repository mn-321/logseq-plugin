# Design audit of what the plugin draws over the page (2026-10-22)

The owner's ask: "remove excess design and padding and make things inline instead of this big central popovers. This
isn't about a stylesheet, but a basic aspect of design." This file records what each piece measured before, what
Logseq's own equivalent measures, the verdict (keep, trim, make inline) and what it measures after.

## How it was measured

Access to the running Logseq was declined for this session, so the pieces were not measured in the app itself.
Instead every piece was rendered in headless Chromium (Playwright, the same engine Logseq's Electron runs on) with
the plugin's exact stylesheets, pulled from the parts' own source (`dialogCss` in `parts/shared.js`, `twoWayCss`,
the tag map's, the link box's, the proposals' and the settings window's), and the markup the code builds, at
Logseq's 16 px page text. The script is kept outside the repo (the session's scratchpad, `measure.js`); its numbers
are below. Logseq's own sizes are the ones measured in the app earlier (0.4.144 and 0.4.284): a property row 28 px
tall with a 150 px name column and a 12 px gap, the values starting 170 px in; a capsule 24 px tall with 14 px text;
its "Set Topic" text box 32 px tall, 14 px text on a 20 px line, 6 px padding. What was not measured against Logseq:
its own pop-up menus and dialogs, whose sizes come from utility classes in its compiled code and could not be read
from the bundle. Everything here should be checked once in the app; the checks to make are at the end.

## The pieces

### The two-way rows (`.refinement-two-way`, `parts/two-way.js`)

| | before | Logseq's row | after |
|---|---|---|---|
| the box | a 3 % grey band, padding 4.8 / 14.4 / 4.8 / 8 px, margin 2.4 / 0 / 9.6 / −8 px | no band: rows on the page | no band, no padding, margin 2.4 / 0 / 8 / 0 |
| a plain row | 28 px | 28 px | 28 px |
| name column, values' left edge | 150 px, 170 px | 150 px, 170 px | 150 px, 170 px |
| a line in an open list | 25 px; "earlier" 19.7 px at 13.1 px text | | unchanged |

**Verdict: trim.** The rows already sit exactly on Logseq's own grid (28 px rows, the values at 170 px). The only
thing that was not Logseq's was the grey band around them with its own padding and a negative margin: a box around
rows that are meant to read as more property rows. The band goes; the rows sit on the page as Logseq's do.
Nothing else moves: the name column, the values' edge and the row heights are unchanged, and the picking boxes and
the bar keep their places relative to the rows.

### The hover card (`.refinement-two-way-peek`)

| | before | after |
|---|---|---|
| padding | 8 / 10 px | 6 / 8 px |
| title, text | 14 px on 19.6 px | unchanged |
| the gaps between its parts | 6 px | 4 px |

**Verdict: keep, trim a little.** It is already beside what it is about (under the pointer) and modest (238 × 153 px
with two properties and two lines).

### The + box (`.refinement-two-way-add`)

| | before | after |
|---|---|---|
| width, padding, gap | 340 px, 10 px, 8 px | 300 px, 6 px, 6 px |
| the text box | 31.6 px, with stray 4 px margins from the kit | 31.6 px, no margins |
| the kind buttons | 24 px pills | unchanged |
| Add, Add and open | 29.6 px | 27.6 px (the kit) |

**Verdict: keep as a pop-up beside the +, trim.** It opens at the + it belongs to; that is inline enough. Its own
padding and the kit's text-box margins added up to 14 px of edge on each side.

### The questions behind the picking bar (`ask` and `sure` in `parts/two-way.js`: Change “…” to…, Add a tag, Set or Clear a property, Delete)

| | before | after |
|---|---|---|
| where | a 460 px box in the middle of the window, 144 px from the top, over a darkened page | a 400 px box right under the button pressed, nothing darkened (133.6 px tall instead of 155.6) |
| padding | 16 / 18 / 14 px | 8 / 10 px |
| the label, the text box, the hint, the buttons | 19.6 + 31.6 + 16.8 + 29.6 px, with 8, 2, 6 and 10 px between | the same pieces, 6 px apart |

**Verdict: make inline.** A question about the picked records belongs beside the bar that asked it, like the + box
beside its +. `shared.modal` takes an anchor now (0.4.285) and draws the box there without a backdrop.

### The tag map's three plans (Merge, Make a child tag, Turn into links, `parts/tags.js`)

| | before | after |
|---|---|---|
| where | a 460 px box in the middle, over a darkened page | a 440 px box under the row or menu that opened it (the merge plan 168 px tall instead of 198) |
| padding | 16 / 18 / 14 px | 8 / 10 px |
| heading | 16 px, 10 px under | 14 px bold, 6 px under |
| the list and the note | 12 px under each | 8 px |

**Verdict: make inline.** Each plan is about one tag or property on the map; it opens beside its row.

### The tag map's small pop-ups (menus, rename, choices, description, pick a tag)

| | before | Logseq's menu | after |
|---|---|---|---|
| the pop-up's padding | 4 px | 4 px (its menus) | 4 px |
| a heading | 26.8 px (12 px text, 4 / 8 / 6 px) | | 23 px (3 / 8 px) |
| a menu row | 31.6 px (6 / 10 px) | about 32 px | 31.6 px, 6 / 8 px |
| a note | 12 px text, 5 / 10 px | | 4 / 8 px |
| the text box | 31.6 px | 32 px | 31.6 px |

**Verdict: keep; trim the heading and the side padding.** They open beside their rows already and their rows are
Logseq's own height.

### The dialog kit (`.rf-dialog`, `shared.modal`) for what still has nowhere to sit beside (the troubleshooting box)

| | before | after |
|---|---|---|
| width | 460 px | 420 px |
| padding | 16 / 18 / 14 px | 12 / 14 px |
| from the top of the window, the backdrop | 16 vh, 25 % black | 12 vh, 18 % |
| heading, paragraphs | 16 px, 10 and 12 px under | 15 px, 8 px under |
| buttons | 29.6 px (4 / 12 px) | 27.6 px (3 / 10 px) |

**Verdict: trim.** Only the troubleshooting tools use the central box now.

### The link box (`parts/link-text.js`, Cmd+Option+L)

| | before | Logseq's "Set Topic" box | after |
|---|---|---|---|
| width | 520 px | | 420 px |
| the heading | 26.8 px | none (the list has no heading) | 23 px |
| the field | 33.5 px, 15 px text | 32 px, 14 px text, 6 px padding | 31.6 px, 14 px text |
| a row | 31.8 px | | 31.6 px |

**Verdict: trim.** The field was a size larger than Logseq's own text box for a value; it is the same size now, and the
box is narrower. It is already beside the words it is about.

### The settings window (`parts/settings-panel.js`)

| | before | after |
|---|---|---|
| the window | 840 × 660 px, 7 vh from the top | 800 × 640 px |
| header | 60 px (12 / 14 / 12 / 20 px) | 48 px (8 / 12 px) |
| the side list | 200 px wide, rows 33 px | 180 px, rows 30 px |
| the body's padding | 4 / 24 / 24 px | 4 / 16 / 16 px |
| a setting's row | 64 px (11 px padding, 20 px gap) | 58 px (8 px, 16 px) |
| footer | 50 px | 42 px |

**Verdict: keep central, trim.** The settings are not about any one thing on the page, so a window is right; its
edges and rows were wider than Logseq's own settings.

### Inline pieces that stay as they are

- The proposals' grey values (`.rfs-ghost`): drawn inside Logseq's own capsule, 14 px like the capsule's text; nothing
  of the plugin's around them. The ring on the property Option-Enter is on: inside the capsule. **Keep.**
- The Undo arrow (`.rf-undo`): 13.8 px wide at the end of the line, no box; docked at the bottom right only when it
  has nothing to sit beside. **Keep.**
- The picking bar (`.rf-tw-bar`): a strip of buttons just above the rows, floating so nothing moves. **Keep.**

## What to check in the app once it can be driven

1. Dr. Mei Chen: the rows with no band; the words under them where they were (no jump on reopening).
2. The Consultation tag page: the same.
3. Tick two records, press Change “Dr. Mei Chen” to…: the question opens under the button; Escape closes it.
4. The tag map, a tag's menu, Merge into…: pick a target; the plan opens under the row.
5. Cmd+Option+L on a selected word: the box is 420 px wide, the field the height of Logseq's own.
6. The settings window: narrower edges, the same content.
7. Dark mode for 3 to 6.
