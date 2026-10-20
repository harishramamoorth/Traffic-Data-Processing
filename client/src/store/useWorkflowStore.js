import { create } from 'zustand';

export const DEFAULT_CONFIG = {
  standardizeColumnNames: true,
  standardizeDates: true,
  trimWhitespace: true,
  removeDuplicates: true,
  outlierStrategy: 'flag_only', // 'flag_only' | 'set_null' | 'cap'
  gpsPrecision: 2, // 0 to 4 decimals
  timeBucketMinutes: 15, // 5, 15, 30, 60
  suppressLowK: false,
  riskReductionMode: 'none', // 'none' | 'suppress' | 'aggregate'
  kThreshold: 3, // 2 to 10
  piiActions: {}, // { column: action }
  missingValueStrategy: {} // { column: 'drop' | 'median' | 'mode' | 'leave_null' }
};

export const PRESET_DEFINITIONS = {
  max_privacy: {
    id: 'max_privacy',
    name: 'Public Statistics (Max Privacy)',
    badge: 'Public Portal / Strict',
    desc: 'Aggressive data minimization, 1-decimal GPS (~11 km), 60-min time bucketing, Suppress (K=3) or Aggregate macro table.',
    gpsPrecision: 1,
    timeBucketMinutes: 60,
    outlierStrategy: 'set_null',
    suppressLowK: true,
    riskReductionMode: 'suppress',
    kThreshold: 3,
    getAction: (col, category) => {
      if (category === 'coordinates') return 'GENERALIZE_SPATIAL';
      return 'DROP_COLUMN';
    }
  },
  balanced: {
    id: 'balanced',
    name: 'Protected Sharing (Recommended)',
    badge: 'Production Default',
    desc: 'HMAC plate pseudonymization, 2-decimal GPS (~1.1 km), 15-min bucketing, full row reconciliation.',
    gpsPrecision: 2,
    timeBucketMinutes: 15,
    outlierStrategy: 'flag_only',
    suppressLowK: false,
    riskReductionMode: 'none',
    kThreshold: 3,
    getAction: (col, category) => {
      if (category === 'plate_number' || category === 'identifier') return 'PSEUDONYMIZE_HMAC';
      if (category === 'coordinates') return 'GENERALIZE_SPATIAL';
      if (category === 'free_text_pii') return 'REDACT';
      return 'DROP_COLUMN';
    }
  },
  max_utility: {
    id: 'max_utility',
    name: 'Internal Analysis (Max Utility)',
    badge: 'Analytics Optimized',
    desc: 'Fine-grained 3-decimal GPS (~110 m), 5-min time bucketing for high-resolution traffic telemetry.',
    gpsPrecision: 3,
    timeBucketMinutes: 5,
    outlierStrategy: 'flag_only',
    suppressLowK: false,
    riskReductionMode: 'none',
    kThreshold: 3,
    getAction: (col, category) => {
      if (category === 'plate_number' || category === 'identifier') return 'PSEUDONYMIZE_HMAC';
      if (category === 'coordinates') return 'GENERALIZE_SPATIAL';
      if (category === 'free_text_pii') return 'REDACT';
      return 'PSEUDONYMIZE_HMAC';
    }
  }
};

/**
 * Generates exact preset configuration given detected PII columns.
 */
export function getPresetConfig(presetKey, piiColumns = []) {
  let effectiveKey = presetKey;
  if (presetKey === 'internal_analysis') effectiveKey = 'max_utility';
  if (presetKey === 'protected_sharing') effectiveKey = 'balanced';
  if (presetKey === 'public_statistics') effectiveKey = 'max_privacy';

  const def = PRESET_DEFINITIONS[effectiveKey] || PRESET_DEFINITIONS.balanced;
  const piiActions = {};
  for (const p of piiColumns) {
    const colName = p.name || p.column;
    piiActions[colName] = def.getAction(colName, p.category);
  }
  return {
    gpsPrecision: def.gpsPrecision,
    timeBucketMinutes: def.timeBucketMinutes,
    outlierStrategy: def.outlierStrategy,
    suppressLowK: def.suppressLowK,
    riskReductionMode: def.riskReductionMode || 'none',
    kThreshold: def.kThreshold || 3,
    piiActions
  };
}

