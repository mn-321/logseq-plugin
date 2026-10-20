#!/bin/sh
# Checks the plugin before a commit. Run from the repo root: sh tools/check.sh
# Exits non-zero on any problem, with a plain message.
cd "$(dirname "$0")/.." || exit 1
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
fail=0
problem() { echo "PROBLEM: $1"; fail=1; }

# 1. Syntax of every script file: JavaScriptCore on a Mac, node elsewhere.
for f in loader.js main.js parts/*.js; do
  if [ -x "$JSC" ]; then "$JSC" tools/check.js -- "$f" || fail=1
  elif command -v node >/dev/null 2>&1; then node --check "$f" >/dev/null 2>&1 && echo "OK $f" || { echo "ERROR $f: syntax"; fail=1; }
  else problem "no JavaScriptCore and no node to check the syntax of $f"; fi
done

# 2. No leftover TEMP-DEV block.
found=$(grep -l TEMP-DEV loader.js main.js parts/*.js tools/*.js 2>/dev/null | tr '\n' ' ')
if [ -n "$found" ]; then problem "TEMP-DEV found in: $found"; fi

# 3. package.json and the version line at the top of README.md agree.
pkg=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json | head -1)
readme=$(head -5 README.md | sed -n 's/.*Version \([0-9][0-9.]*\)\..*/\1/p' | head -1)
if [ -z "$pkg" ] || [ "$pkg" != "$readme" ]; then problem "version differs: package.json '$pkg', README.md '$readme'"; fi

# 4. Counts that should stay the same unless a setting or a publication was added on purpose.
settings=$(cat main.js parts/*.js | grep -c "key: '")
windows=$(cat main.js parts/*.js | grep -c "window\.[a-zA-Z]* = ")
echo "settings keys (grep \"key: '\"): $settings; window.* publications: $windows"

# 5. Every file in parts/ is in PART_FILES or RESTING_FILES (kept, not loaded) in main.js, and the reverse.
listed=$(sed -n -E "s/^const (PART|RESTING)_FILES = \[(.*)\];.*/\2/p" main.js | tr -d "' " | tr ',' '\n' | sed 's#^parts/##' | sort)
present=$(ls parts | sort)
if [ "$listed" != "$present" ]; then
  problem "parts/ and PART_FILES differ. In PART_FILES: $(echo $listed). In parts/: $(echo $present)"
fi

# 6. The boot test (tools/boot-test.js) and the tag map checks (tools/tags-test.js), where node and jsdom are installed; skipped quietly elsewhere.
if command -v node >/dev/null 2>&1 && [ -d node_modules/jsdom ]; then
  node tools/boot-test.js || problem "the boot test failed (see above)"
  node tools/tags-test.js || problem "the tag map checks failed (see above)"
else
  echo "boot test skipped (needs node and: npm install --no-save --no-package-lock jsdom)"
fi
# 7. The model test (tools/model-test.js), where node is installed: parts/model.js against a small pretend graph.
if command -v node >/dev/null 2>&1; then
  node tools/model-test.js || problem "the model test failed (see above)"
else
  echo "model test skipped (needs node)"
fi

# 8. The tag map timings (tools/tags-speed.js) in a real browser, where Playwright and Chromium are installed; skipped quietly elsewhere.
if command -v node >/dev/null 2>&1; then
  node tools/tags-speed.js || problem "the tag map timings failed (see above)"
fi
# 9. Pictures of what the plugin draws (tools/pictures.js), light and dark, compared with the approved ones in test/pictures/.
if command -v node >/dev/null 2>&1; then
  node tools/pictures.js || problem "a picture changed (see above); look at check.log/pictures/, and approve it with node tools/pictures.js --approve only if the change was meant"
fi

# 10. The two-way rows against the real Illness Test Graph (tools/two-way-check.js), through Logseq's command line;
#     skipped quietly where the command line or the graph cannot be read.
if command -v node >/dev/null 2>&1 && [ -d node_modules/jsdom ]; then
  node tools/two-way-check.js || problem "the two-way rows differ from the graph (see above)"
fi

if [ $fail -ne 0 ]; then echo "check.sh: FAILED"; exit 1; fi
echo "check.sh: OK (version $pkg)"
