// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../store/useThemeStore';
import { useWorkflowStore, PRESETS } from '../store/useWorkflowStore';

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.getState().setTheme('midnight');
    useThemeStore.getState().setAnimationLevel('full');
  });

  it('initializes with default midnight theme', () => {
    expect(useThemeStore.getState().theme).toBe('midnight');
  });

  it('switches themes and provides correct theme colors', () => {
    useThemeStore.getState().setTheme('aurora');
    expect(useThemeStore.getState().theme).toBe('aurora');
    expect(useThemeStore.getState().getThemeColors().primary).toBe('#ec4899');

    useThemeStore.getState().setTheme('matrix');
    expect(useThemeStore.getState().theme).toBe('matrix');
    expect(useThemeStore.getState().getThemeColors().primary).toBe('#22c55e');
  });

  it('updates animation levels', () => {
    useThemeStore.getState().setAnimationLevel('reduced');
    expect(useThemeStore.getState().animationLevel).toBe('reduced');
  });
});

describe('useWorkflowStore', () => {
  beforeEach(() => {
    useWorkflowStore.getState().resetWorkflow();
  });

  it('initializes at Step 1 (Upload)', () => {
    expect(useWorkflowStore.getState().currentStep).toBe(1);
    expect(useWorkflowStore.getState().file).toBeNull();
  });

  it('advances steps and applies presets correctly', () => {
    useWorkflowStore.getState().setStep(3);
    expect(useWorkflowStore.getState().currentStep).toBe(3);

    useWorkflowStore.getState().applyPreset('max_privacy');
    expect(useWorkflowStore.getState().activePreset).toBe('max_privacy');
    expect(useWorkflowStore.getState().customConfig.gpsPrecision).toBe(1);
    expect(useWorkflowStore.getState().customConfig.timeBucketMinutes).toBe(60);
  });

  it('applies the aggregate-only Maximum Privacy preset and preserves exact raw preset time', () => {
    useWorkflowStore.getState().setProfileData({
      pii_columns: [
        { name: 'entity', category: 'identifier', semantic_type: 'direct_identifier' },
        { name: 'event_time', category: 'datetime', semantic_type: 'quasi_identifier' },
        { name: 'value', category: 'data_attribute', semantic_type: 'numeric_measure' }
      ]
    });
    useWorkflowStore.getState().applyPreset('maximum_privacy');
    expect(useWorkflowStore.getState().customConfig.riskReductionMode).toBe('aggregate');
    expect(useWorkflowStore.getState().customConfig.kThreshold).toBe(5);
    expect(useWorkflowStore.getState().customConfig.gpsPrecision).toBe(1);
    expect(useWorkflowStore.getState().customConfig.timeBucketMinutes).toBe(60);
    expect(useWorkflowStore.getState().customConfig.piiActions).toEqual({
      entity: 'DROP_COLUMN',
      event_time: 'TIME_BUCKET',
      value: 'KEEP'
    });

    useWorkflowStore.getState().applyPreset('raw_passthrough');
    expect(useWorkflowStore.getState().customConfig.timeBucketMinutes).toBe(0);
  });

  it('keeps detected identifiers and free text when Data Processing Only is selected', () => {
    useWorkflowStore.getState().setProfileData({
      pii_columns: [
        { name: 'subject', semantic_type: 'direct_identifier' },
        { name: 'narrative', semantic_type: 'free_text' }
      ]
    });
    useWorkflowStore.getState().applyPreset('raw_passthrough');

    expect(useWorkflowStore.getState().customConfig.piiActions).toEqual({
      subject: 'KEEP',
      narrative: 'KEEP'
    });
  });

  it('calculates dynamic privacy and utility trade-off scores', () => {
    useWorkflowStore.getState().setProfileData({
      pii_columns: [
        { column: 'vehicle_plate', recommended_action: 'PSEUDONYMIZE_HMAC' },
        { column: 'driver_ssn', recommended_action: 'DROP_COLUMN' },
        { column: 'driver_name', recommended_action: 'DROP_COLUMN' }
      ]
    });

    const scores = useWorkflowStore.getState().calculateScores();
    expect(scores.privacyScore).toBeGreaterThanOrEqual(0);
    expect(scores.privacyScore).toBeLessThanOrEqual(100);
    expect(scores.utilityScore).toBeGreaterThanOrEqual(0);
    expect(scores.utilityScore).toBeLessThanOrEqual(100);
  });

  it('updates riskReductionMode and kThreshold and calculates risk shift', () => {
    useWorkflowStore.getState().updateConfig({ riskReductionMode: 'suppress', kThreshold: 4 });
    expect(useWorkflowStore.getState().customConfig.riskReductionMode).toBe('suppress');
    expect(useWorkflowStore.getState().customConfig.kThreshold).toBe(4);
    expect(useWorkflowStore.getState().customConfig.suppressLowK).toBe(true);

    const scores = useWorkflowStore.getState().calculateScores();
    expect(scores.afterRisk).toBe('Low');
    expect(scores.kThreshold).toBe(4);

    useWorkflowStore.getState().updateConfig({ riskReductionMode: 'aggregate', kThreshold: 5 });
    expect(useWorkflowStore.getState().customConfig.riskReductionMode).toBe('aggregate');
    const aggScores = useWorkflowStore.getState().calculateScores();
    expect(aggScores.afterRisk).toBe('Aggregate only');
    expect(aggScores.privacyScore).toBeLessThan(100);
  });

  it('handles multi-sheet Excel profile data and sheet selection', () => {
    useWorkflowStore.getState().setProfileData({
      file_type: 'Excel',
      sheet_names: ['Telemetry_Q1', 'Telemetry_Q2', 'Metadata'],
      selected_sheet: 'Telemetry_Q1'
    });

    expect(useWorkflowStore.getState().sheetNames).toEqual(['Telemetry_Q1', 'Telemetry_Q2', 'Metadata']);
    expect(useWorkflowStore.getState().selectedSheet).toBe('Telemetry_Q1');
    expect(useWorkflowStore.getState().customConfig.sheet).toBe('Telemetry_Q1');

    useWorkflowStore.getState().setSelectedSheet('Telemetry_Q2');
    expect(useWorkflowStore.getState().selectedSheet).toBe('Telemetry_Q2');

    useWorkflowStore.getState().resetWorkflow();
    expect(useWorkflowStore.getState().sheetNames).toEqual([]);
    expect(useWorkflowStore.getState().selectedSheet).toBeNull();
  });
});
