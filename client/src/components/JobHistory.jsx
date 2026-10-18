import React from 'react';
import { Link } from 'react-router-dom';

export default function JobHistory({ jobs = [], onDeleteJob }) {
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
          <h3 style={{ fontSize: '1.15rem' }}>📜 Pipeline Execution History</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Previous data processing and anonymization executions.
          </p>
        </div>
        <Link to="/jobs" className="btn-secondary" style={{ fontSize: '0.82rem', padding: '0.4rem 0.8rem' }}>
          View All ({jobs.length}) →
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-dim)' }}>
          No previous processing jobs recorded. Upload a dataset to begin.
        </div>
      ) : (
        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>File Name</th>
                <th>Records</th>
                <th>Rejections</th>
                <th>Status</th>
                <th>Executed At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.slice(0, 5).map((job) => {
                const status = job.summary?.overall_status || job.status;
                const isPass = status === 'PASSED' || status === 'COMPLETED';
                const isWarn = status === 'PASSED_WITH_WARNINGS';

                return (
                  <tr key={job.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      <Link to={`/jobs/${job.id}`} style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                        {job.id}
                      </Link>
                    </td>
                    <td style={{ fontWeight: 500 }}>{job.originalFilename}</td>
                    <td>{job.summary?.processed_rows ?? '—'}</td>
                    <td>
                      {job.rejectedRows?.length > 0 ? (
                        <span className="badge badge-warn">{job.rejectedRows.length}</span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td>
                      <span className={`badge ${isPass ? 'badge-pass' : isWarn ? 'badge-warn' : 'badge-fail'}`}>
                        {status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link
                          to={`/jobs/${job.id}`}
                          className="nav-btn"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        >
                          View
                        </Link>
                        {onDeleteJob && (
                          <button
                            className="nav-btn"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#fb7185' }}
                            onClick={() => onDeleteJob(job.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
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
