import express from 'express';
import { readJson, writeJson, requireSession } from '../lib/store.js';

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
  if (!module || !module.homework) {
    return res.status(404).json({ error: 'ДЗ не найдено' });
  }
  const submissions = readJson('homework.json', [])
    .filter(h => h.studentId === req.student.id && h.moduleId === module.id)
    .map(({ studentId, ...h }) => h);
  res.json({ ...module.homework, submissions });
});

export default router;
