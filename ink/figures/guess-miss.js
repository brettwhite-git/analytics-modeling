/* Guess-miss — score a one-number guess, by hand, before anything is named.
   Seven days of made-up sales. The reader drags one guess (a level line) up and down.
   Each miss is drawn as a hatched square whose side is the miss, so the total miss is the ink in the squares.
   Steps: 0 drag the guess, read the squares and the total
          1 the same, with a small curve of total-against-guess that draws in for every guess tried
   The guess snaps to whole numbers, so every total can be checked by hand. The guess and the guesses tried
   are remembered (sessionStorage), so the second mount continues where the first left off.
   Offers `sales`, `days` and `my_guess` to the page's Python through window.InkPage.
   Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 }, SIDE = 462;
  var X0 = 0, X1 = 8, Y0 = 0, Y1 = 24;
  var SALES = [10, 12, 9, 15, 11, 16, 18];          // made up; the average is 13, the middle value 12
  var DAYS = [1, 2, 3, 4, 5, 6, 7];
  var LO = 4, HI = 22, START = 10;          // the guess can go from 4 to 22: the same total at both ends
  var STORE = 'ink-guess-guess', TRIED = 'ink-guess-tried';

  function totalMiss(g) {
    var t = 0;
    for (var i = 0; i < SALES.length; i++) t += (SALES[i] - g) * (SALES[i] - g);
    return t;
  }
  function remembered() {
    try { var v = +sessionStorage.getItem(STORE); return v >= LO && v <= HI && sessionStorage.getItem(STORE) !== null ? v : null; } catch (e) { return null; }
  }
  function tried() {
    try { var v = JSON.parse(sessionStorage.getItem(TRIED)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function remember(g) {
    try {
      sessionStorage.setItem(STORE, String(g));
      var t = tried(); if (t.indexOf(g) < 0) { t.push(g); sessionStorage.setItem(TRIED, JSON.stringify(t)); }
    } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('ink:guess', { detail: g })); } catch (e) {}
  }

  /* what `from page import sales, days, my_guess` gives the Python on the same page (see ink/py.js) */
  window.InkPage = window.InkPage || {};
  window.InkPage.sales = function () { return SALES.slice(); };
  window.InkPage.days = function () { return DAYS.slice(); };
  window.InkPage.my_guess = function () { var g = remembered(); return g == null ? START : g; };

  /* a clean 45 degree hatch inside a box, on a fixed lattice so it does not crawl as the box grows */
  function hatchD(x0, y0, x1, y1, gap) {
    var d = '';
    for (var c = Math.ceil((x0 + y0) / gap) * gap; c < x1 + y1; c += gap) {
      var xa = Math.max(x0, c - y1), xb = Math.min(x1, c - y0);
      if (xb - xa < 0.6) continue;
      d += 'M' + xa.toFixed(1) + ' ' + (c - xa).toFixed(1) + ' L' + xb.toFixed(1) + ' ' + (c - xb).toFixed(1) + ' ';
    }
    return d;
  }

  window.InkKit.define('guess-miss', {
    label: 'Drag a one-number guess up and down over seven days of sales; each miss is drawn as a square and the squares are added up',
    steps: 2,
    seed: 23,
    draw: function (k) {
      var sx = k.scale(X0, X1, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(Y0, Y1, PLOT.y + PLOT.h, PLOT.y);
      var guess = START, seen = [];

      k.root.axes({
        x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'day', ylabel: 'sales',
        xticks: DAYS.map(function (d) { return [sx(d), String(d)]; }),
        yticks: [0, 5, 10, 15, 20].map(function (v) { return [sy(v), String(v)]; })
      });

      /* the squares and the misses: clean paths, rewritten as the guess moves */
      var sq = k.root.layer();
      var hatch = sq.path('', { w: 0.6, op: 0.42 });
      var boxes = sq.path('', { w: 0.9, op: 0.75 });
      var misses = sq.path('', { w: 1.1, op: 0.6 });

      /* the seven days, drawn once */
      var marks = k.root.group({ d: 120, stagger: 30 });
      SALES.forEach(function (v, i) { marks.mark(sx(DAYS[i]), sy(v), 'o', { r: 4 }); });
      marks.node.style.pointerEvents = 'none';

      /* the guess: the one accent. Drawn once at y = 0 and moved with a transform */
      var line = k.root.group({ d: 0 });
      line.line(PLOT.x, 0, PLOT.x + PLOT.w, 0, { accent: true, w: 1.6, op: 0.95, rough: 0.35 });
      var grab = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      grab.setAttribute('x', PLOT.x); grab.setAttribute('y', -11); grab.setAttribute('width', PLOT.w); grab.setAttribute('height', 22);
      grab.setAttribute('class', 'ik-hit'); grab.style.cursor = 'ns-resize';
      line.node.appendChild(grab);
      k.draggable(line.node, {
        label: 'Your guess. Arrow keys move it up and down.',
        bounds: { x0: 0, y0: sy(HI), x1: k.W, y1: sy(LO) },
        onMove: function (x, y) {
          var g = Math.round(Y0 + (PLOT.y + PLOT.h - y) / PLOT.h * (Y1 - Y0));
          g = Math.max(LO, Math.min(HI, g));
          if (g !== guess) { guess = g; note(g); remember(g); paint(); }
        },
        onEnd: function () { paint(); }
      });

      function paint() {
        var gy = sy(guess), h = '', b = '', m = '';
        SALES.forEach(function (v, i) {
          var px = sx(DAYS[i]), py = sy(v), s = Math.abs(py - gy);
          if (s < 0.5) return;
          var x0 = DAYS[i] <= 4 ? px : px - s, x1 = x0 + s, y0 = Math.min(py, gy), y1 = Math.max(py, gy);
          h += hatchD(x0, y0, x1, y1, 6);
          b += 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' H' + x1.toFixed(1) + ' V' + y1.toFixed(1) + ' H' + x0.toFixed(1) + ' Z ';
          m += 'M' + px.toFixed(1) + ' ' + py.toFixed(1) + ' V' + gy.toFixed(1) + ' ';
        });
        hatch.setAttribute('d', h); boxes.setAttribute('d', b); misses.setAttribute('d', m);
        line.node.setAttribute('transform', 'translate(0 ' + gy.toFixed(1) + ')');
        readout(); drawCurve();
      }

      /* ---- the column beside the plot ---- */
      var side = k.root.group({ d: 250 });
      side.text(SIDE, 60, 'your guess', { kind: 'label' });
      var vGuess = side.text(SIDE + 158, 60, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 80, 'total miss', { kind: 'label' });
      var vTotal = side.text(SIDE + 158, 80, '', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 92, SIDE + 158, 92, { w: 0.6, op: 0.45, rough: 0.3 });
      side.text(SIDE, 116, 'the squares', { kind: 'label' });
      var vSq1 = side.text(SIDE, 136, '', { kind: 'axis' });
      var vSq2 = side.text(SIDE, 152, '', { kind: 'axis' });

      function readout() {
        vGuess.set(String(guess));
        vTotal.set(String(totalMiss(guess)));
        var parts = SALES.map(function (v) { return String((v - guess) * (v - guess)); });
        var one = parts.join(' + ');
        if (one.length <= 23) { vSq1.set(one); vSq2.set(''); }
        else { vSq1.set(parts.slice(0, 4).join(' + ') + ' +'); vSq2.set(parts.slice(4).join(' + ')); }
      }

      var g0 = k.root.group({ steps: [0], d: 500 });
      g0.callout('a', 'drag the line', SIDE, 196);
      g0.text(SIDE, 232, 'a big miss makes', { kind: 'hand' });
      g0.text(SIDE, 254, 'a big square.', { kind: 'hand' });

      /* ---- step 1: the total for every guess tried, drawn in as the reader explores ---- */
      var cx0 = SIDE + 8, cx1 = SIDE + 156, cy0 = 300, cy1 = 396, TOP = 660;
      var csx = k.scale(LO - 1, HI + 1, cx0, cx1), csy = k.scale(0, TOP, cy1, cy0);
      var g1 = k.root.group({ steps: [1], d: 300 });
      g1.text(SIDE, 196, 'lowest you found', { kind: 'label' });
      var vBest = g1.text(SIDE + 158, 216, '', { kind: 'val', anchor: 'end' });
      g1.text(SIDE, 216, 'guess → total', { kind: 'axis' });
      g1.text(SIDE, cy0 - 26, 'total for each guess', { kind: 'label' });
      g1.text(SIDE, cy0 - 12, 'you tried', { kind: 'label' });
      g1.line(cx0, cy1, cx1, cy1, { w: 0.8, rough: 0.3 });
      g1.line(cx0, cy1, cx0, cy0, { w: 0.8, rough: 0.3 });
      [LO, 13, HI].forEach(function (v) { g1.text(csx(v), cy1 + 14, String(v), { kind: 'axis', anchor: 'middle' }); });
      var curve = k.root.layer({ steps: [1] });
      var curvePath = curve.path('', { w: 1.2, op: 0.85 });
      var curveDots = curve.path('', { w: 1.1, op: 0.7 });
      var here = curve.dot(0, 0, 3, { op: 1 });

      function note(g) { if (seen.indexOf(g) < 0) seen.push(g); }
      function drawCurve() {
        var s = seen.slice().sort(function (a, b) { return a - b; }), d = '', dots = '';
        for (var i = 0; i < s.length; i++) {
          var x = csx(s[i]).toFixed(1), y = csy(totalMiss(s[i])).toFixed(1);
          // join neighbours that are one apart, so the curve appears only where the reader has been
          d += (i && s[i] - s[i - 1] === 1 ? ' L' : ' M') + x + ' ' + y;
          dots += 'M' + (+x - 3).toFixed(1) + ' ' + y + ' h6 ';     // a small tick for every guess tried
        }
        curvePath.setAttribute('d', d); curveDots.setAttribute('d', dots);
        here.setAttribute('cx', csx(guess).toFixed(1)); here.setAttribute('cy', csy(totalMiss(guess)).toFixed(1));
        if (s.length) {
          var best = s[0];
          s.forEach(function (g) { if (totalMiss(g) < totalMiss(best)) best = g; });
          vBest.set(best + ' → ' + totalMiss(best));
        } else vBest.set('–');
      }

      window.addEventListener('ink:guess', function (e) {
        // another mount of this figure moved the guess: keep the record of guesses tried in step
        if (e.detail !== guess) note(e.detail);
        if (k.step() === 1) drawCurve();
      });

      k.onStep(function () {
        var g = remembered();
        guess = g == null ? START : g;
        seen = tried().filter(function (v) { return v >= LO && v <= HI; });
        note(guess);
        paint();
      });
    }
  });
})();