/**
 * SINGLE UNIFIED FUNCTION: Computes Privacy Score and Utility Score from configuration.
 * Presets and live configuration MUST use this exact same function.
 * Calculates before/after risk and utility when Risk Reduction is enabled.
 */
export function computeScores(config = {}, piiColumns = []) {
  const piiActions = config.piiActions || {};
  let dropCount = 0;
  let hmacCount = 0;
  let redactCount = 0;
  let generalizeCount = 0;
  let timeBucketCount = 0;
  let keepCount = 0;

  for (const p of piiColumns) {
    const colName = p.name || p.column;
    const act = piiActions[colName] || p.default_action || p.recommended_action || 'DROP_COLUMN';
    if (act === 'DROP_COLUMN') dropCount++;
    else if (act === 'PSEUDONYMIZE_HMAC') hmacCount++;
    else if (act === 'REDACT') redactCount++;
    else if (act === 'GENERALIZE_SPATIAL') generalizeCount++;
    else if (act === 'TIME_BUCKET') timeBucketCount++;
    else if (act === 'KEEP') keepCount++;
  }

  const gpsPrecision = config.gpsPrecision ?? 2;
  const timeBucketMinutes = config.timeBucketMinutes ?? 15;

  // Base Privacy Score (0-100)
  const gpsPrivacyDelta = (2 - gpsPrecision) * 6; // precision 0 (+12), 1 (+6), 2 (0), 3 (-6), 4 (-12)
  const timePrivacyDelta = timeBucketMinutes >= 60 ? 10 : timeBucketMinutes >= 30 ? 6 : timeBucketMinutes >= 15 ? 0 : -6;
  const actionPrivacyDelta = (dropCount * 7) + (hmacCount * 5) + (redactCount * 5) + (generalizeCount * 4) + (timeBucketCount * 4) - (keepCount * 18);

  const rawBasePrivacy = 55 + actionPrivacyDelta + gpsPrivacyDelta + timePrivacyDelta;
  const basePrivacyScore = Math.min(100, Math.max(10, Math.round(rawBasePrivacy)));

  // Base Utility Score (0-100)
  const gpsUtilityDelta = (gpsPrecision - 2) * 8; // precision 0 (-16), 1 (-8), 2 (0), 3 (+8), 4 (+16)
  const timeUtilityDelta = timeBucketMinutes <= 5 ? 10 : timeBucketMinutes <= 15 ? 0 : timeBucketMinutes <= 30 ? -8 : -16;
  const actionUtilityDelta = (keepCount * 8) + (hmacCount * 6) + (generalizeCount * 5) + (redactCount * 3) + (timeBucketCount * 4) - (dropCount * 8);

  const rawBaseUtility = 62 + actionUtilityDelta + gpsUtilityDelta + timeUtilityDelta;
  const baseUtilityScore = Math.min(100, Math.max(15, Math.round(rawBaseUtility)));

  // Re-identification Risk & Reduction adjustments
  const mode = config.riskReductionMode || (config.suppressLowK ? 'suppress' : 'none');
  const kThreshold = config.kThreshold || 3;

  let afterPrivacy = basePrivacyScore;
  let afterUtility = baseUtilityScore;
  let beforeRisk = basePrivacyScore < 70 ? 'High' : basePrivacyScore < 85 ? 'Medium' : 'Low';
  let afterRisk = beforeRisk;

  if (mode === 'suppress') {
    const kFactor = (kThreshold - 2) * 2;
    afterPrivacy = Math.min(98, basePrivacyScore + 14 + kFactor);
    afterUtility = Math.max(25, baseUtilityScore - (8 + kFactor));
    afterRisk = 'Low';
  } else if (mode === 'aggregate') {
    afterPrivacy = 96;
    afterUtility = Math.max(30, Math.round(baseUtilityScore * 0.65));
    afterRisk = 'Low (Zero microdata)';
  }

  return {
    privacyScore: afterPrivacy,
    utilityScore: afterUtility,
    beforePrivacy: basePrivacyScore,
    beforeUtility: baseUtilityScore,
    afterPrivacy,
    afterUtility,
    beforeRisk,
    afterRisk,
    mode,
    kThreshold
  };
}

// Backwards compatibility for components importing PRESETS
export const PRESETS = PRESET_DEFINITIONS;

