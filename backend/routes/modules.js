import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readJson, moduleStatus, requireSession } from '../lib/store.js';

const router = express.Router();
const materialsPath = join(dirname(fileURLToPath(import.meta.url)), '../../materials');

router.use(requireSession);

const readMeta = (moduleId) => {
  const file = join(materialsPath, moduleId, 'meta.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

// Диаграммы — наши файлы, но всё равно вычищаем активное содержимое перед вставкой inline
const cleanSvg = (svg) => svg
  .replace(/<\?xml[^>]*>/g, '')
  .replace(/<!DOCTYPE[^>]*>/gi, '')
  .replace(/<(script|foreignObject|iframe|image)[\s\S]*?<\/\1>/gi, '')
  .replace(/<(script|foreignObject|iframe|image)[^>]*\/?>/gi, '')
  .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
  .replace(/\s(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '');

const readDiagrams = (moduleId) => {
  const dir = join(materialsPath, moduleId, 'diagrams');
  if (!fs.existsSync(dir)) return {};
  return Object.fromEntries(fs.readdirSync(dir)
    .filter(f => f.endsWith('.svg'))
    .map(f => [f.slice(0, -4), cleanSvg(fs.readFileSync(join(dir, f), 'utf8'))]));
};

// Урок-слайды (docs/DECK_FORMAT.md): materials/<id>/deck.json; битый JSON — тихо откатываемся на лонгрид
const readDeck = (moduleId) => {
  const file = join(materialsPath, moduleId, process.env.DECK_FILE || 'deck.json');
  if (!fs.existsSync(file)) return null;
  try {
    const deck = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(deck?.chapters) && deck.chapters.some(c => c.slides?.length) ? deck : null;
  } catch (e) {
    console.error(`deck.json ${moduleId}:`, e.message);
    return null;
  }
};

const modulesFor = (student) => {
  const { modules = [] } = readJson('modules.json', {});
  const calls = student.calls || {};
  return modules.map(m => {
    const meta = readMeta(m.id);
    return {
      ...m,
      promise: meta?.promise || null,
      homework: meta?.homework || m.homework,
      status: moduleStatus(student, m.number),
      callDate: calls[m.number] || null
    };
  });
};

// GET /api/modules/me — ученик и его маршрут (без PIN)
router.get('/me', (req, res) => {
  const { program = {} } = readJson('modules.json', {});
  res.json({
    id: req.student.id,
    name: req.student.name,
    openModules: Number(req.student.openModules) || 1,
    program
  });
});

// GET /api/modules — все 5 модулей со статусом ученика
router.get('/', (req, res) => {
  res.json(modulesFor(req.student));
});

// GET /api/modules/:moduleId — конкретный модуль
router.get('/:moduleId', (req, res) => {
  const module = modulesFor(req.student).find(m => m.id === req.params.moduleId);
  if (!module) {
    return res.status(404).json({ error: 'Модуль не найден' });
  }
  res.json(module);
});

// GET /api/modules/:moduleId/lesson — урок; для закрытого модуля только предпросмотр (хиро + план)
router.get('/:moduleId/lesson', (req, res) => {
  const module = modulesFor(req.student).find(m => m.id === req.params.moduleId);
  if (!module) {
    return res.status(404).json({ error: 'Модуль не найден' });
  }
  const meta = readMeta(module.id) || {};
  const preview = {
    promise: meta.promise || module.result,
    duration: meta.duration || '2 часа · онлайн 1:1',
    outcomes: meta.outcomes || module.goals,
    plan: meta.plan || []
  };
  if (module.status === 'locked') {
    return res.json({ locked: true, ...preview });
  }
  const file = join(materialsPath, module.id, 'lesson.md');
  res.json({
    locked: false,
    ...preview,
    markdown: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '',
    diagrams: readDiagrams(module.id),
    deck: readDeck(module.id)
  });
});

// GET /api/modules/:moduleId/cheatsheet — шпаргалка (markdown), только для открытых модулей
router.get('/:moduleId/cheatsheet', (req, res) => {
  const module = modulesFor(req.student).find(m => m.id === req.params.moduleId);
  if (!module) {
    return res.status(404).json({ error: 'Модуль не найден' });
  }
  if (module.status === 'locked') {
    return res.status(403).json({ error: 'Модуль откроется после созвона' });
  }
  const file = join(materialsPath, module.id, 'cheatsheet.md');
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: 'Шпаргалка готовится' });
  }
  res.type('text/markdown; charset=utf-8').send(fs.readFileSync(file, 'utf8'));
});

export default router;
