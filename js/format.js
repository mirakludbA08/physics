/* IALqBank — turns the plain-text maths and chemistry in the question data into
   readable HTML: powers as superscripts (x², 10⁻³), roots as √ with a bar,
   subscripts, Greek letters, proper signs (≤ ≥ × → ⇌) and, for chemistry and
   biology, chemical formulas and ion charges (H₂SO₄, Fe³⁺). The input is always
   escaped first, so the output is safe to put into innerHTML. */
(function () {
  'use strict';

  const ELEMENTS = new Set(('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn ' +
    'Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pt Au Hg Pb Bi Rn Ra U').split(' '));

  const GREEK = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', theta: 'θ', lambda: 'λ',
    mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ', phi: 'φ', omega: 'ω', Omega: 'Ω'
  };
  const GREEK_RX = new RegExp('(?<![A-Za-z])(' + Object.keys(GREEK).join('|') + ')(?![A-Za-z])', 'g');

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Index of the bracket that closes the one at `open`, or -1.
  function matchParen(s, open) {
    let depth = 0;
    for (let i = open; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  // sqrt(...) becomes √ with a bar over the contents; nested roots work.
  function roots(s) {
    let out = '';
    let i = 0;
    while (i < s.length) {
      const at = s.indexOf('sqrt(', i);
      if (at === -1) { out += s.slice(i); break; }
      const close = matchParen(s, at + 4);
      if (close === -1) { out += s.slice(i); break; }
      out += s.slice(i, at) + '√<span class="rad">' + roots(s.slice(at + 5, close)) + '</span>';
      i = close + 1;
    }
    return out;
  }

  const minus = (t) => t.replace(/-/g, '−');

  // ^(...), ^-3, ^2.5, ^n, ^2+ (charges) become superscripts.
  function powers(s) {
    let out = '';
    let i = 0;
    while (i < s.length) {
      const at = s.indexOf('^', i);
      if (at === -1) { out += s.slice(i); break; }
      out += s.slice(i, at);
      if (s[at + 1] === '(') {
        const close = matchParen(s, at + 1);
        if (close !== -1) {
          out += '<sup>' + minus(powers(s.slice(at + 2, close))) + '</sup>';
          i = close + 1;
          continue;
        }
      }
      const m = s.slice(at + 1).match(/^([+-]?\d+(?:\.\d+)?[+-]?|[+-]|[a-zA-Z](?![a-zA-Z]))/);
      if (m) {
        out += '<sup>' + minus(m[1]) + '</sup>';
        i = at + 1 + m[1].length;
      } else {
        out += '^';
        i = at + 1;
      }
    }
    return out;
  }

  // Chemical formulas: H2SO4 -> H₂SO₄, Ca(OH)2 -> Ca(OH)₂, Fe3+ -> Fe³⁺, NH4+ -> NH₄⁺.
  function formula(token) {
    const parts = token.match(/[A-Z][a-z]?|\d+|[()]/g) || [];
    if (!parts.some((p) => /^\d+$/.test(p))) return null;
    if (!parts.every((p) => /^\d+$/.test(p) || p === '(' || p === ')' || ELEMENTS.has(p))) return null;
    return token.replace(/([A-Za-z)])(\d+)/g, '$1<sub>$2</sub>');
  }

  const END = '(?=[\\s,.;:()\\]]|$)';   // what may follow a charge sign, including a state symbol "(aq)"

  function chemistry(s) {
    // Symbols with subscripts go first, so "Mr(H2O)" leaves "(H2O)" to be read as a formula.
    s = s.replace(/(?<![A-Za-z])Mr(?![A-Za-z])/g, 'M<sub>r</sub>')
      .replace(/(?<![A-Za-z])(p?)K(a|b|c|p|w|sp)(?![A-Za-z])/g, '$1K<sub>$2</sub>')
      .replace(/(?<![A-Za-z])Ea(?![A-Za-z])/g, 'E<sub>a</sub>');

    // Single-element ions: the digit is the charge. Fe3+ -> Fe³⁺, O2- -> O²⁻.
    // A digit before the ion is a coefficient (2Fe3+), so only letters block a match.
    s = s.replace(new RegExp('(?<![A-Za-z_>])([A-Z][a-z]?)(\\d)([+-])' + END, 'g'),
      (all, el, digit, sign) => (ELEMENTS.has(el) ? el + '<sup>' + digit + (sign === '-' ? '−' : '+') + '</sup>' : all));

    // Other ions: the digits belong to the formula. NH4+ -> NH₄⁺, Na+ -> Na⁺, OH- -> OH⁻.
    s = s.replace(new RegExp('(?<![A-Za-z_>])((?:[A-Z][a-z]?\\d*|\\((?:[A-Z][a-z]?\\d*)+\\)\\d*)+)([+-])' + END, 'g'),
      (all, body, sign) => {
        const els = body.match(/[A-Z][a-z]?/g) || [];
        if (!els.every((e) => ELEMENTS.has(e))) return all;
        return (formula(body) || body) + '<sup>' + (sign === '-' ? '−' : '+') + '</sup>';
      });

    // Plain formulas, with an optional leading coefficient: 2H2O, CO2, C6H12O6.
    s = s.replace(/(?<![A-Za-z0-9_>])(\d*)((?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\)\d*)+)(?![A-Za-z0-9])/g,
      (all, coeff, body) => {
        const f = formula(body);
        return f ? coeff + f : all;
      });

    // Charge on a bracketed complex ion: [Cu(H2O)6]2+ -> [Cu(H₂O)₆]²⁺.
    s = s.replace(new RegExp('\\](\\d?)([+-])' + END, 'g'),
      (all, digit, sign) => ']<sup>' + digit + (sign === '-' ? '−' : '+') + '</sup>');

    // Electrons in half-equations: e- -> e⁻.
    s = s.replace(new RegExp('(?<![A-Za-z])e-' + END, 'g'), 'e<sup>−</sup>');
    return s;
  }

  function format(text, subject) {
    let s = escapeHtml(String(text == null ? '' : text));

    // Signs. Equilibrium first so "<=>" does not become "≤>".
    s = s.replace(/&lt;=&gt;/g, '⇌')
      .replace(/&lt;=/g, '≤').replace(/&gt;=/g, '≥')
      .replace(/!=/g, '≠').replace(/\+\/-|\+-(?=\s?\d)/g, '±')
      .replace(/-&gt;/g, '→').replace(/=&gt;/g, '⇒').replace(/~=/g, '≈');

    // Scientific notation: 6.0 x 10^-3 -> 6.0 × 10⁻³ (not in maths, where x is a variable).
    if (subject !== 'maths') s = s.replace(/(\d)\s*[x×]\s*10(?=\^)/g, '$1 × 10');
    s = s.replace(/\*/g, '×');

    // Minus signs: a spaced hyphen between terms ("x - 3") and a leading sign ("-2x",
    // "= -286"). Hyphens inside words ("non-zero") are left alone.
    s = s.replace(/(?<=[\w)\]²³])\s-\s(?=[\w(√.])/g, ' − ')
      .replace(/(^|[\s(=,[])-(?=[\d.(√]|[a-zA-Z](?![a-z]{2}))/g, '$1−');

    // Degrees written as "deg".
    s = s.replace(/(\d)\s?deg(?![a-z])/g, '$1°');

    s = roots(s);
    s = powers(s);

    // Subscripts written with an underscore: v_y, x_(n+1), P_1.
    s = s.replace(/([A-Za-z)])_\(([^()]*)\)/g, '$1<sub>$2</sub>')
      .replace(/([A-Za-z)])_([A-Za-z0-9]+)/g, '$1<sub>$2</sub>');

    s = s.replace(GREEK_RX, (w) => GREEK[w]);
    s = s.replace(/Δ\s(?=[A-Z])/g, 'Δ');   // "Delta H" -> "ΔH"

    if (subject === 'chemistry' || subject === 'biology') s = chemistry(s);
    return s;
  }

  const api = { format };
  if (typeof window !== 'undefined') window.QFormat = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
