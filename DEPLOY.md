# Деплой Focus 1-on-1

## Деплой на КЗ-сервер (89.126.193.43, yelumio.kz/courses)

### Предусловия

- SSH доступ на сервер
- Node.js 18+ установлен
- Caddy или другой веб-сервер настроен
- Право писать в `/var/www/courses`

### Шаг 1: Подготовка на сервере

```bash
ssh root@89.126.193.43

# Создать директорию приложения
sudo mkdir -p /var/www/courses
sudo chown www-data:www-data /var/www/courses
cd /var/www/courses

# Клонировать репо
sudo -u www-data git clone https://github.com/aibasovyela/focus-onetoone.git
cd focus-onetoone

# Установить зависимости
sudo -u www-data npm install --production
```

### Шаг 2: Создать systemd сервис

Создать файл `/etc/systemd/system/focus-onetoone.service`:

```ini
[Unit]
Description=Focus 1-on-1 Platform
Documentation=https://github.com/aibasovyela/focus-onetoone
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/courses/focus-onetoone

# Стартовая команда
ExecStart=/usr/bin/node backend/server.js

# Переезагрузка при крахе
Restart=always
RestartSec=10

# Переменные окружения
Environment="NODE_ENV=production"
Environment="PORT=3000"

# Логирование
StandardOutput=journal
StandardError=journal
SyslogIdentifier=focus-onetoone

# Безопасность
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Активировать:

```bash
sudo systemctl daemon-reload
sudo systemctl enable focus-onetoone
sudo systemctl start focus-onetoone
```

Проверить статус:

```bash
sudo systemctl status focus-onetoone
sudo journalctl -u focus-onetoone -f
```

### Шаг 3: Настроить Caddy

В `/etc/caddy/Caddyfile` добавить:

```caddyfile
yelumio.kz {
  # ... другие директивы ...

  handle_path /courses* {
    reverse_proxy localhost:3000
  }
}
```

Перезагрузить Caddy:

```bash
sudo systemctl reload caddy
```

Проверить:

```bash
curl -I https://yelumio.kz/courses
# Должен вернуть 200
```

### Шаг 4: Установить HTTPS

Caddy автоматически выпускает Let's Encrypt сертификаты. Проверить:

```bash
sudo systemctl status caddy
```

### Обновления

Для обновления кода:

```bash
cd /var/www/courses/focus-onetoone
sudo -u www-data git pull origin master
sudo -u www-data npm install --production
sudo systemctl restart focus-onetoone
```

### Логирование

Просмотр логов:

```bash
# Последние 50 строк
sudo journalctl -u focus-onetoone -n 50

# Слежение в реальном времени
sudo journalctl -u focus-onetoone -f

# Логи за последний час
sudo journalctl -u focus-onetoone --since "1 hour ago"
```

### Мониторинг

Проверить здоровье:

```bash
curl https://yelumio.kz/courses/api/health
# Должен вернуть {"status":"ok","timestamp":"..."}
```

### Резервная копия

Сохранить БД и материалы:

```bash
cd /var/www/courses/focus-onetoone
tar -czf backup-$(date +%Y%m%d).tar.gz backend/db/ materials/
```

### Откатывка

Если что-то пошло не так:

```bash
cd /var/www/courses/focus-onetoone
git log --oneline -5  # Посмотреть историю
git reset --hard <commit-hash>  # Откатиться к версии
sudo systemctl restart focus-onetoone
```

## Альтернатива: Docker

Если нужна контейнеризация, создать `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 3000
CMD ["node", "backend/server.js"]
```

Запуск:

```bash
docker build -t focus-onetoone .
docker run -d \
  --name focus \
  -p 3000:3000 \
  -v /var/www/courses/focus-onetoone/backend/db:/app/backend/db \
  -v /var/www/courses/focus-onetoone/materials:/app/materials \
  focus-onetoone
```

## Проблемы и решения

### Приложение не запускается

```bash
sudo systemctl start focus-onetoone
sudo journalctl -u focus-onetoone -n 20
```

### Порт уже занят

```bash
sudo lsof -i :3000
sudo kill -9 <PID>
```

### Нет доступа к файлам

```bash
sudo chown -R www-data:www-data /var/www/courses/focus-onetoone
sudo chmod -R 755 /var/www/courses/focus-onetoone
```

### Медленный ответ

```bash
# Проверить ресурсы
free -h
top -p $(pgrep -f "node backend")

# Перезагрузить
sudo systemctl restart focus-onetoone
```

## Безопасность

- [ ] Установить firewall: `sudo ufw allow 443; sudo ufw allow 80`
- [ ] Включить fail2ban для защиты от brute-force
- [ ] Регулярно обновлять зависимости: `npm audit fix`
- [ ] Мониторить логи на ошибки: `journalctl -u focus-onetoone`
- [ ] Настроить backup БД: `crontab -e`