export const useWorkflowStore = create((set, get) => ({
  currentStep: 1, // 1 to 5
  file: null,
  isSample: false,
  uploadProgress: 0,
  isUploading: false,

  // Profile Analysis Data (Step 2)
  profileData: null,
  isProfiling: false,
  sheetNames: [],
  selectedSheet: null,

  // Configuration (Step 3)
  activePreset: 'balanced',
  customConfig: { ...DEFAULT_CONFIG },

  // Live Processing State (Step 4)
  jobId: null,
  isProcessing: false,
  stageProgress: { stage: 'init', percent: 0, message: 'Ready' },
  liveLogs: [],

  // Results State (Step 5)
  activeJob: null,
  sessionSample: null, // Before / After in-memory records
  analyticsData: null, // Pre-aggregated charts

  // Actions
  setStep: (step) => set({ currentStep: step }),

  setFile: (file, isSample = false) => {
    set({ file, isSample });
  },

  setUploadProgress: (progress) => set({ uploadProgress: progress }),
  setIsUploading: (val) => set({ isUploading: val }),

  setSelectedSheet: (sheet) => set({ selectedSheet: sheet }),

  setProfileData: (data) => {
    // Auto-populate default PII actions based on single source of truth pii_columns
    const piiCols = data?.pii_columns || data?.detected_pii || [];
    const initialPiiActions = {};
    for (const p of piiCols) {
      const colName = p.name || p.column;
      initialPiiActions[colName] = p.default_action || p.recommended_action || 'DROP_COLUMN';
    }
    const sheetNames = data?.sheet_names || [];
    const selectedSheet = data?.selected_sheet || (sheetNames.length > 0 ? sheetNames[0] : null);

    set((state) => ({
      profileData: data,
      isProfiling: false,
      sheetNames,
      selectedSheet,
      customConfig: {
        ...state.customConfig,
        sheet: selectedSheet,
        piiActions: { ...initialPiiActions, ...state.customConfig.piiActions }
      }
    }));
  },

  setIsProfiling: (val) => set({ isProfiling: val }),

  updateConfig: (updates) => {
    const nextUpdates = { ...updates };
    if ('riskReductionMode' in nextUpdates) {
      nextUpdates.suppressLowK = nextUpdates.riskReductionMode === 'suppress';
    }
    set((state) => ({
      customConfig: { ...state.customConfig, ...nextUpdates },
      activePreset: 'custom'
    }));
  },

  applyPreset: (presetKey) => {
    let effectiveKey = presetKey;
    if (presetKey === 'internal_analysis') effectiveKey = 'max_utility';
    if (presetKey === 'protected_sharing') effectiveKey = 'balanced';
    if (presetKey === 'public_statistics') effectiveKey = 'max_privacy';

    const { profileData } = get();
    const piiCols = profileData?.pii_columns || profileData?.detected_pii || [];
    const presetOverrides = getPresetConfig(effectiveKey, piiCols);

    set((state) => ({
      activePreset: effectiveKey,
      customConfig: {
        ...state.customConfig,
        ...presetOverrides
      }
    }));
  },

  calculateScores: () => {
    const { customConfig, profileData } = get();
    const piiCols = profileData?.pii_columns || profileData?.detected_pii || [];
    return computeScores(customConfig, piiCols);
  },

  initJob: (jobId) => {
    set({
      jobId,
      isProcessing: true,
      currentStep: 4,
      liveLogs: [],
      stageProgress: { stage: 'init', percent: 5, message: 'Initiating pipeline...' }
    });
  },

  setStageProgress: (stage, percent, message) => {
    set({ stageProgress: { stage, percent, message } });
  },

  addLiveLog: (logText) => {
    set((state) => ({ liveLogs: [...state.liveLogs, logText] }));
  },

  completeJob: (job, sessionSample) => {
    set({
      activeJob: job,
      sessionSample,
      isProcessing: false,
      currentStep: 5
    });
  },

  setAnalyticsData: (analytics) => set({ analyticsData: analytics }),

  resetWorkflow: () => {
    set({
      currentStep: 1,
      file: null,
      isSample: false,
      uploadProgress: 0,
      profileData: null,
      sheetNames: [],
      selectedSheet: null,
      activePreset: 'balanced',
      customConfig: { ...DEFAULT_CONFIG },
      jobId: null,
      isProcessing: false,
      stageProgress: { stage: 'init', percent: 0, message: 'Ready' },
      liveLogs: [],
      activeJob: null,
      sessionSample: null,
      analyticsData: null
    });
  }
}));
