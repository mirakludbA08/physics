/* IALqBank — question bank behaviour.
   Reads the subject from ?s= (physics, chemistry, biology or maths), loads that
   subject's data file, then renders papers, topic filters, keyword search,
   hidden answers and the notes drawer. */
(function () {
  'use strict';

  const SUBJECTS = {
    physics: { title: 'Physics question bank', blurb: 'Past paper questions for Pearson Edexcel International AS and A Level Physics, grouped by paper. Answers stay hidden until you choose to reveal them, and each one opens into step-by-step working.' },
    chemistry: { title: 'Chemistry question bank', blurb: 'Past paper questions for Pearson Edexcel International AS and A Level Chemistry, grouped by paper. Answers stay hidden until you choose to reveal them, and each one opens into step-by-step working.' },
    biology: { title: 'Biology question bank', blurb: 'Past paper questions for Pearson Edexcel International AS and A Level Biology, grouped by paper. Answers stay hidden until you choose to reveal them, and each one opens into step-by-step working.' },
    maths: { title: 'Maths question bank', blurb: 'Past paper topical questions for Pearson Edexcel International AS and A Level Mathematics, grouped by paper. Answers stay hidden until you choose to reveal them, and each one opens into step-by-step working.' }
  };

  const params = new URLSearchParams(location.search);
  const subject = SUBJECTS[params.get('s')] ? params.get('s') : 'physics';
  document.body.dataset.subject = subject;
  document.title = SUBJECTS[subject].title + ' · IALqBank';
  document.getElementById('subject-title').textContent = SUBJECTS[subject].title;
  document.getElementById('subject-blurb').textContent = SUBJECTS[subject].blurb;
  document.querySelectorAll('.subject-tab').forEach((a) => {
    a.classList.toggle('active', a.dataset.subject === subject);
  });

  const list = document.getElementById('question-list');
  const search = document.getElementById('q-search');
  const filters = document.getElementById('topic-filters');
  const count = document.getElementById('result-count');
  const drawer = document.getElementById('notes-drawer');
  const scrim = document.getElementById('drawer-scrim');
  const notesBody = document.getElementById('notes-body');
  const notesToggle = document.querySelector('.notes-toggle');

  let all = [];
  let data = { papers: [], notes: [] };
  let activeBroad = '';   // broad topic picked in the filter panel, '' for all
  let activeSub = '';     // subtopic picked under that broad topic, '' for all
  const expanded = new Set(); // broad topics whose subtopic list is open
  let TAXONOMY_FOR_SUBJECT = []; // broad topics and subtopics for this subject

  /* Put each question into a broad topic and subtopic. The question's own topic
     and keywords are tried first; the paper title is only a fallback. */
  function classify(text) {
    for (const b of TAXONOMY_FOR_SUBJECT) {
      for (const s of b.subs) {
        if (s.rx.test(text)) return { broad: b.broad, sub: s.name };
      }
    }
    return null;
  }
  function assignTopic(q) {
    const hit = classify([q.topic, (q.keywords || []).join(' ')].join(' | ')) ||
      classify(q.paper.title) || { broad: 'Other', sub: 'General' };
    q.broad = hit.broad;
    q.sub = hit.sub;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- Search ---------- */
  // Split the query into words so "ball table" matches a question containing both.
  function matches(q, terms) {
    if (activeBroad && q.broad !== activeBroad) return false;
    if (activeSub && q.sub !== activeSub) return false;
    if (!terms.length) return true;
    const haystack = [q.topic, q.paper.code, q.paper.title, q.no, q.question, q.answer, q.keywords.join(' ')]
      .join(' ')
      .toLowerCase();
    return terms.every((t) => haystack.includes(t));
  }

  /* ---------- Topic panel: broad topics, each with an arrow to its subtopics ---------- */
  function renderFilters() {
    // Count questions per broad topic and per subtopic, keeping taxonomy order.
    const broadCounts = {};
    const subCounts = {};
    all.forEach((q) => {
      broadCounts[q.broad] = (broadCounts[q.broad] || 0) + 1;
      const key = q.broad + '\u0000' + q.sub;
      subCounts[key] = (subCounts[key] || 0) + 1;
    });
    const order = (TAXONOMY_FOR_SUBJECT || []).map((b) => b.broad).concat(['Other']);
    const broads = order.filter((b) => broadCounts[b]);

    filters.innerHTML = '';

    const all_ = el('button', 'filter-chip' + (!activeBroad ? ' active' : ''), 'All topics (' + all.length + ')');
    all_.type = 'button';
    all_.setAttribute('aria-pressed', String(!activeBroad));
    all_.addEventListener('click', () => {
      activeBroad = '';
      activeSub = '';
      renderFilters();
      render();
    });
    filters.appendChild(all_);

    broads.forEach((broad) => {
      const group = el('div', 'topic-group' + (expanded.has(broad) ? ' open' : ''));
      const row = el('div', 'topic-row');

      const pick = el('button', 'topic-pick' + (activeBroad === broad && !activeSub ? ' active' : ''));
      pick.type = 'button';
      pick.appendChild(el('span', 'topic-name', broad));
      pick.appendChild(el('span', 'topic-count', String(broadCounts[broad])));
      pick.setAttribute('aria-pressed', String(activeBroad === broad && !activeSub));
      pick.addEventListener('click', () => {
        activeBroad = broad;
        activeSub = '';
        renderFilters();
        render();
      });
      row.appendChild(pick);

      const subs = (TAXONOMY_FOR_SUBJECT || []).find((b) => b.broad === broad);
      const names = subs ? subs.subs.map((s) => s.name) : [];
      if (broad === 'Other') names.push('General');
      const visible = names.filter((n) => subCounts[broad + '\u0000' + n]);
      if (visible.length) {
        const arrow = el('button', 'topic-arrow', '›');
        arrow.type = 'button';
        arrow.setAttribute('aria-label', 'Show ' + broad + ' subtopics');
        arrow.setAttribute('aria-expanded', String(expanded.has(broad)));
        arrow.addEventListener('click', () => {
          if (expanded.has(broad)) expanded.delete(broad);
          else expanded.add(broad);
          renderFilters();
        });
        row.appendChild(arrow);
      }
      group.appendChild(row);

      if (visible.length && expanded.has(broad)) {
        const list = el('div', 'sub-list');
        visible.forEach((name) => {
          const s = el('button', 'sub-chip' + (activeBroad === broad && activeSub === name ? ' active' : ''));
          s.type = 'button';
          s.appendChild(el('span', 'topic-name', name));
          s.appendChild(el('span', 'topic-count', String(subCounts[broad + '\u0000' + name])));
          s.setAttribute('aria-pressed', String(activeBroad === broad && activeSub === name));
          s.addEventListener('click', () => {
            activeBroad = broad;
            activeSub = name;
            renderFilters();
            render();
          });
          list.appendChild(s);
        });
        group.appendChild(list);
      }
      filters.appendChild(group);
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
    const shown = all.filter((q) => matches(q, terms));
    list.innerHTML = '';

    if (!shown.length) {
      list.appendChild(el('p', 'empty', 'No questions match. Try a shorter word, such as "projectile" or "ball".'));
    } else {
      // Group by paper so the list still reads as past papers.
      let currentPaper = null;
      shown.forEach((q) => {
        if (q.paper !== currentPaper) {
          currentPaper = q.paper;
          list.appendChild(el('h2', 'paper-head', 'Paper ' + q.paper.code + ' · ' + q.paper.title));
          if (q.paper.pdf) {
            const pdf = el('a', 'paper-pdf', 'Open the original paper (PDF)');
            pdf.href = q.paper.pdf;
            pdf.target = '_blank';
            pdf.rel = 'noopener';
            list.appendChild(pdf);
          }
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
    if (!data.notes.length) {
      notesBody.appendChild(el('p', 'drawer-unit', 'Notes for this subject are coming soon.'));
      return;
    }
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

  /* ---------- Load the subject's data file, then render ---------- */
  function loadData(name) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'js/data/' + name + '.js';
      s.onload = () => resolve(window.BANK && window.BANK[name]);
      s.onerror = () => reject(new Error('Could not load ' + s.src));
      document.head.appendChild(s);
    });
  }

  loadData(subject)
    .then((subjectData) => {
      data = subjectData || { papers: [], notes: [] };
      TAXONOMY_FOR_SUBJECT = (window.TAXONOMY && window.TAXONOMY[subject]) || [];
      all = [];
      data.papers.forEach((paper) => {
        paper.questions.forEach((q) => {
          const item = Object.assign({ paper }, q);
          assignTopic(item);
          all.push(item);
        });
      });
      renderFilters();
      renderNotes();
      render();
    })
    .catch(() => {
      list.appendChild(el('p', 'empty', 'Questions for this subject are coming soon.'));
    });
})();
