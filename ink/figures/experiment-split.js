/* Experiment split — who decides which visitor sees which version?
   200 made-up visitors: 100 in the morning, 100 at night. Morning visitors click more, whatever they are shown
   (a "morning bonus" the reader can slide). Version A truly gets 20% of clicks, B 30%, plus the bonus in the
   morning. Each visitor's luck is fixed in advance (a seeded number per visitor), so switching who decides
   changes only who is shown what.
   One step: decide by the clock (A every morning, B every night) or by a coin toss (each visitor, heads A),
   and read the click shares for the whole day and inside each half of the day.
   Made-up rates. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var RATES = [0.20, 0.30], NAMES = ['A', 'B'], N = 200, HALF = 100;
  var SIDE = 462, RIGHT = 620;
  var COLS = 10, GAP = 16, GX = [64, 264], GY = 82;
  var BASE = 398, TOP = 282, PER = (BASE - TOP) / 0.6;      // bars: 0 to 60%
  var GROUPS = [{ name: 'all day', cx: 132 }, { name: 'morning', cx: 252 }, { name: 'night', cx: 372 }];
  var BW = 24;

  window.InkKit.define('experiment-split', {
    label: 'Two versions shown to morning and night visitors, assigned by the clock or by a coin toss, with click shares for the whole day and for each half',
    steps: 1,
    seed: 44,
    draw: function (k) {
      var r = k.rng(44), luck = [], coin = [];
      for (var i = 0; i < N; i++) { luck.push(r()); coin.push(r()); }
      var byCoin = false, bonus = 0.20, busy = false;
      var version = [];                                        // 0 = A, 1 = B, for every visitor
      function plan(coinToss) { var v = []; for (var i = 0; i < N; i++) v.push(coinToss ? (coin[i] < 0.5 ? 0 : 1) : (i < HALF ? 0 : 1)); return v; }
      function clicked(i, v) { return luck[i] < RATES[v] + (i < HALF ? bonus : 0); }
      version = plan(false);

      /* ---- the visitors: each drawn once as an A-mark and once as a B-mark ---- */
      var frame = k.root.group({ d: 100 });
      frame.text(GX[0] + COLS * GAP / 2, GY - 26, 'morning', { kind: 'label', anchor: 'middle' });
      frame.text(GX[1] + COLS * GAP / 2, GY - 26, 'night', { kind: 'label', anchor: 'middle' });
      [0, 1].forEach(function (p) { frame.rect(GX[p] - 4, GY - 13, COLS * GAP + 8, 10 * GAP + 8, { w: 0.6, op: 0.4, rough: 0.4 }); });
      function at(i) { var p = i < HALF ? 0 : 1, j = i % HALF; return [GX[p] + 8 + (j % COLS) * GAP, GY + Math.floor(j / COLS) * GAP]; }
      var people = k.root.group({ d: 200, stagger: 3 });
      var marks = [];
      for (i = 0; i < N; i++) {
        var p = at(i);
        marks.push([people.mark(p[0], p[1], 'o', { r: 4 }), people.mark(p[0], p[1], '+', { r: 4.4 })]);
      }
      function showPerson(i) {
        var v = version[i], on = clicked(i, v);
        marks[i][v].style.display = '';
        marks[i][1 - v].style.display = 'none';
        marks[i][v].style.opacity = on ? 0.95 : 0.22;
      }
      var key = k.root.group({ d: 600 });
      key.mark(GX[0] + 4, 256, 'o', { r: 4 }); key.text(GX[0] + 14, 260, 'shown A', { kind: 'axis' });
      key.mark(GX[0] + 84, 256, '+', { r: 4.4 }); key.text(GX[0] + 94, 260, 'shown B', { kind: 'axis' });
      key.text(GX[1] + 4, 260, 'dark = clicked, pale = not', { kind: 'axis' });

      /* ---- the click shares: whole day, then each half of the day ---- */
      var axis = k.root.group({ d: 300 });
      axis.line(GROUPS[0].cx - 44, BASE, GROUPS[2].cx + 44, BASE, { w: 1.1 });
      GROUPS.forEach(function (g) { axis.text(g.cx, BASE + 34, g.name, { kind: 'label', anchor: 'middle' }); });
      var bars = k.root.layer();
      function share(v, from, to) {
        var n = 0, w = 0;
        for (var i = from; i < to; i++) if (version[i] === v) { n++; if (clicked(i, v)) w++; }
        return n ? w / n : null;
      }
      var s = k.root.group({ d: 250 });
      function readout(y, label) { s.text(SIDE, y, label, { kind: 'label' }); return s.text(RIGHT, y, '', { kind: 'val', anchor: 'end' }); }
      var vA = readout(60, 'A, all day'), vB = readout(80, 'B, all day'), vWin = readout(100, 'looks better');
      s.line(SIDE, 112, RIGHT, 112, { w: 0.6, op: 0.45, rough: 0.3 });
      var vWho = readout(132, 'who decides');

      function drawBars() {
        bars.clear();
        var all = [share(0, 0, N), share(1, 0, N)];
        var lead = all[1] > all[0] ? 1 : 0;
        GROUPS.forEach(function (g, gi) {
          var from = gi === 2 ? HALF : 0, to = gi === 1 ? HALF : N;
          [0, 1].forEach(function (v) {
            var x = g.cx + (v ? 3 : -3 - BW), val = share(v, from, to);
            bars.text(x + BW / 2, BASE + 15, NAMES[v], { kind: 'math', anchor: 'middle' });
            if (val == null) { bars.text(x + BW / 2, BASE - 6, 'none', { kind: 'axis', anchor: 'middle' }); return; }
            var top = BASE - val * PER, box = [[x, BASE], [x + BW, BASE], [x + BW, top], [x, top]];
            bars.hatch(box, { op: v ? 0.7 : 0.35, gap: v ? 3.4 : 6, angle: v ? -40 : 40 });
            bars.rect(x, top, BW, BASE - top, { w: gi === 0 && v === lead ? 1.6 : 1.1, rough: 0.4, accent: gi === 0 && v === lead });
            bars.text(x + BW / 2, top - 6, Math.round(val * 100) + '%', { kind: 'axis', anchor: 'middle' });
          });
        });
        vA.set(Math.round(all[0] * 100) + '%');
        vB.set(Math.round(all[1] * 100) + '%');
        vWin.set(NAMES[lead]);
        vWho.set(byCoin ? 'a coin' : 'the clock');
        note.clear();
        note.callout('a', byCoin ? 'both halves see both' : 'A gets every morning', SIDE, 262);
      }
      var note = k.root.layer();

      var toggle = k.button(SIDE, 168, 'toss a coin instead', function () {
        if (busy) return;
        byCoin = !byCoin;
        var next = plan(byCoin), order = [];
        for (var i = 0; i < N; i++) if (next[i] !== version[i]) order.push(i);
        toggle.set(byCoin ? 'go back to the clock' : 'toss a coin instead');
        busy = true;
        var done = 0;
        // the visitors who change version switch one after another, then the shares are counted again
        k.animate(900, function (t) {
          var due = Math.round(t * order.length);
          while (done < due) { var j = order[done++]; version[j] = next[j]; showPerson(j); }
          if (t >= 1) { busy = false; drawBars(); }
        });
      }, { d: 400 });
      k.slider({
        x: SIDE, y: 218, w: 158, min: 0, max: 0.25, step: 0.05, value: bonus, label: 'morning bonus',
        format: function (v) { return '+' + Math.round(v * 100) + ' pts'; },
        onChange: function (v) { bonus = v; for (var i = 0; i < N; i++) showPerson(i); if (!busy) drawBars(); }
      });

      k.onStep(function () { for (var i = 0; i < N; i++) showPerson(i); drawBars(); });
    }
  });
})();
