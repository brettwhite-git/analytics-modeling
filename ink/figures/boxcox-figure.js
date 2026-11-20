/* Box-Cox figure — one power, lambda, bends a lopsided sample towards a bell shape, worked for real.
   A seeded right-skewed sample is transformed in the browser with T(y) = (y^lambda - 1) / lambda (log y at
   lambda = 0), re-binned and redrawn; the skewness readout and the bell curve laid over the bars are
   computed from the same transformed values.
   Steps: 0 the raw sample (lambda = 1): a long right tail · 1 the log (lambda = 0) · 2 slide lambda.
   Made-up sample. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };
  var SIDE = 462, COLW = 158;
  var BINS = 14, N = 160;
  var X0 = PLOT.x + 8, X1 = PLOT.x + PLOT.w - 8, BASE = PLOT.y + PLOT.h, TOP = PLOT.y + 22;
  var LMIN = -1, LMAX = 2;
  var CURVE = { top: 252, base: 330 };

  /* Kit gaps, worked around with what the kit gives us (the kit itself is not edited):
     a bare path()/polyline() is not un-drawn when its step group goes off, because the kit's CSS looks for a
     path inside an .ik-ink wrapper. Give it that wrapper. */
  function inkWrap(node) {
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', node.getAttribute('class'));
    g.style.cssText = node.style.cssText;
    node.removeAttribute('class'); node.removeAttribute('style');
    node.parentNode.replaceChild(g, node);
    g.appendChild(node);
    return g;
  }
  /* the slider knob sits on a paper disc that stays visible when the slider's step is off; hide it then */
  function knobPaper(slider, on) {
    var disc = slider.node.querySelector('.ik-knob .ik-paper');
    if (disc) disc.style.display = on ? '' : 'none';
  }

  function makeData(rand) {
    var ys = [];
    for (var i = 0; i < N; i++) {
      var z = (rand() + rand() + rand() + rand() - 2) * Math.sqrt(3);   // roughly normal, sd 1
      ys.push(Math.exp(1 + 0.6 * z));                                   // positive, long right tail
    }
    return ys;
  }

  function boxcox(y, lam) { return Math.abs(lam) < 1e-9 ? Math.log(y) : (Math.pow(y, lam) - 1) / lam; }

  function stats(v) {
    var n = v.length, m = 0, m2 = 0, m3 = 0, lo = Infinity, hi = -Infinity;
    v.forEach(function (x) { m += x; lo = Math.min(lo, x); hi = Math.max(hi, x); });
    m /= n;
    v.forEach(function (x) { var d = x - m; m2 += d * d; m3 += d * d * d; });
    m2 /= n; m3 /= n;
    return { mean: m, sd: Math.sqrt(m2), skew: m3 / Math.pow(m2, 1.5), lo: lo, hi: hi };
  }

  function nameOf(lam) {
    if (Math.abs(lam - 1) < 1e-6) return 'none';
    if (Math.abs(lam - 0.5) < 1e-6) return '√y';
    if (Math.abs(lam) < 1e-6) return 'log y';
    if (Math.abs(lam + 1) < 1e-6) return '1 / y';
    if (Math.abs(lam - 2) < 1e-6) return 'y²';
    return 'y^' + lam.toFixed(2);
  }
  function num(v) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(2); }
  function tick(v) { return (v < 0 ? '−' : '') + (Math.abs(v) >= 100 ? Math.abs(v).toFixed(0) : Math.abs(v).toFixed(1)); }

  window.InkKit.define('boxcox-figure', {
    label: 'A Box-Cox transformation: a histogram of a right-skewed sample, redrawn as the power lambda changes',
    steps: 3,
    seed: 31,
    draw: function (k) {
      var ys = makeData(k.rng(17));
      var lambda = 1;

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, ylabel: 'count' });
      k.root.text(PLOT.x + PLOT.w, BASE + 32, 'transformed value', { kind: 'label', anchor: 'end' });

      /* the histogram of the sample at one lambda, with the bell curve of the same mean and spread laid over it */
      function drawHist(g, lam) {
        var v = ys.map(function (y) { return boxcox(y, lam); }), s = stats(v);
        var bw = (s.hi - s.lo) / BINS, counts = [], i, cmax = 0;
        for (i = 0; i < BINS; i++) counts.push(0);
        v.forEach(function (x) { counts[Math.min(BINS - 1, Math.floor((x - s.lo) / bw))]++; });
        counts.forEach(function (c) { cmax = Math.max(cmax, c); });
        var peak = N * bw / (s.sd * Math.sqrt(2 * Math.PI));
        var hx = k.scale(s.lo, s.hi, X0, X1), hy = k.scale(0, Math.max(cmax, peak) * 1.04, BASE, TOP);

        var outline = [[X0, BASE]], dividers = '';
        for (i = 0; i < BINS; i++) {
          var xa = hx(s.lo + i * bw), xb = hx(s.lo + (i + 1) * bw), yc = hy(counts[i]);
          outline.push([xa, yc], [xb, yc]);
          if (i < BINS - 1) {
            var low = Math.min(counts[i], counts[i + 1]);
            if (low > 0) dividers += 'M' + xb.toFixed(1) + ' ' + BASE + ' V' + hy(low).toFixed(1) + ' ';
          }
        }
        outline.push([X1, BASE]);
        g.hatch(outline, { op: 0.34, gap: 5 });
        g.poly(outline, { w: 1.1, op: 0.85, rough: 0.5 });
        if (dividers) inkWrap(g.path(dividers, { w: 0.6, op: 0.5 }));

        var bell = [];
        for (i = 0; i <= 60; i++) {
          var x = s.lo + (s.hi - s.lo) * i / 60, zz = (x - s.mean) / s.sd;
          bell.push([hx(x), hy(peak * Math.exp(-0.5 * zz * zz))]);
        }
        inkWrap(g.polyline(bell, { w: 1.6, op: 0.95, accent: true }));

        [0, 0.5, 1].forEach(function (f) {
          var px = X0 + (X1 - X0) * f;
          g.line(px, BASE, px, BASE + 4, { w: 0.6, op: 0.6, rough: 0.2 });
          g.text(px, BASE + 16, tick(s.lo + (s.hi - s.lo) * f), { kind: 'axis', anchor: 'middle' });
        });
        g.line(PLOT.x - 4, hy(cmax), PLOT.x, hy(cmax), { w: 0.6, op: 0.6, rough: 0.2 });
        g.text(PLOT.x - 8, hy(cmax) + 3.5, String(cmax), { kind: 'axis', anchor: 'end' });
        return { stats: s, bell: bell };
      }

      /* ---- steps 0 and 1: the raw sample, then its log; drawn once ---- */
      var raw = drawHist(k.root.group({ steps: [0], d: 300, stagger: 60 }), 1);
      var logd = drawHist(k.root.group({ steps: [1], d: 300, stagger: 60 }), 0);

      /* ---- step 2: redrawn on every move of the slider ---- */
      var live = k.root.layer({ steps: [2] });

      var side = k.root.group({ d: 300 });
      side.text(SIDE, 60, 'skewness', { kind: 'label' });
      var skewVal = side.text(SIDE + COLW, 60, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 80, 'transform', { kind: 'label' });
      var nameVal = side.text(SIDE + COLW, 80, '', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 92, SIDE + COLW, 92, { w: 0.6, op: 0.45, rough: 0.3 });

      // a point part-way down the right-hand slope of each bell, for the callout to lead to
      function shoulder(bell) {
        var top = 0, i;
        for (i = 1; i < bell.length; i++) if (bell[i][1] < bell[top][1]) top = i;
        var want = bell[top][1] + (BASE - bell[top][1]) * 0.45;
        for (i = top; i < bell.length - 1 && bell[i][1] < want; i++) {}
        return bell[i];
      }
      var s0 = shoulder(raw.bell), s1 = shoulder(logd.bell);
      k.root.group({ steps: [0] }).callout('a', 'a bell curve does not fit', SIDE, 130, { to: [s0[0] + 4, s0[1] - 4], d: 1100 });
      k.root.group({ steps: [1] }).callout('b', 'after the log, it does', SIDE, 130, { to: [s1[0] + 4, s1[1] - 4], d: 1100 });

      /* ---- step 2: skewness at every lambda, computed ---- */
      var curve = k.root.group({ steps: [2], d: 500 });
      var skews = [], kmin = 0, kmax = 0, l;
      for (l = LMIN; l <= LMAX + 1e-9; l += 0.05) {
        var sk = stats(ys.map(function (y) { return boxcox(y, l); })).skew;
        skews.push([l, sk]); kmin = Math.min(kmin, sk); kmax = Math.max(kmax, sk);
      }
      var cx = k.scale(LMIN, LMAX, SIDE, SIDE + COLW), cy = k.scale(kmin, kmax, CURVE.base, CURVE.top);
      curve.text(SIDE, 236, 'skewness by lambda', { kind: 'label' });
      curve.line(SIDE, cy(0), SIDE + COLW, cy(0), { w: 0.6, op: 0.5, rough: 0.2 });
      inkWrap(curve.polyline(skews.map(function (p) { return [cx(p[0]), cy(p[1])]; }), { w: 1.1, op: 0.85 }));
      [-1, 0, 1, 2].forEach(function (t) {
        curve.text(cx(t), CURVE.base + 16, (t < 0 ? '−' : '') + Math.abs(t), { kind: 'axis', anchor: t === -1 ? 'start' : t === 2 ? 'end' : 'middle' });
      });
      curve.text(SIDE + COLW, cy(0) - 5, 'no skew', { kind: 'axis', anchor: 'end' });
      curve.callout('c', 'slide to zero skew', SIDE, 190, { d: 600 });
      curve.text(SIDE, 380, 'past zero the tail', { kind: 'hand', d: 900 });
      curve.text(SIDE, 402, 'flips to the left.', { kind: 'hand', d: 1300 });

      function readout(s) {
        skewVal.set(num(s.skew));
        nameVal.set(nameOf(lambda));
      }
      function redraw() {
        live.clear();
        var h = drawHist(live, lambda);
        live.line(cx(lambda), CURVE.base, cx(lambda), CURVE.top, { w: 0.6, op: 0.5, rough: 0.2 });
        live.dot(cx(lambda), cy(h.stats.skew), 3, { op: 0.9 });
        readout(h.stats);
      }

      var slider = k.slider({
        x: SIDE, y: 136, w: COLW, min: LMIN, max: LMAX, step: 0.05, value: 1,
        label: 'lambda', steps: [2],
        format: function (v) { return num(v); },
        onChange: function (v) { lambda = v; redraw(); }
      });

      k.onStep(function (step) {
        knobPaper(slider, step === 2);
        if (step === 0) { lambda = 1; readout(raw.stats); }
        else if (step === 1) { lambda = 0; readout(logd.stats); }
        else { lambda = 1; slider.set(1, true); redraw(); }
      });
    }
  });
})();
