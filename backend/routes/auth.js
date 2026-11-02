import express from 'express';
import { findStudentByPin, createSession, deleteSession, requireSession } from '../lib/store.js';

const router = express.Router();

// Простая защита от перебора PIN: не больше 10 попыток в 15 минут с одного IP
const attempts = new Map();
const tooManyAttempts = (ip) => {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
  attempts.set(ip, list);
  return list.length >= 10;
};

// POST /api/auth/login — вход по PIN
router.post('/login', (req, res) => {
  const ip = req.ip;
  if (tooManyAttempts(ip)) {
    return res.status(429).json({ error: 'Слишком много попыток, попробуйте через 15 минут' });
  }

  const { pin } = req.body || {};
  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({ error: 'PIN не указан' });
  }

  const student = findStudentByPin(pin.trim());
  if (!student) {
    attempts.get(ip).push(Date.now());
    return res.status(401).json({ error: 'Неверный PIN' });
  }

  const session = createSession(student.id);
  res.json({
    success: true,
    sessionId: session.sessionId,
    expiresAt: session.expiresAt,
    message: 'Вход успешен'
  });
});

// POST /api/auth/verify — проверка сессии
router.post('/verify', requireSession, (req, res) => {
  res.json({ valid: true, expiresAt: req.session.expiresAt });
});

// POST /api/auth/logout — завершить сессию
router.post('/logout', requireSession, (req, res) => {
  deleteSession(req.session.sessionId);
  res.json({ success: true });
});

export default router;
