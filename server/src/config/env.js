import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173',
  PYTHON_PATH: process.env.PYTHON_PATH || 'python',
  HASH_SECRET: process.env.HASH_SECRET || 'traffic_privacy_hmac_secret_2026_key',
  UPLOAD_DIR: path.resolve(__dirname, '../../uploads'),
  PROCESSED_DIR: path.resolve(__dirname, '../../processed'),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/traffic_processor'
};

// Ensure required staging directories exist
if (!fs.existsSync(env.UPLOAD_DIR)) {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(env.PROCESSED_DIR)) {
  fs.mkdirSync(env.PROCESSED_DIR, { recursive: true });
}
