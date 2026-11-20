/* Bandit figure — explore versus exploit, simulated for real.
   Three alternatives (arms) with hidden success rates. Every arm has one seeded stream of outcomes, and both
   designs read from the same streams (an arm's n-th trial comes out the same whichever design asked for it),
   so the fixed test and the bandit are compared on equal luck.
   The bandit's rule (epsilon-greedy, in batches): the first batch is split equally. In every later batch an
   "explore share" of the trials is spread equally over all arms and the rest go to the arm with the best
   observed success rate so far. Explore share 100% is exactly the fixed test.
   Steps: 0 the fixed A/B/C test and the reward it leaves behind · 1 the bandit, batch by batch (button) ·
          2 explore share and batch size (sliders), with the same rule rerun over 200 other seeded streams.
   Made-up rates. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var RATES = [0.10, 0.30, 0.20];                    // hidden from the experimenter; B is the best arm
  var NAMES = ['A', 'B', 'C'];
  var BEST = 1;
  var BUDGET = 600;                                  // trials in total
  var RUN_SEED = 23;                                 // the one run that is drawn
  var N_RUNS = 200;                                  // other seeded runs, for the averages in step 2
  var BATCHES = [20, 30, 60, 100, 150, 200];         // every one divides the budget
  var EPS_START = 0.2, BATCH_START = 2;              // 20% explore, batches of 60
  var SHOWN_AT_OPEN = 4;                             // step 1 opens with four batches already run

  var Y0 = 366, Y1 = 46, PX = (Y0 - Y1) / BUDGET;    // the columns: baseline, top, pixels per trial
  var CX = [108, 240, 372];                          // column centres
  var TB = { dx: -38, w: 52 };                       // trials bar, relative to the centre
  var WB = { dx: 18, w: 20 };                        // successes bar
  var SIDE = 462, RIGHT = 620;

  function streams(rand) {
    var out = [];
    for (var a = 0; a < 3; a++) {
      var u = new Uint8Array(BUDGET);
      for (var i = 0; i < BUDGET; i++) u[i] = rand() < RATES[a] ? 1 : 0;
      out.push(u);
    }
    return out;
  }
  function wins(stream, from, to) { var s = 0; for (var i = from; i < to; i++) s += stream[i]; return s; }

  /* epsilon-greedy in batches. Returns the state after every batch. */
  function run(st, eps, batch) {
    var n = [0, 0, 0], w = [0, 0, 0], hist = [], nb = BUDGET / batch, a;
    for (var b = 0; b < nb; b++) {
      var lead = -1, bestRate = -1;
      if (b > 0) for (a = 0; a < 3; a++) {
        var r = w[a] / n[a];
        if (r > bestRate + 1e-12 || (Math.abs(r - bestRate) <= 1e-12 && n[a] < n[lead])) { bestRate = r; lead = a; }
      }
      var explore = b === 0 ? batch : Math.round(eps * batch);
      var each = Math.floor(explore / 3), alloc = [each, each, each];
      for (var j = 0; j < explore - each * 3; j++) alloc[(b + j) % 3]++;      // leftovers take turns
      if (lead >= 0) alloc[lead] += batch - explore;
      for (a = 0; a < 3; a++) { w[a] += wins(st[a], n[a], n[a] + alloc[a]); n[a] += alloc[a]; }
      hist.push({ alloc: alloc, n: n.slice(), w: w.slice() });
    }
    return hist;
  }
  function pick(s) {                                 // the arm you would choose from what you observed
    var p = 0;
    for (var a = 1; a < 3; a++) if (s.n[a] && s.w[a] / s.n[a] > s.w[p] / (s.n[p] || 1)) p = a;
    return p;
  }
  function sum(v) { return v[0] + v[1] + v[2]; }
  function yOf(count) { return Y0 - count * PX; }

  window.InkKit.define('bandit-figure', {
    label: 'Three alternatives tested with a fixed budget of trials: an equal split compared with a bandit that shifts trials toward the arm that looks best',
    steps: 3,
    seed: 5,
    draw: function (k) {
      var st = streams(k.rng(RUN_SEED));
      var third = BUDGET / 3;
      var fixedW = [wins(st[0], 0, third), wins(st[1], 0, third), wins(st[2], 0, third)];
      var fixedTotal = sum(fixedW), allBest = wins(st[BEST], 0, BUDGET);
      var eps = EPS_START, batchIx = BATCH_START, shown = SHOWN_AT_OPEN;
      var hist1 = run(st, EPS_START, BATCHES[BATCH_START]);
      var many = null;                               // the 200 other streams, made on first use

      /* ---- the sheet: a count axis and three empty columns, one per arm ---- */
      k.root.axes({
        x: 44, y: Y1, w: 392, h: Y0 - Y1, ylabel: 'count',
        yticks: [[yOf(0), '0'], [yOf(200), '200'], [yOf(400), '400'], [yOf(600), '600']]
      });
      var frame = k.root.group({ d: 200 });
      var obs = [];
      CX.forEach(function (cx, a) {
        var x = cx + TB.dx;
        frame.line(x, Y0, x, Y1, { w: 0.6, op: 0.4, rough: 0.4 });
        frame.line(x + TB.w, Y0, x + TB.w, Y1, { w: 0.6, op: 0.4, rough: 0.4 });
        frame.line(x, Y1, x + TB.w, Y1, { w: 0.6, op: 0.4, rough: 0.4 });
        frame.text(cx, 387, NAMES[a], { kind: 'math', anchor: 'middle' });
        frame.text(cx, 405, 'true rate ' + Math.round(RATES[a] * 100) + '%', { kind: 'label', anchor: 'middle' });
        obs.push(frame.text(cx, 421, '', { kind: 'val', anchor: 'middle' }));
      });
      var legend = k.root.group({ d: 600 });
      legend.hatch([[SIDE, 399], [SIDE + 16, 399], [SIDE + 16, 389], [SIDE, 389]], { op: 0.3, gap: 6 });
      legend.rect(SIDE, 389, 16, 10, { w: 0.8, rough: 0.3 });
      legend.text(SIDE + 24, 398, 'trials', { kind: 'label' });
      legend.hatch([[SIDE, 417], [SIDE + 16, 417], [SIDE + 16, 407], [SIDE, 407]], { op: 0.75, gap: 3.2, angle: -40 });
      legend.rect(SIDE, 407, 16, 10, { w: 0.8, rough: 0.3 });
      legend.text(SIDE + 24, 416, 'successes', { kind: 'label' });

      /* one arm's two bars. cuts = the trial counts at which earlier batches ended; fresh = trials in the newest batch */
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
        for (var a = 0; a < 3; a++) obs[a].set(w[a] + ' / ' + n[a] + ' · ' + Math.round(100 * w[a] / (n[a] || 1)) + '%');
      }
      function readout(g, y, label) {
        g.text(SIDE, y, label, { kind: 'label' });
        return g.text(RIGHT, y, '', { kind: 'val', anchor: 'end' });
      }

      /* ---- step 0: the fixed test, and what its trials would have earned on the best arm ---- */
      var g0 = k.root.group({ steps: [0], d: 400, stagger: 60 });
      var lostAt = null, from = third;
      for (var a = 0; a < 3; a++) {
        bars(g0, a, third, fixedW[a]);
        if (a === BEST) continue;
        var lost = wins(st[BEST], from, from + third) - fixedW[a];             // the same 200 trials, given to B
        from += third;
        if (lost <= 0) continue;
        var x2 = CX[a] + WB.dx, yA = yOf(fixedW[a] + lost), yB = yOf(fixedW[a]);
        g0.hatch([[x2, yB], [x2 + WB.w, yB], [x2 + WB.w, yA], [x2, yA]], { op: 0.8, gap: 3.2, accent: true });
        g0.rect(x2, yA, WB.w, yB - yA, { w: 1.6, rough: 0.4, accent: true, op: 0.95 });
        lostAt = [x2 + WB.w + 5, (yA + yB) / 2];
      }
      readout(g0, 60, 'fixed test').set(String(fixedTotal));
      readout(g0, 80, 'all on ' + NAMES[BEST]).set(String(allBest));
      g0.line(SIDE, 92, RIGHT, 92, { w: 0.6, op: 0.45, rough: 0.3 });
      readout(g0, 112, 'reward lost').set(String(allBest - fixedTotal));
      g0.callout('a', 'lost on the worse arms', SIDE, 150, { to: lostAt, d: 1300 });

      /* ---- step 1: the bandit, one batch at a time ---- */
      var live1 = k.root.layer({ steps: [1] });
      var s1 = k.root.group({ steps: [1], d: 300 });
      var used1 = readout(s1, 60, 'trials used'), bandit1 = readout(s1, 80, 'bandit'), fixed1 = readout(s1, 100, 'fixed by then');
      s1.line(SIDE, 112, RIGHT, 112, { w: 0.6, op: 0.45, rough: 0.3 });
      s1.text(SIDE, 134, 'each batch of ' + BATCHES[BATCH_START], { kind: 'label' });
      s1.text(SIDE, 150, Math.round(EPS_START * 100) + '% spread equally', { kind: 'label' });
      s1.text(SIDE, 166, Math.round(100 - EPS_START * 100) + '% to best so far', { kind: 'label' });
      s1.callout('b', 'the newest batch', SIDE, 250, { d: 600 });

      function drawRun(layer, hist, upTo, markFresh) {
        var s = hist[upTo - 1];
        layer.clear();
        for (var a = 0; a < 3; a++) {
          bars(layer, a, s.n[a], s.w[a], hist.slice(0, upTo).map(function (h) { return h.n[a]; }), markFresh ? s.alloc[a] : 0);
        }
        report(s.n, s.w);
        return s;
      }
      function redraw1() {
        var s = drawRun(live1, hist1, shown, true), t = sum(s.n);
        used1.set(t + ' / ' + BUDGET);
        bandit1.set(String(sum(s.w)));
        fixed1.set(String(wins(st[0], 0, t / 3) + wins(st[1], 0, t / 3) + wins(st[2], 0, t / 3)));
        next.set(shown < hist1.length ? 'next batch' : 'start over');
      }
      var next = k.button(SIDE, 206, 'next batch', function () {
        shown = shown < hist1.length ? shown + 1 : 1;
        redraw1();
      }, { steps: [1], d: 500 });

      /* ---- step 2: how much to explore, and how often to look ---- */
      var live2 = k.root.layer({ steps: [2] });
      var s2 = k.root.group({ steps: [2], d: 300 });
      var bandit2 = readout(s2, 60, 'bandit');
      readout(s2, 80, 'fixed test').set(String(fixedTotal));
      s2.line(SIDE, 92, RIGHT, 92, { w: 0.6, op: 0.45, rough: 0.3 });
      s2.line(SIDE, 208, RIGHT, 208, { w: 0.6, op: 0.45, rough: 0.3 });
      s2.text(SIDE, 228, 'over ' + N_RUNS + ' other runs', { kind: 'label' });
      var avg2 = readout(s2, 246, 'mean reward'), wrong2 = readout(s2, 264, 'wrong pick');
      s2.text(SIDE, 338, 'too little: lock-in.', { kind: 'hand', d: 700 });
      s2.text(SIDE, 360, 'too much: waste.', { kind: 'hand', d: 1100 });

      function redraw2() {
        var batch = BATCHES[batchIx], hist = run(st, eps, batch), s = drawRun(live2, hist, hist.length, false), p = pick(s);
        live2.circle(CX[p], 381, 11, { accent: true, w: 1.4, op: 0.95 });
        live2.callout('c', p === BEST ? 'it ends on ' + NAMES[p] : 'it ends on ' + NAMES[p] + ', not ' + NAMES[BEST], SIDE, 300);
        bandit2.set(String(sum(s.w)));
        if (!many) {
          many = [];
          for (var i = 0; i < N_RUNS; i++) many.push(streams(k.rng(1000 + i * 7919)));
        }
        var total = 0, wrong = 0;
        many.forEach(function (m) {
          var h = run(m, eps, batch), e = h[h.length - 1];
          total += sum(e.w);
          if (pick(e) !== BEST) wrong++;
        });
        avg2.set((total / N_RUNS).toFixed(0));
        wrong2.set(wrong + ' in ' + N_RUNS);
      }
      k.slider({
        x: SIDE, y: 136, w: 158, min: 0, max: 1, step: 0.05, value: EPS_START, label: 'explore share', steps: [2],
        format: function (v) { return Math.round(v * 100) + '%'; },
        onChange: function (v) { eps = v; redraw2(); }
      });
      k.slider({
        x: SIDE, y: 186, w: 158, min: 0, max: BATCHES.length - 1, step: 1, value: BATCH_START, label: 'batch size', steps: [2],
        format: function (v) { return String(BATCHES[v]); },
        onChange: function (v) { batchIx = v; redraw2(); }
      });

      k.onStep(function (step) {
        if (step === 0) report([third, third, third], fixedW);
        else if (step === 1) redraw1();
        else redraw2();
      });
    }
  });
})();
