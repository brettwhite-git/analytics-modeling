/* Guess-line — the same game with two numbers to choose: a line's height and its tilt.
   The same seven days of made-up sales as guess-miss. The line's height is where it stands at day 0, and
   its tilt is how much it rises for each day. The reader drags the line's two handles (or slides both) and watches the hatched squares
   (side = the miss) and the total; or lets the nudges do it: nudge the height by the average miss, then
   the tilt by the average of (miss x day), each scaled down, again and again.
   One step. Tilt 0 is the one-number guess of the earlier figures.
   Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 }, SIDE = 462;
  var X0 = 0, X1 = 8, Y0 = 0, Y1 = 24;
  var SALES = [10, 12, 9, 15, 11, 16, 18];
  var DAYS = [1, 2, 3, 4, 5, 6, 7];
  var RATE = 0.8, ROUNDS = 40;

  function totalMiss(h, t) {
    var s = 0;
    for (var i = 0; i < SALES.length; i++) { var m = SALES[i] - (h + t * DAYS[i]); s += m * m; }
    return s;
  }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function hatchD(x0, y0, x1, y1, gap) {
    var d = '';
    for (var c = Math.ceil((x0 + y0) / gap) * gap; c < x1 + y1; c += gap) {
      var xa = Math.max(x0, c - y1), xb = Math.min(x1, c - y0);
      if (xb - xa < 0.6) continue;
      d += 'M' + xa.toFixed(1) + ' ' + (c - xa).toFixed(1) + ' L' + xb.toFixed(1) + ' ' + (c - xb).toFixed(1) + ' ';
    }
    return d;
  }

  window.InkKit.define('guess-line', {
    label: 'Choose two numbers, the height and the tilt of a line, so the squares of the misses add up to as little as possible',
    steps: 1,
    seed: 31,
    draw: function (k) {
      var sx = k.scale(X0, X1, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(Y0, Y1, PLOT.y + PLOT.h, PLOT.y);
      var height = 13, tilt = 0, best = Infinity, busy = false, cancel = null, history = [];

      k.root.axes({
        x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'day', ylabel: 'sales',
        xticks: [0].concat(DAYS).map(function (d) { return [sx(d), String(d)]; }),
        yticks: [0, 5, 10, 15, 20].map(function (v) { return [sy(v), String(v)]; })
      });

      var sq = k.root.layer();
      var hatch = sq.path('', { w: 0.6, op: 0.42 });
      var boxes = sq.path('', { w: 0.9, op: 0.75 });
      var misses = sq.path('', { w: 1.1, op: 0.6 });

      var marks = k.root.group({ d: 120, stagger: 30 });
      SALES.forEach(function (v, i) { marks.mark(sx(DAYS[i]), sy(v), 'o', { r: 4 }); });
      marks.node.style.pointerEvents = 'none';

      /* the line: the one accent, a clean path rewritten as it moves */
      var focus = k.root.layer();
      var lineNode = focus.path('', { accent: true, w: 1.6, op: 0.95 });

      function lineAt(x) { return height + tilt * x; }
      function paint() {
        // the part of the line inside the plot
        var a = X0, b = X1;
        if (Math.abs(tilt) > 1e-9) {
          var xa = (Y0 - height) / tilt, xb = (Y1 - height) / tilt;
          a = Math.max(a, Math.min(xa, xb)); b = Math.min(b, Math.max(xa, xb));
        }
        lineNode.setAttribute('d', b > a ? 'M' + sx(a).toFixed(1) + ' ' + sy(lineAt(a)).toFixed(1) + ' L' + sx(b).toFixed(1) + ' ' + sy(lineAt(b)).toFixed(1) : '');
        var h = '', bx = '', m = '';
        SALES.forEach(function (v, i) {
          var px = sx(DAYS[i]), py = sy(v), gy = Math.max(PLOT.y, Math.min(PLOT.y + PLOT.h, sy(lineAt(DAYS[i])))), s = Math.abs(py - gy);
          if (s < 0.5) return;
          var x0 = DAYS[i] <= 4 ? px : px - s, x1 = x0 + s, y0 = Math.min(py, gy), y1 = Math.max(py, gy);
          h += hatchD(x0, y0, x1, y1, 6);
          bx += 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' H' + x1.toFixed(1) + ' V' + y1.toFixed(1) + ' H' + x0.toFixed(1) + ' Z ';
          m += 'M' + px.toFixed(1) + ' ' + py.toFixed(1) + ' V' + gy.toFixed(1) + ' ';
        });
        hatch.setAttribute('d', h); boxes.setAttribute('d', bx); misses.setAttribute('d', m);
        placeHandles();
        var t = totalMiss(height, tilt);
        if (t < best) best = t;
        vTotal.set(f2(t)); vBest.set(f2(best));
        drawChart();
      }

      /* ---- the column beside the plot ---- */
      var sH = k.slider({
        x: SIDE + 4, y: 66, w: 150, min: 0, max: 20, step: 0.1, value: height, label: 'height',
        format: function (v) { return v.toFixed(1); },
        onChange: function (v) { if (busy) return; height = v; history = []; paint(); }
      });
      var sT = k.slider({
        x: SIDE + 4, y: 114, w: 150, min: -1, max: 3, step: 0.05, value: tilt, label: 'tilt',
        format: function (v) { return v.toFixed(2); },
        onChange: function (v) { if (busy) return; tilt = v; history = []; paint(); }
      });

      /* ---- two handles on the line itself: the one at day 0 is the height (drag it up and down, the tilt
              stays), the one further along is the tilt (drag it and the line turns about day 0). They set
              the sliders, so the two routes always agree and snap to the same steps. ---- */
      function handle(label, bounds, onMove) {
        var g = k.root.group({ d: 400 });
        g.circle(0, 0, 6.5, { w: 1.4, op: 0.95 });
        g.dot(0, 0, 2, {});
        var hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hit.setAttribute('r', 16); hit.setAttribute('class', 'ik-hit');
        g.node.appendChild(hit);
        var dr = k.draggable(g.node, { label: label, bounds: bounds, onMove: onMove, onEnd: function () { tiltDay = null; } });
        return { g: g, drag: dr };
      }
      function dataY(y) { return Y0 + (PLOT.y + PLOT.h - y) / PLOT.h * (Y1 - Y0); }
      var tiltDay = null;                                // the day the tilt handle stood on when the drag began
      var hH = handle('The height of the line, at day 0. Up and down arrow keys move it.',
        { x0: sx(0), y0: sy(20), x1: sx(0), y1: sy(0) },
        function (x, y) { if (!busy) sH.set(dataY(y)); });
      var hT = handle('The tilt of the line: it turns about day 0. Up and down arrow keys move it.',
        { x0: PLOT.x, y0: PLOT.y, x1: PLOT.x + PLOT.w, y1: PLOT.y + PLOT.h },
        function (x, y) {
          if (busy) return;
          if (tiltDay == null) tiltDay = tiltHandleDay();
          sT.set((dataY(y) - height) / tiltDay);
        });
      /* the tilt handle sits at day 7.6, past the last dot, or where the line leaves the plot if that comes first */
      function tiltHandleDay() {
        var d = 7.6, edge = tilt > 0 ? Y1 - 0.6 : Y0 + 0.6;
        if (Math.abs(tilt) > 1e-9 && (lineAt(d) > Y1 - 0.6 || lineAt(d) < Y0 + 0.6)) d = (edge - height) / tilt;
        return Math.max(1, d);
      }
      function placeHandles() {
        var xh = sx(0), yh = sy(height);
        hH.g.node.setAttribute('transform', 'translate(' + xh.toFixed(1) + ' ' + yh.toFixed(1) + ')');
        hH.drag.set(xh, yh);
        var d = tiltDay != null ? tiltDay : tiltHandleDay();
        var xt = sx(d), yt = Math.max(PLOT.y, Math.min(PLOT.y + PLOT.h, sy(lineAt(d))));
        hT.g.node.setAttribute('transform', 'translate(' + xt.toFixed(1) + ' ' + yt.toFixed(1) + ')');
        hT.drag.set(xt, yt);
      }

      var side = k.root.group({ d: 250 });
      side.text(SIDE, 148, 'total miss', { kind: 'label' });
      var vTotal = side.text(SIDE + 158, 148, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 166, 'lowest so far', { kind: 'label' });
      var vBest = side.text(SIDE + 158, 166, '', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 178, SIDE + 158, 178, { w: 0.6, op: 0.45, rough: 0.3 });

      k.button(SIDE, 204, 'let the nudges do it', function () {
        if (busy) return;
        var left = ROUNDS;
        history = [totalMiss(height, tilt)];
        busy = true;
        (function again() {
          if (left-- <= 0) { busy = false; return; }
          // one round: nudge the height by the average miss, then the tilt by the average of miss x day
          var mh = 0, mt = 0, i;
          for (i = 0; i < SALES.length; i++) mh += SALES[i] - lineAt(DAYS[i]);
          var h0 = height, h1 = height + RATE * mh / SALES.length;
          for (i = 0; i < SALES.length; i++) mt += (SALES[i] - (h1 + tilt * DAYS[i])) * DAYS[i];
          var t0 = tilt, t1 = tilt + RATE * mt / SALES.length / 20;   // 20: the average of day x day, so the tilt's nudge is in step with the height's
          cancel = k.animate(70, function (u) {
            height = h0 + (h1 - h0) * u; tilt = t0 + (t1 - t0) * u;
            if (u >= 1) {
              height = h1; tilt = t1; history.push(totalMiss(height, tilt));
              sH.set(height, true); sT.set(tilt, true);
            }
            paint();
            if (u >= 1) setTimeout(again, 30);
          });
        })();
      });
      k.button(SIDE, 234, 'back to flat', function () {
        if (cancel) cancel();
        busy = false; height = 13; tilt = 0; history = [];
        sH.set(height, true); sT.set(tilt, true); paint();
      });
      k.root.group({ d: 500 }).callout('a', 'tilt 0 is one number', SIDE, 262);

      /* ---- the total, nudge by nudge ---- */
      var cx0 = SIDE + 8, cx1 = SIDE + 156, cy0 = 306, cy1 = 396, TOP = 80;
      var chartG = k.root.group({ d: 350 });
      chartG.text(SIDE, cy0 - 14, 'total, nudge by nudge', { kind: 'label' });
      chartG.line(cx0, cy1, cx1, cy1, { w: 0.8, rough: 0.3 });
      chartG.line(cx0, cy1, cx0, cy0, { w: 0.8, rough: 0.3 });
      chartG.text(cx0 - 4, cy1 + 3, '0', { kind: 'axis', anchor: 'end' });
      chartG.text(cx0 - 4, cy0 + 3, String(TOP), { kind: 'axis', anchor: 'end' });
      var chart = k.root.layer();
      var walk = chart.path('', { w: 1.2, op: 0.85 });
      var here = chart.dot(-10, -10, 2.6, { op: 1 });
      function drawChart() {
        if (history.length < 1) { walk.setAttribute('d', ''); here.style.display = 'none'; return; }
        here.style.display = '';
        var d = '';
        history.forEach(function (v, i) {
          d += (i ? ' L' : 'M') + (cx0 + (cx1 - cx0) * i / ROUNDS).toFixed(1) + ' ' + (cy1 - (cy1 - cy0) * Math.min(v, TOP) / TOP).toFixed(1);
        });
        walk.setAttribute('d', d);
        var n = history.length - 1, v = history[n];
        here.setAttribute('cx', (cx0 + (cx1 - cx0) * n / ROUNDS).toFixed(1));
        here.setAttribute('cy', (cy1 - (cy1 - cy0) * Math.min(v, TOP) / TOP).toFixed(1));
      }

      k.onStep(function () { paint(); });
    }
  });
})();
