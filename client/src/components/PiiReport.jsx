import React from 'react';

export default function PiiReport({ piiList = [] }) {
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
          <h3 style={{ fontSize: '1.15rem' }}>🛡️ Detected Sensitive Columns (PII)</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Automated detection using regex signatures and heuristic classification.
          </p>
        </div>
        <span className={`badge ${piiList.length > 0 ? 'badge-warn' : 'badge-pass'}`}>
          {piiList.length} Flagged
        </span>
      </div>

      {piiList.length === 0 ? (
        <div
          style={{
            padding: '1.5rem',
            textAlign: 'center',
            color: 'var(--accent-emerald)',
            background: 'rgba(16, 185, 129, 0.05)',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          ✓ No personal identifiers detected in this dataset.
        </div>
      ) : (
        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Column Name</th>
                <th>Classification</th>
                <th>Confidence</th>
                <th>Enforced Action</th>
              </tr>
            </thead>
            <tbody>
              {piiList.map((item, idx) => {
                const action = item.recommended_action || 'MASK';
                const isDrop = action === 'DROP_COLUMN';
                const isHmac = action === 'PSEUDONYMIZE_HMAC';

                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{item.column}</td>
                    <td>
                      <span className="badge badge-warn">{item.category}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          item.confidence === 'CRITICAL'
                            ? 'badge-fail'
                            : item.confidence === 'HIGH'
                            ? 'badge-warn'
                            : 'badge-info'
                        }`}
                      >
                        {item.confidence}
                      </span>
                    </td>
                    <td>
                      <code
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.82rem',
                          color: isDrop ? 'var(--accent-rose)' : isHmac ? 'var(--accent-cyan)' : 'var(--accent-emerald)',
                          background: 'rgba(255, 255, 255, 0.04)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px'
                        }}
                      >
                        {action}
                      </code>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
