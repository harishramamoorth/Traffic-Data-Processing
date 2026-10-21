import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pythonProcessTimeoutMs = process.env.PYTHON_PROCESS_TIMEOUT_MS === undefined
  ? 5 * 60 * 1000
  : Number(process.env.PYTHON_PROCESS_TIMEOUT_MS);

if (!Number.isSafeInteger(pythonProcessTimeoutMs) || pythonProcessTimeoutMs <= 0) {
  throw new Error('PYTHON_PROCESS_TIMEOUT_MS must be a positive integer number of milliseconds.');
}

function resolvePythonPath() {
  if (process.env.PYTHON_PATH) {
    return process.env.PYTHON_PATH;
  }
  const venvLinux = path.resolve(__dirname, '../../../.venv/bin/python');
  if (fs.existsSync(venvLinux)) {
    return venvLinux;
  }
  const venvWindows = path.resolve(__dirname, '../../../.venv/Scripts/python.exe');
  if (fs.existsSync(venvWindows)) {
    return venvWindows;
  }
  const renderVenv = '/opt/render/project/src/.venv/bin/python';
  if (fs.existsSync(renderVenv)) {
    return renderVenv;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173',
  PYTHON_PATH: resolvePythonPath(),
  PYTHON_PROCESS_TIMEOUT_MS: pythonProcessTimeoutMs,
  HASH_SECRET: process.env.HASH_SECRET, // Strictly mandatory, zero fallback permitted
  UPLOAD_DIR: path.resolve(__dirname, '../../uploads'),
  PROCESSED_DIR: path.resolve(__dirname, '../../processed'),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/traffic_processor'
};

if (!env.HASH_SECRET || env.HASH_SECRET.trim().length < 32) {
  throw new Error(
    'SECURITY CRITICAL: HASH_SECRET environment variable is missing or shorter than 32 characters. ' +
    'Pseudonymization requires a verified >=32 character key. No insecure fallback is permitted.'
  );
}

// Ensure required staging directories exist
if (!fs.existsSync(env.UPLOAD_DIR)) {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(env.PROCESSED_DIR)) {
  fs.mkdirSync(env.PROCESSED_DIR, { recursive: true });
}
