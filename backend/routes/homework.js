import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readJson, writeJson, requireSession } from '../lib/store.js';

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

// POST /api/homework/submit — сдать ДЗ
router.post('/submit', (req, res) => {
  const { moduleId, content } = req.body || {};

  if (!moduleId || !content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Требуются moduleId и content' });
  }

  const homework = {
    id: `hw-${Date.now()}`,
    studentId: req.student.id,
    moduleId,
    content: content.slice(0, 20000),
    submittedAt: new Date().toISOString(),
    status: 'submitted',
    feedback: null
  };

  const all = readJson('homework.json', []);
  all.push(homework);
  writeJson('homework.json', all);

  res.json({
    success: true,
    homeworkId: homework.id,
    message: 'ДЗ отправлено, ожидает проверки'
  });
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
    .map(({ studentId, ...h }) => h);
  res.json({ ...homework, submissions });
});

export default router;
