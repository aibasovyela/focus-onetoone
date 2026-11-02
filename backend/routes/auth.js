import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../db');

// POST /api/auth/login — проверка PIN
router.post('/login', (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'PIN не указан' });
  }

  const usersDb = JSON.parse(fs.readFileSync(join(dbPath, 'users.json'), 'utf8'));

  // Проверяем, есть ли такой PIN в системе
  if (usersDb.pins.includes(pin)) {
    const session = {
      sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pin: pin,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    // Сохраняем сессию (в боевом приложении — в БД)
    const sessionsFile = join(dbPath, 'sessions.json');
    let sessions = [];
    if (fs.existsSync(sessionsFile)) {
      sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
    }
    sessions.push(session);
    fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));

    res.json({
      success: true,
      sessionId: session.sessionId,
      message: 'Вход успешен'
    });
  } else {
    res.status(401).json({ error: 'Неверный PIN' });
  }
});

// POST /api/auth/verify — проверка сессии
router.post('/verify', (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId не указан' });
  }

  const sessionsFile = join(dbPath, 'sessions.json');
  if (!fs.existsSync(sessionsFile)) {
    return res.status(401).json({ error: 'Сессия не найдена' });
  }

  const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
  const session = sessions.find(s => s.sessionId === sessionId);

  if (!session) {
    return res.status(401).json({ error: 'Сессия не найдена' });
  }

  if (new Date(session.expiresAt) < new Date()) {
    return res.status(401).json({ error: 'Сессия истекла' });
  }

  res.json({
    valid: true,
    session: session
  });
});

export default router;
