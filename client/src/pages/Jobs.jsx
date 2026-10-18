import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Database,
  ArrowUpDown,
  CheckSquare,
  Square,
  GitCompare,
  PlusCircle,
  X
} from 'lucide-react';
import { useToast } from '../components/Toast';
import PageLoader from '../components/PageLoader';
import axios from 'axios';

export default function Jobs() {
  const { addToast } = useToast();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Compare Selection
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [isComparing, setIsComparing] = useState(false);

  useEffect(() => {
    loadJobs();
  }, [page, statusFilter, sortField, sortOrder]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/jobs', {
        params: { page, limit, search, status: statusFilter }
      });
      if (res.data?.success) {
        let list = res.data.jobs || [];
        // Sort client side
        list.sort((a, b) => {
          let valA = a[sortField] || '';
          let valB = b[sortField] || '';
          if (sortField === 'rows') {
            valA = a.summary?.processed_rows || 0;
            valB = b.summary?.processed_rows || 0;
          }
          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
        setJobs(list);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      addToast('Failed to load jobs repository', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadJobs();
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Are you sure you want to permanently delete job ${id}?`)) return;
    try {
      await axios.delete(`/api/jobs/${id}`);
      addToast(`Job ${id} deleted successfully.`, 'success');
      loadJobs();
    } catch (err) {
      addToast('Failed to delete job', 'error');
    }
  };

  const toggleSelectCompare = (job) => {
    if (selectedForCompare.find((j) => j.id === job.id)) {
      setSelectedForCompare(selectedForCompare.filter((j) => j.id !== job.id));
    } else {
      if (selectedForCompare.length >= 2) {
        addToast('You can compare a maximum of 2 jobs at once.', 'warning');
        return;
      }
      setSelectedForCompare([...selectedForCompare, job]);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-theme-card border border-theme-border shadow-xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-theme-text">Jobs Repository</h1>
          <p className="text-xs sm:text-sm text-theme-dim mt-1">
            Search, filter, inspect, and compare historical traffic anonymization executions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {selectedForCompare.length === 2 && (
            <button
              type="button"
              onClick={() => setIsComparing(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition-all"
            >
              <GitCompare className="w-4 h-4" />
              <span>Compare Selected (2)</span>
            </button>
          )}

          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Job</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-theme-card border border-theme-border flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-theme-dim absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by dataset filename or job ID..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-theme-secondary border border-theme-border text-xs text-theme-text placeholder-theme-dim focus:outline-none focus:border-cyan-400"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-theme-secondary text-xs font-semibold text-theme-text border border-theme-border hover:bg-theme-border transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-4 h-4 text-theme-dim" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-theme-secondary border border-theme-border text-xs text-theme-text focus:outline-none focus:border-cyan-400 font-mono"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PROCESSING">Processing</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          {/* Sort Field */}
          <div className="flex items-center gap-2 text-xs">
            <ArrowUpDown className="w-4 h-4 text-theme-dim" />
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="px-3 py-2 rounded-xl bg-theme-secondary border border-theme-border text-xs text-theme-text focus:outline-none focus:border-cyan-400 font-mono"
            >
              <option value="createdAt">Date Created</option>
              <option value="originalFilename">Filename</option>
              <option value="rows">Rows Processed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
        {loading ? (
          <PageLoader
            variant="card"
            title="Querying Jobs Repository"
            subtitle="Retrieving historical pipeline executions from MongoDB..."
            steps={[
              'Connecting to jobs collection...',
              'Loading privacy profiles and runtime metrics...',
              'Formatting audit records...'
            ]}
          />
        ) : jobs.length === 0 ? (
          <div className="text-center py-14 space-y-3">
            <p className="text-xs text-theme-muted">No jobs matching your filter criteria.</p>
            <Link to="/" className="inline-block px-4 py-2 rounded-xl bg-cyan-500 text-black text-xs font-bold">
              Run New Job
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-theme-border text-theme-dim uppercase text-[10px]">
                  <th className="pb-3 w-8">Compare</th>
                  <th className="pb-3 font-semibold">Job ID</th>
                  <th className="pb-3 font-semibold">Dataset Filename</th>
                  <th className="pb-3 font-semibold">Execution Status</th>
                  <th className="pb-3 font-semibold">Rows In / Out</th>
                  <th className="pb-3 font-semibold">PII Handled</th>
                  <th className="pb-3 font-semibold">Processed At</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border/50">
                {jobs.map((job) => {
                  const isChecked = selectedForCompare.some((j) => j.id === job.id);
                  return (
                    <tr key={job.id} className="hover:bg-theme-secondary/40 transition-colors">
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => toggleSelectCompare(job)}
                          className="text-theme-muted hover:text-cyan-400"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 font-bold text-theme-text">{job.id}</td>
                      <td className="py-3 text-theme-muted truncate max-w-xs">{job.originalFilename}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            job.status === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 text-theme-dim">
                        {job.summary?.original_rows ?? 0} &rarr; {job.summary?.processed_rows ?? 0}
                      </td>
                      <td className="py-3 text-purple-300">{job.summary?.pii_columns_detected ?? 0} cols</td>
                      <td className="py-3 text-theme-dim">
                        {new Date(job.createdAt).toLocaleDateString()}{' '}
                        {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 text-right space-x-2">
                        <Link
                          to={`/jobs/${job.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-theme-secondary text-cyan-300 border border-theme-border hover:bg-theme-border text-[11px]"
                        >
                          <span>Inspect</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(job.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 text-[11px]"
                          title="Delete Job"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-theme-border/60 text-xs font-mono text-theme-muted">
          <span>
            Showing page {page} of {totalPages} ({total} total jobs)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-2 rounded-lg bg-theme-secondary border border-theme-border disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-2 rounded-lg bg-theme-secondary border border-theme-border disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Compare Modal Drawer */}
      {isComparing && selectedForCompare.length === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-4xl p-6 rounded-2xl bg-theme-card border border-theme-border shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-theme-border pb-3">
              <h3 className="text-base font-bold text-theme-text flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-purple-400" />
                <span>Job Comparison: {selectedForCompare[0].id} vs {selectedForCompare[1].id}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsComparing(false)}
                className="p-1 rounded-lg hover:bg-theme-secondary text-theme-dim hover:text-theme-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {selectedForCompare.map((job, idx) => (
                <div key={job.id} className="p-4 rounded-xl bg-theme-secondary/40 border border-theme-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-cyan-400">{job.id}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        job.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <div className="text-xs space-y-1.5 font-mono">
                    <div className="text-theme-muted">File: {job.originalFilename}</div>
                    <div className="text-theme-muted">In / Out: {job.summary?.original_rows} &rarr; {job.summary?.processed_rows}</div>
                    <div className="text-theme-muted">Rejected: {job.summary?.rejected_rows_count ?? 0} rows</div>
                    <div className="text-theme-muted">PII Detected: {job.summary?.pii_columns_detected ?? 0} columns</div>
                    <div className="text-emerald-400 font-semibold">Checks: {job.summary?.quality_checks_passed}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsComparing(false)}
                className="px-5 py-2 rounded-xl bg-theme-secondary text-xs font-semibold text-theme-text border border-theme-border"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
