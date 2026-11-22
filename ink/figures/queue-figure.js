/* Queue figure — the till from the lesson, made busier with a slider.
   Same rule as the die in chance-till: each minute nobody, one person or two people arrive, and the till
   serves one person a minute. The slider sets how many arrive per minute on average (lambda): one person with
   chance lambda/3, two with chance lambda/3. At lambda = 0.5 that is exactly the die (5 -> one, 6 -> two).
   Because the till serves one a minute, lambda is also the share of the time it is busy.
   One fixed set of 200,000 seeded draws is shared by every setting, so moving the slider adds people to the same
   minutes rather than dealing a new day. The long-run average waiting is taken over all 200,000 minutes.
   Steps: 0 one working day (480 minutes) of the line at the chosen rate, with its long-run average ruled across;
          1 the long-run average for every setting, as a curve, with the current one marked.
   Made-up system. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };
  var SIDE = 462, COL = 158;
  var N = 200000, DAY = 480;
  var LAM_MIN = 0.1, LAM_MAX = 1.1, LAM_START = 0.5;

  var U = null;
  function draws() {
    if (U) return U;
    var r = window.InkKit.rng(1907);
    U = new Float32Array(N);
    for (var i = 0; i < N; i++) U[i] = r();
    return U;
  }
  /* the till, minute by minute: arrivals join, the till serves one, the rest wait */
  function simulate(lam) {
    var u = draws(), w = 0, total = 0, day = [];
    for (var i = 0; i < N; i++) {
      var a = u[i] < lam / 3 ? 2 : u[i] < 2 * lam / 3 ? 1 : 0;
      w += a;
      if (w > 0) w--;
      total += w;
      if (i < DAY) day.push(w);
    }
    return { avg: total / N, day: day };
  }
  function pct(v) { return Math.round(v * 100) + '%'; }
  function key(v) { return Math.round(v * 100); }

  window.InkKit.define('queue-figure', {
    label: 'The till made busier with a slider: one working day of the line at the chosen arrival rate, ' +
      'and the long-run average line for every rate, which shoots up as the till nears full.',
    steps: 2,
    seed: 23,
    draw: function (k) {
      var lam = LAM_START, cache = {};
      function sim(v) { var kk = key(v); return cache[kk] || (cache[kk] = simulate(v)); }
      var GRID = [];
      for (var g = 10; g <= 95; g += 5) GRID.push(g / 100);
      var CURVE = GRID.map(function (v) { return [v, sim(v).avg]; });

      /* ---- step 0: one day ---- */
      var sx = k.scale(0, DAY, PLOT.x, PLOT.x + PLOT.w);
      var a0 = k.root.group({ steps: [0], d: 100 });
      a0.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h,
        xticks: [0, 2, 4, 6, 8].map(function (h) { return [sx(h * 60), String(h)]; }), xlabel: 'hours into the day' });
      a0.text(PLOT.x, PLOT.y - 10, 'waiting, minute by minute', { kind: 'label' });
      var ticks = k.root.layer({ steps: [0] }), trace = k.root.layer({ steps: [0] }), avgLine = k.root.layer({ steps: [0] });
      var top = 0, sy = null;

      /* ---- step 1: the curve ---- */
      var cx = k.scale(0, 1, PLOT.x, PLOT.x + PLOT.w), cy = k.scale(0, 8, PLOT.y + PLOT.h, PLOT.y);
      var a1 = k.root.group({ steps: [1], d: 100, stagger: 20 });
      a1.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h,
        xticks: [0, 0.25, 0.5, 0.75, 1].map(function (v) { return [cx(v), pct(v)]; }),
        yticks: [0, 2, 4, 6, 8].map(function (v) { return [cy(v), String(v)]; }), xlabel: 'how busy the till is' });
      a1.text(PLOT.x, PLOT.y - 10, 'average waiting, in the long run', { kind: 'label' });
      a1.thread([[cx(1), PLOT.y + PLOT.h], [cx(1), PLOT.y + 10]], { w: 1 });
      a1.text(cx(1) - 6, PLOT.y + 22, 'full', { kind: 'label', anchor: 'end' });
      CURVE.forEach(function (p) { if (p[1] <= 8) a1.mark(cx(p[0]), cy(p[1]), 'o', { r: 3 }); });
      k.root.layer({ steps: [1] }).polyline(CURVE.filter(function (p) { return p[1] <= 8; }).map(function (p) { return [cx(p[0]), cy(p[1])]; }), { w: 1.1, op: 0.7 });
      var ring = k.root.layer({ steps: [1] });

      /* ---- the column ---- */
      var side = k.root.group({ d: 200 });
      side.text(SIDE, 50, 'per minute', { kind: 'label' });
      var vLam = side.text(SIDE + COL, 50, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 70, 'till busy', { kind: 'label' });
      var vBusy = side.text(SIDE + COL, 70, '', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 82, SIDE + COL, 82, { w: 0.6, op: 0.45, rough: 0.3 });
      side.text(SIDE, 102, 'average waiting', { kind: 'label' });
      side.text(SIDE, 120, '  this day', { kind: 'label' });
      var vDay = side.text(SIDE + COL, 120, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 138, '  long run', { kind: 'label' });
      var vLong = side.text(SIDE + COL, 138, '', { kind: 'val', anchor: 'end' });
      var foot = side.text(SIDE, 158, '', { kind: 'axis' });

      var fromDrag = false, curveDrag = null;
      var slider = k.slider({
        x: SIDE, y: 214, w: COL, min: LAM_MIN, max: LAM_MAX, step: 0.05, value: LAM_START,
        label: 'how busy', format: function (v) { return pct(v); },
        onChange: function (v) {
          lam = v;
          if (!fromDrag && curveDrag) curveDrag.set(cx(Math.min(v, 1)), PLOT.y + PLOT.h / 2);
          redraw();
        }
      });

      /* ---- on the chart itself ---- */
      var NS = 'http://www.w3.org/2000/svg';
      function cover(steps, label, cursor) {
        var g = k.root.group({ steps: steps });
        var r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', PLOT.x); r.setAttribute('y', PLOT.y); r.setAttribute('width', PLOT.w); r.setAttribute('height', PLOT.h);
        r.setAttribute('class', 'ik-hit');
        g.node.appendChild(r);
        g.node.setAttribute('aria-label', label);
        g.node.style.cursor = cursor;
        return g;
      }
      // step 0: hold the day and slide along it to read the line at that minute
      var probeAt = null;
      var probe = k.root.layer({ steps: [0] });
      var dayG = cover([0], 'Read the line at a minute of the day. Arrow keys move along it.', 'crosshair');
      k.draggable(dayG.node, {
        x: PLOT.x, y: PLOT.y + PLOT.h / 2,
        bounds: { x0: PLOT.x, y0: PLOT.y, x1: PLOT.x + PLOT.w - 0.01, y1: PLOT.y + PLOT.h },
        label: 'Read the line at a minute of the day. Arrow keys move along it.',
        onMove: function (x) { probeAt = Math.floor((x - PLOT.x) / PLOT.w * DAY); drawProbe(); }
      });
      dayG.node.style.cursor = 'crosshair';
      // step 1: take hold of the curve and move the ring along it; the slider follows
      var curveG = cover([1], 'Choose how busy the till is. Arrow keys move along the curve.', '');
      curveDrag = k.draggable(curveG.node, {
        x: cx(LAM_START), y: PLOT.y + PLOT.h / 2,
        bounds: { x0: cx(LAM_MIN), y0: PLOT.y, x1: cx(1), y1: PLOT.y + PLOT.h },
        label: 'Choose how busy the till is. Arrow keys move along the curve.',
        onMove: function (x) {
          fromDrag = true;
          slider.set((x - PLOT.x) / PLOT.w);
          fromDrag = false;
        }
      });
      curveG.node.style.cursor = '';

      function drawProbe() {
        probe.clear();
        if (probeAt == null || !sy) return;
        var s = sim(lam), w = s.day[probeAt], x = sx(probeAt + 0.5);
        var h = Math.floor(probeAt / 60), m = probeAt % 60;
        var label = h + 'h ' + (m < 10 ? '0' : '') + m + ' · ' + w + ' waiting';
        probe.path('M' + x.toFixed(1) + ' ' + (PLOT.y + PLOT.h) + ' L' + x.toFixed(1) + ' ' + (PLOT.y + 18), { w: 0.8, op: 0.6 });
        var right = x < PLOT.x + PLOT.w - 130, tx = right ? x + 6 : x - 6, tw = label.length * 6.6 + 8;
        probe.paper(right ? tx - 3 : tx - tw + 3, PLOT.y + 2, tw, 18);
        probe.text(tx, PLOT.y + 15, label, { kind: 'val', anchor: right ? 'start' : 'end' });
      }

      var c0 = k.root.group({ steps: [0], d: 600 });
      c0.callout('a', 'nearly full: it explodes', SIDE, 262);
      c0.text(SIDE, 300, 'a little busier,', { kind: 'hand' });
      c0.text(SIDE, 322, 'a lot more line.', { kind: 'hand' });
      var c1 = k.root.group({ steps: [1], d: 400 });
      c1.text(SIDE, 262, 'long-run average', { kind: 'label' });
      [0.45, 0.9].forEach(function (v, i) {
        c1.text(SIDE, 282 + i * 18, '  at ' + pct(v), { kind: 'label' });
        c1.text(SIDE + COL, 282 + i * 18, sim(v).avg.toFixed(2), { kind: 'val', anchor: 'end' });
      });
      c1.callout('b', 'twice as busy,', SIDE, 344);
      c1.text(SIDE + 20, 362, 'about ' + Math.round(sim(0.9).avg / sim(0.45).avg) + ' times the line', { kind: 'note' });

      function setScale(max) {
        var want = [4, 8, 16, 32, 64, 128].filter(function (v) { return v >= max; })[0] || 128;
        if (want === top) return;
        top = want;
        sy = k.scale(0, top, PLOT.y + PLOT.h, PLOT.y);
        ticks.clear();
        [0, top / 4, top / 2, top * 3 / 4, top].forEach(function (n) {
          ticks.line(PLOT.x - 4, sy(n), PLOT.x, sy(n), { w: 0.6, op: 0.6, rough: 0.2 });
          ticks.text(PLOT.x - 8, sy(n) + 3.5, String(n), { kind: 'axis', anchor: 'end' });
        });
      }
      function redraw() {
        var s = sim(lam), stable = lam < 1 - 1e-9, dayMax = Math.max.apply(null, s.day), dayAvg = 0;
        s.day.forEach(function (w) { dayAvg += w; });
        dayAvg /= DAY;
        vLam.set(lam.toFixed(2) + ' people');
        vBusy.set(stable ? pct(lam) : 'over 100%');
        vDay.set(dayAvg.toFixed(2));
        vLong.set(stable ? s.avg.toFixed(2) : 'keeps growing');
        foot.set(stable ? '200,000 minutes simulated' : 'too many to keep up');
        setScale(Math.max(dayMax, stable ? s.avg : 0));
        trace.clear();
        var d = 'M' + sx(0).toFixed(1) + ' ' + sy(0).toFixed(1), prev = 0;
        s.day.forEach(function (w, i) {
          d += ' L' + sx(i).toFixed(1) + ' ' + sy(prev).toFixed(1) + ' L' + sx(i).toFixed(1) + ' ' + sy(w).toFixed(1);
          prev = w;
        });
        d += ' L' + sx(DAY).toFixed(1) + ' ' + sy(prev).toFixed(1);
        trace.path(d, { w: 1, op: 0.85 });
        avgLine.clear();
        if (stable) avgLine.path('M' + PLOT.x + ' ' + sy(s.avg).toFixed(1) + ' L' + (PLOT.x + PLOT.w) + ' ' + sy(s.avg).toFixed(1), { accent: true, w: 1.6, op: 1 });
        ring.clear();
        if (stable && s.avg <= 8) {
          var x = cx(lam), y = cy(s.avg), r = 8;
          ring.path('M' + (x - r).toFixed(1) + ' ' + y.toFixed(1) + ' a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0', { accent: true, w: 1.6, op: 1 });
        } else if (stable) {
          ring.text(cx(lam), PLOT.y + 40, '↑ ' + s.avg.toFixed(1), { kind: 'val', anchor: 'middle', accent: true });
        }
        drawProbe();
      }

      k.onStep(function () { redraw(); });
    }
  });
})();
