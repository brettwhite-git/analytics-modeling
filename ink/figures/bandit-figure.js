/* Bandit figure — do you have to spend half your visitors on the worse version?
   The same two versions as before (hidden click chances: A 20%, B 30%) and 500 visitors, in batches.
   Every version has one seeded stream of outcomes, and every plan reads from the same streams (a version's
   n-th visitor answers the same way whichever plan sent them), so the plans are compared on equal luck.
   Steps: 0 you decide, batch by batch, how many of the next 50 go to B (slider, then "send the batch"),
          and your running total is set against half each and against the leader rule
          1 the leader rule with its two dials: how much to keep spreading ("explore share") and how big a
            batch is, rerun over 200 other seeded days.
   The leader rule: the first batch is split equally. In every later batch a share of the visitors is spread
   equally over both versions and the rest go to the one with the better click share so far. A share of 100%
   is exactly "half each". Made-up rates. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var RATES = [0.20, 0.30];                          // hidden from the experimenter; B is better
  var NAMES = ['A', 'B'];
  var BEST = 1;
  var BUDGET = 500;                                  // visitors in all
  var RUN_SEED = 110;                                // the day that is drawn: A starts out looking better
  var N_RUNS = 200;                                  // other seeded days, for the averages in step 1
  var BATCH = 50;                                    // step 0's batch
  var BATCHES = [10, 25, 50, 100, 250];              // every one divides the budget
  var EPS_START = 0.2, BATCH_START = 2;              // 20% spread, batches of 50

  var Y0 = 366, Y1 = 46, PX = (Y0 - Y1) / BUDGET;    // the columns: baseline, top, pixels per visitor
  var CX = [150, 320];                               // column centres
  var TB = { dx: -48, w: 62 };                       // visitors bar, relative to the centre
  var WB = { dx: 22, w: 26 };                        // clicks bar
  var SIDE = 462, RIGHT = 620;

  function streams(rand) {
    var out = [];
    for (var a = 0; a < 2; a++) {
      var u = new Uint8Array(BUDGET);
      for (var i = 0; i < BUDGET; i++) u[i] = rand() < RATES[a] ? 1 : 0;
      out.push(u);
    }
    return out;
  }
  function wins(stream, from, to) { var s = 0; for (var i = from; i < to; i++) s += stream[i]; return s; }

  /* the leader rule, in batches. Returns the state after every batch. */
  function run(st, eps, batch) {
    var n = [0, 0], w = [0, 0], hist = [], nb = BUDGET / batch, a;
    for (var b = 0; b < nb; b++) {
      var lead = -1;
      if (b > 0) lead = w[1] / n[1] > w[0] / n[0] ? 1 : w[0] / n[0] > w[1] / n[1] ? 0 : (n[1] < n[0] ? 1 : 0);
      var explore = b === 0 ? batch : Math.round(eps * batch);
      var each = Math.floor(explore / 2), alloc = [each, each];
      if (explore - each * 2) alloc[b % 2]++;                                  // an odd one out takes turns
      if (lead >= 0) alloc[lead] += batch - explore;
      for (a = 0; a < 2; a++) { w[a] += wins(st[a], n[a], n[a] + alloc[a]); n[a] += alloc[a]; }
      hist.push({ alloc: alloc, n: n.slice(), w: w.slice() });
    }
    return hist;
  }
  function pick(s) { return s.n[1] && s.w[1] / s.n[1] > s.w[0] / (s.n[0] || 1) ? 1 : 0; }   // the one you would keep
  function sum(v) { return v[0] + v[1]; }
  function yOf(count) { return Y0 - count * PX; }

  window.InkKit.define('bandit-figure', {
    label: 'Two versions and 500 visitors in batches: you decide each batch, and your clicks are compared with half each and with a rule that sends most visitors to the version ahead',
    steps: 2,
    seed: 5,
    draw: function (k) {
      var st = streams(k.rng(RUN_SEED));
      var half = BUDGET / 2, evenAll = wins(st[0], 0, half) + wins(st[1], 0, half);
      var rule = run(st, EPS_START, BATCH);
      var eps = EPS_START, batchIx = BATCH_START;
      var many = null;                               // the 200 other days, made on first use

      /* ---- the sheet: a count axis and two empty columns, one per version ---- */
      k.root.axes({
        x: 44, y: Y1, w: 392, h: Y0 - Y1, ylabel: 'visitors',
        yticks: [[yOf(0), '0'], [yOf(100), '100'], [yOf(200), '200'], [yOf(300), '300'], [yOf(400), '400'], [yOf(500), '500']]
      });
      var frame = k.root.group({ d: 200 });
      var obs = [], truth = [];
      CX.forEach(function (cx, a) {
        var x = cx + TB.dx;
        frame.line(x, Y0, x, Y1, { w: 0.6, op: 0.4, rough: 0.4 });
        frame.line(x + TB.w, Y0, x + TB.w, Y1, { w: 0.6, op: 0.4, rough: 0.4 });
        frame.line(x, Y1, x + TB.w, Y1, { w: 0.6, op: 0.4, rough: 0.4 });
        frame.text(cx, 387, NAMES[a], { kind: 'math', anchor: 'middle' });
        truth.push(frame.text(cx, 405, '', { kind: 'label', anchor: 'middle' }));
        obs.push(frame.text(cx, 421, '', { kind: 'val', anchor: 'middle' }));
      });
      var legend = k.root.group({ d: 600 });
      legend.hatch([[SIDE, 399], [SIDE + 16, 399], [SIDE + 16, 389], [SIDE, 389]], { op: 0.3, gap: 6 });
      legend.rect(SIDE, 389, 16, 10, { w: 0.8, rough: 0.3 });
      legend.text(SIDE + 24, 398, 'visitors', { kind: 'label' });
      legend.hatch([[SIDE, 417], [SIDE + 16, 417], [SIDE + 16, 407], [SIDE, 407]], { op: 0.75, gap: 3.2, angle: -40 });
      legend.rect(SIDE, 407, 16, 10, { w: 0.8, rough: 0.3 });
      legend.text(SIDE + 24, 416, 'clicks', { kind: 'label' });

      /* one version's two bars. cuts = the visitor counts at which earlier batches ended; fresh = the newest batch */
      function bars(g, a, n, w, cuts, fresh) {
        var x = CX[a] + TB.dx, top = yOf(n), x2 = CX[a] + WB.dx, top2 = yOf(w), last = Y0;
        if (n > 0) {
          g.hatch([[x, Y0], [x + TB.w, Y0], [x + TB.w, top], [x, top]], { op: 0.3, gap: 6 });
          (cuts || []).forEach(function (c) {
            var y = yOf(c);
            if (c <= 0 || c >= n || last - y < 2) return;
            last = y;
            g.line(x, y, x + TB.w, y, { w: 0.6, op: 0.5, rough: 0.2 });
          });
          g.rect(x, top, TB.w, Y0 - top, { w: 1.1, rough: 0.5 });
          if (fresh > 0) g.rect(x, top, TB.w, Math.max(1.5, fresh * PX), { w: 1.7, rough: 0.4, accent: true, op: 0.95 });
        }
        if (w > 0) {
          g.hatch([[x2, Y0], [x2 + WB.w, Y0], [x2 + WB.w, top2], [x2, top2]], { op: 0.75, gap: 3.2, angle: -40 });
          g.rect(x2, top2, WB.w, Y0 - top2, { w: 1.1, rough: 0.5 });
        }
      }
      function report(n, w) {
        for (var a = 0; a < 2; a++) obs[a].set(n[a] ? w[a] + ' / ' + n[a] + ' · ' + Math.round(100 * w[a] / n[a]) + '%' : '–');
      }
      function revealRates(on) {
        for (var a = 0; a < 2; a++) truth[a].set(on ? 'true rate ' + Math.round(RATES[a] * 100) + '%' : 'true rate hidden');
      }
      function readout(g, y, label) {
        g.text(SIDE, y, label, { kind: 'label' });
        return g.text(RIGHT, y, '', { kind: 'val', anchor: 'end' });
      }

      /* ---- step 0: you decide each batch ---- */
      var live0 = k.root.layer({ steps: [0] });
      var s0 = k.root.group({ steps: [0], d: 300 });
      var vBatch = readout(s0, 60, 'batches sent'), vYou = readout(s0, 80, 'your clicks');
      var vEven = readout(s0, 100, 'half each'), vRule = readout(s0, 120, 'leader rule');
      s0.line(SIDE, 132, RIGHT, 132, { w: 0.6, op: 0.45, rough: 0.3 });
      s0.text(SIDE, 296, 'leader rule: of each 50,', { kind: 'axis', d: 900 });
      s0.text(SIDE, 312, '45 to the one ahead,', { kind: 'axis', d: 950 });
      s0.text(SIDE, 328, '5 to the other.', { kind: 'axis', d: 1000 });
      var callA = k.root.group({ steps: [0], d: 600 });
      callA.callout('a', 'the newest batch', SIDE, 262);

      var mine = [], toB = BATCH / 2;                 // mine: one { alloc, n, w } per batch you sent
      function draw0() {
        var s = mine.length ? mine[mine.length - 1] : { alloc: [0, 0], n: [0, 0], w: [0, 0] }, b = mine.length;
        live0.clear();
        for (var a = 0; a < 2; a++) {
          bars(live0, a, s.n[a], s.w[a], mine.map(function (h) { return h.n[a]; }), s.alloc[a]);
        }
        report(s.n, s.w);
        revealRates(b === BUDGET / BATCH);
        vBatch.set(b + ' of ' + BUDGET / BATCH);
        vYou.set(b ? String(sum(s.w)) : '–');
        vEven.set(b ? String(wins(st[0], 0, b * BATCH / 2) + wins(st[1], 0, b * BATCH / 2)) : '–');
        vRule.set(b ? String(sum(rule[b - 1].w)) : '–');
        send.set(b < BUDGET / BATCH ? 'send the batch' : 'start over');
        callA.node.style.display = b ? '' : 'none';
      }
      k.slider({
        x: SIDE, y: 176, w: 158, min: 0, max: BATCH, step: 5, value: toB, label: 'of next 50, to B', steps: [0],
        format: function (v) { return String(v); },
        onChange: function (v) { toB = v; }
      });
      var send = k.button(SIDE, 216, 'send the batch', function () {
        if (mine.length >= BUDGET / BATCH) { mine = []; draw0(); return; }
        var last = mine.length ? mine[mine.length - 1] : { n: [0, 0], w: [0, 0] };
        var alloc = [BATCH - toB, toB], n = last.n.slice(), w = last.w.slice();
        for (var a = 0; a < 2; a++) { w[a] += wins(st[a], n[a], n[a] + alloc[a]); n[a] += alloc[a]; }
        mine.push({ alloc: alloc, n: n, w: w });
        draw0();
      }, { steps: [0], d: 500 });

      /* ---- step 1: how much to keep spreading, and how often to look ---- */
      var live1 = k.root.layer({ steps: [1] });
      var s1 = k.root.group({ steps: [1], d: 300 });
      var vRule1 = readout(s1, 60, 'leader rule'), vEven1 = readout(s1, 80, 'half each');
      vEven1.set(String(evenAll));
      s1.line(SIDE, 92, RIGHT, 92, { w: 0.6, op: 0.45, rough: 0.3 });
      s1.line(SIDE, 208, RIGHT, 208, { w: 0.6, op: 0.45, rough: 0.3 });
      s1.text(SIDE, 228, 'over ' + N_RUNS + ' other days', { kind: 'label' });
      var avgRule = readout(s1, 246, 'rule, average'), avgEven = readout(s1, 264, 'half, average'), wrong1 = readout(s1, 282, 'ends on A');
      s1.text(SIDE, 344, 'too little: stuck.', { kind: 'hand', d: 700 });
      s1.text(SIDE, 366, 'too much: waste.', { kind: 'hand', d: 1100 });
      var call1 = k.root.layer({ steps: [1] });

      function draw1() {
        var batch = BATCHES[batchIx], hist = run(st, eps, batch), s = hist[hist.length - 1], p = pick(s);
        live1.clear(); call1.clear();
        for (var a = 0; a < 2; a++) bars(live1, a, s.n[a], s.w[a], hist.map(function (h) { return h.n[a]; }), 0);
        report(s.n, s.w);
        revealRates(true);
        live1.circle(CX[p], 381, 11, { accent: true, w: 1.4, op: 0.95 });
        call1.callout('c', p === BEST ? 'it ends on ' + NAMES[p] : 'it ends on ' + NAMES[p] + ', not ' + NAMES[BEST], SIDE, 310);
        vRule1.set(String(sum(s.w)));
        if (!many) {
          many = [];
          for (var i = 0; i < N_RUNS; i++) many.push(streams(k.rng(1000 + i * 7919)));
        }
        var total = 0, even = 0, wrong = 0;
        many.forEach(function (m) {
          var h = run(m, eps, batch), e = h[h.length - 1];
          total += sum(e.w);
          even += wins(m[0], 0, half) + wins(m[1], 0, half);
          if (pick(e) !== BEST) wrong++;
        });
        avgRule.set((total / N_RUNS).toFixed(0));
        avgEven.set((even / N_RUNS).toFixed(0));
        wrong1.set(wrong + ' in ' + N_RUNS);
      }
      k.slider({
        x: SIDE, y: 136, w: 158, min: 0, max: 1, step: 0.05, value: EPS_START, label: 'spread share', steps: [1],
        format: function (v) { return Math.round(v * 100) + '%'; },
        onChange: function (v) { eps = v; draw1(); }
      });
      k.slider({
        x: SIDE, y: 186, w: 158, min: 0, max: BATCHES.length - 1, step: 1, value: BATCH_START, label: 'batch size', steps: [1],
        format: function (v) { return String(BATCHES[v]); },
        onChange: function (v) { batchIx = v; draw1(); }
      });

      k.onStep(function (step) {
        if (step === 0) draw0();
        else draw1();
      });
    }
  });
})();
