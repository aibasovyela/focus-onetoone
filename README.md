# Focus 1-on-1

Платформа индивидуального обучения. 5 модулей, персональное сопровождение (1-on-1), готовка к глубоким преобразованиям.

## Что входит

- **5 модулей** с видеозаписями, материалами и ДЗ
- **PIN-авторизация** для студентов
- **Личный кабинет** с прогрессом по каждому модулю
- **Домашние задания** с отправкой и проверкой
- **Дизайн** по брендбуку Yelumio 2026 (Лаванда)

## Стек

- **Frontend**: HTML5, CSS3, Vanilla JS
- **Backend**: Node.js, Express
- **Стили**: Yelumio Brand Kit 2026 (Unbounded, Golos Text, IBM Plex Mono)

## Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Запуск в режиме разработки

```bash
npm run dev
```

Приложение запустится на `http://localhost:3000`

### 3. Запуск в продакшене

```bash
npm start
```

## Структура проекта

```
focus-onetoone/
├── frontend/
│   ├── index.html          # Основная HTML страница
│   ├── css/
│   │   ├── brand.css       # Yelumio дизайн-система
│   │   └── app.css         # Стили приложения
│   ├── js/
│   │   ├── auth.js         # Аутентификация и управление сессией
│   │   ├── data.js         # API клиент
│   │   └── app.js          # Основное приложение
│   └── assets/             # Логотипы и иконки
├── backend/
│   ├── server.js           # Express сервер
│   ├── routes/
│   │   ├── auth.js         # Маршруты аутентификации
│   │   ├── modules.js      # Маршруты модулей
│   │   └── homework.js     # Маршруты ДЗ
│   └── db/
│       ├── users.json      # База студентов и PIN-кодов
│       └── modules.json    # Описание модулей (5 шт.)
├── materials/              # Материалы курса (PDF, ссылки)
│   ├── module-1/
│   ├── module-2/
│   ├── module-3/
│   ├── module-4/
│   └── module-5/
├── package.json
├── .gitignore
└── README.md
```

## Аутентификация

По умолчанию доступны PIN-коды:
- `focus2026` — основной
- `learn2026` — альтернативный
- `master2026` — альтернативный

Для добавления новых кодов, отредактируйте `backend/db/users.json`.

## Модули

Каждый модуль содержит:
- **Заголовок и описание**
- **Цели обучения** (3–4 пункта)
- **Материалы** (PDF презентации, чит-листы, ссылки)
- **Домашнее задание** с дедлайном
- **Запись созвона** (пока заглушка, ссылка в материалах)

Модули открываются последовательно: второй модуль доступен только после начала первого.

## API

### Аутентификация

- `POST /api/auth/login` — вход по PIN
- `POST /api/auth/verify` — проверка сессии

### Модули

- `GET /api/modules` — получить все модули
- `GET /api/modules/:moduleId` — получить конкретный модуль

### ДЗ

- `POST /api/homework/submit` — загрузить ДЗ
- `GET /api/homework/:moduleId` — получить ДЗ по модулю

## Деплой на КЗ-сервер (89.126.193.43)

### Вариант 1: На Caddy как обратный прокси

1. На сервере:

```bash
cd /var/www/courses
git clone https://github.com/aibasovyela/focus-onetoone.git
cd focus-onetoone
npm install
```

2. Systemd сервис (`/etc/systemd/system/focus.service`):

```ini
[Unit]
Description=Focus 1-on-1 Platform
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/courses/focus-onetoone
ExecStart=/usr/bin/node backend/server.js
Restart=always
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

3. Запустить:

```bash
sudo systemctl start focus
sudo systemctl enable focus
```

4. В Caddyfile:

```
handle_path /courses* {
  reverse_proxy localhost:3000 {
    header_uri /courses {path}
  }
}
```

### Вариант 2: Статичный фронт + API на отдельном порту

Если нужна SPA как статика — экспортируйте фронт и подавайте через Caddy, API остаётся на Node.

## Дальнейшее развитие

- [ ] Загрузка видеозаписей созвонов (YouTube/Vimeo)
- [ ] PDF материалы и презентации (привязка к модулям)
- [ ] Система оценок для ДЗ
- [ ] Email уведомления о дедлайнах
- [ ] Аналитика прогресса студентов
- [ ] Интеграция с Zoom/Calendly для расписания созвонов

## Лицензия

MIT

## Автор

Yelumio — платформа обучения и развития через AI
