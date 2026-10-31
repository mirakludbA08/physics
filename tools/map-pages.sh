#!/bin/bash
# Write page maps for papers that have a text layer (physics, chemistry, biology).
# For each paper PDF: renders its pages to papers/<subject>/img/ (if not done yet) and
# records, in tools/maps/<subject>/<name>.map, each page where a "Q<number>." heading starts:
#
#   <question number> <page> <spill>
#
# <spill> is 1 when the page holds the end of the previous question above this heading
# (answer lines, part labels such as "(d)" or "(ii)", a marks bracket or "Total for
# question"), so the previous question's images should include this page too; else 0.
# Scanned papers (maths) have no text layer: write their .map files by hand
# ("<question number> <page>" per line).
#
# Usage, from the repository root:  bash tools/map-pages.sh <subject>
# Then: node tools/attach-images.js <subject> && node tools/build-data.js <subject>
set -u
SUBJ="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAPS="$ROOT/tools/maps/$SUBJ"
mkdir -p "$MAPS" "$ROOT/papers/$SUBJ/img"
cd "$ROOT" || exit 1

for json in data/"$SUBJ"/*.json; do
  stem=$(basename "$json" .json)
  pdf="papers/$SUBJ/$stem.pdf"
  [ -f "$pdf" ] || { echo "no pdf for $stem"; continue; }
  n=$(pdfinfo "$pdf" 2>/dev/null | awk '/^Pages/{print $2}')
  if ! ls "papers/$SUBJ/img/$stem-"*.jpg >/dev/null 2>&1; then
    pdftoppm -jpeg -r 90 -jpegopt quality=72 "$pdf" "papers/$SUBJ/img/$stem"
  fi
  out="$MAPS/$stem.map"
  : > "$out"
  for p in $(seq 1 "$n"); do
    pdftotext -f "$p" -l "$p" -layout "$pdf" - 2>/dev/null | awk -v page="$p" '
      /^[[:space:]]*Q[0-9]+\./ {
        q = $0; sub(/^[[:space:]]*Q/, "", q); sub(/\..*/, "", q);
        print q, page, (spill ? 1 : 0);
        spill = 0;            # anything after this heading belongs to this question
        next
      }
      /\.\.\.\.\.\.\.\.\.\.|\([a-h]\)|\((i|ii|iii|iv|v|vi)\)|Total for [Qq]uestion|\([0-9]+\)[[:space:]]*$/ { spill = 1 }
    ' >> "$out"
  done
  echo "$stem: $n pages, $(wc -l < "$out") question markers, $(awk '$3==1' "$out" | wc -l) with spill-over above"
done
