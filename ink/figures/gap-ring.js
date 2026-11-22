/* Gap ring — one kind ringed by the other: no straight line splits them. Swap "up" for a new measurement built from
   the old two, the distance from the centre, and the points glide to their new places, where a flat straight line
   does split them. Drag that line (the cut); in the old picture the same cut is a circle, and the figure morphs
   between the two, point for point (a point on the circle keeps its across and gets its distance as its height).
   One step. Made-up points, fixed seed. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var NS = 'http://www.w3.org/2000/svg';
  var PLOT = { x: 44, y: 34, w: 372, h: 372 }, SIDE = 462, LO = -4, HI = 4;

  function r2(v) { return Math.round(v * 100) / 100; }
  var POINTS = (function () {
    var rand = window.InkKit.rng(31), out = [], i, r, a;
    for (i = 0; i < 10; i++) {                       // crosses, near the centre
      r = 0.25 + 1.0 * rand(); a = 2 * Math.PI * rand();
      out.push({ x: r2(r * Math.cos(a)), y: r2(r * Math.sin(a)), kind: 1 });
    }
    for (i = 0; i < 16; i++) {                       // triangles, in a ring around them
      r = 2.3 + 1.1 * rand(); a = 2 * Math.PI * (i + 0.6 * rand()) / 16;
      out.push({ x: r2(r * Math.cos(a)), y: r2(r * Math.sin(a)), kind: -1 });
    }
    out.forEach(function (p) { p.r = Math.sqrt(p.x * p.x + p.y * p.y); });
    return out;
  })();

  window.InkKit.define('gap-ring', {
    label: 'One kind ringed by the other. Measure each point\'s distance from the centre and a straight line splits them',
    steps: 1,
    seed: 31,
    draw: function (k) {
      var sx = k.scale(LO, HI, PLOT.x, PLOT.x + PLOT.w), sy = k.scale(LO, HI, PLOT.y + PLOT.h, PLOT.y);
      var t = 0, cut = 3.0, busy = false;            // t: 0 = across and up, 1 = across and distance from the centre

      var ticks = [-4, -2, 0, 2, 4];
      k.root.axes({ x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h, xlabel: 'across',
        xticks: ticks.map(function (v) { return [sx(v), String(v)]; }), yticks: ticks.map(function (v) { return [sy(v), String(v)]; }) });
      var yName = k.root.group({ d: 200 }).text(PLOT.x, PLOT.y - 10, 'up', { kind: 'label' });

      function rawPath(w, op, dash, accent) {
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', w);
        p.setAttribute('stroke-linecap', 'round'); p.setAttribute('opacity', op);
        if (dash) p.setAttribute('stroke-dasharray', dash);
        if (accent) p.setAttribute('class', 'ik-accent');
        k.root.node.appendChild(p);
        return p;
      }
      // in the new picture nothing can sit below these two lines: a point is never nearer the centre than its across
      var floor = rawPath(0.7, 0.4, '2 5');
      var cutExtra = rawPath(1.6, 0.95, null, true);
      var cutPath = rawPath(1.6, 0.95, null, true);

      var marks = k.root.group({ d: 150, stagger: 16 });
      POINTS.forEach(function (p) { p.node = marks.mark(sx(p.x), sy(p.y), p.kind > 0 ? '+' : 'tri', { r: 4 }); });
      marks.node.style.pointerEvents = 'none';

      /* the cut's handle */
      var hg = k.root.group({ d: 500 });
      hg.circle(0, 0, 6.5, { w: 1.4, op: 0.95 });
      hg.dot(0, 0, 2, {});
      var grab = document.createElementNS(NS, 'circle'); grab.setAttribute('r', 16); grab.setAttribute('class', 'ik-hit');
      hg.node.appendChild(grab);
      k.draggable(hg.node, {
        label: 'The cut. Arrow keys move it.',
        bounds: { x0: PLOT.x + 4, y0: PLOT.y + 4, x1: PLOT.x + PLOT.w - 4, y1: PLOT.y + PLOT.h - 4 },
        onMove: function (x, y) {
          if (busy) return;
          var dx = LO + (x - PLOT.x) / PLOT.w * (HI - LO), dy = LO + (PLOT.y + PLOT.h - y) / PLOT.h * (HI - LO);
          // across and up: the cut is a circle, so its size is the pointer's distance from the centre
          // across and distance: the cut is flat, so its height is all that counts
          cut = Math.max(0.2, Math.min(3.9, t < 0.5 ? Math.sqrt(dx * dx + dy * dy) : dy));
          paint();
        }
      });

      var side = k.root.group({ d: 250 });
      side.text(SIDE, 60, 'cut at', { kind: 'label' });
      var vCut = side.text(SIDE + 158, 60, '', { kind: 'val', anchor: 'end' });
      side.text(SIDE, 80, 'wrong side', { kind: 'label' });
      var vWrong = side.text(SIDE + 158, 80, '', { kind: 'val', anchor: 'end' });
      side.line(SIDE, 92, SIDE + 158, 92, { w: 0.6, op: 0.45, rough: 0.3 });
      var callA = k.root.group({ d: 500 }); callA.callout('a', 'no straight line works', SIDE, 126);
      var callB = k.root.group({ d: 500 }); callB.callout('b', 'drag the cut', SIDE, 126);
      var bSwap = k.button(SIDE, 176, 'measure from centre', function () { swap(); });
      var hand = k.root.group({ d: 900 });
      var hA = hand.text(SIDE, 236, 'a flat line here', { kind: 'hand' });
      var hB = hand.text(SIDE, 258, 'is a circle there.', { kind: 'hand' });

      function place(p) {
        // across stays; up slides to the distance from the centre
        var y = p.y + (p.r - p.y) * t;
        p.node.setAttribute('transform', 'translate(0 ' + (sy(y) - sy(p.y)).toFixed(1) + ')');
      }
      function paint() {
        POINTS.forEach(place);
        // the cut: every point of the circle of size `cut`, carried to its new place by the same rule
        var d = '';
        for (var i = 0; i <= 96; i++) {
          var a = 2 * Math.PI * i / 96, x = cut * Math.cos(a), y0 = cut * Math.sin(a), y = y0 + (cut - y0) * t;
          d += (i ? ' L' : 'M') + sx(x).toFixed(1) + ' ' + sy(y).toFixed(1);
        }
        cutPath.setAttribute('d', d);
        cutExtra.setAttribute('d', 'M' + sx(LO) + ' ' + sy(cut).toFixed(1) + ' L' + sx(-cut).toFixed(1) + ' ' + sy(cut).toFixed(1) +
          ' M' + sx(cut).toFixed(1) + ' ' + sy(cut).toFixed(1) + ' L' + sx(HI) + ' ' + sy(cut).toFixed(1));
        cutExtra.setAttribute('opacity', (0.95 * t * t).toFixed(2));
        floor.setAttribute('d', 'M' + sx(LO) + ' ' + sy(4).toFixed(1) + ' L' + sx(0) + ' ' + sy(0) + ' L' + sx(HI) + ' ' + sy(4).toFixed(1));
        floor.setAttribute('opacity', (0.4 * t).toFixed(2));
        var hx = cut * Math.SQRT1_2, hy0 = cut * Math.SQRT1_2;
        var hxNew = 3.3, hy = hy0 + (cut - hy0) * t, hxt = hx + (hxNew - hx) * t;
        hg.node.setAttribute('transform', 'translate(' + sx(hxt).toFixed(1) + ' ' + sy(hy).toFixed(1) + ')');
        var wrong = 0;
        POINTS.forEach(function (p) { if ((p.kind > 0) !== (p.r < cut)) wrong++; });
        vCut.set(cut.toFixed(2)); vWrong.set(String(wrong));
        var flat = t > 0.5;
        callA.node.style.display = flat ? 'none' : '';
        callB.node.style.display = flat ? '' : 'none';
        hA.style.display = hB.style.display = flat ? '' : 'none';
        yName.set(flat ? 'distance from the centre' : 'up');
      }
      function swap() {
        if (busy) return;
        var from = t, to = t < 0.5 ? 1 : 0;
        busy = true;
        k.animate(1500, function (u) {
          t = from + (to - from) * u; paint();
          if (u >= 1) { busy = false; bSwap.set(to ? 'back to across and up' : 'measure from centre'); }
        });
      }
      k.onStep(function () { paint(); });
    }
  });
})();
