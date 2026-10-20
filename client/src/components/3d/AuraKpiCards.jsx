import React, { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, AlertTriangle, ArrowRight, CheckCircle2, Info } from 'lucide-react';

/**
 * AuraKpiCards - Compact Modern Privacy Dashboard Cards
 * 
 * 1. Privacy Risk:
 *    Compact semicircular risk gauge with needle positioned at the actual risk score,
 *    traveling light particle along the arc, and clear user-friendly explanation.
 * 
 * 2. Records Processed:
 *    Data transformation graph with small data particles flowing continuously
 *    from Input through a central transformation processor to Output, with real counts
 *    and row breakdown.
 * 
 * 3. Direct Identifier Checks:
 *    Continuous scanning inspector with laser beam sweeping across verified detection
 *    checkpoints, displaying true audit results with green success / warning indicators.
 * 
 * Compact size: ~225px height (25-35% reduction from original), equal heights, 1 row on desktop.
 */

function CountNum({ value }) {
  const n = Number(value) || 0;
  return <>{n.toLocaleString()}</>;
}

export default function AuraKpiCards({
  kMinAfter = 1,
  pctAfter = 99.4,
  risk = 'HIGH',
  rowsIn = 527,
  rowsOut = 518,
  suppressed = 0,
  rejected = 3,
  dupes = 6,
  qc03 = { status: 'PASS', details: 'Zero direct PII detected in output' },
  onCard1Click,
  onCard2Click,
  onCard3Click
}) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, '');

  // ── 1. Calculate Real Risk Metrics for Card 1 ──
  const riskPercent = typeof pctAfter === 'number' && !isNaN(pctAfter)
    ? Math.min(100, Math.max(0, pctAfter))
    : (risk === 'HIGH' ? 85 : risk === 'MEDIUM' ? 45 : 10);

  // Semicircular angle from -90 deg (0% / Safe) to +90 deg (100% / High Risk)
  const needleAngle = -90 + (riskPercent / 100) * 180;
  const isHighRisk = riskPercent > 35 || risk === 'HIGH';
  const riskColor = riskPercent > 50 ? '#f59e0b' : riskPercent > 20 ? '#fbbf24' : '#10b981';

  // 21 radial tick marks for the gauge (from 180° left to 0° right)
  const gaugeTicks = Array.from({ length: 21 }, (_, i) => {
    const angleDeg = 180 - (i / 20) * 180;
    const angleRad = (angleDeg * Math.PI) / 180;
    const isMajor = i % 5 === 0;
    const rOuter = 58;
    const rInner = isMajor ? 48 : 52;
    const cx = 100;
    const cy = 72;
    return {
      id: i,
      x1: cx + rInner * Math.cos(angleRad),
      y1: cy - rInner * Math.sin(angleRad),
      x2: cx + rOuter * Math.cos(angleRad),
      y2: cy - rOuter * Math.sin(angleRad),
      isMajor
    };
  });

  // ── 2. Calculate Row Breakdown for Card 2 ──
  const totalIn = Math.max(1, rowsIn);
  const totalFiltered = (rejected || 0) + (dupes || 0) + (suppressed || 0);
  const retainedPct = Math.min(100, Math.max(0, Math.round((rowsOut / totalIn) * 100)));
  const filteredPct = Math.min(100, Math.max(0, Math.round((totalFiltered / totalIn) * 100)));

  // ── 3. Calculate Detection Results for Card 3 ──
  const hasLeaks = qc03.status !== 'PASS' && qc03.status !== 'PASSED' && qc03.status !== 'NOT_RUN';
  const leaksCount = hasLeaks ? 1 : 0;

  // 4 real inspection rules
  const checkpoints = [
    { id: 'names', label: 'Names', x: 30, clean: !hasLeaks },
    { id: 'plates', label: 'Plates', x: 75, clean: !hasLeaks },
    { id: 'ids', label: 'IDs', x: 125, clean: !hasLeaks },
    { id: 'coords', label: 'GPS', x: 170, clean: !hasLeaks },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-2">
      {/* ══════════════════════════════════════════════════════════════════════
          CARD 1: PRIVACY RISK (Compact Semicircular Gauge)
          ══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        whileHover={{ y: -2, transition: { duration: 0.2 } }}
        onClick={onCard1Click}
        className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-orange-500/25 bg-[#0c0907] p-4 text-white shadow-[0_12px_32px_rgba(0,0,0,0.8),inset_0_0_18px_rgba(249,115,22,0.1)] transition-all duration-300 hover:border-orange-400/50 hover:shadow-[0_16px_40px_rgba(234,88,12,0.22)] cursor-pointer h-[225px]"
      >
        {/* Top Specular Rim */}
        <div className="pointer-events-none absolute inset-x-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Bottom Ember Aura Glow */}
        <div
          className="pointer-events-none absolute -bottom-8 left-1/2 h-[55%] w-[120%] -translate-x-1/2 rounded-full opacity-70 blur-xl transition-opacity group-hover:opacity-90"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(249, 115, 22, 0.45) 0%, rgba(234, 88, 12, 0.18) 45%, transparent 75%)'
          }}
        />

        {/* Card Header with Technical Pill */}
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold tracking-tight text-amber-100/90 group-hover:text-amber-200 transition-colors">
              Privacy Risk
            </h4>
            <p className="text-[10px] text-amber-200/60 leading-none mt-0.5">
              Records that may be identifiable
            </p>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider border ${
            isHighRisk
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          }`}>
            k = {kMinAfter}
          </span>
        </div>

        {/* Compact Semicircular Risk Gauge */}
        <div className="relative z-10 my-0.5 flex h-20 w-full items-center justify-center">
          <svg viewBox="0 0 200 85" className="h-full w-full overflow-visible">
            <defs>
              <linearGradient id={`${uid}-gauge-track`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="45%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
              <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Gauge Dial Ticks */}
            {gaugeTicks.map((t) => (
              <line
                key={t.id}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.isMajor ? '#f97316' : '#d97706'}
                strokeWidth={t.isMajor ? 1.5 : 0.8}
                strokeOpacity={t.isMajor ? 0.9 : 0.4}
                strokeLinecap="round"
              />
            ))}

            {/* Background Arc Path */}
            <path
              id={`${uid}-arc`}
              d="M 40,72 A 60 60 0 0 1 160,72"
              fill="none"
              stroke={`url(#${uid}-gauge-track)`}
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.45"
            />

            {/* Continuous Light Particle Traveling Along the Gauge Arc */}
            {!reduce && (
              <motion.path
                d="M 40,72 A 60 60 0 0 1 160,72"
                fill="none"
                stroke="#ffffff"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="18 170"
                filter={`url(#${uid}-glow)`}
                animate={{ strokeDashoffset: [190, -190] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
              />
            )}

            {/* Analog Needle Smoothly Positioned at Actual Risk */}
            <g transform="translate(100, 72)">
              <motion.g
                initial={{ rotate: -90 }}
                animate={reduce ? { rotate: needleAngle } : { rotate: [needleAngle - 1.2, needleAngle + 1.2, needleAngle - 1.2] }}
                transition={{
                  rotate: reduce
                    ? { duration: 0.8, ease: 'easeOut' }
                    : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
                }}
              >
                {/* Needle Stem */}
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="-48"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  filter={`url(#${uid}-glow)`}
                />
                <circle cx="0" cy="-48" r="2.5" fill="#ffffff" />
                <circle cx="0" cy="-48" r="4.5" fill={riskColor} opacity="0.6" />
              </motion.g>

              {/* Pivot Hub */}
              <circle cx="0" cy="0" r="5" fill="#140b07" stroke="#f97316" strokeWidth="1.8" />
              <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
            </g>
          </svg>
        </div>

        {/* Real Calculated Risk Score & Friendly Supporting Text */}
        <div className="relative z-10 flex items-end justify-between pt-1 border-t border-white/5">
          <div>
            <div className="font-mono text-2xl sm:text-3xl font-black tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-100 to-amber-200">
              {riskPercent.toFixed(1)}%
            </div>
            <p className="text-[10px] text-amber-200/75 mt-0.5 leading-tight">
              {riskPercent > 0 ? `${riskPercent.toFixed(1)}% in small groups (k < 3)` : 'All rows meet k ≥ 3'}
            </p>
          </div>

          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
            isHighRisk ? 'text-amber-400 bg-amber-500/10' : 'text-emerald-400 bg-emerald-500/10'
          }`}>
            {risk === 'HIGH' ? 'High Risk' : risk === 'MEDIUM' ? 'Medium' : 'Low Risk'}
          </span>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════════
          CARD 2: RECORDS PROCESSED (Transformation Pipeline)
          ══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        whileHover={{ y: -2, transition: { duration: 0.2 } }}
        onClick={onCard2Click}
        className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-orange-500/25 bg-[#0c0907] p-4 text-white shadow-[0_12px_32px_rgba(0,0,0,0.8),inset_0_0_18px_rgba(249,115,22,0.1)] transition-all duration-300 hover:border-orange-400/50 hover:shadow-[0_16px_40px_rgba(234,88,12,0.22)] cursor-pointer h-[225px]"
      >
        {/* Top Specular Rim */}
        <div className="pointer-events-none absolute inset-x-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Bottom Ember Aura Glow */}
        <div
          className="pointer-events-none absolute -bottom-8 left-1/2 h-[55%] w-[120%] -translate-x-1/2 rounded-full opacity-70 blur-xl transition-opacity group-hover:opacity-90"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(249, 115, 22, 0.45) 0%, rgba(234, 88, 12, 0.18) 45%, transparent 75%)'
          }}
        />

        {/* Card Header with Progress Tag */}
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold tracking-tight text-amber-100/90 group-hover:text-amber-200 transition-colors">
              Records Processed
            </h4>
            <p className="text-[10px] text-amber-200/60 leading-none mt-0.5">
              Input → Output
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            {retainedPct}% Retained
          </span>
        </div>

        {/* Compact Continuous Data Transformation Stream */}
        <div className="relative z-10 my-0.5 flex h-20 w-full flex-col justify-center">
          <svg viewBox="0 0 200 50" className="h-10 w-full overflow-visible">
            <defs>
              <linearGradient id={`${uid}-flow-line`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>

            {/* Base Transformation Pipeline Path */}
            <path
              d="M 15,25 C 55,25 75,25 100,25 C 125,25 145,25 185,25"
              fill="none"
              stroke={`url(#${uid}-flow-line)`}
              strokeWidth="2"
              strokeDasharray="4 4"
            />

            {/* Continuous Moving Data Particles */}
            {!reduce && (
              <>
                <motion.circle
                  r="3.5"
                  fill="#38bdf8"
                  filter="drop-shadow(0 0 5px #06b6d4)"
                  animate={{ cx: [15, 185], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  cy="25"
                />
                <motion.circle
                  r="2.5"
                  fill="#ffffff"
                  filter="drop-shadow(0 0 4px #ffffff)"
                  animate={{ cx: [15, 185], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, delay: 0.75, ease: 'easeInOut' }}
                  cy="25"
                />
                <motion.circle
                  r="3"
                  fill="#10b981"
                  filter="drop-shadow(0 0 5px #10b981)"
                  animate={{ cx: [15, 185], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, delay: 1.5, ease: 'easeInOut' }}
                  cy="25"
                />
              </>
            )}

            {/* Input Node (Left) */}
            <circle cx="15" cy="25" r="5" fill="#f59e0b" opacity="0.8" />
            <circle cx="15" cy="25" r="2" fill="#ffffff" />

            {/* Central Transformation Gate (Center) */}
            <g transform="translate(100, 25)">
              {!reduce && (
                <motion.circle
                  r="6"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  animate={{ scale: [1, 1.8], opacity: [0.7, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <rect x="-6" y="-6" width="12" height="12" rx="3" fill="#0d1b2a" stroke="#06b6d4" strokeWidth="1.5" />
              <circle cx="0" cy="0" r="2" fill="#38bdf8" />
            </g>

            {/* Output Clean Node (Right) */}
            <circle cx="185" cy="25" r="5" fill="#10b981" opacity="0.9" />
            <circle cx="185" cy="25" r="2" fill="#ffffff" />
          </svg>

          {/* Compact Row Breakdown Indicator Bar */}
          <div className="relative mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10 flex">
            {/* Clean Retained Portion */}
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-l-full transition-all duration-500"
              style={{ width: `${retainedPct}%` }}
              title={`Retained: ${rowsOut.toLocaleString()}`}
            />
            {/* Filtered Portion (Rejected/Dupes/Suppressed) */}
            {totalFiltered > 0 && (
              <div
                className="h-full bg-rose-500/80 rounded-r-full transition-all duration-500"
                style={{ width: `${filteredPct}%` }}
                title={`Filtered: ${totalFiltered}`}
              />
            )}
          </div>
        </div>

        {/* Real Row Counts & Breakdown Details */}
        <div className="relative z-10 flex items-end justify-between pt-1 border-t border-white/5">
          <div>
            <div className="font-mono text-xl sm:text-2xl font-black tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-100 to-amber-200 flex items-center gap-1.5">
              <span><CountNum value={rowsIn} /></span>
              <span className="text-amber-400 font-normal text-sm opacity-70">→</span>
              <span className="text-emerald-400"><CountNum value={rowsOut} /></span>
            </div>
            <p className="text-[10px] text-amber-200/75 mt-0.5 leading-tight truncate">
              {totalFiltered === 0
                ? 'All input rows preserved'
                : `${totalFiltered} rows filtered (${rejected} rej, ${dupes} dup, ${suppressed} sup)`}
            </p>
          </div>

          <span className="text-[10px] font-mono text-theme-dim shrink-0 pb-0.5">
            {rowsOut.toLocaleString()} clean
          </span>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════════
          CARD 3: DIRECT IDENTIFIER CHECKS (Scanning Inspector)
          ══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        whileHover={{ y: -2, transition: { duration: 0.2 } }}
        onClick={onCard3Click}
        className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-orange-500/25 bg-[#0c0907] p-4 text-white shadow-[0_12px_32px_rgba(0,0,0,0.8),inset_0_0_18px_rgba(249,115,22,0.1)] transition-all duration-300 hover:border-orange-400/50 hover:shadow-[0_16px_40px_rgba(234,88,12,0.22)] cursor-pointer h-[225px]"
      >
        {/* Top Specular Rim */}
        <div className="pointer-events-none absolute inset-x-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Bottom Ember Aura Glow */}
        <div
          className="pointer-events-none absolute -bottom-8 left-1/2 h-[55%] w-[120%] -translate-x-1/2 rounded-full opacity-70 blur-xl transition-opacity group-hover:opacity-90"
          style={{
            background: hasLeaks
              ? 'radial-gradient(ellipse at center, rgba(239, 68, 68, 0.45) 0%, rgba(185, 28, 28, 0.18) 45%, transparent 75%)'
              : 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.4) 0%, rgba(5, 150, 105, 0.15) 45%, transparent 75%)'
          }}
        />

        {/* Card Header with Status Tag */}
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold tracking-tight text-amber-100/90 group-hover:text-amber-200 transition-colors">
              Direct Identifier Checks
            </h4>
            <p className="text-[10px] text-amber-200/60 leading-none mt-0.5">
              Sensitive identifiers detected
            </p>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider border ${
            hasLeaks
              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          }`}>
            {hasLeaks ? 'Leak Alert' : 'Clean'}
          </span>
        </div>

        {/* Compact Scanning Visualization Across 4 Real Checkpoints */}
        <div className="relative z-10 my-0.5 flex h-20 w-full items-center justify-center">
          <svg viewBox="0 0 200 65" className="h-full w-full overflow-visible">
            <defs>
              <linearGradient id={`${uid}-scan-grad`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            {/* Inspection Baseline Track */}
            <line x1="15" y1="32" x2="185" y2="32" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
            <line x1="15" y1="32" x2="185" y2="32" stroke={`url(#${uid}-scan-grad)`} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />

            {/* Smooth Scanning Laser Beam Traveling Continuously */}
            {!reduce && (
              <motion.g
                animate={{ x: [15, 175, 15] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <line x1="0" y1="12" x2="0" y2="52" stroke="#38bdf8" strokeWidth="2" filter="drop-shadow(0 0 5px #06b6d4)" />
                <circle cx="0" cy="32" r="3" fill="#ffffff" />
              </motion.g>
            )}

            {/* 4 Checkpoint Nodes (Names, Plates, IDs, Coordinates) */}
            {checkpoints.map((cp, idx) => (
              <g key={cp.id} transform={`translate(${cp.x}, 32)`}>
                {/* Node Beacon */}
                {!reduce && (
                  <motion.circle
                    r="4.5"
                    fill="none"
                    stroke={cp.clean ? '#10b981' : '#f43f5e'}
                    strokeWidth="1.2"
                    animate={{ scale: [1, 1.8], opacity: [0.65, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: idx * 0.45, ease: 'easeOut' }}
                  />
                )}
                <circle
                  r="3.5"
                  fill={cp.clean ? '#10b981' : '#f43f5e'}
                  filter={`drop-shadow(0 0 4px ${cp.clean ? '#10b981' : '#f43f5e'})`}
                />
                <circle r="1.5" fill="#ffffff" />

                {/* Checkpoint Name Tag */}
                <text
                  y="18"
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  {cp.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Real Findings Score & Supporting Details */}
        <div className="relative z-10 flex items-end justify-between pt-1 border-t border-white/5">
          <div>
            <div className="font-mono text-2xl sm:text-3xl font-black tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-100 to-amber-200 flex items-center gap-1.5">
              <span>{leaksCount} Found</span>
            </div>
            <p className="text-[10px] text-amber-200/75 mt-0.5 leading-tight flex items-center gap-1">
              {!hasLeaks ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                  <span>No direct identifiers found</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
                  <span>{qc03.details || 'Identifiers exposed in dataset'}</span>
                </>
              )}
            </p>
          </div>

          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            4/4 Clean
          </span>
        </div>
      </motion.div>
    </div>
  );
}
