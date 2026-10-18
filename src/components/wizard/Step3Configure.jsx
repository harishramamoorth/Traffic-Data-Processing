import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Sliders,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Info,
  SlidersHorizontal,
  Table,
  Check,
  Trash2,
  KeyRound,
  EyeOff
} from 'lucide-react';
import {
  useWorkflowStore,
  PRESET_DEFINITIONS,
  getPresetConfig,
  computeScores
} from '../../store/useWorkflowStore';
import { useToast } from '../Toast';
import axios from 'axios';

export default function Step3Configure() {
  const { addToast } = useToast();
  const profile = useWorkflowStore((s) => s.profileData);
  const file = useWorkflowStore((s) => s.file);
  const isSample = useWorkflowStore((s) => s.isSample);
  const customConfig = useWorkflowStore((s) => s.customConfig);
  const updateConfig = useWorkflowStore((s) => s.updateConfig);
  const applyPreset = useWorkflowStore((s) => s.applyPreset);
  const activePreset = useWorkflowStore((s) => s.activePreset);
  const calculateScores = useWorkflowStore((s) => s.calculateScores);
  const setStep = useWorkflowStore((s) => s.setStep);
  const initJob = useWorkflowStore((s) => s.initJob);
  const setStageProgress = useWorkflowStore((s) => s.setStageProgress);
  const addLiveLog = useWorkflowStore((s) => s.addLiveLog);
  const completeJob = useWorkflowStore((s) => s.completeJob);

  const [keepWarningCol, setKeepWarningCol] = useState(null);
  const [activeTab, setActiveTab] = useState('privacy'); // 'privacy' | 'processing' | 'preview'

  // PII columns from single source of truth in profile
  const piiColumns = useMemo(() => {
    return profile?.pii_columns || profile?.detected_pii || [];
  }, [profile]);

  // Live Scores calculated with unified scoring function
  const {
    privacyScore,
    utilityScore,
    beforePrivacy,
    beforeUtility,
    beforeRisk,
    afterRisk
  } = calculateScores();

  // Preset scores calculated with the EXACT SAME function
  const presetScores = useMemo(() => {
    const scores = {};
    for (const key of Object.keys(PRESET_DEFINITIONS)) {
      const pConf = getPresetConfig(key, piiColumns);
      scores[key] = computeScores(pConf, piiColumns);
    }
    return scores;
  }, [piiColumns]);

  // In-Memory Live 5-Row Preview Transformation (Item 8)
  const previewRows = useMemo(() => {
    const sourceRows = (profile?.preview_rows && profile.preview_rows.length > 0)
      ? profile.preview_rows.slice(0, 5)
      : [];

    if (!sourceRows || sourceRows.length === 0) {
      return [];
    }

    return sourceRows.map((row) => {
      const out = { ...row };

      // Apply PII Actions
      for (const p of piiColumns) {
        const col = p.name || p.column;
        const action = customConfig?.piiActions?.[col] || p.default_action || p.recommended_action || 'DROP_COLUMN';

        if (action === 'DROP_COLUMN') {
          delete out[col];
        } else if (action === 'KEEP') {
          // Keep raw value unchanged
        } else if (action === 'PSEUDONYMIZE_HMAC') {
          out[col] = p.sample_masked || 'ANON_7c9f8a12e4b0';
        } else if (action === 'REDACT') {
          out[col] = p.sample_masked || '[REDACTED]';
        } else if (action === 'GENERALIZE_SPATIAL') {
          const num = parseFloat(out[col]);
          if (!isNaN(num)) {
            const dec = customConfig?.gpsPrecision ?? 2;
            out[col] = Number(num.toFixed(dec));
          }
        } else if (action === 'TIME_BUCKET') {
          const timeMinutes = customConfig?.timeBucketMinutes ?? 15;
          out[col] = `[${timeMinutes}m UTC Floored]`;
        }
      }

      // Time flooring for timestamps
      const timeMinutes = customConfig?.timeBucketMinutes ?? 15;
      for (const k of Object.keys(out)) {
        if ((k.toLowerCase().includes('time') || k.toLowerCase().includes('date')) && !String(out[k]).includes('Floored')) {
          out[k] = `[${timeMinutes}m UTC Floored]`;
        }
      }

      // Speed outlier flag
      for (const k of Object.keys(out)) {
        if (k.toLowerCase().includes('speed') || k.toLowerCase().includes('velocity')) {
          const spd = parseFloat(out[k]);
          if (!isNaN(spd)) {
            if (customConfig?.outlierStrategy === 'set_null' && (spd > 120 || spd < 0 || spd > 250)) {
              out[k] = null;
            }
            if (spd > 120 || spd < 0 || spd > 250) {
              out.speed_outlier_flag = true;
            }
          }
        }
      }

      return out;
    });
  }, [profile?.preview_rows, piiColumns, customConfig]);

  // Execute Pipeline Processing (Step 4 Trigger)
  const handleStartProcessing = async () => {
    const jobId = `job_${Date.now()}`;
    initJob(jobId);

    // Subscribe to SSE Log Stream
    let eventSource = null;
    try {
      eventSource = new EventSource(`/api/jobs/${jobId}/stream`);

      eventSource.addEventListener('stage', (e) => {
        try {
          const data = JSON.parse(e.data);
          setStageProgress(data.stage, data.percent, data.message);
        } catch {}
      });

      eventSource.addEventListener('log', (e) => {
        try {
          const data = JSON.parse(e.data);
          addLiveLog(data.text);
        } catch {}
      });

      eventSource.addEventListener('error', (e) => {
        console.warn('[SSE] EventSource closed or error:', e);
      });
    } catch (sseErr) {
      console.warn('[SSE] Could not establish EventSource:', sseErr);
    }

    // Submit Job with dynamic config to backend
    const formData = new FormData();
    if (isSample) {
      formData.append('sample', 'true');
    } else if (file) {
      formData.append('file', file);
    }
    formData.append('jobId', jobId);
    formData.append('config', JSON.stringify(customConfig));

    try {
      const res = await axios.post('/api/jobs/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (eventSource) eventSource.close();

      if (res.data?.success && res.data?.job) {
        completeJob(res.data.job, res.data.before_after_sample);
        addToast('Pipeline processing completed successfully!', 'success');
      } else {
        throw new Error(res.data?.error || 'Processing pipeline error');
      }
    } catch (err) {
      if (eventSource) eventSource.close();
      const msg = err.response?.data?.error || err.message || 'Pipeline failed';
      addToast(`Processing failed: ${msg}`, 'error');
      setStep(3); // return to configure
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-theme-card border border-theme-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-400 font-mono text-xs uppercase font-semibold">
              Step 3 of 5
            </span>
            <span className="text-xs text-theme-dim">•</span>
            <span className="text-xs text-theme-muted font-mono">Custom Rules Engine</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-theme-text mt-1">
            Privacy Enforcement & Data Processing Configuration
          </h2>
        </div>

        <button
          type="button"
          onClick={handleStartProcessing}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black text-xs font-bold tracking-wide uppercase shadow-lg shadow-emerald-500/20 transition-all duration-200"
        >
          <Zap className="w-4 h-4 fill-current" />
          <span>Execute Pipeline</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Preset Selector & Live Privacy vs Utility Trade-Off Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Presets Cards */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Standard Compliance Presets
            </span>
            <button
              type="button"
              onClick={() => {
                applyPreset('balanced');
                addToast('Reset to recommended balanced configuration.', 'info');
              }}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono underline underline-offset-2 transition-colors cursor-pointer"
            >
              Reset to recommended
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(PRESET_DEFINITIONS).map(([key, preset]) => {
              const isSelected = activePreset === key;
              const pScore = presetScores[key]?.privacyScore ?? 90;
              const uScore = presetScores[key]?.utilityScore ?? 85;
              return (
                <div
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-purple-500/15 border-purple-500/60 shadow-[0_0_15px_rgba(168,85,247,0.25)] ring-1 ring-purple-500/40'
                      : 'bg-theme-card border-theme-border hover:border-theme-border/80 hover:bg-theme-secondary/40'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-theme-text">{preset.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-purple-400" />}
                    </div>
                    <span className="inline-block px-1.5 py-0.5 rounded bg-theme-secondary text-[9px] font-mono text-purple-300">
                      {preset.badge}
                    </span>
                    <p className="text-[11px] text-theme-dim leading-snug mt-1.5">{preset.desc}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-theme-border/50 text-[10px] font-mono mt-3">
                    <span className="text-emerald-400 font-semibold">Privacy: {pScore}</span>
                    <span className="text-cyan-400 font-semibold">Utility: {uScore}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Privacy vs Utility Dial Card */}
        <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-cyan-400" />
              Live Trade-Off Score
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
              Live Calc
            </span>
          </div>

          <div className="space-y-4">
            {/* Privacy Score Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-theme-muted flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Privacy Protection
                </span>
                <div className="flex items-center gap-1.5">
                  {customConfig.riskReductionMode && customConfig.riskReductionMode !== 'none' && beforePrivacy !== privacyScore && (
                    <span className="text-[10px] text-theme-dim">
                      (Before: <span className="line-through">{beforePrivacy}</span>)
                    </span>
                  )}
                  <span className="font-bold text-emerald-400">{privacyScore}/100</span>
                  {customConfig.riskReductionMode && customConfig.riskReductionMode !== 'none' && beforePrivacy !== privacyScore && (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/30">
                      +{privacyScore - beforePrivacy}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-2 w-full bg-theme-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                  initial={false}
                  animate={{ width: `${privacyScore}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Utility Score Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-theme-muted flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  Data Utility
                </span>
                <div className="flex items-center gap-1.5">
                  {customConfig.riskReductionMode && customConfig.riskReductionMode !== 'none' && beforeUtility !== utilityScore && (
                    <span className="text-[10px] text-theme-dim">
                      (Before: <span className="line-through">{beforeUtility}</span>)
                    </span>
                  )}
                  <span className="font-bold text-cyan-400">{utilityScore}/100</span>
                  {customConfig.riskReductionMode && customConfig.riskReductionMode !== 'none' && beforeUtility !== utilityScore && (
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1 rounded border border-amber-500/30">
                      {utilityScore - beforeUtility}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-2 w-full bg-theme-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                  initial={false}
                  animate={{ width: `${utilityScore}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Before vs After Risk Trade-Off Pill */}
            {customConfig.riskReductionMode && customConfig.riskReductionMode !== 'none' && (
              <div className="pt-1 flex items-center justify-between text-[11px] font-mono bg-theme-secondary/60 px-3 py-1.5 rounded-xl border border-theme-border/60">
                <span className="text-theme-muted">Re-ID Risk Impact:</span>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 line-through">
                    {beforeRisk}
                  </span>
                  <span className="text-theme-dim">→</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                    {afterRisk}
                  </span>
                </div>
              </div>
            )}
          </div>

          <p className="text-[10px] text-theme-dim leading-relaxed">
            Higher spatial/temporal generalization raises privacy score while trading analytical precision.
          </p>
        </div>
      </div>

      {/* Tabs: Panel A (Processing), Panel B (Privacy), Live Preview */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-theme-border pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'privacy'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Panel B: Privacy Protection ({piiColumns.length} Fields)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('processing')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'processing'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Panel A: Data Processing & Cleaning</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'preview'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Live 5-Row In-Memory Preview</span>
          </button>
        </div>

        {/* PANEL B: PRIVACY PROTECTION */}
        {activeTab === 'privacy' && (
          <div className="space-y-6">
            {/* Generalization Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-2xl bg-theme-card border border-theme-border">
              {/* GPS Precision Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-theme-text">
                    Spatial Generalization (GPS Precision)
                  </label>
                  <span className="font-mono text-xs text-cyan-400 font-bold">
                    {customConfig.gpsPrecision} Decimals (~
                    {customConfig.gpsPrecision === 0
                      ? '111 km'
                      : customConfig.gpsPrecision === 1
                      ? '11 km'
                      : customConfig.gpsPrecision === 2
                      ? '1.1 km'
                      : customConfig.gpsPrecision === 3
                      ? '110 m'
                      : '11 m'}
                    )
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={customConfig.gpsPrecision}
                  onChange={(e) => updateConfig({ gpsPrecision: parseInt(e.target.value, 10) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-theme-dim font-mono">
                  <span>0 (City ~111km)</span>
                  <span>2 (District ~1.1km)</span>
                  <span>4 (Precise ~11m)</span>
                </div>
              </div>

              {/* Temporal Bucketing Selector */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-theme-text">
                    Temporal Privacy (Floor Bucketing)
                  </label>
                  <span className="font-mono text-xs text-cyan-400 font-bold">
                    {customConfig.timeBucketMinutes} Minutes
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 15, 30, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => updateConfig({ timeBucketMinutes: mins })}
                      className={`py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${
                        customConfig.timeBucketMinutes === mins
                          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-sm'
                          : 'bg-theme-secondary text-theme-muted border-theme-border hover:text-theme-text'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-theme-dim">
                  Floors seconds and minutes to prevent individual trip re-identification.
                </p>
              </div>
            </div>

            {/* Risk Reduction Options (Item 3) */}
            <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    Risk Reduction (k-Anonymity Guard)
                  </h3>
                  <p className="text-[11px] text-theme-dim mt-0.5">
                    Select mode for handling quasi-identifiers (timestamp, GPS, vehicle type, road segment).
                  </p>
                </div>
                {customConfig.riskReductionMode && customConfig.riskReductionMode !== 'none' && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shrink-0">
                    Enforcing k ≥ {customConfig.kThreshold ?? 3}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Mode A: None */}
                <div
                  id="risk-reduction-none"
                  onClick={() => updateConfig({ riskReductionMode: 'none', suppressLowK: false })}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    (!customConfig.riskReductionMode || customConfig.riskReductionMode === 'none')
                      ? 'bg-cyan-500/10 border-cyan-500/60 shadow-sm'
                      : 'bg-theme-secondary/40 border-theme-border hover:border-theme-border/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-theme-text">None</span>
                    <span className="text-[10px] font-mono text-theme-dim uppercase">Report only</span>
                  </div>
                  <p className="text-[11px] text-theme-dim leading-relaxed">
                    Audits and reports k-anonymity distribution & risk level without altering small cohorts.
                  </p>
                </div>

                {/* Mode B: Suppress */}
                <div
                  id="risk-reduction-suppress"
                  onClick={() => updateConfig({ riskReductionMode: 'suppress', suppressLowK: true })}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    customConfig.riskReductionMode === 'suppress'
                      ? 'bg-cyan-500/10 border-cyan-500/60 shadow-sm'
                      : 'bg-theme-secondary/40 border-theme-border hover:border-theme-border/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-theme-text">Suppress</span>
                    <span className="text-[10px] font-mono text-cyan-400 uppercase">Enforce k ≥ K</span>
                  </div>
                  <p className="text-[11px] text-theme-dim leading-relaxed">
                    Generalizes step-by-step (15m → 60m, GPS 2 → 1 dec, vehicle → Other); moves any stubborn k &lt; K rows to suppressed count.
                  </p>
                </div>

                {/* Mode C: Aggregate */}
                <div
                  id="risk-reduction-aggregate"
                  onClick={() => updateConfig({ riskReductionMode: 'aggregate', suppressLowK: false })}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    customConfig.riskReductionMode === 'aggregate'
                      ? 'bg-cyan-500/10 border-cyan-500/60 shadow-sm'
                      : 'bg-theme-secondary/40 border-theme-border hover:border-theme-border/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-theme-text">Aggregate</span>
                    <span className="text-[10px] font-mono text-emerald-400 uppercase">Dual Dataset</span>
                  </div>
                  <p className="text-[11px] text-theme-dim leading-relaxed">
                    Outputs a second aggregated dataset: 1 row per road segment per hour. Drops all microdata & suppresses cells &lt; K.
                  </p>
                </div>
              </div>

              {/* K Threshold Slider (2 to 10, default 3) */}
              {customConfig.riskReductionMode && customConfig.riskReductionMode !== 'none' && (
                <div className="pt-3 border-t border-theme-border/40 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-semibold text-theme-text flex items-center gap-1.5">
                      <span>Threshold K</span>
                      <span className="text-theme-dim text-[11px] font-normal font-mono">(Selectable 2 to 10, default 3)</span>
                    </label>
                    <span className="font-mono text-xs text-cyan-400 font-bold bg-cyan-500/10 px-2.5 py-0.5 rounded border border-cyan-500/30">
                      K = {customConfig.kThreshold ?? 3}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    step="1"
                    value={customConfig.kThreshold ?? 3}
                    onChange={(e) => updateConfig({ kThreshold: parseInt(e.target.value, 10) })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-theme-dim font-mono">
                    <span>K = 2 (Relaxed)</span>
                    <span>K = 3 (Recommended)</span>
                    <span>K = 5</span>
                    <span>K = 10 (Strict)</span>
                  </div>
                </div>
              )}
            </div>

            {/* PII Columns Grid (Item 5: 1 Card per entry in pii_columns with 6-action dropdown) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {piiColumns.map((pii) => {
                const colName = pii.name || pii.column;
                const currentAction = customConfig.piiActions?.[colName] || pii.default_action || pii.recommended_action || 'DROP_COLUMN';
                const confidencePct = Math.round((typeof pii.confidence === 'number' ? pii.confidence : 0.95) * 100);
                const riskBadge = pii.risk_badge || (confidencePct >= 95 ? 'CRITICAL' : confidencePct >= 80 ? 'HIGH' : 'MEDIUM');

                return (
                  <div
                    key={colName}
                    data-pii-card={colName}
                    className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-3.5 flex flex-col justify-between shadow-sm hover:border-theme-border/80 transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-theme-text truncate">{colName}</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
                            riskBadge === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : riskBadge === 'HIGH'
                              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {riskBadge} Risk
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-theme-muted">
                        <span className="font-medium text-theme-text">{pii.classification || 'Direct Identifier'}</span>
                        <span className="text-theme-dim">•</span>
                        <span className="font-mono text-cyan-400 font-semibold">{confidencePct}% confidence</span>
                      </div>

                      {pii.reason && (
                        <p className="text-[11px] text-theme-dim line-clamp-2 leading-relaxed">
                          {pii.reason}
                        </p>
                      )}

                      <div className="pt-1 flex items-center gap-2 text-xs font-mono">
                        <span className="text-theme-dim text-[11px]">Masked Sample:</span>
                        <span className="px-2 py-0.5 rounded bg-theme-secondary text-cyan-300 text-[11px] border border-theme-border truncate max-w-xs">
                          {pii.sample_masked || '[REDACTED]'}
                        </span>
                      </div>
                    </div>

                    {/* Action Selector with all 6 required actions */}
                    <div className="space-y-1.5 pt-3 border-t border-theme-border/50">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-semibold text-theme-dim uppercase tracking-wider block">
                          Privacy Action
                        </label>
                        {currentAction === 'KEEP' && (
                          <span className="text-[10px] font-mono text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Unprotected
                          </span>
                        )}
                      </div>
                      <select
                        value={currentAction}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'KEEP') {
                            setKeepWarningCol(colName);
                          } else {
                            updateConfig({
                              piiActions: { ...customConfig.piiActions, [colName]: val }
                            });
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-xl bg-theme-secondary border text-xs text-theme-text font-mono focus:outline-none transition-colors ${
                          currentAction === 'KEEP'
                            ? 'border-rose-500/60 bg-rose-500/10 text-rose-300'
                            : 'border-theme-border focus:border-cyan-400'
                        }`}
                      >
                        <option value="PSEUDONYMIZE_HMAC">Pseudonymize (HMAC)</option>
                        <option value="REDACT">Redact</option>
                        <option value="DROP_COLUMN">Remove column</option>
                        <option value="GENERALIZE_SPATIAL">Generalize</option>
                        <option value="TIME_BUCKET">Time-bucket</option>
                        <option value="KEEP">Keep (Warning Required)</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PANEL A: DATA PROCESSING & CLEANING */}
        {activeTab === 'processing' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Toggles Card */}
              <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-4">
                <h3 className="text-xs font-semibold text-theme-text uppercase tracking-wider">
                  Standardization & Hygiene
                </h3>

                <div className="space-y-3 text-xs">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-theme-muted">Standardize column names to snake_case</span>
                    <input
                      type="checkbox"
                      checked={customConfig.standardizeColumnNames}
                      onChange={(e) => updateConfig({ standardizeColumnNames: e.target.checked })}
                      className="w-4 h-4 rounded accent-cyan-400"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-theme-muted">Standardize timestamps to ISO-8601 UTC</span>
                    <input
                      type="checkbox"
                      checked={customConfig.standardizeDates}
                      onChange={(e) => updateConfig({ standardizeDates: e.target.checked })}
                      className="w-4 h-4 rounded accent-cyan-400"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-theme-muted">Trim whitespace from text strings</span>
                    <input
                      type="checkbox"
                      checked={customConfig.trimWhitespace}
                      onChange={(e) => updateConfig({ trimWhitespace: e.target.checked })}
                      className="w-4 h-4 rounded accent-cyan-400"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-theme-muted">Audit & reject duplicate rows</span>
                    <input
                      type="checkbox"
                      checked={customConfig.removeDuplicates}
                      onChange={(e) => updateConfig({ removeDuplicates: e.target.checked })}
                      className="w-4 h-4 rounded accent-cyan-400"
                    />
                  </label>
                </div>
              </div>

              {/* Outliers Strategy Card */}
              <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-4">
                <h3 className="text-xs font-semibold text-theme-text uppercase tracking-wider">
                  Speed Outlier Strategy (Non-Clamping)
                </h3>

                <div className="space-y-2.5 text-xs">
                  <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg bg-theme-secondary/40 border border-theme-border/50">
                    <input
                      type="radio"
                      name="outlier"
                      value="flag_only"
                      checked={customConfig.outlierStrategy === 'flag_only'}
                      onChange={() => updateConfig({ outlierStrategy: 'flag_only' })}
                      className="mt-0.5 accent-cyan-400"
                    />
                    <div>
                      <span className="font-semibold text-theme-text">Flag Only (Recommended)</span>
                      <p className="text-[11px] text-theme-dim">
                        Preserves original telemetry while adding `speed_outlier_flag = true` for QC audits.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg bg-theme-secondary/40 border border-theme-border/50">
                    <input
                      type="radio"
                      name="outlier"
                      value="set_null"
                      checked={customConfig.outlierStrategy === 'set_null'}
                      onChange={() => updateConfig({ outlierStrategy: 'set_null' })}
                      className="mt-0.5 accent-cyan-400"
                    />
                    <div>
                      <span className="font-semibold text-theme-text">Set to Null</span>
                      <p className="text-[11px] text-theme-dim">
                        Replaces physically impossible speeds (&lt;0 or &gt;250 mph) with null.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg bg-theme-secondary/40 border border-theme-border/50">
                    <input
                      type="radio"
                      name="outlier"
                      value="cap"
                      checked={customConfig.outlierStrategy === 'cap'}
                      onChange={() => updateConfig({ outlierStrategy: 'cap' })}
                      className="mt-0.5 accent-cyan-400"
                    />
                    <div>
                      <span className="font-semibold text-theme-text">Cap at 120 mph</span>
                      <p className="text-[11px] text-theme-dim">
                        Truncates values above 120 mph (not recommended for strict audits).
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Spatial, Temporal & k-Anonymity Generalization Card (Items 7, 15, 19) */}
            <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <span>Spatial, Temporal & k-Anonymity Generalization</span>
                </h3>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                  Adaptive Controls
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* GPS Precision */}
                <div className="p-4 rounded-xl bg-theme-secondary/40 border border-theme-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-theme-text flex items-center gap-1">
                      <span>GPS Decimal Precision</span>
                      <span className="text-theme-dim font-mono text-[11px]">({customConfig.gpsPrecision ?? 2} decimals)</span>
                    </label>
                    <span className="text-[11px] font-mono text-cyan-300">
                      {(customConfig.gpsPrecision ?? 2) === 1 && '~11 km (District)'}
                      {(customConfig.gpsPrecision ?? 2) === 2 && '~1.1 km (Neighborhood - Default)'}
                      {(customConfig.gpsPrecision ?? 2) === 3 && '~110 m (Street Level)'}
                      {(customConfig.gpsPrecision ?? 2) === 4 && '~11 m (Exact Lane)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((dec) => (
                      <button
                        key={dec}
                        type="button"
                        onClick={() => updateConfig({ gpsPrecision: dec })}
                        className={`py-2 px-1 rounded-xl text-xs font-mono font-bold border transition-all ${
                          (customConfig.gpsPrecision ?? 2) === dec
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-sm'
                            : 'bg-theme-secondary text-theme-muted border-theme-border hover:text-white'
                        }`}
                      >
                        {dec} Dec {dec === 2 && '★'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-theme-dim leading-relaxed">
                    Truncates GPS latitude and longitude decimals. Fewer decimals group more vehicles together, increasing k-anonymity protection.
                  </p>
                </div>

                {/* Time Bucketing Window */}
                <div className="p-4 rounded-xl bg-theme-secondary/40 border border-theme-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-theme-text flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Timestamp Bucketing Window</span>
                    </label>
                    <span className="text-[11px] font-mono text-cyan-300">{customConfig.timeBucketMinutes ?? 15} min window</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 15, 30, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => updateConfig({ timeBucketMinutes: mins })}
                        className={`py-2 px-1 rounded-xl text-xs font-mono font-bold border transition-all ${
                          (customConfig.timeBucketMinutes ?? 15) === mins
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-sm'
                            : 'bg-theme-secondary text-theme-muted border-theme-border hover:text-white'
                        }`}
                      >
                        {mins}m {mins === 15 && '★'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-theme-dim leading-relaxed">
                    Floors timestamps into uniform UTC windows to obscure exact vehicle speeds between road segments.
                  </p>
                </div>
              </div>

              {/* Suppress Low-k Records (Item 15) */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer p-3.5 rounded-xl bg-theme-secondary/40 border border-theme-border/50 hover:bg-theme-secondary/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={Boolean(customConfig.suppressLowK)}
                    onChange={(e) => updateConfig({ suppressLowK: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded accent-cyan-400 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-theme-text">
                        Suppress Quasi-Identifier Groups Below k (k &lt; 3)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                        k-Anonymity Defense
                      </span>
                    </div>
                    <p className="text-[11px] text-theme-dim leading-relaxed">
                      Masks or generalizes sparse records that belong to cohorts with fewer than 3 matching vehicles, defending against linkage and re-identification attacks.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Numeric Range Bounds */}
            <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-4">
              <h3 className="text-xs font-semibold text-theme-text uppercase tracking-wider">
                Numeric Range Bounds Validation
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {numericColumns.map((nc) => (
                  <div key={nc.column} className="p-3 rounded-xl bg-theme-secondary border border-theme-border space-y-2">
                    <span className="text-xs font-mono font-bold text-theme-text block">{nc.column}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-theme-dim">Min</span>
                        <input
                          type="number"
                          defaultValue={nc.min}
                          className="w-20 px-2 py-1 rounded bg-theme-card border border-theme-border text-theme-text text-xs font-mono"
                        />
                      </div>
                      <span className="text-theme-dim self-end mb-1">to</span>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-theme-dim">Max</span>
                        <input
                          type="number"
                          defaultValue={nc.max}
                          className="w-20 px-2 py-1 rounded bg-theme-card border border-theme-border text-theme-text text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LIVE 5-ROW IN-MEMORY PREVIEW */}
        {activeTab === 'preview' && (
          <div className="p-5 rounded-2xl bg-theme-card border border-theme-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-cyan-400" />
                  Live In-Memory Transformation Preview
                </span>
                <span className="text-[11px] text-theme-dim">
                  Live transformation simulated on first 5 records of uploaded dataset (Zero disk storage)
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
                Session Preview Only
              </span>
            </div>

            {previewRows.length === 0 ? (
              <div className="text-center py-8 text-xs text-theme-dim font-mono">
                Upload a dataset to generate live configuration preview.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-theme-border text-theme-dim text-[10px] uppercase">
                      {previewRows[0] &&
                        Object.keys(previewRows[0]).map((h) => (
                          <th key={h} className="pb-3 px-2 font-semibold">
                            {h}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border/50">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-theme-secondary/40 transition-colors">
                        {Object.entries(row).map(([col, val], j) => (
                          <td key={j} className="py-2.5 px-2 text-theme-muted">
                            {String(val).startsWith('ANON_') ? (
                              <span className="text-cyan-300 font-bold">{val}</span>
                            ) : String(val).includes('[REDACTED]') ? (
                              <span className="text-rose-400 font-bold">{val}</span>
                            ) : val === true ? (
                              <span className="text-amber-400 font-bold">true</span>
                            ) : (
                              String(val)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* KEEP Confirmation Warning Modal */}
      {keepWarningCol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full p-6 rounded-2xl bg-theme-card border border-rose-500/50 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-theme-text">Privacy Warning</h3>
            </div>
            <p className="text-xs text-theme-muted leading-relaxed">
              Retaining raw PII in <span className="font-mono text-rose-300 font-bold">{keepWarningCol}</span> may
              violate GDPR, CCPA, or institutional privacy policies. Are you certain you want to bypass automated
              pseudonymization/redaction?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setKeepWarningCol(null)}
                className="px-4 py-2 rounded-xl bg-theme-secondary text-xs text-theme-text font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  updateConfig({
                    piiActions: { ...customConfig.piiActions, [keepWarningCol]: 'KEEP' }
                  });
                  setKeepWarningCol(null);
                  addToast(`Retained raw field '${keepWarningCol}' per manual override.`, 'warning');
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white"
              >
                Confirm Keep
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-theme-border/50">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-theme-secondary text-theme-muted hover:text-theme-text border border-theme-border text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Analysis</span>
        </button>

        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            disabled={piiColumns.length === 0 && !profile}
            onClick={handleStartProcessing}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black text-xs font-bold tracking-wide uppercase shadow-lg shadow-emerald-500/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title={piiColumns.length === 0 && !profile ? 'A dataset must be profiled before running pipeline execution' : 'Execute data cleaning, pseudonymization, and reconciliation audits'}
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>Execute Pipeline</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          {piiColumns.length === 0 && !profile && (
            <span className="text-[10px] text-amber-400">Profile a dataset first to enable pipeline execution</span>
          )}
        </div>
      </div>
    </div>
  );
}
