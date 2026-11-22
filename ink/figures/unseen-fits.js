/* Unseen fits — two models of the same ten days, judged first on those days, then on new ones.
   Steps: 0 a gentle curve and a wiggly one that passes through every point. The reader measures each one's
            miss on its own ten points (threads grow from each point to the curve, the tally adds up).
          1 the reader brings in new days from the same source, five at a time, and both misses are re-scored.
   Everything is computed: least-squares polynomials (Chebyshev basis, Householder QR), degree 2 and degree 9
   (ten points, so degree 9 goes through all of them). The miss is the average squared miss.
   Made-up data: jugs sold = 2 + 0.9 x - 0.05 x^2 + noise, x = hours of sun. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 }, SIDE = 462, SIDE_W = 158;
  var YMAX = 9, NOISE = 0.8, N = 10, GENTLE = 2, WIGGLY = 9, BATCH = 5, FRESH = 30;

  function r2(v) { return Math.round(v * 100) / 100; }
  function truth(x) { return 2 + 0.9 * x - 0.05 * x * x; }
  function gauss(r) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }
  function sample(r, n) {
    var out = [];
    for (var i = 0; i < n; i++) { var x = 0.3 + 9.4 * r(); out.push({ x: r2(x), y: r2(truth(x) + NOISE * gauss(r)) }); }
    return out;
  }
  function days(r) {                                   // ten days, spread across the hours of sun
    var out = [];
    for (var i = 0; i < N; i++) { var x = 0.6 + i * 0.98 + (r() - 0.5) * 0.5; out.push({ x: r2(x), y: r2(truth(x) + NOISE * gauss(r)) }); }
    return out;
  }

  /* Chebyshev polynomials of (x - 5) / 5, so a degree-9 fit stays well conditioned */
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
  function miss(c, pts) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) { var e = pts[i].y - predict(c, pts[i].x); s += e * e; }
    return s / pts.length;
  }

  window.InkKit.define('unseen-fits', {
    label: 'Ten days fitted by a gentle curve and by a wiggly curve through every point, scored on those days and then on new days',
    steps: 2,
    seed: 23,
    draw: function (k) {
      var sx = k.scale(0, 10, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(0, YMAX, PLOT.y + PLOT.h, PLOT.y);
      var pts = days(k.rng(3)), fresh = sample(k.rng(503), FRESH);
      var gentle = polyfit(pts, GENTLE), wiggly = polyfit(pts, WIGGLY);
      var shown = 0, measured = [false, false], busy = false, which = 1;
      function f2(v) { return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2); }
      function clipY(y) { return Math.max(PLOT.y, Math.min(PLOT.y + PLOT.h, y)); }

      /* the fitted curve as a path, lifted off the paper wherever it leaves the plot */
      function curveD(c) {
        var d = '', pen = false, top = PLOT.y + 1, bot = PLOT.y + PLOT.h - 1, px = 0, py = 0;
        for (var i = 0; i <= 400; i++) {
          var xv = 0.1 + 9.8 * i / 400, x = sx(xv), y = sy(predict(c, xv)), inside = y >= top && y <= bot;
          if (i && inside !== pen) {
            var edge = (inside ? py : y) < top ? top : bot, t = (edge - py) / (y - py);
            d += (inside ? ' M' : ' L') + (px + t * (x - px)).toFixed(1) + ' ' + edge.toFixed(1);
          }
          if (inside) d += (pen ? ' L' : ' M') + x.toFixed(1) + ' ' + y.toFixed(1);
          pen = inside; px = x; py = y;
        }
        return d.trim();
      }
      function inkPath(g, d, o) {                        // a stepped clean path needs an 'ik-ink' wrapper to draw in
        var wrap = g.group();
        wrap.node.setAttribute('class', 'ik-g ik-ink');
        wrap.node.style.opacity = 1;
        return wrap.path(d, o);
      }

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'hours of sun', ylabel: 'jugs sold',
        xticks: [0, 2, 4, 6, 8, 10].map(function (v) { return [sx(v), String(v)]; }),
        yticks: [0, 2, 4, 6, 8].map(function (v) { return [sy(v), String(v)]; }) });

      /* ---- the two curves and the ten days: the same in both steps ---- */
      var curves = k.root.group({ d: 200 });
      var curveNodes = [inkPath(curves, curveD(gentle), { w: 1.1, op: 0.75, d: 500, dur: 900 }),
        inkPath(curves, curveD(wiggly), { w: 1.6, op: 0.95, d: 900, dur: 1400 })];
      var threads = k.root.layer();
      var marks = k.root.group({ d: 100, stagger: 30 });
      pts.forEach(function (p) { marks.mark(sx(p.x), sy(p.y), 'o', { r: 3.8 }); });
      var freshMarks = k.root.group({ d: 0, stagger: 0 });
      var freshNodes = fresh.map(function (p) {
        var n = freshMarks.mark(sx(p.x), sy(p.y), 'x', { r: 3.6, dur: 200 });
        n.style.display = 'none';
        return n;
      });

      /* ---- the column: a small table of misses ---- */
      var side = k.root.group({ d: 300 });
      side.text(SIDE, 44, 'average squared miss', { kind: 'label' });
      side.text(SIDE + 112, 66, 'own 10', { kind: 'axis', anchor: 'end' });
      var newHead = side.text(SIDE + SIDE_W, 66, 'new', { kind: 'axis', anchor: 'end' });
      side.line(SIDE, 92 - 3.5, SIDE + 18, 92 - 3.5, { w: 1.1, op: 0.75, rough: 0.3 });
      side.text(SIDE + 24, 92, 'gentle', { kind: 'axis' });
      side.line(SIDE, 112 - 3.5, SIDE + 18, 112 - 3.5, { w: 1.6, op: 0.95, rough: 0.3 });
      side.text(SIDE + 24, 112, 'wiggly', { kind: 'axis' });
      var vOwn = [side.text(SIDE + 112, 92, '?', { kind: 'val', anchor: 'end' }), side.text(SIDE + 112, 112, '?', { kind: 'val', anchor: 'end' })];
      var vNew = [side.text(SIDE + SIDE_W, 92, '–', { kind: 'val', anchor: 'end' }), side.text(SIDE + SIDE_W, 112, '–', { kind: 'val', anchor: 'end' })];
      side.line(SIDE, 126, SIDE + SIDE_W, 126, { w: 0.6, op: 0.45, rough: 0.3 });

      function drawThreads(list, model, upTo) {
        threads.clear();
        var d = '';
        for (var i = 0; i < Math.min(upTo, list.length); i++) {
          var p = list[i], x = sx(p.x);
          d += 'M' + x.toFixed(1) + ' ' + clipY(sy(p.y)).toFixed(1) + ' L' + x.toFixed(1) + ' ' + clipY(sy(predict(model, p.x))).toFixed(1) + ' ';
        }
        if (d) threads.path(d, { w: 1.3, op: 0.9, accent: true });
      }
      function readout() {
        [gentle, wiggly].forEach(function (c, j) {
          vOwn[j].set(measured[j] || k.step() === 1 ? f2(miss(c, pts)) : '?');
          vNew[j].set(shown ? f2(miss(c, fresh.slice(0, shown))) : '–');
        });
        newHead.set(shown ? 'new ' + shown : 'new');
      }

      /* ---- step 0: measure each curve on the points it was fitted to ---- */
      function measure(j) {
        if (busy) return;
        var model = j ? wiggly : gentle;
        busy = true; measured[j] = false; readout();
        k.animate(1400, function (t) {
          var n = Math.ceil(t * N);
          drawThreads(pts, model, n);
          // the running average, over the points counted so far
          vOwn[j].set(n ? f2(miss(model, pts.slice(0, n))) : '…');
          if (t >= 1) { measured[j] = true; busy = false; readout(); hint0(j); }
        });
      }
      k.button(SIDE, 158, 'measure the gentle one', function () { measure(0); }, { steps: [0] });
      k.button(SIDE, 194, 'measure the wiggly one', function () { measure(1); }, { steps: [0] });
      var g0 = k.root.group({ steps: [0], d: 600 });
      g0.text(SIDE, 228, 'each thread is one miss.', { kind: 'axis' });
      g0.text(SIDE, 244, 'square it, then average.', { kind: 'axis' });
      var callA = k.root.group({ steps: [0], d: 0 });
      callA.callout('a', 'it hits every point', SIDE, 300);
      var hand0 = k.root.group({ steps: [0], d: 0 });
      hand0.text(SIDE, 336, 'zero miss.', { kind: 'hand' });
      hand0.text(SIDE, 360, 'trust it?', { kind: 'hand' });
      function hint0(j) {
        var show = measured[1] ? '' : 'none';
        callA.node.style.display = show; hand0.node.style.display = show;
      }

      /* ---- step 1: new days from the same stand ---- */
      function showFresh() { freshNodes.forEach(function (n, i) { n.style.display = i < shown ? '' : 'none'; }); }
      var bMore = k.button(SIDE, 158, 'bring 5 new days', function () {
        if (busy || shown >= FRESH) return;
        var from = shown;
        shown = Math.min(FRESH, shown + BATCH); showFresh(); readout();
        busy = true;
        k.animate(700, function (t) {
          drawThreads(fresh.slice(0, shown), which ? wiggly : gentle, from + Math.ceil(t * (shown - from)));
          if (t >= 1) { busy = false; label1(); }
        });
      }, { steps: [1] });
      var bWhich = k.button(SIDE, 194, 'show the gentle misses', function () {
        if (busy) return;
        which = 1 - which;
        drawThreads(fresh.slice(0, shown), which ? wiggly : gentle, shown); label1();
      }, { steps: [1] });
      var note1 = k.root.group({ steps: [1], d: 400 }).text(SIDE, 228, '', { kind: 'axis' });
      var callB = k.root.group({ steps: [1], d: 0 });
      callB.callout('b', 'perfect on the old days', SIDE, 300);
      callB.text(SIDE + 22, 318, 'is no promise', { kind: 'note', accent: true });
      callB.text(SIDE + 22, 336, 'about new ones', { kind: 'note', accent: true });
      function label1() {
        bMore.set(shown >= FRESH ? 'that is all 30' : 'bring 5 new days');
        bWhich.set(which ? 'show the gentle misses' : 'show the wiggly misses');
        note1.set(shown ? 'threads: the ' + (which ? 'wiggly' : 'gentle') + ' one' : 'new days, same stand');
        callB.node.style.display = shown >= 10 ? '' : 'none';
      }

      /* the curves themselves answer a click: step 0 measures that curve, step 1 shows its misses on the new days.
         A wide clear stroke along each curve is the target; the curve thickens under the pointer. */
      var curveHits = k.root.group({ d: 0 });
      [gentle, wiggly].forEach(function (c, j) {
        var hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hit.setAttribute('d', curveD(c));
        hit.setAttribute('fill', 'none'); hit.setAttribute('stroke', 'transparent'); hit.setAttribute('stroke-width', 18);
        hit.setAttribute('stroke-linecap', 'round');
        hit.style.pointerEvents = 'stroke'; hit.style.cursor = 'pointer';
        hit.setAttribute('role', 'button'); hit.setAttribute('tabindex', -1);
        hit.setAttribute('aria-label', 'the ' + (j ? 'wiggly' : 'gentle') + ' curve');
        var w0 = curveNodes[j].getAttribute('stroke-width');
        hit.addEventListener('pointerenter', function () { curveNodes[j].setAttribute('stroke-width', +w0 + 0.8); });
        hit.addEventListener('pointerleave', function () { curveNodes[j].setAttribute('stroke-width', w0); });
        hit.addEventListener('click', function () {
          if (k.step() === 0) { measure(j); return; }
          if (busy || which === j) return;
          which = j;
          drawThreads(fresh.slice(0, shown), which ? wiggly : gentle, shown); label1();
        });
        curveHits.node.appendChild(hit);
      });

      k.onStep(function (step) {
        busy = false;
        if (step === 0) {
          shown = 0; showFresh(); threads.clear(); measured = [false, false]; readout(); hint0();
        } else {
          shown = 0; which = 1; showFresh(); threads.clear(); readout(); label1();
        }
      });
    }
  });
})();
