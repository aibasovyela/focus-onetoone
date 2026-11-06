"""Проверка календаря созвонов на стенде (Playwright): ведущий ставит/переносит/удаляет, ученик видит план, .ics, статусы.
HOST_PIN=… STUDENT_PIN=… [STUDENT_ID=test] [BASE=http://127.0.0.1:3013/] [SHOTS=/tmp/calls-check] python3 scripts/calls_check.py [m390 d1440]
Портит созвоны ученика STUDENT_ID — только тестовый ученик на стенде, не прод. В конце ставит ему демо-план."""
import json, os, re, sys, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright

B = os.environ.get('BASE', 'http://127.0.0.1:3013/')
HOST_PIN, STUDENT_PIN = os.environ['HOST_PIN'], os.environ['STUDENT_PIN']
SID = os.environ.get('STUDENT_ID', 'test')
SHOTS = os.environ.get('SHOTS', '/tmp/calls-check')
os.makedirs(SHOTS, exist_ok=True)
ALMATY = timezone(timedelta(hours=5))
LOC = dict(locale='ru-RU', timezone_id='Asia/Almaty')
VP = {'m390': dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=3, **LOC),
      'd1440': dict(viewport={'width': 1440, 'height': 900}, **LOC)}
res = []


def ok(name, cond, extra=''):
    res.append(bool(cond))
    print('PASS' if cond else 'FAIL', name, extra)


