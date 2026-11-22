/* Py k-means — the picture your Python draws. It has no data of its own: ink/py.js runs the reader's
   code and hands this figure whatever `points`, `flags`, `labels` and `history` the code produced.
   `history` (the flags after every round) is played back as an animation.
   Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 }, SIDE = 462, DOM = 10;
  var SHAPES = ['o', '+', 'x', 'sq', 'tri'];

  window.InkKit.define('py-kmeans', {
    label: 'The points, flags and assignments computed by the Python on this page',
    steps: 1,
    seed: 31,
    draw: function (k) {
      var sx = k.scale(0, DOM, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(0, DOM, PLOT.y + PLOT.h, PLOT.y);
      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h,
        xticks: [0, 2, 4, 6, 8, 10].map(function (v) { return [sx(v), String(v)]; }),
        yticks: [0, 2, 4, 6, 8, 10].map(function (v) { return [sy(v), String(v)]; }) });

      // three layers, so a moving flag never makes the points re-wobble
      var threads = k.root.layer(), marks = k.root.layer(), flagLayer = k.root.layer();
      var side = k.root.group({ d: 200 });
      side.text(SIDE, 60, 'from your code', { kind: 'label' });
      side.line(SIDE, 72, SIDE + 158, 72, { w: 0.6, op: 0.45, rough: 0.3 });
      var rows = ['points', 'flags', 'labels', 'round'].map(function (name, i) {
        side.text(SIDE, 94 + i * 20, name, { kind: 'label' });
        return side.text(SIDE + 158, 94 + i * 20, '–', { kind: 'val', anchor: 'end' });
      });
      var note = side.text(SIDE, 196, 'press Run to draw', { kind: 'axis' });

      /* before the first run: the page's own points in pencil, three flags still to be placed */
      var shell = k.root.layer(), shellOn = true;
      (function sketch() {
        var pts = [];
        try { pts = (window.InkPage && window.InkPage.points && window.InkPage.points()) || []; } catch (err) { pts = []; }
        pts.forEach(function (p) { if (p && isFinite(p[0]) && isFinite(p[1])) shell.mark(sx(+p[0]), sy(+p[1]), 'o', { r: 3.4, op: 0.28 }); });
        [[2.5, 7.5], [7.5, 7], [5, 2.5]].forEach(function (f) { shell.circle(sx(f[0]), sy(f[1]), 11, { w: 1, op: 0.4, accent: true }); });
        var cx = PLOT.x + PLOT.w * 0.5, cy = PLOT.y + PLOT.h * 0.52;
        shell.paper(cx - 112, cy - 26, 224, 48);
        shell.text(cx, cy, 'your code groups these', { kind: 'hand', anchor: 'middle' });
        shell.text(cx, cy + 17, 'a sketch until you press Run', { kind: 'axis', anchor: 'middle', op: 0.75 });
      })();
      function dropShell() {
        if (!shellOn) return;
        shellOn = false;
        var node = shell.node;
        if (k.reduced) { shell.clear(); return; }
        node.style.transition = 'opacity 320ms ease-out';
        node.style.opacity = '0';
        setTimeout(function () { shell.clear(); node.style.opacity = ''; node.style.transition = ''; }, 340);
      }

      function nearest(points, flags) {
        return points.map(function (p) {
          var best = 0, bd = Infinity;
          flags.forEach(function (f, j) { var d = (p[0] - f[0]) * (p[0] - f[0]) + (p[1] - f[1]) * (p[1] - f[1]); if (d < bd) { bd = d; best = j; } });
          return best;
        });
      }
      var drawn = null;
      function ring(x, y, r) { return 'M' + (x - r).toFixed(1) + ' ' + y.toFixed(1) + ' a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0'; }
      function paint(points, flags, labels) {
        var key = JSON.stringify([points, labels]);
        if (key !== drawn) {                       // the hand-drawn marks: only when a point changes owner
          drawn = key;
          marks.clear();
          points.forEach(function (p, i) {
            marks.mark(sx(p[0]), sy(p[1]), labels ? SHAPES[labels[i] % SHAPES.length] : 'o', { r: 4 });
          });
        }
        threads.clear(); flagLayer.clear();
        if (flags && labels) {
          var d = '';
          points.forEach(function (p, i) {
            var f = flags[labels[i]];
            if (f) d += 'M' + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1) + ' L' + sx(f[0]).toFixed(1) + ' ' + sy(f[1]).toFixed(1) + ' ';
          });
          if (d) threads.path(d, { w: 0.7, op: 0.35 });
        }
        (flags || []).forEach(function (f) {
          flagLayer.path(ring(sx(f[0]), sy(f[1]), 8), { accent: true, w: 1.6, op: 0.95 });
          flagLayer.dot(sx(f[0]), sy(f[1]), 2.2, { accent: true });
        });
      }

      var playing = 0;
      /* called by ink/py.js after a cell runs */
      k.svg.inkUpdate = function (state) {
        var token = ++playing;
        dropShell();
        var points = state.points || [], flags = state.flags || null, labels = state.labels || null, history = state.history || null;
        rows[0].set(points.length ? String(points.length) : '–');
        rows[1].set(flags ? String(flags.length) : '–');
        rows[2].set(labels ? 'yes' : '–');
        rows[3].set('–');
        note.set(points.length ? '' : 'no points yet');
        if (!history || history.length < 2) { paint(points, flags, labels); return; }

        // play the rounds back: the flags glide from where they were to where the code moved them
        var i = 0;
        (function next() {
          if (token !== playing) return;
          var from = history[i], to = history[i + 1];
          rows[3].set((i + 1) + ' of ' + (history.length - 1));
          k.animate(520, function (t) {
            if (token !== playing) return;
            var now = from.map(function (f, j) { return [f[0] + (to[j][0] - f[0]) * t, f[1] + (to[j][1] - f[1]) * t]; });
            if (t === 0 || t >= 1) paint(points, now, nearest(points, t >= 1 ? to : from));
            else paint(points, now, nearest(points, from));
            if (t >= 1) { i++; if (i < history.length - 1) setTimeout(next, 240); else note.set('settled'); }
          });
        })();
      };
    }
  });
})();
