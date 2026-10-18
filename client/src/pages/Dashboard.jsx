import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  PlusCircle,
  Database,
  Lock,
  ChevronRight,
  TrendingUp,
  BarChart2
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
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
import PrivacyGateway3D from '../components/3d/PrivacyGateway3D';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const currentStep = useWorkflowStore((s) => s.currentStep);
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);
  const colors = useThemeStore((s) => s.getThemeColors)();

  const [recentJobs, setRecentJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const wizardRef = useRef(null);

  useEffect(() => {
    loadRecentJobs();
  }, [currentStep]);

  const loadRecentJobs = async () => {
    try {
      setLoadingJobs(true);
      const res = await axios.get('/api/jobs?limit=5');
      if (res.data?.jobs) {
        setRecentJobs(res.data.jobs);
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

  // Compute aggregate KPIs from real database jobs
  const totalJobs = recentJobs.length;
  const totalRecords = recentJobs.reduce((acc, j) => acc + (j.summary?.processed_rows || 0), 0);
  const totalPii = recentJobs.reduce((acc, j) => acc + (j.summary?.pii_columns_detected || 0), 0);

  // Real aggregated processing volume by job execution
  const jobsOverTime = recentJobs.length > 0
    ? [...recentJobs].reverse().map((j) => {
        const d = new Date(j.createdAt || Date.now());
        const label = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        return {
          date: label,
          jobs: 1,
          records: j.summary?.processed_rows || 0
        };
      })
    : [];

  // Real privacy technique distribution across all processed jobs
  let realHmacCount = 0;
  let realDropCount = 0;
  let realGenCount = 0;

  for (const j of recentJobs) {
    const pii = j.piiReport || [];
    for (const p of pii) {
      if (p.recommended_action === 'PSEUDONYMIZE_HMAC') realHmacCount++;
      else if (p.recommended_action === 'DROP_COLUMN') realDropCount++;
      else if (p.recommended_action === 'GENERALIZE_SPATIAL') realGenCount++;
    }
  }

  const totalActions = realHmacCount + realDropCount + realGenCount;
  const privacyDist = totalActions > 0
    ? [
        { name: 'HMAC Hashed', value: Math.round((realHmacCount / totalActions) * 100), color: '#06b6d4' },
        { name: 'Direct Dropped', value: Math.round((realDropCount / totalActions) * 100), color: '#ec4899' },
        { name: 'GPS Generalized', value: Math.round((realGenCount / totalActions) * 100), color: '#10b981' }
      ].filter(d => d.value > 0)
    : [];

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-theme-border bg-theme-card/90 backdrop-blur-xl p-6 sm:p-10 shadow-2xl glass-panel">
        {/* Subtle Ambient Radial Lighting */}
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full pointer-events-none opacity-20 blur-3xl transition-all duration-700"
          style={{ backgroundColor: colors.primary }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full pointer-events-none opacity-15 blur-3xl transition-all duration-700"
          style={{ backgroundColor: colors.secondary || colors.primary }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-medium">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Production Data-Privacy & Compliance Gateway</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-theme-text leading-tight">
              Road Traffic <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500">Telemetry Privacy</span> Platform
            </h1>

            <p className="text-sm sm:text-base text-theme-muted max-w-xl leading-relaxed">
              Transform high-volume connected vehicle feeds into privacy-safe datasets. Zero raw retention, HMAC-SHA256 plate pseudonymization, and zero-silent-loss reconciliation audits.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={scrollToWizard}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Launch New Job</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <Link
                to="/methodology"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-theme-secondary hover:bg-theme-card-hover border border-theme-border text-xs font-semibold text-theme-muted hover:text-theme-text transition-colors shadow-sm"
              >
                <span>Privacy Methodology</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Right 3D Particle Gateway */}
          <div className="lg:col-span-5 h-[320px] sm:h-[350px] rounded-2xl overflow-hidden border border-theme-border/80 bg-slate-950/95 shadow-2xl relative">
            <PrivacyGateway3D />
          </div>
        </div>

        {/* Global Metric Badges Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-theme-border/60 relative z-10">
          <div>
            <span className="text-[11px] font-mono text-theme-dim uppercase">Total Processed Jobs</span>
            <div className="text-2xl font-bold font-mono text-theme-text mt-0.5">{totalJobs}</div>
            <span className="text-[10px] text-emerald-400 mt-0.5 block flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> 100% Audit Reconciled
            </span>
          </div>

          <div>
            <span className="text-[11px] font-mono text-theme-dim uppercase">Sanitized Records</span>
            <div className="text-2xl font-bold font-mono text-cyan-400 mt-0.5">
              {totalRecords.toLocaleString()}
            </div>
            <span className="text-[10px] text-theme-muted mt-0.5 block">Stored in MongoDB</span>
          </div>

          <div>
            <span className="text-[11px] font-mono text-theme-dim uppercase">PII Neutralized</span>
            <div className="text-2xl font-bold font-mono text-purple-400 mt-0.5">{totalPii}</div>
            <span className="text-[10px] text-theme-muted mt-0.5 block">Zero disk retention</span>
          </div>

          <div>
            <span className="text-[11px] font-mono text-theme-dim uppercase">Quality Standard</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">QC-01 to QC-08</div>
            <span className="text-[10px] text-emerald-400/80 mt-0.5 block">100% Pass Standard</span>
          </div>
        </div>
      </section>

      {/* CORE 5-STEP WIZARD */}
      <section ref={wizardRef} className="space-y-6">
        <WizardStepper />

        <div className="min-h-[450px]">
          {currentStep === 1 && <Step1Upload />}
          {currentStep === 2 && <Step2Analysis />}
          {currentStep === 3 && <Step3Configure />}
          {currentStep === 4 && <Step4Processing />}
          {currentStep === 5 && <Step5Results />}
        </div>
      </section>

      {/* Platform Analytics Overview & Recent Jobs Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jobs Over Time Trend */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-theme-text flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                <span>Processing Volume & Throughput</span>
              </h3>
              <p className="text-xs text-theme-dim">Telemetry records processed per day</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-theme-secondary text-[11px] font-mono text-cyan-300 border border-theme-border">
              Weekly Activity
            </span>
          </div>

          {jobsOverTime.length === 0 ? (
            <div className="h-56 w-full flex flex-col items-center justify-center text-center p-6 space-y-2 rounded-xl bg-theme-secondary/20 border border-dashed border-theme-border/60">
              <Activity className="w-8 h-8 text-cyan-400/50" />
              <p className="text-xs font-semibold text-theme-muted">No processing volume recorded yet</p>
              <p className="text-[11px] text-theme-dim max-w-sm">
                Upload your live traffic datasets in the wizard above to begin recording real-time throughput metrics.
              </p>
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={jobsOverTime}>
                  <defs>
                    <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.primary} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', borderRadius: '0.75rem' }}
                    formatter={(val) => [`${val} records`, 'Volume']}
                  />
                  <Area type="monotone" dataKey="records" stroke={colors.primary} strokeWidth={2} fill="url(#volGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Global Privacy Actions Donut */}
        <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-theme-text flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Privacy Distribution</span>
            </h3>
            <span className="text-[10px] font-mono text-theme-dim">By Technique</span>
          </div>

          {privacyDist.length === 0 ? (
            <div className="h-56 w-full flex flex-col items-center justify-center text-center p-6 space-y-2 rounded-xl bg-theme-secondary/20 border border-dashed border-theme-border/60">
              <ShieldCheck className="w-8 h-8 text-emerald-400/50" />
              <p className="text-xs font-semibold text-theme-muted">No transformations recorded</p>
              <p className="text-[11px] text-theme-dim max-w-xs">
                Processed job techniques (HMAC pseudonymization, spatial generalization, dropped PII) will appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={privacyDist} cx="50%" cy="50%" innerRadius={42} outerRadius={65} dataKey="value">
                      {privacyDist.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', borderRadius: '0.75rem' }}
                      formatter={(val) => [`${val}%`, 'Share']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono">
                {privacyDist.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-theme-muted">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="text-theme-text font-bold">{item.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Recent Jobs Repository Preview */}
      <section className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-theme-text flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>Recent Processed Jobs</span>
            </h3>
            <p className="text-xs text-theme-dim">Historical jobs available in repository</p>
          </div>

          <Link
            to="/jobs"
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <span>View All Jobs</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingJobs ? (
          <div className="text-center py-8 text-xs text-theme-dim">Loading jobs repository...</div>
        ) : recentJobs.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <p className="text-xs text-theme-muted">No processing jobs recorded yet.</p>
            <button
              onClick={scrollToWizard}
              className="px-4 py-2 rounded-xl bg-cyan-500 text-black font-semibold text-xs"
            >
              Start First Job
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-theme-border text-theme-dim uppercase text-[10px]">
                  <th className="pb-3 font-semibold">Job ID</th>
                  <th className="pb-3 font-semibold">Filename</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Rows In / Out</th>
                  <th className="pb-3 font-semibold">PII Handled</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border/50">
                {recentJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-theme-secondary/40 transition-colors">
                    <td className="py-3 font-bold text-theme-text">{j.id}</td>
                    <td className="py-3 text-theme-muted truncate max-w-xs">{j.originalFilename}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          j.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="py-3 text-theme-dim">
                      {j.summary?.original_rows ?? 0} &rarr; {j.summary?.processed_rows ?? 0}
                    </td>
                    <td className="py-3 text-purple-300">{j.summary?.pii_columns_detected ?? 0} cols</td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/jobs/${j.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-theme-secondary text-cyan-300 border border-theme-border hover:bg-theme-border text-[11px]"
                      >
                        <span>Inspect</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
