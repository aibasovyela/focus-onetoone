import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import { join } from 'path';
import { dbPath, readJson, writeJson, callOf, findStudentById, requireSession, requireHost } from '../lib/store.js';

// Календарь созвонов: план ученика хранится в users.json → students[].calls[N] (N — номер блока),
// тот же ключ, по которому moduleStatus считает «пройден». Время — Алматы (UTC+5 круглый год).
const router = express.Router();
const TZ = 'Asia/Almaty';
const SITE = process.env.COURSES_URL || 'https://yelumio.kz/courses/';
const ICS_TTL_MS = 10 * 60 * 1000;
const SECRET = crypto.randomBytes(32); // подпись ссылок на .ics; после рестарта старые ссылки (10 мин) просто протухают

const modulesList = () => readJson('modules.json', {}).modules || [];

const plan = (student) => {
  const calls = student.calls || {};
  return modulesList().map(m => {
    const c = callOf(calls[m.number]);
    return c && { n: m.number, moduleId: m.id, title: m.title, at: c.at, dur: c.dur, topic: c.topic, meet: c.meet, seq: c.seq };
  }).filter(Boolean);
};

// ---------- .ics (RFC 5545) ----------
const icsText = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line) => {
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > (out.length ? 74 : 75)) { out.push(cur); cur = ''; }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
};
const pad = (n) => String(n).padStart(2, '0');
// «2026-11-10 19:00» + 120 мин → «20261110T210000» (локальное время Алматы; считаем в UTC, чтобы не зависеть от TZ сервера)
const localStamp = (at, plusMin = 0) => {
  const [d, t = '00:00'] = at.split(' ');
  const x = new Date(Date.parse(`${d}T${t}:00Z`) + plusMin * 60000);
  return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}00`;
};

const buildIcs = (student, calls) => {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Yelumio//Focus AI 1-1//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Фокус ИИ 1:1', `X-WR-TIMEZONE:${TZ}`,
    'BEGIN:VTIMEZONE', `TZID:${TZ}`, 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0500', 'TZOFFSETTO:+0500', 'TZNAME:+05', 'END:STANDARD', 'END:VTIMEZONE'];
  for (const c of calls) {
    const timed = c.at.length > 10;
    const desc = [`Персональный созвон «Фокус ИИ 1:1», блок ${c.n}: ${c.title}.`];
    if (c.meet) desc.push(`Google Meet: ${c.meet}`);
    desc.push(`Кабинет: ${SITE}`);
    L.push('BEGIN:VEVENT', `UID:${student.id}-call-${c.n}@courses.yelumio.kz`, `SEQUENCE:${c.seq}`, `DTSTAMP:${stamp}`);
    if (timed) {
      L.push(`DTSTART;TZID=${TZ}:${localStamp(c.at)}`, `DTEND;TZID=${TZ}:${localStamp(c.at, c.dur)}`);
    } else { // дата без времени — событие на весь день
      L.push(`DTSTART;VALUE=DATE:${localStamp(c.at).slice(0, 8)}`, `DTEND;VALUE=DATE:${localStamp(c.at, 24 * 60).slice(0, 8)}`);
    }
    L.push(`SUMMARY:${icsText(`Фокус ИИ 1:1 · созвон ${c.n}: ${c.topic || c.title}`)}`, `DESCRIPTION:${icsText(desc.join('\n'))}`);
    if (c.meet) L.push(`LOCATION:${icsText(c.meet)}`, `URL:${c.meet}`);
    L.push('STATUS:CONFIRMED');
    if (timed) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Созвон через 30 минут', 'TRIGGER:-PT30M', 'END:VALARM');
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
};

// Ссылка на .ics без заголовка сессии (iPhone открывает её сам и предлагает «Добавить в Календарь»): подпись + 10 минут
const sign = (payload) => crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
const icsToken = (studentId, n) => {
  const payload = Buffer.from(JSON.stringify({ s: studentId, n, e: Date.now() + ICS_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
};
const readIcsToken = (token) => {
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return null;
  const good = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (good.length !== given.length || !crypto.timingSafeEqual(good, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.e > Date.now() ? data : null;
  } catch { return null; }
};

// Подписка (Google «Добавить по URL», iPhone webcal://): постоянная ссылка ученика, календарь сам подтягивает переносы.
// Подпись — ключом db/calendar.key (создаётся сам, 600); сменить ключ = отозвать все подписки.
let feedKey = null;
const getFeedKey = () => {
  if (feedKey) return feedKey;
  const file = join(dbPath, 'calendar.key');
  try { feedKey = fs.readFileSync(file); } catch {
    fs.writeFileSync(file, crypto.randomBytes(32), { mode: 0o600, flag: 'wx' });
    feedKey = fs.readFileSync(file);
  }
  return feedKey;
};
const feedSig = (id) => crypto.createHmac('sha256', getFeedKey()).update(`feed:${id}`).digest('base64url').slice(0, 32);
const feedPath = (id) => `api/calls/feed/${encodeURIComponent(id)}.${feedSig(id)}.ics`;

router.get('/feed/:file', (req, res) => {
  const m = /^(.+)\.([\w-]{32})\.ics$/.exec(req.params.file);
  const student = m && findStudentById(m[1]);
  const good = student && Buffer.from(feedSig(student.id));
  if (!student || !crypto.timingSafeEqual(good, Buffer.from(m[2].padEnd(32).slice(0, 32)))) {
    return res.status(404).type('text/plain; charset=utf-8').send('Календарь не найден');
  }
  res.set('Cache-Control', 'max-age=300');
  res.set('Content-Disposition', 'inline; filename="focus-ai-calls.ics"');
  res.type('text/calendar; charset=utf-8').send(buildIcs(student, plan(student)));
});

// GET /api/calls/ics/<token> — файл календаря (один созвон или все)
router.get('/ics/:token', (req, res) => {
  const t = readIcsToken(req.params.token);
  const student = t && findStudentById(t.s);
  if (!student) return res.status(404).type('text/plain; charset=utf-8').send('Ссылка устарела — нажми «В календарь» в кабинете ещё раз');
  const calls = plan(student).filter(c => t.n === 'all' || c.n === t.n);
  if (!calls.length) return res.status(404).type('text/plain; charset=utf-8').send('Созвон не найден');
  res.set('Cache-Control', 'no-store');
  res.set('Content-Disposition', `inline; filename="${t.n === 'all' ? 'focus-ai-calls' : `focus-ai-call-${t.n}`}.ics"`);
  res.type('text/calendar; charset=utf-8').send(buildIcs(student, calls));
});

// ---------- ученик: только свой план ----------
router.get('/', requireSession, (req, res) => {
  res.json({ tz: TZ, feed: feedPath(req.student.id), calls: plan(req.student).map(({ seq, ...c }) => c) });
});

// POST /api/calls/ics-link { n: 3 | "all" } → { url } — относительная ссылка на .ics
router.post('/ics-link', requireSession, (req, res) => {
  const raw = (req.body || {}).n;
  const n = raw === 'all' ? 'all' : Number(raw);
  const calls = plan(req.student);
  if (n !== 'all' && !calls.some(c => c.n === n)) return res.status(404).json({ error: 'Созвон не найден' });
  if (!calls.length) return res.status(404).json({ error: 'Созвоны ещё не назначены' });
  res.json({ url: `api/calls/ics/${icsToken(req.student.id, n)}` });
});

// ---------- ведущий (сессия по пину из hostPins) ----------
router.get('/host/students', requireHost, (req, res) => {
  const modules = modulesList().map(m => ({ n: m.number, id: m.id, title: m.title }));
  const students = (readJson('users.json', { students: [] }).students || []).map(s => ({
    id: s.id,
    name: s.name,
    calls: Object.fromEntries(modules.map(m => {
      const c = callOf((s.calls || {})[m.n]);
      return [m.n, c && { at: c.at, dur: c.dur, topic: c.topic, meet: c.meet }];
    }))
  }));
  res.json({ tz: TZ, modules, students });
});

const AT_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const cleanCall = (v) => {
  if (v === null) return null;
  if (!v || typeof v !== 'object') throw new Error('Неверные данные созвона');
  const m = AT_RE.exec(String(v.at || ''));
  if (!m) throw new Error('Дата и время: ГГГГ-ММ-ДД ЧЧ:ММ');
  const [, y, mo, d, h, mi] = m.map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || h > 23 || mi > 59 || y < 2025 || y > 2030) throw new Error('Такой даты нет');
  const dur = Number(v.dur ?? 120);
  if (!Number.isInteger(dur) || dur < 15 || dur > 300) throw new Error('Длительность: от 15 до 300 минут');
  const topic = String(v.topic ?? '').replace(/\s+/g, ' ').trim();
  if (topic.length > 120) throw new Error('Тема — до 120 символов');
  const meet = String(v.meet ?? '').trim();
  if (meet && !/^https:\/\/[^\s<>"'`]{4,300}$/.test(meet)) throw new Error('Ссылка на созвон должна начинаться с https://');
  return { at: m[0], dur, topic, meet };
};

