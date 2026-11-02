import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../db');

// GET /api/modules — получить все 5 модулей
router.get('/', (req, res) => {
  try {
    const modules = JSON.parse(fs.readFileSync(join(dbPath, 'modules.json'), 'utf8'));
    res.json(modules.modules);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки модулей' });
  }
});

// GET /api/modules/:moduleId — получить конкретный модуль
router.get('/:moduleId', (req, res) => {
  try {
    const modules = JSON.parse(fs.readFileSync(join(dbPath, 'modules.json'), 'utf8'));
    const module = modules.modules.find(m => m.id === req.params.moduleId);
    if (!module) {
      return res.status(404).json({ error: 'Модуль не найден' });
    }
    res.json(module);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки модуля' });
  }
});

export default router;
