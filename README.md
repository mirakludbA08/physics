# IALqBank

Past-paper questions with worked answers, and interactive revision notes, for **Pearson Edexcel International AS & A Level** Physics, Chemistry, Biology and Mathematics. Published at <https://mirakludba08.github.io/IALqBank/>.

- **Question bank** (`questions.html?s=physics|chemistry|biology|maths`): questions grouped by paper, a topic panel with broad topics and subtopics, keyword search, answers hidden until revealed with step-by-step working, an image of the question's page from the paper, "Mark done" and "Review later" lists saved in cookies.
- **Notes**: physics (`pages/`), chemistry (`notes/chemistry/`) and biology (`notes/biology/`). Maths has no notes by design.

Questions come from Pearson Edexcel International past papers, collected by topic by Rocket Revise and shared here with their permission. Answers, explanations and notes are written for this site and are not checked by Pearson. Some notes diagrams come from the Rocket Revise notes, also with permission, and are credited in their captions.

## How the site is put together

| Path | What it is |
| --- | --- |
| `index.html` | Landing page with the four subjects. |
| `questions.html`, `js/bank.js`, `css/bank.css` | The question bank. |
| `js/format.js` | Turns the plain-text maths and formulas in the data (`x^2`, `sqrt(x)`, `H2SO4`, `Fe3+`) into readable HTML. |
| `js/taxonomy.js` | Rules that put each question into a broad topic and subtopic for the topic panel. |
| `data/<subject>/*.json` | The source data: one file per paper. Edit these, then rebuild. |
| `js/data/<subject>.js` | Built from `data/` by `tools/build-data.js`. Do not edit by hand. |
| `papers/<subject>/` | The original question papers (PDF) and `img/` page images for the "Question image" drop-down. |
| `pages/*.html` | Physics notes, one page per topic; `pages/index.html` is the physics notes home. |
| `notes/<subject>/*.html` | Chemistry and biology notes, one page per topic. |
| `js/notes-<subject>.js` | Each subject's list of notes pages. It builds the notes sidebar, prev/next links, the unit cards on the notes home and the question bank's Notes drawer, and sets the subject's colours. |
| `js/script.js` | Runs on every notes page: sidebar, "On this page" list, prev/next links, step-throughs and quick checks. |
| `js/sim.js`, `js/topics/*.js` | Interactive diagrams on notes pages (`Sim.create`; usage is at the top of `sim.js`). |
| `css/styles.css` | Notes styles. Colours come from variables; each subject overrides them at the end of the file. |
| `tools/` | Scripts to rebuild the data and attach page images (see below). |

## Adding or editing questions

1. Edit or add a paper file in `data/<subject>/`. Keep each paper's `code` and each question's `id` the same once published: saved "done" and "review later" marks are keyed on them.
2. If you added a paper, put its PDF in `papers/<subject>/` and give it page images and a page map:
   - papers with a text layer (physics, chemistry, biology): `bash tools/map-pages.sh <subject>`
   - scanned papers (maths): render pages with `pdftoppm -jpeg -r 90 -jpegopt quality=72 <pdf> papers/maths/img/<P1|...>-<name>` and write `tools/maps/maths/<P1|...>-<name>.map` by hand, one `<question number> <page>` line per question.
3. `node tools/attach-images.js <subject>`
4. `node tools/build-data.js <subject>`

## Adding a notes page

1. Copy an existing page in the subject's notes folder and change the title and content.
2. Add it to the subject's `js/notes-<subject>.js`. The sidebar, notes home, prev/next links and the bank's Notes drawer pick it up automatically.
3. For interactives, put `<figure id="sim-something"><figcaption>Try this…</figcaption></figure>` in the page and build it in `js/topics/<file>.js` with `Sim.create('#sim-something', { … })`.

## Building blocks for notes content

- `<div class="callout key|define|tip|warn|core|offspec">…</div>`: key idea, definition, exam tip, common mistake, core practical, beyond the spec (physics only).
- `<div class="derive" data-title="…" data-spec="derive|use|off"><div class="step">…</div>…</div>`: a step-by-step derivation or process. The `data-spec` labels only show on physics pages.
- `<div class="mcq">…<button data-correct>…</button>…</div>`: a quick-check question.
- `<span class="tag sheet">Formula sheet</span>`: the equation is printed in the exam's list of formulae.

Maths on notes pages is written in LaTeX between `\( … \)` (inline) or `\[ … \]` (display) and rendered by MathJax.

## Previewing locally

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.
