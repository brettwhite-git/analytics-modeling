/* Plan workshop — a workshop chooses how many tables and chairs to make, by hand first.
   Steps: 0 drag a plan (so many tables, so many chairs): see its profit, and the hours it uses against each limit;
            hunt for the best plan that breaks nothing, before any region is drawn
          1 draw the limits one at a time: each line, and the side of it that breaks the limit, hatched;
            what is left untouched is every allowed plan
          2 a line of equal profit, slid outward (slider, or "push it out"); the last allowed plan it touches is a
            corner, and checking the five corners is enough
          3 whole tables only: the best corner, the plan you get by rounding it, and the best whole-number plan
            (found by checking all of them), with a slider for what a table earns.
   Adapted from lp-figure.js (same workshop, same numbers). Everything is computed: the region by clipping
   half-planes, the corners as its vertices, the whole-number plans by trying every one.
   The best allowed plan found by hand in step 0 is remembered (sessionStorage) and offered to the page's Python.
   Made-up numbers. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 }, SIDE = 462, SW = 158;
  var DX = 7, DY = 6, EPS = 1e-7;
  var STORE = 'ink-plan-best';

  /* the limits: per_table * tables + per_chair * chairs <= available */
  var LIMITS = [
    { name: 'saw', a: 5, b: 2, c: 30, title: 'saw: at most 30 h', how: '5 a table, 2 a chair' },
    { name: 'paint', a: 2, b: 5, c: 26, title: 'paint: at most 26 h', how: '2 a table, 5 a chair' },
    { name: 'orders', a: 0, b: 1, c: 4, title: 'orders: at most 4', how: 'chairs only' }
  ];
  var NONNEG = [{ a: -1, b: 0, c: 0 }, { a: 0, b: -1, c: 0 }];
  var ALL = LIMITS.concat(NONNEG);
  var BOX = NONNEG.concat([{ a: 1, b: 0, c: DX }, { a: 0, b: 1, c: DY }]);
  var P_TABLE = 500, P_CHAIR = 400, START = [1, 1];

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
  function dedupe(poly) {
    return poly.filter(function (p, i) {
      var q = poly[(i + poly.length - 1) % poly.length];
      return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) > EPS;
    });
  }
  var BOXPOLY = [[0, 0], [DX, 0], [DX, DY], [0, DY]];
  function region() {
    var poly = BOXPOLY;
    ALL.forEach(function (r) { poly = clipHalf(poly, r.a, r.b, r.c); });
    return dedupe(poly);
  }
  /* the part of the box that breaks one limit */
  function brokenSide(r) { return dedupe(clipHalf(BOXPOLY, -r.a, -r.b, -r.c)); }
  function allowed(x, y) { return ALL.every(function (r) { return r.a * x + r.b * y <= r.c + EPS; }); }
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
  function bestCorner(poly, p1, p2) {
    var best = -Infinity, at = null;
    poly.forEach(function (v) { var z = p1 * v[0] + p2 * v[1]; if (z > best + EPS) { best = z; at = v; } });
    return { z: best, at: at };
  }
  function num(v) { return Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(2); }
  function money(v) { return '$' + String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function remembered() {
    try { var v = JSON.parse(sessionStorage.getItem(STORE)); return v && Array.isArray(v.plan) ? v : null; } catch (e) { return null; }
  }
  function remember(best) {
    try { sessionStorage.setItem(STORE, JSON.stringify(best)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('ink:plan-best')); } catch (e) {}
  }

  /* what `from page import limits, profits, my_plan` gives the Python on the same page (see ink/py.js) */
  window.InkPage = window.InkPage || {};
  window.InkPage.limits = function () { return LIMITS.map(function (r) { return [r.name, r.a, r.b, r.c]; }); };
  window.InkPage.profits = function () { return [P_TABLE, P_CHAIR]; };
  window.InkPage.my_plan = function () { var b = remembered(); return b ? b.plan : START.slice(); };

  window.InkKit.define('plan-workshop', {
    label: 'A workshop plan by hand: drag a plan of tables and chairs, draw the limits, slide a line of equal profit to the best corner, then try whole numbers only',
    steps: 4,
    seed: 29,
    draw: function (k) {
      var sx = k.scale(0, DX, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(0, DY, PLOT.y + PLOT.h, PLOT.y);
      function px(pts) { return pts.map(function (p) { return [sx(p[0]), sy(p[1])]; }); }
      var poly = region(), i, tx = [], ty = [];
      for (i = 1; i <= DX; i++) tx.push([sx(i), String(i)]);
      for (i = 1; i <= DY; i++) ty.push([sy(i), String(i)]);
      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'tables', ylabel: 'chairs', xticks: tx, yticks: ty });

      /* every whole-number plan, as a faint dot: the choices */
      var grid = k.root.group({ steps: [0, 1], d: 120, stagger: 6 });
      for (var gx = 0; gx <= DX; gx++) for (var gy = 0; gy <= DY; gy++) grid.dot(sx(gx), sy(gy), 1.5, { op: 0.4 });

      /* ================= step 0: hunt by hand ================= */
      var plan = START.slice(), best = null;
      function profit(p) { return P_TABLE * p[0] + P_CHAIR * p[1]; }

      var s0 = k.root.group({ steps: [0], d: 250, stagger: 40 });
      s0.text(SIDE, 52, 'your plan', { kind: 'label' });
      s0.text(SIDE, 72, 'tables', { kind: 'label' });
      var vT = s0.text(SIDE + SW, 72, '', { kind: 'val', anchor: 'end' });
      s0.text(SIDE, 90, 'chairs', { kind: 'label' });
      var vC = s0.text(SIDE + SW, 90, '', { kind: 'val', anchor: 'end' });
      s0.text(SIDE, 108, 'profit', { kind: 'label' });
      var vP = s0.text(SIDE + SW, 108, '', { kind: 'val', anchor: 'end' });
      s0.line(SIDE, 120, SIDE + SW, 120, { w: 0.6, op: 0.45, rough: 0.3 });
      var LIM_Y = [142, 176, 210], TRACK = 118;
      var vUse = LIMITS.map(function (r, j) {
        s0.text(SIDE, LIM_Y[j], r.name, { kind: 'label' });
        // the track: 0 to what is available, with a stop at the end
        s0.line(SIDE, LIM_Y[j] + 11, SIDE + TRACK, LIM_Y[j] + 11, { w: 0.6, op: 0.5, rough: 0.2 });
        s0.line(SIDE + TRACK, LIM_Y[j] + 5, SIDE + TRACK, LIM_Y[j] + 17, { w: 1.1, rough: 0.3 });
        return s0.text(SIDE + SW, LIM_Y[j], '', { kind: 'val', anchor: 'end' });
      });
      var meters = k.root.layer({ steps: [0] });
      s0.line(SIDE, 232, SIDE + SW, 232, { w: 0.6, op: 0.45, rough: 0.3 });
      s0.text(SIDE, 252, 'best allowed so far', { kind: 'label' });
      var vBest = s0.text(SIDE, 272, '', { kind: 'val' });
      var vBestP = s0.text(SIDE, 290, '', { kind: 'val' });
      s0.callout('a', 'drag the plan', SIDE, 326, { d: 700 });
      s0.text(SIDE, 360, 'the most profit', { kind: 'hand', d: 900 });
      s0.text(SIDE, 382, 'that breaks no limit?', { kind: 'hand', d: 1100 });

      // the plan: drawn once at the origin and moved, so it never re-wobbles
      var planG = k.root.group({ steps: [0], d: 300 });
      var pg = planG.group({ d: 300 });
      var ring = pg.circle(0, 0, 9, { accent: true, w: 1.6, op: 0.95, dur: 260 });
      var pdot = pg.dot(0, 0, 2.4, { accent: true });
      var grab = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      grab.setAttribute('r', 18); grab.setAttribute('class', 'ik-hit');
      pg.node.appendChild(grab);
      var dragger = k.draggable(pg.node, {
        label: 'Your plan. Arrow keys move it one table or one chair.',
        bounds: { x0: PLOT.x, y0: PLOT.y, x1: PLOT.x + PLOT.w, y1: PLOT.y + PLOT.h },
        onMove: function (x, y) {
          if (k.step() !== 0) return;
          var nx = Math.round((x - PLOT.x) / PLOT.w * DX), ny = Math.round((PLOT.y + PLOT.h - y) / PLOT.h * DY);
          nx = Math.max(0, Math.min(DX, nx)); ny = Math.max(0, Math.min(DY, ny));
          if (nx === plan[0] && ny === plan[1]) return;
          plan = [nx, ny]; show0();
        },
        onEnd: function () { place(); }
      });
      // the arrow keys move the drag position in pixels; one table is about 56 px, so keep keys whole too
      pg.node.addEventListener('keydown', function (e) {
        var d = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
        if (!d || k.step() !== 0) return;
        e.stopImmediatePropagation(); e.preventDefault();
        plan = [Math.max(0, Math.min(DX, plan[0] + d[0])), Math.max(0, Math.min(DY, plan[1] + d[1]))];
        show0();
      }, true);
      function place() {
        pg.node.setAttribute('transform', 'translate(' + sx(plan[0]).toFixed(1) + ' ' + sy(plan[1]).toFixed(1) + ')');
        dragger.set(sx(plan[0]), sy(plan[1]));
      }
      function show0() {
        place();
        vT.set(String(plan[0])); vC.set(String(plan[1])); vP.set(money(profit(plan)));
        meters.clear();
        LIMITS.forEach(function (r, j) {
          var used = r.a * plan[0] + r.b * plan[1], over = used > r.c;
          vUse[j].set(used + ' of ' + r.c + (over ? ' over' : ''));
          var len = Math.min(SW, TRACK * used / r.c);
          if (len > 0) meters.path('M' + SIDE + ' ' + (LIM_Y[j] + 11) + ' L' + (SIDE + len).toFixed(1) + ' ' + (LIM_Y[j] + 11), { w: 3.2, op: over ? 0.95 : 0.7 });
        });
        if (allowed(plan[0], plan[1]) && (!best || profit(plan) > best.profit)) {
          best = { plan: plan.slice(), profit: profit(plan) };
          remember(best);
        }
        vBest.set(best ? best.plan[0] + ' tables, ' + best.plan[1] + ' chairs' : '–');
        vBestP.set(best ? 'profit ' + money(best.profit) : '');
      }
      (function () { var b = remembered(); if (b) best = b; })();

      /* ================= step 1: the limits, one at a time ================= */
      var s1 = k.root.group({ steps: [1], d: 200 });
      var shown = 0;
      var limitParts = LIMITS.map(function (r, j) {
        var g = s1.group({ d: 0 });
        g.node.classList.add('is-off');
        g.hatch(px(brokenSide(r)), { angle: [40, 130, 90][j], gap: 6, op: 0.32, d: 380 });
        var seg = lineWithin(r.a, r.b, r.c, BOX);
        var ln = g.line(sx(seg[0][0]), sy(seg[0][1]), sx(seg[1][0]), sy(seg[1][1]), { w: 1.6, op: 0.9, rough: 0.4, d: 0, dur: 700 });
        var side = s1.group({ d: 0 });
        side.node.classList.add('is-off');
        side.text(SIDE, 132 + j * 44, r.title, { kind: 'label', d: 150 });
        side.text(SIDE, 150 + j * 44, r.how, { kind: 'axis', d: 300 });
        return { g: g, line: ln, side: side };
      });
      // the names of the lines, on paper so the hatching does not run through them
      var names = s1.group({ d: 0 });
      function nameAt(j, x, y, anchor) {
        var g = names.group({ d: 0 }); g.node.classList.add('is-off');
        var str = LIMITS[j].name, w = str.length * 7.6 + 8;
        g.paper(anchor === 'end' ? x - w + 4 : x - 4, y - 11, w, 15, { d: 500 });
        g.text(x, y, str, { kind: 'label', anchor: anchor, d: 600 });
        limitParts[j].name = g;
      }
      nameAt(0, sx(3.85) + 8, sy(5.6) + 4);
      nameAt(1, sx(6.2), sy(2.76) - 9);
      nameAt(2, PLOT.x + PLOT.w - 4, sy(4) - 8, 'end');
      s1.text(SIDE, 52, 'limits drawn', { kind: 'label' });
      var vShown = s1.text(SIDE + SW, 52, '0 of 3', { kind: 'val', anchor: 'end' });
      var bLimit = k.button(SIDE, 92, 'draw the next limit', function () {
        shown = shown >= LIMITS.length ? 0 : shown + 1;
        show1();
      }, { steps: [1] });
      var left = s1.group({ d: 0 }); left.node.classList.add('is-off');
      var nAllowed = 0;
      for (gx = 0; gx <= DX; gx++) for (gy = 0; gy <= DY; gy++) if (allowed(gx, gy)) nAllowed++;
      left.text(SIDE, 276, 'plans left', { kind: 'label', d: 300 });
      left.text(SIDE + SW, 276, String(nAllowed) + ' of ' + (DX + 1) * (DY + 1), { kind: 'val', anchor: 'end', d: 300 });
      left.callout('b', 'what is left is allowed', SIDE, 314, { d: 600, to: [sx(1.6), sy(1.4)], from: [SIDE - 6, 310] });
      // where your best hand plan sits
      var mine = s1.group({ d: 0 });
      var mineG = mine.group({ d: 400 });
      mineG.circle(0, 0, 8, { w: 1.2, op: 0.9 });
      mineG.dot(0, 0, 2, {});
      var mineT = mine.text(0, 0, 'your best', { kind: 'axis', d: 500 });
      function placeMine() {
        var b = remembered(), p = b ? b.plan : START;
        mineG.node.setAttribute('transform', 'translate(' + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1) + ')');
        var right = p[0] < DX - 1.5;
        mineT.setAttribute('x', (sx(p[0]) + (right ? 13 : -13)).toFixed(1));
        mineT.setAttribute('y', (sy(p[1]) - 10).toFixed(1));
        mineT.setAttribute('text-anchor', right ? 'start' : 'end');
      }
      function show1() {
        limitParts.forEach(function (part, j) {
          var on = j < shown;
          part.g.node.classList.toggle('is-off', !on);
          part.side.node.classList.toggle('is-off', !on);
          part.name.node.classList.toggle('is-off', !on);
          part.line.classList.toggle('ik-accent', on && j === shown - 1);   // the newest line is the one in focus
        });
        left.node.classList.toggle('is-off', shown < LIMITS.length);
        vShown.set(shown + ' of 3');
        bLimit.set(shown >= LIMITS.length ? 'start again' : 'draw the next limit');
      }

      /* ================= step 2: slide a line of equal profit ================= */
      var outline = k.root.group({ steps: [2, 3], d: 200, stagger: 120 });
      LIMITS.forEach(function (r) {
        var seg = lineWithin(r.a, r.b, r.c, BOX);
        outline.line(sx(seg[0][0]), sy(seg[0][1]), sx(seg[1][0]), sy(seg[1][1]), { w: 0.6, op: 0.4, rough: 0.3 });
      });
      outline.poly(px(poly), { w: 1.1, op: 0.85, rough: 0.35 });
      var live = k.root.layer({ steps: [2, 3] });
      var corners2 = k.root.group({ steps: [2], d: 400, stagger: 80 });
      poly.forEach(function (v) { corners2.dot(sx(v[0]), sy(v[1]), 2.6); });

      var s2 = k.root.group({ steps: [2], d: 250 });
      s2.text(SIDE, 52, 'one profit, one line', { kind: 'label' });
      s2.text(SIDE, 70, '$500 a table, $400 a chair', { kind: 'axis' });
      var z = 1500, zMax = bestCorner(poly, P_TABLE, P_CHAIR).z, pushing = false, shownZ = null;
      var zSlider = k.slider({
        x: SIDE, y: 112, w: SW, min: 0, max: 4400, step: 50, value: z, label: 'profit', steps: [2],
        format: function (v) { var out = money(shownZ != null ? shownZ : v); shownZ = null; return out; }, onChange: function (v) { if (!pushing) { z = v; redraw(); } }
      });
      s2.text(SIDE, 146, 'allowed plans on it', { kind: 'label' });
      var vOn = s2.text(SIDE + SW, 164, '', { kind: 'val', anchor: 'end' });
      k.button(SIDE, 192, 'push it out', function () {
        if (pushing) return;
        var from = z; pushing = true;
        k.animate(Math.max(300, (zMax - from) / 2), function (t) {
          z = from + (zMax - from) * t;
          zSlider.set(Math.floor(z / 50) * 50, true);
          if (t >= 1) {
            // the knob moves in steps of $50; the line stops exactly where it last touches, so show that profit
            zSlider.set(0, true); shownZ = zMax; zSlider.set(Math.floor(zMax / 50) * 50, true);
            pushing = false; z = zMax;
          }
          redraw();
        });
      }, { steps: [2] });
      s2.text(SIDE, 228, 'check the corners', { kind: 'label' });
      var order = poly.slice().sort(function (p, q) { return p[0] - q[0] || p[1] - q[1]; });
      var bestV = bestCorner(poly, P_TABLE, P_CHAIR).at;
      order.forEach(function (v, j) {
        var isBest = v === bestV;
        s2.text(SIDE, 248 + j * 18, num(v[0]) + ', ' + num(v[1]), { kind: 'axis' });
        s2.text(SIDE + SW, 248 + j * 18, money(P_TABLE * v[0] + P_CHAIR * v[1]) + (isBest ? ' best' : ''), { kind: 'val', anchor: 'end' });
      });
      s2.callout('c', 'the last touch is a corner', SIDE, 356, { d: 700 });

      /* ================= step 3: whole tables only ================= */
      var p1 = P_TABLE;
      var lattice = [];
      for (gx = 0; gx <= DX; gx++) for (gy = 0; gy <= DY; gy++) if (allowed(gx, gy)) lattice.push([gx, gy]);
      var dots3 = k.root.group({ steps: [3], d: 150, stagger: 14 });
      lattice.forEach(function (p) { dots3.dot(sx(p[0]), sy(p[1]), 2.1); });
      var s3 = k.root.group({ steps: [3], d: 300 });
      s3.circle(SIDE + 5, 48.5, 4.5, { w: 1.1, op: 0.9 });
      s3.text(SIDE + 16, 52, 'corner', { kind: 'label' });
      var lpAt = s3.text(SIDE + SW, 52, '', { kind: 'val', anchor: 'end' });
      var lpZ = s3.text(SIDE + SW, 70, '', { kind: 'val', anchor: 'end' });
      s3.line(SIDE, 80, SIDE + SW, 80, { w: 0.6, op: 0.45, rough: 0.3 });
      s3.mark(SIDE + 5, 92.5, 'x', { r: 3.6 });
      s3.text(SIDE + 16, 96, 'rounded', { kind: 'label' });
      var rdAt = s3.text(SIDE + SW, 96, '', { kind: 'val', anchor: 'end' });
      var rdZ = s3.text(SIDE + SW, 114, '', { kind: 'val', anchor: 'end' });
      s3.line(SIDE, 124, SIDE + SW, 124, { w: 0.6, op: 0.45, rough: 0.3 });
      s3.circle(SIDE + 5, 136.5, 5.5, { w: 1.2, op: 0.9, accent: true });
      s3.text(SIDE + 16, 140, 'best whole', { kind: 'label' });
      var ipAt = s3.text(SIDE + SW, 140, '', { kind: 'val', anchor: 'end' });
      var ipZ = s3.text(SIDE + SW, 158, '', { kind: 'val', anchor: 'end' });
      var pSlider = k.slider({
        x: SIDE, y: 214, w: SW, min: 100, max: 1200, step: 50, value: P_TABLE, label: 'a table earns', steps: [3],
        format: money, onChange: function (v) { p1 = v; redraw(); }
      });
      s3.callout('d', 'whole tables only', SIDE, 262, { d: 400 });
      s3.text(SIDE, 296, 'rounding is a guess,', { kind: 'hand', d: 800 });
      s3.text(SIDE, 318, 'not a plan.', { kind: 'hand', d: 1200 });

      function isoLine(pa, pb, level, o) {
        var seg = lineWithin(pa, pb, level, BOX);
        if (seg) live.line(sx(seg[0][0]), sy(seg[0][1]), sx(seg[1][0]), sy(seg[1][1]), o);
      }
      function redraw() {
        var step = k.step();
        live.clear();
        if (step === 2) {
          var seg = lineWithin(P_TABLE, P_CHAIR, z, BOX);
          if (seg) live.path('M' + sx(seg[0][0]).toFixed(1) + ' ' + sy(seg[0][1]).toFixed(1) + ' L' + sx(seg[1][0]).toFixed(1) + ' ' + sy(seg[1][1]).toFixed(1), { w: 0.8, op: 0.5 });
          var inside = lineWithin(P_TABLE, P_CHAIR, z, ALL);
          var touch = inside && Math.abs(inside[0][0] - inside[1][0]) + Math.abs(inside[0][1] - inside[1][1]) < 0.05;
          if (inside && !touch) live.path('M' + sx(inside[0][0]).toFixed(1) + ' ' + sy(inside[0][1]).toFixed(1) + ' L' + sx(inside[1][0]).toFixed(1) + ' ' + sy(inside[1][1]).toFixed(1), { w: 2, op: 0.95, accent: true });
          if (touch) {
            live.path('M' + (sx(inside[0][0]) - 9).toFixed(1) + ' ' + sy(inside[0][1]).toFixed(1) + ' a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0', { w: 1.6, op: 0.95, accent: true });
            vOn.set('one: ' + num(inside[0][0]) + ', ' + num(inside[0][1]));
          } else vOn.set(inside ? 'a whole stretch' : 'none');
          return;
        }
        if (step !== 3) return;
        var b = bestCorner(poly, p1, P_CHAIR), v = b.at;
        isoLine(p1, P_CHAIR, b.z, { w: 0.7, op: 0.5, rough: 0.3 });
        var rx = Math.round(v[0]), ry = Math.round(v[1]), ok = allowed(rx, ry);
        var ip = -Infinity, ipP = null;
        lattice.forEach(function (p) { var val = p1 * p[0] + P_CHAIR * p[1]; if (val > ip + EPS) { ip = val; ipP = p; } });
        var fractional = Math.abs(v[0] - rx) > 1e-6 || Math.abs(v[1] - ry) > 1e-6;
        live.paper(sx(v[0]) - 6, sy(v[1]) - 6, 12, 12);
        live.circle(sx(v[0]), sy(v[1]), 5.5, { w: 1.2, op: 0.9 });
        if (fractional) live.mark(sx(rx), sy(ry), 'x', { r: 4.5, w: 1.3 });
        live.circle(sx(ipP[0]), sy(ipP[1]), 9.5, { w: 1.5, op: 0.95, accent: true });
        lpAt.set(num(v[0]) + ', ' + num(v[1]));
        lpZ.set(money(b.z));
        rdAt.set(rx + ', ' + ry);
        rdZ.set(ok ? money(p1 * rx + P_CHAIR * ry) : 'breaks a limit');
        ipAt.set(ipP[0] + ', ' + ipP[1]);
        ipZ.set(money(ip));
      }

      function knobBacking(slider, on) {
        var disc = slider.node.querySelector('.ik-knob .ik-paper');
        if (disc) disc.style.display = on ? '' : 'none';
      }
      window.addEventListener('ink:plan-best', function () { if (k.step() === 1) placeMine(); });

      k.onStep(function (step) {
        knobBacking(zSlider, step === 2);
        knobBacking(pSlider, step === 3);
        if (step === 0) { var b = remembered(); if (b && (!best || b.profit > best.profit)) best = b; show0(); }
        if (step === 1) { placeMine(); show1(); }
        redraw();
      });
    }
  });
})();
