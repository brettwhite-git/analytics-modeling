/* Imputation figure — what each fix for a missing value does to the data, computed.
   80 made-up rows: x is known for every row, y is hidden for some. Which rows lose y is decided by a seeded
   priority (pure chance, or "mostly when y is high"), so the hidden set grows smoothly with the slider.
   The mean, the least-squares line and its residual spread are fitted from the rows that still have y;
   the readouts (average, spread, typical miss from the closest line) are computed from exactly the values drawn.
   Steps: 0 the problem (x known, y not; rows kept vs truth) · 1 mean imputation · 2 regression imputation ·
          3 regression plus perturbation (seeded noise with the residual SD).
   Controls in every step: share missing (slider) and how y goes missing (button).
   Made-up data. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };
  var SIDE = 462, COL = 158;
  var XMAX = 10, YMAX = 13;
  var N = 80, START = 25;                            // rows; share missing at load, in percent

  function makeData(rand) {
    function gauss() { return (rand() + rand() + rand() + rand() - 2) * 1.7320508; }   // mean 0, sd 1
    var pts = [];
    for (var i = 0; i < N; i++) {
      var x = 0.4 + 9.2 * rand();
      pts.push({
        x: x, y: 3 + 0.62 * x + 1.2 * gauss(),
        u: rand(),                                    // order in which rows go missing by pure chance
        e: gauss(),                                   // blur on the "high y goes first" order
        z: gauss()                                    // this row's perturbation, in residual SDs
      });
    }
    return pts;
  }

  /* which rows lose y: the m rows with the highest priority */
  function hidden(pts, biased, m) {
    var order = pts.map(function (p, i) { return { i: i, v: biased ? p.y + p.e : p.u }; });
    order.sort(function (a, b) { return b.v - a.v; });
    var out = pts.map(function () { return false; });
    for (var j = 0; j < m; j++) out[order[j].i] = true;
    return out;
  }

  function stats(xs, ys) {
    var n = xs.length, mx = 0, my = 0, sxx = 0, syy = 0, sxy = 0, i;
    for (i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
    mx /= n; my /= n;
    for (i = 0; i < n; i++) { sxx += (xs[i] - mx) * (xs[i] - mx); syy += (ys[i] - my) * (ys[i] - my); sxy += (xs[i] - mx) * (ys[i] - my); }
    // spread: typical distance from the average; miss: typical distance from the closest line (both divide by n)
    return { n: n, mx: mx, mean: my, sd: Math.sqrt(syy / n), miss: Math.sqrt(Math.max(0, syy - sxy * sxy / sxx) / n), sxx: sxx, sxy: sxy, syy: syy };
  }

  /* least squares on the rows that still have y, and the residual standard error */
  function fitLine(xs, ys) {
    var s = stats(xs, ys), b = s.sxy / s.sxx, a = s.mean - b * s.mx, sse = 0;
    for (var i = 0; i < xs.length; i++) { var r = ys[i] - a - b * xs[i]; sse += r * r; }
    return { a: a, b: b, s: Math.sqrt(sse / (xs.length - 2)), mean: s.mean };
  }

  /* the whole computation for one setting: returns the filled-in y for every row, plus the readouts */
  function solve(pts, biased, m, step) {
    var miss = hidden(pts, biased, m), ox = [], oy = [], ax = [], ay = [], fy = [], i;
    for (i = 0; i < pts.length; i++) { ax.push(pts[i].x); ay.push(pts[i].y); if (!miss[i]) { ox.push(pts[i].x); oy.push(pts[i].y); } }
    var f = fitLine(ox, oy);
    for (i = 0; i < pts.length; i++) {
      var p = pts[i];
      fy.push(!miss[i] ? p.y : step === 1 ? f.mean : step === 2 ? f.a + f.b * p.x : f.a + f.b * p.x + f.s * p.z);
    }
    return { miss: miss, fit: f, filled: fy, truth: stats(ax, ay), now: step === 0 ? stats(ox, oy) : stats(ax, fy) };
  }

  var spec = {
    label: 'Missing values: a scatter of two related variables, with the rows that lost y and three ways of filling them in',
    steps: 4,
    seed: 23,
    _model: { makeData: makeData, solve: solve, N: N },   // the pure maths, exposed so it can be checked from node
    draw: function (k) {
      var sx = k.scale(0, XMAX, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(0, YMAX, PLOT.y + PLOT.h, PLOT.y);
      var base = PLOT.y + PLOT.h;
      var pts = makeData(k.rng(364));
      var pct = START, biased = false;

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'x · known for every row', ylabel: 'y · missing for some' });

      /* every row's true point; the ones whose y is hidden are switched off in redraw() */
      var marks = k.root.group({ d: 200, stagger: 10 });
      pts.forEach(function (p) { p.node = marks.mark(sx(p.x), sy(p.y), 'o', { r: 3.4 }); p.node.style.pointerEvents = 'none'; });

      var live = k.root.layer();

      /* ---- the column: truth against what you have now ---- */
      var side = k.root.group({ d: 300 });
      var C1 = SIDE + 102, C2 = SIDE + COL;
      side.text(C1, 46, 'true', { kind: 'label', anchor: 'end' });
      var head = side.text(C2, 46, '', { kind: 'label', anchor: 'end' });
      var rows = [['average', 'mean', 2], ['spread', 'sd', 2], ['line miss', 'miss', 2]].map(function (r, i) {
        var y = 66 + i * 18;
        side.text(SIDE, y, r[0], { kind: 'label' });
        return { key: r[1], dp: r[2], t: side.text(C1, y, '', { kind: 'val', anchor: 'end' }), v: side.text(C2, y, '', { kind: 'val', anchor: 'end' }) };
      });
      side.line(SIDE, 114, SIDE + COL, 114, { w: 0.6, op: 0.45, rough: 0.3 });

      side.text(SIDE, 186, 'y goes missing', { kind: 'label' });
      // the key to the two quiet marks
      side.mark(SIDE + 5, 244, 'o', { r: 3.4 });
      side.text(SIDE + 16, 247.5, 'row with y', { kind: 'axis' });
      side.dot(SIDE + 5, 260, 1.7, { op: 0.5 });
      side.text(SIDE + 16, 263.5, 'the y you never saw', { kind: 'axis' });

      var NOTES = [['a', 'x known, y not'], ['b', 'all at the average'], ['c', 'all on the line'], ['d', 'line plus a nudge']];

      function redraw() {
        var step = k.step(), m = Math.round(pct / 100 * N), r = solve(pts, biased, m, step), i, target = null;
        live.clear();

        if (step === 1) live.line(PLOT.x, sy(r.fit.mean), PLOT.x + PLOT.w, sy(r.fit.mean), { w: 0.6, op: 0.5, rough: 0.3 });
        if (step >= 2) live.line(sx(0), sy(r.fit.a), sx(XMAX), sy(r.fit.a + r.fit.b * XMAX), { w: step === 2 ? 1.1 : 0.8, op: step === 2 ? 0.8 : 0.55, rough: 0.4 });

        for (i = 0; i < pts.length; i++) {
          var p = pts[i];
          p.node.style.display = r.miss[i] ? 'none' : '';
          if (!r.miss[i]) continue;
          live.dot(sx(p.x), sy(p.y), 1.7, { op: 0.5 });                     // where it really was
          var X = sx(p.x), Y = step === 0 ? base : sy(r.filled[i]);
          if (step === 0) live.mark(X, Y, 'o', { accent: true, r: 3, w: 1.2 });
          else live.mark(X, Y, 'x', { accent: true, r: 3.2, w: 1.3 });
          if (!target || X > target[0]) target = [X, Y];
        }

        head.set(step === 0 ? 'kept' : 'filled');
        rows.forEach(function (row) {
          row.t.set(r.truth[row.key].toFixed(row.dp));
          row.v.set(r.now[row.key].toFixed(row.dp));
        });
        if (target) live.callout(NOTES[step][0], NOTES[step][1], SIDE, 300, { to: [target[0] + 7, target[1] - 5] });
      }

      k.slider({
        x: SIDE, y: 150, w: COL, min: 5, max: 50, step: 5, value: START, label: 'missing',
        format: function (v) { return v + '% · ' + Math.round(v / 100 * N) + ' of ' + N; },
        onChange: function (v) { pct = v; redraw(); }
      });
      var toggle = k.button(SIDE, 208, 'at random', function () {
        biased = !biased;
        toggle.set(biased ? 'when high' : 'at random');
        redraw();
      });

      var g3 = k.root.group({ steps: [3], d: 300 });
      g3.text(SIDE, 340, 'each guess is worse,', { kind: 'hand', d: 700 });
      g3.text(SIDE, 362, 'the spread is right.', { kind: 'hand', d: 1100 });

      k.onStep(redraw);
    }
  };

  window.InkKit.define('impute-figure', spec);
})();
