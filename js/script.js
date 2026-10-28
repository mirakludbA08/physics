/* Physics Notes — site-wide behaviour.
   Builds the sidebar, the "on this page" list, prev/next links, step-by-step
   derivations and quick-check questions. Every page loads this file.
   To add a page: add it to SITE below and it appears everywhere. */
(function () {
  'use strict';

  const SITE = [
    {
      level: 'AS', unit: 'Unit 1', code: 'WPH11', name: 'Mechanics & Materials',
      pages: [
        ['Motion.html', 'Motion', 'SUVAT, motion graphs, vectors and projectiles'],
        ['Forces_Momentum.html', 'Forces & Momentum', "Newton's laws, free-body diagrams, momentum in 1D"],
        ['Moments.html', 'Moments', 'Moments, centre of gravity, equilibrium'],
        ['Energy.html', 'Energy', 'Work, kinetic & potential energy, power, efficiency'],
        ['Density_Upthrust_VisDrag.html', 'Density, Upthrust & Viscous Drag', "Archimedes, Stokes' law, terminal velocity"],
        ['Stretching_Materials.html', 'Stretching Materials', "Hooke's law, stress, strain, Young modulus"]
      ]
    },
    {
      level: 'AS', unit: 'Unit 2', code: 'WPH12', name: 'Waves & Electricity',
      pages: [
        ['Waves.html', 'Progressive Waves', 'Transverse & longitudinal waves, v = fλ, intensity, pulse-echo'],
        ['Superposition_Stationary_Waves.html', 'Superposition & Stationary Waves', 'Phase, path difference, interference, standing waves'],
        ['Refraction_Diffraction_Polarisation.html', 'Refraction, Diffraction & Polarisation', "Snell's law, TIR, gratings, polarisation"],
        ['Particle_Nature_Light.html', 'Particle Nature of Light', 'Photons, photoelectric effect, energy levels, de Broglie'],
        ['Current_Resistance.html', 'Current, P.D. & Resistance', 'I = nqvA, resistivity, I–V graphs, power'],
        ['DC_Circuits.html', 'Circuits, Potential Dividers & E.M.F.', 'Series & parallel, potential dividers, internal resistance']
      ]
    },
    {
      level: 'A2', unit: 'Unit 4', code: 'WPH14', name: 'Further Mechanics, Fields & Particles',
      pages: [
        ['Further_Momentum.html', 'Impulse & 2D Collisions', 'Impulse, 2D momentum, elastic & inelastic collisions'],
        ['Circular_Motion.html', 'Circular Motion', 'Radians, angular velocity, centripetal force'],
        ['Electric_Fields.html', 'Electric Fields', "Coulomb's law, field strength, potential"],
        ['Capacitors.html', 'Capacitors', 'Capacitance, energy stored, RC charge & discharge'],
        ['Magnetic_Fields_Induction.html', 'Magnetic Fields & Induction', "F = BIl, F = Bqv, Faraday's & Lenz's laws"],
        ['Nuclear_Particle_Physics.html', 'Nuclear & Particle Physics', 'Alpha scattering, accelerators, quarks & leptons']
      ]
    },
    {
      level: 'A2', unit: 'Unit 5', code: 'WPH15', name: 'Thermodynamics, Radiation, Oscillations & Cosmology',
      pages: [
        ['Thermodynamics.html', 'Thermodynamics', 'Heat capacity, latent heat, ideal gases, kinetic theory'],
        ['Nuclear_Decay.html', 'Nuclear Decay', 'Binding energy, α β γ, half-life, exponential decay'],
        ['Oscillations.html', 'Oscillations', 'Simple harmonic motion, damping, resonance'],
        ['Gravitational_Fields.html', 'Gravitational Fields', 'Newton\'s law of gravitation, potential, orbits'],
        ['Astrophysics_Cosmology.html', 'Astrophysics & Cosmology', 'Stars, HR diagram, distances, redshift, Hubble']
      ]
    },
    {
      level: 'AS + A2', unit: 'Units 3 & 6', code: 'WPH13 / WPH16', name: 'Practical Skills',
      pages: [
        ['Practical_Skills.html', 'Practical Skills & Uncertainties', 'Uncertainties, graphs, log plots, all 16 core practicals']
      ]
    }
  ];
  window.PHYSICS_SITE = SITE;

  const scriptSrc = document.currentScript && document.currentScript.src;
  const ROOT = scriptSrc ? new URL('../', scriptSrc) : new URL('./', location.href);
  const here = decodeURIComponent(location.pathname.split('/').pop() || 'index.html') || 'index.html';
  const href = (file) => (file === 'index.html' ? new URL('index.html', ROOT) : new URL('pages/' + file, ROOT)).href;
  const flat = [];
  SITE.forEach((g) => g.pages.forEach((p) => flat.push({ file: p[0], title: p[1], blurb: p[2], group: g })));
  const current = flat.find((p) => p.file === here);

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  const levelClass = (level) => (level === 'AS' ? 'level-as' : level === 'A2' ? 'level-a2' : '');

  /* ---------- Sidebar ---------- */
  function buildSidebar() {
    let nav = document.querySelector('nav.sidebar');
    if (!nav) {
      nav = el('nav', 'sidebar');
      document.body.prepend(nav);
    }
    nav.setAttribute('aria-label', 'Topics');
    nav.id = 'site-nav';
    nav.innerHTML = '';

    const logo = el('a', 'logo', 'Physics Notes');
    logo.href = href('index.html');
    nav.appendChild(logo);

    const homeList = el('ul', 'nav-links');
    const homeLi = el('li');
    const homeA = el('a', 'nav-link' + (here === 'index.html' ? ' active' : ''), 'Home');
    homeA.href = href('index.html');
    homeLi.appendChild(homeA);
    homeList.appendChild(homeLi);
    nav.appendChild(homeList);

    SITE.forEach((g, gi) => {
      const isCurrent = g.pages.some((p) => p[0] === here);
      const group = el('div', 'nav-group' + (isCurrent ? ' open' : ''));
      const head = el('button', 'nav-group-head');
      head.type = 'button';
      head.innerHTML =
        '<span class="nav-level">' + g.level + ' · ' + g.unit + '</span>' +
        '<span class="nav-group-name">' + g.name + '</span>' +
        '<span class="chev" aria-hidden="true">›</span>';
      head.setAttribute('aria-expanded', String(isCurrent));
      head.setAttribute('aria-controls', 'nav-group-' + gi);
      head.addEventListener('click', () => {
        const open = group.classList.toggle('open');
        head.setAttribute('aria-expanded', String(open));
      });
      const list = el('ul', 'nav-links');
      list.id = 'nav-group-' + gi;
      g.pages.forEach(([file, title]) => {
        const li = el('li');
        const a = el('a', 'nav-link' + (file === here ? ' active' : ''));
        a.textContent = title;
        a.href = href(file);
        if (file === here) a.setAttribute('aria-current', 'page');
        li.appendChild(a);
        list.appendChild(li);
      });
      group.append(head, list);
      nav.appendChild(group);
    });

    // Mobile toggle + scrim
    const toggle = el('button', 'menu-toggle', '☰ Topics');
    toggle.type = 'button';
    toggle.setAttribute('aria-controls', 'site-nav');
    toggle.setAttribute('aria-expanded', 'false');
    const scrim = el('div', 'nav-scrim');
    const setOpen = (open) => {
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? '✕ Close' : '☰ Topics';
    };
    toggle.addEventListener('click', () => setOpen(!document.body.classList.contains('nav-open')));
    scrim.addEventListener('click', () => setOpen(false));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    document.body.append(toggle, scrim);

    const active = nav.querySelector('a.active');
    if (active) nav.scrollTop = Math.max(0, active.offsetTop - nav.clientHeight / 2);
  }

  /* ---------- Topic chips, contents list, prev/next ---------- */
  function slug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section';
  }

  function buildTopicChrome() {
    const page = document.querySelector('.content .page') || document.querySelector('.content');
    if (!page || !current) return;
    const title = page.querySelector('.main-title');

    if (!page.querySelector('.topic-meta') && title) {
      const meta = el('div', 'topic-meta');
      meta.innerHTML =
        '<span class="chip ' + levelClass(current.group.level) + '">' + current.group.level + ' · ' + current.group.unit + ' · ' + current.group.code + '</span>' +
        '<span class="chip">' + current.group.name + '</span>';
      title.before(meta);
    }

    const heads = Array.from(page.querySelectorAll('h2.section-title'));
    const used = new Set();
    heads.forEach((h) => {
      if (!h.id) {
        let id = slug(h.textContent);
        while (used.has(id) || document.getElementById(id)) id += '-x';
        h.id = id;
      }
      used.add(h.id);
    });
    let toc = page.querySelector('nav.toc');
    if (!toc && heads.length > 2) {
      toc = el('nav', 'toc');
      const intro = page.querySelector('.IntroductionText');
      (intro || title || page.firstChild).after(toc);
    }
    if (toc && heads.length > 0) {
      toc.setAttribute('aria-label', 'On this page');
      const items = heads.map((h) => '<li><a href="#' + h.id + '">' + h.textContent.trim() + '</a></li>').join('');
      toc.innerHTML = '<span class="toc-label">On this page</span><ol>' + items + '</ol>';
    }

    const i = flat.indexOf(current);
    const prev = flat[i - 1];
    const next = flat[i + 1];
    let pn = page.querySelector('.page-nav');
    if (!pn) {
      pn = el('nav', 'page-nav');
      page.appendChild(pn);
    }
    pn.setAttribute('aria-label', 'Previous and next topic');
    pn.innerHTML =
      (prev ? '<a class="prev" href="' + href(prev.file) + '"><small>‹ Previous</small><strong>' + prev.title + '</strong></a>' : '') +
      (next ? '<a class="next" href="' + href(next.file) + '"><small>Next ›</small><strong>' + next.title + '</strong></a>' : '');
  }

  /* ---------- Home page unit cards ---------- */
  function buildUnitGrid() {
    const grid = document.querySelector('[data-fill="units"]');
    if (!grid) return;
    grid.innerHTML = '';
    SITE.forEach((g) => {
      const kind = g.level === 'AS' ? 'as' : g.level === 'A2' ? 'a2' : 'prac';
      const card = el('section', 'unit-card ' + kind);
      card.innerHTML =
        '<header><div class="unit-code">' + g.level + ' · ' + g.unit + ' · ' + g.code + '</div><h3>' + g.name + '</h3></header>';
      const ul = el('ul');
      g.pages.forEach(([file, title, blurb]) => {
        const li = el('li');
        li.innerHTML = '<a href="' + href(file) + '"><strong>' + title + '</strong><span>' + blurb + '</span></a>';
        ul.appendChild(li);
      });
      card.appendChild(ul);
      grid.appendChild(card);
    });
  }

  /* ---------- Step-by-step derivations ----------
     <div class="derive" data-title="Deriving ..." data-spec="derive|use|off">
       <div class="step"> ... </div> ...
     </div> */
  const SPEC_TAGS = {
    derive: ['req', 'Spec: you must be able to derive this'],
    use: ['use', 'Derivation not required · you only need to use the result'],
    off: ['offspec', 'Not part of the Edexcel spec']
  };
  function buildDerivations() {
    document.querySelectorAll('.derive').forEach((box) => {
      if (box.dataset.ready) return;
      box.dataset.ready = '1';
      const steps = Array.from(box.querySelectorAll(':scope > .step'));
      const head = el('div', 'derive-head');
      const t = el('span', 'derive-title');
      t.textContent = box.dataset.title || 'Derivation';
      head.appendChild(t);
      const spec = SPEC_TAGS[box.dataset.spec];
      if (spec) head.appendChild(el('span', 'tag ' + spec[0], spec[1]));
      const wrap = el('div', 'derive-steps');
      steps.forEach((s) => wrap.appendChild(s));
      box.prepend(head);
      box.appendChild(wrap);
      if (steps.length < 2) return;

      box.classList.add('js');
      const controls = el('div', 'derive-controls');
      const next = el('button', 'btn', 'Next step ▶');
      const all = el('button', 'btn ghost', 'Show all');
      const reset = el('button', 'btn ghost', 'Reset');
      const count = el('span', 'derive-count');
      [next, all, reset].forEach((b) => (b.type = 'button'));
      controls.append(next, all, reset, count);
      box.appendChild(controls);

      let shown = 1;
      const render = (animateFrom) => {
        steps.forEach((s, i) => {
          s.classList.toggle('hidden', i >= shown);
          s.classList.toggle('revealed', animateFrom != null && i >= animateFrom && i < shown);
        });
        count.textContent = 'Step ' + shown + ' of ' + steps.length;
        next.disabled = all.disabled = shown >= steps.length;
      };
      next.addEventListener('click', () => {
        if (shown < steps.length) { shown++; render(shown - 1); }
      });
      all.addEventListener('click', () => { const from = shown; shown = steps.length; render(from); });
      reset.addEventListener('click', () => { shown = 1; render(); });
      render();
    });
  }

  /* ---------- Quick-check multiple choice ----------
     <div class="mcq"><p class="mcq-q">..</p><div class="mcq-options">
       <button>..</button><button data-correct>..</button></div>
       <div class="mcq-why">..</div></div> */
  function buildQuizzes() {
    document.querySelectorAll('.mcq').forEach((q) => {
      if (q.dataset.ready) return;
      q.dataset.ready = '1';
      if (!q.querySelector('.mcq-label')) q.prepend(el('span', 'mcq-label', q.dataset.label || 'Quick check'));
      const options = Array.from(q.querySelectorAll('.mcq-options button'));
      options.forEach((b) => {
        b.type = 'button';
        b.addEventListener('click', () => {
          if (q.classList.contains('done')) return;
          if (b.hasAttribute('data-correct')) {
            b.classList.add('correct');
            q.classList.add('done');
          } else {
            b.classList.remove('wrong');
            void b.offsetWidth;
            b.classList.add('wrong');
          }
        });
      });
    });
  }

  function init() {
    buildSidebar();
    buildTopicChrome();
    buildUnitGrid();
    buildDerivations();
    buildQuizzes();
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) setTimeout(() => target.scrollIntoView(), 0);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
