/* Boosting figure — gradient boosting on one variable, worked for real.
   F0 is the mean of the training points. Each round fits a stump (one split, two levels, the split that
   leaves the least squared error) to the current residuals and adds gamma times it to the model.
   Training and held-out error (RMSE) are computed from the same model that is drawn; the held-out points
   come from the same made-up curve with fresh seeded noise.
   Steps: 0 the mean and what it leaves over · 1 the first stump, and the shrunken copy that is added ·
          2 add trees, slide the learning rate, watch both errors.
   Made-up data. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };
  var SIDE = 462, COL = 158;
  var N = 24, NOISE = 1, ROUNDS = 40;
  var RATE_START = 0.5;
  var CHART = { x: SIDE + 2, y: 152, w: COL - 4, h: 76 };

  function truth(x) { return 5 + 2.6 * Math.sin(x * 0.75) + 0.25 * (x - 5); }
  function makeData(rand) {
    var pts = [];
    for (var i = 0; i < N; i++) {
      var x = 0.3 + 9.4 * (i + 0.15 + 0.7 * rand()) / N;
      pts.push({ x: x, y: truth(x) + NOISE * (rand() + rand() + rand() - 1.5) * 2 });
    }
    return pts;
  }

  /* the one split of x that leaves the least squared error in `res`, with the mean of each side */
  function fitStump(pts, res) {
    var n = pts.length, total = 0, left = 0, best = null, i;
    for (i = 0; i < n; i++) total += res[i];
    for (i = 0; i < n - 1; i++) {                       // pts are sorted by x
      left += res[i];
      var nl = i + 1, nr = n - nl, right = total - left;
      var gain = left * left / nl + right * right / nr;
      if (!best || gain > best.gain) best = { gain: gain, s: (pts[i].x + pts[i + 1].x) / 2, l: left / nl, r: right / nr };
    }
    return best;
  }
  function rmse(pts, pred) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) s += (pts[i].y - pred[i]) * (pts[i].y - pred[i]);
    return Math.sqrt(s / pts.length);
  }
  /* run every round at one learning rate: the stumps, and both errors after 0, 1, ... ROUNDS trees */
  function boost(train, held, rate) {
    var mean = 0, i, r;
    for (i = 0; i < train.length; i++) mean += train[i].y / train.length;
    var f = train.map(function () { return mean; }), g = held.map(function () { return mean; });
    var out = { mean: mean, stumps: [], train: [rmse(train, f)], held: [rmse(held, g)] };
    for (r = 0; r < ROUNDS; r++) {
      var st = fitStump(train, train.map(function (p, j) { return p.y - f[j]; }));
      for (i = 0; i < train.length; i++) f[i] += rate * (train[i].x < st.s ? st.l : st.r);
      for (i = 0; i < held.length; i++) g[i] += rate * (held[i].x < st.s ? st.l : st.r);
      out.stumps.push(st); out.train.push(rmse(train, f)); out.held.push(rmse(held, g));
    }
    return out;
  }
  function predict(run, rate, trees, x, fullLast) {
    var v = run.mean;
    for (var i = 0; i < trees; i++) v += (fullLast && i === trees - 1 ? 1 : rate) * (x < run.stumps[i].s ? run.stumps[i].l : run.stumps[i].r);
    return v;
  }

  window.InkKit.define('boost-figure', {
    label: 'Gradient boosting: a step function built one small tree at a time, with training and held-out error',
    steps: 3,
    seed: 31,
    draw: function (k) {
      var train = makeData(k.rng(1096)).sort(function (a, b) { return a.x - b.x; });
      var held = makeData(k.rng(2096));
      var lo = Infinity, hi = -Infinity;
      train.concat(held).forEach(function (p) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); });
      var sx = k.scale(0, 10, PLOT.x, PLOT.x + PLOT.w);
      var sy = k.scale(lo - 0.6, hi + 0.6, PLOT.y + PLOT.h, PLOT.y);
      var base = PLOT.y + PLOT.h;

      var rate = RATE_START, trees = 1;                  // the live values of step 2
      var first = boost(train, held, RATE_START);       // steps 0 and 1 always show the starting rate
      var run = first;
      var errTop = Math.max(run.train[0], run.held[0]) * 1.08;
      var cx = k.scale(0, ROUNDS, CHART.x, CHART.x + CHART.w), cy = k.scale(0, errTop, CHART.y + CHART.h, CHART.y);

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'x', ylabel: 'y' });

      var live = k.root.layer();
      var marks = k.root.group({ d: 200, stagger: 18 });
      held.forEach(function (p) { marks.mark(sx(p.x), sy(p.y), '+', { r: 3, op: 0.42, w: 0.9 }); });
      train.forEach(function (p) { marks.mark(sx(p.x), sy(p.y), 'o', { r: 3.8 }); });

      /* ---- the column beside the plot ---- */
      var rows = k.root.group({ d: 300 });
      rows.text(SIDE, 56, 'trees', { kind: 'label' });
      var treesVal = rows.text(SIDE + COL, 56, '', { kind: 'val', anchor: 'end' });
      rows.mark(SIDE + 5, 72, 'o', { r: 3.6 });
      rows.text(SIDE + 16, 76, 'train error', { kind: 'label' });
      var trainVal = rows.text(SIDE + COL, 76, '', { kind: 'val', anchor: 'end' });
      rows.mark(SIDE + 5, 92, '+', { r: 3.4 });
      rows.text(SIDE + 16, 96, 'held-out error', { kind: 'label' });
      var heldVal = rows.text(SIDE + COL, 96, '', { kind: 'val', anchor: 'end' });
      rows.line(SIDE, 108, SIDE + COL, 108, { w: 0.6, op: 0.45, rough: 0.3 });

      var chart = k.root.group({ steps: [2], d: 400 });
      chart.text(SIDE, 128, 'best round so far', { kind: 'label' });
      var bestVal = chart.text(SIDE + COL, 128, '', { kind: 'val', anchor: 'end' });
      chart.axes({
        x: CHART.x, y: CHART.y, w: CHART.w, h: CHART.h,
        xticks: [0, 20, 40].map(function (v) { return [cx(v), String(v)]; })
      });
      chart.text(SIDE + COL, CHART.y + 6, 'error by round', { kind: 'axis', anchor: 'end' });
      var chartLive = k.root.layer({ steps: [2] });

      function view() {
        var step = k.step();
        return step === 2 ? { step: 2, trees: trees, run: run, rate: rate } : { step: step, trees: step, run: first, rate: RATE_START };
      }
      /* the model as a step function: flat between splits, a riser at each one */
      function stepPath(run, rate, nTrees, fullLast) {
        var cuts = [0];
        for (var i = 0; i < nTrees; i++) cuts.push(run.stumps[i].s);
        cuts.push(10);
        cuts.sort(function (a, b) { return a - b; });
        var d = '', first = true;
        for (i = 0; i < cuts.length - 1; i++) {
          if (cuts[i + 1] - cuts[i] < 1e-9) continue;
          var y = sy(predict(run, rate, nTrees, (cuts[i] + cuts[i + 1]) / 2, fullLast)).toFixed(1);
          d += (first ? 'M' : ' L') + sx(cuts[i]).toFixed(1) + ' ' + y + ' L' + sx(cuts[i + 1]).toFixed(1) + ' ' + y;
          first = false;
        }
        return d;
      }

      function redraw() {
        var v = view(), t = v.trees, run = v.run, rate = v.rate;
        live.clear();
        // what is left over: each training point to the model
        train.forEach(function (p) {
          var f = predict(run, rate, t, p.x);
          if (Math.abs(sy(f) - sy(p.y)) > 5) live.line(sx(p.x), sy(p.y) + (f < p.y ? 4 : -4), sx(p.x), sy(f), { w: 0.6, op: 0.45, rough: 0.2 });
        });
        if (t > 0) {
          var cut = run.stumps[t - 1].s, right = sx(cut) > PLOT.x + PLOT.w - 80;
          live.line(sx(cut), base, sx(cut), PLOT.y + 4, { w: 0.6, op: 0.35, rough: 0.2 });
          live.text(sx(cut) + (right ? -6 : 6), PLOT.y + 12, t === 1 ? 'split' : 'newest split', { kind: 'label', anchor: right ? 'end' : 'start' });
        }
        if (v.step === 1) live.path(stepPath(run, rate, 1, true), { w: 0.9, op: 0.55 });   // the whole first stump
        live.path(stepPath(run, rate, t, false), { w: 1.7, op: 0.95, accent: true });
        if (v.step === 0) live.text(PLOT.x + PLOT.w - 4, sy(run.mean) - 7, 'the mean', { kind: 'label', anchor: 'end' });

        treesVal.set(String(t));
        trainVal.set(run.train[t].toFixed(2));
        heldVal.set(run.held[t].toFixed(2));

        chartLive.clear();
        if (v.step !== 2) return;
        var best = 0, i, a = [], b = [];
        for (i = 0; i <= t; i++) {
          if (run.held[i] < run.held[best]) best = i;
          a.push([cx(i), cy(run.train[i])]); b.push([cx(i), cy(run.held[i])]);
        }
        bestVal.set(String(best));
        chartLive.line(cx(best), CHART.y + CHART.h, cx(best), cy(run.held[best]) + 5, { w: 0.6, op: 0.45, rough: 0.2 });
        if (t > 0) {
          chartLive.polyline(a, { w: 0.9, op: 0.6 });
          chartLive.polyline(b, { w: 1.2, op: 0.9 });
        }
        chartLive.mark(a[t][0], a[t][1], 'o', { r: 2.8 });
        chartLive.mark(b[t][0], b[t][1], '+', { r: 3.2 });
        if (t > best + 2 && run.held[t] > run.held[best] * 1.03) {
          chartLive.text(SIDE, 412, 'past round ' + best + ' it only', { kind: 'hand' });
          chartLive.text(SIDE, 434, 'fits the training set.', { kind: 'hand' });
        }
      }

      /* ---- step 2: the controls ---- */
      k.slider({
        x: SIDE, y: 316, w: COL, min: 0.1, max: 1, step: 0.05, value: RATE_START,
        label: 'learning rate', steps: [2],
        format: function (v) { return v.toFixed(2); },
        onChange: function (v) { rate = v; run = boost(train, held, rate); redraw(); }
      });
      var add = k.button(SIDE, 352, 'add a tree', function () { grow(1); }, { steps: [2], d: 600 });
      k.button(SIDE + COL, 352, 'add 10', function () { grow(10); }, { steps: [2], d: 650, anchor: 'end' });
      k.button(SIDE, 380, 'start over', function () { trees = 0; add.set('add a tree'); redraw(); }, { steps: [2], d: 700 });
      function grow(m) {
        if (trees >= ROUNDS) return;
        trees = Math.min(ROUNDS, trees + m);
        add.set(trees >= ROUNDS ? '40 trees' : 'add a tree');
        redraw();
      }

      /* ---- the lettered notes ---- */
      k.root.group({ steps: [0] }).callout('a', 'what the mean leaves over', SIDE, 150,
        { to: [sx(train[N - 1].x) + 7, (sy(train[N - 1].y) + sy(first.mean)) / 2], d: 700 });
      var st1 = first.stumps[0], mid = (st1.s + 10) / 2;
      k.root.group({ steps: [1] }).callout('b', 'add half of the stump', SIDE, 150,
        { to: [sx(mid) + 6, sy(first.mean + RATE_START * st1.r) - 5], d: 700 });
      k.root.group({ steps: [2] }).callout('c', 'each tree fits what is left', SIDE, 274, { d: 300 });

      k.onStep(function () { redraw(); });
    }
  });
})();
