/* Season figure — one series with a steady climb and a 12-step cycle, forecast by the blend with each extra
   piece switched on or off by the reader.
   The first 48 points are worked through in the browser and the last 12 are held out, so each forecast can be
   scored against what really came next. Four forecasters, all computed here:
     plain blend         one running estimate, moved part of the way toward each value
     + climb             a second running estimate, the climb per step, added on to every guess
     + season            one adjustment per place in the cycle (a ratio: 1.2 = 20% above the level)
     + climb and season  both
   The average held-out miss, the climb per step and the twelve adjustments shown are the numbers that are drawn.
   The pieces are switched by the two buttons, or by clicking a row of "tried so far" (the small triangle marks
   the one shown). One step. Made-up data. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };
  var SIDE = 462, SW = 158;
  var N = 60, FIT = 48, L = 12, Y0 = 10, Y1 = 100;
  var MOVE = 0.2, MOVE_CLIMB = 0.05, MOVE_SEASON = 0.3;   // how far each running estimate moves per value

  function makeSeries(rng) {
    var r = rng(21), x = [], shape = [], mean = 0, m, t;
    for (m = 0; m < L; m++) { shape.push(1 + 0.24 * Math.sin(2 * Math.PI * (m - 4) / L) + 0.1 * Math.sin(4 * Math.PI * (m - 4) / L + 1)); mean += shape[m] / L; }
    for (t = 0; t < N; t++) x.push((30 + 0.55 * (t + 1)) * shape[t % L] / mean * (1 + 0.035 * (r() + r() + r() - 1.5) * 2));
    return x;
  }

  /* returns { level: [...] (null where not yet known), climb, adjust (12 ratios or null), forecast(h) },
     worked through x[0 .. FIT-1] */
  function model(x, climbOn, seasonOn) {
    var s = [], tr = 0, c = null, t, prev, i;
    if (!seasonOn) {
      s.push(x[0]);
      for (t = 1; t < FIT; t++) {
        prev = s[t - 1];
        s.push(MOVE * x[t] + (1 - MOVE) * (prev + tr));
        if (climbOn) tr = MOVE_CLIMB * (s[t] - prev) + (1 - MOVE_CLIMB) * tr;
      }
      return { level: s, climb: climbOn ? tr : null, adjust: null, forecast: function (h) { return s[FIT - 1] + h * tr; } };
    }
    // the first year gives a starting level and a starting adjustment for each place in the cycle
    var m1 = 0, m2 = 0;
    for (i = 0; i < L; i++) { m1 += x[i] / L; m2 += x[i + L] / L; }
    c = [];
    for (i = 0; i < L; i++) { c.push(x[i] / m1); s.push(null); }
    s[L - 1] = m1; tr = climbOn ? (m2 - m1) / L : 0;
    for (t = L; t < FIT; t++) {
      prev = s[t - 1];
      s.push(MOVE * x[t] / c[t - L] + (1 - MOVE) * (prev + tr));
      if (climbOn) tr = MOVE_CLIMB * (s[t] - prev) + (1 - MOVE_CLIMB) * tr;
      c.push(MOVE_SEASON * x[t] / s[t] + (1 - MOVE_SEASON) * c[t - L]);
    }
    return {
      level: s, climb: climbOn ? tr : null, adjust: c.slice(FIT - L),
      forecast: function (h) { return (s[FIT - 1] + h * tr) * c[FIT - L + (h - 1) % L]; }
    };
  }

  window.InkKit.define('season-figure', {
    label: 'A series that climbs and repeats every 12 steps, forecast by the blend with a climb and a season switched on or off',
    steps: 1,
    seed: 9,
    draw: function (k) {
      var sx = k.scale(0, N + 1, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(Y0, Y1, PLOT.y + PLOT.h, PLOT.y);
      var x = makeSeries(k.rng), climbOn = false, seasonOn = false, tried = {}, shown = null, busy = false;
      function P(t, v) { return [sx(t + 1), sy(k.clamp(v, Y0 + 1, Y1 - 1))]; }

      k.root.axes({
        x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'step', ylabel: 'value',
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

      k.root.line(PLOT.x + 150, PLOT.y + PLOT.h - 16, PLOT.x + 178, PLOT.y + PLOT.h - 16, { w: 1.1, op: 0.85, rough: 0.3 });
      k.root.text(PLOT.x + 185, PLOT.y + PLOT.h - 12.5, 'the running estimate', { kind: 'axis' });

      /* ---- readouts ---- */
      k.root.text(SIDE, 46, 'average miss', { kind: 'label' });
      var errVal = k.root.text(SIDE + SW, 46, '', { kind: 'val', anchor: 'end' });
      k.root.text(SIDE, 62, 'on the 12 held out', { kind: 'axis' });
      k.root.text(SIDE, 84, 'climb per step', { kind: 'label' });
      var climbVal = k.root.text(SIDE + SW, 84, '', { kind: 'val', anchor: 'end' });
      k.root.line(SIDE, 96, SIDE + SW, 96, { w: 0.6, op: 0.45, rough: 0.3 });

      var bClimb = k.button(SIDE, 120, 'add the climb', function () { if (!busy) { climbOn = !climbOn; redraw(true); } });
      var bSeason = k.button(SIDE, 154, 'add the season', function () { if (!busy) { seasonOn = !seasonOn; redraw(true); } });

      k.root.text(SIDE, 190, 'tried so far', { kind: 'label' });
      var ROWS = [['plain blend', false, false], ['+ climb', true, false], ['+ season', false, true], ['+ both', true, true]];
      var rowVals = ROWS.map(function (r, i) {
        k.root.text(SIDE, 210 + i * 18, r[0], { kind: 'axis' });
        return k.root.text(SIDE + SW, 210 + i * 18, '–', { kind: 'val', anchor: 'end' });
      });
      // each row is also a way in: click one to switch on just those pieces
      var rowMark = k.root.layer();
      ROWS.forEach(function (r, i) {
        var hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        hit.setAttribute('x', SIDE - 14); hit.setAttribute('y', 210 + i * 18 - 13);
        hit.setAttribute('width', SW + 20); hit.setAttribute('height', 18);
        hit.setAttribute('class', 'ik-hit'); hit.setAttribute('tabindex', 0); hit.setAttribute('role', 'button');
        hit.setAttribute('aria-label', 'Show the forecast with ' + (r[1] && r[2] ? 'the climb and the season' : r[1] ? 'the climb' : r[2] ? 'the season' : 'neither piece'));
        hit.style.cursor = 'pointer';
        function pick() { if (!busy && (climbOn !== r[1] || seasonOn !== r[2])) { climbOn = r[1]; seasonOn = r[2]; redraw(true); } }
        hit.addEventListener('click', pick);
        hit.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
        k.root.node.appendChild(hit);
      });

      var live = k.root.layer();
      var bars = k.root.layer();
      var BASE = 350, BS = 100;                       // the line where an adjustment is ×1, and pixels per 1.0
      var gS = k.root.group({ d: 200 });
      var sLabel = gS.text(SIDE, 290, 'adjustment per place', { kind: 'label' });
      var sAxis = gS.line(SIDE, BASE, SIDE + SW, BASE, { w: 0.8, rough: 0.3 });
      var s1 = gS.text(SIDE + 6, BASE + 48, '1', { kind: 'axis', anchor: 'middle' });
      var s12 = gS.text(SIDE + 6 + 11 * 13.2, BASE + 48, '12', { kind: 'axis', anchor: 'middle' });
      var sMid = gS.text(SIDE + SW / 2, BASE + 48, 'in the cycle', { kind: 'axis', anchor: 'middle' });
      var seasonBits = [sLabel, sAxis, s1, s12, sMid];
      var callC = k.root.group({ d: 900 });
      callC.callout('e', 'switch a piece on', SIDE, 290);

      function forecastOf(m) {
        var lvl = [], fc = [], e = 0, t, h;
        for (t = 0; t < FIT; t++) if (m.level[t] != null) lvl.push([t, m.level[t]]);
        for (h = 1; h <= N - FIT; h++) {
          var f = m.forecast(h);
          fc.push([FIT + h - 1, f]);
          e += Math.abs(x[FIT + h - 1] - f);
        }
        return { lvl: lvl, fc: fc, miss: e / (N - FIT) };
      }
      function paint(f, adjust) {
        live.clear();
        live.polyline(f.lvl.map(function (p) { return P(p[0], p[1]); }), { w: 1.1, op: 0.85 });
        live.polyline(f.fc.map(function (p) { return P(p[0], p[1]); }), { w: 1.7, accent: true });
      }
      function drawBars(adjust) {
        bars.clear();
        seasonBits.forEach(function (n) { n.style.display = adjust ? '' : 'none'; });
        callC.node.style.display = adjust ? 'none' : '';
        if (!adjust) return;
        var hiI = 0;
        adjust.forEach(function (c, i) {
          var bx = SIDE + 2 + i * 13.2, y = BASE - (c - 1) * BS, top = Math.min(y, BASE), ht = Math.abs(y - BASE);
          if (c > adjust[hiI]) hiI = i;
          if (ht < 1.5) return;
          bars.rect(bx, top, 8, ht, { w: 0.8, rough: 0.3 });
          if (ht > 6) bars.hatch([[bx, top], [bx + 8, top], [bx + 8, top + ht], [bx, top + ht]], { op: 0.5, gap: 3.5 });
        });
        var hx = SIDE + 2 + hiI * 13.2 + 4;
        bars.text(k.clamp(hx, SIDE + 16, SIDE + SW - 16), BASE - (adjust[hiI] - 1) * BS - 6, '×' + adjust[hiI].toFixed(2), { kind: 'val', anchor: 'middle' });
      }
      function redraw(animate) {
        var m = model(x, climbOn, seasonOn), f = forecastOf(m), key = (climbOn ? 1 : 0) + (seasonOn ? 2 : 0);
        tried[key] = f.miss;
        ROWS.forEach(function (r, i) { var kk = (r[1] ? 1 : 0) + (r[2] ? 2 : 0); rowVals[i].set(tried[kk] == null ? '–' : tried[kk].toFixed(1)); });
        rowMark.clear();
        ROWS.forEach(function (r, i) { if (r[1] === climbOn && r[2] === seasonOn) rowMark.mark(SIDE - 7, 206 + i * 18, 'tri', { r: 2.6 }); });
        errVal.set(f.miss.toFixed(1));
        climbVal.set(m.climb == null ? 'none' : (m.climb >= 0 ? '+' : '−') + Math.abs(m.climb).toFixed(2));
        bClimb.set(climbOn ? 'take the climb off' : 'add the climb');
        bSeason.set(seasonOn ? 'take the season off' : 'add the season');
        drawBars(m.adjust);
        var from = shown;
        shown = f;
        if (!animate || !from) { paint(f); return; }
        // the forecast tweens from the old one to the new one; the estimate line is simply redrawn
        busy = true;
        k.animate(650, function (t) {
          var mid = { lvl: f.lvl, fc: f.fc.map(function (p, i) { return [p[0], from.fc[i][1] + (p[1] - from.fc[i][1]) * t]; }) };
          paint(mid);
          if (t >= 1) busy = false;
        });
      }

      k.onStep(function () { busy = false; climbOn = false; seasonOn = false; tried = {}; shown = null; redraw(false); });
    }
  });
})();
