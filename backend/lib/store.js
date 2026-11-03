import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// FOCUS_DB_DIR — отдельная папка данных для тестового стенда (по умолчанию backend/db)
const dbPath = process.env.FOCUS_DB_DIR || join(dirname(fileURLToPath(import.meta.url)), '../db');
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

export const readJson = (name, fallback) => {
  const file = join(dbPath, name);
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

export const writeJson = (name, data) => {
  const file = join(dbPath, name);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
};

export const getStudents = () => readJson('users.json', { students: [] }).students || [];

export const findStudentByPin = (pin) => {
  const given = Buffer.from(String(pin));
  return getStudents().find(s => (s.pins || [s.pin]).filter(Boolean).some(p => {
    const real = Buffer.from(String(p));
    return real.length === given.length && crypto.timingSafeEqual(real, given);
  }));
};

export const findStudentById = (id) => getStudents().find(s => s.id === id);

// Модуль N открыт, если N <= openModules ученика
export const moduleStatus = (student, number) => {
  const open = Number(student.openModules) || 1;
  if (number < open) return 'done';
  if (number === open) return 'active';
  return 'locked';
};

const loadSessions = () => {
  const now = Date.now();
  const sessions = readJson('sessions.json', []);
  return Array.isArray(sessions) ? sessions.filter(s => s.studentId && new Date(s.expiresAt).getTime() > now) : [];
};

export const createSession = (studentId) => {
  const sessions = loadSessions();
  const session = {
    sessionId: crypto.randomBytes(24).toString('hex'),
    studentId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
  };
  sessions.push(session);
  writeJson('sessions.json', sessions); // заодно вычищаем просроченные
  return session;
};

export const findSession = (sessionId) => {
  if (!sessionId) return null;
  return loadSessions().find(s => s.sessionId === sessionId) || null;
};

export const deleteSession = (sessionId) => {
  writeJson('sessions.json', loadSessions().filter(s => s.sessionId !== sessionId));
};

// Middleware: пускаем только с валидной сессией (заголовок X-Session-Id)
export const requireSession = (req, res, next) => {
  const sessionId = req.get('X-Session-Id');
  const session = findSession(sessionId);
  const student = session && findStudentById(session.studentId);
  if (!student) {
    return res.status(401).json({ error: 'Нужен вход по PIN' });
  }
  req.session = session;
  req.student = student;
  next();
};
