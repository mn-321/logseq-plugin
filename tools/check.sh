#!/bin/sh
# Checks the plugin before a commit. Run from the repo root: sh tools/check.sh
# Exits non-zero on any problem, with a plain message.
cd "$(dirname "$0")/.." || exit 1
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
fail=0
problem() { echo "PROBLEM: $1"; fail=1; }

# 1. Syntax of every script file.
for f in loader.js main.js parts/*.js; do
  "$JSC" tools/check.js -- "$f" || fail=1
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

# 5. Every file in parts/ is in PART_FILES in main.js, and the reverse.
listed=$(sed -n "s/^const PART_FILES = \[\(.*\)\];.*/\1/p" main.js | tr -d "' " | tr ',' '\n' | sed 's#^parts/##' | sort)
present=$(ls parts | sort)
if [ "$listed" != "$present" ]; then
  problem "parts/ and PART_FILES differ. In PART_FILES: $(echo $listed). In parts/: $(echo $present)"
fi

if [ $fail -ne 0 ]; then echo "check.sh: FAILED"; exit 1; fi
echo "check.sh: OK (version $pkg)"
