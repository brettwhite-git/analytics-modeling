/* Smoothing figure — guessing the next value of a wobbly series, then blending: move part of the way.
   Steps: 0 a guessing game. Twelve values are shown; the reader drags a ring to guess the next one, then
            reveals it. Ten rounds, with a running total of the misses for the reader and for two simple rules,
            "same as today" and "the average so far".
          1 move part of the way. A slider sets how far the estimate moves toward each new value; the line of
            guesses, the total miss and the arithmetic of the last move are recomputed. "play it step by step"
            walks the estimate along the series one value at a time.
          2 how far should you move? The same series and a noisier one (same hidden level, more noise), with
            the total miss at every setting and the best one marked.
          3 the same with a sudden jump in the level, and how many steps the estimate takes to catch up.
   In steps 1 to 3 the reader can also drag any value up or down and watch the guesses and the totals react;
   "put the points back" restores them. The drags live in a working copy, never in DATA.
   Everything is computed in the browser from seeded made-up data. The series, a noisier copy, a steadily rising
   series and the reader's setting are offered to the page's Python through window.InkPage.
   Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 };
  var SIDE = 462, SW = 158;
  var N = 40, X1 = 42, Y0 = 28, Y1 = 76;
  var SHOW = 12, ROUNDS = 10;                        // step 0: values shown at the start, values to guess
  var STEP0 = 0.5;                                   // the setting before the reader touches the slider
  var NOISE = 3, NOISY = 8;                          // how much each value wobbles off the hidden level
  var JUMP_AT = 24, JUMP = 10, NEAR = 2;             // step 3: the level rises by JUMP from value JUMP_AT
  var STORE = 'ink-forecast-step';

  function r1(v) { return Math.round(v * 10) / 10; }
  function gauss(r) { return (r() + r() + r() - 1.5) * 2; }

  /* a hidden level wandering around 50, and one wobble per value; rounded to one decimal so the page's Python
     works on exactly the same numbers */
  var DATA = (function () {
    var a = window.InkKit.rng(24), b = window.InkKit.rng(124), l = 50, level = [], z = [], t;
    for (t = 0; t < N; t++) { l = 50 + 0.9 * (l - 50) + 1.6 * gauss(a); level.push(l); }
    for (t = 0; t < N; t++) z.push(gauss(b));
    var c = window.InkKit.rng(7), rising = [];
    for (t = 0; t < 30; t++) rising.push(r1(20 + 1.5 * t + 1.5 * gauss(c)));
    return {
      level: level,
      series: level.map(function (v, i) { return r1(v + NOISE * z[i]); }),
      noisy: level.map(function (v, i) { return r1(v + NOISY * z[i]); }),
      rising: rising
    };
  })();
  var JUMPED = DATA.series.map(function (v, i) { return r1(v + (i >= JUMP_AT ? JUMP : 0)); });

  /* the blend. g[i] is the guess for value i, made before it was seen; g[N] is the guess for the next, unseen
     value. Same arithmetic, in the same order, as the lesson's Python. */
  function blend(v, a) {
    var e = v[0], g = [null], total = 0;
    for (var i = 1; i < v.length; i++) {
      g.push(e);
      total = total + Math.abs(v[i] - e);
      e = e + a * (v[i] - e);
    }
    g.push(e);
    return { g: g, total: total };
  }
  function averageTotal(v) {
    var sum = v[0], total = 0;
    for (var i = 1; i < v.length; i++) { total += Math.abs(v[i] - sum / i); sum += v[i]; }
    return total;
  }
  var SETTINGS = [];
  for (var s = 1; s <= 20; s++) SETTINGS.push(s / 20);

  function remembered() {
    try { var v = parseFloat(sessionStorage.getItem(STORE)); return v > 0 && v <= 1 ? v : null; } catch (e) { return null; }
  }
  function remember(v) { try { sessionStorage.setItem(STORE, String(v)); } catch (e) {} }

  /* what `from page import series, noisy, rising, my_step` gives the Python on the same page (see ink/py.js) */
  window.InkPage = window.InkPage || {};
  window.InkPage.series = function () { return DATA.series; };
  window.InkPage.noisy = function () { return DATA.noisy; };
  window.InkPage.rising = function () { return DATA.rising; };
  window.InkPage.my_step = function () { return remembered() || STEP0; };

  window.InkKit.define('smoothing-figure', {
    label: 'Forecasting a wobbly series: guess the next value, then blend by moving part of the way toward each new value',
    steps: 4,
    seed: 5,
    draw: function (k) {
      var sx = k.scale(0, X1, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(Y0, Y1, PLOT.y + PLOT.h, PLOT.y);
      function X(i) { return sx(i + 1); }
      function Y(v) { return sy(k.clamp(v, Y0 + 0.5, Y1 - 0.5)); }
      function toValue(y) { return r1(Y0 + (PLOT.y + PLOT.h - y) / PLOT.h * (Y1 - Y0)); }
      function pts(v) { return v.map(function (y, i) { return [X(i), Y(y)]; }); }
      /* a clean data stroke inside a stepped group. The kit's draw-in rule is `.ik-ink path`, so a bare path
         never un-draws when its step ends; wrapping it in a <g> that carries the class makes the rule apply. */
      function stroke(g, points, o) {
        var p = g.polyline(points, o), w = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        w.setAttribute('class', p.getAttribute('class'));
        w.style.cssText = p.style.cssText;
        p.removeAttribute('class'); p.removeAttribute('style');
        g.node.insertBefore(w, p); w.appendChild(p);
        return w;
      }
      function signed(v) { return (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1); }

      k.root.axes({
        x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'step', ylabel: 'value',
        xticks: [1, 10, 20, 30, 40].map(function (t) { return [sx(t), String(t)]; }),
        yticks: [30, 40, 50, 60, 70].map(function (v) { return [sy(v), String(v)]; })
      });
      var busy = false;

      /* ================= step 0: what would you guess for tomorrow? ================= */
      var series = DATA.series;
      var g0 = k.root.group({ steps: [0], d: 150, stagger: 14 });
      stroke(g0, pts(series.slice(0, SHOW)), { w: 0.6, op: 0.3, d: 0, dur: 700 });
      var gameMarks = series.slice(0, SHOW + ROUNDS).map(function (v, i) { return g0.mark(X(i), Y(v), 'o', { r: 3 }); });
      var past0 = k.root.layer({ steps: [0] });
      var rules0 = k.root.layer({ steps: [0] });
      var round = 0, revealed = false, guess = 52, tally = { you: 0, same: 0, avg: 0 }, mine = [];

      // the ring the reader drags: drawn once at the origin and moved, so it never re-wobbles
      var ringG = k.root.group({ steps: [0], d: 400 });
      var ring = ringG.group({ d: 400 });
      ring.circle(0, 0, 7, { accent: true, w: 1.6, op: 0.95 });
      ring.line(-18, 0, -10, 0, { accent: true, w: 1.1, rough: 0.2 });
      ring.line(10, 0, 18, 0, { accent: true, w: 1.1, rough: 0.2 });
      var grab = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      grab.setAttribute('r', 16); grab.setAttribute('class', 'ik-hit');
      ring.node.appendChild(grab);
      var bounds = { x0: 0, y0: PLOT.y + 4, x1: 0, y1: PLOT.y + PLOT.h - 4 };
      var drag = k.draggable(ring.node, {
        label: 'Your guess for the next value. Arrow keys move it up and down.', bounds: bounds,
        onMove: function (x, y) { if (k.step() === 0 && !revealed) { guess = toValue(y); placeRing(); readout0(); } }
      });
      function placeRing() {
        var x = X(SHOW + round), y = Y(guess);
        bounds.x0 = bounds.x1 = x;
        drag.set(x, y);
        ring.node.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
      }
      // a click anywhere on the plot also sets the guess (only its height matters)
      var hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      hit.setAttribute('x', PLOT.x); hit.setAttribute('y', PLOT.y); hit.setAttribute('width', PLOT.w); hit.setAttribute('height', PLOT.h);
      hit.setAttribute('class', 'ik-hit'); hit.style.cursor = 'row-resize';
      k.root.node.insertBefore(hit, g0.node);
      hit.addEventListener('click', function (e) {
        if (k.step() !== 0 || revealed) return;
        guess = toValue(k.toFigure(e).y); placeRing(); readout0();
      });

      var side0 = k.root.group({ steps: [0], d: 250 });
      side0.text(SIDE, 46, 'round', { kind: 'label' });
      var vRound = side0.text(SIDE + SW, 46, '', { kind: 'val', anchor: 'end' });
      side0.text(SIDE, 66, 'your guess', { kind: 'label' });
      var vGuess = side0.text(SIDE + SW, 66, '', { kind: 'val', anchor: 'end' });
      side0.text(SIDE, 86, 'it came in at', { kind: 'label' });
      var vCame = side0.text(SIDE + SW, 86, '', { kind: 'val', anchor: 'end' });
      side0.line(SIDE, 98, SIDE + SW, 98, { w: 0.6, op: 0.45, rough: 0.3 });
      side0.text(SIDE, 120, 'total miss so far', { kind: 'label' });
      side0.circle(SIDE + 5, 138, 4, { w: 1.1 });
      side0.text(SIDE + 16, 142, 'you', { kind: 'axis' });
      var vYou = side0.text(SIDE + SW, 142, '', { kind: 'val', anchor: 'end' });
      side0.mark(SIDE + 5, 158, '+', { r: 3.6 });
      side0.text(SIDE + 16, 162, 'same as today', { kind: 'axis' });
      var vSame = side0.text(SIDE + SW, 162, '', { kind: 'val', anchor: 'end' });
      side0.mark(SIDE + 5, 178, 'x', { r: 3.2 });
      side0.text(SIDE + 16, 182, 'average so far', { kind: 'axis' });
      var vAvg = side0.text(SIDE + SW, 182, '', { kind: 'val', anchor: 'end' });

      var bReveal = k.button(SIDE, 222, 'reveal the next value', function () {
        if (busy || k.step() !== 0) return;
        if (!revealed) reveal();
        else if (round < ROUNDS - 1) { round++; revealed = false; placeRing(); drawRound(); readout0(); }
      }, { steps: [0] });
      var bAgain = k.button(SIDE, 258, 'start over', function () { if (!busy) start0(); }, { steps: [0] });
      var callA = k.root.group({ steps: [0], d: 900 });
      callA.callout('a', 'drag the ring', SIDE, 304);
      var hand0 = k.root.group({ steps: [0], d: 300 });
      var h0a = hand0.text(SIDE, 352, 'could you blend', { kind: 'hand' });
      var h0b = hand0.text(SIDE, 374, 'the two rules?', { kind: 'hand' });

      function rulesAt(n) {
        var sum = 0;
        for (var i = 0; i < n; i++) sum += series[i];
        return { same: series[n - 1], avg: sum / n };
      }
      function reveal() {
        var n = SHOW + round, r = rulesAt(n), v = series[n];
        revealed = true;
        tally.you += Math.abs(v - guess); tally.same += Math.abs(v - r.same); tally.avg += Math.abs(v - r.avg);
        mine.push([n, guess]);
        drawRound(); readout0();
      }
      function drawRound() {
        var n = SHOW + round, shown = SHOW + round + (revealed ? 1 : 0);
        gameMarks.forEach(function (m, i) { m.style.display = i < shown ? '' : 'none'; });
        past0.clear();
        // the reader's earlier guesses stay as small dots, joined to the value that came in
        mine.forEach(function (p) {
          if (p[0] === n && revealed) return;
          past0.path('M' + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1) + ' L' + X(p[0]).toFixed(1) + ' ' + Y(series[p[0]]).toFixed(1), { w: 0.8, op: 0.55 });
          past0.dot(X(p[0]), Y(p[1]), 2.2, { op: 0.7 });
        });
        // the path through the values seen so far
        past0.polyline(pts(series.slice(0, shown)), { w: 0.6, op: 0.3 });
        rules0.clear();
        if (revealed) {
          var r = rulesAt(n), x = X(n), v = series[n];
          rules0.path('M' + x.toFixed(1) + ' ' + Y(guess).toFixed(1) + ' L' + x.toFixed(1) + ' ' + Y(v).toFixed(1), { w: 0.8, op: 0.6 });
          rules0.mark(x + 12, Y(r.same), '+', { r: 3.6 });
          rules0.mark(x + 12, Y(r.avg), 'x', { r: 3.2 });
        }
        var done = revealed && round === ROUNDS - 1;
        bReveal.set(!revealed ? 'reveal the next value' : done ? 'all ten done' : 'next round');
        callA.node.style.display = round === 0 && !revealed ? '' : 'none';
        h0a.style.display = h0b.style.display = done ? '' : 'none';
        bAgain.node.style.display = round > 0 || revealed ? '' : 'none';
      }
      function readout0() {
        vRound.set((round + 1) + ' of ' + ROUNDS);
        vGuess.set(guess.toFixed(1));
        vCame.set(revealed ? series[SHOW + round].toFixed(1) : '?');
        var any = mine.length > 0;
        vYou.set(any ? tally.you.toFixed(1) : '–');
        vSame.set(any ? tally.same.toFixed(1) : '–');
        vAvg.set(any ? tally.avg.toFixed(1) : '–');
      }
      function start0() {
        round = 0; revealed = false; tally = { you: 0, same: 0, avg: 0 }; mine = [];
        guess = 52; placeRing(); drawRound(); readout0();
      }

      /* steps 1 to 3: the reader may drag any value up or down. A drag is kept as an offset for that step,
         added to whichever series is shown; DATA itself is never touched, so InkPage gives the original values. */
      var nudge = {}, nMoved = 0;
      function work(base) {
        if (!nMoved) return base;
        return base.map(function (v, i) { return nudge[i] != null ? r1(k.clamp(v + nudge[i], Y0 + 0.5, Y1 - 0.5)) : v; });
      }
      /* move drawn-once marks with a transform, so they never re-wobble, and redraw the thin path through them */
      function placeMarks(marks, path, base, v, faint) {
        marks.forEach(function (m, i) {
          var dy = Y(v[i]) - Y(base[i]);
          if (dy) m.setAttribute('transform', 'translate(0 ' + dy.toFixed(1) + ')'); else m.removeAttribute('transform');
        });
        path.setAttribute('d', pts(v).map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' '));
        faint.clear();
        for (var j in nudge) {
          var x = X(+j).toFixed(1);
          faint.path('M' + x + ' ' + Y(base[j]).toFixed(1) + ' L' + x + ' ' + Y(v[j]).toFixed(1), { w: 0.6, op: 0.4 });
        }
      }

      /* ================= step 1: move part of the way ================= */
      var g1 = k.root.group({ steps: [1], d: 150, stagger: 8 });
      var path1 = stroke(g1, pts(series), { w: 0.6, op: 0.3, d: 0, dur: 900 }).firstChild;
      var marks1 = series.map(function (v, i) { return g1.mark(X(i), Y(v), 'o', { r: 3 }); });
      var faint1 = k.root.layer({ steps: [1] });
      var line1 = k.root.layer({ steps: [1] });
      var a1 = remembered() || STEP0;
      function cur1() { return work(series); }

      var side1 = k.root.group({ steps: [1], d: 300 });
      side1.text(SIDE, 96, 'total miss', { kind: 'label' });
      var vTotal1 = side1.text(SIDE + SW, 96, '', { kind: 'val', anchor: 'end' });
      side1.text(SIDE, 116, 'same as today', { kind: 'axis' });
      var vSame1 = side1.text(SIDE + SW, 116, blend(series, 1).total.toFixed(1), { kind: 'axis', anchor: 'end' });
      side1.text(SIDE, 134, 'average so far', { kind: 'axis' });
      var vAvg1 = side1.text(SIDE + SW, 134, averageTotal(series).toFixed(1), { kind: 'axis', anchor: 'end' });
      side1.line(SIDE, 148, SIDE + SW, 148, { w: 0.6, op: 0.45, rough: 0.3 });
      var vStepLabel = side1.text(SIDE, 170, '', { kind: 'label' });
      var vWas = side1.text(SIDE, 190, '', { kind: 'code' });
      var vCameIn = side1.text(SIDE, 208, '', { kind: 'code' });
      var vMove = side1.text(SIDE, 226, '', { kind: 'code' });
      var vNext = side1.text(SIDE, 244, '', { kind: 'code' });

      function lastMove(v, a, i, g) {
        // the move made on seeing value i: from the guess g[i] toward v[i], to the next guess g[i + 1]
        vStepLabel.set('the move at step ' + (i + 1));
        vWas.set('guess was  ' + g[i].toFixed(1));
        vCameIn.set('came in    ' + v[i].toFixed(1));
        vMove.set('move ' + a.toFixed(2) + ' of ' + signed(v[i] - g[i]));
        vNext.set('new guess  ' + g[i + 1].toFixed(1));
      }
      function guessLine(g, upto) {
        var out = [];
        for (var i = 1; i <= upto; i++) out.push([X(i), Y(g[i])]);
        return out;
      }
      function draw1() {
        var v = cur1(), b = blend(v, a1);
        placeMarks(marks1, path1, series, v, faint1);
        line1.clear();
        line1.polyline(guessLine(b.g, N), { w: 1.7, accent: true });
        line1.circle(X(N), Y(b.g[N]), 4.5, { accent: true, w: 1.4 });
        vTotal1.set(b.total.toFixed(1));
        vSame1.set(blend(v, 1).total.toFixed(1));
        vAvg1.set(averageTotal(v).toFixed(1));
        lastMove(v, a1, N - 1, b.g);
      }
      var playing = 0;
      function play1() {
        if (busy) return;
        var series = cur1();                         // the values as they stand, moved or not
        var b = blend(series, a1), token = ++playing, i = 1, running = 0;
        busy = true;
        (function next() {
          if (token !== playing || k.step() !== 1) { busy = false; return; }
          if (i >= N) { busy = false; draw1(); return; }
          var x0 = X(i), x1 = X(i + 1), y0 = Y(b.g[i]), y1 = Y(b.g[i + 1]), yv = Y(series[i]);
          var line = guessLine(b.g, i);
          lastMove(series, a1, i, b.g);
          running += Math.abs(series[i] - b.g[i]);
          vTotal1.set(running.toFixed(1));
          k.animate(240, function (t) {
            if (token !== playing) return;
            line1.clear();
            if (line.length > 1) line1.polyline(line, { w: 1.7, accent: true });
            // first half: the miss shows, and the estimate moves part of the way toward the value
            // second half: it carries that new estimate one step on, as the guess for the next value
            var up = Math.min(1, t * 2), on = Math.max(0, t * 2 - 1);
            line1.path('M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' L' + x0.toFixed(1) + ' ' + yv.toFixed(1), { w: 0.7, op: 0.55 });
            var yNow = y0 + (y1 - y0) * up;
            if (on > 0) line1.path('M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' L' + (x0 + (x1 - x0) * on).toFixed(1) + ' ' + (y0 + (y1 - y0) * on).toFixed(1), { w: 1.7, accent: true });
            line1.circle(on > 0 ? x0 + (x1 - x0) * on : x0, on > 0 ? y0 + (y1 - y0) * on : yNow, 4, { accent: true, w: 1.4 });
            if (t >= 1) { i++; setTimeout(next, 30); }
          });
        })();
      }
      k.slider({
        x: SIDE, y: 60, w: SW, min: 0.05, max: 1, step: 0.05, value: a1, label: 'how far to move', steps: [1],
        format: function (v) { return v.toFixed(2); },
        onChange: function (v) { a1 = v; remember(v); playing++; busy = false; draw1(); }
      });
      k.button(SIDE, 286, 'play it step by step', play1, { steps: [1] });
      k.root.group({ steps: [1], d: 900 }).callout('b', 'part of the way', SIDE, 330);

      /* ================= steps 2 and 3: how far should you move? ================= */
      var noisyOn = false, a2 = STEP0;
      function base23() { return k.step() === 3 ? JUMPED : noisyOn ? DATA.noisy : series; }
      function data23() { return work(base23()); }
      function levelAt(i, jump) { return DATA.level[i] + (jump && i >= JUMP_AT ? JUMP : 0); }
      [false, true].forEach(function (jump) {
        var g = k.root.group({ steps: [jump ? 3 : 2], d: 200 });
        g.thread(DATA.level.map(function (l, i) { return [X(i), Y(levelAt(i, jump))]; }), { w: 1.1, op: 0.6 });
        g.thread([[PLOT.x + 12, PLOT.y + PLOT.h - 16], [PLOT.x + 40, PLOT.y + PLOT.h - 16]], { w: 1.1, op: 0.6 });
        g.text(PLOT.x + 47, PLOT.y + PLOT.h - 12.5, 'the hidden level', { kind: 'axis' });
        if (jump) {
          g.line(X(JUMP_AT - 0.5), PLOT.y + 14, X(JUMP_AT - 0.5), PLOT.y + PLOT.h, { w: 0.6, op: 0.4, rough: 0.2 });
          g.text(X(JUMP_AT - 0.5), PLOT.y + 9, 'the level jumps', { kind: 'axis', anchor: 'middle' });
        }
      });
      var obs23 = k.root.layer({ steps: [2, 3] });
      var faint23 = k.root.layer({ steps: [2, 3] });
      var line23 = k.root.layer({ steps: [2, 3] });
      var side23 = k.root.group({ steps: [2, 3], d: 300 });
      side23.text(SIDE, 92, 'total miss', { kind: 'label' });
      var vTotal2 = side23.text(SIDE + SW, 92, '', { kind: 'val', anchor: 'end' });
      side23.text(SIDE, 112, 'best setting', { kind: 'label' });
      var vBest = side23.text(SIDE + SW, 112, '', { kind: 'val', anchor: 'end' });
      var g2 = k.root.group({ steps: [2], d: 300 });
      g2.text(SIDE, 132, 'showing', { kind: 'label' });
      var vShowing = g2.text(SIDE + SW, 132, '', { kind: 'val', anchor: 'end' });
      var g3 = k.root.group({ steps: [3], d: 300 });
      g3.text(SIDE, 132, 'steps to catch up', { kind: 'label' });
      var vCatch = g3.text(SIDE + SW, 132, '', { kind: 'val', anchor: 'end' });
      var bNoise = k.button(SIDE, 164, 'make it noisier', function () {
        if (k.step() !== 2) return;
        noisyOn = !noisyOn; bNoise.set(noisyOn ? 'back to the calm one' : 'make it noisier'); redraw23(true);
      }, { steps: [2] });

      // the total miss at every setting, as a small curve
      var CX = SIDE + 4, CW = SW - 8, CT = 226, CB = 284;
      side23.text(SIDE, 208, 'miss at each setting', { kind: 'label' });
      side23.line(SIDE, CB + 6, SIDE + SW, CB + 6, { w: 0.8, rough: 0.3 });
      side23.text(CX, CB + 20, '0', { kind: 'axis', anchor: 'middle' });
      side23.text(CX + CW, CB + 20, '1', { kind: 'axis', anchor: 'middle' });
      var curve23 = k.root.layer({ steps: [2, 3] }), dot23 = k.root.layer({ steps: [2, 3] });
      var grid = [], lo = 0, hi = 1, best = STEP0, shownData = null, marks23 = [], path23 = null;
      function cx(a) { return CX + a * CW; }
      function cy(e) { return CB - (e - lo) / ((hi - lo) || 1) * (CB - CT); }

      function redrawLine23() {
        var v = data23(), b = blend(v, a2);
        line23.clear();
        line23.polyline(guessLine(b.g, N), { w: 1.7, accent: true });
        dot23.clear();
        dot23.line(cx(a2), CB + 6, cx(a2), cy(b.total) + 5, { w: 0.6, op: 0.5, rough: 0.2 });
        dot23.circle(cx(a2), cy(b.total), 4, { w: 1.3 });
        vTotal2.set(b.total.toFixed(1));
        vBest.set(best.toFixed(2));
        vShowing.set(noisyOn ? 'noisier' : 'calm');
        if (k.step() === 3) {
          // after the jump, how many values until the estimate is within NEAR of the new level
          var n = -1;
          for (var i = JUMP_AT; i < N; i++) if (b.g[i + 1] >= levelAt(i, true) - NEAR) { n = i - JUMP_AT + 1; break; }
          vCatch.set(n < 0 ? 'never' : String(n));
        }
      }
      function redraw23(force) {
        var base = base23(), v = work(base);
        // the marks are drawn once per series; moved values only shift them (see placeMarks)
        if (base !== shownData || force) {
          shownData = base;
          var p = pts(base);
          obs23.clear();
          path23 = obs23.polyline(p, { w: 0.6, op: 0.3 });
          marks23 = p.map(function (q) { return obs23.mark(q[0], q[1], 'o', { r: 3 }); });
        }
        placeMarks(marks23, path23, base, v, faint23);
        // the miss at every setting is recomputed from the values as they stand, so a moved value shows here too
        grid = []; lo = Infinity; hi = -Infinity;
        SETTINGS.forEach(function (a) {
          var e = blend(v, a).total;
          grid.push([a, e]);
          if (e < lo - 1e-9) { lo = e; best = a; }
          if (e > hi) hi = e;
        });
        curve23.clear();
        curve23.polyline(grid.map(function (g) { return [cx(g[0]), cy(g[1])]; }), { w: 1.1 });
        curve23.path('M' + cx(best).toFixed(1) + ' ' + (CB + 2) + ' L' + cx(best).toFixed(1) + ' ' + (CB + 10), { w: 1.1 });
        curve23.text(cx(best), CB + 34, 'best', { kind: 'axis', anchor: 'middle' });
        redrawLine23();
      }
      k.slider({
        x: SIDE, y: 60, w: SW, min: 0.05, max: 1, step: 0.05, value: STEP0, label: 'how far to move', steps: [2, 3],
        format: function (v) { return v.toFixed(2); },
        onChange: function (v) { a2 = v; redrawLine23(); }
      });
      var callC = k.root.group({ steps: [2] }).callout('c', 'more noise, smaller step', SIDE, 360, { d: 400 });
      var callD = g3.callout('d', 'a real change', SIDE, 352, { d: 300 });
      var hand3a = g3.text(SIDE, 386, 'a big step notices,', { kind: 'hand', d: 700 });
      var hand3b = g3.text(SIDE, 408, 'a small step lags.', { kind: 'hand', d: 1100 });

      /* ================= steps 1 to 3: drag the values themselves ================= */
      // one hit area over the plot finds the nearest value; nothing else on the plot takes a press in these steps
      var hitP = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      hitP.setAttribute('x', PLOT.x); hitP.setAttribute('y', PLOT.y); hitP.setAttribute('width', PLOT.w); hitP.setAttribute('height', PLOT.h);
      hitP.setAttribute('class', 'ik-hit');
      hitP.style.touchAction = 'none'; hitP.style.pointerEvents = 'none';
      k.root.node.appendChild(hitP);
      k.root.node.appendChild(ringG.node);           // the reader's guess ring stays on top of everything
      var held = -1, frame = 0;
      function shownNow() { return k.step() === 1 ? cur1() : data23(); }
      function baseNow() { return k.step() === 1 ? series : base23(); }
      function nearestValue(p) {
        var v = shownNow(), pick = -1, bd = 11 * 11;
        for (var i = 0; i < N; i++) {
          var dx = X(i) - p.x, dy = Y(v[i]) - p.y, d = dx * dx + dy * dy;
          if (d <= bd) { bd = d; pick = i; }
        }
        return pick;
      }
      function refreshPoints() {
        frame = 0;
        if (k.step() === 1) draw1(); else if (k.step() > 1) redraw23(false);
        syncMoved();
      }
      hitP.addEventListener('pointerdown', function (e) {
        if (e.button || k.step() === 0) return;
        var i = nearestValue(k.toFigure(e));
        if (i < 0) return;
        e.preventDefault();
        try { hitP.setPointerCapture(e.pointerId); } catch (err) {}
        held = i; hitP.style.cursor = 'grabbing';
        playing++; busy = false;                     // a drag stops "play it step by step"
      });
      hitP.addEventListener('pointermove', function (e) {
        var p = k.toFigure(e);
        if (held < 0) { hitP.style.cursor = nearestValue(p) >= 0 ? 'grab' : ''; return; }
        var d = r1(k.clamp(toValue(p.y), Y0 + 0.5, Y1 - 0.5) - baseNow()[held]);
        if (Math.abs(d) < 0.05) delete nudge[held]; else nudge[held] = d;
        nMoved = Object.keys(nudge).length;
        if (!frame) frame = requestAnimationFrame(refreshPoints);
      });
      function letGo() {
        if (held < 0) return;
        held = -1; hitP.style.cursor = 'grab';
        if (frame) { cancelAnimationFrame(frame); refreshPoints(); }
      }
      hitP.addEventListener('pointerup', letGo);
      hitP.addEventListener('pointercancel', letGo);

      /* once a value has moved: an honest note, and the way back. Nothing is saved; a reload restores them. */
      var movedG = k.root.group({ steps: [1, 2, 3], d: 0 });
      movedG.text(SIDE, 358, 'points moved: the numbers', { kind: 'axis' });
      movedG.text(SIDE, 372, 'in the text are for the', { kind: 'axis' });
      movedG.text(SIDE, 386, 'original points.', { kind: 'axis' });
      var bBack = k.button(SIDE, 416, 'put the points back', function () {
        nudge = {}; nMoved = 0; playing++; busy = false; refreshPoints();
      }, { steps: [1, 2, 3] });
      function syncMoved() {
        var on = nMoved > 0;
        movedG.node.style.display = bBack.node.style.display = on ? '' : 'none';
        callC.style.display = callD.style.display = hand3a.style.display = hand3b.style.display = on ? 'none' : '';
      }

      k.onStep(function (step) {
        playing++; busy = false;
        hit.style.pointerEvents = step === 0 ? 'auto' : 'none';
        hitP.style.pointerEvents = step === 0 ? 'none' : 'auto';
        held = -1;
        if (step === 0) { nudge = {}; nMoved = 0; }
        syncMoved();
        if (step === 0) start0();
        else if (step === 1) { a1 = remembered() || a1; draw1(); }
        else redraw23(true);
      });
    }
  });
})();
