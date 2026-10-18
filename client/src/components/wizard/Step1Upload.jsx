import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  FileSpreadsheet,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  X,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { useToast } from '../Toast';
import axios from 'axios';

const MAX_SIZE_MB = 50;
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;

const TOUR_STEPS = [
  {
    title: '1. Zero-Storage Ingestion',
    desc: 'Upload or load road traffic telemetry (.csv or .json). Staging files reside strictly in temporary RAM and are scrubbed immediately after processing.'
  },
  {
    title: '2. Deep Schema & PII Profiling',
    desc: 'The engine scans column headers and values to identify direct identifiers (plates, names, emails, phones) and quasi-identifiers (GPS, timestamps).'
  },
  {
    title: '3. Privacy vs. Utility Tuning',
    desc: 'Fine-tune HMAC pseudonymization, spatial truncation (GPS decimal rounding), time-bucketing, and k-anonymity suppression with live score calculations.'
  },
  {
    title: '4. Reconciled Audit & Results',
    desc: 'Every single record is accounted for (input = output + rejected + duplicates) with zero silent data loss and formal markdown compliance attestations.'
  }
];

export default function Step1Upload() {
  const { addToast } = useToast();
  const setFile = useWorkflowStore((s) => s.setFile);
  const setProfileData = useWorkflowStore((s) => s.setProfileData);
  const setIsProfiling = useWorkflowStore((s) => s.setIsProfiling);
  const setStep = useWorkflowStore((s) => s.setStep);

  const [loading, setLoading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadError, setUploadError] = useState(null); // { message, file, isSample }

  // Guided intro (3-4 tooltips) on first visit (Item 19)
  const [showTour, setShowTour] = useState(() => {
    try {
      return !localStorage.getItem('traffic_wizard_tour_completed');
    } catch {
      return true;
    }
  });
  const [tourIndex, setTourIndex] = useState(0);

  const dismissTour = () => {
    setShowTour(false);
    try {
      localStorage.setItem('traffic_wizard_tour_completed', 'true');
    } catch {}
  };

  const profileFile = async (selectedFile, isSample = false) => {
    setLoading(true);
    setIsProfiling(true);
    setUploadPercent(10);
    setUploadError(null);

    const formData = new FormData();
    if (isSample) {
      formData.append('sample', 'true');
    } else if (selectedFile) {
      formData.append('file', selectedFile);
    }

    try {
      setFile(selectedFile, isSample);
      setUploadPercent(45);

      const res = await axios.post('/api/jobs/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadPercent(Math.min(90, Math.max(10, pct)));
          }
        }
      });

      setUploadPercent(100);
      if (res.data?.profile) {
        setProfileData(res.data.profile);
        addToast({
          type: 'success',
          title: isSample ? 'Sample Dataset Loaded' : 'Dataset Profiled',
          message: isSample ? 'Loaded built-in 527-record sample traffic dataset.' : `Dataset '${selectedFile.name}' profiled successfully.`
        });
        // Move to Step 2 (File Analysis)
        setStep(2);
      } else {
        throw new Error('No profile data returned from server');
      }
    } catch (err) {
      console.error('Profiling error:', err);
      const isNetwork = !err.response && Boolean(err.message);
      const msg = isNetwork
        ? 'Backend server appears unreachable or down. Please ensure the server is running on port 5000.'
        : err.response?.data?.error || err.message || 'Failed to inspect file';

      setUploadError({
        message: msg,
        file: selectedFile,
        isSample
      });

      addToast({
        type: 'error',
        title: 'Inspection Failed',
        message: msg
      });
      setFile(null, false);
      setIsProfiling(false);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles, rejectedFiles) => {
      setUploadError(null);
      if (rejectedFiles && rejectedFiles.length > 0) {
        const rej = rejectedFiles[0];
        let errMsg = 'Invalid file format. Please upload a .csv or .json dataset.';
        if (rej.size > MAX_BYTES) {
          errMsg = `File exceeds ${MAX_SIZE_MB}MB limit.`;
        }
        setUploadError({ message: errMsg, file: null, isSample: false });
        addToast({ type: 'error', title: 'File Rejected', message: errMsg });
        return;
      }

      if (acceptedFiles && acceptedFiles.length > 0) {
        const f = acceptedFiles[0];
        if (f.size === 0) {
          const errMsg = 'The uploaded file is empty (0 bytes). Please upload a dataset with traffic telemetry records.';
          setUploadError({ message: errMsg, file: f, isSample: false });
          addToast({ type: 'error', title: 'Empty File', message: errMsg });
          return;
        }
        profileFile(f, false);
      }
    },
    [addToast]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'text/plain': ['.csv', '.json']
    },
    maxSize: MAX_BYTES,
    multiple: false,
    disabled: loading
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Title & Privacy Guarantee Header */}
      <div className="text-center space-y-2 relative">
        <div className="flex items-center justify-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Zero-Storage Pre-Flight Guarantee</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setTourIndex(0);
              setShowTour(true);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-theme-secondary border border-theme-border text-[11px] text-theme-muted hover:text-cyan-400 transition-colors"
            title="Open guided tour instructions"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Quick Tour</span>
          </button>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-text">
          Upload Road Traffic Telemetry Dataset
        </h2>
        <p className="text-sm text-theme-muted max-w-xl mx-auto">
          Files are profiled entirely in-memory to detect schema, PII, and anomalies. No raw records are stored to disk or MongoDB.
        </p>
      </div>

      {/* Guided Intro Banner (3-4 Tooltips on first visit, Item 19) */}
      <AnimatePresence>
        {showTour && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-cyan-500/5"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold font-mono shrink-0">
                {tourIndex + 1}
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-cyan-300">
                  {TOUR_STEPS[tourIndex].title}
                </span>
                <p className="text-xs text-theme-muted leading-relaxed">
                  {TOUR_STEPS[tourIndex].desc}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {tourIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setTourIndex((i) => Math.max(0, i - 1))}
                  className="p-1.5 rounded-lg bg-theme-secondary border border-theme-border text-xs text-theme-muted hover:text-white"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}

              {tourIndex < TOUR_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setTourIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1))}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={dismissTour}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 text-black text-xs font-bold hover:bg-cyan-400"
                >
                  Got It
                </button>
              )}

              <button
                type="button"
                onClick={dismissTour}
                className="p-1.5 rounded-lg text-theme-dim hover:text-theme-muted"
                title="Dismiss tour"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear error message with a retry for failures (Item 19) */}
      {uploadError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-rose-300">File Ingestion / Inspection Error</span>
              <p className="text-xs text-theme-muted leading-relaxed">
                {uploadError.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (uploadError.isSample) {
                  profileFile(null, true);
                } else if (uploadError.file) {
                  profileFile(uploadError.file, false);
                } else {
                  setUploadError(null);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs font-bold text-rose-300 hover:bg-rose-500/30 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Inspection</span>
            </button>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="p-1.5 text-theme-dim hover:text-theme-muted"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Drag & Drop Zone */}
      <motion.div
        whileHover={{ scale: loading ? 1 : 1.005 }}
        transition={{ duration: 0.2 }}
        className="relative"
      >
        <div
          {...getRootProps()}
          className={`relative overflow-hidden cursor-pointer rounded-2xl border-2 border-dashed p-10 sm:p-14 text-center transition-all duration-300 ${
            isDragActive && !isDragReject
              ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
              : isDragReject
              ? 'border-rose-500 bg-rose-500/10'
              : 'border-theme-border bg-theme-card/70 hover:border-cyan-500/50 hover:bg-theme-card/90'
          }`}
        >
          <input {...getInputProps()} />

          {/* Animated Glow Effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent pointer-events-none" />

          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              {/* Progress Ring */}
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-theme-border"
                    fill="transparent"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-cyan-400 transition-all duration-300"
                    fill="transparent"
                    strokeDasharray={213}
                    strokeDashoffset={213 - (213 * uploadPercent) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute font-mono text-sm font-bold text-cyan-300">
                  {uploadPercent}%
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-theme-text animate-pulse">
                  Analyzing dataset in memory...
                </p>
                <p className="text-xs text-theme-muted">
                  Generating pre-flight audit and PII risk assessment
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                <UploadCloud className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <p className="text-base font-semibold text-theme-text">
                  Drop your CSV or JSON dataset here, or{' '}
                  <span className="text-cyan-400 underline underline-offset-4">browse</span>
                </p>
                <p className="text-xs text-theme-muted">
                  Supports up to 50MB files (e.g. coordinates, timestamps, vehicle plates, speeds)
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-theme-secondary text-[11px] font-mono text-theme-muted border border-theme-border">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                  .CSV
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-theme-secondary text-[11px] font-mono text-theme-muted border border-theme-border">
                  <span className="font-bold text-blue-400">&#123;&#125;</span>
                  .JSON
                </span>
                <span className="text-xs text-theme-dim">•</span>
                <span className="text-xs text-theme-muted">Max 50MB</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Load Sample Dataset Button (Item 21) */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
        <button
          type="button"
          disabled={loading}
          onClick={() => profileFile(null, true)}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-theme-card to-theme-secondary hover:border-cyan-500/60 border border-theme-border text-cyan-400 hover:text-cyan-300 font-bold text-xs transition-all shadow-lg hover:shadow-cyan-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
          title={loading ? "Analyzing dataset..." : "Loads pre-packaged 527-record sample traffic telemetry dataset"}
        >
          <Sparkles className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          <span>Load Sample Dataset (527 Records)</span>
        </button>
        <span className="text-xs text-theme-dim">
          Instant demo with real plates, GPS coordinates, timestamps & speeds
        </span>
      </div>

      {/* Real-World Data Telemetry Guidelines & Security Guarantee */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5 rounded-2xl bg-theme-card/60 border border-theme-border">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-theme-text">Adaptive Schema Detection</h4>
            <p className="text-[11px] text-theme-dim mt-0.5 leading-relaxed">
              Auto-detects vehicle plates, timestamps, GPS coordinates, speed, and comments across any CSV or JSON.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-theme-text">Zero Raw Retention</h4>
            <p className="text-[11px] text-theme-dim mt-0.5 leading-relaxed">
              Uploaded files are held temporarily in memory and scrubbed immediately from RAM and disk after profiling.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-theme-text">QC-01 Reconciliation</h4>
            <p className="text-[11px] text-theme-dim mt-0.5 leading-relaxed">
              Every single dropped or transformed record is audited with an exact reason so zero data is lost silently.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
