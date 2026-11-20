/* Season figure — one series with a trend and a 12-period cycle, forecast three ways.
   The first 48 points are smoothed in the browser and the last 12 are held out, so each forecast can be scored
   against what really came next. Simple smoothing, Holt (level + trend) and multiplicative Holt-Winters
   (level + trend + seasonal factors) are all computed with the update equations in the essay; the forecast
   error, level, trend and seasonal factors shown are the numbers that are drawn.
   Steps: 0 simple smoothing forecasts flat · 1 Holt adds the slope · 2 Holt-Winters adds the cycle (gamma slider).
   Made-up data. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };
  var SIDE = 462, SW = 158;
  var N = 60, FIT = 48, L = 12, Y0 = 10, Y1 = 100;
  var ALPHA = 0.2, BETA = 0.05, GAMMA0 = 0.3;

  function makeSeries(rng) {
    var r = rng(21), x = [], shape = [], mean = 0, m, t;
    for (m = 0; m < L; m++) { shape.push(1 + 0.24 * Math.sin(2 * Math.PI * (m - 4) / L) + 0.1 * Math.sin(4 * Math.PI * (m - 4) / L + 1)); mean += shape[m] / L; }
    for (t = 0; t < N; t++) x.push((30 + 0.55 * (t + 1)) * shape[t % L] / mean * (1 + 0.035 * (r() + r() + r() - 1.5) * 2));
    return x;
  }

  /* each returns { level: [...], trend, forecast(h), factors } fitted on x[0 .. FIT-1] */
  function simple(x) {
    var s = [x[0]], t;
    for (t = 1; t < FIT; t++) s.push(ALPHA * x[t] + (1 - ALPHA) * s[t - 1]);
    return { level: s, trend: null, forecast: function () { return s[FIT - 1]; } };
  }
  function holt(x) {
    var s = [x[0]], tr = 0, t, prev;
    for (t = 1; t < FIT; t++) {
      prev = s[t - 1];
      s.push(ALPHA * x[t] + (1 - ALPHA) * (prev + tr));
      tr = BETA * (s[t] - prev) + (1 - BETA) * tr;
    }
    return { level: s, trend: tr, forecast: function (h) { return s[FIT - 1] + h * tr; } };
  }
  function holtWinters(x, gamma) {
    var m1 = 0, m2 = 0, c = [], s = [], tr, t, prev, i;
    for (i = 0; i < L; i++) { m1 += x[i] / L; m2 += x[i + L] / L; }
    for (i = 0; i < L; i++) { c.push(x[i] / m1); s.push(null); }
    s[L - 1] = m1; tr = (m2 - m1) / L;
    for (t = L; t < FIT; t++) {
      prev = s[t - 1];
      s.push(ALPHA * x[t] / c[t - L] + (1 - ALPHA) * (prev + tr));
      tr = BETA * (s[t] - prev) + (1 - BETA) * tr;
      c.push(gamma * x[t] / s[t] + (1 - gamma) * c[t - L]);
    }
    return {
      level: s, trend: tr, factors: c.slice(FIT - L),
      forecast: function (h) { return (s[FIT - 1] + h * tr) * c[FIT - L + (h - 1) % L]; }
    };
  }

  window.InkKit.define('season-figure', {
    label: 'A series with a trend and a seasonal cycle, forecast by simple smoothing, by Holt and by Holt-Winters',
    steps: 3,
    seed: 9,
    draw: function (k) {
      var sx = k.scale(0, N + 1, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(Y0, Y1, PLOT.y + PLOT.h, PLOT.y);
      var x = makeSeries(k.rng), gamma = GAMMA0;
      function P(t, v) { return [sx(t + 1), sy(k.clamp(v, Y0 + 1, Y1 - 1))]; }

      k.root.axes({
        x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'time', ylabel: 'value',
        xticks: [12, 24, 36, 48, 60].map(function (t) { return [sx(t), String(t)]; }),
        yticks: [20, 40, 60, 80].map(function (v) { return [sy(v), String(v)]; })
      });

      /* ---- the data: 48 points seen, 12 held out ---- */
      var marks = k.root.group({ d: 150, stagger: 14 });
      var seen = x.slice(0, FIT).map(function (v, t) { return P(t, v); });
      // the kit's draw-in rule is `.ik-ink path`, so a bare path needs a <g> carrying its class to be drawn in
      (function (p) {
        var w = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        w.setAttribute('class', p.getAttribute('class')); w.style.cssText = p.style.cssText;
        p.removeAttribute('class'); p.removeAttribute('style');
        marks.node.insertBefore(w, p); w.appendChild(p);
      })(marks.polyline(seen, { w: 0.6, op: 0.3, d: 0, dur: 900 }));
      seen.forEach(function (p) { marks.mark(p[0], p[1], 'o', { r: 3 }); });
      x.slice(FIT).forEach(function (v, i) { var p = P(FIT + i, v); marks.mark(p[0], p[1], '+', { r: 3.5, op: 0.6 }); });
      var xNow = sx(FIT + 0.5);
      k.root.line(xNow, PLOT.y + 14, xNow, PLOT.y + PLOT.h, { w: 0.6, op: 0.4, rough: 0.2 });
      k.root.text(xNow - 6, PLOT.y + 9, 'seen', { kind: 'axis', anchor: 'end' });
      k.root.text(xNow + 6, PLOT.y + 9, 'held out', { kind: 'axis' });

      k.root.line(PLOT.x + 170, PLOT.y + PLOT.h - 16, PLOT.x + 198, PLOT.y + PLOT.h - 16, { w: 1.1, op: 0.85, rough: 0.3 });
      k.root.text(PLOT.x + 205, PLOT.y + PLOT.h - 12.5, 'the level, S', { kind: 'axis' });

      /* ---- readouts ---- */
      k.root.text(SIDE, 46, 'forecast error', { kind: 'label' });
      var errVal = k.root.text(SIDE + SW, 46, '', { kind: 'val', anchor: 'end' });
      k.root.text(SIDE, 66, 'level', { kind: 'label' });
      var levelVal = k.root.text(SIDE + SW, 66, '', { kind: 'val', anchor: 'end' });
      k.root.text(SIDE, 86, 'trend per period', { kind: 'label' });
      var trendVal = k.root.text(SIDE + SW, 86, '', { kind: 'val', anchor: 'end' });
      k.root.line(SIDE, 98, SIDE + SW, 98, { w: 0.6, op: 0.45, rough: 0.3 });

      var live = k.root.layer();
      var bars = k.root.layer({ steps: [2] });
      var BASE = 252, BS = 110;                       // the line where a factor is 1, and pixels per 1.0
      var g2 = k.root.group({ steps: [2], d: 300 });
      g2.text(SIDE, 158, 'steady', { kind: 'axis' });
      g2.text(SIDE + SW, 158, 'reactive', { kind: 'axis', anchor: 'end' });
      g2.text(SIDE, 192, 'seasonal factors', { kind: 'label' });
      g2.line(SIDE, BASE, SIDE + SW, BASE, { w: 0.8, rough: 0.3 });
      g2.text(SIDE + 6, BASE + 52, '1', { kind: 'axis', anchor: 'middle' });
      g2.text(SIDE + 6 + 11 * 13.2, BASE + 52, '12', { kind: 'axis', anchor: 'middle' });
      g2.text(SIDE + SW / 2, BASE + 52, 'place in the cycle', { kind: 'axis', anchor: 'middle' });

      function redraw() {
        var step = k.step();
        var m = step === 0 ? simple(x) : step === 1 ? holt(x) : holtWinters(x, gamma);
        var lvl = [], fc = [], e = 0, t, h;
        for (t = 0; t < FIT; t++) if (m.level[t] != null) lvl.push(P(t, m.level[t]));
        for (h = 1; h <= N - FIT; h++) {
          var f = m.forecast(h);
          fc.push(P(FIT + h - 1, f));
          e += (x[FIT + h - 1] - f) * (x[FIT + h - 1] - f);
        }
        live.clear();
        live.polyline(lvl, { w: 1.1, op: 0.85 });
        live.polyline(fc, { w: 1.7, accent: true });
        errVal.set(Math.sqrt(e / (N - FIT)).toFixed(1));
        levelVal.set(m.level[FIT - 1].toFixed(1));
        trendVal.set(m.trend == null ? 'none' : (m.trend >= 0 ? '+' : '−') + Math.abs(m.trend).toFixed(2));
        if (step === 2) {
          bars.clear();
          var hiI = 0;
          m.factors.forEach(function (c, i) {
            var bx = SIDE + 2 + i * 13.2, y = BASE - (c - 1) * BS, top = Math.min(y, BASE), ht = Math.abs(y - BASE);
            if (c > m.factors[hiI]) hiI = i;
            if (ht < 1.5) return;
            bars.rect(bx, top, 8, ht, { w: 0.8, rough: 0.3 });
            if (ht > 6) bars.hatch([[bx, top], [bx + 8, top], [bx + 8, top + ht], [bx, top + ht]], { op: 0.5, gap: 3.5 });
          });
          var hx = SIDE + 2 + hiI * 13.2 + 4;
          bars.text(k.clamp(hx, SIDE + 16, SIDE + SW - 16), BASE - (m.factors[hiI] - 1) * BS - 6, '×' + m.factors[hiI].toFixed(2), { kind: 'val', anchor: 'middle' });
        }
      }

      k.slider({
        x: SIDE, y: 140, w: SW, min: 0.05, max: 0.95, step: 0.05, value: GAMMA0, label: 'gamma', steps: [2],
        format: function (v) { return v.toFixed(2); },
        onChange: function (v) { gamma = v; redraw(); }
      });

      var endFlat = P(N - 1, simple(x).forecast(N - FIT)), endHolt = P(N - 1, holt(x).forecast(N - FIT));
      k.root.group({ steps: [0] }).callout('a', 'a flat forecast', SIDE, 150, { to: [endFlat[0] + 6, endFlat[1] - 3], d: 900 });
      k.root.group({ steps: [1] }).callout('b', 'the slope, no cycle', SIDE, 150, { to: [endHolt[0] + 6, endHolt[1] + 4], d: 900 });
      g2.callout('c', 'level × season', SIDE, 344, { d: 400 });
      g2.text(SIDE, 372, 'the cycle carries', { kind: 'hand', d: 700 });
      g2.text(SIDE, 394, 'into the forecast.', { kind: 'hand', d: 1100 });

      k.onStep(redraw);
    }
  });
})();
