/* Queue figure — one server, random arrivals, and the line that forms anyway.
   An M/M/1 queue is simulated in the browser: 200,000 customers with exponential gaps between arrivals
   (rate lambda) and exponential service times (rate mu = 1), from one fixed set of seeded draws, so moving
   lambda stretches the same arrivals instead of dealing new ones. The step line is the start of that run
   (its first four hours, then its first day once the slider is out); the averages beside it are taken over
   the whole run and set next to the M/M/1 formulas.
   Steps: 0 the problem (one server, arrivals at random) · 1 the run at rho = 0.5, simulated vs formula ·
          2 a slider for lambda: near rho = 1 the line explodes, at rho >= 1 it never settles ·
          3 the same blow-up as a curve of L against rho, with the current run marked on it.
   Made-up system. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };       // the plot area, in figure pixels
  var SIDE = 462, COL = 158;                         // the column beside the plot
  var MU = 1;                                        // service rate, per minute, fixed
  var LAM_MIN = 0.1, LAM_MAX = 1.1, LAM_CALM = 0.5, LAM_BUSY = 0.9;
  var N_CUST = 200000;                               // customers in one run
  // what the plot shows: minutes across, people up. Four hours while the system is calm, a day once it is not.
  var NEAR = { T: 240, N: 10, xt: [[0, '0'], [60, '60'], [120, '120'], [180, '180'], [240, '240']], xl: 'minutes', yt: [2, 4, 6, 8, 10] };
  var FAR = { T: 1440, N: 60, xt: [[0, '0'], [360, '6'], [720, '12'], [1080, '18'], [1440, '24']], xl: 'hours', yt: [20, 40, 60] };
  var MINI = { x0: SIDE + 20, x1: SIDE + 140, y0: 272, y1: 346, lmax: 25 };

  /* unit-rate exponential draws, made once and shared: gap = A[i] / lambda, service = S[i] / mu */
  var draws = null;
  function getDraws() {
    if (draws) return draws;
    var rand = window.InkKit.rng(1907), A = new Float32Array(N_CUST), S = new Float32Array(N_CUST);
    for (var i = 0; i < N_CUST; i++) { A[i] = -Math.log(1 - rand()); S[i] = -Math.log(1 - rand()); }
    draws = { A: A, S: S };
    return draws;
  }

  /* first come, first served, one server. Returns the long-run averages and the events inside the window. */
  function simulate(lambda) {
    var d = getDraws(), arrive = 0, finish = 0, total = 0, arr = [], dep = [];
    for (var i = 0; i < N_CUST; i++) {
      arrive += d.A[i] / lambda;
      var start = arrive > finish ? arrive : finish;   // wait for the customer in front to leave
      finish = start + d.S[i] / MU;
      total += finish - arrive;                        // this customer's time in the system
      if (arrive <= FAR.T) { arr.push(arrive); dep.push(finish); }
    }
    // the area under "number in the system" is the sum of everyone's time in it
    return { W: total / N_CUST, L: total / finish, arr: arr, dep: dep };
  }

  function show(v) {
    if (v >= 10000) return Math.round(v / 1000) + 'k';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
    if (v >= 100) return v.toFixed(0);
    return v.toFixed(v >= 10 ? 1 : 2);
  }

  window.InkKit.define('queue-figure', {
    label: 'A single-server queue, simulated: the number of customers in the system over the first four hours, ' +
      'with the simulated averages next to the formula values. A slider sets the arrival rate.',
    steps: 4,
    seed: 23,
    draw: function (k) {
      var msx = k.scale(0, 1, MINI.x0, MINI.x1), msy = k.scale(0, MINI.lmax, MINI.y1, MINI.y0);
      var lambda = LAM_CALM, prev = -1, slider = null;
      function r1(v) { return Math.round(v * 10) / 10; }

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h });
      k.root.text(PLOT.x, PLOT.y - 10, 'in the system', { kind: 'label' });
      [[NEAR, [0, 1]], [FAR, [2, 3]]].forEach(function (pair) {
        var v = pair[0], g = k.root.group({ steps: pair[1], d: 100 }), y0 = PLOT.y + PLOT.h;
        v.sx = k.scale(0, v.T, PLOT.x, PLOT.x + PLOT.w);
        v.sy = k.scale(0, v.N, y0, PLOT.y);
        v.xt.forEach(function (t) {
          g.line(v.sx(t[0]), y0, v.sx(t[0]), y0 + 4, { w: 0.6, op: 0.6, rough: 0.2 });
          g.text(v.sx(t[0]), y0 + 16, t[1], { kind: 'axis', anchor: 'middle' });
        });
        g.text(PLOT.x + PLOT.w, y0 + 32, v.xl, { kind: 'label', anchor: 'end' });
        if (pair[1][0] === 0) g = k.root.group({ steps: [1], d: 100 });      // step 0 is a sketch, not a chart
        v.yt.forEach(function (n) {
          g.line(PLOT.x - 4, v.sy(n), PLOT.x, v.sy(n), { w: 0.6, op: 0.6, rough: 0.2 });
          g.text(PLOT.x - 8, v.sy(n) + 3.5, String(n), { kind: 'axis', anchor: 'end' });
        });
      });
      var sx = NEAR.sx;

      /* ---- beside the plot, in every step: the two rates and how busy that makes the server ---- */
      var rates = k.root.group({ d: 200 });
      rates.text(SIDE, 50, 'arrive', { kind: 'label' });
      var lamVal = rates.text(SIDE + COL, 50, '', { kind: 'val', anchor: 'end' });
      rates.text(SIDE, 68, 'serve', { kind: 'label' });
      rates.text(SIDE + COL, 68, 'μ = ' + MU.toFixed(2) + ' / min', { kind: 'val', anchor: 'end' });
      rates.text(SIDE, 86, 'busy', { kind: 'label' });
      var rhoVal = rates.text(SIDE + COL, 86, '', { kind: 'val', anchor: 'end' });
      rates.line(SIDE, 98, SIDE + COL, 98, { w: 0.6, op: 0.45, rough: 0.3 });

      /* ---- step 0: the system itself, and when its customers turn up ---- */
      var g0 = k.root.group({ steps: [0], d: 300, stagger: 60 });
      var QY = 214;
      function arrow(x1, x2) {
        g0.thread([[x1, QY], [x2, QY]]);
        g0.line(x2, QY, x2 - 7, QY - 3.6, { w: 1, rough: 0.3, op: 0.6 });
        g0.line(x2, QY, x2 - 7, QY + 3.6, { w: 1, rough: 0.3, op: 0.6 });
      }
      arrow(66, 140);
      [164, 188, 212, 236].forEach(function (x) { g0.mark(x, QY, 'o', { r: 7 }); });
      g0.circle(298, QY, 25, { w: 1.4, op: 0.9 });
      g0.mark(298, QY, 'o', { r: 7 });
      arrow(334, 412);
      g0.text(103, QY - 14, 'arrive', { kind: 'label', anchor: 'middle' });
      g0.text(200, QY + 28, 'the line', { kind: 'label', anchor: 'middle' });
      g0.text(298, QY + 46, 'one server', { kind: 'label', anchor: 'middle' });
      g0.text(373, QY - 14, 'leave', { kind: 'label', anchor: 'middle' });
      // the arrivals of the real run, as a rug on the time axis: random, so they bunch
      var calm = simulate(LAM_CALM);
      var rug = g0.group({ d: 700, stagger: 5 });
      calm.arr.forEach(function (t) { if (t <= NEAR.T) rug.line(sx(t), PLOT.y + PLOT.h - 2, sx(t), PLOT.y + PLOT.h - 13, { w: 0.6, op: 0.6, rough: 0.2, dur: 200 }); });
      g0.text(PLOT.x + 8, PLOT.y + PLOT.h - 22, 'each tick is one arrival', { kind: 'label', d: 900 });
      g0.callout('a', 'how long is the line?', SIDE, 150, { to: [214, QY - 14], d: 1100 });

      /* ---- steps 1-3: the run ---- */
      var live = k.root.layer({ steps: [1, 2, 3] });
      var side = k.root.group({ steps: [1, 2, 3], d: 300 });
      side.text(SIDE + 106, 116, 'sim', { kind: 'label', anchor: 'end' });
      side.text(SIDE + COL, 116, 'theory', { kind: 'label', anchor: 'end' });
      side.text(SIDE, 134, 'L number', { kind: 'label' });
      var lSim = side.text(SIDE + 104, 134, '', { kind: 'val', anchor: 'end' });
      var lThe = side.text(SIDE + COL - 2, 134, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 152, 'W minutes', { kind: 'label' });
      var wSim = side.text(SIDE + 104, 152, '', { kind: 'val', anchor: 'end' });
      var wThe = side.text(SIDE + COL - 2, 152, '', { kind: 'val', anchor: 'end' });
      var foot = k.root.layer({ steps: [1, 2, 3] });

      /* the step line for the first v.T minutes; the pen lifts where the count leaves the chart */
      function trace(sim, v) {
        var i = 0, j = 0, n = 0, t = 0, on = true, off = false;
        var d = 'M' + r1(v.sx(0)) + ' ' + r1(v.sy(0));
        for (;;) {
          var ta = i < sim.arr.length ? sim.arr[i] : Infinity, td = j < sim.dep.length ? sim.dep[j] : Infinity;
          var tn = Math.min(ta, td, v.T);
          if (n <= v.N) {
            if (!on) { d += 'M' + r1(v.sx(t)) + ' ' + r1(v.sy(n)); on = true; }
            d += 'L' + r1(v.sx(tn)) + ' ' + r1(v.sy(n));
          } else { on = false; off = true; }
          if (tn >= v.T) break;
          if (ta <= td) { n++; i++; } else { n--; j++; }
          t = tn;
          if (on && n <= v.N) d += 'L' + r1(v.sx(t)) + ' ' + r1(v.sy(n));
        }
        return { d: d, off: off };
      }

      function redraw() {
        var st = k.step(), rho = lambda / MU, stable = rho < 1 - 1e-9;
        lamVal.set('λ = ' + lambda.toFixed(2) + ' / min');
        rhoVal.set('ρ = λ/μ = ' + rho.toFixed(2));
        if (st === 0) return;
        var sim = Math.abs(lambda - LAM_CALM) < 1e-9 ? calm : simulate(lambda);
        var v = st === 1 ? NEAR : FAR, tr = trace(sim, v);
        live.clear();
        live.path(tr.d, { w: st === 1 ? 1.3 : 1, op: 0.9 });
        if (stable && sim.L < v.N) {                 // the long-run average, ruled across the run
          live.line(PLOT.x, v.sy(sim.L), PLOT.x + PLOT.w, v.sy(sim.L), st === 3 ? { w: 0.9, rough: 0.3, op: 0.6 } : { accent: true, w: 1.5, rough: 0.3, op: 1 });
        }
        if (tr.off) live.text(PLOT.x + PLOT.w, PLOT.y - 10, 'off the chart ↑', { kind: 'axis', anchor: 'end' });
        lSim.set(show(sim.L)); wSim.set(show(sim.W));
        lThe.set(stable ? show(rho / (1 - rho)) : 'none');
        wThe.set(stable ? show(1 / (MU - lambda)) : 'none');
        foot.clear();
        if (stable) foot.text(SIDE, 170, '200,000 arrivals simulated', { kind: 'axis' });
        else foot.text(SIDE, 170, 'ρ ≥ 1: it never settles', { kind: 'axis', accent: true });
        mini.clear();
        if (st === 3 && stable && sim.L < MINI.lmax) mini.mark(msx(rho), msy(sim.L), 'o', { r: 4.5, accent: true, w: 1.5, op: 1 });
      }

      /* ---- steps 2 and 3: the arrival rate ---- */
      slider = k.slider({
        x: SIDE, y: 216, w: COL, min: LAM_MIN, max: LAM_MAX, step: 0.05, value: LAM_CALM,
        label: 'arrival rate', steps: [2, 3],
        format: function (v) { return 'λ = ' + v.toFixed(2); },
        onChange: function (v) { lambda = v; redraw(); }
      });

      k.root.group({ steps: [1] }).callout('b', 'the average, about ' + calm.L.toFixed(0), SIDE, 216,
        { from: [SIDE - 6, 220], to: [PLOT.x + PLOT.w + 4, NEAR.sy(calm.L) - 3], d: 700 });
      k.root.group({ steps: [2] }).callout('c', 'nearly full: it explodes', SIDE, 256, { d: 400 });

      /* ---- step 3: L against rho, from the formula, with this run's simulated L marked ---- */
      var gm = k.root.group({ steps: [3], d: 300 });
      gm.line(MINI.x0, MINI.y1, MINI.x1 + 6, MINI.y1, { w: 1 });
      gm.line(MINI.x0, MINI.y1, MINI.x0, MINI.y0 - 6, { w: 1 });
      var curve = [];
      for (var r = 0; r / (1 - r) <= MINI.lmax; r += 0.01) curve.push([msx(r), msy(r / (1 - r))]);
      // a clean path does not un-draw with its group, so the curve sits in a layer (which fades with the step)
      k.root.layer({ steps: [3] }).polyline(curve, { w: 1.4, op: 0.85 });
      gm.thread([[msx(1), MINI.y1], [msx(1), MINI.y0 - 6]], { w: 1 });
      [[0, '0'], [0.5, '0.5'], [1, '1']].forEach(function (t) {
        gm.line(msx(t[0]), MINI.y1, msx(t[0]), MINI.y1 + 4, { w: 0.6, op: 0.6, rough: 0.2 });
        gm.text(msx(t[0]), MINI.y1 + 16, t[1], { kind: 'axis', anchor: 'middle' });
      });
      gm.text(SIDE + COL, MINI.y1 + 16, 'ρ', { kind: 'axis', anchor: 'end' });
      [10, 20].forEach(function (n) {
        gm.line(MINI.x0 - 4, msy(n), MINI.x0, msy(n), { w: 0.6, op: 0.6, rough: 0.2 });
        gm.text(MINI.x0 - 7, msy(n) + 3.5, String(n), { kind: 'axis', anchor: 'end' });
      });
      gm.text(MINI.x0 - 7, MINI.y0 - 3, 'L', { kind: 'axis', anchor: 'end' });
      var mini = k.root.layer({ steps: [3] });
      var g3 = k.root.group({ steps: [3], d: 300 });
      g3.callout('d', 'L = ρ / (1 − ρ)', SIDE, 252, { d: 300 });
      g3.text(SIDE, 396, 'a little busier,', { kind: 'hand', d: 700 });
      g3.text(SIDE, 418, 'a lot more line.', { kind: 'hand', d: 1100 });

      k.onStep(function (step) {
        // the first two steps are the calm system; the slider opens on a busy one
        if (step < 2) lambda = LAM_CALM;
        else if (prev < 2) lambda = LAM_BUSY;
        prev = step;
        slider.set(lambda, true);
        redraw();
      });
    }
  });
})();
