import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readJson, moduleStatus, requireSession } from '../lib/store.js';

const router = express.Router();
const materialsPath = join(dirname(fileURLToPath(import.meta.url)), '../../materials');

router.use(requireSession);

const modulesFor = (student) => {
  const { modules = [] } = readJson('modules.json', {});
  const calls = student.calls || {};
  return modules.map(m => ({
    ...m,
    status: moduleStatus(student, m.number),
    callDate: calls[m.number] || null
  }));
};

// GET /api/modules/me — ученик и его маршрут (без PIN)
router.get('/me', (req, res) => {
  const { program = {} } = readJson('modules.json', {});
  res.json({
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
