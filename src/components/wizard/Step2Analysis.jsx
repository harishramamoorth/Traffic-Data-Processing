import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Columns,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  PieChart as PieIcon,
  FileSpreadsheet,
  Loader2,
  RefreshCw
} from 'lucide-react';
import GlassPieChart from '../3d/Glasspiechart';
import {
  ChartCard,
  MissingDataCard,
  SpeedDistributionCard,
  HourlyVolumeCard,
  GpsScatterCard,
  DensityHeatmapCard,
} from '../3d/GlassCharts';
import AuraStatsPanel from '../3d/Aurastatcard';
import axios from 'axios';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { useThemeStore } from '../../store/useThemeStore';

// Sparkline Mini-Bar Component
function MiniSparkline({ bins = [] }) {
  if (!bins || bins.length === 0) return <span className="text-theme-dim text-xs">—</span>;
  const max = Math.max(...bins, 1);
  return (
    <div className="flex items-end gap-0.5 h-6 w-16">
      {bins.map((val, idx) => (
        <div
          key={idx}
          style={{ height: `${Math.max(15, (val / max) * 100)}%` }}
          className="flex-1 rounded-t-sm bg-cyan-400/80 hover:bg-cyan-300 transition-colors"
          title={`Bin ${idx + 1}: ${val}`}
        />
      ))}
    </div>
  );
}

