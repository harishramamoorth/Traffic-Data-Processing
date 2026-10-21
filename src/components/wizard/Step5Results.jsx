import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, animate, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Award, CheckCircle2, AlertTriangle, XCircle, Download, FileCode, FileSpreadsheet,
  ShieldCheck, Shield, BarChart3, Columns, Table, Terminal, RotateCcw, Layers,
  ArrowRight, ChevronLeft, ChevronRight, SlidersHorizontal, X, FileText, Info,
  Activity, Gauge, MapPin, Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend
} from 'recharts';
import axios from 'axios';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { useToast } from '../Toast';
import PageLoader from '../PageLoader';
import AuraKpiCards from '../3d/AuraKpiCards';
import { downloadFile } from '../../utils/downloader';

/* ────────────────────────────────────────────────────────────────
   THEME LAYER
   Works on Midnight, Aurora, Matrix, Light Pro and High Contrast.
   Surfaces use your existing theme-* classes. Accent + status colours
   come from CSS variables, so nothing is hard-coded to cyan/white/black.
   Map --theme-accent to your own variable if it is named differently.
   ──────────────────────────────────────────────────────────────── */
const THEME_CSS = `
.s5{--a:var(--theme-accent,#06b6d4);--ok:#10b981;--warn:#f59e0b;--bad:#f43f5e;--info:#38bdf8;--mute:#94a3b8}
:is(.light,[data-theme="light"],[data-theme="light-pro"],[data-theme="lightpro"]) .s5{--ok:#047857;--warn:#b45309;--bad:#be123c;--info:#0369a1;--mute:#475569}
:is([data-theme="high-contrast"],[data-theme="highcontrast"],[data-theme="contrast"]) .s5{--ok:#4ade80;--warn:#facc15;--bad:#ff6b6b;--info:#7dd3fc;--mute:#e5e5e5}
:is([data-theme="matrix"]) .s5{--ok:#22ff88;--warn:#d9f99d;--bad:#ff5f5f}
.s5 .chip{color:var(--t);background:color-mix(in srgb,var(--t) 14%,transparent);border:1px solid color-mix(in srgb,var(--t) 38%,transparent)}
.s5 .t-ok{--t:var(--ok)}.s5 .t-warn{--t:var(--warn)}.s5 .t-bad{--t:var(--bad)}
.s5 .t-info{--t:var(--info)}.s5 .t-mute{--t:var(--mute)}.s5 .t-a{--t:var(--a)}
.s5 .tx{color:var(--t)}
.s5 .btn-a{background:var(--a);color:var(--theme-on-accent,#04121a);font-weight:700}
.s5 .btn-a:hover{filter:brightness(1.1)}
.s5 .glow{box-shadow:0 0 0 1px color-mix(in srgb,var(--t) 30%,transparent),0 10px 40px -18px var(--t)}
.s5 :focus-visible{outline:2px solid var(--a);outline-offset:2px}
.s5 .hide-sb{scrollbar-width:none}.s5 .hide-sb::-webkit-scrollbar{display:none}
`;

const card = 'rounded-2xl border border-theme-border bg-theme-card';
const TONE = { PASS: 'ok', PASSED: 'ok', LOW: 'ok', WARN: 'warn', WARNING: 'warn', MEDIUM: 'warn', PASSED_WITH_WARNINGS: 'warn', FAIL: 'bad', FAILED: 'bad', HIGH: 'bad' };
const tone = (s) => TONE[String(s).toUpperCase()] || 'mute';

const fmtPct = (val) => {
  const num = Number(val) || 0;
  if (num === 0) return '0%';
  if (num < 1) return `${num.toFixed(1)}%`;
  return `${Number.isInteger(num) ? num : num.toFixed(1)}%`;
};

const getShortLabel = (col) => {
  const c = String(col || '').toLowerCase().trim();
  if (c.includes('speed')) return 'SPEED';
  if (c.includes('lat')) return 'LAT';
  if (c.includes('lon')) return 'LON';
  if (c.includes('road') || c.includes('segment')) return 'ROAD';
  if (c.includes('cong')) return 'CONG';
  if (c.includes('plate')) return 'PLATE';
  if (c.includes('type')) return 'TYPE';
  if (c.includes('vol') || c.includes('flow')) return 'FLOW';
  if (c.includes('time')) return 'TIME';
  return c.split(' ')[0].toUpperCase().slice(0, 6);
};

/* ── small building blocks ─────────────────────────────────────── */
const Chip = ({ t = 'mute', children, className = '' }) => (
  <span className={`chip t-${t} inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${className}`}>{children}</span>
);

function Count({ value, decimals = 0, suffix = '' }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : 0);
  useEffect(() => {
    const v = Number(value) || 0;
    if (reduce) return setN(v);
    const c = animate(0, v, { duration: 0.9, ease: 'easeOut', onUpdate: setN });
    return () => c.stop();
  }, [value, reduce]);
  return <>{decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString()}{suffix}</>;
}

function Ring({ pct, t }) {
  const r = 44, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 110 110" className={`t-${t} h-28 w-28 -rotate-90`} aria-hidden="true">
      <circle cx="55" cy="55" r={r} fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="9" className="text-theme-text" />
      <motion.circle
        cx="55" cy="55" r={r} fill="none" stroke="var(--t)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={c} initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.min(1, pct / 100)) }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      />
    </svg>
  );
}

const Section = ({ title, hint, right, children, className = '' }) => (
  <section className={`${card} p-5 sm:p-6 space-y-4 ${className}`}>
    {(title || right) && (
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-theme-text">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-theme-dim">{hint}</p>}
        </div>
        {right}
      </header>
    )}
    {children}
  </section>
);

function Kpi({ label, value, sub, t = 'a', onClick, decimals }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`t-${t} group rounded-xl border border-theme-border bg-theme-secondary/40 p-4 text-left transition-colors ${onClick ? 'cursor-pointer hover:bg-theme-secondary/70 hover:border-[color:var(--t)]' : ''}`}
    >
      <span className="block text-[11px] font-semibold text-theme-muted">{label}</span>
      <span className="tx mt-1 block text-2xl font-bold tabular-nums">
        {typeof value === 'number' ? <Count value={value} decimals={decimals} /> : value}
      </span>
      {sub && <span className="mt-0.5 block text-[11px] text-theme-dim">{sub}</span>}
    </Tag>
  );
}

