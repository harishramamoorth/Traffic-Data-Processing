import React, { useState } from 'react';

export default function DataPreview({ beforeData = [], afterData = [] }) {
  const [viewMode, setViewMode] = useState('after'); // 'before' | 'after'

  const hasBefore = beforeData && beforeData.length > 0;
  const currentData = viewMode === 'before' ? beforeData : afterData;
  const columns = currentData && currentData.length > 0 ? Object.keys(currentData[0]) : [];

  return (
    <div className="glass-panel" style={{ padding: '1.75rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.15rem' }}>🔍 Dataset Preview (Before vs. After)</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Compare raw ingested values against sanitized and pseudonymized outputs.
          </p>
        </div>

        {hasBefore ? (
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              background: 'rgba(0,0,0,0.3)',
              padding: '0.25rem',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <button
              className={`nav-btn ${viewMode === 'before' ? 'active' : ''}`}
              onClick={() => setViewMode('before')}
            >
              Original ({beforeData.length})
            </button>
            <button
              className={`nav-btn ${viewMode === 'after' ? 'active' : ''}`}
              onClick={() => setViewMode('after')}
            >
              Pseudonymized ({afterData.length})
            </button>
          </div>
        ) : (
          <span className="badge badge-info">Current Session Only</span>
        )}
      </div>

      {!hasBefore ? (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            background: 'rgba(6, 182, 212, 0.05)',
            border: '1px solid rgba(6, 182, 212, 0.2)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)'
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛡️</div>
          <h4 style={{ color: '#fff', marginBottom: '0.4rem' }}>Zero-Retention Privacy Policy Active</h4>
          <p style={{ maxWidth: '650px', margin: '0 auto', fontSize: '0.88rem', lineHeight: '1.6' }}>
            In accordance with strict privacy engineering, raw identifying data is held exclusively in memory
            for the active upload session. Raw records are deleted immediately post-processing and never
            persisted to database or disk. To explore all pseudonymized records, please switch to the <strong>Records</strong> tab.
          </p>
        </div>
      ) : currentData.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
          No records to display.
        </div>
      ) : (
        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentData.map((row, idx) => (
                <tr key={idx}>
                  {columns.map((col) => {
                    const val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
                    const isPseudonym = val.startsWith('ANON_');
                    const isRedacted = val.includes('[REDACTED_');
                    const isFlag = col.includes('flag') && (val === 'true' || val === '1');

                    return (
                      <td key={col}>
                        {isPseudonym ? (
                          <span className="badge badge-info">{val}</span>
                        ) : isRedacted ? (
                          <span className="badge badge-warn">{val}</span>
                        ) : isFlag ? (
                          <span className="badge badge-fail">Outlier</span>
                        ) : (
                          val
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
