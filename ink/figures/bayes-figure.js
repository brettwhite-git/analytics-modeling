/* Belief figure — what you think about a coin, updated one flip at a time, worked for real.
   You start with some imagined flips, half heads and half tails ("how sure you are to begin with").
   Each real flip adds to the counts, and the belief is all the heads over all the flips. The curve is
   how strongly each heads-rate is believed: a beta curve with (imagined + real heads, imagined + real tails),
   whose middle is exactly that count. Every curve, count and readout comes from the same numbers.
   The reader flips one at a time or five at a time, and slides how sure they were to begin with.
   The 40 flips are seeded made-up flips of a coin that lands heads 7 times in 10 in the long run.
   One step. Offers `flips`, `start_heads`, `start_tails` to the page's Python. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };
  var SIDE = 462, COL = 158;
  var SURE_START = 10, SURE_MIN = 2, SURE_MAX = 100;
  var N_MAX = 40, GRID = 200;

  // the flips are made once, so the page's Python works on exactly the same ones (1 = heads, 0 = tails)
  var FLIPS = (function () {
    var r = window.InkKit.rng(171), out = [];
    for (var i = 0; i < N_MAX; i++) out.push(r() < 0.7 ? 1 : 0);
    return out;
  })();
  var state = { sure: SURE_START };

  /* what `from page import flips, start_heads, start_tails` gives the Python on the same page */
  window.InkPage = window.InkPage || {};
  window.InkPage.flips = function () { return FLIPS; };
  window.InkPage.start_heads = function () { return state.sure / 2; };
  window.InkPage.start_tails = function () { return state.sure / 2; };

  function lgamma(z) {                               // Lanczos approximation
    var c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
    var x = z, y = z, t = z + 5.5, s = 1.000000000190015;
    t -= (z + 0.5) * Math.log(t);
    for (var j = 0; j < 6; j++) s += c[j] / ++y;
    return -t + Math.log(2.5066282746310005 * s / x);
  }
  function density(x, a, b) {
    if (x <= 0 || x >= 1) return (a === 1 && b === 1) ? 1 : 0;
    return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) + lgamma(a + b) - lgamma(a) - lgamma(b));
  }
  function curveOf(a, b) {
    var pts = [], peak = 0, at = 0;
    for (var i = 0; i <= GRID; i++) { var x = i / GRID, d = density(x, a, b); pts.push([x, d]); if (d > peak) { peak = d; at = x; } }
    return { pts: pts, peak: peak, mode: at };
  }
  function peakOf(a, b) { return a > 1 && b > 1 ? density((a - 1) / (a + b - 2), a, b) : 1; }

  window.InkKit.define('bayes-figure', {
    label: 'Updating a belief about a coin: imagined flips to begin with, then real flips, one at a time',
    steps: 1,
    seed: 23,
    draw: function (k) {
      var base = PLOT.y + PLOT.h;
      var sx = k.scale(0, 1, PLOT.x, PLOT.x + PLOT.w);

      // one vertical scale for every state the reader can reach, so narrowing also reads as growing taller
      var top = 0, h = 0;
      for (var n0 = 0; n0 <= N_MAX; n0++) {
        top = Math.max(top, peakOf(SURE_MAX / 2 + h, SURE_MAX / 2 + n0 - h));
        if (n0 < N_MAX) h += FLIPS[n0];
      }
      var sy = k.scale(0, top * 1.08, base, PLOT.y);

      k.root.axes({
        x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'how often it lands heads', ylabel: 'how strongly you believe it',
        xticks: [0, 0.25, 0.5, 0.75, 1].map(function (v) { return [sx(v), v === 0 ? '0' : v === 1 ? '1' : String(v)]; })
      });

      var live = k.root.layer();
      var strip = k.root.layer();

      /* ---- the column beside the plot ---- */
      var rows = k.root.group({ d: 300 });
      rows.text(SIDE, 56, 'imagined  h · t', { kind: 'label' });
      var vImag = rows.text(SIDE + COL, 56, '', { kind: 'val', anchor: 'end' });
      rows.text(SIDE, 76, 'real  h · t', { kind: 'label' });
      var vReal = rows.text(SIDE + COL, 76, '', { kind: 'val', anchor: 'end' });
      rows.line(SIDE, 88, SIDE + COL, 88, { w: 0.6, op: 0.45, rough: 0.3 });
      rows.mark(SIDE + 5, 104.5, 'tri', { r: 3.8 });
      rows.text(SIDE + 16, 108, 'belief', { kind: 'label' });
      var vBelief = rows.text(SIDE + COL, 108, '', { kind: 'val', anchor: 'end' });
      var vSum = rows.text(SIDE + COL, 128, '', { kind: 'axis', anchor: 'end' });
      rows.mark(SIDE + 5, 148, 'x', { r: 3.2 });
      rows.text(SIDE + 16, 152, 'real only', { kind: 'label' });
      var vRate = rows.text(SIDE + COL, 152, '', { kind: 'val', anchor: 'end' });
      rows.text(SIDE, 184, 'the flips', { kind: 'label' });
      var vCount = rows.text(SIDE + COL, 184, '', { kind: 'val', anchor: 'end' });

      /* ---- state ---- */
      var n = 0, busy = false;
      var shown = null;                                 // { a, b } of the curve currently drawn
      function counts(m) { var hh = 0; for (var j = 0; j < m; j++) hh += FLIPS[j]; return { h: hh, t: m - hh }; }
      function target() { var c = counts(n); return { a: state.sure / 2 + c.h, b: state.sure / 2 + c.t }; }
      function yAt(c, x) { return sy(c.pts[Math.round(k.clamp(x, 0, 1) * GRID)][1]); }
      function px(c) { return c.pts.map(function (p) { return [sx(p[0]), sy(p[1])]; }); }

      function drawCurves(a, b) {
        live.clear();
        var s0 = state.sure / 2, start = curveOf(s0, s0), now = curveOf(a, b), nowPx = px(now);
        live.hatch(nowPx.concat([[sx(1), base], [sx(0), base]]), { op: 0.2, gap: 6 });
        var m = a / (a + b);
        live.line(sx(m), yAt(now, m), sx(m), base, { w: 0.6, op: 0.5, rough: 0.2 });
        if (n > 0) live.polyline(px(start), { w: 0.9, op: 0.5 });
        live.polyline(nowPx, { w: 1.7, op: 0.95, accent: true });
        live.mark(sx(m), base, 'tri', { r: 4.4 });
        if (n > 0) { var c = counts(n); live.mark(sx(c.h / n), base, 'x', { r: 3.8 }); }
        // name the curves where there is clear paper
        var nx = sx(now.mode), ny = sy(now.peak) - 10;
        live.text(k.clamp(nx, PLOT.x + 30, PLOT.x + PLOT.w - 30), ny, n > 0 ? 'now' : 'to begin with', { kind: 'label', anchor: 'middle' });
        if (n > 0) {
          // the starting curve's name: above its peak, or out on a flank, wherever the new curve leaves paper
          var spots = [[sx(start.mode), sy(start.peak) - 10, 'middle']];
          [0.62, 0.38].forEach(function (f) {
            var lo = start.pts.filter(function (p) { return p[0] < start.mode && p[1] >= start.peak * f; })[0];
            var hi = start.pts.filter(function (p) { return p[0] > start.mode && p[1] >= start.peak * f; }).pop();
            if (lo) spots.push([sx(lo[0]) - 8, sy(lo[1]) + 3, 'end']);
            if (hi) spots.push([sx(hi[0]) + 8, sy(hi[1]) + 3, 'start']);
          });
          spots.push([sx(0.98), sy(start.pts[Math.round(0.98 * GRID)][1]) - 8, 'end']);   // a flat start has no flanks
          for (var i = 0; i < spots.length; i++) {
            var sp = spots[i], w = 96, x0 = sp[2] === 'end' ? sp[0] - w : sp[2] === 'middle' ? sp[0] - w / 2 : sp[0];
            if (x0 < PLOT.x + 4 || x0 + w > PLOT.x + PLOT.w - 4) continue;
            var clear = true;
            for (var x = x0; x <= x0 + w; x += 4) {
              var yy = yAt(now, (x - PLOT.x) / PLOT.w);
              if (yy > sp[1] - 16 && yy < sp[1] + 6) { clear = false; break; }
            }
            if (Math.abs(nx - sp[0]) < 60 && Math.abs(ny - sp[1]) < 18) clear = false;
            if (clear) { live.text(sp[0], sp[1], 'to begin with', { kind: 'label', anchor: sp[2] }); break; }
          }
        }
      }

      function drawSide() {
        var c = counts(n), s0 = state.sure / 2;
        vImag.set(s0 + ' · ' + s0);
        vReal.set(c.h + ' · ' + c.t);
        vBelief.set(((s0 + c.h) / (state.sure + n)).toFixed(2));
        vSum.set('(' + s0 + ' + ' + c.h + ') / (' + state.sure + ' + ' + n + ')');
        vRate.set(n ? (c.h / n).toFixed(2) : '–');
        vCount.set(n + ' of ' + N_MAX);
        strip.clear();
        for (var j = 0; j < n; j++) {
          strip.text(SIDE + 4 + (j % 10) * 15.6, 208 + Math.floor(j / 10) * 19, FLIPS[j] ? 'H' : 'T',
            { kind: 'code', anchor: 'middle' });
        }
      }

      function show() {
        var t = target();
        shown = t; drawSide(); drawCurves(t.a, t.b);
      }
      function flip(times, done) {
        if (times <= 0 || n >= N_MAX) { busy = false; label(); if (done) done(); return; }
        busy = true;
        var from = shown || target();
        n++;
        var to = target();
        drawSide();
        k.animate(times > 1 ? 260 : 460, function (t) {
          var a = from.a + (to.a - from.a) * t, b = from.b + (to.b - from.b) * t;
          drawCurves(a, b);
          if (t >= 1) { shown = to; setTimeout(function () { flip(times - 1, done); }, times > 1 ? 60 : 0); }
        });
      }

      /* ---- the controls ---- */
      k.slider({
        x: SIDE, y: 310, w: COL, min: SURE_MIN, max: SURE_MAX, step: 2, value: SURE_START,
        label: 'imagined flips',
        format: function (v) { return String(v); },
        onChange: function (v) { state.sure = v; if (!busy) show(); }
      });
      var ends = k.root.group({ d: 500 });
      ends.text(SIDE, 329, 'not sure', { kind: 'axis' });
      ends.text(SIDE + COL, 329, 'very sure', { kind: 'axis', anchor: 'end' });
      var bOne = k.button(SIDE, 360, 'flip once', function () { if (!busy) flip(1); }, { d: 600 });
      var bFive = k.button(SIDE + COL, 360, 'flip 5', function () { if (!busy) flip(5); }, { d: 650, anchor: 'end' });
      k.button(SIDE, 390, 'start over', function () { if (busy) return; n = 0; label(); show(); }, { d: 700 });
      function label() {
        bOne.node.style.display = bFive.node.style.display = n >= N_MAX ? 'none' : '';
      }
      k.root.group({ d: 800 }).callout('a', 'it moves, and narrows', SIDE, 430);

      k.onStep(function () { busy = false; label(); show(); });
    }
  });
})();
