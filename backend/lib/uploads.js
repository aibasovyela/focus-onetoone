import fs from 'fs';
import crypto from 'crypto';
import { join } from 'path';
import { dbPath } from './store.js';

// Файлы ДЗ лежат вне публичной папки frontend/ и отдаются только через API (ученик-владелец или ведущий).
// Прод: FOCUS_UPLOAD_DIR=/var/lib/focus-onetoone/uploads (drop-in службы), иначе <db>/uploads.
// Раскладка: <dir>/<studentId>/<uuid> — сам файл, <uuid>.json — имя, тип, размер, к какой сдаче привязан (hwId).
export const uploadDir = process.env.FOCUS_UPLOAD_DIR || join(dbPath, 'uploads');
export const MAX_FILE = 20 * 1024 * 1024;
export const MAX_FILES = 5;
const MAX_PENDING = 20;                 // загружено, но ещё не сдано
const PENDING_TTL_MS = 24 * 3600 * 1000; // несданные файлы старше суток удаляются при следующей загрузке

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STUDENT_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const isFileId = (id) => typeof id === 'string' && ID_RE.test(id);

// Тип определяем по содержимому (сигнатуре), а не по тому, что прислал браузер.
// Для ZIP (docx/xlsx/pptx) и OLE (doc/xls/ppt) сигнатура общая — уточняем по расширению.
const starts = (b, sig, at = 0) => b.length >= at + sig.length && sig.every((x, i) => b[at + i] === x);
const ascii = (b, from, to) => b.subarray(from, to).toString('latin1');
const TYPES = {
  jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint',
  txt: 'text/plain'
};
// что браузер может прислать в Content-Type (пусто/octet-stream — iOS и старые браузеры так делают)
const DECLARED_OK = new Set([...Object.values(TYPES), 'image/jpg', 'image/heif', 'text/markdown', 'text/csv', 'application/octet-stream', '']);
export const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv';

const extOf = (name) => (/\.([a-z0-9]{1,5})$/i.exec(name || '') || [])[1]?.toLowerCase() || '';

const sniff = (b, ext) => {
  if (starts(b, [0xFF, 0xD8, 0xFF])) return 'jpg';
  if (starts(b, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return 'png';
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') return 'gif';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp';
  if (ascii(b, 4, 8) === 'ftyp' && ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(ascii(b, 8, 12))) return 'heic';
  if (ascii(b, 0, 5) === '%PDF-') return 'pdf';
  if (starts(b, [0x50, 0x4B, 0x03, 0x04])) return ['docx', 'xlsx', 'pptx'].includes(ext) ? ext : null;
  if (starts(b, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])) return ['doc', 'xls', 'ppt'].includes(ext) ? ext : null;
  if (['txt', 'md', 'csv'].includes(ext) && !b.includes(0)) {
    try { new TextDecoder('utf-8', { fatal: true }).decode(b); return 'txt'; } catch { return null; }
  }
  return null;
};

// Имя для показа: без путей и управляющих символов, до 120 символов, расширение — по реальному типу
const cleanName = (raw, kind) => {
  let name = String(raw || '').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f"<>|]/g, '').replace(/\s+/g, ' ').trim();
  const ext = extOf(name);
  const same = ext === kind || (kind === 'jpg' && ext === 'jpeg') || (kind === 'heic' && ext === 'heif') || (kind === 'txt' && ['md', 'csv'].includes(ext));
  if (!same) name = `${name.replace(/\.[^.]*$/, '') || 'файл'}.${kind}`;
  if (name.length > 120) name = name.slice(0, 100) + '…' + name.slice(name.lastIndexOf('.'));
  return name || `файл.${kind}`;
};

const studentDir = (studentId) => {
  if (!STUDENT_RE.test(studentId)) throw new Error('bad student id');
  return join(uploadDir, studentId);
};
const metaPath = (studentId, id) => join(studentDir(studentId), `${id}.json`);

export const readMeta = (studentId, id) => {
  if (!isFileId(id)) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath(studentId, id), 'utf8'));
    return meta.studentId === studentId ? meta : null;
  } catch { return null; }
};
export const filePath = (studentId, id) => join(studentDir(studentId), id);
const writeMeta = (meta) => {
  const p = metaPath(meta.studentId, meta.id);
  fs.writeFileSync(`${p}.tmp`, JSON.stringify(meta), { mode: 0o640 });
  fs.renameSync(`${p}.tmp`, p);
};

const listMeta = (studentId) => {
  let names = [];
  try { names = fs.readdirSync(studentDir(studentId)); } catch { return []; }
  return names.filter(n => n.endsWith('.json')).map(n => readMeta(studentId, n.slice(0, -5))).filter(Boolean);
};

const removeFile = (meta) => {
  for (const p of [filePath(meta.studentId, meta.id), metaPath(meta.studentId, meta.id)]) fs.rmSync(p, { force: true });
};

export class UploadError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Сохранить загруженный файл (ещё не привязан к сдаче). Возвращает публичное описание.
export const saveUpload = (studentId, buf, { name, declared }) => {
  if (!Buffer.isBuffer(buf) || !buf.length) throw new UploadError('Пустой файл');
  if (buf.length > MAX_FILE) throw new UploadError('Файл больше 20 МБ', 413);
  const type = String(declared || '').split(';')[0].trim().toLowerCase();
  if (!DECLARED_OK.has(type)) throw new UploadError('Такой тип файла не принимаем: нужны картинки, PDF или документы', 415);
  const kind = sniff(buf, extOf(name));
  if (!kind) throw new UploadError('Файл не похож на картинку, PDF или документ', 415);

  const now = Date.now();
  const pending = listMeta(studentId).filter(m => !m.hwId);
  pending.filter(m => now - Date.parse(m.uploadedAt) > PENDING_TTL_MS).forEach(removeFile);
  if (pending.filter(m => now - Date.parse(m.uploadedAt) <= PENDING_TTL_MS).length >= MAX_PENDING) {
    throw new UploadError('Слишком много несданных файлов — отправь ДЗ или удали лишние', 429);
  }

  const dir = studentDir(studentId);
  fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
  const meta = {
    id: crypto.randomUUID(), studentId, name: cleanName(name, kind), mime: TYPES[kind], size: buf.length,
    uploadedAt: new Date(now).toISOString(), hwId: null
  };
  fs.writeFileSync(filePath(studentId, meta.id), buf, { mode: 0o640 });
  writeMeta(meta);
  return publicFile(meta);
};

export const publicFile = (m) => ({ id: m.id, name: m.name, mime: m.mime, size: m.size, image: m.mime.startsWith('image/') && m.mime !== 'image/heic' });

// Привязать загруженные файлы к сдаче. Все id должны быть своими и ещё не сданными — иначе ошибка, ничего не меняем.
export const claimUploads = (studentId, ids, hwId) => {
  if (!Array.isArray(ids)) throw new UploadError('files: нужен список');
  const uniq = [...new Set(ids)];
  if (uniq.length > MAX_FILES) throw new UploadError(`Не больше ${MAX_FILES} файлов в одной сдаче`);
  const metas = uniq.map(id => readMeta(studentId, id));
  if (metas.some(m => !m || m.hwId)) throw new UploadError('Файл не найден — загрузи его заново');
  metas.forEach(m => writeMeta({ ...m, hwId }));
  return metas;
};

// Удалить свой несданный файл (крестик в форме)
export const dropUpload = (studentId, id) => {
  const meta = readMeta(studentId, id);
  if (!meta) throw new UploadError('Файл не найден', 404);
  if (meta.hwId) throw new UploadError('Файл уже в сданном ДЗ', 409);
  removeFile(meta);
};
