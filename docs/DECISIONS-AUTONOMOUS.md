# Decisions made without the owner

From 2026-10-23, while finishing the plugin alone (`docs/FINISHING-PROMPT.md` section 2). One entry each: the question,
what was chosen, the alternative, and how to flip it. Newest last.

## 1. Logseq restarted with its debugging port (2026-10-23, 05:00)

**Question:** the frame tests need Logseq reachable over its debugging port; it was not. **Chosen:** Logseq quit and
reopened once with `--remote-debugging-port=9222`, at the owner's word in the session ("you can take over screen
anytime"). **Alternative:** wait for the Mac to be idle two minutes. **Flip:** quit and reopen Logseq normally; the
plugin does not need the port, only the tests do.

## 2. A page opening counts as no input in the frame tests (2026-10-23)

**Question:** section 3.2 of the prompt makes a route change an input, so nothing moving in the 500 ms after it would be
counted. **Chosen:** a route change is not an input there (stricter): the jumps the owner sees happen in exactly those
500 ms while a page opens. Whose a move is comes from comparing with the plugin off. **Alternative:** the prompt's words,
which would let the first half second through unchecked. **Flip:** `input('route …', true)` in `tools/app-frames.js`.

## 3. Whose a move is (2026-10-23)

**Question:** with the plugin off Logseq's own blocks move too; when is a move the plugin's? **Chosen** (written in the
header of `tools/frame-kit.js`): a move of Logseq's element is Logseq's when the plugin-off run has the same element
moving the same way by as much or more (the plugin may make Logseq's move smaller, as on Tingling fingers: 243 px off,
80 px on, never larger); a move of the plugin's own element is Logseq's only when it was pushed, in the same frame and by
the same amount, by Logseq's own content above it growing, and the plugin-off run has that growth. Everything else is the
plugin's. **Alternative:** "about the same size" (the first version), which called the smaller move the plugin's.
**Flip:** `matches` and `pushedByLogseq` in `tools/frame-kit.js`.

## 4. Each piece timed from what it sits in (2026-10-23)

**Question:** the prompt times the kind icons "with the title, 50 ms"; Logseq itself draws the property rows they sit in
about 120 ms after the title, so no plugin could meet it. **Chosen:** the tag chain and the two-way rows from the title;
a kind icon from Logseq's own property button it sits in (measured: 0 ms). **Alternative:** the prompt's words, red for
ever. **Flip:** the `from` argument of `piece()` in `tools/app-frames.js`.

## 5. The real-app frame test outside check.sh (2026-10-23)

**Question:** "the frame tests run inside check.sh". The real-app one drives Logseq for about ten minutes and must not run
while the owner works in it, and check.sh runs on every commit. **Chosen:** `tools/frames.js` (Chromium) runs inside
check.sh; `tools/app-frames.js` runs in the loop of section 7, step 5, before every tag. **Alternative:** run it from
check.sh when the port answers. **Flip:** one line in `tools/check.sh`.

## 6. The plugin's own views compared with a plain page (2026-10-23)

**Question:** with the plugin off, the tag map's address (`#/refinement-tags`) is no page at all, so there is nothing to
compare with. **Chosen:** its plugin-off run opens a plain page the same way (Nausea): what Logseq itself does when a page
opens (its main column slides 50 px leaving the wide All pages view). **Flip:** `plain` in `tools/app-frames.js`.

## 7. A first visit made a true one (2026-10-23)

**Question:** the two-way rows remember each page's room from the last visit, so "a first visit" in the test was never a
first one. **Chosen:** before the plugin starts for the measured run, the room remembered for each stop is forgotten (in
Logseq's window storage, `refinementTwoWayRoom2`); the second visit then finds the room the first one saved. Visits with
the plugin on last 2.6 s, since a room is saved only after a page has settled two seconds. **Flip:** the block before
`setPlugin(page, true)` in `tools/app-frames.js`.
