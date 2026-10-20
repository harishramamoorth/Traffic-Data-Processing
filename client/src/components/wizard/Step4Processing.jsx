import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayCircle,
  CheckCircle2,
  Loader2,
  Terminal,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Database,
  Cpu,
  Layers,
  Sparkles,
  KeyRound,
  Check,
  FileSpreadsheet,
  FileCheck,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { useThemeStore } from '../../store/useThemeStore';
import PrivacyGateway3D from '../3d/PrivacyGateway3D';

const PIPELINE_STAGES = [
  {
    id: 'load',
    step: '01',
    name: 'Load & Ingest',
    desc: 'In-memory buffer stream',
    icon: Database,
    theme: {
      cube: 'from-blue-500 to-blue-700',
      pill: '#2563eb',
      bar: '#2563eb',
      border: 'rgba(37, 99, 235, 0.45)',
      glow: 'rgba(37, 99, 235, 0.18)',
      connector: 'bg-blue-600 shadow-blue-500/40',
    },
  },
  {
    id: 'detect_pii',
    step: '02',
    name: 'Detect PII',
    desc: 'Regex & NER identifiers',
    icon: FileCheck,
    theme: {
      cube: 'from-teal-400 to-emerald-600',
      pill: '#0d9488',
      bar: '#0d9488',
      border: 'rgba(13, 148, 136, 0.45)',
      glow: 'rgba(13, 148, 136, 0.18)',
      connector: 'bg-teal-500 shadow-teal-500/40',
    },
  },
  {
    id: 'clean',
    step: '03',
    name: 'Clean & Standardize',
    desc: 'Snake-case & duplicates',
    icon: Sparkles,
    theme: {
      cube: 'from-purple-500 to-indigo-600',
      pill: '#7c3aed',
      bar: '#7c3aed',
      border: 'rgba(124, 58, 237, 0.45)',
      glow: 'rgba(124, 58, 237, 0.18)',
      connector: 'bg-purple-600 shadow-purple-500/40',
    },
  },
  {
    id: 'anonymize',
    step: '04',
    name: 'Anonymize & Generalize',
    desc: 'HMAC-SHA256 & GPS floor',
    icon: KeyRound,
    theme: {
      cube: 'from-sky-500 to-blue-600',
      pill: '#0284c7',
      bar: '#0284c7',
      border: 'rgba(2, 132, 199, 0.45)',
      glow: 'rgba(2, 132, 199, 0.18)',
      connector: 'bg-blue-600 shadow-blue-500/40',
    },
  },
  {
    id: 'validate',
    step: '05',
    name: 'Quality Audits',
    desc: 'QC-01 through QC-09 audits',
    icon: ShieldCheck,
    theme: {
      cube: 'from-fuchsia-500 to-purple-600',
      pill: '#a855f7',
      bar: '#a855f7',
      border: 'rgba(168, 85, 247, 0.45)',
      glow: 'rgba(168, 85, 247, 0.18)',
      connector: 'bg-teal-500 shadow-teal-500/40',
    },
  },
  {
    id: 'save',
    step: '06',
    name: 'Sanitized Export',
    desc: 'Zero-PII file generation',
    icon: FileSpreadsheet,
    theme: {
      cube: 'from-teal-400 to-cyan-600',
      pill: '#059669',
      bar: '#059669',
      border: 'rgba(5, 150, 105, 0.45)',
      glow: 'rgba(5, 150, 105, 0.18)',
      connector: 'bg-emerald-500 shadow-emerald-500/40',
    },
  },
];

