# The finish line

From `docs/FINISHING-PROMPT.md` section 1. The plugin is finished when every line is ticked. Each tick names the version
at which it became true and one line of proof. Updated with every commit that moves a line.

## A. The tests, all green, every commit

- [ ] `sh tools/check.sh` green with nothing skipped. *(green and nothing skipped at 0.4.345 untouched, 2026-10-23; to be
      ticked at the end, when it holds for the last version)*
- [ ] The frame tests exist, run inside check.sh and are green on every tour stop, light and dark, in Chromium and in the
      real Logseq. *(0.4.346: `tools/frames.js` in check.sh, `tools/app-frames.js` in the loop; two plugin problems found
      on the tag map page, fixed at 0.4.347: every stop clean in the app, light and dark)*
- [x] The stress tests exist, run from `sh tools/stress.sh`, and are green. *(0.4.351: every part green on its last code;
      the real app's pages, typing, undo depth, theme/sidebar/widths, reloads and dark pop-ups; the map on 600 tags)*
- [ ] `tools/leaning-test.js` reports 0 for every count, with every loaded part, including those brought back.
- [ ] `tools/parts-apart-test.js` passes with every loaded part, including those brought back.
- [x] Twenty reloads of the plugin in the real app leave one of everything. *(0.4.351, `tools/app-stress.js reloads`: 20
      of 20 took effect; marks, stylesheets, clean-up steps, watchers and hooks on five pages as after a cold start)*
- [ ] `node tools/graph-check.js compare` says the Illness Test Graph is as it was, after the whole of the work.

## B. The layers

- [ ] Layer 4 complete: every resting "getting around" piece brought back on the kit and proved, or left resting with its
      reason written down.
- [ ] Layer 5 complete: `parts/styles.js` emptied and deleted, every rule placed or dropped with its reason.
- [ ] Layer 6 decided for `rich-copy.js` and `todos.js`, each decision written down.
- [ ] `RESTING_FILES` holds only parts decided to stay resting, each named in `docs/DECISIONS-AUTONOMOUS.md`.

## C. The loose ends

- [ ] The branch `claude/tag-tree-editable-22bf91` and the old `claude/project-thread-*` branches settled.
- [x] Turn into links no longer counts a page in Logseq's Recycle as there. *(0.4.349; seen in the app: Location twice
      in a row, the recycled address pages brought back and put back)*
- [x] "Reload plugin" with Foundation only on works five times of five, or the cause is found and written down.
      *(0.4.351: on and off five times through Logseq's own reload, 10 of 10 took effect, the two-way rows gone and back
      each time; the earlier failures were with the Plugins panel's button by hand, not reproduced)*
- [ ] A long property name cut short by Logseq's narrow column ("Therapy regimen") handled, moving nothing.
- [x] The ring: the plugin draws no ring of its own anywhere; Logseq's stays. *(0.4.352: the proposals' three rules taken
      out; seen in the app, Option-Enter and Tab showing Logseq's own list and calendar; the kit keeps a keyboard-focus
      outline on the plugin's own buttons, which is no ring on Logseq's)*
- [x] The tag map's speed limits gate on the Mac's load. *(0.4.350: `tools/quiet.js`; on a busy Mac a time over its limit
      fails only when 25% slower than the committed version timed in the same run; seen passing at load 2.3 and failing
      the old version's renames)*

## D. The documents and the release

- [ ] CHANGELOG, LOGBOOK, CLAUDE.md's State line and section 7, README current at the last version.
- [ ] `docs/ELEMENTS.html` and `docs/VIEWS.html` rebuilt and republished.
- [ ] The feature map page updated.
- [ ] Every version commit tagged and pushed; the last tag's GitHub Release carries its zip.
- [ ] `docs/FINISHED-REPORT.md` written.