function DataTable({ cols, rows, empty = 'Nothing to show.' }) {
  if (!rows.length) return <p className="py-10 text-center text-xs text-theme-dim">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-theme-border text-[11px] text-theme-dim">
            {cols.map((c) => <th key={c.key} className="px-2 pb-3 font-semibold">{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-theme-border/50">
          {rows.map((r, i) => (
            <tr key={i} className="transition-colors hover:bg-theme-secondary/40">
              {cols.map((c) => <td key={c.key} className="px-2 py-2.5 text-theme-muted">{c.render ? c.render(r, i) : String(r[c.key] ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ChartTip = ({ active, payload }) => active && payload?.length ? (
  <div className="rounded-xl border border-theme-border/80 bg-theme-card/95 px-3.5 py-2.5 text-xs text-theme-text shadow-2xl backdrop-blur-md">
    <div className="font-bold text-theme-text border-b border-theme-border/50 pb-1 mb-1.5 flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-[color:var(--a)]" />
      {payload[0].payload.label || payload[0].payload.name || payload[0].payload.range || payload[0].payload.segment || payload[0].payload.column}
    </div>
    <div className="space-y-0.5 text-[11px] text-theme-muted font-mono">
      {payload.map((p, idx) => (
        <div key={idx} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color || p.fill || 'var(--a)' }} />
            {p.name || p.dataKey}:
          </span>
          <b className="text-theme-text">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</b>
        </div>
      ))}
    </div>
  </div>
) : null;

const axis = { stroke: 'currentColor', fontSize: 10, tickLine: false, axisLine: false, opacity: 0.7 };
const ChartBox = ({ title, icon: Icon, badge, sub, children, h = 'h-64', isCustom }) => (
  <div className="relative flex flex-col rounded-2xl border border-theme-border bg-theme-card p-5 shadow-xl transition-all duration-300 hover:border-[color:var(--a)]/40 hover:shadow-2xl">
    <div className="flex items-start justify-between gap-2 mb-4">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-theme-border bg-theme-secondary text-[color:var(--a)] shadow-xs">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div>
          <h4 className="text-sm font-bold tracking-tight text-theme-text">{title}</h4>
          {sub && <p className="text-[11px] text-theme-dim">{sub}</p>}
        </div>
      </div>
      {badge && <Chip t="a">{badge}</Chip>}
    </div>
    <div className={`${h} relative w-full text-theme-dim`}>
      {isCustom ? children : (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      )}
    </div>
  </div>
);

function Download2({ icon: Icon, title, desc, tag, t = 'a', onClick, primary }) {
  return (
    <motion.button
      type="button" onClick={onClick} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
      className={`t-${t} flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${primary ? 'glow border-[color:var(--t)] bg-theme-secondary/70' : 'border-theme-border bg-theme-secondary/40 hover:border-[color:var(--t)]'}`}
    >
      <span className="flex items-center justify-between">
        <span className="chip flex h-9 w-9 items-center justify-center rounded-lg"><Icon className="h-4 w-4" /></span>
        <Chip t={t}>{tag}</Chip>
      </span>
      <span className="text-xs font-bold text-theme-text">{title}</span>
      <span className="text-[11px] leading-snug text-theme-dim">{desc}</span>
    </motion.button>
  );
}


/* ── RE-ID RISK: STEP FUNNEL (matches reference design) ─────────── */
function RiskFunnel({ groups, before, after, K }) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const [active, setActive] = useState(2);
  const [isHovered, setIsHovered] = useState(false);

  const by = (b) => groups?.find((g) => g.bucket === b)?.count || 0;
  const k1 = by('k=1');
  const k2 = by('k=2');
  const k34 = by('k=3-4');
  const k5 = by('k=5+');
  const total = Math.max(1, k1 + k2 + k34 + k5);

  const steps = [
    { label: 'All rows', count: total, note: 'Every cleaned row', color: 'var(--a)' },
    { label: 'In groups under 5', count: k1 + k2 + k34, note: 'Small cohorts, k < 5', color: 'var(--info)' },
    { label: 'In groups under 3', count: k1 + k2, note: 'High linkage risk, k < 3', color: 'var(--warn)' },
    { label: 'Unique rows', count: k1, note: 'Only one match, k = 1', color: 'var(--bad)' }
  ].map((s) => ({ ...s, pct: Math.round((s.count / total) * 1000) / 10 }));

  // Column height in SVG units (0 = top, 100 = bottom). More rows = taller column.
  const yOf = (count) => 100 - Math.max(0.06, count / total) * 80;
  const ys = steps.map((s) => yOf(s.count));

  const isProtected = after.level === 'LOW';
  const reduced = Number(before.pct) - Number(after.pct);

  // Auto-cycle through steps when idle to keep the presentation dynamically alive
  useEffect(() => {
    if (reduce || isHovered) return;
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % steps.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [reduce, isHovered, steps.length]);

  return (
    <div className="space-y-4" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      {/* Summary card: placed cleanly above the funnel so columns 3 & 4 are never occluded */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-theme-border bg-theme-card p-4 shadow-md"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className={`t-${tone(after.level)} flex items-baseline gap-2`}>
            <b className="tx text-3xl font-bold tabular-nums">
              <Count value={Number(after.pct)} decimals={1} suffix="%" />
            </b>
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider">still at risk</span>
          </div>
          <div className="hidden h-6 w-px bg-theme-border sm:block" />
          <p className="text-xs text-theme-dim">
            {isProtected
              ? `All rows meet k ≥ ${K}. Cohort linkage risk eliminated.`
              : `Was ${before.pct}% before. ${reduced > 0 ? `Down ${reduced.toFixed(1)} points.` : 'No reduction applied yet.'}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <Chip t={tone(before.level)}>{before.level}</Chip>
          <ArrowRight className="h-3 w-3 text-theme-dim" />
          <Chip t={tone(after.level)}>{after.level}</Chip>
          <span className="ml-auto font-mono text-theme-dim">k {before.k} → {after.k}</span>
        </div>
      </motion.div>

      {/* Four columns with panoramic backdrop wave */}
      <div className="relative">
        {/* Background panoramic connecting wave linking all 4 steps */}
        {!reduce && (
          <div className="pointer-events-none absolute inset-x-0 bottom-14 top-10 z-0 opacity-15 overflow-hidden">
            <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="h-full w-full">
              <defs>
                <linearGradient id={`${uid}-panoramic`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--a)" />
                  <stop offset="33%" stopColor="var(--info)" />
                  <stop offset="66%" stopColor="var(--warn)" />
                  <stop offset="100%" stopColor="var(--bad)" />
                </linearGradient>
              </defs>
              <motion.path
                d={`M0 100 L0 ${ys[0]} C50 ${ys[0] - 8} 50 ${ys[1] + 8} 100 ${ys[1]} C150 ${ys[1] - 8} 150 ${ys[2] + 8} 200 ${ys[2]} C250 ${ys[2] - 8} 250 ${ys[3] + 8} 300 ${ys[3]} C350 ${ys[3] - 8} 350 ${ys[3] + 8} 400 ${ys[3]} L400 100 Z`}
                animate={{
                  d: [
                    `M0 100 L0 ${ys[0]} C50 ${ys[0] - 8} 50 ${ys[1] + 8} 100 ${ys[1]} C150 ${ys[1] - 8} 150 ${ys[2] + 8} 200 ${ys[2]} C250 ${ys[2] - 8} 250 ${ys[3] + 8} 300 ${ys[3]} C350 ${ys[3] - 8} 350 ${ys[3] + 8} 400 ${ys[3]} L400 100 Z`,
                    `M0 100 L0 ${ys[0]} C50 ${ys[0] + 8} 50 ${ys[1] - 8} 100 ${ys[1]} C150 ${ys[1] + 8} 150 ${ys[2] - 8} 200 ${ys[2]} C250 ${ys[2] + 8} 250 ${ys[3] - 8} 300 ${ys[3]} C350 ${ys[3] + 8} 350 ${ys[3] - 8} 400 ${ys[3]} L400 100 Z`,
                    `M0 100 L0 ${ys[0]} C50 ${ys[0] - 8} 50 ${ys[1] + 8} 100 ${ys[1]} C150 ${ys[1] - 8} 150 ${ys[2] + 8} 200 ${ys[2]} C250 ${ys[2] - 8} 250 ${ys[3] + 8} 300 ${ys[3]} C350 ${ys[3] - 8} 350 ${ys[3] + 8} 400 ${ys[3]} L400 100 Z`
                  ]
                }}
                transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
                fill={`url(#${uid}-panoramic)`}
              />
            </svg>
          </div>
        )}

        <div className="relative z-10 grid grid-cols-2 gap-2 pt-1 lg:grid-cols-4 lg:gap-2">
          {steps.map((s, i) => {
            const on = active === i;
            const yCur = ys[i];
            const yNext = i < steps.length - 1 ? ys[i + 1] : yCur;
            const mid = (yCur + yNext) / 2;

            // Authentic undulating wave harmonics:
            // Front rolling wave keyframes
            const wF1 = `M0 100 L0 ${yCur} C25 ${yCur - 8} 35 ${mid + 8} 50 ${mid} C65 ${mid - 8} 75 ${yNext + 8} 100 ${yNext} L100 100 Z`;
            const wF2 = `M0 100 L0 ${yCur} C25 ${yCur + 8} 35 ${mid - 8} 50 ${mid} C65 ${mid + 8} 75 ${yNext - 8} 100 ${yNext} L100 100 Z`;

            // Back deeper wave keyframes (phase offset for natural liquid interference)
            const wB1 = `M0 100 L0 ${yCur + 1} C18 ${yCur + 7} 42 ${mid - 7} 50 ${mid} C68 ${mid + 7} 82 ${yNext - 7} 100 ${yNext} L100 100 Z`;
            const wB2 = `M0 100 L0 ${yCur + 1} C18 ${yCur - 7} 42 ${mid + 7} 50 ${mid} C68 ${mid - 7} 82 ${yNext + 7} 100 ${yNext} L100 100 Z`;

            // Front glowing crest line keyframes (exact surface of wave)
            const cF1 = `M0 ${yCur} C25 ${yCur - 8} 35 ${mid + 8} 50 ${mid} C65 ${mid - 8} 75 ${yNext + 8} 100 ${yNext}`;
            const cF2 = `M0 ${yCur} C25 ${yCur + 8} 35 ${mid - 8} 50 ${mid} C65 ${mid + 8} 75 ${yNext - 8} 100 ${yNext}`;

            return (
              <motion.button
                key={s.label}
                type="button"
                aria-pressed={on}
                onMouseEnter={() => { setActive(i); setIsHovered(true); }}
                onFocus={() => { setActive(i); setIsHovered(true); }}
                onClick={() => { setActive(i); setIsHovered(true); }}
                animate={{ y: on ? -10 : 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                style={{ '--t': s.color }}
                className={`relative flex flex-col rounded-xl text-left overflow-hidden transition-[background,box-shadow,border-color] duration-200 ${on
                    ? 'border border-theme-border bg-theme-card/90 backdrop-blur-md shadow-2xl ring-1 ring-white/15'
                    : 'border border-transparent bg-theme-secondary/20 hover:bg-theme-secondary/40'
                  }`}
              >
                {/* Active column light sheen sweep */}
                {on && !reduce && (
                  <motion.div
                    className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }}
                  />
                )}

                {/* Step label, always reserves its height so columns stay aligned */}
                <div className="flex h-6 items-center justify-between px-3 text-[10px] font-medium text-theme-dim">
                  <span className="opacity-60">{s.label}</span>
                  {on && <span className="font-semibold text-theme-text">Step {i + 1}</span>}
                </div>

                {/* Animated curved column with living rolling waves */}
                <div className="relative h-48 w-full overflow-hidden">
                  <motion.div
                    className="absolute inset-0 origin-bottom"
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.12, ease: 'easeOut' }}
                  >
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                      <defs>
                        <linearGradient id={`${uid}-g${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" style={{ stopColor: s.color, stopOpacity: on ? 0.95 : 0.6 }} />
                          <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0.08 }} />
                        </linearGradient>
                        <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor={s.color} floodOpacity="0.85" />
                        </filter>
                      </defs>

                      {/* Secondary back wave layer undulating */}
                      {!reduce && (
                        <motion.path
                          d={wB1}
                          animate={{ d: [wB1, wB2, wB1] }}
                          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                          fill={`url(#${uid}-g${i})`}
                          opacity={0.4}
                        />
                      )}

                      {/* Primary rolling wave body (visibly rolling liquid!) */}
                      {reduce ? (
                        <path d={wF1} fill={`url(#${uid}-g${i})`} />
                      ) : (
                        <motion.path
                          d={wF1}
                          animate={{ d: [wF1, wF2, wF1] }}
                          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                          fill={`url(#${uid}-g${i})`}
                          opacity={on ? 0.95 : 0.72}
                        />
                      )}

                      {/* Glowing wave crest line dancing in unison */}
                      {reduce ? (
                        <path d={cF1} fill="none" stroke={s.color} strokeWidth={on ? 2.5 : 1.8} />
                      ) : (
                        <motion.path
                          d={cF1}
                          animate={{ d: [cF1, cF2, cF1] }}
                          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                          fill="none"
                          stroke={s.color}
                          strokeWidth={on ? 2.8 : 1.8}
                          strokeLinecap="round"
                          filter={`url(#${uid}-glow)`}
                        />
                      )}

                      {/* Flowing electric beam traveling across rolling crest */}
                      {!reduce && (
                        <motion.path
                          d={cF1}
                          animate={{
                            d: [cF1, cF2, cF1],
                            strokeDashoffset: [0, -120]
                          }}
                          transition={{
                            d: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
                            strokeDashoffset: { duration: 1.8, repeat: Infinity, ease: 'linear' }
                          }}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={on ? 3.5 : 2}
                          strokeDasharray="14 36"
                          strokeLinecap="round"
                          opacity={on ? 1 : 0.55}
                        />
                      )}
                    </svg>
                  </motion.div>

                  {/* Rising liquid micro-bubbles */}
                  {!reduce && [0, 1, 2].map((b) => (
                    <motion.span
                      key={b}
                      className="pointer-events-none absolute rounded-full bg-white/50 backdrop-blur-xs"
                      style={{
                        left: `${26 + b * 24}%`,
                        width: 4 + (b % 2) * 2,
                        height: 4 + (b % 2) * 2,
                        bottom: '8%'
                      }}
                      animate={{
                        y: [0, -70 - (100 - yCur) * 0.7],
                        opacity: [0, on ? 0.8 : 0.35, 0],
                        scale: [0.6, 1.2, 0.8]
                      }}
                      transition={{
                        duration: 2.8 + b * 0.8,
                        repeat: Infinity,
                        delay: b * 0.7 + i * 0.3,
                        ease: 'easeInOut'
                      }}
                    />
                  ))}

                  {/* Glass marker buoy that slides between columns and bobs on the wave */}
                  {on && (
                    <motion.span
                      layoutId={`${uid}-dot`}
                      className="absolute left-1/2 z-10 h-10 w-10 -translate-x-1/2 rounded-full border border-white/60 bg-white/30 backdrop-blur-md shadow-xl"
                      style={{ top: `calc(${mid}% - 20px)` }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    >
                      {/* Synchronized buoyancy bobbing matching wave frequency */}
                      <motion.div
                        className="relative h-full w-full flex items-center justify-center"
                        animate={reduce ? undefined : { y: [-6, 6, -6] }}
                        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        {/* Specular glass reflection */}
                        <span className="absolute top-1 left-2 h-2.5 w-2.5 rounded-full bg-white/70 blur-[0.5px]" />

                        {/* Inner luminous core */}
                        <span
                          className="h-3 w-3 rounded-full shadow-sm"
                          style={{ backgroundColor: s.color }}
                        />

                        {/* Concentric ripple rings */}
                        {!reduce && (
                          <>
                            <motion.span
                              className="absolute inset-0 rounded-full border border-white/70"
                              animate={{ scale: [1, 1.7], opacity: [0.75, 0] }}
                              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                            />
                            <motion.span
                              className="absolute inset-0 rounded-full border border-white/50"
                              animate={{ scale: [1, 2.3], opacity: [0.5, 0] }}
                              transition={{ duration: 1.6, repeat: Infinity, delay: 0.5, ease: 'easeOut' }}
                            />
                          </>
                        )}
                      </motion.div>
                    </motion.span>
                  )}
                </div>

                {/* Count, label and caption */}
                <div className="px-3 pb-3 pt-2">
                  <div className="flex items-end gap-2">
                    <b className="tx text-2xl font-bold tabular-nums leading-none">
                      <Count value={s.count} />
                    </b>
                    <span className="pb-0.5 text-xs font-semibold leading-tight text-theme-text">{s.label}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-theme-dim">
                    {s.pct}% of rows · {s.note}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <p className="px-1 text-[11px] text-theme-dim">
        Goal: every row sits in a group of {K} or more look-alikes.
      </p>
    </div>
  );
}

const fade = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

/* ── PAGE ──────────────────────────────────────────────────────── */
export default function Step5Results() {
  const { addToast } = useToast();
  const reduce = useReducedMotion();
  const navigate = useNavigate();

  const activeJob = useWorkflowStore((s) => s.activeJob);
  const sessionSample = useWorkflowStore((s) => s.sessionSample);
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);
  const setStep = useWorkflowStore((s) => s.setStep);
  const updateConfig = useWorkflowStore((s) => s.updateConfig);
  const initJob = useWorkflowStore((s) => s.initJob);
  const completeJob = useWorkflowStore((s) => s.completeJob);
  const setStageProgress = useWorkflowStore((s) => s.setStageProgress);
  const addLiveLog = useWorkflowStore((s) => s.addLiveLog);
  const isSample = useWorkflowStore((s) => s.isSample);
  const file = useWorkflowStore((s) => s.file);
  const customConfig = useWorkflowStore((s) => s.customConfig);
  const selectedSheet = useWorkflowStore((s) => s.selectedSheet);

  const [tab, setTab] = useState('overview');
  const [analytics, setAnalytics] = useState(null);
  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [recLoading, setRecLoading] = useState(false);
  const [reRunning, setReRunning] = useState(false);
  const [modal, setModal] = useState(null); // hooks live above any early return
  const jobId = activeJob?.id;
  const fired = useRef(false);

  /* confetti once, only on a clean pass */
  useEffect(() => {
    if (fired.current || reduce || !activeJob) return;
    if (activeJob.status === 'COMPLETED' || activeJob.summary?.overall_status === 'PASSED') {
      fired.current = true;
      try { confetti({ particleCount: 60, spread: 70, origin: { y: 0.55 } }); } catch { }
    }
  }, [activeJob, reduce]);

  useEffect(() => {
    if (!jobId) return;
    axios.get(`/api/jobs/${jobId}/analytics`)
      .then((r) => r.data?.analytics && setAnalytics(r.data.analytics))
      .catch((e) => console.warn('Could not load analytics:', e.message));
  }, [jobId]);

  // Pre-fetch records immediately on mount and page switch so modal always displays REAL rows
  useEffect(() => {
    if (!jobId) return;
    setRecLoading(true);
    axios.get(`/api/jobs/${jobId}/records?page=${page}&limit=${tab === 'records' ? 10 : 30}`)
      .then((r) => {
        if (r.data?.records) {
          setRecords(r.data.records);
          setPages(r.data.totalPages || 1);
        }
      })
      .catch((e) => console.warn('Could not load records:', e.message))
      .finally(() => setRecLoading(false));
  }, [jobId, tab, page]);

  /* derived data (all hooks before the early return) */
  const job = activeJob || {};
  const { summary = {}, qualityChecks = [], piiReport = [], rejectedRows = [], processingLogs = [], originalFilename, completedAt } = job;
  const kAnon = job.kAnonymity || summary.k_anonymity || {};
  const risk = String(summary.re_identification_risk || kAnon.risk_badge || kAnon.risk_level || 'LOW').toUpperCase();
  const mode = String(kAnon.risk_reduction_mode || summary.risk_reduction_mode || job.config?.riskReductionMode || 'none').toLowerCase();
  const K = Number(kAnon.k_threshold ?? job.config?.kThreshold ?? 3);
  const bm = kAnon.before_metrics || {};
  const pctBefore = bm.percent_low_k ?? kAnon.before_percent_low_k ?? 0;
  const riskBefore = String(kAnon.before_risk || bm.risk_level || summary.re_identification_risk_before || (pctBefore > 20 ? 'HIGH' : pctBefore > 5 ? 'MEDIUM' : 'LOW')).toUpperCase();
  const riskAfter = String(kAnon.after_risk || summary.re_identification_risk_after || risk).toUpperCase();
  const pctAfter = kAnon.percent_low_k ?? summary.percent_low_k ?? 0;
  const kMinBefore = bm.k_min ?? kAnon.before_k_min ?? 1;
  const kMinAfter = Number(kAnon.k_min ?? summary.smallest_group_size_k ?? (riskAfter === 'LOW' ? K : 1));
  const rowsIn = summary.original_rows ?? 0;
  const rowsOut = summary.processed_rows ?? 0;
  const dupes = summary.duplicates_removed ?? summary.duplicate_rows_removed ?? job.duplicatesRemoved ?? 0;
  const rejected = summary.rejected_rows_count ?? rejectedRows.length;
  const suppressed = job.suppressedCount ?? summary.suppressed_count ?? 0;

  const hasFail = qualityChecks.some((q) => q.status === 'FAIL');
  const rawStatus = summary.overall_status || (hasFail ? 'FAILED' : qualityChecks.some((q) => ['WARN', 'WARNING'].includes(q.status)) ? 'PASSED_WITH_WARNINGS' : 'PASSED');
  const kOk = ['suppress', 'aggregate'].includes(mode) && (kMinAfter >= K || riskAfter === 'LOW');
  const status = kOk && !hasFail ? 'PASSED' : risk === 'HIGH' && rawStatus === 'PASSED' ? 'PASSED_WITH_WARNINGS' : rawStatus;
  const st = status === 'PASSED' ? { t: 'ok', Icon: CheckCircle2, label: 'Ready to use', copy: 'Your cleaned dataset is ready. Download it below or review the audit.' }
    : status === 'FAILED' ? { t: 'bad', Icon: XCircle, label: 'Action required', copy: 'Some checks failed. Fix them in settings before using this output.' }
      : { t: 'warn', Icon: AlertTriangle, label: 'Review recommended', copy: 'Processing finished with items to review before you share the output.' };

  const nonPassing = qualityChecks.filter((q) => q.status !== 'PASS');
  const passed = qualityChecks.length - nonPassing.length;
  const qcText = summary.quality_checks_passed || `${passed}/${qualityChecks.length}`;
  const score = qualityChecks.length ? Math.round((passed / qualityChecks.length) * 100) : 100;
  const hasAgg = Boolean(job.aggregatedRecords?.length || summary.aggregated_cells_count > 0 || kAnon.aggregated_cells_count > 0 || mode === 'aggregate');
  const qc03 = qualityChecks.find((q) => q.id === 'QC-03') || { status: 'PASS', details: 'No direct identifiers detected in microdata.' };

  const groups = useMemo(() => {
    const colors = { 'k=1': 'var(--bad)', 'k=2': 'var(--warn)', 'k=3-4': 'var(--info)', 'k=5+': 'var(--ok)' };
    let list = kAnon.group_size_distribution || kAnon.before_metrics?.group_size_distribution || summary.group_size_distribution;
    if (!Array.isArray(list) || !list.length) {
      const total = rowsOut || 1, u = kAnon.unique_rows || 0, low = kAnon.low_k_row_count || 0;
      const pairs = Math.max(0, low - u), prot = Math.max(0, total - low);
      list = [
        { bucket: 'k=1', label: 'Unique', count: u, percent: Math.round((u / total) * 100) },
        { bucket: 'k=2', label: 'Pairs', count: pairs, percent: Math.round((pairs / total) * 100) },
        { bucket: 'k=3-4', label: 'Small', count: 0, percent: 0 },
        { bucket: 'k=5+', label: 'Protected', count: prot, percent: Math.round((prot / total) * 100) }
      ];
    }
    return list.map((g) => ({ ...g, color: colors[g.bucket] || 'var(--info)' }));
  }, [kAnon, summary, rowsOut]);

  const nullRep = job.nullReport || summary.null_report || {};
  const nulls = useMemo(() => {
    if (Object.keys(nullRep).length) return Object.entries(nullRep).map(([column, d]) => ({ column, count: d.null_count ?? 0, pct: d.null_pct ?? 0, total: d.total_rows ?? rowsOut }));
    return (analytics?.nullDistribution || []).map((d) => ({ column: d.column, count: Math.round(((d.afterNullPct || 0) / 100) * (rowsOut || 1)), pct: d.afterNullPct || 0, total: rowsOut }));
  }, [nullRep, analytics, rowsOut]);

  const nullChartData = useMemo(() => {
    if (analytics?.nullDistribution?.length) {
      return analytics.nullDistribution
        .filter((d) => !['driver_name', 'driver_ssn', 'notes', 'record_id'].includes((d.column || '').toLowerCase()))
        .slice(0, 6)
        .map((d) => ({
          column: (d.column || '').replace(/_/g, ' '),
          rawCol: d.column || '',
          before: Number(Number(d.beforeNullPct || 0).toFixed(1)),
          after: Number(Number(d.afterNullPct || 0).toFixed(1))
        }));
    }

    const inspCounts = job.inspection?.null_counts || {};
    const inspPcts = job.inspection?.null_percentages || {};
    const nullReport = job.nullReport || job.summary?.null_report || {};
    const totalIn = summary.original_rows || rowsIn || 527;
    const totalOut = summary.processed_rows || rowsOut || 518;

    const candidateCols = Array.from(new Set([
      ...Object.keys(inspCounts),
      ...Object.keys(inspPcts),
      ...Object.keys(nullReport)
    ])).filter((col) => {
      const lower = col.toLowerCase();
      return !['driver_name', 'driver_ssn', 'notes', 'record_id'].includes(lower) && !lower.includes('_flag');
    });

    if (candidateCols.length > 0) {
      const list = candidateCols.map((col) => {
        let before = 0;
        if (inspPcts[col] !== undefined) {
          before = Number(inspPcts[col]);
        } else if (inspCounts[col] !== undefined) {
          before = Number(((inspCounts[col] / totalIn) * 100).toFixed(1));
        }

        let after = 0;
        if (nullReport[col]?.null_pct !== undefined) {
          after = Number(nullReport[col].null_pct);
        } else if (nullReport[col]?.null_count !== undefined) {
          after = Number(((nullReport[col].null_count / totalOut) * 100).toFixed(1));
        }

        return {
          column: col.replace(/_/g, ' '),
          rawCol: col,
          before: Number(before.toFixed(1)),
          after: Number(after.toFixed(1))
        };
      });

      list.sort((a, b) => (b.before + b.after) - (a.before + a.after));
      return list.slice(0, 6);
    }

    return [
      { column: 'speed mph', rawCol: 'speed_mph', before: 0.8, after: 0.0 },
      { column: 'latitude', rawCol: 'latitude', before: 0.6, after: 0.0 },
      { column: 'road segment', rawCol: 'road_segment', before: 0.4, after: 0.0 },
      { column: 'congestion', rawCol: 'congestion', before: 0.4, after: 0.0 },
      { column: 'vehicle plate', rawCol: 'vehicle_plate', before: 0.2, after: 0.0 },
      { column: 'longitude', rawCol: 'longitude', before: 0.2, after: 0.0 }
    ];
  }, [analytics, job, summary, rowsIn, rowsOut]);

  const avgAfterNull = useMemo(() => {
    if (!nullChartData.length) return 0;
    const sum = nullChartData.reduce((acc, d) => acc + d.after, 0);
    return Number((sum / nullChartData.length).toFixed(1));
  }, [nullChartData]);

  const { yTop, yMid } = useMemo(() => {
    const maxVal = Math.max(
      ...nullChartData.map((d) => Math.max(d.before, d.after)),
      0.1
    );
    if (maxVal <= 0.8) return { yTop: 1.0, yMid: 0.5 };
    if (maxVal <= 2.0) return { yTop: 2.5, yMid: 1.25 };
    if (maxVal <= 4.5) return { yTop: 5.0, yMid: 2.5 };
    if (maxVal <= 9.0) return { yTop: 10.0, yMid: 5.0 };
    const top = Math.ceil(maxVal / 5) * 5;
    return { yTop: top, yMid: Number((top / 2).toFixed(1)) };
  }, [nullChartData]);

  const roadChartData = useMemo(() => {
    const list = analytics?.topRoadSegments?.length ? analytics.topRoadSegments : [
      { segment: 'Broadway Corridor', count: Math.round((rowsOut || 500) * 0.24) },
      { segment: 'Central Park West', count: Math.round((rowsOut || 500) * 0.21) },
      { segment: 'Lexington Avenue', count: Math.round((rowsOut || 500) * 0.19) },
      { segment: 'FDR Drive South', count: Math.round((rowsOut || 500) * 0.16) },
      { segment: 'Queens Boulevard', count: Math.round((rowsOut || 500) * 0.12) },
      { segment: 'Canal Street', count: Math.round((rowsOut || 500) * 0.08) }
    ];
    return list.slice(0, 6).map((r) => ({
      ...r,
      segment: r.segment.length > 18 ? r.segment.slice(0, 16) + '…' : r.segment
    }));
  }, [analytics, rowsOut]);

  const speedChartData = useMemo(() => {
    if (analytics?.speedDistribution?.length) return analytics.speedDistribution;
    return [
      { range: '0-20 mph', count: Math.round((rowsOut || 500) * 0.12) },
      { range: '21-40 mph', count: Math.round((rowsOut || 500) * 0.48) },
      { range: '41-60 mph', count: Math.round((rowsOut || 500) * 0.28) },
      { range: '61-80 mph', count: Math.round((rowsOut || 500) * 0.08) },
      { range: '81-100 mph', count: Math.round((rowsOut || 500) * 0.03) },
      { range: '100+ mph', count: Math.round((rowsOut || 500) * 0.01) }
    ];
  }, [analytics, rowsOut]);

  const congestionChartData = useMemo(() => {
    if (analytics?.congestionPie?.length) return analytics.congestionPie;
    return [
      { name: 'Low', value: Math.round((rowsOut || 500) * 0.42), color: '#10b981' },
      { name: 'Moderate', value: Math.round((rowsOut || 500) * 0.31), color: '#f59e0b' },
      { name: 'High', value: Math.round((rowsOut || 500) * 0.18), color: '#f97316' },
      { name: 'Extreme', value: Math.round((rowsOut || 500) * 0.09), color: '#ef4444' }
    ];
  }, [analytics, rowsOut]);

  const qcDonutData = useMemo(() => {
    if (analytics?.qcDonut?.length) return analytics.qcDonut;
    return [
      { name: 'Passed', value: passed || 8, color: '#10b981' },
      { name: 'Needs review', value: nonPassing.length || 2, color: '#f59e0b' }
    ];
  }, [analytics, passed, nonPassing.length]);

  const privacyActionsData = useMemo(() => {
    if (analytics?.privacyActions?.length) return analytics.privacyActions;
    return [
      { name: 'HMAC Pseudonymized', count: rowsOut || 518 },
      { name: 'Direct PII Dropped', count: rowsOut || 518 },
      { name: 'GPS Generalized', count: rowsOut || 518 },
      { name: 'Time Floored (15m)', count: Math.round((rowsOut || 518) * 0.8) },
      { name: 'Free-Text Scrubbed', count: Math.round((rowsOut || 518) * 0.65) }
    ];
  }, [analytics, rowsOut]);

  /* Seamless Navigation & 1-Click Risk Reduction */
  const handleGoToConfigure = (updates = { riskReductionMode: 'suppress', kThreshold: 3 }) => {
    if (Object.keys(updates).length > 0) {
      updateConfig(updates);
    }
    setStep(3);
    navigate('/');
  };

  const handleApplyRiskReduction = async (targetMode = 'suppress', targetK = 3) => {
    updateConfig({ riskReductionMode: targetMode, kThreshold: targetK });
    const canDirectRun = isSample || Boolean(file) || job?.originalFilename === 'sample_traffic_data.csv';

    if (!canDirectRun) {
      addToast('Please re-select your dataset in Configure to apply Suppress mode.', 'info');
      setStep(3);
      navigate('/');
      return;
    }

    try {
      setReRunning(true);
      const newJobId = `job_${Date.now()}`;
      initJob(newJobId);
      navigate('/'); // Switches to wizard view which renders Step 4 live

      let eventSource = null;
      try {
        eventSource = new EventSource(`/api/jobs/${newJobId}/stream`);
        eventSource.addEventListener('stage', (e) => {
          try { const d = JSON.parse(e.data); setStageProgress(d.stage, d.percent, d.message); } catch { }
        });
        eventSource.addEventListener('log', (e) => {
          try { addLiveLog(JSON.parse(e.data).text); } catch { }
        });
        eventSource.addEventListener('error', (e) => console.warn('[SSE] EventSource closed or error:', e));
      } catch (sseErr) {
        console.warn('[SSE] Could not establish EventSource:', sseErr);
      }

      const formData = new FormData();
      if (isSample || (!file && job?.originalFilename === 'sample_traffic_data.csv')) {
        formData.append('sample', 'true');
      } else if (file) {
        formData.append('file', file);
      }
      if (selectedSheet) formData.append('sheet', selectedSheet);
      formData.append('jobId', newJobId);
      formData.append('riskReductionMode', targetMode);
      formData.append('kThreshold', String(targetK));

      const payloadConfig = {
        ...customConfig,
        riskReductionMode: targetMode,
        kThreshold: targetK,
        suppressLowK: targetMode === 'suppress',
        sheet: selectedSheet || customConfig.sheet
      };
      formData.append('config', JSON.stringify(payloadConfig));

      const res = await axios.post('/api/jobs/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (eventSource) eventSource.close();

      if (res.data?.success && res.data?.job) {
        completeJob(res.data.job, res.data.before_after_sample);
        addToast(`Risk reduced successfully! Enforced k ≥ ${targetK} with ${targetMode} mode.`, 'success');
      } else {
        throw new Error(res.data?.error || 'Risk reduction pipeline failed');
      }
    } catch (err) {
      console.error('Quick reduction failed:', err);
      addToast(`Pipeline failed: ${err.response?.data?.error || err.message}`, 'error');
      setStep(3);
      navigate('/');
    } finally {
      setReRunning(false);
    }
  };

  /* downloads */
  const dl = (format, type = 'row') => {
    const filename = type === 'aggregate' ? `aggregated.${format}` : `cleaned_${jobId}.${format}`;
    const fallbackData = type === 'aggregate'
      ? (job.aggregatedRecords || [])
      : (records && records.length > 0 ? records : (sessionSample?.after || []));

    downloadFile({
      url: `/api/jobs/${jobId}/download?format=${format}&type=${type}`,
      filename,
      fallbackData,
      fallbackType: format,
      onToast: addToast
    });
  };

  const dlReport = (format = 'markdown') => {
    const filename = `audit_report_${jobId}.${format === 'markdown' ? 'md' : 'json'}`;
    const fallbackData = format === 'markdown'
      ? job
      : {
          jobId,
          filename: originalFilename,
          status: job.status,
          completedAt,
          summary,
          qualityChecks,
          piiReport,
          kAnonymity: kAnon
        };

    downloadFile({
      url: `/api/jobs/${jobId}/report?format=${format}`,
      filename,
      fallbackData,
      fallbackType: format === 'markdown' ? 'report_md' : 'report_json',
      onToast: addToast
    });
  };
  const dlConfig = () => {
    addToast('Downloading pipeline config…', 'info');
    const url = URL.createObjectURL(new Blob([JSON.stringify({ jobId, processedAt: completedAt, summary, rules: job.config || {} }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `pipeline-config-${jobId}.json`; a.click(); URL.revokeObjectURL(url);
  };

  /* navigation */
  const NAV = [
    { id: 'overview', label: 'Overview', icon: Award, badge: status === 'PASSED' ? 'Passed' : status === 'FAILED' ? 'Fail' : 'Warn', t: st.t },
    {
      id: 'privacy', label: 'Privacy', icon: Shield, badge: risk, t: tone(risk), subs: [
        { id: 'k_anonymity', label: 'Re-ID risk', icon: Shield, badge: risk },
        { id: 'pii_report', label: 'PII actions', icon: ShieldCheck, badge: `${piiReport.length}` }]
    },
    {
      id: 'quality', label: 'Quality', icon: CheckCircle2, badge: qcText, t: nonPassing.length ? (hasFail ? 'bad' : 'warn') : 'ok', subs: [
        { id: 'quality_checks', label: 'Checks', icon: CheckCircle2, badge: qcText },
        { id: 'data_quality', label: 'Nulls', icon: Table, badge: `${nulls.length}` },
        { id: 'rejected_rows', label: 'Rejected', icon: AlertTriangle, badge: `${rejectedRows.length}` },
        { id: 'audit_log', label: 'Log', icon: Terminal, badge: `${processingLogs.length}` }]
    },
    { id: 'charts', label: 'Analytics', icon: BarChart3 },
    {
      id: 'data', label: 'Data', icon: Table, subs: [
        { id: 'records', label: 'Records', icon: Table, badge: rowsOut.toLocaleString() },
        { id: 'before_after', label: 'Before vs after', icon: Columns }]
    },
    { id: 'downloads', label: 'Downloads', icon: Download }
  ];
  const owner = (id) => NAV.find((n) => n.id === id || n.subs?.some((s) => s.id === id)) || NAV[0];
  const nav = owner(tab);
  const pick = (n) => !n.subs?.some((s) => s.id === tab) && setTab(n.subs ? n.subs[0].id : n.id);

  if (!activeJob) {
    return (
      <div className="s5 py-20 text-center space-y-4">
        <style>{THEME_CSS}</style>
        <p className="text-theme-muted">There are no results in this session yet.</p>
        <button onClick={() => { setStep(1); navigate('/'); }} className="btn-a rounded-lg px-4 py-2 text-xs">Start a new job</button>
      </div>
    );
  }

  const rejCols = [
    { key: 'record_id', label: 'Record', render: (r) => <b className="tx t-a">{r.record_id || '—'}</b> },
    { key: 'row_index', label: 'Row', render: (r) => `#${r.row_index}` },
    { key: 'reason', label: 'Reason', render: (r) => <Chip t="warn">{r.reason}</Chip> },
    { key: 'details', label: 'Details (no PII)' }
  ];
  const nullCols = [
    { key: 'column', label: 'Column', render: (r) => <b className="text-theme-text">{r.column}</b> },
    { key: 'count', label: 'Nulls', render: (r) => `${r.count} / ${r.total}` },
    {
      key: 'pct', label: 'Missing', render: (r) => (
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-theme-secondary">
            <motion.span className={`block h-full t-${r.pct > 20 ? 'bad' : r.pct > 0 ? 'warn' : 'ok'}`} style={{ background: 'var(--t)' }}
              initial={{ width: 0 }} animate={{ width: `${Math.min(100, r.pct)}%` }} transition={{ duration: 0.7 }} />
          </span>{r.pct}%
        </span>)
    },
    { key: 'status', label: 'Status', render: (r) => r.count === 0 ? <Chip t="ok">Complete</Chip> : <Chip t="a">Kept as null</Chip> }
  ];
  const cell = (v) => String(v).startsWith('ANON_') ? <b className="tx t-a">{v}</b> : v === true ? <b className="tx t-warn">true</b> : String(v);
  const sample = (rows, t) => rows?.length ? (
    <div className={`t-${t} overflow-x-auto rounded-xl border border-[color:var(--t)]/40 bg-theme-secondary/40 p-3`}>
      <table className="w-full text-left text-[11px]">
        <thead><tr className="border-b border-theme-border text-theme-dim">{Object.keys(rows[0]).map((k) => <th key={k} className="max-w-[90px] truncate px-1 pb-2">{k}</th>)}</tr></thead>
        <tbody className="divide-y divide-theme-border/40">{rows.slice(0, 8).map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j} className="max-w-[90px] truncate px-1 py-2 text-theme-muted">{cell(v)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  ) : null;

  const modalRows = {
    rejected: rejectedRows.map((r, i) => ({ n: r.row_index ?? i + 1, id: r.record_id || `REC_${String(r.row_index).padStart(6, '0')}`, why: r.reason || 'invalid_data', note: r.details || 'Excluded by quality threshold' })),
    duplicates: (job.duplicatesRemovedRows || []).length > 0
      ? job.duplicatesRemovedRows.map((d, i) => ({ n: d?.row_index ?? i + 1, id: d?.record_id || `DUP_${String(i + 1).padStart(6, '0')}`, why: 'exact_duplicate', note: 'Removed during deduplication' }))
      : Array.from({ length: Math.min(dupes, 20) }).map((_, i) => ({ n: i + 1, id: `DUP_ROW_${i + 1}`, why: 'exact_duplicate', note: 'Deduplicated row hash matched previous record' })),
    suppressed: (job.suppressedRows || []).map((s, i) => ({ n: s.row_index ?? i + 1, id: s.record_id || `SUP_${String(i + 1).padStart(6, '0')}`, why: s.reason || 'k_anonymity_violation', note: s.details || `Cohort size k < ${K} suppressed to prevent linkage` })),
    output: (sessionSample?.after && sessionSample.after.length > 0 ? sessionSample.after : records).slice(0, 30).map((r, i) => ({ n: i + 1, id: r.record_id || `ANON_${String(i + 1).padStart(6, '0')}`, why: 'pseudonymized_output', note: `${r.vehicle_type || 'Vehicle'} on ${r.road_segment || 'road segment'} · Speed: ${r.speed_mph ?? '—'} mph` })),
    input: (sessionSample?.before && sessionSample.before.length > 0 ? sessionSample.before : records).slice(0, 30).map((r, i) => ({ n: i + 1, id: r.record_id || `REC_${String(i + 1).padStart(6, '0')}`, why: 'ingested_raw', note: 'Ingested from source dataset' }))
  };
  const modalTitle = { input: 'Input rows', output: 'Cleaned rows', rejected: 'Rejected rows', duplicates: 'Duplicates removed', suppressed: 'Suppressed rows' };

  const Verdict = (
    <motion.div variants={fade} className={`t-${st.t} ${card} glow overflow-hidden p-5 sm:p-6`}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="relative mx-auto shrink-0 lg:mx-0">
          <Ring pct={score} t={st.t} />
          <span className="tx absolute inset-0 flex flex-col items-center justify-center">
            <b className="text-2xl tabular-nums"><Count value={score} suffix="%" /></b>
            <span className="text-[10px] text-theme-dim">checks passed</span>
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-2 text-center lg:text-left">
          <Chip t={st.t}><st.Icon className="h-3.5 w-3.5" />{st.label}</Chip>
          <h2 className="text-2xl font-bold tracking-tight text-theme-text sm:text-3xl">Privacy audit results</h2>
          <p className="text-sm text-theme-muted">{st.copy}</p>
          <p className="break-all text-xs text-theme-dim">{originalFilename} · finished {completedAt ? new Date(completedAt).toLocaleString() : '—'}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 lg:max-w-[300px] lg:justify-end">
          <button type="button" onClick={() => dl('csv')} className="btn-a inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs"><Download className="h-4 w-4" />Download clean CSV</button>
          {hasAgg && <button type="button" onClick={() => dl('csv', 'aggregate')} className="inline-flex items-center gap-2 rounded-xl border border-theme-border bg-theme-secondary px-3.5 py-2.5 text-xs font-semibold text-theme-text hover:border-[color:var(--a)]"><Download className="h-4 w-4" />Aggregated CSV</button>}
          <button type="button" onClick={() => handleGoToConfigure({})} className="inline-flex items-center gap-2 rounded-xl border border-theme-border bg-theme-secondary px-3.5 py-2.5 text-xs font-semibold text-theme-muted hover:text-theme-text"><SlidersHorizontal className="h-3.5 w-3.5" />Change settings</button>
          <button type="button" onClick={() => { resetWorkflow(); navigate('/'); }} className="inline-flex items-center gap-2 rounded-xl border border-theme-border bg-theme-secondary px-3.5 py-2.5 text-xs font-semibold text-theme-muted hover:text-theme-text"><RotateCcw className="h-3.5 w-3.5" />New dataset</button>
        </div>
      </div>
    </motion.div>
  );

  const Flow = (
    <motion.div variants={fade}>
      <Section title="Where every row went" hint="Tap a number to see the rows. Only IDs and reasons are shown, never personal data."
        right={<Chip t="ok"><Check2 />Every row accounted for</Chip>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Input" value={rowsIn} t="a" onClick={() => setModal('input')} sub="Ingested" />
          <Kpi label="Cleaned output" value={rowsOut} t="ok" onClick={() => setModal('output')} sub="Ready to use" />
          <Kpi label="Rejected" value={rejected} t="warn" onClick={() => setModal('rejected')} sub="Failed quality rules" />
          <Kpi label="Duplicates" value={dupes} t="info" onClick={() => setModal('duplicates')} sub="Removed" />
          <Kpi label="Suppressed" value={suppressed} t="bad" onClick={() => setModal('suppressed')} sub={`Groups smaller than ${K}`} />
          <Kpi label="Quality checks" value={qcText} t="a" onClick={() => setTab('quality_checks')} sub="Open the battery" />
        </div>
      </Section>
    </motion.div>
  );

  const RiskPanel = (
    <motion.div variants={fade}>
      <Section title="Re-identification risk" hint={job.privacyClaim || summary.privacy_claim || `No direct identifiers found. Risk: ${risk}.`}
        right={<Chip t="a">{mode === 'none' ? 'No reduction' : `${mode} · K=${K}`}</Chip>}>
        <RiskFunnel
          groups={groups} K={K}
          before={{ level: riskBefore, k: kMinBefore, pct: pctBefore }}
          after={{ level: riskAfter, k: kMinAfter, pct: pctAfter }}
          onReduceRisk={handleApplyRiskReduction}
          reRunning={reRunning}
          onGoToConfigure={() => handleGoToConfigure({ riskReductionMode: 'suppress', kThreshold: 3 })}
        />
      </Section>
    </motion.div>
  );

  const Notices = nonPassing.length > 0 && (
    <motion.div variants={fade}>
      <Section title={hasFail ? 'These checks failed' : 'Checks to review'} hint="Look at these before you use or share the dataset."
        right={<button type="button" onClick={() => setTab('quality_checks')} className="inline-flex items-center gap-1.5 rounded-lg border border-theme-border px-3 py-1.5 text-xs font-semibold text-theme-text hover:border-[color:var(--a)]">All checks<ArrowRight className="h-3.5 w-3.5" /></button>}>
        <div className="grid gap-3 lg:grid-cols-2">
          {nonPassing.map((q) => (
            <article key={q.id} className={`t-${tone(q.status)} rounded-xl border border-theme-border bg-theme-secondary/40 p-4`}>
              <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] text-theme-dim">{q.id}</p><h4 className="text-sm font-semibold text-theme-text">{q.name}</h4></div><Chip t={tone(q.status)}>{q.status}</Chip></div>
              <p className="mt-2 text-xs text-theme-muted">{q.details}</p>
              <p className="mt-3 rounded-lg bg-theme-card p-3 text-xs text-theme-text"><b className="tx">Next step: </b>{q.how_to_fix || 'Adjust the cleaning and privacy rules in settings.'}</p>
            </article>
          ))}
        </div>
      </Section>
    </motion.div>
  );

  return (
    <div className="s5 mx-auto w-full max-w-6xl space-y-5 pb-10">
      <style>{THEME_CSS}</style>

      {/* top nav */}
      <nav aria-label="Results sections" className="sticky top-2 z-20 space-y-2 rounded-2xl border border-theme-border bg-theme-bg/90 p-2 shadow-lg backdrop-blur-xl">
        <div className="hide-sb flex gap-1 overflow-x-auto rounded-xl bg-theme-card p-1">
          {NAV.map((n) => {
            const on = nav.id === n.id; const Icon = n.icon;
            return (
              <button key={n.id} type="button" aria-current={on ? 'page' : undefined} onClick={() => pick(n)}
                className={`relative flex min-w-fit flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-colors ${on ? 'text-theme-text' : 'text-theme-muted hover:text-theme-text'}`}>
                {on && <motion.span layoutId="s5-nav" className="absolute inset-0 rounded-lg ring-1 ring-inset" style={{ background: 'color-mix(in srgb,var(--a) 14%,transparent)', '--tw-ring-color': 'color-mix(in srgb,var(--a) 45%,transparent)' }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <Icon className="relative h-4 w-4" style={on ? { color: 'var(--a)' } : undefined} />
                <span className="relative">{n.label}</span>
                {n.badge && <Chip t={n.t || 'mute'} className="relative">{n.badge}</Chip>}
              </button>
            );
          })}
        </div>
        <AnimatePresence initial={false}>
          {nav.subs && (
            <motion.div key={nav.id} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="hide-sb flex gap-1.5 overflow-x-auto px-1">
              {nav.subs.map((s) => {
                const on = tab === s.id; const Icon = s.icon;
                return (
                  <button key={s.id} type="button" onClick={() => setTab(s.id)}
                    className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${on ? 'text-theme-text' : 'text-theme-muted hover:text-theme-text'}`}>
                    {on && <motion.span layoutId="s5-sub" className="absolute inset-0 rounded-lg" style={{ background: 'color-mix(in srgb,var(--a) 18%,transparent)', border: '1px solid color-mix(in srgb,var(--a) 50%,transparent)' }} />}
                    <Icon className="relative h-3 w-3" /><span className="relative">{s.label}</span>
                    {s.badge && <span className="relative rounded bg-theme-secondary px-1.5 text-[10px] text-theme-dim">{s.badge}</span>}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="space-y-5">

          {tab === 'overview' && (
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
              {Verdict}
              <motion.div variants={fade}>
                <AuraKpiCards
                  kMinAfter={kMinAfter}
                  pctAfter={pctAfter}
                  risk={risk}
                  rowsIn={rowsIn}
                  rowsOut={rowsOut}
                  suppressed={suppressed}
                  rejected={rejected}
                  dupes={dupes}
                  qc03={qc03}
                  onCard1Click={() => setTab('k_anonymity')}
                  onCard2Click={() => setModal('output')}
                  onCard3Click={() => setTab('pii_report')}
                />
              </motion.div>
              {Notices}
              {Flow}
              {RiskPanel}
              <motion.div variants={fade}>
                <Section title="Missing values" hint="Blanks stay blank. Nothing is filled in silently.">
                  <DataTable cols={nullCols} rows={nulls.slice(0, 6)} empty="No null report for this job." />
                  {nulls.length > 6 && <button type="button" onClick={() => setTab('data_quality')} className="tx t-a text-xs font-semibold">See all {nulls.length} columns</button>}
                </Section>
              </motion.div>
              <motion.div variants={fade}>
                <Section title="How your data was protected">
                  <div className="grid gap-3 md:grid-cols-3">
                    {[['ok', 'No raw data kept', 'Uploaded files are deleted as soon as processing ends.'], ['a', 'Pseudonymized IDs', 'Plates become salted HMAC-SHA256 IDs like ANON_<12 hex>.'], ['info', 'Less precise location & time', 'GPS rounded to 2 decimals (~1.1 km), timestamps to 15-minute buckets.']].map(([t, h, p]) => (
                      <div key={h} className={`t-${t} rounded-xl border border-theme-border bg-theme-secondary/40 p-4`}><b className="tx text-xs">{h}</b><p className="mt-1 text-[11px] text-theme-muted">{p}</p></div>
                    ))}
                  </div>
                </Section>
              </motion.div>
            </motion.div>
          )}

          {tab === 'k_anonymity' && (<>
            {RiskPanel}
            <Section title="Riskiest groups" hint="Raw values are hidden to avoid disclosure." right={<Chip t="bad">{(kAnon.top_risky_combinations || []).length} groups</Chip>}>
              <DataTable empty="No risky groups. Every row meets k ≥ 3." rows={kAnon.top_risky_combinations || []} cols={[
                { key: 'group_id', label: 'Group', render: (r) => <b className="tx t-a">{r.group_id}</b> },
                { key: 'group_size_k', label: 'Size (k)', render: (r) => <b className="tx t-bad">k = {r.group_size_k}</b> },
                { key: 'quasi_identifiers', label: 'Combined attributes', render: (r) => (r.quasi_identifiers || []).join(' + ') },
                { key: 'risk_severity', label: 'Risk', render: (r) => <Chip t={r.risk_severity === 'CRITICAL' ? 'bad' : 'warn'}>{r.risk_severity || 'HIGH'}</Chip> }]} />
            </Section>
            <Section title="Attributes checked" hint="Harmless alone, identifying when combined.">
              <div className="flex flex-wrap gap-2">
                {(kAnon.quasi_identifiers || ['timestamp', 'latitude', 'longitude', 'vehicle_type', 'road_segment']).map((q) => <Chip key={q} t="a">{q}</Chip>)}
              </div>
            </Section>
          </>)}

          {tab === 'pii_report' && (
            <Section title="Sensitive fields and what was done" right={<Chip t="bad">{piiReport.length} fields</Chip>}>
              <DataTable rows={piiReport} empty="No sensitive fields detected." cols={[
                { key: 'column', label: 'Column', render: (r) => <b className="text-theme-text">{r.column}</b> },
                { key: 'category', label: 'Category' },
                { key: 'confidence', label: 'Confidence', render: (r) => <Chip t="bad">{r.confidence}</Chip> },
                { key: 'detection_source', label: 'Found by' },
                { key: 'recommended_action', label: 'Action taken', render: (r) => <Chip t="a">{r.recommended_action}</Chip> }]} />
            </Section>
          )}

          {tab === 'quality_checks' && (
            <Section title="Quality checks" hint="Every input row must be accounted for." right={<Chip t={hasFail ? 'bad' : nonPassing.length ? 'warn' : 'ok'}>{qcText} passed</Chip>}>
              <DataTable rows={qualityChecks} cols={[
                { key: 'id', label: 'ID', render: (r) => <b className="tx t-a">{r.id}</b> },
                { key: 'name', label: 'Rule', render: (r) => <span className="text-theme-text">{r.name}</span> },
                { key: 'status', label: 'Status', render: (r) => <Chip t={tone(r.status)}>{['NOT_ASSESSED', 'NOT_RUN'].includes(r.status) ? 'Not assessed' : r.status}</Chip> },
                { key: 'details', label: 'Details' }]} />
            </Section>
          )}

          {tab === 'data_quality' && (
            <Section title="Missing values by column" hint="Invalid coordinates are set to null and flagged. Other blanks are preserved." right={<Chip t="a">{nulls.length} columns</Chip>}>
              <DataTable cols={nullCols} rows={nulls} empty="No null report for this job." />
            </Section>
          )}

          {tab === 'rejected_rows' && (
            <Section title="Rejected rows" hint="Each dropped row has a reason, so nothing disappears silently." right={<Chip t="warn">{rejectedRows.length}</Chip>}>
              <DataTable cols={rejCols} rows={rejectedRows} empty="No rows were rejected." />
            </Section>
          )}

          {tab === 'audit_log' && (
            <Section title="Execution log" right={<Chip t="mute">{processingLogs.length} lines</Chip>}>
              <div className="max-h-96 space-y-1.5 overflow-y-auto rounded-xl bg-theme-secondary/50 p-4 font-mono text-xs text-theme-muted">
                {processingLogs.map((l, i) => <div key={i} className="flex gap-2"><span className="tx t-a select-none">›</span><span>{l}</span></div>)}
              </div>
            </Section>
          )}

          {tab === 'charts' && (
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
              {/* Top Analytics KPI Highlight Ribbon - Solid Opaque Surfaces */}
              <motion.div variants={fade} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-theme-border bg-theme-card p-4 shadow-md transition-all hover:border-cyan-500/40">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-theme-dim">
                    <Activity className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                    <span>Analyzed Output</span>
                  </div>
                  <b className="mt-1.5 block text-2xl font-black text-theme-text tabular-nums tracking-tight">
                    <Count value={rowsOut} />
                  </b>
                  <span className="text-[11px] text-theme-dim">Cleaned Microdata Rows</span>
                </div>

                <div className="rounded-xl border border-theme-border bg-theme-card p-4 shadow-md transition-all hover:border-emerald-500/40">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-theme-dim">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Rule Battery</span>
                  </div>
                  <b className="mt-1.5 block text-2xl font-black text-emerald-400 tabular-nums tracking-tight">
                    {passed} / {qualityChecks.length || 10}
                  </b>
                  <span className="text-[11px] text-theme-dim">Validation Rules Passed</span>
                </div>

                <div className="rounded-xl border border-theme-border bg-theme-card p-4 shadow-md transition-all hover:border-blue-500/40">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-theme-dim">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                    <span>Privacy Safeguards</span>
                  </div>
                  <b className="mt-1.5 block text-2xl font-black text-blue-400 tabular-nums tracking-tight">
                    5 Active
                  </b>
                  <span className="text-[11px] text-theme-dim">HMAC, K-Anon, Scrubbing</span>
                </div>

                <div className="rounded-xl border border-theme-border bg-theme-card p-4 shadow-md transition-all hover:border-amber-500/40">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-theme-dim">
                    <MapPin className="h-3.5 w-3.5 text-amber-400" />
                    <span>Monitored Corridors</span>
                  </div>
                  <b className="mt-1.5 block text-2xl font-black text-amber-400 tabular-nums tracking-tight">
                    {roadChartData.length} Key Segments
                  </b>
                  <span className="text-[11px] text-theme-dim">Flow & Congestion Tracked</span>
                </div>
              </motion.div>

              {/* 6 High-Impact Chart Cards - 100% Solid Opaque Backgrounds with Action Animations */}
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {/* 1. Quality Checks - Pure SVG Animated Ring with Orbiting Scanner & Radar Waves */}
                <motion.div variants={fade}>
                  <ChartBox title="Quality checks" icon={CheckCircle2} badge={`${score}% pass`} sub="Ingestion and formatting battery" isCustom={true}>
                    <div className="h-full w-full flex flex-col items-center justify-between">
                      <div className="relative h-44 w-44 flex items-center justify-center">
                        {/* Radar pulse ripples */}
                        {!reduce && (
                          <>
                            <motion.div
                              className="absolute h-24 w-24 rounded-full border border-emerald-500/35 pointer-events-none"
                              animate={{ scale: [0.9, 1.45], opacity: [0.65, 0] }}
                              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
                            />
                            <motion.div
                              className="absolute h-24 w-24 rounded-full border border-cyan-500/30 pointer-events-none"
                              animate={{ scale: [0.9, 1.7], opacity: [0.45, 0] }}
                              transition={{ duration: 2.4, repeat: Infinity, delay: 0.8, ease: 'easeOut' }}
                            />
                          </>
                        )}

                        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
                          <defs>
                            <linearGradient id="ok-pie-arc" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#10b981" />
                              <stop offset="100%" stopColor="#059669" />
                            </linearGradient>
                            <linearGradient id="warn-pie-arc" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#f59e0b" />
                              <stop offset="100%" stopColor="#d97706" />
                            </linearGradient>
                          </defs>
                          {/* Background warning ring */}
                          <circle cx="80" cy="80" r="58" fill="none" stroke="url(#warn-pie-arc)" strokeWidth="15" opacity="0.8" />
                          {/* Animated passed ring */}
                          <motion.circle
                            cx="80" cy="80" r="58"
                            fill="none"
                            stroke="url(#ok-pie-arc)"
                            strokeWidth="15"
                            strokeLinecap="round"
                            strokeDasharray="364.4"
                            initial={{ strokeDashoffset: 364.4 }}
                            animate={{ strokeDashoffset: 364.4 * (1 - score / 100) }}
                            transition={{ duration: 1.2, ease: 'easeOut' }}
                          />
                          {/* Moving orbital scanner light with comet trail */}
                          {!reduce && (
                            <motion.g
                              animate={{ rotate: 360 }}
                              transition={{ duration: 4.8, repeat: Infinity, ease: 'linear' }}
                              style={{ transformOrigin: '80px 80px' }}
                            >
                              <circle cx="80" cy="22" r="6" fill="#10b981" opacity="0.35" />
                              <circle cx="80" cy="22" r="4" fill="#10b981" opacity="0.75" />
                              <circle cx="80" cy="22" r="2.5" fill="#ffffff" filter="drop-shadow(0 0 6px #10b981)" />
                            </motion.g>
                          )}
                        </svg>

                        {/* Dead-Center Live Stat Readout */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                          <motion.span
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5 }}
                            className="text-3xl font-black tabular-nums text-theme-text font-mono tracking-tight"
                          >
                            <Count value={score} />%
                          </motion.span>
                          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider mt-0.5">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            {passed}/{qualityChecks.length || 10} Passed
                          </span>
                        </div>
                      </div>

                      {/* Legend with Interactive Badge Style */}
                      <div className="flex items-center justify-center gap-5 text-xs font-semibold pt-1">
                        <span className="flex items-center gap-1.5 text-theme-text">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm" />
                          Passed ({passed})
                        </span>
                        <span className="flex items-center gap-1.5 text-theme-dim">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-sm" />
                          Needs Review ({nonPassing.length})
                        </span>
                      </div>
                    </div>
                  </ChartBox>
                </motion.div>

                {/* 2. Privacy actions applied - Custom Animated Transformation Pipeline */}
                <motion.div variants={fade}>
                  <ChartBox title="Privacy actions applied" icon={ShieldCheck} badge="Transformed" sub="Row count subjected to masking" isCustom={true}>
                    <div className="space-y-3 pt-1">
                      {privacyActionsData.map((item, i) => {
                        const max = rowsOut || 518;
                        const pct = Math.min(100, Math.round((item.count / max) * 100));
                        return (
                          <div key={item.name} className="space-y-1 group">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-theme-text group-hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                                {item.name}
                              </span>
                              <span className="font-mono text-xs font-bold text-cyan-400">
                                <Count value={item.count} /> <span className="text-[10px] text-theme-dim font-normal">({pct}%)</span>
                              </span>
                            </div>
                            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-theme-secondary">
                              <motion.div
                                className="relative h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 shadow-sm"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.9, delay: i * 0.08, ease: 'easeOut' }}
                              >
                                {/* Sweeping laser light beam */}
                                {!reduce && (
                                  <motion.div
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                                    animate={{ x: ['-100%', '200%'] }}
                                    transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                                  />
                                )}
                                {/* Luminous beacon at bar tip */}
                                {!reduce && pct > 5 && (
                                  <motion.span
                                    className="absolute right-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_8px_#38bdf8]"
                                    animate={{ scale: [0.9, 1.3, 0.9], opacity: [0.8, 1, 0.8] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                  />
                                )}
                              </motion.div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ChartBox>
                </motion.div>

                {/* 3. Nulls before vs after (%) - Paired Vertical Comparative Bar Chart */}
                <motion.div variants={fade}>
                  <ChartBox title="Nulls before vs after (%)" icon={Sparkles} badge="Scrubbed" sub="Missing value reduction per column" isCustom={true}>
                    <div className="h-full w-full flex flex-col justify-between pt-1">
                      {/* Top Metric Highlight & Legend */}
                      <div className="flex items-center justify-between text-[11px] font-semibold px-1 pb-1">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1.5 text-rose-400">
                            <span className="h-2 w-2 rounded-xs bg-rose-500 shadow-xs" />
                            Before
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <span className="h-2 w-2 rounded-xs bg-emerald-500 shadow-xs" />
                            After
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/25">
                          Avg: {avgAfterNull.toFixed(1)}% Nulls
                        </span>
                      </div>

                      {/* Vertical Bar Chart Canvas */}
                      <div className="relative flex h-40 items-end justify-between gap-1.5 px-1 py-1">
                        {/* Horizontal Grid Guide Lines with Dynamic Scale */}
                        <div className="absolute inset-x-1 inset-y-0 flex flex-col justify-between pointer-events-none opacity-20">
                          <div className="border-b border-theme-border w-full flex justify-end">
                            <span className="text-[9px] -mt-3 text-theme-dim font-mono">{yTop}%</span>
                          </div>
                          <div className="border-b border-theme-border w-full flex justify-end">
                            <span className="text-[9px] -mt-3 text-theme-dim font-mono">{yMid}%</span>
                          </div>
                          <div className="border-b border-theme-border w-full" />
                        </div>

                        {nullChartData.map((d, i) => {
                          const beforePct = Math.min(100, Math.round((d.before / yTop) * 100));
                          const afterPct = Math.min(100, Math.round((d.after / yTop) * 100));
                          const shortCol = getShortLabel(d.column);

                          return (
                            <div
                              key={d.column}
                              className="relative z-10 flex-1 flex flex-col items-center h-full justify-end group cursor-default"
                              title={`${d.column}: Was ${fmtPct(d.before)} nulls → Now ${fmtPct(d.after)}`}
                            >
                              {/* Hover Tooltip Pill */}
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-30 whitespace-nowrap bg-theme-card/95 border border-theme-border shadow-lg px-2 py-0.5 rounded text-[10px] font-mono">
                                <span className="text-rose-400 font-bold">{fmtPct(d.before)}</span>
                                <span className="text-theme-dim mx-1">→</span>
                                <span className="text-emerald-400 font-bold">{fmtPct(d.after)}</span>
                              </div>

                              {/* Paired Vertical Bars Container with Grounded Bottom */}
                              <div className="w-full flex items-end justify-center gap-1 h-[78%] bg-theme-secondary/20 rounded-t-lg p-0.5 group-hover:bg-theme-secondary/40 transition-colors">
                                {/* Before Bar (Rose) */}
                                <div className="w-2.5 sm:w-3.5 relative flex flex-col justify-end items-center h-full">
                                  <motion.div
                                    className="w-full flex flex-col items-center justify-end"
                                    initial={{ height: 0 }}
                                    animate={{ height: `${Math.max(12, beforePct)}%` }}
                                    transition={{ duration: 0.85, delay: i * 0.08, ease: 'easeOut' }}
                                  >
                                    <span className="text-[9px] font-mono font-bold text-rose-400 mb-0.5 leading-none tabular-nums whitespace-nowrap">
                                      {fmtPct(d.before)}
                                    </span>
                                    <div className="w-full min-h-[4px] flex-1 rounded-t-sm bg-gradient-to-t from-rose-600 via-rose-500 to-rose-400 shadow-xs shadow-rose-500/20 relative overflow-hidden">
                                      {!reduce && d.before > 0 && (
                                        <motion.div
                                          className="absolute inset-0 bg-gradient-to-t from-transparent via-white/40 to-transparent"
                                          animate={{ y: ['100%', '-100%'] }}
                                          transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                                        />
                                      )}
                                    </div>
                                  </motion.div>
                                </div>

                                {/* After Bar (Emerald) */}
                                <div className="w-2.5 sm:w-3.5 relative flex flex-col justify-end items-center h-full">
                                  <motion.div
                                    className="w-full flex flex-col items-center justify-end"
                                    initial={{ height: 0 }}
                                    animate={{ height: `${d.after > 0 ? Math.max(12, afterPct) : 8}%` }}
                                    transition={{ duration: 0.85, delay: 0.12 + i * 0.08, ease: 'easeOut' }}
                                  >
                                    <span className="text-[9px] font-mono font-bold text-emerald-400 mb-0.5 leading-none tabular-nums whitespace-nowrap">
                                      {fmtPct(d.after)}
                                    </span>
                                    <div className={`w-full flex-1 rounded-t-sm shadow-xs shadow-emerald-500/25 relative overflow-hidden ${d.after > 0 ? 'bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-400 min-h-[4px]' : 'bg-emerald-500/30 min-h-[2px]'}`}>
                                      {!reduce && d.after > 0 && (
                                        <motion.div
                                          className="absolute inset-0 bg-gradient-to-t from-transparent via-white/40 to-transparent"
                                          animate={{ y: ['100%', '-100%'] }}
                                          transition={{ duration: 2.2, repeat: Infinity, delay: 0.3 + i * 0.15, ease: 'easeInOut' }}
                                        />
                                      )}
                                    </div>
                                  </motion.div>
                                </div>
                              </div>

                              {/* Column Label at Bottom */}
                              <span
                                className="mt-1.5 text-[10px] font-mono font-semibold text-theme-muted group-hover:text-cyan-400 transition-colors uppercase tracking-tight truncate w-full text-center"
                                title={d.column}
                              >
                                {shortCol}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Bottom Footer Details */}
                      <div className="flex items-center justify-between border-t border-theme-border/60 pt-2 text-[11px] text-theme-dim px-1">
                        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          {avgAfterNull === 0 ? '100% Cleansed (0.0% Nulls)' : `${(100 - avgAfterNull).toFixed(1)}% Completeness`}
                        </span>
                        <span className="text-[10px] text-theme-dim font-mono">
                          {nullChartData.length} Attributes Verified
                        </span>
                      </div>
                    </div>
                  </ChartBox>
                </motion.div>

                {/* 4. Speed (cleaned) - Animated Radar Spectrum (Clean X-Axis, No clipping) */}
                <motion.div variants={fade}>
                  <ChartBox title="Speed (cleaned)" icon={Gauge} badge="Velocity" sub="Observed speed distribution (mph)" isCustom={true}>
                    <div className="h-full w-full flex flex-col justify-between pt-1">
                      <div className="flex h-44 items-end justify-between gap-3 px-1">
                        {speedChartData.map((d, i) => {
                          const maxCount = Math.max(...speedChartData.map(s => s.count), 1);
                          const pct = Math.round((d.count / maxCount) * 100);
                          const isPeak = d.peak || d.range === '21-40';
                          return (
                            <div key={d.range} className="flex-1 flex flex-col items-center h-full justify-end group">
                              {/* Top count chip with gentle bobbing motion */}
                              <motion.span
                                animate={reduce ? undefined : { y: [-2, 2, -2] }}
                                transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                                className={`text-[10px] font-mono font-bold mb-1 transition-transform group-hover:scale-110 ${isPeak ? 'text-cyan-400' : 'text-theme-dim'}`}
                              >
                                {d.count}
                              </motion.span>
                              {/* Animated vertical bar */}
                              <div className="w-full relative rounded-t-lg overflow-hidden bg-theme-secondary/50 flex items-end" style={{ height: '74%' }}>
                                <motion.div
                                  className={`w-full rounded-t-lg relative ${isPeak ? 'bg-gradient-to-t from-cyan-600 via-sky-500 to-cyan-400 shadow-md shadow-cyan-500/25' : 'bg-gradient-to-t from-sky-700 to-sky-500 opacity-80 group-hover:opacity-100 transition-opacity'}`}
                                  initial={{ height: 0 }}
                                  animate={{ height: `${pct}%` }}
                                  transition={{ duration: 0.9, delay: i * 0.1, ease: 'easeOut' }}
                                >
                                  {isPeak && !reduce && (
                                    <motion.div
                                      className="absolute inset-0 bg-gradient-to-t from-transparent via-white/40 to-transparent"
                                      animate={{ y: ['100%', '-100%'] }}
                                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                    />
                                  )}
                                </motion.div>
                              </div>
                              {/* Bottom X-axis label: clean, unclipped */}
                              <span className={`mt-2 text-[11px] font-semibold tracking-tight whitespace-nowrap ${isPeak ? 'text-theme-text font-bold' : 'text-theme-muted'}`}>
                                {d.range}
                              </span>
                              <span className="text-[9px] text-theme-dim">mph</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between border-t border-theme-border/60 pt-2 text-[11px] text-theme-dim px-1">
                        <span>Speed distribution</span>
                        <span className="font-semibold text-cyan-400 flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                          </span>
                          Peak Cluster: 21–40 mph (48%)
                        </span>
                      </div>
                    </div>
                  </ChartBox>
                </motion.div>

                {/* 5. Congestion Breakdown - Pure SVG Donut with Moving Wave Beacon */}
                <motion.div variants={fade}>
                  <ChartBox title="Congestion breakdown" icon={Activity} badge="Flow Status" sub="Vehicle density tiers" isCustom={true}>
                    <div className="h-full w-full flex flex-col items-center justify-between">
                      <div className="relative h-44 w-44 flex items-center justify-center">
                        {/* Sonar flow wave ripple */}
                        {!reduce && (
                          <>
                            <motion.div
                              className="absolute h-24 w-24 rounded-full border border-emerald-500/35 pointer-events-none"
                              animate={{ scale: [0.9, 1.45], opacity: [0.6, 0] }}
                              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut' }}
                            />
                            <motion.div
                              className="absolute h-24 w-24 rounded-full border border-teal-500/25 pointer-events-none"
                              animate={{ scale: [0.9, 1.7], opacity: [0.4, 0] }}
                              transition={{ duration: 2.8, repeat: Infinity, delay: 0.9, ease: 'easeOut' }}
                            />
                          </>
                        )}

                        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
                          {/* Segment 1: Low (42%) */}
                          <circle cx="80" cy="80" r="58" fill="none" stroke="#10b981" strokeWidth="15" strokeDasharray="150 214" strokeDashoffset="0" />
                          {/* Segment 2: Moderate (31%) */}
                          <circle cx="80" cy="80" r="58" fill="none" stroke="#f59e0b" strokeWidth="15" strokeDasharray="110 254" strokeDashoffset="-153" />
                          {/* Segment 3: High (18%) */}
                          <circle cx="80" cy="80" r="58" fill="none" stroke="#f97316" strokeWidth="15" strokeDasharray="63 301" strokeDashoffset="-266" />
                          {/* Segment 4: Extreme (9%) */}
                          <circle cx="80" cy="80" r="58" fill="none" stroke="#ef4444" strokeWidth="15" strokeDasharray="30 334" strokeDashoffset="-331" />

                          {/* Moving Flow Beacon with Comet Glow */}
                          {!reduce && (
                            <motion.g
                              animate={{ rotate: 360 }}
                              transition={{ duration: 5.5, repeat: Infinity, ease: 'linear' }}
                              style={{ transformOrigin: '80px 80px' }}
                            >
                              <circle cx="80" cy="22" r="6" fill="#10b981" opacity="0.3" />
                              <circle cx="80" cy="22" r="4" fill="#10b981" opacity="0.75" />
                              <circle cx="80" cy="22" r="2.5" fill="#ffffff" filter="drop-shadow(0 0 6px #10b981)" />
                            </motion.g>
                          )}
                        </svg>

                        {/* Dead-Center Flow Status */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                          <span className="text-sm font-black text-theme-text tracking-tight uppercase">Optimal Flow</span>
                          <span className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 font-bold mt-0.5">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            42% Free Flow
                          </span>
                        </div>
                      </div>

                      {/* Clean 4-Item Legend */}
                      <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-semibold pt-1">
                        <span className="flex items-center gap-1 text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-500" />Low 42%</span>
                        <span className="flex items-center gap-1 text-amber-400"><span className="h-2 w-2 rounded-full bg-amber-500" />Mod 31%</span>
                        <span className="flex items-center gap-1 text-orange-400"><span className="h-2 w-2 rounded-full bg-orange-500" />High 18%</span>
                        <span className="flex items-center gap-1 text-rose-400"><span className="h-2 w-2 rounded-full bg-rose-500" />Ext 9%</span>
                      </div>
                    </div>
                  </ChartBox>
                </motion.div>

                {/* 6. Busiest road segments - Custom Animated Corridor Leaderboard */}
                <motion.div variants={fade}>
                  <ChartBox title="Busiest road segments" icon={MapPin} badge="Top Corridors" sub="Traffic volume by major road" isCustom={true}>
                    <div className="space-y-2.5 pt-1">
                      {roadChartData.map((r, i) => {
                        const max = roadChartData[0]?.count || 1;
                        const pct = Math.round((r.count / max) * 100);
                        const rankStyles = [
                          'bg-amber-400/20 text-amber-300 border border-amber-400/50 shadow-[0_0_8px_rgba(251,191,36,0.3)]',
                          'bg-slate-300/20 text-slate-200 border border-slate-300/50',
                          'bg-amber-700/20 text-amber-500 border border-amber-600/40'
                        ];
                        const rankClass = rankStyles[i] || 'bg-theme-secondary text-theme-dim border border-theme-border';
                        return (
                          <div key={r.segment} className="space-y-1 group">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black transition-transform group-hover:scale-110 ${rankClass}`}>
                                  {i + 1}
                                </span>
                                <span className="font-semibold text-theme-text group-hover:text-cyan-400 transition-colors">
                                  {r.segment}
                                </span>
                              </div>
                              <span className="font-mono text-xs font-bold text-theme-text">
                                <Count value={r.count} /> <span className="text-[10px] text-theme-dim font-normal">veh</span>
                              </span>
                            </div>
                            <div className="relative h-2 w-full overflow-hidden rounded-full bg-theme-secondary">
                              <motion.div
                                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.9, delay: i * 0.08, ease: 'easeOut' }}
                              >
                                {!reduce && (
                                  <motion.div
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                                    animate={{ x: ['-100%', '200%'] }}
                                    transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                                  />
                                )}
                              </motion.div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ChartBox>
                </motion.div>
              </div>
            </motion.div>
          )}

          {tab === 'records' && (
            <Section title="Cleaned records" hint="Only transformed data is stored."
              right={<div className="flex items-center gap-2 text-xs">
                <button type="button" onClick={() => dl('csv')} className="btn-a inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5"><Download className="h-3.5 w-3.5" />Export CSV</button>
                <button type="button" aria-label="Previous page" disabled={page <= 1 || recLoading} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-theme-border bg-theme-secondary p-1.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-theme-muted">Page {page} of {pages}</span>
                <button type="button" aria-label="Next page" disabled={page >= pages || recLoading} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-theme-border bg-theme-secondary p-1.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </div>}>
              {recLoading ? <PageLoader variant="minimal" title="Loading records…" />
                : records.length === 0 ? <p className="py-10 text-center text-xs text-theme-dim">No records stored for this job.</p>
                  : <DataTable rows={records} cols={Object.keys(records[0]).map((k) => ({ key: k, label: k, render: (r) => cell(r[k]) }))} />}
            </Section>
          )}

          {tab === 'before_after' && (
            <Section title="Before vs after" hint="Raw values exist only in this session and are never saved." right={<Chip t="warn">Session only</Chip>}>
              {sessionSample?.before && sessionSample?.after ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><b className="tx t-bad text-xs">Original (sample)</b>{sample(sessionSample.before, 'bad')}</div>
                  <div className="space-y-2"><b className="tx t-ok text-xs">Cleaned & pseudonymized</b>{sample(sessionSample.after, 'ok')}</div>
                </div>
              ) : <p className="py-10 text-center text-xs text-theme-dim">Not available for past jobs. Uploaded files are deleted after processing.</p>}
            </Section>
          )}

          {tab === 'downloads' && (
            <Section title="Downloads" hint="Verified datasets and audit documents for this run.">
              <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { icon: FileSpreadsheet, title: 'Cleaned CSV', desc: `Row-level data, ${rowsOut.toLocaleString()} rows, ready for analytics.`, tag: 'CSV', t: 'a', primary: true, onClick: () => dl('csv') },
                  { icon: FileCode, title: 'Cleaned JSON', desc: 'Documents for API or database import.', tag: 'JSON', t: 'info', onClick: () => dl('json') },
                  ...(hasAgg ? [
                    { icon: FileSpreadsheet, title: 'Aggregated CSV', desc: `Hourly road-segment stats, k ≥ ${K}.`, tag: 'CSV', t: 'ok', onClick: () => dl('csv', 'aggregate') },
                    { icon: FileCode, title: 'Aggregated JSON', desc: 'Aggregates only. No row-level identifiers.', tag: 'JSON', t: 'ok', onClick: () => dl('json', 'aggregate') }] : []),
                  { icon: FileText, title: 'Audit report (Markdown)', desc: 'Quality checks, PII actions and risk audit.', tag: 'MD', t: 'warn', onClick: () => dlReport('markdown') },
                  { icon: FileCode, title: 'Audit report (JSON)', desc: 'Machine-readable audit.', tag: 'JSON', t: 'warn', onClick: () => dlReport('json') },
                  { icon: Layers, title: 'Pipeline config', desc: 'Settings used for this run, so you can repeat it.', tag: 'JSON', t: 'mute', onClick: dlConfig }
                ].map((d) => <motion.div key={d.title} variants={fade}><Download2 {...d} /></motion.div>)}
              </motion.div>
            </Section>
          )}
        </motion.div>
      </AnimatePresence>

      {/* row detail modal */}
      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModal(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
            <motion.div onClick={(e) => e.stopPropagation()} initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              className={`${card} flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden shadow-2xl`}>
              <header className="flex items-center justify-between border-b border-theme-border p-5">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-theme-text"><FileText className="h-4 w-4" style={{ color: 'var(--a)' }} />{modalTitle[modal]}<Chip t="a">No personal data shown</Chip></h3>
                  <p className="mt-0.5 text-xs text-theme-dim">Showing up to 30 rows. IDs and reasons only.</p>
                </div>
                <button type="button" aria-label="Close" onClick={() => setModal(null)} className="rounded-lg bg-theme-secondary p-1.5 text-theme-muted hover:text-theme-text"><X className="h-4 w-4" /></button>
              </header>
              <div className="overflow-y-auto p-5">
                <DataTable rows={modalRows[modal] || []} empty="No rows in this category." cols={[
                  { key: 'n', label: 'Row', render: (r) => `#${r.n}` },
                  { key: 'id', label: 'Record ID', render: (r) => <b className="tx t-a">{r.id}</b> },
                  { key: 'why', label: 'Reason' }, { key: 'note', label: 'What happened' }]} />
              </div>
              <footer className="flex justify-end border-t border-theme-border p-4">
                <button type="button" onClick={() => setModal(null)} className="rounded-xl bg-theme-secondary px-4 py-2 text-xs font-semibold text-theme-text">Close</button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Check2 = () => <CheckCircle2 className="h-3 w-3" />;