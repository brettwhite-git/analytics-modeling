/* CART figure — the plane and the tree, side by side, telling the same story.
   A greedy classification tree is grown in the browser: at every node the axis-aligned cut with the lowest
   weighted Gini impurity is found by trying every midpoint on both axes. The rectangles on the left and the
   tree on the right are two drawings of that one fitted tree, and every count is read off it.
   Steps: 0 the problem (the best single straight line still gets many wrong) · 1 the first split (drag a
          vertical cut, read its weighted Gini) · 2 grow (depth slider, training error) · 3 overfitting
          (the same trees scored on held-out points; the depth pruning would keep).
   Made-up points: a band of one class inside the other, with about one label in eight flipped.
   Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var NS = 'http://www.w3.org/2000/svg';
  var PLOT = { x: 40, y: 36, w: 350, h: 350 };       // the plane
  var X0 = 414, X1 = 624;                            // the column beside it: tree, slider, readouts
  var DOM = 10;                                      // data runs 0..10 on both axes
  var N = 70, FLIP = 0.12, MAX_DEPTH = 5;
  var TREE_Y = 48, LEVEL = 27;                       // root height and the drop per level
  var CUT_START = 7.4;

  function makeData(rand) {
    var pts = [];
    for (var i = 0; i < N; i++) {
      var x = 0.4 + rand() * 9.2, y = 0.4 + rand() * 9.2;
      var c = (x > 3.4 && x < 6.9 && y > 3.3) ? 1 : -1;        // the true pattern: a band of plus
      if (rand() < FLIP) c = -c;                                // and some noise
      pts.push({ x: x, y: y, c: c });
    }
    return pts;
  }

  /* Gini impurity of a node holding `pos` plus out of `n` */
  function gini(pos, n) { if (!n) return 0; var q = pos / n; return 2 * q * (1 - q); }
  function countPos(pts) { var p = 0; for (var i = 0; i < pts.length; i++) if (pts[i].c > 0) p++; return p; }

  /* what one cut does: counts on each side, the weighted Gini, and the errors if each side votes */
  function scoreCut(pts, ax, t) {
    var nl = 0, pl = 0, n = pts.length, P = countPos(pts);
    for (var i = 0; i < n; i++) if (pts[i][ax] < t) { nl++; if (pts[i].c > 0) pl++; }
    var nr = n - nl, pr = P - pl;
    return { nl: nl, pl: pl, nr: nr, pr: pr, g: (nl * gini(pl, nl) + nr * gini(pr, nr)) / n, wrong: Math.min(pl, nl - pl) + Math.min(pr, nr - pr) };
  }

  /* the best cut of a node: every midpoint on the given axes, lowest weighted Gini */
  function bestSplit(pts, axes) {
    var n = pts.length, P = countPos(pts), best = null;
    axes.forEach(function (ax) {
      var s = pts.slice().sort(function (a, b) { return a[ax] - b[ax]; }), lp = 0;
      for (var i = 1; i < n; i++) {
        if (s[i - 1].c > 0) lp++;
        if (s[i][ax] - s[i - 1][ax] < 1e-9) continue;
        var g = (i * gini(lp, i) + (n - i) * gini(P - lp, n - i)) / n;
        if (!best || g < best.g - 1e-12) best = { ax: ax, t: (s[i][ax] + s[i - 1][ax]) / 2, g: g };
      }
    });
    return best;
  }

  function grow(pts, depth) {
    var P = countPos(pts), node = { n: pts.length, pos: P, cls: P * 2 > pts.length ? 1 : -1, depth: depth };
    if (depth < MAX_DEPTH && P > 0 && P < pts.length) {
      var b = bestSplit(pts, ['x', 'y']);
      if (b && b.g < gini(P, pts.length) - 1e-9) {
        node.ax = b.ax; node.t = b.t;
        node.L = grow(pts.filter(function (p) { return p[b.ax] < b.t; }), depth + 1);
        node.R = grow(pts.filter(function (p) { return p[b.ax] >= b.t; }), depth + 1);
      }
    }
    return node;
  }
  function isSplit(node, d) { return !!node.L && node.depth < d; }
  function predict(node, p, d) { while (isSplit(node, d)) node = p[node.ax] < node.t ? node.L : node.R; return node.cls; }
  function wrongOnes(tree, pts, d) { return pts.filter(function (p) { return predict(tree, p, d) !== p.c; }); }

  /* the single straight line with the fewest mistakes: every direction, every threshold between two points */
  function bestLine(pts) {
    var best = { wrong: pts.length + 1 }, n = pts.length, P = countPos(pts);
    for (var deg = 0; deg < 180; deg++) {
      var n1 = Math.cos(deg * Math.PI / 180), n2 = Math.sin(deg * Math.PI / 180);
      var s = pts.map(function (p) { return { v: n1 * p.x + n2 * p.y, c: p.c }; }).sort(function (a, b) { return a.v - b.v; });
      var lp = 0;
      for (var i = 1; i < n; i++) {
        if (s[i - 1].c > 0) lp++;
        var e = lp + (n - i - (P - lp)), w = Math.min(e, n - e);    // below says circle, above says plus, or the reverse
        if (w < best.wrong) best = { wrong: w, n1: n1, n2: n2, c: -(s[i - 1].v + s[i].v) / 2 };
      }
    }
    return best;
  }
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

  window.InkKit.define('cart-figure', {
    label: 'A classification tree: two classes of points cut into rectangles, and the same cuts drawn as a tree',
    steps: 4,
    seed: 5,
    draw: function (k) {
      var sx = k.scale(0, DOM, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(0, DOM, PLOT.y + PLOT.h, PLOT.y);
      var train = makeData(k.rng(77)), held = makeData(k.rng(1077));
      var tree = grow(train, 0);
      var depth = 2, touched = false;
      var sub = { x: 'x₁', y: 'x₂' };
      function of(n) { return n + ' of ' + N; }
      // The kit's path() puts .ik-ink on the path itself, where the step rules (".is-off .ik-ink path") cannot reach
      // it, so a clean stroke would stay inked in every step. Sit it inside its own .ik-ink group instead.
      function stroke(g, pts, o) {
        var node = g.polyline(pts, o), wrap = document.createElementNS(NS, 'g');
        wrap.setAttribute('class', 'ik-ink');
        wrap.style.cssText = node.style.cssText;
        node.removeAttribute('class'); node.removeAttribute('style');
        g.node.replaceChild(wrap, node); wrap.appendChild(node);
        return wrap;
      }

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'x₁' });
      k.root.text(PLOT.x - 9, PLOT.y + 9, 'x₂', { kind: 'label', anchor: 'end' });

      /* ---- the fitted trees, one drawing per depth: rectangles on the plane, nodes and thread beside it ---- */
      var grown = k.root.group({ steps: [2, 3], d: 200, stagger: 22 });
      var planes = [], rings = [], stats = [];
      function drawDepth(d) {
        var g = grown.group();
        var leaves = [], inner = [];
        (function walk(node, bx) {                       // bx = [x0, x1, y0, y1] in data units
          node.box = bx;
          if (!isSplit(node, d)) { leaves.push(node); return; }
          inner.push(node);
          if (node.ax === 'x') { walk(node.L, [bx[0], node.t, bx[2], bx[3]]); walk(node.R, [node.t, bx[1], bx[2], bx[3]]); }
          else { walk(node.L, [bx[0], bx[1], bx[2], node.t]); walk(node.R, [bx[0], bx[1], node.t, bx[3]]); }
        })(tree, [0, DOM, 0, DOM]);

        // the plane: hatch where the tree says plus, rule every cut
        leaves.forEach(function (lf) {
          if (lf.cls < 0) return;
          var b = lf.box;
          g.hatch([[sx(b[0]), sy(b[2])], [sx(b[1]), sy(b[2])], [sx(b[1]), sy(b[3])], [sx(b[0]), sy(b[3])]], { op: 0.5, gap: 4.5 });
        });
        inner.forEach(function (nd) {
          var b = nd.box, o = { w: [1.6, 1.2, 0.9, 0.7, 0.7][nd.depth], op: nd.depth ? 0.75 : 0.9, rough: 0.3 };
          if (nd.ax === 'x') g.line(sx(nd.t), sy(b[2]), sx(nd.t), sy(b[3]), o);
          else g.line(sx(b[0]), sy(nd.t), sx(b[1]), sy(nd.t), o);
        });

        // the tree: leaves spread evenly, every parent above the middle of its children
        var gap = Math.min(46, (X1 - X0 - 8) / Math.max(1, leaves.length - 1));
        var left = (X0 + X1) / 2 - gap * (leaves.length - 1) / 2;
        // keep room for the label written to the right of a shallow node
        if (d <= 2) left -= 14;
        leaves.forEach(function (lf, i) { lf.px = left + i * gap; });
        (function place(node) {
          if (isSplit(node, d)) { place(node.L); place(node.R); node.px = (node.L.px + node.R.px) / 2; }
          node.py = TREE_Y + node.depth * LEVEL;
        })(tree);
        inner.forEach(function (nd) {
          [nd.L, nd.R].forEach(function (ch) { g.thread([[nd.px, nd.py + 5], [ch.px, ch.py - 6]], { w: 1.1 }); });
        });
        inner.forEach(function (nd) {
          g.rect(nd.px - 4.5, nd.py - 4.5, 9, 9, { w: nd.depth ? 1.1 : 1.6, rough: 0.4, op: 0.9 });
          if (nd.depth === 0 || d <= 2) g.text(nd.px + 9, nd.py + 3.5, sub[nd.ax] + '<' + nd.t.toFixed(1), { kind: 'axis' });
        });
        leaves.forEach(function (lf) { g.mark(lf.px, lf.py, lf.cls > 0 ? '+' : 'o', { r: 3.2 }); });

        planes[d] = g;
        stats[d] = { leaves: leaves.length, train: wrongOnes(tree, train, d), held: wrongOnes(tree, held, d) };
      }
      for (var d = 1; d <= MAX_DEPTH; d++) drawDepth(d);

      /* ---- step 1: the cut the reader drags, and the best one, marked on the axis ---- */
      var first = bestSplit(train, ['x']);
      var g1 = k.root.group({ steps: [1], d: 300 });
      g1.line(sx(first.t), PLOT.y + PLOT.h, sx(first.t), PLOT.y + PLOT.h + 6, { w: 1.1, rough: 0.2 });
      g1.text(sx(first.t), PLOT.y + PLOT.h + 18, 'best cut', { kind: 'axis', anchor: 'middle' });

      /* ---- step 0: the best that one straight line can do ---- */
      var g0 = k.root.group({ steps: [0], d: 500 });
      var bl = bestLine(train), seg = clipLine(bl.n1, bl.n2, bl.c);
      if (seg) g0.thread([[sx(seg[0][0]), sy(seg[0][1])], [sx(seg[1][0]), sy(seg[1][1])]], { w: 1.3 });
      g0.text(X0, 60, 'best straight line', { kind: 'label' });
      g0.text(X0, 80, 'wrong', { kind: 'label' });
      g0.text(X1, 80, of(bl.wrong), { kind: 'val', anchor: 'end' });
      g0.line(X0, 92, X1, 92, { w: 0.6, op: 0.45, rough: 0.3 });
      var end = seg ? (seg[0][0] > seg[1][0] ? seg[0] : seg[1]) : null;
      g0.callout('a', 'no single line will do', X0, 150, { to: end ? [sx(end[0]) - 10, sy(end[1]) + (sy(end[1]) < 150 ? 12 : -12)] : null, d: 1100 });

      /* ---- the points: the training set, and in the last step the set the tree never saw ---- */
      var trainMarks = k.root.group({ steps: [0, 1, 2], d: 150, stagger: 9 });
      train.forEach(function (p) { trainMarks.mark(sx(p.x), sy(p.y), p.c > 0 ? '+' : 'o'); });
      var heldMarks = k.root.group({ steps: [3], d: 150, stagger: 9 });
      held.forEach(function (p) { heldMarks.mark(sx(p.x), sy(p.y), p.c > 0 ? '+' : 'o'); });
      k.root.group({ steps: [2] }).text(PLOT.x + PLOT.w, PLOT.y - 10, N + ' training points', { kind: 'label', anchor: 'end' });
      k.root.group({ steps: [3] }).text(PLOT.x + PLOT.w, PLOT.y - 10, N + ' held-out points', { kind: 'label', anchor: 'end' });
      k.root.group({ steps: [2, 3] }).text(PLOT.x, PLOT.y + PLOT.h + 18, 'hatched: the tree says +', { kind: 'axis' });

      // the points each tree gets wrong, ringed: training in step 2 (the thing in focus), held-out in step 3
      var ringRoot = k.root.group({ steps: [2, 3], d: 500, stagger: 30 });
      for (d = 1; d <= MAX_DEPTH; d++) {
        var rg = ringRoot.group(), r2 = rg.group({ steps: [2] }), r3 = rg.group({ steps: [3] });
        stats[d].train.forEach(function (p) { r2.circle(sx(p.x), sy(p.y), 8, { accent: true, w: 1.1, op: 0.9 }); });
        stats[d].held.forEach(function (p) { r3.circle(sx(p.x), sy(p.y), 8, { w: 0.8, op: 0.6 }); });
        rings[d] = rg;
      }

      /* ---- step 1, beside the plane: weighted Gini for every place the cut could go ---- */
      var CH = { x: 444, y: 52, w: X1 - 444, h: 96 };
      var curve = [], gLo = 1, t;
      for (t = 0.2; t <= DOM - 0.2 + 1e-9; t += 0.04) { var sc = scoreCut(train, 'x', t); curve.push([t, sc.g]); gLo = Math.min(gLo, sc.g); }
      gLo = Math.floor(gLo * 20) / 20;
      var cx = k.scale(0, DOM, CH.x, CH.x + CH.w), cy = k.scale(gLo, 0.5, CH.y + CH.h, CH.y);
      g1.axes({ x: CH.x, y: CH.y, w: CH.w, h: CH.h, xlabel: 'cut at x₁', ylabel: 'weighted gini',
        yticks: [[cy(gLo), gLo.toFixed(2)], [cy(0.5), '0.50']] });
      stroke(g1, curve.map(function (p) { return [cx(p[0]), cy(p[1])]; }), { w: 1.1, op: 0.85, d: 600, dur: 900 });
      g1.dot(cx(first.t), cy(first.g), 2.4, { d: 1200 });
      var here = g1.circle(0, 0, 4.5, { w: 1.2, op: 0.95, d: 1300 });
      g1.text(X0, 196, 'cut at x₁', { kind: 'label' });
      var cutVal = g1.text(X1, 196, '', { kind: 'val', anchor: 'end' });
      g1.text(X0, 216, 'left of it', { kind: 'label' });
      var leftVal = g1.text(X1, 216, '', { kind: 'val', anchor: 'end' });
      g1.text(X0, 236, 'right of it', { kind: 'label' });
      var rightVal = g1.text(X1, 236, '', { kind: 'val', anchor: 'end' });
      g1.text(X0, 256, 'weighted gini', { kind: 'label' });
      var giniVal = g1.text(X1, 256, '', { kind: 'val', anchor: 'end' });
      g1.text(X0, 276, 'wrong', { kind: 'label' });
      var wrongVal = g1.text(X1, 276, '', { kind: 'val', anchor: 'end' });
      g1.line(X0, 288, X1, 288, { w: 0.6, op: 0.45, rough: 0.3 });
      g1.text(X0, 308, 'best cut', { kind: 'label' });
      g1.text(X1, 308, first.t.toFixed(1) + ' · gini ' + first.g.toFixed(2), { kind: 'val', anchor: 'end' });
      g1.callout('b', 'drag the cut', X0, 350, { d: 500 });

      var cutX0 = sx(CUT_START);
      var cutG = k.root.group({ steps: [1], d: 700 });
      cutG.line(cutX0, PLOT.y - 3, cutX0, PLOT.y + PLOT.h, { accent: true, w: 1.7, op: 0.95, rough: 0.4 });
      cutG.circle(cutX0, PLOT.y - 9, 5, { accent: true, w: 1.4, op: 0.95 });
      var hit = document.createElementNS(NS, 'rect');
      hit.setAttribute('x', cutX0 - 11); hit.setAttribute('y', PLOT.y - 16);
      hit.setAttribute('width', 22); hit.setAttribute('height', PLOT.h + 16);
      hit.setAttribute('class', 'ik-hit');
      cutG.node.appendChild(hit);
      function setCut(x) {
        var tc = (x - PLOT.x) / PLOT.w * DOM, s = scoreCut(train, 'x', tc);
        cutG.node.setAttribute('transform', 'translate(' + (x - cutX0).toFixed(1) + ' 0)');
        here.setAttribute('transform', 'translate(' + cx(tc).toFixed(1) + ' ' + cy(s.g).toFixed(1) + ')');
        cutVal.set(tc.toFixed(1));
        leftVal.set((s.nl - s.pl) + ' o · ' + s.pl + ' +');
        rightVal.set((s.nr - s.pr) + ' o · ' + s.pr + ' +');
        giniVal.set(s.g.toFixed(2));
        wrongVal.set(of(s.wrong));
      }
      k.draggable(cutG.node, {
        x: cutX0, y: PLOT.y, label: 'The cut. Left and right arrow keys move it.',
        bounds: { x0: sx(0.2), y0: PLOT.y, x1: sx(DOM - 0.2), y1: PLOT.y },
        onMove: function (x) { setCut(x); }
      });
      setCut(cutX0);

      /* ---- steps 2 and 3: depth, and what each depth costs ---- */
      var slider = k.slider({
        x: X0, y: 228, w: X1 - X0, min: 1, max: MAX_DEPTH, step: 1, value: depth, label: 'depth', steps: [2, 3],
        onChange: function (v) { touched = true; depth = v; show(); }
      });
      var knobPaper = slider.node.querySelector('.ik-paper');
      var side = k.root.group({ steps: [2, 3], d: 300 });
      side.text(X0, 256, 'leaves', { kind: 'label' });
      var leafVal = side.text(X1, 256, '', { kind: 'val', anchor: 'end' });
      side.text(X0, 276, 'training error', { kind: 'label' });
      var trainVal = side.text(X1, 276, '', { kind: 'val', anchor: 'end' });
      var side3 = k.root.group({ steps: [3], d: 300 });
      side3.text(X0, 296, 'held-out error', { kind: 'label' });
      var heldVal = side3.text(X1, 296, '', { kind: 'val', anchor: 'end' });
      k.root.group({ steps: [2] }).callout('c', 'each cut, one more rectangle', X0, 322, { d: 500 });

      // the error of every depth, on both sets; pruning keeps the shallowest depth with the lowest held-out error
      var EC = { x: 438, y: 336, w: 126, h: 62 };
      var eMax = 0, pruneAt = 1;
      for (d = 1; d <= MAX_DEPTH; d++) {
        eMax = Math.max(eMax, stats[d].train.length, stats[d].held.length);
        if (stats[d].held.length < stats[pruneAt].held.length) pruneAt = d;
      }
      var ex = k.scale(1, MAX_DEPTH, EC.x + 8, EC.x + EC.w - 4), ey = k.scale(0, eMax, EC.y + EC.h, EC.y);
      var xt = [];
      for (d = 1; d <= MAX_DEPTH; d++) xt.push([ex(d), String(d)]);
      side3.axes({ x: EC.x, y: EC.y, w: EC.w, h: EC.h, xticks: xt, yticks: [[ey(0), '0'], [ey(eMax), String(eMax)]] });
      function errLine(key, o) {
        var pts = [];
        for (var q = 1; q <= MAX_DEPTH; q++) pts.push([ex(q), ey(stats[q][key].length)]);
        stroke(side3, pts, o);
        pts.forEach(function (p) { side3.dot(p[0], p[1], o.w > 1.2 ? 2.2 : 1.6); });
        return pts;
      }
      var trainPts = errLine('train', { w: 0.8, op: 0.7, d: 500 });
      var heldPts = errLine('held', { w: 1.6, op: 0.95, d: 800 });
      var yT = trainPts[MAX_DEPTH - 1][1] + 3.5, yH = heldPts[MAX_DEPTH - 1][1] + 3.5;
      if (Math.abs(yT - yH) < 12) { if (yT > yH) yT = yH + 12; else yH = yT + 12; }
      side3.text(EC.x + EC.w + 6, yT, 'training', { kind: 'axis' });
      side3.text(EC.x + EC.w + 6, yH, 'held-out', { kind: 'axis' });
      side3.text(EC.x + EC.w, EC.y + EC.h + 32, 'depth', { kind: 'label', anchor: 'end' });
      side3.circle(heldPts[pruneAt - 1][0], heldPts[pruneAt - 1][1], 6, { accent: true, w: 1.3, op: 0.95, d: 1200 });
      side3.callout('d', 'prune back to depth ' + pruneAt, X0, 322, {
        from: [X0 + 66, 327], to: [heldPts[pruneAt - 1][0] - 2, heldPts[pruneAt - 1][1] - 8], d: 1200
      });
      var nowLine = side3.layer();

      function show() {
        for (var q = 1; q <= MAX_DEPTH; q++) {
          planes[q].node.style.display = q === depth ? '' : 'none';
          rings[q].node.style.display = q === depth ? '' : 'none';
        }
        leafVal.set(String(stats[depth].leaves));
        trainVal.set(of(stats[depth].train.length));
        heldVal.set(of(stats[depth].held.length));
        nowLine.clear();
        nowLine.line(ex(depth), EC.y, ex(depth), EC.y + EC.h, { w: 0.6, op: 0.5, rough: 0.2 });
      }

      k.onStep(function (step) {
        // the last step opens on the deepest tree, where the gap between the two errors is widest
        if (step === 3 && !touched && depth !== MAX_DEPTH) { depth = MAX_DEPTH; slider.set(depth, true); }
        // the knob sits on a paper patch that the kit leaves showing when the slider is off; put it away by hand
        knobPaper.style.display = step >= 2 ? '' : 'none';
        show();
      });
    }
  });
})();
