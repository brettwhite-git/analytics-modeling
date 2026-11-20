/* Regression figure — a line through a scatter, judged by the squares of its misses.
   Everything is ordinary least squares solved in the browser (normal equations), so the fitted line, the
   squares, the sum of squares and R² are computed from the points that are drawn, not posed.
   Steps: 0 the problem (a guessed line and how far each point is from it) · 1 least squares (every miss
          drawn as a square, the fitted line) · 2 drag the line and watch the sum of squares against the
          least possible · 3 a curved pattern: fit y on x, on x² alone, or on x and x² together (buttons).
   Made-up points. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };       // the plot area, in figure pixels
  var SIDE = 462, RIGHT = SIDE + 158;                // the column beside the plot
  var DOM = 10;                                      // data runs 0..10 on both axes
  var GUESS = { a0: 5.0, a1: 0.12 };                 // the hand-placed line of step 0: too flat on purpose
  var HX = [1.5, 8.5];                               // where the two handles sit along x

  function noise(rand, s) { return (rand() + rand() + rand() - 1.5) * s; }

  function makeLinear(rand) {
    var pts = [];
    for (var i = 0; i < 12; i++) {
      var x = 0.9 + i * 0.76 + (rand() - 0.5) * 0.5;
      pts.push({ x: x, y: 1.7 + 0.6 * x + noise(rand, 1.9) });
    }
    return pts;
  }
  function makeCurved(rand) {
    var pts = [];
    for (var i = 0; i < 16; i++) {
      var x = 0.6 + i * 0.6 + (rand() - 0.5) * 0.4;
      pts.push({ x: x, y: 0.9 + 2.3 * x - 0.19 * x * x + noise(rand, 1.1) });
    }
    return pts;
  }

  /* least squares for y on the given columns (each a function of x): solves the normal equations */
  function fitLS(pts, cols) {
    var m = cols.length, A = [], i, j, r, c;
    for (i = 0; i < m; i++) { A.push([]); for (j = 0; j <= m; j++) A[i].push(0); }
    pts.forEach(function (p) {
      var v = cols.map(function (f) { return f(p.x); });
      for (i = 0; i < m; i++) { for (j = 0; j < m; j++) A[i][j] += v[i] * v[j]; A[i][m] += v[i] * p.y; }
    });
    for (c = 0; c < m; c++) {                         // Gauss-Jordan with partial pivoting
      var best = c;
      for (r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[best][c])) best = r;
      var tmp = A[c]; A[c] = A[best]; A[best] = tmp;
      for (r = 0; r < m; r++) {
        if (r === c) continue;
        var f = A[r][c] / A[c][c];
        for (j = c; j <= m; j++) A[r][j] -= f * A[c][j];
      }
    }
    var coef = A.map(function (row, k) { return row[m] / row[k]; });
    return function (x) { var s = 0; for (var k = 0; k < m; k++) s += coef[k] * cols[k](x); return s; };
  }
  function sse(pts, f) { var s = 0; pts.forEach(function (p) { var e = p.y - f(p.x); s += e * e; }); return s; }
  function sst(pts) {
    var mean = 0; pts.forEach(function (p) { mean += p.y / pts.length; });
    var s = 0; pts.forEach(function (p) { s += (p.y - mean) * (p.y - mean); }); return s;
  }

  var ONE = function () { return 1; }, X = function (x) { return x; }, X2 = function (x) { return x * x; };

  window.InkKit.define('regression-figure', {
    label: 'Linear regression: a scatter of points, a line through them, and the squared misses the line is chosen to make small',
    steps: 4,
    seed: 23,
    draw: function (k) {
      var sx = k.scale(0, DOM, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(0, DOM, PLOT.y + PLOT.h, PLOT.y);
      var unit = PLOT.h / DOM;                        // pixels per data unit, vertically
      var pts = makeLinear(k.rng(5)), curved = makeCurved(k.rng(31));

      var ls = fitLS(pts, [ONE, X]);
      var best = { a0: ls(0), a1: ls(1) - ls(0) };
      var bestSSE = sse(pts, ls);
      var cur = { a0: GUESS.a0, a1: GUESS.a1 };       // the reader's line in step 2

      function lineFn(l) { return function (x) { return l.a0 + l.a1 * x; }; }
      /* the stretch of y = a0 + a1 x that lies inside the plot, in pixels */
      function clipped(l) {
        var x0 = 0, x1 = DOM;
        if (Math.abs(l.a1) > 1e-9) {
          var xa = (0 - l.a0) / l.a1, xb = (DOM - l.a0) / l.a1;
          x0 = Math.max(x0, Math.min(xa, xb)); x1 = Math.min(x1, Math.max(xa, xb));
        } else if (l.a0 < 0 || l.a0 > DOM) return null;
        if (x1 <= x0) return null;
        return [sx(x0), sy(l.a0 + l.a1 * x0), sx(x1), sy(l.a0 + l.a1 * x1)];
      }
      /* the square on one miss: one side is the vertical gap from the point to the line */
      function square(p, l) {
        var res = p.y - (l.a0 + l.a1 * p.x), side = Math.abs(res) * unit;
        var px = sx(p.x), top = sy(Math.max(p.y, p.y - res));
        var left = res * l.a1 > 0;                    // open away from the line, so the line does not cut the square
        if (left && px - side < PLOT.x + 2) left = false;
        if (!left && px + side > PLOT.x + PLOT.w - 2) left = px - side >= PLOT.x + 2;
        var w = Math.min(side, left ? px - PLOT.x - 2 : PLOT.x + PLOT.w - 2 - px);
        var xl = left ? px - w : px;
        return { res: res, side: side, pts: [[xl, top], [xl + w, top], [xl + w, top + side], [xl, top + side]] };
      }
      function drawSquares(g, l, accentBiggest) {
        var sq = pts.map(function (p) { return square(p, l); }), big = 0;
        sq.forEach(function (s, i) { if (s.side > sq[big].side) big = i; });
        sq.forEach(function (s, i) {
          if (s.side < 2.5) return;
          g.hatch(s.pts, { op: 0.34, gap: 4.5 });
          g.poly(s.pts, accentBiggest && i === big ? { w: 1.2, op: 0.95, rough: 0.3, accent: true } : { w: 0.6, op: 0.6, rough: 0.3 });
        });
        return sq[big];
      }

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'x', ylabel: 'y' });

      /* ---- step 0: a guessed line, and how far each point sits from it ---- */
      var g0 = k.root.group({ steps: [0], d: 300, stagger: 40 });
      var seg0 = clipped(GUESS), far = null;
      g0.line(seg0[0], seg0[1], seg0[2], seg0[3], { w: 1.1, op: 0.85, rough: 0.5 });
      pts.forEach(function (p) {
        var yhat = GUESS.a0 + GUESS.a1 * p.x;
        g0.line(sx(p.x), sy(p.y), sx(p.x), sy(yhat), { w: 0.6, op: 0.7, rough: 0.2 });
        // the callout points at the biggest miss near the right edge, so its leader never crosses the plot
        if (p.x > 7 && (!far || Math.abs(p.y - yhat) > Math.abs(far.y - far.yhat))) far = { x: p.x, y: p.y, yhat: yhat };
      });
      var farY = sy((far.y + far.yhat) / 2);
      g0.callout('a', 'how far off is it?', SIDE, farY - 14, { to: [sx(far.x) + 5, farY], d: 1100 });

      /* ---- step 1: every miss as a square, and the line that makes the squares smallest ---- */
      var g1 = k.root.group({ steps: [1], d: 200, stagger: 30 });
      var bigSq = drawSquares(g1, best, true);
      var seg1 = clipped(best);
      g1.line(seg1[0], seg1[1], seg1[2], seg1[3], { w: 1.7, op: 0.9, rough: 0.5, d: 700 });
      g1.callout('b', 'each miss, squared', SIDE, 178, { to: [bigSq.pts[1][0] + 4, bigSq.pts[1][1] + bigSq.side / 2], d: 1100 });

      /* ---- step 2: the reader's line, redrawn on every drag ---- */
      var live = k.root.layer({ steps: [2] });

      /* ---- the readouts for steps 1 and 2 ---- */
      var side = k.root.group({ steps: [1, 2], d: 300 });
      side.text(SIDE, 60, 'intercept', { kind: 'label' });
      var a0Val = side.text(RIGHT, 60, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 80, 'slope', { kind: 'label' });
      var a1Val = side.text(RIGHT, 80, '', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 92, RIGHT, 92, { w: 0.6, op: 0.45, rough: 0.3 });
      side.text(SIDE, 114, 'sum of squares', { kind: 'label' });
      var sseVal = side.text(RIGHT, 114, '', { kind: 'val', anchor: 'end' });
      var side2 = k.root.group({ steps: [2], d: 300 });
      side2.text(SIDE, 134, 'least possible', { kind: 'label' });
      side2.text(RIGHT, 134, bestSSE.toFixed(1), { kind: 'val', anchor: 'end' });

      function readout(l) {
        a0Val.set(l.a0.toFixed(2)); a1Val.set(l.a1.toFixed(2));
        sseVal.set(sse(pts, lineFn(l)).toFixed(1));
      }
      function redrawLive() {
        live.clear();
        drawSquares(live, cur, false);
        var seg = clipped(cur);
        if (seg) live.line(seg[0], seg[1], seg[2], seg[3], { w: 1.7, op: 0.9, rough: 0.4 });
        readout(cur);
      }

      /* ---- step 3: a curved pattern, and three ways to fit it ---- */
      var fits = [
        { name: 'x only', f: fitLS(curved, [ONE, X]), note: 'the misses bow' },
        { name: 'x² only', f: fitLS(curved, [ONE, X2]), note: 'still a pattern' },
        { name: 'x and x²', f: fitLS(curved, [ONE, X, X2]), note: 'no pattern left' }
      ];
      var total = sst(curved), chosen = 0, maxRes = 0;
      fits.forEach(function (ft) {
        ft.r2 = 1 - sse(curved, ft.f) / total;
        curved.forEach(function (p) { maxRes = Math.max(maxRes, Math.abs(p.y - ft.f(p.x))); });
      });
      var ROWS = [66, 96, 126], MINI = { y: 204, h: 26 };
      var mx = k.scale(0, DOM, SIDE + 2, RIGHT - 2);
      var g3 = k.root.group({ steps: [3], d: 300 });
      g3.text(SIDE, 40, 'fit y on', { kind: 'axis' });
      g3.text(RIGHT, 40, 'R²', { kind: 'axis', anchor: 'end' });
      fits.forEach(function (ft, i) { g3.text(RIGHT, ROWS[i], ft.r2.toFixed(2), { kind: 'val', anchor: 'end' }); });
      g3.line(SIDE, 144, RIGHT, 144, { w: 0.6, op: 0.45, rough: 0.3 });
      g3.text(SIDE, 166, 'misses, along x', { kind: 'label' });
      g3.line(SIDE, MINI.y, RIGHT, MINI.y, { w: 0.6, op: 0.55, rough: 0.2 });
      g3.text(SIDE, 290, 'keep x,', { kind: 'hand', d: 700 });
      g3.text(SIDE, 312, 'add x².', { kind: 'hand', d: 1100 });
      var live3 = k.root.layer({ steps: [3] });

      function redrawCurved() {
        var ft = fits[chosen], path = [], i;
        live3.clear();
        curved.forEach(function (p) {
          live3.line(sx(p.x), sy(p.y), sx(p.x), sy(ft.f(p.x)), { w: 0.6, op: 0.7, rough: 0.2 });
        });
        for (i = 0; i <= 80; i++) {
          var x = i / 80 * DOM, y = ft.f(x);
          if (y >= 0 && y <= DOM) path.push([sx(x), sy(y)]);
        }
        live3.polyline(path, { w: 1.7, op: 0.9 });
        live3.dot(SIDE - 10, ROWS[chosen] - 3.5, 2.6);
        var res = live3.group();
        res.node.setAttribute('class', 'ik-g ik-accent');
        curved.forEach(function (p) { res.dot(mx(p.x), MINI.y - (p.y - ft.f(p.x)) / maxRes * MINI.h, 2.2); });
        live3.callout('d', ft.note, SIDE, 254);
      }
      fits.forEach(function (ft, i) {
        k.button(SIDE, ROWS[i], ft.name, function () { chosen = i; redrawCurved(); }, { steps: [3] });
      });

      /* ---- the points: one set for the straight story, one for the curved one ---- */
      var marks = k.root.group({ steps: [0, 1, 2], d: 150, stagger: 22 });
      pts.forEach(function (p) { marks.mark(sx(p.x), sy(p.y), 'o'); });
      var marks3 = k.root.group({ steps: [3], d: 150, stagger: 18 });
      curved.forEach(function (p) { marks3.mark(sx(p.x), sy(p.y), 'o'); });

      /* ---- step 2: two handles hold the line ---- */
      var hg = k.root.group({ steps: [2], d: 400 });
      var handles = HX.map(function (hx, i) {
        var x0 = sx(hx), y0 = sy(GUESS.a0 + GUESS.a1 * hx);
        var h = { hx: hx, y0: y0, y: GUESS.a0 + GUESS.a1 * hx };
        hg.paper(x0 - 6, y0 - 6, 12, 12).setAttribute('rx', 6);
        h.patch = hg.node.lastChild;
        h.node = hg.mark(x0, y0, 'o', { r: 6, w: 1.5, accent: true, op: 1 });
        h.place = function (yData) {
          h.y = yData;
          var t = 'translate(0 ' + (sy(yData) - y0).toFixed(1) + ')';
          h.node.setAttribute('transform', t); h.patch.setAttribute('transform', t);
        };
        h.drag = k.draggable(h.node, {
          x: x0, y: y0, label: (i ? 'Right' : 'Left') + ' end of the line. Up and down arrow keys move it.',
          bounds: { x0: x0, y0: PLOT.y + 8, x1: x0, y1: PLOT.y + PLOT.h - 8 },
          onMove: function (x, y) {
            if (k.step() !== 2) return;
            h.place((PLOT.y + PLOT.h - y) / PLOT.h * DOM);
            fromHandles();
          }
        });
        return h;
      });
      function fromHandles() {
        cur.a1 = (handles[1].y - handles[0].y) / (HX[1] - HX[0]);
        cur.a0 = handles[0].y - cur.a1 * HX[0];
        redrawLive();
      }
      k.root.group({ steps: [2] }).callout('c', 'drag either end', SIDE, 178, { d: 400 });
      k.button(SIDE, 214, 'snap to best', function () {
        var from = handles.map(function (h) { return h.y; });
        k.animate(500, function (t) {
          handles.forEach(function (h, i) {
            var target = best.a0 + best.a1 * h.hx;
            h.place(from[i] + (target - from[i]) * t);
            h.drag.set(sx(h.hx), sy(h.y));
          });
          fromHandles();
        });
      }, { steps: [2] });

      k.onStep(function (step) {
        handles.forEach(function (h) { h.node.style.pointerEvents = step === 2 ? 'auto' : 'none'; });
        if (step === 1) readout(best);
        if (step === 2) redrawLive();
        if (step === 3) redrawCurved();
      });
    }
  });
})();
