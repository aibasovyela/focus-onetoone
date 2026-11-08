import express from 'express';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readJson, writeJson, requireSession, requireHost, getAllStudents } from '../lib/store.js';
import { saveUpload, claimUploads, dropUpload, readMeta, filePath, isFileId, MAX_FILE, UploadError } from '../lib/uploads.js';
import { notifyHomework } from '../lib/notify.js';

const materialsPath = join(dirname(fileURLToPath(import.meta.url)), '../../materials');

// ДЗ из meta.json урока важнее базового из modules.json
const homeworkFor = (module) => {
  const file = join(materialsPath, module.id, 'meta.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).homework || module.homework;
  } catch {
    return module.homework;
  }
};

const router = express.Router();

router.use(requireSession);

const fail = (res, e) => {
  if (e instanceof UploadError) return res.status(e.status).json({ error: e.message });
  console.error('[homework]', e.message);
  return res.status(500).json({ error: 'Не получилось сохранить, попробуй ещё раз' });
};

const modulesList = () => readJson('modules.json', {}).modules || [];

// Ссылка на результат: только http/https, без пробелов, до 2000 символов
const cleanLink = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  let u;
  try { u = new URL(s); } catch { throw new UploadError('Ссылка должна начинаться с https:// или http://'); }
  if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.') || s.length > 2000 || /\s/.test(s)) {
    throw new UploadError('Ссылка должна начинаться с https:// или http://');
  }
  return u.href;
};

const filesOf = (hw) => (hw.files || []).map(f => ({ ...f, url: `api/homework/files/${encodeURIComponent(hw.studentId)}/${f.id}` }));

// POST /api/homework/upload — сырой файл в теле (Content-Type = тип файла, X-File-Name = encodeURIComponent(имя)).
// Возвращает id; к сдаче файл привязывается в /submit. До 20 МБ.
router.post('/upload', express.raw({ type: () => true, limit: MAX_FILE }), (req, res) => {
  try {
    let name = '';
    try { name = decodeURIComponent(req.get('X-File-Name') || ''); } catch { /* кривое имя — подставим своё */ }
    const file = saveUpload(req.student.id, req.body, { name, declared: req.get('Content-Type') });
    res.json({ success: true, file });
  } catch (e) { fail(res, e); }
});

// DELETE /api/homework/upload/:id — убрать свой ещё не сданный файл
router.delete('/upload/:id', (req, res) => {
  try { dropUpload(req.student.id, req.params.id); res.json({ success: true }); } catch (e) { fail(res, e); }
});

// GET /api/homework/files/:studentId/:id — файл ДЗ: только сам ученик или ведущий. ?inline=1 — показать (картинка/PDF).
router.get('/files/:sid/:id', (req, res) => {
  const { sid, id } = req.params;
  if (!isFileId(id)) return res.status(404).json({ error: 'Файл не найден' });
  if (sid !== req.student.id && req.session.host !== true) return res.status(403).json({ error: 'Нет доступа к файлу' });
  let meta = null;
  try { meta = readMeta(sid, id); } catch { /* кривой id ученика */ }
  if (!meta) return res.status(404).json({ error: 'Файл не найден' });
  const inline = req.query.inline === '1' && (meta.mime.startsWith('image/') || meta.mime === 'application/pdf');
  const ascii = meta.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.set({
    'Content-Type': meta.mime,
    'Content-Length': String(meta.size),
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    'Cache-Control': 'private, no-store'
  });
  fs.createReadStream(filePath(sid, id)).on('error', () => res.destroy()).pipe(res);
});

// GET /api/homework/host/all — все сдачи всех учеников (режим ведущего), новые сверху
router.get('/host/all', requireHost, (req, res) => {
  const names = Object.fromEntries(getAllStudents().map(s => [s.id, s.name]));
  const mods = Object.fromEntries(modulesList().map(m => [m.id, { number: m.number, title: m.title }]));
  const list = readJson('homework.json', [])
    .map(h => ({ ...h, studentName: names[h.studentId] || h.studentId, module: mods[h.moduleId] || null, files: filesOf(h) }))
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  res.json({ submissions: list });
});

