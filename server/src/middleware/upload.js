import multer from 'multer';
import path from 'path';
import { env } from '../config/env.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, env.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.csv';
    cb(null, `traffic-temp-${uniqueSuffix}${ext}`);
  }
});

const ALLOWED_EXTENSIONS = ['.csv', '.tsv', '.txt', '.json', '.xlsx', '.xls'];
const ALLOWED_MIMES = [
  'text/csv',
  'text/tab-separated-values',
  'text/plain',
  'application/json',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  'application/x-zip-compressed'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isExtValid = ALLOWED_EXTENSIONS.includes(ext);

  if (isExtValid) {
    cb(null, true);
  } else {
    req.fileValidationError = `Invalid upload file format. Expected a .csv, .tsv, .txt, .json, .xlsx, or .xls file (received ext: '${ext}').`;
    cb(null, false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB maximum limit
  }
});
