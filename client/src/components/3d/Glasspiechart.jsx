import React, { useEffect, useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * GlassPieChart v2
 * Frosted-glass pie with exploded slices, a big colour glow that fills the
 * centre, and a coloured "seam" visible in the gaps between slices.
 * Pure SVG, no dependencies.
 *
 * data: [{ name, value, color? }]
 * unit: small text under the number inside each slice (e.g. "cols")
 */

const SIZE = 320;
const C = SIZE / 2;
const R = 122;
const GAP = 9;
const HOVER_GAP = 18;
const PALETTE = ['#2347ff', '#1fc8ff', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e'];

const polar = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
};

const slicePath = (a0, a1, r) => {
  const end = Math.min(a1, a0 + 359.99);
  const [x0, y0] = polar(a0, r);
  const [x1, y1] = polar(end, r);
  return `M0 0 L${x0} ${y0} A${r} ${r} 0 ${end - a0 > 180 ? 1 : 0} 1 ${x1} ${y1} Z`;
};

export default function GlassPieChart({
  data = [],
  unit = '',
  height = 240,
  minLabelPct = 6,
}) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState(null);
  const [ready, setReady] = useState(false);

  // slices ease out from the centre once on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const { slices, total } = useMemo(() => {
    const items = data.filter((d) => d.value > 0);
    const sum = items.reduce((s, d) => s + d.value, 0);
    let angle = 0;
    const out = items.map((d, i) => {
      const sweep = (d.value / sum) * 360;
      const a0 = angle;
      const a1 = angle + sweep;
      angle = a1;
      const mid = (a0 + a1) / 2;
      const small = sweep < 50;
      const [ox, oy] = polar(mid, 1);
      const [gx, gy] = polar(mid, R * (small ? 0.5 : 0.4)); // glow anchor
      const [lx, ly] = polar(mid, R * (small ? 0.58 : 0.5)); // label anchor
      return {
        ...d,
        color: d.color || PALETTE[i % PALETTE.length],
        pct: (d.value / sum) * 100,
        a0, a1, ox, oy, gx, gy, lx, ly,
        glowR: Math.min(R * 0.66, R * 0.26 + sweep * 0.0016 * R + (small ? 0 : R * 0.12)),
      };
    });
    return { slices: out, total: sum };
  }, [data]);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-theme-dim" style={{ height }}>
        No data available
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full"
      style={{ height }}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto h-full w-full overflow-visible"
        role="img"
        aria-label={slices.map((s) => `${s.name} ${s.pct.toFixed(0)}%`).join(', ')}
      >
        <defs>
          <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="15" />
          </filter>
          <filter id={`${uid}-seam`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id={`${uid}-shadow`} x="-40%" y="-40%" width="180%" height="190%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <filter id={`${uid}-text`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#0b1b6b" floodOpacity="0.45" />
          </filter>

          {/* clear centre -> frosted rim */}
          <radialGradient id={`${uid}-frost`} cx="0" cy="0" r={R} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.05" />
            <stop offset="0.68" stopColor="#f6f6f8" stopOpacity="0.6" />
            <stop offset="0.82" stopColor="#efeff2" stopOpacity="0.92" />
            <stop offset="1" stopColor="#e4e4e9" stopOpacity="0.98" />
          </radialGradient>

          {/* soft top-left highlight on every slice */}
          <linearGradient id={`${uid}-shine`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          </linearGradient>

          <clipPath id={`${uid}-core`}>
            <circle r={R * 0.72} />
          </clipPath>
          {slices.map((s, i) => (
            <clipPath id={`${uid}-clip-${i}`} key={i}>
              <path d={slicePath(s.a0, s.a1, R)} />
            </clipPath>
          ))}
        </defs>

        <g transform={`translate(${C} ${C})`}>
          {/* 1. seam glow: shows through the gaps between slices */}
          <g clipPath={`url(#${uid}-core)`} opacity={ready ? 1 : 0} style={{ transition: 'opacity 400ms ease' }}>
            {slices.map((s, i) => (
              <circle
                key={i}
                cx={s.gx * 0.8}
                cy={s.gy * 0.8}
                r={R * 0.34}
                fill={s.color}
                filter={`url(#${uid}-seam)`}
              />
            ))}
          </g>

          {/* 2. slices */}
          {slices.map((s, i) => {
            const push = !ready ? 0 : hover === i ? HOVER_GAP : GAP;
            const dim = hover !== null && hover !== i;
            return (
              <g
                key={s.name}
                style={{
                  transform: `translate(${s.ox * push}px, ${s.oy * push}px)`,
                  transition: 'transform 380ms cubic-bezier(.2,.8,.2,1), opacity 200ms ease',
                  opacity: dim ? 0.55 : 1,
                  cursor: 'pointer',
                  willChange: 'transform, opacity',
                }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${s.name}: ${s.value}${unit ? ' ' + unit : ''} (${s.pct.toFixed(1)}%)`}</title>

                <path
                  d={slicePath(s.a0, s.a1, R)}
                  fill="#000"
                  fillOpacity="0.16"
                  transform="translate(0 9)"
                  filter={`url(#${uid}-shadow)`}
                />

                <g clipPath={`url(#${uid}-clip-${i})`}>
                  <circle
                    cx={s.gx}
                    cy={s.gy}
                    r={s.glowR}
                    fill={s.color}
                    filter={`url(#${uid}-glow)`}
                  />
                </g>

                <path d={slicePath(s.a0, s.a1, R)} fill={`url(#${uid}-frost)`} />
                <path d={slicePath(s.a0, s.a1, R)} fill={`url(#${uid}-shine)`} opacity="0.5" />
                <path
                  d={slicePath(s.a0, s.a1, R)}
                  fill="none"
                  stroke="#fff"
                  strokeOpacity="0.7"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />

                {s.pct >= minLabelPct && (
                  <g
                    transform={`translate(${s.lx} ${s.ly})`}
                    textAnchor="middle"
                    style={{ pointerEvents: 'none' }}
                    filter={`url(#${uid}-text)`}
                  >
                    <text
                      y="4"
                      fill="#fff"
                      fontSize={s.pct > 20 ? 28 : 20}
                      fontWeight="700"
                    >
                      {Math.round(s.pct)}%
                    </text>
                    <text y={s.pct > 20 ? 21 : 18} fill="#fff" fillOpacity="0.85" fontSize="11.5">
                      {s.value.toLocaleString()}
                      {unit ? ` ${unit}` : ''}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </motion.div>
  );
}