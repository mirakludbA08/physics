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
  // Topics picked in the filter panel; any number can be on at once, none means all.
  const pickedBroad = new Set();  // whole broad topics
  const pickedSub = new Set();    // single subtopics, keyed subKey(broad, sub)
  const subKey = (broad, sub) => broad + '\u0000' + sub;
  const expanded = new Set(); // broad topics whose subtopic list is open
  let TAXONOMY_FOR_SUBJECT = []; // broad topics and subtopics for this subject

  // Views: 'all' is every question not yet done, 'review' is the saved review
  // list (also without done questions), and 'done' shows only done questions.
  let view = 'all';
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
  // Done questions appear only in the Done view; every other view leaves them out.
  function pool() {
    return all.filter((q) => {
      const k = keyOf(q);
      if (view === 'done') return done.has(k);
      if (done.has(k)) return false;
      if (view === 'review') return review.has(k);
      return true;
    });
  }

  /* ---------- Search ---------- */
  // Split the query into words so "ball table" matches a question containing both.
  function matches(q, terms) {
    if ((pickedBroad.size || pickedSub.size) && !pickedBroad.has(q.broad) && !pickedSub.has(subKey(q.broad, q.sub))) return false;
    if (!terms.length) return true;
    const haystack = [q.topic, q.paper.code, q.paper.title, q.no, q.question, q.answer, q.keywords.join(' ')]
      .join(' ')
      .toLowerCase();
    return terms.every((t) => haystack.includes(t));
  }

  /* ---------- Topic panel: broad topics, each with an arrow to its subtopics ----------
     Topics and subtopics switch on and off independently, so several can be
     combined; "All topics" clears them. */
  function pickChanged() {
    renderFilters();
    rerender();
    slideInList();
  }

  // A new list or topic swaps every question on screen, so the list slides in like a
  // new page. Typing in the search box does not, as that would flicker on every key.
  function slideInList() {
    if (!list.animate || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    list.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
      { duration: 320, easing: 'cubic-bezier(.2, .9, .2, 1)' });
  }

  function renderFilters() {
    const base = pool();
    // Count questions per broad topic and per subtopic, keeping taxonomy order.
    const broadCounts = {};
    const subCounts = {};
    base.forEach((q) => {
      broadCounts[q.broad] = (broadCounts[q.broad] || 0) + 1;
      const key = subKey(q.broad, q.sub);
      subCounts[key] = (subCounts[key] || 0) + 1;
    });
    const order = (TAXONOMY_FOR_SUBJECT || []).map((b) => b.broad).concat(['Other']);
    const broads = order.filter((b) => broadCounts[b]);
    const none = !pickedBroad.size && !pickedSub.size;

    filters.innerHTML = '';

    const allBtn = el('button', 'filter-chip' + (none ? ' active' : ''), 'All topics (' + base.length + ')');
    allBtn.type = 'button';
    allBtn.setAttribute('aria-pressed', String(none));
    allBtn.addEventListener('click', () => {
      pickedBroad.clear();
      pickedSub.clear();
      pickChanged();
    });
    filters.appendChild(allBtn);

    broads.forEach((broad) => {
      const group = el('div', 'topic-group' + (expanded.has(broad) ? ' open' : ''));
      const row = el('div', 'topic-row');

      const subs = (TAXONOMY_FOR_SUBJECT || []).find((b) => b.broad === broad);
      const names = subs ? subs.subs.map((s) => s.name) : [];
      if (broad === 'Other') names.push('General');
      const visible = names.filter((n) => subCounts[subKey(broad, n)]);
      const whole = pickedBroad.has(broad);
      const some = !whole && visible.some((n) => pickedSub.has(subKey(broad, n)));

      const pick = el('button', 'topic-pick' + (whole ? ' active' : '') + (some ? ' partial' : ''));
      pick.type = 'button';
      pick.appendChild(el('span', 'topic-name', broad));
      pick.appendChild(el('span', 'topic-count', String(broadCounts[broad])));
      pick.setAttribute('aria-pressed', whole ? 'true' : some ? 'mixed' : 'false');
      pick.addEventListener('click', () => {
        // Picking a whole topic replaces any of its subtopics picked one by one.
        visible.forEach((n) => pickedSub.delete(subKey(broad, n)));
        if (whole) pickedBroad.delete(broad);
        else pickedBroad.add(broad);
        pickChanged();
      });
      row.appendChild(pick);
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
          const key = subKey(broad, name);
          const on = whole || pickedSub.has(key);
          const s = el('button', 'sub-chip' + (on ? ' active' : ''));
          s.type = 'button';
          s.appendChild(el('span', 'topic-name', name));
          s.appendChild(el('span', 'topic-count', String(subCounts[key])));
          s.setAttribute('aria-pressed', String(on));
          s.addEventListener('click', () => {
            if (whole) {
              // Unpicking one part of a whole topic keeps the rest of it picked.
              pickedBroad.delete(broad);
              visible.forEach((n) => { if (n !== name) pickedSub.add(subKey(broad, n)); });
            } else if (on) pickedSub.delete(key);
            else pickedSub.add(key);
            pickChanged();
          });
          list2.appendChild(s);
        });
        group.appendChild(list2);
      }
      filters.appendChild(group);
    });
  }

  /* ---------- View bar: questions to do, review list, done list ---------- */
  function renderViewBar() {
    viewBar.innerHTML = '';
    const doneCount = all.filter((q) => done.has(keyOf(q))).length;
    const todoCount = all.length - doneCount;
    const reviewCount = all.filter((q) => review.has(keyOf(q)) && !done.has(keyOf(q))).length;

    [
      ['all', 'All questions (' + todoCount + ')', ''],
      ['review', 'Review later (' + reviewCount + ')', ''],
      ['done', 'Done (' + doneCount + ')', ' view-tab-end']
    ].forEach(([id, label, extra]) => {
      const b = el('button', 'view-tab' + extra + (view === id ? ' active' : ''), label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(view === id));
      b.addEventListener('click', () => {
        view = id;
        pickedBroad.clear();
        pickedSub.clear();
        renderViewBar();
        renderFilters();
        rerender();
        slideInList();
      });
      viewBar.appendChild(b);
    });
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

  // The parts of the same question that come before this one on the paper.
  function partsBefore(q) {
    const num = (no) => (/^Q(\d+)/.exec(no || '') || [])[1];
    const n = num(q.no);
    if (!n) return [];
    const list = q.paper.questions;
    const at = list.findIndex((x) => x.id === q.id);
    return list.slice(0, Math.max(0, at)).filter((x) => num(x.no) === n);
  }

  // Earlier parts of the same question, with their answers: later parts often use
  // information or results from them. Collapsed, so they do not crowd the card.
  function earlierParts(q) {
    const prev = partsBefore(q);
    if (!prev.length) return null;
    const box = el('details', 'q-context');
    box.appendChild(el('summary', null, 'Earlier parts of this question (' + prev.length + ')'));
    prev.forEach((x) => {
      const part = el('div', 'q-context-part');
      part.appendChild(el('p', 'q-context-no', x.no + ' · ' + x.marks + (x.marks === 1 ? ' mark' : ' marks')));
      part.appendChild(math('p', 'q-context-text', x.question));
      if (x.status !== 'pending') {
        const a = el('p', 'q-context-answer');
        a.appendChild(el('strong', null, 'Answer: '));
        a.appendChild(math('span', null, x.answer));
        part.appendChild(a);
      }
      box.appendChild(part);
    });
    return box;
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
    const before = earlierParts(q);
    if (before) article.appendChild(before);
    // Just the diagram, graph or table this question needs, cut from the paper page.
    if (q.figures && q.figures.length) {
      const fig = el('figure', 'q-figure');
      q.figures.forEach((src) => {
        const img = el('img');
        img.src = src;
        img.loading = 'lazy';
        img.alt = 'Diagram from the ' + q.paper.code + ' paper for question ' + q.no;
        fig.appendChild(img);
      });
      fig.appendChild(el('figcaption', null, 'From the paper. The whole page is in "Question image" below.'));
      article.appendChild(fig);
    }

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

  const searchTerms = () => search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);

  // The questions on screen: the view, topic and search together.
  function currentQuestions() {
    const terms = searchTerms();
    return pool().filter((q) => matches(q, terms));
  }

  function render() {
    const terms = searchTerms();
    const shown = currentQuestions();
    list.innerHTML = '';

    if (!shown.length) {
      let text = 'No questions match. Try a shorter word, such as "projectile" or "ball".';
      if (view === 'done' && !pool().length) text = 'No questions are marked done yet. Use "Mark done" on a question and it moves here.';
      else if (view === 'review' && !pool().length) text = 'Nothing saved for review yet. Use "Review later" on any question to add it here.';
      else if (view === 'all' && !pool().length && done.size) text = 'Every question here is marked done. Open the Done tab to see them.';
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

  /* ---------- Download as PDF ----------
     Lays the questions on screen (or their answers) out as A4 pages off screen, draws
     each page with html2canvas and saves them as one PDF file with jsPDF. A real file
     works on phones too: iOS will not open the print screen after a wait, and it only
     saves a file straight from a tap, so iPhones and iPads get a "Save PDF" button once
     the file is ready. Both PDFs number the questions the same way, so answers match
     questions. */
  const PDF_WARN_AT = 300;
  const PAGE_W = 794; // A4 at 96 px per inch
  const PAGE_H = 1123;
  const PDF_LIBS = [
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
  ];
  let libsLoading = null;
  let pdfBusy = false;

  // The two libraries are only needed for a PDF, so they load on the first one.
  function loadPdfLibs() {
    if (!libsLoading) {
      libsLoading = Promise.all(PDF_LIBS.map((src) => new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = res;
        s.onerror = () => rej(new Error('Could not load ' + src));
        document.head.appendChild(s);
      }))).catch((err) => { libsLoading = null; throw err; });
    }
    return libsLoading;
  }

  // iPadOS reports itself as a Mac, so a Mac with a touch screen counts too.
  const needsTapToSave = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const fmt = (text) => window.QFormat.format(text, subject);

  // One question: the question, the answers to its earlier parts, then the diagram,
  // graph or table it needs, cut from the paper (never the whole page).
  function pdfQuestion(q) {
    let html = '<p class="pq-text">' + fmt(q.question) + '</p>';
    const prev = partsBefore(q).filter((x) => x.status !== 'pending');
    if (prev.length) {
      html += '<div class="pq-prev"><p class="pq-prev-title">Answers to the earlier parts</p>' +
        prev.map((x) => '<p><span class="pq-prev-no">' + esc(x.no) + ':</span> ' + fmt(x.answer) + '</p>').join('') + '</div>';
    }
    if (q.figures && q.figures.length) {
      html += '<div class="pq-box' + (q.figures.length > 1 ? ' many' : '') + '">' + q.figures.map((src) => '<img src="' + esc(src) + '" alt="">').join('') + '</div>';
    }
    return html;
  }

  function pdfAnswer(q) {
    if (q.status === 'pending') return '<p class="pq-note">' + fmt(q.answer) + '</p>';
    let html = '<p class="pq-answer"><strong>Answer:</strong> ' + fmt(q.answer) + '</p>';
    if (q.steps && q.steps.length) {
      html += '<ol class="pq-steps">' + q.steps.map((s) => '<li>' + fmt(s) + '</li>').join('') + '</ol>';
    }
    return html;
  }

  // The message pill at the bottom of the screen, with optional buttons.
  function pdfNote(text, ...actions) {
    document.querySelectorAll('.pdf-wait').forEach((n) => n.remove());
    const note = el('div', 'pdf-wait');
    note.setAttribute('role', 'status');
    note.appendChild(el('span', 'pdf-wait-text', text));
    actions.forEach((a) => note.appendChild(a));
    document.body.appendChild(note);
    return note;
  }

  function closeNoteButton() {
    const b = el('button', 'pdf-close', '×');
    b.type = 'button';
    b.setAttribute('aria-label', 'Close');
    b.addEventListener('click', () => b.closest('.pdf-wait').remove());
    return b;
  }

  function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const a = el('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function deliverPdf(file) {
    if (!needsTapToSave()) {
      downloadFile(file);
      const note = pdfNote('Your PDF has downloaded.', closeNoteButton());
      setTimeout(() => note.remove(), 5000);
      return;
    }
    // On iPhone and iPad the share sheet offers Save to Files, Books and the rest.
    const save = el('button', 'pdf-save', 'Save PDF');
    save.type = 'button';
    save.addEventListener('click', () => {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: file.name.replace(/\.pdf$/, '') }).catch((err) => {
          if (err.name !== 'AbortError') downloadFile(file);
        });
      } else {
        downloadFile(file);
      }
    });
    pdfNote('Your PDF is ready.', save, closeNoteButton());
  }

  function newPdfPage(root) {
    const page = el('div', 'pdf-page');
    const body = el('div', 'pdf-page-body');
    page.appendChild(body);
    root.appendChild(page);
    return page;
  }

  // Moves the blocks onto A4 pages, starting a new page whenever one would overflow.
  // A block taller than a whole page gets a tall page of its own, shrunk to fit later.
  function paginate(root, blocks) {
    const pages = [newPdfPage(root)];
    blocks.forEach((block) => {
      let page = pages[pages.length - 1];
      let body = page.firstChild;
      body.appendChild(block);
      if (body.scrollHeight <= body.clientHeight || body.childElementCount === 1) {
        if (body.scrollHeight > body.clientHeight) page.classList.add('tall');
        return;
      }
      page = newPdfPage(root);
      pages.push(page);
      body = page.firstChild;
      body.appendChild(block);
      if (body.scrollHeight > body.clientHeight) page.classList.add('tall');
    });
    return pages;
  }

  async function makePdf(kind) {
    if (pdfBusy) return;
    const qs = currentQuestions();
    if (!qs.length) { window.alert('There are no questions in this list to download.'); return; }
    if (qs.length > PDF_WARN_AT && !window.confirm(qs.length + ' questions make a very long PDF. Press Cancel and pick a topic to make it shorter, or OK to carry on.')) return;

    const name = SUBJECTS[subject].title.replace(' question bank', '');
    const title = name + (kind === 'answers' ? ' answers' : ' questions');
    const terms = search.value.trim();
    const picks = [...pickedBroad, ...[...pickedSub].map((k) => k.split('\u0000')[1])];
    const scope = [
      !picks.length ? 'All topics' : picks.length > 4 ? picks.length + ' topics' : picks.join(', '),
      { all: '', review: 'Review list', done: 'Done list' }[view],
      terms ? 'matching "' + terms + '"' : '',
      qs.length + (qs.length === 1 ? ' question' : ' questions')
    ].filter(Boolean).join(' · ');

    pdfBusy = true;
    const note = pdfNote('Preparing your PDF…');
    const say = (text) => { note.firstChild.textContent = text; };
    const root = el('div', 'pdf-render');
    try {
      await loadPdfLibs();

      const head = el('header', 'pdf-head');
      head.innerHTML = '<h1>' + esc(title) + '</h1><p>' + esc(scope) + ' · IALqBank</p>';
      const blocks = [head, ...qs.map((q, n) => {
        const s = el('section', 'pq');
        s.innerHTML = '<div class="pq-head"><span class="pq-num">' + (n + 1) + '</span><span class="pq-code">' + esc(q.paper.code + ' · ' + q.no) + '</span>' +
          '<span class="pq-marks">' + q.marks + (q.marks === 1 ? ' mark' : ' marks') + '</span></div>' +
          (kind === 'answers' ? pdfAnswer(q) : pdfQuestion(q));
        return s;
      })];

      // Lay everything out once, so the diagrams load and the maths fonts settle
      // before the pages are measured.
      blocks.forEach((b) => root.appendChild(b));
      document.body.appendChild(root);
      const imgs = Array.from(root.querySelectorAll('img'));
      let loaded = 0;
      await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((res) => {
        img.onload = img.onerror = () => { loaded++; say('Preparing your PDF: loading diagram ' + loaded + ' of ' + imgs.length + '…'); res(); };
      }))));
      if (document.fonts) await document.fonts.ready;

      const pages = paginate(root, blocks);
      pages.forEach((page, i) => {
        const foot = el('div', 'pdf-foot');
        foot.appendChild(el('span', null, title + ' · IALqBank'));
        foot.appendChild(el('span', null, 'Page ' + (i + 1) + ' of ' + pages.length));
        page.appendChild(foot);
      });

      // html2canvas copies the whole document for every drawing, so it skips
      // everything except the page being drawn and the stylesheets.
      const keep = (node, page) => node === page || page.contains(node) || node.contains(page) ||
        node.tagName === 'HEAD' || !!(node.closest && node.closest('head'));
      const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
      for (let i = 0; i < pages.length; i++) {
        say('Making your PDF: page ' + (i + 1) + ' of ' + pages.length + '…');
        const h = pages[i].offsetHeight;
        // Phones refuse very large canvases, so a tall page is drawn at a lower scale.
        const scale = Math.min(2, Math.sqrt(14e6 / (PAGE_W * h)));
        const canvas = await window.html2canvas(pages[i], {
          scale, backgroundColor: '#ffffff', logging: false, ignoreElements: (node) => !keep(node, pages[i])
        });
        const jpeg = canvas.toDataURL('image/jpeg', 0.8);
        canvas.width = canvas.height = 0;
        if (i) doc.addPage();
        const w = h > PAGE_H ? 210 * PAGE_H / h : 210;
        doc.addImage(jpeg, 'JPEG', (210 - w) / 2, 0, w, 297);
      }

      const file = new File([doc.output('blob')], title + ' - IALqBank.pdf', { type: 'application/pdf' });
      deliverPdf(file);
    } catch (err) {
      pdfNote('Sorry, the PDF could not be made. Check your connection and try again.', closeNoteButton());
    } finally {
      root.remove();
      pdfBusy = false;
    }
  }

  document.querySelectorAll('.pdf-btn').forEach((b) => {
    b.addEventListener('click', () => makePdf(b.dataset.kind));
  });

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
