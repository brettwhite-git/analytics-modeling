/* LP figure — a two-variable linear program, solved for real.
   A workshop makes tables (x1) and chairs (x2). Three constraints (saw hours, paint hours, chair orders) and
   non-negativity cut out the feasible region, which is computed by clipping half-planes. The best corner is found
   by evaluating the objective at every vertex of that polygon; the best whole-number plan by enumerating the lattice.
   Nothing is posed: every readout comes from the same numbers that are drawn.
   Steps: 0 the problem (constraints and feasible region) · 1 the objective as a line you slide (slider)
          · 2 the best corner, and how it jumps when a price changes (slider) · 3 whole numbers only (same slider).
   Made-up numbers. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };       // the plot area, in figure pixels
  var SIDE = 462, SIDE_W = 158;                      // the column beside the plot
  var DX = 7, DY = 6;                                // tables run 0..7, chairs 0..6
  var EPS = 1e-7;

  /* the model:  maximise P1 x1 + P2 x2  subject to  a x1 + b x2 <= c  for each row, and x1, x2 >= 0 */
  var CONS = [
    { a: 5, b: 2, c: 30, name: 'saw' },              // saw hours: 5 a table, 2 a chair, 30 a week
    { a: 2, b: 5, c: 26, name: 'paint' },            // paint hours: 2 a table, 5 a chair, 26 a week
    { a: 0, b: 1, c: 4, name: 'orders' }             // nobody has ordered more than 4 chairs
  ];
  var NONNEG = [{ a: -1, b: 0, c: 0, name: 'x₁ = 0' }, { a: 0, b: -1, c: 0, name: 'x₂ = 0' }];
  var ALL = CONS.concat(NONNEG);
  var BOX = NONNEG.concat([{ a: 1, b: 0, c: DX }, { a: 0, b: 1, c: DY }]);
  var P1_START = 500, P2 = 400;                      // profit per table (the slider) and per chair, in dollars
  var Z_START = 2000;

  /* clip a polygon to the half-plane  a x + b y <= c  (Sutherland-Hodgman) */
  function clipHalf(poly, a, b, c) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length];
      var fp = c - a * p[0] - b * p[1], fq = c - a * q[0] - b * q[1];
      if (fp >= 0) out.push(p);
      if ((fp >= 0) !== (fq >= 0)) { var s = fp / (fp - fq); out.push([p[0] + s * (q[0] - p[0]), p[1] + s * (q[1] - p[1])]); }
    }
    return out;
  }
  /* the feasible region: the plot box cut down by every constraint, with repeated corners removed */
  function feasibleRegion() {
    var poly = [[0, 0], [DX, 0], [DX, DY], [0, DY]];
    ALL.forEach(function (r) { poly = clipHalf(poly, r.a, r.b, r.c); });
    return poly.filter(function (p, i) {
      var q = poly[(i + poly.length - 1) % poly.length];
      return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) > EPS;
    });
  }
  function isFeasible(x, y) {
    return ALL.every(function (r) { return r.a * x + r.b * y <= r.c + EPS; });
  }
  /* the part of the line  p1 x + p2 y = z  that satisfies every row of `rows`: two end points, or null */
  function lineWithin(p1, p2, z, rows) {
    var n2 = p1 * p1 + p2 * p2, x0 = z * p1 / n2, y0 = z * p2 / n2, dx = -p2, dy = p1;
    var lo = -Infinity, hi = Infinity;
    for (var i = 0; i < rows.length; i++) {
      var A = rows[i].a * dx + rows[i].b * dy, B = rows[i].c - rows[i].a * x0 - rows[i].b * y0;
      if (Math.abs(A) < 1e-12) { if (B < -EPS) return null; }
      else if (A > 0) hi = Math.min(hi, B / A);
      else lo = Math.max(lo, B / A);
    }
    if (hi < lo - EPS) return null;
    return [[x0 + lo * dx, y0 + lo * dy], [x0 + hi * dx, y0 + hi * dy]];
  }
  /* evaluate the objective at every vertex; return the best value and every vertex that reaches it */
  function bestCorners(poly, p1, p2) {
    var best = -Infinity, at = [];
    poly.forEach(function (v) {
      var z = p1 * v[0] + p2 * v[1];
      if (z > best + EPS) { best = z; at = [v]; } else if (Math.abs(z - best) <= EPS) at.push(v);
    });
    return { z: best, at: at };
  }
  /* every whole-number plan in the region, and the best of them by enumeration */
  function latticePoints() {
    var pts = [];
    for (var x = 0; x <= DX; x++) for (var y = 0; y <= DY; y++) if (isFeasible(x, y)) pts.push([x, y]);
    return pts;
  }
  function bindingAt(points) {
    return ALL.filter(function (r) {
      return points.every(function (v) { return Math.abs(r.a * v[0] + r.b * v[1] - r.c) < 1e-6; });
    }).map(function (r) { return r.name; });
  }

  function num(v) { return Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(2); }
  function money(v) { return '$' + String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  window.InkKit.define('lp-figure', {
    label: 'A linear program in two variables: three constraint lines, the feasible region they leave, a line of equal profit, the best corner and the best whole-number point',
    steps: 4,
    seed: 23,
    draw: function (k) {
      var sx = k.scale(0, DX, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(0, DY, PLOT.y + PLOT.h, PLOT.y);
      function px(pts) { return pts.map(function (p) { return [sx(p[0]), sy(p[1])]; }); }
      var region = feasibleRegion();
      var lattice = latticePoints();
      var p1 = P1_START, z = Z_START;
      var i, ticksX = [], ticksY = [];
      for (i = 1; i <= DX; i++) ticksX.push([sx(i), String(i)]);
      for (i = 1; i <= DY; i++) ticksY.push([sy(i), String(i)]);

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'x₁ tables', ylabel: 'x₂ chairs', xticks: ticksX, yticks: ticksY });

      /* ---- always there: the region and the three lines that cut it out, one at a time ---- */
      var base = k.root.group({ d: 250, stagger: 420 });
      CONS.forEach(function (r) {
        var seg = lineWithin(r.a, r.b, r.c, BOX);
        if (seg) base.line(sx(seg[0][0]), sy(seg[0][1]), sx(seg[1][0]), sy(seg[1][1]), { w: 1.1, op: 0.75, rough: 0.4 });
      });
      base.hatch(px(region), { op: 0.3, d: 1500 });

      /* ---- everything that is recomputed when a slider moves ---- */
      var live = k.root.layer({ steps: [1, 2, 3] });

      /* the names of the lines sit on paper, above anything that is redrawn */
      var names = k.root.group({ d: 500, stagger: 420 });
      function nameAt(x, y, str, anchor) {
        var w = str.length * 7.5 + 6;
        names.paper(anchor === 'end' ? x - w + 3 : x - 3, y - 10, w, 14, { d: 0 });
        names.text(x, y, str, { kind: 'label', anchor: anchor });
      }
      nameAt(sx(3.76) + 9, sy(5.6) + 3, CONS[0].name);
      nameAt(sx(6.15), sy(2.74) - 9, CONS[1].name);
      nameAt(PLOT.x + PLOT.w, sy(4) - 7, CONS[2].name, 'end');

      /* ---- step 0: the model written out ---- */
      var s0 = k.root.group({ steps: [0], d: 300, stagger: 90 });
      s0.text(SIDE, 56, 'maximise profit', { kind: 'label' });
      s0.text(SIDE, 78, P1_START + 'x₁ + ' + P2 + 'x₂', { kind: 'math' });
      s0.line(SIDE, 92, SIDE + SIDE_W, 92, { w: 0.6, op: 0.45, rough: 0.3 });
      s0.text(SIDE, 112, 'subject to', { kind: 'label' });
      CONS.forEach(function (r, j) {
        var lhs = (r.a ? (r.a === 1 ? '' : r.a) + 'x₁' : '') + (r.a && r.b ? ' + ' : '') + (r.b ? (r.b === 1 ? '' : r.b) + 'x₂' : '');
        s0.text(SIDE, 136 + j * 22, r.name, { kind: 'label' });
        s0.text(SIDE + SIDE_W, 136 + j * 22, ' ' + lhs + ' ≤ ' + r.c, { kind: 'math', anchor: 'end' });
      });
      s0.text(SIDE + SIDE_W, 202, ' x₁, x₂ ≥ 0', { kind: 'math', anchor: 'end' });
      s0.callout('a', 'the feasible plans', SIDE, 300, { to: [sx(5.1), sy(1.25)], d: 1900 });

      /* ---- step 1: one line of equal profit, and whether any feasible plan is still on it ---- */
      var s1 = k.root.group({ steps: [1], d: 300 });
      s1.text(SIDE, 56, 'equal profit', { kind: 'label' });
      s1.text(SIDE, 78, P1_START + 'x₁ + ' + P2 + 'x₂ = z', { kind: 'math' });
      s1.line(SIDE, 92, SIDE + SIDE_W, 92, { w: 0.6, op: 0.45, rough: 0.3 });
      s1.text(SIDE, 160, 'feasible on it', { kind: 'label' });
      var onLineVal = s1.text(SIDE + SIDE_W, 160, '', { kind: 'val', anchor: 'end' });
      var zSlider = k.slider({
        x: SIDE, y: 128, w: SIDE_W, min: 0, max: 4400, step: 50, value: Z_START, label: 'profit z', steps: [1],
        format: money,
        onChange: function (v) { z = v; redraw(); }
      });
      s1.callout('b', 'push it up and out', SIDE, 198, { d: 500 });

      /* ---- step 2: the best corner ---- */
      var s2 = k.root.group({ steps: [2], d: 300 });
      s2.text(SIDE, 56, 'tables x₁', { kind: 'label' });
      var x1Val = s2.text(SIDE + SIDE_W, 56, '', { kind: 'val', anchor: 'end' });
      s2.text(SIDE, 76, 'chairs x₂', { kind: 'label' });
      var x2Val = s2.text(SIDE + SIDE_W, 76, '', { kind: 'val', anchor: 'end' });
      s2.text(SIDE, 96, 'profit', { kind: 'label' });
      var zVal = s2.text(SIDE + SIDE_W, 96, '', { kind: 'val', anchor: 'end' });
      s2.line(SIDE, 108, SIDE + SIDE_W, 108, { w: 0.6, op: 0.45, rough: 0.3 });
      s2.text(SIDE, 128, 'binding', { kind: 'label' });
      var bindVal = s2.text(SIDE + SIDE_W, 146, '', { kind: 'val', anchor: 'end' });
      var corners = k.root.group({ steps: [2], d: 200, stagger: 60 });
      region.forEach(function (v) { corners.dot(sx(v[0]), sy(v[1]), 2.4); });
      s2.callout('c', 'always at a corner', SIDE, 246, { d: 500 });

      /* ---- step 3: whole numbers only ---- */
      var s3 = k.root.group({ steps: [3], d: 300 });
      var dots = k.root.group({ steps: [3], d: 150, stagger: 14 });
      lattice.forEach(function (p) { dots.dot(sx(p[0]), sy(p[1]), 1.9); });
      s3.circle(SIDE + 5, 52.5, 4.5, { w: 1.1, op: 0.9 });
      s3.text(SIDE + 16, 56, 'LP corner', { kind: 'label' });
      var lpAt = s3.text(SIDE + SIDE_W, 56, '', { kind: 'val', anchor: 'end' });
      var lpZ = s3.text(SIDE + SIDE_W, 74, '', { kind: 'val', anchor: 'end' });
      s3.line(SIDE, 84, SIDE + SIDE_W, 84, { w: 0.6, op: 0.45, rough: 0.3 });
      s3.mark(SIDE + 5, 96.5, 'x', { r: 3.6 });
      s3.text(SIDE + 16, 100, 'rounded', { kind: 'label' });
      var rdAt = s3.text(SIDE + SIDE_W, 100, '', { kind: 'val', anchor: 'end' });
      var rdZ = s3.text(SIDE + SIDE_W, 118, '', { kind: 'val', anchor: 'end' });
      s3.line(SIDE, 128, SIDE + SIDE_W, 128, { w: 0.6, op: 0.45, rough: 0.3 });
      s3.circle(SIDE + 5, 140.5, 5.5, { w: 1.2, op: 0.9, accent: true });
      s3.text(SIDE + 16, 144, 'best whole', { kind: 'label' });
      var ipAt = s3.text(SIDE + SIDE_W, 144, '', { kind: 'val', anchor: 'end' });
      var ipZ = s3.text(SIDE + SIDE_W, 162, '', { kind: 'val', anchor: 'end' });
      s3.callout('d', 'whole tables only', SIDE, 246, { d: 400 });
      s3.text(SIDE, 284, 'rounding is a guess,', { kind: 'hand', d: 800 });
      s3.text(SIDE, 306, 'not a solution.', { kind: 'hand', d: 1200 });

      /* ---- steps 2 and 3: what a table earns ---- */
      var pSlider = k.slider({
        x: SIDE, y: 206, w: SIDE_W, min: 100, max: 1200, step: 50, value: P1_START, label: 'per table', steps: [2, 3],
        format: money,
        onChange: function (v) { p1 = v; redraw(); }
      });

      function isoLine(pa, pb, level, o) {
        var seg = lineWithin(pa, pb, level, BOX);
        if (seg) live.line(sx(seg[0][0]), sy(seg[0][1]), sx(seg[1][0]), sy(seg[1][1]), o);
      }

      function redraw() {
        var step = k.step();
        live.clear();
        if (step === 1) {
          var inside = lineWithin(P1_START, P2, z, ALL);
          isoLine(P1_START, P2, z, { w: 0.7, op: 0.55, rough: 0.3 });
          if (inside) live.line(sx(inside[0][0]), sy(inside[0][1]), sx(inside[1][0]), sy(inside[1][1]), { w: 1.7, op: 0.95, rough: 0.3, accent: true });
          onLineVal.set(inside ? 'yes' : 'none');
          return;
        }
        if (step < 2) return;

        var best = bestCorners(region, p1, P2), v = best.at[0], tie = best.at.length > 1;
        if (step === 2) {
          isoLine(p1, P2, best.z, { w: 1.6, op: 0.9, rough: 0.4 });
          if (tie) {
            var w = best.at[best.at.length - 1];
            live.line(sx(v[0]), sy(v[1]), sx(w[0]), sy(w[1]), { w: 2, op: 0.95, rough: 0.3, accent: true });
            x1Val.set(num(Math.min(v[0], w[0])) + ' to ' + num(Math.max(v[0], w[0])));
            x2Val.set(num(Math.min(v[1], w[1])) + ' to ' + num(Math.max(v[1], w[1])));
            bindVal.set(bindingAt(best.at).join(' + ') + ', a tie');
          } else {
            live.circle(sx(v[0]), sy(v[1]), 9, { w: 1.4, op: 0.95, accent: true });
            x1Val.set(num(v[0]));
            x2Val.set(num(v[1]));
            bindVal.set(bindingAt(best.at).join(' + '));
          }
          zVal.set(money(best.z));
          return;
        }

        /* step 3: the LP corner, the plan you get by rounding it, and the best whole-number plan by enumeration */
        isoLine(p1, P2, best.z, { w: 0.7, op: 0.5, rough: 0.3 });
        var rx = Math.round(v[0]), ry = Math.round(v[1]), roundOk = isFeasible(rx, ry);
        var ipBest = -Infinity, ipPts = [];
        lattice.forEach(function (p) {
          var val = p1 * p[0] + P2 * p[1];
          if (val > ipBest + EPS) { ipBest = val; ipPts = [p]; } else if (Math.abs(val - ipBest) <= EPS) ipPts.push(p);
        });
        var fractional = Math.abs(v[0] - rx) > 1e-6 || Math.abs(v[1] - ry) > 1e-6;
        if (fractional) {
          live.paper(sx(v[0]) - 5, sy(v[1]) - 5, 10, 10);
          live.circle(sx(v[0]), sy(v[1]), 5.5, { w: 1.2, op: 0.9 });
          live.mark(sx(rx), sy(ry), 'x', { r: 4.5, w: 1.3 });
        } else {
          live.circle(sx(v[0]), sy(v[1]), 5.5, { w: 1.2, op: 0.9 });
        }
        ipPts.forEach(function (p) { live.circle(sx(p[0]), sy(p[1]), 9.5, { w: 1.4, op: 0.95, accent: true }); });
        lpAt.set(num(v[0]) + ', ' + num(v[1]));
        lpZ.set(money(best.z));
        rdAt.set(rx + ', ' + ry);
        rdZ.set(roundOk ? money(p1 * rx + P2 * ry) : 'not allowed');
        ipAt.set(ipPts[0][0] + ', ' + ipPts[0][1]);
        ipZ.set((ipPts.length > 1 ? ipPts.length + ' tied at ' : '') + money(ipBest));
      }

      /* a slider that is not in this step still has its paper-coloured knob backing in the page; take it out,
         or it blanks whatever another step writes at the same spot */
      function knobBacking(slider, on) {
        var disc = slider.node.querySelector('.ik-knob .ik-paper');
        if (disc) disc.style.display = on ? '' : 'none';
      }
      k.onStep(function (step) {
        knobBacking(zSlider, step === 1);
        knobBacking(pSlider, step >= 2);
        redraw();
      });
    }
  });
})();
