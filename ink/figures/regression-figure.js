/* Regression figure — the reader draws a line by hand, scores it, and watches it nudged into place.
   Steps: 0 drag the two ends of a line through twelve made-up days; every miss is drawn as a hatched square
          and the squares are added up. Click a point to see its own sum (the line says, the truth, the miss).
          1 the nudge: from the reader's line, try each number a little up and down, keep what lowers the
          total, halve the nudge when nothing helps, stop when the nudges are tiny (animated, with a chart).
          2 points that bend: a straight line, x squared alone, or x and x squared together (buttons).
   The line the reader drew is remembered (sessionStorage) and offered to the page's Python through
   window.InkPage, with the points, so the code works on exactly what the reader did. The nudge here is the
   same loop, in the same order, as the lesson's Python, so the totals agree. The least possible total and the
   curved fits are ordinary least squares solved in the browser. Made-up data. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var NS = 'http://www.w3.org/2000/svg';
  var PLOT = { x: 44, y: 34, w: 392, h: 372 };       // the plot area, in figure pixels
  var SIDE = 462, RIGHT = SIDE + 158;                // the column beside the plot
  var DOM = 10;                                      // the straight story runs 0..10 on both axes
  var BX = [-6, 6];                                  // the bent story runs -6..6 across
  var GUESS = { tilt: 0.12, height: 5 };             // the line before the reader touches it: too flat on purpose
  var STORE = 'ink-line-mine';

  function r2(v) { return Math.round(v * 100) / 100; }
  function r3(v) { return Math.round(v * 1000) / 1000; }
  function noise(rand, s) { return (rand() + rand() + rand() - 1.5) * s; }

  /* the points are made once, to two decimals, so the page's Python works on exactly the same ones */
  function makeLinear(rand) {
    var pts = [];
    for (var i = 0; i < 12; i++) {
      var x = 0.9 + i * 0.76 + (rand() - 0.5) * 0.5;
      pts.push([r2(x), r2(1.7 + 0.6 * x + noise(rand, 1.9))]);
    }
    return pts;
  }
  function makeBent(rand) {
    var pts = [];
    for (var i = 0; i < 16; i++) {
      var x = -5 + i * 0.66 + (rand() - 0.5) * 0.4;
      pts.push([r2(x), r2(8.6 - 0.16 * (x - 2) * (x - 2) + noise(rand, 0.9))]);
    }
    return pts;
  }
  var POINTS = makeLinear(window.InkKit.rng(5));
  var BENT = makeBent(window.InkKit.rng(7));

  /* the same arithmetic as the lesson's Python, in the same order */
  function predict(x, tilt, height) { return height + tilt * x; }
  function total(pts, tilt, height) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) { var miss = pts[i][1] - predict(pts[i][0], tilt, height); s = s + miss * miss; }
    return s;
  }
  /* one round of nudges: returns true if anything moved; halves the step if nothing did */
  function nudgeRound(pts, s) {
    var moved = false, moves = [[s.step, 0], [-s.step, 0], [0, s.step], [0, -s.step]];
    for (var i = 0; i < moves.length; i++) {
      if (total(pts, s.tilt + moves[i][0], s.height + moves[i][1]) < total(pts, s.tilt, s.height)) {
        s.tilt = s.tilt + moves[i][0]; s.height = s.height + moves[i][1]; moved = true;
      }
    }
    if (!moved) s.step = s.step / 2;
    return moved;
  }

  /* least squares for y on the given columns (each a function of x): solves the normal equations */
  function fitLS(pts, cols) {
    var m = cols.length, A = [], i, j, r, c;
    for (i = 0; i < m; i++) { A.push([]); for (j = 0; j <= m; j++) A[i].push(0); }
    pts.forEach(function (p) {
      var v = cols.map(function (f) { return f(p[0]); });
      for (i = 0; i < m; i++) { for (j = 0; j < m; j++) A[i][j] += v[i] * v[j]; A[i][m] += v[i] * p[1]; }
    });
    for (c = 0; c < m; c++) {
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
  function sseOf(pts, f) { var s = 0; pts.forEach(function (p) { var e = p[1] - f(p[0]); s += e * e; }); return s; }
  var ONE = function () { return 1; }, X = function (x) { return x; }, X2 = function (x) { return x * x; };

  function remembered() {
    try {
      var v = JSON.parse(sessionStorage.getItem(STORE));
      return v && isFinite(v.tilt) && isFinite(v.height) ? v : null;
    } catch (e) { return null; }
  }
  function remember(line) {
    try { sessionStorage.setItem(STORE, JSON.stringify(line)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('ink:line-mine')); } catch (e) {}
  }
  function mine() { return remembered() || GUESS; }

  /* what `from page import points, my_tilt, my_height, bent` gives the Python on the same page */
  window.InkPage = window.InkPage || {};
  window.InkPage.points = function () { return POINTS; };
  window.InkPage.my_tilt = function () { return mine().tilt; };
  window.InkPage.my_height = function () { return mine().height; };
  window.InkPage.bent = function () { return BENT; };

  window.InkKit.define('regression-figure', {
    label: 'Fitting a line by hand: drag a line through points, see each miss as a square, then watch the line nudged to the smallest total',
    steps: 3,
    seed: 23,
    draw: function (k) {
      var sx = k.scale(0, DOM, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(0, DOM, PLOT.y + PLOT.h, PLOT.y);
      var bx = k.scale(BX[0], BX[1], PLOT.x, PLOT.x + PLOT.w);
      var unit = PLOT.h / DOM;                        // pixels per data unit, vertically
      var ls = fitLS(POINTS, [ONE, X]);
      var best = { tilt: ls(1) - ls(0), height: ls(0) };
      var bestTotal = total(POINTS, best.tilt, best.height);
      var cur = { tilt: GUESS.tilt, height: GUESS.height }, picked = -1;

      function raw(layer, d, w, op, accent) {
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
        p.setAttribute('stroke-width', w); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('opacity', op);
        if (accent) p.setAttribute('class', 'ik-accent');
        layer.node.appendChild(p);
        return p;
      }
      /* the stretch of the line that lies inside the plot, as a path */
      function lineD(l) {
        var x0 = 0, x1 = DOM;
        if (Math.abs(l.tilt) > 1e-9) {
          var xa = (0 - l.height) / l.tilt, xb = (DOM - l.height) / l.tilt;
          x0 = Math.max(x0, Math.min(xa, xb)); x1 = Math.min(x1, Math.max(xa, xb));
        } else if (l.height < 0 || l.height > DOM) return '';
        if (x1 <= x0) return '';
        return 'M' + sx(x0).toFixed(1) + ' ' + sy(predict(x0, l.tilt, l.height)).toFixed(1) +
          ' L' + sx(x1).toFixed(1) + ' ' + sy(predict(x1, l.tilt, l.height)).toFixed(1);
      }
      /* the square on one miss: one side is the gap from the point up or down to the line */
      function square(p, l) {
        var res = p[1] - predict(p[0], l.tilt, l.height), side = Math.abs(res) * unit;
        var px = sx(p[0]), top = Math.max(PLOT.y, sy(Math.max(p[1], p[1] - res)));
        var bottom = Math.min(PLOT.y + PLOT.h, sy(Math.min(p[1], p[1] - res)));
        var left = res * l.tilt > 0;                  // open away from the line, so the line does not cut the square
        if (left && px - side < PLOT.x + 2) left = false;
        if (!left && px + side > PLOT.x + PLOT.w - 2) left = px - side >= PLOT.x + 2;
        var w = Math.min(side, left ? px - PLOT.x - 2 : PLOT.x + PLOT.w - 2 - px);
        return { x: left ? px - w : px, y: top, w: w, h: bottom - top, px: px, py: sy(p[1]), ly: sy(p[1] - res) };
      }
      function boxD(s) {
        return 'M' + s.x.toFixed(1) + ' ' + s.y.toFixed(1) + ' h' + s.w.toFixed(1) + ' v' + s.h.toFixed(1) + ' h' + (-s.w).toFixed(1) + ' Z ';
      }
      function hatchD(s) {                            // 45 degree hairlines inside the square, 4.5 px apart
        var d = '', g = 4.5, size = Math.max(s.w, s.h);
        for (var c = g; c < s.w + s.h; c += g) {
          var u0 = Math.max(0, c - s.h), u1 = Math.min(s.w, c);
          if (u1 - u0 < 0.5) continue;
          d += 'M' + (s.x + u0).toFixed(1) + ' ' + (s.y + s.h - (c - u0)).toFixed(1) + ' L' + (s.x + u1).toFixed(1) + ' ' + (s.y + s.h - (c - u1)).toFixed(1) + ' ';
        }
        return size > 2 ? d : '';
      }
      function drawSquares(layer, l, heavy) {
        var boxes = '', hatch = '', strong = '';
        POINTS.forEach(function (p, i) {
          var s = square(p, l);
          if (s.h < 1.5) return;
          hatch += hatchD(s);
          if (i === heavy) strong += boxD(s) + 'M' + s.px.toFixed(1) + ' ' + s.py.toFixed(1) + ' V' + s.ly.toFixed(1);
          else boxes += boxD(s);
        });
        if (hatch) raw(layer, hatch, 0.6, 0.38);
        if (boxes) raw(layer, boxes, 0.7, 0.6);
        if (strong) raw(layer, strong, 1.6, 0.95);
      }

      /* ---- axes: one pair for the straight story, one for the bent one ---- */
      var ax01 = k.root.group({ steps: [0, 1] });
      ax01.axes({
        x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'hours of sun', ylabel: 'ice creams, in tens',
        xticks: [0, 2, 4, 6, 8, 10].map(function (v) { return [sx(v), String(v)]; }),
        yticks: [0, 2, 4, 6, 8, 10].map(function (v) { return [sy(v), String(v)]; })
      });
      var ax2 = k.root.group({ steps: [2] });
      ax2.axes({
        x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'degrees from 20', ylabel: 'growth, cm a week',
        xticks: [-6, -4, -2, 0, 2, 4, 6].map(function (v) { return [bx(v), String(v)]; }),
        yticks: [0, 2, 4, 6, 8, 10].map(function (v) { return [sy(v), String(v)]; })
      });

      var live = k.root.layer();                      // squares and the line, redrawn on every change (steps 0, 1)
      var live2 = k.root.layer();                     // the bent story's fit and misses (step 2)

      /* ---- the points ---- */
      var marks = k.root.group({ steps: [0, 1], d: 150, stagger: 22 });
      POINTS.forEach(function (p) { marks.mark(sx(p[0]), sy(p[1]), 'o'); });
      marks.node.style.pointerEvents = 'none';
      var marks2 = k.root.group({ steps: [2], d: 150, stagger: 18 });
      BENT.forEach(function (p) { marks2.mark(bx(p[0]), sy(p[1]), 'o'); });
      marks2.node.style.pointerEvents = 'none';

      /* ---- the side column, steps 0 and 1 ---- */
      var side = k.root.group({ steps: [0, 1], d: 250 });
      side.text(SIDE, 60, 'tilt', { kind: 'label' });
      var vTilt = side.text(RIGHT, 60, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 80, 'height', { kind: 'label' });
      var vHeight = side.text(RIGHT, 80, '', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 92, RIGHT, 92, { w: 0.6, op: 0.45, rough: 0.3 });
      side.text(SIDE, 114, 'all squares', { kind: 'label' });
      var vTotal = side.text(RIGHT, 114, '', { kind: 'val', anchor: 'end' });
      function readout() {
        vTilt.set(cur.tilt.toFixed(2)); vHeight.set(cur.height.toFixed(2));
        vTotal.set(total(POINTS, cur.tilt, cur.height).toFixed(2));
      }

      /* ---- step 0: two handles hold the line; click a point for its own sum ---- */
      var g0 = k.root.group({ steps: [0], d: 300 });
      g0.callout('a', 'drag either end', SIDE, 150, { d: 500 });
      g0.text(SIDE, 186, 'click a point:', { kind: 'axis' });
      var rows0 = ['the line says', 'the truth', 'the miss', 'squared'].map(function (name, i) {
        g0.text(SIDE, 210 + i * 20, name, { kind: 'label' });
        return g0.text(RIGHT, 210 + i * 20, '–', { kind: 'val', anchor: 'end' });
      });
      g0.line(SIDE, 282, RIGHT, 282, { w: 0.6, op: 0.45, rough: 0.3 });
      var hand0 = k.root.group({ steps: [0], d: 700 });
      hand0.text(SIDE, 330, 'make the total', { kind: 'hand' });
      hand0.text(SIDE, 352, 'as small as you can.', { kind: 'hand' });
      function pointSum() {
        if (picked < 0) { rows0.forEach(function (r) { r.set('–'); }); return; }
        var p = POINTS[picked], says = predict(p[0], cur.tilt, cur.height), miss = p[1] - says;
        rows0[0].set(says.toFixed(2)); rows0[1].set(p[1].toFixed(2));
        rows0[2].set(miss.toFixed(2)); rows0[3].set((miss * miss).toFixed(2));
      }
      function redraw0() {
        live.clear();
        drawSquares(live, cur, picked);
        var d = lineD(cur);
        if (d) raw(live, d, 1.6, 0.9);
        readout(); pointSum();
      }

      var hits = k.root.group({ steps: [0] });
      POINTS.forEach(function (p, i) {
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', sx(p[0])); c.setAttribute('cy', sy(p[1])); c.setAttribute('r', 11);
        c.setAttribute('class', 'ik-hit'); c.style.cursor = 'pointer';
        c.setAttribute('tabindex', 0); c.setAttribute('role', 'button');
        c.setAttribute('aria-label', 'Day ' + (i + 1) + ': ' + p[0] + ' hours of sun, ' + p[1] + ' tens of ice creams');
        function pick() { if (k.step() === 0) { picked = i; redraw0(); } }
        c.addEventListener('click', pick);
        c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
        hits.node.appendChild(c);
      });

      var hg = k.root.group({ steps: [0], d: 400 });
      var ends = [0, DOM].map(function (hx, i) {
        var x0 = sx(hx), y0 = sy(predict(hx, GUESS.tilt, GUESS.height));
        var h = { hx: hx, y0: y0 };
        hg.paper(x0 - 7, y0 - 7, 14, 14).setAttribute('rx', 7);
        h.patch = hg.node.lastChild;
        h.node = hg.mark(x0, y0, 'o', { r: 6, w: 1.6, accent: true, op: 1 });
        h.place = function (yData) {
          var t = 'translate(0 ' + (sy(yData) - y0).toFixed(1) + ')';
          h.node.setAttribute('transform', t); h.patch.setAttribute('transform', t);
          if (h.drag) h.drag.set(x0, sy(yData));
        };
        h.drag = k.draggable(h.node, {
          x: x0, y: y0, label: (i ? 'Right' : 'Left') + ' end of the line. Up and down arrow keys move it.',
          bounds: { x0: x0, y0: PLOT.y, x1: x0, y1: PLOT.y + PLOT.h },
          onMove: function (x, y) {
            if (k.step() !== 0) return;
            var v = r2((PLOT.y + PLOT.h - y) / PLOT.h * DOM);
            var left = i === 0 ? v : cur.height, right = i === 1 ? v : predict(DOM, cur.tilt, cur.height);
            cur = { tilt: r3((right - left) / DOM), height: r2(left) };
            placeEnds(); redraw0();
          },
          onEnd: function () { if (k.step() === 0) remember({ tilt: cur.tilt, height: cur.height }); }
        });
        return h;
      });
      function placeEnds() {
        ends[0].place(cur.height);
        ends[1].place(predict(DOM, cur.tilt, cur.height));
      }

      /* ---- step 1: the nudge ---- */
      var g1 = k.root.group({ steps: [1], d: 300 });
      g1.text(SIDE, 134, 'least possible', { kind: 'label' });
      g1.text(RIGHT, 134, bestTotal.toFixed(2), { kind: 'val', anchor: 'end' });
      g1.line(SIDE, 146, RIGHT, 146, { w: 0.6, op: 0.45, rough: 0.3 });
      var nudge = { tilt: 0, height: 0, step: 0.5 }, rounds = 0, history = [], busy = false, settled = false, cancel = null;
      var note1 = g1.text(SIDE, 276, '', { kind: 'axis' });
      var callB = k.root.group({ steps: [1], d: 500 });
      callB.callout('b', 'nothing helps any more', SIDE, 298);
      var chart = k.root.layer({ steps: [1] });
      function drawChart() {
        chart.clear();
        var x0 = SIDE + 6, x1 = RIGHT - 2, y0 = 334, y1 = 400, top = Math.max(history[0], bestTotal) * 1.05, n = Math.max(10, history.length - 1);
        chart.text(SIDE, y0 - 10, 'total, round by round', { kind: 'label' });
        raw(chart, 'M' + x0 + ' ' + y1 + ' H' + x1 + ' M' + x0 + ' ' + y1 + ' V' + y0, 0.8, 0.8);
        var yb = y1 - (y1 - y0) * bestTotal / top;
        raw(chart, 'M' + x0 + ' ' + yb.toFixed(1) + ' H' + x1, 0.6, 0.45).setAttribute('stroke-dasharray', '2 3');
        var d = '';
        history.forEach(function (v, i) { d += (i ? ' L' : 'M') + (x0 + (x1 - x0) * i / n).toFixed(1) + ' ' + (y1 - (y1 - y0) * v / top).toFixed(1); });
        raw(chart, d, 1.2, 0.85);
      }
      function label1() {
        note1.set(settled ? 'stopped after ' + rounds + ' rounds' : 'round ' + rounds + ', nudge ' + nudge.step.toFixed(3));
        callB.node.style.display = settled ? '' : 'none';
        bOnce.node.style.display = bRun.node.style.display = settled ? 'none' : '';
      }
      function redraw1() {
        live.clear();
        drawSquares(live, cur, -1);
        var d = lineD(cur);
        if (d) raw(live, d, 1.6, 0.95, true);
        readout();
      }
      function enter1() {
        if (cancel) cancel();
        var m = mine();
        nudge = { tilt: m.tilt, height: m.height, step: 0.5 }; rounds = 0; settled = false; busy = false;
        cur = { tilt: m.tilt, height: m.height };
        history = [total(POINTS, cur.tilt, cur.height)];
        redraw1(); drawChart(); label1();
      }
      function oneRound(ms, done) {
        if (settled) { if (done) done(); return; }
        var from = { tilt: nudge.tilt, height: nudge.height };
        var moved = nudgeRound(POINTS, nudge);
        rounds++;
        if (nudge.step <= 0.001) settled = true;      // the same test as the Python's `while step > 0.001`
        history.push(total(POINTS, nudge.tilt, nudge.height));
        function finish() { cur = { tilt: nudge.tilt, height: nudge.height }; busy = false; redraw1(); drawChart(); label1(); if (done) done(); }
        if (!moved) { finish(); return; }
        busy = true;
        cancel = k.animate(ms, function (t) {
          cur = { tilt: from.tilt + (nudge.tilt - from.tilt) * t, height: from.height + (nudge.height - from.height) * t };
          redraw1();
          if (t >= 1) finish();
        });
      }
      var bOnce = k.button(SIDE, 176, 'nudge once', function () { if (!busy) oneRound(380); }, { steps: [1] });
      var bRun = k.button(SIDE, 212, 'nudge until it stops', function () {
        if (busy) return;
        (function loop() { if (settled || k.step() !== 1) return; oneRound(110, function () { setTimeout(loop, 20); }); })();
      }, { steps: [1] });
      k.button(SIDE, 248, 'back to your line', function () { enter1(); }, { steps: [1] });

      window.addEventListener('ink:line-mine', function () {
        if (k.step() === 1 && !busy && rounds === 0) enter1();
      });

      /* ---- step 2: points that bend, and three ways to fit them ---- */
      var fits = [
        { name: 'x only', f: fitLS(BENT, [ONE, X]), note: 'misses in a pattern' },
        { name: 'x squared only', f: fitLS(BENT, [ONE, X2]), note: 'still a pattern' },
        { name: 'x and x squared', f: fitLS(BENT, [ONE, X, X2]), note: 'no pattern left' }
      ];
      var maxRes = 0, chosen = 0;
      fits.forEach(function (ft) {
        ft.total = sseOf(BENT, ft.f);
        BENT.forEach(function (p) { maxRes = Math.max(maxRes, Math.abs(p[1] - ft.f(p[0]))); });
      });
      var ROWS = [70, 100, 130], MINI = { y: 214, h: 26 };
      var mx = k.scale(BX[0], BX[1], SIDE + 2, RIGHT - 2);
      var g2 = k.root.group({ steps: [2], d: 300 });
      g2.text(SIDE, 44, 'give it', { kind: 'axis' });
      g2.text(RIGHT, 44, 'total', { kind: 'axis', anchor: 'end' });
      fits.forEach(function (ft, i) { g2.text(RIGHT, ROWS[i], ft.total.toFixed(1), { kind: 'val', anchor: 'end' }); });
      g2.line(SIDE, 148, RIGHT, 148, { w: 0.6, op: 0.45, rough: 0.3 });
      g2.text(SIDE, 172, 'misses, along x', { kind: 'label' });
      g2.line(SIDE, MINI.y, RIGHT, MINI.y, { w: 0.6, op: 0.55, rough: 0.2 });
      var hand2 = k.root.group({ steps: [2], d: 700 });
      hand2.text(SIDE, 318, 'keep x,', { kind: 'hand' });
      hand2.text(SIDE, 340, 'add x squared.', { kind: 'hand' });
      var marker2 = k.root.layer({ steps: [2] });
      function redraw2() {
        var ft = fits[chosen], d = '', seg = '', i, pen = false;
        live2.clear(); marker2.clear();
        BENT.forEach(function (p) { seg += 'M' + bx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1) + ' V' + sy(ft.f(p[0])).toFixed(1) + ' '; });
        raw(live2, seg, 0.7, 0.6);
        for (i = 0; i <= 120; i++) {
          var x = BX[0] + i / 120 * (BX[1] - BX[0]), y = ft.f(x);
          if (y >= 0 && y <= DOM) { d += (pen ? ' L' : 'M') + bx(x).toFixed(1) + ' ' + sy(y).toFixed(1); pen = true; } else pen = false;
        }
        raw(live2, d, 1.6, 0.9);
        var dots = '';
        BENT.forEach(function (p) {
          var cx = mx(p[0]), cy = MINI.y - (p[1] - ft.f(p[0])) / maxRes * MINI.h;
          dots += 'M' + (cx - 0.01).toFixed(2) + ' ' + cy.toFixed(1) + ' L' + cx.toFixed(2) + ' ' + cy.toFixed(1) + ' ';
        });
        raw(live2, dots, 4.4, 0.95, true);           // round caps on a zero-length stroke: dots, in the accent
        marker2.dot(SIDE - 10, ROWS[chosen] - 3.5, 2.6);
        marker2.text(SIDE, 268, ft.note, { kind: 'axis' });
      }
      fits.forEach(function (ft, i) {
        k.button(SIDE, ROWS[i], ft.name, function () { chosen = i; redraw2(); }, { steps: [2] });
      });

      k.onStep(function (step) {
        if (cancel) cancel();
        busy = false;
        live.node.style.display = step <= 1 ? '' : 'none';
        live2.node.style.display = step === 2 ? '' : 'none';
        chart.node.style.display = step === 1 ? '' : 'none';
        hits.node.style.pointerEvents = step === 0 ? 'auto' : 'none';
        ends.forEach(function (h) { h.node.style.pointerEvents = step === 0 ? 'auto' : 'none'; });
        if (step === 0) {
          var m = mine();
          cur = { tilt: m.tilt, height: m.height };
          placeEnds(); redraw0();
        } else if (step === 1) enter1();
        else redraw2();
      });
    }
  });
})();
