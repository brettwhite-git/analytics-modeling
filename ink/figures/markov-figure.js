/* Markov figure — three kinds of weather, and tomorrow decided only by today.
   Three hand-ruled states joined by stitched arrows, each labelled with its chance (the weather table used in
   the R on the page: row = today, column = tomorrow). Beside it, three hatched bars hold the chance of each
   kind of weather on the day shown. One day forward: for each kind of weather, add up every way of arriving
   in it (chance of being there today x chance of moving), exactly the sum the lesson's Python writes out.
   Steps: 0 one day at a time from a sunny start, with the sum behind tomorrow's "sunny" bar written out;
          1 start from sunny, cloudy or rainy: each start runs twenty days and leaves its line on a small chart
            of "chance of sun"; every start ends on the same long-run shares, which are marked once found.
   Illustration: made-up chances. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var SIDE = 462, COL = 158;
  var NAMES = ['sunny', 'cloudy', 'rainy'];
  var P = [                                          // row = today, column = tomorrow
    [0.70, 0.20, 0.10],
    [0.30, 0.40, 0.30],
    [0.20, 0.45, 0.35]
  ];
  var NODE = [{ x: 240, y: 140 }, { x: 122, y: 326 }, { x: 358, y: 326 }], R = 32;
  var BAR = { y0: 176, h: 104, w: 34, cx: [SIDE + 27, SIDE + 79, SIDE + 131] };
  var DAYS = 20;
  var CH = { x0: SIDE + 20, x1: SIDE + 152, y0: 392, y1: 322 };   // the small chart in step 1 (y0 is the bottom)

  function nextDay(pi) {                             // tomorrow = every way in, added up
    var out = [0, 0, 0];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) out[j] += pi[i] * P[i][j];
    return out;
  }
  function path(start, days) {
    var pi = [0, 0, 0], out = [];
    pi[start] = 1; out.push(pi);
    for (var d = 0; d < days; d++) { pi = nextDay(pi); out.push(pi); }
    return out;
  }
  function longRun() {
    var pi = [1, 0, 0];
    for (var it = 0; it < 500; it++) pi = nextDay(pi);
    return pi;
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function pr(p, digits) { return p.toFixed(digits || 2).replace(/^0\./, '.'); }

  window.InkKit.define('markov-figure', {
    label: 'Three kinds of weather, sunny, cloudy and rainy, joined by arrows labelled with the chance of moving ' +
      'from one to another overnight. Bars beside it show the chance of each kind of weather on the day shown.',
    steps: 2,
    seed: 31,
    draw: function (k) {
      var STAR = longRun();
      var start = 0, days = 0, stop = null, tried = {};
      var cen = { x: (NODE[0].x + NODE[1].x + NODE[2].x) / 3, y: (NODE[0].y + NODE[1].y + NODE[2].y) / 3 };

      /* ---- the chain ---- */
      var chain = k.root.group({ d: 100, stagger: 70 });
      chain.text(44, 44, 'today → tomorrow', { kind: 'label', d: 0 });
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
      var ring = k.root.layer();

      /* ---- the bars ---- */
      var frame = k.root.group({ d: 300 });
      frame.line(SIDE, BAR.y0, SIDE + COL, BAR.y0, { w: 1.1 });
      NAMES.forEach(function (name, i) { frame.text(BAR.cx[i], BAR.y0 + 15, name, { kind: 'label', anchor: 'middle' }); });
      var live = k.root.layer();
      var marks = k.root.layer({ steps: [1] });

      /* ---- step 0: the sum behind tomorrow's sunny bar ---- */
      var sum0 = k.root.layer({ steps: [0] });
      k.root.group({ steps: [0], d: 600 }).callout('a', 'add up every way in', SIDE, 384);
      var h0 = k.root.group({ steps: [0], d: 900 });
      h0.text(SIDE, 414, 'only today matters.', { kind: 'hand' });

      /* ---- step 1: a small chart of the chance of sun, one line per start ---- */
      var c1 = k.root.group({ steps: [1], d: 300 });
      c1.text(SIDE, CH.y1 - 12, 'chance of sun, by day', { kind: 'label' });
      c1.line(CH.x0, CH.y0, CH.x1, CH.y0, { w: 0.9, rough: 0.3 });
      c1.line(CH.x0, CH.y0, CH.x0, CH.y1, { w: 0.9, rough: 0.3 });
      c1.text(CH.x0 - 5, CH.y1 + 4, '1', { kind: 'axis', anchor: 'end' });
      c1.text(CH.x0 - 5, CH.y0 + 3, '0', { kind: 'axis', anchor: 'end' });
      c1.text(CH.x0, CH.y0 + 14, '0', { kind: 'axis', anchor: 'middle' });
      c1.text(CH.x1, CH.y0 + 14, DAYS + ' days', { kind: 'axis', anchor: 'end' });
      var chart = k.root.layer({ steps: [1] });
      var csx = k.scale(0, DAYS, CH.x0, CH.x1), csy = k.scale(0, 1, CH.y0, CH.y1);
      var c1b = k.root.group({ steps: [1], d: 600 });
      c1b.callout('b', 'every start ends here', 120, 430);

      function redraw() {
        var st = k.step(), seq = path(start, Math.max(days, 1)), pi = seq[days];
        live.clear();
        live.text(SIDE, 40, 'start ' + NAMES[start], { kind: 'label' });
        live.text(SIDE + COL, 40, 'day ' + days, { kind: 'val', anchor: 'end' });
        pi.forEach(function (p, i) {
          var x = BAR.cx[i] - BAR.w / 2, h = p * BAR.h, y = BAR.y0 - h;
          if (h > 1.5) {
            if (h > 5) live.hatch([[x, y], [x + BAR.w, y], [x + BAR.w, BAR.y0], [x, BAR.y0]], { op: 0.45 });
            live.poly([[x, BAR.y0], [x, y], [x + BAR.w, y], [x + BAR.w, BAR.y0]], { accent: st === 0, w: 1.2, rough: 0.3, op: 0.95 });
          }
          live.text(BAR.cx[i], y - 7, pi[i].toFixed(2), { kind: 'val', anchor: 'middle' });
        });
        ring.clear();
        ring.circle(NODE[start].x, NODE[start].y, R - 6, { w: 0.8, op: 0.6 });
        if (st === 0) {
          sum0.clear();
          var nx = nextDay(pi);
          sum0.text(SIDE, 296, 'tomorrow, sunny', { kind: 'label' });
          sum0.text(SIDE, 316, pr(pi[0], 3) + '×' + pr(P[0][0]) + ' + ' + pr(pi[1], 3) + '×' + pr(P[1][0]), { kind: 'val' });
          sum0.text(SIDE, 334, '+ ' + pr(pi[2], 3) + '×' + pr(P[2][0]), { kind: 'val' });
          sum0.text(SIDE, 352, '= ' + nx[0].toFixed(3), { kind: 'val' });
        } else {
          chart.clear();
          if (!Object.keys(tried).length) chart.text(CH.x0 + 10, CH.y1 + 30, 'press a start', { kind: 'axis' });
          // the long-run share, once a start has been run all the way
          var done = Object.keys(tried).filter(function (s) { return tried[s] >= DAYS; }).length;
          if (done) chart.path('M' + CH.x0 + ' ' + csy(STAR[0]).toFixed(1) + ' L' + CH.x1 + ' ' + csy(STAR[0]).toFixed(1), { w: 0.7, op: 0.6 });
          Object.keys(tried).forEach(function (s) {
            var seqS = path(+s, DAYS), n = +s === start ? days : tried[s], pts = [];
            for (var d = 0; d <= n; d++) pts.push([csx(d), csy(seqS[d][0])]);
            if (pts.length > 1) chart.polyline(pts, { w: +s === start ? 1.6 : 1, op: +s === start ? 1 : 0.55, accent: +s === start });
            chart.text(csx(0) + 4, csy(seqS[0][0]) + (seqS[0][0] > 0.5 ? 10 : -3), NAMES[s][0], { kind: 'axis' });
          });
          marks.clear();
          if (done) STAR.forEach(function (p, i) {
            var y = BAR.y0 - p * BAR.h;
            marks.path('M' + (BAR.cx[i] - 22) + ' ' + y.toFixed(1) + ' L' + (BAR.cx[i] + 22) + ' ' + y.toFixed(1), { w: 1, op: 0.8 });
          });
        }
      }
      function halt() { if (stop) { stop(); stop = null; } }

      k.button(SIDE, 214, 'next day', function () { halt(); days++; redraw(); }, { steps: [0] });
      k.button(SIDE, 246, 'back to day 0', function () { halt(); days = 0; redraw(); }, { steps: [0] });
      [0, 1, 2].forEach(function (s, i) {
        k.button(SIDE, 214 + i * 30, 'start ' + NAMES[s], function () {
          halt();
          start = s; days = 0; tried[s] = 0; redraw();
          stop = k.animate(2400, function (t) {
            var d = Math.round(t * DAYS);
            if (d !== days) { days = d; tried[s] = d; redraw(); }
          });
        }, { steps: [1] });
      });

      k.onStep(function (step) {
        halt();
        start = step === 1 ? 2 : 0; days = 0; tried = {};
        redraw();
      });
    }
  });
})();
