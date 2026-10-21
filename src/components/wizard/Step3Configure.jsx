import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, animate, useReducedMotion } from 'framer-motion';
import {
  Shield, ShieldCheck, Zap, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Info,
  SlidersHorizontal, Table, Check, Trash2, KeyRound, EyeOff, Search, RefreshCw, MapPin,
  Clock, ChevronRight, ChevronDown, Minus, Plus, X, LayoutGrid, List, Lock, Share2, Globe, ArrowDownUp,
} from 'lucide-react';
import {
  useWorkflowStore, PRESET_DEFINITIONS, getPresetConfig, computeScores,
} from '../../store/useWorkflowStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useToast } from '../Toast';
import InfoTooltip from '../InfoTooltip';
import axios from 'axios';

/* =====================================================================
 *  PURE HELPERS (exported for unit tests, unchanged behaviour)
 * ===================================================================== */

/** Sanitized job config. K is sent ONLY for 'suppress' and 'aggregate'. */
export function buildJobPayloadConfig(customConfig = {}, selectedSheet = null) {
  const mode = customConfig.riskReductionMode || 'none';
  const isSuppressOrAggregate = mode === 'suppress' || mode === 'aggregate';
  const payload = { ...customConfig, riskReductionMode: mode, sheet: selectedSheet || customConfig.sheet };
  if (isSuppressOrAggregate) payload.kThreshold = Number(customConfig.kThreshold ?? 3);
  else delete payload.kThreshold;
  return payload;
}

/** Permissible privacy actions, filtered strictly by column classification. */
export function getAllowedActionsForColumn(pii) {
  const cat = (pii?.category || '').toLowerCase();
  const col = (pii?.name || pii?.column || '').toLowerCase();
  const classification = (pii?.classification || '').toLowerCase();

  if (
    cat === 'coordinates' ||
    col === 'latitude' || col === 'longitude' || col === 'lat' || col === 'lon' || col === 'lng' ||
    col.startsWith('lat_') || col.endsWith('_lat') || col.startsWith('lon_') || col.endsWith('_lon') ||
    classification.includes('gps') || classification.includes('geographic') || classification.includes('spatial')
  ) {
    return [
      { value: 'GENERALIZE_SPATIAL', label: 'Generalize' },
      { value: 'DROP_COLUMN', label: 'Remove column' },
      { value: 'KEEP', label: 'Keep (Warning Required)' },
    ];
  }
  if (
    cat === 'datetime' || cat === 'timestamp' ||
    classification.includes('time') || classification.includes('timestamp') ||
    ((col.includes('time') || col.includes('date')) && !col.includes('dob') && !col.includes('birth'))
  ) {
    return [
      { value: 'TIME_BUCKET', label: 'Time-bucket' },
      { value: 'DROP_COLUMN', label: 'Remove column' },
      { value: 'KEEP', label: 'Keep (Warning Required)' },
    ];
  }
  if (
    cat === 'free_text_pii' || cat === 'free_text' ||
    ['notes', 'note', 'comment', 'comments', 'remark', 'remarks', 'description'].some((k) => col.includes(k)) ||
    classification.includes('free-text')
  ) {
    return [
      { value: 'REDACT', label: 'Redact' },
      { value: 'DROP_COLUMN', label: 'Remove column' },
      { value: 'KEEP', label: 'Keep (Warning Required)' },
    ];
  }
  if (
    ['identifier', 'plate_number', 'vin', 'device_id'].includes(cat) ||
    col.endsWith('_id') || col.startsWith('id_') || col === 'plate' || col === 'vin' ||
    classification.includes('identifier') || classification.includes('plate') || classification.includes('vin')
  ) {
    return [
      { value: 'PSEUDONYMIZE_HMAC', label: 'Pseudonymize (HMAC)' },
      { value: 'DROP_COLUMN', label: 'Remove column' },
      { value: 'KEEP', label: 'Keep (Warning Required)' },
    ];
  }
  if (['ssn', 'national_id', 'credit_card', 'dob'].includes(cat) || classification.includes('ssn') || classification.includes('credit card') || classification.includes('birth')) {
    return [
      { value: 'DROP_COLUMN', label: 'Remove column' },
      { value: 'REDACT', label: 'Redact' },
      { value: 'PSEUDONYMIZE_HMAC', label: 'Pseudonymize (HMAC)' },
      { value: 'KEEP', label: 'Keep (Warning Required)' },
    ];
  }
  return [
    { value: 'DROP_COLUMN', label: 'Remove column' },
    { value: 'REDACT', label: 'Redact' },
    { value: 'PSEUDONYMIZE_HMAC', label: 'Pseudonymize (HMAC)' },
    { value: 'KEEP', label: 'Keep (Warning Required)' },
  ];
}

/** Masked sample shown for the current action/config. */
export function getMaskedSampleDisplay(pii, action, customConfig = {}) {
  const raw = pii?.first_non_null_value;
  if (action === 'DROP_COLUMN') return '[COLUMN_REMOVED]';
  if (action === 'KEEP') return raw || '[RAW_VALUE_KEPT]';
  if (action === 'GENERALIZE_SPATIAL') {
    const num = parseFloat(raw);
    const prec = customConfig?.gpsPrecision ?? 2;
    return !isNaN(num) ? `${num.toFixed(prec)} (~1.1 km)` : (pii?.sample_masked || '[GENERALIZED_GPS]');
  }
  if (action === 'TIME_BUCKET') {
    const min = customConfig?.timeBucketMinutes ?? 15;
    return `[${min}m UTC Floored]`;
  }
  if (action === 'PSEUDONYMIZE_HMAC') return pii?.sample_masked || (raw ? `ANON_${raw.slice(0, 6)}` : 'ANON_7c9f8a12e4b0');
  if (action === 'REDACT') return pii?.sample_masked || '[REDACTED]';
  return pii?.sample_masked || '[REDACTED]';
}

/* =====================================================================
 *  DESIGN TOKENS  (Green Aura family, same as the Step 2 dashboard)
 * ===================================================================== */

const T = {
  onyx: '#0A0D0B', sage: '#5E8F72', sage2: '#96C4A0', mint: '#ACDBB8', mist: '#D3F4D1',
  olive: '#B0C9A1', cloud: '#EAEBEA', teal: '#4E94AE', teal2: '#9CCBDD',
  amber: '#D49A2F', orange: '#D9803A', rose: '#D4566A',
};
const rgba = (hex, a) => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(128,128,128,${a})`;
  const n = parseInt(hex.slice(1), 16);
  if (isNaN(n)) return `rgba(128,128,128,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const RISK = {
  CRITICAL: { c: T.rose, order: 0 },
  HIGH: { c: T.orange, order: 1 },
  MEDIUM: { c: T.amber, order: 2 },
};
const ACTION_META = {
  DROP_COLUMN: { icon: Trash2, c: T.rose, protect: 5, short: 'Removed' },
  REDACT: { icon: EyeOff, c: T.orange, protect: 4, short: 'Redacted' },
  PSEUDONYMIZE_HMAC: { icon: KeyRound, c: T.teal, protect: 4, short: 'Pseudonymized' },
  GENERALIZE_SPATIAL: { icon: MapPin, c: T.sage, protect: 3, short: 'Generalized' },
  TIME_BUCKET: { icon: Clock, c: T.sage, protect: 3, short: 'Bucketed' },
  KEEP: { icon: AlertTriangle, c: T.rose, protect: 0, short: 'Unprotected' },
};
const DIRECT_CATS = ['driver_name', 'ssn', 'national_id', 'phone', 'email', 'credit_card', 'dob', 'address', 'plate_number', 'vin', 'identifier'];
const QUASI_CATS = ['coordinates', 'datetime', 'timestamp', 'device_id', 'ip_address'];
const GPS_LABELS = ['City level (~111 km)', 'Town level (~11 km)', 'District level (~1.1 km)', 'Street level (~110 m)', 'Exact point (~11 m)'];
const GPS_RADIUS = [25, 18, 12, 7, 3];

/* =====================================================================
 *  SMALL UI PARTS
 * ===================================================================== */

function useCountUp(target, duration = 0.9) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? target : 0);
  const prev = useRef(0);
  useEffect(() => {
    if (reduce) { setN(target); return; }
    const c = animate(prev.current, target, {
      duration, ease: 'easeOut', onUpdate: (v) => setN(Math.round(v)),
    });
    prev.current = target;
    return () => c.stop();
  }, [target, duration, reduce]);
  return n;
}

function Num({ value, suffix = '' }) {
  const n = useCountUp(Number(value) || 0);
  return <>{n.toLocaleString()}{suffix}</>;
}

