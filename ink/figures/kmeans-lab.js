/* K-means lab — the reader does the algorithm by hand before it is named.
   Steps: 0 put three flags on unlabelled points, then see whose flag each point is under
          1 move each flag to the middle of its points, give the points out again, repeat (animated)
          2 throw the flags somewhere else and watch where the same loop ends
   The flags placed in step 0 are remembered (sessionStorage) and step 1 starts from them.
   The dots can be dragged too: in step 0 once they have been given out (not while placing, where moving
   the dots to the flags would be cheating), and in step 1 between moves. A dragged dot goes to its nearest
   flag at once; in step 1 the loop then starts again from where the flags stand. The figure drags its own
   copy of the dots: what the page's Python gets never changes, and a reload puts them back.
   Everything is computed: assignment by squared distance, flags moved to means, totals summed.
   Made-up points, fixed seed. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 }, SIDE = 462, DOM = 10, K = 3;
  var SHAPES = ['o', '+', 'x'];
  var STORE = 'ink-kmeans-flags';
  var ORDER = [0, 5, 1, 2, 10, 3, 6, 4, 7, 8, 9, 11];   // the order the twelve seeded starts are thrown in

  function r2(v) { return Math.round(v * 100) / 100; }
  function makePoints(rand) {
    function g() { return rand() + rand() + rand() - 1.5; }
    var pts = [];
    [[2.4, 7.3, 12, 1.5], [3.6, 2.6, 12, 1.6], [7.6, 4.6, 14, 1.9]].forEach(function (c) {
      for (var i = 0; i < c[2]; i++) {
        pts.push([r2(Math.min(9.6, Math.max(0.4, c[0] + g() * c[3]))), r2(Math.min(9.6, Math.max(0.4, c[1] + g() * c[3])))]);
      }
    });
    return pts;
  }
  // the points are made once, to two decimals, so the page's Python can work on exactly the same ones
  var POINTS = makePoints(window.InkKit.rng(17));
  var DEFAULT = [[1.6, 2.0], [5.2, 8.6], [8.8, 8.2]];
  function assign(pts, flags) {
    return pts.map(function (p) {
      var best = 0, bd = Infinity;
      flags.forEach(function (f, j) { var d = (p[0] - f[0]) * (p[0] - f[0]) + (p[1] - f[1]) * (p[1] - f[1]); if (d < bd) { bd = d; best = j; } });
      return best;
    });
  }
  function means(pts, labels, flags) {
    return flags.map(function (f, j) {
      var x = 0, y = 0, n = 0;
      pts.forEach(function (p, i) { if (labels[i] === j) { x += p[0]; y += p[1]; n++; } });
      return n ? [x / n, y / n] : f.slice();          // a flag nobody is under stays where it is
    });
  }
  function total(pts, labels, flags) {
    return pts.reduce(function (s, p, i) { var f = flags[labels[i]]; return s + (p[0] - f[0]) * (p[0] - f[0]) + (p[1] - f[1]) * (p[1] - f[1]); }, 0);
  }
  function remembered() {
    try { var v = JSON.parse(sessionStorage.getItem(STORE)); return Array.isArray(v) && v.length === K ? v : null; } catch (e) { return null; }
  }
  function remember(flags) {
    try { sessionStorage.setItem(STORE, JSON.stringify(flags)); } catch (e) {}
    // tell the other figures on the page: the one that moves the flags starts from these
    try { window.dispatchEvent(new CustomEvent('ink:kmeans-flags')); } catch (e) {}
  }

  /* what `from page import points, my_flags` gives the Python on the same page (see ink/py.js) */
  window.InkPage = window.InkPage || {};
  window.InkPage.points = function () { return POINTS; };
  window.InkPage.my_flags = function () { return remembered() || DEFAULT; };

  window.InkKit.define('kmeans-lab', {
    label: 'K-means by hand: place three flags, give each point to its nearest flag, move the flags, repeat',
    steps: 3,
    seed: 17,
    draw: function (k) {
      var sx = k.scale(0, DOM, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(0, DOM, PLOT.y + PLOT.h, PLOT.y);
      // the figure's own copy of the dots, which the reader may drag; POINTS itself is never touched
      var pts = POINTS.map(function (p) { return p.slice(); });
      var starts = (function () {
        var r = k.rng(120), out = [];
        for (var s = 0; s < 12; s++) out.push([0, 1, 2].map(function () { return POINTS[Math.floor(r() * POINTS.length)].slice(); }));
        return out;
      })();
      var flags = [], labels = null, round = 0, history = [], busy = false, running = false, thrown = 0, ends = [];

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h });

      /* ---- threads: one stitched path, redrawn as things move ---- */
      var threadLayer = k.root.layer();
      var thread = null;
      function drawThreads(grow) {
        if (!thread) {
          thread = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          thread.setAttribute('fill', 'none'); thread.setAttribute('stroke', 'currentColor');
          thread.setAttribute('stroke-width', '1'); thread.setAttribute('stroke-linecap', 'round');
          thread.setAttribute('stroke-dasharray', '3.5 4'); thread.setAttribute('opacity', '0.4');
          threadLayer.node.appendChild(thread);
        }
        if (!labels || flags.length < K) { thread.setAttribute('d', ''); return; }
        var t = grow == null ? 1 : grow, d = '';
        pts.forEach(function (p, i) {
          var f = flags[labels[i]], x0 = sx(p[0]), y0 = sy(p[1]);
          d += 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' L' + (x0 + (sx(f[0]) - x0) * t).toFixed(1) + ' ' + (y0 + (sy(f[1]) - y0) * t).toFixed(1) + ' ';
        });
        thread.setAttribute('d', d);
      }

      /* ---- the points: each drawn once in every shape, so changing owner never redraws ink ---- */
      var marks = k.root.group({ d: 150, stagger: 12 });
      var shapes = pts.map(function (p) {
        return SHAPES.map(function (s) { return marks.mark(sx(p[0]), sy(p[1]), s, { r: 3.6 }); });
      });
      marks.node.style.pointerEvents = 'none';
      function showShapes() {
        shapes.forEach(function (set, i) {
          var which = labels ? labels[i] : 0;
          set.forEach(function (node, j) { node.style.display = j === which ? '' : 'none'; });
        });
      }

      /* ---- the flags: the one accent. Drawn at the origin and moved, so they never re-wobble ---- */
      var flagGroup = k.root.group({ d: 0, stagger: 0 });
      var flagNodes = [0, 1, 2].map(function (j) {
        var g = flagGroup.group({ d: 0 });
        g.circle(0, 0, 8, { accent: true, w: 1.6, op: 0.95, dur: 260 });
        g.dot(0, 0, 2.2, { accent: true });
        var grab = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        grab.setAttribute('r', 15); grab.setAttribute('class', 'ik-hit');
        g.node.appendChild(grab);
        g.node.style.display = 'none';
        k.draggable(g.node, {
          label: 'Flag ' + (j + 1) + '. Arrow keys move it.',
          bounds: { x0: PLOT.x + 6, y0: PLOT.y + 6, x1: PLOT.x + PLOT.w - 6, y1: PLOT.y + PLOT.h - 6 },
          onMove: function (x, y) {
            if (busy || k.step() !== 0 || flags.length < K) return;
            flags[j] = [r2((x - PLOT.x) / PLOT.w * DOM), r2((PLOT.y + PLOT.h - y) / PLOT.h * DOM)];
            if (labels) { labels = assign(pts, flags); showShapes(); }
            placeFlags(); drawThreads(); readout(); remember(flags);
          }
        });
        return g.node;
      });
      function placeFlags() {
        flagNodes.forEach(function (node, j) {
          if (j < flags.length) {
            node.style.display = '';
            node.setAttribute('transform', 'translate(' + sx(flags[j][0]).toFixed(1) + ' ' + sy(flags[j][1]).toFixed(1) + ')');
          } else node.style.display = 'none';
        });
      }

      /* ---- dragging a dot: one catcher under the flags (so a flag always wins the press), nearest dot in reach ---- */
      var REACH = 12, held = -1, queued = false, at = null;
      var phit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      phit.setAttribute('x', PLOT.x); phit.setAttribute('y', PLOT.y); phit.setAttribute('width', PLOT.w); phit.setAttribute('height', PLOT.h);
      phit.setAttribute('class', 'ik-hit');
      phit.style.touchAction = 'none'; phit.style.pointerEvents = 'none';
      k.root.node.insertBefore(phit, flagGroup.node);
      function dotsOpen() { return (k.step() === 0 && !!labels && flags.length === K) || k.step() === 1; }
      function canDrag() { return !busy && !running && dotsOpen(); }
      function dragOn() { phit.style.pointerEvents = dotsOpen() ? 'auto' : 'none'; if (!dotsOpen()) phit.style.cursor = ''; }
      function nearestDot(p) {
        var best = -1, bd = REACH * REACH;
        pts.forEach(function (q, i) { var dx = sx(q[0]) - p.x, dy = sy(q[1]) - p.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } });
        return best;
      }
      function moveMarks(i) {
        var dx = sx(pts[i][0]) - sx(POINTS[i][0]), dy = sy(pts[i][1]) - sy(POINTS[i][1]);
        shapes[i].forEach(function (node) {
          if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) node.removeAttribute('transform');
          else node.setAttribute('transform', 'translate(' + dx.toFixed(1) + ' ' + dy.toFixed(1) + ')');
        });
      }
      function anyMoved() { return pts.some(function (p, i) { return p[0] !== POINTS[i][0] || p[1] !== POINTS[i][1]; }); }
      // in step 1 a moved dot means the flags are no longer in the middle: the loop starts again from here
      function restartRun() {
        round = 0; settled = false; nextIsMove = true;
        history = [total(pts, labels, flags)];
        drawChart(); label1();
      }
      function applyDrag() {
        queued = false;
        if (held < 0 || !at) return;
        var x = Math.min(PLOT.x + PLOT.w - 6, Math.max(PLOT.x + 6, at.x)), y = Math.min(PLOT.y + PLOT.h - 6, Math.max(PLOT.y + 6, at.y));
        pts[held] = [r2((x - PLOT.x) / PLOT.w * DOM), r2((PLOT.y + PLOT.h - y) / PLOT.h * DOM)];
        moveMarks(held);
        labels[held] = assign([pts[held]], flags)[0];           // a dot belongs to its nearest flag
        showShapes(); drawThreads();
        if (k.step() === 1) restartRun();
        readout(); showMoved();
      }
      phit.addEventListener('pointerdown', function (e) {
        if (e.button || !canDrag()) return;
        var i = nearestDot(k.toFigure(e));
        if (i < 0) return;
        e.preventDefault();
        try { phit.setPointerCapture(e.pointerId); } catch (err) {}
        held = i; at = null; phit.style.cursor = 'grabbing';
      });
      phit.addEventListener('pointermove', function (e) {
        var p = k.toFigure(e);
        if (held < 0) { phit.style.cursor = canDrag() && nearestDot(p) >= 0 ? 'grab' : ''; return; }
        at = p;
        if (!queued) { queued = true; requestAnimationFrame(applyDrag); }
      });
      function letGo() { if (held < 0) return; if (queued) applyDrag(); held = -1; phit.style.cursor = 'grab'; }
      phit.addEventListener('pointerup', letGo);
      phit.addEventListener('pointercancel', letGo);
      // put the dots back where they started (quiet: the caller redraws what depends on them)
      function putBack() {
        held = -1;
        pts.forEach(function (p, i) { p[0] = POINTS[i][0]; p[1] = POINTS[i][1]; moveMarks(i); });
        showMoved();
      }

      /* ---- the column beside the plot ---- */
      var side = k.root.group({ d: 250 });
      side.text(SIDE, 60, 'flags placed', { kind: 'label' });
      var vFlags = side.text(SIDE + 158, 60, '0 of 3', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 80, 'total distance', { kind: 'label' });
      var vTotal = side.text(SIDE + 158, 80, '–', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 100, 'round', { kind: 'label' });
      var vRound = side.text(SIDE + 158, 100, '–', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 112, SIDE + 158, 112, { w: 0.6, op: 0.45, rough: 0.3 });

      function readout() {
        vFlags.set(flags.length + ' of 3');
        vTotal.set(labels && flags.length === K ? total(pts, labels, flags).toFixed(1) : '–');
        vRound.set(labels ? String(round) : '–');
      }

      /* once a dot has moved: an honest note at the top of the column, and a way back */
      var movedNote = k.root.group({ steps: [0, 1], d: 0 });
      movedNote.text(SIDE, 26, 'dots moved: the text is', { kind: 'axis' });
      movedNote.text(SIDE, 40, 'about the original dots', { kind: 'axis' });
      function backAgain() {
        if (busy || running) return;
        putBack();
        if (k.step() === 1) { labels = assign(pts, flags); restartRun(); }
        else if (labels) labels = assign(pts, flags);
        showShapes(); drawThreads(); readout();
      }
      var bBack0 = k.button(SIDE, 190, 'put the dots back', backAgain, { steps: [0] });
      var bBack1 = k.button(SIDE, 428, 'put the dots back', backAgain, { steps: [1] });
      function showMoved() {
        var m = anyMoved();
        movedNote.node.style.display = bBack0.node.style.display = bBack1.node.style.display = m ? '' : 'none';
      }
      showMoved();

      /* a small chart of the total after every half-step, drawn as the loop runs */
      var chart = k.root.layer({ steps: [1] });
      function drawChart() {
        chart.clear();
        if (history.length < 1) return;
        var x0 = SIDE + 6, x1 = SIDE + 156, y0 = 318, y1 = 400, top = history[0] * 1.05, n = Math.max(6, history.length - 1);
        chart.line(x0, y1, x1, y1, { w: 0.8, rough: 0.3 });
        chart.line(x0, y1, x0, y0, { w: 0.8, rough: 0.3 });
        chart.text(x0, y0 - 8, 'total, step by step', { kind: 'label' });
        var line = history.map(function (v, i) { return [x0 + (x1 - x0) * i / n, y1 - (y1 - y0) * v / top]; });
        if (line.length > 1) chart.polyline(line, { w: 1.2 });
        var last = line[line.length - 1];
        chart.dot(last[0], last[1], 2.6, { accent: true });
      }

      /* ---- step 0: your flags ---- */
      var hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      hit.setAttribute('x', PLOT.x); hit.setAttribute('y', PLOT.y); hit.setAttribute('width', PLOT.w); hit.setAttribute('height', PLOT.h);
      hit.setAttribute('class', 'ik-hit'); hit.style.cursor = 'crosshair';
      k.root.node.insertBefore(hit, marks.node);
      hit.addEventListener('click', function (e) {
        if (k.step() !== 0 || flags.length >= K || busy) return;
        var p = k.toFigure(e);
        flags.push([r2((p.x - PLOT.x) / PLOT.w * DOM), r2((PLOT.y + PLOT.h - p.y) / PLOT.h * DOM)]);
        if (flags.length === K) remember(flags);
        placeFlags(); readout(); prompts();
      });

      var g0 = k.root.group({ steps: [0], d: 500 });
      var callA = g0.group({ d: 500 });
      callA.callout('a', 'click to put three flags', SIDE, 150);
      var bPlace = k.button(SIDE, 190, 'place them for me', function () {
        if (busy) return;
        flags = DEFAULT.map(function (f) { return f.slice(); }); labels = null; round = 0;
        remember(flags); placeFlags(); showShapes(); drawThreads(); readout(); prompts();
      }, { steps: [0] });
      var bWhose = k.button(SIDE, 226, 'whose flag is each under', function () {
        if (busy || flags.length < K) return;
        labels = assign(pts, flags); round = 0; showShapes(); readout();
        busy = true;
        k.animate(900, function (t) { drawThreads(t); if (t >= 1) { busy = false; prompts(); } });
      }, { steps: [0] });
      var bAgain = k.button(SIDE, 262, 'start over', function () {
        if (busy) return;
        putBack();                                   // a fresh start is on the original dots
        flags = []; labels = null; round = 0; placeFlags(); showShapes(); drawThreads(); readout(); prompts();
      }, { steps: [0] });
      var hand0 = k.root.group({ steps: [0], d: 300 });
      var h0a = hand0.text(SIDE, 316, 'now drag a flag', { kind: 'hand' });
      var h0b = hand0.text(SIDE, 338, 'and watch them switch.', { kind: 'hand' });
      function prompts() {
        var placing = flags.length < K;
        bWhose.node.style.display = placing || labels ? 'none' : '';
        bAgain.node.style.display = flags.length ? '' : 'none';
        bPlace.node.style.display = placing ? '' : 'none';
        callA.node.style.display = placing ? '' : 'none';
        h0a.style.display = h0b.style.display = labels && !placing ? '' : 'none';
        hit.style.pointerEvents = placing && k.step() === 0 ? 'auto' : 'none';
        dragOn();
      }

      /* ---- step 1: the loop ---- */
      function glide(to, ms, done) {
        var from = flags.map(function (f) { return f.slice(); });
        busy = true;
        k.animate(ms, function (t) {
          flags = from.map(function (f, j) { return [f[0] + (to[j][0] - f[0]) * t, f[1] + (to[j][1] - f[1]) * t]; });
          placeFlags(); drawThreads();
          if (t >= 1) { flags = to; busy = false; done(); }
        });
      }
      var settled = false, nextIsMove = true;
      function halfStep(ms, done) {
        if (settled) { if (done) done(); return; }
        if (nextIsMove) {
          glide(means(pts, labels, flags), ms, function () {
            nextIsMove = false; history.push(total(pts, labels, flags)); readout(); drawChart(); label1(); if (done) done();
          });
        } else {
          var next = assign(pts, flags), switched = next.filter(function (v, i) { return v !== labels[i]; }).length;
          labels = next; round++; nextIsMove = true; showShapes(); drawThreads();
          if (!switched) settled = true;
          history.push(total(pts, labels, flags)); readout(); drawChart(); label1(); if (done) done();
        }
      }
      var bStep = k.button(SIDE, 150, 'give the points out again', function () { if (!busy) halfStep(700); }, { steps: [1] });
      var bRun = k.button(SIDE, 186, 'run until nothing moves', function () {
        if (busy || running) return;
        running = true;                              // no dragging dots while the loop runs by itself
        (function loop() { if (settled || k.step() !== 1) { running = false; return; } halfStep(520, function () { if (settled) running = false; else setTimeout(loop, nextIsMove ? 260 : 60); }); })();
      }, { steps: [1] });
      var bReset1 = k.button(SIDE, 222, 'back to the start', function () { if (!busy) enter1(); }, { steps: [1] });
      var note1 = k.root.group({ steps: [1], d: 400 }).text(SIDE, 262, '', { kind: 'axis' });
      function label1() {
        bStep.set(settled ? 'nothing moves any more' : nextIsMove ? 'move the flags' : 'give the points out again');
        note1.set(settled ? 'settled after ' + round + ' rounds' : nextIsMove ? 'each flag goes to the middle' : 'each point picks its nearest');
        bRun.node.style.display = settled ? 'none' : '';
      }
      function enter1() {
        flags = (remembered() || DEFAULT).map(function (f) { return f.slice(); });
        labels = assign(pts, flags); round = 0; settled = false; nextIsMove = true;
        history = [total(pts, labels, flags)];
        placeFlags(); showShapes(); drawThreads(); readout(); drawChart(); label1();
      }

      /* ---- step 2: other starts ---- */
      var strip = k.root.layer({ steps: [2] });
      function drawStrip() {
        strip.clear();
        var x0 = SIDE + 6, x1 = SIDE + 156, y = 330;
        strip.text(SIDE, y - 44, 'where each start ended', { kind: 'label' });
        strip.line(x0, y, x1, y, { w: 0.8, rough: 0.3 });
        strip.text(x0, y + 16, '50', { kind: 'axis', anchor: 'middle' });
        strip.text(x1, y + 16, '250', { kind: 'axis', anchor: 'middle' });
        strip.text((x0 + x1) / 2, y + 16, 'total distance', { kind: 'axis', anchor: 'middle' });
        var seen = {};
        ends.forEach(function (v, i) {
          var key = Math.round(v), n = seen[key] = (seen[key] || 0) + 1;
          strip.mark(x0 + (x1 - x0) * (Math.min(250, Math.max(50, v)) - 50) / 200, y - 7 * n, 'o', { r: 2.6, accent: i === ends.length - 1 });
        });
        if (ends.length) {
          var best = Math.min.apply(null, ends), worse = ends.filter(function (v) { return v > best * 1.2; }).length;
          strip.text(SIDE, y + 44, ends.length + ' starts, ' + worse + ' ended worse', { kind: 'axis' });
        }
      }
      var bThrow = k.button(SIDE, 150, 'throw the flags again', function () {
        if (busy) return;
        flags = starts[ORDER[thrown % ORDER.length]].map(function (f) { return f.slice(); });
        thrown++; labels = assign(pts, flags); round = 0;
        placeFlags(); showShapes(); drawThreads(); readout();
        (function loop() {
          if (k.step() !== 2) return;
          glide(means(pts, labels, flags), 420, function () {
            var next = assign(pts, flags), same = next.every(function (v, i) { return v === labels[i]; });
            labels = next; round++; showShapes(); drawThreads(); readout();
            if (same) { ends.push(total(pts, labels, flags)); drawStrip(); } else setTimeout(loop, 160);
          });
        })();
      }, { steps: [2] });
      k.root.group({ steps: [2], d: 500 }).callout('c', 'same points, same rule', SIDE, 200);
      k.root.group({ steps: [1], d: 600 }).callout('b', 'the total only goes down', SIDE, 296);

      // a figure waiting at the start of the loop picks up flags the reader has just planted elsewhere
      window.addEventListener('ink:kmeans-flags', function () {
        if (k.step() === 1 && !busy && round === 0 && nextIsMove && history.length <= 1) enter1();
      });

      k.onStep(function (step) {
        busy = false; running = false;
        putBack();                                   // every step starts on the original dots
        if (step === 0) {
          flags = (remembered() || []).map(function (f) { return f.slice(); });
          labels = null; round = 0;
          placeFlags(); showShapes(); drawThreads(); readout(); prompts();
        } else if (step === 1) {
          hit.style.pointerEvents = 'none';
          enter1();
        } else {
          hit.style.pointerEvents = 'none';
          flags = starts[ORDER[0]].map(function (f) { return f.slice(); });
          labels = assign(pts, flags); round = 0; thrown = 0; ends = [];
          placeFlags(); showShapes(); drawThreads(); readout(); drawStrip();
        }
        dragOn();
      });
    }
  });
})();
