/* Ink — page behaviour for the study site. Plain script, no build step.
   1. Mounts ink figures written in a .qmd as
        ::: {.ink-figure data-figure="svm-figure" data-step="1" data-caption="Fig. 2 · ..."}
        :::
      data-step   the step the figure opens on (default 0)
      data-steps  optional buttons, "2:slide λ|3:move a point" (step:label), lettered (c), (d) by step
      The figure script is loaded on demand from ink/figures/<data-figure>.js.
   2. Sews a seam above every section, one stitch at a time, when it scrolls into view.
   3. Draws the ruler that shows how far down the sheet you are.
   Figures follow the contract in ink/AUTHORING.md: window.ShowcaseFigures[key].mount(el, opts). */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BASE = ((document.currentScript && document.currentScript.src) || 'ink/ink.js').replace(/ink\.js(\?.*)?$/, '');
  var STITCH = 11;        // px, one stitch and its gap (matches --stitch in ink.css)
  var STITCH_MS = 16;     // one stitch per step: a sewing machine, not a wipe

  /* ---------- figures ---------- */
  var loading = {};
  function loadFigure(key) {
    if (window.ShowcaseFigures && window.ShowcaseFigures[key]) return Promise.resolve();
    if (!loading[key]) {
      loading[key] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = BASE + 'figures/' + key + '.js';
        s.onload = resolve;
        s.onerror = function () { reject(new Error('could not load ' + s.src)); };
        document.head.appendChild(s);
      });
    }
    return loading[key];
  }

  function mountFigure(host) {
    var key = host.getAttribute('data-figure');
    var figure = window.ShowcaseFigures && window.ShowcaseFigures[key];
    if (!figure || host.getAttribute('data-mounted')) return;
    host.setAttribute('data-mounted', 'true');

    var first = parseInt(host.getAttribute('data-step'), 10) || 0;
    var steps = (host.getAttribute('data-steps') || '').split('|').filter(Boolean).map(function (item, i) {
      var m = /^\s*(\d+)\s*:(.*)$/.exec(item);
      return m ? { step: +m[1], label: m[2].trim() } : { step: i, label: item.trim() };
    });
    var caption = host.getAttribute('data-caption');
    host.textContent = '';

    // on a phone the drawing keeps a readable size and scrolls sideways inside this wrapper
    var scroller = document.createElement('div');
    scroller.className = 'ink-figure__scroll';
    var stage = document.createElement('div');
    stage.className = 'ink-figure__stage';
    scroller.appendChild(stage);
    host.appendChild(scroller);

    var api;
    try {
      api = figure.mount(stage, { reducedMotion: reduced, step: first });
    } catch (err) {
      host.removeAttribute('data-mounted');
      if (window.console) console.error('ink figure "' + key + '" failed to mount', err);
      return;
    }

    host.inkApi = api;      // so a question above the figure can replay its draw-in when it is unveiled
    if (steps.length > 1) {
      var bar = document.createElement('div');
      bar.className = 'ink-figure__steps';
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', 'Figure steps');
      var buttons = steps.map(function (item) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ink-figure__step';
        b.setAttribute('aria-pressed', item.step === first ? 'true' : 'false');
        var letter = document.createElement('b');
        letter.textContent = '(' + String.fromCharCode(97 + item.step) + ')';
        b.appendChild(letter);
        b.appendChild(document.createTextNode(item.label));
        b.addEventListener('click', function () {
          api.setStep(item.step);
          buttons.forEach(function (other) { other.setAttribute('aria-pressed', other === b ? 'true' : 'false'); });
        });
        bar.appendChild(b);
        return b;
      });
      host.appendChild(bar);
    }

    if (caption) {
      var cap = document.createElement('p');
      cap.className = 'ink-figure__caption';
      cap.textContent = caption;
      host.appendChild(cap);
    }
  }

  function mountFigures() {
    Array.prototype.forEach.call(document.querySelectorAll('.ink-figure[data-figure]'), function (host) {
      loadFigure(host.getAttribute('data-figure')).then(function () { mountFigure(host); }, function (err) {
        if (window.console) console.error(err);
      });
    });
  }

  /* ---------- questions: predict before you see ----------
     ::: {.ask data-veil="true"}
     The question, as a paragraph.

     - **A choice.** What the page says back if the reader picks it.
     - **Another choice.** Its reply.
     :::
     The list becomes buttons; picking one shows its reply. With data-veil, the figure that follows stays
     faint until the reader has committed to an answer (or asks to see it anyway): never a locked door. */
  function addAsks() {
    Array.prototype.forEach.call(document.querySelectorAll('.ask'), function (ask) {
      var list = ask.querySelector('ul');
      if (!list) return;
      var choices = document.createElement('div');
      choices.className = 'ask__choices';
      choices.setAttribute('role', 'group');
      choices.setAttribute('aria-label', 'Your answer');
      var reply = document.createElement('div');
      reply.className = 'ask__reply';
      reply.setAttribute('aria-live', 'polite');
      var buttons = [];
      Array.prototype.forEach.call(list.children, function (item) {
        var strong = item.querySelector('strong');
        if (!strong) return;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ask__choice';
        b.setAttribute('aria-pressed', 'false');
        b.textContent = strong.textContent.replace(/[.:]\s*$/, '');
        strong.parentNode.removeChild(strong);
        var answer = document.createElement('div');
        answer.className = 'ask__answer';
        answer.hidden = true;
        while (item.firstChild) answer.appendChild(item.firstChild);
        reply.appendChild(answer);
        b.addEventListener('click', function () {
          buttons.forEach(function (other) { other.setAttribute('aria-pressed', other === b ? 'true' : 'false'); });
          Array.prototype.forEach.call(reply.children, function (a) { a.hidden = a !== answer; });
          ask.setAttribute('data-answered', 'true');
          unveil();
        });
        buttons.push(b);
        choices.appendChild(b);
      });
      list.parentNode.replaceChild(choices, list);
      ask.appendChild(reply);

      var figure = null;
      function unveil() {
        if (!figure || !figure.classList.contains('is-veiled')) return;
        figure.classList.remove('is-veiled');
        var skip = figure.querySelector('.ink-figure__unveil');
        if (skip) skip.parentNode.removeChild(skip);
        if (figure.inkApi && figure.inkApi.replay) figure.inkApi.replay();
      }
      if (ask.getAttribute('data-veil')) {
        figure = ask.nextElementSibling;
        while (figure && !figure.classList.contains('ink-figure')) figure = figure.nextElementSibling;
        if (figure) {
          figure.classList.add('is-veiled');
          var skip = document.createElement('button');
          skip.type = 'button';
          skip.className = 'ink-figure__unveil';
          skip.textContent = 'Answer above, or show it anyway';
          skip.addEventListener('click', unveil);
          figure.insertBefore(skip, figure.firstChild);
        }
      }
    });
  }

  /* ---------- seams ---------- */
  function sew(seam) {
    var total = Math.max(1, Math.ceil(seam.offsetWidth / STITCH));
    if (reduced) { seam.setAttribute('data-sewn', 'true'); return; }
    var start = null;
    function frame(now) {
      if (start === null) start = now;
      var done = Math.min(total, Math.floor((now - start) / STITCH_MS) + 1);
      // show whole stitches only
      seam.style.clipPath = 'inset(0 ' + Math.max(0, seam.offsetWidth - done * STITCH) + 'px 0 0)';
      if (done < total) requestAnimationFrame(frame);
      else { seam.style.clipPath = ''; seam.setAttribute('data-sewn', 'true'); }
    }
    requestAnimationFrame(frame);
  }

  function addSeams() {
    var heads = document.querySelectorAll('.sheet section.level2 > h2');
    if (!heads.length) return;
    var watch = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        watch.unobserve(entry.target);
        sew(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' }) : null;

    Array.prototype.forEach.call(heads, function (h2) {
      var seam = document.createElement('span');
      seam.className = 'ink-seam';
      seam.setAttribute('aria-hidden', 'true');
      seam.setAttribute('data-sewn', watch ? 'false' : 'true');
      h2.parentNode.insertBefore(seam, h2);
      if (watch) watch.observe(seam);
    });
  }

  /* ---------- ruler ---------- */
  function addRuler() {
    var ruler = document.createElement('div');
    ruler.className = 'ink-ruler';
    ruler.setAttribute('aria-hidden', 'true');
    var ticks = document.createElement('div');
    ticks.className = 'ink-ruler__ticks';
    var mark = document.createElement('div');
    mark.className = 'ink-ruler__mark';
    ruler.appendChild(ticks);
    ruler.appendChild(mark);
    document.body.appendChild(ruler);

    var queued = false;
    function update() {
      queued = false;
      var doc = document.documentElement;
      var range = doc.scrollHeight - window.innerHeight;
      var t = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0;
      mark.style.top = (t * 100).toFixed(2) + '%';
      mark.textContent = t.toFixed(2);
    }
    function queue() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    update();
  }

  /* ---------- the shell: contents, bar, theme ---------- */
  function setText(name, text) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-ink="' + name + '"]'), function (n) { n.textContent = text; });
  }
  function setLink(name, link) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-ink="' + name + '"]'), function (n) {
      if (link) { n.setAttribute('href', link.getAttribute('href')); n.removeAttribute('aria-disabled'); }
      else { n.setAttribute('aria-disabled', 'true'); n.setAttribute('tabindex', '-1'); }
    });
  }
  function addShell() {
    var toc = document.getElementById('contents');
    if (!toc) return;
    var here = (location.pathname.split('/').pop() || 'index.html');
    var links = Array.prototype.slice.call(toc.querySelectorAll('.toc__part a'));
    var at = -1;
    links.forEach(function (a, i) { if (a.getAttribute('href') === here) at = i; });

    if (at >= 0) {
      var link = links[at], part = link.closest('.toc__part');
      var label = part.querySelector('.toc__label').textContent;
      var number = Array.prototype.indexOf.call(part.parentNode.children, part) + 1;
      var lesson = Array.prototype.indexOf.call(part.querySelectorAll('a'), link) + 1;
      link.setAttribute('aria-current', 'page');
      setText('part', label);
      setText('here', link.textContent);
      // chapter.lesson, as in 3.2: the second lesson of the third chapter
      setText('eyebrow', number + '.' + lesson + ' \u00b7 ' + label);
    }
    var prev = at > 0 ? links[at - 1] : null;
    var next = at < links.length - 1 ? links[at + 1] : null;     // from the home page (at = -1) this is the first chapter
    setLink('prev', prev);
    setLink('next', next);
    var foot = document.querySelector('[data-ink="next-link"]');
    if (foot) {
      if (next) { foot.setAttribute('href', next.getAttribute('href')); foot.querySelector('b').textContent = next.textContent; }
      else foot.hidden = true;
    }

    var themeBtn = document.querySelector('.bar__theme');
    if (themeBtn) {
      var root = document.documentElement;
      themeBtn.setAttribute('aria-pressed', root.getAttribute('data-theme') === 'dark' ? 'true' : 'false');
      themeBtn.addEventListener('click', function () {
        var dark = root.getAttribute('data-theme') !== 'dark';
        root.setAttribute('data-theme', dark ? 'dark' : 'light');
        themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
        try { localStorage.setItem('ink-theme', dark ? 'dark' : 'light'); } catch (err) {}
      });
    }

    // on a narrow screen the contents are a drawer opened from the bar
    var menu = document.querySelector('.bar__menu');
    if (menu) {
      var open = function (yes) {
        toc.setAttribute('data-open', yes ? 'true' : 'false');
        menu.setAttribute('aria-expanded', yes ? 'true' : 'false');
      };
      menu.addEventListener('click', function (e) { e.stopPropagation(); open(toc.getAttribute('data-open') !== 'true'); });
      document.addEventListener('click', function (e) { if (!toc.contains(e.target)) open(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') open(false); });
    }
  }

  function start() {
    addShell();
    addAsks();
    mountFigures();
    addSeams();
    addRuler();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