function Card({ accent = T.sage, className = '', children, ...rest }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-theme-border bg-theme-card transition-shadow hover:shadow-lg hover:shadow-cyan-500/[0.03] ${className}`} {...rest}>
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-52 w-52 rounded-full opacity-[0.14] blur-3xl transition-opacity duration-300" style={{ background: accent }} />
      <div className="relative">{children}</div>
    </div>
  );
}

function Label({ icon: Icon, children, accent = T.sage, right }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-theme-muted">
        {Icon && <Icon className="h-3.5 w-3.5" style={{ color: accent }} />}
        <span>/{String(children).toUpperCase()}</span>
      </span>
      {right}
    </div>
  );
}

function MiniAura({ accent = T.sage, secondary = T.mint }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative h-14 w-14 shrink-0" aria-hidden>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(circle, ${rgba(accent, 0.45)} 0%, ${T.cloud} 100%)` }}
        animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute rounded-full" style={{ inset: '16%', background: `radial-gradient(circle, ${secondary} 20%, ${rgba(accent, 0.7)} 100%)` }} />
      <div className="absolute rounded-full" style={{ inset: '33%', background: `radial-gradient(circle, ${T.onyx} 0%, ${T.onyx} 8%, ${secondary} 100%)` }} />
    </div>
  );
}

function ExecuteButton({ onClick, disabled, className = '', accent = T.sage, secondary = T.mint }) {
  return (
    <motion.button
      type="button" onClick={onClick} disabled={disabled}
      whileHover={disabled ? undefined : { y: -1.5, scale: 1.01 }} whileTap={disabled ? undefined : { scale: 0.97 }}
      className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-black shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer ${className}`}
      style={{
        background: `linear-gradient(90deg, ${accent}, ${secondary})`,
        boxShadow: `0 8px 24px ${rgba(accent, 0.35)}`,
      }}
    >
      <span aria-hidden className="exec-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/50" />
      <Zap className="relative h-4 w-4 fill-current" />
      <span className="relative">Execute Pipeline</span>
      <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </motion.button>
  );
}

/** Two concentric full rings: outer = privacy, inner = utility. */
function ScoreRings({ privacy, utility, accent = T.sage, secondary = T.teal }) {
  const rings = [
    { v: privacy, r: 50, id: 'ringP', a: accent, b: T.sage2 },
    { v: utility, r: 37, id: 'ringU', a: secondary, b: T.teal2 },
  ];
  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0 -rotate-90 text-theme-text" aria-hidden>
      <defs>
        {rings.map((g) => (
          <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={g.a} /><stop offset="1" stopColor={g.b} />
          </linearGradient>
        ))}
      </defs>
      {rings.map((g, i) => (
        <g key={g.id}>
          <circle cx="60" cy="60" r={g.r} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="9" />
          <motion.circle
            cx="60" cy="60" r={g.r} fill="none" stroke={`url(#${g.id})`} strokeWidth="9" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: Math.max(0, Math.min(100, g.v)) / 100 }}
            transition={{ duration: 1, delay: 0.1 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
          />
        </g>
      ))}
    </svg>
  );
}

function Delta({ value, goodWhenPositive = true }) {
  if (!value) return null;
  const good = goodWhenPositive ? value > 0 : value < 0;
  const c = good ? T.sage : T.rose;
  return (
    <span className="rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold" style={{ color: c, borderColor: rgba(c, 0.4), background: rgba(c, 0.1) }}>
      {value > 0 ? `+${value}` : value}
    </span>
  );
}

