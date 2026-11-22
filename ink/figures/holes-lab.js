/* Holes lab — what you do with a hole in a table, by hand, before anything is named.
   24 made-up people: years at work (x) and income in thousands (y). Six left the income blank.
   Steps: 0 the blanks fell by chance: click each blank row to throw it away, watch the average of what is left
          1 the same, but the blanks are mostly the highest incomes: the average slides down
          2 fill one hole (29 years) by dragging a star; then see the average of the rest, what the
            closest line says, and the real value, with each one's miss
   The figure "cheats": it shows the blank incomes (squares) so the reader can check. Everything is computed:
   averages of the rows kept, the least-squares line on the complete rows. The table is written out below so
   the page's Python works on exactly the same numbers (window.InkPage). Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 }, SIDE = 462, XMAX = 32, YMAX = 110;
  var X = [1, 2, 3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 25, 26, 27, 29];
  var Y = [39, 27, 38, 34, 42, 52, 35, 56, 53, 64, 59, 61, 66, 53, 70, 54, 65, 65, 85, 71, 91, 86, 94, 92];
  var CHANCE = [3, 6, 11, 12, 17, 23];      // a cup of coffee over a few forms
  var HIGH = [14, 18, 20, 21, 22, 23];      // mostly the highest incomes
  var FOCUS = 23;                           // the hole the reader fills by hand: 29 years
  var STORE = 'ink-holes-fill', START_FILL = 50;

  function average(v) { var s = 0; for (var i = 0; i < v.length; i++) s += v[i]; return s / v.length; }
  function fit(idx) {
    var xs = idx.map(function (i) { return X[i]; }), ys = idx.map(function (i) { return Y[i]; });
    var mx = average(xs), my = average(ys), top = 0, bottom = 0;
    for (var j = 0; j < xs.length; j++) { top += (xs[j] - mx) * (ys[j] - my); bottom += (xs[j] - mx) * (xs[j] - mx); }
    var slope = top / bottom;
    return { height: my - slope * mx, slope: slope };
  }
  function table(holes) { return X.map(function (x, i) { return [x, holes.indexOf(i) >= 0 ? null : Y[i]]; }); }
  /* a dashed line: a plain path that fades with its step (inked strokes use the dash pattern to draw in) */
  function dashed(g, d, w, op, dash) {
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', w); p.setAttribute('stroke-dasharray', dash || '4 5');
    p.setAttribute('class', 'ik-fade'); p.style.setProperty('--ik-op', op);
    g.node.appendChild(p);
    return p;
  }
  function remembered() {
    try { var v = parseFloat(sessionStorage.getItem(STORE)); return isFinite(v) ? v : null; } catch (e) { return null; }
  }

  /* what `from page import points, points_high, truth, my_fill` gives the Python on the same page */
  window.InkPage = window.InkPage || {};
  window.InkPage.points = function () { return table(CHANCE); };
  window.InkPage.points_high = function () { return table(HIGH); };
  window.InkPage.truth = function () { return Y.slice(); };
  window.InkPage.my_fill = function () { var v = remembered(); return v == null ? START_FILL : v; };

  window.InkKit.define('holes-lab', {
    label: 'Holes in a table: throw away the rows with a blank and watch the average, then fill one blank by hand',
    steps: 3,
    seed: 29,
    draw: function (k) {
      var sx = k.scale(0, XMAX, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(0, YMAX, PLOT.y + PLOT.h, PLOT.y);
      function yOf(py) { return (PLOT.y + PLOT.h - py) / PLOT.h * YMAX; }
      var all = X.map(function (_, i) { return i; });
      var TRUE_AVG = average(Y);

      var tick = function (v) { return [sx(v), String(v)]; }, ytick = function (v) { return [sy(v), String(v)]; };
      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'years at work', ylabel: 'income, thousands',
        xticks: [0, 10, 20, 30].map(tick), yticks: [0, 20, 40, 60, 80, 100].map(ytick) });

      /* ---- the rows: each drawn once as a circle (income given) and as a square (left blank) ---- */
      var marks = k.root.group({ d: 150, stagger: 12 });
      var circles = [], squares = [];
      X.forEach(function (x, i) {
        circles.push(marks.mark(sx(x), sy(Y[i]), 'o', { r: 3.6 }));
        squares.push(marks.mark(sx(x), sy(Y[i]), 'sq', { r: 3.6 }));
      });
      marks.node.style.pointerEvents = 'none';

      /* ---- steps 0 and 1: the average of what is left, and the true one ---- */
      var lines01 = k.root.group({ steps: [0, 1], d: 300 });
      dashed(lines01, 'M' + PLOT.x + ' ' + sy(TRUE_AVG).toFixed(1) + ' L' + (PLOT.x + PLOT.w) + ' ' + sy(TRUE_AVG).toFixed(1), 0.9, 0.6);
      var avgGroup = lines01.group({ d: 400 });
      avgGroup.path('M' + PLOT.x + ' 0 L' + (PLOT.x + PLOT.w) + ' 0', { w: 1.6, accent: true, op: 0.95 });
      var avgNow = TRUE_AVG;
      function placeAvg(v) { avgGroup.node.setAttribute('transform', 'translate(0 ' + sy(v).toFixed(1) + ')'); }

      var holes = CHANCE, thrown = {}, busy = false, cancel = null;
      function keptIdx() { return all.filter(function (i) { return !thrown[i]; }); }
      function keptAvg() { return average(keptIdx().map(function (i) { return Y[i]; })); }

      /* clickable rings over the blank rows */
      var hits = k.root.group({ steps: [0, 1] });
      var hitNodes = X.map(function (x, i) {
        var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', sx(x)); c.setAttribute('cy', sy(Y[i])); c.setAttribute('r', 11);
        c.setAttribute('class', 'ik-hit'); c.style.cursor = 'pointer';
        c.setAttribute('tabindex', '0'); c.setAttribute('role', 'button');
        c.setAttribute('aria-label', 'Throw away the row at ' + x + ' years');
        c.addEventListener('click', function () { throwAway(i); });
        c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); throwAway(i); } });
        hits.node.appendChild(c);
        return c;
      });

      var side = k.root.group({ steps: [0, 1], d: 250 });
      side.text(SIDE, 60, 'rows kept', { kind: 'label' });
      var vKept = side.text(SIDE + 158, 60, '24 of 24', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 80, 'average now', { kind: 'label' });
      var vAvg = side.text(SIDE + 158, 80, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 100, 'true average', { kind: 'label' });
      side.text(SIDE + 158, 100, TRUE_AVG.toFixed(1), { kind: 'val', anchor: 'end' });
      side.text(SIDE, 120, 'gap', { kind: 'label' });
      var vGap = side.text(SIDE + 158, 120, '', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 132, SIDE + 158, 132, { w: 0.6, op: 0.45, rough: 0.3 });
      // the key
      side.line(SIDE, 250, SIDE + 22, 250, { w: 1.6, accent: true, rough: 0.2 });
      side.text(SIDE + 30, 253.5, 'average of rows kept', { kind: 'axis' });
      dashed(side, 'M' + SIDE + ' 270 L' + (SIDE + 22) + ' 270', 0.9, 0.6);
      side.text(SIDE + 30, 273.5, 'true average', { kind: 'axis' });
      side.mark(SIDE + 11, 290, 'o', { r: 3.4 });
      side.text(SIDE + 30, 293.5, 'income given', { kind: 'axis' });
      side.mark(SIDE + 11, 310, 'sq', { r: 3.4 });
      side.text(SIDE + 30, 313.5, 'left blank (shown', { kind: 'axis' });
      side.text(SIDE + 30, 327, 'so you can check)', { kind: 'axis' });

      k.button(SIDE, 170, 'throw them all away', function () {
        if (busy) return;
        holes.forEach(function (i) { thrown[i] = true; });
        showRows(); glideAvg();
      }, { steps: [0, 1] });
      k.button(SIDE, 206, 'put them back', function () {
        if (busy) return;
        thrown = {}; showRows(); glideAvg();
      }, { steps: [0, 1] });
      k.root.group({ steps: [0], d: 500 }).callout('a', 'click a square to drop it', SIDE, 380);
      k.root.group({ steps: [1], d: 500 }).callout('b', 'now the high earners', SIDE, 380);

      function throwAway(i) {
        if (k.step() > 1 || holes.indexOf(i) < 0 || thrown[i] || busy) return;
        thrown[i] = true; showRows(); glideAvg();
      }
      function glideAvg() {
        var from = avgNow, to = keptAvg();
        if (cancel) cancel();
        cancel = k.animate(600, function (t) {
          avgNow = from + (to - from) * t; placeAvg(avgNow); readout01();
        });
      }
      function readout01() {
        vKept.set(keptIdx().length + ' of 24');
        vAvg.set(avgNow.toFixed(1));
        var g = avgNow - TRUE_AVG;
        vGap.set((g > 0.05 ? '+' : g < -0.05 ? '−' : '') + Math.abs(g).toFixed(1));
      }
      function showRows() {
        X.forEach(function (_, i) {
          var blank = holes.indexOf(i) >= 0;
          circles[i].style.display = blank ? 'none' : '';
          squares[i].style.display = blank && !thrown[i] ? '' : 'none';
          hitNodes[i].style.pointerEvents = blank && !thrown[i] && k.step() < 2 ? 'auto' : 'none';
          hitNodes[i].style.display = blank && !thrown[i] ? '' : 'none';
        });
      }

      /* ---- step 2: fill one hole ---- */
      var KEPT2 = all.filter(function (i) { return CHANCE.indexOf(i) < 0; });
      var AVG2 = average(KEPT2.map(function (i) { return Y[i]; }));
      var LINE = fit(KEPT2), LINE_AT = LINE.height + LINE.slope * X[FOCUS];
      var FX = sx(X[FOCUS]);

      var g2 = k.root.group({ steps: [2], d: 200 });
      CHANCE.forEach(function (i) {         // where the holes are: a thin upright line at each
        dashed(g2, 'M' + sx(X[i]).toFixed(1) + ' ' + PLOT.y + ' L' + sx(X[i]).toFixed(1) + ' ' + (PLOT.y + PLOT.h),
          i === FOCUS ? 0.9 : 0.6, i === FOCUS ? 0.6 : 0.3, '3 5');
      });

      var cand = k.root.layer({ steps: [2] });       // the average line, the fitted line, their marks
      var reveal = k.root.layer({ steps: [2] });
      var shown = { avg: false, line: false, real: false };

      var star = k.root.group({ steps: [2], d: 0, stagger: 0 });
      var starG = star.group({ d: 0 });
      starG.circle(0, 0, 8, { accent: true, w: 1.6, op: 0.95, dur: 260 });
      starG.dot(0, 0, 2.2, { accent: true });
      var grab = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      grab.setAttribute('r', 16); grab.setAttribute('class', 'ik-hit');
      starG.node.appendChild(grab);
      var fill = remembered() == null ? START_FILL : remembered();
      function placeStar() { starG.node.setAttribute('transform', 'translate(' + FX.toFixed(1) + ' ' + sy(fill).toFixed(1) + ')'); }
      var drag = k.draggable(starG.node, {
        label: 'Your fill for the person with 29 years at work. Up and down arrows move it.',
        bounds: { x0: FX, y0: PLOT.y + 4, x1: FX, y1: PLOT.y + PLOT.h - 4 },
        onMove: function (x, y) {
          fill = Math.round(yOf(y));
          placeStar(); readout2();
          try { sessionStorage.setItem(STORE, String(fill)); } catch (e) {}
        }
      });

      var s2 = k.root.group({ steps: [2], d: 250 });
      s2.text(SIDE + 104, 50, 'income', { kind: 'label', anchor: 'end' });
      s2.text(SIDE + 158, 50, 'miss', { kind: 'label', anchor: 'end' });
      var rowsTxt = [['yours'], ['average'], ['line'], ['real']].map(function (r, i) {
        var y = 72 + i * 20;
        s2.text(SIDE, y, r[0], { kind: 'label' });
        return { v: s2.text(SIDE + 104, y, '–', { kind: 'val', anchor: 'end' }), m: s2.text(SIDE + 158, y, '', { kind: 'val', anchor: 'end' }) };
      });
      s2.line(SIDE, 144, SIDE + 158, 144, { w: 0.6, op: 0.45, rough: 0.3 });
      // the key to the candidates
      s2.mark(SIDE + 6, 286, '+', { r: 3.6 });
      s2.text(SIDE + 18, 289.5, 'the average of the rest', { kind: 'axis' });
      s2.mark(SIDE + 6, 304, 'x', { r: 3.4 });
      s2.text(SIDE + 18, 307.5, 'what the line says', { kind: 'axis' });
      s2.mark(SIDE + 6, 322, 'sq', { r: 3.4 });
      s2.text(SIDE + 18, 325.5, 'the real value', { kind: 'axis' });
      var hand2 = k.root.group({ steps: [2], d: 600 });
      hand2.text(SIDE, 360, 'drag the star', { kind: 'hand' });
      hand2.text(SIDE, 382, 'up or down.', { kind: 'hand' });

      function readout2() {
        var real = Y[FOCUS];
        rowsTxt[0].v.set(String(Math.round(fill)));
        rowsTxt[1].v.set(shown.avg ? AVG2.toFixed(1) : '–');
        rowsTxt[2].v.set(shown.line ? LINE_AT.toFixed(1) : '–');
        rowsTxt[3].v.set(shown.real ? String(real) : '?');
        rowsTxt[0].m.set(shown.real ? Math.abs(fill - real).toFixed(0) : '');
        rowsTxt[1].m.set(shown.real && shown.avg ? Math.abs(AVG2 - real).toFixed(1) : '');
        rowsTxt[2].m.set(shown.real && shown.line ? Math.abs(LINE_AT - real).toFixed(1) : '');
      }
      function drawCandidates(grow) {
        cand.clear();
        var t = grow || { avg: 1, line: 1 };
        if (shown.avg) {
          var xe = PLOT.x + PLOT.w * t.avg;
          cand.path('M' + PLOT.x + ' ' + sy(AVG2).toFixed(1) + ' L' + xe.toFixed(1) + ' ' + sy(AVG2).toFixed(1), { w: 0.8, op: 0.6 });
          if (t.avg >= 1) cand.mark(FX, sy(AVG2), '+', { r: 4.2, w: 1.3, d: 0 });
        }
        if (shown.line) {
          var x1 = XMAX * t.line;
          cand.path('M' + sx(0).toFixed(1) + ' ' + sy(LINE.height).toFixed(1) + ' L' + sx(x1).toFixed(1) + ' ' + sy(LINE.height + LINE.slope * x1).toFixed(1), { w: 1.1, op: 0.85 });
          if (t.line >= 1) cand.mark(FX, sy(LINE_AT), 'x', { r: 3.8, w: 1.3, d: 0 });
        }
      }
      function grow(which) {
        if (busy) return;
        shown[which] = true; busy = true;
        var g = { avg: 1, line: 1 };
        k.animate(800, function (t) {
          g[which] = t; drawCandidates(g); readout2();
          if (t >= 1) busy = false;
        });
      }
      k.button(SIDE, 176, 'average of the rest', function () { grow('avg'); }, { steps: [2] });
      k.button(SIDE, 210, 'what the line says', function () { grow('line'); }, { steps: [2] });
      k.button(SIDE, 244, 'show the real value', function () {
        if (busy || shown.real) return;
        shown.real = true; reveal.clear();
        reveal.mark(FX, sy(Y[FOCUS]), 'sq', { r: 4, w: 1.3, d: 0 });
        readout2();
      }, { steps: [2] });

      k.onStep(function (step) {
        busy = false; if (cancel) cancel();
        if (step < 2) {
          holes = step === 0 ? CHANCE : HIGH; thrown = {};
          avgNow = TRUE_AVG; placeAvg(avgNow);
          showRows(); readout01();
        } else {
          X.forEach(function (_, i) {
            var blank = CHANCE.indexOf(i) >= 0;
            circles[i].style.display = blank ? 'none' : '';
            squares[i].style.display = 'none';
            hitNodes[i].style.display = 'none';
          });
          shown = { avg: false, line: false, real: false };
          cand.clear(); reveal.clear();
          fill = remembered() == null ? START_FILL : remembered();
          drag.set(FX, sy(fill));
          placeStar(); readout2();
        }
      });
    }
  });
})();
