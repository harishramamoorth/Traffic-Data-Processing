import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  motion, AnimatePresence, useScroll, useSpring, useTransform, useInView, useReducedMotion,
} from 'framer-motion';
import {
  ShieldCheck, KeyRound, MapPin, Clock, Trash2, EyeOff, AlertTriangle, CheckCircle2, ArrowRight,
  ArrowUp, Plus, Minus, LayoutList, LayoutGrid, Layers, Lightbulb,
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────────
   THEMES & STYLES:
   Variables are defined globally so they automatically sync with 
   your parent app's navbar theme switchers.
   ──────────────────────────────────────────────────────────────── */
const CSS = `
.mt {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
.mt .hide-sb { scrollbar-width: none; }
.mt .hide-sb::-webkit-scrollbar { display: none; }
.mt :focus-visible { outline: 2px solid var(--acc); outline-offset: 3px; }
.mt .flash { animation: mt-flash 1.8s ease-out; }
@keyframes mt-flash { 
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--acc) 70%, transparent); }
  100% { box-shadow: 0 0 0 14px transparent; }
}
@media (prefers-reduced-motion: reduce) { .mt .flash { animation: none; } }

/* --- GLOBAL THEME DEFINITIONS --- */

/* Default / Light Pro */
:root, [data-theme="Light Pro"], [data-theme="light-pro"], .theme-light-pro {
  --theme-bg: #ffffff;
  --theme-card: #f8fafc;
  --theme-secondary: #f1f5f9;
  --theme-border: #e2e8f0;
  --theme-text: #0f172a;
  --theme-muted: #475569;
  --theme-dim: #94a3b8;
  --acc: #2563eb;
}

/* Midnight */
[data-theme="Midnight"], [data-theme="midnight"], .theme-midnight, .dark {
  --theme-bg: #020617;
  --theme-card: #0f172a;
  --theme-secondary: #1e293b;
  --theme-border: #334155;
  --theme-text: #f8fafc;
  --theme-muted: #94a3b8;
  --theme-dim: #64748b;
  --acc: #06b6d4;
}

/* Aurora */
[data-theme="Aurora"], [data-theme="aurora"], .theme-aurora {
  --theme-bg: #171026;
  --theme-card: #2a1b40;
  --theme-secondary: #3d285c;
  --theme-border: #53377a;
  --theme-text: #fdf4ff;
  --theme-muted: #d8b4fe;
  --theme-dim: #a855f7;
  --acc: #d946ef;
}

/* Matrix */
[data-theme="Matrix"], [data-theme="matrix"], .theme-matrix {
  --theme-bg: #000000;
  --theme-card: #0a0a0a;
  --theme-secondary: #171717;
  --theme-border: #166534;
  --theme-text: #4ade80;
  --theme-muted: #22c55e;
  --theme-dim: #16a34a;
  --acc: #22c55e;
}

/* High Contrast */
[data-theme="High Contrast"], [data-theme="high-contrast"], [data-theme="hc"], .theme-hc {
  --theme-bg: #000000;
  --theme-card: #000000;
  --theme-secondary: #1a1a1a;
  --theme-border: #ffffff;
  --theme-text: #ffffff;
  --theme-muted: #e5e5e5;
  --theme-dim: #a3a3a3;
  --acc: #eab308;
}
`;

const TECHNIQUES = [
  {
    id: 'data-minimization', name: 'Data minimization', sub: 'Direct identifier dropping', tag: 'GDPR Art. 5(1)(c)', icon: Trash2,
    plain: 'Delete the columns nobody needs.', protects: 'Names, SSNs, phones, emails', costs: 'No driver-level personalization',
    summary: 'Removes high-risk direct personal identifiers (SSNs, driver names, phone numbers, email addresses) from dataset storage.',
    whyChosen: 'Traffic congestion modeling and route planning have no legitimate analytical need for individual names or SSNs. Retaining direct identifiers exposes organizations to unnecessary privacy risks.',
    limits: 'Prevents driver-level personalization or linking data back to specific individuals (which is the intended privacy goal for non-enforcement analytics).',
    example: { before: '{ "driver_name": "Alexander Wright", "driver_ssn": "102-45-7890", "speed_mph": 34.5 }', after: '{ "speed_mph": 34.5 }' },
  },
  {
    id: 'hmac-pseudonymization', name: 'HMAC pseudonymization', sub: 'Cryptographic SHA-256', tag: 'Deterministic hashing', icon: KeyRound,
    plain: 'Swap each plate for a stable secret code.', protects: 'Real license plates', costs: 'Weak if the secret key leaks',
    summary: 'Transforms vehicle license plates into irreversible pseudonyms (format ANON_<first 12 hex>) keyed by a secret server salt.',
    whyChosen: 'Enables longitudinal fleet analysis, origin-destination matrices, and recurring route pattern detection without storing real-world registration plates. Same plate + same key produces the same pseudonym across batches.',
    limits: 'Vulnerable to brute-force dictionary attacks if the secret key is leaked or if the plate entropy space is small; protected by keeping the key in server environment variables.',
    example: { before: '{ "vehicle_plate": "NYC-8492" }', after: '{ "vehicle_plate": "ANON_8c7f21a4e9b0" }' },
  },
  {
    id: 'spatial-generalization', name: 'Spatial generalization', sub: 'GPS decimals floor', tag: 'Location obfuscation', icon: MapPin,
    plain: 'Blur exact spots into squares about 1 km wide.', protects: 'Homes, clinics, workplaces', costs: 'No lane-level detail',
    summary: 'Truncates raw GPS coordinates down to 2 decimal places (~1.1 km bounding box grid).',
    whyChosen: 'Exact coordinates can reveal residential driveways, clinics, or workplaces. A ~1.1 km grid cell maintains aggregate road segment density while providing spatial k-anonymity.',
    limits: 'Precludes lane-level micro-navigation or localized intersection collision reconstruction.',
    example: { before: '{ "latitude": 40.712776, "longitude": -74.005974 }', after: '{ "latitude": 40.71, "longitude": -74.01 }' },
  },
  {
    id: 'temporal-bucketing', name: 'Temporal bucketing', sub: '15-minute floor', tag: 'Temporal privacy', icon: Clock,
    plain: 'Round every time down to the nearest 15 minutes.', protects: 'Matching to CCTV, toll or cell logs', costs: 'Short speed spikes get averaged out',
    summary: 'Rounds exact timestamps (seconds and milliseconds) down to 15-minute UTC intervals in ISO-8601 format.',
    whyChosen: 'Exact timestamps enable cross-correlation with external CCTV footage, automatic toll booths, or mobile cell-tower pings. 15-minute floor bucketing decouples the event from exact clock-time correlations.',
    limits: 'Averages out instantaneous speed spikes across short sub-second intervals.',
    example: { before: '{ "timestamp": "2026-10-17 07:44:45.192" }', after: '{ "timestamp": "2026-10-17T07:30:00Z" }' },
  },
  {
    id: 'freetext-redaction', name: 'Free-text scrubbing', sub: 'Automated redaction', tag: 'Incidental leakage', icon: EyeOff,
    plain: 'Find phone numbers and plates typed into notes, and mask them.', protects: 'Accidental leaks in notes', costs: 'May over-redact or miss disguised text',
    summary: 'Scans unstructured dispatcher notes, road segment comments, and officer logs for patterns of plates, phones, and SSNs, replacing them with standardized redaction tokens.',
    whyChosen: 'Operators and dispatchers frequently note down driver contact numbers, plates, or personal comments into informal text fields. Automated scrubbing stops incidental leakage.',
    limits: 'Regexes may occasionally redact non-PII strings that resemble telephone or plate patterns, or miss obfuscated colloquial text.',
    example: { before: '{ "road_segment": "Broadway North (call 212-555-0199)" }', after: '{ "road_segment": "Broadway North (call [REDACTED_PHONE])" }' },
  },
  {
    id: 'non-clamping-outliers', name: 'Non-clamping outliers', sub: 'Auditing, not editing', tag: 'Data veracity', icon: AlertTriangle,
    plain: 'Keep the real number and add a flag instead of changing it.', protects: 'Accuracy for crash and safety work', costs: 'Consumers must filter on the flag',
    summary: 'Preserves original telemetry measurements above 120 mph by attaching `speed_outlier_flag = true` rather than silently clamping or altering numbers.',
    whyChosen: 'Silently mutating speed values (e.g. overwriting 145 mph to 120 mph) compromises crash investigations, emergency responder analysis, and scientific research veracity.',
    limits: 'Downstream consumers must filter on `speed_outlier_flag` if computing averages that would be skewed by anomalous outliers.',
    example: { before: '{ "speed_mph": 135.2 }', after: '{ "speed_mph": 135.2, "speed_outlier_flag": true }' },
  },
];

const GOALS = [
  { label: 'Remove names and SSNs', id: 'data-minimization' },
  { label: 'Follow a vehicle without its plate', id: 'hmac-pseudonymization' },
  { label: 'Hide where people live or work', id: 'spatial-generalization' },
  { label: 'Stop matching to camera or toll times', id: 'temporal-bucketing' },
  { label: 'Clean up notes and comments', id: 'freetext-redaction' },
  { label: 'Keep real speeds trustworthy', id: 'non-clamping-outliers' },
];

const STEPS = [
  { n: '01', t: 'Detect', d: 'The profiler scans every column for names, plates, coordinates, timestamps and free text.' },
  { n: '02', t: 'Decide', d: 'You choose an action per field, or start from a preset. Each technique below is one of those actions.' },
  { n: '03', t: 'Transform', d: 'Every rule runs on every row in memory. Uploaded files are deleted when processing ends.' },
  { n: '04', t: 'Verify', d: 'Quality checks and a re-identification test confirm the result before you download.' },
];

const SECTIONS = [
  { id: 'intro', label: 'Intro' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'techniques', label: 'Techniques' },
  { id: 'tradeoffs', label: 'Trade-offs' },
];

const num = (i) => String(i + 1).padStart(2, '0');

/* ── building blocks ───────────────────────────────────────────── */
const Rule = ({ className = '' }) => <span aria-hidden className={`absolute inset-x-0 h-px bg-current opacity-30 ${className}`} />;
const Sup = ({ children }) => <sup className="ml-1.5 align-super text-[0.26em] font-semibold tracking-normal text-[var(--theme-muted)]">{children}</sup>;

function SectionHead({ n, title, hint, right }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--theme-muted)]">/ {n} {title.toUpperCase()}</p>
        {hint && <p className="mt-1.5 max-w-xl text-sm text-[var(--theme-muted)]">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

function ScrollBar({ container }) {
  const { scrollYProgress } = useScroll(container ? { container } : undefined);
  const x = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  return <motion.div aria-hidden className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left" style={{ scaleX: x, background: 'var(--acc)' }} />;
}

function Hint({ children }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-[var(--theme-secondary)] border border-[var(--theme-border)] px-4 py-3 text-xs leading-relaxed text-[var(--theme-muted)]">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--acc)' }} />
      <span>{children}</span>
    </p>
  );
}

