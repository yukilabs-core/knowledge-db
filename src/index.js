import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db/connection.js';
import searchRouter from './routes/search.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      error: err.message
    });
  }
});

// Routes
app.use('/api', searchRouter);

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Knowledge DB API running on port ${PORT}`);
});
