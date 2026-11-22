/* Logistic figure — yes/no outcomes along x, the S-shaped chance curve, and what a cut-off costs.
   The story: machine parts, months since each was serviced, and whether it broke this month (made up).
   The curve is a real logistic regression fitted in the browser by Newton's method (deterministic), the
   straight line of step 0 is ordinary least squares on the same 0/1 outcomes, and the four counts and the
   total cost are counted from the points that are drawn.
   Steps: 0 a straight line runs above 1 and below 0 · 1 the S-shaped curve stays between them ·
          2 the reader slides the cut-off: four counts and the total cost, worked out live ·
          3 change what a miss costs and see which cut-off is cheapest (second slider).
   The parts, their fitted chances (to 3 decimals, the same numbers the counts here use) and the reader's
   cut-off are offered to the page's Python through window.InkPage. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };       // the plot area, in figure pixels
  var SIDE = 462, RIGHT = SIDE + 158;                // the column beside the plot
  var DOM = 10, P_LO = -0.25, P_HI = 1.25;           // x runs 0..10; the vertical axis shows a little beyond 0..1
  var COST_FP = 1, COST_FN_START = 5;                // made-up costs: a part replaced for nothing, and a breakdown
  var STORE = 'ink-line-cutoff';

  function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
  function r2(v) { return Math.round(v * 100) / 100; }
  function r3(v) { return Math.round(v * 1000) / 1000; }

  function makeData(rand) {
    var pts = [];
    for (var i = 0; i < 34; i++) {
      var x = 0.5 + i * 0.275 + (rand() - 0.5) * 0.2;
      pts.push({ x: r2(x), y: rand() < sigmoid(-4.0 + 0.8 * x) ? 1 : 0, lift: (i % 3) * 0.035 });   // lift: a small stagger so neighbours do not overprint
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

  var PTS = makeData(window.InkKit.rng(19));
  var MODEL = fitLogistic(PTS);
  function prob(x) { return sigmoid(MODEL.a0 + MODEL.a1 * x); }
  PTS.forEach(function (p) { p.chance = r3(prob(p.x)); });

  function remembered() {
    try { var v = parseFloat(sessionStorage.getItem(STORE)); return v > 0 && v < 1 ? v : null; } catch (e) { return null; }
  }
  function remember(v) { try { sessionStorage.setItem(STORE, String(v)); } catch (e) {} }

  /* what `from page import parts, chances, my_cutoff` gives the Python on the same page */
  window.InkPage = window.InkPage || {};
  window.InkPage.parts = function () { return PTS.map(function (p) { return [p.x, p.y]; }); };
  window.InkPage.chances = function () { return PTS.map(function (p) { return p.chance; }); };
  window.InkPage.my_cutoff = function () { return remembered() || 0.5; };

  window.InkKit.define('logistic-figure', {
    label: 'Yes or no: machine parts by months since service, a straight line and an S-shaped chance curve, a cut-off, and what its mistakes cost',
    steps: 4,
    seed: 41,
    draw: function (k) {
      var sx = k.scale(0, DOM, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(P_LO, P_HI, PLOT.y + PLOT.h, PLOT.y);
      var pts = PTS, m = MODEL, ols = fitLine(PTS);
      var cutoff = remembered() || 0.5, costFN = COST_FN_START;

      /* count the four kinds at a cut-off: "yes" is said when the chance reaches it */
      function counts(t) {
        var c = { tp: 0, fp: 0, fn: 0, tn: 0 };
        pts.forEach(function (p) {
          var yes = p.chance >= t;
          if (yes && p.y) c.tp++; else if (yes) c.fp++; else if (p.y) c.fn++; else c.tn++;
        });
        c.cost = c.fp * COST_FP + c.fn * costFN;
        return c;
      }

      k.root.axes({
        x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'months since service', ylabel: 'chance it breaks',
        xticks: [0, 2, 4, 6, 8, 10].map(function (v) { return [sx(v), String(v)]; }),
        yticks: [[sy(0), '0'], [sy(0.5), '.5'], [sy(1), '1']]
      });
      var rails = k.root.group({ d: 100 });
      rails.thread([[sx(0), sy(1)], [sx(DOM), sy(1)]], { w: 1 });
      rails.thread([[sx(0), sy(0)], [sx(DOM), sy(0)]], { w: 1 });
      rails.text(sx(DOM) - 4, sy(1) - 8, 'broke', { kind: 'axis', anchor: 'end' });
      rails.text(sx(DOM) - 4, sy(0) + 16, 'was fine', { kind: 'axis', anchor: 'end' });

      /* ---- steps 0 and 1: where a chance cannot go ---- */
      var bands = k.root.group({ steps: [0, 1], d: 200 });
      bands.hatch([[sx(0), sy(P_HI)], [sx(DOM), sy(P_HI)], [sx(DOM), sy(1.06)], [sx(0), sy(1.06)]], { op: 0.26, gap: 6 });
      bands.hatch([[sx(0), sy(-0.06)], [sx(DOM), sy(-0.06)], [sx(DOM), sy(P_LO)], [sx(0), sy(P_LO)]], { op: 0.26, gap: 6 });

      /* ---- step 0: a straight line through 0/1 outcomes runs out of the range ---- */
      var g0 = k.root.group({ steps: [0], d: 500 });
      var xa = (P_LO - ols.a0) / ols.a1, xb = (P_HI - ols.a0) / ols.a1;
      var x0 = Math.max(0, Math.min(xa, xb)), x1 = Math.min(DOM, Math.max(xa, xb));
      g0.line(sx(x0), sy(ols.a0 + ols.a1 * x0), sx(x1), sy(ols.a0 + ols.a1 * x1), { w: 1.4, op: 0.9, rough: 0.5 });
      g0.text(SIDE, 44, 'the line says', { kind: 'axis' });
      g0.text(SIDE, 64, 'at 0 months', { kind: 'label' });
      g0.text(RIGHT, 64, ols.a0.toFixed(2), { kind: 'val', anchor: 'end' });
      g0.text(SIDE, 84, 'at 10 months', { kind: 'label' });
      g0.text(RIGHT, 84, (ols.a0 + ols.a1 * DOM).toFixed(2), { kind: 'val', anchor: 'end' });
      g0.line(SIDE, 96, RIGHT, 96, { w: 0.6, op: 0.45, rough: 0.3 });
      g0.callout('a', 'a chance below 0?', SIDE, 130, { d: 1200 });
      g0.text(SIDE, 170, 'or above 1?', { kind: 'hand', d: 1500 });

      /* ---- steps 1 to 3: the fitted curve ---- */
      var curve = [];
      for (var i = 0; i <= 100; i++) curve.push([sx(i / 100 * DOM), sy(prob(i / 100 * DOM))]);
      // in a layer, not a stepped group: a bare path is only hidden between steps when its layer fades
      k.root.layer({ steps: [1, 2, 3] }).polyline(curve, { w: 1.7, op: 0.9 });

      var g1 = k.root.group({ steps: [1], d: 300 });
      g1.text(SIDE, 44, 'the curve says', { kind: 'axis' });
      g1.text(SIDE, 64, 'at 0 months', { kind: 'label' });
      g1.text(RIGHT, 64, prob(0).toFixed(2), { kind: 'val', anchor: 'end' });
      g1.text(SIDE, 84, 'at 10 months', { kind: 'label' });
      g1.text(RIGHT, 84, prob(DOM).toFixed(2), { kind: 'val', anchor: 'end' });
      g1.line(SIDE, 96, RIGHT, 96, { w: 0.6, op: 0.45, rough: 0.3 });
      g1.callout('b', 'never leaves 0 to 1', SIDE, 130, { d: 900 });

      /* ---- steps 2 and 3: the cut-off, the four counts, and what they cost ---- */
      var live = k.root.layer({ steps: [2, 3] });
      var C1 = SIDE + 98, C2 = SIDE + 140;
      var mat = k.root.group({ steps: [2, 3], d: 300 });
      mat.text((C1 + C2) / 2, 88, 'it really', { kind: 'axis', anchor: 'middle' });
      mat.text(C1, 102, 'broke', { kind: 'axis', anchor: 'middle' });
      mat.text(C2, 102, 'fine', { kind: 'axis', anchor: 'middle' });
      mat.line(SIDE + 72, 108, RIGHT, 108, { w: 0.6, op: 0.5, rough: 0.2 });
      mat.line(SIDE + 72, 108, SIDE + 72, 148, { w: 0.6, op: 0.5, rough: 0.2 });
      mat.text(SIDE, 124, 'say yes', { kind: 'label' });
      mat.text(SIDE, 142, 'say no', { kind: 'label' });
      var cell = {
        tp: mat.text(C1, 124, '', { kind: 'val', anchor: 'middle' }), fp: mat.text(C2, 124, '', { kind: 'val', anchor: 'middle' }),
        fn: mat.text(C1, 142, '', { kind: 'val', anchor: 'middle' }), tn: mat.text(C2, 142, '', { kind: 'val', anchor: 'middle' })
      };
      mat.line(SIDE, 156, RIGHT, 156, { w: 0.6, op: 0.45, rough: 0.3 });
      mat.text(SIDE, 176, 'false alarm costs', { kind: 'label' });
      mat.text(RIGHT, 176, String(COST_FP), { kind: 'val', anchor: 'end' });
      mat.line(SIDE, 222, RIGHT, 222, { w: 0.6, op: 0.45, rough: 0.3 });
      var sumVal = mat.text(SIDE, 242, '', { kind: 'axis' });
      mat.text(SIDE, 262, 'total cost', { kind: 'label' });
      var costVal = mat.text(RIGHT, 262, '', { kind: 'val', anchor: 'end' });

      var fixed = k.root.group({ steps: [2], d: 300 });
      fixed.text(SIDE, 196, 'miss costs', { kind: 'label' });
      var fnVal = fixed.text(RIGHT, 196, '', { kind: 'val', anchor: 'end' });
      fixed.callout('c', 'count, then multiply', SIDE, 300, { d: 500 });
      fixed.text(SIDE, 330, 'rings: the mistakes', { kind: 'axis', d: 700 });

      var g3 = k.root.group({ steps: [3], d: 300 });
      g3.text(SIDE, 286, 'cheapest at', { kind: 'label' });
      var bestAt = g3.text(RIGHT, 286, '', { kind: 'val', anchor: 'end' });
      g3.text(SIDE, 304, 'which costs', { kind: 'label' });
      var bestCost = g3.text(RIGHT, 304, '', { kind: 'val', anchor: 'end' });
      g3.callout('d', 'now reprice a miss', SIDE, 336, { d: 500 });
      g3.text(SIDE, 366, 'work it out.', { kind: 'hand', d: 700 });
      g3.text(SIDE, 388, "don't guess.", { kind: 'hand', d: 1100 });

      function redraw() {
        var c = counts(cutoff), xT = (Math.log(cutoff / (1 - cutoff)) - m.a0) / m.a1;
        live.clear();
        if (xT > 0 && xT < DOM) {
          live.line(sx(0), sy(cutoff), sx(xT), sy(cutoff), { w: 0.7, op: 0.6, rough: 0.2 });
          live.line(sx(xT), sy(P_LO), sx(xT), sy(1.19), { w: 1.3, op: 0.95, rough: 0.3, accent: true });
          if (sx(xT) - PLOT.x > 64) live.text(sx(xT) - 8, sy(1.15), 'say no', { kind: 'label', anchor: 'end' });
          if (PLOT.x + PLOT.w - sx(xT) > 72) live.text(sx(xT) + 8, sy(1.15), 'say yes', { kind: 'label' });
        }
        pts.forEach(function (p) {                    // ring the ones this cut-off gets wrong
          if ((p.chance >= cutoff) !== (p.y === 1)) live.circle(sx(p.x), sy(p.y ? 1 - p.lift : p.lift), 8, { w: 0.8, op: 0.75 });
        });
        cell.tp.set(String(c.tp)); cell.fp.set(String(c.fp)); cell.fn.set(String(c.fn)); cell.tn.set(String(c.tn));
        fnVal.set(String(costFN));
        sumVal.set(c.fp + ' × ' + COST_FP + ' + ' + c.fn + ' × ' + costFN);
        costVal.set(String(c.cost));
        var best = null;                              // try every cut-off the slider can reach
        for (var t = 5; t <= 95; t += 5) {
          var ct = counts(t / 100);
          if (!best || ct.cost < best.cost || (ct.cost === best.cost && Math.abs(t - 50) < Math.abs(best.t - 50))) best = { t: t, cost: ct.cost };
        }
        bestAt.set((best.t / 100).toFixed(2)); bestCost.set(String(best.cost));
      }

      /* ---- the outcomes: a plus for broke (drawn at 1), a circle for fine (drawn at 0) ---- */
      var marks = k.root.group({ d: 150, stagger: 14 });
      pts.forEach(function (p) { marks.mark(sx(p.x), sy(p.y ? 1 - p.lift : p.lift), p.y ? '+' : 'o', { r: 3.6 }); });
      marks.node.style.pointerEvents = 'none';

      var cut = k.slider({
        x: SIDE, y: 60, w: 158, min: 0.05, max: 0.95, step: 0.05, value: cutoff, label: 'cut-off', steps: [2, 3],
        format: function (v) { return v.toFixed(2); },
        onChange: function (v) { cutoff = v; remember(v); redraw(); }
      });
      k.slider({
        x: SIDE, y: 210, w: 158, min: 1, max: 10, step: 1, value: costFN, label: 'miss costs', steps: [3],
        onChange: function (v) { costFN = v; redraw(); }
      });

      k.onStep(function (step) {
        if (step >= 2) {
          var r = remembered();
          if (r && Math.abs(r - cutoff) > 1e-9) { cutoff = r; cut.set(r, true); }
          redraw();
        }
      });
    }
  });
})();
