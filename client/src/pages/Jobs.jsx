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
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { useToast } from '../components/Toast';
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
      addToast('Failed to load jobs', 'error');
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
    if (!window.confirm(`Delete job ${id}?`)) return;
    try {
      await axios.delete(`/api/jobs/${id}`);
      addToast(`Job ${id} deleted.`, 'success');
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
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-xl bg-theme-card border border-theme-border">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-theme-text tracking-tight">Jobs</h1>
          </div>
          <p className="text-xs text-theme-muted mt-1">
            Browse and inspect historical dataset privacy runs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {selectedForCompare.length === 2 && (
            <button
              type="button"
              onClick={() => setIsComparing(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Compare (2)</span>
            </button>
          )}

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Job</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-theme-card border border-theme-border flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-theme-dim absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename or ID..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-theme-secondary/40 border border-theme-border text-xs text-theme-text placeholder-theme-dim focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-theme-secondary/60 text-xs font-medium text-theme-text border border-theme-border hover:bg-theme-secondary transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-theme-dim" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-theme-secondary/40 border border-theme-border text-xs text-theme-text focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PROCESSING">Processing</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          {/* Sort Field */}
          <div className="flex items-center gap-1.5 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-theme-dim" />
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-theme-secondary/40 border border-theme-border text-xs text-theme-text focus:outline-none focus:border-indigo-500"
            >
              <option value="createdAt">Date Created</option>
              <option value="originalFilename">Filename</option>
              <option value="rows">Rows Processed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="p-5 rounded-xl bg-theme-card border border-theme-border space-y-4">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-2">
            <div className="w-6 h-6 rounded-full border-2 border-theme-border border-t-indigo-500 animate-spin" />
            <span className="text-xs text-theme-dim">Loading jobs...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <FileSpreadsheet className="w-8 h-8 text-theme-dim/30 mx-auto" />
            <p className="text-xs text-theme-muted">No jobs matching your filter criteria.</p>
            <Link
              to="/"
              className="inline-block px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              Run New Job
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-left text-xs min-w-[620px]">
              <thead>
                <tr className="border-b border-theme-border text-theme-dim uppercase text-[10px] tracking-wider">
                  <th className="pb-2.5 w-8"></th>
                  <th className="pb-2.5 font-medium">Dataset</th>
                  <th className="pb-2.5 font-medium">Status</th>
                  <th className="pb-2.5 font-medium">Risk</th>
                  <th className="pb-2.5 font-medium">Rows In &rarr; Out</th>
                  <th className="pb-2.5 font-medium">Date</th>
                  <th className="pb-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border/40">
                {jobs.map((job) => {
                  const isChecked = selectedForCompare.some((j) => j.id === job.id);
                  const isPass = job.status === 'COMPLETED' || job.status === 'PASSED';
                  const isWarn = job.status === 'PASSED_WITH_WARNINGS';
                  const risk = String(
                    job.summary?.re_identification_risk ||
                    job.kAnonymity?.risk_level ||
                    job.kAnonymity?.risk_badge ||
                    'N/A'
                  ).toUpperCase();

                  return (
                    <tr key={job.id} className="hover:bg-theme-secondary/20 transition-colors">
                      <td className="py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSelectCompare(job)}
                          className="text-theme-muted hover:text-indigo-500 transition-colors cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-indigo-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-theme-text truncate max-w-[180px]" title={job.originalFilename}>
                          {job.originalFilename || 'Dataset'}
                        </div>
                        <span className="text-[10px] text-theme-dim font-mono">{job.id}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isPass
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                              : isWarn
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                          }`}
                        >
                          {isPass ? <CheckCircle2 className="w-3 h-3" /> : isWarn ? <AlertTriangle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {isPass ? 'Passed' : isWarn ? 'Warnings' : 'Failed'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            risk === 'LOW'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                              : risk === 'MEDIUM'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                              : risk === 'HIGH'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                              : 'bg-theme-secondary text-theme-muted'
                          }`}
                        >
                          {risk}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-theme-dim whitespace-nowrap">
                        {job.summary?.original_rows ?? 0} &rarr; <span className="text-indigo-500 font-semibold">{job.summary?.processed_rows ?? 0}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-theme-dim whitespace-nowrap">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 text-right space-x-1.5 whitespace-nowrap">
                        <Link
                          to={`/jobs/${job.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-theme-border text-[11px] text-theme-muted hover:text-theme-text transition-colors"
                        >
                          <span>Inspect</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(job.id)}
                          className="inline-flex items-center p-1 rounded-md border border-theme-border text-theme-dim hover:text-rose-500 hover:border-rose-500/30 transition-colors cursor-pointer"
                          title="Delete Job"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
        <div className="flex items-center justify-between pt-3 border-t border-theme-border text-xs text-theme-dim">
          <span>
            Page {page} of {totalPages} ({total} jobs)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-md border border-theme-border hover:bg-theme-secondary disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-md border border-theme-border hover:bg-theme-secondary disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Compare Modal Drawer */}
      {isComparing && selectedForCompare.length === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl p-5 rounded-xl bg-theme-card border border-theme-border shadow-xl space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-theme-border pb-3">
              <h3 className="text-sm font-semibold text-theme-text flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-indigo-500" />
                <span>Job Comparison</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsComparing(false)}
                className="p-1 rounded-md hover:bg-theme-secondary text-theme-dim hover:text-theme-text transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedForCompare.map((job) => (
                <div key={job.id} className="p-3.5 rounded-lg bg-theme-secondary/30 border border-theme-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-theme-text">{job.id}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        job.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 font-mono text-theme-muted">
                    <div>File: <span className="text-theme-text">{job.originalFilename}</span></div>
                    <div>Rows: {job.summary?.original_rows} &rarr; <span className="text-indigo-500">{job.summary?.processed_rows}</span></div>
                    <div>Rejected: {job.summary?.rejected_rows_count ?? 0}</div>
                    <div>PII Columns: {job.summary?.pii_columns_detected ?? 0}</div>
                    <div>Checks: {job.summary?.quality_checks_passed}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsComparing(false)}
                className="px-4 py-1.5 rounded-lg bg-theme-secondary text-xs font-medium text-theme-text border border-theme-border hover:bg-theme-secondary/80 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

