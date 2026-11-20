/* Bayes figure — a belief about a success rate, updated by data, worked for real.
   The prior is a Beta(a, b) density with mean 0.30 and strength a + b ("worth that many outcomes").
   Outcomes are seeded Bernoulli draws (true rate 0.7); after s successes and f failures the posterior is
   Beta(a + s, b + f). Every curve, mean and tally is computed from those numbers, nothing is posed.
   Steps: 0 the prior alone · 1 after ten outcomes · 2 observe five more at a time, and slide the prior strength.
   Made-up outcomes. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };
  var SIDE = 462, COL = 158;
  var PRIOR_MEAN = 0.3, TRUE_RATE = 0.7;
  var STRENGTH_START = 10, STRENGTH_MIN = 4, STRENGTH_MAX = 30;
  var N_MAX = 40, N_STEP = 5, N_START = 10;
  var GRID = 160;

  function lgamma(z) {                               // Lanczos approximation
    var c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
    var x = z, y = z, t = z + 5.5, s = 1.000000000190015;
    t -= (z + 0.5) * Math.log(t);
    for (var j = 0; j < 6; j++) s += c[j] / ++y;
    return -t + Math.log(2.5066282746310005 * s / x);
  }
  function betaPdf(x, a, b) {
    if (x <= 0 || x >= 1) return 0;
    return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) + lgamma(a + b) - lgamma(a) - lgamma(b));
  }
  /* the density on a grid, its peak, and where it falls to `frac` of the peak on either side */
  function curveOf(a, b) {
    var pts = [], peak = 0, at = 0, i;
    for (i = 0; i <= GRID; i++) { var x = i / GRID, d = betaPdf(x, a, b); pts.push([x, d]); if (d > peak) { peak = d; at = i; } }
    function flank(dir, frac) {
      for (var j = at; j >= 0 && j <= GRID; j += dir) if (pts[j][1] < peak * frac) return pts[j][0];
      return dir < 0 ? 0 : 1;
    }
    return { pts: pts, peak: peak, mode: at / GRID, flank: flank };
  }

  window.InkKit.define('bayes-figure', {
    label: 'Bayesian updating: a prior belief about a success rate, and the posterior after observed outcomes',
    steps: 3,
    seed: 23,
    draw: function (k) {
      var base = PLOT.y + PLOT.h;
      var sx = k.scale(0, 1, PLOT.x, PLOT.x + PLOT.w);

      // the outcomes, fixed for every load
      var rand = k.rng(114), outcomes = [], i;
      for (i = 0; i < N_MAX; i++) outcomes.push(rand() < TRUE_RATE ? 1 : 0);

      // one vertical scale for every state the reader can reach, so narrowing reads as growing taller
      var top = 0;
      for (var st = STRENGTH_MIN; st <= STRENGTH_MAX; st += 2) {
        var s0 = 0;
        for (var n0 = 0; n0 <= N_MAX; n0++) {
          if (n0 % N_STEP === 0) top = Math.max(top, curveOf(PRIOR_MEAN * st + s0, (1 - PRIOR_MEAN) * st + n0 - s0).peak);
          if (n0 < N_MAX) s0 += outcomes[n0];
        }
      }
      var sy = k.scale(0, top * 1.06, base, PLOT.y);

      k.root.axes({
        x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'success rate', ylabel: 'how much you believe it',
        xticks: [0, 0.25, 0.5, 0.75, 1].map(function (v) { return [sx(v), v === 0 ? '0' : v === 1 ? '1' : String(v)]; })
      });

      var live = k.root.layer();
      var tally = k.root.layer({ steps: [1, 2] });

      /* ---- the column beside the plot ---- */
      var rowsA = k.root.group({ d: 300 });
      rowsA.mark(SIDE + 5, 52, 'o', { r: 3.6 });
      rowsA.text(SIDE + 16, 56, 'prior mean', { kind: 'label' });
      var priorVal = rowsA.text(SIDE + COL, 56, '', { kind: 'val', anchor: 'end' });
      var rowsB = k.root.group({ steps: [1, 2], d: 400 });
      rowsB.mark(SIDE + 5, 72, 'x', { r: 3.2 });
      rowsB.text(SIDE + 16, 76, 'observed rate', { kind: 'label' });
      var obsVal = rowsB.text(SIDE + COL, 76, '', { kind: 'val', anchor: 'end' });
      rowsB.mark(SIDE + 5, 92.5, 'tri', { r: 3.8 });
      rowsB.text(SIDE + 16, 96, 'posterior mean', { kind: 'label' });
      var postVal = rowsB.text(SIDE + COL, 96, '', { kind: 'val', anchor: 'end' });
      rowsB.line(SIDE, 108, SIDE + COL, 108, { w: 0.6, op: 0.45, rough: 0.3 });
      rowsB.text(SIDE, 128, 'successes', { kind: 'label' });
      var sVal = rowsB.text(SIDE + COL, 128, '', { kind: 'val', anchor: 'end' });
      rowsB.text(SIDE, 190, 'failures', { kind: 'label' });
      var fVal = rowsB.text(SIDE + COL, 190, '', { kind: 'val', anchor: 'end' });

      /* ---- state ---- */
      var strength = STRENGTH_START, n = N_START;       // the live values of step 2
      var shown = null;                                 // { a, b } of the posterior currently on the sheet
      function countOf(m) { var s = 0; for (var j = 0; j < m; j++) s += outcomes[j]; return s; }
      function view() {
        var step = k.step();
        var st = step === 2 ? strength : STRENGTH_START, m = step === 0 ? 0 : step === 1 ? N_START : n;
        var s = countOf(m);
        return { step: step, st: st, n: m, s: s, f: m - s, a0: PRIOR_MEAN * st, b0: (1 - PRIOR_MEAN) * st };
      }

      function toPx(c) { return c.pts.map(function (p) { return [sx(p[0]), sy(p[1])]; }); }
      function yAt(c, x) { return sy(c.pts[Math.round(k.clamp(x, 0, 1) * GRID)][1]); }

      /* five-bar-gate tally marks: four strokes and a slash, six gates to a row */
      function drawTally(x, y, count) {
        for (var j = 0; j < count; j++) {
          var gate = Math.floor(j / 5), gx = x + (gate % 6) * 26, gy = y + Math.floor(gate / 6) * 20, m = j % 5;
          if (m < 4) tally.line(gx + m * 4.5, gy, gx + m * 4.5 + 0.6, gy + 13, { w: 1, rough: 0.5, op: 0.85 });
          else tally.line(gx - 2.5, gy + 10.5, gx + 16.5, gy + 2.5, { w: 1, rough: 0.5, op: 0.85 });
        }
      }

      function drawCurves(v, a, b, settled) {
        live.clear();
        var prior = curveOf(v.a0, v.b0), priorPx = toPx(prior);
        var hasPost = v.step > 0 && v.n > 0;
        var post = hasPost ? curveOf(a, b) : null, postPx = post ? toPx(post) : null;

        if (post) live.hatch(postPx.concat([[sx(1), base], [sx(0), base]]), { op: 0.22, gap: 6 });

        // the means, dropped to the axis and marked there
        var m0 = v.a0 / (v.a0 + v.b0);
        live.line(sx(m0), yAt(prior, m0), sx(m0), base, { w: 0.6, op: 0.4, rough: 0.2 });
        if (post) {
          var m1 = a / (a + b);
          live.line(sx(m1), yAt(post, m1), sx(m1), base, { w: 0.6, op: 0.5, rough: 0.2 });
        }
        live.polyline(priorPx, post ? { w: 0.9, op: 0.55 } : { w: 1.6, op: 0.95, accent: true });
        if (post) live.polyline(postPx, { w: 1.7, op: 0.95, accent: true });

        live.mark(sx(m0), base, 'o', { r: 4.2 });
        if (v.step > 0 && v.n > 0) {
          var rate = v.s / v.n;
          live.mark(sx(rate), base, 'x', { r: 3.8 });
        }
        if (post) {
          live.mark(sx(a / (a + b)), base, 'tri', { r: 4.4 });
        }

        // name the curves where there is clear paper
        var px = sx(prior.mode), py = sy(prior.peak) - 9, blocked = false;
        if (post) {
          for (var x = px - 26; x <= px + 26; x += 4) {
            var yy = yAt(post, (x - PLOT.x) / PLOT.w);
            if (yy > py - 16 && yy < py + 8) blocked = true;
          }
          if (yAt(post, prior.mode) < py - 12) blocked = true;      // the posterior towers over the prior's peak
        }
        if (!blocked) live.text(px, py, 'prior', { kind: 'label', anchor: 'middle' });
        else {
          var lx = sx(prior.flank(-1, 0.5)) - 8;
          if (lx - 40 > PLOT.x + 6) live.text(lx, sy(prior.peak * 0.5) + 3, 'prior', { kind: 'label', anchor: 'end' });
        }
        if (post && settled) {
          var rx = sx(post.flank(1, 0.55)) + 9;
          if (rx + 72 < PLOT.x + PLOT.w) live.text(rx, sy(post.peak * 0.55) + 3, 'posterior', { kind: 'label' });
          else live.text(sx(post.flank(-1, 0.55)) - 9, sy(post.peak * 0.55) + 3, 'posterior', { kind: 'label', anchor: 'end' });
        }
      }

      function drawSide(v) {
        tally.clear();
        priorVal.set((v.a0 / (v.a0 + v.b0)).toFixed(2));
        if (v.step === 0) return;
        obsVal.set(v.n ? (v.s / v.n).toFixed(2) : '–');
        postVal.set(((v.a0 + v.s) / (v.st + v.n)).toFixed(2));
        sVal.set(String(v.s));
        fVal.set(String(v.f));
        drawTally(SIDE + 3, 137, v.s);
        drawTally(SIDE + 3, 199, v.f);
      }

      var cancel = null;
      function update(tween) {
        var v = view(), a1 = v.a0 + v.s, b1 = v.b0 + v.f;
        if (cancel) { cancel(); cancel = null; }
        drawSide(v);
        if (tween && shown && v.step > 0 && !k.reduced) {
          var from = { a: shown.a, b: shown.b };
          cancel = k.animate(420, function (t) {
            var a = from.a + (a1 - from.a) * t, b = from.b + (b1 - from.b) * t;
            shown = { a: a, b: b };
            drawCurves(v, a, b, t >= 1);
          });
        } else {
          shown = { a: a1, b: b1 };
          drawCurves(v, a1, b1, true);
        }
      }

      /* ---- step 2: the controls ---- */
      k.slider({
        x: SIDE, y: 304, w: COL, min: STRENGTH_MIN, max: STRENGTH_MAX, step: 2, value: STRENGTH_START,
        label: 'prior strength', steps: [2],
        format: function (v) { return String(v); },
        onChange: function (v) { strength = v; update(false); }
      });
      var ends = k.root.group({ steps: [2], d: 500 });
      ends.text(SIDE, 323, 'weak', { kind: 'axis' });
      ends.text(SIDE + COL, 323, 'strong', { kind: 'axis', anchor: 'end' });
      var more = k.button(SIDE, 354, 'observe 5 more', function () {
        if (n >= N_MAX) return;
        n += N_STEP;
        more.set(n >= N_MAX ? 'all 40 observed' : 'observe 5 more');
        update(true);
      }, { steps: [2], d: 600 });
      k.button(SIDE, 382, 'start over', function () {
        n = 0;
        more.set('observe 5 more');
        update(true);
      }, { steps: [2], d: 700 });

      /* ---- the lettered notes ---- */
      var p0 = curveOf(PRIOR_MEAN * STRENGTH_START, (1 - PRIOR_MEAN) * STRENGTH_START);
      k.root.group({ steps: [0] }).callout('a', 'a belief, before data', SIDE, 150,
        { to: [sx(p0.flank(1, 0.7)) + 8, sy(p0.peak * 0.7) - 4], d: 700 });
      var s1 = countOf(N_START);
      var p1 = curveOf(PRIOR_MEAN * STRENGTH_START + s1, (1 - PRIOR_MEAN) * STRENGTH_START + N_START - s1);
      k.root.group({ steps: [1] }).callout('b', 'ten outcomes pull it over', SIDE, 262,
        { to: [sx(p1.flank(1, 0.85)) + 8, sy(p1.peak * 0.85) - 2], d: 700 });
      var g2 = k.root.group({ steps: [2], d: 300 });
      g2.callout('c', 'a strong prior resists', SIDE, 262, { d: 300 });
      g2.text(SIDE, 412, 'more data, narrower:', { kind: 'hand', d: 800 });
      g2.text(SIDE, 434, 'the prior fades.', { kind: 'hand', d: 1200 });

      k.onStep(function () { update(false); });
    }
  });
})();
