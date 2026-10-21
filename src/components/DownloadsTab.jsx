import React from 'react';
import { downloadFile } from '../utils/downloader';
import { useToast } from './Toast';

export default function DownloadsTab({ job }) {
  const { addToast } = useToast();
  if (!job) return null;

  const handleDownload = (format, type = 'row') => {
    const filename = type === 'aggregate'
      ? `aggregated.${format}`
      : `cleaned_${job.id}.${format}`;

    const fallbackData = type === 'aggregate'
      ? (job.aggregatedRecords || [])
      : (job.records || job.cleanedRecords || []);

    downloadFile({
      url: `/api/jobs/${job.id}/download?format=${format}&type=${type}`,
      filename,
      fallbackData,
      fallbackType: format,
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
              Standardized CSV with HMAC-SHA256 pseudonyms, 15-min temporal buckets, and removed direct PII.
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
              Structured JSON payload optimized for mobility APIs, GIS layers, and cloud data warehouses.
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
              <h4 style={{ color: '#10b981', marginBottom: '0.3rem' }}>Aggregated Dataset (k-anonymized)</h4>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                Hourly road segment statistics (counts, speeds, congestion, outliers). Zero microdata, k ≥ {job.config?.kThreshold ?? 3}.
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
