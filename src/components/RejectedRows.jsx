import React from 'react';

export default function RejectedRows({ rejectedRows = [] }) {
  return (
    <div className="glass-panel" style={{ padding: '1.75rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.15rem' }}>🚫 Rejected Records Reconciliation Audit</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Zero silent drops: Every discarded row is explicitly logged with an audited non-PII justification.
          </p>
        </div>
        <span className={`badge ${rejectedRows.length > 0 ? 'badge-warn' : 'badge-pass'}`}>
          {rejectedRows.length} Rejected
        </span>
      </div>

      {rejectedRows.length === 0 ? (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--accent-emerald)',
            background: 'rgba(16, 185, 129, 0.05)',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          ✓ 100% of input rows satisfied quality, schema, and timestamp integrity criteria.
        </div>
      ) : (
        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Row Index</th>
                <th style={{ width: '220px' }}>Rejection Reason</th>
                <th>Audit Justification (Zero PII)</th>
              </tr>
            </thead>
            <tbody>
              {rejectedRows.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    #{item.row_index}
                  </td>
                  <td>
                    <span className="badge badge-warn">{item.reason}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{item.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
