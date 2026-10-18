import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { uploadController } from '../controllers/upload.controller.js';

const router = Router();

router.post('/', upload.single('file'), uploadController.processUpload);

export default router;
