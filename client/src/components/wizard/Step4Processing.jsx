import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  PlayCircle,
  CheckCircle2,
  Loader2,
  Terminal,
  ShieldCheck,
  ArrowRight,
  Database,
  Cpu,
  Layers,
  Sparkles
} from 'lucide-react';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import PrivacyGateway3D from '../3d/PrivacyGateway3D';

const PIPELINE_STAGES = [
  { id: 'load', name: 'Load & Ingest', desc: 'In-memory buffer ingestion' },
  { id: 'detect_pii', name: 'Detect PII', desc: 'Scan regex & NER identifiers' },
  { id: 'clean', name: 'Clean & Standardize', desc: 'Snake-case & duplicate audit' },
  { id: 'anonymize', name: 'Anonymize & Generalize', desc: 'HMAC-SHA256 & GPS floor' },
  { id: 'validate', name: 'Quality Audits', desc: 'Run QC-01 through QC-08' },
  { id: 'save', name: 'Sanitized Export', desc: 'Zero raw storage guarantee' }
];

export default function Step4Processing() {
  const stageProgress = useWorkflowStore((s) => s.stageProgress);
  const liveLogs = useWorkflowStore((s) => s.liveLogs);
  const isProcessing = useWorkflowStore((s) => s.isProcessing);
  const activeJob = useWorkflowStore((s) => s.activeJob);
  const setStep = useWorkflowStore((s) => s.setStep);

  const logsEndRef = useRef(null);

  // Auto-scroll terminal logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
  const isComplete = !isProcessing && Boolean(activeJob);

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

      {/* 6-Stage Progress Pipeline */}
      <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-theme-text">
              Pipeline Execution Sequence
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-cyan-400">
            {stageProgress.percent}% Complete
          </span>
        </div>

        {/* Global Progress Bar */}
        <div className="h-2 w-full bg-theme-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 rounded-full"
            initial={false}
            animate={{ width: `${stageProgress.percent}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Stage Nodes Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {PIPELINE_STAGES.map((stg, i) => {
            const isStageComplete = activeIndex > i;
            const isStageCurrent = activeIndex === i;

            return (
              <div
                key={stg.id}
                className={`p-3 rounded-xl border transition-all duration-300 flex flex-col justify-between ${
                  isStageComplete
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : isStageCurrent
                    ? 'bg-cyan-500/15 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400'
                    : 'bg-theme-secondary/40 border-theme-border/50 text-theme-dim opacity-70'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-semibold">0{i + 1}</span>
                  {isStageComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isStageCurrent ? (
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border border-theme-border" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-theme-text truncate">{stg.name}</h4>
                  <p className="text-[10px] text-theme-dim mt-0.5 leading-snug truncate">{stg.desc}</p>
                </div>
              </div>
            );
          })}
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

        <div className="p-4 h-56 overflow-y-auto font-mono text-xs text-theme-muted space-y-1.5 scrollbar-thin">
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
          <div ref={logsEndRef} />
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
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-black text-xs font-bold shadow-lg shadow-emerald-500/30 transition-all duration-200"
          >
            <span>View Detailed Results & Downloads</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
