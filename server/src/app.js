import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import jobsRoutes from './routes/jobs.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS Configuration (Supports local dev, configured CLIENT_ORIGIN, and Vercel deployments)
const allowedOrigins = [
  env.CLIENT_ORIGIN,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173'
].filter(Boolean).map(o => o.replace(/\/+$/, ''));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, '');
      if (
        allowedOrigins.includes(cleanOrigin) ||
        /\.vercel\.app$/.test(cleanOrigin) ||
        env.NODE_ENV === 'development'
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
    exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
    credentials: true
  })
);

// Request Logging
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: { success: false, error: 'Too many requests. Please try again later.' }
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, error: 'Upload rate limit exceeded. Please wait a few minutes before trying again.' }
});

app.use('/api', generalLimiter);
app.use('/api/jobs/upload', uploadLimiter);
app.use('/api/upload', uploadLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Traffic Data Processor API',
    environment: env.NODE_ENV,
    clientOrigin: env.CLIENT_ORIGIN,
    timestamp: new Date().toISOString()
  });
});

// Primary Routes
app.use('/api/jobs', jobsRoutes);
app.use('/api/upload', uploadRoutes); // Alias to POST /api/jobs/upload

// Centralized Error Handler
app.use(errorHandler);

export default app;
