/* KNN figure — k-nearest-neighbours worked through on one page, in pen and ink.
   A hand-ruled plot of two classes, the formula above it, the R beside it, and the decision
   boundary between them, computed for real (Euclidean k-NN on a 60 x 51 grid, marching squares).
   Figure module for the showcase frame (plain script, needs global `rough`).
   Contract: window.ShowcaseFigures['knn-figure'].mount(el, { reducedMotion, step })
             -> { setStep(n), replay(), destroy() }
   Steps: 0 the problem (formula and code apart, the plot faint) · 1 how it works (the boundary, the
          vote at one query point, a slider for k) · 2 the result (move any point; it re-hatches).
   No events, no sound. See ../DRAWING-RULES.md for the look. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  var UID = 0;

  /* ---------- the drawing, in its own 640 x 450 space ---------- */
  var INK = { x0: 22, x1: 626, y0: 20, y1: 432 };   // what the ink actually covers; this is what gets centred
  var PAD = 10, MAX_SCALE = 1.12;
  var P = { x: 46, y: 70, w: 400, h: 340 };          // the plot area
  var SIDE_X = 474;                                  // the column beside the plot
  var SLIDER = { x: 476, y: 112, pitch: 10 };
  var CODE = { x: 482, y: 362, pitch: 15 };
  var GAP = { x0: 300, y0: 31, cx: 572, cy: 22, x1: 562, y1: 338, from: 0.4, to: 0.6 };   // the thread that does not meet
  // the callouts are written beside the plot, never on it: the boundary goes where the points send it
  var CALLOUTS = [
    { key: 'a', step: 0, text: 'the part in between', x: 476, y: 164 },
    { key: 'b', step: 1, text: 'the k nearest vote',  x: 474, y: 220 },
    { key: 'c', step: 2, text: 'drag any point',      x: 474, y: 188 }
  ];

  /* ---------- the maths ---------- */
  var NX = 60, NY = 51, NX1 = NX + 1;                // grid cells; classes are taken at the 61 x 52 corners
  var CW = P.w / NX, CH = P.h / NY;
  var NH = NX * (NY + 1), NE = NH + NX1 * NY;        // horizontal grid edges come first, then vertical
  var K_MIN = 1, K_MAX = 15, K_START = 7;
  var N_PER = 20;                                    // points per class
  var QUERY = { x: 212, y: 182 };                    // the query point, in plot pixels
  var HATCH_DEG = 40, HATCH_GAP = 5;
  var EDGE = 7;                                      // a dragged point stays this far inside the plot

  /* ---------- tuning ---------- */
  var STITCH_MS = 22, GAP_STITCH_MS = 30;
  var NUDGE = 6;

  function svgEl(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // tiny seeded generator so every mark, stitch and data point is the same on every build
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function ensureCss() {
    if (document.querySelector('link[data-knn-figure], link[href*="knn-figure.css"]')) return;
    if (!SCRIPT_SRC) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = SCRIPT_SRC.replace(/knn-figure\.js(\?.*)?$/, 'knn-figure.css');
    l.setAttribute('data-knn-figure', '');
    document.head.appendChild(l);
  }
  // stitches of slightly different lengths: dash 5-6, gap 4-5
  function stitchPattern(seed) {
    var rand = rng(seed), out = [];
    for (var i = 0; i < 6; i++) { out.push(r1(5 + rand())); out.push(r1(4 + rand())); }
    return out;
  }
  // part of a quadratic curve, t0..t1, as a path
  function quadPart(g, t0, t1) {
    function at(t) { var v = 1 - t; return [v * v * g.x0 + 2 * v * t * g.cx + t * t * g.x1, v * v * g.y0 + 2 * v * t * g.cy + t * t * g.y1]; }
    function der(t) { var v = 1 - t; return [2 * (v * (g.cx - g.x0) + t * (g.x1 - g.cx)), 2 * (v * (g.cy - g.y0) + t * (g.y1 - g.cy))]; }
    var a = at(t0), b = at(t1), d = der(t0), h = (t1 - t0) / 2;
    return 'M' + r1(a[0]) + ' ' + r1(a[1]) + ' Q' + r1(a[0] + d[0] * h) + ' ' + r1(a[1] + d[1] * h) + ' ' + r1(b[0]) + ' ' + r1(b[1]);
  }

  /* ---------- the data: two overlapping clusters, the same forty points every time ---------- */
  var DATA = (function () {
    var rand = rng(1907), pts = [];
    function gauss() { return Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand()); }
    var C = [{ x: 132, y: 222, sx: 52, sy: 50 }, { x: 268, y: 122, sx: 54, sy: 50 }];
    C.forEach(function (c, cls) {
      var made = 0, guard = 0;
      while (made < N_PER && guard++ < 5000) {
        var x = c.x + gauss() * c.sx, y = c.y + gauss() * c.sy, ok = true;
        if (x < 16 || x > P.w - 16 || y < 16 || y > P.h - 16) continue;
        if (Math.hypot(x - QUERY.x, y - QUERY.y) < 25) continue;        // room around the query point for its threads
        for (var q = 0; q < pts.length; q++) if (Math.hypot(pts[q].x - x, pts[q].y - y) < 15) { ok = false; break; }
        if (!ok) continue;
        pts.push({ x: r1(x), y: r1(y), c: cls });
        made++;
      }
    });
    return pts;
  })();

  /* ---------- the hatching lines: 40 degrees, 5 px apart, each with its own small unevenness ---------- */
  var TH = HATCH_DEG * Math.PI / 180, SIN = Math.sin(TH), COS = Math.cos(TH);
  var S_MAX = P.w * SIN + P.h * COS;
  var HM = Math.floor(S_MAX / HATCH_GAP);
  var HS = [], HA = [], HB = [], HJ = [], HJ2 = [], HBOW = [];
  (function () {
    var rand = rng(4040);
    for (var m = 0; m < HM; m++) {
      var s = HATCH_GAP * (m + 0.5) + (rand() - 0.5) * 1.2;   // distance of the line from the plot's top-left corner
      HS.push(s);
      HA.push(Math.max(-s * SIN / COS, (s * COS - P.h) / SIN)); // where the line enters the plot
      HB.push(Math.min((P.w - s * SIN) / COS, s * COS / SIN));  // and where it leaves
      HJ.push(rand());
      HJ2.push(rand());
      HBOW.push((rand() - 0.5) * 1.1);
    }
  })();
  function hx(s, t) { return s * SIN + t * COS; }
  function hy(s, t) { return s * COS - t * SIN; }

  function mount(el, opts) {
    opts = opts || {};
    if (!el || !window.rough) {
      return { setStep: function () {}, replay: function () {}, destroy: function () {} };
    }
    ensureCss();

    var reduced = !!opts.reducedMotion;
    var step = Math.max(0, Math.min(2, +opts.step || 0));
    var destroyed = false, visible = true, started = false, drawing = false;
    var scale = 1, offX = 0, offY = 0;
    var token = 0;            // bumps on every state change so stale cues do nothing
    var clock = 0, raf = 0, lastT = 0;
    var tasks = [], jobs = [];
    var uid = 'kf' + (++UID);

    /* ---------- the model: forty labelled points and a k ---------- */
    var n = DATA.length, k = K_START;
    var X = new Float64Array(n), Y = new Float64Array(n), CL = new Uint8Array(n);
    function resetData() { for (var i = 0; i < n; i++) { X[i] = DATA[i].x; Y[i] = DATA[i].y; CL[i] = DATA[i].c; } }
    resetData();

    var bestD = new Float64Array(K_MAX), bestI = new Int16Array(K_MAX);
    // the k nearest points to (x, y), nearest first, into bestD / bestI. Returns how many.
    function nearest(x, y, skip) {
      var m = 0, i, j, d, dx, dy;
      for (i = 0; i < n; i++) {
        if (i === skip) continue;
        dx = X[i] - x; dy = Y[i] - y; d = dx * dx + dy * dy;             // squared Euclidean distance orders the same
        if (m === k && d >= bestD[k - 1]) continue;
        j = m < k ? m++ : k - 1;
        while (j > 0 && bestD[j - 1] > d) { bestD[j] = bestD[j - 1]; bestI[j] = bestI[j - 1]; j--; }
        bestD[j] = d; bestI[j] = i;
      }
      return m;
    }
    // y-hat = the mode of the k nearest labels. A tie goes to the nearest neighbour
    // (R's class::knn breaks ties at random; here the drawing has to come out the same every time).
    function classify(x, y, skip) {
      var m = nearest(x, y, skip), v = 0;
      for (var j = 0; j < m; j++) v += CL[bestI[j]];
      if (2 * v > m) return 1;
      if (2 * v < m) return 0;
      return CL[bestI[0]];
    }
    function looAccuracy() {
      var hit = 0;
      for (var i = 0; i < n; i++) if (classify(X[i], Y[i], i) === CL[i]) hit++;
      return hit / n;
    }

    /* ---------- the field: classes at the grid corners, the contour between them, the hatching ---------- */
    var nodes = new Uint8Array(NX1 * (NY + 1));
    var ex = new Float64Array(NE), ey = new Float64Array(NE), eOn = new Uint8Array(NE), eCnt = new Uint8Array(NE);
    var eSeg = new Int32Array(NE * 2);
    var segA = new Int32Array(NX * NY * 2), segB = new Int32Array(NX * NY * 2), segUsed = new Uint8Array(NX * NY * 2), ns = 0;
    var lineD = [], contourD = '';
    for (var hm = 0; hm < HM; hm++) lineD.push('');

    // where the boundary crosses one grid edge: bisect along the edge with the real classifier
    function cross(e) {
      if (eOn[e]) return;
      eOn[e] = 1;
      var i, j, x0, y0, x1, y1, c0, mx, my, it;
      if (e < NH) { j = (e / NX) | 0; i = e - j * NX; x0 = i * CW; y0 = j * CH; x1 = x0 + CW; y1 = y0; }
      else { var q = e - NH; j = (q / NX1) | 0; i = q - j * NX1; x0 = i * CW; y0 = j * CH; x1 = x0; y1 = y0 + CH; }
      c0 = nodes[j * NX1 + i];
      for (it = 0; it < 5; it++) {
        mx = (x0 + x1) / 2; my = (y0 + y1) / 2;
        if (classify(mx, my, -1) === c0) { x0 = mx; y0 = my; } else { x1 = mx; y1 = my; }
      }
      ex[e] = (x0 + x1) / 2; ey[e] = (y0 + y1) / 2;
    }
    function addSeg(a, b) {
      cross(a); cross(b);
      segA[ns] = a; segB[ns] = b;
      eSeg[a * 2 + eCnt[a]++] = ns; eSeg[b * 2 + eCnt[b]++] = ns;
      ns++;
    }
    function trace(e0) {
      var pts = [ex[e0], ey[e0]], e = e0, c, s, found, closed = false;
      for (;;) {
        found = -1;
        for (c = 0; c < eCnt[e]; c++) { s = eSeg[e * 2 + c]; if (!segUsed[s]) { found = s; break; } }
        if (found < 0) break;
        segUsed[found] = 1;
        e = segA[found] === e ? segB[found] : segA[found];
        pts.push(ex[e], ey[e]);
        if (e === e0) { closed = true; break; }
      }
      return { p: pts, closed: closed };
    }
    // a chain of crossings as one pen stroke: corners eased through the midpoints
    function chainD(p, closed) {
      var m = p.length / 2, q, d;
      function mid(a, b) { return r1((p[a * 2] + p[b * 2]) / 2) + ' ' + r1((p[a * 2 + 1] + p[b * 2 + 1]) / 2); }
      function at(a) { return r1(p[a * 2]) + ' ' + r1(p[a * 2 + 1]); }
      if (closed) {
        m -= 1;                                        // the last point repeats the first
        if (m < 3) return '';
        d = 'M' + mid(0, 1);
        for (q = 1; q <= m; q++) d += 'Q' + at(q % m) + ' ' + mid(q % m, (q + 1) % m);
        return d + 'Z';
      }
      if (m < 2) return '';
      d = 'M' + at(0);
      for (q = 1; q < m - 1; q++) d += 'Q' + at(q) + ' ' + mid(q, q + 1);
      return d + 'L' + at(m - 1);
    }
    var cuts = [];
    function compute() {
      var i, j, q, c, s, m;
      // 1. the class at every grid corner
      for (j = 0; j <= NY; j++) for (i = 0; i <= NX; i++) nodes[j * NX1 + i] = classify(i * CW, j * CH, -1);

      // 2. marching squares: one or two boundary segments in every cell whose corners disagree
      eOn.fill(0); eCnt.fill(0); ns = 0;
      for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) {
        var tl = nodes[j * NX1 + i], tr = nodes[j * NX1 + i + 1], bl = nodes[(j + 1) * NX1 + i], br = nodes[(j + 1) * NX1 + i + 1];
        var idx = tl * 8 + tr * 4 + br * 2 + bl;
        if (idx === 0 || idx === 15) continue;
        var T = j * NX + i, B = T + NX, L = NH + j * NX1 + i, R = L + 1;
        switch (idx) {
          case 1: case 14: addSeg(L, B); break;
          case 2: case 13: addSeg(B, R); break;
          case 3: case 12: addSeg(L, R); break;
          case 4: case 11: addSeg(T, R); break;
          case 6: case 9:  addSeg(T, B); break;
          case 7: case 8:  addSeg(T, L); break;
          default:                                     // a saddle (5 or 10): the cell's centre decides which way it joins
            c = classify((i + 0.5) * CW, (j + 0.5) * CH, -1);
            if ((idx === 5) === (c === 1)) { addSeg(T, L); addSeg(B, R); }
            else { addSeg(T, R); addSeg(L, B); }
        }
      }

      // 3. join the segments into chains: the ones that run off the plot first, then the closed loops
      var chains = [], ch;
      for (s = 0; s < ns; s++) segUsed[s] = 0;
      for (s = 0; s < ns; s++) {
        if (segUsed[s]) continue;
        if (eCnt[segA[s]] === 1) chains.push(trace(segA[s]));
        else if (eCnt[segB[s]] === 1) chains.push(trace(segB[s]));
      }
      for (s = 0; s < ns; s++) if (!segUsed[s]) chains.push(trace(segA[s]));
      var d = '';
      for (c = 0; c < chains.length; c++) d += chainD(chains[c].p, chains[c].closed);
      contourD = d;

      // 4. hatch the crosses' side: cut every hatching line where it meets the contour,
      //    and keep the pieces whose middle the classifier calls class 1
      for (c = 0; c < chains.length; c++) {
        ch = chains[c];
        ch.s = []; ch.t = [];
        for (q = 0; q < ch.p.length; q += 2) {
          ch.s.push(ch.p[q] * SIN + ch.p[q + 1] * COS);
          ch.t.push(ch.p[q] * COS - ch.p[q + 1] * SIN);
        }
      }
      for (m = 0; m < HM; m++) {
        var sm = HS[m], ta = HA[m], tb = HB[m], fa, fb, t;
        cuts.length = 0;
        for (c = 0; c < chains.length; c++) {
          ch = chains[c];
          for (q = 0; q < ch.s.length - 1; q++) {
            fa = ch.s[q] - sm; fb = ch.s[q + 1] - sm;
            if ((fa < 0) === (fb < 0)) continue;
            t = ch.t[q] + fa / (fa - fb) * (ch.t[q + 1] - ch.t[q]);
            if (t > ta && t < tb) cuts.push(t);
          }
        }
        cuts.sort(function (a, b) { return a - b; });
        var out = '', prev = ta, open = null, end = 0, nx, midT;
        var bow = HBOW[m];
        for (q = 0; q <= cuts.length; q++) {
          nx = q < cuts.length ? cuts[q] : tb;
          if (nx - prev > 0.8) {
            midT = (prev + nx) / 2;
            if (classify(hx(sm, midT), hy(sm, midT), -1) === 1) { if (open === null) open = prev; end = nx; }
            else if (open !== null) { out += stroke(m, open, end, bow); open = null; }
          }
          prev = nx;
        }
        if (open !== null) out += stroke(m, open, end, bow);
        lineD[m] = out;
      }
    }
    // one hatching stroke: it stops just short of the contour (and unevenly at the plot's open edges), and bows a little
    function stroke(m, a, b, bow) {
      var s = HS[m];
      a += a === HA[m] ? 1.2 + HJ[m] * 3.4 : 1.5 + HJ[m] * 1.3;
      b -= b === HB[m] ? 0.6 + HJ2[m] * 3.6 : 1.3 + HJ2[m] * 1.3;
      if (b - a < 2.6) return '';
      var mt = (a + b) / 2, lift = bow * Math.min(1, (b - a) / 70);
      return 'M' + r1(hx(s, a)) + ' ' + r1(hy(s, a)) + 'Q' + r1(hx(s + lift, mt)) + ' ' + r1(hy(s + lift, mt)) + ' ' + r1(hx(s, b)) + ' ' + r1(hy(s, b));
    }

    /* ---------- the svg ---------- */
    el.textContent = '';
    var svg = svgEl('svg', {
      'class': 'knn-figure kf-step-0' + (reduced ? ' is-reduced' : ''),
      role: 'group',
      'aria-label': 'Illustration: a scatter plot of two classes of points, circles and crosses, with the ' +
        'k-nearest-neighbours formula above it and R code beside it. From the second step the decision boundary is drawn ' +
        'and a slider sets k; in the third step the points can be moved and the boundary follows.'
    }, el);
    var defs = svgEl('defs', null, svg);
    var polyA = svgEl('polygon', null, svgEl('clipPath', { id: uid + 'a' }, defs));   // already re-hatched
    var polyB = svgEl('polygon', null, svgEl('clipPath', { id: uid + 'b' }, defs));   // not yet
    var root = svgEl('g', null, svg);
    var rc = window.rough.svg(svg);
    var seedN = 700;

    function ink(node, cls, parent) {
      node.setAttribute('class', 'kf-ink ' + cls);
      var ps = node.querySelectorAll('path');
      for (var i = 0; i < ps.length; i++) ps[i].setAttribute('pathLength', '1');
      parent.appendChild(node);
      return node;
    }
    function line(x1, y1, x2, y2, cls, parent, w, rough) {
      return ink(rc.line(x1, y1, x2, y2, {
        roughness: rough == null ? 0.6 : rough, bowing: 0.5, seed: ++seedN, strokeWidth: w || 0.6, disableMultiStroke: true, stroke: 'currentColor'
      }), cls, parent);
    }
    function ring(x, y, d, cls, parent, w) {
      return ink(rc.circle(x, y, d, {
        roughness: d < 12 ? 0.32 : 0.5, seed: ++seedN, strokeWidth: w || 1.1, disableMultiStroke: true, stroke: 'currentColor'
      }), cls, parent);
    }
    function part(cls, delay, parent) {
      var g = svgEl('g', { 'class': cls }, parent || root);
      g.style.setProperty('--kf-d', delay + 'ms');
      return g;
    }
    function label(text, x, y, cls, parent, anchor) {
      var t = svgEl('text', { x: x, y: y, 'class': 'kf-t ' + cls }, parent);
      if (anchor) t.setAttribute('text-anchor', anchor);
      if (text != null) t.textContent = text;
      return t;
    }
    // a line of maths: plain strings, { sub: 'i' } subscripts, { up: 'mode' } upright words
    function maths(parts, x, y, cls, parent, anchor) {
      var t = label(null, x, y, cls, parent, anchor), down = false;
      parts.forEach(function (p) {
        var s = svgEl('tspan', null, t), sub = typeof p === 'object' && p.sub != null;
        if (sub) { s.setAttribute('class', 'kf-sub'); if (!down) s.setAttribute('dy', '3.4'); s.textContent = p.sub; }
        else {
          if (down) s.setAttribute('dy', '-3.4');
          if (typeof p === 'object') { s.setAttribute('class', 'kf-up'); s.textContent = p.up; } else s.textContent = p;
        }
        down = sub;
      });
      return t;
    }
    // the two marks, drawn around (0, 0)
    function drawCircle(parent, d, w) { return ring(0, 0, d, 'kf-mark', parent, w); }
    function drawCross(parent, arm, w, tilt) {
      var g = svgEl('g', { transform: 'rotate(' + tilt + ')' }, parent);
      line(-arm, 0, arm, 0, 'kf-mark', g, w, 0.4);
      line(0, -arm, 0, arm, 'kf-mark', g, w, 0.4);
      return g;
    }

    /* ---------- the plot: axes, field, threads, points, query ---------- */
    var gPlot = svgEl('g', { 'class': 'kf-plot' }, root);
    var gAxes = part('kf-axes', 0, gPlot);
    line(P.x - 7, P.y + P.h, P.x + P.w + 9, P.y + P.h, 'kf-edge', gAxes, 1.1);
    line(P.x, P.y + P.h + 7, P.x, P.y - 9, 'kf-edge', gAxes, 1.1);
    var gTicks = part('kf-ticks', 240, gPlot);
    for (var tq = 1; tq <= 8; tq++) line(P.x + tq * 50, P.y + P.h + 0.5, P.x + tq * 50, P.y + P.h + 4.5, 'kf-fine', gTicks, 0.8, 0.3);
    for (tq = 1; tq <= 6; tq++) line(P.x - 0.5, P.y + P.h - tq * 50, P.x - 4.5, P.y + P.h - tq * 50, 'kf-fine', gTicks, 0.8, 0.3);
    maths(['x', { sub: '1' }], P.x + P.w + 9, P.y + P.h + 17, 'kf-axis', gTicks, 'end');
    maths(['x', { sub: '2' }], P.x - 9, P.y - 1, 'kf-axis', gTicks, 'end');

    var gIn = svgEl('g', { transform: 'translate(' + P.x + ' ' + P.y + ')' }, gPlot);
    var gField = svgEl('g', { 'class': 'kf-fieldink', 'aria-hidden': 'true' }, gIn);
    var hatchOld = svgEl('path', { 'class': 'kf-hatch', 'clip-path': 'url(#' + uid + 'b)' }, gField);
    var hatchNew = svgEl('path', { 'class': 'kf-hatch' }, gField);
    var contourOld = svgEl('path', { 'class': 'kf-contour kf-contour--old', 'clip-path': 'url(#' + uid + 'b)' }, gField);
    var contourNew = svgEl('path', { 'class': 'kf-contour', pathLength: '1' }, gField);
    hatchNew.style.visibility = 'hidden';

    var gThreads = svgEl('g', { 'aria-hidden': 'true' }, gIn);
    var threads = [];
    var gPoints = svgEl('g', { 'class': 'kf-points' }, gIn);
    var points = DATA.map(function (p, i) {
      var g = svgEl('g', { 'class': 'kf-pt kf-pt--' + (p.c ? 'x' : 'o'), 'data-i': i, role: 'button' }, gPoints);
      g.style.setProperty('--kf-d', (340 + i * 15) + 'ms');
      svgEl('circle', { 'class': 'kf-pt__hit', r: 11 }, g);
      svgEl('circle', { 'class': 'kf-paper', r: 6.3 }, g);
      if (p.c) drawCross(g, 4.3, 1.15, r1((rng(900 + i)() - 0.5) * 16));
      else drawCircle(g, 8.2, 1.1);
      threads.push({ path: svgEl('path', { 'class': 'kf-thread' }, gThreads), pattern: stitchPattern(60 + i), count: 1, on: false, sewn: -1 });
      return g;
    });
    function placePoint(i) { points[i].setAttribute('transform', 'translate(' + r1(X[i]) + ' ' + r1(Y[i]) + ')'); }
    function labelPoint(i) {
      points[i].setAttribute('aria-label', (CL[i] ? 'Cross' : 'Circle') + ', point ' + (i + 1) + ' of ' + n +
        '. Arrow keys move it; Page Up and Page Down pick another point.');
    }
    for (var pi = 0; pi < n; pi++) { placePoint(pi); labelPoint(pi); }

    var gQuery = svgEl('g', { 'class': 'kf-query', transform: 'translate(' + QUERY.x + ' ' + QUERY.y + ')', 'aria-hidden': 'true' }, gIn);
    svgEl('circle', { 'class': 'kf-paper', r: 8 }, gQuery);
    ring(0, 0, 11.5, 'kf-mark', gQuery, 1.3);
    svgEl('circle', { 'class': 'kf-query__dot', r: 2 }, gQuery);

    /* ---------- the formula (above the plot) and the R (beside it) ---------- */
    var gFormula = svgEl('g', { 'class': 'kf-formula' }, root);
    var f1 = maths(['ŷ(x) = ', { up: 'mode' }, ' { y', { sub: 'i' }, ' : x', { sub: 'i' }, ' ∈ N', { sub: 'k' }, '(x) }'],
      P.x, 37, 'kf-math', gFormula);
    f1.style.setProperty('--kf-d', '300ms');
    var f2 = maths(['N', { sub: 'k' }, '(x): the k nearest by  d = ‖x − x', { sub: 'i' }, '‖'], P.x, 56, 'kf-math kf-math--small', gFormula);
    f2.style.setProperty('--kf-d', '640ms');

    var gCode = part('kf-codeblock', 860, root);
    line(SIDE_X, CODE.y - 11, SIDE_X, CODE.y + CODE.pitch * 3 + 5, 'kf-hair', gCode, 0.7, 0.4);
    var codeLines = [
      label('library(class)', CODE.x, CODE.y, 'kf-code', gCode),
      label('knn(train, test,', CODE.x, CODE.y + CODE.pitch, 'kf-code', gCode),
      label(null, CODE.x + 25.2, CODE.y + CODE.pitch * 2, 'kf-code', gCode),
      label('renv::snapshot()', CODE.x, CODE.y + CODE.pitch * 3, 'kf-code kf-code--pin', gCode)
    ];
    svgEl('tspan', null, codeLines[2]).textContent = 'cl, k = ';
    var codeK = svgEl('tspan', { 'class': 'kf-code__k' }, codeLines[2]);
    svgEl('tspan', null, codeLines[2]).textContent = ')';
    codeLines.forEach(function (t, q) { t.style.setProperty('--kf-d', (940 + q * 130) + 'ms'); });

    /* ---------- the thread that does not meet (step 0) ---------- */
    var gGap = svgEl('g', { 'class': 'kf-gap', 'aria-hidden': 'true' }, root);
    var gapA = { path: svgEl('path', { 'class': 'kf-gapline', d: quadPart(GAP, 0, GAP.from) }, gGap), pattern: stitchPattern(9) };
    var gapB = { path: svgEl('path', { 'class': 'kf-gapline', d: quadPart(GAP, GAP.to, 1) }, gGap), pattern: stitchPattern(23) };
    // the cut ends look snapped, not missing: two or three short loose strands
    // splay out of each end, the way a pulled thread frays
    function frayAt(t, dir, seed) {
      var v = 1 - t;
      var x = v * v * GAP.x0 + 2 * v * t * GAP.cx + t * t * GAP.x1, y = v * v * GAP.y0 + 2 * v * t * GAP.cy + t * t * GAP.y1;
      var dx = 2 * (v * (GAP.cx - GAP.x0) + t * (GAP.x1 - GAP.cx)) * dir, dy = 2 * (v * (GAP.cy - GAP.y0) + t * (GAP.y1 - GAP.cy)) * dir;
      var len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      var g = svgEl('g', { 'class': 'kf-fray' }, gGap), d = '';
      [[-0.55, 6.5], [0.08, 8.5], [0.6, 5.5]].forEach(function (a, k) {
        var ang = a[0] + (((seed * 7 + k * 13) % 10) / 10 - 0.5) * 0.25, L = a[1];
        var c = Math.cos(ang), sn = Math.sin(ang), rx = ux * c - uy * sn, ry = ux * sn + uy * c;
        var mx = x + rx * L * 0.55 - ry * 1.2, my = y + ry * L * 0.55 + rx * 1.2;
        d += 'M' + r1(x) + ' ' + r1(y) + ' Q' + r1(mx) + ' ' + r1(my) + ' ' + r1(x + rx * L) + ' ' + r1(y + ry * L) + ' ';
      });
      svgEl('path', { d: d.trim() }, g);
      return g;
    }
    gapA.fray = frayAt(GAP.from, 1, 3);    // end of the upper thread, splaying on into the gap
    gapB.fray = frayAt(GAP.to, -1, 8);     // start of the lower thread, splaying back up into it

    /* ---------- beside the plot: the slider for k, what to check, the vote ---------- */
    var gSide = svgEl('g', { 'class': 'kf-side' }, root);
    var S = SLIDER;
    var gSlider = svgEl('g', {
      'class': 'kf-slider', role: 'slider', 'aria-label': 'k, the number of neighbours that vote',
      'aria-valuemin': K_MIN, 'aria-valuemax': K_MAX, 'aria-orientation': 'horizontal'
    }, gSide);
    svgEl('rect', { 'class': 'kf-slider__hit', x: S.x - 14, y: S.y - 16, width: (K_MAX - K_MIN) * S.pitch + 28, height: 32 }, gSlider);
    var kText = label(null, SIDE_X, S.y - 20, 'kf-kval', gSlider);
    svgEl('tspan', { 'class': 'kf-kval__k' }, kText).textContent = 'k';
    svgEl('tspan', null, kText).textContent = ' = ';
    var kNum = svgEl('tspan', { 'class': 'kf-kval__n' }, kText);
    var gTrack = part('kf-track', 60, gSlider);
    line(S.x - 3, S.y, S.x + (K_MAX - K_MIN) * S.pitch + 3, S.y, 'kf-edge', gTrack, 1);
    for (var kq = K_MIN; kq <= K_MAX; kq++) {
      var big = kq === K_MIN || kq === K_MAX || kq % 5 === 0;
      line(S.x + (kq - K_MIN) * S.pitch, S.y + 3.5, S.x + (kq - K_MIN) * S.pitch, S.y + (big ? 8.5 : 6), big ? 'kf-fine' : 'kf-hair', gTrack, 0.7, 0.3);
    }
    label('1', S.x, S.y + 21, 'kf-label kf-label--quiet', gTrack, 'middle');
    label('15', S.x + (K_MAX - K_MIN) * S.pitch, S.y + 21, 'kf-label kf-label--quiet', gTrack, 'middle');
    var gKnobAt = svgEl('g', { transform: 'translate(' + S.x + ' ' + S.y + ')' }, gSlider);
    var gKnob = part('kf-knob', 260, gKnobAt);
    svgEl('circle', { 'class': 'kf-paper', r: 5.4 }, gKnob);
    ring(0, 0, 16.5, 'kf-knob__halo', gKnob, 0.6);
    ring(0, 0, 10.6, 'kf-knob__edge', gKnob, 1.3);

    var gLoo = part('kf-row', 360, gSide);
    label('leave-one-out', SIDE_X, S.y + 50, 'kf-label', gLoo);
    var looText = label(null, SIDE_X + 106, S.y + 50, 'kf-val', gLoo);

    var gVote = part('kf-row kf-vote', 0, gSide);
    label('vote', SIDE_X, S.y + 72, 'kf-label', gVote);
    var voteO = svgEl('g', { 'class': 'kf-vote__side' }, gVote), voteX = svgEl('g', { 'class': 'kf-vote__side' }, gVote);
    drawCircle(svgEl('g', { transform: 'translate(' + (SIDE_X + 49) + ' ' + (S.y + 68.5) + ')' }, voteO), 7.2, 1.1);
    var voteOText = label(null, SIDE_X + 58, S.y + 72, 'kf-val', voteO);
    drawCross(svgEl('g', { transform: 'translate(' + (SIDE_X + 91) + ' ' + (S.y + 68.5) + ')' }, voteX), 4, 1.15, 4);
    var voteXText = label(null, SIDE_X + 100, S.y + 72, 'kf-val', voteX);

    // the quiet note (step 2), in the hand the margin notes are written in
    var gHand = svgEl('g', { 'class': 'kf-handnote', transform: 'rotate(-2.2 ' + SIDE_X + ' ' + (S.y + 104) + ')', 'aria-hidden': 'true' }, root);
    label('same points in,', SIDE_X + 2, S.y + 110, 'kf-hand', gHand);
    label('same line out.', SIDE_X + 10, S.y + 133, 'kf-hand kf-hand--2', gHand);

    /* ---------- callouts ---------- */
    var gNotes = svgEl('g', { 'class': 'kf-notes', 'aria-hidden': 'true' }, root);
    var notes = CALLOUTS.map(function (c) {
      var g = svgEl('g', { 'class': 'kf-note' }, gNotes);
      var leader = svgEl('path', { 'class': 'kf-note__leader', pathLength: '1' }, g);
      var t = svgEl('text', { 'class': 'kf-note__text', x: c.x, y: c.y }, g);
      t.textContent = '(' + c.key + ') ' + c.text;
      return { c: c, g: g, leader: leader };
    });
    // a leader: a thin, slightly bowed line from (x0, y0) that stops `gap` short of (x1, y1)
    function leaderD(x0, y0, x1, y1, gap) {
      var dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
      var ex1 = x1 - dx / len * gap, ey1 = y1 - dy / len * gap, bowBy = Math.min(9, len * 0.09);
      return 'M' + r1(x0) + ' ' + r1(y0) + ' Q' + r1((x0 + ex1) / 2 + dy / len * bowBy) + ' ' + r1((y0 + ey1) / 2 - dx / len * bowBy) + ' ' + r1(ex1) + ' ' + r1(ey1);
    }
    notes[0].leader.setAttribute('d', 'M503 151 Q495 131 499 113');   // into the middle of the gap
    notes[1].leader.setAttribute('d', 'M494 208 Q499 200 508 193');
    // (c) points at whichever data point sits nearest to where it is written
    var dragTarget = 0;
    (function () {
      var best = Infinity;
      for (var i = 0; i < n; i++) {
        var d = Math.hypot(P.x + DATA[i].x - 470, P.y + DATA[i].y - 184);
        if (d < best) { best = d; dragTarget = i; }
      }
    })();
    function aimDragNote() {
      notes[2].leader.setAttribute('d', leaderD(469, 184, P.x + X[dragTarget], P.y + Y[dragTarget], 9));
    }
    aimDragNote();

    /* ---------- stitched paths: shown one stitch at a time ---------- */
    [gapA, gapB].forEach(function (s) {
      var len = 0;
      try { len = s.path.getTotalLength(); } catch (err) { len = 0; }
      if (!len) len = 110;
      s.count = Math.max(1, Math.ceil(len / 9.5));
      setSewn(s, 0);
    });
    function setSewn(s, count) {
      if (s.sewn === count) return;
      var d;
      if (count === Infinity) d = s.pattern.join(' ');
      else if (count <= 0) d = '0 99999';
      else {
        var out = [];
        for (var q = 0; q < count * 2 - 1; q++) out.push(s.pattern[q % s.pattern.length]);
        out.push(99999);
        d = out.join(' ');
      }
      s.sewn = count;
      if (s.fray) s.fray.classList.toggle('is-shown', count === Infinity || (s.count && count >= s.count));
      s.path.style.visibility = count <= 0 ? 'hidden' : '';   // a round-capped empty dash would leave a dot
      s.path.setAttribute('stroke-dasharray', d);
    }
    function sew(s, ms, done) {
      setSewn(s, 0);
      jobs.push({
        step: function (t) {
          var c = Math.floor(t / ms) + 1;
          if (c >= s.count) { setSewn(s, Infinity); return true; }
          setSewn(s, c);
          return false;
        },
        done: done
      });
      kick();
    }

    /* ---------- one clock for everything timed; it only runs while the figure is on screen ---------- */
    var dirty = false;        // a point moved: recompute on the next frame, once
    function kick() {
      if (raf || destroyed || !visible) return;
      if (!tasks.length && !jobs.length && !dirty) return;
      lastT = 0;
      raf = requestAnimationFrame(frame);
    }
    function frame(now) {
      raf = 0;
      if (destroyed) return;
      clock += lastT ? Math.min(50, now - lastT) : 16;
      lastT = now;
      var i, due = [];
      if (dirty) { dirty = false; refresh(false); }
      for (i = tasks.length - 1; i >= 0; i--) if (tasks[i].at <= clock) due.push(tasks.splice(i, 1)[0]);
      due.sort(function (a, b) { return a.at - b.at; });
      for (i = 0; i < due.length; i++) if (due[i].tok === token) due[i].fn();
      for (i = jobs.length - 1; i >= 0; i--) {
        var j = jobs[i];
        if (j.start == null) j.start = clock;
        if (j.step(clock - j.start)) {
          var q = jobs.indexOf(j);
          if (q >= 0) jobs.splice(q, 1);
          if (j.done) j.done();
        }
      }
      if ((tasks.length || jobs.length || dirty) && visible) raf = requestAnimationFrame(frame);
    }
    function later(ms, fn) { tasks.push({ at: clock + ms, fn: fn, tok: token }); kick(); }
    function cancelAll() { settleSweep(); token++; tasks.length = 0; jobs.length = 0; }
    function reflow(node) { try { node.getBoundingClientRect(); } catch (err) { /* fine */ } }

    /* ---------- re-hatching: a front crosses the plot, line by line; behind it the new ink, ahead the old ---------- */
    var fieldOn = false, sweep = null, front = -1;
    function strip(s0, s1) {
      function pt(s, t) { return r1(hx(s, t)) + ',' + r1(hy(s, t)); }
      return pt(s0, -700) + ' ' + pt(s0, 700) + ' ' + pt(s1, 700) + ' ' + pt(s1, -700);
    }
    function setFront(f) {
      if (f === front) return;
      front = f;
      polyA.setAttribute('points', strip(-80, HATCH_GAP * f));
      polyB.setAttribute('points', strip(HATCH_GAP * f, S_MAX + 80));
    }
    function clipOn(contourToo) {
      hatchNew.setAttribute('clip-path', 'url(#' + uid + 'a)');
      if (contourToo) contourNew.setAttribute('clip-path', 'url(#' + uid + 'a)');
    }
    function clipOff() {
      hatchNew.removeAttribute('clip-path');
      contourNew.removeAttribute('clip-path');
      hatchOld.removeAttribute('d');
      contourOld.removeAttribute('d');
    }
    function settleSweep() {
      if (!sweep) return;
      var s = sweep;
      sweep = null;
      var q = jobs.indexOf(s.job);
      if (q >= 0) jobs.splice(q, 1);
      s.finish();
    }
    function runSweep(from, to, ms, contourToo, finish) {
      settleSweep();
      front = -1;
      setFront(from);
      clipOn(contourToo);
      var job = {
        step: function (t) {
          var u = Math.min(1, t / ms);
          setFront(Math.round(from + (to - from) * u));
          return u >= 1;
        },
        done: function () { sweep = null; finish(); }
      };
      sweep = { job: job, finish: finish };
      jobs.push(job);
      kick();
    }
    function paint() {
      contourNew.setAttribute('d', contourD);
      hatchNew.setAttribute('d', lineD.join(''));
    }
    // recompute from the points and k. animated: re-hatch only the band that changed.
    function refresh(animated) {
      settleSweep();
      var was = animated && fieldOn && !reduced && visible ? lineD.slice() : null;
      var wasContour = contourD;
      compute();
      var lo = -1, hi = -1;
      if (was) for (var m = 0; m < HM; m++) if (was[m] !== lineD[m]) { if (lo < 0) lo = m; hi = m; }
      if (lo >= 0) {
        hatchOld.setAttribute('d', was.join(''));
        contourOld.setAttribute('d', wasContour);
        paint();
        lo = Math.max(0, lo - 2); hi = Math.min(HM, hi + 3);
        runSweep(lo, hi, clamp((hi - lo) * 6, 200, 520), true, clipOff);
      } else paint();
      readouts();
      if (step === 1 && !drawing) setThreads('new');
      aimDragNote();
    }
    function showField(animate) {
      if (fieldOn) return;
      fieldOn = true;
      paint();
      svg.classList.add('kf-field');                       // the contour is drawn in (CSS)
      hatchNew.style.visibility = '';
      if (animate) runSweep(0, HM, 820, false, clipOff);   // and the hatching follows, one line at a time
      else clipOff();
    }
    function hideField(animate) {
      if (!fieldOn) { hatchNew.style.visibility = 'hidden'; return; }
      fieldOn = false;
      svg.classList.remove('kf-field');
      function gone() { hatchNew.style.visibility = 'hidden'; clipOff(); }
      if (animate) runSweep(HM, 0, 300, false, gone);
      else gone();
    }

    /* ---------- the query point and its k threads ---------- */
    // mode: 'off' | 'now' (all sewn at once) | 'new' (only newly joined neighbours are sewn in) | 'stagger' (nearest first)
    function setThreads(mode) {
      var i, r, m = 0, rank = new Int16Array(n).fill(-1);
      if (mode !== 'off') {
        m = nearest(QUERY.x, QUERY.y, -1);
        for (r = 0; r < m; r++) rank[bestI[r]] = r;
      }
      for (i = 0; i < n; i++) {
        var th = threads[i];
        if (rank[i] < 0) { th.on = false; setSewn(th, 0); continue; }
        var dx = X[i] - QUERY.x, dy = Y[i] - QUERY.y, len = Math.hypot(dx, dy) || 1;
        var a = 8.5 / len, b = 1 - 7.5 / len;
        if (b <= a) { th.on = false; setSewn(th, 0); continue; }          // sitting on the query: no room for a thread
        th.path.setAttribute('d', 'M' + r1(QUERY.x + dx * a) + ' ' + r1(QUERY.y + dy * a) + ' L' + r1(QUERY.x + dx * b) + ' ' + r1(QUERY.y + dy * b));
        th.count = Math.max(1, Math.ceil(len * (b - a) / 9.5));
        var isNew = !th.on;
        th.on = true;
        if (mode === 'now' || reduced) setSewn(th, Infinity);
        else if (mode === 'stagger') { setSewn(th, 0); sewLater(th, 380 + rank[i] * 70); }
        else if (isNew) sew(th, STITCH_MS);
      }
    }
    function sewLater(th, ms) { later(ms, function () { if (th.on && step === 1) sew(th, STITCH_MS); }); }

    function readouts() {
      looText.textContent = Math.round(looAccuracy() * 100) + '%';
      var m = nearest(QUERY.x, QUERY.y, -1), v = 0;
      for (var j = 0; j < m; j++) v += CL[bestI[j]];
      var win = 2 * v > m ? 1 : 2 * v < m ? 0 : CL[bestI[0]];
      voteOText.textContent = String(m - v);
      voteXText.textContent = String(v);
      voteO.classList.toggle('is-losing', win === 1);
      voteX.classList.toggle('is-losing', win === 0);
      gSlider.setAttribute('aria-valuetext', 'k = ' + k + ', leave-one-out accuracy ' + looText.textContent);
    }

    /* ---------- the slider ---------- */
    function showK() {
      kNum.textContent = String(k);
      codeK.textContent = String(k);
      gKnob.style.transform = 'translate(' + (k - K_MIN) * S.pitch + 'px, 0px)';
      gSlider.setAttribute('aria-valuenow', k);
    }
    function setK(v) {
      v = clamp(Math.round(v), K_MIN, K_MAX);
      if (v === k) return;
      k = v;
      showK();
      refresh(true);
    }
    var sliding = null;
    function sliderLive() { return step > 0 && !drawing && !destroyed; }
    function kAt(e) { return K_MIN + (toDrawing(e).x - S.x) / S.pitch; }
    function onSliderDown(e) {
      if (!sliderLive() || e.button) return;
      e.preventDefault();
      sliding = e.pointerId;
      try { gSlider.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
      gSlider.classList.add('is-held');
      setK(kAt(e));
    }
    function onSliderMove(e) { if (sliding === e.pointerId) setK(kAt(e)); }
    function onSliderUp(e) {
      if (sliding !== e.pointerId) return;
      sliding = null;
      gSlider.classList.remove('is-held');
      try { gSlider.releasePointerCapture(e.pointerId); } catch (err) { /* fine */ }
    }
    function onSliderKey(e) {
      if (!sliderLive() || e.altKey || e.ctrlKey || e.metaKey) return;
      var to = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') to = k + 1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') to = k - 1;
      else if (e.key === 'PageUp') to = k + 3;
      else if (e.key === 'PageDown') to = k - 3;
      else if (e.key === 'Home') to = K_MIN;
      else if (e.key === 'End') to = K_MAX;
      if (to === null) return;
      e.preventDefault();                      // the arrows belong to the slider while it has focus
      setK(to);
    }
    gSlider.addEventListener('pointerdown', onSliderDown);
    gSlider.addEventListener('pointermove', onSliderMove);
    gSlider.addEventListener('pointerup', onSliderUp);
    gSlider.addEventListener('pointercancel', onSliderUp);
    gSlider.addEventListener('keydown', onSliderKey);

    /* ---------- moving points (step 2): drag with a mouse or pen, tap then drag with a finger, or the arrow keys ---------- */
    var drag = null, pin = -1, cur = 0;
    function pointsLive() { return step === 2 && !drawing && !destroyed; }
    function toDrawing(e) {
      var r = svg.getBoundingClientRect();
      return { x: (e.clientX - r.left) / scale - offX, y: (e.clientY - r.top) / scale - offY };
    }
    function ptOf(e) {
      var t = e.target && e.target.closest ? e.target.closest('.kf-pt') : null;
      return t && gPoints.contains(t) ? +t.getAttribute('data-i') : -1;
    }
    function setPin(i) {
      if (pin >= 0) points[pin].classList.remove('is-pinned');
      pin = i;
      if (pin >= 0) points[pin].classList.add('is-pinned');
    }
    function moveTo(i, x, y) {
      x = clamp(x, EDGE, P.w - EDGE); y = clamp(y, EDGE, P.h - EDGE);
      if (x === X[i] && y === Y[i]) return;
      X[i] = x; Y[i] = y;
      placePoint(i);
      dirty = true;
      kick();
    }
    function onDown(e) {
      if (!pointsLive()) return;
      var i = ptOf(e);
      if (i < 0) { setPin(-1); return; }
      if (e.pointerType === 'touch' && pin !== i) { setPin(i); return; }   // a first touch picks; a finger passing over still scrolls
      if (e.button) return;
      e.preventDefault();
      var p = toDrawing(e);
      drag = { id: e.pointerId, i: i, ox: X[i] - (p.x - P.x), oy: Y[i] - (p.y - P.y) };
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
      gPoints.appendChild(points[i]);                       // the held point rides above the rest
      points[i].classList.add('is-held');
      svg.classList.add('is-dragging');
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var p = toDrawing(e);
      moveTo(drag.i, p.x - P.x + drag.ox, p.y - P.y + drag.oy);
    }
    function endDrag() {
      if (!drag) return;
      points[drag.i].classList.remove('is-held');
      svg.classList.remove('is-dragging');
      try { svg.releasePointerCapture(drag.id); } catch (err) { /* fine */ }
      drag = null;
    }
    function onUp(e) { if (drag && e.pointerId === drag.id) endDrag(); }
    function roving() {
      for (var i = 0; i < n; i++) {
        if (pointsLive()) points[i].setAttribute('tabindex', i === cur ? '0' : '-1');
        else points[i].removeAttribute('tabindex');
      }
    }
    function onKey(e) {
      if (!pointsLive() || e.altKey || e.ctrlKey || e.metaKey) return;
      var i = ptOf(e);
      if (i < 0) return;
      var by = e.shiftKey ? 1 : NUDGE;
      var dx = e.key === 'ArrowLeft' ? -by : e.key === 'ArrowRight' ? by : 0;
      var dy = e.key === 'ArrowUp' ? -by : e.key === 'ArrowDown' ? by : 0;
      if (dx || dy) { e.preventDefault(); moveTo(i, X[i] + dx, Y[i] + dy); return; }   // the arrows belong to the point while it has focus
      if (e.key === 'PageDown' || e.key === 'PageUp') {
        e.preventDefault();
        cur = (i + (e.key === 'PageDown' ? 1 : n - 1)) % n;
        roving();
        try { points[cur].focus({ preventScroll: true }); } catch (err) { /* fine */ }
      }
    }
    function onFocusIn(e) { var i = ptOf(e); if (i >= 0 && i !== cur) { cur = i; roving(); } }
    // a mouse moves points and the slider; it does not move keyboard focus into the drawing
    function onMouseDown(e) {
      var t = e.target && e.target.closest ? e.target.closest('.kf-pt, .kf-slider') : null;
      if (t && (pointsLive() || sliderLive())) e.preventDefault();
    }
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('keydown', onKey);
    svg.addEventListener('focusin', onFocusIn);
    svg.addEventListener('mousedown', onMouseDown);

    /* ---------- step states ---------- */
    function showNotes(on) {
      notes.forEach(function (q) { q.g.classList.toggle('is-shown', on && q.c.step === step); });
    }
    function setStepClass(shown) {
      for (var q = 0; q < 3; q++) svg.classList.toggle('kf-step-' + q, q === shown);
      if (shown > 0) { gSlider.setAttribute('tabindex', '0'); gSlider.removeAttribute('aria-hidden'); }
      else { gSlider.removeAttribute('tabindex'); gSlider.setAttribute('aria-hidden', 'true'); }
      if (shown !== 2) { endDrag(); setPin(-1); }
      roving();
    }
    // from: the step we came from (-1: first drawing). animate: false -> the finished state at once.
    function apply(animate, from) {
      cancelAll();
      animate = animate && !reduced;
      setStepClass(step);
      showNotes(true);

      // the thread that does not meet belongs to step 0 only
      if (step === 0 && animate) {
        setSewn(gapA, 0); setSewn(gapB, 0);
        later(from === -1 ? 0 : 260, function () { sew(gapA, GAP_STITCH_MS); sew(gapB, GAP_STITCH_MS); });
      } else {
        setSewn(gapA, step === 0 ? Infinity : 0);
        setSewn(gapB, step === 0 ? Infinity : 0);
      }

      if (step === 0) hideField(animate);
      else if (animate && !fieldOn) later(from === -1 ? 0 : 160, function () { showField(true); });
      else showField(false);

      if (step === 1) setThreads(animate ? 'stagger' : 'now');
      else setThreads('off');
    }

    /* ---------- drawing in ---------- */
    function drawIn() {
      started = true;
      cancelAll();
      endDrag();
      resetData();
      k = K_START;
      for (var i = 0; i < n; i++) placePoint(i);
      showK();
      compute();
      readouts();
      aimDragNote();
      // everything starts from the plain sheet: the faint plot, the formula and the code are drawn first
      fieldOn = false;
      svg.classList.remove('kf-field');
      hatchNew.style.visibility = 'hidden';
      clipOff();
      if (reduced) { svg.classList.remove('is-undrawn'); drawing = false; apply(false, -1); return; }
      drawing = true;
      setThreads('off');
      setSewn(gapA, 0); setSewn(gapB, 0);
      showNotes(false);
      setStepClass(0);
      svg.classList.add('is-undrawn');
      reflow(svg);
      later(40, function () { svg.classList.remove('is-undrawn'); });
      later(1500, function () { drawing = false; apply(true, -1); });
    }

    /* ---------- size + visibility ---------- */
    function measure() {
      var w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return false;
      // the whole drawing scales to the box (a little up, or down) instead of crowding or floating
      scale = Math.min(MAX_SCALE, (w - PAD * 2) / (INK.x1 - INK.x0), (h - PAD * 2) / (INK.y1 - INK.y0));
      var W = w / scale, H = h / scale;
      offX = (W - INK.x0 - INK.x1) / 2; offY = (H - INK.y0 - INK.y1) / 2;   // even margins all round
      svg.setAttribute('viewBox', '0 0 ' + r1(W) + ' ' + r1(H));
      root.setAttribute('transform', 'translate(' + r1(offX) + ' ' + r1(offY) + ')');
      return true;
    }
    var ro = null, io = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () {
        if (destroyed) return;
        if (measure() && !started) maybeStart();
      });
      ro.observe(el);
    }
    function maybeStart() {
      if (started || !visible || !el.clientWidth || !el.clientHeight) return;
      drawIn();
    }
    if (window.IntersectionObserver) {
      visible = false;
      io = new IntersectionObserver(function (entries) {
        visible = entries[entries.length - 1].isIntersecting;
        if (!visible) { if (raf) { cancelAnimationFrame(raf); raf = 0; } return; }   // off-screen: frozen
        if (!started) maybeStart();
        else kick();
      }, { threshold: 0.05 });
      io.observe(el);
    }

    // first paint: nothing inked yet (the draw-in starts once the figure is on screen)
    if (!reduced) svg.classList.add('is-undrawn');
    showK();
    setStepClass(0);
    measure();
    maybeStart();

    return {
      setStep: function (to) {
        if (destroyed) return;
        to = Math.max(0, Math.min(2, +to || 0));
        if (to === step) return;
        var from = step;
        step = to;
        if (drawing || !started) return;       // the draw-in ends by applying the current step
        apply(true, from);
      },
      replay: function () {
        if (destroyed) return;
        if (!el.clientWidth || !el.clientHeight) return;
        drawIn();
      },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        cancelAll();
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        if (ro) ro.disconnect();
        if (io) io.disconnect();
        gSlider.removeEventListener('pointerdown', onSliderDown);
        gSlider.removeEventListener('pointermove', onSliderMove);
        gSlider.removeEventListener('pointerup', onSliderUp);
        gSlider.removeEventListener('pointercancel', onSliderUp);
        gSlider.removeEventListener('keydown', onSliderKey);
        svg.removeEventListener('pointerdown', onDown);
        svg.removeEventListener('pointermove', onMove);
        svg.removeEventListener('pointerup', onUp);
        svg.removeEventListener('pointercancel', onUp);
        svg.removeEventListener('keydown', onKey);
        svg.removeEventListener('focusin', onFocusIn);
        svg.removeEventListener('mousedown', onMouseDown);
        el.textContent = '';
      }
    };
  }

  var NOOP = { setStep: function () {}, replay: function () {}, destroy: function () {} };
  window.ShowcaseFigures = window.ShowcaseFigures || {};
  window.ShowcaseFigures['knn-figure'] = {
    mount: function (el, opts) {
      try { return mount(el, opts); }
      catch (err) {
        if (window.console) console.warn('[knn-figure] could not mount', err);
        try { if (el) el.textContent = ''; } catch (e2) { /* nothing left to do */ }
        return NOOP;
      }
    }
  };
})();
