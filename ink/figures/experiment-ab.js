/* Experiment A/B — two versions of a sign-up button, each with a hidden chance of being clicked.
   Steps: 0 show each version to visitors yourself (click its sheet, or the buttons), one at a time or
          ten at a time, and watch the tallies
          and who is ahead (a small chart of the lead, as you go)
          1 run the whole test again and again at one size, and see where each test's lead lands
   Every visitor's answer is fixed in advance by a seeded stream per version (the n-th visitor shown A always
   answers the same way), so what you see is real counting, not posed. Made-up rates: A 20%, B 30%.
   Offers what you saw to the page's Python: `from page import tally_a, tally_b` (lists of 1 = clicked, 0 = not).
   Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var RATES = [0.20, 0.30], NAMES = ['A', 'B'], MAX = 200;
  var SIDE = 462, RIGHT = 620;
  var COLS = 10, GAP = 16, GX = [64, 264], GY = 76;          // the two sheets of visitors
  var SIZES = [10, 20, 50, 100, 200], SIZE_START = 1, MAX_TESTS = 100;

  function streams(rand) {
    var out = [];
    for (var a = 0; a < 2; a++) { var s = []; for (var i = 0; i < MAX; i++) s.push(rand() < RATES[a] ? 1 : 0); out.push(s); }
    return out;
  }
  var STREAMS = streams(window.InkKit.rng(153));
  var shown = [0, 0];                                         // how many visitors each version has been shown

  /* what `from page import tally_a, tally_b` gives the Python on this page (see ink/py.js).
     Before you have shown both versions to anyone, it gives the first twenty of each. */
  window.InkPage = window.InkPage || {};
  function seen(a) { var n = shown[0] && shown[1] ? shown[a] : 20; return STREAMS[a].slice(0, n); }
  window.InkPage.tally_a = function () { return seen(0); };
  window.InkPage.tally_b = function () { return seen(1); };

  function sum(v, n) { var s = 0; for (var i = 0; i < n; i++) s += v[i]; return s; }
  function pct(w, n) { return n ? Math.round(100 * w / n) : 0; }
  function at(a, i) { return [GX[a] + 8 + (i % COLS) * GAP, GY + Math.floor(i / COLS) * GAP]; }

  window.InkKit.define('experiment-ab', {
    label: 'An A/B test by hand: show two versions to visitors, count who clicks, and see how often a small test points at the wrong one',
    steps: 2,
    seed: 11,
    draw: function (k) {
      /* ================= step 0: one visitor at a time ================= */
      var sheet = k.root.group({ steps: [0], d: 100 });
      [0, 1].forEach(function (a) {
        sheet.rect(GX[a] - 4, GY - 12, COLS * GAP + 8, 20 * GAP + 6, { w: 0.6, op: 0.4, rough: 0.4 });
        sheet.text(GX[a] + COLS * GAP / 2, GY - 24, 'version ' + NAMES[a], { kind: 'label', anchor: 'middle' });
      });
      sheet.mark(GX[0] + 8, 420, 'o', { r: 4.2 });
      sheet.text(GX[0] + 20, 424, 'clicked', { kind: 'axis' });
      sheet.dot(GX[0] + 98, 420, 1.5, { op: 0.6 });
      sheet.text(GX[0] + 108, 424, 'did not', { kind: 'axis' });

      var crowd = [k.root.layer({ steps: [0] }), k.root.layer({ steps: [0] })];
      var ringLayer = k.root.layer({ steps: [0] });
      var ring = ringLayer.path('M-7.5 0 a7.5 7.5 0 1 0 15 0 a7.5 7.5 0 1 0 -15 0', { accent: true, w: 1.6, op: 0.95 });
      ring.style.display = 'none';

      var s0 = k.root.group({ steps: [0], d: 250 });
      function readout(g, y, label) {
        g.text(SIDE, y, label, { kind: 'label' });
        return g.text(RIGHT, y, '', { kind: 'val', anchor: 'end' });
      }
      var vA = readout(s0, 60, 'A'), vB = readout(s0, 80, 'B'), vLead = readout(s0, 100, 'ahead');
      s0.line(SIDE, 112, RIGHT, 112, { w: 0.6, op: 0.45, rough: 0.3 });

      /* the lead, as you go: B's share minus A's share, in points, against visitors each */
      var CH = { x0: SIDE + 6, x1: SIDE + 156, y0: 300, y1: 396 };
      var chartFrame = k.root.group({ steps: [0], d: 500 });
      chartFrame.text(SIDE, CH.y0 - 14, 'b minus a, so far', { kind: 'label' });
      chartFrame.line(CH.x0, CH.y0, CH.x0, CH.y1, { w: 0.8, rough: 0.3 });
      chartFrame.path('M' + CH.x0 + ' ' + (CH.y0 + CH.y1) / 2 + ' L' + CH.x1 + ' ' + (CH.y0 + CH.y1) / 2, { w: 0.6, op: 0.5 });
      chartFrame.text(CH.x0 - 4, CH.y0 + 4, '+30', { kind: 'axis', anchor: 'end' });
      chartFrame.text(CH.x0 - 4, CH.y1 + 4, '-30', { kind: 'axis', anchor: 'end' });
      chartFrame.text(CH.x1, CH.y1 + 16, MAX + ' each', { kind: 'axis', anchor: 'end' });
      var chart = k.root.layer({ steps: [0] });
      var history = [];
      function drawChart() {
        chart.clear();
        var pts = history.filter(function (h) { return h[0] >= 5; });   // one or two visitors each say nothing yet
        if (pts.length < 2) return;
        var line = pts.map(function (h) {
          var y = Math.max(-30, Math.min(30, h[1]));
          return [CH.x0 + (CH.x1 - CH.x0) * h[0] / MAX, (CH.y0 + CH.y1) / 2 - y / 30 * (CH.y1 - CH.y0) / 2];
        });
        chart.polyline(line, { w: 1.2 });
      }

      function lead() {
        var wa = sum(STREAMS[0], shown[0]), wb = sum(STREAMS[1], shown[1]);
        return 100 * wb / shown[1] - 100 * wa / shown[0];
      }
      function readout0() {
        var wa = sum(STREAMS[0], shown[0]), wb = sum(STREAMS[1], shown[1]);
        vA.set(wa + ' / ' + shown[0] + ' · ' + pct(wa, shown[0]) + '%');
        vB.set(wb + ' / ' + shown[1] + ' · ' + pct(wb, shown[1]) + '%');
        if (!shown[0] || !shown[1]) { vLead.set('–'); return; }
        var d = Math.round(lead());
        vLead.set(d === 0 ? 'level' : (d > 0 ? 'B' : 'A') + ' by ' + Math.abs(d) + ' pts');
      }
      function addVisitor(a) {
        if (shown[a] >= MAX) return false;
        var i = shown[a], p = at(a, i);
        if (STREAMS[a][i]) crowd[a].mark(p[0], p[1], 'o', { r: 4.2, d: 0, dur: 220 });
        else crowd[a].dot(p[0], p[1], 1.5, { op: 0.6, d: 0 });
        shown[a]++;
        ring.style.display = '';
        ring.setAttribute('transform', 'translate(' + p[0] + ' ' + p[1] + ')');
        return true;
      }
      function note() {
        if (shown[0] && shown[1]) {          // the chart keeps one point per "visitors each", the latest
          var n = Math.min(shown[0], shown[1]), last = history[history.length - 1];
          if (last && last[0] === n) history[history.length - 1] = [n, lead()];
          else history.push([n, lead()]);
        }
        readout0(); drawChart(); prompts();
      }
      var bA = k.button(SIDE, 146, 'show A to one more', function () { if (addVisitor(0)) note(); }, { steps: [0], d: 400 });
      var bB = k.button(SIDE, 178, 'show B to one more', function () { if (addVisitor(1)) note(); }, { steps: [0], d: 450 });
      var busy = false;
      var bTen = k.button(SIDE, 210, '10 more of each', function () {
        if (busy) return;
        var target = [Math.min(MAX, shown[0] + 10), Math.min(MAX, shown[1] + 10)], from = shown.slice();
        if (target[0] === from[0] && target[1] === from[1]) return;
        busy = true;
        // the twenty visitors arrive one after another, A and B taking turns
        var order = [];
        for (var j = 0; j < 10; j++) { if (from[0] + j < target[0]) order.push(0); if (from[1] + j < target[1]) order.push(1); }
        var done = 0;
        k.animate(700, function (t) {
          var due = Math.round(t * order.length);
          while (done < due) { addVisitor(order[done]); done++; if (shown[0] === shown[1]) note(); }
          readout0();
          if (t >= 1) { busy = false; note(); }
        });
      }, { steps: [0], d: 500 });
      var bReset = k.button(SIDE, 242, 'start over', function () {
        if (busy) return;
        shown = [0, 0]; history = [[0, 0]];
        crowd[0].clear(); crowd[1].clear(); ring.style.display = 'none';
        readout0(); drawChart(); prompts();
      }, { steps: [0], d: 550 });
      // click a version's sheet to show it to one more visitor: the same as its button
      var sheetHits = k.root.group({ steps: [0] });
      [0, 1].forEach(function (a) {
        var hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        hit.setAttribute('x', GX[a] - 4); hit.setAttribute('y', GY - 12);
        hit.setAttribute('width', COLS * GAP + 8); hit.setAttribute('height', 20 * GAP + 6);
        hit.setAttribute('class', 'ik-hit');
        hit.setAttribute('tabindex', 0); hit.setAttribute('role', 'button');
        hit.setAttribute('aria-label', 'Show version ' + NAMES[a] + ' to one more visitor');
        hit.style.cursor = 'pointer';
        function one() { if (!busy && addVisitor(a)) note(); }
        hit.addEventListener('click', one);
        hit.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); one(); } });
        sheetHits.node.appendChild(hit);
      });
      function prompts() {
        bA.node.style.display = shown[0] < MAX ? '' : 'none';
        bB.node.style.display = shown[1] < MAX ? '' : 'none';
        bTen.node.style.display = shown[0] < MAX || shown[1] < MAX ? '' : 'none';
        bReset.node.style.display = shown[0] || shown[1] ? '' : 'none';
      }

      /* ================= step 1: the same test, again and again ================= */
      var NL = { x0: 54, x1: 426, y: 340, lo: -40, hi: 40, bin: 2.5 };
      function nx(v) { return NL.x0 + (Math.max(NL.lo, Math.min(NL.hi, v)) - NL.lo) / (NL.hi - NL.lo) * (NL.x1 - NL.x0); }
      var g1 = k.root.group({ steps: [1], d: 100 });
      g1.line(NL.x0, NL.y, NL.x1, NL.y, { w: 1.1 });
      [-40, -20, 0, 20, 40].forEach(function (v) {
        g1.line(nx(v), NL.y, nx(v), NL.y + 4, { w: 0.6, op: 0.6, rough: 0.2 });
        g1.text(nx(v), NL.y + 17, (v > 0 ? '+' : '') + v, { kind: 'axis', anchor: 'middle' });
      });
      g1.text(NL.x1, NL.y + 36, 'b’s share minus a’s, in points', { kind: 'label', anchor: 'end' });
      g1.thread([[nx(0), NL.y], [nx(0), 66]], { w: 0.9 });
      g1.text(nx(0) - 10, 60, 'a looks better', { kind: 'label', anchor: 'end' });
      g1.text(nx(0) + 10, 60, 'b looks better', { kind: 'label' });
      g1.path('M' + nx(10) + ' ' + (NL.y + 22) + ' L' + nx(10) + ' ' + (NL.y + 6), { w: 1.1, op: 0.8 });
      g1.text(nx(10) + 6, NL.y + 50, 'true gap +10', { kind: 'axis', anchor: 'middle' });

      var dots = k.root.layer({ steps: [1] });
      var newest = k.root.layer({ steps: [1] });
      var tests = [], sizeIx = SIZE_START, stacks = {};
      var s1 = k.root.group({ steps: [1], d: 250 });
      var vRun = readout(s1, 60, 'tests run'), vWrong = readout(s1, 80, 'a ahead'), vTie = readout(s1, 100, 'dead level');
      s1.line(SIDE, 112, RIGHT, 112, { w: 0.6, op: 0.45, rough: 0.3 });
      s1.mark(SIDE + 4, 300, 'o', { r: 3.4 }); s1.text(SIDE + 16, 304, 'b came out ahead', { kind: 'axis' });
      s1.mark(SIDE + 4, 320, 'x', { r: 3.4 }); s1.text(SIDE + 16, 324, 'a came out ahead', { kind: 'axis' });
      s1.mark(SIDE + 4, 340, 'sq', { r: 3 }); s1.text(SIDE + 16, 344, 'exactly level', { kind: 'axis' });

      function oneTest(j, n) {
        var r = k.rng(5000 + j * 7919 + n * 31), wa = 0, wb = 0;
        for (var i = 0; i < n; i++) { if (r() < RATES[0]) wa++; if (r() < RATES[1]) wb++; }
        return 100 * (wb - wa) / n;
      }
      function drop(gap) {
        var key = Math.round(gap / NL.bin), h = stacks[key] = (stacks[key] || 0) + 1;
        var x = nx(key * NL.bin), y = NL.y - 9 - (h - 1) * 7.2;
        dots.mark(x, y, gap > 1e-9 ? 'o' : gap < -1e-9 ? 'x' : 'sq', { r: gap === 0 ? 2.6 : 3, d: 0, dur: 180 });
        newest.clear();
        newest.path('M' + (x - 7) + ' ' + y + ' a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0', { accent: true, w: 1.5, op: 0.95 });
        tests.push(gap);
      }
      function readout1() {
        var wrong = tests.filter(function (g) { return g < -1e-9; }).length, tie = tests.filter(function (g) { return Math.abs(g) <= 1e-9; }).length;
        vRun.set(tests.length + ' of ' + MAX_TESTS);
        vWrong.set(tests.length ? wrong + ' of ' + tests.length : '–');
        vTie.set(tests.length ? tie + ' of ' + tests.length : '–');
        bOne.node.style.display = bMany.node.style.display = tests.length < MAX_TESTS ? '' : 'none';
      }
      function clear1() { tests = []; stacks = {}; dots.clear(); newest.clear(); readout1(); }
      k.slider({
        x: SIDE, y: 152, w: 158, min: 0, max: SIZES.length - 1, step: 1, value: SIZE_START, label: 'visitors each', steps: [1],
        format: function (v) { return String(SIZES[v]); },
        onChange: function (v) { if (busy) return; sizeIx = v; clear1(); }
      });
      var bOne = k.button(SIDE, 194, 'run the test again', function () {
        if (busy || tests.length >= MAX_TESTS) return;
        drop(oneTest(tests.length, SIZES[sizeIx])); readout1();
      }, { steps: [1], d: 400 });
      var bMany = k.button(SIDE, 226, 'run it 20 times', function () {
        if (busy || tests.length >= MAX_TESTS) return;
        var start = tests.length, todo = Math.min(20, MAX_TESTS - start), done = 0;
        busy = true;
        k.animate(1600, function (t) {
          var due = Math.round(t * todo);
          while (done < due) { drop(oneTest(start + done, SIZES[sizeIx])); done++; }
          readout1();
          if (t >= 1) busy = false;
        });
      }, { steps: [1], d: 450 });
      k.root.group({ steps: [1], d: 600 }).callout('b', 'one mark, one test', SIDE, 268);

      k.onStep(function (step) {
        busy = false;
        if (step === 0) {
          if (!history.length) history = [[0, 0]];
          readout0(); drawChart(); prompts();
          ring.style.display = shown[0] || shown[1] ? '' : 'none';
        } else {
          readout1();
        }
      });
    }
  });
})();
