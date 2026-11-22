/* Py — Python you can run on the page, on a ruled sheet. Plain script, no build step.
   A cell is written in a .qmd as

     ::: {.py-cell data-draw="py-kmeans"}
     ```python
     def dist2(p, q):
         return across * across + ____          # one blank for the reader
     ```
     ::: {.py-solution}
     ```python
     def dist2(p, q):
         return across * across + up * up
     ```
     :::
     :::

   The first block is what the reader starts from; the optional .py-solution is "one way to do it".
   All cells on a page share one Python (Pyodide, loaded from a CDN the first time a cell is run), so a
   later cell can use what an earlier one defined; running a cell first runs the ones above it.

   What "running" looks like: Python really traces the cell (sys.settrace), and the page plays that trace
   back. A marker walks the lines in the order they ran, the margin keeps a tally of how many times each
   line ran, and each printed line is written in at the moment its print() is reached. Then the figure
   (data-draw) redraws from what the code left behind: for data-draw="py-plot" a dict called `picture`
   or a list of them called `frames` (see ink/figures/py-plot.js).

   `from page import points` gives the code whatever the page's figures offer through window.InkPage.
   data-needs="numpy" loads a package first. data-aside marks a detour later cells do not depend on. */
(function () {
  'use strict';

  var PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BASE = ((document.currentScript && document.currentScript.src) || 'ink/py.js').replace(/py\.js(\?.*)?$/, '');
  var BLANK = '____';       // a cell may leave one of these for the reader to replace
  var cells = [], python = null, loadedPackages = {};

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function script(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = function () { reject(new Error('could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  function startPython() {
    if (!python) {
      python = script(PYODIDE + 'pyodide.js').then(function () {
        return window.loadPyodide({ indexURL: PYODIDE });
      }).then(function (py) { py.runPython(SETUP); return py; });
    }
    return python;
  }

  /* ---------- the Python side: run a cell, record what happened ---------- */
  var SETUP = [
    'import sys as _sys, types as _types, json as _json, traceback as _traceback',
    '',
    'def _ink_state():',
    '    out = {}',
    '    for name in ("points", "flags", "labels", "history", "picture", "frames"):',
    '        if name in globals():',
    '            try:',
    '                out[name] = _json.loads(_json.dumps(globals()[name], default=lambda v: v.tolist() if hasattr(v, "tolist") else list(v)))',
    '            except Exception:',
    '                pass',
    '    return _json.dumps(out)',
    '',
    'def _ink_page(text):',
    '    page = _types.ModuleType("page")',
    '    for k, v in _json.loads(text).items():',
    '        if isinstance(v, list): v = [tuple(x) if isinstance(x, list) else x for x in v]',
    '        setattr(page, k, v)',
    '    _sys.modules["page"] = page',
    '',
    'class _InkOut:',
    '    def __init__(self, trace): self.trace, self.parts = trace, []',
    '    def write(self, s):',
    '        if s: self.parts.append([len(self.trace), s])',
    '        return len(s)',
    '    def flush(self): pass',
    '',
    'def _ink_run(src, name, follow):',
    '    """Run one cell. Returns JSON: the lines in the order they ran, how often each ran,',
    '    what was printed and when, and the error if it stopped."""',
    '    trace, counts = [], {}',
    '    out = _InkOut(trace)',
    '    def tracer(frame, event, arg):',
    '        if frame.f_code.co_filename != name: return None',
    '        if event == "line":',
    '            n = frame.f_lineno',
    '            counts[n] = counts.get(n, 0) + 1',
    '            if len(trace) < 4000: trace.append(n)',
    '        return tracer',
    '    if follow:',
    '        # the picture belongs to the cell being run: forget what an earlier cell drew',
    '        globals().pop("frames", None)   # a later cell may add to the picture, but old frames must not replay',
    '    error = None',
    '    old = _sys.stdout',
    '    _sys.stdout = out',
    '    try:',
    '        code = compile(src, name, "exec")',
    '        if follow: _sys.settrace(tracer)',
    '        try:',
    '            exec(code, globals())',
    '        finally:',
    '            _sys.settrace(None)',
    '    except BaseException as e:',
    '        line = getattr(e, "lineno", None) if isinstance(e, SyntaxError) else None',
    '        tb = e.__traceback__',
    '        while tb is not None:',
    '            if tb.tb_frame.f_code.co_filename == name: line = tb.tb_lineno',
    '            tb = tb.tb_next',
    '        error = {"kind": type(e).__name__, "message": str(e), "line": line}',
    '    finally:',
    '        _sys.stdout = old',
    '    return _json.dumps({"trace": trace, "counts": counts, "out": out.parts, "error": error})'
  ].join('\n');

  /* ---------- ink-toned Python: a small tokenizer, enough for teaching code ---------- */
  var KEYWORDS = /^(def|return|for|in|if|else|elif|while|import|from|as|and|or|not|True|False|None|break|continue|class|pass|with|try|except|finally|lambda|is)$/;
  var BUILTINS = /^(print|len|range|sum|min|max|round|zip|sorted|abs|list|tuple|int|float|str|enumerate)$/;
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function paintCode(src) {
    var out = '', re = /(#[^\n]*)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(____+)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([\s\S])/g, m, afterDef = false;
    while ((m = re.exec(src))) {
      if (m[1]) out += '<span class="tk-c">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="tk-s">' + esc(m[2]) + '</span>';
      else if (m[3]) out += '<span class="tk-blank">' + m[3] + '</span>';
      else if (m[4]) out += '<span class="tk-n">' + m[4] + '</span>';
      else if (m[5]) {
        if (afterDef) { out += '<span class="tk-f">' + m[5] + '</span>'; afterDef = false; }
        else if (KEYWORDS.test(m[5])) { out += '<span class="tk-k">' + m[5] + '</span>'; afterDef = m[5] === 'def'; }
        else if (BUILTINS.test(m[5])) out += '<span class="tk-b">' + m[5] + '</span>';
        else out += m[5];
      } else out += esc(m[6]);
    }
    return out + '\n';        // a trailing newline keeps the last line's height when it is empty
  }

  /* ---------- an error, said plainly ---------- */
  function explain(err) {
    var at = err.line ? 'Line ' + err.line : 'This cell', m;
    if (err.kind === 'ZeroDivisionError') return at + ' tried to divide by zero.';
    if (err.kind === 'NameError' && (m = /name '([^']+)'/.exec(err.message))) {
      return at + ' uses the name ' + m[1] + ', which Python has not been told about. Check the spelling, or define it first.';
    }
    if (err.kind === 'IndentationError') return at + ' is indented differently from the lines around it.';
    if (err.kind === 'SyntaxError') return 'Python could not read ' + at.toLowerCase() + '. Look for a missing bracket, colon or quote.';
    if (err.kind === 'TypeError' && /NoneType/.test(err.message)) return at + ' got nothing back where it expected a value. Does the function above end with return?';
    if (err.kind === 'AssertionError') return at + ' is a check, and the check failed' + (err.message ? ': ' + err.message + '.' : '.');
    if (err.kind === 'IndexError') return at + ' asked for an item that is not in the list.';
    if (err.kind === 'KeyError') return at + ' looked up something that is not there.';
    return at + ' stopped.';
  }

  /* ---------- one cell ---------- */
  function build(host, index, count) {
    var pres = host.querySelectorAll('pre');
    var solutionBox = host.querySelector('.py-solution');
    var start = pres[0] ? pres[0].textContent.replace(/\n$/, '') : '';
    var solution = solutionBox && solutionBox.querySelector('pre') ? solutionBox.querySelector('pre').textContent.replace(/\n$/, '') : null;
    var drawKey = host.getAttribute('data-draw');
    host.textContent = '';

    var head = el('div', 'py-cell__head');
    head.appendChild(el('span', 'py-cell__lang', 'Python'));
    head.appendChild(el('span', 'py-cell__count', (index + 1) + ' / ' + count));
    var status = el('span', 'py-cell__status');
    status.setAttribute('aria-live', 'polite');
    head.appendChild(status);

    var sheet = el('div', 'py-cell__sheet');
    var gutter = el('div', 'py-gutter');
    gutter.setAttribute('aria-hidden', 'true');
    var scroll = el('div', 'py-editor__scroll');
    var stack = el('div', 'py-editor__stack');
    var bar = el('div', 'py-editor__bar');            // the marker that walks the lines as they run
    var paint = el('pre', 'py-editor__paint');
    paint.setAttribute('aria-hidden', 'true');
    var area = el('textarea', 'py-editor__input');
    area.value = start;
    area.spellcheck = false;
    area.setAttribute('wrap', 'off');
    area.setAttribute('autocapitalize', 'off'); area.setAttribute('autocomplete', 'off'); area.setAttribute('autocorrect', 'off');
    area.setAttribute('aria-label', 'Python code, cell ' + (index + 1) + ' of ' + count);
    stack.appendChild(bar); stack.appendChild(paint); stack.appendChild(area);
    scroll.appendChild(stack);
    sheet.appendChild(gutter); sheet.appendChild(scroll);

    var sewing = el('div', 'py-cell__sewing');         // stitches while Python starts
    sewing.hidden = true;

    var controls = el('div', 'py-cell__bar');
    var runBtn = el('button', 'py-cell__run');
    runBtn.type = 'button';
    runBtn.appendChild(el('span', 'py-cell__play'));
    runBtn.appendChild(document.createTextNode('Run'));
    controls.appendChild(runBtn);
    if (solution != null) {
      var showBtn = el('button', 'py-cell__show', 'Show one way');
      showBtn.type = 'button';
      showBtn.addEventListener('click', function () { area.value = solution; refresh(); area.focus(); });
      controls.appendChild(showBtn);
    }
    var resetBtn = el('button', 'py-cell__show', 'Start again');
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', function () { area.value = start; refresh(); });
    controls.appendChild(resetBtn);
    controls.appendChild(el('span', 'py-cell__hint', /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘ ↵ runs it' : 'Ctrl ↵ runs it'));

    var result = el('div', 'py-cell__result');
    result.setAttribute('aria-live', 'polite');
    result.hidden = true;

    host.appendChild(head); host.appendChild(sheet); host.appendChild(sewing); host.appendChild(controls); host.appendChild(result);
    var stage = null;
    if (drawKey) { stage = el('div', 'py-cell__stage'); host.appendChild(stage); }

    var cell = { code: solution != null ? solution : start, host: host, area: area, status: status, runBtn: runBtn, stage: stage, drawKey: drawKey, svg: null,
      gutter: gutter, bar: bar, paint: paint, result: result, sewing: sewing, rows: [], playing: null,
      start: start, solution: solution, aside: host.hasAttribute('data-aside'),
      needs: (host.getAttribute('data-needs') || '').split(/[\s,]+/).filter(Boolean) };

    function refresh() {
      paint.innerHTML = paintCode(area.value);
      var n = area.value.split('\n').length;
      while (cell.rows.length < n) {
        var row = el('div', 'py-gutter__row');
        row.appendChild(el('span', 'py-gutter__tally'));
        row.appendChild(el('span', 'py-gutter__n', String(cell.rows.length + 1)));
        gutter.appendChild(row); cell.rows.push(row);
      }
      while (cell.rows.length > n) gutter.removeChild(cell.rows.pop());
      clearMarks(cell);
    }
    cell.refresh = refresh;
    area.addEventListener('input', refresh);
    area.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        var a = area.selectionStart, b = area.selectionEnd;
        area.value = area.value.slice(0, a) + '    ' + area.value.slice(b);
        area.selectionStart = area.selectionEnd = a + 4;
        refresh();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(cell); }
    });
    runBtn.addEventListener('click', function () { run(cell); });
    refresh();
    return cell;
  }

  function clearMarks(cell) {
    if (cell.playing) { cell.playing(); cell.playing = null; }
    cell.bar.className = 'py-editor__bar';
    cell.rows.forEach(function (row) { row.className = 'py-gutter__row'; row.firstChild.textContent = ''; });
  }
  function lineHeight(cell) { return parseFloat(getComputedStyle(cell.paint).lineHeight) || 21; }
  function moveBar(cell, line, kind) {
    cell.bar.className = 'py-editor__bar is-on' + (kind ? ' is-' + kind : '');
    cell.bar.style.transform = 'translateY(' + ((line - 1) * lineHeight(cell)) + 'px)';
  }
  function tally(n) { return n > 1 ? n + '×' : ''; }

  /* what a cell's code will draw, read from the code itself, so the empty picture can be sketched ahead */
  function sketchHint(code) {
    code = code || '';
    var has = ['points', 'labels', 'lines', 'accent', 'stars', 'segments', 'bars', 'hlines', 'vlines'].filter(function (key) {
      return new RegExp('["\']' + key + '["\']').test(code);
    });
    if (/\bframes\b/.test(code)) has.push('frames');
    function named(key) { var m = new RegExp('["\']' + key + '["\']\\s*:\\s*["\']([^"\']{1,40})["\']').exec(code); return m ? m[1] : ''; }
    return { has: has.length ? has : null, xlabel: named('xlabel'), ylabel: named('ylabel') };
  }

  function figureFor(cell) {
    if (!cell.drawKey || cell.svg) return Promise.resolve();
    var ready = (window.ShowcaseFigures && window.ShowcaseFigures[cell.drawKey]) ? Promise.resolve() : script(BASE + 'figures/' + cell.drawKey + '.js');
    return ready.then(function () {
      window.ShowcaseFigures[cell.drawKey].mount(cell.stage, { reducedMotion: reduced, step: 0 });
      cell.svg = cell.stage.querySelector('svg');
      if (cell.svg && cell.svg.inkShell) cell.svg.inkShell(sketchHint(cell.code));
    });
  }

  /* ---------- the result: output written in, or an error said plainly ---------- */
  function addOutput(cell, text) {
    if (cell.result.hidden) {
      cell.result.hidden = false;
      cell.result.appendChild(el('p', 'py-cell__label', 'Output'));
      cell.outPre = el('pre', 'py-cell__out');
      cell.result.appendChild(cell.outPre);
    }
    // print() arrives in pieces ("a", " ", "b", "\n"); each finished line is one written line
    cell.pending = (cell.pending || '') + text;
    var lines = cell.pending.split('\n');
    cell.pending = lines.pop();
    lines.forEach(function (line) { cell.outPre.appendChild(el('span', 'py-cell__line', line + '\n')); });
  }
  function flushOutput(cell) {
    if (cell.pending) { cell.outPre.appendChild(el('span', 'py-cell__line', cell.pending + '\n')); cell.pending = ''; }
  }
  function showError(cell, err) {
    cell.result.hidden = false;
    var box = el('div', 'py-cell__error');
    box.appendChild(el('p', 'py-cell__label', 'It stopped'));
    box.appendChild(el('p', 'py-cell__plain', explain(err)));
    box.appendChild(el('p', 'py-cell__raw', err.kind + (err.message ? ': ' + err.message : '')));
    cell.result.appendChild(box);
    if (err.line && cell.rows[err.line - 1]) {
      cell.rows[err.line - 1].className = 'py-gutter__row is-error';
      moveBar(cell, err.line, 'error');
    }
  }

  /* ---------- playing the trace back ---------- */
  function play(cell, res, done) {
    var trace = res.trace, out = res.out.slice(), counts = res.counts, seen = {};
    function emitUpTo(i) { while (out.length && out[0][0] <= i) addOutput(cell, out.shift()[1]); }
    function finish() {
      cell.playing = null;
      emitUpTo(Infinity); flushOutput(cell);
      Object.keys(counts).forEach(function (line) {
        var row = cell.rows[line - 1];
        if (row) { row.classList.add('is-ran'); row.firstChild.textContent = tally(counts[line]); }
      });
      cell.bar.className = 'py-editor__bar';
      done();
    }
    if (reduced || !trace.length) { finish(); return; }

    // a short run is shown step by step; a long one starts step by step, then skips ahead
    var steps = [], i;
    if (trace.length <= 56) for (i = 0; i < trace.length; i++) steps.push(i);
    else {
      for (i = 0; i < 28; i++) steps.push(i);
      for (i = 1; i <= 34; i++) steps.push(Math.min(trace.length - 1, 28 + Math.round((trace.length - 29) * i / 34)));
    }
    var at = 0, timer = null, stopped = false;
    cell.playing = function () { stopped = true; clearTimeout(timer); };
    (function next() {
      if (stopped) return;
      if (at >= steps.length) { finish(); return; }
      var idx = steps[at], line = trace[idx];
      // count every line passed since the last step, so the tallies stay honest while skipping
      for (var j = at ? steps[at - 1] + 1 : 0; j <= idx; j++) seen[trace[j]] = (seen[trace[j]] || 0) + 1;
      var row = cell.rows[line - 1];
      if (row) { row.classList.add('is-ran'); row.firstChild.textContent = tally(seen[line]); }
      moveBar(cell, line);
      emitUpTo(idx);
      at++;
      timer = setTimeout(next, at <= 28 ? (trace.length <= 20 ? 150 : 85) : 32);
    })();
  }

  function exec(py, cell, code, follow) {
    var load = Promise.resolve();
    cell.needs.forEach(function (name) {
      if (!loadedPackages[name]) { loadedPackages[name] = true; load = load.then(function () { return py.loadPackage(name); }); }
    });
    return load.then(function () {
      return JSON.parse(py.globals.get('_ink_run')(code, '<cell-' + (cells.indexOf(cell) + 1) + '>', !!follow));
    });
  }

  function run(cell) {
    var i = cells.indexOf(cell);
    if (cell.area.value.indexOf(BLANK) >= 0) {
      cell.status.textContent = 'Replace the blank first, or press Show one way';
      cell.area.focus();
      var at = cell.area.value.indexOf(BLANK);
      cell.area.setSelectionRange(at, at + BLANK.length);
      return;
    }
    cells.forEach(function (c) { c.runBtn.disabled = true; });
    clearMarks(cell);
    cell.result.hidden = true; cell.result.textContent = ''; cell.pending = '';
    cell.host.classList.add('is-running');
    cell.status.textContent = python ? 'running' : 'starting Python, a few seconds, once';
    cell.sewing.hidden = false;

    function unlock() {
      cell.host.classList.remove('is-running');
      cell.sewing.hidden = true;
      cells.forEach(function (c) { c.runBtn.disabled = false; });
    }

    startPython().then(function (py) {
      var shared = {};
      Object.keys(window.InkPage || {}).forEach(function (name) { shared[name] = window.InkPage[name](); });
      py.globals.get('_ink_page')(JSON.stringify(shared));

      // The cells above always run again first: they are small, and what they import from the page
      // (the flags the reader placed by hand) may have changed since. A cell above that is untouched,
      // or still has its blank, runs in its worked version.
      var chain = Promise.resolve(null);
      cells.slice(0, i).forEach(function (c) {
        if (c.aside) return;
        chain = chain.then(function (broken) {
          if (broken) return broken;
          var unfinished = c.solution != null && (c.area.value === c.start || c.area.value.indexOf(BLANK) >= 0);
          return exec(py, c, unfinished ? c.solution : c.area.value, false).then(function (r) {
            return r.error ? { cell: c, error: r.error } : null;
          });
        });
      });
      return chain.then(function (broken) {
        if (broken) {
          cell.sewing.hidden = true;
          cell.status.textContent = 'a cell above stopped';
          showError(cell, { kind: broken.error.kind, message: broken.error.message + ' (in cell ' + (cells.indexOf(broken.cell) + 1) + ', above)', line: null });
          unlock();
          return null;
        }
        return exec(py, cell, cell.area.value, true).then(function (res) {
          cell.sewing.hidden = true;
          cell.status.textContent = 'running';
          play(cell, res, function () {
            if (res.error) { cell.status.textContent = 'stopped'; showError(cell, res.error); unlock(); return; }
            var ran = Object.keys(res.counts).length;
            cell.status.textContent = 'ran ' + ran + (ran === 1 ? ' line' : ' lines');
            cell.host.setAttribute('data-ran', 'true');
            unlock();
            figureFor(cell).then(function () {
              if (cell.svg && cell.svg.inkUpdate) cell.svg.inkUpdate(JSON.parse(py.runPython('_ink_state()')));
            });
          });
        });
      });
    }).catch(function (err) {
      cell.status.textContent = 'Python could not start: ' + (err && err.message ? err.message : err);
      unlock();
    });
  }

  function start() {
    var hosts = document.querySelectorAll('.py-cell');
    Array.prototype.forEach.call(hosts, function (host, i) { cells.push(build(host, i, hosts.length)); });
    cells.forEach(function (c) { if (c.drawKey) figureFor(c).catch(function (err) { if (window.console) console.error(err); }); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
