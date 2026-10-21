import React from 'react';
import { downloadFile, getCleanedDownloadFilename } from '../utils/downloader';
import { useToast } from './Toast';

export default function DownloadsTab({ job }) {
  const { addToast } = useToast();
  if (!job) return null;

  const handleDownload = (format, type = 'row') => {
    const isAggregateJob = (job.config?.riskReductionMode || job.config?.risk_reduction_mode) === 'aggregate';
    const effectiveType = isAggregateJob ? 'aggregate' : type;
    const rawPresets = new Set(['raw_passthrough', 'data_only', 'no_privacy']);
    const isRawPreset = Boolean(job.config?.skipPrivacy || job.config?.skip_privacy) ||
      rawPresets.has(job.config?.activePreset) || rawPresets.has(job.config?.preset);
    const filename = getCleanedDownloadFilename(job.originalFilename, format, effectiveType === 'aggregate');

    const fallbackData = effectiveType === 'aggregate'
      ? (job.aggregatedRecords || [])
      : (job.records || job.cleanedRecords || []);

    downloadFile({
      url: `/api/jobs/${job.id}/download?format=${format}&type=${effectiveType}`,
      filename,
      fallbackData,
      fallbackType: format,
      formatCoordinates: format === 'csv' && !isRawPreset,
      onToast: addToast
    });
  };

  const handleDownloadReport = (format = 'markdown') => {
    const filename = `audit_report_${job.id}.${format === 'markdown' ? 'md' : 'json'}`;
    downloadFile({
      url: `/api/jobs/${job.id}/report?format=${format}`,
      filename,
      fallbackData: job,
      fallbackType: format === 'markdown' ? 'report_md' : 'report_json',
      onToast: addToast
    });
  };

  return (
    <div className="glass-panel" style={{ padding: '2rem' }}>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>📦 Artifacts & Export Center</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.75rem' }}>
        Export sanitized datasets and audit compliance reports for analytical use or governance review.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {/* Excel XLSX Export */}
        <div
          style={{
            padding: '1.5rem',
            background: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📑</div>
            <h4 style={{ color: '#fff', marginBottom: '0.3rem' }}>Excel Workbook (.xlsx)</h4>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              Excel workbook generated from this job's released dataset, using either sanitized rows or aggregates.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownload('xlsx', 'row')}
            className="btn-primary"
            style={{ width: '100%', textAlign: 'center', cursor: 'pointer', background: 'var(--emerald-500, #10b981)' }}
          >
            Download Excel (.xlsx)
          </button>
        </div>

        {/* CSV Export */}
        <div
          style={{
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
            <h4 style={{ color: '#fff', marginBottom: '0.3rem' }}>Cleaned CSV Dataset</h4>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              Standardized CSV containing the processed output for this job.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownload('csv', 'row')}
            className="btn-primary"
            style={{ width: '100%', textAlign: 'center', cursor: 'pointer' }}
          >
            Download CSV
          </button>
        </div>

        {/* JSON Export */}
        <div
          style={{
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📜</div>
            <h4 style={{ color: '#fff', marginBottom: '0.3rem' }}>Pseudonymized JSON</h4>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              Structured JSON containing the processed output for this job.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownload('json', 'row')}
            className="btn-primary"
            style={{ width: '100%', textAlign: 'center', cursor: 'pointer' }}
          >
            Download JSON
          </button>
        </div>

        {/* Markdown Audit Report */}
        <div
          style={{
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛡️</div>
            <h4 style={{ color: '#fff', marginBottom: '0.3rem' }}>Markdown Audit Report</h4>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              Complete compliance attestation with QC-01 to QC-08 assertions and rejection reconciliation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownloadReport('markdown')}
            className="btn-secondary"
            style={{ width: '100%', textAlign: 'center', cursor: 'pointer' }}
          >
            Download Report (.md)
          </button>
        </div>

        {/* Aggregated Dataset (k-anonymized) */}
        {(job.aggregatedRecords?.length > 0 || job.config?.riskReductionMode === 'aggregate') && (
          <div
            style={{
              padding: '1.5rem',
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📈</div>
              <h4 style={{ color: '#10b981', marginBottom: '0.3rem' }}>Aggregated Dataset (k-thresholded)</h4>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                Aggregate-only output with cells below k ≥ {job.config?.kThreshold ?? 3} withheld. No row-level records are released.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDownload('csv', 'aggregate')}
              className="btn-primary"
              style={{ width: '100%', textAlign: 'center', background: '#10b981', borderColor: '#10b981', cursor: 'pointer' }}
            >
              Download Aggregated CSV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
