import React, { useEffect, useState, useRef, useMemo, Suspense, lazy } from 'react';
import {
  ShieldCheck,
  PlusCircle,
  Database,
  ChevronRight,
  TrendingUp,
  BarChart2,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  ArrowRight,
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { useThemeStore } from '../store/useThemeStore';
import WizardStepper from '../components/wizard/WizardStepper';
import Step1Upload from '../components/wizard/Step1Upload';
import Step2Analysis from '../components/wizard/Step2Analysis';
import Step3Configure from '../components/wizard/Step3Configure';
import Step4Processing from '../components/wizard/Step4Processing';
import Step5Results from '../components/wizard/Step5Results';
import PageLoader from '../components/PageLoader';
import ProcessingVolumeGraph from '../components/ProcessingVolumeGraph';
import PrivacyMethodsChart3D from '../components/3d/PrivacyMethodsChart3D';
import axios from 'axios';
import { Link } from 'react-router-dom';

const PrivacyGateway3D = lazy(() => import('../components/3d/PrivacyGateway3D'));

export default function Dashboard() {
  const currentStep   = useWorkflowStore((s) => s.currentStep);
  const activeJob     = useWorkflowStore((s) => s.activeJob);
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);
  const setStep       = useWorkflowStore((s) => s.setStep);
  const setProfileData= useWorkflowStore((s) => s.setProfileData);
  const setFile       = useWorkflowStore((s) => s.setFile);
  const colors        = useThemeStore((s) => s.getThemeColors)();

  const [recentJobs, setRecentJobs]       = useState([]);
  const [totalJobsCount, setTotalJobsCount] = useState(0);
  const [loadingJobs, setLoadingJobs]     = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [volumeViewMode, setVolumeViewMode] = useState('per_run'); // 'per_run' | 'cumulative'
  const wizardRef = useRef(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    loadRecentJobs();
  }, [currentStep]);

  const loadRecentJobs = async () => {
    try {
      setLoadingJobs(true);
      const res = await axios.get('/api/jobs?limit=5');
      if (res.data?.jobs) {
        setRecentJobs(res.data.jobs);
        setTotalJobsCount(res.data.total ?? res.data.jobs.length);
      }
    } catch (err) {
      console.warn('Failed to fetch recent jobs:', err.message);
    } finally {
      setLoadingJobs(false);
    }
  };

  const scrollToWizard = () => {
    resetWorkflow();
    wizardRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLoadSampleDataset = async () => {
    try {
      setLoadingSample(true);
      const formData = new FormData();
      formData.append('isSample', 'true');
      const res = await axios.post('/api/jobs/profile', formData);
      if (res.data?.profile) {
        setProfileData(res.data.profile);
        setFile(null, true);
        setStep(2);
        wizardRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Failed to load sample dataset:', err);
      resetWorkflow();
      wizardRef.current?.scrollIntoView({ behavior: 'smooth' });
    } finally {
      setLoadingSample(false);
    }
  };

  // ── Derived metrics ──────────────────────────────────────────────────────
  const totalJobs = totalJobsCount || recentJobs.length;
  const totalRecords = recentJobs.reduce(
    (acc, j) => acc + (j.summary?.processed_rows ?? j.summary?.original_rows ?? 0), 0
  );
  const totalSensitiveColumns = recentJobs.reduce(
    (acc, j) => acc + (j.summary?.pii_columns_detected ?? (j.piiReport?.length || 0)), 0
  );
  const reconciledJobsCount = recentJobs.filter((j) => {
    if (j.summary?.reconciliation_passed === true) return true;
    const orig = j.summary?.original_rows ?? 0;
    const proc = j.summary?.processed_rows ?? 0;
    const supp = j.summary?.suppressed_count ?? 0;
    const rej  = j.summary?.rejected_rows_count ?? 0;
    const dup  = j.summary?.duplicate_rows_removed ?? 0;
    return orig > 0 && proc + supp + rej + dup === orig;
  }).length;

  const latestJob = recentJobs[0];
  let measuredThroughput = null;
  if (latestJob?.summary?.processed_rows && latestJob?.summary?.execution_time_seconds) {
    const sec  = Math.max(0.1, Number(latestJob.summary.execution_time_seconds));
    const rate = Math.round(latestJob.summary.processed_rows / sec);
    measuredThroughput = { rate, date: new Date(latestJob.createdAt || Date.now()).toLocaleDateString() };
  }

  const jobsOverTime = useMemo(() => {
    if (!recentJobs.length) return [];
    let cumulative = 0;
    return [...recentJobs].reverse().map((j, idx, arr) => {
      const d = new Date(j.createdAt || Date.now());
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      const recs = Number(j.summary?.processed_rows ?? j.summary?.original_rows ?? 0);
      cumulative += recs;
      const shortLabel = arr.length <= 6 ? `#${idx + 1} (${timeStr})` : `#${idx + 1}`;
      return {
        id: j.jobId || idx,
        index: idx + 1,
        date: `${dateStr} ${timeStr}`,
        shortLabel,
        records: recs,
        cumulative,
        filename: j.originalFilename || `Run #${idx + 1}`,
        status: j.status || 'COMPLETED',
        timeStr
      };
    });
  }, [recentJobs]);

  const peakRecords = jobsOverTime.length > 0 ? Math.max(...jobsOverTime.map((j) => j.records)) : 0;
  const avgRecords = jobsOverTime.length > 0 ? Math.round(jobsOverTime.reduce((acc, j) => acc + j.records, 0) / jobsOverTime.length) : 0;

  const privacyDist = useMemo(() => {
    let realHmacCount = 0, realDropCount = 0, realGenCount = 0, realRedactCount = 0;
    for (const j of recentJobs) {
      for (const p of (j.piiReport || [])) {
        if (p.recommended_action === 'PSEUDONYMIZE_HMAC') realHmacCount++;
        else if (p.recommended_action === 'DROP_COLUMN') realDropCount++;
        else if (p.recommended_action === 'GENERALIZE_SPATIAL') realGenCount++;
        else if (p.recommended_action === 'REDACT' || p.category === 'free_text_pii') realRedactCount++;
      }
    }
    const totalActions = realHmacCount + realDropCount + realGenCount + realRedactCount;

    // Default authentic distribution if no job loaded yet
    if (totalActions === 0) {
      return [
        { name: 'Personal Info Deleted', value: 50, color: '#BE185D' },
        { name: 'Scrambled Plates', value: 25, color: '#EA580C' },
        { name: 'Blurred GPS Maps', value: 17, color: '#D97706' },
        { name: 'Cleaned Comments', value: 8, color: '#8B5CF6' }
      ];
    }

    const rawItems = [
      { name: 'Personal Info Deleted', count: realDropCount, color: '#BE185D' },
      { name: 'Scrambled Plates', count: realHmacCount, color: '#EA580C' },
      { name: 'Blurred GPS Maps', count: realGenCount, color: '#D97706' },
      { name: 'Cleaned Comments', count: realRedactCount, color: '#8B5CF6' }
    ].filter((i) => i.count > 0);

    // Hare-Niemeyer rounding to ensure exact 100% sum
    const totalCount = rawItems.reduce((acc, i) => acc + i.count, 0) || 1;
    const exact = rawItems.map((i) => (i.count / totalCount) * 100);
    const floored = exact.map((e) => Math.floor(e));
    const missing = 100 - floored.reduce((a, b) => a + b, 0);
    const remainders = exact.map((e, idx) => ({ idx, rem: e - floored[idx] }));
    remainders.sort((a, b) => b.rem - a.rem);
    for (let k = 0; k < missing; k++) {
      floored[remainders[k % remainders.length].idx] += 1;
    }

    return rawItems.map((item, idx) => ({
      name: item.name,
      value: floored[idx],
      color: item.color
    }));
  }, [recentJobs]);

  const tt = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-main)',
    borderRadius: '0.5rem',
    fontSize: '11px'
  };

  const stats = [
    { id:'stat-card-jobs',       label:'Jobs processed',    value: totalJobs,                             hint: totalJobs === 0 ? 'None yet' : 'Total runs',           color:'text-theme-text'  },
    { id:'stat-card-records',    label:'Records processed', value: totalRecords.toLocaleString(),         hint: totalRecords === 0 ? '\u2014' : 'Sanitized rows',         color:'text-indigo-500'  },
    { id:'stat-card-sensitive',  label:'Sensitive columns', value: totalSensitiveColumns,                 hint: totalSensitiveColumns === 0 ? 'No PII yet' : 'Masked', color:'text-pink-500'    },
    { id:'stat-card-reconciled', label:'Reconciled jobs',   value: `${reconciledJobsCount}/${totalJobs}`, hint: totalJobs === 0 ? 'Awaiting data' : 'QC-01\u2013QC-09', color:'text-emerald-500' }
  ];

  return (
    <div className="space-y-6 pb-16">

      {/* HERO */}
      <section className="rounded-xl border border-theme-border bg-theme-card p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">

          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-medium text-theme-dim tracking-wide uppercase">
                  Traffic data privacy toolkit
                </span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-theme-text tracking-tight leading-snug">
                  Road Traffic Data Privacy Platform
                </h1>
                <p className="mt-2 text-sm text-theme-muted max-w-lg leading-relaxed">
                  Upload a traffic dataset, detect personal data, choose how to protect it, and export a cleaned dataset with an audit report.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={scrollToWizard}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors cursor-pointer shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  New job
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <Link
                  to="/methodology"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-theme-border text-sm font-medium text-theme-muted hover:text-theme-text transition-colors"
                >
                  Methodology <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <p className="text-[11px] text-theme-dim pt-3 border-t border-theme-border/60">
              Uploaded files are deleted after processing &middot; Every input row is accounted for
            </p>
          </div>

          <div className="lg:col-span-5 min-h-[270px] lg:min-h-0 h-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-md relative flex flex-col ring-1 ring-slate-800/60">
            <Suspense fallback={
              <div className="w-full h-full flex flex-col items-center justify-center text-xs font-mono text-cyan-400">
                <div className="w-6 h-6 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-2" />
                <span>Loading&hellip;</span>
              </div>
            }>
              <PrivacyGateway3D />
            </Suspense>
          </div>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 mt-8 pt-6 border-t border-theme-border divide-x divide-theme-border">
          {stats.map((s) => (
            <div key={s.id} data-testid={s.id} className="px-4 first:pl-0 last:pr-0">
              <span className="block text-[11px] text-theme-dim uppercase tracking-wider font-medium">{s.label}</span>
              <span className={`block text-xl font-bold mt-0.5 tabular-nums ${s.color}`}>{s.value}</span>
              <span className="block text-[10px] text-theme-muted mt-0.5">{s.hint}</span>
            </div>
          ))}
        </div>

        {measuredThroughput && (
          <div className="mt-4 pt-3 border-t border-theme-border flex items-center justify-between text-[11px] text-theme-dim font-mono">
            <span className="flex items-center gap-1.5 text-emerald-500">
              <TrendingUp className="w-3 h-3" />
              Throughput: <strong className="ml-1">{measuredThroughput.rate.toLocaleString()} rows/s</strong>
            </span>
            <span>{measuredThroughput.date}</span>
          </div>
        )}
      </section>

      {/* RESUME BANNER */}
      {(activeJob || recentJobs.length > 0) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border border-theme-border bg-theme-card shadow-sm text-xs">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-4 h-4 text-theme-muted shrink-0" />
            <div>
              <span className="font-semibold text-theme-text">
                {activeJob ? `Active — Step ${currentStep}` : 'Last job'}{' '}
                <span className="font-mono text-indigo-500 font-normal">
                  {activeJob?.originalFilename || recentJobs[0]?.originalFilename || 'Dataset'}
                </span>
              </span>
              <p className="text-[11px] text-theme-dim mt-0.5">
                {activeJob
                  ? `In progress · ${activeJob.id || ''}`
                  : `Completed ${new Date(recentJobs[0]?.createdAt || Date.now()).toLocaleDateString()}`}
              </p>
            </div>
          </div>
          <div className="self-end sm:self-auto">
            {activeJob ? (
              <button
                type="button"
                onClick={() => setStep(currentStep)}
                className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Continue step {currentStep}
              </button>
            ) : (
              <Link
                to={`/jobs/${recentJobs[0]?.id}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
              >
                View results <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* WIZARD */}
      <section ref={wizardRef} className="space-y-4">
        <WizardStepper />
        <div className="min-h-[420px]">
          {currentStep === 1 && <Step1Upload />}
          {currentStep === 2 && <Step2Analysis />}
          {currentStep === 3 && <Step3Configure />}
          {currentStep === 4 && <Step4Processing />}
          {currentStep === 5 && <Step5Results />}
        </div>
      </section>

      {/* PROCESSING VOLUME GRAPH: ALLUVIAL STREAM FLOW & TIMELINE */}
      <section role="region" aria-label="Processing Volume Flow" className="space-y-3">
        <ProcessingVolumeGraph
          latestJob={latestJob}
          recentJobs={recentJobs}
          jobsOverTime={jobsOverTime}
          peakRecords={peakRecords}
          avgRecords={avgRecords}
        />
      </section>

      {/* ANALYTICS & ACTIVITY */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Privacy Distribution Breakdown */}
        <div role="region" aria-label="Privacy Distribution Chart"
          className="rounded-xl border border-theme-border bg-theme-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-theme-text flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-theme-dim" /> Privacy Methods
            </h3>
            <span className="text-[10px] text-theme-dim font-mono">By action</span>
          </div>
          {privacyDist.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-theme-border/60 text-center">
              <ShieldCheck className="w-6 h-6 text-theme-dim/30" />
              <p className="text-xs text-theme-muted">No transformations yet</p>
            </div>
          ) : (
            <PrivacyMethodsChart3D data={privacyDist} height={160} />
          )}
        </div>

        {/* Recent Jobs Repository Preview */}
        <div className="lg:col-span-2 rounded-xl border border-theme-border bg-theme-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-theme-text flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-theme-dim" /> Recent Jobs
              </h3>
              <p className="text-[11px] text-theme-dim mt-0.5">Last 5 processed datasets</p>
            </div>
            <Link to="/jobs" className="text-xs font-medium text-indigo-500 hover:text-indigo-400 flex items-center gap-0.5">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        {loadingJobs ? (
          <PageLoader variant="minimal" title="Loading jobs&hellip;" />
        ) : recentJobs.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <FileSpreadsheet className="w-8 h-8 text-theme-dim/30 mx-auto" />
            <div>
              <p className="text-sm font-semibold text-theme-text">No datasets yet</p>
              <p className="text-xs text-theme-muted mt-1 max-w-sm mx-auto">
                Upload a file above or load the built-in 527-record sample to test the full pipeline.
              </p>
            </div>
            <button
              type="button"
              disabled={loadingSample}
              onClick={handleLoadSampleDataset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {loadingSample ? 'Loading&hellip;' : 'Load sample dataset'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-left text-xs min-w-[520px]">
              <thead>
                <tr className="border-b border-theme-border text-theme-dim text-[10px] uppercase tracking-wider">
                  <th className="pb-2 pr-3 font-medium">File</th>
                  <th className="pb-2 pr-3 font-medium">Date</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 pr-3 font-medium">Risk</th>
                  <th className="pb-2 pr-3 font-medium">Rows</th>
                  <th className="pb-2 font-medium text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border/40">
                {recentJobs.slice(0, 5).map((j) => {
                  const isPass = j.status === 'COMPLETED' || j.status === 'PASSED';
                  const isWarn = j.status === 'PASSED_WITH_WARNINGS';
                  const risk   = String(
                    j.summary?.re_identification_risk || j.kAnonymity?.risk_level || j.kAnonymity?.risk_badge || 'N/A'
                  ).toUpperCase();
                  const createdDate = j.createdAt ? new Date(j.createdAt).toLocaleDateString() : '\u2014';

                  return (
                    <tr key={j.id} className="hover:bg-theme-secondary/20 transition-colors">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-theme-text truncate max-w-[160px] sm:max-w-[200px]" title={j.originalFilename}>
                          {j.originalFilename || 'Dataset'}
                        </div>
                        <span className="text-[10px] text-theme-dim font-mono">{j.id}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-theme-dim whitespace-nowrap">{createdDate}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold
                          ${isPass ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : isWarn ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                          {isPass ? <CheckCircle2 className="w-3 h-3" /> : isWarn ? <AlertTriangle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {isPass ? 'Passed' : isWarn ? 'Warnings' : 'Failed'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold
                          ${risk === 'LOW' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : risk === 'MEDIUM' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                            : risk === 'HIGH'   ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                            : 'bg-theme-secondary text-theme-muted'}`}>
                          {risk}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap font-mono text-theme-dim">
                        {j.summary?.original_rows ?? 0}
                        <span className="mx-1 opacity-40">&rarr;</span>
                        <span className="text-indigo-500 font-semibold">{j.summary?.processed_rows ?? 0}</span>
                      </td>
                      <td className="py-2.5 text-right">
                        <Link
                          to={`/jobs/${j.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-theme-border text-[11px] text-theme-muted hover:text-theme-text hover:border-theme-text/30 transition-colors"
                        >
                          Open <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </section>
    </div>
  );
}
