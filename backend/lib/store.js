import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// FOCUS_DB_DIR — отдельная папка данных для тестового стенда (по умолчанию backend/db)
export const dbPath = process.env.FOCUS_DB_DIR || join(dirname(fileURLToPath(import.meta.url)), '../db');
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

// Атомарно: tmp + rename. Права файла сохраняем (users.json с пинами — 640, не 644 по umask).
// Все обработчики синхронные (read → правка → write без await), поэтому запросы внутри процесса не перебивают друг друга.
export const writeJson = (name, data) => {
  const file = join(dbPath, name);
  const tmp = `${file}.tmp`;
  let mode = 0o644;
  try { mode = fs.statSync(file).mode & 0o777; } catch { /* файла ещё нет */ }
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode });
  fs.chmodSync(tmp, mode);
  fs.renameSync(tmp, file);
};

// Все ученики, включая архив (экран «Ученики» у ведущего); вход, сессии и списки — только активные
export const getAllStudents = () => readJson('users.json', { students: [] }).students || [];
export const getStudents = () => getAllStudents().filter(s => !s.archived);

const samePin = (given) => (p) => {
  const real = Buffer.from(String(p));
  return real.length === given.length && crypto.timingSafeEqual(real, given);
};

export const findStudentByPin = (pin) => {
  const given = Buffer.from(String(pin));
  return getStudents().find(s => (s.pins || [s.pin]).filter(Boolean).some(samePin(given)));
};

// Пин ведущего (users.json → hostPins): вход как обычно, но сессия получает право планировать созвоны всем ученикам
export const isHostPin = (pin) => {
  const list = readJson('users.json', {}).hostPins;
  return Array.isArray(list) && list.filter(Boolean).some(samePin(Buffer.from(String(pin))));
};

// Пин владельца (users.json → ownerPins, Еламан/Данияр): ведущий, которому можно ещё и удалять учеников (через архив)
export const isOwnerPin = (pin) => {
  const list = readJson('users.json', {}).ownerPins;
  return Array.isArray(list) && list.filter(Boolean).some(samePin(Buffer.from(String(pin))));
};

export const findStudentById = (id) => getStudents().find(s => s.id === id);

// Модуль N открыт, если N <= openModules ученика и его нет в closedModules (закрыл ведущий); пройден — только когда день его созвона уже позади (Алматы).
// Первый открытый непройденный модуль модулем «Сейчас» (active) делает modulesFor.
// calls[N] — строка «YYYY-MM-DD» / «YYYY-MM-DD HH:MM» (старый формат, правка руками) или объект
// { at: «YYYY-MM-DD HH:MM», dur: минуты, topic, meet, seq } (пишет режим ведущего). Время — Алматы.
export const callAt = (value) => String((value && typeof value === 'object' ? value.at : value) || '');
export const callOf = (value) => {
  const at = callAt(value);
  if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(at)) return null;
  const o = value && typeof value === 'object' ? value : {};
  return { at, dur: Number(o.dur) || 120, topic: o.topic || '', meet: o.meet || '', seq: Number(o.seq) || 0 };
};
const todayAlmaty = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
export const moduleStatus = (student, number) => {
  const open = Number(student.openModules) || 1;
  if (number > open || (student.closedModules || []).map(Number).includes(number)) return 'locked';
  const call = callAt((student.calls || {})[number]).slice(0, 10);
  return call && call < todayAlmaty() ? 'done' : 'open';
};

const loadSessions = () => {
  const now = Date.now();
  const sessions = readJson('sessions.json', []);
  return Array.isArray(sessions) ? sessions.filter(s => s.studentId && new Date(s.expiresAt).getTime() > now) : [];
};

export const createSession = (studentId, { host = false, owner = false } = {}) => {
  const sessions = loadSessions();
  const session = {
    sessionId: crypto.randomBytes(24).toString('hex'),
    studentId,
    ...(host ? { host: true } : {}),
    ...(host && owner ? { owner: true } : {}),
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

// Выйти из всех сессий ученика (архив, новый PIN)
export const dropStudentSessions = (studentId) => {
  writeJson('sessions.json', loadSessions().filter(s => s.studentId !== studentId));
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

// Middleware: только сессия, открытая пином ведущего (401 — нет входа, 403 — вход ученика)
export const requireHost = (req, res, next) => requireSession(req, res, () => {
  if (req.session.host !== true) return res.status(403).json({ error: 'Только для ведущего' });
  next();
});

// Middleware: удаление — только Еламан или Данияр (сессия по пину из ownerPins)
export const requireOwner = (req, res, next) => requireHost(req, res, () => {
  if (req.session.owner !== true) return res.status(403).json({ error: 'Удалять может только Еламан или Данияр' });
  next();
});
