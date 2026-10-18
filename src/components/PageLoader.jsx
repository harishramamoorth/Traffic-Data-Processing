import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Activity, Cpu, Sparkles } from 'lucide-react';

const DEFAULT_STEPS = [
  'Connecting to traffic telemetry engine...',
  'Analyzing quasi-identifier linkages...',
  'Evaluating k-anonymity boundaries...',
  'Verifying zero-PII security protocols...',
  'Rendering optimized analytical pipeline...'
];

/**
 * PageLoader - High-efficiency, premium animated loading indicator.
 * Variants:
 *  - 'full': Full-page overlay with radar rings, glowing orbital particles, and telemetry status
 *  - 'card': Embedded container with pulsating beacon and sleek status ticker
 *  - 'minimal': Sleek horizontal loader with pulsing beacon
 *  - 'inline': Small inline spinner with text
 */
export default function PageLoader({
  variant = 'card',
  title = 'Loading Telemetry Data...',
  subtitle = 'Please wait while records are verified and prepared',
  steps = DEFAULT_STEPS,
  className = ''
}) {
  const [currentStep, setCurrentStep] = useState(0);

  // Cycle through telemetry steps efficiently
  useEffect(() => {
    if (!steps || steps.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [steps]);

  // Variant 1: Minimal inline loader
  if (variant === 'minimal') {
    return (
      <div className={`flex items-center justify-center gap-3 py-8 ${className}`}>
        <div className="relative w-6 h-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        </div>
        <span className="text-xs font-mono text-theme-muted tracking-wide animate-pulse">
          {title}
        </span>
      </div>
    );
  }

  // Variant 2: Full Screen Overlay
  if (variant === 'full') {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl ${className}`}>
        <div className="relative flex flex-col items-center justify-center p-8 max-w-md w-full text-center space-y-6">
          {/* Animated Radar Beacon */}
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* Concentric expanding ripple waves */}
            <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping opacity-25" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-2 rounded-full border border-blue-500/20 animate-ping opacity-20" style={{ animationDuration: '2.4s', animationDelay: '0.4s' }} />
            <div className="absolute inset-4 rounded-full border border-emerald-500/20 animate-ping opacity-15" style={{ animationDuration: '2s', animationDelay: '0.8s' }} />

            {/* Rotating gradient orbital track */}
            <div className="absolute inset-0 rounded-full border border-cyan-500/20 border-t-cyan-400 border-r-blue-500 animate-spin" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-3 rounded-full border border-blue-500/10 border-b-emerald-400 animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }} />

            {/* Glowing Core */}
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-blue-500/20 to-emerald-500/20 border border-cyan-500/40 backdrop-blur-md flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <ShieldCheck className="w-8 h-8 text-cyan-400 animate-pulse" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
          </div>

          {/* Titles & Messages */}
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-theme-muted">{subtitle}</p>
          </div>

          {/* Dynamic Cycling Telemetry Step Ticker */}
          <div className="h-6 overflow-hidden flex items-center justify-center w-full">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentStep}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="text-[11px] font-mono text-cyan-300/90 flex items-center gap-1.5"
              >
                <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
                <span>{steps[currentStep]}</span>
              </motion.span>
            </AnimatePresence>
          </div>

          {/* High-Tech Shimmer Bar */}
          <div className="w-48 h-1 bg-theme-secondary rounded-full overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400 to-transparent w-1/2 animate-[shimmer_1.5s_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  // Variant 3: Card Embedded (Default)
  return (
    <div className={`p-8 rounded-2xl bg-theme-card/60 border border-theme-border flex flex-col items-center justify-center text-center space-y-5 my-4 relative overflow-hidden ${className}`}>
      {/* Ambient background glow */}
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Radar rings */}
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping opacity-25" style={{ animationDuration: '2.5s' }} />
        <div className="absolute inset-1 rounded-full border border-cyan-500/20 border-t-cyan-400 animate-spin" style={{ animationDuration: '2s' }} />
        <div className="absolute inset-3 rounded-full border border-blue-500/20 border-b-emerald-400 animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }} />
        
        <div className="relative w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-blue-500/20 to-theme-card border border-cyan-500/40 flex items-center justify-center shadow-md shadow-cyan-500/20">
          <Activity className="w-6 h-6 text-cyan-400 animate-pulse" />
        </div>
      </div>

      <div className="space-y-1.5 z-10 max-w-sm">
        <h4 className="text-sm font-bold text-theme-text">{title}</h4>
        <p className="text-xs text-theme-dim">{subtitle}</p>
      </div>

      {/* Cycling Telemetry Ticker */}
      <div className="h-5 overflow-hidden flex items-center justify-center z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400/90"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>{steps[currentStep]}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Glowing Progress Shimmer */}
      <div className="w-36 h-1 bg-theme-secondary/80 rounded-full overflow-hidden relative z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400 to-transparent w-1/2 animate-[shimmer_1.4s_infinite]" />
      </div>
    </div>
  );
}
