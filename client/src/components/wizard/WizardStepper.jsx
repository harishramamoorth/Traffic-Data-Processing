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
  const activeJob = useWorkflowStore((s) => s.activeJob);
  const isProcessing = useWorkflowStore((s) => s.isProcessing);

  const isStepAccessible = (stepId) => {
    if (isProcessing) return false;
    if (stepId === 1) return true;
    if (stepId === 2) return Boolean(file || isSample);
    if (stepId === 3) return Boolean(file || isSample);
    if (stepId === 4) return Boolean(file || isSample);
    if (stepId === 5) return Boolean(activeJob);
    return false;
  };

  return (
    <div className="w-full bg-theme-card/60 backdrop-blur-md border border-theme-border rounded-2xl p-4 sm:p-5 shadow-lg mb-8">
      <div className="relative flex items-center justify-between max-w-4xl mx-auto">
        {/* Progress Background Track */}
        <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-1 bg-theme-border/60 -z-0 rounded-full" />

        {/* Animated Active Progress Fill */}
        <motion.div
          className="absolute top-1/2 left-6 -translate-y-1/2 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 -z-0 rounded-full"
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
                disabled={!accessible || isProcessing}
                onClick={() => accessible && setStep(step.id)}
                className={`relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl transition-all duration-300 font-semibold text-sm ${
                  isCurrent
                    ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.6)] ring-4 ring-cyan-500/20 scale-105'
                    : isCompleted
                    ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/25'
                    : accessible
                    ? 'bg-theme-secondary text-theme-muted border border-theme-border hover:border-theme-accent/50 hover:text-theme-text shadow-sm'
                    : 'bg-theme-secondary/40 text-theme-dim border border-theme-border/40 cursor-not-allowed opacity-60'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5 stroke-[2.5]" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}

                {/* Step Number Badge */}
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-900 border border-theme-border text-white text-[10px] flex items-center justify-center font-mono font-bold shadow-sm">
                  {step.id}
                </span>
              </button>

              {/* Step Labels */}
              <div className="hidden sm:flex flex-col items-center mt-2.5 text-center">
                <span
                  className={`text-xs font-semibold tracking-tight transition-colors ${
                    isCurrent
                      ? 'text-cyan-400 font-bold'
                      : isCompleted
                      ? 'text-emerald-500 font-semibold'
                      : 'text-theme-text/80'
                  }`}
                >
                  {step.title}
                </span>
                <span className="text-[10px] text-theme-dim mt-0.5 max-w-[100px] truncate">
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
