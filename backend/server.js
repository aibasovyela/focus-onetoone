import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import authRoutes from './routes/auth.js';
import modulesRoutes from './routes/modules.js';
import homeworkRoutes from './routes/homework.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

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
app.get('*', (req, res) => {
  if (!req.url.startsWith('/api')) {
    res.sendFile(join(__dirname, '../frontend/index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`🎓 Focus 1-on-1 запущен на порту ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});
