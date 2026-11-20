/* SVM figure — the widest street between two classes, worked for real.
   A soft-margin linear SVM is fitted in the browser (subgradient descent on mean hinge loss + lambda * |a|^2,
   deterministic), so the line, the margin and the count of points inside it are computed, not posed.
   Steps: 0 the problem (many lines separate the classes) · 1 the widest margin · 2 lambda trades margin
          for mistakes (slider) · 3 move a point (drag; it refits).
   Made-up points. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };       // the plot area, in figure pixels
  var SIDE = 462;                                    // left edge of the column beside the plot
  var DOM = 10;                                      // data runs 0..10 on both axes
  var LAMBDA_START = 0.0005;

  function makeData(rand) {
    var pts = [], i;
    function g() { return (rand() + rand() + rand() - 1.5) * 1.7; }
    for (i = 0; i < 13; i++) pts.push({ x: 3.0 + g(), y: 3.2 + g(), c: -1 });
    for (i = 0; i < 13; i++) pts.push({ x: 7.0 + g(), y: 6.9 + g(), c: 1 });
    // two that sit near the gap, so the margin has something to decide
    pts.push({ x: 4.7, y: 4.3, c: -1 });
    pts.push({ x: 5.6, y: 5.9, c: 1 });
    return pts;
  }

  /* minimise  mean( max(0, 1 - y (a.x + a0)) ) + lambda |a|^2  — returns a, a0 in data units */
  function fit(pts, lambda) {
    var w1 = 0, w2 = 0, b = 0, n = pts.length, t, i;
    for (t = 0; t < 2500; t++) {
      var g1 = 2 * lambda * w1, g2 = 2 * lambda * w2, gb = 0;
      for (i = 0; i < n; i++) {
        var u1 = (pts[i].x - 5) / 5, u2 = (pts[i].y - 5) / 5;
        if (pts[i].c * (w1 * u1 + w2 * u2 + b) < 1) { g1 -= pts[i].c * u1 / n; g2 -= pts[i].c * u2 / n; gb -= pts[i].c / n; }
      }
      var eta = 1.5 / (1 + 0.01 * t);
      w1 -= eta * g1; w2 -= eta * g2; b -= eta * gb;
    }
    return { a1: w1 / 5, a2: w2 / 5, a0: b - w1 - w2 };
  }

  /* the two points where the line  a1 x + a2 y + c = 0  crosses the box 0..DOM, or null */
  function clipLine(a1, a2, c) {
    var hits = [], v;
    if (Math.abs(a2) > 1e-9) {
      v = -c / a2; if (v >= 0 && v <= DOM) hits.push([0, v]);
      v = -(c + a1 * DOM) / a2; if (v >= 0 && v <= DOM) hits.push([DOM, v]);
    }
    if (Math.abs(a1) > 1e-9) {
      v = -c / a1; if (v > 0 && v < DOM) hits.push([v, 0]);
      v = -(c + a2 * DOM) / a1; if (v > 0 && v < DOM) hits.push([v, DOM]);
    }
    return hits.length >= 2 ? [hits[0], hits[hits.length - 1]] : null;
  }

  /* clip a polygon to the half-plane  a1 x + a2 y + c >= 0  (Sutherland-Hodgman) */
  function clipHalf(poly, a1, a2, c) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length];
      var fp = a1 * p[0] + a2 * p[1] + c, fq = a1 * q[0] + a2 * q[1] + c;
      if (fp >= 0) out.push(p);
      if ((fp >= 0) !== (fq >= 0)) { var s = fp / (fp - fq); out.push([p[0] + s * (q[0] - p[0]), p[1] + s * (q[1] - p[1])]); }
    }
    return out;
  }

  window.InkKit.define('svm-figure', {
    label: 'A support vector machine: two classes of points, the separating line and its margin',
    steps: 4,
    seed: 7,
    draw: function (k) {
      var sx = k.scale(0, DOM, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(0, DOM, PLOT.y + PLOT.h, PLOT.y);
      var box = [[0, 0], [DOM, 0], [DOM, DOM], [0, DOM]];
      var pts = makeData(k.rng(11));
      var lambda = LAMBDA_START;
      function px(poly) { return poly.map(function (p) { return [sx(p[0]), sy(p[1])]; }); }

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'x₁', ylabel: 'x₂' });

      /* ---- step 0: any of these lines separates the two classes ---- */
      var g0 = k.root.group({ steps: [0], d: 500, stagger: 160 });
      // every direction whose line really does leave all circles on one side and all crosses on the other
      var valid = [];
      for (var deg = 10; deg <= 80; deg += 5) {
        var n1 = Math.cos(deg * Math.PI / 180), n2 = Math.sin(deg * Math.PI / 180), lo = -Infinity, hi = Infinity;
        pts.forEach(function (p) { var v = n1 * p.x + n2 * p.y; if (p.c < 0) lo = Math.max(lo, v); else hi = Math.min(hi, v); });
        if (hi - lo > 0.25) valid.push({ n1: n1, n2: n2, c: -(lo + hi) / 2 });
      }
      var lastEnd = null;
      [valid[0], valid[valid.length >> 1], valid[valid.length - 1]].forEach(function (l, i, all) {
        if (!l || all.indexOf(l) !== i) return;
        var seg = clipLine(l.n1, l.n2, l.c);
        if (!seg) return;
        g0.thread(px(seg));
        lastEnd = px(seg)[0][1] > px(seg)[1][1] ? px(seg)[0] : px(seg)[1];
      });
      g0.callout('a', 'which line?', SIDE, 150, { to: lastEnd ? [lastEnd[0] - 14, lastEnd[1] - 22] : null, d: 1200 });

      /* ---- steps 1-3: the fitted line, its margin, the points that hold it up ---- */
      var live = k.root.layer({ steps: [1, 2, 3] });
      var side = k.root.group({ steps: [1, 2, 3], d: 300 });
      side.text(SIDE, 60, 'margin width', { kind: 'label' });
      var widthVal = side.text(SIDE + 158, 60, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 80, 'inside or wrong', { kind: 'label' });
      var slackVal = side.text(SIDE + 158, 80, '', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 92, SIDE + 158, 92, { w: 0.6, op: 0.45, rough: 0.3 });

      function redraw() {
        var m = fit(pts, lambda), norm = Math.sqrt(m.a1 * m.a1 + m.a2 * m.a2) || 1e-6;
        live.clear();
        var band = clipHalf(clipHalf(box, m.a1, m.a2, m.a0 + 1), -m.a1, -m.a2, -m.a0 + 1);
        if (band.length > 2) live.hatch(px(band), { op: 0.3 });
        [1, -1].forEach(function (off) {
          var edge = clipLine(m.a1, m.a2, m.a0 + off);
          if (edge) live.line(sx(edge[0][0]), sy(edge[0][1]), sx(edge[1][0]), sy(edge[1][1]), { w: 0.7, op: 0.55, rough: 0.3 });
        });
        var mid = clipLine(m.a1, m.a2, m.a0);
        if (mid) live.line(sx(mid[0][0]), sy(mid[0][1]), sx(mid[1][0]), sy(mid[1][1]), { w: 1.7, op: 0.9, rough: 0.5 });
        var slack = 0;
        pts.forEach(function (p) {
          var f = p.c * (m.a1 * p.x + m.a2 * p.y + m.a0);
          if (f < 1.06) { slack += f < 0.85 ? 1 : 0; live.circle(sx(p.x), sy(p.y), 9, { accent: true, w: 1.1, op: 0.9 }); }
        });
        widthVal.set((2 / norm).toFixed(1));
        slackVal.set(String(slack));
      }

      /* ---- the points: always there, movable in the last step ---- */
      var marks = k.root.group({ d: 200, stagger: 18 });
      pts.forEach(function (p) {
        var x0 = sx(p.x), y0 = sy(p.y);
        var node = marks.mark(x0, y0, p.c > 0 ? '+' : 'o');
        k.draggable(node, {
          x: x0, y: y0, label: 'A point of class ' + (p.c > 0 ? 'plus' : 'circle') + '. Arrow keys move it.',
          bounds: { x0: PLOT.x + 8, y0: PLOT.y + 8, x1: PLOT.x + PLOT.w - 8, y1: PLOT.y + PLOT.h - 8 },
          onMove: function (x, y) {
            if (k.step() !== 3) return;
            p.x = (x - PLOT.x) / PLOT.w * DOM; p.y = (PLOT.y + PLOT.h - y) / PLOT.h * DOM;
            node.setAttribute('transform', 'translate(' + (x - x0).toFixed(1) + ' ' + (y - y0).toFixed(1) + ')');
            redraw();
          }
        });
        p.node = node;
      });

      /* ---- step 2 and 3: lambda, on a log scale ---- */
      k.slider({
        x: SIDE, y: 136, w: 158, min: -3.5, max: -0.7, step: 0.05, value: Math.log(LAMBDA_START) / Math.LN10,
        label: 'λ', steps: [2, 3],
        format: function (v) { var l = Math.pow(10, v); return l < 0.001 ? l.toFixed(4) : l < 0.01 ? l.toFixed(3) : l.toFixed(2); },
        onChange: function (v) { lambda = Math.pow(10, v); redraw(); }
      });
      var notes = k.root.group({ steps: [2, 3], d: 500 });
      notes.text(SIDE, 162, 'small λ', { kind: 'axis' });
      notes.text(SIDE + 158, 162, 'large λ', { kind: 'axis', anchor: 'end' });

      k.root.group({ steps: [1] }).callout('b', 'the widest street', SIDE, 150, { d: 700 });
      k.root.group({ steps: [2] }).callout('c', 'wider, but more inside it', SIDE, 200, { d: 400 });
      var g3 = k.root.group({ steps: [3], d: 300 });
      g3.callout('d', 'drag any point', SIDE, 200, { d: 300 });
      g3.text(SIDE, 236, 'only the circled', { kind: 'hand', d: 700 });
      g3.text(SIDE, 258, 'ones matter.', { kind: 'hand', d: 1100 });

      k.onStep(function (step) {
        pts.forEach(function (p) { p.node.style.pointerEvents = step === 3 ? 'auto' : 'none'; });
        if (step > 0) redraw();
      });
    }
  });
})();
