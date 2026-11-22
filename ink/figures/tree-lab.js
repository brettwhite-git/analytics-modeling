/* Tree lab — sorting borrowers by asking one yes/no question at a time.
   Steps: 0 drag one up-and-down cut on income; read what is in each pile, and how many each pile would call
            wrong if it went with its bigger kind (those points are ringed)
          1 cut each pile again, one level at a time: rectangles on the plot, the questions written out beside it
          2 keep cutting until every pile is pure, then score every level on 40 fresh borrowers it never saw
   The cut placed in step 0 is remembered (sessionStorage) and offered to the page's Python as my_cut.
   Everything is computed: every cut halfway between neighbouring values is tried, on income and on debt, and
   the one with the lowest "mixed" score wins (each pile scores 2 x a x b / (a + b) for a of one kind and b of
   the other). The page's Python does the same sums in the same order, so its tree is this tree.
   Made-up borrowers, fixed seeds. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var NS = 'http://www.w3.org/2000/svg';
  var PLOT = { x: 44, y: 34, w: 392, h: 372 }, SIDE = 462, S1 = SIDE + 158;
  var XL = [10, 110], YL = [0, 65];          // income (thousands a year) across, debt (thousands owed) up
  var STORE = 'ink-tree-cut', CUT_START = 80, MOUNTS = 0;

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
    if (!pure(rows)) {
      var b = bestSplit(rows), m = b[1], c = b[2], bl = box.slice(), br = box.slice();
      if (m === 0) { bl[1] = c; br[0] = c; } else { bl[3] = c; br[2] = c; }
      node.m = m; node.cut = c;
      node.L = grow(rows.filter(function (r) { return r[m] < c; }), depth + 1, bl);
      node.R = grow(rows.filter(function (r) { return r[m] >= c; }), depth + 1, br);
    }
    return node;
  }
  var TREE = grow(ROWS, 0, [XL[0], XL[1], YL[0], YL[1]]);
  var MAXD = (function deepest(n) { return n.L ? Math.max(deepest(n.L), deepest(n.R)) : n.depth; })(TREE);
  function split(n, d) { return !!n.L && n.depth < d; }
  function leafFor(r, d) { var n = TREE; while (split(n, d)) n = r[n.m] < n.cut ? n.L : n.R; return n; }
  function wrongAt(set, d) { return set.filter(function (r) { return leafFor(r, d).kind !== r[2]; }); }

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
      function walk(d, fn) { (function go(n) { fn(n); if (split(n, d)) { go(n.L); go(n.R); } })(TREE); }
      function of40(n) { return n + ' of 40'; }

      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'income', ylabel: 'debt',
        xticks: [20, 40, 60, 80, 100].map(function (v) { return [sx(v), String(v)]; }),
        yticks: [0, 20, 40, 60].map(function (v) { return [sy(v), String(v)]; }) });

      /* ---- steps 1 and 2: the tree at every level, drawn once each, shown one at a time ---- */
      var planeRoot = k.root.group({ steps: [1, 2], d: 100, stagger: 0 });
      var planes = [], newest = [];
      for (var d = 0; d <= MAXD; d++) {
        var g = planeRoot.group({ d: 0, stagger: 0 }), gNew = g.group({ d: 0, stagger: 0 });
        walk(d, function (n) {
          if (!split(n, d)) { if (n.kind === 1) g.hatch(boxPts(n.box), { op: 0.42, gap: 5 }); return; }
          var e = cutEnds(n), o = { w: [1.6, 1.3, 1.1, 0.9, 0.8, 0.7, 0.7][n.depth] || 0.7, op: 0.85, rough: 0.3 };
          (n.depth === d - 1 ? gNew : g).line(e[0][0], e[0][1], e[1][0], e[1][1], o);
        });
        planes[d] = g; newest[d] = gNew;
      }

      /* ---- the points: the 40 the tree grows on, and the 40 fresh ones for step 2 ---- */
      var trainMarks = k.root.group({ steps: [0, 1, 2], d: 150, stagger: 8 });
      ROWS.forEach(function (r) { trainMarks.mark(sx(r[0]), sy(r[1]), r[2] ? '+' : 'o', { r: 3.8 }); });
      var freshMarks = k.root.group({ steps: [2], d: 150, stagger: 8 });
      FRESH.forEach(function (r) { freshMarks.mark(sx(r[0]), sy(r[1]), r[2] ? '+' : 'o', { r: 3.8 }); });
      trainMarks.node.style.pointerEvents = freshMarks.node.style.pointerEvents = 'none';

      /* ================= step 0: one cut, by hand ================= */
      var g0 = k.root.group({ steps: [0], d: 200 });
      // each side is hatched when it says +: one hatch over the whole plot per side, clipped to that side,
      // so dragging only moves a clip edge and the hand-drawn hatch never re-wobbles
      var defs = k.svg.querySelector('defs');
      function clipped(name) {
        var cp = document.createElementNS(NS, 'clipPath'), rect = document.createElementNS(NS, 'rect');
        cp.setAttribute('id', 'tree-lab-' + uid + '-' + name);
        rect.setAttribute('y', PLOT.y); rect.setAttribute('height', PLOT.h);
        cp.appendChild(rect); defs.appendChild(cp);
        var holder = g0.group({ d: 0 });
        holder.node.setAttribute('clip-path', 'url(#tree-lab-' + uid + '-' + name + ')');
        holder.hatch(boxPts([XL[0], XL[1], YL[0], YL[1]]), { op: 0.4, gap: 5, d: 0 });
        return { rect: rect, node: holder.node };
      }
      var hatchL = clipped('l'), hatchR = clipped('r');

      var rings0 = k.root.group({ steps: [0], d: 300, stagger: 0 });
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
        var x = sx(c), cnt = count(ROWS, 0, c), L = cnt[0], R = cnt[1];
        var kl = 2 * L[1] > L[0] + L[1] ? 1 : 0, kr = 2 * R[1] > R[0] + R[1] ? 1 : 0;
        cutG.node.setAttribute('transform', 'translate(' + (x - cx0).toFixed(1) + ' 0)');
        hatchL.rect.setAttribute('x', PLOT.x); hatchL.rect.setAttribute('width', Math.max(0, x - PLOT.x));
        hatchR.rect.setAttribute('x', x); hatchR.rect.setAttribute('width', Math.max(0, PLOT.x + PLOT.w - x));
        hatchL.node.style.display = kl ? '' : 'none';
        hatchR.node.style.display = kr ? '' : 'none';
        ROWS.forEach(function (r, i) {
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
      for (d = 0; d <= MAXD; d++) {
        var og = outline.group({ d: 0, stagger: 0 }), row = 0, rules = [];
        (function line(n, prefix, indent) {
          var y = 72 + row * 12.5, x = SIDE + indent;
          row++;
          if (!split(n, d)) { og.text(x, y, (prefix || 'one pile, says ') + (n.kind ? '+' : 'o'), { kind: 'code', d: 0 }); return; }
          og.text(x, y, prefix + q(n), { kind: 'code', d: 0 });
          line(n.L, 'yes: ', indent + 9);
          var noY = 72 + row * 12.5;               // the row its "no" answer will be written on
          line(n.R, 'no: ', indent + 9);
          rules.push([x + 3, y + 4, noY - 4]);
        })(TREE, '', 0);
        // a thin rule down from each question to its "no", so the nesting reads as a tree
        rules.forEach(function (r) { og.line(r[0], r[1], r[0], r[2], { w: 0.6, op: 0.4, rough: 0.2, d: 0 }); });
        outlines[d] = og;
      }
      var s1 = k.root.group({ steps: [1], d: 300 });
      s1.text(SIDE, 52, 'the questions', { kind: 'label' });
      s1.text(SIDE, 352, 'called wrong', { kind: 'label' });
      var vWrong1 = s1.text(S1, 352, '', { kind: 'val', anchor: 'end' });
      var acc = k.root.layer({ steps: [1] });
      var bGrow = k.button(SIDE, 386, 'cut each pile again', function () {
        if (busy || level >= MAXD) return;
        level++; show1();
        // the new cuts, drawn across their piles
        acc.clear();
        var lines = [];
        walk(level, function (n) { if (split(n, level) && n.depth === level - 1) lines.push({ e: cutEnds(n), p: acc.path('', { accent: true, w: 1.7, op: 0.95 }) }); });
        busy = true;
        k.animate(700, function (t) {
          lines.forEach(function (l) {
            var a = l.e[0], b = l.e[1];
            l.p.setAttribute('d', 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' L' + (a[0] + (b[0] - a[0]) * t).toFixed(1) + ' ' + (a[1] + (b[1] - a[1]) * t).toFixed(1));
          });
          if (t >= 1) busy = false;
        });
      }, { steps: [1] });
      k.button(SIDE, 418, 'start over', function () { if (!busy) { level = 0; acc.clear(); show1(); } }, { steps: [1] });

      function show1() {
        for (var q2 = 0; q2 <= MAXD; q2++) {
          planes[q2].node.style.display = q2 === level ? '' : 'none';
          newest[q2].node.style.display = 'none';
          outlines[q2].node.style.display = q2 === level ? '' : 'none';
        }
        vWrong1.set(of40(wrongAt(ROWS, level).length));
        bGrow.set(level >= MAXD ? 'every pile is pure' : 'cut each pile again');
      }

      /* ================= step 2: until every pile is pure, then fresh borrowers ================= */
      var depth2 = MAXD, showFresh = false, touched = false;
      var slider = k.slider({
        x: SIDE, y: 80, w: 158, min: 1, max: MAXD, step: 1, value: depth2, label: 'levels of cuts', steps: [2],
        onChange: function (v) { touched = true; depth2 = v; show2(); }
      });
      var knobPaper = slider.node.querySelector('.ik-paper');
      var s2 = k.root.group({ steps: [2], d: 300 });
      s2.text(SIDE, 116, 'its own 40', { kind: 'label' });
      var vOwn = s2.text(S1, 116, '', { kind: 'val', anchor: 'end' });
      s2.text(SIDE, 136, '40 fresh', { kind: 'label' });
      var vFresh = s2.text(S1, 136, '', { kind: 'val', anchor: 'end' });
      var bFresh = k.button(SIDE, 170, 'show the fresh ones', function () { showFresh = !showFresh; show2(); }, { steps: [2] });

      var own = [], fresh = [], eMax = 0, bestD = 1;
      var rings2 = k.root.group({ steps: [2], d: 400, stagger: 0 }), ringSets = [];
      for (d = 1; d <= MAXD; d++) {
        own[d] = wrongAt(ROWS, d); fresh[d] = wrongAt(FRESH, d);
        eMax = Math.max(eMax, own[d].length, fresh[d].length);
        if (fresh[d].length < fresh[bestD].length) bestD = d;
        var rs = rings2.group({ d: 0 }), ro = rs.group({ d: 0 }), rf = rs.group({ d: 0 });
        own[d].forEach(function (r) { ro.circle(sx(r[0]), sy(r[1]), 8, { w: 0.8, op: 0.6 }); });
        fresh[d].forEach(function (r) { rf.circle(sx(r[0]), sy(r[1]), 8, { w: 0.8, op: 0.6 }); });
        ringSets[d] = { all: rs, own: ro, fresh: rf };
      }
      eMax = Math.ceil(eMax / 5) * 5;
      var EC = { x: 476, y: 222, w: 112, h: 96 };
      var ex = k.scale(1, MAXD, EC.x + 8, EC.x + EC.w - 4), ey = k.scale(0, eMax, EC.y + EC.h, EC.y);
      var xt = [];
      for (d = 1; d <= MAXD; d++) xt.push([ex(d), String(d)]);
      s2.text(SIDE, EC.y - 14, 'called wrong', { kind: 'label' });
      s2.axes({ x: EC.x, y: EC.y, w: EC.w, h: EC.h, xticks: xt, yticks: [[ey(0), '0'], [ey(eMax), String(eMax)]] });
      s2.text(EC.x + EC.w, EC.y + EC.h + 32, 'levels', { kind: 'label', anchor: 'end' });
      function errLine(sets, o) {
        var pts = [];
        for (var q3 = 1; q3 <= MAXD; q3++) pts.push([ex(q3), ey(sets[q3].length)]);
        s2.polyline(pts, o);
        pts.forEach(function (p) { s2.dot(p[0], p[1], o.w > 1.2 ? 2.2 : 1.6); });
        return pts;
      }
      var ownPts = errLine(own, { w: 0.8, op: 0.7, d: 500 }), freshPts = errLine(fresh, { w: 1.6, op: 0.95, d: 800 });
      var yO = ownPts[MAXD - 1][1] + 3.5, yF = freshPts[MAXD - 1][1] + 3.5;
      if (Math.abs(yO - yF) < 12) { if (yO > yF) yO = yF + 12; else yF = yO + 12; }
      s2.text(EC.x + EC.w + 5, yO, 'own', { kind: 'axis' });
      s2.text(EC.x + EC.w + 5, yF, 'fresh', { kind: 'axis' });
      var bp = freshPts[bestD - 1];
      s2.circle(bp[0], bp[1], 6, { accent: true, w: 1.3, op: 0.95, d: 1100 });
      s2.callout('b', 'fresh: fewest at ' + bestD + ' levels', SIDE, 404, { d: 1100 });
      var nowLine = s2.layer();

      function show2() {
        for (var q4 = 0; q4 <= MAXD; q4++) {
          planes[q4].node.style.display = q4 === depth2 ? '' : 'none';
          newest[q4].node.style.display = '';
          if (q4 >= 1) {
            ringSets[q4].all.node.style.display = q4 === depth2 ? '' : 'none';
            ringSets[q4].own.node.style.display = showFresh ? 'none' : '';
            ringSets[q4].fresh.node.style.display = showFresh ? '' : 'none';
          }
        }
        trainMarks.node.style.display = showFresh ? 'none' : '';
        freshMarks.node.style.display = showFresh ? '' : 'none';
        vOwn.set(own[depth2].length + ' wrong');
        vFresh.set(fresh[depth2].length + ' wrong');
        bFresh.set(showFresh ? 'show its own 40' : 'show the fresh ones');
        nowLine.clear();
        nowLine.line(ex(depth2), EC.y, ex(depth2), EC.y + EC.h, { w: 0.6, op: 0.5, rough: 0.2 });
      }

      k.onStep(function (step) {
        busy = false;
        knobPaper.style.display = step === 2 ? '' : 'none';
        trainMarks.node.style.display = '';
        freshMarks.node.style.display = 'none';
        if (step === 0) {
          for (var q5 = 0; q5 <= MAXD; q5++) planes[q5].node.style.display = 'none';
          myCut = remembered() || myCut;
          drag.set(sx(myCut), PLOT.y);
          setCut(myCut);
        } else if (step === 1) {
          acc.clear(); show1();
        } else {
          if (!touched) { depth2 = MAXD; slider.set(depth2, true); }
          show2();
        }
      });
    }
  });
})();
