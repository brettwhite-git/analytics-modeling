# Writing a chapter (Folio)

How the site is put together: Quarto runs the R, typesets the maths and nothing else. `ink/template.html` is the whole
page (contents, bar, sheet, foot), `ink/site.css` is the whole look, `ink/ink.js` is the page behaviour, and the list of
chapters lives under `ink-parts` in `_quarto.yml`. Add a chapter there to put it in the contents.

Every methodology page is a short essay with hand-drawn, computed figures between the paragraphs.
The reference chapter is `svm-from-scratch.qmd` with `ink/figures/svm-figure.js`. Match them.

## Chapter anatomy

```
---
title: "A question, in plain words?"          # e.g. "How does a support vector machine draw the line?"
subtitle: "One sentence that says what is surprising or useful about the answer."
engine: knitr
---

::: {.ink-figure data-figure="<key>" data-step="0" data-caption="Fig. 1 · what you are looking at · made-up data"}
:::

Two short paragraphs: the problem, in a concrete setting.

## Three or four sections, unnumbered, short titles
Prose first. A figure every two or three paragraphs. Display maths in $$...$$ on its own line.
[A note that sits in the margin. Use it for exam traps and asides.]{.side}

## Run it yourself {.reference}
Every R chunk from the old page, unchanged and in the original order, each under a one-sentence lead-in.

## On one page {.reference}
The old cheat sheet.

## Check yourself {.reference}
The old quiz.
```

Rules for the essay:

- Essay sections (before "Run it yourself") hold prose, maths, small tables and ink figures. No R chunks, no callout boxes.
- Each essay section is 2 to 5 short paragraphs. Plain words, second person, no hype, no headings numbered "1.", "2.".
- Keep every fact, formula, table and warning the old page taught. Move, tighten and reorder; do not invent new claims.
  Where the course convention matters (which term a parameter multiplies, direction of an effect), state it exactly.
- Exam traps go in `[...]{.side}` notes, at most one per section, attached to the paragraph they belong to (inline, at its end).
- R chunks: keep the code byte for byte and keep the order (later chunks use earlier objects). Rename chunk labels
  from `fig-...` to `plot-...` so Quarto does not number them against the ink figures. Keep `fig-cap`.
  Code is folded site-wide behind "The R"; do not add per-chunk fold options.
- Callout boxes from the old page that carry real content become prose or a `.side` note. "Check yourself" may keep its list as plain markdown.

## Figures in a .qmd

```
::: {.ink-figure data-figure="svm-figure" data-step="2" data-steps="2:slide λ|3:move a point" data-caption="Fig. 3 · fitted live · made-up points"}
:::
```

- `data-figure` loads `ink/figures/<key>.js` on demand. `data-step` is the step it opens on.
- `data-steps` (optional) adds buttons under the figure: `step:label` pairs separated by `|`.
- One figure module usually has 3 or 4 steps and is mounted two or three times in the essay, each time at the step the
  nearby paragraph is about. The last mount is the live one (slider, drag). A chapter with two distinct ideas may have two modules.
- Captions: `Fig. N · what it shows`, and say `made-up data` or `illustration` when it is.

## Writing a figure

`ink/ink-kit.js` documents the whole API in its header comment. Read it and `ink/figures/svm-figure.js` before starting.

- One file: `ink/figures/<key>.js`, calling `InkKit.define('<key>', { label, steps, seed, draw(k) })`. Drawing space 640 x 450.
- The maths is real. Fit, simulate or compute in the browser from seeded made-up data; never pose a result by hand.
  Readouts (a width, a count, an error) are computed from the same numbers that are drawn.
- Steps tell the essay: (a) the problem, (b) how the method works, (c)/(d) a control the reader moves and what it trades.
- Layout: plot on the left (about x 44..436, y 34..406), a 160 px column on the right from x = 462 for readouts,
  sliders and callouts. Compose with even margins; nothing may touch or leave the 640 x 450 box. Text never overlaps ink.
- Look: ink on paper, no boxes or cards. Line weights 0.6 hairline, 1.1 standard, 1.6 to 1.7 for the one line that matters.
  Hatching for regions, never solid fills. Classes are told apart by mark shape (`o`, `+`, `x`, `sq`, `tri`), not colour.
- ONE accent element per step (`accent: true`): the thing in focus. The lettered callout is also in the accent; nothing else.
- Labels are short: mono caps via `kind: 'label'`, values via `kind: 'val'`, maths via `kind: 'math'`, at most two
  handwritten lines (`kind: 'hand'`) in the last step.
- Static parts go in `group({ steps: [...] })` so they draw in and out. Anything recomputed on input goes in a `layer()`
  that you `clear()` and redraw. Fixed seeds everywhere (`k.rng(seed)`); nothing changes between two loads.
- Controls: `k.slider`, `k.draggable`, `k.button`. Every control works from the keyboard (the kit handles it).
- No timers that loop. `k.animate(ms, fn)` for a one-shot tween is fine.
- The kit (`ink/ink-kit.js`, `ink/ink-kit.css`) is shared by every figure. Change it only for something every figure
  should get, and re-check the other figures afterwards.

## Checking a figure

Screenshot every step, light and dark, with headless Chrome and look at the image:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=700,560 --virtual-time-budget=5000 --screenshot=<out>.png \
  "file://<abs path to demos>/ink/lab.html?figure=<key>&step=1&theme=dark"
```

`lab.html` shows the finished drawing of one step (add `&motion=1` to play the draw-in, `&w=420` for a narrow stage).
Check: nothing clipped or overlapping, one accent, labels legible, readouts match the drawing, both themes.
Run `node --check ink/figures/<key>.js`, then `quarto render` and look at the chapter itself in light and dark.