// PATCH /api/homework/host/:id/feedback { feedback } — ответ ведущего на сдачу; ученик видит его у своего ДЗ.
// Пустой текст — убрать ответ.
router.patch('/host/:id/feedback', requireHost, (req, res) => {
  try {
    const raw = (req.body || {}).feedback;
    if (raw !== null && raw !== undefined && typeof raw !== 'string') throw new UploadError('feedback: нужен текст');
    const text = String(raw ?? '').replace(/\r\n/g, '\n').trim();
    if (text.length > 4000) throw new UploadError('Ответ — до 4000 символов');
    const all = readJson('homework.json', []);
    const hw = all.find(h => h.id === req.params.id);
    if (!hw) throw new UploadError('Сдача не найдена', 404);
    if (text) Object.assign(hw, { feedback: text, feedbackAt: new Date().toISOString(), status: 'reviewed' });
    else { Object.assign(hw, { feedback: null, status: 'submitted' }); delete hw.feedbackAt; }
    writeJson('homework.json', all);
    res.json({ success: true, feedback: hw.feedback, feedbackAt: hw.feedbackAt || null, status: hw.status });
  } catch (e) { fail(res, e); }
});

// POST /api/homework/submit — сдать ДЗ: { moduleId, content?, link?, files?: [id] } — нужно хоть что-то одно
router.post('/submit', (req, res) => {
  try {
    const { moduleId, content = '', link = '', files = [] } = req.body || {};
    const module = modulesList().find(m => m.id === moduleId);
    if (!module) throw new UploadError('Требуется moduleId');
    if (typeof content !== 'string') throw new UploadError('content: нужен текст');
    const text = content.trim().slice(0, 20000);
    const url = cleanLink(link);
    if (!text && !url && !(Array.isArray(files) && files.length)) throw new UploadError('Добавь описание, ссылку или файл');

    const id = `hw-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const metas = files.length ? claimUploads(req.student.id, files, id) : [];
    const homework = {
      id,
      studentId: req.student.id,
      moduleId,
      content: text,
      ...(url ? { link: url } : {}),
      ...(metas.length ? { files: metas.map(m => ({ id: m.id, name: m.name, mime: m.mime, size: m.size })) } : {}),
      submittedAt: new Date().toISOString(),
      status: 'submitted',
      feedback: null
    };

    const all = readJson('homework.json', []);
    all.push(homework);
    writeJson('homework.json', all);

    res.json({ success: true, homeworkId: homework.id, message: 'ДЗ отправлено, ожидает проверки' });
    notifyHomework({ student: req.student, module, hw: homework, files: metas.map(m => ({ meta: m, path: filePath(m.studentId, m.id) })) });
  } catch (e) { fail(res, e); }
});

// GET /api/homework/:moduleId — задание и сданные ответы ученика
router.get('/:moduleId', (req, res) => {
  const { modules = [] } = readJson('modules.json', {});
  const module = modules.find(m => m.id === req.params.moduleId);
  const homework = module && homeworkFor(module);
  if (!homework) {
    return res.status(404).json({ error: 'ДЗ не найдено' });
  }
  const submissions = readJson('homework.json', [])
    .filter(h => h.studentId === req.student.id && h.moduleId === module.id)
    .map(h => { const { studentId, ...rest } = h; return { ...rest, files: filesOf(h) }; });
  res.json({ ...homework, submissions });
});

// ошибки разбора тела (больше 20 МБ и т.п.) — JSON, а не HTML-страница express
router.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Файл больше 20 МБ' });
  if (err?.status) return res.status(err.status).json({ error: 'Не получилось принять файл' });
  next(err);
});

export default router;
