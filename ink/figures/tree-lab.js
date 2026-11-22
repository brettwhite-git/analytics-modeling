/* Tree lab — sorting borrowers by asking one yes/no question at a time.
   Steps: 0 drag one up-and-down cut on income; read what is in each pile, and how many each pile would call
            wrong if it went with its bigger kind (those points are ringed)
          1 cut each pile again, one level at a time: rectangles on the plot, the questions written out beside it
          2 keep cutting until every pile is pure, then score every level on 40 fresh borrowers it never saw
   The cut placed in step 0 is remembered (sessionStorage) and offered to the page's Python as my_cut.
   Everything is computed: every cut halfway between neighbouring values is tried, on income and on debt, and
   the one with the lowest "mixed" score wins (each pile scores 2 x a x b / (a + b) for a of one kind and b of
   the other). The page's Python does the same sums in the same order, so its tree is this tree.
   In every step the reader may also drag any of the 40 borrowers (not the fresh ones): the piles, the tree,
   the questions and the scores are worked out again from a working copy. ROWS itself never changes, so the
   page's Python always gets the original borrowers; "put the points back" restores the copy. Not saved.
   Made-up borrowers, fixed seeds. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var NS = 'http://www.w3.org/2000/svg';
  var PLOT = { x: 44, y: 34, w: 392, h: 372 }, SIDE = 462, S1 = SIDE + 158;
  var XL = [10, 110], YL = [0, 65];          // income (thousands a year) across, debt (thousands owed) up
  var BOX = [XL[0], XL[1], YL[0], YL[1]];
  var STORE = 'ink-tree-cut', CUT_START = 80, MOUNTS = 0;
  var REACH = 9;                             // how near (figure px) a press must be to grab a borrower
  var WEIGHTS = [1.6, 1.3, 1.1, 0.9, 0.8, 0.7, 0.7];

  /* the pattern behind the made-up borrowers, and about one in ten turned the other way */
  function truth(x, y) { return (x < 56 && y > 24) || (x >= 56 && y > 44) ? 1 : 0; }
  function make(rand, n, flip) {
    var out = [], seen = {};
    while (out.length < n) {
      var x = 20 + Math.floor(rand() * 81), y = Math.floor(rand() * 61);
      if (seen[x + ',' + y]) continue;
      seen[x + ',' + y] = 1;
      var c = truth(x, y);
      if (rand() < flip) c = 1 - c;
      out.push([x, y, c]);                      // [income, debt, kind]: kind 0 paid back (o), 1 missed (+)
    }
    return out;
  }
  var ROWS = make(window.InkKit.rng(156), 40, 0.1);
  var FRESH = make(window.InkKit.rng(5156), 40, 0.1);

  /* the same steps as the Python on the page */
  function mixed(a, b) { return a + b === 0 ? 0 : 2 * a * b / (a + b); }
  function count(pile, m, cut) {
    var L = [0, 0], R = [0, 0];
    pile.forEach(function (r) { if (r[m] < cut) L[r[2]]++; else R[r[2]]++; });
    return [L, R];
  }
  function score(pile, m, cut) { var c = count(pile, m, cut); return mixed(c[0][0], c[0][1]) + mixed(c[1][0], c[1][1]); }
  function cuts(pile, m) {
    var v = [];
    pile.forEach(function (r) { if (v.indexOf(r[m]) < 0) v.push(r[m]); });
    v.sort(function (a, b) { return a - b; });
    var out = [];
    for (var i = 0; i < v.length - 1; i++) out.push((v[i] + v[i + 1]) / 2);
    return out;
  }
  function bestSplit(pile) {
    var best = null;
    [0, 1].forEach(function (m) {
      cuts(pile, m).forEach(function (c) { var s = score(pile, m, c); if (best === null || s < best[0]) best = [s, m, c]; });
    });
    return best;
  }
  function ones(pile) { var n = 0; pile.forEach(function (r) { n += r[2]; }); return n; }
  function kindOf(pile) { return 2 * ones(pile) > pile.length ? 1 : 0; }
  function pure(pile) { var n = ones(pile); return n === 0 || n === pile.length; }

  function grow(rows, depth, box) {
    var node = { rows: rows, depth: depth, box: box, kind: kindOf(rows) };
    var b = pure(rows) ? null : bestSplit(rows);
    if (b) {                                   // (a mixed pile whose borrowers all sit on one spot has no cut)
      var m = b[1], c = b[2], bl = box.slice(), br = box.slice();
      if (m === 0) { bl[1] = c; br[0] = c; } else { bl[3] = c; br[2] = c; }
      node.m = m; node.cut = c;
      node.L = grow(rows.filter(function (r) { return r[m] < c; }), depth + 1, bl);
      node.R = grow(rows.filter(function (r) { return r[m] >= c; }), depth + 1, br);
    }
    return node;
  }
  function deepest(n) { return n.L ? Math.max(deepest(n.L), deepest(n.R)) : n.depth; }
  var TREE = grow(ROWS, 0, BOX);
  var MAXD = deepest(TREE);
  function split(n, d) { return !!n.L && n.depth < d; }
  function leafFor(t, r, d) { var n = t; while (split(n, d)) n = r[n.m] < n.cut ? n.L : n.R; return n; }
  function wrongAt(t, set, d) { return set.filter(function (r) { return leafFor(t, r, d).kind !== r[2]; }); }

  function remembered() {
    try { var v = +sessionStorage.getItem(STORE); return v >= 15 && v <= 105 ? v : null; } catch (e) { return null; }
  }
  var myCut = remembered() || CUT_START;

  /* what `from page import rows, fresh, my_cut` gives the Python on the same page (see ink/py.js) */
  window.InkPage = window.InkPage || {};
  window.InkPage.rows = function () { return ROWS; };
  window.InkPage.fresh = function () { return FRESH; };
  window.InkPage.my_cut = function () { return myCut; };

  function q(n) { return (n.m === 0 ? 'income' : 'debt') + ' < ' + n.cut + '?'; }

  window.InkKit.define('tree-lab', {
    label: 'A decision tree by hand: cut the borrowers into two piles, cut each pile again, and see when to stop',
    steps: 3,
    seed: 23,
    draw: function (k) {
      var uid = ++MOUNTS;
      var sx = k.scale(XL[0], XL[1], PLOT.x, PLOT.x + PLOT.w), sy = k.scale(YL[0], YL[1], PLOT.y + PLOT.h, PLOT.y);
      function boxPts(b) { return [[sx(b[0]), sy(b[2])], [sx(b[1]), sy(b[2])], [sx(b[1]), sy(b[3])], [sx(b[0]), sy(b[3])]]; }
      function cutEnds(n) {
        var b = n.box;
        return n.m === 0 ? [[sx(n.cut), sy(b[2])], [sx(n.cut), sy(b[3])]] : [[sx(b[0]), sy(n.cut)], [sx(b[1]), sy(n.cut)]];
      }
      function segD(e) { return 'M' + e[0][0].toFixed(1) + ' ' + e[0][1].toFixed(1) + ' L' + e[1][0].toFixed(1) + ' ' + e[1][1].toFixed(1); }
      function walk(t, d, fn) { (function go(n) { fn(n); if (split(n, d)) { go(n.L); go(n.R); } })(t); }
      function of40(n) { return n + ' of 40'; }

      /* the borrowers the reader drags: a copy, so ROWS (and the page's Python) keep the originals */
      var rows = ROWS.map(function (r) { return r.slice(); });
      var tree = TREE, maxd = MAXD, moved = false;
      function clip(name) {
        var cp = document.createElementNS(NS, 'clipPath');
        cp.setAttribute('id', 'tree-lab-' + uid + '-' + name);
        k.svg.querySelector('defs').appendChild(cp);
        return cp;
      }
      function clipRect(cp, x, y, w, h) {
        var rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', x); rect.setAttribute('y', y); rect.setAttribute('width', w); rect.setAttribute('height', h);
        cp.appendChild(rect);
        return rect;
      }

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'income', ylabel: 'debt',
        xticks: [20, 40, 60, 80, 100].map(function (v) { return [sx(v), String(v)]; }),
        yticks: [0, 20, 40, 60].map(function (v) { return [sy(v), String(v)]; }) });

      /* ---- steps 1 and 2: the tree at every level, drawn once each, shown one at a time ---- */
      var planeRoot = k.root.group({ steps: [1, 2], d: 100, stagger: 0 });
      var planes = [], newest = [];
      for (var d = 0; d <= MAXD; d++) {
        var g = planeRoot.group({ d: 0, stagger: 0 }), gNew = g.group({ d: 0, stagger: 0 });
        walk(TREE, d, function (n) {
          if (!split(n, d)) { if (n.kind === 1) g.hatch(boxPts(n.box), { op: 0.42, gap: 5 }); return; }
          var e = cutEnds(n), o = { w: WEIGHTS[n.depth] || 0.7, op: 0.85, rough: 0.3 };
          (n.depth === d - 1 ? gNew : g).line(e[0][0], e[0][1], e[1][0], e[1][1], o);
        });
        planes[d] = g; newest[d] = gNew;
      }
      // once a borrower has moved, the tree is grown again and drawn here instead: one hatch over the whole
      // plot, clipped to the rectangles that say +, and clean cut lines, so nothing re-wobbles as it changes
      var liveG = k.root.group({ steps: [1, 2], d: 0, stagger: 0 });
      var liveClip = clip('live');
      var liveHatch = liveG.group({ d: 0 });
      liveHatch.node.setAttribute('clip-path', 'url(#tree-lab-' + uid + '-live)');
      liveHatch.hatch(boxPts(BOX), { op: 0.42, gap: 5, d: 0 });
      var liveCuts = liveG.layer();
      liveG.node.style.display = 'none';
      function drawLive(lv, withNewest) {
        while (liveClip.firstChild) liveClip.removeChild(liveClip.firstChild);
        liveCuts.clear();
        walk(tree, lv, function (n) {
          if (!split(n, lv)) {
            if (n.kind === 1) { var p = boxPts(n.box); clipRect(liveClip, p[0][0], p[2][1], p[1][0] - p[0][0], p[0][1] - p[2][1]); }
            return;
          }
          if (n.depth === lv - 1 && !withNewest) return;      // step 1 draws the newest cuts in the accent instead
          liveCuts.path(segD(cutEnds(n)), { w: WEIGHTS[n.depth] || 0.7, op: 0.85 });
        });
      }

      /* ---- the points: the 40 the tree grows on, and the 40 fresh ones for step 2 ---- */
      var trails = k.root.layer({ steps: [0, 1, 2] });         // a faint thread from where a moved borrower began
      var trainMarks = k.root.group({ steps: [0, 1, 2], d: 150, stagger: 8 });
      var markNodes = ROWS.map(function (r) { return trainMarks.mark(sx(r[0]), sy(r[1]), r[2] ? '+' : 'o', { r: 3.8 }); });
      var freshMarks = k.root.group({ steps: [2], d: 150, stagger: 8 });
      FRESH.forEach(function (r) { freshMarks.mark(sx(r[0]), sy(r[1]), r[2] ? '+' : 'o', { r: 3.8 }); });
      trainMarks.node.style.pointerEvents = freshMarks.node.style.pointerEvents = 'none';

      /* one hit area over the plot finds the nearest borrower; the cut's own handle is drawn later, so on top */
      var pointHit = document.createElementNS(NS, 'rect');
      pointHit.setAttribute('x', PLOT.x); pointHit.setAttribute('y', PLOT.y);
      pointHit.setAttribute('width', PLOT.w); pointHit.setAttribute('height', PLOT.h);
      pointHit.setAttribute('class', 'ik-hit');
      pointHit.style.touchAction = 'none';
      k.root.group({ steps: [0, 1, 2], d: 0 }).node.appendChild(pointHit);

      /* ================= step 0: one cut, by hand ================= */
      var g0 = k.root.group({ steps: [0], d: 200 });
      // each side is hatched when it says +: one hatch over the whole plot per side, clipped to that side,
      // so dragging only moves a clip edge and the hand-drawn hatch never re-wobbles
      function clipped(name) {
        var cp = clip(name), rect = clipRect(cp, 0, PLOT.y, 0, PLOT.h);
        var holder = g0.group({ d: 0 });
        holder.node.setAttribute('clip-path', 'url(#tree-lab-' + uid + '-' + name + ')');
        holder.hatch(boxPts(BOX), { op: 0.4, gap: 5, d: 0 });
        return { rect: rect, node: holder.node };
      }
      var hatchL = clipped('l'), hatchR = clipped('r');

      // a ring for each borrower, shown when it is called wrong: by the cut in step 0, by the tree in step 2
      var rings0 = k.root.group({ steps: [0, 2], d: 300, stagger: 0 });
      var ringNodes = ROWS.map(function (r) { return rings0.circle(sx(r[0]), sy(r[1]), 8, { w: 0.8, op: 0.6 }); });

      g0.text(SIDE, 60, 'your cut', { kind: 'label' });
      var vCut = g0.text(S1, 60, '', { kind: 'val', anchor: 'end' });
      g0.line(SIDE, 72, S1, 72, { w: 0.6, op: 0.45, rough: 0.3 });
      g0.text(SIDE, 96, 'left pile', { kind: 'label' });
      var vLeft = g0.text(S1, 96, '', { kind: 'val', anchor: 'end' });
      g0.text(SIDE, 116, 'called wrong', { kind: 'label' });
      var vLeftW = g0.text(S1, 116, '', { kind: 'val', anchor: 'end' });
      g0.text(SIDE, 146, 'right pile', { kind: 'label' });
      var vRight = g0.text(S1, 146, '', { kind: 'val', anchor: 'end' });
      g0.text(SIDE, 166, 'called wrong', { kind: 'label' });
      var vRightW = g0.text(S1, 166, '', { kind: 'val', anchor: 'end' });
      g0.line(SIDE, 178, S1, 178, { w: 0.6, op: 0.45, rough: 0.3 });
      g0.text(SIDE, 200, 'total wrong', { kind: 'label' });
      var vTotal = g0.text(S1, 200, '', { kind: 'val', anchor: 'end' });
      g0.callout('a', 'drag the cut', SIDE, 250, { d: 600 });
      g0.text(SIDE, 300, 'each pile goes with', { kind: 'axis' });
      g0.text(SIDE, 316, 'its bigger kind.', { kind: 'axis' });
      g0.text(SIDE, 340, 'ringed: called wrong', { kind: 'axis' });
      g0.text(SIDE, 356, 'hatched: says +', { kind: 'axis' });

      var cx0 = sx(CUT_START);
      var cutG = k.root.group({ steps: [0], d: 500 });
      cutG.line(cx0, PLOT.y - 4, cx0, PLOT.y + PLOT.h, { accent: true, w: 1.7, op: 0.95, rough: 0.4 });
      cutG.circle(cx0, PLOT.y - 10, 5, { accent: true, w: 1.4, op: 0.95 });
      var hit = document.createElementNS(NS, 'rect');
      hit.setAttribute('x', cx0 - 11); hit.setAttribute('y', PLOT.y - 18);
      hit.setAttribute('width', 22); hit.setAttribute('height', PLOT.h + 18);
      hit.setAttribute('class', 'ik-hit');
      cutG.node.appendChild(hit);

      function sideText(c) { return c[0] + ' o · ' + c[1] + ' +'; }
      function setCut(c) {
        myCut = c;
        try { sessionStorage.setItem(STORE, String(c)); } catch (e) {}
        var x = sx(c), cnt = count(rows, 0, c), L = cnt[0], R = cnt[1];
        var kl = 2 * L[1] > L[0] + L[1] ? 1 : 0, kr = 2 * R[1] > R[0] + R[1] ? 1 : 0;
        cutG.node.setAttribute('transform', 'translate(' + (x - cx0).toFixed(1) + ' 0)');
        hatchL.rect.setAttribute('x', PLOT.x); hatchL.rect.setAttribute('width', Math.max(0, x - PLOT.x));
        hatchR.rect.setAttribute('x', x); hatchR.rect.setAttribute('width', Math.max(0, PLOT.x + PLOT.w - x));
        hatchL.node.style.display = kl ? '' : 'none';
        hatchR.node.style.display = kr ? '' : 'none';
        rows.forEach(function (r, i) {
          var says = r[0] < c ? kl : kr;
          ringNodes[i].style.display = r[2] !== says ? '' : 'none';
        });
        vCut.set('income < ' + c);
        vLeft.set(sideText(L)); vRight.set(sideText(R));
        vLeftW.set(String(Math.min(L[0], L[1]))); vRightW.set(String(Math.min(R[0], R[1])));
        vTotal.set(of40(Math.min(L[0], L[1]) + Math.min(R[0], R[1])));
      }
      var drag = k.draggable(cutG.node, {
        x: sx(myCut), y: PLOT.y, label: 'The cut. Left and right arrow keys move it.',
        bounds: { x0: sx(15), y0: PLOT.y, x1: sx(105), y1: PLOT.y },
        onMove: function (x) { setCut(Math.round(XL[0] + (x - PLOT.x) / PLOT.w * (XL[1] - XL[0]))); }
      });

      /* ================= step 1: cut each pile again ================= */
      var level = 0, busy = false;
      var outline = k.root.group({ steps: [1], d: 200, stagger: 0 });
      var outlines = [];
      // the questions written out, one row each; `max` rows at most, the rest summed up on a last row
      function writeOutline(t, lv, target, max) {
        var rowsOut = [], rules = [];
        (function line(n, prefix, indent) {
          var r = rowsOut.length;
          if (!split(n, lv)) { rowsOut.push([indent, (prefix || 'one pile, says ') + (n.kind ? '+' : 'o')]); return; }
          rowsOut.push([indent, prefix + q(n)]);
          line(n.L, 'yes: ', indent + 9);
          var no = rowsOut.length;                 // the row its "no" answer will be written on
          line(n.R, 'no: ', indent + 9);
          rules.push([indent, r, no]);
        })(t, '', 0);
        var cut = max && rowsOut.length > max ? max - 1 : rowsOut.length;
        function y(r) { return 72 + r * 12.5; }
        rowsOut.slice(0, cut).forEach(function (r, i) { target.text(SIDE + r[0], y(i), r[1], { kind: 'code', d: 0 }); });
        if (cut < rowsOut.length) target.text(SIDE, y(cut), '… ' + (rowsOut.length - cut) + ' more rows', { kind: 'code', d: 0 });
        // a thin rule down from each question to its "no", so the nesting reads as a tree
        rules.forEach(function (r) {
          if (r[1] >= cut) return;
          var x = SIDE + r[0] + 3, y0 = y(r[1]) + 4, y1 = y(Math.min(r[2], cut)) - 4;
          if (target.clear) target.path('M' + x + ' ' + y0 + ' L' + x + ' ' + y1, { w: 0.6, op: 0.4 });
          else target.line(x, y0, x, y1, { w: 0.6, op: 0.4, rough: 0.2, d: 0 });
        });
      }
      for (d = 0; d <= MAXD; d++) {
        var og = outline.group({ d: 0, stagger: 0 });
        writeOutline(TREE, d, og, 0);
        outlines[d] = og;
      }
      var outlineLive = k.root.layer({ steps: [1] });
      var s1 = k.root.group({ steps: [1], d: 300 });
      s1.text(SIDE, 52, 'the questions', { kind: 'label' });
      s1.text(SIDE, 352, 'called wrong', { kind: 'label' });
      var vWrong1 = s1.text(S1, 352, '', { kind: 'val', anchor: 'end' });
      var acc = k.root.layer({ steps: [1] });
      function newestCuts(lv) {
        var lines = [];
        walk(tree, lv, function (n) { if (split(n, lv) && n.depth === lv - 1) lines.push(cutEnds(n)); });
        return lines;
      }
      function drawNewest() {                     // the cuts the last press added, in the accent, at rest
        acc.clear();
        newestCuts(level).forEach(function (e) { acc.path(segD(e), { accent: true, w: 1.7, op: 0.95 }); });
      }
      var bGrow = k.button(SIDE, 386, 'cut each pile again', function () {
        if (busy || level >= maxd) return;
        level++; show1();
        // the new cuts, drawn across their piles
        acc.clear();
        var lines = newestCuts(level).map(function (e) { return { e: e, p: acc.path('', { accent: true, w: 1.7, op: 0.95 }) }; });
        busy = true;
        k.animate(700, function (t) {
          lines.forEach(function (l) {
            var a = l.e[0], b = l.e[1];
            l.p.setAttribute('d', 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' L' + (a[0] + (b[0] - a[0]) * t).toFixed(1) + ' ' + (a[1] + (b[1] - a[1]) * t).toFixed(1));
          });
          if (t >= 1) { busy = false; drawNewest(); }
        });
      }, { steps: [1] });
      k.button(SIDE, 418, 'start over', function () { if (!busy) { level = 0; acc.clear(); show1(); } }, { steps: [1] });

      function show1() {
        if (level > maxd) level = maxd;
        for (var q2 = 0; q2 <= MAXD; q2++) {
          planes[q2].node.style.display = !moved && q2 === level ? '' : 'none';
          newest[q2].node.style.display = 'none';
          outlines[q2].node.style.display = !moved && q2 === level ? '' : 'none';
        }
        liveG.node.style.display = moved ? '' : 'none';
        outlineLive.clear();
        if (moved) { drawLive(level, false); writeOutline(tree, level, outlineLive, 22); }
        vWrong1.set(of40(wrongAt(tree, rows, level).length));
        bGrow.set(level >= maxd ? 'every pile is pure' : 'cut each pile again');
      }

      /* ================= step 2: until every pile is pure, then fresh borrowers ================= */
      var depth2 = MAXD, showFresh = false, touched = false;
      var sliderOpts = {
        x: SIDE, y: 80, w: 158, min: 1, max: MAXD, step: 1, value: depth2, label: 'levels of cuts', steps: [2],
        onChange: function (v) { touched = true; depth2 = v; show2(); }
      };
      var slider = k.slider(sliderOpts);
      var knobPaper = slider.node.querySelector('.ik-paper');
      var sliderHit = slider.node.querySelector('[role="slider"]');
      // a regrown tree can be deeper or shallower: the slider reads its range from the options it was given,
      // so widen or narrow that range and set the knob again (twice, as set() skips a value it already has)
      function fitSlider() {
        var top = Math.max(2, maxd);
        if (sliderOpts.max !== top) {
          sliderOpts.max = top;
          sliderHit.setAttribute('aria-valuemax', top);
          slider.set(depth2 === 1 ? 2 : 1, true);
        }
        slider.set(depth2, true);
      }
      var s2 = k.root.group({ steps: [2], d: 300 });
      s2.text(SIDE, 116, 'its own 40', { kind: 'label' });
      var vOwn = s2.text(S1, 116, '', { kind: 'val', anchor: 'end' });
      s2.text(SIDE, 136, '40 fresh', { kind: 'label' });
      var vFresh = s2.text(S1, 136, '', { kind: 'val', anchor: 'end' });
      var bFresh = k.button(SIDE, 170, 'show the fresh ones', function () { showFresh = !showFresh; show2(); }, { steps: [2] });

      var rings2 = k.root.group({ steps: [2], d: 400, stagger: 0 });
      var freshRings = FRESH.map(function (r) { return rings2.circle(sx(r[0]), sy(r[1]), 8, { w: 0.8, op: 0.6 }); });
      // how many each level calls wrong, on its own borrowers and on the fresh ones
      function levels(t, md, own) {
        var o = [], f = [], eMax = 0, bestD = 1;
        for (var lv = 1; lv <= md; lv++) {
          o[lv] = wrongAt(t, own, lv).length; f[lv] = wrongAt(t, FRESH, lv).length;
          eMax = Math.max(eMax, o[lv], f[lv]);
          if (f[lv] < f[bestD]) bestD = lv;
        }
        return { own: o, fresh: f, eMax: Math.max(5, Math.ceil(eMax / 5) * 5), bestD: bestD, md: md };
      }
      var LV0 = levels(TREE, MAXD, ROWS), lv = LV0;
      var EC = { x: 476, y: 222, w: 112, h: 96 };
      function chartScales(L) {
        return { ex: k.scale(1, Math.max(2, L.md), EC.x + 8, EC.x + EC.w - 4), ey: k.scale(0, L.eMax, EC.y + EC.h, EC.y) };
      }
      s2.text(SIDE, EC.y - 14, 'called wrong', { kind: 'label' });
      s2.text(EC.x + EC.w, EC.y + EC.h + 32, 'levels', { kind: 'label', anchor: 'end' });
      // the chart for the original borrowers is drawn once; a regrown tree gets its own, redrawn when it changes
      function drawChart(target, L, live) {
        var sc = chartScales(L), xt = [];
        for (var q3 = 1; q3 <= L.md; q3++) xt.push([sc.ex(q3), String(q3)]);
        if (!live || live === 'axes') target.axes({ x: EC.x, y: EC.y, w: EC.w, h: EC.h, xticks: xt, yticks: [[sc.ey(0), '0'], [sc.ey(L.eMax), String(L.eMax)]] });
        if (live === 'axes') return;
        function errLine(vals, o) {
          var pts = [];
          for (var q4 = 1; q4 <= L.md; q4++) pts.push([sc.ex(q4), sc.ey(vals[q4])]);
          target.polyline(pts, o);
          pts.forEach(function (p) { target.dot(p[0], p[1], o.w > 1.2 ? 2.2 : 1.6); });
          return pts;
        }
        var ownPts = errLine(L.own, { w: 0.8, op: 0.7, d: 500 }), freshPts = errLine(L.fresh, { w: 1.6, op: 0.95, d: 800 });
        var yO = ownPts[L.md - 1][1] + 3.5, yF = freshPts[L.md - 1][1] + 3.5;
        if (Math.abs(yO - yF) < 12) { if (yO > yF) yO = yF + 12; else yF = yO + 12; }
        target.text(EC.x + EC.w + 5, yO, 'own', { kind: 'axis' });
        target.text(EC.x + EC.w + 5, yF, 'fresh', { kind: 'axis' });
        var bp = freshPts[L.bestD - 1];
        if (live) target.path('M' + (bp[0] - 6).toFixed(1) + ' ' + bp[1].toFixed(1) + ' a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0', { accent: true, w: 1.3, op: 0.95 });
        else target.circle(bp[0], bp[1], 6, { accent: true, w: 1.3, op: 0.95, d: 1100 });
      }
      var chartStatic = s2.group();
      drawChart(chartStatic, LV0, false);
      var chartAxesLive = s2.layer(), chartLive = s2.layer(), axesKey = '', chartKey = '';
      var bestNote = s2.callout('b', 'fresh: fewest at ' + LV0.bestD + ' levels', SIDE, 404, { d: 1100 }).querySelector('text');
      var nowLine = s2.layer(), nowKey = '';

      function show2() {
        if (depth2 > maxd) depth2 = maxd;
        if (!touched) depth2 = maxd;
        fitSlider();
        for (var q4 = 0; q4 <= MAXD; q4++) {
          planes[q4].node.style.display = !moved && q4 === depth2 ? '' : 'none';
          newest[q4].node.style.display = '';
        }
        liveG.node.style.display = moved ? '' : 'none';
        if (moved) drawLive(depth2, true);
        rows.forEach(function (r, i) { ringNodes[i].style.display = !showFresh && leafFor(tree, r, depth2).kind !== r[2] ? '' : 'none'; });
        FRESH.forEach(function (r, i) { freshRings[i].style.display = showFresh && leafFor(tree, r, depth2).kind !== r[2] ? '' : 'none'; });
        trainMarks.node.style.display = trails.node.style.display = showFresh ? 'none' : '';
        freshMarks.node.style.display = showFresh ? '' : 'none';
        vOwn.set(lv.own[depth2] + ' wrong');
        vFresh.set(lv.fresh[depth2] + ' wrong');
        bFresh.set(showFresh ? 'show its own 40' : 'show the fresh ones');
        chartStatic.node.style.display = moved ? 'none' : '';
        chartAxesLive.node.style.display = chartLive.node.style.display = moved ? '' : 'none';
        if (moved) {
          var aKey = lv.md + '/' + lv.eMax, cKey = aKey + '/' + lv.own.join() + '/' + lv.fresh.join();
          if (aKey !== axesKey) { axesKey = aKey; chartAxesLive.clear(); drawChart(chartAxesLive, lv, 'axes'); }
          if (cKey !== chartKey) { chartKey = cKey; chartLive.clear(); drawChart(chartLive, lv, true); }
        }
        bestNote.set('(b) fresh: fewest at ' + lv.bestD + ' levels');
        var sc = chartScales(lv), nKey = depth2 + '/' + lv.md;
        if (nKey !== nowKey) {
          nowKey = nKey;
          nowLine.clear();
          nowLine.line(sc.ex(depth2), EC.y, sc.ex(depth2), EC.y + EC.h, { w: 0.6, op: 0.5, rough: 0.2 });
        }
      }

      /* ================= dragging the borrowers themselves ================= */
      var bBack = k.button(SIDE, 24, 'put the points back', function () { putBack(); });
      var note = k.root.group({ d: 0 });
      note.text(PLOT.x, 438, 'points moved: the text is about the original points', { kind: 'axis' });
      bBack.node.style.display = note.node.style.display = 'none';

      function placeMarks() {
        trails.clear();
        var d2 = '';
        rows.forEach(function (r, i) {
          var dx = sx(r[0]) - sx(ROWS[i][0]), dy = sy(r[1]) - sy(ROWS[i][1]);
          [markNodes[i], ringNodes[i]].forEach(function (n) {
            if (dx || dy) n.setAttribute('transform', 'translate(' + dx.toFixed(1) + ' ' + dy.toFixed(1) + ')');
            else n.removeAttribute('transform');
          });
          if (dx || dy) d2 += 'M' + sx(ROWS[i][0]).toFixed(1) + ' ' + sy(ROWS[i][1]).toFixed(1) + ' L' + sx(r[0]).toFixed(1) + ' ' + sy(r[1]).toFixed(1) + ' ';
        });
        if (d2) trails.path(d2, { w: 0.6, op: 0.3 });
      }
      function refresh() {
        moved = rows.some(function (r, i) { return r[0] !== ROWS[i][0] || r[1] !== ROWS[i][1]; });
        if (moved) { tree = grow(rows, 0, BOX); maxd = deepest(tree); lv = levels(tree, maxd, rows); }
        else { tree = TREE; maxd = MAXD; lv = LV0; }
        placeMarks();
        bBack.node.style.display = note.node.style.display = moved ? '' : 'none';
        var st = k.step();
        if (st === 0) setCut(myCut);
        else if (st === 1) { show1(); if (!busy) drawNewest(); }
        else show2();
      }
      var frame = 0;
      function soon() {                          // at most one regrow per animation frame
        if (frame) return;
        frame = requestAnimationFrame(function () { frame = 0; refresh(); });
      }
      function putBack() {
        rows.forEach(function (r, i) { r[0] = ROWS[i][0]; r[1] = ROWS[i][1]; });
        refresh();
      }

      var held = -1, grab = null;
      function nearest(p) {
        var best = -1, bd = REACH * REACH;
        rows.forEach(function (r, i) {
          var dx = sx(r[0]) - p.x, dy = sy(r[1]) - p.y, dd = dx * dx + dy * dy;
          if (dd <= bd) { bd = dd; best = i; }
        });
        return best;
      }
      // Fig. 1 is the reader's own cut: moving borrowers there would only game its count, and the code beside it
      // counts the original borrowers, so points move only from Fig. 2 on
      function canDrag() { return k.step() !== 0 && !(k.step() === 2 && showFresh); }
      pointHit.addEventListener('pointerdown', function (e) {
        if (e.button || !canDrag()) return;
        var p = k.toFigure(e), i = nearest(p);
        if (i < 0) return;
        e.preventDefault();
        try { pointHit.setPointerCapture(e.pointerId); } catch (err) {}
        held = i; grab = { dx: sx(rows[i][0]) - p.x, dy: sy(rows[i][1]) - p.y };
        pointHit.style.cursor = 'grabbing';
      });
      pointHit.addEventListener('pointermove', function (e) {
        var p = k.toFigure(e);
        if (held < 0) { pointHit.style.cursor = canDrag() && nearest(p) >= 0 ? 'grab' : ''; return; }
        var x = Math.round(XL[0] + (p.x + grab.dx - PLOT.x) / PLOT.w * (XL[1] - XL[0]));
        var y = Math.round(YL[0] + (PLOT.y + PLOT.h - p.y - grab.dy) / PLOT.h * (YL[1] - YL[0]));
        x = k.clamp(x, XL[0] + 2, XL[1] - 2); y = k.clamp(y, YL[0] + 1, YL[1] - 1);
        if (x === rows[held][0] && y === rows[held][1]) return;
        rows[held][0] = x; rows[held][1] = y;
        placeMarks();                            // the borrower follows the pointer now; the tree on the next frame
        soon();
      });
      function release() {
        if (held < 0) return;
        held = -1; pointHit.style.cursor = 'grab';
        if (frame) { cancelAnimationFrame(frame); frame = 0; }
        refresh();
      }
      pointHit.addEventListener('pointerup', release);
      pointHit.addEventListener('pointercancel', release);

      k.onStep(function (step) {
        busy = false;
        knobPaper.style.display = step === 2 ? '' : 'none';
        trainMarks.node.style.display = trails.node.style.display = '';
        freshMarks.node.style.display = 'none';
        if (step === 0) {
          for (var q5 = 0; q5 <= MAXD; q5++) planes[q5].node.style.display = 'none';
          liveG.node.style.display = 'none';
          myCut = remembered() || myCut;
          drag.set(sx(myCut), PLOT.y);
          setCut(myCut);
        } else if (step === 1) {
          show1(); drawNewest();
        } else {
          if (!touched) { depth2 = maxd; slider.set(depth2, true); }
          show2();
        }
      });
    }
  });
})();
