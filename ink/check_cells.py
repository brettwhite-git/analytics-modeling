#!/usr/bin/env python3
"""Check the Python cells of a lesson without a browser.

    python3 ink/check_cells.py lesson.qmd [--page page.json]

Runs the cells in page order, the way ink/py.js does: each cell in its worked version (the .py-solution
if there is one), sharing one namespace. A cell marked data-aside runs in a copy and may stop with an
error (that is how a lesson shows something breaking); any other error fails the check.
--page gives what `from page import ...` should provide: a JSON object, lists of pairs become tuples.
Also checks that a starting block with a blank (____) has a solution, that no solution has a blank, and
that a data-draw cell leaves a `picture` or `frames` that can be turned into JSON."""
import io, json, re, sys, types, contextlib, traceback

def cells(text):
    out = []
    for m in re.finditer(r'^::: *\{\.py-cell([^}]*)\}\n(.*?)(?=^:::\s*$\n(?!\s*```)|\Z)', text, re.S | re.M):
        attrs, body = m.group(1), m.group(2)
        blocks = re.findall(r'```python\n(.*?)```', body, re.S)
        if not blocks:
            continue
        has_solution = '.py-solution' in body and len(blocks) > 1
        out.append({'attrs': attrs, 'start': blocks[0], 'solution': blocks[1] if has_solution else None})
    return out

def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    page = {}
    if '--page' in args:
        i = args.index('--page')
        page = json.load(open(args[i + 1]))
        del args[i:i + 2]
    found = cells(open(args[0]).read())
    module = types.ModuleType('page')
    for k, v in page.items():
        if isinstance(v, list):
            v = [tuple(x) if isinstance(x, list) else x for x in v]
        setattr(module, k, v)
    sys.modules['page'] = module

    space, failed = {'__name__': '__main__'}, 0
    print(f'{len(found)} cells in {args[0]}')
    for n, c in enumerate(found, 1):
        aside = 'data-aside' in c['attrs']
        notes = []
        if '____' in c['start'] and c['solution'] is None:
            notes.append('FAIL: has a blank but no .py-solution'); failed += 1
        if c['solution'] is not None and '____' in c['solution']:
            notes.append('FAIL: the solution still has a blank'); failed += 1
        if c['start'].count('____') > 1:
            notes.append('note: more than one blank')
        code = c['solution'] if c['solution'] is not None else c['start']
        ns = dict(space) if aside else space
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                exec(compile(code, f'<cell-{n}>', 'exec'), ns)
            status = 'ok'
        except Exception as e:
            line = traceback.extract_tb(e.__traceback__)[-1].lineno
            if aside:
                status = f'aside stopped: {type(e).__name__} (fine if the lesson means it to)'
            else:
                status = f'FAIL: {type(e).__name__}: {e} (line {line})'; failed += 1
        if 'data-draw' in c['attrs'] and status == 'ok':
            if 'py-plot' in c['attrs'] and 'picture' not in ns and 'frames' not in ns:
                notes.append('FAIL: data-draw="py-plot" but the cell leaves no picture or frames'); failed += 1
            for name in ('picture', 'frames'):
                if name in ns:
                    try:
                        json.dumps(ns[name], default=lambda v: v.tolist() if hasattr(v, 'tolist') else list(v))
                    except Exception as e:
                        notes.append(f'FAIL: {name} cannot be turned into JSON: {e}'); failed += 1
        shown = buf.getvalue().strip().replace('\n', ' | ')
        print(f'  cell {n}{" (aside)" if aside else ""}: {status}' + (f'   -> {shown[:150]}' if shown else ''))
        for note in notes:
            print('      ' + note)
    print('FAILED' if failed else 'all cells ran')
    sys.exit(1 if failed else 0)

if __name__ == '__main__':
    main()