/** Pill row with a sliding highlight shared via layoutId. */
function Segmented({ id, options, value, onChange, className = '' }) {
  return (
    <div className={`relative grid gap-1 rounded-xl border border-theme-border bg-theme-secondary/60 p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} className="relative rounded-lg py-1.5 font-mono text-xs font-semibold cursor-pointer">
            {on && (
              <motion.span layoutId={id} className="absolute inset-0 rounded-lg border" style={{ background: rgba(T.sage, 0.18), borderColor: rgba(T.sage, 0.5) }} transition={{ type: 'spring', stiffness: 420, damping: 32 }} />
            )}
            <span className={`relative ${on ? 'text-theme-text' : 'text-theme-muted'}`}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-transparent bg-theme-secondary/40 p-3 transition-colors hover:border-theme-border hover:bg-theme-secondary/70">
      <span className="text-xs text-theme-muted">{label}</span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-5 w-9 rounded-full bg-theme-border transition-colors peer-checked:bg-[#5E8F72] peer-focus-visible:ring-2 peer-focus-visible:ring-[#ACDBB8]" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

function Highlight({ text, q }) {
  const s = String(text ?? '');
  if (!q) return s;
  const i = s.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return s;
  return (
    <>
      {s.slice(0, i)}
      <mark className="rounded px-0.5 text-inherit" style={{ background: rgba(T.mint, 0.65) }}>{s.slice(i, i + q.length)}</mark>
      {s.slice(i + q.length)}
    </>
  );
}

function ProtectionMeter({ level, color }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Protection ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.span
          key={i} className="h-1.5 w-3.5 rounded-full"
          initial={false} animate={{ backgroundColor: i <= level ? color : 'rgba(128,128,128,0.18)' }}
          transition={{ duration: 0.3, delay: i * 0.03 }}
        />
      ))}
    </div>
  );
}

const ActionSelect = React.memo(function ActionSelect({
  pii,
  colName,
  value,
  onPick,
  compact = false,
  options,
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
  onClose: controlledOnClose,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const open = isControlled ? controlledIsOpen : internalOpen;
  const closeTimerRef = useRef(null);
  const openRef = useRef(open);
  openRef.current = open;
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;
  const onToggleRef = useRef(controlledOnToggle);
  onToggleRef.current = controlledOnToggle;
  const onCloseRef = useRef(controlledOnClose);
  onCloseRef.current = controlledOnClose;

  const setOpen = useCallback((next) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    const curr = openRef.current;
    const nextVal = typeof next === 'function' ? next(curr) : next;
    if (isControlledRef.current) {
      if (onToggleRef.current) onToggleRef.current(nextVal);
      if (!nextVal && onCloseRef.current) onCloseRef.current();
    } else {
      setInternalOpen(nextVal);
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpen(true);
  }, [setOpen]);

  const handleMouseLeave = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, 180);
  }, [setOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const containerRef = useRef(null);
  const meta = ACTION_META[value] || ACTION_META.DROP_COLUMN;
  const Icon = meta.icon;
  const list = options || getAllowedActionsForColumn(pii);
  const activeOption = list.find((o) => o.value === value) || list[0] || { value, label: value };

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open, setOpen]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative w-full"
    >
      {/* Hidden real select for 100% test suite and programmatic synchrony */}
      <select
        id={`action-select-${colName}`}
        data-testid={`action-select-${colName}`}
        value={value}
        onChange={(e) => onPick(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      >
        {list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Custom styled trigger button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`group flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border bg-theme-secondary/80 px-3 font-mono text-xs text-theme-text transition-all hover:border-theme-border hover:bg-theme-secondary ${compact ? 'py-1.5' : 'py-2'
          } ${open ? 'ring-2 ring-cyan-500/30' : ''}`}
        style={{
          borderColor: value === 'KEEP' ? rgba(T.rose, 0.7) : open ? rgba(meta.c, 0.7) : undefined,
          background: value === 'KEEP' ? rgba(T.rose, 0.1) : undefined,
        }}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: meta.c }} />
          <span className="truncate">{activeOption.label}</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-theme-dim transition-transform duration-200 group-hover:text-theme-text ${open ? 'rotate-180 text-theme-text' : ''
            }`}
        />
      </button>

      {/* Floating Glassmorphic Dropdown Menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-72 overflow-y-auto rounded-xl border border-theme-border bg-theme-card p-1.5 shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
          >
            {list.map((opt) => {
              const optMeta = ACTION_META[opt.value] || ACTION_META.DROP_COLUMN;
              const OptIcon = optMeta.icon;
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
                    onPick(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 font-mono text-xs transition-colors ${isSelected
                      ? 'bg-theme-secondary font-semibold text-theme-text'
                      : 'text-theme-muted hover:bg-theme-secondary/70 hover:text-theme-text'
                    }`}
                  style={
                    isSelected && opt.value === 'KEEP'
                      ? { color: T.rose, background: rgba(T.rose, 0.12) }
                      : isSelected
                        ? { color: optMeta.c }
                        : undefined
                  }
                >
                  <span className="flex items-center gap-2 truncate">
                    <OptIcon className="h-3.5 w-3.5 shrink-0" style={{ color: optMeta.c }} />
                    <span className="truncate">{opt.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <ProtectionMeter level={optMeta.protect} color={optMeta.c} />
                    {isSelected && <Check className="h-3.5 w-3.5 text-theme-text" />}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/* =====================================================================
 *  PAGE
 * ===================================================================== */

const rise = (i = 0) => ({
  initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: i * 0.07 },
});

const SHARE = [
  { mode: 'none', id: 'share-option-none', icon: Lock, title: 'Internal use only', desc: 'Keeps every row. You get a risk report only.' },
  { mode: 'suppress', id: 'share-option-suppress', icon: Share2, title: 'Share with a partner', badge: 'Recommended', desc: 'Blurs time and location slightly and removes trips that would stand out. Recommended default.' },
  { mode: 'aggregate', id: 'share-option-aggregate', icon: Globe, title: 'Publish publicly', desc: 'Produces summaries per road and hour. No individual trips.' },
];

const OUTLIERS = [
  { v: 'flag_only', t: 'Flag only', badge: 'Recommended', d: 'Preserves original telemetry while adding `speed_outlier_flag = true` for QC audits.' },
  { v: 'set_null', t: 'Set to null', d: 'Replaces physically impossible speeds (<0 or >250 mph) with null.' },
  { v: 'cap', t: 'Cap at 120 mph', d: 'Truncates values above 120 mph (not recommended for strict audits).' },
];

export default function Step3Configure() {
  const { addToast } = useToast();
  const reduce = useReducedMotion();
  const profile = useWorkflowStore((s) => s.profileData);
  const file = useWorkflowStore((s) => s.file);
  const isSample = useWorkflowStore((s) => s.isSample);
  const customConfig = useWorkflowStore((s) => s.customConfig);
  const updateConfig = useWorkflowStore((s) => s.updateConfig);
  const applyPreset = useWorkflowStore((s) => s.applyPreset);
  const activePreset = useWorkflowStore((s) => s.activePreset);
  const selectedSheet = useWorkflowStore((s) => s.selectedSheet);
  const calculateScores = useWorkflowStore((s) => s.calculateScores);
  const setStep = useWorkflowStore((s) => s.setStep);
  const initJob = useWorkflowStore((s) => s.initJob);
  const setStageProgress = useWorkflowStore((s) => s.setStageProgress);
  const addLiveLog = useWorkflowStore((s) => s.addLiveLog);
  const completeJob = useWorkflowStore((s) => s.completeJob);

  const theme = useThemeStore((s) => s.theme);
  const themeColors = useThemeStore((s) => s.getThemeColors)();
  const themeAccent = themeColors?.primary || T.sage;
  const themeSecondary = themeColors?.secondary || T.teal;

  const [activeTab, setActiveTab] = useState('privacy');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('risk');
  const [viewMode, setViewMode] = useState('cards');
  const [keepWarningCol, setKeepWarningCol] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [openActionCol, setOpenActionCol] = useState(null);
  const handleToggleActionCol = useCallback((col, nextOpen) => {
    setOpenActionCol(nextOpen ? col : null);
  }, []);
  const handleCloseActionCol = useCallback(() => {
    setOpenActionCol(null);
  }, []);
  const searchRef = useRef(null);

  const piiColumns = useMemo(() => profile?.pii_columns || profile?.detected_pii || [], [profile]);

  const numericColumns = useMemo(() => {
    const cols = profile?.columns || [];
    return cols
      .filter((c) => c.inferred_type === 'numeric' || c.dtype === 'numeric')
      .map((c) => ({ column: c.name, min: c.stats?.min ?? 0, max: c.stats?.max ?? 100 }));
  }, [profile?.columns]);

  const scores = useMemo(() => calculateScores(), [calculateScores, customConfig, piiColumns]);
  const { privacyScore, utilityScore, beforePrivacy, beforeUtility, beforeRisk, afterRisk } = scores;

  const allowedActionsMap = useMemo(() => {
    const map = {};
    for (const p of piiColumns) {
      map[p.name || p.column] = getAllowedActionsForColumn(p);
    }
    return map;
  }, [piiColumns]);

  const presetScores = useMemo(() => {
    const scores = {};
    for (const key of Object.keys(PRESET_DEFINITIONS)) {
      scores[key] = computeScores(getPresetConfig(key, piiColumns), piiColumns);
    }
    return scores;
  }, [piiColumns]);

  /* ---- per-column accessors ---- */
  const nameOf = (p) => p.name || p.column;
  const actionOf = (p) => customConfig.piiActions?.[nameOf(p)] || p.default_action || p.recommended_action || 'DROP_COLUMN';
  const confOf = (p) => Math.round((typeof p.confidence === 'number' ? p.confidence : 0.95) * 100);
  const riskOf = (p) => {
    const c = confOf(p);
    return String(p.risk_badge || (c >= 95 ? 'CRITICAL' : c >= 80 ? 'HIGH' : 'MEDIUM')).toUpperCase();
  };

  /* ---- search / filter / sort ---- */
  const q = searchQuery.toLowerCase().trim();
  const filteredPiiColumns = useMemo(() => {
    const list = piiColumns.filter((p) => {
      const name = (p.name || p.column || '').toLowerCase();
      const cls = (p.classification || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const risk = (p.risk_badge || '').toLowerCase();
      if (q && !(name.includes(q) || cls.includes(q) || cat.includes(q))) return false;
      if (categoryFilter === 'direct') return DIRECT_CATS.includes(cat) || risk === 'critical' || risk === 'high';
      if (categoryFilter === 'quasi') return QUASI_CATS.includes(cat) || cls.includes('quasi') || cls.includes('gps');
      if (categoryFilter === 'high_risk') return risk === 'critical' || risk === 'high';
      if (categoryFilter === 'unprotected') return (customConfig.piiActions?.[p.name || p.column] || p.default_action || p.recommended_action || 'DROP_COLUMN') === 'KEEP';
      return true;
    });
    const sorted = [...list];
    if (sortBy === 'name') sorted.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    else if (sortBy === 'confidence') sorted.sort((a, b) => confOf(b) - confOf(a));
    else sorted.sort((a, b) => (RISK[riskOf(a)]?.order ?? 3) - (RISK[riskOf(b)]?.order ?? 3));
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piiColumns, q, categoryFilter, sortBy, customConfig.piiActions]);

  const counts = useMemo(() => {
    let direct = 0, quasi = 0, high = 0, unprotected = 0;
    for (const p of piiColumns) {
      const cat = (p.category || '').toLowerCase();
      const risk = (p.risk_badge || '').toLowerCase();
      const cls = (p.classification || '').toLowerCase();
      if (DIRECT_CATS.includes(cat) || risk === 'critical' || risk === 'high') direct++;
      if (QUASI_CATS.includes(cat) || cls.includes('quasi') || cls.includes('gps')) quasi++;
      if (risk === 'critical' || risk === 'high') high++;
      if ((customConfig.piiActions?.[p.name || p.column] || p.default_action || p.recommended_action || 'DROP_COLUMN') === 'KEEP') unprotected++;
    }
    return { total: piiColumns.length, direct, quasi, high, unprotected };
  }, [piiColumns, customConfig.piiActions]);

  const FILTERS = [
    { v: 'all', label: 'All', n: counts.total, c: T.sage },
    { v: 'direct', label: 'Direct identifiers', n: counts.direct, c: T.rose },
    { v: 'quasi', label: 'Quasi-identifiers', n: counts.quasi, c: T.amber },
    { v: 'high_risk', label: 'High / critical', n: counts.high, c: T.orange },
    { v: 'unprotected', label: 'Unprotected', n: counts.unprotected, c: T.rose },
  ];

  /* "/" focuses search, Esc closes the warning modal */
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        e.preventDefault();
        setActiveTab('privacy');
        setTimeout(() => searchRef.current?.focus(), 0);
      }
      if (e.key === 'Escape') setKeepWarningCol(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---- batch actions ---- */
  const handleBatchAction = (type) => {
    const updated = { ...(customConfig.piiActions || {}) };
    let count = 0;
    if (type === 'pseudonymize_all_ids') {
      for (const p of piiColumns) {
        const col = p.name || p.column;
        const cat = (p.category || '').toLowerCase();
        if (['identifier', 'plate_number', 'vin', 'device_id'].includes(cat) || col.endsWith('_id') || col.startsWith('id_')) {
          updated[col] = 'PSEUDONYMIZE_HMAC'; count++;
        }
      }
      addToast(`Pseudonymized ${count} identifier fields using HMAC-SHA256.`, 'success');
    } else if (type === 'drop_direct_pii') {
      for (const p of piiColumns) {
        const col = p.name || p.column;
        const cat = (p.category || '').toLowerCase();
        if (['driver_name', 'ssn', 'national_id', 'phone', 'email', 'credit_card', 'dob', 'address'].includes(cat)) {
          updated[col] = 'DROP_COLUMN'; count++;
        }
      }
      addToast(`Set ${count} direct personal identifiers to be dropped.`, 'success');
    } else if (type === 'reset_recommendations') {
      for (const p of piiColumns) {
        const col = p.name || p.column;
        updated[col] = p.default_action || p.recommended_action || 'DROP_COLUMN';
      }
      addToast('Reset all columns to privacy recommendations.', 'info');
    }
    updateConfig({ piiActions: updated });
  };

  const pickAction = useCallback((colName, val) => {
    if (val === 'KEEP') {
      setKeepWarningCol(colName);
    } else {
      updateConfig({
        piiActions: {
          ...(useWorkflowStore.getState().customConfig.piiActions || {}),
          [colName]: val,
        },
      });
    }
  }, [updateConfig]);

  /* ---- live preview: only compute when preview tab is active to preserve CPU and battery ---- */
  const previewPairs = useMemo(() => {
    if (activeTab !== 'preview') return [];
    const sourceRows = profile?.preview_rows?.length ? profile.preview_rows.slice(0, 5) : [];
    return sourceRows.map((row) => {
      const out = { ...row };
      for (const p of piiColumns) {
        const col = p.name || p.column;
        const action = customConfig?.piiActions?.[col] || p.default_action || p.recommended_action || 'DROP_COLUMN';
        if (action === 'DROP_COLUMN') delete out[col];
        else if (action === 'PSEUDONYMIZE_HMAC') out[col] = p.sample_masked || 'ANON_7c9f8a12e4b0';
        else if (action === 'REDACT') out[col] = p.sample_masked || '[REDACTED]';
        else if (action === 'GENERALIZE_SPATIAL') {
          const num = parseFloat(out[col]);
          if (!isNaN(num)) out[col] = Number(num.toFixed(customConfig?.gpsPrecision ?? 2));
        } else if (action === 'TIME_BUCKET') out[col] = `[${customConfig?.timeBucketMinutes ?? 15}m UTC Floored]`;
      }
      const timeMinutes = customConfig?.timeBucketMinutes ?? 15;
      for (const k of Object.keys(out)) {
        if ((k.toLowerCase().includes('time') || k.toLowerCase().includes('date')) && !String(out[k]).includes('Floored')) {
          out[k] = `[${timeMinutes}m UTC Floored]`;
        }
      }
      for (const k of Object.keys(out)) {
        if (k.toLowerCase().includes('speed') || k.toLowerCase().includes('velocity')) {
          const spd = parseFloat(out[k]);
          if (!isNaN(spd)) {
            if (customConfig?.outlierStrategy === 'set_null' && (spd > 120 || spd < 0 || spd > 250)) out[k] = null;
            if (spd > 120 || spd < 0 || spd > 250) out.speed_outlier_flag = true;
          }
        }
      }
      return { src: row, out };
    });
  }, [activeTab, profile?.preview_rows, piiColumns, customConfig]);

  const previewCols = useMemo(() => {
    if (activeTab !== 'preview' || previewPairs.length === 0) return [];
    const keys = [];
    previewPairs.forEach(({ src, out }) => [...Object.keys(src), ...Object.keys(out)].forEach((k) => !keys.includes(k) && keys.push(k)));
    return keys;
  }, [activeTab, previewPairs]);

  /* ---- run pipeline (unchanged) ---- */
  const handleStartProcessing = async () => {
    const jobId = `job_${Date.now()}`;
    initJob(jobId);
    let eventSource = null;
    try {
      eventSource = new EventSource(`/api/jobs/${jobId}/stream`);
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
    if (isSample) formData.append('sample', 'true');
    else if (file) formData.append('file', file);
    if (selectedSheet) formData.append('sheet', selectedSheet);
    const isSuppressOrAggregate = customConfig.riskReductionMode === 'suppress' || customConfig.riskReductionMode === 'aggregate';
    formData.append('jobId', jobId);
    formData.append('riskReductionMode', customConfig.riskReductionMode || 'none');
    if (isSuppressOrAggregate) formData.append('kThreshold', String(customConfig.kThreshold ?? 3));
    formData.append('config', JSON.stringify(buildJobPayloadConfig(customConfig, selectedSheet)));

    try {
      const res = await axios.post('/api/jobs/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (eventSource) eventSource.close();
      if (res.data?.success && res.data?.job) {
        completeJob(res.data.job, res.data.before_after_sample);
        addToast('Pipeline processing completed successfully!', 'success');
      } else {
        throw new Error(res.data?.error || 'Processing pipeline error');
      }
    } catch (err) {
      if (eventSource) eventSource.close();
      addToast(`Processing failed: ${err.response?.data?.error || err.message || 'Pipeline failed'}`, 'error');
      setStep(3);
    }
  };

  /* ---- estimates ---- */
  const currentRiskMode = customConfig.riskReductionMode || 'none';
  const currentK = customConfig.kThreshold ?? 3;
  const totalRows = profile?.row_count || profile?.total_rows || 0;

  const uniqueRowsPct = useMemo(() => {
    if (profile?.k_anonymity?.percent_low_k !== undefined) return Math.round(profile.k_anonymity.percent_low_k * 10) / 10;
    if (profile?.unique_percent !== undefined) return Math.round(profile.unique_percent * 10) / 10;
    if (totalRows > 0 && profile?.duplicate_count !== undefined) {
      return Math.max(1, Math.min(100, Math.round(((totalRows - profile.duplicate_count) / totalRows) * 100 * 0.42)));
    }
    return 42;
  }, [profile, totalRows]);

  const estimatedRowsRemoved = useMemo(() => {
    if (currentRiskMode !== 'suppress') return 0;
    const base = totalRows > 0 ? totalRows : 100;
    return Math.round(base * Math.min(0.95, (uniqueRowsPct / 100) * (0.75 + (currentK - 2) * 0.05)));
  }, [currentRiskMode, currentK, totalRows, uniqueRowsPct]);

  const estimatedSummaryRows = useMemo(() => {
    if (currentRiskMode !== 'aggregate') return 0;
    const base = totalRows > 0 ? totalRows : 100;
    return Math.max(1, Math.round(base / Math.max(2, currentK * 1.5)));
  }, [currentRiskMode, currentK, totalRows]);

  const setMode = (mode) => updateConfig({ riskReductionMode: mode, suppressLowK: mode === 'suppress' });
  const onShareKey = (e, idx) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setMode(SHARE[idx].mode); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const n = SHARE[Math.min(SHARE.length - 1, idx + 1)];
      setMode(n.mode); document.getElementById(n.id)?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = SHARE[Math.max(0, idx - 1)];
      setMode(n.mode); document.getElementById(n.id)?.focus();
    }
  };

  const disabledRun = piiColumns.length === 0 && !profile;
  const TABS = [
    { v: 'privacy', icon: Shield, label: `Privacy & field policies`, n: counts.total },
    { v: 'cleaning', icon: SlidersHorizontal, label: 'Cleaning & quality' },
    { v: 'preview', icon: Table, label: 'Live preview' },
  ];

  /* =================================================================
   *  RENDER
   * ================================================================= */
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-24">
      <style>{`
        @keyframes exec-sheen { 0% { transform: translateX(0) skewX(-12deg) } 55%,100% { transform: translateX(520%) skewX(-12deg) } }
        .exec-sheen { animation: exec-sheen 3.8s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .exec-sheen { animation: none; opacity: 0 } }
      `}</style>

      {/* ---------- 1. HEADER ---------- */}
      <motion.div {...rise(0)}>
        <Card accent={themeAccent} className="p-5">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <MiniAura accent={themeAccent} secondary={themeSecondary} />
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] text-theme-muted">
                  <span>/STEP 3 OF 5</span>
                  <span className="flex gap-1" aria-hidden>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.span key={i} className="h-1 w-5 rounded-full" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.15 + i * 0.07 }}
                        style={{ background: i <= 3 ? themeAccent : 'rgba(128,128,128,0.25)', originX: 0 }} />
                    ))}
                  </span>
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-theme-text sm:text-2xl">Privacy enforcement &amp; processing</h2>
                <p className="max-w-xl text-xs text-theme-dim">Fine-tune pseudonymization, spatial and temporal generalization, and cohort suppression before transformation.</p>
              </div>
            </div>
            <ExecuteButton onClick={handleStartProcessing} disabled={disabledRun} className="shrink-0" accent={themeAccent} secondary={themeSecondary} />
          </div>
        </Card>
      </motion.div>

      {/* ---------- 2. PRESETS + LIVE SCORE ---------- */}
      <motion.div {...rise(1)} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Label icon={SlidersHorizontal} accent={themeAccent} right={
            <button type="button" onClick={() => { applyPreset('balanced'); addToast('Reset to recommended balanced configuration.', 'info'); }}
              className="cursor-pointer font-mono text-[11px] text-theme-muted underline underline-offset-2 transition-colors hover:text-theme-text">
              Reset to recommended
            </button>}>
            Compliance presets
          </Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Object.entries(PRESET_DEFINITIONS).map(([key, preset]) => {
              const on = activePreset === key;
              const pS = presetScores[key]?.privacyScore ?? 90;
              const uS = presetScores[key]?.utilityScore ?? 85;
              return (
                <motion.div
                  key={key} role="button" tabIndex={0} onClick={() => applyPreset(key)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), applyPreset(key))}
                  whileHover={{ y: -3 }} whileTap={{ scale: 0.985 }}
                  className="relative flex cursor-pointer select-none flex-col justify-between overflow-hidden rounded-2xl border border-theme-border bg-theme-card p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  {on && (
                    <motion.span layoutId="preset-hl" className="absolute inset-0 rounded-2xl border-2"
                      style={{ borderColor: themeAccent, background: `linear-gradient(160deg, ${rgba(themeAccent, 0.22)}, transparent 70%)`, boxShadow: `0 0 28px ${rgba(themeAccent, 0.28)}` }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
                  )}
                  <div className="relative space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-theme-text">{preset.name}</span>
                      <span className="flex h-4 w-4 items-center justify-center rounded-full border" style={{ borderColor: on ? themeAccent : undefined, background: on ? themeAccent : undefined }}>
                        {on && <Check className="h-2.5 w-2.5 stroke-[3] text-white" />}
                      </span>
                    </div>
                    <span className="inline-block rounded bg-theme-secondary px-1.5 py-0.5 font-mono text-[9px] text-theme-muted">{preset.badge}</span>
                    <p className="pt-1 text-[11px] leading-snug text-theme-dim">{preset.desc}</p>
                  </div>
                  <div className="relative mt-3 space-y-1.5 border-t border-theme-border/50 pt-3">
                    {[['Privacy', pS, themeAccent], ['Utility', uS, themeSecondary]].map(([l, v, c]) => (
                      <div key={l} className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="w-12 text-theme-dim">{l}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-theme-secondary">
                          <motion.span className="block h-full rounded-full" style={{ background: c }} initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                        </span>
                        <span className="w-6 text-right font-semibold text-theme-text">{v}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <Card accent={themeSecondary} className="p-5">
          <Label icon={Shield} accent={themeSecondary} right={<span className="flex items-center gap-1.5 font-mono text-[10px] text-theme-dim"><span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: themeAccent }} />LIVE</span>}>
            Trade-off score
          </Label>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative">
              <ScoreRings privacy={privacyScore} utility={utilityScore} accent={themeAccent} secondary={themeSecondary} />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              {[
                { l: 'Privacy', I: ShieldCheck, v: privacyScore, b: beforePrivacy, c: themeAccent },
                { l: 'Utility', I: Zap, v: utilityScore, b: beforeUtility, c: themeSecondary },
              ].map((r) => (
                <div key={r.l}>
                  <div className="flex items-center gap-1.5 text-[11px] text-theme-muted"><r.I className="h-3 w-3" style={{ color: r.c }} />{r.l}</div>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-2xl font-light tabular-nums text-theme-text"><Num value={r.v} /></span>
                    <span className="font-mono text-[10px] text-theme-dim">/100</span>
                    {currentRiskMode !== 'none' && r.b !== r.v && (
                      <>
                        <span className="font-mono text-[10px] text-theme-dim">(before <span className="line-through">{r.b}</span>)</span>
                        <Delta value={r.v - r.b} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-theme-border bg-theme-secondary/40 p-2.5 text-xs">
            <span className="font-mono text-theme-muted">Re-ID risk</span>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase">
              <span className="rounded border px-2 py-0.5" style={{ color: beforeRisk === 'Low' ? themeAccent : T.rose, borderColor: rgba(beforeRisk === 'Low' ? themeAccent : T.rose, 0.4), background: rgba(beforeRisk === 'Low' ? themeAccent : T.rose, 0.1) }}>{beforeRisk}</span>
              <ArrowRight className="h-3 w-3 text-theme-dim" />
              <motion.span key={afterRisk} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded border px-2 py-0.5 font-bold" style={{ color: afterRisk === 'Low' ? themeAccent : T.amber, borderColor: rgba(afterRisk === 'Low' ? themeAccent : T.amber, 0.5), background: rgba(afterRisk === 'Low' ? themeAccent : T.amber, 0.14) }}>{afterRisk}</motion.span>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ---------- 3. SHARING / RISK REDUCTION ---------- */}
      <motion.div {...rise(2)}>
        <Card accent={themeAccent} className="space-y-5 p-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" style={{ color: themeAccent }} />
              <h3 id="sharing-selector-title" className="text-sm font-semibold text-theme-text">How will this data be shared?</h3>
              <InfoTooltip term="sharing-example" text="Example: only one taxi on Business Bay at 3:15 AM -> that row is unique, so it is blurred or removed." />
            </div>
            <p className="text-xs leading-relaxed text-theme-muted">Even without names, a trip can be recognized if it is the only one at that place and time. This setting prevents that.</p>
          </div>

          <div role="radiogroup" aria-labelledby="sharing-selector-title" className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {SHARE.map((o, idx) => {
              const on = currentRiskMode === o.mode;
              return (
                <motion.div
                  key={o.mode} id={o.id} role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
                  onClick={() => setMode(o.mode)} onKeyDown={(e) => onShareKey(e, idx)}
                  whileHover={{ y: -2 }} whileTap={{ scale: 0.985 }}
                  className="relative cursor-pointer overflow-hidden rounded-xl border border-theme-border bg-theme-secondary/40 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  {on && (
                    <motion.span layoutId="share-hl" className="absolute inset-0 rounded-xl border-2"
                      style={{ borderColor: themeAccent, background: `linear-gradient(160deg, ${rgba(themeAccent, 0.25)}, transparent 75%)` }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
                  )}
                  <div className="relative flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: on ? themeAccent : rgba(themeAccent, 0.12), color: on ? '#fff' : themeAccent, transition: 'all .25s' }}>
                      <o.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-theme-text">{o.title}</span>
                        {o.badge && <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: rgba(themeAccent, 0.18), color: themeAccent }}>{o.badge}</span>}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-theme-dim">{o.desc}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {currentRiskMode === 'none' && (
            <div
              data-testid="internal-use-note" role="alert"
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2.5 rounded-xl border p-3.5 text-xs" style={{ background: rgba(T.amber, 0.1), borderColor: rgba(T.amber, 0.35), color: T.amber }}>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Row-level data can still identify some trips. Do not share this file.</span>
              </div>
            </div>
          )}

          <div data-testid="live-preview-estimate" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <p className="sr-only">
              At this setting about {uniqueRowsPct}% of rows are unique now; {estimatedRowsRemoved} rows would be removed; {estimatedSummaryRows} summary rows would be produced.
            </p>
            {[
              { l: 'Rows unique now', v: uniqueRowsPct, s: '%', c: T.teal },
              { l: 'Rows removed', v: estimatedRowsRemoved, s: '', c: T.rose },
              { l: 'Summary rows', v: estimatedSummaryRows, s: '', c: T.sage },
            ].map((e) => (
              <div key={e.l} className="relative overflow-hidden rounded-xl border border-theme-border bg-theme-secondary/40 px-4 py-3">
                <span className="absolute inset-y-0 left-0 w-1" style={{ background: e.c }} />
                <div className="font-mono text-[10px] tracking-[0.14em] text-theme-dim">Estimate</div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-2xl font-light tabular-nums text-theme-text"><Num value={e.v} suffix={e.s} /></span>
                  <span className="text-xs text-theme-muted">{e.l}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Advanced */}
          <div className="border-t border-theme-border/40 pt-2">
            <button
              type="button" id="toggle-advanced-k" aria-expanded={showAdvanced} aria-controls="advanced-k-panel"
              onClick={() => setShowAdvanced((p) => !p)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs font-semibold text-theme-muted transition-colors hover:text-theme-text focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
            >
              <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${showAdvanced ? 'rotate-90' : ''}`} />
              <span>Advanced</span>
              <span className="font-mono text-[11px] text-theme-dim">(Minimum group size: {currentK})</span>
            </button>

            <AnimatePresence initial={false}>
              {showAdvanced && (
                <motion.div id="advanced-k-panel" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 space-y-4 rounded-xl border border-theme-border/60 bg-theme-secondary/30 p-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="max-w-lg space-y-0.5">
                        <label htmlFor="group-size-stepper-val" className="text-xs font-semibold text-theme-text">Minimum group size</label>
                        <p className="text-[11px] leading-snug text-theme-dim">Each row must look like at least this many others. Higher means more privacy and less detail.</p>
                      </div>
                      <div className="inline-flex shrink-0 items-center rounded-lg border border-theme-border bg-theme-secondary/80 p-1">
                        <button type="button" id="decrement-k-btn" aria-label="Decrease minimum group size" disabled={currentK <= 2}
                          onClick={() => updateConfig({ kThreshold: Math.max(2, currentK - 1) })}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-theme-text transition-all hover:bg-theme-card active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span id="group-size-stepper-val" data-testid="group-size-value" className="w-10 select-none text-center font-mono text-xs font-bold" style={{ color: themeAccent }}>{currentK}</span>
                        <button type="button" id="increment-k-btn" aria-label="Increase minimum group size" disabled={currentK >= 10}
                          onClick={() => updateConfig({ kThreshold: Math.min(10, currentK + 1) })}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-theme-text transition-all hover:bg-theme-card active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* clickable scale 2..10 */}
                    <div className="flex items-center gap-1">
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => (
                        <button key={k} type="button" onClick={() => updateConfig({ kThreshold: k })} aria-label={`Set minimum group size to ${k}`}
                          className="group relative h-6 flex-1 cursor-pointer rounded-md">
                          <motion.span className="absolute inset-x-0 bottom-0 rounded-md" initial={false}
                            animate={{ height: `${30 + (k - 2) * 8}%`, backgroundColor: k <= currentK ? themeAccent : 'rgba(128,128,128,0.2)' }} transition={{ duration: 0.25 }} />
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-theme-dim">
                      <span className="font-semibold" style={{ color: themeAccent }}>
                        {currentK === 2 && '2: Light protection (fewer rows removed)'}
                        {currentK === 3 && '3: Recommended default (balanced detail and privacy)'}
                        {currentK === 5 && '5: High protection (stronger grouping)'}
                        {currentK === 10 && '10: Maximum privacy (strict grouping)'}
                        {![2, 3, 5, 10].includes(currentK) && `${currentK}: Custom group size (between 2 and 10)`}
                      </span>
                      <span>
                        <span className={currentK === 2 ? 'font-bold text-theme-text' : ''}>2 Light</span> · <span className={currentK === 3 ? 'font-bold text-theme-text' : ''}>3 Recommended</span> · <span className={currentK === 5 ? 'font-bold text-theme-text' : ''}>5 High</span> · <span className={currentK === 10 ? 'font-bold text-theme-text' : ''}>10 Maximum</span>
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </motion.div>

      {/* ---------- 4. TABS ---------- */}
      <motion.div {...rise(3)} className="space-y-4">
        <div role="tablist" className="flex flex-wrap items-center gap-1 border-b border-theme-border pb-2">
          {TABS.map((t) => {
            const on = activeTab === t.v;
            return (
              <button key={t.v} type="button" role="tab" aria-selected={on} onClick={() => setActiveTab(t.v)}
                className={`relative flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${on ? 'text-theme-text' : 'text-theme-muted hover:text-theme-text'}`}>
                {on && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-xl border" style={{ background: rgba(themeAccent, 0.14), borderColor: rgba(themeAccent, 0.45) }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <t.icon className="relative h-4 w-4" style={{ color: on ? themeAccent : undefined }} />
                <span className="relative">{t.label}{t.n !== undefined && <span className="ml-1.5 font-mono text-[10px] text-theme-dim">{t.n}</span>}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>

            {/* ===== TAB 1: PRIVACY ===== */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                {/* location + time */}
                <Card accent={themeSecondary} className="grid grid-cols-1 gap-6 p-5 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="gps-precision-slider" className="flex items-center gap-1.5 text-xs font-semibold text-theme-text">
                        <MapPin className="h-3.5 w-3.5" style={{ color: themeAccent }} />
                        <span>Location precision (GPS area)</span>
                        <InfoTooltip text="Rounds latitude and longitude coordinates to a broader zone (like a 1 km district) so personal home or work stops stay hidden." />
                      </label>
                    </div>
                    <div className="flex items-center gap-4">
                      <svg viewBox="0 0 60 60" className="h-16 w-16 shrink-0" aria-hidden>
                        <circle cx="30" cy="30" r="28" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeDasharray="2 3" className="text-theme-text" />
                        <motion.circle cx="30" cy="30" fill={rgba(themeAccent, 0.22)} stroke={themeAccent} strokeWidth="1.2" initial={false}
                          animate={{ r: GPS_RADIUS[customConfig.gpsPrecision ?? 2] }} transition={{ type: 'spring', stiffness: 220, damping: 18 }} />
                        <circle cx="30" cy="30" r="1.8" fill={T.onyx} />
                      </svg>
                      <div className="flex-1 space-y-2">
                        <div className="font-mono text-xs font-bold" style={{ color: themeAccent }}>{GPS_LABELS[customConfig.gpsPrecision ?? 2]}</div>
                        <input id="gps-precision-slider" type="range" min="0" max="4" step="1" value={customConfig.gpsPrecision}
                          onChange={(e) => updateConfig({ gpsPrecision: parseInt(e.target.value, 10) })}
                          style={{ accentColor: themeAccent }}
                          className="w-full cursor-pointer" aria-label="Location precision slider" />
                        <div className="flex justify-between font-mono text-[10px] text-theme-dim">
                          <span>City</span><span>Town</span><span className="font-bold" style={{ color: themeAccent }}>District ★</span><span>Street</span><span>Exact</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] leading-snug text-theme-dim">Blurs exact GPS coordinates into wider zones so individual vehicle stops and home locations remain private.</p>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-theme-text">
                      <Clock className="h-3.5 w-3.5" style={{ color: themeAccent }} />
                      <span>Time rounding (trip interval)</span>
                      <InfoTooltip text="Rounds departure and arrival times into 15-minute blocks so individual trips cannot be tracked across cameras or sensors." />
                    </label>
                    <Segmented id="time-seg" value={customConfig.timeBucketMinutes} onChange={(m) => updateConfig({ timeBucketMinutes: m })}
                      options={[5, 15, 30, 60].map((m) => ({ value: m, label: `${m}m${m === 15 ? ' ★' : ''}` }))} />
                    <p className="text-[11px] leading-snug text-theme-dim">
                      Rounds trip times to the nearest {customConfig.timeBucketMinutes}-minute block so individual drivers cannot be tracked across traffic sensors or cameras.
                    </p>
                  </div>
                </Card>

                {/* toolbar */}
                <Card className="space-y-3 p-4">
                  <div className="flex flex-col items-stretch justify-between gap-3 lg:flex-row lg:items-center">
                    <div className="relative max-w-md flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-dim" />
                      <input ref={searchRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && (setSearchQuery(''), e.currentTarget.blur())}
                        placeholder="Search column, classification or category…"
                        className="w-full rounded-xl border border-theme-border bg-theme-secondary py-2 pl-9 pr-16 font-mono text-xs text-theme-text transition-colors placeholder:text-theme-dim focus:border-cyan-400 focus:outline-none" />
                      <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                        {searchQuery ? (
                          <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" className="text-theme-dim hover:text-theme-text"><X className="h-3.5 w-3.5" /></button>
                        ) : (
                          <kbd className="rounded border border-theme-border bg-theme-card px-1.5 py-0.5 font-mono text-[10px] text-theme-dim">/</kbd>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <ArrowDownUp className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-theme-dim" />
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort columns"
                          className="cursor-pointer appearance-none rounded-xl border border-theme-border bg-theme-secondary py-1.5 pl-7 pr-3 font-mono text-[11px] text-theme-text focus:outline-none">
                          <option value="risk">Sort: risk</option><option value="name">Sort: name</option><option value="confidence">Sort: confidence</option>
                        </select>
                      </div>
                      <div className="flex items-center rounded-xl border border-theme-border bg-theme-secondary p-0.5">
                        {[['cards', LayoutGrid, 'Cards'], ['table', List, 'Table']].map(([v, I, l]) => (
                          <button key={v} type="button" onClick={() => setViewMode(v)} title={`${l} view`}
                            className={`relative flex items-center gap-1 rounded-lg p-1.5 text-xs ${viewMode === v ? 'text-theme-text' : 'text-theme-dim hover:text-theme-text'}`}>
                            {viewMode === v && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-lg bg-theme-card shadow-sm" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                            <I className="relative h-3.5 w-3.5" /><span className="relative hidden text-[11px] font-semibold md:inline">{l}</span>
                          </button>
                        ))}
                      </div>
                      <button type="button" onClick={() => handleBatchAction('pseudonymize_all_ids')} title="Pseudonymize all IDs and plates using HMAC-SHA256"
                        className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-theme-border bg-theme-secondary px-2.5 py-1.5 text-[11px] font-medium text-theme-text transition-colors hover:bg-theme-secondary/70">
                        <KeyRound className="h-3 w-3" style={{ color: T.teal }} /><span className="hidden sm:inline">Pseudonymize IDs</span>
                      </button>
                      <button type="button" onClick={() => handleBatchAction('drop_direct_pii')} title="Remove all direct personal identifiers"
                        className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-theme-border bg-theme-secondary px-2.5 py-1.5 text-[11px] font-medium text-theme-text transition-colors hover:bg-theme-secondary/70">
                        <Trash2 className="h-3 w-3" style={{ color: T.rose }} /><span className="hidden sm:inline">Remove direct PII</span>
                      </button>
                      <motion.button type="button" whileTap={{ rotate: -180 }} onClick={() => handleBatchAction('reset_recommendations')} title="Reset all fields to recommended actions" aria-label="Reset all fields to recommended actions"
                        className="cursor-pointer rounded-xl border border-theme-border bg-theme-secondary p-1.5 text-theme-dim transition-colors hover:text-theme-text">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </motion.button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-theme-border/50 pt-3">
                    {FILTERS.map((f) => {
                      const on = categoryFilter === f.v;
                      return (
                        <button key={f.v} type="button" onClick={() => setCategoryFilter(f.v)}
                          className={`relative cursor-pointer rounded-full border px-3 py-1 text-[11px] transition-colors ${on ? 'border-transparent font-semibold text-theme-text' : 'border-theme-border bg-theme-secondary text-theme-dim hover:text-theme-text'}`}>
                          {on && <motion.span layoutId="filter-pill" className="absolute inset-0 rounded-full border" style={{ background: rgba(f.c, 0.16), borderColor: rgba(f.c, 0.5) }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                          <span className="relative">{f.label} <span className="font-mono text-[10px]" style={{ color: on ? f.c : undefined }}>{f.n}</span></span>
                        </button>
                      );
                    })}
                    <span aria-live="polite" className="ml-auto font-mono text-[10px] text-theme-dim">
                      Showing {filteredPiiColumns.length} of {counts.total}
                    </span>
                  </div>
                </Card>

                {/* columns */}
                {filteredPiiColumns.length === 0 ? (
                  <Card className="space-y-2 p-10 text-center">
                    <Info className="mx-auto h-6 w-6 text-theme-dim" />
                    <p className="text-xs font-medium text-theme-muted">No columns match your filter criteria.</p>
                    <button type="button" onClick={() => { setSearchQuery(''); setCategoryFilter('all'); }} className="cursor-pointer font-mono text-xs underline" style={{ color: themeAccent }}>
                      Clear search and filters
                    </button>
                  </Card>
                ) : viewMode === 'cards' ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <AnimatePresence mode="popLayout">
                      {filteredPiiColumns.map((pii, idx) => {
                        const colName = nameOf(pii);
                        const action = actionOf(pii);
                        const meta = ACTION_META[action] || ACTION_META.DROP_COLUMN;
                        const conf = confOf(pii);
                        const risk = riskOf(pii);
                        const rc = RISK[risk]?.c || T.amber;
                        const masked = getMaskedSampleDisplay(pii, action, customConfig);
                        const raw = pii.first_non_null_value;
                        const isCardDropdownOpen = openActionCol === colName;
                        return (
                          <motion.div
                            key={colName} layout data-pii-card={colName}
                            initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3, delay: reduce ? 0 : Math.min(idx, 8) * 0.04 }}
                            whileHover={isCardDropdownOpen ? undefined : { y: -2 }}
                            className={`relative flex flex-col justify-between gap-4 overflow-visible rounded-2xl border border-theme-border bg-theme-card p-5 pl-6 shadow-sm transition-all ${isCardDropdownOpen ? 'ring-2 ring-cyan-500/40 shadow-xl' : 'hover:shadow-md'
                              }`}
                            style={{
                              zIndex: isCardDropdownOpen ? 70 : Math.max(1, filteredPiiColumns.length - idx),
                            }}
                          >
                            <span className="absolute inset-y-0 left-0 w-1.5 rounded-l-2xl" style={{ background: `linear-gradient(180deg, ${rc}, ${rgba(rc, 0.3)})` }} />
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-mono text-sm font-bold text-theme-text"><Highlight text={colName} q={q} /></span>
                                <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: rc, borderColor: rgba(rc, 0.4), background: rgba(rc, 0.12) }}>{risk} risk</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-theme-muted">
                                <span className="font-medium text-theme-text"><Highlight text={pii.classification || 'Direct Identifier'} q={q} /></span>
                                <span className="flex items-center gap-1.5 font-mono text-[11px]" style={{ color: themeAccent }}>
                                  <span className="h-1.5 w-12 overflow-hidden rounded-full bg-theme-secondary">
                                    <motion.span className="block h-full rounded-full" style={{ background: themeAccent }} initial={{ width: 0 }} animate={{ width: `${conf}%` }} transition={{ duration: 0.7 }} />
                                  </span>
                                  {conf}%
                                </span>
                              </div>
                              {pii.reason && <p className="line-clamp-2 text-[11px] leading-relaxed text-theme-dim">{pii.reason}</p>}

                              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                                {raw && action !== 'KEEP' && (
                                  <>
                                    <span className="max-w-[9rem] truncate rounded-md border border-theme-border bg-theme-secondary/60 px-2 py-0.5 text-theme-dim line-through" title={String(raw)}>{String(raw)}</span>
                                    <ArrowRight className="h-3 w-3 text-theme-dim" />
                                  </>
                                )}
                                <motion.span key={masked} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} data-testid={`masked-sample-${colName}`}
                                  className="max-w-[14rem] truncate rounded-md border px-2.5 py-0.5 font-medium shadow-sm" style={{ color: meta.c, borderColor: rgba(meta.c, 0.4), background: rgba(meta.c, 0.12) }}>
                                  {masked}
                                </motion.span>
                              </div>
                            </div>

                            <div className="space-y-2.5 border-t border-theme-border/50 pt-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-theme-dim">Privacy action</span>
                                {action === 'KEEP'
                                  ? <span className="flex items-center gap-1 font-mono text-[10px]" style={{ color: T.rose }}><AlertTriangle className="h-3 w-3" /> Unprotected</span>
                                  : <span className="flex items-center gap-2 font-mono text-[10px] text-theme-dim">{meta.short}<ProtectionMeter level={meta.protect} color={meta.c} /></span>}
                              </div>

                              {/* Quick One-Click Switcher Pills */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                {(allowedActionsMap[colName] || getAllowedActionsForColumn(pii)).map((opt) => {
                                  const optMeta = ACTION_META[opt.value] || ACTION_META.DROP_COLUMN;
                                  const OptIcon = optMeta.icon;
                                  const isCurrent = action === opt.value;
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        pickAction(colName, opt.value);
                                        setOpenActionCol(null);
                                      }}
                                      title={opt.label}
                                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono cursor-pointer transition-all ${isCurrent
                                          ? 'font-bold shadow-sm'
                                          : 'bg-theme-secondary/50 text-theme-dim hover:text-theme-text hover:bg-theme-secondary border border-theme-border/40'
                                        }`}
                                      style={
                                        isCurrent
                                          ? {
                                            background: rgba(optMeta.c, 0.18),
                                            borderColor: rgba(optMeta.c, 0.6),
                                            borderWidth: '1px',
                                            borderStyle: 'solid',
                                            color: optMeta.c,
                                          }
                                          : undefined
                                      }
                                    >
                                      <OptIcon className="h-3 w-3 shrink-0" style={{ color: isCurrent ? optMeta.c : undefined }} />
                                      <span className="truncate max-w-[100px]">{optMeta.short || opt.label.split(' ')[0]}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Custom Animated Dropdown Menu with Accessible Fallback */}
                              <ActionSelect
                                pii={pii}
                                colName={colName}
                                value={action}
                                onPick={(v) => pickAction(colName, v)}
                                options={allowedActionsMap[colName]}
                                isOpen={isCardDropdownOpen}
                                onToggle={(nextOpen) => handleToggleActionCol(colName, nextOpen)}
                                onClose={handleCloseActionCol}
                              />
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Card className="overflow-x-auto p-4">
                    <table className="w-full text-left font-mono text-xs">
                      <thead>
                        <tr className="border-b border-theme-border text-[10px] uppercase tracking-wider text-theme-dim">
                          <th className="px-3 pb-3">Column</th><th className="px-3 pb-3">Role</th><th className="px-3 pb-3">Confidence</th>
                          <th className="px-3 pb-3">Risk</th><th className="px-3 pb-3">Masked output</th><th className="px-3 pb-3 text-right">Privacy action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-border/40">
                        {filteredPiiColumns.map((pii, idx) => {
                          const colName = nameOf(pii);
                          const action = actionOf(pii);
                          const meta = ACTION_META[action] || ACTION_META.DROP_COLUMN;
                          const risk = riskOf(pii);
                          const rc = RISK[risk]?.c || T.amber;
                          const isTableDropdownOpen = openActionCol === colName;
                          return (
                            <motion.tr
                              key={colName} data-pii-card={colName}
                              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: Math.min(idx, 10) * 0.03 }}
                              className={`transition-colors hover:bg-theme-secondary/40 ${isTableDropdownOpen ? 'relative z-50' : 'relative z-1'}`}
                            >
                              <td className="px-3 py-3 font-bold text-theme-text"><Highlight text={colName} q={q} /></td>
                              <td className="px-3 py-3 font-sans text-xs text-theme-muted"><Highlight text={pii.classification || 'Direct Identifier'} q={q} /></td>
                              <td className="px-3 py-3" style={{ color: themeAccent }}>{confOf(pii)}%</td>
                              <td className="px-3 py-3"><span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ color: rc, background: rgba(rc, 0.14) }}>{risk}</span></td>
                              <td className="px-3 py-3">
                                <span data-testid={`masked-sample-${colName}`} className="inline-block max-w-xs truncate rounded border px-2 py-1 text-[11px]" style={{ color: meta.c, borderColor: rgba(meta.c, 0.35), background: rgba(meta.c, 0.1) }}>
                                  {getMaskedSampleDisplay(pii, action, customConfig)}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <div className="ml-auto w-52">
                                  <ActionSelect
                                    pii={pii}
                                    colName={colName}
                                    value={action}
                                    onPick={(v) => pickAction(colName, v)}
                                    options={allowedActionsMap[colName]}
                                    compact
                                    isOpen={isTableDropdownOpen}
                                    onToggle={(nextOpen) => handleToggleActionCol(colName, nextOpen)}
                                    onClose={handleCloseActionCol}
                                  />
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                )}
              </div>
            )}

            {/* ===== TAB 2: CLEANING ===== */}
            {activeTab === 'cleaning' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card className="space-y-3 p-5">
                    <Label icon={CheckCircle2}>Standardization &amp; hygiene</Label>
                    <div className="space-y-2">
                      <Switch label="Standardize column names to snake_case" checked={customConfig.standardizeColumnNames} onChange={(v) => updateConfig({ standardizeColumnNames: v })} />
                      <Switch label="Standardize timestamps to ISO-8601 UTC" checked={customConfig.standardizeDates} onChange={(v) => updateConfig({ standardizeDates: v })} />
                      <Switch label="Trim whitespace from text strings" checked={customConfig.trimWhitespace} onChange={(v) => updateConfig({ trimWhitespace: v })} />
                      <Switch label="Audit & reject duplicate rows" checked={customConfig.removeDuplicates} onChange={(v) => updateConfig({ removeDuplicates: v })} />
                    </div>
                  </Card>

                  <Card accent={T.amber} className="space-y-3 p-5">
                    <Label icon={AlertTriangle} accent={T.amber}>Speed outlier strategy</Label>
                    <div className="space-y-2">
                      {OUTLIERS.map((o) => {
                        const on = customConfig.outlierStrategy === o.v;
                        return (
                          <label key={o.v} className="relative flex cursor-pointer items-start gap-3 overflow-hidden rounded-xl border border-theme-border bg-theme-secondary/40 p-3 transition-colors hover:bg-theme-secondary/70">
                            {on && <motion.span layoutId="outlier-hl" className="absolute inset-0 rounded-xl border" style={{ borderColor: rgba(T.sage, 0.6), background: rgba(T.mint, 0.18) }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                            <input type="radio" name="outlier" value={o.v} checked={on} onChange={() => updateConfig({ outlierStrategy: o.v })} className="relative mt-0.5 accent-[#5E8F72]" />
                            <div className="relative">
                              <span className="flex items-center gap-2 text-xs font-semibold text-theme-text">{o.t}{o.badge && <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: rgba(T.sage, 0.18), color: T.sage }}>{o.badge}</span>}</span>
                              <p className="mt-0.5 text-[11px] text-theme-dim">{o.d}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </Card>
                </div>

                {numericColumns.length > 0 && (
                  <Card className="space-y-4 p-5">
                    <Label icon={SlidersHorizontal}>Numeric range bounds</Label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {numericColumns.map((nc) => (
                        <div key={nc.column} className="space-y-2 rounded-xl border border-theme-border bg-theme-secondary/50 p-3">
                          <span className="block font-mono text-xs font-bold text-theme-text">{nc.column}</span>
                          <div className="h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${T.sage2}, ${T.mint})` }} />
                          <div className="flex items-end gap-2 text-xs">
                            {[['Min', nc.min], ['Max', nc.max]].map(([l, v], i) => (
                              <React.Fragment key={l}>
                                {i === 1 && <span className="mb-1 text-theme-dim">to</span>}
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-theme-dim">{l}</span>
                                  <input type="number" defaultValue={v} className="w-20 rounded border border-theme-border bg-theme-card px-2 py-1 font-mono text-xs text-theme-text focus:border-[#5E8F72] focus:outline-none" />
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ===== TAB 3: PREVIEW ===== */}
            {activeTab === 'preview' && (
              <Card className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Label icon={Table}>Live in-memory transformation</Label>
                    <span className="mt-1 block text-[11px] text-theme-dim">First 5 records with your current settings applied.</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
                    <span className="rounded border px-2 py-0.5" style={{ color: T.sage, borderColor: rgba(T.sage, 0.4), background: rgba(T.mint, 0.3) }}>changed</span>
                    <span className="rounded border border-theme-border px-2 py-0.5 text-theme-dim line-through">removed</span>
                    <span className="rounded border px-2 py-0.5" style={{ color: T.amber, borderColor: rgba(T.amber, 0.4) }}>flagged</span>
                  </div>
                </div>

                {previewPairs.length === 0 ? (
                  <div className="py-12 text-center font-mono text-xs text-theme-dim">Upload a dataset to generate live configuration preview.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs">
                      <thead>
                        <tr className="border-b border-theme-border text-[10px] uppercase text-theme-dim">
                          {previewCols.map((h) => {
                            const gone = previewPairs.every((p) => !(h in p.out));
                            return <th key={h} className={`px-2.5 pb-3 font-semibold ${gone ? 'line-through opacity-50' : ''}`}>{h}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-border/50">
                        {previewPairs.map(({ src, out }, i) => (
                          <motion.tr key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="transition-colors hover:bg-theme-secondary/40">
                            {previewCols.map((k) => {
                              if (!(k in out)) return <td key={k} className="px-2.5 py-2.5 text-theme-dim opacity-40">—</td>;
                              const val = out[k];
                              const changed = String(val) !== String(src[k]);
                              const flagged = val === true;
                              return (
                                <td key={k} className="px-2.5 py-2.5">
                                  <span className="rounded px-1.5 py-0.5" style={{
                                    color: flagged ? T.amber : changed ? T.sage : undefined,
                                    background: changed && !flagged ? rgba(T.mint, 0.3) : undefined,
                                    fontWeight: changed || flagged ? 700 : undefined,
                                  }}>
                                    {String(val)}
                                  </span>
                                </td>
                              );
                            })}
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* ---------- 5. KEEP WARNING MODAL ---------- */}
      <AnimatePresence>
        {keepWarningCol && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setKeepWarningCol(null)}>
            <motion.div role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="w-full max-w-md space-y-4 rounded-2xl border bg-theme-card p-6 shadow-2xl" style={{ borderColor: rgba(T.rose, 0.5) }}>
              <div className="flex items-center gap-3" style={{ color: T.rose }}>
                <motion.span animate={reduce ? undefined : { rotate: [0, -8, 8, -4, 0] }} transition={{ duration: 0.6, delay: 0.2 }}><AlertTriangle className="h-6 w-6 shrink-0" /></motion.span>
                <h3 className="text-base font-bold text-theme-text">Privacy warning</h3>
              </div>
              <p className="text-xs leading-relaxed text-theme-muted">
                Retaining raw PII in <span className="font-mono font-bold" style={{ color: T.rose }}>{keepWarningCol}</span> may violate data protection laws and institutional privacy policies. Are you certain you want to bypass automated pseudonymization/redaction?
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setKeepWarningCol(null)} className="cursor-pointer rounded-xl bg-theme-secondary px-4 py-2 text-xs font-medium text-theme-text">Cancel</button>
                <button type="button" className="cursor-pointer rounded-xl px-4 py-2 text-xs font-bold text-white" style={{ background: T.rose }}
                  onClick={() => {
                    updateConfig({ piiActions: { ...customConfig.piiActions, [keepWarningCol]: 'KEEP' } });
                    setKeepWarningCol(null);
                    addToast(`Retained raw field '${keepWarningCol}' per manual override.`, 'warning');
                  }}>
                  Confirm keep
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- 6. STICKY ACTION BAR ---------- */}
      <motion.div {...rise(4)} className="sticky bottom-4 z-40 flex flex-col items-center justify-between gap-4 rounded-2xl border border-theme-border bg-theme-card/90 p-3 shadow-2xl backdrop-blur-md sm:flex-row">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setStep(2)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-theme-border bg-theme-secondary px-3 py-1.5 text-xs font-semibold text-theme-muted transition-colors hover:text-theme-text">
            <ArrowLeft className="h-3.5 w-3.5" /><span>Back to analysis</span>
          </button>
          <div className="hidden items-center gap-3 border-l border-theme-border pl-3 font-mono text-[11px] text-theme-dim md:flex">
            <span>Preset <strong className="uppercase text-theme-text">{activePreset}</strong></span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: T.sage }} />Privacy <strong className="text-theme-text"><Num value={privacyScore} /></strong></span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: T.teal }} />Utility <strong className="text-theme-text"><Num value={utilityScore} /></strong></span>
            <span>Mode <strong className="uppercase" style={{ color: T.sage }}>{currentRiskMode}</strong></span>
            {counts.unprotected > 0 && <span className="flex items-center gap-1" style={{ color: T.rose }}><AlertTriangle className="h-3 w-3" />{counts.unprotected} unprotected</span>}
          </div>
        </div>
        <ExecuteButton onClick={handleStartProcessing} disabled={disabledRun} className="w-full sm:w-auto" />
      </motion.div>
    </div>
  );
}