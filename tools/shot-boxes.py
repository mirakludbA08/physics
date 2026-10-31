"""Find where each question part sits on its paper page, for the Questions PDF
(js/bank.js shows each part as a screenshot cut from the page images).

For each paper with a text layer (physics, chemistry, biology) this reads word positions
from the PDF with Poppler's pdftotext -bbox-layout, finds the "Q12." headings and the
(a), (b), (i), (ii) labels, cuts each question into regions, trims blank space using the
page images in papers/<subject>/img/, and writes into each question of
data/<subject>/<paper>.json:

  "shot": [[i, top, bottom], ...]
      the part itself, as slices of page images: i indexes the question's "images",
      top and bottom are fractions of the page height
  "ctx": [[key, [[i, top, bottom], ...]], ...]
      what the part needs from earlier in the question, in paper order: the question's
      opening text and diagrams (key "Q12"), the lead-in of its lettered part ("Q12(b)"),
      and any earlier part it points back to ("hence", "your answer to (a)")

Questions it cannot place keep no "shot", and the PDF shows their text instead.

Usage, from the repository root:  python tools/shot-boxes.py <subject> [<paper> ...]
Then: node tools/build-data.js <subject>
Needs Poppler's pdftotext (set PDFTOTEXT if it is not the one on the PATH), Pillow, numpy.
"""
import glob
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from functools import lru_cache

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIKTEX = os.path.expanduser(r'~\AppData\Local\Programs\MiKTeX\miktex\bin\x64\pdftotext.exe')

QHEAD = re.compile(r'^Q(\d+)\.?$')
LABEL = re.compile(r'^\(([a-z]{1,4})\)$')
ROMANS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']
NO = re.compile(r'^Q(\d+)(?:\(([a-z]+)\))?(?:\(([a-z]+)\))?$')
# Words in a part that point back to an earlier part's result. "Give your answer in
# standard form" is about this part's own answer, so "your answer" only counts when it
# points at a part.
BACK = re.compile(r'\bhence\b|\byour (?:answer|value|result|calculation|graph|estimate|expression|working)s?\s+'
                  r'(?:to|from|for|of|in)\s+(?:part\b|\()|\b(?:above|previous|earlier) (?:part|answer|result|value|calculation)', re.I)
REF = re.compile(r'\bpart\s*\(?([a-h])\)?(?:\s*\(([ivx]+)\))?|\(([a-h])\)(?:\s*\(([ivx]+)\))?')
END = re.compile(r'^\(Total for question', re.I)
# Where a maths question came from, printed under its total: "(Q02 WMA12/01, June 2019)".
SOURCE = re.compile(r'\bW[A-Z]{2}\d{2}/\d{2}', re.I)
# The multiple-choice instructions, however their lines wrap ("... with a cross in the
# box ... If you change your mind about an answer, put a line through the box ...").
BOILER = re.compile(r'with a cross|put a cross in the box|select one answer from|put a line through the box|change your mind|'
                    r'mind about an answer|mark your new answer|^cross\W*$', re.I)
INK = 150        # grey level below which a pixel counts as print (the watermarks are lighter)
X_LEFT, X_RIGHT = 18, 577   # points: the printed column of every subject, with the marks in brackets


def pdftotext():
    for cand in (os.environ.get('PDFTOTEXT'), MIKTEX, shutil.which('pdftotext')):
        if cand and os.path.exists(cand):
            out = subprocess.run([cand, '-h'], capture_output=True, text=True)
            if '-bbox-layout' in out.stdout + out.stderr:
                return cand
    sys.exit('Needs Poppler pdftotext with -bbox-layout (set PDFTOTEXT)')


SITE = re.compile(r'Rock\w*Revis\w*\.com|compiled by', re.I)
WATERMARK = re.compile(r'(www\.)?Rock\w*Revis\w*(\.com)?', re.I)


