# Physics Notes

Interactive revision notes for **Pearson Edexcel International AS & A Level Physics** (IAL, first teaching 2018), published at <https://mirakludba08.github.io/physics/>.

Every topic page has notes, interactive diagrams, step-by-step derivations, worked examples and quick-check questions. Anything that goes beyond the specification sits in an orange box marked *"Beyond the spec · not part of the Edexcel IAL specification"*.

## How the site is put together

| Path | What it is |
| --- | --- |
| `index.html` | Home page. The topic cards are generated from the list in `js/script.js`. |
| `pages/*.html` | One page per topic. |
| `css/styles.css` | All styles: sidebar, title pills, callouts, derivation steppers, interactive panels. |
| `js/script.js` | Runs on every page: builds the sidebar, the "On this page" list, prev/next links, derivation steppers and quick-check questions. The `SITE` list at the top is the single list of pages. |
| `js/sim.js` | Small library behind every interactive diagram (`Sim.create`, plus helpers for arrows, graphs and springs). Usage is documented at the top of the file. |
| `js/topics/*.js` | The interactive diagrams for each page, e.g. `pages/Motion.html` uses `js/topics/motion.js`. |
| `assets/` | Images and the Manim animations. |

## Adding a page

1. Copy an existing page in `pages/` and change the title and content.
2. Add it to `SITE` in `js/script.js`. The sidebar, home page and prev/next links pick it up automatically.
3. For interactives, put `<figure id="sim-something"><figcaption>Try this…</figcaption></figure>` in the page and build it in `js/topics/<page>.js` with `Sim.create('#sim-something', { … })`.

## Building blocks for page content

- `<div class="callout key|define|tip|warn|core|offspec">…</div>`: key idea, definition, exam tip, common mistake, core practical, beyond the spec.
- `<div class="derive" data-title="…" data-spec="derive|use|off"><div class="step">…</div>…</div>`: a step-by-step derivation.
- `<div class="mcq">…<button data-correct>…</button>…</div>`: a quick-check question.
- `<span class="tag sheet">Formula sheet</span>`: the equation is printed in the exam's list of formulae.

Maths is written in LaTeX between `\( … \)` (inline) or `\[ … \]` (display) and rendered by MathJax.

## Previewing locally

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.