function InfoCard({ tone, icon: Icon, label, children }) {
  const c = tone === 'ok' ? 'text-emerald-500' : 'text-amber-500';
  return (
    <div className="space-y-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-secondary)] p-4">
      <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${c}`}><Icon className="h-3.5 w-3.5" />{label}</span>
      <p className="text-[13px] leading-relaxed text-[var(--theme-muted)]">{children}</p>
    </div>
  );
}

function Body({ t }) {
  return (
    <div className="space-y-3 pb-8 pt-1">
      <Hint><b className="text-[var(--theme-text)]">In plain words: </b>{t.plain}</Hint>
      <div className="grid gap-3 md:grid-cols-2">
        <InfoCard tone="ok" icon={CheckCircle2} label="Why we use it">{t.whyChosen}</InfoCard>
        <InfoCard tone="warn" icon={AlertTriangle} label="What you give up">{t.limits}</InfoCard>
      </div>
      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-secondary)] p-4">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--theme-dim)]">Example: before → after</p>
        <div className="grid gap-2.5 font-mono text-[11px] sm:grid-cols-2">
          <div className="break-words rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-[var(--theme-muted)]">
            <span className="mb-1 block text-[9px] font-semibold uppercase text-[var(--theme-dim)]">Before</span>{t.example.before}
          </div>
          <div className="break-words rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-[var(--theme-text)] font-semibold">
            <span className="mb-1 block text-[9px] font-semibold uppercase" style={{ color: 'var(--acc)' }}>After</span>{t.example.after}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── view 1: editorial rows (flat layout) ──────────────────────── */
function Row({ t, i, open, onToggle, flash }) {
  const reduce = useReducedMotion();
  return (
    <article id={t.id} className={`group relative scroll-mt-28 text-[var(--theme-text)] transition-colors ${flash ? 'flash' : ''} ${open ? 'bg-[var(--theme-secondary)]' : 'hover:bg-[var(--theme-secondary)]'}`}>
      <Rule className="top-0" />
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`${t.id}-body`}
        className="grid w-full cursor-pointer grid-cols-1 gap-4 px-2 py-8 text-left md:grid-cols-[1.25fr_1fr] md:items-start md:gap-10 md:px-4">
        <h3 className="text-[clamp(1.75rem,4.2vw,3rem)] font-black uppercase leading-[0.95] tracking-[-0.03em]">
          {t.name}<Sup>{num(i)}</Sup>
          <span className="mt-2 block font-mono text-[11px] font-medium normal-case tracking-normal text-[var(--theme-muted)]">{t.sub} · {t.tag}</span>
        </h3>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-[var(--theme-text)]">{t.plain}</p>
            <p className="text-xs leading-relaxed text-[var(--theme-muted)]">{t.summary}</p>
          </div>
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-bg)] transition-colors group-hover:border-[color:var(--acc)]">
            {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </span>
        </div>
      </button>
      <span aria-hidden className={`absolute inset-x-0 bottom-0 h-0.5 origin-left transition-transform duration-500 ${open ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} style={{ background: 'var(--acc)' }} />
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={`${t.id}-body`} initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={reduce ? undefined : { height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden px-2 md:px-4">
            <Body t={t} />
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

/* ── view 2: card grid ─────────────────────────────────────────── */
function CardItem({ t, i, open, onToggle, flash }) {
  const Icon = t.icon;
  const reduce = useReducedMotion();
  return (
    <motion.article id={t.id} layout={!reduce} initial={reduce ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4, delay: (i % 2) * 0.07 }}
      className={`relative flex scroll-mt-28 flex-col overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] ${open ? 'md:col-span-2 shadow-sm' : 'shadow-none hover:border-[color:var(--acc)]'} ${flash ? 'flash' : ''}`}>
      <div className="flex-1 space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--theme-secondary)]" style={{ color: 'var(--acc)' }}><Icon className="h-5 w-5" /></span>
          <span className="font-mono text-xs text-[var(--theme-dim)]">{num(i)} / {num(TECHNIQUES.length - 1)}</span>
        </div>
        <h3 className="text-2xl font-black uppercase leading-[0.98] tracking-[-0.03em] text-[var(--theme-text)]">{t.name}</h3>
        <p className="text-sm font-semibold text-[var(--theme-text)]">{t.plain}</p>
        <p className="text-xs leading-relaxed text-[var(--theme-muted)]">{t.summary}</p>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="pt-3"><Body t={t} /></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex cursor-pointer items-center justify-between border-t border-[var(--theme-border)] px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-secondary)]">
        <span>{open ? 'Hide details' : 'Show details'}</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: 'var(--acc)' }}>{open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}</span>
      </button>
    </motion.article>
  );
}

