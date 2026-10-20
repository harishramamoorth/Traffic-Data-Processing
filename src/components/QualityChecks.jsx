import React from 'react';

export default function QualityChecks({ checks = [] }) {
  const passCount = checks.filter((c) => c.status === 'PASS').length;
  const warnCount = checks.filter((c) => c.status === 'WARN').length;
  const failCount = checks.filter((c) => c.status === 'FAIL').length;
  const notAssessedCount = checks.filter((c) => c.status === 'NOT_ASSESSED' || c.status === 'NOT_RUN').length;

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
          <h3 style={{ fontSize: '1.15rem' }}>Quality &amp; Privacy Audits</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Automated verification battery (QC-01 to QC-09) covering leakage, boundaries, and reconciliation.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span className="badge badge-pass">{passCount} Pass</span>
          {warnCount > 0 && <span className="badge badge-warn">{warnCount} Warn</span>}
          {failCount > 0 && <span className="badge badge-fail">{failCount} Fail</span>}
          {notAssessedCount > 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">
              {notAssessedCount} Not assessed
            </span>
          )}
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
            const isNotAssessed = check.status === 'NOT_ASSESSED' || check.status === 'NOT_RUN';

            return (
              <div
                key={check.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  padding: '0.85rem 1.15rem',
                  background: isNotAssessed
                    ? 'rgba(148, 163, 184, 0.04)'
                    : isPass
                    ? 'rgba(16, 185, 129, 0.03)'
                    : isWarn
                    ? 'rgba(245, 158, 11, 0.03)'
                    : 'rgba(244, 63, 94, 0.05)',
                  border: `1px solid ${
                    isNotAssessed
                      ? 'rgba(148, 163, 184, 0.2)'
                      : isPass
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
                    <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>{check.name}</span>
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
                      color: isNotAssessed ? 'var(--text-dim)' : isPass ? 'var(--text-main)' : isWarn ? '#fbbf24' : '#fb7185',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    ↳ {check.details}
                  </div>
                </div>

                <div>
                  <span
                    className={`badge ${
                      isNotAssessed
                        ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                        : isPass
                        ? 'badge-pass'
                        : isWarn
                        ? 'badge-warn'
                        : 'badge-fail'
                    }`}
                  >
                    {isNotAssessed ? 'Not assessed' : check.status}
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
