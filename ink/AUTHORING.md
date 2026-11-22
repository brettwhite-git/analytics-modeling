# Writing a lesson

An open, self-study guide to analytics modeling, built from the ground up. The reader is a beginner: they
know arithmetic, and may never have seen Python. Every lesson has them do the idea **by hand first**, then
**teach it to a computer**, and only then learn what it is called.

The reference lesson is `kmeans-from-scratch.qmd`. Read it, and open it in a browser, before writing one.

How the site is put together: Quarto runs the R reference chunks and typesets the maths, nothing else.
`ink/template.html` is the whole page, `ink/site.css` the whole look, `ink/ink.js` the page behaviour,
`ink/py.js` the runnable Python, and the list of lessons lives under `ink-parts` in `_quarto.yml`.

## The shape of a lesson

```
---
title: "A question in plain words?"
subtitle: "One sentence. Say that they will do it by hand first, and what little they need to know."
engine: knitr
---

Two short paragraphs: a concrete situation and the thing nobody has told you yet.

## A question                                   <- every section title is a question
A hand figure the reader acts on (click, drag, slide). Then what they just did, said as one plain rule.

### Now tell a computer                         <- or a question such as "How far is a dot from a flag?"
A Python cell. The picture under it is drawn from the code's own answer.

## The next question ...                        <- 4 to 6 sections like this

## What you just built
A two-column table: "What you did" | "What it is called". Then two or three sentences on what a library
does with the same idea. Names appear here for the first time, never earlier.

::: {.callout-note collapse="true" title="Reference: the same ideas in R"}
The R chunks from the old page, unchanged and in their original order, each under its one-sentence lead-in.
:::
```

## Rules

**Beginner first.**
- Arithmetic only. Work a tiny example by hand, with real numbers, before any formula or code
  (3 across and 4 up: 9 + 16 = 25).
- Short sentences. Second person. Define a word the moment it is needed, in a clause.
- No jargon before "What you just built". Use the plain thing (flag, dot, middle, the total) and give its
  proper name in the closing table.
- Formulas in symbols go in a fold: `::: {.callout-note collapse="true" title="The same thing in symbols"}`.
  Say how to read any symbol ("read the big Σ as add these up").
- No exam traps, no course references, no quizzes, no "check yourself", no cheat sheets.
- Keep every true fact the old page taught that a beginner needs. Drop course-specific conventions.
  Do not invent claims: stay with the old page, its course notes, and standard uncontroversial facts.

**Socratic.**
- The reader commits before being told. Use an `.ask` block two to four times a lesson:

  ```
  ::: {.ask data-veil="true"}
  The question.

  - **A choice.** What the page says back if they pick it.
  - **Another choice.** Its reply.
  :::
  ```

  Every choice gets a reply that teaches, including the wrong ones; never "Wrong." With `data-veil` the
  figure that follows stays faint until they answer (there is always a "show it anyway").
- One question should be "how would you know it is right?", answered by the worked example.
- One moment where it **breaks**: a cell that fails for a real reason (an empty group, dividing by zero,
  an unscaled variable drowning the others, a line that cannot be drawn), then an `.ask` about what to do.
  Mark that cell `data-aside="true"` so later cells do not depend on it.

**By hand, then code, on the same data.**
- A hand figure offers its data to the page's Python through `window.InkPage` (see `ink/figures/kmeans-lab.js`):
  `window.InkPage.points = function () { return POINTS; };`. The first cell then starts with
  `from page import points`. If the reader set something by hand (flags, a line, a threshold), offer that too,
  so the code works on what they just did and the answers can be compared.
- Say so in the text: "compare the number it prints with the one in Fig. 2".

## Python cells

```
::: {.py-cell data-draw="py-plot"}
```python
def dist2(p, q):
    across = p[0] - q[0]          # p[0] is the first number of the pair
    up = p[1] - q[1]
    return across * across + ____
```
::: {.py-solution}
```python
def dist2(p, q):
    across = p[0] - q[0]          # p[0] is the first number of the pair
    up = p[1] - q[1]
    return across * across + up * up