export default function Step4Processing() {
  const stageProgress = useWorkflowStore((s) => s.stageProgress);
  const liveLogs = useWorkflowStore((s) => s.liveLogs);
  const isProcessing = useWorkflowStore((s) => s.isProcessing);
  const activeJob = useWorkflowStore((s) => s.activeJob);
  const setStep = useWorkflowStore((s) => s.setStep);
  const themeColors = useThemeStore((s) => s.getThemeColors)();
  const themeAccent = themeColors?.primary || '#06b6d4';

  const terminalLogsRef = useRef(null);

  // Ensure view starts at the top of the page on mount
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  // Auto-scroll terminal container ONLY (never pull the browser window down)
  useEffect(() => {
    if (terminalLogsRef.current) {
      terminalLogsRef.current.scrollTop = terminalLogsRef.current.scrollHeight;
    }
  }, [liveLogs]);

  // Determine active stage index
  const getActiveStageIndex = () => {
    const s = stageProgress.stage;
    if (s === 'complete') return 6;
    if (s === 'save') return 5;
    if (s === 'validate') return 4;
    if (s === 'anonymize') return 3;
    if (s === 'clean') return 2;
    if (s === 'detect_pii') return 1;
    return 0;
  };

  const activeIndex = getActiveStageIndex();
  // Completion must come from the real workflow state, not merely an idle job.
  const isComplete = stageProgress?.stage === 'complete' && Number(stageProgress?.percent) >= 100;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-medium">
          <Loader2 className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
          <span>{isComplete ? 'Pipeline Completed Successfully' : 'Zero-PII Pipeline Active'}</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-text">
          Automated Privacy Engine & Quality Verification
        </h2>
        <p className="text-sm text-theme-muted max-w-lg mx-auto">
          Executing HMAC-SHA256 plate pseudonymization, data minimization, and QC-01 through QC-08 integrity audits.
        </p>
      </div>

      {/* 3D Privacy Gateway Particle Stream (Real-Time Stage Sync) */}
      <div className="rounded-2xl overflow-hidden border border-theme-border/80 bg-slate-950/95 shadow-2xl relative h-[280px] sm:h-[320px]">
        <div className="absolute top-3 left-4 z-10 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">
            Live Stream: {stageProgress.message || 'Transforming records...'}
          </span>
        </div>
        <PrivacyGateway3D stageProgress={stageProgress.percent} />
      </div>

      {/* 6-Stage Progress Pipeline Execution Sequence (Matching Reference Image) */}
      <div className="relative overflow-hidden rounded-[2rem] border border-theme-border/40 bg-transparent p-4 sm:p-6 space-y-7">
        {/* Subtle ambient light aura */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full opacity-[0.16] blur-3xl"
          style={{ background: themeAccent }}
        />

        {/* Header Bar matching Reference */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
          <div className="flex items-center gap-3.5">
            {/* 3D Hex/Squircle Icon */}
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-indigo-500 text-white shadow-[0_8px_20px_rgba(37,99,235,0.35)]">
              <span className="absolute inset-x-1.5 top-1 h-3 rounded-t-xl bg-white/30" />
              <Layers className="relative w-6 h-6 drop-shadow-md" />
            </div>

            {/* Vertical Accent Bar */}
            <div className="hidden sm:block h-9 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500 shadow-sm" />

            {/* Title & Subtitle */}
            <div>
              <h3 className="text-lg sm:text-xl font-black tracking-tight text-theme-text flex items-center gap-1.5 flex-wrap">
                <span>PIPELINE</span>
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-300 bg-clip-text text-transparent">
                  EXECUTION
                </span>
                <span>SEQUENCE</span>
              </h3>
              <p className="text-xs text-theme-muted font-medium mt-0.5">
                Real-time cryptographic pipeline stages and privacy enforcement
              </p>
            </div>
          </div>

          {/* Right Status Pill matching Reference */}
          <div className="flex items-center gap-3 self-start sm:self-auto rounded-2xl border border-theme-border/80 bg-theme-secondary/70 px-4 py-2 shadow-sm">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)]">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-theme-text">
                {isComplete ? 'All 6 Stages Completed' : `Stage ${Math.min(6, activeIndex + 1)} of 6 In Progress`}
              </div>
              <div className="text-[11px] font-mono font-semibold text-emerald-500">
                {stageProgress.percent}% Complete
              </div>
            </div>
          </div>
        </div>

        {/* Global Progress Bar matching Reference */}
        <div className="relative h-3 w-full bg-theme-secondary/80 rounded-full overflow-visible p-0.5 shadow-inner">
          <div className="relative h-full w-full rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400 rounded-full relative"
              initial={false}
              animate={{ width: `${Math.max(2, stageProgress.percent)}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {/* Continuous animated light sheen */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              />
            </motion.div>
          </div>

          {/* Right End Checkmark or Particle */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1.5 z-10">
            {stageProgress.percent >= 100 ? (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white border-2 border-white dark:border-slate-900 shadow-md">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            ) : (
              <div className="h-4 w-4 rounded-full bg-white shadow-[0_0_12px_#38bdf8,0_0_20px_#06b6d4]" />
            )}
          </div>
        </div>

        {/* Organic connected pipeline: animated orbs instead of rectangular cards */}
        <div className="relative pt-2 sm:pt-4">
          {/* Sleek, thin optical interconnect line that dynamically changes as processing advances */}
          <div className="pointer-events-none absolute left-[7%] right-[7%] top-[28px] z-0 hidden h-12 overflow-visible lg:block" aria-hidden="true">
            <svg viewBox="0 0 1000 48" preserveAspectRatio="none" className="h-full w-full overflow-visible">
              <defs>
                <filter id="pipeline-laser-glow" x="-40%" y="-200%" width="180%" height="500%">
                  <feGaussianBlur stdDeviation="1.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* Specific harmonic gradients for each interconnect segment */}
                {Array.from({ length: 5 }, (_, i) => (
                  <linearGradient key={`link-grad-${i}`} id={`link-grad-${i}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={PIPELINE_STAGES[i].theme.pill} />
                    <stop offset="100%" stopColor={PIPELINE_STAGES[i + 1].theme.pill} />
                  </linearGradient>
                ))}
              </defs>
              {Array.from({ length: 5 }, (_, i) => {
                const centers = [83.3, 250, 416.7, 583.3, 750, 916.7];
                // Connect cleanly from right perimeter of orb i to left perimeter of orb i+1
                const startX = centers[i] + 45;
                const endX = centers[i + 1] - 45;
                const d = `M ${startX} 24 L ${endX} 24`;

                // Dynamic pipeline states:
                // 1. Link is reached & verified once the destination stage is passed or job completes
                const linkIsReached = isComplete || activeIndex > i + 1;
                // 2. Link is actively streaming data when processing is entering destination stage (i + 1)
                const linkIsActive = !isComplete && (activeIndex === i + 1 || (activeIndex === 0 && i === 0)) && (isProcessing || Boolean(activeJob));
                // 3. Link is pending when pipeline hasn't reached it yet
                const linkIsPending = !linkIsReached && !linkIsActive;

                return (
                  <g key={`pipeline-conduit-${i}`}>
                    {/* Underlying hairline conduit */}
                    <path
                      d={d}
                      fill="none"
                      stroke={linkIsPending ? 'rgba(148, 163, 184, 0.2)' : `url(#link-grad-${i})`}
                      strokeWidth={linkIsActive ? 1.8 : linkIsReached ? 1.4 : 0.9}
                      strokeLinecap="round"
                      strokeDasharray={linkIsPending ? '2 4' : undefined}
                      opacity={linkIsReached ? 0.85 : linkIsActive ? 1 : 0.25}
                      filter={linkIsActive ? 'url(#pipeline-laser-glow)' : undefined}
                    />

                    {/* Active streaming laser sheen when processing is changing across this link */}
                    {linkIsActive && (
                      <path
                        d={d}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeDasharray="4 8"
                        filter="url(#pipeline-laser-glow)"
                      >
                        <animate
                          attributeName="stroke-dashoffset"
                          from="0"
                          to="-36"
                          dur="0.65s"
                          repeatCount="indefinite"
                        />
                      </path>
                    )}

                    {/* Fast data packets stream across the link when actively transferring */}
                    {linkIsActive && [0, 1].map((pkt) => (
                      <circle
                        key={`active-pkt-${pkt}`}
                        r={pkt === 0 ? 2.2 : 1.5}
                        fill={pkt === 0 ? '#ffffff' : '#67e8f9'}
                        filter="url(#pipeline-laser-glow)"
                      >
                        <animateMotion
                          path={d}
                          dur="0.8s"
                          begin={`${pkt * -0.4}s`}
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0;1;1;0"
                          keyTimes="0;0.1;0.9;1"
                          dur="0.8s"
                          begin={`${pkt * -0.4}s`}
                          repeatCount="indefinite"
                        />
                      </circle>
                    ))}

                    {/* Subtle steady micro-packet for verified completed links */}
                    {linkIsReached && (
                      <circle r="1.2" fill="#d1fae5" opacity="0.75">
                        <animateMotion
                          path={d}
                          dur="2.4s"
                          begin={`${i * -0.3}s`}
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="relative grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-6 lg:gap-2">
            {PIPELINE_STAGES.map((stg, i) => {
              const isStageComplete = activeIndex > i || (isComplete && activeIndex >= 6);
              const isStageCurrent = !isStageComplete && activeIndex === i && !isComplete;
              const StageIcon = stg.icon;
              const theme = stg.theme;
              const shapeRadii = [
                '42% 58% 54% 46% / 48% 43% 57% 52%',
                '53% 47% 44% 56% / 42% 55% 45% 58%',
                '47% 53% 58% 42% / 55% 44% 56% 45%',
                '56% 44% 48% 52% / 46% 57% 43% 54%',
                '44% 56% 52% 48% / 57% 45% 55% 43%',
                '51% 49% 43% 57% / 48% 56% 44% 52%',
              ];

              return (
                <motion.div
                  key={stg.id}
                  initial={{ opacity: 0, y: 16, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.55, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] }}
                  className="relative z-[1] flex min-w-0 flex-col items-center text-center"
                >
                  {/* The orb */}
                  <motion.div
                    animate={isStageCurrent
                      ? { scale: [1, 1.055, 1], y: [0, -3, 0] }
                      : { scale: isStageComplete ? 1 : 0.94, y: 0 }}
                    transition={isStageCurrent
                      ? { duration: 2.1, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.55, ease: 'easeOut' }}
                    className="relative flex h-[94px] w-[94px] items-center justify-center sm:h-[104px] sm:w-[104px]"
                    style={{ filter: isStageCurrent ? `drop-shadow(0 0 18px ${theme.glow})` : isStageComplete && isComplete ? `drop-shadow(0 0 12px ${theme.glow})` : undefined }}
                  >
                    {isStageCurrent && (
                      <motion.div
                        className="absolute inset-[-7px] rounded-full border"
                        style={{ borderColor: theme.pill }}
                        animate={{ scale: [0.92, 1.16, 0.92], opacity: [0.65, 0, 0.65] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                      />
                    )}
                    <motion.div
                      className="absolute inset-0"
                      style={{
                        borderRadius: shapeRadii[i],
                        background: `radial-gradient(circle at 30% 24%, rgba(255,255,255,${isStageComplete || isStageCurrent ? '.32' : '.13'}), transparent 32%), linear-gradient(145deg, ${theme.pill}${isStageCurrent ? '' : 'cc'}, ${theme.pill}88)`,
                        border: `1px solid ${isStageCurrent || isStageComplete ? theme.border : 'rgba(148,163,184,.22)'}`,
                        boxShadow: isStageCurrent
                          ? `0 0 0 1px ${theme.pill}33, 0 0 30px ${theme.glow}, inset 0 1px 18px rgba(255,255,255,.18)`
                          : isStageComplete
                          ? `0 8px 26px ${theme.glow}, inset 0 1px 14px rgba(255,255,255,.14)`
                          : '0 8px 22px rgba(15,23,42,.07), inset 0 1px 12px rgba(255,255,255,.12)',
                        opacity: isStageComplete || isStageCurrent ? 1 : 0.62,
                      }}
                      animate={isStageCurrent ? { rotate: [0, 2, -2, 0] } : { rotate: 0 }}
                      transition={{ duration: 5, repeat: isStageCurrent ? Infinity : 0, ease: 'easeInOut' }}
                    />
                    {/* Particle flecks */}
                    {(isStageCurrent || isStageComplete) && [0, 1, 2, 3, 4, 5].map((dot) => (
                      <motion.span
                        key={dot}
                        className="absolute h-1 w-1 rounded-full bg-white"
                        style={{ left: `${17 + ((dot * 13) % 68)}%`, top: `${18 + ((dot * 17) % 64)}%`, boxShadow: `0 0 8px ${theme.pill}` }}
                        animate={{ y: [0, dot % 2 ? -9 : 8, 0], x: [0, dot % 2 ? 5 : -5, 0], opacity: [0.15, 0.95, 0.15], scale: [0.7, 1.3, 0.7] }}
                        transition={{ duration: 1.8 + dot * 0.16, delay: dot * 0.12, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    ))}
                    <motion.div
                      className="relative z-[1] flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-slate-950/10 text-white backdrop-blur-sm sm:h-[62px] sm:w-[62px]"
                      animate={isStageCurrent ? { boxShadow: ['0 0 0 rgba(255,255,255,0)', '0 0 22px rgba(255,255,255,.24)', '0 0 0 rgba(255,255,255,0)'] } : { boxShadow: '0 0 0 rgba(255,255,255,0)' }}
                      transition={{ duration: 1.8, repeat: isStageCurrent ? Infinity : 0 }}
                    >
                      <StageIcon className="h-7 w-7 drop-shadow-md sm:h-8 sm:w-8" strokeWidth={1.8} />
                    </motion.div>
                    <div className="absolute -right-0.5 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-theme-card bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,.5)]">
                      {isStageComplete ? <Check className="h-4 w-4 stroke-[3]" /> : isStageCurrent ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="h-2 w-2 rounded-full bg-white/80" />}
                    </div>
                    <span className="absolute -left-1 bottom-1 z-10 rounded-full border border-white/20 bg-theme-card/90 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-theme-text shadow-sm backdrop-blur">{stg.step}</span>
                  </motion.div>

                  {/* Labels remain outside the organic shape for clarity */}
                  <div className="mt-3 max-w-[150px]">
                    <h4 className="text-xs font-extrabold leading-snug text-theme-text sm:text-sm">{stg.name}</h4>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-theme-muted sm:text-[11px]">{stg.desc}</p>
                    <div className="mx-auto mt-3 flex items-center justify-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isStageComplete ? '#10b981' : isStageCurrent ? theme.pill : 'rgba(148,163,184,.55)' }} />
                      <span className="text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: isStageComplete ? '#10b981' : isStageCurrent ? theme.pill : 'var(--theme-muted, #94a3b8)' }}>
                        {isStageComplete ? 'Passed' : isStageCurrent ? 'Processing' : 'Queued'}
                      </span>
                    </div>
                  </div>

                  {/* Mobile connector */}
                  {i < PIPELINE_STAGES.length - 1 && i % 2 === 0 && (
                    <motion.div className="absolute -right-3 top-[42px] z-20 hidden h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-theme-card/90 text-cyan-500 shadow-md sm:flex lg:hidden"
                      animate={{ scale: [0.92, 1.08, 0.92] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.15 }}>
                      <ChevronRight className="h-4 w-4" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-theme-border/50 pt-4">
            <div className="flex items-center gap-2 text-[11px] text-theme-muted">
              <span className={`h-2 w-2 rounded-full ${isProcessing ? 'animate-pulse bg-cyan-400' : 'bg-emerald-400'}`} />
              <span>{isComplete ? 'All six stages verified · secure data flow connected' : stageProgress.message || 'Waiting for pipeline events'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Live Log Stream (JetBrains Mono / Terminal Feel) */}
      <div className="rounded-2xl bg-black/95 border border-theme-border overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-theme-border text-xs font-mono">
          <div className="flex items-center gap-2 text-theme-muted">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Server-Sent Events (SSE) Audit Stream</span>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] text-theme-dim">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </span>
        </div>

        <div
          ref={terminalLogsRef}
          className="p-4 h-56 overflow-y-auto font-mono text-xs text-theme-muted space-y-1.5 scrollbar-thin"
        >
          {liveLogs.length === 0 ? (
            <div className="text-theme-dim italic">Awaiting pipeline stream events from Python runner...</div>
          ) : (
            liveLogs.map((log, index) => (
              <div key={index} className="flex items-start gap-2 leading-relaxed">
                <span className="text-cyan-500/70 select-none">&gt;</span>
                <span className={log.includes('complete') ? 'text-emerald-300 font-semibold' : 'text-slate-300'}>
                  {log}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Completion Action */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/40 shadow-xl"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-theme-text">Zero-PII Dataset Ready for Exploration</h3>
              <p className="text-xs text-theme-muted">
                Quality audits passed. Temporary uploaded files have been deleted.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep(5)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-black text-xs font-bold shadow-lg shadow-emerald-500/30 transition-all duration-200 cursor-pointer"
          >
            <span>View Detailed Results & Downloads</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
