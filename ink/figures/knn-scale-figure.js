/* KNN scaling figure — why you scale before you measure distance.
   Twenty-eight loan applicants with an income (dollars) and a credit score, and one new applicant.
   The k = 5 nearest neighbours and their vote are computed in the browser from the same numbers that are
   drawn, with the distance  d² = (stretch · z_income)² + z_credit² . At stretch 1 both features are
   z-scores; at stretch sd(income) / sd(credit) the distance is exactly the raw-unit one (dollars against
   score points), up to a constant factor that cannot change who is nearest.
   The shaded shape is the set of places as near as the 5th neighbour: a circle to the ruler, drawn on a
   chart whose axes each fill the page. In raw units it is a sliver, because a dollar counts like a point.
   Steps: 0 raw units (the neighbours are just the nearest incomes) · 1 scaled (both features count)
          · 2 a slider sets how much income counts, from raw units (where it starts) down to scaled, and the
            neighbours and the vote change live.
   The applicants are offered to the page's Python as `applicants` (income, score), `approved` (1 approve, 0 deny)
   and `applicant` (the new one).
   Made-up applicants. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };       // the plot area, in figure pixels
  var SIDE = 462;                                    // left edge of the column beside the plot
  var PPZ = 75;                                      // pixels per standard deviation, the same on both axes
  var K = 5;
  var QUERY = { inc: 62000, cr: 720 };               // the new applicant

  function makeData(rand) {
    var pts = [], i;
    function g() { return (rand() + rand() + rand() - 1.5) * 2; }
    for (i = 0; i < 14; i++) pts.push({ inc: Math.round((56000 + 13000 * g()) / 100) * 100, cr: Math.round(612 + 38 * g()), c: -1 });
    for (i = 0; i < 14; i++) pts.push({ inc: Math.round((62000 + 13000 * g()) / 100) * 100, cr: Math.round(712 + 38 * g()), c: 1 });
    return pts;
  }

  // made once, so the page's Python works on exactly the same applicants
  var DATA = makeData(window.InkKit.rng(6));
  window.InkPage = window.InkPage || {};
  window.InkPage.applicants = function () { return DATA.map(function (p) { return [p.inc, p.cr]; }); };
  window.InkPage.approved = function () { return DATA.map(function (p) { return p.c > 0 ? 1 : 0; }); };
  window.InkPage.applicant = function () { return [QUERY.inc, QUERY.cr]; };

  /* mean and sample standard deviation of each feature: what scale() in R would use */
  function stats(pts) {
    var n = pts.length, mi = 0, mc = 0, vi = 0, vc = 0;
    pts.forEach(function (p) { mi += p.inc / n; mc += p.cr / n; });
    pts.forEach(function (p) { vi += (p.inc - mi) * (p.inc - mi) / (n - 1); vc += (p.cr - mc) * (p.cr - mc) / (n - 1); });
    return { mi: mi, mc: mc, si: Math.sqrt(vi), sc: Math.sqrt(vc) };
  }

  window.InkKit.define('knn-scale-figure', {
    label: 'K nearest neighbours of one new applicant, found in raw units and again after scaling: different neighbours, different vote',
    steps: 3,
    seed: 5,
    draw: function (k) {
      var pts = DATA.map(function (p) { return { inc: p.inc, cr: p.cr, c: p.c }; }), st = stats(pts);
      var RAW = st.si / st.sc;                       // the stretch that reproduces raw-unit distance
      var cx = PLOT.x + PLOT.w / 2, cy = PLOT.y + PLOT.h / 2;
      function zx(inc) { return (inc - st.mi) / st.si; }
      function zy(cr) { return (cr - st.mc) / st.sc; }
      function sx(z) { return cx + z * PPZ; }
      function sy(z) { return cy - z * PPZ; }
      pts.forEach(function (p) { p.zx = zx(p.inc); p.zy = zy(p.cr); p.px = sx(p.zx); p.py = sy(p.zy); });
      var q = { zx: zx(QUERY.inc), zy: zy(QUERY.cr) };
      q.px = sx(q.zx); q.py = sy(q.zy);
      var stretch = 1;

      /* ---- axes: the same chart throughout; only the tick labels change with the units ---- */
      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'income', ylabel: 'credit score', xticks: [] });
      var rawTicks = k.root.group({ steps: [0, 2], d: 200 }), zTicks = k.root.group({ steps: [1], d: 200 });
      function tickX(g, px, str) {
        g.line(px, PLOT.y + PLOT.h, px, PLOT.y + PLOT.h + 4, { w: 0.6, op: 0.6, rough: 0.2 });
        g.text(px, PLOT.y + PLOT.h + 16, str, { kind: 'axis', anchor: 'middle' });
      }
      function tickY(g, py, str) {
        g.line(PLOT.x - 4, py, PLOT.x, py, { w: 0.6, op: 0.6, rough: 0.2 });
        g.text(PLOT.x - 8, py + 3.5, str, { kind: 'axis', anchor: 'end' });
      }
      [40000, 60000, 80000].forEach(function (v) { tickX(rawTicks, sx(zx(v)), '$' + v / 1000 + 'k'); });
      [600, 700].forEach(function (v) { tickY(rawTicks, sy(zy(v)), String(v)); });
      [-2, 0, 2].forEach(function (z) { tickX(zTicks, sx(z), (z > 0 ? '+' : '') + z); });
      [-2, 0, 2].forEach(function (z) { tickY(zTicks, sy(z), (z > 0 ? '+' : '') + z); });

      /* ---- the applicants: always there ---- */
      var live = k.root.layer();
      var marks = k.root.group({ d: 200, stagger: 18 });
      pts.forEach(function (p) { marks.mark(p.px, p.py, p.c > 0 ? '+' : 'o'); });
      marks.mark(q.px, q.py, 'sq', { r: 4.5, w: 1.5 });
      marks.dot(q.px, q.py, 1.6);

      /* ---- the column beside the plot ---- */
      var side = k.root.group({ d: 300 });
      side.text(SIDE, 60, 'the 5 nearest', { kind: 'label' });
      side.mark(SIDE + 5, 78, 'o', { r: 3.4 }); side.mark(SIDE + 5, 98, '+', { r: 3.4 });
      side.text(SIDE + 18, 82, 'deny', { kind: 'label' });
      var denyVal = side.text(SIDE + 158, 82, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE + 18, 102, 'approve', { kind: 'label' });
      var apprVal = side.text(SIDE + 158, 102, '', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 114, SIDE + 158, 114, { w: 0.6, op: 0.45, rough: 0.3 });
      side.text(SIDE, 134, 'the vote says', { kind: 'label' });
      var voteVal = side.text(SIDE + 158, 134, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 154, 'income share', { kind: 'label' });
      var shareVal = side.text(SIDE + 158, 154, '', { kind: 'val', anchor: 'end' });

      /* everything that depends on the ruler: who is nearest, the vote, how much of the distance is income */
      function redraw() {
        var s = stretch, incSq = 0, allSq = 0;
        var ranked = pts.map(function (p) {
          var dx = s * (p.zx - q.zx), dy = p.zy - q.zy;
          incSq += dx * dx; allSq += dx * dx + dy * dy;
          return { p: p, d: Math.sqrt(dx * dx + dy * dy) };
        }).sort(function (a, b) { return a.d - b.d; });
        var near = ranked.slice(0, K), r = near[K - 1].d;
        var appr = near.filter(function (e) { return e.p.c > 0; }).length;

        live.clear();
        // the places exactly as far as the 5th neighbour: half-width r / s along income, r along credit
        var a = r / s * PPZ, b = r * PPZ;
        var top = PLOT.y + 3, bot = PLOT.y + PLOT.h - 3, lft = PLOT.x + 3, rgt = PLOT.x + PLOT.w - 3;
        var t0 = Math.asin(Math.max(-1, (q.py - bot) / b)), t1 = Math.asin(Math.min(1, (q.py - top) / b));
        var right = [], left = [], N = 40, i;
        for (i = 0; i <= N; i++) {
          var t = t0 + (t1 - t0) * i / N, y = q.py - b * Math.sin(t), w = a * Math.cos(t);
          right.push([Math.min(rgt, q.px + w), y]);
          left.push([Math.max(lft, q.px - w), y]);
        }
        live.hatch(right.concat(left.slice().reverse()), { op: 0.28, gap: 4.5 });
        live.polyline(right, { w: 0.8, op: 0.6 });
        live.polyline(left, { w: 0.8, op: 0.6 });
        near.forEach(function (e) {
          live.line(q.px, q.py, e.p.px, e.p.py, { w: 0.6, op: 0.4, rough: 0.2 });
          live.circle(e.p.px, e.p.py, 9, { accent: true, w: 1.2, op: 0.95 });
        });

        denyVal.set(String(K - appr));
        apprVal.set(String(appr));
        voteVal.set(appr > K - appr ? 'approve' : 'deny');
        var share = 100 * incSq / allSq;
        shareVal.set(share > 99.9 ? '> 99.9%' : share.toFixed(0) + '%');
      }

      /* ---- step 2: stretch the income axis, on a log scale from scaled to raw ---- */
      var LOG_RAW = Math.log(RAW) / Math.LN10;
      var slider = k.slider({
        x: SIDE, y: 268, w: 158, min: 0, max: 1, step: 0.01, value: 1,
        label: 'income counts', steps: [2],
        format: function (v) { var m = Math.pow(10, v * LOG_RAW); return '× ' + (m < 10 ? m.toFixed(1) : m.toFixed(0)); },
        onChange: function (v) { stretch = Math.pow(10, v * LOG_RAW); redraw(); }
      });
      var notes = k.root.group({ steps: [2], d: 500 });
      notes.text(SIDE, 294, 'scaled', { kind: 'axis' });
      notes.text(SIDE + 158, 294, 'raw dollars', { kind: 'axis', anchor: 'end' });
      notes.text(SIDE, 336, 'the units pick', { kind: 'hand', d: 700 });
      notes.text(SIDE, 358, 'the neighbours.', { kind: 'hand', d: 1100 });

      k.root.group({ steps: [0] }).callout('a', 'income decides alone', SIDE, 204, { d: 700 });
      k.root.group({ steps: [1] }).callout('b', 'both features count', SIDE, 204, { d: 700 });
      k.root.group({ steps: [2] }).callout('c', 'slide: income counts less', SIDE, 204, { d: 400 });

      k.onStep(function (step) {
        stretch = step === 0 ? RAW : step === 1 ? 1 : Math.pow(10, slider.value * LOG_RAW);
        redraw();
      });
    }
  });
})();
