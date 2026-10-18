import React, { useState, useEffect } from 'react';
import { trafficApi } from '../api/client';

export default function RecordsTable({ jobId }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState('');
  const [sortCol, setSortCol] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(() => {
    if (jobId) {
      loadRecords();
    }
  }, [jobId, page, sortCol, sortOrder]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await trafficApi.getJobRecords(jobId, {
        page,
        limit,
        sort: sortCol,
        order: sortOrder,
        filter
      });
      if (data.success) {
        setRecords(data.records || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch records:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadRecords();
  };

  const toggleSort = (col) => {
    if (sortCol === col) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortOrder('asc');
    }
  };

  const columns = records.length > 0 ? Object.keys(records[0]) : [];

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
          <h3 style={{ fontSize: '1.15rem' }}>🗃️ Anonymized Records Repository</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Paginated database records stored in MongoDB ({total} total rows).
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search record ID or plate..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: '220px' }}
          />
          <button type="submit" className="btn-secondary">
            Filter
          </button>
        </form>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: '0.5rem', padding: '1rem 0' }}>
          <div className="skeleton" style={{ height: '40px', width: '100%' }} />
          <div className="skeleton" style={{ height: '40px', width: '100%' }} />
          <div className="skeleton" style={{ height: '40px', width: '100%' }} />
        </div>
      ) : records.length === 0 ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-dim)' }}>
          No anonymized records match the specified query.
        </div>
      ) : (
        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    onClick={() => toggleSort(col)}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    {col} {sortCol === col ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((row, idx) => (
                <tr key={idx}>
                  {columns.map((col) => {
                    const val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
                    const isPseudonym = val.startsWith('ANON_');
                    const isFlag = col.includes('flag') && (val === 'true' || val === '1');

                    return (
                      <td key={col}>
                        {isPseudonym ? (
                          <span className="badge badge-info">{val}</span>
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

      {/* Pagination Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '1.25rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} records)
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="nav-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Previous
          </button>
          <button
            className="nav-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
