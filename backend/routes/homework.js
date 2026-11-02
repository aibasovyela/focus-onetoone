import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../db');

// POST /api/homework/submit — загрузить ДЗ
router.post('/submit', (req, res) => {
  const { sessionId, moduleId, content } = req.body;

  if (!sessionId || !moduleId || !content) {
    return res.status(400).json({ error: 'Требуются все параметры' });
  }

  // В реальном приложении — сохранять в БД с привязкой к студенту
  const homework = {
    id: `hw-${Date.now()}`,
    moduleId,
    sessionId,
    content,
    submittedAt: new Date().toISOString(),
    status: 'submitted',
    feedback: null
  };

  res.json({
    success: true,
    homeworkId: homework.id,
    message: 'ДЗ загружено, ожидает проверки'
  });
});

// GET /api/homework/:moduleId — получить ДЗ по модулю
router.get('/:moduleId', (req, res) => {
  try {
    const modules = JSON.parse(fs.readFileSync(join(dbPath, 'modules.json'), 'utf8'));
    const module = modules.modules.find(m => m.id === req.params.moduleId);
    if (!module || !module.homework) {
      return res.status(404).json({ error: 'ДЗ не найдено' });
    }
    res.json(module.homework);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки ДЗ' });
  }
});

export default router;