// PATCH /api/calls/host/students/:id { calls: { "2": {at, dur, topic, meet} | null, … } } — частичное обновление
router.patch('/host/students/:id', requireHost, (req, res) => {
  const patch = (req.body || {}).calls;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return res.status(400).json({ error: 'Нужен объект calls' });
  const numbers = new Set(modulesList().map(m => String(m.number)));
  const clean = {};
  try {
    for (const [n, v] of Object.entries(patch)) {
      if (!numbers.has(n)) throw new Error(`Нет блока ${n}`);
      clean[n] = cleanCall(v);
    }
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  // читаем свежий файл прямо перед записью: правки руками и чужие поля ученика (пины, openModules) не теряются
  const db = readJson('users.json', null);
  const student = db && (db.students || []).find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Ученик не найден' });
  student.calls = { ...(student.calls || {}) };
  for (const [n, c] of Object.entries(clean)) {
    const prev = student.calls[n];
    const seq = (prev && typeof prev === 'object' ? Number(prev.seq) || 0 : 0) + (prev ? 1 : 0);
    student.calls[n] = c && { ...c, seq };
  }
  writeJson('users.json', db);
  res.json({ success: true, calls: Object.fromEntries(Object.keys(student.calls).map(n => [n, callOf(student.calls[n])])) });
});

export default router;