```
:::
:::
```

- Four to seven cells a lesson, each one small step. All cells share one Python; a later cell uses what
  earlier ones defined.
- At most ONE blank (`____`) per cell, and it replaces one small expression, never a whole function.
  A cell with a blank needs a `.py-solution` that is identical except for the blank.
- Comment the lines in plain words. Give each new Python word (`def`, `for`, `if`, `return`, a list) one
  sentence in the prose the first time it appears on the page. A lesson must stand alone.
- Plain Python only: no NumPy, no pandas, no `lambda`, no clever one-liners. Loops a beginner can trace.
  `import random` and `import math` are fine. Keep it fast: a cell should finish in well under a second.
- Round what you print (`round(x, 2)`), so the output reads like a result.
- `data-draw="py-plot"` draws a picture from a dict the code leaves behind called `picture`, or plays back a
  list of them called `frames` (a fit improving step by step, a loop settling). Keys are documented at the
  top of `ink/figures/py-plot.js`: points, labels, stars, segments, lines, accent, hlines, vlines, bars,
  notes, xlim, ylim, xlabel, ylabel. Use `frames` wherever the code repeats a step: that is the animation.
- Running a cell traces it: a marker walks the lines and the margin tallies how often each ran. Nothing to do
  for that, but it means loops are a feature. Let the reader see one go round.

## Hand figures

One file per figure, `ink/figures/<key>.js`, built on `ink/ink-kit.js` (its header documents the API; read
`ink/figures/kmeans-lab.js` and `ink/figures/svm-figure.js`). Mounted with:

```
::: {.ink-figure data-figure="<key>" data-step="0" data-caption="Fig. 1 · what you are looking at · made-up data"}
:::
```

- The reader **does** something in every figure: places, drags, slides, presses "next". A figure that only
  plays is a missed chance.
- Animate the method itself, with `k.animate`: a flag gliding to the middle, a line tilting toward the
  points, a total falling on a small chart. One-shot tweens only, nothing that loops by itself.
- The maths is real: computed in the browser from seeded made-up data, never posed. Readouts come from the
  same numbers that are drawn.
- Layout: plot on the left (about x 44..436, y 34..406), a 160 px column from x = 462 for readouts, buttons
  and one lettered callout. Nothing touches or leaves the 640 x 450 box. Text never overlaps ink.
- Look: ink on paper. Line weights 0.6 / 1.1 / 1.6. Hatching, never solid fills. Groups told apart by mark
  shape (`o`, `+`, `x`, `sq`, `tri`), not colour. ONE accent element per step: the thing in focus.
- Things that move are drawn once and moved with a transform, or drawn with clean `path`s in a `layer()`.
  Hand-wobbled marks are only redrawn when what they show changes, so nothing "boils".
- A figure the lesson already had (see `ink/figures/`) may be reused or adapted. The old figures were built
  for an essay; a hand figure usually needs the reader to act first, so adapt rather than just re-mount.
- The kit (`ink/ink-kit.js`, `ink/ink-kit.css`), `ink/py.js`, `ink/ink.js`, `ink/site.css`, `ink/template.html`
  and `_quarto.yml` are shared by every lesson. Do not edit them; report what was missing.

## Checking

- Python: `python3 ink/check_cells.py <lesson>.qmd --page <page.json>` runs every cell in its worked version,
  in order, without a browser. `<page.json>` is what `from page import ...` should give
  (`{"points": [[1, 2], ...]}`); write it from your figure's data. It must end with "all cells ran".
- Figures: screenshot every step, light and dark, with headless Chrome, and look at the image:

  ```
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
    --window-size=700,560 --virtual-time-budget=5000 --screenshot=<out>.png \
    "file://<abs path to demos>/ink/lab.html?figure=<key>&step=1&theme=dark"
  ```

  For a state that needs a click or drag, write a small throwaway harness page outside the project.
- `node --check ink/figures/<key>.js`.
