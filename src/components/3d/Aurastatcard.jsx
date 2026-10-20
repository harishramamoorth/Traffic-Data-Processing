import React, { useEffect, useId, useState } from 'react';
import { motion, animate, useReducedMotion } from 'framer-motion';

/**
 * AuraStatsPanel v3
 * One ring per stat. Six stats -> six concentric half-rings around the Deep
 * Onyx core. Each ring is filled to that stat's quality level and uses the
 * same colour as its stat underneath. Hover a ring or a stat to link them;
 * the core then shows that stat's level.
 *
 * stats: [{
 *   title, value, subtitle,
 *   level (0-100)      how full the ring is
 *   levelLabel         e.g. "unique", "PII-free"
 *   tone               'ok' | 'warn' | 'alert'  (pulses when not ok)
 *   color              optional hex, defaults to the palette below
 * }]
 */

const CORE = '#0A0D0B'; // Deep Onyx
const BRAND = { cloud: '#EAEBEA', mid: '#B0C9A1', ring: '#ACDBB8', mist: '#D3F4D1' };

// Ring colour follows the stat's status, drawn from the Green Aura family:
// healthy = sage -> mint -> olive, needs review = muted amber, risk = muted rose.
const SHADES = {
  ok: ['#5E8F72', '#79AE8B', '#96C4A0', '#B0C9A1'],
  warn: ['#D49A2F', '#E3B45F'],
  alert: ['#D4566A', '#E5848F'],
};
const STATUS = { ok: '#4fa56f', warn: '#d19a2a', alert: '#d9475a' };

const pickColors = (stats) => {
  const used = { ok: 0, warn: 0, alert: 0 };
  return stats.map((s) => {
    if (s.color) return s.color;
    const t = SHADES[s.tone] ? s.tone : 'ok';
    return SHADES[t][used[t]++ % SHADES[t].length];
  });
};

const mixCss = (a, pa, b) => `color-mix(in srgb, ${a} ${pa}%, ${b})`;

const lighten = (hex, amt = 0.4) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.round(v + (255 - v) * amt);
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `rgb(${r},${g},${b})`;
};

const darken = (hex, amt = 0.28) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.round(v * (1 - amt));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
};

const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
const fmtLevel = (l) => (Number.isInteger(l) ? `${l}` : l.toFixed(1));

/* ---------- hooks ---------- */

