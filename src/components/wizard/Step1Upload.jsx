import React, { useCallback, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  FileSpreadsheet,
  Database,
  Play,
  Scale,
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
import PageLoader from '../PageLoader';

const MAX_SIZE_MB = 50;
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;

const PROFILING_STEPS = [
  { label: 'INGESTING · TELEMETRY DATASET', pct: 15 },
  { label: 'PARSING · SCHEMA & ATTRIBUTES', pct: 35 },
  { label: 'SCANNING · PII & IDENTIFIERS', pct: 60 },
  { label: 'CALCULATING · RISK & K-ANONYMITY', pct: 82 },
  { label: 'PREPARING · ANALYSIS GATEWAY', pct: 100 },
];

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const pendingProfileRef = useRef(null);
  const loaderDoneRef = useRef(false);

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

  const finishProfiling = useCallback((pendingData) => {
    const data = pendingData || pendingProfileRef.current;
    if (!data?.profile) return;
    setProfileData(data.profile);
    addToast({
      type: 'success',
      title: data.isSample ? 'Sample Dataset Loaded' : 'Dataset Profiled',
      message: data.isSample ? 'Loaded built-in 527-record sample traffic dataset.' : `Dataset '${data.fileName || 'file'}' profiled successfully.`
    });
    setStep(2);
    setIsAnalyzing(false);
    setIsProfiling(false);
    setLoading(false);
  }, [addToast, setProfileData, setIsProfiling, setStep]);

  const handleLoaderComplete = useCallback(() => {
    loaderDoneRef.current = true;
    if (pendingProfileRef.current) {
      finishProfiling(pendingProfileRef.current);
    }
  }, [finishProfiling]);

  const profileFile = async (selectedFile, isSample = false, targetSheet = null) => {
    setLoading(true);
    setIsProfiling(true);
    setIsAnalyzing(true);
    pendingProfileRef.current = null;
    loaderDoneRef.current = false;
    setUploadPercent(10);
    setUploadError(null);

    const formData = new FormData();
    if (isSample) {
      formData.append('sample', 'true');
    } else if (selectedFile) {
      formData.append('file', selectedFile);
    }
    if (targetSheet) {
      formData.append('sheet', targetSheet);
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
        const payload = {
          profile: res.data.profile,
          isSample,
          fileName: selectedFile?.name
        };
        finishProfiling(payload);
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
      setIsAnalyzing(false);
      setLoading(false);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles, rejectedFiles) => {
      setUploadError(null);
      if (rejectedFiles && rejectedFiles.length > 0) {
        const rej = rejectedFiles[0];
        let errMsg = 'Invalid file format. Please upload a .csv, .tsv, .txt, .json, .xlsx, or .xls dataset.';
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
      'text/tab-separated-values': ['.tsv'],
      'text/plain': ['.csv', '.tsv', '.txt', '.json'],
      'application/json': ['.json'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls', '.xlsx']
    },
    maxSize: MAX_BYTES,
    multiple: false,
    disabled: loading
  });

  if (isAnalyzing) {
    return (
      <PageLoader
        variant="hud"
        title="Analyzing"
        titleAccent="Dataset"
        subtitle="SCANNING PII · PROFILING TELEMETRY"
        steps={PROFILING_STEPS}
        duration={1200}
        onComplete={handleLoaderComplete}
      />
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Title & Privacy Header */}
      <div className="text-center space-y-2 relative">
        <div className="flex items-center justify-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-card border border-theme-border text-theme-dim text-xs font-medium shadow-sm">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span>Pre-Flight Privacy Verification</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setTourIndex(0);
              setShowTour(true);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-theme-card border border-theme-border text-[11px] text-theme-muted hover:text-theme-text shadow-sm transition-colors cursor-pointer"
            title="Open guided tour instructions"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
            <span>Quick Tour</span>
          </button>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-text">
          Upload Road Traffic Telemetry Dataset
        </h2>
        <p className="text-xs sm:text-sm text-theme-muted max-w-xl mx-auto">
          Files are profiled entirely in-memory to detect schema, PII, and anomalies. No raw records are stored to disk or MongoDB.
        </p>
      </div>

      {/* Guided Intro Banner */}
      <AnimatePresence>
        {showTour && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-xl bg-theme-card border border-theme-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold font-mono text-xs shrink-0">
                {tourIndex + 1}
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-theme-text">
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
                  className="p-1.5 rounded-lg bg-theme-secondary border border-theme-border text-xs text-theme-muted hover:text-theme-text cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}

              {tourIndex < TOUR_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setTourIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1))}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={dismissTour}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  Got It
                </button>
              )}

              <button
                type="button"
                onClick={dismissTour}
                className="p-1.5 rounded-lg text-theme-dim hover:text-theme-muted cursor-pointer"
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

      {/* Dual Ingestion Hub: Custom Upload + Instant Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Custom Dataset Dropzone (8 cols) */}
        <div className="lg:col-span-8">
          <motion.div
            whileHover={{ scale: loading ? 1 : 1.002 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <div
              {...getRootProps()}
              className={`h-full min-h-[240px] flex flex-col items-center justify-center relative overflow-hidden cursor-pointer rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all shadow-sm ${
                isDragActive && !isDragReject
                  ? 'border-theme-accent bg-theme-accent/10 shadow-theme-glow'
                  : isDragReject
                  ? 'border-rose-500 bg-rose-50/10'
                  : 'border-theme-border bg-theme-card hover:border-theme-accent/60 hover:bg-theme-secondary/40'
              }`}
            >
              <input {...getInputProps()} />

              {loading ? (
                <div className="flex flex-col items-center justify-center space-y-4">
                  {/* Progress Ring */}
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="5"
                        className="text-theme-border"
                        fill="transparent"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="5"
                        className="text-theme-accent transition-all duration-300"
                        fill="transparent"
                        strokeDasharray={176}
                        strokeDashoffset={176 - (176 * uploadPercent) / 100}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute font-mono text-xs font-bold text-theme-accent">
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
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-theme-secondary border border-theme-border flex items-center justify-center text-theme-accent shadow-sm">
                    <UploadCloud className="w-6 h-6" />
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm sm:text-base font-semibold text-theme-text">
                      Drop your dataset here, or{' '}
                      <span className="text-theme-accent font-bold underline underline-offset-4 hover:opacity-80">browse</span>
                    </p>
                    <p className="text-xs text-theme-muted max-w-md mx-auto">
                      Multi-format ingestion: CSV, TSV, TXT, JSON, Excel (.xlsx, .xls) up to 50MB
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                    {['.CSV', '.TSV', '.TXT', '.XLSX', '.JSON'].map((ext) => (
                      <span key={ext} className="px-2 py-0.5 rounded-md bg-theme-secondary text-[10px] font-mono font-medium text-theme-text border border-theme-border">
                        {ext}
                      </span>
                    ))}
                    <span className="text-[10px] text-theme-dim ml-1">· Ephemeral RAM staging</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right: Instant Sandbox / Sample Dataset (4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between p-5 rounded-2xl bg-theme-card border border-theme-border shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-theme-dim font-bold">
                Quickstart Sandbox
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[10px] font-mono font-bold">
                Ready to Run
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-theme-text flex items-center gap-1.5">
                <Database className="w-4 h-4 text-theme-accent" />
                NYC Traffic Telemetry
              </h3>
              <p className="text-xs text-theme-muted mt-1 leading-relaxed">
                Test the full pipeline instantly with 527 real vehicle records containing license plates, GPS coordinates, timestamps, and speeds.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
              <div className="px-2.5 py-1.5 rounded-lg bg-theme-secondary/70 border border-theme-border">
                <span className="block text-[10px] text-theme-dim uppercase">Records</span>
                <span className="font-bold text-theme-text">527 Rows</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-theme-secondary/70 border border-theme-border">
                <span className="block text-[10px] text-theme-dim uppercase">Columns</span>
                <span className="font-bold text-theme-text">8 Features</span>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="button"
              disabled={loading}
              onClick={() => profileFile(null, true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-theme-accent text-black font-bold text-xs shadow-theme-glow hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Load Sample Dataset (527 Rows)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Sleek Enterprise Security & Compliance Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-theme-secondary/50 border border-theme-border text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <div>
            <span className="font-bold text-theme-text">Zero Data Retention</span>
            <p className="text-[10px] text-theme-dim">Files purged from RAM immediately post-processing</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-theme-accent shrink-0" />
          <div>
            <span className="font-bold text-theme-text">Auto-Schema Profiling</span>
            <p className="text-[10px] text-theme-dim">Detects plates, GPS coordinates, timestamps, and speeds</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Scale className="w-4 h-4 text-emerald-500 shrink-0" />
          <div>
            <span className="font-bold text-theme-text">QC-01 Reconciliation</span>
            <p className="text-[10px] text-theme-dim">100% mathematical audit: output + dropped = input</p>
          </div>
        </div>
      </div>
    </div>
  );
}
