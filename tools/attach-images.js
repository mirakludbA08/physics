#!/usr/bin/env node
/* Attach page images to each question, for the "Question image" drop-down.

   For every paper in data/<subject>/*.json this reads a page map,
   tools/maps/<subject>/<base>.map, with one "<question number> <page>" line for each
   place a question number starts (map-pages.sh writes these for papers with a text
   layer; for scanned papers write them by hand). Each question gets the pages from
   where its number starts up to the page before the next question starts.

   Page images are expected at papers/<subject>/img/<base>-<page>.jpg, where <base> is
   the PDF's name without ".pdf" (for maths: "<P1|P2|...>-<name without -QP>").
   Render them with: pdftoppm -jpeg -r 90 -jpegopt quality=72 <pdf> papers/<subject>/img/<base>

   Usage, from the repository root:  node tools/attach-images.js <subject>
   Then run tools/build-data.js to rebuild the site data. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const subject = process.argv[2];
if (!subject) { console.error('usage: node tools/attach-images.js <subject>'); process.exit(1); }

function baseOf(pdf) {
  const m = String(pdf).match(/papers\/maths\/(\w+)-topical\/(.+?)(-QP)?\.pdf$/);
  if (m) return m[1] + '-' + m[2];
  return path.basename(String(pdf), '.pdf');
}

const dir = path.join(ROOT, 'data', subject);
const imgDir = path.join(ROOT, 'papers', subject, 'img');
const mapDir = path.join(ROOT, 'tools', 'maps', subject);
let attached = 0;
let noMap = 0;

fs.readdirSync(dir).filter((f) => f.endsWith('.json')).forEach((f) => {
  const file = path.join(dir, f);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const base = baseOf(data.pdf);
  const mapFile = path.join(mapDir, base + '.map');
  if (!fs.existsSync(mapFile)) { noMap++; return; }

  // Markers in document order: question number, page, and whether the end of the
  // previous question sits above this one on the same page.
  const markers = fs.readFileSync(mapFile, 'utf8').split('\n').filter((l) => l.trim())
    .map((l) => l.trim().split(/\s+/).map(Number))
    // Hand-written maps (maths) have no spill column: assume the end of the previous
    // question may share the page, since an extra page is better than a missing part.
    .map(([q, page, spill]) => ({ q, page, spill: spill === undefined ? true : spill === 1 }));
  const pages = fs.readdirSync(imgDir).filter((x) => x.indexOf(base + '-') === 0 && /-\d+\.jpg$/.test(x));
  const total = pages.length;
  const pad = String(total).length;
  const pageFile = (n) => 'papers/' + subject + '/img/' + base + '-' + String(n).padStart(pad, '0') + '.jpg';

  // Some papers have sections (A, B, ...) that each number their questions from 1.
  // A drop in the numbering starts a new section; ids like "Ch5-B-Q20b" pick section B.
  let section = 0;
  markers.forEach((m, i) => {
    if (i > 0 && m.q <= markers[i - 1].q) section++;
    m.section = section;
  });

  data.questions.forEach((q) => {
    const m = String(q.no || '').match(/Q(\d+)/);
    if (!m) return;
    const letter = (String(q.id).match(/-([A-Z])-Q\d/) || [])[1];
    const want = letter ? letter.charCodeAt(0) - 65 : 0;
    const at = markers.findIndex((k) => k.q === Number(m[1]) && k.section === want);
    if (at === -1) return;
    const start = markers[at].page;
    // The question runs until the next question that starts on a later page; that
    // page is included too when the end of this question sits above the next one.
    const next = markers.slice(at + 1).find((k) => k.page > start);
    let end = total;
    if (next) end = next.spill ? next.page : next.page - 1;
    q.images = [];
    for (let p = start; p <= Math.max(start, end) && p <= total; p++) q.images.push(pageFile(p));
    attached++;
  });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
});

console.log(subject, 'questions with images:', attached, '| papers without a map:', noMap);
