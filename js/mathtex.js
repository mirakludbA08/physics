/* IALqBank — finds the maths inside a line of plain question text (maths and
   physics) and rewrites it as TeX for KaTeX: stacked fractions, real roots,
   italic variables, upright functions and units. The data is written in plain
   ASCII, for example "x = 20 sqrt(2) / (4 - 2 sqrt(2))" or "v = 15 m s^-1".

   MathTex.segments(text, subject) splits the text into prose and maths runs:
   [{text}, {text, tex}, ...]. Prose is left for format.js to tidy up. */
(function () {
  'use strict';

  const FUNCS = {
    sin: '\\sin', cos: '\\cos', tan: '\\tan', sec: '\\sec', cot: '\\cot', cosec: '\\operatorname{cosec}',
    arcsin: '\\arcsin', arccos: '\\arccos', arctan: '\\arctan', sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh',
    ln: '\\ln', log: '\\log', exp: '\\exp', lim: '\\lim', Var: '\\operatorname{Var}'
  };
  const GREEK = ('alpha beta gamma delta epsilon zeta eta theta kappa lambda mu nu pi rho sigma tau phi chi omega ' +
    'Gamma Delta Theta Lambda Sigma Phi Omega').split(' ');

  // Words that are always maths. Longest first, so "theta" wins over "eta".
  const NAMES = {};
  Object.keys(FUNCS).forEach((k) => { NAMES[k] = { tex: FUNCS[k], fn: true }; });
  GREEK.forEach((g) => { NAMES[g] = { tex: '\\' + g }; });
  NAMES.sqrt = { tex: '\\sqrt', root: true };
  const NAME_LIST = Object.keys(NAMES).sort((a, b) => b.length - a.length);

  // Units count only after a number ("15 m s^-1", "50cm") or another unit.
  const UNITS = {
    physics: new Set(('m s kg g N J W V A C K T F Pa Hz eV keV MeV GeV mol cm mm km nm um pm dm h min ms ns ' +
      'kW MW GW kJ MJ mA kV kN MN kPa MPa GPa mg Bq Gy Sv rad Wb ohm dB').split(' ')),
    maths: new Set('m s kg N J W cm mm km h ms rad'.split(' '))
  };
  const UNIT_TEX = { ohm: '\\Omega', um: '\\mu\\mathrm{m}' };

  // After "a", "A" or "I" these words mean it is a variable ("a and b are"), not an article.
  const LINK = new Set(('and or is are was were has have had must can cannot will would lies lie satisfies be to ' +
    'then so as in with where when for if from by of on at than').split(' '));
  const STOP = new Set(('the and for are but not you all any can her was one our out get has him his how new now ' +
    'old see two way who did its let put say she too use an as at be by do go if in is it me my no of on or so ' +
    'to up us we am').split(' '));
  const ACRONYMS = new Set('AS PDF OK LHS RHS QED SUVAT IAL II III IV VI'.split(' '));
  const LABEL = /^(?:[a-h]|i{1,3}|iv|vi{0,3}|ix)$/;
  const VECTORS = /\d[ij]\b|[+-]\s*[ij]\b|\)[ij]\b/;

  const OPS = {
    '<=>': '\\Leftrightarrow', '<=': '\\le', '>=': '\\ge', '!=': '\\ne', '->': '\\to', '=>': '\\Rightarrow',
    '~=': '\\approx', '+/-': '\\pm'
  };
  const CHARS = {
    '~': '\\sim', '%': '\\%', '{': '\\{', '}': '\\}', '&': '\\&', '#': '\\#', '$': '\\$', '\\': '\\backslash',
    '^': '\\wedge', '_': '\\_', '°': '{}^{\\circ}'
  };
  const MATH_CHARS = '+-=<>^_/*|()[]!~%{}°';
  const STRONG = '=+-*/<>';
  const LEAD_DROP = ')],/^_*!\'';
  const TRAIL_DROP = '([,+-=/^_*<>~';

  /* ---------- Tokens ---------- */

  // One alternative per token kind; the kind is the index of the group that matched.
  const PARTS = [
    '\\s+',                                                       // 1 space
    'Q\\d+(?:\\([a-z]+\\))*',                                     // 2 question reference, Q13(a)
    '[A-Za-z](?:\\.[A-Za-z])+\\.?',                               // 3 abbreviation: s.f., i.e., p.d.
    '[A-Za-z]-[A-Za-z](?=\\s+(?:graphs?|axis|axes|plane|curve|diagram)\\b)', // 4 v-t graph
    '[A-Za-z0-9]+(?:-[A-Za-z]{2,})+',                             // 5 hyphenated word: y-axis
    '\\d+(?:\\.\\d+)?(?:e[+-]?\\d+(?![A-Za-z]))?',                // 6 number, also 7.37e-10
    "[A-Za-z]+(?:'(?:s|t|re|ll|ve|d|m)(?![A-Za-z]))?",            // 7 word
    '<=>|<=|>=|!=|->|=>|~=|\\+/-',                                // 8 operator
    '[^\\sA-Za-z0-9]'                                             // 9 any other character
  ];
  const KINDS = [null, 'ws', 'prose', 'prose', 'prose', 'prose', 'num', 'word', 'op', 'ch'];
  const TOKEN = new RegExp(PARTS.map((p) => '(' + p + ')').join('|'), 'g');
  // The same without hyphenated words, to split "x-ln" back into x, -, ln.
  const SPLIT = new RegExp(PARTS.map((p, n) => '(' + (n === 4 ? '(?!)' : p) + ')').join('|'), 'g');

  const groupOf = (m) => m.findIndex((v, n) => n > 0 && v !== undefined);

  function tokenize(text) {
    const toks = [];
    let sp = true;
    let m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(text))) {
      let g = groupOf(m);
      if (g === 5 && m[0].split('-').slice(1).some((p) => NAMES[p] || p === 'infinity')) {
        SPLIT.lastIndex = m.index;
        m = SPLIT.exec(text);
        TOKEN.lastIndex = SPLIT.lastIndex;
        g = groupOf(m);
      }
      if (g === 1) { sp = true; continue; }
      toks.push({ t: m[0], k: KINDS[g], sp, at: m.index, end: m.index + m[0].length });
      sp = false;
    }
    return toks;
  }

  const isStrong = (t) => !!t && (t.k === 'op' || (t.k === 'ch' && STRONG.includes(t.t)));
  const glued = (t) => !!t && !t.sp;

  // Greedy split of a run of letters into names and single letters: "sintheta" -> sin, theta.
  function decompose(w) {
    const parts = [];
    let i = 0;
    while (i < w.length) {
      const name = NAME_LIST.find((n) => w.startsWith(n, i));
      parts.push(name || w[i]);
      i += name ? name.length : 1;
    }
    return parts;
  }

  // A power follows: "s^-1" or, in physics data copied from papers, "s-1".
  function hasPower(toks, j) {
    const a = toks[j + 1], b = toks[j + 2];
    if (!glued(a) || !glued(b)) return false;
    return (a.t === '^' && (b.t === '-' || b.k === 'num')) || (a.t === '-' && b.k === 'num');
  }

  function isUnit(toks, i, subject) {
    const tok = toks[i], prev = toks[i - 1], next = toks[i + 1];
    const units = UNITS[subject] || UNITS.maths;
    if (!units.has(tok.t)) return false;
    if (prev && (prev.k === 'num' || prev.unit)) return tok.sp || tok.t.length > 1;
    if (subject !== 'physics' || isStrong(prev) || (prev && prev.t === '(')) return false;
    // "in m s^-1" or "m s-2" with no number in front
    return (next && next.sp && next.k === 'word' && units.has(next.t) && hasPower(toks, i + 1)) ||
      (hasPower(toks, i) && toks[i + 1].t === '-');
  }

  // Decide which words are maths. Sets tok.parts (letters and names), tok.tex
  // (a fixed rendering) or tok.unit; anything else becomes prose.
  function classify(toks, subject) {
    toks.forEach((tok, i) => {
      if (tok.k !== 'word') return;
      const w = tok.t, prev = toks[i - 1], next = toks[i + 1];
      const after = (c) => glued(tok) && prev && prev.t === c;

      if (glued(tok) && prev.k === 'num' && /^(?:st|nd|rd|th)$/.test(w)) { tok.k = prev.k = 'prose'; return; }
      // A part label: (a), (iii). Not f(a).
      if (after('(') && glued(next) && next.t === ')' && LABEL.test(w)) {
        const pp = toks[i - 2];
        if (!(pp && glued(prev) && (pp.k === 'word' || pp.k === 'num' || pp.t === ')'))) { tok.k = 'prose'; return; }
      }
      if (after('^')) { tok.parts = decompose(w); return; }
      if (after('_')) {
        if (w === 'infinity') tok.tex = '\\infty';
        else if (w.length === 1 || NAMES[w]) tok.parts = [w];
        else tok.tex = '\\mathrm{' + w + '}';
        return;
      }
      if (isUnit(toks, i, subject)) { tok.unit = true; tok.tex = UNIT_TEX[w] || '\\mathrm{' + w + '}'; return; }
      if ((w === 'degrees' || w === 'degree') && prev && prev.k === 'num') { tok.unit = tok.deg = true; tok.tex = '^{\\circ}'; return; }
      if (w === 'infinity') {
        if (isStrong(prev) || isStrong(next)) tok.tex = '\\infty';
        else tok.k = 'prose';
        return;
      }
      // dx, dy/dx, and the d of d^2y/dx^2
      if (/^d[a-zA-Z]$/.test(w) && w !== 'do' &&
        ((prev && (isStrong(prev) || prev.t === ')' || prev.parts)) || isStrong(next) || (glued(next) && next.t === '^'))) {
        tok.tex = '\\mathrm{d}' + w[1];
        return;
      }
      if (w === 'd' && glued(next) && next.t === '^' && toks[i + 2] && toks[i + 2].k === 'num' &&
        glued(toks[i + 3]) && toks[i + 3].k === 'word') { tok.tex = '\\mathrm{d}'; return; }
      if (NAMES[w]) { tok.parts = [w]; return; }
      if (w.length === 1) {
        const article = (w === 'a' || w === 'A' || w === 'I') && next && next.sp &&
          (next.k === 'num' || next.k === 'prose' || (next.k === 'word' && next.t.length > 1 && !LINK.has(next.t) && !NAMES[next.t]));
        if (article) tok.k = 'prose';
        else tok.parts = [w];
        // "g = 2 x gradient": an x between a number and a word is a times sign.
        if (w === 'x' && tok.sp && next && next.sp && next.k === 'word' && next.t.length > 1 && !NAMES[next.t] &&
          prev && (prev.k === 'num' || (subject === 'physics' && (prev.parts || prev.t === ')')))) tok.times = true;
        return;
      }
      // Points and lines in maths: AB, OPQ, XYZ.
      if (subject === 'maths' && /^[A-Z]{2,5}$/.test(w) && !ACRONYMS.has(w)) { tok.parts = w.split(''); return; }
      const parts = decompose(w);
      // 3pq, 2theta, (x+1)dx
      if (glued(tok) && (prev.k === 'num' || prev.t === ')') && parts.length <= 4) { tok.parts = parts; return; }
      // fg(x), pq^2, cosec^2
      if (glued(next) && "(^_'".includes(next.t) && parts.length <= 3 && !STOP.has(w)) { tok.parts = parts; return; }
      // between signs: H = at + b
      if (w.length <= 3 && isStrong(prev) && (!next || isStrong(next) || ',.;)'.includes(next.t))) { tok.parts = parts; return; }
      tok.k = 'prose';
    });
  }

  /* ---------- Runs of maths inside the text ---------- */

  function mathy(toks, j, depth) {
    const t = toks[j];
    if (t.k === 'num' || t.k === 'op') return true;
    if (t.k === 'word') return !!(t.parts || t.tex);
    if (t.k !== 'ch') return false;
    if (MATH_CHARS.includes(t.t)) return true;
    if (t.t === "'") return glued(t) && j > 0 && !!toks[j - 1].parts;
    if (t.t === ',') return depth > 0;
    return false;
  }

  // Partner index of each matched bracket in toks[a..b).
  function pairs(toks, a, b) {
    const match = {};
    const stack = [];
    for (let k = a; k < b; k++) {
      const t = toks[k];
      if (t.k !== 'ch') continue;
      if (t.t === '(' || t.t === '[') stack.push(k);
      else if (t.t === ')' || t.t === ']') {
        const want = t.t === ')' ? '(' : '[';
        if (stack.length && toks[stack[stack.length - 1]].t === want) {
          const o = stack.pop();
          match[o] = k;
          match[k] = o;
        }
      }
    }
    return match;
  }

  // Drop loose ends: an unclosed bracket, or a sign with nothing after it.
  function trim(toks, a, b) {
    for (;;) {
      if (a >= b) return [a, b];
      const m = pairs(toks, a, b);
      const s = toks[a], e = toks[b - 1];
      if (s.k === 'ch' && (LEAD_DROP.includes(s.t) || ((s.t === '(' || s.t === '[') && m[a] == null))) { a++; continue; }
      if (e.k === 'op' || (e.k === 'ch' && (TRAIL_DROP.includes(e.t) || ((e.t === ')' || e.t === ']') && m[b - 1] == null)))) { b--; continue; }
      // A bracket left open inside the run ("cm^2 (3 s.f.)") ends the maths there.
      let cut = -1;
      for (let k = a; k < b && cut < 0; k++) {
        if (toks[k].k === 'ch' && '()[]'.includes(toks[k].t) && m[k] == null) cut = k;
      }
      if (cut > a) { b = cut; continue; }
      return [a, b];
    }
  }

  // Worth typesetting: a variable, a function or a sign, not a lone number.
  function worth(toks, a, b) {
    for (let k = a; k < b; k++) {
      const t = toks[k];
      if (t.k === 'op' || t.deg || (t.unit && hasPower(toks, k))) return true;
      if (t.k === 'word' && !t.unit) return true;
      if (t.k === 'ch' && '=/^*<>_!+~|'.includes(t.t)) return true;
    }
    return false;
  }

  /* ---------- One run to TeX ---------- */

  function partTex(p, ctx) {
    if (NAMES[p]) return NAMES[p].tex;
    if (ctx.vectors && (p === 'i' || p === 'j' || p === 'k')) return '\\mathbf{' + p + '}';
    return p;
  }

  function startsAtom(st, j) {
    const t = st.toks[j];
    if (!t) return false;
    if (t.k === 'num') return true;
    if (t.k === 'word') return !!(t.parts || t.tex) && !t.unit;
    return (t.t === '(' || t.t === '[') && st.match[j] != null;
  }

  // "x" written for multiplication: 3 x 10^4, (3pq^2)^4 x 2p. In physics any spaced x between terms.
  function isTimes(st, tok, prev, end) {
    if (tok.t !== 'x' || !tok.sp || st.i >= end) return false;
    const next = st.toks[st.i];
    if (!next.sp || !prev || prev.k !== 'atom') return false;
    if (!(next.k === 'num' || next.t === '(' || (next.k === 'word' && (next.parts || next.tex) && !next.unit))) return false;
    return st.ctx.subject === 'physics' || prev.num || prev.group || /[})]$/.test(prev.tex);
  }

  // What follows ^ or _: a bracket, a signed number (with "/2" kept inline), or a word.
  function script(st, sub, end) {
    let t = st.toks[st.i];
    if (st.i >= end || !glued(t)) return null;
    if ((t.t === '(' || t.t === '[') && st.match[st.i] != null) {
      const close = st.match[st.i];
      st.i++;
      return seq(st, close, true).tex;
    }
    let s = '';
    if (!sub && (t.t === '-' || t.t === '+')) {
      s = t.t;
      st.i++;
      t = st.toks[st.i];
      if (st.i >= end || !glued(t)) return s;
    }
    if (t.k === 'num') {
      s += t.t;
      st.i++;
      const sl = st.toks[st.i], d = st.toks[st.i + 1];
      if (!sub && st.i + 1 < end && glued(sl) && sl.t === '/' && glued(d) && d.k === 'num') { s += '/' + d.t; st.i += 2; }
      return s;
    }
    if (t.k === 'word' && (t.parts || t.tex)) {
      st.i++;
      return s + (t.tex || t.parts.map((p) => partTex(p, st.ctx)).join(' '));
    }
    return s || null;
  }

  // Powers, subscripts and primes stuck to an atom: x^2, u_n, l1, f'(x), log2, s-1 (a unit).
  function postfix(st, a, end) {
    for (;;) {
      const n = st.toks[st.i];
      if (st.i >= end || !glued(n)) return;
      if (n.t === '^' || n.t === '_') {
        st.i++;
        const s = script(st, n.t === '_', end);
        if (s == null) { a.tex += n.t === '^' ? '\\wedge' : '\\_'; continue; }
        const flag = n.t === '^' ? 'sup' : 'sub';
        if (a[flag]) { a.tex = '{' + a.tex + '}'; a.sup = a.sub = false; }
        a.tex += n.t + '{' + s + '}';
        a[flag] = true;
        a.scripted = true;
      } else if (n.t === "'" && (a.letter || a.fn)) {
        a.tex += "'";
        st.i++;
      } else if (n.k === 'num' && !a.sub && (a.letter || a.tex === '\\log')) {
        a.tex += '_{' + n.t + '}';
        a.sub = true;
        st.i++;
      } else if (a.unit && n.t === '-' && st.i + 1 < end && glued(st.toks[st.i + 1]) && st.toks[st.i + 1].k === 'num') {
        a.tex += '^{-' + st.toks[st.i + 1].t + '}';
        st.i += 2;
      } else return;
    }
  }

  // sin 2x, ln(0.8), cos^2 theta: the function takes the next term as its argument.
  function bindArgument(st, a, end, inScript) {
    if (st.i >= end || !startsAtom(st, st.i)) return;
    let tex = item(st, [], inScript, end).tex;
    while (st.i < end && glued(st.toks[st.i]) && st.toks[st.i].t !== '(' && startsAtom(st, st.i)) {
      tex += ' ' + item(st, [], inScript, end).tex;
    }
    a.tex += ' ' + tex;
    a.fn = false;
  }

  function root(st, end) {
    if (st.i < end && st.toks[st.i].t === '(' && st.match[st.i] != null) {
      const close = st.match[st.i];
      st.i++;
      return { k: 'atom', tex: '\\sqrt{' + seq(st, close, false).tex + '}' };
    }
    if (startsAtom(st, st.i) && st.i < end) return { k: 'atom', tex: '\\sqrt{' + item(st, [], false, end).tex + '}' };
    return { k: 'atom', tex: '\\sqrt{\\phantom{x}}' };
  }

  // One term (atom) or sign (op) from the token stream.
  function item(st, items, inScript, end) {
    const tok = st.toks[st.i];
    const prev = items[items.length - 1];
    st.i++;
    let a;
    if (tok.k === 'num') a = { k: 'atom', tex: tok.t.replace(/e([+-]?\d+)$/, ' \\times 10^{$1}'), num: true };
    else if (tok.k === 'op') return { k: 'op', tex: OPS[tok.t], sp: tok.sp };
    else if (tok.k === 'word') {
      if (tok.times || isTimes(st, tok, prev, end)) return { k: 'op', tex: '\\times', sp: tok.sp };
      const one = tok.parts && tok.parts.length === 1 ? NAMES[tok.parts[0]] : null;
      if (one && one.root) a = root(st, end);
      else if (tok.unit) a = { k: 'atom', tex: tok.tex, unit: true, deg: tok.deg };
      else if (tok.tex) a = { k: 'atom', tex: tok.tex };
      else {
        a = { k: 'atom', tex: tok.parts.map((p) => partTex(p, st.ctx)).join(' '), fn: !!(one && one.fn), letter: tok.parts.length === 1 && !one };
      }
    } else {
      const c = tok.t;
      if ((c === '(' || c === '[') && st.match[st.i - 1] != null) {
        const inner = seq(st, st.match[st.i - 1], inScript);
        a = { k: 'atom', tex: c + inner.tex + (c === '(' ? ')' : ']'), group: c === '(', inner: inner.items };
      } else if (c === '*') {
        const n = st.toks[st.i];
        return { k: 'op', tex: n && n.k === 'num' ? '\\times' : '', sp: tok.sp };
      } else return { k: 'op', tex: CHARS[c] || c, sp: tok.sp };
    }
    a.sp = tok.sp;
    postfix(st, a, end);
    if (a.fn) bindArgument(st, a, end, inScript);
    return a;
  }

  // Turn a/b into \frac{a}{b}. The numerator is the run of terms just before the
  // slash (back to the last sign); the denominator is the next term. Outer
  // brackets around either part are dropped. A slash between units stays a slash.
  function fractions(items) {
    const out = [];
    for (let j = 0; j < items.length; j++) {
      let it = items[j];
      // (1/2)(9^2): a bracket holding only a fraction loses its brackets, unless it
      // follows a number (2(1/2) is not 2½) or a name (f(1/2)).
      if (it.group && !it.scripted && it.inner.length === 1 && it.inner[0].frac) {
        const p = out[out.length - 1];
        if (!p || p.k === 'op' || p.group || p.frac) it = { k: 'atom', tex: it.inner[0].tex, frac: true, sp: it.sp };
      }
      if (it.k === 'op' && it.tex === '/') {
        // A spaced slash divides the whole product before it: 7.90 x 10^-11 / c^2.
        const spaced = it.sp && items[j + 1] && items[j + 1].sp;
        const inProduct = (x) => x.k === 'atom' || (spaced && (x.tex === '\\times' || x.tex === ''));
        let n = out.length;
        while (n > 0 && inProduct(out[n - 1])) n--;
        while (n < out.length && out[n].k === 'op') n++;
        const num = out.slice(n), den = items[j + 1];
        if (num.length && den && den.k === 'atom' && !den.unit && !num[num.length - 1].unit) {
          out.splice(n);
          // Full-size fractions read better on a phone; a fraction inside one stays small.
          const small = (s) => s.replace(/\\dfrac/g, '\\frac');
          out.push({ k: 'atom', tex: '\\dfrac{' + small(bare(num)) + '}{' + small(bare([den])) + '}', frac: true, sp: num[0].sp });
          j++;
          continue;
        }
      }
      out.push(it);
    }
    return out;
  }

  function bare(atoms) {
    if (atoms.length === 1 && atoms[0].group && !atoms[0].scripted) return join(atoms[0].inner);
    return join(atoms);
  }

  function join(items) {
    let s = '';
    items.forEach((it, j) => {
      const p = items[j - 1];
      if (p && !it.deg) {
        if (it.unit) s += '\\,';
        else if (p.num && it.num) s += '\\ ';
        else s += ' ';
      }
      s += it.tex;
    });
    return s;
  }

  // Parse up to (not including) index `end`, then step past it (the closing bracket).
  function seq(st, end, inScript) {
    const items = [];
    while (st.i < end) items.push(item(st, items, inScript, end));
    st.i = end + 1;
    const out = inScript ? items : fractions(items);
    return { tex: join(out), items: out };
  }

  function toTex(run, subject, raw) {
    const st = {
      toks: run, i: 0, match: pairs(run, 0, run.length),
      ctx: { subject, vectors: subject === 'maths' && VECTORS.test(raw) }
    };
    return seq(st, run.length, false).tex;
  }

  function segments(text, subject) {
    text = String(text == null ? '' : text);
    const toks = tokenize(text);
    classify(toks, subject);
    const segs = [];
    let last = 0;
    let i = 0;
    while (i < toks.length) {
      let j = i;
      let depth = 0;
      while (j < toks.length && mathy(toks, j, depth)) {
        const t = toks[j].t;
        if (t === '(' || t === '[') depth++;
        else if ((t === ')' || t === ']') && depth > 0) depth--;
        j++;
      }
      if (j === i) { i++; continue; }
      const [a, b] = trim(toks, i, j);
      if (a < b && worth(toks, a, b)) {
        const from = toks[a].at, to = toks[b - 1].end;
        const raw = text.slice(from, to);
        if (from > last) segs.push({ text: text.slice(last, from) });
        segs.push({ text: raw, tex: toTex(toks.slice(a, b), subject, raw) });
        last = to;
      }
      i = j;
    }
    if (last < text.length) segs.push({ text: text.slice(last) });
    return segs;
  }

  const api = { segments };
  if (typeof window !== 'undefined') window.MathTex = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
