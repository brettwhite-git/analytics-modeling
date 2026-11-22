/* Py plot — the picture a lesson's Python draws. It has no data of its own: after a cell runs, ink/py.js
   hands it the `picture` (a dict) or `frames` (a list of pictures, played back in order) that the code made.

     picture = {
         "xlim": (0, 10), "ylim": (0, 10),      # optional: worked out from the data if left out
         "points": [(x, y), ...],                # drawn as hand marks
         "labels": [0, 1, 0, ...],               # optional, one per point: each label gets its own mark shape
         "stars": [(x, y), ...],                 # the thing in focus: accent rings (flags, a query point, an alarm)
         "segments": [((x1, y1), (x2, y2)), ...],# thin threads between pairs of places
         "lines": [[(x, y), ...], ...],          # one or more curves or fitted lines, in ink
         "accent": [(x, y), ...],                # one curve in the accent
         "hlines": [y, ...], "vlines": [x, ...], # level lines across the whole plot
         "bars": [(x, height), ...],             # hatched bars standing on y = 0
         "notes": ["total 64.5", ...],           # up to five short lines beside the plot
         "xlabel": "time", "ylabel": "value",
     }

   Point at anything it drew and the nearest value is read out beside it.

   Everything is optional. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 52, y: 34, w: 384, h: 366 }, SIDE = 462;
  var SHAPES = ['o', '+', 'x', 'sq', 'tri'];

  function nice(lo, hi) {
    if (!(hi > lo)) { hi = lo + 1; }
    var span = hi - lo, step = Math.pow(10, Math.floor(Math.log(span / 4) / Math.LN10));
    var err = span / 4 / step;
    step *= err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
    var ticks = [];
    for (var v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) ticks.push(Math.round(v / step) * step);
    return ticks;
  }
  function fmt(v) { return Math.abs(v) >= 1000 ? String(Math.round(v)) : String(Math.round(v * 100) / 100); }
  function pair(p) { return p && p.length >= 2 && isFinite(p[0]) && isFinite(p[1]); }

  window.InkKit.define('py-plot', {
    label: 'A picture drawn from the Python on this page',
    steps: 1,
    seed: 41,
    draw: function (k) {
      var frame = k.root.layer(), threads = k.root.layer(), marks = k.root.layer(), ink = k.root.layer(), focus = k.root.layer();
      var side = k.root.group({ d: 200 });
      side.text(SIDE, 60, 'from your code', { kind: 'label' });
      side.line(SIDE, 72, SIDE + 158, 72, { w: 0.6, op: 0.45, rough: 0.3 });
      var noteNodes = [0, 1, 2, 3, 4].map(function (i) { return side.text(SIDE, 96 + i * 20, '', { kind: 'axis' }); });
      noteNodes[0].set('run a cell to draw');

      // lines and threads that run off the plot are cut at its edge, not bent along it
      var NS = 'http://www.w3.org/2000/svg', clipId = 'pyplot-clip-' + Math.random().toString(36).slice(2, 8);
      var clip = document.createElementNS(NS, 'clipPath'), box = document.createElementNS(NS, 'rect');
      clip.setAttribute('id', clipId);
      box.setAttribute('x', PLOT.x); box.setAttribute('y', PLOT.y - 2); box.setAttribute('width', PLOT.w + 2); box.setAttribute('height', PLOT.h + 2);
      clip.appendChild(box); k.svg.insertBefore(clip, k.svg.firstChild);
      [threads, ink, focus].forEach(function (layer) { layer.node.setAttribute('clip-path', 'url(#' + clipId + ')'); });

      var drawnAxes = null, drawnMarks = null;

      function limits(pic) {
        var xs = [], ys = [];
        function take(p) { if (pair(p)) { xs.push(+p[0]); ys.push(+p[1]); } }
        (pic.points || []).forEach(take); (pic.stars || []).forEach(take); (pic.accent || []).forEach(take);
        (pic.lines || []).forEach(function (l) { (l || []).forEach(take); });
        (pic.segments || []).forEach(function (s) { take(s[0]); take(s[1]); });
        (pic.bars || []).forEach(function (b) { take(b); ys.push(0); });
        (pic.hlines || []).forEach(function (y) { ys.push(+y); });
        (pic.vlines || []).forEach(function (x) { xs.push(+x); });
        function range(vals, given) {
          if (given && given.length === 2) return [+given[0], +given[1]];
          if (!vals.length) return [0, 1];
          var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo || 1) * 0.08;
          return [lo - pad, hi + pad];
        }
        return { x: range(xs, pic.xlim), y: range(ys, pic.ylim) };
      }

      function paint(pic) {
        pic = pic || {};
        var lim = limits(pic);
        var sx = k.scale(lim.x[0], lim.x[1], PLOT.x, PLOT.x + PLOT.w), sy = k.scale(lim.y[0], lim.y[1], PLOT.y + PLOT.h, PLOT.y);
        last = { pic: pic, sx: sx, sy: sy }; clearHover();
        function clampY(v) { return Math.max(PLOT.y, Math.min(PLOT.y + PLOT.h, sy(v))); }
        function clampX(v) { return Math.max(PLOT.x, Math.min(PLOT.x + PLOT.w, sx(v))); }
        function far(v) { return Math.max(-4000, Math.min(4000, v)); }      // keep wild values drawable; the clip does the cutting
        function d(points) {
          var out = '', pen = false;
          (points || []).forEach(function (p) {
            if (!pair(p)) { pen = false; return; }
            out += (pen ? ' L' : ' M') + far(sx(+p[0])).toFixed(1) + ' ' + far(sy(+p[1])).toFixed(1); pen = true;
          });
          return out;
        }

        // the axes: only redrawn when the limits or the axis names change
        var axesKey = JSON.stringify([lim, pic.xlabel, pic.ylabel]);
        if (axesKey !== drawnAxes) {
          drawnAxes = axesKey;
          frame.clear();
          frame.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: pic.xlabel || '', ylabel: pic.ylabel || '',
            xticks: nice(lim.x[0], lim.x[1]).map(function (v) { return [sx(v), fmt(v)]; }),
            yticks: nice(lim.y[0], lim.y[1]).map(function (v) { return [sy(v), fmt(v)]; }) });
          drawnMarks = null;
        }

        // the hand-drawn marks: only when the points themselves, or who owns them, change
        var marksKey = JSON.stringify([pic.points || [], pic.labels || null]);
        if (marksKey !== drawnMarks) {
          drawnMarks = marksKey;
          marks.clear();
          (pic.points || []).forEach(function (p, i) {
            if (!pair(p)) return;
            var label = pic.labels ? pic.labels[i] : 0;
            var shape = (typeof label === 'number' && isFinite(label)) ? SHAPES[((label % SHAPES.length) + SHAPES.length) % SHAPES.length] : 'o';
            marks.mark(sx(+p[0]), sy(+p[1]), shape, { r: (pic.points.length > 60 ? 2.8 : 3.8) });
          });
        }

        // everything that may move between frames is drawn clean, so it never re-wobbles
        // bars are drawn clean, with a ruled hatch, so they can grow and shrink between frames without shimmering
        threads.clear(); ink.clear(); focus.clear();
        var barEdge = '', barHatch = '';
        (pic.bars || []).forEach(function (b) {
          if (!pair(b)) return;
          var w = Math.max(4, Math.min(26, PLOT.w / ((pic.bars.length || 1) * 1.6)));
          var xa = sx(+b[0]) - w / 2, xb = sx(+b[0]) + w / 2, ya = Math.min(clampY(0), clampY(+b[1])), yb = Math.max(clampY(0), clampY(+b[1]));
          if (yb - ya < 0.6) { barEdge += 'M' + xa.toFixed(1) + ' ' + yb.toFixed(1) + ' L' + xb.toFixed(1) + ' ' + yb.toFixed(1) + ' '; return; }
          barEdge += 'M' + xa.toFixed(1) + ' ' + yb.toFixed(1) + ' L' + xa.toFixed(1) + ' ' + ya.toFixed(1) + ' L' + xb.toFixed(1) + ' ' + ya.toFixed(1) + ' L' + xb.toFixed(1) + ' ' + yb.toFixed(1) + ' Z ';
          for (var c = ya - (xb - xa); c < yb; c += 5) {        // lines y = c + (x - xa), cut to the bar
            var x0 = xa, y0 = c, x1 = xb, y1 = c + (xb - xa);
            if (y0 < ya) { x0 += ya - y0; y0 = ya; }
            if (y1 > yb) { x1 -= y1 - yb; y1 = yb; }
            if (x1 > x0) barHatch += 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' L' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' ';
          }
        });
        if (barHatch) threads.path(barHatch, { w: 0.6, op: 0.4 });
        if (barEdge) threads.path(barEdge, { w: 1, op: 0.85 });
        var seg = '';
        (pic.segments || []).forEach(function (s) {
          if (s && pair(s[0]) && pair(s[1])) seg += 'M' + far(sx(+s[0][0])).toFixed(1) + ' ' + far(sy(+s[0][1])).toFixed(1) + ' L' + far(sx(+s[1][0])).toFixed(1) + ' ' + far(sy(+s[1][1])).toFixed(1) + ' ';
        });
        if (seg) threads.path(seg, { w: 0.7, op: 0.38 });
        var level = '';
        (pic.hlines || []).forEach(function (y) { level += 'M' + PLOT.x + ' ' + sy(+y).toFixed(1) + ' L' + (PLOT.x + PLOT.w) + ' ' + sy(+y).toFixed(1) + ' '; });
        (pic.vlines || []).forEach(function (x) { level += 'M' + sx(+x).toFixed(1) + ' ' + PLOT.y + ' L' + sx(+x).toFixed(1) + ' ' + (PLOT.y + PLOT.h) + ' '; });
        if (level) threads.path(level, { w: 0.7, op: 0.55 });
        (pic.lines || []).forEach(function (line) { var p = d(line); if (p) ink.path(p, { w: 1.5, op: 0.9 }); });
        var acc = d(pic.accent);
        if (acc) focus.path(acc, { w: 1.6, op: 0.95, accent: true });
        (pic.stars || []).forEach(function (p) {
          if (!pair(p)) return;
          var x = sx(+p[0]), y = sy(+p[1]), r = 8;
          focus.path('M' + (x - r).toFixed(1) + ' ' + y.toFixed(1) + ' a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0', { accent: true, w: 1.6, op: 0.95 });
          focus.dot(x, y, 2.2, { accent: true });
        });
        var notes = (pic.notes || []).slice(0, 5);
        noteNodes.forEach(function (node, i) { node.set(notes[i] != null ? String(notes[i]).slice(0, 26) : ''); });
      }

      /* hover: the nearest thing your code drew, read out as numbers */
      var hover = k.root.layer(), last = null, hoverKey = '';
      function showHover(evt) {
        if (!last) return;
        var ctm = k.svg.getScreenCTM();
        if (!ctm) return;
        var pt = k.svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
        var at = pt.matrixTransform(ctm.inverse()), best = null, bestD = 16 * 16;
        function offer(p, what) {
          if (!pair(p)) return;
          var x = last.sx(+p[0]), y = last.sy(+p[1]), d = (x - at.x) * (x - at.x) + (y - at.y) * (y - at.y);
          if (x < PLOT.x - 1 || x > PLOT.x + PLOT.w + 1 || y < PLOT.y - 1 || y > PLOT.y + PLOT.h + 1) return;
          if (d < bestD) { bestD = d; best = { x: x, y: y, p: p, what: what }; }
        }
        var pic = last.pic;
        (pic.lines || []).forEach(function (l) { (l || []).forEach(function (p) { offer(p, ''); }); });
        (pic.accent || []).forEach(function (p) { offer(p, ''); });
        (pic.bars || []).forEach(function (p) { offer(p, ''); });
        (pic.points || []).forEach(function (p) { offer(p, ''); });
        (pic.stars || []).forEach(function (p) { offer(p, ''); });
        var key = best ? best.x.toFixed(1) + ',' + best.y.toFixed(1) : '';
        if (key === hoverKey) return;
        hoverKey = key;
        hover.clear();
        if (!best) return;
        var r = 6.5, text = (best.what ? best.what + '  ' : '') + '(' + fmt(+best.p[0]) + ', ' + fmt(+best.p[1]) + ')';
        hover.path('M' + (best.x - r).toFixed(1) + ' ' + best.y.toFixed(1) + ' a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0', { accent: true, w: 1.1, op: 0.9 });
        var right = best.x > PLOT.x + PLOT.w - 120, low = best.y < PLOT.y + 22;
        hover.text(best.x + (right ? -10 : 10), best.y + (low ? 18 : -10), text, { kind: 'axis', anchor: right ? 'end' : 'start' });
      }
      function clearHover() { hoverKey = ''; hover.clear(); }
      k.svg.addEventListener('pointermove', showHover);
      k.svg.addEventListener('pointerdown', showHover);
      k.svg.addEventListener('pointerleave', clearHover);

      var playing = 0;
      /* called by ink/py.js after a cell runs */
      k.svg.inkUpdate = function (state) {
        var token = ++playing;
        var frames = Array.isArray(state.frames) && state.frames.length ? state.frames : null;
        if (!frames) { if (state.picture) paint(state.picture); return; }
        if (k.reduced) { paint(frames[frames.length - 1]); return; }
        var i = 0;
        (function next() {
          if (token !== playing) return;
          paint(frames[i]);
          i++;
          if (i < frames.length) setTimeout(next, frames.length > 30 ? 90 : frames.length > 12 ? 220 : 480);
        })();
      };
    }
  });
})();
