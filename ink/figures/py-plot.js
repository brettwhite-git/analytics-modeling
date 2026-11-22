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

      /* ---------- before the first run: a pencil sketch of the picture to come ----------
         ink/py.js reads the cell's code and says what it will draw (points, a line, bars, rings, threads, a film,
         the axis names). The sketch is faint, says it is a sketch, and fades out when the real picture arrives. */
      var shell = k.root.layer(), shellOn = true;
      var KINDS = {
        points: 'the points', labels: 'one mark shape per kind', lines: 'a line through them', accent: 'a curve in blue',
        stars: 'a ring on the one that matters', segments: 'threads between pairs', bars: 'bars standing on zero',
        hlines: 'a level line across', vlines: 'a level line down', frames: 'a short film, picture by picture'
      };
      function sketch(hint) {
        hint = hint || {};
        var has = hint.has || ['points', 'lines'], seen = {};
        has.forEach(function (h) { seen[h] = true; });
        if (!seen.points && !seen.bars && !seen.lines && !seen.accent) seen.points = true;
        shell.clear();
        var X = function (u) { return PLOT.x + u * PLOT.w; }, Y = function (v) { return PLOT.y + PLOT.h - v * PLOT.h; };
        var pencil = { w: 0.8, op: 0.22, rough: 0.6 };
        // a faint frame, with the axis names the code gives
        shell.line(PLOT.x, PLOT.y, PLOT.x, PLOT.y + PLOT.h, pencil);
        shell.line(PLOT.x, PLOT.y + PLOT.h, PLOT.x + PLOT.w, PLOT.y + PLOT.h, pencil);
        if (hint.xlabel) shell.text(PLOT.x + PLOT.w, PLOT.y + PLOT.h + 26, hint.xlabel, { kind: 'label', anchor: 'end', op: 0.5 });
        if (hint.ylabel) shell.text(PLOT.x, PLOT.y - 12, hint.ylabel, { kind: 'label', op: 0.5 });
        var rand = k.rng(73), pts = [];
        for (var i = 0; i < 16; i++) { var u = 0.08 + 0.84 * (i / 15) + (rand() - 0.5) * 0.05; pts.push([u, 0.18 + 0.55 * u + (rand() - 0.5) * 0.26]); }
        if (seen.bars) {
          for (var b = 0; b < 7; b++) {
            var bx = X(0.1 + b * 0.12), bh = (0.25 + 0.5 * Math.abs(Math.sin(b * 1.3 + 0.4))) * PLOT.h;
            var box = [[bx - 9, PLOT.y + PLOT.h], [bx - 9, PLOT.y + PLOT.h - bh], [bx + 9, PLOT.y + PLOT.h - bh], [bx + 9, PLOT.y + PLOT.h]];
            shell.poly(box, { w: 0.8, op: 0.22, rough: 0.5 });
            shell.hatch(box, { op: 0.16, gap: 6 });
          }
        }
        if (seen.points) pts.forEach(function (p, j) { shell.mark(X(p[0]), Y(p[1]), seen.labels && j % 2 ? '+' : 'o', { r: 3.4, op: 0.3 }); });
        if (seen.segments) [1, 10, 14].forEach(function (j) { shell.thread([[X(pts[5][0]), Y(pts[5][1])], [X(pts[j][0]), Y(pts[j][1])]], { op: 0.3 }); });
        if (seen.lines) {
          shell.line(X(0.04), Y(0.19), X(0.96), Y(0.74), { w: 1.2, op: 0.3, rough: 0.8 });
          if (seen.frames) [-0.12, -0.24].forEach(function (dy, n) { shell.line(X(0.04), Y(0.19 - dy * 1.4), X(0.96), Y(0.74 + dy), { w: 0.8, op: 0.13 - n * 0.04, rough: 0.8 }); });
        }
        if (seen.accent) shell.curve([[X(0.04), Y(0.62)], [X(0.35), Y(0.3)], [X(0.65), Y(0.42)], [X(0.96), Y(0.2)]], { w: 1.2, op: 0.35, accent: true });
        if (seen.hlines) shell.thread([[PLOT.x, Y(0.82)], [PLOT.x + PLOT.w, Y(0.82)]], { op: 0.3 });
        if (seen.vlines) shell.thread([[X(0.62), PLOT.y], [X(0.62), PLOT.y + PLOT.h]], { op: 0.3 });
        if (seen.stars) shell.circle(X(pts[5][0]), Y(pts[5][1]), 16, { w: 1, op: 0.35, accent: true });

        // the hand note: where the picture will come from
        var cx = PLOT.x + PLOT.w * 0.5;
        shell.paper(cx - 112, PLOT.y + PLOT.h * 0.82 - 26, 224, 48);
        shell.text(cx, PLOT.y + PLOT.h * 0.82, 'your code draws here', { kind: 'hand', anchor: 'middle' });
        shell.text(cx, PLOT.y + PLOT.h * 0.82 + 17, 'a sketch until you press Run', { kind: 'axis', anchor: 'middle', op: 0.75 });

        // the side column: what this cell's picture will hold
        var list = Object.keys(KINDS).filter(function (key) { return seen[key]; }).map(function (key) { return KINDS[key]; });
        noteNodes[0].set('press Run to draw');
        for (var n = 1; n < 5; n++) noteNodes[n].set(list[n - 1] ? '· ' + list[n - 1] : '');
      }
      function dropShell() {
        if (!shellOn) return;
        shellOn = false;
        var node = shell.node;
        if (k.reduced) { shell.clear(); return; }
        node.style.transition = 'opacity 320ms ease-out';
        node.style.opacity = '0';
        setTimeout(function () { shell.clear(); node.style.opacity = ''; node.style.transition = ''; }, 340);
      }
      sketch();
      /* called by ink/py.js with what the cell's code will draw */
      k.svg.inkShell = function (hint) { if (shellOn) sketch(hint); };

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
        dropShell();
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
