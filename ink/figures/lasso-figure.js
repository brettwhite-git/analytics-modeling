/* LASSO figure — the constraint picture, computed.
   A made-up data set with two scaled predictors is fitted by least squares in the browser. The plane is the two
   coefficients (a1, a2); the rings are contours of the residual sum of squares around the least-squares solution.
   LASSO minimises the same error inside the diamond |a1| + |a2| <= T (solved exactly, edge by edge); ridge inside
   the circle a1^2 + a2^2 <= T (solved by bisection on the penalty). Nothing is posed: the solution point, the
   contour through it, the readouts and the coefficient paths all come from the same fit.
   Steps: 0 least squares uses both coefficients · 1 LASSO lands on a corner · 2 ridge shrinks both (button
          switches method) · 3 slide the budget T, with each coefficient's path against T.
   Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };       // the plot area, in figure pixels
  var SIDE = 462;                                    // left edge of the column beside the plot
  var OX = 226, OY = 220, UNIT = 90;                 // where (0, 0) sits, and pixels per unit of coefficient
  var T_START = 1, T_MIN = 0.1, T_MAX = 2;
  var LEVELS = [0.04, 0.16, 0.36];                   // fixed error contours (mean squared error above the minimum)

  /* 40 made-up observations: two mildly correlated predictors, scaled to mean 0 and variance 1, and a response.
     Returns what the error surface needs: rho = corr(x1, x2), the least-squares coefficients, the minimum error. */
  function makeFit(rand) {
    var n = 40, x1 = [], x2 = [], y = [], i;
    function g() { return (rand() + rand() + rand() + rand() - 2) * 1.73; }
    for (i = 0; i < n; i++) { var z = g(), e = g(); x1.push(z); x2.push(0.22 * z + 0.97 * e); }
    function scaled(v) {
      var m = 0, s = 0;
      v.forEach(function (a) { m += a; }); m /= n;
      v.forEach(function (a) { s += (a - m) * (a - m); }); s = Math.sqrt(s / n);
      return v.map(function (a) { return (a - m) / s; });
    }
    x1 = scaled(x1); x2 = scaled(x2);
    for (i = 0; i < n; i++) y.push(1.5 * x1[i] + 0.42 * x2[i] + 0.8 * g());
    var my = 0; y.forEach(function (a) { my += a; }); my /= n;
    var rho = 0, c1 = 0, c2 = 0, syy = 0;
    for (i = 0; i < n; i++) {
      rho += x1[i] * x2[i] / n; c1 += x1[i] * (y[i] - my) / n; c2 += x2[i] * (y[i] - my) / n; syy += (y[i] - my) * (y[i] - my) / n;
    }
    var det = 1 - rho * rho, b1 = (c1 - rho * c2) / det, b2 = (c2 - rho * c1) / det;
    return { rho: rho, c1: c1, c2: c2, b1: b1, b2: b2, mse: syy - b1 * c1 - b2 * c2 };
  }

  /* mean squared error above its minimum at coefficients (a1, a2): a quadratic bowl centred on least squares */
  function extra(f, a1, a2) {
    var d1 = a1 - f.b1, d2 = a2 - f.b2;
    return d1 * d1 + 2 * f.rho * d1 * d2 + d2 * d2;
  }

  /* least error with |a1| + |a2| <= T.  Exact: on each edge of the diamond the error is a parabola in one variable. */
  function solveLasso(f, T) {
    if (Math.abs(f.b1) + Math.abs(f.b2) <= T) return { a1: f.b1, a2: f.b2, free: true };
    var corners = [[T, 0], [0, T], [-T, 0], [0, -T]], best = null;
    for (var i = 0; i < 4; i++) {
      var p = corners[i], q = corners[(i + 1) % 4], e1 = q[0] - p[0], e2 = q[1] - p[1];
      var d1 = p[0] - f.b1, d2 = p[1] - f.b2;
      var t = -(e1 * (d1 + f.rho * d2) + e2 * (f.rho * d1 + d2)) / (e1 * e1 + 2 * f.rho * e1 * e2 + e2 * e2);
      t = t <= 0 ? 0 : t >= 1 ? 1 : t;               // clamped: the minimum is at a corner, one coefficient exactly 0
      var a1 = t === 0 ? p[0] : t === 1 ? q[0] : p[0] + t * e1, a2 = t === 0 ? p[1] : t === 1 ? q[1] : p[1] + t * e2;
      var v = extra(f, a1, a2);
      if (!best || v < best.v) best = { a1: a1, a2: a2, v: v };
    }
    return best;
  }

  /* least error with a1^2 + a2^2 <= T: the ridge solution (X'X + lambda I)^-1 X'y, with lambda found by bisection */
  function solveRidge(f, T) {
    if (f.b1 * f.b1 + f.b2 * f.b2 <= T) return { a1: f.b1, a2: f.b2, free: true };
    function at(l) {
      var det = (1 + l) * (1 + l) - f.rho * f.rho;
      return { a1: ((1 + l) * f.c1 - f.rho * f.c2) / det, a2: ((1 + l) * f.c2 - f.rho * f.c1) / det };
    }
    var lo = 0, hi = 1e6, a;
    for (var i = 0; i < 80; i++) {
      var mid = (lo + hi) / 2; a = at(mid);
      if (a.a1 * a.a1 + a.a2 * a.a2 > T) lo = mid; else hi = mid;
    }
    return at(hi);
  }

  /* the part of the segment p-q inside the rectangle, or null (Liang-Barsky) */
  function clipSeg(p, q, r) {
    var t0 = 0, t1 = 1, dx = q[0] - p[0], dy = q[1] - p[1];
    var P = [-dx, dx, -dy, dy], Q = [p[0] - r.x0, r.x1 - p[0], p[1] - r.y0, r.y1 - p[1]];
    for (var i = 0; i < 4; i++) {
      if (P[i] === 0) { if (Q[i] < 0) return null; continue; }
      var t = Q[i] / P[i];
      if (P[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
      else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    return [[p[0] + t0 * dx, p[1] + t0 * dy], [p[0] + t1 * dx, p[1] + t1 * dy], t0 > 0, t1 < 1];
  }

  /* cut a closed loop of points into the runs that lie inside the rectangle */
  function runsInside(loop, r) {
    var runs = [], run = null, n = loop.length;
    for (var i = 0; i < n; i++) {
      var s = clipSeg(loop[i], loop[(i + 1) % n], r);
      if (!s) { run = null; continue; }
      if (!run || s[2]) { run = [s[0]]; runs.push(run); }
      run.push(s[1]);
      if (s[3]) run = null;
    }
    // a loop that never leaves the box comes back as one run; a clipped one may wrap round the seam
    if (runs.length > 1) {
      var first = runs[0], last = runs[runs.length - 1], a = first[0], b = last[last.length - 1];
      if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 0.01) { runs[0] = last.concat(first.slice(1)); runs.pop(); }
    }
    return runs;
  }

  function fmt(v) {
    if (v === 0) return '0';
    return Math.abs(v) < 0.005 ? v.toFixed(3) : v.toFixed(2);
  }

  window.InkKit.define('lasso-figure', {
    label: 'The plane of two regression coefficients: error contours around the least-squares solution, and the LASSO diamond or ridge circle that holds the constrained solution',
    steps: 4,
    seed: 23,
    draw: function (k) {
      var f = makeFit(k.rng(54));
      var box = { x0: PLOT.x, y0: PLOT.y, x1: PLOT.x + PLOT.w, y1: PLOT.y + PLOT.h };
      function sx(a) { return OX + a * UNIT; }
      function sy(a) { return OY - a * UNIT; }
      var mode = 'lasso', T = T_START;
      function solve(m, t) { return m === 'lasso' ? solveLasso(f, t) : solveRidge(f, t); }

      /* the error contour at a given level, in pixels: an ellipse whose axes follow the eigenvectors (1,1), (1,-1) */
      function contour(level, n) {
        var r1 = Math.sqrt(level / (1 + f.rho)) / Math.SQRT2, r2 = Math.sqrt(level / (1 - f.rho)) / Math.SQRT2, pts = [];
        for (var i = 0; i < n; i++) {
          var th = i / n * 2 * Math.PI, u = r1 * Math.cos(th), v = r2 * Math.sin(th);
          pts.push([sx(f.b1 + u + v), sy(f.b2 + u - v)]);
        }
        return pts;
      }
      function drawContour(g, level, o) {
        if (level < 1e-5) return;
        runsInside(contour(level, 40), box).forEach(function (run) {
          if (run.length === 41) run = run.slice(0, 40).concat([run[0], run[1]]);      // a whole ring: lap the seam
          if (run.length > 2) g.curve(run, o); else g.line(run[0][0], run[0][1], run[1][0], run[1][1], o);
        });
      }

      /* ---- the error surface: fixed contours, in every step ---- */
      var rings = k.root.group({ d: 500, stagger: 140 });
      LEVELS.forEach(function (lv) { drawContour(rings, lv, { w: 0.6, op: 0.5, rough: 0.4 }); });

      /* ---- steps 1-3: the budget region and the contour that just reaches it (redrawn live) ---- */
      var region = k.root.layer({ steps: [1, 2, 3] });

      /* ---- the coefficient axes, through the origin ---- */
      var ax = k.root.group({ d: 0 });
      ax.line(box.x0, OY, box.x1, OY, { w: 0.9, op: 0.7, rough: 0.4 });
      ax.line(OX, box.y1, OX, box.y0, { w: 0.9, op: 0.7, rough: 0.4 });
      [-1, 1, 2].forEach(function (v) {
        ax.line(sx(v), OY, sx(v), OY + 4, { w: 0.6, op: 0.6, rough: 0.2 });
        ax.paper(sx(v) - 9, OY + 7, 18, 11);
        ax.text(sx(v), OY + 16, String(v), { kind: 'axis', anchor: 'middle' });
      });
      [-1, 1].forEach(function (v) {
        ax.line(OX - 4, sy(v), OX, sy(v), { w: 0.6, op: 0.6, rough: 0.2 });
        ax.paper(OX - 22, sy(v) - 5, 16, 11);
        ax.text(OX - 8, sy(v) + 3.5, String(v), { kind: 'axis', anchor: 'end' });
      });
      ax.paper(box.x0, OY - 22, 20, 17);
      ax.text(box.x0 + 2, OY - 9, 'a₁', { kind: 'math' });
      ax.paper(OX + 7, box.y0 - 3, 20, 17);
      ax.text(OX + 9, box.y0 + 10, 'a₂', { kind: 'math' });

      /* ---- step 0: least squares, and what it spends on each coefficient ---- */
      var bx = sx(f.b1), by = sy(f.b2);
      var g0 = k.root.group({ steps: [0], d: 900 });
      g0.thread([[bx, by], [bx, OY]]);
      g0.thread([[bx, by], [OX, by]]);
      g0.text(bx, OY + 16, f.b1.toFixed(2), { kind: 'val', anchor: 'middle' });
      g0.text(OX - 8, by + 3.5, f.b2.toFixed(2), { kind: 'val', anchor: 'end' });
      g0.mark(bx, by, 'x', { accent: true, r: 5, w: 1.6 });
      g0.callout('a', 'both coefficients in use', SIDE, 150, { to: [bx + 9, by - 6], d: 1500 });
      k.root.group({ steps: [1, 2, 3], d: 200 }).mark(bx, by, 'x', { r: 4 });

      /* ---- the readouts beside the plot ---- */
      var C1 = SIDE + 118, C2 = SIDE + 158;
      var head = k.root.group({ d: 300 });
      head.text(C1, 52, 'a₁', { kind: 'axis', anchor: 'end' });
      head.text(C2, 52, 'a₂', { kind: 'axis', anchor: 'end' });
      head.mark(SIDE + 4, 66.5, 'x', { r: 3.5 });
      head.text(SIDE + 14, 70, 'least sq.', { kind: 'label' });
      head.text(C1, 70, f.b1.toFixed(2), { kind: 'val', anchor: 'end' });
      head.text(C2, 70, f.b2.toFixed(2), { kind: 'val', anchor: 'end' });

      var side = k.root.group({ steps: [1, 2, 3], d: 400 });
      side.dot(SIDE + 4, 84.5, 3.2, { accent: true });
      var rowName = side.text(SIDE + 14, 88, 'lasso', { kind: 'label' });
      var v1 = side.text(C1, 88, '', { kind: 'val', anchor: 'end' });
      var v2 = side.text(C2, 88, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 106, 'training error', { kind: 'label' });
      var vErr = side.text(C2, 106, '', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 118, C2, 118, { w: 0.6, op: 0.45, rough: 0.3 });
      var rule = side.text(SIDE, 142, '', { kind: 'math' });

      /* ---- the solution point: the one thing in the accent ---- */
      var point = k.root.layer({ steps: [1, 2, 3] });

      /* ---- step 3: each coefficient against the budget ---- */
      var PP = { x: SIDE + 20, y: 236, w: 122, h: 86 };
      var px = k.scale(0, T_MAX, PP.x, PP.x + PP.w), py = k.scale(0, 1.7, PP.y + PP.h, PP.y);
      var pathG = k.root.group({ steps: [3], d: 500 });
      pathG.axes({ x: PP.x, y: PP.y, w: PP.w, h: PP.h, xlabel: 'T',
        xticks: [[px(0), '0'], [px(1), '1'], [px(2), '2']], yticks: [[py(0), '0'], [py(1), '1']] });
      var paths = k.root.layer({ steps: [3] });
      var hand1 = pathG.text(SIDE, 386, '', { kind: 'hand', d: 900 });
      var hand2 = pathG.text(SIDE, 408, '', { kind: 'hand', d: 1300 });

      // the budget below which LASSO holds a2 at exactly zero, found by bisection on the solver itself
      var tZero = (function () {
        var lo = 0, hi = Math.abs(f.b1) + Math.abs(f.b2);
        for (var i = 0; i < 40; i++) { var mid = (lo + hi) / 2; if (solveLasso(f, mid).a2 === 0) lo = mid; else hi = mid; }
        return lo;
      })();
      var track = { lasso: [], ridge: [] };
      for (var i = 0; i <= 200; i++) {
        var t = i / 200 * T_MAX;
        ['lasso', 'ridge'].forEach(function (m) { var s = t ? solve(m, t) : { a1: 0, a2: 0 }; track[m].push([t, s.a1, s.a2]); });
      }

      function redraw() {
        var s = solve(mode, T), X = sx(s.a1), Y = sy(s.a2), lv = extra(f, s.a1, s.a2);
        region.clear(); point.clear();
        if (mode === 'lasso') {
          var dia = [[sx(T), OY], [OX, sy(T)], [sx(-T), OY], [OX, sy(-T)]];
          region.hatch(dia, { op: 0.32 });
          region.poly(dia, { w: 1.6, op: 0.9, rough: 0.5 });
        } else {
          var r = Math.sqrt(T) * UNIT, ring = [];
          for (var j = 0; j < 48; j++) ring.push([OX + r * Math.cos(j / 48 * 2 * Math.PI), OY + r * Math.sin(j / 48 * 2 * Math.PI)]);
          region.hatch(ring, { op: 0.32 });
          region.circle(OX, OY, r, { w: 1.6, op: 0.9 });
        }
        drawContour(region, lv, { w: 1.1, op: 0.85, rough: 0.3 });
        point.paper(X - 6, Y - 6, 12, 12).setAttribute('rx', 6);
        point.dot(X, Y, 4.2, { accent: true });

        rowName.set(mode);
        v1.set(fmt(s.a1)); v2.set(fmt(s.a2));
        vErr.set('+' + Math.round(lv / f.mse * 100) + '%');
        rule.set((mode === 'lasso' ? '|a₁| + |a₂| ≤ ' : 'a₁² + a₂² ≤ ') + T.toFixed(2));

        if (k.step() === 3) {
          paths.clear();
          [1, 2].forEach(function (c) {
            paths.polyline(track[mode].map(function (p) { return [px(p[0]), py(p[c])]; }), { w: 1.1, op: 0.85 });
            paths.text(PP.x + PP.w + 5, py(track[mode][200][c]) + 3.5, c === 1 ? 'a₁' : 'a₂', { kind: 'axis' });
          });
          paths.line(px(T), PP.y, px(T), PP.y + PP.h, { w: 0.6, op: 0.5, rough: 0.2 });
          paths.dot(px(T), py(s.a1), 2.4);
          paths.dot(px(T), py(s.a2), 2.4);
          hand1.set(mode === 'lasso' ? 'one is dropped' : 'both shrink,');
          hand2.set(mode === 'lasso' ? 'until T passes ' + tZero.toFixed(2) : 'neither reaches zero');
        }
      }

      /* ---- controls: switch the constraint (steps 2-3), slide the budget (step 3) ---- */
      var toggle = k.button(SIDE, 170, 'switch to lasso', function () {
        mode = mode === 'lasso' ? 'ridge' : 'lasso';
        toggle.set('switch to ' + (mode === 'lasso' ? 'ridge' : 'lasso'));
        redraw(); callouts();
      }, { steps: [2, 3] });
      var slider = k.slider({
        x: SIDE, y: 210, w: 158, min: T_MIN, max: T_MAX, step: 0.05, value: T_START,
        label: 'budget T', steps: [3],
        format: function (v) { return v.toFixed(2); },
        onChange: function (v) { T = v; redraw(); }
      });

      var c1 = k.root.layer({ steps: [1] }), c2 = k.root.layer({ steps: [2] });
      function callouts() {
        var s;
        c1.clear(); c2.clear();
        if (k.step() === 1) { s = solve('lasso', T); c1.callout('b', 'a corner: a₂ is exactly 0', SIDE, 176, { to: [sx(s.a1) + 8, sy(s.a2) - 5] }); }
        if (k.step() === 2) {
          s = solve(mode, T);
          c2.callout('c', mode === 'ridge' ? 'shrunk, but neither is 0' : 'a corner: a₂ is exactly 0', SIDE, 204, { to: [sx(s.a1) + 8, sy(s.a2) - 5] });
        }
      }

      k.onStep(function (step) {
        if (step < 3) { T = T_START; slider.set(T_START, true); }
        if (step === 1) mode = 'lasso';
        if (step === 2) mode = 'ridge';
        toggle.set('switch to ' + (mode === 'lasso' ? 'ridge' : 'lasso'));
        if (step > 0) redraw();
        callouts();
      });
    }
  });
})();
