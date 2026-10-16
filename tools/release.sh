#!/bin/sh
# Builds the release zip. Run from the repo root: sh tools/release.sh
# The zip holds a folder logseq-db-refinements/ with exactly: package.json, loader.js, main.js,
# parts/*.js, README.md, CHANGELOG.md. Nothing else (no tools, no work notes).
set -e
cd "$(dirname "$0")/.."
version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json | head -1)
[ -n "$version" ] || { echo "release.sh: no version in package.json"; exit 1; }
sh tools/check.sh || { echo "release.sh: check.sh failed, no zip built"; exit 1; }
out_dir="$HOME/logseq-plugin-archive/releases"
mkdir -p "$out_dir"
zip="$out_dir/logseq-plugin-$version.zip"
if [ -e "$zip" ]; then zip="$out_dir/logseq-plugin-$version-$(date +%Y%m%d-%H%M%S).zip"; fi
stage=$(mktemp -d)
mkdir -p "$stage/logseq-db-refinements/parts"
cp package.json loader.js main.js README.md CHANGELOG.md "$stage/logseq-db-refinements/"
cp parts/*.js "$stage/logseq-db-refinements/parts/"
(cd "$stage" && zip -q -r -X "$zip" logseq-db-refinements)
rm -rf "$stage"
echo "release.sh: built $zip"
unzip -l "$zip"
