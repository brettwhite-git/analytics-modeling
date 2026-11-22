/* Points lab — the first figure of the guide: things described by numbers are points, and alike means close.
   Steps: 0 twenty made-up café customers (visits per month, spend per visit in dollars). Click one: threads
            grow to its three nearest, and the column works the distance sum for the nearest.
          1 the same customers with spend counted in smaller and smaller coins (a slider, dollars to cents).
            The chart keeps one unit per pixel on both axes, so as spend grows the visits squeeze to a strip
            and the nearest neighbours change. "Put both on the same scale" glides every point to
            (value - smallest) / (largest - smallest) on both axes; after that the coins no longer matter.
          2 eight numbers on a line. Drag the middle; the column tallies the pull from each side and the
            average squared gap, and each gap is drawn as a square. Balanced, the middle is the average.
   The chosen customer is shared between the figures on the page (sessionStorage) and offered to the page's
   Python with the points: `from page import points, chosen`.
   Everything shown is computed from the same numbers that are drawn. Made-up data. Needs InkKit. */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 62, y: 34, w: 368, h: 368 }, SIDE = 462, BOTTOM = PLOT.y + PLOT.h;
  var STORE = 'ink-points-chosen', EVENT = 'ink:points-chosen';
  var DEFAULT = 1;
  var COINS = [1, 2, 5, 10, 20, 50, 100];          // spend multiplied by this: dollars ... cents

  // made-up customers: visits per month, spend per visit in dollars (two decimals, so cents are whole)
  var POINTS = [
    [2.2, 8.51], [2.3, 7.68], [1.6, 7.79], [3.6, 8.42], [3.5, 8.25], [2.9, 8.19], [6.3, 4.36],
    [8.5, 4.0], [6.3, 1.76], [7.1, 3.03], [8.3, 3.45], [8.5, 2.86], [8.3, 3.89], [4.3, 7.69],
    [5.6, 7.12], [4.3, 4.99], [4.6, 5.68], [5.7, 6.07], [4.5, 4.75], [4.4, 7.14]
  ];
  var EIGHT = [2, 4, 4, 4, 5, 5, 7, 9];             // the eight numbers of step 2, the same as in the lesson

  function lohi(i) {
    var lo = Infinity, hi = -Infinity;
    POINTS.forEach(function (p) { lo = Math.min(lo, p[i]); hi = Math.max(hi, p[i]); });
    return [lo, hi];
  }
  var RV = lohi(0), RS = lohi(1);
  var SCALED = POINTS.map(function (p) { return [(p[0] - RV[0]) / (RV[1] - RV[0]), (p[1] - RS[0]) / (RS[1] - RS[0])]; });

  function remembered() {
    try { var v = +sessionStorage.getItem(STORE); return sessionStorage.getItem(STORE) != null && v >= 0 && v < POINTS.length ? v : DEFAULT; } catch (e) { return DEFAULT; }
  }
  function remember(i) {
    try { sessionStorage.setItem(STORE, String(i)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent(EVENT, { detail: i })); } catch (e) {}
  }

  /* what `from page import points, chosen` gives the Python on the same page (see ink/py.js) */
  window.InkPage = window.InkPage || {};
  window.InkPage.points = function () { return POINTS; };
  window.InkPage.chosen = function () { return remembered(); };

  function num(v) {
    var a = Math.abs(v);
    return a >= 100 ? String(Math.round(v)) : a >= 10 ? v.toFixed(1) : a >= 0.1 || a === 0 ? v.toFixed(2) : v.toPrecision(2);
  }

  window.InkKit.define('points-lab', {
    label: 'Customers as points: choose one and see its nearest three; change the units of spend and watch them change; find the middle of eight numbers',
    steps: 3,
    seed: 23,
    draw: function (k) {
      var chosen = remembered(), coin = 1, scaled = false, busy = false;
      var cur = [];                                  // where each point is drawn now, in figure pixels
      var near = [];                                 // the three nearest, [squared distance, index]

      /* ---- where a point goes, and what numbers it has, in the current units ---- */
      function values(i) { return scaled ? SCALED[i] : [POINTS[i][0], POINTS[i][1] * coin]; }
      function target(i) {
        if (scaled) {
          var s = SCALED[i];
          return [PLOT.x + (s[0] + 0.05) / 1.1 * PLOT.w, BOTTOM - (s[1] + 0.05) / 1.1 * PLOT.h];
        }
        var D = 10 * coin;                           // one unit per pixel on both axes: the page shows true distance
        return [PLOT.x + POINTS[i][0] / D * PLOT.w, BOTTOM - POINTS[i][1] * coin / D * PLOT.h];
      }
      function d2(i, j) { var a = values(i), b = values(j); return (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]); }
      function nearest3() {
        var all = [];
        for (var j = 0; j < POINTS.length; j++) if (j !== chosen) all.push([d2(chosen, j), j]);
        all.sort(function (a, b) { return a[0] - b[0]; });
        return all.slice(0, 3);
      }

      /* ---- axes for the customers (steps 0 and 1) ---- */
      var chart = k.root.group({ steps: [0, 1] });
      chart.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h });
      var ticks = chart.layer();
      function drawTicks() {
        ticks.clear();
        var xs = [], ys = [], xl, yl, unit = coin === 1 ? 'dollars' : coin === 100 ? 'cents' : (100 / coin) + '¢ coins';
        if (scaled) {
          [0, 0.5, 1].forEach(function (v) { var p = PLOT.x + (v + 0.05) / 1.1 * PLOT.w; xs.push([p, String(v)]); ys.push([BOTTOM - (v + 0.05) / 1.1 * PLOT.h, String(v)]); });
          xl = 'visits, on the 0 to 1 scale'; yl = 'spend, on the 0 to 1 scale';
        } else {
          var last = -99;
          [0, 2, 4, 6, 8, 10].forEach(function (v) {
            var p = PLOT.x + v / (10 * coin) * PLOT.w;
            xs.push([p, p - last >= 24 ? String(v) : null]);
            if (p - last >= 24) last = p;
          });
          [0, 2, 4, 6, 8, 10].forEach(function (v) { ys.push([BOTTOM - v / 10 * PLOT.h, String(v * coin)]); });
          xl = 'visits per month'; yl = 'spend per visit, in ' + unit;
        }
        xs.forEach(function (t) {
          ticks.line(t[0], BOTTOM, t[0], BOTTOM + 4, { w: 0.6, op: 0.6, rough: 0.2 });
          if (t[1] != null) ticks.text(t[0], BOTTOM + 16, t[1], { kind: 'axis', anchor: 'middle' });
        });
        ys.forEach(function (t) {
          ticks.line(PLOT.x - 4, t[0], PLOT.x, t[0], { w: 0.6, op: 0.6, rough: 0.2 });
          ticks.text(PLOT.x - 8, t[0] + 3.5, t[1], { kind: 'axis', anchor: 'end' });
        });
        ticks.text(PLOT.x + PLOT.w, BOTTOM + 34, xl, { kind: 'label', anchor: 'end' });
        ticks.text(PLOT.x, PLOT.y - 12, yl, { kind: 'label', anchor: 'start' });
      }

      /* ---- threads from the chosen customer to its nearest three: one clean path ---- */
      var threadLayer = chart.layer();
      var thread = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      thread.setAttribute('fill', 'none'); thread.setAttribute('stroke', 'currentColor');
      thread.setAttribute('stroke-width', '1.1'); thread.setAttribute('stroke-linecap', 'round');
      thread.setAttribute('stroke-dasharray', '3.5 4'); thread.setAttribute('opacity', '0.6');
      threadLayer.node.appendChild(thread);
      function drawThreads(grow) {
        var t = grow == null ? 1 : grow, a = cur[chosen], d = '';
        near.forEach(function (n) {
          var b = cur[n[1]];
          d += 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' L' + (a[0] + (b[0] - a[0]) * t).toFixed(1) + ' ' + (a[1] + (b[1] - a[1]) * t).toFixed(1) + ' ';
        });
        thread.setAttribute('d', d);
      }

      /* ---- the customers: drawn once at the origin and moved, so nothing re-wobbles ---- */
      var marks = chart.group({ d: 150, stagger: 14 });
      var nodes = POINTS.map(function () { var g = marks.group({}); g.mark(0, 0, 'o', { r: 3.8 }); return g.node; });
      marks.node.style.pointerEvents = 'none';
      var ring = chart.group({ d: 0 });
      ring.circle(0, 0, 9, { accent: true, w: 1.6, op: 0.95, dur: 260 });
      ring.node.style.pointerEvents = 'none';
      function place() {
        nodes.forEach(function (node, i) { node.setAttribute('transform', 'translate(' + cur[i][0].toFixed(1) + ' ' + cur[i][1].toFixed(1) + ')'); });
        ring.node.setAttribute('transform', 'translate(' + cur[chosen][0].toFixed(1) + ' ' + cur[chosen][1].toFixed(1) + ')');
      }

      /* ---- click a customer to choose it ---- */
      var hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      hit.setAttribute('x', PLOT.x - 10); hit.setAttribute('y', PLOT.y - 10);
      hit.setAttribute('width', PLOT.w + 20); hit.setAttribute('height', PLOT.h + 20);
      hit.setAttribute('class', 'ik-hit'); hit.style.cursor = 'pointer';
      chart.node.appendChild(hit);
      hit.addEventListener('click', function (e) {
        if (busy || k.step() > 1) return;
        var p = k.toFigure(e), best = -1, bd = 22 * 22;
        cur.forEach(function (c, i) { var d = (c[0] - p.x) * (c[0] - p.x) + (c[1] - p.y) * (c[1] - p.y); if (d < bd) { bd = d; best = i; } });
        if (best < 0 || best === chosen) return;
        choose(best, true);
      });
      function choose(i, mine) {
        chosen = i; near = nearest3(); place(); readout();
        if (mine) remember(i);
        busy = true;
        k.animate(600, function (t) { drawThreads(t); if (t >= 1) busy = false; });
      }

      /* ---- the column beside the plot ---- */
      var side = k.root.group({ steps: [0, 1], d: 250 });
      side.text(SIDE, 60, 'customer', { kind: 'label' });
      var vWho = side.text(SIDE + 158, 60, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 80, 'visits', { kind: 'label' });
      var vVis = side.text(SIDE + 158, 80, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 100, 'spend', { kind: 'label' });
      var vSp = side.text(SIDE + 158, 100, '', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 112, SIDE + 158, 112, { w: 0.6, op: 0.45, rough: 0.3 });
      side.text(SIDE, 136, 'nearest three', { kind: 'label' });
      var vNear = [0, 1, 2].map(function (r) {
        return [side.text(SIDE, 158 + r * 20, '', { kind: 'axis' }), side.text(SIDE + 158, 158 + r * 20, '', { kind: 'val', anchor: 'end' })];
      });
      side.line(SIDE, 214, SIDE + 158, 214, { w: 0.6, op: 0.45, rough: 0.3 });
      side.text(SIDE, 236, 'the nearest, worked', { kind: 'label' });
      var vSum = side.text(SIDE, 256, '', { kind: 'axis' });
      var vLen = side.text(SIDE, 274, '', { kind: 'axis' });
      function readout() {
        var v = values(chosen);
        vWho.set('no. ' + chosen);
        vVis.set(scaled ? v[0].toFixed(2) : POINTS[chosen][0].toFixed(1));
        vSp.set(scaled ? v[1].toFixed(2) : coin === 1 ? '$' + POINTS[chosen][1].toFixed(2) : String(Math.round(POINTS[chosen][1] * coin * 100) / 100));
        near.forEach(function (n, r) { vNear[r][0].set('no. ' + n[1]); vNear[r][1].set(num(Math.sqrt(n[0]))); });
        var a = values(chosen), b = values(near[0][1]);
        var across = (a[0] - b[0]) * (a[0] - b[0]), up = (a[1] - b[1]) * (a[1] - b[1]);
        vSum.set(num(across) + ' + ' + num(up) + ' = ' + num(across + up));
        vLen.set('square root: ' + num(Math.sqrt(across + up)));
      }

      k.root.group({ steps: [0], d: 600 }).callout('a', 'click any customer', SIDE, 320);
      k.root.group({ steps: [0], d: 700 }).text(SIDE, 350, 'the threads go to', { kind: 'hand' });
      k.root.group({ steps: [0], d: 700 }).text(SIDE, 372, 'its nearest three.', { kind: 'hand' });

      /* ---- step 1: change the units, then put both on one scale ---- */
      function glide(ms, done) {
        var from = cur.map(function (c) { return c.slice(); }), to = POINTS.map(function (p, i) { return target(i); });
        near = nearest3(); readout();
        busy = true;
        k.animate(ms, function (t) {
          cur = from.map(function (f, i) { return [f[0] + (to[i][0] - f[0]) * t, f[1] + (to[i][1] - f[1]) * t]; });
          place(); drawThreads();
          if (t >= 1) { busy = false; drawTicks(); if (done) done(); }
        });
      }
      var slider = k.slider({
        x: SIDE + 4, y: 314, w: 150, min: 0, max: COINS.length - 1, step: 1, value: 0, steps: [1],
        label: 'spend in',
        format: function (v) { var c = COINS[v]; return c === 1 ? 'dollars' : c === 100 ? 'cents' : (100 / c) + '¢'; },
        onChange: function (v) {
          coin = COINS[v];
          if (scaled) { readout(); drawTicks(); note.set('the scale ignores coins'); return; }
          glide(450, label1);
        }
      });
      var bScale = k.button(SIDE, 354, 'put both on one scale', function () {
        if (busy) return;
        scaled = !scaled; glide(900, label1);
      }, { steps: [1] });
      var note = k.root.group({ steps: [1], d: 400 }).text(SIDE, 386, '', { kind: 'hand' });
      var first = null;
      function label1() {
        bScale.set(scaled ? 'back to raw numbers' : 'put both on one scale');
        if (first == null) first = near[0][1];
        note.set(scaled ? 'coins no longer matter' : near[0][1] !== first ? 'a different nearest!' : coin === 1 ? 'now slide the coins' : 'same nearest, so far');
      }
      k.root.group({ steps: [1], d: 600 }).callout('b', 'same customers, new units', SIDE, 418);

      function enterCustomers(step) {
        chosen = remembered();
        if (step === 0) { coin = 1; scaled = false; }
        else { coin = COINS[slider.value]; scaled = false; first = null; }
        cur = POINTS.map(function (p, i) { return target(i); });
        near = nearest3(); place(); drawTicks(); readout(); drawThreads();
        hit.style.pointerEvents = 'auto';
        if (step === 1) { first = null; label1(); }
      }
      window.addEventListener(EVENT, function (e) {
        if (k.step() > 1 || busy || e.detail === chosen) return;
        chosen = e.detail; near = nearest3(); place(); readout(); drawThreads();
        if (k.step() === 1) { first = near[0][1]; label1(); }
      });

      /* ---- step 2: the middle of eight numbers ---- */
      var LINE = 330, nx = k.scale(0, 10, PLOT.x, PLOT.x + PLOT.w), mid = 3;
      var g2 = k.root.group({ steps: [2] });
      g2.line(PLOT.x, LINE, PLOT.x + PLOT.w, LINE, { w: 1.1 });
      for (var t = 0; t <= 10; t++) {
        g2.line(nx(t), LINE, nx(t), LINE + 4, { w: 0.6, op: 0.6, rough: 0.2 });
        g2.text(nx(t), LINE + 18, String(t), { kind: 'axis', anchor: 'middle' });
      }
      g2.text(PLOT.x + PLOT.w, LINE + 38, 'visits last month, eight customers', { kind: 'label', anchor: 'end' });
      var squares = g2.layer();
      var seen = {};
      var marks2 = g2.group({ d: 150, stagger: 40 });
      EIGHT.forEach(function (v) { seen[v] = (seen[v] || 0) + 1; marks2.mark(nx(v), LINE - 7 - (seen[v] - 1) * 13, 'o', { r: 4 }); });
      marks2.node.style.pointerEvents = 'none';
      var bracket = g2.layer();
      var midG = g2.group({ d: 0 });
      midG.line(0, -290, 0, 10, { accent: true, w: 1.6, rough: 0.3 });
      midG.poly([[0, 12], [7, 24], [-7, 24]], { accent: true, w: 1.4, rough: 0.3 });
      var grab = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      grab.setAttribute('x', -14); grab.setAttribute('y', -290); grab.setAttribute('width', 28); grab.setAttribute('height', 320);
      grab.setAttribute('class', 'ik-hit');
      midG.node.appendChild(grab);
      var dragMid = k.draggable(midG.node, {
        label: 'The middle. Arrow keys move it.',
        bounds: { x0: nx(1.5), y0: LINE, x1: nx(8.5), y1: LINE },
        onMove: function (x) { if (busy) return; mid = Math.round((x - PLOT.x) / PLOT.w * 100) / 10; draw2(); }
      });

      var side2 = k.root.group({ steps: [2], d: 250 });
      side2.text(SIDE, 60, 'middle at', { kind: 'label' });
      var vMid = side2.text(SIDE + 158, 60, '', { kind: 'val', anchor: 'end' });
      side2.text(SIDE, 80, 'left pull', { kind: 'label' });
      var vL = side2.text(SIDE + 158, 80, '', { kind: 'val', anchor: 'end' });
      side2.text(SIDE, 100, 'right pull', { kind: 'label' });
      var vR = side2.text(SIDE + 158, 100, '', { kind: 'val', anchor: 'end' });
      side2.line(SIDE, 112, SIDE + 158, 112, { w: 0.6, op: 0.45, rough: 0.3 });
      side2.text(SIDE, 136, 'average square', { kind: 'label' });
      var vSq = side2.text(SIDE + 158, 136, '', { kind: 'val', anchor: 'end' });
      side2.text(SIDE, 156, 'spread', { kind: 'label' });
      var vSd = side2.text(SIDE + 158, 156, '', { kind: 'val', anchor: 'end' });
      k.button(SIDE, 200, 'balance it for me', function () {
        if (busy) return;
        var from = mid, to = EIGHT.reduce(function (s, v) { return s + v; }, 0) / EIGHT.length;
        busy = true;
        k.animate(800, function (t) { mid = from + (to - from) * t; draw2(); if (t >= 1) { mid = to; busy = false; draw2(); } });
      }, { steps: [2] });
      k.root.group({ steps: [2], d: 600 }).callout('c', 'drag the middle', SIDE, 250);
      var hand2a = k.root.group({ steps: [2], d: 500 }).text(SIDE, 290, '', { kind: 'hand' });
      var hand2b = k.root.group({ steps: [2], d: 500 }).text(SIDE, 312, '', { kind: 'hand' });

      function draw2() {
        var x = nx(mid), left = 0, right = 0, sq = 0, n = EIGHT.length;
        midG.node.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + LINE + ')');
        dragMid.set(x, LINE);
        squares.clear();
        EIGHT.forEach(function (v) {
          var gap = v - mid;
          if (gap < 0) left -= gap; else right += gap;
          sq += gap * gap;
          var a = nx(v), s = Math.abs(a - x);
          if (s > 0.5) squares.path('M' + a.toFixed(1) + ' ' + LINE + ' L' + a.toFixed(1) + ' ' + (LINE - s).toFixed(1) + ' L' + x.toFixed(1) + ' ' + (LINE - s).toFixed(1), { w: 0.6, op: 0.45 });
        });
        var balanced = Math.abs(left - right) < 0.05;
        vMid.set(mid.toFixed(1)); vL.set(left.toFixed(1)); vR.set(right.toFixed(1));
        vSq.set((sq / n).toFixed(2));
        vSd.set(balanced ? Math.sqrt(sq / n).toFixed(2) : '–');
        bracket.clear();
        if (balanced) {
          var sd = Math.sqrt(sq / n), y = LINE + 58;
          bracket.line(nx(mid - sd), y, nx(mid + sd), y, { w: 1.1, rough: 0.3 });
          bracket.line(nx(mid - sd), y - 5, nx(mid - sd), y + 5, { w: 1.1, rough: 0.3 });
          bracket.line(nx(mid + sd), y - 5, nx(mid + sd), y + 5, { w: 1.1, rough: 0.3 });
          bracket.text(nx(mid), y + 18, 'one spread each way', { kind: 'axis', anchor: 'middle' });
        }
        hand2a.set(balanced ? 'the pulls match:' : left > right ? 'the left pulls harder,' : 'the right pulls harder,');
        hand2b.set(balanced ? 'this is the average.' : left > right ? 'so move it left.' : 'so move it right.');
      }

      k.onStep(function (step) {
        busy = false;
        if (step <= 1) enterCustomers(step);
        else { hit.style.pointerEvents = 'none'; mid = 3; draw2(); }
      });
    }
  });
})();
