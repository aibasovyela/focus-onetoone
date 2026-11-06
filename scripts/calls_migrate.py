"""Миграция users.json под календарь созвонов (06.11.2026). Ничего секретного не печатает.

  python3 scripts/calls_migrate.py check  FILE   — сводка: ученики, форматы calls, есть ли hostPins
  python3 scripts/calls_migrate.py apply  FILE   — hostPins = master-пин гостя (demo), если списка ещё нет; новый _help
  python3 scripts/calls_migrate.py strings FILE  — ОТКАТ: calls[N]-объекты → строки «YYYY-MM-DD HH:MM» (старый код их понимает)

Пишет атомарно, сохраняет права и владельца, копию кладёт рядом: FILE.bak-calls-<время>.
"""
import json, os, shutil, sys, time

HELP = ('Как добавить ученика: скопируй блок student-template в students, дай уникальный id, имя (как показывать на дашборде), '
        'личный PIN (6-20 символов), openModules — сколько модулей открыто (сейчас всем 6 = все блоки), '
        'calls — созвоны по номерам блоков: строка "2026-11-10 19:00" или объект {"at": "2026-11-10 19:00", "dur": 120, '
        '"topic": "", "meet": "https://meet.google.com/…"}; null = дата уточняется. Блок «пройден» на следующий день после созвона (Алматы). '
        'Созвоны удобнее ставить в кабинете: вход пином ведущего (hostPins) → «Режим ведущего». После правки перезапуск не нужен.')


def save(path, data):
    st = os.stat(path)
    shutil.copy2(path, f'{path}.bak-calls-{time.strftime("%Y%m%d-%H%M%S")}')
    tmp = f'{path}.tmp'
    with open(tmp, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.chmod(tmp, st.st_mode & 0o777)
    os.chown(tmp, st.st_uid, st.st_gid)
    os.replace(tmp, path)


def summary(d):
    for s in d.get('students', []):
        kinds = {n: (type(v).__name__ if v is not None else '-') for n, v in (s.get('calls') or {}).items()}
        print(f"  {s['id']}: openModules={s.get('openModules')} calls={kinds}")
    print(f"  hostPins: {len(d.get('hostPins') or [])}")


def main():
    cmd, path = sys.argv[1], sys.argv[2]
    d = json.load(open(path))
    if cmd == 'check':
        summary(d)
        return
    if cmd == 'apply':
        if not d.get('hostPins'):
            demo = next((s for s in d['students'] if s['id'] == 'demo'), None)
            master = [p for p in (demo or {}).get('pins', []) if 'master' in p.lower()]
            if not master:
                sys.exit('нет master-пина у demo — hostPins не добавлен')
            d['hostPins'] = master
        d['_help'] = HELP
    elif cmd == 'strings':
        for s in d['students']:
            for n, v in (s.get('calls') or {}).items():
                if isinstance(v, dict):
                    s['calls'][n] = v.get('at')
    else:
        sys.exit(__doc__)
    save(path, d)
    summary(d)


if __name__ == '__main__':
    main()
