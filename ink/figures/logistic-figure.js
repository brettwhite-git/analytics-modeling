/* Logistic figure — yes/no outcomes along x, the fitted probability curve, and what a threshold costs.
   The curve is a real logistic regression fitted in the browser by Newton's method (IRLS, deterministic), the
   straight line of step 0 is ordinary least squares on the same 0/1 outcomes, and the confusion matrix and
   total cost are counted from the points that are drawn.
   Steps: 0 the problem (a straight line leaves the range 0..1) · 1 the logistic curve · 2 a threshold turns
          probabilities into yes/no; confusion matrix and total cost (slider) · 3 change what a miss costs
          and see which threshold is cheapest (second slider).
   Made-up points and made-up costs. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };       // the plot area, in figure pixels
  var SIDE = 462, RIGHT = SIDE + 158;                // the column beside the plot
  var DOM = 10, P_LO = -0.25, P_HI = 1.25;           // x runs 0..10; the vertical axis shows a little beyond 0..1
  var COST_FP = 1, COST_FN_START = 5;                // made-up costs: a false alarm, and a miss

  function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

  function makeData(rand) {
    var pts = [];
    for (var i = 0; i < 34; i++) {
      var x = 0.5 + i * 0.275 + (rand() - 0.5) * 0.2;
      pts.push({ x: x, y: rand() < sigmoid(-4.0 + 0.8 * x) ? 1 : 0, lift: (i % 3) * 0.035 });   // lift: a small stagger so neighbours do not overprint
    }
    return pts;
  }

  /* logistic regression of y on x by Newton's method: returns a0, a1 of  log(p / (1 - p)) = a0 + a1 x */
  function fitLogistic(pts) {
    var a0 = 0, a1 = 0;
    for (var it = 0; it < 25; it++) {
      var g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
      pts.forEach(function (p) {
        var mu = sigmoid(a0 + a1 * p.x), w = mu * (1 - mu), e = p.y - mu;
        g0 += e; g1 += e * p.x; h00 += w; h01 += w * p.x; h11 += w * p.x * p.x;
      });
      var det = h00 * h11 - h01 * h01;
      if (Math.abs(det) < 1e-12) break;
      a0 += (h11 * g0 - h01 * g1) / det; a1 += (h00 * g1 - h01 * g0) / det;
    }
    return { a0: a0, a1: a1 };
  }
  /* ordinary least squares of the 0/1 outcome on x */
  function fitLine(pts) {
    var n = pts.length, mx = 0, my = 0, sxy = 0, sxx = 0;
    pts.forEach(function (p) { mx += p.x / n; my += p.y / n; });
    pts.forEach(function (p) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) * (p.x - mx); });
    return { a0: my - sxy / sxx * mx, a1: sxy / sxx };
  }

  window.InkKit.define('logistic-figure', {
    label: 'Logistic regression: yes and no outcomes along x, the fitted probability curve, a threshold, and the confusion matrix it produces',
    steps: 4,
    seed: 41,
    draw: function (k) {
      var sx = k.scale(0, DOM, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(P_LO, P_HI, PLOT.y + PLOT.h, PLOT.y);
      var pts = makeData(k.rng(19));
      var m = fitLogistic(pts), ols = fitLine(pts);
      var threshold = 0.5, costFN = COST_FN_START;
      function prob(x) { return sigmoid(m.a0 + m.a1 * x); }

      /* count the four cells at a threshold: "yes" is predicted when the fitted probability reaches it */
      function confusion(t) {
        var c = { tp: 0, fp: 0, fn: 0, tn: 0 };
        pts.forEach(function (p) {
          var yes = prob(p.x) >= t;
          if (yes && p.y) c.tp++; else if (yes) c.fp++; else if (p.y) c.fn++; else c.tn++;
        });
        c.cost = c.fp * COST_FP + c.fn * costFN;
        return c;
      }

      k.root.axes({
        x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'x', ylabel: 'p(yes)',
        yticks: [[sy(0), '0'], [sy(0.5), '.5'], [sy(1), '1']]
      });
      var rails = k.root.group({ d: 100 });
      rails.thread([[sx(0), sy(1)], [sx(DOM), sy(1)]], { w: 1 });
      rails.thread([[sx(0), sy(0)], [sx(DOM), sy(0)]], { w: 1 });

      /* ---- steps 0 and 1: where a probability cannot go ---- */
      var bands = k.root.group({ steps: [0, 1], d: 200 });
      bands.hatch([[sx(0), sy(P_HI)], [sx(DOM), sy(P_HI)], [sx(DOM), sy(1)], [sx(0), sy(1)]], { op: 0.26, gap: 6 });
      bands.hatch([[sx(0), sy(0)], [sx(DOM), sy(0)], [sx(DOM), sy(P_LO)], [sx(0), sy(P_LO)]], { op: 0.26, gap: 6 });

      /* ---- step 0: a straight line through 0/1 outcomes runs out of the range ---- */
      var g0 = k.root.group({ steps: [0], d: 500 });
      var xa = (P_LO - ols.a0) / ols.a1, xb = (P_HI - ols.a0) / ols.a1;
      var x0 = Math.max(0, Math.min(xa, xb)), x1 = Math.min(DOM, Math.max(xa, xb));
      g0.line(sx(x0), sy(ols.a0 + ols.a1 * x0), sx(x1), sy(ols.a0 + ols.a1 * x1), { w: 1.1, op: 0.85, rough: 0.5 });
      var xOver = Math.min(DOM, ((1 - ols.a0) / ols.a1 + x1) / 2);   // a spot on the line above 1
      var overY = sy(ols.a0 + ols.a1 * xOver);
      g0.callout('a', 'above 1, below 0', SIDE, overY + 4, { to: [sx(xOver) + 6, overY], d: 1200 });

      /* ---- steps 1 to 3: the fitted curve ---- */
      var curve = [];
      for (var i = 0; i <= 100; i++) curve.push([sx(i / 100 * DOM), sy(prob(i / 100 * DOM))]);
      // in a layer, not a stepped group: a bare path is only hidden between steps when its layer fades
      k.root.layer({ steps: [1, 2, 3] }).polyline(curve, { w: 1.7, op: 0.9 });

      var g1 = k.root.group({ steps: [1], d: 300 });
      g1.text(SIDE, 60, 'intercept', { kind: 'label' });
      g1.text(RIGHT, 60, m.a0.toFixed(2), { kind: 'val', anchor: 'end' });
      g1.text(SIDE, 80, 'slope', { kind: 'label' });
      g1.text(RIGHT, 80, m.a1.toFixed(2), { kind: 'val', anchor: 'end' });
      g1.text(SIDE, 100, 'odds ratio', { kind: 'label' });
      g1.text(RIGHT, 100, Math.exp(m.a1).toFixed(2), { kind: 'val', anchor: 'end' });
      g1.line(SIDE, 112, RIGHT, 112, { w: 0.6, op: 0.45, rough: 0.3 });
      g1.callout('b', 'never leaves 0 to 1', SIDE, 150, { d: 900 });

      /* ---- steps 2 and 3: the threshold, the matrix it produces, and what that costs ---- */
      var live = k.root.layer({ steps: [2, 3] });
      var C1 = SIDE + 92, C2 = SIDE + 138;
      var mat = k.root.group({ steps: [2, 3], d: 300 });
      mat.text((C1 + C2) / 2, 88, 'actually', { kind: 'axis', anchor: 'middle' });
      mat.text(C1, 102, 'yes', { kind: 'axis', anchor: 'middle' });
      mat.text(C2, 102, 'no', { kind: 'axis', anchor: 'middle' });
      mat.line(SIDE + 64, 108, RIGHT, 108, { w: 0.6, op: 0.5, rough: 0.2 });
      mat.line(SIDE + 64, 108, SIDE + 64, 146, { w: 0.6, op: 0.5, rough: 0.2 });
      mat.text(SIDE, 124, 'say yes', { kind: 'label' });
      mat.text(SIDE, 142, 'say no', { kind: 'label' });
      var cell = {
        tp: mat.text(C1, 124, '', { kind: 'val', anchor: 'middle' }), fp: mat.text(C2, 124, '', { kind: 'val', anchor: 'middle' }),
        fn: mat.text(C1, 142, '', { kind: 'val', anchor: 'middle' }), tn: mat.text(C2, 142, '', { kind: 'val', anchor: 'middle' })
      };
      mat.line(SIDE, 154, RIGHT, 154, { w: 0.6, op: 0.45, rough: 0.3 });
      mat.text(SIDE, 174, 'each FP costs', { kind: 'label' });
      mat.text(RIGHT, 174, String(COST_FP), { kind: 'val', anchor: 'end' });
      mat.line(SIDE, 220, RIGHT, 220, { w: 0.6, op: 0.45, rough: 0.3 });
      mat.text(SIDE, 240, 'FP + FN', { kind: 'label' });
      var sumVal = mat.text(RIGHT, 240, '', { kind: 'val', anchor: 'end' });
      mat.text(SIDE, 258, 'total cost', { kind: 'label' });
      var costVal = mat.text(RIGHT, 258, '', { kind: 'val', anchor: 'end' });

      var fixed = k.root.group({ steps: [2], d: 300 });
      fixed.text(SIDE, 192, 'each FN costs', { kind: 'label' });
      var fnVal = fixed.text(RIGHT, 192, '', { kind: 'val', anchor: 'end' });
      fixed.callout('c', 'count, then multiply', SIDE, 292, { d: 500 });

      var g3 = k.root.group({ steps: [3], d: 300 });
      g3.text(SIDE, 278, 'cheapest at', { kind: 'label' });
      var bestAt = g3.text(RIGHT, 278, '', { kind: 'val', anchor: 'end' });
      g3.text(SIDE, 296, 'which costs', { kind: 'label' });
      var bestCost = g3.text(RIGHT, 296, '', { kind: 'val', anchor: 'end' });
      g3.callout('d', 'now reprice a miss', SIDE, 326, { d: 500 });
      g3.text(SIDE, 358, 'work out the cost.', { kind: 'hand', d: 700 });
      g3.text(SIDE, 380, "don't guess.", { kind: 'hand', d: 1100 });

      function redraw() {
        var c = confusion(threshold), xT = (Math.log(threshold / (1 - threshold)) - m.a0) / m.a1;
        live.clear();
        if (xT > 0 && xT < DOM) {
          live.line(sx(0), sy(threshold), sx(xT), sy(threshold), { w: 0.7, op: 0.6, rough: 0.2 });
          live.line(sx(xT), sy(P_LO), sx(xT), sy(1.19), { w: 1.3, op: 0.95, rough: 0.3, accent: true });
          if (sx(xT) - PLOT.x > 64) live.text(sx(xT) - 8, sy(1.13), 'say no', { kind: 'label', anchor: 'end' });
          if (PLOT.x + PLOT.w - sx(xT) > 72) live.text(sx(xT) + 8, sy(1.13), 'say yes', { kind: 'label' });
        }
        pts.forEach(function (p) {                    // ring the ones this threshold gets wrong
          if ((prob(p.x) >= threshold) !== (p.y === 1)) live.circle(sx(p.x), sy(p.y ? 1 - p.lift : p.lift), 8, { w: 0.8, op: 0.75 });
        });
        cell.tp.set('TP ' + c.tp); cell.fp.set('FP ' + c.fp); cell.fn.set('FN ' + c.fn); cell.tn.set('TN ' + c.tn);
        fnVal.set(String(costFN));
        sumVal.set(c.fp + '×' + COST_FP + ' + ' + c.fn + '×' + costFN);
        costVal.set(String(c.cost));
        var best = null;                              // try every threshold the slider can reach
        for (var t = 5; t <= 95; t += 5) {
          var ct = confusion(t / 100);
          if (!best || ct.cost < best.cost || (ct.cost === best.cost && Math.abs(t - 50) < Math.abs(best.t - 50))) best = { t: t, cost: ct.cost };
        }
        bestAt.set((best.t / 100).toFixed(2)); bestCost.set(String(best.cost));
      }

      /* ---- the outcomes: a plus for yes (drawn at 1), a circle for no (drawn at 0) ---- */
      var marks = k.root.group({ d: 150, stagger: 14 });
      pts.forEach(function (p) { marks.mark(sx(p.x), sy(p.y ? 1 - p.lift : p.lift), p.y ? '+' : 'o', { r: 3.6 }); });

      k.slider({
        x: SIDE, y: 60, w: 158, min: 0.05, max: 0.95, step: 0.05, value: threshold, label: 'threshold', steps: [2, 3],
        format: function (v) { return v.toFixed(2); },
        onChange: function (v) { threshold = v; redraw(); }
      });
      k.slider({
        x: SIDE, y: 206, w: 158, min: 1, max: 10, step: 1, value: costFN, label: 'each FN costs', steps: [3],
        onChange: function (v) { costFN = v; redraw(); }
      });

      k.onStep(function (step) { if (step >= 2) redraw(); });
    }
  });
})();