def api(path, sid=None, data=None, method=None):
    h = {'Content-Type': 'application/json', **({'X-Session-Id': sid} if sid else {})}
    r = urllib.request.Request(B + path, data=json.dumps(data).encode() if data is not None else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            body = resp.read().decode()
            return resp.status, json.loads(body) if 'json' in resp.headers.get('content-type', '') else body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def login(pin):
    return api('api/auth/login', data={'pin': pin})[1]['sessionId']


def ymd(dt):
    return dt.strftime('%Y-%m-%d')


def ics_events(text):
    return [dict(re.findall(r'^([A-Z-]+(?:;[^:]+)?):(.*)$', ev, re.M)) for ev in text.split('BEGIN:VEVENT')[1:]]


now = datetime.now(ALMATY)
H = login(HOST_PIN)
S = login(STUDENT_PIN)
reset = lambda: api(f'api/calls/host/students/{SID}', H, {'calls': {str(n): None for n in range(1, 6)}}, 'PATCH')

# ---------- права ----------
body = {'calls': {'1': {'at': ymd(now + timedelta(days=3)) + ' 19:00'}}}
ok('API: запись без входа → 401', api(f'api/calls/host/students/{SID}', None, body, 'PATCH')[0] == 401)
ok('API: запись сессией ученика → 403', api(f'api/calls/host/students/{SID}', S, body, 'PATCH')[0] == 403)
ok('API: список учеников ученику → 403', api('api/calls/host/students', S)[0] == 403)
ok('API: ученик не видит ведущего', api('api/modules/me', S)[1].get('host') is False)
ok('API: битая дата → 400', api(f'api/calls/host/students/{SID}', H, {'calls': {'1': {'at': '2026-13-01 19:00'}}}, 'PATCH')[0] == 400)

sel = sys.argv[1:] or list(VP)
with sync_playwright() as p:
    b = p.chromium.launch()
    for vp in sel:
        reset()
        base_day = now + timedelta(days=2)
        # ---------- ведущий ----------
        ctx = b.new_context(**VP[vp], accept_downloads=True)
        ctx.add_init_script("['demo','rasul','test'].forEach(i => localStorage.setItem('focus.tour.' + i, 'done'))")
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(B)
        pg.fill('#pinInput', HOST_PIN)
        pg.press('#pinInput', 'Enter')
        pg.wait_for_selector('#modulesView .route-card')
        host_link = '#sideHost' if vp.startswith('d') else '.header a[href="#host"]'
        ok(f'{vp}: кнопка «Режим ведущего» видна', pg.is_visible(host_link))
        pg.click(host_link)
        pg.wait_for_selector(f'[data-host-student="{SID}"]')
        pg.click(f'[data-host-student="{SID}"]')
        pg.wait_for_selector('.h-row[data-call="1"] [data-host-edit]')
        pg.click('.h-row[data-call="1"] [data-host-edit]')
        pg.wait_for_selector('#callSheet.open')
        pg.fill('#csDate', ymd(base_day))
        pg.fill('#csTime', '19:00')
        pg.click('#csDur [data-dur="120"]')
        pg.fill('#csTopic', 'Знакомство и база ИИ')
        pg.fill('#csMeet', 'https://meet.google.com/abc-defg-hij')
        pg.check('#csWeeklyOn')
        pg.select_option('#csWeeklyCount', '3')
        pg.wait_for_timeout(200)
        ok(f'{vp}: превью «каждую неделю» — 3 созвона', pg.locator('#csWeeklyPreview li').count() == 3)
        pg.screenshot(path=f'{SHOTS}/{vp}-host-sheet.png')
        pg.click('#csSave')
        pg.wait_for_selector('#callSheet:not(.open)', state='attached')
        pg.wait_for_timeout(400)
        st = next(s for s in api('api/calls/host/students', H)[1]['students'] if s['id'] == SID)
        want = {str(i + 1): f'{ymd(base_day + timedelta(days=7 * i))} 19:00' for i in range(4)}
        got = {n: (c or {}).get('at') for n, c in st['calls'].items()}
        ok(f'{vp}: 4 созвона раз в неделю', all(got[n] == want[n] for n in want) and got['5'] is None, json.dumps(got))
        ok(f'{vp}: Meet и длительность скопированы', all(st['calls'][n]['meet'] and st['calls'][n]['dur'] == 120 for n in want))
        ok(f'{vp}: в списке 4 назначено, 1 нет', pg.locator('.h-row:not(.is-none)').count() == 4 and pg.locator('.h-row.is-none').count() == 1)
        # перенос 3-го: на день позже, 18:30, 90 мин
        moved = ymd(base_day + timedelta(days=15))
        pg.click('.h-row[data-call="3"] [data-host-edit]')
        pg.wait_for_selector('#callSheet.open')
        pg.fill('#csDate', moved)
        pg.fill('#csTime', '18:30')
        pg.click('#csDur [data-dur="90"]')
        pg.click('#csSave')
        pg.wait_for_selector('#callSheet:not(.open)', state='attached')
        pg.wait_for_timeout(400)
        c3 = next(s for s in api('api/calls/host/students', H)[1]['students'] if s['id'] == SID)['calls']['3']
        ok(f'{vp}: перенос созвона 3', c3['at'] == f'{moved} 18:30' and c3['dur'] == 90, json.dumps(c3))
        ok(f'{vp}: перенос виден в строке', '18:30' in pg.inner_text('.h-row[data-call="3"]'))
        # удаление 4-го
        pg.click('.h-row[data-call="4"] [data-host-del]')
        pg.wait_for_selector('[data-host-del-yes="4"]')
        pg.screenshot(path=f'{SHOTS}/{vp}-host-confirm.png')
        pg.click('[data-host-del-yes="4"]')
        pg.wait_for_selector('.h-row[data-call="4"].is-none')
        c4 = next(s for s in api('api/calls/host/students', H)[1]['students'] if s['id'] == SID)['calls']['4']
        ok(f'{vp}: удаление созвона 4', c4 is None)
        pg.screenshot(path=f'{SHOTS}/{vp}-host.png', full_page=True)
        ok(f'{vp}: ведущий без ошибок JS', not errs, '; '.join(errs))
        ctx.close()

        # ---------- ученик ----------
        ctx = b.new_context(**VP[vp], accept_downloads=True)
        ctx.add_init_script("['demo','rasul','test'].forEach(i => localStorage.setItem('focus.tour.' + i, 'done'))")
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(B)
        pg.fill('#pinInput', STUDENT_PIN)
        pg.press('#pinInput', 'Enter')
        pg.wait_for_selector('#heroCall .call-card')
        hero = pg.inner_text('#heroCall')
        ok(f'{vp}: хиро — ближайший созвон 1', 'блок 1'.upper() in hero.upper() and '19:00–21:00' in hero, hero.replace('\n', ' | ')[:120])
        ok(f'{vp}: Meet неактивна заранее', pg.locator('#heroCall .cl-meet.is-off').count() == 1 and pg.locator('#heroCall a.cl-meet').count() == 0)
        g = pg.get_attribute('#heroCall a.cl-cal-btn', 'href')
        ok(f'{vp}: Google-ссылка с TZ Алматы', 'ctz=Asia%2FAlmaty' in g and f"{ymd(base_day).replace('-', '')}T190000%2F{ymd(base_day).replace('-', '')}T210000" in g, g[:160])
        with pg.expect_download() as dl:
            pg.click('#heroCall [data-ics="1"]')
        ics = open(dl.value.path(), encoding='utf-8', newline='').read()
        ev = ics_events(ics.replace('\r\n ', '').replace('\r\n', '\n'))
        d0 = ymd(base_day).replace('-', '')
        ok(f'{vp}: .ics на один — валиден', 'BEGIN:VTIMEZONE' in ics and 'TZID:Asia/Almaty' in ics and len(ev) == 1
           and ev[0].get('DTSTART;TZID=Asia/Almaty') == f'{d0}T190000' and ev[0].get('DTEND;TZID=Asia/Almaty') == f'{d0}T210000'
           and 'TRIGGER' in ics and ics.endswith('END:VCALENDAR\r\n'), json.dumps(ev[0] if ev else {}, ensure_ascii=False)[:200])
        pg.click('#heroCall .cc-all')
        pg.wait_for_selector('#callsView .cl-item')
        ok(f'{vp}: #calls — 3 назначено, 2 «уточняется»', pg.locator('.cl-item:not(.is-none)').count() == 3 and pg.locator('.cl-item.is-none').count() == 2)
        with pg.expect_download() as dl:
            pg.click('#callsAll [data-ics="all"]')
        ev = ics_events(open(dl.value.path(), encoding='utf-8').read())
        m3 = moved.replace('-', '')
        e3 = next((e for e in ev if e.get('UID', '').startswith(f'{SID}-call-3@')), {})
        ok(f'{vp}: .ics все — 3 события, DTEND по длительности', len(ev) == 3 and e3.get('DTSTART;TZID=Asia/Almaty') == f'{m3}T183000'
           and e3.get('DTEND;TZID=Asia/Almaty') == f'{m3}T200000', json.dumps(e3, ensure_ascii=False)[:160])
        feed = pg.get_attribute('#callsAll a.btn-primary', 'href')
        ok(f'{vp}: подписка Google (webcal)', feed.startswith('https://calendar.google.com/calendar/r?cid=webcal'), feed[:90])
        pg.screenshot(path=f'{SHOTS}/{vp}-student-calls.png', full_page=True)

        # Meet активна за 15 минут: созвон 1 через 10 минут
        soon = now + timedelta(minutes=10)
        api(f'api/calls/host/students/{SID}', H, {'calls': {'1': {'at': soon.strftime('%Y-%m-%d %H:%M'), 'dur': 60, 'meet': 'https://meet.google.com/abc-defg-hij'}}}, 'PATCH')
        pg.goto(B)
        pg.wait_for_selector('#heroCall .call-card')
        ok(f'{vp}: Meet активна за 10 мин до начала', pg.locator('#heroCall a.cl-meet.is-on').count() == 1)
        pg.screenshot(path=f'{SHOTS}/{vp}-student-home.png')

        # статусы блоков по датам: созвон 1 вчера → «Пройден», блок 2 → «Сейчас»
        api(f'api/calls/host/students/{SID}', H, {'calls': {'1': {'at': ymd(now - timedelta(days=1)) + ' 19:00', 'dur': 120}}}, 'PATCH')
        mods = {m['number']: m['status'] for m in api('api/modules', S)[1]}
        ok(f'{vp}: созвон вчера → блок 1 пройден, 2 сейчас', mods[1] == 'done' and mods[2] == 'active', json.dumps(mods))
        pg.goto(B)
        pg.wait_for_selector('#modulesView .route-card')
        ok(f'{vp}: на маршруте «Пройден»', 'ПРОЙДЕН' in pg.inner_text('.route-step[data-mod="1"]').upper())
        api(f'api/calls/host/students/{SID}', H, {'calls': {'1': {'at': ymd(now) + ' 23:00', 'dur': 60}}}, 'PATCH')
        mods = {m['number']: m['status'] for m in api('api/modules', S)[1]}
        ok(f'{vp}: созвон сегодня → блок 1 «Сейчас»', mods[1] == 'active', json.dumps(mods))
        ok(f'{vp}: ученик без ошибок JS', not errs, '; '.join(errs))
        ok(f'{vp}: нет горизонтального скролла', pg.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
        ctx.close()
    b.close()

# демо-план для превью: прошлый созвон, ближайший, дальше раз в неделю
demo = now + timedelta(days=1)
api(f'api/calls/host/students/{SID}', H, {'calls': {
    '1': {'at': ymd(now - timedelta(days=6)) + ' 19:00', 'dur': 120, 'topic': '', 'meet': 'https://meet.google.com/abc-defg-hij'},
    '2': {'at': ymd(demo) + ' 19:00', 'dur': 120, 'topic': 'Генерация картинок и видео — практика', 'meet': 'https://meet.google.com/abc-defg-hij'},
    '3': {'at': ymd(demo + timedelta(days=7)) + ' 19:00', 'dur': 120, 'topic': '', 'meet': 'https://meet.google.com/abc-defg-hij'},
    '4': {'at': ymd(demo + timedelta(days=14)) + ' 19:00', 'dur': 120, 'topic': '', 'meet': ''},
    '5': None}}, 'PATCH')
for sid in (H, S):
    api('api/auth/logout', sid, {}, 'POST')
print(f'{sum(res)}/{len(res)} PASS')
sys.exit(0 if all(res) else 1)
