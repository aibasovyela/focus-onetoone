"""Проверка приветствия и тура: PIN=… python3 scripts/tour_check.py [m844 m664 d1280 d1440 d1920].
Стенд: FOCUS_DB_DIR=<копия db с учеником «Расул»> PORT=3010 node backend/server.js"""
import os, sys, json
from playwright.sync_api import sync_playwright
B=os.environ.get('BASE', 'http://127.0.0.1:3010/')
PIN=os.environ['PIN']  # ученик с именем «Расул» на тестовом стенде
SHOTS=os.environ.get('SHOTS','/tmp/tour-check')
os.makedirs(SHOTS, exist_ok=True)
res=[]
def ok(n,c,x=''):
    res.append(bool(c)); print(('PASS' if c else 'FAIL'), n, x)
VP={'m844':dict(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, device_scale_factor=2),
    'm664':dict(viewport={'width':390,'height':664}, is_mobile=True, has_touch=True, device_scale_factor=2),
    'd1280':dict(viewport={'width':1280,'height':800}),
    'd1440':dict(viewport={'width':1440,'height':900}),
    'd1920':dict(viewport={'width':1920,'height':1080})}
sel=sys.argv[1:] or list(VP)
with sync_playwright() as p:
    b=p.chromium.launch()
    for name in sel:
        ctx=b.new_context(**VP[name]); ctx.add_init_script("localStorage.setItem('focus.tour.test','1')")
        pg=ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        pg.goto(B); pg.fill('#pinInput',PIN); pg.press('#pinInput','Enter')
        pg.wait_for_selector('.welcome.is-open .welcome-card', timeout=8000); pg.wait_for_timeout(450)
        ok(f'{name}: welcome by name', 'Расул, добро пожаловать' in pg.inner_text('.welcome-title'))
        wr=pg.evaluate("(() => { const r=document.querySelector('.welcome-card').getBoundingClientRect(); return [r.left,r.top,r.right,r.bottom,innerWidth,innerHeight] })()")
        ok(f'{name}: welcome in viewport', wr[0]>=0 and wr[1]>=0 and wr[2]<=wr[4] and wr[3]<=wr[5], str([round(x) for x in wr]))
        pg.screenshot(path=f'{SHOTS}/{name}-0-welcome.png')
        pg.click('.welcome-go')
        pg.wait_for_selector('.tour.is-open .tour-card')
        total=None; k=0
        while True:
            pg.wait_for_function("document.querySelector('.tour') && !document.querySelector('.tour').classList.contains('is-moving') && /Шаг/.test(document.querySelector('.tour-step').textContent)")
            pg.wait_for_timeout(380)
            info=pg.evaluate("""(() => { const t=document.querySelector('.tour'); const c=document.querySelector('.tour-card').getBoundingClientRect(); const h=document.querySelector('.tour-hole').getBoundingClientRect();
              return {step:document.querySelector('.tour-step').textContent, title:document.querySelector('.tour-title').textContent, noTarget:t.classList.contains('no-target'),
                card:[c.left,c.top,c.right,c.bottom], hole:[h.left,h.top,h.width,h.height], vw:innerWidth, vh:innerHeight,
                overlap: !(c.right<=h.left||c.left>=h.left+h.width||c.bottom<=h.top||c.top>=h.top+h.height), hs: document.documentElement.scrollWidth-innerWidth} })()""")
            k+=1
            c=info['card']
            inside=c[0]>=0 and c[1]>=0 and c[2]<=info['vw']+0.5 and c[3]<=info['vh']+0.5
            ok(f"{name}: {info['step']} «{info['title']}» target", not info['noTarget'] and info['hole'][2]>10 and info['hole'][3]>10, str([round(x) for x in info['hole']]))
            ok(f"{name}: {info['step']} card in viewport", inside, f"card={[round(x) for x in c]} overlap={info['overlap']}")
            if k in (1, 3, 6, 7): pg.screenshot(path=f'{SHOTS}/{name}-{k}.png')
            m=info['step'].split(); total=int(m[-1])
            if k>=total: break
            pg.click('.tour-next')
        ok(f'{name}: {total} steps (5–8)', 5<=total<=8, str(total))
        pg.click('.tour-next'); pg.wait_for_timeout(700)
        ok(f'{name}: tour closed', not pg.is_visible('.tour-card'))
        ok(f'{name}: deck progress restored', pg.evaluate("localStorage.getItem('focus.deck.module-1')") is None)
        ok(f'{name}: deck closed after tour', not pg.is_visible('.deck'))
        pg.reload(); pg.wait_for_timeout(1500)
        ok(f'{name}: not shown again', not pg.is_visible('.welcome') and not pg.is_visible('.tour-card'))
        btn='#sideNav .side-help' if name.startswith('d') else '.header-help'
        pg.click(btn); pg.wait_for_selector('.tour.is-open .tour-card'); pg.wait_for_function("!document.querySelector('.tour').classList.contains('is-moving') && /Шаг 1 /.test(document.querySelector('.tour-step').textContent)", timeout=8000)
        ok(f'{name}: «Как пользоваться» starts tour', 'Шаг 1 ' in pg.text_content('.tour-step'))
        pg.keyboard.press('ArrowRight'); pg.wait_for_function("!document.querySelector('.tour').classList.contains('is-moving') && /Шаг 2 /.test(document.querySelector('.tour-step').textContent)", timeout=8000)
        ok(f'{name}: arrow → step 2', 'Шаг 2 ' in pg.text_content('.tour-step'))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(600)
        ok(f'{name}: Esc closes', not pg.is_visible('.tour-card'))
        if name.startswith('m'):
            pg.click(btn); pg.wait_for_selector('.tour.is-open .tour-card'); pg.wait_for_function("!document.querySelector('.tour').classList.contains('is-moving') && /Шаг 1 /.test(document.querySelector('.tour-step').textContent)", timeout=8000)
            cdp=ctx.new_cdp_session(pg)
            box=pg.locator('.tour-card').bounding_box(); x=box['x']+box['width']/2; y=box['y']+40
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
            for i in range(1,9): cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y+i*14}]})
            cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]}); pg.wait_for_timeout(700)
            ok(f'{name}: swipe down closes', not pg.is_visible('.tour-card'))
        ok(f'{name}: no page errors', not errs, str(errs[:3]))
        ctx.close()
    b.close()
print('TOTAL', sum(res), '/', len(res))
