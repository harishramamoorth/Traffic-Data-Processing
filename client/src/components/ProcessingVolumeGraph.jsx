import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';

/**
 * ProcessingVolumeSankey – "WHERE YOUR DATA GOES"
 *
 * What's new vs. the first version
 *  - Ribbon thickness is truly proportional to each share (the old paths were hand-drawn
 *    and didn't match the percentages or line up with the labels).
 *  - Intro: ribbons sweep out of the source box while numbers count up and labels stagger in.
 *  - Switching jobs morphs the ribbons and counters smoothly instead of jumping.
 *  - Data "packets" flow along each ribbon (count scales with thickness).
 *  - Hover / focus / tap a ribbon, label or card to isolate that branch.
 *  - Percentages use largest-remainder rounding so they always add up to 100.
 *  - QC footer is computed from the data instead of being hard-coded.
 *  - Mobile (< sm): in-SVG labels are swapped for tappable cards so text stays readable.
 *  - Honors prefers-reduced-motion.
 */

/* ─────────────────────────────── Layout constants ─────────────────────────────── */

const VB_W = 1040;
const VB_H = 620;
const X0 = 195; // ribbon start (right edge of the source box)
const X1 = 680; // ribbon end (accent bars)
const XM = (X0 + X1) / 2;
const STACK_H = 170; // total ribbon thickness at the source
const MIN_T = 8; // thinnest visible ribbon
const SRC_CY = 360;
const SLOTS = [175, 360, 505]; // vertical centre of each destination

const EMPTY = [];

const BRANCHES = [
  {
    id: 'exported', title: 'SANITIZED & EXPORTED', grad: 'tpGradExp',
    lines: ['Zero direct identifiers.', 'High analytical utility.'], noun: 'compliant rows.',
    bar: 48, pctSize: 52, pctY: 40, titleSize: 16, titleY: 74, lineY: [98, 118],
  },
  {
    id: 'generalized', title: 'PSEUDONYMIZED', grad: 'tpGradMid',
    lines: ['HMAC-SHA256 keyed plates.', 'Spatial coordinates generalized.'], noun: 'rows generalized.',
    bar: 44, pctSize: 44, pctY: 38, titleSize: 15, titleY: 68, lineY: [90, 108],
  },
  {
    id: 'dropped', title: 'DROPPED & FILTERED', grad: 'tpGradDrop',
    lines: ['Direct identifiers stripped.'], noun: 'rows audited & purged.',
    bar: 38, pctSize: 38, pctY: 34, titleSize: 14, titleY: 60, lineY: [80],
  },
];

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/* ─────────────────────────────── Helpers & hooks ─────────────────────────────── */

const ease = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

