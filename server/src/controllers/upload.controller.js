import fs from 'fs';
import path from 'path';
import { db } from '../config/db.js';
import { createJob } from '../models/Job.js';
import { runPythonProcessor, runPythonProfiler } from '../services/pythonRunner.js';
import { jobStreamService } from '../services/jobStreamService.js';
import { validateJobConfig } from '../schemas/jobConfig.schema.js';

export const uploadController = {
  /**
   * POST /api/jobs/profile
   * Pre-processing analysis only. Computes statistics in memory and deletes raw temp file immediately.
   */
  async profileUpload(req, res, next) {
    if (req.fileValidationError) {
      return res.status(400).json({ success: false, error: req.fileValidationError });
    }
    const isSample = req.body.sample === 'true' || req.body.sample === true || (!req.file && req.query.sample === 'true');
    if (!req.file && !isSample) {
      return res.status(400).json({ success: false, error: 'No dataset file provided for profiling.' });
    }

    const tempFilePath = req.file ? path.resolve(req.file.path) : null;
    const sheet = req.body.sheet || req.query.sheet || null;

    try {
      const profile = await runPythonProfiler(tempFilePath, isSample, sheet);
      return res.status(200).json({
        success: true,
        message: 'Dataset profiling complete.',
        profile
      });
    } catch (err) {
      console.error('[UploadController] Profiling error:', err.message);
      const isClientError = /password-protected|encrypted|unsupported file format|empty dataset|failed to read|invalid|corrupt|sheet|could not parse/i.test(err.message);
      return res.status(isClientError ? 400 : 500).json({
        success: false,
        error: isClientError ? err.message : `Profiling failed: ${err.message}`
      });
    } finally {
      // PRIVACY RULE: Delete raw temp file immediately in finally block
      if (tempFilePath) {
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            console.log(`[PrivacyAudit] Deleted raw profiling temporary file: ${tempFilePath}`);
          }
        } catch (cleanupErr) {
          console.error(`[PrivacyAudit] Warning: Failed to clean up temp profiling file '${tempFilePath}':`, cleanupErr.message);
        }
      }
    }
  },

  /**
   * POST /api/jobs/upload
   * Executes data cleaning, anonymization, and verification with dynamic config overrides and SSE log streaming.
   */
  async processUpload(req, res, next) {
    if (req.fileValidationError) {
      return res.status(400).json({ success: false, error: req.fileValidationError });
    }
    const isSample = req.body.sample === 'true' || req.body.sample === true || (!req.file && req.query.sample === 'true');
    if (!req.file && !isSample) {
      return res.status(400).json({ success: false, error: 'No dataset file provided.' });
    }

    const tempFilePath = req.file ? path.resolve(req.file.path) : null;
    const jobId = req.body.jobId || `job_${Date.now()}`;

    // Parse dynamic config if provided in form data
    let dynamicConfig = null;
    let rawConfig = {};
    if (req.body.config) {
      try {
        rawConfig = typeof req.body.config === 'string' ? JSON.parse(req.body.config) : req.body.config;
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: `Malformed config JSON: ${e.message}`
        });
      }
    }
    if (req.body.riskReductionMode) rawConfig.riskReductionMode = req.body.riskReductionMode;
    if (req.body.risk_reduction_mode) rawConfig.riskReductionMode = req.body.risk_reduction_mode;
    if (req.body.kThreshold !== undefined) rawConfig.kThreshold = req.body.kThreshold;
    if (req.body.k_threshold !== undefined) rawConfig.kThreshold = req.body.k_threshold;
    if (req.body.k !== undefined) rawConfig.kThreshold = req.body.k;

    if (Object.keys(rawConfig).length > 0) {
      const validation = validateJobConfig(rawConfig);
      if (!validation.success) {
        console.warn('[UploadController] Config validation warning:', validation.error.format());
        return res.status(400).json({
          success: false,
          error: 'Invalid job configuration schema.',
          details: validation.error.format()
        });
      }
      dynamicConfig = validation.data;
    }

    // Initialize SSE streaming session
    jobStreamService.createSession(jobId);
    jobStreamService.emit(jobId, 'stage', { stage: 'init', percent: 5, message: 'Initiating processing engine...' });

    const newJob = createJob({
      id: jobId,
      originalFilename: req.file ? req.file.originalname : 'sample_traffic_data.csv',
      fileSize: req.file ? req.file.size : 1200,
      config: dynamicConfig || {}
    });

    try {
      newJob.status = 'PROCESSING';
      await db.saveJob(newJob);

      // Run Python Processing Engine with real-time SSE progress callbacks
      const sheet = req.body.sheet || (dynamicConfig ? dynamicConfig.sheet : null);
      const processorOutput = await runPythonProcessor(
        tempFilePath,
        dynamicConfig,
        (progressEvent) => {
          if (progressEvent.type === 'stage') {
            jobStreamService.emit(jobId, 'stage', {
              stage: progressEvent.stage,
              percent: progressEvent.percent,
              message: progressEvent.message
            });
          } else if (progressEvent.type === 'log') {
            jobStreamService.emit(jobId, 'log', {
              text: progressEvent.message,
              timestamp: new Date().toISOString()
            });
          }
        },
        isSample,
        sheet
      );

      newJob.status = processorOutput.summary.overall_status === 'FAILED' ? 'FAILED' : 'COMPLETED';
      newJob.summary = processorOutput.summary;
      newJob.inspection = processorOutput.inspection;
      newJob.piiReport = processorOutput.pii_report;
      newJob.pii_columns = processorOutput.pii_columns || processorOutput.pii_report;
      newJob.qualityChecks = processorOutput.quality_checks;
      newJob.processingLogs = processorOutput.processing_logs;
      newJob.rejectedRows = processorOutput.rejected_rows || [];
      newJob.nullReport = processorOutput.null_report || {};
      newJob.duplicatesRemoved = processorOutput.duplicates_removed || 0;
      newJob.duplicatesRemovedRows = processorOutput.duplicates_removed_rows || [];
      newJob.kAnonymity = processorOutput.k_anonymity || null;
      newJob.suppressedRows = processorOutput.suppressed_rows || [];
      newJob.suppressedCount = processorOutput.suppressed_count || (processorOutput.suppressed_rows ? processorOutput.suppressed_rows.length : 0);
      newJob.aggregatedRecords = processorOutput.aggregated_records || [];
      newJob.complianceStatus = processorOutput.compliance_status || (processorOutput.k_anonymity?.risk_level === 'HIGH' ? 'PASSED_WITH_WARNINGS' : (processorOutput.summary?.overall_status === 'PASSED' ? 'COMPLIANCE_VERIFIED' : processorOutput.summary?.overall_status));
      newJob.complianceExplanation = processorOutput.compliance_explanation || null;
      newJob.privacyClaim = processorOutput.summary?.privacy_claim || processorOutput.privacy_claim || null;
      newJob.completedAt = new Date().toISOString();

      // Persist Job and Anonymized Records
      await Promise.all([
        db.saveJob(newJob),
        db.saveRecords(jobId, processorOutput.cleaned_records || [])
      ]);

      // Emit complete stage
      jobStreamService.emit(jobId, 'stage', { stage: 'complete', percent: 100, message: 'Processing complete!' });
      jobStreamService.emit(jobId, 'done', {
        status: newJob.status,
        summary: newJob.summary
      });
      jobStreamService.cleanup(jobId);

      // Return response: before_after_sample is provided ONLY in this volatile memory response!
      return res.status(200).json({
        success: true,
        message: 'Dataset processed, cleaned, and anonymized successfully.',
        job: newJob,
        // Memory-only sample for immediate comparison. Never saved to disk or MongoDB.
        before_after_sample: processorOutput.before_after_sample || null
      });
    } catch (procErr) {
      newJob.status = 'FAILED';
      let safeError = procErr.message || 'Processing failed';
      safeError = safeError.replace(/[A-Za-z]:\\[^\s"']+/g, '[INTERNAL_PATH]');
      safeError = safeError.replace(/\/(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]*/g, '[INTERNAL_PATH]');
      newJob.error = safeError;
      await db.saveJob(newJob);

      jobStreamService.emit(jobId, 'error', { message: safeError });
      jobStreamService.cleanup(jobId);
      next(new Error(safeError));
    } finally {
      // PRIVACY RULE: Delete raw uploaded temporary file immediately in finally block
      if (tempFilePath) {
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            console.log(`[PrivacyAudit] Deleted raw uploaded temporary file: ${tempFilePath}`);
          }
        } catch (cleanupErr) {
          console.error(`[PrivacyAudit] Warning: Failed to clean up temp file '${tempFilePath}':`, cleanupErr.message);
        }
      }
    }
  }
};