function useCountUp(target, duration = 1.1, delay = 0) {
  const reduce = useReducedMotion();
  const isNum = typeof target === 'number' && isFinite(target);
  const [n, setN] = useState(isNum && !reduce ? 0 : target);

  useEffect(() => {
    if (!isNum || reduce) {
      setN(target);
      return;
    }
    const c = animate(0, target, { duration, delay, ease: 'easeOut', onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [target, isNum, reduce, duration, delay]);

  return isNum ? n.toLocaleString() : n;
}

/* ---------- one ring ---------- */

const BAND_W = 3.3;

function Band({ uid, i, r, level, color, active, setActive }) {
  const reduce = useReducedMotion();
  const target = clamp(level) / 100;
  const [p, setP] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setP(target);
      return;
    }
    const c = animate(0, target, { duration: 1.5, delay: 0.2 + i * 0.14, ease: [0.22, 1, 0.36, 1], onUpdate: setP });
    return () => c.stop();
  }, [target, i, reduce]);

  const d = `M ${50 - r} 50 A ${r} ${r} 0 0 1 ${50 + r} 50`;
  const hot = active === i;
  const dim = active !== null && !hot;
  const sw = hot ? BAND_W + 1.1 : BAND_W;
  const dash = `${p * 100} 100`;

  return (
    <g style={{ opacity: dim ? 0.3 : 1, transition: 'opacity .25s' }}>
      <defs>
        <linearGradient id={`${uid}-g${i}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={lighten(color, 0.28)} />
        </linearGradient>
        <mask id={`${uid}-m${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <path d={d} pathLength="100" fill="none" stroke="#fff" strokeWidth={BAND_W} strokeLinecap="round" strokeDasharray={dash} />
        </mask>
      </defs>

      {/* track */}
      <path d={d} fill="none" stroke="#7a8a7f" strokeOpacity="0.14" strokeLinecap="round" style={{ strokeWidth: sw, transition: 'stroke-width .2s' }} />

      {p > 0.003 && (
        <>
          {/* soft glow under the fill */}
          <path
            d={d}
            pathLength="100"
            fill="none"
            stroke={color}
            strokeOpacity="0.32"
            strokeLinecap="round"
            strokeDasharray={dash}
            filter={`url(#${uid}-blur)`}
            style={{ strokeWidth: sw + 1.2, transition: 'stroke-width .2s' }}
          />
          {/* fill */}
          <path
            d={d}
            pathLength="100"
            fill="none"
            stroke={`url(#${uid}-g${i})`}
            strokeLinecap="round"
            strokeDasharray={dash}
            style={{ strokeWidth: sw, transition: 'stroke-width .2s' }}
          />
          {/* light running along the filled part only */}
          <g mask={`url(#${uid}-m${i})`}>
            <path
              d={d}
              pathLength="100"
              fill="none"
              stroke="#fff"
              strokeOpacity="0.4"
              strokeDasharray="4 96"
              className="aura-shimmer"
              style={{ strokeWidth: BAND_W * 0.3, animationDuration: `${3.2 + i * 0.4}s`, animationDelay: `${i * 0.45}s` }}
            />
          </g>
        </>
      )}

      {/* hover target */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={BAND_W + 2}
        pointerEvents="stroke"
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setActive(i)}
        onMouseLeave={() => setActive(null)}
      />
    </g>
  );
}

/* ---------- aura ---------- */

function Aura({ stats, colors, active, setActive, score, scoreLabel }) {
  const uid = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const n = Math.max(stats.length, 1);

  // rings fill the space between the core and the outer edge
  const outer = 46;
  const inner = 17.5;
  const step = n > 1 ? (outer - inner) / (n - 1) : 0;

  const hotStat = active !== null ? stats[active] : null;
  const coreValue = useCountUp(Math.round(score ?? 0), 1.4, 0.3);

  return (
    <div className="pointer-events-none absolute left-1/2 bottom-0 aspect-square w-[400px] sm:w-[540px] -translate-x-1/2 translate-y-1/2">
      <style>{`
        @keyframes aura-shimmer { from { stroke-dashoffset: 0 } to { stroke-dashoffset: -100 } }
        .aura-shimmer { animation: aura-shimmer 3.6s linear infinite }
        @media (prefers-reduced-motion: reduce) { .aura-shimmer { animation: none; opacity: 0 } }
      `}</style>

      {/* backdrop disc (Cloud Whisper -> Morning Mist) */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(circle, ${BRAND.mist} 0%, ${BRAND.mid}33 45%, ${BRAND.cloud} 100%)` }}
      />

      {/* ripples from the core */}
      {!reduce &&
        [0, 2.8].map((delay) => (
          <motion.div
            key={delay}
            className="absolute inset-0 rounded-full"
            style={{ border: `1px solid ${BRAND.mid}` }}
            initial={{ scale: 0.28, opacity: 0 }}
            animate={{ scale: [0.28, 1], opacity: [0.55, 0] }}
            transition={{ duration: 5.6, delay, repeat: Infinity, ease: 'easeOut' }}
          />
        ))}

      {/* rings, one per stat */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible" style={{ pointerEvents: 'none' }}>
        <defs>
          <filter id={`${uid}-blur`} filterUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <feGaussianBlur stdDeviation="1.1" />
          </filter>
        </defs>
        {stats.map((s, i) => (
          <Band
            key={s.title}
            uid={uid}
            i={i}
            r={outer - i * step}
            level={s.level ?? 100}
            color={colors[i]}
            active={active}
            setActive={setActive}
          />
        ))}
      </svg>

      {/* Deep Onyx core */}
      <div
        className="absolute rounded-full"
        style={{
          inset: '36.5%',
          background: `radial-gradient(circle, ${CORE} 0%, ${mixCss(CORE, 72, BRAND.ring)} 30%, ${mixCss(CORE, 26, BRAND.ring)} 68%, ${BRAND.ring} 100%)`,
          boxShadow: `0 0 0 2px ${BRAND.mist}`,
        }}
      />

      {/* core readout */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pb-2 text-center w-24">
        <div className="text-2xl sm:text-3xl font-light leading-none text-white tabular-nums">
          {hotStat ? `${fmtLevel(clamp(hotStat.level ?? 100))}%` : coreValue}
        </div>
        <div className="mt-1 truncate text-[9px] font-mono tracking-[0.18em] text-white/65">
          {hotStat ? (hotStat.levelLabel || hotStat.title).toUpperCase() : scoreLabel}
        </div>
      </div>
    </div>
  );
}

/* ---------- stats row ---------- */

function Stat({ i, s, color, active, setActive }) {
  const shown = useCountUp(s.value, 1, 0.3 + i * 0.14);
  const hot = active === i;
  const dim = active !== null && !hot;
  const needsReview = s.tone && s.tone !== 'ok';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: dim ? 0.45 : 1, y: 0 }}
      transition={{ duration: 0.35, delay: dim || hot ? 0 : 0.1 + i * 0.07 }}
      onMouseEnter={() => setActive(i)}
      onMouseLeave={() => setActive(null)}
      className="min-w-0 cursor-default"
    >
      <div className="flex items-center gap-2">
        {/* band-shaped chip = this stat's ring */}
        <span
          className="h-2 w-6 shrink-0 rounded-full transition-transform duration-200"
          style={{
            background: `linear-gradient(90deg, ${color}, ${lighten(color, 0.28)})`,
            boxShadow: `0 0 8px ${color}44`,
            transform: hot ? 'scaleX(1.25)' : 'none',
            transformOrigin: 'left',
          }}
        />
        <span className="truncate text-lg font-medium leading-none text-theme-text tabular-nums">{shown}</span>
        {needsReview && (
          <span className="relative ml-auto flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ backgroundColor: STATUS[s.tone] }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: STATUS[s.tone] }} />
          </span>
        )}
      </div>
      <div className="mt-1.5 truncate text-[13px] text-theme-muted">{s.title}</div>
      {s.subtitle && <div className="mt-0.5 truncate text-[11px] text-theme-dim">{s.subtitle}</div>}
      {s.level != null && (
        <div className="mt-1 truncate text-[11px] font-mono font-semibold" style={{ color: darken(color) }}>
          {fmtLevel(clamp(s.level))}% {s.levelLabel}
        </div>
      )}
    </motion.div>
  );
}

/* ---------- panel ---------- */

export default function AuraStatsPanel({
  title = 'Dataset overview',
  caption = 'Pre-flight summary',
  stats = [],
  score, // shown in the core when nothing is hovered
  scoreLabel = 'HEALTH',
}) {
  const [active, setActive] = useState(null);
  const colors = pickColors(stats);
  const review = stats.filter((s) => s.tone && s.tone !== 'ok').length;

  return (
    <section className="overflow-hidden rounded-2xl border border-theme-border bg-theme-card">
      <div className="relative h-[225px] sm:h-[285px] overflow-hidden bg-theme-secondary/50">
        <Aura stats={stats} colors={colors} active={active} setActive={setActive} score={score} scoreLabel={scoreLabel} />

        <div className="relative z-10 p-5 sm:p-6 font-mono">
          <div className="text-sm sm:text-base tracking-[0.2em] text-theme-text">/{title.toUpperCase()}</div>
          <div className="mt-1.5 text-[11px] tracking-[0.2em] text-theme-muted">/{caption.toUpperCase()}</div>
        </div>

        <div className="absolute right-5 top-5 z-10 hidden items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-theme-muted sm:flex sm:right-6 sm:top-6">
          <span className="relative flex h-2 w-2">
            {review > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60 motion-reduce:hidden" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${review > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          </span>
          <span>{review > 0 ? `${review} OF ${stats.length} NEED REVIEW` : 'ALL CHECKS PASSED'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3 sm:p-6 lg:grid-cols-6">
        {stats.map((s, i) => (
          <Stat key={s.title} i={i} s={s} color={colors[i]} active={active} setActive={setActive} />
        ))}
      </div>
    </section>
  );
}