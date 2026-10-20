import React, { useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
} from 'recharts';
import { BarChart2, Gauge, Clock, MapPin, CheckCircle2, Flame } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Shared building blocks                                             */
/* ------------------------------------------------------------------ */

const AXIS = {
  tick: { fill: '#94a3b8', fontSize: 10 },
  axisLine: false,
  tickLine: false,
};
const GRID = { stroke: 'currentColor', strokeOpacity: 0.08, strokeDasharray: '3 5', vertical: false };

/** Card shell: same radius/border as the rest of the page + a soft accent glow in the corner + motion lift. */
export function ChartCard({ icon: Icon, title, badge, accent = '#06b6d4', footer, children, className = '' }) {
  return (
    <motion.div
      whileHover={{ y: -4, transition: { type: 'spring', stiffness: 350, damping: 25 } }}
      className={`group relative overflow-hidden p-5 rounded-2xl bg-theme-card border border-theme-border hover:border-cyan-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/[0.04] space-y-4 ${className}`}
      style={{ willChange: 'transform' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full opacity-[0.14] group-hover:opacity-[0.24] group-hover:scale-110 transition-all duration-500 blur-3xl"
        style={{ background: accent }}
      />
      <div className="relative flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
          <Icon className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" style={{ color: accent }} />
          {title}
        </span>
        {badge && <span className="text-[11px] text-theme-dim font-mono">{badge}</span>}
      </div>
      <div className="relative">{children}</div>
      {footer && <p className="relative text-[10px] text-theme-dim text-center">{footer}</p>}
    </motion.div>
  );
}

function Chip({ label, value, color }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl bg-theme-secondary/60 border border-theme-border px-3 py-1.5">
      <div className="text-[10px] text-theme-dim truncate">{label}</div>
      <div className="text-xs font-mono font-bold truncate" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function GlassTooltip({ active, payload, label, unit = 'records', format }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-theme-border bg-theme-card/90 backdrop-blur-md px-3 py-2 shadow-xl text-xs font-mono">
      <div className="text-theme-muted mb-0.5">{label ?? p.name}</div>
      <div className="font-bold text-theme-text">
        {format ? format(p.value) : p.value} <span className="text-theme-dim font-normal">{unit}</span>
      </div>
    </div>
  );
}

const nonEmpty = (arr) => Array.isArray(arr) && arr.length > 0;

function Empty({ icon: Icon, text }) {
  return (
    <div className="h-52 flex flex-col items-center justify-center text-theme-dim text-xs gap-2">
      <Icon className="w-8 h-8 opacity-40" />
      <span>{text}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  1. Missing data: progress rows instead of a mostly empty bar chart */
/* ------------------------------------------------------------------ */

export function MissingDataCard({ data = [] }) {
  const rows = useMemo(
    () =>
      data
        .filter((d) => d && d.column && String(d.column).trim() !== '')
        .map((d) => ({ column: String(d.column).trim(), pct: Number(d.null_pct) || 0 }))
        .sort((a, b) => b.pct - a.pct),
    [data]
  );
  const withGaps = rows.filter((r) => r.pct > 0).length;

  return (
    <ChartCard
      icon={BarChart2}
      title="Missing Data %"
      accent="#f59e0b"
      badge={rows.length ? `${withGaps} of ${rows.length} columns` : 'Per column'}
      footer="Drop/Imputation strategies configurable in Step 3"
    >
      {rows.length === 0 ? (
        <Empty icon={BarChart2} text="No column data" />
      ) : withGaps === 0 ? (
        <div className="h-52 flex flex-col items-center justify-center gap-2 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          <div className="text-sm font-semibold text-theme-text">All {rows.length} columns complete</div>
          <div className="text-xs text-theme-dim">No missing values found</div>
        </div>
      ) : (
        <div className="h-52 overflow-y-auto pr-1 space-y-2.5">
          {rows.slice(0, 8).map((r, i) => (
            <motion.div
              key={r.column}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04, ease: 'easeOut' }}
              className="group/row"
            >
              <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                <span className="text-theme-muted group-hover/row:text-theme-text transition-colors truncate pr-2">
                  {r.column}
                </span>
                <span className={r.pct > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {r.pct > 0 ? `${r.pct}%` : '✓'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-theme-secondary overflow-hidden relative">
                <motion.div
                  className="h-full rounded-full relative"
                  style={{ background: 'linear-gradient(90deg,#fbbf24,#f43f5e)' }}
                  initial={{ width: 0 }}
                  animate={{ width: r.pct > 0 ? `${Math.max(r.pct, 3)}%` : 0 }}
                  transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/*  2. Speed distribution                                              */
/* ------------------------------------------------------------------ */

export function SpeedDistributionCard({ data = [] }) {
  const uid = useId().replace(/:/g, '');
  const [hoverIndex, setHoverIndex] = useState(null);
  const { peak, total } = useMemo(() => {
    const peak = data.reduce((m, d) => (d.count > (m?.count ?? -1) ? d : m), null);
    return { peak, total: data.reduce((s, d) => s + (Number(d.count) || 0), 0) };
  }, [data]);

  return (
    <ChartCard
      icon={Gauge}
      title="Speed Distribution"
      accent="#06b6d4"
      badge="Telemetry (mph)"
      footer="Outliers flagged with non-clamping audit rule"
    >
      {!nonEmpty(data) ? (
        <Empty icon={Gauge} text="No speed data" />
      ) : (
        <>
          <div className="h-44 w-full text-theme-text">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
                barCategoryGap="16%"
                onMouseMove={(state) => {
                  if (state && state.activeTooltipIndex !== undefined) {
                    setHoverIndex(state.activeTooltipIndex);
                  }
                }}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  <linearGradient id={`${uid}-bar`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#22d3ee" />
                    <stop offset="1" stopColor="#2563eb" stopOpacity="0.85" />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="range" {...AXIS} interval={0} tickFormatter={(v) => String(v).replace(/\s*mph/i, '')} />
                <YAxis {...AXIS} />
                <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)', radius: 6 }} content={<GlassTooltip />} />
                <Bar dataKey="count" radius={[7, 7, 2, 2]} animationDuration={800} animationEasing="ease-out">
                  {data.map((d, i) => (
                    <Cell
                      key={i}
                      fill={`url(#${uid}-bar)`}
                      fillOpacity={
                        hoverIndex !== null
                          ? hoverIndex === i
                            ? 1
                            : 0.38
                          : d === peak
                          ? 1
                          : 0.65
                      }
                      style={{ transition: 'fill-opacity 0.2s ease' }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-2 mt-3">
            <Chip label="Most common" value={peak ? String(peak.range).replace(/\s*mph/i, '') + ' mph' : '—'} color="#22d3ee" />
            <Chip label="Records" value={total.toLocaleString()} color="#60a5fa" />
          </div>
        </>
      )}
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/*  3. Volume by hour                                                  */
/* ------------------------------------------------------------------ */

function PulsePeakDot(props) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill="#6366f1" opacity={0.35}>
        <animate attributeName="r" values="5;14;5" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.45;0.05;0.45" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={4.5} fill="#6366f1" stroke="#fff" strokeWidth={1.8} />
    </g>
  );
}

export function HourlyVolumeCard({ data = [] }) {
  const uid = useId().replace(/:/g, '');
  const { peak, active } = useMemo(
    () => ({
      peak: data.reduce((m, d) => (d.count > (m?.count ?? 0) ? d : m), null),
      active: data.filter((d) => d.count > 0).length,
    }),
    [data]
  );

  return (
    <ChartCard
      icon={Clock}
      title="Volume by Hour (UTC)"
      accent="#3b82f6"
      badge="24h cycle"
      footer="Rounded to 15-minute intervals during privacy processing"
    >
      {!nonEmpty(data) ? (
        <Empty icon={Clock} text="No temporal distribution available" />
      ) : (
        <>
          <div className="h-44 w-full text-theme-text">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#3b82f6" stopOpacity={0.45} />
                    <stop offset="1" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`${uid}-line`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#22d3ee" />
                    <stop offset="1" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="hour" {...AXIS} minTickGap={28} />
                <YAxis {...AXIS} />
                <Tooltip cursor={{ stroke: '#3b82f6', strokeOpacity: 0.3 }} content={<GlassTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={`url(#${uid}-line)`}
                  strokeWidth={2.5}
                  fill={`url(#${uid}-fill)`}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                  animationDuration={900}
                />
                {peak && (
                  <ReferenceDot x={peak.hour} y={peak.count} shape={<PulsePeakDot />} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-2 mt-3">
            <Chip label="Peak hour" value={peak ? `${peak.hour} · ${peak.count}` : '—'} color="#818cf8" />
            <Chip label="Active hours" value={`${active} / ${data.length}`} color="#60a5fa" />
          </div>
        </>
      )}
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/*  4. GPS scatter (auto-zoomed so points no longer sit on one line)   */
/* ------------------------------------------------------------------ */

const padDomain = (vals, minSpan = 0.02) => {
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = Math.max(hi - lo, minSpan);
  const pad = span * 0.18;
  const mid = (lo + hi) / 2;
  return [mid - span / 2 - pad, mid + span / 2 + pad];
};

const GlowDot = ({ cx, cy }) =>
  cx == null ? null : (
    <g>
      <circle cx={cx} cy={cy} r={9} fill="#10b981" opacity={0.2}>
        <animate attributeName="r" values="5;13;5" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0.06;0.3" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={3.8} fill="#10b981" stroke="#fff" strokeWidth={1.2} />
    </g>
  );

export function GpsScatterCard({ data = [] }) {
  const pts = useMemo(
    () => data.map((d) => ({ lat: Number(d.lat), lon: Number(d.lon) })).filter((d) => isFinite(d.lat) && isFinite(d.lon)),
    [data]
  );
  const [latD, lonD] = useMemo(
    () => (pts.length ? [padDomain(pts.map((p) => p.lat)), padDomain(pts.map((p) => p.lon))] : [[0, 1], [0, 1]]),
    [pts]
  );
  const center = pts.length
    ? `${(pts.reduce((s, p) => s + p.lat, 0) / pts.length).toFixed(2)}, ${(pts.reduce((s, p) => s + p.lon, 0) / pts.length).toFixed(2)}`
    : '—';

  return (
    <ChartCard
      icon={MapPin}
      title="GPS Coordinate Points"
      accent="#10b981"
      badge="Generalized (2-dec)"
      footer="Coordinates generalized to ~1.1 km spatial privacy"
    >
      {pts.length === 0 ? (
        <Empty icon={MapPin} text="No coordinates available" />
      ) : (
        <>
          <div className="h-44 w-full text-theme-text">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.08} strokeDasharray="3 5" />
                <XAxis type="number" dataKey="lon" domain={lonD} {...AXIS} tickFormatter={(v) => v.toFixed(2)} />
                <YAxis type="number" dataKey="lat" domain={latD} {...AXIS} tickFormatter={(v) => v.toFixed(2)} />
                <ZAxis range={[60, 60]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3', stroke: '#10b981', strokeOpacity: 0.4 }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="rounded-xl border border-theme-border bg-theme-card/90 backdrop-blur-md px-3 py-2 shadow-xl text-xs font-mono text-emerald-400">
                        {payload[0].payload.lat.toFixed(2)}, {payload[0].payload.lon.toFixed(2)}
                      </div>
                    ) : null
                  }
                />
                <Scatter data={pts} shape={<GlowDot />} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-2 mt-3">
            <Chip label="Points" value={pts.length.toLocaleString()} color="#34d399" />
            <Chip label="Centre (lat, lon)" value={center} color="#2dd4bf" />
          </div>
        </>
      )}
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/*  5. Traffic density heatmap                                         */
/* ------------------------------------------------------------------ */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// accepts "Mon", "Monday", "monday", 0-6
const dayIndex = (d) => {
  if (typeof d === 'number') return ((d % 7) + 7) % 7;
  const i = DAYS.findIndex((x) => x.toLowerCase() === String(d).slice(0, 3).toLowerCase());
  return i;
};

const cellColor = (count, max) =>
  count === 0 ? undefined : `rgba(6,182,212,${(0.18 + 0.82 * Math.pow(count / max, 0.65)).toFixed(3)})`;

export function DensityHeatmapCard({ data = [] }) {
  const [hover, setHover] = useState(null);

  const { grid, max, busiest, total } = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    let busiest = null;
    let total = 0;
    data.forEach((p) => {
      const d = dayIndex(p.day);
      const h = parseInt(p.hour, 10);
      const c = Number(p.count) || 0;
      if (d < 0 || !(h >= 0 && h < 24)) return;
      grid[d][h] += c;
      total += c;
      if (grid[d][h] > max) {
        max = grid[d][h];
        busiest = { d, h, c: grid[d][h] };
      }
    });
    return { grid, max: Math.max(max, 1), busiest, total };
  }, [data]);

  return (
    <ChartCard
      icon={Flame}
      title="Traffic Density Matrix (Day of Week × Hour)"
      accent="#8b5cf6"
      badge={hover ? `${DAYS[hover.d]} ${String(hover.h).padStart(2, '0')}:00 · ${hover.c} records` : 'Hover a cell'}
    >
      {total === 0 ? (
        <Empty icon={Flame} text="No day/hour data to plot" />
      ) : (
        <>
          <div className="w-full overflow-x-auto pb-1">
            <div
              className="min-w-[640px]"
              style={{ display: 'grid', gridTemplateColumns: '34px repeat(24, minmax(0, 1fr))', gap: 3 }}
              onMouseLeave={() => setHover(null)}
            >
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-center text-[9px] font-mono text-theme-dim">
                  {h % 3 === 0 ? `${h}h` : ''}
                </div>
              ))}

              {DAYS.map((day, d) => (
                <React.Fragment key={day}>
                  <div className="text-[10px] font-mono font-bold text-theme-muted flex items-center">{day}</div>
                  {grid[d].map((c, h) => {
                    const active = hover && hover.d === d && hover.h === h;
                    return (
                      <div
                        key={h}
                        onMouseEnter={() => setHover({ d, h, c })}
                        className={`h-6 rounded-[6px] transition-all duration-150 cursor-pointer ${
                          c === 0 ? 'bg-theme-secondary/60' : ''
                        } ${active ? 'ring-2 ring-white/80 scale-110 z-10' : ''}`}
                        style={{ backgroundColor: cellColor(c, max) }}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2 flex-1 min-w-[220px]">
              <Chip
                label="Busiest slot"
                value={busiest ? `${DAYS[busiest.d]} ${String(busiest.h).padStart(2, '0')}:00 · ${busiest.c}` : '—'}
                color="#22d3ee"
              />
              <Chip label="Total records" value={total.toLocaleString()} color="#a78bfa" />
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-theme-dim">
              <span>0</span>
              <span
                className="h-2 w-28 rounded-full"
                style={{ background: 'linear-gradient(90deg, rgba(6,182,212,0.18), rgba(6,182,212,1))' }}
              />
              <span>{max}</span>
            </div>
          </div>
        </>
      )}
    </ChartCard>
  );
}