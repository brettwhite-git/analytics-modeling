/* Ink plots — every R plot on the site, redrawn by hand. Plain script, needs global `rough`.
   R (svglite) gives exact geometry: where each line, bar, point and label goes. This script reads that
   SVG and draws it again with the site's pen: wobbled strokes with fixed seeds, hatching instead of
   solid fills, stitched thread for dashed lines, marks whose SHAPE tells series apart, labels in mono,
   colours from the site tokens (so both themes work), drawn in when the plot scrolls into view.
   The numbers stay R's; only the hand changes. Markup comes from ink/plots.lua:
     <figure class="ink-plot"><div class="ink-plot__stage" data-ink-plot><svg>...</svg></div>...</figure> */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SHAPES = ['o', '+', 'x', 'sq', 'tri'];
  var MAX_ELEMENTS = 6000;
  var uid = 0;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var a in attrs) if (attrs[a] != null) n.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function num(v) { return parseFloat(v) || 0; }
  function r1(v) { return Math.round(v * 10) / 10; }

  /* ---------- reading svglite's inline styles ---------- */
  function styleOf(node) {
    var out = {};
    (node.getAttribute('style') || '').split(';').forEach(function (part) {
      var i = part.indexOf(':');
      if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    });
    return out;
  }
  function rgb(value) {
    if (!value || value === 'none' || value === 'inherit') return null;
    var m = /^#([0-9a-f]{6})/i.exec(value);
    if (m) { var n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
    m = /rgba?\(([^)]+)\)/.exec(value);
    if (m) { var p = m[1].split(',').map(num); return [p[0], p[1], p[2]]; }
    return null;
  }
  /* a colour R chose -> a role on the site: paper, ink, stone, faint, or one of five series hues */
  function role(value) {
    var c = rgb(value);
    if (!c) return null;
    var max = Math.max(c[0], c[1], c[2]), min = Math.min(c[0], c[1], c[2]), lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
    if (max - min < 28) return lum > 0.97 ? 'paper' : lum > 0.74 ? 'faint' : lum > 0.22 ? 'stone' : 'ink';
    var h, d = max - min;
    if (max === c[0]) h = ((c[1] - c[2]) / d) % 6; else if (max === c[1]) h = (c[2] - c[0]) / d + 2; else h = (c[0] - c[1]) / d + 4;
    h = (h * 60 + 360) % 360;
    if (h >= 185 && h < 262) return 's1';          // blues: the accent
    if (h < 22 || h >= 335) return lum < 0.36 ? 's5' : 's2';   // reds; a dark red is its own series
    if (h < 50) return 's2';                       // oranges, coral
    if (h < 80) return 's5';                       // yellows
    if (h < 185) return 's3';                      // greens
    return 's4';                                   // purples
  }
  function weight(w) { w = num(w) || 1; return w < 0.9 ? 0.6 : w < 2 ? 1.1 : 1.7; }
  function pointsOf(node) {
    var raw = (node.getAttribute('points') || '').trim().split(/[\s,]+/).map(num), out = [];
    for (var i = 0; i + 1 < raw.length; i += 2) out.push([raw[i], raw[i + 1]]);
    return out;
  }
  function bbox(pts) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function toD(pts, close) {
    var d = '';
    for (var i = 0; i < pts.length; i++) d += (i ? ' L' : 'M') + r1(pts[i][0]) + ' ' + r1(pts[i][1]);
    return d + (close ? ' Z' : '');
  }

  function reink(stage) {
    var src = stage.querySelector('svg');
    if (!src || !window.rough || src.getAttribute('data-inked')) return;
    var all = src.querySelectorAll('line, polyline, polygon, rect, circle, path, text, image');
    if (all.length > MAX_ELEMENTS) { stage.classList.add('is-flat'); return; }

    var vb = (src.getAttribute('viewBox') || '0 0 504 360').split(/\s+/).map(num), W = vb[2], H = vb[3];
    var out = el('svg', { 'class': 'ink-kit ink-plot__svg' + (reduced ? ' is-reduced' : ' is-undrawn'), viewBox: vb.join(' '), role: 'img', 'data-inked': 'true' });
    var caption = stage.parentNode.querySelector('figcaption');
    out.setAttribute('aria-label', caption ? caption.textContent : 'Plot');
    var rc = window.rough.svg(out), seed = 4000, order = 0, shapeOf = {}, nShapes = 0;

    function ro(w, roughness) { return { roughness: roughness == null ? 0.55 : roughness, bowing: 0.35, seed: ++seed, strokeWidth: w, disableMultiStroke: true, stroke: 'currentColor' }; }
    function place(node, parent, cls, colour, opacity) {
      node.setAttribute('class', cls + (colour ? ' ip-' + colour : ''));
      node.style.setProperty('--ik-d', Math.min(1500, (order++) * 9) + 'ms');
      if (opacity != null && opacity < 0.999) node.style.setProperty('--ip-op', opacity);
      parent.appendChild(node);
      return node;
    }
    function ink(node, parent, w, colour, opacity) {
      var paths = node.tagName === 'path' ? [node] : node.querySelectorAll('path');
      for (var i = 0; i < paths.length; i++) {
        paths[i].setAttribute('pathLength', '1'); paths[i].setAttribute('fill', 'none');
        paths[i].setAttribute('stroke', 'currentColor'); paths[i].setAttribute('stroke-width', w);
      }
      if (node.tagName === 'path') { var g = el('g'); g.appendChild(node); node = g; }
      return place(node, parent, 'ik-ink ip-stroke', colour, opacity);
    }
    function hatch(pts, parent, colour, opacity, gap) {
      var node = rc.polygon(pts, { seed: ++seed, roughness: 0.4, stroke: 'none', fill: 'currentColor', fillStyle: 'hachure', hachureAngle: -40, hachureGap: gap || 4.5, fillWeight: 0.6, disableMultiStrokeFill: true });
      var paths = node.querySelectorAll('path');
      for (var i = 0; i < paths.length; i++) { paths[i].setAttribute('stroke', 'currentColor'); paths[i].setAttribute('fill', 'none'); paths[i].setAttribute('stroke-width', 0.6); }
      return place(node, parent, 'ik-fade ip-hatch', colour, opacity);
    }
    function mark(x, y, r, shape, parent, colour, opacity) {
      var g = el('g'), o = ro(1.1, 0.35);
      r = Math.max(2.4, Math.min(4.6, r * 0.95));
      function seg(a, b, c, d) { g.appendChild(rc.line(a, b, c, d, ro(1.1, 0.35))); }
      if (shape === '+') { seg(x - r, y, x + r, y); seg(x, y - r, x, y + r); }
      else if (shape === 'x') { r *= 0.85; seg(x - r, y - r, x + r, y + r); seg(x - r, y + r, x + r, y - r); }
      else if (shape === 'sq') { r *= 0.85; g.appendChild(rc.rectangle(x - r, y - r, r * 2, r * 2, o)); }
      else if (shape === 'tri') g.appendChild(rc.polygon([[x, y - r * 1.1], [x + r, y + r * 0.8], [x - r, y + r * 0.8]], o));
      else if (shape === 'dot') return place(el('circle', { cx: x, cy: y, r: Math.max(1.4, r * 0.55), fill: 'currentColor' }), parent, 'ik-fade ip-dot', colour, opacity);
      else g.appendChild(rc.circle(x, y, r * 2, o));
      return ink(g, parent, 1.1, colour, opacity);
    }
    /* each fill colour used for points gets its own shape, in the order the plot first uses it */
    function shapeFor(colour) {
      if (colour === 'ink' || colour === 'stone') return 'dot';
      if (!shapeOf[colour]) shapeOf[colour] = SHAPES[nShapes++ % SHAPES.length];
      return shapeOf[colour];
    }

    function draw(node, parent) {
      var tag = node.tagName.toLowerCase(), s = styleOf(node);
      var stroke = s.stroke === 'none' ? null : role(s.stroke || '#000000');
      var fill = role(s.fill), fo = s['fill-opacity'] != null ? num(s['fill-opacity']) : (s.opacity != null ? num(s.opacity) : 1);
      var so = s['stroke-opacity'] != null ? num(s['stroke-opacity']) : 1;
      var w = weight(s['stroke-width']), dashed = !!s['stroke-dasharray'] && s['stroke-dasharray'] !== 'none';

      if (tag === 'text') {
        if (s.fill === 'none') return null;                           // text R only drew to measure it
        if (role(s.fill || '#000000') === 'paper') return null;      // a white copy R drew as a halo; the page gives every label one
        var size = num(s['font-size']) || 10, bold = /bold|[6-9]00/.test(s['font-weight'] || '');
        var t = el('text', { x: node.getAttribute('x'), y: node.getAttribute('y'), 'text-anchor': node.getAttribute('text-anchor'), transform: node.getAttribute('transform') });
        t.textContent = node.textContent;
        t.style.fontSize = r1(Math.max(7.5, size * 0.8)) + 'px';
        var tc = role(s.fill || '#000000');
        return place(t, parent, 'ik-t ip-text' + (bold ? ' ip-text--strong' : ''), tc && tc.charAt(0) === 's' ? tc : null);
      }
      if (tag === 'image') return place(node.cloneNode(true), parent, 'ik-fade ip-image');

      if (tag === 'circle') {
        var cx = num(node.getAttribute('cx')), cy = num(node.getAttribute('cy')), r = num(node.getAttribute('r'));
        if (r > 8) return ink(rc.circle(cx, cy, r * 2, ro(w, 0.5)), parent, w, stroke || fill, fill ? fo : so);
        if (fill && fill !== 'paper') return mark(cx, cy, r, shapeFor(fill), parent, fill, fo < 0.999 ? Math.max(0.45, fo) : null);
        return mark(cx, cy, r, 'o', parent, stroke || 'ink', so);
      }

      if (tag === 'rect' && node.getAttribute('data-region')) {
        // one strip of a shaded region (ink/plots.lua merged the cells): collect the strips of one
        // colour into a clip, and hatch the whole region once
        var key = fill + '|' + (parent.getAttribute('clip-path') || '');
        var reg = regions[key];
        if (!reg) {
          reg = regions[key] = { colour: fill, opacity: fo, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity,
            clip: el('clipPath', { id: 'ipr' + (++uid) }, defs), holder: null };
          reg.holder = el('g', { 'clip-path': 'url(#' + reg.clip.id + ')' }, parent);
          regionList.push(reg);
        }
        var rx = num(node.getAttribute('x')), ry = num(node.getAttribute('y')), rww = num(node.getAttribute('width')), rhh = num(node.getAttribute('height'));
        el('rect', { x: rx, y: ry, width: rww, height: rhh + 0.3 }, reg.clip);
        reg.x0 = Math.min(reg.x0, rx); reg.y0 = Math.min(reg.y0, ry); reg.x1 = Math.max(reg.x1, rx + rww); reg.y1 = Math.max(reg.y1, ry + rhh);
        return null;
      }

      if (tag === 'rect') {
        var x = num(node.getAttribute('x')), y = num(node.getAttribute('y')), rw = num(node.getAttribute('width')), rh = num(node.getAttribute('height'));
        if (/%/.test(node.getAttribute('width') || '')) return null;          // the page background
        if ((!fill || fill === 'paper') && !stroke) return null;              // panel and legend backgrounds
        if (rw < 0.5 || rh < 0.5) return null;
        var corners = [[x, y], [x + rw, y], [x + rw, y + rh], [x, y + rh]];
        if (fill && fill !== 'paper') hatch(corners, parent, fill, Math.max(0.25, Math.min(0.6, fo * 0.6)), rw * rh > 9000 ? 6 : 4.5);
        if (stroke || (fill && fill !== 'paper')) ink(rc.rectangle(x, y, rw, rh, ro(stroke ? w : 0.9, 0.5)), parent, stroke ? w : 0.9, stroke || fill, stroke ? so : 0.85);
        return null;
      }

      if (tag === 'line' || tag === 'polyline' || tag === 'polygon') {
        var pts = tag === 'line'
          ? [[num(node.getAttribute('x1')), num(node.getAttribute('y1'))], [num(node.getAttribute('x2')), num(node.getAttribute('y2'))]]
          : pointsOf(node);
        if (pts.length < 2) return null;
        if (tag === 'polygon') {
          var b = bbox(pts);
          if (b.w < 13 && b.h < 13 && fill && fill !== 'paper') {            // a small filled polygon is a point drawn as a triangle or diamond
            return mark(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) / 2, pts.length === 3 ? 'tri' : shapeFor(fill), parent, fill, fo < 0.999 ? Math.max(0.45, fo) : null);
          }
          if (fill && fill !== 'paper') hatch(pts, parent, fill, Math.max(0.22, Math.min(0.55, fo * 0.6)), b.w * b.h > 9000 ? 6 : 4.5);
          if (stroke) ink(el('path', { d: toD(pts, true), 'stroke-linejoin': 'round' }), parent, w, stroke, so);
          return null;
        }
        if (!stroke) return null;
        if (stroke === 'faint') {                                             // grid lines: kept, very quiet
          return place(el('path', { d: toD(pts), fill: 'none', stroke: 'currentColor', 'stroke-width': 0.5 }), parent, 'ik-fade ip-grid', 'faint');
        }
        if (dashed) {                                                         // a dashed line becomes stitched thread
          return place(el('path', { d: toD(pts), fill: 'none', stroke: 'currentColor', 'stroke-width': Math.min(w, 1.2), 'stroke-linecap': 'round', 'stroke-dasharray': '5.5 4.5' }), parent, 'ik-fade ip-thread', stroke, so);
        }
        if (pts.length === 2) return ink(rc.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], ro(w, 0.5)), parent, w, stroke, so);
        if (pts.length <= 24) return ink(rc.linearPath(pts, ro(w, 0.4)), parent, w, stroke, so);
        return ink(el('path', { d: toD(pts), 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }), parent, w, stroke, so);
      }

      if (tag === 'path') {
        var p = el('path', { d: node.getAttribute('d'), 'stroke-linejoin': 'round' });
        if (fill && fill !== 'paper') {
          var f = p.cloneNode(false);
          f.setAttribute('fill', 'currentColor'); f.setAttribute('stroke', 'none');
          place(f, parent, 'ik-fade ip-wash', fill, Math.min(0.16, fo * 0.3));
        }
        if (stroke) ink(p, parent, w, stroke, so);
      }
      return null;
    }

    /* walk R's tree; keep its clipping groups so nothing spills out of a panel */
    function walk(from, to) {
      for (var i = 0; i < from.children.length; i++) {
        var child = from.children[i], tag = child.tagName.toLowerCase();
        if (tag === 'defs') {
          var clips = child.querySelectorAll('clipPath');
          for (var c = 0; c < clips.length; c++) defs.appendChild(clips[c].cloneNode(true));
        } else if (tag === 'g') {
          var g = el('g', { 'clip-path': child.getAttribute('clip-path') }, to);
          walk(child, g);
        } else if (tag !== 'style') {
          try { draw(child, to); } catch (err) { if (window.console) console.error('ink plot: could not redraw a ' + tag, err); }
        }
      }
    }
    var defs = el('defs', null, out), regions = {}, regionList = [];
    walk(src, out);
    regionList.forEach(function (reg, i) {
      var box = [[reg.x0, reg.y0], [reg.x1, reg.y0], [reg.x1, reg.y1], [reg.x0, reg.y1]];
      var node = rc.polygon(box, { seed: ++seed, roughness: 0.4, stroke: 'none', fill: 'currentColor', fillStyle: 'hachure',
        hachureAngle: reg.colour === 's1' ? -40 : 40, hachureGap: 5.5, fillWeight: 0.6, disableMultiStrokeFill: true });
      var paths = node.querySelectorAll('path');
      for (var p = 0; p < paths.length; p++) { paths[p].setAttribute('stroke', 'currentColor'); paths[p].setAttribute('fill', 'none'); paths[p].setAttribute('stroke-width', 0.6); }
      node.setAttribute('class', 'ik-fade ip-hatch ip-' + reg.colour);
      node.style.setProperty('--ip-op', 0.42);
      reg.holder.appendChild(node);
    });

    src.parentNode.replaceChild(out, src);
    stage.style.aspectRatio = W + ' / ' + H;

    if (!reduced) {
      var start = function () { out.getBoundingClientRect(); out.classList.remove('is-undrawn'); };
      if (!window.IntersectionObserver) start();
      else {
        var io = new IntersectionObserver(function (entries) {
          if (entries[entries.length - 1].isIntersecting) { io.disconnect(); start(); }
        }, { threshold: 0.12 });
        io.observe(stage);
      }
    }
  }

  function start() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-ink-plot]'), function (stage) {
      try { reink(stage); } catch (err) { if (window.console) console.error('ink plot failed', err); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