/* ── view 3: stacked cards ─────────────────────────────────────── */
function StackCard({ t, i, total, progress, flash }) {
  const Icon = t.icon;
  const reduce = useReducedMotion();
  const scale = useTransform(progress, [i / total, 1], [1, reduce ? 1 : 1 - (total - 1 - i) * 0.035]);
  const dim = useTransform(progress, [i / total, Math.min(1, (i + 1.2) / total)], [1, reduce ? 1 : 0.55]);
  return (
    <div id={t.id} className={`sticky scroll-mt-28 ${i < total - 1 ? 'mb-[22vh]' : ''}`} style={{ top: 104 + i * 14 }}>
      <motion.article style={{ scale, opacity: dim, transformOrigin: 'top center' }} className={`overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-lg ${flash ? 'flash' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--theme-border)] px-6 py-4">
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--theme-secondary)]" style={{ color: 'var(--acc)' }}><Icon className="h-4 w-4" /></span>
            <span className="font-mono text-xs text-[var(--theme-muted)]">{t.tag}</span>
          </span>
          <span className="font-mono text-xs text-[var(--theme-dim)]">{num(i)} / {num(total - 1)}</span>
        </div>
        <div className="space-y-4 p-6 pb-2">
          <h3 className="text-[clamp(1.9rem,4.6vw,3.2rem)] font-black uppercase leading-[0.95] tracking-[-0.03em] text-[var(--theme-text)]">{t.name}<Sup>{num(i)}</Sup></h3>
          <p className="max-w-2xl text-sm text-[var(--theme-muted)]">{t.summary}</p>
          <Body t={t} />
        </div>
      </motion.article>
    </div>
  );
}

function Stack({ scrollRef }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'], ...(scrollRef ? { container: scrollRef } : {}) });
  return (
    <div ref={ref} className="relative">
      {TECHNIQUES.map((t, i) => <StackCard key={t.id} t={t} i={i} total={TECHNIQUES.length} progress={scrollYProgress} flash={false} />)}
    </div>
  );
}

/* ── pipeline strip ────────────────────────────────────────────── */
function Pipeline() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduce = useReducedMotion();
  return (
    <div ref={ref} className="space-y-6">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <motion.div key={s.n} initial={reduce ? false : { opacity: 0, y: 18 }} animate={inView || reduce ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.45, delay: i * 0.1 }}>
            <h3 className="text-[clamp(2rem,4vw,3rem)] font-black leading-none tracking-[-0.03em] text-[var(--theme-text)]">{s.t}<Sup>{s.n}</Sup></h3>
            <p className="mt-3 text-xs leading-relaxed text-[var(--theme-muted)]">{s.d}</p>
          </motion.div>
        ))}
      </div>
      <div className="relative h-0.5 w-full bg-[var(--theme-border)]">
        <motion.span className="absolute inset-y-0 left-0 w-full origin-left" style={{ background: 'var(--acc)' }} initial={{ scaleX: reduce ? 1 : 0 }} animate={{ scaleX: inView || reduce ? 1 : 0 }} transition={{ duration: 1.2, ease: 'easeOut' }} />
      </div>
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────── */
export default function Methodology({ scrollRef, theme }) {
  const reduce = useReducedMotion();
  const [view, setView] = useState('list');
  const [open, setOpen] = useState(() => new Set(['data-minimization']));
  const [section, setSection] = useState('intro');
  const [activeTech, setActiveTech] = useState(null);
  const [flash, setFlash] = useState(null);
  const flashTimer = useRef(null);

  const goTo = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [reduce]);

  useEffect(() => {
    const watch = (ids, set, margin) => {
      const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => e.isIntersecting && set(e.target.id));
      }, { rootMargin: margin });
      els.forEach((el) => io.observe(el));
      return io;
    };
    const a = watch(SECTIONS.map((s) => s.id), setSection, '-30% 0px -60% 0px');
    const b = watch(TECHNIQUES.map((t) => t.id), setActiveTech, '-35% 0px -55% 0px');
    return () => { a.disconnect(); b.disconnect(); };
  }, [view]);

  const toggle = (id) => setOpen((p) => p.has(id) ? new Set() : new Set([id]));
  
  const pickGoal = (id) => {
    setOpen(new Set([id]));
    setFlash(id);
    window.setTimeout(() => goTo(id), 80);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1900);
  };
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const activeIdx = TECHNIQUES.findIndex((t) => t.id === activeTech);
  const VIEWS = [
    { id: 'list', label: 'List', icon: LayoutList },
    { id: 'cards', label: 'Cards', icon: LayoutGrid },
    { id: 'scroll', label: 'Scroll', icon: Layers },
  ];

  return (
    // If 'theme' prop is passed explicitly, attach it as a data attribute to force the local theme. 
    // Otherwise, it transparently arbs to whatever data-theme is on the parent <body> or <html>.
    <div className="mt relative w-full min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)] transition-colors duration-300" data-theme={theme}>
      <style>{CSS}</style>
      
      <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4">
        <ScrollBar container={scrollRef} />

        {/* flat pill nav */}
        <nav aria-label="Methodology sections" className="sticky top-3 z-30 mb-10 flex items-center justify-between gap-2 rounded-full bg-[var(--theme-bg)] border border-[var(--theme-border)] shadow-sm p-1.5">
          <div className="hide-sb flex min-w-0 items-center gap-0.5 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button key={s.id} type="button" onClick={() => goTo(s.id)} aria-current={section === s.id ? 'true' : undefined}
                className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs transition-colors ${section === s.id ? 'bg-[var(--theme-secondary)] font-bold text-[var(--theme-text)]' : 'font-medium text-[var(--theme-muted)] hover:text-[var(--theme-text)]'}`}>{s.label}</button>
            ))}
          </div>
          <span className="hidden whitespace-nowrap font-mono text-[11px] text-[var(--theme-dim)] lg:block">
            {activeIdx >= 0 ? `${num(activeIdx)} / ${num(TECHNIQUES.length - 1)} · ${TECHNIQUES[activeIdx].name}` : 'Scroll to explore'}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link to="/" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--theme-text)] px-4 py-2 text-xs font-bold transition-transform hover:scale-105" style={{ color: 'var(--theme-bg)' }}>Start new job<ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </nav>

        {/* intro */}
        <header id="intro" className="relative scroll-mt-28 space-y-8 pb-14 text-[var(--theme-text)]">
          <Rule className="top-0" />
          <div className="grid gap-8 pt-10 md:grid-cols-[1.4fr_1fr] md:items-end">
            <h1 className="text-[clamp(2.6rem,8vw,5.6rem)] font-black uppercase leading-[0.9] tracking-[-0.04em]">
              Methodology<br />&amp; limitations<Sup>06</Sup>
            </h1>
            <p className="text-sm leading-relaxed text-[var(--theme-muted)]">
              Documentation of the mathematical anonymization models, regulatory rationales, and analytical trade-offs applied across the pipeline. Six techniques, each with why it exists and what it costs.
            </p>
          </div>
          <Rule className="bottom-0" />
        </header>

        {/* pipeline */}
        <section id="pipeline" className="scroll-mt-28 space-y-8 py-14">
          <SectionHead n="01" title="How the pipeline works" hint="Four stages from upload to download. The techniques below run in stage 03." />
          <Pipeline />
        </section>

        {/* goal picker */}
        <section className="space-y-4 pb-14">
          <SectionHead n="02" title="What do you want to do?" hint="Pick a goal and we will jump to the technique that handles it." />
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <motion.button key={g.id} type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => pickGoal(g.id)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-2 text-xs font-semibold text-[var(--theme-text)] transition-colors hover:border-[color:var(--acc)]">
                {g.label}<ArrowRight className="h-3.5 w-3.5" style={{ color: 'var(--acc)' }} />
              </motion.button>
            ))}
          </div>
        </section>

        {/* techniques */}
        <section id="techniques" className="scroll-mt-28 space-y-8">
          <SectionHead n="03" title="The six techniques" hint="Choose how you want to read: open one at a time, browse cards, or scroll through a stack."
            right={
              <div role="tablist" aria-label="Reading mode" className="relative flex gap-1 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] p-1">
                {VIEWS.map((v) => {
                  const on = view === v.id; const Icon = v.icon;
                  return (
                    <button key={v.id} type="button" role="tab" aria-selected={on} onClick={() => setView(v.id)}
                      className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ${on ? 'text-white' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'}`}>
                      {on && <motion.span layoutId="mt-view" className="absolute inset-0 rounded-full" style={{ background: 'var(--acc)' }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                      <Icon className="relative h-3.5 w-3.5" /><span className="relative">{v.label}</span>
                    </button>
                  );
                })}
              </div>
            } />

          {view === 'list' && (
            <div className="relative text-[var(--theme-text)]">
              {TECHNIQUES.map((t, i) => <Row key={t.id} t={t} i={i} open={open.has(t.id)} onToggle={() => toggle(t.id)} flash={flash === t.id} />)}
              <Rule className="bottom-0" />
            </div>
          )}

          {view === 'cards' && (
            <div className="grid gap-4 md:grid-cols-2">
              {TECHNIQUES.map((t, i) => <CardItem key={t.id} t={t} i={i} open={open.has(t.id)} onToggle={() => toggle(t.id)} flash={flash === t.id} />)}
            </div>
          )}

          {view === 'scroll' && <Stack scrollRef={scrollRef} />}
        </section>

        {/* trade-offs at a glance */}
        <section id="tradeoffs" className="scroll-mt-28 space-y-6 pt-20 text-[var(--theme-text)]">
          <SectionHead n="04" title="Trade-offs at a glance" hint="What each technique protects, and what it costs you." />
          <div className="relative">
            <Rule className="top-0" />
            <div className="hidden grid-cols-[1.2fr_1fr_1fr] gap-6 py-3 font-mono text-[10px] uppercase tracking-wider text-[var(--theme-dim)] md:grid"><span>Technique</span><span>Protects</span><span>Costs</span></div>
            {TECHNIQUES.map((t, i) => (
              <motion.div key={t.id} initial={reduce ? false : { opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: i * 0.04 }}
                className="relative grid cursor-pointer gap-1 py-4 hover:bg-[var(--theme-secondary)] md:grid-cols-[1.2fr_1fr_1fr] md:gap-6" onClick={() => pickGoal(t.id)} role="button" tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pickGoal(t.id))}>
                <Rule className="top-0" />
                <span className="text-sm font-bold">{num(i)} · {t.name}</span>
                <span className="text-xs text-[var(--theme-muted)]"><b className="mr-1 text-[var(--theme-text)] md:hidden">Protects:</b>{t.protects}</span>
                <span className="text-xs text-[var(--theme-muted)]"><b className="mr-1 text-[var(--theme-text)] md:hidden">Costs:</b>{t.costs}</span>
              </motion.div>
            ))}
            <Rule className="bottom-0" />
          </div>
        </section>

        {/* closing call to action */}
        <section className="mt-24 space-y-6 text-center">
          <h2 className="text-[clamp(2rem,6vw,4rem)] font-black uppercase leading-[0.92] tracking-[-0.04em] text-[var(--theme-text)]">Ready to run it?</h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/" className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5" style={{ background: 'var(--acc)' }}>Start new job<ArrowRight className="h-4 w-4" /></Link>
            <button type="button" onClick={() => goTo('intro')} className="inline-flex items-center gap-2 rounded-full bg-[var(--theme-text)] px-6 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5" style={{ color: 'var(--theme-bg)' }}><ArrowUp className="h-4 w-4" />Back to top</button>
          </div>
          <p className="inline-flex items-center gap-2 text-xs text-[var(--theme-dim)]"><ShieldCheck className="h-3.5 w-3.5" />Nothing on this page changes your data. It only explains how it is protected.</p>
        </section>
      </div>
    </div>
  );
}