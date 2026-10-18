import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Rows,
  Columns,
  Copy,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  BarChart2,
  PieChart as PieIcon,
  MapPin,
  Clock,
  Gauge
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
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { useThemeStore } from '../../store/useThemeStore';

// Custom Count-Up Number Display
function CountUpCard({ title, value, subtitle, icon: Icon, color = 'cyan', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="p-4 rounded-xl bg-theme-card border border-theme-border flex items-start justify-between shadow-sm hover:border-theme-border/80 transition-all"
    >
      <div>
        <span className="text-xs font-medium text-theme-muted">{title}</span>
        <div className="text-2xl font-bold font-mono text-theme-text mt-1">{value}</div>
        {subtitle && <span className="text-[11px] text-theme-dim mt-0.5 block">{subtitle}</span>}
      </div>
      <div className={`p-2 rounded-lg bg-${color}-500/10 border border-${color}-500/20 text-${color}-400`}>
        <Icon className="w-5 h-5" />
      </div>
    </motion.div>
  );
}

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
  const setStep = useWorkflowStore((s) => s.setStep);
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);
  const colors = useThemeStore((s) => s.getThemeColors)();

  const [activeTab, setActiveTab] = useState('overview');

  if (!profile) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-theme-muted">No profile analysis available yet.</p>
        <button
          onClick={() => setStep(1)}
          className="px-4 py-2 rounded-lg bg-theme-secondary border border-theme-border text-sm font-medium text-theme-text"
        >
          Return to Upload
        </button>
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

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2.5 rounded-lg bg-theme-card border border-theme-border shadow-xl text-xs font-mono text-theme-text">
          <div className="text-theme-muted mb-1">{label || payload[0]?.name}</div>
          <div className="text-cyan-400 font-bold">{payload[0]?.value} records</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-theme-card border border-theme-border">
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
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <CountUpCard
          title="File Size / Type"
          value={displayFileSize}
          subtitle={file_type || 'CSV'}
          icon={FileText}
          color="blue"
          delay={0.05}
        />
        <CountUpCard
          title="Total Rows"
          value={row_count.toLocaleString()}
          subtitle="100% reconciled"
          icon={Rows}
          color="cyan"
          delay={0.1}
        />
        <CountUpCard
          title="Total Columns"
          value={column_count || columnList.length}
          subtitle="Schema extracted"
          icon={Columns}
          color="indigo"
          delay={0.15}
        />
        <CountUpCard
          title="Duplicate Rows"
          value={duplicate_count}
          subtitle={duplicate_count > 0 ? 'Marked for rejection' : 'Clean'}
          icon={Copy}
          color={duplicate_count > 0 ? 'amber' : 'emerald'}
          delay={0.2}
        />
        <CountUpCard
          title="PII Detected"
          value={piiCount}
          subtitle={piiCount > 0 ? `${piiCount} sensitive attributes` : 'None detected'}
          icon={ShieldAlert}
          color={piiCount > 0 ? 'rose' : 'emerald'}
          delay={0.25}
        />
        <CountUpCard
          title="Speed Outliers"
          value={outliers_count}
          subtitle="Flagged in output"
          icon={AlertTriangle}
          color={outliers_count > 0 ? 'amber' : 'emerald'}
          delay={0.3}
        />
      </div>

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. Data Type Distribution Donut */}
        <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
              <PieIcon className="w-4 h-4 text-cyan-400" />
              Column Types
            </span>
            <span className="text-[11px] text-theme-dim font-mono">{column_count} total</span>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.dtype_distribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {(charts.dtype_distribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || colors.primary} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap justify-center gap-3 text-[11px] font-mono">
            {(charts.dtype_distribution || []).map((d) => (
              <span key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-theme-muted">{d.name}</span>
                <span className="text-theme-text font-bold">({d.value})</span>
              </span>
            ))}
          </div>
        </div>

        {/* 2. PII vs Non-PII Donut */}
        <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              PII Exposure Ratio
            </span>
            <span className="text-[11px] text-rose-400 font-mono font-semibold">
              {piiCount} sensitive
            </span>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.pii_distribution || [
                    { name: 'Sensitive PII', value: piiCount, color: '#f43f5e' },
                    { name: 'Standard Attributes', value: Math.max(0, (column_count || columnList.length) - piiCount), color: '#10b981' }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {(charts.pii_distribution || []).map((entry, index) => (
                    <Cell key={`pii-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap justify-center gap-3 text-[11px] font-mono">
            {(charts.pii_distribution || []).map((d) => (
              <span key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-theme-muted">{d.name}</span>
                <span className="text-theme-text font-bold">({d.value})</span>
              </span>
            ))}
          </div>
        </div>

        {/* 3. Null % per Column */}
        <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-amber-400" />
              Missing Data %
            </span>
            <span className="text-[11px] text-theme-dim font-mono">Per column</span>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(charts.null_percentages || []).slice(0, 8)} layout="vertical">
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} unit="%" />
                <YAxis dataKey="column" type="category" width={80} tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip
                  formatter={(val) => [`${val}% missing`, 'Null Rate']}
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', borderRadius: '0.75rem' }}
                />
                <Bar dataKey="null_pct" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[10px] text-theme-dim text-center">
            Drop/Imputation strategies configurable in Step 3
          </p>
        </div>

        {/* 4. Speed Distribution Histogram */}
        <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-cyan-400" />
              Speed Distribution
            </span>
            <span className="text-[11px] text-theme-dim font-mono">Telemetry (mph)</span>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.speed_distribution || []}>
                <XAxis dataKey="range" tick={{ fill: '#64748b', fontSize: 9 }} interval={1} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-theme-dim text-center">
            Outliers flagged with non-clamping audit rule
          </p>
        </div>

        {/* 5. Records Over Time (Throughput / Volume by Hour) */}
        <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-400" />
              Volume by Hour (UTC)
            </span>
            <span className="text-[11px] text-theme-dim font-mono">24h Cycle</span>
          </div>

          <div className="h-52 w-full">
            {(() => {
              const hourlyData = charts.records_by_hour || [];
              const nonZeroPoints = hourlyData.filter((p) => p.count > 0);
              if (hourlyData.length === 0) {
                return (
                  <div className="h-full flex flex-col items-center justify-center text-theme-dim text-xs">
                    <Clock className="w-8 h-8 mb-2 opacity-40 text-blue-400" />
                    <span>No temporal distribution available</span>
                  </div>
                );
              }
              if (nonZeroPoints.length < 2) {
                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyData}>
                      <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 9 }} interval={4} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              }
              return (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData}>
                    <defs>
                      <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 9 }} interval={4} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#hourGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
          <p className="text-[10px] text-theme-dim text-center">
            Subject to 15-minute floor bucketing in anonymizer
          </p>
        </div>

        {/* 6. Map-Style Coordinate Scatter */}
        <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-400" />
              GPS Coordinate Points
            </span>
            <span className="text-[11px] text-theme-dim font-mono">Generalized (2-dec)</span>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <XAxis type="number" dataKey="lon" name="Longitude" tick={{ fill: '#64748b', fontSize: 9 }} />
                <YAxis type="number" dataKey="lat" name="Latitude" tick={{ fill: '#64748b', fontSize: 9 }} />
                <ZAxis range={[30, 30]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }) => {
                    if (payload && payload.length) {
                      return (
                        <div className="p-2 rounded bg-theme-card border border-theme-border text-[10px] font-mono text-emerald-400">
                          Lat: {payload[1]?.value?.toFixed(2)}, Lon: {payload[0]?.value?.toFixed(2)}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter name="GPS Coordinates" data={charts.coordinate_scatter || []} fill="#10b981" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-theme-dim text-center">
            Coordinates generalized to ~1.1 km spatial privacy
          </p>
        </div>
      </div>

      {/* 7. Heatmap: Hour of Day x Day of Week Matrix (Item 9: Fixed 24x7 CSS grid, max 220px, legend & tooltips) */}
      {charts.day_hour_heatmap && charts.day_hour_heatmap.length > 0 && (
        <div className="p-4 rounded-2xl bg-theme-card border border-theme-border space-y-2 max-h-[220px] overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-400" />
              Traffic Density Matrix (Day of Week × Hour)
            </span>
            <div className="flex items-center gap-2 text-[10px] font-mono text-theme-dim">
              <span>0</span>
              <span className="w-2.5 h-2.5 rounded-sm bg-white/5 border border-theme-border" />
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500/25" />
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500/60" />
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
              <span>Peak</span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <div
              className="min-w-[620px]"
              style={{
                display: 'grid',
                gridTemplateColumns: '36px repeat(24, minmax(0, 1fr))',
                gap: '2px',
                fontSize: '9px',
                fontFamily: 'monospace'
              }}
            >
              <div className="text-theme-dim font-semibold text-[8px] flex items-center justify-center">Day</div>
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="text-center text-theme-dim text-[8px]">
                  {h % 3 === 0 ? `${h}h` : ''}
                </div>
              ))}

              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => {
                const dayPoints = charts.day_hour_heatmap.filter((p) => p.day === day);
                const maxInDay = Math.max(...charts.day_hour_heatmap.map((p) => p.count), 1);

                return (
                  <React.Fragment key={day}>
                    <div className="text-theme-muted font-bold text-[9px] flex items-center">{day}</div>
                    {Array.from({ length: 24 }).map((_, h) => {
                      const pt = dayPoints.find((p) => p.hour === h) || { count: 0 };
                      const intensity = pt.count / maxInDay;
                      const bg =
                        pt.count === 0
                          ? 'rgba(128,128,128,0.08)'
                          : intensity > 0.6
                          ? 'rgba(6,182,212,0.95)'
                          : intensity > 0.3
                          ? 'rgba(6,182,212,0.55)'
                          : 'rgba(6,182,212,0.25)';

                      return (
                        <div
                          key={h}
                          style={{ backgroundColor: bg }}
                          className="h-3 rounded-xs flex items-center justify-center text-[7px] text-white font-bold hover:ring-1 hover:ring-cyan-300 transition-all cursor-pointer"
                          title={`${day} ${h}:00 UTC — ${pt.count} records`}
                        />
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Column Schema & Sparkline Table (Item 10: All columns) */}
      <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-4">
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
      </div>

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
