# Календарь созвонов (06.11.2026)

## Данные
`backend/db/users.json` → `students[].calls[N]`, N — номер блока (1–5). Время — Алматы (UTC+5).

- строка `"2026-11-10"` или `"2026-11-10 19:00"` — старый формат, правка руками, по-прежнему работает;
- объект `{ "at": "2026-11-10 19:00", "dur": 120, "topic": "", "meet": "https://meet.google.com/…", "seq": 0 }` — пишет режим ведущего;
- `null` — дата уточняется.

Статус блока (`lib/store.js → moduleStatus`) смотрит только на дату: «пройден» со следующего дня после созвона, первый непройденный — «Сейчас». `seq` растёт при каждом переносе (SEQUENCE в .ics — календарь обновит событие, а не создаст второе).

`users.json → hostPins` — пины ведущего. Вход таким пином = обычная сессия (ученик demo) + `host: true` в sessions.json.

## API (`backend/routes/calls.js`)
| Метод | Путь | Доступ |
|---|---|---|
| GET | `/api/calls` | ученик: свой план + `feed` (ссылка подписки) |
| POST | `/api/calls/ics-link` `{n: 3 \| "all"}` | ученик → `{url}` на .ics, подпись, 10 минут |
| GET | `/api/calls/ics/<token>` | без сессии, по подписанной ссылке |
| GET | `/api/calls/feed/<id>.<sig>.ics` | подписка (Google «по URL», webcal), ключ `db/calendar.key` |
| GET | `/api/calls/host/students` | ведущий (403 ученику, 401 без входа) |
| PATCH | `/api/calls/host/students/:id` `{calls: {"2": {...} \| null}}` | ведущий, частичное обновление |

Запись users.json атомарная (tmp + rename, права файла сохраняются), файл перечитывается прямо перед записью; sessions.json и homework.json — отдельные файлы, их запись не пересекается.

## Фронт
`js/calls.js` + `css/calls.css`: карточка «Ближайший созвон» в хиро, страница `#calls`, режим ведущего `#host` (шторка `#callSheet`). Meet активна за 15 минут до начала и до конца созвона.

## Проверка
`HOST_PIN=… STUDENT_PIN=… BASE=http://127.0.0.1:3013/ python3 scripts/calls_check.py` — только на стенде с тестовым учеником.
Миграция/откат формата: `scripts/calls_migrate.py check|apply|strings <users.json>`.
