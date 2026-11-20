/* CUSUM figure — a small shift in a noisy series, and the running score that catches it.
   Top plot: 100 seeded measurements whose mean moves up after t = 60. Bottom plot, same time axis: the CUSUM
   statistic S_t = max(0, S_{t-1} + (x_t - mu) - C), computed from exactly those measurements, against the
   threshold T. The detection time, the delay and the false alarms are counted from the drawn curve; the score
   restarts at zero after each false alarm.
   Steps: 0 the problem (series only) · 1 the running score and its first crossing · 2 C and T (sliders)
          · 3 the size of the shift (slider).
   Made-up data. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var X0 = 44, PW = 392;                             // both plots share the time axis
  var TOP = { y: 34, h: 142 };                       // the measurements
  var BOT = { y: 228, h: 178 };                      // the CUSUM statistic
  var SIDE = 462;                                    // left edge of the column beside the plots
  var N = 100, CHANGE = 60;                          // the mean moves after t = 60
  var MU = 10, SD = 0.3;
  var XLO = 9.1, XHI = 11.5;                         // measurement axis
  var SMAX = 6;                                      // score axis; a taller curve runs off the top
  var C_START = 0.15, T_START = 2, SHIFT_START = 0.3;

  /* N standard normal draws (Box-Muller) from the kit's seeded generator */
  function makeNoise(rand) {
    var z = [];
    for (var i = 0; i < N; i++) {
      var u = Math.max(rand(), 1e-9), v = rand();
      z.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
    }
    return z;
  }

  /* the series and its CUSUM. An alarm before the change is a false alarm: it is counted and the score starts
     again from zero, as it would after an investigation that found nothing. The first alarm after the change
     is the detection; from there the score is left to run. */
  function cusum(z, shift, C, T) {
    var x = [], S = [], s = 0, falseAlarms = [], detected = null;
    for (var t = 1; t <= N; t++) {
      var xt = MU + SD * z[t - 1] + (t > CHANGE ? shift : 0);
      s = Math.max(0, s + (xt - MU) - C);
      x.push(xt); S.push(s);
      if (s > T) {
        if (t <= CHANGE) { falseAlarms.push(t); s = 0; }
        else if (detected === null) detected = t;
      }
    }
    return { x: x, S: S, falseAlarms: falseAlarms, detected: detected };
  }

  window.InkKit.define('cusum-figure', {
    label: 'CUSUM change detection: a noisy series whose mean shifts, and below it the running score against a threshold',
    steps: 4,
    seed: 5,
    draw: function (k) {
      var tx = k.scale(0, N, X0, X0 + PW);
      var yx = k.scale(XLO, XHI, TOP.y + TOP.h, TOP.y);
      var ys = k.scale(0, SMAX, BOT.y + BOT.h, BOT.y);
      var z = makeNoise(k.rng(42));
      var C = C_START, T = T_START, shift = SHIFT_START;

      k.root.axes({
        x: X0, y: TOP.y, w: PW, h: TOP.h, ylabel: 'measurement',
        yticks: [9.5, 10, 10.5, 11].map(function (v) { return [yx(v), String(v)]; })
      });
      k.root.axes({
        x: X0, y: BOT.y, w: PW, h: BOT.h, xlabel: 'time', ylabel: 'running score Sₜ',
        xticks: [0, 20, 40, 60, 80, 100].map(function (v) { return [tx(v), String(v)]; }),
        yticks: [0, 2, 4, 6].map(function (v) { return [ys(v), String(v)]; })
      });
      // the mean the process is supposed to hold
      k.root.line(X0, yx(MU), X0 + PW, yx(MU), { w: 0.6, op: 0.5, rough: 0.3 });
      k.root.text(X0 + PW + 6, yx(MU) + 5, 'μ', { kind: 'math' });

      /* ---- step 0: only the measurements ---- */
      k.root.group({ steps: [0] }).callout('a', 'did the mean move?', SIDE, 110, { d: 900 });

      /* ---- steps 1-3: where the mean really moved (the figure knows; the method does not) ---- */
      var truth = k.root.group({ steps: [1, 2, 3], d: 200 });
      var cx = tx(CHANGE + 0.5);
      truth.thread([[cx, TOP.y - 4], [cx, BOT.y + BOT.h]]);
      truth.text(cx, TOP.y - 10, 'true change', { kind: 'label', anchor: 'middle' });

      var side = k.root.group({ steps: [1, 2, 3], d: 300 });
      var rows = ['true change', 'detected', 'delay', 'false alarms'].map(function (name, i) {
        side.text(SIDE, 60 + i * 20, name, { kind: 'label' });
        return side.text(SIDE + 158, 60 + i * 20, '', { kind: 'val', anchor: 'end' });
      });
      side.line(SIDE, 132, SIDE + 158, 132, { w: 0.6, op: 0.45, rough: 0.3 });

      /* ---- the live drawing: series above, score below ---- */
      var series = k.root.layer();
      var live = k.root.layer({ steps: [1, 2, 3] });

      function redraw() {
        var m = cusum(z, shift, C, T), i;
        var step = k.step();

        series.clear();
        series.polyline(m.x.map(function (v, j) { return [tx(j + 1), yx(v)]; }), { w: 0.6, op: 0.3 });
        for (i = 0; i < N; i++) series.dot(tx(i + 1), yx(m.x[i]), 1.6, { op: 0.8 });
        if (step === 3 && shift > 0) {
          series.line(cx, yx(MU + shift), X0 + PW, yx(MU + shift), { w: 1.1, op: 0.75, rough: 0.3 });
        }
        if (step === 0) return;

        live.clear();
        // hatch under the curve, cut off at the top of the plot
        var under = [[tx(1), ys(0)]];
        for (i = 0; i < N; i++) under.push([tx(i + 1), ys(Math.min(m.S[i], SMAX))]);
        under.push([tx(N), ys(0)]);
        live.hatch(under, { op: 0.28, gap: 4.5 });

        // the curve itself, in pieces where it leaves the plot
        var piece = [];
        function flush() { if (piece.length > 1) live.polyline(piece, { w: 1.6, op: 0.9 }); piece = []; }
        for (i = 0; i < N; i++) {
          var s = m.S[i], inside = s <= SMAX;
          if (i > 0) {
            var p = m.S[i - 1], wasInside = p <= SMAX;
            if (inside !== wasInside) {
              var f = (SMAX - p) / (s - p);
              piece.push([tx(i + f), ys(SMAX)]);
              if (!inside) flush();
            }
          }
          if (inside) piece.push([tx(i + 1), ys(s)]);
        }
        flush();

        // the threshold
        live.line(X0, ys(T), X0 + PW, ys(T), { w: 1.1, op: 0.75, rough: 0.3 });
        live.text(X0 + PW + 6, ys(T) + 5, 'T', { kind: 'math' });

        // false alarms: the score went over T while nothing had changed (it restarts from zero after each)
        m.falseAlarms.forEach(function (t) { live.mark(tx(t), ys(Math.min(m.S[t - 1], SMAX)), 'x', { r: 4.5, w: 1.3 }); });

        // the detection: first time after the change with S over T
        if (m.detected !== null) {
          var dx = tx(m.detected), dy = ys(Math.min(m.S[m.detected - 1], SMAX));
          live.line(dx, BOT.y, dx, BOT.y + BOT.h, { accent: true, w: 1.3, op: 0.9, rough: 0.3 });
          live.circle(dx, dy, 5.5, { accent: true, w: 1.3, op: 0.95 });
        }

        rows[0].set('t = ' + CHANGE);
        rows[1].set(m.detected === null ? 'never' : 't = ' + m.detected);
        rows[2].set(m.detected === null ? '—' : String(m.detected - CHANGE));
        rows[3].set(String(m.falseAlarms.length));
      }

      /* ---- steps 2 and 3: the two knobs ---- */
      k.slider({
        x: SIDE, y: 176, w: 158, min: 0, max: 0.4, step: 0.01, value: C_START,
        label: 'C  allowance', steps: [2, 3],
        format: function (v) { return v.toFixed(2); },
        onChange: function (v) { C = v; redraw(); }
      });
      k.slider({
        x: SIDE, y: 226, w: 158, min: 0.5, max: 5, step: 0.1, value: T_START,
        label: 'T  threshold', steps: [2, 3],
        format: function (v) { return v.toFixed(1); },
        onChange: function (v) { T = v; redraw(); }
      });
      /* ---- step 3: how far the mean moved ---- */
      k.slider({
        x: SIDE, y: 276, w: 158, min: 0, max: 0.6, step: 0.02, value: SHIFT_START,
        label: 'shift in mean', steps: [3],
        format: function (v) { return v.toFixed(2); },
        onChange: function (v) { shift = v; redraw(); }
      });

      k.root.group({ steps: [1] }).callout('b', 'the score crosses T', SIDE, 170, { d: 700 });
      k.root.group({ steps: [2] }).callout('c', 'faster, or fewer alarms', SIDE, 270, { d: 400 });
      var g3 = k.root.group({ steps: [3], d: 300 });
      g3.callout('d', 'change the shift', SIDE, 320, { d: 300 });
      g3.text(SIDE, 352, 'small shifts take', { kind: 'hand', d: 700 });
      g3.text(SIDE, 374, 'longer to catch.', { kind: 'hand', d: 1100 });

      k.onStep(redraw);
    }
  });
})();
