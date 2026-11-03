"""Автопроверка урока-слайдов: все слайды на телефоне и десктопе.
PIN=… python3 scripts/deck_check.py [mobile|safari|se|android|desktop|all] [--shots]  → отчёт в stdout, скрины в $OUT/<mode>/NN.png
"""
import json, os, sys, time
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:3010/')
PIN = os.environ['PIN']
OUT = os.environ.get('OUT', '/tmp/deck-check')
mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
SHOTS = '--shots' in sys.argv

CHECK = r"""() => {
  const el = document.querySelector('.slide.is-current');
  if (!el) return { err: 'no current slide' };
  const probs = [];
  // любой вертикально прокручиваемый блок внутри слайда = переполнение
  const nodes = [el, ...el.querySelectorAll('*')];
  for (const n of nodes) {
    if (n.closest('[hidden]') || n.closest('details:not([open]) > :not(summary)')) continue;
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const oy = cs.overflowY;
    if ((oy === 'auto' || oy === 'scroll' || n === el) && n.scrollHeight > n.clientHeight + 1) {
      probs.push(`vscroll ${n.className || n.tagName} ${n.scrollHeight}>${n.clientHeight}`);
    }
    const ox = cs.overflowX;
    if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1 && !n.closest('[data-noswipe]')) {
      probs.push(`hscroll ${n.className || n.tagName} ${n.scrollWidth}>${n.clientWidth}`);
    }
  }
  // обрезанные блоки с overflow hidden (чат, итог конструктора, промпт, карточки)
  for (const n of el.querySelectorAll('.chat-body, .b-out, .s-prompt pre, .flip-face, .tt, .cmp-pane, .q-explain')) {
    if (n.closest('[hidden]') || !n.offsetParent) continue;
    if (n.scrollHeight > n.clientHeight + 1) probs.push(`cut ${n.className} ${n.scrollHeight}>${n.clientHeight}`);
  }
  // контент вылез за слайд (overflow hidden)
  const r = el.getBoundingClientRect();
  for (const n of el.querySelectorAll('.s-inner > *, .cover-text, .s-inner')) {
    if (n.closest('[hidden]')) continue;
    const b = n.getBoundingClientRect();
    if (b.height && (b.bottom > r.bottom + 1 || b.right > r.right + 1)) probs.push(`clip ${n.className || n.tagName} bottom=${Math.round(b.bottom - r.bottom)} right=${Math.round(b.right - r.right)}`);
  }
  const de = document.documentElement;
  if (de.scrollWidth > innerWidth + 1) probs.push(`page hscroll ${de.scrollWidth}>${innerWidth}`);
  const imgs = [...el.querySelectorAll('img')].filter(i => !i.complete || !i.naturalWidth).map(i => i.src);
  if (imgs.length) probs.push('img not loaded: ' + imgs.join(','));
  if (el.querySelector('.is-missing')) probs.push('missing media');
  // мелкий текст в SVG: фактический размер шрифта на экране
  for (const svg of el.querySelectorAll('svg')) {
    if (!svg.closest('.s-fig')) continue;
    const vb = svg.viewBox.baseVal; if (!vb || !vb.width) continue;
    const scale = svg.getBoundingClientRect().width / vb.width;
    let min = 99;
    for (const t of svg.querySelectorAll('text')) { const fs = parseFloat(getComputedStyle(t).fontSize); if (fs) min = Math.min(min, fs * scale); }
    if (min < 10.5) probs.push(`svg small text ${min.toFixed(1)}px`);
  }
  const words = (el.innerText || '').split(/\s+/).filter(w => /[A-Za-zА-Яа-яЁё0-9]/.test(w)).length;
  return { type: el.className.match(/t-(\w+)/)?.[1], label: el.getAttribute('aria-label'), probs, words };
}"""


