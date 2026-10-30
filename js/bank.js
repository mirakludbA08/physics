/* IALqBank — question bank behaviour.
   Renders the papers in window.BANK[subject], filters by topic, searches by
   topic or keyword, hides answers until revealed, and opens the notes drawer. */
(function () {
  'use strict';

  const subject = document.body.dataset.subject || 'physics';
  const data = (window.BANK && window.BANK[subject]) || { papers: [], notes: [] };

  const list = document.getElementById('question-list');
  const search = document.getElementById('q-search');
  const filters = document.getElementById('topic-filters');
  const count = document.getElementById('result-count');
  const drawer = document.getElementById('notes-drawer');
  const scrim = document.getElementById('drawer-scrim');
  const notesBody = document.getElementById('notes-body');
  const notesToggle = document.querySelector('.notes-toggle');

  // Flatten every question and attach its paper so search and render stay simple.
  const all = [];
  data.papers.forEach((paper) => {
    paper.questions.forEach((q) => all.push(Object.assign({ paper }, q)));
  });

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- Search ---------- */
  // Split the query into words so "ball table" matches a question containing both.
  function matches(q, terms, topic) {
    if (topic && q.topic !== topic) return false;
    if (!terms.length) return true;
    const haystack = [q.topic, q.paper.code, q.paper.title, q.no, q.question, q.answer, q.keywords.join(' ')]
      .join(' ')
      .toLowerCase();
    return terms.every((t) => haystack.includes(t));
  }

  let activeTopic = '';

  function renderFilters() {
    const topics = Array.from(new Set(all.map((q) => q.topic))).sort();
    filters.innerHTML = '';
    ['All topics'].concat(topics).forEach((label) => {
      const value = label === 'All topics' ? '' : label;
      const b = el('button', 'filter-chip' + (value === activeTopic ? ' active' : ''), label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(value === activeTopic));
      b.addEventListener('click', () => {
        activeTopic = value;
        renderFilters();
        render();
      });
      filters.appendChild(b);
    });
  }

  /* ---------- Question cards ---------- */
  function answerBlock(q) {
    const wrap = el('div', 'answer-block');
    wrap.hidden = true;

    const final = el('p', 'final-answer');
    final.innerHTML = '<strong>Answer:</strong> ';
    final.appendChild(document.createTextNode(q.answer));
    wrap.appendChild(final);

    if (q.steps && q.steps.length) {
      const ol = el('ol', 'steps');
      q.steps.forEach((s) => ol.appendChild(el('li', null, s)));
      wrap.appendChild(ol);
    }
    return wrap;
  }

  function card(q) {
    const article = el('article', 'q-card' + (q.status === 'pending' ? ' pending' : ''));
    const head = el('div', 'q-head');
    head.appendChild(el('span', 'q-code', q.paper.code + ' · ' + q.no));
    head.appendChild(el('span', 'q-topic', q.topic));
    head.appendChild(el('span', 'q-marks', q.marks + (q.marks === 1 ? ' mark' : ' marks')));
    article.appendChild(head);

    article.appendChild(el('p', 'q-text', q.question));

    if (q.status === 'pending') {
      article.appendChild(el('p', 'q-pending', q.answer));
      return article;
    }

    const answer = answerBlock(q);
    const btn = el('button', 'reveal-btn', 'Show answer');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', () => {
      const open = answer.hidden;
      answer.hidden = !open;
      btn.textContent = open ? 'Hide answer' : 'Show answer';
      btn.setAttribute('aria-expanded', String(open));
    });
    article.appendChild(btn);
    article.appendChild(answer);
    return article;
  }

  function render() {
    const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const shown = all.filter((q) => matches(q, terms, activeTopic));
    list.innerHTML = '';

    if (!shown.length) {
      list.appendChild(el('p', 'empty', 'No questions match. Try a shorter word, such as "projectile" or "ball".'));
    } else {
      // Group by paper so the list still reads as past papers.
      let currentPaper = null;
      shown.forEach((q) => {
        if (q.paper !== currentPaper) {
          currentPaper = q.paper;
          const h = el('h2', 'paper-head', 'Paper ' + q.paper.code + ' · ' + q.paper.title);
          list.appendChild(h);
          const pdf = el('a', 'paper-pdf', 'Open the original paper (PDF)');
          pdf.href = q.paper.pdf;
          pdf.target = '_blank';
          pdf.rel = 'noopener';
          list.appendChild(pdf);
        }
        list.appendChild(card(q));
      });
    }

    count.textContent = shown.length + (shown.length === 1 ? ' question' : ' questions') +
      (terms.length ? ' matching "' + search.value.trim() + '"' : '');
  }

  /* ---------- Notes drawer ---------- */
  function renderNotes() {
    notesBody.innerHTML = '';
    let unit = null;
    data.notes.forEach((n) => {
      if (n.unit !== unit) {
        unit = n.unit;
        notesBody.appendChild(el('p', 'drawer-unit', unit));
      }
      const a = el('a', 'drawer-link');
      a.href = n.file;
      a.appendChild(el('span', 'drawer-link-title', n.title));
      a.appendChild(el('span', 'drawer-link-blurb', n.blurb));
      notesBody.appendChild(a);
    });
  }

  function setDrawer(open) {
    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    scrim.hidden = !open;
    notesToggle.setAttribute('aria-expanded', String(open));
  }

  notesToggle.addEventListener('click', () => setDrawer(!drawer.classList.contains('open')));
  drawer.querySelector('.drawer-close').addEventListener('click', () => setDrawer(false));
  scrim.addEventListener('click', () => setDrawer(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setDrawer(false); });

  search.addEventListener('input', render);

  renderFilters();
  renderNotes();
  render();
})();
