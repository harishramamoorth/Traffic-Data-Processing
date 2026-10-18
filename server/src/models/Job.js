import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    originalFilename: { type: String, required: true },
    fileSize: { type: Number },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    summary: { type: mongoose.Schema.Types.Mixed, default: null },
    inspection: { type: mongoose.Schema.Types.Mixed, default: null },
    piiReport: { type: Array, default: [] },
    qualityChecks: { type: Array, default: [] },
    processingLogs: { type: [String], default: [] },
    rejectedRows: { type: Array, default: [] },
    nullReport: { type: mongoose.Schema.Types.Mixed, default: {} },
    duplicatesRemoved: { type: Number, default: 0 },
    kAnonymity: { type: mongoose.Schema.Types.Mixed, default: {} },
    suppressedRows: { type: Array, default: [] },
    suppressedCount: { type: Number, default: 0 },
    aggregatedRecords: { type: Array, default: [] },
    complianceStatus: { type: String, default: null },
    complianceExplanation: { type: String, default: null },
    error: { type: String, default: null },
    completedAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

export const JobModel = mongoose.models.Job || mongoose.model('Job', jobSchema);

/**
 * Job Model factory
 */
export function createJob({
  id,
  originalFilename,
  fileSize
}) {
  return {
    id,
    originalFilename,
    fileSize,
    status: 'PENDING',
    summary: null,
    inspection: null,
    piiReport: [],
    qualityChecks: [],
    processingLogs: [],
    rejectedRows: [],
    nullReport: {},
    duplicatesRemoved: 0,
    kAnonymity: {},
    suppressedRows: [],
    suppressedCount: 0,
    aggregatedRecords: [],
    complianceStatus: null,
    complianceExplanation: null,
    error: null,
    completedAt: null
  };
}
