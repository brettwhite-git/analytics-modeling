/* Lasso figure — what if every weight had a price?
   Steps: 0 the five weights of the plant model as bars. Slide the price; switch between paying by the sizes of the
          weights and paying by their squares. By sizes, the four chance measurements drop to exactly zero one by
          one; by squares, every bar shrinks and none reaches zero.
          1 every column on the same ruler (divided by its spread). Slide the price, or try every price, and keep
          the one with the lowest miss on the fresh plants: a small chart of fresh miss against price.
          2 the same idea as a picture, for two weights only: error rings around the unpriced fit, and the budget
          region (a diamond for sizes, a circle for squares). Slide the budget T. Its own made-up data.
   Steps 0-1 run the lesson's own loop (variable-selection-from-scratch.qmd, cells 3 and 5) on the plants of
   keep-noise.js, so the bars match the page's Python. Step 2 solves the two-weight problem exactly.
   Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };       // the plot area, in figure pixels
  var SIDE = 462;                                    // left edge of the column beside the plot
  var NAMES = ['sun', 'name', 'day', 'pot', 'coin'];

  /* ======================= steps 0-1: the plants and the lesson's loop ======================= */
  // the same sixteen made-up plants as keep-noise.js: sun, name, day, pot, coin, height
  var SEEN = [[9, 8, 2, 8, 5, 29], [7, 4, 4, 9, 5, 25], [10, 4, 3, 6, 6, 39], [4, 6, 6, 9, 6, 14],
              [2, 8, 2, 9, 6, 15], [4, 6, 6, 7, 2, 17], [6, 9, 2, 5, 5, 21], [6, 10, 7, 4, 8, 24]];
  var FRESH = [[4, 5, 5, 10, 8, 17], [8, 6, 6, 6, 5, 30], [7, 5, 5, 9, 8, 25], [2, 9, 2, 9, 4, 12],
               [10, 6, 1, 8, 5, 31], [7, 9, 5, 10, 3, 28], [10, 3, 6, 9, 5, 38], [4, 6, 4, 9, 5, 17]];
  var PRICES0 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 300];
  var PRICES1 = [];
  for (var pp = 0; pp <= 40; pp += 2) PRICES1.push(pp);

  function middles(rows) {
    var mids = [];
    for (var j = 0; j < 6; j++) { var s = 0; rows.forEach(function (r) { s += r[j]; }); mids.push(s / rows.length); }
    return mids;
  }
  function guess(avg, w, row) {
    var g = avg[5];
    for (var j = 0; j < 5; j++) g = g + w[j] * (row[j] - avg[j]);
    return g;
  }
  function miss(avg, w, rows) {
    var total = 0;
    rows.forEach(function (row) { var off = row[5] - guess(avg, w, row); total = total + off * off; });
    return total;
  }
  function pay(weight, cut, kind) {
    if (kind === 'squares') return weight / (1 + 2 * cut);
    if (weight > cut) return weight - cut;
    if (weight < -cut) return weight + cut;
    return 0;
  }
  function fit(seen, avg, price, kind) {
    var rate = [], j;
    for (j = 0; j < 5; j++) {
      var swing = 0;
      seen.forEach(function (row) { var d = row[j] - avg[j]; swing += d * d; });
      rate.push(1 / (2 * swing));
    }
    var w = [0, 0, 0, 0, 0];
    for (var s = 0; s < 40; s++) {
      for (j = 0; j < 5; j++) {
        var old = w[j], before = miss(avg, w, seen);
        w[j] = old + 0.001;
        var slope = (miss(avg, w, seen) - before) / 0.001;
        w[j] = old - rate[j] * slope;
        w[j] = pay(w[j], rate[j] * price, kind);
      }
    }
    return w;
  }
  function solved(seen, fresh, avg, price, kind) {
    var w = fit(seen, avg, price, kind);
    return { w: w, seen: miss(avg, w, seen), fresh: miss(avg, w, fresh), zeros: w.filter(function (v) { return v === 0; }).length,
      size: w.reduce(function (s, v) { return s + Math.abs(v); }, 0), squares: w.reduce(function (s, v) { return s + v * v; }, 0) };
  }
  // step 0: the plants as written down
  var AVG = middles(SEEN);
  var RAW = { sizes: PRICES0.map(function (p) { return solved(SEEN, FRESH, AVG, p, 'sizes'); }),
              squares: PRICES0.map(function (p) { return solved(SEEN, FRESH, AVG, p, 'squares'); }) };
  // step 1: every column divided by its spread (the seen plants' spread, used for the fresh ones too)
  var SPREAD = [0, 1, 2, 3, 4].map(function (j) {
    var s = 0; SEEN.forEach(function (row) { var d = row[j] - AVG[j]; s += d * d; });
    return Math.sqrt(s / SEEN.length);
  });
  function scale(row) { return [0, 1, 2, 3, 4].map(function (j) { return row[j] / SPREAD[j]; }).concat([row[5]]); }
  var SEEN_S = SEEN.map(scale), FRESH_S = FRESH.map(scale), AVG_S = middles(SEEN_S);
  var RULED = PRICES1.map(function (p) { return solved(SEEN_S, FRESH_S, AVG_S, p, 'sizes'); });

  function hatchD(x0, y0, x1, y1, gap) {
    // clean 40-degree hairlines inside a box, so a moving bar never re-wobbles
    var d = '', t = Math.tan(40 * Math.PI / 180), h = y1 - y0;
    if (h < 0.5 || x1 - x0 < 0.5) return '';
    for (var c = x0 - h / t; c < x1; c += gap) {
      var xa = c, ya = y1, xb = c + h / t, yb = y0;
      if (xa < x0) { ya = y1 - (x0 - xa) * t; xa = x0; }
      if (xb > x1) { yb = y0 + (xb - x1) * t; xb = x1; }
      if (xb > xa) d += 'M' + xa.toFixed(1) + ' ' + ya.toFixed(1) + ' L' + xb.toFixed(1) + ' ' + yb.toFixed(1) + ' ';
    }
    return d;
  }

  /* ======================= step 2: the two-weight picture (exact) ======================= */
  var OX = 226, OY = 220, UNIT = 90;                 // where (0, 0) sits, and pixels per unit of weight
  var T_START = 1, T_MIN = 0.1, T_MAX = 2;
  var LEVELS = [0.04, 0.16, 0.36];                   // fixed error rings (mean squared error above the minimum)

  /* 40 made-up observations: two mildly correlated measurements, already on the same ruler, and a response */
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
      t = t <= 0 ? 0 : t >= 1 ? 1 : t;
      var a1 = t === 0 ? p[0] : t === 1 ? q[0] : p[0] + t * e1, a2 = t === 0 ? p[1] : t === 1 ? q[1] : p[1] + t * e2;
      var v = extra(f, a1, a2);
      if (!best || v < best.v) best = { a1: a1, a2: a2, v: v };
    }
    return best;
  }
  /* least error with a1^2 + a2^2 <= T: the ridge solution, with its price found by bisection */
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
  function runsInside(loop, r) {
    var runs = [], run = null, n = loop.length;
    for (var i = 0; i < n; i++) {
      var s = clipSeg(loop[i], loop[(i + 1) % n], r);
      if (!s) { run = null; continue; }
      if (!run || s[2]) { run = [s[0]]; runs.push(run); }
      run.push(s[1]);
      if (s[3]) run = null;
    }
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
    label: 'Five weights as bars under a price on their size or on their squares; the price chosen on fresh plants; and the diamond and circle picture for two weights',
    steps: 3,
    seed: 23,
    draw: function (k) {

      /* ---------------- steps 0-1: the bars ---------------- */
      var bars = { kind: 'sizes', i0: 0, i1: 0, now: [0, 0, 0, 0, 0], cancel: null };
      var LIM = [[-1.6, 3.2], [-3, 7]];                 // the weight axis in step 0 and in step 1
      var frame = k.root.layer({ steps: [0, 1] });
      var barLayer = k.root.layer({ steps: [0, 1] });
      function by() { var l = LIM[k.step() === 1 ? 1 : 0]; return k.scale(l[0], l[1], PLOT.y + PLOT.h, PLOT.y); }
      function bx(j) { return PLOT.x + (j + 0.5) * PLOT.w / 5; }
      function drawFrame() {
        frame.clear();
        var sy = by(), l = LIM[k.step() === 1 ? 1 : 0], ticks = [];
        for (var v = Math.ceil(l[0]); v <= l[1]; v++) ticks.push(v);
        frame.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, ylabel: k.step() === 1 ? 'weight, same ruler' : 'weight (cm per unit)',
          yticks: ticks.map(function (v) { return [sy(v), String(v)]; }) });
        frame.line(PLOT.x, sy(0), PLOT.x + PLOT.w, sy(0), { w: 0.9, op: 0.7, rough: 0.3 });
        NAMES.forEach(function (n, j) { frame.text(bx(j), PLOT.y + PLOT.h + 18, n, { kind: 'label', anchor: 'middle' }); });
      }
      function paintBars(w) {
        barLayer.clear();
        var sy = by(), z = sy(0);
        w.forEach(function (v, j) {
          var x0 = bx(j) - 20, x1 = bx(j) + 20, y = sy(v), top = Math.min(y, z), bot = Math.max(y, z);
          if (bot - top < 0.6) {           // exactly (or all but) zero: a short flat stroke on the zero line
            barLayer.path('M' + x0 + ' ' + z.toFixed(1) + ' H' + x1, { w: 1.6, op: 0.95 });
            barLayer.text(bx(j), z - 7, v === 0 ? '0' : v.toFixed(3), { kind: 'axis', anchor: 'middle' });
            return;
          }
          barLayer.path('M' + x0 + ' ' + top.toFixed(1) + ' H' + x1 + ' V' + bot.toFixed(1) + ' H' + x0 + ' Z', { w: 1.1, op: 0.9 });
          barLayer.path(hatchD(x0, top, x1, bot, 5), { w: 0.6, op: 0.45 });
          barLayer.text(bx(j), v >= 0 ? top - 6 : bot + 14, v.toFixed(2), { kind: 'axis', anchor: 'middle' });
        });
      }
      function current() { return k.step() === 1 ? RULED[bars.i1] : RAW[bars.kind][bars.i0]; }
      function showBars(ms) {
        var to = current().w, from = bars.now.slice();
        if (bars.cancel) bars.cancel();
        bars.cancel = k.animate(ms, function (t) {
          bars.now = from.map(function (f, j) { return t >= 1 ? to[j] : f + (to[j] - f) * t; });
          paintBars(bars.now);
        });
      }

      /* the column beside the bars */
      var col = k.root.group({ steps: [0, 1], d: 250 });
      var ruleName = col.text(SIDE, 52, '', { kind: 'label' });
      col.text(SIDE, 176, 'miss, seen', { kind: 'label' });
      var vSeen = col.text(SIDE + 158, 176, '', { kind: 'val', anchor: 'end' });
      col.text(SIDE, 196, 'miss, fresh', { kind: 'label' });
      var vFresh = col.text(SIDE + 158, 196, '', { kind: 'val', anchor: 'end' });
      col.text(SIDE, 216, 'weights at zero', { kind: 'label' });
      var vZero = col.text(SIDE + 158, 216, '', { kind: 'val', anchor: 'end', accent: true });
      var billName = col.text(SIDE, 236, '', { kind: 'label' });
      var vBill = col.text(SIDE + 158, 236, '', { kind: 'val', anchor: 'end' });
      col.line(SIDE, 248, SIDE + 158, 248, { w: 0.6, op: 0.45, rough: 0.3 });

      var g0 = k.root.group({ steps: [0], d: 600 });
      g0.callout('a', 'slide the price', SIDE, 282);
      var hand1 = g0.text(SIDE, 320, '', { kind: 'hand' });
      var hand2 = g0.text(SIDE, 342, '', { kind: 'hand' });

      function readout() {
        var r = current(), step1 = k.step() === 1;
        ruleName.set(step1 ? 'sizes, same ruler' : 'paying by ' + bars.kind);
        vSeen.set(r.seen.toFixed(1)); vFresh.set(r.fresh.toFixed(1));
        vZero.set(r.zeros + ' of 5');
        var sq = !step1 && bars.kind === 'squares';
        billName.set(sq ? 'total of squares' : 'total size');
        vBill.set((sq ? r.squares : r.size).toFixed(2));
        hand1.set(bars.kind === 'sizes' ? 'the chance ones hit' : 'every bar shrinks,');
        hand2.set(bars.kind === 'sizes' ? 'zero, and stay there' : 'none reaches zero');
      }

      var toggle = k.button(SIDE, 80, 'switch to squares', function () {
        bars.kind = bars.kind === 'sizes' ? 'squares' : 'sizes';
        toggle.set('switch to ' + (bars.kind === 'sizes' ? 'squares' : 'sizes'));
        readout(); showBars(380);
      }, { steps: [0] });
      var slider0 = k.slider({
        x: SIDE, y: 136, w: 158, min: 0, max: PRICES0.length - 1, step: 1, value: 0,
        label: 'price', steps: [0],
        format: function (i) { return String(PRICES0[i]); },
        onChange: function (i) { bars.i0 = i; readout(); showBars(200); }
      });

      /* step 1: choose the price on the fresh plants */
      var tried = {}, sweeping = false;
      var chart = k.root.layer({ steps: [1] });
      var C = { x0: SIDE + 8, x1: SIDE + 156, y0: 300, y1: 392, top: 200 };
      function cx(p) { return C.x0 + (C.x1 - C.x0) * p / 40; }
      function cy(v) { return C.y1 - (C.y1 - C.y0) * Math.min(v, C.top) / C.top; }
      function drawChart() {
        chart.clear();
        chart.line(C.x0, C.y1, C.x1, C.y1, { w: 0.8, rough: 0.3 });
        chart.line(C.x0, C.y1, C.x0, C.y0, { w: 0.8, rough: 0.3 });
        chart.text(C.x0 - 8, C.y0 - 10, 'fresh miss, by price', { kind: 'label' });
        chart.text(C.x0, C.y1 + 14, '0', { kind: 'axis', anchor: 'middle' });
        chart.text(C.x1, C.y1 + 14, '40', { kind: 'axis', anchor: 'middle' });
        var pts = [], best = -1;
        PRICES1.forEach(function (p, i) {
          if (!tried[i]) return;
          pts.push([cx(p), cy(RULED[i].fresh)]);
          if (best < 0 || RULED[i].fresh < RULED[best].fresh) best = i;
        });
        if (pts.length > 1) chart.polyline(pts, { w: 1.1, op: 0.85 });
        pts.forEach(function (p) { chart.dot(p[0], p[1], 1.8); });
        if (best >= 0) {
          var bxp = cx(PRICES1[best]), byp = cy(RULED[best].fresh);
          chart.path('M' + (bxp - 6) + ' ' + byp.toFixed(1) + ' a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0', { w: 1.6, accent: true, op: 0.95 });
          vBest.set(String(PRICES1[best]));
        } else vBest.set('–');
        chart.line(cx(PRICES1[bars.i1]), C.y0, cx(PRICES1[bars.i1]), C.y1, { w: 0.6, op: 0.5, rough: 0.2 });
      }
      var g1 = k.root.group({ steps: [1], d: 400 });
      g1.text(SIDE, 268, 'best price so far', { kind: 'label' });
      var vBest = g1.text(SIDE + 158, 268, '–', { kind: 'val', anchor: 'end' });
      var slider1 = k.slider({
        x: SIDE, y: 136, w: 158, min: 0, max: 40, step: 2, value: 0,
        label: 'price', steps: [1],
        onChange: function (v) { bars.i1 = v / 2; tried[bars.i1] = true; readout(); showBars(200); drawChart(); }
      });
      k.button(SIDE, 80, 'try every price', function () {
        if (sweeping) return;
        sweeping = true;
        var i = 0;
        (function next() {
          if (k.step() !== 1) { sweeping = false; return; }
          bars.i1 = i; tried[i] = true; slider1.set(PRICES1[i], true);
          readout(); showBars(k.reduced ? 0 : 140); drawChart();
          i++;
          if (i < PRICES1.length) setTimeout(next, k.reduced ? 0 : 180); else sweeping = false;
        })();
      }, { steps: [1] });

      /* ---------------- step 2: two weights, a diamond or a circle ---------------- */
      var f = makeFit(k.rng(54));
      var box = { x0: PLOT.x, y0: PLOT.y, x1: PLOT.x + PLOT.w, y1: PLOT.y + PLOT.h };
      function sx(a) { return OX + a * UNIT; }
      function sy(a) { return OY - a * UNIT; }
      var mode = 'lasso', T = T_START;
      function solve(m, t) { return m === 'lasso' ? solveLasso(f, t) : solveRidge(f, t); }
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
          if (run.length === 41) run = run.slice(0, 40).concat([run[0], run[1]]);
          if (run.length > 2) g.curve(run, o); else g.line(run[0][0], run[0][1], run[1][0], run[1][1], o);
        });
      }
      var geo = k.root.group({ steps: [2], d: 0 });
      var rings = geo.group({ d: 500, stagger: 140 });
      LEVELS.forEach(function (lv) { drawContour(rings, lv, { w: 0.6, op: 0.5, rough: 0.4 }); });
      var region = geo.layer();
      var ax = geo.group({ d: 0 });
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
      var bxx = sx(f.b1), byy = sy(f.b2);
      geo.group({ d: 200 }).mark(bxx, byy, 'x', { r: 4 });

      var C1 = SIDE + 118, C2 = SIDE + 158;
      var head = geo.group({ d: 300 });
      head.text(C1, 52, 'a₁', { kind: 'axis', anchor: 'end' });
      head.text(C2, 52, 'a₂', { kind: 'axis', anchor: 'end' });
      head.mark(SIDE + 4, 66.5, 'x', { r: 3.5 });
      head.text(SIDE + 14, 70, 'no price', { kind: 'label' });
      head.text(C1, 70, f.b1.toFixed(2), { kind: 'val', anchor: 'end' });
      head.text(C2, 70, f.b2.toFixed(2), { kind: 'val', anchor: 'end' });
      head.dot(SIDE + 4, 84.5, 3.2, { accent: true });
      var rowName = head.text(SIDE + 14, 88, 'sizes', { kind: 'label' });
      var v1 = head.text(C1, 88, '', { kind: 'val', anchor: 'end' });
      var v2 = head.text(C2, 88, '', { kind: 'val', anchor: 'end' });
      head.text(SIDE, 106, 'extra miss', { kind: 'label' });
      var vErr = head.text(C2, 106, '', { kind: 'val', anchor: 'end' });
      head.line(SIDE, 118, C2, 118, { w: 0.6, op: 0.45, rough: 0.3 });
      var rule = head.text(SIDE, 142, '', { kind: 'math' });
      var point = geo.layer();

      var PP = { x: SIDE + 20, y: 246, w: 122, h: 80 };
      var px = k.scale(0, T_MAX, PP.x, PP.x + PP.w), py = k.scale(0, 1.7, PP.y + PP.h, PP.y);
      var pathG = geo.group({ d: 500 });
      pathG.axes({ x: PP.x, y: PP.y, w: PP.w, h: PP.h, xlabel: 'T',
        xticks: [[px(0), '0'], [px(1), '1'], [px(2), '2']], yticks: [[py(0), '0'], [py(1), '1']] });
      var paths = geo.layer();
      var hand3 = pathG.text(SIDE, 386, '', { kind: 'hand', d: 900 });
      var hand4 = pathG.text(SIDE, 408, '', { kind: 'hand', d: 1300 });
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
      function redraw2() {
        var s = solve(mode, T), X = sx(s.a1), Y = sy(s.a2), lv = extra(f, s.a1, s.a2);
        region.clear(); point.clear(); paths.clear();
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
        rowName.set(mode === 'lasso' ? 'sizes' : 'squares');
        v1.set(fmt(s.a1)); v2.set(fmt(s.a2));
        vErr.set('+' + Math.round(lv / f.mse * 100) + '%');
        rule.set((mode === 'lasso' ? '|a₁| + |a₂| ≤ ' : 'a₁² + a₂² ≤ ') + T.toFixed(2));
        [1, 2].forEach(function (c) {
          paths.polyline(track[mode].map(function (p) { return [px(p[0]), py(p[c])]; }), { w: 1.1, op: 0.85 });
          paths.text(PP.x + PP.w + 5, py(track[mode][200][c]) + 3.5, c === 1 ? 'a₁' : 'a₂', { kind: 'axis' });
        });
        paths.line(px(T), PP.y, px(T), PP.y + PP.h, { w: 0.6, op: 0.5, rough: 0.2 });
        paths.dot(px(T), py(s.a1), 2.4);
        paths.dot(px(T), py(s.a2), 2.4);
        hand3.set(mode === 'lasso' ? 'a₂ is exactly 0' : 'both shrink,');
        hand4.set(mode === 'lasso' ? 'until T passes ' + tZero.toFixed(2) : 'neither reaches zero');
      }
      var toggle2 = k.button(SIDE, 170, 'switch to squares', function () {
        mode = mode === 'lasso' ? 'ridge' : 'lasso';
        toggle2.set('switch to ' + (mode === 'lasso' ? 'squares' : 'sizes'));
        redraw2();
      }, { steps: [2] });
      var slider2 = k.slider({
        x: SIDE, y: 214, w: 158, min: T_MIN, max: T_MAX, step: 0.05, value: T_START,
        label: 'budget T', steps: [2],
        format: function (v) { return v.toFixed(2); },
        onChange: function (v) { T = v; redraw2(); }
      });

      k.onStep(function (step) {
        if (bars.cancel) bars.cancel();
        sweeping = false;
        if (step < 2) {
          drawFrame();
          if (step === 1) { tried = {}; bars.i1 = 0; tried[0] = true; slider1.set(0, true); drawChart(); }
          readout();
          bars.now = [0, 0, 0, 0, 0];
          showBars(k.reduced ? 0 : 500);
        } else {
          mode = 'lasso'; T = T_START; slider2.set(T_START, true); toggle2.set('switch to squares');
          redraw2();
        }
      });
    }
  });
})();
