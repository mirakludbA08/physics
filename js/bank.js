/* IALqBank — question bank behaviour.
   Reads the subject from ?s= (physics, chemistry, biology or maths), loads that
   subject's data file, then renders papers, topic filters, keyword search,
   hidden answers and the notes drawer. Questions can be marked done (hidden
   from the list) or saved for review; both lists are kept in cookies per
   subject. */
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
  document.getElementById('drawer-title').textContent = SUBJECTS[subject].title.replace(' question bank', ' notes');
  document.querySelectorAll('.subject-tab').forEach((a) => {
    a.classList.toggle('active', a.dataset.subject === subject);
  });

  const list = document.getElementById('question-list');
  const search = document.getElementById('q-search');
  const filters = document.getElementById('topic-filters');
  const count = document.getElementById('result-count');
  const viewBar = document.getElementById('view-bar');
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

  // Views: 'all' is the whole bank, 'review' is the saved review list.
  let view = 'all';
  let showDone = false;
  let done = new Set();    // question keys marked done
  let review = new Set();  // question keys saved for review

  /* ---------- Cookies: done and review lists, per subject ---------- */
  // Each list is a set of keys joined by newlines, split over several cookies
  // because one cookie holds only about 4 KB.
  const COOKIE_CHUNK = 1500;
  const COOKIE_DAYS = 365;

  function readCookie(name) {
    const hit = document.cookie.split('; ').find((c) => c.indexOf(name + '=') === 0);
    return hit ? decodeURIComponent(hit.slice(name.length + 1)) : '';
  }

  function writeCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) +
      '; max-age=' + (60 * 60 * 24 * COOKIE_DAYS) + '; path=/; SameSite=Lax';
  }

  function loadSet(name) {
    try {
      const n = parseInt(readCookie(name + '_n') || '0', 10);
      let text = '';
      for (let i = 0; i < n; i++) text += readCookie(name + '_' + i);
      return new Set(text ? text.split('\n') : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveSet(name, set) {
    try {
      const text = Array.from(set).join('\n');
      const chunks = [];
      for (let i = 0; i < text.length; i += COOKIE_CHUNK) chunks.push(text.slice(i, i + COOKIE_CHUNK));
      const old = parseInt(readCookie(name + '_n') || '0', 10);
      chunks.forEach((c, i) => writeCookie(name + '_' + i, c));
      writeCookie(name + '_n', String(chunks.length));
      for (let i = chunks.length; i < old; i++) {
        document.cookie = name + '_' + i + '=; max-age=0; path=/';
      }
    } catch (e) {
      // Cookies may be blocked; the page still works for this visit.
    }
  }

  const DONE_COOKIE = 'ialqb_done_' + subject;
  const REVIEW_COOKIE = 'ialqb_review_' + subject;

  function keyOf(q) {
    return q.paper.code + '|' + q.id;
  }

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

  /* ---------- Which questions are in the current view ---------- */
  // The view decides the pool (all questions, or only the review list). Done
  // questions are left out unless "Show done" is on.
  function pool() {
    return all.filter((q) => {
      const k = keyOf(q);
      if (view === 'review' && !review.has(k)) return false;
      if (!showDone && done.has(k)) return false;
      return true;
    });
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
    const base = pool();
    // Count questions per broad topic and per subtopic, keeping taxonomy order.
    const broadCounts = {};
    const subCounts = {};
    base.forEach((q) => {
      broadCounts[q.broad] = (broadCounts[q.broad] || 0) + 1;
      const key = q.broad + '\u0000' + q.sub;
      subCounts[key] = (subCounts[key] || 0) + 1;
    });
    const order = (TAXONOMY_FOR_SUBJECT || []).map((b) => b.broad).concat(['Other']);
    const broads = order.filter((b) => broadCounts[b]);

    filters.innerHTML = '';

    const allBtn = el('button', 'filter-chip' + (!activeBroad ? ' active' : ''), 'All topics (' + base.length + ')');
    allBtn.type = 'button';
    allBtn.setAttribute('aria-pressed', String(!activeBroad));
    allBtn.addEventListener('click', () => {
      activeBroad = '';
      activeSub = '';
      renderFilters();
      rerender();
    });
    filters.appendChild(allBtn);

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
        rerender();
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
        const list2 = el('div', 'sub-list');
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
            rerender();
          });
          list2.appendChild(s);
        });
        group.appendChild(list2);
      }
      filters.appendChild(group);
    });
  }

  /* ---------- View bar: all questions, review list, show done ---------- */
  function renderViewBar() {
    viewBar.innerHTML = '';
    const reviewCount = all.filter((q) => review.has(keyOf(q))).length;
    const doneCount = all.filter((q) => done.has(keyOf(q))).length;

    [['all', 'All questions'], ['review', 'Review later (' + reviewCount + ')']].forEach(([id, label]) => {
      const b = el('button', 'view-tab' + (view === id ? ' active' : ''), label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(view === id));
      b.addEventListener('click', () => {
        view = id;
        activeBroad = '';
        activeSub = '';
        renderViewBar();
        renderFilters();
        rerender();
      });
      viewBar.appendChild(b);
    });

    const doneToggle = el('button', 'view-tab view-tab-end' + (showDone ? ' active' : ''), 'Show done (' + doneCount + ')');
    doneToggle.type = 'button';
    doneToggle.setAttribute('aria-pressed', String(showDone));
    doneToggle.addEventListener('click', () => {
      showDone = !showDone;
      renderViewBar();
      renderFilters();
      rerender();
    });
    viewBar.appendChild(doneToggle);
  }

  /* ---------- Question cards ---------- */
  // Plain-text maths and formulas from the data, made readable (x², H₂O, √).
  // QFormat escapes its input, so the result is safe as HTML.
  function math(tag, cls, text) {
    const n = el(tag, cls);
    n.innerHTML = window.QFormat ? window.QFormat.format(text, subject) : '';
    if (!window.QFormat) n.textContent = text;
    return n;
  }

  function answerBlock(q) {
    const wrap = el('div', 'answer-block');
    wrap.hidden = true;

    const final = el('p', 'final-answer');
    final.appendChild(el('strong', null, 'Answer: '));
    final.appendChild(math('span', null, q.answer));
    wrap.appendChild(final);

    if (q.steps && q.steps.length) {
      const ol = el('ol', 'steps');
      q.steps.forEach((s) => ol.appendChild(math('li', null, s)));
      wrap.appendChild(ol);
    }
    return wrap;
  }

  // A multiple-choice answer ("B - ...") whose restated question has no options:
  // the options only exist on the paper's page.
  function optionsOnlyInImage(q) {
    if (q.status !== 'ready' || !/^\s*(option\s+)?\(?[A-D]\b\)?(\s*[:.,)\-–]|\s*$|\s+(is|because)\b)/i.test(q.answer)) return false;
    const hasOptions = /(^|[\s;(,])A[).:]\s*\S[\s\S]*(^|[\s;(,])B[).:]\s*\S/.test(q.question) ||
      /\bA\s*[-–=]\s*\S[\s\S]*\bB\s*[-–=]\s*\S/.test(q.question) || /options?\s*(are|:)/i.test(q.question);
    return !hasOptions;
  }

  // Drop-down with the question's page(s) from the paper, so the diagram shows.
  // Pages load only when the drop-down is opened.
  function imageBlock(q, openNow) {
    if (!q.images || !q.images.length) return null;
    const box = el('details', 'q-image');
    box.appendChild(el('summary', null, openNow ? 'Question image with the options A to D' : 'Question image (from the paper)'));
    const imgs = q.images.map((src) => {
      const img = el('img', 'q-image-page');
      img.dataset.src = src;
      img.alt = 'Page of the ' + q.paper.code + ' paper showing question ' + q.no;
      img.loading = 'lazy';
      box.appendChild(img);
      return img;
    });
    const load = () => imgs.forEach((img) => { if (!img.src) img.src = img.dataset.src; });
    box.addEventListener('toggle', () => { if (box.open) load(); });
    if (openNow) { box.open = true; load(); }
    return box;
  }

  // Buttons on each card: mark done, and save for review.
  function actionButtons(q) {
    const k = keyOf(q);
    const row = el('div', 'card-actions');

    const doneBtn = el('button', 'action-btn' + (done.has(k) ? ' on' : ''), done.has(k) ? 'Undo done' : 'Mark done');
    doneBtn.type = 'button';
    doneBtn.setAttribute('aria-pressed', String(done.has(k)));
    doneBtn.addEventListener('click', () => {
      if (done.has(k)) done.delete(k);
      else done.add(k);
      saveSet(DONE_COOKIE, done);
      refresh();
    });
    row.appendChild(doneBtn);

    const reviewBtn = el('button', 'action-btn' + (review.has(k) ? ' on' : ''), review.has(k) ? 'Remove from review' : 'Review later');
    reviewBtn.type = 'button';
    reviewBtn.setAttribute('aria-pressed', String(review.has(k)));
    reviewBtn.addEventListener('click', () => {
      if (review.has(k)) review.delete(k);
      else review.add(k);
      saveSet(REVIEW_COOKIE, review);
      refresh();
    });
    row.appendChild(reviewBtn);

    return row;
  }

  function card(q) {
    const k = keyOf(q);
    const article = el('article', 'q-card' + (q.status === 'pending' ? ' pending' : '') + (done.has(k) ? ' done' : ''));
    const head = el('div', 'q-head');
    head.appendChild(el('span', 'q-code', q.paper.code + ' · ' + q.no));
    head.appendChild(el('span', 'q-topic', q.topic));
    head.appendChild(el('span', 'q-marks', q.marks + (q.marks === 1 ? ' mark' : ' marks')));
    if (done.has(k)) head.appendChild(el('span', 'q-done-tag', 'Done'));
    article.appendChild(head);

    article.appendChild(math('p', 'q-text', q.question));

    const mcqImage = optionsOnlyInImage(q) && q.images && q.images.length > 0;
    if (mcqImage) article.appendChild(el('p', 'q-mcq-note', 'Multiple choice: the options are on the page from the paper below.'));
    const picture = imageBlock(q, mcqImage);
    if (picture) article.appendChild(picture);

    if (q.status === 'pending') {
      article.appendChild(math('p', 'q-pending', q.answer));
      article.appendChild(actionButtons(q));
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
    article.appendChild(actionButtons(q));
    return article;
  }

  // Cards are drawn in batches so a subject with 3,000 questions stays fast.
  const PAGE_SIZE = 40;
  let limit = PAGE_SIZE;

  function render() {
    const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const shown = pool().filter((q) => matches(q, terms));
    list.innerHTML = '';

    if (!shown.length) {
      let text = 'No questions match. Try a shorter word, such as "projectile" or "ball".';
      if (view === 'review' && !review.size) text = 'Nothing saved for review yet. Use "Review later" on any question to add it here.';
      else if (!pool().length && !showDone && done.size) text = 'Every question here is marked done. Use "Show done" to see them again.';
      list.appendChild(el('p', 'empty', text));
    } else {
      // Group by paper so the list still reads as past papers.
      let currentPaper = null;
      shown.slice(0, limit).forEach((q) => {
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

      if (shown.length > limit) {
        const more = el('button', 'show-more', 'Show more (' + (shown.length - limit) + ' left)');
        more.type = 'button';
        more.addEventListener('click', () => {
          const y = window.scrollY;
          limit += PAGE_SIZE * 2;
          render();
          window.scrollTo(0, y);
        });
        list.appendChild(more);
      }
    }

    count.textContent = shown.length + (shown.length === 1 ? ' question' : ' questions') +
      (terms.length ? ' matching "' + search.value.trim() + '"' : '');
  }

  // A new search, filter or view starts again from the first batch.
  function rerender() {
    limit = PAGE_SIZE;
    render();
  }

  // Redraw everything that depends on the done and review lists.
  function refresh() {
    renderViewBar();
    renderFilters();
    render();
  }

  /* ---------- Notes drawer ----------
     Built from the subject's notes config (js/notes-<subject>.js), the same list
     that builds the notes sidebar. Maths has no notes, so its Notes button is hidden. */
  const NOTES_SUBJECTS = ['physics', 'chemistry', 'biology'];

  function renderNotes(site, dir) {
    notesBody.innerHTML = '';
    site.filter((group) => group.pages.length).forEach((group) => {
      notesBody.appendChild(el('p', 'drawer-unit', group.level + ' · ' + group.unit + ' · ' + group.name));
      group.pages.forEach(([file, title, blurb]) => {
        const a = el('a', 'drawer-link');
        a.href = dir + file;
        a.appendChild(el('span', 'drawer-link-title', title));
        a.appendChild(el('span', 'drawer-link-blurb', blurb));
        notesBody.appendChild(a);
      });
    });
  }

  function loadNotes() {
    if (NOTES_SUBJECTS.indexOf(subject) === -1) {
      notesToggle.hidden = true;
      return;
    }
    const s = document.createElement('script');
    s.src = 'js/notes-' + subject + '.js';
    s.onload = () => {
      // The notes config also tags <html> for the notes pages' palette; the bank
      // page styles itself from <body>, so that attribute is harmless here.
      if (window.NOTES_SITE && window.NOTES_SUBJECT === subject) {
        renderNotes(window.NOTES_SITE, window.NOTES_DIR || '');
      }
    };
    s.onerror = () => {
      notesBody.appendChild(el('p', 'drawer-unit', 'Notes for this subject are coming soon.'));
    };
    document.head.appendChild(s);
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
  // Wait for a short pause in typing before filtering thousands of questions.
  let searchTimer = null;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(rerender, 150);
  });

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

  loadNotes();

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
      done = loadSet(DONE_COOKIE);
      review = loadSet(REVIEW_COOKIE);
      refresh();
    })
    .catch(() => {
      list.appendChild(el('p', 'empty', 'Questions for this subject are coming soon.'));
    });
})();
