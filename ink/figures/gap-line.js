/* Gap line — the reader draws one straight line between two kinds of points, then widens the empty strip.
   Steps: 0 drag the line's two handles until every point is on its own side (wrong ones are ringed)
          1 the empty strip around that line: as far as the nearest point, on both sides; make it wide,
            or press "show me the widest" and watch the line glide to the best one (found by trying every angle)
   The handles are remembered (sessionStorage), so both copies of the figure on the page show the same line,
   and the page's Python gets the same line through window.InkPage.my_line.
   In step 1 the reader can also drag the points (a working copy; POINTS and InkPage never change). Their own line
   stays put and the strip, counts and stars follow the points; after "show me the widest" the widest strip is
   found again, live, for wherever the points now are. A line moved that way is not remembered.
   Everything is computed from the points: sides by the sign of a*across + b*up + shift, distances by
   dividing that by the length of (a, b). Made-up points, fixed. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var NS = 'http://www.w3.org/2000/svg';
  var PLOT = { x: 44, y: 34, w: 372, h: 372 }, SIDE = 462, LO = -4, HI = 4;
  var STORE = 'ink-gap-line';
  var CLIP_ID = 0;

  /* 24 made-up points, already scaled so both measurements run over about -4..4. Kind 1 is a cross, -1 a triangle. */
  var POINTS = [[1.86, 2.24], [-2.31, -0.87], [2.36, 1.3], [-2.11, -1.83], [1.98, 3.45], [-2.63, -2.36], [1.58, 0.89],
    [-1.35, -1.83], [1.57, 1.54], [-1.47, -1.11], [0.44, 1.58], [-1.6, -1.41], [0.7, 1.92], [-1.63, -0.66], [0.98, 2.88],
    [-2.93, -1.36], [2.37, 1.17], [-0.74, -0.47], [2.1, 0.91], [-1.99, -1.63], [2.0, 1.15], [-3.26, -0.54], [2.34, 2.91],
    [-1.39, -1.91]];
  var KINDS = POINTS.map(function (p, i) { return i % 2 ? -1 : 1; });
  var DEFAULT = [[-3.2, -2.7], [3.2, 2.9]];          // a first line that cuts straight through both kinds

  function r2(v) { return Math.round(v * 100) / 100; }

  /* the line through two handles, as (a, b, shift), turned whichever way round puts more points on their own side.
     `pts` is the figure's working copy of the points when the reader has moved some; the page always uses POINTS. */
  function lineOf(h, pts) {
    pts = pts || POINTS;
    var a = r2(h[1][1] - h[0][1]), b = r2(-(h[1][0] - h[0][0]));
    var s = r2(-(a * h[0][0] + b * h[0][1]));
    var wrong = 0;
    pts.forEach(function (p, i) { if (KINDS[i] * (a * p[0] + b * p[1] + s) < 0) wrong++; });
    if (wrong > pts.length / 2) { a = -a; b = -b; s = -s; }
    return [a + 0, b + 0, s + 0];
  }
  function score(l, p) { return l[0] * p[0] + l[1] * p[1] + l[2]; }
  function len(l) { return Math.sqrt(l[0] * l[0] + l[1] * l[1]) || 1e-9; }

  /* the widest strip there is: try every direction, keep the one with the biggest gap between the two kinds */
  function widest(pts) {
    var best = { gap: -Infinity }, n = pts.length;
    for (var i = 0; i < 1440; i++) {
      var th = i * Math.PI / 1440, n1 = Math.cos(th), n2 = Math.sin(th);
      for (var sg = 1; sg >= -1; sg -= 2) {
        var lo = -Infinity, hi = Infinity;
        for (var j = 0; j < n; j++) {
          var v = sg * (n1 * pts[j][0] + n2 * pts[j][1]);
          if (KINDS[j] < 0) { if (v > lo) lo = v; } else if (v < hi) hi = v;
        }
        if (hi - lo > best.gap) best = { gap: hi - lo, line: [sg * n1, sg * n2, -(lo + hi) / 2] };
      }
    }
    return best;
  }
  var BEST = widest(POINTS);

  /* the two places where a line crosses the edge of the picture, or null */
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
  /* the part of the picture where  a x + b y + c >= 0  (cut the square down, edge by edge) */
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

  function remembered() {
    try { var v = JSON.parse(sessionStorage.getItem(STORE)); return Array.isArray(v) && v.length === 2 ? v : null; } catch (e) { return null; }
  }
  function remember(h) {
    try { sessionStorage.setItem(STORE, JSON.stringify(h)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('ink:gap-line')); } catch (e) {}
  }

  /* what `from page import points, kinds, my_line` gives the Python on the same page (see ink/py.js) */
  window.InkPage = window.InkPage || {};
  window.InkPage.points = function () { return POINTS; };
  window.InkPage.kinds = function () { return KINDS; };
  window.InkPage.my_line = function () { return lineOf(remembered() || DEFAULT); };

  window.InkKit.define('gap-line', {
    label: 'Two kinds of points. Drag a straight line between them, then make the empty strip around it as wide as you can',
    steps: 2,
    seed: 23,
    draw: function (k) {
      var sx = k.scale(LO, HI, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(LO, HI, PLOT.y + PLOT.h, PLOT.y);
      function px(p) { return sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1); }
      function toData(x, y) { return [r2(LO + (x - PLOT.x) / PLOT.w * (HI - LO)), r2(LO + (PLOT.y + PLOT.h - y) / PLOT.h * (HI - LO))]; }
      var box = [[LO, LO], [HI, LO], [HI, HI], [LO, HI]];
      var handles = (remembered() || DEFAULT).map(function (h) { return h.slice(); });
      var bestSoFar = 0, busy = false;
      var pts = POINTS.map(function (p) { return p.slice(); });     // the figure's own copy: this is what gets dragged
      var atBest = false;                                            // the line is the widest one, found by the figure

      var ticks = [-4, -2, 0, 2, 4];
      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'across', ylabel: 'up',
        xticks: ticks.map(function (v) { return [sx(v), String(v)]; }), yticks: ticks.map(function (v) { return [sy(v), String(v)]; }) });

      /* ---- the strip: hatching drawn once over the whole plot, shown only through a window the shape of the strip ---- */
      var defs = k.svg.querySelector('defs');
      var clipId = 'gap-clip-' + (++CLIP_ID);
      var clipNode = document.createElementNS(NS, 'clipPath'); clipNode.setAttribute('id', clipId);
      var clipPoly = document.createElementNS(NS, 'polygon'); clipPoly.setAttribute('points', '');
      clipNode.appendChild(clipPoly); defs.appendChild(clipNode);
      var stripGroup = k.root.group({ steps: [1], d: 0 });
      var hatchWrap = document.createElementNS(NS, 'g'); hatchWrap.setAttribute('clip-path', 'url(#' + clipId + ')');
      stripGroup.node.appendChild(hatchWrap);
      var hatchD = '', run = PLOT.h / Math.tan(40 * Math.PI / 180);
      for (var c = -run; c < PLOT.w; c += 7) {
        // lines rising at 40 degrees, one every 7 px, across the whole plot square
        hatchD += 'M' + (PLOT.x + c).toFixed(1) + ' ' + (PLOT.y + PLOT.h) + ' L' + (PLOT.x + c + run).toFixed(1) + ' ' + PLOT.y + ' ';
      }
      var hatch = document.createElementNS(NS, 'path');
      hatch.setAttribute('d', hatchD); hatch.setAttribute('stroke', 'currentColor'); hatch.setAttribute('stroke-width', '0.6');
      hatch.setAttribute('fill', 'none'); hatch.setAttribute('opacity', '0.32');
      hatchWrap.appendChild(hatch);

      function rawPath(parent, w, op, dash, accent) {
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', w);
        p.setAttribute('stroke-linecap', 'round'); p.setAttribute('opacity', op);
        if (dash) p.setAttribute('stroke-dasharray', dash);
        if (accent) p.setAttribute('class', 'ik-accent');
        parent.appendChild(p);
        return p;
      }
      var liveLayer = k.root.layer();
      var trailPath = rawPath(liveLayer.node, 0.6, 0.35, '2 3', false);   // a faint thread from a moved point to its start
      var edgePath = rawPath(liveLayer.node, 0.9, 0.6, '4 4', false);
      var linePath = rawPath(liveLayer.node, 1.6, 0.9, null, false);
      var ringPath = rawPath(liveLayer.node, 1.4, 0.95, null, true);

      /* ---- the points, drawn once, moved with a transform ---- */
      var marks = k.root.group({ d: 150, stagger: 14 });
      var markNodes = POINTS.map(function (p, i) { return marks.mark(sx(p[0]), sy(p[1]), KINDS[i] > 0 ? '+' : 'tri', { r: 4 }); });
      marks.node.style.pointerEvents = 'none';

      /* ---- dragging the points (step 1): one hit area over the plot, under the handles, so a handle wins the press.
         A press grabs the nearest point within reach. ---- */
      var REACH = 12;
      var pointHit = document.createElementNS(NS, 'rect');
      pointHit.setAttribute('x', PLOT.x); pointHit.setAttribute('y', PLOT.y);
      pointHit.setAttribute('width', PLOT.w); pointHit.setAttribute('height', PLOT.h);
      pointHit.setAttribute('class', 'ik-hit');
      pointHit.style.touchAction = 'none';
      k.root.group({ steps: [1] }).node.appendChild(pointHit);
      var held = -1, queued = false;
      function nearestPoint(x, y) {
        var best = -1, bd = REACH * REACH;
        pts.forEach(function (p, i) {
          var dx = sx(p[0]) - x, dy = sy(p[1]) - y, d = dx * dx + dy * dy;
          if (d <= bd) { bd = d; best = i; }
        });
        return best;
      }
      function moved() { return pts.some(function (p, i) { return p[0] !== POINTS[i][0] || p[1] !== POINTS[i][1]; }); }
      function placeMark(i) {
        markNodes[i].setAttribute('transform', 'translate(' + (sx(pts[i][0]) - sx(POINTS[i][0])).toFixed(1) + ' ' +
          (sy(pts[i][1]) - sy(POINTS[i][1])).toFixed(1) + ')');
      }
      function afterPointsMove() {
        queued = false;
        bestSoFar = 0;                     // "widest so far" was for other points
        if (atBest) toBest();
        paint();
      }
      pointHit.addEventListener('pointerdown', function (e) {
        if (e.button || busy || k.step() !== 1) return;
        var f = k.toFigure(e), i = nearestPoint(f.x, f.y);
        if (i < 0) return;
        e.preventDefault();
        try { pointHit.setPointerCapture(e.pointerId); } catch (err) {}
        held = i;
        pointHit.style.cursor = 'grabbing';
      });
      pointHit.addEventListener('pointermove', function (e) {
        var f = k.toFigure(e);
        if (held < 0) { pointHit.style.cursor = nearestPoint(f.x, f.y) >= 0 ? 'grab' : ''; return; }
        var x = k.clamp(f.x, PLOT.x + 6, PLOT.x + PLOT.w - 6), y = k.clamp(f.y, PLOT.y + 6, PLOT.y + PLOT.h - 6);
        pts[held] = toData(x, y);
        placeMark(held);
        if (!queued) { queued = true; requestAnimationFrame(afterPointsMove); }
      });
      function letGo() { if (held >= 0) { held = -1; pointHit.style.cursor = ''; } }
      pointHit.addEventListener('pointerup', letGo);
      pointHit.addEventListener('pointercancel', letGo);

      /* the figure's own widest line for wherever the points are now: handles set on it, not remembered */
      function bestHandles(line) {
        var seg = clip(line);
        if (!seg) return null;
        var t1 = [r2(seg[0][0] + (seg[1][0] - seg[0][0]) * 0.18), r2(seg[0][1] + (seg[1][1] - seg[0][1]) * 0.18)];
        var t2 = [r2(seg[0][0] + (seg[1][0] - seg[0][0]) * 0.82), r2(seg[0][1] + (seg[1][1] - seg[0][1]) * 0.82)];
        function far(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
        return far(handles[0], t1) + far(handles[1], t2) <= far(handles[0], t2) + far(handles[1], t1) ? [t1, t2] : [t2, t1];
      }
      function toBest() { var h = bestHandles(widest(pts).line); if (h) handles = h; }

      /* ---- the two handles: drawn once at the origin and moved ---- */
      var handleNodes = [0, 1].map(function (j) {
        var g = k.root.group({ d: 400 });
        g.circle(0, 0, 6.5, { w: 1.4, op: 0.95 });
        g.dot(0, 0, 2, {});
        var grab = document.createElementNS(NS, 'circle');
        grab.setAttribute('r', 16); grab.setAttribute('class', 'ik-hit');
        g.node.appendChild(grab);
        k.draggable(g.node, {
          label: 'Handle ' + (j + 1) + ' of your line. Arrow keys move it.',
          bounds: { x0: PLOT.x + 4, y0: PLOT.y + 4, x1: PLOT.x + PLOT.w - 4, y1: PLOT.y + PLOT.h - 4 },
          onMove: function (x, y) {
            if (busy) return;
            var p = toData(x, y), other = handles[1 - j];
            if (Math.abs(p[0] - other[0]) + Math.abs(p[1] - other[1]) < 0.3) return;   // two handles on one spot make no line
            handles[j] = p; atBest = false;
            paint(); remember(handles);
          }
        });
        return g;
      });

      /* ---- the column beside the plot ---- */
      var side = k.root.group({ d: 250 });
      side.text(SIDE, 60, 'wrong side', { kind: 'label' });
      var vWrong = side.text(SIDE + 158, 60, '', { kind: 'val', anchor: 'end' });
      var s1 = k.root.group({ steps: [1], d: 300 });
      s1.text(SIDE, 80, 'nearest cross', { kind: 'label' });
      var vPlus = s1.text(SIDE + 158, 80, '', { kind: 'val', anchor: 'end' });
      s1.text(SIDE, 100, 'nearest triangle', { kind: 'label' });
      var vMinus = s1.text(SIDE + 158, 100, '', { kind: 'val', anchor: 'end' });
      s1.text(SIDE, 120, 'strip width', { kind: 'label' });
      var vWidth = s1.text(SIDE + 158, 120, '', { kind: 'val', anchor: 'end' });
      s1.text(SIDE, 140, 'widest so far', { kind: 'label' });
      var vBest = s1.text(SIDE + 158, 140, '', { kind: 'val', anchor: 'end' });
      k.root.group({ steps: [0], d: 300 }).line(SIDE, 72, SIDE + 158, 72, { w: 0.6, op: 0.45, rough: 0.3 });
      s1.line(SIDE, 152, SIDE + 158, 152, { w: 0.6, op: 0.45, rough: 0.3 });

      var g0 = k.root.group({ steps: [0], d: 500 });
      g0.callout('a', 'drag the two dots', SIDE, 106);
      var h0 = g0.text(SIDE, 150, 'every point is on', { kind: 'hand' });
      var h0b = g0.text(SIDE, 172, 'its own side.', { kind: 'hand' });

      var g1 = k.root.group({ steps: [1], d: 500 });
      g1.callout('b', 'make the strip wide', SIDE, 186);
      var note1 = g1.text(SIDE, 206, '', { kind: 'axis' });
      k.button(SIDE, 244, 'show me the widest', function () { glideToBest(); }, { steps: [1] });
      var h1 = g1.text(SIDE, 300, 'only the starred points', { kind: 'hand' });
      var h1b = g1.text(SIDE, 322, 'decide where it goes.', { kind: 'hand' });
      k.button(SIDE, 380, 'start again', function () {
        if (busy) return;
        handles = DEFAULT.map(function (h) { return h.slice(); }); bestSoFar = 0; atBest = false; paint(); remember(handles);
      });

      /* once a point has moved: a way back, and a word that the page's numbers are for the original points */
      var resetBtn = k.button(SIDE, 346, 'put the points back', function () {
        if (busy) return;
        pts = POINTS.map(function (p) { return p.slice(); });
        held = -1;
        pts.forEach(function (p, i) { placeMark(i); });
        bestSoFar = 0;
        if (atBest) toBest();
        paint();
      }, { steps: [1] });
      var movedNote = k.root.group({ steps: [1], d: 0 });
      movedNote.text(SIDE, 414, 'points moved: the numbers in', { kind: 'axis' });
      movedNote.text(SIDE, 428, 'the text are for the originals', { kind: 'axis' });

      function ringD(list, r) {
        var d = '';
        list.forEach(function (p) {
          var x = sx(p[0]), y = sy(p[1]);
          d += 'M' + (x - r).toFixed(1) + ' ' + y.toFixed(1) + ' a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0 ';
        });
        return d;
      }

      function paint() {
        var step = k.step(), l = lineOf(handles, pts), L = len(l);
        handleNodes.forEach(function (g, j) { g.node.setAttribute('transform', 'translate(' + px(handles[j]) + ')'); });
        var seg = clip(l);
        linePath.setAttribute('d', seg ? 'M' + px(seg[0]) + ' L' + px(seg[1]) : '');

        var isMoved = moved(), trail = '';
        resetBtn.node.style.display = movedNote.node.style.display = isMoved ? '' : 'none';
        pts.forEach(function (p, i) {
          var o = POINTS[i];
          if (p[0] !== o[0] || p[1] !== o[1]) trail += 'M' + px(o) + ' L' + px(p) + ' ';
        });
        trailPath.setAttribute('d', trail);

        var wrong = [], nearP = Infinity, nearM = Infinity;
        pts.forEach(function (p, i) {
          var f = KINDS[i] * score(l, p);
          if (f < 0) wrong.push(p);
          var d = Math.abs(score(l, p)) / L;
          if (KINDS[i] > 0) nearP = Math.min(nearP, d); else nearM = Math.min(nearM, d);
        });
        vWrong.set(String(wrong.length));
        var ok = wrong.length === 0, m = Math.min(nearP, nearM);
        h0.style.display = h0b.style.display = ok ? '' : 'none';

        if (step === 0) {
          ringPath.setAttribute('d', ringD(wrong, 8.5));
          edgePath.setAttribute('d', ''); clipPoly.setAttribute('points', '');
          return;
        }
        vPlus.set(nearP.toFixed(2)); vMinus.set(nearM.toFixed(2));
        if (!ok) {
          vWidth.set('–');
          note1.set(atBest && isMoved ? 'no line splits them now' : 'first, fix the wrong side');
          ringPath.setAttribute('d', ringD(wrong, 8.5));
          edgePath.setAttribute('d', ''); clipPoly.setAttribute('points', '');
          h1.style.display = h1b.style.display = 'none';
          return;
        }
        bestSoFar = Math.max(bestSoFar, 2 * m);
        vWidth.set((2 * m).toFixed(2)); vBest.set(bestSoFar.toFixed(2));
        note1.set(Math.abs(nearP - nearM) < 0.03 ? 'it sits in the middle' : 'closer to the ' + (nearP < nearM ? 'crosses' : 'triangles'));
        // the strip runs m either side of the line: where the score is +m*L and -m*L
        var band = half(half(box, l[0], l[1], l[2] + m * L), -l[0], -l[1], -l[2] + m * L);
        clipPoly.setAttribute('points', band.map(function (p) { return sx(p[0]).toFixed(1) + ',' + sy(p[1]).toFixed(1); }).join(' '));
        var d = '';
        [m, -m].forEach(function (off) { var e = clip([l[0], l[1], l[2] - off * L]); if (e) d += 'M' + px(e[0]) + ' L' + px(e[1]) + ' '; });
        edgePath.setAttribute('d', d);
        var touching = pts.filter(function (p) { return Math.abs(score(l, p)) / L < m + 0.03; });
        ringPath.setAttribute('d', ringD(touching, 9));
        h1.style.display = h1b.style.display = '';
      }

      /* glide the handles onto the widest line, so the reader watches the line tilt and slide into the gap */
      function glideToBest() {
        if (busy) return;
        var isMoved = moved();
        var seg = clip(isMoved ? widest(pts).line : BEST.line);
        if (!seg) return;
        var t1 = [seg[0][0] + (seg[1][0] - seg[0][0]) * 0.18, seg[0][1] + (seg[1][1] - seg[0][1]) * 0.18];
        var t2 = [seg[0][0] + (seg[1][0] - seg[0][0]) * 0.82, seg[0][1] + (seg[1][1] - seg[0][1]) * 0.82];
        function far(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
        var to = far(handles[0], t1) + far(handles[1], t2) <= far(handles[0], t2) + far(handles[1], t1) ? [t1, t2] : [t2, t1];
        var from = handles.map(function (h) { return h.slice(); });
        busy = true;
        k.animate(1400, function (t) {
          handles = from.map(function (f, j) { return [r2(f[0] + (to[j][0] - f[0]) * t), r2(f[1] + (to[j][1] - f[1]) * t)]; });
          paint();
          // the widest line for the page's own points is the reader's to keep; one for moved points is not
          if (t >= 1) { busy = false; atBest = true; if (!isMoved) remember(handles); }
        });
      }

      // the other copy of this figure on the page moved the line: show the same one
      window.addEventListener('ink:gap-line', function () {
        if (busy) return;
        var h = remembered();
        if (h && (h[0][0] !== handles[0][0] || h[0][1] !== handles[0][1] || h[1][0] !== handles[1][0] || h[1][1] !== handles[1][1])) {
          handles = h.map(function (p) { return p.slice(); }); atBest = false; paint();
        }
      });

      k.onStep(function (s) {
        busy = false;
        if (s !== 1 && moved()) {          // points only move in step 1; any other step shows the page's own points
          pts = POINTS.map(function (p) { return p.slice(); }); held = -1;
          pts.forEach(function (p, i) { placeMark(i); });
          if (atBest) toBest();
        }
        paint();
      });
    }
  });
})();
