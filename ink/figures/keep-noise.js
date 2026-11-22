/* Keep-noise — does a useless measurement hurt? The reader ticks measurements on and off.
   Steps: 0 tick any of five measurements (one real, four pure chance); the model is refitted and every plant's
          guess glides to its new place. Two readouts: the miss on the eight seen plants and on eight fresh ones.
          1 choose one at a time: each round tries every measurement not yet kept and keeps the one that helps the
          fresh plants most, stopping when none helps (animated, round by round).
   The fit is the lesson's own loop (variable-selection-from-scratch.qmd, cell 3), run here with the same numbers,
   so the misses printed by the page's Python match these readouts. Made-up plants. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 }, SIDE = 462, LO = 5, HI = 45;
  var STORE = 'ink-keep-ticks';
  var NAMES = ['sun', 'name', 'day', 'pot', 'coin'];
  var LONG = ['hours of sun', 'letters in name', 'day sown', 'pot number', 'coin heads'];

  /* sixteen made-up plants: sun, letters in the gardener's name, day sown, pot, heads in ten tosses, height (cm) */
  var SEEN = [[9, 8, 2, 8, 5, 29], [7, 4, 4, 9, 5, 25], [10, 4, 3, 6, 6, 39], [4, 6, 6, 9, 6, 14],
              [2, 8, 2, 9, 6, 15], [4, 6, 6, 7, 2, 17], [6, 9, 2, 5, 5, 21], [6, 10, 7, 4, 8, 24]];
  var FRESH = [[4, 5, 5, 10, 8, 17], [8, 6, 6, 6, 5, 30], [7, 5, 5, 9, 8, 25], [2, 9, 2, 9, 4, 12],
               [10, 6, 1, 8, 5, 31], [7, 9, 5, 10, 3, 28], [10, 3, 6, 9, 5, 38], [4, 6, 4, 9, 5, 17]];

  /* the lesson's Python, line for line */
  function middles(rows) {
    var mids = [];
    for (var j = 0; j < 6; j++) { var s = 0; rows.forEach(function (r) { s += r[j]; }); mids.push(s / rows.length); }
    return mids;
  }
  var AVG = middles(SEEN);
  function guess(w, row) {
    var g = AVG[5];
    for (var j = 0; j < 5; j++) g = g + w[j] * (row[j] - AVG[j]);
    return g;
  }
  function miss(w, rows) {
    var total = 0;
    rows.forEach(function (row) { var off = row[5] - guess(w, row); total = total + off * off; });
    return total;
  }
  function fit(use, sweeps) {
    var rate = [], j;
    for (j = 0; j < 5; j++) {
      var swing = 0;
      SEEN.forEach(function (row) { var d = row[j] - AVG[j]; swing += d * d; });
      rate.push(1 / (2 * swing));
    }
    var w = [0, 0, 0, 0, 0];
    for (var s = 0; s < (sweeps || 40); s++) {
      use.forEach(function (j) {
        var old = w[j], before = miss(w, SEEN);
        w[j] = old + 0.001;
        var slope = (miss(w, SEEN) - before) / 0.001;
        w[j] = old - rate[j] * slope;
      });
    }
    return w;
  }
  /* every one of the 32 choices, fitted once */
  var FITS = {};
  function keyOf(use) { return use.slice().sort().join(''); }
  for (var m = 0; m < 32; m++) {
    var use = [];
    for (var b = 0; b < 5; b++) if (m & (1 << b)) use.push(b);
    var w = fit(use);
    FITS[keyOf(use)] = { w: w, seen: miss(w, SEEN), fresh: miss(w, FRESH) };
  }
  function result(use) { return FITS[keyOf(use)]; }

  function remembered() {
    try { var v = JSON.parse(sessionStorage.getItem(STORE)); return Array.isArray(v) ? v.filter(function (x) { return x >= 0 && x < 5; }) : null; } catch (e) { return null; }
  }
  function remember(ticks) { try { sessionStorage.setItem(STORE, JSON.stringify(ticks)); } catch (e) {} }

  /* what `from page import seen, fresh, names, my_ticks` gives the Python on the same page (see ink/py.js) */
  window.InkPage = window.InkPage || {};
  window.InkPage.seen = function () { return SEEN; };
  window.InkPage.fresh = function () { return FRESH; };
  window.InkPage.names = function () { return NAMES; };
  window.InkPage.my_ticks = function () { return (remembered() || [0, 1, 2, 3, 4]).slice().sort(); };

  function hatchD(x0, y0, x1, y1, gap) {
    // clean 40-degree hairlines inside a box, so a growing bar never re-wobbles
    var d = '', t = Math.tan(40 * Math.PI / 180), h = y1 - y0;
    for (var c = x0 - h / t; c < x1; c += gap) {
      var xa = c, ya = y1, xb = c + h / t, yb = y0;
      if (xa < x0) { ya = y1 - (x0 - xa) * t; xa = x0; }
      if (xb > x1) { yb = y0 + (xb - x1) * t; xb = x1; }
      if (xb > xa) d += 'M' + xa.toFixed(1) + ' ' + ya.toFixed(1) + ' L' + xb.toFixed(1) + ' ' + yb.toFixed(1) + ' ';
    }
    return d;
  }

  window.InkKit.define('keep-noise', {
    label: 'Sixteen plants, real height against the guess. Tick measurements on and off and watch the miss on seen and fresh plants',
    steps: 2,
    seed: 31,
    draw: function (k) {
      var sx = k.scale(LO, HI, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(LO, HI, PLOT.y + PLOT.h, PLOT.y);
      var ticks = [0, 1, 2, 3, 4], kept = [], busy = false, shown = null, cancel = null;

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'real height', ylabel: 'guess',
        xticks: [10, 20, 30, 40].map(function (v) { return [sx(v), String(v)]; }),
        yticks: [10, 20, 30, 40].map(function (v) { return [sy(v), String(v)]; }) });
      var diag = k.root.group({ d: 300 });
      diag.line(sx(LO + 1), sy(LO + 1), sx(HI - 1), sy(HI - 1), { w: 0.9, op: 0.6, rough: 0.4 });
      diag.text(sx(39) - 10, sy(40) - 4, 'guessed right', { kind: 'hand', anchor: 'end' });

      /* the misses: one clean path of threads, redrawn as the marks glide */
      var threadLayer = k.root.layer();
      var thread = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      thread.setAttribute('fill', 'none'); thread.setAttribute('stroke', 'currentColor');
      thread.setAttribute('stroke-width', '0.9'); thread.setAttribute('stroke-dasharray', '2.5 3');
      thread.setAttribute('opacity', '0.45');
      threadLayer.node.appendChild(thread);

      /* the plants: drawn once at the origin, moved with a transform */
      var plants = SEEN.concat(FRESH);
      var marks = k.root.group({ d: 150, stagger: 14 });
      marks.node.style.pointerEvents = 'none';
      var nodes = plants.map(function (p, i) {
        var g = marks.group({ d: 150 + i * 14 });
        g.mark(0, 0, i < 8 ? 'o' : '+', { r: 4 });
        return g.node;
      });
      function place(guesses) {
        var d = '';
        guesses.forEach(function (gv, i) {
          var real = plants[i][5], x = sx(real), y = sy(Math.max(LO, Math.min(HI, gv)));
          nodes[i].setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
          d += 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + ' L' + x.toFixed(1) + ' ' + sy(real).toFixed(1) + ' ';
        });
        thread.setAttribute('d', d);
      }
      function guessesFor(use) { var w = result(use).w; return plants.map(function (p) { return guess(w, p); }); }
      function glide(use, ms, done) {
        var to = guessesFor(use), from = shown || to.map(function () { return AVG[5]; });
        if (cancel) cancel();
        cancel = k.animate(ms, function (t) {
          shown = from.map(function (f, i) { return f + (to[i] - f) * t; });
          place(shown);
          if (t >= 1 && done) done();
        });
      }

      /* ---- the column beside the plot ---- */
      var side = k.root.group({ d: 250 });
      side.text(SIDE, 52, 'measurements used', { kind: 'label' });
      var rows = LONG.map(function (name, j) {
        var y = 76 + j * 22;
        side.rect(SIDE, y - 9, 11, 11, { w: 0.9, rough: 0.4 });
        var tick = side.group({ d: 0 });
        tick.line(SIDE + 2, y - 3, SIDE + 5, y + 0.5, { w: 1.4, rough: 0.3 });
        tick.line(SIDE + 5, y + 0.5, SIDE + 11, y - 9, { w: 1.4, rough: 0.3 });
        var label = side.text(SIDE + 20, y, name, { kind: 'axis' });
        var hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        hit.setAttribute('x', SIDE - 4); hit.setAttribute('y', y - 14); hit.setAttribute('width', 166); hit.setAttribute('height', 20);
        hit.setAttribute('class', 'ik-hit'); hit.setAttribute('tabindex', '0'); hit.setAttribute('role', 'checkbox');
        hit.setAttribute('aria-label', name); hit.style.cursor = 'pointer';
        side.node.appendChild(hit);
        function toggle() {
          if (busy || k.step() !== 0) return;
          var at = ticks.indexOf(j);
          if (at >= 0) ticks.splice(at, 1); else ticks.push(j);
          ticks.sort(); remember(ticks); showTicks(); readout(); glide(ticks, 520);
        }
        hit.addEventListener('click', toggle);
        hit.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
        return { tick: tick.node, label: label, hit: hit };
      });
      function showTicks(trying) {
        rows.forEach(function (r, j) {
          var on = ticks.indexOf(j) >= 0;
          r.tick.style.display = on ? '' : 'none';
          r.hit.setAttribute('aria-checked', on ? 'true' : 'false');
          r.hit.style.pointerEvents = k.step() === 0 ? 'auto' : 'none';
          r.label.style.fontWeight = trying === j ? '600' : '';
        });
      }
      side.line(SIDE, 190, SIDE + 158, 190, { w: 0.6, op: 0.45, rough: 0.3 });

      /* two readouts, each with a bar: the fresh one is the accent */
      side.text(SIDE, 212, 'miss, seen  o', { kind: 'label' });
      var vSeen = side.text(SIDE + 158, 212, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 250, 'miss, fresh  +', { kind: 'label' });
      var vFresh = side.text(SIDE + 158, 250, '', { kind: 'val', anchor: 'end' });
      var bars = k.root.layer();
      var barNow = { seen: 0, fresh: 0 }, barCancel = null;
      function drawBars(a, b) {
        bars.clear();
        [[a, 220, false], [b, 258, k.step() === 0]].forEach(function (s) {
          var wpx = Math.max(1, Math.min(158, s[0] / 600 * 158)), y0 = s[1], y1 = s[1] + 9;
          bars.path('M' + SIDE + ' ' + y0 + ' H' + (SIDE + wpx).toFixed(1) + ' V' + y1 + ' H' + SIDE + ' Z', { w: s[2] ? 1.4 : 0.9, accent: s[2], op: 0.9 });
          bars.path(hatchD(SIDE, y0, SIDE + wpx, y1, 4), { w: 0.6, op: 0.45, accent: s[2] });
        });
      }
      function readout() {
        var r = result(ticks);
        vSeen.set(r.seen.toFixed(1)); vFresh.set(r.fresh.toFixed(1));
        var from = { seen: barNow.seen, fresh: barNow.fresh };
        if (barCancel) barCancel();
        barCancel = k.animate(420, function (t) {
          barNow.seen = from.seen + (r.seen - from.seen) * t; barNow.fresh = from.fresh + (r.fresh - from.fresh) * t;
          drawBars(barNow.seen, barNow.fresh);
        });
      }

      /* ---- step 0 ---- */
      var g0 = k.root.group({ steps: [0], d: 600 });
      g0.callout('a', 'tick and untick', SIDE, 300);
      g0.text(SIDE, 336, 'which four can', { kind: 'hand' });
      g0.text(SIDE, 358, 'only be luck?', { kind: 'hand' });

      /* ---- step 1: one at a time ---- */
      var chart = k.root.layer({ steps: [1] });
      var note = k.root.group({ steps: [1], d: 300 }).text(SIDE, 344, '', { kind: 'axis' });
      var tries = [], toBeat = 0, round = 0, finished = false;
      function drawChart() {
        chart.clear();
        var y0 = 366, y1 = 420, top = Math.max(toBeat * 1.15, 1);
        tries.forEach(function (t) { top = Math.max(top, Math.min(t[1], 700)); });
        var sv = function (v) { return y1 - (y1 - y0) * Math.min(v, top) / top; };
        chart.line(SIDE, y1, SIDE + 158, y1, { w: 0.8, rough: 0.3 });
        NAMES.forEach(function (n, j) { chart.text(SIDE + 16 + j * 32, y1 + 13, n, { kind: 'axis', anchor: 'middle' }); });
        tries.forEach(function (t) {
          var x = SIDE + 16 + t[0] * 32, y = sv(t[1]);
          chart.path('M' + (x - 9) + ' ' + y1 + ' V' + y.toFixed(1) + ' H' + (x + 9) + ' V' + y1, { w: 0.9, op: 0.9 });
          chart.path(hatchD(x - 9, y, x + 9, y1, 4), { w: 0.6, op: 0.45 });
        });
        if (tries.length || round) {
          chart.path('M' + SIDE + ' ' + sv(toBeat).toFixed(1) + ' H' + (SIDE + 158), { w: 1.4, accent: true, op: 0.95 });
        }
      }
      function enter1() {
        if (cancel) cancel();
        kept = []; ticks = []; tries = []; round = 0; finished = false; busy = false;
        toBeat = result([]).fresh;
        showTicks(); readout(); glide([], 0); drawChart();
        note.set('nothing kept: miss ' + toBeat.toFixed(1));
        bRound.set('try round 1');
      }
      function runRound() {
        if (busy || finished) return;
        busy = true; round++; tries = [];
        var left = [0, 1, 2, 3, 4].filter(function (j) { return kept.indexOf(j) < 0; });
        var choice = -1, best = toBeat, i = 0;
        (function next() {
          if (k.step() !== 1) { busy = false; return; }
          if (i >= left.length) {
            if (choice >= 0) { kept.push(choice); kept.sort(); toBeat = best; }
            ticks = kept.slice(); showTicks(); readout(); glide(ticks, 500);
            note.set(choice >= 0 ? 'keep ' + NAMES[choice] + ': miss ' + best.toFixed(1) : 'nothing beats ' + toBeat.toFixed(1) + ': stop');
            if (choice < 0 || kept.length === 5) { finished = true; bRound.set('finished'); } else bRound.set('try round ' + (round + 1));
            drawChart(); busy = false;
            return;
          }
          var j = left[i++], use = kept.concat([j]).sort(), score = result(use).fresh;
          ticks = use; showTicks(j); readout();
          note.set('round ' + round + ': trying ' + NAMES[j]);
          glide(use, k.reduced ? 0 : 420, function () {
            tries.push([j, score]); drawChart();
            if (score < best) { best = score; choice = j; }
            setTimeout(next, k.reduced ? 0 : 320);
          });
        })();
      }
      var bRound = k.button(SIDE, 296, 'try round 1', runRound, { steps: [1] });
      k.button(SIDE, 322, 'start over', function () { if (!busy) enter1(); }, { steps: [1] });

      k.onStep(function (step) {
        busy = false;
        if (step === 0) {
          ticks = remembered() || [0, 1, 2, 3, 4]; ticks.sort();
          showTicks(); readout(); glide(ticks, shown ? 520 : 0);
        } else enter1();
      });
    }
  });
})();
