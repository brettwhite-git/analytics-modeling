/* Corrections figure — a weak rule fixed in rounds, worked for real.
   The first guess is the average height of the points. Each round finds the misses, fits one tiny rule to
   them (one cut on x; each side predicts the average miss on its side; the cut that leaves the least squared
   miss), and adds a fraction of it to the guess. The reader adds one correction at a time (or ten), slides
   the fraction, and watches the miss on the points used and on fresh points from the same made-up curve.
   "Miss" is the average distance between a point and the line. Every number is computed from what is drawn.
   One step. Offers `train`, `fresh`, `rate` to the page's Python. Made-up data. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };
  var SIDE = 462, COL = 158;
  var N = 24, ROUNDS = 40, RATE_START = 0.5;
  var CHART = { x: SIDE + 2, y: 150, w: COL - 4, h: 70 };

  function r2(v) { return Math.round(v * 100) / 100; }
  function truth(x) { return 5 + 2.6 * Math.sin(x * 0.75) + 0.25 * (x - 5); }
  function makeData(rand) {
    var pts = [];
    for (var i = 0; i < N; i++) {
      var x = 0.3 + 9.4 * (i + 0.15 + 0.7 * rand()) / N;
      pts.push([r2(x), r2(truth(x) + (rand() + rand() + rand() - 1.5) * 2)]);
    }
    return pts;
  }
  // made once, to two decimals, so the page's Python works on exactly the same points
  var TRAIN = makeData(window.InkKit.rng(1096)).sort(function (a, b) { return a[0] - b[0]; });
  var FRESH = makeData(window.InkKit.rng(2096));
  var state = { rate: RATE_START };

  /* what `from page import train, fresh, rate` gives the Python on the same page */
  window.InkPage = window.InkPage || {};
  window.InkPage.train = function () { return TRAIN; };
  window.InkPage.fresh = function () { return FRESH; };
  window.InkPage.rate = function () { return state.rate; };

  /* one cut on x, each side the average miss on its side: the cut whose sides miss their averages least */
  function bestCut(pts, misses) {
    var best = null;
    for (var i = 1; i < pts.length; i++) {
      var l = 0, r = 0, j, left = 0;
      for (j = 0; j < i; j++) l += misses[j];
      for (j = i; j < pts.length; j++) r += misses[j];
      l /= i; r /= pts.length - i;
      for (j = 0; j < pts.length; j++) { var d = misses[j] - (j < i ? l : r); left += d * d; }
      if (!best || left < best.left) best = { left: left, cut: (pts[i - 1][0] + pts[i][0]) / 2, l: l, r: r };
    }
    return best;
  }
  function correction(rule, x) { return x < rule.cut ? rule.l : rule.r; }
  function avg(v) { var s = 0; for (var i = 0; i < v.length; i++) s += v[i]; return s / v.length; }
  /* every round at one fraction: the start, the rules, and both misses after 0, 1, ... ROUNDS rules */
  function boost(rate) {
    var start = avg(TRAIN.map(function (p) { return p[1]; }));
    var g = TRAIN.map(function () { return start; }), h = FRESH.map(function () { return start; });
    function miss(pts, guess) { return avg(pts.map(function (p, i) { return Math.abs(p[1] - guess[i]); })); }
    var out = { start: start, rules: [], used: [miss(TRAIN, g)], fresh: [miss(FRESH, h)] };
    for (var r = 0; r < ROUNDS; r++) {
      var rule = bestCut(TRAIN, TRAIN.map(function (p, i) { return p[1] - g[i]; }));
      g = g.map(function (v, i) { return v + rate * correction(rule, TRAIN[i][0]); });
      h = h.map(function (v, i) { return v + rate * correction(rule, FRESH[i][0]); });
      out.rules.push(rule); out.used.push(miss(TRAIN, g)); out.fresh.push(miss(FRESH, h));
    }
    return out;
  }
  function predict(run, rate, n, x) {
    var v = run.start;
    for (var i = 0; i < n; i++) v += rate * correction(run.rules[i], x);
    return v;
  }

  window.InkKit.define('boost-figure', {
    label: 'Correcting mistakes in rounds: a stepped line built one small correction at a time, with the miss on the points used and on fresh points',
    steps: 1,
    seed: 31,
    draw: function (k) {
      var lo = Infinity, hi = -Infinity;
      TRAIN.concat(FRESH).forEach(function (p) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); });
      var sx = k.scale(0, 10, PLOT.x, PLOT.x + PLOT.w);
      var sy = k.scale(lo - 0.6, hi + 0.6, PLOT.y + PLOT.h, PLOT.y);
      var base = PLOT.y + PLOT.h;

      var run = boost(state.rate), n = 0, busy = false;
      var errTop = Math.max(run.used[0], run.fresh[0]) * 1.1;
      var cx = k.scale(0, ROUNDS, CHART.x, CHART.x + CHART.w), cy = k.scale(0, errTop, CHART.y + CHART.h, CHART.y);

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'x', ylabel: 'height' });

      var below = k.root.layer();
      var marks = k.root.group({ d: 200, stagger: 18 });
      FRESH.forEach(function (p) { marks.mark(sx(p[0]), sy(p[1]), '+', { r: 3, op: 0.42, w: 0.9 }); });
      TRAIN.forEach(function (p) { marks.mark(sx(p[0]), sy(p[1]), 'o', { r: 3.8 }); });
      var live = k.root.layer();

      /* ---- the column beside the plot ---- */
      var rows = k.root.group({ d: 300 });
      rows.text(SIDE, 56, 'corrections', { kind: 'label' });
      var vN = rows.text(SIDE + COL, 56, '', { kind: 'val', anchor: 'end' });
      rows.mark(SIDE + 5, 72, 'o', { r: 3.6 });
      rows.text(SIDE + 16, 76, 'miss, used', { kind: 'label' });
      var vUsed = rows.text(SIDE + COL, 76, '', { kind: 'val', anchor: 'end' });
      rows.mark(SIDE + 5, 92, '+', { r: 3.4 });
      rows.text(SIDE + 16, 96, 'miss, fresh', { kind: 'label' });
      var vFresh = rows.text(SIDE + COL, 96, '', { kind: 'val', anchor: 'end' });
      rows.line(SIDE, 108, SIDE + COL, 108, { w: 0.6, op: 0.45, rough: 0.3 });
      rows.text(SIDE, 132, 'miss by round', { kind: 'label' });
      rows.axes({ x: CHART.x, y: CHART.y, w: CHART.w, h: CHART.h, xticks: [0, 20, 40].map(function (v) { return [cx(v), String(v)]; }) });
      var chart = k.root.layer();

      /* the guess as a stepped line: flat between cuts, a riser at each one */
      function stepped(fn, cuts) {
        var xs = [0].concat(cuts, [10]).sort(function (a, b) { return a - b; }), d = '', first = true;
        for (var i = 0; i < xs.length - 1; i++) {
          if (xs[i + 1] - xs[i] < 1e-9) continue;
          var y = sy(fn((xs[i] + xs[i + 1]) / 2)).toFixed(1);
          d += (first ? 'M' : ' L') + sx(xs[i]).toFixed(1) + ' ' + y + ' L' + sx(xs[i + 1]).toFixed(1) + ' ' + y;
          first = false;
        }
        return d;
      }
      function cutsUpTo(m) { return run.rules.slice(0, m).map(function (r) { return r.cut; }); }

      /* draw the guess after n - 1 corrections plus `t` of the newest one (t = 1 when settled) */
      function paint(t, ghost) {
        var m = n, rate = state.rate;
        function guess(x) {
          var v = predict(run, rate, Math.max(0, m - 1), x);
          return m > 0 ? v + t * rate * correction(run.rules[m - 1], x) : v;
        }
        live.clear(); below.clear();
        // the misses: a thread from each point used to the line
        var d = '';
        TRAIN.forEach(function (p) {
          var y0 = sy(p[1]), y1 = sy(guess(p[0]));
          if (Math.abs(y1 - y0) > 5) d += 'M' + sx(p[0]).toFixed(1) + ' ' + (y0 + (y1 > y0 ? 4 : -4)).toFixed(1) + ' L' + sx(p[0]).toFixed(1) + ' ' + y1.toFixed(1) + ' ';
        });
        if (d) below.path(d, { w: 0.7, op: 0.45 });
        if (m > 0) {
          var rule = run.rules[m - 1], right = sx(rule.cut) > PLOT.x + PLOT.w - 90;
          below.path('M' + sx(rule.cut).toFixed(1) + ' ' + base + ' L' + sx(rule.cut).toFixed(1) + ' ' + (PLOT.y + 18), { w: 0.6, op: 0.35 });
          below.text(sx(rule.cut) + (right ? -6 : 6), PLOT.y + 14, 'newest cut', { kind: 'label', anchor: right ? 'end' : 'start' });
          if (ghost) {
            // the whole correction, as if all of it were added: the line only goes a fraction of the way
            var prev = function (x) { return predict(run, rate, m - 1, x) + correction(rule, x); };
            below.path(stepped(prev, cutsUpTo(m)), { w: 0.9, op: 0.5 });
          }
        }
        live.path(stepped(guess, cutsUpTo(m)), { w: 1.7, op: 0.95, accent: true });
        if (m === 0) live.text(sx(5.4), sy(run.start) - 8, 'the average', { kind: 'label' });
      }

      function side() {
        vN.set(String(n));
        vUsed.set(run.used[n].toFixed(2));
        vFresh.set(run.fresh[n].toFixed(2));
        chart.clear();
        var a = [], b = [], best = 0;
        for (var i = 0; i <= n; i++) {
          a.push([cx(i), cy(run.used[i])]); b.push([cx(i), cy(run.fresh[i])]);
          if (run.fresh[i] < run.fresh[best]) best = i;
        }
        if (n > 0) { chart.polyline(a, { w: 0.9, op: 0.6 }); chart.polyline(b, { w: 1.2, op: 0.9 }); }
        chart.mark(a[n][0], a[n][1], 'o', { r: 2.6 });
        chart.mark(b[n][0], b[n][1], '+', { r: 3 });
        if (n > best + 3 && run.fresh[n] > run.fresh[best] * 1.04) {
          chart.text(SIDE, 410, 'best on fresh: round ' + best + '.', { kind: 'hand' });
          chart.text(SIDE, 432, 'since then, it rises.', { kind: 'hand' });
        }
        bOne.node.style.display = bTen.node.style.display = n >= ROUNDS ? 'none' : '';
      }

      /* add `times` corrections; one at a time is slow and shows the whole correction it takes a fraction of */
      function add(times, single) {
        if (times <= 0 || n >= ROUNDS) { busy = false; return; }
        busy = true; n++; side();
        k.animate(single ? 700 : 150, function (t) {
          paint(t, single);
          if (t >= 1) { if (times > 1 && n < ROUNDS) setTimeout(function () { add(times - 1, false); }, 30); else busy = false; }
        });
      }

      /* ---- the controls ---- */
      k.slider({
        x: SIDE, y: 312, w: COL, min: 0.1, max: 1, step: 0.05, value: RATE_START,
        label: 'fraction added',
        format: function (v) { return v.toFixed(2); },
        onChange: function (v) { state.rate = v; run = boost(v); if (!busy) { side(); paint(1, false); } }
      });
      var bOne = k.button(SIDE, 350, 'add one', function () { if (!busy) add(1, true); }, { d: 600 });
      var bTen = k.button(SIDE + COL, 350, 'add 10', function () { if (!busy) add(10, false); }, { d: 650, anchor: 'end' });
      k.button(SIDE, 378, 'start over', function () { if (busy) return; n = 0; side(); paint(1, false); }, { d: 700 });
      k.root.group({ d: 800 }).callout('a', 'each fits what is left', SIDE, 266);

      k.onStep(function () { busy = false; side(); paint(1, false); });
    }
  });
})();
