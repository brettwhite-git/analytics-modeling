/* Smoothing figure — simple exponential smoothing, worked for real.
   A seeded made-up series (a slowly wandering level plus noise) is smoothed in the browser with
   S_t = alpha x_t + (1 - alpha) S_{t-1}. The line, the weights alpha (1 - alpha)^j, the one-step-ahead error,
   the best alpha for the data on screen and the catch-up count (periods after the jump until the estimate has
   climbed to within 2 of the new level) are all computed from the numbers that are drawn.
   Steps: 0 the problem (noisy observations) · 1 the smoothed line and the weights behind it ·
          2 alpha and noise sliders, with the error at every alpha · 3 the same with a jump in the level.
   Made-up data. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };
  var SIDE = 462, SW = 158;
  var N = 60, Y0 = 22, Y1 = 82;
  var ALPHA0 = 0.3, NOISE0 = 3;
  var JUMP_AT = 36, JUMP = 10, NEAR = 2;             // step 3: the level rises by JUMP from index JUMP_AT

  /* a level that wanders slowly around 50, and one unit-variance noise draw per period */
  function makeSeries(rng) {
    var a = rng(33), b = rng(133), level = [], z = [], l = 50, t;
    function g(r) { return (r() + r() + r() - 1.5) * 2; }
    for (t = 0; t < N; t++) { l = 50 + 0.96 * (l - 50) + g(a); level.push(l); }
    for (t = 0; t < N; t++) z.push(g(b));
    return { level: level, z: z };
  }
  function smooth(x, alpha) {
    var s = [x[0]];
    for (var t = 1; t < x.length; t++) s.push(alpha * x[t] + (1 - alpha) * s[t - 1]);
    return s;
  }
  /* root mean squared one-step-ahead error: the forecast for t + 1 is S_t */
  function stepError(x, alpha) {
    var s = smooth(x, alpha), e = 0;
    for (var t = 1; t < x.length; t++) e += (x[t] - s[t - 1]) * (x[t] - s[t - 1]);
    return Math.sqrt(e / (x.length - 1));
  }

  window.InkKit.define('smoothing-figure', {
    label: 'Exponential smoothing: a noisy series, the smoothed estimate drawn over it, and how alpha changes it',
    steps: 4,
    seed: 5,
    draw: function (k) {
      var sx = k.scale(0, N + 1, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(Y0, Y1, PLOT.y + PLOT.h, PLOT.y);
      var base = makeSeries(k.rng);
      var alpha = ALPHA0, noise = NOISE0;

      function levelAt(i, jump) { return base.level[i] + (jump && i >= JUMP_AT ? JUMP : 0); }
      function series(nz, jump) { return base.level.map(function (l, i) { return levelAt(i, jump) + nz * base.z[i]; }); }
      /* a clean data stroke inside a stepped group. The kit's draw-in rule is `.ik-ink path`, so a bare path
         never un-draws when its step ends; wrapping it in a <g> that carries the class makes the rule apply. */
      function stroke(g, points, o) {
        var p = g.polyline(points, o), w = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        w.setAttribute('class', p.getAttribute('class'));
        w.style.cssText = p.style.cssText;
        p.removeAttribute('class'); p.removeAttribute('style');
        g.node.insertBefore(w, p); w.appendChild(p);
        return w;
      }
      function pts(v) { return v.map(function (y, i) { return [sx(i + 1), sy(k.clamp(y, Y0 + 1, Y1 - 1))]; }); }

      k.root.axes({
        x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'time', ylabel: 'value',
        xticks: [1, 20, 40, 60].map(function (t) { return [sx(t), String(t)]; }),
        yticks: [30, 40, 50, 60, 70].map(function (v) { return [sy(v), String(v)]; })
      });

      /* ---- steps 0 and 1: the observations, fixed ---- */
      var x0 = series(NOISE0, false), p0 = pts(x0);
      var obs = k.root.group({ steps: [0, 1], d: 150, stagger: 14 });
      stroke(obs, p0, { w: 0.6, op: 0.3, d: 0, dur: 900 });
      p0.forEach(function (p) { obs.mark(p[0], p[1], 'o', { r: 3 }); });

      k.root.group({ steps: [0] }).callout('a', 'where is the level?', SIDE, 150, { to: [p0[N - 1][0] + 8, p0[N - 1][1] - 4], d: 1100 });

      /* ---- step 1: the smoothed line, and the weights it puts on the past ---- */
      var g1 = k.root.group({ steps: [1], d: 300 });
      stroke(g1, pts(smooth(x0, ALPHA0)), { w: 1.7, accent: true, dur: 1100 });
      g1.text(SIDE, 46, 'alpha', { kind: 'label' });
      g1.text(SIDE + SW, 46, ALPHA0.toFixed(2), { kind: 'val', anchor: 'end' });
      g1.text(SIDE, 76, 'weight on past x', { kind: 'label' });
      var WB = 196, WS = 320, carried = 0;
      g1.line(SIDE, WB, SIDE + SW, WB, { w: 0.8, rough: 0.3 });
      for (var j = 0; j < 10; j++) {
        var wt = ALPHA0 * Math.pow(1 - ALPHA0, j), bx = SIDE + 2 + j * 15.8, top = WB - wt * WS;
        carried += wt;
        g1.rect(bx, top, 10, WB - top, { w: 0.8, rough: 0.4, d: 500 + j * 60 });
        if (WB - top > 6) g1.hatch([[bx, top], [bx + 10, top], [bx + 10, WB], [bx, WB]], { op: 0.5, gap: 3.5, d: 560 + j * 60 });
        if (j === 0) g1.text(bx + 14, top + 8, wt.toFixed(2), { kind: 'val', d: 600 });
        if (j % 3 === 0) g1.text(bx + 5, WB + 15, j ? 't−' + j : 't', { kind: 'axis', anchor: 'middle' });
      }
      g1.text(SIDE, 238, 'weight = α(1 − α)^j', { kind: 'code' });
      g1.text(SIDE, 268, 'last 10 carry', { kind: 'label' });
      g1.text(SIDE + SW, 268, Math.round(carried * 100) + '%', { kind: 'val', anchor: 'end' });
      g1.callout('b', 'recent counts most', SIDE, 310, { d: 1200 });

      /* ---- steps 2 and 3: everything recomputed as the sliders move ---- */
      [false, true].forEach(function (jump) {
        var g = k.root.group({ steps: [jump ? 3 : 2], d: 200 });
        g.thread(base.level.map(function (l, i) { return [sx(i + 1), sy(levelAt(i, jump))]; }), { w: 1.1, op: 0.6 });
        g.thread([[PLOT.x + 12, PLOT.y + PLOT.h - 16], [PLOT.x + 40, PLOT.y + PLOT.h - 16]], { w: 1.1, op: 0.6 });
        g.text(PLOT.x + 47, PLOT.y + PLOT.h - 12.5, 'the level it was built from', { kind: 'axis' });
        if (jump) {
          g.line(sx(JUMP_AT + 0.5), PLOT.y + 14, sx(JUMP_AT + 0.5), PLOT.y + PLOT.h, { w: 0.6, op: 0.4, rough: 0.2 });
          g.text(sx(JUMP_AT + 0.5), PLOT.y + 9, 'the level jumps', { kind: 'axis', anchor: 'middle' });
        }
      });
      var obsLive = k.root.layer({ steps: [2, 3] });
      var lineLive = k.root.layer({ steps: [2, 3] });

      var side = k.root.group({ steps: [2, 3], d: 300 });
      side.text(SIDE, 78, 'steady', { kind: 'axis' });
      side.text(SIDE + SW, 78, 'reactive', { kind: 'axis', anchor: 'end' });
      side.text(SIDE, 140, 'calm', { kind: 'axis' });
      side.text(SIDE + SW, 140, 'noisy', { kind: 'axis', anchor: 'end' });
      side.line(SIDE, 153, SIDE + SW, 153, { w: 0.6, op: 0.45, rough: 0.3 });
      side.text(SIDE, 174, '1-step error', { kind: 'label' });
      var errVal = side.text(SIDE + SW, 174, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 194, 'best alpha here', { kind: 'label' });
      var bestVal = side.text(SIDE + SW, 194, '', { kind: 'val', anchor: 'end' });
      var g3 = k.root.group({ steps: [3], d: 300 });
      g3.text(SIDE, 214, 'catch-up periods', { kind: 'label' });
      var catchVal = g3.text(SIDE + SW, 214, '', { kind: 'val', anchor: 'end' });

      /* the error at every alpha, as a small curve */
      var CX = SIDE + 4, CW = SW - 8, CT = 252, CB = 306;
      side.text(SIDE, 240, 'error at each alpha', { kind: 'label' });
      side.line(SIDE, CB + 6, SIDE + SW, CB + 6, { w: 0.8, rough: 0.3 });
      side.text(CX, CB + 20, '0', { kind: 'axis', anchor: 'middle' });
      side.text(CX + CW, CB + 20, '1', { kind: 'axis', anchor: 'middle' });
      var curveLive = k.root.layer({ steps: [2, 3] });
      var dotLive = k.root.layer({ steps: [2, 3] });
      var x = x0, grid = [], lo = 0, hi = 1, best = ALPHA0;
      function cx(a) { return CX + a * CW; }
      function cy(e) { return CB - (e - lo) / ((hi - lo) || 1) * (CB - CT); }

      function redrawLine() {
        var s = smooth(x, alpha), jump = k.step() === 3;
        lineLive.clear();
        lineLive.polyline(pts(s), { w: 1.7, accent: true });
        dotLive.clear();
        var e = stepError(x, alpha);
        dotLive.line(cx(alpha), CB + 6, cx(alpha), cy(e) + 5, { w: 0.6, op: 0.5, rough: 0.2 });
        dotLive.circle(cx(alpha), cy(e), 4, { w: 1.3 });
        errVal.set(e.toFixed(2));
        bestVal.set(best.toFixed(2));
        if (jump) {
          var n = -1;
          for (var i = JUMP_AT; i < N; i++) if (s[i] >= levelAt(i, true) - NEAR) { n = i - JUMP_AT + 1; break; }
          catchVal.set(n < 0 ? 'never' : String(n));
        }
      }
      function redrawData() {
        x = series(noise, k.step() === 3);
        var p = pts(x);
        obsLive.clear();
        obsLive.polyline(p, { w: 0.6, op: 0.3 });
        p.forEach(function (q) { obsLive.mark(q[0], q[1], 'o', { r: 3 }); });
        grid = []; lo = Infinity; hi = -Infinity;
        for (var a = 0.02; a < 1.001; a += 0.02) {
          var e = stepError(x, a);
          grid.push([a, e]);
          if (e < lo) { lo = e; best = a; }
          if (e > hi) hi = e;
        }
        curveLive.clear();
        curveLive.polyline(grid.map(function (g) { return [cx(g[0]), cy(g[1])]; }), { w: 1.1 });
        curveLive.line(cx(best), CB + 2, cx(best), CB + 10, { w: 1.1, rough: 0.2 });
        curveLive.text(cx(best), CB + 34, 'best', { kind: 'axis', anchor: 'middle' });
        redrawLine();
      }

      k.slider({
        x: SIDE, y: 60, w: SW, min: 0.02, max: 1, step: 0.02, value: ALPHA0, label: 'alpha', steps: [2, 3],
        format: function (v) { return v.toFixed(2); },
        onChange: function (v) { alpha = v; redrawLine(); }
      });
      k.slider({
        x: SIDE, y: 122, w: SW, min: 0.5, max: 6, step: 0.25, value: NOISE0, label: 'noise', steps: [2, 3],
        format: function (v) { return v.toFixed(2); },
        onChange: function (v) { noise = v; redrawData(); }
      });

      k.root.group({ steps: [2] }).callout('c', 'more noise, lower alpha', SIDE, 372, { d: 400 });
      g3.callout('d', 'a jump: best alpha rises', SIDE, 362, { d: 300 });
      g3.text(SIDE, 394, 'high alpha reacts,', { kind: 'hand', d: 700 });
      g3.text(SIDE, 414, 'low alpha smooths.', { kind: 'hand', d: 1100 });

      k.onStep(function (step) { if (step >= 2) redrawData(); });
    }
  });
})();
