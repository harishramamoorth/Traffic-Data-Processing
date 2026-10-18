import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { uploadController } from '../controllers/upload.controller.js';
import { jobsController } from '../controllers/jobs.controller.js';
import {
  validateQuery,
  validateParams,
  jobQuerySchema,
  recordsQuerySchema,
  idParamSchema
} from '../middleware/validate.js';

const router = Router();

// POST /api/jobs/profile (Pre-processing analysis only, in-memory, temp file deleted in finally)
router.post('/profile', upload.single('file'), uploadController.profileUpload);

// POST /api/jobs/upload (Applies custom JSON config, streams progress, zero raw data persisted)
router.post('/upload', upload.single('file'), uploadController.processUpload);

// GET /api/jobs (paginated, search, status filter)
router.get('/', validateQuery(jobQuerySchema), jobsController.getAllJobs);

// GET /api/jobs/:id
router.get('/:id', validateParams(idParamSchema), jobsController.getJobById);

// GET /api/jobs/:id/stream (SSE for real-time progress and logs)
router.get('/:id/stream', jobsController.streamJob);

// GET /api/jobs/:id/analytics (Pre-aggregated Recharts data)
router.get('/:id/analytics', validateParams(idParamSchema), jobsController.getJobAnalytics);

// GET /api/jobs/:id/records (paginated anonymized records)
router.get(
  '/:id/records',
  validateParams(idParamSchema),
  validateQuery(recordsQuerySchema),
  jobsController.getJobRecords
);

// GET /api/jobs/:id/download?format=csv|json
router.get('/:id/download', validateParams(idParamSchema), jobsController.downloadRecords);

// GET /api/jobs/:id/aggregated.csv (direct download route)
router.get('/:id/aggregated.csv', validateParams(idParamSchema), (req, res, next) => {
  req.query.type = 'aggregate';
  req.query.format = 'csv';
  return jobsController.downloadRecords(req, res, next);
});

// GET /api/jobs/:id/report?format=markdown|json
router.get('/:id/report', validateParams(idParamSchema), jobsController.getJobReport);

// DELETE /api/jobs/:id
router.delete('/:id', validateParams(idParamSchema), jobsController.deleteJob);

export default router;
