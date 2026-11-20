/* k-means figure — groups nobody labelled, found by Lloyd's algorithm running for real in the browser.
   Every assignment, centre, boundary and total is computed from the seeded made-up points that are drawn.
   "Total" everywhere is the k-means objective: the sum of squared distances from each point to its own centre.
   Steps: 0 the problem (points only, one mark, no labels) · 1 one half-step at a time (assign / move, button)
          · 2 a different start, a different answer (new start button, drag a centre, run)
          · 3 choose k (slider; best of 20 seeded starts per k; elbow curve in the side column).
   Clusters are told apart by mark shape. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };       // the plot area, in figure pixels
  var SIDE = 462;                                    // left edge of the column beside the plot
  var DOM = 10;                                      // data runs 0..10 on both axes
  var SHAPES = ['o', '+', 'x', 'sq', 'tri', 'dot'];  // cluster j is drawn with SHAPES[j]
  var KMAX = SHAPES.length;
  var NSTART = 20;                                   // starts tried per k for the elbow curve
  var WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

  function makeData(rand) {
    var pts = [], i;
    function g() { return (rand() + rand() + rand() - 1.5) * 1.75; }
    for (i = 0; i < 14; i++) pts.push({ x: 2.7 + g(), y: 3.0 + g() });
    for (i = 0; i < 14; i++) pts.push({ x: 7.3 + g(), y: 2.9 + g() });
    for (i = 0; i < 14; i++) pts.push({ x: 5.0 + g(), y: 7.3 + g() });
    return pts;
  }

  function d2(p, c) { return (p.x - c.x) * (p.x - c.x) + (p.y - c.y) * (p.y - c.y); }

  /* the assignment step: each point to its nearest centre */
  function nearest(pts, C) {
    return pts.map(function (p) {
      var best = 0, bd = Infinity;
      for (var j = 0; j < C.length; j++) { var d = d2(p, C[j]); if (d < bd) { bd = d; best = j; } }
      return best;
    });
  }
  /* the update step: each centre to the mean of its points (a centre with no points stays where it is) */
  function means(pts, A, C) {
    return C.map(function (c, j) {
      var sx = 0, sy = 0, n = 0;
      for (var i = 0; i < pts.length; i++) if (A[i] === j) { sx += pts[i].x; sy += pts[i].y; n++; }
      return n ? { x: sx / n, y: sy / n } : { x: c.x, y: c.y };
    });
  }
  /* the objective: total squared distance from each point to its own centre */
  function total(pts, A, C) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) if (A[i] >= 0) s += d2(pts[i], C[A[i]]);
    return s;
  }
  /* run assign / move until no centre moves; keep every position on the way */
  function lloyd(pts, C0) {
    var traj = [C0], C = C0, A, t;
    for (t = 0; t < 60; t++) {
      A = nearest(pts, C);
      var N = means(pts, A, C), shift = 0;
      for (var j = 0; j < C.length; j++) shift = Math.max(shift, d2(N[j], C[j]));
      if (shift < 1e-12) break;
      traj.push(N); C = N;
    }
    A = nearest(pts, C);
    return { traj: traj, C: C, A: A, total: total(pts, A, C), moves: traj.length - 1 };
  }
  /* a start the way R's kmeans() makes one: k distinct data points picked at random (seeded) */
  function pickStart(pts, kk, rand) {
    var idx = [];
    while (idx.length < kk) { var i = Math.floor(rand() * pts.length); if (idx.indexOf(i) < 0) idx.push(i); }
    return idx.map(function (i) { return { x: pts[i].x, y: pts[i].y }; });
  }

  /* the two points where the line  a1 x + a2 y + c = 0  crosses the box 0..DOM, or null */
  function clipLine(a1, a2, c) {
    var hits = [], v;
    if (Math.abs(a2) > 1e-9) {
      v = -c / a2; if (v >= 0 && v <= DOM) hits.push([0, v]);
      v = -(c + a1 * DOM) / a2; if (v >= 0 && v <= DOM) hits.push([DOM, v]);
    }
    if (Math.abs(a1) > 1e-9) {
      v = -c / a1; if (v > 0 && v < DOM) hits.push([v, 0]);
      v = -(c + a2 * DOM) / a1; if (v > 0 && v < DOM) hits.push([v, DOM]);
    }
    return hits.length >= 2 ? [hits[0], hits[hits.length - 1]] : null;
  }
  /* the borders between territories: for each pair of centres, the stretch of their perpendicular
     bisector along which those two really are the nearest centres */
  function borders(C) {
    var out = [];
    for (var i = 0; i < C.length; i++) for (var j = i + 1; j < C.length; j++) {
      var a1 = 2 * (C[j].x - C[i].x), a2 = 2 * (C[j].y - C[i].y);
      var c = C[i].x * C[i].x + C[i].y * C[i].y - C[j].x * C[j].x - C[j].y * C[j].y;
      var seg = clipLine(a1, a2, c);
      if (!seg) continue;
      var t0 = 0, t1 = 1;
      for (var m = 0; m < C.length && t0 < t1; m++) {
        if (m === i || m === j) continue;
        var p = { x: seg[0][0], y: seg[0][1] }, q = { x: seg[1][0], y: seg[1][1] };
        var fp = d2(p, C[m]) - d2(p, C[i]), fq = d2(q, C[m]) - d2(q, C[i]);   // linear along the segment
        if (fp < 0 && fq < 0) { t1 = t0; break; }
        if (fp < 0) t0 = Math.max(t0, fp / (fp - fq));
        else if (fq < 0) t1 = Math.min(t1, fp / (fp - fq));
      }
      if (t1 - t0 > 1e-6) out.push([
        [seg[0][0] + t0 * (seg[1][0] - seg[0][0]), seg[0][1] + t0 * (seg[1][1] - seg[0][1])],
        [seg[0][0] + t1 * (seg[1][0] - seg[0][0]), seg[0][1] + t1 * (seg[1][1] - seg[0][1])]
      ]);
    }
    return out;
  }

  window.InkKit.define('kmeans-figure', {
    label: 'k-means clustering: unlabelled points, the centres the algorithm moves, and the total squared distance it lowers',
    steps: 4,
    seed: 23,
    draw: function (k) {
      var sx = k.scale(0, DOM, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(0, DOM, PLOT.y + PLOT.h, PLOT.y);
      var pts = makeData(k.rng(31));
      var n = pts.length;

      /* ---- everything the steps need, computed once ---- */
      // 40 seeded starts for k = 3, each run to the end
      var rs = k.rng(5), runs = [], i;
      for (i = 0; i < 40; i++) { var s0 = pickStart(pts, 3, rs); runs.push({ start: s0, fit: lloyd(pts, s0) }); }
      var best3 = Math.min.apply(null, runs.map(function (r) { return r.fit.total; }));
      function isBest(r) { return r.fit.total < best3 + 1e-6; }
      // the tour of starts: first one that reaches the best answer but needs a few rounds to get there,
      // then the first that ends somewhere worse, then the rest in the order they were drawn
      var first = runs.filter(function (r) { return isBest(r) && r.fit.moves >= 3; })[0] || runs.filter(isBest)[0];
      var second = runs.filter(function (r) { return !isBest(r); })[0];
      var tour = [first].concat(second ? [second] : []);
      runs.forEach(function (r) { if (tour.length < 6 && tour.indexOf(r) < 0) tour.push(r); });
      // the best of NSTART seeded starts for every k, for the elbow curve
      var rk = k.rng(77), byK = [null];
      for (var kk = 1; kk <= KMAX; kk++) {
        var bestFit = null;
        for (i = 0; i < NSTART; i++) { var f = lloyd(pts, pickStart(pts, kk, rk)); if (!bestFit || f.total < bestFit.total) bestFit = f; }
        byK.push(bestFit);
      }
      var elbow = 2, bend = -Infinity;
      for (kk = 2; kk < KMAX; kk++) {
        var b = (byK[kk - 1].total - byK[kk].total) - (byK[kk].total - byK[kk + 1].total);
        if (b > bend) { bend = b; elbow = kk; }
      }

      /* ---- live state ---- */
      var C = [], A = pts.map(function () { return -1; });
      var phase = 'assigned', round = 1, switched = null, busy = false;     // step 1
      var tourAt = 1, bestSeen = Infinity, mine = false;                    // step 2
      var kNow = 3;                                                         // step 3

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'x₁', ylabel: 'x₂' });

      var edges = k.root.layer({ steps: [3] });        // borders between territories
      var links = k.root.layer({ steps: [1, 2] });     // each point stitched to its centre

      /* ---- the points: one node per shape, only the current one shown ---- */
      var marks = k.root.group({ d: 200, stagger: 16 });
      var later = k.root.group({ d: 0, stagger: 0 });
      pts.forEach(function (p) {
        p.nodes = SHAPES.map(function (shape, j) {
          var node = (j ? later : marks).mark(sx(p.x), sy(p.y), shape, shape === 'dot' ? { r: 4.4 } : null);
          if (j) node.style.display = 'none';
          return node;
        });
        p.shown = 0;
      });

      /* ---- the centres: a heavier ring with a dot, moved by transform, draggable in step 2 ---- */
      var centres = k.root.group({ steps: [1, 2, 3], d: 300, stagger: 80 });
      var cents = [];
      for (i = 0; i < KMAX; i++) (function (j) {
        var g = centres.group();
        g.mark(0, 0, 'o', { r: 8, w: 1.7, op: 1 });
        g.dot(0, 0, 2);
        var drag = k.draggable(g.node, {
          x: 0, y: 0, label: 'Centre ' + (j + 1) + '. Arrow keys move it.',
          bounds: { x0: PLOT.x + 10, y0: PLOT.y + 10, x1: PLOT.x + PLOT.w - 10, y1: PLOT.y + PLOT.h - 10 },
          onMove: function (x, y) {
            if (k.step() !== 2 || j >= C.length || busy) return;
            C[j] = { x: (x - PLOT.x) / PLOT.w * DOM, y: (PLOT.y + PLOT.h - y) / PLOT.h * DOM };
            A = nearest(pts, C);
            mine = true;
            render();
          }
        });
        cents.push({ node: g.node, drag: drag });
      })(i);

      /* ---- the side column ---- */
      var side = k.root.group({ steps: [1, 2, 3], d: 300 });
      side.text(SIDE, 60, 'total sq. dist.', { kind: 'label' });
      var totalVal = side.text(SIDE + 158, 60, '', { kind: 'val', anchor: 'end' });

      var s1 = k.root.group({ steps: [1], d: 350 });
      s1.text(SIDE, 80, 'round', { kind: 'label' });
      var roundVal = s1.text(SIDE + 158, 80, '', { kind: 'val', anchor: 'end' });
      s1.text(SIDE, 100, 'points switched', { kind: 'label' });
      var switchVal = s1.text(SIDE + 158, 100, '', { kind: 'val', anchor: 'end' });
      s1.line(SIDE, 112, SIDE + 158, 112, { w: 0.6, op: 0.45, rough: 0.3 });
      s1.callout('b', 'assign, then move', SIDE, 186, { d: 700 });

      var s2 = k.root.group({ steps: [2], d: 350 });
      s2.text(SIDE, 80, 'best so far', { kind: 'label' });
      var bestVal = s2.text(SIDE + 158, 80, '', { kind: 'val', anchor: 'end' });
      s2.text(SIDE, 100, 'start', { kind: 'label' });
      var startVal = s2.text(SIDE + 158, 100, '', { kind: 'val', anchor: 'end' });
      s2.line(SIDE, 112, SIDE + 158, 112, { w: 0.6, op: 0.45, rough: 0.3 });
      s2.callout('c', 'same points, new start', SIDE, 186, { d: 500 });
      s2.text(SIDE, 208, 'or drag a centre, then run', { kind: 'axis', d: 800 });

      var s3 = k.root.group({ steps: [3], d: 350 });
      s3.line(SIDE, 72, SIDE + 158, 72, { w: 0.6, op: 0.45, rough: 0.3 });
      var EL = { x: SIDE + 30, y: 178, w: 124, h: 108 };
      var ex = k.scale(1, KMAX, EL.x + 6, EL.x + EL.w - 4), ey = k.scale(0, byK[1].total, EL.y + EL.h, EL.y + 6);
      var xt = [];
      for (kk = 1; kk <= KMAX; kk++) xt.push([ex(kk), String(kk)]);
      s3.axes({ x: EL.x, y: EL.y, w: EL.w, h: EL.h, xticks: xt, xlabel: 'k',
        yticks: [[ey(0), '0'], [ey(byK[1].total), byK[1].total.toFixed(0)]], ylabel: 'total, best of ' + NSTART });
      var curve = byK.slice(1).map(function (f, j) { return [ex(j + 1), ey(f.total)]; });
      curve.forEach(function (p) { s3.dot(p[0], p[1], 2.2); });
      var here = k.root.layer({ steps: [3] });          // the curve, and the ring on the current k
      s3.callout('d', 'slide k', SIDE, 350, { d: 400 });
      s3.text(SIDE, 382, 'after ' + WORDS[elbow] + ', more', { kind: 'hand', d: 700 });
      s3.text(SIDE, 404, 'centres buy little.', { kind: 'hand', d: 1100 });

      k.root.group({ steps: [0] }).callout('a', 'no labels. any groups?', SIDE, 150, { d: 900 });

      /* ---- draw the current state ---- */
      function render() {
        var step = k.step(), j;
        pts.forEach(function (p, idx) {
          var want = step === 0 || A[idx] < 0 ? 0 : A[idx];
          if (want !== p.shown) { p.nodes[p.shown].style.display = 'none'; p.nodes[want].style.display = ''; p.shown = want; }
        });
        for (j = 0; j < KMAX; j++) {
          var on = step > 0 && j < C.length;
          cents[j].node.style.display = on ? '' : 'none';
          if (!on) continue;
          var cx = sx(C[j].x), cy = sy(C[j].y);
          cents[j].node.setAttribute('transform', 'translate(' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')');
          cents[j].drag.set(cx, cy);
        }
        links.clear(); edges.clear(); here.clear();
        if (step === 1 || step === 2) {
          var d = '';
          pts.forEach(function (p, idx) {
            if (A[idx] < 0) return;
            var c = C[A[idx]], x1 = sx(p.x), y1 = sy(p.y), x2 = sx(c.x), y2 = sy(c.y);
            var len = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
            if (len < 16) return;                       // stop short of the mark and of the ring
            var u = 6 / len, v = 1 - 9.5 / len;
            d += 'M' + (x1 + (x2 - x1) * u).toFixed(1) + ' ' + (y1 + (y2 - y1) * u).toFixed(1) +
                 'L' + (x1 + (x2 - x1) * v).toFixed(1) + ' ' + (y1 + (y2 - y1) * v).toFixed(1);
          });
          if (d) {
            var thread = links.path(d, { w: 0.8, op: 0.42 });
            thread.removeAttribute('pathLength');
            thread.setAttribute('stroke-dasharray', '3 3.4');
          }
        }
        if (step === 3) {
          borders(C).forEach(function (seg) {
            edges.line(sx(seg[0][0]), sy(seg[0][1]), sx(seg[1][0]), sy(seg[1][1]), { w: 0.7, op: 0.5, rough: 0.3 });
          });
          here.polyline(curve, { w: 1.1, op: 0.85 });
          here.circle(ex(kNow), ey(byK[kNow].total), 6, { accent: true, w: 1.5, op: 0.95 });
        }
        if (step > 0) totalVal.set(total(pts, A, C).toFixed(1));
        roundVal.set(String(round));
        switchVal.set(switched === null ? '–' : String(switched));
        bestVal.set(isFinite(bestSeen) ? bestSeen.toFixed(1) : '');
        startVal.set(mine ? 'yours' : '#' + (tourAt + 1));
      }

      /* glide the centres along a list of positions; the assignment follows them. Ends exactly on the last. */
      function glide(traj, reassign, done) {
        var T = traj.length - 1;
        if (T < 1) { C = traj[0].slice(); if (reassign) A = nearest(pts, C); render(); if (done) done(); return; }
        busy = true;
        k.animate(Math.min(2200, 420 * T), function (t) {
          var u = t * T, a = Math.min(T - 1, Math.floor(u)), f = u - a;
          C = traj[a].map(function (c, j) { var e = traj[a + 1][j]; return { x: c.x + (e.x - c.x) * f, y: c.y + (e.y - c.y) * f }; });
          if (t >= 1) { C = traj[T].slice(); busy = false; }
          if (reassign) A = nearest(pts, C);
          if (t >= 1 && done) done();
          render();
        });
      }

      /* ---- step 1: one half-step per press ---- */
      var stepBtn = k.button(SIDE, 146, 'next: assign', function () {
        if (busy || k.step() !== 1) return;
        if (phase === 'assigned') {
          phase = 'moved';
          glide([C, means(pts, A, C)], false, function () { stepBtn.set('next: assign'); });
        } else if (phase === 'moved') {
          var B = nearest(pts, C);
          switched = B.filter(function (v, idx) { return v !== A[idx]; }).length;
          A = B; round++;
          phase = switched ? 'assigned' : 'done';
          stepBtn.set(switched ? 'next: move' : 'start over');
          render();
        } else resetOne();
      }, { steps: [1] });
      function resetOne() {
        C = tour[0].start.map(function (c) { return { x: c.x, y: c.y }; });
        A = nearest(pts, C);
        phase = 'assigned'; round = 1; switched = null; busy = false;
        stepBtn.set('next: move');
        render();
      }

      /* ---- step 2: other starts, or your own ---- */
      function finish(fit) { bestSeen = Math.min(bestSeen, fit.total); }
      k.button(SIDE, 146, 'new start', function () {
        if (busy || k.step() !== 2) return;
        tourAt = (tourAt + 1) % tour.length; mine = false;
        var r = tour[tourAt];
        glide(r.fit.traj, true, function () { finish(r.fit); });
      }, { steps: [2] });
      k.button(SIDE + 158, 146, 'run', function () {
        if (busy || k.step() !== 2) return;
        var fit = lloyd(pts, C);
        glide(fit.traj, true, function () { finish(fit); });
      }, { steps: [2], anchor: 'end' });

      /* ---- step 3: k ---- */
      k.slider({
        x: SIDE, y: 122, w: 158, min: 1, max: KMAX, step: 1, value: kNow, label: 'k  clusters', steps: [3],
        onChange: function (v) { kNow = v; C = byK[kNow].C; A = byK[kNow].A; render(); }
      });

      k.onStep(function (step) {
        busy = false;
        cents.forEach(function (c) {
          c.node.style.pointerEvents = step === 2 ? 'auto' : 'none';
          c.node.classList.toggle('ik-accent', step === 1 || step === 2);   // in step 3 the accent is the ring on the curve
        });
        if (step === 0) { C = []; A = pts.map(function () { return -1; }); render(); }
        else if (step === 1) resetOne();
        else if (step === 2) {
          // opens on the second start of the tour, already run; "best so far" also counts the first
          tourAt = tour.length > 1 ? 1 : 0; mine = false;
          bestSeen = Math.min(tour[0].fit.total, tour[tourAt].fit.total);
          C = tour[tourAt].fit.C.slice(); A = tour[tourAt].fit.A;
          render();
        } else { C = byK[kNow].C; A = byK[kNow].A; render(); }
      });
    }
  });
})();
