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

const ALLOWED_EXTENSIONS = ['.csv', '.json'];
const ALLOWED_MIMES = [
  'text/csv',
  'application/json',
  'text/plain',
  'application/vnd.ms-excel',
  'application/octet-stream'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isExtValid = ALLOWED_EXTENSIONS.includes(ext);
  const isMimeValid = ALLOWED_MIMES.includes(file.mimetype);

  if (isExtValid && isMimeValid) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid upload file format. Expected a .csv or .json file (received ext: '${ext}', mime: '${file.mimetype}').`
      )
    );
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB maximum limit
  }
});
