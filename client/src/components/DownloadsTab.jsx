import React from 'react';
import { trafficApi } from '../api/client';

export default function DownloadsTab({ job }) {
  if (!job) return null;

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
          <a
            href={trafficApi.downloadUrl(job.id, 'csv')}
            download
            className="btn-primary"
            style={{ width: '100%', textAlign: 'center' }}
          >
            Download CSV
          </a>
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
          <a
            href={trafficApi.downloadUrl(job.id, 'json')}
            download
            className="btn-primary"
            style={{ width: '100%', textAlign: 'center' }}
          >
            Download JSON
          </a>
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
          <a
            href={trafficApi.reportUrl(job.id, 'markdown')}
            download
            className="btn-secondary"
            style={{ width: '100%', textAlign: 'center' }}
          >
            Download Report (.md)
          </a>
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
            <a
              href={`/api/jobs/${job.id}/download?type=aggregate`}
              download
              className="btn-primary"
              style={{ width: '100%', textAlign: 'center', background: '#10b981', borderColor: '#10b981' }}
            >
              Download Aggregated CSV
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
