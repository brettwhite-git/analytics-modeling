/* Guess-nudge — improve a guess a little at a time, without trying every number.
   The same seven days of made-up sales as guess-miss. One nudge: work out the average miss (sales minus
   guess, signs kept), and move the guess by (step size x average miss). The reader presses "nudge" and
   watches the guess glide, the total fall, and the path on a small bowl of total-against-guess.
   Steps: 0 a sensible step size (0.5): the guess slides in and settles at the average
          1 a step size that is too big (2.2): every nudge jumps past the best and the total goes UP
   The step size is a slider in both steps, so the reader can also find the crawl (0.05) and the jump (1).
   Offers `sales` and `days` through window.InkPage (the same numbers as guess-miss).
   Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 }, SIDE = 462;
  var X0 = 0, X1 = 8, Y0 = 0, Y1 = 24;
  var SALES = [10, 12, 9, 15, 11, 16, 18];
  var DAYS = [1, 2, 3, 4, 5, 6, 7];
  var START = 10, STEPS = [0.5, 2.2];

  function totalMiss(g) { var t = 0; SALES.forEach(function (v) { t += (v - g) * (v - g); }); return t; }
  function lean(g) { var t = 0; SALES.forEach(function (v) { t += v - g; }); return t / SALES.length; }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function signed(v) { return (v > 0.004 ? '+' : v < -0.004 ? '−' : '') + f2(Math.abs(v)); }

  window.InkPage = window.InkPage || {};
  window.InkPage.sales = window.InkPage.sales || function () { return SALES.slice(); };
  window.InkPage.days = window.InkPage.days || function () { return DAYS.slice(); };

  window.InkKit.define('guess-nudge', {
    label: 'Nudge a guess toward the best one: each nudge moves it by the step size times the average miss',
    steps: 2,
    seed: 29,
    draw: function (k) {
      var sx = k.scale(X0, X1, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(Y0, Y1, PLOT.y + PLOT.h, PLOT.y);
      function syc(v) { return Math.max(PLOT.y, Math.min(PLOT.y + PLOT.h, sy(v))); }
      var guess = START, history = [], busy = false, cancel = null, gone = false;

      k.root.axes({
        x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'day', ylabel: 'sales',
        xticks: DAYS.map(function (d) { return [sx(d), String(d)]; }),
        yticks: [0, 5, 10, 15, 20].map(function (v) { return [sy(v), String(v)]; })
      });

      /* earlier guesses (faint) and the misses: clean paths, rewritten as the guess moves */
      var live = k.root.layer();
      var trail = live.path('', { w: 0.8, op: 0.3 });
      var misses = live.path('', { w: 1.1, op: 0.55 });

      var marks = k.root.group({ d: 120, stagger: 30 });
      SALES.forEach(function (v, i) { marks.mark(sx(DAYS[i]), sy(v), 'o', { r: 4 }); });
      marks.node.style.pointerEvents = 'none';

      /* the guess: the one accent, drawn once and moved */
      var line = k.root.group({ d: 0 });
      line.line(PLOT.x, 0, PLOT.x + PLOT.w, 0, { accent: true, w: 1.6, op: 0.95, rough: 0.35 });
      var grab = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      grab.setAttribute('x', PLOT.x); grab.setAttribute('y', -11); grab.setAttribute('width', PLOT.w); grab.setAttribute('height', 22);
      grab.setAttribute('class', 'ik-hit'); grab.style.cursor = 'ns-resize';
      line.node.appendChild(grab);
      k.draggable(line.node, {
        label: 'The starting guess. Arrow keys move it.',
        bounds: { x0: 0, y0: sy(22), x1: k.W, y1: sy(2) },
        onMove: function (x, y) {
          if (busy) return;
          var g = Math.round((Y0 + (PLOT.y + PLOT.h - y) / PLOT.h * (Y1 - Y0)) * 2) / 2;
          if (g !== guess || history.length > 1) restart(g);
        }
      });

      function paint() {
        var gy = syc(guess), m = '', t = '';
        SALES.forEach(function (v, i) { m += 'M' + sx(DAYS[i]).toFixed(1) + ' ' + sy(v).toFixed(1) + ' V' + gy.toFixed(1) + ' '; });
        history.slice(0, -1).slice(-8).forEach(function (h) {
          var y = syc(h.g).toFixed(1);
          t += 'M' + PLOT.x + ' ' + y + ' H' + (PLOT.x + PLOT.w) + ' ';
        });
        misses.setAttribute('d', m); trail.setAttribute('d', t);
        line.node.setAttribute('transform', 'translate(0 ' + gy.toFixed(1) + ')');
        readout(); drawBowl();
      }

      /* ---- the column beside the plot ---- */
      var side = k.root.group({ d: 250 });
      side.text(SIDE, 52, 'guess', { kind: 'label' });
      var vGuess = side.text(SIDE + 158, 52, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 70, 'average miss', { kind: 'label' });
      var vLean = side.text(SIDE + 158, 70, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 88, 'total miss', { kind: 'label' });
      var vTotal = side.text(SIDE + 158, 88, '', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 98, SIDE + 158, 98, { w: 0.6, op: 0.45, rough: 0.3 });

      var slider = k.slider({
        x: SIDE + 4, y: 136, w: 150, min: 0.05, max: 2.5, step: 0.05, value: STEPS[0], label: 'step size',
        format: function (v) { return v.toFixed(2); },
        onChange: function () { if (!busy && history.length > 1) restart(START); }
      });

      k.button(SIDE, 170, 'nudge', function () { nudge(480); });
      k.button(SIDE + 66, 170, 'ten nudges', function () {
        if (busy) return;
        var left = 10;
        (function again() { if (left-- > 0 && !gone && !settled()) nudge(300, function () { setTimeout(again, 90); }); })();
      });
      k.button(SIDE, 200, 'start again', function () { if (!busy) restart(START); });
      var vNote = side.text(SIDE, 226, '', { kind: 'axis' });

      k.root.group({ steps: [0], d: 500 }).callout('a', 'press nudge', SIDE, 250);
      k.root.group({ steps: [1], d: 500 }).callout('b', 'it jumps past the best', SIDE, 250);

      function settled() { return Math.abs(lean(guess)) < 0.005; }
      function readout() {
        vGuess.set(f2(guess)); vLean.set(signed(lean(guess))); vTotal.set(f2(totalMiss(guess)));
        var n = history.length - 1;
        if (gone) vNote.set('nudge ' + n + ': off the page');
        else if (n < 1) vNote.set('nudge 0');
        else {
          var a = history[n - 1].t, b = history[n].t;
          if (settled()) vNote.set('nudge ' + n + ': settled');
          else vNote.set('nudge ' + n + ': ' + (b <= a ? 'down ' + f2(a - b) : 'UP ' + f2(b - a)));
        }
      }

      /* ---- the bowl: total against guess, with the path the nudges took ---- */
      var LO = 4, HI = 22, TOP = totalMiss(HI), bx0 = SIDE + 8, bx1 = SIDE + 156, by0 = 300, by1 = 396;
      var bsx = k.scale(LO, HI, bx0, bx1), bsy = k.scale(0, TOP, by1, by0);
      var bowl = k.root.group({ d: 350 });
      bowl.text(SIDE, by0 - 14, 'total, nudge by nudge', { kind: 'label' });
      bowl.line(bx0, by1, bx1, by1, { w: 0.8, rough: 0.3 });
      bowl.line(bx0, by1, bx0, by0, { w: 0.8, rough: 0.3 });
      [LO, 13, HI].forEach(function (v) { bowl.text(bsx(v), by1 + 14, String(v), { kind: 'axis', anchor: 'middle' }); });
      var shape = [];
      for (var g = LO; g <= HI + 1e-9; g += 0.25) shape.push([bsx(g), bsy(totalMiss(g))]);
      bowl.polyline(shape, { w: 0.7, op: 0.45 });
      var pathLayer = k.root.layer();
      var walk = pathLayer.path('', { w: 1.1, op: 0.85 });
      var here = pathLayer.dot(0, 0, 3, { op: 1 });
      function bp(h) {
        var x = Math.max(bx0, Math.min(bx1, bsx(h.g))), y = Math.max(by0 - 6, Math.min(by1, bsy(h.t)));
        return [x, y];
      }
      function drawBowl() {
        var d = '';
        history.forEach(function (h, i) { var p = bp(h); d += (i ? ' L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); });
        var now = bp({ g: guess, t: totalMiss(guess) });
        walk.setAttribute('d', d);
        here.setAttribute('cx', now[0].toFixed(1)); here.setAttribute('cy', now[1].toFixed(1));
      }

      /* ---- one nudge: move by step size x average miss, gliding there ---- */
      function nudge(ms, done) {
        if (busy || gone) return;
        var from = guess, to = guess + slider.value * lean(guess);
        busy = true;
        cancel = k.animate(ms, function (t) {
          guess = from + (to - from) * t;
          paint();
          if (t >= 1) {
            guess = to; busy = false;
            history.push({ g: guess, t: totalMiss(guess) });
            if (guess < Y0 - 6 || guess > Y1 + 6) gone = true;
            paint();
            if (done) done();
          }
        });
      }
      function restart(g) {
        if (cancel) cancel();
        busy = false; gone = false; guess = g;
        history = [{ g: guess, t: totalMiss(guess) }];
        paint();
      }

      k.onStep(function (step) {
        slider.set(STEPS[step], true);
        restart(START);
      });
    }
  });
})();