def make_page(w, h, lines):
    """A page: size, its lines top to bottom, and the band between header and footer."""
    lines.sort(key=lambda l: (round(l['y0']), l['x0']))
    heads = [l['y1'] for l in lines if SITE.search(l['text']) and l['y1'] < 80]
    feet = [l['y0'] for l in lines if SITE.search(l['text']) and l['y0'] > h - 80]
    # Maths pages print their first line right under the header, so the band starts
    # just below it rather than at a fixed margin.
    top = max(heads) + 2 if heads else 40.0
    bottom = min(feet) - 2 if feet else h - 20
    body = [l for l in lines if top <= l['y0'] < bottom and not WATERMARK.fullmatch(l['text'])]
    return {'w': w, 'h': h, 'lines': body, 'top': top, 'bottom': bottom}


def read_pages(pdf, tool):
    """The pages of a paper with a text layer, read with pdftotext."""
    out = subprocess.run([tool, '-bbox-layout', pdf, '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stdout
    pages = []
    for chunk in out.split('<page ')[1:]:
        w, h = (float(v) for v in re.search(r'width="([\d.]+)" height="([\d.]+)"', chunk).groups())
        lines = []
        for m in re.finditer(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', chunk, re.S):
            words = [html.unescape(x) for x in re.findall(r'>([^<]*)</word>', m.group(5))]
            if words:
                lines.append({'x0': float(m.group(1)), 'y0': float(m.group(2)), 'y1': float(m.group(4)), 'words': words,
                              'text': ' '.join(words)})
        pages.append(make_page(w, h, lines))
    return pages


def read_pages_ocr(images):
    """The pages of a paper with no text layer (maths), read from its page images with
    the OCR built into Windows (tools/ocr-pages.ps1). Positions are scaled to points of
    an A4 page, so the same rules apply as for a PDF. Results are cached in the temp
    folder, as reading takes about half a second a page. Page n is pages[n - 1]."""
    cache_dir = os.path.join(tempfile.gettempdir(), 'ialqbank-ocr')
    os.makedirs(cache_dir, exist_ok=True)
    todo = [x for x in images if not os.path.exists(os.path.join(cache_dir, os.path.basename(x) + '.json'))]
    if todo:
        out = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
                              os.path.join(ROOT, 'tools', 'ocr-pages.ps1')] + todo,
                             capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=ROOT).stdout
        for row in out.splitlines():
            row = row.lstrip('﻿').strip()
            if row:
                o = json.loads(row)
                with open(os.path.join(cache_dir, os.path.basename(o['file']) + '.json'), 'w', encoding='utf-8') as f:
                    json.dump(o, f)
    pages = []
    for x in images:
        with open(os.path.join(cache_dir, os.path.basename(x) + '.json'), encoding='utf-8') as f:
            o = json.load(f)
        k = 595.32 / o['w']
        lines = [{'x0': l['x0'] * k, 'y0': l['y0'] * k, 'y1': l['y1'] * k, 'words': l['words'] or [''],
                  'text': l['text']} for l in (o['lines'] or [])]
        n = page_no(x)
        while len(pages) < n - 1:
            pages.append(make_page(595.32, o['h'] * k, []))
        pages.append(make_page(595.32, o['h'] * k, lines))
    return pages


def fix_ocr(word):
    """Undo the usual OCR slips in headings and labels: "QI." is Q1, "QIO." is Q10,
    "(I)" and "(Il)" are (i) and (ii)."""
    if re.fullmatch(r'Q[0-9IlOo|]+\.?|[O0][0-9IlOo|]{1,2}\.', word):
        return 'Q' + word[1:].translate(str.maketrans('IlOo|', '11001'))
    if re.fullmatch(r'\*?\([A-Za-z|]{1,4}\)', word):
        inner = word.strip('*()')
        if re.fullmatch(r'[IlLiVvXx|]+', inner):
            inner = inner.translate(str.maketrans('Il|L', 'iiii'))
        return '(' + inner.lower() + ')'
    return word


def markers(pages):
    """Question headings, part labels, question ends and the multiple-choice boilerplate,
    in reading order, as (page, y, kind, value)."""
    found = []
    for p, page in enumerate(pages):
        for l in page['lines']:
            # A star before a label marks an extended-writing part: "*(b)" or "* (b)".
            words = [fix_ocr(w.lstrip('*')) for w in l['words']]
            words = [w for w in words if w] or ['']
            first = words[0]
            # "06." for "Q6." only counts as a heading alone on its line.
            alone = l['words'][0].lstrip('*').startswith('Q') or len(words) == 1
            if QHEAD.match(first) and l['x0'] < 70 and alone and (first.endswith('.') or len(words) <= 2):
                found.append((p, l['y0'], 'Q', int(QHEAD.match(first).group(1)), l['y1']))
            elif END.match(l['text']):
                found.append((p, l['y0'], 'END', None, l['y1']))
            elif SOURCE.search(l['text']) and l['x0'] > 250:
                found.append((p, l['y0'], 'SOURCE', None, l['y1']))
            elif BOILER.search(l['text']):
                found.append((p, l['y0'], 'BOILER', None, l['y1']))
            elif not re.search(r'[A-Za-z0-9]', l['text']):
                found.append((p, l['y0'], 'SYMBOL', None, l['y1']))
            elif LABEL.match(first) and l['x0'] < 95:
                found.append((p, l['y0'], 'LABEL', LABEL.match(first).group(1), l['y1']))
                if len(words) > 1 and LABEL.match(words[1]):
                    found.append((p, l['y0'] + 0.01, 'LABEL', LABEL.match(words[1]).group(1), l['y1']))
    return found


def span(pages, start, end):
    """Page slices from start (page, y) up to end (page, y)."""
    (p0, y0), (p1, y1) = start, end
    out = []
    for p in range(p0, p1 + 1):
        top = y0 if p == p0 else pages[p]['top']
        bottom = y1 if p == p1 else pages[p]['bottom']
        top, bottom = max(top, pages[p]['top']), min(bottom, pages[p]['bottom'])
        if bottom - top > 4:
            out.append([p, top, bottom])
    return out


ANSWER_LINE = re.compile(r'\.{4,}|^\(\d+\)$')


def next_label(kind, name):
    """The label after this one: (b) after (a), (iii) after (ii)."""
    if kind == 'L':
        return chr(ord(name) + 1) if name < 'z' else None
    i = ROMANS.index(name) if name in ROMANS else -1
    return ROMANS[i + 1] if 0 <= i < len(ROMANS) - 1 else None


def after_answers(pages, start, stop):
    """Where the part labelled at stop really begins: just under the last answer line or
    marks bracket of the part before it (from start), so that lead-in text or a diagram
    printed above the label ("The point P lies on C." before "(b)") goes with the part it
    introduces. stop itself when there is no answer line in between. Multiple-choice
    options (lines starting A, B, C, D) count as answer space too, as their marks
    bracket is often printed above them."""
    lines = [(p, l) for p in range(start[0], stop[0] + 1) for l in pages[p]['lines'] if start < (p, l['y0']) < stop]
    letter = lambda l: re.sub(r'^[^A-Za-z0-9]+', '', l['text'])[:2].strip()
    options = len({letter(l) for _, l in lines if letter(l) in ('A', 'B', 'C', 'D')}) >= 3
    begin = stop
    for p, l in lines:
        if ANSWER_LINE.search(l['text']) or (options and letter(l) in ('A', 'B', 'C', 'D')):
            begin = (p, l['y1'] + 2)
    # No answer space found (the OCR can miss a marks bracket), but the part runs over a
    # page break after a finished sentence: what the new page prints above the label is
    # the next part's lead-in.
    if begin == stop and start[0] < stop[0]:
        before = [l for p, l in lines if p < stop[0]]
        after = [l for p, l in lines if p == stop[0]]
        if before and after and re.search(r'[.?:]\s*$', before[-1]['text']):
            begin = (stop[0], pages[stop[0]]['top'])
    return begin


def with_missing_heads(ms):
    """OCR sometimes misses a short "Q4." heading. When part labels follow a question's
    total (and its source line) with no heading in between, the next question started
    there: add its heading just under the last of those lines."""
    out, last, ended, after = [], 0, False, None
    for m in ms:
        if m[2] == 'Q':
            last, ended = m[3], False
        elif m[2] == 'END':
            ended, after = True, (m[0], m[4])
        elif m[2] == 'SOURCE' and ended:
            after = (m[0], m[4])
        elif m[2] == 'LABEL' and ended and last:
            last += 1
            out.append((after[0], after[1] + 0.5, 'Q', last, after[1] + 0.5))
            ended = False
        out.append(m)
    return out


def questions(pages, tops=None):
    """Every question in the paper: its heading position and named regions. tops gives,
    per question number, which kind of label is its top level ('L' for (a), 'R' for (i)),
    from how the data numbers its parts."""
    tops = tops or {}
    ms = with_missing_heads(markers(pages))
    heads = [i for i, m in enumerate(ms) if m[2] == 'Q']
    result = []
    for k, hi in enumerate(heads):
        head = ms[hi]
        stop = heads[k + 1] if k + 1 < len(heads) else len(ms)
        inside = ms[hi + 1:stop]
        ends = [m for m in inside if m[2] == 'END']
        if ends:
            end = (ends[0][0], ends[0][1] - 2)
        elif k + 1 < len(heads):
            end = (ms[heads[k + 1]][0], ms[heads[k + 1]][1] - 2)
        else:
            end = (len(pages) - 1, pages[-1]['bottom'])
        # The opening text starts under the heading and under the multiple-choice
        # instructions, including a stray box symbol left on a line of its own.
        # Only lines straight under the heading (or under the previous instruction line)
        # count, so a box symbol lower down never swallows the question text.
        start = (head[0], head[4] + 2)
        for m in inside:
            # (or at the top of the next page, when the instructions run over a page break)
            near = (m[0] == start[0] and m[1] - start[1] < 40) or \
                (m[0] == start[0] + 1 and m[1] - pages[m[0]]['top'] < 40 and pages[start[0]]['bottom'] - start[1] < 60)
            if m[2] == 'BOILER' and near or (m[2] == 'SYMBOL' and near and start != (head[0], head[4] + 2)):
                start = (m[0], m[4] + 2)
            elif m[2] in ('LABEL', 'BOILER', 'SYMBOL') and not near:
                break
        # Letters (a) or romans (i) are the top level, as the data numbers the question
        # (maths has both "Q3(a)(i)" and "Q5(ii)(a)"); failing that, whichever comes first.
        # The other kind nests inside.
        labels, top_kind, top = [], tops.get(head[3]), None
        for m in inside:
            if m[2] != 'LABEL' or (m[0], m[1]) >= end:
                continue
            name = m[3]
            roman = name in ROMANS and not (name == 'i' and top == 'h') and not (name in ('v', 'x') and top in ('u', 'w'))
            kind = 'R' if roman else 'L'
            at = (m[0], m[1] - 2)
            top_kind = top_kind or kind
            if kind == top_kind:
                top = name
                labels.append({'top': True, 'name': name, 'parent': None, 'at': at})
                continue
            if not top:
                # A nested label before any top label: the top label, (a) or (i), is
                # missing from the text, so this part belongs under it.
                top = 'a' if top_kind == 'L' else 'i'
            if name == ('i' if kind == 'R' else 'a') and labels and not labels[-1]['top'] and top:
                # The inner numbering starts again with no top label in between, so that
                # label is missing from the text: the next one begins after the previous
                # part's answer lines.
                top = next_label(top_kind, top)
                if not top:
                    continue
                labels.append({'top': True, 'name': top, 'parent': None, 'at': after_answers(pages, labels[-1]['at'], at)})
            labels.append({'top': False, 'name': name, 'parent': top, 'at': at})
        n = head[3]
        regions, clashes = {}, set()

        def put(key, segs):
            if key in regions:
                clashes.add(key)
            regions[key] = segs

        # Each part runs from just under the previous part's answer space (its lead-in)
        # to the start of the next part.
        for j, lab in enumerate(labels):
            lab['from'] = after_answers(pages, labels[j - 1]['at'], lab['at']) if j else lab['at']
        first = labels[0]['from'] if labels else end
        regions['Q%d' % n] = span(pages, start, first)
        whole = span(pages, start, end)
        for j, lab in enumerate(labels):
            nxt = labels[j + 1]['from'] if j + 1 < len(labels) else end
            if lab['top']:
                key = 'Q%d(%s)' % (n, lab['name'])
                later = [x for x in labels[j + 1:] if x['top']]
                put(key, span(pages, lab['from'], later[0]['from'] if later else end))
                if j + 1 < len(labels) and not labels[j + 1]['top']:
                    put(key + '>intro', span(pages, lab['from'], labels[j + 1]['from']))
            else:
                key = 'Q%d(%s)(%s)' % (n, lab['parent'], lab['name']) if lab['parent'] else 'Q%d(%s)' % (n, lab['name'])
                put(key, span(pages, lab['from'], nxt))
        # Two regions with one name means the labels were misread: leave those parts out
        # (they keep their text in the PDF) rather than risk the wrong screenshot.
        for key in clashes:
            regions.pop(key, None)
        result.append({'n': n, 'page': head[0], 'regions': regions, 'whole': whole,
                       'order': ['Q%d' % n] + [r for r in regions if r != 'Q%d' % n and not r.endswith('>intro')]})
    return result


@lru_cache(maxsize=64)
def ink_rows(path):
    img = np.asarray(Image.open(path).convert('L'))
    return img


def trim(path, page, seg):
    """Shrinks a slice to the rows that hold print. None when it is blank."""
    img = ink_rows(path)
    h, w = img.shape
    sy, sx = h / page['h'], w / page['w']
    top, bottom = int(seg[1] * sy), int(seg[2] * sy)
    band = img[top:bottom, int(X_LEFT * sx):int(X_RIGHT * sx)]
    if band.size == 0:
        return None
    rows = np.where((band < INK).sum(axis=1) >= 2)[0]
    if not len(rows):
        return None
    t = max(0, top + rows[0] - 3) / h
    b = min(h, top + rows[-1] + 5) / h
    return [round(t, 4), round(b, 4)]


def words_in(pages, segs):
    return ' '.join(' '.join(l['words']) for p, t, b in segs for l in pages[p]['lines'] if t <= l['y0'] < b)


def page_no(path):
    return int(re.search(r'-(\d+)\.jpg$', path).group(1))


def run(subject, only):
    tool = pdftotext()
    folder = os.path.join(ROOT, 'data', subject)
    placed = total = 0
    for name in sorted(os.listdir(folder)):
        stem = name[:-5]
        if not name.endswith('.json') or (only and stem not in only):
            continue
        path = os.path.join(folder, name)
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        qs = data if isinstance(data, list) else data['questions']
        pdf = os.path.join(ROOT, 'papers', subject, stem + '.pdf')
        if os.path.exists(pdf):
            pages = read_pages(pdf, tool)
        else:
            # No PDF with a text layer (maths): read the page images instead. Their names
            # share a prefix that can differ from the data file's ("P2-04-..." for "04-...").
            prefixes = {re.sub(r'-\d+\.jpg$', '', x) for q in qs for x in (q.get('images') or [])}
            if len(prefixes) != 1:
                print('no pdf or page images for', stem)
                continue
            images = sorted(glob.glob(os.path.join(ROOT, prefixes.pop() + '-*.jpg')), key=page_no)
            pages = read_pages_ocr([os.path.relpath(x, ROOT).replace(os.sep, '/') for x in images])
        # A question whose parts start with a plain letter, (a) or (b), has letters on top;
        # one whose parts all start with (i), (ii) has romans on top.
        firsts = {}
        for q in qs:
            m = NO.match(q.get('no', ''))
            if m and m.group(2):
                firsts.setdefault(int(m.group(1)), set()).add(m.group(2))
        tops = {n: 'L' if any(x not in ROMANS for x in s) else 'R' for n, s in firsts.items()}
        found = questions(pages, tops)
        missed = []
        for q in qs:
            total += 1
            q.pop('shot', None)
            q.pop('ctx', None)
            m = NO.match(q.get('no', ''))
            imgs = q.get('images') or []
            if not m or not imgs:
                missed.append(q['id'])
                continue
            n, p1, p2 = int(m.group(1)), m.group(2), m.group(3)
            pages_of = [page_no(x) - 1 for x in imgs]
            cands = [x for x in found if x['n'] == n and x['page'] in pages_of] or \
                [x for x in found if x['n'] == n and x['page'] == pages_of[0] - 1]
            if not cands:
                missed.append(q['id'])
                continue
            qq = cands[0]
            regions = qq['regions']
            if p2:
                own_key = 'Q%d(%s)(%s)' % (n, p1, p2)
            elif p1:
                own_key = 'Q%d(%s)' % (n, p1)
            else:
                own_key = 'Q%d' % n
            own = qq['whole'] if not p1 else regions.get(own_key)
            if not own:
                missed.append(q['id'])
                continue
            # Context: the opening text, the lead-in of the lettered part, and any earlier
            # part this one points back to.
            ctx_keys = []
            if p1:
                ctx_keys.append('Q%d' % n)
            if p2 and ('Q%d(%s)>intro' % (n, p1)) in regions:
                ctx_keys.append('Q%d(%s)>intro' % (n, p1))
            text = words_in(pages, own)
            text = re.sub(r'^\s*\([a-z]+\)\s*(\([a-z]+\)\s*)?', '', text)
            order = qq['order']
            here = order.index(own_key) if own_key in order else len(order)
            before = order[1:here]
            for r in REF.finditer(text):
                letter, roman = r.group(1) or r.group(3), r.group(2) or r.group(4)
                key = 'Q%d(%s)(%s)' % (n, letter, roman) if roman else 'Q%d(%s)' % (n, letter)
                if key in before:
                    ctx_keys.append(key)
            if BACK.search(text) and before and not any(k in before for k in ctx_keys):
                ctx_keys.append(before[-1])
            # Paper order, no repeats, and nothing that already contains this part.
            seen, ctx = set(), []
            for key in sorted(set(ctx_keys), key=lambda k: order.index(k.replace('>intro', '')) if k.replace('>intro', '') in order else -1):
                clean = key.replace('>intro', '')
                if clean == own_key or clean in seen:
                    continue
                seen.add(clean)
                ctx.append((clean, regions[key]))

            def slices(segs):
                out = []
                for p, t, b in segs:
                    if p not in pages_of:
                        continue
                    i = pages_of.index(p)
                    cut = trim(os.path.join(ROOT, imgs[i]), pages[p], [p, t, b])
                    if cut:
                        out.append([i] + cut)
                return out

            shot = slices(own)
            if not shot:
                missed.append(q['id'])
                continue
            q['shot'] = shot
            ctx_out = [[k, slices(segs)] for k, segs in ctx]
            ctx_out = [c for c in ctx_out if c[1]]
            if ctx_out:
                q['ctx'] = ctx_out
            placed += 1
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print('%-40s %3d of %3d placed%s' % (stem, len(qs) - len(missed), len(qs),
                                            ('  missed: ' + ', '.join(missed[:8]) + (' ...' if len(missed) > 8 else '')) if missed else ''))
    print('%s: %d of %d questions placed' % (subject, placed, total))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    run(sys.argv[1], set(sys.argv[2:]))
