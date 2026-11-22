/* Gap dial — when the two kinds overlap, no line puts every point on its own side. A dial says how much room
   to give mistakes: turn it up and the strip gets wider, but more points end up inside it (or across the line).
   Adapted from svm-figure.js: the line is fitted for real in the browser, by many small corrections whose size
   shrinks as it goes (deterministic), so the strip, the counts and the starred points are computed, not posed.
   One step: slide the dial, drag any point and watch whether the line cares. Points are dragged on a working
   copy (a press grabs the nearest point; arrow keys move a focused one); TANGLED and InkPage never change.
   Also offers these points to the page's Python as tangled_points and tangled_kinds.
   Made-up points, fixed. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var NS = 'http://www.w3.org/2000/svg';
  var PLOT = { x: 44, y: 34, w: 372, h: 372 }, SIDE = 462, LO = -4, HI = 4;
  var DIAL_START = -2.75;                               // the dial, as a power of ten

  /* 28 made-up points, scaled like the ones before, but the two kinds overlap. Kind 1 is a cross, -1 a triangle. */
  var TANGLED = [[1.56, -0.09], [-2.32, -1.87], [0.96, 0.79], [0.83, -2.28], [2.55, 2.11], [-1.33, 0.41], [0.47, 0.18],
    [-1.11, -1.61], [2.21, 1.61], [0.5, -0.12], [0.68, 1.31], [-1.01, 0.71], [0.42, 0.65], [-0.83, -1.54], [0.35, -0.3],
    [-0.38, -0.07], [2.84, 2.85], [0.44, -1.92], [2.22, 0.84], [-0.77, 0.14], [-0.32, 1.57], [-0.13, -2.13], [0.84, 1.48],
    [-1.93, -1.08], [1.62, 3.15], [-2.63, -0.81], [1.86, -0.23], [-1.62, -0.09]];
  var KINDS = TANGLED.map(function (p, i) { return i % 2 ? -1 : 1; });

  window.InkPage = window.InkPage || {};
  window.InkPage.tangled_points = function () { return TANGLED; };
  window.InkPage.tangled_kinds = function () { return KINDS; };

  /* make  mean( max(0, 1 - kind * score) ) + room * (a*a + b*b)  small, a little at a time. Returns [a, b, shift]. */
  function fit(pts, room) {
    var w1 = 0, w2 = 0, s = 0, n = pts.length, t, i;
    for (t = 0; t < 2500; t++) {
      var g1 = 2 * room * w1, g2 = 2 * room * w2, gs = 0;
      for (i = 0; i < n; i++) {
        var u1 = pts[i][0] / 4, u2 = pts[i][1] / 4, k = KINDS[i];
        if (k * (w1 * u1 + w2 * u2 + s) < 1) { g1 -= k * u1 / n; g2 -= k * u2 / n; gs -= k / n; }
      }
      var eta = 1.5 / (1 + 0.01 * t);
      w1 -= eta * g1; w2 -= eta * g2; s -= eta * gs;
    }
    return [w1 / 4, w2 / 4, s];
  }
  function clip(l) {
    var a = l[0], b = l[1], c = l[2], hits = [], v;
    if (Math.abs(b) > 1e-9) {
      v = -(c + a * LO) / b; if (v >= LO && v <= HI) hits.push([LO, v]);
      v = -(c + a * HI) / b; if (v >= LO && v <= HI) hits.push([HI, v]);
    }
    if (Math.abs(a) > 1e-9) {
      v = -(c + b * LO) / a; if (v > LO && v < HI) hits.push([v, LO]);
      v = -(c + b * HI) / a; if (v > LO && v < HI) hits.push([v, HI]);
    }
    return hits.length >= 2 ? [hits[0], hits[hits.length - 1]] : null;
  }
  function half(poly, a, b, c) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length];
      var fp = a * p[0] + b * p[1] + c, fq = a * q[0] + b * q[1] + c;
      if (fp >= 0) out.push(p);
      if ((fp >= 0) !== (fq >= 0)) { var t = fp / (fp - fq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
    }
    return out;
  }
  var CLIP_ID = 0;

  window.InkKit.define('gap-dial', {
    label: 'Two kinds of points that overlap. A dial trades a wider strip against more points inside it',
    steps: 1,
    seed: 29,
    draw: function (k) {
      var sx = k.scale(LO, HI, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(LO, HI, PLOT.y + PLOT.h, PLOT.y);
      function px(p) { return sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1); }
      var box = [[LO, LO], [HI, LO], [HI, HI], [LO, HI]];
      var pts = TANGLED.map(function (p) { return p.slice(); });
      var room = Math.pow(10, DIAL_START);

      var ticks = [-4, -2, 0, 2, 4];
      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'across', ylabel: 'up',
        xticks: ticks.map(function (v) { return [sx(v), String(v)]; }), yticks: ticks.map(function (v) { return [sy(v), String(v)]; }) });

      /* the strip: hatching drawn once, seen through a window the shape of the strip (so dragging never re-wobbles it) */
      var defs = k.svg.querySelector('defs');
      var clipId = 'gap-dial-clip-' + (++CLIP_ID);
      var clipNode = document.createElementNS(NS, 'clipPath'); clipNode.setAttribute('id', clipId);
      var clipPoly = document.createElementNS(NS, 'polygon'); clipNode.appendChild(clipPoly); defs.appendChild(clipNode);
      var hatchWrap = document.createElementNS(NS, 'g'); hatchWrap.setAttribute('clip-path', 'url(#' + clipId + ')');
      k.root.node.appendChild(hatchWrap);
      var hatchD = '', run = PLOT.h / Math.tan(40 * Math.PI / 180);
      for (var c = -run; c < PLOT.w; c += 7) hatchD += 'M' + (PLOT.x + c).toFixed(1) + ' ' + (PLOT.y + PLOT.h) + ' L' + (PLOT.x + c + run).toFixed(1) + ' ' + PLOT.y + ' ';
      function rawPath(parent, w, op, dash, accent) {
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', w);
        p.setAttribute('stroke-linecap', 'round'); p.setAttribute('opacity', op);
        if (dash) p.setAttribute('stroke-dasharray', dash);
        if (accent) p.setAttribute('class', 'ik-accent');
        parent.appendChild(p);
        return p;
      }
      rawPath(hatchWrap, 0.6, 0.32).setAttribute('d', hatchD);
      var edgePath = rawPath(k.root.node, 0.9, 0.6, '4 4');
      var linePath = rawPath(k.root.node, 1.6, 0.9);
      var ringPath = rawPath(k.root.node, 1.4, 0.95, null, true);

      var trailPath = rawPath(k.root.node, 0.6, 0.35, '2 3');   // a faint thread from a moved point to where it started

      /* the points: drawn once, moved with a transform. `pts` is the figure's own copy; TANGLED never changes. */
      var BOUNDS = { x0: PLOT.x + 6, y0: PLOT.y + 6, x1: PLOT.x + PLOT.w - 6, y1: PLOT.y + PLOT.h - 6 };
      var marks = k.root.group({ d: 150, stagger: 14 });
      var queued = false;
      function schedule() { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; paint(); }); } }
      function setPoint(i, x, y) {
        pts[i] = [LO + (x - PLOT.x) / PLOT.w * (HI - LO), LO + (PLOT.y + PLOT.h - y) / PLOT.h * (HI - LO)];
        markNodes[i].setAttribute('transform', 'translate(' + (x - sx(TANGLED[i][0])).toFixed(1) + ' ' + (y - sy(TANGLED[i][1])).toFixed(1) + ')');
        schedule();
      }
      var markNodes = [], keyDrags = [];
      pts.forEach(function (p, i) {
        var x0 = sx(p[0]), y0 = sy(p[1]);
        var node = marks.mark(x0, y0, KINDS[i] > 0 ? '+' : 'tri', { r: 4 });
        markNodes.push(node);
        // the keyboard route: each point can be focused and moved with the arrow keys (the pointer goes to the hit area below)
        keyDrags.push(k.draggable(node, {
          x: x0, y: y0, label: 'A ' + (KINDS[i] > 0 ? 'cross' : 'triangle') + '. Arrow keys move it.',
          bounds: BOUNDS,
          onMove: function (x, y) { setPoint(i, x, y); }
        }));
      });

      /* one hit area over the plot, on top of the points: a press grabs the nearest point within reach */
      var REACH = 12;
      var pointHit = document.createElementNS(NS, 'rect');
      pointHit.setAttribute('x', PLOT.x); pointHit.setAttribute('y', PLOT.y);
      pointHit.setAttribute('width', PLOT.w); pointHit.setAttribute('height', PLOT.h);
      pointHit.setAttribute('class', 'ik-hit');
      pointHit.style.touchAction = 'none';
      k.root.node.appendChild(pointHit);
      var held = -1;
      function nearestPoint(x, y) {
        var best = -1, bd = REACH * REACH;
        pts.forEach(function (p, i) {
          var dx = sx(p[0]) - x, dy = sy(p[1]) - y, d = dx * dx + dy * dy;
          if (d <= bd) { bd = d; best = i; }
        });
        return best;
      }
      pointHit.addEventListener('pointerdown', function (e) {
        if (e.button) return;
        var f = k.toFigure(e), i = nearestPoint(f.x, f.y);
        if (i < 0) return;
        e.preventDefault();
        try { pointHit.setPointerCapture(e.pointerId); } catch (err) {}
        held = i; pointHit.style.cursor = 'grabbing';
      });
      pointHit.addEventListener('pointermove', function (e) {
        var f = k.toFigure(e);
        if (held < 0) { pointHit.style.cursor = nearestPoint(f.x, f.y) >= 0 ? 'grab' : ''; return; }
        var x = k.clamp(f.x, BOUNDS.x0, BOUNDS.x1), y = k.clamp(f.y, BOUNDS.y0, BOUNDS.y1);
        setPoint(held, x, y);
        keyDrags[held].set(x, y);
      });
      function letGo() { if (held >= 0) { held = -1; pointHit.style.cursor = ''; } }
      pointHit.addEventListener('pointerup', letGo);
      pointHit.addEventListener('pointercancel', letGo);
      function moved() { return pts.some(function (p, i) { return p[0] !== TANGLED[i][0] || p[1] !== TANGLED[i][1]; }); }

      var side = k.root.group({ d: 250 });
      side.text(SIDE, 60, 'strip width', { kind: 'label' });
      var vWidth = side.text(SIDE + 158, 60, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 80, 'inside the strip', { kind: 'label' });
      var vInside = side.text(SIDE + 158, 80, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 100, 'wrong side', { kind: 'label' });
      var vWrong = side.text(SIDE + 158, 100, '', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 112, SIDE + 158, 112, { w: 0.6, op: 0.45, rough: 0.3 });

      k.slider({
        x: SIDE, y: 170, w: 158, min: -3.5, max: -1.5, step: 0.05, value: DIAL_START, label: 'allow mistakes',
        format: function (v) { return v < -3.0 ? 'hardly' : v > -2.0 ? 'a lot' : 'some'; },
        onChange: function (v) { room = Math.pow(10, v); paint(); }
      });
      var ends = k.root.group({ d: 500 });
      ends.text(SIDE, 196, 'narrow', { kind: 'axis' });
      ends.text(SIDE + 158, 196, 'wide', { kind: 'axis', anchor: 'end' });
      k.root.callout('a', 'slide the dial', SIDE, 236);
      k.root.callout('b', 'then drag a point', SIDE, 262);
      k.root.group({ d: 900 }).text(SIDE, 310, 'starred: inside the', { kind: 'hand' });
      k.root.group({ d: 1100 }).text(SIDE, 332, 'strip or touching it.', { kind: 'hand' });

      /* once a point has moved: a way back, and a word that the page's numbers are for the original points */
      var resetBtn = k.button(SIDE, 376, 'put the points back', function () {
        held = -1;
        pts = TANGLED.map(function (p) { return p.slice(); });
        markNodes.forEach(function (n, i) { n.removeAttribute('transform'); keyDrags[i].set(sx(TANGLED[i][0]), sy(TANGLED[i][1])); });
        paint();
      });
      var movedNote = k.root.group({ d: 0 });
      movedNote.text(SIDE, 414, 'points moved: the numbers in', { kind: 'axis' });
      movedNote.text(SIDE, 428, 'the text are for the originals', { kind: 'axis' });

      function paint() {
        var isMoved = moved(), trail = '';
        resetBtn.node.style.display = movedNote.node.style.display = isMoved ? '' : 'none';
        pts.forEach(function (p, i) {
          var o = TANGLED[i];
          if (p[0] !== o[0] || p[1] !== o[1]) trail += 'M' + px(o) + ' L' + px(p) + ' ';
        });
        trailPath.setAttribute('d', trail);

        var l = fit(pts, room), L = Math.sqrt(l[0] * l[0] + l[1] * l[1]) || 1e-9;
        var seg = clip(l);
        linePath.setAttribute('d', seg ? 'M' + px(seg[0]) + ' L' + px(seg[1]) : '');
        var d = '';
        [1, -1].forEach(function (off) { var e = clip([l[0], l[1], l[2] - off]); if (e) d += 'M' + px(e[0]) + ' L' + px(e[1]) + ' '; });
        edgePath.setAttribute('d', d);
        var band = half(half(box, l[0], l[1], l[2] + 1), -l[0], -l[1], -l[2] + 1);
        clipPoly.setAttribute('points', band.map(function (p) { return sx(p[0]).toFixed(1) + ',' + sy(p[1]).toFixed(1); }).join(' '));
        var inside = 0, wrong = 0, ring = '';
        pts.forEach(function (p, i) {
          var f = KINDS[i] * (l[0] * p[0] + l[1] * p[1] + l[2]);
          if (f < 0) wrong++;
          if (f < 1) inside++;
          if (f < 1.03) {
            var x = sx(p[0]), y = sy(p[1]), r = 9;
            ring += 'M' + (x - r).toFixed(1) + ' ' + y.toFixed(1) + ' a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0 ';
          }
        });
        ringPath.setAttribute('d', ring);
        vWidth.set((2 / L).toFixed(2)); vInside.set(String(inside)); vWrong.set(String(wrong));
      }
      k.onStep(function () { paint(); });
    }
  });
})();
