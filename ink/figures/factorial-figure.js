/* Factorial figure — three things to test, two choices each, drawn as a cube whose 8 corners are the 8 ads.
   Steps: 0 every combination (every corner is one ad) · 1 you choose: a budget of four runs, click corners
          in or out · 2 a balanced half (4 corners, chosen so every choice appears twice and every pair of
          choices once), and the other half.
   The run count and the balance readouts are counted from whichever corners are selected, in every step.
   Offers the corners you chose to the page's Python: `from page import my_runs` gives one
   (font, background, headline) triple per chosen corner; before you choose any, the balanced half.
   Illustration: no data. Needs InkKit (ink/ink-kit.js). */
(function () {
  'use strict';
  if (!window.InkKit) return;

  var NS = 'http://www.w3.org/2000/svg';
  var F = { x: 108, y: 340 }, S = 190, DX = 84, DY = -64;   // front-bottom-left corner, edge length, depth offset
  var SIDE = 462, RIGHT = 620;
  var FACTORS = [
    { name: 'font', levels: ['Arial', 'Roboto'] },
    { name: 'background', levels: ['white', 'gold'] },
    { name: 'headline', levels: ['short', 'long'] }
  ];
  var SHOWN = 7;                                            // the corner spelled out in step 0: Roboto, gold, long
  var BUDGET = 4;
  var MINE = [0, 0, 0, 0, 0, 0, 0, 0];                      // the corners the reader has chosen in step 1

  /* corner c is three bits: font, background, wording */
  function bit(c, f) { return (c >> f) & 1; }
  function at(c) { return [F.x + bit(c, 0) * S + bit(c, 2) * DX, F.y - bit(c, 1) * S + bit(c, 2) * DY]; }
  function parity(c) { return (bit(c, 0) + bit(c, 1) + bit(c, 2)) % 2; }

  /* how often each choice, and each pair of choices from two different factors, appears in the chosen runs */
  function balance(sel) {
    var runs = 0, c, f, g, v, u, n;
    var choice = { min: Infinity, max: 0 }, pair = { min: Infinity, max: 0 };
    function note(r, count) { r.min = Math.min(r.min, count); r.max = Math.max(r.max, count); }
    for (c = 0; c < 8; c++) if (sel[c]) runs++;
    for (f = 0; f < 3; f++) for (v = 0; v < 2; v++) {
      n = 0;
      for (c = 0; c < 8; c++) if (sel[c] && bit(c, f) === v) n++;
      note(choice, n);
    }
    for (f = 0; f < 3; f++) for (g = f + 1; g < 3; g++) for (v = 0; v < 2; v++) for (u = 0; u < 2; u++) {
      n = 0;
      for (c = 0; c < 8; c++) if (sel[c] && bit(c, f) === v && bit(c, g) === u) n++;
      note(pair, n);
    }
    return { runs: runs, choice: choice, pair: pair, ok: runs > 0 && choice.min === choice.max && pair.min === pair.max };
  }
  /* what `from page import my_runs` gives the Python on this page (see ink/py.js) */
  window.InkPage = window.InkPage || {};
  window.InkPage.my_runs = function () {
    var out = [], any = MINE.some(function (v) { return v; });
    for (var c = 0; c < 8; c++) if (any ? MINE[c] : parity(c) === 0) out.push(FACTORS.map(function (f, i) { return f.levels[bit(c, i)]; }));
    return out;
  };

  function times(r) { return r.min === r.max ? r.min + (r.min === 1 ? ' time' : ' times') : r.min + ' to ' + r.max; }

  window.InkKit.define('factorial-figure', {
    label: 'A two by two by two factorial design drawn as a cube. Each of the eight corners is one combination of font, background and wording.',
    steps: 3,
    seed: 3,
    draw: function (k) {
      var all = [1, 1, 1, 1, 1, 1, 1, 1];
      var half = all.map(function (_, c) { return parity(c) === 0 ? 1 : 0; });
      var mine = MINE, focused = -1;

      /* ---- the cube: nine edges you can see, three you cannot ---- */
      var cube = k.root.group({ d: 100, stagger: 70 });
      for (var a = 0; a < 8; a++) for (var f = 0; f < 3; f++) {
        if (bit(a, f)) continue;
        var b = a | (1 << f), p = at(a), q = at(b);
        if (a === 4 || b === 4) cube.thread([p, q], { w: 1 });           // the far bottom-left corner is hidden
        else cube.line(p[0], p[1], q[0], q[1], { w: 1.1, rough: 0.6 });
      }
      var names = k.root.group({ d: 700 });
      names.text(F.x + S / 2, F.y + 46, FACTORS[0].name, { kind: 'label', anchor: 'middle' });
      names.text(F.x, F.y + 28, FACTORS[0].levels[0], { kind: 'axis', anchor: 'middle' });
      names.text(F.x + S, F.y + 28, FACTORS[0].levels[1], { kind: 'axis', anchor: 'middle' });
      names.text(F.x - 20, F.y - S / 2 + 4, FACTORS[1].name, { kind: 'label', anchor: 'end' });
      names.text(F.x - 20, F.y + 4, FACTORS[1].levels[0], { kind: 'axis', anchor: 'end' });
      names.text(F.x - 20, F.y - S + 4, FACTORS[1].levels[1], { kind: 'axis', anchor: 'end' });
      names.text(F.x + S + DX / 2 + 12, F.y + DY / 2 + 12, FACTORS[2].name, { kind: 'label' });
      names.text(F.x + S + 18, F.y + 8, 'short', { kind: 'axis' });
      names.text(F.x + S + DX + 18, F.y + DY + 6, 'long', { kind: 'axis' });

      /* ---- the readouts, counted from the selected corners ---- */
      var side = k.root.group({ d: 300 });
      function readout(y, label) {
        side.text(SIDE, y, label, { kind: 'label' });
        return side.text(RIGHT, y, '', { kind: 'val', anchor: 'end' });
      }
      var runsVal = readout(60, 'runs'), choiceVal = readout(80, 'each choice'), pairVal = readout(100, 'each pair');
      side.line(SIDE, 112, RIGHT, 112, { w: 0.6, op: 0.45, rough: 0.3 });
      var okVal = readout(132, 'balanced');

      var live = k.root.layer();
      function selection() { return k.step() === 0 ? all : k.step() === 2 ? half : mine; }
      function redraw() {
        var sel = selection(), step = k.step(), bal = balance(sel);
        live.clear();
        for (var c = 0; c < 8; c++) {
          var p = at(c);
          live.paper(p[0] - 4, p[1] - 4, 8, 8);
          live.mark(p[0], p[1], 'o', { r: 5.5, w: c === focused ? 2 : 1.2, op: sel[c] ? 0.95 : 0.3 });
          if (step === 0 ? c === SHOWN : sel[c]) live.circle(p[0], p[1], 11.5, { accent: true, w: 1.5, op: 0.95 });
        }
        runsVal.set(bal.runs + (step === 1 ? ' of ' + BUDGET : ' of 8'));
        full.set(step === 1 && bal.runs >= BUDGET ? 'budget used up' : '');
        choiceVal.set(bal.runs ? times(bal.choice) : '0 times');
        pairVal.set(bal.runs ? times(bal.pair) : '0 times');
        okVal.set(bal.ok ? 'yes' : 'no');
      }

      /* ---- step 0: one corner spelled out ---- */
      var g0 = k.root.group({ steps: [0], d: 500 });
      var shown = at(SHOWN);
      g0.callout('a', 'one corner, one ad', SIDE, 170, { to: [shown[0] + 15, shown[1] + 6], d: 900 });
      FACTORS.forEach(function (fac, i) {
        g0.text(SIDE, 194 + i * 16, fac.levels[bit(SHOWN, i)] + ' ' + (i === 0 ? 'font' : fac.name), { kind: 'label', d: 1300 + i * 120 });
      });

      /* ---- step 2: the balanced half ---- */
      var g2b = k.root.group({ steps: [2], d: 300 });
      g2b.callout('c', 'half the runs, balanced', SIDE, 170, { d: 600 });
      k.button(SIDE, 212, 'the other half', function () {
        half = half.map(function (v) { return 1 - v; });
        redraw();
      }, { steps: [2], d: 500 });

      /* ---- step 1: you choose, four at most ---- */
      var g2 = k.root.group({ steps: [1], d: 300 });
      g2.callout('b', 'click four corners', SIDE, 170, { d: 300 });
      var full = g2.text(SIDE, 196, '', { kind: 'axis' });
      g2.text(SIDE, 336, 'can four runs try', { kind: 'hand', d: 700 });
      g2.text(SIDE, 358, 'everything fairly?', { kind: 'hand', d: 1100 });
      k.button(SIDE, 236, 'clear', function () { for (var c = 0; c < 8; c++) mine[c] = 0; redraw(); }, { steps: [1], d: 500 });

      // the kit has sliders, drags and written buttons but no clickable mark, so each corner gets its own target
      var hits = document.createElementNS(NS, 'g');
      g2.node.appendChild(hits);
      function describe(c) {
        return FACTORS.map(function (fac, i) { return fac.levels[bit(c, i)]; }).join(', ') + (mine[c] ? ': in the design' : ': left out');
      }
      for (var c = 0; c < 8; c++) (function (c) {
        var p = at(c), hit = document.createElementNS(NS, 'circle');
        hit.setAttribute('cx', p[0]); hit.setAttribute('cy', p[1]); hit.setAttribute('r', 15);
        hit.setAttribute('class', 'ik-hit');
        hit.setAttribute('tabindex', 0); hit.setAttribute('role', 'button');
        hit.style.cursor = 'pointer';
        function sync() { hit.setAttribute('aria-pressed', mine[c] ? 'true' : 'false'); hit.setAttribute('aria-label', describe(c)); }
        function toggle() {
          if (k.step() !== 1) return;
          if (!mine[c] && balance(mine).runs >= BUDGET) return;      // the budget is spent: take one out first
          mine[c] = mine[c] ? 0 : 1; redraw();
        }
        hit.addEventListener('click', toggle);
        hit.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
        hit.addEventListener('focus', function () { focused = c; redraw(); });
        hit.addEventListener('blur', function () { if (focused === c) { focused = -1; redraw(); } });
        hits.appendChild(hit);
        k.onStep(sync);
        hit.addEventListener('click', sync);
        hit.addEventListener('keydown', sync);
      })(c);

      k.onStep(redraw);
    }
  });
})();
