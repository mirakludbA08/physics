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
import html
import json
import os
import re
import shutil
import subprocess
import sys
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
# The multiple-choice instructions, however their lines wrap ("... with a cross in the
# box ... If you change your mind about an answer, put a line through the box ...").
BOILER = re.compile(r'with a cross|put a line through the box|change your mind|mind about an answer|mark your new answer', re.I)
INK = 150        # grey level below which a pixel counts as print (the watermarks are lighter)
X_LEFT, X_RIGHT = 18, 577   # points: the printed column of every subject, with the marks in brackets


def pdftotext():
    for cand in (os.environ.get('PDFTOTEXT'), MIKTEX, shutil.which('pdftotext')):
        if cand and os.path.exists(cand):
            out = subprocess.run([cand, '-h'], capture_output=True, text=True)
            if '-bbox-layout' in out.stdout + out.stderr:
                return cand
    sys.exit('Needs Poppler pdftotext with -bbox-layout (set PDFTOTEXT)')


def read_pages(pdf, tool):
    """Each page: size, lines (top to bottom) with their words, and the printable band."""
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
        lines.sort(key=lambda l: (round(l['y0']), l['x0']))
        top, bottom = 40.0, h - 37
        for l in lines:
            if 'RocketRevise.com' in l['text']:
                if l['y1'] < 80:
                    top = max(top, l['y1'] + 3)
                elif l['y0'] > h - 80:
                    bottom = min(bottom, l['y0'] - 3)
        body = [l for l in lines if top <= l['y0'] < bottom and l['text'] not in ('RocketRevise', 'www.RocketRevise.com')]
        pages.append({'w': w, 'h': h, 'lines': body, 'top': top, 'bottom': bottom})
    return pages


def markers(pages):
    """Question headings, part labels, question ends and the multiple-choice boilerplate,
    in reading order, as (page, y, kind, value)."""
    found = []
    for p, page in enumerate(pages):
        for l in page['lines']:
            # A star before a label marks an extended-writing part: "*(b)" or "* (b)".
            words = [w.lstrip('*') for w in l['words']]
            words = [w for w in words if w] or ['']
            first = words[0]
            if QHEAD.match(first) and l['x0'] < 70 and (first.endswith('.') or len(words) <= 2):
                found.append((p, l['y0'], 'Q', int(QHEAD.match(first).group(1)), l['y1']))
            elif END.match(l['text']):
                found.append((p, l['y0'], 'END', None, l['y1']))
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


def after_answers(pages, start, stop):
    """Where a part with a missing label begins: the first line after the last answer
    line or marks bracket between start and stop (both (page, y)); stop if there is none."""
    seen, begin = False, stop
    for p in range(start[0], stop[0] + 1):
        for l in pages[p]['lines']:
            here = (p, l['y0'])
            if here <= start or here >= stop:
                continue
            if ANSWER_LINE.search(l['text']):
                seen, begin = True, stop
            elif seen and begin == stop:
                begin = (p, l['y0'] - 2)
    return begin


def questions(pages):
    """Every question in the paper: its heading position and named regions."""
    ms = markers(pages)
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
        start, boiler = (head[0], head[4] + 2), False
        for m in inside:
            if m[2] == 'BOILER' or (m[2] == 'SYMBOL' and boiler):
                start, boiler = (m[0], m[4] + 2), True
            elif m[2] == 'LABEL':
                break
        labels, letter = [], None
        for m in inside:
            if m[2] != 'LABEL' or (m[0], m[1]) >= end:
                continue
            name = m[3]
            roman = name in ROMANS and not (name == 'i' and letter == 'h') and not (name in ('v', 'x') and letter in ('u', 'w'))
            at = (m[0], m[1] - 2)
            if roman and name == 'i' and labels and labels[-1]['kind'] == 'R' and letter:
                # The numbering starts again at (i) with no letter in between, so the
                # letter label is missing from the text layer: the next letter begins
                # after the previous part's answer lines.
                letter = chr(ord(letter) + 1)
                labels.append({'kind': 'L', 'name': letter, 'letter': None, 'at': after_answers(pages, labels[-1]['at'], at)})
            elif not roman:
                letter = name
            labels.append({'kind': 'R' if roman else 'L', 'name': name, 'letter': None if not roman else letter, 'at': at})
        n = head[3]
        regions, clashes = {}, set()

        def put(key, segs):
            if key in regions:
                clashes.add(key)
            regions[key] = segs

        first = labels[0]['at'] if labels else end
        regions['Q%d' % n] = span(pages, start, first)
        whole = span(pages, start, end)
        for j, lab in enumerate(labels):
            nxt = labels[j + 1]['at'] if j + 1 < len(labels) else end
            if lab['kind'] == 'L':
                key = 'Q%d(%s)' % (n, lab['name'])
                later = [x for x in labels[j + 1:] if x['kind'] == 'L']
                put(key, span(pages, lab['at'], later[0]['at'] if later else end))
                romans = [x for x in labels[j + 1:j + 2] if x['kind'] == 'R']
                if romans:
                    put(key + '>intro', span(pages, lab['at'], romans[0]['at']))
            else:
                key = 'Q%d(%s)(%s)' % (n, lab['letter'], lab['name']) if lab['letter'] else 'Q%d(%s)' % (n, lab['name'])
                put(key, span(pages, lab['at'], nxt))
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
        pdf = os.path.join(ROOT, 'papers', subject, stem + '.pdf')
        if not os.path.exists(pdf):
            print('no pdf for', stem)
            continue
        pages = read_pages(pdf, tool)
        found = questions(pages)
        path = os.path.join(folder, name)
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        qs = data if isinstance(data, list) else data['questions']
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
