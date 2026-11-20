/* PCA figure — finding the direction a correlated cloud is spread along, worked for real.
   The 2 x 2 covariance matrix of a seeded cloud is eigen-decomposed in the browser (closed form), so the
   components, their eigenvalues and every variance readout are computed from the points that are drawn.
   Steps: 0 the problem (spread runs along a diagonal neither axis describes) · 1 turn a line through the
          centre and watch the variance of the projections (slider) · 2 the two principal components, each a
          mix of x1 and x2 · 3 keep only PC1: the points collapse onto it and the lost variance is stated.
   Made-up points, centred, both in the same units. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };       // the plot area, in figure pixels
  var SIDE = 462, COLW = 158;                        // the column beside the plot
  var CX = 240, CY = 220, U = 52;                    // centre of the cloud and pixels per data unit (same on both axes)
  var REACH = 3.4;                                   // half-length of the turning line, in data units
  var CURVE = { top: 268, base: 332 };               // the small variance-by-angle curve in the column
  var N = 36;

  /* Kit gaps, worked around with what the kit gives us (the kit itself is not edited):
     a bare path()/polyline() is not un-drawn when its step group goes off, because the kit's CSS looks for a
     path inside an .ik-ink wrapper. Give it that wrapper. */
  function inkWrap(node) {
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', node.getAttribute('class'));
    g.style.cssText = node.style.cssText;
    node.removeAttribute('class'); node.removeAttribute('style');
    node.parentNode.replaceChild(g, node);
    g.appendChild(node);
    return g;
  }
  /* the slider knob sits on a paper disc that stays visible when the slider's step is off; hide it then */
  function knobPaper(slider, on) {
    var disc = slider.node.querySelector('.ik-knob .ik-paper');
    if (disc) disc.style.display = on ? '' : 'none';
  }

  function X(v) { return CX + v * U; }
  function Y(v) { return CY - v * U; }

  function makeData(rand) {
    var pts = [], i, mx = 0, my = 0;
    function g() { return (rand() + rand() + rand() - 1.5) * 2; }      // roughly normal, sd 1
    for (i = 0; i < N; i++) {
      var a = 1.4 * g(), b = 0.55 * a + 0.55 * g();
      pts.push({ x: a, y: b });
      mx += a; my += b;
    }
    pts.forEach(function (p) { p.x -= mx / N; p.y -= my / N; });       // centre exactly
    return pts;
  }

  /* variance (n - 1) of the projections of the points onto the unit direction at `deg` degrees */
  function varianceAlong(pts, deg) {
    var c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180), ss = 0;
    pts.forEach(function (p) { var t = p.x * c + p.y * s; ss += t * t; });
    return ss / (pts.length - 1);
  }

  /* eigen-decomposition of the 2 x 2 covariance matrix [[a, b], [b, c]] */
  function eigen(pts) {
    var a = 0, b = 0, c = 0, n = pts.length;
    pts.forEach(function (p) { a += p.x * p.x; b += p.x * p.y; c += p.y * p.y; });
    a /= n - 1; b /= n - 1; c /= n - 1;
    var mid = (a + c) / 2, rad = Math.sqrt((a - c) * (a - c) / 4 + b * b);
    var th = 0.5 * Math.atan2(2 * b, a - c);                           // direction of the larger eigenvalue
    return {
      sxx: a, sxy: b, syy: c, l1: mid + rad, l2: mid - rad, deg: th * 180 / Math.PI,
      v1: [Math.cos(th), Math.sin(th)], v2: [-Math.sin(th), Math.cos(th)]
    };
  }

  function signed(v) { return (v < 0 ? '− ' : '+ ') + Math.abs(v).toFixed(2); }
  function lead(v) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(2); }

  /* "0.87 x1 + 0.50 x2" with real subscripts: the kit's text() takes a plain string, so add the tspans here */
  function loadings(t, a, b) {
    var NS = 'http://www.w3.org/2000/svg';
    function span(str, o) { var s = document.createElementNS(NS, 'tspan'); s.textContent = str; if (o) for (var k in o) s.setAttribute(k, o[k]); t.appendChild(s); }
    t.textContent = '';
    span(lead(a) + ' x'); span('1', { dy: 4, 'font-size': 11 });
    span(' ' + signed(b) + ' x', { dy: -4 }); span('2', { dy: 4, 'font-size': 11 });
    return t;
  }

  window.InkKit.define('pca-figure', {
    label: 'Principal component analysis: a correlated cloud of points and the direction it is spread along',
    steps: 4,
    seed: 23,
    draw: function (k) {
      var pts = makeData(k.rng(5));
      var E = eigen(pts), total = E.l1 + E.l2;
      var angle = 0;

      k.root.axes({
        x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'x₁', ylabel: 'x₂',
        xticks: [[X(-2), '−2'], [X(0), '0'], [X(2), '2']],
        yticks: [[Y(-2), '−2'], [Y(0), '0'], [Y(2), '2']]
      });

      /* ---- step 0: the spread runs along a diagonal; each axis sees only its own shadow of it ---- */
      var g0 = k.root.group({ steps: [0], d: 500 });
      var rugX = '', rugY = '';
      pts.forEach(function (p) {
        rugX += 'M' + X(p.x).toFixed(1) + ' ' + (PLOT.y + PLOT.h - 2) + ' v-9 ';
        rugY += 'M' + (PLOT.x + 2) + ' ' + Y(p.y).toFixed(1) + ' h9 ';
      });
      inkWrap(g0.path(rugX, { w: 0.7, op: 0.55 }));
      inkWrap(g0.path(rugY, { w: 0.7, op: 0.55 }));
      g0.text(SIDE, 60, 'variance of x₁', { kind: 'label' });
      g0.text(SIDE + COLW, 60, E.sxx.toFixed(2), { kind: 'val', anchor: 'end' });
      g0.text(SIDE, 80, 'variance of x₂', { kind: 'label' });
      g0.text(SIDE + COLW, 80, E.syy.toFixed(2), { kind: 'val', anchor: 'end' });
      g0.text(SIDE, 100, 'correlation', { kind: 'label' });
      g0.text(SIDE + COLW, 100, (E.sxy / Math.sqrt(E.sxx * E.syy)).toFixed(2), { kind: 'val', anchor: 'end' });
      g0.line(SIDE, 112, SIDE + COLW, 112, { w: 0.6, op: 0.45, rough: 0.3 });
      var far = pts.reduce(function (best, p) {
        return (p.x * E.v1[0] + p.y * E.v1[1]) > (best.x * E.v1[0] + best.y * E.v1[1]) ? p : best;
      }, pts[0]);
      g0.callout('a', 'the spread is diagonal', SIDE, 150, { to: [X(far.x) + 9, Y(far.y) - 7], d: 1100 });

      /* ---- step 1: a line through the centre, the projections onto it, their variance ---- */
      var live = k.root.layer({ steps: [1] });
      var g1 = k.root.group({ steps: [1], d: 300 });
      g1.text(SIDE, 60, 'var. along line', { kind: 'label' });
      var alongVal = g1.text(SIDE + COLW, 60, '', { kind: 'val', anchor: 'end' });
      g1.text(SIDE, 80, 'share of total', { kind: 'label' });
      var shareVal = g1.text(SIDE + COLW, 80, '', { kind: 'val', anchor: 'end' });
      g1.line(SIDE, 92, SIDE + COLW, 92, { w: 0.6, op: 0.45, rough: 0.3 });
      g1.callout('b', 'turn the line', SIDE, 190, { d: 700 });

      /* ---- steps 1-2: variance of the projections at every angle, computed ---- */
      var curveG = k.root.group({ steps: [1, 2], d: 500 });
      var ax = k.scale(0, 180, SIDE, SIDE + COLW), ay = k.scale(0, E.l1 * 1.08, CURVE.base, CURVE.top);
      var curvePts = [];
      for (var deg = 0; deg <= 180; deg += 2) curvePts.push([ax(deg), ay(varianceAlong(pts, deg))]);
      curveG.text(SIDE, 244, 'variance by angle', { kind: 'label' });
      curveG.line(SIDE, CURVE.base, SIDE + COLW, CURVE.base, { w: 0.6, op: 0.5, rough: 0.2 });
      inkWrap(curveG.polyline(curvePts, { w: 1.1, op: 0.85 }));
      [0, 90, 180].forEach(function (d) {
        curveG.text(ax(d), CURVE.base + 14, d + '°', { kind: 'axis', anchor: d === 0 ? 'start' : d === 180 ? 'end' : 'middle' });
      });

      function redraw() {
        var c = Math.cos(angle * Math.PI / 180), s = Math.sin(angle * Math.PI / 180);
        var threads = '', ss = 0;
        live.clear();
        pts.forEach(function (p) {
          var t = p.x * c + p.y * s;
          ss += t * t;
          threads += 'M' + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1) + ' L' + X(t * c).toFixed(1) + ' ' + Y(t * s).toFixed(1) + ' ';
        });
        live.path(threads, { w: 0.6, op: 0.5 });
        live.line(X(-REACH * c), Y(-REACH * s), X(REACH * c), Y(REACH * s), { w: 1.7, op: 0.95, rough: 0.4, accent: true });
        pts.forEach(function (p) { var t = p.x * c + p.y * s; live.dot(X(t * c), Y(t * s), 1.7, { op: 0.75 }); });
        var v = ss / (pts.length - 1);
        // where this angle sits on the curve
        live.line(ax(angle), CURVE.base, ax(angle), ay(v), { w: 0.6, op: 0.6, rough: 0.2 });
        live.dot(ax(angle), ay(v), 3, { op: 0.9 });
        alongVal.set(v.toFixed(2));
        shareVal.set(Math.round(v / total * 100) + '%');
      }

      /* ---- steps 2-3: the principal components, from the eigen-decomposition ---- */
      var r1 = 0, r2 = 0;                               // how far the points reach along each component
      pts.forEach(function (p) {
        r1 = Math.max(r1, Math.abs(p.x * E.v1[0] + p.y * E.v1[1]));
        r2 = Math.max(r2, Math.abs(p.x * E.v2[0] + p.y * E.v2[1]));
      });
      r1 += 0.25; r2 += 0.25;
      var gPC2 = k.root.group({ steps: [2], d: 700 });
      gPC2.line(X(-r2 * E.v2[0]), Y(-r2 * E.v2[1]), X(r2 * E.v2[0]), Y(r2 * E.v2[1]), { w: 1.1, op: 0.85, rough: 0.4 });
      gPC2.text(X((r2 + 0.14) * E.v2[0]) - 2, Y((r2 + 0.14) * E.v2[1]) - 2, 'PC2', { kind: 'label', anchor: 'end' });
      // the right angle between them
      var q = 0.2;
      inkWrap(gPC2.polyline([
        [X(q * E.v1[0]), Y(q * E.v1[1])],
        [X(q * (E.v1[0] + E.v2[0])), Y(q * (E.v1[1] + E.v2[1]))],
        [X(q * E.v2[0]), Y(q * E.v2[1])]
      ], { w: 0.7, op: 0.7 }));
      var gPC1 = k.root.group({ steps: [2, 3], d: 300 });
      gPC1.line(X(-r1 * E.v1[0]), Y(-r1 * E.v1[1]), X(r1 * E.v1[0]), Y(r1 * E.v1[1]), { w: 1.7, op: 0.95, rough: 0.4, accent: true });
      gPC1.text(X((r1 + 0.1) * E.v1[0]), Y((r1 + 0.1) * E.v1[1]) - 6, 'PC1', { kind: 'label', anchor: 'middle' });

      var g2 = k.root.group({ steps: [2], d: 500 });
      g2.text(SIDE, 60, 'eigenvalue 1', { kind: 'label' });
      g2.text(SIDE + COLW, 60, E.l1.toFixed(2), { kind: 'val', anchor: 'end' });
      g2.text(SIDE, 80, 'eigenvalue 2', { kind: 'label' });
      g2.text(SIDE + COLW, 80, E.l2.toFixed(2), { kind: 'val', anchor: 'end' });
      g2.text(SIDE, 100, 'share in pc1', { kind: 'label' });
      g2.text(SIDE + COLW, 100, Math.round(E.l1 / total * 100) + '%', { kind: 'val', anchor: 'end' });
      g2.line(SIDE, 112, SIDE + COLW, 112, { w: 0.6, op: 0.45, rough: 0.3 });
      g2.text(SIDE, 132, 'pc1 =', { kind: 'label' });
      loadings(g2.text(SIDE, 151, '', { kind: 'math' }), E.v1[0], E.v1[1]);
      g2.text(SIDE, 173, 'pc2 =', { kind: 'label' });
      loadings(g2.text(SIDE, 192, '', { kind: 'math' }), E.v2[0], E.v2[1]);
      g2.callout('c', 'each is a mix of both', SIDE, 222, { d: 900 });
      // the top and the bottom of the curve are the two eigenvalues
      var a1 = ((E.deg % 180) + 180) % 180, a2 = (a1 + 90) % 180;
      g2.line(ax(a1), ay(E.l1), SIDE + COLW, ay(E.l1), { w: 0.6, op: 0.5, rough: 0.2 });
      g2.line(SIDE, ay(E.l2), ax(a2), ay(E.l2), { w: 0.6, op: 0.5, rough: 0.2 });
      g2.dot(ax(a1), ay(E.l1), 3);
      g2.dot(ax(a2), ay(E.l2), 3);
      g2.text(SIDE + COLW, ay(E.l1) - 5, 'top ' + E.l1.toFixed(2), { kind: 'axis', anchor: 'end' });
      g2.text(SIDE, ay(E.l2) - 5, 'bottom ' + E.l2.toFixed(2), { kind: 'axis' });

      /* ---- step 3: keep PC1 only ---- */
      var live3 = k.root.layer({ steps: [3] });
      var lost = 0;
      pts.forEach(function (p) {
        var t = p.x * E.v1[0] + p.y * E.v1[1];
        p.fx = t * E.v1[0]; p.fy = t * E.v1[1];
        lost += (p.x - p.fx) * (p.x - p.fx) + (p.y - p.fy) * (p.y - p.fy);
      });
      lost /= pts.length - 1;
      var g3 = k.root.group({ steps: [3], d: 300 });
      g3.text(SIDE, 60, 'variance kept', { kind: 'label' });
      g3.text(SIDE + COLW, 60, (total - lost).toFixed(2), { kind: 'val', anchor: 'end' });
      g3.text(SIDE, 80, 'variance lost', { kind: 'label' });
      g3.text(SIDE + COLW, 80, lost.toFixed(2), { kind: 'val', anchor: 'end' });
      g3.text(SIDE, 100, 'share lost', { kind: 'label' });
      g3.text(SIDE + COLW, 100, Math.round(lost / total * 100) + '%', { kind: 'val', anchor: 'end' });
      g3.line(SIDE, 112, SIDE + COLW, 112, { w: 0.6, op: 0.45, rough: 0.3 });
      g3.callout('d', 'one number per point', SIDE, 150, { d: 500 });
      g3.text(SIDE, 190, 'the short threads', { kind: 'hand', d: 900 });
      g3.text(SIDE, 212, 'are what you lose.', { kind: 'hand', d: 1300 });

      /* ---- the points: always there; in step 3 they slide onto PC1 ---- */
      var marks = k.root.group({ d: 200, stagger: 18 });
      pts.forEach(function (p) { p.node = marks.mark(X(p.x), Y(p.y), 'o'); p.node.style.pointerEvents = 'none'; });

      function collapse(t) {
        var d = '';
        live3.clear();
        pts.forEach(function (p) {
          var dx = (p.fx - p.x) * U * t, dy = -(p.fy - p.y) * U * t;
          if (t > 0) {
            p.node.setAttribute('transform', 'translate(' + dx.toFixed(1) + ' ' + dy.toFixed(1) + ')');
            d += 'M' + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1) + ' l' + dx.toFixed(1) + ' ' + dy.toFixed(1) + ' ';
            live3.dot(X(p.x), Y(p.y), 1.5, { op: 0.4 });
          } else p.node.removeAttribute('transform');
        });
        if (d) live3.path(d, { w: 0.6, op: 0.45 });
      }

      var slider = k.slider({
        x: SIDE, y: 136, w: COLW, min: 0, max: 180, step: 1, value: angle,
        label: 'angle of line', steps: [1],
        format: function (v) { return v + '°'; },
        onChange: function (v) { angle = v; redraw(); }
      });

      k.onStep(function (step) {
        knobPaper(slider, step === 1);
        if (step === 1) redraw();
        if (step === 3) k.animate(1100, collapse); else collapse(0);
      });
    }
  });
})();
