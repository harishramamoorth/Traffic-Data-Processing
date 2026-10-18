import mongoose from 'mongoose';

const recordSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    jobId: { type: String, required: true, index: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient paginated retrieval by job
recordSchema.index({ jobId: 1, createdAt: 1 });

export const RecordModel = mongoose.models.Record || mongoose.model('Record', recordSchema);

/**
 * Record Model factory
 */
export function createRecord({
  id,
  jobId,
  data
}) {
  return {
    id,
    jobId,
    data,
    createdAt: new Date().toISOString()
  };
}
