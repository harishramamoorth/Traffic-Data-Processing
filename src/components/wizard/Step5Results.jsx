import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
  Shield,
  BarChart3,
  Columns,
  Table,
  Terminal,
  RotateCcw,
  Layers,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gauge,
  MapPin,
  SlidersHorizontal,
  X,
  FileText,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { useToast } from '../Toast';
import PageLoader from '../PageLoader';
import axios from 'axios';

export default function Step5Results() {
  const { addToast } = useToast();
  const activeJob = useWorkflowStore((s) => s.activeJob);
  const sessionSample = useWorkflowStore((s) => s.sessionSample);
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);
  const setStep = useWorkflowStore((s) => s.setStep);

  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const tabsContainerRef = React.useRef(null);

  // Split Divider State for Before/After
  const [splitPos, setSplitPos] = useState(50); // percentage

  // Paginated records state
  const [records, setRecords] = useState([]);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsTotalPages, setRecordsTotalPages] = useState(1);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const jobId = activeJob?.id;

  // Fire confetti-lite on PASSED
  useEffect(() => {
    if (activeJob?.status === 'COMPLETED' || activeJob?.summary?.overall_status === 'PASSED') {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#06b6d4', '#10b981', '#3b82f6', '#ec4899']
        });
      } catch {}
    }
  }, [activeJob]);

  // Fetch pre-aggregated analytics from backend
  useEffect(() => {
    if (!jobId) return;
    setLoadingAnalytics(true);
    axios
      .get(`/api/jobs/${jobId}/analytics`)
      .then((res) => {
        if (res.data?.analytics) {
          setAnalytics(res.data.analytics);
        }
      })
      .catch((err) => {
        console.warn('Could not load job analytics:', err.message);
      })
      .finally(() => setLoadingAnalytics(false));
  }, [jobId]);

  // Fetch paginated records when on 'records' tab
  useEffect(() => {
    if (!jobId || activeTab !== 'records') return;
    setRecordsLoading(true);
    axios
      .get(`/api/jobs/${jobId}/records?page=${recordsPage}&limit=10`)
      .then((res) => {
        if (res.data?.records) {
          setRecords(res.data.records);
          setRecordsTotalPages(res.data.totalPages || 1);
        }
      })
      .catch((err) => console.warn('Could not load records:', err.message))
      .finally(() => setRecordsLoading(false));
  }, [jobId, activeTab, recordsPage]);

  if (!activeJob) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-theme-muted">No completed job available in this session.</p>
        <button
          onClick={() => setStep(1)}
          className="px-4 py-2 rounded-lg bg-cyan-500 text-black font-semibold text-xs"
        >
          Start New Job
        </button>
      </div>
    );
  }

  const {
    summary = {},
    qualityChecks = [],
    piiReport = [],
    rejectedRows = [],
    processingLogs = [],
    originalFilename,
    completedAt
  } = activeJob;

  // Row Accounting Modal State ('input' | 'output' | 'rejected' | 'duplicates' | null)
  const [accountingModal, setAccountingModal] = useState(null);

  // Status rules: all QC PASS and risk !== HIGH -> PASSED; any WARN or risk === HIGH/MEDIUM -> PASSED_WITH_WARNINGS; any FAIL -> FAILED.
  // Never show "COMPLIANCE VERIFIED" while risk is High.
  const rawStatus = summary.overall_status || (
    qualityChecks.some((q) => q.status === 'FAIL')
      ? 'FAILED'
      : qualityChecks.some((q) => q.status === 'WARN' || q.status === 'WARNING')
      ? 'PASSED_WITH_WARNINGS'
      : 'PASSED'
  );

  // Honest Privacy Claim and k-Anonymity
  const kAnon = activeJob.kAnonymity || summary.k_anonymity || {};
  const reIdRiskLevel = String(summary.re_identification_risk || kAnon.risk_badge || kAnon.risk_level || 'LOW').toUpperCase();
  const honestPrivacyClaim = activeJob.privacyClaim || summary.privacy_claim || `No direct identifiers detected; re-identification risk: ${reIdRiskLevel}`;

  // If risk is High, never call it compliance verified; force PASSED_WITH_WARNINGS
  const overallStatus = (reIdRiskLevel === 'HIGH' && rawStatus === 'PASSED') ? 'PASSED_WITH_WARNINGS' : rawStatus;

  const isAllPassed = overallStatus === 'PASSED' && reIdRiskLevel !== 'HIGH';
  const isWarn = overallStatus === 'PASSED_WITH_WARNINGS' || reIdRiskLevel === 'HIGH' || reIdRiskLevel === 'MEDIUM';
  const isFail = overallStatus === 'FAILED';
  const nonPassingChecks = qualityChecks.filter((q) => q.status !== 'PASS');

  // Group size distribution list
  const distributionList = useMemo(() => {
    if (kAnon.group_size_distribution && Array.isArray(kAnon.group_size_distribution) && kAnon.group_size_distribution.length > 0) {
      return kAnon.group_size_distribution;
    }
    const total = summary.processed_rows || 1;
    const u = kAnon.unique_rows || 0;
    const lowK = kAnon.low_k_row_count || 0;
    const pairs = Math.max(0, lowK - u);
    const prot = Math.max(0, total - lowK);
    return [
      { bucket: 'k=1', label: 'Unique (k=1)', count: u, percent: Math.round((u / total) * 100) },
      { bucket: 'k=2', label: 'Pairs (k=2)', count: pairs, percent: Math.round((pairs / total) * 100) },
      { bucket: 'k=3-4', label: 'Small (k=3-4)', count: 0, percent: 0 },
      { bucket: 'k=5+', label: 'Protected (k=5+)', count: prot, percent: Math.round((prot / total) * 100) }
    ];
  }, [kAnon, summary.processed_rows]);

  const groupSizeChartData = useMemo(() => {
    const colorMap = {
      'k=1': '#ef4444',
      'k=2': '#f59e0b',
      'k=3-4': '#38bdf8',
      'k=5+': '#10b981'
    };
    return distributionList.map((item) => ({
      ...item,
      color: colorMap[item.bucket] || '#38bdf8'
    }));
  }, [distributionList]);

  const hasAggregated = Boolean(
    (activeJob.aggregatedRecords && activeJob.aggregatedRecords.length > 0) ||
    (summary.aggregated_cells_count > 0)
  );

  // Download Trigger
  const handleDownload = (format, type = 'row') => {
    addToast(`Starting download: ${type === 'aggregate' ? 'Aggregated' : 'Cleaned'} dataset (.${format.toUpperCase()})...`, 'info');
    const a = document.createElement('a');
    a.href = `/api/jobs/${jobId}/download?format=${format}&type=${type}`;
    a.download = type === 'aggregate' ? `aggregated_${jobId}.${format}` : `cleaned_${jobId}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadReport = (format = 'markdown') => {
    addToast(`Downloading Compliance Audit Report (.${format === 'markdown' ? 'md' : 'json'})...`, 'info');
    const a = document.createElement('a');
    a.href = `/api/jobs/${jobId}/report?format=${format}`;
    a.download = `audit_report_${jobId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadConfig = () => {
    addToast('Downloading Pipeline Configuration (.json)...', 'info');
    const configData = {
      jobId,
      processedAt: completedAt,
      summary,
      rules: activeJob.config || {}
    };
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-config-${jobId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const nullReport = activeJob.nullReport || activeJob.summary?.null_report || {};
  const nullEntries = useMemo(() => {
    if (nullReport && Object.keys(nullReport).length > 0) {
      return Object.entries(nullReport).map(([col, data]) => ({
        column: col,
        nullCount: data.null_count ?? 0,
        nullPct: data.null_pct ?? 0,
        totalRows: data.total_rows ?? summary.processed_rows ?? 0
      }));
    }
    if (analytics?.nullDistribution && analytics.nullDistribution.length > 0) {
      return analytics.nullDistribution.map((d) => ({
        column: d.column,
        nullCount: Math.round(((d.afterNullPct || 0) / 100) * (summary.processed_rows || 1)),
        nullPct: d.afterNullPct || 0,
        totalRows: summary.processed_rows || 0
      }));
    }
    return [];
  }, [nullReport, analytics, summary.processed_rows]);

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'downloads', label: 'Downloads' },
    { id: 'k_anonymity', label: `Re-ID Risk (${reIdRiskLevel})` },
    { id: 'data_quality', label: `Data Quality & Nulls (${nullEntries.length})` },
    { id: 'charts', label: 'Analytics Charts' },
    { id: 'before_after', label: 'Before vs After (Session Only)' },
    { id: 'pii_report', label: `PII Report (${piiReport.length})` },
    { id: 'quality_checks', label: `Quality Checks (${qualityChecks.length})` },
    { id: 'rejected_rows', label: `Rejected Rows (${rejectedRows.length})` },
    { id: 'records', label: 'Sanitized Records' },
    { id: 'audit_log', label: 'Audit Log' }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-24">
      {/* Top Banner / Hero Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-theme-card via-theme-secondary/50 to-theme-card border border-theme-border shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {/* Status Rules: all PASS -> PASSED; any WARN -> PASSED_WITH_WARNINGS; any FAIL -> FAILED */}
            {/* Requirement 2: Do not call the result "compliance verified" while risk is High; use PASSED_WITH_WARNINGS and explain why */}
            {isAllPassed && (
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                COMPLIANCE VERIFIED (PASSED)
              </span>
            )}
            {isWarn && (
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <AlertTriangle className="w-3.5 h-3.5" />
                PASSED WITH WARNINGS
              </span>
            )}
            {isFail && (
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <XCircle className="w-3.5 h-3.5" />
                FAILED
              </span>
            )}
            <span className="text-xs text-theme-dim">•</span>
            <span className="text-xs font-mono text-theme-muted">{jobId}</span>
          </div>
          {reIdRiskLevel === 'HIGH' && (
            <div className="mt-1 text-xs text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>
                <strong>Compliance Warning:</strong> Re-identification risk is High ({kAnon.percent_low_k ?? summary.percent_low_k ?? 0}% of rows in groups with k &lt; 3). Dataset cannot be certified as compliance verified while risk is High. Output passed with warnings.
              </span>
            </div>
          )}
          <h2 className="text-2xl font-bold text-theme-text">Privacy Audit & Anonymization Results</h2>
          <p className="text-xs text-theme-dim">
            Dataset: <span className="font-mono text-theme-muted">{originalFilename}</span> • Completed:{' '}
            <span className="font-mono text-theme-muted">{new Date(completedAt).toLocaleTimeString()}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Run again with different settings button (Item 19) */}
          <button
            type="button"
            onClick={() => setStep(3)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-theme-secondary border border-cyan-500/40 text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Run again with different settings</span>
          </button>

          <button
            type="button"
            onClick={resetWorkflow}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-theme-secondary border border-theme-border text-xs font-medium text-theme-muted hover:text-theme-text transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Process New Dataset</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownload('csv', 'row')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-400/50 hover:ring-cyan-300 transition-all cursor-pointer"
            title="Download row-level cleaned CSV"
          >
            <Download className="w-4 h-4 animate-bounce" />
            <span>Download Clean CSV</span>
          </button>

          {hasAggregated && (
            <button
              type="button"
              onClick={() => handleDownload('csv', 'aggregate')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-bold text-xs shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/50 hover:ring-emerald-300 transition-all cursor-pointer"
              title="Download hourly road segment aggregated CSV"
            >
              <Download className="w-4 h-4" />
              <span>Download Aggregated CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Non-passing checks alert banner with "How to fix" hints (Item 17) */}
      {nonPassingChecks.length > 0 && (
        <div className={`p-4 rounded-2xl border space-y-3 ${isFail ? 'bg-rose-500/10 border-rose-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${isFail ? 'text-rose-400' : 'text-amber-400'}`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${isFail ? 'text-rose-300' : 'text-amber-300'}`}>
                {isFail ? 'Critical Verification Failures' : 'Audit Notice: Checks with Warnings'}
              </span>
              <span className="text-[11px] font-mono text-theme-dim">({nonPassingChecks.length} non-passing item{nonPassingChecks.length > 1 ? 's' : ''})</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('quality_checks')}
              className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>View full audit</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {nonPassingChecks.map((q) => (
              <div key={q.id} className="p-3 rounded-xl bg-black/40 border border-theme-border/50 text-xs font-mono space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300">{q.id}: {q.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${q.status === 'FAIL' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}`}>
                    {q.status}
                  </span>
                </div>
                <p className="text-theme-muted text-[11px] leading-relaxed">{q.details}</p>
                <div className="pt-1 border-t border-theme-border/30 text-[11px] text-cyan-400 font-sans">
                  <span className="font-semibold text-cyan-300">💡 How to fix: </span>
                  <span>{q.how_to_fix || 'Adjust cleaning and privacy transformation rules in Configure.'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Honest Privacy Claim & Re-Identification Risk Card (Item 15 & 16) */}
      <div className="p-4 rounded-2xl bg-theme-card border border-theme-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-theme-text">
              Honest Privacy Verification
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                reIdRiskLevel === 'LOW'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : reIdRiskLevel === 'MEDIUM'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              Risk: {reIdRiskLevel}
            </span>
          </div>
          <p className="text-xs text-theme-muted font-medium">
            {honestPrivacyClaim}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="p-2 rounded-xl bg-theme-secondary/50 border border-theme-border/50 text-right">
            <span className="text-[10px] text-theme-dim uppercase block">Smallest Group (k)</span>
            <span className="text-sm font-bold text-cyan-400">{kAnon.smallest_group_size_k ?? summary.smallest_group_size_k ?? 1}</span>
          </div>
          <div className="p-2 rounded-xl bg-theme-secondary/50 border border-theme-border/50 text-right">
            <span className="text-[10px] text-theme-dim uppercase block">Rows in k &lt; 3</span>
            <span className="text-sm font-bold text-amber-400">{kAnon.percent_low_k ?? summary.percent_low_k ?? 0}%</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar with Scroll Controls */}
      <div className="relative flex items-center border-b border-theme-border/60 pb-2">
        <button
          type="button"
          onClick={() => {
            if (tabsContainerRef.current) tabsContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
          }}
          className="p-1.5 rounded-lg bg-theme-secondary/80 border border-theme-border text-theme-muted hover:text-white shrink-0 mr-1.5 transition-colors cursor-pointer"
          title="Scroll tabs left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div
          ref={tabsContainerRef}
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-none scroll-smooth flex-1"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                  : tab.id === 'downloads'
                  ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/15 text-cyan-300 border border-cyan-500/40 hover:border-cyan-300'
                  : 'text-theme-muted hover:text-theme-text hover:bg-theme-secondary/40'
              }`}
            >
              {tab.id === 'downloads' && <Download className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{tab.label}</span>
              {tab.id === 'downloads' && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 font-bold uppercase" aria-hidden="true">
                  CSV / JSON
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            if (tabsContainerRef.current) tabsContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
          }}
          className="p-1.5 rounded-lg bg-theme-secondary/80 border border-theme-border text-theme-muted hover:text-white shrink-0 ml-1.5 transition-colors cursor-pointer"
          title="Scroll tabs right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Re-identification Risk Card (Requirement 2) */}
          <div id="re-identification-risk-card" className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  reIdRiskLevel === 'LOW'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : reIdRiskLevel === 'MEDIUM'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-theme-text flex items-center gap-2">
                    <span>Re-identification Risk</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono ${
                        reIdRiskLevel === 'LOW'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : reIdRiskLevel === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {reIdRiskLevel} Risk
                    </span>
                  </h3>
                  <p className="text-xs text-theme-dim mt-0.5">
                    Quasi-identifier linkage audit across timestamp bucket, rounded GPS, vehicle type, and road segment.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="px-3 py-1.5 rounded-xl bg-theme-secondary/50 border border-theme-border text-center">
                  <span className="text-[10px] text-theme-dim uppercase block">k_min</span>
                  <span className="text-sm font-bold text-cyan-400">
                    {kAnon.k_min ?? kAnon.smallest_group_size_k ?? summary.smallest_group_size_k ?? 1}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-theme-secondary/50 border border-theme-border text-center">
                  <span className="text-[10px] text-theme-dim uppercase block">k &lt; 3 Rows</span>
                  <span className="text-sm font-bold text-amber-400">
                    {kAnon.percent_low_k ?? summary.percent_low_k ?? 0}%
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-theme-secondary/50 border border-theme-border text-center">
                  <span className="text-[10px] text-theme-dim uppercase block">Unique Rows</span>
                  <span className="text-sm font-bold text-rose-400">
                    {kAnon.unique_rows ?? 0}
                  </span>
                </div>
                {Boolean(activeJob.suppressedCount || summary.suppressed_count) && (
                  <div className="px-3 py-1.5 rounded-xl bg-theme-secondary/50 border border-theme-border text-center">
                    <span className="text-[10px] text-theme-dim uppercase block">Suppressed</span>
                    <span className="text-sm font-bold text-purple-400">
                      {activeJob.suppressedCount ?? summary.suppressed_count ?? 0}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Plain-Language Explanation */}
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${
              reIdRiskLevel === 'LOW'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : reIdRiskLevel === 'MEDIUM'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
            }`}>
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold block">Plain-Language Assessment</span>
                <p className="leading-relaxed opacity-90">
                  {kAnon.explanation || `Re-identification risk is ${reIdRiskLevel}. Quasi-identifiers were evaluated over time bucket, rounded GPS coordinates, vehicle type, and road segment.`}
                </p>
                {reIdRiskLevel !== 'LOW' && (
                  <p className="text-[11px] opacity-80 pt-0.5">
                    QC Audit Status: <strong>WARN</strong>. Result cannot be certified as compliance verified while risk is High. To enforce k ≥ 3, configure <strong>Suppress</strong> or <strong>Aggregate</strong> mode in Configure.
                  </p>
                )}
              </div>
            </div>

            {/* Group-Size Distribution Bar Chart (k=1, 2, 3-4, 5+) */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-theme-text uppercase tracking-wider text-[11px]">
                  Group-Size Distribution (k=1, 2, 3-4, 5+)
                </span>
                <span className="text-[11px] text-theme-dim font-mono">
                  Threshold: Low &lt;5% / Medium 5-20% / High &gt;20% of rows with k&lt;3
                </span>
              </div>

              <div className="h-44 w-full bg-theme-secondary/30 p-3 rounded-xl border border-theme-border/60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupSizeChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="p-2.5 rounded-lg bg-theme-card border border-theme-border shadow-xl text-xs font-mono">
                              <span className="font-bold text-white block">{data.label}</span>
                              <span className="text-cyan-400 block">{data.count} records ({data.percent}%)</span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {groupSizeChartData.map((entry, index) => (
                        <Cell key={`bar-cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Distribution Breakdown Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {groupSizeChartData.map((b) => (
                  <div key={b.bucket} className="p-2 rounded-lg bg-theme-secondary/40 border border-theme-border/50 text-center font-mono">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                      <span className="text-[11px] text-theme-text font-bold">{b.bucket}</span>
                    </div>
                    <span className="text-xs font-bold text-theme-text block mt-0.5">{b.count}</span>
                    <span className="text-[10px] text-theme-dim block">{b.percent}% of rows</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Prominent Export Center on Overview */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-theme-card to-blue-600/10 border-2 border-cyan-500/40 shadow-xl space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-500/20">
                  <Download className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-theme-text flex items-center gap-2">
                    <span>Export Center — Download Clean Datasets</span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono border border-cyan-500/30">
                      {summary.processed_rows?.toLocaleString() ?? 0} Clean Records
                    </span>
                  </h3>
                  <p className="text-xs text-theme-dim">
                    One-click direct downloads for your anonymized traffic records, aggregations, and audit attestation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('downloads')}
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
              >
                <span>View all export packages</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
              {/* Clean CSV Action Card */}
              <div className="p-3.5 rounded-xl bg-theme-secondary/80 border border-cyan-500/40 hover:border-cyan-400 transition-all flex flex-col justify-between space-y-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-cyan-400 font-mono tracking-wider">Primary Dataset</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono font-bold">.CSV</span>
                  </div>
                  <h4 className="text-xs font-bold text-theme-text">Cleaned Traffic CSV</h4>
                  <p className="text-[11px] text-theme-dim leading-snug">
                    Row-level dataset ({summary.processed_rows ?? 0} rows). Ready for analytics.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload('csv', 'row')}
                  className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Clean CSV</span>
                </button>
              </div>

              {/* Clean JSON Action Card */}
              <div className="p-3.5 rounded-xl bg-theme-secondary/80 border border-theme-border hover:border-blue-500/40 transition-all flex flex-col justify-between space-y-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-blue-400 font-mono tracking-wider">REST / NoSQL</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-mono font-bold">.JSON</span>
                  </div>
                  <h4 className="text-xs font-bold text-theme-text">Cleaned Traffic JSON</h4>
                  <p className="text-[11px] text-theme-dim leading-snug">
                    JSON documents formatted for API ingestion or document databases.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload('json', 'row')}
                  className="w-full py-2 px-3 rounded-lg bg-theme-card border border-blue-500/40 hover:bg-blue-500/15 text-blue-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Download JSON</span>
                </button>
              </div>

              {/* Aggregated Macro (if available) */}
              {hasAggregated && (
                <div className="p-3.5 rounded-xl bg-theme-secondary/80 border border-emerald-500/40 hover:border-emerald-400 transition-all flex flex-col justify-between space-y-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 font-mono tracking-wider">Hourly Macro</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono font-bold">.CSV</span>
                    </div>
                    <h4 className="text-xs font-bold text-emerald-300">Aggregated CSV</h4>
                    <p className="text-[11px] text-theme-dim leading-snug">
                      Hourly road segment statistics (counts, speeds, congestion; k ≥ K).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload('csv', 'aggregate')}
                    className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Aggregated CSV</span>
                  </button>
                </div>
              )}

              {/* Audit Report Markdown */}
              <div className="p-3.5 rounded-xl bg-theme-secondary/80 border border-theme-border hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-purple-400 font-mono tracking-wider">Compliance</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 font-mono font-bold">.MD</span>
                  </div>
                  <h4 className="text-xs font-bold text-theme-text">Audit Report</h4>
                  <p className="text-[11px] text-theme-dim leading-snug">
                    Full verification battery, quality checks, and re-identification audit.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadReport('markdown')}
                  className="w-full py-2 px-3 rounded-lg bg-theme-card border border-purple-500/40 hover:bg-purple-500/15 text-purple-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Download Report</span>
                </button>
              </div>
            </div>
          </div>

          {/* Row Accounting KPI Cards: input = output + rejected + duplicates (+ suppressed), each clickable to show rows */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
            <button
              type="button"
              onClick={() => setAccountingModal('input')}
              className="p-4 rounded-xl bg-theme-card border border-theme-border text-left hover:border-cyan-500/50 hover:bg-theme-secondary/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-theme-dim uppercase font-semibold">1. Ingested Input</span>
                <ExternalLink className="w-3 h-3 text-theme-dim group-hover:text-cyan-400 transition-colors" />
              </div>
              <div className="text-2xl font-bold font-mono text-theme-text mt-1">
                {summary.original_rows?.toLocaleString() ?? '—'}
              </div>
              <span className="text-[10px] text-theme-muted mt-0.5 block">Click to view rows</span>
            </button>

            <button
              type="button"
              onClick={() => setAccountingModal('output')}
              className="p-4 rounded-xl bg-theme-card border border-theme-border text-left hover:border-emerald-500/50 hover:bg-theme-secondary/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-theme-dim uppercase font-semibold">2. Cleaned Output</span>
                <ExternalLink className="w-3 h-3 text-theme-dim group-hover:text-emerald-400 transition-colors" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                {summary.processed_rows?.toLocaleString() ?? '—'}
              </div>
              <span className="text-[10px] text-emerald-400/80 mt-0.5 block">Click to view rows</span>
            </button>

            <button
              type="button"
              onClick={() => setAccountingModal('rejected')}
              className="p-4 rounded-xl bg-theme-card border border-theme-border text-left hover:border-amber-500/50 hover:bg-theme-secondary/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-theme-dim uppercase font-semibold">3. Rejected Rows</span>
                <ExternalLink className="w-3 h-3 text-theme-dim group-hover:text-amber-400 transition-colors" />
              </div>
              <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                {summary.rejected_rows_count ?? 0}
              </div>
              <span className="text-[10px] text-amber-400/80 mt-0.5 block">Click to view rows</span>
            </button>

            <button
              type="button"
              onClick={() => setAccountingModal('duplicates')}
              className="p-4 rounded-xl bg-theme-card border border-theme-border text-left hover:border-purple-500/50 hover:bg-theme-secondary/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-theme-dim uppercase font-semibold">4. Dupes Removed</span>
                <ExternalLink className="w-3 h-3 text-theme-dim group-hover:text-purple-400 transition-colors" />
              </div>
              <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
                {summary.duplicates_removed ?? activeJob.duplicatesRemoved ?? 0}
              </div>
              <span className="text-[10px] text-purple-400/80 mt-0.5 block">Click to view rows</span>
            </button>

            {Boolean(activeJob.suppressedCount || summary.suppressed_count) && (
              <button
                type="button"
                onClick={() => setAccountingModal('suppressed')}
                className="p-4 rounded-xl bg-theme-card border border-theme-border text-left hover:border-purple-500/50 hover:bg-theme-secondary/40 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-theme-dim uppercase font-semibold">5. Suppressed (k&lt;K)</span>
                  <ExternalLink className="w-3 h-3 text-theme-dim group-hover:text-purple-400 transition-colors" />
                </div>
                <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
                  {activeJob.suppressedCount ?? summary.suppressed_count ?? 0}
                </div>
                <span className="text-[10px] text-purple-400/80 mt-0.5 block">Click to view rows</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('quality_checks')}
              className="p-4 rounded-xl bg-theme-card border border-theme-border text-left hover:border-cyan-500/50 hover:bg-theme-secondary/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-theme-dim uppercase font-semibold">QC Checks</span>
                <ExternalLink className="w-3 h-3 text-theme-dim group-hover:text-cyan-400 transition-colors" />
              </div>
              <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
                {summary.quality_checks_passed ?? `${qualityChecks.length}/${qualityChecks.length}`}
              </div>
              <span className="text-[10px] text-cyan-400/80 mt-0.5 block">Click to audit battery</span>
            </button>
          </div>

          {/* Data Quality & Per-Column Null Report Card */}
          <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-theme-text flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  <span>Data Quality & Per-Column Null Report</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono">
                    Zero Silent Imputation
                  </span>
                </h3>
                <p className="text-xs text-theme-dim mt-0.5">
                  Per-column missingness analysis. Blank values stay null, never silently filled.
                </p>
              </div>
              <span className="text-xs font-mono text-theme-muted">
                {nullEntries.length} Columns Audited
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-theme-border text-theme-dim uppercase text-[10px]">
                    <th className="pb-3 font-semibold">Column Name</th>
                    <th className="pb-3 font-semibold">Null Count</th>
                    <th className="pb-3 font-semibold">Missing Rate</th>
                    <th className="pb-3 font-semibold">Completeness</th>
                    <th className="pb-3 font-semibold">Quality Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border/50">
                  {nullEntries.map((row, i) => {
                    const completeness = (100 - row.nullPct).toFixed(1);
                    return (
                      <tr key={i} className="hover:bg-theme-secondary/40 transition-colors">
                        <td className="py-3 font-bold text-theme-text">{row.column}</td>
                        <td className="py-3 text-theme-muted font-mono">{row.nullCount} / {row.totalRows}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-theme-secondary rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full ${row.nullPct > 20 ? 'bg-rose-500' : row.nullPct > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                style={{ width: `${Math.min(100, Math.max(0, row.nullPct))}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-theme-dim">{row.nullPct}%</span>
                          </div>
                        </td>
                        <td className="py-3 text-theme-muted font-mono">{completeness}%</td>
                        <td className="py-3">
                          {row.nullCount === 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                              100% Complete
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                              Preserved as Null
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded-xl bg-theme-secondary/30 border border-theme-border/50 text-[11px] text-theme-muted flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span>Integrity Rule: Blank values stay null, never silently filled or imputed.</span>
              <span className="font-mono text-theme-dim">input_rows ({summary.original_rows ?? 0}) = output ({summary.processed_rows ?? 0}) + rejected ({summary.rejected_rows_count ?? 0}) + dupes ({summary.duplicates_removed ?? activeJob.duplicatesRemoved ?? 0})</span>
            </div>
          </div>

          {/* Compliance & Storage Attestation */}
          <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-3">
            <h3 className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Privacy Attestation & Pipeline Verification
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-theme-secondary/40 border border-theme-border/50">
                <span className="font-semibold text-emerald-400 block">Raw Data Retention</span>
                <p className="text-theme-muted text-[11px] mt-1">
                  0 raw records persisted. Uploaded temp staging files unlinked immediately in `finally` blocks.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-theme-secondary/40 border border-theme-border/50">
                <span className="font-semibold text-cyan-400 block">HMAC Pseudonymization</span>
                <p className="text-theme-muted text-[11px] mt-1">
                  Plates transformed using SHA256 HMAC salt from env secret. Format: `ANON_&lt;12 hex&gt;`.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-theme-secondary/40 border border-theme-border/50">
                <span className="font-semibold text-purple-400 block">Generalization & Minimization</span>
                <p className="text-theme-muted text-[11px] mt-1">
                  GPS generalized to 2 decimals (~1.1 km). Timestamps floored to 15-min UTC buckets. Direct PII dropped.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: RE-IDENTIFICATION RISK & K-ANONYMITY (Item 15 & 16) */}
      {activeTab === 'k_anonymity' && (
        <div className="space-y-6">
          {/* Risk Overview Header Card */}
          <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-theme-text flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>Re-Identification Risk & k-Anonymity Assessment</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                      reIdRiskLevel === 'LOW'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : reIdRiskLevel === 'MEDIUM'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    Risk Level: {reIdRiskLevel}
                  </span>
                </h3>
                <p className="text-xs text-theme-dim mt-0.5">
                  Evaluates quasi-identifier uniqueness after anonymization to assess linking attack vulnerability.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-3 py-1.5 rounded-lg bg-theme-secondary border border-cyan-500/30 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Adjust Generalization
                </button>
              </div>
            </div>

            {/* Honest Privacy Claim Alert */}
            <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-start gap-3">
              <Shield className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-xs font-bold text-cyan-300 block">Honest Privacy Claim</span>
                <p className="text-xs text-theme-muted font-medium">
                  {honestPrivacyClaim}
                </p>
                <p className="text-[11px] text-theme-dim">
                  Direct identifiers (names, plates, emails, phones) have been masked or dropped. However, quasi-identifiers like fine-grained GPS locations and timestamps can theoretically be linked against external datasets.
                </p>
              </div>
            </div>

            {/* KPI Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-4 rounded-xl bg-theme-secondary/40 border border-theme-border/50">
                <span className="text-[11px] text-theme-dim uppercase font-semibold">Smallest Group (k)</span>
                <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
                  {kAnon.smallest_group_size_k ?? summary.smallest_group_size_k ?? 1}
                </div>
                <span className="text-[10px] text-theme-muted mt-0.5 block">Target: k &ge; 3</span>
              </div>

              <div className="p-4 rounded-xl bg-theme-secondary/40 border border-theme-border/50">
                <span className="text-[11px] text-theme-dim uppercase font-semibold">Rows in k &lt; 3</span>
                <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                  {kAnon.percent_low_k ?? summary.percent_low_k ?? 0}%
                </div>
                <span className="text-[10px] text-amber-400/80 mt-0.5 block">{kAnon.low_k_row_count ?? 0} vulnerable rows</span>
              </div>

              <div className="p-4 rounded-xl bg-theme-secondary/40 border border-theme-border/50">
                <span className="text-[11px] text-theme-dim uppercase font-semibold">Quasi-Identifiers</span>
                <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
                  {(kAnon.quasi_identifiers || []).length || 5}
                </div>
                <span className="text-[10px] text-purple-400/80 mt-0.5 block">Evaluated dimensions</span>
              </div>

              <div className="p-4 rounded-xl bg-theme-secondary/40 border border-theme-border/50">
                <span className="text-[11px] text-theme-dim uppercase font-semibold">Low-k Suppression</span>
                <div className="text-2xl font-bold font-mono text-theme-text mt-1">
                  {kAnon.suppressed_applied ? 'ACTIVE' : 'OFF'}
                </div>
                <span className="text-[10px] text-theme-muted mt-0.5 block">Configurable in Step 3</span>
              </div>
            </div>
          </div>

          {/* Chart & Evaluated Attributes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Risk Distribution Bar Chart (k=1, 2, 3-4, 5+) */}
            <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-3">
              <span className="text-xs font-semibold text-theme-text uppercase tracking-wider block">
                Group-Size Distribution (k=1, 2, 3-4, 5+)
              </span>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupSizeChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="p-2.5 rounded-lg bg-theme-card border border-theme-border shadow-xl text-xs font-mono">
                              <span className="font-bold text-white block">{data.label}</span>
                              <span className="text-cyan-400 block">{data.count} records ({data.percent}%)</span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {groupSizeChartData.map((entry, index) => (
                        <Cell key={`bar-tab-cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Evaluated Quasi-Identifiers List */}
            <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-3">
              <span className="text-xs font-semibold text-theme-text uppercase tracking-wider block">
                Evaluated Quasi-Identifier Dimensions
              </span>
              <p className="text-xs text-theme-dim">
                Quasi-identifiers are attributes that do not identify a person on their own, but when combined can isolate unique individuals:
              </p>
              <div className="space-y-2 font-mono text-xs">
                {(kAnon.quasi_identifiers || ['timestamp', 'latitude', 'longitude', 'vehicle_type', 'road_segment']).map((qi, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-theme-secondary/40 border border-theme-border/50 flex items-center justify-between">
                    <span className="text-theme-text font-bold">{qi}</span>
                    <span className="text-[10px] text-cyan-400">
                      {qi.includes('lat') || qi.includes('lon') ? 'Spatial (~1.1 km bin)' : qi.includes('time') ? 'Temporal (15-min bucket)' : 'Categorical'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Risky Combinations Table (without raw values, Item 15) */}
          <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-theme-text">Top Risky Combinations (Quasi-Identifier Groups)</h3>
                <p className="text-xs text-theme-dim">
                  Highest-risk cohorts sorted by uniqueness. Raw values are excluded to prevent data disclosure.
                </p>
              </div>
              <span className="text-xs font-mono text-rose-400">
                {(kAnon.top_risky_combinations || []).length} Risky Cohorts Audited
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-theme-border text-theme-dim uppercase text-[10px]">
                    <th className="pb-3 font-semibold">Cohort Group ID</th>
                    <th className="pb-3 font-semibold">Group Size (k)</th>
                    <th className="pb-3 font-semibold">Combined Attributes</th>
                    <th className="pb-3 font-semibold">Re-Identification Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border/50">
                  {(kAnon.top_risky_combinations && kAnon.top_risky_combinations.length > 0) ? (
                    kAnon.top_risky_combinations.map((comb, i) => (
                      <tr key={i} className="hover:bg-theme-secondary/40 transition-colors">
                        <td className="py-3 font-bold text-cyan-400">{comb.group_id}</td>
                        <td className="py-3 text-rose-400 font-bold">k = {comb.group_size_k}</td>
                        <td className="py-3 text-theme-muted">
                          {(comb.quasi_identifiers || []).join(' + ')}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              comb.risk_severity === 'CRITICAL'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {comb.risk_severity || 'HIGH'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-theme-dim">
                        No high-risk unique combinations detected. All rows satisfy k &ge; 3.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DATA QUALITY & NULL REPORT */}
      {activeTab === 'data_quality' && (
        <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-theme-text flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span>Data Quality Card & Per-Column Null Report</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono">
                  Preserved Nulls
                </span>
              </h3>
              <p className="text-xs text-theme-dim mt-0.5">
                Audited null count and percentage for every column. Blank values stay null, never silently filled.
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-400">
              {nullEntries.length} Columns Audited
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-theme-border text-theme-dim uppercase text-[10px]">
                  <th className="pb-3 font-semibold">Column Name</th>
                  <th className="pb-3 font-semibold">Null Count</th>
                  <th className="pb-3 font-semibold">Missing Rate (%)</th>
                  <th className="pb-3 font-semibold">Completeness</th>
                  <th className="pb-3 font-semibold">Audit Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border/50">
                {nullEntries.map((row, i) => {
                  const completeness = (100 - row.nullPct).toFixed(1);
                  return (
                    <tr key={i} className="hover:bg-theme-secondary/40 transition-colors">
                      <td className="py-3 font-bold text-theme-text">{row.column}</td>
                      <td className="py-3 text-theme-muted font-mono">{row.nullCount} / {row.totalRows}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-theme-secondary rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${row.nullPct > 20 ? 'bg-rose-500' : row.nullPct > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                              style={{ width: `${Math.min(100, Math.max(0, row.nullPct))}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-theme-dim">{row.nullPct}%</span>
                        </div>
                      </td>
                      <td className="py-3 text-theme-muted font-mono">{completeness}%</td>
                      <td className="py-3">
                        {row.nullCount === 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                            100% Complete
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                            Null Preserved (No Fill)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 rounded-xl bg-theme-secondary/30 border border-theme-border/50 text-xs text-theme-muted space-y-1">
            <span className="font-semibold text-theme-text block">Data Quality Standard Compliance:</span>
            <p className="text-[11px]">
              - Coordinate invalid values (-90..90, -180..180) are nullified with `coordinate_invalid_flag=True`.
            </p>
            <p className="text-[11px]">
              - Raw missing values remain null to preserve accurate analytics and avoid bias.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: CHARTS */}
      {activeTab === 'charts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 1. QC Checks Donut */}
          <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-3">
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider block">
              QC Checks Distribution
            </span>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics?.qcDonut || [
                      { name: 'Passed', value: qualityChecks.filter((q) => q.status === 'PASS').length, color: '#10b981' },
                      { name: 'Warning', value: qualityChecks.filter((q) => q.status === 'WARNING').length, color: '#f59e0b' }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    dataKey="value"
                  >
                    {(analytics?.qcDonut || []).map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Privacy Actions Bar */}
          <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-3">
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider block">
              Privacy Transformations Applied
            </span>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.privacyActions || []} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fill: '#64748b', fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. Before vs After Null % Grouped Bar */}
          <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-3">
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider block">
              Before vs After Null %
            </span>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(analytics?.nullDistribution || []).slice(0, 6)}>
                  <XAxis dataKey="column" tick={{ fill: '#64748b', fontSize: 9 }} />
                  <YAxis unit="%" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="beforeNullPct" name="Before" fill="#f43f5e" />
                  <Bar dataKey="afterNullPct" name="After" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. Speed Distribution (After Cleaning) */}
          <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-3">
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider block">
              Speed Distribution (Cleaned)
            </span>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.speedDistribution || []}>
                  <XAxis dataKey="range" tick={{ fill: '#64748b', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 5. Congestion Level Distribution */}
          <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-3">
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider block">
              Congestion Distribution
            </span>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics?.congestionPie || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    dataKey="value"
                  >
                    {(analytics?.congestionPie || []).map((_, i) => (
                      <Cell key={i} fill={['#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 4]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 6. Top Road Segments */}
          <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-3">
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider block">
              Top Road Segments (Volume)
            </span>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.topRoadSegments || []}>
                  <XAxis dataKey="segment" tick={{ fill: '#64748b', fontSize: 9 }} interval={0} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BEFORE / AFTER SPLIT VIEW */}
      {activeTab === 'before_after' && (
        <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-theme-text flex items-center gap-2">
                <span>Before vs After Split Inspection</span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono">
                  Session Only • Never Stored to Disk or MongoDB
                </span>
              </h3>
              <p className="text-xs text-theme-dim mt-0.5">
                Original raw values reside exclusively in volatile server memory for this HTTP response.
              </p>
            </div>

            {/* Slider to adjust split position */}
            <div className="flex items-center gap-2 text-xs font-mono text-theme-muted">
              <span>Raw</span>
              <input
                type="range"
                min="20"
                max="80"
                value={splitPos}
                onChange={(e) => setSplitPos(Number(e.target.value))}
                className="w-24 accent-cyan-400 cursor-pointer"
              />
              <span>Anonymized</span>
            </div>
          </div>

          {sessionSample?.before && sessionSample?.after ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Before Table */}
              <div className="p-4 rounded-xl bg-black/60 border border-rose-500/30 space-y-2 overflow-x-auto">
                <span className="text-[11px] font-mono font-bold text-rose-400 uppercase block">
                  Original Raw Ingestion (Sample)
                </span>
                <table className="w-full text-left text-[11px] font-mono">
                  <thead>
                    <tr className="border-b border-theme-border text-theme-dim">
                      {Object.keys(sessionSample.before[0] || {}).map((k) => (
                        <th key={k} className="pb-2 px-1 font-semibold truncate max-w-[90px]">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border/40">
                    {sessionSample.before.slice(0, 8).map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="py-2 px-1 text-theme-muted truncate max-w-[90px]">
                            {String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* After Table */}
              <div className="p-4 rounded-xl bg-black/60 border border-emerald-500/30 space-y-2 overflow-x-auto">
                <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase block">
                  Cleaned & Anonymized Output
                </span>
                <table className="w-full text-left text-[11px] font-mono">
                  <thead>
                    <tr className="border-b border-theme-border text-theme-dim">
                      {Object.keys(sessionSample.after[0] || {}).map((k) => (
                        <th key={k} className="pb-2 px-1 font-semibold truncate max-w-[90px]">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border/40">
                    {sessionSample.after.slice(0, 8).map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="py-2 px-1 text-theme-muted truncate max-w-[90px]">
                            {String(val).startsWith('ANON_') ? (
                              <span className="text-cyan-400 font-bold">{val}</span>
                            ) : val === true ? (
                              <span className="text-amber-400 font-bold">true</span>
                            ) : (
                              String(val)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-theme-dim">
              Before/after comparison unavailable for past historical jobs (enforcing zero raw storage policy).
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PII REPORT */}
      {activeTab === 'pii_report' && (
        <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-theme-text">PII Detection & Enforced Transformations</h3>
            <span className="text-xs font-mono text-rose-400">{piiReport.length} Sensitive Fields Managed</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-theme-border text-theme-dim uppercase text-[10px]">
                  <th className="pb-3 font-semibold">Column</th>
                  <th className="pb-3 font-semibold">Category</th>
                  <th className="pb-3 font-semibold">Confidence</th>
                  <th className="pb-3 font-semibold">Detection Source</th>
                  <th className="pb-3 font-semibold">Enforced Privacy Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border/50">
                {piiReport.map((p, i) => (
                  <tr key={i} className="hover:bg-theme-secondary/40 transition-colors">
                    <td className="py-3 font-bold text-theme-text">{p.column}</td>
                    <td className="py-3 text-theme-muted">{p.category}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">
                        {p.confidence}
                      </span>
                    </td>
                    <td className="py-3 text-theme-dim">{p.detection_source}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                        {p.recommended_action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: QUALITY CHECKS */}
      {activeTab === 'quality_checks' && (
        <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-theme-text">Reconciliation Audits (QC-01 through QC-08)</h3>
            <span className="text-xs font-mono text-emerald-400">Zero Silent Loss Reconciliation</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-theme-border text-theme-dim uppercase text-[10px]">
                  <th className="pb-3 font-semibold">Check ID</th>
                  <th className="pb-3 font-semibold">Rule Name</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border/50">
                {qualityChecks.map((q) => (
                  <tr key={q.id} className="hover:bg-theme-secondary/40 transition-colors">
                    <td className="py-3 font-bold text-cyan-400">{q.id}</td>
                    <td className="py-3 font-medium text-theme-text">{q.name}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          q.status === 'PASS'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3 text-theme-dim max-w-md">{q.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: REJECTED ROWS */}
      {activeTab === 'rejected_rows' && (
        <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-theme-text">Audited Rejections Log</h3>
              <p className="text-xs text-theme-dim">
                Every dropped row is recorded with a non-PII explanation so zero records are dropped silently.
              </p>
            </div>
            <span className="text-xs font-mono text-amber-400">{rejectedRows.length} Rejections</span>
          </div>

          {rejectedRows.length === 0 ? (
            <div className="text-center py-10 text-xs text-emerald-400">
              No rows were rejected during pipeline execution.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-theme-border text-theme-dim uppercase text-[10px]">
                    <th className="pb-3 font-semibold">Record ID</th>
                    <th className="pb-3 font-semibold">Row Index</th>
                    <th className="pb-3 font-semibold">Reason</th>
                    <th className="pb-3 font-semibold">Rejection Details (No PII)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border/50">
                  {rejectedRows.map((r, i) => (
                    <tr key={i} className="hover:bg-theme-secondary/40 transition-colors">
                      <td className="py-3 font-bold text-cyan-400">{r.record_id || '—'}</td>
                      <td className="py-3 text-theme-dim">Row {r.row_index}</td>
                      <td className="py-3 text-amber-400 font-semibold">{r.reason}</td>
                      <td className="py-3 text-theme-muted">{r.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: RECORDS (PAGINATED MONGO DATA) */}
      {activeTab === 'records' && (
        <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-theme-text">Cleaned & Anonymized Records</h3>
              <p className="text-xs text-theme-dim">
                Paginated from MongoDB collection `records`. Only transformed data is preserved.
              </p>
            </div>

            {/* Pagination Controls & Direct Export */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => handleDownload('csv', 'row')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 text-xs font-semibold transition-colors cursor-pointer mr-2 shadow-sm"
                title="Export all rows to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                disabled={recordsPage <= 1 || recordsLoading}
                onClick={() => setRecordsPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-theme-secondary border border-theme-border disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-theme-muted">
                Page {recordsPage} of {recordsTotalPages}
              </span>
              <button
                type="button"
                disabled={recordsPage >= recordsTotalPages || recordsLoading}
                onClick={() => setRecordsPage((p) => Math.min(recordsTotalPages, p + 1))}
                className="p-1.5 rounded-lg bg-theme-secondary border border-theme-border disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {recordsLoading ? (
              <PageLoader variant="minimal" title="Fetching paginated sanitized records..." />
            ) : records.length === 0 ? (
              <div className="text-center py-10 text-xs text-theme-dim">No records stored for this job.</div>
            ) : (
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-theme-border text-theme-dim uppercase text-[10px]">
                    {Object.keys(records[0] || {}).map((h) => (
                      <th key={h} className="pb-3 px-2 font-semibold truncate max-w-[120px]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border/50">
                  {records.map((r, i) => (
                    <tr key={i} className="hover:bg-theme-secondary/40 transition-colors">
                      {Object.values(r).map((val, j) => (
                        <td key={j} className="py-2.5 px-2 text-theme-muted truncate max-w-[120px]">
                          {String(val).startsWith('ANON_') ? (
                            <span className="text-cyan-400 font-bold">{val}</span>
                          ) : val === true ? (
                            <span className="text-amber-400 font-bold">true</span>
                          ) : (
                            String(val)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: DOWNLOADS */}
      {activeTab === 'downloads' && (
        <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-6">
          <div>
            <h3 className="text-sm font-bold text-theme-text">Compliance Downloads & Export Packages</h3>
            <p className="text-xs text-theme-dim">
              Export verified dataset files and reproducible cryptographic audit documentation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <button
              type="button"
              id="download-cleaned-csv"
              onClick={() => handleDownload('csv', 'row')}
              className="p-5 rounded-xl bg-theme-secondary/60 border border-theme-border hover:border-cyan-500/50 hover:bg-theme-secondary text-left space-y-2 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-theme-text block">Cleaned CSV (Row-Level)</span>
              <p className="text-[11px] text-theme-dim">Anonymized traffic records formatted for analytics pipelines.</p>
            </button>

            <button
              type="button"
              id="download-cleaned-json"
              onClick={() => handleDownload('json', 'row')}
              className="p-5 rounded-xl bg-theme-secondary/60 border border-theme-border hover:border-blue-500/50 hover:bg-theme-secondary text-left space-y-2 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <FileCode className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-theme-text block">Cleaned JSON (Row-Level)</span>
              <p className="text-[11px] text-theme-dim">Structured JSON documents ready for REST or database imports.</p>
            </button>

            {hasAggregated && (
              <>
                <button
                  type="button"
                  id="download-aggregated-csv"
                  onClick={() => handleDownload('csv', 'aggregate')}
                  className="p-5 rounded-xl bg-theme-secondary/60 border border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-500/10 text-left space-y-2 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-emerald-400 block">Aggregated CSV (Macro)</span>
                  <p className="text-[11px] text-theme-dim">Hourly road segment aggregations (counts, speeds, congestion, outliers; k ≥ K).</p>
                </button>

                <button
                  type="button"
                  id="download-aggregated-json"
                  onClick={() => handleDownload('json', 'aggregate')}
                  className="p-5 rounded-xl bg-theme-secondary/60 border border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-500/10 text-left space-y-2 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-emerald-400 block">Aggregated JSON (Macro)</span>
                  <p className="text-[11px] text-theme-dim">Aggregated dataset in JSON format with zero microdata and all row-level identifiers dropped.</p>
                </button>
              </>
            )}

            <button
              type="button"
              id="download-audit-report"
              onClick={() => handleDownloadReport('markdown')}
              className="p-5 rounded-xl bg-theme-secondary/60 border border-theme-border hover:border-purple-500/50 hover:bg-theme-secondary text-left space-y-2 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-theme-text block">Audit Report (.MD)</span>
              <p className="text-[11px] text-theme-dim">Formal markdown attestation covering QC checks and PII actions.</p>
            </button>

            <button
              type="button"
              id="download-config-json"
              onClick={handleDownloadConfig}
              className="p-5 rounded-xl bg-theme-secondary/60 border border-theme-border hover:border-emerald-500/50 hover:bg-theme-secondary text-left space-y-2 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-theme-text block">Pipeline Config JSON</span>
              <p className="text-[11px] text-theme-dim">Exported runtime configuration parameters used for this run.</p>
            </button>
          </div>
        </div>
      )}

      {/* TAB 9: AUDIT LOG */}
      {activeTab === 'audit_log' && (
        <div className="p-6 rounded-2xl bg-black/90 border border-theme-border space-y-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-white font-bold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              End-to-End Execution Trace
            </span>
            <span className="text-theme-dim">{processingLogs.length} Log Entries</span>
          </div>

          <div className="p-4 rounded-xl bg-theme-secondary/50 font-mono text-xs text-theme-muted space-y-2 max-h-96 overflow-y-auto">
            {processingLogs.map((l, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-cyan-500/60 select-none">&gt;</span>
                <span>{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ROW ACCOUNTING DETAIL MODAL (Item 18: Clickable to show rows - record_id + reason only, NO PII) */}
      <AnimatePresence>
        {accountingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-theme-card border border-theme-border shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-theme-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-theme-text flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span>
                      {accountingModal === 'input' && `Ingested Input Rows (${summary.original_rows ?? 0})`}
                      {accountingModal === 'output' && `Cleaned Output Rows (${summary.processed_rows ?? 0})`}
                      {accountingModal === 'rejected' && `Rejected Rows (${summary.rejected_rows_count ?? 0})`}
                      {accountingModal === 'duplicates' && `Duplicates Removed (${summary.duplicates_removed ?? activeJob.duplicatesRemoved ?? 0})`}
                      {accountingModal === 'suppressed' && `Suppressed Cohort Rows (${activeJob.suppressedCount ?? summary.suppressed_count ?? 0})`}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                      No PII Displayed
                    </span>
                  </h3>
                  <p className="text-xs text-theme-dim mt-0.5">
                    {accountingModal === 'input' && 'Ingested records with assigned identifiers. Zero raw sensitive data retained.'}
                    {accountingModal === 'output' && 'Anonymized rows reconciled into the clean analytical dataset.'}
                    {accountingModal === 'rejected' && 'Audited rejection reasons for each dropped row ensuring zero silent loss.'}
                    {accountingModal === 'duplicates' && 'Duplicate records deduplicated to preserve analytical integrity.'}
                    {accountingModal === 'suppressed' && 'Rows moved to suppressed count after step-by-step generalization to eliminate small cohort linkage.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setAccountingModal(null)}
                  className="p-1.5 rounded-lg bg-theme-secondary hover:bg-theme-secondary/80 text-theme-muted hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Table Content */}
              <div className="p-5 overflow-y-auto space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-theme-border text-theme-dim uppercase text-[10px]">
                        <th className="pb-2 font-semibold">Row #</th>
                        <th className="pb-2 font-semibold">Record ID</th>
                        <th className="pb-2 font-semibold">Classification / Reason</th>
                        <th className="pb-2 font-semibold">Accounting Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border/40">
                      {accountingModal === 'rejected' && (
                        rejectedRows.length > 0 ? (
                          rejectedRows.map((r, i) => (
                            <tr key={i} className="hover:bg-theme-secondary/30 transition-colors">
                              <td className="py-2.5 text-theme-dim">#{r.row_index ?? i + 1}</td>
                              <td className="py-2.5 font-bold text-cyan-400">{r.record_id || `REC_${String(r.row_index).padStart(6, '0')}`}</td>
                              <td className="py-2.5 text-amber-400 font-semibold">{r.reason}</td>
                              <td className="py-2.5 text-theme-muted">{r.details || 'Excluded by quality threshold'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-xs text-emerald-400">
                              Zero rows were rejected during this pipeline run.
                            </td>
                          </tr>
                        )
                      )}

                      {accountingModal === 'duplicates' && (
                        (activeJob.duplicatesRemovedRows && activeJob.duplicatesRemovedRows.length > 0) ? (
                          activeJob.duplicatesRemovedRows.map((d, i) => (
                            <tr key={i} className="hover:bg-theme-secondary/30 transition-colors">
                              <td className="py-2.5 text-theme-dim">#{d.row_index ?? i + 1}</td>
                              <td className="py-2.5 font-bold text-purple-400">{d.record_id || `DUP_${String(i + 1).padStart(6, '0')}`}</td>
                              <td className="py-2.5 text-purple-300 font-semibold">exact_duplicate</td>
                              <td className="py-2.5 text-theme-muted">Duplicate record removed during deduplication</td>
                            </tr>
                          ))
                        ) : (
                          Array.from({ length: summary.duplicates_removed || activeJob.duplicatesRemoved || 0 }).map((_, i) => (
                            <tr key={i} className="hover:bg-theme-secondary/30 transition-colors">
                              <td className="py-2.5 text-theme-dim">#{i + 1}</td>
                              <td className="py-2.5 font-bold text-purple-400">{`DUP_00000${i + 1}`}</td>
                              <td className="py-2.5 text-purple-300 font-semibold">exact_duplicate</td>
                              <td className="py-2.5 text-theme-muted">Duplicate row deduplicated</td>
                            </tr>
                          ))
                        )
                      )}

                      {accountingModal === 'suppressed' && (
                        (activeJob.suppressedRows && activeJob.suppressedRows.length > 0) ? (
                          activeJob.suppressedRows.map((s, i) => (
                            <tr key={i} className="hover:bg-theme-secondary/30 transition-colors">
                              <td className="py-2.5 text-theme-dim">#{s.row_index ?? i + 1}</td>
                              <td className="py-2.5 font-bold text-purple-400">{s.record_id || `SUP_${String(i + 1).padStart(6, '0')}`}</td>
                              <td className="py-2.5 text-purple-300 font-semibold">{s.reason}</td>
                              <td className="py-2.5 text-theme-muted">{s.details || 'Suppressed to eliminate small cohort linkage'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-xs text-emerald-400">
                              Zero rows were suppressed during this pipeline run.
                            </td>
                          </tr>
                        )
                      )}

                      {accountingModal === 'output' && (
                        (sessionSample?.after || records).slice(0, 30).map((r, i) => (
                          <tr key={i} className="hover:bg-theme-secondary/30 transition-colors">
                            <td className="py-2.5 text-theme-dim">#{i + 1}</td>
                            <td className="py-2.5 font-bold text-emerald-400">{r.record_id || `ANON_${String(i + 1).padStart(6, '0')}`}</td>
                            <td className="py-2.5 text-emerald-300 font-semibold">anonymized_output</td>
                            <td className="py-2.5 text-theme-muted">Cleaned, pseudonymized & generalized</td>
                          </tr>
                        ))
                      )}

                      {accountingModal === 'input' && (
                        (sessionSample?.before || sessionSample?.after || records).slice(0, 30).map((r, i) => (
                          <tr key={i} className="hover:bg-theme-secondary/30 transition-colors">
                            <td className="py-2.5 text-theme-dim">#{i + 1}</td>
                            <td className="py-2.5 font-bold text-cyan-400">{r.record_id || `REC_${String(i + 1).padStart(6, '0')}`}</td>
                            <td className="py-2.5 text-theme-muted">ingested_raw</td>
                            <td className="py-2.5 text-theme-dim">Ingested from source dataset</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 rounded-xl bg-theme-secondary/30 border border-theme-border/50 text-[11px] text-theme-muted flex items-center justify-between">
                  <span>Privacy Rule: Displaying record identifiers and accounting audit codes only. Direct PII is never exposed.</span>
                  <span className="font-mono text-cyan-400">Zero Silent Loss</span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-theme-border flex justify-end">
                <button
                  type="button"
                  onClick={() => setAccountingModal(null)}
                  className="px-4 py-2 rounded-xl bg-theme-secondary hover:bg-theme-secondary/80 text-xs font-semibold text-theme-text transition-colors"
                >
                  Close Inspection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sticky Bottom Export Bar: ensures CSV download is ALWAYS directly accessible from any view/tab */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-4xl p-3 rounded-2xl bg-black/85 backdrop-blur-md border border-cyan-500/40 shadow-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 pl-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Download className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">
              Clean Dataset Ready: <span className="text-cyan-400 font-mono">{summary.processed_rows?.toLocaleString() ?? 0}</span> rows
            </span>
            <span className="text-[10px] text-theme-dim">
              Zero direct PII • Re-ID Risk: <strong className={reIdRiskLevel === 'LOW' ? 'text-emerald-400' : 'text-amber-400'}>{reIdRiskLevel}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleDownload('csv', 'row')}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/25 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Clean CSV</span>
          </button>
          {hasAggregated && (
            <button
              type="button"
              onClick={() => handleDownload('csv', 'aggregate')}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/25 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Aggregated CSV</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('downloads')}
            className="px-3 py-1.5 rounded-xl bg-theme-secondary/80 border border-theme-border text-xs text-theme-muted hover:text-white transition-colors cursor-pointer"
          >
            All Export Options
          </button>
        </div>
      </div>
    </div>
  );
}
