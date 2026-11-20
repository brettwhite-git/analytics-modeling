/* Cross-validation figure — the data set as a strip of 40 cells, and what each cell is allowed to do.
   Everything is computed in the browser from seeded made-up data: y = 2 sin(0.6 x) + noise, polynomial
   least-squares fits (Chebyshev basis, Householder QR). Error is mean squared error throughout.
   Steps: 0 the problem (scored on the cells it was fitted on: the wiggly fit wins, and is worse on new points)
          1 the split (training fits, validation chooses, test scores the winner once)
          2 k-fold (the TRAINING cells cut into folds; the held-out fold rotates; buttons step through)
          3 the number of folds (slider).
   Cross-validation is drawn inside the training cells. The test cells are never part of a fold.
   Made-up data. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var STRIP = { x: 44, y: 42, w: 392, h: 16 };       // the row of cells
  var PLOT = { x: 44, y: 128, w: 392, h: 274 };      // the scatter under it
  var SIDE = 462, SIDE_W = 158;                      // the column beside the plot
  var N = 40, N_TRAIN = 30;                          // 30 cells to learn from, 10 locked away
  var N_FIT = 20;                                    // step 1: 20 fit, 10 validate, 10 test
  var NOISE = 0.8, YMAX = 4.6;
  var WIGGLY = 14, CANDIDATE = 3, MAX_DEGREE = 8;
  var FOLD_CHOICES = [2, 3, 5, 6, 10, 15, 30];
  var CELL = STRIP.w / N;

  function truth(x) { return 2 * Math.sin(0.6 * x); }

  function sample(rand, n) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var x = 10 * rand();
      var z = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
      pts.push({ x: x, y: truth(x) + NOISE * z });
    }
    return pts;
  }

  /* Chebyshev polynomials of (x - 5) / 5, so a degree-14 fit stays well conditioned */
  function basis(x, deg) {
    var u = (x - 5) / 5, row = [1];
    if (deg >= 1) row.push(u);
    for (var j = 2; j <= deg; j++) row.push(2 * u * row[j - 1] - row[j - 2]);
    return row;
  }

  /* least squares by Householder QR; returns the coefficients */
  function polyfit(pts, deg) {
    var n = pts.length, p = deg + 1, A = [], b = [], i, j, k;
    for (i = 0; i < n; i++) { A.push(basis(pts[i].x, deg)); b.push(pts[i].y); }
    for (k = 0; k < p; k++) {
      var norm = 0;
      for (i = k; i < n; i++) norm += A[i][k] * A[i][k];
      norm = Math.sqrt(norm);
      if (norm < 1e-12) continue;
      var alpha = A[k][k] > 0 ? -norm : norm, v = [], vv = 0;
      for (i = k; i < n; i++) v.push(A[i][k]);
      v[0] -= alpha;
      for (i = 0; i < v.length; i++) vv += v[i] * v[i];
      if (vv < 1e-24) continue;
      for (j = k; j < p; j++) {
        var d = 0;
        for (i = k; i < n; i++) d += v[i - k] * A[i][j];
        d = 2 * d / vv;
        for (i = k; i < n; i++) A[i][j] -= d * v[i - k];
      }
      var db = 0;
      for (i = k; i < n; i++) db += v[i - k] * b[i];
      db = 2 * db / vv;
      for (i = k; i < n; i++) b[i] -= db * v[i - k];
    }
    var c = [];
    for (k = p - 1; k >= 0; k--) {
      var s = b[k];
      for (j = k + 1; j < p; j++) s -= A[k][j] * c[j];
      c[k] = Math.abs(A[k][k]) > 1e-12 ? s / A[k][k] : 0;
    }
    return c;
  }
  function predict(c, x) {
    var row = basis(x, c.length - 1), s = 0;
    for (var j = 0; j < c.length; j++) s += c[j] * row[j];
    return s;
  }
  function mse(c, pts) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) { var e = pts[i].y - predict(c, pts[i].x); s += e * e; }
    return s / pts.length;
  }

  /* fit on `fit`, keep the degree with the lowest error on `val` */
  function choose(fit, val) {
    var rows = [], best = 0;
    for (var d = 1; d <= MAX_DEGREE; d++) {
      var c = polyfit(fit, d);
      rows.push({ degree: d, c: c, val: mse(c, val) });
      if (rows[d - 1].val < rows[best].val) best = d - 1;
    }
    return { rows: rows, best: rows[best] };
  }

  window.InkKit.define('cv-figure', {
    label: 'A data set drawn as a strip of forty cells: split into training, validation and test, then the training cells cut into folds for cross-validation',
    steps: 4,
    seed: 5,
    draw: function (k) {
      var sx = k.scale(0, 10, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(-YMAX, YMAX, PLOT.y + PLOT.h, PLOT.y);
      var pts = sample(k.rng(1), N);                 // cell i is observation i, in the order it was collected
      var fresh = sample(k.rng(999), 4000);          // stands in for "data the model has never seen"
      var train = pts.slice(0, N_TRAIN), fitSet = pts.slice(0, N_FIT), valSet = pts.slice(N_FIT, N_TRAIN), testSet = pts.slice(N_TRAIN);

      function cellX(i) { return STRIP.x + i * CELL; }
      function cells(a, b) {                          // the rectangle over cells a .. b-1
        return [[cellX(a), STRIP.y], [cellX(b), STRIP.y], [cellX(b), STRIP.y + STRIP.h], [cellX(a), STRIP.y + STRIP.h]];
      }
      function f2(v) { return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2); }
      /* the fitted curve as a path, lifted off the paper wherever it leaves the plot */
      function curveD(c) {
        var d = '', pen = false, top = PLOT.y + 2, bot = PLOT.y + PLOT.h - 2, px = 0, py = 0;
        for (var i = 0; i <= 240; i++) {
          var x = sx(i / 24), y = sy(predict(c, i / 24)), inside = y >= top && y <= bot;
          if (i && inside !== pen) {
            var edge = (inside ? py : y) < top ? top : bot, t = (edge - py) / (y - py);
            d += (inside ? ' M' : ' L') + (px + t * (x - px)).toFixed(1) + ' ' + edge.toFixed(1);
          }
          if (inside) d += (d && (pen || i) ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
          pen = inside; px = x; py = y;
        }
        return d.replace(/^ L/, 'M').replace(/^ M/, 'M');
      }
      /* g.path() stamps 'ik-ink' on the path itself, and the kit's draw-in and step-off rules only reach paths
         INSIDE an 'ik-ink' node. So a stepped curve gets a wrapper that carries the class. */
      function inkPath(g, d, o) {
        var wrap = g.group();
        wrap.node.setAttribute('class', 'ik-g ik-ink');
        wrap.node.style.opacity = 1;
        return wrap.path(d, o);
      }
      /* a mark and a mono-caps name, centred as one unit, with a quieter line under it saying what it is for */
      function tag(g, cx, kind, name, job) {
        var w = name.length * 7.4 + 13, x0 = cx - w / 2;
        g.mark(x0 + 4, 70.5, kind, { r: 3.2 });
        g.text(x0 + 13, 74, name, { kind: 'label' });
        if (job) g.text(cx, 88, job, { kind: 'axis', anchor: 'middle' });
      }

      /* ---- always there: the axes and the strip of cells ---- */
      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'x', ylabel: 'y' });
      var strip = k.root.group({ d: 0, stagger: 8 });
      strip.rect(STRIP.x, STRIP.y, STRIP.w, STRIP.h, { w: 1.1, rough: 0.4 });
      for (var i = 1; i < N; i++) strip.line(cellX(i), STRIP.y, cellX(i), STRIP.y + STRIP.h, { w: 0.6, op: 0.35, rough: 0.15 });

      /* ---- step 0: fitted on every cell, scored on every cell ---- */
      var g0 = k.root.group({ steps: [0], d: 300, stagger: 14 });
      var cubic = polyfit(pts, CANDIDATE), wiggly = polyfit(pts, WIGGLY);
      g0.hatch(cells(0, N), { op: 0.4 });
      tag(g0, STRIP.x + STRIP.w / 2, 'o', 'all 40 observations', 'fitted on them, then scored on them');
      pts.forEach(function (p) { g0.mark(sx(p.x), sy(p.y), 'o'); });
      inkPath(g0, curveD(cubic), { w: 1.1, op: 0.7, d: 900, dur: 900 });
      inkPath(g0, curveD(wiggly), { w: 1.6, op: 0.95, accent: true, d: 1300, dur: 1400 });
      g0.text(SIDE, 44, 'mean squared error', { kind: 'label', d: 600 });
      [[CANDIDATE, cubic, 64, false], [WIGGLY, wiggly, 128, true]].forEach(function (m) {
        var y = m[2];
        g0.line(SIDE, y - 3.5, SIDE + 22, y - 3.5, { w: m[3] ? 1.6 : 1.1, op: m[3] ? 0.95 : 0.7, accent: m[3], rough: 0.3, d: 700 });
        g0.text(SIDE + 30, y, 'degree ' + m[0], { kind: 'label', d: 700 });
        g0.text(SIDE, y + 18, 'on its own points', { kind: 'axis', d: 800 });
        g0.text(SIDE + SIDE_W, y + 18, f2(mse(m[1], pts)), { kind: 'val', anchor: 'end', d: 800 });
        g0.text(SIDE, y + 34, 'on new points', { kind: 'axis', d: 900 });
        g0.text(SIDE + SIDE_W, y + 34, f2(mse(m[1], fresh)), { kind: 'val', anchor: 'end', d: 900 });
      });
      g0.line(SIDE, 176, SIDE + SIDE_W, 176, { w: 0.6, op: 0.45, rough: 0.3, d: 900 });
      g0.callout('a', 'better score, worse model', SIDE, 202, { d: 1800 });

      /* ---- steps 1-3: the last ten cells are the test set, and stay that way ---- */
      var locked = k.root.group({ steps: [1, 2, 3], d: 200 });
      locked.hatch(cells(N_TRAIN, N), { angle: 40, gap: 4, op: 0.5 });
      locked.hatch(cells(N_TRAIN, N), { angle: 140, gap: 4, op: 0.5 });
      locked.line(cellX(N_TRAIN), STRIP.y - 6, cellX(N_TRAIN), STRIP.y + STRIP.h + 6, { w: 1.3, rough: 0.3 });

      /* ---- step 1: training fits, validation chooses, test scores the winner once ---- */
      var g1 = k.root.group({ steps: [1], d: 300, stagger: 14 });
      var pick = choose(fitSet, valSet);
      g1.hatch(cells(0, N_FIT), { angle: 40, op: 0.4 });
      g1.hatch(cells(N_FIT, N_TRAIN), { angle: 140, op: 0.4 });
      g1.line(cellX(N_FIT), STRIP.y - 6, cellX(N_FIT), STRIP.y + STRIP.h + 6, { w: 1.3, rough: 0.3 });
      tag(g1, (cellX(0) + cellX(N_FIT)) / 2, 'o', 'training', 'fit every candidate');
      tag(g1, (cellX(N_FIT) + cellX(N_TRAIN)) / 2, 'x', 'validation', 'choose one');
      tag(g1, (cellX(N_TRAIN) + cellX(N)) / 2, 'sq', 'test', 'score it once');
      fitSet.forEach(function (p) { g1.mark(sx(p.x), sy(p.y), 'o'); });
      valSet.forEach(function (p) { g1.mark(sx(p.x), sy(p.y), 'x', { r: 3.6 }); });
      testSet.forEach(function (p) { g1.mark(sx(p.x), sy(p.y), 'sq', { r: 3.4 }); });
      inkPath(g1, curveD(pick.best.c), { w: 1.6, op: 0.9, d: 1000, dur: 900 });
      g1.text(SIDE, 44, 'validation mse', { kind: 'label', d: 600 });
      pick.rows.forEach(function (r, j) {
        var y = 62 + j * 14, win = r === pick.best;
        g1.text(SIDE, y, 'degree ' + r.degree, { kind: 'axis', accent: win, d: 700 + j * 40 });
        g1.text(SIDE + SIDE_W, y, f2(r.val), { kind: 'val', anchor: 'end', accent: win, d: 700 + j * 40 });
      });
      g1.line(SIDE, 170, SIDE + SIDE_W, 170, { w: 0.6, op: 0.45, rough: 0.3, d: 1000 });
      g1.text(SIDE, 188, 'test mse, winner', { kind: 'label', d: 1100 });
      g1.text(SIDE + SIDE_W, 188, f2(mse(pick.best.c, testSet)), { kind: 'val', anchor: 'end', d: 1100 });
      g1.callout('b', 'the lowest gets picked', SIDE, 214, { d: 1400 });
      // (y 243..269 is kept clear in this step: the slider knob's paper patch sits there in every step)
      // the same recipe on 300 fresh data sets: how the winner's two scores compare on average
      var simRand = k.rng(4242), sumVal = 0, sumTest = 0, REPS = 300;
      for (var r = 0; r < REPS; r++) {
        var d = sample(simRand, N), w = choose(d.slice(0, N_FIT), d.slice(N_FIT, N_TRAIN)).best;
        sumVal += w.val; sumTest += mse(w.c, d.slice(N_TRAIN));
      }
      g1.text(SIDE, 284, 'over ' + REPS + ' data sets', { kind: 'label', d: 1500 });
      g1.text(SIDE, 302, "winner's validation", { kind: 'axis', d: 1600 });
      g1.text(SIDE + SIDE_W, 302, f2(sumVal / REPS), { kind: 'val', anchor: 'end', d: 1600 });
      g1.text(SIDE, 318, "winner's test", { kind: 'axis', d: 1700 });
      g1.text(SIDE + SIDE_W, 318, f2(sumTest / REPS), { kind: 'val', anchor: 'end', d: 1700 });

      /* ---- steps 2 and 3: the training cells cut into folds, one held out at a time ---- */
      var nFolds = 5, fold = 0, errs = [];
      var s23 = k.root.group({ steps: [2, 3], d: 300 });
      tag(s23, (cellX(0) + cellX(N_TRAIN)) / 2, 'o', 'training', 'cross-validation happens inside here');
      tag(s23, (cellX(N_TRAIN) + cellX(N)) / 2, 'sq', 'test', 'locked away');
      s23.text(SIDE, 44, 'candidate', { kind: 'label' });
      s23.text(SIDE + SIDE_W, 44, 'degree ' + CANDIDATE, { kind: 'val', anchor: 'end' });
      s23.text(SIDE, 62, 'fold held out', { kind: 'label' });
      var foldVal = s23.text(SIDE + SIDE_W, 62, '', { kind: 'val', anchor: 'end' });
      s23.text(SIDE, 80, 'its mse', { kind: 'label' });
      var errVal = s23.text(SIDE + SIDE_W, 80, '', { kind: 'val', anchor: 'end' });
      var meanLabel = s23.text(SIDE, 98, '', { kind: 'label' });
      var meanVal = s23.text(SIDE + SIDE_W, 98, '', { kind: 'val', anchor: 'end' });
      s23.line(SIDE, 110, SIDE + SIDE_W, 110, { w: 0.6, op: 0.45, rough: 0.3 });
      s23.text(SIDE, 128, 'each fold’s error', { kind: 'axis' });
      s23.line(SIDE, 150, SIDE + SIDE_W, 150, { w: 0.8, op: 0.7, rough: 0.3 });
      s23.text(SIDE, 164, '0', { kind: 'axis' });
      var maxTick = s23.text(SIDE + SIDE_W, 164, '', { kind: 'axis', anchor: 'end' });
      var live = k.root.layer({ steps: [2, 3] });

      function foldSize() { return N_TRAIN / nFolds; }
      function split(f) {
        var a = f * foldSize(), b = a + foldSize();
        return { a: a, b: b, held: train.slice(a, b), rest: train.slice(0, a).concat(train.slice(b)) };
      }
      function scoreFolds() {
        errs = [];
        for (var f = 0; f < nFolds; f++) { var s = split(f); errs.push(mse(polyfit(s.rest, CANDIDATE), s.held)); }
      }
      function redraw() {
        var s = split(fold), c = polyfit(s.rest, CANDIDATE), f, sum = 0;
        live.clear();
        // the strip: every fold that is fitted on wears the training hatch, the held-out one the validation hatch
        if (s.a > 0) live.hatch(cells(0, s.a), { angle: 40, op: 0.4 });
        if (s.b < N_TRAIN) live.hatch(cells(s.b, N_TRAIN), { angle: 40, op: 0.4 });
        live.hatch(cells(s.a, s.b), { angle: 140, gap: 3.5, op: 0.95, accent: true });
        for (f = 1; f < nFolds; f++) {
          var tick = foldSize() > 2 ? 4 : 2;         // many small folds: lighter cuts, so the held-out cell still reads
          live.line(cellX(f * foldSize()), STRIP.y - tick, cellX(f * foldSize()), STRIP.y + STRIP.h + tick, { w: tick > 2 ? 1.1 : 0.7, rough: 0.2, op: tick > 2 ? 0.85 : 0.6 });
        }
        var name = 'fold ' + (fold + 1) + ' · held out', tw = name.length * 7.4 + 13;
        var cx = k.clamp((cellX(s.a) + cellX(s.b)) / 2, STRIP.x + tw / 2, cellX(N_TRAIN) - tw / 2);
        live.mark(cx - tw / 2 + 4, 26.5, 'x', { r: 3.2 });
        live.text(cx - tw / 2 + 13, 30, name, { kind: 'label' });
        // the plot: fitted on the other folds, scored on this one
        live.path(curveD(c), { w: 1.6, op: 0.9 });
        s.rest.forEach(function (p) { live.mark(sx(p.x), sy(p.y), 'o'); });
        s.held.forEach(function (p) {
          live.line(sx(p.x), sy(p.y), sx(p.x), sy(predict(c, p.x)), { w: 0.7, op: 0.6, rough: 0.2 });
          live.mark(sx(p.x), sy(p.y), 'x', { r: 3.8, w: 1.3 });
        });
        // the column: this fold, and the folds visited so far
        var top = Math.max(1, Math.ceil(Math.max.apply(null, errs) * 2) / 2), ex = k.scale(0, top, SIDE, SIDE + SIDE_W);
        for (f = 0; f <= fold; f++) {
          sum += errs[f];
          if (f === fold) live.circle(ex(errs[f]), 143, 3.4, { w: 1.2, op: 0.95, rough: 0.3 });
          else live.dot(ex(errs[f]), 143, 2, { op: 0.6 });
        }
        live.line(ex(sum / (fold + 1)), 134, ex(sum / (fold + 1)), 156, { w: 1.6, op: 0.9, rough: 0.2 });
        foldVal.set((fold + 1) + ' of ' + nFolds);
        errVal.set(f2(errs[fold]));
        meanLabel.set(fold === nFolds - 1 ? 'cv(' + nFolds + '), the mean' : 'mean of ' + (fold + 1));
        meanVal.set(f2(sum / (fold + 1)));
        maxTick.set(top.toFixed(1));
      }

      k.button(SIDE, 192, 'next fold', function () {
        fold = (fold + 1) % nFolds;
        redraw();
      }, { steps: [2, 3] });
      k.button(SIDE + SIDE_W, 192, 'run all', function () {
        var from = fold === nFolds - 1 ? 0 : fold, shown = -1;
        k.animate(Math.min(2600, 260 * (nFolds - 1 - from)) || 1, function (t) {
          var at = from + Math.round(t * (nFolds - 1 - from));
          if (at !== shown) { shown = fold = at; redraw(); }
        });
      }, { steps: [2, 3], anchor: 'end' });

      k.slider({
        x: SIDE, y: 256, w: SIDE_W, min: 0, max: FOLD_CHOICES.length - 1, step: 1, value: FOLD_CHOICES.indexOf(nFolds),
        label: 'folds k', steps: [3],
        format: function (v) { return FOLD_CHOICES[v] === N_TRAIN ? N_TRAIN + ' (one each)' : String(FOLD_CHOICES[v]); },
        onChange: function (v) { nFolds = FOLD_CHOICES[v]; fold = 0; scoreFolds(); redraw(); }
      });
      var ends = k.root.group({ steps: [3], d: 500 });
      ends.text(SIDE, 282, '2', { kind: 'axis' });
      ends.text(SIDE + SIDE_W, 282, 'leave one out', { kind: 'axis', anchor: 'end' });

      k.root.group({ steps: [2] }).callout('c', 'every fold takes one turn', SIDE, 232, { d: 500 });
      var g3 = k.root.group({ steps: [3], d: 300 });
      g3.callout('d', 'more folds, smaller folds', SIDE, 314, { d: 300 });
      g3.text(SIDE, 350, 'the folds never', { kind: 'hand', d: 700 });
      g3.text(SIDE, 372, 'touch the test cells.', { kind: 'hand', d: 1100 });

      scoreFolds();
      k.onStep(function (step) { if (step >= 2) redraw(); });
    }
  });
})();