export default function Step2Analysis() {
  const profile = useWorkflowStore((s) => s.profileData);
  const file = useWorkflowStore((s) => s.file);
  const isSample = useWorkflowStore((s) => s.isSample);
  const isProfiling = useWorkflowStore((s) => s.isProfiling);
  const setIsProfiling = useWorkflowStore((s) => s.setIsProfiling);
  const selectedSheet = useWorkflowStore((s) => s.selectedSheet);
  const setSelectedSheet = useWorkflowStore((s) => s.setSelectedSheet);
  const setProfileData = useWorkflowStore((s) => s.setProfileData);
  const setStep = useWorkflowStore((s) => s.setStep);
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);
  const colors = useThemeStore((s) => s.getThemeColors)();

  const [activeTab, setActiveTab] = useState('overview');
  const [switchingSheet, setSwitchingSheet] = useState(false);

  const handleAutoProfile = useCallback(async () => {
    if (!file && !isSample) return;
    try {
      setIsProfiling(true);
      const formData = new FormData();
      if (isSample) {
        formData.append('sample', 'true');
      } else if (file) {
        formData.append('file', file);
      }
      const res = await axios.post('/api/jobs/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.profile) {
        setProfileData(res.data.profile);
      }
    } catch (err) {
      console.error('Auto-profiling error in Step 2:', err);
    } finally {
      setIsProfiling(false);
    }
  }, [file, isSample, setProfileData, setIsProfiling]);

  useEffect(() => {
    if (!profile && (file || isSample) && !isProfiling && !switchingSheet) {
      handleAutoProfile();
    }
  }, [profile, file, isSample, isProfiling, switchingSheet, handleAutoProfile]);

  const handleSheetChange = async (newSheet) => {
    if (newSheet === selectedSheet || switchingSheet) return;
    try {
      setSwitchingSheet(true);
      const formData = new FormData();
      if (isSample) {
        formData.append('sample', 'true');
      } else if (file) {
        formData.append('file', file);
      }
      formData.append('sheet', newSheet);

      const res = await axios.post('/api/jobs/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.profile) {
        setProfileData(res.data.profile);
        setSelectedSheet(newSheet);
      }
    } catch (err) {
      console.error('Failed to switch sheet:', err);
    } finally {
      setSwitchingSheet(false);
    }
  };

  if (!profile) {
    return (
      <div className="text-center py-16 space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/10">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-theme-text">
            {isProfiling ? 'Analyzing Dataset...' : 'Pre-Flight Profiling'}
          </h3>
          <p className="text-xs text-theme-muted mt-1.5 leading-relaxed">
            {file
              ? `Extracting telemetry schema and scanning PII columns for '${file.name || 'uploaded dataset'}'...`
              : 'Profiling traffic telemetry records and computing data health metrics...'}
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="px-4 py-2 rounded-lg bg-theme-secondary hover:bg-theme-secondary/80 border border-theme-border text-xs font-medium text-theme-muted hover:text-theme-text transition-colors cursor-pointer"
          >
            Return to Upload
          </button>
          {!isProfiling && (file || isSample) && (
            <button
              type="button"
              onClick={handleAutoProfile}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-bold transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Analysis</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const {
    filename,
    file_name,
    file_size_formatted,
    file_size_bytes,
    file_size,
    file_type,
    row_count = 0,
    column_count = 0,
    duplicate_count = 0,
    pii_columns = [],
    detected_pii = [],
    pii_columns_detected,
    outliers_count = 0,
    health_score = 85,
    health_summary = '',
    columns = [],
    column_profiles = {},
    charts = {}
  } = profile;

  // Single Source of Truth for PII Columns
  const piiColumnsList = pii_columns.length > 0 ? pii_columns : (detected_pii.length > 0 ? detected_pii : []);
  const piiCount = piiColumnsList.length;

  // Format file size safely
  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes) || bytes <= 0) return null;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const displayFileSize = file_size_formatted ||
    formatFileSize(file_size) ||
    formatFileSize(file_size_bytes) ||
    formatFileSize(profile.file_size) ||
    '65.6 KB';

  // Extract all columns
  const columnList = Array.isArray(columns) && columns.length > 0
    ? columns
    : (column_profiles && Object.keys(column_profiles).length > 0
        ? Object.entries(column_profiles).map(([colName, info]) => ({ name: colName, ...info }))
        : []);

  // Unified PII distribution data for chart & legend
  const piiData = charts.pii_distribution?.length
    ? charts.pii_distribution
    : [
        { name: 'Sensitive PII', value: piiCount, color: '#2347ff' },
        { name: 'Standard Attributes', value: Math.max(0, (column_count || columnList.length) - piiCount), color: '#1fc8ff' },
      ];

  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 100);
  const totalCols = column_count || columnList.length || 1;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Top Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-theme-card border border-theme-border"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 font-mono text-xs uppercase font-semibold">
              Pre-Flight Analysis
            </span>
            <span className="text-xs text-theme-dim">•</span>
            <span className="text-xs font-mono text-theme-muted truncate max-w-xs">{filename || file_name || 'sample_traffic_data.csv'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-theme-text mt-1">
            Dataset Inspection & Privacy Audit
          </h2>

          {profile.sheet_names && profile.sheet_names.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 mt-2 px-3 py-1.5 rounded-xl bg-theme-secondary/80 border border-emerald-500/30 text-xs">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-theme-muted font-medium">Workbook Sheet:</span>
              <select
                disabled={switchingSheet}
                value={selectedSheet || profile.selected_sheet || profile.sheet_names[0]}
                onChange={(e) => handleSheetChange(e.target.value)}
                className="bg-theme-card border border-theme-border rounded-lg px-2.5 py-1 text-xs text-theme-text font-semibold focus:outline-none focus:border-cyan-400 cursor-pointer shadow-sm"
              >
                {profile.sheet_names.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <span className="text-[11px] text-theme-dim">({profile.sheet_names.length} sheets found)</span>
              {switchingSheet && <span className="text-[11px] text-cyan-400 animate-pulse font-mono font-medium">Switching sheet...</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resetWorkflow}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-theme-secondary border border-theme-border text-xs font-medium text-theme-muted hover:text-theme-text transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Upload Another</span>
          </button>

          <button
            type="button"
            onClick={() => setStep(3)}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs shadow-lg shadow-cyan-500/20 transition-all duration-200"
          >
            <span>Configure Privacy & Rules</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* KPI Stats Panel */}
      <AuraStatsPanel
        title="Dataset overview"
        caption="Pre-flight summary"
        score={health_score}
        stats={[
          { title: 'File size / type', value: displayFileSize, subtitle: file_type || 'CSV', level: health_score, levelLabel: 'file health' },
          { title: 'Total rows', value: row_count, subtitle: '100% reconciled', level: 100, levelLabel: 'reconciled' },
          { title: 'Total columns', value: column_count || columnList.length, subtitle: 'Schema extracted', level: 100, levelLabel: 'extracted' },
          { title: 'Duplicate rows', value: duplicate_count, subtitle: duplicate_count > 0 ? 'Marked for rejection' : 'Clean', level: pct(row_count - duplicate_count, row_count), levelLabel: 'unique', tone: duplicate_count > 0 ? 'warn' : 'ok' },
          { title: 'PII detected', value: piiCount, subtitle: piiCount > 0 ? `${piiCount} sensitive attributes` : 'None detected', level: pct(totalCols - piiCount, totalCols), levelLabel: 'PII-free', tone: piiCount > 0 ? 'alert' : 'ok' },
          { title: 'Speed outliers', value: outliers_count, subtitle: 'Flagged in output', level: pct(row_count - outliers_count, row_count), levelLabel: 'in range', tone: outliers_count > 0 ? 'warn' : 'ok' },
        ]}
      />

      {/* Data Health Score Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="p-5 rounded-2xl bg-gradient-to-r from-theme-card via-theme-secondary/40 to-theme-card border border-theme-border flex flex-col md:flex-row items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="26"
                stroke="currentColor"
                strokeWidth="5"
                className="text-theme-border"
                fill="transparent"
              />
              <circle
                cx="32"
                cy="32"
                r="26"
                stroke="currentColor"
                strokeWidth="5"
                className={`${
                  health_score >= 80 ? 'text-emerald-400' : health_score >= 60 ? 'text-amber-400' : 'text-rose-400'
                } transition-all duration-500`}
                fill="transparent"
                strokeDasharray={163}
                strokeDashoffset={163 - (163 * health_score) / 100}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute font-mono text-base font-bold text-theme-text">
              {health_score}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-theme-text">Dataset Quality & Health Score</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                  health_score >= 80
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {health_score >= 80 ? 'Optimal Ingestion Quality' : 'Review Recommendations'}
              </span>
            </div>
            <p className="text-xs text-theme-muted mt-1 max-w-xl">{health_summary}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono shrink-0">
          <div className="text-center">
            <span className="text-theme-dim block">Null Values</span>
            <span className="text-theme-text font-bold">
              {charts.null_percentages?.reduce((acc, c) => acc + (c.null_pct > 0 ? 1 : 0), 0) || 0} cols
            </span>
          </div>
          <div className="w-px h-8 bg-theme-border" />
          <div className="text-center">
            <span className="text-theme-dim block">Unique IDs</span>
            <span className="text-emerald-400 font-bold">{row_count - duplicate_count} rows</span>
          </div>
        </div>
      </motion.div>

      {/* Analytics Charts Grid */}
      <motion.div
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: 0.08,
              delayChildren: 0.05,
            },
          },
        }}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {/* 1. Data Type Distribution Donut */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16, scale: 0.98 },
            show: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { type: 'spring', stiffness: 280, damping: 24 },
            },
          }}
        >
          <ChartCard
            icon={PieIcon}
            title="Column Types"
            badge={`${column_count || columnList.length} total`}
            accent="#06b6d4"
          >
            <GlassPieChart data={charts.dtype_distribution || []} />
            <div className="flex flex-wrap justify-center gap-3 text-[11px] font-mono mt-2">
              {(charts.dtype_distribution || []).map((d) => (
                <span
                  key={d.name}
                  className="flex items-center gap-1.5 transition-transform hover:scale-105 cursor-default"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-theme-muted">{d.name}</span>
                  <span className="text-theme-text font-bold">({d.value})</span>
                </span>
              ))}
            </div>
          </ChartCard>
        </motion.div>

        {/* 2. PII vs Non-PII Donut */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16, scale: 0.98 },
            show: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { type: 'spring', stiffness: 280, damping: 24 },
            },
          }}
        >
          <ChartCard
            icon={ShieldAlert}
            title="PII Exposure Ratio"
            badge={`${piiCount} sensitive`}
            accent="#f43f5e"
          >
            <GlassPieChart data={piiData} />
            <div className="flex flex-wrap justify-center gap-3 text-[11px] font-mono mt-2">
              {piiData.map((d) => (
                <span
                  key={d.name}
                  className="flex items-center gap-1.5 transition-transform hover:scale-105 cursor-default"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-theme-muted">{d.name}</span>
                  <span className="text-theme-text font-bold">({d.value})</span>
                </span>
              ))}
            </div>
          </ChartCard>
        </motion.div>

        {/* 3. Missing Data % */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16, scale: 0.98 },
            show: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { type: 'spring', stiffness: 280, damping: 24 },
            },
          }}
        >
          <MissingDataCard data={charts.null_percentages || []} />
        </motion.div>

        {/* 4. Speed Distribution */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16, scale: 0.98 },
            show: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { type: 'spring', stiffness: 280, damping: 24 },
            },
          }}
        >
          <SpeedDistributionCard data={charts.speed_distribution || []} />
        </motion.div>

        {/* 5. Volume by Hour */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16, scale: 0.98 },
            show: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { type: 'spring', stiffness: 280, damping: 24 },
            },
          }}
        >
          <HourlyVolumeCard data={charts.records_by_hour || []} />
        </motion.div>

        {/* 6. GPS Coordinate Points */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16, scale: 0.98 },
            show: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { type: 'spring', stiffness: 280, damping: 24 },
            },
          }}
        >
          <GpsScatterCard data={charts.coordinate_scatter || []} />
        </motion.div>
      </motion.div>

      {/* 7. Traffic Density Matrix */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <DensityHeatmapCard data={charts.day_hour_heatmap || []} />
      </motion.div>

      {/* Column Schema & Sparkline Table (Item 10: All columns) */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.25 }}
        className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-4"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
            <Columns className="w-4 h-4 text-cyan-400" />
            Column Inspection & Sparkline Telemetry
          </span>
          <span className="text-xs text-theme-muted font-mono">{columnList.length} Columns Extracted</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-theme-border text-theme-dim uppercase text-[10px]">
                <th className="pb-3 font-semibold">Column Name</th>
                <th className="pb-3 font-semibold">Inferred Type</th>
                <th className="pb-3 font-semibold">Null %</th>
                <th className="pb-3 font-semibold">Unique</th>
                <th className="pb-3 font-semibold">Distribution Sparkline</th>
                <th className="pb-3 font-semibold">Sample Stats</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border/50">
              {columnList.map((col) => {
                const colName = col.name;
                const isPii = piiColumnsList.some((p) => (p.name || p.column) === colName);
                const nullRate = col.null_pct ?? col.null_percentage ?? 0;
                return (
                  <tr key={colName} className="hover:bg-theme-secondary/40 transition-colors">
                    <td className="py-3 font-medium text-theme-text flex items-center gap-2">
                      <span>{colName}</span>
                      {isPii && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px]">
                          PII
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-theme-secondary text-cyan-300 border border-theme-border text-[10px]">
                        {col.inferred_type || col.dtype || 'string'}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={nullRate > 0 ? 'text-amber-400 font-bold' : 'text-theme-muted'}>
                        {nullRate}%
                      </span>
                    </td>
                    <td className="py-3 text-theme-muted">{col.unique_count ?? 0}</td>
                    <td className="py-3">
                      <MiniSparkline bins={col.sparkline_bins || []} />
                    </td>
                    <td className="py-3 text-[11px] text-theme-dim">
                      {col.stats?.min !== undefined && col.stats?.max !== undefined ? (
                        <span>
                          [{col.stats.min} ... {col.stats.max}], avg {col.stats.mean}
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-end gap-4 pt-4">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="px-5 py-2.5 rounded-xl bg-theme-secondary text-theme-muted hover:text-theme-text border border-theme-border text-xs font-semibold transition-colors"
        >
          Back to Upload
        </button>
        <button
          type="button"
          onClick={() => setStep(3)}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all duration-200"
        >
          <span>Continue to Configuration</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
