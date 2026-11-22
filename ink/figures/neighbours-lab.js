/* Nearest neighbours by hand — the reader names a new point before the rule is shown.
   Steps: 0 two kinds of made-up plant and one new one (the ?). Drag it anywhere, then say what you think it is.
          1 threads to the nearest few, and their vote. A slider sets how many get a vote; the answer can flip.
          2 the whole map: every spot coloured by its vote (hatched = the crosses win), with a slider for how many
            vote, from 1 (every stray point gets an island) to all 29 (the bigger group wins everywhere).
   The new point and the guess are remembered (sessionStorage) and shared by every copy of the figure on the page,
   and offered to the page's Python as `new_point`, with the plants as `points` and their kinds as `kinds`.
   Everything is computed: squared distance (across times across plus up times up), the k smallest, a count.
   Made-up points, fixed seed. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var PLOT = { x: 44, y: 34, w: 392, h: 372 }, SIDE = 462, DOM = 10;
  var SHAPES = ['o', '+'], NAMES = ['circle', 'cross'];
  var STORE = 'ink-knn-new', EVENT = 'ink:knn-new';
  var DEFAULT = [4.4, 3.6];
  var GX = 50, GY = 47;                       // the map in step 2 is worked out at GX x GY spots

  function r1(v) { return Math.round(v * 10) / 10; }
  function makePoints(rand) {
    function g() { return rand() + rand() + rand() - 1.5; }
    var pts = [], kinds = [];
    // 16 circles around (3.6, 4.0), 13 crosses around (6.3, 6.1), wide enough that a few stray into the other group
    [[3.6, 4.0, 16, 3.4, 0], [6.3, 6.1, 13, 3.2, 1]].forEach(function (c) {
      for (var i = 0; i < c[2]; i++) {
        pts.push([r1(Math.min(9.6, Math.max(0.4, c[0] + g() * c[3]))), r1(Math.min(9.6, Math.max(0.4, c[1] + g() * c[3])))]);
        kinds.push(c[4]);
      }
    });
    return { pts: pts, kinds: kinds };
  }
  // made once, to one decimal, so the page's Python works on exactly the same plants
  var DATA = makePoints(window.InkKit.rng(4));
  var POINTS = DATA.pts, KINDS = DATA.kinds, N = POINTS.length;

  function d2(p, q) { var a = p[0] - q[0], b = p[1] - q[1]; return a * a + b * b; }
  /* the k nearest, nearest first (ties go to the earlier point, as the page's Python does) */
  function nearest(q, k) {
    var order = POINTS.map(function (p, i) { return { i: i, d: d2(p, q) }; });
    order.sort(function (a, b) { return a.d - b.d || a.i - b.i; });
    return order.slice(0, k);
  }
  function count(near) {
    var c = [0, 0];
    near.forEach(function (e) { c[KINDS[e.i]]++; });
    return c;
  }
  function winner(c) { return c[1] > c[0] ? 1 : 0; }

  function remembered() {
    try {
      var v = JSON.parse(sessionStorage.getItem(STORE));
      if (v && Array.isArray(v.p) && v.p.length === 2) return v;
    } catch (e) {}
    return { p: DEFAULT.slice(), guess: null };
  }
  function remember(state, from) {
    try { sessionStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent(EVENT, { detail: { from: from } })); } catch (e) {}
  }

  /* what `from page import points, kinds, new_point` gives the Python on the same page (see ink/py.js) */
  window.InkPage = window.InkPage || {};
  window.InkPage.points = function () { return POINTS; };
  window.InkPage.kinds = function () { return KINDS; };
  window.InkPage.new_point = function () { return remembered().p; };

  var MOUNTS = 0;

  window.InkKit.define('neighbours-lab', {
    label: 'Nearest neighbours by hand: name a new point, see which known points are nearest and how they vote, then the whole map for any number of voters',
    steps: 3,
    seed: 23,
    draw: function (k) {
      var me = ++MOUNTS;
      var sx = k.scale(0, DOM, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(0, DOM, PLOT.y + PLOT.h, PLOT.y);
      function fromX(x) { return r1((x - PLOT.x) / PLOT.w * DOM); }
      function fromY(y) { return r1((PLOT.y + PLOT.h - y) / PLOT.h * DOM); }
      var state = remembered();
      var k1 = 5, k2 = 5, grow = 1, busy = false;

      var ticks = [0, 2, 4, 6, 8, 10];
      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'leaf length', ylabel: 'leaf width',
        xticks: ticks.map(function (v) { return [sx(v), String(v)]; }),
        yticks: ticks.map(function (v) { return [sy(v), v ? String(v) : null]; }) });

      /* ---- step 2: the map. A hatch (one path of cells, filled with a pattern) and the border, both live ---- */
      var NS = 'http://www.w3.org/2000/svg';
      var defs = k.svg.querySelector('defs');
      var patId = 'nbh-' + me + '-' + Math.floor(Math.random() * 1e6);
      var pat = document.createElementNS(NS, 'pattern');
      pat.setAttribute('id', patId); pat.setAttribute('patternUnits', 'userSpaceOnUse');
      pat.setAttribute('width', '5'); pat.setAttribute('height', '5'); pat.setAttribute('patternTransform', 'rotate(-40)');
      var pl = document.createElementNS(NS, 'line');
      pl.setAttribute('x1', '0'); pl.setAttribute('y1', '0'); pl.setAttribute('x2', '0'); pl.setAttribute('y2', '5');
      pl.setAttribute('stroke', 'currentColor'); pl.setAttribute('stroke-width', '0.6');
      pat.appendChild(pl); defs.appendChild(pat);
      var mapLayer = k.root.layer({ steps: [2] });
      var hatchPath = document.createElementNS(NS, 'path');
      hatchPath.setAttribute('fill', 'url(#' + patId + ')'); hatchPath.setAttribute('opacity', '0.45');
      hatchPath.setAttribute('stroke', 'none');
      mapLayer.node.appendChild(hatchPath);
      var borderPath = document.createElementNS(NS, 'path');
      borderPath.setAttribute('fill', 'none'); borderPath.setAttribute('stroke', 'currentColor');
      borderPath.setAttribute('stroke-width', '1.4'); borderPath.setAttribute('stroke-linecap', 'round');
      borderPath.setAttribute('stroke-linejoin', 'round'); borderPath.setAttribute('opacity', '0.85');
      mapLayer.node.appendChild(borderPath);
      var cw = PLOT.w / (GX - 1), ch = PLOT.h / (GY - 1);
      var spots = [];
      for (var gy = 0; gy < GY; gy++) for (var gx = 0; gx < GX; gx++) spots.push([fromXexact(PLOT.x + gx * cw), fromYexact(PLOT.y + gy * ch)]);
      function fromXexact(x) { return (x - PLOT.x) / PLOT.w * DOM; }
      function fromYexact(y) { return (PLOT.y + PLOT.h - y) / PLOT.h * DOM; }
      var cache = {};
      function mapFor(kk) {
        if (cache[kk]) return cache[kk];
        return (cache[kk] = spots.map(function (s) { return winner(count(nearest(s, kk))); }));
      }
      function drawMap() {
        var m = mapFor(k2), d = '', gx, gy, i;
        // hatch: in every little square, the part on the crosses' side (corners that say cross, and the
        // halfway points where two corners disagree), so the hatch and the border meet exactly
        function corner(gx, gy) { return [PLOT.x + gx * cw, PLOT.y + gy * ch]; }
        function half(p, q) { return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; }
        for (gy = 0; gy < GY - 1; gy++) {
          for (gx = 0; gx < GX - 1; gx++) {
            i = gy * GX + gx;
            var cs = [m[i], m[i + 1], m[i + GX + 1], m[i + GX]];
            if (!cs[0] && !cs[1] && !cs[2] && !cs[3]) continue;
            var ps = [corner(gx, gy), corner(gx + 1, gy), corner(gx + 1, gy + 1), corner(gx, gy + 1)], poly = [];
            for (var n = 0; n < 4; n++) {
              if (cs[n]) poly.push(ps[n]);
              if (cs[n] !== cs[(n + 1) % 4]) poly.push(half(ps[n], ps[(n + 1) % 4]));
            }
            poly.forEach(function (p, j) { d += (j ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); });
            d += 'Z';
          }
        }
        hatchPath.setAttribute('d', d);
        // border: marching squares, a short segment across every square whose corners disagree
        var b = '';
        function mid(ax, ay, bx, by) { return [PLOT.x + (ax + bx) / 2 * cw, PLOT.y + (ay + by) / 2 * ch]; }
        for (gy = 0; gy < GY - 1; gy++) {
          for (gx = 0; gx < GX - 1; gx++) {
            i = gy * GX + gx;
            var a = m[i], bb = m[i + 1], c = m[i + GX + 1], e = m[i + GX];
            var cut = [];
            if (a !== bb) cut.push(mid(gx, gy, gx + 1, gy));
            if (bb !== c) cut.push(mid(gx + 1, gy, gx + 1, gy + 1));
            if (c !== e) cut.push(mid(gx + 1, gy + 1, gx, gy + 1));
            if (e !== a) cut.push(mid(gx, gy + 1, gx, gy));
            for (var j = 0; j + 1 < cut.length; j += 2) {
              b += 'M' + cut[j][0].toFixed(1) + ' ' + cut[j][1].toFixed(1) + 'L' + cut[j + 1][0].toFixed(1) + ' ' + cut[j + 1][1].toFixed(1);
            }
          }
        }
        borderPath.setAttribute('d', b);
      }

      /* ---- step 1: threads to the nearest few, a ring on each, and a dotted circle as far as the last one ---- */
      var threadLayer = k.root.layer({ steps: [1] });
      var reach = document.createElementNS(NS, 'path');
      reach.setAttribute('fill', 'none'); reach.setAttribute('stroke', 'currentColor'); reach.setAttribute('stroke-width', '0.8');
      reach.setAttribute('stroke-dasharray', '1.5 4'); reach.setAttribute('stroke-linecap', 'round'); reach.setAttribute('opacity', '0.5');
      threadLayer.node.appendChild(reach);
      var thread = document.createElementNS(NS, 'path');
      thread.setAttribute('fill', 'none'); thread.setAttribute('stroke', 'currentColor'); thread.setAttribute('stroke-width', '1');
      thread.setAttribute('stroke-dasharray', '3.5 3.5'); thread.setAttribute('stroke-linecap', 'round'); thread.setAttribute('opacity', '0.6');
      threadLayer.node.appendChild(thread);
      var rings = document.createElementNS(NS, 'path');
      rings.setAttribute('fill', 'none'); rings.setAttribute('stroke', 'currentColor'); rings.setAttribute('stroke-width', '1');
      rings.setAttribute('opacity', '0.75');
      threadLayer.node.appendChild(rings);
      function circleD(x, y, r) {
        return 'M' + (x - r).toFixed(1) + ' ' + y.toFixed(1) + 'a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0';
      }
      function drawThreads() {
        var q = state.p, near = nearest(q, k1), qx = sx(q[0]), qy = sy(q[1]), d = '', r = '';
        // grow: 0..1 sews the threads out one after another, nearest first
        near.forEach(function (e, n) {
          var t = Math.max(0, Math.min(1, grow * near.length - n));
          if (t <= 0) return;
          var px = sx(POINTS[e.i][0]), py = sy(POINTS[e.i][1]);
          d += 'M' + qx.toFixed(1) + ' ' + qy.toFixed(1) + 'L' + (qx + (px - qx) * t).toFixed(1) + ' ' + (qy + (py - qy) * t).toFixed(1);
          if (t >= 1) r += circleD(px, py, 8);
        });
        thread.setAttribute('d', d); rings.setAttribute('d', r);
        var far = Math.sqrt(near[near.length - 1].d) * PLOT.w / DOM;
        reach.setAttribute('d', grow >= 1 ? circleD(qx, qy, far) : '');
      }

      /* ---- the plants: drawn once ---- */
      var marks = k.root.group({ d: 150, stagger: 14 });
      POINTS.forEach(function (p, i) { marks.mark(sx(p[0]), sy(p[1]), SHAPES[KINDS[i]], { r: 3.8 }); });
      marks.node.style.pointerEvents = 'none';

      /* ---- the new point: the one accent, drawn at the origin and moved ---- */
      var star = k.root.group({ d: 0, stagger: 0 });
      var starG = star.group({ d: 700 });
      starG.circle(0, 0, 8, { accent: true, w: 1.6, op: 0.95, dur: 300 });
      starG.dot(0, 0, 2.2, { accent: true });
      starG.text(12, -9, '?', { kind: 'hand', accent: true });
      var grab = document.createElementNS(NS, 'circle');
      grab.setAttribute('r', 16); grab.setAttribute('class', 'ik-hit');
      starG.node.appendChild(grab);
      function placeStar() {
        starG.node.setAttribute('transform', 'translate(' + sx(state.p[0]).toFixed(1) + ' ' + sy(state.p[1]).toFixed(1) + ')');
      }
      var drag = k.draggable(starG.node, {
        label: 'The new point. Drag it, or use the arrow keys.',
        bounds: { x0: PLOT.x + 4, y0: PLOT.y + 4, x1: PLOT.x + PLOT.w - 4, y1: PLOT.y + PLOT.h - 4 },
        onMove: function (x, y) {
          if (busy) return;
          state.p = [fromX(x), fromY(y)];
          placeStar(); refresh(); remember(state, me);
        }
      });

      /* ---- the column beside the plot ---- */
      // step 0: your guess
      var g0 = k.root.group({ steps: [0], d: 300 });
      g0.text(SIDE, 60, 'what is the ?', { kind: 'label' });
      g0.line(SIDE, 72, SIDE + 158, 72, { w: 0.6, op: 0.45, rough: 0.3 });
      k.button(SIDE + 18, 102, 'a circle', function () { choose(0); }, { steps: [0] });
      k.button(SIDE + 18, 138, 'a cross', function () { choose(1); }, { steps: [0] });
      g0.mark(SIDE + 5, 98, 'o', { r: 3.6 }); g0.mark(SIDE + 5, 134, '+', { r: 3.6 });
      g0.text(SIDE, 182, 'you said', { kind: 'label' });
      var vSaid0 = g0.text(SIDE + 158, 182, '–', { kind: 'val', anchor: 'end' });
      g0.callout('a', 'drag the ? anywhere', SIDE, 226);
      var h0 = k.root.group({ steps: [0], d: 200 });
      var h0a = h0.text(SIDE, 300, 'so which points', { kind: 'hand' });
      var h0b = h0.text(SIDE, 322, 'did you look at?', { kind: 'hand' });
      function choose(v) { state.guess = v; remember(state, me); refresh(); }

      // step 1: the vote of the nearest few
      var g1 = k.root.group({ steps: [1], d: 300 });
      g1.text(SIDE, 60, 'you said', { kind: 'label' });
      var vSaid1 = g1.text(SIDE + 158, 60, '–', { kind: 'val', anchor: 'end' });
      var s1 = k.slider({ x: SIDE, y: 112, w: 158, min: 1, max: 15, step: 2, value: k1, label: 'how many vote', steps: [1],
        onChange: function (v) { k1 = v; grow = 1; refresh(); } });
      g1.mark(SIDE + 5, 148, 'o', { r: 3.4 }); g1.mark(SIDE + 5, 168, '+', { r: 3.4 });
      g1.text(SIDE + 18, 152, 'circles', { kind: 'label' });
      var vC1 = g1.text(SIDE + 158, 152, '', { kind: 'val', anchor: 'end' });
      g1.text(SIDE + 18, 172, 'crosses', { kind: 'label' });
      var vX1 = g1.text(SIDE + 158, 172, '', { kind: 'val', anchor: 'end' });
      g1.line(SIDE, 184, SIDE + 158, 184, { w: 0.6, op: 0.45, rough: 0.3 });
      g1.text(SIDE, 204, 'the vote says', { kind: 'label' });
      var vSays1 = g1.text(SIDE + 158, 204, '', { kind: 'val', anchor: 'end' });
      g1.callout('b', 'only the nearest count', SIDE, 246);
      k.button(SIDE, 286, 'count again', function () { sew(); }, { steps: [1] });
      var h1 = k.root.group({ steps: [1], d: 200 });
      var h1a = h1.text(SIDE, 340, '', { kind: 'hand' });
      var h1b = h1.text(SIDE, 362, '', { kind: 'hand' });

      // step 2: the map
      var g2 = k.root.group({ steps: [2], d: 300 });
      var s2 = k.slider({ x: SIDE, y: 74, w: 158, min: 1, max: N, step: 2, value: k2, label: 'how many vote', steps: [2],
        onChange: function (v) { k2 = v; refresh(); } });
      g2.mark(SIDE + 5, 110, 'o', { r: 3.4 }); g2.mark(SIDE + 5, 130, '+', { r: 3.4 });
      g2.text(SIDE + 18, 114, 'circles', { kind: 'label' });
      g2.text(SIDE + 158, 114, String(KINDS.filter(function (v) { return !v; }).length), { kind: 'val', anchor: 'end' });
      g2.text(SIDE + 18, 134, 'crosses', { kind: 'label' });
      g2.text(SIDE + 158, 134, String(KINDS.filter(function (v) { return v; }).length), { kind: 'val', anchor: 'end' });
      g2.line(SIDE, 146, SIDE + 158, 146, { w: 0.6, op: 0.45, rough: 0.3 });
      g2.text(SIDE, 166, 'the vote at ?', { kind: 'label' });
      var vSays2 = g2.text(SIDE + 158, 166, '', { kind: 'val', anchor: 'end' });
      g2.callout('c', 'hatched: crosses win', SIDE, 206);
      k.button(SIDE, 246, 'slide from 1 to ' + N, function () {
        if (busy) return;
        busy = true;
        k.animate(3600, function (t) {
          var v = 1 + 2 * Math.round(t * (N - 1) / 2);
          if (v !== k2) s2.set(v);
          if (t >= 1) busy = false;
        });
      }, { steps: [2] });
      var h2 = k.root.group({ steps: [2], d: 200 });
      var h2a = h2.text(SIDE, 320, '', { kind: 'hand' });
      var h2b = h2.text(SIDE, 342, '', { kind: 'hand' });

      function says(c) { return NAMES[winner(c)]; }
      function refresh() {
        var st = k.step();
        var said = state.guess == null ? '–' : NAMES[state.guess];
        vSaid0.set(said); vSaid1.set(said);
        h0a.style.display = h0b.style.display = state.guess == null ? 'none' : '';
        if (st === 1) {
          var c = count(nearest(state.p, k1));
          vC1.set(String(c[0])); vX1.set(String(c[1])); vSays1.set(says(c));
          if (state.guess == null) { h1a.set('the nearest ' + k1); h1b.set('decide.'); }
          else if (winner(c) === state.guess) { h1a.set('the vote agrees'); h1b.set('with you.'); }
          else { h1a.set('the vote says'); h1b.set('otherwise.'); }
          drawThreads();
        } else if (st === 2) {
          vSays2.set(says(count(nearest(state.p, k2))));
          if (k2 === 1) { h2a.set('every stray point'); h2b.set('gets an island.'); }
          else if (k2 >= N - 4) { h2a.set('the bigger group'); h2b.set('wins everywhere.'); }
          else { h2a.set(''); h2b.set(''); }
          drawMap();
        }
      }
      function sew() {
        if (busy) return;
        busy = true; grow = 0; drawThreads();
        k.animate(1100, function (t) { grow = t; drawThreads(); if (t >= 1) busy = false; });
      }

      // another copy of this figure moved the point or took a guess: follow it
      window.addEventListener(EVENT, function (e) {
        if (e.detail && e.detail.from === me) return;
        state = remembered(); placeStar(); drag.set(sx(state.p[0]), sy(state.p[1])); refresh();
      });

      k.onStep(function (step) {
        busy = false;
        state = remembered();
        placeStar(); drag.set(sx(state.p[0]), sy(state.p[1]));
        grow = 1;
        refresh();
        if (step === 1) sew();
      });
    }
  });
})();
