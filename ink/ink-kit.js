/* InkKit — the shared pen for every figure on the study site. Plain script, needs global `rough`.
   A figure is one file, ink/figures/<key>.js, that calls

     InkKit.define('<key>', {
       label: 'what a screen reader should hear',
       steps: 3,                         // (a) the problem, (b) how it works, (c) try it
       draw: function (k) { ... }        // called once; build everything for every step here
     });

   and gets the site contract for free: window.ShowcaseFigures[key].mount(el, { reducedMotion, step })
   -> { setStep(n), replay(), destroy() }. The drawing space is 640 x 450 (override with width/height).

   Inside draw(k):
     k.root                         the top group. Every group has the same drawing methods (below).
     g.group({ steps: [1, 2] })     a child group that is only inked in those steps (drawn in / un-drawn by CSS)
     g.layer()                      a child group for things you redraw live (slider, drag): .clear() then draw again
     k.step()  k.onStep(fn)         current step; fn(step) runs at mount and on every step change
     k.slider(opts)  k.draggable(node, opts)  k.button(x, y, label, fn, opts)
     k.animate(ms, fn)              one-shot tween, fn(t 0..1); jumps to 1 with reduced motion; never loops
     k.rng(seed)  k.scale(d0, d1, r0, r1)  k.W  k.H  k.reduced

   Drawing methods (all return the SVG node; `o` is optional):
     line(x1, y1, x2, y2, o)   rect(x, y, w, h, o)   circle(cx, cy, r, o)   poly(points, o)   curve(points, o)
       hand-wobbled (rough.js, fixed seeds).  o: { w: 1.1, op: .8, accent, rough, d, dur, cls }
     path(d, o)   polyline(points, o)      clean strokes for data curves (same o)
     hatch(points, o)                      40 degree hairline hatch inside a polygon.  o: { angle, gap, op }
     thread(pointsOrD, o)                  a stitched (dashed, round-capped) line, sewn in along its length
     mark(x, y, kind, o)                   a data point: 'o' '+' 'x' 'sq' 'tri' 'dot'.  o: { r, accent }
     dot(x, y, r, o)   paper(x, y, w, h)   a small solid dot; a paper-coloured patch to sit a label on
     text(x, y, str, o)                    o.kind: 'label' (mono caps) 'val' 'axis' 'math' (serif italic) 'hand' 'code'
                                           o.anchor: 'start' | 'middle' | 'end'.  node.set(str) rewrites it
     callout(letter, str, x, y, o)         "(a) words" in the accent, with a leader line to o.to = [x, y]
     axes({ x, y, w, h, xlabel, ylabel, xticks: [[px, 'label']], yticks })

   Rules (ink/DRAWING-RULES.md): ONE accent element per step; hatching, never solid fills; labels in mono caps;
   fixed seeds; made-up data is labelled as such in the page caption. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var figures = window.ShowcaseFigures = window.ShowcaseFigures || {};
  var UID = 0;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var a in attrs) if (attrs[a] != null) n.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function toD(points, close) {
    var d = '';
    for (var i = 0; i < points.length; i++) d += (i ? ' L' : 'M') + r1(points[i][0]) + ' ' + r1(points[i][1]);
    return d + (close ? ' Z' : '');
  }

  function mount(host, opts, spec, key) {
    var noop = { setStep: function () {}, replay: function () {}, destroy: function () {} };
    if (!host || !window.rough) return noop;

    var W = spec.width || 640, H = spec.height || 450;
    var nSteps = spec.steps || 3;
    var reduced = !!opts.reducedMotion;
    var step = clamp(+opts.step || 0, 0, nSteps - 1);
    var uid = ++UID, seedN = (spec.seed || 1) * 1000, idN = 0;
    var destroyed = false, visible = true, started = false;
    var stepped = [], stepFns = [], cleanups = [], tweens = [];

    var svg = el('svg', {
      'class': 'ink-kit ik-' + key + ' is-undrawn' + (reduced ? ' is-reduced' : ''),
      viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': spec.label || key,
      preserveAspectRatio: 'xMidYMid meet'
    }, host);
    var defs = el('defs', null, svg);
    var rc = window.rough.svg(svg);

    function stamp(node, g, o, cls) {
      o = o || {};
      node.setAttribute('class', (cls || '') + (o.accent ? ' ik-accent' : '') + (o.cls ? ' ' + o.cls : ''));
      var d = o.d != null ? o.d : g._base + (g._n++) * g._stagger;
      node.style.setProperty('--ik-d', Math.round(d) + 'ms');
      if (o.dur) node.style.setProperty('--ik-dur', o.dur + 'ms');
      // faded things keep their opacity in a variable, so the step CSS can still take them to zero
      if (o.op != null) { if (/ik-fade/.test(cls || '')) node.style.setProperty('--ik-op', o.op); else node.style.opacity = o.op; }
      return node;
    }
    function inked(node, g, o) {
      o = o || {};
      var paths = node.tagName === 'path' ? [node] : node.querySelectorAll('path');
      for (var i = 0; i < paths.length; i++) {
        paths[i].setAttribute('pathLength', '1');
        paths[i].setAttribute('stroke', 'currentColor');
        paths[i].setAttribute('fill', 'none');
        paths[i].setAttribute('stroke-width', o.w || 1.1);
      }
      g.node.appendChild(node);
      return stamp(node, g, o, 'ik-ink');
    }
    function roughOpts(o, extra) {
      o = o || {};
      var out = { roughness: o.rough == null ? 0.7 : o.rough, bowing: 0.45, seed: ++seedN, strokeWidth: o.w || 1.1, disableMultiStroke: true, stroke: 'currentColor' };
      if (extra) for (var e in extra) out[e] = extra[e];
      return out;
    }

    function Group(node, base, stagger) {
      this.node = node; this._n = 0;
      this._base = base == null ? 0 : base;
      this._stagger = stagger == null ? 28 : stagger;
    }
    var P = Group.prototype;
    P.group = function (o) {
      o = o || {};
      var g = new Group(el('g', { 'class': 'ik-g' + (o.cls ? ' ' + o.cls : '') }, this.node),
        o.d != null ? o.d : this._base, o.stagger != null ? o.stagger : this._stagger);
      if (o.steps) { stepped.push({ node: g.node, steps: o.steps }); applyStep(); }
      return g;
    };
    P.layer = function (o) {
      var g = this.group(o);
      g.node.setAttribute('class', g.node.getAttribute('class') + ' ik-now');
      g.clear = function () {
        // threads keep a mask in <defs>; take those out with the layer's contents
        pens = pens.filter(function (p) {
          if (!g.node.contains(p.wrap)) return true;
          var mask = p.pen.parentNode;
          if (mask && mask.parentNode) mask.parentNode.removeChild(mask);
          return false;
        });
        while (g.node.firstChild) g.node.removeChild(g.node.firstChild);
        g._n = 0;
      };
      return g;
    };
    P.line = function (x1, y1, x2, y2, o) { return inked(rc.line(x1, y1, x2, y2, roughOpts(o)), this, o); };
    P.rect = function (x, y, w, h, o) { return inked(rc.rectangle(x, y, w, h, roughOpts(o)), this, o); };
    P.circle = function (cx, cy, r, o) { return inked(rc.circle(cx, cy, r * 2, roughOpts(o, { roughness: Math.min(0.5, (o && o.rough) || 0.5) })), this, o); };
    P.poly = function (points, o) { return inked(rc.polygon(points, roughOpts(o)), this, o); };
    P.curve = function (points, o) { return inked(rc.curve(points, roughOpts(o)), this, o); };
    P.path = function (d, o) { return inked(el('path', { d: d, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }), this, o); };
    P.polyline = function (points, o) { return this.path(toD(points, o && o.close), o); };
    P.hatch = function (points, o) {
      o = o || {};
      var node = rc.polygon(points, {
        seed: ++seedN, roughness: 0.5, stroke: 'none', fill: 'currentColor', fillStyle: 'hachure',
        hachureAngle: -(o.angle || 40), hachureGap: o.gap || 5, fillWeight: 0.6, disableMultiStrokeFill: true
      });
      var paths = node.querySelectorAll('path');
      for (var i = 0; i < paths.length; i++) { paths[i].setAttribute('stroke', 'currentColor'); paths[i].setAttribute('fill', 'none'); }
      this.node.appendChild(node);
      node.style.setProperty('--ik-op', o.op == null ? 0.4 : o.op);
      return stamp(node, this, { d: o.d, accent: o.accent, cls: o.cls }, 'ik-fade ik-hatch');
    };
    P.thread = function (pointsOrD, o) {
      o = o || {};
      var d = typeof pointsOrD === 'string' ? pointsOrD : toD(pointsOrD);
      var id = 'ik' + uid + 'm' + (++idN);
      var mask = el('mask', { id: id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
      var pen = el('path', { d: d, pathLength: 1, stroke: '#fff', 'stroke-width': 8, fill: 'none', 'stroke-linecap': 'round' }, mask);
      var wrap = el('g', { mask: 'url(#' + id + ')' }, this.node);
      el('path', { d: d, fill: 'none', stroke: 'currentColor', 'stroke-width': o.w || 1.2, 'stroke-linecap': 'round', 'stroke-dasharray': '5.5 4.5' }, wrap);
      stamp(wrap, this, o, 'ik-thread');
      // the mask lives in <defs>, outside the group, so it carries its own copy of the state
      pen.setAttribute('class', 'ik-pen');
      pen.style.setProperty('--ik-d', wrap.style.getPropertyValue('--ik-d'));
      wrap._pen = pen; pens.push({ wrap: wrap, pen: pen });
      syncPens();
      return wrap;
    };
    P.mark = function (x, y, kind, o) {
      o = o || {};
      var r = o.r || 4, g = el('g', null), self = this, ro = { w: o.w || 1.1, rough: 0.4 };
      function seg(x1, y1, x2, y2) { g.appendChild(rc.line(x1, y1, x2, y2, roughOpts(ro))); }
      if (kind === '+') { seg(x - r, y, x + r, y); seg(x, y - r, x, y + r); }
      else if (kind === 'x') { seg(x - r, y - r, x + r, y + r); seg(x - r, y + r, x + r, y - r); }
      else if (kind === 'sq') g.appendChild(rc.rectangle(x - r, y - r, r * 2, r * 2, roughOpts(ro)));
      else if (kind === 'tri') g.appendChild(rc.polygon([[x, y - r * 1.15], [x + r, y + r * 0.8], [x - r, y + r * 0.8]], roughOpts(ro)));
      else if (kind === 'dot') return self.dot(x, y, r * 0.6, o);
      else g.appendChild(rc.circle(x, y, r * 2, roughOpts(ro, { roughness: 0.35 })));
      el('circle', { cx: x, cy: y, r: Math.max(r + 5, 11), 'class': 'ik-hit' }, g);
      return inked(g, this, { w: o.w || 1.1, d: o.d, dur: o.dur || 300, accent: o.accent, op: o.op == null ? 0.88 : o.op, cls: 'ik-mark' + (o.cls ? ' ' + o.cls : '') });
    };
    P.dot = function (x, y, r, o) {
      return stamp(el('circle', { cx: x, cy: y, r: r || 2, fill: 'currentColor' }, this.node), this, o, 'ik-fade ik-dot');
    };
    P.paper = function (x, y, w, h, o) {
      return stamp(el('rect', { x: x, y: y, width: w, height: h }, this.node), this, o, 'ik-fade ik-paper');
    };
    P.text = function (x, y, str, o) {
      o = o || {};
      var t = el('text', { x: x, y: y, 'text-anchor': o.anchor || 'start' }, this.node);
      // labels are set in capitals here, not by CSS, so Greek letters (a lowercase lambda) are left alone
      var caps = (o.kind || 'label') === 'label';
      function shown(v) { v = String(v); return caps ? v.replace(/[a-z]+/g, function (m) { return m.toUpperCase(); }) : v; }
      t.textContent = shown(str);
      t.set = function (s) { t.textContent = shown(s); return t; };
      return stamp(t, this, o, 'ik-t ik-' + (o.kind || 'label'));
    };
    P.callout = function (letter, str, x, y, o) {
      o = o || {};
      var g = this.group({ d: o.d != null ? o.d : this._base + 500 });
      g.node.setAttribute('class', 'ik-g ik-callout ik-accent');
      if (o.to) {
        var fromX = o.from ? o.from[0] : x - 5, fromY = o.from ? o.from[1] : y - 4;
        g.line(fromX, fromY, o.to[0], o.to[1], { w: 0.7, rough: 0.4, op: 0.7, d: g._base + 360 });
      }
      g.text(x, y, '(' + letter + ') ' + str, { kind: 'note', anchor: o.anchor, d: g._base });
      return g.node;
    };
    P.axes = function (a) {
      var g = this.group({ cls: 'ik-axes' });
      g.line(a.x, a.y + a.h, a.x + a.w, a.y + a.h, { w: 1.1 });
      g.line(a.x, a.y + a.h, a.x, a.y, { w: 1.1 });
      (a.xticks || []).forEach(function (t) {
        g.line(t[0], a.y + a.h, t[0], a.y + a.h + 4, { w: 0.6, op: 0.6, rough: 0.2 });
        if (t[1] != null) g.text(t[0], a.y + a.h + 16, t[1], { kind: 'axis', anchor: 'middle' });
      });
      (a.yticks || []).forEach(function (t) {
        g.line(a.x - 4, t[0], a.x, t[0], { w: 0.6, op: 0.6, rough: 0.2 });
        if (t[1] != null) g.text(a.x - 8, t[0] + 3.5, t[1], { kind: 'axis', anchor: 'end' });
      });
      if (a.xlabel) g.text(a.x + a.w, a.y + a.h + (a.xticks ? 32 : 18), a.xlabel, { kind: 'label', anchor: 'end' });
      if (a.ylabel) g.text(a.x, a.y - 10, a.ylabel, { kind: 'label', anchor: 'start' });
      return g;
    };

    /* ---------- step state ---------- */
    var pens = [];
    function isOff(node) {
      for (var n = node; n && n !== svg; n = n.parentNode) if (n.classList && n.classList.contains('is-off')) return true;
      return false;
    }
    function syncPens() {
      for (var i = 0; i < pens.length; i++) pens[i].pen.classList.toggle('is-off', !started || isOff(pens[i].wrap));
    }
    function applyStep() {
      for (var i = 0; i < stepped.length; i++) stepped[i].node.classList.toggle('is-off', stepped[i].steps.indexOf(step) < 0);
      for (var s = 0; s < nSteps; s++) svg.classList.toggle('ik-step-' + s, s === step);
      syncPens();
    }
    function runStepFns() {
      for (var i = 0; i < stepFns.length; i++) { try { stepFns[i](step); } catch (err) { if (window.console) console.error(err); } }
    }

    /* ---------- pointer helpers ---------- */
    function toFigure(evt) {
      var m = svg.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      var p = svg.createSVGPoint();
      p.x = evt.clientX; p.y = evt.clientY;
      p = p.matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    }
    function listen(target, type, fn, o) {
      target.addEventListener(type, fn, o);
      cleanups.push(function () { target.removeEventListener(type, fn, o); });
    }
    function dragging(node, onMove, onEnd) {
      listen(node, 'pointerdown', function (e) {
        if (e.button) return;
        e.preventDefault();
        try { node.setPointerCapture(e.pointerId); } catch (err) {}
        node.classList.add('is-held');
        onMove(toFigure(e));
      });
      listen(node, 'pointermove', function (e) { if (node.classList.contains('is-held')) onMove(toFigure(e)); });
      function end() { if (node.classList.contains('is-held')) { node.classList.remove('is-held'); if (onEnd) onEnd(); } }
      listen(node, 'pointerup', end);
      listen(node, 'pointercancel', end);
    }

    var root = new Group(el('g', { 'class': 'ik-root' }, svg));
    var k = {
      root: root, svg: svg, W: W, H: H, reduced: reduced,
      rng: rng, clamp: clamp,
      scale: function (d0, d1, r0, r1) { return function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); }; },
      step: function () { return step; },
      onStep: function (fn) { stepFns.push(fn); },
      toFigure: toFigure,

      /* a pen slider.  { x, y, w, min, max, step, value, label, format(v), steps: [1, 2], onChange(v) } */
      slider: function (s) {
        var g = root.group({ steps: s.steps, cls: 'ik-slider', d: s.d });
        var stepSize = s.step || 1, value = s.value == null ? s.min : s.value;
        var fmt = s.format || function (v) { return String(v); };
        g.text(s.x, s.y - 14, s.label || '', { kind: 'label' });
        var val = g.text(s.x + s.w, s.y - 14, fmt(value), { kind: 'val', anchor: 'end' });
        g.line(s.x, s.y, s.x + s.w, s.y, { w: 1.1 });
        g.line(s.x, s.y - 4, s.x, s.y + 4, { w: 0.8, rough: 0.3 });
        g.line(s.x + s.w, s.y - 4, s.x + s.w, s.y + 4, { w: 0.8, rough: 0.3 });
        var knob = el('g', { 'class': 'ik-knob' }, g.node);
        el('circle', { r: 6.5, 'class': 'ik-paper' }, knob);
        var ring = new Group(knob, g._base + 300, 0);
        ring.circle(0, 0, 6, { w: 1.4, op: 0.95 });
        var hit = el('rect', { x: s.x - 12, y: s.y - 16, width: s.w + 24, height: 32, 'class': 'ik-hit', tabindex: 0, role: 'slider',
          'aria-label': s.label || 'slider', 'aria-valuemin': s.min, 'aria-valuemax': s.max }, g.node);
        function place() {
          knob.setAttribute('transform', 'translate(' + r1(s.x + (value - s.min) / (s.max - s.min) * s.w) + ' ' + s.y + ')');
          val.set(fmt(value));
          hit.setAttribute('aria-valuenow', value);
          hit.setAttribute('aria-valuetext', fmt(value));
        }
        function set(v, quiet) {
          v = clamp(Math.round((v - s.min) / stepSize) * stepSize + s.min, s.min, s.max);
          v = Math.round(v * 1e6) / 1e6;
          if (v === value) return;
          value = v; place();
          if (!quiet && s.onChange) s.onChange(value);
        }
        dragging(hit, function (p) { set(s.min + clamp((p.x - s.x) / s.w, 0, 1) * (s.max - s.min)); });
        listen(hit, 'keydown', function (e) {
          var dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
          if (e.key === 'Home') { e.preventDefault(); set(s.min); }
          else if (e.key === 'End') { e.preventDefault(); set(s.max); }
          else if (dir) { e.preventDefault(); set(value + dir * stepSize * (e.shiftKey ? 5 : 1)); }
        });
        place();
        return { get value() { return value; }, set: set, node: g.node };
      },

      /* make a drawn node draggable.  { bounds: { x0, y0, x1, y1 }, onMove(x, y), onEnd(), label } */
      draggable: function (node, d) {
        var b = d.bounds || { x0: 0, y0: 0, x1: W, y1: H }, pos = { x: d.x || 0, y: d.y || 0 };
        node.classList.add('ik-drag');
        node.setAttribute('tabindex', 0);
        node.setAttribute('role', 'button');
        if (d.label) node.setAttribute('aria-label', d.label);
        function move(x, y) { pos.x = clamp(x, b.x0, b.x1); pos.y = clamp(y, b.y0, b.y1); d.onMove(pos.x, pos.y); }
        dragging(node, function (p) { move(p.x, p.y); }, d.onEnd);
        listen(node, 'keydown', function (e) {
          var dx = e.key === 'ArrowRight' ? 6 : e.key === 'ArrowLeft' ? -6 : 0, dy = e.key === 'ArrowDown' ? 6 : e.key === 'ArrowUp' ? -6 : 0;
          if (!dx && !dy) return;
          e.preventDefault(); move(pos.x + dx, pos.y + dy); if (d.onEnd) d.onEnd();
        });
        return { set: function (x, y) { pos.x = x; pos.y = y; } };
      },

      /* a written button: mono caps over a short stitched underline.  o: { steps, anchor } */
      button: function (x, y, label, fn, o) {
        o = o || {};
        var g = root.group({ steps: o.steps, cls: 'ik-button', d: o.d });
        var t = g.text(x, y, label, { kind: 'label', anchor: o.anchor });
        var w = label.length * 7.4 + 4, x0 = o.anchor === 'end' ? x - w : o.anchor === 'middle' ? x - w / 2 : x;
        g.thread([[x0, y + 6], [x0 + w, y + 6]], { w: 1 });
        var hit = el('rect', { x: x0 - 6, y: y - 16, width: w + 12, height: 30, 'class': 'ik-hit', tabindex: 0, role: 'button', 'aria-label': label }, g.node);
        listen(hit, 'click', function () { fn(); });
        listen(hit, 'keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
        return { node: g.node, set: function (s) { t.set(s); hit.setAttribute('aria-label', s); } };
      },

      /* one-shot tween: fn(t) with t eased 0..1 over ms. Returns a cancel function. */
      animate: function (ms, fn) {
        if (reduced || !ms) { fn(1); return function () {}; }
        var t0 = null, live = true;
        function frame(now) {
          if (!live || destroyed) return;
          if (t0 === null) t0 = now;
          var t = clamp((now - t0) / ms, 0, 1);
          fn(t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
          if (t < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        var cancel = function () { live = false; };
        tweens.push(cancel);
        return cancel;
      }
    };

    try { spec.draw(k); }
    catch (err) { if (window.console) console.error('ink figure "' + key + '" failed to draw', err); }
    applyStep();
    runStepFns();

    function start() {
      if (started || destroyed) return;
      started = true;
      svg.getBoundingClientRect();             // commit the un-drawn state before letting the ink run
      svg.classList.remove('is-undrawn');
      syncPens();
    }
    var io = null;
    if (reduced || !window.IntersectionObserver) start();
    else {
      io = new IntersectionObserver(function (entries) {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible) start();
      }, { threshold: 0.15 });
      io.observe(host);
    }

    return {
      setStep: function (n) {
        n = clamp(+n || 0, 0, nSteps - 1);
        if (n === step) return;
        step = n;
        tweens.forEach(function (c) { c(); }); tweens = [];
        applyStep();
        runStepFns();
      },
      replay: function () {
        if (reduced) return;
        svg.classList.add('is-undrawn'); started = false; syncPens();
        setTimeout(start, 60);
      },
      destroy: function () {
        destroyed = true;
        if (io) io.disconnect();
        cleanups.forEach(function (c) { c(); });
        if (svg.parentNode) svg.parentNode.removeChild(svg);
      }
    };
  }

  window.InkKit = {
    define: function (key, spec) {
      figures[key] = { mount: function (host, opts) { return mount(host, opts || {}, spec, key); } };
    },
    rng: rng
  };
})();