def run(p, name, ctxopts):
    os.makedirs(f'{OUT}/{name}', exist_ok=True)
    b = p.chromium.launch()
    ctx = b.new_context(**ctxopts)
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('requestfailed', lambda r: errors.append(f'reqfail: {r.url}'))
    page.on('response', lambda r: errors.append(f'http {r.status}: {r.url}') if r.status >= 400 else None)
    page.goto(BASE)
    page.fill('#pinInput', PIN)
    page.press('#pinInput', 'Enter')
    page.wait_for_selector('#dashboardScreen', state='visible')
    page.evaluate("localStorage.removeItem('focus.deck.module-1')")
    page.goto(BASE + '#module-1')
    page.wait_for_selector('.lesson-card')
    page.wait_for_timeout(500)
    if SHOTS:
        page.screenshot(path=f'{OUT}/{name}/00-module.png')
        page.screenshot(path=f'{OUT}/{name}/00-module-full.png', full_page=True)
    de = page.evaluate('document.documentElement.scrollWidth - innerWidth')
    report = {'module_hscroll': de, 'slides': [], 'errors': errors}
    page.click('.lesson-card')
    page.wait_for_selector('.slide.is-current')
    page.wait_for_timeout(400)
    total = page.evaluate("document.querySelector('.deck-count').textContent.split('/')[1].trim()")
    total = int(total)
    for i in range(total):
        page.wait_for_timeout(650)
        # дождаться картинок
        page.evaluate("""() => Promise.all([...document.querySelectorAll('.slide.is-current img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })))""")
        typ = page.evaluate("document.querySelector('.slide.is-current').className.match(/t-(\\w+)/)?.[1]")
        res = page.evaluate(CHECK)
        extra = []
        if typ == 'chat':
            page.wait_for_timeout(200)
            page.evaluate("document.querySelector('.slide.is-current')._onHide?.()")
            extra.append(('chat-all', page.evaluate(CHECK)))
        if typ == 'quiz':
            page.locator('.slide.is-current .q-opt').first.click()
            page.wait_for_timeout(250)
            extra.append(('answered', page.evaluate(CHECK)))
        if typ == 'compare':
            page.locator('.slide.is-current [data-tab="1"]').click()
            page.wait_for_timeout(250)
            extra.append(('good', page.evaluate(CHECK)))
        if typ == 'builder':
            page.locator('.slide.is-current [data-act="b-all"]').click()
            page.wait_for_timeout(300)
            extra.append(('built', page.evaluate(CHECK)))
        if typ == 'cards':
            for f in page.locator('.slide.is-current .flip').all():
                f.click()
            page.wait_for_timeout(500)
            extra.append(('flipped', page.evaluate(CHECK)))
        probs = list(res.get('probs', []))
        for tag, r in extra:
            probs += [f'[{tag}] {x}' for x in r.get('probs', [])]
        report['slides'].append({'i': i + 1, 'type': typ, 'words': res.get('words'), 'probs': probs})
        if SHOTS:
            page.screenshot(path=f'{OUT}/{name}/{i + 1:02d}.png')
        if i < total - 1:
            page.keyboard.press('ArrowRight')
    b.close()
    return report


with sync_playwright() as p:
    modes = {
        'mobile': dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2),
        'se': dict(viewport={'width': 375, 'height': 667}, is_mobile=True, has_touch=True, device_scale_factor=2),
        'safari': dict(viewport={'width': 390, 'height': 664}, is_mobile=True, has_touch=True, device_scale_factor=2),
        'android': dict(viewport={'width': 360, 'height': 780}, is_mobile=True, has_touch=True, device_scale_factor=3),
        'desktop': dict(viewport={'width': 1440, 'height': 900}, device_scale_factor=1),
    }
    sel = ['mobile', 'desktop'] if mode == 'all' else [mode]
    for m in sel:
        r = run(p, m, modes[m])
        bad = [s for s in r['slides'] if s['probs']]
        print(f'== {m}: {len(r["slides"])} slides, {len(bad)} with problems, module hscroll={r["module_hscroll"]}, errors={len(r["errors"])}')
        for s in bad:
            print(f'  #{s["i"]} {s["type"]} ({s["words"]}w): ' + ' | '.join(s['probs']))
        for e in r['errors'][:20]:
            print('  ERR', e)
        heavy = [f'#{s["i"]}:{s["words"]}' for s in r['slides'] if (s['words'] or 0) > 75]
        if heavy:
            print('  wordy(>75 incl. chrome):', ' '.join(heavy))
        json.dump(r, open(f'{OUT}/{m}.json', 'w'), ensure_ascii=False, indent=1)
