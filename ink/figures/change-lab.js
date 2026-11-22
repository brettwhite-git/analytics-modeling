/* Change lab — spotting a small, lasting rise in a noisy series, by hand, before the method is named.
   Fifty days of a machine's output. Its normal level is 10; from day 31 on it runs 0.5 higher.
   Steps: 0 click the day you think it changed, then see the true day and how far off you were
          1 keep a running score one day at a time: today's score = yesterday's + (output - 10)
          2 the plain score sinks on quiet days; switch on "never below zero" and "an allowance" and watch it change
          3 an alarm line: drag it up or down (or slide it), slide the allowance, read how late the alarm is and how many false ones
          4 the same, with the size of the rise: drag the new level in the top chart, or use its slider
   In steps 3 and 4 the reader can also drag any day's dot up or down and watch the score and the alarm react;
   "put the points back" restores them. The drags live in a working copy, never in OUTPUT.
   Every number is computed here from the same seeded series, which is offered to the page's Python through
   window.InkPage (output, normal, my_allowance, my_threshold). After any alarm the score starts again at zero.
   Made-up data. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var X0 = 44, PW = 392, SIDE = 462;
  var TALL = { y: 34, h: 372 }, TOP = { y: 34, h: 142 }, BOT = { y: 228, h: 178 };
  var N = 50, LAST_NORMAL = 30, MU = 10, SD = 0.5, SHIFT = 0.5;
  var C0 = 0.25, T0 = 2.5;
  var VLO = 8.4, VHI = 12.8;                         // the output axis
  var SC12 = { lo: -4, hi: 12 }, SC3 = { lo: 0, hi: 6 };
  var STORE_GUESS = 'ink-change-guess', STORE_KNOBS = 'ink-change-knobs';
  var SVGNS = 'http://www.w3.org/2000/svg';

  function r1(v) { return Math.round(v * 10) / 10; }
  /* fifty standard normal draws (Box-Muller) from the kit's seeded generator */
  var Z = (function (rand) {
    var z = [];
    for (var i = 0; i < N; i++) {
      var u = Math.max(rand(), 1e-9), v = rand();
      z.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
    }
    return z;
  })(window.InkKit.rng(1494));
  function makeSeries(shift) {
    return Z.map(function (z, i) { return r1(MU + SD * z + (i >= LAST_NORMAL ? shift : 0)); });
  }
  // made once, to one decimal, so the page's Python works on exactly these numbers
  var OUTPUT = makeSeries(SHIFT);

  /* the running score, in the same order of operations as the Python on the page */
  function scores(x, C, floor) {
    var s = 0, out = [];
    for (var i = 0; i < x.length; i++) {
      s = s + (x[i] - MU) - C;
      if (floor) s = Math.max(0, s);
      out.push(s);
    }
    return out;
  }
  /* never below zero, less an allowance, an alarm when over T; after every alarm it starts again at zero */
  function watch(x, C, T) {
    var s = 0, S = [], alarms = [];
    for (var i = 0; i < x.length; i++) {
      // rounded to two places, as on paper and in the page's Python, so a score of exactly T is not over it
      s = Math.round(Math.max(0, s + (x[i] - MU) - C) * 100) / 100;
      S.push(s);
      if (s > T) { alarms.push(i + 1); s = 0; }
    }
    var falseAlarms = alarms.filter(function (d) { return d <= LAST_NORMAL; });
    var after = alarms.filter(function (d) { return d > LAST_NORMAL; });
    return { S: S, alarms: alarms, falseAlarms: falseAlarms, detected: after.length ? after[0] : null };
  }

  function load(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch (e) { return null; } }
  function save(key, v, evt) {
    try { sessionStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent(evt)); } catch (e) {}
  }
  function knobs() {
    var v = load(STORE_KNOBS);
    return v && isFinite(v.C) && isFinite(v.T) ? v : { C: C0, T: T0 };
  }
  function guess() { var g = load(STORE_GUESS); return isFinite(g) && g >= 1 && g <= N ? g : null; }

  /* what `from page import output, normal, my_allowance, my_threshold` gives the Python (see ink/py.js) */
  window.InkPage = window.InkPage || {};
  window.InkPage.output = function () { return OUTPUT; };
  window.InkPage.normal = function () { return MU; };
  window.InkPage.my_allowance = function () { return knobs().C; };
  window.InkPage.my_threshold = function () { return knobs().T; };

  function signed(v, dp) {
    var s = Math.abs(v) < 1e-9 ? 0 : v;
    return (s > 0 ? '+' : s < 0 ? '−' : '') + Math.abs(s).toFixed(dp == null ? 1 : dp);
  }

  window.InkKit.define('change-lab', {
    label: 'Spotting a change: fifty days of output, a running score kept day by day, and an alarm line',
    steps: 5,
    seed: 31,
    draw: function (k) {
      function raw(tag, attrs, parent) {
        var n = document.createElementNS(SVGNS, tag);
        for (var a in attrs) n.setAttribute(a, attrs[a]);
        parent.appendChild(n);
        return n;
      }
      var tx = k.scale(0, N + 1, X0, X0 + PW);
      function yv(v, box) { return box.y + box.h - (v - VLO) / (VHI - VLO) * box.h; }
      function ys(v, sc) { var c = Math.max(sc.lo, Math.min(sc.hi, v)); return BOT.y + BOT.h - (c - sc.lo) / (sc.hi - sc.lo) * BOT.h; }
      function dayAt(px) { return Math.max(1, Math.min(N, Math.round((px - X0) / PW * (N + 1)))); }
      function d1(v) { return v.toFixed(1); }
      var dayTicks = [1, 10, 20, 30, 40, 50].map(function (d) { return [tx(d), String(d)]; });
      var outTicks = function (box) { return [9, 10, 11, 12].map(function (v) { return [yv(v, box), String(v)]; }); };
      var cx = tx(LAST_NORMAL + 0.5);
      var cancel = null, busy = false;
      function stop() { if (cancel) cancel(); cancel = null; busy = false; }
      /* a group that is drawn in when shown: toggling is-off lets the kit's own CSS do the drawing */
      function hideable(parent, o) { var g = parent.group(o || { d: 0 }); g.node.classList.add('is-off'); return g; }
      function show(g, on) { g.node.classList.toggle('is-off', !on); }

      /* ---- axes for the two layouts ---- */
      k.root.group({ steps: [0] }).axes({ x: X0, y: TALL.y, w: PW, h: TALL.h, xlabel: 'day', ylabel: 'output', xticks: dayTicks, yticks: outTicks(TALL) });
      k.root.group({ steps: [1, 2, 3, 4] }).axes({ x: X0, y: TOP.y, w: PW, h: TOP.h, ylabel: 'output', yticks: outTicks(TOP) });
      k.root.group({ steps: [1, 2] }).axes({ x: X0, y: BOT.y, w: PW, h: BOT.h, xlabel: 'day', ylabel: 'running score', xticks: dayTicks,
        yticks: [-4, 0, 4, 8, 12].map(function (v) { return [ys(v, SC12), String(v)]; }) });
      k.root.group({ steps: [3, 4] }).axes({ x: X0, y: BOT.y, w: PW, h: BOT.h, xlabel: 'day', ylabel: 'running score', xticks: dayTicks,
        yticks: [0, 2, 4, 6].map(function (v) { return [ys(v, SC3), String(v)]; }) });
      // the normal level, and zero on the score
      k.root.group({ steps: [0] }).line(X0, yv(MU, TALL), X0 + PW, yv(MU, TALL), { w: 0.6, op: 0.55, rough: 0.3 });
      k.root.group({ steps: [1, 2, 3, 4] }).line(X0, yv(MU, TOP), X0 + PW, yv(MU, TOP), { w: 0.6, op: 0.55, rough: 0.3 });
      k.root.group({ steps: [1, 2] }).line(X0, ys(0, SC12), X0 + PW, ys(0, SC12), { w: 0.6, op: 0.45, rough: 0.3 });
      // where it really changed, once the reader has seen it
      var truth = k.root.group({ steps: [1, 2, 3, 4], d: 200 });
      truth.thread([[cx, TOP.y + 2], [cx, BOT.y + BOT.h]], { w: 1 });
      truth.text(cx, TOP.y - 10, 'it changed', { kind: 'label', anchor: 'middle' });

      /* ---- the measurements: dots, redrawn only when the layout or the series changes ---- */
      var dotsLayer = k.root.layer();
      var series = OUTPUT, shift = SHIFT;
      /* steps 3 and 4: the reader may drag any day up or down. A drag is kept as an offset for that day, added to
         whatever series is shown (so it survives a change in the size of the rise). OUTPUT itself is never
         touched, so InkPage.output always gives the original fifty days. */
      var nudge = {}, nMoved = 0;
      function baseSeries() { return shift === SHIFT ? OUTPUT : makeSeries(shift); }
      function clampV(v) { return Math.max(VLO + 0.1, Math.min(VHI - 0.1, v)); }
      function currentSeries() {
        var b = baseSeries();
        if (!nMoved) return b;
        return b.map(function (v, i) { return nudge[i] != null ? r1(clampV(v + nudge[i])) : v; });
      }
      function drawDots() {
        var box = k.step() === 0 ? TALL : TOP;
        dotsLayer.clear();
        if (nMoved) {
          // a faint stroke from where each moved day started to where it is now
          var base = baseSeries();
          for (var j in nudge) {
            var x = tx(+j + 1).toFixed(1);
            dotsLayer.path('M' + x + ' ' + yv(base[j], box).toFixed(1) + ' L' + x + ' ' + yv(series[j], box).toFixed(1), { w: 0.6, op: 0.4 });
          }
        }
        dotsLayer.polyline(series.map(function (v, i) { return [tx(i + 1), yv(v, box)]; }), { w: 0.6, op: 0.25 });
        series.forEach(function (v, i) { dotsLayer.dot(tx(i + 1), yv(v, box), box === TALL ? 2.1 : 1.8, { op: 0.85 }); });
        if (k.step() === 4) placeRise();
      }

      /* ================= step 0: where did it change? ================= */
      var g0 = k.root.group({ steps: [0], d: 300 });
      g0.text(SIDE, 60, 'normal level', { kind: 'label' });
      g0.text(SIDE + 158, 60, '10', { kind: 'val', anchor: 'end' });
      var rows0 = ['your guess', 'it changed on', 'off by'].map(function (name, i) {
        g0.text(SIDE, 84 + i * 20, name, { kind: 'label' });
        return g0.text(SIDE + 158, 84 + i * 20, '–', { kind: 'val', anchor: 'end' });
      });
      g0.line(SIDE, 136, SIDE + 158, 136, { w: 0.6, op: 0.45, rough: 0.3 });
      var ask0 = k.root.group({ steps: [0], d: 500 });
      var ask0a = ask0.group({ d: 500 });
      ask0a.callout('a', 'did it rise? when?', SIDE, 172);
      ask0a.text(SIDE, 204, 'click the first day', { kind: 'hand' });
      ask0a.text(SIDE, 226, 'of the new level.', { kind: 'hand' });

      // the guide that follows the pointer, and the reader's guess
      var hoverG = k.root.layer({ steps: [0] });
      hoverG.line(0, TALL.y, 0, TALL.y + TALL.h, { w: 0.6, op: 0.5, rough: 0.1 });
      var hoverT = hoverG.text(4, TALL.y + 12, '', { kind: 'axis' });
      hoverG.node.style.display = 'none';
      var guessG = k.root.layer({ steps: [0] });
      guessG.line(0, TALL.y, 0, TALL.y + TALL.h, { w: 1.1, op: 0.85, rough: 0.3 });
      guessG.paper(-36, TALL.y + 4, 72, 14);
      guessG.text(0, TALL.y + 15, 'your guess', { kind: 'label', anchor: 'middle' });
      guessG.node.style.display = 'none';
      // the answer, drawn in when it is revealed
      var reveal = hideable(k.root.group({ steps: [0] }));
      reveal.line(cx, TALL.y, cx, TALL.y + TALL.h, { accent: true, w: 1.6, op: 0.95, rough: 0.3, d: 0, dur: 700 });
      reveal.paper(cx - 40, TALL.y + 20, 80, 14, { d: 300 });
      reveal.text(cx, TALL.y + 31, 'it changed', { kind: 'label', anchor: 'middle', accent: true, d: 300 });
      reveal.line(cx, yv(MU + SHIFT, TALL), X0 + PW, yv(MU + SHIFT, TALL), { w: 1.1, op: 0.7, rough: 0.3, d: 600 });
      reveal.text(X0 + PW - 4, yv(MU + SHIFT, TALL) - 6, 'new level 10.5', { kind: 'axis', anchor: 'end', d: 800 });
      var after0 = hideable(k.root.group({ steps: [0] }));
      after0.text(SIDE, 204, 'a small, steady rise', { kind: 'hand', d: 900 });
      after0.text(SIDE, 226, 'hides in the noise.', { kind: 'hand', d: 1200 });
      var bAgain = k.button(SIDE, 268, 'guess again', function () { save(STORE_GUESS, null, 'ink:change-guess'); enter0(); }, { steps: [0] });

      var hit0 = raw('rect', { x: X0, y: TALL.y, width: PW, height: TALL.h, 'class': 'ik-hit' }, k.root.node);
      hit0.style.cursor = 'crosshair';
      k.root.node.insertBefore(hit0, dotsLayer.node);
      var myGuess = null;
      hit0.addEventListener('pointermove', function (e) {
        if (k.step() !== 0 || myGuess !== null) return;
        var d = dayAt(k.toFigure(e).x);
        hoverG.node.style.display = '';
        hoverG.node.setAttribute('transform', 'translate(' + tx(d).toFixed(1) + ' 0)');
        hoverT.set('day ' + d);
      });
      hit0.addEventListener('pointerleave', function () { hoverG.node.style.display = 'none'; });
      hit0.addEventListener('click', function (e) {
        if (k.step() !== 0 || myGuess !== null) return;
        myGuess = dayAt(k.toFigure(e).x);
        save(STORE_GUESS, myGuess, 'ink:change-guess');
        show0();
      });
      function show0() {
        var has = myGuess !== null;
        hoverG.node.style.display = 'none';
        guessG.node.style.display = has ? '' : 'none';
        if (has) guessG.node.setAttribute('transform', 'translate(' + tx(myGuess).toFixed(1) + ' 0)');
        rows0[0].set(has ? 'day ' + myGuess : '–');
        rows0[1].set(has ? 'day ' + (LAST_NORMAL + 1) : '–');
        rows0[2].set(has ? Math.abs(myGuess - (LAST_NORMAL + 1)) + ' days' : '–');
        show(reveal, has); show(after0, has);
        ask0a.node.style.display = has ? 'none' : '';
        bAgain.node.style.display = has ? '' : 'none';
        hit0.style.pointerEvents = !has && k.step() === 0 ? 'auto' : 'none';
      }
      function enter0() { myGuess = guess(); show0(); }

      /* ================= step 1: a running score, one day at a time ================= */
      var plain = scores(OUTPUT, 0, false);
      var g1 = k.root.group({ steps: [1], d: 300 });
      var names1 = ['day', 'output', 'minus normal', 'excess', 'yesterday', 'score'];
      var rows1 = names1.map(function (name, i) {
        g1.text(SIDE, 60 + i * 20, name, { kind: 'label' });
        return g1.text(SIDE + 158, 60 + i * 20, '–', { kind: 'val', anchor: 'end' });
      });
      g1.line(SIDE, 107, SIDE + 158, 107, { w: 0.6, op: 0.45, rough: 0.3 });   // output - 10 = excess
      g1.line(SIDE, 147, SIDE + 158, 147, { w: 0.6, op: 0.45, rough: 0.3 });   // yesterday + excess = score
      var l1 = k.root.layer({ steps: [1] });
      var bar1 = raw('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, l1.node);
      var ring1 = raw('circle', { r: 5, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.1 }, l1.node);
      var path1 = raw('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: 0.9 }, l1.node);
      var dot1 = raw('circle', { r: 3.4, fill: 'currentColor', 'class': 'ik-accent' }, l1.node);
      var day = 0;
      function scoreAt(d) { return d <= 0 ? 0 : plain[d - 1]; }
      function drawDay(t) {
        var pts = [[tx(0), ys(0, SC12)]];
        for (var d = 1; d < day; d++) pts.push([tx(d), ys(plain[d - 1], SC12)]);
        var end = [tx(day), ys(scoreAt(day - 1) + (scoreAt(day) - scoreAt(day - 1)) * t, SC12)];
        if (day > 0) pts.push([tx(day - 1) + (end[0] - tx(day - 1)) * t, end[1]]);
        path1.setAttribute('d', pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' '));
        var last = pts[pts.length - 1];
        dot1.setAttribute('cx', last[0].toFixed(1)); dot1.setAttribute('cy', last[1].toFixed(1));
        if (day > 0) {
          var x = tx(day), y = yv(OUTPUT[day - 1], TOP);
          ring1.style.display = bar1.style.display = '';
          ring1.setAttribute('cx', x.toFixed(1)); ring1.setAttribute('cy', y.toFixed(1));
          var y0 = yv(MU, TOP);
          bar1.setAttribute('d', 'M' + x.toFixed(1) + ' ' + y0.toFixed(1) + ' L' + x.toFixed(1) + ' ' + (y0 + (y - y0) * t).toFixed(1));
        } else { ring1.style.display = bar1.style.display = 'none'; }
      }
      function readout1() {
        if (day === 0) { rows1.forEach(function (r, i) { r.set(i === 0 ? '0 of 50' : i === 5 ? '0' : '–'); }); return; }
        var x = OUTPUT[day - 1];
        rows1[0].set(day + ' of 50');
        rows1[1].set(d1(x));
        rows1[2].set('− 10');
        rows1[3].set(signed(x - MU));
        rows1[4].set(signed(scoreAt(day - 1)));
        rows1[5].set(signed(scoreAt(day)));
      }
      function advance(ms, done) {
        if (day >= N) { if (done) done(); return; }
        day++; readout1(); label1();
        busy = true;
        cancel = k.animate(ms, function (t) { drawDay(t); if (t >= 1) { busy = false; cancel = null; if (done) done(); } });
      }
      var bNext = k.button(SIDE, 190, 'next day', function () { if (!busy) advance(380); }, { steps: [1] });
      var bRun = k.button(SIDE, 226, 'run to the end', function () {
        if (busy) return;
        (function loop() { if (k.step() !== 1 || day >= N) return; advance(150, function () { setTimeout(loop, 30); }); })();
      }, { steps: [1] });
      k.button(SIDE, 262, 'start over', function () { stop(); enter1(); }, { steps: [1] });
      k.root.group({ steps: [1], d: 600 }).callout('b', 'add each day’s excess', SIDE, 304);
      var hand1 = k.root.group({ steps: [1], d: 900 });
      hand1.text(SIDE, 340, 'days below normal', { kind: 'hand' });
      hand1.text(SIDE, 362, 'pull it back down.', { kind: 'hand' });
      function label1() {
        bNext.node.style.display = bRun.node.style.display = day >= N ? 'none' : '';
      }
      function enter1() { day = 0; drawDay(1); readout1(); label1(); }

      /* ================= step 2: two fixes ================= */
      var floorOn = false, allowOn = false, cur = plain.slice();
      var g2 = k.root.group({ steps: [2], d: 300 });
      var rows2 = ['lowest (1-30)', 'highest (1-30)', 'on day 30'].map(function (name, i) {
        g2.text(SIDE, 60 + i * 20, name, { kind: 'label' });
        return g2.text(SIDE + 158, 60 + i * 20, '', { kind: 'val', anchor: 'end' });
      });
      g2.line(SIDE, 112, SIDE + 158, 112, { w: 0.6, op: 0.45, rough: 0.3 });
      var l2 = k.root.layer({ steps: [2] });
      l2.polyline(plain.map(function (v, i) { return [tx(i + 1), ys(v, SC12)]; }), { w: 0.8, op: 0.35 });
      var path2 = raw('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'class': 'ik-accent' }, l2.node);
      function drawCurve(vals) {
        path2.setAttribute('d', vals.map(function (v, i) { return (i ? 'L' : 'M') + tx(i + 1).toFixed(1) + ' ' + ys(v, SC12).toFixed(1); }).join(' '));
      }
      var state2 = g2.group({ d: 0 });
      var on1 = state2.text(SIDE + 158, 150, 'off', { kind: 'axis', anchor: 'end' });
      var on2 = state2.text(SIDE + 158, 186, 'off', { kind: 'axis', anchor: 'end' });
      k.button(SIDE, 150, 'never below zero', function () { floorOn = !floorOn; morph(); }, { steps: [2] });
      k.button(SIDE, 186, 'allow 0.25 a day', function () { allowOn = !allowOn; morph(); }, { steps: [2] });
      k.root.group({ steps: [2], d: 600 }).callout('c', 'try each, then both', SIDE, 232);
      var hand2a = k.root.group({ steps: [2], d: 900 }).text(SIDE, 268, '', { kind: 'hand' });
      var hand2b = k.root.group({ steps: [2], d: 1100 }).text(SIDE, 290, '', { kind: 'hand' });
      function readout2(vals) {
        var pre = vals.slice(0, LAST_NORMAL);
        rows2[0].set(signed(Math.min.apply(null, pre), 2));
        rows2[1].set(signed(Math.max.apply(null, pre), 2));
        rows2[2].set(signed(vals[LAST_NORMAL - 1], 2));
        on1.set(floorOn ? 'on' : 'off'); on2.set(allowOn ? 'on' : 'off');
        var say = floorOn && allowOn ? ['quiet until', 'the change.'] : floorOn ? ['now ordinary noise', 'piles up.'] :
          allowOn ? ['the hole gets', 'even deeper.'] : ['quiet days sink it', 'below zero.'];
        hand2a.set(say[0]); hand2b.set(say[1]);
      }
      function morph() {
        stop();
        var from = cur.slice(), to = scores(OUTPUT, allowOn ? C0 : 0, floorOn);
        readout2(to);
        busy = true;
        cancel = k.animate(650, function (t) {
          cur = from.map(function (v, i) { return v + (to[i] - v) * t; });
          drawCurve(cur);
          if (t >= 1) { cur = to; busy = false; cancel = null; }
        });
      }
      function enter2() { floorOn = allowOn = false; cur = plain.slice(); drawCurve(cur); readout2(cur); }

      /* ================= steps 3 and 4: the alarm line ================= */
      var kn = knobs(), C = kn.C, T = kn.T;
      var g3 = k.root.group({ steps: [3, 4], d: 300 });
      var rows3 = ['changed on', 'alarm on', 'days to catch', 'false alarms', 'your guess'].map(function (name, i) {
        g3.text(SIDE, 60 + i * 20, name, { kind: 'label' });
        return g3.text(SIDE + 158, 60 + i * 20, '', { kind: 'val', anchor: 'end' });
      });
      g3.line(SIDE, 152, SIDE + 158, 152, { w: 0.6, op: 0.45, rough: 0.3 });
      var l3 = k.root.layer({ steps: [3, 4] });

      /* the days themselves, grabbed in the top chart. One hit area finds the nearest day; it sits under the
         alarm line and the new-level handle, so a press on either of those still grabs the handle. */
      var hitP = raw('rect', { x: X0, y: TOP.y, width: PW, height: TOP.h, 'class': 'ik-hit' }, k.root.node);
      hitP.style.touchAction = 'none';
      hitP.style.pointerEvents = 'none';
      var heldDay = -1, frame = 0;
      function nearestDay(p) {
        var best = -1, bd = 11 * 11;
        for (var i = 0; i < N; i++) {
          var dx = tx(i + 1) - p.x, dy = yv(series[i], TOP) - p.y, d = dx * dx + dy * dy;
          if (d <= bd) { bd = d; best = i; }
        }
        return best;
      }
      function valueAt(y) { return r1(clampV(VLO + (TOP.y + TOP.h - y) / TOP.h * (VHI - VLO))); }
      function refreshPoints() {
        frame = 0;
        series = currentSeries(); drawDots(); redraw3(); syncMoved();
      }
      hitP.addEventListener('pointerdown', function (e) {
        if (e.button || k.step() < 3) return;
        var i = nearestDay(k.toFigure(e));
        if (i < 0) return;
        e.preventDefault();
        try { hitP.setPointerCapture(e.pointerId); } catch (err) {}
        heldDay = i; hitP.style.cursor = 'grabbing';
      });
      hitP.addEventListener('pointermove', function (e) {
        var p = k.toFigure(e);
        if (heldDay < 0) { hitP.style.cursor = nearestDay(p) >= 0 ? 'grab' : ''; return; }
        var d = r1(valueAt(p.y) - baseSeries()[heldDay]);
        if (Math.abs(d) < 0.05) delete nudge[heldDay]; else nudge[heldDay] = d;
        nMoved = Object.keys(nudge).length;
        if (!frame) frame = requestAnimationFrame(refreshPoints);
      });
      function letGo() {
        if (heldDay < 0) return;
        heldDay = -1; hitP.style.cursor = 'grab';
        if (frame) { cancelAnimationFrame(frame); refreshPoints(); }
      }
      hitP.addEventListener('pointerup', letGo);
      hitP.addEventListener('pointercancel', letGo);

      /* the alarm line itself: drawn once, moved with a transform, and grabbed to set the threshold */
      var alarmG = k.root.group({ steps: [3, 4], d: 0 });
      alarmG.line(X0, 0, X0 + PW, 0, { w: 1.1, op: 0.75, rough: 0.3 });
      var alarmLabel = alarmG.group({ d: 0 });
      alarmLabel.paper(X0 + 6, -16, 70, 13);
      alarmLabel.text(X0 + 8, -6, 'alarm line', { kind: 'axis' });
      alarmG.circle(X0 + PW, 0, 6, { w: 1.4, op: 0.95 });
      alarmG.dot(X0 + PW, 0, 2, {});
      raw('rect', { x: X0, y: -10, width: PW + 16, height: 20, 'class': 'ik-hit' }, alarmG.node);
      function tAt(y) { return Math.round((SC3.lo + (BOT.y + BOT.h - y) / BOT.h * (SC3.hi - SC3.lo)) * 10) / 10; }
      var alarmDrag = k.draggable(alarmG.node, {
        x: X0 + PW, y: ys(T, SC3), label: 'The alarm line. Up and down arrow keys move it.',
        bounds: { x0: X0 + PW, y0: ys(5, SC3), x1: X0 + PW, y1: ys(0.5, SC3) },
        onMove: function (x, y) {
          var v = Math.max(0.5, Math.min(5, tAt(y)));
          if (v === T) return;
          T = v; tSlider.set(v, true); keep(); redraw3();
        }
      });
      function placeAlarm() {
        var y = ys(T, SC3);
        alarmG.node.setAttribute('transform', 'translate(0 ' + y.toFixed(1) + ')');
        alarmLabel.node.setAttribute('transform', y - 6 < BOT.y + 10 ? 'translate(0 20)' : '');
        alarmDrag.set(X0 + PW, y);
      }

      /* step 4: the new level after day 30, grabbed to set the size of the rise */
      var riseG = k.root.group({ steps: [4], d: 0 });
      riseG.line(cx, 0, X0 + PW, 0, { w: 1.1, op: 0.7, rough: 0.3 });
      riseG.paper(X0 + PW - 70, -17, 66, 13);
      riseG.text(X0 + PW - 4, -7, 'new level', { kind: 'axis', anchor: 'end' });
      riseG.circle(X0 + PW, 0, 6, { w: 1.4, op: 0.95 });
      riseG.dot(X0 + PW, 0, 2, {});
      raw('rect', { x: cx, y: -10, width: X0 + PW + 16 - cx, height: 20, 'class': 'ik-hit' }, riseG.node);
      function riseAt(y) { return Math.round((VLO + (TOP.y + TOP.h - y) / TOP.h * (VHI - VLO) - MU) * 20) / 20; }
      var riseDrag = k.draggable(riseG.node, {
        x: X0 + PW, y: yv(MU + SHIFT, TOP), label: 'The new level after day 30. Up and down arrow keys move it.',
        bounds: { x0: X0 + PW, y0: yv(MU + 1, TOP), x1: X0 + PW, y1: yv(MU, TOP) },
        onMove: function (x, y) {
          if (k.step() !== 4) return;
          var v = Math.max(0, Math.min(1, riseAt(y)));
          if (v === shift) return;
          shiftSlider.set(v, true); setShift(v);
        }
      });
      function placeRise() {
        var y = yv(MU + shift, TOP);
        riseG.node.setAttribute('transform', 'translate(0 ' + y.toFixed(1) + ')');
        riseDrag.set(X0 + PW, y);
      }
      function setShift(v) { shift = v; series = currentSeries(); drawDots(); redraw3(); }

      function redraw3() {
        var m = watch(series, C, T), i;
        l3.clear();
        var under = [[tx(1), ys(0, SC3)]];
        for (i = 0; i < N; i++) under.push([tx(i + 1), ys(m.S[i], SC3)]);
        under.push([tx(N), ys(0, SC3)]);
        l3.hatch(under, { op: 0.26, gap: 4.5 });
        // the curve, with each alarm's drop back to zero drawn as part of it
        var pts = [];
        for (i = 0; i < N; i++) {
          pts.push([tx(i + 1), ys(m.S[i], SC3)]);
          if (m.alarms.indexOf(i + 1) >= 0 && i < N - 1) pts.push([tx(i + 1), ys(0, SC3)]);
        }
        l3.polyline(pts, { w: 1.5, op: 0.9 });
        placeAlarm();
        m.alarms.forEach(function (d) {
          var y = ys(m.S[d - 1], SC3);
          if (d <= LAST_NORMAL) l3.mark(tx(d), y, 'x', { r: 4.5, w: 1.3 });
          else if (d !== m.detected) l3.mark(tx(d), y, 'o', { r: 3 });
        });
        if (m.detected !== null) {
          var dx = tx(m.detected);
          l3.line(dx, BOT.y, dx, BOT.y + BOT.h, { accent: true, w: 1.3, op: 0.9, rough: 0.3 });
          l3.circle(dx, ys(m.S[m.detected - 1], SC3), 5.5, { accent: true, w: 1.4, op: 0.95 });
        }
        var g = guess();
        rows3[0].set('day ' + (LAST_NORMAL + 1));
        rows3[1].set(m.detected === null ? 'never' : 'day ' + m.detected);
        rows3[2].set(m.detected === null ? '–' : String(m.detected - LAST_NORMAL));
        rows3[3].set(String(m.falseAlarms.length));
        rows3[4].set(g === null ? '–' : 'day ' + g);
      }
      function keep() { save(STORE_KNOBS, { C: C, T: T }, 'ink:change-knobs'); }
      k.slider({ x: SIDE, y: 196, w: 158, min: 0, max: 0.6, step: 0.05, value: C, label: 'allowance', steps: [3, 4],
        format: function (v) { return v.toFixed(2); }, onChange: function (v) { C = v; keep(); redraw3(); } });
      var tSlider = k.slider({ x: SIDE, y: 246, w: 158, min: 0.5, max: 5, step: 0.1, value: T, label: 'alarm line', steps: [3, 4],
        format: function (v) { return v.toFixed(1); }, onChange: function (v) { T = v; keep(); redraw3(); } });
      var shiftSlider = k.slider({ x: SIDE, y: 296, w: 158, min: 0, max: 1, step: 0.05, value: SHIFT, label: 'size of the rise', steps: [4],
        format: function (v) { return v.toFixed(2); }, onChange: function (v) { setShift(v); } });
      k.root.group({ steps: [3], d: 600 }).callout('d', 'faster, or fewer alarms?', SIDE, 296);
      var g4 = k.root.group({ steps: [4], d: 500 });
      g4.callout('e', 'a smaller rise', SIDE, 336);
      g4.text(SIDE, 366, 'takes longer', { kind: 'hand', d: 900 });
      g4.text(SIDE, 388, 'to catch.', { kind: 'hand', d: 1100 });

      /* once a day has moved: an honest note, and the way back. Nothing is saved; a reload restores the days. */
      var movedG = k.root.group({ steps: [3, 4], d: 0 });
      movedG.text(SIDE, 330, 'points moved: the numbers', { kind: 'axis' });
      movedG.text(SIDE, 344, 'in the text are for the', { kind: 'axis' });
      movedG.text(SIDE, 358, 'original points.', { kind: 'axis' });
      var bBack = k.button(SIDE, 392, 'put the points back', function () {
        nudge = {}; nMoved = 0; refreshPoints();
      }, { steps: [3, 4] });
      function syncMoved() {
        var on = nMoved > 0;
        movedG.node.style.display = bBack.node.style.display = on ? '' : 'none';
        g4.node.style.display = on ? 'none' : '';
      }

      window.addEventListener('ink:change-guess', function () { if (k.step() >= 3) redraw3(); });

      k.onStep(function (step) {
        stop();
        hit0.style.pointerEvents = 'none';
        if (step < 3) { nudge = {}; nMoved = 0; }
        hitP.style.pointerEvents = step >= 3 ? 'auto' : 'none';
        heldDay = -1;
        syncMoved();
        shift = step === 4 ? shiftSlider.value : SHIFT;
        series = currentSeries();
        drawDots();
        if (step === 0) enter0();
        else if (step === 1) enter1();
        else if (step === 2) enter2();
        else redraw3();
      });
    }
  });
})();
