import React from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, SearchCheck, Sliders, PlayCircle, Award, Check } from 'lucide-react';
import { useWorkflowStore } from '../../store/useWorkflowStore';

const STEPS = [
  { id: 1, title: 'Upload', desc: 'Dataset Ingestion', icon: UploadCloud },
  { id: 2, title: 'File Analysis', desc: 'Pre-flight Profiling', icon: SearchCheck },
  { id: 3, title: 'Configure', desc: 'Privacy & Processing', icon: Sliders },
  { id: 4, title: 'Processing', desc: 'Zero-PII Pipeline', icon: PlayCircle },
  { id: 5, title: 'Results', desc: 'Audit & Analytics', icon: Award }
];

export default function WizardStepper() {
  const currentStep = useWorkflowStore((s) => s.currentStep);
  const setStep = useWorkflowStore((s) => s.setStep);
  const file = useWorkflowStore((s) => s.file);
  const isSample = useWorkflowStore((s) => s.isSample);
  const profileData = useWorkflowStore((s) => s.profileData);
  const activeJob = useWorkflowStore((s) => s.activeJob);
  const isProcessing = useWorkflowStore((s) => s.isProcessing);

  const isStepAccessible = (stepId) => {
    if (isProcessing) return false;
    if (stepId === 1) return true;
    if (stepId === 2) return Boolean(file || isSample || profileData);
    if (stepId === 3) return Boolean(profileData);
    if (stepId === 4) return Boolean(profileData);
    if (stepId === 5) return Boolean(activeJob);
    return false;
  };

  return (
    <div className="w-full bg-theme-card/75 backdrop-blur-xl border border-theme-border rounded-2xl p-4 sm:p-6 shadow-xl mb-8 relative overflow-hidden">
      {/* Ambient glowing accent wash */}
      <div className="absolute top-0 right-0 w-72 h-32 bg-theme-accent/5 rounded-full blur-3xl pointer-events-none" />

      {/* Cybernetic HUD Telemetry Header */}
      <div className="flex items-center justify-between text-xs text-theme-dim mb-5 px-1 font-mono">
        <nav aria-label="Wizard Breadcrumbs" className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="hover:text-theme-accent transition-colors cursor-pointer flex items-center gap-1.5"
            title="Return to Step 1 Upload"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-theme-accent animate-pulse" />
            <span className="font-semibold text-theme-text">Pipeline</span>
          </button>
          <span className="text-theme-dim/50">/</span>
          <span className="hidden sm:inline">5-Stage Gateway</span>
          <span className="text-theme-dim/50 hidden sm:inline">/</span>
          <span className="text-theme-accent font-bold drop-shadow-[0_0_8px_var(--accent-glow)]">
            Stage {currentStep}: {STEPS.find((s) => s.id === currentStep)?.title}
          </span>
        </nav>

        <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono px-2.5 py-1 rounded-full bg-theme-secondary/80 border border-theme-border text-theme-muted">
          <span>Target:</span>
          <span className="text-theme-text font-bold">
            {file?.name ? file.name.slice(0, 20) : isSample ? 'Sample Traffic NYC' : 'Awaiting Ingestion'}
          </span>
        </div>
      </div>

      <div className="relative flex items-center justify-between max-w-4xl mx-auto py-2">
        {/* Holographic Track Conduit Background */}
        <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-1.5 bg-theme-border/60 -z-0 rounded-full" />

        {/* Animated Active Holographic Progress Conduit */}
        <motion.div
          className="absolute top-1/2 left-6 -translate-y-1/2 h-1.5 bg-gradient-to-r from-theme-accent via-indigo-500 to-emerald-400 -z-0 rounded-full shadow-[0_0_15px_var(--accent-glow)]"
          initial={false}
          animate={{
            width: `${Math.max(0, ((currentStep - 1) / (STEPS.length - 1)) * 100)}%`
          }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />

        {/* Step Nodes */}
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const accessible = isStepAccessible(step.id);

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center">
              <button
                type="button"
                aria-label={`Step ${step.id}: ${step.title} (${step.desc})`}
                disabled={!accessible || isProcessing}
                onClick={() => accessible && setStep(step.id)}
                className={`relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl transition-all duration-300 font-semibold text-sm cursor-pointer ${
                  isCurrent
                    ? 'bg-theme-accent text-black font-extrabold shadow-[0_0_25px_var(--accent-glow)] ring-4 ring-theme-accent/25 scale-110 z-20'
                    : isCompleted
                    ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/40 hover:bg-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : accessible
                    ? 'bg-theme-secondary text-theme-muted border border-theme-border hover:border-theme-accent/60 hover:text-theme-text hover:-translate-y-0.5 hover:shadow-md'
                    : 'bg-theme-secondary/40 text-theme-dim border border-theme-border/40 cursor-not-allowed opacity-50'
                }`}
              >
                {/* Active pulse aura */}
                {isCurrent && (
                  <span className="absolute inset-0 rounded-xl bg-theme-accent animate-ping opacity-30 pointer-events-none" />
                )}

                {isCompleted ? (
                  <Check className="w-5 h-5 stroke-[2.5]" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}

                {/* Step Number Badge */}
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-theme-card border border-theme-border text-theme-text text-[10px] flex items-center justify-center font-mono font-bold shadow-sm">
                  {step.id}
                </span>
              </button>

              {/* Step Labels */}
              <div className="hidden sm:flex flex-col items-center mt-3 text-center">
                <span
                  className={`text-xs font-semibold tracking-tight transition-all duration-200 ${
                    isCurrent
                      ? 'text-theme-accent font-bold drop-shadow-[0_0_8px_var(--accent-glow)] scale-105'
                      : isCompleted
                      ? 'text-emerald-500 font-semibold'
                      : 'text-theme-muted'
                  }`}
                >
                  {step.title}
                </span>
                <span className="text-[10px] text-theme-dim mt-0.5 max-w-[105px] truncate font-mono">
                  {step.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
