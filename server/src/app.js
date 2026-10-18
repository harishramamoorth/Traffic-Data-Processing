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

// CORS Configuration (Strict client origin)
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
