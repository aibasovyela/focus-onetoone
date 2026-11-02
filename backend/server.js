import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRoutes from './routes/auth.js';
import modulesRoutes from './routes/modules.js';
import homeworkRoutes from './routes/homework.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json({ limit: '100kb' }));
app.set('trust proxy', 'loopback');

// Static files
app.use(express.static(join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/modules', modulesRoutes);
app.use('/api/homework', homeworkRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback to index.html for SPA
app.use('/api', (req, res) => res.status(404).json({ error: 'Не найдено' }));
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`🎓 Focus 1-on-1 запущен на порту ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});
