import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronLeft,
  Copy,
  Check,
  RotateCcw,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import Step5Results from '../components/wizard/Step5Results';
import axios from 'axios';

export default function JobDetails() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const completeJob = useWorkflowStore((s) => s.completeJob);
  const activeJob = useWorkflowStore((s) => s.activeJob);

  const fetchJob = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`/api/jobs/${id}`);
      if (res.data?.job) {
        completeJob(res.data.job, null);
      } else {
        setError('Job not found');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [id, completeJob]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const handleCopyId = () => {
    if (!id) return;
    navigator.clipboard?.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <div className="w-7 h-7 rounded-full border-2 border-theme-border border-t-indigo-500 animate-spin" />
        <div className="text-center">
          <p className="text-sm font-medium text-theme-text">Loading job details</p>
          <p className="text-xs font-mono text-theme-dim mt-0.5">{id}</p>
        </div>
      </div>
    );
  }

  if (error || !activeJob) {
    return (
      <div className="p-8 rounded-xl bg-theme-card border border-theme-border text-center space-y-4 max-w-md mx-auto my-12 shadow-sm">
        <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-theme-text">Job Not Found</h3>
          <p className="text-xs text-theme-muted">
            The requested job <span className="font-mono text-theme-text font-medium">{id}</span> was not found or has been removed.
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={fetchJob}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme-border text-xs text-theme-muted hover:text-theme-text transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry
          </button>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
          >
            All jobs
          </Link>
        </div>
      </div>
    );
  }

  const isPass = activeJob.status === 'COMPLETED' || activeJob.status === 'PASSED';
  const isWarn = activeJob.status === 'PASSED_WITH_WARNINGS';
  const risk = String(
    activeJob.summary?.re_identification_risk ||
    activeJob.kAnonymity?.risk_level ||
    activeJob.kAnonymity?.risk_badge ||
    'N/A'
  ).toUpperCase();
  const createdDate = activeJob.createdAt
    ? new Date(activeJob.createdAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : null;

  return (
    <div className="space-y-5 pb-16">
      {/* Minimal Top Header */}
      <div className="rounded-xl border border-theme-border bg-theme-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Breadcrumb & Title */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-theme-dim">
              <Link
                to="/jobs"
                className="inline-flex items-center gap-1 hover:text-theme-text transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Jobs</span>
              </Link>
              <span>/</span>
              <span className="font-mono text-[11px] text-theme-muted truncate max-w-[140px] sm:max-w-none">
                {id}
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                title="Copy job ID"
                className="p-1 rounded hover:bg-theme-secondary text-theme-dim hover:text-theme-text transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-theme-text tracking-tight flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-500 shrink-0" />
                <span className="truncate max-w-[280px] sm:max-w-md">
                  {activeJob.originalFilename || 'Dataset Details'}
                </span>
              </h1>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                  isPass
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : isWarn
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                }`}
              >
                {isPass ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : isWarn ? (
                  <AlertTriangle className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                {isPass ? 'Passed' : isWarn ? 'Warnings' : 'Failed'}
              </span>

              {/* Risk Level Badge */}
              {risk !== 'N/A' && (
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    risk === 'LOW'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                      : risk === 'MEDIUM'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                  }`}
                >
                  {risk} Risk
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions / Date */}
          <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-theme-border">
            {createdDate && (
              <span className="text-[11px] text-theme-dim">{createdDate}</span>
            )}
            <button
              type="button"
              onClick={fetchJob}
              title="Refresh job data"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-theme-border text-xs text-theme-muted hover:text-theme-text transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Step 5 Results Dashboard */}
      <Step5Results />
    </div>
  );
}
