/* Chance till — one till, customers decided by a die, played a minute at a time by the reader.
   The rule each minute: roll a die. 1-4 nobody comes, 5 one person, 6 two people. They join the line,
   then the till serves one person (if anyone is there). Whoever is left is "waiting".
   On average that is 3 people every 6 minutes, one every two minutes, and the till can do one a minute.
   Steps: 0 play the lunch hour yourself: "next minute" rolls the die and moves the people; "run the hour"
          plays the rest; a chart below keeps the line, minute by minute.
          1 the same average arriving evenly (one every other minute) against arriving by the die.
   The hour played in step 0 is offered to the page's Python as `hour_rolls` (see ink/py.js).
   Made-up rolls, fixed seeds. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var SIDE = 462, COL = 158, MIN = 60;
  var FIRST = 657277;                                // the seed of the first hour: it starts with a six
  var CH = { x: 44, w: 392, y0: 400, h: 90, top: 5 };  // the minute-by-minute chart in step 0

  function hourFrom(seed) {
    var r = window.InkKit.rng(seed), out = [];
    for (var i = 0; i < MIN; i++) out.push(Math.floor(r() * 6) + 1);
    return out;
  }
  function arrivals(roll) { return roll === 6 ? 2 : roll === 5 ? 1 : 0; }
  /* the whole hour: who arrived, who was served, how many were left waiting after each minute */
  function play(rolls) {
    var w = 0, out = [];
    rolls.forEach(function (roll) {
      var a = arrivals(roll), before = w + a, served = before > 0 ? 1 : 0;
      w = before - served;
      out.push({ roll: roll, a: a, served: served, w: w });
    });
    return out;
  }

  var hourSeed = FIRST, HOUR = hourFrom(FIRST);
  window.InkPage = window.InkPage || {};
  window.InkPage.hour_rolls = function () { return HOUR.slice(); };

  var PIPS = { TL: [-14, -14], TR: [14, -14], ML: [-14, 0], C: [0, 0], MR: [14, 0], BL: [-14, 14], BR: [14, 14] };
  var FACES = { 1: ['C'], 2: ['TL', 'BR'], 3: ['TL', 'C', 'BR'], 4: ['TL', 'TR', 'BL', 'BR'],
    5: ['TL', 'TR', 'C', 'BL', 'BR'], 6: ['TL', 'TR', 'ML', 'MR', 'BL', 'BR'] };

  window.InkKit.define('chance-till', {
    label: 'A till played a minute at a time: a die decides how many people arrive, the till serves one a minute, ' +
      'and the people left over wait in a line. A chart keeps the length of the line, minute by minute.',
    steps: 2,
    seed: 61,
    draw: function (k) {
      var DIE = { x: 92, y: 112 }, DOOR = { x: 196, y: 112 }, TILL = { x: 376, y: 112 }, OUT = { x: 436, y: 112 };
      function slotX(i) { return 330 - 18 * i; }
      var VISIBLE = 7;

      /* ================= step 0: play it ================= */
      var g0 = k.root.group({ steps: [0], d: 100, stagger: 40 });

      // the die: drawn once at the origin, turned and moved with a transform; its pips are switched on and off
      var dieG = g0.group({ d: 100 });
      dieG.rect(-28, -28, 56, 56, { accent: true, w: 1.6, op: 0.95, rough: 0.5 });
      var pipNodes = {};
      Object.keys(PIPS).forEach(function (name) { pipNodes[name] = dieG.dot(PIPS[name][0], PIPS[name][1], 4.2, { op: 0.9 }); });
      function face(n) {
        Object.keys(pipNodes).forEach(function (name) { pipNodes[name].style.display = n && FACES[n].indexOf(name) >= 0 ? '' : 'none'; });
      }
      function placeDie(turn) {
        dieG.node.setAttribute('transform', 'translate(' + DIE.x + ' ' + DIE.y + ') rotate(' + (turn || 0).toFixed(1) + ')');
      }
      placeDie(0);
      g0.text(DIE.x, 60, 'roll', { kind: 'label', anchor: 'middle' });
      g0.text(52, 172, '1 2 3 4   nobody', { kind: 'axis' });
      g0.text(52, 190, '5   one person', { kind: 'axis' });
      g0.text(52, 208, '6   two people', { kind: 'axis' });

      // the shop: a door, the line, the till, the way out
      function arrow(x1, x2, y) {
        g0.thread([[x1, y], [x2, y]]);
        g0.line(x2, y, x2 - 7, y - 3.6, { w: 1, rough: 0.3, op: 0.6 });
        g0.line(x2, y, x2 - 7, y + 3.6, { w: 1, rough: 0.3, op: 0.6 });
      }
      arrow(160, 190, DOOR.y);
      g0.text(172, 96, 'in', { kind: 'label', anchor: 'middle' });
      g0.rect(TILL.x - 24, TILL.y - 24, 48, 48, { w: 1.4, op: 0.9 });
      g0.text(TILL.x, TILL.y + 42, 'till', { kind: 'label', anchor: 'middle' });
      arrow(406, 436, OUT.y);
      g0.text(420, 96, 'out', { kind: 'label', anchor: 'middle' });
      g0.text(276, 152, 'waiting', { kind: 'label', anchor: 'middle' });
      g0.line(slotX(VISIBLE - 1) - 8, 134, slotX(0) + 8, 134, { w: 0.6, op: 0.45, rough: 0.3 });
      var overflow = g0.text(slotX(VISIBLE - 1) - 14, 117, '', { kind: 'val', anchor: 'end' });

      // the people: a pool of marks drawn once at the origin and moved
      var pool = [], people = k.root.group({ steps: [0], d: 0, stagger: 0 });
      people.node.style.pointerEvents = 'none';
      for (var p = 0; p < 16; p++) {
        var pg = people.group({ d: 0 });
        pg.mark(0, 0, 'o', { r: 6, op: 0.9 });
        pg.node.style.display = 'none';
        pool.push({ node: pg.node, x: 0, y: 0, used: false });
      }
      function put(c, x, y, op) {
        c.x = x; c.y = y;
        c.node.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
        c.node.style.opacity = op == null ? '' : String(op);
      }
      function take() {
        for (var i = 0; i < pool.length; i++) if (!pool[i].used) { pool[i].used = true; pool[i].node.style.display = ''; return pool[i]; }
        return null;
      }
      function free(c) { c.used = false; c.node.style.display = 'none'; c.node.style.opacity = ''; }

      // the chart: how many were waiting after each minute
      var c0 = k.root.group({ steps: [0], d: 200 });
      c0.axes({ x: CH.x, y: CH.y0 - CH.h, w: CH.w, h: CH.h });
      c0.text(CH.x, CH.y0 - CH.h - 10, 'waiting, minute by minute', { kind: 'label' });
      var cy = k.scale(0, CH.top, CH.y0, CH.y0 - CH.h), cx = k.scale(0, MIN, CH.x, CH.x + CH.w);
      [0, 2, 4].forEach(function (n) {
        c0.line(CH.x - 4, cy(n), CH.x, cy(n), { w: 0.6, op: 0.6, rough: 0.2 });
        c0.text(CH.x - 8, cy(n) + 3.5, String(n), { kind: 'axis', anchor: 'end' });
      });
      c0.text(CH.x, CH.y0 + 34, '0', { kind: 'axis', anchor: 'middle' });
      c0.text(CH.x + CH.w, CH.y0 + 34, '60 min', { kind: 'axis', anchor: 'end' });
      c0.text(CH.x + CH.w / 2, CH.y0 + 34, '· one dot per person who came in ·', { kind: 'axis', anchor: 'middle' });
      var chartLine = k.root.layer({ steps: [0] }), chartDots = k.root.layer({ steps: [0] }), probe = k.root.layer({ steps: [0] });

      // the column
      var s0 = k.root.group({ steps: [0], d: 250 });
      var rows = [['minute', ''], ['rolled', ''], ['came in', ''], ['served', ''], ['waiting', '']].map(function (r, i) {
        s0.text(SIDE, 50 + i * 20, r[0], { kind: 'label' });
        return s0.text(SIDE + COL, 50 + i * 20, r[1], { kind: 'val', anchor: 'end' });
      });
      s0.line(SIDE, 142, SIDE + COL, 142, { w: 0.6, op: 0.45, rough: 0.3 });
      s0.text(SIDE, 162, 'average waiting', { kind: 'label' });
      var vAvg = s0.text(SIDE + COL, 162, '–', { kind: 'val', anchor: 'end' });

      var t = 0, res = play(HOUR), queue = [], busy = false, cancel = null, finish = null, running = false;
      var reading = null;                              // a played minute the reader clicked on the chart, to read back

      function readout() {
        var at = reading != null ? reading + 1 : t, last = at ? res[at - 1] : null;
        rows[0].set(at + ' of ' + MIN);
        rows[1].set(last ? String(last.roll) : '–');
        rows[2].set(last ? String(last.a) : '–');
        rows[3].set(last ? String(last.served) : '–');
        rows[4].set(last ? String(last.w) : '0');
        var sum = 0;
        for (var i = 0; i < t; i++) sum += res[i].w;
        vAvg.set(t ? (sum / t).toFixed(2) : '–');
        overflow.set(queue.length > VISIBLE ? '+' + (queue.length - VISIBLE) : '');
        bNext.set(t >= MIN ? 'the hour is over' : 'next minute');
        bRun.node.style.display = t >= MIN ? 'none' : '';
        probe.clear();
        if (reading != null) probe.path('M' + cx(reading + 0.5).toFixed(1) + ' ' + (CH.y0 + 4) + ' L' + cx(reading + 0.5).toFixed(1) + ' ' + (CH.y0 - CH.h), { w: 0.8, op: 0.6 });
      }
      function drawChart() {
        chartLine.clear();
        if (!t) return;
        var d = 'M' + cx(0).toFixed(1) + ' ' + cy(0).toFixed(1), prev = 0;
        for (var i = 0; i < t; i++) {
          var w = Math.min(res[i].w, CH.top);
          d += ' L' + cx(i).toFixed(1) + ' ' + cy(prev).toFixed(1) + ' L' + cx(i).toFixed(1) + ' ' + cy(w).toFixed(1) + ' L' + cx(i + 1).toFixed(1) + ' ' + cy(w).toFixed(1);
          prev = w;
        }
        chartLine.path(d, { w: 1.4, op: 0.9 });
      }
      function addDots(i) {
        for (var j = 0; j < res[i].a; j++) chartDots.dot(cx(i + 0.5), CH.y0 + 9 + j * 6, 1.8, { op: 0.75 });
      }
      function layoutQueue() {
        queue.forEach(function (c, i) {
          if (i < VISIBLE) put(c, slotX(i), DOOR.y);
          else put(c, slotX(VISIBLE - 1), DOOR.y, 0);
        });
      }
      function reset() {
        if (cancel) cancel();
        busy = false; running = false; finish = null; reading = null;
        pool.forEach(free); queue = []; t = 0; res = play(HOUR);
        chartLine.clear(); chartDots.clear(); face(0); placeDie(0);
        readout();
      }

      /* one minute: the die tumbles, newcomers walk to the back, the front person goes through the till */
      function minute(ms, done) {
        if (t >= MIN) { if (done) done(); return; }
        var r = res[t], fresh = [], served = null;
        for (var j = 0; j < r.a; j++) { var c = take(); if (c) { put(c, DOOR.x - 10 * j, DOOR.y); fresh.push(c); } }
        queue = queue.concat(fresh);
        if (r.served && queue.length) served = queue.shift();
        var from = queue.map(function (c) { return [c.x, c.y]; }), sFrom = served ? [served.x, served.y] : null;
        var spin = ms > 300;
        busy = true;
        finish = function () {
          busy = false; finish = null; cancel = null;
          if (served) free(served);
          face(r.roll); placeDie(0); layoutQueue();
          t++; reading = null; addDots(t - 1); drawChart(); readout();
          if (done) done();
        };
        cancel = k.animate(ms, function (u) {
          if (spin && u < 0.45) { face(1 + Math.floor((u * 40) % 6)); placeDie(Math.sin(u * 14) * 18); }
          else { face(r.roll); placeDie(0); }
          var m = spin ? Math.max(0, (u - 0.35) / 0.65) : u;
          queue.forEach(function (c, i) {
            var tx = slotX(Math.min(i, VISIBLE - 1));
            put(c, from[i][0] + (tx - from[i][0]) * m, DOOR.y, i < VISIBLE ? 1 : 1 - m);
          });
          if (served) {
            if (m < 0.5) put(served, sFrom[0] + (TILL.x - sFrom[0]) * m * 2, TILL.y, 1);
            else put(served, TILL.x + (OUT.x - TILL.x) * (m - 0.5) * 2, TILL.y, 1 - (m - 0.5) * 2);
          }
          if (u >= 1 && finish) finish();
        });
      }
      function snap() { if (busy && finish) { if (cancel) cancel(); finish(); } }

      function nextMinute() {
        if (running) return;
        snap(); minute(820);
      }
      /* play quickly on until `end` minutes have been played (the whole hour, or a minute clicked on the chart) */
      function runTo(end) {
        if (running) return;
        snap(); running = true;
        (function loop() {
          if (!running || k.step() !== 0) { running = false; return; }
          if (t >= end) { running = false; readout(); return; }
          minute(150, function () { setTimeout(loop, 25); });
        })();
      }
      var bNext = k.button(SIDE, 200, 'next minute', nextMinute, { steps: [0] });
      var bRun = k.button(SIDE, 234, 'run the hour', function () { runTo(MIN); }, { steps: [0] });

      // on the chart itself: the die rolls the next minute; a minute on the chart is read back, or played up to
      var NS = 'http://www.w3.org/2000/svg';
      var hits = k.root.group({ steps: [0] });
      function hitRect(x, y, w, h, label, cursor) {
        var r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', w); r.setAttribute('height', h);
        r.setAttribute('class', 'ik-hit'); r.setAttribute('tabindex', 0); r.setAttribute('role', 'button');
        r.setAttribute('aria-label', label); r.style.cursor = cursor;
        hits.node.appendChild(r);
        return r;
      }
      var dieHit = hitRect(DIE.x - 34, DIE.y - 34, 68, 68, 'Roll the die for the next minute', 'pointer');
      dieHit.addEventListener('click', nextMinute);
      dieHit.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextMinute(); } });
      var chartHit = hitRect(CH.x, CH.y0 - CH.h - 4, CH.w, CH.h + 26, 'Read a minute of the hour. Arrow keys move along it.', 'crosshair');
      function pickMinute(m) {
        if (running) return;
        snap();
        m = Math.max(0, Math.min(MIN - 1, m));
        if (m < t) { reading = m; readout(); }
        else runTo(m + 1);
      }
      chartHit.addEventListener('click', function (e) {
        var p = k.toFigure(e);
        pickMinute(Math.floor((p.x - CH.x) / CH.w * MIN));
      });
      chartHit.addEventListener('keydown', function (e) {
        var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir || !t) return;
        e.preventDefault();
        var m = (reading != null ? reading : t - 1) + dir;
        if (m >= 0 && m < t) { reading = m; readout(); }
      });
      k.button(SIDE, 268, 'another hour', function () {
        hourSeed += 7919; HOUR = hourFrom(hourSeed); reset();
      }, { steps: [0] });
      k.root.group({ steps: [0], d: 700 }).callout('a', 'a six: one must wait', SIDE, 316);
      var h0 = k.root.group({ steps: [0], d: 900 });
      h0.text(SIDE, 360, 'one a minute is', { kind: 'hand' });
      h0.text(SIDE, 382, 'plenty, on average.', { kind: 'hand' });
      h0.text(SIDE, 404, 'but people bunch.', { kind: 'hand' });

      /* ================= step 1: the same average, evenly and by chance ================= */
      var g1 = k.root.group({ steps: [1], d: 100 });
      var ROW = [{ y0: 186, title: 'evenly: one person every other minute' }, { y0: 380, title: 'by the die: the same 30 an hour, on average' }];
      var rh = 96, ry = function (row, n) { return row.y0 - n / 4 * rh; };
      ROW.forEach(function (row) {
        g1.axes({ x: CH.x, y: row.y0 - rh, w: CH.w, h: rh });
        g1.text(CH.x, row.y0 - rh - 10, row.title, { kind: 'label' });
        [0, 2, 4].forEach(function (n) {
          g1.line(CH.x - 4, ry(row, n), CH.x, ry(row, n), { w: 0.6, op: 0.6, rough: 0.2 });
          g1.text(CH.x - 8, ry(row, n) + 3.5, String(n), { kind: 'axis', anchor: 'end' });
        });
      });
      g1.text(CH.x + CH.w, ROW[1].y0 + 32, 'minutes, 0 to 60', { kind: 'axis', anchor: 'end' });
      var evenRolls = [];
      for (var e = 0; e < MIN; e++) evenRolls.push(e % 2 === 0 ? 5 : 1);     // a 5 every other minute: one person
      var evenRes = play(evenRolls);
      // the even row never changes, so its dots and line are inked once
      evenRes.forEach(function (r, i) { if (r.a) g1.dot(cx(i + 0.5), ROW[0].y0 + 9, 1.8, { op: 0.75 }); });
      k.root.layer({ steps: [1] }).path('M' + cx(0) + ' ' + ry(ROW[0], 0) + ' L' + cx(MIN) + ' ' + ry(ROW[0], 0), { w: 1.4, op: 0.9 });
      var row1 = k.root.layer({ steps: [1] }), row1dots = k.root.layer({ steps: [1] });

      var s1 = k.root.group({ steps: [1], d: 250 });
      s1.text(SIDE + 104, 50, 'even', { kind: 'label', anchor: 'end' });
      s1.text(SIDE + COL, 50, 'die', { kind: 'label', anchor: 'end' });
      var cmp = [['people', '30'], ['longest', '0'], ['had a line', '0'], ['average', '0.00']].map(function (r, i) {
        s1.text(SIDE, 70 + i * 20, r[0], { kind: 'label' });
        s1.text(SIDE + 104, 70 + i * 20, r[1], { kind: 'val', anchor: 'end' });
        return s1.text(SIDE + COL, 70 + i * 20, '', { kind: 'val', anchor: 'end' });
      });
      s1.text(SIDE, 166, 'longest: most at once', { kind: 'axis' });
      s1.text(SIDE, 180, 'had a line: minutes', { kind: 'axis' });
      var dealt = 0, dealSeed = 4166, chanceRes = null, stopDeal = null;
      function chanceHour(n) { return play(hourFrom(dealSeed + n * 104729)); }
      function drawRow1(upto) {
        row1.clear();
        var d = 'M' + cx(0).toFixed(1) + ' ' + ry(ROW[1], 0).toFixed(1), prev = 0;
        for (var i = 0; i < upto; i++) {
          var w = Math.min(chanceRes[i].w, 4.6);
          d += ' L' + cx(i).toFixed(1) + ' ' + ry(ROW[1], prev).toFixed(1) + ' L' + cx(i).toFixed(1) + ' ' + ry(ROW[1], w).toFixed(1) + ' L' + cx(i + 1).toFixed(1) + ' ' + ry(ROW[1], w).toFixed(1);
          prev = w;
        }
        row1.path(d, { w: 1.5, op: 0.95, accent: true });
      }
      function deal(animated) {
        if (stopDeal) stopDeal();
        chanceRes = chanceHour(dealt);
        var people = 0, most = 0, mins = 0, sum = 0;
        chanceRes.forEach(function (r) { people += r.a; most = Math.max(most, r.w); if (r.w) mins++; sum += r.w; });
        cmp[0].set(String(people)); cmp[1].set(String(most)); cmp[2].set(String(mins)); cmp[3].set((sum / MIN).toFixed(2));
        row1dots.clear();
        var shown = 0;
        function upto(n) {
          for (; shown < n; shown++) for (var j = 0; j < chanceRes[shown].a; j++) row1dots.dot(cx(shown + 0.5), ROW[1].y0 + 9 + j * 6, 1.8, { op: 0.75 });
          drawRow1(n);
        }
        if (!animated) { upto(MIN); return; }
        stopDeal = k.animate(1400, function (u) { upto(Math.round(u * MIN)); });
      }
      k.button(SIDE, 216, 'deal another hour', function () { dealt++; deal(true); }, { steps: [1] });
      k.root.group({ steps: [1], d: 600 }).callout('b', 'same average, bunched', SIDE, 262);
      var h1 = k.root.group({ steps: [1], d: 900 });
      h1.text(SIDE, 306, 'even arrivals never', { kind: 'hand' });
      h1.text(SIDE, 328, 'wait. chance ones do.', { kind: 'hand' });

      k.onStep(function (step) {
        running = false;
        if (step === 0) reset();
        else { dealt = 0; deal(false); }
      });
    }
  });
})();
