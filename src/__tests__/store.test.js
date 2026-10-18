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
    expect(useWorkflowStore.getState().customConfig.kThreshold).toBe(5);
    const aggScores = useWorkflowStore.getState().calculateScores();
    expect(aggScores.afterRisk).toContain('Low');
  });
});
