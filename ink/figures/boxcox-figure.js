/* Stretch figure — pulling in a long tail, done by hand before it is named.
   Sixty made-up waiting times (minutes) are piled into a histogram. The reader slides the strength of a
   stretch from none, through the square root, to the logarithm and past it, or presses a button that eases
   the stretch to the log. Every frame re-bins the stretched values and redraws the pile with clean strokes
   (hand-hatched by arithmetic, so nothing boils while it moves). The axis keeps its ticks in minutes, placed
   where the stretch puts them, so the reader sees 10, 20, 50 squeeze together.
   Under the hood the stretch is the Box-Cox power: lambda = 1 - strength, (y^lambda - 1) / lambda, log at 0.
   Readouts are computed from the same values: the share of times below the average, and a lopsidedness
   number (skewness). Offers the times to the page's Python as `waits`. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };
  var SIDE = 462, COLW = 158;
  var BINS = 12, N = 60;
  var X0 = PLOT.x + 10, X1 = PLOT.x + PLOT.w - 10, BASE = PLOT.y + PLOT.h, TOP = PLOT.y + 30;
  var SMAX = 1.5, TICKS = [2, 5, 10, 20, 50];

  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  var WAITS = (function () {
    var r = rng(17), w = [];
    for (var i = 0; i < N; i++) {
      var z = (r() + r() + r() + r() - 2) * Math.sqrt(3);              // roughly normal
      w.push(Math.round(Math.exp(2.1 + 0.75 * z) * 10) / 10);           // minutes, one decimal, long right tail
    }
    return w;
  })();

  /* what `from page import waits` gives the Python on the same page (see ink/py.js) */
  window.InkPage = window.InkPage || {};
  window.InkPage.waits = function () { return WAITS.slice(); };

  function stretch(y, s) { var lam = 1 - s; return Math.abs(lam) < 1e-9 ? Math.log(y) : (Math.pow(y, lam) - 1) / lam; }
  function stats(v) {
    var n = v.length, m = 0, m2 = 0, m3 = 0, lo = Infinity, hi = -Infinity;
    v.forEach(function (x) { m += x; lo = Math.min(lo, x); hi = Math.max(hi, x); });
    m /= n;
    v.forEach(function (x) { var d = x - m; m2 += d * d; m3 += d * d * d; });
    m2 /= n; m3 /= n;
    return { mean: m, skew: m3 / Math.pow(m2, 1.5), lo: lo, hi: hi, below: v.filter(function (x) { return x < m; }).length };
  }
  function nameOf(s) {
    if (s < 0.025) return 'none';
    if (Math.abs(s - 0.5) < 0.025) return 'square root';
    if (Math.abs(s - 1) < 0.025) return 'logarithm';
    return s > 1 ? 'past the log' : s < 0.5 ? 'gentle' : 'strong';
  }
  function num(v) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(2); }

  /* hairline hatching inside a rectangle, worked out by arithmetic so it is the same every frame */
  function hatchRect(xa, xb, ya, yb, gap) {
    var c = Math.cos(40 * Math.PI / 180), s = Math.sin(40 * Math.PI / 180), d = '';
    // lines x*s + y*c = k, clipped to the box
    var ks = [xa * s + ya * c, xb * s + ya * c, xa * s + yb * c, xb * s + yb * c];
    var k0 = Math.ceil(Math.min.apply(null, ks) / gap) * gap, k1 = Math.max.apply(null, ks);
    for (var k = k0; k <= k1; k += gap) {
      var hits = [];
      [[xa, null], [xb, null], [null, ya], [null, yb]].forEach(function (e) {
        if (e[0] != null) { var y = (k - e[0] * s) / c; if (y >= ya - 1e-6 && y <= yb + 1e-6) hits.push([e[0], y]); }
        else { var x = (k - e[1] * c) / s; if (x >= xa - 1e-6 && x <= xb + 1e-6) hits.push([x, e[1]]); }
      });
      if (hits.length >= 2) d += 'M' + hits[0][0].toFixed(1) + ' ' + hits[0][1].toFixed(1) + ' L' + hits[1][0].toFixed(1) + ' ' + hits[1][1].toFixed(1) + ' ';
    }
    return d;
  }

  window.InkKit.define('boxcox-figure', {
    label: 'Stretching a lopsided measurement: a histogram of waiting times, redrawn as the stretch grows',
    steps: 1,
    seed: 31,
    draw: function (k) {
      var strength = 0, busy = false;

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, ylabel: 'how many' });
      k.root.text(PLOT.x + PLOT.w, BASE + 32, 'waiting time, minutes', { kind: 'label', anchor: 'end' });

      var pile = k.root.layer(), focus = k.root.layer();

      var side = k.root.group({ d: 300 });
      side.text(SIDE, 60, 'stretch', { kind: 'label' });
      var vName = side.text(SIDE + COLW, 60, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 80, 'below average', { kind: 'label' });
      var vBelow = side.text(SIDE + COLW, 80, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 100, 'lopsidedness', { kind: 'label' });
      var vSkew = side.text(SIDE + COLW, 100, '', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 112, SIDE + COLW, 112, { w: 0.6, op: 0.45, rough: 0.3 });

      function redraw() {
        var v = WAITS.map(function (y) { return stretch(y, strength); }), st = stats(v);
        var bw = (st.hi - st.lo) / BINS, counts = [], i, cmax = 0;
        for (i = 0; i < BINS; i++) counts.push(0);
        v.forEach(function (x) { counts[Math.min(BINS - 1, Math.floor((x - st.lo) / bw))]++; });
        counts.forEach(function (c) { cmax = Math.max(cmax, c); });
        var hx = k.scale(st.lo, st.hi, X0, X1), hy = k.scale(0, 30, BASE, TOP);

        pile.clear(); focus.clear();
        var outline = 'M' + X0 + ' ' + BASE, hatch = '';
        for (i = 0; i < BINS; i++) {
          var xa = hx(st.lo + i * bw), xb = hx(st.lo + (i + 1) * bw), yc = hy(counts[i]);
          outline += ' L' + xa.toFixed(1) + ' ' + yc.toFixed(1) + ' L' + xb.toFixed(1) + ' ' + yc.toFixed(1);
          if (counts[i]) {
            hatch += hatchRect(xa, xb, yc, BASE, 5);
            if (i < BINS - 1 && counts[i + 1]) outline += ' M' + xb.toFixed(1) + ' ' + BASE + ' L' + xb.toFixed(1) + ' ' + hy(Math.min(counts[i], counts[i + 1])).toFixed(1) + ' M' + xb.toFixed(1) + ' ' + yc.toFixed(1);
          }
        }
        outline += ' L' + X1 + ' ' + BASE;
        if (hatch) pile.path(hatch, { w: 0.6, op: 0.4 });
        pile.path(outline, { w: 1.1, op: 0.85 });

        // ticks in minutes, wherever the stretch puts them
        var ticks = '';
        TICKS.forEach(function (m) {
          var t = stretch(m, strength);
          if (t < st.lo - 1e-9 || t > st.hi + 1e-9) return;
          var x = hx(t);
          ticks += 'M' + x.toFixed(1) + ' ' + BASE + ' v5 ';
          pile.text(x, BASE + 17, String(m), { kind: 'axis', anchor: 'middle' });
        });
        if (ticks) pile.path(ticks, { w: 0.8, op: 0.7 });
        [10, 20, 30].forEach(function (c) {
          pile.path('M' + (PLOT.x - 4) + ' ' + hy(c).toFixed(1) + ' h4', { w: 0.6, op: 0.6 });
          pile.text(PLOT.x - 8, hy(c) + 3.5, String(c), { kind: 'axis', anchor: 'end' });
        });

        // the average: the one accent
        var ax = hx(st.mean);
        focus.path('M' + ax.toFixed(1) + ' ' + (BASE - 2) + ' L' + ax.toFixed(1) + ' ' + (TOP - 14), { w: 1.6, op: 0.95, accent: true });
        focus.text(ax + 5, TOP - 8, 'average', { kind: 'axis' });

        vName.set(nameOf(strength));
        vBelow.set(st.below + ' of ' + N);
        vSkew.set(num(st.skew));
      }

      var slider = k.slider({
        x: SIDE, y: 152, w: COLW, min: 0, max: SMAX, step: 0.05, value: 0,
        label: 'strength',
        format: function (v) { return v.toFixed(2); },
        onChange: function (v) { if (!busy) { strength = v; redraw(); } }
      });
      k.root.text(SIDE, 172, 'none', { kind: 'axis', d: 500 });
      k.root.text(SIDE + COLW / SMAX, 172, 'log', { kind: 'axis', anchor: 'middle', d: 500 });

      k.button(SIDE, 210, 'take the logarithm', function () {
        if (busy) return;
        var from = strength;
        busy = true;
        k.animate(1400, function (t) {
          strength = Math.round((from + (1 - from) * t) * 100) / 100;
          slider.set(Math.round(strength * 20) / 20, true);
          redraw();
          if (t >= 1) { busy = false; strength = 1; slider.set(1, true); redraw(); }
        });
      });
      k.button(SIDE, 244, 'back to the minutes', function () {
        if (busy) return;
        strength = 0; slider.set(0, true); redraw();
      });
      k.root.callout('a', 'watch the tail come in', SIDE, 290, { d: 900 });
      var hand = k.root.group({ d: 1200 });
      hand.text(SIDE, 340, 'balanced: about half', { kind: 'hand' });
      hand.text(SIDE, 362, 'on each side.', { kind: 'hand' });

      k.onStep(function () { strength = 0; slider.set(0, true); redraw(); });
    }
  });
})();
