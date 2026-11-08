import express from 'express';
import crypto from 'crypto';
import { readJson, writeJson, requireHost, requireOwner, dropStudentSessions } from '../lib/store.js';

// Экран ведущего «Ученики»: ＋ ученик (PIN выдаётся сам и показывается один раз), открыть/закрыть блок,
// новый PIN, архив. Удалить — только владелец (ownerPins) и только из архива; удалённый уходит в
// db/students-trash.json без пинов, оттуда его можно вернуть в архив. Каждое действие пишется в db/students-log.json.

const router = express.Router();
router.use(requireHost);

const modulesList = () => (readJson('modules.json', {}).modules || []).map(m => ({ n: Number(m.number), title: m.title }));
const loadDb = () => {
  const db = readJson('users.json', null);
  if (!db || !Array.isArray(db.students)) throw new Error('users.json не читается');
  return db;
};
const strs = (v) => (Array.isArray(v) ? v.filter(Boolean).map(String) : []);
const pinsOf = (s) => strs(s.pins || (s.pin ? [s.pin] : []));
// ученик, через которого входит ведущий (его пин есть в hostPins), — без архива и смены PIN, иначе ведущий потеряет вход
const isProtected = (db, s) => pinsOf(s).some(p => strs(db.hostPins).includes(p) || strs(db.ownerPins).includes(p));

const log = (req, action, student, extra = {}) => {
  const list = readJson('students-log.json', []);
  list.push({ at: new Date().toISOString(), action, studentId: student.id, name: student.name, by: req.session.owner ? 'owner' : 'host', ...extra });
  writeJson('students-log.json', list.slice(-500));
};

class Bad extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
const fail = (res, e) => {
  if (e instanceof Bad) return res.status(e.status).json({ error: e.message });
  console.error('[students]', e.message);
  return res.status(500).json({ error: 'Не получилось сохранить, попробуй ещё раз' });
};

// открытые блоки ученика (как в store.moduleStatus)
const openOf = (s, nums) => {
  const open = Number(s.openModules) || 1;
  const closed = (s.closedModules || []).map(Number);
  return nums.filter(n => n <= open && !closed.includes(n));
};
// набор открытых блоков → openModules + closedModules (прежний формат «открыто до N» сохраняется, если подходит)
const setOpen = (s, want, nums) => {
  const set = new Set(want);
  const max = Math.max(0, ...set);
  const prev = Number(s.openModules) || 1;
  s.openModules = set.size === nums.length && prev > max ? prev : Math.max(1, max);
  const closed = nums.filter(n => n <= s.openModules && !set.has(n));
  if (closed.length) s.closedModules = closed; else delete s.closedModules;
};
const cleanOpen = (v, nums) => {
  if (!Array.isArray(v)) throw new Bad('Нужен список открытых блоков');
  const list = [...new Set(v.map(Number))];
  if (list.some(n => !nums.includes(n))) throw new Bad('Такого блока нет');
  return list.sort((a, b) => a - b);
};
const cleanName = (v) => {
  const name = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (!name) throw new Bad('Напиши имя ученика');
  if (name.length > 60) throw new Bad('Имя — до 60 символов');
  return name;
};

// 8 цифр, не совпадает ни с одним пином (ученики, архив, ведущие)
const newPin = (db) => {
  const taken = new Set([...db.students.flatMap(pinsOf), ...strs(db.hostPins), ...strs(db.ownerPins)]);
  for (;;) {
    const pin = String(crypto.randomInt(10000000, 100000000));
    if (!taken.has(pin)) return pin;
  }
};

const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sh', ы: 'y', э: 'e', ю: 'yu', я: 'ya', ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i' };
const newId = (db, trash, name) => {
  const base = name.toLowerCase().split(' ')[0].split('').map(c => TR[c] ?? c).join('').replace(/[^a-z0-9]/g, '').slice(0, 20) || 'student';
  const taken = new Set([...db.students, ...trash].map(s => s.id).concat(Object.keys(db)));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
};

const view = (db, s, nums) => ({
  id: s.id,
  name: s.name,
  open: openOf(s, nums),
  archived: !!s.archived,
  archivedAt: s.archivedAt || null,
  createdAt: s.createdAt || null,
  protected: isProtected(db, s),
  hasPin: pinsOf(s).length > 0
});

const find = (db, id) => {
  const s = db.students.find(x => x.id === id);
  if (!s) throw new Bad('Ученик не найден', 404);
  return s;
};

// GET /api/students — все ученики (активные и архив), блоки; владельцу ещё и удалённые
router.get('/', (req, res) => {
  try {
    const db = loadDb();
    const nums = modulesList().map(m => m.n);
    const owner = req.session.owner === true;
    res.json({
      owner,
      me: req.student.id,
      modules: modulesList(),
      students: db.students.map(s => view(db, s, nums)),
      deleted: owner ? readJson('students-trash.json', []).map(s => ({ id: s.id, name: s.name, deletedAt: s.deletedAt })) : []
    });
  } catch (e) { fail(res, e); }
});

