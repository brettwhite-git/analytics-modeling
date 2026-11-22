/* Testing on unseen data — twenty days as a strip of twenty cells over a scatter, and what each cell may do.
   Steps: 0 hide days by hand: click a cell (or its dot) to hold it out. The line is refitted on the rest and
            scored on the hidden days, live.
          1 take turns: the days are cut into k parts, each part is held out once, and the k scores are averaged.
            "next part" and "run all" step through; a slider changes k.
          2 three jobs: the last five cells are locked away. Inside the first fifteen, five candidate models take
            turns (3 parts); the lowest wins and is refitted on all fifteen; the locked part is opened once.
            Beside it, the same recipe on 300 made-up data sets shows the winner's turn score flatters it.
   Everything is computed: least squares (closed form for the line; Chebyshev basis and Householder QR for the
   candidates), average squared miss throughout. The days and the reader's hidden cells are offered to the page's
   Python through window.InkPage (points, hidden), so the code works on exactly what is drawn.
   Made-up data: jugs sold = 2 + 0.9 x - 0.05 x^2 + noise, x = hours of sun. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var STRIP = { x: 44, y: 42, w: 392, h: 18 };        // the row of cells
  var PLOT = { x: 44, y: 118, w: 392, h: 288 };       // the scatter under it
  var SIDE = 462, SIDE_W = 158;
  var N = 20, N_FIT = 15, YMAX = 9, NOISE = 0.8;
  var CELL = STRIP.w / N;
  var PART_CHOICES = [2, 4, 5, 10, 20];
  var CANDIDATES = [['flat', 0], ['line', 1], ['curve 2', 2], ['curve 3', 3], ['curve 4', 4]];
  var STORE = 'ink-unseen-hidden';
  var DEFAULT_HIDDEN = [2, 5, 9, 12, 16];

  function r2(v) { return Math.round(v * 100) / 100; }
  function truth(x) { return 2 + 0.9 * x - 0.05 * x * x; }
  function gauss(r) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }
  function sample(r, n) {
    var out = [];
    for (var i = 0; i < n; i++) { var x = 0.3 + 9.4 * r(); out.push({ x: r2(x), y: r2(truth(x) + NOISE * gauss(r)) }); }
    return out;
  }
  // made once, to two decimals, so the page's Python works on exactly the same days
  var DAYS = sample(window.InkKit.rng(4), N);

  /* the line through the middle of the points, slope from the sums (the same steps as the lesson's code) */
  function fitLine(pts) {
    var n = pts.length, mx = 0, my = 0, up = 0, across = 0, i;
    for (i = 0; i < n; i++) { mx += pts[i].x; my += pts[i].y; }
    mx /= n; my /= n;
    for (i = 0; i < n; i++) { var dx = pts[i].x - mx; up += dx * (pts[i].y - my); across += dx * dx; }
    var slope = across ? up / across : 0;
    return [my - slope * mx, slope];
  }
  function lineMiss(m, pts) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) { var e = pts[i].y - (m[0] + m[1] * pts[i].x); s += e * e; }
    return s / pts.length;
  }

  /* Chebyshev polynomials of (x - 5) / 5 and least squares by Householder QR, for the candidates in step 2 */
  function basis(x, deg) {
    var u = (x - 5) / 5, row = [1];
    if (deg >= 1) row.push(u);
    for (var j = 2; j <= deg; j++) row.push(2 * u * row[j - 1] - row[j - 2]);
    return row;
  }
  function polyfit(pts, deg) {
    var n = pts.length, p = deg + 1, A = [], b = [], i, j, k;
    for (i = 0; i < n; i++) { A.push(basis(pts[i].x, deg)); b.push(pts[i].y); }
    for (k = 0; k < p; k++) {
      var norm = 0;
      for (i = k; i < n; i++) norm += A[i][k] * A[i][k];
      norm = Math.sqrt(norm);
      if (norm < 1e-12) continue;
      var alpha = A[k][k] > 0 ? -norm : norm, v = [], vv = 0;
      for (i = k; i < n; i++) v.push(A[i][k]);
      v[0] -= alpha;
      for (i = 0; i < v.length; i++) vv += v[i] * v[i];
      if (vv < 1e-24) continue;
      for (j = k; j < p; j++) {
        var d = 0;
        for (i = k; i < n; i++) d += v[i - k] * A[i][j];
        d = 2 * d / vv;
        for (i = k; i < n; i++) A[i][j] -= d * v[i - k];
      }
      var db = 0;
      for (i = k; i < n; i++) db += v[i - k] * b[i];
      db = 2 * db / vv;
      for (i = k; i < n; i++) b[i] -= db * v[i - k];
    }
    var c = [];
    for (k = p - 1; k >= 0; k--) {
      var s = b[k];
      for (j = k + 1; j < p; j++) s -= A[k][j] * c[j];
      c[k] = Math.abs(A[k][k]) > 1e-12 ? s / A[k][k] : 0;
    }
    return c;
  }
  function predict(c, x) {
    var row = basis(x, c.length - 1), s = 0;
    for (var j = 0; j < c.length; j++) s += c[j] * row[j];
    return s;
  }
  function polyMiss(c, pts) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) { var e = pts[i].y - predict(c, pts[i].x); s += e * e; }
    return s / pts.length;
  }
  /* take turns: k contiguous parts, each held out once; the average of the k misses */
  function turns(pts, k, deg) {
    var size = Math.floor(pts.length / k), sum = 0;
    for (var j = 0; j < k; j++) {
      var held = pts.slice(j * size, j * size + size), rest = pts.slice(0, j * size).concat(pts.slice(j * size + size));
      sum += polyMiss(polyfit(rest, deg), held);
    }
    return sum / k;
  }

  function remembered() {
    try {
      var v = JSON.parse(sessionStorage.getItem(STORE));
      return Array.isArray(v) ? v.filter(function (i) { return i >= 0 && i < N; }) : null;
    } catch (e) { return null; }
  }
  function remember(list) { try { sessionStorage.setItem(STORE, JSON.stringify(list)); } catch (e) {} }

  /* what `from page import points, hidden` gives the Python on the same page (see ink/py.js) */
  window.InkPage = window.InkPage || {};
  window.InkPage.points = function () { return DAYS.map(function (p) { return [p.x, p.y]; }); };
  window.InkPage.hidden = function () {
    var h = remembered();
    return h && h.length ? h.slice().sort(function (a, b) { return a - b; }) : DEFAULT_HIDDEN.slice();
  };

  window.InkKit.define('cv-figure', {
    label: 'Twenty days drawn as a strip of cells over a scatter: hide some and score the line on them, take turns hiding each part, and keep a final part locked away',
    steps: 3,
    seed: 5,
    draw: function (k) {
      var sx = k.scale(0, 10, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(0, YMAX, PLOT.y + PLOT.h, PLOT.y);
      var pts = DAYS;
      var hidden = {}, nParts = 5, part = 0, partErrs = [], busy = false, opened = false;
      var shownLine = null, cancelGlide = null;

      function cellX(i) { return STRIP.x + i * CELL; }
      function cells(a, b) { return [[cellX(a), STRIP.y], [cellX(b), STRIP.y], [cellX(b), STRIP.y + STRIP.h], [cellX(a), STRIP.y + STRIP.h]]; }
      function f2(v) { return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2); }
      function clipY(y) { return Math.max(PLOT.y, Math.min(PLOT.y + PLOT.h, y)); }
      function lineD(m) {
        // the straight line across the plot, cut where it leaves the box
        var pts2 = [], x;
        for (var i = 0; i <= 40; i++) { x = 10 * i / 40; pts2.push([sx(x), sy(m[0] + m[1] * x)]); }
        return curveFromPx(pts2);
      }
      function curveD(c) {
        var px = [];
        for (var i = 0; i <= 240; i++) { var x = 0.1 + 9.8 * i / 240; px.push([sx(x), sy(predict(c, x))]); }
        return curveFromPx(px);
      }
      function curveFromPx(list) {
        var d = '', pen = false, top = PLOT.y + 1, bot = PLOT.y + PLOT.h - 1, px = 0, py = 0;
        list.forEach(function (p, i) {
          var x = p[0], y = p[1], inside = y >= top && y <= bot;
          if (i && inside !== pen) {
            var edge = (inside ? py : y) < top ? top : bot, t = (edge - py) / (y - py);
            d += (inside ? ' M' : ' L') + (px + t * (x - px)).toFixed(1) + ' ' + edge.toFixed(1);
          }
          if (inside) d += (pen ? ' L' : ' M') + x.toFixed(1) + ' ' + y.toFixed(1);
          pen = inside; px = x; py = y;
        });
        return d.trim();
      }
      /* a mark and a mono-caps name, centred as one unit, with a quieter line under it saying what it is for */
      function tag(g, cx, kind, name, job) {
        var w = name.length * 7.4 + 13, x0 = cx - w / 2;
        g.mark(x0 + 4, 74.5, kind, { r: 3.2 });
        g.text(x0 + 13, 78, name, { kind: 'label' });
        if (job) g.text(cx, 93, job, { kind: 'axis', anchor: 'middle' });
      }

      /* ---- always there: the axes and the strip of cells ---- */
      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'hours of sun', ylabel: 'jugs sold',
        xticks: [0, 2, 4, 6, 8, 10].map(function (v) { return [sx(v), String(v)]; }),
        yticks: [0, 2, 4, 6, 8].map(function (v) { return [sy(v), String(v)]; }) });
      var strip = k.root.group({ d: 0, stagger: 8 });
      strip.rect(STRIP.x, STRIP.y, STRIP.w, STRIP.h, { w: 1.1, rough: 0.4 });
      for (var i = 1; i < N; i++) strip.line(cellX(i), STRIP.y, cellX(i), STRIP.y + STRIP.h, { w: 0.6, op: 0.35, rough: 0.15 });

      /* live layers: hatching in the strip, the line and its misses */
      var stripLive = k.root.layer();
      var threads = k.root.layer();
      var lineLayer = k.root.layer();

      /* ---- the days: each drawn once as 'o' (learned from), 'x' (hidden) and 'sq' (locked), shown as needed ---- */
      var marks = k.root.group({ d: 150, stagger: 10 });
      var markSets = pts.map(function (p) {
        return ['o', 'x', 'sq'].map(function (s) { var n = marks.mark(sx(p.x), sy(p.y), s, { r: s === 'sq' ? 3.3 : 3.7 }); n.style.display = 'none'; return n; });
      });
      function showMark(i, which) { markSets[i].forEach(function (n, j) { n.style.display = j === which ? '' : 'none'; }); }

      /* click targets: one per cell, one per dot (step 0 only) */
      var hits = k.root.group({ d: 0 });
      var hitNodes = [];
      function toggle(i) {
        if (k.step() !== 0 || busy) return;
        var count = Object.keys(hidden).length;
        if (hidden[i]) delete hidden[i];
        else if (count < N - 2) hidden[i] = true;     // keep at least two days to draw a line through
        remember(hiddenList());
        redraw0(true);
      }
      pts.forEach(function (p, i) {
        var NS = 'http://www.w3.org/2000/svg';
        var cell = document.createElementNS(NS, 'rect');
        cell.setAttribute('x', cellX(i)); cell.setAttribute('y', STRIP.y - 4); cell.setAttribute('width', CELL); cell.setAttribute('height', STRIP.h + 8);
        var dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', sx(p.x)); dot.setAttribute('cy', sy(p.y)); dot.setAttribute('r', 9);
        [cell, dot].forEach(function (n, j) {
          n.setAttribute('class', 'ik-hit'); n.style.cursor = 'pointer';
          n.setAttribute('tabindex', j ? -1 : 0); n.setAttribute('role', 'button');
          n.setAttribute('aria-label', (j ? 'dot ' : 'day ') + (i + 1));
          n.addEventListener('click', function () { toggle(i); });
          n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(i); } });
          hits.node.appendChild(n);
          hitNodes.push(n);
        });
      });
      function hiddenList() { return Object.keys(hidden).map(Number).sort(function (a, b) { return a - b; }); }

      /* the accent: the fitted line, glided from where it was to where it now belongs */
      function placeLine(m, held, glide) {
        if (cancelGlide) { cancelGlide(); cancelGlide = null; }
        var from = shownLine || m;
        function paint(cur) {
          shownLine = cur;
          lineLayer.clear(); threads.clear();
          lineLayer.path(lineD(cur), { w: 1.6, op: 0.95, accent: true });
          var d = '';
          held.forEach(function (p) {
            var x = sx(p.x).toFixed(1);
            d += 'M' + x + ' ' + clipY(sy(p.y)).toFixed(1) + ' L' + x + ' ' + clipY(sy(cur[0] + cur[1] * p.x)).toFixed(1) + ' ';
          });
          if (d) threads.path(d, { w: 0.8, op: 0.7 });
        }
        if (!glide) { paint(m); return; }
        cancelGlide = k.animate(480, function (t) { paint([from[0] + (m[0] - from[0]) * t, from[1] + (m[1] - from[1]) * t]); });
      }

      /* ================= step 0: hide days by hand ================= */
      var s0 = k.root.group({ steps: [0], d: 300 });
      s0.text(SIDE, 44, 'days hidden', { kind: 'label' });
      var vHidden = s0.text(SIDE + SIDE_W, 44, '', { kind: 'val', anchor: 'end' });
      s0.text(SIDE, 72, 'average squared miss', { kind: 'label' });
      var lSeen = s0.text(SIDE, 92, '', { kind: 'axis' });
      var vSeen = s0.text(SIDE + SIDE_W, 92, '', { kind: 'val', anchor: 'end' });
      var lHid = s0.text(SIDE, 110, '', { kind: 'axis' });
      var vHid = s0.text(SIDE + SIDE_W, 110, '', { kind: 'val', anchor: 'end' });
      s0.line(SIDE, 122, SIDE + SIDE_W, 122, { w: 0.6, op: 0.45, rough: 0.3 });
      k.button(SIDE, 154, 'hide 5 for me', function () {
        if (busy) return;
        hidden = {}; DEFAULT_HIDDEN.forEach(function (i) { hidden[i] = true; });
        remember(hiddenList()); redraw0(true);
      }, { steps: [0] });
      k.button(SIDE, 190, 'show them all', function () {
        if (busy) return;
        hidden = {}; remember([]); redraw0(true);
      }, { steps: [0] });
      var callA = k.root.group({ steps: [0], d: 500 });
      callA.callout('a', 'click a cell or a dot', SIDE, 300);
      var hand0 = k.root.group({ steps: [0], d: 600 });
      hand0.text((STRIP.x + STRIP.x + STRIP.w) / 2, 82, 'each cell is one day · hatched means hidden', { kind: 'axis', anchor: 'middle' });
      hand0.text(SIDE, 334, 'the line learns', { kind: 'hand' });
      hand0.text(SIDE, 358, 'from the rest.', { kind: 'hand' });

      function redraw0(glide) {
        var held = [], rest = [];
        pts.forEach(function (p, i) { if (hidden[i]) held.push(p); else rest.push(p); showMark(i, hidden[i] ? 1 : 0); });
        stripLive.clear();
        hiddenList().forEach(function (i) { stripLive.hatch(cells(i, i + 1), { angle: 140, gap: 3.2, op: 0.95 }); });
        var m = fitLine(rest);
        placeLine(m, held, glide);
        vHidden.set(held.length + ' of ' + N);
        lSeen.set('on the ' + rest.length + ' it saw');
        vSeen.set(f2(lineMiss(m, rest)));
        lHid.set(held.length ? 'on the ' + held.length + ' hidden' : 'on the hidden ones');
        vHid.set(held.length ? f2(lineMiss(m, held)) : '–');
      }

      /* ================= step 1: take turns ================= */
      var s1 = k.root.group({ steps: [1], d: 300 });
      s1.text(SIDE, 44, 'part held out', { kind: 'label' });
      var vPart = s1.text(SIDE + SIDE_W, 44, '', { kind: 'val', anchor: 'end' });
      s1.text(SIDE, 62, 'its miss', { kind: 'label' });
      var vErr = s1.text(SIDE + SIDE_W, 62, '', { kind: 'val', anchor: 'end' });
      var lMean = s1.text(SIDE, 80, '', { kind: 'label' });
      var vMean = s1.text(SIDE + SIDE_W, 80, '', { kind: 'val', anchor: 'end' });
      s1.line(SIDE, 92, SIDE + SIDE_W, 92, { w: 0.6, op: 0.45, rough: 0.3 });
      s1.text(SIDE, 110, 'each part’s miss', { kind: 'axis' });
      s1.line(SIDE, 132, SIDE + SIDE_W, 132, { w: 0.8, op: 0.7, rough: 0.3 });
      s1.text(SIDE, 146, '0', { kind: 'axis' });
      var vTop = s1.text(SIDE + SIDE_W, 146, '', { kind: 'axis', anchor: 'end' });
      var chart = k.root.layer({ steps: [1] });
      var partLabel = k.root.layer({ steps: [1] });

      function partSize() { return N / nParts; }
      function splitPart(j) {
        var a = j * partSize(), b = a + partSize();
        return { a: a, b: b, held: pts.slice(a, b), rest: pts.slice(0, a).concat(pts.slice(b)) };
      }
      function scoreParts() {
        partErrs = [];
        for (var j = 0; j < nParts; j++) { var s = splitPart(j); partErrs.push(lineMiss(fitLine(s.rest), s.held)); }
      }
      function redraw1(glide) {
        var s = splitPart(part), j, sum = 0;
        pts.forEach(function (p, i) { showMark(i, i >= s.a && i < s.b ? 1 : 0); });
        stripLive.clear();
        stripLive.hatch(cells(s.a, s.b), { angle: 140, gap: 3.2, op: 0.95 });
        for (j = 1; j < nParts; j++) {
          var tick = partSize() > 2 ? 5 : 3;
          stripLive.line(cellX(j * partSize()), STRIP.y - tick, cellX(j * partSize()), STRIP.y + STRIP.h + tick, { w: tick > 3 ? 1.2 : 0.8, rough: 0.2, op: 0.85 });
        }
        partLabel.clear();
        var name = 'part ' + (part + 1) + ' · hidden', tw = name.length * 7.4 + 13;
        var cx = k.clamp((cellX(s.a) + cellX(s.b)) / 2, STRIP.x + tw / 2, STRIP.x + STRIP.w - tw / 2);
        partLabel.mark(cx - tw / 2 + 4, 26.5, 'x', { r: 3.2 });
        partLabel.text(cx - tw / 2 + 13, 30, name, { kind: 'label' });
        placeLine(fitLine(s.rest), s.held, glide);
        // the column: this part, and the parts visited so far
        var top = Math.max(1, Math.ceil(Math.max.apply(null, partErrs) * 2) / 2), ex = k.scale(0, top, SIDE, SIDE + SIDE_W);
        chart.clear();
        for (j = 0; j <= part; j++) {
          sum += partErrs[j];
          if (j === part) chart.circle(ex(partErrs[j]), 125, 3.4, { w: 1.2, op: 0.95, rough: 0.3 });
          else chart.dot(ex(partErrs[j]), 125, 2, { op: 0.6 });
        }
        chart.line(ex(sum / (part + 1)), 116, ex(sum / (part + 1)), 138, { w: 1.6, op: 0.9, rough: 0.2 });
        vPart.set((part + 1) + ' of ' + nParts);
        vErr.set(f2(partErrs[part]));
        lMean.set(part === nParts - 1 ? 'average of ' + nParts : 'average so far');
        vMean.set(f2(sum / (part + 1)));
        vTop.set(top.toFixed(1));
      }
      k.button(SIDE, 176, 'next part', function () {
        if (busy) return;
        part = (part + 1) % nParts; redraw1(true);
      }, { steps: [1] });
      k.button(SIDE + SIDE_W, 176, 'run all', function () {
        if (busy) return;
        var from = part === nParts - 1 ? 0 : part, last = -1;
        part = from; redraw1(true);
        busy = true;
        k.animate(Math.min(4000, 640 * (nParts - 1 - from)) || 1, function (t) {
          var at = from + Math.floor(t * (nParts - 1 - from) + 1e-9);
          if (at !== last) { last = part = at; redraw1(!k.reduced); }
          if (t >= 1) busy = false;
        });
      }, { steps: [1], anchor: 'end' });
      k.root.group({ steps: [1], d: 500 }).callout('b', 'every part takes one turn', SIDE, 214);
      k.slider({
        x: SIDE, y: 262, w: SIDE_W, min: 0, max: PART_CHOICES.length - 1, step: 1, value: PART_CHOICES.indexOf(nParts),
        label: 'parts', steps: [1],
        format: function (v) { return PART_CHOICES[v] === N ? N + ' (one each)' : String(PART_CHOICES[v]); },
        onChange: function (v) { if (busy) return; nParts = PART_CHOICES[v]; part = 0; scoreParts(); redraw1(true); }
      });
      var ends1 = k.root.group({ steps: [1], d: 500 });
      ends1.text(SIDE, 288, '2', { kind: 'axis' });
      ends1.text(SIDE + SIDE_W, 288, 'one day each', { kind: 'axis', anchor: 'end' });
      ends1.text(SIDE, 330, 'the line is fitted', { kind: 'hand' });
      ends1.text(SIDE, 354, 'on the other parts.', { kind: 'hand' });

      /* ================= step 2: fit, choose, final check ================= */
      var fitting = pts.slice(0, N_FIT), locked = pts.slice(N_FIT);
      var rows = CANDIDATES.map(function (c) { return { name: c[0], deg: c[1], score: turns(fitting, 3, c[1]) }; });
      var win = rows.reduce(function (a, b) { return b.score < a.score ? b : a; });
      var winC = polyfit(fitting, win.deg), finalScore = polyMiss(winC, locked);
      var s2 = k.root.group({ steps: [2], d: 300 });
      s2.hatch(cells(N_FIT, N), { angle: 40, gap: 4, op: 0.55 });
      s2.hatch(cells(N_FIT, N), { angle: 140, gap: 4, op: 0.55 });
      s2.line(cellX(N_FIT), STRIP.y - 7, cellX(N_FIT), STRIP.y + STRIP.h + 7, { w: 1.6, rough: 0.3 });
      for (var cut = 5; cut < N_FIT; cut += 5) s2.line(cellX(cut), STRIP.y - 4, cellX(cut), STRIP.y + STRIP.h + 4, { w: 1.1, rough: 0.2, op: 0.85 });
      tag(s2, (cellX(0) + cellX(N_FIT)) / 2, 'o', 'fit and choose', 'take turns in here: 3 parts');
      tag(s2, (cellX(N_FIT) + cellX(N)) / 2, 'sq', 'final', 'locked');
      s2.text(SIDE, 44, 'taking turns', { kind: 'label' });
      rows.forEach(function (r, j) {
        var y = 64 + j * 16, best = r === win;
        s2.text(SIDE, y, r.name, { kind: 'axis', accent: best, d: 500 + j * 60 });
        s2.text(SIDE + SIDE_W, y, f2(r.score), { kind: 'val', anchor: 'end', accent: best, d: 500 + j * 60 });
      });
      s2.line(SIDE, 142, SIDE + SIDE_W, 142, { w: 0.6, op: 0.45, rough: 0.3 });
      var winCurve = k.root.group({ steps: [2], d: 900 });
      (function () { var wrap = winCurve.group(); wrap.node.setAttribute('class', 'ik-g ik-ink'); wrap.node.style.opacity = 1; wrap.path(curveD(winC), { w: 1.6, op: 0.95, accent: true, dur: 900 }); })();
      var bOpen = k.button(SIDE, 172, 'open the final part', function () {
        if (busy || opened) return;
        opened = true; redraw2();
      }, { steps: [2] });
      var s2b = k.root.group({ steps: [2], d: 0 });
      var lFinal = s2b.text(SIDE, 204, '', { kind: 'label' });
      var vFinal = s2b.text(SIDE + SIDE_W, 204, '', { kind: 'val', anchor: 'end' });
      var nFinal = s2b.text(SIDE, 222, '', { kind: 'axis' });
      // the same recipe on 300 made-up data sets: the winner's turn score against its final check
      var simRand = window.InkKit.rng(4242), sumTurns = 0, sumFinal = 0, REPS = 300;
      for (var r = 0; r < REPS; r++) {
        var d = sample(simRand, N), f = d.slice(0, N_FIT), best = null;
        CANDIDATES.forEach(function (c) { var sc = turns(f, 3, c[1]); if (!best || sc < best.sc) best = { sc: sc, deg: c[1] }; });
        sumTurns += best.sc; sumFinal += polyMiss(polyfit(f, best.deg), d.slice(N_FIT));
      }
      var sim = k.root.group({ steps: [2], d: 800 });
      sim.text(SIDE, 300, 'over 300 stands', { kind: 'label' });
      sim.text(SIDE, 320, 'winner, taking turns', { kind: 'axis' });
      sim.text(SIDE + SIDE_W, 320, f2(sumTurns / REPS), { kind: 'val', anchor: 'end' });
      sim.text(SIDE, 338, 'winner, final check', { kind: 'axis' });
      sim.text(SIDE + SIDE_W, 338, f2(sumFinal / REPS), { kind: 'val', anchor: 'end' });
      sim.callout('c', 'picked by its score,', SIDE, 374);
      sim.text(SIDE + 22, 392, 'so the score flatters it', { kind: 'note', accent: true });

      function redraw2() {
        pts.forEach(function (p, i) { showMark(i, i < N_FIT ? 0 : opened ? 2 : -1); });
        stripLive.clear(); partLabel.clear(); lineLayer.clear(); threads.clear(); shownLine = null;
        if (opened) {
          var dd = '';
          locked.forEach(function (p) {
            var x = sx(p.x).toFixed(1);
            dd += 'M' + x + ' ' + clipY(sy(p.y)).toFixed(1) + ' L' + x + ' ' + clipY(sy(predict(winC, p.x))).toFixed(1) + ' ';
          });
          threads.path(dd, { w: 0.8, op: 0.7 });
        }
        bOpen.set(opened ? 'opened: used up' : 'open the final part');
        lFinal.set(opened ? 'final check' : '');
        vFinal.set(opened ? f2(finalScore) : '');
        nFinal.set(opened ? win.name + ', once, at the end' : win.name + ' wins, refit on 15');
      }

      k.onStep(function (step) {
        busy = false;
        if (cancelGlide) { cancelGlide(); cancelGlide = null; }
        hitNodes.forEach(function (n) { n.style.pointerEvents = step === 0 ? 'auto' : 'none'; });
        partLabel.clear(); chart.clear();
        if (step === 0) {
          hidden = {}; (remembered() || []).forEach(function (i) { hidden[i] = true; });
          shownLine = null; redraw0(false);
        } else if (step === 1) {
          part = 0; scoreParts(); shownLine = null; redraw1(false);
        } else {
          opened = false; redraw2();
        }
      });
    }
  });
})();
