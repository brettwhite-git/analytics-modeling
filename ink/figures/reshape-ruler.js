/* Reshape: the slanted ruler — keeping one number per point, done by hand before it is named.
   Steps: 0 choose what to keep (across, up, or a slanted ruler) and see how much of the spread each keeps
          1 turn a ruler through the middle; every point drops a thread onto it; the spread of the landings is
            read off, and a small curve of spread against angle fills in wherever the reader has been
          2 the best ruler and the one at a right angle to it; press to collapse every point onto the first
   The angle chosen in step 1 is remembered (sessionStorage) and offered to the page's Python as `my_angle`.
   Everything is computed from the drawn points: landings = across x ruler across + up x ruler up, spread =
   average of the squared distances from the middle. Made-up heights and arm spans, in cm, fixed seed.
   In steps 1 and 2 the reader may also drag any person: the middle, the spreads, the curve and the best ruler
   are worked out again from a working copy. POINTS itself never changes, so the page's Python always gets the
   original people; "put the points back" restores the copy. Not saved.
   Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 }, SIDE = 462, COLW = 158;
  var U = 7;                                   // pixels per cm, the same on both axes so angles look true
  var X0 = 148, Y0 = 148;                      // the cm at the bottom-left corner of the plot
  var MX = 172, MY = 173;                      // the averages (the data is nudged so these are exact)
  var HANDLE = 22;                             // how far from the middle the ruler's grip sits, in cm
  var STORE = 'ink-reshape-angle', DEFAULT_ANGLE = 30;
  var REACH = 9;                               // how near (figure px) a press must be to grab a person
  var CURVE = { x0: SIDE + 4, x1: SIDE + COLW - 4, top: 310, base: 384 };

  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function makePoints() {
    var r = rng(17), N = 30, pts = [];
    function g() { return (r() + r() + r() + r() - 2) * Math.sqrt(3); }
    for (var i = 0; i < N; i++) { var h = 172 + 8 * g(), a = h + 1 + 3.5 * g(); pts.push([Math.round(h), Math.round(a)]); }
    // nudge a few points by 1 cm so the averages are exactly 172 and 173: the centred numbers are then whole
    [[0, MX], [1, MY]].forEach(function (c) {
      var j = c[0], d = c[1] * N - pts.reduce(function (s, p) { return s + p[j]; }, 0), i = 0;
      while (d !== 0) { pts[i % N][j] += d > 0 ? 1 : -1; d += d > 0 ? -1 : 1; i += 7; }
    });
    return pts;
  }
  var POINTS = makePoints();

  function dir(deg) { var a = deg * Math.PI / 180; return [Math.cos(a), Math.sin(a)]; }
  function spread(vals) { return vals.reduce(function (s, v) { return s + v * v; }, 0) / vals.length; }  // the middle is 0

  function remembered() { try { var v = +sessionStorage.getItem(STORE); return sessionStorage.getItem(STORE) != null && isFinite(v) ? v : null; } catch (e) { return null; } }
  function remember(a) { try { sessionStorage.setItem(STORE, String(a)); } catch (e) {} }

  /* what `from page import points, my_angle` gives the Python on the same page (see ink/py.js) */
  window.InkPage = window.InkPage || {};
  window.InkPage.points = function () { return POINTS.map(function (p) { return p.slice(); }); };
  window.InkPage.my_angle = function () { var a = remembered(); return a == null ? DEFAULT_ANGLE : a; };

  function sx(cm) { return PLOT.x + (cm - X0) * U; }
  function sy(cm) { return PLOT.y + PLOT.h - (cm - Y0) * U; }
  function f1(v) { return v.toFixed(1); }
  function f2(v) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(2); }

  function seg(a, b) { return 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' L' + b[0].toFixed(1) + ' ' + b[1].toFixed(1) + ' '; }

  window.InkKit.define('reshape-ruler', {
    label: 'Keeping one number per point: a cloud of heights and arm spans, and a ruler you turn through its middle',
    steps: 3,
    seed: 29,
    draw: function (k) {
      var busy = false, angle = DEFAULT_ANGLE, visited = {}, cancel = null;

      /* the people the reader drags: a copy, so POINTS (and the page's Python) keep the originals.
         Everything below is worked out from this copy: its middle, the centred points, the spreads. */
      var pts = POINTS.map(function (p) { return p.slice(); });
      var MX, MY, C, TOTAL, BEST, PEAK, moved = false;
      function landings(deg) { var d = dir(deg); return C.map(function (p) { return p[0] * d[0] + p[1] * d[1]; }); }
      function spreadAt(deg) { return spread(landings(deg)); }
      function recompute() {
        MX = pts.reduce(function (s, p) { return s + p[0]; }, 0) / pts.length;
        MY = pts.reduce(function (s, p) { return s + p[1]; }, 0) / pts.length;
        C = pts.map(function (p) { return [p[0] - MX, p[1] - MY]; });        // centred
        TOTAL = spreadAt(0) + spreadAt(90);
        var b = 0, sb = spreadAt(0);
        for (var a = 1; a < 180; a++) { var sa = spreadAt(a); if (sa > sb) { b = a; sb = sa; } }
        BEST = b; PEAK = sb;
        moved = pts.some(function (p, i) { return p[0] !== POINTS[i][0] || p[1] !== POINTS[i][1]; });
      }
      recompute();
      function pct(v) { return (Math.round(v / TOTAL * 1000) / 10).toFixed(1) + '%'; }

      /* the two ends of a line through the middle at `deg`, cut where it meets the edge of the plot */
      function ends(deg) {
        var d = dir(deg), cx = sx(MX), cy = sy(MY), dx = d[0] * U, dy = -d[1] * U, lo = -Infinity, hi = Infinity;
        [[dx, PLOT.x - cx, PLOT.x + PLOT.w - cx], [dy, PLOT.y - cy, PLOT.y + PLOT.h - cy]].forEach(function (c) {
          if (Math.abs(c[0]) < 1e-9) return;
          var a = c[1] / c[0], b = c[2] / c[0];
          lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
        });
        lo += 1.5; hi -= 1.5;
        return [[cx + dx * lo, cy + dy * lo], [cx + dx * hi, cy + dy * hi]];
      }

      k.root.axes({
        x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'height, cm', ylabel: 'arm span, cm',
        xticks: [150, 160, 170, 180, 190, 200].map(function (v) { return [sx(v), String(v)]; }),
        yticks: [150, 160, 170, 180, 190, 200].map(function (v) { return [sy(v), String(v)]; })
      });

      /* threads and landing spots, redrawn as the ruler moves; the ruler itself is the one accent */
      var threadLayer = k.root.layer(), rulerLayer = k.root.layer();
      var marks = k.root.group({ d: 150, stagger: 14 });
      var nodes = POINTS.map(function (p) { var n = marks.mark(sx(p[0]), sy(p[1]), 'o', { r: 3.6 }); n.style.pointerEvents = 'none'; return n; });
      // one hit area over the plot finds the nearest person; the ruler's grip is drawn later, so on top
      var pointHit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      pointHit.setAttribute('x', PLOT.x); pointHit.setAttribute('y', PLOT.y);
      pointHit.setAttribute('width', PLOT.w); pointHit.setAttribute('height', PLOT.h);
      pointHit.setAttribute('class', 'ik-hit');
      pointHit.style.touchAction = 'none';
      k.root.group({ steps: [1, 2], d: 0 }).node.appendChild(pointHit);

      function drawRuler(deg, grow, opts) {
        opts = opts || {};
        var d = dir(deg), t = grow == null ? 1 : grow, threads = '', spots = '';
        threadLayer.clear(); rulerLayer.clear();
        if (deg == null) return;
        var e = ends(deg);
        if (opts.second != null) { var e2 = ends(opts.second); rulerLayer.path(seg(e2[0], e2[1]), { w: 0.8, op: 0.55 }); }
        rulerLayer.path(seg(e[0], e[1]), { w: 1.6, op: 0.95, accent: true });
        C.forEach(function (p) {
          var l = p[0] * d[0] + p[1] * d[1];
          var x0 = sx(p[0] + MX), y0 = sy(p[1] + MY), x1 = sx(l * d[0] + MX), y1 = sy(l * d[1] + MY);
          threads += seg([x0, y0], [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
          if (t >= 1) spots += 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' h0.01 ';
        });
        if (!opts.noThreads) threadLayer.path(threads, { w: 0.7, op: 0.45 });
        if (spots) threadLayer.path(spots, { w: 3.6, op: 0.75 });
      }

      /* ---------------- step 0: what would you keep? ---------------- */
      var g0 = k.root.group({ steps: [0], d: 250 });
      g0.text(SIDE, 60, 'total spread', { kind: 'label' });
      var v0total = g0.text(SIDE + COLW, 60, f1(TOTAL), { kind: 'val', anchor: 'end' });
      g0.text(SIDE, 80, 'spread kept', { kind: 'label' });
      var v0kept = g0.text(SIDE + COLW, 80, '–', { kind: 'val', anchor: 'end' });
      g0.text(SIDE, 100, 'share kept', { kind: 'label' });
      var v0share = g0.text(SIDE + COLW, 100, '–', { kind: 'val', anchor: 'end' });
      g0.line(SIDE, 112, SIDE + COLW, 112, { w: 0.6, op: 0.45, rough: 0.3 });
      k.root.group({ steps: [0], d: 500 }).callout('a', 'keep one number each', SIDE, 142);

      var CHOICES = [{ key: 'across', deg: 0, label: 'keep across' }, { key: 'up', deg: 90, label: 'keep up' }, { key: 'slant', deg: 45, label: 'keep a slanted one' }];
      var bars = k.root.group({ steps: [0], d: 0 });
      bars.text(SIDE, 286, 'share kept by each', { kind: 'label' });
      bars.line(SIDE, CURVE.base, SIDE + COLW, CURVE.base, { w: 0.8, rough: 0.3 });
      var barDrawn = {}, barG = bars.group({ d: 0 });
      function drawBar(i) {
        if (barDrawn[i]) return;
        barDrawn[i] = true;
        var c = CHOICES[i], share = spreadAt(c.deg) / TOTAL, cx = SIDE + 26 + i * 53, w = 26;
        var yTop = CURVE.base - (CURVE.base - 316) * share;
        var box = [[cx - w / 2, CURVE.base], [cx + w / 2, CURVE.base], [cx + w / 2, yTop], [cx - w / 2, yTop]];
        var g = barG.group({ d: 0 });
        g.hatch(box, { op: 0.45 });
        g.poly(box, { w: 0.9, rough: 0.4 });
        g.text(cx, yTop - 6, (Math.round(share * 1000) / 10).toFixed(1) + '%', { kind: 'axis', anchor: 'middle' });
        g.text(cx, CURVE.base + 14, c.key, { kind: 'axis', anchor: 'middle' });
      }
      function choose(i) {
        if (busy || k.step() !== 0) return;
        var c = CHOICES[i];
        busy = true;
        v0kept.set('–'); v0share.set('–');
        cancel = k.animate(800, function (t) {
          drawRuler(c.deg, t);
          if (t >= 1) {
            busy = false;
            var s = spreadAt(c.deg);
            v0kept.set(f1(s)); v0share.set(pct(s)); drawBar(i);
          }
        });
      }
      CHOICES.forEach(function (c, i) { k.button(SIDE, 176 + i * 34, c.label, function () { choose(i); }, { steps: [0] }); });

      /* ---------------- step 1: turn the ruler ---------------- */
      var g1 = k.root.group({ steps: [1], d: 250 });
      g1.text(SIDE, 60, 'spread on ruler', { kind: 'label' });
      var v1spread = g1.text(SIDE + COLW, 60, '', { kind: 'val', anchor: 'end' });
      var l1share = g1.text(SIDE, 80, 'share of ' + f1(TOTAL), { kind: 'label' });
      var v1share = g1.text(SIDE + COLW, 80, '', { kind: 'val', anchor: 'end' });
      g1.line(SIDE, 92, SIDE + COLW, 92, { w: 0.6, op: 0.45, rough: 0.3 });
      g1.text(SIDE, 176, 'ruler: across', { kind: 'label' });
      var v1across = g1.text(SIDE + COLW, 176, '', { kind: 'val', anchor: 'end' });
      g1.text(SIDE, 194, 'ruler: up', { kind: 'label' });
      var v1up = g1.text(SIDE + COLW, 194, '', { kind: 'val', anchor: 'end' });

      var curveG = k.root.group({ steps: [1], d: 300 });
      curveG.text(SIDE, 296, 'spread at each angle', { kind: 'label' });
      curveG.line(CURVE.x0, CURVE.base, CURVE.x1, CURVE.base, { w: 0.8, rough: 0.3 });
      curveG.line(CURVE.x0, CURVE.base, CURVE.x0, CURVE.top, { w: 0.8, rough: 0.3 });
      [0, 90, 180].forEach(function (a) {
        curveG.text(CURVE.x0 + (CURVE.x1 - CURVE.x0) * a / 180, CURVE.base + 14, a + '°', { kind: 'axis', anchor: a === 0 ? 'start' : a === 180 ? 'end' : 'middle' });
      });
      var curveLive = k.root.layer({ steps: [1] });
      function cx(a) { return CURVE.x0 + (CURVE.x1 - CURVE.x0) * a / 180; }
      function cy(v) { return CURVE.base - (CURVE.base - CURVE.top) * v / (PEAK * 1.05); }
      function drawCurve() {
        curveLive.clear();
        var d = '';
        Object.keys(visited).forEach(function (a) { a = +a; d += 'M' + cx(a).toFixed(1) + ' ' + cy(spreadAt(a)).toFixed(1) + ' h0.01 '; });
        if (d) curveLive.path(d, { w: 2.4, op: 0.8 });
        curveLive.line(cx(angle), CURVE.base, cx(angle), cy(spreadAt(angle)), { w: 0.6, op: 0.6, rough: 0.2 });
        curveLive.circle(cx(angle), cy(spreadAt(angle)), 3.4, { w: 1.1, op: 0.95 });
      }

      /* the grip at the ruler's upper end: drag it round */
      var grip = k.root.group({ steps: [1], d: 400 });
      var gripNode = grip.group({ d: 0 });
      gripNode.circle(0, 0, 7, { w: 1.1, op: 0.9 });
      var gripHit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      gripHit.setAttribute('r', 16); gripHit.setAttribute('class', 'ik-hit');
      gripNode.node.appendChild(gripHit);
      function gripAt(a) { var d = dir(a); return [sx(MX + HANDLE * d[0]), sy(MY + HANDLE * d[1])]; }
      var drag = k.draggable(gripNode.node, {
        label: 'The ruler. Arrow keys turn it.',
        bounds: { x0: PLOT.x, y0: PLOT.y, x1: PLOT.x + PLOT.w, y1: PLOT.y + PLOT.h },
        onMove: function (x, y) {
          if (busy || k.step() !== 1) return;
          var a = Math.round(Math.atan2(sy(MY) - y, x - sx(MX)) * 180 / Math.PI);
          if (a < 0) a += 180;
          if (a >= 180) a -= 180;
          slider.set(a, true); setAngle(a);
        },
        onEnd: function () { var p = gripAt(angle); drag.set(p[0], p[1]); }
      });
      grip.text(240, 384, 'drag the ring to turn it', { kind: 'hand' });

      function setAngle(a, quiet) {
        angle = a; visited[a] = true;
        if (!quiet) remember(a);
        var p = gripAt(a), d = dir(a), s = spreadAt(a);
        gripNode.node.setAttribute('transform', 'translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')');
        drag.set(p[0], p[1]);
        drawRuler(a);
        v1spread.set(f1(s)); v1share.set(pct(s));
        v1across.set(f2(d[0])); v1up.set(f2(d[1]));
        drawCurve();
      }
      var slider = k.slider({
        x: SIDE, y: 136, w: COLW, min: 0, max: 179, step: 1, value: DEFAULT_ANGLE,
        label: 'angle of ruler', steps: [1],
        format: function (v) { return v + '°'; },
        onChange: function (v) { if (!busy) setAngle(v); }
      });
      k.button(SIDE, 230, 'try every angle', function () {
        if (busy || k.step() !== 1) return;
        busy = true;
        var from = angle;
        // sweep from where the ruler is, once round, then come to rest on the biggest spread seen
        var back = ((BEST - from) % 180 + 180) % 180;
        if (back > 90) back -= 180;                        // the short way round to the best angle
        cancel = k.animate(2600, function (t) {
          var a = t < 0.8 ? from + 180 * t / 0.8 : from + back * (t - 0.8) / 0.2;
          a = ((Math.round(a) % 180) + 180) % 180;
          slider.set(a, true); setAngle(a, true);
          if (t >= 1) { for (var v = 0; v < 180; v++) visited[v] = true; busy = false; slider.set(BEST, true); setAngle(BEST); }
        });
      }, { steps: [1] });
      k.root.group({ steps: [1], d: 600 }).callout('b', 'the most spread wins', SIDE, 264);

      /* ---------------- step 2: what did you lose? ---------------- */
      var g2 = k.root.group({ steps: [2], d: 250 });
      var l2best = g2.text(SIDE, 60, '', { kind: 'label' });
      var v2best = g2.text(SIDE + COLW, 60, '', { kind: 'val', anchor: 'end' });
      var l2right = g2.text(SIDE, 80, '', { kind: 'label' });
      var v2right = g2.text(SIDE + COLW, 80, '', { kind: 'val', anchor: 'end' });
      g2.text(SIDE, 100, 'together', { kind: 'label' });
      var v2both = g2.text(SIDE + COLW, 100, '', { kind: 'val', anchor: 'end' });
      g2.line(SIDE, 112, SIDE + COLW, 112, { w: 0.6, op: 0.45, rough: 0.3 });
      g2.text(SIDE, 132, 'share kept', { kind: 'label' });
      var v2share = g2.text(SIDE + COLW, 132, '', { kind: 'val', anchor: 'end' });
      function readouts() {                        // the numbers that hang on the points themselves
        var s1 = spreadAt(BEST), s2 = spreadAt((BEST + 90) % 180);
        v0total.set(f1(TOTAL));
        l1share.set('share of ' + f1(TOTAL));
        l2best.set('best ruler, ' + BEST + '°'); v2best.set(f1(s1));
        l2right.set('right angle, ' + ((BEST + 90) % 180) + '°'); v2right.set(f1(s2));
        v2both.set(f1(s1 + s2)); v2share.set(pct(s1));
      }
      readouts();
      var collapsed = false;
      var bKeep = k.button(SIDE, 176, 'keep one number', function () {
        if (busy || k.step() !== 2) return;
        collapse(!collapsed);
      }, { steps: [2] });
      k.root.group({ steps: [2], d: 600 }).callout('c', 'the short threads are lost', SIDE, 222);
      var hand2 = k.root.group({ steps: [2], d: 900 });
      hand2.text(SIDE, 270, 'the same total,', { kind: 'hand' });
      hand2.text(SIDE, 292, 'split two ways.', { kind: 'hand' });

      // each mark sits where its person is now (moved by the reader or not), plus t of the way onto the ruler
      function place(t) {
        var d = dir(BEST);
        C.forEach(function (p, i) {
          var l = p[0] * d[0] + p[1] * d[1];
          var bx = (pts[i][0] - POINTS[i][0]) * U, by = -(pts[i][1] - POINTS[i][1]) * U;
          var dx = bx + (l * d[0] - p[0]) * U * t, dy = by - (l * d[1] - p[1]) * U * t;
          if (dx || dy) nodes[i].setAttribute('transform', 'translate(' + dx.toFixed(1) + ' ' + dy.toFixed(1) + ')');
          else nodes[i].removeAttribute('transform');
        });
      }
      function collapse(on) {
        busy = true;
        cancel = k.animate(1100, function (t) {
          var u = on ? t : 1 - t;
          place(u);
          drawRuler(BEST, 1, { second: (BEST + 90) % 180, noThreads: u > 0.02 && on });
          if (t >= 1) { busy = false; collapsed = on; bKeep.set(on ? 'spread them out again' : 'keep one number'); drawRuler(BEST, 1, { second: (BEST + 90) % 180, noThreads: on }); }
        });
      }

      /* ---------------- dragging the people themselves (steps 1 and 2) ---------------- */
      var bBack = k.button(SIDE, 24, 'put the points back', function () { putBack(); });
      var note = k.root.group({ d: 0 });
      note.text(PLOT.x, 438, 'points moved: the text is about the original points', { kind: 'axis' });
      bBack.node.style.display = note.node.style.display = 'none';

      function refresh() {
        recompute();
        readouts();
        place(0);
        bBack.node.style.display = note.node.style.display = moved ? '' : 'none';
        // the bars in step 0 were measured on the people as they were: let them be measured again
        while (barG.node.firstChild) barG.node.removeChild(barG.node.firstChild);
        barDrawn = {};
        var st = k.step();
        if (st === 0) { drawRuler(null); v0kept.set('–'); v0share.set('–'); }
        else if (st === 1) setAngle(angle, true);
        else drawRuler(BEST, 1, { second: (BEST + 90) % 180 });
      }
      var frame = 0;
      function soon() {                          // at most one recompute per animation frame
        if (frame) return;
        frame = requestAnimationFrame(function () { frame = 0; refresh(); });
      }
      function putBack() {
        if (busy) return;
        pts.forEach(function (p, i) { p[0] = POINTS[i][0]; p[1] = POINTS[i][1]; });
        refresh();
      }
      var held = -1, grab = null;
      function nearest(p) {
        var best = -1, bd = REACH * REACH;
        pts.forEach(function (q, i) {
          var dx = sx(q[0]) - p.x, dy = sy(q[1]) - p.y, dd = dx * dx + dy * dy;
          if (dd <= bd) { bd = dd; best = i; }
        });
        return best;
      }
      function canDrag() { var st = k.step(); return !busy && (st === 1 || (st === 2 && !collapsed)); }
      pointHit.addEventListener('pointerdown', function (e) {
        if (e.button || !canDrag()) return;
        var p = k.toFigure(e), i = nearest(p);
        if (i < 0) return;
        e.preventDefault();
        try { pointHit.setPointerCapture(e.pointerId); } catch (err) {}
        held = i; grab = { dx: sx(pts[i][0]) - p.x, dy: sy(pts[i][1]) - p.y };
        pointHit.style.cursor = 'grabbing';
      });
      pointHit.addEventListener('pointermove', function (e) {
        var p = k.toFigure(e);
        if (held < 0) { pointHit.style.cursor = canDrag() && nearest(p) >= 0 ? 'grab' : ''; return; }
        if (!canDrag()) return;
        var x = Math.round((X0 + (p.x + grab.dx - PLOT.x) / U) * 10) / 10;
        var y = Math.round((Y0 + (PLOT.y + PLOT.h - p.y - grab.dy) / U) * 10) / 10;
        x = k.clamp(x, X0 + 1, X0 + PLOT.w / U - 1); y = k.clamp(y, Y0 + 1, Y0 + PLOT.h / U - 1);
        if (x === pts[held][0] && y === pts[held][1]) return;
        pts[held][0] = x; pts[held][1] = y;
        var n = nodes[held], dx = (x - POINTS[held][0]) * U, dy = -(y - POINTS[held][1]) * U;
        n.setAttribute('transform', 'translate(' + dx.toFixed(1) + ' ' + dy.toFixed(1) + ')');   // follows the pointer now
        soon();                                  // the middle, the spreads and the rulers on the next frame
      });
      function release() {
        if (held < 0) return;
        held = -1; pointHit.style.cursor = 'grab';
        if (frame) { cancelAnimationFrame(frame); frame = 0; }
        refresh();
      }
      pointHit.addEventListener('pointerup', release);
      pointHit.addEventListener('pointercancel', release);

      k.onStep(function (step) {
        if (cancel) cancel();
        busy = false; place(0); collapsed = false; bKeep.set('keep one number');
        if (step === 0) { drawRuler(null); v0kept.set('–'); v0share.set('–'); }
        else if (step === 1) { var a = remembered(); a = a == null ? DEFAULT_ANGLE : a; slider.set(a, true); setAngle(a, true); }
        else drawRuler(BEST, 1, { second: (BEST + 90) % 180 });
      });
    }
  });
})();