/** Eased 0 → 1 progress that restarts whenever `key` changes. */
function useIntro(key, disabled, duration = 1500) {
  const [p, setP] = useState(disabled ? 1 : 0);
  useEffect(() => {
    if (disabled) { setP(1); return; }
    let raf;
    const t0 = performance.now();
    setP(0);
    const step = (now) => {
      const t = clamp01((now - t0) / duration);
      setP(ease(t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key, disabled, duration]);
  return p;
}

/**
 * Tweens an array of numbers toward `target` whenever its values change.
 * `from` (optional) is the starting array on mount and on `resetKey` change.
 */
function useTween(target, { duration = 900, from = null, resetKey = 0, disabled = false } = {}) {
  const targetKey = target.join('|');
  const [value, setValue] = useState(from ?? target);
  const valueRef = useRef(value);
  const lastReset = useRef(resetKey);

  useEffect(() => {
    let start = valueRef.current;
    if (lastReset.current !== resetKey) {
      lastReset.current = resetKey;
      if (from) start = from;
    }
    if (disabled) {
      valueRef.current = target;
      setValue(target);
      return;
    }
    let raf;
    const t0 = performance.now();
    const step = (now) => {
      const t = clamp01((now - t0) / duration);
      const e = ease(t);
      const next = target.map((v, i) => start[i] + (v - start[i]) * e);
      valueRef.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, resetKey, disabled, duration]);

  return value;
}

/** Largest-remainder rounding: integers that always sum to 100. */
function toPercents(parts, total) {
  if (!total) return [0, 0, 0];
  const raw = parts.map((p) => (p / total) * 100);
  const out = raw.map(Math.floor);
  let rem = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - out[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < rem; k++) out[order[k % 3][1]]++;
  return out;
}

function deriveStats(job) {
  const s = job?.summary;
  if (!s) return { demo: true, total: 527, exported: 422, general: 79, dropped: 26, overflow: 0 };

  const num = (v) => Math.max(0, Number(v) || 0);
  const processed = num(s.processed_rows);
  const removed = num(s.suppressed_count) + num(s.rejected_rows_count) + num(s.duplicate_rows_removed);
  const total = num(s.original_rows) || processed + removed;

  const exported = Math.min(processed, total);
  const dropped = Math.min(removed, total - exported);
  const general = total - exported - dropped;
  const overflow = Math.max(0, processed + removed - total); // counts exceed the original row count

  return { demo: false, total, exported, general, dropped, overflow };
}

function computeRibbons(shares) {
  const th = shares.map((v) => (v > 0.01 ? Math.max(MIN_T, (v / 100) * STACK_H) : 0));
  const stack = th.reduce((a, b) => a + b, 0);
  let acc = SRC_CY - stack / 2;
  return th.map((t, i) => {
    const sa = acc;
    const sb = acc + t;
    acc = sb;
    const c = SLOTS[i];
    return { t, sa, sb, ta: c - t / 2, tb: c + t / 2 };
  });
}

const ribbonPath = (r) =>
  `M ${X0} ${r.sa} C ${XM} ${r.sa}, ${XM} ${r.ta}, ${X1} ${r.ta} L ${X1} ${r.tb} C ${XM} ${r.tb}, ${XM} ${r.sb}, ${X0} ${r.sb} Z`;

const lanePath = (r, f) => {
  const ys = r.sa + (r.sb - r.sa) * f;
  const yt = r.ta + (r.tb - r.ta) * f;
  return `M ${X0} ${ys} C ${XM} ${ys}, ${XM} ${yt}, ${X1} ${yt}`;
};

/* ─────────────────────────────── Component ─────────────────────────────── */

export default function ProcessingVolumeSankey({ latestJob, recentJobs = EMPTY }) {
  const reduced = usePrefersReducedMotion();
  const [selectedJobIndex, setSelectedJobIndex] = useState(0);
  const [active, setActive] = useState(null); // 'exported' | 'generalized' | 'dropped' | null
  const [replayKey, setReplayKey] = useState(0);

  const jobList = recentJobs.slice(0, 8);
  const idx = Math.min(selectedJobIndex, Math.max(0, jobList.length - 1));
  const activeJob = jobList.length > 0 ? jobList[idx] : latestJob;

  const stats = useMemo(() => deriveStats(activeJob), [activeJob]);
  const parts = [stats.exported, stats.general, stats.dropped];
  const shares = parts.map((v) => (stats.total ? (v / stats.total) * 100 : 0));
  const pcts = toPercents(parts, stats.total);

  // geometry morphs between jobs; numbers count up on mount / replay and tween between jobs
  const geo = useTween(shares, { duration: 800, disabled: reduced });
  const nums = useTween([...pcts, ...parts, stats.total], {
    duration: 1100,
    from: [0, 0, 0, 0, 0, 0, 0],
    resetKey: replayKey,
    disabled: reduced,
  });
  const intro = useIntro(replayKey, reduced);

  const ribbons = computeRibbons(geo);
  const pctText = (i) => {
    const v = Math.round(nums[i]);
    return v === 0 && parts[i] > 0 ? '<1' : String(v);
  };
  const rowsText = (i) => Math.round(nums[3 + i]).toLocaleString();
  const totalText = Math.round(nums[6]).toLocaleString();

  const labelOpacity = (i) => clamp01((intro - 0.45 - i * 0.12) / 0.3);
  const bind = (id) => ({
    onMouseEnter: () => setActive(id),
    onMouseLeave: () => setActive((a) => (a === id ? null : a)),
    onFocus: () => setActive(id),
    onBlur: () => setActive((a) => (a === id ? null : a)),
  });
  const dim = (id) => (active && active !== id ? 0.28 : 1);

  const reconciled = stats.overflow === 0;
  const ariaSummary = `Of ${stats.total.toLocaleString()} rows, ${pcts[0]} percent were sanitized and exported, ${pcts[1]} percent pseudonymized, and ${pcts[2]} percent dropped or filtered.`;

  return (
    <div className="w-full rounded-2xl bg-[#030712] border border-neutral-800 text-white overflow-hidden shadow-2xl relative select-none">
      <style>{`
        @keyframes tp-flow { to { stroke-dashoffset: -32; } }
        @keyframes tp-march { to { stroke-dashoffset: -16; } }
        .tp-lane { stroke-dasharray: 2 14; stroke-linecap: round; animation: tp-flow 1.4s linear infinite; }
        .tp-march { animation: tp-march 2.4s linear infinite; }
        .tp-fade { transition: opacity .25s ease; }
        @media (prefers-reduced-motion: reduce) { .tp-lane, .tp-march { animation: none; } .tp-fade { transition: none; } }
      `}</style>

      {/* Toolbar */}
      <div className="px-4 sm:px-6 py-2 bg-neutral-950/90 border-b border-neutral-800/80 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {jobList.length > 1 ? (
            <>
              <label htmlFor="tp-source" className="font-mono text-[11px] text-neutral-400 shrink-0">
                Dataset
              </label>
              <select
                id="tp-source"
                value={idx}
                onChange={(e) => setSelectedJobIndex(Number(e.target.value))}
                className="min-w-0 bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus-visible:border-neutral-400 font-mono cursor-pointer truncate"
              >
                {jobList.map((j, i) => {
                  const rows = j.summary?.original_rows ?? j.summary?.processed_rows;
                  return (
                    <option key={j.jobId || i} value={i}>
                      {j.originalFilename || `Run #${i + 1}`}
                      {rows != null ? ` (${Number(rows).toLocaleString()} rows)` : ''}
                    </option>
                  );
                })}
              </select>
            </>
          ) : (
            stats.demo && (
              <span className="font-mono text-[11px] text-amber-300/90 border border-amber-400/30 rounded-full px-2 py-0.5">
                Sample data
              </span>
            )
          )}
        </div>
        <button
          type="button"
          onClick={() => setReplayKey((k) => k + 1)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 font-mono text-[11px] text-neutral-300 hover:text-white hover:border-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 transition-colors"
        >
          <RotateCcw size={12} aria-hidden="true" />
          Replay
        </button>
      </div>

      {/* Poster canvas */}
      <div className="relative w-full" style={{ aspectRatio: `${VB_W} / ${VB_H}` }}>
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full h-full block"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label={ariaSummary}
        >
          <defs>
            <pattern id="tpDots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#FFFFFF" opacity="0.06" />
            </pattern>

            {/* Metallic ribbons; the dropped branch picks up the brand red at its end */}
            <linearGradient id="tpGradExp" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#CBD5E1" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#64748B" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="tpGradMid" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="55%" stopColor="#94A3B8" stopOpacity="0.78" />
              <stop offset="100%" stopColor="#475569" stopOpacity="0.65" />
            </linearGradient>
            <linearGradient id="tpGradDrop" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#94A3B8" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0.85" />
            </linearGradient>

            <filter id="tpShadow" x="-5%" y="-10%" width="110%" height="125%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000000" floodOpacity="0.6" />
            </filter>

            {/* Reveal wipe: left → right */}
            <clipPath id="tpReveal">
              <rect x={X0 - 2} y="0" width={(X1 - X0 + 10) * intro} height={VB_H} />
            </clipPath>
          </defs>

          <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#tpDots)" />

          {/* 1. Title */}
          <g transform="translate(70, 75)">
            <text x="0" y="38" fill="#FFFFFF" fontFamily={FONT} fontSize="44" fontWeight="900" letterSpacing="0.03em">
              WHERE YOUR
            </text>
            <text x="0" y="86" fill="#FFFFFF" fontFamily={FONT} fontSize="44" fontWeight="900" letterSpacing="0.03em">
              DATA GOES
            </text>
            <rect x="0" y="106" width={85 * clamp01(intro * 2.5)} height="3" fill="#FFFFFF" />
          </g>

          {/* 2. Source box */}
          <g transform="translate(70, 265)">
            <rect x="0" y="0" width="125" height="190" fill="#030712" stroke="#FFFFFF" strokeWidth="2" />
            <text x="16" y="62" fill="#FFFFFF" fontFamily={FONT} fontSize="40" fontWeight="900" letterSpacing="-0.03em">
              100%
            </text>
            <text x="16" y="96" fill="#FFFFFF" fontFamily={FONT} fontSize="13" fontWeight="800" letterSpacing="0.08em">
              TOTAL
            </text>
            <text x="16" y="114" fill="#FFFFFF" fontFamily={FONT} fontSize="13" fontWeight="800" letterSpacing="0.08em">
              VOLUME
            </text>
            <text x="16" y="140" fill="#94A3B8" fontFamily="ui-monospace, monospace" fontSize="12" fontWeight="600">
              {totalText} rows
            </text>
          </g>

          {/* 3. Flow ribbons */}
          <g clipPath="url(#tpReveal)">
            <g filter="url(#tpShadow)">
              {BRANCHES.map((b, i) => {
                const r = ribbons[i];
                if (!r.t) return null;
                const isActive = active === b.id;
                return (
                  <path
                    key={b.id}
                    d={ribbonPath(r)}
                    fill={`url(#${b.grad})`}
                    stroke={isActive ? '#FFFFFF' : 'none'}
                    strokeOpacity="0.85"
                    strokeWidth="1.2"
                    className="tp-fade cursor-pointer outline-none"
                    style={{ opacity: dim(b.id) }}
                    tabIndex={0}
                    role="img"
                    aria-label={`${b.title}: ${pcts[i]} percent, ${parts[i].toLocaleString()} rows`}
                    {...bind(b.id)}
                    onClick={() => setActive((a) => (a === b.id ? null : b.id))}
                  />
                );
              })}
            </g>

            {/* Flowing data packets (kept out of the filtered group so the shadow isn't re-rendered every frame) */}
            <g pointerEvents="none">
              {BRANCHES.map((b, i) => {
                const r = ribbons[i];
                if (!r.t) return null;
                const lanes = Math.min(6, Math.max(1, Math.round(r.t / 16)));
                return Array.from({ length: lanes }, (_, k) => (
                  <path
                    key={`${b.id}-${k}`}
                    d={lanePath(r, (k + 0.5) / lanes)}
                    stroke={b.id === 'dropped' ? '#FECACA' : '#FFFFFF'}
                    strokeWidth="1.8"
                    className="tp-lane tp-fade"
                    style={{
                      opacity: dim(b.id) * (active === b.id ? 0.95 : 0.55),
                      animationDuration: `${[1.2, 1.5, 2.1][i]}s`,
                      animationDelay: `${-k * 0.37}s`,
                    }}
                  />
                ));
              })}
            </g>
          </g>

          {/* Row chip on the highlighted ribbon */}
          {BRANCHES.map((b, i) => {
            const r = ribbons[i];
            if (!r.t) return null;
            const cy = (r.sa + r.sb + r.ta + r.tb) / 4;
            return (
              <g
                key={`chip-${b.id}`}
                transform={`translate(${XM}, ${cy})`}
                pointerEvents="none"
                className="tp-fade"
                style={{ opacity: active === b.id ? 1 : 0 }}
              >
                <rect x="-70" y="-14" width="140" height="28" rx="14" fill="#030712" stroke="#FFFFFF" strokeOpacity="0.7" />
                <text x="0" y="5" textAnchor="middle" fill="#FFFFFF" fontFamily="ui-monospace, monospace" fontSize="12" fontWeight="700">
                  {parts[i].toLocaleString()} rows · {pcts[i]}%
                </text>
              </g>
            );
          })}

          {/* 4. Destination labels (desktop / tablet) */}
          <g className="hidden sm:inline">
            {BRANCHES.map((b, i) => {
              const o = labelOpacity(i);
              const top = SLOTS[i] - b.bar / 2;
              const lastY = b.lineY[b.lineY.length - 1];
              return (
                <g
                  key={b.id}
                  transform={`translate(${708 + (1 - o) * 14}, ${top})`}
                  className="tp-fade cursor-pointer"
                  style={{ opacity: o * dim(b.id) }}
                  {...bind(b.id)}
                  onClick={() => setActive((a) => (a === b.id ? null : b.id))}
                >
                  <rect x="0" y="0" width="4" height={b.bar} fill="#FFFFFF" />
                  <rect x="-6" y="-8" width="300" height={lastY + 40} fill="transparent" />
                  <text x="16" y={b.pctY} fill="#FFFFFF" fontFamily={FONT} fontSize={b.pctSize} fontWeight="900" letterSpacing="-0.02em">
                    {pctText(i)}%
                  </text>
                  <text x="16" y={b.titleY} fill="#FFFFFF" fontFamily={FONT} fontSize={b.titleSize} fontWeight="900" letterSpacing="0.06em">
                    {b.title}
                  </text>
                  {b.lines.map((line, k) => (
                    <text key={line} x="16" y={b.lineY[k]} fill="#94A3B8" fontFamily={FONT} fontSize="13" fontWeight="500">
                      {line}
                    </text>
                  ))}
                  <text x="16" y={lastY + 20} fill="#64748B" fontFamily="ui-monospace, monospace" fontSize="12" fontWeight="600">
                    {rowsText(i)} {b.noun}
                  </text>
                </g>
              );
            })}
          </g>

          {/* 5. Audit callout */}
          <g transform="translate(70, 535)" opacity={clamp01((intro - 0.6) / 0.4)}>
            <rect
              x="0" y="0" width="290" height="68" fill="none" stroke="#475569" strokeWidth="1.5"
              strokeDasharray="4 4" className="tp-march"
            />
            <text x="16" y="28" fill="#E2E8F0" fontFamily={FONT} fontSize="12" fontWeight="800" letterSpacing="0.05em">
              YOUR DATA PRIVACY IS AUDITED.
            </text>
            <text x="16" y="50" fill="#FFFFFF" fontFamily={FONT} fontSize="13" fontWeight="900" letterSpacing="0.07em">
              <tspan textDecoration="underline">PROTECT</tspan> WHAT MATTERS.
            </text>
          </g>

          {/* 6. Branding */}
          <g transform={`translate(${VB_W / 2}, 600)`}>
            <text textAnchor="middle" fontFamily={FONT} fontSize="16" fontWeight="900" letterSpacing="0.02em">
              <tspan fill="#EF4444">Traffic</tspan>
              <tspan fill="#FFFFFF">Processor</tspan>
            </text>
          </g>
        </svg>
      </div>

      {/* Mobile: tappable cards replace the in-SVG labels */}
      <div className="sm:hidden grid grid-cols-1 gap-2 px-4 pb-4">
        {BRANCHES.map((b, i) => {
          const on = active === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setActive((a) => (a === b.id ? null : b.id))}
              aria-pressed={on}
              className={`flex items-center gap-3 text-left rounded-lg border px-3 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 ${
                on ? 'border-white/70 bg-white/10' : 'border-neutral-800 bg-neutral-950'
              }`}
            >
              <span className={`w-1 self-stretch rounded-full ${b.id === 'dropped' ? 'bg-red-500' : 'bg-white'}`} />
              <span className="text-3xl font-black tabular-nums leading-none w-20">{pctText(i)}%</span>
              <span className="min-w-0">
                <span className="block text-[12px] font-black tracking-wider">{b.title}</span>
                <span className="block text-[11px] font-mono text-neutral-400">
                  {rowsText(i)} {b.noun}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer: computed reconciliation */}
      <div className="px-4 sm:px-6 py-2.5 bg-neutral-950 border-t border-neutral-900 flex flex-wrap items-center justify-between gap-y-1 text-[11px] text-neutral-400 font-mono">
        <div className="flex items-center gap-2.5" role="status">
          <span
            className={`w-2 h-2 rounded-full ${reconciled ? 'bg-emerald-500' : 'bg-amber-400'} ${reduced ? '' : 'animate-pulse'}`}
          />
          <span>
            {reconciled
              ? `QC-01 Reconciliation: all ${stats.total.toLocaleString()} rows accounted for`
              : `QC-01 Reconciliation: counts exceed original rows by ${stats.overflow.toLocaleString()}`}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>
            Active volume: <strong className="text-white tabular-nums">{totalText} rows</strong>
          </span>
          <span className="text-neutral-700">|</span>
          <span>Zero Retention Policy Active</span>
        </div>
      </div>
    </div>
  );
}