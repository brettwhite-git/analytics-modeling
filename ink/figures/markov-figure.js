/* Markov figure — a three-state chain, stepped forward one day at a time.
   Three hand-ruled states joined by stitched arrows, each labelled with its transition probability (the
   weather matrix used in the R on the page). Beside it, three hatched bars hold the chance of being in each
   state: every press of "step" multiplies that row vector by the transition matrix. The steady state is
   found by doing the same multiplication until nothing changes, so the marks the bars settle on are computed.
   Steps: 0 the problem (today is known; what about later?) · 1 one day at a time (step button, and the sum
          behind one bar) ·
          2 the steady state: start from another state and the bars come back to the same marks.
   Illustration: made-up probabilities. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var SIDE = 462, COL = 158;                         // the column beside the diagram
  var NAMES = ['sunny', 'cloudy', 'rainy'];
  var P = [                                          // row = today, column = tomorrow
    [0.70, 0.20, 0.10],
    [0.30, 0.40, 0.30],
    [0.20, 0.45, 0.35]
  ];
  var NODE = [{ x: 240, y: 140 }, { x: 122, y: 326 }, { x: 358, y: 326 }], R = 32;
  var BAR = { y0: 190, h: 124, w: 34, cx: [SIDE + 27, SIDE + 79, SIDE + 131] };
  var SETTLED = 20;                                  // days the last step runs forward

  function stepOnce(pi) {                            // pi P
    var out = [0, 0, 0];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) out[j] += pi[i] * P[i][j];
    return out;
  }
  function after(start, days) {
    var pi = [0, 0, 0];
    pi[start] = 1;
    for (var d = 0; d < days; d++) pi = stepOnce(pi);
    return pi;
  }
  function gap(a, b) { return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])); }
  /* the steady state: keep multiplying until the vector stops moving */
  function steady() {
    var pi = [1 / 3, 1 / 3, 1 / 3], next;
    for (var it = 0; it < 10000; it++) {
      next = stepOnce(pi);
      if (gap(next, pi) < 1e-13) return next;
      pi = next;
    }
    return pi;
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function pr(p, digits) { return p.toFixed(digits || 2).replace(/^0\./, '.'); }

  window.InkKit.define('markov-figure', {
    label: 'A Markov chain with three states, sunny, cloudy and rainy, joined by arrows labelled with ' +
      'transition probabilities. Bars beside it show the chance of each state after a number of days.',
    steps: 3,
    seed: 31,
    draw: function (k) {
      var STAR = steady();
      var start = 0, days = 0, stopTween = null;
      var cen = { x: (NODE[0].x + NODE[1].x + NODE[2].x) / 3, y: (NODE[0].y + NODE[1].y + NODE[2].y) / 3 };

      /* ---- the chain: three states, nine stitched arrows ---- */
      var chain = k.root.group({ d: 100, stagger: 70 });
      chain.text(44, 44, 'one day to the next', { kind: 'label', d: 0 });
      function head(x, y, ang) {
        [-0.42, 0.42].forEach(function (da) {
          chain.line(x, y, x - 7.5 * Math.cos(ang + da), y - 7.5 * Math.sin(ang + da), { w: 1, rough: 0.3, op: 0.65 });
        });
      }
      NODE.forEach(function (n, i) {
        chain.circle(n.x, n.y, R, { w: 1.4, op: 0.9 });
        chain.text(n.x, n.y + 3.5, NAMES[i], { kind: 'label', anchor: 'middle' });
      });
      NODE.forEach(function (a, i) {
        NODE.forEach(function (b, j) {
          if (i === j) {
            // staying put: a loop on the outside of the triangle
            var phi = Math.atan2(a.y - cen.y, a.x - cen.x), far = R + 46;
            var p1 = [a.x + (R + 4) * Math.cos(phi - 0.52), a.y + (R + 4) * Math.sin(phi - 0.52)];
            var p2 = [a.x + (R + 6) * Math.cos(phi + 0.52), a.y + (R + 6) * Math.sin(phi + 0.52)];
            var c1 = [a.x + far * Math.cos(phi - 0.62), a.y + far * Math.sin(phi - 0.62)];
            var c2 = [a.x + far * Math.cos(phi + 0.62), a.y + far * Math.sin(phi + 0.62)];
            chain.thread('M' + r1(p1[0]) + ' ' + r1(p1[1]) + ' C' + r1(c1[0]) + ' ' + r1(c1[1]) + ' ' + r1(c2[0]) + ' ' + r1(c2[1]) + ' ' + r1(p2[0]) + ' ' + r1(p2[1]));
            head(p2[0], p2[1], Math.atan2(p2[1] - c2[1], p2[0] - c2[0]));
            chain.text(a.x + (R + 50) * Math.cos(phi), a.y + (R + 50) * Math.sin(phi) + 4, pr(P[i][j]), { kind: 'val', anchor: 'middle' });
            return;
          }
          // moving on: a bowed arrow; the two directions bow apart
          var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
          var nx = uy, ny = -ux, bow = 24;
          var cx = (a.x + b.x) / 2 + nx * bow, cy = (a.y + b.y) / 2 + ny * bow;
          var la = Math.sqrt((cx - a.x) * (cx - a.x) + (cy - a.y) * (cy - a.y)), lb = Math.sqrt((cx - b.x) * (cx - b.x) + (cy - b.y) * (cy - b.y));
          var s = [a.x + (cx - a.x) / la * (R + 5), a.y + (cy - a.y) / la * (R + 5)];
          var e = [b.x + (cx - b.x) / lb * (R + 7), b.y + (cy - b.y) / lb * (R + 7)];
          chain.thread('M' + r1(s[0]) + ' ' + r1(s[1]) + ' Q' + r1(cx) + ' ' + r1(cy) + ' ' + r1(e[0]) + ' ' + r1(e[1]));
          head(e[0], e[1], Math.atan2(e[1] - cy, e[0] - cx));
          var mx = 0.25 * s[0] + 0.5 * cx + 0.25 * e[0], my = 0.25 * s[1] + 0.5 * cy + 0.25 * e[1];
          chain.text(mx + nx * 15, my + ny * 15 + 4, pr(P[i][j]), { kind: 'val', anchor: 'middle' });
        });
      });

      /* ---- beside it: the chance of each state, as bars ---- */
      var frame = k.root.group({ d: 300 });
      frame.line(SIDE, BAR.y0, SIDE + COL, BAR.y0, { w: 1.1 });
      NAMES.forEach(function (name, i) { frame.text(BAR.cx[i], BAR.y0 + 15, name, { kind: 'label', anchor: 'middle' }); });
      var live = k.root.layer();
      var ring = k.root.layer();

      var settle = k.root.group({ steps: [2], d: 300 });
      settle.line(SIDE, 216, SIDE + COL, 216, { w: 0.6, op: 0.45, rough: 0.3 });
      settle.text(SIDE, 234, 'steady state', { kind: 'label' });
      STAR.forEach(function (p, i) {
        settle.text(BAR.cx[i], 252, p.toFixed(3), { kind: 'val', anchor: 'middle' });
        var y = BAR.y0 - p * BAR.h;
        settle.line(BAR.cx[i] - 23, y, BAR.cx[i] + 23, y, { accent: true, w: 1.6, rough: 0.3, op: 1, d: 500 + i * 120 });
      });
      settle.text(SIDE, 274, 'largest gap', { kind: 'label' });
      var gapVal = settle.text(SIDE + COL, 274, '', { kind: 'val', anchor: 'end' });

      function redraw() {
        var st = k.step(), pi = after(start, days);
        live.clear();
        live.text(SIDE, 44, 'start ' + NAMES[start], { kind: 'label' });
        live.text(SIDE + COL, 44, 'day ' + days, { kind: 'val', anchor: 'end' });
        pi.forEach(function (p, i) {
          var x = BAR.cx[i] - BAR.w / 2, h = p * BAR.h, y = BAR.y0 - h;
          if (h > 1.5) {
            if (h > 5) live.hatch([[x, y], [x + BAR.w, y], [x + BAR.w, BAR.y0], [x, BAR.y0]], { op: 0.45 });
            live.poly([[x, BAR.y0], [x, y], [x + BAR.w, y], [x + BAR.w, BAR.y0]], { accent: st === 1, w: 1.2, rough: 0.3, op: 0.95 });
          }
          live.text(BAR.cx[i], y - 7, p.toFixed(2), { kind: 'val', anchor: 'middle' });
        });
        if (st === 1) {
          // the sum behind one bar of the next day: every way of arriving in "sunny", weighted by where you are now
          live.text(SIDE, 350, 'next day, sunny', { kind: 'label' });
          live.text(SIDE, 368, pr(pi[0], 3) + '×' + pr(P[0][0]) + ' + ' + pr(pi[1], 3) + '×' + pr(P[1][0]), { kind: 'val' });
          live.text(SIDE, 385, '+ ' + pr(pi[2], 3) + '×' + pr(P[2][0]) + ' = ' + stepOnce(pi)[0].toFixed(3), { kind: 'val' });
        }
        ring.clear();
        ring.circle(NODE[start].x, NODE[start].y, R - 6, { accent: st === 0, w: st === 0 ? 1.5 : 0.8, op: st === 0 ? 1 : 0.6 });
        gapVal.set(gap(pi, STAR).toFixed(3));
        startBtn.set('start from ' + NAMES[(start + 1) % 3]);
      }
      function halt() { if (stopTween) { stopTween(); stopTween = null; } }

      k.button(SIDE, 306, 'step one day', function () { halt(); days++; redraw(); }, { steps: [1, 2] });
      var startBtn = k.button(SIDE, 336, 'start from cloudy', function () {
        // a new starting state, then twenty days run forward: it comes back to the same marks
        halt();
        start = (start + 1) % 3; days = 0; redraw();
        stopTween = k.animate(2200, function (t) {
          var d = Math.round(t * SETTLED);
          if (d !== days) { days = d; redraw(); }
        });
      }, { steps: [2] });

      k.root.group({ steps: [0] }).callout('a', 'sunny today. and later?', SIDE, 250, { to: [NODE[0].x + R + 4, NODE[0].y - 18], d: 900 });
      k.root.group({ steps: [1] }).callout('b', 'each day: multiply by P', SIDE, 250, { d: 500 });
      var g2 = k.root.group({ steps: [2], d: 300 });
      g2.callout('c', 'every start ends here', SIDE, 372, { d: 500 });
      g2.text(SIDE, 400, 'the chain forgets', { kind: 'hand', d: 900 });
      g2.text(SIDE, 422, 'where it began.', { kind: 'hand', d: 1300 });

      k.onStep(function (step) {
        halt();
        start = 0;
        days = step === 2 ? SETTLED : 0;
        redraw();
      });
    }
  });
})();