// POST /api/students { name, open?: [n] } — новый ученик; PIN в ответе один раз, дальше его не видно
router.post('/', (req, res) => {
  try {
    const name = cleanName(req.body?.name);
    const db = loadDb();
    const nums = modulesList().map(m => m.n);
    const open = req.body?.open === undefined ? nums : cleanOpen(req.body.open, nums);
    const pin = newPin(db);
    const s = {
      id: newId(db, readJson('students-trash.json', []), name),
      name,
      pins: [pin],
      openModules: 1,
      calls: Object.fromEntries(nums.map(n => [String(n), null])),
      createdAt: new Date().toISOString()
    };
    // все блоки открыты (решение 03.11) — как у остальных: openModules = 6
    if (open.length === nums.length) s.openModules = Math.max(6, nums.length); else setOpen(s, open, nums);
    db.students.push(s);
    writeJson('users.json', db);
    log(req, 'add', s);
    res.json({ success: true, student: view(db, s, nums), pin });
  } catch (e) { fail(res, e); }
});

// PATCH /api/students/:id { name?, open?: [n] }
router.patch('/:id', (req, res) => {
  try {
    const db = loadDb();
    const s = find(db, req.params.id);
    const nums = modulesList().map(m => m.n);
    const body = req.body || {};
    const changes = {};
    if (body.name !== undefined) { const name = cleanName(body.name); if (name !== s.name) { changes.name = { from: s.name, to: name }; s.name = name; } }
    if (body.open !== undefined) {
      const before = openOf(s, nums).join(',');
      setOpen(s, cleanOpen(body.open, nums), nums);
      const after = openOf(s, nums).join(',');
      if (before !== after) changes.open = { from: before, to: after };
    }
    if (Object.keys(changes).length) { writeJson('users.json', db); log(req, 'edit', s, changes); }
    res.json({ success: true, student: view(db, s, nums) });
  } catch (e) { fail(res, e); }
});

// POST /api/students/:id/pin — новый PIN (старый перестаёт работать, все входы ученика закрываются)
router.post('/:id/pin', (req, res) => {
  try {
    const db = loadDb();
    const s = find(db, req.params.id);
    if (isProtected(db, s)) throw new Bad('Через этого ученика входит ведущий — PIN не меняем', 409);
    if (s.archived) throw new Bad('Сначала верни ученика из архива', 409);
    const pin = newPin(db);
    s.pins = [pin];
    delete s.pin;
    writeJson('users.json', db);
    dropStudentSessions(s.id);
    log(req, 'pin', s);
    res.json({ success: true, pin });
  } catch (e) { fail(res, e); }
});

// POST /api/students/:id/archive — в архив: вход закрыт, созвоны и ДЗ сохраняются
router.post('/:id/archive', (req, res) => {
  try {
    const db = loadDb();
    const s = find(db, req.params.id);
    if (isProtected(db, s) || s.id === req.student.id) throw new Bad('Через этого ученика входит ведущий — в архив нельзя', 409);
    if (!s.archived) {
      s.archived = true;
      s.archivedAt = new Date().toISOString();
      writeJson('users.json', db);
      dropStudentSessions(s.id);
      log(req, 'archive', s);
    }
    res.json({ success: true });
  } catch (e) { fail(res, e); }
});

// POST /api/students/:id/restore — из архива обратно (прежний PIN снова работает; если пина нет — «Новый PIN»)
router.post('/:id/restore', (req, res) => {
  try {
    const db = loadDb();
    const s = find(db, req.params.id);
    if (s.archived) {
      delete s.archived;
      delete s.archivedAt;
      writeJson('users.json', db);
      log(req, 'restore', s);
    }
    res.json({ success: true, hasPin: pinsOf(s).length > 0 });
  } catch (e) { fail(res, e); }
});

// DELETE /api/students/:id — удалить (только Еламан/Данияр, только из архива): запись уходит в корзину без пинов
router.delete('/:id', requireOwner, (req, res) => {
  try {
    const db = loadDb();
    const s = find(db, req.params.id);
    if (!s.archived) throw new Bad('Удалить можно только из архива', 409);
    if (isProtected(db, s)) throw new Bad('Через этого ученика входит ведущий', 409);
    const { pins, pin, ...rest } = s;
    const trash = readJson('students-trash.json', []);
    trash.push({ ...rest, deletedAt: new Date().toISOString() });
    writeJson('students-trash.json', trash);
    db.students = db.students.filter(x => x !== s);
    writeJson('users.json', db);
    dropStudentSessions(s.id);
    log(req, 'delete', s);
    res.json({ success: true });
  } catch (e) { fail(res, e); }
});

// POST /api/students/trash/:id/restore — вернуть удалённого в архив (без PIN: выдать новый после возврата)
router.post('/trash/:id/restore', requireOwner, (req, res) => {
  try {
    const trash = readJson('students-trash.json', []);
    const t = trash.find(x => x.id === req.params.id);
    if (!t) throw new Bad('В корзине такого нет', 404);
    const db = loadDb();
    if (db.students.some(x => x.id === t.id)) throw new Bad('Ученик с таким id уже есть', 409);
    const { deletedAt, ...s } = t;
    db.students.push({ ...s, pins: [], archived: true, archivedAt: new Date().toISOString() });
    writeJson('users.json', db);
    writeJson('students-trash.json', trash.filter(x => x !== t));
    log(req, 'undelete', s);
    res.json({ success: true });
  } catch (e) { fail(res, e); }
});

export default router;
