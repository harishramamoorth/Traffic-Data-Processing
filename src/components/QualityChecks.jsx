import React from 'react';

export default function QualityChecks({ checks = [] }) {
  const passCount = checks.filter((c) => c.status === 'PASS').length;
  const warnCount = checks.filter((c) => c.status === 'WARN').length;
  const failCount = checks.filter((c) => c.status === 'FAIL').length;

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
          <h3 style={{ fontSize: '1.15rem' }}>✅ Quality & Privacy Compliance Audits</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Automated verification battery (QC-01 to QC-08) covering leakage, boundaries, and reconciliation.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <span className="badge badge-pass">{passCount} Pass</span>
          {warnCount > 0 && <span className="badge badge-warn">{warnCount} Warn</span>}
          {failCount > 0 && <span className="badge badge-fail">{failCount} Fail</span>}
        </div>
      </div>

      {checks.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-dim)' }}>
          No quality audit checks available.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {checks.map((check) => {
            const isPass = check.status === 'PASS';
            const isWarn = check.status === 'WARN';

            return (
              <div
                key={check.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  padding: '0.85rem 1.15rem',
                  background: isPass
                    ? 'rgba(16, 185, 129, 0.03)'
                    : isWarn
                    ? 'rgba(245, 158, 11, 0.03)'
                    : 'rgba(244, 63, 94, 0.05)',
                  border: `1px solid ${
                    isPass
                      ? 'rgba(16, 185, 129, 0.2)'
                      : isWarn
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(244, 63, 94, 0.3)'
                  }`,
                  borderRadius: 'var(--radius-sm)',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ flex: 1, minWidth: '260px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{check.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      [{check.id}]
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    {check.description}
                  </div>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: isPass ? 'var(--text-main)' : isWarn ? '#fbbf24' : '#fb7185',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    ↳ {check.details}
                  </div>
                </div>

                <div>
                  <span className={`badge ${isPass ? 'badge-pass' : isWarn ? 'badge-warn' : 'badge-fail'}`}>
                    {check.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
