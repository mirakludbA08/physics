#!/usr/bin/env node
/* Build the question bank data the site loads.

   Reads every paper file in data/<subject>/*.json and writes js/data/<subject>.js.
   Papers are ordered by code (maths: P1, P2, P3, P4, then M1).

   Usage, from the repository root:
     node tools/build-data.js                 all subjects
     node tools/build-data.js chemistry       one subject

   Paper file format (data/<subject>/<name>.json):
     { "code", "title", "unit", "pdf", "questions": [
         { "id", "no", "marks", "topic", "keywords": [], "question",
           "status": "ready" | "pending", "answer", "steps": [], "images": [] } ] }
   Keep "code" and "id" stable: saved "done" and "review later" marks are keyed on them. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SUBJECTS = ['physics', 'chemistry', 'biology', 'maths'];
const RANK = { P1: 1, P2: 2, P3: 3, P4: 4, M1: 5 };

function sortKey(code) {
  const m = String(code).match(/^(P\d|M\d)-(\d+)/);
  return m ? [RANK[m[1]] || 9, parseInt(m[2], 10)] : [0, 0];
}

function build(subject) {
  const dir = path.join(ROOT, 'data', subject);
  if (!fs.existsSync(dir)) return;
  const papers = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    return {
      file: f,
      paper: {
        code: p.code, title: p.title, unit: p.unit, pdf: p.pdf,
        questions: p.questions.map((q) => ({
          id: q.id, no: q.no, marks: q.marks, topic: q.topic,
          keywords: Array.isArray(q.keywords) ? q.keywords : [],
          question: q.question,
          status: q.status === 'ready' ? 'ready' : 'pending',
          answer: q.answer,
          steps: Array.isArray(q.steps) ? q.steps : [],
          images: Array.isArray(q.images) ? q.images : []
        }))
      }
    };
  }).sort((a, b) => {
    const ka = sortKey(a.paper.code), kb = sortKey(b.paper.code);
    return ka[0] - kb[0] || ka[1] - kb[1] || a.file.localeCompare(b.file, undefined, { numeric: true });
  }).map((x) => x.paper);

  const body = 'window.BANK = window.BANK || {};\n\nwindow.BANK.' + subject + ' = ' +
    JSON.stringify({ papers }, null, 1) + ';\n';
  fs.writeFileSync(path.join(ROOT, 'js', 'data', subject + '.js'), body);

  const count = (pred) => papers.reduce((n, p) => n + p.questions.filter(pred).length, 0);
  console.log(subject.padEnd(10), 'papers', papers.length, 'questions', count(() => true),
    'ready', count((q) => q.status === 'ready'), 'with images', count((q) => q.images.length));
}

const only = process.argv[2];
(only ? [only] : SUBJECTS).forEach(build);
